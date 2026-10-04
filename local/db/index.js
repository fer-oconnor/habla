// ---------------------------------------------------------------------------
// Habla - acceso a SQLite
//
// Este archivo es la UNICA puerta de entrada a la base de datos. El resto del
// servidor usa `getDb()` y nunca sabe que driver hay debajo.
//
// Driver principal: better-sqlite3 (modulo nativo, muy rapido).
// Driver de reserva: `node:sqlite`, el SQLite incluido en Node >= 22.13.
//
// Por que hay reserva: better-sqlite3 se compila en C++. En Windows, si npm no
// encuentra un binario precompilado para tu version de Node, intenta compilarlo
// y falla si no tienes Visual Studio Build Tools. Para que la app arranque
// igualmente, detectamos el fallo y usamos `node:sqlite`. En los dos casos la
// persistencia sigue siendo el MISMO archivo .db de SQLite: no se pierde nada.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(__dirname, '..');
export const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// --- Eleccion del driver ----------------------------------------------------
let driverName = 'better-sqlite3';
let BetterSqlite3 = null;
let NodeSqlite = null;

try {
  if (process.env.HABLA_SQLITE_DRIVER === 'node') {
    throw Object.assign(new Error('SQLite integrado seleccionado'), { code: 'HABLA_NODE_SQLITE' });
  }
  BetterSqlite3 = (await import('better-sqlite3')).default;
  // Importar el paquete no carga su binario nativo; abrir una base temporal
  // detecta tambien una instalacion sin binario compatible con este Node.
  const probe = new BetterSqlite3(':memory:');
  probe.close();
} catch (error) {
  BetterSqlite3 = null;
  try {
    NodeSqlite = (await import('node:sqlite')).DatabaseSync;
    driverName = 'node:sqlite';
    console.warn(
      (error.code === 'HABLA_NODE_SQLITE'
        ? '[habla] SQLite integrado seleccionado. '
        : '[habla] No se pudo cargar better-sqlite3 (' + (error.code || 'binario no disponible') + '). ') +
      'Uso el SQLite integrado de Node (node:sqlite). La persistencia en el ' +
      'archivo .db no cambia.'
    );
  } catch {
    throw new Error(
      'No hay ningun driver de SQLite disponible. Instala las dependencias con ' +
      '"npm install" y usa Node 22.13 o superior.'
    );
  }
}

export function getDriverName() {
  return driverName;
}

// --- Envoltorio uniforme ----------------------------------------------------

function toNumber(value) {
  return typeof value === 'bigint' ? Number(value) : value;
}

/**
 * Normaliza los parametros: aceptamos objetos con claves sin prefijo
 * (`{ id: 3 }`) y arrays posicionales (`[3]`) en los dos drivers.
 */
function normalizeParams(params) {
  if (params.length === 0) return [];
  if (params.length === 1 && params[0] !== null && typeof params[0] === 'object'
      && !Array.isArray(params[0])) {
    const plain = {};
    for (const [key, value] of Object.entries(params[0])) {
      plain[key] = value === undefined ? null : value;
    }
    return [plain];
  }
  return params.map((value) => (value === undefined ? null : value));
}

class Statement {
  constructor(raw, driver) {
    this.raw = raw;
    this.driver = driver;
    if (driver === 'node:sqlite' && typeof raw.setAllowBareNamedParameters === 'function') {
      raw.setAllowBareNamedParameters(true);
    }
  }

  get(...params) {
    const result = this.raw.get(...normalizeParams(params));
    return result === undefined ? undefined : result;
  }

  all(...params) {
    return this.raw.all(...normalizeParams(params)) ?? [];
  }

  run(...params) {
    const info = this.raw.run(...normalizeParams(params));
    return {
      changes: toNumber(info.changes ?? 0),
      lastInsertRowid: toNumber(info.lastInsertRowid ?? 0),
    };
  }
}

class Database {
  constructor(file) {
    this.file = file;
    this.txDepth = 0;
    this.cache = new Map();

    if (driverName === 'better-sqlite3') {
      this.raw = new BetterSqlite3(file);
    } else {
      this.raw = new NodeSqlite(file);
    }

    // Ajustes recomendados: claves ajenas activas, WAL (mejor concurrencia)
    // y espera de 5 s si la base esta ocupada.
    this.exec('PRAGMA foreign_keys = ON;');
    this.exec('PRAGMA journal_mode = WAL;');
    this.exec('PRAGMA busy_timeout = 5000;');
  }

  exec(sql) {
    this.raw.exec(sql);
  }

  /** Sentencias preparadas con cache: mismas consultas, sin recompilar. */
  prepare(sql) {
    let statement = this.cache.get(sql);
    if (!statement) {
      statement = new Statement(this.raw.prepare(sql), driverName);
      this.cache.set(sql, statement);
    }
    return statement;
  }

  /**
   * Ejecuta `fn` dentro de una transaccion. Si `fn` lanza un error, se
   * deshacen TODOS los cambios. Soporta anidamiento con SAVEPOINT, asi que un
   * servicio puede llamar a otro sin romper la transaccion exterior.
   */
  transaction(fn) {
    const db = this;
    return function runInTransaction(...args) {
      const depth = db.txDepth;
      const savepoint = 'habla_sp_' + depth;
      db.exec(depth === 0 ? 'BEGIN IMMEDIATE;' : 'SAVEPOINT ' + savepoint + ';');
      db.txDepth = depth + 1;
      try {
        const result = fn.apply(this, args);
        db.exec(depth === 0 ? 'COMMIT;' : 'RELEASE ' + savepoint + ';');
        db.txDepth = depth;
        return result;
      } catch (error) {
        try {
          db.exec(depth === 0 ? 'ROLLBACK;' : 'ROLLBACK TO ' + savepoint + ';');
        } catch { /* la transaccion ya estaba deshecha */ }
        db.txDepth = depth;
        throw error;
      }
    };
  }

  close() {
    try {
      this.raw.close();
    } catch { /* ya estaba cerrada */ }
  }
}

// --- Singleton --------------------------------------------------------------
let instance = null;
let instanceFile = null;

function resolveDatabaseFile() {
  const configured = process.env.DATABASE_FILE || 'data/habla.db';
  return path.isAbsolute(configured)
    ? configured
    : path.join(PROJECT_ROOT, configured);
}

/**
 * Abre (o reutiliza) la conexion. Crea la carpeta `data/` si hace falta.
 */
export function getDb() {
  const file = resolveDatabaseFile();
  if (instance && instanceFile === file) return instance;
  if (instance) instance.close();

  fs.mkdirSync(path.dirname(file), { recursive: true });
  instance = new Database(file);
  instanceFile = file;
  return instance;
}

export function closeDb() {
  if (instance) {
    instance.close();
    instance = null;
    instanceFile = null;
  }
}

/**
 * Columnas anadidas despues de la primera version del esquema.
 * `CREATE TABLE IF NOT EXISTS` no toca una tabla que ya existe, asi que una
 * base de datos creada con una version anterior necesita estos ALTER TABLE.
 * Se aplican solo si la columna falta, asi que es repetible y no borra nada.
 */
const COLUMN_PATCHES = [
  ['tracks', 'active', 'INTEGER NOT NULL DEFAULT 1'],
  ['users',      'active_track',   "TEXT NOT NULL DEFAULT 'sql'"],
  ['units',      'track',          "TEXT NOT NULL DEFAULT 'spanish'"],
  ['units',      'track_position', 'INTEGER NOT NULL DEFAULT 1'],
  ['lessons',    'track',          "TEXT NOT NULL DEFAULT 'spanish'"],
  ['lessons',    'track_order',    'INTEGER NOT NULL DEFAULT 1'],
];

function tableExists(db, table) {
  return Boolean(
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table)
  );
}

function columnNames(db, table) {
  return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name));
}

/** Crea las tablas y columnas que falten. Es seguro llamarlo muchas veces. */
export function migrate(db = getDb()) {
  const sql = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(sql);

  for (const [table, column, ddl] of COLUMN_PATCHES) {
    if (!tableExists(db, table)) continue;
    if (columnNames(db, table).has(column)) continue;
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl};`);
    console.log(`[habla] Columna anadida: ${table}.${column}`);
  }

  // Indices que dependen de esas columnas (por eso van despues).
  db.exec('CREATE INDEX IF NOT EXISTS idx_units_track ON units(track, track_position);');
  // El desbloqueo mira la leccion anterior DENTRO DEL MISMO track, asi que el
  // par (track, track_order) tiene que ser unico.
  db.exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_lessons_track_order ON lessons(track, track_order);'
  );
  return db;
}

// --- Utilidades pequenas ----------------------------------------------------
export const nowIso = () => new Date().toISOString();
export const toBool = (value) => value === 1 || value === true;
export const fromBool = (value) => (value ? 1 : 0);

export function readJson(text, fallback) {
  if (text === null || text === undefined) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

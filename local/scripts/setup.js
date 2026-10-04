// ---------------------------------------------------------------------------
// npm run setup
//
// Prepara el proyecto de forma SEGURA y REPETIBLE:
//   1. Crea la carpeta data/ si no existe.
//   2. Copia .env.example a .env SOLO si .env no existe (nunca lo sobrescribe).
//   3. Crea las tablas que falten (el esquema usa IF NOT EXISTS).
//   4. Carga/actualiza el contenido del curso sin duplicar ni borrar progreso.
//
// Con --reset borra el archivo de base de datos y empieza de cero.
// Es destructivo, asi que pide confirmacion explicita con --yes.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';

import { config, PROJECT_ROOT } from '../server/config.js';
import { closeDb, getDb, getDriverName, migrate } from '../db/index.js';
import { seed } from '../db/seed.js';

const args = new Set(process.argv.slice(2));
const wantsReset = args.has('--reset');
const confirmed = args.has('--yes') || args.has('-y');

function step(message) {
  console.log(`  ${message}`);
}

console.log('\n  Habla - preparacion del proyecto');
console.log('  --------------------------------');

// 1) Carpeta de datos
const databaseFile = path.isAbsolute(config.databaseFile)
  ? config.databaseFile
  : path.join(PROJECT_ROOT, config.databaseFile);
const dataDir = path.dirname(databaseFile);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  step(`Carpeta creada: ${path.relative(PROJECT_ROOT, dataDir)}`);
} else {
  step(`Carpeta de datos lista: ${path.relative(PROJECT_ROOT, dataDir)}`);
}

// 2) Archivo .env (sin sobrescribir)
const envFile = path.join(PROJECT_ROOT, '.env');
const envExample = path.join(PROJECT_ROOT, '.env.example');
if (fs.existsSync(envFile)) {
  step('.env ya existe, no lo toco.');
} else if (fs.existsSync(envExample)) {
  fs.copyFileSync(envExample, envFile);
  step('.env creado a partir de .env.example');
} else {
  step('No hay .env.example; sigo con los valores por defecto.');
}

// 3) Reset opcional
if (wantsReset) {
  if (!confirmed) {
    console.error(
      '\n  --reset borra TODO el progreso guardado.\n' +
      '  Si estas seguro, ejecuta:  npm run db:reset -- --yes\n'
    );
    process.exit(1);
  }
  closeDb();
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    const file = databaseFile + suffix;
    if (fs.existsSync(file)) {
      fs.rmSync(file);
      step(`Borrado: ${path.relative(PROJECT_ROOT, file)}`);
    }
  }
}

// 4) Esquema + contenido
const db = getDb();
migrate(db);
step(`Esquema aplicado (driver: ${getDriverName()})`);

const counts = seed();
step(
  `Contenido cargado: ${counts.units} unidades, ${counts.lessons} lecciones, ` +
  `${counts.exercises} ejercicios, ${counts.vocabulary} palabras.`
);

const users = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
step(`Usuarios existentes conservados: ${users}`);

closeDb();

console.log('\n  Listo. Ahora arranca el servidor con:');
console.log('      npm run dev');
console.log(`  y abre  http://localhost:${config.port}\n`);

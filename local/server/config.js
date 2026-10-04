// ---------------------------------------------------------------------------
// Configuracion del servidor.
// Lee el archivo .env (si existe) y aplica valores por defecto sensatos.
// No hace falta ninguna clave de API ni servicio externo.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(__dirname, '..');
export const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');

// Node 20.12+ trae process.loadEnvFile(). Si no existe, parseamos a mano.
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  if (typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(file);
      return;
    } catch { /* caemos al parseo manual */ }
  }
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const value = match[2].replace(/^["']|["']$/g, '');
    if (process.env[match[1]] === undefined) process.env[match[1]] = value;
  }
}

loadEnvFile(path.join(PROJECT_ROOT, '.env'));

const asBool = (value, fallback) =>
  value === undefined ? fallback : /^(1|true|yes|on)$/i.test(String(value));

const asInt = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: asInt(process.env.PORT, 3000),
  databaseFile: process.env.DATABASE_FILE || 'data/habla.db',
  cookieSecure: asBool(process.env.COOKIE_SECURE, false),
  sessionDays: asInt(process.env.SESSION_DAYS, 30),
  trustedOrigins: (process.env.TRUSTED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  // Nombres de las cookies
  sessionCookie: 'habla_session',
  csrfCookie: 'habla_csrf',
  csrfHeader: 'x-habla-csrf',

  // Limites de entrada
  maxBodyBytes: 32 * 1024,       // 32 KB: de sobra para una respuesta
  maxTextAnswer: 8000,           // permite programas completos y borradores

  // Limitacion de intentos de acceso (por IP)
  authRateLimit: { windowMs: 15 * 60 * 1000, max: 20 },

  // Reglas del juego (el servidor manda)
  rules: {
    exercisesPerLesson: 8,
    passThreshold: 6,
    lessonXp: 10,
    practiceSize: 8,
    streakAchievementDays: 3,
    lessonsAchievementCount: 5,
  },
};

export const isProduction = config.env === 'production';
export const isTest = config.env === 'test';

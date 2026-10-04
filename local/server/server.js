// ---------------------------------------------------------------------------
// Arranque del servidor.
//   npm run dev    -> con recarga automatica (node --watch)
//   npm start      -> normal
// ---------------------------------------------------------------------------

import { config } from './config.js';
import { createApp } from './app.js';
import { closeDb, getDb, migrate, getDriverName } from '../db/index.js';
import { cleanupExpiredSessions } from './services/auth.service.js';
import { seed } from '../db/seed.js';
import { CONTENT_VERSION } from '../db/content/index.js';

function ensureDatabaseReady() {
  const db = getDb();
  migrate(db);                       // crea las tablas si no existen
  if (db.prepare("SELECT value FROM meta WHERE key='content_version'").get()?.value !== CONTENT_VERSION) {
    seed({ verbose: true });
  }
  const lessons = db.prepare('SELECT COUNT(*) AS n FROM lessons').get().n;
  if (lessons === 0) {
    console.warn(
      '\n[habla] La base de datos no tiene contenido todavia.\n' +
      '        Ejecuta:  npm run setup\n'
    );
  }
  const removed = cleanupExpiredSessions();
  if (removed > 0) console.log(`[habla] Sesiones caducadas eliminadas: ${removed}`);
  return { lessons };
}

const { lessons } = ensureDatabaseReady();
const app = createApp();

const server = app.listen(config.port, '127.0.0.1', () => {
  const url = `http://localhost:${config.port}`;
  console.log('');
  console.log('  Habla - aprende Python y SQL');
  console.log('  ---------------------');
  console.log(`  Abre en el navegador:  ${url}`);
  console.log(`  API:                   ${url}/api/v1/health`);
  console.log(`  Base de datos:         ${config.databaseFile} (driver: ${getDriverName()})`);
  console.log(`  Lecciones cargadas:    ${lessons}`);
  console.log(`  Entorno:               ${config.env}`);
  console.log('');
  console.log('  Para detenerlo: Ctrl + C en esta terminal.');
  console.log('');
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `\n[habla] El puerto ${config.port} ya esta ocupado.\n` +
      '        Cierra el otro servidor, o arranca en otro puerto:\n' +
      '          PowerShell:  $env:PORT=3001; npm run dev\n'
    );
    process.exit(1);
  }
  throw error;
});

function shutdown(signal) {
  console.log(`\n[habla] ${signal} recibido, cerrando...`);
  server.close(() => {
    closeDb();
    process.exit(0);
  });
  // Si algo se queda colgado, salimos de todas formas.
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

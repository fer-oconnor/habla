// ---------------------------------------------------------------------------
// Aplicacion Express.
//
// UN SOLO servidor sirve dos cosas en el mismo origen y el mismo puerto:
//   * la carpeta public/ (HTML, CSS, JS del frontend)
//   * la API REST bajo /api/v1
// Por eso el frontend puede llamar a fetch('/api/v1/...') sin CORS y las
// cookies de sesion viajan solas.
//
// La base de datos (data/), el codigo del servidor (server/), el esquema y las
// soluciones (db/) quedan FUERA de public/, asi que no son descargables.
// ---------------------------------------------------------------------------

import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';

import { config, PUBLIC_DIR, isTest } from './config.js';
import apiRoutes from './routes/index.js';
import { apiNotFound, errorHandler } from './middleware/errors.js';
import { originGuard, securityHeaders } from './middleware/security.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // Necesario para que req.protocol/req.secure sean correctos detras de un
  // proxy HTTPS (y para que la cookie Secure funcione en ese caso).
  app.set('trust proxy', 1);

  app.use(securityHeaders);
  app.use(cookieParser());
  app.use(express.json({ limit: config.maxBodyBytes }));
  app.use(originGuard);

  if (!isTest) {
    app.use((req, res, next) => {
      const started = Date.now();
      res.on('finish', () => {
        if (req.originalUrl.startsWith('/api/')) {
          console.log(
            `[habla] ${req.method} ${req.originalUrl} -> ${res.statusCode} ` +
            `(${Date.now() - started} ms)`
          );
        }
      });
      next();
    });
  }

  // --- API ---
  app.use('/api/v1', apiRoutes);
  app.use('/api', apiNotFound);

  // --- Frontend ---
  app.use(
    express.static(PUBLIC_DIR, {
      index: 'index.html',
      extensions: ['html'],
      maxAge: isTest ? 0 : '1h',
      setHeaders(res, filePath) {
        // index.html nunca se cachea: asi los cambios se ven al recargar.
        if (['.html','.js','.css'].includes(path.extname(filePath))) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    })
  );

  // La app es de una sola pagina: cualquier otra ruta devuelve index.html y el
  // router del frontend decide que pantalla mostrar.
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });

  app.use(errorHandler);
  return app;
}

export default createApp;

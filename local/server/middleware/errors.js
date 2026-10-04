// ---------------------------------------------------------------------------
// Manejo de errores. Todas las rutas de /api/v1 responden con la misma forma:
//   { "error": { "code": "...", "message": "...", "details": {...} } }
// ---------------------------------------------------------------------------

import { HttpError } from '../lib/http-error.js';
import { isProduction } from '../config.js';

export function apiNotFound(req, res) {
  res.status(404).json({
    error: {
      code: 'not_found',
      message: `No API route matches ${req.method} ${req.originalUrl}.`,
    },
  });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.status).json(error.toJSON());
    return;
  }

  // JSON mal formado o cuerpo demasiado grande (los lanza express.json()).
  if (error?.type === 'entity.too.large') {
    res.status(413).json({
      error: { code: 'payload_too_large', message: 'That request is too large.' },
    });
    return;
  }
  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({
      error: { code: 'invalid_json', message: 'The request body is not valid JSON.' },
    });
    return;
  }

  // Restricciones de SQLite: normalmente significan un conflicto de datos.
  const sqliteCode = error?.code ?? '';
  if (typeof sqliteCode === 'string' && sqliteCode.startsWith('SQLITE_CONSTRAINT')) {
    res.status(409).json({
      error: {
        code: 'conflict',
        message: 'That action conflicts with data we already saved.',
      },
    });
    return;
  }

  console.error('[habla] Error no controlado:', error);
  res.status(500).json({
    error: {
      code: 'server_error',
      message: 'Something went wrong on our side. Please try again.',
      ...(isProduction ? {} : { details: { stack: String(error?.stack ?? error) } }),
    },
  });
}

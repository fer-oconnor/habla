// ---------------------------------------------------------------------------
// Limitacion de intentos, en memoria.
//
// Suficiente para un solo servidor local: cuenta las peticiones por IP en una
// ventana de tiempo. Si se despliega en varias instancias haria falta un
// almacen compartido (Redis o la propia base de datos).
// ---------------------------------------------------------------------------

import { tooManyRequests } from '../lib/http-error.js';

export function createRateLimiter({ windowMs, max, key }) {
  const hits = new Map();

  // Limpieza periodica para que el mapa no crezca sin fin.
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [id, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(id);
    }
  }, windowMs);
  timer.unref?.();

  return function rateLimit(req, res, next) {
    const id = key ? key(req) : req.ip || 'unknown';
    const now = Date.now();
    let entry = hits.get(id);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(id, entry);
    }
    entry.count += 1;

    const remaining = Math.max(0, max - entry.count);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      const seconds = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(seconds));
      next(
        tooManyRequests(
          `Too many attempts. Please wait ${seconds} second(s) and try again.`
        )
      );
      return;
    }
    next();
  };
}

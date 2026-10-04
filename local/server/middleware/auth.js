// ---------------------------------------------------------------------------
// Sesion del usuario a partir de la cookie.
//
// La cookie de sesion es HttpOnly (JavaScript no puede leerla, lo que protege
// el token frente a XSS). La cookie de CSRF si es legible: el frontend la lee y
// la reenvia en la cabecera X-Habla-CSRF (patron "double submit").
// ---------------------------------------------------------------------------

import { config } from '../config.js';
import { unauthorized } from '../lib/http-error.js';
import { resolveSession } from '../services/auth.service.js';

function cookieOptions({ httpOnly }) {
  return {
    httpOnly,
    sameSite: 'lax',
    secure: config.cookieSecure,
    path: '/',
    maxAge: config.sessionDays * 24 * 60 * 60 * 1000,
  };
}

export function setSessionCookies(res, session) {
  res.cookie(config.sessionCookie, session.id, cookieOptions({ httpOnly: true }));
  res.cookie(config.csrfCookie, session.csrfToken, cookieOptions({ httpOnly: false }));
}

export function clearSessionCookies(res) {
  const base = { path: '/', sameSite: 'lax', secure: config.cookieSecure };
  res.clearCookie(config.sessionCookie, { ...base, httpOnly: true });
  res.clearCookie(config.csrfCookie, { ...base, httpOnly: false });
}

/** Deja req.auth = { user, session } o null. No bloquea nada. */
export function attachSession(req, res, next) {
  const token = req.cookies?.[config.sessionCookie];
  req.auth = null;
  if (token) {
    const resolved = resolveSession(token);
    if (resolved) {
      req.auth = resolved;
      if (resolved.session.refresh) setSessionCookies(res,resolved.session);
    } else {
      // Sesion caducada o desconocida: limpiamos las cookies para que el
      // frontend sepa que tiene que volver a entrar.
      clearSessionCookies(res);
    }
  }
  next();
}

/** Bloquea con 401 si no hay sesion valida. */
export function requireAuth(req, res, next) {
  if (!req.auth) {
    next(unauthorized('Your session has expired. Please sign in again.'));
    return;
  }
  req.user = req.auth.user;
  next();
}

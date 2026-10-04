// ---------------------------------------------------------------------------
// Proteccion frente a peticiones de modificacion desde otros origenes (CSRF)
// y cabeceras de seguridad basicas.
//
// Dos barreras independientes:
//  1. originGuard: toda peticion que cambia datos (POST/PUT/PATCH/DELETE) debe
//     venir del mismo origen que sirve la app.
//  2. csrfGuard: si hay sesion, la peticion debe incluir la cabecera
//     X-Habla-CSRF con el token de esa sesion. El atacante no puede leerlo.
// ---------------------------------------------------------------------------

import { config } from '../config.js';
import { forbidden } from '../lib/http-error.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function requestOrigin(req) {
  const proto = req.protocol;
  const host = req.get('host');
  return host ? `${proto}://${host}` : null;
}

export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'microphone=(), camera=(), geolocation=()');
  // Politica de contenido: solo recursos propios. 'unsafe-inline' no aparece,
  // asi que todo el CSS y JS debe estar en archivos, no en atributos.
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "img-src 'self' data:",
      "style-src 'self'",
      "script-src 'self'",
      "connect-src 'self'",
      "form-action 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
    ].join('; ')
  );
  next();
}

export function originGuard(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const allowed = new Set(config.trustedOrigins);
  const own = requestOrigin(req);
  if (own) allowed.add(own);

  const origin = req.get('origin');
  if (origin) {
    if (!allowed.has(origin)) {
      next(forbidden('This request came from an origin we do not trust.'));
      return;
    }
    next();
    return;
  }

  // Sin cabecera Origin: aceptamos si el navegador declara que es same-origin,
  // o si el Referer apunta a nuestro propio origen. Las herramientas de linea
  // de comandos (curl) no envian ninguna de las dos y tambien pasan: no hay
  // navegador de por medio, asi que no hay riesgo de CSRF.
  const fetchSite = req.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    next(forbidden('Cross-site requests are not allowed for this action.'));
    return;
  }

  const referer = req.get('referer');
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (!allowed.has(refererOrigin)) {
        next(forbidden('This request came from a page we do not trust.'));
        return;
      }
    } catch {
      next(forbidden('That request has an invalid Referer header.'));
      return;
    }
  }

  next();
}

export function csrfGuard(req, res, next) {
  if (SAFE_METHODS.has(req.method) || !req.auth) {
    next();
    return;
  }
  const sent = req.get(config.csrfHeader);
  if (!sent || sent !== req.auth.session.csrfToken) {
    next(
      forbidden(
        'Missing or invalid security token. Reload the page and try again.'
      )
    );
    return;
  }
  next();
}

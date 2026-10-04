// ---------------------------------------------------------------------------
// /api/v1/auth
//
// POST /auth/register  { email, password, displayName, timezone?, dailyGoal? }
//   201 -> { user, csrfToken }
//   409 -> email ya registrado
//
// POST /auth/login     { email, password }
//   200 -> { user, csrfToken }
//   401 -> credenciales incorrectas
//
// POST /auth/guest     { displayName?, timezone? }
//   201 -> { user, csrfToken }   (crea un usuario invitado nuevo y su sesion)
//
// POST /auth/logout    (sin cuerpo)
//   200 -> { ok: true }
//
// Las tres primeras devuelven cookies:
//   habla_session (HttpOnly) y habla_csrf (legible por el frontend).
// ---------------------------------------------------------------------------

import { Router } from 'express';

import { config } from '../config.js';
import { getDb } from '../../db/index.js';
import { clearSessionCookies, setSessionCookies } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rate-limit.js';
import {
  authenticate,
  createAccount,
  createGuest,
  createSession,
  destroySession,
  rememberUser,
  recoverGuest,
} from '../services/auth.service.js';
import {
  normalizeTimeZone,
  requireDisplayName,
  requireEmail,
  requireInt,
  requireObject,
  requirePassword,
  requireString,
} from '../lib/validate.js';

const router = Router();

// Limita los intentos de acceso por IP (registro, login e invitado).
const authLimiter = createRateLimiter({
  windowMs: config.authRateLimit.windowMs,
  max: config.authRateLimit.max,
});

function sessionResponse(res, user, status = 200) {
  const session = createSession(user.id);
  setSessionCookies(res, session);
  res.status(status).json({ user, csrfToken: session.csrfToken });
}

router.post('/register', authLimiter, (req, res) => {
  const body = requireObject(req.body);
  const email = requireEmail(body.email);
  const password = requirePassword(body.password);
  const displayName = requireDisplayName(body.displayName ?? email.split('@')[0]);
  const timezone = normalizeTimeZone(body.timezone) ?? 'UTC';
  const dailyGoal = body.dailyGoal === undefined
    ? 1
    : requireInt(body.dailyGoal, 'dailyGoal', { min: 1, max: 3 });

  const user = createAccount({ email, password, displayName, timezone, dailyGoal, guestId:req.auth?.user?.isGuest ? req.auth.user.id : null });
  sessionResponse(res, user, 201);
});

router.post('/login', authLimiter, (req, res) => {
  const body = requireObject(req.body);
  const email = requireEmail(body.email);
  const password = requirePassword(body.password);
  const user = authenticate({ email, password });
  sessionResponse(res, user, 200);
});

router.post('/guest', authLimiter, (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const displayName = body.displayName
    ? requireDisplayName(body.displayName)
    : 'Guest';
  const timezone = normalizeTimeZone(body.timezone) ?? 'UTC';
  const user = createGuest({ displayName, timezone });
  sessionResponse(res, user, 201);
});

router.post('/logout', (req, res) => {
  if (req.auth?.user?.isGuest) getDb().prepare('DELETE FROM recovery_keys WHERE user_id=?').run(req.auth.user.id);
  const token = req.cookies?.[config.sessionCookie];
  destroySession(token);
  clearSessionCookies(res);
  res.json({ ok: true });
});

router.post('/remember', (req,res) => {
  if (!req.auth?.user?.isGuest) {
    res.json({ recoveryToken:null });
    return;
  }
  res.json({ recoveryToken:rememberUser(req.auth.user.id) });
});

router.post('/recover', authLimiter, (req,res) => {
  const token = requireString(req.body?.token,'token',{min:64,max:64});
  sessionResponse(res,recoverGuest(token));
});

export default router;

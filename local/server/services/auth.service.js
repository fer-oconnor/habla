// ---------------------------------------------------------------------------
// Usuarios y sesiones.
//
// CONTRASENAS: usamos scrypt, la funcion de derivacion de claves incluida en
// `node:crypto` (biblioteca estandar de Node, mantenida por el propio proyecto).
// scrypt es "memory-hard": obliga a gastar memoria por intento, lo que encarece
// mucho los ataques por fuerza bruta. Se guarda asi:
//     scrypt$N$r$p$saltHex$hashHex
// El formato incluye los parametros, asi que se pueden subir en el futuro sin
// invalidar las contrasenas antiguas.
//
// SESIONES: viven en la tabla `sessions` de SQLite (no en memoria), asi que
// reiniciar el servidor NO cierra la sesion del usuario.
// ---------------------------------------------------------------------------

import crypto from 'node:crypto';
import { getDb, nowIso } from '../../db/index.js';
import { config } from '../config.js';
import { conflict, unauthorized } from '../lib/http-error.js';

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password.normalize('NFKC'), salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
  });
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('hex'), hash.toString('hex')]
    .join('$');
}

export function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltHex, hashHex] = parts;
  try {
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(password.normalize('NFKC'), Buffer.from(saltHex, 'hex'),
      expected.length, { N: Number(n), r: Number(r), p: Number(p) });
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

// --- Creacion de usuarios ---------------------------------------------------

function insertUser(db, fields) {
  const now = nowIso();
  const info = db
    .prepare(
      `INSERT INTO users (email, password_hash, display_name, is_guest, daily_goal,
                          timezone, sound_enabled, onboarding_done, created_at, updated_at, active_track)
       VALUES (@email, @password_hash, @display_name, @is_guest, @daily_goal,
               @timezone, @sound_enabled, @onboarding_done, @created_at, @updated_at, 'sql')`
    )
    .run({
      email: fields.email ?? null,
      password_hash: fields.passwordHash ?? null,
      display_name: fields.displayName,
      is_guest: fields.isGuest ? 1 : 0,
      daily_goal: fields.dailyGoal ?? 1,
      timezone: fields.timezone ?? 'UTC',
      sound_enabled: 1,
      onboarding_done: fields.onboardingDone ? 1 : 0,
      created_at: now,
      updated_at: now,
    });

  db.prepare(
    `INSERT INTO user_progress (user_id, xp, lessons_passed, current_streak,
                                longest_streak, last_active_day, updated_at)
     VALUES (?, 0, 0, 0, 0, NULL, ?)`
  ).run(info.lastInsertRowid, now);

  return getUserById(info.lastInsertRowid, db);
}

export function createAccount({ email, password, displayName, timezone, dailyGoal, guestId = null }) {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    throw conflict('There is already an account with that email address.', { field: 'email' });
  }
  if (guestId) {
    const guest = db.prepare('SELECT is_guest,daily_goal FROM users WHERE id=?').get(guestId);
    if (guest?.is_guest === 1) {
      db.prepare(`UPDATE users SET email=?,password_hash=?,display_name=?,is_guest=0,
        timezone=?,daily_goal=?,updated_at=? WHERE id=?`).run(email,hashPassword(password),
        displayName,timezone,dailyGoal ?? guest.daily_goal,nowIso(),guestId);
      return getUserById(guestId);
    }
  }
  const create = db.transaction(() =>
    insertUser(db, {
      email,
      passwordHash: hashPassword(password),
      displayName,
      isGuest: false,
      timezone,
      dailyGoal,
      onboardingDone: Boolean(dailyGoal),
    })
  );
  return create();
}

export function createGuest({ displayName = 'Guest', timezone = 'UTC' } = {}) {
  const db = getDb();
  const create = db.transaction(() =>
    insertUser(db, { displayName, isGuest: true, timezone, dailyGoal: 1 })
  );
  return create();
}

export function authenticate({ email, password }) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  // Mensaje identico si el email no existe o si la contrasena falla: asi no
  // revelamos que direcciones estan registradas.
  const fail = () => {
    throw unauthorized('Email or password is not correct.');
  };
  if (!row) {
    // Gastamos tiempo parecido al de una verificacion real.
    verifyPassword(password, hashPassword('placeholder-for-timing'));
    fail();
  }
  if (!verifyPassword(password, row.password_hash)) fail();
  return mapUser(row);
}

// --- Consultas --------------------------------------------------------------

export function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    isGuest: row.is_guest === 1,
    dailyGoal: row.daily_goal,
    timezone: row.timezone,
    soundEnabled: row.sound_enabled === 1,
    onboardingDone: row.onboarding_done === 1,
    activeTrack: row.active_track ?? 'sql',
    createdAt: row.created_at,
  };
}

export function getUserById(id, db = getDb()) {
  return mapUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
}

export function updateUser(userId, changes) {
  const db = getDb();
  const sets = [];
  const params = { id: userId, updated_at: nowIso() };

  if (changes.displayName !== undefined) {
    sets.push('display_name = @display_name');
    params.display_name = changes.displayName;
  }
  if (changes.dailyGoal !== undefined) {
    sets.push('daily_goal = @daily_goal');
    params.daily_goal = changes.dailyGoal;
  }
  if (changes.timezone !== undefined) {
    sets.push('timezone = @timezone');
    params.timezone = changes.timezone;
  }
  if (changes.soundEnabled !== undefined) {
    sets.push('sound_enabled = @sound_enabled');
    params.sound_enabled = changes.soundEnabled ? 1 : 0;
  }
  if (changes.onboardingDone !== undefined) {
    sets.push('onboarding_done = @onboarding_done');
    params.onboarding_done = changes.onboardingDone ? 1 : 0;
  }
  if (changes.activeTrack !== undefined) {
    sets.push('active_track = @active_track');
    params.active_track = changes.activeTrack;
  }

  if (sets.length > 0) {
    sets.push('updated_at = @updated_at');
    db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = @id`).run(params);
  }
  return getUserById(userId, db);
}

// --- Sesiones ---------------------------------------------------------------

export function createSession(userId) {
  const db = getDb();
  const now = new Date();
  const expires = new Date(now.getTime() + config.sessionDays * 24 * 60 * 60 * 1000);
  const session = {
    id: randomToken(32),
    csrfToken: randomToken(24),
    expiresAt: expires.toISOString(),
  };
  db.prepare(
    `INSERT INTO sessions (id, user_id, csrf_token, created_at, last_seen_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(session.id, userId, session.csrfToken, now.toISOString(), now.toISOString(),
    session.expiresAt);
  return session;
}

/** Devuelve { session, user } si el token es valido y no ha caducado. */
export function resolveSession(token) {
  if (typeof token !== 'string' || token.length < 16) return null;
  const db = getDb();
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(token);
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(token);
    return null;
  }
  const user = getUserById(row.user_id, db);
  if (!user) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(token);
    return null;
  }
  const refresh = Date.now() - new Date(row.last_seen_at).getTime() > 24*60*60*1000;
  const expiresAt = refresh
    ? new Date(Date.now()+config.sessionDays*24*60*60*1000).toISOString()
    : row.expires_at;
  db.prepare('UPDATE sessions SET last_seen_at = ?,expires_at=? WHERE id = ?').run(nowIso(),expiresAt,token);
  return {
    session: { id: row.id, csrfToken: row.csrf_token, expiresAt, refresh },
    user,
  };
}

export function destroySession(token) {
  if (!token) return;
  getDb().prepare('DELETE FROM sessions WHERE id = ?').run(token);
}

export function cleanupExpiredSessions() {
  return getDb().prepare('DELETE FROM sessions WHERE expires_at <= ?').run(nowIso()).changes;
}

export function rememberUser(userId) {
  const token = randomToken(32);
  const digest = crypto.createHash('sha256').update(token).digest('hex');
  getDb().prepare('INSERT INTO recovery_keys(token_hash,user_id,created_at) VALUES(?,?,?)').run(digest,userId,nowIso());
  return token;
}

export function recoverGuest(token) {
  const digest = crypto.createHash('sha256').update(token).digest('hex');
  const row = getDb().prepare('SELECT user_id FROM recovery_keys WHERE token_hash=?').get(digest);
  const user = row ? getUserById(row.user_id) : null;
  if (!user || !user.isGuest) throw unauthorized('No se puede recuperar ese perfil. Inicia sesión con tu cuenta.');
  return user;
}

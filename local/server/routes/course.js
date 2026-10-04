// ---------------------------------------------------------------------------
// /api/v1/units  y  /api/v1/lessons/:id   (requieren sesion)
//
// GET /units
//   200 -> { units: [ { id, slug, title, subtitle, color, lessons: [
//              { id, slug, title, status: "locked"|"available"|"completed",
//                bestCorrect, attempts, xpEarned, exerciseCount } ] } ],
//            totals: { lessons, completed }, nextLesson: {...}|null }
//
// GET /lessons/:id      (:id puede ser el numero o el slug)
//   200 -> { lesson: { id, slug, title, unit, intro: { title, body, points },
//            exerciseCount, xpReward, passThreshold, status } }
//   403 -> la leccion esta bloqueada para este usuario
//   404 -> no existe
//
// Importante: el bloqueo se comprueba AQUI, en el servidor. Llamar a la API
// directamente con el id de una leccion bloqueada devuelve 403.
// ---------------------------------------------------------------------------

import { Router } from 'express';

import { getDb } from '../../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { badRequest, forbidden, notFound } from '../lib/http-error.js';
import {
  getCourseForUser,
  getLessonWithIntro,
  isLessonAccessible,
  listTracks,
  trackExists,
} from '../services/progress.service.js';

const router = Router();

/**
 * GET /tracks -> { tracks: [ { slug, title, lessons, completed, ... } ] }
 * Las dos rutas de aprendizaje de Habla: "python" y "sql".
 */
router.get('/tracks', requireAuth, (req, res) => {
  res.json({ tracks: listTracks(req.user.id), activeTrack: req.user.activeTrack });
});

// GET /units?track=python|sql   (por defecto, el track activo del perfil)
router.get('/units', requireAuth, (req, res) => {
  const track = typeof req.query.track === 'string' && req.query.track
    ? req.query.track
    : req.user.activeTrack;
  if (!trackExists(track)) {
    throw badRequest('That learning track does not exist.', { field: 'track' });
  }
  res.json(getCourseForUser(req.user.id, track));
});

router.get('/lessons/:id', requireAuth, (req, res) => {
  const db = getDb();
  const raw = String(req.params.id);
  const row = /^\d+$/.test(raw)
    ? db.prepare('SELECT id FROM lessons WHERE id = ?').get(Number(raw))
    : db.prepare('SELECT id FROM lessons WHERE slug = ?').get(raw);

  if (!row) throw notFound('That lesson does not exist.');

  const access = isLessonAccessible(req.user.id, row.id);
  if (!access.ok) {
    throw forbidden('Finish the previous lesson to unlock this one.');
  }

  const lesson = getLessonWithIntro(row.id);
  const progress = db
    .prepare('SELECT * FROM lesson_progress WHERE user_id = ? AND lesson_id = ?')
    .get(req.user.id, row.id);

  res.json({
    lesson: {
      ...lesson,
      status: progress?.status === 'completed' ? 'completed' : 'available',
      bestCorrect: progress?.best_correct ?? 0,
      attempts: progress?.attempts_count ?? 0,
      xpEarned: progress?.xp_earned ?? 0,
    },
  });
});

export default router;

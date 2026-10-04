// ---------------------------------------------------------------------------
// /api/v1/me   (requiere sesion)
//
// GET /me
//   200 -> { user: {...}, csrfToken: "..." }
//   401 -> sesion caducada o inexistente
//
// PATCH /me    { displayName?, dailyGoal?, timezone?, soundEnabled?, onboardingDone? }
//   200 -> { user: {...} }
//   400 -> algun campo no valido
// ---------------------------------------------------------------------------

import { Router } from 'express';

import { updateUser } from '../services/auth.service.js';
import {
  requireBool,
  requireDisplayName,
  requireInt,
  requireObject,
  requireString,
  requireTimeZone,
} from '../lib/validate.js';
import { badRequest } from '../lib/http-error.js';
import { trackExists } from '../services/progress.service.js';

const router = Router();

router.get('/', (req, res) => {
  res.json({ user: req.user, csrfToken: req.auth.session.csrfToken });
});

router.patch('/', (req, res) => {
  const body = requireObject(req.body);
  const changes = {};

  if (body.displayName !== undefined) {
    changes.displayName = requireDisplayName(body.displayName);
  }
  if (body.dailyGoal !== undefined) {
    changes.dailyGoal = requireInt(body.dailyGoal, 'dailyGoal', { min: 1, max: 3 });
  }
  if (body.timezone !== undefined) {
    changes.timezone = requireTimeZone(body.timezone);
  }
  if (body.soundEnabled !== undefined) {
    changes.soundEnabled = requireBool(body.soundEnabled, 'soundEnabled');
  }
  if (body.onboardingDone !== undefined) {
    changes.onboardingDone = requireBool(body.onboardingDone, 'onboardingDone');
  }

  if (body.activeTrack !== undefined) {
    const track = requireString(body.activeTrack, 'activeTrack', { max: 40 });
    if (!trackExists(track)) {
      throw badRequest('That learning track does not exist.', { field: 'activeTrack' });
    }
    changes.activeTrack = track;
  }

  if (Object.keys(changes).length === 0) {
    throw badRequest('Send at least one field to update.', {
      allowed: ['displayName', 'dailyGoal', 'timezone', 'soundEnabled',
        'onboardingDone', 'activeTrack'],
    });
  }

  res.json({ user: updateUser(req.user.id, changes) });
});

export default router;

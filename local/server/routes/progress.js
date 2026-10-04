// ---------------------------------------------------------------------------
// /api/v1/progress   (requiere sesion)
//
// GET /progress
//   200 -> {
//     xp, lessonsPassed, lessonsTotal, currentStreak, longestStreak,
//     today:  { day, timezone, goal, lessons, xp, goalMet },
//     week:   [ { day, label, lessons, xp, goalMet } x7 ],
//     achievements: [ { code, title, description, icon, earned, earnedAt } ],
//     pendingReviews, vocabulary: { learned, total },
//     accuracy: { answered, correct, percent }
//   }
//
// Todos estos numeros salen de actividad real guardada en SQLite.
// ---------------------------------------------------------------------------

import { Router } from 'express';

import { getProgressSummary } from '../services/progress.service.js';

const router = Router();

router.get('/', (req, res) => {
  res.json(getProgressSummary(req.user));
});

export default router;

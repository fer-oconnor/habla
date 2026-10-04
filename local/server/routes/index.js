// ---------------------------------------------------------------------------
// Router principal de la API. Todo cuelga de /api/v1
// La documentacion de cada ruta esta en el README y en cada archivo.
// ---------------------------------------------------------------------------

import { Router } from 'express';

import { getDb } from '../../db/index.js';
import { getDriverName } from '../../db/index.js';
import { attachSession, requireAuth } from '../middleware/auth.js';
import { csrfGuard } from '../middleware/security.js';
import authRoutes from './auth.js';
import meRoutes from './me.js';
import courseRoutes from './course.js';
import attemptRoutes from './attempts.js';
import progressRoutes from './progress.js';
import vocabularyRoutes from './vocabulary.js';
import { contentSummary } from '../../db/content/index.js';

const router = Router();

router.use(attachSession);
router.use(csrfGuard);

/**
 * GET /api/v1/health
 * No necesita sesion. Respuesta 200:
 *   { "status": "ok", "time": "...", "database": { "driver": "...", "content": {...} } }
 */
router.get('/health', (req, res) => {
  const db = getDb();
  const counts = contentSummary();
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    database: { driver: getDriverName(), content: counts },
    signedIn: Boolean(req.auth),
  });
});

router.use('/auth', authRoutes);
router.use('/me', requireAuth, meRoutes);
router.use('/', courseRoutes);          // /units y /lessons/:id (requieren sesion)
router.use('/attempts', requireAuth, attemptRoutes);
router.use('/progress', requireAuth, progressRoutes);
router.use('/vocabulary', requireAuth, vocabularyRoutes);

export default router;

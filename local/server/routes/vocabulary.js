// ---------------------------------------------------------------------------
// /api/v1/vocabulary   (requiere sesion)
//
// GET /vocabulary?search=hola&unit=greetings
//   200 -> {
//     words: [ { id, es, en, exampleEs, exampleEn, partOfSpeech,
//                unit: { slug, title }, timesSeen, firstSeenAt, lastSeenAt } ],
//     units: [ { slug, title, position } ],   // solo unidades con palabras
//     total: 12
//   }
//
// Solo devuelve el vocabulario que el usuario YA ha encontrado en ejercicios
// respondidos. El audio se genera en el navegador con SpeechSynthesis a partir
// del campo `es` (o `exampleEs`), no hay archivos de sonido en el servidor.
// ---------------------------------------------------------------------------

import { Router } from 'express';

import { listUserVocabulary } from '../services/progress.service.js';
import { optionalString } from '../lib/validate.js';

const router = Router();

router.get('/', (req, res) => {
  const search = optionalString(req.query.search, 'search', { max: 60 }) ?? '';
  const unitSlug = optionalString(req.query.unit, 'unit', { max: 60 }) ?? '';
  const track = optionalString(req.query.track, 'track', { max: 40 }) ?? '';
  res.json(listUserVocabulary(req.user.id, { search, unitSlug, track }));
});

export default router;

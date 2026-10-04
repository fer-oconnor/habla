// ---------------------------------------------------------------------------
// /api/v1/attempts   (requieren sesion)
//
// POST /attempts
//   Cuerpo: { "lessonId": 1 }          -> intento de leccion
//        o  { "kind": "practice" }     -> sesion de repaso
//   201 -> { attempt: {...}, resumed: false, practiceSource?: "mistakes"|"review" }
//   200 -> { attempt: {...}, resumed: true }   si ya habia un intento abierto
//   403 -> la leccion esta bloqueada
//   409 -> no hay nada que repasar todavia (code: conflict, details.reason)
//
//   El objeto `attempt` incluye sus ejercicios SIN el campo `solution` y SIN la
//   explicacion de correccion. Los de tipo listen_choose si incluyen
//   `audioText`, porque SpeechSynthesis se ejecuta en el navegador y necesita
//   recibir el texto para poder leerlo en voz alta.
//
// GET /attempts/:id
//   200 -> { attempt: {...} }  con las respuestas ya enviadas, para reanudar
//   404 -> no existe O es de otro usuario (no distinguimos, a proposito)
//
// PUT /attempts/:id/answers/:exerciseId
//   Cuerpo: { "answer": ... }
//     choose_translation / listen_choose -> texto de la opcion elegida
//     fill_blank                         -> texto escrito
//     word_order                         -> array de palabras en orden
//     match_pairs                        -> objeto { "palabra": "significado" }
//   200 -> { correct, yourAnswer, correctAnswer, explanation, perPair?, progress, repeated }
//   409 -> ya habia otra respuesta distinta para este ejercicio
//
// POST /attempts/:id/complete
//   200 -> { result: { correct, total, percent, passed, xpAwarded, review: [...] },
//            alreadyCompleted, newAchievements: ["first_lesson"] }
//   400 -> faltan respuestas (details.missingExerciseIds)
// ---------------------------------------------------------------------------

import { Router } from 'express';

import { badRequest } from '../lib/http-error.js';
import * as validate from '../lib/validate.js';
import {
  completeAttempt,
  describeAttempt,
  loadAttemptOwned,
  startAttempt,
  submitAnswer,
  saveDraft,
  runExercise,
} from '../services/attempts.service.js';

const router = Router();

router.post('/', (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};

  if (body.kind === 'practice') {
    // `track` es opcional: sin el, se repasan los errores de los dos cursos.
    const track = body.track === undefined || body.track === null
      ? null
      : validate.requireString(body.track, 'track', { max: 40 });
    const started = startAttempt(req.user, { kind: 'practice', track });
    res.status(started.resumed ? 200 : 201).json(started);
    return;
  }

  if (body.lessonId === undefined) {
    throw badRequest('Send "lessonId" to start a lesson, or "kind": "practice".');
  }
  const lessonId = validate.requireInt(body.lessonId, 'lessonId', { min: 1 });
  const started = startAttempt(req.user, { lessonId, kind: 'lesson' });
  res.status(started.resumed ? 200 : 201).json(started);
});

router.get('/:id', (req, res) => {
  const attemptId = validate.requireInt(req.params.id, 'id', { min: 1 });
  const attempt = loadAttemptOwned(req.user, attemptId);
  res.json({ attempt: describeAttempt(req.user, attempt) });
});

router.put('/:id/answers/:exerciseId', async (req, res) => {
  const attemptId = validate.requireInt(req.params.id, 'id', { min: 1 });
  const exerciseId = validate.requireInt(req.params.exerciseId, 'exerciseId', { min: 1 });
  const body = validate.requireObject(req.body);
  if (body.answer === undefined) {
    throw badRequest('Send your answer in the "answer" field.');
  }
  const answer = validate.requireAnswer(body.answer);
  res.json(await submitAnswer(req.user, attemptId, exerciseId, answer));
});

router.put('/:id/drafts/:exerciseId', (req,res) => {
  const id = validate.requireInt(req.params.id,'id',{min:1});
  const exerciseId = validate.requireInt(req.params.exerciseId,'exerciseId',{min:1});
  const code = validate.requireString(req.body?.code,'code',{min:0,max:8000,trim:false});
  res.json(saveDraft(req.user,id,exerciseId,code));
});

router.post('/:id/run/:exerciseId', async (req,res) => {
  const id = validate.requireInt(req.params.id,'id',{min:1});
  const exerciseId = validate.requireInt(req.params.exerciseId,'exerciseId',{min:1});
  const code = validate.requireString(req.body?.code,'code',{max:8000,trim:false});
  res.json(await runExercise(req.user,id,exerciseId,code));
});

router.post('/:id/complete', (req, res) => {
  const attemptId = validate.requireInt(req.params.id, 'id', { min: 1 });
  res.json(completeAttempt(req.user, attemptId));
});

export default router;

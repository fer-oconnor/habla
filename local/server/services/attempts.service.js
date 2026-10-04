// ---------------------------------------------------------------------------
// Intentos de leccion y de repaso.
//
// Ideas clave:
//  * Un intento fija su lista de ejercicios al empezar (`exercise_ids`), asi
//    que recargar la pagina reanuda exactamente el mismo intento.
//  * La primera respuesta a un ejercicio queda registrada para siempre dentro
//    de ese intento (clave primaria attempt_id + exercise_id). Reenviar la
//    MISMA respuesta devuelve el resultado guardado; intentar cambiarla se
//    rechaza con 409.
//  * Finalizar dos veces devuelve el mismo resultado y no duplica premios.
// ---------------------------------------------------------------------------

import { getDb, nowIso, readJson } from '../../db/index.js';
import { conflict, badRequest, forbidden, notFound } from '../lib/http-error.js';
import { answerDigest } from '../lib/normalize.js';
import { seededShuffle } from '../lib/shuffle.js';
import { correctAnswerText, gradeAnswer } from './grading.js';
import { evaluateCode } from './code.service.js';
import {
  applyLessonPass,
  buildPracticePool,
  isLessonAccessible,
  markVocabularySeen,
  recordMiss,
  resolveMiss,
  trackExists,
} from './progress.service.js';

// --- Lectura de ejercicios --------------------------------------------------

function loadExercise(id, db = getDb()) {
  const row = db.prepare('SELECT * FROM exercises WHERE id = ?').get(id);
  if (!row) return null;
  return {
    id: row.id,
    lessonId: row.lesson_id,
    slug: row.slug,
    position: row.position,
    type: row.type,
    prompt: row.prompt,
    question: row.question,
    hint: row.hint,
    audioText: row.audio_text,
    payload: readJson(row.payload, {}),
    solution: readJson(row.solution, {}),
    explanation: row.explanation,
  };
}

/**
 * Mezcla las opciones para que la correcta no caiga siempre en la misma
 * posicion. El orden es estable (semilla = id del ejercicio), asi que recargar
 * la pagina no descoloca nada.
 */
function shufflePayload(exercise) {
  const payload = { ...exercise.payload };
  if (Array.isArray(payload.options)) {
    payload.options = seededShuffle(payload.options, `opt-${exercise.id}`);
  }
  if (Array.isArray(payload.bank)) {
    payload.bank = seededShuffle(payload.bank, `bank-${exercise.id}`);
  }
  if (Array.isArray(payload.tokens)) {
    payload.tokens = seededShuffle(payload.tokens, `tok-${exercise.id}`);
  }
  if (Array.isArray(payload.right)) {
    payload.right = seededShuffle(payload.right, `right-${exercise.id}`);
  }
  return payload;
}

/**
 * Version PUBLICA de un ejercicio: sin `solution` y sin `explanation` mientras
 * no se haya respondido.
 *
 * Nota sobre el audio: `audioText` viaja al navegador porque SpeechSynthesis
 * necesita el texto para poder leerlo en voz alta. Es una consecuencia
 * inevitable de sintetizar la voz en el cliente sin servicios externos.
 */
function publicExercise(exercise, answerRow) {
  const view = {
    id: exercise.id,
    slug: exercise.slug,
    type: exercise.type,
    prompt: exercise.prompt,
    question: exercise.question,
    hint: exercise.hint,
    payload: shufflePayload(exercise),
    answered: Boolean(answerRow),
  };
  if (exercise.type === 'listen_choose') view.audioText = exercise.audioText;

  if (answerRow) {
    const stored = readJson(answerRow.answer, null);
    view.result = {
      correct: answerRow.is_correct === 1,
      yourAnswer: stored,
      correctAnswer: correctAnswerText(exercise),
      explanation: exercise.explanation,
      answeredAt: answerRow.answered_at,
    };
    if (exercise.type === 'listen_choose' || exercise.type === 'fill_blank') {
      view.result.spoken = exercise.audioText ?? null;
    }
  }
  return view;
}

// --- Crear o reanudar un intento -------------------------------------------

export function startAttempt(user, { lessonId, kind, track = null }) {
  const db = getDb();

  if (kind === 'practice') {
    const open = db
      .prepare(
        `SELECT * FROM attempts
          WHERE user_id = ? AND kind = 'practice' AND status = 'in_progress'
          ORDER BY id DESC LIMIT 1`
      )
      .get(user.id);
    if (open && readJson(open.exercise_ids, []).every((id) => {
      const row = db.prepare('SELECT l.track FROM exercises e JOIN lessons l ON l.id=e.lesson_id WHERE e.id=?').get(id);
      return row && trackExists(row.track) && (!track || row.track === track);
    })) return { attempt: describeAttempt(user, open), resumed: true };

    const pool = buildPracticePool(user.id, { track });
    if (!pool) {
      throw conflict(
        'You have nothing to practise yet. Finish your first lesson and come back.',
        { reason: 'no_practice_content' }
      );
    }
    const created = insertAttempt(db, {
      userId: user.id,
      lessonId: null,
      kind: 'practice',
      exerciseIds: pool.exerciseIds,
    });
    return {
      attempt: describeAttempt(user, created),
      resumed: false,
      practiceSource: pool.source,
    };
  }

  // --- Intento de leccion ---
  const access = isLessonAccessible(user.id, lessonId);
  if (!access.ok) {
    if (access.reason === 'not_found') throw notFound('That lesson does not exist.');
    throw forbidden('Finish the previous lesson to unlock this one.');
  }

  const open = db
    .prepare(
      `SELECT * FROM attempts
        WHERE user_id = ? AND lesson_id = ? AND kind = 'lesson' AND status = 'in_progress'
        ORDER BY id DESC LIMIT 1`
    )
    .get(user.id, lessonId);
  if (open) return { attempt: describeAttempt(user, open), resumed: true };

  const exerciseIds = db
    .prepare('SELECT id FROM exercises WHERE lesson_id = ? ORDER BY position')
    .all(lessonId)
    .map((row) => row.id);
  if (exerciseIds.length === 0) {
    throw conflict('That lesson has no exercises yet.');
  }

  const created = insertAttempt(db, {
    userId: user.id,
    lessonId,
    kind: 'lesson',
    exerciseIds,
  });
  return { attempt: describeAttempt(user, created), resumed: false };
}

function insertAttempt(db, { userId, lessonId, kind, exerciseIds }) {
  const info = db
    .prepare(
      `INSERT INTO attempts (user_id, lesson_id, kind, status, exercise_ids,
                             total_count, correct_count, passed, xp_awarded, started_at)
       VALUES (?, ?, ?, 'in_progress', ?, ?, 0, 0, 0, ?)`
    )
    .run(userId, lessonId, kind, JSON.stringify(exerciseIds), exerciseIds.length, nowIso());
  return db.prepare('SELECT * FROM attempts WHERE id = ?').get(info.lastInsertRowid);
}

// --- Leer un intento --------------------------------------------------------

export function loadAttemptOwned(user, attemptId) {
  const db = getDb();
  const attempt = db.prepare('SELECT * FROM attempts WHERE id = ?').get(attemptId);
  if (!attempt) throw notFound('That attempt does not exist.');
  // Nunca revelamos si el intento existe pero es de otra persona.
  if (attempt.user_id !== user.id) throw notFound('That attempt does not exist.');
  return attempt;
}

export function describeAttempt(user, attempt) {
  const db = getDb();
  const exerciseIds = readJson(attempt.exercise_ids, []);
  const answers = db
    .prepare('SELECT * FROM attempt_answers WHERE attempt_id = ?')
    .all(attempt.id);
  const answerByExercise = new Map(answers.map((row) => [row.exercise_id, row]));

  const exercises = exerciseIds.map((id, index) => {
    const exercise = loadExercise(id, db);
    const view = publicExercise(exercise, answerByExercise.get(id));
    view.index = index;
    if (!view.answered) {
      const draft = db.prepare('SELECT code,updated_at FROM attempt_drafts WHERE attempt_id=? AND exercise_id=?')
        .get(attempt.id,id);
      view.draft = draft?.code ?? null;
      view.draftUpdatedAt = draft?.updated_at ?? null;
    }
    return view;
  });

  const lesson = attempt.lesson_id
    ? db.prepare('SELECT id, slug, title, pass_threshold, xp_reward FROM lessons WHERE id = ?')
        .get(attempt.lesson_id)
    : null;

  const answeredCount = answers.length;
  const firstUnanswered = exercises.findIndex((exercise) => !exercise.answered);

  const out = {
    id: attempt.id,
    kind: attempt.kind,
    status: attempt.status,
    lesson: lesson
      ? {
          id: lesson.id,
          slug: lesson.slug,
          title: lesson.title,
          passThreshold: lesson.pass_threshold,
          xpReward: lesson.xp_reward,
        }
      : null,
    total: attempt.total_count,
    answered: answeredCount,
    correctSoFar: answers.filter((row) => row.is_correct === 1).length,
    cursor: firstUnanswered === -1 ? exercises.length - 1 : firstUnanswered,
    startedAt: attempt.started_at,
    completedAt: attempt.completed_at,
    exercises,
  };

  if (attempt.status === 'completed') out.result = buildResult(attempt, out.lesson, exercises);
  return out;
}

function buildResult(attempt, lesson, exercises) {
  const correct = attempt.correct_count;
  const total = attempt.total_count;
  return {
    correct,
    total,
    percent: total === 0 ? 0 : Math.round((correct / total) * 100),
    passed: attempt.passed === 1,
    xpAwarded: attempt.xp_awarded,
    passThreshold: lesson?.passThreshold ?? null,
    kind: attempt.kind,
    completedAt: attempt.completed_at,
    review: exercises.map((exercise) => ({
      exerciseId: exercise.id,
      slug: exercise.slug,
      type: exercise.type,
      prompt: exercise.prompt,
      question: exercise.question,
      correct: exercise.result?.correct ?? false,
      yourAnswer: exercise.result?.yourAnswer ?? null,
      correctAnswer: exercise.result?.correctAnswer ?? null,
      explanation: exercise.result?.explanation ?? null,
    })),
  };
}

// --- Enviar una respuesta ---------------------------------------------------

export async function submitAnswer(user, attemptId, exerciseId, answer) {
  const db = getDb();
  const attempt = loadAttemptOwned(user, attemptId);

  const exerciseIds = readJson(attempt.exercise_ids, []);
  if (!exerciseIds.includes(exerciseId)) {
    throw badRequest('That exercise is not part of this attempt.', { exerciseId });
  }

  const exercise = loadExercise(exerciseId, db);
  if (!exercise) throw notFound('That exercise does not exist.');

  const existing = db
    .prepare('SELECT * FROM attempt_answers WHERE attempt_id = ? AND exercise_id = ?')
    .get(attemptId, exerciseId);

  // Ya habia respuesta: idempotencia.
  if (existing) {
    const incoming = exercise.payload.editor ? 'code:' + answer : answerDigest(answer);
    if (incoming === existing.answer_digest) {
      return {
        ...answerResult(exercise, existing),
        repeated: true,
      };
    }
    throw conflict(
      'You already answered this exercise in this attempt. Start a new attempt to try again.',
      { exerciseId, recordedAt: existing.answered_at }
    );
  }

  if (attempt.status !== 'in_progress') {
    throw conflict('This attempt is already finished. Start a new one to keep practising.', {
      attemptId,
    });
  }

  const graded = await gradeAnswer(exercise, answer);
  const now = nowIso();

  const save = db.transaction(() => {
    const concurrent = db.prepare('SELECT * FROM attempt_answers WHERE attempt_id=? AND exercise_id=?').get(attemptId,exerciseId);
    if (concurrent) {
      if (concurrent.answer_digest !== (exercise.payload.editor ? 'code:' + graded.stored : answerDigest(graded.stored))) {
        throw conflict('Ya existe otra respuesta guardada para este ejercicio.');
      }
      return { repeated: concurrent };
    }
    db.prepare(
      `INSERT INTO attempt_answers (attempt_id, exercise_id, answer, answer_digest,
                                    is_correct, answered_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      attemptId,
      exerciseId,
      JSON.stringify(graded.stored),
      exercise.payload.editor ? 'code:' + graded.stored : answerDigest(graded.stored),
      graded.correct ? 1 : 0,
      now
    );

    // Errores pendientes: se crean al fallar y se resuelven al acertar.
    db.prepare('DELETE FROM attempt_drafts WHERE attempt_id=? AND exercise_id=?').run(attemptId,exerciseId);
    if (graded.correct) {
      resolveMiss(user.id, exerciseId, db);
    } else {
      recordMiss(user.id, exerciseId, db);
    }

    // Vocabulario "encontrado"
    markVocabularySeen(user.id, exerciseId, db);

    const answered = db
      .prepare('SELECT COUNT(*) AS n, SUM(is_correct) AS c FROM attempt_answers WHERE attempt_id = ?')
      .get(attemptId);
    db.prepare('UPDATE attempts SET correct_count = ? WHERE id = ?')
      .run(answered.c ?? 0, attemptId);
    return answered;
  });

  const answered = save();
  if (answered.repeated) return { ...answerResult(exercise,answered.repeated), repeated:true };

  return {
    correct: graded.correct,
    yourAnswer: graded.stored,
    correctAnswer: correctAnswerText(exercise),
    explanation: exercise.explanation,
    perPair: graded.perPair,
    spoken: exercise.audioText ?? null,
    answeredAt: now,
    progress: {
      answered: answered.n,
      total: attempt.total_count,
      correctSoFar: answered.c ?? 0,
    },
    repeated: false,
    execution: graded.execution,
  };
}

function ownedCodeExercise(user, attemptId, exerciseId) {
  const attempt = loadAttemptOwned(user,attemptId);
  if (attempt.status !== 'in_progress') throw conflict('Este intento ya está terminado.');
  if (!readJson(attempt.exercise_ids,[]).includes(exerciseId)) throw badRequest('El ejercicio no pertenece a este intento.');
  const exercise = loadExercise(exerciseId);
  if (!exercise?.payload.editor) throw badRequest('Este ejercicio no tiene editor de código.');
  if (getDb().prepare('SELECT 1 FROM attempt_answers WHERE attempt_id=? AND exercise_id=?').get(attemptId,exerciseId)) {
    throw conflict('La respuesta ya está guardada. Repite la lección para volver a intentarlo.');
  }
  return exercise;
}

export function saveDraft(user, attemptId, exerciseId, code) {
  ownedCodeExercise(user,attemptId,exerciseId);
  getDb().prepare(`INSERT INTO attempt_drafts(attempt_id,exercise_id,code,updated_at) VALUES(?,?,?,?)
    ON CONFLICT(attempt_id,exercise_id) DO UPDATE SET code=excluded.code,updated_at=excluded.updated_at`)
    .run(attemptId,exerciseId,code,nowIso());
  return { saved:true };
}

export async function runExercise(user, attemptId, exerciseId, code) {
  const exercise = ownedCodeExercise(user,attemptId,exerciseId);
  saveDraft(user,attemptId,exerciseId,code);
  return evaluateCode(exercise,code);
}

function answerResult(exercise, row) {
  return {
    correct: row.is_correct === 1,
    yourAnswer: readJson(row.answer, null),
    correctAnswer: correctAnswerText(exercise),
    explanation: exercise.explanation,
    spoken: exercise.audioText ?? null,
    answeredAt: row.answered_at,
  };
}

// --- Finalizar un intento ---------------------------------------------------

export function completeAttempt(user, attemptId) {
  const db = getDb();
  const attempt = loadAttemptOwned(user, attemptId);

  // Finalizar dos veces: mismo resultado, ningun premio nuevo.
  if (attempt.status === 'completed') {
    const described = describeAttempt(user, attempt);
    return { result: described.result, alreadyCompleted: true, newAchievements: [] };
  }

  const exerciseIds = readJson(attempt.exercise_ids, []);
  const answers = db
    .prepare('SELECT exercise_id, is_correct FROM attempt_answers WHERE attempt_id = ?')
    .all(attemptId);
  const answeredIds = new Set(answers.map((row) => row.exercise_id));
  const missing = exerciseIds.filter((id) => !answeredIds.has(id));
  if (missing.length > 0) {
    throw badRequest('Answer every exercise before finishing.', {
      missingExerciseIds: missing,
      answered: answers.length,
      total: exerciseIds.length,
    });
  }

  const correctCount = answers.filter((row) => row.is_correct === 1).length;
  const now = new Date();
  const nowText = now.toISOString();

  let newAchievements = [];

  const finish = db.transaction(() => {
    let passed = false;
    let xpAwarded = 0;

    if (attempt.kind === 'lesson') {
      const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(attempt.lesson_id);
      passed = correctCount >= lesson.pass_threshold;

      const previous = db
        .prepare('SELECT * FROM lesson_progress WHERE user_id = ? AND lesson_id = ?')
        .get(user.id, attempt.lesson_id);
      const firstPass = passed && (previous?.xp_earned ?? 0) === 0;
      xpAwarded = firstPass ? lesson.xp_reward : 0;

      db.prepare(
        `INSERT INTO lesson_progress (user_id, lesson_id, status, best_correct,
                                      attempts_count, xp_earned, first_passed_at, last_attempt_at)
         VALUES (@user_id, @lesson_id, @status, @best_correct, 1, @xp_earned,
                 @first_passed_at, @last_attempt_at)
         ON CONFLICT(user_id, lesson_id) DO UPDATE SET
           status          = CASE WHEN lesson_progress.status = 'completed' THEN 'completed'
                                  ELSE excluded.status END,
           best_correct    = MAX(lesson_progress.best_correct, excluded.best_correct),
           attempts_count  = lesson_progress.attempts_count + 1,
           xp_earned       = lesson_progress.xp_earned + excluded.xp_earned,
           first_passed_at = COALESCE(lesson_progress.first_passed_at, excluded.first_passed_at),
           last_attempt_at = excluded.last_attempt_at`
      ).run({
        user_id: user.id,
        lesson_id: attempt.lesson_id,
        status: passed ? 'completed' : 'available',
        best_correct: correctCount,
        xp_earned: xpAwarded,
        first_passed_at: passed ? nowText : null,
        last_attempt_at: nowText,
      });

      if (passed) {
        // Cuenta para el objetivo del dia y la racha incluso si repites la
        // leccion (pero solo una vez por dia y sin XP extra).
        const applied = applyLessonPass({
          db,
          userId: user.id,
          lessonId: attempt.lesson_id,
          timezone: user.timezone,
          xpReward: xpAwarded,
          at: now,
        });
        newAchievements = applied.achievementsEarned;
      }
    }
    // Los repasos (kind === 'practice') no dan XP ni desbloquean nada;
    // sus aciertos/fallos ya actualizaron review_items al responder.

    db.prepare(
      `UPDATE attempts
          SET status = 'completed', correct_count = ?, passed = ?, xp_awarded = ?,
              completed_at = ?
        WHERE id = ? AND status = 'in_progress'`
    ).run(correctCount, passed ? 1 : 0, xpAwarded, nowText, attemptId);
  });

  finish();

  const updated = db.prepare('SELECT * FROM attempts WHERE id = ?').get(attemptId);
  const described = describeAttempt(user, updated);
  return { result: described.result, alreadyCompleted: false, newAchievements };
}

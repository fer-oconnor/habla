// ---------------------------------------------------------------------------
// Progreso, desbloqueos, racha, objetivo diario, logros, errores y vocabulario.
//
// Todas las reglas viven AQUI, en el servidor. El frontend solo muestra lo que
// este servicio calcula.
//
// Reglas implementadas:
//  * Una leccion se supera con >= 6 aciertos de 8 (lessons.pass_threshold).
//  * Superarla desbloquea la siguiente (comprobado en cada peticion).
//  * La PRIMERA vez que se supera da 10 XP. Repetirla no da XP otra vez.
//  * El objetivo diario cuenta lecciones DISTINTAS superadas ese dia.
//  * La racha sube un dia por cada dia natural consecutivo con >= 1 leccion
//    superada, usando la zona horaria del perfil.
//  * Los repasos guardan resultado y actualizan errores, pero no dan XP ni
//    desbloquean nada.
// ---------------------------------------------------------------------------

import { getDb, nowIso, readJson } from '../../db/index.js';
import { config } from '../config.js';
import { addDays, dayInTimeZone, daysBetween, lastDays, shortLabel } from '../lib/dates.js';

// --- Lecciones y desbloqueos -----------------------------------------------

/** Todas las rutas de aprendizaje, con el avance del usuario en cada una. */
export function listTracks(userId) {
  const db = getDb();
  return db
    .prepare('SELECT * FROM tracks WHERE active=1 ORDER BY position')
    .all()
    .map((track) => {
      const totals = db
        .prepare(
          `SELECT COUNT(*) AS lessons,
                  (SELECT COUNT(*) FROM lesson_progress p
                     JOIN lessons l2 ON l2.id = p.lesson_id
                    WHERE p.user_id = ? AND p.status = 'completed' AND l2.track = l.track)
                    AS completed
             FROM lessons l WHERE l.track = ?`
        )
        .get(userId, track.slug);
      return {
        slug: track.slug,
        title: track.title,
        subtitle: track.subtitle,
        description: track.description,
        contentLang: track.content_lang,
        speech: track.speech === 1,
        termLabel: track.term_label,
        meaningLabel: track.meaning_label,
        color: track.color,
        icon: track.icon,
        lessons: totals.lessons,
        completed: totals.completed ?? 0,
      };
    });
}

export function trackExists(slug) {
  return Boolean(getDb().prepare('SELECT slug FROM tracks WHERE slug = ? AND active=1').get(slug));
}

/**
 * Unidades de un track con sus lecciones y el estado para este usuario.
 * status: 'locked' | 'available' | 'completed'
 * El desbloqueo se calcula DENTRO del track: empezar SQL no depende del espanol.
 */
export function getCourseForUser(userId, track = 'sql') {
  const db = getDb();
  const units = db
    .prepare('SELECT * FROM units WHERE track = ? ORDER BY track_position')
    .all(track);
  const lessons = db
    .prepare(
      `SELECT l.*,
              (SELECT COUNT(*) FROM exercises e WHERE e.lesson_id = l.id) AS exercise_count
         FROM lessons l WHERE l.track = ? ORDER BY l.track_order`
    )
    .all(track);
  const progressRows = db
    .prepare('SELECT * FROM lesson_progress WHERE user_id = ?')
    .all(userId);
  const progressByLesson = new Map(progressRows.map((row) => [row.lesson_id, row]));

  // Recorremos en orden global: la primera esta disponible siempre, y cada
  // siguiente se abre cuando la anterior esta completada.
  let previousCompleted = true;
  const statusByLesson = new Map();
  for (const lesson of lessons) {
    const progress = progressByLesson.get(lesson.id);
    const completed = progress?.status === 'completed';
    const status = completed ? 'completed' : previousCompleted ? 'available' : 'locked';
    statusByLesson.set(lesson.id, status);
    previousCompleted = completed;
  }

  const unitsOut = units.map((unit) => {
    const unitLessons = lessons
      .filter((lesson) => lesson.unit_id === unit.id)
      .map((lesson) => {
        const progress = progressByLesson.get(lesson.id);
        return {
          id: lesson.id,
          slug: lesson.slug,
          title: lesson.title,
          position: lesson.position,
          trackOrder: lesson.track_order,
          exerciseCount: lesson.exercise_count,
          xpReward: lesson.xp_reward,
          passThreshold: lesson.pass_threshold,
          status: statusByLesson.get(lesson.id),
          bestCorrect: progress?.best_correct ?? 0,
          attempts: progress?.attempts_count ?? 0,
          xpEarned: progress?.xp_earned ?? 0,
          inProgress: db.prepare(`SELECT a.id, a.total_count,
            (SELECT COUNT(*) FROM attempt_answers aa WHERE aa.attempt_id=a.id) AS answered
            FROM attempts a WHERE a.user_id=? AND a.lesson_id=? AND a.status='in_progress'
            ORDER BY a.id DESC LIMIT 1`).get(userId, lesson.id) ?? null,
        };
      });
    return {
      id: unit.id,
      slug: unit.slug,
      track: unit.track,
      position: unit.track_position,
      title: unit.title,
      subtitle: unit.subtitle,
      description: unit.description,
      color: unit.color,
      icon: unit.icon,
      lessons: unitLessons,
      completedLessons: unitLessons.filter((lesson) => lesson.status === 'completed').length,
    };
  });

  const flat = unitsOut.flatMap((unit) => unit.lessons);
  const resumeLesson = flat.filter((lesson) => lesson.inProgress && lesson.status !== 'locked')
    .sort((a,b) => b.inProgress.id-a.inProgress.id)[0] ?? null;
  const nextLesson = resumeLesson ?? flat.find((lesson) => lesson.status === 'available') ?? null;

  const trackRow = db.prepare('SELECT * FROM tracks WHERE slug = ?').get(track);

  return {
    track: trackRow
      ? {
          slug: trackRow.slug,
          title: trackRow.title,
          subtitle: trackRow.subtitle,
          contentLang: trackRow.content_lang,
          speech: trackRow.speech === 1,
          termLabel: trackRow.term_label,
          meaningLabel: trackRow.meaning_label,
          color: trackRow.color,
        }
      : null,
    units: unitsOut,
    totals: {
      lessons: flat.length,
      completed: flat.filter((lesson) => lesson.status === 'completed').length,
    },
    nextLesson: nextLesson
      ? { id: nextLesson.id, slug: nextLesson.slug, title: nextLesson.title, inProgress: nextLesson.inProgress }
      : null,
  };
}

/**
 * ¿Puede este usuario abrir esta leccion? Se comprueba en el servidor.
 * La leccion anterior se busca DENTRO del mismo track.
 */
export function isLessonAccessible(userId, lessonId) {
  const db = getDb();
  const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(lessonId);
  if (!lesson || !trackExists(lesson.track)) return { ok: false, reason: 'not_found' };
  if (lesson.track_order === 1) return { ok: true, lesson };

  const previous = db
    .prepare('SELECT id FROM lessons WHERE track = ? AND track_order = ?')
    .get(lesson.track, lesson.track_order - 1);
  if (!previous) return { ok: true, lesson };

  const progress = db
    .prepare('SELECT status FROM lesson_progress WHERE user_id = ? AND lesson_id = ?')
    .get(userId, previous.id);
  if (progress?.status === 'completed') return { ok: true, lesson };

  // Tambien esta accesible si ya se completo antes (para repetirla).
  const own = db
    .prepare('SELECT status FROM lesson_progress WHERE user_id = ? AND lesson_id = ?')
    .get(userId, lessonId);
  if (own?.status === 'completed') return { ok: true, lesson };

  return { ok: false, reason: 'locked', lesson };
}

export function getLessonWithIntro(lessonId) {
  const db = getDb();
  const lesson = db
    .prepare(
      `SELECT l.*, u.slug AS unit_slug, u.title AS unit_title, u.color AS unit_color,
              t.slug AS track_slug, t.title AS track_title, t.content_lang, t.speech,
              (SELECT COUNT(*) FROM exercises e WHERE e.lesson_id = l.id) AS exercise_count
         FROM lessons l
         JOIN units u ON u.id = l.unit_id
         LEFT JOIN tracks t ON t.slug = l.track
        WHERE l.id = ?`
    )
    .get(lessonId);
  if (!lesson) return null;
  return {
    id: lesson.id,
    slug: lesson.slug,
    title: lesson.title,
    position: lesson.position,
    trackOrder: lesson.track_order,
    track: {
      slug: lesson.track_slug ?? lesson.track,
      title: lesson.track_title ?? '',
      contentLang: lesson.content_lang ?? 'es-ES',
      speech: lesson.speech !== 0,
    },
    unit: { slug: lesson.unit_slug, title: lesson.unit_title, color: lesson.unit_color },
    intro: {
      title: lesson.intro_title,
      body: lesson.intro_body,
      points: readJson(lesson.intro_points, []),
    },
    exerciseCount: lesson.exercise_count,
    xpReward: lesson.xp_reward,
    passThreshold: lesson.pass_threshold,
  };
}

// --- Errores pendientes (Practice) -----------------------------------------

export function recordMiss(userId, exerciseId, db = getDb()) {
  db.prepare(
    `INSERT INTO review_items (user_id, exercise_id, misses, resolved, last_missed_at)
     VALUES (?, ?, 1, 0, ?)
     ON CONFLICT(user_id, exercise_id) DO UPDATE SET
       misses = review_items.misses + 1,
       resolved = 0,
       resolved_at = NULL,
       last_missed_at = excluded.last_missed_at`
  ).run(userId, exerciseId, nowIso());
}

export function resolveMiss(userId, exerciseId, db = getDb()) {
  db.prepare(
    `UPDATE review_items SET resolved = 1, resolved_at = ?
      WHERE user_id = ? AND exercise_id = ? AND resolved = 0`
  ).run(nowIso(), userId, exerciseId);
}

export function countPendingReviews(userId, db = getDb(), track = null) {
  if (!track) {
    return db
      .prepare(`SELECT COUNT(*) AS n FROM review_items r JOIN exercises e ON e.id=r.exercise_id
        JOIN lessons l ON l.id=e.lesson_id JOIN tracks t ON t.slug=l.track
        WHERE user_id = ? AND resolved = 0 AND t.active=1`)
      .get(userId).n;
  }
  return db
    .prepare(
      `SELECT COUNT(*) AS n FROM review_items r
         JOIN exercises e ON e.id = r.exercise_id
         JOIN lessons l ON l.id = e.lesson_id
        WHERE r.user_id = ? AND r.resolved = 0 AND l.track = ?`
    )
    .get(userId, track).n;
}

/**
 * Elige los ejercicios de una sesion de repaso.
 * 1) Errores pendientes. 2) Si no hay, contenido ya estudiado. 3) Si no hay
 *    nada estudiado, devuelve null y el frontend manda a la primera leccion.
 */
export function buildPracticePool(userId, { track = null, size = config.rules.practiceSize } = {}) {
  const db = getDb();

  const pending = db
    .prepare(
      `SELECT e.id FROM review_items r
         JOIN exercises e ON e.id = r.exercise_id
         JOIN lessons l ON l.id = e.lesson_id
         JOIN tracks t ON t.slug=l.track
        WHERE t.active=1 AND r.user_id = ? AND r.resolved = 0 AND (? IS NULL OR l.track = ?)
        ORDER BY r.misses DESC, r.last_missed_at DESC
        LIMIT ?`
    )
    .all(userId, track, track, size)
    .map((row) => row.id);

  if (pending.length > 0) {
    return { source: 'mistakes', exerciseIds: pending };
  }

  const studied = db
    .prepare(
      `SELECT e.id FROM exercises e
         JOIN lessons l ON l.id = e.lesson_id
         JOIN lesson_progress p ON p.lesson_id = e.lesson_id
         JOIN tracks t ON t.slug=l.track
        WHERE t.active=1 AND p.user_id = ? AND (? IS NULL OR l.track = ?)
        ORDER BY RANDOM()
        LIMIT ?`
    )
    .all(userId, track, track, size)
    .map((row) => row.id);

  if (studied.length > 0) {
    return { source: 'review', exerciseIds: studied };
  }

  return null;
}

// --- Vocabulario ------------------------------------------------------------

export function markVocabularySeen(userId, exerciseId, db = getDb()) {
  const now = nowIso();
  const terms = db
    .prepare('SELECT vocabulary_id FROM exercise_vocabulary WHERE exercise_id = ?')
    .all(exerciseId);
  for (const { vocabulary_id: vocabularyId } of terms) {
    db.prepare(
      `INSERT INTO user_vocabulary (user_id, vocabulary_id, times_seen, first_seen_at, last_seen_at)
       VALUES (?, ?, 1, ?, ?)
       ON CONFLICT(user_id, vocabulary_id) DO UPDATE SET
         times_seen = user_vocabulary.times_seen + 1,
         last_seen_at = excluded.last_seen_at`
    ).run(userId, vocabularyId, now, now);
  }
}

export function listUserVocabulary(userId, { search = '', unitSlug = '', track = '' } = {}) {
  const db = getDb();
  const params = [userId];
  let sql = `
    SELECT v.id, v.term_es, v.term_en, v.example_es, v.example_en, v.part_of_speech,
           u.slug AS unit_slug, u.title AS unit_title, u.track AS track,
           uv.times_seen, uv.first_seen_at, uv.last_seen_at
      FROM user_vocabulary uv
      JOIN vocabulary v ON v.id = uv.vocabulary_id
      JOIN units u ON u.id = v.unit_id
      JOIN tracks t ON t.slug=u.track
     WHERE t.active=1 AND uv.user_id = ?`;

  if (track) {
    sql += ' AND u.track = ?';
    params.push(track);
  }
  if (unitSlug) {
    sql += ' AND u.slug = ?';
    params.push(unitSlug);
  }
  if (search) {
    sql += ' AND (LOWER(v.term_es) LIKE ? OR LOWER(v.term_en) LIKE ?)';
    const like = `%${search.toLowerCase()}%`;
    params.push(like, like);
  }
  sql += ' ORDER BY u.position, v.term_es';

  const words = db.prepare(sql).all(...params).map((row) => ({
    id: row.id,
    es: row.term_es,          // termino que se aprende (espanol o SQL)
    en: row.term_en,          // su significado en ingles
    exampleEs: row.example_es,
    exampleEn: row.example_en,
    partOfSpeech: row.part_of_speech,
    track: row.track,
    unit: { slug: row.unit_slug, title: row.unit_title },
    timesSeen: row.times_seen,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
  }));

  // Unidades en las que el usuario ya tiene alguna palabra (para el filtro)
  const unitParams = track ? [userId, track] : [userId];
  const unitsWithWords = db
    .prepare(
      `SELECT DISTINCT u.slug, u.title, u.track_position AS position
         FROM user_vocabulary uv
         JOIN vocabulary v ON v.id = uv.vocabulary_id
         JOIN units u ON u.id = v.unit_id
         JOIN tracks t ON t.slug=u.track
        WHERE t.active=1 AND uv.user_id = ?${track ? ' AND u.track = ?' : ''}
        ORDER BY u.track_position`
    )
    .all(...unitParams);

  return { words, units: unitsWithWords, total: words.length };
}

// --- XP, objetivo diario y racha -------------------------------------------

/**
 * Aplica el credito de una leccion superada.
 * Debe llamarse DENTRO de una transaccion (lo hace attempts.service.js).
 */
export function applyLessonPass({ db, userId, lessonId, timezone, xpReward, at = new Date() }) {
  const day = dayInTimeZone(at, timezone);
  const now = at.toISOString();

  // 1) Objetivo diario: la misma leccion cuenta como maximo una vez al dia.
  const credit = db
    .prepare(
      `INSERT OR IGNORE INTO daily_lesson_credit (user_id, activity_day, lesson_id, created_at)
       VALUES (?, ?, ?, ?)`
    )
    .run(userId, day, lessonId, now);
  const countedToday = credit.changes === 1;

  db.prepare(
    `INSERT INTO daily_activity (user_id, activity_day, goal_lessons, xp_earned, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, activity_day) DO UPDATE SET
       goal_lessons = daily_activity.goal_lessons + excluded.goal_lessons,
       xp_earned    = daily_activity.xp_earned + excluded.xp_earned,
       updated_at   = excluded.updated_at`
  ).run(userId, day, countedToday ? 1 : 0, xpReward, now);

  // 2) Racha: solo se mueve si hoy es un dia nuevo de actividad.
  const progress = db.prepare('SELECT * FROM user_progress WHERE user_id = ?').get(userId);
  let streak = progress?.current_streak ?? 0;
  let longest = progress?.longest_streak ?? 0;
  let lastDay = progress?.last_active_day ?? null;

  if (lastDay === null) {
    streak = 1;
    lastDay = day;
  } else {
    const gap = daysBetween(lastDay, day);
    if (gap === 0) {
      // Ya habia actividad hoy: la racha no cambia.
      if (streak === 0) streak = 1;
    } else if (gap === 1) {
      streak += 1;
      lastDay = day;
    } else if (gap > 1) {
      streak = 1;                    // se rompio la racha
      lastDay = day;
    }
    // gap < 0 (reloj o zona hacia atras): no tocamos nada.
  }
  longest = Math.max(longest, streak);

  // 3) XP total y lecciones superadas (se recuentan, asi nunca se desajustan).
  const passedCount = db
    .prepare(
      `SELECT COUNT(*) AS n FROM lesson_progress p JOIN lessons l ON l.id=p.lesson_id
       JOIN tracks t ON t.slug=l.track WHERE t.active=1 AND user_id = ? AND status = 'completed'`
    )
    .get(userId).n;

  db.prepare(
    `INSERT INTO user_progress (user_id, xp, lessons_passed, current_streak,
                                longest_streak, last_active_day, updated_at)
     VALUES (@user_id, @xp, @lessons_passed, @current_streak, @longest_streak,
             @last_active_day, @updated_at)
     ON CONFLICT(user_id) DO UPDATE SET
       xp              = user_progress.xp + @xp,
       lessons_passed  = @lessons_passed,
       current_streak  = @current_streak,
       longest_streak  = @longest_streak,
       last_active_day = @last_active_day,
       updated_at      = @updated_at`
  ).run({
    user_id: userId,
    xp: xpReward,
    lessons_passed: passedCount,
    current_streak: streak,
    longest_streak: longest,
    last_active_day: lastDay,
    updated_at: now,
  });

  const earned = evaluateAchievements(userId, db, now);
  return { day, countedToday, streak, achievementsEarned: earned };
}

/** Comprueba los logros y concede los que falten. Nunca duplica. */
export function evaluateAchievements(userId, db = getDb(), at = nowIso()) {
  const progress = db.prepare('SELECT * FROM user_progress WHERE user_id = ?').get(userId);
  if (!progress) return [];

  const candidates = [];
  if (progress.lessons_passed >= 1) candidates.push('first_lesson');
  if (progress.lessons_passed >= config.rules.lessonsAchievementCount) {
    candidates.push('five_lessons');
  }
  if (progress.longest_streak >= config.rules.streakAchievementDays) {
    candidates.push('streak_3');
  }

  const earned = [];
  for (const code of candidates) {
    const info = db
      .prepare('INSERT OR IGNORE INTO user_achievements (user_id, code, earned_at) VALUES (?, ?, ?)')
      .run(userId, code, at);
    if (info.changes === 1) earned.push(code);
  }
  return earned;
}

/** Datos completos para la pantalla Profile y la cabecera de Learn. */
export function getProgressSummary(user) {
  const db = getDb();
  const today = dayInTimeZone(new Date(), user.timezone);

  const progress =
    db.prepare('SELECT * FROM user_progress WHERE user_id = ?').get(user.id) ?? {
      xp: 0, lessons_passed: 0, current_streak: 0, longest_streak: 0, last_active_day: null,
    };

  // Si el ultimo dia activo no es hoy ni ayer, la racha mostrada es 0.
  let currentStreak = progress.current_streak;
  if (progress.last_active_day) {
    const gap = daysBetween(progress.last_active_day, today);
    if (gap > 1) currentStreak = 0;
  } else {
    currentStreak = 0;
  }

  const todayRow = db
    .prepare('SELECT * FROM daily_activity WHERE user_id = ? AND activity_day = ?')
    .get(user.id, today);

  const week = lastDays(today, 7).map((day) => {
    const row = db
      .prepare('SELECT goal_lessons, xp_earned FROM daily_activity WHERE user_id = ? AND activity_day = ?')
      .get(user.id, day);
    return {
      day,
      label: shortLabel(day),
      lessons: row?.goal_lessons ?? 0,
      xp: row?.xp_earned ?? 0,
      goalMet: (row?.goal_lessons ?? 0) >= user.dailyGoal,
    };
  });

  const achievements = db
    .prepare(
      `SELECT a.code, a.title, a.description, a.icon, ua.earned_at
         FROM achievements a
         LEFT JOIN user_achievements ua ON ua.code = a.code AND ua.user_id = ?
        ORDER BY a.code`
    )
    .all(user.id)
    .map((row) => ({
      code: row.code,
      title: row.title,
      description: row.description,
      icon: row.icon,
      earned: Boolean(row.earned_at),
      earnedAt: row.earned_at ?? null,
    }));

  const lessonsTotal = db.prepare('SELECT COUNT(*) AS n FROM lessons l JOIN tracks t ON t.slug=l.track WHERE t.active=1').get().n;
  const tracks = listTracks(user.id).map((track) => ({
    ...track,
    pendingReviews: countPendingReviews(user.id, db, track.slug),
  }));
  const vocabularyLearned = db
    .prepare(`SELECT COUNT(*) AS n FROM user_vocabulary uv JOIN vocabulary v ON v.id=uv.vocabulary_id
      JOIN units u ON u.id=v.unit_id JOIN tracks t ON t.slug=u.track WHERE t.active=1 AND user_id = ?`)
    .get(user.id).n;
  const vocabularyTotal = db.prepare('SELECT COUNT(*) AS n FROM vocabulary v JOIN units u ON u.id=v.unit_id JOIN tracks t ON t.slug=u.track WHERE t.active=1').get().n;
  const exercisesAnswered = db
    .prepare(
      `SELECT COUNT(*) AS n FROM attempt_answers aa
         JOIN attempts at ON at.id = aa.attempt_id
        WHERE at.user_id = ?`
    )
    .get(user.id).n;
  const correctAnswers = db
    .prepare(
      `SELECT COUNT(*) AS n FROM attempt_answers aa
         JOIN attempts at ON at.id = aa.attempt_id
        WHERE at.user_id = ? AND aa.is_correct = 1`
    )
    .get(user.id).n;

  return {
    xp: progress.xp,
    lessonsPassed: progress.lessons_passed,
    lessonsTotal,
    currentStreak,
    longestStreak: progress.longest_streak,
    lastActiveDay: progress.last_active_day,
    today: {
      day: today,
      timezone: user.timezone,
      goal: user.dailyGoal,
      lessons: todayRow?.goal_lessons ?? 0,
      xp: todayRow?.xp_earned ?? 0,
      goalMet: (todayRow?.goal_lessons ?? 0) >= user.dailyGoal,
    },
    week,
    achievements,
    tracks,
    pendingReviews: countPendingReviews(user.id, db),
    vocabulary: { learned: vocabularyLearned, total: vocabularyTotal },
    accuracy: {
      answered: exercisesAnswered,
      correct: correctAnswers,
      percent: exercisesAnswered === 0
        ? 0
        : Math.round((correctAnswers / exercisesAnswered) * 100),
    },
  };
}

/** Utilidad para pruebas: dia siguiente en la zona del usuario. */
export const nextDay = (day) => addDays(day, 1);

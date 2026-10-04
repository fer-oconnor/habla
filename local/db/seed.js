// ---------------------------------------------------------------------------
// Carga del contenido en la base de datos.
//
// ES REPETIBLE (idempotente): cada fila se identifica por su `slug`, asi que
// ejecutar `npm run setup` mil veces no duplica ejercicios ni toca el progreso
// de los usuarios. Si editas un texto y vuelves a ejecutarlo, la fila se
// actualiza en su sitio.
// ---------------------------------------------------------------------------

import { getDb, migrate, nowIso } from './index.js';
import { UNITS, TRACKS, ACHIEVEMENTS, DEFAULT_TRACK, CONTENT_VERSION, contentSummary } from './content/index.js';

const UPSERT_TRACK = `
  INSERT INTO tracks (slug, position, title, subtitle, description, content_lang,
                      speech, term_label, meaning_label, color, icon)
  VALUES (@slug, @position, @title, @subtitle, @description, @content_lang,
          @speech, @term_label, @meaning_label, @color, @icon)
  ON CONFLICT(slug) DO UPDATE SET
    position      = excluded.position,
    title         = excluded.title,
    subtitle      = excluded.subtitle,
    description   = excluded.description,
    content_lang  = excluded.content_lang,
    speech        = excluded.speech,
    term_label    = excluded.term_label,
    meaning_label = excluded.meaning_label,
    color         = excluded.color,
    icon          = excluded.icon
`;

const UPSERT_UNIT = `
  INSERT INTO units (slug, track, position, track_position, title, subtitle,
                     description, color, icon)
  VALUES (@slug, @track, @position, @track_position, @title, @subtitle,
          @description, @color, @icon)
  ON CONFLICT(slug) DO UPDATE SET
    track          = excluded.track,
    position       = excluded.position,
    track_position = excluded.track_position,
    title          = excluded.title,
    subtitle       = excluded.subtitle,
    description    = excluded.description,
    color          = excluded.color,
    icon           = excluded.icon
`;

const UPSERT_LESSON = `
  INSERT INTO lessons (unit_id, slug, track, position, global_order, track_order, title,
                       intro_title, intro_body, intro_points, xp_reward, pass_threshold)
  VALUES (@unit_id, @slug, @track, @position, @global_order, @track_order, @title,
          @intro_title, @intro_body, @intro_points, @xp_reward, @pass_threshold)
  ON CONFLICT(slug) DO UPDATE SET
    unit_id        = excluded.unit_id,
    track          = excluded.track,
    position       = excluded.position,
    global_order   = excluded.global_order,
    track_order    = excluded.track_order,
    title          = excluded.title,
    intro_title    = excluded.intro_title,
    intro_body     = excluded.intro_body,
    intro_points   = excluded.intro_points,
    xp_reward      = excluded.xp_reward,
    pass_threshold = excluded.pass_threshold
`;

const UPSERT_EXERCISE = `
  INSERT INTO exercises (lesson_id, slug, position, type, prompt, question, hint,
                         audio_text, payload, solution, explanation)
  VALUES (@lesson_id, @slug, @position, @type, @prompt, @question, @hint,
          @audio_text, @payload, @solution, @explanation)
  ON CONFLICT(slug) DO UPDATE SET
    lesson_id   = excluded.lesson_id,
    position    = excluded.position,
    type        = excluded.type,
    prompt      = excluded.prompt,
    question    = excluded.question,
    hint        = excluded.hint,
    audio_text  = excluded.audio_text,
    payload     = excluded.payload,
    solution    = excluded.solution,
    explanation = excluded.explanation
`;

const UPSERT_VOCAB = `
  INSERT INTO vocabulary (unit_id, term_es, term_en, example_es, example_en, part_of_speech)
  VALUES (@unit_id, @term_es, @term_en, @example_es, @example_en, @part_of_speech)
  ON CONFLICT(term_es) DO UPDATE SET
    unit_id        = excluded.unit_id,
    term_en        = excluded.term_en,
    example_es     = excluded.example_es,
    example_en     = excluded.example_en,
    part_of_speech = excluded.part_of_speech
`;

const UPSERT_ACHIEVEMENT = `
  INSERT INTO achievements (code, title, description, icon)
  VALUES (@code, @title, @description, @icon)
  ON CONFLICT(code) DO UPDATE SET
    title       = excluded.title,
    description = excluded.description,
    icon        = excluded.icon
`;

/**
 * Comprobacion basica del contenido antes de tocar la base de datos.
 * Es mejor fallar aqui con un mensaje claro que guardar datos incoherentes.
 */
function validateContent() {
  const problems = [];
  const lessonSlugs = new Set();
  const exerciseSlugs = new Set();

  for (const unit of UNITS) {
    if (!unit.slug || !unit.lessons?.length) {
      problems.push(`Unidad sin slug o sin lecciones: ${unit.slug ?? '(sin slug)'}`);
      continue;
    }
    for (const lesson of unit.lessons) {
      if (lessonSlugs.has(lesson.slug)) problems.push(`Slug de leccion repetido: ${lesson.slug}`);
      lessonSlugs.add(lesson.slug);

      const exercises = lesson.exercises ?? [];
      if (exercises.length !== 8) {
        problems.push(`La leccion ${lesson.slug} tiene ${exercises.length} ejercicios (se esperan 8).`);
      }
      const types = new Set(exercises.map((exercise) => exercise.type));
      if (types.size < 3) {
        problems.push(`La leccion ${lesson.slug} usa solo ${types.size} tipos (minimo 3).`);
      }
      for (const exercise of exercises) {
        if (exerciseSlugs.has(exercise.slug)) {
          problems.push(`Slug de ejercicio repetido: ${exercise.slug}`);
        }
        exerciseSlugs.add(exercise.slug);
        if (!exercise.explanation) problems.push(`${exercise.slug} no tiene explicacion.`);
        if (exercise.type === 'listen_choose' && !exercise.audioText) {
          problems.push(`${exercise.slug} es de audio pero no tiene audioText.`);
        }
        if (exercise.type === 'match_pairs' && !exercise.solution?.pairs) {
          problems.push(`${exercise.slug} es de emparejar pero no tiene solution.pairs.`);
        }
        if (exercise.type !== 'match_pairs' && exercise.solution?.value === undefined) {
          problems.push(`${exercise.slug} no tiene solution.value.`);
        }
      }
    }
  }

  if (problems.length > 0) {
    throw new Error('Contenido no valido:\n - ' + problems.join('\n - '));
  }
}

export function seed({ verbose = false } = {}) {
  validateContent();

  const db = getDb();
  migrate(db);

  const log = verbose ? (...args) => console.log(...args) : () => {};
  const now = nowIso();

  const run = db.transaction(() => {
    // Conserva historial de cursos retirados y libera los órdenes únicos.
    db.exec('UPDATE tracks SET active = 0; UPDATE lessons SET global_order = -id;');
    for (const track of TRACKS) {
      db.prepare('UPDATE lessons SET track_order = -id WHERE track = ?').run(track.slug);
    }
    // --- Logros ---
    for (const achievement of ACHIEVEMENTS) {
      db.prepare(UPSERT_ACHIEVEMENT).run(achievement);
    }

    // --- Rutas de aprendizaje ---
    TRACKS.forEach((track, index) => {
      db.prepare(UPSERT_TRACK).run({
        slug: track.slug,
        position: index + 1,
        title: track.title,
        subtitle: track.subtitle,
        description: track.description,
        content_lang: track.contentLang,
        speech: track.speech ? 1 : 0,
        term_label: track.termLabel,
        meaning_label: track.meaningLabel,
        color: track.color,
        icon: track.icon,
      });
      db.prepare('UPDATE tracks SET active = 1 WHERE slug = ?').run(track.slug);
    });

    // --- Unidades, vocabulario, lecciones y ejercicios ---
    let globalOrder = 0;
    const trackOrder = new Map();   // track -> ultima leccion numerada
    const trackUnits = new Map();   // track -> ultima unidad numerada
    const vocabIdByTerm = new Map();

    UNITS.forEach((unit, unitIndex) => {
      const track = unit.track ?? DEFAULT_TRACK;
      const trackPosition = (trackUnits.get(track) ?? 0) + 1;
      trackUnits.set(track, trackPosition);

      db.prepare(UPSERT_UNIT).run({
        slug: unit.slug,
        track,
        position: unitIndex + 1,
        track_position: trackPosition,
        title: unit.title,
        subtitle: unit.subtitle,
        description: unit.description,
        color: unit.color ?? 'teal',
        icon: unit.icon ?? 'sun',
      });
      const unitId = db.prepare('SELECT id FROM units WHERE slug = ?').get(unit.slug).id;

      for (const term of unit.vocabulary) {
        db.prepare(UPSERT_VOCAB).run({
          unit_id: unitId,
          term_es: term.es,
          term_en: term.en,
          example_es: term.exampleEs,
          example_en: term.exampleEn,
          part_of_speech: term.pos ?? null,
        });
      }

      unit.lessons.forEach((lesson, lessonIndex) => {
        globalOrder += 1;
        const order = (trackOrder.get(track) ?? 0) + 1;
        trackOrder.set(track, order);
        db.prepare(UPSERT_LESSON).run({
          unit_id: unitId,
          slug: lesson.slug,
          track,
          position: lessonIndex + 1,
          global_order: globalOrder,
          track_order: order,
          title: lesson.title,
          intro_title: lesson.introTitle,
          intro_body: lesson.introBody,
          intro_points: JSON.stringify(lesson.introPoints ?? []),
          xp_reward: lesson.xpReward ?? 10,
          pass_threshold: lesson.passThreshold ?? 6,
        });
        const lessonId = db.prepare('SELECT id FROM lessons WHERE slug = ?').get(lesson.slug).id;

        lesson.exercises.forEach((exercise, exerciseIndex) => {
          db.prepare(UPSERT_EXERCISE).run({
            lesson_id: lessonId,
            slug: exercise.slug,
            position: exerciseIndex + 1,
            type: exercise.type,
            prompt: exercise.prompt,
            question: exercise.question ?? null,
            hint: exercise.hint ?? null,
            audio_text: exercise.audioText ?? null,
            payload: JSON.stringify(exercise.payload ?? {}),
            solution: JSON.stringify(exercise.solution ?? {}),
            explanation: exercise.explanation,
          });
        });
      });
    });

    // --- Enlaces ejercicio <-> vocabulario --------------------------------
    // Se resuelven al final porque un ejercicio puede repasar una palabra
    // introducida en otra unidad.
    for (const row of db.prepare('SELECT id, term_es FROM vocabulary').all()) {
      vocabIdByTerm.set(row.term_es, row.id);
    }

    const missingTerms = new Set();
    for (const unit of UNITS) {
      for (const lesson of unit.lessons) {
        for (const exercise of lesson.exercises) {
          const exerciseRow = db
            .prepare('SELECT id FROM exercises WHERE slug = ?')
            .get(exercise.slug);
          db.prepare('DELETE FROM exercise_vocabulary WHERE exercise_id = ?').run(exerciseRow.id);
          for (const term of exercise.vocab ?? []) {
            const vocabId = vocabIdByTerm.get(term);
            if (!vocabId) {
              missingTerms.add(`${exercise.slug} -> "${term}"`);
              continue;
            }
            db.prepare(
              'INSERT OR IGNORE INTO exercise_vocabulary (exercise_id, vocabulary_id) VALUES (?, ?)'
            ).run(exerciseRow.id, vocabId);
          }
        }
      }
    }
    if (missingTerms.size > 0) {
      throw new Error(
        'Estos ejercicios referencian vocabulario que no existe:\n - ' +
        [...missingTerms].join('\n - ')
      );
    }

    db.prepare(
      `INSERT INTO meta (key, value) VALUES ('content_seeded_at', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).run(now);
    db.prepare(`INSERT INTO meta(key,value) VALUES('content_version',?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(CONTENT_VERSION);
    db.prepare(`UPDATE users SET active_track=? WHERE active_track NOT IN
      (SELECT slug FROM tracks WHERE active=1)`).run(DEFAULT_TRACK);
    db.exec(`UPDATE user_progress SET lessons_passed=(SELECT COUNT(*) FROM lesson_progress p
      JOIN lessons l ON l.id=p.lesson_id JOIN tracks t ON t.slug=l.track
      WHERE p.user_id=user_progress.user_id AND p.status='completed' AND t.active=1);`);
  });

  run();

  const counts = {
    ...contentSummary(),
    achievements: db.prepare('SELECT COUNT(*) AS n FROM achievements').get().n,
  };

  log('[habla] Contenido cargado:', counts);
  log('[habla] Esperado por los archivos de contenido:', contentSummary());
  return counts;
}

// Permite ejecutar "node db/seed.js" directamente.
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  seed({ verbose: true });
}

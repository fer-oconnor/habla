// ---------------------------------------------------------------------------
// Catalogo de contenido de Habla.
//
// Rutas independientes: SQL y Python, 12 unidades y 36 lecciones por curso.
// Cada track tiene su propio recorrido, sus desbloqueos y su progreso.
//
// Para anadir una unidad: crea el archivo con el mismo formato, importalo aqui,
// pon su `track` y anadelo a UNITS. Despues ejecuta `npm run setup`.
// ---------------------------------------------------------------------------

import sql1 from './sql-1-reading.js';
import sql2 from './sql-2-filtering.js';
import expandedSql from './sql-expanded.js';
import python from './python-course.js';

/** Metadatos de cada track. `speech` indica si tiene audio con SpeechSynthesis. */
export const TRACKS = [
  {
    slug: 'sql',
    title: 'SQL · De cero a consultas avanzadas',
    subtitle: '36 lecciones · consultas, joins, ventanas y proyectos',
    description:
      'Aprende a escribir SQL con datos reales de práctica, misiones de tienda y correcciones ejecutadas en SQLite.',
    contentLang: 'es-ES',
    speech: false,
    termLabel: 'SQL',
    meaningLabel: 'Qué hace',
    color: 'violet',
    icon: 'table',
  },
  { slug: 'python', title: 'Python · Aprende programando',
    subtitle: '36 lecciones · fundamentos, datos, funciones y Python + SQL',
    description: 'Escribe, ejecuta y depura Python con retos cortos, casos límite y proyectos completos.',
    contentLang: 'es-ES', speech: false, termLabel: 'Python', meaningLabel: 'Qué hace',
    color: 'amber', icon: 'book' },
];

export const UNITS = [sql1, sql2, ...expandedSql, ...python];

export const DEFAULT_TRACK = 'sql';
export const CONTENT_VERSION = 'programming-2026-10-v1';

// Logros (comunes a los dos tracks).
export const ACHIEVEMENTS = [
  {
    code: 'first_lesson',
    title: 'First steps',
    description: 'You passed your first lesson.',
    icon: 'seed',
  },
  {
    code: 'five_lessons',
    title: 'Picking up speed',
    description: 'You passed five lessons.',
    icon: 'star',
  },
  {
    code: 'streak_3',
    title: 'Three in a row',
    description: 'You practised three days in a row.',
    icon: 'flame',
  },
];

/** Numeros utiles para comprobar que el contenido esta completo. */
export function contentSummary() {
  const byTrack = {};
  for (const track of TRACKS) {
    const units = UNITS.filter((unit) => (unit.track ?? DEFAULT_TRACK) === track.slug);
    const lessons = units.flatMap((unit) => unit.lessons);
    byTrack[track.slug] = {
      units: units.length,
      lessons: lessons.length,
      exercises: lessons.reduce((total, lesson) => total + lesson.exercises.length, 0),
      vocabulary: units.reduce((total, unit) => total + unit.vocabulary.length, 0),
    };
  }
  const lessons = UNITS.flatMap((unit) => unit.lessons);
  return {
    tracks: TRACKS.length,
    units: UNITS.length,
    lessons: lessons.length,
    exercises: lessons.reduce((total, lesson) => total + lesson.exercises.length, 0),
    vocabulary: UNITS.reduce((total, unit) => total + unit.vocabulary.length, 0),
    byTrack,
  };
}

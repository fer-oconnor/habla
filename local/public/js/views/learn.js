// ---------------------------------------------------------------------------
// Pantalla C: Learn.
// Recorrido de unidades y lecciones con estados bloqueada / disponible /
// completada, XP, racha, objetivo diario y boton para continuar.
// Arriba, un selector entre los dos cursos: Spanish y SQL.
// ---------------------------------------------------------------------------

import { api } from '../api.js?v=programming20261002';
import { el, icon, progressBar } from '../dom.js?v=programming20261002';
import { icons, contentIcon } from '../icons.js?v=programming20261002';
import { t } from '../i18n.js?v=programming20261002';
import { store } from '../store.js?v=programming20261002';
import { toastError } from '../toast.js?v=programming20261002';

const COLOR_CLASS = {
  teal: 'unit--teal', coral: 'unit--coral', amber: 'unit--amber', violet: 'unit--violet',
};

function skeleton() {
  return el('div', { class: 'stack' },
    el('div', { class: 'skeleton' }),
    el('div', { class: 'skeleton' }),
    el('div', { class: 'skeleton' })
  );
}

function goalHero(progress, nextLesson, onStart) {
  const copy = t().learn;
  const today = progress?.today ?? { lessons: 0, goal: 1, goalMet: false };
  const left = Math.max(0, today.goal - today.lessons);

  const bar = progressBar(Math.min(today.lessons, today.goal), today.goal, {
    label: copy.goalTitle,
  });

  const button = el('button', { class: 'btn btn--lg', type: 'button' },
    nextLesson ? copy.continueLesson : copy.switchCourse,
    icon(icons.arrowRight));
  button.addEventListener('click', onStart);
  button.disabled = !nextLesson;

  return el('section', { class: 'hero-goal', 'aria-labelledby': 'goal-title' },
    el('div', { class: 'row row--between' },
      el('div', {},
        el('p', { class: 'faint', text: copy.greeting(store.user?.displayName ?? '') }),
        el('h2', { id: 'goal-title', text: copy.goalTitle })
      ),
      el('span', { class: 'pill' }, copy.goalProgress(today.lessons, today.goal))
    ),
    bar,
    el('p', {
      text: today.goalMet ? copy.goalMet : copy.goalTodo(left),
      class: 'faint',
    }),
    el('div', { class: 'hero-goal__meta' },
      el('div', {}, el('strong', { text: String(progress?.currentStreak ?? 0) }),
        `${t().profile.streak}`),
      el('div', {}, el('strong', { text: String(progress?.xp ?? 0) }), t().profile.xp),
      el('div', {}, el('strong', {
        text: `${progress?.lessonsPassed ?? 0}/${progress?.lessonsTotal ?? 0}`,
      }), t().profile.lessons)
    ),
    nextLesson ? el('p',{class:'faint resume-note',text:nextLesson.inProgress
      ? `Retomar: ${nextLesson.title} · ${nextLesson.inProgress.answered}/${nextLesson.inProgress.total_count} respuestas guardadas`
      : `Siguiente: ${nextLesson.title}`}) : null,
    el('p',{class:'faint',text:'Tu progreso se guarda en este ordenador. Puedes cerrar Habla y continuar después.'}),
    button
  );
}

function trackSwitcher(tracks, active, onSwitch) {
  if (!tracks || tracks.length < 2) return null;
  return el('div', { class: 'stack--tight' },
    el('span', { class: 'pairs__head', text: t().learn.switchCourse }),
    el('div', { class: 'chips', role: 'tablist', 'aria-label': t().learn.switchCourse },
      ...tracks.map((track) => el('button', {
        class: 'chip',
        type: 'button',
        role: 'tab',
        'aria-pressed': String(track.slug === active),
        'aria-selected': String(track.slug === active),
        onClick: () => onSwitch(track.slug),
      },
        icon(contentIcon(track.icon)),
        el('span', { text: track.title }),
        el('span', { class: 'faint', text: `${track.completed}/${track.lessons}` })
      ))
    )
  );
}

function lessonNode(lesson, unitIndex, lessonIndex, onOpen) {
  const copy = t().learn;
  const status = lesson.status;

  const ring = el('span', { class: 'lesson-node__ring', 'aria-hidden': 'true' });
  if (status === 'completed') ring.append(icon(icons.check));
  else if (status === 'locked') ring.append(icon(icons.lock));
  else ring.append(String(lessonIndex + 1));

  const stateLabel = {
    locked: copy.status.locked,
    available: copy.status.available,
    completed: copy.status.completed,
  }[status];

  const pillClass = {
    locked: 'pill', available: 'pill pill--teal', completed: 'pill pill--success',
  }[status];

  const node = el('button', {
    class: `lesson-node lesson-node--${status}`,
    type: 'button',
    disabled: status === 'locked',
    // El texto accesible no depende del color: dice el estado en palabras.
    'aria-label': `${copy.lesson(lessonIndex + 1)}: ${lesson.title}. ${stateLabel}.`,
    title: status === 'locked' ? copy.lockedHint : undefined,
  },
    ring,
    el('span', {},
      el('span', { class: 'lesson-node__title', text: lesson.title }),
      el('br'),
      el('span', { class: 'lesson-node__meta' },
        `${copy.lesson(lessonIndex + 1)} · ${lesson.exerciseCount} ejercicios`,
        lesson.inProgress ? ` · En curso: ${lesson.inProgress.answered}/${lesson.inProgress.total_count}` : '',
        lesson.attempts > 0
          ? ` · ${copy.bestScore(lesson.bestCorrect, lesson.exerciseCount)}`
          : ''
      )
    ),
    el('span', { class: `${pillClass} lesson-node__state`, text: stateLabel })
  );

  if (status !== 'locked') node.addEventListener('click', () => onOpen(lesson));
  return node;
}

export default async function renderLearn({ host, navigate, refreshProgress }) {
  const copy = t().learn;
  const container = el('div', { class: 'stack' });
  host.append(container);
  container.append(skeleton());

  let track = store.user?.activeTrack ?? store.prefs.track ?? 'sql';

  async function load() {
    container.replaceChildren(skeleton());
    try {
      // Si la preferencia guardada apunta a un curso que ya no existe, el
      // servidor responde 400: volvemos al curso por defecto y reintentamos.
      const tracksResponse = await api.tracks();
      if (!tracksResponse.tracks.some((item) => item.slug === track)) {
        track = tracksResponse.tracks[0]?.slug ?? 'sql';
        store.setPref('track', track);
      }
      const [course, progress] = await Promise.all([
        api.units(track),
        store.progress ? Promise.resolve(store.progress) : api.progress(),
      ]);
      store.set({ course, tracks: tracksResponse.tracks, progress, activeTrack: track });
      draw(course, tracksResponse.tracks, progress);
    } catch (error) {
      container.replaceChildren(el('div', { class: 'empty' },
        el('h2', { text: 'We could not load your course' }),
        el('p', { class: 'muted', text: error.message }),
        el('button', { class: 'btn', type: 'button', onClick: load }, t().app.retry)
      ));
      toastError(error, load);
    }
  }

  async function switchTrack(next) {
    if (next === track) return;
    track = next;
    store.setPref('track', next);
    // Guardamos la preferencia tambien en el servidor (sin bloquear la vista).
    api.updateMe({ activeTrack: next })
      .then(({ user }) => store.set({ user }))
      .catch(() => {});
    await load();
  }

  function openLesson(lesson) {
    navigate(`/lesson/${lesson.id}`);
  }

  function draw(course, tracks, progress) {
    const nextLesson = course.nextLesson;

    const pieces = [
      goalHero(progress, nextLesson, () => {
        if (nextLesson) openLesson(nextLesson);
      }),
      trackSwitcher(tracks, track, switchTrack),
    ];

    if (course.track) {
      pieces.push(el('div', { class: 'card card--soft card--flat stack--tight' },
        el('h2', { text: course.track.title }),
        el('p', { class: 'muted', text: course.track.subtitle })
      ));
    }

    if (!nextLesson && course.totals.completed === course.totals.lessons) {
      pieces.push(el('div', { class: 'card card--soft' },
        el('div', { class: 'row' },
          icon(icons.trophy),
          el('p', { class: 'grow', text: copy.courseDone })
        ),
        el('a', { class: 'btn btn--ghost', href: '/practice', 'data-route': '' },
          t().nav.practice)
      ));
    }

    course.units.forEach((unit, unitIndex) => {
      const path = el('ul', { class: 'path' });
      unit.lessons.forEach((lesson, lessonIndex) => {
        path.append(el('li', {}, lessonNode(lesson, unitIndex, lessonIndex, openLesson)));
      });

      pieces.push(el('section', {
        class: `unit ${COLOR_CLASS[unit.color] ?? 'unit--teal'}`,
        'aria-labelledby': `unit-${unit.id}`,
      },
        el('div', { class: 'unit__head' },
          el('span', { class: 'unit__badge', 'aria-hidden': 'true', text: String(unitIndex + 1) }),
          el('div', { class: 'grow' },
            el('h2', { class: 'unit__title', id: `unit-${unit.id}`, text: unit.title }),
            el('span', { class: 'unit__sub', text: unit.subtitle })
          ),
          el('span', {
            class: 'pill',
            text: `${unit.completedLessons}/${unit.lessons.length}`,
          })
        ),
        path
      ));
    });

    container.replaceChildren(...pieces.filter(Boolean));
  }

  await load();
  // Refrescamos el progreso en segundo plano (racha, objetivo del dia).
  refreshProgress().then((progress) => {
    if (progress && store.course) draw(store.course, store.tracks, progress);
  });
}

// ---------------------------------------------------------------------------
// Pantalla E: resultado.
// Aciertos, porcentaje, XP obtenidos y botones para continuar, repetir o
// practicar los errores. Todos los numeros vienen del servidor.
// ---------------------------------------------------------------------------

import { api, ApiError } from '../api.js?v=programming20261002';
import { el, icon } from '../dom.js?v=programming20261002';
import { icons } from '../icons.js?v=programming20261002';
import { t } from '../i18n.js?v=programming20261002';
import { store } from '../store.js?v=programming20261002';
import { toast, toastError } from '../toast.js?v=programming20261002';

const ACHIEVEMENT_ICON = {
  first_lesson: 'seed', five_lessons: 'star', streak_3: 'flame',
};

export default async function renderResult({ host, params, navigate, refreshProgress }) {
  const copy = t().result;
  const attemptId = Number(params[0]);

  host.append(el('div', { class: 'loading' },
    el('div', { class: 'spinner', 'aria-hidden': 'true' }),
    el('p', { text: t().app.loading })
  ));

  let attempt;
  try {
    // POST /complete cierra el intento y calcula el resultado. Es idempotente:
    // si ya estaba cerrado devuelve lo mismo, sin repartir premios otra vez,
    // asi que se puede recargar esta pantalla sin efectos raros.
    let missing = null;
    const completion = await api.complete(attemptId).catch((error) => {
      if (error instanceof ApiError && error.status === 400
          && error.details?.missingExerciseIds?.length) {
        missing = error;
        return null;
      }
      throw error;
    });

    if (missing) {
      // Falta alguna respuesta: volvemos a la leccion a terminarla.
      const pending = await api.attempt(attemptId);
      toast('There is still an exercise to answer.', { kind: 'info' });
      navigate(pending.attempt.lesson
        ? `/lesson/${pending.attempt.lesson.id}`
        : '/practice', { replace: true });
      return;
    }

    const response = await api.attempt(attemptId);
    attempt = response.attempt;
    attempt.newAchievements = completion?.newAchievements ?? [];
  } catch (error) {
    host.replaceChildren(el('div', { class: 'empty' },
      el('h2', { text: 'We could not load that result' }),
      el('p', { class: 'muted', text: error.message }),
      el('a', { class: 'btn', href: '/learn', 'data-route': '' }, copy.backToLearn)
    ));
    toastError(error);
    return;
  }

  const result = attempt.result;
  if (!result) {
    navigate(`/lesson/${attempt.lesson?.id ?? ''}`, { replace: true });
    return;
  }

  await refreshProgress();

  const isPractice = attempt.kind === 'practice';
  const passed = result.passed;
  const wrongCount = result.review.filter((item) => !item.correct).length;

  const title = isPractice
    ? copy.practiceTitle
    : passed ? copy.passedTitle : copy.failedTitle;

  const body = isPractice
    ? t().practice.noXpNote
    : passed
      ? copy.passedBody(result.xpAwarded)
      : copy.failedBody(result.passThreshold ?? 6, result.total);

  // --- Botones -------------------------------------------------------------
  const buttons = [];

  if (!isPractice && passed) {
    const nextBtn = el('button', { class: 'btn btn--lg btn--block', type: 'button' },
      copy.continueBtn, icon(icons.arrowRight));
    nextBtn.addEventListener('click', async () => {
      nextBtn.disabled = true;
      try {
        const course = await api.units(store.activeTrack);
        store.set({ course });
        if (course.nextLesson) navigate(`/lesson/${course.nextLesson.id}`);
        else navigate('/learn');
      } catch (error) {
        toastError(error);
        navigate('/learn');
      }
    });
    buttons.push(nextBtn);
  }

  if (!isPractice) {
    const retryBtn = el('button', {
      class: `btn btn--lg btn--block${passed ? ' btn--ghost' : ''}`,
      type: 'button',
    }, passed ? t().learn.reviewLesson : copy.retryBtn);
    retryBtn.addEventListener('click', () => navigate(`/lesson/${attempt.lesson.id}`));
    buttons.push(retryBtn);
  }

  if (wrongCount > 0 || (store.progress?.pendingReviews ?? 0) > 0) {
    buttons.push(el('a', {
      class: 'btn btn--ghost btn--block', href: '/practice', 'data-route': '',
    }, icon(icons.practice), copy.practiceMistakes));
  }

  buttons.push(el('a', {
    class: 'btn btn--quiet btn--block', href: '/learn', 'data-route': '',
  }, copy.backToLearn));

  // --- Logros nuevos -------------------------------------------------------
  const achievementCards = (attempt.newAchievements ?? []).map((code) => {
    const info = store.progress?.achievements?.find((item) => item.code === code);
    return el('div', { class: 'achievement-pop', role: 'status' },
      icon(icons[ACHIEVEMENT_ICON[code] ?? 'trophy']),
      el('div', {},
        el('div', { class: 'faint', text: copy.newAchievement }),
        el('strong', { text: info?.title ?? code }),
        el('div', { class: 'faint', text: info?.description ?? '' })
      )
    );
  });

  // --- Revision ejercicio por ejercicio ------------------------------------
  const reviewList = el('div', { class: 'review' },
    ...result.review.map((item, index) => el('div', {
      class: `review__item${item.correct ? '' : ' review__item--wrong'}`,
    },
      el('div', { class: 'row row--between' },
        el('span', { class: 'faint', text: `${index + 1}. ${item.prompt}` }),
        el('span', {
          class: `pill ${item.correct ? 'pill--success' : 'pill--coral'}`,
        }, icon(item.correct ? icons.check : icons.cross),
          item.correct ? t().lesson.correct : t().lesson.wrong)
      ),
      item.question ? el('div', { class: 'review__q', text: item.question }) : null,
      el('div', { class: 'review__a' },
        `${t().lesson.yourAnswer} `,
        el('strong', { text: formatAnswer(item.yourAnswer) })
      ),
      item.correct ? null : el('div', { class: 'review__a' },
        `${t().lesson.correctAnswerIs} `,
        el('strong', { class: 'es', text: item.correctAnswer ?? '' })
      ),
      el('div', { class: 'faint', text: item.explanation ?? '' })
    ))
  );

  host.replaceChildren(el('div', { class: 'result' },
    el('img', {
      class: 'result__mascot', src: '/assets/mascot-sun.svg',
      alt: '', width: '96', height: '96',
    }),
    el('h1', { text: title }),
    el('div', { class: 'result__score' }, `${result.correct}/${result.total}`),
    el('p', { class: 'lede', text: body }),
    el('div', { class: 'result__grid' },
      tile(`${result.correct}/${result.total}`, copy.score),
      tile(`${result.percent}%`, copy.accuracy),
      tile(`+${result.xpAwarded}`, copy.xp)
    ),
    ...achievementCards,
    el('div', { class: 'stack' }, ...buttons),
    el('details', { class: 'card card--flat' },
      el('summary', { text: copy.reviewTitle }),
      el('div', { class: 'stack' }, reviewList)
    )
  ));
}

function tile(value, label) {
  return el('div', { class: 'result__tile' },
    el('strong', { text: value }),
    el('span', { text: label })
  );
}

/** Las respuestas pueden ser texto, lista de palabras o parejas. */
function formatAnswer(answer) {
  if (answer === null || answer === undefined) return '—';
  if (Array.isArray(answer)) return answer.join(' ');
  if (typeof answer === 'object') {
    return Object.entries(answer).map(([key, value]) => `${key} = ${value}`).join(' · ');
  }
  return String(answer);
}

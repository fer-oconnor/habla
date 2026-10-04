// ---------------------------------------------------------------------------
// Pantalla F: Practice.
// Sesiones con los errores anteriores del usuario. Si no hay errores, repasa
// contenido ya estudiado. Si tampoco hay nada estudiado, manda a la primera
// leccion. Los repasos no dan XP ni desbloquean (lo decide el servidor).
// ---------------------------------------------------------------------------

import { api, ApiError } from '../api.js?v=studio20261003';
import { el, icon } from '../dom.js?v=studio20261003';
import { icons } from '../icons.js?v=studio20261003';
import { t } from '../i18n.js?v=studio20261003';
import { store } from '../store.js?v=studio20261003';
import { toastError } from '../toast.js?v=studio20261003';
import { buildExercise } from './exercise.js?v=studio20261003';
import * as audio from '../audio.js?v=studio20261003';

export default async function renderPractice({ host, navigate, refreshProgress }) {
  const copy = t().practice;
  const container = el('div', { class: 'stack' });
  host.append(container);

  const progress = store.progress ?? await api.progress().catch(() => null);
  const pending = progress?.pendingReviews ?? 0;

  // --- Portada -------------------------------------------------------------
  function drawIntro() {
    const startBtn = el('button', { class: 'btn btn--lg btn--block', type: 'button' },
      icon(icons.practice), copy.start);
    startBtn.addEventListener('click', () => start(startBtn));

    const byTrack = (progress?.tracks ?? []).filter((track) => track.pendingReviews > 0);

    container.replaceChildren(
      el('header', { class: 'stack--tight' },
        el('h1', { text: copy.title }),
        el('p', { class: 'lede', text: copy.subtitle })
      ),
      el('div', { class: 'card stack' },
        el('div', { class: 'row' },
          el('span', {
            class: pending > 0 ? 'pill pill--coral' : 'pill pill--success',
          }, icon(pending > 0 ? icons.warning : icons.check),
            pending > 0 ? copy.pendingCount(pending) : copy.allClear)
        ),
        el('p', { text: pending > 0 ? copy.fromMistakes(pending) : copy.fromReview }),
        byTrack.length > 0
          ? el('ul', { class: 'benefits' },
              ...byTrack.map((track) => el('li', {},
                icon(icons.arrowRight),
                el('span', { text: `${track.title}: ${track.pendingReviews}` })
              )))
          : null,
        startBtn,
        el('p', { class: 'faint', text: copy.noXpNote })
      )
    );
  }

  function drawNothingToDo() {
    container.replaceChildren(el('div', { class: 'empty' },
      el('img', { src: '/assets/mascot-sun.svg', alt: '', width: '84', height: '84' }),
      el('h1', { text: copy.nothingYet }),
      el('p', { class: 'muted', text: copy.nothingYetBody }),
      el('a', { class: 'btn', href: '/learn', 'data-route': '' },
        copy.goToFirstLesson, icon(icons.arrowRight))
    ));
  }

  async function start(button) {
    button.disabled = true;
    try {
      const response = await api.startPractice();
      runSession(response.attempt, response.practiceSource);
    } catch (error) {
      button.disabled = false;
      if (error instanceof ApiError && error.details?.reason === 'no_practice_content') {
        drawNothingToDo();
        return;
      }
      toastError(error, () => start(button));
    }
  }

  // --- Sesion de repaso ----------------------------------------------------
  function runSession(attempt, source) {
    let cursor = attempt.cursor ?? 0;

    const bar = el('div', { class: 'bar' }, el('div', { class: 'bar__fill bar__fill--amber' }));
    const fill = bar.querySelector('.bar__fill');
    const counter = el('span', { class: 'lesson-top__count', 'aria-live': 'polite' });
    const body = el('div', { class: 'stack' });
    const actions = el('div', { class: 'lesson-actions' });

    container.replaceChildren(
      el('div', { class: 'row row--between' },
        el('span', { class: 'pill pill--amber' }, icon(icons.practice),
          source === 'mistakes' ? 'Your mistakes' : 'Mixed review'),
        el('button', {
          class: 'btn btn--quiet', type: 'button',
          onClick: () => { audio.cancel(); drawIntro(); },
        }, t().app.cancel)
      ),
      el('div', { class: 'row' }, el('div', { class: 'grow' }, bar), counter),
      body,
      actions
    );

    async function step() {
      const exercise = attempt.exercises[cursor];
      counter.textContent = t().lesson.progress(
        Math.min(cursor + 1, attempt.total), attempt.total);
      fill.style.setProperty('width', `${(cursor / attempt.total) * 100}%`);

      if (!exercise) { await finish(); return; }

      const feedbackSlot = el('div', { 'aria-live': 'polite' });
      const widget = buildExercise(exercise, {
        attemptId:attempt.id,
        lang: 'es-ES',
        voiceAvailable: audio.isAvailable('es-ES'),
        onChange: () => { checkBtn.disabled = widget.getAnswer() === null; },
      });

      const checkBtn = el('button', { class: 'btn btn--lg btn--block', type: 'button' },
        t().lesson.check);
      checkBtn.disabled = widget.getAnswer() === null;

      const nextBtn = el('button', { class: 'btn btn--lg btn--block', type: 'button' },
        cursor + 1 >= attempt.total ? t().lesson.finish : t().lesson.continueBtn,
        icon(icons.arrowRight));
      nextBtn.addEventListener('click', () => { cursor += 1; step(); });

      checkBtn.addEventListener('click', async () => {
        const answer = widget.getAnswer();
        if (answer === null) return;
        checkBtn.disabled = true;
        try {
          await widget.flushDraft?.();
          const result = await api.answer(attempt.id, exercise.id, answer);
          widget.showResult(result);
          feedbackSlot.replaceChildren(el('div', {
            class: `feedback feedback--${result.correct ? 'right' : 'wrong'}`,
            role: 'status',
          },
            el('div', { class: 'feedback__head' },
              icon(result.correct ? icons.check : icons.cross),
              el('span', { text: result.correct ? t().lesson.correct : t().lesson.wrong })),
            result.correct ? null : el('p', { class: 'feedback__answer' },
              `${t().lesson.correctAnswerIs} `,
              el('span', { class: 'es', text: result.correctAnswer })),
            el('p', { class: 'feedback__why' },
              el('strong', { text: `${t().lesson.why}: ` }), result.explanation)
          ));
          actions.replaceChildren(nextBtn);
          nextBtn.focus({ preventScroll: true });
        } catch (error) {
          checkBtn.disabled = false;
          toastError(error, () => checkBtn.click());
        }
      });

      body.replaceChildren(el('section', { class: 'exercise' }, widget.node, feedbackSlot));
      actions.replaceChildren(checkBtn);
      widget.focus?.();
    }

    // Igual que en la leccion: cerrar el intento es tarea de /result.
    function finish() {
      navigate(`/result/${attempt.id}`, { replace: true });
    }

    step();
  }

  // --- Entrada -------------------------------------------------------------
  // Si hay un repaso abierto, lo reanudamos; si no, mostramos la portada.
  drawIntro();
}

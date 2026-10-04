// ---------------------------------------------------------------------------
// Pantalla D: la leccion.
//
// Un ejercicio por pantalla, progreso de la sesion, boton Check y explicacion
// despues de enviar. Se puede continuar tras equivocarse.
//
// Reanudar: al entrar se llama a POST /attempts. Si ya habia un intento
// abierto, el servidor devuelve el MISMO intento con las respuestas dadas, y
// esta pantalla salta directamente al primer ejercicio sin responder.
// ---------------------------------------------------------------------------

import { api, ApiError } from '../api.js?v=studio20261003';
import { announce, el, icon, progressBar } from '../dom.js?v=studio20261003';
import { icons } from '../icons.js?v=studio20261003';
import { t } from '../i18n.js?v=studio20261003';
import { toast, toastError } from '../toast.js?v=studio20261003';
import * as audio from '../audio.js?v=studio20261003';
import { buildExercise } from './exercise.js?v=studio20261003';

export default async function renderLesson({ host, params, navigate, refreshProgress }) {
  const copy = t().lesson;
  const lessonId = Number(params[0]);

  const shell = el('div', { class: 'lesson-shell stack' });
  host.append(shell);
  shell.append(el('div', { class: 'loading' },
    el('div', { class: 'spinner', 'aria-hidden': 'true' }),
    el('p', { text: t().app.loading })
  ));

  let lesson = null;
  let attempt = null;
  let cursor = 0;

  // --- Carga ---------------------------------------------------------------
  try {
    const lessonResponse=await api.lesson(lessonId);
    lesson = lessonResponse.lesson;
    const attemptResponse=await api.startLesson(lessonId).catch(async error=>{
      if(!(error instanceof ApiError)||!error.isRetryable) throw error;
      return api.practiceWithoutSaving(lessonId);
    });
    attempt = attemptResponse.attempt;
    cursor = attempt.cursor ?? 0;
    if (attemptResponse.resumed && attempt.answered > 0) {
      announce(copy.resuming);
    }
  } catch (error) {
    shell.replaceChildren(el('div', { class: 'empty' },
      el('h2', { text: 'No se pudo abrir esta lección' }),
      el('p', { class: 'muted', text: error.message }),
      el('button',{class:'btn',type:'button',text:'Volver a intentar',onClick:()=>{shell.remove();renderLesson({host,params,navigate,refreshProgress});}}),
      el('a', { class: 'btn', href: '/learn', 'data-route': '' }, t().result.backToLearn)
    ));
    return;
  }

  // Un intento ya terminado va directo a su resultado.
  if (attempt.status === 'completed') {
    navigate(`/result/${attempt.id}`, { replace: true });
    return;
  }

  const speechLang = lesson.track?.contentLang ?? 'es-ES';
  const trackHasSpeech = lesson.track?.speech !== false;
  await audio.loadVoices();
  const voiceAvailable = trackHasSpeech && audio.isAvailable(speechLang);

  // --- Cabecera ------------------------------------------------------------
  const bar = progressBar(attempt.answered, attempt.total, { label: 'Progreso de esta lección' });
  const counter = el('span', {
    class: 'lesson-top__count',
    'aria-live': 'polite',
    text: copy.progress(Math.min(cursor + 1, attempt.total), attempt.total),
  });

  const quitBtn = el('button', {
    class: 'btn btn--icon btn--quiet',
    type: 'button',
    'aria-label': copy.quit,
    title: copy.quit,
    onClick: () => {
      // Las respuestas ya estan guardadas en el servidor: salir no pierde nada.
      if (attempt.answered === 0 || window.confirm(copy.quitConfirm)) {
        audio.cancel();
        navigate('/learn');
      }
    },
  }, icon(icons.arrowLeft));

  const header = el('div', { class: 'lesson-top' },
    quitBtn,
    el('div', { class: 'grow stack--tight' },el('span',{class:'lesson-context',text:`${lesson.track.title} · ${lesson.title}`}),bar),
    counter
  );

  const body = el('div', { class: 'stack' });
  const actions = el('div', { class: 'lesson-actions' });

  const notice=el('div',{class:'notice notice--warning',role:'status',hidden:!attempt.temporary,text:'Práctica sin guardar. Puedes hacer todos los ejercicios, pero esta ronda no añade progreso ni XP. Tus avances anteriores se conservan. Mantén esta pestaña abierta.'});
  const lessonNav=el('nav',{class:'lesson-navigation','aria-label':'Navegación entre lecciones'},
    lesson.navigation.previous?el('a',{href:`/lesson/${lesson.navigation.previous}`,'data-route':'',text:'← Anterior'}):el('span'),
    el('a',{href:'/learn','data-route':'',text:'Todas las lecciones'}),
    lesson.navigation.next?el('a',{href:`/lesson/${lesson.navigation.next}`,'data-route':'',text:'Siguiente →'}):el('span'));
  shell.replaceChildren(el('a',{class:'lesson-back',href:'/learn','data-route':'',text:'← Todos los cursos'}),header,notice,body,actions,lessonNav);

  // --- Introduccion --------------------------------------------------------
  function showIntro() {
    header.hidden = true;
    const startBtn = el('button', { class: 'btn btn--lg btn--block', type: 'button' },
      copy.startNow, icon(icons.arrowRight));
    startBtn.addEventListener('click', () => {
      header.hidden = false;
      showExercise();
    });

    body.replaceChildren(el('section', { class: 'card intro-card' },
      el('span', { class: 'pill pill--teal', text: lesson.unit.title }),
      el('h1', { text: lesson.title }),
      lesson.intro.title!==lesson.title?el('h2', { class: 'muted', text: lesson.intro.title }):null,
      el('p', { class: 'lede', text: lesson.intro.body }),
      el('div', {},
        el('strong', { text: copy.intro }),
        el('ul', { class: 'intro-card__points' },
          ...lesson.intro.points.map((point) => el('li', { text: point }))
        )
      ),
      el('p', { class: 'faint' },
        `${lesson.exerciseCount} ejercicios · aprueba con ${lesson.passThreshold}/${lesson.exerciseCount}`)
    ));
    actions.replaceChildren(startBtn);
    startBtn.focus({ preventScroll: true });
  }

  // --- Un ejercicio --------------------------------------------------------
  function showExercise() {
    const exercise = attempt.exercises[cursor];
    if (!exercise) { finish(); return; }

    counter.textContent = copy.progress(cursor + 1, attempt.total);
    bar.setValue(attempt.answered);

    const feedbackSlot = el('div', { 'aria-live': 'polite' });

    const widget = buildExercise(exercise, {
      attemptId:attempt.id,
      lang: speechLang,
      voiceAvailable,
      onChange: () => { checkBtn.disabled = widget.getAnswer() === null; },
      onSubmitShortcut: () => { if (!checkBtn.disabled) checkBtn.click(); },
    });

    const checkBtn = el('button', { class: 'btn btn--lg btn--block', type: 'button' },
      copy.check);
    checkBtn.disabled = true;

    const continueBtn = el('button', { class: 'btn btn--lg btn--block', type: 'button' },
      cursor + 1 >= attempt.total ? copy.finish : copy.continueBtn,
      icon(icons.arrowRight));

    /** Dibuja la correccion y cambia Check por Continue. */
    function applyResult(result) {
      widget.showResult(result);
      feedbackSlot.replaceChildren(feedbackCard(result, exercise));
      actions.replaceChildren(continueBtn);
      continueBtn.focus({ preventScroll: true });
      announce(result.correct ? copy.correct : `${copy.wrong}. ${result.correctAnswer}`);
    }

    checkBtn.addEventListener('click', async () => {
      const answer = widget.getAnswer();
      if (answer === null) return;
      checkBtn.disabled = true;
      const previousLabel = checkBtn.textContent;
      checkBtn.textContent = '…';

      try {
        await widget.flushDraft?.();
        const result = await api.answer(attempt.id, exercise.id, answer);
        exercise.answered = true;
        exercise.result = result;
        if (!result.repeated && !attempt.temporary) {
          attempt.answered += 1;
          if (result.correct) attempt.correctSoFar += 1;
        }
        applyResult(result);
      } catch (error) {
        if (error instanceof ApiError && error.isConflict) {
          // Ya habia una respuesta distinta guardada: la recuperamos y la
          // mostramos, para que el servidor siga siendo la fuente de verdad.
          toast(copy.answerSaved, { kind: 'info' });
          try {
            const fresh = await api.attempt(attempt.id);
            attempt = fresh.attempt;
            const stored = attempt.exercises[cursor];
            if (stored?.result) { applyResult(stored.result); return; }
          } catch { /* seguimos al manejo normal */ }
        }
        // El error NO borra lo escrito: el widget mantiene su estado.
        checkBtn.disabled = false;
        checkBtn.textContent = previousLabel;
        toastError(error, () => checkBtn.click());
        if(error instanceof ApiError && error.isRetryable && !attempt.temporary) {
          const temporaryBtn=el('button',{class:'btn btn--ghost',type:'button',text:'Seguir practicando sin guardar',onClick:async()=>{
            temporaryBtn.disabled=true;
            try {const response=await api.practiceWithoutSaving(lessonId,attempt);attempt=response.attempt;notice.hidden=false;temporaryBtn.remove();checkBtn.click();}
            catch(e) {toastError(e);temporaryBtn.disabled=false;}
          }});
          actions.replaceChildren(checkBtn,temporaryBtn);
        }
      }
    });

    continueBtn.addEventListener('click', () => {
      audio.cancel();
      cursor += 1;
      if (cursor >= attempt.total) finish();
      else showExercise();
    });

    body.replaceChildren(el('section', { class: 'exercise' }, widget.node, feedbackSlot));
    actions.replaceChildren(checkBtn);

    // Si el ejercicio ya estaba respondido (reanudando), mostramos su resultado.
    if (exercise.answered && exercise.result) {
      applyResult(exercise.result);
    } else {
      checkBtn.disabled = widget.getAnswer() === null;
      widget.focus?.();
    }
  }

  // --- Final ---------------------------------------------------------------
  // Quien cierra el intento es la pantalla de resultado (POST /complete).
  // Asi el resultado recibe de primera mano los logros recien conseguidos, y
  // recargar /result no reparte premios otra vez (la ruta es idempotente).
  function finish() {
    actions.replaceChildren();
    body.replaceChildren(el('div', { class: 'loading' },
      el('div', { class: 'spinner', 'aria-hidden': 'true' }),
      el('p', { text: 'Calculando tu resultado…' })
    ));
    navigate(`/result/${attempt.id}`, { replace: true });
  }

  /** Tarjeta de correccion: icono + palabra + respuesta correcta + por que. */
  function feedbackCard(result, exercise) {
    const card = el('div', {
      class: `feedback feedback--${result.correct ? 'right' : 'wrong'}`,
      role: result.correct ? 'status' : 'alert',
    },
      el('div', { class: 'feedback__head' },
        icon(result.correct ? icons.check : icons.cross),
        el('span', { text: result.correct ? copy.correct : copy.wrong })
      )
    );

    if (!result.correct) {
      card.append(el('p', { class: 'feedback__answer' },
        el('span', { text: `${copy.correctAnswerIs} ` }),
        el('span', { class: 'es', text: result.correctAnswer })
      ));
    }

    card.append(el('p', { class: 'feedback__why' },
      el('strong', { text: `${copy.why}: ` }),
      result.explanation
    ));

    // Repetir el audio del ejercicio despues de corregir
    if (result.spoken && exercise.type === 'listen_choose' && voiceAvailable) {
      card.append(el('button', {
        class: 'btn btn--quiet',
        type: 'button',
        onClick: () => audio.speak(result.spoken, { lang: speechLang }),
      }, icon(icons.speaker), copy.listenAgain));
    }
    return card;
  }

  // --- Entrada -------------------------------------------------------------
  if (attempt.answered === 0) showIntro();
  else showExercise();

  // Atajo: Enter envia (si hay respuesta) o continua.
  shell.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || ['TEXTAREA','A','SUMMARY','SELECT'].includes(event.target.tagName)) return;
    const primary = actions.querySelector('button:not(:disabled)');
    if (primary && event.target.tagName !== 'BUTTON') {
      event.preventDefault();
      primary.click();
    }
  });
}

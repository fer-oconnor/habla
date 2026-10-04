// ---------------------------------------------------------------------------
// Construccion de los cinco tipos de ejercicio.
//
// Cada constructor devuelve el mismo contrato:
//   { node, getAnswer(), showResult(result), focus?() }
//   * getAnswer() -> null si todavia no hay respuesta valida (Check bloqueado)
//   * showResult() -> bloquea los controles y marca aciertos/fallos con icono
//     Y texto, nunca solo con color.
//
// Audio (solo listen_choose): se usa SpeechSynthesis del navegador. Si no hay
// voz para el idioma, se muestra la ALTERNATIVA DE LECTURA con el texto
// escrito y una etiqueta que lo identifica como tal, y el ejercicio se puede
// terminar igualmente.
// ---------------------------------------------------------------------------

import { el, icon } from '../dom.js?v=studio20261003';
import { icons } from '../icons.js?v=studio20261003';
import { t } from '../i18n.js?v=studio20261003';
import * as audio from '../audio.js?v=studio20261003';
import { buildCodeEditor } from './code-editor.js?v=studio20261003';

/** Cabecera comun: instruccion, frase mostrada y pista. */
function heading(exercise) {
  const parts = [el('p', { class: 'exercise__prompt', text: exercise.prompt })];
  if (exercise.question) {
    parts.push(el('div', { class: 'exercise__question', text: exercise.question }));
  }
  if (exercise.hint) {
    parts.push(el('p', { class: 'exercise__hint' }, icon(icons.info), ' ', exercise.hint));
  }
  return parts;
}

const KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

// --- Elegir una opcion (traduccion o escucha) -------------------------------
function buildChoice(exercise, { onChange, extraTop = [] }) {
  const copy = t().lesson;
  let selected = null;
  const buttons = [];

  const list = el('div', {
    class: 'options',
    role: 'radiogroup',
    'aria-label': copy.chooseOption,
  });

  (exercise.payload.options ?? []).forEach((option, index) => {
    const mark = el('span', { class: 'option__mark', 'aria-hidden': 'true' });
    const button = el('button', {
      class: 'option',
      type: 'button',
      role: 'radio',
      'aria-checked': 'false',
      dataset: { value: option },
    },
      el('span', { class: 'option__key', 'aria-hidden': 'true', text: KEYS[index] ?? '' }),
      el('span', { class: 'grow', text: option }),
      mark
    );

    button.addEventListener('click', () => {
      selected = option;
      // role="radio" usa aria-checked (no aria-pressed, que es para toggles).
      for (const other of buttons) {
        other.setAttribute('aria-checked', String(other === button));
      }
      onChange?.();
    });

    buttons.push(button);
    list.append(button);
  });

  return {
    node: el('div', { class: 'exercise' }, ...extraTop, ...heading(exercise), list),
    getAnswer: () => selected,
    focus: () => buttons[0]?.focus({ preventScroll: true }),
    showResult(result) {
      for (const button of buttons) {
        button.disabled = true;
        const value = button.dataset.value;
        const isChosen = value === result.yourAnswer;
        const isRight = value === result.correctAnswer;

        if (isRight) {
          button.classList.add('option--right');
          button.querySelector('.option__mark').replaceChildren(icon(icons.check));
          button.append(el('span', { class: 'sr-only', text: ' — correct answer' }));
        }
        if (isChosen && !isRight) {
          button.classList.add('option--wrong');
          button.querySelector('.option__mark').replaceChildren(icon(icons.cross));
          button.append(el('span', { class: 'sr-only', text: ' — your answer, incorrect' }));
        }
      }
    },
  };
}

// --- Escuchar y elegir ------------------------------------------------------
function buildListen(exercise, options) {
  const copy = t().lesson;
  const { lang, voiceAvailable } = options;
  const text = exercise.audioText ?? '';

  // Alternativa de lectura, claramente identificada como tal.
  const fallback = el('div', { class: 'audio__fallback', hidden: voiceAvailable },
    el('span', { class: 'audio__fallback-label' },
      icon(icons.book), copy.readingAlternative),
    el('p', { class: 'audio__text es', text }),
    el('p', { class: 'faint', text: copy.readingAlternativeHint })
  );

  const playBtn = el('button', {
    class: 'audio__btn',
    type: 'button',
    'aria-label': copy.listen,
  }, icon(icons.play));

  const slowBtn = el('button', {
    class: 'btn btn--quiet',
    type: 'button',
  }, icon(icons.speakerSlow), copy.listenSlow);

  const status = el('p', { class: 'faint', 'aria-live': 'polite' });

  async function play(rate) {
    playBtn.classList.add('is-speaking');
    const result = await audio.speak(text, {
      lang,
      rate,
      onEnd: () => playBtn.classList.remove('is-speaking'),
    });
    playBtn.classList.remove('is-speaking');

    if (!result.spoken) {
      // El audio ha fallado en marcha: se descubre la alternativa de lectura.
      fallback.hidden = false;
      playBtn.disabled = true;
      slowBtn.disabled = true;
      status.textContent = result.reason === 'muted'
        ? 'Sound is off in your profile — use the written sentence below.'
        : copy.audioUnavailable;
    }
  }

  playBtn.addEventListener('click', () => play(1));
  slowBtn.addEventListener('click', () => play(0.62));

  const panel = el('div', { class: 'audio' },
    voiceAvailable ? playBtn : null,
    voiceAvailable
      ? el('div', { class: 'audio__row' }, slowBtn)
      : null,
    status,
    fallback
  );

  if (!voiceAvailable) {
    status.textContent = copy.audioUnavailable;
  }

  return buildChoice(exercise, { ...options, extraTop: [panel] });
}

// --- Completar la frase -----------------------------------------------------
function buildFillBlank(exercise, { onChange, onSubmitShortcut }) {
  const copy = t().lesson;
  const bank = exercise.payload.bank;
  let value = '';

  const parts = heading(exercise);
  let input = null;
  let chips = [];

  if (Array.isArray(bank) && bank.length > 0) {
    // Con banco de palabras: se elige, no se escribe.
    const list = el('div', { class: 'options', role: 'radiogroup', 'aria-label': copy.chooseOption });
    bank.forEach((option, index) => {
      const mark = el('span', { class: 'option__mark', 'aria-hidden': 'true' });
      const button = el('button', {
        class: 'option', type: 'button', role: 'radio', 'aria-checked': 'false',
        dataset: { value: option },
      },
        el('span', { class: 'option__key', 'aria-hidden': 'true', text: KEYS[index] ?? '' }),
        el('span', { class: 'grow es', text: option }),
        mark
      );
      button.addEventListener('click', () => {
        value = option;
        for (const other of chips) {
          other.setAttribute('aria-checked', String(other === button));
        }
        onChange?.();
      });
      chips.push(button);
      list.append(button);
    });
    parts.push(list);
  } else {
    input = el('input', {
      class: 'input input--big',
      type: 'text',
      id: `answer-${exercise.id}`,
      autocomplete: 'off',
      autocapitalize: 'off',
      spellcheck: 'false',
      placeholder: copy.typeHere,
      'aria-label': copy.typeHere,
      maxlength: '300',
    });
    input.addEventListener('input', () => { value = input.value; onChange?.(); });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); onSubmitShortcut?.(); }
    });
    parts.push(el('div', { class: 'field' }, input));
  }

  return {
    node: el('div', { class: 'exercise' }, ...parts),
    getAnswer: () => (value.trim() === '' ? null : value),
    focus: () => (input ? input.focus({ preventScroll: true }) : chips[0]?.focus({ preventScroll: true })),
    showResult(result) {
      if (input) {
        input.disabled = true;
        input.setAttribute('aria-invalid', String(!result.correct));
      }
      for (const button of chips) {
        button.disabled = true;
        const optionValue = button.dataset.value;
        if (optionValue === result.correctAnswer) {
          button.classList.add('option--right');
          button.querySelector('.option__mark').replaceChildren(icon(icons.check));
        } else if (optionValue === result.yourAnswer) {
          button.classList.add('option--wrong');
          button.querySelector('.option__mark').replaceChildren(icon(icons.cross));
        }
      }
    },
  };
}

// --- Ordenar palabras -------------------------------------------------------
function buildWordOrder(exercise, { onChange }) {
  const copy = t().lesson;
  const tokens = exercise.payload.tokens ?? [];
  const chosen = [];          // indices de `tokens` en el orden elegido

  const sentence = el('div', {
    class: 'tokens',
    role: 'list',
    'aria-label': copy.emptySentence,
  });
  const bank = el('div', { class: 'tokens tokens--bank', role: 'list' });

  function redraw() {
    sentence.replaceChildren();
    if (chosen.length === 0) {
      sentence.append(el('span', { class: 'tokens__empty', text: copy.emptySentence }));
    }
    chosen.forEach((tokenIndex, position) => {
      const button = el('button', {
        class: 'token', type: 'button', role: 'listitem',
        'aria-label': `${tokens[tokenIndex]} — ${copy.tapToRemove}`,
      }, tokens[tokenIndex]);
      button.addEventListener('click', () => {
        chosen.splice(position, 1);
        redraw();
        onChange?.();
      });
      sentence.append(button);
    });

    bank.replaceChildren();
    tokens.forEach((token, tokenIndex) => {
      const used = chosen.includes(tokenIndex);
      const button = el('button', {
        class: 'token', type: 'button', role: 'listitem', disabled: used,
      }, token);
      button.addEventListener('click', () => {
        if (chosen.includes(tokenIndex)) return;
        chosen.push(tokenIndex);
        redraw();
        onChange?.();
      });
      bank.append(button);
    });
  }
  redraw();

  return {
    node: el('div', { class: 'exercise' },
      ...heading(exercise),
      el('p', { class: 'exercise__hint', text: copy.tapWords }),
      sentence,
      bank
    ),
    getAnswer: () => (chosen.length === 0 ? null : chosen.map((index) => tokens[index])),
    focus: () => bank.querySelector('button:not(:disabled)')?.focus({ preventScroll: true }),
    showResult(result) {
      for (const button of [...sentence.querySelectorAll('button'),
        ...bank.querySelectorAll('button')]) {
        button.disabled = true;
      }
      sentence.classList.add(result.correct ? 'is-correct' : 'is-wrong');
    },
  };
}

// --- Emparejar --------------------------------------------------------------
function buildMatchPairs(exercise, { onChange }) {
  const copy = t().lesson;
  const left = exercise.payload.left ?? [];
  const right = exercise.payload.right ?? [];
  const pairs = new Map();          // left -> right
  let pendingLeft = null;

  const leftCol = el('div', { class: 'pairs__col' },
    el('span', { class: 'pairs__head', text: copy.pairsLeft }));
  const rightCol = el('div', { class: 'pairs__col' },
    el('span', { class: 'pairs__head', text: copy.pairsRight }));

  const leftButtons = new Map();
  const rightButtons = new Map();

  function label(item, partner) {
    return partner ? `${item} — ${copy.matched}: ${partner}` : item;
  }

  function redraw() {
    for (const [item, button] of leftButtons) {
      const partner = pairs.get(item);
      button.classList.toggle('pairs__item--matched', Boolean(partner));
      button.setAttribute('aria-pressed', String(pendingLeft === item));
      button.setAttribute('aria-label', label(item, partner));
      const tag = button.querySelector('.pairs__tag');
      if (partner) tag.textContent = partner;
      else tag.textContent = '';
      tag.hidden = !partner;
    }
    for (const [item, button] of rightButtons) {
      const taken = [...pairs.values()].includes(item);
      button.classList.toggle('pairs__item--matched', taken);
    }
  }

  left.forEach((item) => {
    const button = el('button', { class: 'pairs__item', type: 'button', 'aria-pressed': 'false' },
      el('span', { class: 'grow es', text: item }),
      el('span', { class: 'pairs__tag', hidden: true })
    );
    button.addEventListener('click', () => {
      pendingLeft = pendingLeft === item ? null : item;
      if (pairs.has(item)) pairs.delete(item);     // volver a emparejar
      redraw();
      onChange?.();
    });
    leftButtons.set(item, button);
    leftCol.append(button);
  });

  right.forEach((item) => {
    const button = el('button', { class: 'pairs__item', type: 'button' },
      el('span', { class: 'grow', text: item }));
    button.addEventListener('click', () => {
      if (!pendingLeft) return;
      // Un significado solo puede estar en una pareja.
      for (const [key, value] of [...pairs]) if (value === item) pairs.delete(key);
      pairs.set(pendingLeft, item);
      pendingLeft = null;
      redraw();
      onChange?.();
    });
    rightButtons.set(item, button);
    rightCol.append(button);
  });

  redraw();

  return {
    node: el('div', { class: 'exercise' },
      ...heading(exercise),
      el('p', { class: 'exercise__hint', text: copy.matchPairs }),
      el('div', { class: 'pairs' }, leftCol, rightCol)
    ),
    // Solo damos respuesta cuando TODAS las parejas estan hechas.
    getAnswer: () => (pairs.size === left.length && left.length > 0
      ? Object.fromEntries(pairs)
      : null),
    focus: () => leftButtons.values().next().value?.focus({ preventScroll: true }),
    showResult(result) {
      for (const button of [...leftButtons.values(), ...rightButtons.values()]) {
        button.disabled = true;
      }
      const perPair = result.perPair ?? {};
      for (const [item, button] of leftButtons) {
        const ok = perPair[item];
        if (ok === undefined) continue;
        button.classList.remove('pairs__item--matched');
        button.classList.add(ok ? 'pairs__item--right' : 'pairs__item--wrong');
        button.append(icon(ok ? icons.check : icons.cross));
        button.append(el('span', {
          class: 'sr-only',
          text: ok ? ' — correct pair' : ' — incorrect pair',
        }));
      }
    },
  };
}

// --- Punto de entrada -------------------------------------------------------
export function buildExercise(exercise, options = {}) {
  if (exercise.payload.editor) return buildCodeEditor(exercise, options);
  switch (exercise.type) {
    case 'listen_choose': return buildListen(exercise, options);
    case 'choose_translation': return buildChoice(exercise, options);
    case 'fill_blank': return buildFillBlank(exercise, options);
    case 'word_order': return buildWordOrder(exercise, options);
    case 'match_pairs': return buildMatchPairs(exercise, options);
    default:
      return {
        node: el('div', { class: 'empty' },
          el('p', { text: `Unsupported exercise type: ${exercise.type}` })),
        getAnswer: () => null,
        showResult: () => {},
      };
  }
}

export default buildExercise;

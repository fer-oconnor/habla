// ---------------------------------------------------------------------------
// Correccion de ejercicios. SIEMPRE ocurre aqui, en el servidor.
// El frontend nunca recibe la solucion antes de enviar su respuesta.
// ---------------------------------------------------------------------------

import { badRequest } from '../lib/http-error.js';
import { matchesAccepted, normalizeText } from '../lib/normalize.js';
import { evaluateCode } from './code.service.js';

/** Variantes aceptadas de un ejercicio (siempre incluye solution.value). */
function acceptedVariants(solution) {
  const variants = new Set();
  if (solution.value !== undefined && solution.value !== null) {
    variants.add(String(solution.value));
  }
  for (const variant of solution.accepted ?? []) variants.add(String(variant));
  return [...variants];
}

/** Texto legible con la respuesta correcta, para mostrar tras corregir. */
export function correctAnswerText(exercise) {
  const { type, solution } = exercise;
  if (type === 'match_pairs') {
    return Object.entries(solution.pairs ?? {})
      .map(([left, right]) => `${left} = ${right}`)
      .join(' · ');
  }
  return String(solution.value ?? '');
}

function gradeChoice(exercise, answer) {
  if (typeof answer !== 'string') {
    throw badRequest('For this exercise the answer must be the text of the option you chose.');
  }
  const options = exercise.payload.options ?? [];
  const chosen = options.find((option) => String(option).trim().toLowerCase() === answer.trim().toLowerCase());
  if (!chosen) {
    throw badRequest('That option is not one of the choices for this exercise.', {
      options,
    });
  }
  return {
    correct: String(chosen).trim().toLowerCase() === String(exercise.solution.value).trim().toLowerCase(),
    stored: chosen,
  };
}

function gradeFillBlank(exercise, answer) {
  if (exercise.payload.editor) {
    return evaluateCode(exercise, answer).then((execution) => ({
      correct: execution.correct, stored: answer, execution,
    }));
  }
  if (typeof answer !== 'string') {
    throw badRequest('For this exercise the answer must be text.');
  }
  const bank = exercise.payload.bank;
  if (Array.isArray(bank) && bank.length > 0) {
    const chosen = bank.find((option) => String(option).trim().toLowerCase() === answer.trim().toLowerCase());
    if (!chosen) {
      throw badRequest('That word is not one of the options for this exercise.', { bank });
    }
  }
  const correct = Array.isArray(bank) && bank.length
    ? acceptedVariants(exercise.solution).some((value) => value.trim().toLowerCase() === answer.trim().toLowerCase())
    : matchesAccepted(answer, acceptedVariants(exercise.solution)).correct;
  return { correct, stored: answer.trim() };
}

function gradeWordOrder(exercise, answer) {
  const tokens = Array.isArray(answer)
    ? answer
    : typeof answer === 'string'
      ? answer.split(/\s+/).filter(Boolean)
      : null;
  if (!tokens) {
    throw badRequest('For this exercise the answer must be the list of words in order.');
  }

  // Las palabras enviadas tienen que ser las del ejercicio (sin inventar).
  const available = [...(exercise.payload.tokens ?? [])];
  for (const token of tokens) {
    const index = available.findIndex((item) => normalizeText(item) === normalizeText(token));
    if (index === -1) {
      throw badRequest('That answer uses a word that is not part of this exercise.', {
        tokens: exercise.payload.tokens ?? [],
      });
    }
    available.splice(index, 1);
  }

  const sentence = tokens.join(' ');
  const { correct } = matchesAccepted(sentence, acceptedVariants(exercise.solution));
  return { correct, stored: tokens };
}

function gradeMatchPairs(exercise, answer) {
  if (answer === null || typeof answer !== 'object' || Array.isArray(answer)) {
    throw badRequest('For this exercise the answer must be a set of pairs.');
  }
  const left = exercise.payload.left ?? [];
  const right = exercise.payload.right ?? [];
  const pairs = exercise.solution.pairs ?? {};

  const byLeft = new Map();
  for (const [key, value] of Object.entries(answer)) {
    const leftItem = left.find((item) => normalizeText(item) === normalizeText(key));
    const rightItem = right.find((item) => normalizeText(item) === normalizeText(value));
    if (!leftItem || !rightItem) {
      throw badRequest('That answer uses an item that is not part of this exercise.', {
        left,
        right,
      });
    }
    byLeft.set(leftItem, rightItem);
  }

  if (byLeft.size !== left.length) {
    throw badRequest('Match every word before checking.', {
      expectedPairs: left.length,
      receivedPairs: byLeft.size,
    });
  }

  const perPair = {};
  let correct = true;
  for (const leftItem of left) {
    const expected = pairs[leftItem];
    const given = byLeft.get(leftItem);
    const ok = normalizeText(expected) === normalizeText(given);
    perPair[leftItem] = ok;
    if (!ok) correct = false;
  }

  return { correct, stored: Object.fromEntries(byLeft), perPair };
}

/**
 * Corrige una respuesta.
 * @param {object} exercise ejercicio con `payload` y `solution` ya parseados
 * @param {string|string[]|object} answer lo que envio el usuario
 * @returns {{correct: boolean, stored: any, perPair?: object}}
 */
export function gradeAnswer(exercise, answer) {
  switch (exercise.type) {
    case 'choose_translation':
    case 'listen_choose':
      return gradeChoice(exercise, answer);
    case 'fill_blank':
      return gradeFillBlank(exercise, answer);
    case 'word_order':
      return gradeWordOrder(exercise, answer);
    case 'match_pairs':
      return gradeMatchPairs(exercise, answer);
    default:
      throw badRequest(`Unknown exercise type: ${exercise.type}`);
  }
}

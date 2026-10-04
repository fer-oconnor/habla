// Pruebas de la correccion en servidor: mayusculas, espacios, tildes y ñ.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

import { matchesAccepted, normalizeText, foldAccents, answerDigest }
  from '../server/lib/normalize.js';
import { gradeAnswer } from '../server/services/grading.js';

describe('Normalizacion de texto', () => {
  test('ignora mayusculas, espacios de sobra y puntuacion de adorno', () => {
    assert.equal(normalizeText('  ¿Cómo   te llamas?  '), 'cómo te llamas');
    assert.equal(normalizeText('HOLA!'), 'hola');
    assert.equal(normalizeText('La cuenta, por favor.'), 'la cuenta por favor');
  });

  test('conserva la ñ: nunca la convierte en n', () => {
    assert.equal(foldAccents('años'), 'años');
    assert.notEqual(normalizeText('años'), normalizeText('anos'));
  });

  test('quita tildes de las vocales cuando hace falta comparar en modo flexible', () => {
    assert.equal(foldAccents('días'), 'dias');
    assert.equal(foldAccents('estación'), 'estacion');
  });
});

describe('Variantes aceptadas', () => {
  test('acepta la respuesta escrita con cualquier combinacion de mayusculas', () => {
    assert.equal(matchesAccepted('BIEN', ['bien']).correct, true);
    assert.equal(matchesAccepted('  bien  ', ['bien']).correct, true);
  });

  test('perdona la tilde cuando no cambia el significado', () => {
    assert.equal(matchesAccepted('estudio espanol todos los dias',
      ['Estudio español todos los días']).correct, false, 'la ñ si importa');
    assert.equal(matchesAccepted('estudio español todos los dias',
      ['Estudio español todos los días']).correct, true, 'la tilde de "días" se perdona');
  });

  test('exige la tilde cuando cambia el significado', () => {
    // «cuánto» (pregunta) frente a «cuanto» (nexo)
    assert.equal(matchesAccepted('cuanto cuesta', ['¿Cuánto cuesta?']).correct, false);
    assert.equal(matchesAccepted('¿cuánto cuesta?', ['¿Cuánto cuesta?']).correct, true);
    // «cómo» frente a «como»
    assert.equal(matchesAccepted('como te llamas', ['¿Cómo te llamas?']).correct, false);
    assert.equal(matchesAccepted('Cómo te llamas', ['¿Cómo te llamas?']).correct, true);
  });

  test('rechaza «anos» cuando la respuesta es «años»', () => {
    assert.equal(matchesAccepted('tengo once anos', ['Tengo once años']).correct, false);
    assert.equal(matchesAccepted('Tengo once años.', ['Tengo once años']).correct, true);
  });

  test('una respuesta vacia nunca es correcta', () => {
    assert.equal(matchesAccepted('   ', ['bien']).correct, false);
  });
});

describe('Huella de la respuesta (idempotencia)', () => {
  test('el mismo contenido produce la misma huella', () => {
    assert.equal(answerDigest('  Hola '), answerDigest('hola'));
    assert.equal(answerDigest(['a', 'b']), answerDigest(['A', 'B']));
    assert.equal(
      answerDigest({ hola: 'hello', adiós: 'goodbye' }),
      answerDigest({ adiós: 'goodbye', hola: 'hello' }),
      'el orden de las parejas no cambia la huella'
    );
  });

  test('contenido distinto produce huellas distintas', () => {
    assert.notEqual(answerDigest('hola'), answerDigest('adiós'));
    assert.notEqual(answerDigest(['a', 'b']), answerDigest(['b', 'a']));
  });
});

describe('Correccion por tipo de ejercicio', () => {
  const choice = {
    type: 'choose_translation',
    payload: { options: ['Hola', 'Adiós', 'Gracias'] },
    solution: { value: 'Hola' },
  };

  test('choose_translation compara con la opcion correcta', () => {
    assert.equal(gradeAnswer(choice, 'Hola').correct, true);
    assert.equal(gradeAnswer(choice, 'hola').correct, true, 'las mayusculas no importan');
    assert.equal(gradeAnswer(choice, 'Adiós').correct, false);
  });

  test('choose_translation rechaza opciones que no existen', () => {
    assert.throws(() => gradeAnswer(choice, 'Inventado'), /not one of the choices/i);
  });

  test('word_order solo admite las palabras del ejercicio', () => {
    const exercise = {
      type: 'word_order',
      payload: { tokens: ['llamo', 'Hola', 'Marta', 'me'] },
      solution: { value: 'Hola, me llamo Marta', accepted: ['hola me llamo marta'] },
    };
    assert.equal(gradeAnswer(exercise, ['Hola', 'me', 'llamo', 'Marta']).correct, true);
    assert.equal(gradeAnswer(exercise, ['me', 'llamo', 'Marta', 'Hola']).correct, false);
    assert.throws(() => gradeAnswer(exercise, ['Hola', 'inventada']), /not part of this exercise/i);
  });

  test('match_pairs exige todas las parejas antes de corregir', () => {
    const exercise = {
      type: 'match_pairs',
      payload: { left: ['hola', 'adiós'], right: ['goodbye', 'hello'] },
      solution: { pairs: { hola: 'hello', adiós: 'goodbye' } },
    };
    assert.throws(() => gradeAnswer(exercise, { hola: 'hello' }), /Match every word/i);

    const right = gradeAnswer(exercise, { hola: 'hello', adiós: 'goodbye' });
    assert.equal(right.correct, true);
    assert.deepEqual(right.perPair, { hola: true, adiós: true });

    const wrong = gradeAnswer(exercise, { hola: 'goodbye', adiós: 'hello' });
    assert.equal(wrong.correct, false);
    assert.deepEqual(wrong.perPair, { hola: false, adiós: false });
  });

  test('fill_blank con banco de palabras solo acepta esas palabras', () => {
    const exercise = {
      type: 'fill_blank',
      payload: { bank: ['noches', 'días', 'tardes'] },
      solution: { value: 'noches', accepted: ['noches'] },
    };
    assert.equal(gradeAnswer(exercise, 'noches').correct, true);
    assert.equal(gradeAnswer(exercise, 'días').correct, false);
    assert.throws(() => gradeAnswer(exercise, 'semanas'), /not one of the options/i);
  });

  test('fill_blank escrito a mano usa las variantes aceptadas', () => {
    const exercise = {
      type: 'fill_blank',
      payload: {},
      solution: { value: 'bien', accepted: ['bien', 'muy bien'] },
    };
    assert.equal(gradeAnswer(exercise, 'Bien').correct, true);
    assert.equal(gradeAnswer(exercise, 'muy bien').correct, true);
    assert.equal(gradeAnswer(exercise, 'mal').correct, false);
  });
});

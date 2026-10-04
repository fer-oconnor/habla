// Verificacion 7: practicar errores, y que los ejercicios de audio traen el
// texto necesario para la alternativa de lectura cuando la voz no funciona.
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  correctAnswerFor,
  createClient,
  playAttempt,
  signInAsGuest,
  startTestServer,
  wrongAnswerFor,
} from './helpers.js';

let server;
before(async () => { server = await startTestServer(); });
after(async () => { await server.close(); });

async function firstAvailableLesson(client) {
  const units = await client.get('/api/v1/units');
  return units.data.units.flatMap((unit) => unit.lessons)
    .find((lesson) => lesson.status === 'available');
}

describe('Practice', () => {
  test('sin nada estudiado, /attempts practice devuelve 409 con motivo claro', async () => {
    const client = createClient(server.base);
    await signInAsGuest(client, 'Nuevo');
    const response = await client.post('/api/v1/attempts', { kind: 'practice' });

    assert.equal(response.status, 409);
    assert.equal(response.data.error.code, 'conflict');
    assert.equal(response.data.error.details.reason, 'no_practice_content');
    assert.match(response.data.error.message, /first lesson/i);
  });

  test('tras fallar, el repaso trae precisamente esos errores', async () => {
    const client = createClient(server.base);
    await signInAsGuest(client, 'Falla');
    const lesson = await firstAvailableLesson(client);
    const started = await client.post('/api/v1/attempts', { lessonId: lesson.id });
    const attempt = started.data.attempt;

    // Aciertos en los 6 primeros, fallos en los 2 ultimos.
    const missed = [];
    for (let index = 0; index < attempt.exercises.length; index += 1) {
      const exercise = attempt.exercises[index];
      const correct = index < 6;
      if (!correct) missed.push(exercise.id);
      await client.put(`/api/v1/attempts/${attempt.id}/answers/${exercise.id}`, {
        answer: correct ? await correctAnswerFor(exercise) : await wrongAnswerFor(exercise),
      });
    }
    await client.post(`/api/v1/attempts/${attempt.id}/complete`);

    const progress = await client.get('/api/v1/progress');
    assert.equal(progress.data.pendingReviews, 2);

    const practice = await client.post('/api/v1/attempts', { kind: 'practice' });
    assert.equal(practice.status, 201);
    assert.equal(practice.data.practiceSource, 'mistakes');
    assert.equal(practice.data.attempt.kind, 'practice');
    assert.equal(practice.data.attempt.lesson, null);
    assert.equal(practice.data.attempt.exercises.length, 2);
    assert.deepEqual(
      practice.data.attempt.exercises.map((item) => item.id).sort(),
      [...missed].sort()
    );
  });

  test('acertar en el repaso resuelve el error y no da XP ni desbloquea', async () => {
    const client = createClient(server.base);
    await signInAsGuest(client, 'Repasa');
    const lesson = await firstAvailableLesson(client);
    const started = await client.post('/api/v1/attempts', { lessonId: lesson.id });
    // 5 de 8: no aprueba, asi que no desbloquea nada y deja 3 errores.
    await playAttempt(client, started.data.attempt, 5);

    const beforeProgress = await client.get('/api/v1/progress');
    assert.equal(beforeProgress.data.xp, 0);
    assert.equal(beforeProgress.data.pendingReviews, 3);

    const practice = await client.post('/api/v1/attempts', { kind: 'practice' });
    const practiceAttempt = practice.data.attempt;
    for (const exercise of practiceAttempt.exercises) {
      const response = await client.put(
        `/api/v1/attempts/${practiceAttempt.id}/answers/${exercise.id}`,
        { answer: await correctAnswerFor(exercise) }
      );
      assert.equal(response.data.correct, true);
    }
    const done = await client.post(`/api/v1/attempts/${practiceAttempt.id}/complete`);

    assert.equal(done.status, 200);
    assert.equal(done.data.result.kind, 'practice');
    assert.equal(done.data.result.xpAwarded, 0, 'el repaso no da XP');
    assert.equal(done.data.result.correct, practiceAttempt.exercises.length);

    const after = await client.get('/api/v1/progress');
    assert.equal(after.data.xp, 0, 'sigue sin XP');
    assert.equal(after.data.pendingReviews, 0, 'los errores quedan resueltos');
    assert.equal(after.data.today.lessons, 0, 'el repaso no cuenta para el objetivo');

    const units = await client.get('/api/v1/units');
    const all = units.data.units.flatMap((unit) => unit.lessons);
    assert.equal(all[1].status, 'locked', 'el repaso no desbloquea lecciones');
  });

  test('sin errores pendientes, el repaso usa contenido ya estudiado', async () => {
    const client = createClient(server.base);
    await signInAsGuest(client, 'Perfecto');
    const lesson = await firstAvailableLesson(client);
    const started = await client.post('/api/v1/attempts', { lessonId: lesson.id });
    await playAttempt(client, started.data.attempt, 8);   // 8 de 8, sin errores

    const progress = await client.get('/api/v1/progress');
    assert.equal(progress.data.pendingReviews, 0);

    const practice = await client.post('/api/v1/attempts', { kind: 'practice' });
    assert.equal(practice.status, 201);
    assert.equal(practice.data.practiceSource, 'review');
    assert.equal(practice.data.attempt.exercises.length, 8);
    // Todos los ejercicios vienen de la leccion que ya estudio.
    const ids = new Set(started.data.attempt.exercises.map((item) => item.id));
    assert.ok(practice.data.attempt.exercises.every((item) => ids.has(item.id)));
  });

  test('un repaso abierto se reanuda en lugar de crear otro', async () => {
    const client = createClient(server.base);
    await signInAsGuest(client, 'Reanuda');
    const lesson = await firstAvailableLesson(client);
    const started = await client.post('/api/v1/attempts', { lessonId: lesson.id });
    await playAttempt(client, started.data.attempt, 8);

    const first = await client.post('/api/v1/attempts', { kind: 'practice' });
    const second = await client.post('/api/v1/attempts', { kind: 'practice' });
    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    assert.equal(second.data.resumed, true);
    assert.equal(second.data.attempt.id, first.data.attempt.id);
  });
});

describe('Catálogo de práctica', () => {
  test('el curso SQL no contiene ejercicios de escucha', async () => {
    const client = createClient(server.base);
    await signInAsGuest(client, 'Audio');
    const lesson = await firstAvailableLesson(client);
    const started = await client.post('/api/v1/attempts', { lessonId: lesson.id });

    const listening = started.data.attempt.exercises
      .filter((exercise) => exercise.type === 'listen_choose');
    assert.equal(listening.length, 0, 'SQL ya no contiene enseñanza de idiomas');

    for (const exercise of listening) {
      // `audioText` es lo que permite: (a) hablar con SpeechSynthesis y
      // (b) mostrar la alternativa de lectura si no hay voz disponible.
      assert.ok(typeof exercise.audioText === 'string' && exercise.audioText.length > 0);
      assert.ok(Array.isArray(exercise.payload.options) && exercise.payload.options.length >= 2);
      // Se puede terminar el ejercicio sin audio: las opciones bastan.
      const response = await client.put(
        `/api/v1/attempts/${started.data.attempt.id}/answers/${exercise.id}`,
        { answer: await correctAnswerFor(exercise) }
      );
      assert.equal(response.status, 200);
      assert.equal(response.data.correct, true);
      assert.equal(response.data.spoken, exercise.audioText);
    }
  });

  test('el vocabulario trae términos y ejemplos para el repaso', async () => {
    const client = createClient(server.base);
    await signInAsGuest(client, 'Palabras');
    const lesson = await firstAvailableLesson(client);
    const started = await client.post('/api/v1/attempts', { lessonId: lesson.id });
    await playAttempt(client, started.data.attempt, 8);

    const words = await client.get('/api/v1/vocabulary');
    assert.ok(words.data.total > 0);
    for (const word of words.data.words) {
      assert.ok(word.es.length > 0, 'termino disponible para repasar');
      assert.ok(word.exampleEs.length > 0, 'ejemplo disponible para repasar');
    }
  });
});

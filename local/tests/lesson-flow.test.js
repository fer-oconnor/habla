// Verificaciones 3 y 4: terminar una leccion con correcciones reales,
// desbloqueos, y que todo sigue ahi tras reiniciar el servidor.
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

async function firstLesson(client) {
  const { data } = await client.get('/api/v1/units');
  return data.units[0].lessons[0];
}

describe('Recorrido de una leccion', () => {
  test('GET /units: 12 unidades, 36 lecciones, solo la primera disponible', async () => {
    const client = createClient(server.base);
    await signInAsGuest(client);
    const { status, data } = await client.get('/api/v1/units');

    assert.equal(status, 200);
    assert.equal(data.units.length, 12);
    assert.equal(data.totals.lessons, 36);
    assert.equal(data.totals.completed, 0);

    const all = data.units.flatMap((unit) => unit.lessons);
    assert.equal(all[0].status, 'available', 'la primera leccion esta disponible desde el principio');
    assert.equal(all.filter((lesson) => lesson.status === 'available').length, 1);
    assert.equal(all.filter((lesson) => lesson.status === 'locked').length, 35);
    assert.ok(all.every((lesson) => lesson.exerciseCount === 8));
  });

  test('una leccion bloqueada devuelve 403 aunque se llame directamente a la API', async () => {
    const client = createClient(server.base);
    await signInAsGuest(client);
    const { data } = await client.get('/api/v1/units');
    const locked = data.units[0].lessons[1];

    const lesson = await client.get(`/api/v1/lessons/${locked.id}`);
    assert.equal(lesson.status, 403);
    assert.equal(lesson.data.error.code, 'forbidden');

    const attempt = await client.post('/api/v1/attempts', { lessonId: locked.id });
    assert.equal(attempt.status, 403, 'tampoco se puede empezar un intento');
  });

  test('GET /lessons/:id trae la introduccion pero no las soluciones', async () => {
    const client = createClient(server.base);
    await signInAsGuest(client);
    const lesson = await firstLesson(client);
    const { status, data } = await client.get(`/api/v1/lessons/${lesson.id}`);

    assert.equal(status, 200);
    assert.ok(data.lesson.intro.title.length > 0);
    assert.ok(data.lesson.intro.body.length > 0);
    assert.ok(Array.isArray(data.lesson.intro.points) && data.lesson.intro.points.length > 0);
    assert.equal(data.lesson.exerciseCount, 8);
    assert.equal(data.lesson.passThreshold, 6);
    assert.equal(JSON.stringify(data).includes('"solution"'), false);
  });

  test('POST /attempts entrega los ejercicios SIN solucion ni explicacion', async () => {
    const client = createClient(server.base);
    await signInAsGuest(client);
    const lesson = await firstLesson(client);
    const { status, data } = await client.post('/api/v1/attempts', { lessonId: lesson.id });

    assert.equal(status, 201);
    assert.equal(data.attempt.exercises.length, 8);
    const serialized = JSON.stringify(data);
    assert.equal(serialized.includes('"solution"'), false);
    assert.equal(serialized.includes('"explanation"'), false);

    for (const exercise of data.attempt.exercises) {
      assert.ok(exercise.prompt.length > 0);
      assert.equal(exercise.answered, false);
      assert.equal(exercise.result, undefined);
      if (exercise.type === 'listen_choose') {
        assert.ok(exercise.audioText, 'los ejercicios de audio traen el texto que lee el navegador');
      }
    }
    const types = new Set(data.attempt.exercises.map((exercise) => exercise.type));
    assert.ok(types.size >= 3, `la leccion usa ${types.size} tipos de ejercicio`);
  });

  test('cada respuesta recibe correccion real y explicacion', async () => {
    const client = createClient(server.base);
    await signInAsGuest(client);
    const lesson = await firstLesson(client);
    const { data } = await client.post('/api/v1/attempts', { lessonId: lesson.id });
    const attempt = data.attempt;

    const good = attempt.exercises[0];
    const right = await client.put(
      `/api/v1/attempts/${attempt.id}/answers/${good.id}`,
      { answer: await correctAnswerFor(good) }
    );
    assert.equal(right.status, 200);
    assert.equal(right.data.correct, true);
    assert.ok(right.data.explanation.length > 0);
    assert.equal(right.data.progress.answered, 1);

    const bad = attempt.exercises[1];
    const wrong = await client.put(
      `/api/v1/attempts/${attempt.id}/answers/${bad.id}`,
      { answer: await wrongAnswerFor(bad) }
    );
    assert.equal(wrong.status, 200);
    assert.equal(wrong.data.correct, false);
    assert.ok(wrong.data.correctAnswer.length > 0, 'se muestra la respuesta correcta');
    assert.ok(wrong.data.explanation.length > 0);
    assert.equal(wrong.data.progress.correctSoFar, 1);
  });

  test('una opcion inventada se rechaza con 400', async () => {
    const client = createClient(server.base);
    await signInAsGuest(client);
    const lesson = await firstLesson(client);
    const { data } = await client.post('/api/v1/attempts', { lessonId: lesson.id });
    const exercise = data.attempt.exercises.find((item) => item.type === 'choose_translation');

    const response = await client.put(
      `/api/v1/attempts/${data.attempt.id}/answers/${exercise.id}`,
      { answer: 'esto-no-es-una-opcion' }
    );
    assert.equal(response.status, 400);
    assert.equal(response.data.error.code, 'bad_request');
  });

  test('no se puede finalizar si faltan respuestas', async () => {
    const client = createClient(server.base);
    await signInAsGuest(client);
    const lesson = await firstLesson(client);
    const { data } = await client.post('/api/v1/attempts', { lessonId: lesson.id });
    const attempt = data.attempt;

    const exercise = attempt.exercises[0];
    await client.put(`/api/v1/attempts/${attempt.id}/answers/${exercise.id}`, {
      answer: await correctAnswerFor(exercise),
    });

    const early = await client.post(`/api/v1/attempts/${attempt.id}/complete`);
    assert.equal(early.status, 400);
    assert.equal(early.data.error.details.missingExerciseIds.length, 7);
  });

  test('recargar reanuda el mismo intento con las respuestas ya dadas', async () => {
    const client = createClient(server.base);
    await signInAsGuest(client);
    const lesson = await firstLesson(client);
    const started = await client.post('/api/v1/attempts', { lessonId: lesson.id });
    const attempt = started.data.attempt;

    for (let index = 0; index < 3; index += 1) {
      const exercise = attempt.exercises[index];
      await client.put(`/api/v1/attempts/${attempt.id}/answers/${exercise.id}`, {
        answer: await correctAnswerFor(exercise),
      });
    }

    // "Recargar la pagina": pedir el intento otra vez
    const resumed = await client.get(`/api/v1/attempts/${attempt.id}`);
    assert.equal(resumed.status, 200);
    assert.equal(resumed.data.attempt.answered, 3);
    assert.equal(resumed.data.attempt.cursor, 3, 'sigue en el ejercicio 4');
    assert.equal(resumed.data.attempt.exercises[0].answered, true);
    assert.ok(resumed.data.attempt.exercises[0].result.explanation);
    assert.equal(resumed.data.attempt.exercises[3].answered, false);

    // Y empezar un intento otra vez devuelve el MISMO intento abierto
    const again = await client.post('/api/v1/attempts', { lessonId: lesson.id });
    assert.equal(again.status, 200);
    assert.equal(again.data.resumed, true);
    assert.equal(again.data.attempt.id, attempt.id);
  });

  test('6 de 8 aprueba, da 10 XP y desbloquea la leccion siguiente', async () => {
    const client = createClient(server.base);
    await signInAsGuest(client);
    const lesson = await firstLesson(client);
    const started = await client.post('/api/v1/attempts', { lessonId: lesson.id });
    const { completed } = await playAttempt(client, started.data.attempt, 6);

    assert.equal(completed.status, 200);
    assert.equal(completed.data.result.correct, 6);
    assert.equal(completed.data.result.total, 8);
    assert.equal(completed.data.result.percent, 75);
    assert.equal(completed.data.result.passed, true);
    assert.equal(completed.data.result.xpAwarded, 10);
    assert.equal(completed.data.result.review.length, 8);
    assert.ok(completed.data.newAchievements.includes('first_lesson'));

    const units = await client.get('/api/v1/units');
    const all = units.data.units.flatMap((unit) => unit.lessons);
    assert.equal(all[0].status, 'completed');
    assert.equal(all[1].status, 'available', 'la segunda leccion ya esta desbloqueada');
    assert.equal(all[2].status, 'locked');

    const progress = await client.get('/api/v1/progress');
    assert.equal(progress.data.xp, 10);
    assert.equal(progress.data.lessonsPassed, 1);
    assert.equal(progress.data.currentStreak, 1);
    assert.equal(progress.data.today.lessons, 1);
    assert.equal(progress.data.today.goalMet, true);
  });

  test('5 de 8 no aprueba, pero se puede ver el resultado y no desbloquea', async () => {
    const client = createClient(server.base);
    await signInAsGuest(client);
    const lesson = await firstLesson(client);
    const started = await client.post('/api/v1/attempts', { lessonId: lesson.id });
    const { completed } = await playAttempt(client, started.data.attempt, 5);

    assert.equal(completed.status, 200);
    assert.equal(completed.data.result.correct, 5);
    assert.equal(completed.data.result.passed, false);
    assert.equal(completed.data.result.xpAwarded, 0);

    const units = await client.get('/api/v1/units');
    const all = units.data.units.flatMap((unit) => unit.lessons);
    assert.equal(all[0].status, 'available', 'la leccion sigue disponible para repetirla');
    assert.equal(all[1].status, 'locked', 'la siguiente NO se desbloquea');

    const progress = await client.get('/api/v1/progress');
    assert.equal(progress.data.xp, 0);
    assert.equal(progress.data.currentStreak, 0);
  });

  test('repetir una leccion ya superada no vuelve a dar XP', async () => {
    const client = createClient(server.base);
    await signInAsGuest(client);
    const lesson = await firstLesson(client);

    const first = await client.post('/api/v1/attempts', { lessonId: lesson.id });
    await playAttempt(client, first.data.attempt, 8);
    const afterFirst = await client.get('/api/v1/progress');
    assert.equal(afterFirst.data.xp, 10);

    const second = await client.post('/api/v1/attempts', { lessonId: lesson.id });
    assert.equal(second.status, 201, 'un intento nuevo, porque el anterior ya se cerro');
    const { completed } = await playAttempt(client, second.data.attempt, 8);
    assert.equal(completed.data.result.passed, true);
    assert.equal(completed.data.result.xpAwarded, 0, 'sin XP la segunda vez');

    const afterSecond = await client.get('/api/v1/progress');
    assert.equal(afterSecond.data.xp, 10, 'los XP no cambian');
    assert.equal(afterSecond.data.today.lessons, 1, 'la misma leccion cuenta una vez al dia');
  });

  test('el vocabulario aparece solo despues de haberlo encontrado', async () => {
    const client = createClient(server.base);
    await signInAsGuest(client);

    const before = await client.get('/api/v1/vocabulary');
    assert.equal(before.data.total, 0, 'al principio no hay palabras');

    const lesson = await firstLesson(client);
    const started = await client.post('/api/v1/attempts', { lessonId: lesson.id });
    await playAttempt(client, started.data.attempt, 8);

    const after = await client.get('/api/v1/vocabulary');
    assert.ok(after.data.total > 0, `se guardaron ${after.data.total} palabras`);
    assert.ok(after.data.words[0].es);
    assert.ok(after.data.words[0].en);
    assert.ok(after.data.words[0].exampleEs, 'cada palabra trae un ejemplo para el audio');
    assert.ok(after.data.units.length >= 1, 'hay unidades para el filtro');

    const filtered = await client.get('/api/v1/vocabulary?search=hola');
    assert.ok(filtered.data.words.every((word) =>
      `${word.es} ${word.en}`.toLowerCase().includes('hola')));
  });
});

// Verificaciones 2 y 5: progreso independiente entre usuarios, sin acceso a
// intentos ajenos, y peticiones duplicadas sin premios extra.
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

describe('Aislamiento entre usuarios', () => {
  test('dos usuarios tienen progreso independiente', async () => {
    const ana = createClient(server.base);
    const luis = createClient(server.base);
    await signInAsGuest(ana, 'Ana');
    await signInAsGuest(luis, 'Luis');

    const units = await ana.get('/api/v1/units');
    const lesson = units.data.units[0].lessons[0];

    const started = await ana.post('/api/v1/attempts', { lessonId: lesson.id });
    await playAttempt(ana, started.data.attempt, 8);

    const anaProgress = await ana.get('/api/v1/progress');
    const luisProgress = await luis.get('/api/v1/progress');
    assert.equal(anaProgress.data.xp, 10);
    assert.equal(luisProgress.data.xp, 0, 'el progreso de Ana no toca a Luis');
    assert.equal(luisProgress.data.lessonsPassed, 0);

    const luisUnits = await luis.get('/api/v1/units');
    const luisLessons = luisUnits.data.units.flatMap((unit) => unit.lessons);
    assert.equal(luisLessons[0].status, 'available');
    assert.equal(luisLessons[1].status, 'locked', 'Luis no hereda el desbloqueo de Ana');

    const luisWords = await luis.get('/api/v1/vocabulary');
    assert.equal(luisWords.data.total, 0);
  });

  test('un usuario no puede leer ni responder el intento de otro', async () => {
    const ana = createClient(server.base);
    const luis = createClient(server.base);
    await signInAsGuest(ana, 'Ana2');
    await signInAsGuest(luis, 'Luis2');

    const units = await ana.get('/api/v1/units');
    const lesson = units.data.units[0].lessons[0];
    const started = await ana.post('/api/v1/attempts', { lessonId: lesson.id });
    const attempt = started.data.attempt;

    const read = await luis.get(`/api/v1/attempts/${attempt.id}`);
    assert.equal(read.status, 404, 'no revelamos ni que existe');

    const write = await luis.put(
      `/api/v1/attempts/${attempt.id}/answers/${attempt.exercises[0].id}`,
      { answer: await correctAnswerFor(attempt.exercises[0]) }
    );
    assert.equal(write.status, 404);

    const finish = await luis.post(`/api/v1/attempts/${attempt.id}/complete`);
    assert.equal(finish.status, 404);

    // Y el intento de Ana sigue intacto
    const anaRead = await ana.get(`/api/v1/attempts/${attempt.id}`);
    assert.equal(anaRead.status, 200);
    assert.equal(anaRead.data.attempt.answered, 0);
  });

  test('sin sesion no se accede a ningun recurso protegido', async () => {
    const anonymous = createClient(server.base);
    for (const path of ['/api/v1/units', '/api/v1/progress', '/api/v1/vocabulary',
      '/api/v1/attempts/1', '/api/v1/lessons/1']) {
      const response = await anonymous.get(path);
      assert.equal(response.status, 401, `${path} deberia pedir sesion`);
    }
  });
});

describe('Peticiones duplicadas', () => {
  test('reenviar la MISMA respuesta devuelve el mismo resultado', async () => {
    const client = createClient(server.base);
    await signInAsGuest(client, 'Dupe');
    const units = await client.get('/api/v1/units');
    const lesson = units.data.units[0].lessons[0];
    const started = await client.post('/api/v1/attempts', { lessonId: lesson.id });
    const attempt = started.data.attempt;
    const exercise = attempt.exercises[0];
    const answer = await correctAnswerFor(exercise);

    const first = await client.put(
      `/api/v1/attempts/${attempt.id}/answers/${exercise.id}`, { answer });
    const second = await client.put(
      `/api/v1/attempts/${attempt.id}/answers/${exercise.id}`, { answer });

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(second.data.correct, first.data.correct);
    assert.equal(second.data.repeated, true);
    assert.equal(second.data.answeredAt, first.data.answeredAt, 'no se sobrescribe');

    const reread = await client.get(`/api/v1/attempts/${attempt.id}`);
    assert.equal(reread.data.attempt.answered, 1, 'sigue habiendo una sola respuesta');
  });

  test('cambiar una respuesta ya enviada se rechaza con 409', async () => {
    const client = createClient(server.base);
    await signInAsGuest(client, 'Dupe2');
    const units = await client.get('/api/v1/units');
    const lesson = units.data.units[0].lessons[0];
    const started = await client.post('/api/v1/attempts', { lessonId: lesson.id });
    const attempt = started.data.attempt;
    const exercise = attempt.exercises[0];

    await client.put(`/api/v1/attempts/${attempt.id}/answers/${exercise.id}`,
      { answer: await wrongAnswerFor(exercise) });
    const change = await client.put(`/api/v1/attempts/${attempt.id}/answers/${exercise.id}`,
      { answer: await correctAnswerFor(exercise) });

    assert.equal(change.status, 409);
    assert.equal(change.data.error.code, 'conflict');

    const reread = await client.get(`/api/v1/attempts/${attempt.id}`);
    assert.equal(reread.data.attempt.exercises[0].result.correct, false,
      'se conserva la primera respuesta');
  });

  test('finalizar dos veces no duplica XP, actividad ni logros', async () => {
    const client = createClient(server.base);
    await signInAsGuest(client, 'Dupe3');
    const units = await client.get('/api/v1/units');
    const lesson = units.data.units[0].lessons[0];
    const started = await client.post('/api/v1/attempts', { lessonId: lesson.id });
    const attempt = started.data.attempt;

    for (const exercise of attempt.exercises) {
      await client.put(`/api/v1/attempts/${attempt.id}/answers/${exercise.id}`,
        { answer: await correctAnswerFor(exercise) });
    }

    const first = await client.post(`/api/v1/attempts/${attempt.id}/complete`);
    const second = await client.post(`/api/v1/attempts/${attempt.id}/complete`);
    const third = await client.post(`/api/v1/attempts/${attempt.id}/complete`);

    assert.equal(first.status, 200);
    assert.equal(first.data.alreadyCompleted, false);
    assert.equal(first.data.result.xpAwarded, 10);

    for (const repeat of [second, third]) {
      assert.equal(repeat.status, 200);
      assert.equal(repeat.data.alreadyCompleted, true);
      assert.equal(repeat.data.result.xpAwarded, 10, 'mismo resultado, no un premio nuevo');
      assert.equal(repeat.data.result.correct, first.data.result.correct);
      assert.deepEqual(repeat.data.newAchievements, []);
    }

    const progress = await client.get('/api/v1/progress');
    assert.equal(progress.data.xp, 10, 'los XP no se duplican');
    assert.equal(progress.data.lessonsPassed, 1);
    assert.equal(progress.data.today.lessons, 1);
    assert.equal(progress.data.today.xp, 10);
    assert.equal(progress.data.currentStreak, 1, 'la racha no sube dos veces');

    const earned = progress.data.achievements.filter((item) => item.earned);
    assert.equal(earned.length, 1);
    assert.equal(earned[0].code, 'first_lesson');
  });

  test('no se puede responder un ejercicio nuevo en un intento ya cerrado', async () => {
    const client = createClient(server.base);
    await signInAsGuest(client, 'Dupe4');
    const units = await client.get('/api/v1/units');
    const lesson = units.data.units[0].lessons[0];
    const started = await client.post('/api/v1/attempts', { lessonId: lesson.id });
    const attempt = started.data.attempt;
    await playAttempt(client, attempt, 8);

    // El ejercicio existe en el intento pero ya esta respondido; probamos con
    // uno que NO pertenece al intento.
    const otherUnits = await client.get('/api/v1/units');
    const nextLesson = otherUnits.data.units[0].lessons[1];
    const nextAttempt = await client.post('/api/v1/attempts', { lessonId: nextLesson.id });
    const foreignExercise = nextAttempt.data.attempt.exercises[0];

    const response = await client.put(
      `/api/v1/attempts/${attempt.id}/answers/${foreignExercise.id}`,
      { answer: 'lo que sea' }
    );
    assert.equal(response.status, 400);
    assert.match(response.data.error.message, /not part of this attempt/i);
  });

  test('cinco lecciones superadas conceden el logro correspondiente', async () => {
    const client = createClient(server.base);
    await signInAsGuest(client, 'Cinco');
    let earnedFive = false;

    for (let step = 0; step < 5; step += 1) {
      const units = await client.get('/api/v1/units');
      const next = units.data.units.flatMap((unit) => unit.lessons)
        .find((lesson) => lesson.status === 'available');
      assert.ok(next, 'siempre hay una leccion disponible');
      const started = await client.post('/api/v1/attempts', { lessonId: next.id });
      const { completed } = await playAttempt(client, started.data.attempt, 8);
      assert.equal(completed.data.result.passed, true);
      if (completed.data.newAchievements.includes('five_lessons')) earnedFive = true;
    }

    assert.equal(earnedFive, true, 'el logro llega en la quinta leccion');
    const progress = await client.get('/api/v1/progress');
    assert.equal(progress.data.xp, 50);
    assert.equal(progress.data.lessonsPassed, 5);
    assert.equal(progress.data.today.lessons, 5, '5 lecciones distintas hoy');
  });
});

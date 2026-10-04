// Los dos cursos (python y sql) son independientes: cada uno con su
// recorrido, sus desbloqueos y su primera leccion abierta desde el principio.
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createClient, playAttempt, signInAsGuest, startTestServer } from './helpers.js';

let server;
before(async () => { server = await startTestServer(); });
after(async () => { await server.close(); });

describe('Rutas de aprendizaje', () => {
  test('GET /tracks lista los dos cursos con su avance', async () => {
    const client = createClient(server.base);
    await signInAsGuest(client, 'Tracks');
    const { status, data } = await client.get('/api/v1/tracks');

    assert.equal(status, 200);
    assert.equal(data.tracks.length, 2);
    assert.equal(data.activeTrack, 'sql');

    const python = data.tracks.find((track) => track.slug === 'python');
    const sql = data.tracks.find((track) => track.slug === 'sql');
    assert.equal(python.lessons, 36);
    assert.equal(sql.lessons, 36);
    assert.equal(python.completed, 0);
    assert.equal(python.speech, false, 'Python no tiene audio');
    assert.equal(sql.speech, false, 'SQL no usa audio');
    assert.equal(sql.termLabel, 'SQL');
  });

  test('el curso de SQL tiene su propia primera leccion disponible', async () => {
    const client = createClient(server.base);
    await signInAsGuest(client, 'SqlLearner');
    const { status, data } = await client.get('/api/v1/units?track=sql');

    assert.equal(status, 200);
    assert.equal(data.track.slug, 'sql');
    assert.equal(data.units.length, 12);
    assert.equal(data.totals.lessons, 36);

    const all = data.units.flatMap((unit) => unit.lessons);
    assert.equal(all[0].status, 'available', 'se puede empezar SQL sin tocar Python');
    assert.equal(all.filter((lesson) => lesson.status === 'locked').length, 35);
    assert.ok(all.every((lesson) => lesson.exerciseCount === 8));
  });

  test('avanzar en SQL no desbloquea Python (y al contrario)', async () => {
    const client = createClient(server.base);
    await signInAsGuest(client, 'Both');

    const sqlUnits = await client.get('/api/v1/units?track=sql');
    const firstSql = sqlUnits.data.units[0].lessons[0];
    const started = await client.post('/api/v1/attempts', { lessonId: firstSql.id });
    const { completed } = await playAttempt(client, started.data.attempt, 8);
    assert.equal(completed.data.result.passed, true);
    assert.equal(completed.data.result.xpAwarded, 10, 'SQL tambien da XP');

    const sqlAfter = await client.get('/api/v1/units?track=sql');
    const sqlLessons = sqlAfter.data.units.flatMap((unit) => unit.lessons);
    assert.equal(sqlLessons[0].status, 'completed');
    assert.equal(sqlLessons[1].status, 'available');

    const pythonAfter = await client.get('/api/v1/units?track=python');
    const pythonLessons = pythonAfter.data.units.flatMap((unit) => unit.lessons);
    assert.equal(pythonLessons[0].status, 'available', 'Python sigue en su leccion 1');
    assert.equal(pythonLessons[1].status, 'locked');

    // El XP y la racha son comunes a los dos cursos.
    const progress = await client.get('/api/v1/progress');
    assert.equal(progress.data.xp, 10);
    assert.equal(progress.data.lessonsPassed, 1);
    assert.equal(progress.data.tracks.length, 2);
    assert.equal(progress.data.tracks.find((t) => t.slug === 'sql').completed, 1);
    assert.equal(progress.data.tracks.find((t) => t.slug === 'python').completed, 0);
  });

  test('las lecciones de SQL no traen ejercicios de audio', async () => {
    const client = createClient(server.base);
    await signInAsGuest(client, 'NoAudio');
    const sqlUnits = await client.get('/api/v1/units?track=sql');
    const started = await client.post('/api/v1/attempts', {
      lessonId: sqlUnits.data.units[0].lessons[0].id,
    });
    const types = started.data.attempt.exercises.map((exercise) => exercise.type);
    assert.equal(types.includes('listen_choose'), false);
    assert.ok(new Set(types).size >= 3, 'aun asi usa 3 o mas tipos');
  });

  test('el vocabulario se puede filtrar por curso', async () => {
    const client = createClient(server.base);
    await signInAsGuest(client, 'Filter');
    const sqlUnits = await client.get('/api/v1/units?track=sql');
    const started = await client.post('/api/v1/attempts', {
      lessonId: sqlUnits.data.units[0].lessons[0].id,
    });
    await playAttempt(client, started.data.attempt, 8);

    const sqlWords = await client.get('/api/v1/vocabulary?track=sql');
    const pythonWords = await client.get('/api/v1/vocabulary?track=python');
    assert.ok(sqlWords.data.total > 0, `SQL: ${sqlWords.data.total} terminos`);
    assert.equal(pythonWords.data.total, 0, 'sin practicar Python, no hay conceptos de Python');
    assert.ok(sqlWords.data.words.every((word) => word.track === 'sql'));
  });

  test('PATCH /me cambia el curso activo y rechaza uno inexistente', async () => {
    const client = createClient(server.base);
    await signInAsGuest(client, 'Switch');
    const ok = await client.patch('/api/v1/me', { activeTrack: 'sql' });
    assert.equal(ok.status, 200);
    assert.equal(ok.data.user.activeTrack, 'sql');

    // Sin ?track, /units usa ahora el curso activo del perfil.
    const units = await client.get('/api/v1/units');
    assert.equal(units.data.track.slug, 'sql');

    const bad = await client.patch('/api/v1/me', { activeTrack: 'klingon' });
    assert.equal(bad.status, 400);
  });

  test('un track inexistente en /units devuelve 400', async () => {
    const client = createClient(server.base);
    await signInAsGuest(client, 'BadTrack');
    const response = await client.get('/api/v1/units?track=nope');
    assert.equal(response.status, 400);
    assert.equal(response.data.error.details.field, 'track');
  });
});

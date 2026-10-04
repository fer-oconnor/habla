// Verificacion 4: el progreso sigue ahi tras recargar Y tras reiniciar el
// servidor (la base de datos es un archivo SQLite de verdad, no memoria).
//
// Este archivo va aparte porque reinicia el servidor: la conexion a SQLite es
// un singleton por proceso y no conviene mezclarla con otras pruebas.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

import { createClient, playAttempt, signInAsGuest, startTestServer } from './helpers.js';

describe('Persistencia en SQLite', () => {
  test('una lección Python a medias conserva respuestas y borrador tras reiniciar',async (t) => {
    const server=await startTestServer();
    let live=server;
    t.after(async()=>{await live.close();});
    const client=createClient(server.base);
    await signInAsGuest(client,'Python persistente');
    const units=await client.get('/api/v1/units?track=python');
    const id=units.data.units[0].lessons[0].id;
    const {data}=await client.post('/api/v1/attempts',{lessonId:id});
    const attempt=data.attempt;
    const {correctAnswerFor}=await import('./helpers.js');
    await client.put(`/api/v1/attempts/${attempt.id}/answers/${attempt.exercises[0].id}`,{
      answer:await correctAnswerFor(attempt.exercises[0]),
    });
    const code='resultado = puntos\n# Continuaré mañana';
    await client.put(`/api/v1/attempts/${attempt.id}/drafts/${attempt.exercises[3].id}`,{code});
    const restarted=live=await server.restart();
    const browser=createClient(restarted.base);
    for(const [name,value] of client.cookies) browser.cookies.set(name,value);
    await browser.get('/api/v1/me');
    const resumed=await browser.post('/api/v1/attempts',{lessonId:id});
    assert.equal(resumed.data.attempt.id,attempt.id);
    assert.equal(resumed.data.attempt.cursor,1);
    assert.equal(resumed.data.attempt.exercises[3].draft,code);
    assert.equal((await browser.get('/api/v1/units?track=python')).data.nextLesson.id,id);
  });
  test('XP, desbloqueos, sesion y vocabulario sobreviven al reinicio', async () => {
    const server = await startTestServer();
    const client = createClient(server.base);
    const user = await signInAsGuest(client, 'Persistente', 'Europe/Madrid');

    const units = await client.get('/api/v1/units');
    const lesson = units.data.units[0].lessons[0];
    const started = await client.post('/api/v1/attempts', { lessonId: lesson.id });
    await playAttempt(client, started.data.attempt, 7);

    const before = await client.get('/api/v1/progress');
    assert.equal(before.data.xp, 10);
    assert.equal(before.data.lessonsPassed, 1);
    const wordsBefore = (await client.get('/api/v1/vocabulary')).data.total;
    assert.ok(wordsBefore > 0);

    // --- Reinicio del servidor sobre el MISMO archivo .db ---
    const restarted = await server.restart();
    const sameBrowser = createClient(restarted.base);
    // El navegador conserva sus cookies: se las pasamos al cliente nuevo.
    for (const [name, value] of client.cookies) sameBrowser.cookies.set(name, value);

    const me = await sameBrowser.get('/api/v1/me');
    assert.equal(me.status, 200, 'la sesion sigue viva tras reiniciar el servidor');
    assert.equal(me.data.user.id, user.id);

    const after = await sameBrowser.get('/api/v1/progress');
    assert.equal(after.data.xp, 10);
    assert.equal(after.data.lessonsPassed, 1);
    assert.ok(after.data.achievements.find((a) => a.code === 'first_lesson').earned);

    const afterUnits = await sameBrowser.get('/api/v1/units');
    const all = afterUnits.data.units.flatMap((unit) => unit.lessons);
    assert.equal(all[0].status, 'completed');
    assert.equal(all[1].status, 'available');

    const wordsAfter = (await sameBrowser.get('/api/v1/vocabulary')).data.total;
    assert.equal(wordsAfter, wordsBefore);

    await restarted.close();
  });
});

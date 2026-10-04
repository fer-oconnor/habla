import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createClient,signInAsGuest,startTestServer,playAttempt} from './helpers.js';
import {getDb} from '../db/index.js';
import {seed} from '../db/seed.js';
import {evaluateCode} from '../server/services/code.service.js';
import {UNITS} from '../db/content/index.js';
let server;
before(async () => {server=await startTestServer();});
after(async () => {await server.close();});

async function pythonAttempt(client) {
  const course = await client.get('/api/v1/units?track=python');
  return (await client.post('/api/v1/attempts',{lessonId:course.data.units[0].lessons[0].id})).data.attempt;
}

test('solo existen SQL y Python en el catálogo activo',async () => {
  const client=createClient(server.base);await signInAsGuest(client);
  const tracks=await client.get('/api/v1/tracks');
  assert.deepEqual(tracks.data.tracks.map(t=>t.slug),['sql','python']);
  assert.equal((await client.get('/api/v1/units?track=spanish')).status,400);
});

test('Python se ejecuta por comportamiento; distingue mayúsculas y admite soluciones alternativas',async () => {
  const client=createClient(server.base);await signInAsGuest(client);
  const attempt=await pythonAttempt(client), exercise=attempt.exercises[3];
  const path=`/api/v1/attempts/${attempt.id}/run/${exercise.id}`;
  const alternative=await client.post(path,{code:'x = puntos\nresultado = x'});
  assert.equal(alternative.data.correct,true);
  assert.equal((await client.post(path,{code:'Resultado = puntos'})).data.correct,false);
  assert.equal((await client.get(`/api/v1/attempts/${attempt.id}`)).data.attempt.answered,0);
});

test('los borradores y respuestas sobreviven al cierre de SQLite y una recarga',async () => {
  const client=createClient(server.base);const user=await signInAsGuest(client);
  const attempt=await pythonAttempt(client), exercise=attempt.exercises[3];
  const code='resultado = puntos  # borrador\n';
  assert.equal((await client.put(`/api/v1/attempts/${attempt.id}/drafts/${exercise.id}`,{code})).status,200);
  const {closeDb}=await import('../db/index.js');closeDb();
  const restored=await client.get(`/api/v1/attempts/${attempt.id}`);
  assert.equal(restored.data.attempt.exercises[3].draft,code);
  const other=createClient(server.base);await signInAsGuest(other);
  assert.equal((await other.post(`/api/v1/attempts/${attempt.id}/run/${exercise.id}`,{code})).status,404);
  const answer=await client.put(`/api/v1/attempts/${attempt.id}/answers/${exercise.id}`,{answer:code});
  assert.equal(answer.data.correct,true);
  assert.equal(getDb().prepare('SELECT COUNT(*) AS n FROM attempt_drafts WHERE attempt_id=?').get(attempt.id).n,0);
  const repeat=await client.put(`/api/v1/attempts/${attempt.id}/answers/${exercise.id}`,{answer:code});
  assert.equal(repeat.data.repeated,true);
  assert.equal((await client.put(`/api/v1/attempts/${attempt.id}/answers/${exercise.id}`,{answer:'Resultado = puntos'})).status,409);
  assert.equal((await client.get('/api/v1/units?track=python')).data.nextLesson.inProgress.id,attempt.id);
});

test('convertir invitado en cuenta conserva su identidad y su XP al volver a entrar',async () => {
  const client=createClient(server.base);const guest=await signInAsGuest(client);
  const attempt=await pythonAttempt(client);await playAttempt(client,attempt,8);
  const registered=await client.post('/api/v1/auth/register',{email:'durable@example.test',password:'persistencia123',displayName:'Durable'});
  assert.equal(registered.data.user.id,guest.id);
  await client.post('/api/v1/auth/logout');
  await client.post('/api/v1/auth/login',{email:'durable@example.test',password:'persistencia123'});
  const progress=await client.get('/api/v1/progress');
  assert.equal(progress.data.xp,10);
  assert.equal(progress.data.tracks.find(t=>t.slug==='python').completed,1);
});

test('un perfil de invitado se recupera con token aunque caduque su cookie',async () => {
  const client=createClient(server.base);const guest=await signInAsGuest(client);
  const remembered=await client.post('/api/v1/auth/remember');
  assert.equal(remembered.data.recoveryToken.length,64);
  const fresh=createClient(server.base);
  const recovered=await fresh.post('/api/v1/auth/recover',{token:remembered.data.recoveryToken});
  assert.equal(recovered.data.user.id,guest.id);
  assert.equal((await fresh.post('/api/v1/auth/recover',{token:'0'.repeat(64)})).status,401);
});

test('recargar contenido conserva identificadores, desbloqueos y respuestas',async () => {
  const client=createClient(server.base);const user=await signInAsGuest(client);
  const attempt=await pythonAttempt(client);await playAttempt(client,attempt,8);
  const before=getDb().prepare('SELECT * FROM lesson_progress WHERE user_id=?').all(user.id);
  const id=attempt.lesson.id;
  seed();seed();
  assert.deepEqual(getDb().prepare('SELECT * FROM lesson_progress WHERE user_id=?').all(user.id),before);
  assert.equal(getDb().prepare('SELECT id FROM lessons WHERE slug=?').get(attempt.lesson.slug).id,id);
});

test('SQLite acepta consultas equivalentes y rechaza acceso al disco',async () => {
  const exercise=UNITS.find(u=>u.slug==='sql-writing').lessons[0].exercises[3];
  assert.equal((await evaluateCode(exercise,'select name, price from products where 1=1')).correct,true);
  assert.equal((await evaluateCode(exercise,"ATTACH DATABASE 'personal.db' AS private; SELECT name,price FROM products;")).correct,false);
  assert.equal((await evaluateCode(exercise,'SELECT name,price FROM products WHERE id=1')).correct,false);
});

test('Python bloquea imports y acceso a archivos reales y corta bucles infinitos',async () => {
  const exercise=UNITS.find(u=>u.track==='python').lessons[0].exercises[3];
  for (const code of ['import os\nresultado=0',"resultado=open('C:/secret.txt').read()",'resultado=puntos.__class__',"resultado='x'*1000000000",'while True:\n    pass']) {
    const result=await evaluateCode(exercise,code);assert.equal(result.correct,false,code);
  }
});

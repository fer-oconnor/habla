// Verificacion 1: invitado, registro, inicio y cierre de sesion.
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createClient, startTestServer } from './helpers.js';

let server;
before(async () => { server = await startTestServer(); });
after(async () => { await server.close(); });

describe('Acceso a la aplicacion', () => {
  test('GET /health responde sin sesion y dice cuanto contenido hay', async () => {
    const client = createClient(server.base);
    const { status, data } = await client.get('/api/v1/health');
    assert.equal(status, 200);
    assert.equal(data.status, 'ok');
    assert.equal(data.signedIn, false);
    // Dos cursos activos: Python y SQL, con 36 lecciones cada uno.
    assert.equal(data.database.content.tracks, 2);
    assert.equal(data.database.content.lessons, 72);
    assert.equal(data.database.content.exercises, 576);
  });

  test('sin sesion, /me devuelve 401 con forma de error consistente', async () => {
    const client = createClient(server.base);
    const { status, data } = await client.get('/api/v1/me');
    assert.equal(status, 401);
    assert.equal(data.error.code, 'unauthorized');
    assert.ok(typeof data.error.message === 'string' && data.error.message.length > 0);
  });

  test('POST /auth/guest crea un invitado con su propia sesion', async () => {
    const client = createClient(server.base);
    const { status, data } = await client.post('/api/v1/auth/guest', {
      displayName: 'Guest One',
      timezone: 'Europe/Madrid',
    });
    assert.equal(status, 201);
    assert.equal(data.user.isGuest, true);
    assert.equal(data.user.displayName, 'Guest One');
    assert.equal(data.user.timezone, 'Europe/Madrid');
    assert.ok(data.csrfToken);
    assert.ok(client.cookies.has('habla_session'));

    const me = await client.get('/api/v1/me');
    assert.equal(me.status, 200);
    assert.equal(me.data.user.id, data.user.id);
  });

  test('dos invitados reciben usuarios distintos', async () => {
    const a = createClient(server.base);
    const b = createClient(server.base);
    const first = await a.post('/api/v1/auth/guest', {});
    const second = await b.post('/api/v1/auth/guest', {});
    assert.notEqual(first.data.user.id, second.data.user.id);
  });

  test('registro, cierre de sesion y vuelta a entrar', async () => {
    const client = createClient(server.base);
    const registered = await client.post('/api/v1/auth/register', {
      email: 'Ana@Example.com',
      password: 'contrasena-larga-1',
      displayName: 'Ana',
      timezone: 'Europe/Madrid',
      dailyGoal: 2,
    });
    assert.equal(registered.status, 201);
    assert.equal(registered.data.user.email, 'ana@example.com', 'el email se guarda en minusculas');
    assert.equal(registered.data.user.isGuest, false);
    assert.equal(registered.data.user.dailyGoal, 2);

    const loggedOut = await client.post('/api/v1/auth/logout');
    assert.equal(loggedOut.status, 200);
    const afterLogout = await client.get('/api/v1/me');
    assert.equal(afterLogout.status, 401, 'la sesion ya no vale');

    const loggedIn = await client.post('/api/v1/auth/login', {
      email: 'ana@example.com',
      password: 'contrasena-larga-1',
    });
    assert.equal(loggedIn.status, 200);
    assert.equal(loggedIn.data.user.email, 'ana@example.com');
  });

  test('el mismo email no se puede registrar dos veces', async () => {
    const client = createClient(server.base);
    const body = {
      email: 'dup@example.com',
      password: 'contrasena-larga-1',
      displayName: 'Dup',
    };
    assert.equal((await client.post('/api/v1/auth/register', body)).status, 201);
    const second = await createClient(server.base).post('/api/v1/auth/register', body);
    assert.equal(second.status, 409);
    assert.equal(second.data.error.code, 'conflict');
  });

  test('contrasena incorrecta devuelve 401 y no dice si el email existe', async () => {
    const client = createClient(server.base);
    const bad = await client.post('/api/v1/auth/login', {
      email: 'dup@example.com',
      password: 'otra-contrasena-mala',
    });
    const unknown = await client.post('/api/v1/auth/login', {
      email: 'nadie@example.com',
      password: 'otra-contrasena-mala',
    });
    assert.equal(bad.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(bad.data.error.message, unknown.data.error.message);
  });

  test('validacion de entradas: contrasena corta y email invalido', async () => {
    const client = createClient(server.base);
    const short = await client.post('/api/v1/auth/register', {
      email: 'x@example.com', password: 'corta', displayName: 'X',
    });
    assert.equal(short.status, 400);
    assert.equal(short.data.error.details.field, 'password');

    const badEmail = await client.post('/api/v1/auth/register', {
      email: 'no-es-email', password: 'contrasena-larga-1', displayName: 'X',
    });
    assert.equal(badEmail.status, 400);
  });

  test('PATCH /me guarda nombre, objetivo, zona horaria y sonido', async () => {
    const client = createClient(server.base);
    await client.post('/api/v1/auth/guest', {});
    const updated = await client.patch('/api/v1/me', {
      displayName: 'Fernando',
      dailyGoal: 3,
      timezone: 'America/Mexico_City',
      soundEnabled: false,
      onboardingDone: true,
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.data.user.displayName, 'Fernando');
    assert.equal(updated.data.user.dailyGoal, 3);
    assert.equal(updated.data.user.timezone, 'America/Mexico_City');
    assert.equal(updated.data.user.soundEnabled, false);
    assert.equal(updated.data.user.onboardingDone, true);

    const bad = await client.patch('/api/v1/me', { dailyGoal: 9 });
    assert.equal(bad.status, 400);
    const badZone = await client.patch('/api/v1/me', { timezone: 'Marte/Olympus' });
    assert.equal(badZone.status, 400);
  });

  test('una peticion de modificacion desde otro origen se rechaza (CSRF)', async () => {
    const client = createClient(server.base);
    await client.post('/api/v1/auth/guest', {});
    const attacked = await client.patch('/api/v1/me', { displayName: 'Hacked' }, {
      origin: 'http://evil.example.com',
    });
    assert.equal(attacked.status, 403);
    assert.equal(attacked.data.error.code, 'forbidden');
  });

  test('sin la cabecera X-Habla-CSRF tampoco se puede modificar', async () => {
    const client = createClient(server.base);
    await client.post('/api/v1/auth/guest', {});
    const cookieHeader = [...client.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    const response = await fetch(`${server.base}/api/v1/me`, {
      method: 'PATCH',
      headers: {
        origin: server.base,
        'content-type': 'application/json',
        cookie: cookieHeader,
      },
      body: JSON.stringify({ displayName: 'NoToken' }),
    });
    assert.equal(response.status, 403);
  });
});

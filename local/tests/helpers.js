// ---------------------------------------------------------------------------
// Utilidades para las pruebas.
//
// Cada archivo de prueba arranca su PROPIO servidor sobre una base de datos
// temporal (en la carpeta temporal del sistema). Asi las pruebas no tocan
// data/habla.db ni tu progreso real.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';

const TEST_DIR = path.join(os.tmpdir(), 'habla-tests');

/**
 * Arranca un servidor de pruebas. Devuelve la URL base y un `close()`.
 * Importante: fija DATABASE_FILE y NODE_ENV ANTES de importar el servidor.
 */
export async function startTestServer() {
  fs.mkdirSync(TEST_DIR, { recursive: true });
  const dbFile = path.join(TEST_DIR, `${randomUUID()}.db`);

  process.env.NODE_ENV = 'test';
  process.env.DATABASE_FILE = dbFile;
  process.env.COOKIE_SECURE = 'false';

  const { seed } = await import('../db/seed.js');
  const { createApp } = await import('../server/app.js');
  const { closeDb } = await import('../db/index.js');

  seed();

  const app = createApp();
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  return {
    base,
    dbFile,
    async close({ removeFile = true } = {}) {
      await new Promise((resolve) => server.close(resolve));
      closeDb();
      if (removeFile) {
        for (const suffix of ['', '-wal', '-shm']) {
          try { fs.rmSync(dbFile + suffix); } catch { /* puede no existir */ }
        }
      }
    },
    /** Simula "reiniciar el servidor": cierra y abre otro sobre el mismo .db */
    async restart() {
      await new Promise((resolve) => server.close(resolve));
      closeDb();
      const nextApp = createApp();
      const nextServer = nextApp.listen(0, '127.0.0.1');
      await once(nextServer, 'listening');
      return {
        base: `http://127.0.0.1:${nextServer.address().port}`,
        async close() {
          await new Promise((resolve) => nextServer.close(resolve));
          closeDb();
          for (const suffix of ['', '-wal', '-shm']) {
            try { fs.rmSync(dbFile + suffix); } catch { /* ok */ }
          }
        },
      };
    },
  };
}

/**
 * Cliente HTTP con "tarro de cookies": se comporta como un navegador, guarda
 * la cookie de sesion y reenvia el token CSRF en cada peticion que modifica.
 */
export function createClient(base) {
  const cookies = new Map();
  let csrfToken = null;

  function readSetCookies(response) {
    const raw = typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [];
    for (const entry of raw) {
      const [pair] = entry.split(';');
      const separator = pair.indexOf('=');
      if (separator === -1) continue;
      const name = pair.slice(0, separator).trim();
      const value = pair.slice(separator + 1).trim();
      if (value === '') cookies.delete(name);
      else cookies.set(name, value);
    }
    if (cookies.has('habla_csrf')) {
      csrfToken = decodeURIComponent(cookies.get('habla_csrf'));
    } else {
      csrfToken = null;
    }
  }

  async function request(method, urlPath, body, { origin = base, headers = {} } = {}) {
    const finalHeaders = { origin, ...headers };
    if (body !== undefined) finalHeaders['content-type'] = 'application/json';
    if (cookies.size > 0) {
      finalHeaders.cookie = [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    }
    if (csrfToken && !['GET', 'HEAD'].includes(method)) {
      finalHeaders['x-habla-csrf'] = csrfToken;
    }

    const response = await fetch(base + urlPath, {
      method,
      headers: finalHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    readSetCookies(response);

    const text = await response.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = text; }
    }
    return { status: response.status, data, headers: response.headers };
  }

  return {
    request,
    get: (p, options) => request('GET', p, undefined, options),
    post: (p, b, options) => request('POST', p, b, options),
    put: (p, b, options) => request('PUT', p, b, options),
    patch: (p, b, options) => request('PATCH', p, b, options),
    get token() { return csrfToken; },
    cookies,
  };
}

/** Entra como invitado y devuelve el usuario. */
export async function signInAsGuest(client, displayName = 'Tester', timezone = 'UTC') {
  const response = await client.post('/api/v1/auth/guest', { displayName, timezone });
  if (response.status !== 201) {
    throw new Error(`No pude crear el invitado: ${JSON.stringify(response.data)}`);
  }
  return response.data.user;
}

/**
 * Construye la respuesta CORRECTA de un ejercicio leyendo la solucion
 * directamente de la base de datos (solo las pruebas pueden hacer esto).
 */
export async function correctAnswerFor(exercise) {
  const { getDb, readJson } = await import('../db/index.js');
  const row = getDb().prepare('SELECT * FROM exercises WHERE id = ?').get(exercise.id);
  const solution = readJson(row.solution, {});
  switch (row.type) {
    case 'choose_translation':
    case 'listen_choose':
    case 'fill_blank':
      return solution.value;
    case 'word_order':
      return String(solution.value).replace(/[¿?¡!.,]/g, '').trim().split(/\s+/);
    case 'match_pairs':
      return solution.pairs;
    default:
      throw new Error(`Tipo no soportado en pruebas: ${row.type}`);
  }
}

/** Construye una respuesta INCORRECTA valida (para probar fallos). */
export async function wrongAnswerFor(exercise) {
  const { getDb, readJson } = await import('../db/index.js');
  const row = getDb().prepare('SELECT * FROM exercises WHERE id = ?').get(exercise.id);
  const payload = readJson(row.payload, {});
  const solution = readJson(row.solution, {});

  switch (row.type) {
    case 'choose_translation':
    case 'listen_choose':
      return payload.options.find((option) => option !== solution.value);
    case 'fill_blank':
      if (Array.isArray(payload.bank)) {
        return payload.bank.find((option) => option !== solution.value);
      }
      return 'zzz';
    case 'word_order': {
      const { normalizeText } = await import('../server/lib/normalize.js');
      const target = normalizeText(solution.value);
      const tokens = [...payload.tokens];
      // Probamos varias reordenaciones y nos quedamos con la primera que NO
      // coincide con la solucion.
      const candidates = [
        [...tokens].reverse(),
        [tokens[tokens.length - 1], ...tokens.slice(0, -1)],
        [tokens[1], tokens[0], ...tokens.slice(2)],
      ];
      const found = candidates.find((candidate) => normalizeText(candidate.join(' ')) !== target);
      if (!found) throw new Error(`No encuentro respuesta incorrecta para ${row.slug}`);
      return found;
    }
    case 'match_pairs': {
      // Rotamos los significados correctos una posicion: con 2 o mas parejas,
      // esto garantiza que TODAS queden mal.
      const left = payload.left;
      const values = left.map((item) => solution.pairs[item]);
      const wrong = {};
      left.forEach((item, index) => {
        wrong[item] = values[(index + 1) % values.length];
      });
      return wrong;
    }
    default:
      throw new Error(`Tipo no soportado en pruebas: ${row.type}`);
  }
}

/** Juega un intento completo. `correctCount` indica cuantos aciertos forzar. */
export async function playAttempt(client, attempt, correctCount) {
  const answers = [];
  for (let index = 0; index < attempt.exercises.length; index += 1) {
    const exercise = attempt.exercises[index];
    const answer = index < correctCount
      ? await correctAnswerFor(exercise)
      : await wrongAnswerFor(exercise);
    const response = await client.put(
      `/api/v1/attempts/${attempt.id}/answers/${exercise.id}`,
      { answer }
    );
    answers.push({ exercise, answer, response });
  }
  const completed = await client.post(`/api/v1/attempts/${attempt.id}/complete`);
  return { answers, completed };
}

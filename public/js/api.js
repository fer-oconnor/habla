// ---------------------------------------------------------------------------
// TODAS las llamadas al backend pasan por aqui.
//
// Se encarga de:
//   * anadir la cabecera CSRF en las peticiones que modifican datos
//   * comprobar response.ok y convertir los errores en objetos ApiError
//   * distinguir "sin conexion" de "el servidor dijo que no"
//   * avisar cuando la sesion ha caducado (401)
//   * reintentar una peticion fallida con `retry()`
// ---------------------------------------------------------------------------

const BASE = '/api/v1';
import { runCode } from './laboratory.js?v=studio20261003';
const codeExercises = new Set();
const executions = new Map();
// Temporary practice is explicitly not progress: it lives only in this tab.
// The existing database remains authoritative and is never replaced by this copy.
const temporaryAttempts = new Map();
async function runExercise(attemptId,exerciseId,code) {
  const temporary=temporaryAttempts.get(attemptId);
  const {job} = temporary ? {job:temporary.jobs[exerciseId]} : await post(`/attempts/${attemptId}/run/${exerciseId}`,{code});
  const execution=await runCode(job,code);
  executions.set(`${attemptId}.${exerciseId}`,{code,execution});
  return execution;
}
const CSRF_COOKIE = 'habla_csrf';
const CSRF_HEADER = 'X-Habla-CSRF';
const SAFE = new Set(['GET', 'HEAD']);

/** Error de API con toda la informacion util para la interfaz. */
export class ApiError extends Error {
  constructor({ status, code, message, details, offline = false }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.offline = offline;
  }

  get isOffline() { return this.offline; }
  get isSessionExpired() { return this.status === 401; }
  get isConflict() { return this.status === 409; }
  /** Merece la pena volver a intentarlo (red o error del servidor). */
  get isRetryable() { return this.offline || this.status >= 500 || this.status === 429; }
}

function readCookie(name) {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

// --- Suscriptores ----------------------------------------------------------
const listeners = { unauthorized: new Set(), loading: new Set() };

export function onSessionExpired(handler) {
  listeners.unauthorized.add(handler);
  return () => listeners.unauthorized.delete(handler);
}

export function onLoadingChange(handler) {
  listeners.loading.add(handler);
  return () => listeners.loading.delete(handler);
}

let inFlight = 0;
function setInFlight(delta) {
  inFlight = Math.max(0, inFlight + delta);
  for (const handler of listeners.loading) handler(inFlight > 0);
}

// --- Peticion base ---------------------------------------------------------

async function request(method, path, body, { signal, quiet = false } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (!SAFE.has(method)) {
    const token = readCookie(CSRF_COOKIE);
    if (token) headers[CSRF_HEADER] = token;
  }

  if (!quiet) setInFlight(1);
  let response;
  try {
    response = await fetch(BASE + path, {
      method,
      headers,
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (!quiet) setInFlight(-1);
    if (error?.name === 'AbortError') throw error;
    // fetch solo falla asi cuando no hay red o el servidor no responde.
    throw new ApiError({
      status: 0,
      code: 'network_error',
      message: navigator.onLine
        ? 'No se pudo conectar. Lo que has escrito sigue aquí; vuelve a intentarlo.'
        : 'No tienes conexión. Conserva esta pestaña y vuelve a intentarlo cuando recuperes la red.',
      offline: true,
    });
  }
  if (!quiet) setInFlight(-1);

  // 204 y respuestas sin cuerpo
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
      if (response.ok) {
        throw new ApiError({
          status: response.status,
          code: 'invalid_response',
          message: 'No se pudo leer la respuesta del servidor.',
        });
      }
    }
  }

  if (!response.ok) {
    const error = new ApiError({
      status: response.status,
      code: data?.error?.code ?? 'http_' + response.status,
      message: data?.error?.message ?? `Request failed (${response.status}).`,
      details: data?.error?.details,
    });
    if (error.status === 401) {
      for (const handler of listeners.unauthorized) handler(error);
    }
    throw error;
  }

  return data;
}

/**
 * Reintenta una peticion mientras el error sea de red o del servidor.
 * `attempts` incluye el primer intento.
 */
export async function retry(run, { attempts = 3, delayMs = 500 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (!(error instanceof ApiError) || !error.isRetryable || attempt === attempts) break;
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
  throw lastError;
}

const get = (path, options) => request('GET', path, undefined, options);
const post = (path, body, options) => request('POST', path, body, options);
const put = (path, body, options) => request('PUT', path, body, options);
const patch = (path, body, options) => request('PATCH', path, body, options);

const query = (params) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  }
  const text = search.toString();
  return text ? `?${text}` : '';
};

// --- API publica -----------------------------------------------------------
export const api = {
  health: () => get('/health', { quiet: true }),

  // Acceso
  register: (payload) => post('/auth/register', payload),
  login: (payload) => post('/auth/login', payload),
  guest: (payload) => post('/auth/guest', payload ?? {}),
  logout: () => post('/auth/logout'),
  remember: () => post('/auth/remember'),
  recover: (token) => post('/auth/recover',{token}),

  // Perfil
  me: (options) => get('/me', options),
  updateMe: (changes) => patch('/me', changes),
  creatorParticipants: (params={}) => get('/admin/learners'+query(params)),

  // Curso
  tracks: () => get('/tracks'),
  units: (track) => get('/units' + query({ track })),
  lesson: (id) => get(`/lessons/${encodeURIComponent(id)}`),

  // Intentos
  isTemporaryAttempt: (id) => temporaryAttempts.has(id),
  startLesson: async (lessonId) => rememberExercises(await post('/attempts', { lessonId })),
  startPractice: async (track) => rememberExercises(await post('/attempts', { kind: 'practice', track })),
  attempt: async (id) => temporaryAttempts.has(id) ? {attempt:temporaryAttempts.get(id).attempt} : rememberExercises(await get(`/attempts/${id}`)),
  practiceWithoutSaving: async (lessonId,existing=null) => {
    const preview=await get(`/lessons/${lessonId}/preview`);
    const attempt=existing?{...existing,exercises:existing.exercises.map(e=>({...e})),temporary:true}:preview.attempt;
    temporaryAttempts.set(attempt.id,{attempt,jobs:preview.jobs});
    return rememberExercises({attempt,resumed:!!existing});
  },
  answer: async (attemptId, exerciseId, answer) => {
    let execution;
    if(codeExercises.has(exerciseId)) {
      const cached=executions.get(`${attemptId}.${exerciseId}`);
      execution=cached?.code===answer?cached.execution:await runExercise(attemptId,exerciseId,answer);
    }
    const temporary=temporaryAttempts.get(attemptId);
    if(temporary) {
      const a=temporary.attempt,e=a.exercises.find(e=>e.id===exerciseId);
      if(e?.answered) return {...e.result,repeated:true};
      const result=await post(`/lessons/${a.lesson.id}/check/${exerciseId}`,{answer,execution});
      e.answered=true;e.result=result;a.answered++;if(result.correct)a.correctSoFar++;
      return {...result,repeated:false};
    }
    return put(`/attempts/${attemptId}/answers/${exerciseId}`, { answer,execution });
  },
  complete: async (attemptId) => {
    const a=temporaryAttempts.get(attemptId)?.attempt;
    if(!a) return post(`/attempts/${attemptId}/complete`);
    if(a.exercises.some(e=>!e.answered)) throw new ApiError({status:400,message:'Faltan ejercicios por responder.',details:{missingExerciseIds:a.exercises.filter(e=>!e.answered).map(e=>e.id)}});
    a.status='completed';a.result={correct:a.correctSoFar,total:a.total,percent:Math.round(a.correctSoFar/a.total*100),passed:a.correctSoFar>=a.lesson.passThreshold,
      xpAwarded:0,passThreshold:a.lesson.passThreshold,kind:a.kind,completedAt:new Date().toISOString(),
      review:a.exercises.map(e=>({exerciseId:e.id,slug:e.slug,type:e.type,prompt:e.prompt,question:e.question,...e.result}))};
    return {result:a.result,newAchievements:[],temporary:true};
  },
  draft: (attemptId,exerciseId,code) => temporaryAttempts.has(attemptId)?Promise.resolve({saved:false,temporary:true}):put(`/attempts/${attemptId}/drafts/${exerciseId}`,{code}),
  run: runExercise,

  // Progreso y vocabulario
  progress: () => get('/progress'),
  vocabulary: (options = {}) => get('/vocabulary' + query(options)),
};

export default api;

function rememberExercises(response) {
  for(const exercise of response.attempt?.exercises??[]) if(exercise.payload.editor) codeExercises.add(exercise.id);
  return response;
}

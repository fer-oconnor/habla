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
        ? 'We could not reach the server. Is it still running?'
        : 'You appear to be offline. Check your connection and try again.',
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
          message: 'The server sent something we could not read.',
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

  // Curso
  tracks: () => get('/tracks'),
  units: (track) => get('/units' + query({ track })),
  lesson: (id) => get(`/lessons/${encodeURIComponent(id)}`),

  // Intentos
  startLesson: (lessonId) => post('/attempts', { lessonId }),
  startPractice: (track) => post('/attempts', { kind: 'practice', track }),
  attempt: (id) => get(`/attempts/${id}`),
  answer: (attemptId, exerciseId, answer) =>
    put(`/attempts/${attemptId}/answers/${exerciseId}`, { answer }),
  complete: (attemptId) => post(`/attempts/${attemptId}/complete`),
  draft: (attemptId,exerciseId,code) => put(`/attempts/${attemptId}/drafts/${exerciseId}`,{code}),
  run: (attemptId,exerciseId,code) => post(`/attempts/${attemptId}/run/${exerciseId}`,{code}),

  // Progreso y vocabulario
  progress: () => get('/progress'),
  vocabulary: (options = {}) => get('/vocabulary' + query(options)),
};

export default api;

// ---------------------------------------------------------------------------
// Estado compartido de la app (en memoria).
//
// Lo importante (usuario, progreso, intentos) vive en SQLite y llega por la
// API. Aqui solo guardamos la ultima copia para no pedir lo mismo dos veces.
//
// localStorage se usa SOLO para preferencias visuales sin importancia
// (que curso mirabas, el ultimo filtro de Words). Si se borra, no se pierde
// nada: el progreso real esta en el servidor.
// ---------------------------------------------------------------------------

const PREFS_KEY = 'habla.prefs.v1';

function readPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};   // modo privado, almacenamiento bloqueado, etc.
  }
}

function writePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch { /* si no se puede guardar, seguimos igual */ }
}

const listeners = new Set();

export const store = {
  user: null,
  progress: null,
  tracks: [],
  course: null,          // resultado de GET /units del track visible
  activeTrack: 'sql',
  prefs: readPrefs(),

  set(changes) {
    Object.assign(store, changes);
    for (const handler of listeners) handler(store);
  },

  subscribe(handler) {
    listeners.add(handler);
    return () => listeners.delete(handler);
  },

  setPref(key, value) {
    store.prefs = { ...store.prefs, [key]: value };
    writePrefs(store.prefs);
  },

  reset() {
    store.user = null;
    store.progress = null;
    store.tracks = [];
    store.course = null;
    for (const handler of listeners) handler(store);
  },

  get isSignedIn() { return Boolean(store.user); },
  get needsOnboarding() { return Boolean(store.user) && !store.user.onboardingDone; },
};

export default store;

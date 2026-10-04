// ---------------------------------------------------------------------------
// Arranque y enrutado del frontend.
//
// Es una app de una sola pagina: el servidor Express devuelve index.html para
// cualquier ruta GET, y este archivo decide que pantalla dibujar.
//
// Rutas:
//   /                -> Welcome (sin sesion) o Learn (con sesion)
//   /onboarding      -> Configuracion inicial
//   /learn           -> Recorrido de unidades y lecciones
//   /lesson/:id      -> Una leccion (un ejercicio por pantalla)
//   /result/:id      -> Resultado de un intento
//   /practice        -> Repaso de errores
//   /words           -> Vocabulario encontrado
//   /profile         -> Perfil, estadisticas, logros y ajustes
// ---------------------------------------------------------------------------

import { api, ApiError, onSessionExpired, retry } from './api.js?v=studio20261003';
import { announce, clear, el } from './dom.js?v=studio20261003';
import { t } from './i18n.js?v=studio20261003';
import { store } from './store.js?v=studio20261003';
import { renderShell } from './shell.js?v=studio20261003';
import { toast, toastError } from './toast.js?v=studio20261003';
import { loadVoices, setMuted, cancel as cancelSpeech } from './audio.js?v=studio20261003';

import renderWelcome from './views/welcome.js?v=studio20261003';
import renderOnboarding from './views/onboarding.js?v=studio20261003';
import renderLearn from './views/learn.js?v=studio20261003';
import renderLesson from './views/lesson.js?v=studio20261003';
import renderResult from './views/result.js?v=studio20261003';
import renderPractice from './views/practice.js?v=studio20261003';
import renderWords from './views/words.js?v=studio20261003';
import renderProfile from './views/profile.js?v=studio20261003';
import renderAdmin from './views/admin.js?v=studio20261003';
import renderPrivacy, {PROGRESS_NOTICE_VERSION} from './views/privacy.js?v=studio20261003';

const view = () => document.getElementById('view');

// --- Navegacion -------------------------------------------------------------

export function navigate(path, { replace = false } = {}) {
  if (replace) history.replaceState({}, '', path);
  else history.pushState({}, '', path);
  render();
}

/** Intercepta los enlaces marcados con data-route para no recargar la pagina. */
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[data-route]');
  if (!link) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
  event.preventDefault();
  const path = link.getAttribute('href');
  if (path !== location.pathname) navigate(path);
});

window.addEventListener('popstate', () => render());

// --- Refresco de datos compartidos -----------------------------------------

export async function refreshProgress({ quiet = true } = {}) {
  try {
    const progress = await api.progress();
    store.set({ progress });
    renderShell(location.pathname);
    return progress;
  } catch (error) {
    if (!quiet) toastError(error);
    return null;
  }
}

export async function refreshUser() {
  const { user } = await api.me();
  store.set({ user, activeTrack: user.activeTrack });
  setMuted(!user.soundEnabled);
  return user;
}

// --- Pintado ----------------------------------------------------------------

const ROUTES = [
  { pattern: /^\/$/, handler: () => (store.isSignedIn ? redirect('/learn') : renderWelcome) },
  { pattern: /^\/welcome\/?$/, handler: () => renderWelcome, public: true },
  { pattern: /^\/onboarding\/?$/, handler: () => renderOnboarding },
  { pattern: /^\/learn\/?$/, handler: () => renderLearn },
  { pattern: /^\/lesson\/(\d+)\/?$/, handler: () => renderLesson },
  { pattern: /^\/result\/(\d+)\/?$/, handler: () => renderResult },
  { pattern: /^\/practice\/?$/, handler: () => renderPractice },
  { pattern: /^\/words\/?$/, handler: () => renderWords },
  { pattern: /^\/profile\/?$/, handler: () => renderProfile },
  { pattern: /^\/admin\/?$/, handler: () => renderAdmin },
  { pattern: /^\/privacy\/?$/, handler: () => renderPrivacy },
];

function redirect(path) {
  return () => { navigate(path, { replace: true }); };
}

let renderToken = 0;

export async function render() {
  const token = ++renderToken;
  const path = location.pathname;
  cancelSpeech();

  const match = ROUTES.find((route) => route.pattern.test(path));

  // Sin sesion: todo lleva a la pantalla de bienvenida.
  if (!store.isSignedIn) {
    renderShell(path, { chrome: false });
    paint(renderWelcome, []);
    return;
  }

  // Con sesion pero sin configuracion inicial: al onboarding.
  if(!store.user.progressUnavailable && store.user.progressNoticeVersion!==PROGRESS_NOTICE_VERSION && path!=='/privacy') {
    renderShell(path,{chrome:false});paint(renderPrivacy,[]);return;
  }
  if (!store.user.progressUnavailable && store.needsOnboarding && path !== '/onboarding' && !path.startsWith('/lesson/')) {
    navigate('/onboarding', { replace: true });
    return;
  }

  if (!match) {
    renderShell(path);
    paint(notFoundView, []);
    return;
  }

  const params = (path.match(match.pattern) ?? []).slice(1);
  const handler = match.handler();
  if (typeof handler !== 'function') return;

  // La leccion se ve a pantalla completa, sin navegacion, para concentrarse.
  const isLesson = path.startsWith('/lesson/');
  renderShell(path, { chrome: !isLesson });

  if (token !== renderToken) return;
  paint(handler, params);
}

function paint(handler, params) {
  const root=view(),token=renderToken;
  const host=el('div',{class:'view-content'});
  root.replaceChildren(host);
  try {
    const result = handler({ host, params, navigate:(...args)=>{if(token===renderToken)navigate(...args);}, refreshProgress, refreshUser });
    if (result instanceof Promise) {
      result.catch((error) => {
        if (error?.name === 'AbortError') return;
        if(token!==renderToken) return;
        console.error(error);
        clear(host);
        host.append(errorView(error));
      });
    }
  } catch (error) {
    console.error(error);
    clear(host);
    host.append(errorView(error));
  }
  document.getElementById('main').focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function notFoundView({ host }) {
  host.append(el('div', { class: 'empty' },
    el('h1', { text: 'Page not found' }),
    el('p', { class: 'muted', text: 'That address does not exist in Habla.' }),
    el('a', { class: 'btn', href: '/learn', 'data-route': '' }, t().nav.learn)
  ));
}

function errorView(error) {
  const message = error instanceof ApiError ? error.message : t().app.genericError;
  return el('div', { class: 'empty' },
    el('h2', { text: 'We could not load this screen' }),
    el('p', { class: 'muted', text: message }),
    el('button', {
      class: 'btn',
      type: 'button',
      onClick: () => render(),
    }, t().app.retry)
  );
}

/** Se llama tras entrar (invitado, registro o login). */
export async function afterSignIn(user) {
  store.set({ user, activeTrack: user.activeTrack ?? 'sql' });
  store.setPref('track',user.activeTrack ?? 'sql');
  await rememberProfile(user);
  setMuted(!user.soundEnabled);
  await refreshProgress();
  navigate(user.onboardingDone ? '/learn' : '/onboarding', { replace: true });
}

export async function signOut() {
  location.assign('/signout-with-chatgpt?return_to=%2F');
  return;
  try {
    await api.logout();
  } catch { /* si el servidor no responde, salimos igual en el cliente */ }
  store.reset();
  try { localStorage.removeItem('habla.recovery.v1'); } catch { /* opcional */ }
  navigate('/', { replace: true });
  toast('You are signed out.', { kind: 'info' });
}

// --- Sesion caducada --------------------------------------------------------
onSessionExpired(() => {
  if (!store.isSignedIn) return;
  store.reset();
  toast(t().app.sessionExpired, { kind: 'error' });
  navigate('/', { replace: true });
});

// --- Aviso de conexion ------------------------------------------------------
window.addEventListener('offline', () => toast(t().app.offline, { kind: 'offline' }));
window.addEventListener('online', () => {
  toast('You are back online.', { kind: 'success', duration: 2500 });
  refreshProgress();
});

// --- Arranque ---------------------------------------------------------------

async function boot() {
  // Precargamos las voces: en Chrome la lista llega con retraso.
  loadVoices().catch(() => {});

  try {
    await retry(() => api.me({ quiet: true }), { attempts: 2 })
      .then(({ user }) => {
        store.set({ user, activeTrack: user.activeTrack ?? 'sql' });
        setMuted(!user.soundEnabled);
      });
    await refreshProgress();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      store.reset();                 // normal: nadie ha entrado todavia
      try {
        const record = JSON.parse(localStorage.getItem('habla.recovery.v1'));
        if (record?.token) {
          const {user} = await api.recover(record.token);
          store.set({user,activeTrack:user.activeTrack});
          setMuted(!user.soundEnabled);
          await refreshProgress();
        }
      } catch { /* la pantalla de acceso permite entrar con una cuenta */ }
    } else if (error instanceof ApiError && error.isOffline) {
      toast(error.message, { kind: 'offline', action: { label: t().app.retry, onClick: boot } });
    }
  }

  if (store.user) await rememberProfile(store.user);

  document.getElementById('boot').hidden = true;
  document.getElementById('app').hidden = false;
  announce(store.isSignedIn ? 'Habla ready' : 'Welcome to Habla');
  render();
}

boot();

async function rememberProfile(user) {
  return; // Sites gestiona la identidad, no el almacenamiento del navegador.
  try {
    if (!user.isGuest) { localStorage.removeItem('habla.recovery.v1'); return; }
    const previous = JSON.parse(localStorage.getItem('habla.recovery.v1'));
    if (previous?.userId === user.id && previous.token) return;
    const {recoveryToken} = await api.remember();
    if (recoveryToken) localStorage.setItem('habla.recovery.v1',JSON.stringify({userId:user.id,token:recoveryToken}));
  } catch { /* el guardado de progreso en SQLite no depende del navegador */ }
}

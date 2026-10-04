// ---------------------------------------------------------------------------
// Audio con SpeechSynthesis del navegador.
// Documentacion: https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis
//
// No hay archivos de sonido ni servicios externos: la voz la genera el propio
// navegador a partir del texto que envia el servidor.
//
// Puntos delicados que este modulo resuelve:
//  1. En Chrome, getVoices() devuelve [] la primera vez. Hay que esperar al
//     evento `voiceschanged`. Aqui se espera con un limite de tiempo.
//  2. Puede no existir ninguna voz espanola. Entonces `isAvailable('es')` da
//     false y la interfaz muestra la ALTERNATIVA DE LECTURA.
//  3. Algunos navegadores nunca lanzan `end`. Hay un temporizador de rescate.
//  4. Nunca se pide acceso al microfono: esto solo habla, no escucha.
// ---------------------------------------------------------------------------

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

let voices = [];
let ready = false;
let readyPromise = null;
let muted = false;

export const isSupported = () =>
  Boolean(synth) && typeof window.SpeechSynthesisUtterance === 'function';

function collectVoices() {
  try {
    voices = synth.getVoices() ?? [];
  } catch {
    voices = [];
  }
  return voices;
}

/**
 * Espera a que el navegador publique la lista de voces.
 * Se resuelve igualmente pasado el limite, para no bloquear la leccion.
 */
export function loadVoices({ timeoutMs = 1500 } = {}) {
  if (!isSupported()) return Promise.resolve([]);
  if (ready) return Promise.resolve(voices);
  if (readyPromise) return readyPromise;

  readyPromise = new Promise((resolve) => {
    if (collectVoices().length > 0) {
      ready = true;
      resolve(voices);
      return;
    }
    const finish = () => {
      clearTimeout(timer);
      synth.removeEventListener?.('voiceschanged', onChange);
      ready = true;
      resolve(collectVoices());
    };
    const onChange = () => finish();
    const timer = setTimeout(finish, timeoutMs);
    synth.addEventListener?.('voiceschanged', onChange);
    // Algunos navegadores solo rellenan la lista tras la primera llamada.
    collectVoices();
  });
  return readyPromise;
}

/** Mejor voz para un idioma ('es', 'es-ES', 'en-GB'...). null si no hay. */
export function pickVoice(lang = 'es-ES') {
  if (voices.length === 0) collectVoices();
  const wanted = lang.toLowerCase();
  const base = wanted.split('-')[0];

  const exact = voices.find((voice) => voice.lang?.toLowerCase() === wanted);
  if (exact) return exact;

  const sameLanguage = voices.filter((voice) =>
    voice.lang?.toLowerCase().startsWith(base + '-') || voice.lang?.toLowerCase() === base);
  if (sameLanguage.length === 0) return null;

  // Preferimos una voz local (no depende de la red) y, para espanol, es-ES.
  return (
    sameLanguage.find((voice) => voice.localService && voice.lang.toLowerCase() === wanted) ??
    sameLanguage.find((voice) => voice.localService) ??
    sameLanguage[0]
  );
}

/** ¿Podemos hablar en este idioma en este navegador? */
export function isAvailable(lang = 'es-ES') {
  return isSupported() && pickVoice(lang) !== null;
}

export function setMuted(value) {
  muted = Boolean(value);
  if (muted) cancel();
}

export const isMuted = () => muted;

export function cancel() {
  try { synth?.cancel(); } catch { /* nada que cancelar */ }
}

/**
 * Lee un texto en voz alta.
 * @returns {Promise<{spoken: boolean, reason?: string}>}
 *   spoken: false significa "usa la alternativa de lectura".
 */
export function speak(text, { lang = 'es-ES', rate = 1, onStart, onEnd } = {}) {
  if (!text) return Promise.resolve({ spoken: false, reason: 'no_text' });
  if (muted) return Promise.resolve({ spoken: false, reason: 'muted' });
  if (!isSupported()) return Promise.resolve({ spoken: false, reason: 'unsupported' });

  const voice = pickVoice(lang);
  if (!voice) return Promise.resolve({ spoken: false, reason: 'no_voice' });

  cancel();

  return new Promise((resolve) => {
    let settled = false;
    const done = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(rescue);
      onEnd?.();
      resolve(result);
    };

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = voice.lang || lang;
    utterance.rate = rate;
    utterance.pitch = 1;

    utterance.onstart = () => onStart?.();
    utterance.onend = () => done({ spoken: true });
    utterance.onerror = (event) => {
      // 'interrupted'/'canceled' ocurren cuando el usuario pulsa otra cosa:
      // no son un fallo real del audio.
      const benign = event?.error === 'interrupted' || event?.error === 'canceled';
      done({ spoken: benign, reason: event?.error ?? 'error' });
    };

    // Rescate: si el navegador no avisa del final, lo damos por terminado.
    const estimate = Math.min(20000, 1200 + text.length * 90 / Math.max(rate, 0.3));
    const rescue = setTimeout(() => done({ spoken: true, reason: 'timeout' }), estimate);

    try {
      synth.speak(utterance);
    } catch {
      done({ spoken: false, reason: 'speak_failed' });
    }
  });
}

// Al cambiar de pagina, cortamos cualquier voz en curso.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', cancel);
  window.addEventListener('beforeunload', cancel);
}

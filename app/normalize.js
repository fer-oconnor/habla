// ---------------------------------------------------------------------------
// Normalizacion y comparacion de respuestas escritas.
//
// Reglas (las mismas que documenta el README):
//  1. Se ignoran mayusculas/minusculas.
//  2. Se ignoran espacios de sobra y la puntuacion de adorno (¿ ¡ ? ! . , ; : « » " ').
//  3. La ñ NUNCA se convierte en n: «años» y «anos» son palabras distintas.
//  4. Las tildes se perdonan SOLO si ninguna variante aceptada contiene una
//     palabra en la que la tilde cambia el significado (si/sí, el/él, como/cómo,
//     esta/está...). En esos casos hay que escribir la tilde.
// ---------------------------------------------------------------------------

// Palabras (en su forma sin tilde) donde la tilde cambia el significado.
// Si alguna aparece en la solucion, la comparacion exige la tilde correcta.
export const ACCENT_SENSITIVE_BASES = new Set([
  'si', 'el', 'tu', 'mi', 'te', 'se', 'de', 'mas', 'solo', 'aun',
  'que', 'como', 'donde', 'cuando', 'cuanto', 'cuantos', 'quien', 'cual',
  'esta', 'estas', 'este', 'esa', 'ese', 'porque',
]);

const PUNCTUATION_RE = /[¿¡?!.,;:"'«»“”‘’…()\-–—]/g;

/**
 * Pasa un texto a su forma comparable: minusculas, sin puntuacion de adorno y
 * con un solo espacio entre palabras. Conserva tildes y ñ.
 */
export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(PUNCTUATION_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Quita tildes de las vocales. Deja la ñ y la ü intactas como letras. */
export function foldAccents(value) {
  return String(value ?? '')
    .replace(/[áàâä]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[íìîï]/g, 'i')
    .replace(/[óòôö]/g, 'o')
    .replace(/[úùû]/g, 'u');
}

/** ¿Alguna palabra de este texto pertenece a los pares sensibles a la tilde? */
export function isAccentSensitive(normalized) {
  return normalized
    .split(' ')
    .some((word) => ACCENT_SENSITIVE_BASES.has(foldAccents(word)));
}

/**
 * Compara la respuesta del usuario con la lista de variantes aceptadas.
 * Devuelve { correct, matched } donde `matched` es la variante que encajo.
 */
export function matchesAccepted(userAnswer, acceptedList) {
  const user = normalizeText(userAnswer);
  if (user === '') return { correct: false, matched: null };
  const userFolded = foldAccents(user);

  for (const accepted of acceptedList) {
    const target = normalizeText(accepted);
    if (user === target) return { correct: true, matched: accepted };
    if (!isAccentSensitive(target) && userFolded === foldAccents(target)) {
      return { correct: true, matched: accepted };
    }
  }
  return { correct: false, matched: null };
}

/**
 * Huella estable de una respuesta, para detectar reenvios identicos.
 * Un objeto de pares se ordena por clave para que el orden no importe.
 */
export function answerDigest(answer) {
  if (typeof answer === 'string') return 'text:' + normalizeText(answer);
  if (Array.isArray(answer)) {
    return 'list:' + answer.map((item) => normalizeText(item)).join('|');
  }
  if (answer && typeof answer === 'object') {
    const pairs = Object.entries(answer)
      .map(([key, value]) => `${normalizeText(key)}=${normalizeText(value)}`)
      .sort();
    return 'pairs:' + pairs.join('|');
  }
  return 'empty:';
}

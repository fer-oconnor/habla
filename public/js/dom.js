// ---------------------------------------------------------------------------
// Ayudas minimas para crear elementos sin librerias.
//
// Regla de seguridad: el texto que escribe el usuario (su nombre, sus
// respuestas) SIEMPRE se pone con textContent, nunca con innerHTML.
// La politica de seguridad (CSP) prohibe atributos style="", asi que los
// tamanos dinamicos se ponen con element.style.setProperty(...).
// ---------------------------------------------------------------------------

/**
 * Crea un elemento.
 * el('button', { class: 'btn', onClick: fn, 'aria-label': 'x' }, 'Texto')
 */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;      // solo con SVG propio
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, value);
  }

  append(node, children);
  return node;
}

export function append(parent, children) {
  for (const child of children.flat(4)) {
    if (child === null || child === undefined || child === false) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

export function clear(node) {
  while (node.firstChild) node.firstChild.remove();
  return node;
}

export const $ = (selector, root = document) => root.querySelector(selector);

/** Envoltorio de un icono SVG (la cadena viene de icons.js, no del usuario). */
export function icon(svg, { class: className = '', label } = {}) {
  const span = el('span', { class: className, html: svg, 'aria-hidden': label ? null : 'true' });
  if (label) span.setAttribute('role', 'img');
  if (label) span.setAttribute('aria-label', label);
  return span;
}

/** Barra de progreso accesible. `setValue` la actualiza sin recrearla. */
export function progressBar(value, max, { label, variant = '' } = {}) {
  const fill = el('div', { class: 'bar__fill' + (variant ? ` bar__fill--${variant}` : '') });
  const bar = el('div', {
    class: 'bar',
    role: 'progressbar',
    'aria-valuemin': '0',
    'aria-valuemax': String(max),
    'aria-valuenow': String(value),
    'aria-label': label ?? 'Progress',
  }, fill);

  bar.setValue = (next) => {
    const percent = max === 0 ? 0 : Math.max(0, Math.min(100, (next / max) * 100));
    fill.style.setProperty('width', `${percent}%`);
    bar.setAttribute('aria-valuenow', String(next));
  };
  bar.setValue(value);
  return bar;
}

/** Mezcla estable con semilla: el mismo id produce siempre el mismo orden. */
export function seededShuffle(items, seed) {
  const list = [...items];
  let state = 0;
  for (const char of String(seed)) state = (state * 31 + char.charCodeAt(0)) % 2147483647;
  if (state === 0) state = 1;
  for (let index = list.length - 1; index > 0; index -= 1) {
    state = (state * 48271) % 2147483647;
    const swap = state % (index + 1);
    [list[index], list[swap]] = [list[swap], list[index]];
  }
  return list;
}

export function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      .format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

/** Anuncia algo a los lectores de pantalla sin cambiar el foco. */
let liveRegion = null;
export function announce(message) {
  if (!liveRegion) {
    liveRegion = el('div', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
    document.body.append(liveRegion);
  }
  liveRegion.textContent = '';
  // Un pequeno retraso asegura que el lector lo lea incluso si repite texto.
  setTimeout(() => { liveRegion.textContent = message; }, 40);
}

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

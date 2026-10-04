// ---------------------------------------------------------------------------
// Avisos emergentes. Se usan para errores de red y confirmaciones.
// Nunca dependen solo del color: llevan icono y texto.
// ---------------------------------------------------------------------------

import { el, icon, clear } from './dom.js?v=studio20261003';
import { icons } from './icons.js?v=studio20261003';
import { t } from './i18n.js?v=studio20261003';

const host = () => document.getElementById('toasts');

const ICON_BY_KIND = {
  error: icons.warning,
  offline: icons.wifiOff,
  success: icons.check,
  info: icons.info,
};

/**
 * @param {string} message texto a mostrar
 * @param {object} options kind: 'info'|'error'|'success'|'offline',
 *                         action: { label, onClick }, duration: ms (0 = fijo)
 */
export function toast(message, { kind = 'info', action, duration } = {}) {
  const container = host();
  if (!container) return () => {};

  const node = el('div', { class: `toast toast--${kind}` },
    icon(ICON_BY_KIND[kind] ?? icons.info),
    el('span', { class: 'grow', text: message })
  );

  const remove = () => node.remove();

  if (action) {
    node.append(el('button', {
      class: 'toast__action',
      type: 'button',
      onClick: () => { remove(); action.onClick(); },
    }, action.label));
  } else {
    node.append(el('button', {
      class: 'toast__action',
      type: 'button',
      'aria-label': t().app.dismiss,
      onClick: remove,
    }, t().app.dismiss));
  }

  container.append(node);
  const life = duration ?? (kind === 'error' || kind === 'offline' ? 8000 : 3500);
  if (life > 0) setTimeout(remove, life);
  return remove;
}

/** Muestra un ApiError de forma util, con boton de reintentar si procede. */
export function toastError(error, onRetry) {
  const message = error?.message ?? t().app.genericError;
  const kind = error?.isOffline ? 'offline' : 'error';
  const canRetry = typeof onRetry === 'function' && (error?.isRetryable ?? true);
  return toast(message, {
    kind,
    action: canRetry ? { label: t().app.retry, onClick: onRetry } : undefined,
  });
}

export function clearToasts() {
  const container = host();
  if (container) clear(container);
}

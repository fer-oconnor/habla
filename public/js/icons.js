// ---------------------------------------------------------------------------
// Iconos SVG en linea. Son cadenas fijas escritas aqui (nunca datos del
// usuario), asi que se pueden insertar con innerHTML sin riesgo.
// Todos usan currentColor, asi que heredan el color del texto.
// ---------------------------------------------------------------------------

const wrap = (body, extra = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ` +
  `stroke-linecap="round" stroke-linejoin="round" ${extra}>${body}</svg>`;

export const icons = {
  learn: wrap('<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H5.5A1.5 1.5 0 0 1 4 15.5Z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h4.5A1.5 1.5 0 0 0 20 15.5Z"/>'),
  practice: wrap('<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v5h-5"/>'),
  words: wrap('<path d="M4 6h16"/><path d="M4 12h10"/><path d="M4 18h7"/><circle cx="18.5" cy="16.5" r="3"/>'),
  profile: wrap('<circle cx="12" cy="8" r="4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>'),

  check: wrap('<path d="M20 6 9 17l-5-5"/>'),
  cross: wrap('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
  lock: wrap('<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'),
  play: wrap('<path d="M7 4.5v15l12-7.5Z" fill="currentColor" stroke="none"/>'),
  speaker: wrap('<path d="M11 5 6 9H3v6h3l5 4Z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M19 6.5a8 8 0 0 1 0 11"/>'),
  speakerSlow: wrap('<path d="M11 5 6 9H3v6h3l5 4Z"/><path d="M16 10.5a2.5 2.5 0 0 1 0 3"/>'),
  book: wrap('<path d="M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3Z"/><path d="M17 7h2v13H8"/>'),
  flame: wrap('<path d="M12 22c4 0 6.5-2.6 6.5-6 0-4.5-4-6.5-4-10.5C12 7 10.5 8.5 10.5 10.5 10.5 8 8.5 7 8.5 7 6.5 9 5.5 11.5 5.5 16c0 3.4 2.5 6 6.5 6Z"/>'),
  bolt: wrap('<path d="M13 2 4 14h6l-1 8 9-12h-6Z"/>'),
  target: wrap('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>'),
  seed: wrap('<path d="M12 21v-7"/><path d="M12 14c-4 0-7-2.5-7-6.5C9 7.5 12 10 12 14Z"/><path d="M12 14c4 0 7-2.5 7-6.5C15 7.5 12 10 12 14Z"/>'),
  star: wrap('<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9Z"/>'),
  trophy: wrap('<path d="M8 4h8v5a4 4 0 0 1-8 0Z"/><path d="M8 5H5v2a3 3 0 0 0 3 3"/><path d="M16 5h3v2a3 3 0 0 1-3 3"/><path d="M12 13v4"/><path d="M8.5 20h7"/>'),
  arrowRight: wrap('<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>'),
  arrowLeft: wrap('<path d="M19 12H5"/><path d="m11 18-6-6 6-6"/>'),
  search: wrap('<circle cx="11" cy="11" r="7"/><path d="m20 20-4.3-4.3"/>'),
  info: wrap('<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>'),
  warning: wrap('<path d="M12 3 2.5 20h19Z"/><path d="M12 9v5"/><path d="M12 17h.01"/>'),
  wifiOff: wrap('<path d="M3 3l18 18"/><path d="M5 12.5a10 10 0 0 1 4-2.4"/><path d="M15 10.1a10 10 0 0 1 4 2.4"/><path d="M8.5 16a6 6 0 0 1 7 0"/><path d="M12 20h.01"/>'),
  table: wrap('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M9 10v10"/>'),
  filter: wrap('<path d="M3 5h18"/><path d="M7 12h10"/><path d="M10 19h4"/>'),
  sun: wrap('<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5"/><path d="M12 19.5V22"/><path d="M2 12h2.5"/><path d="M19.5 12H22"/><path d="m5 5 1.8 1.8"/><path d="m17.2 17.2 1.8 1.8"/><path d="m19 5-1.8 1.8"/><path d="M6.8 17.2 5 19"/>'),
  swap: wrap('<path d="M7 4 4 7l3 3"/><path d="M4 7h11a4 4 0 0 1 0 8H9"/><path d="m11 20 3-3-3-3"/>'),
  logout: wrap('<path d="M9 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3"/><path d="M15 8l4 4-4 4"/><path d="M19 12H9"/>'),
  pencil: wrap('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16Z"/>'),
};

/** Icono de una unidad o de un track, por nombre. */
export function contentIcon(name) {
  return icons[name] ?? icons.sun;
}

export default icons;

// ---------------------------------------------------------------------------
// Navegacion y cabecera.
//   * En ordenador (>= 900 px): navegacion lateral + recorrido central.
//   * En movil: barra superior con las estadisticas y navegacion inferior con
//     Learn, Practice, Words y Profile.
// Es el mismo modelo de datos en los dos casos; solo cambia el CSS.
// ---------------------------------------------------------------------------

import { clear, el, icon } from './dom.js?v=programming20261002';
import { icons } from './icons.js?v=programming20261002';
import { t } from './i18n.js?v=programming20261002';
import { store } from './store.js?v=programming20261002';

const NAV = [
  { path: '/learn', key: 'learn', icon: 'learn' },
  { path: '/practice', key: 'practice', icon: 'practice' },
  { path: '/words', key: 'words', icon: 'words' },
  { path: '/profile', key: 'profile', icon: 'profile' },
];

function navItem({ path, key, icon: iconName }, currentPath, { compact }) {
  const active = currentPath === path || currentPath.startsWith(path + '/');
  const label = t().nav[key];

  const link = el('a', {
    class: 'navlink',
    href: path,
    'data-route': '',
    'aria-current': active ? 'page' : null,
  },
    icon(icons[iconName], { class: 'navlink__icon' }),
    el('span', { text: label })
  );

  // Aviso de errores pendientes sobre Practice
  const pending = store.progress?.pendingReviews ?? 0;
  if (key === 'practice' && pending > 0) {
    link.append(el('span', {
      class: 'navlink__badge',
      'aria-label': `${pending} pending`,
      text: pending > 9 ? '9+' : String(pending),
    }));
  }

  return el('li', { class: compact ? 'bottomnav__item' : '' }, link);
}

function statChip({ iconName, value, label, variant }) {
  return el('div', {
    class: 'stat',
    role: 'group',
    'aria-label': `${label}: ${value}`,
  },
    icon(icons[iconName], { class: 'stat__icon' + (variant ? ` stat__icon--${variant}` : '') }),
    el('div', {},
      el('div', { class: 'stat__value', text: String(value) }),
      el('div', { class: 'stat__label', text: label })
    )
  );
}

function statsFor(progress) {
  if (!progress) return [];
  return [
    statChip({ iconName: 'flame', value: progress.currentStreak, label: t().profile.streak }),
    statChip({ iconName: 'bolt', value: progress.xp, label: t().profile.xp }),
    statChip({
      iconName: 'target',
      value: `${progress.today.lessons}/${progress.today.goal}`,
      label: t().learn.goalTitle,
    }),
  ];
}

/** Dibuja (o esconde) toda la estructura segun el estado de la sesion. */
export function renderShell(currentPath, { chrome = true } = {}) {
  const sidebar = document.getElementById('sidebar');
  const bottomnav = document.getElementById('bottomnav');
  const topbar = document.getElementById('topbar');
  const show = chrome && store.isSignedIn && !store.needsOnboarding;

  sidebar.hidden = !show;
  bottomnav.hidden = !show;
  topbar.hidden = !show;
  document.getElementById('main').classList.toggle('main--bare', !show);

  if (!show) return;

  const sidebarNav = document.getElementById('sidebar-nav');
  clear(sidebarNav);
  for (const item of NAV) sidebarNav.append(navItem(item, currentPath, { compact: false }));

  const bottomList = document.getElementById('bottomnav-list');
  clear(bottomList);
  for (const item of NAV) bottomList.append(navItem(item, currentPath, { compact: true }));

  const stats = statsFor(store.progress);
  const sidebarStats = document.getElementById('sidebar-stats');
  clear(sidebarStats);
  for (const chip of stats) sidebarStats.append(chip);

  const topStats = document.getElementById('topbar-stats');
  clear(topStats);
  for (const chip of statsFor(store.progress)) topStats.append(chip);
}

// ---------------------------------------------------------------------------
// Pantalla H: Profile.
// Nombre, objetivo diario, estadisticas, logros, preferencias de sonido y
// cierre de sesion. Todos los ajustes se guardan con PATCH /me.
// ---------------------------------------------------------------------------

import { api } from '../api.js?v=programming20261002';
import { el, formatDate, icon, progressBar } from '../dom.js?v=programming20261002';
import { icons } from '../icons.js?v=programming20261002';
import { t } from '../i18n.js?v=programming20261002';
import { store } from '../store.js?v=programming20261002';
import { signOut } from '../main.js?v=programming20261002';
import { toast, toastError } from '../toast.js?v=programming20261002';
import { setMuted } from '../audio.js?v=programming20261002';

const ACHIEVEMENT_ICON = {
  first_lesson: 'seed', five_lessons: 'star', streak_3: 'flame',
};

export default async function renderProfile({ host, refreshProgress }) {
  const copy = t().profile;
  const container = el('div', { class: 'stack' });
  host.append(container);

  const progress = await refreshProgress({ quiet: false }) ?? store.progress;
  if (!progress) {
    container.append(el('div', { class: 'empty' },
      el('p', { class: 'muted', text: t().app.genericError })));
    return;
  }
  const user = store.user;
  const tracks = store.tracks.length > 0
    ? store.tracks
    : (await api.tracks().catch(() => ({ tracks: [] }))).tracks;
  if (tracks.length > 0) store.set({ tracks });

  // --- Guardado de ajustes -------------------------------------------------
  async function save(changes, { silent = false } = {}) {
    try {
      const { user: updated } = await api.updateMe(changes);
      store.set({ user: updated, activeTrack: updated.activeTrack });
      if (!silent) toast(t().app.saved, { kind: 'success', duration: 1800 });
      return updated;
    } catch (error) {
      toastError(error, () => save(changes, { silent }));
      return null;
    }
  }

  // --- Cabecera ------------------------------------------------------------
  const initials = (user.displayName || 'H').trim().slice(0, 2).toUpperCase();

  const header = el('div', { class: 'card' },
    el('div', { class: 'row' },
      el('div', { class: 'avatar', 'aria-hidden': 'true', text: initials }),
      el('div', { class: 'grow' },
        el('h1', { text: user.displayName }),
        el('p', { class: 'faint', text: user.isGuest ? copy.guestBadge : user.email })
      )
    ),
    user.isGuest
      ? el('p', { class: 'faint' }, icon(icons.info), ' ', copy.guestNote)
      : null
  );

  if (user.isGuest) header.append(el('a',{class:'btn btn--ghost',href:'/welcome','data-route':'',
    text:'Crear cuenta conservando mi progreso'}));

  // --- Estadisticas --------------------------------------------------------
  const statsGrid = el('div', { class: 'result__grid' },
    tile(progress.xp, copy.xp),
    tile(copy.days(progress.currentStreak), copy.streak),
    tile(`${progress.lessonsPassed}/${progress.lessonsTotal}`, copy.lessons),
    tile(`${progress.accuracy.percent}%`, copy.accuracy),
    tile(`${progress.vocabulary.learned}/${progress.vocabulary.total}`, copy.words),
    tile(copy.days(progress.longestStreak), copy.longest)
  );

  // --- Semana --------------------------------------------------------------
  const week = el('div', { class: 'week' },
    ...progress.week.map((day) => {
      const level = day.goalMet ? 'met' : day.lessons > 0 ? 'some' : 'none';
      return el('div', { class: 'week__day' },
        el('div', {
          class: `week__dot${level === 'none' ? '' : ` week__dot--${level}`}`,
          // El texto lo dice todo: no depende del color.
          'aria-label': `${day.label}: ${day.lessons} lessons, ${day.xp} XP`,
          role: 'img',
          text: String(day.lessons),
        }),
        el('span', { text: day.label.split(' ')[0] })
      );
    })
  );

  // --- Progreso por curso --------------------------------------------------
  const trackProgress = el('div', { class: 'stack--tight' },
    ...(progress.tracks ?? []).map((track) => {
      const bar = progressBar(track.completed, track.lessons, { label: track.title });
      return el('div', { class: 'stack--tight' },
        el('div', { class: 'row row--between' },
          el('strong', { text: track.title }),
          el('span', { class: 'faint', text: `${track.completed}/${track.lessons}` })
        ),
        bar
      );
    })
  );

  // --- Logros --------------------------------------------------------------
  const achievements = el('div', { class: 'achievements' },
    ...progress.achievements.map((item) => el('div', {
      class: `achievement${item.earned ? '' : ' achievement--locked'}`,
    },
      icon(icons[ACHIEVEMENT_ICON[item.code] ?? 'trophy'], { class: 'achievement__icon' }),
      el('div', { class: 'grow' },
        el('div', { class: 'achievement__title', text: item.title }),
        el('div', { class: 'faint', text: item.description })
      ),
      el('span', {
        class: item.earned ? 'pill pill--success' : 'pill',
        text: item.earned ? formatDate(item.earnedAt) : copy.locked,
      })
    ))
  );

  // --- Ajustes -------------------------------------------------------------
  const nameInput = el('input', {
    class: 'input', type: 'text', id: 'pf-name', maxlength: '40', value: user.displayName,
  });
  const nameBtn = el('button', { class: 'btn btn--ghost', type: 'button' },
    icon(icons.pencil), t().app.save);
  nameBtn.addEventListener('click', async () => {
    const value = nameInput.value.trim();
    if (!value || value === user.displayName) return;
    nameBtn.disabled = true;
    const updated = await save({ displayName: value });
    if (updated) {
      host.querySelector('.avatar').textContent = value.slice(0, 2).toUpperCase();
      host.querySelector('h1').textContent = value;
    }
    nameBtn.disabled = false;
  });

  const goalSelect = el('select', { class: 'input', id: 'pf-goal' },
    ...[1, 2, 3].map((value) => el('option', {
      value: String(value), selected: user.dailyGoal === value,
    }, t().onboarding.goals[value].detail))
  );
  goalSelect.addEventListener('change', async () => {
    await save({ dailyGoal: Number(goalSelect.value) });
    await refreshProgress();
  });

  const zones = [...new Set([
    user.timezone,
    safeZone(),
    'Europe/Madrid', 'Europe/London', 'America/New_York', 'America/Los_Angeles',
    'America/Mexico_City', 'America/Bogota', 'Asia/Kolkata', 'Asia/Tokyo', 'UTC',
  ].filter(Boolean))];
  const zoneSelect = el('select', { class: 'input', id: 'pf-tz' },
    ...zones.map((zone) => el('option', {
      value: zone, selected: zone === user.timezone,
    }, zone))
  );
  zoneSelect.addEventListener('change', async () => {
    await save({ timezone: zoneSelect.value });
    await refreshProgress();
  });

  const soundSwitch = el('button', {
    class: 'switch__box',
    type: 'button',
    role: 'switch',
    'aria-checked': String(user.soundEnabled),
    'aria-label': copy.soundLabel,
  });
  soundSwitch.addEventListener('click', async () => {
    const next = soundSwitch.getAttribute('aria-checked') !== 'true';
    soundSwitch.setAttribute('aria-checked', String(next));
    setMuted(!next);
    await save({ soundEnabled: next }, { silent: true });
  });

  const courseSelect = el('select', { class: 'input', id: 'pf-course' },
    ...tracks.map((track) => el('option', {
      value: track.slug, selected: track.slug === user.activeTrack,
    }, track.title))
  );
  courseSelect.addEventListener('change', async () => {
    store.setPref('track', courseSelect.value);
    await save({ activeTrack: courseSelect.value });
  });

  const signOutBtn = el('button', { class: 'btn btn--coral btn--block', type: 'button' },
    icon(icons.logout), copy.signOut);
  signOutBtn.addEventListener('click', () => {
    const message = user.isGuest ? copy.signOutGuestConfirm : copy.signOutConfirm;
    if (window.confirm(message)) signOut();
  });

  const settings = el('div', { class: 'card stack' },
    el('h2', { text: copy.settings }),
    el('div', { class: 'field' },
      el('label', { for: 'pf-name', text: copy.nameLabel }),
      el('div', { class: 'row' }, el('span', { class: 'grow' }, nameInput), nameBtn)
    ),
    el('div', { class: 'field' },
      el('label', { for: 'pf-goal', text: copy.goalLabel }), goalSelect),
    el('div', { class: 'field' },
      el('label', { for: 'pf-tz', text: copy.timezoneLabel }), zoneSelect,
      el('span', { class: 'field__hint', text: t().onboarding.timezoneHint })),
    el('div', { class: 'field' },
      el('label', { for: 'pf-course', text: copy.courseLabel }), courseSelect),
    el('div', { class: 'switch' },
      el('div', {},
        el('strong', { text: copy.soundLabel }),
        el('div', { class: 'field__hint', text: copy.soundHint })
      ),
      soundSwitch
    ),
    signOutBtn
  );

  container.replaceChildren(
    header,
    el('section', { class: 'card stack' },
      el('h2', { text: copy.stats }), statsGrid,
      el('h3', { text: copy.week }), week,
      trackProgress
    ),
    el('section', { class: 'stack' },
      el('h2', { text: copy.achievements }), achievements),
    settings
  );
}

function tile(value, label) {
  return el('div', { class: 'result__tile' },
    el('strong', { text: String(value) }),
    el('span', { text: label })
  );
}

function safeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

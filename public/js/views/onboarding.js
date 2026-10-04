// ---------------------------------------------------------------------------
// Pantalla B: configuracion inicial.
// Nombre, objetivo diario (1, 2 o 3 lecciones) y zona horaria detectada.
// Todo se guarda con PATCH /me, asi que sobrevive a recargas y reinicios.
// ---------------------------------------------------------------------------

import { api } from '../api.js?v=studio20261003';
import { el, icon } from '../dom.js?v=studio20261003';
import { icons } from '../icons.js?v=studio20261003';
import { t } from '../i18n.js?v=studio20261003';
import { store } from '../store.js?v=studio20261003';
import { toastError } from '../toast.js?v=studio20261003';

/** Lista corta de zonas frecuentes + la detectada + la del perfil. */
function timeZoneOptions(current) {
  const common = [
    'Europe/Madrid', 'Europe/London', 'Europe/Berlin', 'America/New_York',
    'America/Chicago', 'America/Los_Angeles', 'America/Mexico_City',
    'America/Bogota', 'America/Argentina/Buenos_Aires', 'Africa/Lagos',
    'Asia/Kolkata', 'Asia/Tokyo', 'Australia/Sydney', 'UTC',
  ];
  let detected = 'UTC';
  try {
    detected = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch { /* nos quedamos con UTC */ }
  return { detected, list: [...new Set([detected, current, ...common].filter(Boolean))] };
}

export default function renderOnboarding({ host, navigate, refreshProgress }) {
  const copy = t().onboarding;
  const user = store.user;
  const { detected, list } = timeZoneOptions(user?.timezone);

  const name = el('input', {
    class: 'input input--big', type: 'text', id: 'ob-name', maxlength: '40',
    autocomplete: 'nickname',
    value: user && !user.isGuest ? user.displayName : '',
    placeholder: t().welcome.namePlaceholder,
  });

  const goals = el('div', { class: 'goals', role: 'radiogroup', 'aria-labelledby': 'ob-goal' },
    ...[1, 2, 3].map((value) => {
      const input = el('input', {
        type: 'radio', name: 'dailyGoal', value: String(value), id: `ob-goal-${value}`,
        checked: (user?.dailyGoal ?? 1) === value,
      });
      return el('label', { class: 'goal', for: `ob-goal-${value}` },
        input,
        el('span', { class: 'goal__mark' }, icon(icons.check)),
        el('span', {},
          el('span', { class: 'goal__title', text: copy.goals[value].title }),
          el('br'),
          el('span', { class: 'faint', text: copy.goals[value].detail })
        )
      );
    })
  );

  const timezone = el('select', { class: 'input', id: 'ob-tz' },
    ...list.map((zone) => el('option', {
      value: zone,
      selected: zone === (user?.timezone && user.timezone !== 'UTC' ? user.timezone : detected),
    }, zone === detected ? `${zone} — ${copy.detected}` : zone))
  );

  const submitBtn = el('button', { class: 'btn btn--lg btn--block', type: 'submit' },
    copy.start, icon(icons.arrowRight));

  const errorBox = el('div', { class: 'formerror', role: 'alert', hidden: true });

  const form = el('form', { class: 'card stack', novalidate: true },
    errorBox,
    el('div', { class: 'field' },
      el('label', { for: 'ob-name', text: copy.nameLabel }),
      name
    ),
    el('div', { class: 'field' },
      el('span', { class: 'field__label', id: 'ob-goal' },
        el('strong', { text: copy.goalLabel })),
      el('span', { class: 'field__hint', text: copy.goalHint }),
      goals
    ),
    el('div', { class: 'field' },
      el('label', { for: 'ob-tz', text: copy.timezoneLabel }),
      timezone,
      el('span', { class: 'field__hint', text: copy.timezoneHint })
    ),
    submitBtn
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.hidden = true;
    submitBtn.disabled = true;

    const payload = {
      displayName: name.value.trim() || (user?.isGuest ? 'Guest' : 'Learner'),
      dailyGoal: Number(form.querySelector('input[name="dailyGoal"]:checked')?.value ?? 1),
      timezone: timezone.value,
      onboardingDone: true,
    };

    try {
      const { user: updated } = await api.updateMe(payload);
      store.set({ user: updated });
      await refreshProgress();
      navigate('/learn', { replace: true });
    } catch (error) {
      errorBox.hidden = false;
      errorBox.replaceChildren(icon(icons.warning), el('span', { text: error.message }));
      toastError(error);
    } finally {
      submitBtn.disabled = false;
    }
  });

  host.append(el('div', { class: 'welcome' },
    el('div', { class: 'welcome__hero' },
      el('img', {
        src: '/assets/mascot-sun.svg', alt: '', width: '84', height: '84',
        class: 'welcome__mascot',
      }),
      el('h1', { text: copy.title }),
      el('p', { class: 'lede', text: copy.subtitle })
    ),
    form
  ));

  name.focus({ preventScroll: true });
}

// ---------------------------------------------------------------------------
// Pantalla A: bienvenida y acceso.
// Registro, inicio de sesion y "Try as a guest" (cada invitado es un usuario
// y una sesion propios, guardados en SQLite).
// ---------------------------------------------------------------------------

import { api } from '../api.js?v=programming20261002';
import { el, icon } from '../dom.js?v=programming20261002';
import { icons } from '../icons.js?v=programming20261002';
import { t } from '../i18n.js?v=programming20261002';
import { afterSignIn } from '../main.js?v=programming20261002';
import { toastError } from '../toast.js?v=programming20261002';
import { store } from '../store.js?v=programming20261002';

const detectTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

export default function renderWelcome({ host }) {
  const copy = t().welcome;
  let mode = 'guest';          // 'guest' | 'signin' | 'signup'

  const errorBox = el('div', { class: 'formerror', role: 'alert', hidden: true });
  const formSlot = el('div', { class: 'stack' });

  function showError(error) {
    errorBox.hidden = false;
    errorBox.replaceChildren(icon(icons.warning), el('span', { text: error.message }));
    errorBox.scrollIntoView({ block: 'nearest' });
  }
  function hideError() { errorBox.hidden = true; }

  /** Envuelve un envio: bloquea el boton, muestra el error y NO pierde lo escrito. */
  async function submit(button, busyLabel, run) {
    hideError();
    const original = button.textContent;
    button.disabled = true;
    button.textContent = busyLabel;
    try {
      const { user } = await run();
      await afterSignIn(user);
    } catch (error) {
      showError(error);
      if (error.isRetryable) {
        toastError(error, () => submit(button, busyLabel, run));
      }
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  // --- Formularios ---------------------------------------------------------

  function guestPanel() {
    const button = el('button', { class: 'btn btn--lg btn--block', type: 'button' },
      icon(icons.play), copy.guest);
    button.addEventListener('click', () =>
      submit(button, copy.startingGuest, () =>
        api.guest({ timezone: detectTimeZone() })));

    return el('div', { class: 'stack' },
      button,
      el('p', { class: 'faint center', text: copy.guestHint }),
      el('div', { class: 'divider' }, copy.or),
      el('div', { class: 'row' },
        el('button', {
          class: 'btn btn--ghost grow', type: 'button',
          onClick: () => setMode('signin'),
        }, copy.signIn),
        el('button', {
          class: 'btn btn--ghost grow', type: 'button',
          onClick: () => setMode('signup'),
        }, copy.signUp)
      )
    );
  }

  function credentialsPanel(kind) {
    const isSignUp = kind === 'signup';

    const email = el('input', {
      class: 'input', type: 'email', id: 'wc-email', name: 'email',
      autocomplete: 'email', required: true, placeholder: 'you@example.com',
    });
    const password = el('input', {
      class: 'input', type: 'password', id: 'wc-password', name: 'password',
      autocomplete: isSignUp ? 'new-password' : 'current-password',
      required: true, minlength: '8',
    });
    const name = isSignUp
      ? el('input', {
          class: 'input', type: 'text', id: 'wc-name', name: 'name',
          autocomplete: 'nickname', maxlength: '40', placeholder: copy.namePlaceholder,
        })
      : null;

    const button = el('button', { class: 'btn btn--lg btn--block', type: 'submit' },
      isSignUp ? copy.signUp : copy.signIn);

    const form = el('form', { class: 'stack', novalidate: true },
      el('div', { class: 'field' },
        el('label', { for: 'wc-email', text: copy.email }), email),
      el('div', { class: 'field' },
        el('label', { for: 'wc-password', text: copy.password }),
        password,
        isSignUp ? el('span', { class: 'field__hint', text: copy.passwordHint }) : null),
      name
        ? el('div', { class: 'field' },
            el('label', { for: 'wc-name', text: copy.name }), name)
        : null,
      button
    );

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const payload = {
        email: email.value.trim(),
        password: password.value,
        timezone: detectTimeZone(),
      };
      if (isSignUp) {
        payload.displayName = name.value.trim() || payload.email.split('@')[0];
      }
      submit(
        button,
        isSignUp ? copy.creating : copy.signingIn,
        () => (isSignUp ? api.register(payload) : api.login(payload))
      );
    });

    return el('div', { class: 'stack' },
      form,
      el('div', { class: 'divider' }, copy.or),
      el('button', {
        class: 'btn btn--ghost btn--block', type: 'button',
        onClick: () => setMode('guest'),
      }, copy.guest),
      el('p', { class: 'faint center' },
        isSignUp ? copy.haveAccount : copy.noAccount,
        ' ',
        el('button', {
          class: 'btn btn--quiet', type: 'button',
          onClick: () => setMode(isSignUp ? 'signin' : 'signup'),
        }, isSignUp ? copy.signIn : copy.signUp))
    );
  }

  function setMode(next) {
    mode = next;
    hideError();
    for (const button of tabs.querySelectorAll('.tabs__btn')) {
      button.setAttribute('aria-selected', String(button.dataset.mode === mode));
    }
    formSlot.replaceChildren(mode === 'guest' ? guestPanel() : credentialsPanel(mode));
    const firstField = formSlot.querySelector('input');
    if (firstField) firstField.focus({ preventScroll: true });
  }

  const tabs = el('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Sign-in options' },
    ...[
      { mode: 'guest', label: copy.guest },
      { mode: 'signin', label: copy.signIn },
      { mode: 'signup', label: copy.signUp },
    ].map(({ mode: value, label }) => el('button', {
      class: 'tabs__btn',
      type: 'button',
      role: 'tab',
      'aria-selected': String(value === mode),
      dataset: { mode: value },
      onClick: () => setMode(value),
    }, label))
  );

  host.append(el('div', { class: 'welcome' },
    el('div', { class: 'welcome__hero' },
      el('img', {
        class: 'welcome__mascot', src: '/assets/mascot-sun.svg',
        alt: '', width: '112', height: '112',
      }),
      el('h1', { class: 'welcome__brand' }, 'Habl', el('em', { text: 'a' })),
      el('p', { class: 'welcome__tag', text: copy.subtitle })
    ),
    el('div', { class: 'card stack' },
      tabs,
      errorBox,
      formSlot
    ),
    el('ul', { class: 'benefits' },
      ...copy.benefits.map((line) => el('li', {},
        icon(icons.check, { class: 'benefits__icon' }),
        el('span', { text: line })
      ))
    )
  ));

  setMode(store.user?.isGuest ? 'signup' : 'guest');
}

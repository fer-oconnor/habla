// ---------------------------------------------------------------------------
// Pantalla G: Words.
// Vocabulario encontrado, traduccion, ejemplo y reproduccion de audio, con
// busqueda y filtro por unidad. Solo aparece lo que el usuario YA ha visto.
// ---------------------------------------------------------------------------

import { api } from '../api.js?v=studio20261003';
import { el, icon } from '../dom.js?v=studio20261003';
import { icons } from '../icons.js?v=studio20261003';
import { t } from '../i18n.js?v=studio20261003';
import { store } from '../store.js?v=studio20261003';
import { toastError } from '../toast.js?v=studio20261003';
import * as audio from '../audio.js?v=studio20261003';

const LANG_BY_TRACK = { spanish: 'es-ES', sql: 'en-GB' };

export default async function renderWords({ host }) {
  const copy = t().words;
  let unitFilter = store.prefs.wordsUnit ?? '';
  let trackFilter = store.prefs.wordsTrack ?? '';
  let search = '';
  let timer = null;

  const list = el('div', { class: 'words' });
  const count = el('span', { class: 'pill', 'aria-live': 'polite' });
  const chipRow = el('div', { class: 'chips' });
  const trackRow = el('div', { class: 'chips' });

  const searchInput = el('input', {
    class: 'input', type: 'search', id: 'words-search',
    placeholder: copy.searchPlaceholder, autocomplete: 'off',
  });
  searchInput.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { search = searchInput.value.trim(); load(); }, 250);
  });

  host.append(el('div', { class: 'stack' },
    el('header', { class: 'stack--tight' },
      el('h1', { text: copy.title }),
      el('p', { class: 'lede', text: copy.subtitle })
    ),
    el('div', { class: 'card filters' },
      el('div', { class: 'field' },
        el('label', { for: 'words-search', text: copy.search }),
        el('div', { class: 'row' }, icon(icons.search), el('span', { class: 'grow' }, searchInput))
      ),
      trackRow,
      chipRow,
      el('div', { class: 'row row--end' }, count)
    ),
    list
  ));

  await audio.loadVoices();

  function wordCard(word) {
    const lang = LANG_BY_TRACK[word.track] ?? 'es-ES';
    const canSpeak = audio.isAvailable(lang);

    const speakTerm = el('button', {
      class: 'btn btn--icon btn--ghost',
      type: 'button',
      'aria-label': `${copy.speak}: ${word.es}`,
      title: copy.speak,
      disabled: !canSpeak,
      onClick: () => audio.speak(word.es, { lang }),
    }, icon(canSpeak ? icons.speaker : icons.book));

    const speakExample = el('button', {
      class: 'btn btn--quiet',
      type: 'button',
      'aria-label': `${copy.speakExample}: ${word.exampleEs}`,
      disabled: !canSpeak,
      onClick: () => audio.speak(word.exampleEs, { lang }),
    }, icon(icons.play), copy.speakExample);

    return el('article', { class: 'word' },
      el('div', {},
        el('div', { class: 'word__es', text: word.es }),
        el('div', { class: 'word__en', text: word.en }),
        el('div', { class: 'word__ex' },
          el('em', { text: word.exampleEs }),
          el('br'),
          word.exampleEn
        ),
        el('div', { class: 'row' },
          el('span', { class: 'pill', text: word.unit.title }),
          word.partOfSpeech ? el('span', { class: 'faint', text: word.partOfSpeech }) : null,
          el('span', { class: 'faint', text: copy.seen(word.timesSeen) })
        ),
        canSpeak ? speakExample : el('p', { class: 'faint', text: t().lesson.audioUnavailable })
      ),
      el('div', { class: 'word__actions' }, speakTerm)
    );
  }

  function drawChips(units, tracks) {
    trackRow.replaceChildren();
    if (tracks.length > 1) {
      const all = el('button', {
        class: 'chip', type: 'button', 'aria-pressed': String(trackFilter === ''),
        onClick: () => { trackFilter = ''; store.setPref('wordsTrack', ''); unitFilter = ''; load(); },
      }, 'All courses');
      trackRow.append(all);
      for (const track of tracks) {
        trackRow.append(el('button', {
          class: 'chip', type: 'button', 'aria-pressed': String(trackFilter === track.slug),
          onClick: () => {
            trackFilter = track.slug;
            store.setPref('wordsTrack', track.slug);
            unitFilter = '';
            load();
          },
        }, track.title));
      }
    }

    chipRow.replaceChildren();
    if (units.length === 0) return;
    chipRow.append(el('button', {
      class: 'chip', type: 'button', 'aria-pressed': String(unitFilter === ''),
      onClick: () => { unitFilter = ''; store.setPref('wordsUnit', ''); load(); },
    }, copy.allUnits));
    for (const unit of units) {
      chipRow.append(el('button', {
        class: 'chip', type: 'button', 'aria-pressed': String(unitFilter === unit.slug),
        onClick: () => { unitFilter = unit.slug; store.setPref('wordsUnit', unit.slug); load(); },
      }, unit.title));
    }
  }

  async function load() {
    list.replaceChildren(el('div', { class: 'loading' },
      el('div', { class: 'spinner', 'aria-hidden': 'true' })));
    try {
      const data = await api.vocabulary({
        search,
        unit: unitFilter,
        track: trackFilter,
      });
      const tracks = store.tracks.length > 0
        ? store.tracks
        : (await api.tracks().catch(() => ({ tracks: [] }))).tracks;
      if (tracks.length > 0) store.set({ tracks });

      drawChips(data.units, tracks);
      count.textContent = copy.count(data.total);

      if (data.total === 0) {
        list.replaceChildren(el('div', { class: 'empty' },
          icon(icons.words),
          el('h2', { text: search ? copy.noMatches : copy.empty }),
          el('p', { class: 'muted', text: search ? '' : copy.emptyBody }),
          search
            ? null
            : el('a', { class: 'btn', href: '/learn', 'data-route': '' }, t().nav.learn)
        ));
        return;
      }
      list.replaceChildren(...data.words.map(wordCard));
    } catch (error) {
      list.replaceChildren(el('div', { class: 'empty' },
        el('p', { class: 'muted', text: error.message }),
        el('button', { class: 'btn', type: 'button', onClick: load }, t().app.retry)
      ));
      toastError(error, load);
    }
  }

  await load();
}

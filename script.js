/* ==========================================================
   Converge – logikk for prototypen
   Ren JavaScript uten rammeverk.

   Slik henger det sammen:
   1. All informasjon ligger i objektet `state`.
   2. Brukeren gjør noe  →  en handling endrer `state`.
   3. render() tegner grensesnittet på nytt ut fra `state`.
   ========================================================== */
'use strict';


/* ----------------------------------------------------------
   1. Faste data
   ---------------------------------------------------------- */

// Elementtypene. `fields` er feltene i Rediger-modus:
// [nøkkel, etikett, flerlinjet?]
const TYPES = {
  super:      { label: 'Super',      stage: 'Navnesuper over kamerabilde',          fields: [['a', 'Navn'], ['b', 'Tittel']] },
  stolper:    { label: 'Stolper',    stage: 'Fullskjermgrafikk med stolper',        fields: [['a', 'Overskrift'], ['b', 'Punkter (ett per linje)', true]] },
  stillbilde: { label: 'Stillbilde', stage: 'Stillbilde i fullskjerm med bildetekst', fields: [['a', 'Bildetekst'], ['b', 'Kreditering']] },
  bildeserie: { label: 'Bildeserie', stage: 'Bildeserie – første bilde vises',      fields: [['a', 'Tittel'], ['b', 'Kreditering']] },
  faksimile:  { label: 'Faksimile',  stage: 'Faksimile av avisoppslag',             fields: [['a', 'Overskrift'], ['b', 'Kilde']] },
  fotokonk:   { label: 'Foto-konk',  stage: 'Bidrag fra fotokonkurransen',          fields: [['a', 'Bildetittel'], ['b', 'Innsender'], ['c', 'Sted']] },
};

// Rekkefølgen i elementpaletten
const TYPE_ORDER = ['super', 'stolper', 'stillbilde', 'bildeserie', 'faksimile', 'fotokonk'];

// Ikon (SVG-innhold) for hver elementtype
const ICON_PATHS = {
  super:      '<path d="M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3"/><path d="M9 9h6M12 9v7"/>',
  stolper:    '<path d="M10 6h10M10 12h10M10 18h10"/><path d="M4 5h2v2H4zM4 11h2v2H4zM4 17h2v2H4z"/>',
  stillbilde: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  bildeserie: '<rect x="7" y="3" width="14" height="12" rx="2"/><path d="M3 7v11a2 2 0 0 0 2 2h11"/><path d="M21 11l-4-4-7 7"/>',
  faksimile:  '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h4M7 16h4"/><path d="M14 12h3v4h-3z"/>',
  fotokonk:   '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
};
const CHECK_PATH = '<path d="M5 12.5l4.5 4.5L19 7.5"/>';

// Oppgavene på startsiden. `auto: true` betyr at oppgaven
// blir ferdig av seg selv når alle bolkene er markert som klare.
const TASKS = [
  { key: 'script',    title: 'Lese script' },
  { key: 'kjoreplan', title: 'Gå gjennom kjøreplan', auto: true },
  { key: 'supere',    title: 'Klargjøre navnesuper for gjester' },
  { key: 'fotokonk',  title: 'Sjekke bidrag i fotokonkurransen' },
  { key: 'produsent', title: 'Avklare endringer med produsent' },
  { key: 'test',      title: 'Prøvekjøre grafikk før sending' },
];

// Eksempel-kjøreplan. All tekst er oppdiktet.
function lagKjoreplan() {
  const E = (id, type, a, b = '', c = '') => ({ id, type, a, b, c });
  return [
    { time: '07:00', title: 'Åpning og dagens saker', klar: false, els: [
      E('e11', 'super', 'Silje Mo Aasen', 'Programleder'),
      E('e12', 'stolper', 'Dette skjer i dag', 'Strømprisene i vinter\nFotokonkurransen: Høstfarger\nHverdagsmiddag på 20 minutter\nNy norsk film på kino'),
      E('e13', 'faksimile', 'Vinterens strømpris: Dette må du vite', 'Avisa Vest'),
      E('e14', 'stillbilde', 'Morgensol over Bergen', 'Foto: TV 2'),
      E('e15', 'super', 'Erik Brandal', 'Nyhetsoppleser'),
    ] },
    { time: '07:12', title: 'Strømprisen – hva betyr den for deg?', klar: false, els: [
      E('e21', 'super', 'Mari Solheim', 'Forbrukerøkonom'),
      E('e22', 'stolper', 'Slik kutter du strømregningen', 'Senk innetemperaturen\nStyr varmtvannet med tidsur\nSammenlign strømavtaler'),
      E('e23', 'bildeserie', 'Strømmålere i en vanlig bolig', 'Foto: TV 2'),
      E('e24', 'faksimile', 'Flere bytter strømavtale', 'Avisa Vest'),
      E('e25', 'super', 'Thomas Rød', 'Daglig leder, Vestkraft'),
    ] },
    { time: '07:25', title: 'Været', klar: false, els: [
      E('e31', 'super', 'Hanne Lund', 'Meteorolog'),
      E('e32', 'stolper', 'Været i dag', 'Østlandet: Sol, kaldt om morgenen\nVestlandet: Regn og vind\nNord-Norge: Snøbyger'),
      E('e33', 'stillbilde', 'Første snø på fjellet', 'Foto: Seerbilde'),
    ] },
    { time: '07:38', title: 'Fotokonkurransen: Høstfarger', klar: false, els: [
      E('e41', 'stolper', 'Ukens tema: Høstfarger', 'Send inn bildet ditt\nVinneren kåres fredag'),
      E('e42', 'fotokonk', 'Morgentåke over Vangsvatnet', 'Ingrid Haugland', 'Voss'),
      E('e43', 'fotokonk', 'Rønnebær i første frost', 'Per Arne Vik', 'Tromsø'),
      E('e44', 'fotokonk', 'Lønnetrær i bygata', 'Amina Rahman', 'Oslo'),
      E('e45', 'fotokonk', 'Fjellbjørk i kveldssol', 'Ola Brekke', 'Valdres'),
      E('e46', 'fotokonk', 'Eplehage i Hardanger', 'Siri Ness', 'Ullensvang'),
    ] },
    { time: '07:50', title: 'Mat: Hverdagsmiddag på 20 minutter', klar: false, els: [
      E('e51', 'super', 'Kristian Moe', 'Kokk'),
      E('e52', 'stolper', 'Dette trenger du', '400 g torskefilet\n2 gulrøtter\n1 purreløk\nFløte og smør'),
      E('e53', 'bildeserie', 'Steg for steg: Fiskegrateng', 'Foto: TV 2'),
      E('e54', 'stillbilde', 'Ferdig rett', 'Foto: TV 2'),
    ] },
    { time: '08:05', title: 'Helse: Søvn i mørketiden', klar: false, els: [
      E('e61', 'super', 'Lene Bakke', 'Søvnforsker'),
      E('e62', 'faksimile', 'Slik sover du bedre i mørketiden', 'Avisa Vest'),
      E('e63', 'stolper', 'Råd for bedre søvn', 'Fast leggetid\nDropp skjermen siste timen\nKjølig soverom'),
    ] },
    { time: '08:20', title: 'Kultur: Ny norsk film', klar: false, els: [
      E('e71', 'super', 'Nora Lindqvist', 'Regissør'),
      E('e72', 'stillbilde', 'Fra filmen «Fjellet»', 'Foto: Filmselskapet'),
      E('e73', 'bildeserie', 'Bilder fra premieren', 'Foto: TV 2'),
      E('e74', 'super', 'Aksel Strand', 'Skuespiller'),
    ] },
    { time: '08:35', title: 'Avslutning', klar: false, els: [
      E('e81', 'fotokonk', 'Morgentåke over Vangsvatnet', 'Ingrid Haugland', 'Voss'),
      E('e82', 'stolper', 'I morgen på God morgen Norge', 'Julebord uten stress\nVinterdekk – når må de på?\nNytt fra fotokonkurransen'),
      E('e83', 'super', 'Silje Mo Aasen', 'Programleder'),
    ] },
  ];
}


/* ----------------------------------------------------------
   2. Tilstand
   ---------------------------------------------------------- */
const state = {
  screen: 'start',        // 'start' eller 'list'
  fetched: false,         // er kjøreplanen hentet?
  loading: false,         // holder vi på å hente?
  fetchedAt: null,
  doneTasks: { script: true, supere: false, fotokonk: false, produsent: false, test: false },
  bolker: lagKjoreplan(),
  activeBolk: 0,          // indeks i state.bolker
  selectedId: null,       // id på elementet som er åpent i preview
  mode: 'preview',        // 'preview' eller 'edit'
  showNewNote: false,     // vis melding under «Nytt element»
  nextId: 1,              // teller for nye elementer
};


/* ----------------------------------------------------------
   3. Hjelpefunksjoner
   ---------------------------------------------------------- */
const $ = (id) => document.getElementById(id);

// Gjør tekst trygg å sette inn med innerHTML
function esc(value) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value).replace(/[&<>"']/g, (ch) => map[ch]);
}

function svgIcon(paths, size = 22, strokeWidth = 1.8) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

function lines(text) {
  return String(text || '').split('\n').map((s) => s.trim()).filter(Boolean);
}

function activeBolk() {
  return state.bolker[state.activeBolk];
}

// Returnerer det valgte elementet med plassering, eller null
function selected() {
  if (!state.fetched) return null;
  const els = activeBolk().els;
  const index = els.findIndex((el) => el.id === state.selectedId);
  return index === -1 ? null : { el: els[index], index, total: els.length };
}

// Fremdrift: seks like deler. Fem oppgaver hukes av manuelt,
// den sjette (kjøreplanen) fylles opp bolk for bolk.
function progress() {
  const total = state.bolker.length;
  const klar = state.bolker.filter((b) => b.klar).length;
  const manual = Object.values(state.doneTasks).filter(Boolean).length;
  const pct = Math.round(((manual + klar / total) / TASKS.length) * 100);
  const tasksDone = manual + (klar === total ? 1 : 0);
  return { pct, klar, total, tasksDone };
}

function metaText(el) {
  const label = TYPES[el.type].label;
  if (el.type === 'stolper') return `${label} · ${lines(el.b).length} punkter`;
  if (el.type === 'fotokonk') return el.b ? `${label} · ${el.b}${el.c ? ', ' + el.c : ''}` : label;
  return el.b ? `${label} · ${el.b}` : label;
}

function previewTitle(sel) {
  return sel ? `${TYPES[sel.el.type].label} · ${sel.el.a || 'Nytt element'}` : 'Forhåndsvisning';
}

// Når innerHTML byttes ut, mister knappen fokus. Disse to
// funksjonene husker hvilken knapp som hadde fokus og gir det tilbake,
// slik at tastaturbrukere ikke mister plassen sin.
function rememberFocus() {
  const active = document.activeElement;
  if (!active) return null;
  for (const attr of ['data-id', 'data-bolk', 'data-task', 'data-add']) {
    if (active.hasAttribute(attr)) return `[${attr}="${active.getAttribute(attr)}"]`;
  }
  return null;
}
function restoreFocus(selector) {
  if (!selector) return;
  const el = document.querySelector(selector);
  if (el && el !== document.activeElement) el.focus();
}


/* ----------------------------------------------------------
   4. Grafikk i preview – én mal per elementtype
   ---------------------------------------------------------- */
function placeholder(text, paths = ICON_PATHS.stillbilde) {
  return `<div class="g-placeholder">${svgIcon(paths, 24, 1.4)}<span>${text}</span></div>`;
}

const STAGE = {
  super: (el, a, b) => `
    <div class="g-person-body" aria-hidden="true"></div>
    <div class="g-person-head" aria-hidden="true"></div>
    <div class="g-lower">
      <span class="g-lower__main">${a}</span>
      <span class="g-lower__sub g-lower__sub--accent">${b}</span>
    </div>`,

  stolper: (el, a) => {
    const items = lines(el.b);
    const list = (items.length ? items : ['[Punkt]']).slice(0, 6)
      .map((text) => `<li>${esc(text)}</li>`).join('');
    return `
      <div class="g-stolper">
        <span class="g-stolper__bar" aria-hidden="true"></span>
        <span class="g-stolper__head">${a}</span>
        <ul>${list}</ul>
      </div>`;
  },

  stillbilde: (el, a, b) => `
    ${placeholder('Bildeplassholder')}
    <span class="g-credit">${b}</span>
    <div class="g-caption">${a}</div>`,

  bildeserie: (el, a, b) => {
    const thumbs = [0, 1, 2, 3, 4]
      .map((i) => `<span class="g-thumb${i === 0 ? ' is-current' : ''}" aria-hidden="true"></span>`).join('');
    return `
      <div class="g-serie">
        <div class="g-serie__main">
          ${placeholder('')}
          <span class="g-serie__title">${a}</span>
          <span class="g-credit">${b}</span>
        </div>
        <div class="g-serie__thumbs">${thumbs}<span class="g-serie__count">Bilde 1 av 5</span></div>
      </div>`;
  },

  faksimile: (el, a, b) => `
    <div class="g-faks-bg">
      <div class="g-faks">
        <span class="g-faks__source">${b}</span>
        <span class="g-faks__head">${a}</span>
        <div class="g-faks__lines" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
      </div>
    </div>`,

  fotokonk: (el, a) => `
    ${placeholder('Innsendt bilde', ICON_PATHS.fotokonk)}
    <span class="g-konk-tag">Fotokonkurransen · Høstfarger</span>
    <div class="g-lower">
      <span class="g-lower__main">${a}</span>
      <span class="g-lower__sub">Innsendt av ${esc(el.b || '[Innsender]')}, ${esc(el.c || '[Sted]')}</span>
    </div>`,
};


/* ----------------------------------------------------------
   5. Tegning (render)
   ---------------------------------------------------------- */
function render() {
  const focus = rememberFocus();
  renderHeader();
  renderStart();
  renderList();
  restoreFocus(focus);
}

function renderHeader() {
  const onStart = state.screen === 'start';
  setNavActive($('nav-start'), onStart);
  setNavActive($('nav-list'), !onStart);

  const { pct } = progress();
  document.querySelectorAll('[data-progress-text]').forEach((n) => { n.textContent = pct; });
  document.querySelectorAll('[data-progress-fill]').forEach((n) => { n.style.width = pct + '%'; });
  $('progressbar').setAttribute('aria-valuenow', pct);
}

function setNavActive(btn, active) {
  btn.classList.toggle('is-active', active);
  if (active) btn.setAttribute('aria-current', 'page');
  else btn.removeAttribute('aria-current');
}

/* ---- Skjerm 1 ---- */
function renderStart() {
  $('screen-start').hidden = state.screen !== 'start';

  const p = progress();
  $('progress-note').textContent =
    `${p.tasksDone} av ${TASKS.length} oppgaver ferdig · ${p.klar} av ${p.total} bolker klare`;
  $('cta-note').textContent = state.fetched
    ? `${p.total} bolker · ${p.klar} klare`
    : 'Kjøreplanen er ikke hentet ennå';

  $('task-list').innerHTML = TASKS.map((task) => taskCard(task, p)).join('');
}

function taskCard(task, p) {
  const done = task.auto ? p.klar === p.total : !!state.doneTasks[task.key];

  let status;
  if (task.auto) status = state.fetched ? `${p.klar} av ${p.total} bolker klare` : 'Kjøreplanen er ikke hentet ennå';
  else status = done ? 'Ferdig' : 'Ikke ferdig';

  const ring = `<span class="check__ring">${done ? svgIcon(CHECK_PATH, 16, 3) : ''}</span>`;

  // Kjøreplan-oppgaven hukes ikke av for hånd, den har en snarvei i stedet
  const check = task.auto
    ? `<span class="check" aria-hidden="true">${ring}</span>`
    : `<button type="button" class="check" data-task="${task.key}" aria-pressed="${done}"
         aria-label="${done ? 'Fjern avkrysning' : 'Marker som ferdig'}: ${esc(task.title)}">${ring}</button>`;

  const shortcut = task.auto
    ? '<button type="button" class="btn-outline" data-go="list">Åpne spillelisten</button>'
    : '';

  return `
    <div class="card task${done ? ' is-done' : ''}">
      <div class="task__text">
        <span class="task__title">${esc(task.title)}</span>
        <span class="muted">${status}</span>
        ${shortcut}
      </div>
      ${check}
    </div>`;
}

/* ---- Skjerm 2 og 3 ---- */
function renderList() {
  $('screen-list').hidden = state.screen !== 'list';
  if (state.screen !== 'list') return;

  const p = progress();
  const bolk = activeBolk();

  // Overskrift
  $('list-title').textContent = state.fetched ? `Bolk ${state.activeBolk + 1}` : 'Spilleliste';
  $('list-sub').hidden = !state.fetched;
  $('list-sub').textContent = `${bolk.time} · ${bolk.title}`;
  $('fetch-info').hidden = !state.fetched;
  if (state.fetchedAt) {
    const time = state.fetchedAt.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
    $('fetch-info').textContent = `Kjøreplan hentet kl. ${time} · ${p.klar} av ${p.total} bolker klare`;
  }

  // Venstre side: tom tilstand eller spilleliste
  $('empty-state').hidden = state.fetched;
  $('playlist').hidden = !state.fetched;
  $('fetch-btn').disabled = state.loading;
  $('fetch-label').textContent = state.loading ? 'Henter kjøreplan …' : 'Hent kjøreplan';
  $('fetch-status').textContent = state.loading ? 'Henter kjøreplanen fra produksjonen …' : '';

  if (state.fetched) {
    renderBolkMenu();
    renderElementList();
  }
  renderPalette();
  renderPreview();
  renderKlar();
}

function renderBolkMenu() {
  $('bolk-menu').innerHTML = state.bolker.map((bolk, i) => {
    const active = i === state.activeBolk;
    const klarIcon = bolk.klar
      ? `<span class="klar-dot" role="img" aria-label="Klar">${svgIcon(CHECK_PATH, 14, 3)}</span>`
      : '';
    return `
      <button type="button" class="bolk-btn${active ? ' is-active' : ''}" data-bolk="${i}"${active ? ' aria-current="true"' : ''}>
        <span class="bolk-btn__text">
          <span class="bolk-btn__label">Bolk ${i + 1}</span>
          <span class="bolk-btn__time">${bolk.time}</span>
        </span>
        ${klarIcon}
      </button>`;
  }).join('');
}

function renderElementList() {
  const els = activeBolk().els;
  $('el-count').textContent = `${els.length} ${els.length === 1 ? 'element' : 'elementer'}`;

  $('element-list').innerHTML = els.map((el, i) => {
    // Foto-konk-bidrag som står etter hverandre får en felles overskrift
    let group = '';
    const prev = els[i - 1];
    if (el.type === 'fotokonk' && (!prev || prev.type !== 'fotokonk')) {
      let count = 0;
      while (els[i + count] && els[i + count].type === 'fotokonk') count++;
      group = `<div class="el-group">Foto-konk · ${count} bidrag fra fotokonkurransen</div>`;
    }

    const isSelected = el.id === state.selectedId;
    return `${group}
      <button type="button" class="el${isSelected ? ' is-selected' : ''}" data-id="${el.id}"${isSelected ? ' aria-current="true"' : ''} title="Dobbeltklikk for å åpne">
        <span class="type-icon">${svgIcon(ICON_PATHS[el.type])}</span>
        <span class="el__text">
          <span class="el__title">${esc(el.a || 'Uten tittel')}</span>
          <span class="el__meta">${esc(metaText(el))}</span>
        </span>
        ${el.isNew ? '<span class="badge">NY</span>' : ''}
      </button>`;
  }).join('');
}

function renderPalette() {
  const sel = selected();

  $('palette-panel').classList.toggle('is-disabled', !state.fetched);
  $('palette-hint').textContent = !state.fetched
    ? 'Tilgjengelig når kjøreplanen er hentet'
    : sel
      ? `Gjenkjent type: ${TYPES[sel.el.type].label} · klikk en type for å legge til`
      : 'Klikk en type for å legge den til i bolken';

  $('palette').innerHTML = TYPE_ORDER.map((type) => {
    // Typen til det valgte elementet utheves («gjenkjennes»)
    const recognized = !!sel && sel.el.type === type;
    const label = TYPES[type].label;
    return `
      <button type="button" class="palette__btn${recognized ? ' is-recognized' : ''}" data-add="${type}"
        aria-label="Legg til ${label} i bolken${recognized ? ' (type for valgt element)' : ''}"${state.fetched ? '' : ' disabled'}>
        <span class="type-icon">${svgIcon(ICON_PATHS[type])}</span>
        <span class="palette__label">${label}</span>
        ${recognized ? '<span class="badge">VALGT</span>' : ''}
      </button>`;
  }).join('');

  $('new-element-btn').disabled = !state.fetched;
  $('new-element-note').hidden = !state.showNewNote;
}

function renderPreview() {
  const sel = selected();
  const editing = state.mode === 'edit' && !!sel;

  $('preview-title').textContent = previewTitle(sel);
  $('mode-edit').disabled = !sel;
  $('mode-preview').disabled = !sel;
  $('mode-edit').setAttribute('aria-pressed', editing);
  $('mode-preview').setAttribute('aria-pressed', !editing);

  $('preview-empty').hidden = !!sel;
  $('preview-empty').textContent = state.fetched
    ? 'Dobbeltklikk på et element i bolken for å se det her.'
    : 'Hent kjøreplanen for å se elementene her.';
  $('preview').hidden = !sel;
  if (!sel) return;

  // Redigeringsfelt (bare i Rediger-modus)
  $('edit-fields').hidden = !editing;
  $('edit-fields').innerHTML = editing
    ? TYPES[sel.el.type].fields.map(([key, label, multiline]) => {
        const id = `felt-${key}`;
        const value = esc(sel.el[key] || '');
        const input = multiline
          ? `<textarea id="${id}" data-field="${key}" rows="5">${value}</textarea>`
          : `<input id="${id}" type="text" data-field="${key}" value="${value}" autocomplete="off">`;
        return `<div class="field"><label for="${id}">${label}</label>${input}</div>`;
      }).join('')
    : '';

  renderStage();

  // Bla mellom elementene i bolken
  $('prev-btn').disabled = sel.index === 0;
  $('next-btn').disabled = sel.index === sel.total - 1;
  $('position').textContent = `Element ${sel.index + 1} av ${sel.total}`;
}

function renderStage() {
  const sel = selected();
  if (!sel) return;

  const el = sel.el;
  const def = TYPES[el.type];

  // Tomme felt vises som [Feltnavn] i grafikken
  const placeholderFor = (key) => {
    const field = def.fields.find(([k]) => k === key);
    return field ? `[${field[1]}]` : '';
  };
  const a = esc(el.a || placeholderFor('a'));
  const b = esc(el.b || placeholderFor('b'));

  $('stage').innerHTML = STAGE[el.type](el, a, b);
  $('stage-note').textContent = `Forhåndsvisning: ${def.stage}`;
}

function renderKlar() {
  const bolk = activeBolk();
  $('klar-row').hidden = !state.fetched;
  $('klar-btn').setAttribute('aria-pressed', bolk.klar);
  $('klar-label').textContent = bolk.klar ? 'Bolken er klar' : 'Bolk klar';
  $('klar-note').textContent = bolk.klar
    ? `Bolk ${state.activeBolk + 1} er markert som klar. Klikk igjen for å angre.`
    : '';
}


/* ----------------------------------------------------------
   6. Handlinger – endrer state og tegner på nytt
   ---------------------------------------------------------- */
function goTo(screen) {
  state.screen = screen;
  render();
  window.scrollTo(0, 0);
}

function toggleTask(key) {
  state.doneTasks[key] = !state.doneTasks[key];
  render();
}

function fetchPlan() {
  if (state.loading) return;
  state.loading = true;
  render();

  // Later som om vi henter kjøreplanen fra en server
  setTimeout(() => {
    state.loading = false;
    state.fetched = true;
    state.fetchedAt = new Date();
    state.activeBolk = 0;
    state.selectedId = state.bolker[0].els[0].id;  // første element åpnes
    state.mode = 'preview';
    render();
  }, 900);
}

function pickBolk(index) {
  state.activeBolk = index;
  state.selectedId = null;
  state.mode = 'preview';
  state.showNewNote = false;
  render();
}

function openElement(id) {
  state.selectedId = id;
  state.mode = 'preview';
  state.showNewNote = false;
  render();
}

function step(direction) {
  const sel = selected();
  if (!sel) return;
  const next = activeBolk().els[sel.index + direction];
  if (next) {
    state.selectedId = next.id;
    render();
  }
}

function addElement(type) {
  const sel = selected();
  const els = activeBolk().els;
  const el = { id: `ny-${state.nextId++}`, type, a: '', b: '', c: '', isNew: true };

  // Legg det nye elementet rett under det valgte (ellers nederst)
  els.splice(sel ? sel.index + 1 : els.length, 0, el);

  state.selectedId = el.id;
  state.mode = 'edit';
  state.showNewNote = false;
  render();

  const firstField = document.querySelector('#edit-fields [data-field]');
  if (firstField) firstField.focus();
}

function updateField(key, value) {
  const sel = selected();
  if (!sel) return;
  sel.el[key] = value;

  // Tegn bare det som påvirkes, så tekstfeltet beholder fokus
  renderElementList();
  renderStage();
  $('preview-title').textContent = previewTitle(sel);
}

function setMode(mode) {
  state.mode = mode;
  render();
}

function toggleKlar() {
  const bolk = activeBolk();
  bolk.klar = !bolk.klar;
  render();
}


/* ----------------------------------------------------------
   7. Hendelser
   Lister som tegnes på nytt bruker «event delegation»:
   én lytter på foreldreelementet i stedet for én per knapp.
   ---------------------------------------------------------- */
function bindEvents() {
  $('nav-start').addEventListener('click', () => goTo('start'));
  $('nav-list').addEventListener('click', () => goTo('list'));
  $('cta-list').addEventListener('click', () => goTo('list'));

  $('task-list').addEventListener('click', (e) => {
    const check = e.target.closest('[data-task]');
    if (check) toggleTask(check.dataset.task);
    if (e.target.closest('[data-go="list"]')) goTo('list');
  });

  $('fetch-btn').addEventListener('click', fetchPlan);

  $('bolk-menu').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-bolk]');
    if (btn) pickBolk(Number(btn.dataset.bolk));
  });

  // Dobbeltklikk åpner et element
  $('element-list').addEventListener('dblclick', (e) => {
    const btn = e.target.closest('[data-id]');
    if (btn) openElement(btn.dataset.id);
  });
  // Tastatur: Enter/mellomrom gir et «click» med detail 0
  $('element-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-id]');
    if (btn && e.detail === 0) openElement(btn.dataset.id);
  });

  $('palette').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-add]');
    if (btn && !btn.disabled) addElement(btn.dataset.add);
  });

  $('new-element-btn').addEventListener('click', () => {
    state.showNewNote = !state.showNewNote;
    render();
  });

  $('mode-edit').addEventListener('click', () => setMode('edit'));
  $('mode-preview').addEventListener('click', () => setMode('preview'));

  // Forhåndsvisningen oppdateres mens man skriver
  $('edit-fields').addEventListener('input', (e) => {
    const field = e.target.closest('[data-field]');
    if (field) updateField(field.dataset.field, field.value);
  });
  $('edit-fields').addEventListener('submit', (e) => e.preventDefault());

  $('prev-btn').addEventListener('click', () => step(-1));
  $('next-btn').addEventListener('click', () => step(1));
  $('klar-btn').addEventListener('click', toggleKlar);
}


/* ----------------------------------------------------------
   8. Oppstart
   ---------------------------------------------------------- */
function init() {
  $('today').textContent = new Date().toLocaleDateString('nb-NO', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  bindEvents();
  render();
}

init();

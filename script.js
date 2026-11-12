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

// Et felt i Rediger-modus. Mulige valg i `opts`:
//   flere: true        flerlinjet tekstfelt
//   valg: [[verdi, tekst], …]   nedtrekksliste
//   hint: '…'          hjelpetekst under feltet
//   valgfri: true      tomt felt vises ikke som [Feltnavn] i grafikken
//   maksSetninger: n   teller setninger og varsler over grensen
// Typene 'bilder' (bildeserie) og 'rader' (sendestolpe) har egne felt.
const F = (key, label, opts = {}) => ({ key, label, ...opts });

const KONK_TEKST = 'Send inn ditt bilde på tv2.no/fotokonkurranse';
const OPPSKRIFT_TEKST = 'Se dagens oppskrift på TV2.no/mat';
const AUTO_HINT = 'Fylt ut automatisk. Kan endres.';

// Motivene plassholderbildene kan ha (tegnes i del 4)
const SCENE_KINDS = ['fjord', 'host', 'sno', 'taake', 'nordlys', 'by', 'mat', 'portrett'];
const LANDSKAP = ['fjord', 'host', 'sno', 'taake', 'nordlys', 'by'];

const STATUS_VALG = [
  ['senere', 'Senere i dag'],
  ['neste', 'Neste (uthevet)'],
  ['sendt', 'Sendt (Se på TV 2 Play)'],
];

// Elementtypene.
//   fields: feltene i Rediger-modus
//   lesbar: true  kan bare leses (ingen Rediger-modus, ligger ikke i paletten)
//   ny(ctx): startverdier for et nytt element (ctx: id, time, index, bolker)
//   tittel/meta: teksten i elementlisten
const TYPES = {
  navnesuper: {
    label: 'Navnesuper', stage: 'Navnesuper over kamerabilde',
    fields: [F('navn', 'Navn'), F('tittel', 'Tittel')],
    ny: () => ({ navn: '', tittel: '' }),
    tittel: (el) => el.navn,
    meta: (el) => el.tittel,
  },
  infosuper: {
    label: 'Infosuper', stage: 'Infosuper med tema og kort tekst over kamerabilde',
    fields: [F('tema', 'Tittel/tema'), F('tekst', 'Tekst', { flere: true, maksSetninger: 3 })],
    ny: () => ({ tema: '', tekst: '' }),
    tittel: (el) => el.tema,
    meta: (el) => setningerTekst(el.tekst),
  },
  infostolpe: {
    label: 'Infostolpe', stage: 'Infostolpe med produktbilde',
    fields: [
      F('kategori', 'Kategori'),
      F('tittel', 'Tittel'),
      F('beskrivelse', 'Beskrivelse', { flere: true, rader: 3 }),
      F('pris', 'Pris'),
      F('bildeplass', 'Produktbilde', { valg: [['hoyre', 'Stikker inn fra høyre'], ['nederst', 'Nederst']] }),
    ],
    ny: () => ({ kategori: '', tittel: '', beskrivelse: '', pris: '', bildeplass: 'hoyre', produkt: 'flaske' }),
    tittel: (el) => el.tittel,
    meta: (el) => el.kategori,
  },
  oppskrift: {
    label: 'Oppskriftstolpe', stage: 'Oppskriftstolpe fra GMN-kjøkkenet',
    fields: [F('rett', 'Navnet på retten'), F('lenke', 'Tekst nederst')],
    ny: () => ({ rett: '', lenke: OPPSKRIFT_TEKST }),
    tittel: (el) => el.rett,
    meta: () => 'GMN-kjøkkenet',
  },
  sendestolpe: {
    label: 'Sendestolpe', stage: 'Sendestolpe med dagens sending',
    fields: [F('overskrift', 'Overskrift'), F('rader', 'Innslag', { kind: 'rader' })],
    ny: (ctx) => ({ overskrift: 'Dagens sending', rader: autoRader(ctx) }),
    tittel: (el) => el.overskrift,
    meta: (el) => `${el.rader.length} innslag`,
  },
  stillbilde: {
    label: 'Stillbilde', stage: 'Stillbilde på varm bakgrunn',
    fields: [F('motiv', 'Motiv'), F('kreditering', 'Kreditering', { hint: 'For eksempel «Foto: Navn» eller «Illustrasjon: Navn».' })],
    ny: (ctx) => ({ motiv: '', kreditering: 'Foto: ', scene: pick(LANDSKAP, hash(ctx.id)) }),
    tittel: (el) => el.motiv,
    meta: (el) => el.kreditering,
  },
  bildeserie: {
    label: 'Bildeserie', stage: 'Bildeserie på varm bakgrunn',
    fields: [F('tittel', 'Tittel på serien'), F('bilder', 'Bilder', { kind: 'bilder' })],
    ny: (ctx) => ({ tittel: '', bilder: [{ motiv: '', kreditering: 'Foto: ', scene: pick(LANDSKAP, hash(ctx.id)) }] }),
    tittel: (el) => el.tittel,
    meta: (el) => `${el.bilder.length} ${el.bilder.length === 1 ? 'bilde' : 'bilder'}`,
  },
  faksimile: {
    label: 'Faksimile', stage: 'Faksimile av nettartikkel',
    fields: [F('overskrift', 'Overskrift'), F('ingress', 'Ingress', { flere: true, rader: 2, valgfri: true }), F('kilde', 'Kilde')],
    ny: (ctx) => ({ overskrift: '', ingress: '', kilde: '', scene: pick(LANDSKAP, hash(ctx.id)) }),
    tittel: (el) => el.overskrift,
    meta: (el) => el.kilde,
  },
  // Alle bidragene i en bolk samles i ett element som blas i som en bildeserie.
  // Hvert bidrag i `bilder`: navn, tittel (bildetittel, kan mangle), sted, fylke og scene.
  // Bidragene kommer fra fotokonkurransen og kan bare leses.
  fotokonk: {
    label: 'Fotokonkurranse', stage: 'Bidrag i fotokonkurransen', lesbar: true,
    fields: [F('overskrift', 'Overskrift'), F('konk', 'Konkurransetekst')],
    ny: () => ({ overskrift: '', konk: KONK_TEKST, bilder: [] }),
    tittel: (el) => el.overskrift,
    meta: (el) => `${el.bilder.length} bidrag`,
  },
  ticker: {
    label: 'Ticker', stage: 'Ticker over kamerabilde',
    fields: [
      F('variant', 'Variant', { valg: [['nyheter', 'Nyheter'], ['instagram', 'Følg oss på Instagram']] }),
      F('dato', 'Dato', { hint: AUTO_HINT }),
      F('klokke', 'Klokkeslett', { hint: AUTO_HINT }),
      F('nyheter', 'Nyheter (én per linje)', { flere: true, rader: 5 }),
    ],
    ny: (ctx) => ({ variant: 'nyheter', dato: datoTekst(), klokke: ctx.time ? klokkeTekst(ctx.time) : '', nyheter: '' }),
    tittel: (el) => (el.variant === 'instagram' ? 'Følg oss på Instagram!' : lines(el.nyheter)[0] || ''),
    meta: (el) => (el.variant === 'instagram' ? 'Instagram-variant' : `${lines(el.nyheter).length} nyheter · ${el.klokke}`),
  },
  hashtag: {
    label: 'Hashtag', stage: 'Hashtag over kamerabilde',
    fields: [F('tekst', 'Hashtag')],
    ny: () => ({ tekst: '#godmorgennorge' }),
    tittel: (el) => el.tekst,
    meta: () => '',
  },
  fotokred: {
    label: 'Fotokreditering', stage: 'Fotokreditering over bilde',
    fields: [F('navn', 'Fotograf')],
    ny: (ctx) => ({ navn: '', scene: pick(LANDSKAP, hash(ctx.id)) }),
    tittel: (el) => (el.navn ? `Foto ${el.navn}` : ''),
    meta: () => '',
  },
  straks: {
    label: 'Straks-plakat', stage: 'Straks-plakat over kamerabilde',
    fields: [F('fane', 'Fanetekst'), F('tittel', 'Tittel'), F('kanaler', 'Kanaler')],
    ny: () => ({ fane: 'Straks', tittel: 'God morgen Norge', kanaler: 'TV 2 Direkte & TV 2 Play' }),
    tittel: (el) => el.tittel,
    meta: (el) => el.fane,
  },
};

// Elementpaletten er delt inn i grupper
const GROUPS = [
  { key: 'supere',   navn: 'Supere',   typer: ['navnesuper', 'infosuper'] },
  { key: 'stolper',  navn: 'Stolper',  typer: ['infostolpe', 'oppskrift', 'sendestolpe'] },
  { key: 'bilder',   navn: 'Bilder',   typer: ['stillbilde', 'bildeserie', 'faksimile'] },
  { key: 'overlegg', navn: 'Overlegg', typer: ['ticker', 'hashtag', 'fotokred', 'straks'] },
];

// Ikon (SVG-innhold) for hver elementtype
const ICON_PATHS = {
  navnesuper:  '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M6 13.5h8M6 16.5h5"/>',
  infosuper:   '<path d="M6 10V8.5A1.5 1.5 0 0 1 7.5 7h5A1.5 1.5 0 0 1 14 8.5V10"/><rect x="3" y="10" width="18" height="8" rx="1.5"/><path d="M6 13h12M6 15.5h8"/>',
  infostolpe:  '<rect x="7" y="2.5" width="10" height="19" rx="1"/><path d="M7 6.5h10M9.5 10h5M9.5 12.5h4M9.5 15.5h2.5"/>',
  oppskrift:   '<rect x="7" y="2.5" width="10" height="19" rx="1"/><path d="M7 6.5h10"/><circle cx="12" cy="10.5" r="1.8"/><path d="M9.5 15h2v2h-2zM12.5 15h2v2h-2zM9.5 18.5h5"/>',
  sendestolpe: '<rect x="7" y="2.5" width="10" height="19" rx="1"/><path d="M7 6.5h10M7 11.5h10M7 16.5h10M9 9h3M9 14h3M9 19h3"/>',
  stillbilde:  '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  bildeserie:  '<rect x="7" y="3" width="14" height="12" rx="2"/><path d="M3 7v11a2 2 0 0 0 2 2h11"/><path d="M21 11l-4-4-7 7"/>',
  faksimile:   '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h4M7 16h4"/><path d="M14 12h3v4h-3z"/>',
  fotokonk:    '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  ticker:      '<rect x="2" y="13" width="20" height="5" rx="1"/><path d="M7 13v5M11 13v5M14 8h6M17 5.5 14 8l3 2.5"/>',
  hashtag:     '<path d="M10 4 8 20M16 4l-2 16M5 9h15M4 15h15"/>',
  fotokred:    '<rect x="2.5" y="8" width="19" height="8" rx="3"/><path d="M6 12h3M11 12h7"/>',
  straks:      '<path d="M3 5h6v3H3z"/><rect x="3" y="9" width="6" height="6"/><path d="M10 9h11v6H10zM3 18.5h11"/>',
};
const CHECK_PATH = '<path d="M5 12.5l4.5 4.5L19 7.5"/>';
const PLUS_PATH = '<path d="M12 5v14M5 12h14"/>';
const CROSS_PATH = '<path d="M6 6l12 12M18 6 6 18"/>';
const WARN_PATH = '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>';

// Oppgavene på startsiden. `auto` betyr at oppgaven ikke kan hukes av for hånd.
// Den blir ferdig av seg selv når alle bolkene er huket av:
//   auto: 'script'    bolkene på Script-siden (state.scriptKlar)
//   auto: 'kjoreplan' bolkene i spillelisten (bolk.klar)
const TASKS = [
  { key: 'script',    title: 'Lese script', auto: 'script' },
  { key: 'kjoreplan', title: 'Gå gjennom kjøreplan', auto: 'kjoreplan' },
  { key: 'supere',    title: 'Klargjøre navnesuper for gjester' },
  { key: 'fotokonk',  title: 'Sjekke bidrag i fotokonkurransen' },
  { key: 'produsent', title: 'Morgenmøte med produksjonen' },
  { key: 'test',      title: 'Prøvekjøre grafikk før sending' },
];

// Eksempel-kjøreplan. Alle navn, steder og saker er oppdiktet.
function lagKjoreplan() {
  const E = (id, type, felt = {}) => ({ id, type, ...TYPES[type].ny({ id }), ...felt });
  const R = (tittel, tid, status, scene = 'portrett') => ({ tittel, tid, status, scene });
  const B = (motiv, kreditering, scene) => ({ motiv, kreditering, scene });
  const K = (navn, tittel, sted, fylke, scene) => ({ navn, tittel, sted, fylke, scene });
  const dato = datoTekst();

  return [
    { time: '07:00', title: 'Åpning og dagens saker', klar: false, els: [
      E('e01', 'straks'),
      E('e02', 'navnesuper', { navn: 'Silje Mo Aasen', tittel: 'Programleder' }),
      E('e03', 'navnesuper', { navn: 'Jonas Hovland', tittel: 'Programleder' }),
      E('e04', 'sendestolpe', { rader: [
        R('Forbrukerøkonom Mari Solheim', '07.10 (11.10)', 'neste'),
        R('Årets ildsjel Gunnhild Ravn', '07.38 (11.38)', 'senere'),
        R('Kokk Kristian Moe', '07.50 (11.50)', 'senere', 'mat'),
        R('Regissør Nora Lindqvist', '08.20 (12.20)', 'senere'),
      ] }),
      E('e05', 'ticker', { dato, klokke: klokkeTekst('07:00'), nyheter: [
        'Strømprisen ventes å stige kraftig i Sør-Norge før jul',
        'Glatte veier og kø på flere innfartsårer i morgentimene',
        'Snøfall på fjellovergangene – sjekk veimeldingene før du kjører',
      ].join('\n') }),
      E('e06', 'faksimile', { overskrift: 'Strømprisen kan doble seg i vinter', ingress: 'Ekspertene venter høye priser i Sør-Norge fra desember.', kilde: 'avisavest.no', scene: 'by' }),
      E('e07', 'hashtag', { tekst: '#godmorgennorge' }),
    ] },
    { time: '07:10', title: 'Strømprisen – hva betyr den for deg?', klar: false, els: [
      E('e11', 'navnesuper', { navn: 'Mari Solheim', tittel: 'Forbrukerøkonom' }),
      E('e12', 'faksimile', { overskrift: 'Rekordmange bytter strømavtale', ingress: 'Over 40 000 husstander byttet avtale i oktober.', kilde: 'avisavest.no', scene: 'by' }),
      E('e13', 'infostolpe', { kategori: 'Strømtips', tittel: 'Smart-plugg', beskrivelse: 'Styrer varmtvannsberederen etter strømprisen. Enkel å montere selv.', pris: 'Fra kr 249', bildeplass: 'nederst', produkt: 'eske' }),
      E('e14', 'bildeserie', { tittel: 'Slik leser du strømmåleren', bilder: [
        B('Strømmåleren i sikringsskapet', 'Foto: Kari Holm', 'by'),
        B('Displayet viser forbruket nå', 'Foto: Kari Holm', 'taake'),
        B('Appen viser timeprisen', 'Foto: Kari Holm', 'fjord'),
      ] }),
      E('e15', 'navnesuper', { navn: 'Thomas Rød', tittel: 'Daglig leder, Vestkraft' }),
    ] },
    { time: '07:25', title: 'Været og fotokonkurransen', klar: false, els: [
      E('e21', 'navnesuper', { navn: 'Hanne Lund', tittel: 'Meteorolog' }),
      E('e22', 'stillbilde', { motiv: 'Første snø på vidda', kreditering: 'Foto: Seerbilde', scene: 'sno' }),
      E('e23', 'fotokonk', { overskrift: 'Bidrag fra seerne', bilder: [
        K('Ingrid Sæther', 'Tåkehav over vatnet', 'Stryn', 'Vestland', 'taake'),
        K('Håkon Lie', '', 'Senja', 'Troms', 'nordlys'),
        K('Kari Bjørnstad', 'Høstfarger i hagen', 'Ringsaker', 'Innlandet', 'host'),
      ] }),
      E('e26', 'hashtag', { tekst: '#godmorgennorge' }),
    ] },
    { time: '07:38', title: 'Årets ildsjel', klar: false, els: [
      E('e31', 'infosuper', { tema: 'Årets ildsjel', tekst: 'I dag får Gunnhild Ravn prisen som årets ildsjel. Hun har drevet gratis leksehjelp for barn i Tromsø i over tjue år.' }),
      E('e32', 'navnesuper', { navn: 'Gunnhild Ravn', tittel: 'Årets ildsjel' }),
      E('e33', 'stillbilde', { motiv: 'Gunnhild på leksehjelpen', kreditering: 'Foto: Privat', scene: 'portrett' }),
      E('e34', 'fotokred', { navn: 'Lars Eik', scene: 'by' }),
      E('e35', 'navnesuper', { navn: 'Ola Bergum', tittel: 'Juryleder' }),
    ] },
    { time: '07:50', title: 'GMN-kjøkkenet: Fiskegrateng på 20 minutter', klar: false, els: [
      E('e41', 'navnesuper', { navn: 'Kristian Moe', tittel: 'Kokk og matskribent' }),
      E('e42', 'hashtag', { tekst: '#gmnkjøkkenet' }),
      E('e43', 'oppskrift', { rett: 'Fiskegrateng på 20 minutter' }),
      E('e44', 'bildeserie', { tittel: 'Steg for steg: Fiskegrateng', bilder: [
        B('Fisken skjæres i biter', 'Foto: Anne Strand', 'mat'),
        B('Grønnsakene freses i smør', 'Foto: Anne Strand', 'mat'),
        B('Sausen helles over', 'Foto: Anne Strand', 'mat'),
        B('Ferdig rett rett fra ovnen', 'Foto: Anne Strand', 'mat'),
      ] }),
      E('e45', 'infostolpe', { kategori: 'Vintips', tittel: 'Hvitvin til fisk', beskrivelse: 'Bergkamm Riesling 2024, Mosel, Tyskland', pris: 'Kr 219,90', bildeplass: 'hoyre', produkt: 'hvitvin' }),
      E('e46', 'infostolpe', { kategori: 'Vintips', tittel: 'Alkoholfritt', beskrivelse: 'Solbakken eplemost med bringebær, Hardanger, Norge', pris: 'Kr 89,90', bildeplass: 'nederst', produkt: 'most' }),
    ] },
    { time: '08:05', title: 'Helse: Søvn i mørketiden', klar: false, els: [
      E('e51', 'navnesuper', { navn: 'Lene Bakke', tittel: 'Søvnforsker' }),
      E('e52', 'infosuper', { tema: 'Søvn i mørketiden', tekst: 'Hver tredje nordmann sover dårligere om vinteren. Dagslys om morgenen er det viktigste rådet fra forskerne.' }),
      E('e53', 'faksimile', { overskrift: 'Slik sover du bedre i mørketiden', ingress: 'Fem råd fra forskerne som faktisk virker.', kilde: 'helsepuls.no', scene: 'nordlys' }),
      E('e54', 'ticker', { dato, klokke: klokkeTekst('08:05'), nyheter: [
        'Søvnforskere: Dagslys om morgenen gir bedre søvn',
        'Flere fly innstilt på grunn av tåke på Vestlandet',
        'Ny rapport: Flere unge velger fagbrev',
      ].join('\n') }),
    ] },
    { time: '08:20', title: 'Kultur: Ny norsk film', klar: false, els: [
      E('e61', 'navnesuper', { navn: 'Nora Lindqvist', tittel: 'Regissør' }),
      E('e62', 'stillbilde', { motiv: 'Fra filmen «Fjellet»', kreditering: 'Foto: Filmselskapet Nord', scene: 'sno' }),
      E('e63', 'bildeserie', { tittel: 'Bilder fra premieren', bilder: [
        B('Den røde løperen', 'Foto: Jens Viken', 'by'),
        B('Regissøren på scenen', 'Foto: Jens Viken', 'portrett'),
        B('Publikum i salen', 'Foto: Jens Viken', 'by'),
        B('Skuespillerne etter visningen', 'Foto: Jens Viken', 'portrett'),
        B('Utsikt fra innspillingen', 'Foto: Filmselskapet Nord', 'fjord'),
      ] }),
      E('e64', 'navnesuper', { navn: 'Aksel Strand', tittel: 'Skuespiller' }),
      E('e65', 'fotokred', { navn: 'Ida Fjeld', scene: 'fjord' }),
    ] },
    { time: '08:35', title: 'Fotokonkurransen og avslutning', klar: false, els: [
      E('e71', 'fotokonk', { overskrift: 'Ukens vinner', bilder: [
        K('Mats Hagen', 'Morgen ved havgapet', 'Lofoten', 'Nordland', 'fjord'),
        K('Berit Aune', '', 'Hamar', 'Innlandet', 'taake'),
        K('Per Ulvestad', 'Stille sjø', 'Kragerø', 'Telemark', 'host'),
        K('Siri Nordvik', 'Nordlys over Alta', 'Alta', 'Finnmark', 'nordlys'),
      ] }),
      E('e75', 'sendestolpe', { rader: [
        R('Søvnforsker Lene Bakke', '08.05 (12.05)', 'sendt'),
        R('Regissør Nora Lindqvist', '08.20 (12.20)', 'sendt'),
        R('Ukens vinner i fotokonkurransen', '08.40 (12.40)', 'neste', 'host'),
        R('Dette skjer i morgen', '08.45 (12.45)', 'senere', 'fjord'),
      ] }),
      E('e76', 'ticker', { variant: 'instagram', dato, klokke: klokkeTekst('08:35') }),
      E('e77', 'navnesuper', { navn: 'Silje Mo Aasen', tittel: 'Programleder' }),
    ] },
  ];
}


// Slutten på siste bolk (de andre slutter når neste bolk begynner)
const SENDING_SLUTT = '08:50';

// Typene i tidslinjen på Script-siden
const TL_TYPER = {
  studio:  'Studio',
  innslag: 'Innslag',
  inn:     'Inn i studio',
  ut:      'Ut av studio',
  grafikk: 'Grafikk',
  pause:   'Reklame',
};

// Script for hver bolk (samme rekkefølge som i kjøreplanen). Alt er oppdiktet.
//   gjester:   hvem som er med i tillegg til programlederne
//   manus:     replikker [hvem, tekst]. hvem = null er en regibeskjed.
//   guide:     spørsmålene til hver gjest, i rekkefølge
//   tidslinje: [klokkeslett, type, tekst, element-id for grafikk]
function lagScript() {
  return [
    { // Bolk 0
      gjester: [['Erik Brandal', 'Nyhetsoppleser']],
      manus: [
        [null, 'Straks-plakaten står på skjermen frem til vignetten.'],
        ['Silje', 'God morgen, og velkommen til God morgen Norge! Jeg heter Silje Mo Aasen.'],
        ['Jonas', 'Og jeg heter Jonas Hovland. I dag skal vi snakke om strømprisen, som kan doble seg i vinter. Og vi får besøk av årets ildsjel.'],
        ['Silje', 'Kristian står allerede på kjøkkenet og lager fiskegrateng på tjue minutter. Og senere i dag kårer vi ukens vinner i fotokonkurransen.'],
        ['Jonas', 'Men først: nyhetene. Erik, hva skjer?'],
        ['Erik', 'God morgen. Strømprisen ventes å stige kraftig i Sør-Norge før jul. Ekspertene mener prisen kan doble seg fra desember.'],
        ['Erik', 'Det er glatt på veiene flere steder på Østlandet, og det er kø på flere innfartsårer.'],
        ['Silje', 'Takk, Erik. Etter en kort pause ser vi nærmere på hva strømprisen betyr for deg.'],
      ],
      guide: [],
      tidslinje: [
        ['07:00:00', 'grafikk', 'Straks-plakat før vignetten', 'e01'],
        ['07:00:20', 'innslag', 'Vignett (0.20)'],
        ['07:00:40', 'studio', 'Silje og Jonas i sofaen ønsker velkommen'],
        ['07:00:50', 'grafikk', 'Navnesuper når Silje presenterer seg', 'e02'],
        ['07:01:05', 'grafikk', 'Navnesuper når Jonas presenterer seg', 'e03'],
        ['07:01:30', 'grafikk', 'Dagens sending mens Jonas går gjennom sakene', 'e04'],
        ['07:03:00', 'inn', 'Erik Brandal ved nyhetsdesken'],
        ['07:03:10', 'grafikk', 'Ticker på under nyhetene', 'e05'],
        ['07:04:30', 'grafikk', 'Faksimile når Erik leser strømsaken', 'e06'],
        ['07:07:30', 'ut', 'Erik Brandal'],
        ['07:08:00', 'grafikk', 'Hashtag mens Silje ber om innspill fra seerne', 'e07'],
        ['07:09:30', 'pause', 'Reklame (0.30)'],
      ],
    },
    { // Bolk 1
      gjester: [['Mari Solheim', 'Forbrukerøkonom'], ['Thomas Rød', 'Daglig leder, Vestkraft']],
      manus: [
        ['Jonas', 'Strømprisen er ventet å stige kraftig før jul. Hva betyr det for deg som skal betale regningen?'],
        ['Silje', 'Vi har med oss forbrukerøkonom Mari Solheim. God morgen!'],
        [null, 'Intervju med Mari. Se intervjuguiden.'],
        ['Jonas', 'Mange vet ikke hvor mye strøm de faktisk bruker. Vi har sett på hvordan du leser strømmåleren.'],
        [null, 'Innslag: Slik leser du strømmåleren (1.40).'],
        ['Silje', 'Thomas Rød er daglig leder i Vestkraft. Thomas, hvorfor blir det så dyrt i vinter?'],
        [null, 'Intervju med Thomas. Mari blir sittende.'],
        ['Jonas', 'Takk til dere begge. Alle strømtipsene finner du på TV2.no.'],
      ],
      guide: [
        ['Mari Solheim', [
          'Hvor mye mer kan en vanlig familie måtte betale i vinter?',
          'Lønner det seg å bytte strømavtale nå?',
          'Hva er det enkleste rådet for å kutte forbruket?',
          'Hvordan fungerer en smart-plugg, og er den verdt pengene?',
        ]],
        ['Thomas Rød', [
          'Hvorfor stiger prisen så mye akkurat nå?',
          'Hvor lenge tror du de høye prisene varer?',
          'Hva gjør strømselskapene for å hjelpe kundene?',
        ]],
      ],
      tidslinje: [
        ['07:10:00', 'studio', 'Jonas introduserer saken'],
        ['07:10:30', 'inn', 'Mari Solheim i sofaen'],
        ['07:10:45', 'grafikk', 'Navnesuper på Mari', 'e11'],
        ['07:12:00', 'grafikk', 'Faksimile når Silje nevner at mange bytter avtale', 'e12'],
        ['07:14:30', 'grafikk', 'Infostolpe når Mari forklarer smart-pluggen', 'e13'],
        ['07:16:00', 'innslag', 'Slik leser du strømmåleren (1.40)'],
        ['07:16:10', 'grafikk', 'Bildeserie i innslaget, bla på tegn fra produsent', 'e14'],
        ['07:17:40', 'inn', 'Thomas Rød i sofaen'],
        ['07:17:55', 'grafikk', 'Navnesuper på Thomas', 'e15'],
        ['07:23:30', 'ut', 'Mari Solheim og Thomas Rød'],
        ['07:24:30', 'pause', 'Reklame (0.30)'],
      ],
    },
    { // Bolk 2
      gjester: [['Hanne Lund', 'Meteorolog']],
      manus: [
        ['Silje', 'Det har vært en kald natt mange steder i landet. Hanne Lund, hvordan blir været i dag?'],
        ['Hanne', 'God morgen! Det blir en klar og kald dag på Østlandet, mens Vestlandet får regn og vind utover dagen.'],
        ['Hanne', 'Og på fjellet har det kommet snø. Dette bildet fikk vi fra en seer i morgentimene.'],
        ['Jonas', 'Apropos bilder: Dere har sendt inn mange fine bidrag til fotokonkurransen. Her er noen av dem.'],
        [null, 'Tre bidrag vises etter hverandre, ca. 15 sekunder hver.'],
        ['Silje', 'Send inn ditt bilde på tv2.no/fotokonkurranse, så kan du vinne en GMN-kopp og et handlenett.'],
      ],
      guide: [
        ['Hanne Lund', [
          'Hvor kaldt blir det i natt?',
          'Når kommer snøen til lavlandet?',
          'Hva bør bilistene tenke på i dag?',
        ]],
      ],
      tidslinje: [
        ['07:25:00', 'inn', 'Hanne Lund ved værkartet'],
        ['07:25:10', 'grafikk', 'Navnesuper på Hanne', 'e21'],
        ['07:28:30', 'grafikk', 'Stillbilde av snøen på vidda', 'e22'],
        ['07:31:00', 'studio', 'Overgang til fotokonkurransen'],
        ['07:31:15', 'grafikk', 'Fotokonkurransen: tre bidrag, bla på tegn fra produsent', 'e23'],
        ['07:32:15', 'grafikk', 'Hashtag mens Silje ber seerne sende inn', 'e26'],
        ['07:35:00', 'ut', 'Hanne Lund'],
        ['07:37:30', 'pause', 'Reklame (0.30)'],
      ],
    },
    { // Bolk 3
      gjester: [['Gunnhild Ravn', 'Årets ildsjel'], ['Ola Bergum', 'Juryleder']],
      manus: [
        ['Jonas', 'Hun har gitt tusenvis av barn i Tromsø leksehjelp, helt gratis. I dag får hun prisen som årets ildsjel.'],
        [null, 'Innslag: Et besøk på leksehjelpen (2.10).'],
        ['Silje', 'Gunnhild Ravn, gratulerer! Hvordan føles det?'],
        [null, 'Intervju med Gunnhild. Se intervjuguiden.'],
        ['Jonas', 'Ola Bergum leder juryen. Ola, hvorfor ble det Gunnhild i år?'],
        [null, 'Ola overrekker prisen i studio.'],
        ['Silje', 'Gratulerer igjen, Gunnhild. Og takk for alt du gjør!'],
      ],
      guide: [
        ['Gunnhild Ravn', [
          'Hvordan startet leksehjelpen?',
          'Hva betyr det for barna å ha et sted å gå etter skolen?',
          'Hvordan har du klart å holde det gående i over tjue år?',
          'Hva skal du gjøre med prispengene?',
        ]],
        ['Ola Bergum', [
          'Hvor mange ble nominert i år?',
          'Hva gjorde at juryen valgte Gunnhild?',
        ]],
      ],
      tidslinje: [
        ['07:38:00', 'grafikk', 'Infosuper mens Jonas introduserer', 'e31'],
        ['07:38:40', 'innslag', 'Et besøk på leksehjelpen (2.10)'],
        ['07:39:00', 'grafikk', 'Fotokreditering på bildene i innslaget', 'e34'],
        ['07:40:50', 'inn', 'Gunnhild Ravn i sofaen'],
        ['07:41:00', 'grafikk', 'Navnesuper på Gunnhild', 'e32'],
        ['07:43:30', 'grafikk', 'Stillbilde fra leksehjelpen', 'e33'],
        ['07:45:00', 'inn', 'Ola Bergum med prisen'],
        ['07:45:10', 'grafikk', 'Navnesuper på Ola', 'e35'],
        ['07:48:30', 'ut', 'Gunnhild Ravn og Ola Bergum'],
        ['07:49:30', 'pause', 'Reklame (0.30)'],
      ],
    },
    { // Bolk 4
      gjester: [['Kristian Moe', 'Kokk og matskribent']],
      manus: [
        ['Silje', 'Nå er det tid for GMN-kjøkkenet! Kristian, hva lager du til oss i dag?'],
        ['Kristian', 'I dag blir det fiskegrateng, og den er ferdig på tjue minutter. Perfekt til en travel hverdag.'],
        ['Jonas', 'Tjue minutter? Det må vi se.'],
        [null, 'Kristian lager retten. Bildeserien vises når han går gjennom stegene.'],
        ['Kristian', 'Til fisken passer en frisk hvitvin. Vil du ha noe uten alkohol, er eplemost med bringebær et godt valg.'],
        ['Silje', 'Hele oppskriften finner du på TV2.no/mat. Skann koden på skjermen.'],
      ],
      guide: [
        ['Kristian Moe', [
          'Hvilken fisk fungerer best i grateng?',
          'Hvordan får du det til på tjue minutter?',
          'Kan man lage den dagen før?',
          'Hva passer som tilbehør?',
        ]],
      ],
      tidslinje: [
        ['07:50:00', 'studio', 'Silje og Jonas går over til kjøkkenet'],
        ['07:50:20', 'inn', 'Kristian Moe på kjøkkenet'],
        ['07:50:30', 'grafikk', 'Navnesuper på Kristian', 'e41'],
        ['07:51:00', 'grafikk', 'Hashtag mens retten presenteres', 'e42'],
        ['07:52:00', 'grafikk', 'Oppskriftstolpe når Kristian nevner retten', 'e43'],
        ['07:54:00', 'grafikk', 'Bildeserie: steg for steg', 'e44'],
        ['08:00:00', 'grafikk', 'Vintips: hvitvin', 'e45'],
        ['08:01:00', 'grafikk', 'Vintips: alkoholfritt', 'e46'],
        ['08:03:30', 'studio', 'Smaking i studio'],
        ['08:04:30', 'pause', 'Reklame (0.30)'],
      ],
    },
    { // Bolk 5
      gjester: [['Lene Bakke', 'Søvnforsker']],
      manus: [
        ['Jonas', 'Mange synes det er tungt å komme seg opp om morgenen nå som det er mørkt. Er du en av dem?'],
        ['Silje', 'Søvnforsker Lene Bakke er her for å gi oss gode råd. God morgen!'],
        [null, 'Intervju med Lene. Se intervjuguiden.'],
        ['Silje', 'Takk, Lene. Og sov godt i natt!'],
        ['Jonas', 'Nå skal vi få en kort oppdatering på nyhetene.'],
        [null, 'Nyhetsoppdatering fra desken (5.00).'],
      ],
      guide: [
        ['Lene Bakke', [
          'Hvorfor sover vi dårligere om vinteren?',
          'Hvor viktig er dagslys om morgenen?',
          'Hjelper det med lysterapilamper?',
          'Hva er ditt beste råd til dem som sliter med å sovne?',
        ]],
      ],
      tidslinje: [
        ['08:05:00', 'inn', 'Lene Bakke i sofaen'],
        ['08:05:20', 'grafikk', 'Navnesuper på Lene', 'e51'],
        ['08:06:00', 'grafikk', 'Infosuper om søvn i mørketiden', 'e52'],
        ['08:09:00', 'grafikk', 'Faksimile: slik sover du bedre', 'e53'],
        ['08:13:00', 'ut', 'Lene Bakke'],
        ['08:13:10', 'studio', 'Nyhetsoppdatering fra desken'],
        ['08:13:20', 'grafikk', 'Ticker under nyhetene', 'e54'],
        ['08:19:30', 'pause', 'Reklame (0.30)'],
      ],
    },
    { // Bolk 6
      gjester: [['Nora Lindqvist', 'Regissør'], ['Aksel Strand', 'Skuespiller']],
      manus: [
        ['Silje', 'Den er spilt inn på en fjelltopp i Nord-Norge og har allerede fått strålende kritikker. Nå kommer «Fjellet» på kino.'],
        [null, 'Trailer (1.30).'],
        ['Jonas', 'Regissør Nora Lindqvist og skuespiller Aksel Strand, velkommen!'],
        [null, 'Intervju. Bildeserien fra premieren vises når Silje spør om premieren.'],
        ['Silje', '«Fjellet» har kinopremiere på fredag. Takk for at dere kom!'],
      ],
      guide: [
        ['Nora Lindqvist', [
          'Hvorfor ville du lage film på en fjelltopp?',
          'Hva var den største utfordringen under innspillingen?',
          'Hvordan var premieren i går?',
        ]],
        ['Aksel Strand', [
          'Hvordan forberedte du deg til rollen?',
          'Hvor kaldt var det egentlig?',
        ]],
      ],
      tidslinje: [
        ['08:20:00', 'studio', 'Silje introduserer filmen'],
        ['08:20:20', 'innslag', 'Trailer: «Fjellet» (1.30)'],
        ['08:22:00', 'inn', 'Nora Lindqvist og Aksel Strand i sofaen'],
        ['08:22:10', 'grafikk', 'Navnesuper på Nora', 'e61'],
        ['08:22:40', 'grafikk', 'Navnesuper på Aksel', 'e64'],
        ['08:24:00', 'grafikk', 'Stillbilde fra filmen', 'e62'],
        ['08:27:00', 'grafikk', 'Bildeserie fra premieren', 'e63'],
        ['08:27:05', 'grafikk', 'Fotokreditering på premierebildene', 'e65'],
        ['08:33:00', 'ut', 'Nora Lindqvist og Aksel Strand'],
        ['08:34:30', 'pause', 'Reklame (0.30)'],
      ],
    },
    { // Bolk 7
      gjester: [],
      manus: [
        ['Jonas', 'Det er snart slutt for i dag, men vi har mer på lager. Her er det som kommer.'],
        ['Silje', 'Nå skal vi kåre ukens vinner i fotokonkurransen. Det har kommet mange fine bidrag denne uka.'],
        [null, 'Fire bidrag vises etter hverandre. Vinneren vises sist.'],
        ['Jonas', 'Og vinneren er … Siri Nordvik fra Alta! For et nordlys. Gratulerer, du får en GMN-kopp og et handlenett i posten.'],
        ['Silje', 'Husk at du kan følge oss på Instagram.'],
        ['Silje', 'Det var alt for i dag. Takk for at du så på, og ha en fin dag!'],
        ['Jonas', 'Vi ses i morgen!'],
      ],
      guide: [],
      tidslinje: [
        ['08:35:00', 'studio', 'Silje og Jonas i sofaen'],
        ['08:35:20', 'grafikk', 'Dagens sending: det som kommer', 'e75'],
        ['08:40:00', 'grafikk', 'Fotokonkurransen: fire bidrag, vinneren vises sist', 'e71'],
        ['08:44:00', 'grafikk', 'Ticker: Følg oss på Instagram', 'e76'],
        ['08:48:00', 'grafikk', 'Navnesuper på Silje under avslutningen', 'e77'],
        ['08:49:30', 'innslag', 'Rulletekst (0.30)'],
      ],
    },
  ];
}
const SCRIPT = lagScript();
const PROGRAMLEDERE = [['Silje Mo Aasen', 'Programleder'], ['Jonas Hovland', 'Programleder']];

// Den som er pålogget. Fylles inn som grafikkavvikler i «Dagens info».
const BRUKER = 'Maia';

// «Dagens info» på startsiden. Vises når kjøreplanen er hentet. Oppdiktet.
const DAGENS_INFO = {
  produsent: 'Eirik Haugland',
  vaktsjef: 'Ingrid Solvang',
  beskjeder: [
    'Straks-plakaten står til vignetten starter kl. 07.00.',
    'Kjøkkenet rigges i reklamepausen før Bolk 4.',
    'Vinneren i fotokonkurransen kåres i Bolk 7. Ikke vis vinnerbildet før.',
  ],
};

// Nøkkelen i localStorage som husker at opplæringen er lukket
const INTRO_KEY = 'converge-intro-lukket';


/* ----------------------------------------------------------
   2. Tilstand
   ---------------------------------------------------------- */
const state = {
  screen: 'start',        // 'start', 'script' eller 'list'
  scriptBolk: 0,          // bolken som vises på Script-siden
  scriptKlar: SCRIPT.map(() => false),  // bolkene som er huket av på Script-siden
  pendingOpen: null,      // element som skal åpnes når kjøreplanen er hentet
  fetched: false,         // er kjøreplanen hentet?
  loading: false,         // holder vi på å hente?
  fetchedAt: null,
  doneTasks: { supere: false, fotokonk: false, produsent: false, test: false },
  blockedTask: null,      // oppgave som ikke kan hukes av ennå (viser en melding)
  bolker: lagKjoreplan(),
  activeBolk: 0,          // indeks i state.bolker
  selectedId: null,       // id på elementet som er åpent i preview
  draft: null,            // nytt element fra paletten som ikke er lagt i spillelisten ennå
  mode: 'preview',        // 'preview' eller 'edit'
  serieIndex: 0,          // bildet som vises når en bildeserie (eller fotokonkurransen) er åpen
  viz: { 1: null, 2: null, 3: null },  // id på elementet som er klart på hver VIZ-kanal
  pushMenu: null,         // id på elementet som har PUSH-menyen åpen
  msg: '',                // siste melding i elementlisten (leses opp av skjermleser)
  undo: null,             // sist fjernede element { el, bolk, index }, for «Angre»
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

function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

// Fast tall ut fra en tekst, slik at plassholderbildene blir like hver gang
function hash(text) {
  let h = 2166136261;
  for (const ch of String(text)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function pick(list, seed) {
  return list[seed % list.length];
}

// '07:40' → '07.40 (11.40)'. Tiden i parentes ligger fire timer etter, som i referansene.
function medReprise(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(h)}.${pad(m)} (${pad((h + 4) % 24)}.${pad(m)})`;
}
function klokkeTekst(hhmm) {
  return `kl. ${medReprise(hhmm)}`;
}
// «Tirsdag 10. november»
function datoTekst(date = new Date()) {
  const text = date.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function antallSetninger(text) {
  return String(text || '').split(/[.!?]+(?=\s|$)/).map((s) => s.trim()).filter(Boolean).length;
}
function setningerTekst(text) {
  const n = antallSetninger(text);
  return n ? `${n} ${n === 1 ? 'setning' : 'setninger'}` : '';
}

// Fire rader til en ny sendestolpe, hentet fra bolkene i kjøreplanen
function autoRader({ bolker, index } = {}) {
  if (!bolker) {
    return [0, 1, 2, 3].map(() => ({ tittel: '', tid: '', status: 'senere', scene: 'portrett' }));
  }
  const etter = bolker.slice(index + 1, index + 5).map((b, i) => ({ b, status: i === 0 ? 'neste' : 'senere' }));
  const start = Math.max(0, index + 1 - (4 - etter.length));
  const for_ = bolker.slice(start, index + 1).map((b) => ({ b, status: 'sendt' }));
  return [...for_, ...etter].map(({ b, status }) => (
    { tittel: b.title, tid: medReprise(b.time), status, scene: 'portrett' }
  ));
}

// Setter en verdi ut fra en sti, f.eks. 'bilder.2.kreditering'
function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => o[k], obj);
  target[last] = value;
}

function activeBolk() {
  return state.bolker[state.activeBolk];
}

// Bolkene nummereres 0–7, slik produksjonen gjør. Bolk 0 er åpningen.
function bolkNavn(index) {
  return `Bolk ${index}`;
}

// En bolk slutter når den neste begynner
function bolkSlutt(index) {
  const neste = state.bolker[index + 1];
  return neste ? neste.time : SENDING_SLUTT;
}

// «Stryn, Vestland»
function stedTekst(el) {
  return [el.sted, el.fylke].filter(Boolean).join(', ');
}

function minutter(fra, til) {
  const m = (t) => { const [h, min] = t.split(':').map(Number); return h * 60 + min; };
  return m(til) - m(fra);
}

function initialer(navn) {
  const deler = navn.split(/\s+/).filter(Boolean);
  return (deler[0][0] + (deler.length > 1 ? deler[deler.length - 1][0] : '')).toUpperCase();
}

// Finner et element i hele kjøreplanen
function findElement(id) {
  for (let i = 0; i < state.bolker.length; i++) {
    const el = state.bolker[i].els.find((e) => e.id === id);
    if (el) return { el, bolk: i };
  }
  return null;
}

// VIZ-kanalen elementet ligger klart på, eller null
const VIZ_KANALER = [1, 2, 3];
function vizFor(id) {
  return VIZ_KANALER.find((k) => state.viz[k] === id) || null;
}

// Returnerer det valgte elementet med plassering, eller null.
// Et nytt element fra paletten (state.draft) går foran og har ingen plass ennå.
function selected() {
  if (!state.fetched) return null;
  const els = activeBolk().els;
  if (state.draft) return { el: state.draft, index: -1, total: els.length, draft: true };
  const index = els.findIndex((el) => el.id === state.selectedId);
  return index === -1 ? null : { el: els[index], index, total: els.length };
}

function serieIndex(el) {
  return clamp(state.serieIndex, 0, Math.max(el.bilder.length - 1, 0));
}

// Fremdrift: seks like deler. Fire oppgaver hukes av manuelt. «Lese script» og
// «Gå gjennom kjøreplan» fylles opp bolk for bolk (Script-siden og spillelisten).
function progress() {
  const total = state.bolker.length;
  const klar = state.bolker.filter((b) => b.klar).length;
  const lest = state.scriptKlar.filter(Boolean).length;
  const manual = Object.values(state.doneTasks).filter(Boolean).length;
  const pct = Math.round(((manual + klar / total + lest / total) / TASKS.length) * 100);
  const tasksDone = manual + (klar === total ? 1 : 0) + (lest === total ? 1 : 0);
  return { pct, klar, lest, total, tasksDone, auto: { kjoreplan: klar, script: lest } };
}

function elTitle(el) {
  return TYPES[el.type].tittel(el) || '';
}

function metaText(el) {
  const meta = TYPES[el.type].meta(el);
  return meta ? `${TYPES[el.type].label} · ${meta}` : TYPES[el.type].label;
}

function previewTitle(sel) {
  return sel ? `${TYPES[sel.el.type].label} · ${elTitle(sel.el) || 'Nytt element'}` : 'Forhåndsvisning';
}

// «Navnesuper · Silje Mo Aasen»
function elLabel(el) {
  return `${TYPES[el.type].label} · ${elTitle(el) || 'Uten tittel'}`;
}

// Når innerHTML byttes ut, mister knappen fokus. Disse to
// funksjonene husker hvilken knapp som hadde fokus og gir det tilbake,
// slik at tastaturbrukere ikke mister plassen sin.
const FOCUS_ATTRS = ['data-id', 'data-push', 'data-viz', 'data-unviz', 'data-remove', 'data-bolk', 'data-klar',
  'data-script-bolk', 'data-script-klar', 'data-goto', 'data-task', 'data-go', 'data-add', 'data-serie'];
function rememberFocus() {
  const active = document.activeElement;
  if (!active) return null;
  for (const attr of FOCUS_ATTRS) {
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
   Grafikken skal ligne God morgen Norge slik den ser ut på TV.
   Bildene er oppdiktede plassholdere tegnet med SVG, og logoene
   er enkle plassholdere til vi får de offisielle filene.
   ---------------------------------------------------------- */

// Plassholderbilder. Himmel og bakgrunn kommer fra CSS-klassen g-scene--<motiv>.
const SCENES = {
  fjord: () => `
    <circle cx="70" cy="30" r="8" fill="#FBE7C2"/>
    <path d="M0 58 18 36 32 48 50 27 68 45 82 33 100 50V64H0z" fill="#6E84A0"/>
    <path d="M0 64 24 52 46 61 70 52 100 61V68H0z" fill="#3C5267"/>
    <path d="M0 68H100V100H0z" fill="#5C84A6"/>
    <path d="M58 74h24M62 80h14M54 86h20" stroke="#FBE7C2" stroke-width="1.2" opacity=".55"/>`,
  host: () => `
    <path d="M0 72H100V100H0z" fill="#7A3B1F"/>
    <path d="M14 72V58l8-7 8 7v14z" fill="#A7322A"/>
    <rect x="47" y="38" width="5" height="36" fill="#4A2A1A"/>
    <circle cx="50" cy="32" r="19" fill="#DE7A2B"/>
    <circle cx="36" cy="40" r="11" fill="#C4561E"/>
    <circle cx="64" cy="38" r="12" fill="#EBA23C"/>
    <g fill="#C9471B"><ellipse cx="20" cy="86" rx="5" ry="2"/><ellipse cx="44" cy="92" rx="6" ry="2.2"/><ellipse cx="72" cy="84" rx="5" ry="2"/><ellipse cx="86" cy="94" rx="6" ry="2"/></g>
    <g fill="#E39B3A"><ellipse cx="32" cy="80" rx="4" ry="1.6"/><ellipse cx="60" cy="88" rx="5" ry="1.8"/><ellipse cx="10" cy="95" rx="4" ry="1.6"/></g>`,
  sno: () => `
    <path d="M0 62 22 30 34 44 52 18 70 42 82 32 100 52V100H0z" fill="#7C8898"/>
    <path d="M22 30 28 39 24 38 18 42zM52 18 60 30 55 28 50 33 46 27zM82 32 88 40 84 39 79 41z" fill="#F6F8FB"/>
    <path d="M0 74 30 64 60 72 100 62V100H0z" fill="#4E5E4F"/>
    <path d="M0 86 40 80 100 88V100H0z" fill="#E9EEF2"/>`,
  taake: () => `
    <circle cx="30" cy="34" r="6" fill="#FFF1D6" opacity=".9"/>
    <path d="M0 50 20 42 40 48 62 38 82 46 100 40V60H0z" fill="#8E9DAA" opacity=".55"/>
    <path d="M0 58 26 50 50 57 76 48 100 55V64H0z" fill="#5E6F7C" opacity=".8"/>
    <path d="M0 64H100V100H0z" fill="#9FB2C2"/>
    <path d="M0 64H100V70H0z" fill="#FFFFFF" opacity=".35"/>
    <path d="M28 80h10M44 84h14M66 78h8" stroke="#FFFFFF" stroke-width="1" opacity=".5"/>`,
  nordlys: () => `
    <path d="M0 40C20 20 40 46 60 26S90 30 100 20" stroke="#5EE3A1" stroke-width="7" fill="none" opacity=".55"/>
    <path d="M0 50C25 34 45 52 70 36S95 40 100 32" stroke="#8CF2C4" stroke-width="3" fill="none" opacity=".5"/>
    <g fill="#FFFFFF"><circle cx="12" cy="12" r=".6"/><circle cx="34" cy="8" r=".5"/><circle cx="58" cy="14" r=".6"/><circle cx="80" cy="9" r=".5"/><circle cx="92" cy="18" r=".6"/></g>
    <path d="M0 72 18 58 30 66 48 52 66 64 80 56 100 68V100H0z" fill="#0B1420"/>
    <path d="M0 84H100V100H0z" fill="#16273A"/>`,
  by: () => `
    <circle cx="74" cy="44" r="7" fill="#F7C978" opacity=".9"/>
    <g fill="#2B2436"><path d="M4 100V56h14v44zM20 100V44h12v56zM34 100V60h16v40zM52 100V38h12v62zM66 100V54h14v46zM82 100V48h14v52z"/></g>
    <g fill="#F6C66B"><path d="M7 62h2.5v2.5H7zM12 70h2.5v2.5H12zM23 50h2.5v2.5H23zM27 58h2.5v2.5H27zM38 66h2.5v2.5H38zM44 74h2.5v2.5H44zM55 44h2.5v2.5H55zM59 56h2.5v2.5H59zM70 60h2.5v2.5H70zM86 54h2.5v2.5H86zM90 66h2.5v2.5H90z"/></g>`,
  mat: (s) => {
    const farger = ['#9C3B2E', '#E3B04A', '#6F9140', '#E08A3A', '#B9AE98', '#7A4A8C'];
    const f = (i) => farger[(s + i) % farger.length];
    return `
      <circle cx="32" cy="34" r="20" fill="#F2EEE6"/><circle cx="32" cy="34" r="13" fill="${f(0)}"/>
      <circle cx="74" cy="26" r="14" fill="#ECE5D8"/><circle cx="74" cy="26" r="9" fill="${f(1)}"/>
      <circle cx="70" cy="70" r="17" fill="#EEE7DB"/><circle cx="70" cy="70" r="11" fill="${f(2)}"/>
      <circle cx="24" cy="78" r="11" fill="#DDD2C2"/><circle cx="24" cy="78" r="7" fill="${f(3)}"/>
      <path d="M44 58l14-6M46 64l14-6M48 70l12-5" stroke="#E07A2A" stroke-width="3.5" stroke-linecap="round"/>
      <circle cx="90" cy="50" r="4" fill="#F3E6C8"/><circle cx="93" cy="59" r="3.5" fill="#F3E6C8"/>`;
  },
  portrett: (s) => {
    const klaer = pick(['#3E4A6B', '#7A2E3A', '#2F5D50', '#5B4A7A', '#B5763A'], s);
    const har = pick(['#4A3529', '#C9A46A', '#2A2220', '#8A5A3A'], s >>> 3);
    const hud = pick(['#E2BFA4', '#C99A7A', '#8D5F45', '#F0D3BE'], s >>> 5);
    return `
      <path d="M14 100c2-24 17-36 36-36s34 12 36 36z" fill="${klaer}"/>
      <rect x="44" y="52" width="12" height="14" fill="${hud}"/>
      <circle cx="50" cy="40" r="15" fill="${hud}"/>
      <path d="M35 38c0-13 7-20 15-20s15 7 15 20c-3-7-9-10-15-10s-12 3-15 10z" fill="${har}"/>`;
  },
};

function scene(kind, seed = 0) {
  const k = SCENES[kind] ? kind : 'fjord';
  return `<span class="g-scene g-scene--${k}" aria-hidden="true"><svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" focusable="false">${SCENES[k](seed >>> 0)}</svg></span>`;
}

// Produktbilde på infostolpen
function produkt(kind) {
  if (kind === 'eske') {
    return `<svg viewBox="0 0 60 80" aria-hidden="true" focusable="false">
      <rect x="4" y="8" width="52" height="70" rx="3" fill="#F4F1EA"/><path d="M4 11a3 3 0 0 1 3-3h46a3 3 0 0 1 3 3v15H4z" fill="#3C6E8F"/>
      <circle cx="30" cy="52" r="15" fill="#E3DED4"/><circle cx="25" cy="50" r="2.4" fill="#6B6660"/><circle cx="35" cy="50" r="2.4" fill="#6B6660"/></svg>`;
  }
  const glass = { hvitvin: '#B8A54C', rodvin: '#3A1621', most: '#C9452E' }[kind] || '#2F4A33';
  return `<svg viewBox="0 0 40 120" aria-hidden="true" focusable="false">
    <path d="M16 0h8v30c0 6 10 12 10 24v60a6 6 0 0 1-6 6H12a6 6 0 0 1-6-6V54c0-12 10-18 10-24z" fill="${glass}"/>
    <rect x="6" y="66" width="28" height="30" fill="#F4EEDF"/>
    <path d="M11 74h18M13 80h14M11 86h12" stroke="#6B5B4A" stroke-width="1.6"/>
    <path d="M10 58c2-6 4-9 6-12" stroke="#FFFFFF" stroke-width="2" opacity=".35" fill="none"/></svg>`;
}

// QR-kode (plassholder): tre faste hjørnemerker og tilfeldige ruter ellers
function qrKode(seed) {
  const n = 25;
  let a = seed >>> 0;
  const rnd = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const corner = (x, y) => {
    for (const [ox, oy] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
      const lx = x - ox, ly = y - oy;
      if (lx >= -1 && lx <= 7 && ly >= -1 && ly <= 7) {
        if (lx < 0 || lx > 6 || ly < 0 || ly > 6) return false;
        return lx === 0 || lx === 6 || ly === 0 || ly === 6 || (lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4);
      }
    }
    return null;
  };
  let d = '';
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const c = corner(x, y);
      if (c === true || (c === null && rnd() < 0.5)) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  return `<svg class="g-qr" viewBox="-2 -2 29 29" shape-rendering="crispEdges" aria-hidden="true" focusable="false"><rect x="-2" y="-2" width="29" height="29" fill="#FFFFFF"/><path d="${d}" fill="#161616"/></svg>`;
}

// GMN-G-en og TV 2-logoen er enkle plassholdere
const GMN_G = '<svg class="g-logo" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><path d="M77.6 26.9A36 36 0 1 0 86 50H52" fill="none" stroke="currentColor" stroke-width="22"/></svg>';
const TV2_LOGO = '<span class="g-tv2" aria-hidden="true"><span class="g-tv2__2">2</span><span class="g-tv2__sub">Direkte</span></span>';
const IG_ICON = '<svg class="g-ig" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1.2" fill="currentColor" stroke="none"/></svg>';

// Kamerabilde (plassholder) bak supere og overlegg
function kamera(person = true) {
  return `<div class="g-kamera" aria-hidden="true">${person ? '<span class="g-kamera__kropp"></span><span class="g-kamera__hode"></span>' : ''}</div>`;
}
function pille(text, cls) {
  return `<span class="g-pille ${cls}">${text}</span>`;
}
function hjorneLogo(cls) {
  return `<span class="g-hjorne ${cls}">${GMN_G}</span>`;
}

// Ett stående bilde på varm bakgrunn (stillbilde og bildeserie)
function bildeFlate(kind, seed, kreditering) {
  return `
    <div class="g-bg g-bg--varm"></div>
    <div class="g-portrett">
      ${scene(kind, seed)}
      <span class="g-kreditering">${kreditering}</span>
    </div>
    ${TV2_LOGO}`;
}

// Malene får elementet og v(nøkkel), som gir feltverdien klar for
// innerHTML – eller [Feltnavn] når feltet er tomt.
const STAGE = {
  navnesuper: (el, v) => `
    ${kamera()}
    <div class="g-super">
      <span class="g-super__navn">${v('navn')}</span>
      <span class="g-super__tittel">${v('tittel')}</span>
    </div>`,

  infosuper: (el, v) => `
    ${kamera()}
    <div class="g-infosuper">
      <span class="g-infosuper__fane">${v('tema')}</span>
      <span class="g-infosuper__tekst">${v('tekst')}</span>
    </div>`,

  infostolpe: (el, v) => `
    ${kamera()}
    <div class="g-stolpe g-stolpe--info g-stolpe--${el.bildeplass === 'nederst' ? 'nederst' : 'hoyre'}">
      <div class="g-stolpe__topp">${v('kategori')}</div>
      <div class="g-info">
        <span class="g-info__tittel">${v('tittel')}</span>
        <span class="g-info__tekst">${v('beskrivelse')}</span>
        <span class="g-info__pris">${v('pris')}</span>
      </div>
      <span class="g-info__produkt">${produkt(el.produkt)}</span>
    </div>`,

  oppskrift: (el, v) => `
    ${kamera()}
    <div class="g-stolpe g-stolpe--oppskrift">
      <div class="g-stolpe__topp"><span>GMN-kjøkkenet</span><span class="g-stolpe__under">${v('rett')}</span></div>
      <div class="g-oppskrift__bilde">${scene('mat', hash(el.id))}</div>
      <div class="g-oppskrift__bunn"><span>${v('lenke')}</span>${qrKode(hash(el.id))}</div>
    </div>`,

  sendestolpe: (el, v) => {
    const rader = el.rader.slice(0, 4).map((r, i) => {
      const [tid, ...reprise] = String(r.tid || '').trim().split(/\s+/);
      const right = r.status === 'sendt'
        ? '<span class="g-sending__play"><span>Se på</span><b>TV 2 Play</b></span>'
        : `<span class="g-sending__tid"><b>${esc(tid || '[Tid]')}</b>${reprise.length ? `<span>${esc(reprise.join(' '))}</span>` : ''}</span>`;
      return `
        <li class="g-sending__rad${r.status === 'neste' ? ' is-neste' : ''}">
          <span class="g-sending__venstre">
            <span class="g-sending__bilde">${scene(r.scene, hash(el.id) + i)}</span>
            <span class="g-sending__tittel">${esc(r.tittel || '[Tittel]')}</span>
          </span>
          ${right}
        </li>`;
    }).join('');
    return `
      ${kamera()}
      <div class="g-stolpe g-stolpe--sending">
        <div class="g-stolpe__topp">${v('overskrift')}</div>
        <ol class="g-sending">${rader}</ol>
      </div>`;
  },

  stillbilde: (el, v) => bildeFlate(el.scene, hash(el.id), v('kreditering')),

  bildeserie: (el) => {
    if (!el.bilder.length) return '<div class="g-bg g-bg--varm"></div>';
    const i = serieIndex(el);
    const bilde = el.bilder[i];
    return bildeFlate(bilde.scene, hash(el.id) + i, esc(bilde.kreditering || '[Kreditering]'));
  },

  faksimile: (el, v) => {
    const merke = pick(['#B42B26', '#1F3F75', '#1B1B1B', '#0E6B5C'], hash(el.kilde || ''));
    return `
      <div class="g-bg g-bg--gull"></div>
      <div class="g-faks">
        <div class="g-faks__topp">
          <span class="g-faks__merke" style="background:${merke}">${v('kilde')}</span>
          <span class="g-faks__meny" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
        </div>
        <span class="g-faks__stikk" aria-hidden="true"><i></i><i></i></span>
        <span class="g-faks__tittel">${v('overskrift')}</span>
        ${el.ingress ? `<span class="g-faks__ingress">${v('ingress')}</span>` : ''}
        <span class="g-faks__bilde">${scene(el.scene, hash(el.id))}</span>
        <span class="g-faks__linjer" aria-hidden="true"><i></i><i></i></span>
      </div>
      <div class="g-faks-kilde"><b>Skjermbilde</b><span>${v('kilde')}</span></div>
      ${hjorneLogo('g-hjorne--nv')}
      ${pille('#godmorgennorge', 'g-pille--nh')}
      ${TV2_LOGO}`;
  },

  // Bidraget som vises (blas som en bildeserie). Navnet vises som fotokreditering
  // oppe til venstre, som på stillbilder. Under bildet: bildetittelen (hvis den
  // finnes), så sted og fylke.
  fotokonk: (el, v) => {
    const i = serieIndex(el);
    const b = el.bilder[i];
    const kort = b ? `
      <div class="g-konk">
        <span class="g-konk__bilde">
          ${scene(b.scene, hash(el.id) + i)}
          <span class="g-kreditering">Foto: ${esc(b.navn || '[Navn]')}</span>
        </span>
        <span class="g-konk__info">
          ${b.tittel ? `<b class="g-konk__tittel">${esc(b.tittel)}</b>` : ''}
          <span class="g-konk__sted">${esc(stedTekst(b)) || '[Sted]'}</span>
        </span>
      </div>` : '';
    return `
    <div class="g-bg g-bg--kald"></div>
    ${kort}
    <span class="g-konk__tekst">${v('konk')}</span>
    ${hjorneLogo('g-hjorne--nv')}
    ${pille('#godmorgennorge', 'g-pille--nh')}
    ${TV2_LOGO}`;
  },

  ticker: (el, v) => {
    const insta = el.variant === 'instagram';
    let tekst;
    if (insta) {
      tekst = '<span class="g-ticker__statisk">Følg oss på Instagram!</span>';
    } else {
      const nyheter = lines(el.nyheter);
      const innhold = nyheter.length
        ? nyheter.map(esc).join('<span class="g-ticker__skille" aria-hidden="true"></span>')
        : v('nyheter');
      // Lengre tekst ruller lenger, så farten blir omtrent den samme
      const sekunder = Math.max(10, Math.round(nyheter.join(' ').length * 0.2));
      tekst = `<span class="g-ticker__rull" style="--varighet:${sekunder}s">${innhold}</span>`;
    }
    return `
      ${kamera()}
      ${hjorneLogo('g-hjorne--ov')}
      ${pille('#godmorgennorge', 'g-pille--ticker')}
      <div class="g-ticker">
        <span class="g-ticker__dato">${insta ? '' : v('dato')}</span>
        <span class="g-ticker__klokke">${insta ? `/godmorgennorge<span class="g-ticker__strek"></span>${IG_ICON}` : v('klokke')}</span>
        <span class="g-ticker__tekst">${tekst}</span>
      </div>`;
  },

  hashtag: (el, v) => `
    ${kamera()}
    ${pille(v('tekst'), 'g-pille--stor')}`,

  fotokred: (el, v) => `
    <div class="g-fyll">${scene(el.scene, hash(el.id))}</div>
    <span class="g-fotokred">Foto <b>${v('navn')}</b></span>`,

  straks: (el, v) => `
    ${kamera(false)}
    <div class="g-straks">
      <span class="g-straks__fane">${v('fane')}</span>
      <span class="g-straks__rad">
        <span class="g-straks__logo">${GMN_G}</span>
        <span class="g-straks__tittel">${v('tittel')}</span>
      </span>
      <span class="g-straks__kanaler">${v('kanaler')}</span>
    </div>`,
};


/* ----------------------------------------------------------
   5. Tegning (render)
   ---------------------------------------------------------- */
function render() {
  const focus = rememberFocus();
  renderHeader();
  renderStart();
  renderScript();
  renderList();
  restoreFocus(focus);
}

function renderHeader() {
  setNavActive($('nav-start'), state.screen === 'start');
  setNavActive($('nav-script'), state.screen === 'script');
  setNavActive($('nav-list'), state.screen === 'list');

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
    `${p.tasksDone} av ${TASKS.length} oppgaver ferdig · ${p.lest} av ${p.total} bolker lest i scriptet · ${p.klar} av ${p.total} bolker klare i spillelisten`;
  $('cta-note').textContent = state.fetched
    ? `${p.total} bolker · ${p.klar} klare`
    : 'Kjøreplanen er ikke hentet ennå';

  $('task-list').innerHTML = TASKS.map((task) => taskCard(task, p)).join('');
  $('dagens-info').innerHTML = dagensInfo();
}

// Et oppgavekort. Hele kortet kan klikkes (se bindEvents).
function taskCard(task, p) {
  const klar = task.auto ? p.auto[task.auto] : 0;
  const done = task.auto ? klar === p.total : !!state.doneTasks[task.key];
  // Prøvde brukeren å huke av en oppgave som ikke kan hukes av ennå?
  const blocked = task.auto && !done && state.blockedTask === task.key;

  let status;
  if (task.auto === 'kjoreplan') status = state.fetched ? `${klar} av ${p.total} bolker klare` : 'Kjøreplanen er ikke hentet ennå';
  else if (task.auto === 'script') status = `${klar} av ${p.total} bolker lest`;
  else status = done ? 'Ferdig' : 'Ikke ferdig';

  let check;
  if (task.auto) {
    // Ingen avkrysning, men en sirkel som fylles etter hvert som bolkene hukes av.
    // Ingen bolker klare: ingen sirkel.
    check = klar === 0 ? '' : `
      <span class="task__fill" role="img" aria-label="${klar} av ${p.total} bolker">
        <span class="task__fill-ring" style="--andel:${(klar / p.total) * 100}%">${done ? svgIcon(CHECK_PATH, 16, 3) : ''}</span>
      </span>`;
  } else {
    check = `<button type="button" class="check" data-task="${task.key}" aria-pressed="${done}"
       aria-label="${done ? 'Fjern avkrysning' : 'Marker som ferdig'}: ${esc(task.title)}">
       <span class="check__ring">${done ? svgIcon(CHECK_PATH, 16, 3) : ''}</span></button>`;
  }
  const warn = blocked
    ? `<span class="task__warn" id="task-msg-${task.key}">${svgIcon(WARN_PATH, 14, 2)} Gå gjennom alle bolkene</span>`
    : '';

  // Snarveier fra oppgavekortene
  let shortcut = '';
  if (task.auto === 'kjoreplan') shortcut = '<button type="button" class="btn-outline" data-go="list">Åpne spillelisten</button>';
  if (task.auto === 'script') shortcut = '<button type="button" class="btn-outline" data-go="script">Åpne script</button>';

  return `
    <div class="card task${done ? ' is-done' : ''}${task.auto ? ' task--auto' : ''}" data-task-card="${task.key}">
      <div class="task__text">
        <span class="task__title">${esc(task.title)}</span>
        <span class="muted">${status}</span>
        ${warn}
        ${shortcut}
      </div>
      ${check}
    </div>`;
}

// En bolk i bolkmenyen: knappen som åpner bolken, og en rund sjekkboks til høyre.
// Brukes både i spillelisten og på Script-siden.
function bolkItem(i, { active, klar, openAttr, checkAttr, checkLabel }) {
  return `
    <div class="bolk-item${active ? ' is-active' : ''}${klar ? ' is-klar' : ''}">
      <button type="button" class="bolk-btn" ${openAttr}="${i}"${active ? ' aria-current="true"' : ''}>
        <span class="bolk-btn__text">
          <span class="bolk-btn__label">${bolkNavn(i)}</span>
          <span class="bolk-btn__time">${state.bolker[i].time}</span>
        </span>
      </button>
      <button type="button" class="bolk-check" ${checkAttr}="${i}" aria-pressed="${klar}" aria-label="${checkLabel}">
        <span class="bolk-check__ring">${klar ? svgIcon(CHECK_PATH, 14, 3) : ''}</span>
      </button>
    </div>`;
}

// Generell info for dagen. Skjelett til kjøreplanen er hentet,
// men grafikkavvikleren er den som er pålogget og vises med en gang.
function dagensInfo() {
  const hentet = state.fetched;
  const skjelett = (bredder) => `<span class="sr-only">Ikke hentet</span>${bredder
    .map((b) => `<span class="skjelett" style="width:${b}%" aria-hidden="true"></span>`).join('')}`;
  const rad = (label, innhold) => `<div class="info-row"><dt>${label}</dt><dd>${innhold}</dd></div>`;

  const programledere = PROGRAMLEDERE.map(([navn]) => esc(navn)).join('<br>');
  const beskjeder = `<ul class="info-beskjeder">${DAGENS_INFO.beskjeder.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`;

  return `
    ${hentet ? '' : `<p class="info-card__msg">${svgIcon('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>', 18, 2)} Dagens spilleliste må hentes før info vises.</p>`}
    <dl class="info-list${hentet ? '' : ' is-skjelett'}">
      ${rad('Produsent', hentet ? esc(DAGENS_INFO.produsent) : skjelett([55]))}
      ${rad('Vaktsjef', hentet ? esc(DAGENS_INFO.vaktsjef) : skjelett([45]))}
      ${rad('Grafikkavvikler', `${esc(BRUKER)} <span class="info-deg">Deg</span>`)}
      ${rad('Programledere', hentet ? programledere : skjelett([60, 50]))}
      ${rad('Hendelser og beskjeder', hentet ? beskjeder : skjelett([95, 80, 88]))}
    </dl>`;
}

/* ---- Script ---- */
function renderScript() {
  $('screen-script').hidden = state.screen !== 'script';
  if (state.screen !== 'script') return;

  const i = state.scriptBolk;
  const bolk = state.bolker[i];
  const script = SCRIPT[i];
  const slutt = bolkSlutt(i);
  const last = state.bolker.length - 1;

  $('script-title').textContent = bolkNavn(i);
  $('script-sub').textContent = `${bolk.time}–${slutt} · ${bolk.title}`;
  $('script-info').textContent = `${state.bolker.length} bolker · ${state.bolker[0].time}–${bolkSlutt(last)}`;

  // Sjekkboksene her styrer «Lese script» på startsiden
  $('script-menu').innerHTML = state.bolker.map((b, j) => bolkItem(j, {
    active: j === i,
    klar: state.scriptKlar[j],
    openAttr: 'data-script-bolk',
    checkAttr: 'data-script-klar',
    checkLabel: `${bolkNavn(j)} er lest`,
  })).join('');

  $('script-content').innerHTML = `
    ${scriptMed(bolk, slutt, script)}
    <div class="script-cols">
      <div class="script-col">
        ${scriptManus(script)}
        ${scriptGuide(script)}
      </div>
      ${scriptTidslinje(i, script)}
    </div>`;
}

// Klokkeslett og hvem som er med
function scriptMed(bolk, slutt, script) {
  const person = ([navn, rolle], pl) => `
    <li class="person${pl ? ' person--pl' : ''}">
      <span class="person__ini" aria-hidden="true">${esc(initialer(navn))}</span>
      <span class="person__text"><b>${esc(navn)}</b><span>${esc(rolle)}</span></span>
    </li>`;
  const gjester = script.gjester.length
    ? script.gjester.map((g) => person(g, false)).join('')
    : '<li class="muted">Ingen gjester i denne bolken</li>';

  return `
    <section class="panel script-med" aria-label="Tid og medvirkende">
      <dl class="script-tid">
        <div><dt>Start</dt><dd>${bolk.time}</dd></div>
        <div><dt>Slutt</dt><dd>${slutt}</dd></div>
        <div><dt>Varighet</dt><dd>${minutter(bolk.time, slutt)} min</dd></div>
      </dl>
      <div class="script-folk">
        <h2 class="script-label">Programledere</h2>
        <ul class="person-liste">${PROGRAMLEDERE.map((p) => person(p, true)).join('')}</ul>
      </div>
      <div class="script-folk">
        <h2 class="script-label">Gjester</h2>
        <ul class="person-liste">${gjester}</ul>
      </div>
    </section>`;
}

// Replikkene med navnet på den som snakker. Regibeskjeder vises for seg.
function scriptManus(script) {
  const linjer = script.manus.map(([hvem, tekst]) => (hvem
    ? `<div class="replikk"><span class="replikk__hvem">${esc(hvem)}</span><p class="replikk__tekst">${esc(tekst)}</p></div>`
    : `<p class="regi"><span class="regi__label">Regi</span>${esc(tekst)}</p>`)).join('');
  return `
    <section class="panel" aria-labelledby="manus-title">
      <h2 class="panel__title" id="manus-title">Manus</h2>
      <div class="manus">${linjer}</div>
    </section>`;
}

function scriptGuide(script) {
  const roller = Object.fromEntries(script.gjester);
  const innhold = script.guide.length
    ? script.guide.map(([gjest, sporsmal]) => `
        <div class="guide">
          <h3 class="guide__gjest">${esc(gjest)}${roller[gjest] ? ` <span>${esc(roller[gjest])}</span>` : ''}</h3>
          <ol class="guide__liste">${sporsmal.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
        </div>`).join('')
    : '<p class="muted">Ingen intervjuer i denne bolken.</p>';
  return `
    <section class="panel" aria-labelledby="guide-title">
      <h2 class="panel__title" id="guide-title">Intervjuguide</h2>
      ${innhold}
    </section>`;
}

// Når ting skjer i bolken. Grafikkpunktene lenker til elementet i spillelisten.
function scriptTidslinje(i, script) {
  const punkter = script.tidslinje.map(([tid, type, tekst, elId]) => {
    let link = '';
    const found = elId ? findElement(elId) : null;
    if (found) {
      const viz = vizFor(elId);
      link = `
        <button type="button" class="tl__link" data-goto="${elId}">
          <span class="type-icon">${svgIcon(ICON_PATHS[found.el.type], 18)}</span>
          <span class="tl__link-text">
            <b>${esc(elLabel(found.el))}</b>
            <span>Åpne i spillelisten</span>
          </span>
          ${viz ? `<span class="viz-badge"><span class="sr-only">Klar på </span>VIZ${viz}</span>` : ''}
          ${svgIcon('<path d="M5 12h14M13 6l6 6-6 6"/>', 18, 2)}
        </button>`;
    }
    return `
      <li class="tl tl--${type}">
        <span class="tl__tid">${tid}</span>
        <span class="tl__dot" aria-hidden="true"></span>
        <div class="tl__body">
          <span class="tl__type">${TL_TYPER[type]}</span>
          <span class="tl__tekst">${esc(tekst)}</span>
          ${link}
        </div>
      </li>`;
  }).join('');
  const antall = script.tidslinje.filter((p) => p[1] === 'grafikk').length;
  return `
    <section class="panel script-tidslinje" aria-labelledby="tl-title">
      <div class="panel__head">
        <h2 class="panel__title" id="tl-title">Tidslinje</h2>
        <span class="hint">${antall} grafikkpunkter · ${bolkNavn(i)}</span>
      </div>
      <ol class="tidslinje">${punkter}</ol>
    </section>`;
}

/* ---- Skjerm 2 og 3 ---- */
function renderList() {
  $('screen-list').hidden = state.screen !== 'list';
  if (state.screen !== 'list') return;

  const p = progress();
  const bolk = activeBolk();

  // Overskrift
  $('list-title').textContent = state.fetched ? bolkNavn(state.activeBolk) : 'Spilleliste';
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
}

// Sjekkboksene her styrer «Gå gjennom kjøreplan» på startsiden
function renderBolkMenu() {
  $('bolk-menu').innerHTML = state.bolker.map((bolk, i) => bolkItem(i, {
    active: i === state.activeBolk,
    klar: bolk.klar,
    openAttr: 'data-bolk',
    checkAttr: 'data-klar',
    checkLabel: `${bolkNavn(i)} er klar`,
  })).join('');
}

function renderElementList() {
  const els = activeBolk().els;
  $('el-count').textContent = `${els.length} ${els.length === 1 ? 'element' : 'elementer'}`;

  if (!els.length) {
    $('element-list').innerHTML = '<p class="el-empty">Ingen elementer i bolken. Velg en type under Elementer for å lage et nytt.</p>';
    renderViz();
    return;
  }

  $('element-list').innerHTML = els.map((el) => {

    // Raden er en beholder med separate knapper: én som åpner elementet,
    // VIZ-merket (fjerner PUSH), PUSH og fjern (en knapp kan ikke ligge i en annen knapp)
    const isSelected = !state.draft && el.id === state.selectedId;
    const viz = vizFor(el.id);
    const menuOpen = state.pushMenu === el.id;
    const label = esc(elLabel(el));
    return `
      <div class="el${isSelected ? ' is-selected' : ''}">
        <button type="button" class="el__open" data-id="${el.id}"${isSelected ? ' aria-current="true"' : ''}>
          <span class="type-icon">${svgIcon(ICON_PATHS[el.type])}</span>
          <span class="el__text">
            <span class="el__title">${esc(elTitle(el) || 'Uten tittel')}</span>
            <span class="el__meta">${esc(metaText(el))}</span>
          </span>
          ${el.isNew ? '<span class="badge">NY</span>' : ''}
        </button>
        ${viz ? `
        <button type="button" class="viz-off" data-unviz="${el.id}" title="Fjern fra VIZ${viz}"
          aria-label="Klar på VIZ${viz}. Fjern ${label} fra VIZ${viz}">
          <span class="viz-badge">VIZ${viz}${svgIcon(CROSS_PATH, 12, 3)}</span>
        </button>` : ''}
        <div class="push">
          <button type="button" class="push__btn" data-push="${el.id}" aria-haspopup="menu" aria-expanded="${menuOpen}"${menuOpen ? ` aria-controls="push-meny-${el.id}"` : ''}
            aria-label="PUSH til VIZ: ${esc(elLabel(el))}">
            PUSH${svgIcon('<path d="M6 9l6 6 6-6"/>', 16, 2.2)}
          </button>
          ${menuOpen ? pushMenu(el, viz) : ''}
        </div>
        ${el.isNew ? `
        <button type="button" class="el__remove" data-remove="${el.id}" title="Fjern fra spillelisten"
          aria-label="Fjern ${label} fra spillelisten">${svgIcon(CROSS_PATH, 18, 2)}</button>` : ''}
      </div>`;
  }).join('');

  renderViz();
}

// Rullegardinmenyen bak PUSH: VIZ1–3, og «Fjern» hvis elementet ligger på en kanal
function pushMenu(el, current) {
  const items = VIZ_KANALER.map((k) => {
    const holderId = state.viz[k];
    let info = 'Ledig';
    if (holderId === el.id) info = 'Dette elementet';
    else if (holderId) {
      const holder = findElement(holderId);
      info = `Erstatter ${elLabel(holder.el)}`;
    }
    return `
      <button type="button" class="push__item" role="menuitemradio" aria-checked="${current === k}" data-viz="${k}" tabindex="-1">
        <span class="push__check">${current === k ? svgIcon(CHECK_PATH, 16, 2.5) : ''}</span>
        <span class="push__text">
          <span class="push__name">VIZ${k}</span>
          <span class="push__info">${esc(info)}</span>
        </span>
      </button>`;
  }).join('');

  const remove = current ? `
    <div class="push__sep" role="separator"></div>
    <button type="button" class="push__item" role="menuitem" data-viz="0" tabindex="-1">
      <span class="push__check">${svgIcon(CROSS_PATH, 16, 2)}</span>
      <span class="push__text"><span class="push__name">Fjern fra VIZ${current}</span></span>
    </button>` : '';

  return `<div class="push__menu" id="push-meny-${el.id}" role="menu" aria-label="Velg VIZ for ${esc(elLabel(el))}">${items}${remove}</div>`;
}

// Oversikt over hva som ligger klart på hver VIZ-kanal
function renderViz() {
  $('viz-strip').innerHTML = VIZ_KANALER.map((k) => {
    const found = state.viz[k] ? findElement(state.viz[k]) : null;
    const where = found && found.bolk !== state.activeBolk ? ` (${bolkNavn(found.bolk)})` : '';
    return `
      <li class="viz-cell${found ? ' is-on' : ''}">
        <span class="viz-cell__name">VIZ${k}</span>
        <span class="viz-cell__el">${found ? esc(elLabel(found.el)) + where : 'Ledig'}</span>
      </li>`;
  }).join('');
  $('list-msg').textContent = state.msg;
  $('undo-btn').hidden = !state.undo;
}

function renderPalette() {
  const sel = selected();
  const iPaletten = !!sel && GROUPS.some((g) => g.typer.includes(sel.el.type));

  $('palette-panel').classList.toggle('is-disabled', !state.fetched);
  $('palette-hint').textContent = !state.fetched
    ? 'Tilgjengelig når kjøreplanen er hentet'
    : iPaletten
      ? `Gjenkjent type: ${TYPES[sel.el.type].label} · klikk en type for å lage et nytt element`
      : 'Klikk en type for å lage et nytt element';

  const button = (type) => {
    // Typen til det valgte elementet utheves («gjenkjennes»)
    const recognized = !!sel && sel.el.type === type;
    const label = TYPES[type].label;
    return `
      <button type="button" class="palette__btn${recognized ? ' is-recognized' : ''}" data-add="${type}"
        aria-label="Nytt element: ${label}${recognized ? ' (type for valgt element)' : ''}"${state.fetched ? '' : ' disabled'}>
        <span class="type-icon">${svgIcon(ICON_PATHS[type], 18)}</span>
        <span class="palette__label">${label}</span>
      </button>`;
  };

  $('palette').innerHTML = GROUPS.map((group) => `
    <div class="palette__group" role="group" aria-labelledby="palett-${group.key}">
      <span class="palette__group-label" id="palett-${group.key}">${group.navn}</span>
      <div class="palette__items">${group.typer.map(button).join('')}</div>
    </div>`).join('');
}

function renderPreview() {
  const sel = selected();
  // Fotokonkurransen kan bare leses, så den har ingen Rediger-modus
  const lesbar = !!sel && !!TYPES[sel.el.type].lesbar;
  const editing = state.mode === 'edit' && !!sel && !lesbar;

  $('preview-title').textContent = previewTitle(sel);
  $('mode-edit').disabled = !sel || lesbar;
  $('mode-edit').title = lesbar ? 'Fotokonkurransen kan ikke redigeres' : '';
  $('mode-preview').disabled = !sel;
  $('mode-edit').setAttribute('aria-pressed', editing);
  $('mode-preview').setAttribute('aria-pressed', !editing);

  $('preview-empty').hidden = !!sel;
  $('preview-empty').textContent = state.fetched
    ? 'Klikk på et element i bolken for å se det her.'
    : 'Hent kjøreplanen for å se elementene her.';
  $('preview').hidden = !sel;
  if (!sel) return;

  // Redigeringsfelt (bare i Rediger-modus)
  $('edit-fields').hidden = !editing;
  $('edit-fields').innerHTML = editing ? editorHtml(sel.el) : '';

  renderStage();
  renderSerieNav();

  // Et nytt element har ingen plass i bolken ennå. Da vises
  // «Legg element til spilleliste» i stedet for pilene.
  $('stepper').hidden = !!sel.draft;
  $('draft-bar').hidden = !sel.draft;
  if (sel.draft) {
    const etter = state.selectedId ? activeBolk().els.find((e) => e.id === state.selectedId) : null;
    $('draft-note').textContent = etter
      ? `Ikke lagt til ennå. Legges inn under ${elLabel(etter)} i ${bolkNavn(state.activeBolk)}.`
      : `Ikke lagt til ennå. Legges inn nederst i ${bolkNavn(state.activeBolk)}.`;
    return;
  }

  // Bla mellom elementene i bolken
  $('prev-btn').disabled = sel.index === 0;
  $('next-btn').disabled = sel.index === sel.total - 1;
  $('position').textContent = `Element ${sel.index + 1} av ${sel.total} i bolken`;
}

/* ---- Redigeringsfelt ---- */
function editorHtml(el) {
  return TYPES[el.type].fields.map((f) => {
    if (f.kind === 'bilder') return bilderEditor(el);
    if (f.kind === 'rader') return raderEditor(el);
    return fieldHtml(f, f.key, el[f.key]);
  }).join('');
}

function fieldHtml(f, path, value) {
  const id = 'felt-' + path.replace(/\./g, '-');
  const val = value == null ? '' : String(value);
  const hint = fieldHint(f, val);
  const describedBy = hint ? ` aria-describedby="${id}-hint"` : '';

  let input;
  if (f.valg) {
    const options = f.valg.map(([key, text]) =>
      `<option value="${key}"${key === val ? ' selected' : ''}>${esc(text)}</option>`).join('');
    input = `<select id="${id}" data-field="${path}"${describedBy}>${options}</select>`;
  } else if (f.flere) {
    input = `<textarea id="${id}" data-field="${path}" rows="${f.rader || 4}"${describedBy}>${esc(val)}</textarea>`;
  } else {
    input = `<input id="${id}" type="text" data-field="${path}" value="${esc(val)}" autocomplete="off"${describedBy}>`;
  }
  return `
    <div class="field">
      <label for="${id}">${esc(f.label)}</label>
      ${input}
      ${hint ? `<p class="field__hint${hint.warn ? ' is-warn' : ''}" id="${id}-hint">${hint.html}</p>` : ''}
    </div>`;
}

// Hjelpeteksten under et felt. Infosuperen teller setninger.
function fieldHint(f, value) {
  if (f.maksSetninger) {
    const n = antallSetninger(value);
    if (n > f.maksSetninger) {
      return { warn: true, html: `${svgIcon(WARN_PATH, 14, 2)} ${n} setninger. Maks ${f.maksSetninger} får plass i superen.` };
    }
    return { warn: false, html: `${n} av maks ${f.maksSetninger} setninger.` };
  }
  return f.hint ? { warn: false, html: esc(f.hint) } : null;
}

function bilderEditor(el) {
  const current = serieIndex(el);
  const items = el.bilder.map((b, i) => `
    <li class="bilde-rad${i === current ? ' is-current' : ''}" data-bilde="${i}">
      <span class="bilde-rad__thumb">${scene(b.scene, hash(el.id) + i)}</span>
      <span class="bilde-rad__nr">Bilde ${i + 1}</span>
      <button type="button" class="icon-btn" data-action="fjern-bilde" data-index="${i}"
        aria-label="Fjern bilde ${i + 1}"${el.bilder.length < 2 ? ' disabled' : ''}>${svgIcon(CROSS_PATH, 18, 2)}</button>
      <div class="bilde-rad__felt">
        ${fieldHtml(F('motiv', 'Motiv'), `bilder.${i}.motiv`, b.motiv)}
        ${fieldHtml(F('kreditering', 'Kreditering'), `bilder.${i}.kreditering`, b.kreditering)}
      </div>
    </li>`).join('');
  return `
    <fieldset class="field-group">
      <legend>Bilder i serien (${el.bilder.length})</legend>
      <ol class="bilde-liste">${items}</ol>
      <button type="button" class="btn-add" data-action="legg-til-bilde">${svgIcon(PLUS_PATH, 18, 2)} Legg til bilde</button>
    </fieldset>`;
}

function raderEditor(el) {
  return el.rader.map((r, i) => `
    <fieldset class="field-group">
      <legend>Innslag ${i + 1}</legend>
      ${fieldHtml(F('tittel', 'Tittel'), `rader.${i}.tittel`, r.tittel)}
      ${fieldHtml(F('tid', 'Tid (reprise i parentes)'), `rader.${i}.tid`, r.tid)}
      ${fieldHtml(F('status', 'Status', { valg: STATUS_VALG }), `rader.${i}.status`, r.status)}
    </fieldset>`).join('');
}

/* ---- Grafikken ---- */
function renderStage() {
  const sel = selected();
  if (!sel) return;

  const el = sel.el;
  const def = TYPES[el.type];

  // Feltverdien klar for innerHTML. Tomme felt vises som [Feltnavn].
  const v = (key) => {
    const value = el[key];
    if (typeof value === 'string' && value.trim()) return esc(value);
    const field = def.fields.find((f) => f.key === key);
    return field && !field.valgfri ? `[${esc(field.label)}]` : '';
  };

  $('stage').innerHTML = STAGE[el.type](el, v);
  $('stage-note').textContent = `Forhåndsvisning: ${def.stage}. Bilder og logoer er plassholdere.`
    + (def.lesbar ? ' Fotokonkurransen kan bare leses.' : '');
}

// Elementer som blas i som en serie: bildeserie og fotokonkurranse
function erSerie(el) {
  return Array.isArray(el.bilder);
}

// Egen navigasjon for bildene i en serie (ikke det samme som å bla mellom elementer)
function renderSerieNav() {
  const sel = selected();
  const show = !!sel && erSerie(sel.el) && sel.el.bilder.length > 0;
  $('serie-nav').hidden = !show;
  if (!show) return;

  const el = sel.el;
  const i = serieIndex(el);
  const n = el.bilder.length;
  const ord = el.type === 'fotokonk' ? 'Bidrag' : 'Bilde';
  $('serie-title').textContent = el.type === 'fotokonk' ? 'Bidragene i fotokonkurransen' : 'Bildene i serien';
  $('serie-prev').setAttribute('aria-label', `Forrige ${ord.toLowerCase()}`);
  $('serie-next').setAttribute('aria-label', `Neste ${ord.toLowerCase()}`);
  $('serie-count').textContent = `${ord} ${i + 1} av ${n}`;
  $('serie-prev').disabled = i === 0;
  $('serie-next').disabled = i === n - 1;
  $('serie-thumbs').innerHTML = el.bilder.map((b, j) => `
    <button type="button" class="serie-thumb${j === i ? ' is-current' : ''}" data-serie="${j}"
      aria-label="Vis ${ord.toLowerCase()} ${j + 1}${b.motiv || b.navn ? ': ' + esc(b.motiv || b.navn) : ''}"${j === i ? ' aria-current="true"' : ''}>${scene(b.scene, hash(el.id) + j)}</button>`).join('');
}


/* ----------------------------------------------------------
   6. Handlinger – endrer state og tegner på nytt
   ---------------------------------------------------------- */
function goTo(screen) {
  state.screen = screen;
  state.blockedTask = null;
  render();
  window.scrollTo(0, 0);
}

function toggleTask(key) {
  const task = TASKS.find((t) => t.key === key);
  if (task.auto) {
    // Blir ferdig av seg selv når alle bolkene er huket av. Før det rister
    // sirkelen (eller meldingen, hvis ingen bolker er klare) og brukeren
    // får beskjed om hva som mangler.
    const p = progress();
    if (p.auto[task.auto] === p.total) return;
    state.blockedTask = key;
    render();
    const card = document.querySelector(`[data-task-card="${key}"]`);
    const ring = card && (card.querySelector('.task__fill-ring') || card.querySelector('.task__warn'));
    if (ring) {
      ring.classList.remove('is-shake');
      void ring.offsetWidth;  // starter animasjonen på nytt ved gjentatte klikk
      ring.classList.add('is-shake');
      ring.addEventListener('animationend', () => ring.classList.remove('is-shake'), { once: true });
    }
    // Tøm først, så skjermleseren leser meldingen også neste gang
    $('start-status').textContent = '';
    setTimeout(() => { $('start-status').textContent = 'Gå gjennom alle bolkene'; }, 50);
    return;
  }
  state.doneTasks[key] = !state.doneTasks[key];
  render();
}

// Melding i elementlisten. `undo` gir en «Angre»-knapp.
function setMsg(text, undo = null) {
  state.msg = text;
  state.undo = undo;
}

function fetchPlan() {
  if (state.loading) return;
  state.loading = true;
  render();

  // Later som om vi henter kjøreplanen fra en server
  setTimeout(() => {
    // Kom brukeren fra et grafikkpunkt i scriptet, åpnes det elementet.
    // Ellers åpnes første element i Bolk 0.
    const target = state.pendingOpen ? findElement(state.pendingOpen) : null;
    state.loading = false;
    state.fetched = true;
    state.fetchedAt = new Date();
    state.activeBolk = target ? target.bolk : 0;
    state.selectedId = target ? target.el.id : state.bolker[0].els[0].id;
    state.pendingOpen = null;
    state.mode = 'preview';
    state.serieIndex = 0;
    render();
    if (target) focusElementRow(target.el.id);
  }, 900);
}

function pickScriptBolk(index) {
  state.scriptBolk = index;
  render();
}

// Et grafikkpunkt i scriptet åpner elementet i spillelisten.
// Er kjøreplanen ikke hentet ennå, hentes den først.
function openFromScript(id) {
  const found = findElement(id);
  if (!found) return;
  state.pushMenu = null;
  state.draft = null;
  setMsg('');

  if (!state.fetched) {
    state.pendingOpen = id;
    goTo('list');
    fetchPlan();
    return;
  }
  state.activeBolk = found.bolk;
  state.selectedId = id;
  state.mode = 'preview';
  state.serieIndex = 0;
  goTo('list');
  focusElementRow(id);
}

function focusElementRow(id) {
  const row = document.querySelector(`[data-id="${id}"]`);
  if (row) row.focus();
}

function pickBolk(index) {
  state.activeBolk = index;
  state.selectedId = null;
  state.mode = 'preview';
  state.serieIndex = 0;
  state.pushMenu = null;
  state.draft = null;
  setMsg('');
  render();
}

// Ett klikk åpner elementet i preview
function openElement(id) {
  if (state.selectedId !== id || state.draft) state.serieIndex = 0;
  state.selectedId = id;
  state.draft = null;
  state.mode = 'preview';
  render();
}

function step(direction) {
  const sel = selected();
  if (!sel || sel.draft) return;
  const next = activeBolk().els[sel.index + direction];
  if (next) {
    state.selectedId = next.id;
    state.serieIndex = 0;
    render();
  }
}

// Klikk i paletten lager et nytt element og åpner det i Rediger-modus.
// Det legges ikke i spillelisten før brukeren trykker «Legg element til spilleliste».
function newDraft(type) {
  const id = `ny-${state.nextId++}`;
  const ctx = { id, time: activeBolk().time, index: state.activeBolk, bolker: state.bolker };
  state.draft = { id, type, ...TYPES[type].ny(ctx), isNew: true };
  state.mode = 'edit';
  state.serieIndex = 0;
  state.pushMenu = null;
  render();

  // Fokus til første felt. Er det fylt ut fra før (f.eks. «#godmorgennorge»),
  // merkes teksten, så den erstattes når man begynner å skrive.
  const firstField = document.querySelector('#edit-fields [data-field]');
  if (firstField) {
    firstField.focus();
    if (firstField.select && firstField.value) firstField.select();
  }
}

// Legger det nye elementet rett under det valgte (ellers nederst i bolken)
function addDraft() {
  const el = state.draft;
  if (!el) return;
  const els = activeBolk().els;
  const after = els.findIndex((e) => e.id === state.selectedId);
  els.splice(after === -1 ? els.length : after + 1, 0, el);

  state.draft = null;
  state.selectedId = el.id;
  state.mode = 'preview';
  setMsg(`${elLabel(el)} er lagt til i ${bolkNavn(state.activeBolk)}.`);
  render();
  focusElementRow(el.id);
}

// Forkaster det nye elementet. Det som var åpent før, vises igjen.
function cancelDraft() {
  if (!state.draft) return;
  state.draft = null;
  state.mode = 'preview';
  state.serieIndex = 0;
  render();
  if (state.selectedId) focusElementRow(state.selectedId);
}

// Fjerner et element fra bolken. Ligger det på en VIZ-kanal, tas det av.
function removeElement(id) {
  const els = activeBolk().els;
  const index = els.findIndex((e) => e.id === id);
  if (index === -1) return;
  const [el] = els.splice(index, 1);

  const kanal = vizFor(id);
  if (kanal) state.viz[kanal] = null;
  if (state.pushMenu === id) state.pushMenu = null;
  if (state.selectedId === id) {
    state.selectedId = null;
    state.mode = 'preview';
    state.serieIndex = 0;
  }
  setMsg(`${elLabel(el)} er fjernet fra ${bolkNavn(state.activeBolk)}.`
    + (kanal ? ` Det ble også tatt av VIZ${kanal}.` : ''), { el, bolk: state.activeBolk, index });
  render();

  // Fokus til fjern-knappen på raden som nå står på samme plass, eller «Angre»
  const next = els[index] || els[index - 1];
  const target = next ? document.querySelector(`[data-remove="${next.id}"]`) : null;
  (target || $('undo-btn')).focus();
}

// Legger det sist fjernede elementet tilbake på samme plass
function undoRemove() {
  const u = state.undo;
  if (!u) return;
  state.bolker[u.bolk].els.splice(u.index, 0, u.el);
  setMsg(`${elLabel(u.el)} er lagt tilbake.`);
  render();
  focusElementRow(u.el.id);
}

function updateField(path, value) {
  const sel = selected();
  if (!sel) return;
  setPath(sel.el, path, value);

  // Tegn bare det som påvirkes, så tekstfeltet beholder fokus
  renderElementList();
  renderStage();
  renderSerieNav();
  $('preview-title').textContent = previewTitle(sel);

  // Oppdater setningstelleren under feltet
  const field = TYPES[sel.el.type].fields.find((f) => f.key === path);
  const hintEl = $(`felt-${path}-hint`);
  if (field && field.maksSetninger && hintEl) {
    const hint = fieldHint(field, value);
    hintEl.innerHTML = hint.html;
    hintEl.classList.toggle('is-warn', hint.warn);
  }
}

function setMode(mode) {
  state.mode = mode;
  render();
}

// Sjekkboksen på en bolk i spillelisten. Styrer «Gå gjennom kjøreplan».
function toggleKlar(index) {
  const bolk = state.bolker[index];
  bolk.klar = !bolk.klar;
  render();
}

// Sjekkboksen på en bolk på Script-siden. Styrer «Lese script».
function toggleScriptKlar(index) {
  state.scriptKlar[index] = !state.scriptKlar[index];
  render();
}

/* ---- PUSH til VIZ ---- */
function menuItems() {
  return [...document.querySelectorAll('.push__menu [role^="menuitem"]')];
}

// Fokus til det valgte menypunktet (eller det første), eller det siste
function focusMenu(where) {
  const items = menuItems();
  if (!items.length) return;
  const checked = items.find((item) => item.getAttribute('aria-checked') === 'true');
  (where === 'last' ? items[items.length - 1] : checked || items[0]).focus();
}

function openPushMenu(id, where) {
  state.pushMenu = id;
  render();
  focusMenu(where);
}

function closePushMenu(returnFocus) {
  const id = state.pushMenu;
  if (!id) return;
  state.pushMenu = null;
  render();
  if (returnFocus) document.querySelector(`[data-push="${id}"]`).focus();
}

// kanal 1–3 gjør elementet klart på den VIZ-en, 0 fjerner det.
// Hver kanal har ett element om gangen, så et element som ligger der fra før, tas av.
function pushTo(id, kanal) {
  const { el } = findElement(id);
  const forrige = vizFor(id);

  if (kanal === 0) {
    state.viz[forrige] = null;
    setMsg(`${elLabel(el)} er fjernet fra VIZ${forrige}.`);
  } else if (kanal === forrige) {
    setMsg(`${elLabel(el)} ligger allerede klart på VIZ${kanal}.`);
  } else {
    const fortrengt = state.viz[kanal] ? findElement(state.viz[kanal]) : null;
    if (forrige) state.viz[forrige] = null;
    state.viz[kanal] = id;
    setMsg(`${elLabel(el)} er klart på VIZ${kanal}.`
      + (fortrengt ? ` ${elLabel(fortrengt.el)} ble tatt av.` : ''));
  }

  closePushMenu(true);
}

// Klikk på det lilla VIZ-merket på raden fjerner PUSH-en
function unpush(id) {
  const kanal = vizFor(id);
  if (!kanal) return;
  const { el } = findElement(id);
  state.viz[kanal] = null;
  state.pushMenu = null;
  setMsg(`${elLabel(el)} er fjernet fra VIZ${kanal}.`);
  render();
  // Merket forsvinner, så fokus går til PUSH-knappen på samme rad
  const push = document.querySelector(`[data-push="${id}"]`);
  if (push) push.focus();
}

/* ---- Bildeserie ---- */
function setSerie(index) {
  const sel = selected();
  if (!sel || !erSerie(sel.el)) return;
  state.serieIndex = clamp(index, 0, sel.el.bilder.length - 1);
  render();

  // En pil som blir deaktivert, mister fokus. Flytt fokus til den andre pilen.
  const active = document.activeElement;
  if (active && active.disabled) {
    (active.id === 'serie-prev' ? $('serie-next') : $('serie-prev')).focus();
  }
}

function addBilde() {
  const sel = selected();
  if (!sel) return;
  const bilder = sel.el.bilder;
  const forrige = bilder[bilder.length - 1];
  bilder.push({
    motiv: '',
    kreditering: forrige ? forrige.kreditering : 'Foto: ',
    scene: LANDSKAP[(bilder.length + hash(sel.el.id)) % LANDSKAP.length],
  });
  state.serieIndex = bilder.length - 1;
  render();
  $(`felt-bilder-${bilder.length - 1}-motiv`).focus();
}

function removeBilde(index) {
  const sel = selected();
  if (!sel || sel.el.bilder.length < 2) return;
  sel.el.bilder.splice(index, 1);
  state.serieIndex = clamp(state.serieIndex > index ? state.serieIndex - 1 : state.serieIndex, 0, sel.el.bilder.length - 1);
  render();

  // Fokus til neste fjern-knapp, eller «Legg til bilde» hvis den er borte
  const next = document.querySelector(`[data-action="fjern-bilde"][data-index="${Math.min(index, sel.el.bilder.length - 1)}"]`);
  (next && !next.disabled ? next : document.querySelector('[data-action="legg-til-bilde"]')).focus();
}

// Når et felt for et bilde får fokus, vises det bildet i preview
function focusBilde(index) {
  if (index === state.serieIndex) return;
  state.serieIndex = index;
  renderStage();
  renderSerieNav();
  document.querySelectorAll('#edit-fields [data-bilde]').forEach((row) => {
    row.classList.toggle('is-current', Number(row.dataset.bilde) === index);
  });
}


/* ----------------------------------------------------------
   7. Hendelser
   Lister som tegnes på nytt bruker «event delegation»:
   én lytter på foreldreelementet i stedet for én per knapp.
   ---------------------------------------------------------- */
function bindEvents() {
  $('nav-start').addEventListener('click', () => goTo('start'));
  $('nav-script').addEventListener('click', () => goTo('script'));
  $('nav-list').addEventListener('click', () => goTo('list'));
  $('cta-list').addEventListener('click', () => goTo('list'));

  $('task-list').addEventListener('click', (e) => {
    // Snarveiene går foran. Ellers huker et klikk hvor som helst på kortet av oppgaven.
    const go = e.target.closest('[data-go]');
    if (go) {
      goTo(go.dataset.go);
      return;
    }
    const card = e.target.closest('[data-task-card]');
    if (card) toggleTask(card.dataset.taskCard);
  });

  $('script-menu').addEventListener('click', (e) => {
    const check = e.target.closest('[data-script-klar]');
    if (check) {
      toggleScriptKlar(Number(check.dataset.scriptKlar));
      return;
    }
    const btn = e.target.closest('[data-script-bolk]');
    if (btn) pickScriptBolk(Number(btn.dataset.scriptBolk));
  });
  $('script-content').addEventListener('click', (e) => {
    const link = e.target.closest('[data-goto]');
    if (link) openFromScript(link.dataset.goto);
  });

  $('fetch-btn').addEventListener('click', fetchPlan);

  $('bolk-menu').addEventListener('click', (e) => {
    const check = e.target.closest('[data-klar]');
    if (check) {
      toggleKlar(Number(check.dataset.klar));
      return;
    }
    const btn = e.target.closest('[data-bolk]');
    if (btn) pickBolk(Number(btn.dataset.bolk));
  });

  $('element-list').addEventListener('click', (e) => {
    // PUSH-knappen åpner og lukker menyen, men åpner ikke elementet
    const push = e.target.closest('[data-push]');
    if (push) {
      if (state.pushMenu === push.dataset.push) closePushMenu(true);
      else openPushMenu(push.dataset.push, 'current');
      return;
    }
    const item = e.target.closest('[data-viz]');
    if (item) {
      pushTo(state.pushMenu, Number(item.dataset.viz));
      return;
    }
    const unviz = e.target.closest('[data-unviz]');
    if (unviz) {
      unpush(unviz.dataset.unviz);
      return;
    }
    const remove = e.target.closest('[data-remove]');
    if (remove) {
      removeElement(remove.dataset.remove);
      return;
    }
    // Ett klikk (eller Enter/mellomrom) åpner elementet
    const btn = e.target.closest('[data-id]');
    if (btn) openElement(btn.dataset.id);
  });
  $('undo-btn').addEventListener('click', undoRemove);

  // Tastatur i PUSH-menyen: piltaster, Home/End og Tab
  $('element-list').addEventListener('keydown', (e) => {
    const push = e.target.closest('[data-push]');
    if (push && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      openPushMenu(push.dataset.push, e.key === 'ArrowUp' ? 'last' : 'current');
      return;
    }
    const item = e.target.closest('[role^="menuitem"]');
    if (!item) return;
    const items = menuItems();
    const i = items.indexOf(item);
    const go = (n) => { e.preventDefault(); items[(n + items.length) % items.length].focus(); };
    if (e.key === 'ArrowDown') go(i + 1);
    else if (e.key === 'ArrowUp') go(i - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(items.length - 1);
    else if (e.key === 'Tab') closePushMenu(true);  // Tab går videre fra PUSH-knappen
  });

  // Esc eller klikk utenfor lukker PUSH-menyen
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.pushMenu) {
      e.preventDefault();
      closePushMenu(true);
    }
  });
  document.addEventListener('click', (e) => {
    if (state.pushMenu && !e.target.closest('.push')) closePushMenu(false);
  });

  $('palette').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-add]');
    if (btn && !btn.disabled) newDraft(btn.dataset.add);
  });
  $('draft-add').addEventListener('click', addDraft);
  $('draft-cancel').addEventListener('click', cancelDraft);

  $('mode-edit').addEventListener('click', () => setMode('edit'));
  $('mode-preview').addEventListener('click', () => setMode('preview'));

  // Forhåndsvisningen oppdateres mens man skriver
  $('edit-fields').addEventListener('input', (e) => {
    const field = e.target.closest('[data-field]');
    if (field) updateField(field.dataset.field, field.value);
  });
  $('edit-fields').addEventListener('submit', (e) => e.preventDefault());
  $('edit-fields').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'legg-til-bilde') addBilde();
    if (btn.dataset.action === 'fjern-bilde') removeBilde(Number(btn.dataset.index));
  });
  $('edit-fields').addEventListener('focusin', (e) => {
    const row = e.target.closest('[data-bilde]');
    if (row) focusBilde(Number(row.dataset.bilde));
  });

  // Bla i bildeserien
  $('serie-prev').addEventListener('click', () => setSerie(state.serieIndex - 1));
  $('serie-next').addEventListener('click', () => setSerie(state.serieIndex + 1));
  $('serie-thumbs').addEventListener('click', (e) => {
    const thumb = e.target.closest('[data-serie]');
    if (thumb) setSerie(Number(thumb.dataset.serie));
  });

  $('prev-btn').addEventListener('click', () => step(-1));
  $('next-btn').addEventListener('click', () => step(1));

  // Opplæringen: lukkes med krysset, «Kom i gang» eller Esc
  $('intro-close').addEventListener('click', () => $('intro').close());
  $('intro-ok').addEventListener('click', () => $('intro').close());
  $('intro').addEventListener('close', () => {
    try { localStorage.setItem(INTRO_KEY, '1'); } catch (err) { /* lagring kan være blokkert */ }
  });
}

// Opplæringen vises bare første gang (til den er lukket)
function showIntro() {
  let sett = false;
  try { sett = localStorage.getItem(INTRO_KEY) === '1'; } catch (err) { /* lagring kan være blokkert */ }
  if (!sett && $('intro').showModal) $('intro').showModal();
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
  showIntro();
}

init();

# Converge

Klikkbar prototype av et grafikkavviklingsverktøy for TV 2 God morgen Norge.
Gruppeprosjekt i MIX203 ved UiB. Målet er at grafikkavvikleren og produsenten skal
bruke mindre tid på et tungt teknisk verktøy og mer tid på det redaksjonelle.

## Kjøre prosjektet

Ingen byggesteg og ingen avhengigheter. Åpne `index.html` i nettleseren, eller bruk
Live Server i VS Code.

## Filer

- `index.html`: fast struktur (topplinje, skjermene og panelene)
- `styles.css`: alle stiler. Farger og fonter ligger som variabler i `:root`.
- `script.js`: all logikk, i nummererte seksjoner
- `fonts/`: TV 2 Display og TV 2 Text (woff2). Bare vektene som brukes, ligger her.

## Arkitektur

Ren JavaScript uten rammeverk. Hold det slik.

- All tilstand ligger i objektet `state` i `script.js`.
- Handlinger endrer `state` og kaller `render()`, som tegner grensesnittet på nytt.
- Lister (oppgaver, bolker, elementer, palett, script) tegnes med `innerHTML`, og klikk
  fanges med event delegation via `data-`-attributter: `data-id` (åpne element),
  `data-push` og `data-viz` (PUSH-menyen), `data-push-view` (bytter til og fra «Push ett
  bilde»), `data-bilde-viz` og `data-bilde-grip` (ett bilde i «Push ett bilde»),
  `data-unviz` (VIZ-merket med kanalnummer, fjerner PUSH),
  `data-grip` (håndtak for å flytte), `data-bolk`, `data-klar` (sjekkboksen på en bolk),
  `data-script-bolk`, `data-script-klar` (sjekkboksen på en bolk i scriptet),
  `data-goto` (grafikkpunkt i scriptet), `data-task-card` (hele oppgavekortet),
  `data-task` (avkrysningen), `data-go`,
  `data-add` og `data-serie` (bilde i en bildeserie). `FOCUS_ATTRS` gir fokus tilbake etter en
  ny tegning.
- Unntak: `updateField()` tegner bare elementlisten og preview på nytt, slik at
  tekstfeltet beholder fokus mens man skriver. `data-field` er en sti, f.eks.
  `navn` eller `bilder.2.kreditering`.
- Tekst som kan komme fra brukeren, skal alltid gjennom `esc()` før den settes inn
  med `innerHTML`.
- Hver elementtype er definert i `TYPES`: navn, felt i Rediger-modus, startverdier
  (`ny()`) og teksten i elementlisten. `lesbar: true` betyr at typen bare kan leses
  (ingen Rediger-modus, ikke i paletten). Grafikken tegnes av malene i `STAGE`.
  Paletten er gruppert i `GROUPS`.
- Eksempeldata ligger i `lagKjoreplan()` (bolker og elementer), `lagScript()`
  (manus, intervjuguide og tidslinje per bolk), `TASKS` (oppgavene på startsiden) og
  `DAGENS_INFO` (produsent, vaktsjef og beskjeder). Den påloggede brukeren er `BRUKER`
  (Maia). Alt innhold er oppdiktet.

## Skjermer og interaksjoner

Hovedmenyen: Dagens oppgaver · Script · Spilleliste.

1. **Dagens oppgaver:** hilsen etter klokkeslett (`hilsen()`: God morgen 05–08.59,
   God dag 09–14.59, God ettermiddag 15–17.59, God kveld 18–23.59, Gå og legg deg
   00–04.59, lokal tid, sjekkes hvert minutt), fremdriftslinje, oppgavekort med avkrysning, en
   stor knapp til spillelisten og «Dagens info» under den. Hele oppgavekortet kan
   klikkes. «Lese script» har en snarvei til Script-siden, «Gå gjennom kjøreplan» til
   spillelisten. «Dagens info» viser produsent, vaktsjef, grafikkavvikler,
   programledere og beskjeder. Før kjøreplanen er hentet er det et skjelett med en
   melding, bare grafikkavvikleren (den påloggede) vises med en gang.
2. **Script:** bolkmeny med sjekkbokser til venstre og innholdet for valgt bolk til høyre:
   manus (replikker med navn og regibeskjeder), intervjuguide og tidslinje. Start og
   slutt står i undertittelen. Grafikkpunktene i tidslinjen lenker
   til elementet i spillelisten. Er kjøreplanen ikke hentet, hentes den først.
3. **Spilleliste, tom:** «Hent kjøreplan» (later som det lastes i 0,9 s).
4. **Spilleliste, arbeidsflate:** bolkmeny med sjekkbokser, VIZ-oversikt,
   elementliste, elementpalett og preview/rediger-panel.

- **Opplæring:** første gang siden åpnes, vises en dialog om hvordan man navigerer.
  Når den lukkes (kryss, «Kom i gang» eller Esc), lagres det i `localStorage`
  (`INTRO_KEY`), og den vises ikke igjen.

- **Bolkene nummereres 0–7** overalt. Bolk 0 er åpningen. Nummeret lages bare i
  `bolkNavn()`.
- **Ett klikk** på et element åpner det i preview. Med tastatur fungerer Enter.
- **Nye elementer** (lagt til i etterkant, `isNew`) er merket «Ny» der typeikonet
  ellers står. De slettes med «Slett element» i preview, som bare vises når et nytt
  element er valgt. Sletting tar elementet av VIZ, og «Angre» legger det tilbake på
  samme plass. Elementer fra kjøreplanen kan ikke slettes.
- **Dra og slipp:** elementer som er lagt til i etterkant, kan dras (håndtaket rett til
  venstre for PUSH, eller selve raden) til en ny plass i bolken de ligger i, ikke til andre bolker. En lilla
  strek viser hvor elementet havner. Esc eller slipp utenfor listen avbryter. Med
  tastatur: piltast opp og ned på håndtaket. Rekkefølgen ligger i `state.bolker`.
- **PUSH til VIZ:** hver rad er en beholder med flere knapper: én som åpner elementet,
  VIZ-merkene (ett per kanal elementet ligger på), dra-håndtaket (bare på nye) og
  PUSH-knappen. PUSH åpner en meny med VIZ1, VIZ2 og VIZ3 (og «Fjern» hvis elementet
  allerede ligger på en kanal). Valget gjør elementet klart, slik at produsenten kan
  sende det fra VIZ (Vizrt) til TV-skjermen. Raden får et lilla «VIZ2»-merke, og klikk
  på merket fjerner PUSH-en. Hver kanal har én ting om gangen, så det gamle tas av når
  noe nytt pushes til samme kanal. Menyen brukes med piltaster, Home/End, Enter, Esc og
  Tab, og lukkes med klikk utenfor. Tilstanden ligger i `state.viz` som `{ id, bilde }`
  per kanal (`bilde` er null for hele elementet).
- **Push ett bilde:** bildeserier og fotokonkurransen har i tillegg «Push ett bilde» i
  PUSH-menyen. Det åpner en liste over bildene i serien (`state.pushView = 'bilder'`).
  Hvert bilde kan pushes til VIZ1–3 for seg (klikk igjen tar det av), og menyen blir
  stående åpen. Bildene kan dras til ny rekkefølge med samme dra-symbol som i
  elementlisten (eller piltast opp og ned på symbolet). Rekkefølgen gjelder også
  serien i preview og blir liggende. VIZ følger bildet når det flyttes. Merket på raden
  viser kanal og bildenummer («VIZ2 [bilde]3»). Bildet beholder utseendet sitt når det
  flyttes (`bildeSeed()`).
- Typen til det valgte elementet utheves i paletten («gjenkjennes»).
- **Klikk i paletten** åpner et nytt element i Rediger-modus (`state.draft`), men
  legger det ikke inn i bolken. «Legg element til spilleliste» legger det inn under
  det valgte (ellers nederst). «Avbryt» forkaster det.
- **Bildeserie** (og fotokonkurransen): egne piler, miniatyrer og teller («Bilde 2 av 5»,
  «Bidrag 2 av 3») under grafikken,
  adskilt fra pilene som blar mellom elementene i bolken. I Rediger-modus kan bilder
  legges til og fjernes, med egen kreditering per bilde.
- **Fotokonkurranse** ligger i Bolk 2 og Bolk 7 (det er riktig med to). Alle bidragene
  i en bolk er samlet i ett element som blas i som en bildeserie. Bidragene kan bare
  leses: ingen Rediger-modus, og typen ligger ikke i paletten. Ingen kobling til
  Instagram.
- **Bolker:** hver bolk har en rund sjekkboks til høyre inni bolk-boksen, både i
  spillelisten (`bolk.klar`) og på Script-siden (`state.scriptKlar`). Begge tegnes av
  `bolkItem()`.
- **Fremdrift** regnes som seks like deler: fire oppgaver som hukes av for hånd, og to
  som fylles opp bolk for bolk: «Lese script» (sjekkboksene på Script-siden) og «Gå
  gjennom kjøreplan» (sjekkboksene i spillelisten). De to har ingen avkrysning, men en
  sirkel uten kantlinje som fylles (2 av 8 bolker = en firedel). Ingen bolker klare:
  ingen sirkel. Klikk på dem før alle bolkene er klare får sirkelen (eller meldingen)
  til å riste, og «Gå gjennom alle bolkene» vises.

## Elementtyper (13, i fire grupper)

- **Supere:** navnesuper (navn og tittel), infosuper (tema og 1–3 setninger, med
  setningsteller).
- **Stolper:** infostolpe (kategori, tittel, beskrivelse, pris og produktbilde fra
  høyre eller nederst), oppskriftstolpe (GMN-kjøkkenet, rett, QR-kode),
  sendestolpe («Dagens sending», fire innslag som er sendt, neste eller senere).
- **Bilder:** stillbilde, bildeserie, faksimile (skjermbilde av nettartikkel med
  kildeetikett), fotokonkurranse (en serie bidrag. Per bidrag: navn som fotokreditering
  oppe til venstre, bildetittel hvis den finnes, sted og fylke. Teksten «Send inn ditt
  bilde på tv2.no/fotokonkurranse»).
- **Overlegg:** ticker (dato og klokkeslett fylles ut automatisk, nyheter én per linje,
  eller Instagram-variant), hashtag, fotokreditering, Straks-plakat.

## Designregler (TV 2s grafiske profil)

**Farger i verktøyet, 60 / 30 / 10:**
- `#190036` (60 %): bakgrunn
- `#FAFAFA` (30 %): kort, paneler og tekst på mørk bakgrunn
- `#7100FF` (10 %): bare det som skal fange blikket (valgt tilstand, hovedknapper,
  fremdrift, merker, VIZ-merket)
- Bruk aldri `#7100FF` som tekst eller tynne linjer direkte på `#190036`, fordi
  kontrasten er for lav (ca. 2,9:1). Bruk den som fylt flate med lys tekst.

**Grafikken i preview** skal ligne God morgen Norge slik den ser ut på TV, ikke
verktøyet. Den har egne farger i `:root` (`--gmn-*`): myke gradienter i lys blå,
beige og fersken, korallrød og sennepsgul som aksent, mørk hashtag-pille.
Supere, Stolper og Overlegg er hovedsakelig oransje og gule, som God morgen Norge.
De ligger over et «kamerabilde» med soloppgang og åser i dis (`kamera()`). Bare
navnesuperen har en personsilhuett i bildet (`kamera(true)`). Elementene har hvite
flater, varme gule faner og korall som aksent. Blått er bare en liten detalj (toppen
av himmelen, hashtag-pillen og kanalfeltet på Straks-plakaten). Ingen brune farger.
Navnesuperen har ingen stripe, og i infosuperen starter tittel og tekst på samme
venstrekant. Bilder (stillbilde, bildeserie, faksimile,
fotokonkurranse) er godkjent som de er. Ikke endre dem eller stilene de deler
(`.g-pille`, `.g-hjorne`, `.g-tv2`, `.g-bg--*`, `.g-scene--*`). Størrelser
er i `cqw`, slik at grafikken skalerer med panelet. Stolpene er høye og smale
(ca. 1 : 2,6) til venstre i bildet.

**Typografi (TV 2 Sans):**
- **TV 2 Display:** overskrifter og større ingresser
- **TV 2 Text:** brødtekst, knapper og informasjonstekst
- Grafikken bruker også TV 2 Display og TV 2 Text. Vi har ikke fonten som brukes på
  lufta.
- **Stilistiske alternativer** (stilsett `ss02`, utsparte versaler) brukes kun i
  titler og kun på første bokstav. Det gjøres med `.h1::first-letter` og
  `.h2::first-letter` i `styles.css`. C, I, O og Q har ingen alternativ variant.

**Øvrig:**
- Fokusringer, `aria-pressed`, `aria-current` og `aria-expanded` er lagt inn.
  Behold dem.
- Treffflater skal være minst 44 px.
- Tickeren ruller ikke, boksen rister ikke og skjelettet pulserer ikke når brukeren
  har slått av bevegelse (`prefers-reduced-motion`).

## Konvensjoner

- All tekst i grensesnittet og alle kodekommentarer skal være på norsk.
- Domenebegreper: kjøreplan, spilleliste, script, manus, intervjuguide, tidslinje,
  bolk, element, navnesuper, infosuper, stolper (infostolpe, oppskriftstolpe,
  sendestolpe), stillbilde, bildeserie, faksimile, fotokonkurranse, ticker, hashtag,
  fotokreditering, Straks-plakat, PUSH, VIZ.
- Ingen ekte integrasjoner. Henting av kjøreplan og bilder og PUSH til VIZ er
  simulert.
- Bilder er oppdiktede SVG-plassholdere (`SCENES`). GMN-G-en og TV 2-logoen er enkle
  plassholdere til vi får de offisielle logofilene. Ikke bruk bilder, illustrasjoner
  eller navn fra ekte sendinger.

## Åpne spørsmål

- Kan ett element ligge på flere VIZ-kanaler samtidig? I dag flyttes det.
- Tiden i parentes («07.40 (11.40)») er satt til fire timer etter, som i
  referansene. Stemmer det at det er reprisen?

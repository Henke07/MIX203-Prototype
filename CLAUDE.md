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
  `data-push` og `data-viz` (PUSH-menyen), `data-bolk`, `data-script-bolk`,
  `data-goto` (grafikkpunkt i scriptet), `data-task`, `data-go`, `data-add` og
  `data-serie` (bilde i en bildeserie). `FOCUS_ATTRS` gir fokus tilbake etter en
  ny tegning.
- Unntak: `updateField()` tegner bare elementlisten og preview på nytt, slik at
  tekstfeltet beholder fokus mens man skriver. `data-field` er en sti, f.eks.
  `navn` eller `bilder.2.kreditering`.
- Tekst som kan komme fra brukeren, skal alltid gjennom `esc()` før den settes inn
  med `innerHTML`.
- Hver elementtype er definert i `TYPES`: navn, felt i Rediger-modus, startverdier
  (`ny()`) og teksten i elementlisten. Grafikken tegnes av malene i `STAGE`.
  Paletten er gruppert i `GROUPS`.
- Eksempeldata ligger i `lagKjoreplan()` (bolker og elementer), `lagScript()`
  (manus, intervjuguide og tidslinje per bolk) og `TASKS` (oppgavene på startsiden).
  Alt innhold er oppdiktet.

## Skjermer og interaksjoner

Hovedmenyen: Dagens oppgaver · Script · Spilleliste.

1. **Dagens oppgaver:** hilsen, fremdriftslinje, oppgavekort med avkrysning og en
   stor knapp til spillelisten. «Lese script» har en snarvei til Script-siden.
2. **Script:** bolkmeny til venstre og innholdet for valgt bolk til høyre: start,
   slutt og varighet, programledere og gjester, manus (replikker med navn og
   regibeskjeder), intervjuguide og tidslinje. Grafikkpunktene i tidslinjen lenker
   til elementet i spillelisten. Er kjøreplanen ikke hentet, hentes den først.
3. **Spilleliste, tom:** «Hent kjøreplan» (later som det lastes i 0,9 s).
4. **Spilleliste, arbeidsflate:** bolkmeny, VIZ-oversikt, elementliste,
   elementpalett, preview/rediger-panel og «Bolk klar».

- **Bolkene nummereres 0–7** overalt. Bolk 0 er åpningen. Nummeret lages bare i
  `bolkNavn()`.
- **Dobbeltklikk** på et element åpner det i preview. Med tastatur fungerer Enter.
  Enkeltklikk gjør ingenting (bevisst, det er ikke avklart).
- **PUSH til VIZ:** hver rad er en beholder med to knapper, én som åpner elementet og
  én PUSH-knapp. PUSH åpner en meny med VIZ1, VIZ2 og VIZ3 (og «Fjern» hvis
  elementet allerede ligger på en kanal). Valget gjør elementet klart, slik at
  produsenten kan sende det fra VIZ (Vizrt) til TV-skjermen. Raden får et
  «VIZ2»-merke. Hver kanal har ett element om gangen, så det gamle tas av når et nytt
  pushes til samme kanal. Menyen brukes med piltaster, Home/End, Enter, Esc og Tab,
  og lukkes med klikk utenfor. Tilstanden ligger i `state.viz`.
- Typen til det valgte elementet utheves i paletten («gjenkjennes»).
- **Klikk i paletten** legger inn et nytt element under det valgte og åpner det i
  Rediger-modus.
- **Bildeserie:** egne piler, miniatyrer og teller («Bilde 2 av 5») under grafikken,
  adskilt fra pilene som blar mellom elementene i bolken. I Rediger-modus kan bilder
  legges til og fjernes, med egen kreditering per bilde.
- **Foto-konk** (fotokonkurransen) ligger i Bolk 2 og Bolk 7. Bidrag som står etter
  hverandre, grupperes under en felles overskrift.
- **Fremdrift** regnes som seks like deler: fem oppgaver som hukes av for hånd, og
  kjøreplanen, som fylles opp etter hvert som bolkene markeres som klare.

## Elementtyper (13, i fire grupper)

- **Supere:** navnesuper (navn og tittel), infosuper (tema og 1–3 setninger, med
  setningsteller).
- **Stolper:** infostolpe (kategori, tittel, beskrivelse, pris og produktbilde fra
  høyre eller nederst), oppskriftstolpe (GMN-kjøkkenet, rett, QR-kode),
  sendestolpe («Dagens sending», fire innslag som er sendt, neste eller senere).
- **Bilder:** stillbilde, bildeserie, faksimile (skjermbilde av nettartikkel med
  kildeetikett), foto-konk (Instagram-brukernavn, sted og konkurransetekst).
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
beige og fersken, korallrød og sennepsgul som aksent, mørk hashtag-pille. Størrelser
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
- Tickeren ruller ikke når brukeren har slått av bevegelse (`prefers-reduced-motion`).

## Konvensjoner

- All tekst i grensesnittet og alle kodekommentarer skal være på norsk.
- Domenebegreper: kjøreplan, spilleliste, script, manus, intervjuguide, tidslinje,
  bolk, element, navnesuper, infosuper, stolper (infostolpe, oppskriftstolpe,
  sendestolpe), stillbilde, bildeserie, faksimile, foto-konk, ticker, hashtag,
  fotokreditering, Straks-plakat, PUSH, VIZ.
- Ingen ekte integrasjoner. Henting av kjøreplan og bilder og PUSH til VIZ er
  simulert.
- Bilder er oppdiktede SVG-plassholdere (`SCENES`). GMN-G-en og TV 2-logoen er enkle
  plassholdere til vi får de offisielle logofilene. Ikke bruk bilder, illustrasjoner
  eller navn fra ekte sendinger.

## Åpne spørsmål

- Hva skal «Nytt element» gjøre utover de faste typene? I dag vises bare en melding.
- Hva skal et enkeltklikk på et element gjøre?
- Kan ett element ligge på flere VIZ-kanaler samtidig? I dag flyttes det.
- Tiden i parentes («07.40 (11.40)») er satt til fire timer etter, som i
  referansene. Stemmer det at det er reprisen?

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
- Lister (oppgaver, bolker, elementer, palett) tegnes med `innerHTML`, og klikk fanges
  med event delegation via `data-`-attributter (`data-id`, `data-bolk`, `data-task`,
  `data-add`).
- Unntak: `updateField()` tegner bare elementlisten og preview på nytt, slik at
  tekstfeltet beholder fokus mens man skriver.
- Tekst som kan komme fra brukeren, skal alltid gjennom `esc()` før den settes inn
  med `innerHTML`.
- Eksempeldata ligger i `lagKjoreplan()` (bolker og elementer) og `TASKS` (oppgavene
  på startsiden). Alt innhold er oppdiktet.

## Skjermer og interaksjoner

1. **Dagens oppgaver:** hilsen, fremdriftslinje, oppgavekort med avkrysning og en
   stor knapp til spillelisten.
2. **Spilleliste, tom:** «Hent kjøreplan» (later som det lastes i 0,9 s).
3. **Spilleliste, arbeidsflate:** bolkmeny, elementliste, elementpalett,
   preview/rediger-panel og «Bolk klar».

- **Dobbeltklikk** på et element åpner det i preview. Med tastatur fungerer Enter.
  Enkeltklikk gjør ingenting (bevisst, det er ikke avklart).
- Typen til det valgte elementet utheves i paletten («gjenkjennes»).
- **Klikk i paletten** legger inn et nytt element under det valgte og åpner det i
  Rediger-modus.
- **Foto-konk** (fotokonkurransen) er en ny elementtype. Bidrag som står etter
  hverandre, grupperes under en felles overskrift.
- **Fremdrift** regnes som seks like deler: fem oppgaver som hukes av for hånd, og
  kjøreplanen, som fylles opp etter hvert som bolkene markeres som klare.

## Designregler (TV 2s grafiske profil)

**Farger, 60 / 30 / 10:**
- `#190036` (60 %): bakgrunn og fullskjermgrafikk
- `#FAFAFA` (30 %): kort, paneler og tekst på mørk bakgrunn
- `#7100FF` (10 %): bare det som skal fange blikket (valgt tilstand, hovedknapper,
  fremdrift, merker)
- Bruk aldri `#7100FF` som tekst eller tynne linjer direkte på `#190036`, fordi
  kontrasten er for lav (ca. 2,9:1). Bruk den som fylt flate med lys tekst.

**Typografi (TV 2 Sans):**
- **TV 2 Display:** overskrifter og større ingresser
- **TV 2 Text:** brødtekst, knapper og informasjonstekst
- **Stilistiske alternativer** (stilsett `ss02`, utsparte versaler) brukes kun i
  titler og kun på første bokstav. Det gjøres med `.h1::first-letter` og
  `.h2::first-letter` i `styles.css`. C, I, O og Q har ingen alternativ variant.

**Øvrig:**
- Fokusringer, `aria-pressed` og `aria-current` er lagt inn. Behold dem.
- Treffflater skal være minst 44 px.

## Konvensjoner

- All tekst i grensesnittet og alle kodekommentarer skal være på norsk.
- Domenebegreper: kjøreplan, spilleliste, bolk, element, super (navnesuper),
  stolper, stillbilde, bildeserie, faksimile, foto-konk.
- Ingen ekte integrasjoner. Henting av kjøreplan og bilder er simulert.

## Åpne spørsmål

- Hva skal «Nytt element» gjøre utover de seks faste typene? I dag vises bare en
  melding.
- Hva skal et enkeltklikk på et element gjøre?

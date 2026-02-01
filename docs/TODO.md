# TECHNISCHE TODO — Next Phase (post-refactor)

## TODO 07 — Checks uitbreiden: zip/extract checks via state (`isZip`, `compressedContents`)

**Doel**
Oefeningen rond comprimeren/uitpakken kunnen automatisch beoordeeld worden.

**Beschrijving**

- nieuwe tasks:
    - `folder-zipped`
    - `folder-extracted`
- Nieuwe checks (minimaal):
    - `zip-exists` (path moet bestaan + `isZip:true`)
    - `zip-contains` (verwachte items in `compressedContents`)
    - `zip-not-exists` (optioneel)

- Let op “fake zip”: student kan niet zomaar een file “.zip” aanmaken en slagen; check moet `isZip` gebruiken.

**Succescriteria**

- Na compress: zip-check slaagt.
- Na extract: extract gerelateerde check(s) kunnen slagen (afhankelijk van gekozen check design).
- Een “nepbestand Archive.zip” zonder `isZip` faalt.

**Nodige files**

- `/src/core/script-core.js`
- `/docs/checks.md`

---

## TODO 08 — Auto task descriptions verbeteren + toggle “toon paden”

**Doel**
Taken zijn duidelijker voor leerlingen en bruikbaar voor leerkrachten. De taken bevatten een duidelijke instructie (verwijder, verplaats, kopieer, comprimeer, hernoem...) en een duidelijke beschrijven van de startbestanden.

**Beschrijving**

- Upgrade generator van standaardbeschrijvingen:
    - voeg bestandspaden toe (C:\… of OneDrive\…), zowel bij startlocatie als bij doellocatie (bij verplaatsen / kopiëren)
    - betere werkwoorden (“Verplaats”, “Hernoem”, “Pak uit”, “Herstel”)

**Succescriteria**

- Elke taak heeft een leesbare beschrijving.
- Toggle werkt: met/zonder paden.
- Beschrijvingen blijven correct bij moves/renames.

**Nodige files**

- `/src/teacher/script-teacher.js`
- `/src/teacher/exercise-configurator.html`
- `/src/core/style.css`

---

## TODO 09 — Accessibility: UI schaal (A+ / A-)

**Doel**
Leerlingen met slecht zicht kunnen comfortabel werken.

**Beschrijving**

- Voeg UI controls toe (A+ / A-) die een CSS scale factor instellen (bv. via class op body of CSS variables).
- Bewaar instelling in localStorage.
- Schaal moet ook modals + toolbar beïnvloeden.

**Succescriteria**

- Minstens 3 niveaus (100%, 125%, 150%).
- Blijft bewaard na refresh.
- Layout blijft bruikbaar (geen overlap/afsnijden).

**Nodige files**

- `/src/student/index.html` (knoppen plaatsen)
- `/src/core/style.css` (variabelen / classes)
- `/src/core/script-core.js` (toggle + persist)

---

## TODO 10 — Anti-gaming (fase 1): action log + basis rules (max extra deletes/moves/renames)

**Doel**
Voorkom dat leerlingen rommel maken en toch hoge score halen.

**Beschrijving**

- Introduceer een `actionLog[]` waarin elke file-operation een event schrijft:
    - type: delete/rename/move/create/compress/extract/restore
    - timestamp
    - path/from/to

- Voeg optionele regels toe in config:
    - `rules: { maxExtraDeletes, maxExtraMoves, maxExtraRenames }`

- Implementatie: bij submit/check bereken penalty of markeer “rule violations” apart.

**Succescriteria**

- Action log vult correct bij elke relevante operatie.
- Regels kunnen overtredingen detecteren.
- Geen impact op normale taken (alles blijft werken zonder rules).

**Nodige files**

- `/src/core/script-core.js`
- `/src/teacher/exercise-config.json` (rules toevoegen)
- `/src/student/script-student.js` (indien submit/check flow daar zit)

---

## TODO 12 — i18n basis (NL/EN) voor UI strings + task templates

**Doel**
Meertalige ondersteuning zonder overal hardcoded tekst.

**Beschrijving**

- Maak `i18n.js` (of in core) met `t(key)` en dictionaries `nl/en`.
- Vervang UI strings stapsgewijs (buttons, modals, meldingen).
- Task description templates ook via i18n.

**Succescriteria**

- Taal switch (config of toggle) verandert UI tekst.
- Default NL, fallback naar EN bij ontbrekende key.
- Geen ontbrekende strings in kritieke flows.

**Nodige files**

- `/src/core/script-core.js`
- `/src/student/index.html`
- `/src/core/style.css` (optioneel voor language toggle)
- `/src/teacher/script-teacher.js` (teacher UI strings)
- `/src/teacher/exercise-configurator.html`

---

# NICE TO HAVE (later / apart plannen)

## NOTE â€” Student recycle bin pre-seeding

**Doel**
Oefeningen met restore/permanent-delete checks moeten kunnen starten met items in de prullenbak.

**Beschrijving**

- Student fresh-start moet `recycleBin` initialiseren vanuit `exercise-config.json`:
    - `initialRecycleBin` (exported by teacher configurator)
- Hiermee kunnen restore/permanent-delete taken slagen zonder eerst een item te verwijderen.

**Succescriteria**

- Nieuwe oefening met `initialRecycleBin` toont items in de Recycle Bin.
- `file-restored` / `folder-restored` en `file/folder-permanently-deleted` checks kunnen slagen.

**Nodige files**

- `/src/core/script-core.js`
- `/docs/checks.md` (optioneel: config schema note)

## NTH 01 — Drag & drop (files/folders verplaatsen)

**Doel**
Meer Windows-realistische interactie.

**Beschrijving**

- Drag start op items, drop targets op folders, visual highlight, auto-scroll.
- Koppelen aan bestaande move logic (cut/paste) om duplicatie te vermijden.

**Succescriteria**

- Drag file → drop folder = move.
- Undo/restore gedrag blijft consistent.
- Geen “accidental drop” bugs.

**Nodige files**

- `/src/core/script-core.js`
- `/src/core/style.css`

---

## NTH 02 — Tooltip modes in configurator (easy/hard)

**Doel**
Leerkracht kan UI “coachend” of “minimalistisch” maken.

**Beschrijving**

- Toggle die bepaalt: rijke tooltips aan/uit + pad-weergave aan/uit.

**Succescriteria**

- Toggle verandert tooltips zonder refresh.
- Export slaat setting op.

**Nodige files**

- `/src/teacher/script-teacher.js`
- `/src/teacher/exercise-configurator.html`
- `/src/core/style.css`

---

## NTH 03 — SCORM package export (zip met imsmanifest + alle assets)

**Doel**
Van JSON export naar “1 klik SCORM upload”.

**Beschrijving**

- Gebruik JSZip om alle nodige bestanden + config + manifest te bundelen.
- Voorzie template `imsmanifest.xml` met juiste resource references.

**Succescriteria**

- Resultaat is één zip uploadbaar in LMS.
- Start automatisch met juiste entry point.
- Config is ingepakt en geladen door runtime.

**Nodige files**

- `/src/teacher/script-teacher.js` (export pipeline)
- `/src/teacher/exercise-configurator.html`
- (nieuw) `/scorm/imsmanifest.template.xml`

---

## NTH 04 — Search disabled messaging (duidelijker)

**Doel**
Leerlingen snappen waarom zoeken niet werkt (indien uitgeschakeld).

**Beschrijving**

- Disable zoekveld + tooltip/label “Zoeken is uitgeschakeld voor deze oefening”.

**Succescriteria**

- Zoekveld is visibly disabled.
- Geen verwarring of “broken” gevoel.

**Nodige files**

- `/src/student/index.html`
- `/src/core/style.css`
- `/src/core/script-core.js`

---

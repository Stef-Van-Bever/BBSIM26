## NTH — Accessibility: UI schaal (A+ / A-)

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

## NTH — i18n basis (NL/EN) voor UI strings + task templates

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

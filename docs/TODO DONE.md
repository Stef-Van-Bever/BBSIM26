## TODO 01 — Modal overlay click: sluit alleen “niet-blocking” modals

**Doel**
UX verbeteren: buiten de modal klikken sluit de modal, behalve bij modals die expliciet bevestiging vereisen (instructies, confirm, submit/reset).

**Beschrijving**

- Introduceer een modal-config (bv. `data-overlay-close="true|false"` op modal containers).
- Pas overlay click handler aan: sluit enkel modals die overlay-close toelaten.
- Zorg dat ESC-toets hetzelfde gedrag volgt (optioneel, maar aanbevolen voor accessibility).

**Succescriteria**

- Klikken buiten een “gewone” modal sluit deze.
- Klikken buiten _Instructions / Confirmation / Submit-Reset_ sluit **niet**.
- Geen regressie: bestaande open/close knoppen blijven werken.

**Nodige files**

- `/mnt/data/script-core.js`
- `/mnt/data/index.html` (modals attributes)
- `/mnt/data/style.css` (optioneel: cursor/overlay feedback)

---

## TODO 02 — Teacher workflow guardrails + visuele bevestiging “Start/Target saved”

**Doel**
Leerkrachten maken minder fouten: duidelijke stappen, knoppen pas actief wanneer prerequisites ok zijn, en bevestiging wanneer Start/Target set is.

**Beschrijving**

- Voeg “state” toe in teacher-configurator: `startStructureSet`, `targetStructureSet`.
- Disable “Analyze differences” tot beide structuren gezet zijn.
- Toon een duidelijke bevestiging (toast/banner of button state: “Saved ✓”).
- Voeg waarschuwing toe bij export als start/target ontbreken.

**Succescriteria**

- “Analyze differences” kan pas na Start+Target.
- Visuele bevestiging verschijnt na “Set as start/target”.
- Export blokkeert of waarschuwt als start/target ontbreekt.

**Nodige files**

- `/mnt/data/script-teacher.js`
- `/mnt/data/exercise-configurator.html`
- `/mnt/data/style.css`

---

## TODO 03 — Student tasklist UI: groen bij geslaagd + duidelijke statusweergave

**Doel**
Leerlingen zien meteen wat gelukt is na “Check”.

**Beschrijving**

- Update task rendering: geslaagde taken krijgen groene styling (achtergrond/border/icoon).
- Houd “failed/partial” neutraal of rood (maar subtiel).
- Maak status consistent: ook bij herladen (op basis van latest check results).

**Succescriteria**

- Na “Check”: voltooide taken worden groen.
- Styling is zichtbaar maar niet schreeuwerig.
- Geen impact op scoringlogica.

**Nodige files**

- `versie 0.6/script-core.js` (waar tasks worden gerenderd/updated)
- `versie 0.6/script-student.js` (indien student-specifiek)
- `versie 0.6/style.css`

---

## TODO 11 — OneDrive multi-root (C: + OneDrive) met herkenbaar icoon

**Doel**
Realistische context: werken met lokale schijf én cloudmap.

**Beschrijving**

- Breid datastructuur uit naar meerdere roots.
- Pas path helpers en tree rendering aan om root te respecteren.
- Voeg OneDrive node met icoon toe in UI.

**Succescriteria**

- Zowel C: als OneDrive verschijnen als “root”.
- Navigatie + operations werken binnen/between roots (beslis: wel/niet cross-root moves).
- Geen regressies in bestaande single-root oefeningen.

**Nodige files**

- `/mnt/data/default-structure.js` (roots)
- `/mnt/data/script-core.js` (path helpers + rendering + move rules)
- `/mnt/data/style.css` (icoon styling)
- `/mnt/data/index.html` (icoon asset / markup indien nodig)

!!! _opvolging_: taskgeneratie en checks moeten aangepast worden. Doe dit zo snel mogelijk.

---

## TODO 06 — Checks uitbreiden: folder-not-exists + folder moved/renamed (state-based)

**Doel**
Meer oefeningstypes kunnen evalueren zonder grote architectuurwijziging.

**Beschrijving**

- Implementeer `folder-not-exists` (staat al beschreven, maar ontbreekt in evaluatie).
- Voeg checks toe:
    - `folder-renamed` (from/to)
    - `folder-moved` (from/to)

- Zorg dat teacher editor ze kan opslaan in JSON en student evaluator ze begrijpt.

**Succescriteria**

- Nieuwe check types werken end-to-end: config → uitvoeren → “Check” → correct resultaat.
- Geen regressie op bestaande checks.
- Foutmeldingen bij misconfiguratie zijn begrijpelijk.

**Nodige files**

- `/src/core/script-core.js` (evaluateCheck uitbreiding)
- `/docs/checks.md` (documentatie updaten)
- `/src/teacher/script-teacher.js` (UI/serializer indien nodig)

---

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

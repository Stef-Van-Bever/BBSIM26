# SCORM packaging (manual)

Deze repo bevat een HTML/JS/CSS oefening die als SCORM-pakket in een LMS gebruikt kan worden.
Onderstaande stappen tonen hoe je handmatig een SCORM ZIP maakt.

> Doel: een ZIP met `imsmanifest.xml` + alle benodigde HTML/CSS/JS bestanden.

## Voorwaarden

- Je hebt een SCORM 1.2 of SCORM 2004 LMS (bv. Moodle, itslearning, Smartschool, ...).
- Je kan lokaal een ZIP-bestand maken.

## Wat moet er in de SCORM ZIP?

Minimaal:

- `imsmanifest.xml` (in de root van de ZIP)
- `index.html` (de entry page die het LMS laadt)
- alle scripts en assets die `index.html` gebruikt

## Aanbevolen aanpak in deze repo

We vertrekken vanuit de student-app in `src/student/` en bundelen:

- `src/student/index.html`
- `src/student/script-student.js`
- `src/core/script-core.js`
- `src/core/default-structure.js` (als student dit nodig heeft)
- `src/shared/style.css`
- eventuele afbeeldingen/icons (later)

### 1) Maak een build folder (manual)

Maak lokaal een map, bv. `scorm/package/`:
scorm/
imsmanifest.xml
package/

> `scorm/package/` staat best in `.gitignore` (build output).

### 2) Kopieer de nodige files

Kopieer naar `scorm/package/`:

- `src/student/index.html` → `scorm/package/index.html`
- `src/student/script-student.js` → `scorm/package/script-student.js`
- `src/core/script-core.js` → `scorm/package/script-core.js`
- `src/shared/style.css` → `scorm/package/style.css`

Let op: als je in de toekomst extra bestanden laadt (images/icons), moeten die ook mee.

### 3) Pas paden aan in de SCORM `index.html`

Omdat we de files “plat” in `scorm/package/` zetten, moeten script/style references daar ook naar verwijzen.

In `scorm/package/index.html` gebruik je bijvoorbeeld:

```html
<link rel="stylesheet" href="style.css" />
<script src="script-core.js"></script>
<script src="script-student.js"></script>
```

4. Zorg dat imsmanifest.xml naar index.html verwijst

Controleer in scorm/imsmanifest.xml dat de resource een launch file heeft die index.html is.

5. Maak de ZIP

Maak een ZIP van de inhoud van scorm/package/ samen met imsmanifest.xml in de root van de zip.

De ZIP moet er zo uitzien:
my-scorm.zip
imsmanifest.xml
index.html
style.css
script-core.js
script-student.js
...

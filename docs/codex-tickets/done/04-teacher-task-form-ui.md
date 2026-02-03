# Ticket 04 — Teacher UI: task form builder (workflow 1-9)

## Doel

Na "Set startstructuur" verschijnt een taak-formulier. Leerkracht kan meerdere taken toevoegen, bekijken, verwijderen, exporteren.

## Vereiste workflow

1. Open exercise configurator
2. Bouw startstructuur
3. Set startstructuur
4. Formulier verschijnt
5. Kies taaktype (move file, move folder, delete file, delete folder, restore file, zip, unzip ...)
6. Vraag bijkomende info (van/naar, naam, dest, output zip naam, ...)
7. Bevestig -> taak toegevoegd in lijst
8. Meerdere taken mogelijk
9. Export oefening (startStructure + tasks)

## UX details (aanrader)

- Task list panel met edit/remove
- Path pickers via tree select (niet typen)
- Voor move/rename/delete/restore:
    - selecteer subject via klik in tree (krijg subjectId)
- Voor zip-create:
    - multi-select input nodes (ids)
    - output naam + output path
- Voor zip-extract:
    - selecteer archive node (id)
    - destination path select

## Succescriteria

- Taakpanel blijft verborgen tot startStructureSet === true
- Toevoegen/verwijderen werkt
- Export JSON bevat tasks correct

## Codex prompt

Implementeer teacher task builder UI.

1. Zoek teacher configurator (exercise-configurator.html + script-teacher.js).
2. Voeg state toe: `startStructureSet` bestaat al; toon nu een nieuw Task Builder panel wanneer true.
3. Voeg UI controls:
    - dropdown task type
    - context inputs per type
    - add task button
    - lijst van tasks met remove
4. Voeg tree-based selection:
    - "Select item" knop die de volgende klik op tree capture't en subjectId vult
    - voor zip-create: allow multi-select items
5. Zorg dat tasks opgeslagen worden in teacher config en mee in export gaan.

## Commit message

feat(teacher): add task form builder after start structure set

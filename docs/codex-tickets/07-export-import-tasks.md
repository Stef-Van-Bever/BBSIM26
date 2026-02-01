# Ticket 07 — Export/import new format (startStructure + tasks)

## Doel

Export bevat:

- metadata
- startStructure
- tasks (Task DSL)
  Import laadt deze oefening correct.

## Backwards compat (optioneel)

Als oude exports nog bestaan:

- import: als `tasks` ontbreekt => [] en warning.

## Succescriteria

- Export bestand laadt correct in student runtime
- Tasks verschijnen in student tasklist
- Startstructuur is correct

## Codex prompt

Update export/import pipeline.

1. Zoek export code (teacher).
2. Voeg tasks toe.
3. Zoek import code (student) en laad tasks + startStructure.
4. Voeg fallback voor ontbrekende fields.
5. Documenteer export JSON shape kort in docs.

## Commit message

feat(export): include tasks in export and support import

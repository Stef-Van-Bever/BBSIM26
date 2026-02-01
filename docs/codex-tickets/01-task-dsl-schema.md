# Ticket 01 — Introduce Task DSL schema (expliciete taken)

## Doel

Een stabiel JSON-schema voor taken, zodat leerkrachten opdrachten definiëren als "move/rename/unzip..." i.p.v. start/target-diff.

## Context

We willen tasks opslaan in de exercise export. UI komt later.

## Scope

- Definieer `exercise.tasks: Task[]`
- Voorzie minimaal deze task types:
    - move (file/folder)
    - rename (file/folder)
    - delete (file/folder)
    - restore (file/folder) (indien jullie recycle-bin simuleren)
    - zip-create
    - zip-extract (unzip)

## Verwachte data (voorstel)

- move:
    - `{ type:"move", subjectId:"<uuid>", fromPath:"...", toPath:"..." }`
- rename:
    - `{ type:"rename", subjectId:"<uuid>", fromName:"...", toName:"..." }`
- delete:
    - `{ type:"delete", subjectId:"<uuid>", fromPath:"..." }`
- restore:
    - `{ type:"restore", subjectId:"<uuid>", toPath:"..." }`
- zip-create:
    - `{ type:"zip-create", inputIds:["<uuid>",...], outputName:"archief.zip", outputPath:"..." }`
- zip-extract:
    - `{ type:"zip-extract", archiveId:"<uuid>", destPath:"..." }`

Optioneel:

- `strict: true|false` per task (strict = moet via event log gebeurd zijn)

## Succescriteria

- Export bevat `tasks` array met bovenstaande structuur.
- Er is één centrale plek in code waar Task types gedefinieerd zijn (enum/const + JSDoc).
- Basale validatie: onbekend type => foutmelding.

## Codex prompt

Je bent een senior JS dev. Voeg een Task DSL schema toe aan dit project.

1. Zoek waar exercise config/export JSON gedefinieerd wordt.
2. Voeg `tasks: []` toe aan de config.
3. Maak een nieuw bestand (of sectie) met Task type definities + JSDoc typedefs.
4. Voeg een helper `validateTasks(tasks)` toe die onbekende types of ontbrekende velden detecteert.
5. Zorg dat bestaande exports blijven werken (als tasks ontbreekt -> default []).

Geef mij:

- Welke files je aangepast hebt
- Waarom die plek
- Een korte checklist om manueel te testen in de UI (export openen en JSON bekijken)

## Commit message (na geslaagde test)

feat(tasks): add task DSL schema + validation helpers

# Ticket 03 — Introduce action log events for all file operations

## Doel

Acties kunnen bewijzen (anti-omzeiling) + betere feedback: "je hebt uitgepakt naar X" i.p.v. enkel eindstate.

## Events (minimaal)

- MOVE { subjectId, fromPath, toPath }
- RENAME { subjectId, fromName, toName, parentPath }
- DELETE { subjectId, fromPath }
- RESTORE { subjectId, toPath }
- ZIP_CREATE { outputId, outputPath, outputName, inputIds[] }
- ZIP_EXTRACT { archiveId, destPath, extractedIds? (optioneel) }

Algemeen:

- event heeft `id` (uuid), `ts` (timestamp ms), `type` + payload

## Scope

- `actionLog: Event[]` in runtime state
- Bij elke UI-file-operation push je event.
- Voeg `resetActionLog()` bij reset oefening.
- Export: in teacher export hoeft actionLog NIET, enkel tasks + startStructure.
- Student runtime: actionLog begint leeg.

## Succescriteria

- Na move/rename/delete/unzip staat er een event in log.
- Log is zichtbaar in debug (console of debug panel).

## Codex prompt

Implementeer een action log systeem.

1. Maak een centrale event helper: `logEvent(type, payload)` + `getActionLog()`.
2. Integreer dit in alle bestaande file-operaties (move/rename/delete/copy/zip/unzip waar aanwezig).
3. Zorg voor reset op oefening reset.
4. Voeg optioneel een simpele debug UI of console dump als `window.__BBSIM_ACTION_LOG__`.

## Commit message

feat(sim): add action log events for operations

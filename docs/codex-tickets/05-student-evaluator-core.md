# Ticket 05 — Task evaluator core (log + state)

## Doel

Taken checken op basis van:

- action log (strict bewijs)
- current state (fallback/extra check)
  en duidelijke feedback geven per taak.

## Evaluatie-strategie

- Default: `strict=true` voor move/rename/delete/restore/zip/unzip (aanrader)
- Een task is SUCCESS als:
    - er een matchend event is (op subjectId + params), EN
    - (optioneel) current state bevestigt resultaat

Voor unzip:

- vereist ZIP_EXTRACT event archiveId + destPath
- check dat destPath effectief entries bevat (minimaal)

## Output

`evaluateAll(tasks, state, actionLog) => results[]`

- result bevat `status`, `message`, `evidence` (eventId / path)

## Succescriteria

- In student UI: "Check" toont per taak success/fail op basis van evaluator
- False positives verminderen: enkel eindstate is niet voldoende als strict

## Codex prompt

Maak een evaluator module.

1. Maak `evaluateTask(task, { state, actionLog })`
2. Implementeer voor minimaal: move, rename, delete, restore, zip-create, zip-extract.
3. Match events:
    - subjectId/archiveId/outputId en paths/naam moeten overeenkomen
4. Voeg duidelijke messages:
    - "Je hebt X verplaatst van A naar B"
    - "Je hebt uitgepakt naar verkeerde locatie: verwacht ..."

Zorg dat evaluator los staat van UI (pure functions).

## Commit message

feat(check): add task evaluator using action log + state

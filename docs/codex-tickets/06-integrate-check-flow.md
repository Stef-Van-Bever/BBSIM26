# Ticket 06 — Integrate evaluator into Check flow + tasklist statuses

## Doel

De bestaande "Check" knop gebruikt nu evaluator results en zet task statuses (groen/rood/partial) correct.

## Scope

- Vervang diff-based check in student runtime door task evaluator
- Update localStorage gedrag:
    - status enkel gebaseerd op laatste check resultaten
    - reset oefening wist status + action log
- Tasklist UI toont:
    - not checked = neutraal
    - success = groen
    - fail = subtiel rood

## Succescriteria

- Geen tasks automatisch groen bij openen
- Na uitvoeren + check worden tasks correct groen
- Reset zet alles terug neutraal

## Codex prompt

Integreer evaluator in student check flow.

1. Zoek waar "Check" results berekend worden.
2. Roep `evaluateAll(tasks, state, actionLog)` aan.
3. Render per-task status in UI.
4. Fix localStorage zodat status niet "blijft hangen" zonder nieuwe check.
5. Reset wist actionLog + statuses.

## Commit message

feat(ui): integrate task evaluator into student check and status UI

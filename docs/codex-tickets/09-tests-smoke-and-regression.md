# Ticket 09 — Smoke tests + regressions

## Doel

Eenvoudige tests om te voorkomen dat core flows breken.

## Minimale scenario’s

1. Move file task:
    - start: file A in map X
    - task: move A -> map Y
    - student: move -> check => success
2. Rename folder task:
    - rename -> check => success
3. Zip-create task:
    - select items -> create zip -> check => success
4. Zip-extract task:
    - unzip archive -> juiste dest -> check => success
5. Reset:
    - status terug neutraal + actionLog leeg

## Codex prompt

Voeg smoke tests toe.

- Als project al test runner heeft: voeg tests toe.
- Als niet: voeg een `docs/smoke-test.md` checklist toe + een hidden debug toggle die action log toont.

## Commit message

test: add smoke/regression checks for task evaluator flows

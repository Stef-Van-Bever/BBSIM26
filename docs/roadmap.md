# Roadmap

Dit is een open-source SCORM-oefenpakket waarmee leerkrachten oefeningen rond bestandsbeheer kunnen maken
en leerlingen die kunnen uitvoeren in een gesimuleerde bestandsomgeving.

## Doel

- Leerlingen oefenen bestandsbeheer (mappen, bestanden, cloud vs lokaal) in een veilige sandbox.
- Leerkrachten kunnen oefeningen samenstellen via een configurator en exporteren naar SCORM.

## Status (MVP)

- Student UI met bestandsverkenner + checklist + "Check" evaluatie.
- Teacher configurator: start/target structuur instellen, differences analyseren, taken genereren.
- Multi-root ondersteuning (Lokale schijf C: + OneDrive).

## Milestones

### v0.7 — Betrouwbare checks + diff engine

Focus: checks correct en consistent over multi-root + folder/file moves.

- TODO 06: Extra checks + moved/renamed/copy verbeteringen
- Betere default task descriptions
- Stabilere persistence/refresh/reset flow (student)

### v0.8 — Meer realistische bestandsacties

- TODO 07: zip/unzip/compress/extract checks
- TODO 10: anti-gaming (action log / heuristics)
- UX polish (tooltips, hints, betere error feedback)

### v0.9 — Public release polish

- Documentatie + voorbeelden
- SCORM packaging workflow (manual of tool-based)
- Testset + smoke tests

## Detailed TODOs

Zie `docs/todos/` voor de volledige specificaties per taak.

# Bestandsbeheersimulator BBSIM (SCORM)

Dit is een open-source HTML/JS/CSS oefenpakket (SCORM-compatibel) waarmee leerkrachten oefeningen rond bestandsbeheer kunnen maken. Leerlingen kunnen daarmee oefenen in een gesimuleerde bestandsomgeving met specifieke opdrachten met automatische checks.

## Features

- **Student mode**: bestandsverkenner + checklist + “Check” evaluatie.
- **Teacher mode**: configurator om start/target structuur te maken en taken te genereren.
- **Multi-root**: Lokale schijf C: + OneDrive (realistische context).
- **Open-source**: gericht op onderwijs en samenwerking.

## Projectstructuur

- src/
    - core/ # gedeelde logica (filesystem, checks, helpers)
    - shared/ # gedeelde styling / assets
    - student/ # student UI (index.html + student script)
    - teacher/ # teacher configurator (authoring tool)
- docs/ # documentatie (checks, architecture, roadmap, todos)
- scorm/ # scorm-specifieke files (manifest / packaging)
- tools/ # (optioneel) scripts voor build/validatie

## config & workflow (kort)

- De teacher configurator exporteert een oefen-config (JSON).

- Student mode laadt de oefen-config en toont taken + voert checks uit.

Zie docs/architecture.md en docs/checks.md voor de technische details.

## Roadmap & TODO’s

- Roadmap: docs/roadmap.md
- Gedetailleerde taken: docs/todos

## Licentie

Dit project is gelicentieerd onder de MIT-licentie.
Zie het bestand `LICENSE` voor details.

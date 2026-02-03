# Ticket 02 — Add UUID to all nodes (file/folder) in structures

## Doel

Bestanden/mappen betrouwbaar volgen over rename/move. Elke node krijgt een stabiele `id` (UUID).

## Scope

- Structure nodes krijgen veld: `id: string`
- Bij het aanmaken van files/folders wordt automatisch een UUID gezet.
- Bij clone/copy gedrag:
    - copy -> nieuwe UUID
    - move/rename -> zelfde UUID (node blijft identiek)
- Helpers:
    - `findNodeById(root, id)`
    - `getPathById(root, id)` (handig voor feedback en checks)

## Succescriteria

- Elke node in startstructuur heeft `id`.
- Renames/moves behouden `id`.
- Export + import behouden ids.

## Codex prompt

Voeg UUID ondersteuning toe aan de datastructuur voor files/folders.

1. Zoek de node-structuur (file/folder objecten).
2. Voeg `id` toe en zorg dat creatie/insert automatisch een UUID genereert.
3. Update alle codepaden die nodes maken/clonen/copyen zodat copy een nieuw id krijgt, maar move/rename hetzelfde id behoudt.
4. Voeg helpers `findNodeById` en `getPathById`.
5. Update import/export om id te bewaren. Backwards compat: als id ontbreekt bij import, genereer één.

Let op: géén externe libraries; gebruik `crypto.randomUUID()` als beschikbaar, met fallback.

## Commit message

feat(structure): add uuid ids to file/folder nodes

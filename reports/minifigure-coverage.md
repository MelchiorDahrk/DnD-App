# Minifigure coverage

Source inventories: 17365. Selectable parts: 4829 + standard legs. Presets: 396 (106 with Rebrickable identities).

The machine-readable report separates verified missing geometry, skipped builds, legacy hidden parts, unused selectable parts, assemblies requiring review, and unverified identifier mappings. Unmapped IDs are never asserted to be absent geometry.

## Dungeons & Dragons CMF 71047

| Figure | Available inventory components | Status |
| --- | ---: | --- |
| Dwarf Barbarian (fig-015443) | 2/5 | unavailable |
| Gith Warlock (fig-015444) | 1/5 | unavailable |
| Tiefling Sorcerer (fig-015445) | 0/5 | unavailable |
| Dragonborn Paladin (fig-015446) | 0/5 | unavailable |
| Halfling Druid (fig-015447) | 1/5 | unavailable |
| Aarakocra Ranger (fig-015448) | 1/4 | unavailable |
| Mind Flayer (fig-015449) | 0/3 | unavailable |
| Strahd von Zarovich (fig-015450) | 1/5 | unavailable |
| Elf Bard (fig-015451) | 0/5 | unavailable |
| The Lady of Pain (fig-015452) | 1/5 | unavailable |
| Szass Tam (fig-015453) | 0/5 | unavailable |
| Tasha the Witch Queen (fig-015454) | 0/4 | unavailable |

See [minifigure-coverage.json](minifigure-coverage.json) for every component identifier, description, source figure, reason, technical restriction and ranked opportunity.

## Refresh

`npm run refresh:portraits` downloads both LDraw libraries, rebuilds geometry, updates theme and verified mapping snapshots, imports the public bulk inventories, builds presets and cached previews, and writes this report. Ordinary `npm run build` reuses local and checked-in snapshots. Targeted API imports remain available with `REBRICKABLE_API_KEY`.

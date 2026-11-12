# Guided level-up

**Level up** opens a review before changing the character. The old HP-only dialog has been replaced. Cancel and failed validation leave the character untouched; a successful confirmation saves all choices together and opens the existing portrait celebration.

## Included progression

| Area | Bundled coverage |
| --- | --- |
| Classes | All 20 levels of all 12 2024 PHB classes, plus the earlier-book Artificer |
| Subclasses | 48 2024 subclasses, 4 Artificer subclasses, and 67 unreplaced earlier-rules subclasses, with named unlocks at their progression levels |
| Species | 10 core species and their lineages; Half-Elf/Half-Orc references; 20 additional earlier species/lineage magic progressions |
| Spells | All 391 distinct 2024 PHB spells, plus 6 unreplaced supplemental spell references; class membership comes from the complete licensed PHB lists |
| Feats | The existing 75 core feats, with Magic Initiate list variants, plus 23 unreplaced earlier feats |
| Choices | ASIs, Epic Boons, skill proficiency/Expertise, Fighting Styles, maneuvers, Metamagic, invocations, additional masteries, selected subclass choices, Savant/Magical Discoveries, Spell Mastery/Signature Spells, Mystic Arcanum, and feat spells/training |

Class tables determine cantrips, preparation capacity, spell tiers and slots. The generator verifies all 240 core class-level rows against the publisher’s class tables. This corrects errors in the community SRD JSON, including Wizard preparation capacity (25 at level 20). Full PHB spell lists also restore entries and class memberships missing from the free rules, including Word of Radiance, Sorcerous Burst, and Cleric/Wizard access to Toll the Dead.

Known casters can replace one spell and casters can replace one cantrip through the review. Prepared casters can unprepare earlier spells to make room. Wizards can learn their two new spellbook spells without preparing them; Savant additions are separate. Always-prepared subclass/class spells and lineage spells are added separately from the ordinary allowance. Free lineage castings have resources. Spell choices are filtered by class and available spell tier; invocations and feats also show a reminder to review book-specific prerequisites.

Warlocks use Pact Magic slot progression, retain spent slots when the slot tier changes, and recover Pact slots on Short or Long Rests. Mystic Arcanum asks for a spell at levels 11/13/15/17 and creates a separate free-casting resource, without granting level 6–9 Pact slots. Eldritch Knights and Arcane Tricksters use one-third casting and Intelligence.

## Edition precedence

The scope is the **2024 PHB rules with unreplaced 2014-rules options**. “2014” labels the rules family, including its later supplements, rather than the publication year of every option. Later revised books are outside this edition policy.

Renamed replacements map to their current version: Totem Warrior → Wild Heart, old Monk ways → corresponding Warriors, Aberrant Mind/Clockwork Soul → their Sorcery versions, old Wizard school names → Abjurer/Diviner/Evoker/Illusionist, and other revised subclasses. Earlier subclasses gain their initial features at level 3. Legacy Cleric Divine Strike/Potent Spellcasting entries are suppressed in favor of the 2024 class’s Blessed Strikes choice. Expanded legacy Warlock spell lists are eligibility additions rather than automatically prepared spells. Spell aliases include Branding Smite → Shining Smite and Feeblemind → Befuddlement, plus named/SRD spell aliases.

The process does not convert a saved sheet’s existing narrative rules, attack formulas, equipment or origins. Existing custom text and explicit casting overrides remain player data.

## Save behavior and practical limits

Matching resource limits, dice and recovery values can be updated in the review. Spent uses are retained; values differing from the previous preset are preserved. ASIs and selected feat ability increases are checked against their caps. Constitution changes apply to HP for every level; Dwarven Toughness, an existing/new Tough feat, and the Barbarian/Monk capstones are included. Proficiency bonus remains derived from total level.

This remains a **single-class journal**, not a complete rules adjudicator. Named supplemental features are brief references, not copied book rules. Many feature effects—damage, armor, movement, languages, situational bonuses, forms, resistances and special prerequisites—still require the existing sheet editors or table adjudication. Legacy setting options, special feat effects and every supplemental spell are not exhaustively automated. Additional book/table feature names and `level | spell name` entries can be recorded inside the level-up dialog rather than postponing them until afterward. Spell reference entries explicitly say when casting details must be filled from the book.

Missing older proficiencies cannot be reconstructed reliably from a flat imported skill list. Basic missing choices are offered; if too few eligible options are recorded, the player can explicitly save a **Pending choice** feature to complete from their book. The dialog never silently invents missing selections. An optional earlier-features section offers catch-up entries; choose only alternatives the character actually has.

No required save migration: existing version 2 characters remain valid. Optional feature provenance, spell origins, Pact Magic, terrain and Genie metadata travel in backups and are validated. The progression engine validates the resulting character before committing it. New modules and the generated data ship in the static build and offline service-worker cache.

## Validation and regeneration

`npm test` covers every core class level, every built-in subclass’s later unlocks, source replacements, legacy lineage magic, explicit/atomic choices, resource expenditure, ASI/Constitution HP, feat choices, Wizard learning/preparation, spell replacement and save round trips. `npm run test:level-up` checks the browser flow, subclass refresh, class and lineage spells, Mystic Arcanum, cancellation, 320/390 px layouts and offline use. Set `BROWSER_PATH` if Chromium is not installed at a standard path.

The checked-in `progression-data.js` requires no runtime network access. Regenerate it with `node scripts/build-progression-data.mjs --download`; `npm run build:progression` uses the cached source inputs in `.tmp/rules`. Review regenerated facts before committing.

## Sources and attribution

- [Publisher’s 2024 class progression tables](https://www.dndbeyond.com/sources/dnd/br-2024/character-classes) and [species rules](https://www.dndbeyond.com/sources/dnd/br-2024/character-origins).
- Licensed 2024 PHB class lists, for example [Wizard](https://roll20.net/compendium/dnd5e/Classes%3AWizard?expansion=32231) and [Cleric](https://roll20.net/compendium/dnd5e/Classes%3ACleric?expansion=32231). Only list facts are adapted from non-SRD material.
- [D&D Beyond compatibility guidance](https://www.dndbeyond.com/changelog) and [Cleric compatibility discussion](https://www.dndbeyond.com/posts/1767-2024-cleric-vs-2014-cleric-whats-new).
- [5e-bits SRD data](https://github.com/5e-bits/5e-database), with publisher tables taking precedence for progression facts.

This work includes material from the System Reference Document 5.2/5.2.1 and System Reference Document 5.1 by Wizards of the Coast LLC, available at [D&D SRD](https://www.dndbeyond.com/srd). These SRDs are licensed under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/legalcode). SRD spell text is included; other book options are names, mechanical list facts and brief references.

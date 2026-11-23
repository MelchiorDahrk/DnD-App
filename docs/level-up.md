# Guided level-up

**Level up** opens a review before changing the character. The old HP-only dialog has been replaced. Cancel and failed validation leave the character untouched; a successful confirmation saves all choices together and opens the existing portrait celebration.

## Multiclass advancement

Open **Level up** and select **Class to advance**. Choose an existing class to increase its level or choose a class under **Add a class**. An unavailable class lists the ability scores you need. The 2024 prerequisites apply to the new class and to each class you already have. The review shows the new class breakdown, total level, Hit Die, suggested HP, and any training or choices. A Fighter 5 / Rogue 1 advancing in Rogue becomes Fighter 5 / Rogue 2 at character level 7.

The class you advance determines your HP die, subclass unlocks, class features, feat and ASI opportunities, and the scaling of its resources. A new class grants its multiclass proficiencies and its level 1 features. Starting equipment, first-level maximum HP, and starting saves belong to character creation. XP thresholds, proficiency bonus, species unlocks, and Constitution adjustments use total character level. The sheet shows the highest applicable Extra Attack count, including a separate count for a qualifying pact weapon. Cleric and Paladin Channel Divinity have separate pools.

Hit Dice of the same size share a pool. In **Short Rest**, choose how many Dice of each size to spend. A qualifying **Long Rest** restores all pools. Older saves with a single remaining count keep the same total. The app assigns their legacy spent dice to the primary class’s die size first, then the other recorded sizes in class order. Use **Edit combat stats** to correct the distribution.

Each spellcasting class learns and prepares spells at its own level. A newly added Wizard chooses six spellbook spells and prepares four. Higher shared slots can upcast eligible spells. Shared progression adds full caster levels, rounds up Paladin, Ranger and legacy Artificer half levels, and rounds down supported one-third caster levels. A sole Spellcasting class uses its own table. Pact Magic refreshes separately and can cast eligible spells from any class; shared slots can also cast Warlock spells. **Flexible Casting** can spend either eligible pool to restore Sorcery Points.

The Spellbook keeps a single card per spell. On a multiclass sheet, use **Edit spell** to review or adjust each class’s preparation. The **Cast spell** dialog shows available slots, the source class, and its attack bonus and save DC. Arcane Recovery uses Wizard level and restores shared spell slots.

## Included progression

| Area | Bundled coverage |
| --- | --- |
| Classes | All 20 levels of all 12 2024 PHB classes, plus the earlier-book Artificer |
| Subclasses | 48 core 2024 subclasses, 16 from Heroes of Faerûn and Arcana Unleashed, 4 Artificer subclasses, and unreplaced earlier-rules subclasses, with named unlocks at their progression levels |
| Species | 10 core species and their lineages, Aarakocra, Half-Elf and Half-Orc, and additional earlier species magic progressions |
| Spells | All 391 distinct 2024 PHB spells, plus 6 unreplaced supplemental spell references; class membership comes from the complete licensed PHB lists |
| Feats | 269 categorized published feat presets, including supplemental books and digital releases, with prerequisite chains and source labels. [Sources and limits](feats.md). Dark Gifts are campaign references outside ordinary ASI choices. |
| Choices | ASIs, Epic Boons, skill proficiency/Expertise, Fighting Styles, maneuvers, Metamagic, invocations, additional masteries, selected subclass choices, Savant/Magical Discoveries, Spell Mastery/Signature Spells, Mystic Arcanum, and feat spells/training |

Class tables determine cantrips, preparation capacity, spell tiers and slots. The generator verifies all 240 core class-level rows against the publisher’s class tables. This corrects errors in the community SRD JSON, including Wizard preparation capacity (25 at level 20). Full PHB spell lists also restore entries and class memberships missing from the free rules, including Word of Radiance, Sorcerous Burst, and Cleric/Wizard access to Toll the Dead.

Level-up feats are filtered by species/lineage, level, existing feats, and the 2024 ability, armor/shield training, and Spellcasting/Pact Magic feature prerequisites. Casting feats recognize Eldritch Knight and Arcane Trickster only for their corresponding classes; species spells alone do not satisfy a class casting feature prerequisite. Known subclasses belonging to another class are rejected. Blank training fields use the class defaults; recorded training takes precedence. Squat Nimbleness excludes known Medium non-Dwarf species and requires an explicit Small-size confirmation for variable-size or custom species, since the sheet does not store a chosen size. The selected feat has a reference link before confirmation. Additional choices within a feat, such as invocation prerequisites for Eldritch Adept, still require the linked book.

Use **Find a feat** above the feat dropdown to search eligible choices by name, category, source, or description. Search supports multiple words and ignores case, accents, and punctuation. Categories and source labels stay visible. Filtering keeps your selected feat, ability allocation, and other form edits; clearing the search restores the full eligible list. The search also survives changes to the selected feat, subclass, or species.

The ability-increase controls share the feat’s point allowance and enforce score caps immediately. ASI permits +2 to one score or +1 to each of two scores; a feat granting +1 shares one point across its allowed abilities. Switching feats clears the previous ability allocation. The saved portrait stays visible during the level-up celebration, with its centered star behind the avatar and no duplicate floating caption.

Known casters can replace one spell and casters can replace one cantrip through the review. Prepared casters can unprepare earlier spells to make room. Wizards can learn their two new spellbook spells without preparing them; Savant additions are separate. Always-prepared subclass/class spells and lineage spells are added separately from the ordinary allowance. Free lineage castings have resources. Spell choices are filtered by class and available spell tier; invocations and feats also show a reminder to review book-specific prerequisites.

Warlocks use Pact Magic slot progression, retain spent slots when the slot tier changes, and recover Pact slots on Short or Long Rests. Mystic Arcanum asks for a spell at levels 11/13/15/17 and creates a separate free-casting resource, without granting level 6–9 Pact slots. Eldritch Knights and Arcane Tricksters use one-third casting and Intelligence.

## Edition precedence

Class and subclass progression uses the **2024 PHB rules, published supplemental subclasses, and unreplaced 2014-rules options**. “2014” labels the rules family, including its later supplements, rather than the publication year of every option. The feat catalog additionally includes published current supplements, with source labels and current versions taking precedence; this does not revise class or subclass progression.

Renamed replacements map to their current version: Totem Warrior → Wild Heart, old Monk ways → corresponding Warriors, Aberrant Mind/Clockwork Soul → their Sorcery versions, old Wizard school names → Abjurer/Diviner/Evoker/Illusionist, and other revised subclasses. Earlier subclasses gain their initial features at level 3. Legacy Cleric Divine Strike/Potent Spellcasting entries are suppressed in favor of the 2024 class’s Blessed Strikes choice. Expanded legacy Warlock spell lists are eligibility additions rather than automatically prepared spells. Spell aliases include Branding Smite → Shining Smite and Feeblemind → Befuddlement, plus named/SRD spell aliases.

The process does not convert a saved sheet’s existing narrative rules, attack formulas, equipment or origins. Existing custom text and explicit casting overrides remain player data.

## Save behavior and practical limits

Matching resource limits, dice and recovery values can be updated in the review. Spent uses are retained; values differing from the previous preset are preserved. ASIs and selected feat ability increases are checked against their caps. Constitution changes apply to HP for every level; Dwarven Toughness, an existing/new Tough feat, and the Barbarian/Monk capstones are included. Proficiency bonus remains derived from total level.

Use **Character Details → Additional classes** to review the build, copy an existing character, or apply a DM override. Manual level edits update derived totals, Hit Dice limits, and automatic slots. They preserve recorded HP, features, proficiencies, and spells. Use **Spellbook → Edit slots** for slot maximums and a primary casting ability override.

Named supplemental features include brief references. Apply situational bonuses, action and damage limits, cantrip damage scaling, some feat and invocation prerequisites, and untracked book or table effects during play. The level-up review accepts additional feature names and `level | spell name` entries. Use the spell editor to complete those spell entries and assign their source classes.

Missing older proficiencies cannot be reconstructed reliably from a flat imported skill list. Basic missing choices are offered; if too few eligible options are recorded, the player can explicitly save a **Pending choice** feature to complete from their book. The dialog never silently invents missing selections. An optional earlier-features section offers catch-up entries; choose only alternatives the character actually has.

Existing version 2 characters, backups, and private cloud sheets remain valid. Optional Hit Dice pools, spell origins, feature provenance, Pact Magic, terrain, and Genie metadata travel with the character. Live cloud state includes the remaining Hit Dice per size. The progression engine validates the completed sheet before committing it.

## Validation and regeneration

`npm test` covers core and subclass advancement, multiclass combinations, rollback, rest recovery, shared slots and Pact Magic, spell origins, and save and cloud round trips. `npm run test:level-up` checks class selection and advancement, spell preparation and casting, mixed Hit Dice, manual class edits, 320/390 px layouts, and offline use. Set `BROWSER_PATH` to a Chromium executable if needed. After building, set `LEVEL_TEST_PATH=/dist/` to test the packaged site.

The checked-in `progression-data.js` requires no runtime network access. Regenerate it with `node scripts/build-progression-data.mjs --download`; `npm run build:progression` uses the cached source inputs in `.tmp/rules`. Review regenerated facts before committing.

## Sources and attribution

- [Heroes of Faerûn subclasses](https://www.dndbeyond.com/sources/dnd/frhof) and [Arcana Unleashed subclasses](https://www.dndbeyond.com/sources/dnd/au).

- [Publisher’s 2024 class progression tables](https://www.dndbeyond.com/sources/dnd/br-2024/character-classes) and [species rules](https://www.dndbeyond.com/sources/dnd/br-2024/character-origins).

- [2024 multiclassing, Hit Dice, and Spellcasting rules](https://www.dndbeyond.com/sources/dnd/br-2024/creating-a-character#Multiclassing).
- [2024 feat prerequisite rules](https://www.dndbeyond.com/sources/dnd/br-2024/feats) and licensed PHB feat entries, including [War Caster](https://roll20.net/compendium/dnd5e/Feats%3AWar%20Caster?expansion=32231&iframe=true) and [Shield Master](https://roll20.net/compendium/dnd5e/Feats%3AShield%20Master?expansion=32231&iframe=true).
- Licensed 2024 PHB class lists, for example [Wizard](https://roll20.net/compendium/dnd5e/Classes%3AWizard?expansion=32231) and [Cleric](https://roll20.net/compendium/dnd5e/Classes%3ACleric?expansion=32231). Only list facts are adapted from non-SRD material.
- [D&D Beyond compatibility guidance](https://www.dndbeyond.com/changelog) and [Cleric compatibility discussion](https://www.dndbeyond.com/posts/1767-2024-cleric-vs-2014-cleric-whats-new).
- [5e-bits SRD data](https://github.com/5e-bits/5e-database), with publisher tables taking precedence for progression facts.

This work includes material from the System Reference Document 5.2/5.2.1 and System Reference Document 5.1 by Wizards of the Coast LLC, available at [D&D SRD](https://www.dndbeyond.com/srd). These SRDs are licensed under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/legalcode). SRD spell text is included; other book options are names, mechanical list facts and brief references.

# Equipment and character option catalog

The catalog follows the app’s 2024 rules scope. It is bundled with the static app, included in the build and offline cache, and does not need a network request to browse or fill a preset.

Rules links prefer [the 2024 Wikidot wiki](https://dnd2024.wikidot.com/) and [the earlier 5e wiki](https://dnd5e.wikidot.com/) according to each option’s edition. Feats and spells open their individual pages, including the selected feat during level-up. Known older D&D Beyond rules links in saved characters resolve to matching wiki references when displayed; backups and custom URLs are preserved. The free publisher Basic Rules remain the fallback for general rules without a wiki page.

`reference-links.js` centralizes resolution using the public paths in `reference-pages.js`. Refresh those indexes with `npm run build:references -- --download`, or rebuild from the ignored `.tmp/reference-pages/` cache without `--download`. Rebuild bundled spell links with `npm run build:progression` after changing reference resolution. Run `npm run test:references` and `npm run test:level-up` to check links in the browser.

## Coverage

| Dropdown | Included data |
| --- | --- |
| Equipment | 207 entries: 38 weapons; 13 armor/shields; adventuring supplies and spellbook; 7 equipment packs; 23 tools/kits; 10 instruments; 4 gaming sets; 5 ammunition bundles; 11 focuses; 9 tack/drawn-vehicle entries; 8 mounts; 7 ships/airships |
| Class | 12 core classes and supplemental Artificer; hit die, primary abilities, saves, armor/weapon training, skill choices, level 1 feature summary |
| Species/race | 10 core species plus Elf, Gnome, and Tiefling lineage variants; size, speed, senses, trait summary |
| Background | All 16 core backgrounds; ability choices, skill/tool proficiencies, Origin feat |
| Subclass | 4 per core class, filtered by class; 4 supplemental Artificer subclasses; level and short specialization summary |
| Origin feat | All 10 core Origin feats; Magic Initiate has separate Cleric, Druid, and Wizard options |
| Features & resources | 544 presets: 183 class entries, 127 subclass references/features, 72 species/lineage traits, 77 feat options (75 core feats with three Magic Initiate lists), 20 maneuvers, 10 Metamagic options, 28 invocations, 23 earlier feats, and 4 custom templates |

The equipment editor has a type dropdown, text search, and grouped item dropdown. The attack editor has a searchable weapon dropdown. The feature editor has a searchable, categorized feature/resource catalog. The compendium also exposes the full feature catalog.

## Feature and resource selection

The feature picker starts with **For this character**, matching recorded class, subclass, species/lineage, and current level. **This character · all levels** includes future features. **All options · every character** exposes the complete catalog for multiclass characters, earlier books, and house rules. Categories and multiword search combine with the selected scope. Species families recognize Drow/High/Wood Elf, Forest/Rock Gnome, Tiefling lineages, and earlier Hill Dwarf names. Suggestions are guidance, not enforced eligibility: feats may have ability, training, pact, spell, or other prerequisites that the player must check.

Coverage includes the 12 core classes, supplemental Artificer references, every subclass already supported by the character editor, additional individual subclass features/resources (including the default party’s Battle Master, Assassin, and supplemental Beast), the 10 species with lineage magic, all four core feat categories, Battle Master maneuvers, Metamagic, and Eldritch Invocations. Subclass and non-SRD entries are brief references, not complete rules progressions or full book text. Unlisted supplements and homebrew use the editable fields or custom templates. Supplemental Artificer/Beast entries are labeled separately; review your table’s book/version.

Selecting a preset fills name, notes, reference, maximum uses/points, refresh rule, Short Rest recovery, and dice where supported. Known resources scale at selection: Second Wind, Rage, Bardic Inspiration, Wild Shape, Channel Divinity, Focus, Sorcery Points, Superiority Dice, Sneak Attack, Lay On Hands, and several species/subclass resources. **Class level for this preset** can be adjusted for multiclass characters; proficiency-based species/feat resources still use total character level. Other-class presets start at their listed minimum level. The feature editor creates snapshots. The guided [level-up review](level-up.md) now offers matching resource updates, progression choices, spells, slots, and ability increases before committing. Direct character edits do not rebuild saved features. Damage/healing and special effects remain explicit.

Shared abilities such as maneuvers, Cutting Words, Divine Spark, and Flurry of Blows do not receive independent charges. Their descriptions point to the existing shared pool; spending a use there remains explicit. Larger resources use compact spend/restore controls instead of hundreds of dots. **Set amount** opens the editor’s spent-use field for bulk adjustments. Features support 0–999 maximum uses/points, including a level 20 Paladin’s 100-point Lay On Hands pool; zero means no independent limit. Existing version 2 saves keep their fields and need no migration.

Opening an editor or changing search/category/scope preserves the current fields. Choosing a preset explicitly replaces the preset fields and keeps spent uses up to the new maximum. Choosing the blank/custom option keeps the current values.

## Applying choices

- Choosing equipment fills the item fields and includes its price and rules in the saved description. Adding or equipping an item does not spend coins or change AC, attacks, speed, or proficiencies.
- Weight is per inventory unit. Ammunition is one bundle, not one arrow/bolt/bullet/needle. Each bundle’s piece count is stated in its notes. Packs include their contents in the listed total weight; adding their contents separately would double-count them.
- Negligible weights use zero. A waterskin’s listed weight is full. Mounts and large ships use zero carried weight, with capacity/vehicle statistics in their notes. A rowboat weighs 100 lb. if actually carried; edit its weight in that case. Tack and drawn vehicles retain their physical weights.
- Weapon presets select Strength or Dexterity using the weapon’s ranged/finesse properties. Thrown melee weapons use Strength unless they have Finesse. Reach and thrown/ranged distances are copied into the range field. Recorded training suggests proficiency, and Heavy suggests disadvantage if the corresponding ability score is below 13. Review custom training and special features. Damage is explicit and does not change when ability scores later change. Mastery effects remain manual.
- Fixed damage (for example a blowgun’s 1 + Dexterity modifier) is saved as a nonnegative integer. The dice roller and backup validator accept fixed amounts from 0 to 9999. Fixed amounts do not roll dice and cannot use advantage/disadvantage.
- A new character receives class hit die, save proficiencies, armor/weapon training, first-level HP, unarmored AC, and species speed/senses. Skill selections, background increases, species traits, feat effects, spell slots/spells, and higher-level HP are player-managed. For example, Dwarven Toughness and the Tough feat require adjusting maximum HP; Alert requires adjusting initiative.
- Selecting a class refreshes the subclass dropdown and clears the old subclass selection. Existing custom/earlier-book species, background, and subclass names are preserved when opening and saving the editor. Changing character details does not replace existing combat stats, proficiencies, features, spells, or equipment.
- Opening an item, attack, or feature editor preserves its current fields. Only an explicit preset selection replaces those fields. Filtering a list or choosing its custom-entry option keeps the current fields available to edit.
- Origin feats are saved as ordinary features with their summary. Lucky starts with proficiency-bonus uses per Long Rest; Magic Initiate starts with one free casting per Long Rest. Review these totals as the character levels. Other feat effects remain manual.

Catalog choices use existing version 2 character fields and descriptions. There is no save migration, no new required backup fields, and no bulk rewrite of saved inventory. Tests round-trip every equipment, weapon, and feature preset through the backup validator, exercise class/species/level filtering and resource recovery, and check that shared options do not add extra pools. `npm run test:features` runs browser checks for filtering, preserved edits, scaling, large point pools, mobile layout, and offline catalog loading.

## References

- [SRD 5.2.1](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf), especially Classes, Character Origins, Feats, and Equipment.
- [Official 2024 Basic Rules: Equipment](https://www.dndbeyond.com/sources/dnd/br-2024/equipment).
- [Official 2024 Basic Rules: Character Origins](https://www.dndbeyond.com/sources/dnd/br-2024/character-origins).
- [Player’s Handbook (2024)](https://www.dndbeyond.com/sources/dnd/phb-2024) for additional core-book options. Some linked rules require access. Subclass entries are short specialization summaries, not complete feature progressions.

Artificer is supplemental and is not a 2024 Player’s Handbook class. Its entries are marked as supplemental in the class summary; use your table’s chosen rules version. Custom entries support earlier-book options and homebrew.

This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode. Rules are summarized and adapted for this tracker.

# Equipment and character option catalog

The catalog follows the app’s 2024 rules scope. It is bundled with the static app, included in the build and offline cache, and does not need a network request to browse or fill a preset.

## Coverage

| Dropdown | Included data |
| --- | --- |
| Equipment | 207 entries: 38 weapons; 13 armor/shields; adventuring supplies and spellbook; 7 equipment packs; 23 tools/kits; 10 instruments; 4 gaming sets; 5 ammunition bundles; 11 focuses; 9 tack/drawn-vehicle entries; 8 mounts; 7 ships/airships |
| Class | 12 core classes and supplemental Artificer; hit die, primary abilities, saves, armor/weapon training, skill choices, level 1 feature summary |
| Species/race | 10 core species plus Elf, Gnome, and Tiefling lineage variants; size, speed, senses, trait summary |
| Background | All 16 core backgrounds; ability choices, skill/tool proficiencies, Origin feat |
| Subclass | 4 per core class, filtered by class; 4 supplemental Artificer subclasses; level and short specialization summary |
| Origin feat | All 10 core Origin feats; Magic Initiate has separate Cleric, Druid, and Wizard options |

The equipment editor has a type dropdown, text search, and grouped item dropdown. The attack editor has a searchable weapon dropdown. The feature editor has a searchable Origin feat dropdown. The compendium has a browse category and entry dropdown with the same stat previews.

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

Catalog choices use existing version 2 character fields and descriptions. There is no save migration, no new required backup fields, and no bulk rewrite of saved inventory. Tests round-trip every equipment and weapon preset through the existing backup validator.

## References

- [SRD 5.2.1](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf), especially Classes, Character Origins, Feats, and Equipment.
- [Official 2024 Basic Rules: Equipment](https://www.dndbeyond.com/sources/dnd/br-2024/equipment).
- [Official 2024 Basic Rules: Character Origins](https://www.dndbeyond.com/sources/dnd/br-2024/character-origins).
- [Player’s Handbook (2024)](https://www.dndbeyond.com/sources/dnd/phb-2024) for additional core-book options. Some linked rules require access. Subclass entries are short specialization summaries, not complete feature progressions.

Artificer is supplemental and is not a 2024 Player’s Handbook class. Its entries are marked as supplemental in the class summary; use your table’s chosen rules version. Custom entries support earlier-book options and homebrew.

This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode. Rules are summarized and adapted for this tracker.

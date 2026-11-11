# Session character sheet coverage

The supplied photograph is the reference for field coverage. Every printed section and type of handwritten addition has a place in the app. **Scan a sheet**, available from the character switcher and Settings, now transcribes photos through an optional online scan service and opens an editable review before creating a new character. Ambiguous handwriting is flagged; original photos can be expanded for comparison. See [scanning setup](../README.md#sheet-scanning-setup).

| Paper sheet | App location and behavior |
| --- | --- |
| Character name, player name, class and level, background, species, alignment, XP | **Edit character details** on the hero card. Includes subclass and campaign. Set level and XP directly when copying a sheet; **Level up** adds HP when advancing during play. |
| Six ability scores and modifiers | **Ability scores**. Edit total scores; modifiers update and can be rolled. |
| Heroic Inspiration | Toggle in **Ready for anything**; spend it to reroll one die immediately after rolling it, keeping the new result. Rerolls are manual. |
| Proficiency bonus | Calculated from level in **Skills & saving throws**. |
| Six saving throws and proficiency circles | Toggle proficiency and roll each saving throw. |
| All 18 skills and proficiency circles | Toggle untrained/proficient/expertise and roll each skill. |
| Armor class, including handwritten shield bonus | Enter total AC in **Edit stats**; record base armor and shield adjustments in **Armor, shield & defense notes**, shown below combat stats. Equipping an inventory item does not automatically change AC. |
| Initiative | Dexterity modifier plus editable **Initiative bonus** in **Edit stats**; tap initiative to roll the same total. |
| Speed | Editable walking speed in **Edit stats**; other movement modes can be recorded in senses or features. |
| Maximum, current, and temporary HP | **Edit stats** sets all three directly. **Harm/Heal** applies changes and temporary HP absorption. |
| Hit dice total, size, remaining | **Senses & essentials** shows remaining / character level and die size. **Edit stats** changes die size and remaining dice. **Short rest** spends dice. |
| Death save success and failure circles | Shown at 0 HP; manually set counters or roll death saves. |
| Weapon name, attack bonus, damage dice/type | **Attacks & actions**. Each attack has an ability, proficiency toggle, additional attack bonus, damage formula, type, range, and notes for versatile weapons or special item effects. |
| Passive Wisdom (Perception) | **Senses & essentials** calculates 10 + Perception skill bonus + editable passive adjustment. This supports the photographed sheet's separately recorded passive value. |
| Other proficiencies and languages | Dedicated **Proficiencies & languages** panel: languages, armor, weapons, tools and other proficiencies. |
| CP, SP, EP, GP, PP | **Inventory → coin summary** or **In your pack → Manage**. All five denominations are editable and saved independently. |
| Equipment, arrows, rations, packs, tools, potions, magic items | **Inventory** stores quantity, category, equipped state, weight, item notes, and reference link. Open an item to read/edit its full notes. Consumables can be spent. |
| Personality traits, ideals, bonds, flaws | Four dedicated fields in **Personality & backstory**, with multiline text visible on the sheet. |
| Features and traits, including species traits and fighting style | **Features & resources** stores full text, optional reference, uses, and short/long/manual refresh. |

## Handwritten feature examples

- **Second Wind:** a 2024 feature with 2 uses, long-rest refresh, 1 use regained on a Short Rest, and `1d10+3` at Fighter level 3. **Use & roll** spends the use. Apply the resulting healing with **Heal**; update the formula when the character's level changes.
- **Action Surge:** a feature with 1 use and short-rest refresh; tap its use square when spent.
- **Battle Master:** a shared **Superiority dice** feature with 4 uses, `1d8`, and short-rest refresh. Put maneuvers such as Feinting Strike and Riposte in its notes or separate unlimited features. Roll the shared pool to spend one die; restoring a square corrects accidental use.
- **Superior darkvision:** record `120 ft.` in **Senses**. Other species abilities and fighting-style bonuses can be described in features. Adjust attack bonuses explicitly for equipment or fighting style.
- **Dancing Lights:** add a cantrip in **Spellbook**. Scrolls and item-based spells can be cast using **No slot (ritual / item / feature)**, then decrement the relevant item in inventory.
- **Magic items and potion effects:** item descriptions preserve special rules; temporary ability changes are entered in ability scores, and temporary HP is entered in health controls.

The tracker uses 2024 core rest rules: all Hit Dice return on a Long Rest, which normally removes one Exhaustion level. Exhaustion applies −2 per level to sheet D20 Tests and reduces walking speed by 5 feet per level. Record Weapon Mastery in attack notes and Origin feats in Features. The photographed sheet is an input example; older handwritten rules text is preserved for the player to review against the 2024 books.

All fields are saved locally and included in backups. Older version 1 saves receive only missing field defaults; existing scores, HP, items, notes, spells, attacks, and feature counters remain intact.

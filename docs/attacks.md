# Guided attacks

Choose **Roll to hit**, review the circumstances, then roll. Target AC and distance are optional. Without AC, confirm Hit, Critical hit, or Miss with the DM. The damage button on the sheet opens damage directly, with a critical-hit toggle.

Once a hit is confirmed, the dialog leads with **Roll damage** and then the damage result. Damage totals come into view automatically when their dice finish rolling. The accuracy total stays below damage in a compact **To hit** footnote; expand it for the roll breakdown, Heroic Inspiration rerolls, or a feature's critical-hit override. Misses keep the accuracy roll visible.

The attack editor has **Weapon rules** for the base weapon and **Unlocked mastery** for the character's actual choice. These are separate from proficiency. Custom names can retain a base weapon; spells and natural attacks can use Custom. A catalog weapon never unlocks mastery by itself. Old saves recognize exact weapon choices already recorded in a Weapon Mastery feature; all old saves still load without migration. Explicit None takes precedence over those notes.

## Advantage and disadvantage

The two **Situational** checkboxes represent circumstances the sheet cannot determine: Help, Vex against the same target, visibility, target conditions, chosen feature triggers, and DM rulings. Automatic rules run independently of these boxes. A concise summary beside **Roll to hit** updates as circumstances change, such as **Disadvantage: Poisoned** or **Normal: Advantage and disadvantage cancel**. Any advantage and any disadvantage cancel, regardless of how many sources grant either.

Expand **Advanced: Advantage & Disadvantage** to inspect automatic sources for the current attack: saved attack mode, Heavy requirements, applicable tracked conditions, long range, and nearby enemies. Uncheck an individual source to ignore just that calculation. Disabled sources remain listed. **Restore automatic defaults** re-enables all sources while preserving situational selections, distance, cover, and feature confirmations. The section stays hidden when nothing relevant applies. The result's roll details retain contributing sources, manual selections, disabled sources, and relevant feat exceptions.

Overrides last only for this attack; **Another attack**, follow-up attacks, and reopening the dialog start with default calculations. They do not change the saved attack, conditions, feats, or backup format. A saved roll mode remains its own source even if an older weapon preset prefilled it because of Heavy; the app cannot distinguish that default from an intentional saved choice.

### Recorded features and 2024 scope

- **Sharpshooter** removes long-range and nearby-enemy disadvantage for attacks with **Ranged weapons**, including Darts. Throwing a melee weapon such as a Dagger does not qualify for those benefits. Heavy and condition penalties still apply, and maximum range still blocks targeting.
- **Crossbow Expert** removes nearby-enemy disadvantage for Hand, Heavy, and Light Crossbows. It does not grant that benefit to bows, firearms, or spells. Long-range penalties still apply. Its crossbow Loading and free-hand exceptions are reflected in weapon reminders.
- **Spell Sniper** needs an attack with a spell. Custom attacks do not record that distinction, so a character with the feat can explicitly confirm **this attack is with a spell** in Advanced when making a ranged Custom attack. That confirmation removes only nearby-enemy disadvantage. Known base weapons are not automatically treated as spells; unusual interactions can use individual source overrides. Spell range and cover benefits remain table decisions using the saved range and cover controls.

Only features actually recorded on the sheet qualify. A current catalog reference identifies a feat even after renaming; older entries without references recognize its exact name, optionally marked `(Feat)`, `(General feat)`, `(2024)`, or `(2024 feat)`. Explicit earlier-edition references do not grant 2024 feat behavior. Class and level alone never imply a feat.

Conditional features such as Reckless Attack, Steady Aim, Assassinate, Precise Hunter, Mounted Combatant, and Innate Sorcery are not activated merely because the character has them. Confirm their action costs, timing, targets, ability requirements, and other triggers at the table, then select situational advantage or disable the specific source a feature negates. Blindsight, Invisible, and fear immunity during Rage also need information the sheet cannot establish. Frightened disadvantage appears only after confirming the fear source is in sight. Nearby-enemy circumstances appear only for ranged attacks that can suffer that penalty. Rules already negated by a feat have no override checkbox.

## Mastery follow-ups

| Mastery | In the attack dialog |
| --- | --- |
| Cleave | Starts a second attack, with its own circumstances and reduced damage formula. |
| Graze | Shows the fixed ability damage on a miss. |
| Nick | Offers another tracked Light weapon in the Attack action. |
| Push, Sap, Slow, Vex | Shows the target effect and its timing or damage requirement. |
| Topple | Calculates the DC and offers a target Constitution save with the DM's modifier and roll mode. |

Cleave, Light/Nick, and the default Beast Barbarian's extra claw attack cannot recursively generate another copy within the same sequence. Confirm turn availability at the table; closing the dialog does not represent a new turn. Cleave and Light attacks remove a positive ability modifier from the saved formula while preserving other bonuses. A negative ability modifier remains. Two-Weapon Fighting can retain it for Light attacks. Keep the saved damage modifier current when scores change.

## Other rules checked

- Natural 1 and 20 override AC. Feature or target effects can explicitly make a different roll a critical hit. Critical damage doubles dice, including selected extra attack damage, and keeps flat bonuses fixed.
- Advantage sources combine without stacking; any disadvantage cancels advantage. The rules engine identifies applicable automatic sources and recorded feat exceptions; the dialog collects situational selections and individual source overrides as described above.
- Optional distance checks reach and maximum range. Cover adjusts AC or prevents direct targeting. Thrown attacks keep the weapon's chosen ability; Versatile melee attacks can use two-handed damage.
- Relevant tracked extra damage features appear in the result dialog. Their remaining uses are spent when rolled. Sneak Attack weapon eligibility is checked; its situational trigger and once-per-turn limit require confirmation. Hunter's Mark is offered when it is the tracked concentration spell. Additional dice or fixed damage can also be entered, with an explicit critical-dice choice.
- Heroic Inspiration replaces one selected attack d20, spends Inspiration, and recalculates the kept die, hit, and critical status.

## Table decisions

This is a character tracker, without a shared encounter, target stat blocks, positioning, or turn clock. The DM supplies target AC/save modifiers and adjudicates sight, fear, target conditions, feature triggers, underwater combat, ammunition, hands, action economy, and once-per-turn limits. Loading and ammunition reminders are shown; inventory quantities may count bundles and are not spent automatically.

Apply target HP, conditions, resistance, immunity, vulnerability, and concentration saves at the table. Damage additions can have different types; do not combine them before applying defenses. Attack notes remain available in the result dialog. Maneuver effects, Rage, Smite costs, and other class/subclass exceptions remain explicit player decisions.

## Sources and verification

Rules checked against the official 2024 Basic Rules: [Equipment](https://www.dndbeyond.com/sources/dnd/br-2024/equipment), [Playing the Game](https://www.dndbeyond.com/sources/dnd/br-2024/playing-the-game), and [Rules Glossary](https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary), including conditions and Concentration. SRD 5.2.1 attribution and licensing are in the project README. The retained Beast option follows the character's existing supplemental feature notes.

Feat exceptions were checked against the licensed Player's Handbook (2024) entries for [Sharpshooter](https://roll20.net/compendium/dnd5e/Feats%3ASharpshooter?expansion=32231), [Crossbow Expert](https://roll20.net/compendium/dnd5e/Feats%3ACrossbow%20Expert?expansion=32231), and [Spell Sniper](https://roll20.net/compendium/dnd5e/Feats%3ASpell%20Sniper?expansion=32231). Superseded 2014 feat mechanics are not used for these exceptions. Other feat benefits, including Sharpshooter cover, remain table decisions in this attack workflow.

`npm test` covers rules math, unequal source cancellation, individual overrides and restoring defaults, situational modifiers, feat scope, conditional features, mastery eligibility, damage, rerolls, and backup compatibility. `npm run test:attacks` covers live summaries, override independence and reset, recorded feat exceptions, all eight masteries, chained attacks, feature damage and spending, Inspiration, cover, range, editing, mobile layout, reduced motion, and offline use. `ATTACK_TEST_PATH=/dist/` runs the same browser checks against the built site.

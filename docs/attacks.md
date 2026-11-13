# Guided attacks

Choose **Roll to hit**, review the circumstances, then roll. Target AC and distance are optional. Without AC, confirm Hit, Critical hit, or Miss with the DM. The damage button on the sheet opens damage directly, with a critical-hit toggle.

The attack editor has **Weapon rules** for the base weapon and **Unlocked mastery** for the character's actual choice. These are separate from proficiency. Custom names can retain a base weapon; spells and natural attacks can use Custom. A catalog weapon never unlocks mastery by itself. Old saves recognize exact weapon choices already recorded in a Weapon Mastery feature; all old saves still load without migration. Explicit None takes precedence over those notes.

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
- Advantage sources combine without stacking; any disadvantage cancels advantage. Checks include saved mode, Heavy ability requirements, applicable tracked conditions, long range, and nearby enemies for ranged attacks. Frightened asks whether the source is in sight. A feature/DM exception uses only the selected situational boxes.
- Optional distance checks reach and maximum range. Cover adjusts AC or prevents direct targeting. Thrown attacks keep the weapon's chosen ability; Versatile melee attacks can use two-handed damage.
- Relevant tracked extra damage features appear in the result dialog. Their remaining uses are spent when rolled. Sneak Attack weapon eligibility is checked; its situational trigger and once-per-turn limit require confirmation. Hunter's Mark is offered when it is the tracked concentration spell. Additional dice or fixed damage can also be entered, with an explicit critical-dice choice.
- Heroic Inspiration replaces one selected attack d20, spends Inspiration, and recalculates the kept die, hit, and critical status.

## Table decisions

This is a character tracker, without a shared encounter, target stat blocks, positioning, or turn clock. The DM supplies target AC/save modifiers and adjudicates sight, fear, target conditions, feature triggers, underwater combat, ammunition, hands, action economy, and once-per-turn limits. Loading and ammunition reminders are shown; inventory quantities may count bundles and are not spent automatically.

Apply target HP, conditions, resistance, immunity, vulnerability, and concentration saves at the table. Damage additions can have different types; do not combine them before applying defenses. Attack notes remain available in the result dialog. Maneuver effects, Rage, Smite costs, and other class/subclass exceptions remain explicit player decisions.

## Sources and verification

Rules checked against the official 2024 Basic Rules: [Equipment](https://www.dndbeyond.com/sources/dnd/br-2024/equipment), [Playing the Game](https://www.dndbeyond.com/sources/dnd/br-2024/playing-the-game), and [Rules Glossary](https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary), including conditions and Concentration. SRD 5.2.1 attribution and licensing are in the project README. The retained Beast option follows the character's existing supplemental feature notes.

`npm test` covers rules math, mastery eligibility, damage, rerolls, and backup compatibility. `npm run test:attacks` covers all eight masteries, chained attacks, feature damage and spending, Inspiration, cover, range, editing, mobile layout, reduced motion, and offline use. `ATTACK_TEST_PATH=/dist/` runs the same browser checks against the built site.

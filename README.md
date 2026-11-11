# Questlog

A mobile-first character journal for the **2024 D&D 5e core rules** with a retro RPG heart. Original pixel art, animated level-ups, and a little optional 8-bit fanfare.

## Run locally

Install [Node.js](https://nodejs.org/) 24 or newer, then run:

```sh
npm run dev
```

Open **http://localhost:4173**. There are no npm dependencies to install. Opening `index.html` directly as a file won't load the JavaScript modules; use the local server or GitHub Pages.

## Host on GitHub Pages

Repository: [MelchiorDahrk/DnD-App](https://github.com/MelchiorDahrk/DnD-App). Once Pages is enabled and the first deployment succeeds, the app will be available at **https://melchiordahrk.github.io/DnD-App/**.

GitHub Pages requires a public repository on GitHub Free, or a plan that supports Pages for private repositories. The repository's current private visibility and plan must support Pages before deployment can finish.

1. Push this project's source to `main`, including `.github/workflows/deploy.yml`.
2. Open [Settings → Pages](https://github.com/MelchiorDahrk/DnD-App/settings/pages), then under **Build and deployment → Source** choose **GitHub Actions**.
3. Push to `main`, or open [Actions → Deploy Questlog to GitHub Pages](https://github.com/MelchiorDahrk/DnD-App/actions/workflows/deploy.yml) and choose **Run workflow**.
4. When the workflow finishes, open the app URL above.
5. Open that address on your phone. In Safari, choose **Share → Add to Home Screen**. On Android, use **Install app** or **Add to Home screen** in the browser menu.

The workflow checks the JavaScript, runs the model tests, builds `dist/`, and publishes it using the [official GitHub Pages workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). All app paths, the manifest, and the service worker are relative, so repository subpaths and custom domains work without configuration.

Alternatively, this is a buildless app: publish the repository root with GitHub Pages' **Deploy from a branch** option. `.nojekyll` is included. Choose either branch publication or the Actions workflow, not both.

## At the table

- **Characters:** starts with Lyra, a level 3 Wood Elf Ranger. Open the character switcher to create your own adventurers. Edit player name, species, class, subclass, background, alignment, campaign, level, and XP. When copying an existing higher-level sheet, set its HP in **Edit stats**.
- **Character sheet:** edit scores and combat stats; roll checks, saving throws, attacks, damage, and initiative. Cycle skill dots through untrained, proficiency, and expertise.
- **Paper sheet details:** dedicated personality traits, ideals, bonds, flaws, languages, armor/weapon/tool proficiencies, senses, and armor/shield notes. Edit initiative and passive Perception adjustments for features, equipment, or table rulings. [Full coverage map](docs/character-sheet-coverage.md).
- **Features & resources:** track maneuvers and rest-based charges. Add an optional dice formula such as `1d8` for superiority dice or `1d10+3` for Second Wind. Rolling spends one use and prevents further rolls when exhausted; apply healing or damage separately. Short/long rests refresh the appropriate resources.
- **Health:** damage, healing, temporary HP, death saves, conditions, 2024 Exhaustion, Heroic Inspiration, and short/long rests. Exhaustion applies −2 per level to sheet D20 Tests and −5 feet per level to walking speed; custom dice rolls remain explicit formulas. Temporary HP absorbs damage first and doesn't stack.
- **Inventory:** add, edit, equip, search, and categorize items; track quantities, carrying weight, and all five coin types (CP, SP, EP, GP, PP). A consumable named **Potion of healing** rolls 2d4 + 2 and heals you when used (a Bonus Action under the 2024 rules). Other consumables reduce quantity and leave effects to the player.
- **Spellbook:** add spells, set slots and casting ability, mark known/prepared spells, cast or upcast, and track concentration. Cantrips and ritual/item/feature casting can use no slot.
- **Journal:** create, edit, search, categorize, and pin notes. Open a note to read its full text. Notes are plain text; markup is displayed literally.
- **Dice:** d4–d100, custom formulas such as `2d6+3`, d20 advantage/disadvantage, natural 20s, and session roll history. Dice use the browser's cryptographic random generator without modulo bias.
- **Level-ups:** choose HP gained, advance a level, and celebrate with a pixel confetti animation. Respects the device's reduced-motion preference. Sound is off by default.
- **2024 compendium:** default references open the [official 2024 Basic Rules](https://www.dndbeyond.com/sources/dnd/br-2024) in a new tab. It also links to the revised core rulebooks: Player’s Handbook (2024), Dungeon Master’s Guide (2024), and Monster Manual (2025). Full books may require D&D Beyond access. Custom entries can use their own reference URL. Recognized older generated wiki links resolve to current references when displayed; their stored values are preserved.

## Saves, backups, and offline use

Data is saved automatically in this browser's local storage. **There is no account, server, or automatic sync between devices.** Use **Settings & backup → Export** to download a JSON backup, then import it on another device. Import adds characters and preserves existing ones; duplicate IDs become separate copies.

Clearing browser data, using private browsing, changing the site's address, or switching browsers can remove access to local saves. Export backups regularly. The app shows an explicit warning when browser storage fails; changes then remain in memory and can still be exported. It will not silently overwrite unreadable saved data.

Backups are validated before import. Each browser supports up to 100 characters and 2 MB of saved data. Over-limit changes remain available in memory for export, but reduce the data before expecting automatic saving to resume. Roll history is session-only and is not included in backups.

Older version 1 saves remain compatible. Missing paper-sheet fields start empty, extra coin types and bonus adjustments start at zero, and existing character values are preserved. All new fields are included in export/import.

After the first online visit and the **Ready for offline adventures** message, a service worker caches the app, local icons, and original artwork. Character tracking and dice then work offline on HTTPS hosts or localhost. Reference pages need internet access. The app has no remote fonts, scripts, analytics, or runtime dependencies. For future code releases, bump the cache name in `sw.js` when changing the offline asset set.

## Rules scope

The sample and rest defaults follow the **2024 core rules**, checked against the official [2024 Basic Rules](https://www.dndbeyond.com/sources/dnd/br-2024) and [SRD 5.2.1](https://www.dndbeyond.com/srd). The revised Monster Manual was published in 2025 as part of this core rules revision.

The level 3 Ranger demo includes Favored Enemy’s two free Hunter’s Mark castings, Weapon Mastery, Deft Explorer, Archery, Hunter’s Lore, Colossus Slayer, a Soldier Origin feat, and Wood Elf lineage magic. Cure Wounds uses its revised Abjuration school and 2d8 healing at level 1. Its scores use rolled starting values with background increases. Ranger preparations, lineage spells, and feature castings are explained in the spell notes. Feature castings require selecting **No slot** and spending the matching feature use manually.

This is an editable tracker, not a complete rules engine. It doesn't enforce character-building choices, spell preparation limits, encumbrance variants, multiclass rules, most condition effects, attacks per turn, massive damage, or concentration checks. Armor class, base speed, damage formulas, hit die size, spell slots, and features are player-managed. Attack accuracy, ability modifiers, skill/save bonuses, passive Perception, and proficiency update from the sheet. Exhaustion modifies sheet ability checks, skills, saving throws (including death saves), attack bonuses, initiative, passive Perception, and walking speed. Ability scores, damage, and spell save DC are unaffected. At Exhaustion 6 the app warns that the character dies; resolve death and other condition effects with your DM. Custom dice formulas do not automatically add Exhaustion.

**Heroic Inspiration** tracks whether you have it. Spend it to reroll one die immediately after rolling it and use the new result; resolve the reroll manually. It does not grant Advantage. Record Weapon Mastery effects in attack notes and apply them at the table. Backgrounds supply ability score increases and an Origin feat; species does not supply ability score increases. The optional Artificer class entry supports supplemental characters; it is not a 2024 Player’s Handbook class.

A qualifying **Long Rest** restores all HP, **all spent Hit Dice**, slots, and short/long-rest resources, normally removes **one Exhaustion level**, clears temporary HP and concentration, and resets death saves. Uncheck Exhaustion recovery when an effect blocks it. Both rests require at least 1 HP at the start. Rest timing and interruptions are adjudicated by the table. Reduced ability scores/HP maximums and benefits such as a Human’s Heroic Inspiration must be restored or recorded manually.

**Short Rest** optionally spends Hit Dice and refreshes short-rest resources. Long-rest resources can also specify a number of uses regained on a Short Rest: for example, 2024 Second Wind at Fighter level 3 has 2 uses, long-rest refresh, and 1 use regained on a Short Rest. Pact slots remain manual. Set a custom spellcasting ability in **Spellbook → Edit slots** for subclasses or house rules. Changing Constitution doesn't retroactively recalculate maximum HP. Leveling updates level, proficiency, current/max HP, and Hit Dice; consult the 2024 class rules to add features, spells, slots, ASIs, and feats.

Older saved characters and backups retain their scores, backgrounds, features, notes, and resource counters. Review older character options against your 2024 books; updating the app does not rebuild a saved character. **Settings & backup → Add 2024 example** adds the revised sample alongside existing characters.

This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode. Rules are summarized and adapted for this tracker.

## Check and build

```sh
npm run check
npm test
npm run build
```

The output is `dist/`. The same app can be previewed at `http://localhost:4173/dist/` after building, which also exercises repository-subpath hosting.

Source layout: `app.js` handles views and interactions, `model.js` contains character and dice logic plus backup validation, `styles.css` contains the responsive design, `art.js` and `icons.js` contain original SVG assets, and `sw.js` enables offline use. `scripts/` contains the dependency-free server and build tools. `tests/` covers rules calculations and backup integrity.

Design research: the familiar sheet/inventory/spell/journal organization was informed by [D&D Beyond's sheet sections](https://dndbeyond-support.wizards.com/hc/en-us/articles/7747193946388-Sheet-Sections). Questlog's visual design and pixel artwork are original. Questlog is an independent fan project and is not affiliated with Wizards of the Coast.

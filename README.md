# Questlog

A mobile-first character journal for the **2024 D&D 5e core rules** with a retro RPG heart. Original pixel art, animated level-ups, and a little optional 8-bit fanfare.

## Run locally

Install [Node.js](https://nodejs.org/) 24 or newer, then run:

```sh
npm run dev
```

Open **http://localhost:4173**. There are no npm dependencies to install. Opening `index.html` directly as a file won't load the JavaScript modules; use the local server or GitHub Pages.

## Host on GitHub Pages

Repository: [MelchiorDahrk/DnD-App](https://github.com/MelchiorDahrk/DnD-App). App URL: **[Open Questlog](https://melchiordahrk.github.io/DnD-App/)**.

This public repository uses GitHub Actions to publish the app to GitHub Pages automatically after a push to `main`. Check the [deployment workflow](https://github.com/MelchiorDahrk/DnD-App/actions/workflows/deploy.yml) for deployment status or to publish manually.

1. Push this project's source to `main`, including `.github/workflows/deploy.yml`.
2. Open [Settings → Pages](https://github.com/MelchiorDahrk/DnD-App/settings/pages), then under **Build and deployment → Source** choose **GitHub Actions**.
3. Push to `main`, or open [Actions → Deploy Questlog to GitHub Pages](https://github.com/MelchiorDahrk/DnD-App/actions/workflows/deploy.yml) and choose **Run workflow**.
4. When the workflow finishes, open the app URL above.
5. Open that address on your phone. In Safari, choose **Share → Add to Home Screen**. On Android, use **Install app** or **Add to Home screen** in the browser menu.

The workflow checks the JavaScript, runs the model tests, builds `dist/`, and publishes it using the [official GitHub Pages workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). All app paths, the manifest, and the service worker are relative, so repository subpaths and custom domains work without configuration.

Alternatively, this is a buildless app: publish the repository root with GitHub Pages' **Deploy from a branch** option. `.nojekyll` is included. Choose either branch publication or the Actions workflow, not both.

## At the table

- **Characters:** starts with the three photographed level 3 characters: **Melchior** (Drow Battle Master Fighter, Eric), **Balin** (Hill Dwarf Beast Barbarian, Rob), and **Teyla** (Wood Elf Assassin Rogue / Folk Hero, Jen). Their inventories, coins, personality, and final ability scores are included. Class features and derived totals are corrected for 2024 play, while older character options remain usable. Pinned journal notes explain conversions and uncertain handwriting. **Settings & backup → Add default party** adds fresh copies; the optional Lyra Ranger remains available through **Add 2024 example**. Open the character switcher to create your own adventurers. Edit player name, species, class, subclass, background, alignment, campaign, level, and XP. When copying an existing higher-level sheet, set its HP in **Edit stats**.
- **Scan a sheet:** open the character switcher or **Settings & backup → Scan a sheet**. Take a photo or choose up to six JPG, PNG, or WebP photos of one character’s printed or handwritten 5e sheet. Review and correct the extracted fields, compare the original photos, then create a new character. Existing characters are preserved. Scanning needs an online scan service; see setup below.
- **Character sheet:** edit scores and combat stats; roll checks, saving throws, attacks, damage, and initiative. Cycle skill dots through untrained, proficiency, and expertise. Attack editors support normal/advantage/disadvantage rolls; Edit stats supports initiative advantage.
- **Paper sheet details:** dedicated personality traits, ideals, bonds, flaws, languages, armor/weapon/tool proficiencies, senses, and armor/shield notes. Edit initiative and passive Perception adjustments for features, equipment, or table rulings. [Full coverage map](docs/character-sheet-coverage.md).
- **Features & resources:** track maneuvers and rest-based charges. Add an optional dice formula such as `1d8` for superiority dice or `1d10+3` for Second Wind. Rolling spends one use and prevents further rolls when exhausted; apply healing or damage separately. Short/long rests refresh the appropriate resources.
- **Health:** damage, healing, temporary HP, death saves, conditions, 2024 Exhaustion, Heroic Inspiration, and short/long rests. Exhaustion applies −2 per level to sheet D20 Tests and −5 feet per level to walking speed; custom dice rolls remain explicit formulas. Temporary HP absorbs damage first and doesn't stack.
- **Inventory:** add, edit, equip, search, and categorize items; track quantities, carrying weight, and all five coin types (CP, SP, EP, GP, PP). A consumable named **Potion of healing** rolls 2d4 + 2 and heals you when used (a Bonus Action under the 2024 rules). Other consumables reduce quantity and leave effects to the player.
- **Spellbook:** add spells, set slots and casting ability, mark known/prepared spells, cast or upcast, and track concentration. Cantrips and ritual/item/feature casting can use no slot.
- **Journal:** create, edit, search, categorize, and pin notes. Open a note to read its full text. Notes are plain text; markup is displayed literally.
- **Dice:** d4–d100, custom formulas such as `2d6+3`, d20 advantage/disadvantage, natural 20s, and session roll history. Dice use the browser's cryptographic random generator without modulo bias.
- **Level-ups:** choose HP gained, advance a level, and celebrate with a pixel confetti animation. Respects the device's reduced-motion preference. Sound is off by default.
- **2024 compendium:** default references open the [official 2024 Basic Rules](https://www.dndbeyond.com/sources/dnd/br-2024) in a new tab. It also links to the revised core rulebooks: Player’s Handbook (2024), Dungeon Master’s Guide (2024), and Monster Manual (2025). Full books may require D&D Beyond access. Custom entries can use their own reference URL. Explicit reference URLs open as stored, without rewriting older generated links. Older character options remain available under the 2024 guidance for earlier books.

## Saves, backups, and offline use

Data is saved automatically in this browser's local storage. **Character tracking needs no account or server, and there is no automatic sync between devices.** Optional photo scanning uses an online service. Use **Settings & backup → Export** to download a JSON backup, then import it on another device. Import adds characters and preserves existing ones; duplicate IDs become separate copies.

Clearing browser data, using private browsing, changing the site's address, or switching browsers can remove access to local saves. Export backups regularly. The app shows an explicit warning when browser storage fails; changes then remain in memory and can still be exported. It will not silently overwrite unreadable saved data.

Backups are validated before import. Each browser supports up to 100 characters and 2 MB of saved data. Over-limit changes remain available in memory for export, but reduce the data before expecting automatic saving to resume. Roll history is session-only and is not included in backups.

**Only save format version 2 is supported.** Browser storage uses `questlog.v2` and starts with the default party; previous browser saves are not read, migrated, or deleted. Version 1 and other backup versions are rejected. Every current sheet field, casting ability, initiative advantage setting, attack note and roll mode, feature formula, and Short Rest recovery value is required, even when empty or zero. Import does not fill in missing fields. All current fields are included in export/import.

After the first online visit and the **Ready for offline adventures** message, a service worker caches the app, local icons, and original artwork. Character tracking and dice then work offline on HTTPS hosts or localhost. Reference pages and photo scanning need internet access. The app has no remote fonts, scripts, analytics, or runtime dependencies. For future code releases, bump the cache name in `sw.js` when changing the offline asset set.

## Sheet scanning setup

Character tracking stays static and offline. Handwriting transcription is an optional server feature using the [OpenAI vision API](https://developers.openai.com/api/docs/guides/images-vision) and [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs). The API key stays on the server; never put it in browser code, a backup, or GitHub Pages build variables. No additional npm dependencies are needed.

For local scanning, set the key in the terminal running Questlog, then start the app. In PowerShell:

```powershell
$env:OPENAI_API_KEY = '<your API key>'
npm run dev
```

Open **http://127.0.0.1:4173** and choose **Scan a sheet**. The default service URL uses this host. `OPENAI_SCAN_MODEL` optionally overrides the default `gpt-4.1`; choose a model supporting image input and strict Structured Outputs. An API account with model access and credits is required. A ChatGPT subscription by itself does not configure this server. If no key is configured, scanning explains the setup needed and leaves all characters untouched.

**GitHub Pages cannot run the scan endpoint.** To scan from the hosted app, deploy this Node app to an HTTPS Node host and configure these server environment variables:

- `OPENAI_API_KEY`: the server’s API key.
- `HOST=0.0.0.0` and the host’s `PORT`: allow the Node host to serve the app. Local development defaults to loopback only.
- `SCAN_ACCESS_TOKEN`: a private service access code. Remote scanning is disabled until one is configured. This is a separate code, not the OpenAI API key.
- `SCAN_ALLOWED_ORIGINS=https://melchiordahrk.github.io`: the exact website origin allowed to call the service. Use comma-separated origins for additional frontends. Same-origin requests are allowed automatically.

Run `npm start` on that host. In **Scan a sheet → Connect a scan service** on GitHub Pages, enter `https://your-node-host.example/api/scan-sheet` and the service access code. Only the service URL is remembered during this page session. The access code stays in the open dialog and is cleared when it closes. The same server also serves Questlog directly if you prefer hosting everything together. No deployment or credentials are included in the repository.

The endpoint accepts `POST /api/scan-sheet` with `{ "images": ["data:image/jpeg;base64,..."] }`, returning `{ "scan": ... }` using the schema in `sheet-scan.js`. It validates image types and sizes, enforces origins and the service code, limits concurrent scans to two and attempts to ten per ten minutes per connection address, and times out inference after two minutes. On proxied hosts the connection address may be shared; use host-level per-user quotas/authentication for a larger audience. The frontend also supports `/dist/` previews.

Photos are resized in the browser and sent to the selected service and OpenAI only after **Scan & review**. Questlog does not write photos to disk, logs, local storage, service-worker caches, or backups. Requests use `store: false`; the service provider’s API data policies still apply. Closing the dialog cancels the client request and releases its photos. Saved characters contain the reviewed text and stats plus editable transcription/review notes.

Unknown important fields are flagged with starting values for review. Blank current HP starts at maximum, unreadable equipment weights start at zero, and attacks with unreadable damage stay as feature notes instead of gaining invented dice. Written initiative, attack totals, and passive Perception are mapped to the tracker’s bonus adjustments. Separate shield annotations remain notes when their inclusion in AC is unclear. Printed and handwritten values are transcribed without rebuilding older characters under newer rules. Photos should be of the same character; PDF and HEIC files must first be exported as JPG/PNG/WebP. Always review the transcription before creating the character.

## Rules scope

The optional Lyra sample and rest defaults follow the **2024 core rules**, checked against the official [2024 Basic Rules](https://www.dndbeyond.com/sources/dnd/br-2024) and [SRD 5.2.1](https://www.dndbeyond.com/srd). The revised Monster Manual was published in 2025 as part of this core rules revision.

The level 3 Ranger demo includes Favored Enemy’s two free Hunter’s Mark castings, Weapon Mastery, Deft Explorer, Archery, Hunter’s Lore, Colossus Slayer, a Soldier Origin feat, and Wood Elf lineage magic. Cure Wounds uses its revised Abjuration school and 2d8 healing at level 1. Its scores use rolled starting values with background increases. Ranger preparations, lineage spells, and feature castings are explained in the spell notes. Feature castings require selecting **No slot** and spending the matching feature use manually.

This is an editable tracker, not a complete rules engine. It doesn't enforce character-building choices, spell preparation limits, encumbrance variants, multiclass rules, most condition effects, attacks per turn, massive damage, or concentration checks. Armor class, base speed, damage formulas, hit die size, spell slots, and features are player-managed. Attack accuracy, ability modifiers, skill/save bonuses, passive Perception, and proficiency update from the sheet. Exhaustion modifies sheet ability checks, skills, saving throws (including death saves), attack bonuses, initiative, passive Perception, and walking speed. Ability scores, damage, and spell save DC are unaffected. At Exhaustion 6 the app warns that the character dies; resolve death and other condition effects with your DM. Custom dice formulas do not automatically add Exhaustion.

**Heroic Inspiration** tracks whether you have it. Spend it to reroll one die immediately after rolling it and use the new result; resolve the reroll manually. It does not grant Advantage. Record Weapon Mastery effects in attack notes and apply them at the table. Backgrounds supply ability score increases and an Origin feat; species does not supply ability score increases. The optional Artificer class entry supports supplemental characters; it is not a 2024 Player’s Handbook class.

A qualifying **Long Rest** restores all HP, **all spent Hit Dice**, slots, and short/long-rest resources, normally removes **one Exhaustion level**, clears temporary HP and concentration, and resets death saves. Uncheck Exhaustion recovery when an effect blocks it. Both rests require at least 1 HP at the start. Rest timing and interruptions are adjudicated by the table. Reduced ability scores/HP maximums and benefits such as a Human’s Heroic Inspiration must be restored or recorded manually.

**Short Rest** optionally spends Hit Dice and refreshes short-rest resources. Long-rest resources can also specify a number of uses regained on a Short Rest: for example, 2024 Second Wind at Fighter level 3 has 2 uses, long-rest refresh, and 1 use regained on a Short Rest. Pact slots remain manual. Set a custom spellcasting ability in **Spellbook → Edit slots** for subclasses or house rules. Changing Constitution doesn't retroactively recalculate maximum HP. Leveling updates level, proficiency, current/max HP, and Hit Dice; consult the 2024 class rules to add features, spells, slots, ASIs, and feats.

The default party uses 2024 Fighter/Battle Master, Barbarian, and Rogue/Assassin class rules. Melchior retains 2014 Drow and Criminal (Fence); Balin retains 2014 Hill Dwarf, Guild Artisan, and the supplemental Beast subclass; Teyla uses Wood Elf with the requested older Folk Hero background. Older backgrounds receive an Origin feat (Alert, Crafter, and Lucky respectively) and background ability increases, already reflected in the retained final scores. Rules corrections, additional selections, and original conflicting entries are documented in pinned journal notes and the [coverage map](docs/character-sheet-coverage.md). Special effects remain player-managed. **Settings & backup → Add 2024 example** adds the revised sample alongside existing characters.

This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode. Rules are summarized and adapted for this tracker.

## Check and build

```sh
npm run check
npm test
npm run build
```

The output is `dist/`. The same app can be previewed at `http://localhost:4173/dist/` after building, which also exercises repository-subpath hosting.

Source layout: `app.js` handles views and interactions, `model.js` contains character and dice logic plus backup validation, `default-characters.js` supplies the photographed default party and fresh state, `sheet-scan.js` defines extraction and import validation, and `sheet-scan-ui.js` handles photo capture and review. `styles.css` contains the responsive design, `art.js` and `icons.js` contain original SVG assets, and `sw.js` enables offline use. `scripts/` contains the dependency-free server, optional vision endpoint, and build tools. `tests/` covers rules calculations, backup integrity, and sheet scanning.

Design research: the familiar sheet/inventory/spell/journal organization was informed by [D&D Beyond's sheet sections](https://dndbeyond-support.wizards.com/hc/en-us/articles/7747193946388-Sheet-Sections). Questlog's visual design and pixel artwork are original. Questlog is an independent fan project and is not affiliated with Wizards of the Coast.

# Questlog

A mobile-first character journal for the **2024 D&D 5e core rules** with a retro RPG heart. Bricktrait character portraits, original pixel scenery, magical action effects, and a little optional 8-bit fanfare.

## Run locally

Install [Node.js](https://nodejs.org/) 24 or newer, then run:

```sh
npm ci
npm run dev
```

Open **http://localhost:4173**. The first build installs and bundles the reused Bricktrait editor and downloads the LDraw library; allow several minutes for that initial asset preparation. Later builds reuse the cached library. Opening `index.html` directly as a file won't load the JavaScript modules; use the local server or GitHub Pages.

## Host on GitHub Pages

Repository: [MelchiorDahrk/DnD-App](https://github.com/MelchiorDahrk/DnD-App). App URL: **[Open Questlog](https://melchiordahrk.github.io/DnD-App/)**.

This public repository uses GitHub Actions to publish the app to GitHub Pages automatically after a push to `main`. Check the [deployment workflow](https://github.com/MelchiorDahrk/DnD-App/actions/workflows/deploy.yml) for deployment status or to publish manually.

1. Push this project's source to `main`, including `.github/workflows/deploy.yml`.
2. Open [Settings → Pages](https://github.com/MelchiorDahrk/DnD-App/settings/pages), then under **Build and deployment → Source** choose **GitHub Actions**.
3. Push to `main`, or open [Actions → Deploy Questlog to GitHub Pages](https://github.com/MelchiorDahrk/DnD-App/actions/workflows/deploy.yml) and choose **Run workflow**.
4. When the workflow finishes, open the app URL above.
5. Open that address on your phone. In Safari, choose **Share → Add to Home Screen**. On Android, use **Install app** or **Add to Home screen** in the browser menu.

The workflow checks the JavaScript, runs the model tests, builds `dist/`, and publishes it using the [official GitHub Pages workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). All app paths, the manifest, and the service worker are relative, so repository subpaths and custom domains work without configuration.

To deploy elsewhere, run `npm ci` and `npm run build`, then publish `dist/`. The generated `portrait-maker/` assets are required; publishing only the source repository does not include the editor.

## At the table

- **Content sources:** open **Settings & backup → Content sources** to enable or disable books for the compendium, feat and item presets, and other new character and level-up choices. All sources start enabled. Search book titles or use **Enable all / Disable all**. Saved characters retain their feats, items, spells, and resources; those entries remain usable and editable. A shared entry remains available while any of its listed books is enabled. Preferences persist in the browser and exported backups; importing characters keeps this browser’s preferences.
- **Characters:** new journals start empty. Create a character or import a Questlog backup. Existing saved characters resume automatically; character management supports switching and deletion.
- **Portrait maker:** tap the portrait on the character sheet (or **Edit character → Make or edit portrait**). The embedded [Bricktrait](https://github.com/Maxichance/bricktrait) editor offers real minifigure parts, colours, poses, camera controls, and undo/redo, with a curated fantasy/medieval part browser. New portraits save as transparent, borderless WebPs. Older designs reopen with this style while retaining their parts and camera. Choose **Use portrait** to save it for this character, or **Cancel** to keep the current portrait. Your saved portrait appears in the sheet, switcher, backup previews, and level-up screen. Reopen it to continue editing. Portraits and their editable designs travel in JSON backups; existing version 2 saves still load. Character details are saved before opening the maker from Edit character.
- **Character sheet:** a compact sticky header shows HP with a blue temporary HP segment, read-only armor class, speed, and conditions/exhaustion while you scroll. Journal entries and equipment stay on their dedicated pages. Its section links jump to any part of the sheet and expand a collapsed destination; swipe the links on a phone to reach every section. Tap any section title to collapse or expand it. Star individual entries to keep them visible and usable while their section is collapsed. Dismiss the favorites tip once to hide it for all characters in this browser. Favorites and collapsed sections are saved separately for each character and included in backups; existing saves start fully expanded. Edit scores and combat stats; roll checks, saving throws, attacks, damage, and initiative. Cycle skill dots through untrained, proficiency, and expertise. Attack editors support normal/advantage/disadvantage rolls; Edit stats supports initiative advantage.
- **Paper sheet details:** dedicated personality traits, ideals, bonds, flaws, and armor/shield notes. Passive Perception sits beside Experience; remaining Hit Dice appear when taking a Short Rest. **Skills & training** has Skills, Proficiencies, Languages and Tools tabs. Saving throws and their proficiency dots appear beneath each ability, with shield buttons to roll. Tick armor training, individual weapons or weapon families, languages and tool proficiencies. Weapon bonuses, shield AC, untrained-armor penalties and tool checks use these selections. Tools are physical inventory items, with Use rolls and separate ownership/proficiency. Existing text entries convert once and retain their original notes. [Training rules](docs/training.md). Edit initiative and passive Perception adjustments for features, equipment, or table rulings. [Full coverage map](docs/character-sheet-coverage.md).
- **Features & resources:** choose from **544 searchable presets** covering class features, species/lineage traits, subclass references/resources, all 75 core feats, maneuvers, Metamagic, invocations, and custom templates. Filter by category and use **For this character**, **This character · all levels**, or **All options**. Suggestions use class, subclass, species, and level; access remains open for multiclass, earlier books, and homebrew. Resource defaults use your stats and an editable class level; review them after leveling. Track maneuvers and rest-based charges, or point pools up to 999 with compact spend/restore controls and an editable spent amount. Add an optional dice formula such as `1d8` for superiority dice or `1d10+3` for Second Wind. Rolling spends one use and prevents further rolls when exhausted; apply healing or damage separately. Short/long rests refresh the appropriate resources.
- **Health:** damage, healing, temporary HP, death saves, conditions, 2024 Exhaustion, Heroic Inspiration, and short/long rests. Rest dialogs list every tracked refresh with before/after amounts, then stay open with a character-specific checklist for Weapon Mastery, spell preparations, subclass/species choices, feats, crafting, item timing, and custom rules. Uncheck recovery blocked by another effect; multi-rest cooldowns start unchecked. [Rules coverage and sources](docs/rest-reminders.md). Exhaustion applies −2 per level to sheet D20 Tests and −5 feet per level to walking speed; custom dice rolls remain explicit formulas. Temporary HP absorbs damage first and doesn't stack.
- **Inventory:** choose from **1,357 equipment presets**, including **503 current magic items**, **502 earlier-only items**, and **18 potency choices**, using searchable, grouped dropdowns, or enter a custom item. Includes all 38 basic weapons, 13 armor/shield entries, adventuring gear, all seven packs, tools, instruments, gaming sets, ammunition, focuses, tack, mounts, ships, and all 128 standard treasure presets (gems, art objects, trade goods, and trade bars). Treasure includes listed values and appropriate LEGO icons. Magic items include rarity, attunement, source, price where listed, rules stats, variant tables, and representative LEGO icons; filter by rarity, attunement, and rules version. Shared items always use 2024 stats and descriptions. [Magic-item coverage and behavior](docs/magic-items.md). Selecting a preset fills the name, category, weight, cost, and rules summary; all fields remain editable. Stats and notes are visible in the inventory. Weapon items include the complete attack editor: ability, proficiency, attack bonus, damage formula, damage type, range, roll mode, weapon rules, mastery, and attack notes. Catalog weapons fill these automatically and create a linked action; edit from either screen. Removing the weapon removes its action. Older unambiguous item/action pairs keep their existing custom settings. Magic weapons use their documented default base and a single stated attack/damage potency; change the base weapon when needed. Special or conditional damage dice and activation rules remain in the attack notes for the guided attack’s extra-damage controls. Track quantities, carrying weight, and all five coin types (CP, SP, EP, GP, PP). In **Manage** coin purse, enter a total, a relative change such as `+10` or `-5`, or an expression such as `25+10-5`; preview the resulting balance before saving. Changes gather or scatter matching LEGO studs, with a still caption for reduced motion. Ammunition presets count **bundles**, with the bundle size stated in their notes. Mounts and large ships are excluded from carried weight. A consumable named **Potion of healing** rolls 2d4 + 2 and heals you when used (a Bonus Action under the 2024 rules). Other consumables reduce quantity and leave effects to the player.
- **Character dropdowns:** class, species/race, subclass (filtered by class), background, and alignment have dropdowns. Stat previews show hit dice, saving throws, training, skill choices, speed, senses, traits, background ability choices, and Origin feats. Covers the 12 core classes plus supplemental Artificer, all 10 core species plus lineage variants, all 16 core backgrounds, the 48 core subclasses plus four supplemental Artificer subclasses, and all 10 Origin feats (Magic Initiate has three spell-list variants). Custom and earlier-book species, subclasses, and backgrounds remain editable. New characters receive class hit die, save proficiencies, armor/weapon training, species speed/senses, and first-level HP; background increases, skill choices, traits, feats, spells, and higher-level HP remain player-managed. Editing an existing character does not rebuild its stats.
- **Attack & feat presets:** weapon dropdowns fill ability, damage, damage type, range/reach, and mastery notes. They suggest proficiency from recorded training and Heavy disadvantage from ability scores; review special features and custom training. Finesse selects the higher Strength/Dexterity modifier. Blowguns use fixed damage, supported alongside dice formulas. The feature editor offers categorized feature and feat presets with summaries, prerequisite guidance, and resource defaults; shared abilities refer to their existing pool. Feature-editor feat presets leave effects to the player; the guided level-up process applies its supported ability, proficiency, spell and HP changes. Other effects, such as Alert initiative, remain explicit sheet adjustments.
- **Spellbook:** add spells, set slots and casting ability, mark known/prepared spells, cast or upcast, and track concentration. Cantrips and ritual/item/feature casting can use no slot.
- **Journal:** create, edit, search, categorize, and pin notes. Open a note to read its full text. Notes are plain text; markup is displayed literally.
- **Dice:** d4–d100, custom formulas such as `2d6+3`, d20 advantage/disadvantage, natural 20s, and session roll history. Dice use the browser's cryptographic random generator without modulo bias.
- **Action VFX:** damage impact flashes, actual HP healing numbers, temporary-HP shields, golden Heroic Inspiration, campfire Short Rests, moonlit Long Rests, portrait-centered level-up celebrations, spellcasting runes, resource bursts, conditions, XP, and natural-20 sparkles. Effects are brief, never block controls, work offline, and use static feedback when the device requests reduced motion.
- **Level-ups:** review new class/subclass features, species and lineage magic, skills/Expertise, feats/ASIs, spells, slots and resource improvements before saving. Uses 2024 options first and unreplaced earlier options afterward. Includes 391 core spells, earlier-book references, Wizard spellbook learning, Pact Magic and Mystic Arcanum, with offline support. [Coverage, edition policy and limits](docs/level-up.md). Celebrate with your portrait, arcane rings, light rays, and a starburst. Sound is off by default.
- **2024 compendium:** browse the built-in equipment and character option dropdowns with stats **offline**. Rules summaries use [SRD 5.2.1](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf), with short reference summaries for additional core-book options. [Catalog coverage and behavior](docs/catalog.md). Default references open individual pages on [the 2024 Wikidot wiki](https://dnd2024.wikidot.com/) or [the earlier 5e wiki](https://dnd5e.wikidot.com/), according to the option’s edition. This includes selected feats during level-up. Older D&D Beyond rules links in saved characters resolve to matching wiki pages when displayed, without changing backups. Custom URLs are preserved. General rules without a wiki page use the free Basic Rules. Older character options remain available under the 2024 guidance for earlier books.

## Saves, backups, and offline use

Data is saved automatically in this browser's local storage. **Character tracking needs no account.** Optional Firebase accounts add per-character cloud saves and live parties. Open **Settings & backup → Account** to sign in and explicitly copy guest characters; originals remain on this device. Account data is separate for each signed-in user. Open **Party** to create a group, share an invitation, and share public character details and combat state. Private notes stay private. Offline gameplay queues durable operations for reconnection; overlapping complex edits offer a copy choice. [Firebase setup, emulator tests and operating limits](docs/firebase-setup.md). Use **Settings & backup → Export** for a version 2 JSON backup. Import adds characters and preserves existing ones; duplicate IDs become separate copies.

The Status strip shows up to six compact condition shortcuts, with active effects first and frequently applied effects next. Names appear on hover and are available to screen readers; the three-dot button opens every tracked condition and the Exhaustion editor. Usage is cached in `questlog.condition-usage.v1` for this browser, separately from character backups; clearing a condition does not increase its usage count. Icons by JinxShadow are bundled from [dnd5e-status-icons](https://github.com/orangetruth/dnd5e-status-icons) and work offline. [Icon provenance](assets/status-icons/CREDITS.md).

Clearing browser data, using private browsing, changing the site's address, or switching browsers can remove access to local saves. Export backups regularly. The app shows an explicit warning when browser storage fails; changes then remain in memory and can still be exported. It will not silently overwrite unreadable saved data.

Backups are validated before import. Each browser supports up to 100 characters and 2 MB of saved data. Over-limit changes remain available in memory for export, but reduce the data before expecting automatic saving to resume. Roll history is session-only and is not included in backups.

**Only save format version 2 is supported.** Browser storage uses `questlog.v2` and starts with an empty journal; existing version 2 characters resume as before; previous browser saves are not read, migrated, or deleted. Version 1 and other backup versions are rejected. Every current sheet field, casting ability, initiative advantage setting, attack note and roll mode, feature formula, and Short Rest recovery value is required, even when empty or zero. Import does not fill in missing fields. All current fields are included in export/import. The optional `portrait` field stores a compact 256 px image and its editable Bricktrait design; saves without it use the starter portrait.

After the first online visit and the **Ready for offline adventures** message, a service worker caches the app, local icons, and original artwork. Character tracking and dice then work offline on HTTPS hosts or localhost. Reference pages need internet access. The app makes no requests to remote fonts, scripts, analytics, or Bricktrait services. The editor’s bundled dependencies and LDraw models are served from this site. The portrait maker requires WebGL. Its editor and parts cache as you use them: reopen once online before using the maker offline; parts you have not loaded yet need a connection. Saved portrait images always remain available with the sheet. For future code releases, bump the cache name in `sw.js` when changing the offline asset set.

## Portrait photo setup

Open the portrait maker and expand **Start from a LEGO photo**. Choose or take
up to three JPG, PNG, or WebP photos of the **same** minifigure (15 MB each).
Designate a primary front view, fit the whole-figure crop and adjust the visible
body regions by dragging or using the sliders. Each region can use a different
photo, with independent crop, rotation and visibility settings.

Choose **Find matching LEGO parts** to compare the photo locally against the
existing **1,634-part** fantasy, CMF and theme catalog. Up to five thumbnails
appear per visible region. Scores describe visual similarity, not probabilities
or exact minifigure identity. Every slot and colour starts unchanged: select a
thumbnail, browse the full searchable category, or explicitly choose **None** for
an optional accessory. Torso arms/hands and leg hips keep their separate colours.
Ambiguous or hidden parts need manual review. **Browse parts manually** works
even without useful matches or another upload.

**Preview reviewed choices** renders a temporary assembly with Bricktrait.
**Apply reviewed choices to Bricktrait** makes one undoable edit, preserving pose
and camera. Choose **Use portrait** separately to save the transparent portrait;
Cancel discards the editor session. Uploaded photos never enter saves, backups,
localStorage, logs, network requests or service-worker caches. Closing the dialog
releases the photo URLs and cancels matching.

Portrait matching needs no API key, service, backend, LLM or machine-learning
model. GitHub Pages serves all matching code, descriptors and thumbnails as
static assets. After opening the app online, use **Cache visual palette for
offline use** to cache the thumbnails as well as the matching index. Recognition
and the visual palette then work offline without downloading the LDraw geometry
catalog. Bricktrait previews and saves still need geometry for the selected
parts: open those parts online first, as with the existing editor.

The build creates a roughly 2.4 MiB descriptor index from transparent LDraw
renders, including extra angled views of headwear and accessories. It compares
colours, silhouette/proportions, contrast-normalized patterns and edges using
category-specific weights. See the [algorithm, reference regeneration and
limitations guide](docs/fantasy-portraits.md#offline-photo-matching).

Photograph one front-facing figure against a contrasting, uncluttered background
in diffuse light. Keep the face, prints and held accessories in focus; rotate
sideways photos before matching. Busy backgrounds, shadows, glare, hidden
accessories and nearly identical prints reduce accuracy. Printed colours are
fixed in the model, so recolouring plastic may not reproduce a photograph.

Run `npm run build:portrait-index` after preparing LDraw assets to regenerate
matching data, or use the normal `npm run build`. Source fingerprints reuse
unchanged references. `npm run test:portrait-photos` exercises real local matching,
manual choices, preview/apply, undo/redo, cancel, transparent saves, mobile crop
controls and offline use; it never mocks a recognition service. Tests use rendered
and synthetic references; real-photo accuracy and physical Safari device testing
remain areas for further validation.

## Rules scope

The optional Lyra sample and rest defaults follow the **2024 core rules**, checked against the official [2024 Basic Rules](https://www.dndbeyond.com/sources/dnd/br-2024) and [SRD 5.2.1](https://www.dndbeyond.com/srd). The revised Monster Manual was published in 2025 as part of this core rules revision.

The level 3 Ranger demo includes Favored Enemy’s two free Hunter’s Mark castings, Weapon Mastery, Deft Explorer, Archery, Hunter’s Lore, Colossus Slayer, a Soldier Origin feat, and Wood Elf lineage magic. Cure Wounds uses its revised Abjuration school and 2d8 healing at level 1. Its scores use rolled starting values with background increases. Ranger preparations, lineage spells, and feature castings are explained in the spell notes. Feature castings require selecting **No slot** and spending the matching feature use manually.

This is an editable tracker, not a complete rules engine. It doesn't enforce character-building choices, spell preparation limits, encumbrance variants, multiclass rules, most condition effects, attacks per turn, massive damage, or concentration checks. Armor class, base speed, damage formulas, hit die size, spell slots, and features are player-managed. Attack accuracy, ability modifiers, skill/save bonuses, passive Perception, and proficiency update from the sheet. Exhaustion modifies sheet ability checks, skills, saving throws (including death saves), attack bonuses, initiative, passive Perception, and walking speed. Ability scores, damage, and spell save DC are unaffected. At Exhaustion 6 the app warns that the character dies; resolve death and other condition effects with your DM. Custom dice formulas do not automatically add Exhaustion.

**Attacks** use a guided setup, hit confirmation, critical damage, mastery follow-ups, and LEGO weapon animations. Choose the base weapon and unlocked mastery in the attack editor. Existing recorded mastery choices are recognized. Cleave and Light/Nick can start additional attacks; Topple can roll the target's Constitution save. Extra attack damage can include tracked feature dice, spending their resources. Target effects and turn limits remain table decisions. [Attack coverage and sources](docs/attacks.md).

**Armor class** updates from equipped armor, shields, defensive items, and ability scores, with a visible breakdown. Light armor uses Dexterity, medium armor caps its Dexterity bonus at +2, and heavy armor uses its fixed base. Monk/Barbarian Unarmored Defense and the Defense fighting style apply when eligible. Equipping two weapons or a two-handed weapon puts away an incompatible shield. To hold two weapons from one inventory stack, select **Wielding → Dual wield (2 from stack)** in the item editor. Magic armor has a base armor selector; defensive items support attunement and an editable AC bonus. **Edit stats** has an AC adjustment for temporary/custom effects and an optional total override; leave the override blank for automatic AC. Prior manually recorded AC remains available as a reference.

**Heroic Inspiration** defaults to a maximum of 1 point per character. For a table override, change **Settings & backup → Heroic Inspiration → Maximum points** (1–999); the sheet then shows the count with gain/spend controls. Lowering the limit keeps points already held. Counts and the limit are saved in backups; importing characters keeps this browser’s limit. In the attack dialog, spend 1 point to replace one selected d20 and use the new result; other rerolls remain manual. It does not grant Advantage. Backgrounds supply ability score increases and an Origin feat; species does not supply ability score increases. The optional Artificer class entry supports supplemental characters; it is not a 2024 Player’s Handbook class.

A qualifying **Long Rest** restores all HP, **all spent Hit Dice**, slots, and short/long-rest resources, normally removes **one Exhaustion level**, clears temporary HP and concentration, and resets death saves. Uncheck Exhaustion recovery when an effect blocks it. Both rests require at least 1 HP at the start. Rest timing and interruptions are adjudicated by the table. Reduced ability scores/HP maximums and benefits such as a Human’s Heroic Inspiration must be restored or recorded manually.

**Short Rest** optionally spends Hit Dice and refreshes short-rest resources. Long-rest resources can also specify a number of uses regained on a Short Rest: for example, 2024 Second Wind at Fighter level 3 has 2 uses, long-rest refresh, and 1 use regained on a Short Rest. Pact slots remain manual. Set a custom spellcasting ability in **Spellbook → Edit slots** for subclasses or house rules. Changing Constitution doesn't retroactively recalculate maximum HP. Leveling updates level, proficiency, current/max HP, and Hit Dice; consult the 2024 class rules to add features, spells, slots, ASIs, and feats.

The photographed Melchior, Balin and Teyla character data remains available to test fixtures for rules and backup compatibility. The app no longer offers the default party. **Settings & backup → Add 2024 example** adds the revised Ranger sample alongside existing characters.

This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode. Rules are summarized and adapted for this tracker.

## Fantasy sound library

**Settings & Backup → Sound effects** enables 60 bundled effects: 55 CC0 sounds and five user-provided clips (under 2 MB with both encodings). Adjust the master slider or individual categories and use **Sound preview → Test sound** to audition cues. Sound remains off by default, and the existing `settings.sound` preference is preserved. Volume preferences use a separate `questlog.audio.v1` browser-storage key; version 2 character backups are unchanged, and volume settings stay on the device.

The user-provided mappings are `24.wav` → Long Rest, `Ability Learn.mp3` → Inspiration gained/spent, `Level Up.mp3` → Short Rest, `Heavy_ConceptB.wav` → level-up, and `audio_oga-levelup-powerup_Rise03.wav` → gain XP. Full clips are retained, normalized and encoded in both formats for offline playback. Their originals live in `scripts/sfx-sources/`; their licenses are recorded as unspecified rather than inferred from filenames.

Equipping and unequipping use the same fixed recording for each item family: blades, daggers, bows, wooden weapons, metal weapons/tools, shields, metal armor, leather armor, cloth, packs, bottles, books, scrolls, coins, jewelry, and spellcasting focuses. These handling cues come from the existing CC0 packs; bow handling uses a wooden creak rather than firing an arrow. Magic presets retain their base type through their rules header, while custom items use their name and category. Effect descriptions and decorative icon choices do not select sounds. The inventory button and the editor's Equipped checkbox share this mapping; saving an unchanged item is silent.

All 14 condition toggles play distinct applied/cleared cues from wobbleboxx's CC0 pack in the existing Open Game SFX Index (`Downer01` / `Rise01`). Both the Status shortcuts and the full condition tracker use these sounds. Increasing Exhaustion plays the applied cue; reducing or clearing it plays the cleared cue. Saving an unchanged level is silent. Adjust **Audio categories → Status effects** or audition either cue in Sound preview. Playback is independent of visual effects and reduced-motion preferences, and both encodings are available offline.

Actual dice rolls, guided weapon attacks, taking damage, spell casts, HP gains, potions, equipment, coins, XP, Inspiration, resource restoration, rests and completed level-ups have semantic cues. Opening the dice interface is silent. Weapon movement plays before a hit is known; impact cues require a confirmed hit/critical. Every positive Damage action plays an impact, including damage absorbed by temporary HP and hits at 0 HP; entering zero is silent. Preview it with **Taking damage** in Sound preview. Healing feedback follows actual HP gains. Spells choose effects by curated names and school, with a generic custom-spell fallback. The brief campfire fades after 12 seconds or when the rest dialog closes, is replaced, navigation changes, or the app is backgrounded. Sound does not alter rules or resolve spell damage/healing automatically.

`sound.js` uses one native Web Audio context unlocked by a user gesture, lazy local decoding with an LRU cache (24 clips), shared pending loads (at most 8), at most 8 live voices (2 per event), cooldowns, and cancellation of pending playback on mute/background. `sound-events.js` owns semantic mappings and variant selection; the generated `sound-assets.js` supplies relative paths. Unsupported Vorbis decodes fall back to the bundled MP3, including offline. Audio errors resolve silently so gameplay continues. There is no runtime third-party request, audio framework, API, LLM or audio conversion. The build copies all assets to `dist/`; the service worker precaches both formats under the installation's subdirectory.

Credits, source/license evidence, curation limitations and per-file provenance: [audio credits](assets/sfx/CREDITS.md), [manifest](assets/sfx/manifest.json), and [license evidence](assets/sfx/license-evidence.json). Dedicated fire/necrotic recordings, a literal drinking gulp and gentle nighttime ambience are gaps. Fire/dark events use neutral casts; radiant/protective spells share a chime. The preview supports listening review; automated checks validate decoding, silence and playback behavior rather than subjective speaker quality.

To add or replace sounds:

1. Read the [source agent guide](https://github.com/Mcamento8/open-game-sfx-index/blob/34bbe8b525b5ceff3804915ea745532af11f6055/docs/AGENT_GUIDE.md). Search categories, tags, use cases and keywords in its catalog, then audition candidates. Download only selected files. Review the original source's explicit CC0 license.
2. Edit `scripts/sfx-selection.json`: use a stable lowercase ID, category, creator and exact catalog ID. The repository revision and catalog SHA-256 are pinned. A supplemental CC0 asset needs a fixed download URL, original SHA-256, source/pack/license, and any explicit excerpt bounds or archive member/hash. Update credits and license evidence. For explicitly user-provided files, retain the original under `scripts/sfx-sources/` and specify `sourceType: "user-provided"`, `localFile`, `format` and `sha256`; record only known license information.
3. Install **FFmpeg** for development and run `npm run import:sfx`. Set `FFMPEG` to its executable path if necessary. The current encodes use FFmpeg 9.0.2 (libvorbis q3 / libmp3lame 96 kbps); use the same version for byte-identical regeneration. The importer validates the catalog and original-file hashes, caches remote sources by SHA-256 in `.cache/sfx/import/`, reads user-provided sources locally, peak adjusts and encodes locally, then regenerates the manifest and asset registry. `npm run import:sfx -- --offline` reproduces from that development cache and the retained local originals. It refuses a hash mismatch or a remote asset without verified CC0 licensing. Normal builds never import or require FFmpeg/network access.
4. Add semantic mappings to `sound-events.js` and hook successful gameplay actions, avoiding nested duplicate cues. Commit the selected OGG/MP3 files, selection, manifest, generated registry and credits together.
5. Run `npm test`, `npm run check`, `npm run build`, and `npm run test:sounds`. The browser test checks the production `/dist/` subdirectory, every clip in both encodings, real gameplay, mobile settings, mute, persistence and offline playback. It uses installed Chrome/Firefox/Edge or `BROWSER_PATH`. Test mobile Safari separately before release.

## 3D dice

Custom rolls, checks, saves, attacks, damage, feature dice, Hit Dice, and healing potions use
[open-dice](https://github.com/richardhealy/open-dice) (`open-dice-dnd` 1.13.0) for
physical 3D throws. Dice land on the same unbiased random values recorded by the
rules model; animations never change a result, spend a second resource, or delay
HP updates. Totals, breakdowns, combat outcomes, and the newest history entry
appear after the dice settle. Reduced motion and unavailable 3D rendering reveal
the result immediately. Advantage/disadvantage shows both d20s, with the kept
result highlighted after settlement. Mobile dice use twice their previous drawing
scale in a taller tray, preserving the complete throw without clipping.
A d10's 0 means 10; percentile 00 + 0 means 100.

The engine and its compatible Three.js/Cannon dependencies are bundled locally
by `npm run build:dice` (also part of dev/start/build), with licenses in
`dice-engine/licenses/`. No CDN or remote dice service is used. The service worker
caches the engine for offline play. Reduced motion, unavailable WebGL, unusual
die sizes, and pools above 20 physical dice use the complete text result instead
(each d100 uses two physical dice). Closing a dialog or leaving the page releases
the renderer. The portrait editor keeps its existing Three.js version.

`npm run test:dice` checks real landing faces, modifiers, advantage/disadvantage,
rapid rerolls, cleanup, mobile layout, reduced motion, WebGL failure, and offline
loading under `/dist/`. Build first; set `BROWSER_PATH` to Chrome/Chromium for the
complete browser suite, or `DICE_TEST_URL` for an already-running production preview.

## Check and build

```sh
npm run check
npm test
npm run build
```

Before pushing, run `npm run verify:deploy` for those checks plus all required
production browser suites. Set `BROWSER_PATH` to Chrome/Chromium. To test an
existing build, use `npm run test:deploy`; it starts a preview under `/dist/` and
cleans up afterward. Pull requests run these same deployment gates before merging.
CI builds once, then runs five browser groups on separate runners against the same
artifact. Every group must pass before Pages publication. Use
`npm run test:deploy -- --group portraits` to run an individual group locally.
The [deployment time audit](docs/deployment-checks.md#deployment-time-audit--november-16-2026)
records measured bottlenecks, cache behavior and check frequency.

The output is `dist/`. The same app can be previewed at `http://localhost:4173/dist/` after building, which also exercises repository-subpath hosting.

Pages deployments cache the generated LDraw packs, portrait matching index and
thumbnails. A full cache miss rendered 4,830 references in about 73 minutes
on a GitHub runner in the November 16 audit; unchanged references should log `references unchanged` on
later builds. The cache key covers the renderer sources, catalogs and dependency
lockfile. Successful builds save their generated assets **before** running tests,
so a later test or deployment failure does not force another full render.
Source, unit and browser checks still run on every deployment, with separate
timings and timeouts. New pushes cancel superseded builds; active Pages
deployments finish without interruption.

The portrait browser suite allows ten minutes for its serial SwiftShader editor
sessions. Each check logs its start, duration and total elapsed time, so a slow
render can be distinguished from a stalled wait. The editor uses bundled part
thumbnails first; only missing images and custom colours need live rendering.

Source layout: `app.js` handles views and interactions, `model.js` contains character and dice logic plus backup validation, `catalog.js` contains equipment/character-option data and preset mapping, `feature-catalog.js` contains feature/resource references, filtering, and scaling defaults, `catalog-ui.js` contains dropdowns and stat previews, `default-characters.js` supplies empty fresh state and photographed character fixtures for tests. `styles.css` contains the responsive design, `art.js` and `icons.js` contain original SVG assets, and `sw.js` enables offline use. `scripts/` contains the dependency-free server and build tools. `tests/` covers rules calculations, catalog integrity, preset backup compatibility, and portrait matching.

Design research: the familiar sheet/inventory/spell/journal organization was informed by [D&D Beyond's sheet sections](https://dndbeyond-support.wizards.com/hc/en-us/articles/7747193946388-Sheet-Sections). Questlog's visual design and pixel artwork are original. Questlog is an independent fan project and is not affiliated with Wizards of the Coast.

## Bricktrait attribution

The portrait editor reuses [Bricktrait by Maxichance](https://github.com/Maxichance/bricktrait) under its MIT license, pinned at `f333d939753526469e4169481d578aed74e955ed`. Source and integration notes are in [vendor/bricktrait](vendor/bricktrait/README.md). The built editor includes the MIT license, dependency licenses, and LDraw’s per-file credits and CC BY license texts. LEGO® is a trademark of the LEGO Group, which does not sponsor, authorize, or endorse this project. Questlog and Bricktrait are not affiliated with the LEGO Group, LDraw.org, or any game publisher.

`npm run test:portraits` exercises the real editor, per-character saves, cancellation, reopening, backup import, mobile layout, and offline use in a headless Chromium browser. Start `npm run dev` first. It detects Microsoft Edge or Chrome, or uses `BROWSER_PATH`; `PORTRAIT_TEST_URL` can point at a build preview, including `/dist/` to verify relative asset paths.

Fantasy catalog and equipment icon maintenance, build requirements, and regression coverage: [Fantasy Bricktrait guide](docs/fantasy-portraits.md). Inventory and mapped weapon attacks use 239 small, bundled LEGO thumbnails. Add or edit an inventory item and open **Item icon → Browse library** to choose artwork. Search by name, keyword, category or LDraw part number; **Automatic** restores name/category matching. The library includes 111 additional weapons, shields, helmets, artifacts, foods and tools for custom items. Icon choices stay with each item in saves and JSON backups. Every equipment preset and default inventory item has an automatic mapping, with SVG fallbacks for unavailable images. Run `npm run test:item-icons` for the picker browser checks.

## Appearance

The live Party table includes shared initiative, spectator dice, accepted item
and coin transfers, group rest replies, a skill finder, and Session Mode. Party
notification preferences are in **Settings → Party**. See the
[party play architecture and verification guide](docs/party-play.md); deploy its
updated Firestore rules alongside the app.

Questlog uses a shared fantasy journal interface in **Daylight Adventurer** and **Candlelit Adventurer** appearances, with a System option that follows your device. Change it on the welcome page, desktop sidebar, or in Settings & backup. Appearance stays on this device, separately from character backups.

See [the appearance architecture and validation guide](docs/appearance.md) and [GUI asset credits](assets/gui/README.md). During development, open `/dev/theme-showcase.html` to compare production components in both appearances; the workshop is excluded from the static build. Run `npm run test:themes` for functional appearance and offline checks. Run `npm run test:visual` separately for optional contrast and layout review; see [deployment check policy](docs/deployment-checks.md).

# Published feat catalog

The app bundles **269 feat presets** across 19 sources, reviewed on November 15, 2026 against the [publisher’s feat index](https://www.dndbeyond.com/feats) and individual [current](https://dnd2024.wikidot.com/feat:all) and [earlier](https://dnd5e.wikidot.com/) reference pages. These represent 266 feats: Magic Initiate has three spell-list presets and Boon of Siberys has two spell-source presets.

The catalog follows the existing edition policy: use the current version of a revised feat, retaining earlier feats without a replacement. Mobile is represented by Speedy. Older core versions do not appear as duplicate choices. Coverage includes officially published supplements and digital releases through the review date. Unearthed Arcana, third-party/homebrew options, and the November 17 World of Warcraft release are excluded.

| Source | Presets |
| --- | ---: |
| Player’s Handbook (2024) | 77 |
| Player’s Handbook (2014), unreplaced options | 3 |
| Tasha’s Cauldron of Everything, unreplaced options | 5 |
| Xanathar’s Guide to Everything | 15 |
| Elemental Evil Player’s Companion | 1 |
| Eberron: Rising from the Last War | 1 |
| Fizban’s Treasury of Dragons | 3 |
| Strixhaven: A Curriculum of Chaos | 2 |
| Dragonlance: Shadow of the Dragon Queen | 9 |
| Bigby Presents: Glory of the Giants | 8 |
| Planescape: Adventures in the Multiverse | 7 |
| The Book of Many Things | 1 |
| Forgotten Realms: Heroes of Faerûn | 34 |
| Astarion’s Book of Hungers | 16 |
| Lorwyn: First Light | 2 |
| Eberron: Forge of the Artificer | 29 |
| Ravenloft: The Horrors Within | 11 |
| Arcana Unleashed | 29 |
| D&D Beyond Drops, through November 5, 2026 | 16 |

Categories remain **Origin feats**, **General feats**, **Fighting styles**, **Epic boons**, and **Earlier feats**, with separate **Dragonmark feats**, **Planar pact feats**, and **Dark gift feats**. Greater dragonmarks are General feats; the base marks have their own category. The feature editor and compendium combine category, source, and text filters. The compendium’s **Feats** view shows only feats; its **Origin feats** view includes supplemental origins. Level-up choices also retain categories and source labels.

Strike of the Giants includes all six strike choices in its notes and a shared proficiency-bonus pool that resets on a Long Rest. Each follow-up feat identifies the required strike. Damage, saving throws, and the strike choice remain explicit player decisions. Rune Shaper records its rune choices separately because each rune has an independent casting allowance. Feats granting multiple independent limited benefits also direct the player to create separate resources.

All eight Bigby presets are available: **Strike of the Giants**, **Rune Shaper**, **Ember of the Fire Giant**, **Fury of the Frost Giant**, **Guile of the Cloud Giant**, **Keenness of the Stone Giant**, **Soul of the Storm Giant**, and **Vigor of the Hill Giant**. In Add feature, choose **All options** to see feats above your current level, and ensure **Bigby Presents: Glory of the Giants** is enabled in **Settings & backup → Content sources**. Disabling a source hides its presets and level-up choices without altering already saved feats or resources.

Level-up enforces recorded feat chains, base dragonmark/pact exclusivity, supported casting and training/background alternatives, species, level, and supported ability increases. Campaign permission, a specific giant strike, magical moon, college, planar association, or other selections recorded only in notes must be checked against the linked rules. Potent Dragonmark’s ability increase is manual because the sheet does not store the chosen dragonmark casting ability. Dark Gifts remain available as catalog references, but are campaign gifts rather than ordinary ASI choices.

Supplemental entries contain original brief summaries and prerequisite facts, not complete book text. Selecting a preset creates an editable snapshot; it does not automatically apply damage, defenses, movement, or spell selections. New supplemental feat data lives in `published-feat-data.js`; core and existing earlier entries remain in `feature-catalog.js`. Both files ship with the static build and offline cache. Coverage tests check source totals, giant follow-ups, categories, source search, resource recovery, prerequisite chains, and backup compatibility.

Publication checks for newer sources use the publisher’s [2026 release dates](https://www.dndbeyond.com/posts/2039-d-d-release-dates-for-emea-region-in-2026), [Arcana Unleashed guide](https://www.dndbeyond.com/posts/2203-everything-you-need-to-know-about-arcana-unleashed), [subscriber content listing](https://www.dndbeyond.com/en/library/subscriber-content), and [World of Warcraft release notice](https://www.dndbeyond.com/posts/2271-dungeons-dragons-world-of-warcraft-in-store).

# Questlog audio credits

All 49 included effects are distributed under **CC0 1.0 Universal**:
<https://creativecommons.org/publicdomain/zero/1.0/>. Credit is retained for provenance even though attribution is not required. No paid, attribution-only, or share-alike audio is included.

44 effects were selected from [Open Game SFX Index](https://github.com/Mcamento8/open-game-sfx-index) at commit **34bbe8b525b5ceff3804915ea745532af11f6055**. Its [agent guide](https://github.com/Mcamento8/open-game-sfx-index/blob/34bbe8b525b5ceff3804915ea745532af11f6055/docs/AGENT_GUIDE.md), catalog, source list and attribution record were reviewed. Only selected files were downloaded. The index metadata is MIT licensed; copyright (c) 2026 Mcamento8 (see [upstream LICENSE](https://github.com/Mcamento8/open-game-sfx-index/blob/34bbe8b525b5ceff3804915ea745532af11f6055/LICENSE)).

| Creator | Original pack / license evidence | Included assets |
| --- | --- | --- |
| Kenney | [Casino Audio](https://kenney.nl/assets/casino-audio), CC0 | 7 dice effects |
| Ogrebane | [Battle Sound Effects](https://opengameart.org/content/battle-sound-effects), CC0 | Bow release and 3 swings |
| Kenney | [RPG Audio](https://kenney.nl/assets/rpg-audio), CC0 | 3 blade effects, 10 inventory/book effects |
| Kenney | [Impact Sounds](https://kenney.nl/assets/impact-sounds), CC0 | 7 physical impacts |
| artisticdude | [RPG Sound Pack](https://opengameart.org/content/rpg-sound-pack), CC0 | 2 casts, chainmail, bottle, bubble |
| Kenney | [Music Jingles](https://kenney.nl/assets/music-jingles), CC0 | 6 PIZZI acoustic string stingers |
| Kenney | [Interface Sounds](https://kenney.nl/assets/interface-sounds), CC0 | Confirmation and error |
| bart | [Ice spells](https://opengameart.org/content/ice-spells), CC0 | `coldsnap.wav` excerpt |
| Augmentality (Brandon Morris), submitted by HaelDB | [Spell sounds](https://opengameart.org/content/spell-sounds), CC0 option selected | Healing and electric spell excerpts |
| JaggedStone | [Magic Spell SFX](https://opengameart.org/content/magic-spell-sfx), CC0 | `magical_1_0.ogg` |
| PagDev | [Fireplace Sound loop](https://opengameart.org/content/fireplace-sound-loop), CC0 | 10-second campfire excerpt |

The last five effects supplement gaps in the catalog. The Spell sounds page offers multiple licenses; these files are used under its explicit CC0 option. `license-evidence.json` records verification of every original source page, its CC0 declaration and HTML hash, alongside pinned catalog evidence (checked November 13, 2026).

`manifest.json` is the per-file record: stable ID, paths, source catalog ID (null for the five supplements), creator, pack, source/download URLs, original SHA-256, extracted archive-member hash where applicable, duration, tags, edits, output hashes and byte counts. Original sources are not redistributed as uncompressed WAVs. Files are mastered to mono 44.1 kHz Vorbis q3 and MP3 96 kbps; peak adjustment is capped at +20 dB, with a -3 dB limiter before encoding. Lossy encoding can introduce small peak overshoots. Healing starts at 11.45 seconds and lightning at 3.2 seconds in their original multi-take recordings to remove long silent introductions.

## Coverage and curation limits

Dice, checks, natural 20/1 feedback; sword, dagger, heavy swing, bow/thrown movement, blunt/unarmed/arrow impacts, miss and critical; generic, cold, lightning, healing and protective/radiant magic; XP, level, resources, Inspiration; rest completion/campfire; potion/bottle handling, equipment, coins, items, books and confirmation/error feedback are covered. Impact recordings are reserved for confirmed hits; unknown/custom attacks use movement. Bottle/bubble effects accompany potion use; healing plays separately only when HP increases.

Dedicated fire and necrotic recordings were not found in the reviewed CC0 selection: these events deliberately use neutral spell casts, rather than mislabeled fire or monster sounds. Radiant/protection share a magical chime. Fizzle shares a subdued error cue and is available to future gameplay failure hooks; Questlog does not currently resolve spell success/failure. A literal gulp and gentle nighttime ambience are also gaps. Campfire plays briefly instead of an endless nighttime loop. The OGA Level-Up & Coins pack was reviewed but its electronic pickups were not chosen; acoustic PIZZI stingers supply progression feedback. No NES/chiptune, futuristic weapon, voice, or cartoon effects were selected.

Audio was decoded and inspected for duration, silence, levels and valid encoding. This runner cannot make subjective listening judgments; use **Settings & Backup → Sound preview** for listening review on target speakers, especially mobile Safari. Every imported clip can also be opened directly from its manifest path. Do not treat metadata or successful decoding as a guarantee of subjective fit.

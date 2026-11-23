# Character creation

New Character opens an eight-step builder and creates a level 1 character. Use Back to revise prior choices and Cancel to discard the draft. The identity step previews subclasses for the chosen class. Choose your subclass when you reach level 3 through Level up.

## Architecture audit

| Area | Reused | Level-1 addition |
| --- | --- | --- |
| Character and navigation | `app.js` modal, sheet route, account storage and sync, `model.js` character and backup validation | A modal-owned draft and a single validated local roster write before the existing cloud queue observes the new sheet |
| Class and origin catalog | `catalog.js` class training, hit dice, background and species rows, `applyStartingOptions()`, `training-rules.js` keys and exact weapons | Class and origin selections, lineage and ancestry choices, background ability increases, skill Expertise, and provenance |
| Progression | `level-up.js` and `level-up-ui.js`, `progression-data.js` and `progression-options.js`, catalog features and resource calculations | A first-level plan with a zero prior *progression row*, using a valid level-1 character, and shared materializers for features, spells and Origin feat choices |
| Spells | Existing catalog, spell cards, casting modal and rest counters | Independent Wizard preparations, merged spell entries with distinct origins, and free casting linked to the granting counter |
| Inventory | Item catalog, linked weapon actions, and automatic AC | Catalog-backed packages, in-package choices, coin alternatives and purchases using existing price parsing |
| Storage | Version-2 JSON, private Firestore content fragments, and service-worker pre-cache | Optional validated fields and an explicit build/cache entry for each new module |

The rules module evaluates the same choices for preview and finalization. Choose the standard array, 27-point buy, manual scores, or six 4d6 rolls. The builder shows each dropped die alongside its three kept dice and total. Assignments are indexed by roll or array entry so equal totals can be used independently.

Pick class skill proficiencies alongside training granted by your species and background. The Features and feats step shows the background’s Origin feat and its choices. A custom or earlier-book background lets you select an Origin feat. A table-approved replacement can be selected for a built-in background.

A level 1 Wizard chooses three class cantrips, six level 1 spellbook entries, and four prepared spells. Suggested selections can fill those choices in one click. Species and feat spells have their own sources, casting abilities, and free-use counters where applicable.

## Spell slots

New sheets calculate slot maximums by class, level, and spellcasting subclass. Use **Level up** to add or advance a class. Use **Character Details** to enter an existing class breakdown and **Spellbook → Edit slots** to enable automatic calculation for an older sheet or set an override. Pact Magic has its own expenditure and Short Rest recovery.

Use the Short Rest dialog to choose slots to recover with Arcane Recovery. A held, attuned Arcane Grimoire increases its budget. Spell Recall rolls for qualifying casts. A Sorcerer can spend tracked Sorcery Points in Spellbook to add a temporary slot that expires on a Long Rest. Other item charges, recovery effects, and table adjustments can be recorded with the slot and item controls.

## Supported editions and table decisions

- Core choices cover the twelve 2024 classes, the ten 2024 species and their lineages, all sixteen 2024 backgrounds, and the core Origin feats. Aarakocra uses its Monsters of the Multiverse traits. Half-Elf and Half-Orc use their earlier species traits with 2024 background ability increases. Artificer uses the app’s Tasha-era progression and equipment.
- Table-approved species and backgrounds can provide manual traits, chosen skills and tools, languages, and spell references. The book’s original effects and extra gear must be reviewed at the table. Other supplemental Origin feats require the player to record their selections and table-managed effects.
- **Level up** guides single-class and multiclass advancement from the same sheet. See the [level-up guide](level-up.md) for prerequisites, Hit Dice, and spell preparation.
- Starting purchases use priced, enabled mundane equipment. Firearms and firearm ammunition are table-controlled. Ammunition in packages is stored in the inventory’s existing bundles, including the count of individual shots per bundle.

## Rules references

The builder uses original summaries and structured rules data. Class packages and core mechanics refer to the [System Reference Document 5.2.1](https://www.dndbeyond.com/srd) by Wizards of the Coast LLC, available under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode). See the [2024 character creation rules](https://www.dndbeyond.com/sources/dnd/br-2024/creating-a-character), [character origins](https://www.dndbeyond.com/sources/dnd/br-2024/character-origins), and [published background and feat overview](https://www.dndbeyond.com/posts/1785-the-backgrounds-and-origin-feats-in-the-2024) for the rules used in the builder.

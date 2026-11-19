# Character creation

New Character opens an eight-step builder. The roster and existing sheet remain open to the same saved data until the player confirms a complete build. Use Back to revise prior choices and Cancel to discard the draft.

## Architecture audit

| Area | Reused | Level-1 addition |
| --- | --- | --- |
| Character and navigation | `app.js` modal, sheet route, account storage and sync, `model.js` character and backup validation | A modal-owned draft and a single validated local roster write before the existing cloud queue observes the new sheet |
| Class and origin catalog | `catalog.js` class training, hit dice, background and species rows, `applyStartingOptions()`, `training-rules.js` keys and exact weapons | Class and origin selections, lineage and ancestry choices, background ability increases, skill Expertise, and provenance |
| Progression | `level-up.js` and `level-up-ui.js`, `progression-data.js` and `progression-options.js`, catalog features and resource calculations | A first-level plan with a zero prior *progression row*, using a valid level-1 character, and shared materializers for features, spells and Origin feat choices |
| Spells | Existing catalog, spell cards, casting modal and rest counters | Independent Wizard preparations, merged spell entries with distinct origins, and free casting linked to the granting counter |
| Inventory | Item catalog, linked weapon actions, and automatic AC | Catalog-backed packages, in-package choices, coin alternatives and purchases using existing price parsing |
| Storage | Version-2 JSON, private Firestore content fragments, and service-worker pre-cache | Optional validated fields and an explicit build/cache entry for each new module |

The rules module evaluates the same choices for preview and finalization. Assignments are indexed by roll or array entry so equal totals can be used independently. Wizard spellbook entries have their own class preparation status. An independent grant can keep a spell ready even when the Wizard has it unprepared. Always-prepared class spells such as the Ranger’s Hunter’s Mark have separate allowances.

New private records can carry `size`, `lineageAbility`, `trainingOrigins`, feature `origin`, and spell `classPrepared` and `castingGrants`. These fields are optional in version-2 backups. The party projection still publishes its existing allowlisted data. Firebase stores the same completed character as the local journal. If the cloud queue is unavailable after a local save, the local character remains intact.

## Supported editions and table decisions

- Core choices cover the twelve 2024 classes, the ten 2024 species and their lineages, all sixteen 2024 backgrounds, and the core Origin feats. Half-Elf and Half-Orc use their earlier species traits with 2024 background ability increases. Artificer uses the app’s existing Tasha-era progression and equipment.
- Table-approved species and backgrounds can provide manual traits, chosen skills and tools, languages, and spell references. The book’s original effects and extra gear must be reviewed at the table. Other supplemental Origin feats require the player to record their selections and table-managed effects.
- Higher-level starts run each single-class level through the existing guide. Multiclass starts, table-awarded treasure, and supplemental subclasses or features without structured progression require manual handling. Conditional effects, combat decisions, and temporary changes still use the sheet’s existing controls or are resolved at the table.
- Starting purchases use priced, enabled mundane equipment. Firearms and firearm ammunition are table-controlled. Ammunition in packages is stored in the inventory’s existing bundles, including the count of individual shots per bundle.

## Rules references

The builder uses original summaries and structured rules data. Class packages and core mechanics refer to the [System Reference Document 5.2.1](https://www.dndbeyond.com/srd) by Wizards of the Coast LLC, available under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode). See the [2024 character creation rules](https://www.dndbeyond.com/sources/dnd/br-2024/creating-a-character), [character origins](https://www.dndbeyond.com/sources/dnd/br-2024/character-origins), and [published background and feat overview](https://www.dndbeyond.com/posts/1785-the-backgrounds-and-origin-feats-in-the-2024) for the rules used in the builder.

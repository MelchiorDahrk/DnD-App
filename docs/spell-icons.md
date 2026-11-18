# Spell artwork

Spell artwork has its own pipeline. Equipment, weapons, magic items, actual wands, and their existing manual artwork choices continue to use `item-icons.js` and the LEGO/LDraw library.

`spell-icons.js` selects and renders artwork in the Spellbook, prepared sheet actions, casting dialog, Compendium links, level-up spell choices, and shared party details. All artwork is local and precached by the service worker. Relative `./assets/spell-icons/` paths work at a GitHub Pages project subdirectory. A missing asset reveals an original built-in arcane star rather than equipment artwork.

Selection is deterministic:

1. A valid optional `spellIconKey` overrides automatic artwork.
2. An exact normalized spell name uses `spell-icon-mappings.js`. All 397 catalog spells have deliberate mappings using 246 different SVGs. Legacy spell names have explicit aliases.
3. Structured effect data selects effect artwork. No notes, arbitrary name substrings, or prose descriptions are interpreted.
4. Each of the eight schools has different fallback artwork. Unknown schools use an arcane swirl.

Name normalization ignores capitalization, accents, apostrophes, and punctuation. Manual artwork is never overwritten by name, school, preparation, or level-up changes. Unknown or removed icon keys safely return to automatic selection while remaining in backups for forward compatibility.

The spell editor's **Icon → Browse library** control offers search (including associated spell names), category filters, preview, and **Automatic**. Only the stable key is saved. Older version 2 saves need no migration. Local saves, JSON backups, cloud content fragments and field updates preserve the field. The public party spell projection includes this artwork key without exposing notes or other private metadata.

Homebrew/imported spell metadata can supply these optional fields without changing the save version:

```js
{ name: 'Winter Lance', damageType: 'cold' }
{ name: 'Planar Crossing', effects: ['teleportation'] }
{ name: 'Call a Companion', summon: { creatureType: 'beast' } }
{ name: 'Soothing Pulse', healing: { formula: '2d8' } }
```

Supported damage types are fire, cold, lightning, thunder, acid, poison, necrotic, radiant, psychic, and force. The selector also accepts `damageTypes`, `damageInflict`, `damage.type`, `damage.damage_type.name`, and `effects: [{type:'damage', damageType:'fire'}]`. Effects can be supplied with `effect`, `effectType`, `effects`, or `effectTags`; supported semantic tags appear in `EFFECT_SPELL_ICONS`. Summoned creature types appear in `SUMMON_SPELL_ICONS`. For multiple damage types, the first recognized type in the structured list wins. Healing and explicit utility effects precede damage matching. Artwork choice never changes spell rules or sounds.

To extend the library:

1. Add or edit a row in `SPELL_ICON_ASSIGNMENTS` (`icon-key|color-tone|Spell name;Another name`). Use an existing Lorc or Delapouite Game-icons.net identifier. Add school/effect rules in the same module when needed.
2. Run `npm run import:spell-icons` with network access. This imports only referenced SVGs from a pinned upstream Git revision and regenerates `spell-icon-manifest.js` and per-asset credits. Runtime and normal builds need no network access to Game-icons.net.
3. Run `node scripts/check-spell-icons.mjs`, `node --test tests/spell-icons.test.mjs`, `npm run build`, and `npm run test:spell-icons`. The browser suite also runs in the production deployment matrix.

The importer preserves all artwork path geometry and removes the opaque black canvas for transparency. CSS masks apply muted theme ink and a matching radial glow without duplicating SVG markup. Both themes retain at least 3:1 contrast for icon ink against its background. Shape, visible spell names, and standard controls convey meaning independently of color.

Artwork is by **Lorc** and **Delapouite**, from [Game-icons.net](https://game-icons.net/), under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). [Individual credits, original pages, pinned source revision, and modifications](../assets/spell-icons/CREDITS.md) are also available through Settings and the picker.

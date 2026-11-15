# Inventory packs and uses

The seven equipment packs use the 2024 contents from [the official equipment rules](https://www.dndbeyond.com/sources/dnd/br-2024/equipment), also available in SRD 5.2.1 (CC BY 4.0). Scholar’s Pack contains parchment. Equipment kits without individually specified quantities and catalog weights remain intact; no component counts are invented.

Unpack previews the contents, consumes one pack, and adds catalog items with their own weights, notes, and icons. Matching entries stack; customized notes, units, and counters remain separate. Entry limits are checked before changing anything. The animation uses local item art and respects reduced motion.

All carried physical presets have weights; missing rules weights use labeled, editable estimates. Small items such as candles and paper contribute fractional pounds. Packs containing these items use the sum of their contents and note the original listed pack weight, so unpacking preserves the total. Listed negligible magical objects and nonphysical effects retain explicit zero-weight notes. Existing saved or custom weights are preserved.

Zero-quantity entries are removed on quantity changes, use, edit, unpack, and load. Favorites remain at zero and can be replenished; removing the favorite also removes the empty entry.

Healer’s Kit defaults to ten uses. Ammunition catalog entries retain their existing bundle units and track the pieces in the current bundle. Previously saved individual arrows stay individual. Single-use consumables spend quantity as before. Reusable tools have no invented limits.

Optional `maxUses`, `usesLeft`, and `consumeOnEmpty` fields keep version 2 saves compatible. The counter applies to the current item. Depleting a disposable item reduces quantity and starts the next item at full uses. Rechargeable items keep their quantity at zero uses; players edit remaining uses after recharging. Rests do not refill equipment. The item editor supports custom limits and overrides.

Run `node --test tests/inventory.test.mjs` and `npm run test:inventory` for rules, persistence, browser interactions, reduced motion, and offline checks.

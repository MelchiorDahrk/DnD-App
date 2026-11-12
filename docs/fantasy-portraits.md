# Fantasy Bricktrait portraits and equipment

Questlog extends its existing vendored Bricktrait, pinned at
`f333d939753526469e4169481d578aed74e955ed`. The renderer, LDraw library,
parts picker, colours, poses, camera, history, and message bridge remain in use.

## Transparent portraits and existing saves

New portrait defaults are `background: 'none'`, `ring: false`,
`shape: 'square'`, and `outline: false`. The WebGL stage already clears to alpha;
the composer leaves those pixels transparent and WebP preserves them.

In the embedded editor, scene controls are hidden. The editor normalizes a
**copy** of a reopened design's style and enforces transparency again at preview
and save. Parts, colours, pose, camera and zoom are preserved. The old flattened
image and design in the version 2 save remain untouched until **Use portrait**.
Cancel (including Escape) discards changes. No image background removal or save
migration runs. The standalone Bricktrait page retains its scene controls.

## Maintain the part allowlist

Edit [`vendor/bricktrait/fantasy-catalog.json`](../vendor/bricktrait/fantasy-catalog.json).
It contains **527 approved parts** grouped by the existing `head`, `headgear`,
`torso`, `legs`, `neck`, `back`, and `hand` categories. Each ID has a readable
description for review. Descriptions and theme metadata do not decide eligibility.

- `categories`: normal approved IDs, including the synthetic `standard` legs.
- `include`: explicit additions, including useful Ninjago, City and Star Wars
  pieces whose models are appropriate for fantasy.
- `exclude`: explicit denials with review reasons; these always take precedence.

Add an ID to the correct category or `include` without changing a component.
Find IDs and descriptions in the generated `portrait-maker/ldraw/catalog.json`.
Rebuild after editing. The build fails on unknown IDs, category mismatches, empty
slots, and equipment mappings that refer to unavailable parts.

Browsing, filter counts, search, favourites, recent parts and randomization all
use the allowlist. Full catalog metadata and geometry stay available to the
renderer: an excluded part already equipped in a save remains visible and
editable, without appearing as a new choice. Randomization changes the figure
only when the user requests it; it never repairs or substitutes saved parts.

## Maintain equipment icons

Edit [`equipment-icons.js`](../equipment-icons.js). Its 58 entries specify
an LDraw part ID and colour, or a short `parts` assembly of LDraw placements,
plus exact equipment names. Names are normalized for
case, whitespace, punctuation and apostrophes; there is no fuzzy guessing or
substring matching. `itemFromEquipment()` creates independent inventory IDs,
so icon lookup deliberately uses names. Both legacy and new inventory items
work without changing version 2 data. Renaming to an unmapped name uses an SVG.

The mapping covers every one of the 63 inventory entries on Melchior, Balin and
Teyla, including explicit plural names and named magic items. It also covers
common blades, axes, polearms, bows, shields, staves, wands, bottles, books,
lights, tools, packs and instruments. Kits use a case or their representative
tool; magical variants use the relevant weapon, bottle, scroll or token model.
Small brick assemblies represent bedrolls, mess kits, chalk and metal pegs.
Unmapped custom items and instruments without a suitable model retain SVGs. Models are
representative LEGO accessories, not illustrations of exact D&D dimensions.
Inventory equip/unequip never changes portraits.

The sheet pack preview, mapped weapon attacks, and inventory list share the same
lazy, asynchronously decoded 160×160 WebPs. All 58 files (about 110 KB) are bundled under
`assets/equipment/`, and need no WebGL in inventory. Failed image loads remove
the image and reveal the original SVG. The service worker precaches the entire
small icon set, even if some inventory items have not been viewed yet.
The normal sheet keeps its three-item pack preview plus favorites. All items
also show their icons in Inventory; starring an item displays it on the sheet.

Additional tiles, gems, feathers, and bars are included by the existing LDraw
packer only when explicitly referenced by an icon recipe. Their dependencies
and author credits are bundled by that same pipeline. These icon-only models
do not expand the portrait allowlist. The build detects missing icon part packs
and refreshes the cached library as needed.

## Build and verify

Use Node 24 and `npm ci`, then:

```sh
npm run check
npm test
npm run build
node scripts/serve.mjs
# In another terminal:
PORTRAIT_TEST_URL=http://127.0.0.1:4173/dist/ npm run test:portraits
npm run test:sheet
```

On PowerShell set `$env:PORTRAIT_TEST_URL='http://127.0.0.1:4173/dist/'` before
running the test command. Use `--write-default` with
`node scripts/test-portraits.mjs --write-default` to regenerate the bundled
starter from Bricktrait, then `node scripts/build.mjs` to copy it to `dist/`.

The build fetches/caches LDraw as before, validates the catalog, renders missing
or stale equipment WebPs through **the existing `drawThumb` and `Stage`**, builds
the editor, and copies static assets. `npm run build:item-icons` rerenders just
equipment once LDraw is built. Renderer/source/catalog fingerprints avoid
unnecessary renders. A failed equipment render fails the build.

Rendering needs a Chromium browser when assets are missing or stale: set
`CHROME_PATH` for generation and `BROWSER_PATH` for tests. Windows Edge and
common Chrome/Chromium locations are detected. GitHub Actions explicitly installs
Chrome and its dependencies and supplies both paths. No thumbnail API or CDN is
used. No new runtime dependency is required.

The browser suites check alpha pixels and nonempty geometry for portraits and
every icon, all 63 default items and mapped weapon attacks on the sheet, legacy
styles/excluded parts, favourites/recent/search restrictions, save/cancel,
backups with inventory, missing assets, desktop/mobile, and offline save and
icons. CI serves the built site at `/DnD-App/` for both suites. Relative
URLs also support `/dist/` and GitHub Pages without a router or server backend.

Portrait geometry remains cached on demand: open the editor and desired parts
online before using those designs offline. This preserves the previous offline
behavior without downloading the entire LDraw library to every browser.

MIT Bricktrait attribution, dependency licenses, LDraw per-file `CREDITS.txt`,
and LDraw license texts remain in the deployed `portrait-maker/` directory.
The editable allowlist is also copied there; the equipment mapping ships as a
normal app module. Keep these files with any redistributed icons. LEGO® does
not sponsor, authorize, or endorse Questlog or Bricktrait.

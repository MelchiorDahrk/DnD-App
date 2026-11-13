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
It contains **527 fantasy parts** grouped by the existing `head`, `headgear`,
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

The independent [`vendor/bricktrait/cmf-catalog.json`](../vendor/bricktrait/cmf-catalog.json)
snapshot records **365 CMF-associated parts**. It records IDs associated with Collectible
Minifigures by LDraw header keywords, plus reviewed mohawk and D&D CMF additions.
Shared moulds can appear in both collections. Tags and model coverage are
incomplete: this is not an inventory of every CMF series. The existing explicit
exclusions take precedence across both collections. Refresh the snapshot with
`node scripts/update-cmf-catalog.mjs` after the LDraw catalog is prepared; review
the resulting diff. No catalog or CMF metadata is fetched at runtime.

The picker defaults to **All collections**, with separate **Fantasy**, **CMFs**
and **Theme parts** collection filters. CMF search terms are indexed independently
of theme. All browser views, randomization and photo suggestions use the combined
explicit catalog. Existing excluded saved parts remain renderable as before.

## Theme coverage

[`vendor/bricktrait/theme-catalog.json`](../vendor/bricktrait/theme-catalog.json)
adds **1,046 unique theme-associated parts**, including **772 new selections**,
for **1,634 selectable parts** across all collections. Each theme lists parts by slot
and explicit LDraw ID. A shared mould can belong to several themes. These specific
memberships replace the old single-theme guesses for filtering and search, so
Vikings, Indiana Jones, The Hobbit and the other named themes are discoverable
independently. The snapshot also includes printed torsos/hips and their assembled
variants, whose source headers can carry different theme information.

Coverage in the current source snapshot:

| Theme | Compatible parts |
| --- | ---: |
| Castle | 316 |
| Pirates | 123 |
| Western | 78 |
| Adventurers | 76 |
| Lord of the Rings | 94 |
| Harry Potter | 149 |
| Vikings | 29 |
| Avatar: The Last Airbender | 0 identified |
| Indiana Jones | 9 |
| Ninjago | 183 |
| Prince of Persia | 8 |
| Pirates of the Caribbean | 11 |
| Atlantis | 12 |
| Pharaoh's Quest | 38 |
| The Hobbit | 18 |
| Legends of Chima | 23 |
| Dreamzzz | 12 |
| One Piece | 0 identified |

Counts overlap across themes. LDraw source metadata and geometry coverage are
incomplete, so this is not a complete inventory of every figure or set. No
compatible Last Airbender or One Piece parts were identified in the cached
official/unofficial library; the unrelated Na’vi Avatar parts are not substitutes.
Empty themes remain recorded in the snapshot and do not produce empty picker
filters. Loose arms/legs, separate plumes/clip-on wing inserts, flat cloth, full moulded figures,
missing dependencies and textured models remain outside the supported slots.

The packer now supports scabbards at the torso, the Prince of Persia desert head
wrap, the Pharaoh's Quest staff and American-spelled armor headers. The Caribbean
shoulder-strap scabbard is classified as a back accessory, sharing the torso
attachment with neckwear, rather than a held sword. Reviewed shared moulds also
cover Dastan/Tamina hair and the Dagger of Time, Ninjago sword carriers and pirate
gear. The Atlantis speargun is explicitly approved; its previous fantasy-only
exclusion was removed for this theme. Inventory references for the supplements
include [Dastan](https://www.bricklink.com/catalogItemInv.asp?M=pop004),
[Tamina](https://www.minifig-pictures.be/controler/c_FicheMinifig.php?Code=pop003),
[Caribbean gear](https://www.bricklink.com/CatalogItemInv.asp?S=853219-1) and
[Atlantis gear](https://www.bricklink.com/catalogItemInv.asp?G=852777).

After preparing LDraw parts, run `npm run update:portrait-themes`, review the
snapshot diff and rebuild. Matching rules and reviewed supplements live in
`scripts/lib/portrait-themes.mjs` and `scripts/update-theme-catalog.mjs`.
Normal builds validate every snapshot ID/category and publish the snapshot with
the editor; no metadata is fetched at runtime. The parts completion marker now
tracks the packer source hash, so cached libraries rebuild when slot recognition
changes. Source tests cover all memberships, searches, exclusions and randomizer
eligibility; browser checks exercise all available theme filters and save/reopen
a figure with new headgear, scabbard, staff and printed body parts.

## Offline photo matching

The host dialog has four stages: upload, crop/regions, review, preview/apply.
All photograph processing runs locally. There is no portrait inference endpoint,
OpenAI configuration or runtime external reference source. The sheet scanner
retains its separate endpoint and configuration.

### Reference generation

`scripts/build-portrait-match-index.mjs` uses the existing `drawThumb` and
`Stage` through the build-only Vite thumbnail page. It renders every approved
part at 160 pixels with alpha, samples descriptors at 96 pixels and writes
`vendor/bricktrait/static/thumbs/<id>.webp` and
`vendor/bricktrait/static/portrait-match-index.json`. Vite copies these to
`portrait-maker/`; the static build copies them to `dist/portrait-maker/`.
The generated files are build artifacts, separate from geometry and saves.

Every reference has a straight-on view. Headgear, neckwear, back accessories
and held parts also have a -30° yaw, 12° pitch view. A black-plastic comparison
render estimates which pixels belong to recolourable plastic; fixed print
colours stay in a separate histogram. Membership metadata records fantasy,
CMF and specific theme associations from the existing allowlists. No alternate
part-ID catalog is maintained.

Descriptors contain a tight bounding-box aspect ratio, occupied area, 8×8
silhouette occupancy, 8×8 contrast-normalized luminance, 16 edge bins, 64 RGB
histogram bins, three dominant RGB samples and print complexity. Arrays are
quantized to bytes. The full index is about 2.4 MiB for 1,634 parts; thumbnails
are loaded lazily in the UI rather than decoded as a catalog-sized image set.

The SHA-256 source fingerprint includes approved geometry packs (including
standard leg components), core geometry, palette, catalog rules/memberships,
renderer settings, descriptor code, build script and dependency lockfile.
Unchanged data and present thumbnails skip rendering. Missing/stale references
rebuild deterministically; a failed render fails the build. Actions caches the
index, thumbnails and geometry and publishes the assets under the Pages subpath.

Use `npm run build` for the full pipeline, or
`npm run build:portrait-index` after preparing LDraw with
`npm run build:portraits`. Set `CHROME_PATH` when Chromium is not in a standard
location. Catalog updates are reflected on the next build. Keep descriptor
layout/version and matcher validation in sync when changing the algorithm.

### Photograph analysis and ranking

`portrait-image-analysis.js` decodes locally using browser image orientation,
limits the long side to 1,400 pixels and bounds processing to 96 pixels per
region while preserving aspect ratio. No aggressive white-balance correction
is applied. The user fits a crop and a configurable proportional template.
Optional neck/back/hand regions start hidden; the user must mark them visible.
Each photograph retains its own orientation, crop and region boxes, and each
slot can explicitly use a different photograph. There is no multi-view
reconstruction or automatic identity/occlusion detector.

For simple backgrounds, a conservative border-connected flood removes pixels
near the median border colour. Variable borders disable separation and mark
the descriptor as unreliable; manual crops remain the fallback. Tight-box
normalization and relative luminance reduce scale and brightness sensitivity.
No exact pixel equality, OCR, neural model or hosted service is involved.

`portrait-match.js` first intersects reference IDs/categories with the editor's
current allowed catalog. It compares colour and shape to retain at most 48
candidates, then ranks the best view for each part. Colour uses normalized
histogram overlap; estimated recolourable pixels are compared against the
observed dominant plastic colour. Shape combines aspect-ratio similarity
(50%), occupancy (35%) and fill (15%). Pattern and edge scores compare normalized
vectors, and complexity compares edge density. The final weighted sum is
clamped to [0,1], rounded and sorted by score then ID for stable ties.

| Category | Colour | Shape | Pattern | Edges | Complexity |
| --- | ---: | ---: | ---: | ---: | ---: |
| Head | .35 | .15 | .30 | .15 | .05 |
| Headgear | .15 | .50 | .12 | .18 | .05 |
| Neck | .20 | .40 | .15 | .20 | .05 |
| Back | .30 | .30 | .20 | .15 | .05 |
| Torso | .40 | .10 | .30 | .15 | .05 |
| Legs | .40 | .15 | .25 | .15 | .05 |
| Hand accessories | .10 | .55 | .10 | .20 | .05 |

`MATCH_WEIGHTS` and `MATCH_THRESHOLDS` are configurable. A top score below .56
leaves a slot unresolved. A .84 top score with a .07 margin and reliable
separation is labelled a closer match; everything else stays ambiguous.
These are conservative engineering gates, **not calibrated confidence or
probabilities**. Tests cover obvious generated colour/shape cases, duplicates,
noise, missing/hidden regions and catalog rejection. Representative physical
photographs are not included in this repository; thresholds require calibration
against a consented real-photo set before claiming measured accuracy. The UI
requires an explicit choice even for a stronger resemblance.

Three nearest LDraw colours use CIELAB distance with luminance weighted .55
and chroma weighted 1. Dominant colour is only an estimate of plastic: large
prints/backgrounds can dominate. Colours are never automatically applied.
Separate arms, hands and hips remain editable and preserve existing values
when left unchanged.

### Review, privacy and offline behavior

Every slot offers up to five lazy thumbnails, the cropped reference, full
category search with collections, unchanged, and explicit None for optional
accessories. A failed analysis keeps photos and the entire manual palette.
Workers handle feature extraction/ranking, with a yielded main-thread path
when workers are unavailable. Stop/close terminates matching and photo URLs
are revoked on removal/close. Photographs and intermediates are memory-only.

Preview uses a separate instance of the existing Bricktrait renderer and a
copied design; it does not alter history or the saved character. Reviewed
choices use `validatePortraitSuggestions()` and the existing
`questlog:portrait-apply-selections` bridge. The editor validates again and
applies one history transaction. The new preview message retains the same
origin, source-window and per-dialog session checks. Pose, camera, transparent
save behavior, Use portrait and cancel boundaries stay unchanged.

The service worker precaches analysis modules, worker and descriptor index.
**Cache visual palette for offline use** caches compressed thumbnails in small
batches, with progress; it fetches no geometry or uploaded bytes. Browsing and
recognition work offline after these assets are cached. Actual preview/save
retains the editor's on-demand geometry requirements. Open desired parts online
before using them offline; the entire geometry library is never required for
recognition. Cache failures are shown and can be retried.

Limits: fixed proportional regions assume a front-facing figure. Lighting,
clutter, glare, occlusion, printed variants and fixed-colour parts can all
produce plausible but incorrect suggestions. Use diffuse light, a contrasting
background and close focus, adjust regions and designate supplementary views
explicitly. Real Safari/mobile hardware and a representative physical-photo
benchmark remain unverified; Chromium touch emulation covers layout/gestures.

Browsing, filter counts, search, favourites, recent parts and randomization all
use the allowlist. Full catalog metadata and geometry stay available to the
renderer: an excluded part already equipped in a save remains visible and
editable, without appearing as a new choice. Randomization changes the figure
only when the user requests it; it never repairs or substitutes saved parts.

## Maintain equipment icons

Edit [`equipment-icons.js`](../equipment-icons.js). Its 239 entries specify
an LDraw part ID and colour, or a short `parts` assembly of LDraw placements,
plus exact equipment names. Names are normalized for
case, whitespace, punctuation and apostrophes; there is no fuzzy guessing or
substring matching. `itemFromEquipment()` creates independent inventory IDs,
so automatic icon lookup deliberately uses names. Both legacy and new inventory
items work without changing version 2 data. Unmapped names use category artwork.
The item editor's **Item icon → Browse library** offers a searchable visual
palette with category filters and an **Automatic** option. A saved `iconKey`
overrides name/category matching and survives edits, reloads and JSON backups.
Unknown keys fall back to automatic artwork; only bundled keys form image URLs.
`EXTRA_ITEM_ICONS` contributes 111 choices that need no equipment preset or name
alias. Their labels, categories, keywords and LDraw part IDs are searchable.
Find candidates in the cached official library by searching first-line
descriptions and `!KEYWORDS` for sword, katana, axe, spear, shield, helmet, wand,
crystal, food, container and tool. Inspect rendered silhouettes before shipping.

Equipment uses a straight-on camera instead of the portrait picker's angled
view. Set an entry's optional `view.yaw` or `view.pitch` in degrees to show its
broad face: blades and bows typically use `yaw: 90`, while flat trays use
`pitch: 90`. Unspecified angles are zero. Assembly placements can rotate each
part separately so their side-by-side spacing stays intact.

The mapping covers every one of the 63 inventory entries on Melchior, Balin and
Teyla, including explicit plural names and named magic items. It also covers
common blades, axes, polearms, bows, shields, staves, wands, bottles, books,
lights, tools, packs and instruments. Kits use a case or their representative
tool; magical variants use the relevant weapon, bottle, scroll or token model.
Small brick assemblies represent bedrolls, mess kits, chalk and metal pegs.
Custom items can choose any library icon, or keep category artwork. Models are
representative LEGO accessories, not illustrations of exact D&D dimensions.
Inventory equip/unequip never changes portraits.

The sheet pack preview, mapped weapon attacks, and inventory list share the same
lazy, asynchronously decoded 160×160 WebPs. All 239 files are bundled under
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

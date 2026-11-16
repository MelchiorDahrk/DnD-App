# Fantasy Bricktrait portraits and equipment

The complete-figure **Presets** browser, source pipeline, catalog coverage,
licensing and refresh commands are documented in [minifigure-presets.md](minifigure-presets.md).

Questlog extends its existing vendored Bricktrait, pinned at
`f333d939753526469e4169481d578aed74e955ed`. The LDraw library, parts picker,
colours, poses, camera, history, and message bridge remain in use. Portraits use
the dedicated journal renderer in `src/lib/portrait-scene.ts` and `materials.ts`.

## Journal portrait renderer

The portrait stage uses AgX tone mapping, environment reflections, a warm key,
soft fill, brass rim light and filtered shadows. Light mode uses parchment
daylight; dark mode uses warmer candlelight. The editor imports the site's
`theme.css` tokens, receives the resolved appearance through the existing
session-checked bridge and redraws without rebuilding geometry or changing the
design. Standalone use follows the saved appearance preference and system theme.

Materials retain print colours, transparency and metallic finishes. Plastic has
a restrained clearcoat; cloth and rubber stay matte. Loader-smoothed normals and
authored hard edges are preserved, with normalization and missing-normal repair.
Material variants and geometry are isolated from the loader palette and released
when a model is replaced or a renderer is disposed.

LDraw luminous colours retain their emission. Flame geometry gains emission;
translucent crystal geometry receives a smaller glow. These effects use explicit
geometry IDs, so an ordinary face or flame-printed torso stays unlit. Up to three
small bounce lights illuminate neighbouring surfaces and follow the posed model.
Emission strength adapts to the appearance without adding opaque export pixels.

Equipment icons use the same journal renderer, daylight lighting, material
finishes and selective emission as portraits. Their existing camera angles and
transparent 160-pixel framing are preserved. The build fingerprints the shared
renderer and regenerates all equipment icons whenever its appearance changes.
The catalogue and photo-matching references keep their existing neutral pipeline.

The new lighting applies to portrait previews, reviewed photo previews and
exports. Saved portraits remain flattened transparent images: switch appearance
in the editor and save to capture different lighting.
Existing images are not regenerated when the site's appearance changes.

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

## Unrestricted parts and optional themes

All supported minifigure slot parts are selectable by default, including modern,
science-fiction, superhero and unclassified parts. `selectableCatalog` applies
technical slot/attachment support only. The fantasy JSON remains browsing
metadata; its historical `exclude` entries no longer deny selection, randomization
or photo matching. Equipment-only general LEGO bricks stay outside body pickers.

The collection selector offers All Parts, Fantasy & Medieval and CMFs. Theme
metadata supports multiple memberships, with Castle, Pirates, Lord of the Rings /
The Hobbit, Harry Potter, Star Wars, Ninjago, Superheroes, other detected themes,
and Unclassified Parts. Search spans all themes even when a theme is selected.
The grid displays at most 90 items at a time; static WebP images load lazily,
recolored previews render only in view, and geometry loads on demand.

Run `npm run refresh:portraits` for an intentional update of official and
unofficial LDraw libraries, public Rebrickable bulk inventories, geometry,
metadata, presets, previews and coverage. Ordinary builds use cached sources.
Refresh stages complete libraries before swapping directories, records archive
hashes, replaces same-size changed files and preserves licenses. File-lock
retries support Windows. Geometry generation writes only changed assets.

See [coverage](../reports/minifigure-coverage.md) and the accompanying JSON for
counts and all technical restrictions. Eight patterned parts currently require
unsupported texture rendering; missing transitive geometry is separately
reported. Host-dependent visors, ornaments and similar components retain their
geometry for legacy portraits but need additional attachment support before
standalone selection. The removed upstream apron hip print is archived under
`presets/legacy-ldraw` with its original author and CC BY license header.

The preset downloader includes shared geometry dependencies and the editor shell.
The parts editor also offers a deliberate full-library offline download. Neither
action loads every model into browser memory. Incremental reference checkpoints
under `.cache/portrait-references` avoid re-rendering completed parts after an
interruption; fingerprints include transitive shared geometry.

## Offline photo matching

The host dialog has four stages: upload, crop/regions, review, preview/apply.
All photograph processing runs locally. There is no portrait inference endpoint,
OpenAI configuration or runtime external reference source. The sheet scanner
retains its separate endpoint and configuration.

### Reference generation

`scripts/build-portrait-match-index.mjs` uses the existing `drawThumb` and
`Stage` through the build-only Vite thumbnail page. It renders every selectable
part at 160 pixels with alpha, samples descriptors at 96 pixels and writes
`vendor/bricktrait/static/thumbs/<id>.webp` and
`vendor/bricktrait/static/portrait-match-index.json`. Vite copies these to
`portrait-maker/`; the static build copies them to `dist/portrait-maker/`.
The generated files are build artifacts, separate from geometry and saves.

Every reference has a straight-on view. Headgear, neckwear, back accessories
and held parts also have a -30° yaw, 12° pitch view. A black-plastic comparison
render estimates which pixels belong to recolourable plastic; fixed print
colours stay in a separate histogram. Membership metadata records fantasy,
CMF and specific theme associations from optional browsing metadata. No alternate
part-ID catalog is maintained.

Descriptors contain a tight bounding-box aspect ratio, occupied area, 8×8
silhouette occupancy, 8×8 contrast-normalized luminance, 16 edge bins, 64 RGB
histogram bins, three dominant RGB samples and print complexity. Arrays are
quantized to bytes. The full index spans all selectable parts; thumbnails
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
use the full supported minifigure catalog. Full catalog metadata and geometry stay available to the
renderer. Previously theme-excluded parts can now be selected and saved;
host-dependent attachment parts remain renderable in old saves. Randomization changes the figure
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
stay outside minifigure body slots. The build detects missing icon part packs
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
or stale equipment WebPs through **`drawEquipmentIcon` and `PortraitStage`**, builds
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
styles/excluded parts, favourites/recent/search across the full library, save/cancel,
backups with inventory, missing assets, desktop/mobile, and offline save and
icons. CI serves the built site at `/DnD-App/` for both suites. Relative
URLs also support `/dist/` and GitHub Pages without a router or server backend.

Portrait geometry remains cached on demand: open the editor and desired parts
online before using those designs offline. This preserves the previous offline
behavior without downloading the entire LDraw library to every browser.

MIT Bricktrait attribution, dependency licenses, LDraw per-file `CREDITS.txt`,
and LDraw license texts remain in the deployed `portrait-maker/` directory.
The optional browsing metadata is also copied there; the equipment mapping ships as a
normal app module. Keep these files with any redistributed icons. LEGO® does
not sponsor, authorize, or endorse Questlog or Bricktrait.

# Minifigure preset library

Questlog's existing Bricktrait editor now has a **Presets** tab. Search by name,
set number, theme, faction or archetype, combine the theme/archetype/species/
origin/compatibility filters, sort, and keep favorites and 30 recent picks in
local browser storage. The grid shows at most 24 static, lazy-loaded images.
Selecting a figure updates the existing editable `Figure`, as one undo step.
View and style stay as chosen; **Use portrait** is still the only character save
action. Cancel, legacy portraits, compressed/legacy share links and character
backups retain their existing behavior.

## Included snapshot

The expanded catalog contains 396 editable configurations: 258 official inventory
reconstructions and 138 original Questlog combinations. It includes 106
Rebrickable minifigure identities and 19 CMF presets, including recent entries.
Discovery is unrestricted by theme. Previously excluded Western, Adventurers and
Pharaoh's Quest assemblies are included when their components are supported.

The checked-in bulk snapshot preserves all 17,365 minifigure inventories, plus
single-figure CMF parent-set inventories for accessory inspection. All twelve
71047 Dungeons & Dragons inventories are present. Their printed anatomy and
specialized components cannot currently be reconstructed exactly through verified
mappings, so they remain in the coverage report rather than receiving guessed
prints or anatomy. See [coverage](../reports/minifigure-coverage.md).

Presets have transparent 192×192 WebP previews and reuse the existing per-part
geometry packs. Official designs and original combinations retain separate origin
labels. Partial reconstructions disclose unresolved components and assembly rules.

Characters without a saved portrait use curated species/class/subclass defaults
from this catalog. `portrait-defaults.js` defines exact choices and lineage
aliases; species anatomy takes priority, then an exact class/subclass match,
then the class outfit. Unmatched custom choices keep the generic adventurer.
The sheet, character picker and portrait editor use the same figure. Changing
character choices updates an automatic portrait; saved custom portraits keep
priority. Defaults remain derived, so backups need no extra character fields.
`build:presets` generates `portrait-default-data.js`, and the service worker
precaches all default images for offline sheets.

Back-worn neck attachments (capes, quivers and scabbards) turn 180 degrees about
the neck peg in both the editor and previews. Front-worn beards, armor and the
ghost shroud retain their original orientation.

## Sources, accuracy and licensing

* [LDraw OMR](https://library.ldraw.org/omr) supplies assembled figures and exact
  part colors and placements. The importer accepts only files with an explicit
  supported CC BY/CCAL license header. The
  [OMR specification](https://library.ldraw.org/documentation/official-model-repository-omr-standards/official-model-repository-omr-specification)
  describes its model/submodel and license conventions. Authors, license,
  download URL and assembly filename remain attached to each preset. The
  normalized source snapshot includes original transforms. Extraction and
  conversion modify the source assembly into an editable standing portrait.
* Fantasy, CMF and theme catalogs are optional browsing metadata, never selection
  eligibility or verified figure inventories.
* [Rebrickable bulk downloads](https://rebrickable.com/downloads/) supply catalog
  and inventory snapshots, with source URLs, archive hashes and
  [terms attribution](https://rebrickable.com/terms/). No official product images
  are downloaded. Explicit LDraw Rebrickable keywords, identity alias chains and
  reviewed mappings establish part identities. Exact normalized named colors
  establish color mappings; matching numeric IDs alone are insufficient.
  Ambiguous prints remain unresolved. The authenticated API importer supports
  targeted lookups when `REBRICKABLE_API_KEY` is available.
* Original combination definitions and their thumbnails are contributed under
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), attributed to
  Questlog. Their underlying geometry retains each LDraw file's license.
  LDraw part packs retain author/license headers. Bricktrait remains MIT and
  its existing license delivery is unchanged. Thumbnail credits follow the
  preset's source/geometry attribution; rendered OMR previews are adaptations.
* LEGO is a trademark of the LEGO Group. Official figure reconstructions are
  fan-authored models; original combinations are not official LEGO products.

**Complete** means essential anatomy and included components match the available
source assembly and the supported slots. It is not a claim that a fan-authored
OMR file is a complete retail inventory. Models flagged for missing parts,
patterns or stickers are conservatively partial. **Partial** means the actual
head, torso and supported lower body exist, with documented omissions. Unknown
prints are never replaced with arbitrary prints. **Unavailable** means essential
anatomy is missing, ambiguous or unsupported, and the browser does not expose it.

Source inventories and geometry coverage differ. The coverage JSON distinguishes
confirmed absent geometry, build exclusions, legacy hidden parts, unused selectable
parts, undefined assemblies, and unverified identifier mappings. An unmapped ID
is never reported as proven missing geometry. Each component retains its external
ID, description, source figure, quantity, color and reason. Ranked opportunities
highlight parts that block several figures. Parent-set CMF accessories are listed
separately when they need reviewed placement.

## Refresh

Run `npm run refresh:portraits` to download both latest LDraw archives and the
public Rebrickable datasets, rebuild geometry and optional metadata, regenerate
verified mappings/presets/previews, and update coverage. Ordinary `npm run build`
reuses checked-in inventories and cached assets without external runtime calls.
`npm run import:preset-bulk -- --cached` rebuilds the source snapshot from locally
cached CSV archives; `npm run build:portrait-coverage` regenerates the report.
Set `CHROME_PATH` or `BROWSER_PATH` if Chromium is not found. A project-cached
headless browser is detected automatically. New presets keep stable source IDs.

## Data layout

| Path under `vendor/bricktrait/` | Purpose |
| --- | --- |
| `preset-catalog.json` | Generated, human-readable catalog |
| `presets/sources/omr-inventories.json` | Generated normalized source inventories and provenance |
| `presets/sources/rebrickable-bulk.json` | Bulk figure and single-CMF-set inventories |
| `presets/rebrickable-mappings.json` | Generated mappings and evidence |
| `presets/sources/rebrickable-inventories.json` | Optional API snapshot, absent until imported |
| `presets/original-recipes.json` | Curated original outfits, equipment and species recipes |
| `presets/mappings.json` | Reviewed external identifiers, colors, grips and leg assembly rules |
| `presets/overrides.json` | Reviewed per-preset corrections and hidden flags; never regenerated |
| `presets/asset-manifest.json` | Generated slot/category/color validation snapshot for cold CI |
| `presets/compatibility-report.json` | Generated rejected, partial and duplicate report |
| `presets/thumbnails/` | Checked-in cached WebPs and content fingerprints |
| `static/preset-catalog.json`, `static/preset-thumbs/` | Generated deployment copies |

Presets have a stable source-derived ID, display name, description, theme,
category, tags, source attribution, original inventory/assembly ID where
available, fully specified existing `Figure` component IDs/colors and default
pose, compatibility with reasons, and thumbnail path. Optional faction,
archetypes, species and deduplicated aliases/memberships support browsing. The
shared validator is `src/lib/presets.js`; executable examples are in
`tests/presets.test.mjs`. Runtime data strips original matrices while retaining
part IDs and colors. The source snapshot preserves matrices for future mapping
improvements.

OMR IDs use the source set number and a hash of the stable assembly filename;
original IDs derive from the recipe's named outfit. Geometry/metadata updates
do not rename IDs. Existing canonical IDs take precedence when a new source
adds an identical configuration, preserving favorites across refreshes.
Renaming an outfit is an explicit new identity, so preserve
existing recipe names when refreshing assets.

## Assembly rules and limitations

MPD parsing resolves nested submodels, inherited color 16, full placement
transforms and cycle detection. An eligible candidate contains exactly one head
and torso, with a bounded assembly size; a model containing several people
cannot become one figure. Slot assignment uses known LDraw categories. Two
competing components for a slot cause a reported ambiguity.

Plain hips/right leg/left leg sets normalize to existing `standard` legs with
their colors. Short-leg and supported robe/skirt shortcuts use the renderer's
existing placement logic. Selected older printed leg triples have explicit,
evidenced corrected-mould assembly mappings. Fixed hip colors in those shortcuts
must match the source; incompatible combinations are rejected. Specialized
moulded heads cannot acquire unreviewed headgear. Source arm/hand colors are
preserved where the existing symmetric limb controls can represent them.
Asymmetric colors are reported. Unsupported skeleton/monster body anatomy,
unmatched printed legs, compound headgear, separate visors, plumes and complex
handheld assemblies need future reviewed support. No new renderer was added.

Held-item placement requires a supported part, nearby actual source hand,
torso-relative left/right identification, a free hand slot and an explicit grip
mapping. Reviewed grips use Bricktrait's existing bar-along-Y convention in a
neutral pose, not the source model's arbitrary pose. Other items are retained in
the report rather than assigned to a random hand. Rebrickable inventories lack
placement evidence and require manual per-figure attachment corrections.

External Rebrickable IDs require the API's `external_ids.LDraw` or an explicit
reviewed mapping. BrickLink identifiers are never assumed interchangeable with
LDraw or Rebrickable identifiers. External colors likewise require an explicit
LDraw external ID or reviewed mapping. Parts without these mappings remain
unresolved. Curated overrides can set the exact existing figure slots after
review, including equipment, species and compatibility decisions.

## Refresh and expand

From the repository root, after the initial `npm run build:portraits`:

```sh
# Refresh permitted OMR sources (cached, sequential requests, 350 ms minimum delay).
npm run import:preset-omr

# Or import explicit Rebrickable minifigure IDs with a server-side environment key.
# Set REBRICKABLE_API_KEY in your shell, never in source or a Vite/client variable.
npm run import:preset-rebrickable -- fig-000001 fig-000002
# Or discover a larger matching catalog, then import its inventories.
npm run import:preset-rebrickable -- --search "Forestman"

# Review and edit mappings.json, overrides.json, and/or original-recipes.json.
npm run build:presets
npm run build:preset-thumbnails
npm run build
npm test
npm run test:presets
```

The optional API importer merges by source ID without erasing previously imported
figures. Add reliable theme/category/species fields to a reviewed snapshot or
override. The API importer caches responses and never logs its authorization
header. The browser cannot access credentials. OMR/API responses are cached by
URL in `.cache/presets`; pass `--refresh` to explicitly fetch a fresh snapshot,
or remove only the cached responses you intend to refresh. Rebrickable calls
are sequential with a 1.1-second minimum interval; HTTP rate limits stop the
refresh without discarding prior source snapshots.
On an HTTP error, restore connectivity or wait for the provider's rate limit;
cached data and ordinary builds remain usable. No source network request runs
as part of an ordinary catalog/app build.

Thumbnail generation uses the existing `placements`, `library.build`, material
preparation and `PortraitStage`. A single serial renderer fits each actual figure
to a consistent camera and light setting. Cache fingerprints include the figure,
renderer/material code, shared library/config and its referenced part packs.
Completed images are checkpointed after each render. Metadata-only changes skip
rendering. Set `CHROME_PATH` or `BROWSER_PATH` if Chromium is not in a standard
location. Ordinary builds use the committed previews and do not regenerate them.

Review source, report, catalog and image diffs together. Commit refreshed source
snapshots, generated catalog/report/validation manifest, curated changes and
thumbnails. `portrait-maker/`, `dist/`, `.cache/` and `static/` remain generated.

## Offline and verification

The editor and presets use relative, self-hosted paths and work below a GitHub
Pages subpath. The existing service worker caches fetched assets. **Download
collection for offline use** caches catalog, all previews and all required part
packs with bounded concurrency, progress and retry. It downloads only missing
files, including transitive shared geometry. This makes even a previously unselected
figure available offline; downloading requires an active Questlog service worker.
There are no runtime external-source calls or duplicate full-figure meshes.

`npm test` includes schema, assets/colors, source mapping, missing anatomy,
printed-leg rules, transform inheritance, duplicate identities, manual overrides,
history grouping, customization/backup/share round-trips, legacy portraits,
filtering and deterministic rebuild tests. `npm run test:presets` exercises all
WebP alpha previews, representative official/original rendering, mobile layout,
favorites/recent persistence, cancel/save/reopen and offline reconstruction in
Chromium against a running local server. The production deployment runner also
includes this suite.

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

The checked-in catalog contains **244 unique configurations**:

| Origin | Presets |
| --- | ---: |
| Official figure reconstructions from credited LDraw OMR assemblies | 106 |
| Original Questlog fantasy combinations | 138 |
| Complete | 169 |
| Partial, with disclosed omissions or source limitations | 75 |

There are **four official theme categories**, plus **Original Fantasy**:
Castle, Indiana Jones, Lord of the Rings, and Pirates. Western, Adventurers,
and Pharaoh's Quest are excluded before preset deduplication; their source
snapshots and selectable pieces remain available. Castle factions come from
OMR's theme hierarchy. Original recipes
cover 41 professions/archetypes and human, elf, dwarf, halfling, orc, goblin,
undead and demon characters. Outfits, equipment and anatomy vary; the generator
does not multiply arbitrary recolors. The number of catalog entries is a result
of source coverage and validation, not a fixed cap.

The import inspected the public OMR set index, selected 75 relevant set records
using Questlog's reviewed theme associations plus adventure-related source
themes, and retained 74 licensed MPD/LDraw models. Generation excludes 69 source
assemblies in the removed themes, withholds 17 unavailable assemblies and
merges 21 duplicate assemblies, retaining alternate
names, original source identities, theme memberships, part references and
attribution. Counts are recorded in `vendor/bricktrait/presets/compatibility-report.json`.

All 244 previews are transparent 192×192 WebPs. Presets reuse
existing LDraw packs; no complete-figure geometry files are produced. The
collection's existing part packs total about 13 MB.

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
* The existing fantasy, CMF and theme catalogs provide part descriptions,
  editor eligibility and source-discovery associations. They are **part
  collections**, not verified minifigure inventories; the generator does not
  invent official identities from these associations.
* [Rebrickable API v3](https://rebrickable.com/api/v3/docs/) is an optional
  build-time inventory source. No API key was available for this implementation;
  the public downloads page returned HTTP 403. No protection was bypassed and
  no Rebrickable dataset is included in this snapshot. Review the current
  [terms](https://rebrickable.com/terms/) before redistributing a refreshed API
  snapshot. The importer uses authenticated API endpoints, not catalog HTML,
  and retains source links. No official images are downloaded.
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

OMR coverage is uneven. The inspected Harry Potter models omit isolated
minifigures; some models contain no figures at all. No compatible isolated CMF,
D&D, Kingdoms, Hobbit, Ninjago, Vikings, Atlantis, Prince of Persia, Caribbean,
Avatar or Chima figure inventory was recovered by this snapshot. Their existing
selectable parts remain useful for customization and original designs. The
report lists inspected models with no extracted assembly, unavailable figures,
and every partial preset's omissions. There are no empty advertised theme filters.

## Data layout

| Path under `vendor/bricktrait/` | Purpose |
| --- | --- |
| `preset-catalog.json` | Generated, human-readable catalog |
| `presets/sources/omr-inventories.json` | Generated normalized source inventories and provenance |
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
files (about 15 MB for this snapshot). This makes even a previously unselected
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

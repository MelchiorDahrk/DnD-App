# Deployment check policy

Pages deployment is gated on working functionality: source syntax, a successful build, rules and save validation, loading the built site beneath the Pages subpath, usable images, character and equipment interactions, portrait creation/editing, photo matching, appearance selection/persistence, keyboard dialog focus, and offline operation. Functional failures still stop deployment.

## Sheet browser deadline — November 17, 2026

[Run 44017193702](https://github.com/MelchiorDahrk/DnD-App/actions/runs/44017193702)
passed packaging, Firebase validation and the other four browser groups. The sheet
runner stopped its suite at exactly three minutes during the final 320px dialog
checks, after the preceding interactions, favorites, persistence, offline and
navigation checks passed. The resulting browser-closed error came from the
runner terminating the suite at its deadline.

The expanded sheet suite now has a five-minute limit. All functional checks and
failure gates remain required. The registry regression test verifies that each
group's combined suite limits leave room within the actual workflow step deadline.

## Cloud upload scheduling regression — November 16, 2026

[Run 43967998889](https://github.com/MelchiorDahrk/DnD-App/actions/runs/43967998889)
built successfully but timed out waiting for the guest upload to become synced.
A completed sync's Web Locks request can still be pending after its callback has
drained the queue. An upload queued during that interval requested another flush,
but the running guard discarded the request and left the upload pending.

Sync now remembers concurrent flush requests and drains again after a successful
lock release. Connection errors retain their retry delay and conflicts still
require resolution. Unit tests control this interval and both failure paths.
The Firebase browser check holds the initial request open while uploading, then
requires a synced status and reads the character back from Firestore. This check
reproduces the timeout against the original build. Firebase failures save the
active phase, account status, queue, browser messages, HTML and screenshots;
the packaging job uploads these with the emulator log.

Palette values, text contrast measurements, exact dimensions, panel height ceilings, label overlap measurements, artwork centering/camera angles, compact swatch layout, and image byte budgets are optional design review checks. Changing a font, color, spacing value, thumbnail resolution, or decorative treatment should not block publication. These checks remain available for design work; the deployment job explicitly sets `QUESTLOG_VISUAL_CHECKS=0`.

## Deployment time audit — November 16, 2026

[Successful run 43880912984](https://github.com/MelchiorDahrk/DnD-App/actions/runs/43880912984)
took **16m59s** from creation to completion. Its build used the portrait cache;
the bottleneck was the **13m48s of serial browser suites**, not uploading Pages.

| Work | Measured time | Required frequency and purpose |
| --- | ---: | --- |
| Portrait browser suite | 4m09s | Every deployment: creation, editing, save/reopen, custom colours, asset fallback and offline reconstruction |
| Sheet browser suite | 2m25s | Every deployment: real sheet interactions, attacks, navigation, persistence and online/offline images |
| Dice browser suite | 2m24s | Every deployment: real landing faces, resource use, mobile controls, failure fallback and offline loading |
| Photo-matching browser suite | 2m19s | Every deployment: upload, matching, mobile part selection and offline matching |
| Preset browser suite | 2m07s | Every deployment: previews, filters, selection, customization and offline collection |
| Item, magic-item and appearance browser suites combined | 25s | Every deployment: inexpensive functional coverage |
| Source and generated-asset unit tests combined | About 58s | Every deployment: fail early on rules/save/fixture regressions, then validate newly generated data |
| Cached production build | 37s | Every deployment: package the current commit, validate asset fingerprints, remove obsolete files |
| Portrait/equipment cache restoration | About 6s | Every build: avoid regenerating unchanged rendering assets |
| Pages publication | About 40s | Every production deployment, after validation |

The workflow now runs five browser groups on **separate GitHub runners** after a
single build. The sheet group also runs the four inexpensive suites; dice,
portraits, photos and presets each have a dedicated runner. At the measured times,
the browser critical path falls from 13m48s to about 4m09s, plus parallel runner
setup and artifact transfer. **Roughly 7–9 minutes for a warm deployment is an
estimate**, pending the first Actions run; queueing and slower runners can add time.
Total runner usage can increase because each group installs its test dependencies.

Every group downloads the same `production-app` artifact, including generated
portrait defaults and the preset catalog used by the tests. Browser jobs never
rebuild. Pages downloads and publishes that artifact only after the build and
**all five groups** succeed. The matrix comes from the same suite registry as the
local runner, so a required suite cannot disappear through a second hand-maintained
CI list. The existing `build` check aggregates packaging and all browser groups,
preserving its meaning for branch protection. Each group records per-suite durations in the Actions job summary and
`.tmp/browser-diagnostics/deploy/timings.json`; failures retain their original logs
and upload diagnostics with a distinct group name.

### Work that should not repeat on every deployment

| Work | Policy |
| --- | --- |
| Rendering portrait references and equipment thumbnails | Reuse cached results when renderer, geometry and dependency fingerprints match; render new/changed inputs only. This produces app assets rather than performing a test, so stale or missing required assets still need rebuilding. |
| Downloading updated LDraw libraries or importing upstream catalogs | Explicit maintenance when updating the library/catalog. Ordinary builds reuse the successful local snapshot; a completely absent cache still needs an initial download/build. |
| Palette, precise layout, contrast, framing and byte-budget reviews | Optional design review commands, already outside the publication gate. |
| Exhaustively decoding previews, rendering CMF presets and downloading the full offline collection in several suites | Candidates for a future scheduled/manual audit with representative deployment coverage. They still gate every deployment in this change: parallel runners remove most of their elapsed-time cost without removing regression coverage. |

[Cold-cache run 43810509046](https://github.com/MelchiorDahrk/DnD-App/actions/runs/43810509046)
took 94m46s. No portrait cache was available: the production build took 75m36s,
including about **73 minutes rendering 4,830 references**. This is a separate
bottleneck, and browser parallelism does not fix a full cache miss. Prefix restore
keys continue to seed incremental rebuilds, and successful renders are saved before
tests. The cache key now also includes the geometry-fingerprint helper and bundled
legacy geometry so their changes can produce a new saved cache rather than repeatedly
repairing an immutable exact hit. Cache eviction or a genuine renderer change can
still require an expensive rebuild; increasing a timeout is not a speed improvement.

Local validation passed: source syntax checks, the production build, all 267 unit
tests, actionlint, and all eight production browser suites run through the five
groups against an isolated checkout without generated rendering caches. The runner
regression also verifies that a browser failure exits unsuccessfully and retains
its logs and failed timing result.

## Commands

Run `npm run verify:deploy` before pushing. It runs syntax and unit checks,
builds the production app, rechecks generated assets, then runs **all nine**
required browser suites under `/dist/`. Set `BROWSER_PATH` to a Chromium executable.
`npm run test:deploy` runs just the production browser checks against an existing
build and starts/stops its own preview server. To check an already-running preview,
set `DEPLOY_TEST_URL` to its subdirectory URL, including the final `/`.

Pull requests to `main` run the same checks as production pushes, without publishing
to Pages. Source and fixture unit checks run before the expensive
portrait build; generated-asset tests still run after it. The shared browser runner
checks the sheet first locally, retains the individual suite time limits, and records each
suite's output under `.tmp/browser-diagnostics/deploy/`. Functional failures still
stop publication; checks are not retried or ignored.

Use `npm run test:deploy -- --group portraits` (or `sheet`, `dice`,
`portrait-photos`, `presets`) to run one CI group locally against an existing build.
Omitting `--group` still runs every required suite serially. CI uses
`node scripts/test-deploy.mjs --matrix` to obtain all required groups without
starting a preview or browser.

| Command | Purpose |
| --- | --- |
| `npm test` | Functional unit tests, including save/rules validation and appearance behavior |
| `npm run verify:deploy` | Complete deployment validation, including the production build and every required browser suite |
| `npm run test:deploy` | All required browser suites against the packaged production app |
| `npm run test:dice` | Real 3D landing faces, roll rules, resource spending, mobile interaction, reduced motion, WebGL fallback and offline engine loading |
| `npm run test:themes` | Functional browser checks for both appearances and System, all routes at desktop/mobile sizes, dialogs, images, reduced-motion interaction, persistence, and offline reload |
| `npm run test:visual` | Optional palette contrast tests plus the theme suite with layout/contrast measurements and screenshots |
| `npm run test:sheet -- --visual` | Add optional sheet layout and thumbnail dimension measurements |
| `npm run test:portraits -- --visual` | Add optional portrait/editor layout and equipment framing measurements |
| `npm run test:presets -- --visual` | Add optional preview size/transparency and mobile layout measurements to preset interaction checks |
| `npm run test:dice -- --visual` | Add optional die scale and tray-height measurements to dice interaction checks |

The equipment and photo-matching browser suites also accept `--visual` for their optional measurements. Set `QUESTLOG_VISUAL_CHECKS=1` when explicitly running an entire group with visual review enabled. Set `BROWSER_PATH` to a Chromium executable when the installed browser cannot be found automatically. The standalone portrait/photo scripts expect an already-running server; retain their existing URL environment variables.

Catalog checks validate IDs, components, source coverage, summary totals, filters,
and save compatibility against the current data. They do not freeze the number of
presets, themes, inventory items, weapons, or legacy magic items. Preset browser
fixtures come from the catalog and use stable entry IDs, so names, filter order,
and page size can change. Every preset preview must still decode, and mobile
selection, save/cancel, customization and offline reconstruction remain required.

The dice suite fixes open-dice's throw vectors as well as the recorded dice values,
so deployment does not depend on randomly chosen physics trajectories. It still
runs the real prediction, animation, and landing-face checks. A separate stalled
engine check verifies the production timeout preserves exactly one result. Set
`DICE_TEST_CPU_RATE=4` and `DICE_TEST_SOFTWARE_RENDERING=1` to exercise slow software
painting as well as JavaScript. The suite verifies that natural-20 particles follow
the 3D throw, and that effects release their overlay and canvas after playback.
The sparse-frame lifetime and cancellation regressions run with a controlled
clock in `tests/vfx-lifecycle.test.mjs`. They do not depend on runner painting speed.
Exact die scale and tray-height measurements require `--visual`; mobile result
visibility, real landing faces, resource use and fallback behavior stay mandatory.
Failures save the tray state,
browser errors, console messages, and a screenshot in `.tmp/browser-diagnostics/dice/`
for the workflow's artifact upload.

To exercise the packaged production site, set `THEME_TEST_URL` to its served subdirectory and `THEME_TEST_PRODUCTION=1`. That mode also verifies the development workshop is excluded from production. No particular cache version string or exact document title is required; the test loads the app and images offline to verify the behavior directly.

## Image loading and diagnostics

The sheet check in [failed run 43733003690](https://github.com/MelchiorDahrk/DnD-App/actions/runs/43733003690)
replaced a saved inventory with the full catalog but retained weapon actions linked
to the removed inventory IDs. Save validation correctly rejected this fixture,
leaving the inventory empty. The catalog fixture now removes those obsolete links
and validates the resulting save before loading it. A unit regression uses the same
fixture helper with the linked state produced by app startup, so this error fails
before building. Production save validation stays strict.

The sheet suite uses bounded image waits for the whole catalog online and offline,
including lazy images below the viewport. It records its active phase, page HTML,
screenshot, console output and browser errors in `.tmp/browser-diagnostics/sheet/`
on failure. GitHub uploads these alongside the other browser diagnostics.

The theme check in [failed run 43510866087](https://github.com/MelchiorDahrk/DnD-App/actions/runs/43510866087) waited on `image.decode()` for every equipment image, including deferred offscreen images. Chromium could leave that promise pending until the three-minute workflow step expired, even though the app built and the earlier functional suites passed.

The shared browser helper now makes the test targets eager, waits at most 15 seconds for load completion, and checks nonzero decoded dimensions. It reports broken image URLs instead of awaiting an unbounded decoding promise. The theme suite covers an image far below the viewport and confirms an invalid image is still rejected. Checkpoint messages identify the active phase if a future run fails. This affects only tests; production lazy loading is unchanged.

## Mobile palette interaction

Opening a part palette schedules a native `details` toggle that rebuilds its buttons. Photo tests wait for that initial render, use locators that reacquire replaced controls, and verify the chosen part and enabled color control after clicking. Both 320px and 390px fresh-palette paths remain functional deployment checks. Set `PORTRAIT_PHOTO_CPU_RATE=4` when running `test:portrait-photos` to stress those mobile interactions under slower rendering.

On failure, the photo suite records a screenshot and control geometry/state under `.tmp/browser-diagnostics/`. The deployment workflow uploads those diagnostics as `browser-failure-diagnostics-<group>`, while preserving the original test failure.

Photo-test startup waits for the service worker to activate before checking control.
If the initial navigation raced activation, it reloads once under the active worker.
The control check retains the 60-second bound used by the portrait suite; all
subsequent offline checks still require actual service-worker control.

## November 15 deployment regression

[Runs 43761279353](https://github.com/MelchiorDahrk/DnD-App/actions/runs/43761279353)
and [43767957087](https://github.com/MelchiorDahrk/DnD-App/actions/runs/43767957087)
built successfully and passed the sheet and item suites. The dice suite then
timed out in a five-second particle test that replaced the browser's global
animation scheduler with delayed callbacks. That simulation now runs as a unit
regression with a controlled clock. The browser cleanup check uses normal playback,
timer-based polling and a bounded 15-second wait, retaining real cleanup coverage.

The workflow retains bounded limits for all nine suites (42 minutes in total), with
each parallel browser step allowing 20 minutes and its job allowing 25 minutes
including setup. The sheet group's combined suite limits total 18 minutes.
The packaging job allows
110 minutes, including a 100-minute cold-build limit and install/cache overhead.
Static packaging clears `dist/` first, so removed files cannot linger
and hide a packaging defect during repeated local verification.

## Critical-hit sheet regression

[Run 43769607769](https://github.com/MelchiorDahrk/DnD-App/actions/runs/43769607769)
failed after a successful natural-20 attack. Its saved HTML and screenshot show
the settled result and critical damage controls. The sheet test waited for
`.roll-modal`, but critical hits intentionally show accuracy in a compact
disclosure instead. The random d20 made that assertion fail intermittently.

Sheet interaction checks now wait for the completed recorded dice, independently
of the surrounding result layout. Every run explicitly exercises a natural 1,
a normal roll, and a natural 20 from a collapsed favorite attack, and verifies
the corresponding miss, hit confirmation, and damage controls. Actual clicks,
rules, dice rendering and feature-use checks remain in place. Set
`SHEET_TEST_CPU_RATE=4` with `npm run test:sheet` to stress slower browser execution.

## Section navigation timing regression

[Run 43877503661](https://github.com/MelchiorDahrk/DnD-App/actions/runs/43877503661)
built successfully but failed the new `390px abilities arrives quickly` assertion.
That browser check required a painted final frame before 340 ms, so a delayed
animation frame could block publication even though the scroll reached its target.

The 240 ms easing, intermediate positions, sparse frames, retargeting and reduced
motion are now checked with a controlled clock in `tests/sheet-navigation.test.mjs`.
Browser checks wait for the correct destination and a stable scroll position with
a three-second bound, and still verify selection, focus, interruption, persistence
and offline behavior. They do not impose a frame-rate or painting-speed requirement.

## Automatic portrait thumbnail regression

[Run 43781269178](https://github.com/MelchiorDahrk/DnD-App/actions/runs/43781269178)
built successfully and passed the sheet, item, dice and appearance suites, then
timed out checking a missing editor thumbnail. The automatic Drow figure uses a
custom skin colour, so visible head thumbnails are replaced with live renders.
After they finish, the first remaining static image can be below the picker's
viewport. The test broke that image and waited for a live render even though the
editor intentionally defers offscreen thumbnails. Waiting for the visible custom
colour renders before running the old check reproduces the timeout locally.

The fallback check now selects the Head slot and bundled thumbnail colour,
scrolls its target into view, and waits for a loaded static image before breaking
it. It still requires a loaded WebGL replacement; custom colour rendering is
also checked during the subsequent edit/save/reopen flow. Portrait failures now
save the active check, selected slot/colour, thumbnail state, browser messages,
page/editor HTML and a screenshot under `.tmp/browser-diagnostics/portraits/`.

# Deployment check policy

Pages deployment is gated on working functionality: source syntax, a successful build, rules and save validation, loading the built site beneath the Pages subpath, usable images, character and equipment interactions, portrait creation/editing, photo matching, appearance selection/persistence, keyboard dialog focus, and offline operation. Functional failures still stop deployment.

Palette values, text contrast measurements, exact dimensions, panel height ceilings, label overlap measurements, artwork centering/camera angles, compact swatch layout, and image byte budgets are optional design review checks. Changing a font, color, spacing value, thumbnail resolution, or decorative treatment should not block publication. These checks remain available for design work; the deployment job explicitly sets `QUESTLOG_VISUAL_CHECKS=0`.

## Commands

Run `npm run verify:deploy` before pushing. It runs syntax and unit checks,
builds the production app, rechecks generated assets, then runs **all seven**
required browser suites under `/dist/`. Set `BROWSER_PATH` to a Chromium executable.
`npm run test:deploy` runs just the production browser checks against an existing
build and starts/stops its own preview server. To check an already-running preview,
set `DEPLOY_TEST_URL` to its subdirectory URL, including the final `/`.

Pull requests to `main` run the same checks as production pushes, without uploading
a Pages artifact or deploying. Source and fixture unit checks run before the expensive
portrait build; generated-asset tests still run after it. The shared browser runner
checks the sheet first, retains the individual suite time limits, and records each
suite's output under `.tmp/browser-diagnostics/deploy/`. Functional failures still
stop publication; checks are not retried or ignored.

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

The equipment and photo-matching browser suites also accept `--visual` for their optional measurements. Set `QUESTLOG_VISUAL_CHECKS=1` when explicitly running an entire group with visual review enabled. Set `BROWSER_PATH` to a Chromium executable when the installed browser cannot be found automatically. The standalone portrait/photo scripts expect an already-running server; retain their existing URL environment variables.

The dice suite fixes open-dice's throw vectors as well as the recorded dice values,
so deployment does not depend on randomly chosen physics trajectories. It still
runs the real prediction, animation, and landing-face checks. A separate stalled
engine check verifies the production timeout preserves exactly one result. Set
`DICE_TEST_CPU_RATE=4` and `DICE_TEST_SOFTWARE_RENDERING=1` to exercise slow software
painting as well as JavaScript. The suite verifies that natural-20 particles follow
the 3D throw, and that particle lifetimes remain bounded at low frame rates.
Failures save the tray state,
browser errors, console messages, and a screenshot in `.tmp/browser-diagnostics/dice/`
for the workflow's existing artifact upload.

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

On failure, the photo suite records a screenshot and control geometry/state under `.tmp/browser-diagnostics/`. The deployment workflow uploads those diagnostics as `browser-failure-diagnostics`, while preserving the original test failure.

Photo-test startup waits for the service worker to activate before checking control.
If the initial navigation raced activation, it reloads once under the active worker.
The control check retains the 60-second bound used by the portrait suite; all
subsequent offline checks still require actual service-worker control.

# Deployment check policy

Pages deployment is gated on working functionality: source syntax, a successful build, rules and save validation, loading the built site beneath the Pages subpath, usable images, character and equipment interactions, portrait creation/editing, photo matching, appearance selection/persistence, keyboard dialog focus, and offline operation. Functional failures still stop deployment.

Palette values, text contrast measurements, exact dimensions, panel height ceilings, label overlap measurements, artwork centering/camera angles, compact swatch layout, and image byte budgets are optional design review checks. Changing a font, color, spacing value, thumbnail resolution, or decorative treatment should not block publication. These checks remain available for design work; the deployment job explicitly sets `QUESTLOG_VISUAL_CHECKS=0`.

## Commands

| Command | Purpose |
| --- | --- |
| `npm test` | Functional unit tests, including save/rules validation and appearance behavior |
| `npm run test:themes` | Functional browser checks for both appearances and System, all routes at desktop/mobile sizes, dialogs, images, reduced-motion interaction, persistence, and offline reload |
| `npm run test:visual` | Optional palette contrast tests plus the theme suite with layout/contrast measurements and screenshots |
| `npm run test:sheet -- --visual` | Add optional sheet layout and thumbnail dimension measurements |
| `npm run test:portraits -- --visual` | Add optional portrait/editor layout and equipment framing measurements |

The equipment and photo-matching browser suites also accept `--visual` for their optional measurements. Set `QUESTLOG_VISUAL_CHECKS=1` when explicitly running an entire group with visual review enabled. Set `BROWSER_PATH` to a Chromium executable when the installed browser cannot be found automatically. The standalone portrait/photo scripts expect an already-running server; retain their existing URL environment variables.

To exercise the packaged production site, set `THEME_TEST_URL` to its served subdirectory and `THEME_TEST_PRODUCTION=1`. That mode also verifies the development workshop is excluded from production. No particular cache version string or exact document title is required; the test loads the app and images offline to verify the behavior directly.

## Image loading and diagnostics

The theme check in [failed run 43510866087](https://github.com/MelchiorDahrk/DnD-App/actions/runs/43510866087) waited on `image.decode()` for every equipment image, including deferred offscreen images. Chromium could leave that promise pending until the three-minute workflow step expired, even though the app built and the earlier functional suites passed.

The shared browser helper now makes the test targets eager, waits at most 15 seconds for load completion, and checks nonzero decoded dimensions. It reports broken image URLs instead of awaiting an unbounded decoding promise. The theme suite covers an image far below the viewport and confirms an invalid image is still rejected. Checkpoint messages identify the active phase if a future run fails. This affects only tests; production lazy loading is unchanged.

## Mobile palette interaction

Opening a part palette schedules a native `details` toggle that rebuilds its buttons. Photo tests wait for that initial render, use locators that reacquire replaced controls, and verify the chosen part and enabled color control after clicking. Both 320px and 390px fresh-palette paths remain functional deployment checks. Set `PORTRAIT_PHOTO_CPU_RATE=4` when running `test:portrait-photos` to stress those mobile interactions under slower rendering.

On failure, the photo suite records a screenshot and control geometry/state under `.tmp/browser-diagnostics/`. The deployment workflow uploads those diagnostics as `browser-failure-diagnostics`, while preserving the original test failure.

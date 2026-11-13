# The adventurer’s journal

Questlog has one fantasy interface in two appearances: **Daylight Adventurer** (light) and **Candlelit Adventurer** (dark). They share component markup, typography, spacing, portrait and equipment geometry, decorative assets, and interaction rules. The previous minimalist palette is replaced.

## Files and responsibilities

- `theme.css` defines structural tokens plus semantic palettes for page, sidebar, panels, recesses, text, brass, control boundaries, focus, statuses, shadows, and lighting. Legacy aliases such as `--paper` and `--green` let existing modules use the same design system.
- `styles.css` retains the application’s layouts and selectors, with semantic paint values and a shared journal component layer. Both appearances use those same rules. Use `--button-primary`/`--button-text` for filled controls, `--forest-ink` for text, and `--hero-*` for evergreen artwork stages; do not use one color for both text and arbitrary backgrounds.
- `theme.js` is a small, synchronous script loaded before styles. It resolves appearance before first paint, updates `data-theme`, `data-theme-preference`, browser `theme-color` and `color-scheme` metadata, and synchronizes native selectors. It has no dependencies and no access to character data.
- `vfx.css` applies the journal’s material tokens to existing passive effect captions, rest scenes, and level celebrations. Effect mechanics, timing, sound, and reduced-motion behavior are retained.
- `assets/gui/` contains the selected Kenney decorations, provenance, and original CC0 license.

## Choosing an appearance

Appearance controls are on the empty journal landing page, in the desktop sidebar, and in **Settings & backup** on every device (mobile: More → Settings & backup).

Choices are Light — Daylight Adventurer, Dark — Candlelit Adventurer, and System — follow device. System is the default. Selection is saved as `questlog.appearance`, independently of the `questlog.v2` character save and backup schema. Changes apply immediately, synchronize across tabs, and do not reload or alter a character. With System selected, changes to `prefers-color-scheme` update the UI automatically; explicit choices ignore those changes. Invalid preferences fall back to System. If browser storage is blocked, appearance still works for the current visit.

Use `window.QuestlogTheme.set('light' | 'dark' | 'system')` for integrations. Its `preference` and resolved `theme` getters are read-only. `set()` returns whether persistence succeeded. A `questlog:theme` document event carries `{preference, theme}`. New selectors use `data-theme-select` and an associated label; production renderers must initialize their value from `QuestlogTheme.preference`.

## UI coverage

The audit covered the vanilla HTML/JavaScript shell, the original root palette and hardcoded paints throughout `styles.css`, the seven route renderers in `app.js`, and the shared native `#modal`. No application framework or character schema was added.

| Surface | Shared production components |
| --- | --- |
| Landing, sidebar, top bar, mobile navigation | Brand, native appearance selectors, navigation states, character picker |
| Character sheet | LEGO portrait frame, engraved abilities, combat/HP/XP, collapsible sections, favorites, resources |
| Inventory | LEGO WebP slots, quantity controls, equipment states, currency, searchable icon picker |
| Spellbook | Spell cards, slot diamonds, prepared controls, concentration, casting review |
| Journal | Parchment/dark note cards, search/filter, long note reader and editor |
| Dice | Shared tray, die display, roll modes, history and result dialogs |
| Compendium and Settings | Catalog previews, forms, sound controls, backup and install screens |
| Dialogs and overlays | Creation/editing, deletion/confirmation, level-up, rests, combat, scanning, toasts, portrait editor surrounding UI |

Specialized dialog producers in `attack-ui.js`, `level-up-ui.js`, `catalog-ui.js`, `sheet-scan-ui.js`, and `portrait-ui.js` retain their controls and mechanics. `portrait.js`, `item-icons.js`, `equipment-icons.js`, the Bricktrait iframe, and its LDraw asset pipeline continue to own imagery. Original scenery, sound, passive VFX, and lazy portrait/offline handling are retained.

## Components and accessibility

Serif journal titles and numeric statistics complement system sans-serif controls and monospaced folio labels. Repeated controls use restrained bevels; portraits get the Kenney nine-slice corner frame. Equipment uses recessed slots around the existing colorful LEGO WebPs. Images are never recolored or desaturated. Portrait creation, LDraw loading, image generation, and the embedded Bricktrait editor are unchanged; the surrounding dialog uses production journal styles. Fixed neutral surfaces and vivid crop markers in the photo analysis interface remain deliberate image-reference tools.

Normal text token combinations meet WCAG AA 4.5:1; large text uses 3:1. Form boundaries and focus indicators are distinct in both appearances. Keyboard focus is visible, native selects remain keyboard accessible, and HP/XP expose progress values. Prepared/equipped states use text and check marks. Used spell slots are hollow, dashed, and crossed; available slots are filled. Ability favorites occupy a separate band on narrow screens. Active navigation has a diamond and a filled surface. Reduced motion removes transitions and animated decoration while retaining the existing static effect feedback. Forced-colors mode removes decorative masks and preserves system control boundaries.

## Development workshop

Run `npm start` and open `/dev/theme-showcase.html`. It uses the actual production styles and asset helpers, and includes both palettes, typography, buttons, navigation, a framed LEGO portrait, abilities, HP/combat, LEGO equipment, spell slots, forms, a working native dialog, and notifications. Switch appearance with the native selector. It is omitted from the static build, service-worker precache, and normal application navigation.

## Offline and performance

The blocking appearance script is about 2 KB, requires no framework, and makes no network calls. Decorative PNGs total less than 1 KB; system fonts require no external assets. `scripts/build.mjs` includes the runtime, palette CSS, and GUI assets. `sw.js` uses cache `questlog-app-v29-adventurers-journal` and precaches all four runtime appearance assets. Relative paths work beneath a GitHub Pages subdirectory. Existing portrait-part lazy loading and offline equipment caches are retained. Future shell assets must be added to both build packaging and precache, with a cache version bump.

## Validation

`npm test` includes appearance boot, explicit/system changes, persistence failures, invalid preferences, cross-tab synchronization, metadata, and cache/build inclusion. `npm run test:themes` launches a real Chromium browser, checks all seven screens at 1440, 768, 390, and 320 pixels in both appearances, switches themes through native controls, verifies dialogs and LEGO images, checks reduced motion and offline reload, with functional checks independent of exact palette values, copy, cache version strings, or component dimensions.

Set `BROWSER_PATH` to a Chromium executable if one is not found automatically. Firefox can run general checks but Puppeteer’s media emulation requires Chromium. `THEME_TEST_URL` optionally targets an existing server, including a deployment subdirectory; otherwise the test starts and stops its own server. For a production build, set `THEME_TEST_PRODUCTION=1` and point `THEME_TEST_URL` at its subdirectory; the suite then verifies the workshop returns 404. Run the existing sheet, character, equipment, combat, rests, level-up, and portrait browser suites for interaction regressions. Run `npm run test:visual` to add palette/rendered contrast and layout measurements plus screenshots under `.tmp/`. Other browser suites accept `--visual` for optional artwork/layout measurements. These design checks are excluded from deployment; see [the deployment check policy](deployment-checks.md). Contrast checks complement visual review and keyboard checks; they do not constitute a complete assistive-technology audit.

Validated on 2026-11-13: 148 functional unit tests, source syntax checks, functional appearance checks against source and the packaged `/dist/` subdirectory, and the affected sheet, item icon, real Bricktrait portrait, and photo matching browser suites passed. The optional palette and browser visual review also passed separately. Deployment now gates functionality; see the policy above for optional design checks.

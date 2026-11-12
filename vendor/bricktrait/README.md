# Bricktrait integration

Vendored from https://github.com/Maxichance/bricktrait at commit
`f333d939753526469e4169481d578aed74e955ed` (MIT, © 2026 Maxichance).
The original application documentation is in UPSTREAM-README.md.

The editor, components, renderer, LDraw loader, pose controls, colour tools,
composition, history and parts-building scripts are upstream code. Questlog
mounts the Svelte page with a small standalone Vite entry instead of SvelteKit.
Integration changes add a same-origin save/cancel bridge, use relative asset
paths, render thumbnails locally on demand, and omit uploaded backgrounds
(upstream does not include their pixels in editable portrait state).
The downloader uses bounded concurrent writes and completion markers so
Windows builds can resume interrupted extraction. The packer checks its output
directory before clearing generated files; its geometry and catalogue logic
are unchanged.
Small responsive fixes keep the mobile colour strip compact and the header
controls inside the editor viewport.

Run `npm ci` in the repository root, then `npm run build:portraits`.
The first build downloads the official and unofficial LDraw libraries into
`.cache/`, then runs Bricktrait's original parts packer. Later builds reuse
`vendor/bricktrait/static/ldraw/`. All generated parts and editor assets are
self-hosted under `portrait-maker/` and copied to `dist/` for deployment.
No external website, CDN, or online service is used by the editor at runtime.
Thumbnails render on demand using the original renderer, avoiding thousands
of pre-rendered thumbnails in the source repository.

Questlog's fantasy extension uses `fantasy-catalog.json` as an explicit,
category-based selection allowlist. Full LDraw metadata and geometry are retained
for old designs. Embedded previews and saved WebPs enforce transparent,
square, borderless composition; old saves are updated only on **Use portrait**.
The embedded editor hides scene controls while the standalone page retains them.
The existing thumbnail renderer also pre-renders 36 mapped inventory accessories;
the rest of the editor's thumbnails continue rendering on demand.
See [maintenance and testing notes](../../docs/fantasy-portraits.md).

The build preserves LDraw's per-file CREDITS.txt, CAreadme.txt and license
texts. Code attribution and the MIT license ship alongside the editor.
LEGO® is a trademark of the LEGO Group, which does not sponsor, authorize,
or endorse this project. Neither Questlog nor Bricktrait is affiliated with
the LEGO Group, LDraw.org, or any game publisher.

# Portrait reference caching

Ordinary application, account, and unrelated dependency changes must reuse the
existing portrait references. A portrait build still checks the index, but should
report `4830 references unchanged` (or the current catalog count). Checking is not
rendering.

The previous builder hashed every byte of `package-lock.json` into every part's
render signature. Adding Firebase invalidated all 4,830 references despite leaving
the renderer unchanged. Its workflow also saved the cache after the new Firebase
test step, so a failed test could discard a completed expensive render.

The renderer now hashes its source files plus the resolved runtime dependency
graph of Three, Vite, and Puppeteer. Unrelated packages, lockfile formatting,
deduplication paths, and text line endings do not invalidate the renders. Each
reference also retains its own transitive geometry fingerprint. Real rendering or
renderer-dependency changes still invalidate references; geometry changes
invalidate affected parts.

GitHub Actions uses the same scoped dependency hash in its cache key, restores
older cache prefixes, and saves the generated assets immediately after building,
before Firebase and other post-build tests. The actual cached paths stay unchanged.

## Existing caches

`scripts/data/portrait-reference-cache-migrations.json` records old renderer hashes
derived from trusted repository commits. Adoption requires both an identical new
renderer-input fingerprint and an exact match between the old per-part signature
and the current geometry. The builder updates signature metadata and assembles
the index using the existing descriptors and WebPs. It never treats an arbitrary
old cache as valid. No Git history or network access is required during deployment.

The maintenance script `scripts/build-portrait-cache-migrations.mjs` generated
that manifest from the recorded commits; it is not part of normal builds.

## Fast checks

```sh
npm run test:portrait-cache
npm run check:portrait-cache
```

The second command plans reuse without rendering or modifying the cache. It exits
unsuccessfully if any reference would need rendering. The actual index builder
does not launch Chromium or the preview server when all references are reusable.

Validation of this fix reused all 4,830 existing references with **0 to render**;
the next invocation reported all references unchanged. Regression tests cover
unrelated Firebase updates, real renderer/dependency changes, dependency
deduplication, line endings, legacy adoption and per-part geometry, and CI saving
the cache before Firebase tests.

A missing/evicted cache or genuine renderer changes can still require rendering.
This fix prevents unrelated pushes from invalidating cached artwork; it does not
skip required work when the underlying images actually need to change.

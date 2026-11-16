# Firebase implementation report

The repository was audited first; the schema, permissions, migration and sync
design were recorded in [firebase-design.md](firebase-design.md) before cloud
persistence was implemented. No application framework or hosting migration was
introduced. `model.js` and the default characters retain their existing rules
and version 2 format.

## Phase 1 — integration and accounts

Implemented optional email signup/login, Google popup login, verification email,
password reset, sign-out, persistent sessions, friendly cancellation/provider
errors and a themed Account panel. Missing/disabled Firebase leaves guest play
available. Firebase 13.3.0 is bundled locally through the existing Vite dependency.

Files: `firebase-config.js`, `firebase-client.js`, `scripts/firebase-entry.js`,
`scripts/build-firebase.mjs`, `cloud-ui.js`, `app.js`, `styles.css`, `package.json`,
`package-lock.json`, `scripts/build.mjs`, `sw.js`, `.gitignore`, Firebase license.

Validation: configuration/cancellation unit tests; Auth emulator account creation,
verification/reset requests and login; browser refresh/session and guest/offline
checks. The SDK builds as a self-contained browser ES module. Real Google OAuth
and email delivery remain manual project checks.

## Phase 2 — individual cloud saves

Implemented private per-character manifests and JSON fragments, separate live
state, per-account browser namespaces, explicit guest migration, ID collision
choices, debounced content changes, partial writes, revision checks, stale-read
protection and per-character status. Deletion removes content/live data and leaves
a minimal tombstone to block offline resurrection. Version 2 backups are unchanged.

Files: `cloud-model.js`, `cloud-store.js`, `cloud-sync.js`, `cloud-ui.js`, `app.js`,
`tests/cloud.test.mjs`, `tests/emulator/firebase.test.mjs`.

Validation: custom fields and Unicode fragmentation round-trip; duplicate upload
rejection; account isolation; independent/overlapping two-device edits; deletion;
JSON v2 regression tests; queue storage failure and out-of-order reads.

## Phase 3 — parties and invitations

Implemented named parties, 256-bit invitation tokens, server-timestamped seven-day
expiry, revocation, authenticated joins, creator membership management, leaving,
sharing and unsharing. Membership and ownership are enforced by Rules. Public
projections exclude journals, inventory, backstory, custom metadata, attack notes
and spell notes. Account emails are not used as public party display names.

Files: `cloud-store.js`, `cloud-ui.js`, `firestore.rules`, `firestore.indexes.json`,
`firebase.json`, emulator tests.

Validation: direct arbitrary membership writes, invite listing, expired/revoked
token joins, role escalation, unauthorized private reads/writes and creator edits
of another user's sheet are denied. Removing a member ends server access; their
private saves continue and detach from the former party.

## Phase 4 — live dashboard and offline operations

Implemented responsive portrait/HP/resource cards and complete read-only public
sheet details (abilities, saves, skills, attacks and spells). Large public sheets
are fragmented and loaded on demand. Firestore listeners update active owned live
state and the visible selected party; teardown covers navigation, account changes
and party changes. Content hashes suppress unchanged shared sheets.

Gameplay operations are durable before the account save is advanced. Receipts and
transactions prevent duplicate damage/healing after retries or lost responses.
Damage, healing and temp HP replay through the existing model. Slot/feature
spending merges within current caps; conditions merge by membership. Overlapping
complex edits/restoration require an explicit resolution. Live-only reconciliation
reads small state records rather than reloading the character's content fragments.

Files: `cloud-model.js`, `cloud-store.js`, `cloud-sync.js`, `cloud-ui.js`, `app.js`,
`styles.css`, `tests/emulator/browser.test.mjs`, model/emulator tests.

Validation: real `onSnapshot` party updates, concurrent damage/healing, temp HP,
slots/features/conditions, offline damage across browser reload and reconnection,
durable replay after a lost acknowledgement, read-only controls and public sheets
larger than Firestore's single-document limit.

## Phase 5 — security, tests, deployment and setup

Added deny-by-default Rules, field/type/revision checks, immutable ownership,
invitation validation, index exemptions, Auth/Firestore emulator tests, production
subdirectory/offline browser checks, Java 21 + emulator CI gate and setup/usage
documentation. A compatible patched Node gRPC override removes the production
dependency advisory; that transport is not in the browser bundle.

Files: `firestore.rules`, `firestore.indexes.json`, `firebase.json`, tests,
`.github/workflows/deploy.yml`, `docs/firebase-setup.md`, this report, README.

Validation commands:

```sh
npm run check
npm test
npm run build
npm run test:firebase
npm run test:deploy -- --group sheet
npm audit --omit=dev
```

Final validation results:

| Check | Result |
| --- | --- |
| Source/syntax checks | Passed |
| Full Node regression suite | 288 passed, 0 failed |
| Focused cloud model/queue suite (included above) | 9 passed |
| Auth/Firestore Rules and integration suite | 12 passed, 0 failed |
| Production bundle and static packaging | Passed |
| Existing production browser group `sheet` | All five suites passed (sheet layout, item icons, magic items, treasure, themes) |
| Production dependency audit | 0 vulnerabilities |

The emulator browser
test supports `QUESTLOG_TEST_BUILD=dist` and serves `/Questlog/` to verify real
production module packaging, invitation subpaths and service-worker fallback.
CI uses this production mode and retains every existing deployment browser group.
The separate heavy dice/portrait browser groups were not rerun locally; their
existing CI gates remain required. Live production Firebase was not contacted
for these checks; Auth and Firestore verification used the local emulators.

## Manual setup and boundaries

Follow [firebase-setup.md](firebase-setup.md): enable Email/Password and Google,
authorize the Pages/custom hostnames, create Standard Firestore, and deploy the
repository Rules/index exemptions before using production cloud accounts. No
administrative credentials are included, and no live project settings or Rules
were deployed by this task. Verify real Google OAuth and email delivery once.

Guest play needs none of this setup. This release permits one party per shared
character, keeps operation receipts indefinitely for idempotency, and supports creator handoff when leaving (or closing an empty party). Complex simultaneous edits may require
a copy choice. Already downloaded shared data cannot be erased from another
person's device. No paid Firebase dependency, server or Cloud Function is used.

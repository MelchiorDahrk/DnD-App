# Firebase setup

Guest play needs no Firebase setup. Existing `questlog.v2` browser saves and
version 2 JSON backups continue to work. No backend server, Cloud Functions,
Cloud Storage, service account or billing account is required.

## 1. Create a free project

In the [Firebase console](https://console.firebase.google.com/), create a project
on the **Spark** plan. Keep billing disabled. The supplied public configuration
targets `questlog-3d16b`; use your own project for development if you do not manage
that project. Emulator tests always use `demo-questlog`, never production.

## 2. Register a web app

Project settings → Your apps → Add app → Web. Firebase Hosting is optional;
Questlog stays on GitHub Pages. Copy the web SDK configuration, which is public
application identification, into `firebase-config.js` or the build setting below.
Never put service-account JSON, private keys or Admin SDK credentials in the app.

## 3. Enable authentication

Authentication → Get started → Sign-in method: enable **Email/Password** and
**Google**. Set the Google support email and review the email verification and
password-reset templates. Questlog sends verification after email signup and
offers resending it in Settings. Normal email/password sign-in, persistent browser
sessions, sign-out and password reset are supported. Google uses a popup; allow
popups for the site. A cancelled popup leaves guest play available. When Firebase
reports a provider mismatch, sign in with the original method for that email.

## 4. Authorize deployment domains

Authentication → Settings → Authorized domains: add `YOURNAME.github.io` and
your custom hostname (hostnames only, without `/REPOSITORY/`). Keep the default
`PROJECT.firebaseapp.com` auth domain. For a separate development project, add
`localhost` and `127.0.0.1` if needed; localhost is not automatically authorized
in newer Firebase projects. See the [Auth troubleshooting guide](https://firebase.google.com/docs/auth/faq-and-troubleshooting).

## 5. Create Firestore

Build → Firestore Database → Create database → **Standard edition**, Native mode,
choose the region closest to your players, and start in **production mode**.
Use the default database. Do not enable open test rules. The design and schema
are in [firebase-design.md](firebase-design.md).

## 6. Deploy rules and index exemptions

Install dependencies and authenticate the Firebase CLI with your own account:

```sh
npm ci
npx firebase login
npx firebase deploy --project YOUR_PROJECT_ID --only firestore:rules,firestore:indexes
```

This deploys `firestore.rules` and `firestore.indexes.json`. Run the emulator tests
first. Rules enforce ownership and party membership, immutable ownership,
revision increments, allowed document fields, invite validity, and read-only
sharing. Invitations are random 256-bit bearer tokens, valid for 7 days, and can
be revoked by the party creator. Knowing a party ID grants no access.

If sign-in works but guest transfers, cloud backups and party creation report
**Missing or insufficient permissions**, check Firestore Database → Rules in the
same project as `firebase-config.js`. The default production-mode rule,
`allow read, write: if false`, blocks signed-in accounts too. Replace the complete
editor contents with this repository's `firestore.rules` and click **Publish**,
or run the deployment command above. Keep the full ownership and membership
checks; an unrestricted read/write rule is not needed. After publishing, use
**Settings → Account → Retry sync**. This reconnects stopped database listeners
and retries pending saves. JSON import can succeed before rules are deployed
because it first saves into the current browser's local account storage.

## 7. Configure public SDK settings

The checked-in `firebase-config.js` contains the supplied public web settings.
Local development uses those settings unless you provide a runtime override
before the app module loads:

```js
window.QUESTLOG_FIREBASE_CONFIG = { /* your public web configuration */ };
// Or disable accounts completely:
window.QUESTLOG_FIREBASE_CONFIG = null;
```

Production packaging accepts `QUESTLOG_FIREBASE_CONFIG` as a JSON object; use
the literal `null` for a guest-only build. Missing/invalid runtime configuration
does not prevent guest play. Firebase SDK 13.3.0 is pinned in `package-lock.json`
and bundled into the local `firebase-sdk/firebase.js`; no CDN or bare browser
imports are required. See [SDK release notes](https://firebase.google.com/support/release-notes/js).

## 8. Run local emulators

Install Node 24+ and Java 21+. Then:

```sh
npm ci
npm run test:cloud
npm run test:firebase
```

The Firebase CLI downloads its emulator on first use. `test:firebase` starts Auth
on port 9099 and Firestore on 8080, loads the repository rules, runs the integration
suite and stops both services. No Firebase login is needed for the demo project.
To keep emulators running for manual browser testing:

```sh
npx firebase emulators:start --project demo-questlog --only auth,firestore
npm run dev
```

For an emulator-only browser, add these values before `app.js` (or inject them
with browser developer tools using a local override, then reload):

```js
window.QUESTLOG_FIREBASE_CONFIG = {
  apiKey: 'fake-key', projectId: 'demo-questlog', appId: 'emulator',
  authDomain: 'demo-questlog.firebaseapp.com'
};
window.QUESTLOG_FIREBASE_EMULATORS = {host:'127.0.0.1',auth:9099,firestore:8080};
```

Emulator routing is accepted only on loopback hostnames. Use the Auth emulator's
logged action links to test verification and reset emails. It does not deliver
real email or validate real Google OAuth; verify these once in your configured
Firebase project before announcing production account support.

## 9. GitHub Actions and Pages

The existing workflow installs the pinned dependencies, runs the emulator gate
with Java 21, builds the SDK alongside the existing assets, and keeps the existing
Pages subdirectory/browser/offline checks. Set repository Actions variable
`QUESTLOG_FIREBASE_CONFIG` to a compact public JSON object to override the project;
leave it empty for the checked-in settings, or `null` to disable cloud accounts.
No Firebase administrative secret is needed to build or publish the static app.
Deploy Firestore rules separately using step 6 before enabling accounts publicly.

All app URLs and SDK imports are relative. Invitation URLs retain the repository
subdirectory and use `?invite=TOKEN#party`. The service worker precaches the local
SDK and cloud modules, and never caches cross-origin Firebase API traffic.

## 10. Verify two accounts and two devices

1. Open two browser profiles/devices. In Settings → Account, create Alice and Bob.
   Verify email delivery, sign out, sign back in, and refresh to check persistence.
2. On Alice's device, accept **Copy guest characters to account**. Originals remain
   under the guest key. Matching IDs are skipped, or explicitly copied with new IDs.
3. Create a party, generate an invitation link, and open it as Bob. Authenticate
   before joining. Confirm an arbitrary party ID and a revoked link cannot join.
4. Both users share one synced character. Open Party on both devices. Apply damage
   and healing, including temp HP. Check conditions, inspiration, slots, features,
   exhaustion and concentration. Changes should arrive without refreshing.
5. Open a shared sheet and confirm it is read-only and contains no journal or private
   custom data. Remove a member and confirm their listeners/access end.
6. Sign into Alice on another profile. Apply simultaneous damage on both devices;
   both operations must be preserved. Conflicting text or rest/resource restoration
   edits must offer a resolution instead of silently replacing data.
7. Go offline, make gameplay and sheet changes, reload, then reconnect. Pending
   operations should flush once. Export a version 2 JSON backup before resolving
   overlapping edits; **Keep both** preserves a separate local copy.
8. Sign Alice out, sign Bob in on the same browser, and verify Alice's account sheets
   are absent. Sign out to return to the original guest sheets.

## Limits, usage and recovery

Keep the project on Spark and monitor Firebase console → Firestore → **Usage**
for reads, writes, deletes and storage, plus Google Cloud quota pages. Standard
Firestore's documented free allowance includes 1 GiB stored data, 50,000 document
reads/day and 20,000 document writes/day; confirm current allowances for your
edition and region in the [quota guide](https://firebase.google.com/docs/firestore/quotas)
and [Spark plan guide](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans).
Quota exhaustion leaves local play and pending operations available until service
recovers. No paid service is automatically enabled.

Each gameplay transaction reads its manifest, live state and operation receipt,
and writes a live record plus an immutable receipt. Sharing adds a small live
projection write; listeners and Rules membership lookups add reads. Private
content is loaded at sign-in/content revision changes and active-character changes;
live listeners are limited to the active owned character and selected party.
Text edits debounce for 700 ms; unchanged `persist()` calls do not upload sheets.
Content is JSON-fragmented below document limits, with index exemptions, and only
changed fragments are written. The existing 2 MB browser backup ceiling still
applies to each local namespace. A character can share with one party at a time.

Operation receipts are retained indefinitely to prevent replaying old offline
operations. Deleted sheets remove their content/live records and retain a minimal private
tombstone for conflict detection. Monitor growth; administrators may export and
clean retired data with the Firebase console after ensuring no device has pending
operations. Automatic TTL cleanup and Functions are intentionally unnecessary.

Complex concurrent edits (including rests and resource restoration) require an
explicit copy choice. Slot/feature spending merges as bounded increments; damage
and healing use the existing model rules. Previously downloaded shared information
cannot be remotely erased from a former member's device. Creators can transfer ownership to an existing member before leaving; the final
member can close the party, which revokes its invitations.
Keep regular version 2 JSON backups, especially before clearing browser storage.

The Node-only gRPC dependency is overridden to a patched compatible 1.x release
for GHSA-m9gg-hp2v-232j. It is excluded from the browser SDK bundle. The pinned
lockfile and emulator tests cover the overridden dependency.

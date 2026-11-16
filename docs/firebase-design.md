# Accounts, cloud saves, and parties

## Audit

`app.js` loads version 2 backups from `questlog.v2`. All durable mutations reach
`persist()` (some bypass `commit()`). Characters mutate in place. `model.js`
validates backups and owns HP/rest rules. The static packer copies an explicit
file list; the module service worker precaches an explicit asset list. Keep these
contracts and the JSON backup format.

## Schema and authorization

* `users/{uid}/characters/{id}`: owner, content revision, chunk count, party ID,
  and a small name summary. Existing character IDs are retained.
* `.../content/{index}`: JSON fragments containing all persistent character
  content, including custom fields and LEGO portraits, excluding live values.
  Fragments stay below Firestore's document limit and are not indexed.
* `.../state/live`: authoritative HP/max HP, temp HP, conditions, exhaustion,
  death saves, inspiration, concentration, hit dice, slot use and feature use.
  Slot/feature limits live here too, so a stale sheet cannot override current caps.
* `.../operations/{randomId}`: immutable operation receipts, written atomically
  with character changes. Retries after an uncertain connection cannot apply twice.
* `parties/{id}`: creator and name; `members/{uid}`: membership. Joining requires
  a valid invitation in the same transaction. Membership cannot be self-created
  using a party ID. Owners manage invitations and remove members; members leave.
* `invitations/{256-bit token}`: party, creator, expiration, revoked flag.
  Exact authenticated token reads only; listing is forbidden. Tokens are bearer
  capabilities. Creators may list their party's invitation metadata separately.
* `parties/{id}/characters/{uid_id}` and its `state/live`: explicitly shared
  projection plus small live state. Only the character owner writes; current
  party members read. No journal, personal notes, inventory descriptions, or
  arbitrary private metadata enter the projection.
  Its `sheet/{index}` fragments contain allowlisted abilities, skills, attacks and
  spell details. Only opening a read-only sheet loads these fragments. Content
  hashes suppress unchanged projections, and live changes never transfer them.

Rules deny everything else and validate document keys, types, revisions, owner
immutability, membership, invitation validity, and sharing links. A removed
member loses server access immediately. Previously viewed information cannot be
erased from another person's memory, screenshots, or offline device cache.

## Synchronization and migration

The guest key remains untouched. Accounts use separate localStorage state and
queue keys by UID; Firestore uses memory caching to avoid a persistent shared
browser cache. Sign-out closes listeners and restores guest state. First sign-in
offers an explicit copy/upload of guest characters. Originals remain in the guest
store. Same-ID collisions require a choice; upload never overwrites a cloud copy.

`persist()` compares normalized characters against a tracked local baseline.
Unchanged characters produce no operations. Text/content edits debounce; live
changes flush immediately. Operations are durable before network submission.
Transactions read server revisions and operation receipts. Damage/healing/temp HP
replay using the existing `changeHP()` rules against current server values.
Condition membership merges; independent sheet fields merge with compare-and-set
checks. Incompatible edits/rests show a resolution choice and retain local data.
Content saves cannot overwrite live values. Full sheet content is chunked, with
only changed fragments written; HP changes never load or send content fragments.

Listeners cover the signed-in character index and its live/content records, and
only the selected party's shared records. Teardown runs on account/party changes.
No background polling. Offline transactions are not attempted as successful:
pending work remains local and retries on reconnect. Explicit pending, synced,
offline, error and conflict states are shown. Local JSON backups remain version 2.

## Validation and operating limits

Each phase adds focused tests. Auth/Firestore integration and rules are tested
against local emulators, never inferred from mocks. Production configuration is
public web configuration. The modular SDK is bundled locally with Vite, using
relative module URLs for GitHub Pages and service-worker precaching. Missing or
disabled configuration leaves guest operation available. No Functions, Storage,
administrative credentials, or paid services are needed. See `firebase-setup.md`
for setup, usage limits, and manual two-device verification.

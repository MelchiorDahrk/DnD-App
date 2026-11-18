# Live party play

The Party tab opens the shared table when an account belongs to a party. The edit
icon beside its name opens `#party-manage` for sharing characters, invitations,
renaming, switching parties, and membership management. Guest and no-party entry
flows remain available. Cards use equal widths, at most three per desktop row;
four characters balance into two rows of two. Small screens use two columns.
Status icons sit beside each portrait and open a label dialog. Management lists
all named parties without character sheets; editing a party preserves the current
character, while switching selects a local character shared with that party.

Session Mode replaces the main Questlog/character header. Sheet navigation and
page filters remain sticky beneath it. Skills opens the comparison dialog from
the play controls. Dice roll directly in the fixed-size party tray.

`party-model.js` contains row balancing, initiative ordering, skill ranking,
activity descriptions, and inventory reservation/receipt rules. `party-ui.js`
owns the table, incoming initiative prompts and rest invitations, transfer offers, notifications, and
Session Mode. Party preferences live in the account's existing settings and
round-trip through backups. The selected party stays subscribed across routes.

## Shared state

- `parties/{party}/session/combat`: initiative scores, temporary modifier map,
  active character, round, and encounter ID. Starting an encounter clears prior
  scores and prompts each owner to roll in the app or enter their physical roll's
  total, including all modifiers. Prompts appear across pages; dismissed prompts
  can be reopened from that owner's party card. Other players' scores are
  read-only. The store and Firestore rules restrict score and modifier changes
  to the character's owner. Begin turns after players enter their scores.
  Transactions serialize simultaneous turn changes. App rolls use the sheet's Dexterity, recorded
  feat/class initiative bonus, Exhaustion and roll mode. Temporary modifiers add
  to this calculation for the encounter; ending it clears scores and modifiers
  and resets the round. The sheet's initiative roll also updates an active encounter.
- `activities/{event}`: immutable events with a server timestamp. Character
  changes append damage, healing, unconsciousness, inspiration, condition, and
  concentration events in the same transaction as their live state. Operation
  IDs prevent duplicate events when an offline operation retries. The table
  subscribes to the newest 50 events.
- Rolls publish the already-recorded result and individual faces. Spectator
  dice use a separate presenter session, preserving local roll dialogs and
  resource spending. Existing dice colors, reduced motion, and fallback behavior
  apply. Rerendering the party preserves the rolling DOM and physics session.
- `rests/{rest}/replies/{uid}`: a proposal and each member's immutable yes/no
  response. Yes opens that player's normal rest choices; it does not mutate
  another player's resources. Recent proposals and vote totals stay on the table.
- Shared projections include skill bonuses for the finder. Older projections
  load their existing read-only details until the next share/content update.

Existing portrait images are used unchanged. CSS supplies damage shake, temporary
green healing glow/sparks, unconscious dimming, and inspiration glow. Existing
sound preferences and semantic sound events also govern party feedback. No
additional portrait renders or arm animations are produced.

## Accepted transfers

Transfers use owner-authorized escrow rather than cross-account sheet writes:

1. The sender transaction rereads their private sheet, checks current quantities,
   removes the offered assets, and writes an immutable pending offer plus a
   private escrow recovery record. Only the offered item data is visible to the
   party; personal item descriptions are omitted from that public offer.
2. The recipient's transaction rereads the offer and their own private sheet.
   Accepting credits that sheet and marks the offer accepted atomically. Declining
   credits nothing. Both participating players must still belong to the party.
3. The sender can cancel a pending offer. Declined offers are reclaimed
   automatically while connected. A refund restores the original item description
   and removed linked weapon action from private escrow, then atomically marks the
   offer refunded and deletes its recovery record.

Terminal statuses and transaction retries prevent double acceptance or refund.
Concurrent offers reread balances and cannot overspend. Recovery runs on sign-in
and lost party access, including membership removal and closed parties. The
normal leave flow cancels the sender's outstanding offers before unsharing.
The character deletion flow blocks while that character has an unresolved offer.
Transfers require online access and a synchronized local sheet. Equipped and
attuned items must be unequipped/unattuned first; partly used stacks transfer as
a whole to preserve their counters. Recipients receive items with fresh IDs.

Private character ownership and read-only shared-sheet rules are preserved.
As with existing character editing, game inventory values are controlled by
their owners; Firestore cannot validate arithmetic inside JSON content chunks.
Deploy the updated `firestore.rules` together with the app assets.

Pages publication does not deploy Firebase rules. The production Firebase project
must have this revision's rules before enabling the new session features. A denied
feature listener preserves the party and shows one setup warning; only a
server-confirmed missing membership or deleted party produces “Party access ended.”
After publishing rules, use **Retry connection** to reconnect the listeners.
The legacy-rules emulator/browser tests exercise sign-in, existing parties,
creation, and recovery across this version mismatch.

## Verification

`tests/party.test.mjs` covers layout, ordering, skills, activities, transfers, and
settings. `npm run test:firebase` adds rule and two-account browser coverage for
acceptance, concurrent retries, refunds, removal, exact shared dice, votes,
notifications, Session Mode, and responsive layouts. Browser screenshots are
written to `.tmp/browser-diagnostics/party/`.

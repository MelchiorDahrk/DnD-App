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

## Dungeon Master

The party owner is the default DM, including in parties created before DM
assignment was available. In **Manage party → Edit party → Assign DM**, the
owner can select a shared character by character and player name or choose
**Reset to Party Owner**. The DM badge appears on the designated character and
the party header names the effective DM. The role applies to the character's
controlling account. Unsharing or deleting the character, or removing its
player from the party, returns the DM role to the current owner.

The owner retains invitations, membership, settings, and ownership controls.
The DM runs encounters, sends group rest invitations, and manages stores.
Members still enter initiative for their own characters and see the shared
turn order. Rest invitations let each player open their own recovery choices.
The DM can send an invitation without sharing a character. The sheet's
**Rest** button opens an individual rest.

## Town stores

Open **Party → Stores**. The DM chooses **Create store**, selects a type, and
reviews the starter merchandise. Use the catalog search to add any item from
enabled sources. **Restore default inventory** replaces the merchandise with
the selected type's starting selection. Custom merchandise supports a name,
category, weight, description, and explicit prices. Enable **Open to party
members after saving** to publish the store. Closing it hides it from members
and keeps the saved inventory available to the DM for later use.

A price multiplier of 100% uses the catalog price. Buy and resale overrides
are final amounts in copper per catalog unit. Variable, compound, and unlisted
prices await a DM quote before purchase. Ordinary merchandise starts with
unlimited stock (∞). The DM can give any item a finite quantity or set it to
zero to display **Sold Out**. **Add Random Magic Items** selects distinct items
from enabled catalogs by rarity and item type, with one unit per generated
item by default. The saved selection and remaining quantities persist.

Select a shared character to shop. The store applies all five coin
denominations and makes change. A catalog bundle, such as a bundle of arrows,
counts as one unit on the shelf and in the pack. Buying weapons automatically
links their actions. The Sell tab quotes half-price resale for ordinary
equipment by default and full value for qualifying trade goods and treasure.
Each store type accepts fitting merchandise and items listed by the DM. The
DM can broaden acceptance and set per-item resale prices. Unequip, unattune,
or unpack restricted items before selling. Items with usage counters must be
full before they can be sold.

Trading requires an online connection and a synchronized character. If a
connection drops during checkout, use **Resolve trade** when you reopen Stores.
This reuses the original receipt ID and checks whether the trade already
settled before attempting it again. The character sheet and solo inventory
remain available offline.

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
- The party root's optional `dm` assignment is validated against current
  membership, the shared character, and its owning sheet. Firestore checks the
  effective DM on encounter controls, rest creation, and store management.
- `parties/{party}/stores/{store}` holds pricing, visibility, and lightweight
  catalog references. Store listeners run while the Stores dialog is in use.
  Each limited-stock purchase must have a new private receipt under the
  purchasing character. Rules verify the listed price, the exact stock
  decrement, party membership, and a corresponding revision on that buyer's
  own shared character. Checkout changes the sheet, receipt, and any shared
  stock in one transaction. Existing private-sheet rules continue to give
  character owners control of their own inventory and balance. The client
  enforces currency arithmetic, inventory changes, and store resale policies.

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
## Firebase deployment

Before publishing the updated app, deploy the rules and the store inventory's
index exemption to the production Firebase project.

```sh
npx firebase deploy --project YOUR_PROJECT_ID --only firestore:rules,firestore:indexes
```

Pages publication does not deploy Firebase rules. The production Firebase project
must have this revision's rules before enabling the new session features. A denied
feature listener preserves the party and shows one setup warning; only a
server-confirmed missing membership or deleted party produces “Party access ended.”
After publishing rules, use **Retry connection** to reconnect the listeners.
The legacy-rules emulator/browser tests exercise sign-in, existing parties,
creation, and recovery across this version mismatch.

## Verification

`npm test` covers party and shop models, including presets, magic item
filtering, currency, bundles, and linked actions. `npm run test:firebase` adds
rule and two-account browser coverage for DM changes, initiative, rest votes,
store publishing, finite-stock purchase races, retry, resale, transfers,
notifications, Session Mode, and responsive layouts. Browser screenshots are
written to `.tmp/browser-diagnostics/party/`.

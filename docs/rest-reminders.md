# Rest reminders

The rest dialog previews every automatic change and keeps the completed list open
after saving. It lists HP, available Hit Dice, temporary HP, Exhaustion,
concentration, death saves, each occupied spell-slot level, and each tracked
rest-based resource, with before → after values. Unchanged values are labeled.
Short Rests show their own resources, partial recovery, and configured Pact Magic
slots; their completion also reports HP and Hit Dice actually spent.

Uncheck a resource to preserve its expenditure when another rule prevents
recovery. Multi-rest cooldowns, including level 20 Divine Intervention, start
unchecked. Exhaustion recovery has its own control. Previewing, reviewing, and
cancelling do not change a character. Finishing applies the selected recovery
once, saves the sheet, and opens a completion screen without another submit
button. Reminder checkmarks carry into that screen; they are session-only review
marks, not character changes or a permanent daily checklist.

## Rules coverage and applicability

The 2026-11-13 audit read **1,604 wiki pages** and compiled **668** records of
names, unlock levels, rest timing, and source links. The audit traversed linked
class, subclass, species, feat, invocation, spell, equipment, magic-item, and
background pages on the 2024 wiki, plus the app's supported earlier subclasses
and Artificer. Forums, lore, and separately labeled UA/homebrew namespaces are
outside that traversal. The wiki also contains variant and third-party material
inside ordinary namespaces; reference lookup does not grant those options.

- Base class reminders use the character's class and level, even if a feature
  preset has not been added. Subclass reminders require the matching class,
  subclass, and unlock level, including existing subclass aliases.
- The app's existing 2024 replacement policy applies. Its earlier Artificer and
  unreplaced subclasses use their older references, including Beast, Rune Knight,
  Phantom, and Order of Scribes. Newer wiki subclass names can match a custom
  subclass explicitly recorded on a character. They do not replace older options.
- Core species traits and level gates have individual recovery reminders.
  Additional named wiki species have a species review reference; daily choices
  for Kalashtar, Khoravar, Hexblood, and Duskling have specific summaries.
  High Elf cantrip swaps are identified as a 2024 trait. Lineage casting follows
  2024 by default; an explicitly recorded older lineage suppresses that inference.
- Feats and invocations require a recorded feature. Crafter, Musician, Chef,
  Inspiring Leader, Weapon Master, Boon of Energy Resistance, and Pact of the Tome
  include specific choices. Unowned optional features are not inferred.
- Recorded spells and positive-quantity inventory entries are checked by name
  against the audit. Their own notes can also trigger a reminder. Dawn charges
  require dawn and any specified recharge roll; they are never automatically
  restored as a side effect of resting. Spells are never automatically recast.
- Custom/imported feature descriptions mentioning Long Rest, Short Rest, dawn,
  or daily recovery appear even without a catalog match. Include that timing and
  the actual rule in a custom feature's description. Custom reference URLs stay
  attached to the recorded entry.

Automatic amounts come exclusively from the saved resource's `reset`,
`shortRestRecovery`, `used`, and `maxUses` fields. An already tracked recovery does
not need a second generic reminder; separate rest choices still appear. An
untracked ability gets a manual recovery reminder, without inventing a resource
maximum. No required save fields or save version changed.

Daily rolls, spell preparations, chosen proficiencies/resistances/masteries,
crafted items, companion choices, Human Heroic Inspiration, and new temporary HP
remain player decisions, with links to their relevant editors after completion.
The list also calls out recorded conditions and potentially recoverable reduced
ability scores/maximum HP. Those require the effect's own rule to permit recovery.

## Implementation and verification

`rest-reference-data.js` contains names and timing facts, not copied rules text.
`rest-rules.js` supplies original summaries and character matching. Its pure
preview uses the same recovery semantics as `model.js`, including resource
exclusions. Both modules ship in the static build and offline cache.

Run `npm run build:rest-references -- --download` to repeat the public-wiki audit.
Raw research stays in the ignored `.tmp/rest-wiki/` cache. Without `--download`,
the command recompiles the cached audit. Review regenerated timing, levels, source
replacements, and summaries before shipping: the wiki is community-maintained,
and a name/timing index is a reminder aid rather than a full rules engine.

`npm test` covers matching, level gates, edition selection, optional ownership,
custom rules, dawn recharges, cooldowns, preview purity, numerical recovery, and
backup compatibility. `npm run test:rests` checks the real browser flow,
cancellation, resource exclusions, completed values, feature editing, escaped
text, 320/390 px layouts, and offline use. Set `BROWSER_PATH` if needed.

## Sources

- [2024 wiki and category index](https://dnd2024.wikidot.com/).
- [Fighter](https://dnd2024.wikidot.com/fighter:main),
  [Druid](https://dnd2024.wikidot.com/druid:main),
  [Wizard](https://dnd2024.wikidot.com/wizard:main),
  [Hunter](https://dnd2024.wikidot.com/ranger:hunter), and
  [Eldritch Invocations](https://dnd2024.wikidot.com/warlock:eldritch-invocation).
- [Species](https://dnd2024.wikidot.com/species:all),
  [feats](https://dnd2024.wikidot.com/feat:all), and
  [magic items](https://dnd2024.wikidot.com/magic-item:all).
- [Earlier Artificer](https://dnd5e.wikidot.com/artificer),
  [Beast](https://dnd5e.wikidot.com/barbarian:beast), and
  [Rune Knight](https://dnd5e.wikidot.com/fighter:rune-knight).
- [Publisher's 2024 Basic Rules](https://www.dndbeyond.com/sources/dnd/br-2024)
  and [SRD 5.2.1](https://www.dndbeyond.com/srd), which establish the app's core
  rest behavior and edition policy.

Each compiled record also retains its individual research URL for in-app use.

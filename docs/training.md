# Skills, training and tools

The Skills panel has Skills, Proficiencies, Languages and Tools tabs. Saving throws and their proficiency controls sit beneath each ability, with a shield button to roll. Selections belong to each character and travel in version 2 backups. The last tab and proficient-skills filter are saved per character. Tabs support arrow keys, Home and End.

Weapon proficiency is stored per base weapon. Simple and Martial checkboxes select or clear a whole family; individual weapons can be changed afterward. Known weapon attacks, including renamed weapons with a base weapon selected, recalculate proficiency immediately. Attack editors offer Auto, proficient and untrained overrides; custom spells and natural attacks retain their explicit proficiency checkbox. Mastery remains a separate feature choice.

Armor selections cover Light, Medium, Heavy and Shields. Shield AC requires training. Wearing untrained armor still grants its base AC, but imposes disadvantage on Strength/Dexterity D20 Tests and prevents spellcasting. These penalties apply to ability checks, skills, saves, initiative, tool checks and guided attacks. Armor's Stealth disadvantage also applies. Elven Chain retains its specific training exception. Advantage and disadvantage cancel normally.

Languages include the standard and rare 2024 lists, Common Sign Language, and all four Primordial dialects. Other campaign languages can be added. Language knowledge carries no generic numerical bonus.

The Tools tab lists every catalog tool, instrument and gaming set, with independent proficiency and pack ownership. Use opens an ability check with the catalog's fixed ability, an optional skill approved by the DM, and a situational roll mode. Skill options show each skill's signed bonus; the tool check continues to use the tool's ability. Tool proficiency adds proficiency once; a relevant proficient skill also grants advantage. Relevant skill Expertise uses double proficiency rather than stacking bonuses. Exhaustion, Poisoned, and armor restrictions apply. Reusable tools retain their quantities. Crafting time, ingredients, costs and outcomes remain table decisions.

Older text entries remain readable as original notes. On first opening an unconverted character, recognized training is converted and its named tools are added to the pack if missing, as requested for the existing sheets. Existing matching items retain their quantities and notes. This happens once; later removing equipment does not recreate it. New proficiency choices never grant equipment: use Add to pack when appropriate. Level-up tool grants update proficiency without granting physical equipment.

Sources: [2024 equipment](https://www.dndbeyond.com/sources/dnd/br-2024/equipment), [proficiency](https://www.dndbeyond.com/sources/dnd/br-2024/playing-the-game), and [languages](https://www.dndbeyond.com/sources/dnd/br-2024/creating-a-character). Equipment summaries follow SRD 5.2.1, CC BY 4.0; see the main README for attribution.

Validation: `node --test tests/training.test.mjs`, `npm run test:training`, and the existing model, sheet and inventory checks.

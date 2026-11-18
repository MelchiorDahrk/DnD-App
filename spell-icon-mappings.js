// Deliberate artwork choices, independent of rendering and character saves.
// Add names to a row to share its imagery; add a row for a new visual effect.
export const spellIconName = value => String(value ?? '').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim();

// icon identifier | effect color | exact spell names (semicolon separated)
export const SPELL_ICON_ASSIGNMENTS = `
acid-blob|acid|Acid Splash
magic-shield|protection|Blade Ward;Shield
skeletal-hand|necrotic|Chill Touch
sparkles|radiant|Dancing Lights;Prestidigitation
vine-flower|nature|Druidcraft
plasma-bolt|force|Eldritch Blast
circle-sparks|arcane|Elementalism;Sorcerous Burst
fire-ray|fire|Fire Bolt;Scorching Ray
charm|psychic|Friends;Charm Person;Charm Monster
enlightenment|radiant|Guidance;Foresight
sun|radiant|Light;Daylight
magic-palm|arcane|Mage Hand
anvil-impact|arcane|Mending
chat-bubble|arcane|Message;Sending
brain|psychic|Mind Sliver;Befuddlement
drama-masks|illusion|Minor Illusion;Major Image;Programmed Illusion
poison-gas|poison|Poison Spray;Stinking Cloud;Cloudkill
small-fire|fire|Produce Flame;Continual Flame
ice-bolt|cold|Ray of Frost
surrounded-shield|protection|Resistance;Protection from Energy
candle-flame|radiant|Sacred Flame
wood-club|nature|Shillelagh
bolt-spell-cast|lightning|Shocking Grasp
life-support|healing|Spare the Dying
comet-spark|radiant|Starry Wisp
beams-aura|radiant|Thaumaturgy;Bless;Holy Aura
vine-whip|nature|Thorn Whip;Grasping Vine
sonic-boom|thunder|Thunderclap;Thunderwave;Destructive Wave
ringing-bell|necrotic|Toll the Dead
shining-sword|radiant|True Strike;Divine Favor;Divine Smite;Shining Smite
sharp-lips|psychic|Vicious Mockery
sunbeams|radiant|Word of Radiance;Sunbeam
alarm-clock|protection|Alarm
paw-heart|nature|Animal Friendship;Dominate Beast
ice-shield|cold|Armor of Agathys
tentacles-skull|necrotic|Arms of Hadar;Hunger of Hadar
cursed-star|necrotic|Bane;Bestow Curse;Hex
glowing-hands|fire|Burning Hands
rainbow-star|arcane|Chromatic Orb;Color Spray;Prismatic Spray
shouting|psychic|Command;Divine Word;Power Word Stun
crossed-swords|psychic|Compelled Duel
open-book|arcane|Comprehend Languages;Legend Lore
water-splash|water|Create or Destroy Water;Control Water
healing|healing|Cure Wounds;Mass Cure Wounds
eye-shield|protection|Detect Evil and Good
third-eye|arcane|Detect Magic;Divination
poison-bottle|poison|Detect Poison and Disease;Ray of Sickness;Contagion
domino-mask|illusion|Disguise Self;Seeming
psychic-waves|psychic|Dissonant Whispers;Synaptic Static
thorned-arrow|nature|Ensnaring Strike;Hail of Thorns
curling-vines|nature|Entangle
wingfoot|arcane|Expeditious Retreat;Longstrider
fairy|radiant|Faerie Fire;Conjure Fey;Summon Fey
half-heart|necrotic|False Life
feather|arcane|Feather Fall
cat|nature|Find Familiar
disc|force|Floating Disk
fluffy-cloud|water|Fog Cloud
elderberry|healing|Goodberry
grouped-drops|arcane|Grease
lightning-trio|radiant|Guiding Bolt
heart-beats|healing|Healing Word;Mass Healing Word
fire-silhouette|fire|Hellish Rebuke
heart-shield|protection|Heroism;Power Word Fortify
delighted|psychic|Hideous Laughter
crosshair-arrow|nature|Hunter's Mark
ice-spear|cold|Ice Knife
crystal-eye|arcane|Identify
scroll-unfurled|illusion|Illusory Script
evil-hand|necrotic|Inflict Wounds;Harm
frog|nature|Jump
robe|protection|Mage Armor
hypersonic-bolt|force|Magic Missile
holy-symbol|protection|Protection from Evil and Good;Dispel Evil and Good
chalice-drops|healing|Purify Food and Drink;Heroes' Feast
healing-shield|protection|Sanctuary;Warding Bond
fire-axe|fire|Searing Smite
cross-shield|protection|Shield of Faith;Guardian of Faith
double-face-mask|illusion|Silent Image;Mislead;Project Image
sleepy|psychic|Sleep;Catnap
wolf-howl|nature|Speak with Animals;Animal Messenger
thunder-blade|thunder|Thunderous Smite
lightning-arc|lightning|Witch Bolt;Chain Lightning
skull-bolt|necrotic|Wrathful Smite
chemical-arrow|acid|Acid Arrow
nested-hearts|healing|Aid
transform|arcane|Alter Self;Polymorph;True Polymorph;Shapechange;Animal Shapes
aura|healing|Arcane Vigor;Aura of Vitality;Aura of Life;Mass Heal
magic-swirl|arcane|Arcanist's Magic Aura;Wish
crystal-ball|arcane|Augury;Scrying
tree-branch|nature|Barkskin
beast-eye|nature|Beast Sense;Locate Animals or Plants
semi-closed-eye|necrotic|Blindness/Deafness
ghost|illusion|Blur;Etherealness;Gaseous Form
opposite-hearts|psychic|Calm Emotions;Antipathy/Sympathy
sword-array|force|Cloud of Daggers;Blade Barrier;Conjure Barrage
imbricated-arrows|nature|Cordon of Arrows;Conjure Volley;Swift Quiver
crowned-skull|psychic|Crown of Madness
eclipse|necrotic|Darkness
owl|arcane|Darkvision
brainstorm|psychic|Detect Thoughts;Telepathy;Telepathic Bond
dragon-breath|fire|Dragon's Breath
biceps|arcane|Enhance Ability;Skill Empowerment
growth|arcane|Enlarge/Reduce
love-song|psychic|Enthrall
horse-head|nature|Find Steed;Phantom Steed
wolf-trap|arcane|Find Traps
fire-ace|fire|Flame Blade
fire-bomb|fire|Flaming Sphere;Delayed Blast Fireball
tombstone|necrotic|Gentle Repose;Feign Death
wind-slap|thunder|Gust of Wind;Wind Wall
melting-metal|fire|Heat Metal
imprisoned|psychic|Hold Person;Hold Monster
invisible|illusion|Invisibility;Greater Invisibility;Sequester
key|arcane|Knock
hospital-cross|healing|Lesser Restoration;Greater Restoration
extraction-orb|arcane|Levitate;Reverse Gravity
compass|arcane|Locate Object;Locate Creature;Find the Path
lips|arcane|Magic Mouth;Tongues;Glibness
rune-sword|force|Magic Weapon;Elemental Weapon
brain-freeze|psychic|Mind Spike
duality-mask|illusion|Mirror Image
teleport|arcane|Misty Step;Blink;Teleport
moon|radiant|Moonbeam;Fount of Moonlight
footprint|nature|Pass without Trace
spectre|illusion|Phantasmal Force;Phantasmal Killer;Weird
prayer|healing|Prayer of Healing;Heal;Power Word Heal
checked-shield|protection|Protection from Poison
marrow-drain|necrotic|Ray of Enfeeblement;Blight
rope-coil|arcane|Rope Trick
all-seeing-eye|arcane|See Invisibility;True Seeing
shattered-glass|thunder|Shatter
sound-off|thunder|Silence
hanging-spider|nature|Spider Climb
thorny-vine|nature|Spike Growth;Wall of Thorns
energy-sword|radiant|Spiritual Weapon;Arcane Sword
awareness|psychic|Suggestion;Mass Suggestion;Geas
paw|nature|Summon Beast;Conjure Animals
spider-web|nature|Web
scales|radiant|Zone of Truth
skeleton-inside|necrotic|Animate Dead;Create Undead
shining-heart|healing|Beacon of Hope
cross-flare|radiant|Blinding Smite
lightning-storm|lightning|Call Lightning;Storm of Vengeance
eyeball|arcane|Clairvoyance;Arcane Eye
lightning-dissipation|protection|Counterspell;Dispel Magic
fruiting|nature|Create Food and Water
wing-cloak|radiant|Crusader's Mantle
terror|psychic|Fear
fireball|fire|Fireball
arrow-flights|fire|Flame Arrows
angel-wings|arcane|Fly
rune-stone|protection|Glyph of Warding;Symbol
sprint|arcane|Haste
divided-spiral|psychic|Hypnotic Pattern
lightning-bow|lightning|Lightning Arrow
heavy-lightning|lightning|Lightning Bolt
pentagram-rose|protection|Magic Circle;Circle of Power;Planar Binding;Forbiddance
stone-block|nature|Meld into Stone;Stone Shape;Transmute Rock
invisible-face|protection|Nondetection;Mind Blank
tree-growth|nature|Plant Growth
broken-skull|healing|Remove Curse
heart-wings|healing|Revivify;Raise Dead;Resurrection;True Resurrection
snowing|cold|Sleet Storm;Ice Storm
snail|arcane|Slow
ghost-ally|necrotic|Speak with Dead;Summon Undead
vine-leaf|nature|Speak with Plants
winged-shield|radiant|Spirit Guardians
lightning-dome|protection|Tiny Hut;Private Sanctum;Globe of Invulnerability
robot-golem|arcane|Tiny Servant;Animate Objects;Summon Construct
life-tap|necrotic|Vampiric Touch
fish-scales|water|Water Breathing
water-bolt|water|Water Walk
rear-aura|protection|Aura of Purity;Antilife Shell
magic-gate|arcane|Banishment;Plane Shift;Demiplane
black-hole-bolas|necrotic|Black Tentacles
puppet|psychic|Compulsion;Dominate Person;Dominate Monster
maze|psychic|Confusion;Maze
spark-spirit|arcane|Conjure Minor Elementals;Conjure Elemental;Summon Elemental
fairy-wings|nature|Conjure Woodland Beings
skull-shield|protection|Death Ward
doorway|arcane|Dimension Door;Passwall
unstable-orb|arcane|Elemental Bane
stone-crafting|arcane|Fabricate;Creation
wolf-head|protection|Faithful Hound
fire-shield|fire|Fire Shield
unlocking|protection|Freedom of Movement
dragonfly|nature|Giant Insect;Insect Plague
forest|illusion|Hallucinatory Terrain;Mirage Arcane
brain-tentacle|psychic|Summon Aberration
orbital|force|Resilient Sphere
locked-chest|arcane|Secret Chest;Instant Summons
sword-wound|psychic|Staggering Smite
stone-sphere|protection|Stoneskin
chemical-drop|acid|Vitriolic Sphere
fire-wave|fire|Wall of Fire;Incendiary Cloud
hand-of-god|force|Arcane Hand;Telekinesis
evil-tree|nature|Awaken
sword-break|force|Banishing Smite
ice-bomb|cold|Cone of Cold;Freezing Sphere
templar-eye|radiant|Commune;Contact Other Plane
circle-forest|nature|Commune with Nature
dream-catcher|psychic|Dream
fire-zone|radiant|Flame Strike
sun-radiations|radiant|Hallow;Jallarzi's Storm of Radiance;Sunburst
book-aura|arcane|Modify Memory
ankh|healing|Reincarnate;Regenerate
steelwing-emblem|force|Steel Wind Strike
angel-outfit|radiant|Summon Celestial;Conjure Celestial;Planar Ally
dragon-head|arcane|Summon Dragon
portal|arcane|Teleportation Circle;Arcane Gate;Gate
tree-door|nature|Tree Stride;Transport via Plants
energy-shield|force|Wall of Force
stone-wall|nature|Wall of Stone
crowned-heart|psychic|Yolande's Regal Presence
skull-ring|necrotic|Circle of Death
shield-reflect|protection|Contingency
laser-blast|force|Disintegrate
dead-eye|necrotic|Eyebite
stone-bust|nature|Flesh to Stone
bell-shield|protection|Guards and Wards
music-spell|psychic|Irresistible Dance
skull-in-jar|necrotic|Magic Jar
stone-pile|nature|Move Earth;Earthquake
imp|fire|Summon Fiend
cauldron|arcane|Tasha's Bubbling Cauldron
icebergs|cold|Wall of Ice
windy-stripes|arcane|Wind Walk
magic-portal|arcane|Word of Recall
death-note|necrotic|Finger of Death;Power Word Kill
wildfires|fire|Fire Storm
cage|force|Forcecage;Imprisonment
castle|arcane|Magnificent Mansion
ice-cube|illusion|Simulacrum
mirror-mirror|necrotic|Clone
cloudy-fork|lightning|Control Weather
shield-opposition|protection|Antimagic Field
explosion-rays|fire|Meteor Swarm
clockwork|arcane|Time Stop
rainbow-star|protection|Prismatic Wall
waterfall|water|Tsunami
star-swirl|arcane|Astral Projection
floating-ghost|arcane|Unseen Servant
padlock|protection|Arcane Lock
`.trim().split('\n').map(row => {
  const [key,tone,names] = row.split('|');
  return {key,tone,names:names.split(';')};
});

export const EXACT_SPELL_ICONS = Object.fromEntries(SPELL_ICON_ASSIGNMENTS.flatMap(({key,tone,names}) => names.map(name => [spellIconName(name),{key,tone}])));

// Older names are common in imported characters. Keep normalization explicit.
for (const [alias,name] of Object.entries({
  'Tasha’s Hideous Laughter':'Hideous Laughter','Melf’s Acid Arrow':'Acid Arrow',
  'Tenser’s Floating Disk':'Floating Disk','Nystul’s Magic Aura':"Arcanist's Magic Aura",
  'Evard’s Black Tentacles':'Black Tentacles','Bigby’s Hand':'Arcane Hand',
  'Leomund’s Tiny Hut':'Tiny Hut','Mordenkainen’s Sword':'Arcane Sword',
  'Mordenkainen’s Magnificent Mansion':'Magnificent Mansion',"Otto's Irresistible Dance":'Irresistible Dance',
  "Otiluke's Resilient Sphere":'Resilient Sphere',"Otiluke's Freezing Sphere":'Freezing Sphere',
  "Drawmij's Instant Summons":'Instant Summons',"Rary's Telepathic Bond":'Telepathic Bond'
})) EXACT_SPELL_ICONS[spellIconName(alias)] = EXACT_SPELL_ICONS[spellIconName(name)];

export const SCHOOL_SPELL_ICONS = {
  abjuration:{key:'magic-shield',tone:'protection'},conjuration:{key:'pentagram-rose',tone:'arcane'},
  divination:{key:'third-eye',tone:'arcane'},enchantment:{key:'divided-spiral',tone:'psychic'},
  evocation:{key:'bright-explosion',tone:'force'},illusion:{key:'drama-masks',tone:'illusion'},
  necromancy:{key:'skull-crossed-bones',tone:'necrotic'},transmutation:{key:'transform',tone:'arcane'}
};
export const UNKNOWN_SPELL_ICON = {key:'magic-swirl',tone:'arcane'};
export const EFFECT_SPELL_ICONS = {
  fire:{key:'fireball',tone:'fire'},cold:{key:'snowflake-2',tone:'cold'},lightning:{key:'heavy-lightning',tone:'lightning'},
  thunder:{key:'sonic-boom',tone:'thunder'},acid:{key:'acid-blob',tone:'acid'},poison:{key:'poison-gas',tone:'poison'},
  necrotic:{key:'skull-bolt',tone:'necrotic'},radiant:{key:'sunbeams',tone:'radiant'},psychic:{key:'brainstorm',tone:'psychic'},
  force:{key:'plasma-bolt',tone:'force'},healing:{key:'healing',tone:'healing'},teleportation:{key:'teleport',tone:'arcane'},
  summoning:{key:'magic-portal',tone:'arcane'},illusion:{key:'drama-masks',tone:'illusion'},
  transformation:{key:'transform',tone:'arcane'},protection:{key:'magic-shield',tone:'protection'},nature:{key:'vine-leaf',tone:'nature'},
  resurrection:{key:'heart-wings',tone:'healing'},flight:{key:'angel-wings',tone:'arcane'},water:{key:'water-splash',tone:'water'}
};
export const SUMMON_SPELL_ICONS = {
  beast:'paw',fey:'fairy',undead:'ghost-ally',aberration:'brain-tentacle',construct:'robot-golem',
  elemental:'spark-spirit',celestial:'angel-outfit',dragon:'dragon-head',fiend:'imp'
};

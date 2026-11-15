// Listed weights come from the individual linked item pages. Everything else
// is a labeled, editable physical-object estimate, never a claimed rules value.
const normal = value => value.toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]/g,'');
const listed = new Map(Object.entries({
  'Bag of Holding':5,"Heward's Handy Haversack":5,'Alchemy Jug':12,
  'Decanter of Endless Water':2,'Chime of Opening':1,'Driftglobe':1,
  'Folding Boat':4,'Iron Bands of Bilarro':1,"Keoghtom's Ointment":.5,
  'Mirror of Life Trapping':50,'Apparatus of Kwalish':500,'Bag of Beans':.5,
  'Bead of Force':.0625,"Nolzur's Marvelous Pigments":1,
  "Heward's Hireling Armor":10,'Rod of the Vonindod':100,'Staff of Defense':3,
  "Gurt's Greataxe":325,'Abracadabrus':25,'Alchemy Jug (Blue)':12,
  'Alchemy Jug (Orange)':12,'Cauldron of Plenty':50,'Chest of Preserving':25,
  'Conch of Teleportation':20,"Constantori's Portrait":15,'Cracked Driftglobe':1,
  'Devastation Orb':10,'Grimoire Infinitus':3,"Iggwilv's Cauldron":80,
  'Infernal Puzzle Box':3,'Mimir':5,'Mirror of Reflected Pasts':25,
  'Mizzium Apparatus':8,'Orb of Gonging':5,'Orb of Skoraeus':8,
  'Ornithopter of Flying':25,'Soul Coin':.33,'Witchlight Vane':3,
  'Icon of Ravenloft':10,'The Infernal Machine Of Lum The Mad':5500,
  'Stone of Controlling Earth Elementals':5,'Pot of Awakening':10,'Professor Orb':5
}).map(([name,weight])=>[normal(name),weight]));

// Unusual objects need their own reviewed shape instead of an artwork-based
// fallback (many unrelated items share the same gem icon).
const estimates = new Map();
function group(weight,shape,names) {
  for(const name of names.split('|'))estimates.set(normal(name),{weight,weightStatus:`Estimated ${shape}; adjust to actual item`});
}
group(.02,'small token',"Bauble of True Blood|Harper Pin|Prismatic Rune|Ruby of the War Mage|Thief's Thimble|Badge of the Watch|Charm of Plant Command|Earring of Message|Earworm|Guardian Emblem|Guild Keyrune|Insignia of Claws|Keycharm|Masque Charm|Sun Pellet|Teeth of Dahlver-Nar|Warrior's Passkey");
group(.01,'small bead',"Bead of Nourishment|Bead of Refreshment");
group(5,'manual',"Manual of Bodily Health|Manual of Gainful Exercise|Manual of Golems|Manual of Quickness of Action");
group(.1,'small crystal or charm',"Alarm Pylon|Arcane Battery|Fragment of Frozen Bone|Harkon's Bite|Hearthstone|Lucky Foot|Spell Duelist's Trophy|Astral Shard|Blod Stone|Chromatic Rose|Claw of the Wyrm Rune|Cleansing Stone|Cursed Luckstone|Dimensional Loop|Dispelling Stone|Docent|Elemental Essence Shard|Fabulist Gem|Far Gear|Far Realm Shard|Feywild Shard|Jewel of Three Prayers|Mind Crystal|Opal of the Ild Rune|Outer Essence Shard|Pressure Capsule|Psi Crystal|Ruby Weave Gem|Ruinstone|Scaled Ornament|Sensory Stone|Shadowfell Shard|Shard of the Ise Rune|Shard of Xeluan|Shard Solitaire|Spell Gem|Spellshard|Spies' Murmur|Stone of Golorr|Stone of Ill Luck|Wheel of Stars|Elemental Gem|Gem of Brightness|Gem of Seeing|Medal of Muscle|Medal of the Conch|Medal of the Horizonback|Medal of the Maze|Medal of the Meat Pie|Medal of the Wetlands|Medal of Wit");
group(.01,'tiny orbiting stone',"Ioun Stone");
group(.5,'pair of sending stones',"Sending Stones");
group(.01,'paper or feather token',"Paper Bird|Strixhaven Pennant|Pennant of the Vind Rune");
group(.25,'small vial or pouch',"Dust of Disappearance|Dust of Dryness|Dust of Sneezing and Choking|Universal Solvent|Bloodwell Vial|Dust of Corrosion|Dust of Deliciousness|Kyrzin's Ooze|Moodmark Paint|Pixie Dust|Reincarnation Dust|Smokepowder");
group(.5,'small handheld object',"Fork of Eddy Summoning|Magen Handbell|Philosopher's Stone|Stone of Good Luck (Luckstone)|Wind Fan|Windskiff|Balance of Harmony|Chronolometer|Dodecahedron of Doom|Donjon's Sundering Sphere|Eagle Whistle|Emerald Pen|Gnomengarde Grenade|Hook of Fisher's Delight|Luba's Tarokka of Souls|Night Caller|Rotor of Return|Scissors of Shadow Snipping|Scribe's Pen|Speaking Stone|Timepiece of Travel|Witchlight Watch|Wreath of the Prism|Dream Weaver|Loadstone");
group(1,'handheld object',"Dragon-Touched Focus|Imbued Wood Focus|Stonespeaker Crystal|Bell Branch|Wand Sheath|Vox Seeker");
group(2,'handheld apparatus',"Arcane Chantelaine|Goblin Jumper Cables|Reliquary of Dawn|Reliquary of Twilight|Gavel of the Venn Rune|Pyxis of Pandemonium|Sekolahian Worshipping Statuette|Tablet of Reawakening|Talarith|Teleportation Tablet|Ventilating Lungs|Wheel of Wind and Water|Workshop Wrecker|Invincible's Reins|Bridle of Capturing");
group(3,'small mechanism',"Daern's Instant Fortress|Queen Ehlissa's Marvelous Nightingale|Luxon Beacon|Mizzium Mortar|Wildspace Orrery|Arcane Propulsion Arm|Telescopic Transporter");
group(5,'equipment or folded fabric',"Bellows of Strangulation|Prosthetic Limb|Spirit Board|Balloon Pack|Hammock of Worlds|Pyroconverger|Shrieking Greaves|Wingwear");
group(10,'equipment',"Experimental Goblin Jetpack|Harp of Gilded Plenty|Weird Tank|Orrery Of The Wanderer|Horseshoes of a Zephyr|Horseshoes of Speed|Brazier of Commanding Fire Elementals");
group(4,'clothing',"Butcher's Bib|Fish Suit|Glamerweave|Lord's Ensemble|Platinum Scarf|Shiftweave");
group(3,'cloak',"Cape of the Mountebank|Cape of Enlargement|Kagonesti Forest Shroud|Piwafwi|Piwafwi of Fire Resistance|Verminshroud");
group(1,'mask or visor',"Mask of Changed Appearance|Danoth's Visor|Dragon Mask|Jester's Mask|Mask of the Beast|Mask of the Dragon Queen|Peregrine Mask");
group(2,'gloves or claws',"Claws of the Umber Hulk|Delver's Claws");
group(1,'belt or crown',"Nimbus Coronet|Stormgirdle");
group(3,'spellbook',"Alchemical Compendium|Astromancy Archive|Atlas of Endless Horizons|Crystalline Chronicle|Duplicitous Manuscript|Fulminating Treatise|Heart Weaver's Primer|Libram of Souls and Flesh|Lorehold Primer|Planecaller's Codex|Prismari Primer|Protective Verses|Quandrix Primer|Silverquill Primer|Witherbloom Primer");
group(4,'wooden staff',"Crook of Rao|Korolnor Scepter");
group(3,'musical instrument',"Reveler's Concertina|Rhythm Maker's Drum");
group(1,'holy symbol',"Holy Symbol of Ravenkind");
group(2,'bottle',"Dragon Vessel");
group(1,'plush toy',"Cuddly Strixhaven Mascot");
group(2,'stone tablet',"Black Crystal Tablet");
group(10,'stone',"Amethyst Lodestone|Ingot of the Skold Rune");
group(3,'banner and pole',"Banner of the Krig Rune|Battle Standard of Infernal Power");
group(30,'saddle and tack',"Infernal Tack");
group(5,'folded fabric',"Bobbing Lily Pad");
group(.1,'magical bubble',"Breathing Bubble");
group(200,'cannon',"Arcane Cannon");
group(100,'large horn',"Draakhorn");
group(100,'stowed tower',"Mudslick Tower");
group(500,'chariot',"Flying Chariot");
group(1000,'mortar and pestle',"Baba Yaga's Mortar and Pestle");
group(4000,'piloted construct',"Mighty Servant of Leuk-o");
group(1000,'boat',"Tasha's Creeping Keepboat");
group(500,'throne',"Wyrmskull Throne");
group(10,'crystal',"Calimemnon Crystal");
group(20,'small cauldron',"Cauldron of Rebirth");
group(2,'censer',"Censer of Controlling Air Elementals|Spirit-Binding Censer");
group(.1,'replacement eye',"Ersatz Eye");
group(1,'hand and eye',"Eye and Hand of Vecna");
group(.1,'eye charm',"Hag Eye");
group(.1,'eye patch',"Eyes of Deceit|Knave's Eye Patch");
group(4,'robe',"Robe of Eyes");
group(1,'pole in collapsed form',"Pole of Angling|Pole of Collapsing");
group(3,'cane / longsword',"Veteran's Cane");
group(1,'small tool',"Manifold Tool|All-Purpose Tool");
group(10,'device',"Universal Pantograph");
group(.25,'perfume vial',"Perfume of Bewitching");
group(1,'fertilizer container',"Evergreen Fertilizer");
group(2,'lantern',"Lantern of Revealing|Daoud's Wondrous Lantern|Everbright Lantern|Ghost Lantern|Lantern of Tracking");
group(1,'lock',"Lock of Trickery");
group(4,'folded cloth',"Well of Many Worlds");
group(.01,'chalk stick',"Eternal Chalk");
group(2,'portable bowl',"Bowl of Commanding Water Elementals");
group(20,'smallest carpet variant; larger carpets vary',"Carpet of Flying");
group(2,'folded canopy',"Conjurer's Canopy");
group(25,'chair',"Flying Citadel Helm|Spelljamming Helm");

const iconEstimates = {
  magicring:[.02,'ring'],scroll:[.01,'scroll'],amulet:[.1,'amulet or necklace'],
  book:[3,'book'],feather:[.01,'feather'],broom:[3,'broom'],sack:[.5,'bag'],
  belt:[1,'belt'],boots:[2,'pair of boots'],wingedboots:[2,'pair of boots'],
  gloves:[1,'pair of gloves or bracers'],candle:[.1,'candle'],wizardhat:[.5,'hat'],
  dice:[.1,'small cube'],crown:[1,'circlet or crown'],cloak:[3,'cloak'],bat:[3,'cloak'],
  clothes:[4,'clothing'],crystalball:[3,'crystal ball'],cards:[.1,'deck of cards'],
  manacles:[6,'shackles'],closedhelm:[3,'helm'],horn:[2,'horn'],jug:[2,'bottle or flask'],
  goggles:[.1,'eyewear'],statuette:[1,'figurine'],compass:[.5,'compass'],
  lute:[2,'instrument'],saddle:[30,'saddle'],ornatekey:[.02,'key'],
  paintbrush:[1,'pigment container'],driftglobe:[3,'orb'],hourglass:[3,'orb'],
  pearl:[.01,'pearl'],panflute:[1,'pipe'],"coin-gold":[.02,'coin'],
  rope:[5,'50-foot rope'],scarabshield:[.1,'scarab brooch'],glue:[.5,'glue container'],
  chalice:[1,'tankard'],tattoo:[.01,'needle before application; tattoo adds no carried weight'],
  wings:[3,'cloak'],mirror:[.5,'hand mirror'],bell:[.1,'bell']
};

export function magicItemWeight(item,equipment) {
  const key=normal(item.name);
  if(key==='portablehole')return {weight:0,weightStatus:'Listed negligible weight'};
  if(key==='sphereofannihilation')return {weight:0,weightStatus:'Spatial void; not a carried physical object'};
  if(key==='ythrynmythallar')return {weight:0,weightStatus:'Not carried: 50-foot magical installation',carried:false};
  if(key==='quiverofehlonna')return {weight:2,weightStatus:'Listed maximum including contents'};
  if(key==='mechanicalwonder')return {weight:500,weightStatus:'Listed gyrocopter variant; adjust for other forms'};
  if(listed.has(key))return {weight:listed.get(key),weightStatus:'Listed item weight'+(key==='soulcoin'?' (1/3 lb., rounded)':'')};
  const estimate=estimates.get(key);
  if(estimate)return estimate;
  if(item.itemType==='Potion')return {weight:.5,weightStatus:'Standard potion vial'};
  if(/^(Staff|Wand|Rod)$/.test(item.itemType)) {
    return {weight:{Staff:4,Wand:1,Rod:2}[item.itemType],weightStatus:`Standard base ${item.itemType.toLowerCase()} weight; adjust if different`};
  }
  if(item.itemType==='Armor'||item.itemType==='Weapon')return baseWeight(item,equipment);
  const match=iconEstimates[item.iconKey];
  if(match)return {weight:match[0],weightStatus:`Estimated ${match[1]}; adjust to actual item`};
  throw Error(`Missing reviewed weight: ${item.name} (${item.iconKey})`);
}

function baseWeight(item,equipment) {
  const armor=item.itemType==='Armor',metadata=item.typeDetails;
  const baseType=metadata.match(/^(?:armor|weapon)\s*\(([^)]+)\)/i)?.[1]||(/^Shield,/i.test(metadata)?'Shield':'');
  const find=name=>equipment.find(base=>normal(base.name)===normal(name));
  const baseCandidates=equipment.filter(base=>base.category===(armor?'Armor':'Weapon'));
  const exact=baseCandidates.find(base=>normal(base.name)===normal(baseType)||normal(base.name.replace(/ Armor$/i,''))===normal(baseType));
  if(exact)return {weight:exact.weight,weightStatus:`Base ${exact.name} weight${exact.weightStatus?`; ${exact.weightStatus}`:''}`};
  if(/ammunition|\barrow\b|sling bullet/i.test(baseType)) {
    const bullet=/sling bullet/i.test(baseType),base=find(bullet?'Bullets, Sling':'Arrows');
    return {weight:base.weight/20,weightStatus:`Default ${bullet?'sling bullet':'arrow'} weight per piece; adjust for other ammunition`};
  }
  // Prefer a common compatible base, then the first named base in the metadata.
  let choice;
  if(armor) {
    if(/plate/i.test(baseType))choice='Plate Armor';
    else if(/chain mail/i.test(baseType))choice='Chain Mail';
    else if(/heavy/i.test(baseType)&&!/light|medium/i.test(baseType))choice='Plate Armor';
    else if(/medium/i.test(baseType)&&!/light/i.test(baseType))choice='Chain Shirt';
    else choice='Leather Armor';
  } else {
    const hint=baseType+' '+item.name;
    choice=/crossbow/i.test(hint)?'Light Crossbow':/bow|ammunition property/i.test(hint)?'Longbow':/firearm/i.test(hint)?'Musket':/dagger|kukri|finesse/i.test(hint)?'Dagger':/axe/i.test(hint)?'Battleaxe':/maul|warhammer|bludgeoning/i.test(hint)?'Warhammer':/lance/i.test(hint)?'Lance':/spear|javelin/i.test(hint)?'Spear':/thrown/i.test(hint)?'Handaxe':'Longsword';
    const named=baseCandidates.filter(base=>baseType.toLowerCase().includes(base.name.toLowerCase().replace(/ Armor$/i,'')));
    if(named.length&&!named.some(base=>base.name===choice))choice=named[0].name;
    if(normal(item.name)==='stormboomerang')return {weight:1,weightStatus:'Estimated boomerang; adjust to actual item'};
  }
  return {weight:find(choice).weight,weightStatus:`Default base ${choice}; adjust for chosen ${armor?'armor':'weapon'}`};
}

// Standard nonmagical treasure from the 2024 Dungeon Master's Guide.
// Names are shortened summaries; values are per stone, object/set, or stated unit.
// References: the licensed DMG compendium at https://roll20.net/compendium/dnd5e/
const reference = section => `https://roll20.net/compendium/dnd5e/Rules%3A${encodeURIComponent(section)}?expansion=33359`;
const treasure = (name,group,gp,weight,iconKey,details,extra={}) => ({
  id:name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),
  name,group,category:'Treasure',edition:'2024',source:"Dungeon Master's Guide",
  cost:typeof gp==='number'?`${gp.toLocaleString('en-US')} GP`:gp,weight,iconKey,details,
  wiki:reference(group==='Gemstones'?'Gemstones':group==='Art objects & jewelry'?'Art Objects':group==='Trade goods'?'Trade Goods':'Trade Bars'),...extra
});
const estimated = {weightStatus:'Estimated treasure weight; adjust to actual loot'};

// All six gemstone value tables: 12 / 12 / 10 / 6 / 8 / 4 stones.
const gemTiers = [
  [10,[
    ['Azurite','gem-blue'],['Banded Agate','gem-brown'],['Blue Quartz','gem-light-blue'],
    ['Eye Agate','gem-white'],['Hematite','gem-black'],['Lapis Lazuli','gem-blue'],
    ['Malachite','emerald'],['Moss Agate','gem-olive'],['Obsidian','gem-black'],
    ['Rhodochrosite','gem-pink'],['Tiger Eye','gem-brown'],['Turquoise','gem-light-blue']
  ]],
  [50,[
    ['Bloodstone','gem-black'],['Carnelian','gem-orange'],['Chalcedony','gem-white'],
    ['Chrysoprase','emerald'],['Citrine','gem-yellow'],['Jasper','gem-brown'],
    ['Moonstone','gem-white'],['Onyx','gem-black'],['Quartz','diamond'],
    ['Sardonyx','gem-red'],['Star Rose Quartz','gem-pink'],['Zircon','gem-light-blue']
  ]],
  [100,[
    ['Amber','gem-yellow'],['Amethyst','gem-purple'],['Chrysoberyl','gem-olive'],
    ['Coral','gem-red'],['Garnet','gem-red'],['Jade','emerald'],['Jet','gem-black'],
    ['Pearl','pearl'],['Spinel','gem-red'],['Tourmaline','emerald']
  ]],
  [500,[
    ['Alexandrite','emerald'],['Aquamarine','gem-light-blue'],['Black Pearl','black-pearl'],
    ['Blue Spinel','gem-blue'],['Peridot','gem-olive'],['Topaz','gem-yellow']
  ]],
  [1000,[
    ['Black Opal','gem-olive'],['Blue Sapphire','gem-blue'],['Emerald','emerald'],
    ['Fire Opal','gem-orange'],['Opal','gem-white'],['Star Ruby','gem-red'],
    ['Star Sapphire','gem-blue'],['Yellow Sapphire','gem-yellow']
  ]],
  [5000,[['Black Sapphire','gem-black'],['Diamond','diamond'],['Jacinth','gem-orange'],['Ruby','gem-red']]]
];
export const GEMSTONES = gemTiers.flatMap(([gp,rows])=>rows.map(([name,iconKey])=>
  treasure(name,'Gemstones',gp,.02,iconKey,'Nonmagical gem or precious stone. Quantity counts individual stones. Value varies with size and quality; use the value assigned to your actual loot or spell component.',estimated)));

// One preset for every row of the five art tables, including sets as one unit.
const artTiers = [
  [25,[
    ['Silver Ewer',3,'jug'],['Bone Statuette',1,'statuette'],['Gold Bracelet',.1,'treasure-bracelet'],
    ['Goldcloth Vestments',4,'clothes'],['Silver-Stitched Velvet Mask',.1,'treasure-mask'],
    ['Silver-Filigree Copper Chalice',1,'chalice'],['Engraved Bone Dice',.1,'dice'],
    ['Wood-Framed Hand Mirror',.5,'mirror'],['Silk Handkerchief',.02,'treasure-fabric'],['Portrait Gold Locket',.1,'amulet']
  ]],
  [250,[
    ['Bloodstone Gold Ring',.02,'magicring'],['Ivory Statuette',1,'statuette'],
    ['Jeweled Gold Bracelet',.1,'treasure-bracelet'],['Gem Pendant Silver Necklace',.1,'amulet'],
    ['Bronze Crown',1,'crown'],['Gold-Embroidered Silk Vestments',4,'clothes'],
    ['Fine Tapestry (10-foot square)',20,'magiccarpet'],['Jade-Inlaid Brass Mug',1,'stein'],
    ['Turquoise Figurine Collection',2,'statuette'],['Electrum-Filigree Gold Birdcage',5,'treasure-cage']
  ]],
  [750,[
    ['Moonstone Silver Chalice',1,'chalice'],['Lost Composer Sheet Music',.1,'paper'],
    ['Ivory-and-Zircon Wooden Harp',10,'lute'],['Gold Idol',2,'statuette'],
    ['Garnet-Eyed Dragon Comb',.1,'treasure-comb'],['Amethyst Gold Bottle Stopper',.1,'gem-purple'],
    ['Electrum Dragonborn Skull',5,'treasure-skull'],['Gold-and-Silver Brooch',.1,'amulet'],
    ['Gilded Obsidian Statuette',2,'statuette'],['Painted Gold War Mask',1,'treasure-mask']
  ]],
  [2500,[
    ['Fire Opal Gold Chain',.1,'amulet'],['Masterpiece Painting',5,'treasure-painting'],
    ['Moonstone Silk-Velvet Mantle',3,'cloak'],['Emerald Platinum Bracelet',.1,'treasure-bracelet'],
    ['Gem-Embroidered Glove',.1,'gloves'],['Jeweled Anklet',.1,'treasure-bracelet'],
    ['Gold Music Box',2,'smallchest'],['Aquamarine Gold Circlet',.5,'tiara'],
    ['Sapphire-Moonstone Eye Patch',.05,'treasure-mask'],['Pink Pearl Necklace',.1,'amulet']
  ]],
  [7500,[
    ['Jeweled Gold Crown',1,'crown'],['Jeweled Platinum Ring',.02,'magicring'],
    ['Ruby Gold Statuette',2,'statuette'],['Emerald Gold Cup',1,'chalice'],
    ['Platinum-Filigree Gold Jewelry Box',2,'smallchest'],['Gold Nesting Dolls',3,'statuette'],
    ['Gold-Piece Jade Game Board',5,'chess'],['Jeweled Ivory Drinking Horn',2,'horn'],
    ['Gilded Royal Coach or Barge',600,'cart'],['Black-Pearl Ceremonial Gold Armor',65,'platearmor']
  ]]
];
export const ART_OBJECTS = artTiers.flatMap(([gp,rows])=>rows.map(([name,weight,iconKey])=>
  treasure(name,'Art objects & jewelry',gp,weight,iconKey,'Nonmagical art or jewelry treasure. Quantity counts complete objects or sets. Adjust its name, value, and weight to match the piece found.',estimated)));

const goods = [
  ['Wheat (1 lb.)',1,'1 CP','sack'],['Flour (2 lb.)',2,'2 CP','sack'],
  ['Chicken',0,'2 CP','treasure-chicken'],['Salt (1 lb.)',1,'5 CP','sack'],
  ['Iron (1 lb.)',1,'1 SP','silver-bar'],['Canvas (1 sq. yd.)',1,'1 SP','treasure-fabric'],
  ['Copper (1 lb.)',1,'5 SP','copper-bar'],['Cotton Cloth (1 sq. yd.)',.5,'5 SP','treasure-fabric'],
  ['Ginger (1 lb.)',1,'1 GP','sack'],['Goat',0,'1 GP','treasure-goat'],
  ['Cinnamon (1 lb.)',1,'2 GP','sack'],['Pepper (1 lb.)',1,'2 GP','sack'],
  ['Sheep',0,'2 GP','treasure-sheep'],['Cloves (1 lb.)',1,'3 GP','sack'],
  ['Pig',0,'3 GP','treasure-pig'],['Silver (1 lb.)',1,'5 GP','silver-bar'],
  ['Linen (1 sq. yd.)',.5,'5 GP','treasure-fabric'],['Silk (1 lb.)',1,'10 GP','treasure-fabric'],
  ['Cow',0,'10 GP','treasure-cow'],['Saffron (1 lb.)',1,'15 GP','sack'],
  ['Ox',0,'15 GP','treasure-cow'],['Gold (1 lb.)',1,'50 GP','gold-bar'],
  ['Platinum (1 lb.)',1,'500 GP','silver-bar']
];
export const TRADE_GOODS = goods.map(([name,weight,cost,iconKey])=>
  treasure(name,'Trade goods',cost,weight,iconKey,weight===0?'Livestock trade good. Quantity counts individual animals. Animals are not counted toward carried weight.':'Nonmagical trade good. Quantity counts the unit in the name. Value and weight are per unit.',
    weight===0?{carried:false}:name.includes('sq. yd.')?{weightStatus:'Estimated fabric weight per square yard; adjust to actual cloth'}:{}));
export const TRADE_BARS = [[2,'Silver',10,'silver-bar'],[5,'Silver',25,'silver-bar'],[5,'Gold',250,'gold-bar']].map(([weight,metal,gp,iconKey])=>
  treasure(`${metal} Trade Bar (${weight} lb.)`,'Trade bars',gp,weight,iconKey,'Nonmagical precious-metal ingot. Quantity counts individual bars; value and weight are per bar.'));

export const TREASURES = [...GEMSTONES,...ART_OBJECTS,...TRADE_GOODS,...TRADE_BARS];

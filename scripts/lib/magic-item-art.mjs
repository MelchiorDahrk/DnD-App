// Reviewed name rules are shared by the two edition importers. Specific shapes
// precede broad object types; boundaries prevent e.g. Enduring matching "ring".
const overrides={
  'cloak of the bat':'bat','sphere of annihilation':'annihilation','orb of time':'hourglass',
  'orb of direction':'compass','broom of flying':'broom','sweeping broom':'broom',
  'baba yagas dancing broom':'broom','scarab of protection':'scarabshield',
  'shadowmourne':'greataxe','shadows edge':'greataxe','lights vengeance':'hammer',
  'flame tongue':'flamingblade','frost brand':'frostblade','sun blade':'sunblade',
  'sunsword':'sunblade','holy avenger':'sunblade','staff of the python':'snake',
  'staff of the adder':'snake','spider staff':'spiderstaff','carpet of flying':'magiccarpet',
  'wings of flying':'wings','winged boots':'wingedboots','pearl of power':'pearl',
  'nightfall pearl':'pearl','travelers pearl':'pearl','iron bands of bilarro':'manacles',
  'eyes of the eagle':'goggles','eyes of minute seeing':'goggles','eyes of charming':'goggles',
  'sovereign glue':'glue','figurine of wondrous power':'statuette','orcus figurine':'statuette',
  'mighty servant of leuko':'statuette','watchful helm':'closedhelm'
};
const normal=s=>s.toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const patterns=[
  [/\bgoggles\b/i,'goggles'],[/\bbelt\b/i,'belt'],[/\bbroom\b/i,'broom'],[/\bcrystal ball\b/i,'crystalball'],
  [/\bcauldron\b/i,'cauldron'],[/\bbowl\b/i,'magicbowl'],[/\btattoo\b/i,'tattoo'],
  [/\bamulet\b|\bmedallion\b|\bnecklace\b|\bperiapt\b|\btalisman\b|\bpendant\b|\bbrooch\b/i,'amulet'],
  [/^oil of\b/i,'oil'],[/\bshield\b/i,'shield'],[/\barmor\b|\bchain\b|\bleather\b/i,'platearmor'],
  [/\bcloak\b|\bmantle\b/i,'cloak'],[/\bboots?\b|\bslippers?\b/i,'boots'],[/\bgloves?\b|\bgauntlets?\b|\bbracers?\b|\bwraps\b/i,'gloves'],
  [/\bring\b|\bbands?\b|\bsignet\b|\bbracelet\b|\bbangle\b/i,'magicring'],
  [/\bpotion\b|\belixir\b|\bperfume\b|\bointment\b|\bfertilizer\b/i,'potion'],[/\bscroll\b|\bmissive\b|\bplaybill\b/i,'scroll'],[/\bwand\b/i,'wand'],
  [/\bstaff\b|\bquarterstaff\b|\bdissuader\b/i,'crystalstaff'],[/\brod\b|\bscepter\b/i,'rod'],
  [/\bbook\b|\bspellbook\b|\btome\b|\blexicon\b|\bdemonomicon\b|\bbestiary\b|\bgrimoire\b/i,'book'],
  [/\bhat\b|\bcap\b/i,'wizardhat'],[/\bhelm\b/i,'closedhelm'],[/\bcrown\b|\bcirclet\b|\bheadband\b|\btiara\b/i,'crown'],
  [/\bscimitar\b/i,'scimitar'],[/\bdagger\b|\bkukri\b|\bknife\b/i,'dagger'],
  [/\bsword\b|\bblade\b|\brazor\b|\btongue\b|\bslayer\b|ashbringer|shadowfang|shalamayne|frostmourne/i,'elvensword'],
  [/\baxe\b|\bgreataxe\b|\breaper\b|\bwrecker\b/i,'dwarvenaxe'],[/\bhammer\b|\bwhelm\b|\bsulfuras\b/i,'hammer'],[/\bmace\b/i,'mace'],
  [/\bbow\b|\blongbow\b|\bshortbow\b/i,'longbow'],[/\btrident\b|^wave$/i,'trident'],[/\bjavelin\b|\bspear\b/i,'spear'],
  [/\bammunition\b|\barrows?\b|\bshot\b/i,'quiver'],[/\bbag\b|\bsatchel\b|\bhaversack\b|\bpouch\b/i,'sack'],[/\bquiver\b/i,'quiver'],[/\brope\b/i,'rope'],
  [/\bfeather\b|\bquill\b/i,'feather'],[/\bgem\b|\bcrystal\b|\bstone\b|\bruby\b|\bbauble\b|\bpin\b/i,'emerald'],[/\bpearl\b/i,'pearl'],[/\borb\b|\bglobe\b|\bball\b/i,'driftglobe'],
  [/\blantern\b/i,'lantern'],[/\bcandle\b/i,'candle'],[/\bhorn\b|\bchime\b/i,'horn'],[/\blute\b|\binstrument\b|\blyre\b/i,'lute'],[/\bpipes?\b|\bflute\b/i,'panflute'],
  [/\bpole\b|\bcane\b/i,'rod'],[/\bjug\b|\bflask\b|\bbottle\b|\bjar\b/i,'jug'],[/\bpot\b|\bcenser\b|\bbrazier\b/i,'cauldron'],[/\bdecanter\b/i,'bottle'],
  [/\btankard\b|\bchalice\b/i,'chalice'],[/\bdeck\b|\bcards?\b/i,'cards'],[/\bdie\b|\bdice\b|\bcube\b|\bcubic\b/i,'dice'],[/\bkey\b/i,'ornatekey'],
  [/\block\b/i,'lock'],[/\bmanacle\b|\bshackles\b/i,'manacles'],[/\beyes?\b|\bspectacles\b/i,'magnifier'],[/\bsaddle\b|\breins\b|\bbridle\b/i,'saddle'],
  [/\bboat\b|\bskiff\b|\bapparatus\b/i,'boat'],[/\bcoin\b/i,'coin-gold'],[/\bbell\b/i,'bell'],[/\bchalk\b/i,'chalk'],[/\bpigments?\b/i,'paintbrush'],
  [/\bcompass\b|\bsundial\b/i,'compass'],[/\bmirror\b/i,'mirror'],[/\bclothes\b|\brobe\b/i,'clothes'],[/\btent\b|\bcanopy\b/i,'tent'],
  [/\bdoll\b|\bpuppet\b|\bfigurines?\b|\bidol\b/i,'statuette'],[/\btool\b|\bpantograph\b/i,'tools']
];
const types={Armor:'platearmor',Weapon:'ornateblade',Potion:'potion',Ring:'magicring',Rod:'rod',Scroll:'scroll',Staff:'crystalstaff',Wand:'wand','Wondrous Item':'emerald'};
export const magicItemIcon=(name,type)=>overrides[normal(name)]||patterns.find(([pattern])=>pattern.test(name))?.[1]||types[type]||'emerald';

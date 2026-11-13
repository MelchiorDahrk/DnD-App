// Match LDraw descriptions and !KEYWORDS, never geometry, history or shop IDs.
// Multiple memberships are intentional: shared moulds serve several themes.
export const PORTRAIT_THEMES = [
  ['Castle', /\b(Castle|Knights?|Kingdoms|Black Falcons?|Forest ?m[ae]n|Wolfpack|Crusaders?|Medieval|Jester|Dragon Masters|Royal Knights)\b/i],
  ['Pirates', /\b(Pirates?|Redbeard|Islanders?|Imperial Soldier|Imperial Guard|Buccaneer|Corsair|Flintlock|Cutlass|Tricorn)\b/i],
  ['Western', /\b(Western|Cowboy|Cowgirl|Sheriff|Bandit|Cavalry)\b/i],
  ['Adventurers', /\b(Adventurers?|Johnny Thunder|Orient Expedition|Desert Expedition|Jungle Expedition|Dino Island)\b/i],
  ['Lord of the Rings', /\b(LOTR|Lord of the Rings|Rohan|Gondor|Uruk|Mordor|Gandalf|Gollum|Aragorn|Legolas|Gimli|Frodo|Theoden)\b/i],
  ['Harry Potter', /\b(HP|Harry Potter|Hogwarts|Gryffindor|Slytherin|Hufflepuff|Ravenclaw|Dumbledore|Voldemort|Hagrid|Hermione|Weasley)\b/i],
  ['Vikings', /\bVikings?\b/i],
  ['Avatar: The Last Airbender', /\b(The Last Airbender|Aang|Katara|Sokka|Zuko|Air Nomads|Fire Nation|Water Tribe)\b/i],
  ['Indiana Jones', /\b(Indiana Jones|Indy|Henry Jones|Marion Ravenwood|Temple of Doom|Raiders of the Lost Ark)\b/i],
  ['Ninjago', /\b(Ninjago|Sensei|Serpentine|Spinjitzu)\b|\bNinja\b(?! Turtles?)/i],
  ['Prince of Persia', /\b(Prince of Persia|Persian|Dastan|Tamina)\b/i],
  ['Pirates of the Caribbean', /\b(Pirates of the Caribbean|POTC|Jack Sparrow|Barbossa|Davy Jones|Queen Anne's Revenge)\b/i],
  ['Atlantis', /\bAtlantis\b/i],
  ["Pharaoh's Quest", /\b(Pharaoh['’]?s Quest|Amset-Ra|Flying Mummy|Anubis|Horus)\b/i],
  ['The Hobbit', /\b(Hobbit|Bilbo|Thorin|Dwalin|Balin|Tauriel|Thranduil|Azog|Bolg|Mirkwood)\b/i],
  ['Legends of Chima', /\b(Chima|Laval|Cragger|Eris|Worriz|Razar)\b/i],
  ['Dreamzzz', /\bDreamz+\b/i],
  // "One piece" in a geometry description is not a franchise association.
  ['One Piece', /\b(Monkey D\.? Luffy|Roronoa Zoro|Straw Hat Pirates)\b/i]
];

export function sourcePartThemes(source) {
  const description = source.split(/\r?\n/, 1)[0].replace(/^0\s+/, '');
  const keywords = [...source.matchAll(/^0 !KEYWORDS (.*)$/gmi)].map(match => match[1]).join(', ')
    .replace(/\b(BrickLink|Rebrickable|Brickowl|Set) [\w-]+/gi, '');
  const text = `${description} ${keywords}`.replace(/\b(Jedi Knights?|Knights of Ren)\b/gi, '');
  return PORTRAIT_THEMES.filter(([theme, pattern]) => pattern.test(text) ||
    (theme === 'One Piece' && /\bOne Piece\b/i.test(keywords))).filter(([theme]) =>
    // "Pirate" can describe Han Solo without referring to the Pirates theme.
    theme !== 'Pirates' || !/\bStar Wars\b/i.test(text) || /\bPirates of the Caribbean\b/i.test(text)
  ).filter(([theme]) =>
    theme !== 'Ninjago' || !/\b(TMNT|Ninja Turtles?)\b/i.test(text) || /\bNinjago\b/i.test(text)
  ).map(([theme]) => theme);
}

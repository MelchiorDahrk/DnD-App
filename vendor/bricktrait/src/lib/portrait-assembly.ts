import { placements, type Figure, type Part } from './ldraw.ts';

const GHOST_SHROUDS = new Set(['2588', '10173']);

export function moveLegacyGhostShroud(figure: Figure): Figure {
	if (!figure.back.id || !GHOST_SHROUDS.has(figure.back.id)) return figure;
	return {
		...figure,
		headgear: { ...figure.back },
		back: { ...figure.back, id: null }
	};
}

export function portraitPlacements(figure: Figure, torso?: Part, head?: Part, legs?: Part) {
	const fig = moveLegacyGhostShroud(figure);
	// The battleaxe blade is authored on the opposite side of the grip.
	const orient = (hand: Figure['handR']) =>
		hand.id === '3848' ? { ...hand, spin: hand.spin + 180 } : hand;
	return placements({ ...fig, handR: orient(fig.handR), handL: orient(fig.handL) }, torso, head, legs);
}

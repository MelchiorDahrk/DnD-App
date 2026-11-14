// Renders part thumbnails for scripts/build-thumbs.mjs, with the app's own code.
import { library, STANDARD_LEGS, type Part, type Placement } from '../../src/lib/ldraw';
import { Stage, type View } from '../../src/lib/scene';
import { drawThumb } from '../../src/lib/thumb-render';
import { THUMB_COLORS } from '../../src/lib/thumbs';
import { PortraitStage } from '../../src/lib/portrait-scene';
import { drawEquipmentIcon } from '../../src/lib/equipment-render';
import './references';

declare global {
	interface Window {
		/** Every part that gets a thumbnail, with its colour */
		thumbsReady: Promise<{ id: string; color: number }[]>;
		/** WebP data URLs, in order */
		renderThumbs: (items: { id: string; color: number; parts?: Placement[]; view?: View }[]) => Promise<string[]>;
	}
}

library.base = '/ldraw/';
const stage = new Stage();
let equipmentStage: PortraitStage | null = null;

window.thumbsReady = library.init().then(() => {
	const standard: Part = { id: STANDARD_LEGS, name: 'Standard hips and legs', cat: 'legs' };
	return [...library.catalog, standard]
		.filter((p) => THUMB_COLORS[p.cat] !== undefined)
		.map((p) => ({ id: p.id, color: THUMB_COLORS[p.cat]! }));
});

window.renderThumbs = async (items) => {
	const out: string[] = [];
	for (const { id, color, parts, view } of items) {
		try {
			const canvas = parts
				? await drawEquipmentIcon(equipmentStage ??= new PortraitStage(), parts, view)
				: await drawThumb(stage, id, color, undefined, view);
			out.push(canvas.toDataURL('image/webp', 0.9));
		} catch {
			out.push('');
		}
	}
	return out;
};

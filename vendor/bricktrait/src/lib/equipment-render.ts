// Equipment uses the portrait's journal lighting and PBR materials at icon size.
import { library, type Placement } from './ldraw';
import { preparePortraitModel } from './materials.ts';
import type { PortraitStage } from './portrait-scene.ts';
import type { View } from './scene';

export const EQUIPMENT_SIZE = 160;

export async function drawEquipmentIcon(stage: PortraitStage, parts: Placement[], view: View = { yaw: 0, pitch: 0, zoom: 1 }) {
	const model = preparePortraitModel(await library.build(parts), library.catalog);
	stage.setModel(model);
	try {
		stage.setTheme('light');
		stage.fit(view);
		return stage.render(EQUIPMENT_SIZE);
	} finally {
		stage.setModel(null);
	}
}

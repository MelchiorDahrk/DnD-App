// Turns a portrait into pixels: owns the stage and the current figure model.
import type { Box3 } from 'three';
import { library, placements, type Figure } from './ldraw';
import type { View } from './scene';
import { PortraitStage } from './portrait-scene.ts';
import { compose, type Style } from './compose';
import { disposePortraitModel, preparePortraitModel } from './materials.ts';
import type { PortraitTheme } from './lighting.ts';

// Retro mode renders at about a third of the size and lets the upscale soften it
const RETRO_SCALE = 0.3;

export type ImageFormat = 'png' | 'webp' | 'jpeg';

export class PortraitRenderer {
	private stage: PortraitStage | null = null;
	private focus: Box3 | null = null;
	private body: Box3 | null = null;
	private key = '';
	private version = 0;
	private theme: PortraitTheme = 'light';

	setTheme(theme: PortraitTheme) {
		if (theme === this.theme) return;
		this.theme = theme;
		this.stage?.setTheme(theme);
	}

	/** Rebuilds the model if the figure changed. Resolves false if a newer call won. */
	async update(figure: Figure) {
		const key = JSON.stringify(figure);
		if (key === this.key) return true;
		const version = ++this.version;
		await library.init();
		const find = (id: string | null) => library.catalog.find((p) => p.id === id);
		const model = await library.build(
			placements(figure, find(figure.torso.id), find(figure.head.id), find(figure.legs.id))
		);
		if (version !== this.version) {
			disposePortraitModel(model);
			return false;
		}
		preparePortraitModel(model, library.catalog);
		this.stage ??= new PortraitStage();
		this.stage.setModel(model);
		this.stage.setTheme(this.theme);
		const names = [figure.head.id, figure.headgear.id].filter(Boolean).map((id) => `${id}.dat`);
		this.focus = this.stage.box(names);
		this.body = this.stage.box();
		this.key = key;
		return true;
	}

	draw(out: HTMLCanvasElement, size: number, view: View, style: Style) {
		if (!this.stage || !this.focus || !this.body) return;
		this.stage.frame(this.focus, this.body, view);
		const figure = this.stage.render(style.retro ? Math.round(size * RETRO_SCALE) : size);
		compose(out, figure, size, style);
	}

	/** The portrait as an image file. JPEG has no transparency: it gets a white background. */
	async image(size: number, view: View, style: Style, format: ImageFormat = 'png') {
		const canvas = document.createElement('canvas');
		this.draw(canvas, size, view, style);
		let out = canvas;
		if (format === 'jpeg') {
			out = document.createElement('canvas');
			out.width = out.height = size;
			const ctx = out.getContext('2d')!;
			ctx.fillStyle = '#fff';
			ctx.fillRect(0, 0, size, size);
			ctx.drawImage(canvas, 0, 0);
		}
		return new Promise<Blob | null>((r) => out.toBlob(r, `image/${format}`, 0.92));
	}

	dispose() {
		this.version++;
		this.stage?.dispose();
		this.stage = null;
		this.focus = this.body = null;
		this.key = '';
	}
}

export const renderer = new PortraitRenderer();

/** False on browsers or machines without WebGL, where nothing can be drawn. */
export function webglAvailable() {
	try {
		const c = document.createElement('canvas');
		return !!(c.getContext('webgl2') ?? c.getContext('webgl'));
	} catch {
		return false;
	}
}

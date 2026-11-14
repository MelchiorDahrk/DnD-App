import { Camera, Material, Mesh, MeshBasicMaterial, MeshStandardMaterial, NoBlending, Object3D, Scene, WebGLRenderer } from 'three';
import { applyPortraitEmissionMask, emissionColor } from './materials.ts';

/** Zero-alpha occluders keep hidden emitters from glowing through the figure. */
export function portraitGlowMaterial(source: Material) {
	const mask = new MeshBasicMaterial({
		color: 0,
		opacity: 0,
		transparent: true,
		premultipliedAlpha: true,
		blending: NoBlending,
		depthWrite: !source.transparent,
		side: source.side,
		toneMapped: false
	});
	if (source instanceof MeshStandardMaterial && source.emissive.getHex() !== 0) {
		mask.depthWrite = true;
		mask.map = source.emissiveMap;
		if (source.userData.portraitEmissionMask) applyPortraitEmissionMask(mask, true);
	} else if (source.transparent) mask.colorWrite = false;
	return mask;
}

/** Selective glow on transparent output; bright white plastic never blooms. */
export class PortraitGlow {
	private output = document.createElement('canvas');
	private meshes: Mesh[] = [];
	private masks = new Map<Material, MeshBasicMaterial>();
	private luminous = false;

	setModel(model: Object3D | null) {
		this.dispose();
		model?.traverse(object => {
			if (!(object instanceof Mesh)) return;
			this.meshes.push(object);
			if (emissionColor(object).getHex() !== 0) this.luminous = true;
		});
	}

	render(renderer: WebGLRenderer, scene: Scene, camera: Camera, size: number) {
		if (!this.luminous) return renderer.domElement;
		this.output.width = this.output.height = size;
		const ctx = this.output.getContext('2d')!;
		ctx.drawImage(renderer.domElement, 0, 0);
		const originals = this.meshes.map(mesh => mesh.material);
		const shadows = renderer.shadowMap.autoUpdate;
		try {
			const mask = (source: Material) => {
				let material = this.masks.get(source);
				if (!material) this.masks.set(source, material = portraitGlowMaterial(source));
				if (source instanceof MeshStandardMaterial && source.emissive.getHex() !== 0) {
					material.color.copy(source.emissive).multiplyScalar(Math.min(source.emissiveIntensity, 1));
					material.opacity = source.opacity;
				}
				return material;
			};
			for (const mesh of this.meshes) mesh.material = Array.isArray(mesh.material) ? mesh.material.map(mask) : mask(mesh.material);
			renderer.shadowMap.autoUpdate = false;
			renderer.render(scene, camera);
			// Put the halo behind the shaded figure, preserving its colour and alpha.
			ctx.globalCompositeOperation = 'destination-over';
			ctx.globalAlpha = 0.65;
			ctx.filter = `blur(${size * 0.012}px)`;
			ctx.drawImage(renderer.domElement, 0, 0);
			ctx.globalAlpha = 0.3;
			ctx.filter = `blur(${size * 0.03}px)`;
			ctx.drawImage(renderer.domElement, 0, 0);
		} finally {
			this.meshes.forEach((mesh, i) => mesh.material = originals[i]);
			renderer.shadowMap.autoUpdate = shadows;
			ctx.globalCompositeOperation = 'source-over';
			ctx.globalAlpha = 1;
			ctx.filter = 'none';
		}
		return this.output;
	}

	dispose() {
		for (const material of this.masks.values()) material.dispose();
		this.masks.clear();
		this.meshes = [];
		this.luminous = false;
	}
}

import { Box3, Color, Float32BufferAttribute, LineSegments, Material, Matrix4, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Object3D, Vector3 } from 'three';

// Match geometry IDs, never descriptions such as "flame print" on an ordinary torso.
const FLAMES = /^(?:37775|6126[ab]|85959(?:p\d+)?)(?:\.dat)?$/i;
const CRYSTALS = /^(?:11127|30385|30213|79985)(?:\.dat)?$/i;
const WAND_STAR = /^(?:6124b|28681|6124bs01)(?:\.dat)?$/i;
const WAND = /^36752a(?:\.dat)?$/i;

function partId(part: Object3D) {
	return String(part.userData.fileName || part.name).replace(/\\/g, '/').split('/').pop()!;
}

function surfaceKind(object: Object3D) {
	for (let part: Object3D | null = object; part; part = part.parent) {
		const id = partId(part);
		if (FLAMES.test(id)) return 'flame';
		if (CRYSTALS.test(id)) return 'crystal';
		if (WAND_STAR.test(id)) return 'star';
		if (WAND.test(id)) return 'wand';
		if (part.userData.portraitCloth) return 'cloth';
	}
	return 'plastic';
}

/** The same spatial emission mask is used by the surface and its glow pass. */
export function applyPortraitEmissionMask(material: Material, glow = false) {
	material.onBeforeCompile = shader => {
		shader.vertexShader = 'attribute float portraitEmissionMask;\nvarying float vPortraitEmissionMask;\n' + shader.vertexShader;
		shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvPortraitEmissionMask = portraitEmissionMask;');
		shader.fragmentShader = 'varying float vPortraitEmissionMask;\n' + shader.fragmentShader;
		const chunk = glow ? 'color_fragment' : 'emissivemap_fragment';
		const mask = glow ? 'diffuseColor.a *= vPortraitEmissionMask;' : 'totalEmissiveRadiance *= vPortraitEmissionMask;';
		shader.fragmentShader = shader.fragmentShader.replace(`#include <${chunk}>`, `#include <${chunk}>\n${mask}`);
	};
	material.customProgramCacheKey = () => `portrait-emission-mask-${glow}`;
}

function maskWandTip(mesh: Mesh, star: boolean) {
	let wand: Object3D = mesh;
	while (wand.parent && !(star ? WAND_STAR : WAND).test(partId(wand))) wand = wand.parent;
	const relative = new Matrix4().copy(wand.matrixWorld).invert().multiply(mesh.matrixWorld);
	const positions = mesh.geometry.getAttribute('position'), point = new Vector3();
	const mask = [];
	for (let i = 0; i < positions.count; i++) {
		point.fromBufferAttribute(positions, i).applyMatrix4(relative);
		// Both star wands share the head above y=-50; the wooden wand ends at -44.
		mask.push(Math.max(0, Math.min(1, (-point.y - (star ? 49 : 34)) / (star ? 4 : 8))));
	}
	mesh.geometry.setAttribute('portraitEmissionMask', new Float32BufferAttribute(mask, 1));
}

/** Isolated PBR materials: the LDraw loader's shared palette is never modified. */
export function preparePortraitModel(model: Object3D, catalog: readonly { id: string; name: string }[] = []) {
	const variants = new Map<Material, Map<string, Material>>();
	const cloth = new Set(catalog.filter(part => /\bcloth\b/i.test(part.name)).map(part => `${part.id}.dat`));
	model.updateMatrixWorld(true);
	model.traverse((object) => {
		if (cloth.has(object.userData.fileName || object.name)) object.userData.portraitCloth = true;
		if (object instanceof LineSegments) object.visible = false;
		if (!(object instanceof Mesh)) return;
		// LDraw already smooths across conditional edges and splits hard creases.
		// Keep those normals (and printed seams); repair missing data only.
		object.geometry = object.geometry.clone();
		if (!object.geometry.getAttribute('normal')) object.geometry.computeVertexNormals();
		object.geometry.normalizeNormals();
		object.castShadow = object.receiveShadow = true;
		const kind = surfaceKind(object);
		if (kind === 'wand' || kind === 'star') maskWandTip(object, kind === 'star');
		const convert = (source: Material) => {
			if (!(source instanceof MeshStandardMaterial)) return source;
			let cache = variants.get(source);
			if (!cache) variants.set(source, cache = new Map());
			if (cache.has(kind)) return cache.get(kind)!;
			const material = new MeshPhysicalMaterial();
			MeshStandardMaterial.prototype.copy.call(material, source);
			const rubber = /rubber/i.test(source.name);
			const cloth = kind === 'cloth';
			const metal = source.metalness > 0.15;
			material.roughness = cloth || rubber ? 0.86 : metal ? /matte/i.test(source.name) ? 0.58 : 0.28 : source.transparent ? 0.2 : 0.5;
			material.clearcoat = cloth || rubber || metal ? 0 : 0.12;
			material.clearcoatRoughness = 0.32;
			if (cloth) {
				material.sheen = 0.3;
				material.sheenColor.copy(source.color);
				material.sheenRoughness = 0.8;
			}
			const luminous = source.emissive.getHex() !== 0;
			// A crystal only glows when made of translucent plastic; steel swords stay steel.
			if (!luminous && (kind === 'flame' || kind === 'star' || kind === 'wand' || (kind === 'crystal' && source.transparent))) {
				material.emissive.copy(source.color);
				material.emissiveIntensity = kind === 'flame' ? 1.5 : kind === 'star' ? 1.2 : 0.45;
				if (kind === 'wand') {
					material.emissive.setHex(0x65cfff);
					material.emissiveIntensity = 1.6;
				}
			}
			material.userData = { ...source.userData, portraitMaterial: true, emission: material.emissiveIntensity, portraitEmissionMask: !luminous && (kind === 'wand' || kind === 'star') };
			if (material.userData.portraitEmissionMask) applyPortraitEmissionMask(material);
			cache.set(kind, material);
			return material;
		};
		object.material = Array.isArray(object.material) ? object.material.map(convert) : convert(object.material);
		if ([object.material].flat().every(m => m.transparent)) object.castShadow = false;
	});
	model.userData.portraitModel = true;
	return model;
}

/** Materials and geometry belong to this assembled model; palette textures do not. */
export function disposePortraitModel(model: Object3D) {
	if (!model.userData.portraitModel) return;
	const materials = new Set<Material>();
	model.traverse(object => {
		if (!(object instanceof Mesh)) return;
		object.geometry.dispose();
		for (const material of [object.material].flat()) if (material.userData.portraitMaterial) materials.add(material);
	});
	for (const material of materials) material.dispose();
}

/** The brightest emissive finish of a mesh, for a small local bounce light. */
export function emissionColor(mesh: Mesh) {
	const color = new Color(0, 0, 0);
	for (const material of [mesh.material].flat()) {
		if (material instanceof MeshStandardMaterial && material.emissive.getHex() !== 0) {
			const candidate = material.emissive.clone().multiplyScalar(material.emissiveIntensity);
			if (candidate.r + candidate.g + candidate.b > color.r + color.g + color.b) color.copy(candidate);
		}
	}
	return color;
}

/** Bounds of the emitting surface, so wand bounce light follows its tip. */
export function emissionBox(mesh: Mesh) {
	const mask = mesh.geometry.getAttribute('portraitEmissionMask');
	if (!mask) return new Box3().setFromObject(mesh);
	const box = new Box3(), point = new Vector3(), positions = mesh.geometry.getAttribute('position');
	for (let i = 0; i < mask.count; i++) if (mask.getX(i) > 0.5) {
		box.expandByPoint(point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld));
	}
	return box;
}

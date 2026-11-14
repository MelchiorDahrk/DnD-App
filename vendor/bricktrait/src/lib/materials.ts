import { Color, LineSegments, Material, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Object3D } from 'three';

// Match geometry IDs, never descriptions such as "flame print" on an ordinary torso.
const FLAMES = /^(?:37775|6126[ab]|85959(?:p\d+)?)(?:\.dat)?$/i;
const CRYSTALS = /^(?:11127|30385|30213|79985)(?:\.dat)?$/i;

function surfaceKind(object: Object3D) {
	for (let part: Object3D | null = object; part; part = part.parent) {
		const id = String(part.userData.fileName || part.name).replace(/\\/g, '/').split('/').pop()!;
		if (FLAMES.test(id)) return 'flame';
		if (CRYSTALS.test(id)) return 'crystal';
		if (part.userData.portraitCloth) return 'cloth';
	}
	return 'plastic';
}

/** Isolated PBR materials: the LDraw loader's shared palette is never modified. */
export function preparePortraitModel(model: Object3D, catalog: readonly { id: string; name: string }[] = []) {
	const variants = new Map<Material, Map<string, Material>>();
	const cloth = new Set(catalog.filter(part => /\bcloth\b/i.test(part.name)).map(part => `${part.id}.dat`));
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
			material.roughness = cloth || rubber ? 0.86 : metal ? /matte/i.test(source.name) ? 0.58 : 0.28 : source.transparent ? 0.2 : 0.42;
			material.clearcoat = cloth || rubber || metal ? 0 : 0.2;
			material.clearcoatRoughness = 0.32;
			if (cloth) {
				material.sheen = 0.3;
				material.sheenColor.copy(source.color);
				material.sheenRoughness = 0.8;
			}
			const luminous = source.emissive.getHex() !== 0;
			// A crystal only glows when made of translucent plastic; steel swords stay steel.
			if (!luminous && (kind === 'flame' || (kind === 'crystal' && source.transparent))) {
				material.emissive.copy(source.color);
				material.emissiveIntensity = kind === 'flame' ? 1.5 : 0.45;
			}
			material.userData = { ...source.userData, portraitMaterial: true, emission: material.emissiveIntensity };
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

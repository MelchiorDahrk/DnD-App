import {
	AgXToneMapping,
	Box3,
	DirectionalLight,
	Group,
	Mesh,
	MeshStandardMaterial,
	HemisphereLight,
	MathUtils,
	Object3D,
	PerspectiveCamera,
	PCFShadowMap,
	PointLight,
	PMREMGenerator,
	Scene,
	SRGBColorSpace,
	Vector3,
	WebGLRenderer
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { LIGHTING, type LightingTheme } from './lighting.ts';
import { MIN_ZOOM, type View } from './scene.ts';
import { disposePortraitModel, emissionColor } from './materials.ts';

const FOV = 20;

/** Offscreen renderer with a transparent background. */
export class PortraitStage {
	readonly renderer: WebGLRenderer;
	private scene = new Scene();
	private camera = new PerspectiveCamera(FOV, 1, 1, 5000);
	private pivot = new Group();
	private model: Object3D | null = null;
	private keyLight = new DirectionalLight();
	private fillLight = new DirectionalLight();
	private rimLight = new DirectionalLight();
	private ambient = new HemisphereLight();
	private bounce = new Group();
	private theme: LightingTheme = 'light';
	private environment;

	constructor() {
		this.renderer = new WebGLRenderer({
			antialias: true,
			alpha: true,
			preserveDrawingBuffer: true
		});
		this.renderer.setClearColor(0x000000, 0);
		this.renderer.outputColorSpace = SRGBColorSpace;
		this.renderer.toneMapping = AgXToneMapping;
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = PCFShadowMap;

		const pmrem = new PMREMGenerator(this.renderer);
		const room = new RoomEnvironment();
		this.environment = pmrem.fromScene(room, 0.06);
		this.scene.environment = this.environment.texture;
		room.dispose();
		pmrem.dispose();

		const key = this.keyLight;
		key.position.set(-130, 180, 180);
		key.castShadow = true;
		key.shadow.mapSize.set(1024, 1024);
		key.shadow.intensity = 0.55;
		key.shadow.bias = -0.00015;
		key.shadow.normalBias = 0.16;
		Object.assign(key.shadow.camera, {
			left: -60,
			right: 60,
			top: 60,
			bottom: -60,
			near: 1,
			far: 800
		});
		this.fillLight.position.set(150, 55, 140);
		this.rimLight.position.set(80, 130, -160);
		this.pivot.add(this.bounce);
		this.scene.add(key, key.target, this.fillLight, this.rimLight, this.ambient, this.pivot);
		this.setTheme('light');
	}

	setTheme(theme: LightingTheme) {
		this.theme = theme;
		const rig = LIGHTING[theme];
		this.keyLight.color.setHex(rig.key); this.keyLight.intensity = rig.keyPower;
		this.fillLight.color.setHex(rig.fill); this.fillLight.intensity = rig.fillPower;
		this.rimLight.color.setHex(rig.rim); this.rimLight.intensity = rig.rimPower;
		this.ambient.color.setHex(rig.sky); this.ambient.groundColor.setHex(rig.ground); this.ambient.intensity = rig.ambient;
		this.scene.environmentIntensity = rig.environment;
		this.renderer.toneMappingExposure = rig.exposure;
		const materials = new Set<MeshStandardMaterial>();
		this.model?.traverse(object => {
			if (object instanceof Mesh) for (const material of [object.material].flat()) {
				if (material instanceof MeshStandardMaterial && material.userData.portraitMaterial) materials.add(material);
			}
		});
		for (const material of materials) material.emissiveIntensity = material.userData.emission * rig.emission;
		for (const light of this.bounce.children) if (light instanceof PointLight) light.intensity = 28 * rig.emission;
	}

	setModel(model: Object3D | null) {
		if (this.model === model) return;
		if (this.model) {
			this.pivot.remove(this.model);
			disposePortraitModel(this.model);
		}
		this.bounce.clear();
		this.model = model;
		if (model) {
			this.pivot.add(model);
			// Measure in the unturned model frame; lights rotate with the accessory.
			this.pivot.rotation.y = 0;
			this.pivot.updateMatrixWorld(true);
			model.traverse(object => {
				if (!(object instanceof Mesh) || this.bounce.children.length >= 3) return;
				const color = emissionColor(object);
				if (color.r + color.g + color.b < 0.1) return;
				const center = new Box3().setFromObject(object).getCenter(new Vector3());
				// Several meshes can make one luminous part. Use one bounce per cluster.
				if (this.bounce.children.some(light => light.position.distanceTo(center) < 12)) return;
				color.multiplyScalar(1 / Math.max(color.r, color.g, color.b));
				const light = new PointLight(color, 28, 65, 1);
				light.position.copy(center);
				this.bounce.add(light);
			});
		}
		this.setTheme(this.theme);
	}

	dispose() {
		this.setModel(null);
		this.environment.dispose();
		this.keyLight.shadow.dispose();
		this.renderer.dispose();
	}

	/**
	 * Portrait framing: the camera aims at `focus` (usually head + headgear),
	 * a bit low so the shoulders show, and scales with its size. Zooming out
	 * below 1 slides towards `body`, the whole figure.
	 */
	frame(focus: Box3, body: Box3, view: View) {
		// Without head nor headgear, frame what is left; with nothing, a standard head spot
		if (focus.isEmpty())
			focus = body.isEmpty() ? new Box3(new Vector3(-12, 24, -12), new Vector3(12, 52, 12)) : body;
		const size = focus.getSize(new Vector3());
		const center = focus.getCenter(new Vector3());
		const extent = Math.max(size.y * 2.05, size.x * 2, 70);
		const target = new Vector3(center.x, center.y - extent * 0.08, center.z);
		if (view.zoom >= 1 || body.isEmpty()) return this.aim(target, extent / view.zoom, view);

		const t = MathUtils.smoothstep(1 - view.zoom, 0, 1 - MIN_ZOOM);
		const bodySize = body.getSize(new Vector3());
		// The disc is round: the whole figure has to fit inside the circle, not the square
		const whole = Math.max(bodySize.y, bodySize.x) * 1.6;
		this.aim(target.lerp(body.getCenter(new Vector3()), t), MathUtils.lerp(extent, whole, t), view);
	}

	/** Frame a complete equipment assembly with the icon's established camera angle. */
	fit(view: View) {
		if (!this.model) return;
		this.pivot.rotation.y = MathUtils.degToRad(view.yaw);
		this.pivot.updateMatrixWorld(true);
		const box = new Box3().setFromObject(this.model);
		const size = box.getSize(new Vector3());
		const pitch = MathUtils.degToRad(view.pitch);
		const height = size.y * Math.abs(Math.cos(pitch)) + size.z * Math.abs(Math.sin(pitch));
		this.aim(box.getCenter(new Vector3()), Math.max(size.x, height, size.z) * 1.2, view);
	}

	private aim(target: Vector3, extent: number, view: View) {
		this.pivot.rotation.y = MathUtils.degToRad(view.yaw);
		const distance = extent / 2 / Math.tan(MathUtils.degToRad(FOV / 2));
		const pitch = MathUtils.degToRad(view.pitch);
		this.camera.position.set(
			target.x,
			target.y + Math.sin(pitch) * distance,
			target.z + Math.cos(pitch) * distance
		);
		this.camera.near = distance / 10;
		this.camera.far = distance * 10;
		this.camera.lookAt(target);
		this.camera.updateProjectionMatrix();
	}

	/** Bounding box of the given children of the model, in world space. */
	/** With no names, the whole model. */
	box(names?: string[]) {
		const box = new Box3();
		// Measured facing the camera, so framing does not move when turning
		this.pivot.rotation.y = 0;
		this.pivot.updateMatrixWorld(true);
		this.model?.traverse((o) => {
			if (o instanceof Mesh && (!names || names.some((n) => isIn(o, n)))) box.expandByObject(o);
		});
		return box;
	}

	render(size: number) {
		this.renderer.setPixelRatio(1);
		this.renderer.setSize(size, size, false);
		this.renderer.render(this.scene, this.camera);
		return this.renderer.domElement;
	}
}

function isIn(o: Object3D, name: string) {
	for (let p: Object3D | null = o; p; p = p.parent) if (p.name === name) return true;
	return false;
}

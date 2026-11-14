import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial } from 'three';
import { preparePortraitModel, disposePortraitModel, emissionColor } from '../vendor/bricktrait/src/lib/materials.ts';

const piece = (id, material, geometry = new BoxGeometry()) => {
  const group = new Group();group.name = `${id}.dat`;
  const mesh = new Mesh(geometry, material);group.add(mesh);
  return {group,mesh};
};

test('emission stays on luminous geometry without changing the shared LDraw palette', () => {
  const palette = new MeshStandardMaterial({color:0xff8800,roughness:0.3});
  const model = new Group(),flame = piece('6126b',palette),body = piece('973',palette);
  model.add(flame.group,body.group);preparePortraitModel(model);
  assert.equal(palette.emissive.getHex(),0);
  assert.equal(palette.roughness,0.3);
  assert.notEqual(flame.mesh.material,body.mesh.material);
  assert.ok(emissionColor(flame.mesh).r > 0);
  assert.equal(emissionColor(body.mesh).getHex(),0);
  assert.equal(flame.mesh.material.color.getHex(),palette.color.getHex());
  disposePortraitModel(model);
});

test('crystals glow only in translucent finishes and ordinary transparent pieces stay unlit', () => {
  const glass = new MeshStandardMaterial({color:0x55aaff,transparent:true,opacity:0.5});
  const metal = new MeshStandardMaterial({color:0xaaaaaa,metalness:0.85,roughness:0.2});
  const model = new Group(),crystal = piece('30385',glass),sword = piece('79985',metal),cup = piece('3899',glass);
  model.add(crystal.group,sword.group,cup.group);preparePortraitModel(model);
  assert.ok(emissionColor(crystal.mesh).b > 0);
  assert.equal(emissionColor(sword.mesh).getHex(),0);
  assert.equal(emissionColor(cup.mesh).getHex(),0);
  assert.equal(sword.mesh.material.metalness,0.85);
  assert.ok(sword.mesh.material.roughness < 0.4);
  assert.equal(crystal.mesh.material.opacity,0.5);
  assert.equal(crystal.mesh.castShadow,false);
  disposePortraitModel(model);
});

test('authored hard edges survive normal preparation; missing normals are generated', () => {
  const geometry = new BoxGeometry(),normals = [...geometry.getAttribute('normal').array];
  const triangle = new BufferGeometry();
  triangle.setAttribute('position',new Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));
  const source = new MeshStandardMaterial(),box = piece('3626',source,geometry),missing = piece('973',source,triangle),model = new Group();
  model.add(box.group,missing.group);preparePortraitModel(model);
  assert.notEqual(box.mesh.geometry,geometry);
  assert.deepEqual([...box.mesh.geometry.getAttribute('normal').array],normals);
  assert.deepEqual([...missing.mesh.geometry.getAttribute('normal').array],[0,0,1,0,0,1,0,0,1]);
  assert.equal(triangle.hasAttribute('normal'),false);
  let disposed = 0;box.mesh.material.addEventListener('dispose',()=>disposed++);
  disposePortraitModel(model);
  assert.equal(disposed,1,'a shared material variant is disposed once');
});

test('cloth and rubber stay matte while luminous palette colours retain emission', () => {
  const cloth = piece('cape',new MeshStandardMaterial({color:0x345544}));cloth.group.userData.portraitCloth = true;
  const rubber = piece('hair',new MeshStandardMaterial({name:'Rubber_Black',color:0x111111,roughness:0.9}));
  const glow = piece('3626',new MeshStandardMaterial({color:0x88ff77,emissive:0x88ff77}));
  const model = new Group();model.add(cloth.group,rubber.group,glow.group);preparePortraitModel(model);
  assert.ok(cloth.mesh.material.roughness > 0.8);assert.equal(cloth.mesh.material.clearcoat,0);
  assert.ok(rubber.mesh.material.roughness > 0.8);assert.equal(rubber.mesh.material.clearcoat,0);
  assert.ok(emissionColor(glow.mesh).g > 0);
  disposePortraitModel(model);
});

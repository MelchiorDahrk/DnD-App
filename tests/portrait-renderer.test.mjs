import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, NoBlending, Vector3 } from 'three';
import { preparePortraitModel, disposePortraitModel, emissionBox, emissionColor } from '../vendor/bricktrait/src/lib/materials.ts';
import { portraitGlowMaterial } from '../vendor/bricktrait/src/lib/portrait-glow.ts';

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

test('all existing emissive finishes have a glow mask, while white plastic stays an occluder', () => {
  const model = new Group();
  const emitters = [
    ...['37775','6126a','6126b','85959','85959p01'].map(id=>piece(id,new MeshStandardMaterial({color:0xff8800}))),
    ...['11127','30385','30213','79985'].map(id=>piece(id,new MeshStandardMaterial({color:0x55aaff,transparent:true,opacity:0.5}))),
    piece('3626',new MeshStandardMaterial({color:0x88ff77,emissive:0x88ff77}))
  ];
  const white=piece('973',new MeshStandardMaterial({color:0xffffff}));
  model.add(...emitters.map(p=>p.group),white.group);preparePortraitModel(model);
  for(const {mesh} of emitters) {
    assert.notEqual(emissionColor(mesh).getHex(),0);
    const mask=portraitGlowMaterial(mesh.material);
    assert.equal(mask.toneMapped,false);
    assert.equal(mask.blending,NoBlending);
    assert.equal(mask.premultipliedAlpha,true,'the transparent glow pass writes premultiplied pixels');
    assert.equal(mask.depthWrite,true);
    mask.dispose();
  }
  const occluder=portraitGlowMaterial(white.mesh.material);
  assert.equal(occluder.opacity,0,'ordinary surfaces do not add a halo');
  assert.equal(occluder.depthWrite,true,'opaque surfaces still hide emitters behind them');
  occluder.dispose();disposePortraitModel(model);
});

test('wand emission and bounce follow the tip through part and figure transforms', () => {
  const source=new MeshStandardMaterial({color:0x583927});
  for(const [id,tip,shaft] of [['36752a',-44,0],['6124b',-62,-20],['28681',-62,-20]]) {
    const geometry=new BufferGeometry();
    geometry.setAttribute('position',new Float32BufferAttribute([0,tip,0,1,tip,0,0,shaft,0],3));
    const wand=piece(id,source,geometry),body=piece('973',source),model=new Group();
    wand.group.rotation.z=0.5;wand.group.position.set(12,20,3);model.rotation.x=Math.PI;
    model.add(wand.group,body.group);preparePortraitModel(model);
    assert.deepEqual([...wand.mesh.geometry.getAttribute('portraitEmissionMask').array],[1,1,0]);
    assert.notEqual(emissionColor(wand.mesh).getHex(),0);
    assert.equal(emissionColor(body.mesh).getHex(),0);
    assert.equal(source.emissive.getHex(),0);
    assert.equal(wand.mesh.material.color.getHex(),source.color.getHex(),'the wood/metal base colour is retained');
    const center=emissionBox(wand.mesh).getCenter(new Vector3());
    const tipCenter=new Vector3(0.5,tip,0).applyMatrix4(wand.mesh.matrixWorld);
    assert.ok(center.distanceTo(tipCenter)<0.0001);
    const mask=portraitGlowMaterial(wand.mesh.material);
    const bodyMask=portraitGlowMaterial(body.mesh.material);
    assert.notEqual(mask.customProgramCacheKey(),bodyMask.customProgramCacheKey(),'glow uses the same tip mask');
    bodyMask.dispose();mask.dispose();disposePortraitModel(model);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as T from 'three';
import {PLANTS_V6,plantReference,plantRenderKey} from '../src/plant-library-v6.js';
import {plantPrototype} from '../src/plant-models-v6.js';
import {referenceValid} from '../src/plant-catalog.js';
import {surfaceMaterial} from '../src/surface-materials-v6.js';
import {emptyScene,derive,regionDefaults,changeRegion} from '../src/composition-state.js';
import {fromRing} from '../src/region-geometry.js';
import {rect} from '../src/scene-config.js';
import {encode,decode} from '../src/persistence.js';
const fingerprint=root=>{const h=crypto.createHash('sha256');root.traverse(m=>{if(m.geometry)h.update(Buffer.from(m.geometry.attributes.position.array.buffer))});return h.digest('hex')};
const triangles=root=>root.children.reduce((s,m)=>s+m.geometry.attributes.position.count/3,0);
const scene=()=>{let c=emptyScene(6,6);c.composition.regions=[regionDefaults('soil',fromRing(rect(0,0,5.8,5.8)))];return derive(c)};
const item=type=>({id:1,type,x:0,z:0,r:15,scale:1,variant:1,...plantReference(type),seed:42991,seasonalState:'flowering'});
const doc=(config,items=[])=>encode({config,items,pending:[],profile:{},wish:'',camera:{position:[5,7,8],target:[0,.3,0],view:'edit'}});
test('12 distinct geometries, three structural variants, anchored roots and reduced far LOD',()=>{
 const shapes=new Set();for(const type of Object.keys(PLANTS_V6)){const variants=new Set();for(let variant=0;variant<3;variant++){
  const near=plantPrototype(type,variant,'near','flowering'),far=plantPrototype(type,variant,'far','flowering');variants.add(fingerprint(near));
  assert.ok(triangles(far)<triangles(near),type+' far LOD must reduce geometry');
  const b=new T.Box3().setFromObject(near);assert.ok(Math.abs(b.min.y)<1e-6,type+' root on floor');assert.ok(b.max.y>.05&&b.max.y<2.2,type+' plausible display height');
  assert.strictEqual(near,plantPrototype(type,variant,'near','flowering'));
 }assert.equal(variants.size,3,type+' structural variants');shapes.add(fingerprint(plantPrototype(type,0,'near','flowering')))}assert.equal(shapes.size,12);
});
test('asset + version + LOD + structural variant + season bind renderer; per-instance seeds share cache',()=>{
 const a=item('hosta6'),b=item('carex');assert.notEqual(plantRenderKey(a),plantRenderKey(b));assert.notEqual(plantRenderKey(a),plantRenderKey({...a,assetVersion:2}));assert.equal(plantRenderKey(a),plantRenderKey({...a,seed:77}));assert.notEqual(plantRenderKey(a),plantRenderKey({...a,seasonalState:'foliage'}));assert.equal(referenceValid({...a,assetId:'owol-v6-carex'}),false);
});
test('all 12 V6 references, seed and season survive strict JSON roundtrip',()=>{
 for(const type of Object.keys(PLANTS_V6)){const i=item(type),raw=doc(scene(),[i]),restored=decode(JSON.stringify(raw));assert.deepEqual(restored.items,[i]);assert.equal(restored.documentVersion,6);assert.equal(restored.catalogVersion,2);assert.deepEqual(restored.camera,raw.camera)}
});
test('unsupported future asset stays in pending with its original reference and seed; malformed seed rejects',()=>{
 const i={...item('hosta6'),assetVersion:99},raw=doc(scene(),[i]),restored=decode(raw);assert.equal(restored.items.length,0);assert.deepEqual(restored.pending[0].item,i);
 for(const patch of [{seed:NaN},{seed:-1},{seed:1.2},{seasonalState:'anything'},{assetVersion:Infinity}])assert.throws(()=>decode(doc(scene(),[{...item('hosta6'),...patch}])));
});
test('actual V5 saves migrate without ID, positions, camera, pending or region geometry loss',()=>{
 for(const name of fs.readdirSync('tests/fixtures/v5').filter(n=>n.endsWith('.json'))){const original=JSON.parse(fs.readFileSync('tests/fixtures/v5/'+name)),snapshot=JSON.stringify(original),d=decode(original);assert.equal(d.documentVersion,6);assert.equal(d.migratedFrom,5);assert.deepEqual(d.items,original.items);assert.deepEqual(d.pending,original.pending);assert.deepEqual(d.camera,original.camera);assert.deepEqual(d.sceneConfig.composition,original.sceneConfig.composition);assert.equal(JSON.stringify(original),snapshot)}
});
test('seven physical materials have distinct albedo and linear height maps; independent pattern and joints persist',()=>{
 const maps=new Set();for(const kind of ['soil','mulch','turf','gravel','stone','wood','concrete']){const m=surfaceMaterial(kind);assert.equal(m.type,'MeshStandardMaterial');assert.equal(m.metalness,0);assert.equal(m.map.colorSpace,T.SRGBColorSpace);assert.equal(m.bumpMap.colorSpace,T.NoColorSpace);assert.ok(m.bumpScale>0);maps.add(m.map)}assert.equal(maps.size,7);
 let c=scene();c=changeRegion(c,'soil',{kind:'paving',material:'concrete',pattern:'blocks',direction:90,moduleM:.3,jointWidthM:.02,seed:913});const d=decode(doc(c));assert.deepEqual(d.sceneConfig.composition,c.composition);assert.equal(d.sceneConfig.surfaces[0].material,'concrete');assert.throws(()=>changeRegion(c,'soil',{jointWidthM:1}));assert.throws(()=>changeRegion(c,'soil',{surfaceMaterialId:'invalid'}));
});

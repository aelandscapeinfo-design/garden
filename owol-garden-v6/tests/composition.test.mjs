import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyScene,editRegion,changeRegion,resizeComposition,areaSummary,asComposition,derive,validateComposition,regionDefaults} from '../src/composition-state.js';
import {fromRing,patch,measure,contains,difference,strokeGeometry,validateGeometry} from '../src/region-geometry.js';
import {placementError,relocate} from '../src/rules.js';
import {encode,decode} from '../src/persistence.js';
import {artScene} from '../src/art-scene.js';
import {itemReference,filterPlants} from '../src/plant-catalog.js';
import {V4_PROFILE} from '../src/visual-profile.js';
import {buildingGeometry,accessReport} from '../src/building-geometry.js';
import {TEMPLATES,templateScene,samplePlants} from '../src/composition-templates.js';
import {moveRegion,mergeRegion} from '../src/composition-state.js';
const plant=(id=1,x=0,z=0)=>({id,type:'grass',x,z,r:15,scale:1,variant:1,...itemReference('grass',V4_PROFILE)});
const record=(config,items=[],pending=[])=>encode({config,items,pending,profile:{},wish:'',camera:null});
const add=(c,g,id='a')=>editRegion(c,{id,geometry:g,operation:'new'}).config;
test('truly empty site has zero structures, stays empty on resize and V5 roundtrip',()=>{
 const c=emptyScene();assert.equal(c.visualProfileId,V4_PROFILE);for(const k of ['walls','obstacles','openings','plantableZones','surfaces'])assert.equal(c[k].length,0);
 assert.deepEqual(decode(record(c)).sceneConfig,c);const d=resizeComposition(c,8,6).config;assert.equal(areaSummary(d).site,48);assert.equal(d.visualProfileId,V4_PROFILE);assert.equal(d.composition.regions.length,0);
});
test('patch geometry is shared by actual placement and restoration',()=>{
 const c=add(emptyScene(),patch(0,0,2)),i=plant();assert.equal(placementError(i,[],c),null);assert.notEqual(placementError(plant(2,2,2),[],c),null);
 const d=decode(record(c,[i]));assert.deepEqual(d.sceneConfig,c);assert.deepEqual(d.items,[i]);
});
test('subtraction preserves holes and islands, area excludes holes; round trip is exact',()=>{
 let c=add(emptyScene(),patch(0,0,4));c=editRegion(c,{id:'a',geometry:patch(0,0,1),operation:'subtract'}).config;
 assert.equal(measure(c.composition.regions[0].geometry),15);assert.equal(c.composition.regions[0].geometry[0].length,2);assert.notEqual(placementError(plant(),[],c),null);
 c=editRegion(c,{id:'a',geometry:strokeGeometry({x:0,z:-2},{x:0,z:2},.5,'square'),operation:'subtract'}).config;
 assert.equal(c.composition.regions[0].geometry.length,2);assert.deepEqual(decode(record(c)).sceneConfig,c);
 c=editRegion(c,{id:'a',geometry:patch(0,1,1),operation:'add'}).config;assert.equal(c.composition.regions[0].geometry.length,1);
});
test('fast interpolated stroke is continuous and leaves unrelated region unchanged',()=>{
 let c=add(emptyScene(),patch(-2,-1,.5),'other');const old=structuredClone(c.composition.regions[0]);c=add(c,strokeGeometry({x:-2,z:0},{x:2,z:0},.5,'circle'));
 const r=c.composition.regions[1];assert.equal(r.geometry.length,1);for(let x=-2;x<2;x+=.1)assert.ok(contains(r.geometry,x,0));assert.deepEqual(c.composition.regions[0],old);
});
test('planting to paving relocates without loss, original catalog refs survive',()=>{
 let c=add(emptyScene(),patch(0,0,2));const plants=[plant(1,-.5,0),plant(2,.5,0)],before=record(c,plants);c=changeRegion(c,'a',{kind:'paving',material:'wood',pattern:'deck',direction:90});const r=relocate(plants,c);
 assert.equal(r.pending.length,2);assert.equal(r.items.length,0);const next=decode(record(c,r.items,r.pending));assert.deepEqual(next.pending.map(p=>p.item),plants);assert.deepEqual(decode(before).items,plants);
});
test('V4 imports preserve every original coordinate and render geometry until explicit editing',()=>{
 const a=artScene(),d=decode({version:4,sceneConfig:a.config,items:a.items,pending:[],profile:{},wish:'',camera:null});assert.deepEqual(d.sceneConfig,a.config);assert.deepEqual(d.items,a.items);assert.equal(d.visualProfileId,V4_PROFILE);
 const converted=asComposition(a.config);for(const z of converted.composition.regions.filter(r=>r.legacyControls))assert.deepEqual(z.legacyControls,a.config.plantableZones.find(o=>o.id===z.id));
});
test('malformed, duplicate, nonfinite, future and excessive geometry are rejected',()=>{
 const c=add(emptyScene(),patch(0,0,2)),d=record(c,[plant()]);
 for(const change of [d=>d.version=7,d=>d.sceneConfig.composition.regions[0].geometry[0][0][0][0]=NaN,d=>d.items.push({...d.items[0]}),d=>d.sceneConfig.composition.regions.push(structuredClone(d.sceneConfig.composition.regions[0]))]){const v=structuredClone(d);change(v);assert.throws(()=>decode(v))}
 assert.throws(()=>validateGeometry(fromRing([[0,0],[2,2],[0,2],[2,0]])));
});
test('unknown catalogue reference is preserved in pending with reason, not dropped',()=>{
 const c=add(emptyScene(),patch(0,0,2)),i={...plant(),catalogId:'future-form',assetId:'missing-model'},d=decode(record(c,[i]));assert.equal(d.items.length,0);assert.deepEqual(d.pending[0].item,i);assert.ok(d.pending[0].reason);assert.deepEqual(decode(record(c,[],d.pending)).pending,d.pending);
});
test('catalogue multi-axis filters intersect and biological data remains unknown',()=>{
 assert.equal(filterPlants({growth:'tree'},V4_PROFILE).length,1);assert.equal(filterPlants({growth:'herb',texture:'fine',flower:'purple'},V4_PROFILE)[0].type,'flower');assert.equal(filterPlants({growth:'tree',flower:'purple'},V4_PROFILE).length,0);assert.ok(filterPlants({},V4_PROFILE).every(p=>p.leafPersistence==='unknown'&&p.matureHeightM===null));
});
test('all ten templates have actual distinct compositions, valid example placement and restoration',()=>{
 const signatures=new Set();for(const t of TEMPLATES){const c=templateScene(t.id),items=samplePlants(c);validateComposition(c);signatures.add(JSON.stringify([c.widthM,c.depthM,c.composition.regions,c.composition.buildings,c.composition.planters]));for(const i of items)assert.equal(placementError(i,items,c),null);assert.deepEqual(decode(record(c,items)).sceneConfig,c);if(c.composition.buildings.length)assert.equal(accessReport(c).connected,true,t.id)}assert.equal(signatures.size,10);
});
test('rectangle, L, U exact areas, rotated mirrored door and concave footprint',()=>{
 for(const shape of ['rect','L','U'])for(const rotation of [0,90,180,270])for(const mirrored of [false,true]){
  const b={id:'house',shape,width:6,depth:4,wing:1,height:2.6,x:1,z:-1,rotation,mirrored,door:{segment:shape==='rect'?2:shape==='L'?3:4,offset:.5,width:.8}},g=buildingGeometry(b);
  assert.equal(Math.round(measure(g.geometry)),shape==='rect'?24:shape==='L'?9:12);assert.equal(g.door.segment,b.door.segment);assert.equal(contains(g.geometry,g.door.x+g.door.normal[0]*.1,g.door.z+g.door.normal[1]*.1),false);assert.equal(contains(g.geometry,g.door.x-g.door.normal[0]*.1,g.door.z-g.door.normal[1]*.1),true);
 }
});
test('invalid buildings, blocked door and out of bounds planter cannot be saved',()=>{
 const c=templateScene('U');for(const change of [b=>b.wing=4,b=>b.width=NaN,b=>b.x=12,b=>b.door.segment=99,b=>b.door.offset=.05]){const d=structuredClone(c);change(d.composition.buildings[0]);assert.throws(()=>validateComposition(d))}
 const d=emptyScene();d.composition.planters=[{...regionDefaults('p',patch(3,0,2)),height:.4,support:'soil'}];assert.throws(()=>validateComposition(d));
});
test('building hides ground without deleting it; removal restores original region',()=>{
 let c=add(emptyScene(10,10),patch(0,0,6));const original=structuredClone(c.composition.regions);c.composition.buildings=[{id:'h',shape:'rect',width:2,depth:2,wing:.5,height:2.5,x:0,z:0,rotation:0,mirrored:false,door:{segment:2,offset:.5,width:.8}}];c=derive(c);assert.equal(placementError(plant(),[],c),'벽·난간·건물 내부에는 놓을 수 없어요.');assert.deepEqual(c.composition.regions,original);const a=areaSummary(c);assert.equal(a.site,a.planting+a.lawn+a.paving+a.building+a.soil);c.composition.buildings=[];c=derive(c);assert.deepEqual(c.composition.regions,original);assert.equal(placementError(plant(),[],c),null);
});
test('clearance grid detects severed access; no nonexistent door on empty site',()=>{
 const c=templateScene('front');assert.ok(accessReport(c).connected);c.composition.regions.push(regionDefaults('block',fromRing([[-3.95,2.5],[3.95,2.5],[3.95,3.5],[-3.95,3.5]])));const d=derive(c);assert.equal(accessReport(d).connected,false);assert.ok(accessReport(emptyScene()).connected);
});
test('explicit merge, clone and smooth edges keep geometry valid and stable',()=>{
 let c=add(emptyScene(),patch(-1,0,1));c=moveRegion(c,'a',2,0,true,'b');assert.equal(c.composition.regions.length,2);c=mergeRegion(c,'a','b');assert.equal(c.composition.regions.length,1);assert.equal(c.composition.regions[0].geometry.length,2);c=changeRegion(c,'a',{edge:'soft'});validateComposition(c);assert.deepEqual(decode(record(c)).sceneConfig,c);
});

test('centred resize clips ground, preserves item coordinates and rejects fixed safety shells',()=>{
 let c=add(emptyScene(8,6),patch(3,0,1));const i=plant(1,3,0),result=resizeComposition(c,4,4);assert.ok(result.removedM2>0);assert.equal(result.config.visualProfileId,V4_PROFILE);const moved=relocate([i],result.config);assert.deepEqual(moved.pending[0].item,i);assert.deepEqual(decode(record(result.config,moved.items,moved.pending)).pending,moved.pending);assert.throws(()=>resizeComposition(templateScene('rooftop'),12,8));
});

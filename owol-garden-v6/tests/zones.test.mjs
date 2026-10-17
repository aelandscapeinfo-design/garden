import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createScene,plantingZone,floorHeight} from '../src/scene-config.js';
import {zoneControls,withZones,validateZones,transferZones} from '../src/zone-state.js';
import {effectiveOutline,area} from '../src/zone-geometry.js';
import {encode,decode} from '../src/persistence.js';
import {relocate,placementError} from '../src/rules.js';
import {artScene} from '../src/art-scene.js';
const fixture=()=>{const {config,items}=artScene(),zones=zoneControls(config);zones[0].origin='custom';zones[0].rounding=.15;return {config,zones,items}};
test('V4 keeps exact custom controls, effective polygon, ID, area and pending across round trips',()=>{
 const {config,zones,items}=fixture();assert.equal(validateZones(config,zones,items),null);
 const c=withZones(config,zones),moved=relocate(items,c),d=encode({config:c,...moved,profile:{},wish:'',camera:null});
 const restored=decode(JSON.stringify(d));assert.equal(restored.version,6);assert.deepEqual(restored.sceneConfig,c);assert.deepEqual(restored.items,moved.items);assert.deepEqual(restored.pending,moved.pending);assert.equal(area(restored.sceneConfig.plantableZones[0].polygon),area(effectiveOutline(zones[0].points,.15)));
 // A forged derived polygon is ignored; validated controls remain authoritative.
 const forged=structuredClone(d);forged.sceneConfig.plantableZones[0].polygon=[[99,99],[100,99],[100,100]];assert.deepEqual(decode(forged).sceneConfig,c);
});
test('V3 canonical migration preserves original file and all items; V4 does not regenerate custom contours',()=>{
 const {config,items}=artScene();const raw={version:3,sceneConfig:config,items,pending:[],profile:{},wish:''},before=JSON.stringify(raw);const result=decode(raw);assert.equal(result.version,6);assert.deepEqual(result.sceneConfig,config);assert.equal(JSON.stringify(raw),before);assert.deepEqual(result.items,items);
});
test('untrusted controls and canonical origin cannot bypass buildings, paths or benches',()=>{
 const {config,zones,items}=fixture();
 for(const mutate of [z=>z[0].points[0][0]=NaN,z=>z[0].points[0][1]=Infinity,z=>z[0].points[0][0]=-4,z=>z[0].points=[[0,0],[1,0],[1,1]],z=>z[0].points=[[1.3,-1.9],[2.7,-1.9],[2.7,-.6],[1.3,-.6]],z=>z[0].rounding=.8,z=>z[0].id=z[1].id,z=>{z[0].origin='preset';z[0].points[0][0]=0}]){
  const bad=structuredClone(zones);mutate(bad);assert.throws(()=>decode(encode({config:withZones(config,bad),items:[],pending:[],profile:{},wish:''})));assert.notEqual(validateZones(config,bad,items),null);
 }
});
test('delete and shrink preserve all plant IDs in placed + pending; a restored record restores coordinates',()=>{
 const {config,items}=artScene(),c=withZones(config,[]),m=relocate(items,c);assert.equal(m.items.length,1);assert.equal(m.pending.length,18);assert.deepEqual([...m.items,...m.pending.map(p=>p.item)].map(i=>i.id).sort(),items.map(i=>i.id).sort());const original=decode(encode({config,items,pending:[],profile:{},wish:''}));assert.deepEqual(original.items,items);
});
test('raised planter outline and height share planting and ground elevation; transfer is explicit and validated',()=>{
 const c=createScene('terrace'),zs=zoneControls(c);zs[0].origin='custom';zs[0].height=.75;zs[0].rounding=.15;assert.equal(validateZones(c,zs),null);const custom=withZones(c,zs);assert.equal(floorHeight(custom,-2.5,0,'grass'),.75);assert.equal(plantingZone(custom,0,0),undefined);
 assert.ok(transferZones(custom,createScene('terrace',8,4),[]).config);assert.ok(transferZones(custom,createScene('terrace',3,3),[]).error);assert.ok(transferZones(custom,createScene('front'),[]).error);
});

test('later furniture or paving cannot make a custom-zone save invalid',()=>{
 const c=createScene('front',6,4.5),zones=zoneControls(c);zones[0].origin='custom';const custom=withZones(c,zones);
 for(const type of ['bench','gravel','wood','stone'])assert.match(placementError({id:50,type,x:-1.6,z:-.5,r:0,scale:1,variant:0},[],custom),/화단/);
 const paving={id:50,type:'gravel',x:.5,z:1,r:0,scale:1,variant:0};assert.equal(placementError(paving,[],custom),null);assert.deepEqual(decode(encode({config:custom,items:[paving],pending:[],profile:{},wish:''})).items,[paving]);
});

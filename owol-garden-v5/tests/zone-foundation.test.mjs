import {test} from 'node:test';
import assert from 'node:assert/strict';
import {area,effectiveOutline,validateZone,validateControlPoints,containsDisk,intersectionArea,outsideArea} from '../src/zone-geometry.js';
const rect=(x,z,w,d)=>[[x,z],[x+w,z],[x+w,z+d],[x,z+d]];
const zone=points=>({id:'west',kind:'ground',height:.03,points,rounding:0});
test('finite simple concave contours retain area; crossing and degenerate controls fail',()=>{
 const concave=[[0,0],[3,0],[3,1],[1,1],[1,3],[0,3]];
 assert.equal(validateControlPoints(concave),null);assert.equal(area(concave),5);
 for(const p of [[[0,0],[2,2],[0,2],[2,0]],[[0,0],[1,0],[2,0]],[[0,0],[NaN,1],[1,0]],[[0,0],[Infinity,1],[1,0]],[[0,0],[.01,0],[1,1]],[[0,0],[1,0]],Array.from({length:33},(_,i)=>[Math.cos(i),Math.sin(i)])])assert.ok(validateControlPoints(p));
});
test('entire long edges crossing a protected narrow corridor are rejected',()=>{
 const z=zone(rect(-3,-1,6,2)),blocked=[{id:'door',name:'출입문',polygon:rect(-.04,-2,.08,4)}];
 assert.match(validateZone(z,{boundary:rect(-4,-4,8,8),blocked}),/출입문/);
 assert.equal(intersectionArea(z.points,blocked[0].polygon),.16);
});
test('circle containment detects narrow notches missed by fixed perimeter samples',()=>{
 const p=[[-2,-2],[2,-2],[2,2],[.42,2],[.42,.5],[.32,.5],[.32,2],[-2,2]];
 assert.equal(validateControlPoints(p)?.includes('0.15'),true);
 // Containment must remain exact even for imported or derived narrow features.
 assert.equal(containsDisk(p,0,0,1),false);assert.equal(containsDisk(p,-1,-1,.4),true);
});
test('rounded contour is shared deterministic data and cannot cross a protected concave notch',()=>{
 const p=[[0,0],[3,0],[3,1],[1,1],[1,3],[0,3]],z={...zone(p),rounding:.35};
 const effective=effectiveOutline(p,.35);assert.equal(effective.length,42);assert.deepEqual(effectiveOutline(p,.35),effective);
 assert.ok(area(effective)>0);assert.ok(outsideArea(effective,p)>0);
 assert.ok(validateZone(z,{blocked:[{id:'notch',polygon:rect(1,1,2,2)}]}));
});
test('boundary, zone overlap, wall gap, height and untrusted rounding are validated',()=>{
 const z=zone(rect(0,0,1,1));assert.equal(validateZone(z,{boundary:rect(-2,-2,4,4)}),null);
 assert.ok(validateZone(z,{boundary:rect(.2,.2,2,2)}));
 assert.ok(validateZone(z,{otherZones:[{...zone(rect(.5,.5,1,1)),id:'east'}]}));
 assert.ok(validateZone(z,{blocked:[{id:'wall',polygon:rect(1.01,0,.2,1)}]}));
 assert.ok(validateZone({...z,rounding:NaN}));assert.ok(validateZone({...z,rounding:.5}));assert.ok(validateZone({...z,kind:'planter',height:0}));
 assert.equal(validateZone({...z,kind:'planter',height:.44}),null);
});

import {createScene,rect} from './scene-config.js';
import {CATALOG} from './catalog.js';
import {effectiveOutline,validateZone,ZONE_LIMITS} from './zone-geometry.js';
export const zoneControls=c=>c.plantableZones.map(z=>({id:z.id,kind:z.kind,height:z.height,points:structuredClone(z.points||z.polygon),rounding:z.rounding??0,origin:z.origin||'preset'}));
export const materializeZone=z=>({...structuredClone(z),polygon:effectiveOutline(z.points,z.rounding)});
export function withZones(c,zones){return {...structuredClone(c),customZones:true,zoneSchemaVersion:1,plantableZones:zones.map(materializeZone)}}
function rotated(i,points){const a=i.r*Math.PI/180,s=i.scale||1;return points.map(([x,z])=>[i.x+(x*Math.cos(a)+z*Math.sin(a))*s,i.z+(-x*Math.sin(a)+z*Math.cos(a))*s])}
export function protectedAreas(c,items=[]){
 const out=[...c.obstacles.map(o=>({...o,name:'벽·난간·건물'})),...c.openings.map(o=>({id:o.id,polygon:o.clearance,name:'출입문과 보행 여유'}))];
 // Deck/court/roof are base surfaces that may carry planters. The front walk
 // and sitting surface are dedicated circulation, not an editable substrate.
 if(c.presetId==='front')for(const s of c.surfaces)if(s.material!=='turf')out.push({...s,name:'기존 길·앉는 자리'});
 for(const i of items){
  if(i.type==='bench')out.push({id:'bench-'+i.id,name:'벤치와 앞쪽 여유',polygon:rotated(i,rect(0,.35,1.8,1.44))});
  else if(CATALOG[i.type]?.category==='surface'){
   let p;
   if(i.type==='gravel'){
    // Circumscribed polygon contains the entire elliptical paving footprint.
    p=Array.from({length:32},(_,n)=>{const a=n*Math.PI/16,k=1/Math.cos(Math.PI/32);return [i.x+Math.cos(a)*.46*(i.sx||i.scale||1)*k,i.z+Math.sin(a)*.46*(i.sz||i.scale||1)*k]});
   }else p=rotated(i,rect(0,0,i.type==='wood'?.78:.72,i.type==='wood'?.86:.6));
   out.push({id:'paving-'+i.id,name:'배치한 포장',polygon:p});
  }
 }
 return out;
}
export function validateZones(c,zones,items=[]){
 if(!Array.isArray(zones)||zones.length>ZONE_LIMITS.maxZones)return '식재 영역은 최대 16개입니다.';
 if(c.presetId==='legacy')return '이전 8 × 8 공간은 원본 형상을 보존합니다. 다른 공간에서 영역을 편집해주세요.';
 const canonical=zoneControls(createScene(c.presetId,c.widthM,c.depthM,c.seed)),seen=new Set(),blocked=protectedAreas(c,items);
 for(const z of zones){
  if(!z||seen.has(z.id))return '영역 ID가 없거나 중복됩니다.';seen.add(z.id);
  if(z.origin==='preset'){
   // Only byte-for-byte canonical controls may retain the existing preset's
   // overlapping borders. A touched zone becomes custom and passes all rules.
   if(!canonical.some(p=>JSON.stringify(p)===JSON.stringify(z)))return '기본 영역의 제어 데이터가 변조되었습니다.';
   continue;
  }
  if(z.origin!=='custom')return '영역의 출처가 올바르지 않습니다.';
  const expected=['terrace','rooftop'].includes(c.presetId)?'planter':'ground';
  if(z.kind!==expected)return expected==='planter'?'이 공간은 높이 있는 플랜터로 편집합니다.':'이 공간은 노지 화단으로 편집합니다.';
  const error=validateZone(z,{boundary:c.boundary,blocked,otherZones:zones});if(error)return error;
 }
 return null;
}
export function readCustomZones(c,q,items){
 if(q.zoneSchemaVersion!==1||!Array.isArray(q.plantableZones))throw Error('식재 영역 저장 형식을 확인해주세요.');
 const zones=q.plantableZones.map(z=>({id:z?.id,kind:z?.kind,height:z?.height,points:z?.points,rounding:z?.rounding,origin:z?.origin}));
 const error=validateZones(c,zones,items);if(error)throw Error(error);
 return withZones(c,zones);
}
export function transferZones(c,target,items){
 const zones=zoneControls(c).map(z=>({...z,origin:'custom'})),error=validateZones(target,zones,items);
 return {config:error?null:withZones(target,zones),error};
}

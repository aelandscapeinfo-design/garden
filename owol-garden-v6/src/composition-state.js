import {createScene,rect} from './scene-config.js';
import {visualProfile,V4_PROFILE} from './visual-profile.js';
import {fromRing,union,difference,intersection,measure,contains,validateGeometry,REGION_LIMITS,translate,softened} from './region-geometry.js';
import {buildingGeometry,validateBuildings,accessReport} from './building-geometry.js';
export const MATERIALS=['stone','gravel','concrete','wood'];
export const PATTERNS=['regular','irregular','continuous','blocks','deck'];
export const regionDefaults=(id,geometry,kind='planting')=>({id,name:kind==='planting'?'새 화단':kind==='lawn'?'잔디':'면 포장',kind,geometry,material:'stone',pattern:'regular',direction:0,moduleM:.6,seed:3107,jointWidthM:.012,surfaceMaterialId:'soil',edge:'ordered'});
const clone=x=>structuredClone(x);
export function emptyScene(widthM=6,depthM=4.5){
 const c=createScene('front',widthM,depthM);
 c.visualProfileId=V4_PROFILE;
 c.composition={schemaVersion:1,templateId:'empty',baseFloor:'soil',regions:[],planters:[],buildings:[],fixed:{walls:[],obstacles:[],openings:[]},pathWidthM:.75};
 return derive(c);
}
export function activeGeometry(c,r){const buildings=c.composition.buildings.map(buildingGeometry);return difference(r.geometry,...buildings.map(g=>g.geometry),...(r.kind==='planting'?buildings.map(g=>fromRing(g.door.clearance)):[]))}
export function derive(config){
 const c=clone(config),a=c.composition;if(!a)return c;
 c.schemaVersion=5;c.boundary=rect(0,0,c.widthM,c.depthM);c.customZones=false;c.representsRealSite=false;
 c.walls=clone(a.fixed.walls);c.openings=clone(a.fixed.openings);c.obstacles=clone(a.fixed.obstacles);delete c.stair;delete c.bench;
 for(const b of a.buildings){const g=buildingGeometry(b);c.obstacles.push({id:b.id,polygon:g.ring});c.openings.push(g.door)}
 c.plantableZones=[];c.surfaces=[];
 for(const r of a.regions){const geometry=activeGeometry(c,r);if(!geometry.length)continue;
  const v={...r,geometry,polygon:geometry[0][0].slice(0,-1),height:r.kind==='planting'?.03:r.kind==='lawn'?.04:.045};
  if(r.kind==='planting')c.plantableZones.push({...v,kind:'ground'});else c.surfaces.push({...v,material:r.kind==='lawn'?'turf':r.material});
 }
 for(const p of a.planters)c.plantableZones.push({...p,kind:'planter',polygon:p.geometry[0][0].slice(0,-1)});
 c.viewpoints={full:{position:[c.widthM*.94,Math.max(c.widthM,c.depthM)*1.05,c.depthM*1.2],target:[0,.65,0]}};
 if(c.openings.length){const o=c.openings[0],n=o.normal||[0,1];c.viewpoints.entrance={position:[o.x+n[0]*1.1,1.65,o.z+n[1]*1.1],target:[0,.65,0]}}
 return c;
}
export function asComposition(config){
 if(config.composition)return clone(config);
 if(config.presetId==='legacy')throw Error('V2 원본 공간은 개별 배치를 유지합니다. 새 빈 땅에서 면 편집을 시작해주세요.');
 const c=clone(config);c.visualProfileId=visualProfile(c);
 const substrate=['terrace','rooftop','courtyard'].includes(c.presetId)?(c.presetId==='terrace'?'wood':'stone'):'soil';
 const a=c.composition={schemaVersion:1,templateId:'imported-'+c.presetId,baseFloor:substrate,regions:[],planters:[],buildings:[],fixed:{walls:clone(c.walls),obstacles:clone(c.obstacles),openings:clone(c.openings)},fixedReference:{presetId:c.presetId,widthM:c.widthM,depthM:c.depthM,seed:c.seed},pathWidthM:.75};
 if(c.stair)a.fixed.walls.push({id:'fixed-stair-volume',...clone(c.stair),style:'plaster'});
 for(const z of c.plantableZones){const r={...regionDefaults(z.id,fromRing(z.polygon)),legacyControls:clone(z)};
  if(z.kind==='planter')a.planters.push({...r,height:z.height,support:substrate});else a.regions.push(r);
 }
 for(const s of c.surfaces){
  if(substrate!=='soil'&&s.material!=='turf')continue;
  const geometry=intersection(fromRing(s.polygon),fromRing(c.boundary));
  for(const r of a.regions)r.geometry=difference(r.geometry,geometry);
  a.regions.push({...regionDefaults('surface-'+s.id,geometry,s.material==='turf'?'lawn':'paving'),material:s.material==='turf'?'stone':s.material,pattern:s.material==='wood'?'deck':s.material==='gravel'?'continuous':'regular'});
 }
 a.regions=a.regions.filter(r=>r.geometry.length);
 // The old controls remain in legacyControls; only the explicit edit conversion
 // resolves old overlapping layers into one owner per ground point.
 return derive(c);
}
export function protectedGeometry(c,kind='planting'){
 const a=c.composition;
 return union(...c.obstacles.map(o=>fromRing(o.polygon)),...(kind==='planting'?c.openings.map(o=>fromRing(o.clearance)):[]),...a.planters.map(p=>p.geometry));
}
export function editRegion(config,{id,geometry,operation='add',kind='planting',shape='square',size=1}){
 const c=asComposition(config),a=c.composition,old=a.regions.find(r=>r.id===id),beforeGeometry=old?JSON.stringify(old.geometry):null;
 if(operation!=='new'&&!old)throw Error('먼저 바닥의 화단이나 면을 선택해주세요.');
 if(kind==='planting'&&a.baseFloor!=='soil'&&!old)throw Error('데크·옥상은 독립 플랜터를 추가해 식재해주세요.');
 const clipped=intersection(geometry,fromRing(c.boundary)),allowed=difference(clipped,protectedGeometry(c,old?.kind||kind));
 let blockedM2=measure(geometry)-measure(allowed);
 if(!allowed.length)return {config,changed:false,blockedM2};
 let target=old;
 if(operation==='new'){target=regionDefaults(id,[],kind);a.regions.push(target)}
 if(operation==='subtract')target.geometry=difference(target.geometry,allowed);
 else {
  // Never silently merge or modify an unselected named region. Use explicit
  // conversion to change a region's kind, or the explicit merge command.
  const paint=difference(allowed,...a.regions.filter(r=>r.id!==id).map(r=>r.geometry));
  blockedM2+=measure(allowed)-measure(paint);
  target.geometry=union(target.geometry,paint);
 }
 const unchanged=old&&beforeGeometry===JSON.stringify(target.geometry);
 a.regions=a.regions.filter(r=>r.geometry.length);
 validateComposition(c);
 return {config:derive(c),changed:!unchanged&&JSON.stringify(config.composition)!==JSON.stringify(a),blockedM2};
}
export function changeRegion(config,id,changes){
 const c=clone(config),r=[...c.composition.regions,...c.composition.planters].find(r=>r.id===id);if(!r)throw Error('먼저 면을 선택해주세요.');
 Object.assign(r,changes);
 if(changes.edge==='soft')r.geometry=softened(r.geometry);
 validateComposition(c);return derive(c);
}
export function moveRegion(config,id,x,z,duplicate=false,newId){
 const c=clone(config),list=c.composition.regions.some(r=>r.id===id)?c.composition.regions:c.composition.planters,r=list.find(r=>r.id===id);if(!r)throw Error('먼저 면을 선택해주세요.');
 const target=duplicate?{...clone(r),id:newId,name:r.name+' 복제'}:r;
 target.geometry=translate(r.geometry,x,z);if(duplicate)list.push(target);
 validateComposition(c);return derive(c);
}
export function mergeRegion(config,id,other){
 const c=clone(config),a=c.composition.regions,r=a.find(r=>r.id===id),s=a.find(r=>r.id===other);
 if(!r||!s||r===s||['kind','material','pattern','direction','moduleM','edge','jointWidthM','surfaceMaterialId','seed'].some(k=>r[k]!==s[k]))throw Error('종류·재료·패턴이 같은 면만 명시적으로 합칠 수 있습니다.');
 r.geometry=union(r.geometry,s.geometry);c.composition.regions=a.filter(v=>v!==s);validateComposition(c);return derive(c);
}
export function resizeComposition(config,w,d){
 createScene('front',w,d,config.seed);if(config.composition.fixedReference&&(w!==config.widthM||d!==config.depthM))throw Error('고정 벽·난간 구성의 치수는 기본 구성 카드에서 새로 선택해주세요. 자유 부지는 현재 좌표로 크기를 바꿀 수 있습니다.');const c=clone(config),before=areaSummary(c);
 c.widthM=w;c.depthM=d;c.boundary=rect(0,0,w,d);
 c.composition.regions.forEach(r=>r.geometry=intersection(r.geometry,fromRing(c.boundary)));c.composition.regions=c.composition.regions.filter(r=>r.geometry.length);
 validateComposition(c);return {config:derive(c),removedM2:Math.max(0,before.planting+before.lawn+before.paving-c.composition.regions.reduce((s,r)=>s+measure(r.geometry),0))};
}
export function areaSummary(c){
 if(!c.composition)return null;
 const a={site:c.widthM*c.depthM,planting:0,lawn:0,paving:0,building:0,soil:0,planter:0};
 for(const r of c.composition.regions)a[r.kind]+=measure(activeGeometry(c,r));
 a.building=measure(union(...c.composition.buildings.map(b=>buildingGeometry(b).geometry)));
 a.planter=c.composition.planters.reduce((s,p)=>s+measure(p.geometry),0);
 a.soil=Math.max(0,a.site-a.planting-a.lawn-a.paving-a.building);
 if(c.composition.baseFloor!=='soil'){a.paving+=a.soil;a.soil=0}
 return a;
}
export function validateComposition(c){
 const a=c.composition;if(!a||a.schemaVersion!==1||!['soil','wood','stone'].includes(a.baseFloor)||!Array.isArray(a.regions)||!Array.isArray(a.planters)||!Array.isArray(a.buildings)||!a.fixed||!['walls','obstacles','openings'].every(k=>Array.isArray(a.fixed[k])&&a.fixed[k].length<=40)||!Number.isFinite(a.pathWidthM)||a.pathWidthM<.5||a.pathWidthM>1.5)throw Error('구성 데이터 형식을 확인해주세요.');
 createScene(c.presetId,c.widthM,c.depthM,c.seed);if(c.presetId==='legacy')throw Error('V2 공간은 자유 구성으로 자동 변환하지 않습니다.');
 if(a.regions.length+a.planters.length>REGION_LIMITS.regions)throw Error('면과 플랜터는 최대 48개입니다.');
 const ids=new Set(),boundary=fromRing(c.boundary);let count=0;
 if(a.fixedReference){const r=a.fixedReference,old=createScene(r.presetId,r.widthM,r.depthM,r.seed),fixed={walls:old.walls,obstacles:old.obstacles,openings:old.openings};if(old.stair)fixed.walls.push({id:'fixed-stair-volume',...old.stair,style:'plaster'});if(JSON.stringify(fixed)!==JSON.stringify(a.fixed))throw Error('기존 고정 벽·난간·출입구는 원본 정의를 유지해야 합니다.');}else if(Object.values(a.fixed).some(v=>v.length))throw Error('출처가 없는 고정 구조입니다. 새 건물 도구를 사용해주세요.');
 for(const r of [...a.regions,...a.planters,...a.buildings]){if(!r||typeof r.id!=='string'||!/^[-\w]{1,80}$/.test(r.id)||ids.has(r.id))throw Error('구성 ID가 없거나 중복됩니다.');ids.add(r.id)}
 for(const r of [...a.regions,...a.planters]){
  count+=validateGeometry(r.geometry);
  if(r.surfaceMaterialId!==undefined&&!['soil','mulch','gravel'].includes(r.surfaceMaterialId))throw Error('식재 표면 재질을 확인해주세요.');
  if(r.jointWidthM!==undefined&&(!Number.isFinite(r.jointWidthM)||r.jointWidthM<.002||r.jointWidthM>.08))throw Error('줄눈 폭은 0.002–0.08 m입니다.');
  if(typeof r.name!=='string'||r.name.length>80||!['planting','lawn','paving'].includes(r.kind)||!MATERIALS.includes(r.material)||!PATTERNS.includes(r.pattern)||![0,90,180,270].includes(r.direction)||!Number.isFinite(r.moduleM)||r.moduleM<.15||r.moduleM>2||!Number.isInteger(r.seed)||r.seed<0||r.seed>2147483647||!['ordered','soft'].includes(r.edge))throw Error('면의 종류·재료·패턴을 확인해주세요.');
  if(measure(difference(r.geometry,boundary))>1e-7)throw Error('면·플랜터는 부지 안에 있어야 합니다.');
 }
 if(count>REGION_LIMITS.vertices)throw Error('전체 면의 꼭짓점은 4096개 이내로 편집해주세요.');
 for(let i=0;i<a.regions.length;i++)for(let j=0;j<i;j++)if(measure(intersection(a.regions[i].geometry,a.regions[j].geometry))>1e-7)throw Error('한 바닥 위치는 한 면만 소유할 수 있습니다.');
 for(const p of a.planters){
  if(!Number.isFinite(p.height)||p.height<.15||p.height>.8||!['soil','wood','stone'].includes(p.support))throw Error('플랜터 높이는 0.15–0.8 m입니다.');
  for(const o of a.planters)if(p!==o&&measure(intersection(p.geometry,o.geometry))>1e-7)throw Error('플랜터가 겹칩니다.');
 }
 for(const o of a.fixed.obstacles)validateGeometry(fromRing(o.polygon));
 for(const o of a.fixed.openings){validateGeometry(fromRing(o.clearance));if(!Number.isFinite(o.x)||!Number.isFinite(o.z)||!Number.isFinite(o.width)||o.width<=0)throw Error('고정 출입구가 올바르지 않습니다.')}
 for(const w of a.fixed.walls)if(!['x','z','w','d','height'].every(k=>Number.isFinite(w[k])&&Math.abs(w[k])<=32)||w.w<=0||w.d<=0||w.height<=0||!['plaster','railing','slats'].includes(w.style))throw Error('고정 벽을 확인해주세요.');
 const bs=validateBuildings(c);
 for(const p of a.planters)for(const o of [...a.fixed.obstacles,...a.fixed.openings.map(o=>({polygon:o.clearance}))])if(measure(intersection(p.geometry,fromRing(o.polygon)))>1e-7)throw Error('고정 벽·출입구와 플랜터가 겹칩니다.');
 for(const p of a.planters)for(const g of bs)if(measure(intersection(p.geometry,union(g.geometry,fromRing(g.door.clearance))))>1e-7)throw Error('건물·출입문과 플랜터가 겹칩니다. 플랜터를 먼저 옮겨주세요.');
 return true;
}
export {accessReport};

import {emptyScene,asComposition,derive,validateComposition,regionDefaults} from './composition-state.js';
import {fromRing,difference,intersection,contains} from './region-geometry.js';
import {rect,createScene} from './scene-config.js';
import {placementError} from './rules.js';
import {itemReference} from './plant-catalog.js';
import {V4_PROFILE} from './visual-profile.js';
export const TEMPLATES=[
 ['empty','빈 땅',6,4.5],['front','작은 주택 앞마당',8,8],['back','넓은 뒷마당',10,8],['side','가늘고 긴 옆마당',4,12],['L','ㄱ자 집과 마당',10,10],['U','ㄷ자 집과 중정',10,10],['lawn','잔디 중심 정원',10,8],['planting','식재 중심 정원',8,8],['terrace','테라스·데크 정원',6,3],['rooftop','옥상 개념 정원',10,6],
].map(([id,name,width,depth])=>({id,name,width,depth}));
export function templateScene(id,w,d){
 const t=TEMPLATES.find(t=>t.id===id);if(!t)throw Error('알 수 없는 구성입니다.');w??=t.width;d??=t.depth;
 if(['terrace','rooftop'].includes(id)){
  const original=createScene(id,w,d),c=asComposition(original);c.visualProfileId=V4_PROFILE;c.composition.templateId=id;
  validateComposition(c);return derive(c);
 }
 const c=emptyScene(w,d),a=c.composition,x=w/2,z=d/2;a.templateId=id;
 const region=(id,poly,kind='planting',extra={})=>{const geometry=intersection(fromRing(poly),fromRing(c.boundary));for(const r of a.regions)r.geometry=difference(r.geometry,geometry);a.regions.push({...regionDefaults(id,geometry,kind),...extra})};
 const house=(shape,bw,bd,bx,bz,segment=2)=>a.buildings.push({id:'house',shape,width:bw,depth:bd,wing:1.2,height:2.65,x:bx,z:bz,rotation:0,mirrored:false,door:{segment,offset:.5,width:.9}});
 if(id==='front'){
  house('rect',w*.64,1.6,0,-z+1);region('west',rect(-w*.31,.5,w*.24,d-3));region('east',rect(w*.31,.6,w*.22,d-3.3));region('entry-walk',rect(0,1,1.2,d-2),'paving',{material:'gravel',pattern:'continuous'});region('sitting',rect(w*.21,-z+2.6,w*.3,1.4),'paving');
 }else if(id==='back'){
  house('rect',w*.65,1.5,0,-z+.95);region('border-left',rect(-x+.85,.5,1.3,d-2));region('border-right',rect(x-.85,.6,1.3,d-2.2));region('back-border',rect(0,z-.6,w-.4,.8));region('central-lawn',rect(0,.4,w-3.4,d-3.6),'lawn');region('entry-walk',rect(0,.7,1.2,d-1.4),'paving');
 }else if(id==='side'){
  house('rect',1.1,d*.57,-x+.75,-d*.1,1);region('ribbon-bed',rect(x-.65,0,1,d-.6));region('long-path',rect(.2,0,1,d-.3),'paving',{material:'gravel',pattern:'continuous'});
 }else if(id==='L'||id==='U'){
  house(id,w*.6,d*.4,id==='L'?-w*.1:0,-d*.18,id==='L'?3:4);region('edge-bed',rect(-x+.65,d*.15,.8,d*.48));region('south-drift',rect(w*.1,z-.8,w*.58,1.1));region('east-drift',rect(x-.75,.9,1.1,d*.38));region('quiet-lawn',rect(0,d*.15,w*.32,d*.22),'lawn');region('court-path',rect(id==='L'?-.6:0,d*.1,1.2,d*.75),'paving');
 }else if(id==='lawn'){
  region('west-mixed',rect(-x+.9,0,1.3,d-.5));region('north-mixed',rect(0,-z+.6,w-.4,.8));region('south-mixed',rect(.7,z-.6,w-1.8,.8));region('open-lawn',rect(.2,0,w-3,d-2),'lawn');region('edge-walk',rect(x-.65,0,.9,d-.5),'paving',{material:'gravel',pattern:'continuous'});
 }else if(id==='planting'){
  region('north-west',rect(-w*.24,-d*.23,w*.35,d*.3));region('south-west',rect(-w*.22,d*.2,w*.38,d*.32));region('north-east',rect(w*.25,-d*.24,w*.32,d*.27));region('east-mid',rect(w*.28,d*.03,w*.26,d*.23));region('east-south',rect(w*.23,d*.3,w*.36,d*.17));region('soft-path',rect(0,0,.9,d),'paving',{material:'gravel',pattern:'continuous'});region('small-seat',rect(w*.21,-.7,w*.36,1.2),'paving');
 }
 a.regions=a.regions.filter(r=>r.geometry.length);validateComposition(c);return derive(c);
}
export function samplePlants(c){
 const items=[];let id=1;const types=['shrub','grass','flower','grass'];
 for(const zone of c.plantableZones){let count=0;for(let z=-c.depthM/2+.5;z<c.depthM/2;z+=.65)for(let x=-c.widthM/2+.5;x<c.widthM/2;x+=.65){
  if(count>=12||items.length>=70)continue;const type=count===0?'tree':types[count%4],i={id,type,x:+x.toFixed(2),z:+z.toFixed(2),r:(id*35)%360,scale:type==='tree'?.75:.95,variant:id%3,...itemReference(type,c.visualProfileId)};
  if(!contains(zone.geometry,x,z,.2)||items.some(o=>Math.hypot(o.x-x,o.z-z)<.4))continue;
  if(!placementError(i,items,c)){items.push(i);id++;count++}
 }}return items;
}

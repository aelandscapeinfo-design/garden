import pc from 'polygon-clipping';
import {area,pointInside,pointSegmentDistance,simplePolygon} from './zone-geometry.js';
export const REGION_LIMITS={regions:48,vertices:4096,ring:1024};
export const fromRing=p=>p?.length?[[[...p,p[0]]]]:[];
export function normalize(mp){
 return mp.filter(p=>p.length).map(p=>p.map(r=>{
  const out=[];
  for(const q of r){const v=q.map(n=>+n.toFixed(7));if(!out.length||Math.hypot(...v.map((n,i)=>n-out.at(-1)[i]))>1e-8)out.push(v)}
  if(out.length>1&&out[0].every((v,i)=>v===out.at(-1)[i]))out.pop();
  return out.length?[...out,out[0]]:out;
 }).filter(r=>r.length>=4&&area(r)>1e-10)).filter(p=>p.length);
}
export const union=(...a)=>normalize(a.filter(x=>x.length).length?pc.union(...a.filter(x=>x.length)):[]);
export const difference=(a,...b)=>a.length?normalize(pc.difference(a,...b.filter(x=>x.length))):[];
export const intersection=(a,b)=>a.length&&b.length?normalize(pc.intersection(a,b)):[];
export const measure=mp=>mp.reduce((s,p)=>s+area(p[0])-p.slice(1).reduce((n,h)=>n+area(h),0),0);
const open=r=>r.length&&r[0].every((v,i)=>v===r.at(-1)[i])?r.slice(0,-1):r;
export function contains(mp,x,z,r=0){
 return mp.some(p=>pointInside(open(p[0]),x,z)&&!p.slice(1).some(h=>pointInside(open(h),x,z))&&p.every(ring=>open(ring).every((a,i,points)=>pointSegmentDistance([x,z],a,points[(i+1)%points.length])+1e-8>=r)));
}
export function disk(x,z,r,n=24){return fromRing(Array.from({length:n},(_,i)=>[x+Math.cos(i/n*Math.PI*2)*r,z+Math.sin(i/n*Math.PI*2)*r]))}
export function patch(x,z,size,shape='square'){
 x=Math.round(x*4)/4;z=Math.round(z*4)/4;
 return shape==='circle'?disk(x,z,size/2):fromRing([[x-size/2,z-size/2],[x+size/2,z-size/2],[x+size/2,z+size/2],[x-size/2,z+size/2]]);
}
export function strokeGeometry(a,b,size,shape){
 const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/Math.min(.125,size/4)));
 if(n>512)throw Error('한 번에 너무 먼 범위를 칠했습니다. 나누어 칠해주세요.');
 return union(...Array.from({length:n+1},(_,i)=>patch(a.x+(b.x-a.x)*i/n,a.z+(b.z-a.z)*i/n,size,shape)));
}
export const translate=(mp,x,z)=>mp.map(p=>p.map(r=>r.map(q=>[q[0]+x,q[1]+z])));
export function softened(mp){
 const sm=mp.map(p=>p.map(r=>{const a=open(r),out=[];for(let i=0;i<a.length;i++){const p=a[i],q=a[(i+1)%a.length];out.push(p.map((v,k)=>v*.8+q[k]*.2),p.map((v,k)=>v*.2+q[k]*.8))}return [...out,out[0]]}));
 return intersection(union(sm),mp); // never grows over an existing protected edge
}
export function validateGeometry(mp,{allowEmpty=false}={}){
 if(!Array.isArray(mp)||(!allowEmpty&&!mp.length)||mp.length>96)throw Error('면의 분리 영역 수를 확인해주세요.');
 let count=0;
 for(const p of mp){
  if(!Array.isArray(p)||!p.length||p.length>64)throw Error('면의 구멍 데이터가 올바르지 않습니다.');
  for(const ring of p){
   if(!Array.isArray(ring)||ring.length<4||ring.length>REGION_LIMITS.ring||ring.some(q=>!Array.isArray(q)||q.length!==2||q.some(v=>!Number.isFinite(v)||Math.abs(v)>32)))throw Error('면의 좌표·점 수를 확인해주세요.');
   if(!ring[0].every((v,i)=>v===ring.at(-1)[i])||!simplePolygon(open(ring))||area(ring)<1e-8)throw Error('닫히지 않거나 교차하는 면입니다.');
   count+=ring.length;
  }
  const outer=fromRing(open(p[0]));
  for(let i=1;i<p.length;i++){
   const h=fromRing(open(p[i]));
   if(measure(difference(h,outer))>1e-7)throw Error('구멍은 외곽 안에 있어야 합니다.');
   for(let j=1;j<i;j++)if(measure(intersection(h,fromRing(open(p[j]))))>1e-7)throw Error('면의 구멍이 겹칩니다.');
  }
 }
 if(count>REGION_LIMITS.vertices)throw Error('면이 너무 복잡합니다. 총 4096점 이내로 나누어 편집해주세요.');
 if(Math.abs(measure(mp)-measure(union(mp)))>1e-6)throw Error('분리 영역이 서로 겹칩니다.');
 return count;
}

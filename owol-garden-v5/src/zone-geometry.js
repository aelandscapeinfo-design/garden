// Shared contour geometry for the editor, renderer and V4 validation.
import clipping from 'polygon-clipping';
export const ZONE_LIMITS=Object.freeze({minPoints:3,maxPoints:32,minEdgeM:.15,minAreaM2:.12,maxZones:16,minGapM:.02});
const EPS=1e-8;
export const area=p=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1]},0))/2;
const ring=p=>[[...p,p[0]]];
function clipArea(polys){return polys.reduce((sum,p)=>sum+area(p[0])-p.slice(1).reduce((n,h)=>n+area(h),0),0)}
export const intersectionArea=(a,b)=>clipArea(clipping.intersection(ring(a),ring(b)));
export const outsideArea=(a,b)=>clipArea(clipping.difference(ring(a),ring(b)));
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
export function pointSegmentDistance(p,a,b){
 const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy;
 const t=Math.max(0,Math.min(1,l?((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l:0));
 return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
}
export function segmentsMeet(a,b,c,d){
 const ab1=cross(a,b,c),ab2=cross(a,b,d),cd1=cross(c,d,a),cd2=cross(c,d,b);
 if(((ab1>EPS&&ab2<-EPS)||(ab1<-EPS&&ab2>EPS))&&((cd1>EPS&&cd2<-EPS)||(cd1<-EPS&&cd2>EPS)))return true;
 return [pointSegmentDistance(a,c,d),pointSegmentDistance(b,c,d),pointSegmentDistance(c,a,b),pointSegmentDistance(d,a,b)].some(v=>v<EPS);
}
export function simplePolygon(p){
 for(let i=0;i<p.length;i++)for(let j=i+1;j<p.length;j++){
  if(j===i+1||(i===0&&j===p.length-1))continue;
  if(segmentsMeet(p[i],p[(i+1)%p.length],p[j],p[(j+1)%p.length]))return false;
 }
 return true;
}
export function pointInside(poly,x,z){
 let yes=false;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const a=poly[i],b=poly[j];
  if(pointSegmentDistance([x,z],a,b)<EPS)return true;
  if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;
 }
 return yes;
}
// Exact circle containment against every boundary segment, including narrow
// concave notches that an eight-point perimeter sample can miss.
export function containsDisk(poly,x,z,r=0){
 return pointInside(poly,x,z)&&poly.every((a,i)=>pointSegmentDistance([x,z],a,poly[(i+1)%poly.length])+EPS>=r);
}
export function boundaryDistance(a,b){
 let min=Infinity;
 for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++){
  const aa=a[i],ab=a[(i+1)%a.length],ba=b[j],bb=b[(j+1)%b.length];
  if(segmentsMeet(aa,ab,ba,bb))return 0;
  min=Math.min(min,pointSegmentDistance(aa,ba,bb),pointSegmentDistance(ab,ba,bb),pointSegmentDistance(ba,aa,ab),pointSegmentDistance(bb,aa,ab));
 }
 return min;
}
export function polygonDistance(a,b){return intersectionArea(a,b)>EPS?0:boundaryDistance(a,b)}
export function effectiveOutline(points,rounding=0){
 if(!rounding)return points.map(p=>[...p]);
 const out=[];
 for(let i=0;i<points.length;i++){
  const p=points[i],a=points[(i+points.length-1)%points.length],b=points[(i+1)%points.length];
  const entry=p.map((v,k)=>v+(a[k]-v)*rounding),exit=p.map((v,k)=>v+(b[k]-v)*rounding);
  for(let j=0;j<=6;j++){
   const t=j/6;out.push(p.map((v,k)=>(1-t)**2*entry[k]+2*(1-t)*t*v+t*t*exit[k]));
  }
 }
 return out;
}
export function validateControlPoints(points){
 if(!Array.isArray(points)||points.length<3||points.length>32)return '꼭짓점은 3–32개로 구성해주세요.';
 if(points.some(p=>!Array.isArray(p)||p.length!==2||p.some(x=>!Number.isFinite(x)||Math.abs(x)>32)))return '좌표는 유한한 미터 값이어야 합니다.';
 for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)if(Math.hypot(points[i][0]-points[j][0],points[i][1]-points[j][1])<ZONE_LIMITS.minEdgeM-EPS)return '꼭짓점 사이를 0.15 m 이상 띄워주세요.';
 if(!simplePolygon(points))return '윤곽이 서로 교차하거나 겹쳐 있어요.';
 if(area(points)<ZONE_LIMITS.minAreaM2)return '식재 영역은 0.12 m² 이상이어야 합니다.';
 return null;
}
export function validateZone(zone,{boundary,blocked=[],otherZones=[]}={}){
 if(!zone||typeof zone.id!=='string'||!/^[a-zA-Z0-9_-]{1,50}$/.test(zone.id))return '영역 ID가 올바르지 않습니다.';
 if(!['ground','planter'].includes(zone.kind)||!Number.isFinite(zone.height)||(zone.kind==='ground'?zone.height!==.03:zone.height<.15||zone.height>.8))return '노지는 0.03 m, 플랜터 높이는 0.15–0.8 m여야 합니다.';
 if(!Number.isFinite(zone.rounding)||zone.rounding<0||zone.rounding>.4)return '모서리 완화는 0–0.4 범위여야 합니다.';
 const error=validateControlPoints(zone.points);if(error)return error;
 const polygon=effectiveOutline(zone.points,zone.rounding);
 if(!simplePolygon(polygon)||area(polygon)<ZONE_LIMITS.minAreaM2)return '곡선 윤곽이 겹치거나 너무 작습니다.';
 if(boundary&&(outsideArea(polygon,boundary)>EPS||outsideArea(zone.points,boundary)>EPS))return '영역의 전체 윤곽을 부지 안에 두어주세요.';
 const wallHalf=zone.kind==='planter'?.0375:.0075;
 if(boundary&&boundaryDistance(polygon,boundary)<wallHalf-EPS)return '화단 테두리 두께까지 부지 안에 두어주세요.';
 for(const o of blocked){
  if(intersectionArea(polygon,o.polygon)>EPS||polygonDistance(polygon,o.polygon)<ZONE_LIMITS.minGapM+wallHalf-EPS)return `${o.name||o.id||'보존 공간'}과 테두리 두께를 포함해 0.02 m 이상 띄워주세요.`;
 }
 for(const o of otherZones){
  if(o.id===zone.id)continue;
  const poly=o.points?effectiveOutline(o.points,o.rounding):o.polygon;
  if(intersectionArea(polygon,poly)>EPS||boundaryDistance(polygon,poly)<wallHalf+(o.kind==='planter'?.0375:.0075)-EPS)return '다른 식재 영역의 테두리와 겹칠 수 없어요.';
 }
 return null;
}

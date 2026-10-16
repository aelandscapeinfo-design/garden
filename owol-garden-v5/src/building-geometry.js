import {fromRing,contains,measure,difference,intersection,union} from './region-geometry.js';
const finite=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
export function buildingGeometry(b){
 if(!b||!['rect','L','U'].includes(b.shape)||!finite(b.width,1,12)||!finite(b.depth,1,12)||!finite(b.wing,.5,5)||!finite(b.height,1.8,4)||!finite(b.x,-16,16)||!finite(b.z,-16,16)||![0,90,180,270].includes(b.rotation)||typeof b.mirrored!=='boolean')throw Error('건물의 치수와 방향을 확인해주세요.');
 const w=b.width,d=b.depth,t=b.wing;
 if(b.shape!=='rect'&&(t>=Math.min(w,d)-.5||(b.shape==='U'&&2*t>w-.75)))throw Error('날개 사이에 0.75 m 이상 마당을 남겨주세요.');
 let p=b.shape==='rect'?[[0,0],[w,0],[w,d],[0,d]]:b.shape==='L'?[[0,0],[w,0],[w,t],[t,t],[t,d],[0,d]]:[[0,0],[w,0],[w,d],[w-t,d],[w-t,t],[t,t],[t,d],[0,d]];
 const a=b.rotation*Math.PI/180,transform=([x,z])=>{x=(x-w/2)*(b.mirrored?-1:1);z-=d/2;return [b.x+x*Math.cos(a)+z*Math.sin(a),b.z-x*Math.sin(a)+z*Math.cos(a)]};
 const ring=p.map(transform),geometry=fromRing(ring),q=b.door;
 if(!q||!Number.isInteger(q.segment)||q.segment<0||q.segment>=ring.length||!finite(q.offset,.05,.95)||!finite(q.width,.6,1.8))throw Error('출입문의 벽과 위치를 확인해주세요.');
 const s=ring[q.segment],e=ring[(q.segment+1)%ring.length],len=Math.hypot(e[0]-s[0],e[1]-s[1]);
 if(Math.min(q.offset,1-q.offset)*len<q.width/2+.05)throw Error('문 폭이 해당 벽을 벗어납니다. 벽 또는 문 위치를 바꿔주세요.');
 const tangent=[(e[0]-s[0])/len,(e[1]-s[1])/len],at=s.map((v,i)=>v+(e[i]-v)*q.offset);let normal=[-tangent[1],tangent[0]];
 if(contains(geometry,at[0]+normal[0]*.02,at[1]+normal[1]*.02))normal=normal.map(v=>-v);
 const corner=(u,v)=>at.map((n,i)=>n+tangent[i]*u+normal[i]*v),clearance=[corner(-q.width/2-.05,.015),corner(q.width/2+.05,.015),corner(q.width/2+.05,1),corner(-q.width/2-.05,1)];
 return {geometry,ring,door:{id:b.id+'-door',x:at[0],z:at[1],width:q.width,height:Math.min(2.15,b.height-.12),normal,tangent,clearance,segment:q.segment,offset:q.offset}};
}
export function validateBuildings(c){
 const list=c.composition.buildings,boundary=fromRing(c.boundary);if(list.length>3)throw Error('건물은 최대 3개입니다.');
 const occupied=[];
 for(const b of list){const g=buildingGeometry(b);
  if(measure(difference(g.geometry,boundary))>1e-7||measure(difference(fromRing(g.door.clearance),boundary))>1e-7)throw Error('건물과 문 앞 1 m 여유를 부지 안에 두어주세요.');
  for(const o of occupied)if(measure(intersection(g.geometry,union(o.geometry,fromRing(o.door.clearance))))>1e-7||measure(intersection(fromRing(g.door.clearance),o.geometry))>1e-7)throw Error('건물 또는 출입문이 겹칩니다.');
  for(const o of c.composition.fixed.obstacles)if(measure(intersection(g.geometry,fromRing(o.polygon)))>1e-7)throw Error('고정 벽·난간과 건물이 겹칩니다.');
  occupied.push(g);
 }
 return occupied;
}
// Derived 0.25 m clearance grid. This is a conceptual guide, not a building code check.
export function accessReport(c,items=[]){
 if(!c.composition||!c.composition.buildings.length)return {connected:true,paths:[],resolutionM:.25,widthM:c.composition?.pathWidthM||.75};
 const step=.25,r=c.composition.pathWidthM/2,nx=Math.floor(c.widthM/step),nz=Math.floor(c.depthM/step);
 const blocks=[...c.obstacles.map(o=>fromRing(o.polygon)),...c.plantableZones.map(z=>z.geometry||fromRing(z.polygon)),...items.filter(i=>i.type==='bench'||i.type==='tree').map(i=>fromRing([[i.x-.3,i.z-.3],[i.x+.3,i.z-.3],[i.x+.3,i.z+.3],[i.x-.3,i.z+.3]]))];
 const free=(x,z)=>blocks.every(g=>!contains(g,x,z)&&g.every(p=>p.every(ring=>ring.slice(0,-1).every((a,i)=>{const b=ring[i+1],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)>=r}))));
 const grid=Array.from({length:nx*nz},(_,i)=>{const x=-c.widthM/2+(i%nx+.5)*step,z=-c.depthM/2+(Math.floor(i/nx)+.5)*step;return {x,z,ok:free(x,z)}});
 const results=[];
 for(const b of c.composition.buildings){const door=buildingGeometry(b).door,x=door.x+door.normal[0]*.65,z=door.z+door.normal[1]*.65;
  const start=grid.map((p,i)=>({i,d:p.ok?Math.hypot(p.x-x,p.z-z):Infinity})).sort((a,b)=>a.d-b.d)[0];
  let end=-1;const queue=start?.d<.6?[start.i]:[],parents=new Map(queue.map(i=>[i,null]));
  for(let h=0;h<queue.length;h++){const i=queue[h],ix=i%nx,iz=Math.floor(i/nx);if(ix===0||iz===0||ix===nx-1||iz===nz-1){end=i;break}
   for(const j of [i-1,i+1,i-nx,i+nx])if(j>=0&&j<grid.length&&Math.abs(j%nx-ix)+Math.abs(Math.floor(j/nx)-iz)===1&&grid[j].ok&&!parents.has(j)){parents.set(j,i);queue.push(j)}
  }
  const path=[];while(end!==-1&&end!==null){path.push([grid[end].x,grid[end].z]);end=parents.get(end)}results.push({buildingId:b.id,connected:!!path.length,path:path.reverse()});
 }
 return {connected:results.every(p=>p.connected),paths:results,resolutionM:step,widthM:c.composition.pathWidthM};
}

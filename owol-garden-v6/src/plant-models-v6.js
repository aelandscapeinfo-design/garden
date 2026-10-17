import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {PLANTS_V6,plantRenderKey} from './plant-library-v6.js';
import {random} from './catalog.js';
const v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),Y=v(0,1,0);
const materials={
 leaf:new T.MeshStandardMaterial({color:0x4f7651,roughness:.91,metalness:0,side:T.DoubleSide}),
 light:new T.MeshStandardMaterial({color:0x76915a,roughness:.94,side:T.DoubleSide}),
 stem:new T.MeshStandardMaterial({color:0x6d7952,roughness:.96}),
 bark:new T.MeshStandardMaterial({color:0x79634e,roughness:1}),
 white:new T.MeshStandardMaterial({color:0xe3dfbd,roughness:.93,side:T.DoubleSide}),
 pink:new T.MeshStandardMaterial({color:0xbc7989,roughness:.93,side:T.DoubleSide}),
 purple:new T.MeshStandardMaterial({color:0x82709c,roughness:.94,side:T.DoubleSide}),
 cone:new T.MeshStandardMaterial({color:0x9c6537,roughness:1}),
 copper:new T.MeshStandardMaterial({color:0xad8461,roughness:.95,side:T.DoubleSide}),
};
const cache=new Map();let builds=0;
export function plantPrototype(type,variant=0,lod='near',season='foliage'){
 const spec=PLANTS_V6[type];if(!spec)throw Error('Unknown V6 asset '+type);
 const key=plantRenderKey({type,variant,seasonalState:season},lod);
 if(cache.has(key))return cache.get(key);
 const rng=random(9821+Object.keys(PLANTS_V6).indexOf(type)*193+variant*619),far=lod==='far',bloom=season==='flowering',parts=new Map();
 const put=(geo,mat='leaf')=>{
  if(geo.index){const old=geo;geo=geo.toNonIndexed();old.dispose()}
  geo.deleteAttribute('uv');for(const attr of Object.keys(geo.attributes))if(!['position','normal'].includes(attr))geo.deleteAttribute(attr);
  if(!geo.attributes.normal)geo.computeVertexNormals();if(!parts.has(mat))parts.set(mat,[]);parts.get(mat).push(geo);
 };
 function branch(a,b,r=.009,mat='stem'){
  const delta=b.clone().sub(a),g=new T.CylinderGeometry(r*.55,r,delta.length(),far?4:5,1);
  g.applyQuaternion(new T.Quaternion().setFromUnitVectors(Y,delta.normalize()));g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());put(g,mat);
 }
 function bead(p,size,mat='pink',stretch=1){const g=new T.IcosahedronGeometry(size,0);g.scale(1,stretch,1);g.translate(...p.toArray());put(g,mat)}
 // Curved leaves have an actual midrib ridge. No ball canopy or photo planes.
 function leaf(base,tip,width,mat='leaf',lobes=0){
  const axis=tip.clone().sub(base),side=v(-axis.z,0,axis.x).normalize();if(side.lengthSq()<.1)side.set(1,0,0);
  const pos=[],steps=far?4:7;
  const point=(t,u)=>{const lobing=lobes?(.8+.2*Math.cos(t*Math.PI*lobes*2)):1;
   const half=Math.pow(Math.sin(Math.PI*t),.8)*width*.5*lobing;
   return base.clone().addScaledVector(axis,t).addScaledVector(side,u*half).add(v(0,Math.sin(Math.PI*t)*width*(.22-.2*Math.abs(u)),0));};
  for(let n=0;n<steps;n++){const a=n/steps,b=(n+1)/steps;for(const [u,w]of [[-1,0],[0,1]]){const p=point(a,u),q=point(a,w),r=point(b,w),s=point(b,u);pos.push(...p,...q,...r,...p,...r,...s)}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.computeVertexNormals();put(g,mat);
 }
 function palmate(center,radius,angle){
  const points=[center.clone()],n=far?20:35;
  for(let j=0;j<=n;j++){const a=j/n*Math.PI*2,rr=radius*(.82+.18*Math.cos(a*7));points.push(center.clone().add(v(Math.cos(a+angle)*rr,Math.sin(a)*.04,Math.sin(a+angle)*rr)))}
  const xyz=[];for(let j=1;j<=n;j++)xyz.push(...points[0],...points[j],...points[j+1]);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(xyz,3));g.computeVertexNormals();put(g);
 }
 function ribbon(a,length,width,height,mat='leaf',origin=v()){
  const xyz=[],steps=far?6:10;const p=(t,s)=>origin.clone().add(v(Math.cos(a)*(length*t*t+s*width*(1-t)),height*Math.sin(t*Math.PI*.76),Math.sin(a)*(length*t*t+s*width*(1-t))));
  for(let j=0;j<steps;j++){const t=j/steps,u=(j+1)/steps;xyz.push(...p(t,-1),...p(t,1),...p(u,1),...p(t,-1),...p(u,1),...p(u,-1))}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(xyz,3));g.computeVertexNormals();put(g,mat);
 }
 function floret(center,size=.024,mat='pink'){
  if(far){bead(center,size,mat);return}for(let k=0;k<4;k++){const a=k*Math.PI/2;leaf(center,center.clone().add(v(Math.cos(a)*size, .008,Math.sin(a)*size)),size*.9,mat)}
 }
 function flatFlowers(center,radius,mat){const n=far?9:20;for(let j=0;j<n;j++){const a=j*2.39996,d=radius*Math.sqrt(j/n);floret(center.clone().add(v(Math.cos(a)*d,rng()*.025,Math.sin(a)*d)),.022,mat)}}
 const angle=i=>i*2.39996+variant*.3+rng()*.18;
 if(type==='panicle'||type==='spirea'){
  const pan=type==='panicle',count=pan?7:13;
  for(let i=0;i<count;i++){
   const a=angle(i),spread=(pan?.33:.48)*(.7+rng()*.3),height=(pan?.86:.57)*(.7+rng()*.3),mid=v(Math.cos(a)*spread*.35,height*.52,Math.sin(a)*spread*.35),tip=v(Math.cos(a)*spread,height,Math.sin(a)*spread);
   branch(v(),mid,pan?.018:.009,'bark');branch(mid,tip,pan?.012:.005,'bark');
   for(let j=0;j<(far?3:5);j++){const t=.35+j*.12,base=mid.clone().lerp(tip,t);for(let s=0;s<(pan?2:1);s++){const aa=a+(s?1:-1)*1.4+j*.4;leaf(base,base.clone().add(v(Math.cos(aa)*(pan?.21:.13),.04,Math.sin(aa)*(pan?.21:.13))),pan?.12:.045,j%3===0?'light':'leaf',pan?2:1)}}
   if(bloom&&pan){const h=.34,n=far?16:40;branch(tip,tip.clone().add(v(0,h,0)),.005);for(let j=0;j<n;j++){const t=j/n,r=.16*(1-t)*Math.sqrt(rng()),aa=j*2.39996;floret(tip.clone().add(v(Math.cos(aa)*r,t*h,Math.sin(aa)*r)),.038*(1-t*.5),'white')}}
   if(bloom&&!pan)flatFlowers(tip,.13,'pink');
  }
 }
 if(type==='hosta6'||type==='heuchera'){
  const hosta=type==='hosta6';for(let i=0;i<(far?10:15);i++){
   const a=angle(i),len=(hosta?.44:.29)*(.8+rng()*.25),base=v(Math.cos(a)*len*.25,hosta?.17:.14,Math.sin(a)*len*.25);if(hosta)branch(v(),base,.006);
   if(hosta){const tip=v(Math.cos(a)*len, .19+rng()*.12,Math.sin(a)*len);leaf(base,tip,.21,'leaf');if(!far){for(const t of [.3,.55,.75]){const c=base.clone().lerp(tip,t);branch(c,c.clone().add(v(Math.cos(a+1.3)*.07,.012,Math.sin(a+1.3)*.07)),.0017,'light')}}}
   else {const center=v(Math.cos(a)*len,.13+rng()*.07,Math.sin(a)*len);branch(v(),center,.003);palmate(center,.10,a);}
  }
  if(bloom)for(let i=0;i<(hosta?2:4);i++){const a=angle(i),top=v(Math.cos(a)*.10,hosta?.67:.64,Math.sin(a)*.10);branch(v(),top,.004);for(let j=0;j<(hosta?5:9);j++){const p=top.clone().multiplyScalar(.6+j*.04).add(v(.055*Math.cos(j),0,.055*Math.sin(j)));branch(top.clone().multiplyScalar(.6+j*.04),p,.002);const g=new T.ConeGeometry(hosta?.024:.012,hosta?.075:.028,5,1,true);g.rotateZ(.3);g.translate(...p.toArray());put(g,hosta?'white':'pink')}}
 }
 if(['echinacea','salvia','sedum'].includes(type)){
  const daisy=type==='echinacea',sedum=type==='sedum',count=sedum?9:daisy?5:10;
  for(let i=0;i<count;i++){const a=angle(i),top=v(Math.cos(a)*.2,(sedum?.46:daisy?.85:.62)*(.72+rng()*.28),Math.sin(a)*.2);branch(v(),top,sedum?.012:.006);
   for(let j=1;j<=3;j++){const base=top.clone().multiplyScalar(j/4);for(const s of [-1,1]){const aa=a+s*1.3+j;leaf(base,base.clone().add(v(Math.cos(aa)*(sedum?.14:.16),.04,Math.sin(aa)*(sedum?.14:.16))),sedum?.09:.065,j===1?'light':'leaf')}}
   if(bloom&&daisy){const g=new T.SphereGeometry(.067,far?6:9,5,0,Math.PI*2,0,Math.PI/2);g.scale(1,1.5,1);g.translate(...top.toArray());put(g,'cone');for(let j=0;j<(far?9:13);j++){const aa=j/(far?9:13)*Math.PI*2;leaf(top.clone().add(v(Math.cos(aa)*.035,0,Math.sin(aa)*.035)),top.clone().add(v(Math.cos(aa)*.17,-.085,Math.sin(aa)*.17)),.047,'pink')}}
   if(bloom&&sedum)flatFlowers(top,.13,'pink');
   if(bloom&&!daisy&&!sedum){for(let k=0;k<(far?7:12);k++){const t=k/(far?7:12),p=top.clone().add(v(0,t*.24,0));branch(top,p,.003);for(let s=0;s<3;s++){const aa=s*2.094+k;bead(p.clone().add(v(Math.cos(aa)*.035*(1-t*.5),0,Math.sin(aa)*.035*(1-t*.5))),.018,'purple',1.4)}}}
  }
 }
 if(type==='astilbe'){
  for(let i=0;i<(far?6:10);i++){const a=angle(i),end=v(Math.cos(a)*.34,.29+rng()*.08,Math.sin(a)*.34);branch(v(),end,.004);for(let j=1;j<=4;j++){const p=end.clone().multiplyScalar(j/5);for(const s of [-1,1]){const aa=a+s*1.15;leaf(p,p.clone().add(v(Math.cos(aa)*.14,.03,Math.sin(aa)*.14)),.056,'leaf',3)}}}
  if(bloom)for(let i=0;i<5;i++){const a=angle(i),base=v(Math.cos(a)*.12,.38,Math.sin(a)*.12),end=base.clone().add(v(.035,.4,0));branch(v(),end,.004);for(let j=0;j<(far?6:10);j++){const t=j/(far?6:10),p=base.clone().lerp(end,t);for(const s of [-1,1]){const q=p.clone().add(v(s*.17*(1-t),.04,Math.sin(a)*.06));branch(p,q,.002);for(let k=0;k<(far?3:6);k++)bead(p.clone().lerp(q,k/(far?3:6)),.014,'pink')}}}
 }
 if(type==='miscanthus'||type==='carex'){
  const tall=type==='miscanthus',n=far?(tall?18:22):(tall?30:38);
  for(let i=0;i<n;i++){const a=angle(i),f=.6+rng()*.4;ribbon(a,(tall?.54:.36)*f,tall?.016:.009,(tall?1.12:.34)*f,i%4===0?'light':'leaf',v(0,.005,0))}
  if(bloom)for(let i=0;i<(tall?5:3);i++){const a=angle(i),base=v(Math.cos(a)*.12,tall?1.2:.34,Math.sin(a)*.12),end=base.clone().add(v(.07,tall?.35:.08,0));branch(v(),end,.003);for(let j=0;j<(far?5:9);j++){const t=j/(far?5:9),p=base.clone().lerp(end,t);for(const s of [-1,1]){const q=p.clone().add(v(s*(tall?.12:.025)*(1-t),tall?.08:.02,Math.sin(a)*.035));branch(p,q,.0015,'white');bead(q,tall?.012:.008,'white',1.5)}}}
 }
 if(type==='fern'){
  for(let i=0;i<(far?7:10);i++){const a=angle(i),length=.37+rng()*.09,mat=i>7?'copper':'leaf';let prev=v();
   const center=t=>v(Math.cos(a)*length*t,.58*Math.sin(t*1.9)*(.8+rng()*.05),Math.sin(a)*length*t);
   for(let j=1;j<=10;j++){const t=j/10,p=center(t);branch(prev,p,.0025,'stem');prev=p;const breadth=.14*Math.sin(Math.PI*t)*(.4+t);for(const s of [-1,1]){const aa=a+s*1.35;leaf(p,p.clone().add(v(Math.cos(aa)*breadth,.015,Math.sin(aa)*breadth)),.029,mat,2)}}
  }
 }
 if(type==='thyme'){
  for(let i=0;i<(far?8:12);i++){const a=angle(i),tip=v(Math.cos(a)*.34,.025+rng()*.03,Math.sin(a)*.34);branch(v(),tip,.0025,'bark');for(let j=1;j<=6;j++){const p=tip.clone().multiplyScalar(j/6);for(const s of [-1,1]){const aa=a+s*1.25;leaf(p,p.clone().add(v(Math.cos(aa)*.045,.012,Math.sin(aa)*.045)),.023,i%3===0?'light':'leaf')}if(bloom&&j%2===0)floret(p.clone().add(v(0,.035,0)),.018,'pink')}}
 }
 const root=new T.Group();root.name=spec.assetId;
 for(const [mat,list]of parts){if(!list.length)continue;const g=mergeGeometries(list);list.forEach(x=>x.dispose());root.add(new T.Mesh(g,materials[mat]));}
 const bounds=new T.Box3().setFromObject(root),size=bounds.getSize(v());
 // Meter anchors are invariant between foliage and flower states; do not stretch
 // the foliage to flower height when a seasonal state changes.
 const rawHeights={panicle:1.2,spirea:.66,hosta6:.78,heuchera:.72,echinacea:1.04,salvia:.86,astilbe:.87,miscanthus:1.62,carex:.44,fern:.58,sedum:.52,thyme:.095};
 const sy=spec.modelDisplayHeightM/rawHeights[type],sx=spec.modelDisplayWidthM/({panicle:.95,spirea:1.23,hosta6:.95,heuchera:.83,echinacea:.75,salvia:.75,astilbe:.95,miscanthus:1.1,carex:.74,fern:.95,sedum:.85,thyme:.78}[type]);
 root.children.forEach(m=>{m.geometry.translate(0,-bounds.min.y,0);m.geometry.scale(sx,sy,sx);m.geometry.computeBoundingBox();m.castShadow=m.receiveShadow=true;});
 root.userData={assetId:spec.assetId,assetVersion:1,variant,lod,seasonalState:season,rootAnchor:[0,0,0]};builds++;cache.set(key,root);return root;
}
export const plantModelStats=()=>({v6Prototypes:cache.size,v6Constructions:builds});

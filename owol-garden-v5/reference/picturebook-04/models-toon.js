import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {prototype as originalPrototype,modelStats as originalStats} from './models-v3.js';
import {toon,surfaces,addInk} from './toon-style.js';
import {random} from './catalog.js';
export {surfaces};
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const mats={
  canopy:toon(0xffffff,{vertexColors:true,ink:.62}),
  smallLeaf:toon(0xffffff,{vertexColors:true,side:T.DoubleSide,ink:0}),
  grass:toon(0xffffff,{vertexColors:true,side:T.DoubleSide,ink:0}),
  bark:toon(0xaf8968,{ink:.7}),stem:toon(0x83976d,{ink:0}),
  purple:toon(0xc5acd2,{ink:.45}),tip:toon(0xdfc9dd,{ink:0}),
  metal:toon(0x799284,{ink:.65}),
};
const cache=new Map();let builds=0;
function put(g,geo,mat){const m=new T.Mesh(geo,mat);m.castShadow=m.receiveShadow=true;g.add(m);return m}
function merge(g,list,mat){if(!list.length)return;const geo=mergeGeometries(list);list.forEach(x=>x.dispose());return put(g,geo,mat)}
function tint(g,c){const color=new T.Color(c),a=new Float32Array(g.attributes.position.count*3);for(let i=0;i<a.length;i+=3)a.set([color.r,color.g,color.b],i);g.setAttribute('color',new T.BufferAttribute(a,3));return g}
function limb(a,b,ra,rb,list,bend=.07){
  const middle=a.clone().lerp(b,.5).add(V(bend,0,-bend*.45));
  const path=new T.QuadraticBezierCurve3(a,middle,b),geo=new T.TubeGeometry(path,5,1,7,false),p=geo.attributes.position;
  for(let i=0;i<p.count;i++){const t=Math.floor(i/8)/5,c=path.getPoint(t),q=V().fromBufferAttribute(p,i).sub(c).multiplyScalar(T.MathUtils.lerp(ra,rb,t)).add(c);p.setXYZ(i,q.x,q.y,q.z)}
  geo.computeVertexNormals();list.push(geo);
}
// Original sculpted lobed cushions, built from rings rather than spheres.
// Off-axis peaks, low crowns and saddles give each mass a deliberate silhouette.
function crown(center,sx,sy,sz,angle,color,seed,far=false,softCore=false){
  const n=softCore?(far?24:32):(far?8:12),rows=softCore?(far?8:12):(far?3:4),positions=[],indices=[],r=random(seed),phase=r()*6.28;
  for(let j=0;j<=rows;j++){
    const t=j/rows,rad=Math.pow(Math.sin(Math.PI*t),.58);
    for(let i=0;i<=n;i++){
      const a=i/n*Math.PI*2,lobe=1+.14*Math.cos(a*3+phase)+.07*Math.sin(a*5-phase);
      const x=Math.cos(a)*rad*sx*lobe+.15*sx*Math.sin(t*Math.PI),z=Math.sin(a)*rad*sz*lobe;
      const y=(t-.5)*2*sy + .22*sy*Math.sin(a*3+phase)*rad + .12*sy*Math.cos(a)*rad;
      const p=V(x,y,z).applyAxisAngle(V(0,1,0),angle).add(center);positions.push(...p);
    }
  }
  for(let j=0;j<rows;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i,b=a+n+1;indices.push(a,b,a+1,b,b+1,a+1)}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();tint(g,color);return g;
}
// Closed folded leaves: a broad silhouette and one central ridge.
function leaf(start,direction,length,width,bend,color,turn=0,far=false,thin=false){
  const rows=far?7:10,cols=5,positions=[],indices=[],q=new T.Quaternion().setFromUnitVectors(V(0,1,0),direction.clone().normalize());
  q.multiply(new T.Quaternion().setFromAxisAngle(V(0,1,0),turn));
  const faces=thin?1:2;
  for(let face=0;face<faces;face++)for(let j=0;j<=rows;j++){
    const t=j/rows,w=Math.pow(Math.sin(Math.PI*t),.64)*width;
    for(let k=0;k<cols;k++){
      const across=(k-2)/2,arch=Math.min(.045,width*.24)*(1-across*across)*Math.sin(Math.PI*t);
      const p=V(across*w,length*(t-.09*t*t*t),bend*(.4*t*t+.6*t*t*t)+arch-(face?.014*Math.sin(Math.PI*t):0)).applyQuaternion(q).add(start);positions.push(...p);
    }
  }
  const half=(rows+1)*cols;
  for(let face=0;face<faces;face++)for(let j=0;j<rows;j++)for(let k=0;k<cols-1;k++){
    const a=face*half+j*cols+k,b=a+cols;
    if(!face)indices.push(a,a+1,b,b,a+1,b+1);else indices.push(a,b,a+1,b,b+1,a+1);
  }
  if(!thin)for(let j=0;j<rows;j++)for(const k of [0,cols-1]){
    const a=j*cols+k,b=a+cols,c=a+half,d=b+half;
    if(k===0)indices.push(a,b,c,b,d,c);else indices.push(a,c,b,b,c,d);
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();tint(g,color);return g;
}
function tree(g,r,far){
  const branches=[],twigs=[],mainLeaves=[],fillLeaves=[],cores=[],fork=V(.05,1.22,-.04);
  limb(V(),fork,.105,.055,branches,.1);
  // Seven overlapping but asymmetrical sprays. Eighteen soft interior leaves
  // and three larger accent leaves per spray; only the accents carry ink.
  const clusters=[[-.65,2.02,.12],[-.28,2.67,-.1],[.51,2.4,-.31],[.8,1.95,.34],[.2,2.96,.39],[-.58,2.36,-.58],[.02,2.16,.67]];
  const colors=[0xa9c78f,0xc2d79f,0x98baa0,0xb0cc9c];
  clusters.forEach(([x,y,z],i)=>{
    const tip=V(x,y-.06,z),joint=fork.clone().lerp(tip,.55).add(V(.05,.07,-.07));
    limb(fork,joint,.039,.023,branches,.04);limb(joint,tip,.023,.007,branches,-.04);
    cores.push(crown(V(x,y+.02,z),.34,.21,.29,i*.7,colors[i%4],72+i,far,true));
    for(let k=0;k<21;k++){
      const a=i*.7+k*2.399,accent=k>=18,ring=k%3,rad=.07+ring*.10;
      const base=tip.clone().add(V(Math.cos(a)*rad,(ring-1)*.11,Math.sin(a)*rad*.75));
      if(accent||!far)limb(tip,base,.004,.0017,twigs,.012);
      const dir=V(Math.cos(a)*.8,.35+(k%4)*.13,Math.sin(a)*.64);
      const len=(accent?.57:.40)+r()*.08,w=accent?.22:.16+r()*.025;
      const color=colors[i%4];
      (accent?mainLeaves:fillLeaves).push(leaf(base,dir,len,w,.10+r()*.05,color,a*.12,far,!accent));
    }
  });
  merge(g,branches,mats.bark);merge(g,twigs,mats.stem);merge(g,cores,mats.smallLeaf);
  merge(g,fillLeaves,mats.smallLeaf);merge(g,mainLeaves,mats.canopy);
}
function shrub(g,r,far){
  const branches=[],mainLeaves=[],fillLeaves=[],cores=[];
  for(const [x,y,z,seed,color] of [[-.15,.3,.1,21,0xa4bb83],[.16,.4,-.1,24,0xbbcf9a],[.12,.21,.25,26,0x90b18c]])cores.push(crown(V(x,y,z),.25,.18,.23,seed,color,seed,far,true));
  for(let i=0;i<10;i++){
    const a=i*2.399,outer=i>5,h=outer?.12+r()*.13:.3+r()*.23;
    const base=V(Math.sin(a)*(outer?.24:.11),h,Math.cos(a)*(outer?.24:.11));
    limb(V(0,.02,0),base,.012,.004,branches,.025);
    for(let k=0;k<6;k++){
      const angle=a+k*2.399,accent=k===5;
      (accent?mainLeaves:fillLeaves).push(leaf(base,V(Math.sin(angle),.28+(k%3)*.25,Math.cos(angle)),.3+r()*.09,.13+r()*.018,.08,[0xa4bb83,0xbbcf9a,0x90b18c][i%3],angle*.1,far,!accent));
    }
  }
  merge(g,branches,mats.stem);merge(g,cores,mats.smallLeaf);merge(g,fillLeaves,mats.smallLeaf);merge(g,mainLeaves,mats.canopy);
}
function grass(g,r,far){
  const blades=[],stems=[],heads=[];
  for(let i=0;i<18;i++){
    const a=i*2.399,sz=.045+r()*.04;
    blades.push(leaf(V(Math.sin(a)*sz,.025,Math.cos(a)*sz),V(Math.sin(a)*.26,1,Math.cos(a)*.26),.52+r()*.35,.016+r()*.011,.30+r()*.26,[0xa2b785,0xbaca99,0xced5a4,0x8fae83][i%4],a,far,true));
  }
  for(let i=0;i<3;i++){
    const a=i*2.4,top=V(Math.cos(a)*.16,.86+r()*.13,Math.sin(a)*.16);
    limb(V(0,.01,0),top,.006,.003,stems,.018);
    heads.push(crown(top,.028,.1,.025,a,0xdad0a4,i+3,far));
  }
  merge(g,blades,mats.grass);merge(g,stems,mats.stem);merge(g,heads,mats.smallLeaf);
}
function flower(g,r,far){
  const stems=[],leaves=[],blooms=[],tips=[];
  for(let i=0;i<7;i++){
    const a=i*2.4,h=.49+r()*.28,top=V(Math.sin(a)*.16,h,Math.cos(a)*.16);
    limb(V(top.x*.3,.025,top.z*.3),top,.007,.004,stems,.018);
    for(let j=0;j<4;j++){
      const p=top.clone().multiplyScalar(.2+j*.19),angle=a+j*2.3;
      leaves.push(leaf(p,V(Math.sin(angle),.4,Math.cos(angle)),.21,.068,.035,0xa0b982,angle,far,true));
    }
    // Four broad calyx tiers form one readable spire, instead of tiny beads.
    for(let j=0;j<4;j++){
      const y=h-.11+j*.075,s=.066-j*.009;
      blooms.push(crown(V(top.x,y,top.z),s,.055,s*.85,j*.7,0xffffff,8+j,far));
    }
    tips.push(crown(V(top.x,h+.18,top.z),.022,.04,.022,0,0xffffff,4,far));
  }
  merge(g,stems,mats.stem);merge(g,leaves,mats.smallLeaf);merge(g,blooms,mats.purple);merge(g,tips,mats.tip);
}
function bench(g){
  const boards=[],legs=[];
  const box=(w,h,d,x,y,z,list,rx=0)=>{const b=new RoundedBoxGeometry(w,h,d,1,.012);b.rotateX(rx);b.translate(x,y,z);list.push(b)};
  for(let i=0;i<4;i++)box(1.62,.055,.115,0,.45,-.22+i*.145,boards);
  for(let i=0;i<3;i++)box(1.62,.115,.055,0,.65+i*.135,-.29-i*.022,boards,-.12);
  for(const x of [-.61,.61]){
    box(.05,.44,.05,x,.22,.2,legs);box(.05,.44,.05,x,.22,-.22,legs);
    box(.055,.055,.56,x,.4,0,legs);box(.05,.8,.05,x,.48,-.27,legs,-.12);
  }
  merge(g,boards,surfaces.wood);merge(g,legs,mats.metal);
}
export function prototype(type,variant=0,lod='near',style='toon'){
  if(style!=='toon'||!['tree','shrub','grass','flower','bench','wood','stone','gravel'].includes(type))return originalPrototype(type,variant,lod);
  const key=`${type}:${variant}:${lod}`;if(cache.has(key))return cache.get(key);
  const g=new T.Group(),r=random(1147+variant*97),far=lod==='far';builds++;
  if(type==='tree')tree(g,r,far);if(type==='shrub')shrub(g,r,far);if(type==='grass')grass(g,r,far);if(type==='flower')flower(g,r,far);if(type==='bench')bench(g);
  if(['wood','stone','gravel'].includes(type)){
    for(const part of originalPrototype(type,variant,lod).children)put(g,part.geometry,surfaces[type]);
  }
  addInk(g);cache.set(key,g);return g;
}
export function modelStats(){const old=originalStats();return {prototypes:cache.size+old.prototypes,constructions:builds+old.constructions,artPrototypes:cache.size}}

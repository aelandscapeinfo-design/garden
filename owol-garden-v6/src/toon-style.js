import * as T from 'three';

// MeshToonMaterial + nearest-sampled gradient follows the official r186 example.
// These are linear light levels, not sRGB colour texels.
export const ramp = new T.DataTexture(new Uint8Array([55,120,185,245]),4,1,T.RedFormat);
ramp.minFilter=ramp.magFilter=T.NearestFilter;
ramp.colorSpace=T.NoColorSpace;ramp.generateMipmaps=false;ramp.needsUpdate=true;
export function toon(color, {map=null,vertexColors=false,side=T.FrontSide,ink=1.05}={}) {
  const m=new T.MeshToonMaterial({color,map,vertexColors,side,gradientMap:ramp});
  // A muted, coloured fill keeps the deepest leaf shapes green, never black.
  m.emissive.set(0x244c40);m.emissiveIntensity=.13;
  m.userData.ink=ink;
  return m;
}
export const inkViewport=new T.Vector2(1440,882);
const inkCache=new Map();
export function inkMaterial(pixels=1.05,color=0x384e43) {
  const key=`${pixels}:${color}`;
  if(inkCache.has(key))return inkCache.get(key);
  // Inverted hull principle from three.js r186 OutlineEffect (MIT).
  // Unlike that addon's calculateOutline, both projected points use the same
  // instance transform. Width is in CSS pixels, independent of DPR/distance.
  const m=new T.ShaderMaterial({
    name:'OWOL selective instanced ink',side:T.BackSide,depthWrite:true,
    uniforms:{inkViewport:{value:inkViewport},inkPixels:{value:pixels},inkColor:{value:new T.Color(color)}},
    vertexShader:`uniform vec2 inkViewport; uniform float inkPixels;
      void main(){
        vec4 local=vec4(position,1.0);vec3 n=normal;
        #ifdef USE_INSTANCING
          local=instanceMatrix*local;
          n=mat3(instanceMatrix)*n;
        #endif
        vec4 mv=modelViewMatrix*local;
        vec3 vn=normalize(normalMatrix*n);
        vec4 clip=projectionMatrix*mv;
        vec4 tip=projectionMatrix*vec4(mv.xyz+vn,1.0);
        vec2 screenDirection=(tip.xy/tip.w-clip.xy/clip.w)*inkViewport;
        float l=length(screenDirection);
        vec2 offset=l>0.00001?screenDirection/l:vec2(0.0);
        clip.xy+=offset*(2.0*inkPixels/inkViewport)*clip.w;
        clip.z+=0.000006*clip.w;
        gl_Position=clip;
      }`,
    fragmentShader:`uniform vec3 inkColor;
      void main(){gl_FragColor=vec4(inkColor,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  m.userData.isArtInk=true;inkCache.set(key,m);return m;
}
const smoothCache=new WeakMap();
function hullGeometry(geometry){
  if(smoothCache.has(geometry))return smoothCache.get(geometry);
  const g=geometry.clone(),p=g.attributes.position,n=g.attributes.normal,groups=new Map();
  // Average only the outline normals at duplicated box/leaf seams. Keep face
  // normals in the original mesh so the colour faces remain deliberate.
  for(let i=0;i<p.count;i++){
    const key=[p.getX(i),p.getY(i),p.getZ(i)].map(x=>Math.round(x*100000)).join(',');
    if(!groups.has(key))groups.set(key,{sum:new T.Vector3(),indices:[]});
    const a=groups.get(key);a.sum.add(new T.Vector3().fromBufferAttribute(n,i));a.indices.push(i);
  }
  for(const {sum,indices}of groups.values()){sum.normalize();for(const i of indices)n.setXYZ(i,sum.x,sum.y,sum.z)}
  smoothCache.set(geometry,g);return g;
}
export function addInk(root){
  for(const p of [...root.children]){
    if(!p.isMesh || !p.material.userData.ink)continue;
    const h=new T.Mesh(hullGeometry(p.geometry),inkMaterial(p.material.userData.ink));
    h.position.copy(p.position);h.quaternion.copy(p.quaternion);h.scale.copy(p.scale);
    h.userData.isArtInk=true;h.raycast=()=>{};h.renderOrder=1;root.add(h);
  }
}
export function setInkSize(renderer){const s=renderer.getSize(new T.Vector2());inkViewport.copy(s)}

const colors={soil:'#b29171',mulch:'#ad8868',gravel:'#e0d6b7',stone:'#e1d9bf',wood:'#bd956b',turf:'#8f9e68'};
// Large painted patches only; no per-pixel noise, bump, normal or roughness maps.
export function paintedTexture(kind){
  const c=document.createElement('canvas');c.width=c.height=256;
  const x=c.getContext('2d');x.fillStyle=colors[kind];x.fillRect(0,0,256,256);
  const patches=[[35,32,76,39,-.2],[182,65,89,30,.4],[105,184,100,43,-.3],[245,227,55,36,.2]];
  for(const [px,py,rx,ry,a]of patches){
    x.fillStyle=kind==='mulch'?'rgba(108,81,62,.13)':'rgba(255,248,218,.10)';
    x.beginPath();x.ellipse(px,py,rx,ry,a,0,Math.PI*2);x.fill();
  }
  x.strokeStyle=kind==='wood'?'rgba(101,76,54,.23)':'rgba(110,95,70,.14)';
  x.lineWidth=kind==='wood'?1.8:2.0;x.lineCap='round';
  const strokes=kind==='wood'?8:kind==='gravel'?15:kind==='mulch'?7:0;
  for(let i=0;i<strokes;i++){
    const px=(i*71+21)%256,py=(i*97+25)%256;
    x.beginPath();x.moveTo(px,py);
    x.quadraticCurveTo(px+(kind==='wood'?26:5),py-3,px+(kind==='wood'?67:11),py+1);x.stroke();
  }
  const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;return t;
}
export const surfaces=Object.fromEntries(Object.keys(colors).map(k=>[k,toon(0xffffff,{map:paintedTexture(k),ink:['stone','wood'].includes(k)?.85:0})]));

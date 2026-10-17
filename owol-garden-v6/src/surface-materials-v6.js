import * as T from 'three';
// Authored procedural albedo + height maps. UVs are world meters, never fitted
// to the bounding box. Bump maps are linear data; albedo is sRGB.
const palettes={soil:[112,88,64],mulch:[119,81,51],gravel:[172,166,149],stone:[186,183,167],concrete:[172,174,166],wood:[153,119,82],turf:[102,124,74]};
function hash(x,y){let n=Math.imul(x+193,374761393)^Math.imul(y+937,668265263);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967296;}
function noise(x,y,n){const xx=x*n,yy=y*n,ix=Math.floor(xx),iy=Math.floor(yy),u=xx-ix,w=yy-iy,s=u*u*(3-2*u),t=w*w*(3-2*w),h=(a,b)=>hash((a+n)%n,(b+n)%n);return T.MathUtils.lerp(T.MathUtils.lerp(h(ix,iy),h(ix+1,iy),s),T.MathUtils.lerp(h(ix,iy+1),h(ix+1,iy+1),s),t);}
function cells(x,y,n){const X=x*n,Y=y*n,ix=Math.floor(X),iy=Math.floor(Y);let first=1e3,second=1e3,id=0;for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const h=hash((ix+a+n)%n,(iy+b+n)%n),j=hash((iy+b+n)%n,(ix+a+n)%n),dx=ix+a+.15+h*.7-X,dy=iy+b+.15+j*.7-Y,d=dx*dx+dy*dy;if(d<first){second=first;first=d;id=h}else second=Math.min(second,d)}return {d:Math.sqrt(first),edge:Math.sqrt(second)-Math.sqrt(first),id};}
function maps(kind){const N=256,color=new Uint8Array(N*N*4),height=new Uint8Array(N*N*4),base=palettes[kind];
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){const x=i/N,y=j/N,coarse=noise(x,y,5),medium=noise(x,y,23),fine=noise(x,y,89),p=(j*N+i)*4;let light=1,h=.5;
  if(kind==='soil'){h=.22+medium*.3+fine*.2+coarse*.12;light=.85+coarse*.15+medium*.15+fine*.09;}
  if(kind==='mulch'){const c=cells(x*2,y,23);h=T.MathUtils.smoothstep(c.edge,0,.16)*(.4+c.id*.35);light=.66+c.id*.43+medium*.10;}
  if(kind==='gravel'){const c=cells(x,y,31);h=T.MathUtils.smoothstep(c.edge,0,.18)*(.45+c.id*.3);light=.72+c.id*.35+T.MathUtils.smoothstep(c.edge,0,.10)*.15;}
  if(kind==='turf'){const blade=noise(x*7,y,41);h=.4+blade*.23;light=.82+coarse*.13+blade*.15;}
  if(kind==='stone'){h=.35+medium*.16+fine*.10;light=.87+coarse*.10+medium*.08+fine*.05;}
  if(kind==='concrete'){h=.4+fine*.12;light=.94+medium*.035+fine*.04;}
  if(kind==='wood'){const grain=Math.sin(y*220+noise(x,y,7)*7+noise(x,y,17)*2)*.5+.5;h=.35+grain*.19;light=.80+grain*.18+medium*.07;}
  for(let c=0;c<3;c++){color[p+c]=Math.min(255,Math.round(base[c]*light));height[p+c]=Math.round(h*255)}color[p+3]=height[p+3]=255;
 }
 const tex=(data,space)=>{const m=new T.DataTexture(data,N,N,T.RGBAFormat);m.colorSpace=space;m.wrapS=m.wrapT=T.RepeatWrapping;m.magFilter=T.LinearFilter;m.minFilter=T.LinearMipmapLinearFilter;m.generateMipmaps=true;m.anisotropy=4;m.needsUpdate=true;return m};
 return {map:tex(color,T.SRGBColorSpace),bumpMap:tex(height,T.NoColorSpace)};
}
const common=`
varying vec2 surfaceWorld; varying float surfaceUp;
uniform float surfaceSeed, surfaceModule, surfaceRotation, surfaceJoint, surfacePattern;
float rnd(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+surfaceSeed*.013)*43758.5453);}
vec2 site(vec2 p){return vec2(rnd(p),rnd(p+vec2(43.7,19.1)))*.72+.14;}
// Euclidean Voronoi cells with straight shared borders: closed irregular slabs.
vec2 flagstone(vec2 q){
 vec2 cell=floor(q),local=fract(q),nearest=vec2(0.),offset=vec2(0.);float best=100.;
 for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){vec2 c=vec2(float(x),float(y)),d=c+site(cell+c)-local;float dd=dot(d,d);if(dd<best){best=dd;nearest=c;offset=d;}}
 float edge=100.;
 for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){vec2 c=nearest+vec2(float(x),float(y)),d=c+site(cell+c)-local;vec2 delta=d-offset;if(dot(delta,delta)>.00001)edge=min(edge,dot((offset+d)*.5,normalize(delta)));}
 return vec2(edge,rnd(cell+nearest));
}
`;
const shared=new Map();
export function surfaceMaterial(kind='soil',options={}){
 if(!palettes[kind])throw Error('Unknown surface material '+kind);
 const reusable=!Object.keys(options).length,key=kind;if(reusable&&shared.has(key))return shared.get(key);
 const source=surfaceMaps[kind],mat=new T.MeshStandardMaterial({color:0xffffff,...source,roughness:kind==='wood'?.88:.97,metalness:0,bumpScale:{soil:.014,mulch:.024,gravel:.022,stone:.005,concrete:.003,wood:.006,turf:.009}[kind]});
 mat.name='OWOL V6 '+kind;mat.userData={surfaceMaterialId:kind,worldScaleM:1,seed:options.seed??3107,ownedByComposition:!reusable};
 mat.customProgramCacheKey=()=> 'owol-v6-surface-'+kind;
 mat.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,{surfaceSeed:{value:options.seed??3107},surfaceModule:{value:options.moduleM??.6},surfaceRotation:{value:(options.direction??0)*Math.PI/180},surfaceJoint:{value:options.jointWidthM??.012},surfacePattern:{value:{regular:1,irregular:2,blocks:3,deck:4,continuous:0}[options.pattern]??0}});
  shader.vertexShader='varying vec2 surfaceWorld; varying float surfaceUp;uniform float surfaceSeed;uniform float surfaceRotation;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   surfaceWorld=(modelMatrix*vec4(transformed,1.)).xz;surfaceUp=normal.y;
   vec2 materialUv=${kind==='wood'?'mat2(cos(surfaceRotation),-sin(surfaceRotation),sin(surfaceRotation),cos(surfaceRotation))*':''}surfaceWorld+vec2(fract(surfaceSeed*.137),fract(surfaceSeed*.267));
   #ifdef USE_MAP
    vMapUv=materialUv;
   #endif
   #ifdef USE_BUMPMAP
    vBumpMapUv=materialUv;
   #endif
  `);
  shader.fragmentShader=common+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   vec2 q=mat2(cos(surfaceRotation),-sin(surfaceRotation),sin(surfaceRotation),cos(surfaceRotation))*surfaceWorld;
   float edge=100.;float identity=rnd(floor(q*7.));
   if(surfacePattern>1.5&&surfacePattern<2.5){vec2 slab=flagstone(q/surfaceModule);edge=slab.x*surfaceModule;identity=slab.y;}
   else if(surfacePattern>.5){float row=floor(q.y/surfaceModule);float moduleX=surfaceModule*(surfacePattern>3.5?12.:surfacePattern>2.5?.6:1.5);float shift=surfacePattern>2.5&&surfacePattern<3.5?mod(row,2.)*.5:0.;vec2 cell=vec2(q.x/moduleX+shift,q.y/surfaceModule);vec2 border=min(fract(cell),1.-fract(cell))*vec2(moduleX,surfaceModule);edge=surfacePattern>3.5?min(border.y,border.x):min(border.x,border.y);identity=rnd(floor(cell));}
   float antialias=max(fwidth(q.x),fwidth(q.y));
   float joint=(1.-smoothstep(surfaceJoint*.4,surfaceJoint*.5+antialias,edge))*step(.8,surfaceUp);
   float slabTone=surfacePattern>.5?.94+identity*.11:1.;
   diffuseColor.rgb*=slabTone;
   diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*.47,joint);
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
#ifdef USE_BUMPMAP
if(surfacePattern>.5){normal=perturbNormalArb(-vViewPosition,normal,vec2(dFdx(-joint*.005),dFdy(-joint*.005)),faceDirection);}
#endif`);
 };
 if(reusable)shared.set(key,mat);return mat;
}
const surfaceMaps=Object.fromEntries(Object.keys(palettes).map(kind=>[kind,maps(kind)]));
export const v6Surfaces=Object.fromEntries(Object.keys(palettes).map(kind=>[kind,surfaceMaterial(kind)]));
export const surfaceSpecification=()=>Object.keys(palettes).map(kind=>({materialId:kind,colorSpace:'sRGB',heightColorSpace:'linear',metersPerTile:1,roughness:v6Surfaces[kind].roughness,bumpScale:v6Surfaces[kind].bumpScale,externalAssets:false,textureResolution:256}));

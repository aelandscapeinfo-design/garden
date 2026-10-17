import {v6Surfaces as surfaces,surfaceMaterial} from './surface-materials-v6.js';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {toon,addInk} from './toon-style.js';
import {surfaces as v3Surfaces} from './models-v3.js';
import {renderStyle} from './visual-profile.js';
import {activeGeometry} from './composition-state.js';
import {buildingGeometry} from './building-geometry.js';
import {fromRing,union,difference,intersection,contains} from './region-geometry.js';
import {rect} from './scene-config.js';
const plaster=toon(0xe4ddc0,{ink:1}),cap=toon(0xeee5ca,{ink:.8}),metal=toon(0x536557,{ink:.65}),terra=toon(0xac8568,{ink:.7}),doorMaterial=toon(0x6e9184,{ink:0});
const outside=new T.MeshBasicMaterial({color:0xf0ede2}),shadow=new T.ShadowMaterial({color:0x78846b,opacity:.19});
const uv=g=>{const p=g.attributes.position,u=g.attributes.uv;for(let i=0;i<p.count;i++)u?.setXY(i,p.getX(i),p.getZ(i));return g};
export function regionMesh(geometry,height,material,y=0){
 const shapes=geometry.map(p=>{const shape=new T.Shape(p[0].map(([x,z])=>new T.Vector2(x,-z)));for(const hole of p.slice(1))shape.holes.push(new T.Path(hole.map(([x,z])=>new T.Vector2(x,-z))));return shape});
 const geo=new T.ExtrudeGeometry(shapes,{depth:height,steps:1,bevelEnabled:false});geo.rotateX(-Math.PI/2);uv(geo);
 const mesh=new T.Mesh(geo,material);mesh.position.y=y;mesh.castShadow=mesh.receiveShadow=true;return mesh;
}
export function makeCompositionTerrain(scene,initial){
 const root=new T.Group();root.name='composition-terrain';scene.add(root);let config=initial,builds=0;
 const cache=new Map();
 const dispose=g=>g.traverse(o=>{o.geometry?.dispose();if(o.material?.userData.ownedByComposition)o.material.dispose()});
 function update(c){
  config=c;const a=c.composition,mats=renderStyle(c)==='toon'?surfaces:v3Surfaces,entries=new Map();
  const put=(id,key,make)=>entries.set(id,{key:JSON.stringify(key),make});
  put('base',[c.widthM,c.depthM,c.seed,a.baseFloor,c.visualProfileId,a.regions.map(r=>r.geometry),a.buildings],()=>{
   const g=new T.Group(),body=new T.Mesh(new T.BoxGeometry(c.widthM+.05,.15,c.depthM+.05),plaster);body.position.y=-.08;body.receiveShadow=true;g.add(body);
   const baseGeometry=difference(fromRing(c.boundary),...a.regions.map(r=>activeGeometry(c,r)),...a.buildings.map(b=>buildingGeometry(b).geometry));
   const floor=regionMesh(baseGeometry,.012,renderStyle(c)==='toon'?surfaceMaterial(a.baseFloor,{seed:c.seed}):mats[a.baseFloor]);floor.name='measured-site-surface';g.add(floor);
   for(const [mat,y]of [[outside,-.17],[shadow,-.169]]){const m=new T.Mesh(new T.PlaneGeometry(160,160),mat);m.rotation.x=-Math.PI/2;m.position.y=y;m.receiveShadow=mat===shadow;g.add(m)}
   return g;
  });
  for(const r of a.regions){const geometry=activeGeometry(c,r);put('region:'+r.id,[r,a.buildings,c.visualProfileId],()=>{
   const g=new T.Group();if(!geometry.length)return g;
   const material=r.kind==='planting'?(r.surfaceMaterialId||'soil'):r.kind==='lawn'?'turf':r.material;
   const m=regionMesh(geometry,r.kind==='planting'?.03:r.kind==='lawn'?.04:.045,renderStyle(c)==='toon'?surfaceMaterial(material,{seed:r.seed,pattern:r.kind==='paving'?r.pattern:'continuous',moduleM:r.moduleM,direction:r.direction,jointWidthM:r.jointWidthM}):(mats[material]||mats.stone));m.name=(r.kind==='planting'?'planting-surface:':'region-surface:')+r.id;g.add(m);
   return g;
  })}
  for(const p of a.planters)put('planter:'+p.id,[p,c.visualProfileId],()=>{
   const g=new T.Group(),m=regionMesh(p.geometry,p.height,renderStyle(c)==='toon'?surfaceMaterial(p.surfaceMaterialId||'soil',{seed:p.seed}):mats.soil);m.name='planting-surface:'+p.id;g.add(m);
   const edges=[];for(const poly of p.geometry)for(const ring of poly)for(let i=0;i<ring.length-1;i++){const [x,z]=ring[i],[xx,zz]=ring[i+1],geo=new T.BoxGeometry(Math.hypot(xx-x,zz-z),p.height+.04,.04);geo.rotateY(-Math.atan2(zz-z,xx-x));geo.translate((x+xx)/2,(p.height+.04)/2,(z+zz)/2);edges.push(geo)}
   if(edges.length){g.add(new T.Mesh(mergeGeometries(edges),terra));edges.forEach(x=>x.dispose())}addInk(g);return g;
  });
  for(const b of a.buildings)put('building:'+b.id,b,()=>{
   const g=new T.Group(),v=buildingGeometry(b);g.add(regionMesh(v.geometry,b.height,plaster));g.add(regionMesh(v.geometry,.07,cap,b.height));
   const d=v.door,door=new T.Mesh(new T.BoxGeometry(d.width,d.height,.045),doorMaterial);door.position.set(d.x+d.normal[0]*.03,d.height/2,d.z+d.normal[1]*.03);door.rotation.y=Math.atan2(d.normal[0],d.normal[1]);door.name='door:'+b.id;g.add(door);addInk(g);return g;
  });
  for(const w of a.fixed.walls)put('fixed:'+w.id,w,()=>{const g=new T.Group(),m=new T.Mesh(new T.BoxGeometry(w.w,w.height,w.d),w.style==='slats'?mats.wood:plaster);m.position.set(w.x,w.y??w.height/2,w.z);m.castShadow=m.receiveShadow=true;g.add(m);addInk(g);return g});
  for(const [id,old]of cache)if(!entries.has(id)||entries.get(id).key!==old.key){root.remove(old.group);dispose(old.group);cache.delete(id)}
  for(const [id,e]of entries)if(!cache.has(id)){const group=e.make();group.name=id;root.add(group);cache.set(id,{key:e.key,group});builds++}
 }
 let paintKey='';
 function sync(items){const paint=items.filter(i=>i.type==='gravel'),key=JSON.stringify(paint);if(key===paintKey)return;paintKey=key;
  const old=root.getObjectByName('individual-gravel');if(old){root.remove(old);dispose(old)}if(!paint.length)return;
  const geos=paint.map(i=>fromRing(Array.from({length:24},(_,n)=>{const a=n/24*Math.PI*2;return[i.x+Math.cos(a)*.46*(i.sx||i.scale||1),i.z+Math.sin(a)*.46*(i.sz||i.scale||1)]})));
  const geometry=intersection(union(...geos),fromRing(config.boundary)),m=regionMesh(geometry,.055,surfaces.gravel);m.name='individual-gravel';root.add(m);
 }
 update(initial);
 return {root,composition:true,update,sync,dispose:()=>{root.parent?.remove(root);dispose(root)},stats:()=>({terrainRebuilds:builds,terrainBounds:{widthM:config.widthM,depthM:config.depthM},buildings:config.composition.buildings.length,groundRegions:config.composition.regions.length,walls:config.walls.length,plantableZones:config.plantableZones.length})};
}

import * as T from "three";
import {prototype} from "./models.js";
import {CATALOG} from "./catalog.js";
const reviewed = new Set(["tree","shrub","grass","flower","gravel","stone","wood","bench"]);
export function assetReport(){
 return Object.keys(CATALOG).map(type=>{
  const art=reviewed.has(type),levels={};
  for(const lod of ["near","far"]){
   const root=prototype(type,0,lod),bounds=new T.Box3().setFromObject(root),size=bounds.getSize(new T.Vector3());
   let surfaceTriangles=0,inkTriangles=0;
   root.traverse(o=>{if(o.geometry){const n=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;o.userData.isArtInk?inkTriangles+=n:surfaceTriangles+=n;}});
   levels[lod]={surfaceTriangles,inkTriangles,totalTriangles:surfaceTriangles+inkTriangles,boundsM:size.toArray().map(x=>+x.toFixed(3))};
  }
  return {id:(art?"owol-art-01-":"owol-v3-")+type,type,reviewedForArtStudy:art,source:art?"src/models-toon.js":"src/models-v3.js",thirdPartyArtwork:false,botanicalDataVerified:false,material:art?"MeshToonMaterial / 4-level nearest gradient; selective ink":"V3 original MeshStandardMaterial",textures:art?"256×256 painted surface maps, no normal/roughness maps":"V3 original procedural textures",levels};
 });
}

import {prototype as legacyPrototype,modelStats as legacyStats} from './models-toon.js';
import {plantPrototype,plantModelStats} from './plant-models-v6.js';
import {PLANTS_V6} from './plant-library-v6.js';
export {v6Surfaces as surfaces} from './surface-materials-v6.js';
export function prototype(type,variant=0,lod='near',style='toon',reference={}){
 if(PLANTS_V6[type]){
  const p=PLANTS_V6[type];
  if(reference.assetId&&reference.assetId!==p.assetId||reference.assetVersion&&reference.assetVersion!==p.assetVersion)throw Error('지원하지 않는 식물 자산 참조입니다.');
  return plantPrototype(type,variant,lod,reference.seasonalState||'foliage');
 }
 return legacyPrototype(type,variant,lod,style);
}
export const modelStats=()=>{const old=legacyStats(),next=plantModelStats();return {...old,...next,prototypes:old.prototypes+next.v6Prototypes,constructions:old.constructions+next.v6Constructions}};

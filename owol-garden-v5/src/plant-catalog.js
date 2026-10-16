import {CATALOG} from './catalog.js';
import {V4_PROFILE,V3_PROFILE} from './visual-profile.js';
const traits={
 tree:['tree','green','', 'medium',['airy','multi-stem']],
 shrub:['shrub','dark-green','','medium',['dense','rounded']],
 grass:['herb','green','','fine',['grass-like','upright']],
 flower:['herb','green','purple','fine',['flowering','upright']],
 hosta:['herb','green','','coarse',['broad-leaf','clump']],
 meadow:['herb','green','white','fine',['flowering','airy']],
 cover:['herb','green','','fine',['groundcover','spreading']],
};
export const ARCHETYPES=Object.fromEntries(Object.entries(traits).map(([type,[growth,leafColor,flowerColor,texture,visualTraits]])=>[type,{
 id:'owol-form-'+type,type,name:CATALOG[type].name,status:'illustrative',primaryGrowthForm:growth,additionalGrowthForms:[],visualTraits,leafColor,flowerColor,texture,
 leafPersistence:'unknown',herbWinterState:'unknown',botanicalTags:[],light:null,moisture:null,matureHeightM:null,modelHeightM:CATALOG[type].height,
 assets:{[V3_PROFILE]:'owol-v3-'+type,...(['tree','shrub','grass','flower'].includes(type)?{[V4_PROFILE]:'owol-toon-02-'+type}:{})},
}]))
export const VERIFIED_PLANTS=[];
export function filterPlants(filters={},profile=V4_PROFILE){return Object.values(ARCHETYPES).filter(p=>p.assets[profile]&&(!filters.growth||[p.primaryGrowthForm,...p.additionalGrowthForms].includes(filters.growth))&&(!filters.leaf||p.leafColor===filters.leaf)&&(!filters.flower||p.flowerColor===filters.flower)&&(!filters.texture||p.texture===filters.texture)&&(!filters.height||(filters.height==='low'?p.modelHeightM<1:p.modelHeightM>=1))&&(!filters.search||[p.name,...p.visualTraits].join(' ').toLowerCase().includes(filters.search.toLowerCase()))&&(filters.tags||[]).every(t=>[...p.visualTraits,...p.botanicalTags].includes(t)))}
export const itemReference=(type,profile)=>({catalogId:ARCHETYPES[type]?.id||'owol-object-'+type,assetId:ARCHETYPES[type]?.assets[profile]||ARCHETYPES[type]?.assets[V3_PROFILE]||'owol-'+(profile===V4_PROFILE?'toon-02':'v3')+'-'+type});
export function referenceValid(i){
 if(!CATALOG[i.type])return false;
 if(i.catalogId===undefined&&i.assetId===undefined)return true;
 const p=ARCHETYPES[i.type];return i.catalogId===(p?.id||'owol-object-'+i.type)&&(p?Object.values(p.assets).includes(i.assetId):[V4_PROFILE,V3_PROFILE].some(profile=>itemReference(i.type,profile).assetId===i.assetId));
}

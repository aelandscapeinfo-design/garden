import {decode as decodeV4,validateItem} from './persistence-v4.js';
import {CATALOG} from './catalog.js';
import {derive,validateComposition} from './composition-state.js';
import {visualProfile,V4_PROFILE,V3_PROFILE} from './visual-profile.js';
import {placementError} from './rules.js';
import {referenceValid} from './plant-catalog.js';
export {validateItem};
export const STORAGE_KEY='owol-garden-composition-v5';
const clone=x=>structuredClone(x);
const fields=['id','type','x','z','r','scale','variant','sx','sz','catalogId','assetId'];
const clean=i=>Object.fromEntries(fields.filter(k=>i[k]!==undefined).map(k=>[k,i[k]]));
export function encode({config,items,pending,profile,wish,camera}){
 return {version:5,documentVersion:5,sceneSchemaVersion:config.composition?5:3,catalogVersion:1,visualProfileId:visualProfile(config),sceneConfig:config,items,pending,profile,wish,camera,metadata:{purpose:'garden-preference-study',plantModelData:'visual-only',botanicalDatabaseConnected:false,representsRealSite:false}};
}
function validateCamera(v){
 if(!v)return null;
 if(!['position','target'].every(k=>Array.isArray(v[k])&&v[k].length===3&&v[k].every(x=>Number.isFinite(x)&&Math.abs(x)<100))||v.position[1]<.2||v.position[1]>80||Math.hypot(...v.position.map((x,i)=>x-v.target[i]))<.5||!['edit','browse','entrance','seat'].includes(v.view))throw Error('카메라 상태가 올바르지 않습니다.');
 return clone(v);
}
export function decode(raw){
 const d=typeof raw==='string'?JSON.parse(raw):clone(raw);
 if([2,3,4].includes(d?.version)){const old=decodeV4(d);return {...old,version:5,documentVersion:5,catalogVersion:1,visualProfileId:visualProfile(old.sceneConfig),migratedFrom:d.version}}
 if(!d||d.version!==5||d.documentVersion!==5||d.catalogVersion!==1||![V4_PROFILE,V3_PROFILE].includes(d.visualProfileId))throw Error('지원하지 않는 저장 버전 또는 미술 프로필입니다.');
 const q=d.sceneConfig;let c;
 if(q?.composition){
  if(q.schemaVersion!==5||d.sceneSchemaVersion!==5||q.visualProfileId!==d.visualProfileId)throw Error('공간과 미술 프로필이 일치하지 않습니다.');
  const candidate={presetId:q.presetId,widthM:q.widthM,depthM:q.depthM,seed:q.seed,boundary:q.boundary,visualProfileId:d.visualProfileId,composition:q.composition};
  // Boundary/derived render arrays are rebuilt only from the user's validated dimensions.
  const canonical=derive(candidate);validateComposition(canonical);c=canonical;
 }else{
  if(q?.schemaVersion!==3||d.sceneSchemaVersion!==3)throw Error('기존 공간 저장 형식을 확인해주세요.');
  c=decodeV4({...d,version:4}).sceneConfig;
  if(q.visualProfileId)c.visualProfileId=d.visualProfileId;
 }
 if(!Array.isArray(d.items)||!Array.isArray(d.pending)||d.items.length+d.pending.length>300)throw Error('요소 수는 300개 이내여야 합니다.');
 const ids=new Set(),items=[],pending=[];
 for(const [list,isPending]of [[d.items,false],[d.pending,true]])for(const entry of list){
  const i=isPending?entry?.item:entry;
  if(!i||typeof i.type!=='string'||i.type.length>80||!validateItem({...i,type:CATALOG[i.type]?i.type:'grass'})||ids.has(i.id)||['catalogId','assetId'].some(k=>i[k]!==undefined&&(typeof i[k]!=='string'||i[k].length>100)))throw Error('중복 ID 또는 잘못된 배치 데이터입니다.');
  ids.add(i.id);const item=clean(i),known=referenceValid(i);
  if(isPending||!known)pending.push({item,reason:!known?'모델 또는 카탈로그 참조를 확인할 수 없어 원본을 보관합니다.':typeof entry.reason==='string'?entry.reason.slice(0,160):'자리를 찾아주세요.'});else items.push(item);
 }
 if(c.composition)for(const i of items)if(placementError(i,items,c))throw Error('구성 영역과 배치가 일치하지 않습니다.');
 return {version:5,documentVersion:5,catalogVersion:1,visualProfileId:d.visualProfileId,sceneConfig:c,items,pending,profile:Object.fromEntries(['space','size','sun','mood'].map(k=>[k,typeof d.profile?.[k]==='string'?d.profile[k].slice(0,80):'모르겠어요'])),wish:typeof d.wish==='string'?d.wish.slice(0,120):'',camera:validateCamera(d.camera)};
}
export function readSlot(key=STORAGE_KEY){const raw=localStorage.getItem(key);if(!raw)throw Error('저장한 정원이 없습니다.');return decode(raw)}
export function writeSlot(data,key=STORAGE_KEY){decode(data);localStorage.setItem(key,JSON.stringify({...data,savedAt:Date.now()}))}
export function readLatest(){
 const candidates=[];let invalid=false;
 for(const key of [STORAGE_KEY,STORAGE_KEY+'-recovery']){
  try{const raw=localStorage.getItem(key);if(raw){const source=JSON.parse(raw),data=decode(source);candidates.push({data,time:Number.isFinite(source.savedAt)?source.savedAt:0})}}catch{invalid=true}
 }
 candidates.sort((a,b)=>b.time-a.time);
 return {data:candidates[0]?.data||null,invalid};
}


import * as T from 'three';
import {zoneControls,withZones,validateZones} from './zone-state.js';
import {effectiveOutline,pointInside,pointSegmentDistance,area} from './zone-geometry.js';
import {relocate} from './rules.js';
const $=s=>document.querySelector(s),copy=x=>structuredClone(x),NS='http://www.w3.org/2000/svg';
export function createZoneEditor({engine,getState,onApply,onClose,toast}){
 const host=engine.host,canvas=engine.renderer.domElement,studio=$('#studio');
 const overlay=document.createElementNS(NS,'svg');overlay.id='zone-overlay';overlay.setAttribute('aria-hidden','true');host.append(overlay);
 const panel=document.createElement('aside');panel.id='zone-panel';panel.hidden=true;
 panel.innerHTML=`<div class="zone-heading"><strong>식재 영역 편집</strong><select id="zone-list" aria-label="편집할 식재 영역"></select><button id="zone-cancel">취소 ×</button></div>
 <div class="zone-tools"><button data-zone-mode="point" class="active">점 옮기기</button><button data-zone-mode="add">변에 점 추가</button><button id="zone-point-delete">점 삭제</button><button data-zone-mode="move">전체 이동</button><button id="zone-new">새 영역</button><button id="zone-delete">영역 삭제</button></div>
 <div class="zone-settings"><label><input id="zone-snap" type="checkbox" checked> 0.25 m 스냅</label><label>모서리 <select id="zone-round"><option value="0">직선</option><option value="0.15">조금 둥글게</option><option value="0.3">둥글게</option><option value="0.4">더 둥글게</option></select></label><label id="zone-height-label">높이 <input id="zone-height" type="number" min=".15" max=".8" step=".05"> m</label><span>크기 <button id="zone-smaller">−10%</button><button id="zone-larger">+10%</button></span></div>
 <div class="zone-status"><span id="zone-area"></span><span id="zone-reason" role="status"></span></div><div id="zone-impact"></div>
 <div class="zone-actions"><button id="zone-undo">↶ 되돌리기</button><button id="zone-redo">↷ 다시 실행</button><button id="zone-finish" hidden>윤곽 닫기</button><button id="zone-apply" class="primary">변경 적용</button></div>
 <small>3–32점 · 점 간격 ≥ 0.15 m · 면적 ≥ 0.12 m² · 보존 공간과 0.02 m 간격. 손을 놓으면 지면을 미리봅니다.</small>`;
 studio.append(panel);
 let savedHint='',active=false,base=null,draft=[],selected=null,vertex=-1,mode='point',drawing=null,drag=null,pointers=new Set(),multi=false,history=[],future=[];
 const selectedZone=()=>draft.find(z=>z.id===selected);
 const serial=()=>JSON.stringify(draft);
 const error=()=>validateZones(base.config,draft,base.items);
 const state=()=>({active,selected,vertex,mode,drawing:copy(drawing),zones:copy(draft),past:history.length,future:future.length,error:active?error():null});
 const project=(p,y)=>{const v=new T.Vector3(p[0],y,p[1]).project(engine.camera),r=canvas.getBoundingClientRect();return [(v.x+1)*r.width/2,(1-v.y)*r.height/2]};
 const at=(e,y)=>{const r=canvas.getBoundingClientRect(),ray=new T.Raycaster(),p=new T.Vector3();ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),engine.camera);if(!ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),-y),p))return null;const snap=$('#zone-snap').checked;return [p.x,p.z].map(v=>snap?Math.round(v*4)/4:+v.toFixed(3))};
 const svg=(tag,attrs)=>{const n=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);overlay.append(n);return n};
 function draw(){
  overlay.replaceChildren();if(!active)return;
  const r=canvas.getBoundingClientRect();overlay.setAttribute('viewBox',`0 0 ${r.width} ${r.height}`);
  for(const z of draft){const chosen=z.id===selected,poly=effectiveOutline(z.points,z.rounding),points=poly.map(p=>project(p,z.height+.055).join(',')).join(' ');svg('polygon',{points,fill:chosen?'#72926428':'#7292640c',stroke:chosen&&error()?'#b3624a':chosen?'#486846':'#879779','stroke-width':chosen?2.5:1.2,'stroke-dasharray':chosen?'':'5 4'});
   if(chosen)z.points.forEach((p,i)=>{const [cx,cy]=project(p,z.height+.055);svg('circle',{cx,cy,r:i===vertex?8:6,fill:i===vertex?'#486846':'#f4f2ea',stroke:'#486846','stroke-width':2,'data-zone-handle':i});});
  }
  if(drawing?.length)svg('polyline',{points:drawing.map(p=>project(p,.08).join(',')).join(' '),fill:'none',stroke:'#486846','stroke-width':2,'stroke-dasharray':'5 4'});
 }
 engine.onAfterDraw=draw;
 function refresh(rebuild=false){
  if(!active)return;
  const z=selectedZone(),err=error();
  $('#zone-list').replaceChildren(...draft.map((z,i)=>{const o=document.createElement('option');o.value=z.id;o.textContent=`${z.kind==='planter'?'플랜터':'화단'} ${i+1} · ${area(effectiveOutline(z.points,z.rounding)).toFixed(2)} m²`;return o}));
  $('#zone-list').value=selected||'';
  $('#zone-area').textContent=`선택 영역 ${z?area(effectiveOutline(z.points,z.rounding)).toFixed(2):'0'} m² / 전체 부지 ${base.config.widthM*base.config.depthM} m²`;
  $('#zone-reason').textContent=drawing?'정원에 꼭짓점을 순서대로 탭하고 윤곽을 닫아주세요.':err||'유효한 윤곽입니다. 식물 좌표는 그대로 유지합니다.';$('#zone-reason').classList.toggle('invalid',!!err);
  const target=withZones(base.config,draft),impact=err?null:relocate(base.items,target);
  $('#zone-impact').textContent=impact?`${base.items.length}개 중 ${impact.items.length}개 유지 · ${impact.pending.length}개는 적용 시 이동 대기함에 보관`:'현재 지면은 마지막 유효한 미리보기입니다. 윤곽을 조정해주세요.';
  $('#zone-apply').disabled=!!err||!!drawing||serial()===JSON.stringify(zoneControls(base.config));$('#zone-finish').hidden=!drawing;
  $('#zone-round').disabled=!z;$('#zone-round').value=z?.rounding??0;
  $('#zone-height-label').hidden=z?.kind!=='planter';$('#zone-height').value=z?.height??.4;
  $('#zone-point-delete').disabled=!z||vertex<0||z.points.length<=3;
  $('#zone-delete').disabled=!z;$('#zone-smaller').disabled=$('#zone-larger').disabled=!z;
  $('#zone-undo').disabled=!history.length;$('#zone-redo').disabled=!future.length;
  panel.querySelectorAll('[data-zone-mode]').forEach(b=>b.classList.toggle('active',b.dataset.zoneMode===mode));
  if(rebuild&&!err&&!drawing){engine.setConfig(target,false);engine.sync(base.items,null);}
  draw();
 }
 function record(before){if(before!==serial()){history.push(before);if(history.length>80)history.shift();future=[];}refresh(true)}
 function mutate(fn){const before=serial(),z=selectedZone();if(z)z.origin='custom';fn(z);record(before)}
 function rollbackDrag(){if(drag){draft=JSON.parse(drag.before);drag=null;refresh(true)}}
 function finish(apply=false){
  if(!active)return;rollbackDrag();
  const next=withZones(base.config,draft);active=false;panel.hidden=true;overlay.replaceChildren();studio.classList.remove('zone-editing');$('#camera-hint').textContent=savedHint;for(const id of pointers)if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);pointers.clear();multi=false;drawing=null;
  if(apply)onApply(next,relocate(base.items,next));
  else {engine.setConfig(base.config,false);engine.sync(base.items,null);onClose();}
 }
 const editor={get active(){return active},state,
  open(){if(active)return;if(getState().config.presetId==='legacy')return toast('이전 8 × 8 공간은 보존됩니다. 공간을 바꾼 뒤 영역을 편집해주세요.');base=copy(getState());draft=zoneControls(base.config);selected=draft[0]?.id;vertex=-1;history=[];future=[];mode='point';drawing=null;active=true;savedHint=$('#camera-hint').textContent;$('#camera-hint').textContent=matchMedia('(pointer: coarse)').matches?'점 드래그로 윤곽 수정 · 카메라는 둘러보기에서':'점 드래그로 윤곽 수정 · 우드래그 회전 · 중드래그 이동 · 휠 확대';panel.hidden=false;studio.classList.add('zone-editing');refresh();},
  cancel(){finish(false)},
  undo(){if(!active||!history.length)return;rollbackDrag();future.push(serial());draft=JSON.parse(history.pop());selected=draft.some(z=>z.id===selected)?selected:draft[0]?.id;vertex=-1;drawing=null;refresh(true)},
  redo(){if(!active||!future.length)return;rollbackDrag();history.push(serial());draft=JSON.parse(future.pop());selected=draft.some(z=>z.id===selected)?selected:draft[0]?.id;vertex=-1;refresh(true)},
 };
 $('#zone-cancel').onclick=()=>finish(false);$('#zone-apply').onclick=()=>{if(!error()&&!drawing)finish(true)};
 $('#zone-list').onchange=e=>{selected=e.target.value;vertex=-1;refresh()};
 panel.querySelectorAll('[data-zone-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.zoneMode;drawing=null;refresh()});
 $('#zone-round').onchange=e=>mutate(z=>{if(z)z.rounding=+e.target.value});
 $('#zone-height').onchange=e=>mutate(z=>{if(z)z.height=+e.target.value});
 $('#zone-snap').onchange=()=>refresh();
 $('#zone-point-delete').onclick=()=>{if(selectedZone()?.points.length>3&&vertex>=0)mutate(z=>{z.points.splice(vertex,1);vertex=-1})};
 $('#zone-delete').onclick=()=>mutate(()=>{draft=draft.filter(z=>z.id!==selected);selected=draft[0]?.id;vertex=-1});
 for(const [id,scale]of [['#zone-smaller',.9],['#zone-larger',1.1]])$(id).onclick=()=>mutate(z=>{if(!z)return;const c=z.points.reduce((a,p)=>a.map((v,i)=>v+p[i]/z.points.length),[0,0]);z.points=z.points.map(p=>p.map((v,i)=>+(c[i]+(v-c[i])*scale).toFixed(4)))});
 $('#zone-new').onclick=()=>{if(draft.length>=16)return toast('영역은 최대 16개입니다.');drawing=[];mode='draw';selected=null;vertex=-1;refresh()};
 $('#zone-finish').onclick=()=>{
  if(drawing.length<3)return toast('꼭짓점을 3개 이상 놓아주세요.');
  const before=serial(),planter=['terrace','rooftop'].includes(base.config.presetId);selected='zone-'+crypto.randomUUID().slice(0,12);
  draft.push({id:selected,kind:planter?'planter':'ground',height:planter?.44:.03,points:copy(drawing),rounding:0,origin:'custom'});drawing=null;mode='point';record(before);
 };
 $('#zone-undo').onclick=editor.undo;$('#zone-redo').onclick=editor.redo;
 function eat(e){e.preventDefault();e.stopImmediatePropagation()}
 host.addEventListener('pointerdown',e=>{
  if(!active||e.target!==canvas)return;
  if(e.button!==0){rollbackDrag();return;}
  eat(e);engine.controller.cancel();pointers.add(e.pointerId);canvas.setPointerCapture(e.pointerId);
  if(pointers.size>1){rollbackDrag();multi=true;return;}if(multi)return;
  const z=selectedZone(),r=canvas.getBoundingClientRect();
  let hit=-1;if(z)hit=z.points.findIndex(p=>{const q=project(p,z.height+.055);return Math.hypot(q[0]+r.left-e.clientX,q[1]+r.top-e.clientY)<16});
  const p=at(e,z?.height??.03);if(!p)return;
  if(drawing){drag={id:e.pointerId,draw:true,start:[e.clientX,e.clientY],before:serial(),point:p};return;}
  if(hit>=0&&mode==='point'){vertex=hit;drag={id:e.pointerId,before:serial(),start:p,vertex:hit};refresh();return;}
  // Hit regions at their own surface height, including raised planters.
  const clicked=[...draft].reverse().find(z=>{const q=at(e,z.height);return q&&pointInside(effectiveOutline(z.points,z.rounding),...q)});
  if(clicked){selected=clicked.id;vertex=-1;}
  const target=selectedZone();if(!target){refresh();return;}
  const q=at(e,target.height);
  if(mode==='add'&&q){
   let nearest=-1,distance=.25;target.points.forEach((a,i)=>{const d=pointSegmentDistance(q,a,target.points[(i+1)%target.points.length]);if(d<distance){nearest=i;distance=d}});
   if(nearest>=0){if(target.points.length>=32)return toast('꼭짓점은 최대 32개입니다.');mutate(z=>{z.points.splice(nearest+1,0,q);vertex=nearest+1});}
  }else if(clicked&&mode==='move')drag={id:e.pointerId,before:serial(),start:q,move:true};
  refresh();
 },{capture:true});
 host.addEventListener('pointermove',e=>{
  if(!active||!pointers.has(e.pointerId))return;eat(e);if(multi||!drag||drag.id!==e.pointerId||drag.draw)return;
  const z=selectedZone(),p=at(e,z.height);if(!p)return;
  const old=JSON.parse(drag.before).find(x=>x.id===selected);z.origin='custom';
  z.points=drag.move?old.points.map(q=>q.map((v,i)=>+(v+p[i]-drag.start[i]).toFixed(4))):old.points.map((q,i)=>i===drag.vertex?p:q);
  refresh();
 },{capture:true});
 host.addEventListener('pointerup',e=>{
  if(!active||!pointers.has(e.pointerId))return;eat(e);pointers.delete(e.pointerId);
  if(drag?.id===e.pointerId&&!multi){const d=drag;drag=null;if(d.draw){if(Math.hypot(e.clientX-d.start[0],e.clientY-d.start[1])<10){if(drawing.length<32)drawing.push(d.point);else toast('꼭짓점은 최대 32개입니다.');}refresh();}else record(d.before);}
  if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(!pointers.size)multi=false;
 },{capture:true});
 host.addEventListener('pointercancel',e=>{if(active&&pointers.has(e.pointerId)){eat(e);rollbackDrag();for(const id of pointers)if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);pointers.clear();multi=false;}},{capture:true});
 host.addEventListener('wheel',()=>{if(active&&drag)rollbackDrag()},{capture:true,passive:true});
 window.addEventListener('blur',()=>{if(active)finish(false)});
 window.addEventListener('keydown',e=>{
  if(!active)return;
  if(e.key==='Escape'){eat(e);finish(false);return;}
  if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){eat(e);e.shiftKey?editor.redo():editor.undo();}
  else if(['Delete','Backspace','r','R'].includes(e.key)){eat(e);if(e.key!=='r'&&e.key!=='R')$('#zone-point-delete').click();}
 },{capture:true});
 return editor;
}

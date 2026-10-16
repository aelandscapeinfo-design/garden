import * as T from 'three';
import {asComposition,editRegion,changeRegion,moveRegion,mergeRegion,derive,validateComposition,regionDefaults,accessReport,protectedGeometry} from './composition-state.js';
import {contains,measure,patch,strokeGeometry,union,difference,intersection,fromRing} from './region-geometry.js';
import {relocate} from './rules.js';
const $=s=>document.querySelector(s),copy=x=>structuredClone(x),NS='http://www.w3.org/2000/svg';
export function createPatchEditor({engine,getState,onApply,onClose,toast}){
 const host=engine.host,canvas=engine.renderer.domElement,studio=$('#studio');
 const overlay=document.createElementNS(NS,'svg');overlay.id='patch-overlay';overlay.setAttribute('aria-hidden','true');host.append(overlay);
 const panel=document.createElement('aside');panel.id='patch-panel';panel.hidden=true;
 panel.innerHTML=`<div class="composition-heading"><strong>화단과 바닥</strong><select id="patch-list" aria-label="선택한 면"></select><button id="patch-fold">접기</button><button id="patch-cancel">취소 ×</button></div>
 <div id="patch-body"><div class="composition-tools"><button data-patch-mode="select">면 선택</button><button data-patch-mode="new">새 면</button><button data-patch-mode="add">늘리기</button><button data-patch-mode="subtract">줄이기</button><button data-patch-mode="move">전체 이동</button><button id="patch-duplicate">복제</button><button id="patch-delete">면 삭제</button></div>
 <div class="composition-settings"><label>면 종류<select id="patch-kind"><option value="planting">노지 화단</option><option value="lawn">잔디</option><option value="paving">면 포장</option><option value="planter">독립 플랜터</option></select></label><label>브러시<select id="patch-shape"><option value="square">사각형</option><option value="circle">원형</option></select></label><label>크기<select id="patch-size"><option value=".5">작게 · 0.5 m</option><option value="1" selected>중간 · 1 m</option><option value="2">크게 · 2 m</option></select></label><label>경계<select id="patch-edge"><option value="ordered">정돈된</option><option value="soft">부드러운</option></select></label><label id="patch-height-wrap" hidden>높이 m<input id="patch-height" type="number" value=".4" min=".15" max=".8" step=".05"></label></div>
 <div id="paving-settings" hidden class="composition-settings"><label>포장 조합<select id="paving-card"><option value="stone:regular">정형 석재 판석</option><option value="stone:irregular">부정형 자연석</option><option value="gravel:continuous">자갈</option><option value="concrete:continuous">연속 포장</option><option value="stone:blocks">작은 석재 블록</option><option value="wood:deck">목재 데크</option></select></label><button id="paving-turn">방향 90° ↻</button><label>모듈 m<input id="paving-module" type="number" min=".15" max="2" step=".05" value=".6"></label><details><summary>재료·패턴 따로 선택</summary><select id="paving-material" aria-label="포장 재료"><option value="stone">석재</option><option value="gravel">자갈</option><option value="concrete">콘크리트 계열</option><option value="wood">목재</option></select><select id="paving-pattern" aria-label="포장 패턴"><option value="regular">정형</option><option value="irregular">부정형</option><option value="continuous">연속 면</option><option value="blocks">작은 블록</option><option value="deck">판재</option></select></details></div>
 <details><summary>같은 종류의 면 합치기</summary><select id="patch-merge-list" aria-label="합칠 면"></select><button id="patch-merge">선택 면에 합치기</button></details></div>
 <div id="patch-impact" role="status"></div><div class="composition-actions"><button id="patch-undo">↶ 획 되돌리기</button><button id="patch-redo">↷ 다시 실행</button><button id="patch-apply" class="primary">변경 적용</button></div><small id="patch-help">선택한 면만 칠합니다 · 0.25 m 스냅 · 카메라는 우드래그 또는 둘러보기 · 적용 후 문서 되돌리기 1회로 복원</small>`;
 studio.append(panel);
 let active=false,base=null,draft=null,selected=null,mode='select',history=[],future=[],drag=null,pointers=new Set(),multi=false,serial=0,notice='',brush=null,pendingDirection=0;
 const region=()=>[...draft.composition.regions,...draft.composition.planters].find(r=>r.id===selected);
 const at=e=>{const b=canvas.getBoundingClientRect(),ndc=new T.Vector2((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1);engine.ray.setFromCamera(ndc,engine.camera);const p=new T.Vector3();return engine.ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),-.03),p)?{x:p.x,z:p.z}:null};
 function renderOverlay(){overlay.replaceChildren();if(!active)return;const b=host.getBoundingClientRect();overlay.setAttribute('viewBox',`0 0 ${b.width} ${b.height}`);
  const blocked=brush?union(difference(brush,fromRing(draft.boundary)),intersection(brush,protectedGeometry(draft,$('#patch-kind').value)),intersection(brush,union(...draft.composition.regions.filter(r=>r.id!==selected).map(r=>r.geometry)))):null;
  for(const [geometry,color,fill]of [[region()?.geometry,'#6c835b','none'],[brush,'#748562','#8a9e7030'],[blocked,'#ac6847','#b96c3d55']]){
   if(!geometry)continue;const path=document.createElementNS(NS,'path');path.setAttribute('d',geometry.map(p=>p.map(r=>r.map((q,i)=>{const v=new T.Vector3(q[0],.075,q[1]).project(engine.camera);return `${i?'L':'M'}${(v.x+1)*b.width/2} ${(1-v.y)*b.height/2}`}).join(' ')+' Z').join(' ')).join(' '));path.setAttribute('fill',fill);path.setAttribute('fill-rule','evenodd');path.setAttribute('stroke',color);path.setAttribute('stroke-width','2');overlay.append(path);
  }
 }
 const oldDraw=engine.onAfterDraw;engine.onAfterDraw=()=>{oldDraw?.();renderOverlay()};
 function refresh(render=true){
  if(!active)return;const r=region(),all=[...draft.composition.regions,...draft.composition.planters];
  $('#patch-list').replaceChildren();for(const a of all){const o=document.createElement('option');o.value=a.id;o.textContent=a.name+' · '+measure(a.geometry).toFixed(2)+' m²';$('#patch-list').append(o)}$('#patch-list').value=selected||'';
  $('#patch-merge-list').replaceChildren();for(const a of draft.composition.regions.filter(a=>a.id!==selected)){const o=document.createElement('option');o.value=a.id;o.textContent=a.name;$('#patch-merge-list').append(o)}
  if(r){$('#patch-kind').value=draft.composition.planters.includes(r)?'planter':r.kind;$('#patch-edge').value=r.edge;$('#paving-material').value=r.material;$('#paving-pattern').value=r.pattern;$('#paving-card').value=r.material+':'+r.pattern;$('#paving-module').value=r.moduleM;if(r.height)$('#patch-height').value=r.height}
  $('#paving-settings').hidden=$('#patch-kind').value!=='paving';$('#patch-height-wrap').hidden=$('#patch-kind').value!=='planter';
  $('#paving-turn').textContent=`방향 ${r?.direction??pendingDirection}° ↻`;
  document.querySelectorAll('[data-patch-mode]').forEach(b=>b.classList.toggle('active',b.dataset.patchMode===mode));
  const result=relocate(base.items,draft),route=accessReport(draft,result.items);
  $('#patch-impact').textContent=`${r?measure(r.geometry).toFixed(2)+' m² · ':''}유지 ${result.items.length} / 이동 대기 ${result.pending.length} (+보관 중 ${base.pending.length})`+(notice?' · '+notice:'')+(!route.connected?' · 문에서 바깥까지 통로가 끊겨 있어요.':'');
  $('#patch-undo').disabled=!history.length;$('#patch-redo').disabled=!future.length;$('#patch-apply').disabled=!history.length;
  if(render){engine.setConfig(draft,false);engine.sync(base.items,null);engine.grid.visible=engine.view==='edit';engine.render()}renderOverlay();
 }
 function record(before){if(JSON.stringify(before)===JSON.stringify(draft))return refresh(false);history.push(before);if(history.length>80)history.shift();future=[];refresh()}
 function mutate(fn){cancelStroke();const before=copy(draft);try{draft=fn(copy(draft));validateComposition(draft);notice='';record(before)}catch(e){draft=before;notice=e.message;toast(e.message);refresh(false)}}
 function release(){for(const id of pointers)if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);pointers.clear();multi=false}
 function cancelStroke(){drag=null;brush=null;release();renderOverlay()}
 function close(apply){cancelStroke();const result=relocate(base.items,draft);active=false;panel.hidden=true;studio.classList.remove('patch-editing');overlay.replaceChildren();engine.grid.visible=false;
  if(apply&&history.length)onApply(draft,result);else{engine.setConfig(base.config,false);engine.sync(base.items,null)}onClose?.();
 }
 const editor={get active(){return active},open(){if(active)return;const s=getState();try{draft=asComposition(s.config)}catch(e){return toast(e.message)}base=copy(s);active=true;selected=null;mode='select';history=[];future=[];serial=Date.now();notice=s.config.composition?'':'기존 겹친 바닥은 편집 적용 시 한 종류의 면으로 정리됩니다. 원본은 되돌릴 수 있어요.';panel.hidden=false;studio.classList.add('patch-editing');refresh()},cancel(){if(active)close(false)},cancelStroke,undo(){if(!active||!history.length)return;cancelStroke();future.push(copy(draft));draft=history.pop();refresh()},redo(){if(!active||!future.length)return;cancelStroke();history.push(copy(draft));draft=future.pop();refresh()},state:()=>({active,selected,mode,past:history.length,future:future.length,config:copy(draft),stroke:!!drag,notice}),viewChanged(){cancelStroke();if(active){engine.grid.visible=engine.view==='edit';renderOverlay()}},apply(){if(active)close(true)}};
 $('#patch-cancel').onclick=()=>close(false);$('#patch-apply').onclick=()=>close(true);$('#patch-undo').onclick=editor.undo;$('#patch-redo').onclick=editor.redo;
 $('#patch-fold').onclick=()=>{const b=$('#patch-body');b.hidden=!b.hidden;$('#patch-fold').textContent=b.hidden?'펼치기':'접기'};
 document.querySelectorAll('[data-patch-mode]').forEach(b=>b.onclick=()=>{cancelStroke();mode=b.dataset.patchMode;if(mode==='new')selected=null;notice='';refresh(false)});
 $('#patch-list').onchange=e=>{cancelStroke();selected=e.target.value;mode='select';refresh(false)};
 $('#patch-kind').onchange=e=>{if(region())mutate(c=>{if(e.target.value==='planter'||c.composition.planters.some(p=>p.id===selected))throw Error('플랜터와 바닥은 다른 층입니다. 새 면으로 추가해주세요.');return changeRegion(c,selected,{kind:e.target.value})});else refresh(false)};
 $('#patch-edge').onchange=e=>{if(region())mutate(c=>changeRegion(c,selected,{edge:e.target.value}))};
 $('#paving-card').onchange=e=>{const [material,pattern]=e.target.value.split(':');$('#paving-material').value=material;$('#paving-pattern').value=pattern;if(region())mutate(c=>changeRegion(c,selected,{material,pattern}))};
 for(const [id,key]of [['paving-material','material'],['paving-pattern','pattern'],['paving-module','moduleM']])$('#'+id).onchange=e=>{if(region())mutate(c=>changeRegion(c,selected,{[key]:key==='moduleM'?+e.target.value:e.target.value}))};
 $('#paving-turn').onclick=()=>{if(region())mutate(c=>changeRegion(c,selected,{direction:(region().direction+90)%360}));else{pendingDirection=(pendingDirection+90)%360;refresh(false)}};
 $('#patch-height').onchange=e=>{const value=+e.target.value;if(region())mutate(c=>{const p=c.composition.planters.find(p=>p.id===selected);if(p)p.height=value;return derive(c)})};
 $('#patch-delete').onclick=()=>mutate(c=>{c.composition.regions=c.composition.regions.filter(r=>r.id!==selected);c.composition.planters=c.composition.planters.filter(r=>r.id!==selected);return derive(c)});
 $('#patch-duplicate').onclick=()=>{if(!region())return toast('면을 먼저 선택해주세요.');mode='duplicate';notice='복제할 위치를 탭하세요.';refresh(false)};
 $('#patch-merge').onclick=()=>mutate(c=>mergeRegion(c,selected,$('#patch-merge-list').value));
 const eat=e=>{e.preventDefault();e.stopImmediatePropagation()};
 host.addEventListener('pointerdown',e=>{
  if(!active)return;if(engine.view!=='edit'||e.button!==0){cancelStroke();return}eat(e);pointers.add(e.pointerId);
  if(pointers.size>1){drag=null;brush=null;multi=true;renderOverlay();return}multi=false;const p=at(e);if(!p)return;
  canvas.setPointerCapture(e.pointerId);const before=copy(draft);drag={id:e.pointerId,p,last:p,screen:[e.clientX,e.clientY],before,moved:false,geometry:patch(p.x,p.z,+$('#patch-size').value,$('#patch-shape').value)};brush=drag.geometry;
  if(mode==='select'){selected=[...draft.composition.planters,...draft.composition.regions].find(r=>contains(r.geometry,p.x,p.z))?.id||null;brush=null;refresh(false)}renderOverlay();
 },{capture:true});
 host.addEventListener('pointermove',e=>{
  if(!active||!drag||drag.id!==e.pointerId||multi)return;eat(e);const p=at(e);if(!p||mode==='select')return;
  if(!drag.moved&&Math.hypot(e.clientX-drag.screen[0],e.clientY-drag.screen[1])<6)return;drag.moved=true;
  if(!['move','duplicate'].includes(mode))try{drag.geometry=union(drag.geometry,strokeGeometry(drag.last,p,+$('#patch-size').value,$('#patch-shape').value));brush=drag.geometry}catch(err){notice=err.message;drag=null;brush=null}
  if(drag)drag.last=p;renderOverlay();
 },{capture:true});
 host.addEventListener('pointerup',e=>{
  if(!active||!pointers.has(e.pointerId))return;eat(e);pointers.delete(e.pointerId);const d=drag;drag=null;brush=null;
  if(d&&d.id===e.pointerId&&!multi&&mode!=='select'){
   const p=at(e)||d.last;
   const creation=mode==='new'?{edge:$('#patch-edge').value,...($('#patch-kind').value==='paving'?{material:$('#paving-material').value,pattern:$('#paving-pattern').value,moduleM:+$('#paving-module').value,direction:pendingDirection}:{})}:null;
   try{
    if(['move','duplicate'].includes(mode)){const r=region();if(!r)throw Error('면을 먼저 선택해주세요.');const center=r.geometry[0][0].slice(0,-1).reduce((a,q)=>[a[0]+q[0]/(r.geometry[0][0].length-1),a[1]+q[1]/(r.geometry[0][0].length-1)],[0,0]);
     const dx=Math.round((p.x-(mode==='duplicate'?center[0]:d.p.x))*4)/4,dz=Math.round((p.z-(mode==='duplicate'?center[1]:d.p.z))*4)/4;
     draft=moveRegion(draft,selected,dx,dz,mode==='duplicate','region-'+serial++);
    }else if($('#patch-kind').value==='planter'||draft.composition.planters.some(p=>p.id===selected)){
     const c=copy(draft),id=mode==='new'?'planter-'+serial++:selected;let r=c.composition.planters.find(p=>p.id===id);
     if(!r){if(mode!=='new')throw Error('플랜터를 선택해주세요.');r={...regionDefaults(id,[]),height:+$('#patch-height').value,support:c.composition.baseFloor};c.composition.planters.push(r)}
     const allowed=intersection(d.geometry,fromRing(c.boundary));r.geometry=mode==='subtract'?difference(r.geometry,allowed):union(r.geometry,allowed);c.composition.planters=c.composition.planters.filter(p=>p.geometry.length);validateComposition(c);draft=derive(c);selected=id;
    }else{
     const id=mode==='new'?'region-'+serial++:selected,result=editRegion(draft,{id,geometry:d.geometry,operation:mode,kind:$('#patch-kind').value});draft=result.config;selected=id;notice=result.blockedM2>.001?'부지 밖·건물·문·다른 면과 겹친 부분은 남겨두었어요.':'';
    }
    if(creation&&region())draft=changeRegion(draft,selected,creation);
    if(mode==='new')mode='add';record(d.before);
   }catch(err){draft=d.before;notice=err.message;toast(err.message);refresh(false)}
  }
  if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(!pointers.size)multi=false;renderOverlay();
 },{capture:true});
 for(const name of ['pointercancel','lostpointercapture'])host.addEventListener(name,e=>{if(active&&drag?.id===e.pointerId){eat(e);cancelStroke()}},{capture:true});
 host.addEventListener('wheel',()=>{if(active)cancelStroke()},{capture:true,passive:true});
 window.addEventListener('blur',cancelStroke);window.addEventListener('resize',cancelStroke);
 window.addEventListener('keydown',e=>{if(!active||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;if(e.key==='Escape'){eat(e);cancelStroke();toast('진행 중인 획만 취소했습니다. 완료한 획은 유지됩니다.')}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){eat(e);e.shiftKey?editor.redo():editor.undo()}else if(['Delete','Backspace','r','R'].includes(e.key))eat(e)},{capture:true});
 return editor;
}

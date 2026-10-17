import {TEMPLATES,templateScene,samplePlants} from "./composition-templates.js";
import {emptyScene,resizeComposition,asComposition,derive,validateComposition,areaSummary,accessReport} from './composition-state.js';
import {buildingGeometry} from './building-geometry.js';
import {relocate} from './rules.js';
const $=s=>document.querySelector(s);
export function createCompositionUI({engine,getState,commit,toast,archive}){
 const dialog=document.createElement('dialog');dialog.id='composition-dialog';dialog.innerHTML=`<button class="close" id="composition-close" aria-label="닫기">×</button><div class="eyebrow">MY GARDEN / COMPOSITION</div><h2 id="composition-title">빈 땅부터 만들기</h2><div id="composition-templates"></div><div class="composition-settings"><label>가로 m<input id="site-width" type="number" min="3" max="16" step=".25"></label><label>세로 m<input id="site-depth" type="number" min="3" max="16" step=".25"></label></div><svg id="composition-plan" viewBox="0 0 400 260" aria-label="실제 구성 평면 미리보기"></svg><p id="composition-impact" role="status"></p><label id="composition-archive-label"><input id="composition-archive" type="checkbox"> 현재 정원을 별도 저장한 뒤 시작</label><p class="example-warning">1 m = 화면 공간 1 m · 식물의 좌표와 크기는 비례 확대하지 않습니다. 적용 후 되돌리기로 복구할 수 있습니다.</p><button id="composition-apply" class="primary wide">미리본 구성 적용</button><button id="composition-cancel" class="quiet wide">취소 · 현재 정원 유지</button>`;document.body.append(dialog);
 let templateId='empty',mode='empty',draft=null,initial=null,items=[],pending=[],error='';
 function preview(){
  try{
   error='';const w=+$('#site-width').value,d=+$('#site-depth').value;
   if(mode==='empty'||mode==='template'){draft=mode==='template'?templateScene(templateId,w,d):emptyScene(w,d);items=mode==='template'&&$('#template-plants').checked?samplePlants(draft):[];pending=[]}
   else {const result=resizeComposition(initial.config,w,d);draft=result.config;const moved=relocate(initial.items,draft);items=moved.items;pending=[...initial.pending,...moved.pending];error=result.removedM2>.001?`경계 밖 면 ${result.removedM2.toFixed(2)} m²가 잘립니다. 되돌리기로 복원할 수 있습니다.`:''}
   drawPlan($('#composition-plan'),draft);$('#composition-impact').textContent=`${w} × ${d} m · ${(w*d).toFixed(2)} m² · 식물·소품 ${items.length} / 이동 대기 ${pending.length} · `+(mode==='empty'?'화단·포장·건물 0개로 시작합니다.':mode==='template'?`면 ${draft.composition.regions.length} / 건물 ${draft.composition.buildings.length} / 플랜터 ${draft.composition.planters.length}개`:error);$('#composition-apply').disabled=false;
  }catch(e){draft=null;$('#composition-impact').textContent=e.message;$('#composition-apply').disabled=true}
 }
 const api={openEmpty(){open('empty')},openResize(){open('resize')},openTemplates(){open('template')}};
 function open(next){initial=getState();mode=next;$('#composition-title').textContent=mode==='empty'?'빈 땅부터 만들기':mode==='template'?'정원 구성을 고르세요.':'땅의 크기 바꾸기';$('#composition-templates').hidden=mode!=='template';$('#site-width').value=initial.config.widthM;$('#site-depth').value=initial.config.depthM;$('#composition-archive-label').hidden=mode==='resize';$('#composition-archive').checked=false;preview();dialog.showModal()}
 const gallery=document.createElement('div');gallery.id='template-gallery';
 for(const t of TEMPLATES){const b=document.createElement('button');b.dataset.template=t.id;b.type='button';const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 400 260');drawPlan(svg,templateScene(t.id));const label=document.createElement('span');label.textContent=t.name;b.append(svg,label);b.onclick=()=>{templateId=t.id;$('#site-width').value=t.width;$('#site-depth').value=t.depth;gallery.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));preview()};gallery.append(b)}
 $('#composition-templates').append(gallery);const label=document.createElement('label');label.innerHTML='<input id="template-plants" type="checkbox"> 예시 식물도 함께 가져오기 (해제하면 구성만)';$('#composition-templates').append(label);$('#template-plants').onchange=preview;
 for(const id of ['site-width','site-depth'])$('#'+id).oninput=preview;
 $('#composition-close').onclick=$('#composition-cancel').onclick=()=>dialog.close();
 $('#composition-apply').onclick=()=>{preview();if(!draft)return;try{if($('#composition-archive').checked&&mode!=='resize')archive();commit(draft,items,pending);dialog.close()}catch(e){toast(e.message)}};
 return api;
}
export function drawPlan(svg,c){
 const scale=Math.min(360/c.widthM,220/c.depthM),point=([x,z])=>`${200+x*scale} ${130+z*scale}`;
 const path=(geometry,color)=>`<path d="${geometry.map(p=>p.map(r=>r.map((q,i)=>(i?'L':'M')+point(q)).join(' ')+' Z').join(' ')).join(' ')}" fill="${color}" fill-rule="evenodd"/>`;
 svg.innerHTML=path([[c.boundary]],'#d1b99b')+c.surfaces.map(s=>path(s.geometry||[[s.polygon]],s.material==='turf'?'#98a673':'#e0d6b7')).join('')+c.plantableZones.map(z=>path(z.geometry||[[z.polygon]],'#788863')).join('')+c.obstacles.map(o=>path([[o.polygon]],'#657466')).join('')+c.openings.map(o=>path([[o.clearance]],'#f7f3dc')).join('');
}

import {PLANTS_V6,libraryCounts} from './plant-library-v6.js';
import "./style.css";
import {createZoneEditor} from "./zone-editor.js";
import {transferZones} from "./zone-state.js";
let recoverySignature="";
let zoneEditor=null, patchEditor=null, compositionUI=null, buildingEditor=null;
import {samplePlants} from "./composition-templates.js";
import {createCatalogUI} from "./catalog-ui.js";
import {createBuildingEditor} from "./building-editor.js";
import {createPatchEditor} from "./patch-editor.js";
import {createCompositionUI} from "./composition-ui.js";
import {areaSummary} from "./composition-state.js";
import {visualProfile} from "./visual-profile.js";
import {ARCHETYPES,filterPlants,itemReference,referenceValid} from "./plant-catalog.js";
import {artScene, ART_TYPES} from "./art-scene.js";
import { assetReport } from "./asset-registry.js";
import { GardenEngine } from "./engine.js";
import { CATALOG, DISCLAIMER } from "./catalog.js";
import { populate } from "./presets.js";
import { createScene, PRESETS, sceneLabel } from "./scene-config.js";
import {
  encode,
  decode,
  readSlot,
  readLatest,
  writeSlot,
  STORAGE_KEY,
} from "./persistence.js";
import { bindInteraction } from "./interaction.js";
import { relocate } from "./rules.js";
import { placementError } from "./rules.js";
const $ = (s) => document.querySelector(s);
const artInitial=artScene();
let config = artInitial.config,
  pending = [],
  pendingId = null;
let engine;
try {
  engine = new GardenEngine($("#scene"), config);
} catch (error) {
  $("#loading").innerHTML =
    "<p>3D 정원을 열 수 없습니다. WebGL을 지원하는 Chrome 또는 Edge에서 열어주세요.</p>";
  console.error(error);
  throw error;
}
let items = artInitial.items,
  nextId = Math.max(...items.map((i) => i.id)) + 1,
  past = [],
  future = [],
  selected = null,
  tool = null,
  moving = false,
  rotation = 0,
  tab = "plants",
  point = null,
  down = null,
  stroke = false,
  strokeSaved = false,
  lastPoint = null;
let profile = {
    space: "모르겠어요",
    size: "모르겠어요",
    sun: "모르겠어요",
    mood: "모르겠어요",
  },
  wish = "",
  boardImage = "",
  resetMode = "empty";
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("visible"), 3200);
}
function editMode() {
  $("#studio").classList.add("editing");
  document
    .querySelectorAll("nav .current")
    .forEach((e) => e.classList.remove("current"));
  $("#profile-open").classList.add("current");
}
function snapshot() {
  if (stroke && strokeSaved) return;
  if (stroke) strokeSaved = true;
  past.push(JSON.stringify(data()));
  if (past.length > 80) past.shift();
  future = [];
}
function persistRecovery(){
  if(!past.length||patchEditor?.active||zoneEditor?.active||buildingEditor?.active||stroke)return;
  const signature=JSON.stringify({config,items,pending,profile,wish});if(signature===recoverySignature)return;recoverySignature=signature;
  try{writeSlot(data(),STORAGE_KEY+"-recovery")}catch{toast("최근 작업 복구 저장에 실패했습니다. 현재 정원은 유지됩니다. JSON으로 내보내주세요.");}
}
function sync() {
  persistRecovery();
  if (!items.some((i) => i.id === selected)) selected = null;
  engine.sync(items, selected);
  $("#pending-open").hidden = !pending.length;
  for(const view of ["entrance","seat"]){const b=document.querySelector(`[data-view=${view}]`);b.disabled=view==="entrance"?!config.openings.length:!items.some(i=>i.type==="bench");}
  updateCameraTargets();
  $("#pending-count").textContent = pending.length;
  $("#undo").disabled = !past.length;
  $("#redo").disabled = !future.length;
  $("#element-count").textContent =
    `${items.filter((i) => CATALOG[i.type].category === "plants").length} PLANTS`;
  const item = items.find((i) => i.id === selected);
  $("#selection").hidden = !item || engine.view !== "edit";
  if (item) $("#selection-name").textContent = CATALOG[item.type].name;
}
function updateCaption() {
  $("#plant-types-count").textContent=filterPlants({},visualProfile(config)).length;
  $("#art-note").textContent=engine.renderStyle === "toon" ? "흙과 재료를 고르고, 식물 형태를 비교해보세요" : "기존 V3 표현 · 카메라와 맵 조작 유지";
  palette();
  $("#profile-note").textContent =
    sceneLabel(config) + " · 직접 정한 치수의 개념 모델";
  $(".garden-caption strong").textContent = config.composition ? "나의 정원, 나의 구성." : PRESETS[config.presetId].subtitle;
  $("#edit-profile").textContent = "공간과 치수 바꾸기 ↗";
}
function candidate(p = point) {
  if (!p || !tool) return null;
  const source =
    pendingId !== null
      ? pending.find((p) => p.item.id === pendingId)?.item
      : moving
        ? items.find((i) => i.id === selected)
        : null;
  return {
    ...itemReference(source?.type??tool,visualProfile(config)),
    ...(source||{}),
    id: source?.id ?? nextId,
    type: source?.type ?? tool,
    x: p.x,
    z: p.z,
    r: rotation,
    scale: source?.scale ?? 1,
    variant: source?.variant ?? nextId % 3,
    ...(PLANTS_V6[source?.type??tool]?{seed:source?.seed??(nextId*9821)%2147483647,seasonalState:source?.seasonalState??catalogUI.season()}:{}),
    ...(source?.sx ? { sx: source.sx, sz: source.sz } : {}),
  };
}
function preview() {
  const c = candidate();
  engine.showPreview(c, c ? !placementError(c, items, config) : false);
}
function setTool(type) {
  tool = type;
  moving = false;
  pendingId = null;
  rotation = 0;
  document
    .querySelectorAll(".asset")
    .forEach((b) => b.classList.toggle("active", b.dataset.type === type));
  $("#select-tool").classList.toggle("active", !type);
  $("#hint").textContent = !type
    ? "물체를 선택하면 옮기기·회전·지우기가 나타납니다."
    : CATALOG[type].category === "surface"
      ? "0.25 m 간격 · 누른 채 이어 그릴 수 있어요."
      : "0.25 m 간격 · 탭하여 배치 · R 키로 방향 전환";
  if (type && engine.view !== "edit") changeView("edit");
  preview();
}
function apply(p) {
  if (!p) return false;
  point = p;
  if (!tool) return false;
  const c = candidate(p);
  const error = placementError(c, items, config);
  if (error) {
    if (!stroke) toast(error);
    return false;
  }
  if (items.length + pending.length >= 300 && !moving && pendingId === null) {
    toast("이 작은 정원에는 300개까지 놓을 수 있어요.");
    return false;
  }
  if (
    !moving &&
    items.some(
      (i) =>
        i.type === c.type &&
        Math.hypot(i.x - c.x, i.z - c.z) <
          (CATALOG[c.type].category === "surface" ? 0.24 : 0.12),
    )
  )
    return false;
  snapshot();
  if (pendingId !== null) {
    pending = pending.filter((p) => p.item.id !== pendingId);
    items.push(c);
    pendingId = null;
    setTool(null);
  } else if (moving) {
    items = items.map((i) => (i.id === selected ? c : i));
    moving = false;
    setTool(null);
    toast("자리를 옮겼습니다.");
  } else {
    items.push(c);
    nextId++;
  }
  sync();
  preview();
  return true;
}
function select(e) {
  selected = engine.pick(e);
  sync();
}
function move() {
  const s = items.find((i) => i.id === selected);
  if (!s) return;
  setTool(s.type);
  moving = true;
  rotation = s.r;
  $("#hint").textContent =
    "옮길 자리를 정원에서 탭하세요. Escape로 취소할 수 있어요.";
  toast("옮길 자리를 골라주세요.");
  preview();
}
function rotate() {
  if (tool) {
    rotation = (rotation + 15) % 360;
    preview();
    return;
  }
  const s = items.find((i) => i.id === selected);
  if (!s) return;
  const c = { ...s, r: (s.r + 15) % 360 };
  const error = placementError(c, items, config);
  if (error) return toast(error);
  snapshot();
  Object.assign(s, c);
  sync();
}
function remove() {
  if (selected === null) return;
  snapshot();
  items = items.filter((i) => i.id !== selected);
  selected = null;
  setTool(null);
  sync();
}
function undo() {
  if(patchEditor?.active)return patchEditor.undo();
  if(zoneEditor?.active)return zoneEditor.undo();
  if (!past.length) return;
  future.push(JSON.stringify(data()));
  restore(decode(past.pop()));
  selected = null;
  setTool(null);
  sync();
}
function redo() {
  if(patchEditor?.active)return patchEditor.redo();
  if(zoneEditor?.active)return zoneEditor.redo();
  if (!future.length) return;
  past.push(JSON.stringify(data()));
  restore(decode(future.pop()));
  selected = null;
  setTool(null);
  sync();
}
const canvas = engine.renderer.domElement;
const interaction = bindInteraction(canvas, {
  engine,
  getState: () => ({
    tool,
    moving,
    paint:
      !!tool &&
      !moving &&
      pendingId === null &&
      CATALOG[tool].category === "surface",
  }),
  onPoint: (p) => {
    point = p;
    preview();
  },
  onApply: apply,
  onSelect: select,
  onStrokeStart: () => {
    stroke = true;
    strokeSaved = false;
  },
  onStrokeEnd: (cancel) => {
    if (cancel && strokeSaved && past.length) {
      restore(decode(past.pop()));
      sync();
    }
    stroke = false;
    strokeSaved = false;
    persistRecovery();
  },
  onCancel: () => {
    point = null;
  },
});
zoneEditor=createZoneEditor({engine,getState:()=>({config,items,pending}),toast,
 onApply:(next,result)=>{snapshot();config=next;items=result.items;pending.push(...result.pending);selected=null;engine.setConfig(config,false);setTool(null);sync();updateCaption();toast(`화단을 적용했습니다. ${result.pending.length}개 요소를 대기함에 보관했습니다.`);},
 onClose:()=>{setTool(null);sync();}
});
$("#zone-open").onclick=()=>{if(config.composition)return toast("패치 면에서는 화단과 바닥 메뉴를 사용해주세요. 고급 점 편집은 기존 V4 윤곽에서 지원합니다.");interaction.cancel();changeView("edit");editMode();selected=null;setTool(null);sync();zoneEditor.open();};
patchEditor=createPatchEditor({engine,getState:()=>({config,items,pending}),toast,onApply:(next,result)=>{commitComposition(next,result.items,[...pending,...result.pending]);toast(`면을 적용했습니다. ${result.pending.length}개를 이동 대기함에 보관했습니다.`);},onClose:()=>{setTool(null);sync();}});
function commitComposition(next,nextItems,nextPending){snapshot();config=next;items=nextItems;pending=nextPending;selected=null;nextId=Math.max(1,...items.map(i=>i.id+1),...pending.map(p=>p.item.id+1));engine.setConfig(config,false);setTool(null);sync();updateCaption();editMode();}
compositionUI=createCompositionUI({engine,getState:()=>({config,items,pending}),commit:commitComposition,toast,archive:()=>writeSlot(data(),STORAGE_KEY+"-archive-"+Date.now())});
$("#compose-empty").onclick=()=>{if(patchEditor.active)return toast("면 편집을 적용하거나 취소해주세요.");zoneEditor.cancel();interaction.cancel();compositionUI.openEmpty();};
$("#compose-land").onclick=()=>{if(patchEditor.active)return toast("면 편집을 적용하거나 취소해주세요.");config.composition?compositionUI.openResize():openConditions();};
$("#compose-patch").onclick=()=>{zoneEditor.cancel();interaction.cancel();changeView("edit");editMode();selected=null;setTool(null);sync();patchEditor.open();};
buildingEditor=createBuildingEditor({engine,getState:()=>({config,items,pending}),commit:commitComposition,toast});
$("#compose-building").onclick=()=>{if(patchEditor.active)return toast("면 편집을 적용하거나 취소해주세요.");zoneEditor.cancel();interaction.cancel();buildingEditor.open();};
$("#entry-empty").onclick=()=>$("#compose-empty").click();
$("#entry-load").onclick=load;
$("#compose-templates").onclick=()=>{if(patchEditor.active)return toast("면 편집을 적용하거나 취소해주세요.");zoneEditor.cancel();interaction.cancel();compositionUI.openTemplates();};
$("#entry-templates").onclick=()=>$("#compose-templates").click();
const thumbs = {};
const thumbnailObserver=new IntersectionObserver(entries=>{
 let updated=false;
 for(const entry of entries){if(!entry.isIntersecting||!entry.target.isConnected)continue;const b=entry.target,key=b.dataset.thumbnailKey,type=b.dataset.type;
  if(!thumbs[key])thumbs[key]=engine.thumbnail(type,b.dataset.season||'foliage');
  b.querySelector('img').src=thumbs[key];thumbnailObserver.unobserve(b);updated=true;
 }if(updated)engine.render();
},{root:$('#palette'),rootMargin:'80px'});
const toolboxObserver=new ResizeObserver(()=>{const box=$('#toolbox'),bottom=parseFloat(getComputedStyle(box).bottom)||0;$('#studio').style.setProperty('--toolbox-clearance',`${Math.ceil(box.getBoundingClientRect().height+bottom+12)}px`)});
toolboxObserver.observe($('#toolbox'));
const catalogUI=createCatalogUI({getProfile:()=>visualProfile(config),onChange:()=>{palette();engine.ghostType=null;preview();}});
function palette() {
  thumbnailObserver.disconnect();$("#palette").replaceChildren();
  catalogUI.visible(tab==="plants");catalogUI.refresh();
  const filtered=new Set(filterPlants(catalogUI.filters(),visualProfile(config)).map(p=>p.type));
  for (const [type, data] of Object.entries(CATALOG)) {
    if (data.category !== tab) continue;
    if(data.category === "plants" && !filtered.has(type)) continue;
    const thumbKey=engine.renderStyle+type+(PLANTS_V6[type]?catalogUI.season():"");

    const b = document.createElement("button");
    b.className = "asset" + (tool === type ? " active" : "");
    b.dataset.type = type;b.dataset.thumbnailKey=thumbKey;b.dataset.season=PLANTS_V6[type]?catalogUI.season():"foliage";
    b.innerHTML = `<img ${thumbs[thumbKey]?`src="${thumbs[thumbKey]}"`:""} alt=""><span>${data.name}</span><small>${data.en}</small>`;
    b.onclick = () => {
      editMode();
      selected = null;
      setTool(type);
      catalogUI.selected(type);
      sync();
    };
    $("#palette").append(b);if(!thumbs[thumbKey])thumbnailObserver.observe(b);
  }
  engine.render();
}
document.querySelectorAll("[data-tab]").forEach(
  (b) =>
    (b.onclick = () => {
      tab = b.dataset.tab;
      document
        .querySelectorAll("[data-tab]")
        .forEach((x) => x.classList.toggle("active", x === b));
      palette();
    }),
);
$("#select-tool").onclick = () => setTool(null);
$("#move").onclick = move;
$("#rotate").onclick = rotate;
$("#delete").onclick = remove;
$("#undo").onclick = undo;
$("#redo").onclick = redo;
function updateCameraTargets(){if(!config.composition)return;const bench=items.find(i=>i.type==="bench"),viewpoints={...config.viewpoints};if(bench){const a=bench.r*Math.PI/180;viewpoints.seat={position:[bench.x+Math.sin(a)*.5,1.28,bench.z+Math.cos(a)*.5],target:[bench.x+Math.sin(a)*3,.6,bench.z+Math.cos(a)*3]};}engine.controller.config={...engine.config,viewpoints};}
function changeView(view) {
  updateCameraTargets();
  if(["entrance","seat"].includes(view) && (view==="entrance" ? !config.openings.length : !items.some(i=>i.type==="bench")))return toast("대상이 아직 없습니다. 전체 보기와 둘러보기를 이용해주세요.");
  zoneEditor?.cancel();
  point = null;
  tool = null;
  moving = false;
  engine.setView(view);
  patchEditor?.viewChanged();
  $("#studio").classList.toggle("viewing", view !== "edit");
  $("#camera-hint").hidden = view !== "edit";
  $("#view-note").hidden = view === "edit";
  document
    .querySelectorAll("[data-view]")
    .forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  document
    .querySelectorAll(".asset")
    .forEach((b) => b.classList.remove("active"));
  $("#select-tool").classList.add("active");
  sync();
}
document
  .querySelectorAll("[data-view]")
  .forEach((b) => (b.onclick = () => changeView(b.dataset.view)));
$("#zoom-in").onclick = () => engine.controller.zoom(0.84);
$("#zoom-out").onclick = () => engine.controller.zoom(1.18);
$("#camera-rotate").onclick = () => engine.controller.rotate();
$("#camera-home").onclick = () => engine.controller.full();
$("#focus").onclick = () => {
  const i = items.find((i) => i.id === selected);
  if (i) engine.controller.focus(i, CATALOG[i.type].height);
};
$("#quality").textContent =
  engine.quality === "light" ? "가벼운 표현" : "기본 표현";
$("#quality").onclick = () => {
  engine.setQuality(engine.quality === "light" ? "standard" : "light");
  $("#quality").textContent =
    engine.quality === "light" ? "가벼운 표현" : "기본 표현";
  toast(
    engine.quality === "light"
      ? "먼 거리 잎 모델과 작은 그림자로 표현합니다."
      : "기본 표현으로 전환했습니다.",
  );
};
function reset(mode) {
  resetMode = mode;
  $("#confirm-title").textContent =
    mode === "empty" ? "정원을 비울까요?" : "오월의 예시 정원으로 돌아갈까요?";
  $("#confirm p").textContent =
    mode === "empty"
      ? "배치한 식물·포장·벤치를 비웁니다. 기본 지면과 경계는 남으며, 되돌릴 수 있어요."
      : "현재 배치가 예시 정원으로 바뀝니다. 되돌릴 수 있어요.";
  $("#confirm").showModal();
}
$("#empty").onclick = () => reset("empty");
$("#example").onclick = () => reset("example");
$("#confirm-cancel").onclick = () => $("#confirm").close();
$("#confirm-go").onclick = () => {
  snapshot();
  items = resetMode === "empty" ? [] : config.composition ? samplePlants(config) : (config.presetId === "front" && config.widthM === 6 && config.depthM === 4.5 ? artScene().items : populate(config));
  const resetResult=relocate(items,config);items=resetResult.items;pending=resetResult.pending;
  nextId = Math.max(nextId, ...items.map((i) => i.id + 1), ...pending.map(p=>p.item.id+1));
  selected = null;
  setTool(null);
  sync();
  editMode();
  $("#confirm").close();
};
let draftConfig, requiresZoneTransfer=false, zoneTransferError=null;
function previewSpace() {
  const f = $("#condition-form");
  try {
    draftConfig = f.elements.space.value
      ? createScene(
          f.elements.space.value,
          +f.elements.width.value,
          +f.elements.depth.value,
          config.seed,
        )
      : config;
    const baseChanged=["presetId","widthM","depthM"].some(k=>config[k]!==draftConfig[k]);
    requiresZoneTransfer=!!config.customZones&&baseChanged;
    $("#zone-transfer-options").hidden=!requiresZoneTransfer;
    zoneTransferError=null;
    if(!baseChanged)draftConfig=config;
    else if(requiresZoneTransfer){
      const choice=new FormData(f).get("zoneTransfer"),t=transferZones(config,draftConfig,items);
      $("#zone-transfer-impact").textContent=t.error?"현재 윤곽 유지 불가: "+t.error:"현재 윤곽의 좌표·높이·ID를 유지할 수 있습니다.";
      if(choice==="keep"){zoneTransferError=t.error;if(t.config)draftConfig=t.config;}
    }
    const c = draftConfig,
      scale = Math.min(360 / c.widthM, 175 / c.depthM),
      point = ([x, z]) => `${200 + x * scale},${105 + z * scale}`;
    const poly = (p, fill) =>
      `<polygon points="${p.map(point).join(" ")}" fill="${fill}"/>`;
    $("#space-preview").innerHTML =
      poly(c.boundary, "#d6cfb7") +
      c.surfaces
        .map((s) =>
          poly(s.polygon, s.material === "turf" ? "#9ba57b" : "#e6dfc9"),
        )
        .join("") +
      c.plantableZones.map((p) => poly(p.polygon, "#6e805b")).join("") +
      c.obstacles.map((p) => poly(p.polygon, "#43564b")).join("") +
      c.openings.map((p) => poly(p.clearance, "#f7f2df")).join("");
    $("#space-area").textContent = sceneLabel(c);
    const moved = relocate(items, c);
    $("#space-impact").textContent =
      `현재 ${items.length}개 중 ${moved.items.length}개 유지 · ${moved.pending.length + pending.length}개 이동 대기`;
    $("#transfer-options").hidden =
      JSON.stringify(c) === JSON.stringify(config) ||
      !(items.length + pending.length);
    $("#space-warning").textContent =
      "직접 정한 치수의 개념 모델입니다. 현장을 측량·복원한 설계가 아닙니다." +
      (c.presetId === "rooftop"
        ? " 옥상 하중·방수·난간 안전은 검증하지 않았습니다."
        : "");
  } catch (e) {
    draftConfig = null;
    $("#space-impact").textContent = e.message;
  }
}
function openConditions() {
  if(patchEditor?.active)return toast("면 편집을 적용하거나 취소한 뒤 공간을 바꿔주세요.");
  if(config.composition)return compositionUI.openResize();
  zoneEditor?.cancel();
  interaction.cancel();
  const f = $("#condition-form");
  f.elements.space.value = config.presetId === "legacy" ? "" : config.presetId;
  f.elements.width.value = config.widthM;
  f.elements.depth.value = config.depthM;
  for (const k of ["sun", "mood"]) f.elements[k].value = profile[k];
  for (const r of f.elements.transfer) r.checked = false;
  for (const r of f.elements.zoneTransfer) r.checked = false;
  previewSpace();
  $("#conditions").showModal();
}
$("#preset").onchange = () => {
  const p = PRESETS[$("#preset").value];
  if (p) {
    $("#condition-form").elements.width.value = p.widthM;
    $("#condition-form").elements.depth.value = p.depthM;
  }
  previewSpace();
};
document.querySelectorAll("[name=zoneTransfer]").forEach(r=>r.onchange=previewSpace);
for (const k of ["width", "depth"])
  $("#condition-form").elements[k].oninput = previewSpace;
$("#start").onclick =
  $("#profile-open").onclick =
  $("#edit-profile").onclick =
    openConditions;
$("#skip").onclick = () => {
  editMode();
  setTool(null);
};
$("#condition-skip").onclick = () => $("#conditions").close();
$("#condition-form").onsubmit = (e) => {
  e.preventDefault();
  previewSpace();
  if (!draftConfig) return;
  const zoneChoice=new FormData(e.currentTarget).get("zoneTransfer");
  if(requiresZoneTransfer&&!zoneChoice)return toast("직접 편집한 화단의 유지 또는 별도 저장 후 초기화를 선택해주세요.");
  if(zoneTransferError)return toast(zoneTransferError);
  const f = e.currentTarget,
    changed = JSON.stringify(config) !== JSON.stringify(draftConfig),
    choice = new FormData(f).get("transfer");
  if (changed && items.length + pending.length && !choice) {
    toast("배치 이전 방법을 선택해주세요.");
    $("#space-impact").textContent =
      "현재 배치를 이전할지, 별도 저장 후 시작할지 선택해주세요.";
    return;
  }
  if (changed && (choice === "archive" || (requiresZoneTransfer&&zoneChoice==="reset"))) {
    try {
      writeSlot(data(), STORAGE_KEY + "-archive-" + Date.now());
    } catch {
      return toast("별도 저장에 실패했습니다. 현재 정원을 유지합니다.");
    }
  }
  snapshot();
  if (changed) {
    const result = relocate(items, draftConfig);
    config = draftConfig;
    if (choice === "archive" || (!items.length && !pending.length)) {
      items = !config.customZones && config.presetId === "front" && config.widthM === 6 && config.depthM === 4.5 ? artScene().items : populate(config);
      pending = [];
    } else {
      items = result.items;
      pending.push(...result.pending);
    }
    items=items.map(i=>i.catalogId&&!PLANTS_V6[i.type]?{...i,...itemReference(i.type,visualProfile(config))}:i);
    engine.setConfig(config);
  }
  profile = {
    space: PRESETS[config.presetId].name,
    size: `${config.widthM} × ${config.depthM} m`,
    sun: f.elements.sun.value,
    mood: f.elements.mood.value,
  };
  nextId = Math.max(
    1,
    ...items.map((i) => i.id + 1),
    ...pending.map((p) => p.item.id + 1),
  );
  selected = null;
  setTool(null);
  sync();
  updateCaption();
  $("#conditions").close();
  editMode();
  toast("공간을 적용했습니다. 이동 대기함의 요소도 보관됩니다.");
};
$("#pending-open").onclick = () => {
  $("#pending-list").replaceChildren();
  for (const p of pending) {
    const row = document.createElement("div"),
      b = document.createElement("button"),
      desc = document.createElement("small");
    b.textContent = (CATALOG[p.item.type]?.name || p.item.type) + " · 자리 찾기 ↗";
    b.disabled=!referenceValid(p.item);
    desc.textContent = p.reason;
    b.onclick = () => {
      setTool(p.item.type);
      pendingId = p.item.id;
      rotation = p.item.r;
      $("#pending-dialog").close();
      changeView("edit");
      tool = p.item.type;
      pendingId = p.item.id;
      rotation = p.item.r;
      preview();
    };
    row.append(b, desc);
    $("#pending-list").append(row);
  }
  $("#pending-dialog").showModal();
};
document
  .querySelectorAll("[data-close]")
  .forEach((b) => (b.onclick = () => $("#" + b.dataset.close).close()));
function data() {
  return encode({
    config,
    items,
    pending,
    profile,
    wish,
    camera: engine.controller.state(engine.view),
  });
}
function restore(d) {
  const configChanged =
    JSON.stringify(config) !== JSON.stringify(d.sceneConfig);
  config = d.sceneConfig;
  items = d.items;
  pending = d.pending;
  profile = d.profile;
  wish = d.wish;
  if (configChanged) engine.setConfig(config, false);
  engine.controller.restore(d.camera);
  nextId = Math.max(
    1,
    ...items.map((i) => i.id + 1),
    ...pending.map((p) => p.item.id + 1),
  );
  selected = null;
  pendingId = null;
  tool = null;
  moving = false;
  changeView(d.camera?.view || "edit");
  updateCaption();
}
function save() {
  if(patchEditor?.active)return toast("면 편집의 변경 적용 후 저장해주세요.");
  zoneEditor?.cancel();
  try {
    writeSlot(data());
    toast("이 브라우저에 저장했습니다. 신청·전송은 이루어지지 않아요.");
    return true;
  } catch {
    toast("저장 공간을 사용할 수 없어요. JSON으로 내보내주세요.");
    return false;
  }
}
function load() {
  if(patchEditor?.active)return toast("면 편집을 적용하거나 취소해주세요.");
  zoneEditor?.cancel();
  try {
    const saved = readSlot();
    snapshot();
    restore(saved);
    sync();
    editMode();
    toast("정원·치수·이동 대기함을 불러왔습니다.");
  } catch (e) {
    toast(e.message + " 현재 정원은 유지됩니다.");
  }
}
$("#save").onclick = save;
$("#load").onclick = load;
function importData(raw) {
  if(patchEditor?.active)return false;
  zoneEditor?.cancel();
  try {
    const saved = decode(raw);
    snapshot();
    restore(saved);
    sync();
    editMode();
    $("#import-dialog").close();
    toast(
      saved.migratedFrom === 2
        ? "V2를 8 × 8 m 이전 예시 공간으로 가져왔습니다. V2 저장은 보존됩니다."
        : "정원 데이터를 불러왔습니다.",
    );
    return true;
  } catch (e) {
    toast("가져오기 실패: " + e.message + " 현재 정원은 유지됩니다.");
    return false;
  }
}
$("#import-open").onclick = () => {
  if(patchEditor?.active)return toast("면 편집을 적용하거나 취소해주세요.");
  zoneEditor?.cancel();
  interaction.cancel();
  $("#archive-list").replaceChildren();
  try {
    for (const key of Object.keys(localStorage)
      .filter((k) => k.startsWith(STORAGE_KEY + "-archive-"))
      .sort()
      .reverse()) {
      const b = document.createElement("button");
      b.textContent =
        "별도 저장 · " +
        new Date(+key.split("-").at(-1)).toLocaleString("ko-KR");
      b.onclick = () => importData(localStorage.getItem(key));
      $("#archive-list").append(b);
    }
  } catch {}
  $("#import-dialog").showModal();
};
$("#import-file").onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  if (f.size > 2_000_000) {
    toast("JSON 파일은 2 MB 이하로 가져와주세요.");
    e.target.value = "";
    return;
  }
  importData(await f.text());
  e.target.value = "";
};
$("#previous-load").onclick=()=>{
 try{const raw=localStorage.getItem("owol-garden-zones-v4")||localStorage.getItem("owol-art-study-01")||localStorage.getItem("owol-garden-v3");if(!raw)return toast("이 주소에 이전 저장이 없습니다. 이전 JSON을 가져와주세요.");importData(raw);}catch{toast("이전 저장을 읽을 수 없습니다.");}
};
$("#legacy-load").onclick = () => {
  try {
    const raw = localStorage.getItem("owol-garden-v2");
    if (!raw)
      return toast(
        "이 주소에 저장된 V2 정원이 없습니다. V2 JSON 파일을 가져와주세요.",
      );
    importData(raw);
  } catch {
    toast("저장소를 읽을 수 없습니다.");
  }
};
function download(url, name) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
}
$("#scene-png").onclick = () => {
  download(engine.image(), "OWOL-garden-v6.png");
  toast("정원 이미지를 저장했습니다.");
};
function summaries() {
  const count = {};
  for (const i of items) count[i.type] = (count[i.type] || 0) + 1;
  const plants = Object.entries(count)
    .filter(([t]) => CATALOG[t].category === "plants")
    .map(([t, n]) => `${CATALOG[t].name} ${n}`);
  const material = Object.entries(count)
    .filter(([t]) => CATALOG[t].category === "surface")
    .map(([t]) => CATALOG[t].name);
  return {
    plants: plants.join(" · ") || "아직 고른 식물이 없습니다.",
    material: (material.join(" · ") || "개별 포장 없음") + (config.composition ? " · "+Object.entries(areaSummary(config)).filter(([k])=>k!=="site"&&k!=="planter").map(([k,n])=>({planting:"식재",lawn:"잔디",paving:"포장",building:"건물",soil:"흙"}[k])+" "+n.toFixed(2)+" m²").join(" · ") : ""),
  };
}
function openBoard() {
  if(patchEditor?.active)return toast("면 편집을 적용하거나 취소해주세요.");
  zoneEditor?.cancel();
  boardImage = engine.image();
  $("#board-image").src = boardImage;
  $("#board-conditions").replaceChildren();
  const names = {
    space: "공간 유형",
    size: "대략적인 크기",
    sun: "햇빛 정도",
    mood: "원하는 분위기",
  };
  for (const [k, v] of Object.entries(profile)) {
    const d = document.createElement("div"),
      label = document.createElement("span");
    label.textContent = names[k];
    d.append(label, document.createTextNode(v));
    $("#board-conditions").append(d);
  }
  const s = summaries();
  $("#board-elements").textContent = s.plants;
  $("#board-materials").textContent = s.material;
  $("#wish").value = wish;
  $("#board").showModal();
}
$("#board-open").onclick = openBoard;
$("#wish").addEventListener("input", (e) => (wish = e.target.value));
$("#board-save").onclick = save;
$("#board-json").onclick = $("#export-json").onclick = () => {
  if ($("#board").open) wish = $("#wish").value;
  const blob = new Blob([JSON.stringify(data(), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  download(url, "OWOL-taste-board-v5.json");
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
function wrap(ctx, text, x, y, maxWidth, lineHeight) {
  let line = "";
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxWidth) {
      ctx.fillText(line, x, y);
      line = ch;
      y += lineHeight;
    } else line += ch;
  }
  if (line) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  return y;
}
$("#board-png").onclick = async () => {
  wish = $("#wish").value;
  const c = document.createElement("canvas");
  c.width = 1400;
  c.height = 1470;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#f5f2e9";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#294635";
  ctx.font = "64px Georgia";
  ctx.fillText("owol", 65, 90);
  ctx.font = "16px sans-serif";
  ctx.fillText("MY GARDEN / 나의 정원 취향 보드", 65, 135);
  ctx.fillStyle = "#8c987f";
  ctx.fillRect(65, 163, 1270, 1);
  const img = new Image();
  img.src = boardImage;
  await img.decode();
  const imageHeight = 600;
  ctx.save();
  ctx.beginPath();
  ctx.rect(65, 190, 1270, imageHeight);
  ctx.clip();
  const scale = Math.min(1270 / img.width, imageHeight / img.height);
  ctx.fillStyle = "#e5e8df";
  ctx.fillRect(65, 190, 1270, imageHeight);
  ctx.drawImage(
    img,
    65 + (1270 - img.width * scale) / 2,
    190 + (imageHeight - img.height * scale) / 2,
    img.width * scale,
    img.height * scale,
  );
  ctx.restore();
  ctx.fillStyle = "#778569";
  ctx.font = "16px sans-serif";
  ctx.fillText(sceneLabel(config) + " · 직접 정한 치수의 개념 모델", 65, 825);
  ctx.fillStyle = "#294635";
  ctx.font = "20px sans-serif";
  let y = 875;
  for (const [label, v] of [
    ["공간", profile.space],
    ["크기", profile.size],
    ["햇빛", profile.sun],
    ["분위기", profile.mood],
  ]) {
    ctx.fillText(`${label}  ${v}`, 65, y);
    y += 34;
  }
  const s = summaries();
  ctx.font = "18px sans-serif";
  y = wrap(ctx, "식물  " + s.plants, 65, y + 15, 1270, 29);
  y = wrap(ctx, "재료  " + s.material, 65, y + 8, 1270, 29);
  y = wrap(
    ctx,
    "바라는 정원  " + (wish || "아직 적지 않았습니다."),
    65,
    y + 30,
    1270,
    30,
  );
  ctx.fillStyle = "#7e8b72";
  ctx.font = "16px sans-serif";
  ctx.fillText(
    "상담 준비용 취향 보드 · 실제 접수·전송 없음 · 전문 설계도나 생육 예측이 아닙니다.",
    65,
    1385,
  );
  ctx.fillText(DISCLAIMER, 65, 1418);
  download(c.toDataURL("image/png"), "OWOL-taste-board-v6.png");
};
window.addEventListener("keydown", (e) => {
  if(patchEditor?.active)return;
  if (
    document.querySelector("dialog[open]") ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)
  )
    return;
  if (e.key === "Escape") {
    selected = null;
    setTool(null);
    sync();
  }
  if (engine.view !== "edit") return;
  if (e.key.toLowerCase() === "r") rotate();
  if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault();
    remove();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    e.shiftKey ? redo() : undo();
  }
});
requestAnimationFrame(() => {
  sync();
  palette();
  updateCaption();
  if (matchMedia("(pointer: coarse)").matches)
    $("#camera-hint").textContent =
      "편집: 탭 배치 · 포장만 드래그 / 카메라는 둘러보기에서";
  engine.controller.full(false);
  try{const latest=readLatest();if(latest.data){restore(latest.data);sync();editMode();toast("이 브라우저의 최근 정원을 복원했습니다.");}else if(latest.invalid)toast("저장 기록을 읽을 수 없습니다. 원본 기록은 유지했습니다. JSON 가져오기를 이용해주세요.");}catch{toast("브라우저 저장소를 읽을 수 없습니다. JSON으로 기록을 옮겨주세요.");}
  $("#loading").hidden = true;
  window.owol = {
    state: () =>
      structuredClone({
        items,
        selected,
        tool,
        moving,
        rotation,
        profile,
        wish,
        past: past.length,
        future: future.length,
        view: engine.view,
        config,
        pending,
        camera: engine.controller.state(engine.view),
        interaction: interaction.state(),
        zoneEditor:zoneEditor.state(),
        patchEditor:patchEditor.state(),
      }),
    screen: (x, z) => engine.screen(x, z),
    stats: () => engine.stats(),
    zoneGeometry:()=>config.plantableZones.map(z=>{const m=engine.terrain.root.getObjectByName("planting-surface:"+z.id);m?.geometry.computeBoundingBox();return {id:z.id,height:m?m.position.y+m.geometry.boundingBox.max.y:null,vertices:m?.geometry.attributes.position.count};}),
    benchmark: (n, refreshShadows) => engine.benchmark(n, refreshShadows),
    assetStats: () => assetReport(),
    libraryCounts,
    assetThumbnail:(type,season="foliage")=>{const image=engine.thumbnail(type,season,360,320);engine.render();return image;},
    measurement: (reset = false) => engine.measurement(reset),
    comparisonImage: () => engine.comparisonImage(),
    placementError: (item) => placementError(item, items, config),
  };
});

document.querySelector(".brand").onclick = (e) => {
  e.preventDefault();
  document.querySelector("#studio").classList.remove("editing");
  changeView("edit");
};

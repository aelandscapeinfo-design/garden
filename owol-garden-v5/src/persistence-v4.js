import { CATALOG } from "./catalog.js";
import { createScene } from "./scene-config.js";
import { validSaved, relocate, placementError } from "./rules.js";
import {readCustomZones} from "./zone-state.js";
export const STORAGE_KEY = "owol-garden-zones-v4";
export function validateItem(i) {
  return (
    i &&
    typeof i.type === "string" && Object.hasOwn(CATALOG,i.type) &&
    Number.isSafeInteger(i.id) &&
    i.id >= 0 &&
    Number.isFinite(i.x) &&
    Number.isFinite(i.z) &&
    Math.abs(i.x) < 100 &&
    Math.abs(i.z) < 100 &&
    Number.isFinite(i.r) &&
    Math.abs(i.r) < 100000 &&
    Number.isFinite(i.scale) &&
    i.scale >= 0.5 &&
    i.scale <= 1.6 &&
    Number.isInteger(i.variant) &&
    i.variant >= 0 &&
    i.variant <= 2 &&
    ["sx", "sz"].every(
      (k) =>
        i[k] === undefined ||
        (Number.isFinite(i[k]) && i[k] >= 0.5 && i[k] <= 4),
    )
  );
}
const cleanItem = (i) =>
  Object.fromEntries(
    ["id", "type", "x", "z", "r", "scale", "variant", "sx", "sz"]
      .filter((k) => i[k] !== undefined)
      .map((k) => [k, i[k]]),
  );
function profile(p) {
  return Object.fromEntries(
    ["space", "size", "sun", "mood"].map((k) => [
      k,
      typeof p?.[k] === "string" ? p[k].slice(0, 80) : "모르겠어요",
    ]),
  );
}
function camera(v, c) {
  if (!v) return null;
  const ok = (a) =>
    Array.isArray(a) &&
    a.length === 3 &&
    a.every((x) => Number.isFinite(x) && Math.abs(x) < 100);
  if (
    !ok(v.position) ||
    !ok(v.target) ||
    v.position[1] < 0.2 ||
    v.position[1] > 80 ||
    Math.hypot(...v.position.map((x, i) => x - v.target[i])) < 0.5 ||
    !["edit", "browse", "entrance", "seat"].includes(v.view)
  )
    throw Error("카메라 상태가 올바르지 않습니다.");
  return { position: v.position, target: v.target, view: v.view };
}
export function decode(raw) {
  let d = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (d?.version === 2) {
    if (!validSaved(d) || !d.items.every(validateItem)) throw Error("V2 데이터를 확인해주세요.");
    const config = createScene("legacy", 8, 8, 624);
    return {
      version: 4,
      sceneConfig: config,
      items: d.items.map(cleanItem),
      pending: [],
      profile: profile(d.profile),
      wish: typeof d.wish === "string" ? d.wish.slice(0, 120) : "",
      camera: null,
      migratedFrom: 2,
    };
  }
  if (!d || ![3,4].includes(d.version) || d.sceneConfig?.schemaVersion !== 3)
    throw Error("지원하지 않는 저장 버전입니다.");
  const q = d.sceneConfig;
  if(d.version===4 && q.customZones!==undefined && typeof q.customZones!=="boolean")throw Error("식재 영역 상태가 올바르지 않습니다.");
  let c = createScene(q.presetId, q.widthM, q.depthM, q.seed);
  // Buildings/circulation are canonical; V4 custom planting controls are
  // independently validated and become the spatial source of truth.
  if (
    !Array.isArray(d.items) ||
    !Array.isArray(d.pending) ||
    d.items.length + d.pending.length > 300
  )
    throw Error("정원 요소 수가 올바르지 않습니다.");
  const seen = new Set();
  for (const i of [...d.items, ...d.pending.map((p) => p.item)]) {
    if (!validateItem(i) || seen.has(i.id))
      throw Error("배치 데이터가 올바르지 않습니다.");
    seen.add(i.id);
  }
  const items = d.items.map(cleanItem);
  if(d.version===4 && q.customZones===true)c=readCustomZones(c,q,items);
  for (const i of items)
    if (placementError(i, items, c))
      throw Error("공간 규칙에 맞지 않는 배치가 포함되어 있습니다.");
  return {
    version: 4,
    sceneConfig: c,
    items,
    pending: d.pending.map((p) => ({
      item: cleanItem(p.item),
      reason:
        typeof p.reason === "string"
          ? p.reason.slice(0, 160)
          : "다른 자리에 놓아주세요.",
    })),
    profile: profile(d.profile),
    wish: typeof d.wish === "string" ? d.wish.slice(0, 120) : "",
    camera: camera(d.camera, c),
  };
}
export function encode({ config, items, pending, profile, wish, camera }) {
  return {
    version: 4,
    sceneConfig: config,
    items,
    pending,
    profile,
    wish,
    camera,
    metadata: {
      purpose: "garden-preference-study",
      plantModelData: "visual-only",
      botanicalDatabaseConnected: false,
      representsRealSite: false,
    },
  };
}
export function readSlot(key = STORAGE_KEY) {
  const raw = localStorage.getItem(key);
  if (!raw) throw Error("저장한 정원이 없습니다.");
  return decode(raw);
}
export function writeSlot(data, key = STORAGE_KEY) {
  localStorage.setItem(key, JSON.stringify(data));
}

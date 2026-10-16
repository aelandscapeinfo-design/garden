import {fromRing,intersection,measure,disk} from "./region-geometry.js";
import {protectedAreas} from "./zone-state.js";
import {intersectionArea,polygonDistance} from "./zone-geometry.js";
import { CATALOG } from "./catalog.js";
import {
  placementError as legacyPlacement,
  validSaved,
} from "./legacy-rules.js";
import { fits, overlaps, plantingZone } from "./scene-config.js";
export { validSaved };
export function placementError(item, items, c) {
  if (!c || c.presetId === "legacy") return legacyPlacement(item, items);
  const d = CATALOG[item.type];
  if (!d) return "사용할 수 없는 소재입니다.";
  const r = (item.type === "wood" ? .57 : item.type === "stone" ? .44 : d.radius) * (item.scale || 1),
    plant = d.category === "plants";
  const a = ((item.r || 0) * Math.PI) / 180,
    s = item.scale || 1;
  const footprint =
    item.type === "bench"
      ? [
          [-0.83, -0.35],
          [0.83, -0.35],
          [-0.83, 1.05],
          [0.83, 1.05],
        ].map(([x, z]) => [
          item.x + (x * Math.cos(a) + z * Math.sin(a)) * s,
          item.z + (-x * Math.sin(a) + z * Math.cos(a)) * s,
        ])
      : null;
  if (
    !fits(
      c.boundary,
      item.x,
      item.z,
      item.type === "gravel" || item.type === "bench" ? 0 : r,
    ) ||
    footprint?.some(([x, z]) => !fits(c.boundary, x, z, 0.02))
  )
    return "정원 경계 안에 놓아주세요.";
  for (const o of c.obstacles)
    if (
      overlaps(o.polygon, item.x, item.z, item.type === "bench" ? .45 : r) ||
      footprint?.some(([x, z]) => overlaps(o.polygon, x, z, 0.05))
    )
      return "벽·난간·건물 내부에는 놓을 수 없어요.";
  for (const o of c.openings)
    if (
      (plant || item.type === "bench") &&
      (overlaps(o.clearance, item.x, item.z, r * 0.7) ||
        footprint?.some(([x, z]) => overlaps(o.clearance, x, z, 0.03)))
    )
      return "문 앞과 출입 동선을 비워주세요.";
  if (plant) {
    if (!plantingZone(c, item.x, item.z, r * 0.75))
      return ["terrace", "rooftop"].includes(c.presetId)
        ? "식물은 지정된 화분·플랜터 안에 놓아주세요."
        : "식물은 노지 화단 안에 놓아주세요.";
    if (
      c.surfaces.some(
        (o) =>
          o.material !== "turf" && overlaps(o.polygon, item.x, item.z, r * 0.7),
      ) &&
      !c.composition && !["terrace", "rooftop", "courtyard"].includes(c.presetId)
    )
      return "길과 앉는 자리는 비워주세요.";
  }
  if (
    !plant &&
    c.plantableZones.some(
      (o) =>
        o.kind === "planter" &&
        (c.composition ? measure(intersection(o.geometry,disk(item.x,item.z,r)))>1e-7 : (overlaps(o.polygon, item.x, item.z, r) ||
          footprint?.some(([x, z]) => overlaps(o.polygon, x, z, 0.03)))),
    )
  )
    return "플랜터를 가구나 포장으로 덮을 수 없어요.";
  // Keep every accepted V4 placement loadable: custom contours cannot later
  // be covered by new paving or a bench/approach footprint.
  if(!plant && c.composition){
    const geometry=footprint?fromRing([footprint[0],footprint[1],footprint[3],footprint[2]]):disk(item.x,item.z,r);
    if(c.plantableZones.some(z=>measure(intersection(z.geometry,geometry))>1e-7))return "식재 면·플랜터 위에는 가구나 포장을 놓을 수 없어요.";
  }
  if(!plant && c.customZones){
    const footprint=protectedAreas(c,[item]).find(o=>o.id===(item.type==="bench"?"bench-":"paving-")+item.id);
    if(footprint && c.plantableZones.some(z=>z.origin==="custom" &&
      (intersectionArea(z.polygon,footprint.polygon)>1e-8 || polygonDistance(z.polygon,footprint.polygon)<.02+(z.kind==="planter"?.0375:.0075)-1e-8)))
      return "직접 편집한 화단과 테두리를 가구·포장으로 덮을 수 없어요.";
  }
  // Reuse the tested V2 pairwise rules in an unbounded temporary coordinate frame.
  // Its hard-coded boundary is bypassed by only invoking the extracted pair checks.
  return pairError(item, items);
}
function local(i, x, z) {
  const a = ((i.r || 0) * Math.PI) / 180,
    dx = x - i.x,
    dz = z - i.z;
  return {
    x: dx * Math.cos(a) - dz * Math.sin(a),
    z: dx * Math.sin(a) + dz * Math.cos(a),
  };
}
function paved(i, x, z, r) {
  const p = local(i, x, z);
  if (i.type === "gravel")
    return (
      (p.x / (0.46 * (i.sx || i.scale || 1) + r)) ** 2 +
        (p.z / (0.46 * (i.sz || i.scale || 1) + r)) ** 2 <
      1
    );
  return (
    Math.abs(p.x) < (i.type === "wood" ? 0.39 : 0.36) * (i.scale || 1) + r &&
    Math.abs(p.z) < (i.type === "wood" ? 0.43 : 0.3) * (i.scale || 1) + r
  );
}
export function pairError(item, items) {
  const d = CATALOG[item.type],
    s = item.scale || 1,
    r = d.radius * s;
  for (const o of items) {
    if (o.id === item.id) continue;
    const od = CATALOG[o.type],
      os = o.scale || 1,
      dist = Math.hypot(o.x - item.x, o.z - item.z);
    if (
      d.category === "plants" &&
      od.category === "surface" &&
      paved(o, item.x, item.z, r * 0.65)
    )
      return "길과 포장에는 식물을 심을 수 없어요.";
    if (
      d.category === "surface" &&
      od.category === "plants" &&
      paved(item, o.x, o.z, od.radius * os * 0.65)
    )
      return "식물이 있는 곳에는 포장할 수 없어요.";
    for (const [b, p, pd] of [
      [item, o, od],
      [o, item, d],
    ])
      if (
        b.type === "bench" &&
        (pd.category === "plants" || p.type === "bench")
      ) {
        const q = local(b, p.x, p.z),
          bs = b.scale || 1,
          pr = pd.radius * (p.scale || 1);
        if (
          Math.abs(q.x) < 0.9 * bs + pr * 0.5 &&
          q.z > -0.37 * bs - pr * 0.5 &&
          q.z < 1.07 * bs + pr * 0.5
        )
          return "벤치와 앞쪽에 앉을 공간을 비워주세요.";
      }
    if(item.type==="tree"&&od.category==="plants"&&o.type!=="tree"&&dist<.24)return "나무 줄기 바로 위에는 놓을 수 없어요.";
    if (d.solid && od.solid && dist < r + od.radius * os + 0.05)
      return "나무 줄기와 벤치가 겹치지 않게 놓아주세요.";
    if (
      d.category === "plants" &&
      o.type === "tree" &&
      item.type !== "tree" &&
      dist < 0.24
    )
      return "나무 줄기 바로 위에는 놓을 수 없어요.";
  }
  return null;
}
export function relocate(items, c) {
  const placed = [],
    pending = [];
  for (const item of items) {
    const reason = placementError(item, placed, c);
    reason
      ? pending.push({ item: { ...item }, reason })
      : placed.push({ ...item });
  }
  return { items: placed, pending };
}

import { CATALOG } from "./catalog.js";
import { pavingAt } from "./layout.js";
function local(item, x, z) {
  const a = ((item.r || 0) * Math.PI) / 180,
    dx = x - item.x,
    dz = z - item.z;
  return {
    x: dx * Math.cos(a) - dz * Math.sin(a),
    z: dx * Math.sin(a) + dz * Math.cos(a),
  };
}
export function placementError(item, items) {
  const data = CATALOG[item.type];
  if (!data) return "사용할 수 없는 소재입니다.";
  const s = item.scale || 1,
    r = data.radius * s;
  if (item.type === "gravel") {
    if (Math.abs(item.x) > 4 || Math.abs(item.z) > 4)
      return " 정원 안에 놓아주세요.";
  } else if (item.type === "bench") {
    const a = ((item.r || 0) * Math.PI) / 180,
      w = (Math.abs(Math.cos(a)) * 0.83 + Math.abs(Math.sin(a)) * 0.35) * s,
      d = (Math.abs(Math.sin(a)) * 0.83 + Math.abs(Math.cos(a)) * 0.35) * s;
    if (Math.abs(item.x) + w > 4 || Math.abs(item.z) + d > 4)
      return "벤치가 정원 경계를 벗어납니다.";
  } else {
    const foot = data.category === "plants" ? r : Math.min(r, 0.43);
    if (Math.abs(item.x) + foot > 3.98 || Math.abs(item.z) + foot > 3.98)
      return "정원 안에 놓아주세요.";
  }
  if (
    data.category === "plants" &&
    pavingAt(items, item.x, item.z, r * 0.7 + 0.025, item.id)
  )
    return "길과 포장에는 식물을 심을 수 없어요.";
  if (item.type === "bench" && pavingAt(items, item.x, item.z, 0, item.id)) {
    const a = ((item.r || 0) * Math.PI) / 180;
    const corners = [
      [-0.76, -0.26],
      [0.76, -0.26],
      [-0.76, 0.75],
      [0.76, 0.75],
    ];
    if (
      !corners.every(([x, z]) =>
        pavingAt(
          items,
          item.x + (x * Math.cos(a) + z * Math.sin(a)) * s,
          item.z + (-x * Math.sin(a) + z * Math.cos(a)) * s,
          0,
          item.id,
        ),
      )
    )
      return "좁은 통로를 비워주세요. 벤치와 앞쪽에 넉넉한 자리가 필요해요.";
  }
  for (const other of items) {
    if (other.id === item.id) continue;
    const od = CATALOG[other.type];
    if (!od) continue;
    const dist = Math.hypot(other.x - item.x, other.z - item.z);
    if (item.type === "bench" && od.category === "plants") {
      const p = local(item, other.x, other.z);
      if (
        Math.abs(p.x) < 0.93 * s + od.radius * 0.6 &&
        p.z > -0.39 * s - od.radius * 0.5 &&
        p.z < 1.12 * s + od.radius * 0.5
      )
        return "벤치와 앞쪽에 앉을 공간을 비워주세요.";
    }
    if (
      other.type === "bench" &&
      (data.category === "plants" || item.type === "bench")
    ) {
      const p = local(other, item.x, item.z);
      const os = other.scale || 1;
      if (
        Math.abs(p.x) < 0.93 * os + r * 0.55 &&
        p.z > -0.39 * os - r * 0.5 &&
        p.z < 1.12 * os + r * 0.5
      )
        return "벤치 앞에 머물 공간을 비워주세요.";
    }
    if (
      data.solid &&
      od.solid &&
      dist < r + od.radius * (other.scale || 1) + 0.05
    )
      return "나무 줄기와 벤치가 겹치지 않게 놓아주세요.";
    if (
      data.category === "surface" &&
      od.category === "plants" &&
      pavingAt([item], other.x, other.z, od.radius * 0.65)
    )
      return "식물이 있는 곳에는 포장할 수 없어요.";
    if (
      data.category === "plants" &&
      od.solid &&
      other.type === "tree" &&
      dist < 0.22 &&
      item.type !== "tree"
    )
      return "나무 줄기 바로 위에는 놓을 수 없어요.";
  }
  return null;
}
export function validSaved(data) {
  if (
    !data ||
    data.version !== 2 ||
    !Array.isArray(data.items) ||
    data.items.length > 300
  )
    return false;
  const seen = new Set();
  for (const i of data.items) {
    if (
      !CATALOG[i.type] ||
      !Number.isInteger(i.id) ||
      seen.has(i.id) ||
      !Number.isFinite(i.x) ||
      !Number.isFinite(i.z) ||
      Math.abs(i.x) > 4.01 ||
      Math.abs(i.z) > 4.01 ||
      !Number.isFinite(i.r) ||
      !Number.isFinite(i.scale) ||
      i.scale < 0.5 ||
      i.scale > 1.6 ||
      !Number.isInteger(i.variant) ||
      i.variant < 0 ||
      i.variant > 2
    )
      return false;
    if (
      i.sx !== undefined &&
      (!Number.isFinite(i.sx) || i.sx < 0.5 || i.sx > 4)
    )
      return false;
    if (
      i.sz !== undefined &&
      (!Number.isFinite(i.sz) || i.sz < 0.5 || i.sz > 4)
    )
      return false;
    seen.add(i.id);
  }
  return true;
}

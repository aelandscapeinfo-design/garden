import * as T from "three";
import { random, CATALOG } from "./catalog.js";
export const GARDEN_SIZE = 8;
export const SEATING = { x: 2, z: -2.7, w: 2.9, d: 2.1 };
export const BED_LEFT = [
  [-3.9, -3.9],
  [-0.1, -3.9],
  [0.25, -2.75],
  [-0.85, -1.35],
  [-1.25, 0.05],
  [-0.7, 1.9],
  [-0.1, 3.5],
  [-1.7, 3.85],
  [-3.9, 3.7],
];
export const BED_RIGHT = [
  [3.9, -1.55],
  [2.9, -1.45],
  [1.75, -0.8],
  [0.7, 0.35],
  [1.1, 1.65],
  [1.6, 3.85],
  [3.9, 3.9],
];
export function pavingAt(items, x, z, radius = 0, exclude = null) {
  return items.some((i) => {
    if (i.id === exclude || CATALOG[i.type]?.category !== "surface")
      return false;
    if (i.type === "gravel") {
      const rx = 0.46 * (i.sx || i.scale || 1) + radius,
        rz = 0.46 * (i.sz || i.scale || 1) + radius;
      return ((x - i.x) / rx) ** 2 + ((z - i.z) / rz) ** 2 < 1;
    }
    const a = ((i.r || 0) * Math.PI) / 180,
      dx = x - i.x,
      dz = z - i.z,
      xx = dx * Math.cos(a) - dz * Math.sin(a),
      zz = dx * Math.sin(a) + dz * Math.cos(a);
    return (
      Math.abs(xx) < (i.type === "wood" ? 0.39 : 0.36) + radius &&
      Math.abs(zz) < (i.type === "wood" ? 0.43 : 0.3) + radius
    );
  });
}
export function seedGarden() {
  const items = [];
  let id = 1;
  const r = random(624);
  function add(type, x, z, extra = {}) {
    const isPlant = CATALOG[type].category === "plants";
    const item = {
      id: id++,
      type,
      x,
      z,
      r: extra.r ?? Math.round(r() * 24) * 15,
      scale: isPlant ? 0.9 + r() * 0.16 : 1,
      variant: Math.floor(r() * 3),
      ...extra,
    };
    items.push(item);
    return item;
  }
  const path = new T.CatmullRomCurve3([
    new T.Vector3(0.55, 0, 4.0),
    new T.Vector3(0.5, 0, 2.55),
    new T.Vector3(-0.15, 0, 1.05),
    new T.Vector3(-0.23, 0, -0.25),
    new T.Vector3(0.65, 0, -1.35),
    new T.Vector3(1.65, 0, -2.15),
  ]);
  for (let i = 0; i < 24; i++) {
    const p = path.getPoint(i / 23);
    add("gravel", p.x, p.z, { scale: 1.36, r: 0, variant: 0 });
  }
  add("gravel", 2, -2.72, { sx: 3.3, sz: 2.3, scale: 1, r: 0 });
  // The bench faces the clear terrace and the entrance; no planting in its approach.
  add("bench", 2, -3.28, { r: 0, scale: 1, variant: 0 });
  for (const [x, z, a] of [
    [0.54, 3.35, -8],
    [0.34, 2.62, 9],
    [-0.03, 1.85, -6],
    [-0.26, 0.98, 14],
  ])
    add("stone", x, z, { r: a, scale: 1.05 });
  for (const [x, z, s, a] of [
    [-2.65, -2.72, 1.02, 32],
    [-0.34, -3.25, 0.88, 147],
    [3.12, 0.65, 0.9, 218],
  ])
    add("tree", x, z, { scale: s, r: a });
  function drift(type, cx, cz, rx, rz, count, phase = 0) {
    let placed = 0;
    for (let k = 0; k < 400 && placed < count; k++) {
      const angle = k * 2.399 + phase,
        rad = Math.sqrt(r());
      const x = cx + Math.sin(angle) * rx * rad,
        z = cz + Math.cos(angle) * rz * rad;
      const radius = CATALOG[type].radius;
      if (
        Math.abs(x) > 3.65 ||
        Math.abs(z) > 3.65 ||
        pavingAt(items, x, z, radius + 0.08)
      )
        continue;
      if (((x + 2.25) / 1.05) ** 2 + ((z - 0.75) / 1.25) ** 2 < 0.94) continue;
      if (
        items.some(
          (i) =>
            CATALOG[i.type].category === "plants" &&
            Math.hypot(i.x - x, i.z - z) <
              (i.type === "tree" ? 0.25 : i.type === type ? 0.27 : 0.2),
        )
      )
        continue;
      add(type, +x.toFixed(3), +z.toFixed(3), {
        r: Math.round((phase * 50 + (r() - 0.5) * 110) / 15) * 15,
      });
      placed++;
    }
  }
  drift("shrub", -2, -3.03, 1.4, 0.4, 6);
  drift("shrub", 3.3, -0.9, 0.45, 0.65, 4);
  drift("shrub", -3.2, 2.6, 0.4, 0.5, 3);
  drift("hosta", -2.65, -1.72, 0.85, 0.65, 9, 0.7);
  drift("hosta", 2.8, -0.4, 0.7, 0.7, 8, 1);
  drift("hosta", -2.1, 2.8, 0.65, 0.55, 6, 2);
  drift("flower", -1.55, -0.75, 0.7, 0.9, 13, 0.4);
  drift("flower", 2.5, 1.85, 0.7, 1.1, 15, 1.2);
  drift("grass", -1.05, -2.4, 0.55, 0.65, 5, 0.8);
  drift("grass", 3.2, 2.7, 0.45, 0.9, 8, 1.6);
  drift("grass", -3.15, -0.7, 0.4, 0.6, 4, 2);
  drift("meadow", -2.95, 2.05, 0.6, 0.55, 8, 0.4);
  drift("meadow", 1.65, 2.9, 0.45, 0.7, 8, 2);
  drift("cover", -1.05, 2.55, 0.5, 1, 9, 0.6);
  drift("cover", -2.3, -2.8, 1.2, 0.5, 9, 1.4);
  drift("cover", 3.0, 1.1, 0.55, 0.65, 7, 0.5);
  drift("cover", -3.3, 1.8, 0.35, 0.6, 6, 2);
  return items;
}

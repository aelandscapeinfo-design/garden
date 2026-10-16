import {contains} from './region-geometry.js';
import {containsDisk} from './zone-geometry.js';
// One metre per world unit. These are conceptual spaces, never measured sites.
export const PRESETS = {
  front: {
    name: "주택 앞마당",
    widthM: 8,
    depthM: 6,
    subtitle: "문 앞에서 시작되는 작은 숲",
    floor: "soil",
  },
  terrace: {
    name: "테라스",
    widthM: 6,
    depthM: 3,
    subtitle: "집과 하늘 사이의 쉼",
    floor: "wood",
  },
  courtyard: {
    name: "중정",
    widthM: 6,
    depthM: 6,
    subtitle: "벽 안에 담긴 빛과 잎",
    floor: "stone",
  },
  rooftop: {
    name: "옥상",
    widthM: 10,
    depthM: 6,
    subtitle: "도시 위에 놓인 정원",
    floor: "stone",
  },
  legacy: {
    name: "V2 예시 정원",
    widthM: 8,
    depthM: 8,
    subtitle: "이전 정원의 기록",
    floor: "soil",
  },
};
export const rect = (x, z, w, d) => [
  [x - w / 2, z - d / 2],
  [x + w / 2, z - d / 2],
  [x + w / 2, z + d / 2],
  [x - w / 2, z + d / 2],
];
export function inside(polygon, x, z) {
  let yes = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, az] = polygon[i],
      [bx, bz] = polygon[j];
    if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax)
      yes = !yes;
  }
  return yes;
}
export function fits(poly, x, z, r = 0) {
  return containsDisk(poly,x,z,r);
}
export function overlaps(poly, x, z, r = 0) {
  return (
    inside(poly, x, z) ||
    poly.some(([a, b]) => Math.hypot(a - x, b - z) < r) ||
    poly.some(([ax, az], i) => {
      const [bx, bz] = poly[(i + 1) % poly.length],
        dx = bx - ax,
        dz = bz - az,
        t = Math.max(
          0,
          Math.min(
            1,
            ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1),
          ),
        );
      return Math.hypot(x - ax - t * dx, z - az - t * dz) < r;
    })
  );
}
export function createScene(
  presetId = "front",
  widthM = PRESETS[presetId]?.widthM,
  depthM = PRESETS[presetId]?.depthM,
  seed = 3107,
) {
  if (
    !Object.hasOwn(PRESETS,presetId) ||
    !Number.isFinite(widthM) ||
    !Number.isFinite(depthM) ||
    widthM < 3 ||
    widthM > 16 ||
    depthM < 3 ||
    depthM > 16 ||
    !Number.isInteger(seed) ||
    seed < 0 ||
    seed > 2147483647
  )
    throw Error("공간 유형과 치수(3–16 m)를 확인해주세요.");
  if (presetId === "legacy" && (widthM !== 8 || depthM !== 8))
    throw Error("V2 공간은 8 × 8 m로 보존됩니다.");
  const w = widthM,
    d = depthM,
    x = w / 2,
    z = d / 2;
  const c = {
    schemaVersion: 3,
    presetId,
    widthM: w,
    depthM: d,
    seed,
    boundary: rect(0, 0, w, d),
    surfaces: [],
    plantableZones: [],
    obstacles: [],
    openings: [],
    walls: [],
    viewpoints: {},
    representsRealSite: false,
  };
  const zone = (id, polygon, height = 0.03) =>
    c.plantableZones.push({
      id,
      polygon,
      height,
      kind: height > 0.1 ? "planter" : "ground",
    });
  const surface = (id, polygon, material, height = 0.025) =>
    c.surfaces.push({ id, polygon, material, height });
  const block = (id, polygon) => c.obstacles.push({ id, polygon });
  const wall = (id, xx, zz, ww, dd, h, style = "plaster") => {
    c.walls.push({ id, x: xx, z: zz, w: ww, d: dd, height: h, style });
    block(id, rect(xx, zz, ww, dd));
  };
  const door = (xx, zz, width = 1.3) => {
    c.openings.push({
      id: "entry-" + c.openings.length,
      x: xx,
      z: zz,
      width,
      height: 2.15,
      clearance: rect(xx, zz + 0.48, width + 0.1, 1.05),
    });
  };
  if (presetId === "front") {
    const cx = Math.min(0.45, w * 0.08),
      gate = 1.35;
    // Deliberately asymmetrical drift edges; a continuous clear path joins both openings.
    zone("west", [
      [-x + 0.15, -z + 0.35],
      [cx - 0.85, -z + 0.35],
      [cx - 0.78, -d * 0.23],
      [cx - 1.05, 0],
      [cx - 0.85, z - 0.18],
      [-x + 0.15, z - 0.18],
    ]);
    zone("east", [
      [cx + 0.83, -z + 2.0],
      [x - 0.18, -z + 2.0],
      [x - 0.18, z - 0.2],
      [cx + 0.9, z - 0.2],
      [cx + 0.68, z * 0.25],
    ]);
    surface("walk", rect(cx, 0, 1.35, d), "gravel", 0.045);
    surface(
      "sitting",
      rect((cx + 0.8 + x) / 2, -z + 1.12, Math.max(0.4, x - cx - 0.8), 1.65),
      "gravel",
      0.045,
    );
    surface(
      "lawn",
      rect(
        -w * 0.29,
        d * 0.11,
        Math.max(0.3, w * 0.2),
        Math.max(0.3, d * 0.27),
      ),
      "turf",
      0.04,
    );
    wall(
      "house-left",
      (-x + cx - gate / 2) / 2,
      -z + 0.04,
      cx - gate / 2 + x,
      0.18,
      2.65,
    );
    wall(
      "house-right",
      (x + cx + gate / 2) / 2,
      -z + 0.04,
      x - cx - gate / 2,
      0.18,
      2.65,
    );
    c.walls.push({
      id: "door-lintel",
      x: cx,
      z: -z + 0.04,
      w: gate,
      d: 0.18,
      height: 0.5,
      y: 2.4,
      style: "plaster",
    });
    door(cx, -z + 0.1, gate);
    wall("west-fence", -x + 0.04, 0.1, 0.1, d - 0.2, 1.05, "slats");
    wall(
      "front-left",
      (-x + cx - 0.78) / 2,
      z - 0.04,
      cx - 0.78 + x,
      0.12,
      0.55,
    );
    wall(
      "front-right",
      (x + cx + 0.78) / 2,
      z - 0.04,
      x - cx - 0.78,
      0.12,
      0.55,
    );
    c.openings.push({
      id: "gate",
      x: cx,
      z: z - 0.05,
      width: 1.56,
      height: 2,
      clearance: rect(cx, z - 0.35, 1.5, 0.7),
    });
    c.bench = { x: Math.max(cx + 1.65, x - 1.05), z: -z + 0.65, r: 0 };
  } else if (presetId === "terrace") {
    surface("deck", rect(0, 0, w, d), "wood", 0.025);
    zone("left-planter", rect(-x + 0.53, 0.08, 0.76, d - 1.0), 0.44);
    zone("right-planter", rect(x - 0.53, 0.08, 0.76, d - 1.0), 0.44);
    const doorway = Math.min(2.2, w - 1.4);
    wall(
      "house-left",
      (-x - doorway / 2) / 2,
      -z + 0.03,
      x - doorway / 2,
      0.18,
      2.65,
    );
    wall(
      "house-right",
      (x + doorway / 2) / 2,
      -z + 0.03,
      x - doorway / 2,
      0.18,
      2.65,
    );
    c.walls.push({
      id: "door-lintel",
      x: 0,
      z: -z + 0.03,
      w: doorway,
      d: 0.18,
      height: 0.5,
      y: 2.4,
      style: "plaster",
    });
    door(0, -z + 0.1, doorway);
    wall("front-railing", 0, z - 0.06, w, 0.08, 1.02, "railing");
    wall("west-railing", -x + 0.04, 0, 0.08, d, 1.02, "railing");
    wall("east-railing", x - 0.04, 0, 0.08, d, 1.02, "railing");
    c.bench = { x: 0, z: Math.max(0.35, z - 0.6), r: 180 };
  } else if (presetId === "courtyard") {
    surface("court", rect(0, 0, w, d), "stone", 0.018);
    zone("west-border", rect(-x + 0.67, 0, 0.9, d - 1.1));
    zone("east-border", rect(x - 0.67, -0.12, 0.9, d - 1.1));
    zone("north-border", rect(0, -z + 0.58, w - 1.5, 0.7));
    const entry = 1.5;
    wall("back-wall", 0, -z + 0.03, w, 0.16, 2.25);
    wall("west-wall", -x + 0.04, 0, 0.13, d, 1.85);
    wall("east-wall", x - 0.04, 0, 0.13, d, 1.05);
    wall(
      "front-left",
      (-x - entry / 2) / 2,
      z - 0.04,
      x - entry / 2,
      0.15,
      1.0,
    );
    wall(
      "front-right",
      (x + entry / 2) / 2,
      z - 0.04,
      x - entry / 2,
      0.15,
      1.0,
    );
    c.openings.push({
      id: "passage",
      x: 0,
      z: z - 0.05,
      width: entry,
      height: 2,
      clearance: rect(0, z - 0.4, 1.55, 0.8),
    });
    c.bench = { x: 0, z: -z + 1.22, r: 0 };
  } else if (presetId === "rooftop") {
    surface("roof", rect(0, 0, w, d), "stone", 0.025);
    for (const [id, xx, zz, ww, dd] of [
      ["north", 0, -z + 0.07, w, 0.15],
      ["south", 0, z - 0.07, w, 0.15],
      ["west", -x + 0.07, 0, 0.15, d],
      ["east", x - 0.07, 0, 0.15, d],
    ])
      wall("parapet-" + id, xx, zz, ww, dd, 0.7);
    const sw = Math.min(2.0, w * 0.3),
      sd = Math.min(1.2, d * 0.24),
      sx = -x + sw / 2 + 0.22,
      sz = -z + sd / 2 + 0.22;
    c.stair = { x: sx, z: sz, w: sw, d: sd, height: 2.25 };
    block("stairs", rect(sx, sz, sw, sd));
    c.openings.push({
      id: "stair-door",
      x: sx + 0.25,
      z: sz + sd / 2,
      width: 0.95,
      height: 2.0,
      clearance: rect(sx + 0.25, sz + sd / 2 + 0.55, 1.25, 1.1),
    });
    zone("east-planter", rect(x - 0.68, -d * 0.12, 0.85, d * 0.55), 0.46);
    zone("southwest-planter", rect(-w * 0.24, z - 0.65, w * 0.33, 0.8), 0.46);
    zone("north-planter", rect(w * 0.2, -z + 0.62, w * 0.32, 0.72), 0.46);
    c.bench = { x: 0, z: 0, r: 0 };
  } else {
    zone("legacy-ground", rect(0, 0, 8, 8));
    c.bench = { x: 2, z: -3.28, r: 0 };
  }
  c.viewpoints = {
    full: {
      position: [w * 0.94, Math.max(w, d) * 1.05, d * 1.2],
      target: [0, 0.65, 0],
    },
    entrance: {
      position: [presetId === "front" ? 0.45 : 0, 1.65, z - 0.4],
      target: [0, 0.85, -z + 0.9],
    },
    seat: {
      position: [c.bench.x, 1.28, c.bench.z + (c.bench.r === 180 ? -0.5 : 0.5)],
      target: [
        presetId === "terrace" ? 0 : -w * 0.2,
        0.6,
        c.bench.r === 180 ? -z + 0.3 : z - 0.4,
      ],
    },
  };
  return c;
}
export function plantingZone(c, x, z, r = 0) {
  return (c.composition?[...c.plantableZones].sort((a,b)=>b.height-a.height):c.plantableZones).find((p) => (p.geometry?contains(p.geometry,x,z,r):fits(p.polygon,x,z,r)));
}
export function floorHeight(c, x, z, type) {
  const p = plantingZone(c, x, z);
  return type &&
    type !== "bench" &&
    !["gravel", "stone", "wood"].includes(type) &&
    p
    ? p.height
    : c.composition ? Math.max(.035,...c.surfaces.filter(s=>contains(s.geometry,x,z)).map(s=>s.height)) : 0.035;
}
export function sceneLabel(c) {
  return `${c.composition ? "나의 정원" : PRESETS[c.presetId].name} · ${c.widthM} × ${c.depthM} m · ${+(c.widthM * c.depthM).toFixed(2)} m²`;
}

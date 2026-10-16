import * as T from "three";
import {renderStyle} from "./visual-profile.js";
import {makeCompositionTerrain} from "./composition-terrain.js";
import polygonClipping from "polygon-clipping";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { surfaces } from "./models.js";
import { makeTerrain as legacyTerrain } from "./legacy-terrain.js";
import { rect } from "./scene-config.js";
import { toon, addInk } from "./toon-style.js";
import { makeTerrain as originalTerrain, disposeTerrain as disposeOriginal } from "./terrain-v3.js";
const mat = (c, ink=1.0) => toon(c,{ink});
const plaster = mat(0xe4ddc0),
  cap = mat(0xeee5ca,.8),
  metal = mat(0x536557,.65),
  glass = mat(0x6e9184,0),
  terra = mat(0xac8568,.7),
  ground = new T.MeshBasicMaterial({color:0xf0ede2});
const shared = new Set([
  ...Object.values(surfaces),
  plaster,
  cap,
  metal,
  glass,
  terra,
  ground,
]);
export function disposeTerrain(t) {
  if (!t) return;
  if(t.composition){t.dispose();return;}
  if(t.original) return disposeOriginal(t);
  t.root.parent?.remove(t.root);
  t.root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material && !shared.has(o.material) && !o.material.userData.isArtInk) o.material.dispose();
  });
}
function worldUV(g, scale = 1) {
  const p = g.attributes.position,
    uv = g.attributes.uv;
  if (uv)
    for (let i = 0; i < p.count; i++)
      uv.setXY(i, p.getX(i) * scale, p.getZ(i) * scale);
  return g;
}
function polygon(poly, height, material, parent, y = 0) {
  const s = new T.Shape(poly.map(([x, z]) => new T.Vector2(x, -z)));
  const g = new T.ExtrudeGeometry(s, {
    depth: height,
    bevelEnabled: false,
    steps: 1,
  });
  g.rotateX(-Math.PI / 2);
  worldUV(g);
  const m = new T.Mesh(g, material);
  m.position.y = y;
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function makeTerrain(scene, c) {
  if(c.composition)return makeCompositionTerrain(scene,c);
  if (renderStyle(c)!=="toon") { const t=originalTerrain(scene,c);t.original=true;return t; }
  const root = new T.Group();
  root.name = "scene-" + c.presetId;
  scene.add(root);
  const grouped = new Map();
  function box(w, h, d, x, y, z, material = plaster) {
    if (w <= 0 || d <= 0) return;
    const g = new T.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    worldUV(g);
    if (!grouped.has(material)) grouped.set(material, []);
    grouped.get(material).push(g);
  }
  const w = c.widthM,
    d = c.depthM,
    x = w / 2,
    z = d / 2;
  box(w + 0.05, 0.15, d + 0.05, 0, -0.08, 0, plaster);
  const baseMesh = polygon(
    c.boundary,
    0.012,
    c.presetId === "front" ? surfaces.soil : surfaces.stone,
    root,
  );
  baseMesh.name = "measured-site-surface";
  baseMesh.geometry.computeBoundingBox();
  for (const s of c.surfaces) {
    polygon(s.polygon, s.height, surfaces[s.material], root);
    // Actual plank and paving joints, in metre units and rebuilt per size.
    if (s.material === "wood")
      for (let zz = -z + 0.18; zz < z; zz += 0.18)
        box(w, 0.003, 0.008, 0, s.height + 0.002, zz, metal);
    if (s.material === "stone") {
      for (let xx = -x + 0.8; xx < x; xx += 0.8)
        box(0.009, 0.004, d, xx, s.height + 0.003, 0, plaster);
      for (let zz = -z + 0.8; zz < z; zz += 0.8)
        box(w, 0.004, 0.009, 0, s.height + 0.003, zz, plaster);
    }
  }
  for (const p of c.plantableZones) {
    const soil=polygon(p.polygon, p.height, surfaces.mulch, root);
    soil.name="planting-surface:"+p.id;
    for (let j = 0; j < p.polygon.length; j++) {
      const [ax, az] = p.polygon[j],
        [bx, bz] = p.polygon[(j + 1) % p.polygon.length],
        len = Math.hypot(bx - ax, bz - az),
        h = p.kind === "planter" ? p.height + 0.04 : 0.027;
      const g = new T.BoxGeometry(len, h, p.kind === "planter" ? 0.075 : 0.015);
      g.rotateY(-Math.atan2(bz - az, bx - ax));
      g.translate((ax + bx) / 2, h / 2, (az + bz) / 2);
      worldUV(g);
      const m = p.kind === "planter" ? terra : metal;
      if (!grouped.has(m)) grouped.set(m, []);
      grouped.get(m).push(g);
    }
  }
  // Lawn is deliberately kept as a quiet void in the front garden.
  for (const s of c.surfaces.filter((s) => s.material === "turf"))
    polygon(s.polygon, s.height + 0.01, surfaces.turf, root);
  for (const a of c.walls) {
    const y = a.y ?? a.height / 2;
    if (a.style === "railing" || a.style === "slats") {
      const along = a.w > a.d,
        len = along ? a.w : a.d;
      box(a.w, 0.045, a.d, a.x, a.height, a.z, metal);
      for (let n = 0; n <= Math.floor(len / 0.17); n++) {
        const t = -len / 2 + n * 0.17;
        box(
          0.035,
          a.height,
          0.035,
          a.x + (along ? t : 0),
          a.height / 2,
          a.z + (along ? 0 : t),
          a.style === "slats" ? surfaces.wood : metal,
        );
      }
    } else {
      box(a.w, a.height, a.d, a.x, y, a.z);
      box(
        a.w + 0.025,
        0.05,
        a.d + 0.045,
        a.x,
        y + a.height / 2 + 0.025,
        a.z,
        cap,
      );
      // Restrained shadow reveal, not outlines around every leaf.
      box(
        a.w,
        0.035,
        a.d + 0.006,
        a.x,
        Math.max(0.04, y - a.height / 2 + 0.065),
        a.z,
        terra,
      );
    }
  }
  if (["front", "terrace"].includes(c.presetId)) {
    const door = c.openings[0];
    box(door.width + 0.08, 0.075, 0.25, door.x, 2.17, door.z, metal);
    for (const s of [-1, 1])
      box(
        0.045,
        2.15,
        0.18,
        door.x + s * (door.width / 2),
        1.075,
        door.z,
        metal,
      );
    // Recessed dark interior; the central door opening remains genuinely clear.
    box(door.width, 2.15, 0.025, door.x, 1.075, -z - 0.5, glass);
    box(door.width + 0.8, 0.12, 0.9, door.x, -0.02, -z - 0.2, surfaces.stone);
    // A separate window with a deep jamb establishes domestic scale.
    const wx = -w * 0.28,
      ww = Math.min(1.25, w * 0.21);
    box(ww, 1.15, 0.055, wx, 1.48, -z + 0.155, glass);
    box(ww + 0.16, 0.065, 0.18, wx, 0.9, -z + 0.19, surfaces.stone);
    for (const side of [-1, 1])
      box(0.035, 1.2, 0.08, wx + (side * ww) / 2, 1.48, -z + 0.2, metal);
    box(0.035, 1.15, 0.08, wx, 1.48, -z + 0.2, metal);
    box(w + 0.18, 0.14, 0.65, 0, 2.78, -z + 0.13, cap);
  }
  if (c.stair) {
    const a = c.stair;
    box(a.w, a.height, a.d, a.x, a.height / 2, a.z, plaster);
    box(a.w + 0.1, 0.1, a.d + 0.1, a.x, a.height, a.z, cap);
    const o = c.openings[0];
    box(0.95, 2, 0.025, o.x, 1, o.z + 0.02, metal);
    box(0.035, 0.22, 0.04, o.x + 0.3, 1.05, o.z + 0.045, cap);
    for (const sign of [-1, 1]) {
      box(0.16, 0.012, d - 0.35, sign * (x - 0.18), 0.035, 0, metal);
      for (let n = 0; n < d / 0.09; n++)
        box(
          0.17,
          0.014,
          0.022,
          sign * (x - 0.18),
          0.038,
          -z + 0.17 + n * 0.09,
          plaster,
        );
    }
  }
  if (c.presetId === "front") {
    // Cut stone entry slabs, repeated at a human stride with visible gravel joints.
    for (let zz = z - 0.38; zz > -z + 0.45; zz -= 0.7)
      box(1.02, 0.035, 0.48, 0.45, 0.067, zz, surfaces.stone);
  }
  if (c.presetId === "courtyard") {
    box(Math.min(2, w * 0.35), 0.8, 0.045, 0, 1.2, -z + 0.14, glass);
    for (let j = 0; j < 10; j++)
      box(
        0.028,
        0.84,
        0.07,
        -Math.min(2, w * 0.35) / 2 + (j * Math.min(2, w * 0.35)) / 9,
        1.2,
        -z + 0.18,
        surfaces.wood,
      );
  }
  const floor = new T.Mesh(new T.PlaneGeometry(160, 160), ground);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.17;
  floor.receiveShadow = false;
  const shadowFloor=new T.Mesh(floor.geometry,new T.ShadowMaterial({color:0x78846b,opacity:.19}));
  shadowFloor.rotation.copy(floor.rotation);shadowFloor.position.copy(floor.position);shadowFloor.position.y+=.001;shadowFloor.receiveShadow=true;root.add(shadowFloor);
  root.add(floor);
  for (const [material, geos] of grouped) {
    const g = mergeGeometries(geos);
    geos.forEach((g) => g.dispose());
    const m = new T.Mesh(g, material);
    m.receiveShadow = true;
    m.castShadow = true;
    root.add(m);
  }
  addInk(root);
  const paintRoot = new T.Group();
  root.add(paintRoot);
  let last = "",
    builds = 0;
  function sync(items) {
    const paint = items.filter((i) => i.type === "gravel"),
      key = JSON.stringify(paint);
    if (key === last) return;
    last = key;
    builds++;
    for (const m of [...paintRoot.children]) {
      paintRoot.remove(m);
      m.geometry.dispose();
    }
    if (!paint.length) return;
    const polys = paint.map((i) => {
      const ring = Array.from({ length: 24 }, (_, n) => {
        const a = (n / 24) * Math.PI * 2;
        return [
          i.x + Math.cos(a) * 0.46 * (i.sx || i.scale || 1),
          i.z + Math.sin(a) * 0.46 * (i.sz || i.scale || 1),
        ];
      });
      return [[...ring, ring[0]]];
    });
    const union = polygonClipping.intersection(
      polygonClipping.union(...polys),
      [[...c.boundary, c.boundary[0]]],
    );
    for (const p of union) {
      const shape = new T.Shape(p[0].map(([x, z]) => new T.Vector2(x, -z)));
      for (const hole of p.slice(1))
        shape.holes.push(
          new T.Path(hole.map(([x, z]) => new T.Vector2(x, -z))),
        );
      const g = new T.ExtrudeGeometry(shape, {
        depth: 0.055,
        bevelEnabled: false,
      });
      g.rotateX(-Math.PI / 2);
      worldUV(g);
      const m = new T.Mesh(g, surfaces.gravel);
      m.receiveShadow = true;
      paintRoot.add(m);
    }
  }
  return {
    root,
    sync,
    stats: () => ({
      gravelRebuilds: builds,
      terrainBounds: {
        widthM:
          baseMesh.geometry.boundingBox.max.x -
          baseMesh.geometry.boundingBox.min.x,
        depthM:
          baseMesh.geometry.boundingBox.max.z -
          baseMesh.geometry.boundingBox.min.z,
      },
      walls: c.walls.length,
      plantableZones: c.plantableZones.length,
    }),
  };
}

import * as T from "three";
import polygonClipping from "polygon-clipping";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { surfaces } from "./models-v3.js";
import { BED_LEFT, BED_RIGHT } from "./layout.js";
import { random } from "./catalog.js";
function smoothShape(points) {
  const curve = new T.CatmullRomCurve3(
    points.map(([x, z]) => new T.Vector3(x, 0, z)),
    true,
    "catmullrom",
    0.28,
  );
  return {
    shape: new T.Shape(
      curve.getPoints(points.length * 12).map((p) => new T.Vector2(p.x, -p.z)),
    ),
    curve,
  };
}
function uvWorld(geo, scale = 1) {
  const p = geo.attributes.position,
    uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++)
    uv.setXY(i, p.getX(i) * scale, p.getZ(i) * scale);
  return geo;
}
function patch(shape, height, material, parent) {
  const geo = new T.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
    steps: 1,
  });
  geo.rotateX(-Math.PI / 2);
  uvWorld(geo, 1.4);
  const m = new T.Mesh(geo, material);
  m.receiveShadow = true;
  m.castShadow = true;
  parent.add(m);
  return m;
}
function rect(w, h, d, mat, x, y, z, parent) {
  const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
export function makeTerrain(scene) {
  const root = new T.Group();
  scene.add(root);
  const concrete = new T.MeshStandardMaterial({
    color: 0xb8b7a8,
    roughness: 0.96,
    bumpMap: surfaces.stone.map,
    bumpScale: 0.007,
  });
  rect(8.08, 0.16, 8.08, concrete, 0, -0.09, 0, root);
  rect(8, 0.018, 8, surfaces.soil, 0, -0.002, 0, root);
  for (const points of [BED_LEFT, BED_RIGHT]) {
    const { shape, curve } = smoothShape(points);
    patch(shape, 0.028, surfaces.mulch, root);
    const edging = new T.Mesh(
      new T.TubeGeometry(curve, 160, 0.015, 4, true),
      new T.MeshStandardMaterial({
        color: 0x6b6150,
        metalness: 0.45,
        roughness: 0.8,
      }),
    );
    edging.position.y = 0.028;
    root.add(edging);
  }
  const lawnPoints = [];
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2,
      f = 1 + 0.045 * Math.sin(a * 3) + 0.035 * Math.cos(a * 5);
    lawnPoints.push([
      -2.25 + Math.cos(a) * 1.05 * f,
      0.75 + Math.sin(a) * 1.25 * f,
    ]);
  }
  const turf = smoothShape(lawnPoints).shape;
  patch(turf, 0.036, surfaces.turf, root);
  const rand = random(197),
    blades = [],
    colors = [];
  for (let k = 0; k < 2500; k++) {
    const a = rand() * Math.PI * 2,
      rad = Math.sqrt(rand()) * 0.96,
      x = -2.25 + Math.cos(a) * 1.05 * rad,
      z = 0.75 + Math.sin(a) * 1.25 * rad,
      y = 0.038,
      h = 0.022 + rand() * 0.035,
      theta = rand() * 6.28,
      dx = Math.cos(theta) * 0.002,
      dz = Math.sin(theta) * 0.002;
    blades.push(
      x - dx,
      y,
      z - dz,
      x + dx,
      y,
      z + dz,
      x + dx * 0.6,
      y + h,
      z + dz * 0.6,
    );
    const color = new T.Color([0x778854, 0x88965b, 0x627947][k % 3]);
    for (let n = 0; n < 3; n++) colors.push(color.r, color.g, color.b);
  }
  const bladeGeo = new T.BufferGeometry();
  bladeGeo.setAttribute("position", new T.Float32BufferAttribute(blades, 3));
  bladeGeo.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  bladeGeo.computeVertexNormals();
  const bladeMesh = new T.Mesh(
    bladeGeo,
    new T.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      side: T.DoubleSide,
    }),
  );
  bladeMesh.receiveShadow = true;
  root.add(bladeMesh);

  // Low enclosing walls give the eye-level views a real background and a scale reference.
  rect(8.6, 1.62, 0.15, concrete, 0, 0.66, -4.2, root);
  rect(
    8.64,
    0.065,
    0.22,
    new T.MeshStandardMaterial({ color: 0xc9c7b7, roughness: 0.9 }),
    0,
    1.5,
    -4.2,
    root,
  );
  rect(0.14, 1.18, 8.5, concrete, -4.22, 0.45, 0, root);
  const slats = [];
  for (let i = 0; i < 49; i++) {
    const geo = new T.BoxGeometry(0.042, 0.74, 0.055);
    geo.translate(-4.17 + i * 0.174, 1.83, -4.22);
    slats.push(geo);
  }
  const screen = new T.Mesh(mergeGeometries(slats), surfaces.wood);
  screen.castShadow = true;
  screen.receiveShadow = true;
  root.add(screen);
  slats.forEach((g) => g.dispose());
  const ground = new T.Mesh(
    new T.PlaneGeometry(200, 200),
    new T.MeshStandardMaterial({ color: 0xd7d7c7, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.18;
  ground.receiveShadow = true;
  root.add(ground);
  // Gravel at the entrance continues beyond the threshold, never a path ending in a plant.
  rect(1.2, 0.025, 0.45, surfaces.stone, 0.55, -0.03, 4.22, root);
  const r = random(987),
    rocks = [];
  for (const [x, z, s] of [
    [-3.5, -1.3, 0.31],
    [-1.45, 2.5, 0.23],
    [2.6, 0.05, 0.25],
    [-3.5, 3.1, 0.21],
  ]) {
    const geo = new T.SphereGeometry(s, 7, 5);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const f = 0.86 + r() * 0.25;
      p.setXYZ(
        i,
        p.getX(i) * f * 1.35,
        p.getY(i) * f * 0.65 + s * 0.1,
        p.getZ(i) * f,
      );
    }
    geo.computeVertexNormals();
    geo.translate(x, 0.035, z);
    rocks.push(geo);
  }
  const rockmesh = new T.Mesh(mergeGeometries(rocks), surfaces.stone);
  rockmesh.castShadow = true;
  rockmesh.receiveShadow = true;
  root.add(rockmesh);
  rocks.forEach((g) => g.dispose());
  const surfaceRoot = new T.Group();
  root.add(surfaceRoot);
  let last = "";
  let builds = 0;
  function sync(items) {
    const paint = items.filter((i) => i.type === "gravel");
    const key = JSON.stringify(paint);
    if (key === last) return;
    last = key;
    builds++;
    while (surfaceRoot.children.length) {
      const m = surfaceRoot.children[0];
      surfaceRoot.remove(m);
      m.geometry.dispose();
    }
    if (!paint.length) return;
    const polygons = paint.map((i) => {
      const ring = [];
      const rx = 0.46 * (i.sx || i.scale || 1),
        rz = 0.46 * (i.sz || i.scale || 1);
      for (let n = 0; n < 32; n++) {
        const a = (n / 32) * Math.PI * 2;
        ring.push([
          Math.min(4, Math.max(-4, i.x + Math.cos(a) * rx)),
          Math.min(4, Math.max(-4, i.z + Math.sin(a) * rz)),
        ]);
      }
      ring.push(ring[0]);
      return [ring];
    });
    const union = polygonClipping.union(...polygons);
    for (const poly of union) {
      const shape = new T.Shape(poly[0].map(([x, z]) => new T.Vector2(x, -z)));
      for (const hole of poly.slice(1))
        shape.holes.push(
          new T.Path(hole.map(([x, z]) => new T.Vector2(x, -z))),
        );
      patch(shape, 0.046, surfaces.gravel, surfaceRoot);
    }
  }
  return { root, sync, stats: () => ({ gravelRebuilds: builds }) };
}

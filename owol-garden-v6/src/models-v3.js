import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { random } from "./catalog.js";

const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const palette = {
  leaf: new T.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.82,
    side: T.DoubleSide,
  }),
  bark: new T.MeshStandardMaterial({ color: 0x736553, roughness: 1 }),
  stem: new T.MeshStandardMaterial({ color: 0x63734b, roughness: 0.95 }),
  purple: new T.MeshStandardMaterial({ color: 0x967b8f, roughness: 0.85 }),
  petal: new T.MeshStandardMaterial({
    color: 0xf1edda,
    roughness: 0.8,
    side: T.DoubleSide,
  }),
  heart: new T.MeshStandardMaterial({ color: 0xb89b61, roughness: 1 }),
  metal: new T.MeshStandardMaterial({
    color: 0x3f453d,
    metalness: 0.65,
    roughness: 0.65,
  }),
};
function noiseTexture(kind) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d"),
    r = random(
      { mulch: 77, soil: 42, gravel: 11, stone: 17, wood: 20, turf: 88 }[kind],
    );
  const image = ctx.createImageData(512, 512);
  const base = {
    mulch: [78, 63, 45],
    soil: [107, 94, 73],
    gravel: [168, 159, 135],
    stone: [157, 154, 139],
    wood: [143, 117, 83],
    turf: [97, 110, 68],
  }[kind];
  for (let y = 0; y < 512; y++)
    for (let x = 0; x < 512; x++) {
      let n =
        (r() - 0.5) * 28 +
        Math.sin(x * 0.04 + Math.cos(y * 0.035) * 2) * 4 +
        Math.sin(y * 0.06) * 3;
      if (kind === "wood")
        n +=
          (Math.sin(y * 0.4 + Math.sin(x * 0.014) * 3) +
            Math.sin(y * 1.1 + x * 0.007)) *
          9;
      const k = (y * 512 + x) * 4;
      for (let c = 0; c < 3; c++) image.data[k + c] = base[c] + n;
      image.data[k + 3] = 255;
    }
  ctx.putImageData(image, 0, 0);
  if (kind === "mulch" || kind === "turf") {
    for (let i = 0; i < 4500; i++) {
      const x = r() * 512,
        y = r() * 512;
      ctx.strokeStyle =
        kind === "mulch"
          ? `rgba(${r() > 0.5 ? "161,137,93" : "27,31,20"},.34)`
          : `rgba(${r() > 0.5 ? "170,173,103" : "39,62,34"},.3)`;
      ctx.lineWidth = kind === "mulch" ? 1 + r() * 2 : 0.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (r() - 0.5) * 13, y + (r() - 0.5) * 19);
      ctx.stroke();
    }
  }
  if (kind === "gravel") {
    for (let i = 0; i < 7000; i++) {
      let x = r() * 512,
        y = r() * 512,
        s = 0.8 + r() * 2.8;
      ctx.fillStyle = `rgba(${r() > 0.5 ? "229,217,184" : "68,68,54"},${0.1 + r() * 0.3})`;
      ctx.beginPath();
      ctx.ellipse(x, y, s, s * 0.65, r() * 6, 0, 7);
      ctx.fill();
    }
  }
  const tex = new T.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
function dataMaps(colorTexture) {
  const src = colorTexture.image,
    w = src.width,
    h = src.height;
  const pix = src.getContext("2d").getImageData(0, 0, w, h).data;
  const rough = new Uint8Array(w * h * 4),
    normal = new Uint8Array(w * h * 4);
  const lum = (x, y) => {
    const k = (((y + h) % h) * w + ((x + w) % w)) * 4;
    return (pix[k] + pix[k + 1] + pix[k + 2]) / 765;
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = (y * w + x) * 4,
        dx = (lum(x - 1, y) - lum(x + 1, y)) * 0.8,
        dy = (lum(x, y - 1) - lum(x, y + 1)) * 0.8;
      const n = new T.Vector3(dx, dy, 1).normalize();
      normal.set(
        [
          (n.x * 0.5 + 0.5) * 255,
          (n.y * 0.5 + 0.5) * 255,
          (n.z * 0.5 + 0.5) * 255,
          255,
        ],
        k,
      );
      const value = 210 + lum(x, y) * 35;
      rough.set([value, value, value, 255], k);
    }
  const make = (a) => {
    const t = new T.DataTexture(a, w, h);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.colorSpace = T.NoColorSpace;
    t.needsUpdate = true;
    return t;
  };
  return { normal: make(normal), roughness: make(rough) };
}
export const surfaces = {};
for (const kind of ["soil", "mulch", "gravel", "stone", "wood", "turf"]) {
  const tex = noiseTexture(kind);
  const maps = dataMaps(tex);
  surfaces[kind] = new T.MeshStandardMaterial({
    map: tex,
    normalMap: maps.normal,
    roughnessMap: maps.roughness,
    normalScale: new T.Vector2(0.6, 0.6),
    roughness: kind === "wood" ? 0.82 : 1,
    color: 0xffffff,
  });
}
palette.bark.map = surfaces.wood.map;
palette.bark.normalMap = surfaces.wood.normalMap;
palette.bark.bumpScale = 0.02;

// A subtle original vein pattern, not a photo or a borrowed leaf atlas.
{
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 256;
  const x = c.getContext("2d");
  x.fillStyle = "#f2f1e8";
  x.fillRect(0, 0, 128, 256);
  x.strokeStyle = "#d9ddc8";
  x.lineWidth = 1;
  for (let j = 16; j < 245; j += 14) {
    for (const sign of [-1, 1]) {
      x.beginPath();
      x.moveTo(64, j);
      x.quadraticCurveTo(64 + sign * 22, j + 5, 64 + sign * 59, j + 34);
      x.stroke();
    }
  }
  x.strokeStyle = "#d1d7b9";
  x.lineWidth = 2;
  x.beginPath();
  x.moveTo(64, 0);
  x.lineTo(64, 256);
  x.stroke();
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  palette.leaf.map = tex;
  palette.leaf.normalMap = dataMaps(tex).normal;
  palette.leaf.normalScale = new T.Vector2(0.22, 0.22);
  // Small, bounded two-sided backlight. No physical growth or spectral claim.
  palette.leaf.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <lights_fragment_end>",
      "#include <lights_fragment_end>\n reflectedLight.indirectDiffuse += diffuseColor.rgb * 0.075 * (1.0 - abs(dot(normal, geometryViewDir)));",
    );
  };
  palette.leaf.customProgramCacheKey = () => "owol-leaf-backlight-v3";
}

const prototypeCache = new Map();
let constructionCount = 0;
let detail = "near";
const count = (near, far) => (detail === "far" ? far : near);
class Leaves {
  constructor() {
    this.p = [];
    this.c = [];
    this.i = [];
    this.uv = [];
  }
  leaf(pos, dir, len, width, bend, color, twist = 0, segments = 4) {
    segments = detail === "far" ? Math.min(segments, 3) : segments;
    const q = new T.Quaternion().setFromUnitVectors(
      V(0, 1, 0),
      dir.clone().normalize(),
    );
    q.multiply(new T.Quaternion().setFromAxisAngle(V(0, 1, 0), twist));
    const off = this.p.length / 3,
      c = new T.Color(color);
    for (let row = 0; row <= segments; row++) {
      const t = row / segments,
        w = Math.pow(Math.sin(Math.PI * t), 0.85) * width;
      for (let side = -1; side <= 1; side++) {
        const p = V(
          side * w,
          t * len,
          bend * t * t - (side === 0 ? 0.018 * Math.sin(Math.PI * t) : 0),
        )
          .applyQuaternion(q)
          .add(pos);
        this.p.push(p.x, p.y, p.z);
        this.uv.push((side + 1) / 2, t);
        const k = (side === 0 ? 1.04 : 0.91) * (0.84 + 0.16 * t);
        this.c.push(c.r * k, c.g * k, c.b * k);
      }
    }
    for (let row = 0; row < segments; row++)
      for (let col = 0; col < 2; col++) {
        let a = off + row * 3 + col,
          b = a + 3;
        this.i.push(a, b, a + 1, b, b + 1, a + 1);
      }
  }
  geometry() {
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(this.p, 3));
    g.setAttribute("color", new T.Float32BufferAttribute(this.c, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.i);
    g.computeVertexNormals();
    return g;
  }
}
function mesh(geometry, material, group) {
  const m = new T.Mesh(geometry, material);
  m.castShadow = true;
  m.receiveShadow = true;
  group.add(m);
  return m;
}
function tube(a, b, ra, rb, arr, bend = 0) {
  const mid = a
    .clone()
    .lerp(b, 0.5)
    .add(V(bend, 0.015, -bend * 0.4));
  const path = new T.QuadraticBezierCurve3(a, mid, b);
  const geo = new T.TubeGeometry(path, 4, 1, 5, false);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let row = Math.floor(i / 6),
      t = row / 4;
    const center = path.getPoint(t),
      v = V().fromBufferAttribute(pos, i);
    v.sub(center)
      .multiplyScalar(T.MathUtils.lerp(ra, rb, t))
      .add(center);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  arr.push(geo);
}
function merged(geos, material, g) {
  if (!geos.length) return;
  const out = mergeGeometries(geos, false);
  geos.forEach((geo) => geo.dispose());
  return mesh(out, material, g);
}
function smallSphere(pos, radius, arr, sx = 1, sy = 1, sz = 1) {
  const geo = new T.SphereGeometry(radius, 6, 2);
  geo.scale(sx, sy, sz);
  geo.translate(pos.x, pos.y, pos.z);
  arr.push(geo);
}
function foliageTree(g, r) {
  const branches = [],
    leaves = new Leaves();
  let trunk = V(0, 0, 0);
  const fork = V(0.08, 1.15, -0.04);
  tube(trunk, fork, 0.095, 0.052, branches, 0.09);
  for (let k = 0; k < 5; k++) {
    const a = k * 2.399 + (r() - 0.5) * 0.4,
      reach = 0.72 + r() * 0.6;
    const top = V(
      Math.cos(a) * reach,
      2.5 + r() * 0.9,
      Math.sin(a) * reach * 0.8,
    );
    const joint = fork
      .clone()
      .lerp(top, 0.54)
      .add(V(0.15, 0, -0.08));
    tube(fork, joint, 0.045, 0.025, branches, 0.05);
    tube(joint, top, 0.025, 0.008, branches, -0.05);
    for (let j = 0; j < 5; j++) {
      const t = 0.06 + j * 0.21,
        center = joint.clone().lerp(top, t);
      const b = a + j * 2.399;
      const tip = center
        .clone()
        .add(
          V(
            Math.cos(b) * (0.42 + r() * 0.33),
            0.08 + r() * 0.27,
            Math.sin(b) * (0.4 + r() * 0.3),
          ),
        );
      tube(center, tip, 0.012, 0.003, branches, 0.04);
      // Leaves grow from short paired shoots. No floating cloud of disconnected leaves.
      const shoots = count(8, 6);
      for (let n = 0; n < shoots; n++) {
        const t = (n + 0.4) / shoots,
          base = center.clone().lerp(tip, t);
        const theta = b + n * 2.399;
        const shoot = base
          .clone()
          .add(
            V(Math.cos(theta) * 0.23, 0.1 + r() * 0.12, Math.sin(theta) * 0.23),
          );
        if (detail === "near") tube(base, shoot, 0.0025, 0.0007, branches);
        for (let k = 0; k < count(6, 5); k++) {
          const v = (k + 1) / 7,
            p = base.clone().lerp(shoot, v),
            angle = theta + (k % 2 ? 1 : -1) * 1.1;
          leaves.leaf(
            p,
            V(Math.cos(angle), 0.28, Math.sin(angle)),
            0.18 + r() * 0.045,
            0.041 + r() * 0.011,
            0.035,
            [0x506b46, 0x74865b, 0x899771, 0x3f5c42][(n + k) % 4],
            angle,
            3,
          );
        }
      }
    }
  }
  merged(branches, palette.bark, g);
  mesh(leaves.geometry(), palette.leaf, g);
}
function foliageShrub(g, r) {
  const branches = [],
    leaves = new Leaves();
  for (let i = 0; i < count(18, 12); i++) {
    const a = i * 2.399,
      rad = Math.sqrt(r()) * 0.42,
      top = V(Math.sin(a) * rad, 0.38 + r() * 0.48, Math.cos(a) * rad);
    tube(V(0, 0.015, 0), top, 0.009, 0.002, branches, 0.03);
    for (let j = 0; j < count(16, 10); j++) {
      const t = 0.25 + r() * 0.75,
        p = top
          .clone()
          .multiplyScalar(t)
          .add(V((r() - 0.5) * 0.19, 0, (r() - 0.5) * 0.19));
      const theta = a + j * 2.4;
      leaves.leaf(
        p,
        V(Math.sin(theta), 0.25 + r() * 0.6, Math.cos(theta)),
        0.1 + r() * 0.1,
        0.025 + r() * 0.023,
        0.025,
        [0x52683e, 0x6b8050, 0x3f5936, 0x7f905e][j % 4],
        r() * 6,
        3,
      );
    }
  }
  merged(branches, palette.stem, g);
  mesh(leaves.geometry(), palette.leaf, g);
}
function grasses(g, r) {
  const leaf = new Leaves(),
    stems = [],
    heads = [];
  for (let i = 0; i < count(56, 30); i++) {
    const a = i * 2.399,
      spread = Math.sqrt(r()) * 0.15;
    const h = 0.4 + r() * 0.45;
    leaf.leaf(
      V(Math.sin(a) * spread, 0.015, Math.cos(a) * spread),
      V(Math.sin(a) * 0.23, 1, Math.cos(a) * 0.23),
      h,
      0.006 + r() * 0.008,
      0.14 + r() * 0.4,
      [0x839267, 0xabb38b, 0x73845a, 0x9da77b][i % 4],
      a,
      7,
    );
  }
  for (let i = 0; i < 8; i++) {
    let a = i * 2.399,
      h = 0.64 + r() * 0.38,
      p = V(Math.sin(a) * 0.18, h, Math.cos(a) * 0.18);
    tube(V(0, 0.03, 0), p, 0.003, 0.001, stems);
    for (let j = 0; j < 6; j++)
      smallSphere(
        p
          .clone()
          .add(V(Math.sin(a + j) * 0.03, j * 0.018, Math.cos(a + j) * 0.03)),
        0.009,
        heads,
        0.6,
        1.8,
        0.6,
      );
  }
  mesh(leaf.geometry(), palette.leaf, g);
  merged(stems, palette.stem, g);
  merged(
    heads,
    new T.MeshStandardMaterial({ color: 0xb6ab83, roughness: 1 }),
    g,
  );
}
function broadLeaves(g, r) {
  const leaves = new Leaves(),
    stems = [];
  for (let i = 0; i < 12; i++) {
    const a = i * 2.399,
      len = 0.28 + r() * 0.24;
    const p = V(Math.sin(a) * 0.06, 0.04, Math.cos(a) * 0.06);
    const dir = V(Math.sin(a) * 0.8, 0.6 + (i % 3) * 0.12, Math.cos(a) * 0.8);
    leaves.leaf(
      p,
      dir,
      len,
      0.09 + r() * 0.04,
      -0.13,
      [0x657d48, 0x819455, 0x71884b, 0x93a367][i % 4],
      a * 0.15,
      8,
    );
    const tip = p.clone().add(
      dir
        .clone()
        .normalize()
        .multiplyScalar(len * 0.6),
    );
    tube(V(0, 0.01, 0), tip, 0.004, 0.0015, stems);
  }
  mesh(leaves.geometry(), palette.leaf, g);
  merged(stems, palette.stem, g);
}
function flowers(g, r, white = false) {
  const leaves = new Leaves(),
    stems = [],
    flowers = [],
    centers = [];
  const flowerCount = white ? count(8, 5) : count(10, 6);
  for (let i = 0; i < flowerCount; i++) {
    const a = i * 2.399,
      h = (white ? 0.35 : 0.45) + r() * 0.4;
    const x = Math.sin(a) * (0.06 + r() * 0.18),
      z = Math.cos(a) * (0.05 + r() * 0.18),
      top = V(x, h, z);
    tube(V(x * 0.3, 0.015, z * 0.3), top, 0.0035, 0.0017, stems, 0.015);
    for (let j = 0; j < 4; j++) {
      const p = top.clone().multiplyScalar(0.15 + j * 0.16);
      leaves.leaf(
        p,
        V(Math.sin(a + j * 2.4), 0.45, Math.cos(a + j * 2.4)),
        0.09 + r() * 0.09,
        0.018,
        0,
        white ? 0x64734b : 0x64734a,
        r() * 6,
        3,
      );
    }
    if (white) {
      for (let j = 0; j < 9; j++) {
        const t = (j * Math.PI * 2) / 9;
        leavesDummyPetal(top, t, flowers);
      }
      smallSphere(top.clone().add(V(0, 0.008, 0)), 0.018, centers, 1, 0.45, 1);
    } else {
      for (let j = 0; j < count(8, 5); j++) {
        const t = j / count(8, 5),
          p = top.clone().add(V(0, -t * 0.2, 0));
        for (let k = 0; k < 3; k++) {
          const a2 = k * 2.1 + j * 0.9;
          smallSphere(
            p.clone().add(V(Math.sin(a2) * 0.021, 0, Math.cos(a2) * 0.021)),
            0.0115 * (1 - t * 0.35),
            flowers,
            0.75,
            1.35,
            0.75,
          );
        }
      }
    }
  }
  mesh(leaves.geometry(), palette.leaf, g);
  merged(stems, palette.stem, g);
  merged(flowers, white ? palette.petal : palette.purple, g);
  merged(centers, palette.heart, g);
}
function leavesDummyPetal(p, a, arr) {
  const geo = new T.SphereGeometry(0.026, 6, 2);
  geo.scale(0.45, 0.15, 1);
  geo.rotateY(a);
  geo.translate(p.x + Math.sin(a) * 0.03, p.y, p.z + Math.cos(a) * 0.03);
  arr.push(geo);
}
function lowLeaves(g, r) {
  const leaves = new Leaves();
  for (let i = 0; i < count(25, 14); i++) {
    const a = i * 2.399,
      rad = Math.sqrt(r()) * 0.32,
      p = V(Math.sin(a) * rad, 0.025, Math.cos(a) * rad);
    for (let j = 0; j < 3; j++) {
      const theta = a + j * 2.1;
      leaves.leaf(
        p,
        V(Math.sin(theta), 0.4 + r() * 0.35, Math.cos(theta)),
        0.08 + r() * 0.07,
        0.025 + r() * 0.014,
        -0.03,
        [0x69804d, 0x8b9c69, 0x526c40][i % 3],
        theta,
        3,
      );
    }
  }
  mesh(leaves.geometry(), palette.leaf, g);
}
function stone(g, variant) {
  const r = random(variant + 35);
  const shape = new T.Shape();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2,
      rad = 0.3 + r() * 0.065;
    const x = Math.cos(a) * rad * 1.17,
      z = Math.sin(a) * rad;
    i ? shape.lineTo(x, z) : shape.moveTo(x, z);
  }
  shape.closePath();
  const geo = new T.ExtrudeGeometry(shape, {
    depth: 0.045,
    bevelEnabled: true,
    bevelSize: 0.012,
    bevelThickness: 0.008,
    bevelSegments: 2,
    steps: 1,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0.055, 0);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++)
    uv.setXY(i, pos.getX(i) * 1.5, pos.getZ(i) * 1.5);
  mesh(geo, surfaces.stone, g);
}
function planks(g, bench = false) {
  const wood = [],
    metal = [],
    screws = [];
  function b(w, h, d, x, y, z, arr, rx = 0) {
    const geo = new RoundedBoxGeometry(w, h, d, 1, 0.009);
    geo.rotateX(rx);
    geo.translate(x, y, z);
    arr.push(geo);
  }
  if (bench) {
    for (let i = 0; i < 5; i++)
      b(1.62, 0.045, 0.09, 0, 0.45, -0.23 + i * 0.113, wood);
    for (let i = 0; i < 3; i++)
      b(1.62, 0.105, 0.04, 0, 0.64 + i * 0.12, -0.29 - i * 0.022, wood, -0.13);
    for (let x of [-0.61, 0.61]) {
      b(0.035, 0.44, 0.035, x, 0.22, -0.22, metal);
      b(0.035, 0.44, 0.035, x, 0.22, 0.22, metal);
      b(0.04, 0.05, 0.54, x, 0.41, 0, metal);
      b(0.035, 0.76, 0.035, x, 0.48, -0.26, metal, -0.13);
      b(0.12, 0.015, 0.1, x, 0.015, 0.22, metal);
      for (let i = 0; i < 5; i++)
        smallSphere(V(x, 0.475, -0.23 + i * 0.113), 0.008, screws, 1, 0.3, 1);
    }
  } else
    for (let i = 0; i < 6; i++)
      b(0.75, 0.065, 0.116, 0, 0.075, -0.35 + i * 0.14, wood);
  merged(wood, surfaces.wood, g);
  merged(metal, palette.metal, g);
  merged(screws, palette.metal, g);
}
export function prototype(type, variant = 0, lod = "near") {
  const key = type + variant + lod;
  detail = lod;
  if (prototypeCache.has(key)) return prototypeCache.get(key);
  constructionCount++;
  const g = new T.Group(),
    r = random(1147 + variant * 97);
  if (type === "tree") foliageTree(g, r);
  if (type === "shrub") foliageShrub(g, r);
  if (type === "grass") grasses(g, r);
  if (type === "hosta") broadLeaves(g, r);
  if (type === "flower") flowers(g, r);
  if (type === "meadow") flowers(g, r, true);
  if (type === "cover") lowLeaves(g, r);
  if (type === "stone") stone(g, variant);
  if (type === "wood") planks(g);
  if (type === "bench") planks(g, true);
  if (type === "gravel") {
    const geo = new T.CylinderGeometry(0.46, 0.46, 0.045, 32);
    geo.translate(0, 0.025, 0);
    mesh(geo, surfaces.gravel, g);
  }
  prototypeCache.set(key, g);
  return g;
}
export function modelStats() {
  return { prototypes: prototypeCache.size, constructions: constructionCount };
}

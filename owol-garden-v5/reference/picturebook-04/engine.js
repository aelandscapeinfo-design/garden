import * as T from "three";
import { prototype, modelStats } from "./models.js";
import { makeTerrain, disposeTerrain } from "./terrain.js";
import { CameraController } from "./camera-controller.js";
import { floorHeight } from "./scene-config.js";
import {setInkSize} from "./toon-style.js";
import { CATALOG } from "./catalog.js";

const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
export class GardenEngine {
  constructor(host, config) {
    this.config = config;
    this.host = host;
    this.scene = new T.Scene();
    this.scene.background = new T.Color(0xcbd5c7);
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio, host.clientWidth < 700 ? 1 : 1.5),
    );
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.domElement.setAttribute("aria-label", "오월 정원 편집 화면");
    this.renderer.domElement.tabIndex = 0;
    host.append(this.renderer.domElement);
    const sky = new T.HemisphereLight(0xd7e6ee, 0x8d896b, 1.5);
    this.scene.add(sky);
    this.sky=sky;
    this.sun = new T.DirectionalLight(0xffedce, 2.6);
    this.sun.position.set(-3.5, 8, 4.5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, {
      left: -7,
      right: 7,
      top: 7,
      bottom: -7,
      near: 0.5,
      far: 25,
    });
    this.sun.shadow.bias = -0.00025;
    this.sun.shadow.normalBias = 0.015;
    this.sun.shadow.radius = 3;
    this.sun.shadow.blurSamples = 12;
    this.sun.shadow.autoUpdate = false;
    this.sun.shadow.needsUpdate = true;
    this.scene.add(this.sun);
    const fill = new T.DirectionalLight(0xc5d9e5, 0.25);
    fill.position.set(4, 3, -3);
    this.scene.add(fill);
    this.fill=fill;
    this.ortho = new T.OrthographicCamera();
    this.perspective = new T.PerspectiveCamera(48, 1, 0.1, 100);
    this.camera = this.perspective;
    this.view = "edit";
    this.angle = Math.PI / 4;
    this.zoom = 1;
    this.quality = host.clientWidth < 700 ? "light" : "standard";
    if (this.quality === "light") this.sun.shadow.mapSize.set(1024, 1024);
    this.terrain = makeTerrain(this.scene, config);
    this.batches = new Map();
    this.objectRoot = new T.Group();
    this.scene.add(this.objectRoot);
    this.items = [];
    this.matrix = new T.Matrix4();
    this.quat = new T.Quaternion();
    this.ray = new T.Raycaster();
    this.ndc = new T.Vector2();
    this.plane = new T.Plane(V(0, 1, 0), -0.05);
    this.grid = new T.GridHelper(8, 32, 0xa4aa91, 0xa4aa91);
    this.grid.position.y = 0.053;
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.16;
    this.grid.visible = false;
    this.scene.add(this.grid);
    this.preview = new T.Group();
    this.preview.visible = false;
    this.scene.add(this.preview);
    this.ghostType = null;
    this.marker = new T.Mesh(
      new T.RingGeometry(0.25, 0.27, 48),
      new T.MeshBasicMaterial({
        color: 0x60764b,
        transparent: true,
        opacity: 0.8,
        side: T.DoubleSide,
        depthTest: false,
      }),
    );
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.renderOrder = 10;
    this.marker.visible = false;
    this.scene.add(this.marker);
    this.outline = new T.Mesh(
      new T.RingGeometry(0.3, 0.315, 48),
      new T.MeshBasicMaterial({
        color: 0xbda46e,
        side: T.DoubleSide,
        depthTest: false,
      }),
    );
    this.outline.rotation.x = -Math.PI / 2;
    this.outline.visible = false;
    this.outline.renderOrder = 11;
    this.scene.add(this.outline);
    this.controller = new CameraController(
      this.camera,
      this.renderer.domElement,
      { draw: () => this.draw() },
    );
    this.controller.configure(config);
    this.setConfig(config, false);
    this.resize();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
  }
  resize() {
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.setViewOffset(w, h, w > 800 ? -w * 0.065 : 0, h * 0.095, w, h);
    this.camera.updateProjectionMatrix();
    this.render();
  }
  setConfig(config, reset = true) {
    this.config = config;
    this.renderStyle=config.presetId === "front" && config.widthM === 6 && config.depthM === 4.5 ? "toon" : "v3";
    const art=this.renderStyle === "toon";
    this.scene.background.set(art?0xf5f1e7:0xcbd5c7);
    this.renderer.toneMapping=art?T.NoToneMapping:T.ACESFilmicToneMapping;
    this.sky.intensity=art?1.45:1.5;
    this.sky.color.set(art?0xf3f0e5:0xd7e6ee);
    this.sky.groundColor.set(art?0xd9dbc6:0x8d896b);
    this.sun.intensity=art?1.95:2.6;
    this.sun.shadow.intensity=art?.38:1;
    this.sun.color.set(art?0xfffcf0:0xffedce);
    this.sun.shadow.radius=art?5:3;
    this.fill.intensity=art?0:.25;
    this.ghostType=null;
    disposeTerrain(this.terrain);
    this.terrain = makeTerrain(this.scene, config);
    this.scene.remove(this.grid);
    this.grid.geometry.dispose();
    this.grid.material.dispose();
    const positions = [];
    const w = config.widthM,
      d = config.depthM;
    for (let x = -w / 2; x <= w / 2 + 0.001; x += 0.25)
      positions.push(x, 0.065, -d / 2, x, 0.065, d / 2);
    for (let z = -d / 2; z <= d / 2 + 0.001; z += 0.25)
      positions.push(-w / 2, 0.065, z, w / 2, 0.065, z);
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    this.grid = new T.LineSegments(
      g,
      new T.LineBasicMaterial({
        color: 0x75886e,
        transparent: true,
        opacity: 0.18,
      }),
    );
    this.grid.visible = false;
    this.scene.add(this.grid);
    const m = Math.max(w, d) * 0.85;
    Object.assign(this.sun.shadow.camera, {
      left: -m,
      right: m,
      top: m,
      bottom: -m,
      far: Math.max(30, m * 5),
    });
    this.sun.position.set(-m * 0.65, m * 1.8, m * 0.8);
    this.sun.shadow.camera.updateProjectionMatrix();
    this.sun.shadow.needsUpdate = true;
    this.controller.configure(config, reset);
    this.render();
  }
  setView(view) {
    this.view = view;
    this.preview.visible = this.marker.visible = this.grid.visible = false;
    this.controller.view(view);
    this.sync(this.items, this.selected);
    this.render();
  }
  setQuality(q) {
    this.quality = q;
    const s = q === "light" ? 1024 : 2048;
    this.sun.shadow.mapSize.set(s, s);
    this.sun.shadow.map?.dispose();
    this.sun.shadow.map = null;
    this.sun.shadow.needsUpdate = true;
    this.renderer.setPixelRatio(
      q === "light" ? 1 : Math.min(devicePixelRatio, 1.5),
    );
    for (const [key, b] of this.batches) {
      for (const p of b.parts)
        p.castShadow = !p.userData.isArtInk && !(
          q === "light" &&
          ["flower", "meadow", "grass", "cover"].includes(key.split(":")[0])
        );
    }
    this.sync(this.items, this.selected);
    this.resize();
  }
  batch(type, variant) {
    const key = type + ":" + variant + ":" + this.lod + ":" + this.renderStyle;
    if (this.batches.has(key)) return this.batches.get(key);
    const asset = prototype(type, variant, this.lod, this.renderStyle);
    const parts = asset.children.map((p) => {
      const m = new T.InstancedMesh(p.geometry, p.material, 320);
      m.castShadow = !(
        this.quality === "light" &&
        ["flower", "meadow", "grass", "cover"].includes(type)
      );
      m.userData.isArtInk=!!p.userData.isArtInk;
      if(m.userData.isArtInk){m.castShadow=false;m.raycast=()=>{};m.renderOrder=1;}
      m.receiveShadow = !m.userData.isArtInk;
      m.instanceMatrix.setUsage(T.DynamicDrawUsage);
      m.userData.ids = [];
      this.objectRoot.add(m);
      return m;
    });
    const group = { parts, key };
    this.batches.set(key, group);
    return group;
  }
  sync(items, selected) {
    const nextLod =
      this.quality === "light" ||
      this.camera.position.distanceTo(this.controller.controls.target) > 8
        ? "far"
        : "near";
    const signature = JSON.stringify(items) + nextLod;
    if (signature !== this.shadowSignature) {
      this.sun.shadow.needsUpdate = true;
      this.shadowSignature = signature;
    }
    this.items = items;
    this.selected = selected;
    this.lod =
      this.quality === "light" ||
      this.camera.position.distanceTo(this.controller.controls.target) > 8
        ? "far"
        : "near";
    this.terrain.sync(items);
    const groups = new Map();
    for (const item of items) {
      if (item.type === "gravel") continue;
      const key = item.type + ":" + (item.variant || 0) + ":" + this.lod + ":" + this.renderStyle;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    for (const [key, list] of groups) {
      const [type, v] = key.split(":");
      this.batch(type, +v);
    }
    for (const [key, batch] of this.batches) {
      const list = groups.get(key) || [];
      batch.parts.forEach((p) => {
        p.count = list.length;
        p.userData.ids = list.map((i) => i.id);
      });
      list.forEach((item, index) => {
        this.quat.setFromAxisAngle(V(0, 1, 0), ((item.r || 0) * Math.PI) / 180);
        const scale = item.scale || 1;
        const pos = V(
          item.x,
          floorHeight(this.config, item.x, item.z, item.type),
          item.z,
        );
        this.matrix.compose(pos, this.quat, V(scale, scale, scale));
        for (const part of batch.parts) part.setMatrixAt(index, this.matrix);
      });
      for (const part of batch.parts) {
        part.instanceMatrix.needsUpdate = true;
        if (list.length) {
          part.computeBoundingSphere();
          part.computeBoundingBox();
        }
      }
    }
    const selectedItem = items.find((i) => i.id === selected);
    this.outline.visible = !!selectedItem && this.view === "edit";
    if (selectedItem) {
      this.outline.position.set(
        selectedItem.x,
        floorHeight(
          this.config,
          selectedItem.x,
          selectedItem.z,
          selectedItem.type,
        ) + 0.06,
        selectedItem.z,
      );
      let s = CATALOG[selectedItem.type].radius / 0.3;
      this.outline.scale.set(s, s, s);
    }
    this.scene.updateMatrixWorld(true);
    this.render();
  }
  render() {
    this.controller?.request();
  }
  draw() {
    const lod =
      this.quality === "light" ||
      this.camera.position.distanceTo(this.controller.controls.target) > 8
        ? "far"
        : "near";
    if (lod !== this.lod && !this.lodSync) {
      this.lodSync = true;
      this.lod = lod;
      this.sync(this.items, this.selected);
      this.lodSync = false;
    }
    setInkSize(this.renderer);
    this.renderer.render(this.scene, this.camera);
  }
  at(e) {
    const b = this.renderer.domElement.getBoundingClientRect();
    this.ndc.set(
      ((e.clientX - b.left) / b.width) * 2 - 1,
      (-(e.clientY - b.top) / b.height) * 2 + 1,
    );
    this.ray.setFromCamera(this.ndc, this.camera);
    const p = V();
    if (!this.ray.ray.intersectPlane(this.plane, p)) return null;
    const hits = this.ray
      .intersectObjects(this.terrain.root.children, true)
      .filter(
        (h) =>
          h.face?.normal.y > 0.7 &&
          h.point.y < 0.6 &&
          Math.abs(h.point.x) <= this.config.widthM / 2 &&
          Math.abs(h.point.z) <= this.config.depthM / 2,
      );
    if (hits.length) p.copy(hits[0].point);
    return {
      x: Math.round(p.x * 4) / 4,
      z: Math.round(p.z * 4) / 4,
      rawX: p.x,
      rawZ: p.z,
    };
  }
  pick(e) {
    const point = this.at(e);
    this.scene.updateMatrixWorld(true);
    const hits = this.ray.intersectObjects(this.objectRoot.children, false);
    if (hits.length) {
      return hits[0].object.userData.ids[hits[0].instanceId] ?? null;
    }
    if (!point) return null;
    const nearest = this.items
      .map((i) => ({ i, d: Math.hypot(i.x - point.rawX, i.z - point.rawZ) }))
      .filter(({ i, d }) => d < CATALOG[i.type].radius * (i.scale || 1) + 0.12)
      .sort((a, b) => {
        const sa = CATALOG[a.i.type].category === "surface",
          sb = CATALOG[b.i.type].category === "surface";
        return sa - sb || a.d - b.d;
      });
    return nearest[0]?.i.id ?? null;
  }
  showPreview(item, valid) {
    if (!item || this.view !== "edit") {
      if (!this.preview.visible && !this.marker.visible && !this.grid.visible)
        return;
      this.preview.visible = false;
      this.marker.visible = false;
      this.grid.visible = false;
      this.render();
      return;
    }
    if (this.ghostType !== item.type) {
      for (const child of [...this.preview.children]) {
        this.preview.remove(child);
        child.traverse((o) => {
          if (o.isMesh && !o.userData.isArtInk) o.material.dispose();
        });
      }
      const ghost = prototype(item.type, 0, "near", this.renderStyle).clone(true);
      ghost.traverse((o) => {
        if (o.isMesh) {
          if(o.userData.isArtInk){o.visible=false;return;}
          o.material = o.material.clone();
          o.material.transparent = true;
          o.material.opacity = 0.36;
          o.material.depthWrite = false;
          o.castShadow = false;
          o.receiveShadow = false;
        }
      });
      this.preview.add(ghost);
      this.ghostType = item.type;
    }
    const height = floorHeight(this.config, item.x, item.z, item.type);
    this.preview.position.set(item.x, height, item.z);
    this.preview.rotation.y = ((item.r || 0) * Math.PI) / 180;
    this.preview.scale.setScalar(item.scale || 1);
    this.preview.visible = true;
    this.marker.position.set(item.x, height + 0.055, item.z);
    const s = CATALOG[item.type].radius / 0.25;
    this.marker.scale.set(s, s, s);
    this.marker.material.color.set(valid ? 0x6a8655 : 0xc6654b);
    this.marker.visible = true;
    this.grid.visible = true;
    this.render();
  }
  image() {
    const flags = [
      this.preview.visible,
      this.marker.visible,
      this.grid.visible,
      this.outline.visible,
    ];
    this.preview.visible =
      this.marker.visible =
      this.grid.visible =
      this.outline.visible =
        false;
    setInkSize(this.renderer);
    this.renderer.render(this.scene, this.camera);
    const data = this.renderer.domElement.toDataURL("image/png");
    [
      this.preview.visible,
      this.marker.visible,
      this.grid.visible,
      this.outline.visible,
    ] = flags;
    this.render();
    return data;
  }
  comparisonImage() {
    const w = this.host.clientWidth,
      h = this.host.clientHeight,
      ratio = this.renderer.getPixelRatio(),
      cam = this.camera;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(1440, 690);
    const c = new T.OrthographicCamera(
      (-10.8 * 1440) / 690 / 2,
      (10.8 * 1440) / 690 / 2,
      5.4,
      -5.4,
      0.1,
      100,
    );
    c.position.set(Math.sin(Math.PI / 4) * 13, 12, Math.cos(Math.PI / 4) * 13);
    c.lookAt(0, 0, 0);
    c.setViewOffset(1440, 690, -1440 * 0.085, 0, 1440, 690);
    c.updateProjectionMatrix();
    this.camera = c;
    const url = this.image();
    this.camera = cam;
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(w, h);
    this.render();
    return url;
  }
  thumbnail(type) {
    const w = this.host.clientWidth,
      h = this.host.clientHeight,
      pixel = this.renderer.getPixelRatio();
    const s = new T.Scene();
    s.add(new T.HemisphereLight(0xdce6cc, 0x928667, this.renderStyle === "toon" ? 1.45 : 2));
    const l = new T.DirectionalLight(0xfff1d1, this.renderStyle === "toon" ? 1.95 : 3);
    l.position.set(-3, 6, 4);
    s.add(l);
    s.add(prototype(type, 0, "near", this.renderStyle).clone(true));
    const c = new T.OrthographicCamera(-1, 1, 1.1, -0.9, 0.1, 40);
    if (type === "tree") {
      c.left = -1.8;
      c.right = 1.8;
      c.top = 1.9;
      c.bottom = -1.7;
    }
    c.position.set(3, 2.2, 4);
    c.lookAt(0, type === "tree" ? 1.7 : type === "bench" ? 0.4 : 0.4, 0);
    c.updateProjectionMatrix();
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(140, 128);
    this.renderer.setClearColor(0xf5f3eb, 0);
    setInkSize(this.renderer);
    this.renderer.render(s, c);
    const url = this.renderer.domElement.toDataURL();
    this.renderer.setPixelRatio(pixel);
    this.renderer.setSize(w, h);
    // The palette draws the full garden once after generating all thumbnails.
    return url;
  }
  screen(x, z) {
    const p = V(x, floorHeight(this.config, x, z, "hosta"), z).project(
        this.camera,
      ),
      b = this.renderer.domElement.getBoundingClientRect();
    return {
      x: b.left + ((p.x + 1) * b.width) / 2,
      y: b.top + ((1 - p.y) * b.height) / 2,
    };
  }
  stats() {
    return {
      renderStyle:this.renderStyle,
      toonBatches:[...this.batches.values()].flatMap(b=>b.parts).filter(p=>p.count&&p.material.isMeshToonMaterial).length,
      inkBatches:[...this.batches.values()].flatMap(b=>b.parts).filter(p=>p.count&&p.userData.isArtInk).length,
      ...modelStats(),
      textureBytesEstimate: this.textureBytes(),
      shadowBounds: {
        left: this.sun.shadow.camera.left,
        right: this.sun.shadow.camera.right,
        top: this.sun.shadow.camera.top,
        bottom: this.sun.shadow.camera.bottom,
      },
      lod: this.lod,
      camera: this.controller.stats(),
      sceneConfig: this.config,
      gridBounds:
        (this.grid.geometry.computeBoundingBox(),
        this.grid.geometry.boundingBox),
      ...this.terrain.stats(),
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      quality: this.quality,
      pixelRatio: this.renderer.getPixelRatio(),
      width: this.host.clientWidth,
      height: this.host.clientHeight,
    };
  }
  textureBytes() {
    const textures = new Set();
    for (const b of this.batches.values())
      for (const p of b.parts)
        for (const k of ["map", "normalMap", "roughnessMap", "bumpMap", "gradientMap"])
          if (p.material[k]) textures.add(p.material[k]);
    this.terrain.root.traverse((o) => {
      if (o.material)
        for (const k of ["map", "normalMap", "roughnessMap", "bumpMap", "gradientMap"])
          if (o.material[k]) textures.add(o.material[k]);
    });
    let bytes = 0;
    for (const t of textures) {
      const i = t.image;
      if (i)
        bytes +=
          (i.width || 1) *
          (i.height || 1) *
          4 *
          (t.generateMipmaps ? 4 / 3 : 1);
    }
    return Math.round(bytes);
  }
  measurement(reset = false) {
    if (reset) {
      this.controller.frames = [];
      return null;
    }
    const a = [...this.controller.frames].sort((a, b) => a - b),
      q = (p) =>
        a.length
          ? +a[Math.min(a.length - 1, Math.floor(a.length * p))].toFixed(2)
          : null;
    const gl = this.renderer.getContext(),
      ext = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      ...this.stats(),
      frames: a.length,
      frameTimeP50: q(0.5),
      frameTimeP95: q(0.95),
      renderer: ext
        ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER),
    };
  }
  async benchmark(n = 12, refreshShadows = false) {
    const gl = this.renderer.getContext(),
      submission = [],
      intervals = [];
    let previous = await new Promise(requestAnimationFrame);
    const wallStart = performance.now();
    for (let i = 0; i < n; i++) {
      if (refreshShadows) this.sun.shadow.needsUpdate = true;
      const start = performance.now();
      setInkSize(this.renderer);
    this.renderer.render(this.scene, this.camera);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
      submission.push(performance.now() - start);
      const current = await new Promise(requestAnimationFrame);
      intervals.push(current - previous);
      previous = current;
    }
    const wallMs = performance.now() - wallStart;
    submission.sort((a, b) => a - b);
    intervals.sort((a, b) => a - b);
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      ...this.stats(),
      samples: n,
      refreshShadows,
      wallMs: +wallMs.toFixed(1),
      medianRenderAndReadbackMs: +submission[Math.floor(n / 2)].toFixed(1),
      medianFrameIntervalMs: +intervals[Math.floor(n / 2)].toFixed(1),
      p95FrameIntervalMs:
        +intervals[Math.min(n - 1, Math.floor(n * 0.95))].toFixed(1),
      renderer: ext
        ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER),
      note: "Render timing includes synchronous one-pixel readback to drain the GPU command queue and browser round-trip overhead; not pure GPU time. Frame intervals are requestAnimationFrame gaps in this synthetic loop, not a hardware-device FPS guarantee.",
    };
  }
}

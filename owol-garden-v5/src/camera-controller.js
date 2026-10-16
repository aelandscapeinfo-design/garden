import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
const V = (a) => new T.Vector3(...a);
export class CameraController {
  constructor(camera, canvas, { draw, onStart = () => {} }) {
    this.camera = camera;
    this.canvas = canvas;
    this.draw = draw;
    this.onStart = onStart;
    this.mode = "edit";
    this.frames = [];
    this.renderCount = 0;
    this.running = false;
    this.controls = new OrbitControls(camera, canvas);
    const o = this.controls;
    o.enableDamping = true;
    o.dampingFactor = 0.13;
    o.zoomSpeed = 0.7;
    o.rotateSpeed = 0.65;
    o.panSpeed = 0.65;
    o.minPolarAngle = 0.12;
    o.maxPolarAngle = Math.PI / 2 - 0.035;
    o.minDistance = 0.65;
    o.maxDistance = 45;
    o.screenSpacePanning = false;
    o.addEventListener("change", () => this.request());
    o.addEventListener("start", () => {
      this.transition = null;
      this.onStart();
      this.request();
    });
    canvas.addEventListener(
      "pointerdown",
      () => {
        this.transition = null;
      },
      { capture: true },
    );
    canvas.addEventListener(
      "wheel",
      () => {
        this.transition = null;
      },
      { capture: true, passive: true },
    );
    this.setMode("edit");
  }
  configure(c, reset = true) {
    this.config = c;
    const span = Math.max(c.widthM, c.depthM);
    this.controls.maxDistance = span * 4;
    this.camera.far = Math.max(100, span * 8);
    this.camera.updateProjectionMatrix();
    if (reset) this.full(false);
  }
  setMode(mode) {
    this.mode = mode;
    const o = this.controls;
    const edit = mode === "edit";
    o.mouseButtons = {
      LEFT: edit ? null : T.MOUSE.ROTATE,
      MIDDLE: T.MOUSE.PAN,
      RIGHT: edit ? T.MOUSE.ROTATE : T.MOUSE.PAN,
    };
    o.touches = {
      ONE: edit ? null : T.TOUCH.ROTATE,
      TWO: edit ? null : T.TOUCH.DOLLY_PAN,
    };
  }
  transitionTo(position, target, animate = true) {
    this.flush();
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!animate || reduce) {
      this.camera.position.copy(V(position));
      this.controls.target.copy(V(target));
      this.controls.update();
      this.request();
      return;
    }
    this.transition = {
      start: performance.now(),
      fromP: this.camera.position.clone(),
      fromT: this.controls.target.clone(),
      toP: V(position),
      toT: V(target),
      duration: 800,
    };
    this.request();
  }
  full(animate = true) {
    const c = this.config,
      s = Math.max(c.widthM, c.depthM),
      aspect = this.camera.aspect;
    const f = Math.max(1, 1.2 / aspect);
    this.transitionTo(
      [s * 0.91 * f, s * 0.95 * f, s * 1.13 * f],
      [0, 0.65, 0],
      animate,
    );
  }
  view(name) {
    if (name === "edit" || name === "browse") {
      this.setMode(name);
      return;
    }
    this.setMode("browse");
    const v = this.config.viewpoints[name];
    this.transitionTo(v.position, v.target);
  }
  focus(item, height = 0.6) {
    const target = new T.Vector3(item.x, height * 0.55, item.z),
      direction = this.camera.position
        .clone()
        .sub(this.controls.target)
        .normalize(),
      distance = Math.max(2.2, height * 1.8);
    this.transitionTo(
      target.clone().addScaledVector(direction, distance).toArray(),
      target.toArray(),
    );
  }
  zoom(factor) {
    const p = this.camera.position
      .clone()
      .sub(this.controls.target)
      .multiplyScalar(factor);
    const l = T.MathUtils.clamp(
      p.length(),
      this.controls.minDistance,
      this.controls.maxDistance,
    );
    p.setLength(l);
    this.transitionTo(
      this.controls.target.clone().add(p).toArray(),
      this.controls.target.toArray(),
    );
  }
  rotate() {
    const p = this.camera.position.clone().sub(this.controls.target);
    p.applyAxisAngle(new T.Vector3(0, 1, 0), Math.PI / 4);
    this.transitionTo(
      this.controls.target.clone().add(p).toArray(),
      this.controls.target.toArray(),
    );
  }
  flush() {
    const d = this.controls.enableDamping;
    this.controls.enableDamping = false;
    this.controls.update();
    this.controls.enableDamping = d;
  }
  cancel(resetInput = false) {
    this.transition = null;
    this.flush();
    if (resetInput) {
      this.controls.disconnect();
      this.controls.connect(this.canvas);
    }
    this.request();
  }
  clamp() {
    const c = this.config;
    if (!c) return;
    const t = this.controls.target;
    t.x = T.MathUtils.clamp(t.x, -c.widthM / 2, c.widthM / 2);
    t.z = T.MathUtils.clamp(t.z, -c.depthM / 2, c.depthM / 2);
    t.y = T.MathUtils.clamp(t.y, 0.1, 2.5);
    this.camera.position.y = Math.max(0.28, this.camera.position.y);
  }
  request() {
    if (this.running) return;
    this.running = true;
    requestAnimationFrame((t) => this.tick(t));
  }
  tick(now) {
    const previous = this.lastTime;
    this.lastTime = now;
    this.inTick = true;
    let moving = false;
    if (this.transition) {
      const t = this.transition,
        k = Math.min(1, (now - t.start) / t.duration),
        s = k * k * (3 - 2 * k);
      this.camera.position.lerpVectors(t.fromP, t.toP, s);
      this.controls.target.lerpVectors(t.fromT, t.toT, s);
      if (k === 1) this.transition = null;
      else moving = true;
    }
    const dt=previous ? Math.min(.2,Math.max(.001,(now-previous)/1000)) : 1/60;
    // OrbitControls dampingFactor is per update; convert a time constant to the
    // current frame interval so low frame rates do not prolong the settling time.
    this.controls.dampingFactor=1-Math.exp(-8.4*dt);
    moving = this.controls.update(dt) || moving;
    this.clamp();
    this.camera.lookAt(this.controls.target);
    this.draw();
    this.renderCount++;
    if (previous && now - previous < 5000) this.frames.push(now - previous);
    if (this.frames.length > 600) this.frames.shift();
    this.inTick = false;
    this.running = false;
    if (moving || this.transition) this.request();
    else this.lastTime = null;
  }
  state(view = this.mode) {
    return {
      position: this.camera.position.toArray(),
      target: this.controls.target.toArray(),
      view,
    };
  }
  restore(s) {
    if (!s) return this.full(false);
    this.setMode(s.view === "edit" ? "edit" : "browse");
    this.transitionTo(s.position, s.target, false);
  }
  stats() {
    return {
      running: this.running,
      transition: !!this.transition,
      renderCount: this.renderCount,
      position: this.camera.position.toArray(),
      target: this.controls.target.toArray(),
      mode: this.mode,
    };
  }
}

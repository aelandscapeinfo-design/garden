// Single owner for edit gestures. OrbitControls owns camera gestures only.
export function bindInteraction(
  canvas,
  {
    engine,
    getState,
    onPoint,
    onApply,
    onSelect,
    onStrokeStart,
    onStrokeEnd,
    onCancel,
  },
) {
  let state = "idle",
    down = null,
    last = null,
    pointers = new Set(),
    cancelled = false;
  const mode = () => engine.view === "edit";
  function finish(cancel = false) {
    if (state === "paint") onStrokeEnd(cancel);
    state = "idle";
    down = null;
    last = null;
    cancelled = cancel;
    onPoint(null);
  }
  const cameraStart = () => {
    if (state !== "idle") finish(true);
    state = "camera";
    cancelled = true;
    onPoint(null);
  };
  engine.controller.onStart = cameraStart;
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener(
    "pointerdown",
    (e) => {
      pointers.add(e.pointerId);
      if (pointers.size > 1) {
        finish(true);
        state = "multi";
        cancelled = true;
        return;
      }
      cancelled = false;
      if (!mode() || e.button !== 0) {
        state = "camera";
        return;
      }
      canvas.setPointerCapture(e.pointerId);
      down = { id: e.pointerId, x: e.clientX, y: e.clientY };
      last = engine.at(e);
      const s = getState();
      state = s.paint ? "paint" : s.moving ? "move" : "click";
      if (state === "paint") {
        onStrokeStart();
        onApply(last);
      }
      onPoint(last);
    },
    { capture: true },
  );
  canvas.addEventListener("pointermove", (e) => {
    if (
      !mode() ||
      ["camera", "multi"].includes(state) ||
      (!e.isPrimary && e.pointerType !== "mouse")
    )
      return;
    const p = engine.at(e);
    if (state === "paint" && down?.id === e.pointerId && p) {
      if (last) {
        const n = Math.ceil(
          Math.max(Math.abs(p.x - last.x), Math.abs(p.z - last.z)) * 4,
        );
        for (let i = 1; i <= Math.min(n, 80); i++)
          onApply({
            x: Math.round((last.x + ((p.x - last.x) * i) / n) * 4) / 4,
            z: Math.round((last.z + ((p.z - last.z) * i) / n) * 4) / 4,
          });
      } else onApply(p);
      last = p;
    }
    onPoint(p);
  });
  canvas.addEventListener("pointerup", (e) => {
    pointers.delete(e.pointerId);
    if (down?.id === e.pointerId && !cancelled && mode()) {
      if (
        (state === "click" || state === "move") &&
        Math.hypot(e.clientX - down.x, e.clientY - down.y) < 10
      ) {
        const p = engine.at(e);
        onPoint(p);
        getState().tool ? onApply(p) : onSelect(e);
      }
    }
    if (!pointers.size) finish(false);
  });
  const cancel = () => {
    for (const id of pointers)
      if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    pointers.clear();
    finish(true);
    engine.controller.cancel(true);
    onCancel?.();
  };
  canvas.addEventListener("pointercancel", cancel);
  window.addEventListener("blur", cancel);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") cancel();
  });
  canvas.addEventListener("pointerleave", () => {
    if (state === "idle") onPoint(null);
  });
  return {
    cancel,
    state: () => ({ state, pointers: pointers.size, cancelled }),
  };
}

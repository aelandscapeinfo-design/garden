import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
const wait = async (p) => {
  await p.waitForFunction(() => window.owol);
  await p.waitForFunction(() => !owol.stats().camera.running, {
    timeout: 90000,
  });
};
const start = async (p) => {
  await p.goto("/");
  await wait(p);
};
const state = (p) => p.evaluate(() => owol.state());
const clickAt = async (p, x, z) => {
  const q = await p.evaluate(([x, z]) => owol.screen(x, z), [x, z]);
  await p.mouse.click(q.x, q.y);
};
const blank = async (p) => {
  await p.locator("#empty").click();
  await p.locator("#confirm-go").click();
  await wait(p);
};
async function space(p, id, mode = "archive", w, d) {
  await p.locator("#edit-profile").click();
  await p.locator("#preset").selectOption(id);
  if (w) await p.locator("[name=width]").fill(String(w));
  if (d) await p.locator("[name=depth]").fill(String(d));
  if (await p.locator("#transfer-options").isVisible())
    await p.locator(`[name=transfer][value=${mode}]`).check();
  await p.locator("#condition-form [type=submit]").click();
  await wait(p);
}
async function importJSON(p, data) {
  await p.locator("#import-open").click();
  await p
    .locator("#import-file")
    .setInputFiles({
      name: "garden.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        typeof data === "string" ? data : JSON.stringify(data),
      ),
    });
}
async function exported(p) {
  const download = p.waitForEvent("download");
  await p.locator("#export-json").click();
  const d = await download;
  return JSON.parse(await fs.readFile(await d.path(), "utf8"));
}
test("four actual presets: geometry, refresh restore, JSON roundtrip and captures", async ({
  page: p,
}) => {
  test.setTimeout(300000);
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("response", (r) => {
    if (r.status() >= 400) errors.push(r.url() + ":" + r.status());
  });
  await start(p);
  await p.locator("#skip").click();
  for (const id of ["front", "terrace", "courtyard", "rooftop"]) {
    if (id !== "front") await space(p, id);
    let s = await state(p),
      stats = await p.evaluate(() => owol.stats());
    expect(s.config.presetId).toBe(id);
    expect(stats.terrainBounds).toEqual({
      widthM: s.config.widthM,
      depthM: s.config.depthM,
    });
    expect(s.config.plantableZones.length).toBeGreaterThan(0);
    expect(s.items.length).toBeGreaterThan(10);
    await p.screenshot({ path: `evidence/preset-${id}.png` });
    await p.locator("#save").click();
    await p.reload();
    await wait(p);
    await p.locator("#load").click();
    await wait(p);
    expect((await state(p)).config).toEqual(s.config);
    expect((await state(p)).items).toEqual(s.items);
    const data = await exported(p);
    await blank(p);
    await importJSON(p, data);
    await wait(p);
    expect((await state(p)).items).toEqual(s.items);
    expect((await state(p)).config).toEqual(s.config);
  }
  expect(errors).toEqual([]);
});
test("dimensions, explicit cancel/transfer, pending tray and undo protect every object", async ({
  page: p,
}) => {
  await start(p);
  await space(p, "terrace", "archive", 6, 3);
  const before = await state(p);
  await space(p, "terrace", "move", 10, 5);
  let s = await state(p),
    stats = await p.evaluate(() => owol.stats());
  expect(s.config.widthM).toBe(10);
  expect(s.config.depthM).toBe(5);
  expect(stats.gridBounds.min.x).toBe(-5);
  expect(stats.gridBounds.max.z).toBe(2.5);
  expect(stats.terrainBounds).toEqual({ widthM: 10, depthM: 5 });
  await expect(p.locator("#profile-note")).toContainText("50 m²");
  expect(s.camera.position).not.toEqual(before.camera.position);
  expect(s.items.length + s.pending.length).toBe(before.items.length);
  await p.locator("#edit-profile").click();
  await p.locator("[name=width]").fill("3");
  await p.locator("#condition-skip").click();
  expect((await state(p)).config.widthM).toBe(10);
  await space(p, "terrace", "move", 3, 3);
  s = await state(p);
  expect(s.pending.length).toBeGreaterThan(0);
  expect(s.items.length + s.pending.length).toBe(before.items.length);
  await p.screenshot({ path: "evidence/dimension-transfer.png" });
  await p.locator("#save").click();
  await p.reload();
  await wait(p);
  await p.locator("#load").click();
  await wait(p);
  expect((await state(p)).pending).toEqual(s.pending);
  const data = await exported(p);
  await importJSON(p, data);
  await wait(p);
  expect((await state(p)).pending).toEqual(s.pending);
  await p.locator("#pending-open").click();
  await expect(p.locator("#pending-list button").first()).toBeVisible();
  await p.locator("#pending-list button").first().click();
  const pendingBefore = (await state(p)).pending.length;
  await clickAt(p, -1, 0);
  await wait(p);
  expect((await state(p)).pending.length).toBe(pendingBefore - 1);
  await p.locator("#undo").click();
  expect((await state(p)).pending.length).toBe(pendingBefore);
});
test("place move rotate delete undo redo, PNG and taste board exports", async ({
  page: p,
}) => {
  await start(p);
  await blank(p);
  await p.locator("[data-type=grass]").click();
  await clickAt(p, -2, -1);
  expect((await state(p)).items.length).toBe(1);
  const built = await p.evaluate(() => owol.stats().constructions);
  await p.locator("#select-tool").click();
  await clickAt(p, -2, -1);
  await expect(p.locator("#selection")).toBeVisible();
  await p.locator("#move").click();
  await clickAt(p, -1.5, -1);
  expect((await state(p)).items[0].x).toBe(-1.5);
  expect(await p.evaluate(() => owol.stats().constructions)).toBe(built);
  await p.locator("#rotate").click();
  expect((await state(p)).items[0].r).toBe(15);
  await p.locator("#delete").click();
  expect((await state(p)).items.length).toBe(0);
  await p.locator("#undo").click();
  expect((await state(p)).items.length).toBe(1);
  await p.locator("#redo").click();
  expect((await state(p)).items.length).toBe(0);
  await p.locator("#undo").click();
  const png = p.waitForEvent("download");
  await p.locator("#scene-png").click();
  const file = await png;
  await file.saveAs("evidence/scene-export.png");
  expect((await fs.readFile(await file.path())).subarray(1, 4).toString()).toBe(
    "PNG",
  );
  await p.locator("#board-open").click();
  await p.locator("#wish").fill("빛이 드는 자리에서 쉬고 싶어요.");
  const board = p.waitForEvent("download");
  await p.locator("#board-png").click();
  const bd = await board;
  await bd.saveAs("evidence/taste-board.png");
  expect((await fs.readFile(await bd.path())).readUInt32BE(16)).toBe(1400);
  await p.locator("#board-save").click();
  await p.locator("#board [data-close]").click();
  await p.reload();
  await wait(p);
  await p.locator("#load").click();
  await wait(p);
  expect((await state(p)).wish).toContain("쉬고");
  expect((await state(p)).items.length).toBe(1);
});
test("camera orbit/pan/zoom twenty each never place or create history; transition and input cancellation", async ({
  page: p,
}) => {
  test.setTimeout(360000);
  await p.setViewportSize({ width: 1000, height: 760 });
  await start(p);
  await p.locator("#skip").click();
  await p.locator("[data-type=grass]").click();
  const before = await state(p);
  for (const type of ["orbit", "pan", "zoom"])
    for (let i = 0; i < 20; i++) {
      await p.mouse.move(570, 340);
      if (type === "zoom") {
        await p.mouse.wheel(0, i % 2 ? 50 : -50);
      } else {
        const button = type === "orbit" ? "right" : "middle";
        await p.mouse.down({ button });
        await p.mouse.move(570 + (i % 2 ? -15 : 15), 345, { steps: 2 });
        await p.mouse.up({ button });
      }
    }
  await wait(p);
  let after = await state(p);
  expect(after.items).toEqual(before.items);
  expect(after.past).toBe(before.past);
  expect(after.camera.position).not.toEqual(before.camera.position);
  await p.locator("[data-view=browse]").click();
  const position = (await state(p)).camera.position;
  await wait(p);
  (await state(p)).camera.position.forEach((v, i) =>
    expect(v).toBeCloseTo(position[i], 4),
  );
  await p.locator("[data-view=entrance]").click();
  await p.mouse.move(540, 340);
  await p.mouse.down();
  await p.mouse.move(570, 350, { steps: 2 });
  await p.mouse.up();
  await wait(p);
  expect(await p.evaluate(() => owol.stats().camera.transition)).toBe(false);
  expect((await state(p)).items).toEqual(before.items);
  for (const view of ["seat", "entrance", "edit"]) {
    await p.locator(`[data-view=${view}]`).click();
    await wait(p);
  }
  await p.locator("#camera-home").click();
  await wait(p);
  await p.setViewportSize({ width: 1100, height: 800 });
  // Wait for ResizeObserver to see the new canvas dimensions before testing idle.
  await p.waitForFunction(()=>owol.stats().width===1100 && owol.stats().height===722);
  await wait(p);
  expect((await state(p)).items).toEqual(before.items);
  const renders = await p.evaluate(() => owol.stats().camera.renderCount);
  await p.waitForTimeout(350);
  expect(await p.evaluate(() => owol.stats().camera.renderCount)).toBe(renders);
});
test("paint stroke has one undo; pointercancel, blur and UI never leave a stuck stroke", async ({
  page: p,
}) => {
  await start(p);
  await blank(p);
  await p.locator("[data-tab=surface]").click();
  await p.locator("[data-type=gravel]").click();
  const a = await p.evaluate(() => owol.screen(-2, -1)),
    b = await p.evaluate(() => owol.screen(-2, 1));
  await p.mouse.move(a.x, a.y);
  await p.mouse.down();
  await p.mouse.move(b.x, b.y, { steps: 7 });
  await p.mouse.up();
  let s = await state(p);
  expect(s.items.length).toBeGreaterThan(3);
  expect(s.past).toBe(2);
  await p.locator("#undo").click();
  expect((await state(p)).items.length).toBe(0);
  await p.locator("#redo").click();
  expect((await state(p)).items.length).toBe(s.items.length);
  await p.locator("[data-type=gravel]").click();
  await p.mouse.move(a.x + 30, a.y);
  await p.mouse.down();
  await p.evaluate(() =>
    document
      .querySelector("#scene canvas")
      .dispatchEvent(
        new PointerEvent("pointercancel", { pointerId: 1, bubbles: true }),
      ),
  );
  await p.mouse.up();
  expect((await state(p)).interaction.state).toBe("idle");
  await p.mouse.down({ button: "right" });
  await p.mouse.move(a.x + 50, a.y + 20);
  await p.evaluate(() => window.dispatchEvent(new Event("blur")));
  const cameraAfterBlur = (await state(p)).camera.position;
  await p.mouse.move(a.x + 90, a.y + 50);
  await p.mouse.up({ button: "right" });
  await wait(p);
  (await state(p)).camera.position.forEach((v, i) =>
    expect(v).toBeCloseTo(cameraAfterBlur[i], 3),
  );
  expect((await state(p)).interaction.state).toBe("idle");
  const current = await state(p);
  await p.locator("#edit-profile").click();
  await p.locator("[name=width]").fill("9");
  await p.keyboard.press("r");
  await p.keyboard.press("Delete");
  await p.locator("#condition-skip").click();
  expect((await state(p)).items).toEqual(current.items);
});
test("V2 migration preserves its slot, rejects malformed JSON and unknown versions", async ({
  page: p,
}) => {
  await start(p);
  await p.evaluate(() => {
    const old = {
      version: 2,
      items: [{ id: 1, type: "hosta", x: 0, z: 0, r: 0, scale: 1, variant: 0 }],
      profile: { space: "테라스" },
      wish: "V2",
    };
    localStorage.setItem("owol-garden-v2", JSON.stringify(old));
  });
  const old = await p.evaluate(() => localStorage.getItem("owol-garden-v2"));
  await p.locator("#import-open").click();
  await p.locator("#legacy-load").click();
  await wait(p);
  expect((await state(p)).config.presetId).toBe("legacy");
  expect((await state(p)).config.widthM).toBe(8);
  await p.locator("#save").click();
  expect(await p.evaluate(() => localStorage.getItem("owol-garden-v2"))).toBe(
    old,
  );
  const current = await state(p);
  await importJSON(p, "{broken");
  await expect(p.locator("#toast")).toContainText("가져오기 실패");
  expect((await state(p)).items).toEqual(current.items);
  await p.locator("#import-dialog [data-close]").click();
  await importJSON(p, { version: 99 });
  await expect(p.locator("#toast")).toContainText("지원하지 않는");
  expect((await state(p)).config).toEqual(current.config);
});
test("mobile touch editing and browsing gestures are separate; resize has no overflow", async ({
  browser,
}) => {
  test.setTimeout(240000);
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const p = await ctx.newPage();
  await start(p);
  await p.screenshot({ path: "evidence/mobile-ui.png" });
  expect(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await blank(p);
  await p.locator("[data-type=grass]").click();
  let q = await p.evaluate(() => owol.screen(-2, -1));
  await p.touchscreen.tap(q.x, q.y);
  expect((await state(p)).items.length).toBe(1);
  const before = await state(p);
  await p.locator("[data-view=browse]").click();
  const cdp = await ctx.newCDPSession(p);
  const touch = async (type, points) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });
  await touch("touchStart", [{ x: 180, y: 350, id: 0 }]);
  await touch("touchMove", [{ x: 220, y: 370, id: 0 }]);
  await touch("touchEnd", []);
  await wait(p);
  expect((await state(p)).camera.position).not.toEqual(before.camera.position);
  const cam = (await state(p)).camera.position;
  await touch("touchStart", [
    { x: 150, y: 350, id: 0 },
    { x: 230, y: 350, id: 1 },
  ]);
  await touch("touchMove", [
    { x: 125, y: 360, id: 0 },
    { x: 255, y: 360, id: 1 },
  ]);
  await touch("touchEnd", []);
  await wait(p);
  expect((await state(p)).camera.position).not.toEqual(cam);
  expect((await state(p)).items).toEqual(before.items);
  expect((await state(p)).past).toBe(before.past);
  await p.locator("[data-view=edit]").click();
  await p.locator("#camera-home").click();
  await wait(p);
  await p.screenshot({ path: "evidence/mobile-edit.png" });
  await ctx.close();
});

test("reduced motion, two-touch cancellation in edit and mobile paint history", async ({
  browser,
}) => {
  const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      reducedMotion: "reduce",
    }),
    p = await ctx.newPage();
  await start(p);
  await p.locator("[data-view=entrance]").click();
  expect(await p.evaluate(() => owol.stats().camera.transition)).toBe(false);
  await p.locator("[data-view=edit]").click();
  await p.locator("#camera-home").click();
  await wait(p);
  await blank(p);
  await p.locator("[data-type=grass]").click();
  const cdp = await ctx.newCDPSession(p),
    touch = (type, touchPoints) =>
      cdp.send("Input.dispatchTouchEvent", { type, touchPoints }),
    q = await p.evaluate(() => owol.screen(-2, -1));
  await touch("touchStart", [{ x: q.x, y: q.y, id: 0 }]);
  await touch("touchStart", [
    { x: q.x, y: q.y, id: 0 },
    { x: q.x + 30, y: q.y, id: 1 },
  ]);
  await touch("touchMove", [
    { x: q.x + 5, y: q.y, id: 0 },
    { x: q.x + 50, y: q.y, id: 1 },
  ]);
  await touch("touchEnd", []);
  expect((await state(p)).items.length).toBe(0);
  await p.locator("[data-tab=surface]").click();
  await p.locator("[data-type=gravel]").click();
  const a = await p.evaluate(() => owol.screen(-2, -1)),
    b = await p.evaluate(() => owol.screen(-2, 1));
  await touch("touchStart", [{ x: a.x, y: a.y, id: 0 }]);
  await touch("touchMove", [{ x: b.x, y: b.y, id: 0 }]);
  await touch("touchEnd", []);
  expect((await state(p)).items.length).toBeGreaterThan(3);
  expect((await state(p)).past).toBe(2);
  await p.locator("#undo").click();
  expect((await state(p)).items.length).toBe(0);
  await ctx.close();
});

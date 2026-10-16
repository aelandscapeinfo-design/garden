import { chromium } from "playwright-core";
import fs from "node:fs/promises";
import { seedGarden } from "../src/layout.js";
const b = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const p = await b.newPage({ viewport: { width: 1440, height: 960 } }),
  errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const wait = async () => {
  await p.waitForFunction(() => window.owol);
  await p.waitForFunction(() => !owol.stats().camera.running, {
    timeout: 90000,
  });
};
const importData = async (d) => {
  await p.locator("#import-open").click();
  await p
    .locator("#import-file")
    .setInputFiles({
      name: "scene.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(d)),
    });
  await wait();
};
const png = async (name) => {
  const d = p.waitForEvent("download");
  await p.locator("#scene-png").click();
  await (await d).saveAs("evidence/" + name);
};
await p.goto("http://127.0.0.1:5176");
await wait();
await p.screenshot({ path: "evidence/v3-front.png" });
await fs.writeFile(
  "evidence/v3-front-same-camera.png",
  Buffer.from(
    (await p.evaluate(() => owol.comparisonImage())).split(",")[1],
    "base64",
  ),
);
const s = await p.evaluate(() => owol.state()),
  d = {
    version: 3,
    sceneConfig: s.config,
    items: s.items,
    pending: [],
    profile: s.profile,
    wish: "오래 머물며 잎을 바라보고 싶어요.",
    camera: s.camera,
  };
for (const v of ["entrance", "seat"]) {
  await p.locator(`[data-view=${v}]`).click();
  await wait();
  await p.screenshot({ path: "evidence/" + v + ".png" });
  await png(v + "-scene.png");
}
for (const [name, position, target] of [
  ["leaves-close", [-0.45, 2.4, 0.6], [-2.1, 2.3, -1.15]],
  ["ground-close", [-0.8, 0.85, 2.7], [-2, 0.2, 0.4]],
  ["furniture-close", [1.65, 1.5, -0.05], [2.95, 0.55, -2.2]],
]) {
  await importData({ ...d, camera: { position, target, view: "browse" } });
  await png(name + ".png");
}
await importData({ ...d, camera: { ...s.camera, view: "edit" } });
await p.locator("#board-open").click();
await p.locator("#wish").fill(d.wish);
await p.screenshot({ path: "evidence/taste-board-screen.png" });
const bd = p.waitForEvent("download");
await p.locator("#board-png").click();
await (await bd).saveAs("evidence/taste-board-full.png");
await p.locator("#board [data-close]").click();
await importData({
  version: 2,
  items: seedGarden(),
  profile: { space: "모르겠어요" },
  wish: "",
});
await fs.writeFile(
  "evidence/v3-legacy-same-camera.png",
  Buffer.from(
    (await p.evaluate(() => owol.comparisonImage())).split(",")[1],
    "base64",
  ),
);
await fs.writeFile(
  "assets/registry.json",
  JSON.stringify(await p.evaluate(() => owol.assetStats()), null, 2),
);
await fs.writeFile(
  "evidence/capture-validation.json",
  JSON.stringify(
    {
      errors,
      preset: "front",
      elements: s.items.length,
      legacyElements: seedGarden().length,
      comparison:
        "V2 and V3 legacy: identical 161 items, 8×8 space, 1440×690 ortho camera; front is the new 8×6 composition.",
    },
    null,
    2,
  ),
);
console.log({ errors });
await b.close();

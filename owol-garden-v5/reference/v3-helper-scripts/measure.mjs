import { chromium } from "playwright-core";
import fs from "node:fs/promises";
import os from "node:os";
import { createScene } from "../src/scene-config.js";
import { populate } from "../src/presets.js";
import { placementError } from "../src/rules.js";
import { encode } from "../src/persistence.js";
const b = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const output = {
  date: new Date().toISOString(),
  platform: os.platform(),
  cpu: os.cpus()[0].model,
  allocatedCPUs: os.availableParallelism(),
  browser: b.version(),
  viewport: { width: 1920, height: 1080 },
  dpr: 1,
  samples: [],
  method:
    "Actual right-button pointer drag with Playwright mouse events. Frame intervals recorded by the on-demand camera render loop; includes browser scheduling and software GPU stalls. Not pure GPU time or a real-device guarantee.",
};
function fixture(n) {
  const config = createScene("front", 10, 8),
    base = populate(config);
  let items = base.slice(0, Math.min(n, base.length));
  let id = Math.max(...items.map((i) => i.id)) + 1;
  for (let z = -3.5; z < 3.5 && items.length < n; z += 0.23)
    for (let x = -4.6; x < 4.6 && items.length < n; x += 0.28) {
      const item = {
        id,
        type: ["hosta", "grass", "flower", "meadow", "cover", "shrub"][id % 6],
        x: +x.toFixed(3),
        z: +z.toFixed(3),
        r: (id * 15) % 360,
        scale: 0.9,
        variant: id % 3,
      };
      if (!placementError(item, items, config)) {
        items.push(item);
        id++;
      }
    }
  if (items.length !== n) throw Error("Fixture count mismatch");
  return encode({
    config,
    items,
    pending: [],
    profile: {},
    wish: "Performance fixture",
    camera: null,
  });
}
for (const count of [100, 300])
  for (const quality of ["standard", "light"]) {
    const p = await b.newPage({
      viewport: output.viewport,
      deviceScaleFactor: 1,
    });
    let bytes = 0;
    const cdp = await p.context().newCDPSession(p);
    await cdp.send("Network.enable");
    cdp.on("Network.loadingFinished", (e) => (bytes += e.encodedDataLength));
    p.setDefaultTimeout(180000);
    const start = performance.now();
    await p.goto("http://127.0.0.1:5176");
    await p.waitForFunction(() => window.owol);
    await p.waitForFunction(() => !owol.stats().camera.running, {
      timeout: 120000,
    });
    const readyMs = Math.round(performance.now() - start);
    await p.locator("#skip").click();
    await p.locator("#import-open").click();
    await p
      .locator("#import-file")
      .setInputFiles({
        name: "fixture.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(fixture(count))),
      });
    await p.waitForFunction(() => !owol.stats().camera.running);
    if (quality === "light") await p.locator("#quality").click();
    await p.waitForFunction(() => !owol.stats().camera.running);
    await p.mouse.move(1000, 450);
    await p.evaluate(() => owol.measurement(true));
    await p.mouse.down({ button: "right" });
    for (let j = 0; j < 32; j++)
      await p.mouse.move(
        1000 + Math.sin(j / 12) * 130,
        450 + Math.sin(j / 16) * 32,
        { steps: 1 },
      );
    await p.mouse.up({ button: "right" });
    await p.waitForFunction(() => !owol.stats().camera.running, {
      timeout: 120000,
    });
    const stats = await p.evaluate(() => owol.measurement());
    output.samples.push({
      count,
      quality,
      readyMs,
      networkTransferredBytes: bytes,
      ...stats,
    });
    await fs.writeFile("evidence/performance.json",JSON.stringify(output,null,2));
    await p.screenshot({
      path: `evidence/performance-${count}-${quality}.png`,
    });
    console.log({
      count,
      quality,
      p50: stats.frameTimeP50,
      p95: stats.frameTimeP95,
      frames: stats.frames,
    });
    await p.close();
  }
await fs.writeFile(
  "evidence/performance.json",
  JSON.stringify(output, null, 2),
);
await b.close();

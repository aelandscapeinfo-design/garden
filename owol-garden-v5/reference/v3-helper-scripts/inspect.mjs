import { chromium } from "playwright-core";
import fs from "node:fs/promises";
const b = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await p.goto("http://127.0.0.1:5176");
await p.waitForFunction(() => window.owol, { timeout: 120000 });
await p.waitForFunction(() => !owol.stats().camera.running, {
  timeout: 120000,
});
await p.screenshot({ path: "evidence/v3-front.png" });
await fs.writeFile(
  "evidence/v3-same-camera.png",
  Buffer.from(
    (await p.evaluate(() => owol.comparisonImage())).split(",")[1],
    "base64",
  ),
);
console.log(
  JSON.stringify({
    errors,
    stats: await p.evaluate(() => ({
      count: owol.state().items.length,
      ...owol.stats(),
    })),
  }),
);
await b.close();

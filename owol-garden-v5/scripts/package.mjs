import fs from "node:fs/promises";
import path from "node:path";
await fs.mkdir("release", { recursive: true });
let html = await fs.readFile("dist/index.html", "utf8");
const js = html.match(/<script[^>]*src="([^"]+)"[^>]*><\/script>/),
  css = html.match(/<link[^>]*href="([^"]+\.css)"[^>]*>/);
if (!js || !css) throw Error("Built JS/CSS tags missing");
const code = await fs.readFile("dist" + js[1], "utf8"),
  style = await fs.readFile("dist" + css[1], "utf8");
html = html.replace(
  js[0],
  () =>
    '<script type="module">' +
    code.replace(/<\/script/gi, "<\\/script") +
    "</script>",
);
html = html.replace(css[0], () => "<style>" + style + "</style>");
await fs.writeFile("release/OWOL-garden-v5.html", html);
let notices =
  "OWOL Garden V5 third-party code notices. No third-party artwork is included.\n\n";
for (const name of [
  "three",
  "polygon-clipping",
  "robust-predicates",
  "splaytree",
  "vite",
  "@playwright/test",
  "playwright",
  "playwright-core",
]) {
  const dir = "node_modules/" + name;
  const pkg = JSON.parse(await fs.readFile(dir + "/package.json", "utf8"));
  let license = "";
  for (const f of [
    "LICENSE",
    "LICENSE.md",
    "LICENSE.txt",
    "LICENSE-MIT",
    "LICENSE-MIT.txt",
  ])
    try {
      license = await fs.readFile(dir + "/" + f, "utf8");
      break;
    } catch {}
  if (!license && name === "splaytree") {
    const r = await fs.readFile(dir + "/Readme.md", "utf8");
    license = r.slice(r.search(/## License/i));
  }
  if (!license) throw Error("Missing licence " + name);
  notices += "\n==== " + name + " " + pkg.version + " ====\n" + license + "\n";
}
await fs.writeFile("THIRD-PARTY-NOTICES.txt", notices);
await fs.writeFile("release/THIRD-PARTY-NOTICES.txt", notices);
for (const f of ["ASSETS.md", "README.md", "VALIDATION.md"])
  try {
    await fs.copyFile(f, "release/" + f);
  } catch {}
await fs.copyFile('RUN-ME.txt','release/먼저 읽어주세요.txt');
await fs.copyFile('scripts/serve-standalone.mjs','release/serve.mjs');
await fs.copyFile('START-ART-WINDOWS.cmd','release/START-ART-WINDOWS.cmd');
console.log('Standalone HTML and runner packaged:',html.length,'characters');

// Serves the already-built app. No npm packages or external service required.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../dist/", import.meta.url)),
  port = 5182;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".json": "application/json",
};
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost"),
      name =
        decodeURIComponent(url.pathname) === "/"
          ? "index.html"
          : decodeURIComponent(url.pathname).slice(1),
      file = path.resolve(root, name);
    if (!file.startsWith(root)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const data = await fs.readFile(file);
    res.writeHead(200, {
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
server.on("error", (e) => {
  console.error(
    e.code === "EADDRINUSE"
      ? "Port 5182 is already in use. Close the previous OWOL server and try again."
      : e.message,
  );
  process.exit(1);
});
server.listen(port, "127.0.0.1", () =>
  console.log(
    "OWOL Garden V5 — open http://localhost:" +
      port +
      " on THIS computer. Stop with Ctrl+C.",
  ),
);

import { readdir, readFile, writeFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, relative, extname } from "node:path";

const root = resolve("dist");
// Android does not ship demo records, update pages or an installable web app.
for (const path of ["archives", "manifest.webmanifest", "update.html", "update.js", "sw.js"])
  await rm(resolve(root, path), { recursive: true, force: true });
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2", ".woff": "font/woff", ".ogg": "audio/ogg", ".glb": "model/gltf-binary", ".pdf": "application/pdf", ".txt": "text/plain" };
const files = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (entry.isFile() && entry.name !== "asset-manifest.json") {
      const bytes = await readFile(path);
      files.push({ path: relative(root, path).replaceAll("\\", "/"), sha256: createHash("sha256").update(bytes).digest("hex"), mime: mime[extname(path)] ?? "application/octet-stream", size: bytes.length });
    }
  }
}
await walk(root);
files.sort((a, b) => a.path.localeCompare(b.path));
const manifest = { version: 1, reference: "17a16118f31b55b7156b68e89b6fe989408351f0", files };
await writeFile(resolve(root, "asset-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`Android offline manifest: ${files.length} assets, ${files.reduce((n, f) => n + f.size, 0)} bytes`);

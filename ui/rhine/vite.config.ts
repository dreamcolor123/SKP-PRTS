import { defineConfig } from "vite";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";

// Keep Blender's stable source/export paths, while production URLs identify
// exact bytes and can be cached without revalidation across deployments.
const models = ["archive-cassette", "archive-assembly"].map(name => {
  const source = readFileSync(`public/assets/${name}.glb`);
  const hash = createHash("sha256").update(source).digest("hex").slice(0,16);
  return { key:`assets/${name}.glb`, fileName:`assets/${name}.${hash}.glb`, source };
});
const hasNovecento = ["Normal", "DemiBold", "Bold"].every(weight =>
  existsSync(`public/fonts/novecento/webFonts/NovecentoSansWide${weight}/font.woff2`),
);
export default defineConfig(({ mode }) => ({
  base: mode === "wallpaper" ? "./" : "/",
  build: { target: "chrome90" },
  define: {
    __RHINE_MODELS__: JSON.stringify(Object.fromEntries(models.map(model => [model.key,model.fileName]))),
    __RHINE_NOVECENTO__: JSON.stringify(hasNovecento),
  },
  plugins: [{
    name: "versioned-model-assets", apply: "build",
    buildStart() { for (const model of models) this.emitFile({type:"asset",fileName:model.fileName,source:model.source}); },
  }, ...(mode === "android" ? [{
    name: "offline-android-document",
    transformIndexHtml(html: string) {
      return html.replace(/\s*<link rel="manifest"[^>]*>/, "")
        .replace("<title>RHINE LAB · ANALYSIS OS</title>", "<title>SKRoot Pro · SKP-PRTS</title>")
        .replace('content="Rhine Lab"', 'content="SKRoot Pro"')
        .replace("Rhine Lab — Synthesize Information Analysis OS. 交互式三维研究档案终端。", "SKRoot Pro · 离线设备管理终端")
        .replace("<head>", `<head>\n<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; media-src 'self' blob:; connect-src 'self'; worker-src 'self' blob:; frame-src 'none'; object-src 'none'; base-uri 'none'">`);
    },
  }] : []), ...(mode === "wallpaper" ? [{
    name: "wallpaper-host",
    transformIndexHtml(html: string) {
      return { html: html.replace(/\s*<link rel="manifest"[^>]*>/, ""), tags: [{
        tag: "script", children: readFileSync("wallpaper/host.js", "utf8"), injectTo: "head-prepend" as const,
      }] };
    },
  }] : [])],
}));

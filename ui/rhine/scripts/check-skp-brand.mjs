// Brand-specific browser QA: original frame timing, SVG rendering and lettering.
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { build } = require(process.env.ESBUILD_MODULE || "esbuild");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(process.env.BRAND_QA_OUTPUT || "../../deliverables/brand-qa");
await mkdir(output, { recursive: true });
const compile = async (source, cwd, browser = false) => (await build({
  stdin: { contents: source, resolveDir: cwd, loader: "ts" }, bundle: true,
  format: browser ? "iife" : "cjs", globalName: browser ? "SkpBrandTest" : undefined,
  platform: browser ? "browser" : "node", write: false, loader: { ".css": "empty" },
  define: { __RHINE_NOVECENTO__: "false", "import.meta.env.PROD": "false", "import.meta.env.BASE_URL": '"/"' },
})).outputFiles[0].text;
function moduleFrom(code) { const module = { exports: {} }; new Function("module", "exports", code)(module, module.exports); return module.exports; }
const candidate = moduleFrom(await compile('export { bootMotion } from "./src/boot-motion"', root));
let comparedFrames = 0;
if (process.env.REFERENCE_ROOT) {
  const original = moduleFrom(await compile('export { bootMotion } from "./src/boot-motion"', resolve(process.env.REFERENCE_ROOT)));
  const geometry = (s) => { const { access, auth, logoLetters, poweredLetters, ...rest } = s; return rest; };
  for (let frame = 0; frame <= 850; frame++) {
    const t = frame / 25;
    assert.deepEqual(geometry(candidate.bootMotion(t)), geometry(original.bootMotion(t)), `reference frame ${frame}`);
    comparedFrames++;
  }
}
const bundle = await compile('export { BootSequence } from "./src/boot"; export { logo, brandHeading } from "./src/brand";', root, true);
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setContent('<div id="stage"></div>');
  for (const path of ["style.css", "boot-lettering.css"])
    await page.addStyleTag({ content: (await readFile(resolve(root, "src", path), "utf8")).replace(/@import[^;]+;/g, "") });
  await page.addStyleTag({ content: "#stage { left: 0; top: 0; transform: none; }" });
  await page.addScriptTag({ content: bundle });
  await page.evaluate(() => {
    const stage = document.querySelector("#stage");
    stage.innerHTML = `<div class="brand">${SkpBrandTest.brandHeading}</div><div class="powered">POWERED BY SKROOT PRO</div><div id="boot-background" class="boot-background"><svg></svg></div><div class="boot"><div class="access-text"></div><div class="boot-logo">${SkpBrandTest.logo}</div><div class="auth-status"><span>◈</span><span id="auth-message"></span></div><div class="scan"><svg viewBox="0 0 1920 1080"><g>${"<path/>".repeat(6)}<circle class="orbit-dot"/><circle class="orbit-dot"/><circle class="scan-core"/></g></svg><span></span></div><div class="welcome"><div class="welcome-panel"></div><div class="welcome-heading"></div><div class="welcome-company"><strong>SKROOT PRO</strong><strong>SKROOT PRO</strong></div><div class="welcome-highlight"></div><div class="welcome-database"></div><div class="welcome-logo">${SkpBrandTest.logo}</div></div><div class="boot-white"></div></div>`;
    window.sequence = new SkpBrandTest.BootSequence(stage);
  });
  for (const time of [4.16, 4.8, 5.4, 8.2, 14.48, 16.04, 17.76, 19.04, 21.92]) {
    const observation = await page.evaluate(t => {
      window.sequence.update(t);
      const mark = document.querySelector(".boot-logo svg");
      const wordmark = mark.querySelector(".sk-wordmark");
      const rect = wordmark.getBBox();
      return { frame: document.querySelector("#stage").dataset.bootFrame,
        fallback: document.querySelectorAll(".boot-lettering-fallback").length,
        paths: mark.querySelectorAll("[data-brand-letter]").length,
        wordmark: { width: rect.width, height: rect.height },
        contourLength: mark.querySelector(".sk-contour").getTotalLength() };
    }, time);
    assert.equal(observation.fallback, 0, `every visible phrase has authored artwork at ${time}s`);
    assert.equal(observation.paths, 9);
    assert(observation.contourLength > 700);
    assert(observation.wordmark.width > 0);
    await page.screenshot({ path: resolve(output, `boot-${time.toFixed(2)}.png`) });
  }
  await page.evaluate(() => window.sequence.reset());
  assert.deepEqual(errors, []);
  const report = { status: "passed", comparedFrames, originalDiscreteFps: 25, preservedTimeline: comparedFrames === 851,
    authoredGlyphs: 9, phraseFallbacks: 0, capturedFrames: 9, pageErrors: errors };
  await writeFile(resolve(output, "brand-verification.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await browser.close(); }

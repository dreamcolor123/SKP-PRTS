import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.SKP_PLAYWRIGHT_PATH || "playwright");
const out = process.env.SKP_AUDIO_OUTPUT || ".tools/audio-host";
await mkdir(out, { recursive: true });
const manifest = JSON.parse(await readFile("dist/asset-manifest.json", "utf8"));
const files = new Map(manifest.files.map(file => ["/" + file.path, file]));
const server = createServer(async (request, response) => {
  const path = request.url.split("?")[0];
  const file = files.get(path === "/" ? "/index.html" : path);
  if (!file) { response.writeHead(404).end(); return; }
  response.writeHead(200, { "Content-Type": file.mime });
  response.end(await readFile("dist/" + file.path));
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ channel: "msedge", headless: true,
  args: ["--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
const results = [];
const errors = [];
let passed = false;
try {
  const page = await browser.newPage({ viewport: { width: 412, height: 892 } });
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.waitForFunction(() => window.rhine);
  await page.evaluate(() => {
    const channel = new MessageChannel();
    window.hostPort = channel.port1;
    channel.port1.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.type === "ready") channel.port1.postMessage(JSON.stringify({
        type: "presentation", active: false, audioActive: true,
        bootAllowed: false, reducedMotion: true, initialBootCompleted: false,
      }));
    };
    window.postMessage(JSON.stringify({ type: "skp:init", version: 1, sessionId: "audio-fixture" }), location.origin, [channel.port2]);
  });
  await page.waitForFunction(() => window.rhine.stats().ready);
  await page.waitForTimeout(400);
  const initial = await page.evaluate(() => window.rhine.stats().audio);
  assert.equal(initial.tracks, 0, "The first Root form must not start music");
  assert.equal(initial.hostPaused, true);
  results.push({ phase: "initial-root-form", ...initial });
  const control = async fields => page.evaluate(fields => window.hostPort.postMessage(JSON.stringify({ type: "presentation", ...fields })), fields);
  await control({ active: true, audioActive: true, bootAllowed: true, initialBootCompleted: true });
  await page.waitForFunction(() => window.rhine.stats().mode === "detail");
  await page.locator(".system-nav [data-action=settings]").click();
  await page.locator("[data-pref=music]").check();
  await page.waitForFunction(() => window.rhine.stats().audio.state === "running" && window.rhine.stats().audio.tracks === 3);

  const assertContinuous = async phase => {
    const before = await page.evaluate(() => window.rhine.stats().audio);
    await page.waitForTimeout(450);
    const after = await page.evaluate(() => window.rhine.stats().audio);
    assert.equal(after.state, "running", phase);
    assert.equal(after.tracks, 3, phase);
    assert.equal(after.hostPaused, false, phase);
    assert.ok(after.time > before.time + .2, `${phase}: audio clock must advance`);
    results.push({ phase, before, after });
  };
  await assertContinuous("web-settings");
  await page.evaluate(() => window.rhine.back());
  await page.locator(".system-nav [data-action=search]").click();
  await assertContinuous("web-search");
  await page.evaluate(() => window.rhine.back());
  await control({ active: false, audioActive: true });
  await page.waitForFunction(() => !window.rhine.stats().host.presentation.active);
  await assertContinuous("native-panel-rendering-paused");
  await control({ active: false, audioActive: false });
  await page.waitForFunction(() => window.rhine.stats().audio.state === "suspended" && window.rhine.stats().audio.tracks === 0);
  const paused = await page.evaluate(() => window.rhine.stats().audio);
  await page.waitForTimeout(400);
  const stillPaused = await page.evaluate(() => window.rhine.stats().audio);
  assert.ok(Math.abs(stillPaused.time - paused.time) < .01, "Background audio clock must remain paused");
  results.push({ phase: "background", before: paused, after: stillPaused });
  await control({ active: true, audioActive: true });
  await page.waitForFunction(() => window.rhine.stats().audio.state === "running" && window.rhine.stats().audio.tracks === 3);
  await assertContinuous("foreground-restored");
  assert.deepEqual(errors, []);
  passed = true;
  console.log(JSON.stringify({ passed, results, errors }, null, 2));
} finally {
  await writeFile(`${out}/report.json`, JSON.stringify({ passed, results, errors }, null, 2));
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

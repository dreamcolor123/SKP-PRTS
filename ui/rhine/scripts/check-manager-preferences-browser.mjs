import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const dependencies = "C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
const { chromium } = require(process.env.SKP_PLAYWRIGHT_PATH || `${dependencies}/playwright`);
const { PNG } = require(process.env.SKP_PNGJS_PATH || `${dependencies}/pngjs`);
const out = process.env.SKP_BROWSER_OUTPUT || "D:/SKP-PRTS-UI-transaction/deliverables/manager-preferences-qa";
await mkdir(out, { recursive: true });
const manifest = JSON.parse(await readFile("dist/asset-manifest.json", "utf8"));
const files = new Map(manifest.files.map(file => [`/${file.path}`, file]));
// A concurrent Android build may replace dist; freeze the exact manifest's bytes for this run.
const assetBytes = new Map();
for (const entry of manifest.files) assetBytes.set(entry.path, await readFile(`dist/${entry.path}`));
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  const entry = files.get(pathname === "/" ? "/index.html" : pathname);
  if (!entry) { res.writeHead(404).end(); return; }
  try {
    res.writeHead(200, { "Content-Type": entry.mime });
    res.end(assetBytes.get(entry.path));
  } catch { res.writeHead(500).end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const record = (id, title, category, section) => ({ id, title, category, section, isRoot: true, en: "LOCAL", department: "SKRoot Pro", date: "4.6.2.2", lead: "LOCAL", clearance: "LOCAL", abstract: "", findings: [], source: "", actions: [] });
const fixture = { uiMode: "rhine", uiModeSwitchAllowed: true, appVersion: "4.6.2.2", records: [
  record("home.summary", "系统概览", "系统概览", "home"),
  record("authorization:manager", "授权", "授权", "authorization"),
  record("modules:manager", "模块", "已安装模块", "modules"),
  record("market:catalog", "市场", "模块市场", "market"),
  record("settings:controls", "内核设置", "设置与诊断", "settings"),
] };
const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
const results = [], failures = [];
const mobile = { width: 412, height: 892 };
const desktop = { width: 1440, height: 1000 };
let caseNumber = 0;

async function inspect(page) {
  return page.evaluate(() => ({ ...window.rhine.stats(), stored: JSON.parse(localStorage.getItem("rhine-settings") || "null"),
    bootFrame: document.querySelector("#stage")?.dataset.bootFrame, renderedModes: window.testRenderedModes,
    workspace: window.rhine.workspaceState(), hostEvents: window.testHostEvents, actions: window.testHostActions }));
}

async function connect(page, overrides = {}) {
  await page.waitForFunction(() => window.rhine, undefined, { timeout: 30000 });
  await page.evaluate(({ fixture, overrides, session }) => {
    const channel = new MessageChannel();
    window.testHostPort = channel.port1;
    window.testHostEvents = [];
    window.testHostActions = [];
    window.testPresentation = { active: true, audioActive: true, bootAllowed: true, reducedMotion: false,
      initialBootCompleted: false, initialBootTime: 1.76, textScale: 1, ...overrides };
    channel.port1.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.type === "ready") {
        channel.port1.postMessage(JSON.stringify({ type: "state", revision: 1, state: fixture }));
        channel.port1.postMessage(JSON.stringify({ type: "presentation", ...window.testPresentation }));
      } else if (message.requestId) window.testHostActions.push(message);
      else window.testHostEvents.push(message);
    };
    window.postMessage(JSON.stringify({ type: "skp:init", version: 1, sessionId: session }), location.origin, [channel.port2]);
  }, { fixture, overrides, session: `manager-preferences-${++caseNumber}` });
  await page.waitForFunction(() => window.rhine.stats().ready && window.rhine.stats().startup === "started", undefined, { timeout: 45000 });
}

async function hostPresentation(page, changes) {
  await page.evaluate(changes => {
    Object.assign(window.testPresentation, changes);
    window.testHostPort.postMessage(JSON.stringify({ type: "presentation", ...window.testPresentation }));
  }, changes);
}

async function workspace(page) {
  if ((await inspect(page)).mode === "boot") await page.locator('[data-action="skip"]:visible').first().click({ force: true });
  await page.waitForFunction(() => window.rhine.stats().mode === "detail" && document.querySelector(".folder-face-panel")?.dataset.expanded === "true");
  await page.waitForFunction(() => window.rhine.stats().cameraDetail > .99);
}

async function settings(page) {
  if (!await page.locator(".settings-modal").count()) await page.locator('.system-nav [data-action="settings"]').click();
  await page.locator('.settings-modal [data-pref="openingEnabled"]').waitFor({ state: "attached" });
}

async function setPreference(page, key, value) {
  const input = page.locator(`.settings-modal [data-pref="${key}"]`);
  assert.equal(await input.count(), 1, `Settings must expose exactly one ${key} control`);
  // Custom-styled checkboxes still dispatch their real production change handler.
  await input.evaluate((element, value) => { element.checked = value; element.dispatchEvent(new Event("change", { bubbles: true })); }, value);
  await page.waitForFunction(({ key, value }) => JSON.parse(localStorage.getItem("rhine-settings") || "{}")[key] === value, { key, value });
}

async function preferences(page) {
  return page.locator(".settings-modal [data-pref]").evaluateAll(inputs => Object.fromEntries(inputs.map(input => [input.dataset.pref, input.type === "checkbox" ? input.checked : input.value])));
}

async function canvasEvidence(page, label) {
  await page.waitForTimeout(350);
  const canvas = page.locator("#three-scene canvas").first();
  const bytes = await canvas.screenshot();
  await writeFile(`${out}/${label}-canvas.png`, bytes);
  const png = PNG.sync.read(bytes), colors = new Set();
  let opaque = 0;
  for (let i = 0; i < png.data.length; i += 64) {
    colors.add(png.data.subarray(i, i + 3).join(","));
    if (png.data[i + 3] > 0) opaque++;
  }
  assert.ok(png.width > 100 && png.height > 100, `Canvas dimensions: ${png.width}x${png.height}`);
  assert.ok(colors.size > 30 && opaque > 100, `Offline canvas must contain rendered geometry: ${colors.size} colors, ${opaque} opaque samples`);
  return { width: png.width, height: png.height, colors: colors.size, opaqueSamples: opaque };
}

async function removedEntryGuards(page) {
  const selector = '[data-action="visual-lab"],[data-action="lab-model"],[data-action="model-viewer"]';
  assert.equal(await page.locator(selector).count(), 0, "Removed Android entries must be absent, not merely hidden");
  const before = await inspect(page);
  await page.evaluate(() => window.rhine.visualLab());
  for (const action of ["visual-lab", "lab-model", "model-viewer"]) {
    await page.evaluate(action => {
      const button = document.createElement("button");
      button.dataset.action = action;
      document.querySelector("#stage").append(button);
      button.click();
      button.remove();
    }, action);
  }
  await page.waitForTimeout(400);
  const after = await inspect(page);
  assert.equal(after.host.visualLab, false);
  assert.equal(after.mode, before.mode);
  assert.equal(after.selected, before.selected);
  assert.deepEqual(after.workspace, before.workspace);
  assert.equal(await page.locator(".model-viewer,.skp-lab-controls").count(), 0);
  assert.deepEqual(after.actions, []);
  return { absentEntries: 3, guardedApi: "visualLab", guardedClickActions: 3, unchangedWorkspace: true };
}

async function assertNoRenderedOpening(page, label) {
  await page.waitForTimeout(250);
  const frames = await page.evaluate(() => window.testRenderedModes);
  assert.ok(frames.length > 0, `${label} must sample rendered animation frames`);
  assert.equal(frames.some(frame => frame.mode === "boot"), false, `${label} must never render an opening frame: ${JSON.stringify(frames)}`);
  return frames;
}

async function assertReplayGuard(page, forcePreview = false) {
  await page.evaluate(() => { window.testRenderedModes = []; });
  if (forcePreview) {
    await page.evaluate(() => {
      const button = document.createElement("button");
      button.id = "fixture-preview";
      button.textContent = "Preview test";
      button.style.cssText = "position:fixed;top:4px;left:4px;z-index:2147483647";
      button.onclick = async () => { window.fixturePreviewActivated = navigator.userActivation.isActive; window.fixturePreviewResult = await window.rhine.playBootPreview(false); };
      document.body.append(button);
    });
    await page.locator("#fixture-preview").click();
    await page.waitForFunction(() => typeof window.fixturePreviewResult === "boolean");
    assert.equal(await page.evaluate(() => window.fixturePreviewActivated), true, "Preview guard must be exercised with real user activation");
    assert.equal(await page.evaluate(() => window.fixturePreviewResult), true, "Preview must reach the guarded replay path");
    await page.locator("#fixture-preview").evaluate(button => button.remove());
  } else {
    await settings(page);
    await page.locator('.settings-modal [data-action="restart"]').click();
  }
  await page.waitForFunction(() => {
    const state = window.rhine.stats(), workspace = window.rhine.workspaceState();
    return state.mode === "detail" && state.cameraDetail > .99 && state.selected === "home.summary" &&
      workspace.section === "home" && workspace.root && !workspace.browsing && !document.querySelector(".settings-modal");
  });
  return assertNoRenderedOpening(page, forcePreview ? "Force preview under system reduced motion" : "Manual replay with opening disabled");
}

async function scenario(name, options, run) {
  const context = await browser.newContext({ viewport: options.viewport || mobile, reducedMotion: options.systemReduced ? "reduce" : "no-preference" });
  const page = await context.newPage();
  const errors = [], externalRequests = [], failedRequests = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (!request.url().startsWith(origin) && /^https?:/.test(request.url())) externalRequests.push(request.url()); });
  page.on("requestfailed", request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
  await page.addInitScript(stored => {
    window.testRenderedModes = [];
    const observe = () => {
      const state = window.rhine?.stats();
      if (state?.startup === "started") {
        const previous = window.testRenderedModes.at(-1);
        if (!previous || previous.mode !== state.mode) window.testRenderedModes.push({ mode: state.mode, bootFrame: document.querySelector("#stage")?.dataset.bootFrame });
      }
      requestAnimationFrame(observe);
    };
    requestAnimationFrame(observe);
    if (sessionStorage.getItem("manager-fixture-initialized")) return;
    sessionStorage.setItem("manager-fixture-initialized", "true");
    if (stored !== null) localStorage.setItem("rhine-settings", JSON.stringify(stored));
  }, options.stored ?? null);
  try {
    await page.goto(origin);
    await connect(page, options.host);
    const evidence = await run(page);
    assert.deepEqual(errors, [], `${name} JavaScript errors`);
    assert.deepEqual(externalRequests, [], `${name} must run fully offline`);
    results.push({ name, passed: true, ...evidence, errors, externalRequests, failedRequests });
  } catch (error) {
    const state = await inspect(page).catch(() => null);
    await page.screenshot({ path: `${out}/${name}-failure.png` }).catch(() => {});
    const failure = { name, passed: false, error: String(error), stack: error.stack, state, errors, externalRequests, failedRequests };
    failures.push(failure);
    results.push(failure);
  } finally {
    await writeFile(`${out}/results.json`, JSON.stringify({ passed: false, pending: true, results }, null, 2));
    await context.close();
  }
}

try {
  for (const viewport of [mobile, desktop]) {
    await scenario(`fresh-${viewport.width}x${viewport.height}`, { viewport }, async page => {
      const fresh = await inspect(page);
      assert.equal(fresh.mode, "boot", "Fresh manager must retain the full opening");
      assert.equal(fresh.motion.reduced, true);
      assert.equal(fresh.motion.openingEnabled, true);
      assert.equal(fresh.motion.openingReduced, false);
      assert.equal(fresh.motion.sceneReduced, false, "Daily reduced motion must not simplify opening camera motion");

      if (viewport.width === mobile.width) {
        await hostPresentation(page, { active: false, audioActive: false });
        await page.waitForFunction(() => !window.rhine.stats().host.presentation.active);
        await page.waitForTimeout(150);
        const pausedFrame = await page.locator("#stage").getAttribute("data-boot-frame");
        assert.notEqual(pausedFrame, null);
        await page.waitForTimeout(650);
        assert.equal(await page.locator("#stage").getAttribute("data-boot-frame"), pausedFrame);
        assert.equal((await inspect(page)).mode, "boot", "Backgrounding must not complete the opening");
        await hostPresentation(page, { active: true, audioActive: true });
        await page.waitForFunction(frame => document.querySelector("#stage")?.dataset.bootFrame !== frame, pausedFrame);
        assert.equal((await inspect(page)).mode, "boot");
      }
      await workspace(page);
      assert.equal((await inspect(page)).motion.sceneReduced, true);
      const canvas = await canvasEvidence(page, `fresh-${viewport.width}x${viewport.height}`);
      const guards = await removedEntryGuards(page);
      await settings(page);
      const defaults = await preferences(page);
      assert.equal(defaults.music, false);
      assert.equal(defaults.reduced, true);
      assert.equal(defaults.openingEnabled, true);
      assert.equal(await page.locator('[data-action="visual-lab"],[data-action="lab-model"],[data-action="model-viewer"]').count(), 0);
      await page.screenshot({ path: `${out}/settings-${viewport.width}x${viewport.height}.png` });
      await page.locator('.settings-modal label:has([data-pref="openingEnabled"])').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${out}/settings-motion-${viewport.width}x${viewport.height}.png` });

      await setPreference(page, "reduced", false);
      assert.equal((await inspect(page)).motion.openingEnabled, true);
      assert.equal((await inspect(page)).motion.sceneReduced, false);
      await setPreference(page, "openingEnabled", false);
      await setPreference(page, "reduced", true);
      assert.equal((await inspect(page)).motion.openingEnabled, false);
      await page.reload();
      await connect(page);
      assert.notEqual((await inspect(page)).mode, "boot", "Disabled opening must not need an explicit skip");
      await workspace(page);
      const reloaded = await inspect(page);
      assert.equal(reloaded.motion.openingEnabled, false);
      assert.equal(reloaded.motion.sceneReduced, true);
      assert.equal(reloaded.stored.music, false);
      assert.equal(reloaded.stored.reduced, true);
      const disabledFrames = await assertNoRenderedOpening(page, "Disabled opening on reload");
      const replayFrames = await assertReplayGuard(page);
      return { viewport, freshMotion: fresh.motion, defaults, canvas, guards,
        hostPauseAndResume: viewport.width === mobile.width ? "boot-frame-frozen-then-resumed-without-skipping" : "covered-by-mobile-case",
        disabledReload: reloaded.motion, disabledFrames, replayFrames };
    });
  }

  await scenario("existing-explicit-preferences", { stored: { music: true, reduced: false, openingEnabled: true } }, async page => {
    const before = await inspect(page);
    assert.equal(before.mode, "boot");
    assert.equal(before.motion.reduced, false);
    assert.equal(before.motion.openingEnabled, true);
    await workspace(page);
    await settings(page);
    const persisted = await preferences(page);
    assert.equal(persisted.music, true);
    assert.equal(persisted.reduced, false);
    assert.equal(persisted.openingEnabled, true);
    await setPreference(page, "reduced", true);
    await setPreference(page, "reduced", false);
    const after = await inspect(page);
    assert.equal(after.stored.music, true);
    assert.equal(after.stored.reduced, false);
    assert.equal(after.stored.openingEnabled, true);
    return { before: before.motion, preserved: after.stored };
  });

  await scenario("existing-without-opening-key", { stored: { music: true, reduced: true } }, async page => {
    const state = await inspect(page);
    assert.equal(state.mode, "boot", "Introducing the opening key must not reinterpret an existing daily-motion preference");
    assert.equal(state.motion.openingEnabled, true);
    assert.equal(state.motion.openingReduced, false);
    await workspace(page);
    await settings(page);
    assert.equal((await preferences(page)).music, true);
    return { motion: state.motion, migratedOpeningDefault: true };
  });

  for (const source of ["css", "native"]) {
    await scenario(`system-reduced-${source}`, { stored: { music: true, reduced: false, openingEnabled: true },
      systemReduced: source === "css", host: { reducedMotion: source === "native" } }, async page => {
      assert.notEqual((await inspect(page)).mode, "boot", "System reduced motion must not need an explicit skip");
      await workspace(page);
      const state = await inspect(page);
      assert.equal(state.motion.openingEnabled, true);
      assert.equal(state.motion.openingReduced, true);
      assert.equal(state.motion.sceneReduced, true);
      assert.equal(state.stored.reduced, false, "System overrides must not replace the user's stored preference");
      assert.equal(state.stored.openingEnabled, true);
      assert.equal(state.stored.music, true);
      const startupFrames = await assertNoRenderedOpening(page, `System reduced motion from ${source}`);
      const previewFrames = await assertReplayGuard(page, true);
      const modeBeforeOverrideCleared = (await inspect(page)).mode;
      if (source === "native") await hostPresentation(page, { reducedMotion: false });
      else await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.waitForFunction(() => !window.rhine.stats().motion.sceneReduced);
      assert.equal((await inspect(page)).mode, modeBeforeOverrideCleared, "Clearing a system override must not change or replay the current page");
      return { motion: state.motion, unchangedUserPreferences: state.stored, startupFrames, previewFrames, systemOverrideClearedWithoutReplay: true };
    });
  }

  const report = { passed: failures.length === 0, scenarios: results.length, failures: failures.length, results, output: out };
  await writeFile(`${out}/results.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (failures.length) process.exitCode = 1;
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

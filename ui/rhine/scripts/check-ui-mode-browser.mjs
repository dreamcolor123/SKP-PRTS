import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.SKP_PLAYWRIGHT_PATH || "playwright");
const { PNG } = require(process.env.SKP_PNGJS_PATH || "pngjs");
const out = process.env.SKP_BROWSER_OUTPUT || ".tools/ui-mode";
await mkdir(out, { recursive: true });
const manifest = JSON.parse(await readFile("dist/asset-manifest.json", "utf8"));
const files = new Map(manifest.files.map(file => [`/${file.path}`, file]));
const server = createServer(async (req, res) => {
  const path = req.url.split("?")[0];
  const file = files.get(path === "/" ? "/index.html" : path);
  if (!file) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "Content-Type": file.mime });
  res.end(await readFile(`dist/${file.path}`));
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
const results = [], errors = [];
const scenarios = [
  { viewport: { width: 412, height: 892 }, textScale: 1 },
  { viewport: { width: 1440, height: 1000 }, textScale: 1 },
  { viewport: { width: 360, height: 800 }, textScale: 1 },
  { viewport: { width: 892, height: 412 }, textScale: 1 },
  { viewport: { width: 412, height: 892 }, textScale: 1.6 },
];
async function inspectButtons(container, viewport, name) {
  const buttons = await container.locator("button").evaluateAll(buttons => buttons.map(button => {
    const rect = button.getBoundingClientRect();
    return { mode: button.dataset.uiMode, width: button.offsetWidth, height: button.offsetHeight,
      screen: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
      contentFits: button.scrollWidth <= button.clientWidth + 1 && button.scrollHeight <= button.clientHeight + 1 };
  }));
  assert.ok(buttons.every(button => button.width >= 48 && button.height >= 48), `${name} local target: ${JSON.stringify(buttons)}`);
  assert.ok(buttons.every(button => button.screen.width >= 48 && button.screen.height >= 48), `${name} projected target: ${JSON.stringify(buttons)}`);
  assert.ok(buttons.every(button => button.screen.left >= 0 && button.screen.top >= 0 && button.screen.right <= viewport.width && button.screen.bottom <= viewport.height), `${name} viewport bounds: ${JSON.stringify(buttons)}`);
  assert.ok(buttons.every(button => button.contentFits), `${name} text bounds: ${JSON.stringify(buttons)}`);
  return buttons;
}
try {
  for (const { viewport, textScale } of scenarios) {
    const caseId = `${viewport.width}x${viewport.height}-text${textScale}`;
    const page = await browser.newPage({ viewport });
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(origin);
    await page.waitForFunction(() => window.rhine);
    await page.evaluate(({ fixture, textScale }) => {
      const channel = new MessageChannel();
      window.hostPort = channel.port1; window.actions = []; window.hostEvents = []; window.snapshot = fixture; window.revision = 1;
      channel.port1.onmessage = event => {
        const message = JSON.parse(event.data);
        if (message.type === "ready") {
          channel.port1.postMessage(JSON.stringify({ type: "state", revision: window.revision, state: fixture }));
          channel.port1.postMessage(JSON.stringify({ type: "presentation", active: true, bootAllowed: true, reducedMotion: false, initialBootCompleted: true, textScale }));
        } else if (message.requestId) window.actions.push(message);
        else window.hostEvents.push(message);
      };
      window.postMessage(JSON.stringify({ type: "skp:init", version: 1, sessionId: "ui-mode-browser" }), location.origin, [channel.port2]);
    }, { fixture, textScale });
    await page.waitForSelector(".folder-face-panel[data-expanded=true]", { timeout: 30000 });
    await page.waitForFunction(() => window.rhine.stats().cameraDetail > .999);
    await page.locator('.workspace-navigation [data-section="settings"]').click();
    await page.waitForFunction(() => document.querySelector('.folder-face-panel')?.dataset.section === 'settings' && !document.querySelector('.folder-face-panel')?.inert);
    await page.waitForFunction(() => {
      const rect = document.querySelector('.folder-face-panel .ui-mode-options')?.getBoundingClientRect();
      return rect && rect.left > 0 && rect.right < innerWidth && rect.top > 0 && rect.bottom < innerHeight;
    });
    await page.waitForTimeout(1200);
    const workspace = page.locator(".folder-face-panel .ui-mode-settings");
    assert.equal(await workspace.count(), 1);
    assert.equal(await page.locator(".ff-body > :first-child").getAttribute("class"), "ui-mode-settings");
    await page.screenshot({ path: `${out}/settings-workspace-${caseId}.png` });
    const workspaceButtons = await inspectButtons(workspace, viewport, `${caseId} workspace`);
    assert.equal(await page.evaluate(() => Number(document.documentElement.style.getPropertyValue("--workspace-text-scale"))), textScale);
    const canvas = PNG.sync.read(await page.locator("#three-scene canvas").first().screenshot());
    const colors = new Set();
    for (let i = 0; i < canvas.data.length; i += 64) colors.add(canvas.data.subarray(i, i + 3).join(","));
    assert.ok(colors.size > 30, `3D scene is nonblank: ${colors.size}`);
    await page.locator('.system-nav [data-action="settings"]').click();
    const modal = page.locator(".settings-modal .ui-mode-settings");
    await modal.waitFor({ state: "visible" });
    assert.equal(await modal.count(), 1);
    assert.equal(await modal.locator('[data-ui-mode="rhine"]').getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator('[data-app-version]').textContent(), "4.6.2.2");
    await page.screenshot({ path: `${out}/settings-appearance-${caseId}.png` });
    const modalButtons = await inspectButtons(modal, viewport, `${caseId} appearance`);
    await modal.locator('[data-ui-mode="legacy"]').click();
    await page.waitForFunction(() => window.actions.length === 1);
    const request = await page.evaluate(() => window.actions[0]);
    assert.equal(request.action, "ui.mode.set");
    assert.deepEqual(request.payload, { mode: "legacy" });
    assert.equal(await page.locator(".ui-mode-settings button:disabled").count(), 4);
    await page.evaluate(() => document.querySelectorAll('[data-ui-mode="legacy"]').forEach(button => button.click()));
    assert.equal(await page.evaluate(() => window.actions.length), 1);
    assert.equal(await modal.locator('[data-ui-mode="rhine"]').getAttribute("aria-pressed"), "true");
    await page.evaluate(requestId => window.hostPort.postMessage(JSON.stringify({ type: "ack", requestId, status: "rejected", reason: "先完成当前操作" })), request.requestId);
    await page.waitForFunction(() => document.querySelector('.settings-modal .ui-mode-reason')?.textContent === '先完成当前操作');
    assert.equal(await page.locator(".ui-mode-settings button:disabled").count(), 0);
    await page.evaluate(() => window.hostPort.postMessage(JSON.stringify({ type: "state", revision: ++window.revision, state: { ...window.snapshot, uiModeSwitchAllowed: false, uiModeSwitchReason: "模块正在安装" } })));
    await page.waitForFunction(() => document.querySelectorAll('.ui-mode-settings button:disabled').length === 4);
    await page.screenshot({ path: `${out}/settings-disabled-${caseId}.png` });
    await page.evaluate(() => window.hostPort.postMessage(JSON.stringify({ type: "state", revision: ++window.revision, state: window.snapshot })));
    await page.waitForFunction(() => document.querySelectorAll('.ui-mode-settings button:disabled').length === 0);
    await page.locator('[data-action="close-modal"]').click();
    await page.waitForTimeout(600);
    await workspace.locator('[data-ui-mode="legacy"]').click();
    await page.waitForFunction(() => window.actions.length === 2);
    assert.equal(await page.evaluate(() => window.actions[1].action), "ui.mode.set");
    await page.evaluate(() => document.querySelector('#three-scene canvas').dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
    await page.waitForFunction(() => window.hostEvents.some(event => event.type === 'error'));
    assert.equal(await page.evaluate(() => document.querySelector('#stage').inert), true);
    results.push({ viewport, textScale, workspaceButtons, modalButtons, canvasColors: colors.size, rootAndModalRequests: 2, contextLostReported: true });
    await writeFile(`${out}/results.json`, JSON.stringify({ passed: false, pending: true, results, errors }, null, 2));
    await page.close();
  }
  // A missing essential model must request native fallback, not open a flat workspace.
  const failedPage = await browser.newPage({ viewport: { width: 412, height: 892 } });
  await failedPage.route(/\/assets\/archive-cassette(?:\.[a-f0-9]+)?\.glb(?:\?|$)/, route => route.fulfill({ status: 404, body: "missing fixture model" }));
  await failedPage.goto(origin);
  await failedPage.waitForFunction(() => window.rhine);
  await failedPage.waitForTimeout(1200);
  await failedPage.evaluate(() => {
    const channel = new MessageChannel(); window.failures = [];
    channel.port1.onmessage = event => window.failures.push(JSON.parse(event.data));
    window.postMessage(JSON.stringify({ type: "skp:init", version: 1, sessionId: "ui-mode-failed" }), location.origin, [channel.port2]);
  });
  await failedPage.waitForFunction(() => window.failures.some(event => event.type === 'error'));
  assert.equal(await failedPage.evaluate(() => document.querySelector('#stage').inert), true);
  assert.equal(await failedPage.locator('.folder-face-panel').isVisible(), false);
  results.push({ essentialModelFailure: "native-fallback-requested", flatWorkspaceOpened: false });
  await failedPage.close();
  assert.deepEqual(errors, []);
  await writeFile(`${out}/results.json`, JSON.stringify({ passed: true, results, errors }, null, 2));
  console.log(JSON.stringify({ passed: true, results, output: out }, null, 2));
} catch (error) {
  await writeFile(`${out}/results.json`, JSON.stringify({ passed: false, results, errors, failure: String(error) }, null, 2));
  throw error;
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }

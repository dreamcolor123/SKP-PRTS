import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.SKP_PLAYWRIGHT_PATH || 'playwright');
const { PNG } = require(process.env.SKP_PNGJS_PATH || 'pngjs');
const out = resolve(process.env.SKP_LOGO_HOST_OUTPUT || '.tools/user-logo-host');
await mkdir(out, { recursive: true });
const manifest = JSON.parse(await readFile('dist/asset-manifest.json', 'utf8'));
const files = new Map(manifest.files.map(file => ['/' + file.path, file]));
const server = createServer(async (request, response) => {
  const path = request.url.split('?')[0];
  const file = files.get(path === '/' ? '/index.html' : path);
  if (!file) { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'Content-Type': file.mime });
  response.end(await readFile('dist/' + file.path));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const report = { passed: false, pageErrors: [], loading: {}, boot: {}, captures: [] };
let page;
const send = async values => {
  await page.evaluate(values => window.logoHostPort.postMessage(JSON.stringify({ type: 'presentation', ...values })), values);
  await page.waitForFunction(values => Object.entries(values).every(([key, value]) => window.rhine.stats().host.presentation[key] === value), values);
};
const markState = selector => page.locator(selector).evaluate(root => ({
  motion: root.dataset.motion,
  s: root.querySelector('[data-logo-part=s]').getAttribute('opacity'),
  stem: root.querySelector('[data-logo-part=stem]').getAttribute('opacity'),
  bridge: root.querySelector('[data-logo-bridge]').getAttribute('width'),
  leg: root.querySelector('[data-logo-part=leg]').getAttribute('opacity'),
  highlight: root.querySelector('[data-logo-highlight]').getAttribute('x'),
}));
const sampleMovement = async selector => {
  const samples = [];
  for (let sample = 0; sample < 24; sample++) { samples.push(await markState(selector)); await page.waitForTimeout(180); }
  return { samples, changed: new Set(samples.map(value => JSON.stringify(value))).size > 1 };
};
const assertFrozen = async selector => {
  await page.waitForTimeout(100);
  const before = await markState(selector);
  await page.waitForTimeout(500);
  const after = await markState(selector);
  assert.deepEqual(after, before);
  return { before, after };
};

try {
  page = await browser.newPage({ viewport: { width: 412, height: 892 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => report.pageErrors.push(error.message));
  await page.goto(origin);
  await page.waitForFunction(() => window.rhine);
  await page.evaluate(() => {
    const channel = new MessageChannel();
    window.logoHostPort = channel.port1;
    channel.port1.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.type === 'ready') channel.port1.postMessage(JSON.stringify({ type: 'presentation', active: true, bootAllowed: false, reducedMotion: false }));
    };
    window.postMessage(JSON.stringify({ type: 'skp:init', version: 1, sessionId: 'logo-host-test' }), location.origin, [channel.port2]);
  });
  await page.waitForFunction(() => window.rhine.stats().host.connected && window.rhine.stats().ready, undefined, { timeout: 60000 });
  assert.equal(await page.locator('#loading').evaluate(element => element.classList.contains('loaded')), false);
  const loading = '.loading-mark svg';
  report.loading.playing = await sampleMovement(loading);
  assert.ok(report.loading.playing.changed, 'Loading logo must animate while active');
  await send({ active: false });
  report.loading.hostPaused = await assertFrozen(loading);
  await send({ active: true });
  report.loading.hostResumed = await sampleMovement(loading);
  assert.ok(report.loading.hostResumed.changed, 'Loading logo must resume with the host');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  report.loading.simulatedVisibilityPaused = await assertFrozen(loading);
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await send({ reducedMotion: true });
  await page.waitForFunction(() => document.querySelector('.loading-mark svg').dataset.motion === 'static');
  report.loading.reduced = await assertFrozen(loading);
  assert.deepEqual(report.loading.reduced.after, { motion: 'static', s: '1', stem: '1', bridge: '166', leg: '1', highlight: '-150' });
  await page.screenshot({ path: resolve(out, 'mobile-loading.png') });
  await send({ reducedMotion: false });
  await page.waitForFunction(() => document.querySelector('.loading-mark svg').dataset.motion === 'play');
  await send({ bootAllowed: true, initialBootTime: 4.4 });
  await page.waitForFunction(() => window.rhine.stats().startup === 'started');
  await page.waitForTimeout(120);
  await send({ active: false });
  report.boot.hostPaused = await assertFrozen('.boot-logo svg');
  const before = await page.locator('#stage').getAttribute('data-boot-frame');
  await send({ active: true });
  await page.waitForFunction(frame => document.querySelector('#stage').dataset.bootFrame !== frame, before);
  report.boot.hostResumed = { beforeFrame: Number(before), afterFrame: Number(await page.locator('#stage').getAttribute('data-boot-frame')) };
  for (const viewport of [{ width: 412, height: 892 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(viewport);
    for (const [name, time] of [['logo', 5.46], ['welcome', 19.82]]) {
      await page.evaluate(time => window.rhine.seek(time), time);
      await page.waitForFunction(frame => Number(document.querySelector('#stage').dataset.bootFrame) === frame, Math.floor((time + 5) * 25 + .00001));
      await page.waitForTimeout(200);
      const path = resolve(out, `${viewport.width}-${name}.png`);
      const image = PNG.sync.read(await page.screenshot({ path }));
      let purplePixels = 0;
      for (let i = 0; i < image.data.length; i += 4) if (image.data[i + 2] > image.data[i] + 20 && image.data[i + 2] > image.data[i + 1] + 40) purplePixels++;
      assert.ok(purplePixels > 100, `${viewport.width} ${name} must show the new purple logo`);
      const ids = await page.locator('.sk-user-logo [id]').evaluateAll(elements => elements.map(element => element.id));
      assert.equal(new Set(ids).size, ids.length, 'Actual app instances must have unique SVG IDs');
      report.captures.push({ viewport, name, time, purplePixels, path });
    }
  }
  await send({ reducedMotion: true });
  await page.waitForFunction(() => window.rhine.stats().mode !== 'boot');
  report.boot.reducedSkipsToWorkspace = true;
  assert.deepEqual(report.pageErrors, []);
  report.passed = true;
  console.log(JSON.stringify({ passed: true, loadingPauseResume: true, simulatedVisibilityGate: true, reduced: true, bootPauseResume: true, captures: report.captures.length, output: out }));
} catch (error) {
  report.failure = error.stack;
  throw error;
} finally {
  await writeFile(resolve(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

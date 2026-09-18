const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const output = path.resolve(__dirname, 'artifacts');
fs.mkdirSync(output, { recursive: true });
const server = spawn(process.execPath, [path.join(__dirname, 'serve.cjs')], {
  env: { ...process.env, PORT: '4318' }, stdio: 'pipe', windowsHide: true,
});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function pixels(buffer) {
  const png = PNG.sync.read(buffer);
  let occupied = 0, chroma = 0, minX = png.width, minY = png.height, maxX = 0, maxY = 0;
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
    const i = (y * png.width + x) * 4;
    const [r, g, b, a] = png.data.subarray(i, i + 4);
    if (a > 100) {
      occupied++; minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      if (Math.max(r, g, b) - Math.min(r, g, b) > 30) chroma++;
    }
  }
  return { occupied, chroma, fraction: occupied / (png.width * png.height), bounds: { minX, minY, maxX, maxY }, width: png.width, height: png.height };
}
async function main() {
  const vendor = path.resolve(__dirname, '../../app/src/main/assets/terminal/vendor');
  const manifest = JSON.parse(fs.readFileSync(path.join(vendor, 'manifest.json'), 'utf8'));
  for (const file of manifest.files) {
    const data = fs.readFileSync(path.join(vendor, file.path));
    assert.equal(data.length, file.bytes, file.path + ' size mismatch');
    assert.equal(crypto.createHash('sha256').update(data).digest('hex'), file.sha256, file.path + ' hash mismatch');
  }
  await delay(500);
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const results = [];
  try {
    for (const sample of [
      { name: 'desktop-light', width: 1280, height: 720, dark: false, quality: 'full' },
      { name: 'phone-light', width: 390, height: 844, dark: false, quality: 'balanced' },
      { name: 'phone-scene-light', width: 412, height: 240, dark: false, quality: 'balanced' },
      { name: 'phone-scene-dark', width: 412, height: 240, dark: true, quality: 'full' },
    ]) {
      const page = await browser.newPage({ viewport: { width: sample.width, height: sample.height }, deviceScaleFactor: 1 });
      const errors = [], requests = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('request', r => requests.push(r.url()));
      await page.goto(`http://127.0.0.1:4318/?dark=${sample.dark}&quality=${sample.quality}&reducedMotion=true`);
      await page.waitForFunction(() => window.__terminalRenderState === 'ready');
      await delay(400);
      const dom = await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        return { canvas: canvas.getBoundingClientRect().toJSON(), body: document.body.getBoundingClientRect().toJSON(), display: getComputedStyle(canvas).display };
      });
      assert.equal(dom.canvas.width, sample.width, 'Canvas CSS width does not match viewport');
      assert.equal(dom.canvas.height, sample.height, 'Canvas CSS height does not match viewport');
      assert(dom.body.height >= sample.height, 'Body collapsed below viewport height');
      const screenshot = await page.screenshot({ omitBackground: true, path: path.join(output, sample.name + '.png') });
      const measured = pixels(screenshot);
      assert(measured.occupied > 2000, 'Scene is blank');
      assert(measured.chroma > 80, 'Signal material is not visible');
      assert(measured.bounds.minX > 2 && measured.bounds.maxX < sample.width - 3, 'Device clipped horizontally');
      assert(measured.bounds.minY > 2 && measured.bounds.maxY < sample.height - 3, 'Device clipped vertically');
      assert.equal(errors.length, 0);
      assert(requests.every(url => url.startsWith('http://127.0.0.1:4318/')), 'External request');
      const initial = await page.evaluate(() => window.TerminalCore.inspect());
      await delay(350);
      const settled = await page.evaluate(() => window.TerminalCore.inspect());
      assert.equal(initial.frames, settled.frames, 'Idle scene still renders');
      await page.evaluate(({ dark, quality }) => window.TerminalCore.setState({ status: 'fault', quality, dark, active: true, reducedMotion: false }), sample);
      await delay(130);
      const changing = await page.screenshot({ omitBackground: true });
      const during = await page.evaluate(() => window.TerminalCore.inspect());
      await delay(1000);
      const faultScreenshot = await page.screenshot({ omitBackground: true, path: path.join(output, sample.name + '-fault.png') });
      assert(!changing.equals(faultScreenshot), 'Animation did not change pixels');
      const final = await page.evaluate(() => window.TerminalCore.inspect());
      assert(final.frames > initial.frames, 'No transition frames');
      assert.equal(final.animating, false, 'Animation did not stop');
      await page.evaluate(({ dark, quality }) => window.TerminalCore.setState({ status: 'pending', quality, dark, active: false, reducedMotion: false }), sample);
      const paused = await page.evaluate(() => window.TerminalCore.inspect());
      await delay(300);
      assert.equal((await page.evaluate(() => window.TerminalCore.inspect())).frames, paused.frames, 'Inactive scene renders');
      await page.evaluate(({ dark, quality }) => window.TerminalCore.setState({ status: 'running', quality, dark, active: true, reducedMotion: true }), sample);
      const reduced = await page.evaluate(() => window.TerminalCore.inspect());
      assert.equal(reduced.animating, false, 'Reduced motion animates');
      const baselineRequests = requests.length;
      await page.context().setOffline(true);
      await page.evaluate(({ dark, quality }) => window.TerminalCore.setState({ status: 'loading', quality, dark, active: true, reducedMotion: true }), sample);
      assert.equal(await page.evaluate(() => window.__terminalRenderState), 'ready');
      assert.equal(requests.length, baselineRequests, 'State transition attempted network');
      results.push({ ...sample, dom, pixels: measured, initial, during, final, reduced, requests, errors, checks: ['viewport-css-size', 'nonblank', 'framed', 'state-color', 'moving-pixels', 'idle-stopped', 'inactive-stopped', 'reduced-motion', 'offline-state-change', 'local-resources-only'] });
      await page.close();
    }
    const failurePage = await browser.newPage();
    await failurePage.goto('http://127.0.0.1:4318/?reducedMotion=true');
    await failurePage.waitForFunction(() => window.__terminalRenderState === 'ready');
    await failurePage.evaluate(() => document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
    await failurePage.waitForFunction(() => window.__terminalRenderState === 'fault');
    results.push({ contextLoss: 'fault exposed; Android wrapper falls back after fixed-status health check' });
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ observedAt: new Date().toISOString(), browser: await browser.version(), results }, null, 2));
    console.log(JSON.stringify({ passed: true, cases: results.length, output }, null, 2));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.kill());

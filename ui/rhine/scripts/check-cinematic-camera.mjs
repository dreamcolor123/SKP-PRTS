import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.SKP_PLAYWRIGHT_PATH || 'playwright');
const { PNG } = require(process.env.SKP_PNGJS_PATH || 'pngjs');
const { build } = require('esbuild');
const out = resolve(process.env.SKP_CINEMATIC_OUTPUT || '.tools/cinematic-camera');
await mkdir(out, { recursive: true });
const module = { exports: {} };
const compiled = (await build({ stdin: { contents: 'export * from "./src/cinematic-camera";', resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'cjs', platform: 'node', write: false })).outputFiles[0].text;
new Function('module', 'exports', compiled)(module, module.exports);
const { cinematicCameraPose, CINEMATIC_CAMERA_KNOTS } = module.exports;
const report = { passed: false, intentionalCameraRedesign: true, originalCameraEquivalence: false, knots: [], viewports: [], errors: [] };
const eps = 1e-5;
for (const time of CINEMATIC_CAMERA_KNOTS) {
  const before = cinematicCameraPose(time - eps), at = cinematicCameraPose(time), after = cinematicCameraPose(time + eps);
  const fields = Object.keys(at).map(name => {
    const left = (at[name] - before[name]) / eps, right = (after[name] - at[name]) / eps;
    assert.ok([before[name], at[name], after[name], left, right].every(Number.isFinite), `${time} ${name} finite`);
    const continuity = Math.abs(after[name] - before[name]), velocityDifference = Math.abs(right - left);
    assert.ok(continuity < .02, `${time} ${name} C0: ${continuity}`);
    assert.ok(velocityDifference < .05, `${time} ${name} C1: ${velocityDifference}`);
    return { name, value: at[name], leftVelocity: left, rightVelocity: right, continuity, velocityDifference };
  });
  report.knots.push({ time, fields });
}
const vectorDelta = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));
const manifest = JSON.parse(await readFile('dist/asset-manifest.json', 'utf8'));
report.bundle = manifest.files.filter(file => file.path.endsWith('.js')).map(file => ({ path: file.path, sha256: file.sha256 }));
const files = new Map(manifest.files.map(file => ['/' + file.path, file]));
const server = createServer(async (request, response) => {
  const path = request.url.split('?')[0], file = files.get(path === '/' ? '/index.html' : path);
  if (!file) { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'Content-Type': file.mime }); response.end(await readFile('dist/' + file.path));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
let page;
try {
  for (const viewport of [{ width: 412, height: 892 }, { width: 1280, height: 720 }]) {
    const context = await browser.newContext({ viewport, recordVideo: { dir: out, size: viewport } });
    await context.addInitScript(() => localStorage.setItem('rhine-settings', JSON.stringify({ sound: false, music: false, superPerformance: true })));
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(origin);
    await page.waitForFunction(() => window.rhine);
    await page.evaluate(() => {
      const channel = new MessageChannel(); window.hostPort = channel.port1;
      channel.port1.onmessage = event => { if (JSON.parse(event.data).type === 'ready') channel.port1.postMessage(JSON.stringify({ type: 'presentation', active: true, bootAllowed: true, reducedMotion: false, initialBootTime: 21.9 })); };
      window.postMessage(JSON.stringify({ type: 'skp:init', version: 1, sessionId: 'cinematic-camera' }), location.origin, [channel.port2]);
    });
    await page.waitForFunction(() => window.rhine.stats().ready && window.rhine.stats().startup === 'started', undefined, { timeout: 60000 });
    const stats = await page.evaluate(() => window.rhine.stats());
    assert.equal(stats.loaded, true, 'Actual WebGL model must load; a fallback is not a passing shot');
    const trajectory = await page.evaluate(async () => {
      const samples = [];
      const count = Math.round((35 - 21.9) * 60);
      for (let frame = 0; frame <= count; frame++) {
        const time = frame === count ? 35 : 21.9 + frame / 60;
        window.rhine.seek(time);
        await new Promise(requestAnimationFrame);
        const stats = window.rhine.stats();
        const stage = document.querySelector('#stage'), host = document.querySelector('#three-scene');
        samples.push({ time, frame: stage.dataset.bootFrame, aspect: host.clientWidth / host.clientHeight, openingLayout: stage.dataset.layout === 'opening', position: stats.cameraPosition, aim: stats.cameraAim, fov: stats.fieldOfView, distance: stats.cameraDistance, topLeft: stats.topLeft, topRight: stats.topRight, labelTopLeft: stats.labelTopLeft, mode: stats.mode, loaded: stats.loaded, triangles: stats.triangles });
      }
      return samples;
    });
    const deltas = trajectory.slice(1).map((sample, index) => {
      const previous = trajectory[index];
      for (const value of [...sample.position, ...sample.aim, sample.fov, sample.distance, ...sample.topLeft, ...sample.topRight]) assert.ok(Number.isFinite(value), `${viewport.width} ${sample.time} finite pose`);
      return { time: sample.time, position: vectorDelta(sample.position, previous.position), aim: vectorDelta(sample.aim, previous.aim), fov: Math.abs(sample.fov - previous.fov), screen: vectorDelta(sample.topLeft, previous.topLeft) };
    });
    const interior = deltas.filter(sample => sample.time > 22.02 && sample.time < 34.9);
    let zeroRun = 0, maxZeroRun = 0;
    for (const sample of interior) { zeroRun = sample.position < .00005 && sample.aim < .00005 && sample.fov < .000001 ? zeroRun + 1 : 0; maxZeroRun = Math.max(maxZeroRun, zeroRun); }
    const boundaries = [25.05, 27.3].map(time => ({ time, deltas: deltas.filter(sample => Math.abs(sample.time - time) < .06) }));
    const fovErrors = trajectory.filter(sample => sample.time < 35).map(sample => {
      const pose = cinematicCameraPose(sample.time);
      const responsiveScale = sample.openingLayout ? Math.min(1, sample.aspect / (16 / 9)) : 1;
      const expected = 2 * Math.atan(pose.span / responsiveScale / (2 * pose.distance)) * 180 / Math.PI;
      return Math.abs(expected - sample.fov);
    });
    const summary = { viewport, samples: trajectory.length, maxPositionStep: Math.max(...interior.map(sample => sample.position)), maxAimStep: Math.max(...interior.map(sample => sample.aim)), maxFovStep: Math.max(...interior.map(sample => sample.fov)), maxExpectedFovError: Math.max(...fovErrors), maxZeroRun, boundaries };
    report.viewports.push({ ...summary, trajectory, deltas, captures: [] });
    assert.equal(maxZeroRun, 0, `${viewport.width} must not stop between shots`);
    assert.ok(summary.maxPositionStep < 2.5 && summary.maxAimStep < .7, JSON.stringify(summary));
    assert.ok(summary.maxExpectedFovError < 1e-8, 'Rendered FOV must follow the continuous trajectory, including responsive span');
    for (const boundary of boundaries) {
      const near = boundary.deltas;
      assert.ok(near.every(sample => sample.position < 1.5 && sample.aim < .3), `${viewport.width} ${boundary.time} shot reset: ${JSON.stringify(near)}`);
      assert.ok(Math.max(...near.map(sample => sample.fov)) < 2 * Math.min(...near.map(sample => sample.fov)), `${viewport.width} ${boundary.time} FOV speed discontinuity`);
      assert.ok(Math.max(...near.map(sample => sample.screen)) < 35, `${viewport.width} ${boundary.time} screen jump`);
    }
    for (const time of [22.1, 24.2, 25.05, 26.5, 27.3, 30, 34.8]) {
      await page.evaluate(time => window.rhine.seek(time), time);
      await page.waitForFunction(frame => Number(document.querySelector('#stage').dataset.bootFrame) === frame, Math.floor((time + 5) * 25 + .00001));
      await page.waitForTimeout(650);
      const path = resolve(out, `${viewport.width}-${time.toFixed(2)}.png`);
      const image = PNG.sync.read(await page.screenshot({ path }));
      const colors = new Set();
      for (let index = 0; index < image.data.length; index += 16) colors.add(`${image.data[index] >> 3},${image.data[index + 1] >> 3},${image.data[index + 2] >> 3}`);
      assert.ok(colors.size > 20, `Rendered shot must not be blank: ${viewport.width} ${time}`);
      report.viewports.at(-1).captures.push({ time, path, colors: colors.size });
    }
    const handoff = await page.evaluate(async () => {
      window.rhine.seek(34.8); await new Promise(requestAnimationFrame); window.rhine.resume();
      const samples = [], started = performance.now();
      while (performance.now() - started < 2200) {
        await new Promise(requestAnimationFrame);
        const stats = window.rhine.stats(), stage = document.querySelector('#stage'), rect = stage.getBoundingClientRect();
        samples.push({ time: performance.now() - started, mode: stats.mode, position: stats.cameraPosition, aim: stats.cameraAim, fov: stats.fieldOfView,
          screen: [stats.topLeft[0] * rect.width / stage.offsetWidth + rect.left, stats.topLeft[1] * rect.width / stage.offsetWidth + rect.top] });
      }
      return samples;
    });
    const crossing = handoff.findIndex((sample, index) => index > 0 && sample.mode !== handoff[index - 1].mode);
    assert.ok(crossing > 0 && handoff.at(-1).mode !== 'boot', 'Actual running clock must hand off from the opening');
    const beforeHandoff = handoff[crossing - 1], afterHandoff = handoff[crossing];
    const transition = { position: vectorDelta(beforeHandoff.position, afterHandoff.position), aim: vectorDelta(beforeHandoff.aim, afterHandoff.aim), fov: Math.abs(beforeHandoff.fov - afterHandoff.fov), screen: vectorDelta(beforeHandoff.screen, afterHandoff.screen), elapsedMs: afterHandoff.time - beforeHandoff.time };
    assert.ok(transition.position < 2.5 && transition.aim < 2 && transition.fov < 5, `Handoff must ease rather than reset the camera: ${JSON.stringify(transition)}`);
    report.viewports.at(-1).handoff = { samples: handoff, transition };
    const video = page.video();
    await page.close();
    await video.saveAs(resolve(out, `${viewport.width}-cinematic-camera.webm`)); await video.delete();
    await context.close(); page = undefined;
  }
  assert.deepEqual(report.errors, []);
  report.passed = true;
  console.log(JSON.stringify({ passed: true, sourceKnots: report.knots.length, viewports: report.viewports.map(({ trajectory, deltas, captures, handoff, ...summary }) => ({ ...summary, handoff: handoff.transition })), output: out }));
} catch (error) {
  report.error = error.stack;
  if (page) await page.screenshot({ path: resolve(out, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  await writeFile(resolve(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close(); await new Promise(resolve => server.close(resolve));
}

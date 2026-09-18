import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.SKP_PLAYWRIGHT_PATH || 'playwright');
const { PNG } = require(process.env.SKP_PNGJS_PATH || 'pngjs');
const { build } = require('esbuild');
const out = resolve(process.env.SKP_THEME_DEFAULTS_OUTPUT || '.tools/theme-defaults');
await mkdir(out, { recursive: true });
const manifest = JSON.parse(await readFile('dist/asset-manifest.json', 'utf8'));
const files = new Map(manifest.files.map(file => ['/' + file.path, file]));
const server = createServer(async (request, response) => {
  const path = request.url.split('?')[0], file = files.get(path === '/' ? '/index.html' : path);
  if (!file) { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'Content-Type': file.mime }); response.end(await readFile('dist/' + file.path));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const report = { passed: false, bundles: manifest.files.filter(file => file.path.endsWith('.js')).map(file => ({ path: file.path, sha256: file.sha256 })), cases: [], errors: [], materials: {} };
const expectedAccents = { Amber_Optical_Inlay: '#d0bbed', Champagne_Index: '#c5b0df', Index_Inlay: '#cdb6ed', Orange: '#cdb6ed' };
function pixels(buffer) {
  const image = PNG.sync.read(buffer), colors = new Set(); let purplePixels = 0, opaquePixels = 0;
  for (let i = 0; i < image.data.length; i += 4) {
    if (!image.data[i + 3]) continue;
    opaquePixels++;
    const [r, g, b] = image.data.subarray(i, i + 3);
    colors.add((r >> 3) * 1024 + (g >> 3) * 32 + (b >> 3));
    if (b > r + 8 && b > g + 12) purplePixels++;
  }
  assert.ok(colors.size > 20 && opaquePixels > 10000, `Canvas must not be blank: ${colors.size} colors`);
  return { width: image.width, height: image.height, colors: colors.size, opaquePixels, purplePixels };
}
try {
  const source = await readFile('src/scene.ts', 'utf8');
  const syntax = ts.createSourceFile('scene.ts', source, ts.ScriptTarget.Latest, true);
  let initializer;
  const visit = node => { if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'accent') initializer = node.initializer.getText(syntax); ts.forEachChild(node, visit); };
  visit(syntax);
  assert.ok(initializer, 'Inspect the actual source material mapping');
  const mapped = new Function('name', `return (${initializer});`);
  report.materials.sourceSelected = Object.fromEntries(Object.keys(expectedAccents).map(name => [name, mapped(name)]));
  assert.deepEqual(report.materials.sourceSelected, expectedAccents);
  report.materials.gltf = [];
  for (const path of ['assets/archive-cassette.glb', 'assets/archive-assembly.glb']) {
    const buffer = await readFile(`dist/${path}`);
    assert.equal(buffer.toString('ascii', 0, 4), 'glTF');
    assert.equal(buffer.readUInt32LE(16), 0x4e4f534a);
    const data = JSON.parse(buffer.toString('utf8', 20, 20 + buffer.readUInt32LE(12)));
    report.materials.gltf.push({ path, accentNames: data.materials.map(material => material.name).filter(name => Object.keys(expectedAccents).some(accent => name.startsWith(accent))) });
  }
  assert.ok(report.materials.gltf.every(model => model.accentNames.length >= 2), 'Both actual model assets must contain the targeted accent materials');
  const materialBundle = (await build({ stdin: { contents: 'export {themeMaterial} from "./src/theme-material"; export {MeshPhysicalMaterial} from "three";', resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'iife', globalName: 'MaterialTest', platform: 'browser', write: false })).outputFiles[0].text;
  const probe = await browser.newPage();
  await probe.addScriptTag({ content: materialBundle });
  report.materials.darkShader = await probe.evaluate(names => Object.fromEntries(names.map(name => {
    const material = new MaterialTest.MeshPhysicalMaterial();
    MaterialTest.themeMaterial(material, name);
    const shader = { uniforms: {}, vertexShader: '#include <begin_vertex>', fragmentShader: '#include <roughnessmap_fragment>' };
    material.onBeforeCompile(shader, null);
    return [name, '#' + shader.uniforms.rhineDarkSurface.value.getHexString()];
  })), Object.keys(expectedAccents));
  assert.deepEqual(report.materials.darkShader, expectedAccents);
  await probe.close();
  for (const [name, stored, dark, superPerformance] of [['fresh', null, true, true], ['saved-light', { colorTheme: 'light', superPerformance: false, sound: false, music: false }, false, false]]) {
    const context = await browser.newContext({ viewport: { width: 412, height: 892 }, hasTouch: true });
    if (stored) await context.addInitScript(stored => localStorage.setItem('rhine-settings', JSON.stringify(stored)), stored);
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push({ case: name, message: error.message }));
    await page.goto(origin);
    await page.waitForFunction(() => window.rhine);
    await page.evaluate(() => {
      const channel = new MessageChannel(); window.hostPort = channel.port1;
      channel.port1.onmessage = event => { if (JSON.parse(event.data).type === 'ready') channel.port1.postMessage(JSON.stringify({ type: 'presentation', active: true, bootAllowed: true, reducedMotion: false, initialBootCompleted: true })); };
      window.postMessage(JSON.stringify({ type: 'skp:init', version: 1, sessionId: 'theme-default-test' }), location.origin, [channel.port2]);
    });
    await page.waitForFunction(() => window.rhine.stats().ready && window.rhine.stats().startup === 'started' && window.rhine.stats().cameraDetail > .99, undefined, { timeout: 60000 });
    await page.waitForTimeout(900);
    const state = await page.evaluate(() => ({ stats: window.rhine.stats(), dark: document.documentElement.dataset.darkSurface, saved: JSON.parse(localStorage.getItem('rhine-settings')) }));
    assert.equal(state.dark, String(dark));
    assert.equal(state.stats.superPerformance, superPerformance);
    assert.equal(state.saved.colorTheme, dark ? 'dark' : 'light');
    assert.equal(state.saved.superPerformance, superPerformance);
    assert.equal(state.stats.loaded, true, 'Do not accept the flat/native fallback');
    assert.ok(state.stats.viewport.canvasWidth > 0 && state.stats.triangles > 0, 'The actual WebGL scene must have rendered model triangles');
    const captures = [];
    for (const viewport of [{ width: 412, height: 892 }, { width: 1280, height: 720 }]) {
      await page.setViewportSize(viewport); await page.waitForTimeout(700);
      const path = resolve(out, `${name}-${viewport.width}.png`);
      pixels(await page.screenshot({ path }));
      const style = await page.addStyleTag({ content: '#stage > :not(#three-scene),#viewport > :not(#stage),.folder-face-panel {visibility:hidden!important;}' });
      const canvasPixels = pixels(await page.locator('#three-scene canvas').screenshot({ path: resolve(out, `${name}-${viewport.width}-canvas.png`) }));
      await style.evaluate(element => element.remove());
      captures.push({ viewport, path, canvasPixels });
    }
    await page.setViewportSize({ width: 412, height: 892 });
    await page.locator('.system-nav [data-action=settings]').click();
    assert.equal(await page.locator('[data-pref=superPerformance]').isChecked(), superPerformance);
    assert.equal(await page.locator(`[data-color-theme=${dark ? 'dark' : 'light'}]`).getAttribute('aria-pressed'), 'true');
    await page.screenshot({ path: resolve(out, `${name}-settings.png`) });
    let viewer;
    if (name === 'fresh') {
      await page.locator('[data-action=lab-model]').click();
      await page.waitForSelector('.model-viewer:not([hidden])');
      await page.waitForFunction(() => document.querySelector('.model-viewer .viewer-loading')?.hidden === true, undefined, { timeout: 60000 });
      await page.waitForTimeout(900);
      const path = resolve(out, 'fresh-viewer.png');
      const image = pixels(await page.screenshot({ path }));
      assert.ok(image.purplePixels > 100, 'Model viewer must show the pale purple accents');
      viewer = { path, image, loadingHidden: true };
    }
    report.cases.push({ name, dark, superPerformance, state, captures, settingsChecked: superPerformance, viewer });
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.passed = true;
  console.log(JSON.stringify({ passed: true, defaults: 'dark + SUPER PERFORMANCE', explicitPreferencesRetained: true, modelSourceAndShaderMapping: true, cases: report.cases.length, output: out }));
} catch (error) { report.error = error.stack; throw error; }
finally {
  await writeFile(resolve(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close(); await new Promise(resolve => server.close(resolve));
}

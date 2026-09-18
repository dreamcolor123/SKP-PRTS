import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.SKP_PLAYWRIGHT_PATH || 'playwright');
const { PNG } = require(process.env.SKP_PNGJS_PATH || 'pngjs');
const { build } = require('esbuild');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const referencePath = resolve(process.env.SKP_LOGO_REFERENCE || process.argv[2] || resolve(root, 'branding-reference/skroot-pro-preview.html'));
const out = resolve(process.env.SKP_LOGO_OUTPUT || '.tools/user-logo');
const referenceHtml = await readFile(referencePath, 'utf8');
const times = [0, .2, .5, .8, 1, 1.3, 2, 3, 5.5];
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
const report = { referencePath, referenceSha256: createHash('sha256').update(referenceHtml).digest('hex'), times, reference: [], pageErrors: errors };
const referenceFrames = [];

// Run the supplied script unchanged, with only its browser clock controlled.
async function createReference() {
  const page = await browser.newPage({ viewport: { width: 900, height: 720 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    let serial = 0;
    const callbacks = new Map();
    window.requestAnimationFrame = callback => { callbacks.set(++serial, callback); return serial; };
    window.cancelAnimationFrame = id => callbacks.delete(id);
    window.logoReferenceFrame = now => {
      const frame = [...callbacks.values()];
      callbacks.clear();
      for (const callback of frame) callback(now);
    };
  });
  await page.goto('about:blank');
  await page.setContent(referenceHtml);
  await page.evaluate(() => window.logoReferenceFrame(0));
  return page;
}

function assertImageNotBlank(buffer, label) {
  const image = PNG.sync.read(buffer);
  let purple = 0;
  for (let i = 0; i < image.data.length; i += 4) {
    const [r, g, b, a] = image.data.subarray(i, i + 4);
    if (a > 0 && b > r + 20 && b > g + 40) purple++;
  }
  assert.ok(purple > 100, `${label} must contain the actual purple mark`);
  return { width: image.width, height: image.height, purplePixels: purple };
}

function comparePixels(reference, candidate) {
  const a = PNG.sync.read(reference), b = PNG.sync.read(candidate);
  assert.equal(a.width, b.width);
  assert.equal(a.height, b.height);
  let different = 0, maxDifference = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    const difference = Math.max(...[0, 1, 2, 3].map(offset => Math.abs(a.data[i + offset] - b.data[i + offset])));
    if (difference > 0) different++;
    maxDifference = Math.max(maxDifference, difference);
  }
  return { width: a.width, height: a.height, differentPixels: different, maxDifference };
}

function close(actual, expected, label) {
  assert.ok(Math.abs(actual - expected) < 1e-10, `${label}: ${actual} != ${expected}`);
}

async function captureLogo(page, identity, path) {
  await page.evaluate(identity => {
    for (const element of document.querySelectorAll('section')) element.hidden = element.id !== identity;
  }, identity);
  return page.locator(`#${identity}`).screenshot(path ? { path } : {});
}

async function verifyCandidate() {
  const bundle = (await build({
    stdin: { contents: 'export * from "./src/user-logo";', resolveDir: root, loader: 'ts' },
    bundle: true, format: 'iife', globalName: 'UserLogoTest', platform: 'browser', write: false,
  })).outputFiles[0].text;
  const page = await browser.newPage({ viewport: { width: 1440, height: 768 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<style>body{margin:0;background:#f1f0f0}section{width:720px;height:384px;float:left}section>svg{display:block;width:720px;height:384px;overflow:visible}</style><section id="reference"></section><section id="candidate"></section><div id="instances"></div>');
  await page.addScriptTag({ content: bundle });
  await page.evaluate(() => {
    document.querySelector('#candidate').innerHTML = UserLogoTest.logoSvg('candidate');
    window.candidateLogo = new UserLogoTest.UserLogo(document.querySelector('#candidate svg'));
  });
  const candidateGeometry = await page.evaluate(() => ({ paths: UserLogoTest.brandParts, gradient: UserLogoTest.brandGradient }));
  assert.deepEqual(candidateGeometry.paths, report.geometry.paths);
  assert.deepEqual(candidateGeometry.gradient, { start: report.geometry.gradient[0].color, end: report.geometry.gradient[1].color });
  report.candidate = [];
  for (const frame of referenceFrames) {
    const motion = await page.evaluate(({ time, svg }) => {
      document.querySelector('#reference').innerHTML = svg;
      window.candidateLogo.update(time);
      const root = document.querySelector('#candidate svg');
      return {
        math: UserLogoTest.logoMotion(time),
        sOpacity: Number(root.querySelector('[data-logo-part=s]').getAttribute('opacity')),
        sTransform: root.querySelector('[data-logo-part=s]').getAttribute('transform'),
        stemOpacity: Number(root.querySelector('[data-logo-part=stem]').getAttribute('opacity')),
        stemTransform: root.querySelector('[data-logo-part=stem]').getAttribute('transform'),
        bridgeWidth: Number(root.querySelector('[data-logo-bridge]').getAttribute('width')),
        legOpacity: Number(root.querySelector('[data-logo-part=leg]').getAttribute('opacity')),
        legTransform: root.querySelector('[data-logo-part=leg]').getAttribute('transform'),
        sheenX: Number(root.querySelector('[data-logo-highlight]').getAttribute('x')),
      };
    }, frame);
    for (const key of ['sOpacity', 'stemOpacity', 'bridgeWidth', 'legOpacity', 'sheenX']) close(motion[key], frame.sample[key], `${frame.time}s ${key}`);
    for (const key of ['sTransform', 'stemTransform', 'legTransform']) {
      const actual = motion[key].match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g).map(Number);
      const expected = frame.sample[key].match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g).map(Number);
      actual.forEach((value, index) => close(value, expected[index], `${frame.time}s ${key}[${index}]`));
    }
    const a = await captureLogo(page, 'reference', resolve(out, `reference-normalized-${frame.time.toFixed(1)}.png`));
    const b = await captureLogo(page, 'candidate', resolve(out, `candidate-${frame.time.toFixed(1)}.png`));
    const pixels = comparePixels(a, b);
    assert.equal(pixels.differentPixels, 0, `Actual SVG raster must match reference at ${frame.time}s`);
    report.candidate.push({ time: frame.time, motion, pixels });
  }
  report.candidatePixels = assertImageNotBlank(await captureLogo(page, 'candidate'), 'Candidate');
  report.instances = await page.evaluate(() => {
    const host = document.querySelector('#instances');
    host.innerHTML = Array.from({ length: 12 }, (_, index) => UserLogoTest.logoSvg(`instance-${index}`, index % 2 === 0)).join('');
    const roots = [...host.querySelectorAll('svg')];
    const ids = [...document.querySelectorAll('[id]')].map(element => element.id);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    const invalidReferences = roots.flatMap(root => [...root.querySelectorAll('*')].flatMap(element => [...element.attributes].flatMap(attribute => {
      const id = attribute.name === 'href' && attribute.value.startsWith('#') ? attribute.value.slice(1) : attribute.value.match(/^url\(#(.+)\)$/)?.[1];
      return id && !root.querySelector(`[id="${id}"]`) ? [id] : [];
    })));
    return { count: roots.length, duplicates, invalidReferences };
  });
  assert.deepEqual(report.instances, { count: 12, duplicates: [], invalidReferences: [] });
  await page.evaluate(() => { document.querySelector('#instances').replaceChildren(); window.candidateLogo.update(0, true); });
  const reduced0 = await captureLogo(page, 'candidate');
  await page.evaluate(() => window.candidateLogo.update(1234, true));
  const reducedLater = await captureLogo(page, 'candidate', resolve(out, 'candidate-reduced-motion.png'));
  assert.equal(comparePixels(reduced0, reducedLater).differentPixels, 0, 'Reduced motion must remain fully assembled without highlight animation');
  await page.evaluate(svg => { document.querySelector('#reference').innerHTML = svg; }, referenceFrames.find(frame => frame.time === 1.3).svg);
  report.reducedMotion = comparePixels(await captureLogo(page, 'reference'), reducedLater);
  assert.equal(report.reducedMotion.differentPixels, 0);
  await page.evaluate(() => { document.querySelector('#candidate').innerHTML = UserLogoTest.logoSvg('static', false); });
  report.static = comparePixels(await captureLogo(page, 'reference'), await captureLogo(page, 'candidate'));
  assert.equal(report.static.differentPixels, 0);
  report.imageDecodes = await page.evaluate(async () => {
    const results = [];
    for (const [name, animated, compact] of [['animated', true, false], ['static', false, false], ['model-label', false, true]]) {
      const source = UserLogoTest.logoSvg(`image-${name}`, animated, compact);
      const xml = new DOMParser().parseFromString(source, 'image/svg+xml');
      if (xml.querySelector('parsererror')) throw new Error(`Invalid SVG XML: ${name}`);
      const image = new Image();
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 720; canvas.height = 384;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let purplePixels = 0;
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3] && pixels[i + 2] > pixels[i] + 20 && pixels[i + 2] > pixels[i + 1] + 40) purplePixels++;
      results.push({ name, width: image.naturalWidth, height: image.naturalHeight, purplePixels });
    }
    return results;
  });
  for (const decoded of report.imageDecodes) assert.ok(decoded.width > 0 && decoded.height > 0 && decoded.purplePixels > 100, JSON.stringify(decoded));
  await page.close();
}

try {
  const reference = await createReference();
  report.referenceSvg = await reference.locator('#preview-logo').evaluate(svg => svg.outerHTML);
  report.geometry = await reference.locator('#preview-logo').evaluate(svg => ({
    viewBox: svg.getAttribute('viewBox'),
    transform: svg.querySelector('#animated-mark').getAttribute('transform'),
    paths: Object.fromEntries(['s', 'stem', 'bridge', 'leg'].map(id => [id, svg.querySelector(`#${id}`).getAttribute('d')])),
    gradient: [...svg.querySelectorAll('#ink stop')].map(stop => ({ color: stop.getAttribute('stop-color'), offset: stop.getAttribute('offset') || '0' })),
  }));
  await writeFile(resolve(out, 'reference-logo.svg'), report.referenceSvg);
  for (const time of times) {
    await reference.evaluate(t => window.logoReferenceFrame(t * 1000), time);
    const sample = await reference.locator('#preview-logo').evaluate(svg => ({
      sOpacity: Number(svg.querySelector('#s-entry').getAttribute('opacity')),
      sTransform: svg.querySelector('#s-entry').getAttribute('transform'),
      stemOpacity: Number(svg.querySelector('#stem-entry').getAttribute('opacity')),
      stemTransform: svg.querySelector('#stem-entry').getAttribute('transform'),
      bridgeWidth: Number(svg.querySelector('#bridge-reveal rect').getAttribute('width')),
      legOpacity: Number(svg.querySelector('#leg-entry').getAttribute('opacity')),
      legTransform: svg.querySelector('#leg-entry').getAttribute('transform'),
      sheenX: Number(svg.querySelector('#loop-highlight rect').getAttribute('x')),
    }));
    report.reference.push({ time, ...sample });
    referenceFrames.push({ time, sample, svg: await reference.locator('#preview-logo').evaluate(svg => svg.outerHTML) });
    await reference.locator('#preview-logo').screenshot({ path: resolve(out, `reference-${time.toFixed(1)}.png`) });
  }
  await reference.screenshot({ path: resolve(out, 'reference-preview.png') });
  report.referencePixels = assertImageNotBlank(await reference.locator('#preview-logo').screenshot(), 'Reference');
  if (process.env.SKP_LOGO_REFERENCE_ONLY !== '1') await verifyCandidate();
  assert.deepEqual(errors, []);
  report.passed = true;
  await writeFile(resolve(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: true, referenceFrames: report.reference.length, candidateFrames: report.candidate?.length || 0, output: out }));
} finally {
  await browser.close();
}

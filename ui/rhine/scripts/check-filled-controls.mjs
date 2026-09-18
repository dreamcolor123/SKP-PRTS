import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.SKP_PLAYWRIGHT_PATH || 'playwright');
const { build } = require('esbuild');
const out = resolve(process.env.SKP_CONTROL_COLOR_OUTPUT || '.tools/filled-controls');
await mkdir(out, { recursive: true });
const css = (await Promise.all(['skp.css', 'folder-face-panel.css', 'style.css', 'floating-navigation.css', 'theme.css'].map(path => readFile(`src/${path}`, 'utf8')))).join('\n').replace(/@import[^;]+;/g, '');
const script = (await build({
  stdin: { contents: 'export {paintTheme} from "./src/theme-ui"; export {FloatingNavigation} from "./src/floating-navigation";', resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, platform: 'browser', format: 'iife', globalName: 'ControlTest', write: false, loader: { '.css': 'empty' },
})).outputFiles[0].text;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = { passed: false, themes: [] };
const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
const contrast = (foreground, background) => { const a = luminance(foreground), b = luminance(background); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); };
const filled = ['.ff-action-primary:not(.ff-destructive)', '.solid-button', '.theme-choices [aria-pressed=true]', '.viewer-surface [aria-pressed=true]', '.category-filters .active', '.skp-lab-controls [aria-pressed=true]'];
try {
  const page = await browser.newPage({ viewport: { width: 412, height: 892 }, deviceScaleFactor: 1 });
  await page.setContent(`<style>${css}
    body { background:var(--theme-paper); color:var(--theme-ink); }
    main { padding:24px 20px 110px; }
    main h1 { font-size:22px; margin:0 0 20px; }
    main h2 { font-size:16px; }
    main .folder-face-panel { position:relative; inset:auto; width:100%; padding:16px; margin-bottom:18px; }
    main .ff-inline-actions { display:grid; grid-template-columns:1fr 1fr; }
    main .ff-action { width:100%; }
    main .theme-settings { margin:12px 0; padding:12px 0; }
    main .viewer-surface,main .category-filters { display:flex; gap:12px; margin:12px 0; }
    main .viewer-surface button,main .category-filters button { min-height:44px; padding:10px 14px; }
    main .solid-button { height:48px; width:100%; }
    main .skp-lab-controls { display:flex; position:static; margin:16px 0; justify-content:flex-start; }
    main .skp-actions { margin:14px 0; }
    </style><main><h1>SKRoot Pro</h1>
    <section class="folder-face-panel" data-plane="model-front"><h2>System Overview</h2><p class="body-copy">Normal operation / Local device</p><div class="ff-inline-actions"><button class="ff-action ff-action-primary">Test Root</button><button class="ff-action ff-action-primary ff-destructive">Remove</button></div><div class="ff-setting-row"><span>Boot protection</span><button class="ff-switch" aria-checked="true"><span></span></button></div></section>
    <div class="theme-settings"><strong>Appearance</strong><div class="theme-choices"><button aria-pressed="false">Light</button><button aria-pressed="true">Dark</button></div></div>
    <button class="solid-button">Install module<span>Open</span></button>
    <div class="viewer-surface"><button aria-pressed="true">Glass</button><button aria-pressed="false">Solid</button></div>
    <div class="category-filters"><button class="active">All archives</button><button>Modules</button></div>
    <div class="skp-lab-controls"><button aria-pressed="true">Wave</button><button aria-pressed="false">Spectrum</button></div>
    <div class="skp-actions"><button class="regular">Refresh</button><button class="destructive">Uninstall</button></div>
    <div class="settings-list"><label><input type="checkbox" checked><span class="toggle"></span></label></div>
    </main><nav class="workspace-navigation">${['home','authorization','modules','market','settings'].map((section,index)=>`<button data-section="${section}"><i>0${index+1}</i><span>${['Home','Auth','Modules','Market','Settings'][index]}</span></button>`).join('')}</nav>`);
  await page.addScriptTag({ content: script });
  await page.evaluate(() => { window.nav = new ControlTest.FloatingNavigation(document.querySelector('.workspace-navigation')); window.nav.select('home', true); });
  for (const dark of [false, true]) {
    await page.evaluate(dark => ControlTest.paintTheme(Number(dark)), dark);
    const colors = await page.evaluate(selectors => selectors.map(selector => { const style = getComputedStyle(document.querySelector(selector)); return { selector, foreground: style.color, background: style.backgroundColor }; }), filled);
    for (const value of colors) {
      value.contrast = contrast(value.foreground, value.background);
      assert.equal(value.background, 'rgb(216, 197, 242)', `${dark} ${value.selector} fill`);
      assert.equal(value.foreground, 'rgb(33, 24, 46)', `${dark} ${value.selector} ink`);
      assert.ok(value.contrast >= 4.5, JSON.stringify(value));
    }
    const surfaces = await page.evaluate(() => {
      const nav = getComputedStyle(document.querySelector('.workspace-navigation'));
      const plate = getComputedStyle(document.querySelector('.floating-navigation-plate'));
      const panel = getComputedStyle(document.querySelector('.folder-face-panel'));
      const selected = getComputedStyle(document.querySelector('.workspace-navigation [aria-current=true]'));
      const danger = getComputedStyle(document.querySelector('.ff-destructive'));
      const toggle = getComputedStyle(document.querySelector('.ff-switch'), '::before');
      return { navBackground: nav.backgroundColor, navBlur: nav.backdropFilter, plateBackground: plate.backgroundColor, selectedText: selected.color, panelBackground: panel.backgroundColor, panelBlur: panel.backdropFilter, bodyText: getComputedStyle(document.querySelector('.body-copy')).color, dangerBackground: danger.backgroundColor, dangerText: danger.color, toggleBackground: toggle.backgroundColor };
    });
    assert.equal(surfaces.plateBackground, 'rgb(216, 197, 242)');
    assert.equal(surfaces.selectedText, 'rgb(33, 24, 46)');
    assert.equal(surfaces.toggleBackground, 'rgb(216, 197, 242)');
    assert.ok(surfaces.navBackground.endsWith('0.63)') && surfaces.navBlur.includes('22px'));
    assert.ok(surfaces.panelBackground.endsWith('0.3)') && surfaces.panelBlur.includes('12px'));
    assert.equal(surfaces.bodyText, dark ? 'rgb(224, 227, 220)' : 'rgb(8, 10, 8)');
    assert.notEqual(surfaces.dangerBackground, surfaces.plateBackground);
    assert.ok(contrast(surfaces.dangerText, surfaces.dangerBackground) >= 4.5);
    await page.locator('.ff-action-primary:not(.ff-destructive)').hover();
    const hover = await page.locator('.ff-action-primary:not(.ff-destructive)').evaluate(element => ({ background: getComputedStyle(element).backgroundColor, foreground: getComputedStyle(element).color }));
    assert.equal(hover.background, 'rgb(229, 216, 247)');
    assert.ok(contrast(hover.foreground, hover.background) >= 4.5);
    await page.locator('.workspace-navigation [aria-current=true]').hover();
    assert.equal(await page.locator('.workspace-navigation [aria-current=true]').evaluate(element => getComputedStyle(element).color), 'rgb(33, 24, 46)');
    await page.locator('.skp-actions .destructive').hover();
    await page.waitForTimeout(220);
    const dangerHover = await page.locator('.skp-actions .destructive').evaluate(element => ({ foreground: getComputedStyle(element).color, background: getComputedStyle(element).backgroundColor }));
    assert.ok(contrast(dangerHover.foreground, dangerHover.background) >= 4.5);
    await page.mouse.move(0, 0);
    await page.waitForTimeout(220);
    await page.screenshot({ path: resolve(out, dark ? 'dark-controls.png' : 'light-controls.png') });
    report.themes.push({ dark, colors, surfaces, hover, dangerHover });
  }
  report.passed = true;
  console.log(JSON.stringify({ passed: true, themes: 2, filledControlsPerTheme: filled.length, minimumContrast: Math.min(...report.themes.flatMap(theme => theme.colors.map(value => value.contrast))), output: out }));
} catch (error) {
  report.error = error.stack;
  throw error;
} finally {
  await writeFile(resolve(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}

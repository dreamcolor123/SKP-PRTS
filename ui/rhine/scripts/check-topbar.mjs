import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.SKP_PLAYWRIGHT_PATH || 'playwright');
const source = await readFile('src/main.ts', 'utf8');
const navigation = source.match(/<nav class="system-nav"[\s\S]*?<\/nav>/)?.[0];
assert.ok(navigation, 'Use the actual topbar markup');
const css = (await Promise.all(['skp.css', 'style.css', 'responsive.css'].map(name => readFile(`src/${name}`, 'utf8')))).join('\n');
const out = process.env.SKP_TOPBAR_OUTPUT || '.tools/topbar';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = [];
try {
  const page = await browser.newPage();
  for (const viewport of [{ width: 360, height: 800 }, { width: 412, height: 892 }, { width: 892, height: 412 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(viewport);
    await page.setContent(`<style>${css}
      html,body,#viewport,#stage { width:100%;height:100%;margin:0; }
      #viewport,#stage { position:relative;inset:auto;transform:none; }
      #stage { --theme-line:#aaa;--theme-panel:#eee;--theme-ink:#151915; }
      .terminal-modal { width:calc(100% - 28px);height:calc(100% - 28px);box-sizing:border-box;padding:16px; }
      </style><div id="viewport" data-workspace="true" data-overlay="false"><main id="stage" data-workspace="true" data-mode="detail" data-layout="${viewport.width < 600 ? 'portrait' : 'compact'}">${navigation}<div id="modal-root"></div></main></div>`);
    const before = await page.locator('.system-tool').evaluateAll(buttons => buttons.map(button => {
      const glyph = button.firstElementChild.getBoundingClientRect();
      const bounds = button.getBoundingClientRect();
      return { action: button.dataset.action, width: bounds.width, height: bounds.height, glyphWidth: glyph.width, glyphHeight: glyph.height, label: button.getAttribute('aria-label'), title: button.title, text: button.textContent.trim() };
    }));
    assert.equal(before.length, 2);
    for (const button of before) {
      assert.equal(button.width, 48);
      assert.equal(button.height, 48);
      assert.equal(button.glyphWidth, 24);
      assert.equal(button.glyphHeight, 24);
      assert.equal(button.text, '');
      assert.equal(button.title, button.label);
      assert.ok(button.label);
    }
    await page.locator('[data-action=search]').hover();
    assert.equal(await page.locator('[data-action=search]').evaluate(button => getComputedStyle(button, '::after').visibility), 'visible');
    await page.screenshot({ path: `${out}/${viewport.width}-topbar.png` });
    await page.evaluate(() => {
      const nav = document.querySelector('.system-nav');
      nav.inert = true;
      document.querySelector('#viewport').dataset.overlay = 'true';
      document.querySelector('#modal-root').innerHTML = '<div class="modal-backdrop"><section class="terminal-modal" role="dialog"><div class="modal-top"><span>SKROOT PRO / ARCHIVE DIRECTORY</span><button data-action="close-modal" aria-label="Close">CLOSE <span></span></button></div></section></div>';
    });
    const overlay = await page.evaluate(() => {
      const nav = document.querySelector('.system-nav');
      const modal = document.querySelector('.modal-backdrop');
      const button = nav.querySelector('[data-action=search]');
      const rect = button.getBoundingClientRect();
      return { visibility: getComputedStyle(nav).visibility, pointerEvents: getComputedStyle(nav).pointerEvents,
        tooltip: getComputedStyle(button, '::after').visibility, inert: nav.inert,
        navDepth: Number(getComputedStyle(nav).zIndex), modalDepth: Number(getComputedStyle(modal).zIndex),
        topbarHit: Boolean(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)?.closest('.system-nav')) };
    });
    assert.equal(overlay.visibility, 'hidden');
    assert.equal(overlay.pointerEvents, 'none');
    assert.equal(overlay.tooltip, 'hidden');
    assert.equal(overlay.inert, true);
    assert.equal(overlay.topbarHit, false);
    assert.ok(overlay.modalDepth > overlay.navDepth);
    await page.screenshot({ path: `${out}/${viewport.width}-modal.png` });
    await page.evaluate(() => { document.querySelector('#modal-root').replaceChildren(); document.querySelector('#viewport').dataset.overlay = 'false'; document.querySelector('.system-nav').inert = false; });
    assert.equal(await page.locator('.system-nav').isVisible(), true);
    results.push({ viewport, buttons: before, overlay });
  }
  await writeFile(`${out}/report.json`, JSON.stringify({ passed: true, results }, null, 2));
  console.log(JSON.stringify({ passed: true, viewports: results.length, output: out }));
} finally {
  await browser.close();
}

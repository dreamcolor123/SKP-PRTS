import { createRequire } from "node:module";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.SKP_PLAYWRIGHT_PATH || "playwright");
const output = process.env.SKP_BROWSER_OUTPUT || ".tools/android-browser";
await mkdir(output, { recursive: true });
const manifest = JSON.parse(await readFile("dist/asset-manifest.json", "utf8"));
const files = new Map(manifest.files.map(file => [`/${file.path}`, file]));
const server = createServer(async (request, response) => {
  const path = new URL(request.url, "http://localhost").pathname;
  const file = files.get(path === "/" ? "/index.html" : path);
  if (!file) { response.writeHead(404).end(); return; }
  try { response.writeHead(200, { "Content-Type": file.mime }); response.end(await readFile(`dist/${file.path}`)); }
  catch { response.writeHead(500).end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const baseUrl = process.env.SKP_BROWSER_URL || `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--autoplay-policy=no-user-gesture-required", "--enable-unsafe-swiftshader"] });
const errors = [], requests = [], reports = [];
const record = (id, category, index) => ({ id, code:index+1,title:category,en:["AUTHORIZATION","INSTALLED MODULES","SYSTEM OVERVIEW","MODULE MARKET","SETTINGS & DIAGNOSTICS"][index],category,department:"SKRoot Pro",date:"4.6.2.1",lead:"LOCAL DEVICE",clearance:"NOT CONFIGURED",abstract:"设备状态由原生管理器提供。未配置 Root，暂无已授权应用。",findings:["Root：尚未配置","SKP-PRTS 4.6.2.1"],source:"",actions:[{action:"root.config.open",label:"配置 Root",payload:{},disabled:false}] });
const snapshot = { configured:false,statusText:"尚未配置",busy:false,records:["授权","已安装模块","系统概览","模块市场","设置与诊断"].map((category,index)=>record(index===2?"home.summary":`sample:${index}`,category,index)) };
try {
  const page = await browser.newPage({viewport:{width:412,height:892},deviceScaleFactor:1,hasTouch:true});
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => requests.push(request.url()));
  await page.goto(`${baseUrl}index.html`, {waitUntil:"networkidle"});
  await page.waitForFunction(() => !!window.rhine);
  await page.evaluate(snapshot => {
    const channel = new MessageChannel(); window.testPort = channel.port1; window.testActions = []; window.testPresentation = [];
    channel.port1.onmessage = event => {
      const message = JSON.parse(event.data);
      if(message.type === "ready") {
        channel.port1.postMessage(JSON.stringify({type:"state",version:1,revision:1,state:snapshot}));
        channel.port1.postMessage(JSON.stringify({type:"presentation",active:true,reducedMotion:false,bootAllowed:true,initialBootTime:0,initialBootCompleted:false}));
      } else if(message.requestId) window.testActions.push(message);
      else if(message.type === "presentation") window.testPresentation.push(message);
    };
    window.postMessage(JSON.stringify({type:"skp:init",version:1,sessionId:"browser-fixture"}),location.origin,[channel.port2]);
  }, snapshot);
  await page.waitForFunction(()=>window.rhine.stats().startup === "started",{timeout:30000});
  assert.equal(await page.evaluate(()=>window.rhine.stats().selected), "home.summary");
  await page.waitForTimeout(700);
  for (const time of [2,8,15.5,19,23,27,31,34]) {
    await page.evaluate(time=>window.rhine.seek(time),time);
    await page.waitForTimeout(100);
    await page.screenshot({path:`${output}/portrait-${String(time).replace(".","_")}.png`});
    reports.push({time,stats:await page.evaluate(()=>window.rhine.stats())});
  }
  await page.evaluate(()=>{window.rhine.seek(8);window.rhine.resume();});
  await page.waitForTimeout(200);
  await page.evaluate(()=>window.testPort.postMessage(JSON.stringify({type:"presentation",active:false})));
  await page.waitForTimeout(120);
  const pauseStart = await page.evaluate(()=>window.testPresentation.at(-1).bootTime);
  await page.waitForTimeout(400);
  await page.evaluate(()=>window.testPort.postMessage(JSON.stringify({type:"presentation",active:true})));
  await page.waitForTimeout(120);
  const pauseEnd = await page.evaluate(()=>window.rhine.stats().bootTime - 5);
  assert.ok(pauseEnd-pauseStart < .4,`paused time advanced: ${pauseEnd-pauseStart}`);
  await page.evaluate(()=>window.rhine.archive());
  await page.waitForTimeout(400);
  await page.locator('[data-action="open"]').first().click();
  await page.waitForTimeout(4500);
  await page.locator('[data-native-action="0"]').click();
  await page.locator('[data-native-action="0"]').click();
  assert.equal(await page.evaluate(()=>window.testActions.filter(action=>action.action==="root.config.open").length),1);
  await page.screenshot({path:`${output}/portrait-detail.png`});
  await page.evaluate(snapshot=>window.testPort.postMessage(JSON.stringify({type:"state",revision:2,state:{...snapshot,records:snapshot.records.slice().reverse()}})),snapshot);
  assert.equal(await page.evaluate(()=>window.rhine.stats().selected),"home.summary");
  await page.evaluate(()=>window.rhine.back());
  await page.locator('[data-action="settings"]').click();
  await page.waitForTimeout(350);
  await page.screenshot({path:`${output}/portrait-settings.png`});
  assert.equal(await page.locator('[data-pref="sound"]').isChecked(),true);
  assert.equal(await page.locator('[data-pref="music"]').isChecked(),true);
  await page.locator('[data-action="close-modal"]').click();
  await page.waitForTimeout(300);
  await page.evaluate(()=>window.rhine.visualLab());
  await page.waitForTimeout(500);
  await page.screenshot({path:`${output}/portrait-lab.png`});
  assert.ok(await page.locator('.skp-lab-controls').isVisible());
  await page.locator('[data-action="lab-model"]').last().click();
  await page.waitForTimeout(1000);
  await page.screenshot({path:`${output}/portrait-model.png`});
  await page.evaluate(()=>window.rhine.back());
  await page.setViewportSize({width:1280,height:720});
  await page.evaluate(()=>window.rhine.archive());
  await page.waitForTimeout(500);
  await page.screenshot({path:`${output}/landscape-array.png`});
  assert.ok(!requests.some(url=>!url.startsWith(baseUrl) && !url.startsWith("data:") && !url.startsWith("blob:")),"Unexpected external resource request");
  assert.deepEqual(errors,[]);
  await writeFile(`${output}/report.json`,JSON.stringify({passed:true,errors,requests,frames:reports,actions:await page.evaluate(()=>window.testActions)},null,2));
  console.log(`Android frontend browser QA passed: ${reports.length} MG frames; handshake, native action deduplication, stable selection, pause/resume, audio defaults, portrait/landscape, lab/model; ${output}`);
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }

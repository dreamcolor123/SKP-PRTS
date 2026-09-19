import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const require = createRequire(import.meta.url);
const {chromium} = require(process.env.SKP_PLAYWRIGHT_PATH || 'playwright');
const {PNG} = require(process.env.SKP_PNGJS_PATH || 'pngjs');
const out = resolve(process.env.SKP_NAV_OUTPUT || '.tools/opening-navigation');
await mkdir(out, {recursive:true});
const manifest = JSON.parse(await readFile('dist/asset-manifest.json', 'utf8'));
const files = new Map(manifest.files.map(file => ['/'+file.path,file]));
const server = createServer(async (request,response) => {
  const path = request.url.split('?')[0], file = files.get(path==='/'?'/index.html':path);
  if (!file) { response.writeHead(404).end(); return; }
  response.writeHead(200, {'Content-Type':file.mime}); response.end(await readFile('dist/'+file.path));
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const browser = await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
const report = {passed:false,cases:[],errors:[]};
try {
  for (const viewport of [{width:412,height:892},{width:1280,height:720}]) {
    const context = await browser.newContext({viewport});
    await context.addInitScript(() => localStorage.setItem('rhine-settings',JSON.stringify({sound:false,music:false,superPerformance:true})));
    const page = await context.newPage();
    page.on('pageerror',error=>report.errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(()=>window.rhine);
    await page.evaluate(()=>{
      const channel=new MessageChannel();window.hostPort=channel.port1;
      channel.port1.onmessage=event=>{if(JSON.parse(event.data).type==='ready')channel.port1.postMessage(JSON.stringify({type:'presentation',active:true,bootAllowed:true,reducedMotion:false,initialBootTime:34.6}));};
      window.postMessage(JSON.stringify({type:'skp:init',version:1,sessionId:'opening-navigation'}),location.origin,[channel.port2]);
    });
    await page.waitForFunction(()=>window.rhine.stats().ready&&window.rhine.stats().startup==='started',undefined,{timeout:60000});
    for (const entry of ['complete','skip','replay','modules-first','reduced']) {
      if (entry !== 'complete') {
        await page.evaluate(()=>document.querySelector('[data-action="replay"]').click());
        await page.waitForFunction(()=>window.rhine.stats().mode==='boot');
      }
      await page.evaluate(entry=>{
        window.rhine.seek(entry==='skip'?28:34.8);
        if(entry==='skip')document.querySelector('[data-action="skip"]').click();
        else window.rhine.resume();
        if(entry==='reduced')window.rhine.presentation({active:true,bootAllowed:true,reducedMotion:true});
      },entry);
      await page.waitForFunction(()=>window.rhine.stats().mode==='detail');
      await page.waitForTimeout(900);
      const initial=await page.evaluate(()=>window.rhine.stats());
      const sample={viewport,entry,initial:{lane:initial.selectedLane,cell:initial.selectedCell,track:initial.columnCamera},moves:[]};
      report.cases.push(sample);
      const sequence=entry==='modules-first'?['modules','authorization','home','modules']:['authorization','modules','home','authorization','modules'];
      for (const section of sequence) {
        const move=await page.evaluate(async section=>{
          const before=window.rhine.stats();document.querySelector(`.workspace-navigation [data-section="${section}"]`).click();
          const start=performance.now(),frames=[];
          while(performance.now()-start<1100){await new Promise(requestAnimationFrame);const s=window.rhine.stats();frames.push({track:s.columnCamera,cell:s.selectedCell,lane:s.selectedLane});}
          return {section,before:{cell:before.selectedCell,track:before.columnCamera},frames};
        },section);
        sample.moves.push(move);
      }
      const screenshot=resolve(out,`${viewport.width}-${entry}.png`);
      const png=PNG.sync.read(await page.screenshot({path:screenshot}));
      const colors=new Set();for(let i=0;i<png.data.length;i+=40)colors.add((png.data[i]>>4)|((png.data[i+1]>>4)<<4)|((png.data[i+2]>>4)<<8));
      sample.screenshot=screenshot;sample.colors=colors.size;
      assert.ok(colors.size>20,'Nonblank rendered scene');
      assert.equal(sample.initial.cell.lane,sample.initial.lane,`${entry}: opening physical cell must match the displayed section`);
      for (const move of sample.moves) {
        const last=move.frames.at(-1),delta=last.cell.lane-move.before.cell.lane;
        const expected={home:0,authorization:1,modules:2}[move.section];
        assert.equal(last.lane,expected);
        assert.equal(last.cell.lane,expected);
        assert.ok(delta===0||Math.sign(last.track-move.before.track)===Math.sign(delta),`${entry}: ${move.section} track direction`);
      }
    }
    await context.close();
  }
  assert.deepEqual(report.errors,[]);report.passed=true;
} catch(error) {report.error=error.stack;process.exitCode=1;}
finally {await browser.close();await new Promise(resolve=>server.close(resolve));await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({passed:report.passed,cases:report.cases.length,error:report.error,output:out}));

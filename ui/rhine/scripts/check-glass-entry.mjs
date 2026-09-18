import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.SKP_PLAYWRIGHT_PATH||'playwright');
const out=process.env.SKP_GLASS_OUTPUT||'.tools/glass-entry';await mkdir(out,{recursive:true});
const manifest=JSON.parse(await readFile('dist/asset-manifest.json','utf8')),files=new Map(manifest.files.map(f=>['/'+f.path,f]));
const server=createServer(async(req,res)=>{const f=files.get(req.url==='/'?'/index.html':req.url);if(!f)return res.writeHead(404).end();res.writeHead(200,{'Content-Type':f.mime});res.end(await readFile('dist/'+f.path));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:412,height:892}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.rhine);
 await page.evaluate(()=>{const channel=new MessageChannel();window.hostPort=channel.port1;channel.port1.onmessage=e=>{if(JSON.parse(e.data).type==='ready'){
   channel.port1.postMessage(JSON.stringify({type:'state',version:1,revision:1,state:{configured:true,records:[]}}));
   channel.port1.postMessage(JSON.stringify({type:'presentation',active:true,bootAllowed:true,initialBootCompleted:true,reducedMotion:false}));
 }};window.postMessage(JSON.stringify({type:'skp:init',version:1,sessionId:'glass'}),location.origin,[channel.port2]);});
 await page.waitForFunction(()=>window.rhine.stats().loaded&&window.rhine.stats().cameraDetail>.99);
 const trace=await page.evaluate(async()=>{
  window.rhine.workspace('authorization');const start=performance.now(),samples=[];
  do{await new Promise(requestAnimationFrame);const s=window.rhine.stats();samples.push({ms:performance.now()-start,clarity:s.decryption.clarity,lift:s.extraction});}while(samples.at(-1).clarity<1&&performance.now()-start<1600);
  return samples;
 });
 assert.ok(trace.at(-1).clarity===1&&trace.at(-1).ms<=1100,JSON.stringify(trace.at(-1)));
 const half=trace.find(s=>s.ms>=500);assert.ok(half.clarity>.4&&half.clarity<.7,JSON.stringify(half));
 assert.ok(trace.some(s=>s.clarity>0&&s.lift<3.3),'Clearing starts before the old extraction gate');
 await page.screenshot({path:`${out}/clear-at-one-second.png`});
 const pause=await page.evaluate(async()=>{
  const wait=ms=>new Promise(r=>setTimeout(r,ms));window.rhine.workspace('modules');await wait(350);
  window.hostPort.postMessage(JSON.stringify({type:'presentation',active:false}));await wait(100);
  const before=window.rhine.stats().decryption.clarity;await wait(500);const after=window.rhine.stats().decryption.clarity;
  window.hostPort.postMessage(JSON.stringify({type:'presentation',active:true}));await wait(80);const resumed=window.rhine.stats().decryption.clarity;
  await wait(700);return {before,after,resumed,final:window.rhine.stats().decryption.clarity};
 });
 assert.equal(pause.before,pause.after);assert.ok(pause.resumed<1,'Hidden time must not finish the animation');assert.equal(pause.final,1);assert.deepEqual(errors,[]);
 await writeFile(`${out}/report.json`,JSON.stringify({passed:true,trace,pause,errors},null,2));console.log(JSON.stringify({passed:true,finishedMs:trace.at(-1).ms,half,pause}));
}finally{await browser.close();await new Promise(r=>server.close(r));}

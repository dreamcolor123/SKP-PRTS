import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.SKP_PLAYWRIGHT_PATH||'playwright');
const out=process.env.SKP_CAMERA_OUTPUT||'.tools/navigation-camera';
await mkdir(out,{recursive:true});
const manifest=JSON.parse(await readFile('dist/asset-manifest.json','utf8'));
const files=new Map(manifest.files.map(file=>['/'+file.path,file]));
const server=createServer(async(req,res)=>{
  const path=req.url.split('?')[0];const file=files.get(path==='/'?'/index.html':path);
  if(!file){res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':file.mime});res.end(await readFile('dist/'+file.path));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const sections=[['home','home.summary','系统概览'],['authorization','authorization:manager','授权'],['modules','modules:manager','已安装模块'],['market','market:catalog','模块市场'],['settings','settings:controls','设置与诊断']];
const fixture={configured:true,statusText:'正常运行',records:sections.map(([section,id,category])=>({
  section,id,category,title:category,en:section,department:category,date:'4.6.2.1',lead:'LOCAL',clearance:'LOCAL',abstract:'',findings:[],source:'',kind:'summary',status:{code:'ready',label:'正常',tone:'success'},fields:[],actions:[],
}))};
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
const errors=[],results=[];
const span=values=>Math.max(...values)-Math.min(...values);
try {
  const page=await browser.newPage({viewport:{width:412,height:892},hasTouch:true});
  page.on('pageerror',error=>errors.push(error.message));
  // Rendering quality does not alter the camera. Keep the GPU cost small so
  // every navigation frame is sampled on a software-rendered CI browser.
  await page.addInitScript(()=>localStorage.setItem('rhine-settings',JSON.stringify({sound:false,music:false,superPerformance:true})));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.waitForFunction(()=>window.rhine);
  await page.evaluate(fixture=>{
    const channel=new MessageChannel();window.hostPort=channel.port1;
    channel.port1.onmessage=event=>{const message=JSON.parse(event.data);if(message.type==='ready'){
      channel.port1.postMessage(JSON.stringify({type:'state',version:1,revision:1,state:fixture}));
      channel.port1.postMessage(JSON.stringify({type:'presentation',active:true,bootAllowed:true,reducedMotion:false,initialBootCompleted:true}));
    }};
    window.postMessage(JSON.stringify({type:'skp:init',version:1,sessionId:'camera-fixture'}),location.origin,[channel.port2]);
  },fixture);
  await page.waitForFunction(()=>window.rhine.stats().cameraDetail>.999&&Math.abs(window.rhine.stats().cameraDistance-72)<.01,null,{timeout:45000});
  const capture=section=>page.evaluate(async section=>{
    const take=()=>{const s=window.rhine.stats();return {position:s.cameraPosition,aim:s.cameraAim,distance:s.cameraDistance,fov:s.fieldOfView,detail:s.cameraDetail,mode:s.cameraNavigation,extraction:s.extraction};};
    const samples=[take()];window.rhine.workspace(section);const start=performance.now();
    do {await new Promise(requestAnimationFrame);samples.push(take());}while(performance.now()-start<2600);
    return samples;
  },section);
  for(const section of ['authorization','modules','market','settings','home']){
    const samples=await capture(section);
    const origin=samples[0].aim;
    const metric={section,samples:samples.length,distanceSpan:span(samples.map(x=>x.distance)),fovSpan:span(samples.map(x=>x.fov)),aimExcursion:Math.max(...samples.map(x=>Math.hypot(...x.aim.map((v,i)=>v-origin[i])))),minDetail:Math.min(...samples.map(x=>x.detail)),minimumExtraction:Math.min(...samples.map(x=>x.extraction))};
    results.push({...metric,trajectory:samples});
    assert.ok(metric.distanceSpan<.12,JSON.stringify(metric));
    assert.ok(metric.fovSpan<.02,JSON.stringify(metric));
    assert.ok(metric.aimExcursion<1.1,JSON.stringify(metric));
    assert.ok(metric.minDetail>.99,JSON.stringify(metric));
    assert.ok(metric.minimumExtraction<1,'The selected cassette must retain its rise, independently of the lens');
    assert.ok(samples.slice(1).every(x=>x.mode==='workspace-pan'));
  }
  await page.evaluate(()=>window.rhine.browse());
  await page.waitForFunction(()=>window.rhine.stats().cameraDetail<.001&&window.rhine.stats().cameraDistance>138,null,{timeout:45000});
  const entry=await capture('modules');
  const entryMetric={kind:'array-to-detail',distanceSpan:span(entry.map(x=>x.distance)),initialDistance:entry[0].distance,finalDistance:entry.at(-1).distance,minDetail:Math.min(...entry.map(x=>x.detail)),maxDetail:Math.max(...entry.map(x=>x.detail))};
  results.push({...entryMetric,trajectory:entry});
  assert.ok(entryMetric.distanceSpan>45,JSON.stringify(entryMetric));
  assert.ok(entryMetric.minDetail<.01&&entryMetric.maxDetail>.9,JSON.stringify(entryMetric));
  assert.ok(entry.slice(1).every(x=>x.mode==='archive-entry'),'Array entry must retain the full original dolly');
  await page.waitForFunction(()=>Math.abs(window.rhine.stats().cameraDistance-72)<.01,null,{timeout:15000});
  const direction=sample=>sample.cameraPosition.map((v,i)=>(v-sample.cameraAim[i])/sample.cameraDistance);
  const neutral=direction(await page.evaluate(()=>window.rhine.stats()));
  const normalize=v=>{const length=Math.hypot(...v);return v.map(x=>x/length);};
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
  const right=normalize(cross([0,1,0],neutral));
  const up=normalize(cross(neutral,right));
  const axes=[];
  for(const [axis,x,y] of [['horizontal',1,0],['vertical',0,1]]){
    await page.evaluate(({x,y})=>window.hostPort.postMessage(JSON.stringify({type:'motion',version:1,x,y})),{x,y});
    await page.waitForTimeout(1400);
    const delta=direction(await page.evaluate(()=>window.rhine.stats())).map((v,i)=>v-neutral[i]);
    axes.push({axis,right:dot(delta,right),up:dot(delta,up)});
  }
  assert.ok(axes[0].right>.045&&Math.abs(axes[0].up)<.005,JSON.stringify(axes));
  assert.ok(axes[1].up<-.037&&Math.abs(axes[1].right)<.005,JSON.stringify(axes));
  results.push({sensorScreenAxes:axes});
  await page.evaluate(()=>window.hostPort.postMessage(JSON.stringify({type:'motion',version:1,x:0,y:0})));
  await page.waitForTimeout(800);
  assert.deepEqual(errors,[]);
  await page.screenshot({path:`${out}/navigation-close-shot.png`});
  await writeFile(`${out}/report.json`,JSON.stringify({passed:true,errors,results},null,2));
  console.log(JSON.stringify({passed:true,results:results.map(({trajectory,...result})=>result)},null,2));
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}

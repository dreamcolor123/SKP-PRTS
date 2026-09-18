import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.SKP_PLAYWRIGHT_PATH||'playwright');
const out=process.env.SKP_FRAME_SYNC_OUTPUT||'D:/SKP-PRTS-UI-transaction/deliverables/frame-sync-qa';
await mkdir(out,{recursive:true});
const manifest=JSON.parse(await readFile('dist/asset-manifest.json','utf8'));
const files=new Map(manifest.files.map(file=>['/'+file.path,file]));
const server=createServer(async(req,res)=>{
  const path=req.url.split('?')[0],file=files.get(path==='/'?'/index.html':path);
  if(!file){res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':file.mime});res.end(await readFile('dist/'+file.path));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const sections=[['home','home.summary','系统概览'],['authorization','authorization:manager','授权'],['modules','modules:manager','已安装模块'],['market','market:catalog','模块市场'],['settings','settings:controls','设置与诊断']];
const fixture={configured:true,statusText:'正常运行',records:sections.map(([section,id,category])=>({section,id,category,title:category,en:section,department:category,date:'4.6.2.1',lead:'LOCAL',clearance:'LOCAL',abstract:'',findings:[],source:'',kind:'summary',status:{code:'ready',label:'正常',tone:'success'},fields:[],actions:[]}))};
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
const errors=[],report={passed:false,bundle:manifest.files.filter(file=>file.path.endsWith('.js')),errors,violations:[],samples:[],encodes:[],oracle:null};
let page;
let output='';
const say=value=>{const line=typeof value==='string'?value:JSON.stringify(value);output+=line+'\n';console.log(line);};
try{
  page=await browser.newPage({viewport:{width:412,height:892},hasTouch:true,recordVideo:{dir:out,size:{width:412,height:892}}});
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    localStorage.setItem('rhine-settings',JSON.stringify({sound:false,music:false,superPerformance:true}));
    const audit=window.syncAudit={delay:0,failNext:false,encodes:[],samples:[],phase:'startup',enabled:false};
    const original=WebGL2RenderingContext.prototype.clientWaitSync;
    const read=WebGL2RenderingContext.prototype.getBufferSubData;
    const reads=new WeakMap();let activeRead;
    window.syncSnapshot=()=>{
      const panel=document.querySelector('.folder-face-panel'),canvas=document.querySelector('#three-scene canvas');
      if(!panel||!canvas||!window.rhine)return null;
      const stats=window.rhine.stats(),style=getComputedStyle(panel);
      const bounds=panel.getBoundingClientRect();
      const stage=document.querySelector('#stage'),stageRect=stage.getBoundingClientRect(),viewportRect=document.querySelector('#viewport').getBoundingClientRect();
      const expectedQuad=window.rhine.workspaceQuad()?.map(([x,y])=>({x:x*stageRect.width/stage.offsetWidth+stageRect.left-viewportRect.left,y:y*stageRect.width/stage.offsetWidth+stageRect.top-viewportRect.top}));
      const matrix=new DOMMatrix(style.transform),actualQuad=[[0,0],[panel.offsetWidth,0],[panel.offsetWidth,panel.offsetHeight],[0,panel.offsetHeight]].map(([x,y])=>{const p=matrix.transformPoint({x,y});return{x:p.x/p.w,y:p.y/p.w};});
      return {time:performance.now(),phase:audit.phase,canvasFrame:canvas.dataset.folderFrame,panelFrame:panel.dataset.folderFrame,
        synchronized:stats.folderFrame?.synchronized,pending:stats.folderFrame?.pending,presented:stats.folderFrame?.presented,
        title:panel.querySelector('h2')?.textContent,section:panel.dataset.section,root:panel.dataset.root,selected:stats.selected,
        corners:panel.dataset.corners,transform:panel.style.transform,headerTransform:panel.querySelector('.ff-header')?.style.transform,
        visibleFraction:Number(panel.dataset.visibleFraction??0),mask:panel.style.maskImage,clip:panel.style.clipPath,opacity:Number(style.opacity),
        hidden:panel.hidden,active:document.querySelector('#viewport').dataset.browsing!=='true',retries:Number(panel.dataset.maskRetries??0),
        bounds:{x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height},expectedQuad,actualQuad};
    };
    WebGL2RenderingContext.prototype.clientWaitSync=function(sync,...args){
      let entry=reads.get(sync);
      if(!entry){
        const failed=audit.failNext;audit.failNext=false;
        entry={id:audit.encodes.length+1,start:performance.now(),delay:audit.delay,failed,before:window.syncSnapshot()};
        reads.set(sync,entry);audit.encodes.push(entry);
      }
      activeRead=entry;
      if(performance.now()-entry.start<entry.delay+(entry.id%3)*20)return this.TIMEOUT_EXPIRED;
      return original.call(this,sync,...args);
    };
    WebGL2RenderingContext.prototype.getBufferSubData=function(...args){
      const entry=activeRead;
      if(entry){entry.end=performance.now();entry.beforeCallback=window.syncSnapshot();}
      if(entry?.failed)throw new Error('Injected asynchronous depth readback failure');
      return read.apply(this,args);
    };
    const monitor=()=>{if(audit.enabled){const sample=window.syncSnapshot();if(sample)audit.samples.push(sample);}requestAnimationFrame(monitor);};
    requestAnimationFrame(monitor);
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.waitForFunction(()=>window.rhine);
  await page.evaluate(fixture=>{
    const channel=new MessageChannel();window.hostPort=channel.port1;
    channel.port1.onmessage=event=>{const message=JSON.parse(event.data);if(message.type==='ready'){
      channel.port1.postMessage(JSON.stringify({type:'state',version:1,revision:1,state:fixture}));
      channel.port1.postMessage(JSON.stringify({type:'presentation',active:true,bootAllowed:true,reducedMotion:false,initialBootCompleted:true}));
    }};
    window.postMessage(JSON.stringify({type:'skp:init',version:1,sessionId:'frame-sync-fixture'}),location.origin,[channel.port2]);
  },fixture);
  await page.waitForFunction(()=>window.rhine.stats().cameraDetail>.999&&document.querySelector('.folder-face-panel').dataset.folderFrame,null,{timeout:45000});
  await page.evaluate(()=>{window.syncAudit.enabled=true;window.syncAudit.delay=80;window.syncAudit.phase='section-switch';window.syncAudit.samples.push(window.syncSnapshot());window.rhine.workspace('authorization');});
  await page.waitForTimeout(3500);
  await page.screenshot({path:`${out}/section-switch.png`});
  await page.evaluate(()=>{window.syncAudit.phase='rapid-navigation';window.syncAudit.samples.push(window.syncSnapshot());window.rhine.workspace('modules');});
  await page.waitForTimeout(40);
  await page.evaluate(()=>window.rhine.workspace('market'));
  await page.waitForTimeout(35);
  await page.evaluate(()=>window.rhine.workspace('settings'));
  await page.waitForTimeout(45);
  await page.evaluate(()=>window.rhine.workspace('home'));
  await page.waitForTimeout(3500);
  assert.equal(await page.locator('.ff-header h2').textContent(),'概览');
  await page.screenshot({path:`${out}/rapid-final.png`});
  await page.evaluate(()=>{window.syncAudit.enabled=false;window.syncAudit.delay=0;window.syncAudit.phase='browse';window.rhine.browse();});
  await page.waitForFunction(()=>window.rhine.stats().cameraDetail<.001,null,{timeout:30000});
  await page.evaluate(()=>{window.syncAudit.enabled=true;window.syncAudit.delay=80;window.syncAudit.phase='array-extraction';window.rhine.workspace('modules');});
  await page.waitForFunction(()=>{
    const p=document.querySelector('.folder-face-panel'),f=Number(p.dataset.visibleFraction);
    const s=window.rhine.stats();
    return p.dataset.section==='modules'&&s.extraction>3&&Number(getComputedStyle(p).opacity)>.98&&f>.02&&f<.98&&window.syncAudit.encodes.some(x=>x.before?.phase==='array-extraction');
  },null,{timeout:30000});
  await page.screenshot({path:`${out}/extraction-partial.png`});
  await page.evaluate(()=>{window.syncAudit.phase='codec-failure';window.syncAudit.failNext=true;});
  await page.waitForFunction(()=>window.syncAudit.encodes.some(x=>x.failed&&x.end),null,{timeout:15000});
  await page.waitForFunction(()=>Number(document.querySelector('.folder-face-panel').dataset.maskRetries)>0,null,{timeout:10000});
  await page.screenshot({path:`${out}/codec-failure-held-frame.png`});
  await page.waitForFunction(()=>{
    const failed=window.syncAudit.encodes.find(x=>x.failed);
    return failed&&Number(document.querySelector('#three-scene canvas').dataset.folderFrame)>Number(failed.before.canvasFrame);
  },null,{timeout:15000});
  await page.waitForTimeout(1800);
  await page.screenshot({path:`${out}/codec-recovered.png`});
  const audit=await page.evaluate(()=>{window.syncAudit.enabled=false;return window.syncAudit;});
  report.samples=audit.samples;report.encodes=audit.encodes;
  const active=report.samples.filter(sample=>sample.active&&!sample.hidden&&sample.canvasFrame&&sample.synchronized);
  let last;
  let projectedFrames=0;
  const preparedProjection=new Map();
  for(const sample of active){
    if(sample.pending!==undefined&&sample.expectedQuad)preparedProjection.set(String(sample.pending),sample.expectedQuad);
    if(sample.canvasFrame!==sample.panelFrame)report.violations.push({kind:'frame-mismatch',sample});
    if(last&&sample.phase===last.phase&&sample.canvasFrame===last.canvasFrame){
      for(const field of ['title','section','root','corners','transform','headerTransform','mask','clip']){
        if(sample[field]!==last[field])report.violations.push({kind:'uncommitted-'+field,frame:sample.canvasFrame,before:last[field],after:sample[field],time:sample.time,phase:sample.phase});
      }
    }
    if(sample.mask.includes('linear-gradient(transparent'))report.violations.push({kind:'transparent-flash',sample});
    // The production loop presents one frame then immediately starts the
    // next simulation. Match each visible DOM plane to the scene projection
    // recorded while that same numbered frame was pending.
    const committedProjection=preparedProjection.get(sample.canvasFrame);
    if(committedProjection){
      projectedFrames++;
      const error=Math.max(...sample.actualQuad.map((p,i)=>Math.hypot(p.x-committedProjection[i].x,p.y-committedProjection[i].y)));
      if(error>=1)report.violations.push({kind:'committed-projection-mismatch',frame:sample.canvasFrame,error});
    }
    last=sample;
  }
  const failed=report.encodes.find(entry=>entry.failed);
  assert.ok(failed,'The encoder failure must actually execute');
  const duringFailure=active.filter(sample=>sample.time>=failed.start&&sample.time<=failed.end);
  assert.ok(duringFailure.length>=2,'Artificial codec delay must span multiple animation frames');
  for(const sample of duringFailure){
    if(sample.canvasFrame!==failed.before.canvasFrame||sample.mask!==failed.before.mask||sample.clip!==failed.before.clip)report.violations.push({kind:'failed-readback-mutated-visible-frame',sample,expected:failed.before});
  }
  const delayed=report.encodes.filter(entry=>entry.delay>=80&&entry.end);
  assert.ok(delayed.length>=4,'Navigation must exercise several delayed non-solid GPU masks');
  assert.ok(active.some(sample=>sample.visibleFraction>.02&&sample.visibleFraction<.98),'The real foreground geometry must partially occlude a rising work surface');
  const failedCount=report.encodes.filter(entry=>entry.failed).length;
  assert.equal(failedCount,1);
  const oracle=await promisify(execFile)(process.execPath,['scripts/check-folder-depth.mjs'],{env:{...process.env,SKP_FOLDER_DEPTH_OUTPUT:`${out}/gpu-oracle`},maxBuffer:4*1024*1024});
  await writeFile(`${out}/gpu-oracle.stdout.txt`,oracle.stdout);await writeFile(`${out}/gpu-oracle.stderr.txt`,oracle.stderr);
  report.oracle=JSON.parse(await readFile(`${out}/gpu-oracle/report.json`,'utf8'));
  assert.equal(report.oracle.passed,true);
  assert.ok(projectedFrames>10,'Verify the actual DOM corners against the committed scene projection');
  report.summary={sampleCount:active.length,presentedFrames:new Set(active.map(x=>x.canvasFrame)).size,projectedFrames,delayedEncodes:delayed.length,failedEncodes:failedCount,violationCount:report.violations.length,oracleDprs:report.oracle.results.length};
  say(report.summary);
  assert.deepEqual(errors,[]);
  assert.deepEqual(report.violations,[]);
  report.passed=true;
  say('PASS: visible canvas, mask, projected controls and labels commit together; GPU fence delay/readback failure retains the prior complete frame.');
}catch(error){report.error={message:error.message,stack:error.stack};say('FAIL: '+error.message);throw error;}
finally{
  await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
  await writeFile(`${out}/stdout.txt`,output);
  if(page){const video=page.video();await page.close();if(video){await video.saveAs(`${out}/delayed-navigation.webm`);await video.delete();}}
  await browser.close();await new Promise(resolve=>server.close(resolve));
}

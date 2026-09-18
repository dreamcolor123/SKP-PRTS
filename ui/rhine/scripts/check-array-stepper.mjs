import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.SKP_PLAYWRIGHT_PATH||'playwright');
const out=process.env.SKP_BROWSER_OUTPUT||'.tools/array-stepper';
await mkdir(out,{recursive:true});
const manifest=JSON.parse(await readFile('dist/asset-manifest.json','utf8'));
const files=new Map(manifest.files.map(f=>['/'+f.path,f]));
const server=createServer(async(req,res)=>{const path=req.url.split('?')[0],file=files.get(path==='/'?'/index.html':path);if(!file){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':file.mime});res.end(await readFile('dist/'+file.path));});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const record=(id,section,title,category)=>({id,section,title,category,en:title,department:category,date:'4.6.2.1',lead:'LOCAL',clearance:'LOCAL',abstract:'',findings:[],source:'',kind:'summary',status:{code:'ready',label:'正常',tone:'success'},fields:[],actions:[]});
const fixture={configured:true,records:[record('home.summary','home','系统概览','系统概览'),record('system:security','home','设备状态','系统概览'),record('home:console','home','控制台','系统概览'),record('authorization:manager','authorization','授权管理','授权'),record('modules:manager','modules','模块管理','已安装模块'),record('module:test','modules','测试模块','已安装模块'),record('settings:controls','settings','内核设置','设置与诊断')]};
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
const checks=[],errors=[];
try {
 const page=await browser.newPage({viewport:{width:412,height:892},hasTouch:true});
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
 await page.waitForFunction(()=>window.rhine);
 await page.evaluate(fixture=>{const channel=new MessageChannel();window.hostPort=channel.port1;channel.port1.onmessage=event=>{const message=JSON.parse(event.data);if(message.type==='ready'){channel.port1.postMessage(JSON.stringify({type:'state',version:1,revision:1,state:fixture}));channel.port1.postMessage(JSON.stringify({type:'presentation',active:true,bootAllowed:true,reducedMotion:true,initialBootCompleted:true}));}};window.postMessage(JSON.stringify({type:'skp:init',version:1,sessionId:'array-stepper'}),location.origin,[channel.port2]);},fixture);
 await page.waitForSelector('.folder-face-panel[data-expanded=true]');
 await page.evaluate(()=>window.rhine.browse());
 const stepper=page.locator('.archive-row-navigation'),prev=stepper.locator('[data-action=row-prev]'),next=stepper.locator('[data-action=row-next]');
 await stepper.waitFor({state:'visible'});
 assert.equal(await page.locator('#archive-row-total').textContent(),'03');
 const lane=await page.evaluate(()=>window.rhine.stats().selectedCell.lane);
 for(const expected of ['system:security','home:console','home.summary']) {await next.click();assert.equal(await page.evaluate(()=>window.rhine.stats().selected),expected);assert.equal(await page.evaluate(()=>window.rhine.stats().selectedCell.lane),lane);}
 await prev.click();
 assert.equal(await page.evaluate(()=>window.rhine.stats().selected),'home:console');
 assert.equal(await page.locator('#archive-row-index').textContent(),'03');
 assert.equal(await page.evaluate(()=>window.rhine.stats().selectedCell.lane),lane);
 checks.push('Previous/next move exactly one real record within the current lane and wrap');
 await page.locator('.read-file').click();
 assert.equal(await page.evaluate(()=>window.rhine.workspaceState().recordId),'home:console');
 assert.equal(await page.evaluate(()=>window.rhine.workspaceState().browsing),false);
 await page.evaluate(()=>window.rhine.browse());
 for(const viewport of [{width:360,height:800},{width:412,height:892},{width:892,height:412}]) {
  await page.setViewportSize(viewport);await page.waitForTimeout(200);
  const rect=await stepper.boundingBox(),nav=await page.locator('.workspace-navigation').boundingBox();
  assert.ok(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=viewport.width&&rect.y+rect.height<=viewport.height,JSON.stringify({viewport,rect}));
  assert.ok(rect.x+rect.width<=nav.x||rect.x>=nav.x+nav.width||rect.y+rect.height<=nav.y||rect.y>=nav.y+nav.height,JSON.stringify({viewport,rect,nav}));
  for(const button of [prev,next]) {const bounds=await button.boundingBox();assert.ok(bounds.width>=48&&bounds.height>=48,JSON.stringify(bounds));}
  await page.screenshot({path:`${out}/stepper-${viewport.width}.png`});checks.push({viewport,stepper:rect,navigation:nav});
 }
 await page.evaluate(()=>window.rhine.workspace('authorization'));
 await page.evaluate(()=>window.rhine.browse());
 assert.equal(await page.locator('#archive-row-total').textContent(),'01');assert.equal(await prev.isDisabled(),true);assert.equal(await next.isDisabled(),true);
 await page.evaluate(()=>window.rhine.workspace('market'));
 await page.evaluate(()=>window.rhine.browse());
 assert.equal(await page.locator('#archive-row-index').textContent(),'00');assert.equal(await page.locator('#archive-row-total').textContent(),'00');assert.equal(await prev.isDisabled(),true);assert.equal(await next.isDisabled(),true);
 checks.push('One-record and empty columns disable both buttons; empty placeholders do not count');
 assert.deepEqual(errors,[]);
 await writeFile(`${out}/report.json`,JSON.stringify({passed:true,checks,errors},null,2));
 console.log(JSON.stringify({passed:true,checks,errors}));
} finally {await browser.close();server.close();}

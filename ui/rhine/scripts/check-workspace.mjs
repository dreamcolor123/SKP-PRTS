import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.SKP_PLAYWRIGHT_PATH||'playwright');
const {PNG}=require(process.env.SKP_PNGJS_PATH||'pngjs');
const out=process.env.SKP_BROWSER_OUTPUT||'.tools/workspace';
await mkdir(out,{recursive:true});
const manifest=JSON.parse(await readFile('dist/asset-manifest.json','utf8'));
const files=new Map(manifest.files.map(f=>['/'+f.path,f]));
const server=createServer(async(req,res)=>{const f=files.get(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]);if(!f){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':f.mime});res.end(await readFile('dist/'+f.path));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const action=(id,label,placement='overflow',payload={})=>({id,action:id,label,placement,payload,disabled:false});
const info=(id,section,title,category,actions=[],kind='summary')=>({id,section,title,category,en:title,department:category,date:'4.6.2.1',lead:'LOCAL',clearance:'LOCAL',abstract:'',findings:[],source:'',kind,status:{code:'ready',label:'正常',tone:'success'},fields:[{key:'version',label:'版本',value:'4.6.2.1'}],actions});
const fixture={configured:true,statusText:'正常运行',records:[
 info('home.summary','home','系统概览','系统概览',[action('root.test','测试 Root','primary'),action('console.open','控制台','secondary'),action('log.open','查看日志','secondary'),action('root.config.open','配置 Root'),action('reboot.options.open','重启选项')]),
 {...info('system:security','home','设备状态','系统概览'),fields:[{key:'selinux',label:'SELinux',value:'严格模式',healthy:true},{key:'seccomp',label:'Seccomp',value:'过滤模式',healthy:true},{key:'adbEnabled',label:'ADB',value:'已开启',healthy:false},{key:'oplusIntercepted',label:'OPlus 接口',value:'无需拦截',healthy:true}]},
 info('authorization:manager','authorization','授权管理','授权',[action('authorization.picker.open','添加应用','primary')]),
 info('modules:manager','modules','模块管理','已安装模块',[action('module.pick','安装模块','primary')]),
 info('market:catalog','market','模块市场','模块市场',[action('refresh','刷新市场','primary')]),
 info('settings:controls','settings','内核设置','设置与诊断',[{...action('settings.toggle','启动保护','overflow',{key:'bootFailProtect',enabled:true}),control:'toggle',checked:false,controlLabel:'启动保护'}]),
 info('settings:appearance','settings','外观与声音','设置与诊断',[action('appearance.open','外观与声音','primary')]),
 ...Array.from({length:60},(_,i)=>info(`module:${i}`,'modules',`模块 ${i} / 长名称测试`,'已安装模块',[action('module.webui.open','打开 WebUI','primary',{id:String(i)}),{...action('module.remove.request','卸载模块','overflow',{id:String(i)}),destructive:true}],'module')),
 info('auth:app','authorization','测试应用','授权',[action('authorization.remove.request','撤销授权','overflow',{packageName:'example.test'})],'application'),
 info('market:test','market','可安装模块','模块市场',[action('market.install.request','安装','primary',{id:'test'})],'market-module')
]};
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
const errors=[],results=[];
try {
 const page=await browser.newPage({viewport:{width:412,height:892},hasTouch:true});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/index.html');
 await page.waitForFunction(()=>window.rhine);
 await page.evaluate(fixture=>{
  const channel=new MessageChannel();window.hostPort=channel.port1;window.actions=[];window.savedWorkspace=null;window.presentations=[];
  channel.port1.onmessage=e=>{const m=JSON.parse(e.data);if(m.type==='ready') {channel.port1.postMessage(JSON.stringify({type:'state',version:1,revision:1,state:fixture}));channel.port1.postMessage(JSON.stringify({type:'presentation',active:true,bootAllowed:true,reducedMotion:false,initialBootCompleted:true}));}else if(m.requestId){window.actions.push(m);channel.port1.postMessage(JSON.stringify({type:'ack',requestId:m.requestId,status:'accepted'}));} else if(m.workspace){window.savedWorkspace=m.workspace;window.presentations.push(m);}};
  window.postMessage(JSON.stringify({type:'skp:init',version:1,sessionId:'fixture'}),location.origin,[channel.port2]);
 },fixture);
 await page.waitForSelector('.folder-face-panel[data-expanded=true]');
 await page.waitForFunction(()=>window.rhine.stats().cameraDetail>.999,{timeout:20000});
 await page.waitForTimeout(1800);
 assert.ok((await page.evaluate(()=>window.rhine.stats().workHeightScale))>1.6);
 assert.equal(await page.locator('.ff-health-list [data-health=normal]').count(),3);
 assert.equal(await page.locator('.ff-health-list [data-health=warning]').count(),1);
 const nav=await page.locator('.workspace-navigation').boundingBox();
 assert.ok(nav.x>=12&&nav.y+nav.height<=880,'Navigation must float with edge gaps');
 assert.ok((await page.locator('.workspace-navigation').evaluate(el=>getComputedStyle(el).backdropFilter)).includes('blur'));
 const neutral=await page.evaluate(()=>({quad:window.rhine.workspaceQuad(),header:document.querySelector('.ff-header').style.transform,stats:window.rhine.stats()}));
 await page.evaluate(()=>window.hostPort.postMessage(JSON.stringify({type:'motion',version:1,x:.8,y:-.7})));
 await page.waitForTimeout(1200);
 const tilted=await page.evaluate(()=>({quad:window.rhine.workspaceQuad(),header:document.querySelector('.ff-header').style.transform,stats:window.rhine.stats()}));
 const maxTiltPixels=Math.max(...tilted.quad.map((p,i)=>Math.hypot(p[0]-neutral.quad[i][0],p[1]-neutral.quad[i][1])));
 assert.ok(tilted.stats.deviceTilt.x>.7&&maxTiltPixels>1&&maxTiltPixels<12,JSON.stringify({maxTiltPixels,tilt:tilted.stats.deviceTilt}));
 assert.notEqual(neutral.header,tilted.header,'Raised controls retain their own projected plane');
 await page.screenshot({path:`${out}/sensor-tilted.png`});
 await page.evaluate(()=>window.hostPort.postMessage(JSON.stringify({type:'presentation',reducedMotion:true})));
 await page.waitForTimeout(400);
 assert.equal(await page.evaluate(()=>window.rhine.stats().deviceTilt.x),0);
 await page.evaluate(()=>{window.hostPort.postMessage(JSON.stringify({type:'motion',version:1,x:0,y:0}));window.hostPort.postMessage(JSON.stringify({type:'presentation',reducedMotion:false}));});
 await page.waitForTimeout(200);
 const navigationAnimated=await page.evaluate(()=>{
   document.querySelector('.workspace-navigation [data-section=modules]').click();
   return document.querySelector('.floating-navigation-plate').getAnimations().some(a=>a.playState==='running');
 });
 assert.equal(navigationAnimated,true,'Integrated page changes must not cancel the sliding navigation plate');
 results.push({navigationAnimated});
 await page.waitForTimeout(300);
 results.push({workingHeight:tilted.stats.workHeightScale,maxTiltPixels,healthyIndicators:3,warningIndicators:1});
 const capture=async name=>{await page.screenshot({path:`${out}/${name}.png`});if(name==='function-search'||name==='viewport-892')console.log(name,await page.evaluate(()=>({stage:document.querySelector('#stage').getBoundingClientRect().toJSON(),viewport:document.querySelector('#viewport').getBoundingClientRect().toJSON(),brand:document.querySelector('.brand').getBoundingClientRect().toJSON(),modal:document.querySelector('.terminal-modal')?.getBoundingClientRect().toJSON()})));};
 for(const section of ['home','authorization','modules','market','settings']){
  await page.locator(`.workspace-navigation [data-section=${section}]`).click();
  await page.waitForTimeout(2200);
  assert.equal(await page.locator('.folder-face-panel').getAttribute('data-section'),section);
  const lane=await page.evaluate(()=>window.rhine.stats().selectedCell.lane);
  assert.equal(((lane%5)+5)%5,['home','authorization','modules','market','settings'].indexOf(section));
  await capture(section);
  const projection = await page.evaluate(()=>{
    const panel=document.querySelector('.folder-face-panel'),stage=document.querySelector('#stage');
    const transform=new DOMMatrix(getComputedStyle(panel).transform),rect=stage.getBoundingClientRect(),scale=rect.width/stage.offsetWidth;
    const local=[[0,0],[panel.offsetWidth,0],[panel.offsetWidth,panel.offsetHeight],[0,panel.offsetHeight]];
    const expected=window.rhine.workspaceQuad().map(([x,y])=>({x:x*scale+rect.left,y:y*scale+rect.top}));
    const actual=local.map(([x,y])=>{const p=transform.transformPoint({x,y});return {x:p.x/p.w,y:p.y/p.w};});
    return {expected,actual,error:Math.max(...actual.map((p,i)=>Math.hypot(p.x-expected[i].x,p.y-expected[i].y))),matrix:Array.from(transform.toFloat64Array())};
  });
  assert.ok(projection.error<1,JSON.stringify(projection));
  assert.ok(Math.abs(projection.expected[0].y-projection.expected[1].y)>1,'Face must retain 3D slant');
  results.push({section,projection});
  const surface=await page.evaluate(()=>({visible:Number(document.querySelector('.folder-face-panel').dataset.visibleFraction),blur:getComputedStyle(document.querySelector('.folder-face-panel')).backdropFilter,background:getComputedStyle(document.querySelector('.folder-face-panel')).backgroundColor}));
  assert.ok(surface.visible>.7&&surface.visible<=1,JSON.stringify(surface));
  assert.ok(surface.blur.includes('blur('));
  results.push({section,surface});
 }
 await page.locator('.workspace-navigation [data-section=authorization]').click();
 await page.locator('.folder-face-panel .ff-footer button').filter({hasText:'添加应用'}).click();
 await page.waitForFunction(()=>window.actions.length>0);
 assert.equal(await page.evaluate(()=>window.actions.at(-1).action),'authorization.picker.open');
 await page.locator('.workspace-navigation [data-section=modules]').click();
 await page.locator('.folder-face-panel .ff-footer button').filter({hasText:'安装模块'}).click();
 await page.waitForFunction(()=>window.actions.at(-1)?.action==='module.pick');
 assert.equal(await page.evaluate(()=>window.actions.at(-1).action),'module.pick');
 await page.locator('.ff-query input').fill('模块 32');
 await page.locator('.ff-item-open').click();
 await page.waitForTimeout(300);
 assert.equal(await page.locator('.folder-face-panel').getAttribute('data-root'),'false');
 await capture('module-detail');
 await page.evaluate(()=>window.rhine.back());
 assert.equal(await page.locator('.ff-query input').inputValue(),'模块 32');
 await page.locator('.system-nav [data-action=search]').click();
 await page.waitForFunction(()=>window.savedWorkspace!==null);
 await page.waitForFunction(()=>window.presentations.at(-1)?.sensorEnabled===false);
 await page.locator('#archive-search').fill('重启');
 await page.locator('[data-function-record]').filter({hasText:'重启选项'}).click();
 await page.waitForTimeout(300);
 assert.equal(await page.evaluate(()=>window.actions.at(-1).action),'reboot.options.open');
 await page.locator('.system-nav [data-action=search]').click();
 await page.locator('#archive-search').fill('安装模块');
 assert.equal(await page.locator('.folder-face-panel').isVisible(),false);
 await page.waitForTimeout(300);
 const modalRect = await page.locator('.terminal-modal').boundingBox();
 assert.ok(modalRect.x>=0&&modalRect.x+modalRect.width<=412,'Search panel must not scroll the scene sideways');
 await capture('function-search');
 assert.equal(await page.locator('.system-nav').isVisible(),false,'Modal must cover the global icons');
 assert.ok(await page.locator('[data-function-record]').count());
 await page.evaluate(()=>window.rhine.back());await page.waitForTimeout(250);
 await page.waitForFunction(()=>window.presentations.at(-1)?.sensorEnabled===true);
 assert.equal(await page.locator('.system-nav').isVisible(),true);
 await page.locator('.workspace-navigation [data-section=home]').click();
 const occlusion=[];
 await page.evaluate(()=>window.rhine.browse());await page.waitForTimeout(2200);
 await page.evaluate(()=>window.rhine.workspace('modules'));
 for(let sample=0;sample<16;sample++){await page.waitForTimeout(40);occlusion.push(await page.evaluate(()=>Number(document.querySelector('.folder-face-panel').dataset.visibleFraction)));}
 results.push({occlusionDuringSelection:occlusion});
 console.log('occlusion',occlusion);
 assert.ok(occlusion.some(value=>value<.9),'Foreground archives must mask the UI during extraction');
 await page.evaluate(()=>window.rhine.workspace('home'));await page.waitForTimeout(1500);
 for(const viewport of [{width:360,height:800},{width:892,height:412},{width:1280,height:720}]){
  await page.setViewportSize(viewport);await page.waitForTimeout(400);await capture(`viewport-${viewport.width}`);
  const rect=await page.locator('.folder-face-panel').boundingBox();assert.ok(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=viewport.width+1&&rect.y+rect.height<=viewport.height+1,JSON.stringify(rect));
 }
 await page.setViewportSize({width:360,height:800});
 await page.evaluate(()=>window.hostPort.postMessage(JSON.stringify({type:'presentation',textScale:2})));
 await page.waitForTimeout(350);await capture('font-scale-2');
 const primaryBounds=await page.locator('.ff-footer').boundingBox();
 assert.ok(primaryBounds.y>=0&&primaryBounds.y+primaryBounds.height<=728);
 await page.evaluate(()=>window.hostPort.postMessage(JSON.stringify({type:'presentation',textScale:1})));
 await page.setViewportSize({width:412,height:892});
 await page.evaluate(()=>window.rhine.browse());await page.waitForTimeout(350);await capture('array');
 await page.locator('.workspace-navigation [data-section=home]').click();
 await page.evaluate(()=>{window.hostPort.postMessage(JSON.stringify({type:'presentation',active:false}));});await page.waitForTimeout(200);
 const state=await page.evaluate(()=>window.savedWorkspace);
 assert.equal(state.section,'home');
 await page.evaluate(()=>window.hostPort.postMessage(JSON.stringify({type:'presentation',active:true})));
 await page.waitForTimeout(1800);
 // Exercise the existing 3D-release action without adding a production test API.
 await page.evaluate(()=>{
   const button=document.createElement('button');button.id='test-three-release';button.dataset.action='toggle-three';
   document.body.append(button);button.click();
 });
 await page.waitForFunction(()=>window.rhine.stats().threeState==='off');
 await page.waitForFunction(()=>document.querySelector('.folder-face-panel').dataset.plane==='fallback');
 const flatLayers=await page.evaluate(()=>({
   layers:[...document.querySelectorAll('.ff-header,.ff-query,.ff-scroll,.ff-footer')].map(el=>({transform:el.style.transform,depth:el.dataset.depth??null})),
   floatX:document.querySelector('.folder-face-panel').style.getPropertyValue('--control-float-x'),
   floatY:document.querySelector('.folder-face-panel').style.getPropertyValue('--control-float-y'),
 }));
 assert.equal(flatLayers.layers.length,4);
 assert.ok(flatLayers.layers.every(layer=>layer.transform===''&&layer.depth===null));
 assert.equal(flatLayers.floatX,'0px');assert.equal(flatLayers.floatY,'0px');
 await capture('flat-fallback');
 results.push({flatFallback:flatLayers});
 await page.evaluate(()=>document.querySelector('#test-three-release').click());
 await page.waitForFunction(()=>window.rhine.stats().threeState==='on');
 await page.waitForFunction(()=>document.querySelector('.ff-header').dataset.depth==='0.32');
 await page.evaluate(()=>document.querySelector('#test-three-release').remove());
 await page.waitForTimeout(1800);
 const maskPerformance=await page.evaluate(()=>window.rhine.stats().folderMask);
 assert.equal(maskPerformance.syncReads,0);
 assert.ok(maskPerformance.drawn<maskPerformance.tested);
 results.push({maskPerformance});
 await page.evaluate(()=>{window.requestAnimationFrame=()=>0;});await page.waitForTimeout(200);
 const frosted=await page.screenshot({path:`${out}/frosted-surface.png`});
 await page.evaluate(()=>{document.querySelector('.folder-face-panel').style.backdropFilter='none';});
 const unfiltered=await page.screenshot({path:`${out}/surface-without-blur.png`});
 const first=PNG.sync.read(frosted),second=PNG.sync.read(unfiltered);
 let changed=0;for(let i=0;i<first.data.length;i+=4)if(Math.abs(first.data[i]-second.data[i])+Math.abs(first.data[i+1]-second.data[i+1])+Math.abs(first.data[i+2]-second.data[i+2])>6)changed++;
 assert.ok(changed>100,'Frosted surface must alter the rendered background, not only CSS metadata');
 results.push({backdropBlurChangedPixels:changed});
 assert.deepEqual(errors,[]);
 results.push('five sections one click','authorization/module action two clicks','direct action search','list query restoration','responsive bounds','native requests retained');
 await writeFile(`${out}/report.json`,JSON.stringify({passed:true,errors,checks:results,actions:await page.evaluate(()=>window.actions),snapshot:fixture},null,2));
 console.log(JSON.stringify({passed:true,checks:results,out}));
}finally{await browser.close();await new Promise(r=>server.close(r));}

import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import * as THREE from 'three';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.SKP_PLAYWRIGHT_PATH||'playwright');
const {PNG}=require(process.env.SKP_PNGJS_PATH||'pngjs');
const out=process.env.SKP_HORIZON_OUTPUT||'D:/SKP-PRTS-UI-transaction/deliverables/horizon-qa';
await mkdir(out,{recursive:true});
const report={passed:false,source:[],application:[],errors:[]};
const bundle=await build({stdin:{resolveDir:process.cwd(),loader:'ts',contents:`
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {themeEnvironment} from './src/theme-material';
window.horizonCheck=(width,height,dpr)=>{
  const renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});renderer.setPixelRatio(dpr);renderer.setSize(width,height);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  document.body.replaceChildren(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#eae5e1');scene.fog=new THREE.Fog('#eae5e1',71,84);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#d8c9b9',roughness:.95}));floor.name='archive-floor';floor.rotation.x=-Math.PI/2;floor.position.y=-4.63;scene.add(floor);
  scene.add(new THREE.HemisphereLight('#fffaf5','#b4a18c',.65));const light=new THREE.DirectionalLight('#fff7ed',1.4);light.position.set(-6,14,-5);scene.add(light);
  const camera=new THREE.PerspectiveCamera(8.73532481314285,width/height,5,300),aim=new THREE.Vector3(-.01217182487275348,7.125063623498537,-2.1198248192497613);
  const base=new THREE.Vector3(-19.9548,24.2599,64.9077).sub(aim).normalize(),right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),base).normalize(),up=new THREE.Vector3().crossVectors(base,right).normalize();
  const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));composer.addPass(new OutputPass());
  const result=[],images=[];
  for(const mode of ['direct','composer'])for(const theme of [0,.5,1])for(const legacy of theme===1?[false,true]:[false])for(const x of [-1,0,1])for(const y of [-1,0,1]){
    const dir=base.clone().applyAxisAngle(up,x*.054).applyAxisAngle(right,y*.045);camera.position.copy(aim).addScaledVector(dir,72);camera.lookAt(aim);camera.updateMatrixWorld();
    themeEnvironment(scene,renderer,theme);if(legacy)scene.fog.color.set('#263136');scene.updateMatrixWorld();
    renderer.info.reset();renderer.setRenderTarget(null);if(mode==='direct')renderer.render(scene,camera);else composer.render();
    const a=new THREE.Vector3(-100,-4.63,-100).project(camera),b=new THREE.Vector3(100,-4.63,-100).project(camera),samples=[];
    const gl=renderer.getContext(),pixels=new Uint8Array(width*dpr*height*dpr*4);gl.readPixels(0,0,width*dpr,height*dpr,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    for(const sx of [-.85,-.45,0,.45,.85]){
      const sy=a.y+(b.y-a.y)*(sx-a.x)/(b.x-a.x),px=Math.round((sx+1)*width*dpr/2),py=Math.round((1-sy)*height*dpr/2),offset=4*dpr;
      if(py-offset<0||py+offset>=height*dpr)continue;
      const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(sx,sy-offset/(height*dpr)*2),camera);const hit=ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),4.63),new THREE.Vector3());
      const depth=hit?-hit.clone().applyMatrix4(camera.matrixWorldInverse).z:0;if(depth<84)continue;
      const pixel=(x,y)=>Array.from(pixels.slice(((height*dpr-1-y)*width*dpr+x)*4,((height*dpr-1-y)*width*dpr+x)*4+3));
      const above=pixel(px,py-offset),below=pixel(px,py+offset);
      samples.push({pixel:[px,py],floorDepth:depth,above,below,maxDelta:Math.max(...above.map((v,i)=>Math.abs(v-below[i])))});
    }
    result.push({width,height,dpr,mode,theme,legacy,tilt:[x,y],samples,drawCalls:renderer.info.render.calls});
    if(x===1&&y===1&&theme===1)images.push({name:mode+'-'+(legacy?'before':'fixed')+'-'+width+'-dpr'+dpr,data:renderer.domElement.toDataURL('image/png')});
  }
  composer.dispose();floor.geometry.dispose();floor.material.dispose();renderer.dispose();
  return{result,images};
};
`},bundle:true,write:false,format:'iife',platform:'browser'});
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
let server,stdout='';
try{
  const sourcePage=await browser.newPage();sourcePage.on('pageerror',error=>report.errors.push(error.message));
  await sourcePage.setContent('<!doctype html><html><body style="margin:0"></body></html>');await sourcePage.addScriptTag({content:bundle.outputFiles[0].text});
  for(const viewport of [{width:412,height:892},{width:892,height:412}])for(const dpr of [1,2]){
    const result=await sourcePage.evaluate(({width,height,dpr})=>window.horizonCheck(width,height,dpr),{...viewport,dpr});report.source.push(...result.result);
    for(const item of result.images)await writeFile(`${out}/${item.name}.png`,Buffer.from(item.data.split(',')[1],'base64'));
  }
  await sourcePage.close();
  const corrected=report.source.filter(value=>!value.legacy).flatMap(value=>value.samples),counterexamples=report.source.filter(value=>value.legacy).flatMap(value=>value.samples);
  assert.ok(corrected.length>100,'Sample rays must cross the real finite floor edge');
  assert.ok(corrected.every(value=>value.maxDelta===0),JSON.stringify(corrected.filter(value=>value.maxDelta)));
  assert.ok(counterexamples.some(value=>value.maxDelta>=15),'Old mist color must reproduce the visible boundary');
  for(const mode of ['direct','composer'])for(const dpr of [1,2])assert.ok(report.source.some(value=>value.legacy&&value.mode===mode&&value.dpr===dpr&&value.samples.some(sample=>sample.maxDelta>=15)));
  for(const fixed of report.source.filter(value=>!value.legacy&&value.theme===1)){
    const old=report.source.find(value=>value.legacy&&value.mode===fixed.mode&&value.dpr===fixed.dpr&&value.width===fixed.width&&value.tilt.every((x,i)=>x===fixed.tilt[i]));
    assert.equal(fixed.drawCalls,old.drawCalls);
  }
  if(!process.argv.includes('--source-only')){
    const manifest=JSON.parse(await readFile('dist/asset-manifest.json','utf8'));report.bundle=manifest.files.filter(file=>file.path.endsWith('.js'));
    const files=new Map(manifest.files.map(file=>['/'+file.path,file]));server=createServer(async(req,res)=>{const path=req.url.split('?')[0],file=files.get(path==='/'?'/index.html':path);if(!file){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':file.mime});res.end(await readFile('dist/'+file.path));});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const fixture={configured:true,statusText:'正常运行',records:[{id:'home.summary',section:'home',category:'系统概览',title:'系统概览',en:'SYSTEM',department:'LOCAL',date:'4.6.2.1',lead:'LOCAL',clearance:'LOCAL',abstract:'',findings:[],source:'',kind:'summary',status:{code:'ready',label:'正常',tone:'success'},fields:[{key:'version',label:'版本',value:'4.6.2.1'}],actions:[]}]};
    for(const viewport of [{width:412,height:892},{width:892,height:412}])for(const superPerformance of [true,false]){
      const page=await browser.newPage({viewport,hasTouch:true});page.on('pageerror',error=>report.errors.push(error.message));
      await page.addInitScript(value=>localStorage.setItem('rhine-settings',JSON.stringify({sound:false,music:false,superPerformance:value,colorTheme:'dark'})),superPerformance);
      await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);await page.waitForFunction(()=>window.rhine);
      await page.evaluate(fixture=>{const channel=new MessageChannel();window.hostPort=channel.port1;channel.port1.onmessage=event=>{const m=JSON.parse(event.data);if(m.type==='ready'){channel.port1.postMessage(JSON.stringify({type:'state',version:1,revision:1,state:fixture}));channel.port1.postMessage(JSON.stringify({type:'presentation',active:true,bootAllowed:true,reducedMotion:false,initialBootCompleted:true}));}};window.postMessage(JSON.stringify({type:'skp:init',version:1,sessionId:'horizon-fixture'}),location.origin,[channel.port2]);},fixture);
      await page.waitForFunction(()=>window.rhine.stats().cameraDetail>.999&&Math.abs(window.rhine.stats().cameraDistance-72)<.01,null,{timeout:60000});
      for(const [x,y]of [[-1,-1],[1,-1],[-1,1],[1,1]]){
        await page.evaluate(({x,y})=>window.hostPort.postMessage(JSON.stringify({type:'motion',version:1,x,y})),{x,y});
        await page.waitForFunction(({x,y})=>{const s=window.rhine.stats();return Math.abs(s.deviceTilt.x-x)<.003&&Math.abs(s.deviceTilt.y-y)<.003;},{x,y},{timeout:45000});await page.waitForTimeout(700);
        const data=await page.evaluate(()=>({stats:window.rhine.stats(),stage:document.querySelector('#stage').getBoundingClientRect().toJSON(),exclude:[...document.querySelectorAll('.brand,.system-nav,.workspace-navigation,.folder-face-panel')].filter(element=>getComputedStyle(element).visibility!=='hidden'&&getComputedStyle(element).display!=='none').map(element=>element.getBoundingClientRect().toJSON())}));
        const path=`${out}/app-${viewport.width}-${superPerformance?'super':'original'}-${x}-${y}.png`,png=PNG.sync.read(await page.screenshot({path}));
        const c=new THREE.PerspectiveCamera(data.stats.fieldOfView,data.stage.width/data.stage.height,5,300);c.position.fromArray(data.stats.cameraPosition);c.lookAt(new THREE.Vector3(...data.stats.cameraAim));c.updateMatrixWorld();
        const a=new THREE.Vector3(-100,-4.63,-100).project(c),b=new THREE.Vector3(100,-4.63,-100).project(c),samples=[];
        // The physical shell extends above the DOM work surface. Exclude its
        // projected top edge too, so a real glass rim is not mistaken for fog.
        const scale=data.stage.width/data.stats.viewport.width;
        const shellLeft={x:data.stage.x+data.stats.topLeft[0]*scale,y:data.stage.y+data.stats.topLeft[1]*scale},shellRight={x:data.stage.x+data.stats.topRight[0]*scale,y:data.stage.y+data.stats.topRight[1]*scale};
        const pixel=(x,y)=>Array.from(png.data.subarray((y*png.width+x)*4,(y*png.width+x)*4+3));
        for(const sx of [-.9,-.7,-.5,-.3,0,.3,.5,.7,.9]){
          const sy=a.y+(b.y-a.y)*(sx-a.x)/(b.x-a.x),px=Math.round(data.stage.x+(sx+1)*data.stage.width/2),py=Math.round(data.stage.y+(1-sy)*data.stage.height/2),offset=5;
          if(px<2||px>=png.width-2||py-offset<2||py+offset>=png.height-2)continue;
          if(data.exclude.some(rect=>px>=rect.x-4&&px<=rect.x+rect.width+4&&py+offset>=rect.y-4&&py-offset<=rect.y+rect.height+4))continue;
          const shellTop=shellLeft.y+(shellRight.y-shellLeft.y)*(px-shellLeft.x)/(shellRight.x-shellLeft.x);
          if(px>=Math.min(shellLeft.x,shellRight.x)-12&&px<=Math.max(shellLeft.x,shellRight.x)+12&&py+offset>=shellTop-12)continue;
          const above=pixel(px,py-offset),below=pixel(px,py+offset);samples.push({pixel:[px,py],above,below,maxDelta:Math.max(...above.map((v,i)=>Math.abs(v-below[i])))});
        }
        report.application.push({viewport,superPerformance,tilt:[x,y],path,samples,stats:{cameraPosition:data.stats.cameraPosition,cameraAim:data.stats.cameraAim,fieldOfView:data.stats.fieldOfView,folderPipeline:data.stats.folderPipeline}});
        assert.ok(samples.every(sample=>sample.maxDelta<=2),JSON.stringify({viewport,superPerformance,tilt:[x,y],samples}));
      }
      await page.close();
    }
    assert.ok(report.application.flatMap(value=>value.samples).length>=8,'Real app samples must avoid UI and include the former horizon line');
  }
  assert.deepEqual(report.errors,[]);report.passed=true;report.summary={sourceCases:report.source.length,correctedEdgeSamples:corrected.length,maxCorrectedDelta:Math.max(...corrected.map(x=>x.maxDelta)),oldMistMaxDelta:Math.max(...counterexamples.map(x=>x.maxDelta)),applicationViews:report.application.length,applicationEdgeSamples:report.application.flatMap(x=>x.samples).length};
  stdout=JSON.stringify({passed:true,...report.summary},null,2)+'\n';console.log(stdout);
}catch(error){report.error={message:error.message,stack:error.stack};stdout+='FAIL: '+error.message+'\n';throw error;}
finally{await writeFile(`${out}/${process.argv.includes('--source-only')?'source-report':'report'}.json`,JSON.stringify(report,null,2));await writeFile(`${out}/${process.argv.includes('--source-only')?'source-stdout':'stdout'}.txt`,stdout);await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}

import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.SKP_PLAYWRIGHT_PATH||'playwright');
const out=process.env.SKP_PIPELINE_GPU_OUTPUT||'D:/SKP-PRTS-UI-transaction/deliverables/pipeline-gpu-qa';
await mkdir(out,{recursive:true});
const bundle=await build({stdin:{resolveDir:process.cwd(),loader:'ts',contents:`
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {FolderFramePipeline} from './src/folder-frame-pipeline';
import {FolderDepthMask} from './src/folder-depth-mask';

window.pipelineGpuCheck=async(dpr)=>{
  const renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});
  renderer.setPixelRatio(dpr);renderer.setSize(256,192);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.31;
  document.body.replaceChildren(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#542d92');
  const camera=new THREE.PerspectiveCamera(44,256/192,.1,60);camera.position.set(2.4,3.1,10);camera.lookAt(0,1.8,0);camera.updateMatrixWorld();
  const model=new THREE.Group();scene.add(model);
  const texels=new Uint8Array(64*64*4);
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){const i=(y*64+x)*4;texels[i]=55+Math.round(x/63*190);texels[i+1]=20+Math.round(y/63*90);texels[i+2]=150+Math.round(y/63*90);texels[i+3]=255;}
  const texture=new THREE.DataTexture(texels,64,64,THREE.RGBAFormat);texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearFilter;texture.needsUpdate=true;
  const faceGeometry=new THREE.PlaneGeometry(4.56,3.22).translate(0,1.79,.255);
  const faceMaterial=new THREE.MeshStandardMaterial({map:texture,roughness:.4,metalness:.2,side:THREE.DoubleSide});
  model.add(new THREE.Mesh(faceGeometry,faceMaterial));
  const blockerGeometry=new THREE.BoxGeometry(1.75,3.7,.35),blockerMaterial=new THREE.MeshStandardMaterial({color:'#e99afd',roughness:.65,metalness:.05});
  const blocker=new THREE.Mesh(blockerGeometry,blockerMaterial);blocker.position.set(-1,1.79,1);scene.add(blocker);
  const translucentGeometry=new THREE.PlaneGeometry(1.3,1.2),translucentMaterial=new THREE.MeshStandardMaterial({color:'#5c76e4',transparent:true,opacity:.45,roughness:.7,side:THREE.DoubleSide});
  const translucent=new THREE.Mesh(translucentGeometry,translucentMaterial);translucent.position.set(.6,2.8,1.3);scene.add(translucent);
  const transmissionGeometry=new THREE.SphereGeometry(.65,24,16),transmissionMaterial=new THREE.MeshPhysicalMaterial({color:'#e3d4ff',transmission:.75,thickness:.45,roughness:.12,metalness:0,ior:1.4});
  const transmission=new THREE.Mesh(transmissionGeometry,transmissionMaterial);transmission.position.set(.6,1.7,1.35);scene.add(transmission);
  const light=new THREE.DirectionalLight(0xffffff,3.2);light.position.set(-2,6,8);scene.add(light);scene.add(new THREE.AmbientLight(0xc4d5ff,.65));
  const composer=new EffectComposer(renderer);const renderPass=new RenderPass(scene,camera),outputPass=new OutputPass();composer.addPass(renderPass);composer.addPass(outputPass);
  const oracle=new FolderDepthMask(renderer,scene,camera,model);
  const hash=values=>{let value=2166136261;for(const byte of values)value=Math.imul(value^byte,16777619);return value>>>0;};
  const syncRead=callback=>{const gl=renderer.getContext(),pack=gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING);gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);try{return callback();}finally{gl.bindBuffer(gl.PIXEL_PACK_BUFFER,pack);}};
  const read=()=>syncRead(()=>{renderer.setRenderTarget(null);const pixels=new Uint8Array(256*dpr*192*dpr*4);renderer.getContext().readPixels(0,0,256*dpr,192*dpr,renderer.getContext().RGBA,renderer.getContext().UNSIGNED_BYTE,pixels);return pixels;});
  const snapshot=()=>({projection:new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).multiply(model.matrixWorld),height:1,tilt:{x:0,y:0}});
  const diff=(a,b)=>{let max=0,changed=0,overOne=0,total=0;for(let i=0;i<a.length;i++){const delta=Math.abs(a[i]-b[i]);max=Math.max(max,delta);changed+=Number(delta>0);overOne+=Number(delta>1);total+=delta;}return{max,changed,overOne,mean:total/a.length};};
  const readTarget=target=>syncRead(()=>{const pixels=new Uint8Array(target.width*target.height*4);renderer.readRenderTargetPixels(target,0,0,target.width,target.height,pixels);return pixels;});
  const drawDirect=mode=>{renderer.setRenderTarget(null);if(mode==='composer'){composer.renderToScreen=true;composer.render();}else renderer.render(scene,camera);};
  const color=(pipeline,mode)=>(target)=>{
    const old=renderer.getRenderTarget(),toScreen=composer.renderToScreen;
    try{renderer.initRenderTarget(target);drawDirect(mode);renderer.copyFramebufferToTexture(target.texture);}
    finally{composer.renderToScreen=toScreen;renderer.setRenderTarget(old);}
  };
  const waitFrame=async(pipeline,epoch)=>{const limit=performance.now()+3000;let frame;while(!(frame=pipeline.acquire(epoch))){if(performance.now()>limit)throw new Error('Pipeline completion timed out');await new Promise(requestAnimationFrame);}return frame;};
  const results=[],images=[];
  for(const mode of ['composer','super'])for(const surface of ['opaque','alpha','transmission']){
    translucent.visible=surface==='alpha';transmission.visible=surface==='transmission';
    const pipeline=new FolderFramePipeline(renderer,scene,camera,model,{colorDepth:false});
    drawDirect(mode);const expected=read(),expectedImage=renderer.domElement.toDataURL('image/png');
    const expectedMask=syncRead(()=>oracle.sample());const maskHash=hash(expectedMask.pixels);
    let slotPixels;pipeline.submit(target=>{color(pipeline,mode)(target);slotPixels=readTarget(target);},snapshot(),1);const frame=await waitFrame(pipeline,1);
    pipeline.present(frame.sequence,1);pipeline.blit();const actual=read();
    let distinct=new Set();for(let i=0;i<actual.length;i+=4)distinct.add(actual[i]+actual[i+1]*256+actual[i+2]*65536);
    results.push({mode,surface,dpr,physicalWidth:renderer.domElement.width,physicalHeight:renderer.domElement.height,difference:diff(expected,actual),rawBlitDifference:diff(slotPixels,actual),expectedHash:hash(expected),slotHash:hash(slotPixels),actualHash:hash(actual),maskExpected:maskHash,maskActual:hash(frame.mask.pixels),uniqueColors:distinct.size,stats:pipeline.stats});
    images.push({name:mode+'-'+surface+'-dpr'+dpr+'-direct',data:expectedImage},{name:mode+'-'+surface+'-dpr'+dpr+'-pipeline',data:renderer.domElement.toDataURL('image/png')});
    pipeline.dispose();
  }
  const pipeline=new FolderFramePipeline(renderer,scene,camera,model,{colorDepth:false});
  translucent.visible=true;transmission.visible=true;
  const original=FolderDepthMask.prototype.sampleAsync,delays=[240,0,75];let request=0;
  FolderDepthMask.prototype.sampleAsync=function(){const delay=delays[request++]??0;return original.call(this).then(value=>new Promise(resolve=>setTimeout(()=>resolve(value),delay)));};
  const expectedFrames=[];
  try{
    for(let index=0;index<3;index++){
      blocker.position.x=[-1.1,.8,0][index];blockerMaterial.color.set(['#e99afd','#5fcfea','#efbb4c'][index]);scene.background.set(['#542d92','#324074','#53352f'][index]);scene.updateMatrixWorld();
      drawDirect('composer');const pixels=read();const mask=syncRead(()=>oracle.sample());
      expectedFrames.push({sequence:index+1,color:hash(pixels),mask:hash(mask.pixels),pixels});
      images.push({name:'pair-'+(index+1)+'-dpr'+dpr+'-expected',data:renderer.domElement.toDataURL('image/png')});
      if(!pipeline.submit(target=>{color(pipeline,'composer')(target);expectedFrames[index].slotPixels=readTarget(target);},snapshot(),9))throw new Error('Three initial slots must accept all frames');
    }
    // Changing live state after submission must not alter pending colors/masks.
    blocker.position.x=30;scene.background.set('#ffffff');
    const pairs=[];const end=performance.now()+550;
    while(performance.now()<end||pipeline.stats.inFlight){
      await new Promise(requestAnimationFrame);const frame=pipeline.acquire(9);if(!frame)continue;
      const expected=expectedFrames.find(value=>value.sequence===frame.sequence);
      pipeline.present(frame.sequence,9);pipeline.blit();const pixels=read();
      pairs.push({sequence:frame.sequence,color:hash(pixels),expectedColor:expected.color,slotColor:hash(expected.slotPixels),mask:hash(frame.mask.pixels),expectedMask:expected.mask,difference:diff(expected.pixels,pixels),rawBlitDifference:diff(expected.slotPixels,pixels)});
      images.push({name:'pair-'+frame.sequence+'-dpr'+dpr+'-presented',data:renderer.domElement.toDataURL('image/png')});
      if(performance.now()>end+2500)throw new Error('Delayed pipeline did not drain');
    }
    results.push({mode:'paired-out-of-order',dpr,pairs,expectedColors:expectedFrames.map(value=>value.color),expectedMasks:expectedFrames.map(value=>value.mask),stats:pipeline.stats});
  }finally{FolderDepthMask.prototype.sampleAsync=original;pipeline.dispose();}
  window.pipelineGpuCleanup=()=>{oracle.dispose();composer.dispose();texture.dispose();faceGeometry.dispose();faceMaterial.dispose();blockerGeometry.dispose();blockerMaterial.dispose();translucentGeometry.dispose();translucentMaterial.dispose();transmissionGeometry.dispose();transmissionMaterial.dispose();renderer.dispose();};
  return{results,images};
};
`},bundle:true,write:false,format:'iife',platform:'browser'});
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
const report={passed:false,errors:[],results:[]};
let stdout='';
try{
  const page=await browser.newPage({viewport:{width:512,height:384}});
  page.on('pageerror',error=>report.errors.push(error.message));
  await page.setContent('<!doctype html><html><body style="margin:0;background:#aaa"></body></html>');
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  for(const dpr of [1,2]){
    const result=await page.evaluate(dpr=>window.pipelineGpuCheck(dpr),dpr);
    report.results.push(...result.results);
    for(const item of result.images)await writeFile(`${out}/${item.name}.png`,Buffer.from(item.data.split(',')[1],'base64'));
    await page.screenshot({path:`${out}/screen-dpr${dpr}.png`});
    await page.evaluate(()=>window.pipelineGpuCleanup());
  }
  for(const result of report.results){
    if(result.mode==='paired-out-of-order'){
      assert.equal(new Set(result.expectedColors).size,3);assert.equal(new Set(result.expectedMasks).size,3);
      assert.ok(result.pairs.length>=1);assert.equal(result.pairs.at(-1).sequence,3);
      assert.ok(result.stats.dropped>=1,'Late frame 1 must not replace the completed newer frame');
      for(const [index,pair]of result.pairs.entries()){
        assert.equal(pair.color,pair.slotColor);assert.equal(pair.mask,pair.expectedMask);assert.equal(pair.rawBlitDifference.max,0);assert.equal(pair.difference.max,0);
        if(index)assert.ok(pair.sequence>result.pairs[index-1].sequence);
      }
    }else{
      assert.equal(result.physicalWidth,256*result.dpr);assert.equal(result.physicalHeight,192*result.dpr);
      assert.ok(result.uniqueColors>1000,'The GPU image must contain real rendered texture/lighting gradients');
      assert.equal(result.maskActual,result.maskExpected);
      assert.equal(result.rawBlitDifference.max,0);
      assert.equal(result.difference.max,0,JSON.stringify(result));
    }
  }
  assert.deepEqual(report.errors,[]);report.passed=true;
  stdout=JSON.stringify({passed:true,checks:report.results.map(result=>({mode:result.mode,surface:result.surface,dpr:result.dpr,difference:result.difference,rawBlitDifference:result.rawBlitDifference,pairs:result.pairs?.map(pair=>({sequence:pair.sequence,difference:pair.difference})),dropped:result.stats?.dropped}))},null,2)+'\n';
  console.log(stdout);
}catch(error){report.error={message:error.message,stack:error.stack};stdout+='FAIL: '+error.message+'\n';throw error;}
finally{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await writeFile(`${out}/stdout.txt`,stdout);await browser.close();}

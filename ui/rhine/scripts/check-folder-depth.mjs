import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.SKP_PLAYWRIGHT_PATH || "playwright");
const out = process.env.SKP_FOLDER_DEPTH_OUTPUT || ".tools/folder-depth";
await mkdir(out, { recursive: true });
const bundle = await build({
  stdin: {
    contents: `
      import * as THREE from "three";
      import { FolderDepthMask } from "./src/folder-depth-mask";
      window.checkMask = async (dpr) => {
        const renderer = new THREE.WebGLRenderer({antialias:false});
        renderer.setSize(512,384);renderer.setPixelRatio(dpr);
        document.body.replaceChildren(renderer.domElement);
        renderer.autoClear = true;
        renderer.shadowMap.enabled = true;renderer.shadowMap.needsUpdate = true;
        renderer.setClearColor(0x123456,.37);
        const savedTarget = new THREE.WebGLRenderTarget(73,61);
        renderer.setRenderTarget(savedTarget);
        renderer.setViewport(7,9,480,350);renderer.setScissor(2,4,450,330);renderer.setScissorTest(true);
        const scene = new THREE.Scene();scene.background = new THREE.Color(0xcdefab);
        scene.overrideMaterial = new THREE.MeshBasicMaterial({color:0x444444});
        const model = new THREE.Group();
        const geometry = new THREE.PlaneGeometry(4.56,3.22).translate(0,1.79,.255);
        const material = new THREE.MeshBasicMaterial({color:0x6b7956,side:THREE.DoubleSide});
        model.add(new THREE.Mesh(geometry,material));scene.add(model);
        const blockerGeometry = new THREE.PlaneGeometry(2.28,3.22);
        const blocker = new THREE.Mesh(blockerGeometry,material);
        blocker.position.set(-1.14,1.79,1);scene.add(blocker);
        let camera = new THREE.OrthographicCamera(-4,4,5,-1,.1,30);
        camera.position.set(0,0,10);camera.updateMatrixWorld(true);
        const state = () => ({
          target:renderer.getRenderTarget()===savedTarget,
          viewport:renderer.getViewport(new THREE.Vector4()).toArray(),
          scissor:renderer.getScissor(new THREE.Vector4()).toArray(),
          scissorTest:renderer.getScissorTest(),autoClear:renderer.autoClear,
          clearColor:renderer.getClearColor(new THREE.Color()).getHex(),clearAlpha:renderer.getClearAlpha(),
          shadowEnabled:renderer.shadowMap.enabled,shadowNeedsUpdate:renderer.shadowMap.needsUpdate,
          xrEnabled:renderer.xr.enabled,cubeFace:renderer.getActiveCubeFace(),mipLevel:renderer.getActiveMipmapLevel(),
          background:scene.background.getHex(),override:scene.overrideMaterial.uuid,
          modelVisible:model.visible,pixelRatio:renderer.getPixelRatio(),info:{...renderer.info.render},
        });
        const original = state(), checkpoints = [], scenarios = [];
        let mask = new FolderDepthMask(renderer,scene,camera,model);
        const oracleTarget = new THREE.WebGLRenderTarget(384,288,{depthBuffer:true,stencilBuffer:false,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,generateMipmaps:false});
        const oracleMaterial = new THREE.MeshBasicMaterial({color:0,side:THREE.DoubleSide,depthTest:true,depthWrite:true,blending:THREE.NoBlending,toneMapped:false,fog:false});
        const oracleFaceMaterial = new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide,depthTest:true,depthWrite:false,blending:THREE.NoBlending,toneMapped:false,fog:false});
        const oracleGeometry = new THREE.PlaneGeometry(4.56,3.22).translate(0,1.79,.275);
        const oracleFace = new THREE.Mesh(oracleGeometry,oracleFaceMaterial);
        oracleFace.matrixAutoUpdate=false;oracleFace.frustumCulled=false;
        const oracleScene = new THREE.Scene();oracleScene.matrixWorldAutoUpdate=false;oracleScene.add(oracleFace);
        // Render every actual triangle without the production broad-phase filter.
        const oracle = () => {
          const before = {background:scene.background,material:scene.overrideMaterial,visible:model.visible,
            target:renderer.getRenderTarget(),viewport:renderer.getViewport(new THREE.Vector4()),scissor:renderer.getScissor(new THREE.Vector4()),
            scissorTest:renderer.getScissorTest(),color:renderer.getClearColor(new THREE.Color()),alpha:renderer.getClearAlpha(),
            clear:renderer.autoClear,shadow:renderer.shadowMap.enabled,needs:renderer.shadowMap.needsUpdate,info:{...renderer.info.render}};
          const pixels = new Uint8Array(384*288*4),coverage = new Uint8Array(384*288*4);
          try {
            renderer.autoClear=false;renderer.shadowMap.enabled=false;
            renderer.setRenderTarget(oracleTarget);renderer.setViewport(0,0,384/dpr,288/dpr);renderer.setScissorTest(false);
            renderer.setClearColor(0,1);renderer.clear(true,true,true);
            scene.background=null;scene.overrideMaterial=oracleMaterial;model.visible=false;
            scene.updateMatrixWorld();oracleFace.matrixWorld.copy(model.matrixWorld);
            renderer.render(scene,camera);renderer.render(oracleScene,camera);
            renderer.readRenderTargetPixels(oracleTarget,0,0,384,288,pixels);
            renderer.clear(true,true,true);renderer.render(oracleScene,camera);
            renderer.readRenderTargetPixels(oracleTarget,0,0,384,288,coverage);
          } finally {
            scene.background=before.background;scene.overrideMaterial=before.material;model.visible=before.visible;
            renderer.autoClear=before.clear;renderer.shadowMap.enabled=before.shadow;renderer.shadowMap.needsUpdate=before.needs;
            renderer.setClearColor(before.color,before.alpha);renderer.setRenderTarget(before.target);
            renderer.setViewport(before.viewport);renderer.setScissor(before.scissor);renderer.setScissorTest(before.scissorTest);
            Object.assign(renderer.info.render,before.info);
          }
          return {pixels,coverage};
        };
        const summarize = sample => {
          const {pixels,width,height,quad}=sample;
          let white=0,black=0;
          const probe=(x,y)=>{
            const p=new THREE.Vector3(x,y,.255).applyMatrix4(model.matrixWorld).project(camera);
            const px=Math.floor((p.x+1)*width/2),py=Math.floor((p.y+1)*height/2);
            return pixels[(py*width+px)*4];
          };
          for(let row=0;row<32;row++)for(let col=0;col<46;col++){
            const value=probe(-2.28+(col+.5)/46*4.56,.18+(row+.5)/32*3.22);
            if(value>127)white++;else black++;
          }
          let hash=2166136261;
          for(let index=0;index<pixels.length;index+=4)hash=Math.imul(hash^pixels[index],16777619);
          return {width,height,white,black,fraction:white/(white+black),quad,left:probe(-1.14,1.79),right:probe(1.14,1.79),hash:hash>>>0,solid:sample.solid===true};
        };
        const compare = (sample,expected) => {
          let mismatch=0,checked=0;
          for(let index=0;index<expected.pixels.length;index+=4){
            // The fast empty path intentionally marks off-face pixels white too.
            if(sample.solid&&expected.coverage[index]!==255)continue;
            checked++;if(sample.pixels[index]!==expected.pixels[index])mismatch++;
          }
          return {mismatch,checked};
        };
        const check = async name => {
          const expected=oracle(),sync=mask.sample(),syncSummary=summarize(sync),syncOracle=compare(sync,expected),syncPixels=sync.pixels.slice();
          checkpoints.push({name:name+' sync',state:state()});
          const pending=mask.sampleAsync();
          checkpoints.push({name:name+' async submitted',state:state()});
          const async=await pending,asyncSummary=summarize(async),asyncOracle=compare(async,expected);
          checkpoints.push({name:name+' async complete',state:state()});
          let syncAsyncMismatches=0;
          for(let index=0;index<syncPixels.length;index++)if(syncPixels[index]!==async.pixels[index])syncAsyncMismatches++;
          const result={name,sync:syncSummary,async:asyncSummary,syncOracle,asyncOracle,syncAsyncMismatches,stats:mask.stats};
          scenarios.push(result);return result;
        };
        await check('front-half');
        blocker.position.z=-1;await check('behind-empty');
        blocker.position.set(50,1.79,1);await check('offscreen-empty');
        const instanceCount=201,batch=new THREE.InstancedMesh(blockerGeometry,material,instanceCount),matrix=new THREE.Matrix4();
        for(let index=0;index<instanceCount;index++)batch.setMatrixAt(index,matrix.makeTranslation(index===0?-1.14:30+index*3,1.79,1));
        batch.instanceMatrix.needsUpdate=true;scene.add(batch);blocker.visible=false;
        await check('one-near-two-hundred-far-instances');
        batch.visible=false;blocker.visible=true;blocker.position.set(-1.14,1.79,1);
        const failures=[];
        for(const operation of ['render','readRenderTargetPixels','readRenderTargetPixelsAsync']){
          const saved=renderer[operation],message='synthetic '+operation+' failure';
          renderer[operation]=()=>{if(operation==='readRenderTargetPixelsAsync')return Promise.reject(new Error(message));throw new Error(message);};
          let thrown='';
          try{if(operation==='readRenderTargetPixelsAsync')await mask.sampleAsync();else mask.sample();}catch(error){thrown=error.message;}
          finally{renderer[operation]=saved;}
          failures.push({operation,thrown,expected:message});checkpoints.push({name:operation+' error',state:state()});
          await check('recovered-'+operation);
        }
        model.rotation.set(.13,.3,-.12);model.scale.y=1.65;model.position.set(.2,-.5,0);
        model.updateMatrixWorld(true);
        blocker.position.set(-1.14,1.79,1).applyMatrix4(model.matrixWorld);
        blocker.quaternion.copy(model.quaternion);blocker.scale.y=1.65;
        camera=new THREE.PerspectiveCamera(42,512/384,.1,80);camera.position.set(3.2,3.8,13);camera.lookAt(.2,2.5,0);camera.updateMatrixWorld(true);
        mask.dispose();mask=new FolderDepthMask(renderer,scene,camera,model);
        await check('rotated-tall-perspective');
        // A real aperture must remain visible; a projected bounding box is not an occluder.
        const shape=new THREE.Shape();shape.moveTo(-2.1,.25);shape.lineTo(2.1,.25);shape.lineTo(2.1,3.3);shape.lineTo(-2.1,3.3);shape.closePath();
        const hole=new THREE.Path();hole.moveTo(-.75,1);hole.lineTo(-.75,2.6);hole.lineTo(.75,2.6);hole.lineTo(.75,1);hole.closePath();shape.holes.push(hole);
        const apertureGeometry=new THREE.ShapeGeometry(shape),aperture=new THREE.Mesh(apertureGeometry,material);
        aperture.position.set(0,0,.8).applyMatrix4(model.matrixWorld);aperture.quaternion.copy(model.quaternion);aperture.scale.y=1.65;
        scene.add(aperture);blocker.visible=false;
        await check('rotated-aperture-exact-triangles');
        mask.dispose();mask.dispose();
        let disposedError='';try{mask.sample();}catch(error){disposedError=error.message;}
        renderer.setRenderTarget(null);renderer.setViewport(0,0,512,384);renderer.setScissorTest(false);
        const inspectionMaterial=new THREE.MeshBasicMaterial({color:0x242629,side:THREE.DoubleSide});aperture.material=inspectionMaterial;
        scene.overrideMaterial=null;renderer.autoClear=true;renderer.render(scene,camera);
        window.finishMask=()=>{
          geometry.dispose();blockerGeometry.dispose();apertureGeometry.dispose();material.dispose();
          oracleTarget.dispose();oracleMaterial.dispose();oracleFaceMaterial.dispose();oracleGeometry.dispose();
          savedTarget.dispose();batch.dispose();inspectionMaterial.dispose();renderer.dispose();
        };
        return {dpr,original,checkpoints,scenarios,failures,disposedError};
      };
    `,
    resolveDir: fileURLToPath(new URL("../", import.meta.url)),
    loader: "ts",
  },
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
});
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: "msedge" }),
  args: ["--enable-unsafe-swiftshader"],
});
const results = [], pageErrors = [];
try {
  const page = await browser.newPage({ viewport: { width: 512, height: 384 } });
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.setContent("<!doctype html><html><body style='margin:0'></body></html>");
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  for (const dpr of [1, 2]) {
    const result = await page.evaluate(dpr => window.checkMask(dpr), dpr);
    results.push(result);
    await writeFile(`${out}/report.json`, JSON.stringify({ passed: false, results, pageErrors }, null, 2));
    for (const scenario of result.scenarios) {
      assert.equal(scenario.sync.width, 384);
      assert.equal(scenario.sync.height, 288);
      assert.equal(scenario.syncOracle.mismatch, 0, `DPR ${dpr} ${scenario.name}: sync differs from full-scene depth oracle`);
      assert.equal(scenario.asyncOracle.mismatch, 0, `DPR ${dpr} ${scenario.name}: async differs from full-scene depth oracle`);
      assert.equal(scenario.syncAsyncMismatches, 0, `DPR ${dpr} ${scenario.name}: sync/async pixels differ`);
      assert.ok(scenario.syncOracle.checked > 1000);
      assert.deepEqual(scenario.sync, scenario.async);
    }
    const named = Object.fromEntries(result.scenarios.map(scenario => [scenario.name, scenario]));
    const front = named['front-half'].sync;
    assert.ok(Math.abs(front.fraction - .5) < .03, JSON.stringify(front));
    assert.equal(front.left, 0);assert.equal(front.right, 255);
    for (const name of ['behind-empty', 'offscreen-empty']) {
      assert.equal(named[name].sync.fraction, 1);
      assert.equal(named[name].sync.solid, true);
      assert.equal(named[name].stats.drawn, 0);
    }
    const instanced = named['one-near-two-hundred-far-instances'];
    assert.equal(instanced.stats.tested, 201);assert.equal(instanced.stats.drawn, 1);
    assert.equal(instanced.stats.triangles, 2);
    assert.equal(instanced.sync.hash, front.hash);
    for (const name of ['rotated-tall-perspective', 'rotated-aperture-exact-triangles']) {
      assert.ok(named[name].sync.fraction > .05 && named[name].sync.fraction < .95, JSON.stringify(named[name]));
      assert.ok(named[name].stats.asyncReads > 0);
    }
    for (const checkpoint of result.checkpoints) assert.deepEqual(checkpoint.state, result.original, `DPR ${dpr} renderer changed after ${checkpoint.name}`);
    for (const failure of result.failures) assert.equal(failure.thrown, failure.expected);
    assert.equal(result.disposedError, 'FolderDepthMask has been disposed');
    await page.screenshot({ path: `${out}/rotated-aperture-dpr${dpr}.png` });
    await page.evaluate(() => window.finishMask());
  }
  assert.equal(pageErrors.length, 0, pageErrors.join('\n'));
  for (let index = 0; index < results[0].scenarios.length; index++) {
    assert.deepEqual(results[0].scenarios[index].sync, results[1].scenarios[index].sync, `${results[0].scenarios[index].name}: DPR must not change projected visibility`);
  }
  await writeFile(`${out}/report.json`, JSON.stringify({ passed: true, results, pageErrors }, null, 2));
  console.log(JSON.stringify({ passed: true, dprs: results.length, scenariosPerDpr: results[0].scenarios.length, output: out }));
} finally {
  await browser.close();
}

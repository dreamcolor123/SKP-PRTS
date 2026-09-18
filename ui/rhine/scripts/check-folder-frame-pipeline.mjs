import assert from 'node:assert/strict';
import {build} from 'esbuild';

const bundle=await build({stdin:{contents:'export * from "./src/folder-frame-pipeline";export {FolderDepthMask} from "./src/folder-depth-mask";export * as THREE from "three";',resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'cjs'});
const module={exports:{}};new Function('module','exports',bundle.outputFiles[0].text)(module,module.exports);const exports=module.exports;
const {FolderFramePipeline,FolderDepthMask,THREE}=exports;
const pending=[],targets=[],copies=[];
const originalRead=FolderDepthMask.prototype.sampleAsync;
FolderDepthMask.prototype.sampleAsync=function(){return new Promise((resolve,reject)=>pending.push({depth:this,resolve,reject}));};
let size=new THREE.Vector2(1080,2400),target=null,cubeFace=3,mipLevel=2;
const viewport=new THREE.Vector4(1,2,3,4),scissor=new THREE.Vector4(5,6,7,8);
let scissorTest=true;
const renderer={
  autoClear:true,xr:{enabled:true},shadowMap:{enabled:true,needsUpdate:true},
  getDrawingBufferSize:vector=>vector.copy(size),getPixelRatio:()=>2,
  getRenderTarget:()=>target,getActiveCubeFace:()=>cubeFace,getActiveMipmapLevel:()=>mipLevel,
  getViewport:vector=>vector.copy(viewport),getScissor:vector=>vector.copy(scissor),getScissorTest:()=>scissorTest,
  setRenderTarget:(value,cube=0,mip=0)=>{target=value;cubeFace=cube;mipLevel=mip;},
  setViewport:(x,y,z,w)=>typeof x==='number'?viewport.set(x,y,z,w):viewport.copy(x),
  setScissor:vector=>scissor.copy(vector),setScissorTest:value=>{scissorTest=value;},
  render:mesh=>copies.push({target,source:mesh.material.uniforms.source.value,viewport:viewport.toArray(),toneMapped:mesh.material.toneMapped,fragment:mesh.material.fragmentShader,depthTest:mesh.material.depthTest}),
};
const snapshot={projection:new THREE.Matrix4(),height:1.65,tilt:{x:.2,y:.3}};
const pipeline=new FolderFramePipeline(renderer,new THREE.Scene(),new THREE.PerspectiveCamera(),new THREE.Group(),{colorDepth:false});
const submit=epoch=>pipeline.submit(value=>targets.push(value),snapshot,epoch);
const complete=async(index,marker)=>{pending[index].resolve({width:1,height:1,pixels:Uint8Array.of(marker,0,0,255),quad:[[0,0],[1,0],[1,1],[0,1]]});await Promise.resolve();await Promise.resolve();};
try{
  assert.equal(submit(1),true);assert.equal(submit(1),true);assert.equal(submit(1),true);assert.equal(submit(1),false);
  assert.equal(pipeline.stats.inFlight,3);assert.equal(new Set(pending.map(value=>value.depth)).size,3);
  assert.equal(new Set(targets).size,3);assert.ok(targets.every(value=>value.width===1080&&value.height===2400&&!value.depthBuffer));
  snapshot.projection.elements[0]=99;snapshot.tilt.x=99;
  await complete(1,2);await complete(2,3);
  const newest=pipeline.acquire(1);assert.equal(newest.sequence,3);assert.equal(newest.mask.pixels[0],3);
  assert.equal(newest.snapshot.projection.elements[0],1);assert.equal(newest.snapshot.tilt.x,.2);
  assert.equal(pipeline.acquire(1),newest,'Acquired snapshot must stay stable during asynchronous DOM preparation');
  assert.equal(pipeline.present(2,1),false);assert.equal(pipeline.present(3,1),true);
  assert.equal(pipeline.presentedSnapshot,newest.snapshot);assert.equal(pipeline.maskStats.syncReads,0);
  await complete(0,1);assert.equal(pipeline.acquire(1),undefined,'Late older completion must not replace displayed newer frame');
  assert.equal(pipeline.stats.dropped,2);
  assert.equal(submit(1),true);pending[3].reject(new Error('readback failure'));await Promise.resolve();await Promise.resolve();
  assert.equal(pipeline.stats.failed,1);assert.equal(pipeline.stats.presented,3);
  assert.equal(submit(1),true);pipeline.invalidate(2);assert.equal(pipeline.stats.presented,3);
  assert.equal(submit(2),true);await complete(5,6);const epoch2=pipeline.acquire(2);assert.equal(epoch2.sequence,6);
  pipeline.invalidate(2);assert.equal(pipeline.present(6,2),false);assert.equal(pipeline.release(6,2),false);
  await complete(4,5);assert.equal(pipeline.acquire(2),undefined);
  assert.equal(submit(2),true);const oldTarget=targets.at(-1);size.set(900,1600);assert.equal(submit(2),true);
  assert.equal(oldTarget.width,1080,'Resize must not mutate a pending slot target');
  assert.equal(targets.at(-1).width,900);await complete(6,7);assert.equal(pipeline.acquire(2),undefined);
  await complete(7,8);assert.equal(pipeline.acquire(2).sequence,8);assert.equal(pipeline.present(8,2),true);
  const before={target,cubeFace,mipLevel,viewport:viewport.toArray(),scissor:scissor.toArray(),scissorTest,autoClear:renderer.autoClear,xr:renderer.xr.enabled,shadow:renderer.shadowMap.enabled,shadowNeedsUpdate:renderer.shadowMap.needsUpdate};
  assert.equal(pipeline.blit(),true);assert.equal(copies.at(-1).target,null);assert.deepEqual(copies.at(-1).viewport,[0,0,450,800]);
  assert.equal(copies.at(-1).toneMapped,false);assert.equal(copies.at(-1).depthTest,false);assert.ok(!copies.at(-1).fragment.includes('colorspace'));
  const destination=new THREE.WebGLRenderTarget(721,359),texture=new THREE.Texture();pipeline.copyColor(texture,destination);
  assert.equal(copies.at(-1).source,texture);assert.equal(copies.at(-1).target,destination);assert.deepEqual(copies.at(-1).viewport,[0,0,360.5,179.5]);
  assert.deepEqual({target,cubeFace,mipLevel,viewport:viewport.toArray(),scissor:scissor.toArray(),scissorTest,autoClear:renderer.autoClear,xr:renderer.xr.enabled,shadow:renderer.shadowMap.enabled,shadowNeedsUpdate:renderer.shadowMap.needsUpdate},before);
  assert.equal(submit(2),true);await complete(8,9);const releasable=pipeline.acquire(2);assert.equal(pipeline.release(releasable.sequence,2),true);assert.equal(pipeline.stats.presented,8);
  assert.equal(pipeline.submit(()=>{throw new Error('render failed');},snapshot,2),false);assert.equal(pipeline.stats.failed,2);
  assert.equal(submit(2),true);let pendingDisposed=0;targets.at(-1).addEventListener('dispose',()=>pendingDisposed++);
  pipeline.clearPresented();assert.equal(pipeline.stats.presented,0);assert.equal(pipeline.presentedSnapshot,undefined);assert.equal(pipeline.blit(),false);
  pipeline.dispose();assert.equal(pendingDisposed,0);assert.equal(pipeline.blit(),false);assert.equal(submit(2),false);
  await complete(9,11);assert.equal(pendingDisposed,1);pipeline.dispose();assert.equal(pendingDisposed,1);
  assert.equal(pipeline.stats.inFlight,0);
  console.log(JSON.stringify({passed:true,checks:['bounded-three-slots','exclusive-color-mask-buffers','full-drawing-buffer-resolution','latest-ready-selection','immutable-acquired-snapshot','late-result-drop','failure-retains-last-frame','epoch-invalidation','pending-resize-isolation','raw-copy-with-render-state-restoration','release','render-error','deferred-pending-disposal'],stats:pipeline.stats},null,2));
}finally{pipeline.dispose();FolderDepthMask.prototype.sampleAsync=originalRead;}

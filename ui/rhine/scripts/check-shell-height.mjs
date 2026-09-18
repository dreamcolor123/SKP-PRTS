import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.SKP_PLAYWRIGHT_PATH || 'playwright');
const out = process.env.SKP_SHELL_HEIGHT_OUTPUT || '.tools/shell-height';
await mkdir(out, { recursive: true });
const glb = await readFile('public/assets/archive-cassette.glb');
const bundle = await build({
  stdin: {
    resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'ts',
    contents: `
      import * as THREE from 'three';
      import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
      import { ArchiveShellHeight, cassetteComponents } from './src/archive-shell-height';
      window.checkShellHeight = async () => {
        const gltf=await new GLTFLoader().loadAsync('/model.glb');gltf.scene.updateMatrixWorld(true);
        const source=[];
        gltf.scene.traverse(node=>{if(node instanceof THREE.Mesh){
          const name=node.material.name.replace(/\\.\\d+$/,'');
          if(name==='Carbon_Ink')return;
          source.push({name,geometry:node.geometry.clone().applyMatrix4(node.matrixWorld),material:node.material});
        }});
        const shell=source.find(part=>part.name==='Frosted_Polymer').geometry;shell.computeBoundingBox();
        const bottom=shell.boundingBox.min.y,top=shell.boundingBox.max.y,h=1.65;
        const manager=new ArchiveShellHeight(bottom,top),selected=new THREE.Group();
        const arrays=[],snapshots=[],originals=new Map(),arraySurfaces=new Set(['Frosted_Polymer','Ivory_Edges','Titanium_Fasteners','Index_Inlay','Optical_Diffuser']);
        const plain=new THREE.MeshBasicMaterial({color:0x66705d,side:THREE.DoubleSide});
        for(const part of source){
          const p=part.geometry.getAttribute('position'),n=part.geometry.getAttribute('normal');
          const position=Float32Array.from({length:p.count*3},(_,i)=>p.array[i]),normal=new Float32Array(n.array);
          originals.set(part.geometry,{position,normal});
          snapshots.push({name:part.name,geometry:part.geometry,parts:cassetteComponents(part.geometry,part.name,bottom,top),position,normal});
          manager.register(part.geometry,part.name);
          const mesh=new THREE.Mesh(part.geometry,plain);mesh.userData.surface=part.name;mesh.frustumCulled=false;selected.add(mesh);
          if(arraySurfaces.has(part.name)){const batch=new THREE.InstancedMesh(part.geometry,plain,1);batch.frustumCulled=false;arrays.push(batch);}
        }
        const label=new THREE.Mesh(new THREE.PlaneGeometry(.99,.46),plain);label.position.set(-1.36,3.04,.255);label.userData.labelOriginalY=3.04;selected.add(label);
        const outgoing=selected.clone(true);outgoing.position.x=6;
        const scene=new THREE.Scene();scene.background=new THREE.Color(0xe7e9e5);scene.add(selected,outgoing,...arrays);
        const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(1440,900);renderer.setPixelRatio(1);renderer.info.autoReset=true;
        document.querySelector('#canvas').append(renderer.domElement);
        const camera=new THREE.OrthographicCamera(-10.2,10.2,9,-3,.1,100);camera.position.set(0,0,25);camera.updateMatrixWorld(true);
        const instance=new THREE.Matrix4();
        const place=height=>{
          manager.update(height);selected.scale.y=outgoing.scale.y=height;manager.placeLabel(selected);manager.placeLabel(outgoing);
          for(const batch of arrays){instance.makeScale(1,height,1);instance.setPosition(-6,0,0);batch.setMatrixAt(0,instance);batch.instanceMatrix.needsUpdate=true;}
          scene.updateMatrixWorld(true);
        };
        const renderCount=()=>{renderer.render(scene,camera);return {...renderer.info.render};};
        place(1);const countBefore=renderCount();place(h);const countAfter=renderCount();
        const componentResults=[];let maxVertexError=0,maxNormalError=0,sharedChecks=0;
        for(const snapshot of snapshots){
          const {geometry,position:original,normal:originalNormal,parts,name}=snapshot,p=geometry.getAttribute('position'),n=geometry.getAttribute('normal');
          const selectedMesh=selected.children.find(mesh=>mesh.geometry===geometry),outgoingMesh=outgoing.children.find(mesh=>mesh.geometry===geometry);
          if(selectedMesh?.geometry===outgoingMesh?.geometry)sharedChecks++;
          const batch=arrays.find(mesh=>mesh.geometry===geometry);if(batch)sharedChecks++;
          for(const component of parts){
            if(component.anchor===null)continue;
            const min=new THREE.Vector3(Infinity,Infinity,Infinity),max=new THREE.Vector3(-Infinity,-Infinity,-Infinity);
            let error=0;
            for(const i of component.vertices){
              const point=new THREE.Vector3(p.getX(i),p.getY(i)*h,p.getZ(i));min.min(point);max.max(point);
              const expected=new THREE.Vector3(original[i*3],original[i*3+1]+(h-1)*component.anchor,original[i*3+2]);
              error=Math.max(error,point.distanceTo(expected));
              const normal=new THREE.Vector3(n.getX(i),n.getY(i)/h,n.getZ(i)).normalize();
              const expectedNormal=new THREE.Vector3(originalNormal[i*3],originalNormal[i*3+1],originalNormal[i*3+2]).normalize();
              maxNormalError=Math.max(maxNormalError,normal.distanceTo(expectedNormal));
              for(const mesh of [selectedMesh,outgoingMesh]){
                const world=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld).sub(mesh.parent.position);
                maxVertexError=Math.max(maxVertexError,world.distanceTo(expected));
              }
              if(batch){batch.getMatrixAt(0,instance);const world=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(instance);world.x+=6;maxVertexError=Math.max(maxVertexError,world.distanceTo(expected));}
            }
            maxVertexError=Math.max(maxVertexError,error);
            componentResults.push({surface:name,anchor:component.anchor,vertices:component.vertices.length,originalMin:component.min.toArray(),originalMax:component.max.toArray(),originalSize:component.max.clone().sub(component.min).toArray(),worldMin:min.toArray(),worldMax:max.toArray(),worldSize:max.clone().sub(min).toArray(),error});
          }
        }
        const fasteners=componentResults.filter(part=>part.surface==='Titanium_Fasteners').map(part=>({...part,bottomGap:part.worldMin[1]-bottom*h,topGap:top*h-part.worldMax[1]}));
        const printed=componentResults.find(part=>part.surface==='Printed_Label');
        const labelCenter=new THREE.Vector3();label.getWorldPosition(labelCenter);
        const labelBounds=new THREE.Box3().setFromObject(label),labelSize=labelBounds.getSize(new THREE.Vector3());
        const expectedLabelCenter=new THREE.Vector3(-1.36,3.04+(h-1)*top,.255);
        const labelResult={center:labelCenter.toArray(),expectedCenter:expectedLabelCenter.toArray(),size:labelSize.toArray(),printedCenter:[(printed.worldMin[0]+printed.worldMax[0])/2,(printed.worldMin[1]+printed.worldMax[1])/2],error:labelCenter.distanceTo(expectedLabelCenter)};
        place(1);const restored=[];
        for(const snapshot of snapshots){
          const original=originals.get(snapshot.geometry),p=snapshot.geometry.getAttribute('position').array,n=snapshot.geometry.getAttribute('normal').array;
          const a=new Uint8Array(original.position.buffer),b=new Uint8Array(p.buffer,p.byteOffset,p.byteLength),c=new Uint8Array(original.normal.buffer),d=new Uint8Array(n.buffer,n.byteOffset,n.byteLength);
          restored.push({surface:snapshot.name,positionBytesEqual:a.length===b.length&&a.every((v,i)=>v===b[i]),normalBytesEqual:c.length===d.length&&c.every((v,i)=>v===d[i])});
        }
        const countRestored=renderCount();
        const result={bottom,top,height:h,primitiveCount:source.length,arrayCount:arrays.length,sharedChecks,rigidComponentCount:componentResults.length,maxVertexError,maxNormalError,components:componentResults,fasteners,label:labelResult,restored,draws:{before:countBefore,after:countAfter,restored:countRestored},labelRestored:{position:label.position.toArray(),scale:label.scale.toArray()}};
        scene.clear();plain.dispose();
        const comparison=new THREE.Scene();comparison.background=new THREE.Color(0xd6d9d6);
        comparison.add(new THREE.HemisphereLight(0xffffff,0x60665d,2.7));
        const key=new THREE.DirectionalLight(0xffffff,4);key.position.set(-5,10,15);comparison.add(key);
        const fill=new THREE.DirectionalLight(0xb9d4ed,1.6);fill.position.set(10,5,6);comparison.add(fill);
        const colors={Internal_Ceramic:0xb4b1a9,Subsurface_Optics:0x85796b,Optical_Edges:0xc6aa86,Optical_Film_Edge:0x917b60,Amber_Optical_Inlay:0xc89142,Optical_Film:0x929e9a,Titanium_Fasteners:0x4d5755,Case_Engraving:0x65726b,Case_Engraving_Highlight:0x969f97,Moulded_Lettering:0x5f6964,Champagne_Index:0xd5b665,Printed_Label:0xdddcd5,Index_Inlay:0x596d62};
        const createInspection=(kind,x)=>{
          const group=new THREE.Group();group.position.x=x;group.scale.y=kind==='original'?1:h;
          const height=new ArchiveShellHeight(bottom,top);
          for(const part of source){
            const geometry=part.geometry.clone(),name=part.name;
            const mat=new THREE.MeshPhysicalMaterial({color:colors[name]??0xf2f2e9,roughness:.44,metalness:name.includes('Optical')?.12:0,side:THREE.DoubleSide});
            if(name==='Frosted_Polymer'){mat.transmission=.92;mat.roughness=.12;mat.thickness=.06;mat.ior=1.42;mat.transparent=true;mat.opacity=.3;mat.depthWrite=false;}
            if(name==='Ivory_Edges'){mat.transmission=.2;mat.roughness=.3;mat.color.set(0xcbd0c7);}
            if(name==='Optical_Diffuser'){mat.color.set(0xe3e5df);mat.roughness=.8;}
            if(kind==='fixed')height.register(geometry,name);
            group.add(new THREE.Mesh(geometry,mat));
          }
          if(kind==='fixed')height.update(h);
          comparison.add(group);
        };
        createInspection('original',-6);createInspection('stretched',0);createInspection('fixed',6);
        renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
        const inspectionCamera=new THREE.OrthographicCamera(-10.4,10.4,6.8,-6.2,.1,100);
        const setView=angle=>{
          inspectionCamera.position.set(angle?5:0,angle?7:3.05,28);inspectionCamera.lookAt(0,3.05,0);inspectionCamera.updateProjectionMatrix();
          renderer.render(comparison,inspectionCamera);
          const target=new THREE.WebGLRenderTarget(144,90);renderer.setRenderTarget(target);renderer.render(comparison,inspectionCamera);const pixels=new Uint8Array(144*90*4);renderer.readRenderTargetPixels(target,0,0,144,90,pixels);renderer.setRenderTarget(null);target.dispose();
          let varying=0;for(let i=0;i<pixels.length;i+=4)if(Math.abs(pixels[i]-pixels[0])+Math.abs(pixels[i+1]-pixels[1])+Math.abs(pixels[i+2]-pixels[2])>30)varying++;
          renderer.render(comparison,inspectionCamera);return {varying,total:144*90};
        };
        result.visual=setView(false);window.shellView=setView;return result;
      };
    `,
  }, bundle: true, write: false, format: 'iife', platform: 'browser',
});
const html = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#d6d9d6;color:#202620;font:14px Arial}header{display:grid;grid-template-columns:repeat(3,1fr);height:66px;align-items:center;text-align:center}header strong{font-size:18px;display:block;margin-bottom:5px}#canvas canvas{display:block;width:1440px;height:900px}</style></head><body><header><div><strong>ORIGINAL</strong>Height 1.00</div><div><strong>UNIFORM STRETCH</strong>Height 1.65 / distorted details</div><div><strong>SHELL-ONLY HEIGHT</strong>Height 1.65 / rigid anchored details</div></header><div id="canvas"></div><script src="/bundle.js"></script></body></html>`;
const server = createServer((req, res) => {
  if (req.url === '/model.glb') { res.writeHead(200, { 'Content-Type': 'model/gltf-binary' }); res.end(glb); }
  else if (req.url === '/bundle.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); res.end(bundle.outputFiles[0].text); }
  else { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(html); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 966 } });
  const errors = [];page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const result = await page.evaluate(() => window.checkShellHeight());
  result.glbSha256 = createHash('sha256').update(glb).digest('hex');
  await writeFile(`${out}/report.json`, JSON.stringify({ passed: false, result, errors }, null, 2));
  assert.equal(result.primitiveCount, 16);assert.equal(result.arrayCount, 5);assert.equal(result.sharedChecks, 21);
  assert.ok(result.rigidComponentCount > 200);
  assert.ok(result.maxVertexError < 0.000002, `Vertex deviation ${result.maxVertexError}`);
  assert.ok(result.maxNormalError < 0.000001, `Normal deviation ${result.maxNormalError}`);
  for (const component of result.components) for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs(component.worldSize[axis] - component.originalSize[axis]) < .000002, `${component.surface} axis ${axis}`);
  assert.equal(result.fasteners.length, 2);
  for (const fastener of result.fasteners) {
    assert.ok(Math.abs(fastener.worldSize[0] - .12) < .00001);
    assert.ok(Math.abs(fastener.worldSize[1] - .12) < .00001);
    const top = fastener.anchor > 1;
    assert.ok(Math.abs((top ? fastener.topGap : fastener.bottomGap) - (top ? result.top - fastener.originalMax[1] : fastener.originalMin[1] - result.bottom)) < .000002);
  }
  assert.ok(result.label.error < .000002);
  assert.ok(Math.abs(result.label.center[1] - result.label.printedCenter[1]) < .000002);
  assert.ok(Math.abs(result.label.size[0] - .99) < .000001 && Math.abs(result.label.size[1] - .46) < .000001);
  assert.deepEqual(result.labelRestored.position, [-1.36, 3.04, .255]);assert.deepEqual(result.labelRestored.scale, [1, 1, 1]);
  for (const geometry of result.restored) { assert.equal(geometry.positionBytesEqual, true, geometry.surface);assert.equal(geometry.normalBytesEqual, true, geometry.surface); }
  assert.equal(result.draws.before.calls, result.draws.after.calls);assert.equal(result.draws.before.calls, result.draws.restored.calls);
  assert.equal(result.draws.before.triangles, result.draws.after.triangles);
  assert.ok(result.visual.varying > 1000 && result.visual.varying < result.visual.total, JSON.stringify(result.visual));
  await page.screenshot({ path: `${out}/shell-height-front.png` });
  result.angledVisual = await page.evaluate(() => window.shellView(true));
  assert.ok(result.angledVisual.varying > 1000);
  await page.screenshot({ path: `${out}/shell-height-angled.png` });
  assert.equal(errors.length, 0, errors.join('\n'));
  await writeFile(`${out}/report.json`, JSON.stringify({ passed: true, result, errors }, null, 2));
  console.log(JSON.stringify({ passed: true, rigidComponents: result.rigidComponentCount, sharedChecks: result.sharedChecks, drawCalls: result.draws.before.calls, maxVertexError: result.maxVertexError, output: out }));
} finally { await browser.close();await new Promise(resolve => server.close(resolve)); }

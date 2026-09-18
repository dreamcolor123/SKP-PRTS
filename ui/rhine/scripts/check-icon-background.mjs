import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url);
const {PNG}=require(process.env.SKP_PNGJS_PATH||'pngjs');
const out=process.env.SKP_ICON_QA_OUTPUT||'.tools/icon-background';
const files=[];
for(const density of ['mdpi','hdpi','xhdpi','xxhdpi','xxxhdpi'])for(const name of ['ic_launcher','ic_launcher_round','ic_launcher_foreground'])files.push(`../../app/src/main/res/mipmap-${density}/${name}.png`);
for(const name of ['apple-touch-icon','icon-192','icon-512','icon-maskable-512'])files.push(`public/icons/${name}.png`);
const results=[];
for(const file of files){
 const png=PNG.sync.read(await readFile(file)),foreground=file.includes('foreground');
 const rgba=(x,y)=>Array.from(png.data.subarray((y*png.width+x)*4,(y*png.width+x)*4+4));
 const corners=[[0,0],[png.width-1,0],[0,png.height-1],[png.width-1,png.height-1]].map(([x,y])=>rgba(x,y));
 for(const pixel of corners){if(foreground)assert.equal(pixel[3],0,file);else assert.deepEqual(pixel,[17,24,27,255],file);}
 let purple=0;
 for(let i=0;i<png.data.length;i+=4){const [r,g,b,a]=png.data.subarray(i,i+4);if(a>220&&b>r+20&&r>g+30)purple++;}
 assert.ok(purple>png.width*png.height*.04,`${file}: purple mark missing`);
 results.push({file:resolve(file),width:png.width,height:png.height,corners,purple});
}
await mkdir(out,{recursive:true});await writeFile(`${out}/report.json`,JSON.stringify({passed:true,background:'#11181B',results},null,2));
console.log(JSON.stringify({passed:true,background:'#11181B',images:results.length,out}));

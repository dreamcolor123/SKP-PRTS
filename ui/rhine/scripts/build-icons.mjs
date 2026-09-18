// Rasterize the user-authored mark; native and web icons share paths and framing.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { appIconSvg } from "./build-native-logo.mjs";
import { labelMarkSvg } from "../src/brand.ts";
const {default:sharp}=await import(process.env.SHARP_MODULE ? pathToFileURL(resolve(process.env.SHARP_MODULE)).href : 'sharp');
const root=resolve(dirname(fileURLToPath(import.meta.url)), '..');
const svg=appIconSvg(true,512);
await mkdir(resolve(root,'public/icons'),{recursive:true});
await writeFile(resolve(root,'public/icons/app-icon.svg'),svg);
await writeFile(resolve(root,'public/favicon.svg'),labelMarkSvg);
for(const [name,size] of [['apple-touch-icon',180],['icon-192',192],['icon-512',512],['icon-maskable-512',512]])
  await sharp(Buffer.from(name === 'icon-maskable-512' ? appIconSvg(true,512,true) : svg)).resize(size,size).png().toFile(resolve(root,`public/icons/${name}.png`));
console.log('User-authored SK mark exported to web icons and favicon.');

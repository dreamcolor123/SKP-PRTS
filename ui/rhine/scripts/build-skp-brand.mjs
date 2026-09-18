// Reproducible native/web exports of the original hand-drawn SKRoot Pro identity.
// Optional SHARP_MODULE locates an existing sharp installation; no download occurs.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { bootMarkContour, kernelNodePath, terminalNodePath, brandGlyphs, brandWordmark, labelMarkSvg, logo } from "../src/brand.ts";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const native = resolve(root, "../../app/src/main/res");
const { default: sharp } = await import(process.env.SHARP_MODULE ? pathToFileURL(resolve(process.env.SHARP_MODULE)).href : "sharp");
const save = async (path, value) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, value); };

const artFile = resolve(root, "src/boot-lettering-art.json");
const art = JSON.parse(await readFile(artFile, "utf8"));
const alphabets = new Map();
for (const item of Object.values(art)) {
  const glyphs = alphabets.get(item.weight) || new Map();
  [...item.text].forEach((letter, i) => { if (!glyphs.has(letter)) glyphs.set(letter, item.letters[i]); });
  alphabets.set(item.weight, glyphs);
}
function phrase(text, weight) {
  const glyphs = alphabets.get(weight);
  return { text, weight, units: 1000, letters: [...text].map(letter => {
    if (letter === " ") return { width: .25, path: "" };
    if (weight === "Handmade" || !glyphs?.has(letter)) {
      if (!brandGlyphs[letter]) throw new Error(`Missing ${weight} glyph ${letter}`);
      return { width: .64, path: brandGlyphs[letter], stroke: weight === "Handmade" ? 105 : 85 };
    }
    return glyphs.get(letter);
  }) };
}
art.access = phrase("LOCAL INTERFACE INITIALIZE", "Normal");
art.identity = phrase("UI SESSION : LOCAL DEVICE", "Normal");
art.permission = phrase("LOCAL INTERFACE READY", "Normal");
art.database = phrase("KERNEL MANAGEMENT", "Bold");
art.brand = phrase(brandWordmark, "Handmade");
art.company = phrase(brandWordmark, "Handmade");
await save(artFile, JSON.stringify(art) + "\n");

await save(resolve(root, "public/branding/skroot-pro.svg"), logo + "\n");
await save(resolve(root, "public/branding/skroot-pro-label.svg"), labelMarkSvg + "\n");
const mark = labelMarkSvg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
const iconSvg = (background, size = 108) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 108 108">${background ? '<rect width="108" height="108" fill="#eae5e1"/>' : ''}<g transform="translate(20 38) scale(.22)" color="#080a08">${mark}</g></svg>`;
await save(resolve(root, "public/icons/app-icon.svg"), iconSvg(true, 512));
for (const [name, size] of [["apple-touch-icon",180],["icon-192",192],["icon-512",512],["icon-maskable-512",512]]) {
  await save(resolve(root, `public/icons/${name}.png`), await sharp(Buffer.from(iconSvg(true,size))).png().toBuffer());
}
// Preserve every existing PNG resource name: the APK icon customizer replaces them.
for (const [density, size, foreground] of [["mdpi",48,108],["hdpi",72,162],["xhdpi",96,216],["xxhdpi",144,324],["xxxhdpi",192,432]]) {
  for (const name of ["ic_launcher", "ic_launcher_round"])
    await save(resolve(native, `mipmap-${density}/${name}.png`), await sharp(Buffer.from(iconSvg(true,size))).png().toBuffer());
  await save(resolve(native, `mipmap-${density}/ic_launcher_foreground.png`), await sharp(Buffer.from(iconSvg(false,foreground))).png().toBuffer());
}
const vector = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">
  <group android:translateX="20" android:translateY="38" android:scaleX="0.22" android:scaleY="0.22">
    <path android:name="sk_trace" android:pathData="${bootMarkContour}" android:fillColor="@android:color/transparent" android:strokeColor="@color/skp_brand_ink" android:strokeWidth="22" android:strokeLineJoin="bevel"/>
    <path android:pathData="${kernelNodePath}" android:fillColor="@android:color/transparent" android:strokeColor="@color/skp_brand_ink" android:strokeWidth="5"/>
    <group android:translateX="260" android:translateY="78"><path android:pathData="${terminalNodePath}" android:fillColor="@android:color/transparent" android:strokeColor="@color/skp_brand_ink" android:strokeWidth="5"/></group>
  </group>
</vector>\n`;
await save(resolve(native, "drawable/skp_startup_mark.xml"), vector);
await save(resolve(root, "public/branding/NOTICE.txt"), "SKRoot Pro SK trace, circuit nodes and stencil wordmark are original authored vector geometry for SKP-PRTS. See src/brand.ts. Animation tracks derive from RhineLabUI at 17a16118f31b55b7156b68e89b6fe989408351f0. Existing font artwork outside the product wordmark retains its original notices.\n");
console.log("SKRoot Pro vector identity, phrase art, four web icons, fifteen Android PNGs and Android vector exported.");

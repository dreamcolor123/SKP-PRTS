// Reproducible web exports of the user-supplied SKRoot Pro identity.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { brandGlyphs, brandWordmark, labelMarkSvg, logoSvg } from "../src/brand.ts";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
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

await save(resolve(root, "public/branding/skroot-pro.svg"), logoSvg("sk-static",false) + "\n");
await save(resolve(root, "public/branding/skroot-pro-label.svg"), labelMarkSvg + "\n");
await save(resolve(root, "public/branding/NOTICE.txt"), "SKRoot Pro purple SK logo and 1.3-second assembly / 4.2-second highlight motion supplied by the project owner on 2026-09-19. Canonical input: branding-reference/skroot-pro-preview.html (SHA-256 d9ab89839112c72f3626d81ea79bb47e29a6666a7f88604a797358e30f4deaee). Source paths, gradient and easing are retained in src/user-logo.ts. Existing wordmark, fonts and surrounding RhineLabUI animation retain their notices.\n");
console.log("User SK logo, model label and unchanged phrase art exported. Native and launcher assets: build-native-logo.mjs and build-icons.mjs.");

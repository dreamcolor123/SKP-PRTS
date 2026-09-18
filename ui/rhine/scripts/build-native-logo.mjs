// Native assets are derived from the same user-authored paths as the web mark.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { brandParts, brandGradient } from "../src/brand.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const native = resolve(root, "../../app/src/main/res");
const save = async (path, value) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value);
};
const xmlHeader = '<?xml version="1.0" encoding="utf-8"?>\n';
const android = 'xmlns:android="http://schemas.android.com/apk/res/android"';
const partNames = ["s", "stem", "bridge", "leg"];
const paper = "#11181B";
const gradientSvg = `<defs><linearGradient id="ink" gradientUnits="userSpaceOnUse" x1="61" y1="69" x2="223" y2="69"><stop stop-color="${brandGradient.start}"/><stop offset="1" stop-color="${brandGradient.end}"/></linearGradient></defs>`;
const pathsSvg = partNames.map(name => `<path d="${brandParts[name]}"/>`).join("");

// Adaptive foreground stays within the 66dp safe zone; legacy icons use 78dp.
export function appIconSvg(background = true, size = 512, adaptive = !background) {
  const scale = (adaptive ? 64 : 78) / 161.2;
  const x = 54 - 141.8 * scale;
  const y = 54 - 68.75 * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 108 108">${gradientSvg}${background ? `<rect width="108" height="108" fill="${paper}"/>` : ""}<g transform="translate(${x} ${y}) scale(${scale})" fill="url(#ink)">${pathsSvg}</g></svg>`;
}

const nativeGradient = `<aapt:attr name="android:fillColor"><gradient android:type="linear" android:startX="61" android:startY="69" android:endX="223" android:endY="69"><item android:offset="0" android:color="${brandGradient.start}"/><item android:offset="1" android:color="${brandGradient.end}"/></gradient></aapt:attr>`;
function vector(animated) {
  const part = name => `<path android:name="sk_${name}" android:pathData="${brandParts[name]}" android:fillAlpha="${animated && name !== "bridge" ? 0 : 1}">${nativeGradient}</path>`;
  const bridgeClip = `M61 30H${animated ? "61" : "227"}V106H61Z`;
  return `${xmlHeader}<vector ${android} xmlns:aapt="http://schemas.android.com/aapt" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">
  <group android:translateX="-2.72" android:translateY="26.5" android:scaleX="0.4" android:scaleY="0.4">
    <group android:name="sk_s_entry" android:translateX="${animated ? -14 : 0}">${part("s")}</group>
    <group android:name="sk_stem_entry" android:translateY="${animated ? -12 : 0}">${part("stem")}</group>
    <group><clip-path android:name="sk_bridge_reveal" android:pathData="${bridgeClip}"/>${part("bridge")}</group>
    <group android:name="sk_leg_entry" android:translateX="${animated ? 9 : 0}" android:translateY="${animated ? 10 : 0}">${part("leg")}</group>
  </group>
</vector>\n`;
}

function animator(property, from, to, duration, delay = 0, linear = false, path = false) {
  return `<objectAnimator android:propertyName="${property}" android:valueFrom="${from}" android:valueTo="${to}" android:valueType="${path ? "pathType" : "floatType"}" android:startOffset="${delay}" android:duration="${duration}" android:interpolator="${linear ? "@android:interpolator/linear" : "@interpolator/skp_logo_assemble"}"/>`;
}

export async function generateNativeLogo() {
  const { default: sharp } = await import(process.env.SHARP_MODULE ? pathToFileURL(resolve(process.env.SHARP_MODULE)).href : "sharp");
  await save(resolve(native,"values/ic_launcher_background.xml"),`${xmlHeader}<resources>\n    <color name="ic_launcher_background">${paper}</color>\n</resources>\n`);
  // Preserve resource names used by the application's local icon customizer.
  for (const [density, size, foreground] of [["mdpi", 48, 108], ["hdpi", 72, 162], ["xhdpi", 96, 216], ["xxhdpi", 144, 324], ["xxxhdpi", 192, 432]]) {
    for (const name of ["ic_launcher", "ic_launcher_round"])
      await save(resolve(native, `mipmap-${density}/${name}.png`), await sharp(Buffer.from(appIconSvg(true, size))).png().toBuffer());
    await save(resolve(native, `mipmap-${density}/ic_launcher_foreground.png`), await sharp(Buffer.from(appIconSvg(false, foreground))).png().toBuffer());
  }
  await save(resolve(native, "drawable/skp_startup_mark.xml"), vector(false));
  await save(resolve(native, "drawable/skp_startup_motion.xml"), vector(true));
  await save(resolve(native, "interpolator/skp_logo_assemble.xml"), `${xmlHeader}<pathInterpolator ${android} android:controlX1="0.22" android:controlY1="1" android:controlX2="0.36" android:controlY2="1"/>\n`);
  const animations = {
    s_entry: animator("translateX", -14, 0, 700) + animator("translateY", 0, 0, 1300),
    s_alpha: animator("fillAlpha", 0, 1, 700, 0, true),
    stem_entry: animator("translateY", -12, 0, 764, 216),
    stem_alpha: animator("fillAlpha", 0, 1, 764, 216, true),
    bridge_reveal: animator("pathData", "M61 30H61V106H61Z", "M61 30H227V106H61Z", 874, 276, false, true),
    leg_entry: animator("translateX", 9, 0, 500, 750) + animator("translateY", 10, 0, 500, 750),
    leg_alpha: animator("fillAlpha", 0, 1, 500, 750, true),
  };
  for (const [name, content] of Object.entries(animations))
    await save(resolve(native, `animator/skp_logo_${name}.xml`), `${xmlHeader}<set ${android} android:ordering="together">${content}</set>\n`);
  const targets = [
    ["sk_s_entry", "s_entry"], ["sk_s", "s_alpha"],
    ["sk_stem_entry", "stem_entry"], ["sk_stem", "stem_alpha"],
    ["sk_bridge_reveal", "bridge_reveal"],
    ["sk_leg_entry", "leg_entry"], ["sk_leg", "leg_alpha"],
  ];
  await save(resolve(native, "drawable/skp_startup_animated.xml"), `${xmlHeader}<animated-vector ${android} android:drawable="@drawable/skp_startup_motion">\n${targets.map(([name, animation]) => `  <target android:name="${name}" android:animation="@animator/skp_logo_${animation}"/>`).join("\n")}\n</animated-vector>\n`);
  console.log("User-authored SK logo: fifteen Android icons, static vector and one-shot 1300ms assembly exported.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await generateNativeLogo();

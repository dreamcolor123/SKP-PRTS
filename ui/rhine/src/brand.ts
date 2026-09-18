import { logoSvg } from "./user-logo.ts";
export { brandParts, brandGradient, logoSvg } from "./user-logo.ts";

// Compact square-ended stencil alphabet for the handmade product wordmark.
export const brandGlyphs: Record<string, string> = {
  S: "M510 160H175L90 245V365L175 450H425L510 535V655L425 740H90",
  K: "M100 160V740M520 160L100 470L520 740",
  R: "M100 740V160H420L510 250V360L420 450H100M330 450L520 740",
  O: "M185 160H415L510 255V645L415 740H185L90 645V255Z",
  T: "M70 160H530M300 160V740",
  P: "M100 740V160H420L510 250V360L420 450H100",
  L: "M100 160V740H520",
  G: "M510 250L420 160H180L90 250V650L180 740H420L510 650V450H320",
};
export const brandWordmark = "SKROOT PRO";
const wordmarkPaths = [...brandWordmark].map((letter, index) =>
  letter === " " ? "" : `<path data-brand-letter="${index}" transform="translate(${index * 650} 0)" d="${brandGlyphs[letter]}"/>`,
).join("");
export const wordmark = `<g class="sk-wordmark" fill="none" stroke="currentColor" stroke-width="100" stroke-linejoin="bevel" stroke-linecap="square">${wordmarkPaths}</g>`;
export const labelMarkSvg = logoSvg("sk-label", false, true);
export const logo = logoSvg("sk-logo");

const analysisPositions = [2, 28, 55, 81, 103, 129, 154, 166];
export const brandHeading = `<h1>SKROOT PRO</h1><div>KERNEL MANAGEMENT INTERFACE</div><p><span class="brand-analysis" role="img" aria-label="ANALYSIS">${[..."ANALYSIS"].map((letter, i) => `<span aria-hidden="true" style="left:${analysisPositions[i]}px">${letter}</span>`).join("")}</span> <b>OS</b></p>`;

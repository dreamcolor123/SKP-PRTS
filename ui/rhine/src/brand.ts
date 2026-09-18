// Original SKRoot Pro identity: one continuous SK trace and two kernel terminals.
// Coordinates are authored geometry, not text converted from an installed font.
// The fixed 310 x 185 box preserves the opening composition and tracks.
export const bootMarkContour =
  "M132 24H48L24 48V60L48 84H108L132 108V128H24H176V24V78L282 24L176 78L282 128";
export const kernelNodePath = "M59 45H79V65H59ZM63 39V45M75 39V45M63 65V71M75 65V71M53 49H59M53 61H59M79 49H85M79 61H85";
export const terminalNodePath = "M-18 -9L-8 0L-18 9M-2 9H18";

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
const markPaths = `<path class="sk-contour" d="${bootMarkContour}" fill="none" stroke="currentColor" stroke-width="22" stroke-linejoin="bevel"/><g class="sk-terminals" fill="none" stroke="currentColor" stroke-width="5"><path class="sk-kernel" d="${kernelNodePath}"/><path class="sk-terminal" transform="translate(260 78)" d="${terminalNodePath}"/></g>`;
export const labelMarkSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 310 145" color="#080a08" role="img" aria-label="SKRoot Pro">${markPaths}</svg>`;
export const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 310 185" aria-label="SKRoot Pro" role="img">${markPaths}<g transform="translate(20 143) scale(.042)">${wordmark}</g></svg>`;

const analysisPositions = [2, 28, 55, 81, 103, 129, 154, 166];
export const brandHeading = `<h1>SKROOT PRO</h1><div>KERNEL MANAGEMENT INTERFACE</div><p><span class="brand-analysis" role="img" aria-label="ANALYSIS">${[..."ANALYSIS"].map((letter, i) => `<span aria-hidden="true" style="left:${analysisPositions[i]}px">${letter}</span>`).join("")}</span> <b>OS</b></p>`;

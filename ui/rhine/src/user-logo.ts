// Geometry and motion supplied by the user in branding-reference/skroot-pro-preview.html.
export const brandParts = {
  s: "M73.2 34.5H136.6V53.2H80.1V60.3H130.8C138.8 60.3 143 64.7 143 72.6V78.8H73.2C65.3 78.8 61.2 74.7 61.2 66.9V46.4C61.2 38.5 65.3 34.5 73.2 34.5Z",
  stem: "M154.3 34.5H173V57.4L154.3 80.6Z",
  bridge: "M66.6 84.3H154.4L196 34.5H222.4L167.2 103H66.6Q61.2 103 61.2 97.6V89.7Q61.2 84.3 66.6 84.3Z",
  leg: "M198.6 72.2L222.4 103H198.6L186.7 88Z",
} as const;
export const brandGradient = { start: "#7C3AED", end: "#B16CF5" };
const clamp = (value: number) => Math.max(0, Math.min(1, value));
function ease(value: number) {
  const x = clamp(value);
  if (x === 0 || x === 1) return x;
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i++) {
    const u = (lo + hi) / 2;
    const bx = 3 * (1-u) * (1-u) * u * .22 + 3 * (1-u) * u * u * .36 + u * u * u;
    if (bx < x) lo = u; else hi = u;
  }
  const u = (lo + hi) / 2;
  return 1 - (1-u) * (1-u) * (1-u);
}
export function logoMotion(seconds: number) {
  const time = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const a = clamp(time / .7), b = clamp((time / .98 - .22) / .78);
  const c = clamp((time / 1.15 - .24) / .76), d = clamp((time / 1.25 - .6) / .4);
  const phase = time < 1.3 ? 0 : ((time - 1.3) % 4.2) / 4.2;
  return {
    sOpacity:a, sX:-14 * (1-ease(a)), stemOpacity:b, stemY:-12 * (1-ease(b)),
    bridgeWidth:166 * ease(c), legOpacity:d, legX:9 * (1-ease(d)), legY:10 * (1-ease(d)),
    highlightX:time < 1.3 ? -150 : -150 + 390 * clamp((phase-.08)/.4), phase,
  };
}

export function logoSvg(identity: string, animated = true, compact = false) {
  const id = identity.replace(/[^a-zA-Z0-9_-]/g, "-");
  const paths = Object.entries(brandParts).map(([name,d]) => `<path id="${id}-${name}" d="${d}"/>`).join("");
  const uses = Object.keys(brandParts).map(name => `<use href="#${id}-${name}"/>`).join("");
  const mark = animated ? `<g data-logo-part="s"><use href="#${id}-s"/></g><g data-logo-part="stem"><use href="#${id}-stem"/></g><g clip-path="url(#${id}-bridge-reveal)"><use href="#${id}-bridge"/></g><g data-logo-part="leg"><use href="#${id}-leg"/></g><g clip-path="url(#${id}-mark-clip)"><rect data-logo-highlight="" x="-150" y="30" width="90" height="76" fill="url(#${id}-sheen)"/></g>` : uses;
  return `<svg class="sk-user-logo" xmlns="http://www.w3.org/2000/svg" viewBox="${compact?'61.2 34.5 161.2 68.5':'0 0 240 128'}" role="img" aria-label="SKRoot Pro" data-user-logo="${animated?'animated':'static'}">
    <defs><linearGradient id="${id}-ink" gradientUnits="userSpaceOnUse" x1="61" y1="69" x2="223" y2="69"><stop stop-color="${brandGradient.start}"/><stop offset="1" stop-color="${brandGradient.end}"/></linearGradient>${paths}
    <linearGradient id="${id}-sheen" x1="0" y1="0" x2="1" y2="0"><stop stop-color="white" stop-opacity="0"/><stop offset=".5" stop-color="white" stop-opacity=".38"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient>
    <clipPath id="${id}-mark-clip">${uses}</clipPath><clipPath id="${id}-bridge-reveal"><rect data-logo-bridge="" x="61" y="30" width="166" height="76"/></clipPath></defs>
    <g ${compact?'':'transform="translate(-22 -4.5)"'} fill="url(#${id}-ink)">${mark}</g></svg>`;
}

/** One shared app clock drives all instances; no independent RAF or timer. */
export class UserLogo {
  readonly element: SVGSVGElement;
  private s: SVGGElement;
  private stem: SVGGElement;
  private leg: SVGGElement;
  private bridge: SVGRectElement;
  private highlight: SVGRectElement;
  constructor(element: SVGSVGElement) {
    this.element=element;
    this.s=element.querySelector('[data-logo-part=s]')!;
    this.stem=element.querySelector('[data-logo-part=stem]')!;
    this.leg=element.querySelector('[data-logo-part=leg]')!;
    this.bridge=element.querySelector('[data-logo-bridge]')!;
    this.highlight=element.querySelector('[data-logo-highlight]')!;
    this.update(0);
  }
  update(time: number, reduced = false) {
    const m=logoMotion(reduced?1.3:time);
    this.element.dataset.motion=reduced?'static':'play';
    this.s.setAttribute('opacity',String(m.sOpacity));this.s.setAttribute('transform',`translate(${m.sX} 0)`);
    this.stem.setAttribute('opacity',String(m.stemOpacity));this.stem.setAttribute('transform',`translate(0 ${m.stemY})`);
    this.bridge.setAttribute('width',String(m.bridgeWidth));
    this.leg.setAttribute('opacity',String(m.legOpacity));this.leg.setAttribute('transform',`translate(${m.legX} ${m.legY})`);
    this.highlight.setAttribute('x',String(m.highlightX));
  }
}

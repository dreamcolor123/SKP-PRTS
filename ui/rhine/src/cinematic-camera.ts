import { sampleCurve } from "./decryption.ts";

// Shared Hermite tangents keep position and velocity continuous across shots.
// Model wave/extraction clocks stay independent of this camera-only trajectory.
const tracks = {
  yaw: [[21.9,89],[22.7,87],[24.2,67],[25.5,61],[26.5,58],[27.3,56],[28.6,49],[30,38],[32,25],[34,20],[35,18]],
  elevation: [[21.9,3],[22.7,38],[24.2,30],[25.5,23],[26.5,18],[27.3,17],[28.6,15.5],[30,14.5],[32,14],[35,13.8]],
  distance: [[21.9,28],[22.7,31],[24.2,36],[25.5,95],[26.5,130],[27.3,124],[28.6,108],[30,88],[32,77],[34,74],[35,72]],
  span: [[21.9,10.8],[22.7,10.7],[24.2,10.3],[25.5,8.8],[26.5,7.33],[27.3,7.05],[28.6,6.7],[30,6.1],[32,5.98],[34,5.93],[35,5.9]],
  aimY: [[21.9,-2.55],[22.7,-2.4],[24.2,-2.15],[25.5,-.8],[26.5,-.045],[35,-.045]],
  aimZ: [[21.9,2.48],[24.2,2.48],[25.5,1.5],[26.5,.481],[35,.481]],
  pan: [[21.9,0],[24.2,0],[25,-1.8],[26.3,0],[35,0]],
  anchorMix: [[21.9,0],[24.4,0],[25.05,0],[25.8,.82],[26.5,1],[35,1]],
  screenX: [[21.9,840],[25.05,840],[25.5,780],[26.5,550],[27.3,518],[28.6,420],[30,466],[32,561],[35,618]],
  screenY: [[21.9,340],[25.05,340],[25.5,325],[26.5,300],[27.3,288],[28.6,322],[30,314],[32,298],[35,287]],
} satisfies Record<string, [number,number][]>;

export const CINEMATIC_CAMERA_KNOTS = [...new Set(Object.values(tracks).flatMap(points=>points.map(point=>point[0])))].sort((a,b)=>a-b);
export function cinematicCameraPose(time:number) {
  return Object.fromEntries(Object.entries(tracks).map(([name,knots])=>[name,sampleCurve(knots,time)])) as Record<keyof typeof tracks,number>;
}

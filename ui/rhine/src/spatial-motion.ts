export type Tilt = { x: number; y: number };
export const WORKING_HEIGHT = 1.65;
export const FACE_WIDTH = 4.56;
export const FACE_HEIGHT = 3.22;
export const FACE_DEPTH = .255;
export function boundedTilt(x: number, y: number): Tilt {
  const finite = (value: number) => Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
  return { x: finite(x), y: finite(y) };
}
export function followTilt(current: Tilt, target: Tilt, seconds: number, enabled: boolean): Tilt {
  if (!enabled) return { x: 0, y: 0 };
  const amount = 1 - Math.exp(-Math.max(0, Math.min(.1, seconds)) * 12);
  return { x: current.x+(target.x-current.x)*amount, y: current.y+(target.y-current.y)*amount };
}

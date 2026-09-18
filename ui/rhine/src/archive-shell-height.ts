import * as THREE from "three";

export interface CassetteComponent {
  vertices: number[];
  min: THREE.Vector3;
  max: THREE.Vector3;
  anchor: number | null;
}

const shellSurfaces = new Set(["Frosted_Polymer", "Ivory_Edges", "Optical_Diffuser"]);

/** Weld export seams once, so one rigid decoration always has one height anchor. */
export function cassetteComponents(geometry: THREE.BufferGeometry, surface: string, bottom: number, top: number): CassetteComponent[] {
  const positions = geometry.getAttribute("position");
  const parent = Int32Array.from({length: positions.count}, (_, i) => i);
  const find = (value: number): number => {
    while (parent[value] !== value) { parent[value] = parent[parent[value]]; value = parent[value]; }
    return value;
  };
  const join = (a: number, b: number) => { parent[find(a)] = find(b); };
  const welded = new Map<string, number>();
  for (let i = 0; i < positions.count; i++) {
    const key = [positions.getX(i), positions.getY(i), positions.getZ(i)].map(v => Math.round(v * 100_000)).join(",");
    const previous = welded.get(key);
    if (previous !== undefined) join(i, previous); else welded.set(key, i);
  }
  const index = geometry.index;
  for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
    const a = index ? index.getX(i) : i, b = index ? index.getX(i + 1) : i + 1, c = index ? index.getX(i + 2) : i + 2;
    join(a, b); join(a, c);
  }
  const components = new Map<number, CassetteComponent>();
  const point = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    const root = find(i);
    let component = components.get(root);
    if (!component) {
      component = {vertices: [], min: new THREE.Vector3(Infinity, Infinity, Infinity), max: new THREE.Vector3(-Infinity, -Infinity, -Infinity), anchor: null};
      components.set(root, component);
    }
    point.fromBufferAttribute(positions, i);
    component.vertices.push(i); component.min.min(point); component.max.max(point);
  }
  const middle = (bottom + top) / 2;
  for (const component of components.values()) {
    const {min, max} = component;
    if (shellSurfaces.has(surface)) continue;
    component.anchor = middle;
    if (surface === "Printed_Label" || surface === "Index_Inlay") component.anchor = top;
    else if (surface === "Champagne_Index") component.anchor = bottom;
    else if (surface === "Titanium_Fasteners") component.anchor = (min.y + max.y) / 2 > middle ? top : bottom;
    else if (surface === "Internal_Ceramic") {
      if (min.z > .24) component.anchor = top;
      else if (max.y < .8) component.anchor = bottom;
    } else if (surface === "Optical_Edges") {
      if (max.y < .8) component.anchor = bottom;
      else if (min.y > 3.5) component.anchor = top;
      else if (Math.abs((min.x + max.x) / 2) > 2.4 && max.y - min.y > 3) component.anchor = null;
    } else if (surface === "Case_Engraving" || surface === "Case_Engraving_Highlight") {
      if (min.y > 2.7) component.anchor = top;
      else if (max.y < .8) component.anchor = bottom;
    }
  }
  return [...components.values()];
}

/** Shared geometry serves the selected card, the instanced array and returning copies. */
export class ArchiveShellHeight {
  private height = 1;
  private entries: {geometry: THREE.BufferGeometry; positions: Float32Array; normals?: Float32Array; anchors: Float32Array}[] = [];
  constructor(readonly bottom: number, readonly top: number) {}

  register(geometry: THREE.BufferGeometry, surface: string) {
    if (shellSurfaces.has(surface)) return;
    const position = geometry.getAttribute("position"), normal = geometry.getAttribute("normal");
    const positions = new Float32Array(position.count * 3), normals = normal ? new Float32Array(normal.count * 3) : undefined;
    for (let i = 0; i < position.count; i++) {
      positions.set([position.getX(i), position.getY(i), position.getZ(i)], i * 3);
      if (normal) normals!.set([normal.getX(i), normal.getY(i), normal.getZ(i)], i * 3);
    }
    const anchors = new Float32Array(position.count).fill(NaN);
    for (const component of cassetteComponents(geometry, surface, this.bottom, this.top)) {
      if (component.anchor !== null) for (const i of component.vertices) anchors[i] = component.anchor;
    }
    this.entries.push({geometry, positions, normals, anchors});
  }

  update(height: number) {
    if (height === this.height) return;
    this.height = height;
    for (const {geometry, positions, normals, anchors} of this.entries) {
      const position = geometry.getAttribute("position"), normal = geometry.getAttribute("normal");
      for (let i = 0; i < position.count; i++) {
        const anchor = anchors[i];
        if (!Number.isFinite(anchor)) continue;
        const y = positions[i * 3 + 1];
        position.setY(i, height === 1 ? y : (y + (height - 1) * anchor) / height);
        if (normal && normals) {
          const x = normals[i * 3], y = normals[i * 3 + 1], z = normals[i * 3 + 2];
          const length = height === 1 ? 1 : Math.hypot(x, y * height, z) || 1;
          normal.setXYZ(i, x / length, y * height / length, z / length);
        }
      }
      position.needsUpdate = true;
      if (normal) normal.needsUpdate = true;
      geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    }
  }

  placeLabel(group: THREE.Group) {
    for (const mesh of group.children) {
      const originalY = mesh.userData.labelOriginalY;
      if (typeof originalY !== "number") continue;
      mesh.scale.y = 1 / this.height;
      mesh.position.y = (originalY + (this.height - 1) * this.top) / this.height;
    }
  }
}

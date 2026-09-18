import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const file = path.resolve('public/assets/archive-cassette.glb');
const input = await readFile(file);
if (input.readUInt32LE(0) !== 0x46546c67 || input.readUInt32LE(4) !== 2) throw new Error('Expected GLB 2');
let json, binary;
for (let offset = 12; offset < input.length;) {
  const length = input.readUInt32LE(offset), type = input.readUInt32LE(offset + 4);
  const bytes = input.subarray(offset + 8, offset + 8 + length);
  if (type === 0x4e4f534a) json = JSON.parse(bytes.toString('utf8'));
  if (type === 0x004e4942) binary = bytes;
  offset += 8 + length;
}
const widths = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const components = { 5121: [1, 'readUInt8'], 5123: [2, 'readUInt16LE'], 5125: [4, 'readUInt32LE'], 5126: [4, 'readFloatLE'] };
function accessor(index) {
  const a = json.accessors[index], view = json.bufferViews[a.bufferView];
  const [bytes, read] = components[a.componentType], width = widths[a.type];
  const offset = (view.byteOffset || 0) + (a.byteOffset || 0), stride = view.byteStride || bytes * width;
  return Array.from({ length: a.count }, (_, i) => Array.from({ length: width }, (_, j) => binary[read](offset + i * stride + j * bytes)));
}
const round = value => Math.round(value * 100000) / 100000;
const meshes = [];
for (const node of json.nodes) {
  if (node.mesh === undefined) continue;
  if (node.matrix || node.translation || node.rotation || node.scale) throw new Error('Add world-matrix support before analyzing transformed assets');
  for (const primitive of json.meshes[node.mesh].primitives) {
    const positions = accessor(primitive.attributes.POSITION), indices = accessor(primitive.indices).flat();
    const parents = positions.map((_, i) => i), welded = new Map();
    const find = i => { while (parents[i] !== i) { parents[i] = parents[parents[i]]; i = parents[i]; } return i; };
    const union = (a, b) => { parents[find(b)] = find(a); };
    positions.forEach((p, i) => {
      const key = p.map(v => Math.round(v / .00001)).join(',');
      if (welded.has(key)) union(i, welded.get(key)); else welded.set(key, i);
    });
    for (let i = 0; i < indices.length; i += 3) { union(indices[i], indices[i + 1]); union(indices[i], indices[i + 2]); }
    const groups = new Map();
    positions.forEach((p, i) => {
      const id = find(i);
      if (!groups.has(id)) groups.set(id, { vertices: 0, triangles: 0, min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
      const group = groups.get(id);group.vertices++;
      for (let axis = 0; axis < 3; axis++) { group.min[axis] = Math.min(group.min[axis], p[axis]); group.max[axis] = Math.max(group.max[axis], p[axis]); }
    });
    for (let i = 0; i < indices.length; i += 3) groups.get(find(indices[i])).triangles++;
    const parts = [...groups.values()].map(group => ({ ...group, min: group.min.map(round), max: group.max.map(round), center: group.min.map((v, i) => round((v + group.max[i]) / 2)), span: group.min.map((v, i) => round(group.max[i] - v)) })).sort((a, b) => b.triangles - a.triangles);
    meshes.push({ material: json.materials[primitive.material].name.replace(/\.\d+$/, ''), vertices: positions.length, triangles: indices.length / 3, componentCount: parts.length, components: parts });
  }
}
const output = process.env.SKP_CASSETTE_ANALYSIS_OUTPUT || '.tools/cassette-components';
await mkdir(output, { recursive: true });
const result = { source: file, sha256: createHash('sha256').update(input).digest('hex'), weldTolerance: .00001, meshes };
await writeFile(path.join(output, 'components.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ source: result.source, sha256: result.sha256, output: path.resolve(output, 'components.json'), meshes: meshes.map(({ material, vertices, triangles, componentCount }) => ({ material, vertices, triangles, componentCount })) }, null, 2));

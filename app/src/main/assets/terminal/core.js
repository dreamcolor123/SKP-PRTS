import * as THREE from './vendor/three.module.min.js';

// This renderer receives presentation enums only. It never fetches business data.
const STATES = new Set(['unknown', 'loading', 'running', 'outdated', 'pending', 'not_installed', 'fault']);
const canvas = document.querySelector('#core');
window.__terminalRenderState = 'loading';
const params = new URLSearchParams(location.search);
const diagnostics = params.get('diagnostics') === 'true';
let frameProbe = null;
let settings = {
  status: STATES.has(params.get('status')) ? params.get('status') : 'running',
  quality: params.get('quality') === 'full' ? 'full' : 'balanced',
  dark: params.get('dark') === 'true',
  active: params.get('active') !== 'false',
  reducedMotion: params.get('reducedMotion') === 'true',
};
let renderer, scene, camera, device, lid, rotor, innerRotor, glass, signal, metal, paleMetal;
let floor, frameId = 0, started = 0, duration = 1100, frames = 0, disposed = false;
let oldAngle = -0.20, targetAngle = 0.12, oldLift = 0.60, targetLift = 0;
const geometries = new Set();
const materials = new Set();
const textures = new Set();
const stateColors = { running: 0x69c9a7, fault: 0xfa6774, loading: 0xe9c84a, pending: 0xe9c84a, outdated: 0xe9c84a, unknown: 0x879a92, not_installed: 0x879a92 };
const stateAngles = { running: 0.12, fault: -0.24, loading: 0.43, pending: 0.28, outdated: 0.24, unknown: 0, not_installed: -0.12 };

function mesh(geometry, material, parent = device) {
  geometries.add(geometry);
  materials.add(material);
  const result = new THREE.Mesh(geometry, material);
  result.castShadow = true;
  result.receiveShadow = true;
  parent.add(result);
  return result;
}

function box(w, h, d, material, x = 0, y = 0, z = 0, parent = device) {
  const result = mesh(new THREE.BoxGeometry(w, h, d), material, parent);
  result.position.set(x, y, z);
  return result;
}

function ring(radius, width, material, y, parent = device, arc = Math.PI * 2) {
  const result = mesh(new THREE.TorusGeometry(radius, width, 8, 96, arc), material, parent);
  result.rotation.x = -Math.PI / 2;
  result.position.y = y;
  return result;
}

function line(points, color, opacity = 1, parent = device) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(...p)));
  const material = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
  geometries.add(geometry);
  materials.add(material);
  const result = new THREE.Line(geometry, material);
  parent.add(result);
  return result;
}

function studioEnvironment() {
  const image = document.createElement('canvas');
  image.width = 1024;
  image.height = 512;
  const c = image.getContext('2d');
  c.fillStyle = '#687d74';
  c.fillRect(0, 0, 1024, 512);
  c.fillStyle = '#f2fff9';
  c.fillRect(40, 70, 230, 260);
  c.fillStyle = '#ffffff';
  c.fillRect(620, 80, 180, 170);
  c.fillStyle = '#222b27';
  c.fillRect(270, 270, 360, 242);
  c.fillStyle = '#d3dbc7';
  c.fillRect(870, 90, 55, 300);
  const texture = new THREE.CanvasTexture(image);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  const generator = new THREE.PMREMGenerator(renderer);
  const environment = generator.fromEquirectangular(texture);
  texture.dispose();
  generator.dispose();
  textures.add(environment);
  return environment.texture;
}

function build() {
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.28;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  scene.environment = studioEnvironment();
  camera = new THREE.PerspectiveCamera(33, 1, 0.1, 40);
  camera.position.set(4.3, 4.7, 6.4);
  camera.lookAt(0, 0.24, 0);

  scene.add(new THREE.HemisphereLight(0xf3fff9, 0x3b4841, 2.6));
  const key = new THREE.DirectionalLight(0xffffff, 4.6);
  key.position.set(-3, 7, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -4;
  key.shadow.camera.right = 4;
  key.shadow.camera.top = 4;
  key.shadow.camera.bottom = -4;
  key.shadow.normalBias = 0.035;
  key.shadow.bias = -0.0001;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xc1d9d0, 2.8);
  rim.position.set(4, 2, -5);
  scene.add(rim);

  device = new THREE.Group();
  device.rotation.y = -0.14;
  scene.add(device);
  metal = new THREE.MeshStandardMaterial({ color: 0x414a46, metalness: 0.83, roughness: 0.30 });
  paleMetal = new THREE.MeshStandardMaterial({ color: 0xd9e1da, metalness: 0.72, roughness: 0.25 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x151e19, metalness: 0.7, roughness: 0.36 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xe9c84a, metalness: 0.4, roughness: 0.24 });
  signal = new THREE.MeshStandardMaterial({ color: 0x69c9a7, emissive: 0x69c9a7, emissiveIntensity: 0.7, metalness: 0.3, roughness: 0.3 });

  box(3.7, 0.13, 2.65, paleMetal, 0, 0, 0);
  box(3.52, 0.17, 2.47, dark, 0, 0.12, 0);
  box(3.28, 0.055, 2.23, metal, 0, 0.235, 0);
  box(0.78, 0.025, 0.08, yellow, -0.95, 0.278, 0.99);
  box(0.30, 0.03, 0.08, signal, 1.24, 0.278, 0.99);

  // Routed traces and screw mounts are real geometry, visible through the lid.
  for (let i = 0; i < 5; i++) {
    const z = -0.83 + i * 0.13;
    line([[-1.6, 0.269, z], [-1.2, 0.269, z], [-0.90, 0.269, z + 0.24], [-0.6, 0.269, z + 0.24]], 0x8ba096, 0.58);
    line([[1.58, 0.269, -z], [1.20, 0.269, -z], [0.9, 0.269, -z - 0.24], [0.6, 0.269, -z - 0.24]], 0x8ba096, 0.58);
  }
  for (const x of [-1.62, 1.62]) for (const z of [-1.1, 1.1]) {
    const standoff = mesh(new THREE.CylinderGeometry(0.072, 0.09, 0.64, 12), paleMetal);
    standoff.position.set(x, 0.5, z);
    const bolt = mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.035, 12), dark);
    bolt.position.set(x, 0.839, z);
    box(0.062, 0.005, 0.009, paleMetal, x, 0.859, z);
  }
  for (let i = 0; i < 14; i++) {
    box(0.026, 0.08, 0.11, paleMetal, -1.37 + i * 0.07, 0.105, 1.258);
  }

  rotor = new THREE.Group();
  device.add(rotor);
  ring(0.92, 0.035, paleMetal, 0.44, rotor);
  ring(1.04, 0.013, yellow, 0.33, rotor, Math.PI * 1.25);
  for (let i = 0; i < 64; i++) {
    const a = i * Math.PI * 2 / 64;
    const tick = box(i % 8 === 0 ? 0.024 : 0.011, 0.022, i % 8 === 0 ? 0.105 : 0.051,
      i % 8 === 0 ? yellow : paleMetal, Math.sin(a) * 1.065, 0.36, Math.cos(a) * 1.065, rotor);
    tick.rotation.y = a;
  }
  innerRotor = new THREE.Group();
  device.add(innerRotor);
  ring(0.64, 0.045, dark, 0.47, innerRotor);
  ring(0.65, 0.014, signal, 0.51, innerRotor, Math.PI * 1.55);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    const arm = box(0.065, 0.055, 0.35, metal, Math.sin(a) * 0.59, 0.39, Math.cos(a) * 0.59);
    arm.rotation.y = a;
  }

  const chipBase = mesh(new THREE.CylinderGeometry(0.40, 0.45, 0.16, 6), dark);
  chipBase.position.y = 0.43;
  const chip = mesh(new THREE.CylinderGeometry(0.29, 0.34, 0.20, 6), yellow);
  chip.position.y = 0.59;
  chip.rotation.y = Math.PI / 6;
  const top = mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.013, 6), metal);
  top.position.y = 0.696;
  top.rotation.y = Math.PI / 6;
  for (let i = 0; i < 3; i++) box(0.055, 0.009, 0.25 - i * 0.045, yellow, -0.085 + i * 0.084, 0.708, i * 0.022);

  lid = new THREE.Group();
  device.add(lid);
  glass = new THREE.MeshPhysicalMaterial({
    color: 0xe0efe8, metalness: 0, roughness: 0.12, transmission: 0.96,
    thickness: 0.13, ior: 1.45, clearcoat: 1, clearcoatRoughness: 0.12,
    attenuationColor: new THREE.Color(0xd1e5d8), attenuationDistance: 2.8,
    transparent: true, opacity: 0.9,
  });
  const cover = box(3.35, 0.065, 2.27, glass, 0, 0.81, 0, lid);
  cover.castShadow = false;
  const edges = new THREE.EdgesGeometry(cover.geometry);
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xc9e5d7, transparent: true, opacity: 0.58 });
  geometries.add(edges);
  materials.add(edgeMaterial);
  const outline = new THREE.LineSegments(edges, edgeMaterial);
  outline.position.copy(cover.position);
  lid.add(outline);
  for (const x of [-1.55, 1.55]) box(0.17, 0.026, 0.37, paleMetal, x, 0.853, 0.91, lid);
  line([[-1.42, 0.85, -0.9], [-0.92, 0.85, -0.9]], 0x355e4e, 0.8, lid);
  line([[-1.42, 0.85, -0.82], [-1.14, 0.85, -0.82]], 0x355e4e, 0.8, lid);
  for (let i = 0; i < 22; i++) box(i % 3 ? 0.013 : 0.028, 0.008, i % 4 ? 0.1 : 0.15, dark, 0.78 + i * 0.025, 0.851, -0.83, lid);

  floor = mesh(new THREE.PlaneGeometry(16, 16), new THREE.ShadowMaterial({ opacity: 0.15 }), scene);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.20;
  floor.castShadow = false;
  applyQuality();
  resize();
  updateVisuals();
  window.__terminalRenderState = 'ready';
  startTransition(true);
}

function applyQuality() {
  const full = settings.quality === 'full';
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, full ? 2 : 1.25));
  renderer.shadowMap.enabled = full;
  glass.roughness = full ? 0.085 : 0.14;
  renderer.setSize(Math.max(innerWidth, 1), Math.max(innerHeight, 1), true);
}

function updateVisuals() {
  const color = stateColors[settings.status];
  signal.color.setHex(color);
  signal.emissive.setHex(color);
  metal.color.setHex(settings.dark ? 0x465a4f : 0x5b6c61);
  paleMetal.color.setHex(settings.dark ? 0x839b8b : 0xd9e1da);
  glass.color.setHex(settings.dark ? 0xb8dac9 : 0xe0efe8);
  floor.material.opacity = settings.dark ? 0.22 : 0.12;
  renderer.toneMappingExposure = settings.dark ? 1.1 : 1.28;
}

function resize() {
  if (!renderer || disposed) return;
  const width = Math.max(innerWidth, 1), height = Math.max(innerHeight, 1);
  // Embedded WebView can keep both percentages and vh at a zero initial viewport.
  // Its window dimensions are valid, so set concrete CSS pixels on every resize.
  document.documentElement.style.width = `${width}px`;
  document.documentElement.style.height = `${height}px`;
  document.body.style.width = `${width}px`;
  document.body.style.height = `${height}px`;
  const aspect = width / height;
  camera.aspect = aspect;
  // Fit the projected device instead of shrinking a desktop composition on phones.
  const distance = camera.position.distanceTo(new THREE.Vector3(0, 0.24, 0));
  const visibleHeight = Math.max(3.6, 4.9 / aspect);
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(visibleHeight / (2 * distance)));
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, true);
  render();
}

function render() {
  if (disposed || !settings.active || document.hidden) return;
  renderer.render(scene, camera);
  if (diagnostics && frameProbe === null) {
    // One debug-only read while the default framebuffer is still valid. Reading
    // after compositing is inconclusive when preserveDrawingBuffer is false.
    const gl = renderer.getContext();
    const width = gl.drawingBufferWidth, height = gl.drawingBufferHeight;
    const buffer = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
    let occupied = 0;
    for (let i = 3; i < buffer.length; i += 4) if (buffer[i] > 32) occupied++;
    const center = (Math.floor(height / 2) * width + Math.floor(width / 2)) * 4;
    frameProbe = { width, height, occupied, fraction: occupied / (width * height),
      center: Array.from(buffer.slice(center, center + 4)), error: gl.getError(),
      contextLost: gl.isContextLost(), attributes: gl.getContextAttributes(),
      version: gl.getParameter(gl.VERSION), renderer: gl.getParameter(gl.RENDERER) };
  }
  frames++;
}

function applyProgress(progress) {
  const p = 1 - Math.pow(1 - progress, 3);
  rotor.rotation.y = oldAngle + (targetAngle - oldAngle) * p;
  innerRotor.rotation.y = -rotor.rotation.y * 1.7;
  lid.position.y = oldLift + (targetLift - oldLift) * p;
  glass.roughness = (settings.quality === 'full' ? 0.085 : 0.14) + (1 - p) * 0.19;
  device.rotation.y = -0.14 + (1 - p) * 0.12;
}

function tick(now) {
  frameId = 0;
  if (disposed || !settings.active || document.hidden) return;
  const progress = Math.min(1, (now - started) / duration);
  applyProgress(progress);
  render();
  if (progress < 1) frameId = requestAnimationFrame(tick);
}

function startTransition(enter = false) {
  cancelAnimationFrame(frameId);
  frameId = 0;
  oldAngle = enter ? -0.65 : rotor.rotation.y;
  oldLift = enter ? 0.62 : lid.position.y;
  targetAngle = stateAngles[settings.status];
  targetLift = settings.status === 'not_installed' ? 0.16 : settings.status === 'fault' ? 0.05 : 0;
  duration = enter ? 1100 : 720;
  if (settings.reducedMotion || !settings.active || document.hidden) {
    applyProgress(1);
    render();
    return;
  }
  started = performance.now();
  frameId = requestAnimationFrame(tick);
}

function fail() {
  window.__terminalRenderState = 'fault';
  cancelAnimationFrame(frameId);
  frameId = 0;
}

function dispose() {
  if (disposed) return;
  disposed = true;
  cancelAnimationFrame(frameId);
  geometries.forEach(g => g.dispose());
  materials.forEach(m => m.dispose());
  textures.forEach(t => t.dispose());
  renderer?.dispose();
}

window.TerminalCore = Object.freeze({
  setState(next) {
    if (disposed || !renderer) return;
    const previous = settings;
    settings = {
      status: STATES.has(next.status) ? next.status : 'unknown',
      quality: next.quality === 'full' ? 'full' : 'balanced',
      dark: next.dark === true,
      active: next.active === true,
      reducedMotion: next.reducedMotion === true,
    };
    if (previous.quality !== settings.quality) applyQuality();
    updateVisuals();
    if (previous.status !== settings.status || previous.reducedMotion !== settings.reducedMotion) {
      startTransition();
    } else if (!settings.active) {
      cancelAnimationFrame(frameId);
      frameId = 0;
      applyProgress(1);
    } else {
      render();
    }
  },
  // Diagnostic counters have no business data and never invoke native code.
  inspect() { return { state: window.__terminalRenderState, frames, animating: frameId !== 0, active: settings.active, status: settings.status, quality: settings.quality, width: canvas.width, height: canvas.height, triangles: renderer?.info.render.triangles || 0, frameProbe }; },
  dispose,
});
window.addEventListener('resize', resize);
window.addEventListener('pagehide', dispose, { once: true });
window.addEventListener('error', fail);
window.addEventListener('unhandledrejection', fail);
document.addEventListener('visibilitychange', () => {
  cancelAnimationFrame(frameId);
  frameId = 0;
  if (renderer && !disposed) { applyProgress(1); render(); }
});
canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); fail(); });
// Android replaces a lost context with the independent Compose fallback.
try { build(); } catch (error) { fail(); console.error('Terminal renderer unavailable', error); }

import * as THREE from "three";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { FolderDepthMask, type FolderDepthSample } from "./folder-depth-mask";

export interface FolderFrameSnapshot {
  projection: THREE.Matrix4;
  height: number;
  tilt: {x: number; y: number};
}

export interface AcquiredFolderFrame {
  sequence: number;
  epoch: number;
  mask: FolderDepthSample;
  snapshot: FolderFrameSnapshot;
}

type SlotState = "free" | "pending" | "ready" | "acquired" | "presented";
interface FrameSlot {
  color: THREE.WebGLRenderTarget;
  depth: FolderDepthMask;
  state: SlotState;
  sequence: number;
  epoch: number;
  generation: number;
  submittedAt: number;
  frame?: AcquiredFolderFrame;
  disposed: boolean;
}

/** Full-resolution color and exact visibility travel through the same slot. */
export class FolderFramePipeline {
  private readonly slots: FrameSlot[];
  private readonly size = new THREE.Vector2();
  private readonly copyMaterial: THREE.RawShaderMaterial;
  private readonly copyQuad: FullScreenQuad;
  private epoch: number | undefined;
  private generation = 0;
  private sequence = 0;
  private width = 0;
  private height = 0;
  private disposed = false;
  private acquired?: FrameSlot;
  private presented?: FrameSlot;
  private counts = {submitted: 0, completed: 0, dropped: 0, failed: 0, blocked: 0, lastLatencyMs: 0};

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    model: THREE.Group,
    options: {colorDepth?: boolean} = {},
  ) {
    this.slots = Array.from({length: 3}, () => ({
      color: new THREE.WebGLRenderTarget(1, 1, {
        depthBuffer: options.colorDepth !== false,
        stencilBuffer: false,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        generateMipmaps: false,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
        colorSpace: THREE.NoColorSpace,
      }),
      depth: new FolderDepthMask(renderer, scene, camera, model),
      state: "free" as SlotState,
      sequence: 0,
      epoch: -1,
      generation: 0,
      submittedAt: 0,
      disposed: false,
    }));
    this.copyMaterial = new THREE.RawShaderMaterial({
      uniforms: {source: {value: null}},
      vertexShader: "precision highp float; attribute vec3 position; attribute vec2 uv; varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position,1.0);}",
      fragmentShader: "precision highp float; uniform sampler2D source; varying vec2 vUv; void main(){gl_FragColor=texture2D(source,vUv);}",
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
      toneMapped: false,
    });
    this.copyQuad = new FullScreenQuad(this.copyMaterial);
  }

  private drop(slot: FrameSlot) {
    this.counts.dropped++;
    slot.state = "free";
    slot.frame = undefined;
    if (this.acquired === slot) this.acquired = undefined;
  }

  /** Pending readbacks own their buffers until settlement, even after invalidation. */
  invalidate(epoch: number) {
    if (this.disposed) return;
    this.epoch = epoch;
    this.generation++;
    for (const slot of this.slots) {
      if (slot.state === "ready" || slot.state === "acquired") this.drop(slot);
    }
  }

  submit(renderColor: (target: THREE.WebGLRenderTarget) => void, snapshot: FolderFrameSnapshot, epoch: number): boolean {
    if (this.disposed) return false;
    if (epoch !== this.epoch) this.invalidate(epoch);
    this.renderer.getDrawingBufferSize(this.size);
    const width = Math.max(1, Math.floor(this.size.x)), height = Math.max(1, Math.floor(this.size.y));
    if (width !== this.width || height !== this.height) {
      this.width = width; this.height = height;
      this.invalidate(epoch);
    }
    let slot = this.slots.find(candidate => candidate.state === "free");
    // Keep the latest completed result when the consumer is late. An older
    // unacquired result can be replaced; a pending or acquired slot cannot.
    if (!slot) {
      const ready = this.slots.filter(candidate => candidate.state === "ready").sort((a, b) => a.sequence - b.sequence);
      if (ready.length > 1) { slot = ready[0]; this.drop(slot); }
    }
    if (!slot) { this.counts.blocked++; return false; }
    if (slot.color.width !== width || slot.color.height !== height) slot.color.setSize(width, height);
    slot.state = "pending";
    slot.sequence = ++this.sequence;
    slot.epoch = epoch;
    slot.generation = this.generation;
    slot.submittedAt = performance.now();
    const captured: FolderFrameSnapshot = {
      projection: snapshot.projection.clone(), height: snapshot.height,
      tilt: {...snapshot.tilt},
    };
    this.counts.submitted++;
    const submitted = slot;
    try {
      // Both draws are submitted before returning to simulation. The fence
      // behind the visibility draw also covers this slot's color commands.
      renderColor(slot.color);
      const readback = slot.depth.sampleAsync();
      void readback.then(mask => {
        this.counts.completed++;
        this.counts.lastLatencyMs = performance.now() - submitted.submittedAt;
        if (this.disposed) { this.disposeSlot(submitted); return; }
        if (submitted.epoch !== this.epoch || submitted.generation !== this.generation ||
            submitted.sequence <= (this.presented?.sequence ?? 0)) {
          this.drop(submitted); return;
        }
        submitted.frame = {sequence: submitted.sequence, epoch, mask, snapshot: captured};
        submitted.state = "ready";
      }, () => {
        this.counts.failed++;
        if (this.disposed) this.disposeSlot(submitted);
        else { submitted.state = "free"; submitted.frame = undefined; }
      });
    } catch {
      this.counts.failed++;
      submitted.state = "free";
      submitted.frame = undefined;
      return false;
    }
    return true;
  }

  /** The acquired frame remains immutable while its DOM mask is prepared. */
  acquire(epoch: number): AcquiredFolderFrame | undefined {
    if (this.disposed || epoch !== this.epoch) return undefined;
    if (this.acquired) return this.acquired.frame;
    const latest = this.slots.filter(slot => slot.state === "ready" && slot.epoch === epoch && slot.generation === this.generation)
      .sort((a, b) => b.sequence - a.sequence)[0];
    if (!latest) return undefined;
    for (const slot of this.slots) if (slot !== latest && slot.state === "ready" && slot.sequence < latest.sequence) this.drop(slot);
    latest.state = "acquired";
    this.acquired = latest;
    return latest.frame;
  }

  present(sequence: number, epoch: number): boolean {
    const slot = this.acquired;
    if (this.disposed || epoch !== this.epoch || !slot || slot.sequence !== sequence || slot.epoch !== epoch || slot.generation !== this.generation) return false;
    if (this.presented) {
      this.presented.state = "free";
      this.presented.frame = undefined;
    }
    slot.state = "presented";
    this.presented = slot;
    this.acquired = undefined;
    return true;
  }

  release(sequence: number, epoch: number): boolean {
    const slot = this.acquired;
    if (!slot || slot.sequence !== sequence || slot.epoch !== epoch) return false;
    this.drop(slot);
    return true;
  }

  clearPresented() {
    if(!this.presented)return;
    this.presented.state="free";this.presented.frame=undefined;this.presented=undefined;
  }

  /** Copy already-output-encoded color; no extra tone mapping or conversion. */
  blit(): boolean {
    if (this.disposed || !this.presented) return false;
    this.copyColor(this.presented.color.texture, null);
    return true;
  }

  copyColor(texture: THREE.Texture, destination: THREE.WebGLRenderTarget | null): void {
    if (this.disposed) return;
    const renderer = this.renderer;
    const target = renderer.getRenderTarget(), cubeFace = renderer.getActiveCubeFace(), mipLevel = renderer.getActiveMipmapLevel();
    const viewport = renderer.getViewport(new THREE.Vector4()), scissor = renderer.getScissor(new THREE.Vector4());
    const scissorTest = renderer.getScissorTest(), autoClear = renderer.autoClear, xrEnabled = renderer.xr.enabled;
    const shadowEnabled = renderer.shadowMap.enabled, shadowNeedsUpdate = renderer.shadowMap.needsUpdate;
    try {
      renderer.getDrawingBufferSize(this.size);
      renderer.xr.enabled = false;
      renderer.shadowMap.enabled = false;
      renderer.autoClear = false;
      renderer.setRenderTarget(destination);
      const pixelRatio = renderer.getPixelRatio();
      renderer.setViewport(0, 0, (destination?.width ?? this.size.x) / pixelRatio, (destination?.height ?? this.size.y) / pixelRatio);
      renderer.setScissorTest(false);
      this.copyMaterial.uniforms.source.value = texture;
      this.copyQuad.render(renderer);
    } finally {
      renderer.setRenderTarget(target, cubeFace, mipLevel);
      renderer.setViewport(viewport); renderer.setScissor(scissor); renderer.setScissorTest(scissorTest);
      renderer.autoClear = autoClear; renderer.xr.enabled = xrEnabled;
      renderer.shadowMap.enabled = shadowEnabled; renderer.shadowMap.needsUpdate = shadowNeedsUpdate;
    }
  }

  get stats() {
    return {...this.counts, inFlight: this.slots.filter(slot => slot.state === "pending").length,
      slots: this.slots.length, width: this.width, height: this.height,
      presented: this.presented?.sequence ?? 0, acquired: this.acquired?.sequence ?? 0,
      states: this.slots.map(slot => ({sequence: slot.sequence, epoch: slot.epoch, state: slot.state})),
      maskstats: this.slots.map(slot => slot.depth.stats)};
  }

  get presentedSnapshot(): FolderFrameSnapshot | undefined { return this.presented?.frame?.snapshot; }
  get failureCount() { return this.counts.failed; }

  get maskStats() {
    const values = this.slots.map(slot => slot.depth.stats);
    const latest = this.slots.reduce((a, b) => a.sequence > b.sequence ? a : b).depth.stats;
    return {...latest,
      samples: values.reduce((sum, value) => sum + value.samples, 0),
      asyncReads: values.reduce((sum, value) => sum + value.asyncReads, 0),
      syncReads: values.reduce((sum, value) => sum + value.syncReads, 0),
      emptyPasses: values.reduce((sum, value) => sum + value.emptyPasses, 0)};
  }

  private disposeSlot(slot: FrameSlot) {
    if (slot.disposed) return;
    slot.disposed = true;
    slot.depth.dispose(); slot.color.dispose(); slot.frame = undefined; slot.state = "free";
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    // A live PBO read still refers to its render target. Its settlement handler
    // performs final disposal instead of deleting attachments underneath it.
    for (const slot of this.slots) if (slot.state !== "pending") this.disposeSlot(slot);
    this.copyQuad.dispose(); this.copyMaterial.dispose();
    this.acquired = undefined; this.presented = undefined;
  }
}

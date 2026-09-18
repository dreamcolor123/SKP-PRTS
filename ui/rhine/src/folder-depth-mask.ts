import * as THREE from "three";

export interface FolderDepthSample {
  /** RGBA8 rows start at the lower-left, matching readRenderTargetPixels. */
  pixels: Uint8Array;
  width: number;
  height: number;
  /** DOM face corners in target pixels, top-left origin, TL/TR/BR/BL order. */
  quad: number[][];
  solid?: boolean;
}

/** Depth-tested visibility of the DOM face against actual archive geometry. */
export class FolderDepthMask {
  private readonly target = new THREE.WebGLRenderTarget(1, 1, {
    depthBuffer: true,
    stencilBuffer: false,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    generateMipmaps: false,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
  });
  private readonly occluder = new THREE.MeshBasicMaterial({
    color: 0x000000,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: true,
    blending: THREE.NoBlending,
    toneMapped: false,
    fog: false,
  });
  private readonly faceMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: false,
    blending: THREE.NoBlending,
    toneMapped: false,
    fog: false,
  });
  private readonly faceGeometry = new THREE.PlaneGeometry(4.56, 3.22)
    .translate(0, 1.79, 0.275);
  private readonly face = new THREE.Mesh(this.faceGeometry, this.faceMaterial);
  private readonly faceScene = new THREE.Scene();
  private readonly size = new THREE.Vector2();
  private readonly point = new THREE.Vector3();
  private pixels = new Uint8Array(4);
  private disposed = false;
  private readonly blockers = new THREE.Scene();
  private readonly proxies = new Map<THREE.Mesh, THREE.Mesh>();
  private readonly localMatrix = new THREE.Matrix4();
  private readonly worldMatrix = new THREE.Matrix4();
  private readonly clipMatrix = new THREE.Matrix4();
  private readonly corner = new THREE.Vector4();
  private readonly rayBounds = new THREE.Box3();
  private readonly boxCenter = new THREE.Vector3();
  private readonly boxHalfSize = new THREE.Vector3();
  private readonly cameraPosition = new THREE.Vector3();
  private readonly cameraDirection = new THREE.Vector3();
  private faceBounds = {left:0,right:0,top:0,bottom:0,far:1};
  private counters = {samples:0,asyncReads:0,syncReads:0,emptyPasses:0,tested:0,drawn:0,triangles:0,submitMs:0};
  get stats() { return {...this.counters}; }

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
    private readonly model: THREE.Group,
  ) {
    this.face.matrixAutoUpdate = false;
    this.face.frustumCulled = false;
    this.faceScene.matrixWorldAutoUpdate = false;
    this.faceScene.add(this.face);
    this.blockers.matrixWorldAutoUpdate = false;
  }

  sample(): FolderDepthSample {
    return this.render(false) as FolderDepthSample;
  }
  async sampleAsync(): Promise<FolderDepthSample> {
    return this.render(true);
  }
  private intersects(geometry:THREE.BufferGeometry,matrix:THREE.Matrix4) {
    if(!geometry.boundingBox)geometry.computeBoundingBox();
    const box=geometry.boundingBox!;
    // Every potential blocker lies on a segment from the camera to the face.
    // Its world AABB must intersect that volume; this rejects the floor and
    // sunken neighbors even when their projected boxes cover the whole screen.
    box.getCenter(this.boxCenter).applyMatrix4(matrix);
    box.getSize(this.boxHalfSize).multiplyScalar(.5);
    const e=matrix.elements,h=this.boxHalfSize,c=this.boxCenter,bounds=this.rayBounds;
    const rx=Math.abs(e[0])*h.x+Math.abs(e[4])*h.y+Math.abs(e[8])*h.z;
    const ry=Math.abs(e[1])*h.x+Math.abs(e[5])*h.y+Math.abs(e[9])*h.z;
    const rz=Math.abs(e[2])*h.x+Math.abs(e[6])*h.y+Math.abs(e[10])*h.z;
    if(c.x+rx<bounds.min.x||c.x-rx>bounds.max.x||c.y+ry<bounds.min.y||c.y-ry>bounds.max.y||c.z+rz<bounds.min.z||c.z-rz>bounds.max.z)return false;
    this.clipMatrix.multiplyMatrices(this.camera.projectionMatrix,this.camera.matrixWorldInverse).multiply(matrix);
    let left=Infinity,right=-Infinity,top=-Infinity,bottom=Infinity,near=Infinity;
    for(let i=0;i<8;i++){
      this.corner.set(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z,1).applyMatrix4(this.clipMatrix);
      // Near-plane crossings cannot be rejected from projected bounds.
      if(this.corner.w<=0)return true;
      const x=this.corner.x/this.corner.w,y=this.corner.y/this.corner.w,z=this.corner.z/this.corner.w;
      left=Math.min(left,x);right=Math.max(right,x);top=Math.max(top,y);bottom=Math.min(bottom,y);near=Math.min(near,z);
    }
    const b=this.faceBounds,margin=.008;
    return right>=b.left-margin&&left<=b.right+margin&&top>=b.bottom-margin&&bottom<=b.top+margin&&near<=b.far+1e-6;
  }
  private collectBlockers() {
    for(const proxy of this.proxies.values())proxy.visible=false;
    const visited=new Set<THREE.Mesh>();
    let tested=0,drawn=0,triangles=0;
    this.scene.traverseVisible(object=>{
      if(!(object instanceof THREE.Mesh))return;
      for(let parent:THREE.Object3D|null=object;parent;parent=parent.parent)if(parent===this.model)return;
      const source=object;
      visited.add(source);
      let proxy=this.proxies.get(source);
      if(source instanceof THREE.InstancedMesh&&proxy instanceof THREE.InstancedMesh&&proxy.instanceMatrix.count<source.instanceMatrix.count){
        this.blockers.remove(proxy);proxy.dispose();this.proxies.delete(source);proxy=undefined;
      }
      if(!proxy){
        proxy=source instanceof THREE.InstancedMesh?new THREE.InstancedMesh(source.geometry,this.occluder,source.instanceMatrix.count):new THREE.Mesh(source.geometry,this.occluder);
        proxy.matrixAutoUpdate=false;proxy.frustumCulled=false;this.proxies.set(source,proxy);this.blockers.add(proxy);
      }
      proxy.layers.mask=source.layers.mask;
      const perMesh=(source.geometry.index?.count??source.geometry.attributes.position.count)/3;
      if(source instanceof THREE.InstancedMesh){
        const batch=proxy as THREE.InstancedMesh;batch.count=0;
        for(let i=0;i<source.count;i++){
          tested++;source.getMatrixAt(i,this.localMatrix);this.worldMatrix.multiplyMatrices(source.matrixWorld,this.localMatrix);
          if(!this.intersects(source.geometry,this.worldMatrix))continue;
          batch.setMatrixAt(batch.count++,this.worldMatrix);drawn++;triangles+=perMesh;
        }
        batch.visible=batch.count>0;batch.instanceMatrix.needsUpdate=batch.visible;
      }else{
        tested++;proxy.visible=this.intersects(source.geometry,source.matrixWorld);
        if(proxy.visible){proxy.matrixWorld.copy(source.matrixWorld);drawn++;triangles+=perMesh;}
      }
    });
    for(const [source,proxy] of this.proxies){
      if(visited.has(source))continue;
      this.blockers.remove(proxy);
      if(proxy instanceof THREE.InstancedMesh)proxy.dispose();
      this.proxies.delete(source);
    }
    this.counters.tested=tested;this.counters.drawn=drawn;this.counters.triangles=triangles;
    return drawn;
  }
  private render(asyncRead:boolean):FolderDepthSample|Promise<FolderDepthSample> {
    if (this.disposed) throw new Error("FolderDepthMask has been disposed");
    const started=performance.now();this.counters.samples++;
    const renderer = this.renderer;
    renderer.getSize(this.size);
    const width = Math.max(1, Math.min(384, Math.round(this.size.x)));
    const height = Math.max(1, Math.round(width * this.size.y / Math.max(1, this.size.x)));
    if (this.target.width !== width || this.target.height !== height) {
      this.target.setSize(width, height);
      this.pixels = new Uint8Array(width * height * 4);
    }

    this.model.updateWorldMatrix(true, false);
    this.face.matrixWorld.copy(this.model.matrixWorld);
    this.face.layers.mask = this.camera.layers.mask;
    this.camera.getWorldPosition(this.cameraPosition);this.camera.getWorldDirection(this.cameraDirection);
    this.rayBounds.makeEmpty().expandByPoint(this.cameraPosition);
    for(const [x,y] of [[-2.28,3.4],[2.28,3.4],[2.28,.18],[-2.28,.18]]){
      this.point.set(x,y,.275).applyMatrix4(this.model.matrixWorld);this.rayBounds.expandByPoint(this.point);
      if(this.camera instanceof THREE.OrthographicCamera){
        const distance=(this.point.x-this.cameraPosition.x)*this.cameraDirection.x+(this.point.y-this.cameraPosition.y)*this.cameraDirection.y+(this.point.z-this.cameraPosition.z)*this.cameraDirection.z;
        this.point.addScaledVector(this.cameraDirection,-distance);this.rayBounds.expandByPoint(this.point);
      }
    }
    this.rayBounds.expandByScalar(.03);
    const depths:number[]=[];
    const quad = [[-2.28, 3.4], [2.28, 3.4], [2.28, 0.18], [-2.28, 0.18]]
      .map(([x, y]) => {
        this.point.set(x, y, 0.255).applyMatrix4(this.model.matrixWorld).project(this.camera);
        depths.push(this.point.z);
        return [(this.point.x + 1) * width / 2, (1 - this.point.y) * height / 2];
      });
    this.faceBounds={left:Math.min(...quad.map(p=>p[0]))/width*2-1,right:Math.max(...quad.map(p=>p[0]))/width*2-1,
      top:1-Math.min(...quad.map(p=>p[1]))/height*2,bottom:1-Math.max(...quad.map(p=>p[1]))/height*2,far:Math.max(...depths)};
    this.scene.updateMatrixWorld();
    if(!this.collectBlockers()){
      this.pixels.fill(255);this.counters.emptyPasses++;this.counters.submitMs=performance.now()-started;
      return {pixels:this.pixels,width,height,quad,solid:true};
    }

    const state = {
      target: renderer.getRenderTarget(),
      cubeFace: renderer.getActiveCubeFace(),
      mipLevel: renderer.getActiveMipmapLevel(),
      clearColor: renderer.getClearColor(new THREE.Color()),
      clearAlpha: renderer.getClearAlpha(),
      viewport: renderer.getViewport(new THREE.Vector4()),
      scissor: renderer.getScissor(new THREE.Vector4()),
      scissorTest: renderer.getScissorTest(),
      autoClear: renderer.autoClear,
      shadowEnabled: renderer.shadowMap.enabled,
      shadowNeedsUpdate: renderer.shadowMap.needsUpdate,
      xrEnabled: renderer.xr.enabled,
      background: this.scene.background,
      overrideMaterial: this.scene.overrideMaterial,
      modelVisible: this.model.visible,
      info: {...renderer.info.render},
    };

    let read:Promise<unknown>|undefined;
    try {
      renderer.autoClear = false;
      renderer.shadowMap.enabled = false;
      renderer.xr.enabled = false;
      // Render-target viewport/scissor are physical pixels. setViewport would
      // multiply by the screen pixel ratio and break mask alignment on mobile.
      renderer.setRenderTarget(this.target);
      const pixelRatio = renderer.getPixelRatio();
      renderer.setViewport(0, 0, width / pixelRatio, height / pixelRatio);
      renderer.setScissorTest(false);
      renderer.setClearColor(0x000000, 1);
      renderer.clear(true, true, true);

      // Broad-phase rejection only; surviving blockers retain original triangles
      // and world transforms, so the final visibility is still GPU depth-tested.
      renderer.render(this.blockers, this.camera);
      renderer.render(this.faceScene, this.camera);
      if(asyncRead){
        this.counters.asyncReads++;
        read=renderer.readRenderTargetPixelsAsync(this.target,0,0,width,height,this.pixels);
      }else{
        this.counters.syncReads++;
        renderer.readRenderTargetPixels(this.target, 0, 0, width, height, this.pixels);
      }
    } finally {
      this.model.visible = state.modelVisible;
      this.scene.background = state.background;
      this.scene.overrideMaterial = state.overrideMaterial;
      renderer.autoClear = state.autoClear;
      renderer.shadowMap.enabled = state.shadowEnabled;
      renderer.shadowMap.needsUpdate = state.shadowNeedsUpdate;
      renderer.xr.enabled = state.xrEnabled;
      renderer.setClearColor(state.clearColor, state.clearAlpha);
      renderer.setRenderTarget(state.target, state.cubeFace, state.mipLevel);
      renderer.setViewport(state.viewport);
      renderer.setScissor(state.scissor);
      renderer.setScissorTest(state.scissorTest);
      Object.assign(renderer.info.render,state.info);
      this.counters.submitMs=performance.now()-started;
    }

    const result={pixels:this.pixels,width,height,quad};
    return read?read.then(()=>result):result;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.target.dispose();
    this.faceGeometry.dispose();
    this.faceMaterial.dispose();
    this.occluder.dispose();
    this.faceScene.clear();
    for(const proxy of this.proxies.values())if(proxy instanceof THREE.InstancedMesh)proxy.dispose();
    this.proxies.clear();this.blockers.clear();
  }
}

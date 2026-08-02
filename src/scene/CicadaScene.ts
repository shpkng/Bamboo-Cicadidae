import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { attachment, layout, model, tuning } from '../config/defaults';
import type { Vec3 } from '../core/Pendulum';

const assets = {
  'Stick.glb': new URL('../../Stick.glb', import.meta.url).href,
  'Cicadidae_Body.glb': new URL('../../Cicadidae_Body.glb', import.meta.url).href,
  'Wing_Left.glb': new URL('../../Wing_Left.glb', import.meta.url).href,
} as const;

export class CicadaScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera = new THREE.PerspectiveCamera(tuning.cameraFov, 1, 0.1, 100);
  readonly scene = new THREE.Scene();
  readonly stickAnchor = new THREE.Group();
  readonly cicadaRoot = new THREE.Group();
  private readonly bodyAnchor = new THREE.Group();
  private readonly stickModel = new THREE.Group();
  private readonly bodyModel = new THREE.Group();
  private readonly wingLeft = new THREE.Group();
  private readonly wingRight = new THREE.Group();
  private rope?: Rope;
  private lastSize = { width: 0, height: 0 };

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);

    this.scene.add(new THREE.HemisphereLight(0xfff7e8, 0x27352e, 2.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(3, 5, 6);
    this.scene.add(key);

    this.stickAnchor.add(this.stickModel);
    this.scene.add(this.stickAnchor);
    this.cicadaRoot.add(this.bodyAnchor);
    this.bodyAnchor.add(this.bodyModel, this.wingLeft, this.wingRight);
    this.scene.add(this.cicadaRoot);
    this.resize();
  }

  async load(onProgress: (ratio: number) => void): Promise<void> {
    const loader = new GLTFLoader();
    const files = ['Stick.glb', 'Cicadidae_Body.glb', 'Wing_Left.glb'];
    let done = 0;
    const load = async (file: string) => {
      const gltf = await loader.loadAsync(assets[file as keyof typeof assets], (event) => {
        if (event.total) onProgress((done + event.loaded / event.total) / files.length);
      });
      done += 1;
      onProgress(done / files.length);
      return gltf.scene;
    };
    const [stick, body, leftWing] = await Promise.all(files.map(load));
    this.prepare(stick);
    this.prepare(body);
    this.prepare(leftWing);
    this.stickModel.add(stick);
    this.bodyModel.add(body);
    this.wingLeft.add(leftWing);
    const mirroredWing = leftWing.clone(true);
    mirroredWing.scale.z = -1;
    this.wingRight.add(mirroredWing);
    this.rope = new Rope(this.scene, tuning.ropeSegments);
    this.applyConfig();
  }

  applyConfig(): void {
    this.stickModel.position.set(attachment.stickOffset.x, attachment.stickOffset.y, attachment.stickOffset.z);
    this.bodyModel.position.set(attachment.bodyOffset.x, attachment.bodyOffset.y, attachment.bodyOffset.z);
  
    this.wingLeft.position.set(attachment.wingLeftOffset.x, attachment.wingLeftOffset.y, attachment.wingLeftOffset.z);
    this.wingRight.position.set(attachment.wingRightOffset.x, attachment.wingRightOffset.y, attachment.wingRightOffset.z);
    this.stickModel.scale.setScalar(model.stickScale);
    this.bodyModel.scale.setScalar(model.cicadaScale);
    this.wingLeft.scale.setScalar(model.cicadaScale);
    this.wingRight.scale.setScalar(model.cicadaScale);
    this.camera.fov = tuning.cameraFov;
    this.camera.updateProjectionMatrix();
    if (this.rope && this.rope.segments !== Math.round(tuning.ropeSegments)) {
      this.rope.dispose();
      this.rope = new Rope(this.scene, Math.round(tuning.ropeSegments));
    }
  }

  update(ropeDirection: Vec3, dt: number): void {
    const target = new THREE.Vector3(0, -0.5, 0);
    const viewNormal = new THREE.Vector3(0, Math.sin(tuning.cameraTilt), Math.cos(tuning.cameraTilt));
    this.camera.position.copy(target).addScaledVector(viewNormal, tuning.cameraDistance);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(target);
    this.camera.updateMatrixWorld();

    // Anchor the stick head to the centre line at a stable screen-space height.
    const screenY = 1 - 2 * layout.stickHeadScreenY;
    const visibleHalfHeight = Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5)) * tuning.cameraDistance;
    const cameraUp = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
    const cameraRight = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const cameraBack = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 2);
    this.stickAnchor.position.copy(target).addScaledVector(cameraUp, screenY * visibleHalfHeight);
    this.stickAnchor.quaternion.copy(this.camera.quaternion);
    this.stickAnchor.rotateZ(layout.stickScreenRoll);
    const worldRopeDirection = new THREE.Vector3()
      .addScaledVector(cameraRight, ropeDirection.x)
      .addScaledVector(cameraUp, ropeDirection.y)
      .addScaledVector(cameraBack, ropeDirection.z)
      .normalize();
    this.cicadaRoot.position.copy(this.stickAnchor.position).addScaledVector(worldRopeDirection, attachment.ropeLength);
    // Cicadidae_Body.glb extends from its attachment along local -X.
    this.cicadaRoot.quaternion.setFromUnitVectors(new THREE.Vector3(-1, 0, 0), worldRopeDirection);
    // 蝉整体绕绳轴(身体长轴)固定翻滚:调整静止姿态的朝向,避免翅膀正对摄像机。
    // const roll = new THREE.Quaternion().setFromAxisAngle(worldRopeDirection, tuning.cicadaRoll);
    // this.cicadaRoot.quaternion.multiply(roll);
    this.updateRope(dt);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  resize(): void {
    const { clientWidth: width, clientHeight: height } = this.renderer.domElement;
    if (!width || !height || (width === this.lastSize.width && height === this.lastSize.height)) return;
    this.lastSize = { width, height };
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  dispose(): void {
    this.rope?.dispose();
    this.renderer.dispose();
  }

  private prepare(root: THREE.Object3D): void {
    root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => { material.side = THREE.DoubleSide; });
      mesh.castShadow = false;
    });
  }

  private updateRope(dt: number): void {
    if (!this.rope) return;
    const start = this.stickAnchor.getWorldPosition(new THREE.Vector3());
    start.addScaledVector(new THREE.Vector3(0, -1, 0), 0.3);
    const end = this.bodyAnchor.getWorldPosition(new THREE.Vector3());
    this.rope.update(start, end, attachment.ropeLength, tuning.ropeGravity, tuning.ropeDamping, dt);
  }
}

class Rope {
  readonly segments: number;
  private readonly points: THREE.Vector3[];
  private readonly previous: THREE.Vector3[];
  private readonly geometry: THREE.BufferGeometry;
  private readonly line: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;

  constructor(scene: THREE.Scene, segments: number) {
    this.segments = Math.max(3, segments);
    this.points = Array.from({ length: this.segments + 1 }, () => new THREE.Vector3());
    this.previous = this.points.map((point) => point.clone());
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setFromPoints(this.points);
    this.line = new THREE.Line(this.geometry, new THREE.LineBasicMaterial({ color: 0xe63b32 }));
    scene.add(this.line);
  }

  update(start: THREE.Vector3, end: THREE.Vector3, length: number, gravity: number, damping: number, dt: number): void {
    if (this.points[0].distanceTo(start) > 3 || this.points[this.segments].distanceTo(end) > 3) {
      this.points.forEach((point, index) => point.lerpVectors(start, end, index / this.segments));
      this.previous.forEach((point, index) => point.copy(this.points[index]));
    }
    this.points[0].copy(start);
    this.points[this.segments].copy(end);
    for (let i = 1; i < this.segments; i += 1) {
      const current = this.points[i];
      const velocity = current.clone().sub(this.previous[i]).multiplyScalar(damping);
      this.previous[i].copy(current);
      current.add(velocity).y -= gravity * dt * dt;
    }
    const segmentLength = length / this.segments;
    for (let pass = 0; pass < 5; pass += 1) {
      this.points[0].copy(start);
      this.points[this.segments].copy(end);
      for (let i = 0; i < this.segments; i += 1) {
        const a = this.points[i];
        const b = this.points[i + 1];
        const offset = b.clone().sub(a);
        const distance = Math.max(offset.length(), 0.0001);
        const correction = offset.multiplyScalar((distance - segmentLength) / distance);
        if (i > 0) a.addScaledVector(correction, 0.5);
        if (i + 1 < this.segments) b.addScaledVector(correction, -0.5);
      }
    }
    this.geometry.setFromPoints(this.points);
  }

  dispose(): void {
    this.geometry.dispose();
    this.line.material.dispose();
    this.line.removeFromParent();
  }
}

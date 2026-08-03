export type MotionSample = {
  gravity: { x: number; y: number; z: number };
  shake: number;
  rotationAroundStick: number;
  rotationTravel: number;
  horizontalTravel: number;
  supported: boolean;
  attitude: { alpha: number; beta: number; gamma: number };
};

type MotionPermissionEvent = typeof DeviceMotionEvent & { requestPermission?: () => Promise<PermissionState> };
type OrientationPermissionEvent = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<PermissionState> };

export class MotionInput {
  private gravity = { x: 0, y: -9.8, z: 0 };
  private shake = 0;
  private enabled = false;
  private lastTime = 0;
  private highPass = 0;
  private gyroEnergy = 0;
  private accelerationWeight = 1;
  private gyroWeight = 0.018;
  private rotationAroundStick = 0;
  private pendingRotationTravel = 0;
  private pendingHorizontalTravel = 0;
  private lastRotationTime = 0;
  private attitude = { alpha: 0, beta: 0, gamma: 0 };
  private readonly smoothing = 0.12;

  async enable(): Promise<boolean> {
    window.addEventListener('devicemotion', this.onMotion, { passive: true });
    window.addEventListener('deviceorientation', this.onOrientation, { passive: true });
    this.enabled = true;
    return true;
  }

  async requestPermission(): Promise<boolean> {
    const motionEvent = window.DeviceMotionEvent as unknown as MotionPermissionEvent | undefined;
    const orientationEvent = window.DeviceOrientationEvent as unknown as OrientationPermissionEvent | undefined;
    if (!motionEvent) return false;
    if (typeof motionEvent.requestPermission === 'function') {
      const result = await motionEvent.requestPermission();
      if (result !== 'granted') return false;
    }
    if (typeof orientationEvent?.requestPermission === 'function') {
      const result = await orientationEvent.requestPermission();
      if (result !== 'granted') return false;
    }
    return true;
  }

  /**
   * iOS 13+ 的 DeviceMotionEvent 暴露 requestPermission，必须由用户点击
   * （同步手势回调）触发，否则系统会静默拒绝。true 表示需要先弹出
   * 激活弹窗，让用户在弹窗按钮（新的用户手势）中手动授权。
   */
  get requiresPermissionPrompt(): boolean {
    const motionEvent = window.DeviceMotionEvent as unknown as MotionPermissionEvent | undefined;
    return typeof motionEvent?.requestPermission === 'function';
  }

  get supported(): boolean {
    return typeof window.DeviceMotionEvent !== 'undefined';
  }

  sample(): MotionSample {
    this.highPass *= 0.88;
    this.gyroEnergy *= 0.88;
    this.shake *= 0.88;
    if (performance.now() - this.lastRotationTime > 120) this.rotationAroundStick *= 0.84;
    const shake = Math.max(this.shake, this.highPass * this.accelerationWeight + this.gyroEnergy * this.gyroWeight);
    const rotationTravel = this.pendingRotationTravel;
    const horizontalTravel = this.pendingHorizontalTravel;
    this.pendingRotationTravel = 0;
    this.pendingHorizontalTravel = 0;
    return { gravity: this.gravity, shake, rotationAroundStick: this.rotationAroundStick, rotationTravel, horizontalTravel, supported: this.supported && this.enabled, attitude: this.attitude };
  }

  setShakeWeights(acceleration: number, gyro: number): void {
    this.accelerationWeight = acceleration;
    this.gyroWeight = gyro;
  }

  setDesktopShake(amount: number): void {
    if (!this.supported || !this.enabled) this.shake = Math.max(this.shake, amount);
  }

  dispose(): void {
    window.removeEventListener('devicemotion', this.onMotion);
    window.removeEventListener('deviceorientation', this.onOrientation);
  }

  private onMotion = (event: DeviceMotionEvent): void => {
    const raw = event.accelerationIncludingGravity;
    if (!raw) return;
    const x = raw.x ?? 0;
    const y = raw.y ?? 0;
    const z = raw.z ?? 0;
    const orientation = screen.orientation?.angle ?? (window.orientation as number | undefined) ?? 0;
    const [sx, sy] = orientation === 90 ? [-y, x] : orientation === -90 || orientation === 270 ? [y, -x] : orientation === 180 ? [-x, -y] : [x, y];
    // DeviceMotion reports the measured support acceleration. The pendulum needs
    // the opposite, physical gravity direction from the stick toward the bob.
    const next = { x: -sx, y: -sy, z: -z };
    const previous = { ...this.gravity };
    this.gravity.x += (next.x - this.gravity.x) * this.smoothing;
    this.gravity.y += (next.y - this.gravity.y) * this.smoothing;
    this.gravity.z += (next.z - this.gravity.z) * this.smoothing;
    const motionNow = performance.now();
    if (this.lastTime > 0) this.pendingHorizontalTravel += (next.x - this.gravity.x) * Math.min((motionNow - this.lastTime) / 1000, 0.08);
    this.highPass = Math.max(this.highPass, Math.hypot(next.x - previous.x, next.y - previous.y, next.z - previous.z));
    const rotation = event.rotationRate;
    const gyro = rotation ? Math.hypot(rotation.alpha ?? 0, rotation.beta ?? 0, rotation.gamma ?? 0) : 0;
    if (rotation) {
      // rotationRate beta/gamma/alpha correspond to device X/Y/Z axes.
      const rotationX = rotation.beta ?? 0;
      const rotationY = rotation.gamma ?? 0;
      const orientation = screen.orientation?.angle ?? (window.orientation as number | undefined) ?? 0;
      const screenYRotation = orientation === 90 ? rotationX : orientation === -90 || orientation === 270 ? -rotationX : orientation === 180 ? -rotationY : rotationY;
      // Stick points along screen -Y after the scene's screen-space roll.
      const aroundStick = -screenYRotation * (Math.PI / 180);
      this.rotationAroundStick += (aroundStick - this.rotationAroundStick) * 0.35;
      const now = performance.now();
      if (this.lastRotationTime > 0) this.pendingRotationTravel += aroundStick * Math.min((now - this.lastRotationTime) / 1000, 0.08);
      this.lastRotationTime = now;
    }
    if (motionNow - this.lastTime > 12) this.gyroEnergy = Math.max(this.gyroEnergy, gyro);
    this.lastTime = motionNow;
  };

  private onOrientation = (event: DeviceOrientationEvent): void => {
    this.attitude.alpha = event.alpha ?? 0;
    this.attitude.beta = event.beta ?? 0;
    this.attitude.gamma = event.gamma ?? 0;
  };
}

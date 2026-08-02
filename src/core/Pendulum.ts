export type Vec3 = { x: number; y: number; z: number };

export type PendulumParameters = {
  length: number;
  maxAngularVelocity: number;
  airDamping: number;
  spinDamping: number;
  spinInputHold: number;
  spinSettleSeconds: number;
  spinSettleCurve: number;
  spinStopSpeed: number;
  gravityRestore: number;
  rotationDeadzone: number;
  rotationGain: number;
  shakeEntryTravel: number;
  shakeEnergyGain: number;
};

const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const length = (value: Vec3): number => Math.hypot(value.x, value.y, value.z);
const normalize = (value: Vec3): Vec3 => {
  const size = Math.max(length(value), 0.00001);
  return { x: value.x / size, y: value.y / size, z: value.z / size };
};
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

export class Pendulum {
  direction: Vec3 = { x: 0, y: -1, z: 0 };
  velocity: Vec3 = { x: 0, y: 0, z: 0 };
  angularSpeed = 0;
  spinning = false;
  private spinDirection = 1;
  private spinVelocity = 0;
  private spinInputRemaining = 0;
  private spinReleaseElapsed = -1;
  private spinReleaseStartVelocity = 0;

  update(dt: number, gravity: Vec3, stickAxis: Vec3, horizontalTravel: number, rotationTravel: number, params: PendulumParameters): void {
    const axis = normalize(stickAxis);
    if (this.spinning || Math.abs(horizontalTravel) >= params.shakeEntryTravel) {
      this.updateSpin(dt, axis, horizontalTravel, rotationTravel, params);
      return;
    }
    this.updateFreePendulum(dt, gravity, params);
  }

  private updateSpin(dt: number, axis: Vec3, horizontalTravel: number, rotationTravel: number, params: PendulumParameters): void {
    if (!this.spinning) {
      // Entering spin: project onto the plane whose normal is the stick axis.
      const alongStick = dot(this.direction, axis);
      const radial = {
        x: this.direction.x - axis.x * alongStick,
        y: this.direction.y - axis.y * alongStick,
        z: this.direction.z - axis.z * alongStick,
      };
      this.direction = length(radial) > 0.05 ? normalize(radial) : normalize(cross(axis, { x: 0, y: 0, z: 1 }));
      this.spinDirection = Math.sign(rotationTravel) || Math.sign(horizontalTravel) || 1;
      this.spinVelocity = 0;
      this.spinInputRemaining = params.spinInputHold;
      this.spinReleaseElapsed = -1;
      this.spinning = true;
    }

    // Horizontal travel always replenishes the current orbit. Deliberate device
    // rotation is signed, so reverse rotation first brakes then reverses it.
    const hasMovementInput = Math.abs(horizontalTravel) >= params.shakeEntryTravel * 0.25;
    const hasRotationInput = Math.abs(rotationTravel) >= params.rotationDeadzone;
    if (hasMovementInput || hasRotationInput) {
      this.spinInputRemaining = params.spinInputHold;
      this.spinReleaseElapsed = -1;
    }
    else {
      this.spinInputRemaining = Math.max(0, this.spinInputRemaining - dt);
      if (this.spinInputRemaining === 0 && this.spinReleaseElapsed < 0) {
        this.spinReleaseElapsed = 0;
        this.spinReleaseStartVelocity = this.spinVelocity;
      }
    }

    this.spinVelocity += this.spinDirection * Math.abs(horizontalTravel) * params.shakeEnergyGain;
    if (hasRotationInput) this.spinVelocity += rotationTravel * params.rotationGain;
    if (this.spinInputRemaining > 0) {
      this.spinVelocity *= Math.exp(-params.spinDamping * dt);
    } else {
      // A continuous ease-out: loss begins gently and increases smoothly until
      // the configured settle time, with no abrupt damping-mode transition.
      this.spinReleaseElapsed += dt;
      const progress = Math.min(1, this.spinReleaseElapsed / params.spinSettleSeconds);
      const initialSpeed = Math.max(Math.abs(this.spinReleaseStartVelocity), params.spinStopSpeed);
      const loss = Math.log(initialSpeed / params.spinStopSpeed) * progress ** params.spinSettleCurve;
      this.spinVelocity = Math.sign(this.spinReleaseStartVelocity || this.spinDirection) * initialSpeed * Math.exp(-loss);
    }
    this.spinVelocity = Math.max(-params.maxAngularVelocity, Math.min(params.maxAngularVelocity, this.spinVelocity));
    if (Math.abs(this.spinVelocity) > 0.02) this.spinDirection = Math.sign(this.spinVelocity);

    const tangent = normalize(cross(axis, this.direction));
    this.direction = normalize({
      x: this.direction.x + tangent.x * this.spinVelocity * dt,
      y: this.direction.y + tangent.y * this.spinVelocity * dt,
      z: this.direction.z + tangent.z * this.spinVelocity * dt,
    });
    this.velocity = {
      x: tangent.x * this.spinVelocity * params.length,
      y: tangent.y * this.spinVelocity * params.length,
      z: tangent.z * this.spinVelocity * params.length,
    };
    this.angularSpeed = Math.abs(this.spinVelocity);
    if (this.spinInputRemaining === 0 && this.spinReleaseElapsed >= params.spinSettleSeconds) {
      this.spinVelocity = 0;
      this.angularSpeed = 0;
      this.spinning = false;
    }
  }

  private updateFreePendulum(dt: number, gravity: Vec3, params: PendulumParameters): void {
    const down = normalize(gravity);
    const radial = dot(down, this.direction);
    const restoring = {
      x: (down.x - this.direction.x * radial) * params.gravityRestore,
      y: (down.y - this.direction.y * radial) * params.gravityRestore,
      z: (down.z - this.direction.z * radial) * params.gravityRestore,
    };
    this.velocity.x = (this.velocity.x + restoring.x * dt) * Math.exp(-params.airDamping * dt);
    this.velocity.y = (this.velocity.y + restoring.y * dt) * Math.exp(-params.airDamping * dt);
    this.velocity.z = (this.velocity.z + restoring.z * dt) * Math.exp(-params.airDamping * dt);
    this.direction = normalize({
      x: this.direction.x + this.velocity.x * dt / params.length,
      y: this.direction.y + this.velocity.y * dt / params.length,
      z: this.direction.z + this.velocity.z * dt / params.length,
    });
    const velocityAlongRope = dot(this.velocity, this.direction);
    this.velocity.x -= this.direction.x * velocityAlongRope;
    this.velocity.y -= this.direction.y * velocityAlongRope;
    this.velocity.z -= this.direction.z * velocityAlongRope;
    this.angularSpeed = length(this.velocity) / params.length;
  }
}

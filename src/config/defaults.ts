export type Vec3Config = { x: number; y: number; z: number };

export const attachment = {
  // Stick.glb geometry begins 0.567 units beyond its root on +X.
  // Offset it so the visible head, rather than the GLB root, is the screen anchor.
  stickOffset: { x: -0.5674, y: 0, z: 0 },
  bodyOffset: { x: 0, y: 0, z: 0 },
  wingLeftOffset: { x: 0, y: 0, z: 0 },
  wingRightOffset: { x: 0, y: 0, z: 0 },
  ropeLength: 2.4,
};

// Scene coordinates map directly to screen coordinates: +X right, +Y up.
export const layout = {
  // Fraction measured from the top of the viewport: 1 / 3 is the upper-third line.
  stickHeadScreenY: 1 / 3,
  // Stick.glb is authored along local X, so rotate it into the camera's vertical axis.
  // Local +X maps down the camera's local Y axis, from head to the bottom edge.
  stickScreenRoll: -Math.PI / 2,
};

export const tuning = {
  accelerationWeight: 1.0,
  gyroWeight: 0.018,
  rotationDeadzone: 0.002,
  rotationGain: 10,
  rotationInputSign: -1,
  shakeEntryTravel: 0.1,
  // A sustained shake reaches about 5 revolutions per second (31.4 rad/s).
  shakeEnergyGain: 100,
  maxAngularVelocity: 32,
  airDamping: 0.65,
  // Natural damping while the player keeps supplying spin input.
  spinDamping: 0.65,
  // A smooth, accelerating energy loss settles the cicada about 1.5 seconds
  // after input ends while preserving roughly five residual turns at full speed.
  spinInputHold: 0.03,
  spinSettleSeconds: 1.5,
  spinSettleCurve: 6,
  spinStopSpeed: 0.35,
  gravityRestore: 8.5,
  ropeGravity: 3.5,
  ropeDamping: 0.985,
  ropeSegments: 10,
  // 蝉整体绕绳轴(身体长轴)的固定翻滚角。默认 30°:让静止姿态的翅膀
  // 从正对摄像机偏转 30°,避免完全正面。单位:弧度。
  cicadaRoll: Math.PI / 6,
  // Fits the 6.88-unit stick between the upper-third head point and bottom centre.
  cameraDistance: 14.95,
  cameraTilt: 0.36,
  cameraFov: 38,
  spinStartSpeed: 0.8,
  spinReferenceSpeed: 3,
};

export const model = {
  stickScale: 1,
  cicadaScale: 1,
};

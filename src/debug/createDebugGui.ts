import GUI from 'lil-gui';
import { attachment, layout, model, tuning } from '../config/defaults';

type SceneConfig = { applyConfig: () => void };

const vector = (gui: GUI, title: string, value: { x: number; y: number; z: number }, changed: () => void): void => {
  const folder = gui.addFolder(title);
  folder.add(value, 'x', -3, 3, 0.01).onChange(changed);
  folder.add(value, 'y', -3, 3, 0.01).onChange(changed);
  folder.add(value, 'z', -3, 3, 0.01).onChange(changed);
};

export const createDebugGui = (scene: SceneConfig, sensorText: { value: string }): GUI => {
  const gui = new GUI({ title: 'Cicadidae 调试' });
  const apply = () => scene.applyConfig();
  vector(gui, '手柄连接', attachment.stickOffset, apply);
  vector(gui, '主体连接', attachment.bodyOffset, apply);
  vector(gui, '左翼偏移', attachment.wingLeftOffset, apply);
  vector(gui, '右翼偏移', attachment.wingRightOffset, apply);
  const layoutFolder = gui.addFolder('手柄构图');
  layoutFolder.add(layout, 'stickHeadScreenY', 0.05, 0.75, 0.01);
  layoutFolder.add(layout, 'stickScreenRoll', -Math.PI, Math.PI, 0.01).name('手柄视平面旋转');
  gui.add(attachment, 'ropeLength', 0.5, 5, 0.01);
  const motion = gui.addFolder('运动');
  motion.add(tuning, 'accelerationWeight', 0, 3, 0.01);
  motion.add(tuning, 'gyroWeight', 0, 0.1, 0.001);
  motion.add(tuning, 'rotationDeadzone', 0, 0.1, 0.001);
  motion.add(tuning, 'rotationGain', 0, 20, 0.1);
  motion.add(tuning, 'rotationInputSign', -1, 1, 2);
  motion.add(tuning, 'shakeEntryTravel', 0, 0.2, 0.001);
  motion.add(tuning, 'shakeEnergyGain', 0, 140, 0.1);
  motion.add(tuning, 'maxAngularVelocity', 1, 40, 0.1);
  motion.add(tuning, 'airDamping', 0, 8, 0.01);
  motion.add(tuning, 'spinDamping', 0, 8, 0.01).name('旋转阻尼');
  motion.add(tuning, 'spinInputHold', 0, 0.3, 0.005).name('输入保持时间');
  motion.add(tuning, 'spinSettleSeconds', 0.2, 4, 0.05).name('停输入静止时间');
  motion.add(tuning, 'spinSettleCurve', 1, 12, 0.1).name('失速加速曲线');
  motion.add(tuning, 'spinStopSpeed', 0.01, 2, 0.01).name('回归重力阈值');
  motion.add(tuning, 'gravityRestore', 0, 20, 0.1);
  const rope = gui.addFolder('红线');
  rope.add(tuning, 'ropeGravity', 0, 12, 0.1);
  rope.add(tuning, 'ropeDamping', 0.8, 1, 0.001);
  rope.add(tuning, 'ropeSegments', 3, 16, 1).onFinishChange(apply);
  const pose = gui.addFolder('蝉姿态');
  pose.add(tuning, 'cicadaRoll', -Math.PI, Math.PI, 0.01).name('绕绳轴翻滚角');
  const view = gui.addFolder('视角');
  view.add(tuning, 'cameraDistance', 3, 16, 0.1);
  view.add(tuning, 'cameraTilt', -1, 1, 0.01);
  view.add(tuning, 'cameraFov', 20, 70, 1).onChange(apply);
  const sound = gui.addFolder('声音');
  sound.add(tuning, 'spinStartSpeed', 0, 2, 0.01);
  sound.add(tuning, 'spinReferenceSpeed', 0.1, 12, 0.1);
  gui.add(model, 'stickScale', 0.1, 3, 0.01).onChange(apply);
  gui.add(model, 'cicadaScale', 0.1, 3, 0.01).onChange(apply);
  gui.add(sensorText, 'value').name('传感器');
  gui.add({ exportConfig: () => console.log(JSON.stringify({ attachment, layout, tuning, model }, null, 2)) }, 'exportConfig').name('输出配置');
  return gui;
};

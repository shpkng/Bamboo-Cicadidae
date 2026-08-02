import './style.css';
import { SoundPlayer } from './audio/SoundPlayer';
import { attachment, tuning } from './config/defaults';
import { Pendulum } from './core/Pendulum';
import { MotionInput } from './input/MotionInput';
import { CameraBackground } from './platform/CameraBackground';
import { CicadaScene } from './scene/CicadaScene';

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const cameraVideo = document.querySelector<HTMLVideoElement>('#camera')!;
const startButton = document.querySelector<HTMLButtonElement>('#start')!;
const loading = document.querySelector<HTMLElement>('#loading')!;
const hint = document.querySelector<HTMLElement>('#hint')!;
const status = document.querySelector<HTMLElement>('#status')!;

const scene = new CicadaScene(canvas);
const input = new MotionInput();
const camera = new CameraBackground(cameraVideo);
const sound = new SoundPlayer();
const pendulum = new Pendulum();
const fixedStep = 1 / 120;
let accumulator = 0;
let lastFrame = performance.now();
let active = false;

scene.load((ratio) => {
  loading.textContent = `正在加载模型 ${Math.round(ratio * 100)}%`;
}).then(async () => {
  loading.textContent = '正在请求摄像头权限';
  const cameraEnabled = await camera.enable();
  loading.textContent = cameraEnabled ? '摄像头已准备就绪' : '摄像头不可用';
  hint.textContent = cameraEnabled
    ? '点击开始后，允许运动传感器与声音权限。'
    : '无法使用摄像头，点击开始后仍可使用触摸模拟。';
  startButton.disabled = false;
}).catch((error: unknown) => {
  console.error(error);
  loading.textContent = '模型加载失败，请刷新重试';
});

startButton.addEventListener('click', async () => {
  try {
    await sound.unlock();
    await sound.load();
    sound.playDrop();
    let granted = false;
    try {
      granted = await input.enable();
    } catch (error) {
      console.warn('Motion input unavailable:', error);
    }
    active = true;
    startButton.parentElement?.classList.add('hidden');
    if (granted) status.textContent = '摄像头与运动传感器已启用';
    else status.textContent = '摄像头已启用，使用触摸模拟';
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    hint.textContent = `启动失败：${message}`;
    hint.classList.add('error');
  }
});

window.addEventListener('pointerdown', () => input.setDesktopShake(4.5));
window.addEventListener('pointermove', (event) => {
  if (event.buttons) input.setDesktopShake(Math.min(10, Math.abs(event.movementX) * 0.16 + Math.abs(event.movementY) * 0.16));
});
window.addEventListener('resize', () => scene.resize());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    sound.suspend();
    camera.setVisible(false);
  } else if (active) {
    sound.resume();
    camera.setVisible(true);
  }
});
window.addEventListener('pagehide', () => camera.dispose());

function animate(now: number): void {
  const frameDt = Math.min((now - lastFrame) / 1000, 0.1);
  lastFrame = now;
  if (active && !document.hidden) {
    accumulator += frameDt;
    const sample = input.sample();
    input.setShakeWeights(tuning.accelerationWeight, tuning.gyroWeight);
    let rotationTravel = sample.rotationTravel * tuning.rotationInputSign;
    let horizontalTravel = sample.horizontalTravel;
    while (accumulator >= fixedStep) {
      pendulum.update(fixedStep, sample.gravity, { x: 0, y: -1, z: 0 }, horizontalTravel, rotationTravel, {
        length: attachment.ropeLength,
        maxAngularVelocity: tuning.maxAngularVelocity,
        airDamping: tuning.airDamping,
        spinDamping: tuning.spinDamping,
        spinInputHold: tuning.spinInputHold,
        spinSettleSeconds: tuning.spinSettleSeconds,
        spinSettleCurve: tuning.spinSettleCurve,
        spinStopSpeed: tuning.spinStopSpeed,
        gravityRestore: tuning.gravityRestore,
        rotationDeadzone: tuning.rotationDeadzone,
        rotationGain: tuning.rotationGain,
        shakeEntryTravel: tuning.shakeEntryTravel,
        shakeEnergyGain: tuning.shakeEnergyGain,
      });
      rotationTravel = 0;
      horizontalTravel = 0;
      accumulator -= fixedStep;
    }
    sound.updateSpin(pendulum.angularSpeed, pendulum.spinning, tuning.spinStartSpeed, tuning.spinReferenceSpeed);
  }
  scene.update(pendulum.direction, frameDt);
  scene.resize();
  scene.render();
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);

export class CameraBackground {
  private stream?: MediaStream;

  constructor(private readonly video: HTMLVideoElement) {}

  async enable(): Promise<boolean> {
    if (!navigator.mediaDevices?.getUserMedia) return false;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      this.video.srcObject = this.stream;
      await this.video.play();
      return true;
    } catch (error) {
      console.warn('Camera background unavailable:', error);
      return false;
    }
  }

  setVisible(visible: boolean): void {
    if (!this.stream) return;
    if (visible) void this.video.play().catch(() => undefined);
    else this.video.pause();
  }

  dispose(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.video.srcObject = null;
    this.stream = undefined;
  }
}

const dropUrl = new URL('../../drop.aac', import.meta.url).href;
const spinUrl = new URL('../../spin.mp3', import.meta.url).href;

export class SoundPlayer {
  private context?: AudioContext;
  private dropBuffer?: AudioBuffer;
  private spinBuffer?: AudioBuffer;
  private spinSource?: AudioBufferSourceNode;
  private spinGain?: GainNode;
  private loadPromise?: Promise<void>;
  private lastPlayed = -Infinity;
  private active = 0;

  async unlock(): Promise<void> {
    this.context ??= new AudioContext();
    if (this.context.state !== 'running') await this.context.resume();
  }

  async load(): Promise<void> {
    if (!this.context) throw new Error('AudioContext must be unlocked before loading audio.');
    this.loadPromise ??= Promise.all([this.loadBuffer(dropUrl), this.loadBuffer(spinUrl)]).then(([drop, spin]) => {
      this.dropBuffer = drop;
      this.spinBuffer = spin;
    });
    return this.loadPromise;
  }

  playDrop(): void {
    if (this.dropBuffer) this.play(this.dropBuffer, 0.9);
  }

  updateSpin(angularSpeed: number, spinning: boolean, startSpeed: number, referenceSpeed: number): void {
    if (!this.context || !this.spinBuffer) return;
    if (!spinning || angularSpeed < startSpeed) {
      this.stopSpin();
      return;
    }
    const rate = Math.min(Math.max(0.75, Math.min(3, angularSpeed / Math.max(referenceSpeed, 0.01))), 1.5);
    if (!this.spinSource) {
      const source = this.context.createBufferSource();
      const gain = this.context.createGain();
      source.buffer = this.spinBuffer;
      source.loop = true;
      source.playbackRate.value = rate;
      gain.gain.setValueAtTime(0, this.context.currentTime);
      gain.gain.linearRampToValueAtTime(0.6, this.context.currentTime + 0.04);
      source.connect(gain).connect(this.context.destination);
      source.onended = () => {
        if (this.spinSource === source) {
          this.spinSource = undefined;
          this.spinGain = undefined;
        }
      };
      this.spinSource = source;
      this.spinGain = gain;
      source.start();
    } else {
      this.spinSource.playbackRate.setTargetAtTime(rate, this.context.currentTime, 0.025);
      this.spinGain?.gain.setTargetAtTime(Math.min(0.8, 0.35 + angularSpeed * 0.08), this.context.currentTime, 0.04);
    }
  }

  suspend(): void { void this.context?.suspend(); }
  resume(): void { void this.context?.resume(); }

  private async loadBuffer(url: string): Promise<AudioBuffer> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Unable to load audio: ${url}`);
    return this.context!.decodeAudioData(await response.arrayBuffer());
  }

  private stopSpin(): void {
    if (!this.context || !this.spinSource) return;
    const source = this.spinSource;
    this.spinSource = undefined;
    this.spinGain?.gain.setTargetAtTime(0.001, this.context.currentTime, 0.025);
    this.spinGain = undefined;
    source.stop(this.context.currentTime + 0.1);
  }

  private play(buffer: AudioBuffer, gainValue: number): void {
    if (!this.context || this.active >= 3) return;
    this.lastPlayed = performance.now();
    this.active += 1;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    gain.gain.value = gainValue;
    source.connect(gain).connect(this.context.destination);
    source.onended = () => { this.active -= 1; };
    source.start();
  }
}

//sec/systems/AudioManager.ts
type OscillatorKind = OscillatorType;

export class AudioManager {
  private static instance: AudioManager | null = null;

  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  private getContext(): AudioContext | null {
    const audioWindow = window as Window & {
      webkitAudioContext?: typeof AudioContext;
    };
    const AudioContextCtor = globalThis.AudioContext || audioWindow.webkitAudioContext;
    if (!AudioContextCtor) return null;

    if (!this.audioCtx) {
      this.audioCtx = new AudioContextCtor();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = 0.45;
      this.masterGain.connect(this.audioCtx.destination);
    }

    if (this.audioCtx.state === "suspended") {
      void this.audioCtx.resume();
    }

    return this.audioCtx;
  }

  playUiClick(): void {
    this.playTone({
      frequency: 620,
      duration: 0.055,
      volume: 0.08,
      type: "square",
      slideTo: 920,
    });
  }

  playHit(kind: "enemy" | "player" | "shield" = "enemy"): void {
    if (kind === "shield") {
      this.playTone({ frequency: 440, duration: 0.09, volume: 0.12, type: "sine", slideTo: 880 });
      this.playTone({ frequency: 1320, duration: 0.08, volume: 0.06, type: "triangle" });
      return;
    }

    if (kind === "player") {
      this.playTone({ frequency: 150, duration: 0.18, volume: 0.18, type: "sawtooth", slideTo: 70 });
      this.playNoise(0.12, 0.12);
      return;
    }

    this.playTone({ frequency: 260, duration: 0.07, volume: 0.12, type: "square", slideTo: 120 });
    this.playNoise(0.045, 0.06);
  }

  playDomainActivation(): void {
    this.playTone({ frequency: 96, duration: 0.55, volume: 0.18, type: "sawtooth", slideTo: 52 });
    this.playTone({ frequency: 392, duration: 0.38, volume: 0.12, type: "triangle", slideTo: 784 });
    this.playTone({ frequency: 1174.66, duration: 0.22, volume: 0.08, type: "sine" });
  }

  playBossWarning(): void {
    const audioCtx = this.getContext();
    if (!audioCtx) return;

    [0, 0.34, 0.68].forEach(delay => {
      this.playTone({
        frequency: 220,
        duration: 0.2,
        volume: 0.16,
        type: "sawtooth",
        slideTo: 160,
        delay,
      });
      this.playTone({
        frequency: 440,
        duration: 0.2,
        volume: 0.06,
        type: "square",
        slideTo: 320,
        delay,
      });
    });
  }

  private playTone(options: {
    frequency: number;
    duration: number;
    volume: number;
    type: OscillatorKind;
    slideTo?: number;
    delay?: number;
  }): void {
    const audioCtx = this.getContext();
    if (!audioCtx || !this.masterGain) return;

    const start = audioCtx.currentTime + (options.delay ?? 0);
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    oscillator.type = options.type;
    oscillator.frequency.setValueAtTime(options.frequency, start);
    if (options.slideTo) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(1, options.slideTo),
        start + options.duration
      );
    }

    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(options.volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, start + options.duration);

    oscillator.connect(gain);
    gain.connect(this.masterGain);
    oscillator.start(start);
    oscillator.stop(start + options.duration + 0.02);
  }

  private playNoise(duration: number, volume: number): void {
    const audioCtx = this.getContext();
    if (!audioCtx || !this.masterGain) return;

    const sampleCount = Math.floor(audioCtx.sampleRate * duration);
    const buffer = audioCtx.createBuffer(1, sampleCount, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount);
    }

    const source = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(this.masterGain);
    source.start();
  }
}

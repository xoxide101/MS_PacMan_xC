// Synthesized High-Definition Arcade Audio Engine (Web Audio API)
// Recreates authentic Ms. Pac-Man melodies, waka-waka, dynamic sirens, fruit chimes, and effects

class ArcadeAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;
  private wakaToggle = false;

  // Continuous ambient siren / frightened / eyes loop
  private ambientOsc: OscillatorNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientMode: 'none' | 'siren' | 'fright' | 'eyes' = 'none';
  private ambientPhase = 0;

  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.28;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.28, this.ctx.currentTime, 0.02);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType = 'triangle',
    volume = 0.35,
    delay = 0
  ): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + Math.min(0.012, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  // Authentic upbeat Ms. Pac-Man style intro fanfare
  public playStartFanfare(): void {
    this.unlock();
    if (!this.ctx || this.muted) return;
    // Cheerful jazzy arcade arpeggio inspired by Ms. Pac-Man's signature start jingle
    const melody: Array<[number, number, number]> = [
      [392.0, 0.0, 0.11],   // G4
      [440.0, 0.11, 0.11],  // A4
      [493.88, 0.22, 0.11], // B4
      [587.33, 0.33, 0.13], // D5
      [659.25, 0.47, 0.11], // E5
      [587.33, 0.58, 0.11], // D5
      [698.46, 0.7, 0.12],  // F5
      [783.99, 0.83, 0.13], // G5
      [659.25, 0.97, 0.11], // E5
      [587.33, 1.09, 0.11], // D5
      [523.25, 1.21, 0.13], // C5
      [659.25, 1.35, 0.11], // E5
      [783.99, 1.47, 0.16], // G5
      [1046.5, 1.64, 0.26], // C6
    ];
    const bass: Array<[number, number, number]> = [
      [196.0, 0.0, 0.28],
      [246.94, 0.33, 0.28],
      [261.63, 0.7, 0.28],
      [220.0, 1.09, 0.26],
      [261.63, 1.47, 0.42],
    ];
    for (const [f, t, d] of melody) {
      this.playTone(f, f * 1.004, d, 'square', 0.2, t);
      this.playTone(f * 0.5, f * 0.5, d, 'triangle', 0.14, t);
    }
    for (const [f, t, d] of bass) {
      this.playTone(f, f, d, 'triangle', 0.22, t);
    }
  }

  public playWaka(): void {
    this.unlock();
    this.wakaToggle = !this.wakaToggle;
    if (this.wakaToggle) {
      this.playTone(260, 540, 0.075, 'triangle', 0.32);
    } else {
      this.playTone(520, 240, 0.075, 'triangle', 0.3);
    }
  }

  public playPowerPellet(): void {
    this.unlock();
    this.playTone(220, 880, 0.18, 'sawtooth', 0.22);
    this.playTone(330, 1180, 0.22, 'triangle', 0.25, 0.05);
  }

  public playEatGhost(): void {
    this.unlock();
    this.playTone(280, 1280, 0.28, 'sawtooth', 0.26);
    this.playTone(420, 1680, 0.24, 'square', 0.18, 0.06);
  }

  public playFruitBounce(): void {
    if (!this.ctx || this.muted) return;
    this.playTone(540, 740, 0.045, 'sine', 0.12);
  }

  public playEatFruit(): void {
    this.unlock();
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((f, i) => {
      this.playTone(f, f * 1.03, 0.08, 'square', 0.18, i * 0.045);
    });
  }

  public playExtraLife(): void {
    this.unlock();
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5, 1567.98];
    notes.forEach((f, i) => {
      this.playTone(f, f, 0.09, 'square', 0.22, i * 0.08);
    });
  }

  public playDeath(): void {
    this.unlock();
    this.stopAmbient();
    const steps = 10;
    for (let i = 0; i < steps; i++) {
      const fStart = 760 - i * 56;
      const fEnd = fStart - 90;
      this.playTone(fStart, Math.max(85, fEnd), 0.11, 'sawtooth', 0.22, i * 0.095);
    }
    this.playTone(170, 62, 0.24, 'triangle', 0.3, steps * 0.095);
  }

  public playStageClear(): void {
    this.unlock();
    this.stopAmbient();
    const fanfare = [523.25, 659.25, 783.99, 1046.5, 987.77, 1046.5, 1318.5];
    fanfare.forEach((f, i) => {
      this.playTone(f, f, 0.14, 'square', 0.2, i * 0.11);
      this.playTone(f * 0.5, f * 0.5, 0.14, 'triangle', 0.16, i * 0.11);
    });
  }

  public updateAmbient(
    mode: 'none' | 'siren' | 'fright' | 'eyes',
    dt: number,
    intensity: number // 0..1 as fewer dots remain
  ): void {
    if (!this.ctx || !this.masterGain || this.muted || mode === 'none') {
      this.stopAmbient();
      return;
    }

    if (!this.ambientOsc || !this.ambientGain || this.ambientMode !== mode) {
      this.stopAmbient();
      this.ambientOsc = this.ctx.createOscillator();
      this.ambientGain = this.ctx.createGain();
      this.ambientOsc.type = mode === 'eyes' ? 'sine' : mode === 'fright' ? 'triangle' : 'sine';
      this.ambientGain.gain.value = mode === 'eyes' ? 0.12 : mode === 'fright' ? 0.14 : 0.08;
      this.ambientOsc.connect(this.ambientGain);
      this.ambientGain.connect(this.masterGain);
      this.ambientOsc.start();
      this.ambientMode = mode;
    }

    const now = this.ctx.currentTime;
    if (mode === 'siren') {
      const rate = 2.1 + intensity * 2.4;
      this.ambientPhase += dt * rate * Math.PI * 2;
      const base = 175 + intensity * 95;
      const span = 52 + intensity * 34;
      const freq = base + Math.sin(this.ambientPhase) * span;
      this.ambientOsc.frequency.setTargetAtTime(freq, now, 0.02);
    } else if (mode === 'fright') {
      this.ambientPhase += dt * 7.5 * Math.PI * 2;
      const freq = 148 + Math.sin(this.ambientPhase) * 38;
      this.ambientOsc.frequency.setTargetAtTime(freq, now, 0.015);
    } else if (mode === 'eyes') {
      this.ambientPhase += dt * 11 * Math.PI * 2;
      const freq = 520 + Math.sin(this.ambientPhase) * 165;
      this.ambientOsc.frequency.setTargetAtTime(freq, now, 0.012);
    }
  }

  public stopAmbient(): void {
    if (this.ambientOsc) {
      try {
        this.ambientOsc.stop();
        this.ambientOsc.disconnect();
      } catch {
        // ignore if already stopped
      }
      this.ambientOsc = null;
    }
    if (this.ambientGain) {
      try {
        this.ambientGain.disconnect();
      } catch {
        // ignore
      }
      this.ambientGain = null;
    }
    this.ambientMode = 'none';
  }
}

export const arcadeAudio = new ArcadeAudioEngine();

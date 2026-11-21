// Offline Web Audio Fantasy SFX + Optional Arcade Announcer Synth for Gauntlet: Dark Legacy 3D

class GauntletSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;
  private voiceEnabled = true;
  private lastVoiceAt = 0;

  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.3;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.3, this.ctx.currentTime, 0.02);
    }
    if (muted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
  }

  public setVoiceEnabled(enabled: boolean): void {
    this.voiceEnabled = enabled;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public isVoiceEnabled(): boolean {
    return this.voiceEnabled;
  }

  private tone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType = 'triangle',
    vol = 0.32,
    delay = 0
  ): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(24, freqStart), now);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(24, freqEnd), now + duration);
    }
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(vol, now + Math.min(0.015, duration * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  private noise(duration: number, vol = 0.25, highpass = 600, delay = 0): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime + delay;
    const sampleCount = Math.max(256, Math.floor(this.ctx.sampleRate * duration));
    const buf = this.ctx.createBuffer(1, sampleCount, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleCount * 0.45));
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = highpass > 1200 ? 'bandpass' : 'lowpass';
    filter.frequency.setValueAtTime(highpass, now);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    src.start(now);
  }

  public speakNarrator(line: string, priority = false): void {
    if (this.muted || !this.voiceEnabled || typeof window === 'undefined') return;
    if (!('speechSynthesis' in window)) return;
    const now = performance.now();
    if (!priority && now - this.lastVoiceAt < 2600) return;
    this.lastVoiceAt = now;
    try {
      if (priority) window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(line);
      utter.rate = 0.96;
      utter.pitch = 0.72; // Deep dramatic Gauntlet wizard/narrator timbre
      utter.volume = 0.72;
      window.speechSynthesis.speak(utter);
    } catch {
      // ignore offline environments without TTS voices
    }
  }

  public playMeleeSlash(comboStep: number): void {
    this.unlock();
    const pitch = 1 + comboStep * 0.18;
    this.noise(0.11, 0.22, 1600 * pitch);
    this.tone(420 * pitch, 140 * pitch, 0.12, 'sawtooth', 0.22);
    if (comboStep >= 2) {
      this.tone(720, 260, 0.16, 'triangle', 0.24, 0.02);
    }
  }

  public playHeavySmash(): void {
    this.unlock();
    this.noise(0.24, 0.34, 420);
    this.tone(240, 52, 0.28, 'sawtooth', 0.36);
    this.tone(160, 40, 0.32, 'square', 0.22, 0.03);
  }

  public playRangedShot(element: 'burn' | 'freeze' | 'shock' | 'poison'): void {
    this.unlock();
    if (element === 'burn') {
      this.noise(0.1, 0.16, 900);
      this.tone(540, 190, 0.11, 'sawtooth', 0.2);
    } else if (element === 'freeze') {
      this.tone(1120, 680, 0.1, 'sine', 0.22);
      this.tone(1680, 980, 0.08, 'triangle', 0.16, 0.02);
    } else if (element === 'shock') {
      this.tone(920, 280, 0.09, 'square', 0.18);
      this.tone(1480, 440, 0.07, 'sawtooth', 0.14, 0.02);
    } else {
      this.tone(360, 580, 0.1, 'triangle', 0.2);
      this.noise(0.08, 0.12, 1400);
    }
  }

  public playTurboAttack(): void {
    this.unlock();
    this.noise(0.32, 0.34, 800);
    this.tone(220, 880, 0.26, 'sawtooth', 0.3);
    this.tone(330, 1100, 0.3, 'triangle', 0.26, 0.04);
    this.tone(110, 55, 0.36, 'square', 0.22, 0.06);
  }

  public playPotionBlast(): void {
    this.unlock();
    this.noise(0.55, 0.42, 650);
    const chord = [261.6, 329.6, 392.0, 523.2, 784.0];
    chord.forEach((f, i) => {
      this.tone(f, f * 1.45, 0.42, 'sawtooth', 0.18, i * 0.03);
    });
  }

  public playBarrelExplosion(): void {
    this.unlock();
    this.noise(0.42, 0.45, 340);
    this.tone(180, 38, 0.4, 'sawtooth', 0.4);
    this.tone(95, 28, 0.46, 'square', 0.32, 0.04);
  }

  public playEnemyHit(heavy = false): void {
    this.unlock();
    this.tone(heavy ? 180 : 280, heavy ? 68 : 110, heavy ? 0.14 : 0.08, 'sawtooth', heavy ? 0.26 : 0.16);
  }

  public playPlayerHurt(): void {
    this.unlock();
    this.tone(220, 85, 0.18, 'sawtooth', 0.3);
    this.tone(150, 62, 0.22, 'square', 0.2, 0.03);
  }

  public playGoldPickup(): void {
    this.unlock();
    this.tone(1046.5, 1318.5, 0.07, 'sine', 0.2);
    this.tone(1568, 2093, 0.09, 'triangle', 0.16, 0.04);
  }

  public playFoodEat(): void {
    this.unlock();
    this.tone(392, 523.25, 0.09, 'triangle', 0.24);
    this.tone(523.25, 659.25, 0.11, 'sine', 0.22, 0.07);
  }

  public playPoisonHurt(): void {
    this.unlock();
    this.tone(280, 120, 0.22, 'sawtooth', 0.28);
    this.tone(205, 92, 0.26, 'square', 0.22, 0.06);
  }

  public playKeyUnlock(): void {
    this.unlock();
    this.tone(784, 1046.5, 0.09, 'triangle', 0.24);
    this.tone(1046.5, 1568, 0.14, 'sine', 0.22, 0.06);
  }

  public playRunestoneFanfare(): void {
    this.unlock();
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((n, idx) => {
      this.tone(n, n * 1.005, 0.24, 'triangle', 0.24, idx * 0.07);
      this.tone(n * 0.5, n * 0.5, 0.26, 'sine', 0.16, idx * 0.07);
    });
  }

  public playLegendaryClaim(): void {
    this.unlock();
    const notes = [440, 554.37, 659.25, 880, 1108.73, 1318.5];
    notes.forEach((n, idx) => {
      this.tone(n, n, 0.22, 'sawtooth', 0.16, idx * 0.065);
      this.tone(n, n * 1.01, 0.28, 'triangle', 0.2, idx * 0.065);
    });
  }

  public playLevelUp(): void {
    this.unlock();
    const notes = [392, 493.88, 587.33, 783.99, 987.77];
    notes.forEach((n, idx) => {
      this.tone(n, n, 0.2, 'square', 0.15, idx * 0.06);
      this.tone(n * 1.5, n * 1.5, 0.22, 'triangle', 0.14, idx * 0.06);
    });
  }

  public playPortalWarp(): void {
    this.unlock();
    this.tone(240, 960, 0.36, 'sine', 0.26);
    this.tone(360, 1440, 0.38, 'triangle', 0.18, 0.04);
  }

  public playDeathBell(): void {
    this.unlock();
    this.tone(146.8, 138, 0.65, 'sawtooth', 0.26);
    this.tone(293.6, 277, 0.55, 'triangle', 0.2, 0.02);
  }

  public playBossRoar(): void {
    this.unlock();
    this.noise(0.6, 0.36, 360);
    this.tone(155, 52, 0.55, 'sawtooth', 0.36);
    this.tone(110, 44, 0.65, 'square', 0.24, 0.05);
  }

  public playBossVictory(): void {
    this.unlock();
    const notes = [392, 523.25, 659.25, 783.99, 659.25, 1046.5];
    notes.forEach((n, idx) => {
      this.tone(n, n, idx === notes.length - 1 ? 0.52 : 0.16, 'triangle', 0.26, idx * 0.1);
      this.tone(n * 0.5, n * 0.5, 0.24, 'sawtooth', 0.12, idx * 0.1);
    });
  }
}

export const gauntletSfx = new GauntletSoundEngine();

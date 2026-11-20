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

  // Distinct playful bouncy Jr. Pac-Man intro jingle
  public playJrStartFanfare(): void {
    this.unlock();
    if (!this.ctx || this.muted) return;
    const notes: Array<[number, number, number]> = [
      [523.25, 0.0, 0.1],   // C5
      [659.25, 0.1, 0.1],   // E5
      [783.99, 0.2, 0.1],   // G5
      [698.46, 0.31, 0.09], // F5
      [659.25, 0.41, 0.1],  // E5
      [587.33, 0.52, 0.12], // D5
      [493.88, 0.65, 0.1],  // B4
      [587.33, 0.76, 0.1],  // D5
      [783.99, 0.87, 0.11], // G5
      [880.0, 0.99, 0.11],  // A5
      [783.99, 1.11, 0.1],  // G5
      [659.25, 1.22, 0.11], // E5
      [1046.5, 1.35, 0.14], // C6
      [1318.5, 1.5, 0.28],  // E6
    ];
    for (const [f, t, d] of notes) {
      this.playTone(f, f * 1.01, d, 'square', 0.19, t);
      this.playTone(f * 0.5, f * 0.5, d, 'triangle', 0.16, t);
    }
  }

  // Deeper rich chomp for mutated 50-pt super dots
  public playBigDotWaka(): void {
    this.unlock();
    this.wakaToggle = !this.wakaToggle;
    if (this.wakaToggle) {
      this.playTone(170, 410, 0.095, 'sawtooth', 0.24);
      this.playTone(340, 620, 0.085, 'triangle', 0.2);
    } else {
      this.playTone(390, 155, 0.095, 'sawtooth', 0.24);
      this.playTone(580, 310, 0.085, 'triangle', 0.2);
    }
  }

  // Soft sparkle ping when roaming toy mutates a regular dot into a big dot
  public playDotMutate(): void {
    if (!this.ctx || this.muted) return;
    this.playTone(680, 1020, 0.055, 'sine', 0.1);
  }

  // Dramatic arcade boom when a roaming toy collides with and destroys a power energizer!
  public playEnergizerExplode(): void {
    this.unlock();
    this.playTone(460, 58, 0.38, 'sawtooth', 0.34);
    this.playTone(280, 42, 0.42, 'square', 0.25, 0.04);
    this.playTone(920, 120, 0.22, 'triangle', 0.2, 0.02);
  }

  // Iconic 1980 Classic Pac-Man opening fanfare
  public playClassicStartFanfare(): void {
    this.unlock();
    if (!this.ctx || this.muted) return;
    const notes: Array<[number, number, number]> = [
      [493.88, 0.0, 0.11],  // B4
      [987.77, 0.12, 0.11], // B5
      [739.99, 0.24, 0.11], // F#5
      [622.25, 0.36, 0.11], // D#5
      [987.77, 0.48, 0.08], // B5
      [739.99, 0.58, 0.16], // F#5
      [622.25, 0.76, 0.22], // D#5
      [523.25, 1.0, 0.11],  // C5
      [1046.5, 1.12, 0.11], // C6
      [783.99, 1.24, 0.11], // G5
      [659.25, 1.36, 0.11], // E5
      [1046.5, 1.48, 0.08], // C6
      [783.99, 1.58, 0.16], // G5
      [659.25, 1.76, 0.24], // E5
    ];
    for (const [f, t, d] of notes) {
      this.playTone(f, f, d, 'square', 0.2, t);
      this.playTone(f * 0.5, f * 0.5, d, 'triangle', 0.14, t);
    }
  }

  // Upbeat Super Pac-Man opening fanfare
  public playSuperStartFanfare(): void {
    this.unlock();
    if (!this.ctx || this.muted) return;
    const notes: Array<[number, number, number]> = [
      [523.25, 0.0, 0.1],
      [659.25, 0.1, 0.1],
      [783.99, 0.2, 0.12],
      [1046.5, 0.33, 0.16],
      [880.0, 0.52, 0.1],
      [987.77, 0.63, 0.1],
      [1046.5, 0.75, 0.18],
      [783.99, 0.96, 0.12],
      [1046.5, 1.1, 0.12],
      [1318.5, 1.24, 0.26],
    ];
    for (const [f, t, d] of notes) {
      this.playTone(f, f * 1.005, d, 'square', 0.18, t);
      this.playTone(f * 0.5, f * 0.5, d, 'triangle', 0.16, t);
    }
  }

  // Key pickup & door unlock sparkle
  public playKeyUnlock(): void {
    this.unlock();
    this.playTone(880, 1320, 0.09, 'triangle', 0.26);
    this.playTone(1320, 1760, 0.12, 'sine', 0.22, 0.06);
  }

  // Giant Super Pac-Man transformation chord
  public playSuperTransform(): void {
    this.unlock();
    this.playTone(220, 660, 0.22, 'sawtooth', 0.24);
    this.playTone(330, 990, 0.26, 'square', 0.18, 0.05);
    this.playTone(440, 1320, 0.3, 'triangle', 0.22, 0.1);
  }

  // Giant Super Pac-Man smashing through a locked door
  public playGateSmash(): void {
    this.unlock();
    this.playTone(320, 95, 0.16, 'sawtooth', 0.3);
    this.playTone(540, 160, 0.12, 'square', 0.2, 0.02);
  }

  // Bouncy 1987 Pac-Mania opening synth-pop fanfare
  public playPacManiaStartFanfare(): void {
    this.unlock();
    if (!this.ctx || this.muted) return;
    const notes: Array<[number, number, number]> = [
      [587.33, 0.0, 0.09],  // D5
      [739.99, 0.1, 0.09],  // F#5
      [880.0, 0.2, 0.11],   // A5
      [987.77, 0.32, 0.09], // B5
      [880.0, 0.42, 0.09],  // A5
      [1174.66, 0.52, 0.16], // D6
      [987.77, 0.72, 0.09], // B5
      [880.0, 0.82, 0.09],  // A5
      [739.99, 0.92, 0.11], // F#5
      [880.0, 1.05, 0.11],  // A5
      [1174.66, 1.18, 0.28], // D6
    ];
    for (const [f, t, d] of notes) {
      this.playTone(f, f * 1.008, d, 'triangle', 0.24, t);
      this.playTone(f * 2, f * 2, d * 0.7, 'sine', 0.1, t);
    }
  }

  // Springy Pac-Mania jump boing!
  public playJumpBoing(): void {
    this.unlock();
    this.playTone(260, 740, 0.15, 'sine', 0.28);
    this.playTone(390, 920, 0.12, 'triangle', 0.16, 0.02);
  }

  // Faster, punchy 1982 Pac-Man Plus intro riff
  public playPlusStartFanfare(): void {
    this.unlock();
    if (!this.ctx || this.muted) return;
    const notes: Array<[number, number, number]> = [
      [523.25, 0.0, 0.08],
      [1046.5, 0.09, 0.08],
      [783.99, 0.18, 0.08],
      [659.25, 0.27, 0.08],
      [1046.5, 0.36, 0.07],
      [783.99, 0.44, 0.12],
      [659.25, 0.58, 0.14],
      [587.33, 0.75, 0.08],
      [1174.66, 0.84, 0.08],
      [880.0, 0.93, 0.08],
      [739.99, 1.02, 0.08],
      [1174.66, 1.11, 0.08],
      [880.0, 1.2, 0.12],
      [1046.5, 1.35, 0.24],
    ];
    for (const [f, t, d] of notes) {
      this.playTone(f, f * 1.005, d, 'square', 0.2, t);
      this.playTone(f * 0.5, f * 0.5, d, 'triangle', 0.14, t);
    }
  }

  // Eerie synth shimmer when Pac-Man Plus triggers invisible maze or ghost wildcard
  public playPlusWildcard(): void {
    this.unlock();
    this.playTone(980, 320, 0.22, 'sine', 0.24);
    this.playTone(640, 1240, 0.2, 'triangle', 0.18, 0.07);
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

  // --- Classic Arcade Collection Synth SFX ---

  // Crisp laser blaster shot (Centipede, Millipede, Space Invaders 1 & 2)
  public playLaser(pitch = 960): void {
    this.unlock();
    this.playTone(pitch, pitch * 0.24, 0.085, 'square', 0.2);
    this.playTone(pitch * 1.4, pitch * 0.35, 0.06, 'triangle', 0.12);
  }

  // Punchy arcade explosion (aliens, bugs, DDT bombs, boulders)
  public playExplosion(heavy = false): void {
    this.unlock();
    const dur = heavy ? 0.42 : 0.19;
    this.playTone(heavy ? 180 : 320, 38, dur, 'sawtooth', heavy ? 0.32 : 0.24);
    this.playTone(heavy ? 110 : 210, 32, dur * 1.08, 'square', heavy ? 0.22 : 0.16, 0.02);
    this.playTone(heavy ? 480 : 620, 75, dur * 0.6, 'triangle', 0.14, 0.01);
  }

  // Authentic 4-note Space Invaders descending bass march
  public playInvaderStep(stepIndex: number): void {
    if (!this.ctx || this.muted) return;
    const freqs = [98.0, 87.31, 82.41, 73.42];
    const f = freqs[stepIndex % 4];
    this.playTone(f, f * 0.92, 0.075, 'square', 0.24);
    this.playTone(f * 0.5, f * 0.48, 0.08, 'triangle', 0.18);
  }

  // Warbling UFO saucer / spider shimmer
  public playUfoPing(high = false): void {
    if (!this.ctx || this.muted) return;
    this.playTone(high ? 720 : 520, high ? 940 : 680, 0.085, 'sine', 0.12);
  }

  // Dig Dug harpoon pump hiss & inflation pitch rise
  public playPump(stage = 1): void {
    this.unlock();
    const base = 240 + stage * 115;
    this.playTone(base, base * 1.45, 0.09, 'sawtooth', 0.22);
    this.playTone(base * 0.5, base * 0.9, 0.08, 'triangle', 0.16, 0.02);
  }

  // Dig Dug balloon pop!
  public playPop(): void {
    this.unlock();
    this.playTone(680, 1420, 0.06, 'sine', 0.28);
    this.playTone(320, 70, 0.14, 'square', 0.26, 0.04);
  }

  // Dig Dug Fygar flame roar
  public playFlame(): void {
    this.unlock();
    this.playTone(220, 95, 0.24, 'sawtooth', 0.22);
    this.playTone(390, 140, 0.2, 'triangle', 0.15, 0.03);
  }

  // Boulder Dash sparkling diamond chime
  public playDiamond(): void {
    this.unlock();
    this.playTone(1046.5, 1318.5, 0.07, 'sine', 0.22);
    this.playTone(1567.98, 2093.0, 0.1, 'triangle', 0.18, 0.045);
  }

  // Boulder Dash heavy stone thud
  public playRockThud(): void {
    if (!this.ctx || this.muted) return;
    this.playTone(135, 48, 0.09, 'triangle', 0.26);
    this.playTone(95, 42, 0.07, 'square', 0.14);
  }

  // Digging dirt crunch
  public playDigStep(): void {
    if (!this.ctx || this.muted) return;
    this.playTone(190, 115, 0.038, 'triangle', 0.12);
  }

  // Food Fight throw whoosh & cream-pie splat
  public playThrow(): void {
    this.unlock();
    this.playTone(340, 780, 0.085, 'sine', 0.2);
  }

  public playSplat(): void {
    this.unlock();
    this.playTone(460, 110, 0.13, 'sawtooth', 0.25);
    this.playTone(250, 80, 0.15, 'triangle', 0.22, 0.02);
  }

  // Millipede inchworm slow-motion shimmer
  public playSlowMo(): void {
    this.unlock();
    this.playTone(880, 260, 0.28, 'sine', 0.22);
    this.playTone(660, 195, 0.32, 'triangle', 0.18, 0.05);
  }

  // Upbeat arcade round start chime for classic cabinets
  public playArcadeStart(): void {
    this.unlock();
    if (!this.ctx || this.muted) return;
    const notes: Array<[number, number, number]> = [
      [440, 0.0, 0.08],
      [554.37, 0.09, 0.08],
      [659.25, 0.18, 0.09],
      [880, 0.29, 0.22],
    ];
    for (const [f, t, d] of notes) {
      this.playTone(f, f * 1.004, d, 'square', 0.18, t);
      this.playTone(f * 0.5, f * 0.5, d, 'triangle', 0.14, t);
    }
  }

  // Defender / Stargate smart bomb shockwave
  public playSmartBomb(): void {
    this.unlock();
    this.playTone(900, 48, 0.55, 'sawtooth', 0.32);
    this.playTone(420, 36, 0.62, 'square', 0.24, 0.04);
    this.playTone(1350, 95, 0.42, 'triangle', 0.2, 0.02);
  }

  // Tempest Superzapper high-voltage surge
  public playSuperzapper(): void {
    this.unlock();
    for (let i = 0; i < 6; i++) {
      this.playTone(1400 - i * 160, 260 + i * 180, 0.08, 'sawtooth', 0.2, i * 0.05);
    }
  }

  // Racing engine pulse & gear shift chirp
  public playGearShift(high: boolean): void {
    this.unlock();
    this.playTone(high ? 160 : 240, high ? 310 : 140, 0.11, 'sawtooth', 0.16);
  }

  // Tire screech / spinout
  public playScreech(): void {
    if (!this.ctx || this.muted) return;
    this.playTone(1120, 740, 0.14, 'sawtooth', 0.12);
  }

  // Mappy springy trampoline bounce
  public playTrampolineBoing(bounces = 1): void {
    this.unlock();
    const base = 240 + bounces * 90;
    this.playTone(base, base * 1.9, 0.15, 'sine', 0.26);
    this.playTone(base * 1.2, base * 2.1, 0.11, 'triangle', 0.14, 0.02);
  }

  // Mappy door slam & microwave blast
  public playDoorSlam(): void {
    this.unlock();
    this.playTone(260, 75, 0.09, 'square', 0.24);
  }

  public playMicrowave(): void {
    this.unlock();
    this.playTone(620, 1480, 0.24, 'sawtooth', 0.22);
    this.playTone(920, 440, 0.26, 'sine', 0.18, 0.05);
  }

  // Gauntlet magic potion & warp chime
  public playPotionBlast(): void {
    this.unlock();
    const notes = [440, 587.33, 880, 1174.66, 1760];
    notes.forEach((f, i) => {
      this.playTone(f, f * 1.12, 0.12, 'triangle', 0.22, i * 0.04);
    });
  }

  // --- Platformer Classics Synth SFX (Mario, Donkey Kong, Sonic) ---

  public playCoin(): void {
    this.unlock();
    this.playTone(987.77, 987.77, 0.075, 'square', 0.2);
    this.playTone(1318.51, 1318.51, 0.22, 'square', 0.2, 0.07);
  }

  public playStomp(): void {
    this.unlock();
    this.playTone(320, 680, 0.08, 'square', 0.24);
    this.playTone(180, 95, 0.09, 'triangle', 0.22, 0.03);
  }

  public playPowBlock(): void {
    this.unlock();
    this.playTone(180, 42, 0.32, 'sawtooth', 0.34);
    this.playTone(420, 90, 0.24, 'square', 0.22, 0.03);
  }

  public playRing(): void {
    this.unlock();
    this.playTone(1396.91, 1760, 0.06, 'sine', 0.22);
    this.playTone(2093.0, 2637.02, 0.14, 'triangle', 0.18, 0.045);
  }

  public playRingScatter(): void {
    this.unlock();
    for (let i = 0; i < 6; i++) {
      this.playTone(1800 - i * 110, 920 + i * 60, 0.06, 'triangle', 0.16, i * 0.032);
    }
  }

  public playSpinDash(charge = 1): void {
    this.unlock();
    const base = 220 + charge * 90;
    this.playTone(base, base * 1.6, 0.1, 'sawtooth', 0.2);
  }

  public playSpring(): void {
    this.unlock();
    this.playTone(210, 980, 0.22, 'sine', 0.28);
    this.playTone(320, 1240, 0.18, 'triangle', 0.18, 0.03);
  }

  public playPowerUp(): void {
    this.unlock();
    const notes = [392, 493.88, 587.33, 783.99, 987.77, 1174.66];
    notes.forEach((f, i) => {
      this.playTone(f, f * 1.02, 0.08, 'square', 0.18, i * 0.055);
    });
  }

  public playSpray(): void {
    this.unlock();
    this.playTone(720, 1480, 0.065, 'sawtooth', 0.14);
  }

  public playJump(): void {
    this.playJumpBoing();
  }

  public playPaddleBounce(): void {
    this.unlock();
    this.playTone(540, 820, 0.055, 'square', 0.16);
  }

  public playMoveTick(): void {
    this.unlock();
    this.playTone(640, 860, 0.04, 'triangle', 0.14);
  }

  // --- Modern Boulder Dash 2.5D Foley SFX ---
  public playDiamondChain(combo = 1): void {
    this.unlock();
    const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5, 1567.98];
    const root = scale[Math.min(scale.length - 1, Math.max(0, combo - 1))];
    this.playTone(root * 2, root * 2.5, 0.09, 'sine', 0.24);
    this.playTone(root * 3, root * 3.04, 0.14, 'triangle', 0.18, 0.04);
    this.playTone(root * 4, root * 4.02, 0.11, 'sine', 0.11, 0.08);
  }

  public playBoulderRoll(): void {
    if (!this.ctx || this.muted) return;
    this.playTone(125, 72, 0.085, 'triangle', 0.2);
    this.playTone(86, 54, 0.075, 'sine', 0.16, 0.02);
  }

  public playBoulderPush(): void {
    if (!this.ctx || this.muted) return;
    this.playTone(110, 82, 0.09, 'sawtooth', 0.14);
    this.playTone(72, 58, 0.1, 'triangle', 0.2, 0.015);
  }

  public playMagicWallHum(): void {
    if (!this.ctx || this.muted) return;
    this.playTone(660, 1320, 0.14, 'sine', 0.18);
    this.playTone(990, 1480, 0.16, 'triangle', 0.14, 0.04);
  }

  public playAmoebaBubble(): void {
    if (!this.ctx || this.muted) return;
    const f = 220 + Math.random() * 140;
    this.playTone(f, f * 1.65, 0.075, 'sine', 0.12);
  }

  public playPickaxeDig(): void {
    if (!this.ctx || this.muted) return;
    this.playTone(320, 140, 0.048, 'triangle', 0.14);
    this.playTone(780, 460, 0.035, 'square', 0.06, 0.01);
  }

  // --- Modern Dig Dug 2.5D Foley SFX ---
  public playDigDugStep(depthLayer = 0): void {
    if (!this.ctx || this.muted) return;
    const base = 215 - depthLayer * 18;
    this.playTone(base, base * 0.62, 0.045, 'triangle', 0.14);
    this.playTone(base * 1.6, base * 0.9, 0.03, 'square', 0.05, 0.01);
  }

  public playDigDugHarpoon(): void {
    this.unlock();
    this.playTone(540, 1180, 0.075, 'triangle', 0.2);
    this.playTone(320, 740, 0.07, 'sawtooth', 0.13, 0.015);
  }

  public playDigDugInflate(stage = 1): void {
    this.unlock();
    const base = 260 + stage * 135;
    this.playTone(base, base * 1.48, 0.095, 'sawtooth', 0.22);
    this.playTone(base * 0.52, base * 0.88, 0.09, 'triangle', 0.17, 0.015);
    this.playTone(base * 1.9, base * 2.2, 0.05, 'sine', 0.1, 0.03);
  }

  public playDigDugPop(): void {
    this.unlock();
    this.playTone(760, 1680, 0.055, 'sine', 0.3);
    this.playTone(380, 62, 0.16, 'square', 0.26, 0.035);
    this.playTone(980, 260, 0.11, 'triangle', 0.18, 0.05);
  }

  public playDigDugRockWobble(): void {
    if (!this.ctx || this.muted) return;
    this.playTone(170, 118, 0.065, 'triangle', 0.18);
  }

  public playDigDugCrush(count = 1): void {
    this.unlock();
    this.playTone(140, 42, 0.18, 'sawtooth', 0.28);
    for (let i = 0; i < Math.min(4, count + 1); i++) {
      const f = 440 + i * 165;
      this.playTone(f, f * 1.15, 0.1, 'triangle', 0.2, 0.05 + i * 0.055);
    }
  }

  public playFygarCharge(): void {
    if (!this.ctx || this.muted) return;
    this.playTone(190, 460, 0.14, 'sawtooth', 0.15);
  }

  // --- Modern Food Fight 2.5D Slapstick Foley SFX ---
  public playFoodWhoosh(heavy = false): void {
    this.unlock();
    if (heavy) {
      this.playTone(240, 560, 0.11, 'sine', 0.22);
      this.playTone(170, 340, 0.1, 'triangle', 0.15, 0.015);
    } else {
      this.playTone(380, 920, 0.075, 'sine', 0.18);
      this.playTone(520, 1180, 0.06, 'triangle', 0.1, 0.01);
    }
  }

  public playFoodSplat(heavy = false): void {
    this.unlock();
    const mult = heavy ? 0.78 : 1;
    this.playTone(540 * mult, 95 * mult, heavy ? 0.17 : 0.13, 'sawtooth', heavy ? 0.28 : 0.22);
    this.playTone(310 * mult, 72 * mult, 0.15, 'triangle', 0.24, 0.018);
    this.playTone(760 * mult, 220 * mult, 0.08, 'square', 0.11, 0.03);
  }

  public playChefPopUp(): void {
    if (!this.ctx || this.muted) return;
    this.playTone(220, 620, 0.09, 'triangle', 0.14);
    this.playTone(460, 780, 0.06, 'sine', 0.1, 0.045);
  }

  public playCharleyDash(): void {
    this.unlock();
    this.playTone(320, 880, 0.085, 'triangle', 0.16);
    this.playTone(640, 1080, 0.07, 'sine', 0.11, 0.02);
  }

  public playConeChomp(): void {
    this.unlock();
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((f, i) => {
      this.playTone(f, f * 1.04, 0.1, 'triangle', 0.22, i * 0.06);
      this.playTone(f * 0.5, f * 0.5, 0.09, 'sine', 0.14, i * 0.06);
    });
  }

  public playInstantReplayFanfare(): void {
    this.unlock();
    const notes = [587.33, 739.99, 880, 1174.66];
    notes.forEach((f, i) => {
      this.playTone(f, f * 1.01, 0.11, 'square', 0.15, i * 0.075);
      this.playTone(f * 0.5, f * 0.5, 0.11, 'triangle', 0.16, i * 0.075);
    });
  }

  // --- Space Invaders Series (1978 & Part II 1979) Authentic Evolved SFX ---
  public playInvaderLaser(deluxe = false): void {
    this.unlock();
    const base = deluxe ? 1280 : 1080;
    this.playTone(base, base * 0.18, 0.11, 'sawtooth', 0.18);
    this.playTone(base * 1.55, base * 0.36, 0.075, 'square', 0.12);
    this.playTone(base * 0.72, 160, 0.09, 'triangle', 0.1, 0.015);
  }

  public playInvaderExplosion(kind: 'alien' | 'ufo' | 'player' | 'bunker' | 'clash'): void {
    this.unlock();
    if (kind === 'bunker') {
      this.playTone(460, 130, 0.065, 'sawtooth', 0.12);
      this.playTone(880, 260, 0.045, 'square', 0.08, 0.01);
      return;
    }
    if (kind === 'clash') {
      this.playTone(1350, 420, 0.08, 'square', 0.15);
      this.playTone(960, 1680, 0.06, 'triangle', 0.12, 0.015);
      return;
    }
    if (kind === 'alien') {
      // Classic Taito alien zap-pop + crisp explosion crunch
      this.playTone(740, 145, 0.14, 'sawtooth', 0.22);
      this.playTone(520, 95, 0.17, 'square', 0.16, 0.02);
      this.playTone(260, 52, 0.19, 'triangle', 0.18, 0.03);
      return;
    }
    if (kind === 'ufo') {
      // Sweeping analog saucer detonation + multi-pulse rumble
      this.playTone(620, 68, 0.42, 'sawtooth', 0.28);
      this.playTone(440, 52, 0.48, 'square', 0.2, 0.04);
      this.playTone(880, 190, 0.22, 'triangle', 0.16, 0.02);
      this.playTone(240, 38, 0.5, 'sawtooth', 0.24, 0.1);
      return;
    }
    // Player cannon crackling plasma overload disintegration
    this.playTone(210, 42, 0.48, 'sawtooth', 0.3);
    this.playTone(145, 34, 0.56, 'square', 0.22, 0.05);
    this.playTone(520, 88, 0.24, 'sawtooth', 0.18, 0.09);
    this.playTone(360, 55, 0.32, 'square', 0.16, 0.18);
  }

  public playInvaderSplit(): void {
    this.unlock();
    this.playTone(480, 1120, 0.09, 'sawtooth', 0.18);
    this.playTone(760, 340, 0.11, 'square', 0.15, 0.045);
    this.playTone(980, 1440, 0.08, 'triangle', 0.12, 0.075);
  }

  public playDropshipDeploy(): void {
    if (!this.ctx || this.muted) return;
    this.playTone(920, 380, 0.18, 'sine', 0.16);
    this.playTone(640, 260, 0.16, 'triangle', 0.13, 0.04);
  }

  public playRainbowBonus(): void {
    this.unlock();
    const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1318.5];
    notes.forEach((f, i) => {
      this.playTone(f, f * 1.02, 0.12, 'triangle', 0.2, i * 0.055);
      this.playTone(f * 0.5, f * 0.5, 0.1, 'square', 0.11, i * 0.055);
    });
  }

  public playDxHyperBeam(): void {
    this.unlock();
    this.playTone(220, 1320, 0.22, 'sawtooth', 0.26);
    this.playTone(880, 1680, 0.42, 'square', 0.16, 0.05);
    this.playTone(140, 62, 0.55, 'sawtooth', 0.28, 0.06);
    this.playTone(440, 220, 0.48, 'triangle', 0.2, 0.12);
  }

  public playDxCapsule(): void {
    this.unlock();
    const notes = [659.25, 880, 1174.66, 1318.5];
    notes.forEach((f, i) => {
      this.playTone(f, f * 1.03, 0.08, 'square', 0.14, i * 0.042);
      this.playTone(f * 0.5, f * 0.5, 0.08, 'triangle', 0.14, i * 0.042);
    });
  }

  public playDxShieldRepair(): void {
    this.unlock();
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((f, i) => {
      this.playTone(f, f * 1.06, 0.1, 'sine', 0.18, i * 0.05);
    });
  }

  // --- Puzzle Bobble Series 2.5D Cute Foley & Combo Chimes ---
  public playBubbleLaunch(): void {
    this.unlock();
    this.playTone(340, 760, 0.09, 'sine', 0.22);
    this.playTone(520, 980, 0.065, 'triangle', 0.14, 0.012);
  }

  public playBubbleBank(): void {
    if (!this.ctx || this.muted) return;
    this.playTone(620, 920, 0.055, 'sine', 0.16);
    this.playTone(880, 1240, 0.04, 'triangle', 0.1, 0.01);
  }

  public playBubbleSnap(): void {
    if (!this.ctx || this.muted) return;
    this.playTone(260, 390, 0.055, 'sine', 0.18);
    this.playTone(480, 320, 0.045, 'triangle', 0.1, 0.015);
  }

  public playBubbleSwap(): void {
    this.unlock();
    this.playTone(480, 740, 0.055, 'triangle', 0.16);
    this.playTone(740, 1020, 0.06, 'sine', 0.14, 0.035);
  }

  public playBubblePopChain(count = 3, combo = 1): void {
    this.unlock();
    const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5, 1567.98];
    const baseIdx = Math.min(4, Math.max(0, combo - 1));
    const hits = Math.min(7, Math.max(3, count));
    for (let i = 0; i < hits; i++) {
      const f = scale[Math.min(scale.length - 1, baseIdx + i)];
      const d = i * 0.042;
      this.playTone(f * 0.72, f * 1.38, 0.075, 'sine', 0.22, d);
      this.playTone(f * 1.5, f * 1.62, 0.06, 'triangle', 0.11, d + 0.012);
    }
  }

  public playBubbleAvalanche(dropCount = 1): void {
    this.unlock();
    const notes = [659.25, 783.99, 987.77, 1174.66, 1318.5, 1567.98];
    const n = Math.min(notes.length, Math.max(2, Math.ceil(dropCount / 2) + 1));
    for (let i = 0; i < n; i++) {
      const f = notes[i];
      this.playTone(f, f * 1.08, 0.095, 'triangle', 0.19, i * 0.05);
      this.playTone(f * 2, f * 2.04, 0.07, 'sine', 0.1, i * 0.05 + 0.015);
    }
  }

  public playCompressorDrop(): void {
    if (!this.ctx || this.muted) return;
    this.playTone(185, 72, 0.15, 'sawtooth', 0.22);
    this.playTone(125, 54, 0.18, 'triangle', 0.2, 0.03);
  }

  public playFairyRescue(): void {
    this.unlock();
    const notes = [587.33, 739.99, 880, 1174.66, 1479.98, 1760];
    notes.forEach((f, i) => {
      this.playTone(f, f * 1.04, 0.13, 'sine', 0.22, i * 0.055);
      this.playTone(f * 1.5, f * 1.52, 0.09, 'triangle', 0.12, i * 0.055 + 0.02);
    });
  }

  // --- Star Wars Trilogy Authentic Vector & Raster Arcade SFX ---
  public playXWingQuadLaser(torpedo = false): void {
    this.unlock();
    if (torpedo) {
      // Resonant dual Proton Torpedo launch
      this.playTone(580, 1480, 0.14, 'sawtooth', 0.24);
      this.playTone(880, 220, 0.26, 'triangle', 0.22, 0.03);
      this.playTone(320, 140, 0.28, 'sine', 0.18, 0.02);
      return;
    }
    // Iconic X-Wing quad laser "pew-kreeow" sweep
    this.playTone(1480, 220, 0.11, 'sawtooth', 0.2);
    this.playTone(1120, 180, 0.12, 'square', 0.14, 0.014);
    this.playTone(2100, 480, 0.065, 'triangle', 0.11);
  }

  public playTieScreech(): void {
    if (!this.ctx || this.muted) return;
    // Twin Ion Engine howling doppler pass
    this.playTone(920, 420, 0.32, 'sawtooth', 0.11);
    this.playTone(958, 438, 0.3, 'sawtooth', 0.09, 0.01);
    this.playTone(1420, 620, 0.24, 'triangle', 0.07, 0.02);
  }

  public playVectorExplosion(heavy = false): void {
    this.unlock();
    const dur = heavy ? 0.52 : 0.24;
    // Atari Pokey/Quadrascan vector shatter rumble + digital harmonic crackle
    this.playTone(heavy ? 240 : 420, 34, dur, 'sawtooth', heavy ? 0.3 : 0.22);
    this.playTone(heavy ? 150 : 280, 28, dur * 1.1, 'square', heavy ? 0.22 : 0.15, 0.02);
    this.playTone(heavy ? 780 : 960, 120, dur * 0.45, 'square', 0.13, 0.01);
    if (heavy) {
      this.playTone(340, 46, 0.44, 'triangle', 0.2, 0.08);
    }
  }

  public playDeathStarSupernova(): void {
    this.unlock();
    // Multi-wave seismic chain detonation + victory shimmer
    this.playTone(260, 28, 0.95, 'sawtooth', 0.34);
    this.playTone(180, 24, 1.05, 'square', 0.25, 0.06);
    this.playTone(540, 52, 0.72, 'sawtooth', 0.22, 0.16);
    this.playTone(120, 22, 1.15, 'triangle', 0.3, 0.22);
    const fanfare = [392, 523.25, 659.25, 783.99, 1046.5];
    fanfare.forEach((f, i) => {
      this.playTone(f, f * 1.005, 0.2, 'sawtooth', 0.14, 0.45 + i * 0.09);
      this.playTone(f * 0.5, f * 0.5, 0.2, 'triangle', 0.14, 0.45 + i * 0.09);
    });
  }

  public playAtAtStomp(): void {
    if (!this.ctx || this.muted) return;
    // Heavy metallic hydraulic leg impact
    this.playTone(115, 32, 0.22, 'triangle', 0.26);
    this.playTone(190, 48, 0.14, 'sawtooth', 0.14, 0.02);
  }

  public playTowCableWrap(loopCount = 1): void {
    this.unlock();
    // Harpoon magnetic latch & tension cable whine
    const base = 420 + loopCount * 165;
    this.playTone(base, base * 1.55, 0.14, 'sawtooth', 0.2);
    this.playTone(base * 0.5, base * 0.85, 0.16, 'triangle', 0.18, 0.02);
    this.playTone(base * 2, base * 1.4, 0.09, 'sine', 0.12, 0.05);
  }

  public playSpeederBikeLaser(turbo = false): void {
    this.unlock();
    if (turbo) {
      this.playTone(220, 740, 0.18, 'sawtooth', 0.18);
      this.playTone(440, 980, 0.16, 'triangle', 0.14, 0.02);
      return;
    }
    // Crisp high-energy Endor speeder blaster
    this.playTone(1680, 310, 0.085, 'square', 0.18);
    this.playTone(1240, 240, 0.09, 'sawtooth', 0.14, 0.01);
  }

  public playRasterExplosion(heavy = false): void {
    this.unlock();
    // Thick, smoky Atari 1984 raster fireball detonation
    const dur = heavy ? 0.56 : 0.28;
    this.playTone(heavy ? 190 : 300, 28, dur, 'sawtooth', heavy ? 0.34 : 0.25);
    this.playTone(heavy ? 130 : 210, 24, dur * 1.12, 'triangle', heavy ? 0.3 : 0.22, 0.025);
    this.playTone(heavy ? 480 : 640, 72, dur * 0.55, 'square', 0.14, 0.01);
    if (heavy) {
      this.playTone(290, 38, 0.48, 'sawtooth', 0.24, 0.1);
    }
  }

  public playEwokHorn(): void {
    this.unlock();
    // Heroic Ewok forest battle horn call
    this.playTone(392, 415, 0.12, 'sawtooth', 0.14);
    this.playTone(523.25, 523.25, 0.16, 'triangle', 0.18, 0.11);
    this.playTone(659.25, 659.25, 0.24, 'sawtooth', 0.14, 0.25);
  }

  public playFalconQuadLaser(): void {
    this.unlock();
    // Punchy Millennium Falcon dorsal quad-turret double pulse
    this.playTone(1320, 260, 0.095, 'sawtooth', 0.18);
    this.playTone(1580, 340, 0.08, 'square', 0.14, 0.024);
    this.playTone(880, 190, 0.1, 'triangle', 0.12, 0.015);
  }

  public playReactorKlaxon(): void {
    this.unlock();
    // Urgent Death Star II meltdown warning pulse
    this.playTone(620, 440, 0.18, 'sawtooth', 0.16);
    this.playTone(620, 440, 0.18, 'sawtooth', 0.16, 0.22);
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

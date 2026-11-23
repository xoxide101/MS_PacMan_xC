import { arcadeAudio } from './audio';

/**
 * Gentle Acoustic & Musical SFX Engine for Ys Book I & II.
 * Pure Web Audio API (zero external files, zero white-noise static, zero harsh square/sawtooth waves).
 * Crafted around warm felt piano harmonics, celesta chimes, harp plucks, and soft wooden kalimba taps.
 */
class YsAcousticSfxEngine {
  private ctx: AudioContext | null = null;
  private dryBus: GainNode | null = null;
  private wetBus: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private masterFilter: BiquadFilterNode | null = null;
  private tapStep = 0;

  private ensureContext(): AudioContext | null {
    if (arcadeAudio.isMuted()) return null;
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.masterFilter = this.ctx.createBiquadFilter();
      this.masterFilter.type = 'lowpass';
      this.masterFilter.frequency.value = 4200;
      this.masterFilter.Q.value = 0.55;
      this.masterFilter.connect(this.ctx.destination);

      this.dryBus = this.ctx.createGain();
      this.dryBus.gain.value = 0.84;
      this.dryBus.connect(this.masterFilter);

      if (typeof this.ctx.createConvolver === 'function') {
        const sr = this.ctx.sampleRate;
        const len = Math.floor(sr * 1.45);
        const ir = this.ctx.createBuffer(2, len, sr);
        for (let ch = 0; ch < 2; ch++) {
          const data = ir.getChannelData(ch);
          let lp1 = 0;
          let lp2 = 0;
          for (let i = 0; i < len; i++) {
            const t = i / len;
            // Silky smoothed exponential wooden-hall impulse response (zero harsh hiss)
            const env = Math.pow(1 - t, 2.8) * Math.min(1, i / (sr * 0.014));
            const raw = (Math.random() * 2 - 1) * env;
            lp1 += 0.18 * (raw - lp1);
            lp2 += 0.14 * (lp1 - lp2);
            data[i] = lp2 * 0.65;
          }
        }
        this.reverb = this.ctx.createConvolver();
        this.reverb.buffer = ir;
        this.wetBus = this.ctx.createGain();
        this.wetBus.gain.value = 0.34;
        this.reverb.connect(this.wetBus);
        this.wetBus.connect(this.masterFilter);
      }
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private playWarmVoice(
    freq: number,
    delay: number,
    dur: number,
    vol: number,
    opts?: {
      secondHarmonic?: number;
      thirdHarmonic?: number;
      attack?: number;
      glideTo?: number;
      wetSend?: number;
      filterHz?: number;
    }
  ): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.dryBus) return;
    const t0 = ctx.currentTime + delay;
    const attack = opts?.attack ?? 0.011;
    const filterHz = opts?.filterHz ?? Math.min(3600, freq * 4.2 + 700);

    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(filterHz, t0);
    flt.frequency.exponentialRampToValueAtTime(Math.max(420, freq * 1.85), t0 + Math.min(dur * 0.75, 0.45));

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.linearRampToValueAtTime(vol, t0 + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    flt.connect(env);
    env.connect(this.dryBus);
    if (this.reverb && (opts?.wetSend ?? 0.55) > 0) {
      const send = ctx.createGain();
      send.gain.value = opts?.wetSend ?? 0.55;
      env.connect(send);
      send.connect(this.reverb);
    }

    // Fundamental warm sine
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, t0);
    if (opts?.glideTo) {
      osc1.frequency.exponentialRampToValueAtTime(opts.glideTo, t0 + dur * 0.85);
    }
    osc1.connect(flt);
    osc1.start(t0);
    osc1.stop(t0 + dur + 0.03);

    // Optional soft 2nd harmonic (gives acoustic harp / piano body)
    const h2Amp = opts?.secondHarmonic ?? 0.24;
    if (h2Amp > 0) {
      const osc2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * 2.001, t0);
      g2.gain.setValueAtTime(h2Amp, t0);
      g2.gain.exponentialRampToValueAtTime(0.001, t0 + dur * 0.55);
      osc2.connect(g2);
      g2.connect(flt);
      osc2.start(t0);
      osc2.stop(t0 + dur * 0.65 + 0.02);
    }

    // Optional delicate 3rd harmonic sparkle (celesta / bell warmth)
    const h3Amp = opts?.thirdHarmonic ?? 0.06;
    if (h3Amp > 0 && freq < 1400) {
      const osc3 = ctx.createOscillator();
      const g3 = ctx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(freq * 3.003, t0);
      g3.gain.setValueAtTime(h3Amp, t0);
      g3.gain.exponentialRampToValueAtTime(0.001, t0 + dur * 0.34);
      osc3.connect(g3);
      g3.connect(flt);
      osc3.start(t0);
      osc3.stop(t0 + dur * 0.4 + 0.02);
    }
  }

  /** Soft wooden kalimba / gentle acoustic tap (menu cursor, shrub rustle, HUD click) */
  public playSoftTap(): void {
    const scale = [523.25, 587.33, 659.25, 783.99]; // C5 D5 E5 G5 pentatonic
    const freq = scale[this.tapStep % scale.length];
    this.tapStep++;
    this.playWarmVoice(freq, 0, 0.14, 0.052, {
      secondHarmonic: 0.16,
      thirdHarmonic: 0.0,
      attack: 0.007,
      wetSend: 0.35,
      filterHz: 1650,
    });
  }

  /** Delicate acoustic harp & celesta two-note sparkle (gold, forage gather, start chime) */
  public playHarpChime(): void {
    this.playWarmVoice(783.99, 0, 0.34, 0.064, { secondHarmonic: 0.24, thirdHarmonic: 0.08, wetSend: 0.65 }); // G5
    this.playWarmVoice(1174.66, 0.075, 0.48, 0.058, { secondHarmonic: 0.18, thirdHarmonic: 0.05, wetSend: 0.72 }); // D6
  }

  /** Lush ascending piano-harp major-9th bloom (crafting, blessing, secret discovery, equip) */
  public playDiscoveryBloom(): void {
    const notes = [523.25, 659.25, 783.99, 987.77, 1174.66]; // C5 E5 G5 B5 D6
    notes.forEach((f, i) => {
      this.playWarmVoice(f, i * 0.068, 0.56 + i * 0.06, 0.054 - i * 0.004, {
        secondHarmonic: 0.25,
        thirdHarmonic: 0.07,
        attack: 0.012,
        wetSend: 0.75,
      });
    });
  }

  /** Airy crystalline swoosh (sword lunge, magic cast — zero arcade laser buzz) */
  public playAiryCast(): void {
    this.playWarmVoice(440, 0, 0.18, 0.046, {
      glideTo: 698.46,
      secondHarmonic: 0.18,
      thirdHarmonic: 0.05,
      attack: 0.014,
      wetSend: 0.55,
      filterHz: 2100,
    });
    this.playWarmVoice(880, 0.03, 0.22, 0.032, {
      glideTo: 1318.51,
      secondHarmonic: 0.1,
      thirdHarmonic: 0,
      attack: 0.016,
      wetSend: 0.65,
    });
  }

  /** Soft muffled wooden knock (gentle wall bump / solid collision) */
  public playWoodKnock(): void {
    this.playWarmVoice(178, 0, 0.12, 0.065, {
      glideTo: 112,
      secondHarmonic: 0.15,
      thirdHarmonic: 0,
      attack: 0.006,
      wetSend: 0.22,
      filterHz: 680,
    });
  }

  /** Tactile warm marimba thump + gentle harmonic strike (bump-combat hit — zero sawtooth screech) */
  public playTactileHit(): void {
    this.playWarmVoice(220, 0, 0.14, 0.072, {
      glideTo: 146.83,
      secondHarmonic: 0.22,
      thirdHarmonic: 0.04,
      attack: 0.005,
      wetSend: 0.3,
      filterHz: 1150,
    });
    this.playWarmVoice(587.33, 0.012, 0.18, 0.036, {
      secondHarmonic: 0.18,
      thirdHarmonic: 0.06,
      attack: 0.006,
      wetSend: 0.48,
      filterHz: 2200,
    });
  }

  /** Warm resonant orchestral timpani & harp chord bloom (enemy defeat / burst — zero static explosion) */
  public playResonantBloom(): void {
    this.playWarmVoice(110, 0, 0.42, 0.085, {
      glideTo: 73.42,
      secondHarmonic: 0.2,
      thirdHarmonic: 0,
      attack: 0.009,
      wetSend: 0.5,
      filterHz: 520,
    });
    this.playWarmVoice(440, 0.03, 0.36, 0.042, { secondHarmonic: 0.2, thirdHarmonic: 0.05, wetSend: 0.65 });
    this.playWarmVoice(659.25, 0.07, 0.44, 0.038, { secondHarmonic: 0.16, thirdHarmonic: 0.04, wetSend: 0.7 });
  }

  /** Lush grand piano & harp major victory cadence (level-up, inn rest, boss clear) */
  public playPianoVictory(): void {
    const chord = [293.66, 440.0, 587.33, 739.99, 880.0, 1174.66]; // D4 A4 D5 F#5 A5 D6
    chord.forEach((f, i) => {
      this.playWarmVoice(f, i * 0.075, 0.95 + i * 0.1, 0.058 - i * 0.004, {
        secondHarmonic: 0.28,
        thirdHarmonic: 0.08,
        attack: 0.014,
        wetSend: 0.82,
      });
    });
  }

  /** Gentle contemplative descending piano minor cadence (defeat / retreat) */
  public playPianoRetreat(): void {
    const notes = [659.25, 587.33, 493.88, 440.0]; // E5 D5 B4 A4
    notes.forEach((f, i) => {
      this.playWarmVoice(f, i * 0.19, 0.85, 0.052, {
        secondHarmonic: 0.24,
        thirdHarmonic: 0.04,
        attack: 0.018,
        wetSend: 0.78,
        filterHz: 1800,
      });
    });
    this.playWarmVoice(220.0, 0.57, 1.3, 0.05, {
      secondHarmonic: 0.22,
      thirdHarmonic: 0,
      attack: 0.025,
      wetSend: 0.8,
      filterHz: 950,
    });
  }

  /** Distant warm thunder rumble for storm flashes (pure low-passed sine swell, zero static) */
  public playDistantThunder(): void {
    this.playWarmVoice(72, 0.08, 1.35, 0.068, {
      glideTo: 42,
      secondHarmonic: 0.18,
      thirdHarmonic: 0,
      attack: 0.14,
      wetSend: 0.8,
      filterHz: 240,
    });
  }
}

export const ysAcousticSfx = new YsAcousticSfxEngine();

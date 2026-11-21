import { arcadeAudio } from './audio';
import {
  ArcadeGameInstance,
  ArcadeInputState,
  ClassicGameHud,
  ClassicGamePhase,
  createEmptyInput,
  getPrecisionMoveVector,
  readHighScore,
  renderCrtOverlay,
  renderParticlesAndPopups,
  saveHighScore,
  ScorePopup,
  SimpleParticle,
  spawnBurst,
  stepParticlesAndPopups,
} from './classicArcadeInterface';

type EvoEnemyKind = 'grunt' | 'hulk' | 'spheroid' | 'enforcer' | 'quark' | 'tank' | 'brain' | 'prog' | 'motherbrain';
type EvoWeaponTier = 'TWIN PLASMA' | 'TRI-SCATTER' | 'PRISM HELIX' | 'HYPER RAIL';

interface EvoEnemy {
  id: number;
  kind: EvoEnemyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  radius: number;
  phase: number;
  shootTimer: number;
  flash: number;
}

interface EvoHuman {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: 'mom' | 'dad' | 'mikey';
  phase: number;
}

interface EvoElectrode {
  x: number;
  y: number;
  hue: number;
  phase: number;
}

interface EvoBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fromPlayer: boolean;
  hue: number;
  pierce: number;
  life: number;
  bounces: number;
  radius: number;
}

interface ShockwaveRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  hue: number;
  alpha: number;
  lineWidth: number;
}

export class RobotronEvoGame implements ArcadeGameInstance {
  public readonly logicalWidth = 840;
  public readonly logicalHeight = 640;
  public readonly supportsPointerAim = true;
  public readonly primaryActionLabel = 'PLASMA FIRE';
  public readonly secondaryActionLabel = 'MELT NOVA';

  private readonly storageKey = 'retro_arcade_robotron_2016_evo_hs_v1';
  private readonly margin = 38;

  // Offscreen Melt-o-Vision Feedback Buffer (Llamasoft / Jeff Minter style psychedelic warp!)
  private meltCanvas: HTMLCanvasElement | null = null;
  private meltCtx: CanvasRenderingContext2D | null = null;

  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();

  private score = 0;
  private highScore = 0;
  private wave = 1;
  private lives = 4;
  private nextExtraLife = 30000;

  // Player state
  private px = 420;
  private py = 320;
  private aimX = 1;
  private aimY = 0;
  private invulnTimer = 0;
  private fireCd = 0;
  private walkPhase = 0;

  // Evo Melt-o-Vision & Overdrive Systems
  private combo = 1;
  private comboTimer = 0;
  private humanStreak = 0;
  private meltGauge = 60; // 0..100 for Melt Nova pulse
  private meltIntensity = 0.45; // scales dynamically with kills & overdrive!
  private chromaticFlash = 0;
  private slowMoTimer = 0;
  private screenShake = 0;
  private clock = 0;
  private readyTimer = 0;
  private clearTimer = 0;

  // Entities
  private enemies: EvoEnemy[] = [];
  private humans: EvoHuman[] = [];
  private electrodes: EvoElectrode[] = [];
  private bullets: EvoBullet[] = [];
  private rings: ShockwaveRing[] = [];
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];
  private nextId = 1;

  constructor() {
    this.highScore = readHighScore(this.storageKey);
  }

  private ensureMeltBuffer(): void {
    if (typeof document === 'undefined') return;
    if (!this.meltCanvas) {
      this.meltCanvas = document.createElement('canvas');
      this.meltCanvas.width = this.logicalWidth;
      this.meltCanvas.height = this.logicalHeight;
      this.meltCtx = this.meltCanvas.getContext('2d');
      if (this.meltCtx) {
        this.meltCtx.fillStyle = '#03030c';
        this.meltCtx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
      }
    }
  }

  private getWeaponTier(): EvoWeaponTier {
    if (this.combo >= 24) return 'HYPER RAIL';
    if (this.combo >= 14) return 'PRISM HELIX';
    if (this.combo >= 6) return 'TRI-SCATTER';
    return 'TWIN PLASMA';
  }

  public startNewGame(): void {
    arcadeAudio.unlock();
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.wave = 1;
    this.lives = 4;
    this.nextExtraLife = 30000;
    this.combo = 1;
    this.comboTimer = 0;
    this.meltGauge = 65;
    this.meltIntensity = 0.5;
    this.setupWave(1);
    this.phase = 'READY';
    this.readyTimer = 1.05;
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  private safeSpawnPos(minDist = 145): { x: number; y: number } {
    for (let tries = 0; tries < 24; tries++) {
      const x = this.margin + 28 + Math.random() * (this.logicalWidth - (this.margin + 28) * 2);
      const y = this.margin + 28 + Math.random() * (this.logicalHeight - (this.margin + 28) * 2);
      if (Math.hypot(x - this.px, y - this.py) >= minDist) return { x, y };
    }
    return { x: this.margin + 40, y: this.margin + 40 };
  }

  private setupWave(wave: number): void {
    this.wave = wave;
    this.px = this.logicalWidth * 0.5;
    this.py = this.logicalHeight * 0.5;
    this.invulnTimer = 1.8;
    this.humanStreak = 0;
    this.enemies = [];
    this.humans = [];
    this.electrodes = [];
    this.bullets = [];
    this.rings = [];
    this.particles = [];
    this.popups = [];

    const isBossWave = wave % 3 === 0;
    const gruntCount = isBossWave ? 8 + wave : 11 + wave * 3;
    const hulkCount = Math.min(8, 2 + Math.floor(wave * 0.8));
    const spheroidCount = wave >= 2 ? Math.min(5, 1 + Math.floor(wave / 2)) : 1;
    const quarkCount = wave >= 3 ? Math.min(4, Math.floor(wave / 2)) : 0;
    const brainCount = wave >= 2 && wave % 2 === 0 ? Math.min(5, 1 + Math.floor(wave / 2)) : 0;
    const humanCount = Math.min(10, 4 + wave);
    const elecCount = Math.min(14, 5 + wave);

    for (let i = 0; i < gruntCount; i++) {
      const pos = this.safeSpawnPos(155);
      this.enemies.push({
        id: this.nextId++,
        kind: 'grunt',
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        hp: 1,
        maxHp: 1,
        radius: 13,
        phase: Math.random() * Math.PI * 2,
        shootTimer: 99,
        flash: 0,
      });
    }

    for (let i = 0; i < hulkCount; i++) {
      const pos = this.safeSpawnPos(175);
      this.enemies.push({
        id: this.nextId++,
        kind: 'hulk',
        x: pos.x,
        y: pos.y,
        vx: (Math.random() - 0.5) * 60,
        vy: (Math.random() - 0.5) * 60,
        hp: 999,
        maxHp: 999,
        radius: 17,
        phase: Math.random() * Math.PI * 2,
        shootTimer: 99,
        flash: 0,
      });
    }

    for (let i = 0; i < spheroidCount; i++) {
      const pos = this.safeSpawnPos(190);
      this.enemies.push({
        id: this.nextId++,
        kind: 'spheroid',
        x: pos.x,
        y: pos.y,
        vx: (Math.random() < 0.5 ? -1 : 1) * 85,
        vy: (Math.random() < 0.5 ? -1 : 1) * 75,
        hp: 2,
        maxHp: 2,
        radius: 15,
        phase: Math.random() * Math.PI * 2,
        shootTimer: 1.8 + Math.random() * 1.4,
        flash: 0,
      });
    }

    for (let i = 0; i < quarkCount; i++) {
      const pos = this.safeSpawnPos(190);
      this.enemies.push({
        id: this.nextId++,
        kind: 'quark',
        x: pos.x,
        y: pos.y,
        vx: (Math.random() < 0.5 ? -1 : 1) * 70,
        vy: (Math.random() < 0.5 ? -1 : 1) * 70,
        hp: 3,
        maxHp: 3,
        radius: 16,
        phase: Math.random() * Math.PI * 2,
        shootTimer: 2.2 + Math.random() * 1.6,
        flash: 0,
      });
    }

    for (let i = 0; i < brainCount; i++) {
      const pos = this.safeSpawnPos(185);
      this.enemies.push({
        id: this.nextId++,
        kind: 'brain',
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        hp: 3,
        maxHp: 3,
        radius: 15,
        phase: Math.random() * Math.PI * 2,
        shootTimer: 2.5 + Math.random() * 1.4,
        flash: 0,
      });
    }

    if (isBossWave) {
      const bossHp = 28 + wave * 6;
      this.enemies.push({
        id: this.nextId++,
        kind: 'motherbrain',
        x: this.logicalWidth * 0.5,
        y: 120,
        vx: 95,
        vy: 30,
        hp: bossHp,
        maxHp: bossHp,
        radius: 36,
        phase: 0,
        shootTimer: 1.4,
        flash: 0,
      });
      arcadeAudio.playSirenSweep();
    }

    const kinds: Array<'mom' | 'dad' | 'mikey'> = ['mom', 'dad', 'mikey'];
    for (let i = 0; i < humanCount; i++) {
      const pos = this.safeSpawnPos(90);
      const ang = Math.random() * Math.PI * 2;
      this.humans.push({
        x: pos.x,
        y: pos.y,
        vx: Math.cos(ang) * 28,
        vy: Math.sin(ang) * 28,
        kind: kinds[i % 3],
        phase: Math.random() * Math.PI * 2,
      });
    }

    for (let i = 0; i < elecCount; i++) {
      const pos = this.safeSpawnPos(110);
      this.electrodes.push({
        x: pos.x,
        y: pos.y,
        hue: (wave * 55 + i * 28) % 360,
        phase: Math.random() * Math.PI * 2,
      });
    }

    this.rings.push({
      x: this.px,
      y: this.py,
      radius: 10,
      maxRadius: 340,
      hue: (wave * 60) % 360,
      alpha: 0.9,
      lineWidth: 5,
    });
  }

  private addScore(pts: number, x?: number, y?: number, color = '#fde047', label?: string): void {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(this.storageKey, this.highScore);
    }
    if (this.score >= this.nextExtraLife) {
      this.lives = Math.min(7, this.lives + 1);
      this.nextExtraLife += 40000;
      arcadeAudio.playExtraLife();
      this.popups.push({
        x: this.px,
        y: this.py - 32,
        text: '1UP! EVO LIFE!',
        color: '#4ade80',
        life: 1.3,
        maxLife: 1.3,
      });
    }
    if (x !== undefined && y !== undefined) {
      this.popups.push({
        x,
        y,
        text: label ?? `+${pts}`,
        color,
        life: 0.8,
        maxLife: 0.8,
      });
    }
  }

  private triggerMeltNova(): void {
    if (this.meltGauge < 50) return;
    this.meltGauge = Math.max(0, this.meltGauge - 60);
    this.chromaticFlash = 1;
    this.slowMoTimer = 0.55;
    this.screenShake = 16;
    this.meltIntensity = 1.0;
    arcadeAudio.playDxHyperBeam();

    // Expanding multi-chromatic Melt-o-Vision shockwaves!
    for (let k = 0; k < 3; k++) {
      this.rings.push({
        x: this.px,
        y: this.py,
        radius: 16 + k * 24,
        maxRadius: 320 + k * 60,
        hue: (this.clock * 180 + k * 90) % 360,
        alpha: 1,
        lineWidth: 7 - k * 1.5,
      });
    }

    // Clear nearby enemy bullets & blast enemies in a huge 290px Melt Nova!
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      if (!this.bullets[i].fromPlayer) {
        spawnBurst(this.particles, this.bullets[i].x, this.bullets[i].y, '#22d3ee', 4, 120, 2.2);
        this.bullets.splice(i, 1);
      }
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const d = Math.hypot(e.x - this.px, e.y - this.py);
      if (d < 300) {
        if (e.kind === 'hulk') {
          const ang = Math.atan2(e.y - this.py, e.x - this.px);
          e.x = Math.max(this.margin + 18, Math.min(this.logicalWidth - this.margin - 18, e.x + Math.cos(ang) * 95));
          e.y = Math.max(this.margin + 18, Math.min(this.logicalHeight - this.margin - 18, e.y + Math.sin(ang) * 95));
        } else {
          e.hp -= 12;
          e.flash = 0.3;
          if (e.hp <= 0) {
            this.destroyEnemy(i);
          }
        }
      }
    }
  }

  private destroyEnemy(idx: number): void {
    const e = this.enemies[idx];
    this.enemies.splice(idx, 1);
    this.combo = Math.min(40, this.combo + 1);
    this.comboTimer = 3.2;
    this.meltGauge = Math.min(100, this.meltGauge + (e.kind === 'motherbrain' ? 40 : 4.5));
    this.meltIntensity = Math.min(1, 0.35 + this.combo * 0.025);
    this.screenShake = Math.max(this.screenShake, e.kind === 'motherbrain' ? 18 : 4.5);

    const basePts: Record<EvoEnemyKind, number> = {
      grunt: 150,
      hulk: 0,
      spheroid: 1000,
      enforcer: 250,
      quark: 1000,
      tank: 300,
      brain: 600,
      prog: 200,
      motherbrain: 5000,
    };
    const pts = Math.round(basePts[e.kind] * (1 + Math.min(3, (this.combo - 1) * 0.1)));
    const hue = (this.clock * 140 + e.x * 0.4) % 360;
    const col = `hsl(${hue}, 100%, 66%)`;
    this.addScore(pts, e.x, e.y - 10, col, e.kind === 'motherbrain' ? `OVERLORD +${pts}!` : `+${pts}`);

    if (e.kind === 'motherbrain') {
      arcadeAudio.playDeathStarSupernova();
      this.chromaticFlash = 1;
      spawnBurst(this.particles, e.x, e.y, '#f472b6', 48, 340, 5.2);
      spawnBurst(this.particles, e.x, e.y, '#22d3ee', 42, 260, 4.4);
    } else {
      arcadeAudio.playVectorExplosion(e.kind === 'spheroid' || e.kind === 'quark' || e.kind === 'brain');
      spawnBurst(this.particles, e.x, e.y, col, 16, 220, 3.4);
    }

    this.rings.push({
      x: e.x,
      y: e.y,
      radius: 6,
      maxRadius: e.kind === 'motherbrain' ? 240 : 72,
      hue,
      alpha: 0.9,
      lineWidth: e.kind === 'motherbrain' ? 6 : 3,
    });
  }

  private firePlayerWeapon(): void {
    const tier = this.getWeaponTier();
    const ang = Math.atan2(this.aimY, this.aimX);
    const baseHue = (this.clock * 220) % 360;
    const spd = tier === 'HYPER RAIL' ? 760 : 640;

    const pushShot = (a: number, hueOffset: number, pierce = 1, rad = 4.2) => {
      this.bullets.push({
        x: this.px + Math.cos(a) * 14,
        y: this.py + Math.sin(a) * 14,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        fromPlayer: true,
        hue: (baseHue + hueOffset) % 360,
        pierce,
        life: 1.15,
        bounces: 0,
        radius: rad,
      });
    };

    if (tier === 'TWIN PLASMA') {
      pushShot(ang - 0.04, 0, 1, 4);
      pushShot(ang + 0.04, 35, 1, 4);
      this.fireCd = 0.095;
    } else if (tier === 'TRI-SCATTER') {
      pushShot(ang, 0, 1, 4.4);
      pushShot(ang - 0.14, 45, 1, 3.8);
      pushShot(ang + 0.14, 90, 1, 3.8);
      this.fireCd = 0.088;
    } else if (tier === 'PRISM HELIX') {
      const waveOff = Math.sin(this.clock * 24) * 0.12;
      pushShot(ang + waveOff, 0, 2, 4.6);
      pushShot(ang - waveOff, 120, 2, 4.6);
      pushShot(ang - 0.22, 200, 1, 3.6);
      pushShot(ang + 0.22, 280, 1, 3.6);
      this.fireCd = 0.082;
    } else {
      // HYPER RAIL OVERDRIVE!
      pushShot(ang, 0, 4, 6.2);
      pushShot(ang - 0.11, 60, 2, 4.4);
      pushShot(ang + 0.11, 140, 2, 4.4);
      pushShot(ang - 0.24, 220, 1, 3.8);
      pushShot(ang + 0.24, 300, 1, 3.8);
      this.fireCd = 0.075;
    }
    arcadeAudio.playLaser(760 + Math.min(400, this.combo * 16), 310, 0.055);
  }

  public step(dt: number): void {
    this.clock += dt;
    if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - dt * 32);
    if (this.chromaticFlash > 0) this.chromaticFlash = Math.max(0, this.chromaticFlash - dt * 2.2);

    const simDt = this.slowMoTimer > 0 ? dt * 0.42 : dt;
    if (this.slowMoTimer > 0) this.slowMoTimer = Math.max(0, this.slowMoTimer - dt);

    stepParticlesAndPopups(this.particles, this.popups, dt);
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.radius += (r.maxRadius - r.radius) * Math.min(1, dt * 6.5) + 95 * dt;
      r.alpha -= dt * 1.45;
      if (r.alpha <= 0 || r.radius >= r.maxRadius) this.rings.splice(i, 1);
    }

    if (this.phase === 'TITLE' || this.phase === 'PAUSED' || this.phase === 'GAME_OVER') {
      if ((this.phase === 'TITLE' || this.phase === 'GAME_OVER') && this.input.fireJustPressed) {
        this.startNewGame();
      }
      return;
    }

    if (this.phase === 'READY') {
      this.readyTimer -= dt;
      if (this.readyTimer <= 0) this.phase = 'PLAYING';
      return;
    }

    if (this.phase === 'STAGE_CLEAR') {
      this.clearTimer -= dt;
      if (this.clearTimer <= 0) {
        this.setupWave(this.wave + 1);
        this.phase = 'READY';
        this.readyTimer = 0.95;
      }
      return;
    }

    if (this.invulnTimer > 0) this.invulnTimer -= dt;
    if (this.fireCd > 0) this.fireCd -= dt;
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = Math.max(1, Math.floor(this.combo * 0.5));
    }
    this.meltIntensity += (Math.min(0.95, 0.34 + this.combo * 0.022) - this.meltIntensity) * dt * 2.5;
    this.meltGauge = Math.min(100, this.meltGauge + dt * 2.8);

    // Player Movement (precision-damped + analog/tilt support)
    const mv = getPrecisionMoveVector(this.input);
    const speed = 265;
    this.px += mv.vx * speed * dt;
    this.py += mv.vy * speed * dt;
    this.px = Math.max(this.margin + 14, Math.min(this.logicalWidth - this.margin - 14, this.px));
    this.py = Math.max(this.margin + 14, Math.min(this.logicalHeight - this.margin - 14, this.py));
    if (Math.hypot(mv.vx, mv.vy) > 0.05) {
      this.walkPhase += dt * 16;
      if (!this.input.pointerActive) {
        const m = Math.hypot(mv.vx, mv.vy);
        this.aimX = mv.vx / m;
        this.aimY = mv.vy / m;
      }
    }

    // Twin-stick Aim: Pointer aim OR nearest threat smart-lock when standing still & firing!
    if (this.input.pointerActive) {
      const tx = this.input.pointerX * this.logicalWidth;
      const ty = this.input.pointerY * this.logicalHeight;
      const dx = tx - this.px;
      const dy = ty - this.py;
      const d = Math.hypot(dx, dy);
      if (d > 4) {
        this.aimX = dx / d;
        this.aimY = dy / d;
      }
    } else if (this.input.fire && Math.hypot(mv.vx, mv.vy) < 0.05 && this.enemies.length > 0) {
      let nearest: EvoEnemy | null = null;
      let bestD = 9999;
      for (const e of this.enemies) {
        if (e.kind === 'hulk') continue;
        const d = Math.hypot(e.x - this.px, e.y - this.py);
        if (d < bestD) {
          bestD = d;
          nearest = e;
        }
      }
      if (nearest && bestD > 1) {
        this.aimX = (nearest.x - this.px) / bestD;
        this.aimY = (nearest.y - this.py) / bestD;
      }
    }

    // Fire Plasma OR Trigger Melt-Nova!
    if (this.input.fire && this.fireCd <= 0) {
      this.firePlayerWeapon();
    }
    if (this.input.secondaryJustPressed) {
      this.triggerMeltNova();
    }

    // Update Humans (Last Human Family!)
    for (let i = this.humans.length - 1; i >= 0; i--) {
      const h = this.humans[i];
      h.phase += simDt * 7;
      h.x += h.vx * simDt;
      h.y += h.vy * simDt;
      if (h.x < this.margin + 18 || h.x > this.logicalWidth - this.margin - 18) h.vx *= -1;
      if (h.y < this.margin + 18 || h.y > this.logicalHeight - this.margin - 18) h.vy *= -1;

      if (Math.hypot(h.x - this.px, h.y - this.py) < 24) {
        this.humanStreak = Math.min(5, this.humanStreak + 1);
        const pts = this.humanStreak * 1000;
        this.meltGauge = Math.min(100, this.meltGauge + 18);
        this.addScore(pts, h.x, h.y - 12, '#4ade80', `SAVED +${pts}!`);
        arcadeAudio.playFairyRescue();
        spawnBurst(this.particles, h.x, h.y, '#4ade80', 16, 180, 3.2);
        this.humans.splice(i, 1);
      }
    }

    // Update Electrodes
    for (let i = this.electrodes.length - 1; i >= 0; i--) {
      const el = this.electrodes[i];
      el.phase += simDt * 6;
      if (this.invulnTimer <= 0 && Math.hypot(el.x - this.px, el.y - this.py) < 19) {
        this.handlePlayerHit();
        return;
      }
    }

    // Update Enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.phase += simDt * 8;
      if (e.flash > 0) e.flash -= dt;

      const dx = this.px - e.x;
      const dy = this.py - e.y;
      const dist = Math.max(1, Math.hypot(dx, dy));

      if (e.kind === 'grunt') {
        const spd = 76 + this.wave * 5.5;
        e.x += (dx / dist) * spd * simDt;
        e.y += (dy / dist) * spd * simDt;
      } else if (e.kind === 'hulk') {
        // Patrol toward nearest human or player
        let tx = this.px;
        let ty = this.py;
        if (this.humans.length > 0) {
          tx = this.humans[0].x;
          ty = this.humans[0].y;
        }
        const hd = Math.max(1, Math.hypot(tx - e.x, ty - e.y));
        e.x += ((tx - e.x) / hd) * 52 * simDt;
        e.y += ((ty - e.y) / hd) * 52 * simDt;
        // Hulks crush humans on contact
        for (let hi = this.humans.length - 1; hi >= 0; hi--) {
          if (Math.hypot(this.humans[hi].x - e.x, this.humans[hi].y - e.y) < 20) {
            spawnBurst(this.particles, this.humans[hi].x, this.humans[hi].y, '#ef4444', 12, 130, 3);
            this.humans.splice(hi, 1);
          }
        }
      } else if (e.kind === 'spheroid' || e.kind === 'quark') {
        e.x += e.vx * simDt;
        e.y += e.vy * simDt;
        if (e.x < this.margin + 22 || e.x > this.logicalWidth - this.margin - 22) e.vx *= -1;
        if (e.y < this.margin + 22 || e.y > this.logicalHeight - this.margin - 22) e.vy *= -1;
        e.shootTimer -= simDt;
        if (e.shootTimer <= 0 && this.enemies.length < 34) {
          e.shootTimer = 2.6 + Math.random() * 1.4;
          this.enemies.push({
            id: this.nextId++,
            kind: e.kind === 'spheroid' ? 'enforcer' : 'tank',
            x: e.x,
            y: e.y,
            vx: (Math.random() - 0.5) * 90,
            vy: (Math.random() - 0.5) * 90,
            hp: e.kind === 'quark' ? 2 : 1,
            maxHp: e.kind === 'quark' ? 2 : 1,
            radius: 13,
            phase: 0,
            shootTimer: 1.5,
            flash: 0,
          });
        }
      } else if (e.kind === 'enforcer' || e.kind === 'tank') {
        const spd = e.kind === 'enforcer' ? 98 : 68;
        e.x += (dx / dist) * spd * simDt + Math.cos(e.phase) * 28 * simDt;
        e.y += (dy / dist) * spd * simDt + Math.sin(e.phase) * 28 * simDt;
        e.shootTimer -= simDt;
        if (e.shootTimer <= 0) {
          e.shootTimer = e.kind === 'tank' ? 2.4 : 1.9;
          const bSpd = e.kind === 'tank' ? 240 : 210;
          this.bullets.push({
            x: e.x,
            y: e.y,
            vx: (dx / dist) * bSpd,
            vy: (dy / dist) * bSpd,
            fromPlayer: false,
            hue: e.kind === 'tank' ? 35 : 300,
            pierce: 1,
            life: 3.4,
            bounces: e.kind === 'tank' ? 2 : 0,
            radius: 5.5,
          });
        }
      } else if (e.kind === 'brain') {
        // Seek nearest human to convert into a glowing Prog!
        let targetHumanIdx = -1;
        let bestHD = 9999;
        for (let hi = 0; hi < this.humans.length; hi++) {
          const hd = Math.hypot(this.humans[hi].x - e.x, this.humans[hi].y - e.y);
          if (hd < bestHD) {
            bestHD = hd;
            targetHumanIdx = hi;
          }
        }
        const tx = targetHumanIdx >= 0 ? this.humans[targetHumanIdx].x : this.px;
        const ty = targetHumanIdx >= 0 ? this.humans[targetHumanIdx].y : this.py;
        const td = Math.max(1, Math.hypot(tx - e.x, ty - e.y));
        e.x += ((tx - e.x) / td) * 76 * simDt;
        e.y += ((ty - e.y) / td) * 76 * simDt;
        if (targetHumanIdx >= 0 && bestHD < 20) {
          const hm = this.humans[targetHumanIdx];
          this.humans.splice(targetHumanIdx, 1);
          this.enemies.push({
            id: this.nextId++,
            kind: 'prog',
            x: hm.x,
            y: hm.y,
            vx: 0,
            vy: 0,
            hp: 2,
            maxHp: 2,
            radius: 13,
            phase: 0,
            shootTimer: 99,
            flash: 0.3,
          });
          arcadeAudio.playElectricZap();
        }
      } else if (e.kind === 'prog') {
        e.x += (dx / dist) * 145 * simDt;
        e.y += (dy / dist) * 145 * simDt;
      } else if (e.kind === 'motherbrain') {
        // Overlord Cyber-Boss sweeping figure-8 + radial plasma rings!
        e.x = this.logicalWidth * 0.5 + Math.sin(this.clock * 0.85) * 240;
        e.y = 140 + Math.sin(this.clock * 1.7) * 58;
        e.shootTimer -= simDt;
        if (e.shootTimer <= 0) {
          e.shootTimer = 1.45;
          const petals = 8;
          for (let k = 0; k < petals; k++) {
            const a = (k / petals) * Math.PI * 2 + this.clock;
            this.bullets.push({
              x: e.x,
              y: e.y,
              vx: Math.cos(a) * 215,
              vy: Math.sin(a) * 215,
              fromPlayer: false,
              hue: (k * 45 + this.clock * 120) % 360,
              pierce: 1,
              life: 3.5,
              bounces: 0,
              radius: 6,
            });
          }
          arcadeAudio.playInvaderSplit();
        }
      }

      // Clamp enemy inside arena
      e.x = Math.max(this.margin + e.radius, Math.min(this.logicalWidth - this.margin - e.radius, e.x));
      e.y = Math.max(this.margin + e.radius, Math.min(this.logicalHeight - this.margin - e.radius, e.y));

      if (this.invulnTimer <= 0 && Math.hypot(e.x - this.px, e.y - this.py) < e.radius + 11) {
        this.handlePlayerHit();
        return;
      }
    }

    // Update Bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * (b.fromPlayer ? dt : simDt);
      b.y += b.vy * (b.fromPlayer ? dt : simDt);
      b.life -= dt;

      if (b.x < this.margin || b.x > this.logicalWidth - this.margin) {
        if (b.bounces > 0) {
          b.vx *= -1;
          b.bounces--;
        } else {
          this.bullets.splice(i, 1);
          continue;
        }
      }
      if (b.y < this.margin || b.y > this.logicalHeight - this.margin) {
        if (b.bounces > 0) {
          b.vy *= -1;
          b.bounces--;
        } else {
          this.bullets.splice(i, 1);
          continue;
        }
      }
      if (b.life <= 0) {
        this.bullets.splice(i, 1);
        continue;
      }

      if (b.fromPlayer) {
        let consumed = false;
        // Destroy electrodes
        for (let ei = this.electrodes.length - 1; ei >= 0; ei--) {
          if (Math.hypot(this.electrodes[ei].x - b.x, this.electrodes[ei].y - b.y) < 16) {
            spawnBurst(this.particles, this.electrodes[ei].x, this.electrodes[ei].y, '#22d3ee', 8, 150, 2.6);
            this.addScore(50);
            this.electrodes.splice(ei, 1);
            b.pierce--;
            if (b.pierce <= 0) {
              consumed = true;
              break;
            }
          }
        }
        if (consumed) {
          this.bullets.splice(i, 1);
          continue;
        }

        // Hit enemies
        for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
          const e = this.enemies[ei];
          if (Math.hypot(e.x - b.x, e.y - b.y) < e.radius + b.radius + 3) {
            if (e.kind === 'hulk') {
              // Hulks are indestructible — knock them back!
              const len = Math.max(1, Math.hypot(b.vx, b.vy));
              e.x += (b.vx / len) * 14;
              e.y += (b.vy / len) * 14;
              e.flash = 0.12;
              spawnBurst(this.particles, b.x, b.y, '#4ade80', 4, 110, 2);
              consumed = true;
              break;
            } else {
              e.hp--;
              e.flash = 0.14;
              if (e.hp <= 0) {
                this.destroyEnemy(ei);
              } else {
                spawnBurst(this.particles, b.x, b.y, '#ffffff', 5, 130, 2.2);
              }
              b.pierce--;
              if (b.pierce <= 0) {
                consumed = true;
                break;
              }
            }
          }
        }
        if (consumed) this.bullets.splice(i, 1);
      } else {
        // Enemy bullet hits player
        if (this.invulnTimer <= 0 && Math.hypot(b.x - this.px, b.y - this.py) < b.radius + 10) {
          this.bullets.splice(i, 1);
          this.handlePlayerHit();
          return;
        }
      }
    }

    // Wave Clear when all non-Hulk enemies are annihilated!
    const killableLeft = this.enemies.some((e) => e.kind !== 'hulk');
    if (!killableLeft) {
      this.addScore(1500 * this.wave, this.logicalWidth * 0.5, 220, '#38bdf8', `WAVE ${this.wave} MELTED!`);
      arcadeAudio.playStageClear();
      this.chromaticFlash = 0.9;
      this.phase = 'STAGE_CLEAR';
      this.clearTimer = 1.5;
    }
  }

  private handlePlayerHit(): void {
    this.lives--;
    this.combo = 1;
    this.chromaticFlash = 1;
    this.screenShake = 18;
    arcadeAudio.playDeath();
    spawnBurst(this.particles, this.px, this.py, '#f43f5e', 36, 280, 4.5);
    spawnBurst(this.particles, this.px, this.py, '#fde047', 24, 210, 3.6);
    this.rings.push({
      x: this.px,
      y: this.py,
      radius: 8,
      maxRadius: 240,
      hue: 350,
      alpha: 1,
      lineWidth: 6,
    });

    if (this.lives <= 0) {
      this.phase = 'GAME_OVER';
    } else {
      this.px = this.logicalWidth * 0.5;
      this.py = this.logicalHeight * 0.5;
      this.invulnTimer = 2.4;
      // Push nearby enemies back so respawn is fair
      for (const e of this.enemies) {
        const d = Math.hypot(e.x - this.px, e.y - this.py);
        if (d < 160) {
          const a = Math.atan2(e.y - this.py, e.x - this.px);
          e.x = Math.max(this.margin + 20, Math.min(this.logicalWidth - this.margin - 20, this.px + Math.cos(a) * 185));
          e.y = Math.max(this.margin + 20, Math.min(this.logicalHeight - this.margin - 20, this.py + Math.sin(a) * 185));
        }
      }
      this.bullets = this.bullets.filter((b) => b.fromPlayer);
    }
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    this.ensureMeltBuffer();

    // 1. Update Offscreen Melt-o-Vision Feedback Buffer (Psychedelic Zoom + Kaleidoscopic Spin!)
    if (this.meltCanvas && this.meltCtx) {
      const mctx = this.meltCtx;
      const w = this.logicalWidth;
      const h = this.logicalHeight;
      const zoom = 1.012 + this.meltIntensity * 0.018;
      const rot = Math.sin(this.clock * 1.15) * 0.009 * this.meltIntensity;

      mctx.save();
      mctx.globalCompositeOperation = 'source-over';
      mctx.fillStyle = `rgba(4, 3, 14, ${0.22 - this.meltIntensity * 0.07})`;
      mctx.fillRect(0, 0, w, h);

      // Draw zoomed/rotated previous frame into itself for liquid Melt-o-Vision trails!
      mctx.globalAlpha = 0.84 + this.meltIntensity * 0.09;
      mctx.translate(w * 0.5, h * 0.5);
      mctx.rotate(rot);
      mctx.scale(zoom, zoom);
      mctx.drawImage(this.meltCanvas, -w * 0.5, -h * 0.5);
      mctx.restore();

      // Stamp glowing bullets, shockwaves & plasma sparks into the Melt buffer!
      mctx.save();
      mctx.globalCompositeOperation = 'lighter';
      for (const r of this.rings) {
        mctx.strokeStyle = `hsla(${r.hue}, 100%, 62%, ${r.alpha * 0.7})`;
        mctx.lineWidth = r.lineWidth;
        mctx.beginPath();
        mctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        mctx.stroke();
      }
      for (const b of this.bullets) {
        mctx.fillStyle = `hsla(${b.hue}, 100%, 65%, 0.85)`;
        mctx.beginPath();
        mctx.arc(b.x, b.y, b.radius * 1.45, 0, Math.PI * 2);
        mctx.fill();
      }
      for (const p of this.particles) {
        const a = Math.max(0, p.life / p.maxLife);
        mctx.fillStyle = p.color;
        mctx.globalAlpha = a * 0.65;
        mctx.beginPath();
        mctx.arc(p.x, p.y, p.radius * 1.5, 0, Math.PI * 2);
        mctx.fill();
      }
      mctx.restore();
    }

    // 2. Render Final Crisp Frame onto Main Canvas
    ctx.save();
    ctx.scale(dpr, dpr);

    if (this.screenShake > 0.2) {
      ctx.translate(
        (Math.random() - 0.5) * this.screenShake,
        (Math.random() - 0.5) * this.screenShake
      );
    }

    // Blit Melt-o-Vision background canvas
    if (this.meltCanvas) {
      ctx.drawImage(this.meltCanvas, 0, 0);
      // Chromatic RGB split ghost during Melt Nova / big explosions!
      if (this.chromaticFlash > 0.05) {
        const off = this.chromaticFlash * 9;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = this.chromaticFlash * 0.35;
        ctx.drawImage(this.meltCanvas, -off, 0);
        ctx.drawImage(this.meltCanvas, off, 0);
        ctx.restore();
      }
    } else {
      ctx.fillStyle = '#04030e';
      ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
    }

    // Animated Psychedelic Hyper-Grid + Prismatic Arena Frame
    this.renderEvoArenaGrid(ctx);

    // Draw Electrodes
    for (const el of this.electrodes) {
      ctx.save();
      ctx.translate(el.x, el.y);
      ctx.rotate(el.phase * 0.7);
      ctx.strokeStyle = `hsl(${(el.hue + this.clock * 110) % 360}, 100%, 66%)`;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2;
        ctx.moveTo(Math.cos(a) * -10, Math.sin(a) * -10);
        ctx.lineTo(Math.cos(a) * 10, Math.sin(a) * 10);
      }
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw Humans
    for (const h of this.humans) {
      ctx.save();
      ctx.translate(h.x, h.y + Math.sin(h.phase) * 2);
      const col = h.kind === 'mom' ? '#f472b6' : h.kind === 'dad' ? '#38bdf8' : '#fde047';
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(0, -8, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-5, -2, 10, 11);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-7, 2);
      ctx.lineTo(7, 2);
      ctx.stroke();
      ctx.restore();
    }

    // Draw Enemies
    for (const e of this.enemies) {
      this.renderEnemy(ctx, e);
    }

    // Draw Crisp Glowing Bullets
    for (const b of this.bullets) {
      ctx.save();
      ctx.fillStyle = `hsl(${b.hue}, 100%, 66%)`;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw Player Evo Cyber-Hero + Laser Aim Reticle
    this.renderPlayer(ctx);

    renderParticlesAndPopups(ctx, this.particles, this.popups);

    // Bottom Melt-Nova & Overdrive Weapon Bar
    this.renderEvoStatusStrip(ctx);

    if (this.phase === 'TITLE') {
      this.renderTitleOverlay(ctx);
    } else if (this.phase === 'READY') {
      this.renderCenterBanner(ctx, `WAVE ${this.wave}`, this.wave % 3 === 0 ? 'WARNING: OVERLORD MOTHERBRAIN DETECTED!' : 'SAVE THE LAST HUMAN FAMILY · MELT THE HORDE!', '#22d3ee');
    } else if (this.phase === 'STAGE_CLEAR') {
      this.renderCenterBanner(ctx, `WAVE ${this.wave} MELTED!`, `OVERDRIVE COMBO ×${this.combo}`, '#f472b6');
    } else if (this.phase === 'GAME_OVER') {
      this.renderCenterBanner(ctx, 'SYSTEM TERMINATED', `FINAL SCORE ${this.score.toLocaleString()} · PRESS SPACE TO REBOOT`, '#f43f5e');
    } else if (this.phase === 'PAUSED') {
      this.renderCenterBanner(ctx, 'PAUSED', 'PRESS P TO RESUME MELT-O-VISION', '#38bdf8');
    }

    if (visualMode === 'crt') {
      renderCrtOverlay(ctx, this.logicalWidth, this.logicalHeight);
    }
    ctx.restore();
  }

  private renderEvoArenaGrid(ctx: CanvasRenderingContext2D): void {
    const hue = (this.clock * 55 + this.wave * 40) % 360;
    ctx.save();
    // Subtle warped perspective pulse rings in center
    ctx.strokeStyle = `hsla(${hue}, 90%, 55%, 0.14)`;
    ctx.lineWidth = 1.2;
    const cx = this.logicalWidth * 0.5;
    const cy = this.logicalHeight * 0.5;
    for (let i = 0; i < 6; i++) {
      const rr = ((this.clock * 65 + i * 85) % 480) + 20;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rr * 1.15, rr * 0.85, Math.sin(this.clock * 0.6) * 0.25, 0, Math.PI * 2);
      ctx.stroke();
    }

    // High-voltage rainbow glowing arena border
    ctx.strokeStyle = `hsl(${hue}, 100%, 62%)`;
    ctx.lineWidth = 4;
    ctx.strokeRect(this.margin, this.margin, this.logicalWidth - this.margin * 2, this.logicalHeight - this.margin * 2);
    ctx.strokeStyle = `hsla(${(hue + 140) % 360}, 100%, 72%, 0.65)`;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(this.margin - 6, this.margin - 6, this.logicalWidth - (this.margin - 6) * 2, this.logicalHeight - (this.margin - 6) * 2);
    ctx.restore();
  }

  private renderPlayer(ctx: CanvasRenderingContext2D): void {
    if (this.invulnTimer > 0 && Math.floor(this.clock * 20) % 2 === 0) return;
    ctx.save();
    ctx.translate(this.px, this.py);

    // Glowing aim laser sightline
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.32)';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(this.aimX * 92, this.aimY * 92);
    ctx.stroke();
    ctx.setLineDash([]);

    // Evo Energy Shield Aura
    const auraHue = (this.clock * 180) % 360;
    ctx.strokeStyle = `hsla(${auraHue}, 100%, 68%, 0.85)`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 15 + Math.sin(this.clock * 14) * 1.5, 0, Math.PI * 2);
    ctx.stroke();

    // Cyber-Hero Body
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.roundRect(-8, -6, 16, 14, 4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, -10, 6.5, 0, Math.PI * 2);
    ctx.fill();
    // Glowing Visor
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(-5, -12, 10, 3.2);
    // Stride legs
    const step = Math.sin(this.walkPhase) * 4;
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-4, 8);
    ctx.lineTo(-4 - step, 14);
    ctx.moveTo(4, 8);
    ctx.lineTo(4 + step, 14);
    ctx.stroke();
    ctx.restore();
  }

  private renderEnemy(ctx: CanvasRenderingContext2D, e: EvoEnemy): void {
    ctx.save();
    ctx.translate(e.x, e.y);
    const flash = e.flash > 0;

    if (e.kind === 'grunt') {
      ctx.fillStyle = flash ? '#ffffff' : '#f43f5e';
      ctx.strokeStyle = '#fda4af';
      ctx.lineWidth = 2;
      ctx.fillRect(-10, -11, 20, 22);
      ctx.strokeRect(-10, -11, 20, 22);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(-6, -6, 4, 4);
      ctx.fillRect(2, -6, 4, 4);
    } else if (e.kind === 'hulk') {
      ctx.fillStyle = flash ? '#bef264' : '#16a34a';
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-15, -16, 30, 32, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-8, -8, 16, 5);
    } else if (e.kind === 'spheroid' || e.kind === 'quark') {
      ctx.rotate(e.phase);
      ctx.strokeStyle = flash ? '#ffffff' : e.kind === 'spheroid' ? '#f472b6' : '#38bdf8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeRect(-9, -9, 18, 18);
    } else if (e.kind === 'enforcer' || e.kind === 'tank') {
      ctx.rotate(e.phase * 0.8);
      ctx.fillStyle = flash ? '#ffffff' : e.kind === 'tank' ? '#f59e0b' : '#c084fc';
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(13, 0);
      ctx.lineTo(0, 14);
      ctx.lineTo(-13, 0);
      ctx.closePath();
      ctx.fill();
    } else if (e.kind === 'brain' || e.kind === 'prog') {
      const hue = (this.clock * 260) % 360;
      ctx.fillStyle = flash ? '#ffffff' : e.kind === 'brain' ? '#a855f7' : `hsl(${hue}, 100%, 60%)`;
      ctx.beginPath();
      ctx.arc(0, -2, e.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (e.kind === 'motherbrain') {
      const hue = (this.clock * 160) % 360;
      ctx.rotate(this.clock * 0.9);
      ctx.fillStyle = flash ? '#ffffff' : `hsl(${hue}, 95%, 52%)`;
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const r = k % 2 === 0 ? e.radius : e.radius * 0.78;
        if (k === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Core eye
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.rotate(-this.clock * 0.9);
      // Boss HP bar
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(-38, -50, 76, 8);
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(-37, -49, 74 * Math.max(0, e.hp / e.maxHp), 6);
    }
    ctx.restore();
  }

  private renderEvoStatusStrip(ctx: CanvasRenderingContext2D): void {
    const y = this.logicalHeight - 24;
    ctx.save();
    ctx.fillStyle = 'rgba(4, 6, 18, 0.85)';
    ctx.fillRect(this.margin, y - 6, this.logicalWidth - this.margin * 2, 22);

    ctx.font = '800 11px "JetBrains Mono", monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`WEAPON: ${this.getWeaponTier()}`, this.margin + 10, y + 5);

    ctx.textAlign = 'center';
    ctx.fillStyle = this.meltGauge >= 50 ? '#f472b6' : '#94a3b8';
    ctx.fillText(
      this.meltGauge >= 50 ? 'MELT-NOVA READY [SHIFT / X]' : `MELT CHARGE ${Math.floor(this.meltGauge)}%`,
      this.logicalWidth * 0.5,
      y + 5
    );

    // Melt Gauge Mini Bar
    const bx = this.logicalWidth - this.margin - 150;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(bx, y, 140, 10);
    const grad = ctx.createLinearGradient(bx, 0, bx + 140, 0);
    grad.addColorStop(0, '#38bdf8');
    grad.addColorStop(0.5, '#c084fc');
    grad.addColorStop(1, '#f43f5e');
    ctx.fillStyle = grad;
    ctx.fillRect(bx, y, 140 * (this.meltGauge / 100), 10);
    ctx.restore();
  }

  private renderTitleOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(4, 3, 16, 0.78)';
    ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
    const cx = this.logicalWidth * 0.5;
    const hue = (this.clock * 110) % 360;
    ctx.textAlign = 'center';
    ctx.fillStyle = `hsl(${hue}, 100%, 66%)`;
    ctx.font = '900 44px "JetBrains Mono", monospace';
    ctx.fillText('ROBOTRON: 2016 EVO', cx, 200);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '800 15px "JetBrains Mono", monospace';
    ctx.fillText('MELT-O-VISION FEEDBACK · PRISM OVERDRIVE · OVERLORD BOSSES', cx, 244);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 14px "JetBrains Mono", monospace';
    ctx.fillText('WASD / ARROWS TO MOVE · MOUSE / SPACE TO FIRE TWIN-STICK PLASMA', cx, 310);
    ctx.fillText('CHAIN KILLS TO EVOLVE: TWIN PLASMA → TRI-SCATTER → PRISM HELIX → HYPER RAIL', cx, 340);
    ctx.fillText('PRESS SHIFT / X TO UNLEASH CHROMATIC MELT-NOVA SHOCKWAVE!', cx, 370);

    const pulse = 0.65 + 0.35 * Math.sin(this.clock * 6);
    ctx.fillStyle = `rgba(253, 224, 71, ${pulse})`;
    ctx.font = '900 20px "JetBrains Mono", monospace';
    ctx.fillText('PRESS SPACE TO ENGAGE MELT-O-VISION', cx, 456);
  }

  private renderCenterBanner(ctx: CanvasRenderingContext2D, title: string, sub: string, color: string): void {
    ctx.save();
    ctx.fillStyle = 'rgba(5, 6, 20, 0.84)';
    ctx.beginPath();
    ctx.roundRect(110, 250, this.logicalWidth - 220, 128, 14);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.font = '900 28px "JetBrains Mono", monospace';
    ctx.fillText(title, this.logicalWidth * 0.5, 298);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 13px "JetBrains Mono", monospace';
    ctx.fillText(sub, this.logicalWidth * 0.5, 342);
    ctx.restore();
  }

  public getHudSnapshot(): ClassicGameHud {
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.wave,
      lives: this.lives,
      stageName: this.wave % 3 === 0 ? `OVERLORD WAVE ${this.wave}` : `MELT WAVE ${this.wave}`,
      primaryMetricLabel: 'COMBO',
      primaryMetricValue: `×${this.combo}`,
      secondaryMetricLabel: 'MELT',
      secondaryMetricValue: `${Math.floor(this.meltGauge)}%`,
      bannerText: `${this.getWeaponTier()} · ${this.humans.length} HUMANS ALIVE`,
    };
  }
}

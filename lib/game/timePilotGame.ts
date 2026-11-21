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

export type TimePilotVariant = 'timepilot' | 'timepilot84' | 'timepilot2016evo';

interface EraConfig {
  yearLabel: string;
  name: string;
  skyTop: string;
  skyBottom: string;
  cloudColor: string;
  accentColor: string;
  enemyName: string;
  bossName: string;
  killsRequired: number;
}

const CLASSIC_ERAS: EraConfig[] = [
  {
    yearLabel: '1910',
    name: '1910 · BIPLANE SKIES',
    skyTop: '#0369a1',
    skyBottom: '#38bdf8',
    cloudColor: 'rgba(255, 255, 255, 0.78)',
    accentColor: '#fde047',
    enemyName: 'BIPLANE',
    bossName: 'WAR ZEPPELIN',
    killsRequired: 18,
  },
  {
    yearLabel: '1940',
    name: '1940 · PACIFIC FURY',
    skyTop: '#065f46',
    skyBottom: '#10b981',
    cloudColor: 'rgba(236, 253, 245, 0.68)',
    accentColor: '#fb923c',
    enemyName: 'MONOPLANE',
    bossName: 'B-25 HEAVY BOMBER',
    killsRequired: 20,
  },
  {
    yearLabel: '1970',
    name: '1970 · CHOPPER ASSAULT',
    skyTop: '#1e3a8a',
    skyBottom: '#60a5fa',
    cloudColor: 'rgba(241, 245, 249, 0.72)',
    accentColor: '#38bdf8',
    enemyName: 'GUNSHIP',
    bossName: 'CHINOOK DREADNOUGHT',
    killsRequired: 22,
  },
  {
    yearLabel: '1982',
    name: '1982 · SUPERSONIC',
    skyTop: '#7c2d12',
    skyBottom: '#fb923c',
    cloudColor: 'rgba(255, 237, 213, 0.65)',
    accentColor: '#f43f5e',
    enemyName: 'INTERCEPTOR',
    bossName: 'STRATOFORT B-52',
    killsRequired: 24,
  },
  {
    yearLabel: '2001',
    name: '2001 · COSMIC VOID',
    skyTop: '#020617',
    skyBottom: '#1e1b4b',
    cloudColor: 'rgba(167, 139, 250, 0.45)',
    accentColor: '#22d3ee',
    enemyName: 'UFO SAUCER',
    bossName: 'ALIEN MOTHERSHIP',
    killsRequired: 26,
  },
];

const TP84_ERAS: EraConfig[] = [
  {
    yearLabel: 'SEC-1',
    name: 'METAL GRID OVERWORLD',
    skyTop: '#0f172a',
    skyBottom: '#1e293b',
    cloudColor: 'rgba(56, 189, 248, 0.25)',
    accentColor: '#38bdf8',
    enemyName: 'CYBER FIGHTER',
    bossName: 'SILVER GUARDIAN I',
    killsRequired: 20,
  },
  {
    yearLabel: 'SEC-2',
    name: 'RED MESA FORTRESS',
    skyTop: '#450a0a',
    skyBottom: '#7f1d1d',
    cloudColor: 'rgba(251, 146, 60, 0.28)',
    accentColor: '#fb923c',
    enemyName: 'ARMOR DRONE',
    bossName: 'CRIMSON DREADNOUGHT',
    killsRequired: 22,
  },
  {
    yearLabel: 'SEC-3',
    name: 'OCEAN STATION ZERO',
    skyTop: '#0c4a6e',
    skyBottom: '#0369a1',
    cloudColor: 'rgba(125, 211, 252, 0.28)',
    accentColor: '#22d3ee',
    enemyName: 'HYDRO RAIDER',
    bossName: 'POSEIDON CARRIER',
    killsRequired: 24,
  },
  {
    yearLabel: 'SEC-4',
    name: 'OBSIDIAN CITADEL',
    skyTop: '#1e1b4b',
    skyBottom: '#312e81',
    cloudColor: 'rgba(192, 132, 252, 0.28)',
    accentColor: '#e879f9',
    enemyName: 'VOID STRIKER',
    bossName: 'UNKNOWN OVERLORD',
    killsRequired: 26,
  },
];

interface CloudLayer {
  x: number;
  y: number;
  r: number;
  depth: number;
}

interface TpEnemy {
  id: number;
  x: number; // relative to player screen center
  y: number;
  vx: number;
  vy: number;
  angle: number;
  hp: number;
  maxHp: number;
  armored: boolean; // In Time Pilot '84 / Evo, metallic silver enemies require Lock-On Missiles!
  isBoss: boolean;
  isGroundTurret: boolean;
  shootCd: number;
  phase: number;
  flash: number;
}

interface TpBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fromPlayer: boolean;
  isMissile: boolean;
  targetId?: number;
  hue: number;
  life: number;
}

interface Parachutist {
  x: number;
  y: number;
  life: number;
  sway: number;
}

interface ChainArc {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  life: number;
  hue: number;
}

interface ShockRing {
  x: number;
  y: number;
  r: number;
  maxR: number;
  hue: number;
  alpha: number;
}

export class TimePilotArcadeGame implements ArcadeGameInstance {
  public readonly logicalWidth = 840;
  public readonly logicalHeight = 640;
  public readonly supportsPointerAim = true;
  public readonly primaryActionLabel: string;
  public readonly secondaryActionLabel: string;

  private readonly variant: TimePilotVariant;
  private readonly storageKey: string;

  // Offscreen Melt-o-Vision Warp Buffer ONLY for 2016 Evo!
  private evoCanvas: HTMLCanvasElement | null = null;
  private evoCtx: CanvasRenderingContext2D | null = null;

  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();

  private score = 0;
  private highScore = 0;
  private eraIdx = 0;
  private loopCount = 1;
  private lives = 3;
  private nextExtraLife = 20000;

  // Player stays centered while the 360° world scrolls around the jet!
  private readonly cx = 420;
  private readonly cy = 320;
  private shipAngle = -Math.PI / 2;
  private worldX = 0;
  private worldY = 0;
  private cruiseSpeed = 235;
  private invulnTimer = 0;
  private fireCd = 0;
  private missileCd = 0;

  // Progression & Special Systems
  private killsInEra = 0;
  private bossSpawned = false;
  private chuteBonus = 1000;
  private lockedIds: number[] = [];
  private combo = 1;
  private comboTimer = 0;
  private chronoGauge = 70; // 2016 Evo Chrono Time-Dilation Overdrive!
  private chronoTimer = 0;
  private warpFlash = 0;
  private screenShake = 0;
  private clock = 0;
  private readyTimer = 0;
  private clearTimer = 0;

  // World & Combat Entities
  private clouds: CloudLayer[] = [];
  private enemies: TpEnemy[] = [];
  private bullets: TpBullet[] = [];
  private chutes: Parachutist[] = [];
  private arcs: ChainArc[] = [];
  private rings: ShockRing[] = [];
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];
  private nextId = 1;
  private spawnCd = 0.8;
  private chuteCd = 7;

  constructor(variant: TimePilotVariant) {
    this.variant = variant;
    this.storageKey = `retro_arcade_${variant}_hd_hs_v1`;
    this.highScore = readHighScore(this.storageKey);
    this.primaryActionLabel =
      variant === 'timepilot' ? 'CANNON FIRE' : variant === 'timepilot84' ? 'VULCAN + LOCK' : 'PRISM CANNON';
    this.secondaryActionLabel =
      variant === 'timepilot' ? 'TURBO TURN' : variant === 'timepilot84' ? 'HOMING MISSILE' : 'CHRONO SALVO';
    this.initClouds();
  }

  private ensureEvoBuffer(): void {
    if (this.variant !== 'timepilot2016evo' || typeof document === 'undefined') return;
    if (!this.evoCanvas) {
      this.evoCanvas = document.createElement('canvas');
      this.evoCanvas.width = this.logicalWidth;
      this.evoCanvas.height = this.logicalHeight;
      this.evoCtx = this.evoCanvas.getContext('2d');
      if (this.evoCtx) {
        this.evoCtx.fillStyle = '#030412';
        this.evoCtx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
      }
    }
  }

  private getEras(): EraConfig[] {
    return this.variant === 'timepilot84' ? TP84_ERAS : CLASSIC_ERAS;
  }

  private getEra(): EraConfig {
    const list = this.getEras();
    return list[this.eraIdx % list.length];
  }

  private initClouds(): void {
    this.clouds = [];
    for (let i = 0; i < 28; i++) {
      this.clouds.push({
        x: Math.random() * this.logicalWidth,
        y: Math.random() * this.logicalHeight,
        r: 22 + Math.random() * 48,
        depth: i < 12 ? 0.45 : i < 22 ? 0.85 : 1.35,
      });
    }
  }

  public startNewGame(): void {
    arcadeAudio.unlock();
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.eraIdx = 0;
    this.loopCount = 1;
    this.lives = 3;
    this.nextExtraLife = 20000;
    this.combo = 1;
    this.chronoGauge = 75;
    this.chronoTimer = 0;
    this.setupEra(0);
    this.phase = 'READY';
    this.readyTimer = 1.05;
  }

  private setupEra(idx: number): void {
    this.eraIdx = idx;
    this.killsInEra = 0;
    this.bossSpawned = false;
    this.chuteBonus = 1000;
    this.invulnTimer = 1.8;
    this.enemies = [];
    this.bullets = [];
    this.chutes = [];
    this.arcs = [];
    this.rings = [];
    this.particles = [];
    this.popups = [];
    this.lockedIds = [];
    this.spawnCd = 0.6;
    this.chuteCd = 6;
    this.warpFlash = 1.0;
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

  private addScore(pts: number, x?: number, y?: number, color = '#fde047', label?: string): void {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(this.storageKey, this.highScore);
    }
    if (this.score >= this.nextExtraLife) {
      this.lives = Math.min(6, this.lives + 1);
      this.nextExtraLife += 25000;
      arcadeAudio.playExtraLife();
      this.popups.push({
        x: this.cx,
        y: this.cy - 36,
        text: '1UP! EXTRA TIME JET!',
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
        life: 0.85,
        maxLife: 0.85,
      });
    }
  }

  private spawnSquadron(): void {
    const era = this.getEra();
    const edgeAngle = Math.random() * Math.PI * 2;
    const dist = 480;
    const sx = this.cx + Math.cos(edgeAngle) * dist;
    const sy = this.cy + Math.sin(edgeAngle) * dist;
    const dir = Math.atan2(this.cy - sy, this.cx - sx);
    const spd = 115 + this.eraIdx * 16 + this.loopCount * 14;

    const count = this.variant === 'timepilot2016evo' ? 4 : 3;
    for (let i = 0; i < count; i++) {
      const armored =
        this.variant === 'timepilot84'
          ? i === 0 || Math.random() < 0.35
          : this.variant === 'timepilot2016evo' && i === 0;
      const offset = (i - 1) * 34;
      const perp = dir + Math.PI / 2;
      this.enemies.push({
        id: this.nextId++,
        x: sx + Math.cos(perp) * offset,
        y: sy + Math.sin(perp) * offset,
        vx: Math.cos(dir) * spd,
        vy: Math.sin(dir) * spd,
        angle: dir,
        hp: armored ? 3 : 1,
        maxHp: armored ? 3 : 1,
        armored,
        isBoss: false,
        isGroundTurret: false,
        shootCd: 1.2 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2,
        flash: 0,
      });
    }

    // Time Pilot '84 & Evo also feature metallic ground turrets embedded in the scrolling overworld!
    if (this.variant !== 'timepilot' && Math.random() < 0.45 && this.enemies.filter((e) => e.isGroundTurret).length < 4) {
      const a2 = Math.random() * Math.PI * 2;
      this.enemies.push({
        id: this.nextId++,
        x: this.cx + Math.cos(a2) * 440,
        y: this.cy + Math.sin(a2) * 440,
        vx: 0,
        vy: 0,
        angle: 0,
        hp: 3,
        maxHp: 3,
        armored: true,
        isBoss: false,
        isGroundTurret: true,
        shootCd: 1.6,
        phase: 0,
        flash: 0,
      });
    }

    // Check if Era Boss should spawn!
    if (!this.bossSpawned && this.killsInEra >= era.killsRequired) {
      this.bossSpawned = true;
      const bossHp = this.variant === 'timepilot2016evo' ? 28 + this.eraIdx * 6 : 12 + this.eraIdx * 3;
      this.enemies.push({
        id: this.nextId++,
        x: this.cx + 420,
        y: this.cy - 180,
        vx: -115,
        vy: 30,
        angle: Math.PI,
        hp: bossHp,
        maxHp: bossHp,
        armored: this.variant !== 'timepilot',
        isBoss: true,
        isGroundTurret: false,
        shootCd: 1.1,
        phase: 0,
        flash: 0,
      });
      arcadeAudio.playSirenSweep();
      this.popups.push({
        x: this.cx,
        y: 135,
        text: `BOSS ALERT: ${era.bossName}!`,
        color: '#f43f5e',
        life: 1.9,
        maxLife: 1.9,
      });
    }
  }

  private launchHomingSalvo(maxTargets: number): void {
    if (this.missileCd > 0) return;
    const targets = this.lockedIds.slice(0, maxTargets);
    if (targets.length === 0) return;
    this.missileCd = this.variant === 'timepilot2016evo' ? 0.25 : 0.34;
    targets.forEach((tid, idx) => {
      const spread = (idx - (targets.length - 1) * 0.5) * 0.35;
      const a = this.shipAngle + spread;
      this.bullets.push({
        x: this.cx + Math.cos(a) * 18,
        y: this.cy + Math.sin(a) * 18,
        vx: Math.cos(a) * 460,
        vy: Math.sin(a) * 460,
        fromPlayer: true,
        isMissile: true,
        targetId: tid,
        hue: (this.clock * 220 + idx * 75) % 360,
        life: 2.2,
      });
    });
    arcadeAudio.playXWingQuadLaser(true);
  }

  private destroyEnemy(idx: number): void {
    const e = this.enemies[idx];
    this.enemies.splice(idx, 1);
    this.killsInEra++;
    this.combo = Math.min(30, this.combo + 1);
    this.comboTimer = 3.0;
    this.chronoGauge = Math.min(100, this.chronoGauge + (e.isBoss ? 40 : 5));
    const hue = (this.clock * 150 + e.x) % 360;

    if (e.isBoss) {
      const pts = 3000 * (this.eraIdx + 1);
      this.addScore(pts, e.x, e.y, '#fde047', `${this.getEra().bossName} +${pts}!`);
      arcadeAudio.playDeathStarSupernova();
      this.screenShake = 20;
      this.warpFlash = 1.0;
      spawnBurst(this.particles, e.x, e.y, '#fde047', 42, 320, 4.8);
      spawnBurst(this.particles, e.x, e.y, '#38bdf8', 36, 260, 4.2);
      this.rings.push({ x: e.x, y: e.y, r: 12, maxR: 280, hue, alpha: 1 });
      this.phase = 'STAGE_CLEAR';
      this.clearTimer = 1.9;
      return;
    }

    const basePts = e.isGroundTurret ? 400 : e.armored ? 300 : 100;
    const pts = this.variant === 'timepilot2016evo' ? Math.round(basePts * (1 + this.combo * 0.12)) : basePts;
    this.addScore(pts, e.x, e.y - 8, this.variant === 'timepilot2016evo' ? `hsl(${hue}, 100%, 66%)` : '#fde047');
    arcadeAudio.playExplosion(e.armored);
    spawnBurst(
      this.particles,
      e.x,
      e.y,
      this.variant === 'timepilot2016evo' ? `hsl(${hue}, 100%, 64%)` : '#fb923c',
      this.variant === 'timepilot2016evo' ? 20 : 12,
      210,
      3.4
    );

    if (this.variant === 'timepilot2016evo') {
      this.rings.push({ x: e.x, y: e.y, r: 8, maxR: 86, hue, alpha: 0.85 });
      // Chain-Lightning Arc jumping to nearest neighboring enemy!
      let nearest: TpEnemy | null = null;
      let bestD = 165;
      for (const other of this.enemies) {
        if (other.isBoss) continue;
        const d = Math.hypot(other.x - e.x, other.y - e.y);
        if (d < bestD) {
          bestD = d;
          nearest = other;
        }
      }
      if (nearest) {
        nearest.hp -= 1;
        nearest.flash = 0.2;
        this.arcs.push({ x1: e.x, y1: e.y, x2: nearest.x, y2: nearest.y, life: 0.22, hue });
      }
    }
  }

  private handlePlayerHit(): void {
    this.lives--;
    this.combo = 1;
    this.screenShake = 16;
    arcadeAudio.playDeath();
    spawnBurst(this.particles, this.cx, this.cy, '#f97316', 32, 260, 4.4);
    if (this.lives <= 0) {
      this.phase = 'GAME_OVER';
    } else {
      this.invulnTimer = 2.4;
      this.bullets = this.bullets.filter((b) => b.fromPlayer);
      this.enemies = this.enemies.filter((e) => e.isBoss || Math.hypot(e.x - this.cx, e.y - this.cy) > 170);
    }
  }

  public step(dt: number): void {
    this.clock += dt;
    if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - dt * 28);
    if (this.warpFlash > 0) this.warpFlash = Math.max(0, this.warpFlash - dt * 1.4);

    const simDt = this.chronoTimer > 0 ? dt * 0.4 : dt;
    if (this.chronoTimer > 0) this.chronoTimer = Math.max(0, this.chronoTimer - dt);

    stepParticlesAndPopups(this.particles, this.popups, dt);
    for (let i = this.arcs.length - 1; i >= 0; i--) {
      this.arcs[i].life -= dt;
      if (this.arcs[i].life <= 0) this.arcs.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.r += (r.maxR - r.r) * Math.min(1, dt * 6) + 90 * dt;
      r.alpha -= dt * 1.6;
      if (r.alpha <= 0 || r.r >= r.maxR) this.rings.splice(i, 1);
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
        const nextEra = this.eraIdx + 1;
        if (nextEra >= this.getEras().length) {
          this.loopCount++;
          this.setupEra(0);
        } else {
          this.setupEra(nextEra);
        }
        arcadeAudio.playStargateWarp();
        this.phase = 'READY';
        this.readyTimer = 1.05;
      }
      return;
    }

    if (this.invulnTimer > 0) this.invulnTimer -= dt;
    if (this.fireCd > 0) this.fireCd -= dt;
    if (this.missileCd > 0) this.missileCd -= dt;
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 1;
    }

    // 360° Smooth Omni-Directional Steering (WASD / Arrows / Pointer / Tilt)
    let desiredAngle: number | null = null;
    const mv = getPrecisionMoveVector(this.input);
    if (Math.hypot(mv.vx, mv.vy) > 0.08) {
      desiredAngle = Math.atan2(mv.vy, mv.vx);
    } else if (this.input.pointerActive) {
      const px = this.input.pointerX * this.logicalWidth;
      const py = this.input.pointerY * this.logicalHeight;
      if (Math.hypot(px - this.cx, py - this.cy) > 12) {
        desiredAngle = Math.atan2(py - this.cy, px - this.cx);
      }
    }
    if (desiredAngle !== null) {
      let diff = desiredAngle - this.shipAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turnRate = this.variant === 'timepilot' && this.input.secondary ? 11.5 : 8.2;
      this.shipAngle += Math.sign(diff) * Math.min(Math.abs(diff), turnRate * dt);
    }

    // Scroll 360° Sky / Metallic Overworld opposite the jet's heading!
    const spd = this.chronoTimer > 0 ? this.cruiseSpeed * 1.2 : this.cruiseSpeed;
    const scrollDX = -Math.cos(this.shipAngle) * spd * dt;
    const scrollDY = -Math.sin(this.shipAngle) * spd * dt;
    this.worldX -= scrollDX;
    this.worldY -= scrollDY;

    for (const c of this.clouds) {
      c.x = ((c.x + scrollDX * c.depth) % this.logicalWidth + this.logicalWidth) % this.logicalWidth;
      c.y = ((c.y + scrollDY * c.depth) % this.logicalHeight + this.logicalHeight) % this.logicalHeight;
    }

    // Update Auto Target-Lock Reticles (for Time Pilot '84 & 2016 Evo!)
    this.lockedIds = [];
    if (this.variant !== 'timepilot') {
      const maxLocks = this.variant === 'timepilot2016evo' ? 4 : 2;
      const candidates = this.enemies
        .filter((e) => (this.variant === 'timepilot2016evo' || e.armored || e.isBoss))
        .map((e) => ({ id: e.id, d: Math.hypot(e.x - this.cx, e.y - this.cy) }))
        .filter((item) => item.d < 360)
        .sort((a, b) => a.d - b.d);
      this.lockedIds = candidates.slice(0, maxLocks).map((c) => c.id);
    }

    // Primary Fire (Rapid Cannon / Prism Twin Beams)
    if (this.input.fire && this.fireCd <= 0) {
      const hue = (this.clock * 240) % 360;
      const shots = this.variant === 'timepilot2016evo' ? [-0.1, 0, 0.1] : [0];
      for (const off of shots) {
        const a = this.shipAngle + off;
        this.bullets.push({
          x: this.cx + Math.cos(a) * 18,
          y: this.cy + Math.sin(a) * 18,
          vx: Math.cos(a) * 680,
          vy: Math.sin(a) * 680,
          fromPlayer: true,
          isMissile: false,
          hue: (hue + off * 400) % 360,
          life: 0.9,
        });
      }
      this.fireCd = this.variant === 'timepilot2016evo' ? 0.095 : 0.12;
      arcadeAudio.playLaser(940 + this.eraIdx * 70, 340, 0.055);
      // In Time Pilot '84, holding fire also auto-fires a lock-on missile every 0.55s if locked!
      if (this.variant === 'timepilot84' && this.lockedIds.length > 0 && this.missileCd <= 0) {
        this.launchHomingSalvo(1);
      }
    }

    // Secondary Action: Homing Missiles ('84) OR Chrono Time-Dilation + 4-Missile Salvo (2016 Evo)!
    if (this.input.secondaryJustPressed) {
      if (this.variant === 'timepilot84') {
        this.launchHomingSalvo(2);
      } else if (this.variant === 'timepilot2016evo') {
        if (this.chronoGauge >= 40) {
          this.chronoGauge -= 45;
          this.chronoTimer = 3.2;
          this.warpFlash = 0.7;
          arcadeAudio.playStargateWarp();
          this.rings.push({ x: this.cx, y: this.cy, r: 14, maxR: 340, hue: (this.clock * 180) % 360, alpha: 1 });
        }
        this.launchHomingSalvo(4);
      }
    }

    // Spawn Enemies & Parachuting Pilots (classic 1982 feature!)
    this.spawnCd -= simDt;
    if (this.spawnCd <= 0 && this.enemies.length < (this.variant === 'timepilot2016evo' ? 14 : 10)) {
      this.spawnCd = Math.max(0.85, 1.9 - this.eraIdx * 0.14);
      this.spawnSquadron();
    }
    if (this.variant === 'timepilot') {
      this.chuteCd -= dt;
      if (this.chuteCd <= 0 && this.chutes.length < 2) {
        this.chuteCd = 9.5;
        this.chutes.push({
          x: this.cx + (Math.random() - 0.5) * 440,
          y: 40,
          life: 14,
          sway: Math.random() * Math.PI * 2,
        });
      }
    }

    // Update Parachutists
    for (let i = this.chutes.length - 1; i >= 0; i--) {
      const ch = this.chutes[i];
      ch.sway += dt * 3;
      ch.x += scrollDX * 0.55 + Math.sin(ch.sway) * 18 * dt;
      ch.y += scrollDY * 0.55 + 32 * dt;
      ch.life -= dt;
      if (Math.hypot(ch.x - this.cx, ch.y - this.cy) < 28) {
        this.addScore(this.chuteBonus, ch.x, ch.y - 12, '#4ade80', `PILOT +${this.chuteBonus}!`);
        this.chuteBonus = Math.min(5000, this.chuteBonus + 1000);
        arcadeAudio.playFairyRescue();
        spawnBurst(this.particles, ch.x, ch.y, '#4ade80', 16, 170, 3);
        this.chutes.splice(i, 1);
      } else if (ch.life <= 0) {
        this.chutes.splice(i, 1);
      }
    }

    // Update Enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.phase += simDt * 4;
      if (e.flash > 0) e.flash -= dt;

      if (e.isGroundTurret) {
        e.x += scrollDX;
        e.y += scrollDY;
        e.angle = Math.atan2(this.cy - e.y, this.cx - e.x);
      } else {
        const targetAng = Math.atan2(this.cy - e.y, this.cx - e.x);
        if (e.isBoss) {
          // Orbit player majestically while firing broadsides!
          const dist = Math.hypot(e.x - this.cx, e.y - this.cy);
          const orbitAng = targetAng + (dist > 250 ? 0.25 : Math.PI * 0.45);
          e.angle += (orbitAng - e.angle) * simDt * 2.2;
          e.vx = Math.cos(e.angle) * 135;
          e.vy = Math.sin(e.angle) * 135;
        } else {
          let diff = targetAng - e.angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          e.angle += Math.sign(diff) * Math.min(Math.abs(diff), 1.65 * simDt);
          const spd = Math.hypot(e.vx, e.vy) || 140;
          e.vx = Math.cos(e.angle) * spd;
          e.vy = Math.sin(e.angle) * spd;
        }
        e.x += e.vx * simDt + scrollDX;
        e.y += e.vy * simDt + scrollDY;
      }

      // Enemy firing
      e.shootCd -= simDt;
      if (e.shootCd <= 0 && Math.hypot(e.x - this.cx, e.y - this.cy) < 420) {
        e.shootCd = e.isBoss ? 1.1 : 2.3 + Math.random();
        const a = Math.atan2(this.cy - e.y, this.cx - e.x);
        const count = e.isBoss ? (this.variant === 'timepilot2016evo' ? 5 : 3) : 1;
        for (let k = 0; k < count; k++) {
          const sa = a + (k - (count - 1) * 0.5) * 0.28;
          this.bullets.push({
            x: e.x,
            y: e.y,
            vx: Math.cos(sa) * 235,
            vy: Math.sin(sa) * 235,
            fromPlayer: false,
            isMissile: false,
            hue: 12,
            life: 3.0,
          });
        }
      }

      // Remove non-boss enemies if scrolled very far offscreen
      if (!e.isBoss && Math.hypot(e.x - this.cx, e.y - this.cy) > 680) {
        this.enemies.splice(i, 1);
        continue;
      }

      if (this.invulnTimer <= 0 && !e.isGroundTurret && Math.hypot(e.x - this.cx, e.y - this.cy) < (e.isBoss ? 36 : 20)) {
        this.handlePlayerHit();
        return;
      }
    }

    // Update Bullets & Homing Missiles
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      if (b.isMissile && b.targetId !== undefined) {
        const tgt = this.enemies.find((e) => e.id === b.targetId);
        if (tgt) {
          const a = Math.atan2(tgt.y - b.y, tgt.x - b.x);
          b.vx += (Math.cos(a) * 560 - b.vx) * dt * 8.5;
          b.vy += (Math.sin(a) * 560 - b.vy) * dt * 8.5;
        }
      }
      b.x += b.vx * (b.fromPlayer ? dt : simDt) + scrollDX * 0.45;
      b.y += b.vy * (b.fromPlayer ? dt : simDt) + scrollDY * 0.45;
      b.life -= dt;
      if (b.life <= 0) {
        this.bullets.splice(i, 1);
        continue;
      }

      if (b.fromPlayer) {
        let consumed = false;
        for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
          const e = this.enemies[ei];
          const rad = e.isBoss ? 38 : 20;
          if (Math.hypot(e.x - b.x, e.y - b.y) < rad) {
            // In Time Pilot '84, silver armored foes deflect standard Vulcan cannon — use Lock-On Missiles!
            if (this.variant === 'timepilot84' && e.armored && !b.isMissile) {
              spawnBurst(this.particles, b.x, b.y, '#e2e8f0', 4, 100, 2);
              arcadeAudio.playLanceClash();
            } else {
              e.hp -= b.isMissile ? 3 : 1;
              e.flash = 0.12;
              if (e.hp <= 0) {
                this.destroyEnemy(ei);
                if ((this.phase as ClassicGamePhase) === 'STAGE_CLEAR') return;
              } else {
                spawnBurst(this.particles, b.x, b.y, '#fde047', 5, 130, 2.2);
              }
            }
            consumed = true;
            break;
          }
        }
        if (consumed) this.bullets.splice(i, 1);
      } else {
        if (this.invulnTimer <= 0 && Math.hypot(b.x - this.cx, b.y - this.cy) < 14) {
          this.bullets.splice(i, 1);
          this.handlePlayerHit();
          return;
        }
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    const era = this.getEra();
    this.ensureEvoBuffer();

    // Update 2016 Evo Melt-o-Vision Time-Rift Feedback Buffer!
    if (this.variant === 'timepilot2016evo' && this.evoCanvas && this.evoCtx) {
      const m = this.evoCtx;
      const w = this.logicalWidth;
      const h = this.logicalHeight;
      m.save();
      m.globalCompositeOperation = 'source-over';
      m.fillStyle = this.chronoTimer > 0 ? 'rgba(6, 4, 24, 0.14)' : 'rgba(4, 6, 18, 0.22)';
      m.fillRect(0, 0, w, h);
      m.globalAlpha = 0.85;
      m.translate(w * 0.5, h * 0.5);
      m.rotate(Math.sin(this.clock * 0.9) * 0.008);
      m.scale(1.018, 1.018);
      m.drawImage(this.evoCanvas, -w * 0.5, -h * 0.5);
      m.restore();

      m.save();
      m.globalCompositeOperation = 'lighter';
      for (const r of this.rings) {
        m.strokeStyle = `hsla(${r.hue}, 100%, 66%, ${r.alpha * 0.75})`;
        m.lineWidth = 4;
        m.beginPath();
        m.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        m.stroke();
      }
      for (const b of this.bullets) {
        if (!b.fromPlayer) continue;
        m.fillStyle = `hsla(${b.hue}, 100%, 66%, 0.9)`;
        m.beginPath();
        m.arc(b.x, b.y, b.isMissile ? 6.5 : 4, 0, Math.PI * 2);
        m.fill();
      }
      for (const a of this.arcs) {
        m.strokeStyle = `hsla(${a.hue}, 100%, 72%, 0.9)`;
        m.lineWidth = 3;
        m.beginPath();
        m.moveTo(a.x1, a.y1);
        m.lineTo((a.x1 + a.x2) * 0.5 + (Math.random() - 0.5) * 26, (a.y1 + a.y2) * 0.5 + (Math.random() - 0.5) * 26);
        m.lineTo(a.x2, a.y2);
        m.stroke();
      }
      m.restore();
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    if (this.screenShake > 0.2) {
      ctx.translate(
        (Math.random() - 0.5) * this.screenShake,
        (Math.random() - 0.5) * this.screenShake
      );
    }

    // 1. Background (Classic Sky + Clouds OR '84 Metallic Overworld Grid OR 2016 Evo Melt-o-Vision Aurora!)
    if (this.variant === 'timepilot2016evo' && this.evoCanvas) {
      ctx.drawImage(this.evoCanvas, 0, 0);
      // Volumetric aurora clouds & time-warp streaks
      for (const c of this.clouds) {
        const hue = (this.clock * 45 + this.eraIdx * 65 + c.depth * 90) % 360;
        const grad = ctx.createRadialGradient(c.x, c.y, 4, c.x, c.y, c.r * 1.4);
        grad.addColorStop(0, `hsla(${hue}, 95%, 62%, 0.24)`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r * 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      const sky = ctx.createLinearGradient(0, 0, 0, this.logicalHeight);
      sky.addColorStop(0, era.skyTop);
      sky.addColorStop(1, era.skyBottom);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);

      if (this.variant === 'timepilot84') {
        // Authentic 1984 Metallic Sci-Fi Overworld Grid!
        const tile = 72;
        const ox = ((-this.worldX % tile) + tile) % tile;
        const oy = ((-this.worldY % tile) + tile) % tile;
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.26)';
        ctx.lineWidth = 1.5;
        for (let x = ox - tile; x < this.logicalWidth + tile; x += tile) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, this.logicalHeight);
          ctx.stroke();
        }
        for (let y = oy - tile; y < this.logicalHeight + tile; y += tile) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(this.logicalWidth, y);
          ctx.stroke();
        }
        // Metallic tech panels embedded in terrain
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        for (let gx = ox - tile; gx < this.logicalWidth + tile; gx += tile * 2) {
          for (let gy = oy - tile; gy < this.logicalHeight + tile; gy += tile * 2) {
            ctx.fillRect(gx + 8, gy + 8, tile - 16, tile - 16);
          }
        }
      } else {
        // Classic 1982 Multi-layer Parallax Fluffy Clouds!
        for (const c of this.clouds) {
          ctx.fillStyle = era.cloudColor;
          ctx.beginPath();
          ctx.arc(c.x, c.y, c.r * 0.72, 0, Math.PI * 2);
          ctx.arc(c.x + c.r * 0.55, c.y + 4, c.r * 0.55, 0, Math.PI * 2);
          ctx.arc(c.x - c.r * 0.5, c.y + 6, c.r * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 2. Parachuting Pilots (Classic 1982!)
    for (const ch of this.chutes) {
      ctx.save();
      ctx.translate(ch.x, ch.y);
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(0, -12, 13, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-12, -12);
      ctx.lineTo(0, 4);
      ctx.moveTo(12, -12);
      ctx.lineTo(0, 4);
      ctx.stroke();
      ctx.fillStyle = '#fde047';
      ctx.fillRect(-3, 4, 6, 10);
      ctx.restore();
    }

    // 3. Enemies + Target-Lock Reticles!
    for (const e of this.enemies) {
      this.renderEnemy(ctx, e);
      if (this.lockedIds.includes(e.id)) {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(this.clock * 4);
        ctx.strokeStyle = this.variant === 'timepilot2016evo' ? '#22d3ee' : '#ef4444';
        ctx.lineWidth = 2.5;
        const sz = e.isBoss ? 44 : 24;
        ctx.strokeRect(-sz, -sz, sz * 2, sz * 2);
        ctx.restore();
      }
    }

    // 4. Bullets & Homing Missiles
    for (const b of this.bullets) {
      ctx.fillStyle = b.fromPlayer
        ? b.isMissile
          ? '#f43f5e'
          : this.variant === 'timepilot2016evo'
            ? `hsl(${b.hue}, 100%, 70%)`
            : '#fde047'
        : '#fb923c';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.isMissile ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. Player Centered 360° Time Fighter!
    this.renderPlayerJet(ctx);

    renderParticlesAndPopups(ctx, this.particles, this.popups);

    // 6. Top Era / Kill Progress Bar
    ctx.fillStyle = 'rgba(4, 8, 22, 0.85)';
    ctx.fillRect(0, 0, this.logicalWidth, 38);
    ctx.font = '800 12px "JetBrains Mono", monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = era.accentColor;
    ctx.fillText(era.name, 16, 19);

    const pct = Math.min(1, this.killsInEra / era.killsRequired);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(320, 11, 240, 16);
    ctx.fillStyle = this.bossSpawned ? '#f43f5e' : '#38bdf8';
    ctx.fillRect(320, 11, 240 * pct, 16);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(this.bossSpawned ? `BOSS: ${era.bossName}` : `KILLS ${this.killsInEra}/${era.killsRequired}`, 440, 19);

    if (this.variant === 'timepilot2016evo') {
      ctx.textAlign = 'right';
      ctx.fillStyle = this.chronoGauge >= 40 ? '#22d3ee' : '#94a3b8';
      ctx.fillText(`CHRONO ${Math.floor(this.chronoGauge)}% [SHIFT/X]`, this.logicalWidth - 16, 19);
    } else if (this.variant === 'timepilot84') {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#f87171';
      ctx.fillText(`LOCKED: ${this.lockedIds.length} [SHIFT/X MISSILE]`, this.logicalWidth - 16, 19);
    }

    // Time-Warp White Flash Overlay
    if (this.warpFlash > 0.02) {
      ctx.fillStyle = `rgba(255, 255, 255, ${this.warpFlash * 0.72})`;
      ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
    }

    if (this.phase === 'TITLE') {
      this.renderTitleOverlay(ctx);
    } else if (this.phase === 'READY') {
      this.renderCenterBanner(ctx, era.name, `DESTROY ${era.killsRequired} ${era.enemyName}S TO SUMMON ${era.bossName}!`, era.accentColor);
    } else if (this.phase === 'STAGE_CLEAR') {
      this.renderCenterBanner(ctx, 'TIME WARP ENGAGED!', 'JUMPING TO NEXT HISTORICAL ERA...', '#4ade80');
    } else if (this.phase === 'GAME_OVER') {
      this.renderCenterBanner(ctx, 'LOST IN TIME', `FINAL SCORE ${this.score.toLocaleString()} · PRESS SPACE TO RE-ENTER`, '#f87171');
    } else if (this.phase === 'PAUSED') {
      this.renderCenterBanner(ctx, 'PAUSED', 'PRESS P TO RESUME DOGFIGHT', '#38bdf8');
    }

    if (visualMode === 'crt') renderCrtOverlay(ctx, this.logicalWidth, this.logicalHeight);
    ctx.restore();
  }

  private renderPlayerJet(ctx: CanvasRenderingContext2D): void {
    if (this.invulnTimer > 0 && Math.floor(this.clock * 18) % 2 === 0) return;
    ctx.save();
    ctx.translate(this.cx, this.cy);
    ctx.rotate(this.shipAngle);

    // Thruster flame
    ctx.fillStyle = this.variant === 'timepilot2016evo' ? '#22d3ee' : '#fb923c';
    ctx.beginPath();
    ctx.moveTo(-14, -4);
    ctx.lineTo(-26 - Math.random() * 8, 0);
    ctx.lineTo(-14, 4);
    ctx.closePath();
    ctx.fill();

    // Sleek Time-Jet Delta Wings
    ctx.fillStyle = this.variant === 'timepilot84' ? '#e2e8f0' : '#f8fafc';
    ctx.strokeStyle = this.variant === 'timepilot2016evo' ? '#f472b6' : '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-12, -16);
    ctx.lineTo(-7, 0);
    ctx.lineTo(-12, 16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.ellipse(4, 0, 5.5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private renderEnemy(ctx: CanvasRenderingContext2D, e: TpEnemy): void {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.angle);

    if (e.isGroundTurret) {
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#64748b';
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(0, -4, 18, 8);
    } else if (e.isBoss) {
      // Towering Era Boss (Blimp / B-25 / Chinook / B-52 / Mothership / Guardian!)
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : e.armored ? '#94a3b8' : '#ef4444';
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, 38, 22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-10, -34, 18, 68);
      ctx.rotate(-e.angle);
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(-38, -46, 76, 8);
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(-37, -45, 74 * Math.max(0, e.hp / e.maxHp), 6);
    } else {
      // Standard Era Craft (Biplane / Monoplane / Chopper / Jet / UFO / Metallic Fighter)
      const col =
        e.flash > 0
          ? '#ffffff'
          : e.armored
            ? '#cbd5e1'
            : this.variant === 'timepilot84'
              ? '#4ade80'
              : '#f97316';
      ctx.fillStyle = col;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.6;
      if (this.eraIdx === 4 && this.variant === 'timepilot') {
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(14, 0);
        ctx.lineTo(-10, -12);
        ctx.lineTo(-6, 0);
        ctx.lineTo(-10, 12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private renderTitleOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(4, 8, 22, 0.78)';
    ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
    const cx = this.logicalWidth * 0.5;
    ctx.textAlign = 'center';
    ctx.fillStyle = this.variant === 'timepilot2016evo' ? '#f472b6' : '#38bdf8';
    ctx.font = '900 44px "JetBrains Mono", monospace';
    ctx.fillText(
      this.variant === 'timepilot'
        ? 'TIME PILOT'
        : this.variant === 'timepilot84'
          ? "TIME PILOT '84"
          : 'TIME PILOT: 2016 EVO',
      cx,
      198
    );
    ctx.fillStyle = '#fde047';
    ctx.font = '800 15px "JetBrains Mono", monospace';
    ctx.fillText(
      this.variant === 'timepilot'
        ? '1982 KONAMI · 360° OPEN-SKY DOGFIGHT ACROSS 1910 · 1940 · 1970 · 1982 · 2001'
        : this.variant === 'timepilot84'
          ? '1984 KONAMI · FURTHER INTO UNKNOWN WORLD · DUAL VULCAN + LOCK-ON MISSILES'
          : '2016 EVO · MELT-O-VISION WARP · 4-LOCK HOMING SALVOS · CHAIN LIGHTNING · CHRONO SLOW-MO',
      cx,
      242
    );
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 14px "JetBrains Mono", monospace';
    ctx.fillText('WASD / ARROWS / MOUSE TO STEER 360° · SPACE TO FIRE', cx, 312);
    ctx.fillText(
      this.variant === 'timepilot'
        ? 'RESCUE PARACHUTING PILOTS (1000→5000) & DEFEAT EACH ERA BOSS TO WARP!'
        : this.variant === 'timepilot84'
          ? 'VULCAN SHREDS GREEN CRAFT · PRESS SHIFT/X TO LAUNCH LOCK-ON MISSILES AT SILVER ARMOR!'
          : 'PRESS SHIFT/X FOR CHRONO TIME-DILATION + 4-TARGET PRISM MISSILE SALVOS!',
      cx,
      344
    );
    const pulse = 0.65 + 0.35 * Math.sin(this.clock * 6);
    ctx.fillStyle = `rgba(253, 224, 71, ${pulse})`;
    ctx.font = '900 20px "JetBrains Mono", monospace';
    ctx.fillText('PRESS SPACE TO LAUNCH TIME WARP', cx, 456);
  }

  private renderCenterBanner(ctx: CanvasRenderingContext2D, title: string, sub: string, color: string): void {
    ctx.save();
    ctx.fillStyle = 'rgba(5, 8, 22, 0.85)';
    ctx.beginPath();
    ctx.roundRect(100, 250, this.logicalWidth - 200, 128, 14);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.font = '900 26px "JetBrains Mono", monospace';
    ctx.fillText(title, this.logicalWidth * 0.5, 298);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 13px "JetBrains Mono", monospace';
    ctx.fillText(sub, this.logicalWidth * 0.5, 342);
    ctx.restore();
  }

  public getHudSnapshot(): ClassicGameHud {
    const era = this.getEra();
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.eraIdx + 1,
      lives: this.lives,
      stageName: era.name,
      primaryMetricLabel: this.variant === 'timepilot' ? 'ERA' : 'LOCK',
      primaryMetricValue: this.variant === 'timepilot' ? era.yearLabel : `${this.lockedIds.length} TGT`,
      secondaryMetricLabel: this.variant === 'timepilot2016evo' ? 'CHRONO' : 'KILLS',
      secondaryMetricValue:
        this.variant === 'timepilot2016evo'
          ? `${Math.floor(this.chronoGauge)}%`
          : `${this.killsInEra}/${era.killsRequired}`,
      bannerText: this.bossSpawned ? `BOSS ENGAGED: ${era.bossName}!` : era.name,
    };
  }
}

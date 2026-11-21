import {
  ArcadeGameInstance,
  ArcadeInputState,
  ClassicGameHud,
  ClassicGamePhase,
  ScorePopup,
  SimpleParticle,
  createEmptyInput,
  getPrecisionMoveVector,
  readHighScore,
  renderCrtOverlay,
  renderParticlesAndPopups,
  saveHighScore,
  spawnBurst,
  stepParticlesAndPopups,
} from './classicArcadeInterface';
import { arcadeAudio } from './audio';
import { drawStarGlint } from './arcadeGfx';

export type DefenderVariant = 'defender' | 'defender2' | 'stargate';

const W = 720;
const H = 640;
const WORLD_W = 2880;
const SCANNER_H = 74;
const PLAY_TOP = SCANNER_H + 10;
const PLAY_BOTTOM = H - 24;

type EnemyKind =
  | 'lander'
  | 'mutant'
  | 'bomber'
  | 'pod'
  | 'swarmer'
  | 'baiter'
  | 'firebomber'
  | 'spacemine'
  | 'yllabian'
  | 'dynamo'
  | 'munchie';

interface Humanoid {
  id: number;
  x: number;
  y: number;
  state: 'walking' | 'abducted' | 'falling' | 'carried' | 'dead';
  vy: number;
  fallStartY: number;
  walkDir: -1 | 1;
  abductorId: number | null;
}

interface DefenderEnemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fireTimer: number;
  targetHumanoidId: number | null;
  phase: number;
  hp: number;
}

interface LaserBeam {
  x: number;
  y: number;
  dir: -1 | 1;
  life: number;
  length: number;
  color: string;
}

interface EnemyShot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  isMine: boolean;
  color: string;
}

interface StarDot {
  x: number;
  y: number;
  size: number;
  twinkle: number;
  color: string;
  parallax: number;
}

interface NebulaPuff {
  x: number;
  y: number;
  r: number;
  color: string;
}

function wrapX(x: number): number {
  let r = x % WORLD_W;
  if (r < 0) r += WORLD_W;
  return r;
}

function wrappedDeltaX(fromX: number, toX: number): number {
  let d = toX - fromX;
  if (d > WORLD_W / 2) d -= WORLD_W;
  if (d < -WORLD_W / 2) d += WORLD_W;
  return d;
}

export class DefenderGame implements ArcadeGameInstance {
  public readonly logicalWidth = W;
  public readonly logicalHeight = H;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'LASER';
  public readonly secondaryActionLabel = 'SMART BOMB';

  private readonly variant: DefenderVariant;
  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();
  private score = 0;
  private highScore = 0;
  private level = 1;
  private lives = 3;
  private smartBombs = 3;
  private nextExtraLifeScore = 10000;
  private time = 0;
  private phaseTimer = 0;
  private bannerText = '';

  // Player fighter state
  private px = WORLD_W * 0.5;
  private py = 330;
  private pvx = 0;
  private pvy = 0;
  private facing: -1 | 1 = 1;
  private cameraX = WORLD_W * 0.5 - W * 0.35;
  private fireCooldown = 0;
  private invulnTimer = 0;
  private smartBombFlash = 0;
  private screenShake = 0;

  // Variant-specific special systems
  // Defender (1981): Hyperspace cooldown + flash
  private hyperspaceCooldown = 0;
  private hyperspaceFlash = 0;
  // Defender II & Stargate: Inviso Cloak + Stargate / Warp Gate
  private invisoActive = false;
  private invisoEnergy = 100;
  private stargateX = WORLD_W * 0.5;
  private stargateY = 270;
  private stargateCooldown = 0;
  private warpTunnelTimer = 0;
  private warpBonusText = '';

  private carryingHumanoidId: number | null = null;
  private planetDestroyed = false;
  private waveTimer = 0;
  private baiterSpawned = 0;

  private terrain: number[] = [];
  private stars: StarDot[] = [];
  private nebulae: NebulaPuff[] = [];
  private humanoids: Humanoid[] = [];
  private enemies: DefenderEnemy[] = [];
  private lasers: LaserBeam[] = [];
  private enemyShots: EnemyShot[] = [];
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];
  private nextEntityId = 1;

  constructor(variant: DefenderVariant) {
    this.variant = variant;
    this.highScore = readHighScore(`arcade_hs_${variant}`);
    this.buildBackdropAndTerrain();
    this.setupWave(1, true);
    this.bannerText = this.getTitleBanner();
  }

  public get canRestartStage(): boolean {
    return true;
  }

  private getTitleBanner(): string {
    if (this.variant === 'defender') return 'PRESS PLAY · DEFENDER 1981 FRONTIER';
    if (this.variant === 'defender2') return 'PRESS PLAY · DEFENDER II NEBULA';
    return 'PRESS PLAY · STARGATE HYPERSPACE';
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public startNewGame(): void {
    arcadeAudio.unlock();
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.smartBombs = 3;
    this.nextExtraLifeScore = 10000;
    this.planetDestroyed = false;
    this.invisoActive = false;
    this.invisoEnergy = 100;
    this.hyperspaceCooldown = 0;
    this.warpTunnelTimer = 0;
    this.particles = [];
    this.popups = [];
    this.setupWave(1, true);
    this.phase = 'READY';
    this.phaseTimer = 1.4;
    this.bannerText =
      this.variant === 'defender'
        ? 'ATTACK WAVE 1 · PROTECT THE HUMANOIDS'
        : this.variant === 'defender2'
          ? 'NEBULA WAVE 1 · INVISO & WARP GATE READY'
          : 'STARGATE WAVE 1 · DEFEND THE SECTOR';
  }

  public restartStage(): void {
    if (this.phase !== 'PLAYING' && this.phase !== 'READY') return;
    if (this.variant === 'defender') {
      // Classic 1981 Defender Hyperspace Warp!
      if (this.hyperspaceCooldown > 0) return;
      this.hyperspaceCooldown = 1.6;
      this.hyperspaceFlash = 0.45;
      arcadeAudio.playHyperspace();
      spawnBurst(this.particles, this.px, this.py, '#F59E0B', 20, 240, 3.2);
      this.px = wrapX(this.px + 600 + Math.random() * 1600);
      this.py = PLAY_TOP + 60 + Math.random() * (PLAY_BOTTOM - PLAY_TOP - 150);
      this.pvx = 0;
      this.pvy = 0;
      this.invulnTimer = Math.max(this.invulnTimer, 0.85);
      spawnBurst(this.particles, this.px, this.py, '#FEF08A', 20, 220, 3.2);
      this.popups.push({
        x: this.px,
        y: this.py - 26,
        text: 'HYPERSPACE!',
        color: '#FACC15',
        life: 1.0,
        maxLife: 1.0,
      });
    } else {
      // Defender II & Stargate: Toggle Inviso Cloak Shield!
      if (this.invisoEnergy > 8) {
        this.invisoActive = !this.invisoActive;
        if (this.invisoActive) {
          arcadeAudio.playInvisoCloak();
        }
      }
    }
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') {
      this.phase = 'PAUSED';
      this.bannerText = 'PAUSED';
    } else if (this.phase === 'PAUSED') {
      this.phase = 'PLAYING';
      this.bannerText = '';
    }
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.planetDestroyed = false;
    this.setupWave(1, true);
    this.bannerText = this.getTitleBanner();
  }

  public getHudSnapshot(): ClassicGameHud {
    const aliveHumanoids = this.humanoids.filter((h) => h.state !== 'dead').length;
    const stageLabel =
      this.planetDestroyed
        ? `MUTANT SPACE · WAVE ${this.level}`
        : this.variant === 'defender'
          ? `FRONTIER WAVE ${this.level}`
          : this.variant === 'defender2'
            ? `NEBULA WAVE ${this.level}`
            : `STARGATE WAVE ${this.level}`;
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: stageLabel,
      primaryMetricLabel: 'HUMANOIDS',
      primaryMetricValue: `${aliveHumanoids}/10`,
      secondaryMetricLabel:
        this.variant === 'defender' ? 'BOMBS / HYPER' : 'BOMBS / INVISO',
      secondaryMetricValue:
        this.variant === 'defender'
          ? `${this.smartBombs} · ${this.hyperspaceCooldown <= 0 ? 'RDY' : 'CHG'}`
          : `${this.smartBombs} · ${Math.round(this.invisoEnergy)}%`,
      bannerText: this.bannerText,
      canRestartStage: true,
    };
  }

  private buildBackdropAndTerrain(): void {
    // Variant-distinct terrain geometry
    const segments = 144;
    this.terrain = [];
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      let elev: number;
      if (this.variant === 'defender') {
        // Classic 1981 jagged Williams volcanic ridges
        elev =
          50 +
          Math.sin(t * 4) * 26 +
          Math.cos(t * 9) * 18 +
          Math.sin(t * 17) * 12;
      } else if (this.variant === 'defender2') {
        // Sharp crystalline amethyst spires
        elev =
          54 +
          Math.abs(Math.sin(t * 6)) * 42 +
          Math.cos(t * 14) * 14;
      } else {
        // Sleek geometric cyber-mesa plateaus for Stargate
        const stepWave = Math.round(Math.sin(t * 5) * 2.2) * 14;
        elev = 48 + stepWave + Math.cos(t * 11) * 14;
      }
      this.terrain.push(PLAY_BOTTOM - Math.max(20, elev));
    }

    // Starfield with variant-tuned colors
    const starPalette =
      this.variant === 'defender'
        ? ['#FFFFFF', '#FDE68A', '#FB923C', '#FCA5A5']
        : this.variant === 'defender2'
          ? ['#FFFFFF', '#E9D5FF', '#F472B6', '#C084FC']
          : ['#FFFFFF', '#A5F3FC', '#38BDF8', '#34D399'];

    this.stars = [];
    for (let i = 0; i < 110; i++) {
      this.stars.push({
        x: Math.random() * WORLD_W,
        y: PLAY_TOP + Math.random() * (PLAY_BOTTOM - PLAY_TOP - 80),
        size: 1 + Math.random() * 1.9,
        twinkle: Math.random() * Math.PI * 2,
        color: starPalette[i % starPalette.length],
        parallax: 0.25 + (i % 3) * 0.2,
      });
    }

    // Nebula clouds for Defender II & Stargate
    this.nebulae = [];
    const nebCols =
      this.variant === 'defender2'
        ? ['rgba(168,85,247,0.16)', 'rgba(236,72,153,0.14)', 'rgba(99,102,241,0.14)']
        : this.variant === 'stargate'
          ? ['rgba(6,182,212,0.15)', 'rgba(16,185,129,0.12)', 'rgba(56,189,248,0.14)']
          : ['rgba(234,88,12,0.08)', 'rgba(220,38,38,0.06)'];
    for (let i = 0; i < 14; i++) {
      this.nebulae.push({
        x: (i / 14) * WORLD_W + 80,
        y: PLAY_TOP + 80 + ((i * 97) % 300),
        r: 95 + (i % 4) * 35,
        color: nebCols[i % nebCols.length],
      });
    }
  }

  private getTerrainY(worldX: number): number {
    if (this.planetDestroyed) return PLAY_BOTTOM + 60;
    const x = wrapX(worldX);
    const segs = this.terrain.length - 1;
    const pos = (x / WORLD_W) * segs;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const y0 = this.terrain[idx % segs];
    const y1 = this.terrain[(idx + 1) % segs];
    return y0 + (y1 - y0) * frac;
  }

  private setupWave(lvl: number, resetHumanoids: boolean): void {
    this.level = lvl;
    this.waveTimer = 0;
    this.baiterSpawned = 0;
    this.lasers = [];
    this.enemyShots = [];
    this.carryingHumanoidId = null;
    this.invisoActive = false;
    this.invisoEnergy = Math.min(100, this.invisoEnergy + 45);
    this.stargateCooldown = 0;

    this.px = WORLD_W * 0.5;
    this.py = 310;
    this.pvx = 0;
    this.pvy = 0;
    this.facing = 1;
    this.invulnTimer = 1.7;
    this.stargateX = wrapX(this.px + 260);
    this.stargateY = 265;

    if (resetHumanoids) {
      this.humanoids = [];
      for (let i = 0; i < 10; i++) {
        const hx = ((i + 0.5) / 10) * WORLD_W;
        this.humanoids.push({
          id: this.nextEntityId++,
          x: hx,
          y: this.getTerrainY(hx) - 10,
          state: 'walking',
          vy: 0,
          fallStartY: 0,
          walkDir: i % 2 === 0 ? 1 : -1,
          abductorId: null,
        });
      }
    } else {
      for (const h of this.humanoids) {
        if (h.state !== 'dead') {
          h.state = 'walking';
          h.y = this.getTerrainY(h.x) - 10;
          h.vy = 0;
          h.abductorId = null;
        }
      }
    }

    this.enemies = [];
    const landers = 6 + Math.min(8, lvl * 2);
    const pods = Math.min(5, 1 + Math.floor(lvl / 2));

    for (let i = 0; i < landers; i++) {
      const ex = wrapX(this.px + 340 + (i / landers) * (WORLD_W - 680));
      this.enemies.push({
        id: this.nextEntityId++,
        kind: this.planetDestroyed ? 'mutant' : 'lander',
        x: ex,
        y: PLAY_TOP + 34 + Math.random() * 140,
        vx: (Math.random() < 0.5 ? -1 : 1) * (88 + lvl * 8),
        vy: 0,
        fireTimer: 1.4 + Math.random() * 2.2,
        targetHumanoidId: null,
        phase: Math.random() * Math.PI * 2,
        hp: 1,
      });
    }

    for (let i = 0; i < pods; i++) {
      const ex = wrapX(this.px + 620 + i * 480);
      this.enemies.push({
        id: this.nextEntityId++,
        kind: 'pod',
        x: ex,
        y: PLAY_TOP + 90 + Math.random() * 180,
        vx: (i % 2 === 0 ? 1 : -1) * 58,
        vy: (i % 2 === 0 ? 1 : -1) * 32,
        fireTimer: 99,
        targetHumanoidId: null,
        phase: i,
        hp: 1,
      });
    }

    if (this.variant === 'defender') {
      // Classic 1981 Bombers
      const bombers = Math.min(5, 2 + Math.floor(lvl / 2));
      for (let i = 0; i < bombers; i++) {
        this.enemies.push({
          id: this.nextEntityId++,
          kind: 'bomber',
          x: wrapX(this.px + 500 + i * 540),
          y: PLAY_TOP + 120 + (i % 3) * 80,
          vx: (i % 2 === 0 ? 1 : -1) * 96,
          vy: 0,
          fireTimer: 1.6 + Math.random() * 1.4,
          targetHumanoidId: null,
          phase: i * 1.2,
          hp: 1,
        });
      }
    } else if (this.variant === 'defender2') {
      // Defender II: Firebombers + Space Mines
      const firebombers = Math.min(5, 2 + Math.floor(lvl / 2));
      for (let i = 0; i < firebombers; i++) {
        this.enemies.push({
          id: this.nextEntityId++,
          kind: 'firebomber',
          x: wrapX(this.px + 480 + i * 520),
          y: PLAY_TOP + 110 + (i % 3) * 85,
          vx: (i % 2 === 0 ? 1 : -1) * 114,
          vy: 0,
          fireTimer: 1.3 + Math.random() * 1.2,
          targetHumanoidId: null,
          phase: i * 1.5,
          hp: 1,
        });
      }
      const mines = Math.min(4, 1 + Math.floor(lvl * 0.7));
      for (let i = 0; i < mines; i++) {
        this.enemies.push({
          id: this.nextEntityId++,
          kind: 'spacemine',
          x: wrapX(this.px + 750 + i * 640),
          y: PLAY_TOP + 150 + i * 55,
          vx: (i % 2 === 0 ? 1 : -1) * 65,
          vy: 30,
          fireTimer: 2.2,
          targetHumanoidId: null,
          phase: i * 2.1,
          hp: 1,
        });
      }
    } else {
      // Stargate: Firebombers + Yllabian Space Hums (split into Dynamos!) + Munchies
      const firebombers = Math.min(4, 1 + Math.floor(lvl / 2));
      for (let i = 0; i < firebombers; i++) {
        this.enemies.push({
          id: this.nextEntityId++,
          kind: 'firebomber',
          x: wrapX(this.px + 460 + i * 580),
          y: PLAY_TOP + 125 + (i % 3) * 70,
          vx: (i % 2 === 0 ? 1 : -1) * 120,
          vy: 0,
          fireTimer: 1.3 + Math.random(),
          targetHumanoidId: null,
          phase: i,
          hp: 1,
        });
      }
      const yllabians = Math.min(4, 2 + Math.floor(lvl / 2));
      for (let i = 0; i < yllabians; i++) {
        this.enemies.push({
          id: this.nextEntityId++,
          kind: 'yllabian',
          x: wrapX(this.px + 650 + i * 600),
          y: PLAY_TOP + 95 + i * 65,
          vx: (i % 2 === 0 ? 1 : -1) * 86,
          vy: 36,
          fireTimer: 1.8,
          targetHumanoidId: null,
          phase: i * 1.3,
          hp: 1,
        });
      }
      const munchies = Math.min(3, 1 + Math.floor(lvl / 2));
      for (let i = 0; i < munchies; i++) {
        this.enemies.push({
          id: this.nextEntityId++,
          kind: 'munchie',
          x: wrapX(this.px + 900 + i * 740),
          y: PLAY_BOTTOM - 95,
          vx: (i % 2 === 0 ? 1 : -1) * 105,
          vy: 0,
          fireTimer: 2.5,
          targetHumanoidId: null,
          phase: i * 0.9,
          hp: 1,
        });
      }
    }
  }

  private addScore(points: number, x?: number, y?: number, color = '#FACC15', label?: string): void {
    this.score += points;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(`arcade_hs_${this.variant}`, this.highScore);
    }
    if (this.score >= this.nextExtraLifeScore) {
      this.lives = Math.min(5, this.lives + 1);
      this.smartBombs = Math.min(5, this.smartBombs + 1);
      this.nextExtraLifeScore += 10000;
      arcadeAudio.playExtraLife();
      this.popups.push({
        x: this.px,
        y: this.py - 32,
        text: '1UP + SMART BOMB!',
        color: '#4ADE80',
        life: 1.6,
        maxLife: 1.6,
      });
    }
    if (x !== undefined && y !== undefined) {
      this.popups.push({
        x,
        y,
        text: label ?? `+${points}`,
        color,
        life: 0.95,
        maxLife: 0.95,
      });
    }
  }

  public step(dt: number): void {
    this.time += dt;
    if (this.smartBombFlash > 0) this.smartBombFlash = Math.max(0, this.smartBombFlash - dt * 2.6);
    if (this.hyperspaceFlash > 0) this.hyperspaceFlash = Math.max(0, this.hyperspaceFlash - dt * 2.5);
    if (this.hyperspaceCooldown > 0) this.hyperspaceCooldown = Math.max(0, this.hyperspaceCooldown - dt);
    if (this.stargateCooldown > 0) this.stargateCooldown = Math.max(0, this.stargateCooldown - dt);
    if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - dt * 20);

    if (this.phase === 'PAUSED') return;

    if (this.phase === 'TITLE') {
      this.cameraX = wrapX(this.cameraX + 125 * dt);
      if (this.input.fireJustPressed) {
        this.startNewGame();
      }
      return;
    }

    // Stargate 3D Hyperspace Warp Tunnel Interlude!
    if (this.warpTunnelTimer > 0) {
      this.warpTunnelTimer -= dt;
      stepParticlesAndPopups(this.particles, this.popups, dt);
      if (this.warpTunnelTimer <= 0) {
        this.warpBonusText = '';
        this.setupWave(this.level + 2, false);
        this.phase = 'READY';
        this.phaseTimer = 1.25;
        this.bannerText = `STARGATE WARPED TO WAVE ${this.level}!`;
      }
      return;
    }

    if (this.phase === 'READY') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.phase = 'PLAYING';
        this.bannerText = '';
      }
      return;
    }

    if (this.phase === 'STAGE_CLEAR') {
      stepParticlesAndPopups(this.particles, this.popups, dt);
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.setupWave(this.level + 1, false);
        this.phase = 'READY';
        this.phaseTimer = 1.3;
        this.bannerText = `ATTACK WAVE ${this.level}`;
      }
      return;
    }

    if (this.phase === 'GAME_OVER') {
      stepParticlesAndPopups(this.particles, this.popups, dt);
      if (this.input.fireJustPressed) {
        this.startNewGame();
      }
      return;
    }

    // PLAYING
    this.waveTimer += dt;
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (this.fireCooldown > 0) this.fireCooldown = Math.max(0, this.fireCooldown - dt);

    // Spawn Baiters if wave drags on
    if (this.waveTimer > 24 + this.baiterSpawned * 12 && this.baiterSpawned < 4) {
      this.baiterSpawned++;
      this.enemies.push({
        id: this.nextEntityId++,
        kind: 'baiter',
        x: wrapX(this.px + (Math.random() < 0.5 ? 520 : -520)),
        y: PLAY_TOP + 50 + Math.random() * 140,
        vx: 0,
        vy: 0,
        fireTimer: 1.0,
        targetHumanoidId: null,
        phase: 0,
        hp: 1,
      });
    }

    this.stepPlayer(dt);
    this.stepLasers(dt);
    this.stepHumanoids(dt);
    this.stepEnemies(dt);
    if (this.phase !== 'PLAYING') return;
    this.stepEnemyShots(dt);
    if (this.phase !== 'PLAYING') return;
    stepParticlesAndPopups(this.particles, this.popups, dt);

    // Wave clear check (when all non-baiter enemies are destroyed)
    const remaining = this.enemies.filter((e) => e.kind !== 'baiter').length;
    if (remaining === 0) {
      this.phase = 'STAGE_CLEAR';
      this.phaseTimer = 2.0;
      const aliveHumans = this.humanoids.filter((h) => h.state !== 'dead').length;
      const bonus = aliveHumans * 100 * this.level;
      this.addScore(bonus, this.px, this.py - 32, '#4ADE80', `SURVIVORS +${bonus}`);
      this.bannerText = `WAVE ${this.level} CLEARED! HUMANOID BONUS +${bonus}`;
      arcadeAudio.playStageClear();
    }
  }

  private stepPlayer(dt: number): void {
    const moveVec = getPrecisionMoveVector(this.input);
    const thrustAccel = 1280 * moveVec.scale;
    const maxVx = 560 * moveVec.scale;
    const maxVy = 325 * moveVec.scale;

    if (moveVec.vx > 0.12) {
      this.facing = 1;
      this.pvx = Math.min(maxVx, this.pvx + thrustAccel * Math.abs(moveVec.vx) * dt);
    } else if (moveVec.vx < -0.12) {
      this.facing = -1;
      this.pvx = Math.max(-maxVx, this.pvx - thrustAccel * Math.abs(moveVec.vx) * dt);
    } else {
      this.pvx *= Math.pow(0.14, dt);
      if (Math.abs(this.pvx) < 4) this.pvx = 0;
    }

    if (Math.abs(moveVec.vy) > 0.1) {
      this.pvy = moveVec.vy * maxVy;
    } else {
      this.pvy *= Math.pow(0.05, dt);
    }

    this.px = wrapX(this.px + this.pvx * dt);
    this.py = Math.max(PLAY_TOP + 18, Math.min(PLAY_BOTTOM - 16, this.py + this.pvy * dt));

    // Smooth lead camera ahead of facing direction
    const desiredOffset = this.facing === 1 ? W * 0.28 : W * 0.72;
    const targetCam = wrapX(this.px - desiredOffset);
    const camDiff = wrappedDeltaX(this.cameraX, targetCam);
    this.cameraX = wrapX(this.cameraX + camDiff * Math.min(1, dt * 6.5));

    // Inviso energy management (Defender II & Stargate)
    if (this.variant !== 'defender') {
      if (this.invisoActive) {
        this.invisoEnergy = Math.max(0, this.invisoEnergy - dt * 24);
        if (this.invisoEnergy <= 0) this.invisoActive = false;
      } else {
        this.invisoEnergy = Math.min(100, this.invisoEnergy + dt * 11);
      }

      // Check Stargate / Warp Gate entry!
      if (
        this.stargateCooldown <= 0 &&
        Math.abs(wrappedDeltaX(this.px, this.stargateX)) < 30 &&
        Math.abs(this.py - this.stargateY) < 34
      ) {
        this.triggerGateWarp();
      }
    }

    // Fire streaking horizontal Williams laser
    if ((this.input.fire || this.input.fireJustPressed) && this.fireCooldown <= 0) {
      this.fireCooldown = this.variant === 'stargate' ? 0.085 : 0.095;
      arcadeAudio.playLaser();
      const laserColor =
        this.variant === 'defender'
          ? '#FACC15'
          : this.variant === 'defender2'
            ? '#F472B6'
            : '#38BDF8';
      this.lasers.push({
        x: wrapX(this.px + this.facing * 24),
        y: this.py,
        dir: this.facing,
        life: 0.24,
        length: 230,
        color: laserColor,
      });
    }

    // Smart Bomb (Shift / X)
    if (this.input.secondaryJustPressed && this.smartBombs > 0) {
      this.triggerSmartBomb();
    }
  }

  private triggerGateWarp(): void {
    this.stargateCooldown = 3.2;
    arcadeAudio.playStargateWarp();

    // Priority 1: Warp directly to an abducted humanoid!
    const endangered = this.humanoids.find((h) => h.state === 'abducted');
    if (endangered) {
      this.px = wrapX(endangered.x - this.facing * 120);
      this.py = Math.max(PLAY_TOP + 30, endangered.y - 20);
      this.invulnTimer = Math.max(this.invulnTimer, 1.0);
      spawnBurst(this.particles, this.px, this.py, '#38BDF8', 24, 240, 3.6);
      this.popups.push({
        x: this.px,
        y: this.py - 28,
        text: 'RESCUE WARP!',
        color: '#38BDF8',
        life: 1.3,
        maxLife: 1.3,
      });
      return;
    }

    // Priority 2: Stargate Hyperspace Wave Skip (when 4+ humanoids alive!)
    const aliveHumanoids = this.humanoids.filter((h) => h.state !== 'dead').length;
    if (this.variant === 'stargate' && aliveHumanoids >= 4 && this.enemies.length <= 7) {
      this.addScore(2000, this.px, this.py - 28, '#38BDF8', 'STARGATE WARP +2000!');
      this.warpTunnelTimer = 1.85;
      this.warpBonusText = 'STARGATE HYPERSPACE WARP! +2,000';
      return;
    }

    // Otherwise warp to the opposite side of the planet with bonus shield burst
    this.px = wrapX(this.px + WORLD_W * 0.5);
    this.invulnTimer = Math.max(this.invulnTimer, 1.0);
    spawnBurst(
      this.particles,
      this.px,
      this.py,
      this.variant === 'defender2' ? '#C084FC' : '#38BDF8',
      22,
      240,
      3.5
    );
    this.popups.push({
      x: this.px,
      y: this.py - 26,
      text: 'SECTOR WARP!',
      color: this.variant === 'defender2' ? '#E879F9' : '#38BDF8',
      life: 1.1,
      maxLife: 1.1,
    });
  }

  private triggerSmartBomb(): void {
    this.smartBombs -= 1;
    this.smartBombFlash = 1.0;
    this.screenShake = 10;
    arcadeAudio.playSmartBomb();

    let kills = 0;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e) continue;
      const sx = this.worldToScreenX(e.x);
      if (sx >= -30 && sx <= W + 30) {
        this.destroyEnemy(i, false);
        kills++;
      }
    }
    this.enemyShots = this.enemyShots.filter((s) => {
      const sx = this.worldToScreenX(s.x);
      return sx < -20 || sx > W + 20;
    });
    if (kills > 0) {
      this.popups.push({
        x: this.px,
        y: this.py - 30,
        text: `SMART BOMB ×${kills}!`,
        color: '#FACC15',
        life: 1.1,
        maxLife: 1.1,
      });
    }
  }

  private stepLasers(dt: number): void {
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const b = this.lasers[i];
      b.x = wrapX(b.x + b.dir * 1260 * dt);
      b.life -= dt;
      if (b.life <= 0) {
        this.lasers.splice(i, 1);
        continue;
      }

      let hit = false;
      for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
        const e = this.enemies[ei];
        if (!e) continue;
        const dx = wrappedDeltaX(b.x, e.x) * b.dir;
        if (dx >= -b.length * 0.45 && dx <= 46 && Math.abs(e.y - b.y) < 22) {
          this.destroyEnemy(ei, true);
          hit = true;
          break;
        }
      }
      if (hit) {
        this.lasers.splice(i, 1);
      }
    }
  }

  private destroyEnemy(idx: number, spawnSplit: boolean): void {
    const e = this.enemies[idx];
    if (!e) return;
    this.enemies.splice(idx, 1);
    arcadeAudio.playInvaderExplosion('alien');

    if (e.targetHumanoidId !== null) {
      const hum = this.humanoids.find((h) => h.id === e.targetHumanoidId);
      if (hum && hum.state === 'abducted') {
        hum.state = 'falling';
        hum.vy = 0;
        hum.fallStartY = hum.y;
        hum.abductorId = null;
      }
    }

    const ptsMap: Record<EnemyKind, number> = {
      lander: 150,
      mutant: 150,
      bomber: 250,
      pod: 1000,
      swarmer: 150,
      baiter: 200,
      firebomber: 250,
      spacemine: 300,
      yllabian: 500,
      dynamo: 200,
      munchie: 250,
    };
    const colorMap: Record<EnemyKind, string> = {
      lander: '#22C55E',
      mutant: '#EF4444',
      bomber: '#38BDF8',
      pod: '#C084FC',
      swarmer: '#FB7185',
      baiter: '#FACC15',
      firebomber: '#F97316',
      spacemine: '#E879F9',
      yllabian: '#2DD4BF',
      dynamo: '#38BDF8',
      munchie: '#A3E635',
    };

    const pts = ptsMap[e.kind] ?? 150;
    const col = colorMap[e.kind] ?? '#FACC15';
    this.addScore(pts, e.x, e.y - 12, col);
    spawnBurst(this.particles, e.x, e.y, col, 16, 210, 3.3);

    if (spawnSplit && e.kind === 'pod') {
      for (let s = 0; s < 4; s++) {
        this.enemies.push({
          id: this.nextEntityId++,
          kind: 'swarmer',
          x: wrapX(e.x + (s - 1.5) * 18),
          y: e.y + (s % 2 === 0 ? -12 : 12),
          vx: (Math.random() - 0.5) * 260,
          vy: (Math.random() - 0.5) * 180,
          fireTimer: 1.5 + Math.random(),
          targetHumanoidId: null,
          phase: s * 1.4,
          hp: 1,
        });
      }
    } else if (spawnSplit && e.kind === 'yllabian') {
      // Stargate Yllabian Space Hum splits into 2 fast glowing Dynamos!
      for (let d = 0; d < 2; d++) {
        this.enemies.push({
          id: this.nextEntityId++,
          kind: 'dynamo',
          x: wrapX(e.x + (d === 0 ? -18 : 18)),
          y: e.y,
          vx: (d === 0 ? -1 : 1) * 210,
          vy: (d === 0 ? -1 : 1) * 90,
          fireTimer: 1.4,
          targetHumanoidId: null,
          phase: d * Math.PI,
          hp: 1,
        });
      }
    }
  }

  private stepHumanoids(dt: number): void {
    for (const h of this.humanoids) {
      if (h.state === 'dead') continue;

      if (h.state === 'walking') {
        h.x = wrapX(h.x + h.walkDir * 16 * dt);
        h.y = this.getTerrainY(h.x) - 10;
        if (Math.random() < dt * 0.2) h.walkDir = (h.walkDir * -1) as -1 | 1;
      } else if (h.state === 'falling') {
        h.vy = Math.min(260, h.vy + 300 * dt);
        h.y += h.vy * dt;

        // Mid-air player catch!
        if (
          this.carryingHumanoidId === null &&
          Math.abs(wrappedDeltaX(this.px, h.x)) < 28 &&
          Math.abs(this.py - h.y) < 28
        ) {
          h.state = 'carried';
          this.carryingHumanoidId = h.id;
          arcadeAudio.playCoin();
          this.addScore(500, h.x, h.y - 18, '#4ADE80', 'CAUGHT +500!');
          continue;
        }

        const groundY = this.getTerrainY(h.x) - 10;
        if (h.y >= groundY) {
          h.y = groundY;
          if (groundY - h.fallStartY > 185) {
            h.state = 'dead';
            arcadeAudio.playDeath();
            spawnBurst(this.particles, h.x, h.y, '#EF4444', 14, 150, 2.8);
            this.checkPlanetExplosion();
          } else {
            h.state = 'walking';
            this.addScore(250, h.x, h.y - 16, '#38BDF8', 'SAFE +250');
          }
        }
      } else if (h.state === 'carried') {
        h.x = this.px;
        h.y = this.py + 18;
        const groundY = this.getTerrainY(h.x) - 10;
        if (h.y >= groundY - 4 && !this.planetDestroyed) {
          h.y = groundY;
          h.state = 'walking';
          this.carryingHumanoidId = null;
          arcadeAudio.playPowerUp();
          this.addScore(500, h.x, h.y - 24, '#4ADE80', 'LANDED +500!');
        }
      }
    }
  }

  private checkPlanetExplosion(): void {
    if (this.planetDestroyed) return;
    const alive = this.humanoids.filter((h) => h.state !== 'dead').length;
    if (alive === 0) {
      this.planetDestroyed = true;
      this.smartBombFlash = 1.0;
      this.screenShake = 14;
      arcadeAudio.playDdtExplosion();
      this.bannerText = 'ALL HUMANOIDS LOST · PLANET EXPLODED!';
      for (const e of this.enemies) {
        if (e.kind === 'lander') {
          e.kind = 'mutant';
          e.targetHumanoidId = null;
        }
      }
    }
  }

  private stepEnemies(dt: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e) continue;
      e.phase += dt * 4.2;
      e.fireTimer -= dt;

      if (e.kind === 'lander') {
        if (e.targetHumanoidId === null && Math.random() < dt * 0.4) {
          const target = this.humanoids.find(
            (h) =>
              h.state === 'walking' &&
              Math.abs(wrappedDeltaX(e.x, h.x)) < 360 &&
              !this.enemies.some((o) => o.targetHumanoidId === h.id)
          );
          if (target) e.targetHumanoidId = target.id;
        }

        const targetHum =
          e.targetHumanoidId !== null
            ? this.humanoids.find((h) => h.id === e.targetHumanoidId)
            : null;

        if (targetHum && targetHum.state === 'walking') {
          const dx = wrappedDeltaX(e.x, targetHum.x);
          e.vx = Math.max(-135, Math.min(135, dx * 2));
          e.vy = targetHum.y - 16 - e.y;
          e.vy = Math.max(-95, Math.min(105, e.vy * 1.4));
          if (Math.abs(dx) < 12 && Math.abs(e.y - (targetHum.y - 16)) < 14) {
            targetHum.state = 'abducted';
            targetHum.abductorId = e.id;
            arcadeAudio.playSirenSweep();
          }
        } else if (targetHum && targetHum.state === 'abducted') {
          e.vx = 0;
          e.vy = -74;
          targetHum.x = e.x;
          targetHum.y = e.y + 18;
          if (e.y <= PLAY_TOP + 20) {
            targetHum.state = 'dead';
            e.kind = 'mutant';
            e.targetHumanoidId = null;
            spawnBurst(this.particles, e.x, e.y, '#EF4444', 18, 190, 3.2);
            this.checkPlanetExplosion();
          }
        } else {
          e.targetHumanoidId = null;
          e.vy = Math.sin(e.phase) * 42;
        }
      } else if (e.kind === 'mutant' || e.kind === 'baiter' || e.kind === 'dynamo') {
        const dx = wrappedDeltaX(e.x, this.px);
        const dy = this.py - e.y;
        const speed = e.kind === 'baiter' ? 355 : e.kind === 'dynamo' ? 275 : 225;
        e.vx += (Math.sign(dx) * speed - e.vx) * Math.min(1, dt * 3.4);
        e.vy = dy * 2.2 + Math.sin(e.phase * 2.8) * 90;
      } else if (e.kind === 'bomber' || e.kind === 'firebomber') {
        e.vy = Math.sin(e.phase * 1.2) * 72;
        if (e.fireTimer <= 0) {
          e.fireTimer = e.kind === 'firebomber' ? 1.55 : 1.95;
          const isFire = e.kind === 'firebomber';
          this.enemyShots.push({
            x: e.x,
            y: e.y,
            vx: isFire ? Math.sign(wrappedDeltaX(e.x, this.px)) * 55 : 0,
            vy: isFire ? Math.sign(this.py - e.y) * 40 : 0,
            life: 4.5,
            isMine: true,
            color: isFire ? '#F97316' : '#38BDF8',
          });
        }
      } else if (e.kind === 'swarmer') {
        const dx = wrappedDeltaX(e.x, this.px);
        e.vx += Math.sign(dx) * 320 * dt;
        e.vx = Math.max(-270, Math.min(270, e.vx));
        e.vy = Math.sin(e.phase * 3.2) * 140 + (this.py - e.y) * 0.9;
      } else if (e.kind === 'spacemine') {
        const dx = wrappedDeltaX(e.x, this.px);
        e.vx += Math.sign(dx) * 120 * dt;
        e.vx = Math.max(-130, Math.min(130, e.vx));
        e.vy = Math.cos(e.phase) * 58;
      } else if (e.kind === 'yllabian') {
        e.vy = Math.sin(e.phase * 1.6) * 84;
      } else if (e.kind === 'munchie') {
        // Stargate Munchies stalk walking humanoids along the terrain
        const prey = this.humanoids.find((h) => h.state === 'walking');
        if (prey) {
          const dx = wrappedDeltaX(e.x, prey.x);
          e.vx = Math.sign(dx) * 125;
          e.y += (prey.y - 12 - e.y) * Math.min(1, dt * 3);
        } else {
          e.vy = Math.sin(e.phase * 2) * 65;
        }
      }

      e.x = wrapX(e.x + e.vx * dt);
      e.y = Math.max(PLAY_TOP + 16, Math.min(PLAY_BOTTOM - 22, e.y + e.vy * dt));

      // Enemy firing
      if (
        e.kind !== 'pod' &&
        e.kind !== 'bomber' &&
        e.kind !== 'firebomber' &&
        e.kind !== 'spacemine' &&
        e.fireTimer <= 0
      ) {
        e.fireTimer = 1.7 + Math.random() * 1.6;
        const dx = wrappedDeltaX(e.x, this.px);
        if (Math.abs(dx) < W * 0.55) {
          const dy = this.py - e.y;
          const dist = Math.max(1, Math.hypot(dx, dy));
          const spd = e.kind === 'baiter' ? 320 : 235;
          this.enemyShots.push({
            x: e.x,
            y: e.y,
            vx: (dx / dist) * spd,
            vy: (dy / dist) * spd,
            life: 2.3,
            isMine: false,
            color: e.kind === 'mutant' ? '#EF4444' : '#FEF08A',
          });
        }
      }

      // Collision with player ship
      if (Math.abs(wrappedDeltaX(e.x, this.px)) < 24 && Math.abs(e.y - this.py) < 20) {
        if (this.invisoActive) {
          // Inviso Cloak RAM KILL!
          this.destroyEnemy(i, false);
          this.addScore(250, this.px, this.py - 26, '#E879F9', 'CLOAK RAM +250!');
          this.screenShake = 5;
          continue;
        } else if (this.invulnTimer <= 0) {
          this.damagePlayer();
          return;
        }
      }
    }
  }

  private stepEnemyShots(dt: number): void {
    for (let i = this.enemyShots.length - 1; i >= 0; i--) {
      const s = this.enemyShots[i];
      if (!s) continue;
      s.x = wrapX(s.x + s.vx * dt);
      s.y += s.vy * dt;
      s.life -= dt;
      if (s.life <= 0 || s.y < PLAY_TOP || s.y > PLAY_BOTTOM) {
        this.enemyShots.splice(i, 1);
        continue;
      }
      if (
        !this.invisoActive &&
        this.invulnTimer <= 0 &&
        Math.abs(wrappedDeltaX(s.x, this.px)) < 16 &&
        Math.abs(s.y - this.py) < 14
      ) {
        this.enemyShots.splice(i, 1);
        this.damagePlayer();
        return;
      }
    }
  }

  private damagePlayer(): void {
    arcadeAudio.playDeath();
    spawnBurst(this.particles, this.px, this.py, '#F97316', 28, 280, 3.8);
    this.screenShake = 10;
    this.enemyShots = [];

    if (this.carryingHumanoidId !== null) {
      const h = this.humanoids.find((hu) => hu.id === this.carryingHumanoidId);
      if (h) {
        h.state = 'falling';
        h.vy = 0;
        h.fallStartY = h.y;
      }
      this.carryingHumanoidId = null;
    }

    this.lives -= 1;
    if (this.lives <= 0) {
      this.phase = 'GAME_OVER';
      this.bannerText = 'GAME OVER · PRESS PLAY TO DEFEND AGAIN';
      return;
    }

    this.pvx = 0;
    this.pvy = 0;
    this.py = 310;
    this.invulnTimer = 2.4;
    this.invisoActive = false;
    this.phase = 'READY';
    this.phaseTimer = 1.25;
    this.bannerText = 'SHIP DESTROYED · READY PILOT';
  }

  private worldToScreenX(worldX: number): number {
    let sx = worldX - this.cameraX;
    if (sx < -WORLD_W / 2) sx += WORLD_W;
    if (sx > WORLD_W / 2) sx -= WORLD_W;
    return sx;
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.save();
    ctx.scale(dpr, dpr);

    const shakeX = this.screenShake > 0 ? (Math.random() - 0.5) * this.screenShake : 0;
    const shakeY = this.screenShake > 0 ? (Math.random() - 0.5) * this.screenShake : 0;

    // 1) Variant-distinct Deep Space Backdrop
    const bgGrad = ctx.createLinearGradient(0, PLAY_TOP, 0, H);
    if (this.variant === 'defender') {
      bgGrad.addColorStop(0, '#04050B');
      bgGrad.addColorStop(0.75, '#120809');
      bgGrad.addColorStop(1, '#220C06');
    } else if (this.variant === 'defender2') {
      bgGrad.addColorStop(0, '#090418');
      bgGrad.addColorStop(0.65, '#1B0B33');
      bgGrad.addColorStop(1, '#2E104E');
    } else {
      bgGrad.addColorStop(0, '#020B14');
      bgGrad.addColorStop(0.68, '#041C2C');
      bgGrad.addColorStop(1, '#062C3C');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // If inside Stargate 3D Hyperspace Warp Tunnel, draw exhilarating warp vortex!
    if (this.warpTunnelTimer > 0) {
      this.renderWarpTunnel(ctx);
      if (visualMode === 'crt') renderCrtOverlay(ctx, W, H);
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // Nebula clouds (Defender II / Stargate vivid ambiance)
    for (const n of this.nebulae) {
      const sx = this.worldToScreenX(wrapX(n.x + this.cameraX * 0.65));
      if (sx < -n.r || sx > W + n.r) continue;
      const g = ctx.createRadialGradient(sx, n.y, 4, sx, n.y, n.r);
      g.addColorStop(0, n.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Stargate holographic cyber horizon grid
    if (this.variant === 'stargate' && !this.planetDestroyed) {
      ctx.strokeStyle = 'rgba(56,189,248,0.12)';
      ctx.lineWidth = 1;
      for (let gy = PLAY_BOTTOM - 120; gy < PLAY_BOTTOM; gy += 24) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(W, gy);
        ctx.stroke();
      }
    }

    // Parallax stars
    for (const s of this.stars) {
      const sx = wrapX(s.x - this.cameraX * s.parallax);
      if (sx > W) continue;
      ctx.globalAlpha = 0.45 + 0.55 * Math.sin(this.time * 3 + s.twinkle);
      ctx.fillStyle = s.color;
      ctx.fillRect(sx, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;

    // Terrain mountains (completely distinct silhouette & glow per game!)
    if (!this.planetDestroyed) {
      this.renderTerrain(ctx);
    }

    // Stargate / Warp Gate Portal (Defender II & Stargate)
    if (this.variant !== 'defender') {
      this.renderGatePortal(ctx);
    }

    // Humanoids
    for (const h of this.humanoids) {
      if (h.state === 'dead') continue;
      const sx = this.worldToScreenX(h.x);
      if (sx < -24 || sx > W + 24) continue;
      this.drawHumanoid(ctx, sx, h.y, h.state === 'abducted');
    }

    // Enemies
    for (const e of this.enemies) {
      const sx = this.worldToScreenX(e.x);
      if (sx < -36 || sx > W + 36) continue;
      this.drawEnemy(ctx, e, sx, e.y);
    }

    // Enemy shots & mines
    for (const s of this.enemyShots) {
      const sx = this.worldToScreenX(s.x);
      if (sx < -20 || sx > W + 20) continue;
      ctx.save();
      ctx.translate(sx, s.y);
      ctx.fillStyle = s.color;
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 10;
      if (s.isMine) {
        ctx.rotate(this.time * 5);
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(-6, 0);
        ctx.lineTo(6, 0);
        ctx.moveTo(0, -6);
        ctx.lineTo(0, 6);
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(-2, -2, 4, 4);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, 3.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Player laser streaks
    for (const b of this.lasers) {
      const sx = this.worldToScreenX(b.x);
      if (sx < -b.length || sx > W + b.length) continue;
      ctx.save();
      const grad = ctx.createLinearGradient(sx - b.dir * b.length, b.y, sx, b.y);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.55, b.color);
      grad.addColorStop(1, '#FFFFFF');
      ctx.strokeStyle = grad;
      ctx.lineWidth = this.variant === 'stargate' ? 4 : 3.2;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(sx - b.dir * b.length, b.y);
      ctx.lineTo(sx, b.y);
      ctx.stroke();
      ctx.restore();
    }

    // Player Fighter
    this.drawPlayerShip(ctx);

    // Particles & Score Popups in screen space
    for (const p of this.particles) {
      const sx = this.worldToScreenX(p.x);
      if (sx < -20 || sx > W + 20) continue;
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(sx, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    for (const pop of this.popups) {
      const sx = this.worldToScreenX(pop.x);
      if (sx < -60 || sx > W + 60) continue;
      const alpha = Math.min(1, (pop.life / pop.maxLife) * 1.8);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '800 14px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(2,6,23,0.9)';
      ctx.lineWidth = 3;
      ctx.strokeText(pop.text, sx, pop.y);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, sx, pop.y);
      ctx.restore();
    }

    ctx.restore();

    // Smart Bomb / Hyperspace full-screen flash
    if (this.smartBombFlash > 0) {
      ctx.save();
      ctx.globalAlpha = this.smartBombFlash * 0.65;
      ctx.fillStyle =
        this.variant === 'stargate'
          ? `hsl(${Math.floor(this.time * 720) % 360}, 95%, 70%)`
          : '#FFFFFF';
      ctx.fillRect(0, PLAY_TOP, W, H - PLAY_TOP);
      ctx.restore();
    }
    if (this.hyperspaceFlash > 0) {
      ctx.save();
      ctx.globalAlpha = this.hyperspaceFlash * 0.45;
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(0, PLAY_TOP, W, H - PLAY_TOP);
      ctx.restore();
    }

    // Iconic Top Williams Scanner Bar
    this.renderScanner(ctx);

    // Title Card or Status Banner
    if (this.phase === 'TITLE') {
      this.renderTitleOverlay(ctx);
    } else if (this.bannerText) {
      ctx.save();
      ctx.fillStyle = 'rgba(2, 6, 23, 0.8)';
      ctx.fillRect(W * 0.5 - 220, H * 0.5 - 24, 440, 48);
      ctx.strokeStyle =
        this.variant === 'defender'
          ? '#F59E0B'
          : this.variant === 'defender2'
            ? '#C084FC'
            : '#38BDF8';
      ctx.lineWidth = 2;
      ctx.strokeRect(W * 0.5 - 220, H * 0.5 - 24, 440, 48);
      ctx.font = '800 15px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FEF08A';
      ctx.fillText(this.bannerText, W * 0.5, H * 0.5);
      ctx.restore();
    }

    if (visualMode === 'crt') {
      renderCrtOverlay(ctx, W, H);
    }
    ctx.restore();
  }

  private renderTerrain(ctx: CanvasRenderingContext2D): void {
    const strokeCol =
      this.variant === 'defender'
        ? '#F97316'
        : this.variant === 'defender2'
          ? '#C084FC'
          : '#22D3EE';
    const fillTop =
      this.variant === 'defender'
        ? 'rgba(194,65,12,0.34)'
        : this.variant === 'defender2'
          ? 'rgba(126,34,206,0.36)'
          : 'rgba(8,145,178,0.32)';

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let sx = 0; sx <= W; sx += 12) {
      const wx = wrapX(this.cameraX + sx);
      ctx.lineTo(sx, this.getTerrainY(wx));
    }
    ctx.lineTo(W, H);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, PLAY_BOTTOM - 90, 0, H);
    grad.addColorStop(0, fillTop);
    grad.addColorStop(1, 'rgba(2,6,23,0.95)');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    for (let sx = 0; sx <= W; sx += 12) {
      const wx = wrapX(this.cameraX + sx);
      const ty = this.getTerrainY(wx);
      if (sx === 0) ctx.moveTo(sx, ty);
      else ctx.lineTo(sx, ty);
    }
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = 2.6;
    ctx.shadowColor = strokeCol;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.restore();
  }

  private renderGatePortal(ctx: CanvasRenderingContext2D): void {
    const sx = this.worldToScreenX(this.stargateX);
    if (sx < -60 || sx > W + 60) return;

    ctx.save();
    ctx.translate(sx, this.stargateY);
    const primary = this.variant === 'defender2' ? '#E879F9' : '#38BDF8';
    const secondary = this.variant === 'defender2' ? '#A855F7' : '#34D399';
    ctx.shadowColor = primary;
    ctx.shadowBlur = 18;

    for (let r = 0; r < 3; r++) {
      ctx.strokeStyle = r % 2 === 0 ? primary : secondary;
      ctx.lineWidth = 2.6 - r * 0.5;
      ctx.beginPath();
      ctx.ellipse(
        0,
        0,
        14 + r * 7,
        24 + r * 8,
        Math.sin(this.time * 2.4 + r) * 0.25,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }
    drawStarGlint(ctx, 0, 0, 12, '#FFFFFF', 0.85);
    ctx.font = '700 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(this.variant === 'defender2' ? 'WARP GATE' : 'STARGATE', 0, -38);
    ctx.restore();
  }

  private renderWarpTunnel(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, W, H);
    const cx = W * 0.5;
    const cy = H * 0.5;
    for (let i = 0; i < 14; i++) {
      const prog = ((this.time * 2.2 + i / 14) % 1);
      const r = 12 + prog * prog * 420;
      ctx.strokeStyle = `hsl(${(180 + i * 16 + this.time * 180) % 360}, 95%, 62%)`;
      ctx.lineWidth = 2 + prog * 4;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 1.18, r * 0.85, prog * 0.6, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.font = '900 24px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = '#38BDF8';
    ctx.shadowBlur = 18;
    ctx.fillText(this.warpBonusText || 'HYPERSPACE WARP!', cx, cy);
    ctx.restore();
  }

  private drawPlayerShip(ctx: CanvasRenderingContext2D): void {
    if (this.invulnTimer > 0 && Math.floor(this.time * 18) % 2 === 0 && !this.invisoActive) return;

    const sx = this.worldToScreenX(this.px);
    ctx.save();
    ctx.translate(sx, this.py);

    if (this.invisoActive) {
      // Shimmering Inviso Cloak aura
      const cloakCol = this.variant === 'defender2' ? '#E879F9' : '#38BDF8';
      ctx.strokeStyle = cloakCol;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = cloakCol;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.ellipse(0, 0, 28, 15, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.55 + Math.sin(this.time * 24) * 0.25;
    }

    ctx.scale(this.facing, 1);

    // Thruster flame
    const flameLen = 10 + Math.min(22, Math.abs(this.pvx) * 0.04) + Math.random() * 6;
    ctx.fillStyle =
      this.variant === 'defender'
        ? '#F97316'
        : this.variant === 'defender2'
          ? '#E879F9'
          : '#38BDF8';
    ctx.beginPath();
    ctx.moveTo(-16, -4);
    ctx.lineTo(-16 - flameLen, 0);
    ctx.lineTo(-16, 4);
    ctx.closePath();
    ctx.fill();

    if (this.variant === 'defender') {
      // Classic 1981 Williams Defender angular interceptor
      ctx.fillStyle = '#E2E8F0';
      ctx.beginPath();
      ctx.moveTo(22, 1);
      ctx.lineTo(4, -5);
      ctx.lineTo(-10, -10);
      ctx.lineTo(-16, -6);
      ctx.lineTo(-16, 6);
      ctx.lineTo(6, 7);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(-10, -2, 16, 4);
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(2, -5, 7, 3.5);
    } else if (this.variant === 'defender2') {
      // Sleek Defender II violet-chrome Delta Wing
      ctx.fillStyle = '#F3E8FF';
      ctx.beginPath();
      ctx.moveTo(24, 0);
      ctx.lineTo(-14, -12);
      ctx.lineTo(-8, 0);
      ctx.lineTo(-14, 12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#C084FC';
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-8, -6);
      ctx.lineTo(-8, 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(4, -2, 8, 4);
    } else {
      // Stargate Twin-Prong Cyan/Gold Starfighter
      ctx.fillStyle = '#BAE6FD';
      ctx.beginPath();
      ctx.moveTo(24, -4);
      ctx.lineTo(12, -8);
      ctx.lineTo(-16, -10);
      ctx.lineTo(-10, 0);
      ctx.lineTo(-16, 10);
      ctx.lineTo(12, 8);
      ctx.lineTo(24, 4);
      ctx.lineTo(10, 2);
      ctx.lineTo(10, -2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(-4, -3, 12, 6);
      ctx.fillStyle = '#06B6D4';
      ctx.fillRect(-12, -2, 8, 4);
    }

    ctx.restore();
  }

  private drawHumanoid(ctx: CanvasRenderingContext2D, sx: number, sy: number, abducted: boolean): void {
    ctx.save();
    ctx.translate(sx, sy);
    if (abducted) {
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 12 + Math.sin(this.time * 14) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#F472B6';
    ctx.fillRect(-3, -6, 6, 8);
    ctx.fillStyle = '#FDE68A';
    ctx.beginPath();
    ctx.arc(0, -9, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(-3.5, 2, 2.5, 6);
    ctx.fillRect(1, 2, 2.5, 6);
    ctx.restore();
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: DefenderEnemy, sx: number, sy: number): void {
    ctx.save();
    ctx.translate(sx, sy);

    if (e.kind === 'lander') {
      ctx.fillStyle = '#22C55E';
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(12, 2);
      ctx.lineTo(7, 10);
      ctx.lineTo(-7, 10);
      ctx.lineTo(-12, 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(-5, -3, 10, 5);
    } else if (e.kind === 'mutant') {
      ctx.fillStyle = Math.floor(this.time * 16) % 2 === 0 ? '#EF4444' : '#F472B6';
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4ADE80';
      ctx.fillRect(-6, -4, 4, 4);
      ctx.fillRect(2, -4, 4, 4);
    } else if (e.kind === 'bomber' || e.kind === 'firebomber') {
      ctx.fillStyle = e.kind === 'firebomber' ? '#F97316' : '#38BDF8';
      ctx.fillRect(-10, -10, 20, 20);
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(-5, -5, 10, 10);
    } else if (e.kind === 'pod') {
      ctx.rotate(this.time * 3.5);
      ctx.strokeStyle = '#C084FC';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2;
        ctx.moveTo(Math.cos(a) * 12, Math.sin(a) * 12);
        ctx.lineTo(Math.cos(a + Math.PI / 4) * 4, Math.sin(a + Math.PI / 4) * 4);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = '#F472B6';
      ctx.beginPath();
      ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'swarmer') {
      ctx.fillStyle = '#FB7185';
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(8, 0);
      ctx.lineTo(0, 7);
      ctx.lineTo(-8, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(-2, -2, 4, 4);
    } else if (e.kind === 'baiter') {
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.ellipse(0, 0, 15, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(-6, -2, 12, 4);
    } else if (e.kind === 'spacemine') {
      ctx.rotate(this.time * 4);
      ctx.fillStyle = '#E879F9';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(12, 0);
      ctx.moveTo(0, -12);
      ctx.lineTo(0, 12);
      ctx.stroke();
    } else if (e.kind === 'yllabian') {
      // Stargate glowing spinning Yllabian Space Hum ring
      ctx.rotate(this.time * 4.5);
      ctx.strokeStyle = '#2DD4BF';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'dynamo') {
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(-8, -8);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-8, 8);
      ctx.closePath();
      ctx.fill();
    } else {
      // Munchie chomper
      ctx.fillStyle = '#A3E635';
      const mouth = 0.25 + Math.abs(Math.sin(this.time * 12)) * 0.45;
      ctx.beginPath();
      ctx.arc(0, 0, 10, mouth, Math.PI * 2 - mouth);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  private renderScanner(ctx: CanvasRenderingContext2D): void {
    const borderCol =
      this.variant === 'defender'
        ? '#F97316'
        : this.variant === 'defender2'
          ? '#C084FC'
          : '#38BDF8';

    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, W, SCANNER_H);
    ctx.strokeStyle = borderCol;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, SCANNER_H);
    ctx.lineTo(W, SCANNER_H);
    ctx.stroke();

    // Left HUD: Score & Lives / Smart Bombs
    ctx.font = '800 13px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FACC15';
    ctx.fillText(String(this.score).padStart(7, '0'), 14, 24);
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText(`SHIPS ${this.lives}  BOMBS ${this.smartBombs}`, 14, 46);
    ctx.fillStyle = borderCol;
    ctx.fillText(
      this.variant === 'defender'
        ? 'R: HYPERSPACE'
        : `R: INVISO ${Math.round(this.invisoEnergy)}%`,
      14,
      63
    );

    // Center Williams Full-Planet Radar Scanner
    const mapX = 188;
    const mapW = 344;
    const mapY = 8;
    const mapH = SCANNER_H - 16;

    ctx.fillStyle = '#070E20';
    ctx.fillRect(mapX, mapY, mapW, mapH);
    ctx.strokeStyle = borderCol;
    ctx.lineWidth = 1.6;
    ctx.strokeRect(mapX, mapY, mapW, mapH);

    // Mini terrain silhouette on scanner
    if (!this.planetDestroyed) {
      ctx.strokeStyle = borderCol;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      for (let i = 0; i <= 48; i++) {
        const wx = (i / 48) * WORLD_W;
        const rx = mapX + (i / 48) * mapW;
        const ry = mapY + ((this.getTerrainY(wx) - PLAY_TOP) / (PLAY_BOTTOM - PLAY_TOP)) * mapH;
        if (i === 0) ctx.moveTo(rx, ry);
        else ctx.lineTo(rx, ry);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Active viewport box on scanner
    const vpLeft = mapX + (this.cameraX / WORLD_W) * mapW;
    const vpW = (W / WORLD_W) * mapW;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(vpLeft, mapY + 1, Math.min(vpW, mapX + mapW - vpLeft), mapH - 2);

    // Stargate dot on scanner
    if (this.variant !== 'defender') {
      const gx = mapX + (this.stargateX / WORLD_W) * mapW;
      const gy = mapY + ((this.stargateY - PLAY_TOP) / (PLAY_BOTTOM - PLAY_TOP)) * mapH;
      ctx.fillStyle = this.variant === 'defender2' ? '#E879F9' : '#38BDF8';
      ctx.fillRect(gx - 2.5, gy - 2.5, 5, 5);
    }

    // Humanoid blips (flashing beacon when abducted!)
    for (const h of this.humanoids) {
      if (h.state === 'dead') continue;
      const hx = mapX + (h.x / WORLD_W) * mapW;
      const hy = mapY + ((h.y - PLAY_TOP) / (PLAY_BOTTOM - PLAY_TOP)) * mapH;
      ctx.fillStyle = h.state === 'abducted' ? '#EF4444' : '#F472B6';
      ctx.fillRect(hx - 1.5, hy - 2, 3, 4);
      if (h.state === 'abducted' && Math.floor(this.time * 10) % 2 === 0) {
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(hx, mapY);
        ctx.lineTo(hx, mapY + mapH);
        ctx.stroke();
      }
    }

    // Enemy blips
    for (const e of this.enemies) {
      const ex = mapX + (e.x / WORLD_W) * mapW;
      const ey = mapY + ((e.y - PLAY_TOP) / (PLAY_BOTTOM - PLAY_TOP)) * mapH;
      ctx.fillStyle = e.kind === 'lander' ? '#22C55E' : e.kind === 'mutant' ? '#EF4444' : '#FACC15';
      ctx.fillRect(ex - 1.5, ey - 1.5, 3, 3);
    }

    // Player blip
    const pRx = mapX + (this.px / WORLD_W) * mapW;
    const pRy = mapY + ((this.py - PLAY_TOP) / (PLAY_BOTTOM - PLAY_TOP)) * mapH;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(pRx - 2.5, pRy - 1.5, 5, 3);

    // Right HUD: Variant title & Wave
    ctx.textAlign = 'right';
    ctx.font = '800 13px "JetBrains Mono", monospace';
    ctx.fillStyle = borderCol;
    ctx.fillText(
      this.variant === 'defender'
        ? 'DEFENDER'
        : this.variant === 'defender2'
          ? 'DEFENDER II'
          : 'STARGATE',
      W - 14,
      24
    );
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#4ADE80';
    ctx.fillText(`HI ${String(this.highScore).padStart(7, '0')}`, W - 14, 46);
    ctx.fillStyle = '#E2E8F0';
    ctx.fillText(`WAVE ${this.level}`, W - 14, 63);
  }

  private renderTitleOverlay(ctx: CanvasRenderingContext2D): void {
    const accent =
      this.variant === 'defender'
        ? '#F97316'
        : this.variant === 'defender2'
          ? '#C084FC'
          : '#38BDF8';
    const title =
      this.variant === 'defender'
        ? 'DEFENDER'
        : this.variant === 'defender2'
          ? 'DEFENDER II'
          : 'STARGATE';
    const sub =
      this.variant === 'defender'
        ? '1981 WILLIAMS · CRIMSON FRONTIER & HYPERSPACE'
        : this.variant === 'defender2'
          ? '1981 WILLIAMS · VIOLET NEBULA · INVISO & WARP GATE'
          : '1981 WILLIAMS · HYPERSPACE PORTAL · YLLABIANS & MUNCHIES';
    const line2 =
      this.variant === 'defender'
        ? 'RESCUE FALLING HUMANOIDS · SHIFT: SMART BOMB · R: HYPERSPACE'
        : this.variant === 'defender2'
          ? 'RAM FOES WITH INVISO CLOAK (R) · WARP TO ABDUCTED HUMANOIDS'
          : 'WARP WITH 4+ HUMANOIDS TO SKIP WAVES · INVISO (R) · BOMBS (SHIFT)';

    ctx.save();
    ctx.fillStyle = 'rgba(2, 6, 23, 0.78)';
    ctx.fillRect(W * 0.5 - 245, H * 0.5 - 98, 490, 200);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.strokeRect(W * 0.5 - 245, H * 0.5 - 98, 490, 200);

    ctx.textAlign = 'center';
    ctx.font = '900 44px "JetBrains Mono", monospace';
    ctx.fillStyle = accent;
    ctx.fillText(title, W * 0.5, H * 0.5 - 40);

    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.fillStyle = '#F8FAFC';
    ctx.fillText(sub, W * 0.5, H * 0.5 - 4);

    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText(line2, W * 0.5, H * 0.5 + 26);

    ctx.font = '800 15px "JetBrains Mono", monospace';
    ctx.fillStyle = Math.floor(this.time * 3) % 2 === 0 ? '#FACC15' : '#4ADE80';
    ctx.fillText('PRESS PLAY OR SPACE TO LAUNCH', W * 0.5, H * 0.5 + 70);
    ctx.restore();
  }
}

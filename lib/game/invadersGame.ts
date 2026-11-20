import { arcadeAudio } from './audio';
import {
  ArcadeGameInstance,
  ArcadeInputState,
  ClassicGameHud,
  ClassicGamePhase,
  createEmptyInput,
  readHighScore,
  renderCrtOverlay,
  renderParticlesAndPopups,
  saveHighScore,
  ScorePopup,
  SimpleParticle,
  spawnBurst,
  stepParticlesAndPopups,
} from './classicArcadeInterface';
import {
  drawPixelMatrixHD,
  drawStarGlint,
  TAITO_CRAB_F0,
  TAITO_CRAB_F1,
  TAITO_INVADER_EXPLODE,
  TAITO_OCTO_F0,
  TAITO_OCTO_F1,
  TAITO_SHOT_TOP_EXPLODE,
  TAITO_SQUID_F0,
  TAITO_SQUID_F1,
  TAITO_UFO_MATRIX,
} from './arcadeGfx';

const WIDTH = 780;
const HEIGHT = 864;
const STORAGE_KEY = 'space_invaders_hd_highscore_v1';

// Authentic 1978 Taito 15-shot Mystery UFO score table (23rd shot & every 15th thereafter = 300!)
const UFO_TABLE = [100, 50, 50, 100, 150, 100, 100, 50, 300, 100, 100, 100, 50, 150, 100];
// Authentic 1978 Taito Plunger shot column firing sequence
const PLUNGER_COL_SEQ = [0, 6, 0, 0, 0, 3, 10, 0, 5, 2, 0, 0, 10, 8, 1];
const SQUIGGLY_COL_SEQ = [10, 4, 8, 2, 6, 0, 9, 3, 7, 1, 5];
// Authentic 1978 wave start-height table (lowers across waves 1..8, then cycles)
const WAVE_DROP_STEPS = [0, 1, 2, 3, 3, 4, 4, 4];

const CEILING_Y = 54;
const FLOOR_Y = HEIGHT - 38;
const CELLOPHANE_GREEN_Y = HEIGHT - 252;

interface Invader {
  row: number;
  col: number;
  kind: 'squid' | 'crab' | 'octopus';
  points: number;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  stepProgress: number; // Smooth ripple transition per row
  stepDelay: number;
  alive: boolean;
  fireFlash: number;
  animFrame: number;
}

interface EnemyShot {
  x: number;
  y: number;
  vy: number;
  kind: 'rolling' | 'plunger' | 'squiggly';
  phase: number;
  trail: Array<{ x: number; y: number }>;
}

interface Bunker {
  x: number;
  y: number;
  cols: number;
  rows: number;
  cellSize: number;
  cells: boolean[][];
  heat: number[][]; // 0..1 molten crater glow cooling down after impact
}

interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  life: number;
  maxLife: number;
  lineWidth: number;
}

interface SpriteExplosion {
  x: number;
  y: number;
  kind: 'alien' | 'ufo' | 'ceiling' | 'clash';
  color: string;
  life: number;
  maxLife: number;
  scoreText?: string;
}

interface DebrisChunk {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vrot: number;
  color: string;
  life: number;
  maxLife: number;
}

export class SpaceInvadersGame implements ArcadeGameInstance {
  public readonly logicalWidth = WIDTH;
  public readonly logicalHeight = HEIGHT;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'Fire';

  private phase: ClassicGamePhase = 'TITLE';
  private score = 0;
  private highScore = readHighScore(STORAGE_KEY);
  private bonusLifeGiven = false;
  private level = 1;
  private lives = 3;
  private phaseTimer = 0;
  private time = 0;
  private bannerText = '';

  private input: ArcadeInputState = createEmptyInput();
  private playerX = WIDTH * 0.5;
  private playerY = HEIGHT - 78;
  private playerVx = 0;
  private cannonRecoil = 0;
  private muzzleFlash = 0;
  private playerDyingTimer = 0;
  private playerShot: { active: boolean; x: number; y: number; trail: Array<{ x: number; y: number }> } = {
    active: false,
    x: 0,
    y: 0,
    trail: [],
  };
  private shotsFired = 0;
  private invulnTimer = 0;

  private invaders: Invader[] = [];
  private formationDir: 1 | -1 = 1;
  private marchTimer = 0.5;
  private marchAnimFrame = 0;
  private marchStepCount = 0;
  private hitStopTimer = 0;
  private bassPulse = 0;
  private rackRevealProgress = 1;

  private enemyShots: EnemyShot[] = [];
  private enemyFireTimer = 0.75;
  private plungerIdx = 0;
  private squigglyIdx = 0;
  private bunkers: Bunker[] = [];
  private floorNotches: Array<{ x: number; w: number }> = [];

  private ufo = {
    active: false,
    x: 0,
    y: 86,
    dir: 1 as 1 | -1,
    spawnTimer: 12,
    soundTimer: 0,
  };

  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];
  private shockwaves: Shockwave[] = [];
  private spriteExplosions: SpriteExplosion[] = [];
  private debris: DebrisChunk[] = [];
  private shakeTime = 0;
  private shakeMag = 0;
  private screenFlash = 0;
  private screenFlashColor = '#FFFFFF';
  private backdropCache: HTMLCanvasElement | null = null;

  constructor() {
    this.setupWave(1, true);
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public startNewGame(): void {
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.bonusLifeGiven = false;
    this.level = 1;
    this.lives = 3;
    this.shotsFired = 0;
    this.plungerIdx = 0;
    this.squigglyIdx = 0;
    this.particles = [];
    this.popups = [];
    this.shockwaves = [];
    this.spriteExplosions = [];
    this.debris = [];
    this.setupWave(1, true);
    this.phase = 'READY';
    this.phaseTimer = 1.15;
    this.rackRevealProgress = 0;
    this.bannerText = 'WAVE 1 · DEFEND EARTH';
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.level = 1;
    this.setupWave(1, true);
    this.rackRevealProgress = 1;
  }

  public getHudSnapshot(): ClassicGameHud {
    const remaining = this.invaders.filter((a) => a.alive).length;
    const nextUfoPts = UFO_TABLE[this.shotsFired % UFO_TABLE.length];
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: `Lunar Defense · Wave ${this.level}`,
      primaryMetricLabel: 'Invaders',
      primaryMetricValue: `${remaining} / 55`,
      secondaryMetricLabel: nextUfoPts === 300 ? 'UFO JACKPOT!' : 'Next UFO',
      secondaryMetricValue: `${nextUfoPts} pts`,
      bannerText: this.bannerText,
    };
  }

  private addShake(mag: number, dur = 0.16): void {
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeTime = Math.max(this.shakeTime, dur);
  }

  private triggerFlash(color: string, alpha = 0.24): void {
    this.screenFlash = Math.max(this.screenFlash, alpha);
    this.screenFlashColor = color;
  }

  private spawnExplosionVfx(
    x: number,
    y: number,
    color: string,
    kind: 'alien' | 'ufo' | 'player' | 'clash' | 'ceiling',
    scoreText?: string
  ): void {
    if (kind === 'ceiling') {
      this.spriteExplosions.push({ x, y, kind: 'ceiling', color: '#EF4444', life: 0.22, maxLife: 0.22 });
      spawnBurst(this.particles, x, y, '#F87171', 10, 120, 2.2);
      return;
    }
    if (kind === 'clash') {
      this.spriteExplosions.push({ x, y, kind: 'clash', color: '#FEF08A', life: 0.2, maxLife: 0.2 });
      this.shockwaves.push({
        x,
        y,
        radius: 4,
        maxRadius: 28,
        color: '#FEF08A',
        life: 0.22,
        maxLife: 0.22,
        lineWidth: 2.5,
      });
      spawnBurst(this.particles, x, y, '#FEF08A', 14, 175, 2.6);
      return;
    }
    if (kind === 'alien') {
      this.spriteExplosions.push({ x, y, kind: 'alien', color, life: 0.24, maxLife: 0.24 });
      this.shockwaves.push({
        x,
        y,
        radius: 5,
        maxRadius: 42,
        color,
        life: 0.3,
        maxLife: 0.3,
        lineWidth: 3,
      });
      spawnBurst(this.particles, x, y, color, 18, 220, 3.2);
      spawnBurst(this.particles, x, y, '#FFFFFF', 6, 150, 2.1);
      for (let i = 0; i < 8; i++) {
        const ang = (Math.PI * 2 * i) / 8 + (Math.random() - 0.5) * 0.45;
        const spd = 80 + Math.random() * 145;
        this.debris.push({
          x,
          y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          size: 3 + Math.random() * 3.5,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 14,
          color,
          life: 0.38 + Math.random() * 0.22,
          maxLife: 0.6,
        });
      }
      this.addShake(3.2, 0.11);
      return;
    }
    if (kind === 'ufo') {
      this.spriteExplosions.push({
        x,
        y,
        kind: 'ufo',
        color: '#EF4444',
        life: 1.05,
        maxLife: 1.05,
        scoreText,
      });
      this.shockwaves.push(
        { x, y, radius: 8, maxRadius: 78, color: '#EF4444', life: 0.48, maxLife: 0.48, lineWidth: 4.2 },
        { x, y, radius: 4, maxRadius: 52, color: '#FEF08A', life: 0.34, maxLife: 0.34, lineWidth: 2.6 }
      );
      spawnBurst(this.particles, x, y, '#EF4444', 32, 290, 4.2);
      spawnBurst(this.particles, x, y, '#FEF08A', 18, 210, 3.2);
      for (let i = 0; i < 14; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 70 + Math.random() * 210;
        this.debris.push({
          x,
          y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          size: 3.5 + Math.random() * 4.5,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 16,
          color: i % 3 === 0 ? '#FEF08A' : '#EF4444',
          life: 0.55 + Math.random() * 0.3,
          maxLife: 0.85,
        });
      }
      this.addShake(8.5, 0.28);
      this.triggerFlash('#FCA5A5', 0.22);
      return;
    }
    // Player plasma cannon disintegration
    this.shockwaves.push(
      { x, y, radius: 6, maxRadius: 84, color: '#4ADE80', life: 0.55, maxLife: 0.55, lineWidth: 4.5 },
      { x, y, radius: 4, maxRadius: 54, color: '#FEF08A', life: 0.36, maxLife: 0.36, lineWidth: 2.8 }
    );
    spawnBurst(this.particles, x, y, '#4ADE80', 36, 280, 4.4);
    spawnBurst(this.particles, x, y, '#FEF08A', 20, 210, 3.2);
    for (let i = 0; i < 16; i++) {
      const ang = -Math.PI + Math.random() * Math.PI; // burst upward from base
      const spd = 65 + Math.random() * 220;
      this.debris.push({
        x: x + (Math.random() - 0.5) * 24,
        y: y + (Math.random() - 0.5) * 10,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        size: 3.5 + Math.random() * 4,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 18,
        color: i % 4 === 0 ? '#FEF08A' : i % 2 === 0 ? '#86EFAC' : '#22C55E',
        life: 0.6 + Math.random() * 0.32,
        maxLife: 0.92,
      });
    }
    this.addShake(10, 0.36);
    this.triggerFlash('#4ADE80', 0.28);
  }

  private addScore(pts: number, x?: number, y?: number, color = '#4ADE80'): void {
    if (this.phase === 'TITLE') return;
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(STORAGE_KEY, this.highScore);
    }
    if (!this.bonusLifeGiven && this.score >= 1500) {
      this.bonusLifeGiven = true;
      this.lives = Math.min(6, this.lives + 1);
      arcadeAudio.playExtraLife();
      this.popups.push({
        x: this.playerX,
        y: this.playerY - 30,
        text: '1UP!',
        color: '#4ADE80',
        life: 1.4,
        maxLife: 1.4,
      });
    }
    if (x !== undefined && y !== undefined && pts >= 20) {
      this.popups.push({ x, y, text: `+${pts}`, color, life: 0.85, maxLife: 0.85 });
    }
  }

  private createBunkers(): void {
    this.bunkers = [];
    // High-resolution 22x16 beveled Taito phosphor shield bunkers!
    const cols = 22;
    const rows = 16;
    const cellSize = 4;
    const bunkerW = cols * cellSize; // 88px wide
    const spacing = (WIDTH - 4 * bunkerW) / 5;
    for (let i = 0; i < 4; i++) {
      const bx = spacing + i * (bunkerW + spacing);
      const by = HEIGHT - 204;
      const cells: boolean[][] = [];
      const heat: number[][] = [];
      for (let r = 0; r < rows; r++) {
        const cRow: boolean[] = [];
        const hRow: number[] = [];
        for (let c = 0; c < cols; c++) {
          let solid = true;
          // Authentic 45-degree chamfered top corners
          if (r < 4 && (c < 4 - r || c >= cols - (4 - r))) solid = false;
          // Classic lower arch cutout
          const archCenter = (cols - 1) * 0.5;
          const distFromCenter = Math.abs(c - archCenter);
          if (r >= 11 && distFromCenter < 5.2) solid = false;
          if (r === 10 && distFromCenter < 4.2) solid = false;
          if (r === 9 && distFromCenter < 2.8) solid = false;
          cRow.push(solid);
          hRow.push(0);
        }
        cells.push(cRow);
        heat.push(hRow);
      }
      this.bunkers.push({ x: bx, y: by, cols, rows, cellSize, cells, heat });
    }
    this.floorNotches = [];
  }

  private setupWave(wave: number, resetBunkers: boolean): void {
    this.invaders = [];
    const dropLevel = WAVE_DROP_STEPS[(wave - 1) % WAVE_DROP_STEPS.length];
    const startY = 154 + dropLevel * 28;
    const colSpacing = 54;
    const rowSpacing = 46;
    const startX = (WIDTH - 10 * colSpacing) * 0.5;

    for (let r = 0; r < 5; r++) {
      const kind = r === 0 ? 'squid' : r <= 2 ? 'crab' : 'octopus';
      const points = r === 0 ? 30 : r <= 2 ? 20 : 10;
      for (let c = 0; c < 11; c++) {
        const ix = startX + c * colSpacing;
        const iy = startY + r * rowSpacing;
        this.invaders.push({
          row: r,
          col: c,
          kind,
          points,
          x: ix,
          y: iy,
          prevX: ix,
          prevY: iy,
          stepProgress: 1,
          stepDelay: 0,
          alive: true,
          fireFlash: 0,
          animFrame: 0,
        });
      }
    }

    this.formationDir = 1;
    this.marchTimer = 0.5;
    this.marchAnimFrame = 0;
    this.marchStepCount = 0;
    this.hitStopTimer = 0;
    this.playerDyingTimer = 0;
    this.enemyShots = [];
    this.playerShot = { active: false, x: 0, y: 0, trail: [] };
    this.playerX = WIDTH * 0.5;
    this.playerVx = 0;
    this.invulnTimer = 1.1;
    this.ufo.active = false;
    this.ufo.spawnTimer = 11 + Math.random() * 5;
    if (resetBunkers) this.createBunkers();
  }

  public step(dt: number): void {
    this.time += dt;
    stepParticlesAndPopups(this.particles, this.popups, dt);
    this.stepVfx(dt);

    if (this.phase === 'PAUSED' || this.phase === 'GAME_OVER') return;

    if (this.phase === 'READY') {
      this.phaseTimer -= dt;
      this.rackRevealProgress = Math.min(1, this.rackRevealProgress + dt * 1.45);
      if (this.phaseTimer <= 0) {
        this.rackRevealProgress = 1;
        this.phase = 'PLAYING';
        this.bannerText = '';
      }
      return;
    }

    if (this.phase === 'STAGE_CLEAR') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.level += 1;
        this.setupWave(this.level, true);
        this.phase = 'READY';
        this.phaseTimer = 1.15;
        this.rackRevealProgress = 0;
        this.bannerText = `WAVE ${this.level}`;
      }
      return;
    }

    // Handle dramatic player disintegration animation cleanly before respawning
    if (this.playerDyingTimer > 0) {
      this.playerDyingTimer -= dt;
      if (Math.random() < 0.55) {
        spawnBurst(
          this.particles,
          this.playerX + (Math.random() - 0.5) * 28,
          this.playerY + (Math.random() - 0.5) * 10,
          Math.random() < 0.4 ? '#FEF08A' : '#4ADE80',
          3,
          130,
          2.6
        );
      }
      if (this.playerDyingTimer <= 0) {
        this.finishPlayerDeath();
      }
      return;
    }

    const isAttract = this.phase === 'TITLE';
    this.updatePlayer(dt, isAttract);
    this.updatePlayerShot(dt, isAttract);

    if (this.hitStopTimer > 0) {
      this.hitStopTimer = Math.max(0, this.hitStopTimer - dt);
    } else {
      this.updateFormation(dt, isAttract);
    }

    this.updateEnemyShots(dt, isAttract);
    this.updateUfo(dt, isAttract);

    if (!this.invaders.some((a) => a.alive)) {
      if (isAttract) {
        this.setupWave(1, true);
      } else {
        arcadeAudio.playStageClear();
        this.phase = 'STAGE_CLEAR';
        this.phaseTimer = 1.5;
        this.bannerText = `WAVE ${this.level} CLEARED!`;
        this.triggerFlash('#4ADE80', 0.2);
      }
    }
  }

  private stepVfx(dt: number): void {
    if (this.cannonRecoil > 0) this.cannonRecoil = Math.max(0, this.cannonRecoil - dt * 28);
    if (this.muzzleFlash > 0) this.muzzleFlash = Math.max(0, this.muzzleFlash - dt * 9);
    if (this.bassPulse > 0) this.bassPulse = Math.max(0, this.bassPulse - dt * 5.2);
    if (this.shakeTime > 0) {
      this.shakeTime = Math.max(0, this.shakeTime - dt);
      if (this.shakeTime === 0) this.shakeMag = 0;
    }
    if (this.screenFlash > 0) this.screenFlash = Math.max(0, this.screenFlash - dt * 1.6);

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life -= dt;
      if (sw.life <= 0) {
        this.shockwaves.splice(i, 1);
      } else {
        const t = 1 - sw.life / sw.maxLife;
        sw.radius = sw.maxRadius * (1 - Math.pow(1 - t, 2.4));
      }
    }

    for (let i = this.spriteExplosions.length - 1; i >= 0; i--) {
      this.spriteExplosions[i].life -= dt;
      if (this.spriteExplosions[i].life <= 0) this.spriteExplosions.splice(i, 1);
    }

    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.life -= dt;
      if (d.life <= 0) {
        this.debris.splice(i, 1);
      } else {
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.vx *= 0.96;
        d.vy = d.vy * 0.96 + 130 * dt;
        d.rot += d.vrot * dt;
      }
    }

    // Cool down molten bunker rims & step per-invader ripple motion
    for (const bk of this.bunkers) {
      for (let r = 0; r < bk.rows; r++) {
        for (let c = 0; c < bk.cols; c++) {
          if (bk.heat[r][c] > 0) bk.heat[r][c] = Math.max(0, bk.heat[r][c] - dt * 2.3);
        }
      }
    }

    for (const inv of this.invaders) {
      if (!inv.alive) continue;
      if (inv.fireFlash > 0) inv.fireFlash = Math.max(0, inv.fireFlash - dt * 5.5);
      if (inv.stepDelay > 0) {
        inv.stepDelay = Math.max(0, inv.stepDelay - dt);
      } else if (inv.stepProgress < 1) {
        inv.stepProgress = Math.min(1, inv.stepProgress + dt * 22);
      }
    }
  }

  private updatePlayer(dt: number, isAttract: boolean): void {
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);

    if (isAttract) {
      const alive = this.invaders.filter((a) => a.alive);
      const target = this.ufo.active
        ? { x: this.ufo.x }
        : alive[Math.floor(this.time * 1.4) % Math.max(1, alive.length)] ?? { x: WIDTH * 0.5 };
      const dx = target.x - this.playerX;
      const move = Math.sign(dx) * Math.min(Math.abs(dx), 280 * dt);
      this.playerVx = move / Math.max(0.001, dt);
      this.playerX += move;
      if (!this.playerShot.active && Math.abs(dx) < 34) {
        this.playerShot = { active: true, x: this.playerX, y: this.playerY - 20, trail: [] };
        this.cannonRecoil = 5.5;
        this.muzzleFlash = 1;
      }
      return;
    }

    const dir = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    this.playerVx = dir * 345;
    this.playerX = Math.max(42, Math.min(WIDTH - 42, this.playerX + this.playerVx * dt));

    if ((this.input.fire || this.input.fireJustPressed) && !this.playerShot.active) {
      this.playerShot = { active: true, x: this.playerX, y: this.playerY - 20, trail: [] };
      this.shotsFired += 1;
      this.cannonRecoil = 6;
      this.muzzleFlash = 1;
      arcadeAudio.playInvaderLaser(false);
    }
  }

  private damageBunkerAt(x: number, y: number, radius: number, jagged = true): boolean {
    let hitAny = false;
    for (const bk of this.bunkers) {
      const lx = x - bk.x;
      const ly = y - bk.y;
      if (lx < -radius || ly < -radius || lx > bk.cols * bk.cellSize + radius || ly > bk.rows * bk.cellSize + radius) {
        continue;
      }
      const c0 = Math.floor(lx / bk.cellSize);
      const r0 = Math.floor(ly / bk.cellSize);
      // Find closest solid cell inside a small contact window
      let found = false;
      for (let rr = Math.max(0, r0 - 1); rr <= Math.min(bk.rows - 1, r0 + 1) && !found; rr++) {
        for (let cc = Math.max(0, c0 - 1); cc <= Math.min(bk.cols - 1, c0 + 1); cc++) {
          if (bk.cells[rr][cc]) {
            found = true;
            break;
          }
        }
      }
      if (!found) continue;

      hitAny = true;
      const cr = Math.ceil((radius + 5) / bk.cellSize);
      for (let r = Math.max(0, r0 - cr); r <= Math.min(bk.rows - 1, r0 + cr); r++) {
        for (let c = Math.max(0, c0 - cr); c <= Math.min(bk.cols - 1, c0 + cr); c++) {
          const dist = Math.hypot((c - c0) * bk.cellSize, (r - r0) * bk.cellSize);
          const jitter = jagged ? (Math.sin(r * 13.7 + c * 7.3 + this.time * 40) * 0.5 + 0.5) * 3.8 : 0;
          if (dist <= radius - jitter * 0.45) {
            bk.cells[r][c] = false;
            bk.heat[r][c] = 0;
          } else if (bk.cells[r][c] && dist <= radius + 6.5) {
            // Superheat surviving crater rim cells!
            bk.heat[r][c] = Math.min(1, bk.heat[r][c] + 0.95);
          }
        }
      }
    }
    return hitAny;
  }

  private updatePlayerShot(dt: number, isAttract: boolean): void {
    if (!this.playerShot.active) return;
    this.playerShot.trail.push({ x: this.playerShot.x, y: this.playerShot.y });
    if (this.playerShot.trail.length > 7) this.playerShot.trail.shift();

    this.playerShot.y -= 820 * dt;
    if (this.playerShot.y <= CEILING_Y + 6) {
      this.playerShot.active = false;
      this.spawnExplosionVfx(this.playerShot.x, CEILING_Y + 8, '#EF4444', 'ceiling');
      return;
    }

    // Bunker carving (authentic player can carve thin sniper tunnels!)
    if (this.damageBunkerAt(this.playerShot.x, this.playerShot.y, 10, true)) {
      this.playerShot.active = false;
      if (!isAttract) arcadeAudio.playInvaderExplosion('bunker');
      spawnBurst(this.particles, this.playerShot.x, this.playerShot.y, '#86EFAC', 8, 105, 2.2);
      spawnBurst(this.particles, this.playerShot.x, this.playerShot.y, '#FDE047', 4, 85, 1.8);
      return;
    }

    // Shot-vs-shot mid-air intercept!
    for (let i = this.enemyShots.length - 1; i >= 0; i--) {
      const es = this.enemyShots[i];
      if (Math.hypot(this.playerShot.x - es.x, this.playerShot.y - es.y) < 15) {
        this.enemyShots.splice(i, 1);
        this.playerShot.active = false;
        if (!isAttract) arcadeAudio.playInvaderExplosion('clash');
        this.spawnExplosionVfx(es.x, es.y, '#FEF08A', 'clash');
        return;
      }
    }

    // Mystery Red UFO hit!
    if (this.ufo.active && Math.hypot(this.playerShot.x - this.ufo.x, this.playerShot.y - this.ufo.y) < 30) {
      const pts = UFO_TABLE[this.shotsFired % UFO_TABLE.length];
      const ux = this.ufo.x;
      const uy = this.ufo.y;
      this.ufo.active = false;
      this.ufo.spawnTimer = 15 + Math.random() * 6;
      this.playerShot.active = false;
      if (!isAttract) arcadeAudio.playInvaderExplosion('ufo');
      this.spawnExplosionVfx(ux, uy, '#EF4444', 'ufo', `${pts}`);
      this.addScore(pts);
      return;
    }

    // Invader hit!
    for (const inv of this.invaders) {
      if (!inv.alive) continue;
      const { rx, ry } = this.getInvaderRenderPos(inv);
      if (Math.abs(this.playerShot.x - rx) < 21 && Math.abs(this.playerShot.y - ry) < 17) {
        inv.alive = false;
        this.playerShot.active = false;
        this.hitStopTimer = 0.095; // Authentic 1978 brief march hit-stop freeze!
        if (!isAttract) arcadeAudio.playInvaderExplosion('alien');
        const col = this.getInvaderColor(inv, ry);
        this.spawnExplosionVfx(rx, ry, col, 'alien');
        this.addScore(inv.points, rx, ry - 6, col);
        return;
      }
    }
  }

  private getInvaderRenderPos(inv: Invader): { rx: number; ry: number } {
    const t = Math.min(1, Math.max(0, inv.stepProgress));
    const ease = t * (2 - t);
    return {
      rx: inv.prevX + (inv.x - inv.prevX) * ease,
      ry: inv.prevY + (inv.y - inv.prevY) * ease,
    };
  }

  private getInvaderColor(inv: Invader, y: number): string {
    // Authentic Taito cellophane color bands: emerald phosphor when entering the lower zone!
    if (y > CELLOPHANE_GREEN_Y) return '#4ADE80';
    if (inv.kind === 'squid') return '#F8FAFC';
    if (inv.kind === 'crab') return '#BAE6FD';
    return '#7DD3FC';
  }

  private updateFormation(dt: number, isAttract: boolean): void {
    const alive = this.invaders.filter((a) => a.alive);
    if (alive.length === 0) return;

    // Authentic 1978 tempo curve: steady ominous march -> hyper-frantic heartbeat on final aliens!
    const ratio = alive.length / 55;
    const waveSpeedup = Math.max(0.42, 0.72 - (this.level - 1) * 0.04);
    const stepInterval = Math.max(0.048, 0.048 + Math.pow(ratio, 1.38) * waveSpeedup);

    this.marchTimer -= dt;
    if (this.marchTimer > 0) return;
    this.marchTimer = stepInterval;
    this.marchAnimFrame = 1 - this.marchAnimFrame;
    this.bassPulse = 1;
    if (!isAttract) arcadeAudio.playInvaderStep(this.marchStepCount);
    this.marchStepCount++;

    // Authentic 1978 final-invader asymmetry: faster sprint right than left!
    const stepX = alive.length === 1 ? (this.formationDir === 1 ? 18 : 14) : 12;
    let minX = Infinity;
    let maxX = -Infinity;
    for (const inv of alive) {
      if (inv.x < minX) minX = inv.x;
      if (inv.x > maxX) maxX = inv.x;
    }

    const hitEdge =
      (this.formationDir === 1 && maxX + stepX > WIDTH - 36) ||
      (this.formationDir === -1 && minX - stepX < 36);

    // Bottom-to-top authentic Taito ripple delay (scales down as tempo increases)
    const rowStagger = Math.min(0.018, stepInterval * 0.08);

    if (hitEdge) {
      this.formationDir = this.formationDir === 1 ? -1 : 1;
      for (const inv of alive) {
        inv.prevX = inv.x;
        inv.prevY = inv.y;
        inv.y += 24;
        inv.stepProgress = 0;
        inv.stepDelay = (4 - inv.row) * rowStagger;
        inv.animFrame = this.marchAnimFrame;
        this.damageBunkerAt(inv.x, inv.y + 8, 22, false);
        if (inv.y >= this.playerY - 22) {
          if (isAttract) {
            this.setupWave(1, true);
            return;
          }
          // Authentic 1978 rule: if invaders land, instant invasion defeat!
          this.lives = 1;
          this.triggerPlayerHit();
          return;
        }
      }
    } else {
      for (const inv of alive) {
        inv.prevX = inv.x;
        inv.prevY = inv.y;
        inv.x += this.formationDir * stepX;
        inv.stepProgress = 0;
        inv.stepDelay = (4 - inv.row) * rowStagger;
        inv.animFrame = this.marchAnimFrame;
        this.damageBunkerAt(inv.x, inv.y + 8, 18, false);
      }
    }
  }

  private updateEnemyShots(dt: number, isAttract: boolean): void {
    const aliveList = this.invaders.filter((a) => a.alive);
    this.enemyFireTimer -= dt;
    const maxShots = Math.min(4, 2 + Math.floor((this.level + 1) * 0.5));

    if (this.enemyFireTimer <= 0 && this.enemyShots.length < maxShots && aliveList.length > 0) {
      this.enemyFireTimer = Math.max(0.32, 0.95 - this.level * 0.075);

      const bottomByCol = new Map<number, Invader>();
      for (const inv of aliveList) {
        const prev = bottomByCol.get(inv.col);
        if (!prev || inv.row > prev.row) bottomByCol.set(inv.col, inv);
      }

      // Authentic 1978 3-shot system: Rolling (targeted), Plunger (table, disabled at 1 alien), Squiggly (table, paused during UFO)
      const activeKinds = new Set(this.enemyShots.map((s) => s.kind));
      const availableKinds: Array<'rolling' | 'plunger' | 'squiggly'> = [];
      if (!activeKinds.has('rolling')) availableKinds.push('rolling');
      if (!activeKinds.has('plunger') && aliveList.length > 1) availableKinds.push('plunger');
      if (!activeKinds.has('squiggly') && !this.ufo.active) availableKinds.push('squiggly');

      const kind =
        availableKinds.length > 0
          ? availableKinds[Math.floor(Math.random() * availableKinds.length)]
          : 'rolling';

      const shooters = Array.from(bottomByCol.values());
      let chosen: Invader | undefined;

      if (kind === 'rolling') {
        // Targeted column closest to player cannon!
        chosen = shooters.reduce((best, cur) =>
          Math.abs(cur.x - this.playerX) < Math.abs(best.x - this.playerX) ? cur : best
        );
      } else if (kind === 'plunger') {
        for (let tries = 0; tries < PLUNGER_COL_SEQ.length; tries++) {
          const col = PLUNGER_COL_SEQ[this.plungerIdx % PLUNGER_COL_SEQ.length];
          this.plungerIdx++;
          if (bottomByCol.has(col)) {
            chosen = bottomByCol.get(col);
            break;
          }
        }
      } else {
        for (let tries = 0; tries < SQUIGGLY_COL_SEQ.length; tries++) {
          const col = SQUIGGLY_COL_SEQ[this.squigglyIdx % SQUIGGLY_COL_SEQ.length];
          this.squigglyIdx++;
          if (bottomByCol.has(col)) {
            chosen = bottomByCol.get(col);
            break;
          }
        }
      }

      if (!chosen && shooters.length > 0) {
        chosen = shooters[Math.floor(Math.random() * shooters.length)];
      }

      if (chosen) {
        chosen.fireFlash = 1;
        const speedBase = kind === 'squiggly' ? 305 : kind === 'rolling' ? 285 : 265;
        this.enemyShots.push({
          x: chosen.x,
          y: chosen.y + 18,
          vy: speedBase + this.level * 20,
          kind,
          phase: 0,
          trail: [],
        });
      }
    }

    for (let i = this.enemyShots.length - 1; i >= 0; i--) {
      const s = this.enemyShots[i];
      s.trail.push({ x: s.x, y: s.y });
      if (s.trail.length > 5) s.trail.shift();
      s.y += s.vy * dt;
      s.phase += dt * 28;

      if (this.damageBunkerAt(s.x, s.y, 12, true)) {
        this.enemyShots.splice(i, 1);
        if (!isAttract) arcadeAudio.playInvaderExplosion('bunker');
        spawnBurst(this.particles, s.x, s.y, '#4ADE80', 9, 105, 2.3);
        spawnBurst(this.particles, s.x, s.y, '#FB923C', 5, 85, 1.9);
        continue;
      }

      if (
        !isAttract &&
        this.invulnTimer <= 0 &&
        Math.abs(s.x - this.playerX) < 23 &&
        Math.abs(s.y - this.playerY) < 16
      ) {
        this.enemyShots.splice(i, 1);
        this.triggerPlayerHit();
        return;
      }

      // Authentic 1978 phosphor ground baseline erosion notch + impact sparks!
      if (s.y >= FLOOR_Y - 2) {
        this.floorNotches.push({ x: s.x, w: 8 + Math.random() * 5 });
        if (this.floorNotches.length > 48) this.floorNotches.shift();
        spawnBurst(this.particles, s.x, FLOOR_Y - 2, '#4ADE80', 7, 95, 2.1);
        this.enemyShots.splice(i, 1);
      }
    }
  }

  private updateUfo(dt: number, isAttract: boolean): void {
    if (!this.ufo.active) {
      this.ufo.spawnTimer -= dt;
      if (this.ufo.spawnTimer <= 0 && this.invaders.filter((a) => a.alive).length >= 8) {
        // Authentic 1978 rule: UFO travel direction depends on shot count parity!
        const fromLeft = this.shotsFired % 2 === 0;
        this.ufo = {
          active: true,
          x: fromLeft ? -42 : WIDTH + 42,
          y: 86,
          dir: fromLeft ? 1 : -1,
          spawnTimer: 16,
          soundTimer: 0,
        };
      }
    } else {
      this.ufo.x += this.ufo.dir * 168 * dt;
      if (!isAttract) {
        this.ufo.soundTimer -= dt;
        if (this.ufo.soundTimer <= 0) {
          this.ufo.soundTimer = 0.14;
          arcadeAudio.playUfoPing(true);
        }
      }
      if (this.ufo.x < -54 || this.ufo.x > WIDTH + 54) {
        this.ufo.active = false;
        this.ufo.spawnTimer = 15 + Math.random() * 6;
      }
    }
  }

  private triggerPlayerHit(): void {
    arcadeAudio.playInvaderExplosion('player');
    this.spawnExplosionVfx(this.playerX, this.playerY, '#4ADE80', 'player');
    this.enemyShots = [];
    this.playerShot.active = false;
    this.playerDyingTimer = 0.85;
  }

  private finishPlayerDeath(): void {
    this.lives -= 1;
    if (this.lives <= 0) {
      this.phase = 'GAME_OVER';
      this.bannerText = 'GAME OVER';
      return;
    }
    this.playerX = WIDTH * 0.5;
    this.playerVx = 0;
    this.invulnTimer = 1.8;
    this.phase = 'READY';
    this.phaseTimer = 1.0;
    this.rackRevealProgress = 1;
    this.bannerText = 'READY!';
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Subtle micro screen-shake offset
    const sx = this.shakeTime > 0 ? (Math.random() - 0.5) * 2 * this.shakeMag : 0;
    const sy = this.shakeTime > 0 ? (Math.random() - 0.5) * 2 * this.shakeMag : 0;

    ctx.save();
    ctx.translate(sx, sy);

    this.drawCabinetBackdrop(ctx);
    this.drawFloorBaseline(ctx);
    this.drawBunkers(ctx);

    if (this.ufo.active) {
      this.drawUfo(ctx, this.ufo.x, this.ufo.y);
    }

    // Invader formation (with authentic rapid rack-draw reveal on READY!)
    const maxVisibleRow = Math.floor(this.rackRevealProgress * 5.2);
    for (const inv of this.invaders) {
      if (!inv.alive) continue;
      if (this.phase === 'READY' && 4 - inv.row > maxVisibleRow) continue;
      const { rx, ry } = this.getInvaderRenderPos(inv);
      const color = this.getInvaderColor(inv, ry);
      this.drawInvader(ctx, inv, rx, ry, color);
    }

    this.drawEnemyShots(ctx);
    this.drawPlayerShot(ctx);

    // Player laser cannon or crackling plasma disintegration sequence
    if (this.playerDyingTimer > 0) {
      this.drawPlayerDisintegration(ctx);
    } else if (this.phase !== 'GAME_OVER') {
      const blink = this.invulnTimer > 0 && Math.floor(this.time * 16) % 2 === 0;
      if (!blink) this.drawCannon(ctx, this.playerX, this.playerY);
    }

    this.drawVfxLayers(ctx);
    renderParticlesAndPopups(ctx, this.particles, this.popups);

    if (this.screenFlash > 0.01) {
      ctx.save();
      ctx.globalAlpha = this.screenFlash;
      ctx.fillStyle = this.screenFlashColor;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.restore();
    }

    ctx.restore();

    if (this.bannerText && (this.phase === 'READY' || this.phase === 'STAGE_CLEAR')) {
      ctx.save();
      ctx.font = '800 30px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(3, 6, 15, 0.88)';
      ctx.beginPath();
      ctx.roundRect(WIDTH * 0.2, HEIGHT * 0.44, WIDTH * 0.6, 62, 10);
      ctx.fill();
      ctx.strokeStyle = '#4ADE80';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.shadowColor = '#4ADE80';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#DCFCE7';
      ctx.fillText(this.bannerText, WIDTH * 0.5, HEIGHT * 0.44 + 31);
      ctx.restore();
    }

    if (visualMode === 'crt') renderCrtOverlay(ctx, WIDTH, HEIGHT);
  }

  private getOrBuildBackdrop(): HTMLCanvasElement | null {
    if (this.backdropCache) return this.backdropCache;
    if (typeof document === 'undefined') return null;

    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const bctx = canvas.getContext('2d');
    if (!bctx) return null;

    // Classic 1978 Taito Upright Cabinet Lunar Mirror Backdrop (baked once!)
    const bg = bctx.createLinearGradient(0, 0, 0, HEIGHT);
    bg.addColorStop(0, '#02040D');
    bg.addColorStop(0.55, '#040917');
    bg.addColorStop(0.84, '#07141A');
    bg.addColorStop(1, '#04130D');
    bctx.fillStyle = bg;
    bctx.fillRect(0, 0, WIDTH, HEIGHT);

    const neb = bctx.createRadialGradient(WIDTH * 0.78, 185, 18, WIDTH * 0.78, 185, 250);
    neb.addColorStop(0, 'rgba(56, 189, 248, 0.11)');
    neb.addColorStop(0.55, 'rgba(99, 102, 241, 0.05)');
    neb.addColorStop(1, 'rgba(0, 0, 0, 0)');
    bctx.fillStyle = neb;
    bctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Distant Saturn-like ringed planet
    bctx.save();
    bctx.translate(WIDTH * 0.82, 165);
    const pGrad = bctx.createRadialGradient(-12, -14, 6, 0, 0, 42);
    pGrad.addColorStop(0, 'rgba(125, 211, 252, 0.22)');
    pGrad.addColorStop(0.7, 'rgba(30, 58, 138, 0.14)');
    pGrad.addColorStop(1, 'rgba(15, 23, 42, 0.04)');
    bctx.fillStyle = pGrad;
    bctx.beginPath();
    bctx.arc(0, 0, 38, 0, Math.PI * 2);
    bctx.fill();
    bctx.rotate(-0.28);
    bctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
    bctx.lineWidth = 4;
    bctx.beginPath();
    bctx.ellipse(0, 0, 74, 15, 0, 0, Math.PI * 2);
    bctx.stroke();
    bctx.strokeStyle = 'rgba(226, 232, 240, 0.12)';
    bctx.lineWidth = 1.5;
    bctx.beginPath();
    bctx.ellipse(0, 0, 62, 11, 0, 0, Math.PI * 2);
    bctx.stroke();
    bctx.restore();

    // Lunar Mountain Horizon Silhouette
    const moonGrad = bctx.createLinearGradient(0, HEIGHT - 230, 0, HEIGHT - 34);
    moonGrad.addColorStop(0, 'rgba(34, 197, 94, 0.08)');
    moonGrad.addColorStop(1, 'rgba(6, 28, 20, 0.48)');
    bctx.fillStyle = moonGrad;
    bctx.beginPath();
    bctx.moveTo(0, HEIGHT - 38);
    bctx.lineTo(0, HEIGHT - 122);
    bctx.lineTo(76, HEIGHT - 168);
    bctx.lineTo(155, HEIGHT - 134);
    bctx.lineTo(246, HEIGHT - 182);
    bctx.lineTo(354, HEIGHT - 130);
    bctx.lineTo(448, HEIGHT - 166);
    bctx.lineTo(548, HEIGHT - 126);
    bctx.lineTo(646, HEIGHT - 176);
    bctx.lineTo(732, HEIGHT - 138);
    bctx.lineTo(WIDTH, HEIGHT - 152);
    bctx.lineTo(WIDTH, HEIGHT - 38);
    bctx.closePath();
    bctx.fill();
    bctx.strokeStyle = 'rgba(74, 222, 128, 0.16)';
    bctx.lineWidth = 1.4;
    bctx.stroke();

    // Authentic Taito cabinet cellophane overlay zones
    const redZone = bctx.createLinearGradient(0, 48, 0, 124);
    redZone.addColorStop(0, 'rgba(239, 68, 68, 0.08)');
    redZone.addColorStop(1, 'rgba(239, 68, 68, 0)');
    bctx.fillStyle = redZone;
    bctx.fillRect(0, 48, WIDTH, 76);

    const greenZone = bctx.createLinearGradient(0, CELLOPHANE_GREEN_Y, 0, HEIGHT);
    greenZone.addColorStop(0, 'rgba(34, 197, 94, 0.02)');
    greenZone.addColorStop(0.25, 'rgba(34, 197, 94, 0.055)');
    greenZone.addColorStop(1, 'rgba(34, 197, 94, 0.08)');
    bctx.fillStyle = greenZone;
    bctx.fillRect(0, CELLOPHANE_GREEN_Y, WIDTH, HEIGHT - CELLOPHANE_GREEN_Y);

    bctx.fillStyle = 'rgba(248, 113, 113, 0.22)';
    bctx.fillRect(24, CEILING_Y - 2, WIDTH - 48, 1.5);

    this.backdropCache = canvas;
    return canvas;
  }

  private drawCabinetBackdrop(ctx: CanvasRenderingContext2D): void {
    const cached = this.getOrBuildBackdrop();
    if (cached) {
      ctx.drawImage(cached, 0, 0);
    } else {
      ctx.fillStyle = '#040917';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    // Fast batched twinkling stars (2 buckets)
    const bright = 0.25 + 0.18 * Math.sin(this.time * 2.5);
    ctx.fillStyle = `rgba(255, 255, 255, ${bright.toFixed(2)})`;
    ctx.beginPath();
    for (let i = 0; i < 64; i += 2) {
      const sx = (i * 223 + 31) % WIDTH;
      const sy = ((i * 349 + 19) % (HEIGHT - 165)) + 20;
      const sz = i % 5 === 0 ? 2.2 : 1.4;
      ctx.rect(sx, sy, sz, sz);
    }
    ctx.fill();

    ctx.fillStyle = `rgba(186, 230, 253, ${(0.42 - bright * 0.45).toFixed(2)})`;
    ctx.beginPath();
    for (let i = 1; i < 64; i += 2) {
      const sx = (i * 223 + 31) % WIDTH;
      const sy = ((i * 349 + 19) % (HEIGHT - 165)) + 20;
      ctx.rect(sx, sy, 1.6, 1.6);
    }
    ctx.fill();

    if (this.bassPulse > 0.04) {
      ctx.fillStyle = `rgba(34, 197, 94, ${(this.bassPulse * 0.08).toFixed(3)})`;
      ctx.fillRect(0, HEIGHT - 175, WIDTH, 137);
    }
  }

  private drawFloorBaseline(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(34, 197, 94, 0.28)';
    ctx.fillRect(24, FLOOR_Y - 2, WIDTH - 48, 8);
    ctx.fillStyle = '#22C55E';
    ctx.fillRect(24, FLOOR_Y, WIDTH - 48, 4);
    ctx.fillStyle = '#BBF7D0';
    ctx.fillRect(24, FLOOR_Y, WIDTH - 48, 1.3);

    if (this.floorNotches.length > 0) {
      ctx.fillStyle = '#04130D';
      ctx.beginPath();
      for (const n of this.floorNotches) {
        ctx.rect(n.x - n.w * 0.5, FLOOR_Y - 2, n.w, 8);
      }
      ctx.fill();
    }
  }

  private drawBunkers(ctx: CanvasRenderingContext2D): void {
    const topCells: Array<[number, number, number]> = [];
    const midCells: Array<[number, number, number]> = [];
    const botCells: Array<[number, number, number]> = [];
    const hotCells: Array<[number, number, number]> = [];
    const warmCells: Array<[number, number, number]> = [];

    for (const bk of this.bunkers) {
      const sz = bk.cellSize;
      for (let r = 0; r < bk.rows; r++) {
        const by = bk.y + r * sz;
        for (let c = 0; c < bk.cols; c++) {
          if (!bk.cells[r][c]) continue;
          const bx = bk.x + c * sz;
          const heat = bk.heat[r][c];
          if (heat > 0.65) hotCells.push([bx, by, sz]);
          else if (heat > 0.25) warmCells.push([bx, by, sz]);
          else if (r === 0 || !bk.cells[r - 1][c]) topCells.push([bx, by, sz]);
          else if (r === bk.rows - 1 || !bk.cells[r + 1][c]) botCells.push([bx, by, sz]);
          else midCells.push([bx, by, sz]);
        }
      }
    }

    const flush = (list: Array<[number, number, number]>, color: string) => {
      if (list.length === 0) return;
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let i = 0; i < list.length; i++) {
        const [bx, by, sz] = list[i];
        ctx.rect(bx + 0.15, by + 0.15, sz - 0.3, sz - 0.3);
      }
      ctx.fill();
    };

    flush(midCells, '#22C55E');
    flush(botCells, '#15803D');
    flush(topCells, '#86EFAC');
    flush(warmCells, '#FB923C');
    flush(hotCells, '#FEF08A');

    if (topCells.length > 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.beginPath();
      for (let i = 0; i < topCells.length; i++) {
        const [bx, by, sz] = topCells[i];
        ctx.rect(bx + 0.3, by + 0.2, sz - 0.6, 1.2);
      }
      ctx.fill();
    }
  }

  private drawUfo(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    // Volumetric red hover underglow
    const glow = ctx.createRadialGradient(x, y + 6, 4, x, y + 6, 42);
    glow.addColorStop(0, 'rgba(239, 68, 68, 0.36)');
    glow.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(x, y + 6, 42, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawPixelMatrixHD(ctx, TAITO_UFO_MATRIX, x, y, 3.6, { '#': '#EF4444' }, 'rgba(239, 68, 68, 0.92)');

    // Chasing bright saucer rim lights
    ctx.save();
    ctx.translate(x, y);
    const activeIdx = Math.floor(this.time * 14) % 5;
    for (let i = -2; i <= 2; i++) {
      const lit = i + 2 === activeIdx;
      ctx.shadowColor = lit ? '#FFFFFF' : '#FEF08A';
      ctx.shadowBlur = lit ? 10 : 4;
      ctx.fillStyle = lit ? '#FFFFFF' : '#FEF08A';
      ctx.beginPath();
      ctx.arc(i * 10, 0.5, lit ? 2.8 : 1.9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawInvader(ctx: CanvasRenderingContext2D, inv: Invader, rx: number, ry: number, color: string): void {
    const frame = inv.animFrame;
    const matrix =
      inv.kind === 'squid'
        ? frame === 0
          ? TAITO_SQUID_F0
          : TAITO_SQUID_F1
        : inv.kind === 'crab'
        ? frame === 0
          ? TAITO_CRAB_F0
          : TAITO_CRAB_F1
        : frame === 0
        ? TAITO_OCTO_F0
        : TAITO_OCTO_F1;
    const cell = inv.kind === 'squid' ? 3.35 : inv.kind === 'crab' ? 3.2 : 3.05;
    const fillCol = inv.fireFlash > 0.25 ? '#FEF08A' : color;
    drawPixelMatrixHD(ctx, matrix, rx, ry, cell, { '#': fillCol }, fillCol);

    // Subtle glowing alien eye glint for evolved depth without altering authentic Taito silhouette!
    ctx.save();
    const eyeAlpha = 0.45 + 0.35 * Math.sin(this.time * 6 + inv.col * 0.7 + inv.row);
    ctx.fillStyle = inv.fireFlash > 0.2 ? '#FFFFFF' : `rgba(255, 255, 255, ${eyeAlpha})`;
    const eyeSpread = inv.kind === 'squid' ? 5.2 : inv.kind === 'crab' ? 7.2 : 8.2;
    ctx.fillRect(rx - eyeSpread - 1, ry - 2.5, 2.2, 2.2);
    ctx.fillRect(rx + eyeSpread - 1.2, ry - 2.5, 2.2, 2.2);
    ctx.restore();
  }

  private drawEnemyShots(ctx: CanvasRenderingContext2D): void {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const s of this.enemyShots) {
      const boltColor = s.kind === 'squiggly' ? '#F472B6' : s.kind === 'plunger' ? '#38BDF8' : '#FDE047';

      if (s.trail.length > 1) {
        ctx.fillStyle = boltColor;
        for (let t = 0; t < s.trail.length; t++) {
          ctx.globalAlpha = ((t + 1) / s.trail.length) * 0.28;
          ctx.fillRect(s.trail[t].x - 2, s.trail[t].y - 2, 4, 4);
        }
        ctx.globalAlpha = 1;
      }

      const zig = Math.sin(s.phase) * 5;
      ctx.beginPath();
      if (s.kind === 'plunger') {
        const barY = s.y - 6 + ((Math.floor(s.phase * 0.6) % 4) * 4.5);
        ctx.moveTo(s.x, s.y - 11);
        ctx.lineTo(s.x, s.y + 10);
        ctx.moveTo(s.x - 5.5, barY);
        ctx.lineTo(s.x + 5.5, barY);
      } else if (s.kind === 'rolling') {
        const spin = Math.cos(s.phase) * 3.8;
        ctx.moveTo(s.x, s.y - 11);
        ctx.lineTo(s.x, s.y + 11);
        ctx.moveTo(s.x - spin, s.y - 5);
        ctx.lineTo(s.x + spin, s.y - 1);
        ctx.moveTo(s.x + spin, s.y + 3);
        ctx.lineTo(s.x - spin, s.y + 7);
      } else {
        ctx.moveTo(s.x - zig, s.y - 11);
        ctx.lineTo(s.x + zig, s.y - 4);
        ctx.lineTo(s.x - zig, s.y + 3);
        ctx.lineTo(s.x + zig, s.y + 11);
      }
      ctx.globalAlpha = 0.34;
      ctx.strokeStyle = boltColor;
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 3.8;
      ctx.stroke();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
  }

  private drawPlayerShot(ctx: CanvasRenderingContext2D): void {
    if (!this.playerShot.active) return;

    if (this.playerShot.trail.length > 1) {
      ctx.fillStyle = '#4ADE80';
      for (let i = 0; i < this.playerShot.trail.length; i++) {
        const pt = this.playerShot.trail[i];
        ctx.globalAlpha = ((i + 1) / this.playerShot.trail.length) * 0.34;
        ctx.fillRect(pt.x - 1.5, pt.y - 4, 3, 12);
      }
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = 'rgba(74, 222, 128, 0.3)';
    ctx.fillRect(this.playerShot.x - 5.5, this.playerShot.y - 18, 11, 32);
    ctx.fillStyle = '#86EFAC';
    ctx.fillRect(this.playerShot.x - 2.6, this.playerShot.y - 16, 5.2, 26);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(this.playerShot.x - 1.2, this.playerShot.y - 15, 2.4, 18);
  }

  private drawPlayerDisintegration(ctx: CanvasRenderingContext2D): void {
    // Evolved authentic 1978 alternating crackling static-spark cannon death!
    const t = this.playerDyingTimer / 0.85;
    ctx.save();
    ctx.translate(this.playerX, this.playerY);
    ctx.globalAlpha = Math.max(0.15, t);
    const flicker = Math.floor(this.time * 24) % 2;
    ctx.shadowColor = '#4ADE80';
    ctx.shadowBlur = 18;
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * Math.PI * 2 + flicker * 0.4;
      const dist = (1 - t) * 24 + 5 + (i % 3) * 6;
      ctx.fillStyle = i % 3 === 0 ? '#FFFFFF' : i % 2 === 0 ? '#FEF08A' : '#4ADE80';
      ctx.fillRect(Math.cos(ang) * dist - 2.5, Math.sin(ang) * dist * 0.55 - 2.5, 5, 5);
    }
    drawStarGlint(ctx, 0, -2, 18 * t + 6, '#DCFCE7', this.time * 12);
    ctx.restore();
  }

  private drawCannon(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.translate(x, y + this.cannonRecoil * 0.65);

    // Subtle lateral thruster glow when strafing
    if (Math.abs(this.playerVx) > 20) {
      const side = this.playerVx > 0 ? -25 : 25;
      ctx.save();
      ctx.fillStyle = 'rgba(134, 239, 172, 0.55)';
      ctx.shadowColor = '#4ADE80';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.ellipse(side, 8, 7 + Math.sin(this.time * 45) * 2, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.shadowColor = '#22C55E';
    ctx.shadowBlur = 14;

    // Classic Taito stepped Laser Base silhouette evolved with metallic phosphor bevels
    const bodyGrad = ctx.createLinearGradient(0, -18, 0, 15);
    bodyGrad.addColorStop(0, '#DCFCE7');
    bodyGrad.addColorStop(0.42, '#4ADE80');
    bodyGrad.addColorStop(1, '#15803D');
    ctx.fillStyle = bodyGrad;

    ctx.beginPath();
    ctx.roundRect(-24, 0, 48, 15, [3, 3, 2, 2]);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(-16, -7, 32, 8, [3, 3, 0, 0]);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(-4.5, -16 + this.cannonRecoil * 0.45, 9, 11, [2, 2, 0, 0]);
    ctx.fill();
    ctx.fillStyle = '#F0FDF4';
    ctx.fillRect(-2.2, -20 + this.cannonRecoil * 0.45, 4.4, 5.5);

    // Specular panel lines & capacitor indicator
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.48)';
    ctx.fillRect(-15, -6.2, 30, 1.8);
    ctx.fillRect(-22, 1.2, 44, 1.8);
    ctx.fillStyle = '#052E16';
    ctx.fillRect(-13, 5.5, 6.5, 4.5);
    ctx.fillRect(6.5, 5.5, 6.5, 4.5);
    ctx.fillStyle = this.playerShot.active ? '#4ADE80' : '#FEF08A';
    ctx.fillRect(-2.8, 5.5, 5.6, 4.5);

    // Muzzle flash bloom when shot just launched
    if (this.muzzleFlash > 0.05) {
      ctx.save();
      ctx.globalAlpha = this.muzzleFlash;
      drawStarGlint(ctx, 0, -21, 13 * this.muzzleFlash + 4, '#DCFCE7', this.time * 16);
      ctx.restore();
    }

    ctx.restore();
  }

  private drawVfxLayers(ctx: CanvasRenderingContext2D): void {
    // 1. Expanding neon shockwave rings (2-pass glow, zero shadowBlur!)
    for (const sw of this.shockwaves) {
      const alpha = Math.max(0, sw.life / sw.maxLife);
      ctx.strokeStyle = sw.color;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.globalAlpha = alpha * 0.3;
      ctx.lineWidth = sw.lineWidth * alpha * 2.4;
      ctx.stroke();
      ctx.globalAlpha = alpha * 0.88;
      ctx.lineWidth = sw.lineWidth * alpha;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 2. Cached Taito starburst sprite explosions (GPU-scaled so cache stays hot!)
    for (const ex of this.spriteExplosions) {
      const ratio = Math.max(0, ex.life / ex.maxLife);
      ctx.save();
      if (ex.kind === 'alien') {
        ctx.globalAlpha = Math.min(1, ratio * 1.35);
        const zoom = 0.96 + (1 - ratio) * 0.28;
        ctx.translate(ex.x, ex.y);
        ctx.scale(zoom, zoom);
        drawPixelMatrixHD(ctx, TAITO_INVADER_EXPLODE, 0, 0, 3.2, { '#': '#FFFFFF' }, ex.color);
      } else if (ex.kind === 'ceiling') {
        ctx.globalAlpha = ratio;
        drawPixelMatrixHD(ctx, TAITO_SHOT_TOP_EXPLODE, ex.x, ex.y, 2.3, { '#': '#EF4444' }, '#F87171');
      } else if (ex.kind === 'clash') {
        ctx.globalAlpha = ratio;
        drawStarGlint(ctx, ex.x, ex.y, 16 * ratio + 4, '#FEF08A', this.time * 18);
      } else if (ex.kind === 'ufo') {
        if (ratio > 0.62) {
          ctx.globalAlpha = (ratio - 0.62) / 0.38;
          drawPixelMatrixHD(ctx, TAITO_INVADER_EXPLODE, ex.x, ex.y, 4.4, { '#': '#FEF08A' }, '#EF4444');
        }
        if (ex.scoreText) {
          ctx.globalAlpha = Math.min(1, ratio * 1.5);
          ctx.font = '900 26px "Outfit", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#EF4444';
          ctx.fillText(ex.scoreText, ex.x + 1.5, ex.y + 1.5);
          ctx.fillStyle = ex.scoreText === '300' ? '#FEF08A' : '#FCA5A5';
          ctx.fillText(ex.scoreText, ex.x, ex.y);
        }
      }
      ctx.restore();
    }

    // 3. Tumbling debris shards (zero shadowBlur!)
    for (const d of this.debris) {
      const a = Math.max(0, d.life / d.maxLife);
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      ctx.globalAlpha = a;
      ctx.fillStyle = d.color;
      ctx.fillRect(-d.size * 0.5, -d.size * 0.5, d.size, d.size * 0.72);
      ctx.restore();
    }
  }
}

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
  TAITO_MINI_F0,
  TAITO_MINI_F1,
  TAITO_OCTO_F0,
  TAITO_OCTO_F1,
  TAITO_SHOT_TOP_EXPLODE,
  TAITO_SQUID_F0,
  TAITO_SQUID_F1,
  TAITO_UFO_MATRIX,
} from './arcadeGfx';

const WIDTH = 780;
const HEIGHT = 864;
const STORAGE_KEY = 'space_invaders2_hd_highscore_v1';

const CEILING_Y = 54;
const FLOOR_Y = HEIGHT - 38;
const WAVE_DROP_STEPS = [0, 1, 2, 3, 3, 4, 4, 4];

interface Invader2 {
  row: number;
  col: number;
  kind: 'splitter' | 'crab' | 'octopus';
  points: number;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  stepProgress: number;
  stepDelay: number;
  alive: boolean;
  color: string;
  fireFlash: number;
  animFrame: number;
  warpGlow: number; // Bright golden ring when newly beamed in by Dropship
}

interface MiniDiver {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  age: number;
  tetherOriginX: number;
  tetherOriginY: number;
  fireCooldown: number;
  trail: Array<{ x: number; y: number }>;
}

interface DropPod {
  x: number;
  y: number;
  targetInv: Invader2;
  life: number;
}

interface EnemyShot2 {
  x: number;
  y: number;
  vy: number;
  kind: 'rolling' | 'plunger' | 'squiggly';
  phase: number;
  trail: Array<{ x: number; y: number }>;
}

interface Bunker2 {
  x: number;
  y: number;
  cols: number;
  rows: number;
  cellSize: number;
  cells: boolean[][];
  heat: number[][];
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
  kind: 'alien' | 'ufo' | 'ceiling' | 'clash' | 'split';
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

interface SosPod {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  timer: number;
}

export class SpaceInvaders2Game implements ArcadeGameInstance {
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
  private bannerSub = '';

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
  private invulnTimer = 0;

  private invaders: Invader2[] = [];
  private miniDivers: MiniDiver[] = [];
  private dropPods: DropPod[] = [];
  private formationDir: 1 | -1 = 1;
  private marchTimer = 0.45;
  private marchAnimFrame = 0;
  private marchStepCount = 0;
  private hitStopTimer = 0;
  private bassPulse = 0;
  private rackRevealProgress = 1;

  private enemyShots: EnemyShot2[] = [];
  private enemyFireTimer = 0.65;
  private bunkers: Bunker2[] = [];
  private floorNotches: Array<{ x: number; w: number }> = [];

  // Part II signature: Flashing Phase-Cloak UFO & Golden Reinforcement Dropship UFO!
  private ufo = {
    active: false,
    kind: 'flashing' as 'flashing' | 'dropship',
    x: 0,
    y: 86,
    dir: 1 as 1 | -1,
    spawnTimer: 8.5,
    dropTimer: 1.1,
    soundTimer: 0,
  };

  // Part II authentic stage-clear S.O.S. escape saucer + Rainbow Bonus sky arc!
  private sosPod: SosPod = { active: false, x: WIDTH * 0.5, y: 200, vx: 60, vy: -140, timer: 0 };
  private rainbowTimer = 0;
  private pendingChainBlasts: Array<{ x: number; y: number; delay: number; color: string }> = [];

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
    this.particles = [];
    this.popups = [];
    this.shockwaves = [];
    this.spriteExplosions = [];
    this.debris = [];
    this.pendingChainBlasts = [];
    this.rainbowTimer = 0;
    this.sosPod.active = false;
    this.setupWave(1, true);
    this.phase = 'READY';
    this.phaseTimer = 1.15;
    this.rackRevealProgress = 0;
    this.bannerText = 'PART II · WAVE 1';
    this.bannerSub = 'WATCH FOR SPLITTING COMMANDERS!';
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
    const alive = this.invaders.filter((a) => a.alive).length + this.miniDivers.length + this.dropPods.length;
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: `Part II Deluxe · Wave ${this.level}`,
      primaryMetricLabel: 'Hostiles',
      primaryMetricValue: String(alive),
      secondaryMetricLabel: 'Active UFO',
      secondaryMetricValue: this.ufo.active
        ? this.ufo.kind === 'dropship'
          ? 'DROPSHIP!'
          : 'CLOAK UFO'
        : 'Scanning',
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
    kind: 'alien' | 'ufo' | 'player' | 'clash' | 'ceiling' | 'split',
    scoreText?: string
  ): void {
    if (kind === 'ceiling') {
      this.spriteExplosions.push({ x, y, kind: 'ceiling', color: '#F43F5E', life: 0.22, maxLife: 0.22 });
      spawnBurst(this.particles, x, y, '#FB7185', 10, 130, 2.2);
      return;
    }
    if (kind === 'clash') {
      this.spriteExplosions.push({ x, y, kind: 'clash', color: '#22D3EE', life: 0.22, maxLife: 0.22 });
      this.shockwaves.push({
        x,
        y,
        radius: 4,
        maxRadius: 30,
        color: '#22D3EE',
        life: 0.24,
        maxLife: 0.24,
        lineWidth: 2.6,
      });
      spawnBurst(this.particles, x, y, '#67E8F9', 14, 185, 2.6);
      return;
    }
    if (kind === 'split') {
      this.spriteExplosions.push({ x, y, kind: 'split', color: '#F43F5E', life: 0.32, maxLife: 0.32 });
      this.shockwaves.push(
        { x, y, radius: 5, maxRadius: 52, color: '#FACC15', life: 0.32, maxLife: 0.32, lineWidth: 3.4 },
        { x, y, radius: 3, maxRadius: 34, color: '#FB7185', life: 0.24, maxLife: 0.24, lineWidth: 2.2 }
      );
      spawnBurst(this.particles, x, y, '#FACC15', 16, 210, 3);
      spawnBurst(this.particles, x, y, '#FB7185', 14, 180, 2.8);
      this.addShake(4.2, 0.14);
      return;
    }
    if (kind === 'alien') {
      this.spriteExplosions.push({ x, y, kind: 'alien', color, life: 0.25, maxLife: 0.25 });
      this.shockwaves.push({
        x,
        y,
        radius: 5,
        maxRadius: 44,
        color,
        life: 0.3,
        maxLife: 0.3,
        lineWidth: 3.2,
      });
      spawnBurst(this.particles, x, y, color, 18, 225, 3.2);
      spawnBurst(this.particles, x, y, '#FFFFFF', 7, 155, 2.2);
      for (let i = 0; i < 9; i++) {
        const ang = (Math.PI * 2 * i) / 9 + (Math.random() - 0.5) * 0.4;
        const spd = 85 + Math.random() * 155;
        this.debris.push({
          x,
          y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          size: 3 + Math.random() * 3.8,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 16,
          color,
          life: 0.4 + Math.random() * 0.24,
          maxLife: 0.64,
        });
      }
      this.addShake(3.4, 0.12);
      return;
    }
    if (kind === 'ufo') {
      this.spriteExplosions.push({
        x,
        y,
        kind: 'ufo',
        color,
        life: 1.15,
        maxLife: 1.15,
        scoreText,
      });
      this.shockwaves.push(
        { x, y, radius: 8, maxRadius: 88, color, life: 0.54, maxLife: 0.54, lineWidth: 4.5 },
        { x, y, radius: 4, maxRadius: 56, color: '#FFFFFF', life: 0.36, maxLife: 0.36, lineWidth: 2.8 }
      );
      spawnBurst(this.particles, x, y, color, 34, 300, 4.4);
      spawnBurst(this.particles, x, y, '#FEF08A', 22, 230, 3.4);
      for (let i = 0; i < 16; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 80 + Math.random() * 225;
        this.debris.push({
          x,
          y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          size: 3.5 + Math.random() * 4.5,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 18,
          color: i % 3 === 0 ? '#FFFFFF' : color,
          life: 0.58 + Math.random() * 0.32,
          maxLife: 0.9,
        });
      }
      this.addShake(9, 0.32);
      this.triggerFlash(color, 0.24);
      return;
    }
    // Player cyan-gold plasma overload disintegration
    this.shockwaves.push(
      { x, y, radius: 6, maxRadius: 86, color: '#22D3EE', life: 0.56, maxLife: 0.56, lineWidth: 4.6 },
      { x, y, radius: 4, maxRadius: 56, color: '#FEF08A', life: 0.38, maxLife: 0.38, lineWidth: 2.8 }
    );
    spawnBurst(this.particles, x, y, '#22D3EE', 36, 285, 4.4);
    spawnBurst(this.particles, x, y, '#FEF08A', 22, 215, 3.4);
    for (let i = 0; i < 16; i++) {
      const ang = -Math.PI + Math.random() * Math.PI;
      const spd = 70 + Math.random() * 220;
      this.debris.push({
        x: x + (Math.random() - 0.5) * 24,
        y: y + (Math.random() - 0.5) * 10,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        size: 3.5 + Math.random() * 4,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 18,
        color: i % 3 === 0 ? '#FEF08A' : i % 2 === 0 ? '#67E8F9' : '#06B6D4',
        life: 0.62 + Math.random() * 0.32,
        maxLife: 0.94,
      });
    }
    this.addShake(10, 0.36);
    this.triggerFlash('#22D3EE', 0.28);
  }

  private addScore(pts: number, x?: number, y?: number, color = '#22D3EE'): void {
    if (this.phase === 'TITLE') return;
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(STORAGE_KEY, this.highScore);
    }
    if (!this.bonusLifeGiven && this.score >= 2000) {
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
      this.popups.push({ x, y, text: `+${pts}`, color, life: 0.9, maxLife: 0.9 });
    }
  }

  private createBunkers(): void {
    this.bunkers = [];
    const cols = 22;
    const rows = 16;
    const cellSize = 4;
    const bunkerW = cols * cellSize;
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
          if (r < 4 && (c < 4 - r || c >= cols - (4 - r))) solid = false;
          const archCenter = (cols - 1) * 0.5;
          const dist = Math.abs(c - archCenter);
          if (r >= 11 && dist < 5.2) solid = false;
          if (r === 10 && dist < 4.2) solid = false;
          if (r === 9 && dist < 2.8) solid = false;
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
    this.miniDivers = [];
    this.dropPods = [];
    const dropLevel = WAVE_DROP_STEPS[(wave - 1) % WAVE_DROP_STEPS.length];
    const startY = 152 + dropLevel * 26;
    const colSpacing = 54;
    const rowSpacing = 46;
    const startX = (WIDTH - 10 * colSpacing) * 0.5;
    const rowColors = ['#F43F5E', '#C084FC', '#38BDF8', '#4ADE80', '#FACC15'];

    for (let r = 0; r < 5; r++) {
      const kind: Invader2['kind'] = r === 0 ? 'splitter' : r <= 2 ? 'crab' : 'octopus';
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
          color: rowColors[r],
          fireFlash: 0,
          animFrame: 0,
          warpGlow: 0,
        });
      }
    }

    this.formationDir = 1;
    this.marchTimer = 0.45;
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
    this.ufo.spawnTimer = 7.5 + Math.random() * 4;
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
        this.bannerSub = '';
      }
      return;
    }

    if (this.phase === 'STAGE_CLEAR') {
      this.phaseTimer -= dt;
      // Animate authentic Part II S.O.S. escape saucer fleeing off the top!
      if (this.sosPod.active) {
        this.sosPod.timer += dt;
        this.sosPod.x += Math.sin(this.sosPod.timer * 7) * 85 * dt;
        this.sosPod.y += this.sosPod.vy * dt;
        if (Math.random() < 0.5) {
          spawnBurst(this.particles, this.sosPod.x, this.sosPod.y + 10, '#F472B6', 1, 55, 2);
        }
        if (this.sosPod.y < -40) this.sosPod.active = false;
      }
      if (this.phaseTimer <= 0) {
        this.level += 1;
        this.sosPod.active = false;
        this.setupWave(this.level, true);
        this.phase = 'READY';
        this.phaseTimer = 1.15;
        this.rackRevealProgress = 0;
        this.bannerText = `PART II · WAVE ${this.level}`;
        this.bannerSub = this.level % 2 === 0 ? 'GOLDEN DROPSHIPS DETECTED' : 'LEAVE OCTOPUS LAST FOR RAINBOW BONUS!';
      }
      return;
    }

    if (this.playerDyingTimer > 0) {
      this.playerDyingTimer -= dt;
      if (Math.random() < 0.55) {
        spawnBurst(
          this.particles,
          this.playerX + (Math.random() - 0.5) * 28,
          this.playerY + (Math.random() - 0.5) * 10,
          Math.random() < 0.45 ? '#FEF08A' : '#22D3EE',
          3,
          135,
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

    this.updateMiniDivers(dt, isAttract);
    this.updateDropPods(dt);
    this.updateEnemyShots(dt, isAttract);
    this.updateUfo(dt, isAttract);

    const anyLeft =
      this.invaders.some((a) => a.alive) || this.miniDivers.length > 0 || this.dropPods.length > 0;
    if (!anyLeft) {
      if (isAttract) {
        this.setupWave(1, true);
      } else {
        arcadeAudio.playStageClear();
        this.phase = 'STAGE_CLEAR';
        this.phaseTimer = 2.15;
        this.bannerText = `WAVE ${this.level} CLEARED!`;
        if (!this.bannerSub) this.bannerSub = 'INVADER ESCAPE POD TRANSMITTING S.O.S.!';
        // Launch authentic Part II "S.O.S.!" fleeing escape saucer!
        this.sosPod = {
          active: true,
          x: WIDTH * 0.5,
          y: HEIGHT * 0.44,
          vx: 0,
          vy: -150,
          timer: 0,
        };
      }
    }
  }

  private stepVfx(dt: number): void {
    if (this.cannonRecoil > 0) this.cannonRecoil = Math.max(0, this.cannonRecoil - dt * 28);
    if (this.muzzleFlash > 0) this.muzzleFlash = Math.max(0, this.muzzleFlash - dt * 9);
    if (this.bassPulse > 0) this.bassPulse = Math.max(0, this.bassPulse - dt * 5.2);
    if (this.rainbowTimer > 0) this.rainbowTimer = Math.max(0, this.rainbowTimer - dt);
    if (this.shakeTime > 0) {
      this.shakeTime = Math.max(0, this.shakeTime - dt);
      if (this.shakeTime === 0) this.shakeMag = 0;
    }
    if (this.screenFlash > 0) this.screenFlash = Math.max(0, this.screenFlash - dt * 1.6);

    // Delayed Dropship chain explosions!
    for (let i = this.pendingChainBlasts.length - 1; i >= 0; i--) {
      const b = this.pendingChainBlasts[i];
      b.delay -= dt;
      if (b.delay <= 0) {
        this.pendingChainBlasts.splice(i, 1);
        this.shockwaves.push({
          x: b.x,
          y: b.y,
          radius: 4,
          maxRadius: 48,
          color: b.color,
          life: 0.34,
          maxLife: 0.34,
          lineWidth: 3.2,
        });
        spawnBurst(this.particles, b.x, b.y, b.color, 18, 220, 3.6);
        this.addShake(5.5, 0.14);
      }
    }

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
        d.vy = d.vy * 0.96 + 135 * dt;
        d.rot += d.vrot * dt;
      }
    }

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
      if (inv.warpGlow > 0) inv.warpGlow = Math.max(0, inv.warpGlow - dt * 1.6);
      if (inv.stepDelay > 0) {
        inv.stepDelay = Math.max(0, inv.stepDelay - dt);
      } else if (inv.stepProgress < 1) {
        inv.stepProgress = Math.min(1, inv.stepProgress + dt * 23);
      }
    }
  }

  private getInvaderRenderPos(inv: Invader2): { rx: number; ry: number } {
    const t = Math.min(1, Math.max(0, inv.stepProgress));
    const ease = t * (2 - t);
    return {
      rx: inv.prevX + (inv.x - inv.prevX) * ease,
      ry: inv.prevY + (inv.y - inv.prevY) * ease,
    };
  }

  private updatePlayer(dt: number, isAttract: boolean): void {
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);

    if (isAttract) {
      const targetX = this.ufo.active
        ? this.ufo.x
        : this.miniDivers[0]?.x ?? this.invaders.find((a) => a.alive)?.x ?? WIDTH * 0.5;
      const dx = targetX - this.playerX;
      const move = Math.sign(dx) * Math.min(Math.abs(dx), 310 * dt);
      this.playerVx = move / Math.max(0.001, dt);
      this.playerX += move;
      if (!this.playerShot.active && Math.abs(dx) < 38) {
        this.playerShot = { active: true, x: this.playerX, y: this.playerY - 20, trail: [] };
        this.cannonRecoil = 5.5;
        this.muzzleFlash = 1;
      }
      return;
    }

    const dir = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    this.playerVx = dir * 360;
    this.playerX = Math.max(42, Math.min(WIDTH - 42, this.playerX + this.playerVx * dt));

    if ((this.input.fire || this.input.fireJustPressed) && !this.playerShot.active) {
      this.playerShot = { active: true, x: this.playerX, y: this.playerY - 20, trail: [] };
      this.cannonRecoil = 6;
      this.muzzleFlash = 1;
      arcadeAudio.playInvaderLaser(true);
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

    this.playerShot.y -= 860 * dt;
    if (this.playerShot.y <= CEILING_Y + 6) {
      this.playerShot.active = false;
      this.spawnExplosionVfx(this.playerShot.x, CEILING_Y + 8, '#F43F5E', 'ceiling');
      return;
    }

    if (this.damageBunkerAt(this.playerShot.x, this.playerShot.y, 10, true)) {
      this.playerShot.active = false;
      if (!isAttract) arcadeAudio.playInvaderExplosion('bunker');
      spawnBurst(this.particles, this.playerShot.x, this.playerShot.y, '#67E8F9', 8, 110, 2.2);
      spawnBurst(this.particles, this.playerShot.x, this.playerShot.y, '#FEF08A', 4, 85, 1.8);
      return;
    }

    // Intercept enemy shots mid-air!
    for (let i = this.enemyShots.length - 1; i >= 0; i--) {
      const es = this.enemyShots[i];
      if (Math.hypot(this.playerShot.x - es.x, this.playerShot.y - es.y) < 15) {
        this.enemyShots.splice(i, 1);
        this.playerShot.active = false;
        if (!isAttract) arcadeAudio.playInvaderExplosion('clash');
        this.spawnExplosionVfx(es.x, es.y, '#22D3EE', 'clash');
        return;
      }
    }

    // Intercept descending reinforcement Drop Pods before they dock!
    for (let i = this.dropPods.length - 1; i >= 0; i--) {
      const pod = this.dropPods[i];
      if (Math.hypot(this.playerShot.x - pod.x, this.playerShot.y - pod.y) < 20) {
        this.dropPods.splice(i, 1);
        this.playerShot.active = false;
        if (!isAttract) arcadeAudio.playInvaderExplosion('alien');
        this.spawnExplosionVfx(pod.x, pod.y, '#FACC15', 'alien');
        this.addScore(40, pod.x, pod.y, '#FACC15');
        return;
      }
    }

    // Hit UFO (Flashing Phase-Cloak UFO or Golden Reinforcement Dropship!)
    if (this.ufo.active && Math.hypot(this.playerShot.x - this.ufo.x, this.playerShot.y - this.ufo.y) < 30) {
      const isDropship = this.ufo.kind === 'dropship';
      const cloaked = !isDropship && Math.sin(this.time * 13) > 0.3;
      const pts = isDropship ? 500 : cloaked ? 500 : 300;
      const color = isDropship ? '#FACC15' : '#EC4899';
      const ux = this.ufo.x;
      const uy = this.ufo.y;
      this.ufo.active = false;
      this.ufo.spawnTimer = 12 + Math.random() * 5;
      this.playerShot.active = false;

      if (!isAttract) arcadeAudio.playInvaderExplosion('ufo');
      this.spawnExplosionVfx(ux, uy, color, 'ufo', cloaked ? 'CLOAK 500!' : `${pts}`);

      // Golden Dropship triggers dramatic 3-stage chain detonation!
      if (isDropship) {
        this.pendingChainBlasts.push(
          { x: ux - 24, y: uy + 6, delay: 0.12, color: '#FACC15' },
          { x: ux + 24, y: uy - 5, delay: 0.24, color: '#FB923C' },
          { x: ux, y: uy + 10, delay: 0.36, color: '#FEF08A' }
        );
      }
      this.addScore(pts);
      return;
    }

    // Hit fast split Mini-Invaders!
    for (let i = this.miniDivers.length - 1; i >= 0; i--) {
      const md = this.miniDivers[i];
      if (Math.hypot(this.playerShot.x - md.x, this.playerShot.y - md.y) < 20) {
        this.miniDivers.splice(i, 1);
        this.playerShot.active = false;
        if (!isAttract) arcadeAudio.playInvaderExplosion('alien');
        this.spawnExplosionVfx(md.x, md.y, '#FB7185', 'alien');
        this.addScore(60, md.x, md.y, '#FB7185');
        return;
      }
    }

    // Hit formation invaders!
    for (const inv of this.invaders) {
      if (!inv.alive) continue;
      const { rx, ry } = this.getInvaderRenderPos(inv);
      if (Math.abs(this.playerShot.x - rx) < 21 && Math.abs(this.playerShot.y - ry) < 17) {
        const remainingBefore =
          this.invaders.filter((a) => a.alive).length + this.miniDivers.length + this.dropPods.length;
        inv.alive = false;
        this.playerShot.active = false;
        this.hitStopTimer = 0.085;

        // Part II signature: Top-Row Crimson Splitter Command Invader splits into 2 fast Mini-Invaders!
        if (inv.kind === 'splitter' && this.miniDivers.length < 6) {
          if (!isAttract) arcadeAudio.playInvaderSplit();
          this.spawnExplosionVfx(rx, ry, '#F43F5E', 'split');
          this.miniDivers.push(
            {
              x: rx - 12,
              y: ry,
              vx: -145,
              vy: 96,
              color: '#FB7185',
              age: 0,
              tetherOriginX: rx,
              tetherOriginY: ry,
              fireCooldown: 0.75 + Math.random() * 0.5,
              trail: [],
            },
            {
              x: rx + 12,
              y: ry,
              vx: 145,
              vy: 96,
              color: '#F472B6',
              age: 0,
              tetherOriginX: rx,
              tetherOriginY: ry,
              fireCooldown: 0.95 + Math.random() * 0.5,
              trail: [],
            }
          );
          this.popups.push({ x: rx, y: ry - 18, text: 'SPLIT!', color: '#FACC15', life: 0.85, maxLife: 0.85 });
          this.addScore(inv.points);
          return;
        }

        if (!isAttract) arcadeAudio.playInvaderExplosion('alien');
        this.spawnExplosionVfx(rx, ry, inv.color, 'alien');

        // Authentic Part II Rainbow Bonus: 500 pts + prismatic Rainbow Sky Arc if final invader is an Octopus!
        if (remainingBefore === 1 && inv.kind === 'octopus') {
          this.rainbowTimer = 2.6;
          this.bannerSub = '★ RAINBOW BONUS +500! ★';
          if (!isAttract) arcadeAudio.playRainbowBonus();
          this.addScore(500);
          this.popups.push({
            x: WIDTH * 0.5,
            y: HEIGHT * 0.34,
            text: 'RAINBOW BONUS +500!',
            color: '#FACC15',
            life: 2.0,
            maxLife: 2.0,
          });
        } else {
          this.addScore(inv.points, rx, ry - 6, inv.color);
        }
        return;
      }
    }
  }

  private updateMiniDivers(dt: number, isAttract: boolean): void {
    for (let i = this.miniDivers.length - 1; i >= 0; i--) {
      const md = this.miniDivers[i];
      md.age += dt;
      md.trail.push({ x: md.x, y: md.y });
      if (md.trail.length > 6) md.trail.shift();

      // Dynamic weaving dive pattern
      md.x += (md.vx + Math.sin(md.age * 7) * 55) * dt;
      md.y += md.vy * dt;
      if (md.x < 32 || md.x > WIDTH - 32) md.vx = -md.vx;

      if (this.damageBunkerAt(md.x, md.y, 13, true)) {
        spawnBurst(this.particles, md.x, md.y, '#67E8F9', 6, 95, 2.2);
      }

      // Mini-invaders occasionally drop hot pink bolts!
      md.fireCooldown -= dt;
      if (md.fireCooldown <= 0 && this.enemyShots.length < 6 && md.y < HEIGHT - 220) {
        md.fireCooldown = 1.45 + Math.random() * 0.7;
        this.enemyShots.push({
          x: md.x,
          y: md.y + 12,
          vy: 310 + this.level * 18,
          kind: 'squiggly',
          phase: 0,
          trail: [],
        });
      }

      if (!isAttract && this.invulnTimer <= 0 && Math.hypot(md.x - this.playerX, md.y - this.playerY) < 24) {
        this.miniDivers.splice(i, 1);
        this.triggerPlayerHit();
        return;
      }
      if (md.y > FLOOR_Y) {
        this.miniDivers.splice(i, 1);
      }
    }
  }

  private updateDropPods(dt: number): void {
    for (let i = this.dropPods.length - 1; i >= 0; i--) {
      const pod = this.dropPods[i];
      pod.life += dt;
      // Steer cleanly down into the target formation slot!
      const dx = pod.targetInv.x - pod.x;
      const dy = pod.targetInv.y - pod.y;
      const dist = Math.hypot(dx, dy);
      const speed = 260;
      if (dist < 14 || pod.life > 1.8) {
        pod.targetInv.alive = true;
        pod.targetInv.kind = 'crab';
        pod.targetInv.color = '#38BDF8';
        pod.targetInv.prevX = pod.targetInv.x;
        pod.targetInv.prevY = pod.targetInv.y;
        pod.targetInv.stepProgress = 1;
        pod.targetInv.warpGlow = 1;
        this.shockwaves.push({
          x: pod.targetInv.x,
          y: pod.targetInv.y,
          radius: 4,
          maxRadius: 34,
          color: '#FACC15',
          life: 0.28,
          maxLife: 0.28,
          lineWidth: 2.6,
        });
        spawnBurst(this.particles, pod.targetInv.x, pod.targetInv.y, '#FACC15', 10, 120, 2.5);
        this.dropPods.splice(i, 1);
      } else {
        pod.x += (dx / dist) * speed * dt;
        pod.y += (dy / dist) * speed * dt;
      }
    }
  }

  private updateFormation(dt: number, isAttract: boolean): void {
    const alive = this.invaders.filter((a) => a.alive);
    if (alive.length === 0) return;

    const ratio = alive.length / 55;
    const waveSpeedup = Math.max(0.38, 0.66 - (this.level - 1) * 0.04);
    const stepInterval = Math.max(0.045, 0.045 + Math.pow(ratio, 1.32) * waveSpeedup);

    this.marchTimer -= dt;
    if (this.marchTimer > 0) return;
    this.marchTimer = stepInterval;
    this.marchAnimFrame = 1 - this.marchAnimFrame;
    this.bassPulse = 1;
    if (!isAttract) arcadeAudio.playInvaderStep(this.marchStepCount);
    this.marchStepCount++;

    const stepX = alive.length === 1 ? (this.formationDir === 1 ? 19 : 15) : 13;
    let minX = Infinity;
    let maxX = -Infinity;
    for (const inv of alive) {
      if (inv.x < minX) minX = inv.x;
      if (inv.x > maxX) maxX = inv.x;
    }

    const hitEdge =
      (this.formationDir === 1 && maxX + stepX > WIDTH - 36) ||
      (this.formationDir === -1 && minX - stepX < 36);

    const rowStagger = Math.min(0.017, stepInterval * 0.08);

    if (hitEdge) {
      this.formationDir = this.formationDir === 1 ? -1 : 1;
      for (const inv of this.invaders) {
        inv.prevX = inv.x;
        inv.prevY = inv.y;
        inv.y += 24;
        if (inv.alive) {
          inv.stepProgress = 0;
          inv.stepDelay = (4 - inv.row) * rowStagger;
          inv.animFrame = this.marchAnimFrame;
          this.damageBunkerAt(inv.x, inv.y + 8, 22, false);
          if (inv.y >= this.playerY - 22) {
            if (isAttract) {
              this.setupWave(1, true);
              return;
            }
            this.lives = 1;
            this.triggerPlayerHit();
            return;
          }
        }
      }
    } else {
      for (const inv of this.invaders) {
        inv.prevX = inv.x;
        inv.prevY = inv.y;
        inv.x += this.formationDir * stepX;
        if (inv.alive) {
          inv.stepProgress = 0;
          inv.stepDelay = (4 - inv.row) * rowStagger;
          inv.animFrame = this.marchAnimFrame;
          this.damageBunkerAt(inv.x, inv.y + 8, 18, false);
        }
      }
    }
  }

  private updateEnemyShots(dt: number, isAttract: boolean): void {
    this.enemyFireTimer -= dt;
    const maxShots = Math.min(6, 3 + Math.floor(this.level * 0.6));
    if (this.enemyFireTimer <= 0 && this.enemyShots.length < maxShots) {
      this.enemyFireTimer = Math.max(0.28, 0.88 - this.level * 0.075);
      const bottomByCol = new Map<number, Invader2>();
      for (const inv of this.invaders) {
        if (!inv.alive) continue;
        const prev = bottomByCol.get(inv.col);
        if (!prev || inv.row > prev.row) bottomByCol.set(inv.col, inv);
      }
      const shooters = Array.from(bottomByCol.values());
      if (shooters.length > 0) {
        const targeted = Math.random() < 0.44;
        const chosen = targeted
          ? shooters.reduce((b, c) => (Math.abs(c.x - this.playerX) < Math.abs(b.x - this.playerX) ? c : b))
          : shooters[Math.floor(Math.random() * shooters.length)];
        const kind: EnemyShot2['kind'] = targeted
          ? 'rolling'
          : Math.random() < 0.5
          ? 'plunger'
          : 'squiggly';
        chosen.fireFlash = 1;
        this.enemyShots.push({
          x: chosen.x,
          y: chosen.y + 18,
          vy: (kind === 'squiggly' ? 320 : 295) + this.level * 22,
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
        spawnBurst(this.particles, s.x, s.y, '#67E8F9', 9, 110, 2.3);
        spawnBurst(this.particles, s.x, s.y, '#F472B6', 5, 85, 1.9);
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

      if (s.y >= FLOOR_Y - 2) {
        this.floorNotches.push({ x: s.x, w: 8 + Math.random() * 5 });
        if (this.floorNotches.length > 48) this.floorNotches.shift();
        spawnBurst(this.particles, s.x, FLOOR_Y - 2, '#22D3EE', 7, 95, 2.1);
        this.enemyShots.splice(i, 1);
      }
    }
  }

  private updateUfo(dt: number, isAttract: boolean): void {
    const aliveCount = this.invaders.filter((a) => a.alive).length;
    if (!this.ufo.active) {
      this.ufo.spawnTimer -= dt;
      if (this.ufo.spawnTimer <= 0 && aliveCount >= 6) {
        const fromLeft = Math.random() < 0.5;
        const shouldDropship = aliveCount < 38 && Math.random() < 0.58;
        this.ufo = {
          active: true,
          kind: shouldDropship ? 'dropship' : 'flashing',
          x: fromLeft ? -42 : WIDTH + 42,
          y: 86,
          dir: fromLeft ? 1 : -1,
          spawnTimer: 13,
          dropTimer: 1.0,
          soundTimer: 0,
        };
      }
    } else {
      this.ufo.x += this.ufo.dir * (this.ufo.kind === 'dropship' ? 142 : 192) * dt;
      if (!isAttract) {
        this.ufo.soundTimer -= dt;
        if (this.ufo.soundTimer <= 0) {
          this.ufo.soundTimer = 0.14;
          arcadeAudio.playUfoPing(this.ufo.kind === 'flashing');
        }
      }

      // Golden Dropship beams reinforcement DropPods down into dead top-row formation slots!
      if (this.ufo.kind === 'dropship') {
        this.ufo.dropTimer -= dt;
        if (this.ufo.dropTimer <= 0 && this.dropPods.length < 3) {
          this.ufo.dropTimer = 1.45;
          const deadTop = this.invaders.find(
            (a) =>
              !a.alive &&
              a.row <= 1 &&
              Math.abs(a.x - this.ufo.x) < 80 &&
              !this.dropPods.some((p) => p.targetInv === a)
          );
          if (deadTop) {
            this.dropPods.push({ x: this.ufo.x, y: this.ufo.y + 18, targetInv: deadTop, life: 0 });
            if (!isAttract) arcadeAudio.playDropshipDeploy();
            spawnBurst(this.particles, this.ufo.x, this.ufo.y + 16, '#FACC15', 8, 100, 2.3);
          }
        }
      }

      if (this.ufo.x < -54 || this.ufo.x > WIDTH + 54) {
        this.ufo.active = false;
        this.ufo.spawnTimer = 12 + Math.random() * 5;
      }
    }
  }

  private triggerPlayerHit(): void {
    arcadeAudio.playInvaderExplosion('player');
    this.spawnExplosionVfx(this.playerX, this.playerY, '#22D3EE', 'player');
    this.enemyShots = [];
    this.playerShot.active = false;
    this.playerDyingTimer = 0.85;
  }

  private finishPlayerDeath(): void {
    this.lives -= 1;
    if (this.lives <= 0) {
      this.phase = 'GAME_OVER';
      this.bannerText = 'GAME OVER';
      this.bannerSub = '';
      return;
    }
    this.playerX = WIDTH * 0.5;
    this.playerVx = 0;
    this.invulnTimer = 1.8;
    this.phase = 'READY';
    this.phaseTimer = 1.0;
    this.rackRevealProgress = 1;
    this.bannerText = 'READY!';
    this.bannerSub = '';
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const sx = this.shakeTime > 0 ? (Math.random() - 0.5) * 2 * this.shakeMag : 0;
    const sy = this.shakeTime > 0 ? (Math.random() - 0.5) * 2 * this.shakeMag : 0;

    ctx.save();
    ctx.translate(sx, sy);

    this.drawDeluxeBackdrop(ctx);
    if (this.rainbowTimer > 0) this.drawRainbowBonusArc(ctx);
    this.drawFloorBaseline(ctx);
    this.drawBunkers(ctx);

    if (this.ufo.active) this.drawUfo2(ctx);

    // Formation invaders (authentic Taito matrices in Part II full color + rapid reveal on READY!)
    const maxVisibleRow = Math.floor(this.rackRevealProgress * 5.2);
    for (const inv of this.invaders) {
      if (!inv.alive) continue;
      if (this.phase === 'READY' && 4 - inv.row > maxVisibleRow) continue;
      const { rx, ry } = this.getInvaderRenderPos(inv);
      this.drawInvader2(ctx, inv, rx, ry);
    }

    this.drawDropPods(ctx);
    this.drawMiniDivers(ctx);
    this.drawEnemyShots2(ctx);
    this.drawPlayerShot2(ctx);

    // Authentic Part II "S.O.S.!" escaping saucer during wave clear!
    if (this.sosPod.active) this.drawSosEscapePod(ctx);

    if (this.playerDyingTimer > 0) {
      this.drawPlayerDisintegration2(ctx);
    } else if (this.phase !== 'GAME_OVER') {
      const blink = this.invulnTimer > 0 && Math.floor(this.time * 16) % 2 === 0;
      if (!blink) this.drawDeluxeCannon(ctx, this.playerX, this.playerY);
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
      const boxH = this.bannerSub ? 82 : 60;
      const boxY = HEIGHT * 0.43;
      ctx.fillStyle = 'rgba(4, 6, 20, 0.9)';
      ctx.beginPath();
      ctx.roundRect(WIDTH * 0.16, boxY, WIDTH * 0.68, boxH, 10);
      ctx.fill();
      ctx.strokeStyle = '#22D3EE';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.font = '800 30px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#22D3EE';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#CFFAFE';
      ctx.fillText(this.bannerText, WIDTH * 0.5, boxY + (this.bannerSub ? 30 : 30));

      if (this.bannerSub) {
        ctx.shadowBlur = 8;
        ctx.font = '700 14px "Outfit", sans-serif';
        ctx.fillStyle = '#FACC15';
        ctx.fillText(this.bannerSub, WIDTH * 0.5, boxY + 60);
      }
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

    // Rich Part II cosmic twilight sky + dual cosmic nebula bloom (baked once!)
    const bg = bctx.createLinearGradient(0, 0, 0, HEIGHT);
    bg.addColorStop(0, '#03061C');
    bg.addColorStop(0.58, '#08051F');
    bg.addColorStop(0.85, '#07172A');
    bg.addColorStop(1, '#04141F');
    bctx.fillStyle = bg;
    bctx.fillRect(0, 0, WIDTH, HEIGHT);

    const neb1 = bctx.createRadialGradient(WIDTH * 0.22, 220, 20, WIDTH * 0.22, 220, 270);
    neb1.addColorStop(0, 'rgba(168, 85, 247, 0.14)');
    neb1.addColorStop(1, 'rgba(0, 0, 0, 0)');
    bctx.fillStyle = neb1;
    bctx.fillRect(0, 0, WIDTH, HEIGHT);

    const neb2 = bctx.createRadialGradient(WIDTH * 0.8, 300, 18, WIDTH * 0.8, 300, 250);
    neb2.addColorStop(0, 'rgba(6, 182, 212, 0.13)');
    neb2.addColorStop(1, 'rgba(0, 0, 0, 0)');
    bctx.fillStyle = neb2;
    bctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Iconic 1979 Space Invaders Deluxe Lunar Colony / Skyline Horizon (baked once!)
    const towers = [
      { x: 24, w: 46, h: 92 },
      { x: 82, w: 32, h: 122 },
      { x: 136, w: 68, h: 68 },
      { x: 246, w: 40, h: 108 },
      { x: 318, w: 56, h: 82 },
      { x: 422, w: 44, h: 118 },
      { x: 492, w: 70, h: 72 },
      { x: 604, w: 36, h: 114 },
      { x: 662, w: 54, h: 86 },
      { x: 728, w: 36, h: 98 },
    ];
    bctx.fillStyle = 'rgba(8, 25, 48, 0.62)';
    bctx.strokeStyle = 'rgba(34, 211, 238, 0.22)';
    bctx.lineWidth = 1.4;
    for (const t of towers) {
      const ty = FLOOR_Y - t.h;
      bctx.fillRect(t.x, ty, t.w, t.h);
      bctx.strokeRect(t.x, ty, t.w, t.h);
      if (t.w >= 54) {
        bctx.beginPath();
        bctx.arc(t.x + t.w * 0.5, ty, t.w * 0.34, Math.PI, 0);
        bctx.fill();
        bctx.stroke();
      }
    }
    bctx.fillStyle = 'rgba(103, 232, 249, 0.22)';
    bctx.beginPath();
    for (const t of towers) {
      const ty = FLOOR_Y - t.h;
      for (let wy = ty + 14; wy < FLOOR_Y - 16; wy += 16) {
        for (let wx = t.x + 8; wx < t.x + t.w - 10; wx += 12) {
          bctx.rect(wx, wy, 4, 4);
        }
      }
    }
    bctx.fill();

    // Subtle ceiling guide bar
    bctx.fillStyle = 'rgba(244, 63, 94, 0.25)';
    bctx.fillRect(24, CEILING_Y - 2, WIDTH - 48, 1.5);

    this.backdropCache = canvas;
    return canvas;
  }

  private drawDeluxeBackdrop(ctx: CanvasRenderingContext2D): void {
    const cached = this.getOrBuildBackdrop();
    if (cached) {
      ctx.drawImage(cached, 0, 0);
    } else {
      ctx.fillStyle = '#06071E';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    // Fast batched parallax stars (3 color buckets, zero string allocations!)
    const starBuckets: [string, number][] = [
      ['rgba(255, 255, 255, 0.36)', 0],
      ['rgba(56, 189, 248, 0.38)', 1],
      ['rgba(244, 114, 182, 0.36)', 2],
    ];
    for (let b = 0; b < starBuckets.length; b++) {
      ctx.fillStyle = starBuckets[b][0];
      ctx.beginPath();
      for (let i = b; i < 66; i += 3) {
        const sx = (i * 211 + 19) % WIDTH;
        const sy = ((i * 337 + this.time * (8 + (i % 3) * 7)) % (HEIGHT - 140)) + 16;
        const sz = i % 5 === 0 ? 2.2 : 1.5;
        ctx.rect(sx, sy, sz, sz);
      }
      ctx.fill();
    }

    // Lightweight bass-march horizon pulse glow
    if (this.bassPulse > 0.04) {
      ctx.fillStyle = `rgba(34, 211, 238, ${(this.bassPulse * 0.09).toFixed(3)})`;
      ctx.fillRect(0, FLOOR_Y - 120, WIDTH, 120);
    }
  }

  private drawRainbowBonusArc(ctx: CanvasRenderingContext2D): void {
    const alpha = Math.min(1, this.rainbowTimer * 0.8);
    const colors = ['#EF4444', '#F97316', '#FACC15', '#22C55E', '#38BDF8', '#6366F1', '#EC4899'];
    ctx.save();
    ctx.globalAlpha = alpha * 0.68;
    for (let i = 0; i < colors.length; i++) {
      ctx.strokeStyle = colors[i];
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(WIDTH * 0.5, HEIGHT * 0.64, 240 + i * 11, Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawFloorBaseline(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(34, 211, 238, 0.28)';
    ctx.fillRect(24, FLOOR_Y - 2, WIDTH - 48, 8);
    ctx.fillStyle = '#06B6D4';
    ctx.fillRect(24, FLOOR_Y, WIDTH - 48, 4);
    ctx.fillStyle = '#CFFAFE';
    ctx.fillRect(24, FLOOR_Y, WIDTH - 48, 1.3);

    if (this.floorNotches.length > 0) {
      ctx.fillStyle = '#04141F';
      ctx.beginPath();
      for (const n of this.floorNotches) {
        ctx.rect(n.x - n.w * 0.5, FLOOR_Y - 2, n.w, 8);
      }
      ctx.fill();
    }
  }

  private drawBunkers(ctx: CanvasRenderingContext2D): void {
    // High-speed batched bunker rendering: 6 fill() calls total for all 1,408 cells!
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

    flush(midCells, '#06B6D4');
    flush(botCells, '#0E7490');
    flush(topCells, '#67E8F9');
    flush(warmCells, '#F472B6');
    flush(hotCells, '#FEF08A');

    if (topCells.length > 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.beginPath();
      for (let i = 0; i < topCells.length; i++) {
        const [bx, by, sz] = topCells[i];
        ctx.rect(bx + 0.3, by + 0.2, sz - 0.6, 1.2);
      }
      ctx.fill();
    }
  }

  private drawUfo2(ctx: CanvasRenderingContext2D): void {
    const isDropship = this.ufo.kind === 'dropship';
    const cloaked = !isDropship && Math.sin(this.time * 13) > 0.3;
    const ufoCol = isDropship ? '#F59E0B' : '#EC4899';

    ctx.save();
    if (isDropship) {
      // Volumetric golden reinforcement tractor beam under Dropship!
      const beamGrad = ctx.createLinearGradient(0, this.ufo.y + 10, 0, this.ufo.y + 72);
      beamGrad.addColorStop(0, 'rgba(250, 204, 21, 0.45)');
      beamGrad.addColorStop(1, 'rgba(250, 204, 21, 0)');
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(this.ufo.x - 12, this.ufo.y + 10);
      ctx.lineTo(this.ufo.x + 12, this.ufo.y + 10);
      ctx.lineTo(this.ufo.x + 32, this.ufo.y + 72);
      ctx.lineTo(this.ufo.x - 32, this.ufo.y + 72);
      ctx.closePath();
      ctx.fill();
    } else if (cloaked) {
      // Shimmering holographic phase-cloak aura ring
      ctx.strokeStyle = 'rgba(236, 72, 153, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(this.ufo.x, this.ufo.y, 32 + Math.sin(this.time * 24) * 3, 13, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.globalAlpha = cloaked ? 0.22 : 1;
    drawPixelMatrixHD(ctx, TAITO_UFO_MATRIX, this.ufo.x, this.ufo.y, 3.65, { '#': ufoCol }, ufoCol);

    const activeIdx = Math.floor(this.time * 15) % 5;
    for (let i = -2; i <= 2; i++) {
      const lit = i + 2 === activeIdx;
      ctx.fillStyle = lit ? '#FFFFFF' : '#FEF08A';
      ctx.beginPath();
      ctx.arc(this.ufo.x + i * 10, this.ufo.y + 0.5, lit ? 2.7 : 1.9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawInvader2(ctx: CanvasRenderingContext2D, inv: Invader2, rx: number, ry: number): void {
    const frame = inv.animFrame;
    const matrix =
      inv.kind === 'splitter'
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
    const cell = inv.kind === 'splitter' ? 3.4 : inv.kind === 'crab' ? 3.2 : 3.05;
    const fillCol = inv.fireFlash > 0.25 ? '#FEF08A' : inv.color;
    drawPixelMatrixHD(ctx, matrix, rx, ry, cell, { '#': fillCol }, fillCol);

    // Pulsing golden fission core seam on top-row Splitter Command Invaders (zero shadowBlur!)
    if (inv.kind === 'splitter') {
      const pulse = 0.6 + 0.4 * Math.sin(this.time * 10 + inv.col);
      ctx.fillStyle = `rgba(250, 204, 21, ${(pulse * 0.38).toFixed(2)})`;
      ctx.fillRect(rx - 3.5, ry - 10.5, 7, 18);
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(rx - 1.4, ry - 9.5, 2.8, 16);
    }

    // Golden warp-in halo when newly deployed by Dropship
    if (inv.warpGlow > 0.05) {
      ctx.save();
      ctx.globalAlpha = inv.warpGlow;
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(rx, ry, 24 * (1.2 - inv.warpGlow * 0.4), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawDropPods(ctx: CanvasRenderingContext2D): void {
    for (const pod of this.dropPods) {
      const r = 14 + Math.sin(this.time * 24) * 2;
      ctx.fillStyle = 'rgba(250, 204, 21, 0.24)';
      ctx.beginPath();
      ctx.arc(pod.x, pod.y, r + 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(pod.x, pod.y, r, 0, Math.PI * 2);
      ctx.stroke();
      drawPixelMatrixHD(ctx, TAITO_MINI_F0, pod.x, pod.y, 2.5, { '#': '#38BDF8' }, '#FACC15');
    }
  }

  private drawMiniDivers(ctx: CanvasRenderingContext2D): void {
    const miniFrame = Math.floor(this.time * 12) % 2;
    const mat = miniFrame === 0 ? TAITO_MINI_F0 : TAITO_MINI_F1;
    for (const md of this.miniDivers) {
      // Electric fission tether connecting mini-invaders to split origin (2-pass glow, no blur!)
      if (md.age < 0.32) {
        const a = (1 - md.age / 0.32) * 0.85;
        const midX = (md.tetherOriginX + md.x) * 0.5 + (Math.random() - 0.5) * 10;
        const midY = (md.tetherOriginY + md.y) * 0.5 + (Math.random() - 0.5) * 10;
        ctx.save();
        ctx.globalAlpha = a * 0.45;
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(md.tetherOriginX, md.tetherOriginY);
        ctx.lineTo(midX, midY);
        ctx.lineTo(md.x, md.y);
        ctx.stroke();
        ctx.globalAlpha = a;
        ctx.strokeStyle = '#FEF08A';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }

      // Glowing dive afterimage trail
      ctx.fillStyle = md.color;
      for (let i = 0; i < md.trail.length; i++) {
        const pt = md.trail[i];
        ctx.globalAlpha = ((i + 1) / md.trail.length) * 0.25;
        ctx.fillRect(pt.x - 3.5, pt.y - 3.5, 7, 7);
      }
      ctx.globalAlpha = 1;

      drawPixelMatrixHD(ctx, mat, md.x, md.y, 3.0, { '#': md.color }, md.color);
    }
  }

  private drawEnemyShots2(ctx: CanvasRenderingContext2D): void {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const s of this.enemyShots) {
      const boltColor = s.kind === 'squiggly' ? '#F472B6' : s.kind === 'plunger' ? '#38BDF8' : '#FACC15';
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
      // 2-pass crisp glow without Gaussian shadowBlur!
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

  private drawPlayerShot2(ctx: CanvasRenderingContext2D): void {
    if (!this.playerShot.active) return;

    if (this.playerShot.trail.length > 1) {
      ctx.fillStyle = '#22D3EE';
      for (let i = 0; i < this.playerShot.trail.length; i++) {
        const pt = this.playerShot.trail[i];
        ctx.globalAlpha = ((i + 1) / this.playerShot.trail.length) * 0.34;
        ctx.fillRect(pt.x - 1.6, pt.y - 4, 3.2, 12);
      }
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = 'rgba(34, 211, 238, 0.3)';
    ctx.fillRect(this.playerShot.x - 5.5, this.playerShot.y - 18, 11, 32);
    ctx.fillStyle = '#FEF08A';
    ctx.fillRect(this.playerShot.x - 2.6, this.playerShot.y - 16, 5.2, 26);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(this.playerShot.x - 1.2, this.playerShot.y - 15, 2.4, 18);
  }

  private drawSosEscapePod(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    drawPixelMatrixHD(ctx, TAITO_UFO_MATRIX, this.sosPod.x, this.sosPod.y, 2.3, { '#': '#F43F5E' }, '#FB7185');
    // Blinking distress banner "S.O.S.!"
    if (Math.floor(this.time * 10) % 2 === 0) {
      ctx.font = '900 18px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#F43F5E';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#FEF08A';
      ctx.fillText('S.O.S.!', this.sosPod.x, this.sosPod.y - 22);
    }
    ctx.restore();
  }

  private drawPlayerDisintegration2(ctx: CanvasRenderingContext2D): void {
    const t = this.playerDyingTimer / 0.85;
    ctx.save();
    ctx.translate(this.playerX, this.playerY);
    ctx.globalAlpha = Math.max(0.15, t);
    const flicker = Math.floor(this.time * 24) % 2;
    ctx.shadowColor = '#22D3EE';
    ctx.shadowBlur = 18;
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * Math.PI * 2 + flicker * 0.4;
      const dist = (1 - t) * 24 + 5 + (i % 3) * 6;
      ctx.fillStyle = i % 3 === 0 ? '#FFFFFF' : i % 2 === 0 ? '#FEF08A' : '#22D3EE';
      ctx.fillRect(Math.cos(ang) * dist - 2.5, Math.sin(ang) * dist * 0.55 - 2.5, 5, 5);
    }
    drawStarGlint(ctx, 0, -2, 18 * t + 6, '#CFFAFE', this.time * 12);
    ctx.restore();
  }

  private drawDeluxeCannon(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.translate(x, y + this.cannonRecoil * 0.65);

    if (Math.abs(this.playerVx) > 20) {
      const side = this.playerVx > 0 ? -26 : 26;
      ctx.save();
      ctx.fillStyle = 'rgba(103, 232, 249, 0.6)';
      ctx.shadowColor = '#22D3EE';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.ellipse(side, 8, 7.5 + Math.sin(this.time * 45) * 2, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.shadowColor = '#22D3EE';
    ctx.shadowBlur = 14;
    const grad = ctx.createLinearGradient(0, -18, 0, 15);
    grad.addColorStop(0, '#ECFEFF');
    grad.addColorStop(0.45, '#22D3EE');
    grad.addColorStop(1, '#0E7490');
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.roundRect(-25, 0, 50, 15, [3, 3, 2, 2]);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(-16.5, -7.5, 33, 8.5, [3, 3, 0, 0]);
    ctx.fill();
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.roundRect(-4.5, -19 + this.cannonRecoil * 0.45, 9, 13, [2, 2, 0, 0]);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillRect(-15, -6.5, 30, 1.8);
    ctx.fillRect(-23, 1.2, 46, 1.8);
    ctx.fillStyle = '#083344';
    ctx.fillRect(-14, 5.5, 7, 4.5);
    ctx.fillRect(7, 5.5, 7, 4.5);
    ctx.fillStyle = '#F43F5E';
    ctx.fillRect(-3, 5.5, 6, 4.5);

    if (this.muzzleFlash > 0.05) {
      ctx.save();
      ctx.globalAlpha = this.muzzleFlash;
      drawStarGlint(ctx, 0, -21, 13 * this.muzzleFlash + 4, '#FEF08A', this.time * 16);
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
      ctx.globalAlpha = alpha * 0.9;
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
      } else if (ex.kind === 'split') {
        ctx.globalAlpha = ratio;
        drawStarGlint(ctx, ex.x, ex.y, 24 * ratio + 6, '#FEF08A', this.time * 14);
      } else if (ex.kind === 'ceiling') {
        ctx.globalAlpha = ratio;
        drawPixelMatrixHD(ctx, TAITO_SHOT_TOP_EXPLODE, ex.x, ex.y, 2.3, { '#': '#F43F5E' }, '#FB7185');
      } else if (ex.kind === 'clash') {
        ctx.globalAlpha = ratio;
        drawStarGlint(ctx, ex.x, ex.y, 16 * ratio + 4, '#67E8F9', this.time * 18);
      } else if (ex.kind === 'ufo') {
        if (ratio > 0.58) {
          ctx.globalAlpha = (ratio - 0.58) / 0.42;
          drawPixelMatrixHD(ctx, TAITO_INVADER_EXPLODE, ex.x, ex.y, 4.5, { '#': '#FEF08A' }, ex.color);
        }
        if (ex.scoreText) {
          ctx.globalAlpha = Math.min(1, ratio * 1.5);
          ctx.font = '900 26px "Outfit", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = ex.color;
          ctx.fillText(ex.scoreText, ex.x + 1.5, ex.y + 1.5);
          ctx.fillStyle = '#FEF08A';
          ctx.fillText(ex.scoreText, ex.x, ex.y);
        }
      }
      ctx.restore();
    }

    // 3. Fast tumbling glowing debris shards (zero shadowBlur!)
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

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
import { drawStarGlint } from './arcadeGfx';

const WIDTH = 840;
const HEIGHT = 864;
const STORAGE_KEY = 'space_invaders_dx_hd_highscore_v1';

const CEILING_Y = 58;
const FLOOR_Y = HEIGHT - 48;

type ParodyThemeId = 'dx94' | 'arkanoid' | 'darius' | 'bubble' | 'citadel';
type WeaponMode = 'standard' | 'twin' | 'spread' | 'pierce';
type CapsuleKind = 'T' | 'S' | 'P' | 'B' | 'H';

interface ParodyTheme {
  id: ParodyThemeId;
  title: string;
  subtitle: string;
  skyTop: string;
  skyMid: string;
  skyBot: string;
  accent: string;
  bunkerTop: string;
  bunkerMid: string;
  bunkerBot: string;
  rowColors: [string, string, string, string, string];
  ufoName: string;
  ufoColor: string;
}

const PARODY_THEMES: ParodyTheme[] = [
  {
    id: 'dx94',
    title: "SPACE INVADERS '94 DX",
    subtitle: 'ORBITAL EARTH DEFENSE',
    skyTop: '#03081C',
    skyMid: '#071535',
    skyBot: '#092442',
    accent: '#38BDF8',
    bunkerTop: '#86EFAC',
    bunkerMid: '#22C55E',
    bunkerBot: '#15803D',
    rowColors: ['#F43F5E', '#38BDF8', '#60A5FA', '#4ADE80', '#2DD4BF'],
    ufoName: 'DREADNOUGHT UFO',
    ufoColor: '#EF4444',
  },
  {
    id: 'arkanoid',
    title: 'ARKANOID DX PARODY',
    subtitle: 'VAUS MOTHERSHIP SECTOR',
    skyTop: '#050824',
    skyMid: '#0C1242',
    skyBot: '#111D5E',
    accent: '#60A5FA',
    bunkerTop: '#BAE6FD',
    bunkerMid: '#3B82F6',
    bunkerBot: '#1D4ED8',
    rowColors: ['#FACC15', '#FB923C', '#F472B6', '#38BDF8', '#4ADE80'],
    ufoName: 'DOH MONOLITH ORB',
    ufoColor: '#F59E0B',
  },
  {
    id: 'darius',
    title: 'DARIUS DX PARODY',
    subtitle: 'SILVER HAWK DEEP-SEA COSMOS',
    skyTop: '#020B1C',
    skyMid: '#041C32',
    skyBot: '#06324A',
    accent: '#22D3EE',
    bunkerTop: '#A5F3FC',
    bunkerMid: '#06B6D4',
    bunkerBot: '#0E7490',
    rowColors: ['#F97316', '#FACC15', '#22D3EE', '#34D399', '#818CF8'],
    ufoName: 'KING FOSSIL UFO',
    ufoColor: '#FB923C',
  },
  {
    id: 'bubble',
    title: 'BUBBLE BOBBLE DX PARODY',
    subtitle: 'RAINBOW CAVERN SHOWDOWN',
    skyTop: '#14062B',
    skyMid: '#240B47',
    skyBot: '#1A174D',
    accent: '#F472B6',
    bunkerTop: '#FBCFE8',
    bunkerMid: '#EC4899',
    bunkerBot: '#BE185D',
    rowColors: ['#F472B6', '#C084FC', '#38BDF8', '#4ADE80', '#FDE047'],
    ufoName: 'BARON VON BLUBBA',
    ufoColor: '#E879F9',
  },
  {
    id: 'citadel',
    title: 'TAITO CYBER-CITADEL DX',
    subtitle: 'NEO-TOKYO 1994 FINALE',
    skyTop: '#160521',
    skyMid: '#2A0B3B',
    skyBot: '#0E1B38',
    accent: '#FACC15',
    bunkerTop: '#FEF08A',
    bunkerMid: '#F59E0B',
    bunkerBot: '#B45309',
    rowColors: ['#FACC15', '#F43F5E', '#A855F7', '#22D3EE', '#4ADE80'],
    ufoName: 'TAITO MOTHERSHIP',
    ufoColor: '#FACC15',
  },
];

interface DxInvader {
  row: number;
  col: number;
  tier: 'top' | 'mid' | 'bot';
  points: number;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  stepProgress: number;
  stepDelay: number;
  alive: boolean;
  hp: number;
  maxHp: number;
  color: string;
  powerCarrier: boolean;
  hitFlash: number;
  fireFlash: number;
  animFrame: number;
}

interface PlayerBolt {
  x: number;
  y: number;
  vx: number;
  vy: number;
  pierce: boolean;
  color: string;
  trail: Array<{ x: number; y: number }>;
}

interface EnemyBolt {
  x: number;
  y: number;
  vy: number;
  kind: 'spiral' | 'cross' | 'lightning';
  phase: number;
  trail: Array<{ x: number; y: number }>;
}

interface PowerCapsule {
  x: number;
  y: number;
  vy: number;
  kind: CapsuleKind;
  phase: number;
}

interface DxBunker {
  x: number;
  y: number;
  cols: number;
  rows: number;
  cellSize: number;
  cells: boolean[][];
  origCells: boolean[][];
  heat: number[][];
}

interface Fireball {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  life: number;
  maxLife: number;
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

interface ArmorDebris {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  vrot: number;
  color: string;
  life: number;
  maxLife: number;
}

export class SpaceInvadersDxGame implements ArcadeGameInstance {
  public readonly logicalWidth = WIDTH;
  public readonly logicalHeight = HEIGHT;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'Fire';
  public readonly secondaryActionLabel = 'Hyper Beam';

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
  private playerY = HEIGHT - 84;
  private playerVx = 0;
  private cannonRecoil = 0;
  private muzzleFlash = 0;
  private fireCooldown = 0;
  private playerDyingTimer = 0;
  private invulnTimer = 0;

  // DX Arsenal & Overdrive Hyper Beam!
  private weaponMode: WeaponMode = 'standard';
  private weaponTimer = 0;
  private hyperCharge = 35; // 0..100
  private hyperBeamTimer = 0;
  private hyperBeamX = WIDTH * 0.5;
  private comboCount = 0;
  private comboTimer = 0;

  private playerShots: PlayerBolt[] = [];
  private enemyShots: EnemyBolt[] = [];
  private capsules: PowerCapsule[] = [];

  private invaders: DxInvader[] = [];
  private formationDir: 1 | -1 = 1;
  private marchTimer = 0.45;
  private marchAnimFrame = 0;
  private marchStepCount = 0;
  private hitStopTimer = 0;
  private bassPulse = 0;
  private rackRevealProgress = 1;
  private enemyFireTimer = 0.7;

  private bunkers: DxBunker[] = [];
  private repairGlowTimer = 0;

  private ufo = {
    active: false,
    x: 0,
    y: 92,
    dir: 1 as 1 | -1,
    spawnTimer: 9,
    soundTimer: 0,
    hp: 1,
  };

  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];
  private fireballs: Fireball[] = [];
  private shockwaves: Shockwave[] = [];
  private debris: ArmorDebris[] = [];
  private shakeTime = 0;
  private shakeMag = 0;
  private screenFlash = 0;
  private screenFlashColor = '#FFFFFF';

  constructor() {
    this.setupWave(1, true);
  }

  private getTheme(): ParodyTheme {
    return PARODY_THEMES[(this.level - 1) % PARODY_THEMES.length];
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
    this.weaponMode = 'standard';
    this.weaponTimer = 0;
    this.hyperCharge = 40;
    this.hyperBeamTimer = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.particles = [];
    this.popups = [];
    this.fireballs = [];
    this.shockwaves = [];
    this.debris = [];
    this.setupWave(1, true);
    this.phase = 'READY';
    this.phaseTimer = 1.3;
    this.rackRevealProgress = 0;
    const theme = this.getTheme();
    this.bannerText = `STAGE 1 · ${theme.title}`;
    this.bannerSub = theme.subtitle;
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
    const alive = this.invaders.filter((a) => a.alive).length;
    const theme = this.getTheme();
    const weaponLabel =
      this.weaponMode === 'twin'
        ? 'TWIN LASER'
        : this.weaponMode === 'spread'
        ? '3-WAY SPREAD'
        : this.weaponMode === 'pierce'
        ? 'RAIL PIERCE'
        : 'DX PLASMA';
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: `${theme.title} · W${this.level}`,
      primaryMetricLabel: 'Weapon / Aliens',
      primaryMetricValue: `${weaponLabel} · ${alive}`,
      secondaryMetricLabel: this.hyperCharge >= 100 ? 'SHIFT: HYPER READY!' : 'Hyper Gauge',
      secondaryMetricValue: `${Math.floor(this.hyperCharge)}%`,
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

  private spawn16BitExplosion(
    x: number,
    y: number,
    color: string,
    scale: 'small' | 'alien' | 'ufo' | 'player'
  ): void {
    if (scale === 'small') {
      this.fireballs.push({ x, y, radius: 4, maxRadius: 18, color, life: 0.2, maxLife: 0.2 });
      spawnBurst(this.particles, x, y, color, 8, 125, 2.2);
      return;
    }
    if (scale === 'alien') {
      this.fireballs.push(
        { x, y, radius: 6, maxRadius: 30, color, life: 0.32, maxLife: 0.32 },
        { x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 8, radius: 4, maxRadius: 20, color: '#FEF08A', life: 0.22, maxLife: 0.22 }
      );
      this.shockwaves.push({
        x,
        y,
        radius: 6,
        maxRadius: 48,
        color,
        life: 0.32,
        maxLife: 0.32,
        lineWidth: 3.4,
      });
      spawnBurst(this.particles, x, y, color, 18, 240, 3.4);
      spawnBurst(this.particles, x, y, '#FEF08A', 10, 180, 2.5);
      for (let i = 0; i < 8; i++) {
        const ang = (Math.PI * 2 * i) / 8 + (Math.random() - 0.5) * 0.4;
        const spd = 95 + Math.random() * 170;
        this.debris.push({
          x,
          y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          w: 4 + Math.random() * 4.5,
          h: 2.8 + Math.random() * 3,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 18,
          color: i % 3 === 0 ? '#FFFFFF' : color,
          life: 0.42 + Math.random() * 0.25,
          maxLife: 0.67,
        });
      }
      this.addShake(3.6, 0.12);
      return;
    }
    // Huge 16-bit multi-ring Boss UFO or Player detonation!
    const isPlayer = scale === 'player';
    this.fireballs.push(
      { x, y, radius: 10, maxRadius: 58, color, life: 0.52, maxLife: 0.52 },
      { x: x - 18, y: y - 6, radius: 6, maxRadius: 34, color: '#FEF08A', life: 0.38, maxLife: 0.38 },
      { x: x + 18, y: y + 5, radius: 6, maxRadius: 34, color: '#FB923C', life: 0.42, maxLife: 0.42 }
    );
    this.shockwaves.push(
      { x, y, radius: 8, maxRadius: 96, color, life: 0.55, maxLife: 0.55, lineWidth: 5 },
      { x, y, radius: 4, maxRadius: 62, color: '#FFFFFF', life: 0.38, maxLife: 0.38, lineWidth: 3 }
    );
    spawnBurst(this.particles, x, y, color, 38, 320, 4.5);
    spawnBurst(this.particles, x, y, '#FEF08A', 24, 240, 3.5);
    for (let i = 0; i < 18; i++) {
      const ang = isPlayer ? -Math.PI + Math.random() * Math.PI : Math.random() * Math.PI * 2;
      const spd = 85 + Math.random() * 240;
      this.debris.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 12,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        w: 5 + Math.random() * 5,
        h: 3.5 + Math.random() * 3.5,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 20,
        color: i % 3 === 0 ? '#FEF08A' : i % 2 === 0 ? color : '#FFFFFF',
        life: 0.6 + Math.random() * 0.35,
        maxLife: 0.95,
      });
    }
    this.addShake(isPlayer ? 11 : 9.5, 0.36);
    this.triggerFlash(color, 0.28);
  }

  private addScore(pts: number, x?: number, y?: number, color = '#38BDF8', label?: string): void {
    if (this.phase === 'TITLE') return;
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(STORAGE_KEY, this.highScore);
    }
    if (!this.bonusLifeGiven && this.score >= 3000) {
      this.bonusLifeGiven = true;
      this.lives = Math.min(6, this.lives + 1);
      arcadeAudio.playExtraLife();
      this.popups.push({
        x: this.playerX,
        y: this.playerY - 34,
        text: '1UP!',
        color: '#4ADE80',
        life: 1.5,
        maxLife: 1.5,
      });
    }
    if (x !== undefined && y !== undefined) {
      this.popups.push({
        x,
        y,
        text: label ?? `+${pts}`,
        color,
        life: 0.9,
        maxLife: 0.9,
      });
    }
  }

  private createBunkers(): void {
    this.bunkers = [];
    const cols = 24;
    const rows = 16;
    const cellSize = 4;
    const bunkerW = cols * cellSize; // 96px
    const spacing = (WIDTH - 4 * bunkerW) / 5;
    for (let i = 0; i < 4; i++) {
      const bx = spacing + i * (bunkerW + spacing);
      const by = HEIGHT - 210;
      const cells: boolean[][] = [];
      const origCells: boolean[][] = [];
      const heat: number[][] = [];
      for (let r = 0; r < rows; r++) {
        const cRow: boolean[] = [];
        const oRow: boolean[] = [];
        const hRow: number[] = [];
        for (let c = 0; c < cols; c++) {
          let solid = true;
          if (r < 4 && (c < 4 - r || c >= cols - (4 - r))) solid = false;
          const archCenter = (cols - 1) * 0.5;
          const dist = Math.abs(c - archCenter);
          if (r >= 11 && dist < 5.8) solid = false;
          if (r === 10 && dist < 4.5) solid = false;
          if (r === 9 && dist < 3.0) solid = false;
          cRow.push(solid);
          oRow.push(solid);
          hRow.push(0);
        }
        cells.push(cRow);
        origCells.push(oRow);
        heat.push(hRow);
      }
      this.bunkers.push({ x: bx, y: by, cols, rows, cellSize, cells, origCells, heat });
    }
  }

  private repairAllBunkers(): void {
    this.repairGlowTimer = 1.0;
    arcadeAudio.playDxShieldRepair();
    for (const bk of this.bunkers) {
      for (let r = 0; r < bk.rows; r++) {
        for (let c = 0; c < bk.cols; c++) {
          if (bk.origCells[r][c] && !bk.cells[r][c]) {
            bk.cells[r][c] = true;
            bk.heat[r][c] = 0.85;
          }
        }
      }
      this.shockwaves.push({
        x: bk.x + bk.cols * bk.cellSize * 0.5,
        y: bk.y + bk.rows * bk.cellSize * 0.5,
        radius: 8,
        maxRadius: 68,
        color: '#4ADE80',
        life: 0.45,
        maxLife: 0.45,
        lineWidth: 3.2,
      });
    }
  }

  private setupWave(wave: number, resetBunkers: boolean): void {
    this.invaders = [];
    const theme = this.getTheme();
    const startY = Math.min(242, 152 + ((wave - 1) % 5) * 20);
    const colSpacing = 58;
    const rowSpacing = 48;
    const startX = (WIDTH - 10 * colSpacing) * 0.5;

    // Pick 4 special glowing Power-Up Carrier invaders across the formation!
    const carrierIndices = new Set<number>();
    while (carrierIndices.size < 4) {
      carrierIndices.add(Math.floor(Math.random() * 55));
    }

    let idx = 0;
    for (let r = 0; r < 5; r++) {
      const tier: DxInvader['tier'] = r === 0 ? 'top' : r <= 2 ? 'mid' : 'bot';
      const points = r === 0 ? 50 : r <= 2 ? 30 : 20;
      const armored = r === 0 && wave >= 2;
      for (let c = 0; c < 11; c++) {
        const ix = startX + c * colSpacing;
        const iy = startY + r * rowSpacing;
        this.invaders.push({
          row: r,
          col: c,
          tier,
          points,
          x: ix,
          y: iy,
          prevX: ix,
          prevY: iy,
          stepProgress: 1,
          stepDelay: 0,
          alive: true,
          hp: armored ? 2 : 1,
          maxHp: armored ? 2 : 1,
          color: theme.rowColors[r],
          powerCarrier: carrierIndices.has(idx),
          hitFlash: 0,
          fireFlash: 0,
          animFrame: 0,
        });
        idx++;
      }
    }

    this.formationDir = 1;
    this.marchTimer = 0.46;
    this.marchAnimFrame = 0;
    this.marchStepCount = 0;
    this.hitStopTimer = 0;
    this.playerDyingTimer = 0;
    this.playerShots = [];
    this.enemyShots = [];
    this.capsules = [];
    this.playerX = WIDTH * 0.5;
    this.playerVx = 0;
    this.invulnTimer = 1.2;
    this.ufo = {
      active: false,
      x: 0,
      y: 92,
      dir: 1,
      spawnTimer: 8 + Math.random() * 4,
      soundTimer: 0,
      hp: wave >= 3 ? 2 : 1,
    };
    if (resetBunkers) this.createBunkers();
  }

  public step(dt: number): void {
    this.time += dt;
    stepParticlesAndPopups(this.particles, this.popups, dt);
    this.stepVfx(dt);

    if (this.phase === 'PAUSED' || this.phase === 'GAME_OVER') return;

    if (this.phase === 'READY') {
      this.phaseTimer -= dt;
      this.rackRevealProgress = Math.min(1, this.rackRevealProgress + dt * 1.35);
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
      if (this.phaseTimer <= 0) {
        this.level += 1;
        this.setupWave(this.level, true);
        this.phase = 'READY';
        this.phaseTimer = 1.35;
        this.rackRevealProgress = 0;
        const theme = this.getTheme();
        this.bannerText = `STAGE ${this.level} · ${theme.title}`;
        this.bannerSub = theme.subtitle;
      }
      return;
    }

    if (this.playerDyingTimer > 0) {
      this.playerDyingTimer -= dt;
      if (Math.random() < 0.6) {
        spawnBurst(
          this.particles,
          this.playerX + (Math.random() - 0.5) * 30,
          this.playerY + (Math.random() - 0.5) * 12,
          Math.random() < 0.5 ? '#FEF08A' : this.getTheme().accent,
          3,
          150,
          2.8
        );
      }
      if (this.playerDyingTimer <= 0) {
        this.finishPlayerDeath();
      }
      return;
    }

    const isAttract = this.phase === 'TITLE';
    this.updatePlayer(dt, isAttract);
    this.updateHyperBeam(dt, isAttract);
    this.updatePlayerShots(dt, isAttract);
    this.updateCapsules(dt, isAttract);

    if (this.hitStopTimer > 0) {
      this.hitStopTimer = Math.max(0, this.hitStopTimer - dt);
    } else {
      this.updateFormation(dt, isAttract);
    }

    this.updateEnemyShots(dt, isAttract);
    this.updateUfo(dt, isAttract);

    if (!this.invaders.some((a) => a.alive)) {
      if (isAttract) {
        this.level = (this.level % PARODY_THEMES.length) + 1;
        this.setupWave(this.level, true);
      } else {
        arcadeAudio.playStageClear();
        this.phase = 'STAGE_CLEAR';
        this.phaseTimer = 1.85;
        const nextTheme = PARODY_THEMES[this.level % PARODY_THEMES.length];
        this.bannerText = `STAGE ${this.level} CLEAR!`;
        this.bannerSub = `NEXT PARODY WORLD: ${nextTheme.title}`;
        this.triggerFlash(this.getTheme().accent, 0.24);
      }
    }
  }

  private stepVfx(dt: number): void {
    if (this.cannonRecoil > 0) this.cannonRecoil = Math.max(0, this.cannonRecoil - dt * 28);
    if (this.muzzleFlash > 0) this.muzzleFlash = Math.max(0, this.muzzleFlash - dt * 9);
    if (this.bassPulse > 0) this.bassPulse = Math.max(0, this.bassPulse - dt * 5);
    if (this.repairGlowTimer > 0) this.repairGlowTimer = Math.max(0, this.repairGlowTimer - dt);
    if (this.comboTimer > 0) {
      this.comboTimer = Math.max(0, this.comboTimer - dt);
      if (this.comboTimer === 0) this.comboCount = 0;
    }
    if (this.weaponTimer > 0) {
      this.weaponTimer = Math.max(0, this.weaponTimer - dt);
      if (this.weaponTimer === 0) this.weaponMode = 'standard';
    }
    if (this.shakeTime > 0) {
      this.shakeTime = Math.max(0, this.shakeTime - dt);
      if (this.shakeTime === 0) this.shakeMag = 0;
    }
    if (this.screenFlash > 0) this.screenFlash = Math.max(0, this.screenFlash - dt * 1.6);

    for (let i = this.fireballs.length - 1; i >= 0; i--) {
      const f = this.fireballs[i];
      f.life -= dt;
      if (f.life <= 0) {
        this.fireballs.splice(i, 1);
      } else {
        const t = 1 - f.life / f.maxLife;
        f.radius = f.maxRadius * (0.25 + 0.75 * Math.sin(t * Math.PI * 0.75));
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

    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.life -= dt;
      if (d.life <= 0) {
        this.debris.splice(i, 1);
      } else {
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.vx *= 0.96;
        d.vy = d.vy * 0.96 + 150 * dt;
        d.rot += d.vrot * dt;
      }
    }

    for (const bk of this.bunkers) {
      for (let r = 0; r < bk.rows; r++) {
        for (let c = 0; c < bk.cols; c++) {
          if (bk.heat[r][c] > 0) bk.heat[r][c] = Math.max(0, bk.heat[r][c] - dt * 2.2);
        }
      }
    }

    for (const inv of this.invaders) {
      if (!inv.alive) continue;
      if (inv.hitFlash > 0) inv.hitFlash = Math.max(0, inv.hitFlash - dt * 6);
      if (inv.fireFlash > 0) inv.fireFlash = Math.max(0, inv.fireFlash - dt * 5.5);
      if (inv.stepDelay > 0) {
        inv.stepDelay = Math.max(0, inv.stepDelay - dt);
      } else if (inv.stepProgress < 1) {
        inv.stepProgress = Math.min(1, inv.stepProgress + dt * 22);
      }
    }
  }

  private getInvaderRenderPos(inv: DxInvader): { rx: number; ry: number } {
    const t = Math.min(1, Math.max(0, inv.stepProgress));
    const ease = t * (2 - t);
    return {
      rx: inv.prevX + (inv.x - inv.prevX) * ease,
      ry: inv.prevY + (inv.y - inv.prevY) * ease,
    };
  }

  private updatePlayer(dt: number, isAttract: boolean): void {
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (this.fireCooldown > 0) this.fireCooldown = Math.max(0, this.fireCooldown - dt);

    if (isAttract) {
      const targetX = this.capsules[0]?.x ?? (this.ufo.active ? this.ufo.x : this.invaders.find((a) => a.alive)?.x ?? WIDTH * 0.5);
      const dx = targetX - this.playerX;
      const move = Math.sign(dx) * Math.min(Math.abs(dx), 340 * dt);
      this.playerVx = move / Math.max(0.001, dt);
      this.playerX += move;
      if (this.fireCooldown <= 0 && Math.abs(dx) < 42) {
        this.firePlayerWeapon(true);
      }
      return;
    }

    const dir = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    this.playerVx = dir * 395;
    this.playerX = Math.max(46, Math.min(WIDTH - 46, this.playerX + this.playerVx * dt));

    if ((this.input.fire || this.input.fireJustPressed) && this.fireCooldown <= 0) {
      this.firePlayerWeapon(false);
    }

    // DX HYPER BEAM Overdrive trigger (Shift / X when gauge = 100%)!
    if ((this.input.secondary || this.input.secondaryJustPressed) && this.hyperCharge >= 100 && this.hyperBeamTimer <= 0) {
      this.hyperCharge = 0;
      this.hyperBeamTimer = 1.05;
      this.hyperBeamX = this.playerX;
      arcadeAudio.playDxHyperBeam();
      this.addShake(8, 0.5);
      this.triggerFlash('#FEF08A', 0.25);
      this.popups.push({
        x: this.playerX,
        y: this.playerY - 40,
        text: 'DX HYPER BEAM!!',
        color: '#FEF08A',
        life: 1.2,
        maxLife: 1.2,
      });
    }
  }

  private firePlayerWeapon(isAttract: boolean): void {
    const maxBolts = this.weaponMode === 'spread' ? 6 : this.weaponMode === 'twin' ? 4 : 2;
    if (this.playerShots.length >= maxBolts) return;

    const accent = this.getTheme().accent;
    this.cannonRecoil = 6;
    this.muzzleFlash = 1;
    if (!isAttract) arcadeAudio.playInvaderLaser(true);

    if (this.weaponMode === 'twin') {
      this.fireCooldown = 0.24;
      this.playerShots.push(
        { x: this.playerX - 11, y: this.playerY - 20, vx: 0, vy: -900, pierce: false, color: '#38BDF8', trail: [] },
        { x: this.playerX + 11, y: this.playerY - 20, vx: 0, vy: -900, pierce: false, color: '#38BDF8', trail: [] }
      );
    } else if (this.weaponMode === 'spread') {
      this.fireCooldown = 0.28;
      this.playerShots.push(
        { x: this.playerX, y: this.playerY - 22, vx: 0, vy: -880, pierce: false, color: '#F472B6', trail: [] },
        { x: this.playerX - 6, y: this.playerY - 18, vx: -170, vy: -840, pierce: false, color: '#F472B6', trail: [] },
        { x: this.playerX + 6, y: this.playerY - 18, vx: 170, vy: -840, pierce: false, color: '#F472B6', trail: [] }
      );
    } else if (this.weaponMode === 'pierce') {
      this.fireCooldown = 0.26;
      this.playerShots.push({
        x: this.playerX,
        y: this.playerY - 24,
        vx: 0,
        vy: -1040,
        pierce: true,
        color: '#FACC15',
        trail: [],
      });
    } else {
      this.fireCooldown = 0.24;
      this.playerShots.push({
        x: this.playerX,
        y: this.playerY - 22,
        vx: 0,
        vy: -880,
        pierce: false,
        color: accent,
        trail: [],
      });
    }
  }

  private updateHyperBeam(dt: number, isAttract: boolean): void {
    if (this.hyperBeamTimer <= 0) return;
    this.hyperBeamTimer = Math.max(0, this.hyperBeamTimer - dt);
    this.hyperBeamX = this.playerX;

    // Vaporize enemy bolts inside the Hyper Beam column!
    for (let i = this.enemyShots.length - 1; i >= 0; i--) {
      if (Math.abs(this.enemyShots[i].x - this.hyperBeamX) < 36) {
        spawnBurst(this.particles, this.enemyShots[i].x, this.enemyShots[i].y, '#FEF08A', 8, 150, 2.4);
        this.enemyShots.splice(i, 1);
      }
    }

    // Vaporize invaders inside the Hyper Beam column!
    for (const inv of this.invaders) {
      if (!inv.alive) continue;
      const { rx, ry } = this.getInvaderRenderPos(inv);
      if (Math.abs(rx - this.hyperBeamX) < 38) {
        this.destroyInvader(inv, rx, ry, isAttract, true);
      }
    }

    // Hit UFO with Hyper Beam!
    if (this.ufo.active && Math.abs(this.ufo.x - this.hyperBeamX) < 42) {
      this.destroyUfo(isAttract);
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

  private maybeSpawnCapsule(x: number, y: number, guaranteed = false): void {
    if (!guaranteed && Math.random() > 0.14) return;
    if (this.capsules.length >= 3) return;
    const pool: CapsuleKind[] = ['T', 'S', 'P', 'B', 'H'];
    const kind = pool[Math.floor(Math.random() * pool.length)];
    this.capsules.push({ x, y, vy: 138, kind, phase: 0 });
  }

  private destroyInvader(inv: DxInvader, rx: number, ry: number, isAttract: boolean, fromHyper = false): void {
    inv.alive = false;
    if (!fromHyper) this.hitStopTimer = 0.055;
    if (!isAttract) arcadeAudio.playInvaderExplosion('alien');
    this.spawn16BitExplosion(rx, ry, inv.color, 'alien');

    // Combo chain + Hyper Gauge charge
    this.comboCount = this.comboTimer > 0 ? Math.min(8, this.comboCount + 1) : 1;
    this.comboTimer = 1.45;
    const mult = this.comboCount >= 5 ? 3 : this.comboCount >= 3 ? 2 : 1;
    const pts = inv.points * mult;
    if (!fromHyper) {
      this.hyperCharge = Math.min(100, this.hyperCharge + (inv.powerCarrier ? 16 : 6.5));
    }

    if (inv.powerCarrier) {
      this.maybeSpawnCapsule(rx, ry, true);
    }

    this.addScore(pts, rx, ry - 8, mult > 1 ? '#FEF08A' : inv.color, mult > 1 ? `+${pts} ×${mult}` : `+${pts}`);
  }

  private destroyUfo(isAttract: boolean): void {
    const ux = this.ufo.x;
    const uy = this.ufo.y;
    const theme = this.getTheme();
    this.ufo.active = false;
    this.ufo.spawnTimer = 13 + Math.random() * 5;
    if (!isAttract) arcadeAudio.playInvaderExplosion('ufo');
    this.spawn16BitExplosion(ux, uy, theme.ufoColor, 'ufo');
    this.hyperCharge = Math.min(100, this.hyperCharge + 28);
    this.maybeSpawnCapsule(ux, uy, true);
    const pts = 300 + (this.level - 1) * 100;
    this.addScore(pts, ux, uy, '#FEF08A', `${pts}!`);
  }

  private updatePlayerShots(dt: number, isAttract: boolean): void {
    for (let i = this.playerShots.length - 1; i >= 0; i--) {
      const sh = this.playerShots[i];
      sh.trail.push({ x: sh.x, y: sh.y });
      if (sh.trail.length > 7) sh.trail.shift();
      sh.x += sh.vx * dt;
      sh.y += sh.vy * dt;

      if (sh.y <= CEILING_Y + 6 || sh.x < 16 || sh.x > WIDTH - 16) {
        this.spawn16BitExplosion(sh.x, Math.max(CEILING_Y + 8, sh.y), sh.color, 'small');
        this.playerShots.splice(i, 1);
        continue;
      }

      if (!sh.pierce && this.damageBunkerAt(sh.x, sh.y, 10, true)) {
        if (!isAttract) arcadeAudio.playInvaderExplosion('bunker');
        spawnBurst(this.particles, sh.x, sh.y, sh.color, 7, 105, 2.2);
        this.playerShots.splice(i, 1);
        continue;
      }

      // Shot-vs-shot intercept!
      let consumed = false;
      for (let j = this.enemyShots.length - 1; j >= 0; j--) {
        const es = this.enemyShots[j];
        if (Math.hypot(sh.x - es.x, sh.y - es.y) < 16) {
          this.enemyShots.splice(j, 1);
          if (!isAttract) arcadeAudio.playInvaderExplosion('clash');
          this.spawn16BitExplosion(es.x, es.y, '#FEF08A', 'small');
          if (!sh.pierce) {
            this.playerShots.splice(i, 1);
            consumed = true;
            break;
          }
        }
      }
      if (consumed) continue;

      // Hit Mystery Theme UFO!
      if (this.ufo.active && Math.hypot(sh.x - this.ufo.x, sh.y - this.ufo.y) < 34) {
        this.ufo.hp -= 1;
        if (!sh.pierce) this.playerShots.splice(i, 1);
        if (this.ufo.hp <= 0) {
          this.destroyUfo(isAttract);
        } else {
          if (!isAttract) arcadeAudio.playInvaderExplosion('clash');
          this.spawn16BitExplosion(sh.x, sh.y, '#FEF08A', 'small');
          this.popups.push({ x: this.ufo.x, y: this.ufo.y - 20, text: 'ARMOR CRACK!', color: '#FEF08A', life: 0.7, maxLife: 0.7 });
        }
        continue;
      }

      // Hit Invaders!
      for (const inv of this.invaders) {
        if (!inv.alive) continue;
        const { rx, ry } = this.getInvaderRenderPos(inv);
        if (Math.abs(sh.x - rx) < 22 && Math.abs(sh.y - ry) < 18) {
          inv.hp -= 1;
          inv.hitFlash = 1;
          if (!sh.pierce) {
            this.playerShots.splice(i, 1);
            consumed = true;
          }
          if (inv.hp <= 0) {
            this.destroyInvader(inv, rx, ry, isAttract, false);
          } else {
            if (!isAttract) arcadeAudio.playInvaderExplosion('clash');
            spawnBurst(this.particles, rx, ry, '#FEF08A', 12, 165, 2.5);
            this.popups.push({ x: rx, y: ry - 16, text: 'SHIELD BREAK!', color: '#FEF08A', life: 0.65, maxLife: 0.65 });
          }
          if (consumed) break;
        }
      }
    }
  }

  private updateCapsules(dt: number, isAttract: boolean): void {
    for (let i = this.capsules.length - 1; i >= 0; i--) {
      const cap = this.capsules[i];
      cap.y += cap.vy * dt;
      cap.phase += dt * 7;

      if (Math.hypot(cap.x - this.playerX, cap.y - this.playerY) < 34) {
        this.capsules.splice(i, 1);
        if (!isAttract) arcadeAudio.playDxCapsule();
        this.shockwaves.push({
          x: this.playerX,
          y: this.playerY,
          radius: 8,
          maxRadius: 56,
          color: '#FEF08A',
          life: 0.35,
          maxLife: 0.35,
          lineWidth: 3.2,
        });
        if (cap.kind === 'T') {
          this.weaponMode = 'twin';
          this.weaponTimer = 14;
          this.addScore(150, this.playerX, this.playerY - 28, '#38BDF8', 'TWIN LASER!');
        } else if (cap.kind === 'S') {
          this.weaponMode = 'spread';
          this.weaponTimer = 13;
          this.addScore(150, this.playerX, this.playerY - 28, '#F472B6', '3-WAY SPREAD!');
        } else if (cap.kind === 'P') {
          this.weaponMode = 'pierce';
          this.weaponTimer = 12;
          this.addScore(150, this.playerX, this.playerY - 28, '#FACC15', 'PIERCING RAIL!');
        } else if (cap.kind === 'B') {
          this.repairAllBunkers();
          this.addScore(200, this.playerX, this.playerY - 28, '#4ADE80', 'SHIELDS REPAIRED!');
        } else {
          this.hyperCharge = Math.min(100, this.hyperCharge + 55);
          this.addScore(200, this.playerX, this.playerY - 28, '#FEF08A', 'HYPER +55%!');
        }
        continue;
      }

      if (cap.y > FLOOR_Y + 12) this.capsules.splice(i, 1);
    }
  }

  private updateFormation(dt: number, isAttract: boolean): void {
    const alive = this.invaders.filter((a) => a.alive);
    if (alive.length === 0) return;

    const ratio = alive.length / 55;
    const waveSpeedup = Math.max(0.36, 0.66 - (this.level - 1) * 0.04);
    const stepInterval = Math.max(0.048, 0.048 + Math.pow(ratio, 1.35) * waveSpeedup);

    this.marchTimer -= dt;
    if (this.marchTimer > 0) return;
    this.marchTimer = stepInterval;
    this.marchAnimFrame = 1 - this.marchAnimFrame;
    this.bassPulse = 1;
    if (!isAttract) arcadeAudio.playInvaderStep(this.marchStepCount);
    this.marchStepCount++;

    const stepX = alive.length === 1 ? 18 : 13;
    let minX = Infinity;
    let maxX = -Infinity;
    for (const inv of alive) {
      if (inv.x < minX) minX = inv.x;
      if (inv.x > maxX) maxX = inv.x;
    }

    const hitEdge =
      (this.formationDir === 1 && maxX + stepX > WIDTH - 40) ||
      (this.formationDir === -1 && minX - stepX < 40);

    const rowStagger = Math.min(0.017, stepInterval * 0.08);

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
        if (inv.y >= this.playerY - 24) {
          if (isAttract) {
            this.setupWave(this.level, true);
            return;
          }
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
    this.enemyFireTimer -= dt;
    const maxShots = Math.min(6, 3 + Math.floor(this.level * 0.55));
    if (this.enemyFireTimer <= 0 && this.enemyShots.length < maxShots) {
      this.enemyFireTimer = Math.max(0.28, 0.85 - this.level * 0.07);
      const bottomByCol = new Map<number, DxInvader>();
      for (const inv of this.invaders) {
        if (!inv.alive) continue;
        const prev = bottomByCol.get(inv.col);
        if (!prev || inv.row > prev.row) bottomByCol.set(inv.col, inv);
      }
      const shooters = Array.from(bottomByCol.values());
      if (shooters.length > 0) {
        const targeted = Math.random() < 0.45;
        const chosen = targeted
          ? shooters.reduce((b, c) => (Math.abs(c.x - this.playerX) < Math.abs(b.x - this.playerX) ? c : b))
          : shooters[Math.floor(Math.random() * shooters.length)];
        const kind: EnemyBolt['kind'] = targeted ? 'spiral' : Math.random() < 0.5 ? 'cross' : 'lightning';
        chosen.fireFlash = 1;
        this.enemyShots.push({
          x: chosen.x,
          y: chosen.y + 18,
          vy: (kind === 'lightning' ? 325 : 295) + this.level * 20,
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
      s.phase += dt * 26;

      if (this.damageBunkerAt(s.x, s.y, 12, true)) {
        this.enemyShots.splice(i, 1);
        if (!isAttract) arcadeAudio.playInvaderExplosion('bunker');
        spawnBurst(this.particles, s.x, s.y, this.getTheme().bunkerTop, 8, 110, 2.2);
        continue;
      }

      if (
        !isAttract &&
        this.invulnTimer <= 0 &&
        Math.abs(s.x - this.playerX) < 24 &&
        Math.abs(s.y - this.playerY) < 17
      ) {
        this.enemyShots.splice(i, 1);
        this.triggerPlayerHit();
        return;
      }

      if (s.y >= FLOOR_Y) {
        spawnBurst(this.particles, s.x, FLOOR_Y - 2, this.getTheme().accent, 6, 90, 2);
        this.enemyShots.splice(i, 1);
      }
    }
  }

  private updateUfo(dt: number, isAttract: boolean): void {
    if (!this.ufo.active) {
      this.ufo.spawnTimer -= dt;
      if (this.ufo.spawnTimer <= 0 && this.invaders.filter((a) => a.alive).length >= 6) {
        const fromLeft = Math.random() < 0.5;
        this.ufo = {
          active: true,
          x: fromLeft ? -48 : WIDTH + 48,
          y: 92,
          dir: fromLeft ? 1 : -1,
          spawnTimer: 14,
          soundTimer: 0,
          hp: this.level >= 3 ? 2 : 1,
        };
      }
    } else {
      this.ufo.x += this.ufo.dir * 165 * dt;
      if (!isAttract) {
        this.ufo.soundTimer -= dt;
        if (this.ufo.soundTimer <= 0) {
          this.ufo.soundTimer = 0.14;
          arcadeAudio.playUfoPing(true);
        }
      }
      if (this.ufo.x < -64 || this.ufo.x > WIDTH + 64) {
        this.ufo.active = false;
        this.ufo.spawnTimer = 13 + Math.random() * 5;
      }
    }
  }

  private triggerPlayerHit(): void {
    arcadeAudio.playInvaderExplosion('player');
    this.spawn16BitExplosion(this.playerX, this.playerY, this.getTheme().accent, 'player');
    this.enemyShots = [];
    this.playerShots = [];
    this.hyperBeamTimer = 0;
    this.weaponMode = 'standard';
    this.weaponTimer = 0;
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
    this.invulnTimer = 1.9;
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
    const theme = this.getTheme();

    ctx.save();
    ctx.translate(sx, sy);

    this.drawParodyBackdrop(ctx, theme);
    this.drawFloorAndHyperBar(ctx, theme);
    this.drawBunkers(ctx, theme);

    if (this.ufo.active) this.drawThemeUfo(ctx, theme);

    // Invader formation with authentic reveal & 16-bit shaded sprites!
    const maxVisibleRow = Math.floor(this.rackRevealProgress * 5.2);
    for (const inv of this.invaders) {
      if (!inv.alive) continue;
      if (this.phase === 'READY' && 4 - inv.row > maxVisibleRow) continue;
      const { rx, ry } = this.getInvaderRenderPos(inv);
      this.draw16BitInvader(ctx, inv, rx, ry, theme);
    }

    this.drawCapsules(ctx);
    this.drawEnemyShots(ctx);
    this.drawPlayerShots(ctx);
    if (this.hyperBeamTimer > 0) this.drawHyperBeam(ctx);

    if (this.playerDyingTimer > 0) {
      this.drawPlayerDisintegration(ctx, theme);
    } else if (this.phase !== 'GAME_OVER') {
      const blink = this.invulnTimer > 0 && Math.floor(this.time * 16) % 2 === 0;
      if (!blink) this.drawThemePlayerShip(ctx, theme);
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
      const boxH = this.bannerSub ? 86 : 62;
      const boxY = HEIGHT * 0.42;
      ctx.fillStyle = 'rgba(4, 7, 22, 0.92)';
      ctx.beginPath();
      ctx.roundRect(WIDTH * 0.14, boxY, WIDTH * 0.72, boxH, 12);
      ctx.fill();
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 2.6;
      ctx.stroke();

      ctx.font = '800 28px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = theme.accent;
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(this.bannerText, WIDTH * 0.5, boxY + 31);

      if (this.bannerSub) {
        ctx.shadowBlur = 8;
        ctx.font = '700 14px "Outfit", sans-serif';
        ctx.fillStyle = '#FEF08A';
        ctx.fillText(this.bannerSub, WIDTH * 0.5, boxY + 62);
      }
      ctx.restore();
    }

    if (visualMode === 'crt') renderCrtOverlay(ctx, WIDTH, HEIGHT);
  }

  private drawParodyBackdrop(ctx: CanvasRenderingContext2D, theme: ParodyTheme): void {
    const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    bg.addColorStop(0, theme.skyTop);
    bg.addColorStop(0.55, theme.skyMid);
    bg.addColorStop(1, theme.skyBot);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // 16-bit Parallax Starfield / Ambient Motes
    for (let i = 0; i < 82; i++) {
      const sx = (i * 227 + 31) % WIDTH;
      const sy = ((i * 353 + this.time * (8 + (i % 4) * 6)) % (HEIGHT - 120)) + 16;
      const alpha = 0.16 + 0.32 * (0.5 + 0.5 * Math.sin(this.time * 3 + i));
      ctx.fillStyle = i % 5 === 0 ? theme.accent : '#FFFFFF';
      ctx.globalAlpha = alpha;
      const sz = i % 6 === 0 ? 2.6 : 1.6;
      ctx.fillRect(sx, sy, sz, sz);
    }
    ctx.globalAlpha = 1;

    // World-Specific 16-Bit Parallax Horizon Artwork!
    ctx.save();
    if (theme.id === 'dx94') {
      // Glowing sunlit blue Earth limb curving across the bottom space horizon!
      const earthGrad = ctx.createRadialGradient(WIDTH * 0.5, HEIGHT + 340, 380, WIDTH * 0.5, HEIGHT + 340, 560);
      earthGrad.addColorStop(0, 'rgba(56, 189, 248, 0.34)');
      earthGrad.addColorStop(0.6, 'rgba(37, 99, 235, 0.16)');
      earthGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = earthGrad;
      ctx.fillRect(0, HEIGHT - 280, WIDTH, 280);
      ctx.strokeStyle = `rgba(125, 211, 252, ${0.28 + this.bassPulse * 0.18})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(WIDTH * 0.5, HEIGHT + 345, 510, Math.PI * 1.18, Math.PI * 1.82);
      ctx.stroke();
    } else if (theme.id === 'arkanoid') {
      // Perspective glowing Arkanoid Mothership hexagon grid!
      ctx.strokeStyle = `rgba(96, 165, 250, ${0.12 + this.bassPulse * 0.08})`;
      ctx.lineWidth = 1.2;
      const offset = (this.time * 24) % 44;
      for (let y = 80; y < FLOOR_Y; y += 44) {
        ctx.beginPath();
        ctx.moveTo(20, y + offset * 0.5);
        ctx.lineTo(WIDTH - 20, y + offset * 0.5);
        ctx.stroke();
      }
      for (let x = 40; x < WIDTH; x += 68) {
        ctx.beginPath();
        ctx.moveTo(x, 60);
        ctx.lineTo(x, FLOOR_Y);
        ctx.stroke();
      }
    } else if (theme.id === 'darius') {
      // Deep-space cosmic ocean horizon waves & glowing coral spires!
      ctx.fillStyle = `rgba(6, 182, 212, ${0.09 + this.bassPulse * 0.07})`;
      ctx.beginPath();
      ctx.moveTo(0, FLOOR_Y);
      for (let x = 0; x <= WIDTH; x += 28) {
        const wy = FLOOR_Y - 95 + Math.sin(x * 0.018 + this.time * 1.8) * 18 + Math.cos(x * 0.045) * 10;
        ctx.lineTo(x, wy);
      }
      ctx.lineTo(WIDTH, FLOOR_Y);
      ctx.closePath();
      ctx.fill();
    } else if (theme.id === 'bubble') {
      // Floating iridescent Bubble Bobble background bubbles!
      for (let i = 0; i < 14; i++) {
        const bx = ((i * 113 + Math.sin(this.time * 0.8 + i) * 30) % (WIDTH - 60)) + 30;
        const by = HEIGHT - (((this.time * (24 + (i % 3) * 10) + i * 71) % (HEIGHT - 80)) + 40);
        const r = 10 + (i % 4) * 5;
        ctx.strokeStyle = i % 2 === 0 ? 'rgba(244, 114, 182, 0.22)' : 'rgba(56, 189, 248, 0.22)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(bx, by, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.beginPath();
        ctx.arc(bx - r * 0.35, by - r * 0.35, r * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Neo-Tokyo Cyber-Citadel skyline + sweeping magenta/gold searchlights!
      const sunGrad = ctx.createRadialGradient(WIDTH * 0.5, FLOOR_Y - 120, 20, WIDTH * 0.5, FLOOR_Y - 120, 180);
      sunGrad.addColorStop(0, 'rgba(250, 204, 21, 0.24)');
      sunGrad.addColorStop(0.6, 'rgba(244, 63, 94, 0.14)');
      sunGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = sunGrad;
      ctx.fillRect(0, FLOOR_Y - 300, WIDTH, 300);
      ctx.fillStyle = 'rgba(15, 10, 35, 0.65)';
      ctx.strokeStyle = `rgba(250, 204, 21, ${0.18 + this.bassPulse * 0.12})`;
      for (let i = 0; i < 12; i++) {
        const bw = 54;
        const bx = 24 + i * 66;
        const bh = 70 + ((i * 47) % 85);
        ctx.fillRect(bx, FLOOR_Y - bh, bw, bh);
        ctx.strokeRect(bx, FLOOR_Y - bh, bw, bh);
      }
    }
    ctx.restore();

    // Top Stage Theme Marquee Strip
    ctx.save();
    ctx.fillStyle = 'rgba(2, 6, 18, 0.72)';
    ctx.fillRect(0, 0, WIDTH, CEILING_Y - 4);
    ctx.fillStyle = theme.accent;
    ctx.fillRect(24, CEILING_Y - 5, WIDTH - 48, 2);
    ctx.font = '800 13px "Outfit", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#F8FAFC';
    ctx.fillText(theme.title, 28, 32);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#FEF08A';
    const wText =
      this.weaponMode === 'standard'
        ? 'WEAPON: DX PLASMA'
        : `WEAPON: ${this.weaponMode.toUpperCase()} (${Math.ceil(this.weaponTimer)}s)`;
    ctx.fillText(wText, WIDTH - 28, 32);
    ctx.restore();
  }

  private drawFloorAndHyperBar(ctx: CanvasRenderingContext2D, theme: ParodyTheme): void {
    ctx.save();
    ctx.shadowColor = theme.accent;
    ctx.shadowBlur = 12;
    ctx.fillStyle = theme.accent;
    ctx.fillRect(24, FLOOR_Y, WIDTH - 48, 3.5);
    ctx.restore();

    // Bottom integrated 16-bit DX Hyper Beam Gauge!
    const barW = 240;
    const barH = 12;
    const barX = WIDTH * 0.5 - barW * 0.5;
    const barY = FLOOR_Y + 15;
    const ready = this.hyperCharge >= 100;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 6);
    ctx.fill();
    ctx.strokeStyle = ready ? '#FEF08A' : 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = ready ? 2 : 1.2;
    ctx.stroke();

    const fillW = (barW - 4) * (this.hyperCharge / 100);
    if (fillW > 1) {
      const g = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      g.addColorStop(0, '#38BDF8');
      g.addColorStop(0.5, '#F472B6');
      g.addColorStop(1, '#FACC15');
      ctx.fillStyle = g;
      if (ready) {
        ctx.shadowColor = '#FEF08A';
        ctx.shadowBlur = 12;
      }
      ctx.beginPath();
      ctx.roundRect(barX + 2, barY + 2, fillW, barH - 4, 4);
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    ctx.font = '800 11px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = ready && Math.floor(this.time * 10) % 2 === 0 ? '#FEF08A' : '#CBD5E1';
    ctx.fillText(ready ? '★ PRESS SHIFT / X FOR DX HYPER BEAM! ★' : `DX HYPER CHARGE ${Math.floor(this.hyperCharge)}%`, WIDTH * 0.5, barY + 24);
    ctx.restore();
  }

  private drawBunkers(ctx: CanvasRenderingContext2D, theme: ParodyTheme): void {
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

    const repaired = this.repairGlowTimer > 0;
    flush(midCells, repaired ? '#86EFAC' : theme.bunkerMid);
    flush(botCells, repaired ? '#4ADE80' : theme.bunkerBot);
    flush(topCells, repaired ? '#DCFCE7' : theme.bunkerTop);
    flush(warmCells, '#FB923C');
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

  private draw16BitInvader(ctx: CanvasRenderingContext2D, inv: DxInvader, rx: number, ry: number, theme: ParodyTheme): void {
    const bob = Math.sin(this.time * 5 + inv.col * 0.6 + inv.row) * 1.8;
    const f = inv.animFrame;
    const baseCol = inv.hitFlash > 0.2 || inv.fireFlash > 0.25 ? '#FFFFFF' : inv.color;

    ctx.save();
    ctx.translate(rx, ry + bob);

    // Special glowing aura for Power-Up Carrier invaders (2-pass glow, zero shadowBlur!)
    if (inv.powerCarrier) {
      const r = 19 + Math.sin(this.time * 12) * 2;
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.35)';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    // 16-bit shaded multi-part sprites tailored to each Parody Theme!
    if (theme.id === 'bubble') {
      // Bubble Bobble Parody: Cute shaded Mighta/Zen-Chan/Monsta silhouettes!
      const grad = ctx.createRadialGradient(-4, -5, 2, 0, 0, 16);
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(0.35, baseCol);
      grad.addColorStop(1, '#311042');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, inv.tier === 'top' ? 13 : 14.5, 0, Math.PI * 2);
      ctx.fill();
      // Cute bouncy feet / ears
      ctx.fillStyle = '#FEF08A';
      const foot = f === 0 ? -3 : 3;
      ctx.beginPath();
      ctx.arc(-7, 12 + foot * 0.4, 4, 0, Math.PI * 2);
      ctx.arc(7, 12 - foot * 0.4, 4, 0, Math.PI * 2);
      ctx.fill();
      // Expressive anime eyes
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(-4.5, -2, 3.2, 4, 0, 0, Math.PI * 2);
      ctx.ellipse(4.5, -2, 3.2, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(-4, -1.5, 1.8, 0, Math.PI * 2);
      ctx.arc(5, -1.5, 1.8, 0, Math.PI * 2);
      ctx.fill();
    } else if (theme.id === 'darius') {
      // Darius Parody: Metallic bio-mecha fish/nautilus invaders!
      const grad = ctx.createLinearGradient(0, -14, 0, 14);
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(0.35, baseCol);
      grad.addColorStop(1, '#0F172A');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.lineTo(16, -2);
      ctx.lineTo(11, 10);
      ctx.lineTo(0, 14);
      ctx.lineTo(-11, 10);
      ctx.lineTo(-16, -2);
      ctx.closePath();
      ctx.fill();
      // Articulated mecha fins
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 2.4;
      const finY = f === 0 ? -7 : 5;
      ctx.beginPath();
      ctx.moveTo(-15, 0);
      ctx.lineTo(-21, finY);
      ctx.moveTo(15, 0);
      ctx.lineTo(21, finY);
      ctx.stroke();
      // Glowing cybernetic visor eye
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(-7, -4, 14, 4);
    } else if (theme.id === 'arkanoid') {
      // Arkanoid Parody: Shaded metallic prism-bricks & geometric drones!
      const grad = ctx.createLinearGradient(-15, -12, 15, 12);
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(0.35, baseCol);
      grad.addColorStop(1, '#1E1B4B');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(-16, -11, 32, 22, 5);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      // Rotating glowing prism diamond core
      ctx.fillStyle = f === 0 ? '#FFFFFF' : '#FEF08A';
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(7, 0);
      ctx.lineTo(0, 7);
      ctx.lineTo(-7, 0);
      ctx.closePath();
      ctx.fill();
    } else {
      // '94 DX & Cyber-Citadel: 16-bit Metallic Shaded Armored Space Invaders!
      const grad = ctx.createLinearGradient(0, -14, 0, 14);
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(0.32, baseCol);
      grad.addColorStop(1, '#0F172A');
      ctx.fillStyle = grad;

      if (inv.tier === 'top') {
        // Armored 16-bit Squid Commander
        ctx.beginPath();
        ctx.moveTo(0, -15);
        ctx.lineTo(13, -4);
        ctx.lineTo(15, 5);
        ctx.lineTo(7, 8);
        ctx.lineTo(-7, 8);
        ctx.lineTo(-15, 5);
        ctx.lineTo(-13, -4);
        ctx.closePath();
        ctx.fill();
        // Articulated tentacles
        ctx.strokeStyle = baseCol;
        ctx.lineWidth = 3;
        const spread = f === 0 ? 4 : -2;
        ctx.beginPath();
        ctx.moveTo(-9, 7);
        ctx.lineTo(-12 - spread, 15);
        ctx.moveTo(0, 8);
        ctx.lineTo(0, 15);
        ctx.moveTo(9, 7);
        ctx.lineTo(12 + spread, 15);
        ctx.stroke();
      } else if (inv.tier === 'mid') {
        // Armored 16-bit Crab Walker
        ctx.beginPath();
        ctx.roundRect(-14, -9, 28, 16, 6);
        ctx.fill();
        ctx.strokeStyle = baseCol;
        ctx.lineWidth = 3.2;
        const clawY = f === 0 ? -13 : 9;
        ctx.beginPath();
        ctx.moveTo(-14, 0);
        ctx.lineTo(-19, clawY);
        ctx.moveTo(14, 0);
        ctx.lineTo(19, clawY);
        ctx.moveTo(-7, 7);
        ctx.lineTo(-10, 14);
        ctx.moveTo(7, 7);
        ctx.lineTo(10, 14);
        ctx.stroke();
      } else {
        // Armored 16-bit Heavy Octopus
        ctx.beginPath();
        ctx.arc(0, -2, 13, Math.PI, 0);
        ctx.lineTo(16, 7);
        ctx.lineTo(-16, 7);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = baseCol;
        ctx.lineWidth = 3.2;
        const leg = f === 0 ? 4 : -3;
        ctx.beginPath();
        ctx.moveTo(-11, 7);
        ctx.lineTo(-14 - leg, 14);
        ctx.moveTo(-4, 7);
        ctx.lineTo(-4, 14);
        ctx.moveTo(4, 7);
        ctx.lineTo(4, 14);
        ctx.moveTo(11, 7);
        ctx.lineTo(14 + leg, 14);
        ctx.stroke();
      }

      // Glowing visor eyes
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(-9, -4, 6, 4.5);
      ctx.fillRect(3, -4, 6, 4.5);
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(-7.5, -2.8, 3, 2.5);
      ctx.fillRect(4.5, -2.8, 3, 2.5);
    }

    // Golden 2-HP Armor Crown indicator on Wave 2+ top-row Commanders!
    if (inv.hp > 1) {
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, -2, 17, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawThemeUfo(ctx: CanvasRenderingContext2D, theme: ParodyTheme): void {
    const x = this.ufo.x;
    const y = this.ufo.y;
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = theme.ufoColor;
    ctx.shadowBlur = 18;

    // 16-bit shaded Boss UFO craft
    const grad = ctx.createLinearGradient(0, -16, 0, 14);
    grad.addColorStop(0, '#FFFFFF');
    grad.addColorStop(0.35, theme.ufoColor);
    grad.addColorStop(1, '#1E1B4B');
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.ellipse(0, 2, 34, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -2, 16, Math.PI, 0);
    ctx.fill();

    // Glowing cockpit visor / emblem
    ctx.fillStyle = '#FEF08A';
    const activeIdx = Math.floor(this.time * 16) % 5;
    for (let i = -2; i <= 2; i++) {
      ctx.fillStyle = i + 2 === activeIdx ? '#FFFFFF' : '#FEF08A';
      ctx.beginPath();
      ctx.arc(i * 11, 2, i + 2 === activeIdx ? 3.2 : 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawCapsules(ctx: CanvasRenderingContext2D): void {
    for (const cap of this.capsules) {
      const col =
        cap.kind === 'T'
          ? '#38BDF8'
          : cap.kind === 'S'
          ? '#F472B6'
          : cap.kind === 'P'
          ? '#FACC15'
          : cap.kind === 'B'
          ? '#4ADE80'
          : '#A855F7';
      ctx.save();
      ctx.translate(cap.x, cap.y);
      ctx.shadowColor = col;
      ctx.shadowBlur = 14;
      const g = ctx.createLinearGradient(0, -10, 0, 10);
      g.addColorStop(0, '#FFFFFF');
      g.addColorStop(0.35, col);
      g.addColorStop(1, '#0F172A');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(-16, -10, 32, 20, 10);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.font = '900 13px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#0F172A';
      ctx.fillText(cap.kind, 0, 1);
      ctx.restore();
    }
  }

  private drawEnemyShots(ctx: CanvasRenderingContext2D): void {
    ctx.lineCap = 'round';
    for (const s of this.enemyShots) {
      const boltColor = s.kind === 'lightning' ? '#F472B6' : s.kind === 'cross' ? '#38BDF8' : '#FACC15';
      const zig = Math.sin(s.phase) * 5;
      ctx.beginPath();
      ctx.moveTo(s.x - zig, s.y - 11);
      ctx.lineTo(s.x + zig, s.y - 3);
      ctx.lineTo(s.x - zig, s.y + 4);
      ctx.lineTo(s.x + zig, s.y + 11);
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

  private drawPlayerShots(ctx: CanvasRenderingContext2D): void {
    for (const sh of this.playerShots) {
      const w = sh.pierce ? 7.5 : 5.4;
      const h = sh.pierce ? 32 : 24;
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = sh.color;
      ctx.fillRect(sh.x - w, sh.y - h * 0.55, w * 2, h * 1.1);
      ctx.globalAlpha = 1;
      ctx.fillRect(sh.x - w * 0.5, sh.y - h * 0.5, w, h);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(sh.x - 1.4, sh.y - h * 0.45, 2.8, h * 0.65);
    }
  }

  private drawHyperBeam(ctx: CanvasRenderingContext2D): void {
    const pulse = 0.78 + 0.22 * Math.sin(this.time * 48);
    const beamW = 54 * pulse * Math.min(1, this.hyperBeamTimer * 3.5);
    const x = this.hyperBeamX;
    ctx.save();
    const outerGrad = ctx.createLinearGradient(x - beamW, 0, x + beamW, 0);
    outerGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
    outerGrad.addColorStop(0.25, 'rgba(244, 114, 182, 0.65)');
    outerGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.98)');
    outerGrad.addColorStop(0.75, 'rgba(250, 204, 21, 0.65)');
    outerGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = outerGrad;
    ctx.fillRect(x - beamW, CEILING_Y, beamW * 2, this.playerY - CEILING_Y - 12);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x - beamW * 0.22, CEILING_Y, beamW * 0.44, this.playerY - CEILING_Y - 12);
    drawStarGlint(ctx, x, this.playerY - 18, 26 * pulse, '#FEF08A', this.time * 20);
    ctx.restore();
  }

  private drawThemePlayerShip(ctx: CanvasRenderingContext2D, theme: ParodyTheme): void {
    ctx.save();
    ctx.translate(this.playerX, this.playerY + this.cannonRecoil * 0.65);

    // Dual plasma engine plumes
    ctx.save();
    const flame = 8 + Math.sin(this.time * 48) * 3;
    ctx.fillStyle = theme.accent;
    ctx.shadowColor = theme.accent;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(-12, 13);
    ctx.lineTo(-8, 13 + flame);
    ctx.lineTo(-4, 13);
    ctx.moveTo(4, 13);
    ctx.lineTo(8, 13 + flame);
    ctx.lineTo(12, 13);
    ctx.fill();
    ctx.restore();

    ctx.shadowColor = theme.accent;
    ctx.shadowBlur = 16;

    const grad = ctx.createLinearGradient(0, -22, 0, 14);
    grad.addColorStop(0, '#FFFFFF');
    grad.addColorStop(0.4, theme.accent);
    grad.addColorStop(1, '#0F172A');
    ctx.fillStyle = grad;

    if (theme.id === 'arkanoid') {
      // Sleek Vaus Paddle-Starfighter!
      ctx.beginPath();
      ctx.roundRect(-29, 0, 58, 13, 6.5);
      ctx.fill();
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(-26, 2, 8, 9);
      ctx.fillRect(18, 2, 8, 9);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-4, -14 + this.cannonRecoil * 0.4, 8, 15);
    } else if (theme.id === 'darius') {
      // Silver Hawk Delta Wing Fighter!
      ctx.beginPath();
      ctx.moveTo(0, -24 + this.cannonRecoil * 0.4);
      ctx.lineTo(28, 12);
      ctx.lineTo(10, 8);
      ctx.lineTo(0, 14);
      ctx.lineTo(-10, 8);
      ctx.lineTo(-28, 12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.ellipse(0, -4, 4.5, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // 16-Bit Evolved Space Invaders DX Heavy Twin-Ion Base!
      ctx.beginPath();
      ctx.roundRect(-27, 1, 54, 14, [4, 4, 2, 2]);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(-18, -7, 36, 9, [4, 4, 0, 0]);
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.roundRect(-4.5, -21 + this.cannonRecoil * 0.45, 9, 15, [2.5, 2.5, 0, 0]);
      ctx.fill();
      // Wingtip pods for Twin/Spread visual feedback
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-20, -11, 4, 6);
      ctx.fillRect(16, -11, 4, 6);
    }

    if (this.muzzleFlash > 0.05) {
      ctx.globalAlpha = this.muzzleFlash;
      drawStarGlint(ctx, 0, -23, 14 * this.muzzleFlash + 4, '#FEF08A', this.time * 18);
    }

    ctx.restore();
  }

  private drawPlayerDisintegration(ctx: CanvasRenderingContext2D, theme: ParodyTheme): void {
    const t = this.playerDyingTimer / 0.85;
    ctx.save();
    ctx.translate(this.playerX, this.playerY);
    ctx.globalAlpha = Math.max(0.15, t);
    drawStarGlint(ctx, 0, 0, 26 * t + 8, '#FEF08A', this.time * 16);
    drawStarGlint(ctx, 0, 0, 18 * t + 4, theme.accent, -this.time * 12);
    ctx.restore();
  }

  private drawVfxLayers(ctx: CanvasRenderingContext2D): void {
    // 1. Multi-layered 16-bit volumetric fireballs
    for (const f of this.fireballs) {
      const a = Math.max(0, f.life / f.maxLife);
      ctx.save();
      const grad = ctx.createRadialGradient(f.x, f.y, 1, f.x, f.y, f.radius);
      grad.addColorStop(0, `rgba(255, 255, 255, ${a})`);
      grad.addColorStop(0.45, f.color);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.globalAlpha = a * 0.9;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 2. Expanding shockwave rings (2-pass glow, zero shadowBlur!)
    for (const sw of this.shockwaves) {
      const a = Math.max(0, sw.life / sw.maxLife);
      ctx.strokeStyle = sw.color;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.globalAlpha = a * 0.3;
      ctx.lineWidth = sw.lineWidth * a * 2.4;
      ctx.stroke();
      ctx.globalAlpha = a * 0.9;
      ctx.lineWidth = sw.lineWidth * a;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 3. Tumbling shaded armor plates (zero shadowBlur!)
    for (const d of this.debris) {
      const a = Math.max(0, d.life / d.maxLife);
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      ctx.globalAlpha = a;
      ctx.fillStyle = d.color;
      ctx.fillRect(-d.w * 0.5, -d.h * 0.5, d.w, d.h);
      ctx.restore();
    }
  }
}

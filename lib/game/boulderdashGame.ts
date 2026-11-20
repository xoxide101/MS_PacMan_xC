import { drawStarGlint } from './arcadeGfx';
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

// ============================================================================
// BOULDER DASH 2.5D — MODERN SUBTERRANEAN CAVERN ENGINE
// Faithful 1984 First Star Software cellular physics + buttery 60fps
// sub-tile interpolation, 2.5D extruded blocks, dynamic headlamp & crystal
// lighting, Magic Walls, Growing Amoeba, Fireflies, Butterflies & 8 Biomes.
// ============================================================================

const VIEW_W = 1152;
const VIEW_H = 720;
const HUD_H = 54;
const PLAY_H = VIEW_H - HUD_H;
const TILE = 48;
const DEPTH = 9; // 2.5D vertical extrusion lip
const CAVE_COLS = 32;
const CAVE_ROWS = 22;
const STORAGE_KEY = 'boulderdash_hd_highscore_v1';

const PHYSICS_STEP = 0.132; // Authentic ~7.6 ticks/sec cellular cadence
const PLAYER_STEP = 0.122; // Responsive ~8.2 tiles/sec miner pace

// Cell types
const EMPTY = 0;
const DIRT = 1;
const STEEL = 2;
const WALL = 3;
const BOULDER = 4;
const DIAMOND = 5;
const PLAYER = 6;
const EXIT_CLOSED = 7;
const EXIT_OPEN = 8;
const FIREFLY = 9;
const BUTTERFLY = 10;
const MAGIC_WALL = 11;
const AMOEBA = 12;

interface CaveBiome {
  name: string;
  subtitle: string;
  quota: number;
  timeLimit: number;
  bgDeep: string;
  bgCaveWall: string;
  dirtTop: string;
  dirtFace: string;
  dirtHighlight: string;
  wallTop: string;
  wallFace: string;
  wallMortar: string;
  diamondMain: string;
  diamondGlow: string;
  magicColor: string;
  seed: number;
  boulders: number;
  diamonds: number;
  fireflies: number;
  butterflies: number;
  hasMagicWall: boolean;
  hasAmoeba: boolean;
}

const CAVES: CaveBiome[] = [
  {
    name: 'Cave A · Sunstone Caverns',
    subtitle: 'Gather 10 Sapphire Diamonds & unlock the Portal',
    quota: 10,
    timeLimit: 130,
    bgDeep: '#090B12',
    bgCaveWall: '#17131A',
    dirtTop: '#9A5B2A',
    dirtFace: '#5B3112',
    dirtHighlight: '#C9854B',
    wallTop: '#7B8AA1',
    wallFace: '#3E4B5E',
    wallMortar: '#1E2533',
    diamondMain: '#38BDF8',
    diamondGlow: '#7DD3FC',
    magicColor: '#A855F7',
    seed: 101,
    boulders: 64,
    diamonds: 18,
    fireflies: 2,
    butterflies: 0,
    hasMagicWall: false,
    hasAmoeba: false,
  },
  {
    name: 'Cave B · Amethyst Butterfly Vault',
    subtitle: 'Drop boulders on Butterflies to burst 9 Diamonds!',
    quota: 14,
    timeLimit: 140,
    bgDeep: '#0B0816',
    bgCaveWall: '#19112B',
    dirtTop: '#7E4A9E',
    dirtFace: '#4A2463',
    dirtHighlight: '#B07AD4',
    wallTop: '#9333EA',
    wallFace: '#581C87',
    wallMortar: '#260E42',
    diamondMain: '#F472B6',
    diamondGlow: '#FBCFE8',
    magicColor: '#38BDF8',
    seed: 202,
    boulders: 72,
    diamonds: 10,
    fireflies: 2,
    butterflies: 3,
    hasMagicWall: false,
    hasAmoeba: false,
  },
  {
    name: 'Cave C · Magic Wall Foundry',
    subtitle: 'Drop boulders through the shimmering Magic Wall into Gems!',
    quota: 16,
    timeLimit: 145,
    bgDeep: '#071112',
    bgCaveWall: '#0F2224',
    dirtTop: '#2E7D6F',
    dirtFace: '#164A42',
    dirtHighlight: '#55B3A2',
    wallTop: '#14B8A6',
    wallFace: '#0F766E',
    wallMortar: '#072E2C',
    diamondMain: '#FACC15',
    diamondGlow: '#FEF08A',
    magicColor: '#C084FC',
    seed: 303,
    boulders: 78,
    diamonds: 12,
    fireflies: 2,
    butterflies: 2,
    hasMagicWall: true,
    hasAmoeba: false,
  },
  {
    name: 'Cave D · Emerald Amoeba Pit',
    subtitle: 'Trap the growing Green Amoeba to crystallize it into Diamonds!',
    quota: 18,
    timeLimit: 150,
    bgDeep: '#0B100A',
    bgCaveWall: '#172115',
    dirtTop: '#8C6239',
    dirtFace: '#4F341A',
    dirtHighlight: '#BD8F5E',
    wallTop: '#65A30D',
    wallFace: '#3F6212',
    wallMortar: '#1C2E08',
    diamondMain: '#4ADE80',
    diamondGlow: '#BBF7D0',
    magicColor: '#22D3EE',
    seed: 404,
    boulders: 76,
    diamonds: 14,
    fireflies: 3,
    butterflies: 2,
    hasMagicWall: false,
    hasAmoeba: true,
  },
  {
    name: 'Cave E · Glacial Avalanche Shaft',
    subtitle: 'Trigger cascading rockfalls through twin Magic Walls',
    quota: 20,
    timeLimit: 150,
    bgDeep: '#070D19',
    bgCaveWall: '#101B33',
    dirtTop: '#3B6496',
    dirtFace: '#1E3A5F',
    dirtHighlight: '#6DA0D9',
    wallTop: '#60A5FA',
    wallFace: '#1D4ED8',
    wallMortar: '#111F47',
    diamondMain: '#22D3EE',
    diamondGlow: '#A5F3FC',
    magicColor: '#F472B6',
    seed: 505,
    boulders: 86,
    diamonds: 16,
    fireflies: 3,
    butterflies: 2,
    hasMagicWall: true,
    hasAmoeba: false,
  },
  {
    name: 'Cave F · Magma Firefly Labyrinth',
    subtitle: 'Outwit patrolling Fireflies & unleash Butterfly treasure bursts',
    quota: 20,
    timeLimit: 155,
    bgDeep: '#14080A',
    bgCaveWall: '#261015',
    dirtTop: '#8F3A47',
    dirtFace: '#521A24',
    dirtHighlight: '#C46271',
    wallTop: '#E11D48',
    wallFace: '#881337',
    wallMortar: '#380816',
    diamondMain: '#FDBA74',
    diamondGlow: '#FEF08A',
    magicColor: '#38BDF8',
    seed: 606,
    boulders: 82,
    diamonds: 18,
    fireflies: 4,
    butterflies: 3,
    hasMagicWall: false,
    hasAmoeba: false,
  },
  {
    name: 'Cave G · Obsidian Core',
    subtitle: 'Master both Magic Walls & Amoeba in the deep basalt core',
    quota: 22,
    timeLimit: 160,
    bgDeep: '#080812',
    bgCaveWall: '#151529',
    dirtTop: '#4F577A',
    dirtFace: '#292E47',
    dirtHighlight: '#7E88B5',
    wallTop: '#818CF8',
    wallFace: '#4338CA',
    wallMortar: '#1E1B4B',
    diamondMain: '#E879F9',
    diamondGlow: '#F5D0FE',
    magicColor: '#FACC15',
    seed: 707,
    boulders: 84,
    diamonds: 15,
    fireflies: 3,
    butterflies: 3,
    hasMagicWall: true,
    hasAmoeba: true,
  },
  {
    name: 'Cave H · Royal Diamond Cascade',
    subtitle: 'The ultimate jewel vault — claim 25 Diamonds to escape!',
    quota: 25,
    timeLimit: 170,
    bgDeep: '#0C0A06',
    bgCaveWall: '#1F1A0F',
    dirtTop: '#967632',
    dirtFace: '#544016',
    dirtHighlight: '#D4B05B',
    wallTop: '#F59E0B',
    wallFace: '#B45309',
    wallMortar: '#451A03',
    diamondMain: '#38BDF8',
    diamondGlow: '#E0F2FE',
    magicColor: '#4ADE80',
    seed: 808,
    boulders: 90,
    diamonds: 18,
    fireflies: 4,
    butterflies: 4,
    hasMagicWall: true,
    hasAmoeba: true,
  },
];

interface CellMotion {
  fromR: number;
  fromC: number;
  rollDir: -1 | 0 | 1;
}

interface ShockRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  life: number;
  maxLife: number;
}

interface FloatingEmber {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  phase: number;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class BoulderDashGame implements ArcadeGameInstance {
  public readonly logicalWidth = VIEW_W;
  public readonly logicalHeight = VIEW_H;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'Snap Dig';

  private phase: ClassicGamePhase = 'TITLE';
  private score = 0;
  private highScore = readHighScore(STORAGE_KEY);
  private level = 1;
  private lives = 3;
  private phaseTimer = 0;
  private time = 0;
  private bannerText = '';
  private bannerSub = '';

  private input: ArcadeInputState = createEmptyInput();
  private grid: number[][] = [];
  private falling: boolean[][] = [];
  private enemyDir: number[][] = []; // 0=R, 1=D, 2=L, 3=U
  private cellMotion: Array<Array<CellMotion | null>> = [];
  private cellRot: number[][] = [];

  private playerR = 2;
  private playerC = 2;
  private playerFromR = 2;
  private playerFromC = 2;
  private playerMoveT = 1;
  private facing: -1 | 1 = 1;
  private lookDirX = 1;
  private lookDirY = 0;
  private stridePhase = 0;
  private pushStrain = 0;
  private pushDirC = 0;
  private pickaxeSwing = 0;
  private pickaxeTargetR = 0;
  private pickaxeTargetC = 0;

  private exitR = CAVE_ROWS - 3;
  private exitC = CAVE_COLS - 3;
  private diamondsCollected = 0;
  private diamondQuota = 10;
  private caveTimeLeft = 130;
  private exitFlashTimer = 0;
  private diamondCombo = 0;
  private diamondComboTimer = 0;

  // Magic Wall & Amoeba state
  private magicWallState: 'dormant' | 'active' | 'expired' = 'dormant';
  private magicWallTimer = 0;
  private amoebaTickCounter = 0;
  private amoebaMaxCells = 180;

  private tickAcc = 0;
  private playerMoveAcc = 0;
  private camX = 0;
  private camY = 0;
  private shakeTime = 0;
  private shakeMag = 0;

  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];
  private shockRings: ShockRing[] = [];
  private ambientMotes: FloatingEmber[] = [];

  constructor() {
    this.initAmbientMotes();
    this.buildCave(1);
  }

  private initAmbientMotes(): void {
    this.ambientMotes = Array.from({ length: 38 }, (_, i) => ({
      x: ((i * 197) % (CAVE_COLS * TILE)),
      y: ((i * 131) % (CAVE_ROWS * TILE)),
      vx: ((i % 5) - 2) * 5,
      vy: -4 - (i % 4) * 2.5,
      size: 1.5 + (i % 3) * 0.9,
      alpha: 0.25 + (i % 4) * 0.12,
      phase: i * 0.7,
    }));
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public startNewGame(): void {
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.particles = [];
    this.popups = [];
    this.shockRings = [];
    this.buildCave(1);
    this.phase = 'READY';
    this.phaseTimer = 1.25;
    this.bannerText = CAVES[0].name.toUpperCase();
    this.bannerSub = CAVES[0].subtitle;
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.level = 1;
    this.buildCave(1);
  }

  public restartStage(): void {
    if (this.phase !== 'PLAYING' && this.phase !== 'PAUSED') return;
    this.killPlayer();
  }

  public getHudSnapshot(): ClassicGameHud {
    const cave = CAVES[(this.level - 1) % CAVES.length];
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: cave.name,
      primaryMetricLabel: 'Diamonds',
      primaryMetricValue: `${this.diamondsCollected} / ${this.diamondQuota}`,
      secondaryMetricLabel: 'Time Left',
      secondaryMetricValue: `${Math.ceil(this.caveTimeLeft)}s`,
      bannerText: this.bannerText,
      canRestartStage: true,
    };
  }

  private addShake(mag: number, dur = 0.2): void {
    if (this.phase === 'TITLE') return;
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeTime = Math.max(this.shakeTime, dur);
  }

  private addScore(pts: number, c?: number, r?: number, color = '#38BDF8', label?: string): void {
    if (this.phase === 'TITLE') return;
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(STORAGE_KEY, this.highScore);
    }
    if (c !== undefined && r !== undefined && pts >= 10) {
      this.popups.push({
        x: c * TILE + TILE * 0.5 - this.camX,
        y: HUD_H + r * TILE + TILE * 0.45 - this.camY,
        text: label ?? `+${pts}`,
        color,
        life: 1.0,
        maxLife: 1.0,
      });
    }
  }

  private clearMotionGrid(): void {
    this.cellMotion = Array.from({ length: CAVE_ROWS }, () =>
      Array<CellMotion | null>(CAVE_COLS).fill(null)
    );
  }

  private buildCave(levelNum: number): void {
    const def = CAVES[(levelNum - 1) % CAVES.length];
    const loop = Math.floor((levelNum - 1) / CAVES.length);
    const rand = mulberry32(def.seed + loop * 43);

    this.grid = Array.from({ length: CAVE_ROWS }, (_, r) =>
      Array.from({ length: CAVE_COLS }, (_, c) =>
        r === 0 || r === CAVE_ROWS - 1 || c === 0 || c === CAVE_COLS - 1 ? STEEL : DIRT
      )
    );
    this.falling = Array.from({ length: CAVE_ROWS }, () => Array<boolean>(CAVE_COLS).fill(false));
    this.enemyDir = Array.from({ length: CAVE_ROWS }, () => Array<number>(CAVE_COLS).fill(0));
    this.cellRot = Array.from({ length: CAVE_ROWS }, (_, r) =>
      Array.from({ length: CAVE_COLS }, (_, c) => ((r * 7 + c * 13) % 12) * 0.52)
    );
    this.clearMotionGrid();

    // Carve structural mortared brick ledges
    for (let ledge = 0; ledge < 3; ledge++) {
      const lr = 5 + ledge * 5;
      const startC = 3 + Math.floor(rand() * 9);
      const len = 6 + Math.floor(rand() * 8);
      for (let c = startC; c < Math.min(CAVE_COLS - 3, startC + len); c++) {
        this.grid[lr][c] = WALL;
      }
    }

    // Optional Magic Wall chamber with boulders staged above & clear space below!
    this.magicWallState = 'dormant';
    this.magicWallTimer = 26;
    if (def.hasMagicWall) {
      const mr = 9;
      const mcStart = 11;
      const mcEnd = 19;
      for (let c = mcStart; c <= mcEnd; c++) {
        this.grid[mr][c] = MAGIC_WALL;
        // Ensure drop pocket below Magic Wall so transformed diamonds fall cleanly
        for (let dr = 1; dr <= 3; dr++) {
          if (mr + dr < CAVE_ROWS - 2) this.grid[mr + dr][c] = EMPTY;
        }
        // Stage boulders on top of dirt above the Magic Wall
        if (c % 2 === 1 && mr - 2 >= 2) {
          this.grid[mr - 1][c] = DIRT;
          this.grid[mr - 2][c] = BOULDER;
          if (mr - 3 >= 2) this.grid[mr - 3][c] = BOULDER;
        }
      }
    }

    // Optional Growing Green Amoeba pool in its own walled basin
    this.amoebaTickCounter = 0;
    if (def.hasAmoeba) {
      const ar = 14;
      const ac = 7;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (Math.abs(dr) + Math.abs(dc) <= 1) {
            this.grid[ar + dr][ac + dc] = AMOEBA;
          }
        }
      }
      // Surround partially with brick ledges so the player can seal it off with boulders
      for (let dc = -3; dc <= 3; dc++) {
        if (ar + 2 < CAVE_ROWS - 1 && ac + dc > 1 && ac + dc < CAVE_COLS - 2) {
          this.grid[ar + 2][ac + dc] = WALL;
        }
      }
    }

    // Place Rockford at top-left safe vestibule
    this.playerR = 2;
    this.playerC = 2;
    this.playerFromR = 2;
    this.playerFromC = 2;
    this.playerMoveT = 1;
    this.grid[this.playerR][this.playerC] = PLAYER;
    this.grid[2][3] = DIRT;
    this.grid[3][2] = DIRT;
    this.grid[2][1] = DIRT;
    this.grid[1][2] = DIRT;

    // Place Exit Portal at bottom-right
    this.exitR = CAVE_ROWS - 3;
    this.exitC = CAVE_COLS - 3;
    this.grid[this.exitR][this.exitC] = EXIT_CLOSED;
    // Surround exit with dirt buffer
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        if (this.grid[this.exitR + dr]?.[this.exitC + dc] !== STEEL) {
          this.grid[this.exitR + dr][this.exitC + dc] = DIRT;
        }
      }
    }

    // Place Boulders
    let placed = 0;
    let guard = 0;
    while (placed < def.boulders && guard < 1000) {
      guard++;
      const r = 1 + Math.floor(rand() * (CAVE_ROWS - 3));
      const c = 1 + Math.floor(rand() * (CAVE_COLS - 2));
      if (Math.abs(r - this.playerR) <= 2 && Math.abs(c - this.playerC) <= 2) continue;
      if (Math.abs(r - this.exitR) <= 1 && Math.abs(c - this.exitC) <= 1) continue;
      if (this.grid[r][c] === DIRT) {
        this.grid[r][c] = BOULDER;
        placed++;
      }
    }

    // Place Diamonds
    placed = 0;
    guard = 0;
    while (placed < def.diamonds && guard < 1000) {
      guard++;
      const r = 1 + Math.floor(rand() * (CAVE_ROWS - 2));
      const c = 1 + Math.floor(rand() * (CAVE_COLS - 2));
      if (Math.abs(r - this.playerR) <= 1 && Math.abs(c - this.playerC) <= 1) continue;
      if (this.grid[r][c] === DIRT) {
        this.grid[r][c] = DIAMOND;
        placed++;
      }
    }

    // Carve open enemy chambers (Fireflies & Butterflies with perched boulders above Butterflies!)
    const placeEnemyChamber = (kind: number, count: number) => {
      for (let i = 0; i < count; i++) {
        for (let tries = 0; tries < 60; tries++) {
          const r = 4 + Math.floor(rand() * (CAVE_ROWS - 8));
          const c = 5 + Math.floor(rand() * (CAVE_COLS - 10));
          if (Math.abs(r - this.playerR) < 5 && Math.abs(c - this.playerC) < 6) continue;
          if (Math.abs(r - this.exitR) < 3 && Math.abs(c - this.exitC) < 4) continue;
          if (def.hasMagicWall && Math.abs(r - 10) <= 3 && c >= 9 && c <= 21) continue;
          if (def.hasAmoeba && Math.abs(r - 14) <= 3 && Math.abs(c - 7) <= 4) continue;

          // Carve 3×3 room
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const cur = this.grid[r + dr][c + dc];
              if (cur !== STEEL && cur !== EXIT_CLOSED && cur !== MAGIC_WALL && cur !== AMOEBA) {
                this.grid[r + dr][c + dc] = EMPTY;
              }
            }
          }
          // Stage a harvest boulder above Butterfly chambers!
          if (kind === BUTTERFLY && r - 2 >= 2 && this.grid[r - 2][c] === DIRT) {
            this.grid[r - 2][c] = BOULDER;
            if (this.grid[r - 1][c] === EMPTY) this.grid[r - 1][c] = DIRT;
          }
          this.grid[r][c] = kind;
          this.enemyDir[r][c] = i % 4;
          break;
        }
      }
    };

    placeEnemyChamber(FIREFLY, def.fireflies);
    placeEnemyChamber(BUTTERFLY, def.butterflies);

    this.diamondsCollected = 0;
    this.diamondQuota = def.quota + loop * 2;
    this.caveTimeLeft = Math.max(95, def.timeLimit - loop * 6);
    this.exitFlashTimer = 0;
    this.diamondCombo = 0;
    this.diamondComboTimer = 0;
    this.tickAcc = 0;
    this.playerMoveAcc = 0;
    this.pushStrain = 0;
    this.pickaxeSwing = 0;
    this.centerCameraImmediate();
  }

  private getInterpPlayerPos(): { x: number; y: number } {
    const t = Math.min(1, this.playerMoveT);
    // Smooth ease-out curve for crisp yet fluid motion
    const e = 1 - (1 - t) * (1 - t);
    return {
      x: (this.playerFromC + (this.playerC - this.playerFromC) * e) * TILE + TILE * 0.5,
      y: (this.playerFromR + (this.playerR - this.playerFromR) * e) * TILE + TILE * 0.5,
    };
  }

  private centerCameraImmediate(): void {
    const maxCamX = Math.max(0, CAVE_COLS * TILE - VIEW_W);
    const maxCamY = Math.max(0, CAVE_ROWS * TILE - PLAY_H);
    this.camX = Math.max(0, Math.min(maxCamX, this.playerC * TILE + TILE * 0.5 - VIEW_W * 0.5));
    this.camY = Math.max(0, Math.min(maxCamY, this.playerR * TILE + TILE * 0.5 - PLAY_H * 0.5));
  }

  public step(dt: number): void {
    this.time += dt;
    stepParticlesAndPopups(this.particles, this.popups, dt);

    // Update ambient cavern dust motes
    for (const m of this.ambientMotes) {
      m.x = (m.x + m.vx * dt + CAVE_COLS * TILE) % (CAVE_COLS * TILE);
      m.y = (m.y + m.vy * dt + CAVE_ROWS * TILE) % (CAVE_ROWS * TILE);
    }

    // Update shockwave rings
    for (let i = this.shockRings.length - 1; i >= 0; i--) {
      const sr = this.shockRings[i];
      sr.life -= dt;
      const p = 1 - Math.max(0, sr.life / sr.maxLife);
      sr.radius = sr.maxRadius * (1 - (1 - p) * (1 - p));
      if (sr.life <= 0) this.shockRings.splice(i, 1);
    }

    if (this.exitFlashTimer > 0) this.exitFlashTimer = Math.max(0, this.exitFlashTimer - dt);
    if (this.shakeTime > 0) {
      this.shakeTime = Math.max(0, this.shakeTime - dt);
      if (this.shakeTime === 0) this.shakeMag = 0;
    }
    if (this.pickaxeSwing > 0) this.pickaxeSwing = Math.max(0, this.pickaxeSwing - dt * 5.2);
    if (this.diamondComboTimer > 0) {
      this.diamondComboTimer -= dt;
      if (this.diamondComboTimer <= 0) this.diamondCombo = 0;
    }

    if (this.phase === 'PAUSED' || this.phase === 'GAME_OVER') return;

    if (this.phase === 'READY') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
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
        this.buildCave(this.level);
        this.phase = 'READY';
        this.phaseTimer = 1.25;
        const nextCave = CAVES[(this.level - 1) % CAVES.length];
        this.bannerText = nextCave.name.toUpperCase();
        this.bannerSub = nextCave.subtitle;
      }
      return;
    }

    const isAttract = this.phase === 'TITLE';

    if (!isAttract) {
      this.caveTimeLeft -= dt;
      if (this.caveTimeLeft <= 0) {
        this.killPlayer();
        return;
      }
    }

    // Magic Wall countdown once activated
    if (this.magicWallState === 'active') {
      this.magicWallTimer -= dt;
      if (this.magicWallTimer <= 0) {
        this.magicWallState = 'expired';
      }
    }

    // Advance smooth player sub-tile interpolation
    if (this.playerMoveT < 1) {
      this.playerMoveT = Math.min(1, this.playerMoveT + dt / PLAYER_STEP);
      this.stridePhase += dt * 18;
    }

    // Smooth camera tracking with gentle directional look-ahead
    const pPos = this.getInterpPlayerPos();
    const maxCamX = Math.max(0, CAVE_COLS * TILE - VIEW_W);
    const maxCamY = Math.max(0, CAVE_ROWS * TILE - PLAY_H);
    const targetCamX = Math.max(
      0,
      Math.min(maxCamX, pPos.x + this.lookDirX * 56 - VIEW_W * 0.5)
    );
    const targetCamY = Math.max(
      0,
      Math.min(maxCamY, pPos.y + this.lookDirY * 36 - PLAY_H * 0.5)
    );
    this.camX += (targetCamX - this.camX) * Math.min(1, dt * 7.5);
    this.camY += (targetCamY - this.camY) * Math.min(1, dt * 7.5);

    // Responsive player movement step
    this.playerMoveAcc += dt;
    if (this.playerMoveAcc >= PLAYER_STEP) {
      const moved = this.stepPlayer(isAttract);
      if (moved) {
        this.playerMoveAcc = 0;
      } else {
        this.playerMoveAcc = PLAYER_STEP;
      }
    }

    // Authentic cellular physics cadence
    this.tickAcc += dt;
    if (this.tickAcc >= PHYSICS_STEP) {
      this.tickAcc -= PHYSICS_STEP;
      this.stepPhysics(isAttract);
    }
  }

  private spawnDirtChunks(c: number, r: number, count = 8): void {
    const def = CAVES[(this.level - 1) % CAVES.length];
    const sx = c * TILE + TILE * 0.5 - this.camX;
    const sy = HUD_H + r * TILE + TILE * 0.5 - this.camY;
    spawnBurst(this.particles, sx, sy, def.dirtTop, Math.ceil(count * 0.65), 115, 3.6);
    spawnBurst(this.particles, sx, sy, def.dirtHighlight, Math.floor(count * 0.35), 95, 2.4);
  }

  private stepPlayer(isAttract: boolean): boolean {
    let dr = 0;
    let dc = 0;

    if (isAttract) {
      let targetR = this.exitR;
      let targetC = this.exitC;
      if (this.diamondsCollected < this.diamondQuota) {
        let bestD = Infinity;
        for (let r = 1; r < CAVE_ROWS - 1; r++) {
          for (let c = 1; c < CAVE_COLS - 1; c++) {
            if (this.grid[r][c] === DIAMOND) {
              const d = Math.abs(r - this.playerR) + Math.abs(c - this.playerC);
              if (d < bestD) {
                bestD = d;
                targetR = r;
                targetC = c;
              }
            }
          }
        }
      }
      const options: Array<[number, number]> = [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ];
      let bestOpt: [number, number] | null = null;
      let bestDist = Infinity;
      for (const [odr, odc] of options) {
        const nr = this.playerR + odr;
        const nc = this.playerC + odc;
        const cell = this.grid[nr]?.[nc];
        if (cell === EMPTY || cell === DIRT || cell === DIAMOND || cell === EXIT_OPEN) {
          if (this.grid[nr - 1]?.[nc] === BOULDER && this.falling[nr - 1]?.[nc]) continue;
          const dist = Math.abs(nr - targetR) + Math.abs(nc - targetC) + Math.random() * 0.45;
          if (dist < bestDist) {
            bestDist = dist;
            bestOpt = [odr, odc];
          }
        }
      }
      if (!bestOpt) return false;
      [dr, dc] = bestOpt;
    } else {
      if (this.input.left) dc = -1;
      else if (this.input.right) dc = 1;
      else if (this.input.up) dr = -1;
      else if (this.input.down) dr = 1;
      else {
        this.pushStrain = Math.max(0, this.pushStrain - 0.5);
        return false;
      }
    }

    if (dc !== 0) this.facing = dc < 0 ? -1 : 1;
    this.lookDirX = dc;
    this.lookDirY = dr;

    const nr = this.playerR + dr;
    const nc = this.playerC + dc;
    const target = this.grid[nr]?.[nc];
    if (
      target === undefined ||
      target === STEEL ||
      target === WALL ||
      target === MAGIC_WALL ||
      target === AMOEBA ||
      target === EXIT_CLOSED
    ) {
      this.pushStrain = 0;
      return false;
    }

    // Snap-Dig: hold Space/Z + direction to mine adjacent dirt or grab diamond without stepping!
    if (!isAttract && this.input.fire && (target === DIRT || target === DIAMOND)) {
      this.pickaxeSwing = 1;
      this.pickaxeTargetR = nr;
      this.pickaxeTargetC = nc;
      if (target === DIAMOND) {
        this.collectDiamond(nc, nr, isAttract);
      } else {
        arcadeAudio.playPickaxeDig();
        this.spawnDirtChunks(nc, nr, 10);
      }
      this.grid[nr][nc] = EMPTY;
      this.pushStrain = 0;
      return true;
    }

    // Push boulder horizontally with authentic heavy resistance
    if (target === BOULDER && dr === 0 && !this.falling[nr][nc]) {
      const pushC = nc + dc;
      if (this.grid[nr]?.[pushC] === EMPTY) {
        this.pushDirC = dc;
        this.pushStrain += 1;
        // Brief tactile resistance (1 beat) before boulder rolls smoothly
        if (!isAttract && this.pushStrain < 2) {
          arcadeAudio.playBoulderPush();
          return true;
        }
        this.pushStrain = 0;
        this.grid[nr][pushC] = BOULDER;
        this.cellMotion[nr][pushC] = { fromR: nr, fromC: nc, rollDir: dc as -1 | 1 };
        this.cellRot[nr][pushC] = this.cellRot[nr][nc] + dc * 1.1;

        this.playerFromR = this.playerR;
        this.playerFromC = this.playerC;
        this.playerMoveT = 0;
        this.grid[nr][nc] = PLAYER;
        this.grid[this.playerR][this.playerC] = EMPTY;
        this.playerC = nc;
        if (!isAttract) arcadeAudio.playBoulderRoll();
        return true;
      }
      this.pushStrain = 0;
      return false;
    }

    this.pushStrain = 0;
    if (target === BOULDER) return false;

    if (target === FIREFLY || target === BUTTERFLY) {
      this.explodeAt(nr, nc, target === BUTTERFLY, isAttract);
      return true;
    }

    if (target === DIAMOND) {
      this.collectDiamond(nc, nr, isAttract);
    } else if (target === DIRT) {
      this.spawnDirtChunks(nc, nr, 8);
      if (!isAttract) arcadeAudio.playPickaxeDig();
    }

    if (target === EXIT_OPEN) {
      if (isAttract) {
        this.buildCave(1);
        return true;
      }
      const timeBonus = Math.ceil(this.caveTimeLeft) * 15;
      this.addScore(timeBonus, nc, nr, '#4ADE80', `TIME +${timeBonus}`);
      arcadeAudio.playStageClear();
      this.phase = 'STAGE_CLEAR';
      this.phaseTimer = 1.6;
      this.bannerText = 'CAVE CLEARED!';
      this.bannerSub = `Time Bonus +${timeBonus.toLocaleString()} pts`;
      return true;
    }

    this.playerFromR = this.playerR;
    this.playerFromC = this.playerC;
    this.playerMoveT = 0;
    this.grid[this.playerR][this.playerC] = EMPTY;
    this.playerR = nr;
    this.playerC = nc;
    this.grid[this.playerR][this.playerC] = PLAYER;
    return true;
  }

  private collectDiamond(c: number, r: number, isAttract: boolean): void {
    this.diamondsCollected += 1;
    this.diamondCombo = Math.min(9, this.diamondCombo + 1);
    this.diamondComboTimer = 2.6;
    const extra = this.diamondsCollected > this.diamondQuota;
    const pts = (extra ? 30 : 15) + (this.diamondCombo >= 3 ? this.diamondCombo * 5 : 0);

    if (!isAttract) arcadeAudio.playDiamondChain(this.diamondCombo);
    const def = CAVES[(this.level - 1) % CAVES.length];
    const sx = c * TILE + TILE * 0.5 - this.camX;
    const sy = HUD_H + r * TILE + TILE * 0.5 - this.camY;
    spawnBurst(this.particles, sx, sy, def.diamondMain, 14, 175, 3.6);
    spawnBurst(this.particles, sx, sy, '#FFFFFF', 6, 130, 2.2);
    this.shockRings.push({
      x: c * TILE + TILE * 0.5,
      y: r * TILE + TILE * 0.5,
      radius: 6,
      maxRadius: 42,
      color: def.diamondGlow,
      life: 0.3,
      maxLife: 0.3,
    });

    const label =
      this.diamondCombo >= 3 ? `+${pts} ×${this.diamondCombo}` : extra ? `BONUS +${pts}` : `+${pts}`;
    this.addScore(pts, c, r, extra ? '#FACC15' : def.diamondGlow, label);

    if (this.diamondsCollected === this.diamondQuota) {
      this.grid[this.exitR][this.exitC] = EXIT_OPEN;
      this.exitFlashTimer = 0.45;
      this.addShake(5, 0.28);
      if (!isAttract) arcadeAudio.playKeyUnlock();
      this.shockRings.push({
        x: this.exitC * TILE + TILE * 0.5,
        y: this.exitR * TILE + TILE * 0.5,
        radius: 10,
        maxRadius: 120,
        color: '#4ADE80',
        life: 0.65,
        maxLife: 0.65,
      });
      this.popups.push({
        x: VIEW_W * 0.5,
        y: HUD_H + 88,
        text: 'PORTAL UNLOCKED!',
        color: '#4ADE80',
        life: 1.8,
        maxLife: 1.8,
      });
    }
  }

  private explodeAt(cr: number, cc: number, intoDiamonds: boolean, isAttract: boolean): void {
    if (!isAttract) arcadeAudio.playExplosion(true);
    this.addShake(intoDiamonds ? 7 : 10, 0.32);

    const def = CAVES[(this.level - 1) % CAVES.length];
    const sx = cc * TILE + TILE * 0.5 - this.camX;
    const sy = HUD_H + cr * TILE + TILE * 0.5 - this.camY;
    spawnBurst(this.particles, sx, sy, intoDiamonds ? def.diamondMain : '#FB923C', 32, 260, 5.2);
    spawnBurst(this.particles, sx, sy, '#FEF08A', 16, 180, 3.2);
    this.shockRings.push({
      x: cc * TILE + TILE * 0.5,
      y: cr * TILE + TILE * 0.5,
      radius: 10,
      maxRadius: TILE * 2.4,
      color: intoDiamonds ? def.diamondGlow : '#FB923C',
      life: 0.45,
      maxLife: 0.45,
    });

    let killedPlayer = false;
    for (let r = cr - 1; r <= cr + 1; r++) {
      for (let c = cc - 1; c <= cc + 1; c++) {
        if (r <= 0 || r >= CAVE_ROWS - 1 || c <= 0 || c >= CAVE_COLS - 1) continue;
        if (this.grid[r][c] === STEEL || this.grid[r][c] === EXIT_CLOSED || this.grid[r][c] === EXIT_OPEN) {
          continue;
        }
        if (r === this.playerR && c === this.playerC) killedPlayer = true;
        this.grid[r][c] = intoDiamonds ? DIAMOND : EMPTY;
        this.falling[r][c] = false;
        this.cellMotion[r][c] = null;
      }
    }
    if (intoDiamonds) {
      this.addScore(350, cc, cr, def.diamondGlow, 'BUTTERFLY GEM BURST +350');
    }
    if (killedPlayer) {
      if (isAttract) this.buildCave(1);
      else this.killPlayer();
    }
  }

  private killPlayer(): void {
    arcadeAudio.playDeath();
    this.addShake(11, 0.35);
    this.lives -= 1;
    if (this.lives <= 0) {
      this.phase = 'GAME_OVER';
      this.bannerText = 'GAME OVER';
      this.bannerSub = `Final Score: ${this.score.toLocaleString()}`;
      return;
    }
    this.buildCave(this.level);
    this.phase = 'READY';
    this.phaseTimer = 1.2;
    this.bannerText = 'CAVERN COLLAPSE — TRY AGAIN';
    this.bannerSub = `${this.lives} ${this.lives === 1 ? 'Life' : 'Lives'} Remaining`;
  }

  private isRounded(cell: number): boolean {
    return cell === BOULDER || cell === DIAMOND || cell === WALL;
  }

  private stepPhysics(isAttract: boolean): void {
    const moved = Array.from({ length: CAVE_ROWS }, () => Array<boolean>(CAVE_COLS).fill(false));
    this.clearMotionGrid();

    let landedRockCount = 0;
    let amoebaCells: Array<[number, number]> = [];
    let amoebaGrowTargets: Array<[number, number]> = [];

    // Bottom-to-top scan for authentic falling rock, Magic Wall & rolling diamond physics
    for (let r = CAVE_ROWS - 2; r >= 1; r--) {
      for (let c = 1; c < CAVE_COLS - 1; c++) {
        if (moved[r][c]) continue;
        const cell = this.grid[r][c];

        if (cell === AMOEBA) {
          amoebaCells.push([r, c]);
          const adj: Array<[number, number]> = [
            [r - 1, c],
            [r + 1, c],
            [r, c - 1],
            [r, c + 1],
          ];
          for (const [nr, nc] of adj) {
            const t = this.grid[nr]?.[nc];
            if (t === EMPTY || t === DIRT) {
              amoebaGrowTargets.push([nr, nc]);
            }
          }
          continue;
        }

        if (cell === BOULDER || cell === DIAMOND) {
          const below = this.grid[r + 1][c];
          if (below === EMPTY) {
            this.grid[r + 1][c] = cell;
            this.grid[r][c] = EMPTY;
            this.falling[r + 1][c] = true;
            this.falling[r][c] = false;
            this.cellMotion[r + 1][c] = { fromR: r, fromC: c, rollDir: 0 };
            this.cellRot[r + 1][c] = this.cellRot[r][c];
            moved[r + 1][c] = true;
          } else if (
            this.falling[r][c] &&
            below === MAGIC_WALL &&
            this.magicWallState !== 'expired'
          ) {
            // Authentic Magic Wall transmutation!
            if (this.magicWallState === 'dormant') {
              this.magicWallState = 'active';
              this.magicWallTimer = 26;
            }
            const outRow = r + 2;
            const transmute = cell === BOULDER ? DIAMOND : BOULDER;
            this.grid[r][c] = EMPTY;
            this.falling[r][c] = false;
            if (outRow < CAVE_ROWS - 1 && this.grid[outRow][c] === EMPTY) {
              this.grid[outRow][c] = transmute;
              this.falling[outRow][c] = true;
              this.cellMotion[outRow][c] = { fromR: r + 1, fromC: c, rollDir: 0 };
              moved[outRow][c] = true;
              if (!isAttract) arcadeAudio.playMagicWallHum();
              const def = CAVES[(this.level - 1) % CAVES.length];
              spawnBurst(
                this.particles,
                c * TILE + TILE * 0.5 - this.camX,
                HUD_H + (r + 1) * TILE + TILE * 0.5 - this.camY,
                def.magicColor,
                10,
                140,
                3
              );
            }
          } else if (
            this.falling[r][c] &&
            (below === PLAYER || below === FIREFLY || below === BUTTERFLY)
          ) {
            this.explodeAt(r + 1, c, below === BUTTERFLY, isAttract);
            return;
          } else if (this.isRounded(below)) {
            if (this.grid[r][c - 1] === EMPTY && this.grid[r + 1][c - 1] === EMPTY) {
              this.grid[r][c - 1] = cell;
              this.grid[r][c] = EMPTY;
              this.falling[r][c - 1] = true;
              this.falling[r][c] = false;
              this.cellMotion[r][c - 1] = { fromR: r, fromC: c, rollDir: -1 };
              this.cellRot[r][c - 1] = this.cellRot[r][c] - 1.1;
              moved[r][c - 1] = true;
            } else if (this.grid[r][c + 1] === EMPTY && this.grid[r + 1][c + 1] === EMPTY) {
              this.grid[r][c + 1] = cell;
              this.grid[r][c] = EMPTY;
              this.falling[r][c + 1] = true;
              this.falling[r][c] = false;
              this.cellMotion[r][c + 1] = { fromR: r, fromC: c, rollDir: 1 };
              this.cellRot[r][c + 1] = this.cellRot[r][c] + 1.1;
              moved[r][c + 1] = true;
            } else {
              if (this.falling[r][c]) {
                landedRockCount++;
                if (cell === BOULDER) {
                  spawnBurst(
                    this.particles,
                    c * TILE + TILE * 0.5 - this.camX,
                    HUD_H + (r + 1) * TILE - 4 - this.camY,
                    '#94A3B8',
                    5,
                    75,
                    2.5
                  );
                }
              }
              this.falling[r][c] = false;
            }
          } else {
            if (this.falling[r][c]) {
              landedRockCount++;
              if (cell === BOULDER) {
                spawnBurst(
                  this.particles,
                  c * TILE + TILE * 0.5 - this.camX,
                  HUD_H + (r + 1) * TILE - 4 - this.camY,
                  '#94A3B8',
                  5,
                  75,
                  2.5
                );
              }
            }
            this.falling[r][c] = false;
          }
        } else if (cell === FIREFLY || cell === BUTTERFLY) {
          // Explode if adjacent to Rockford or Amoeba!
          const adjPlayer = Math.abs(r - this.playerR) + Math.abs(c - this.playerC) === 1;
          const adjAmoeba =
            this.grid[r - 1]?.[c] === AMOEBA ||
            this.grid[r + 1]?.[c] === AMOEBA ||
            this.grid[r]?.[c - 1] === AMOEBA ||
            this.grid[r]?.[c + 1] === AMOEBA;
          if (adjPlayer || adjAmoeba) {
            this.explodeAt(r, c, cell === BUTTERFLY, isAttract);
            return;
          }

          // Authentic wall-hugging AI: Firefly hugs left wall; Butterfly hugs right wall
          const d = this.enemyDir[r][c];
          const turnPref =
            cell === FIREFLY
              ? [(d + 3) % 4, d, (d + 1) % 4, (d + 2) % 4]
              : [(d + 1) % 4, d, (d + 3) % 4, (d + 2) % 4];
          const dirs = [
            [0, 1],
            [1, 0],
            [0, -1],
            [-1, 0],
          ];
          for (const nd of turnPref) {
            const nr = r + dirs[nd][0];
            const nc = c + dirs[nd][1];
            if (this.grid[nr]?.[nc] === EMPTY) {
              this.grid[nr][nc] = cell;
              this.grid[r][c] = EMPTY;
              this.enemyDir[nr][nc] = nd;
              this.cellMotion[nr][nc] = { fromR: r, fromC: c, rollDir: 0 };
              moved[nr][nc] = true;
              break;
            }
          }
        }
      }
    }

    if (landedRockCount > 0 && !isAttract) {
      arcadeAudio.playRockThud();
      this.addShake(Math.min(6, 1.8 + landedRockCount * 1.1), 0.14);
    }

    // Authentic Growing Amoeba logic
    if (amoebaCells.length > 0) {
      this.amoebaTickCounter++;
      if (amoebaGrowTargets.length === 0) {
        // Completely enclosed -> turns into Diamonds!
        for (const [ar, ac] of amoebaCells) {
          this.grid[ar][ac] = DIAMOND;
        }
        if (!isAttract) arcadeAudio.playDiamondChain(8);
        this.addScore(500, amoebaCells[0][1], amoebaCells[0][0], '#4ADE80', 'AMOEBA CRYSTALLIZED +500');
      } else if (amoebaCells.length >= this.amoebaMaxCells) {
        // Overgrown -> petrifies into Boulders!
        for (const [ar, ac] of amoebaCells) {
          this.grid[ar][ac] = BOULDER;
        }
        if (!isAttract) arcadeAudio.playRockThud();
      } else if (this.amoebaTickCounter % 7 === 0) {
        const [gr, gc] = amoebaGrowTargets[Math.floor(Math.random() * amoebaGrowTargets.length)];
        this.grid[gr][gc] = AMOEBA;
        if (!isAttract && Math.random() < 0.35) arcadeAudio.playAmoebaBubble();
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const def = CAVES[(this.level - 1) % CAVES.length];
    const physT = Math.min(1, this.tickAcc / PHYSICS_STEP);

    // Full canvas backdrop
    ctx.fillStyle = this.exitFlashTimer > 0 ? '#E0F2FE' : def.bgDeep;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // Clip to playfield below sleek modern top HUD bar
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, HUD_H, VIEW_W, PLAY_H);
    ctx.clip();

    // Subtle parallax cavern backwall behind carved tunnels
    this.renderParallaxCavernBackwall(ctx, def);

    const shakeX = this.shakeTime > 0 ? (Math.random() - 0.5) * this.shakeMag * 2 : 0;
    const shakeY = this.shakeTime > 0 ? (Math.random() - 0.5) * this.shakeMag * 2 : 0;

    ctx.save();
    ctx.translate(
      Math.round(-this.camX + shakeX),
      Math.round(HUD_H - this.camY + shakeY)
    );

    const minC = Math.max(0, Math.floor(this.camX / TILE) - 1);
    const maxC = Math.min(CAVE_COLS - 1, Math.ceil((this.camX + VIEW_W) / TILE) + 1);
    const minR = Math.max(0, Math.floor(this.camY / TILE) - 1);
    const maxR = Math.min(CAVE_ROWS - 1, Math.ceil((this.camY + PLAY_H) / TILE) + 1);

    // Pass 1: Ambient occlusion shadows cast by solid blocks onto open tunnel floor
    ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        if (this.grid[r][c] !== EMPTY) continue;
        const x = c * TILE;
        const y = r * TILE;
        if (r > 0 && this.isSolidBlock(this.grid[r - 1][c])) {
          ctx.fillRect(x, y, TILE, 12);
        }
        if (c > 0 && this.isSolidBlock(this.grid[r][c - 1])) {
          ctx.fillRect(x, y, 8, TILE);
        }
      }
    }

    // Pass 2: Static 2.5D terrain tiles (Steel, Dirt, Brick Wall, Magic Wall, Exit, Amoeba)
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const cell = this.grid[r][c];
        if (cell === EMPTY || cell === BOULDER || cell === DIAMOND || cell === FIREFLY || cell === BUTTERFLY || cell === PLAYER) {
          continue;
        }
        const x = c * TILE;
        const y = r * TILE;
        if (cell === STEEL) this.drawSteelBlock(ctx, x, y);
        else if (cell === DIRT) this.drawDirtBlock(ctx, x, y, r, c, def);
        else if (cell === WALL) this.drawBrickWall(ctx, x, y, def);
        else if (cell === MAGIC_WALL) this.drawMagicWall(ctx, x, y, def);
        else if (cell === AMOEBA) this.drawAmoeba(ctx, x, y, r, c);
        else if (cell === EXIT_CLOSED || cell === EXIT_OPEN) {
          this.drawExitPortal(ctx, x, y, cell === EXIT_OPEN);
        }
      }
    }

    // Pass 3: Smoothly interpolated dynamic entities (Boulders, Diamonds, Enemies, Rockford)
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const cell = this.grid[r][c];
        if (cell !== BOULDER && cell !== DIAMOND && cell !== FIREFLY && cell !== BUTTERFLY) continue;
        const m = this.cellMotion[r]?.[c];
        let drawX = c * TILE + TILE * 0.5;
        let drawY = r * TILE + TILE * 0.5;
        let rot = this.cellRot[r][c];

        if (m) {
          const ease = cell === BOULDER || cell === DIAMOND ? physT : physT;
          drawX = (m.fromC + (c - m.fromC) * ease) * TILE + TILE * 0.5;
          drawY = (m.fromR + (r - m.fromR) * ease) * TILE + TILE * 0.5;
          if (m.rollDir !== 0) {
            rot = this.cellRot[r][c] - m.rollDir * (1 - ease) * 1.1;
          }
        }

        if (cell === BOULDER) {
          this.drawBoulder25D(ctx, drawX, drawY, rot, this.falling[r][c]);
        } else if (cell === DIAMOND) {
          this.drawDiamond25D(ctx, drawX, drawY, r, c, def, this.falling[r][c]);
        } else if (cell === FIREFLY) {
          this.drawFirefly25D(ctx, drawX, drawY, r, c);
        } else if (cell === BUTTERFLY) {
          this.drawButterfly25D(ctx, drawX, drawY, r, c);
        }
      }
    }

    // Rockford (smooth interpolated position + headlamp volumetric cone + pickaxe swing)
    if (this.phase !== 'GAME_OVER') {
      const pPos = this.getInterpPlayerPos();
      this.drawRockford25D(ctx, pPos.x, pPos.y);
    }

    // World-space shockwave rings
    for (const sr of this.shockRings) {
      const alpha = Math.max(0, sr.life / sr.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha * 0.85;
      ctx.strokeStyle = sr.color;
      ctx.lineWidth = 3 * alpha + 1;
      ctx.beginPath();
      ctx.arc(sr.x, sr.y, sr.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Floating subterranean dust motes caught in cavern light
    for (const m of this.ambientMotes) {
      if (m.x < this.camX - 20 || m.x > this.camX + VIEW_W + 20) continue;
      if (m.y < this.camY - 20 || m.y > this.camY + PLAY_H + 20) continue;
      const glow = 0.55 + 0.45 * Math.sin(this.time * 2.4 + m.phase);
      ctx.fillStyle = `rgba(254, 240, 180, ${m.alpha * glow})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore(); // end world transform

    // Soft atmospheric cavern vignette focusing eyes on Rockford's illuminated zone
    const vig = ctx.createRadialGradient(
      VIEW_W * 0.5,
      HUD_H + PLAY_H * 0.5,
      PLAY_H * 0.34,
      VIEW_W * 0.5,
      HUD_H + PLAY_H * 0.5,
      VIEW_W * 0.68
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(3,5,10,0.48)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, HUD_H, VIEW_W, PLAY_H);

    ctx.restore(); // end playfield clip

    // Screen-space particles & popups
    renderParticlesAndPopups(ctx, this.particles, this.popups);

    // Modern top cavern HUD strip
    this.renderTopHud(ctx, def);

    // Ready / Stage Clear banner
    if (this.bannerText && (this.phase === 'READY' || this.phase === 'STAGE_CLEAR')) {
      ctx.save();
      const bw = 620;
      const bh = 96;
      const bx = (VIEW_W - bw) * 0.5;
      const by = HUD_H + (PLAY_H - bh) * 0.46;
      const bg = ctx.createLinearGradient(bx, by, bx, by + bh);
      bg.addColorStop(0, 'rgba(10, 14, 26, 0.94)');
      bg.addColorStop(1, 'rgba(6, 9, 18, 0.92)');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 16);
      ctx.fill();
      ctx.strokeStyle = def.diamondMain;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '800 30px "Outfit", sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(this.bannerText, VIEW_W * 0.5, by + 36);
      if (this.bannerSub) {
        ctx.font = '600 15px "Outfit", sans-serif';
        ctx.fillStyle = def.diamondGlow;
        ctx.fillText(this.bannerSub, VIEW_W * 0.5, by + 68);
      }
      ctx.restore();
    }

    if (visualMode === 'crt') renderCrtOverlay(ctx, VIEW_W, VIEW_H);
  }

  private isSolidBlock(cell: number): boolean {
    return (
      cell === DIRT ||
      cell === STEEL ||
      cell === WALL ||
      cell === MAGIC_WALL ||
      cell === EXIT_CLOSED
    );
  }

  private renderParallaxCavernBackwall(ctx: CanvasRenderingContext2D, def: CaveBiome): void {
    const px = -this.camX * 0.35;
    const py = -this.camY * 0.35;
    ctx.fillStyle = def.bgCaveWall;
    ctx.fillRect(0, HUD_H, VIEW_W, PLAY_H);

    // Layered subterranean geological arches & recessed cavern silhouettes
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    for (let i = 0; i < 12; i++) {
      const rx = ((i * 190 + px) % (VIEW_W + 260)) - 130;
      const ry = HUD_H + ((i * 137 + py) % (PLAY_H + 180)) - 90;
      ctx.beginPath();
      ctx.ellipse(rx, ry, 88 + (i % 3) * 26, 48 + (i % 2) * 22, (i % 5) * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Subtle recessed mineral grid ribs
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.lineWidth = 1.5;
    const step = 64;
    const ox = ((px % step) + step) % step;
    const oy = ((py % step) + step) % step;
    ctx.beginPath();
    for (let x = ox; x < VIEW_W; x += step) {
      ctx.moveTo(x, HUD_H);
      ctx.lineTo(x, VIEW_H);
    }
    for (let y = HUD_H + oy; y < VIEW_H; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(VIEW_W, y);
    }
    ctx.stroke();
  }

  private drawSteelBlock(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    // 2.5D chamfered titanium armor plate
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(x, y, TILE, TILE);

    const faceGrad = ctx.createLinearGradient(x, y, x + TILE, y + TILE);
    faceGrad.addColorStop(0, '#64748B');
    faceGrad.addColorStop(0.5, '#334155');
    faceGrad.addColorStop(1, '#1E293B');
    ctx.fillStyle = faceGrad;
    ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - DEPTH);

    // Lower 2.5D extruded lip
    ctx.fillStyle = '#141D2E';
    ctx.fillRect(x + 1, y + TILE - DEPTH, TILE - 2, DEPTH - 1);

    // Specular bevel edge & corner bolts
    ctx.fillStyle = 'rgba(226, 232, 240, 0.28)';
    ctx.fillRect(x + 2, y + 2, TILE - 4, 2.5);
    ctx.fillStyle = '#CBD5E1';
    const rPts = [
      [7, 7],
      [TILE - 10, 7],
      [7, TILE - DEPTH - 7],
      [TILE - 10, TILE - DEPTH - 7],
    ];
    for (const [rx, ry] of rPts) {
      ctx.beginPath();
      ctx.arc(x + rx + 1.5, y + ry + 1.5, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawDirtBlock(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    c: number,
    def: CaveBiome
  ): void {
    const emptyBelow = r < CAVE_ROWS - 1 && !this.isSolidBlock(this.grid[r + 1][c]);
    const emptyAbove = r > 0 && !this.isSolidBlock(this.grid[r - 1][c]);
    const emptyLeft = c > 0 && !this.isSolidBlock(this.grid[r][c - 1]);
    const emptyRight = c < CAVE_COLS - 1 && !this.isSolidBlock(this.grid[r][c + 1]);

    // Main soil top face
    ctx.fillStyle = def.dirtTop;
    ctx.fillRect(x, y, TILE + 0.5, TILE + 0.5);

    // 2.5D overhanging cliff face when open tunnel lies below
    if (emptyBelow) {
      ctx.fillStyle = def.dirtFace;
      ctx.fillRect(x, y + TILE - DEPTH, TILE + 0.5, DEPTH + 0.5);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.fillRect(x, y + TILE - 2.5, TILE + 0.5, 2.5);
    }

    // Crisp sunlit top bevel when open space lies above
    if (emptyAbove) {
      ctx.fillStyle = def.dirtHighlight;
      ctx.fillRect(x, y, TILE + 0.5, 4);
    }
    if (emptyLeft) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.fillRect(x, y, 3.5, TILE);
    }
    if (emptyRight) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.fillRect(x + TILE - 3.5, y, 3.5, TILE);
    }

    // Layered mineral pebbles & geological texture flecks (deterministic per tile)
    const hash = (r * 37 + c * 73) & 255;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.beginPath();
    ctx.roundRect(x + 7 + (hash % 12), y + 7 + ((hash >> 3) % 10), 8, 4.5, 2);
    ctx.roundRect(x + 25 + ((hash >> 2) % 9), y + 24 + (hash % 8), 7, 4, 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.beginPath();
    ctx.roundRect(x + 22 + (hash % 11), y + 10 + ((hash >> 4) % 9), 6, 3.5, 1.5);
    ctx.roundRect(x + 8 + ((hash >> 1) % 10), y + 27 + ((hash >> 2) % 7), 7, 3.5, 1.5);
    ctx.fill();

    // Occasional sparkling quartz grain embedded in earth
    if (hash % 7 === 0) {
      ctx.fillStyle = def.diamondGlow;
      ctx.globalAlpha = 0.4 + 0.25 * Math.sin(this.time * 4 + hash);
      ctx.fillRect(x + 18, y + 18, 3, 3);
      ctx.globalAlpha = 1;
    }
  }

  private drawBrickWall(ctx: CanvasRenderingContext2D, x: number, y: number, def: CaveBiome): void {
    // 2.5D carved rounded stone masonry wall (boulders roll off it!)
    ctx.fillStyle = def.wallMortar;
    ctx.fillRect(x, y, TILE, TILE);

    // Lower 2.5D shadow face
    ctx.fillStyle = def.wallFace;
    ctx.fillRect(x + 1, y + TILE - DEPTH, TILE - 2, DEPTH - 1);

    // Two staggered courses of chamfered bricks on top face
    const topH = TILE - DEPTH;
    const rowH = topH * 0.5;
    ctx.fillStyle = def.wallTop;
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, TILE * 0.5 - 3, rowH - 3, 4);
    ctx.roundRect(x + TILE * 0.5 + 1, y + 2, TILE * 0.5 - 3, rowH - 3, 4);
    ctx.roundRect(x + 2, y + rowH + 1, TILE * 0.28 - 2, rowH - 3, 4);
    ctx.roundRect(x + TILE * 0.28 + 2, y + rowH + 1, TILE * 0.44 - 2, rowH - 3, 4);
    ctx.roundRect(x + TILE * 0.72 + 2, y + rowH + 1, TILE * 0.28 - 4, rowH - 3, 4);
    ctx.fill();

    // Top specular highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';
    ctx.fillRect(x + 4, y + 3, TILE * 0.5 - 7, 2);
    ctx.fillRect(x + TILE * 0.5 + 3, y + 3, TILE * 0.5 - 7, 2);
  }

  private drawMagicWall(ctx: CanvasRenderingContext2D, x: number, y: number, def: CaveBiome): void {
    this.drawBrickWall(ctx, x, y, def);
    const active = this.magicWallState === 'active';
    const expired = this.magicWallState === 'expired';
    if (expired) return;

    const pulse = 0.5 + 0.5 * Math.sin(this.time * (active ? 14 : 4) + x * 0.08);
    ctx.save();
    ctx.fillStyle = def.magicColor;
    ctx.globalAlpha = active ? 0.35 + pulse * 0.4 : 0.14 + pulse * 0.15;
    ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - DEPTH);

    // Shimmering arcane rune lines
    ctx.globalAlpha = active ? 0.95 : 0.5;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = active ? 2.2 : 1.3;
    const waveY = y + 8 + ((this.time * (active ? 42 : 14) + x * 0.3) % (TILE - DEPTH - 12));
    ctx.beginPath();
    ctx.moveTo(x + 4, waveY);
    ctx.lineTo(x + TILE - 4, waveY);
    ctx.stroke();

    if (active) {
      drawStarGlint(ctx, x + TILE * 0.5, y + (TILE - DEPTH) * 0.5, 7 + pulse * 3, '#FFFFFF', this.time * 5);
    }
    ctx.restore();
  }

  private drawAmoeba(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    c: number
  ): void {
    const wob = Math.sin(this.time * 5 + r * 1.4 + c * 1.1) * 2.5;
    ctx.save();
    const g = ctx.createRadialGradient(
      x + TILE * 0.42,
      y + TILE * 0.38,
      3,
      x + TILE * 0.5,
      y + TILE * 0.5,
      TILE * 0.58
    );
    g.addColorStop(0, '#86EFAC');
    g.addColorStop(0.55, '#16A34A');
    g.addColorStop(1, '#14532D');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, TILE - 4, TILE - 4, 12 + wob * 0.5);
    ctx.fill();

    // Animated rising slime bubbles
    const b1 = ((this.time * 18 + r * 11 + c * 7) % 28) / 28;
    ctx.fillStyle = 'rgba(220, 252, 231, 0.72)';
    ctx.beginPath();
    ctx.arc(x + 14 + wob, y + TILE - 10 - b1 * 22, 3.2 * (1 - b1 * 0.4), 0, Math.PI * 2);
    ctx.arc(x + 32 - wob * 0.6, y + 16 + Math.sin(this.time * 6 + c) * 4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawExitPortal(ctx: CanvasRenderingContext2D, x: number, y: number, open: boolean): void {
    const cx = x + TILE * 0.5;
    const cy = y + TILE * 0.5;
    ctx.save();
    // Heavy steel gateway frame
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, TILE - 4, TILE - 4, 8);
    ctx.fill();
    ctx.strokeStyle = open ? '#4ADE80' : '#64748B';
    ctx.lineWidth = 3;
    ctx.stroke();

    if (open) {
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 8);
      // Radial portal aura
      const aura = ctx.createRadialGradient(cx, cy, 2, cx, cy, TILE * 0.95);
      aura.addColorStop(0, 'rgba(74, 222, 128, 0.85)');
      aura.addColorStop(0.45, 'rgba(34, 197, 94, 0.35)');
      aura.addColorStop(1, 'rgba(34, 197, 94, 0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(cx, cy, TILE * 0.95, 0, Math.PI * 2);
      ctx.fill();

      // Swirling emerald vortex
      ctx.translate(cx, cy);
      ctx.rotate(this.time * 4);
      const vg = ctx.createRadialGradient(0, 0, 2, 0, 0, 16);
      vg.addColorStop(0, '#FFFFFF');
      vg.addColorStop(0.45, '#4ADE80');
      vg.addColorStop(1, '#065F46');
      ctx.fillStyle = vg;
      ctx.beginPath();
      ctx.arc(0, 0, 14 + pulse * 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#DCFCE7';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.arc(0, 0, 9, a, a + 1.1);
        ctx.stroke();
      }
    } else {
      // Locked steel vault bars
      ctx.fillStyle = '#334155';
      ctx.fillRect(x + 8, y + 8, TILE - 16, TILE - 16);
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 16, y + 8);
      ctx.lineTo(x + 16, y + TILE - 8);
      ctx.moveTo(x + 32, y + 8);
      ctx.lineTo(x + 32, y + TILE - 8);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawBoulder25D(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    rot: number,
    isFalling: boolean
  ): void {
    const r = TILE * 0.45;
    ctx.save();
    ctx.translate(cx, cy);

    // Motion blur trail when plummeting fast
    if (isFalling) {
      const trail = ctx.createLinearGradient(0, -r * 2.1, 0, 0);
      trail.addColorStop(0, 'rgba(148, 163, 184, 0)');
      trail.addColorStop(1, 'rgba(148, 163, 184, 0.34)');
      ctx.fillStyle = trail;
      ctx.fillRect(-r * 0.8, -r * 2.1, r * 1.6, r * 2.1);
    }

    // Contact shadow underneath
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.85, r * 0.82, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3D sphere shading (fixed top-left light source)
    const grad = ctx.createRadialGradient(-r * 0.35, -r * 0.38, r * 0.12, 0, 0, r * 1.05);
    grad.addColorStop(0, '#F8FAFC');
    grad.addColorStop(0.32, '#CBD5E1');
    grad.addColorStop(0.72, '#64748B');
    grad.addColorStop(1, '#1E293B');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // Rotating geological cracks & faceted rock strata
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r - 0.5, 0, Math.PI * 2);
    ctx.clip();
    ctx.rotate(rot);

    ctx.strokeStyle = 'rgba(15, 23, 42, 0.65)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-r * 0.55, -r * 0.45);
    ctx.lineTo(r * 0.12, -r * 0.05);
    ctx.lineTo(-r * 0.25, r * 0.58);
    ctx.moveTo(r * 0.12, -r * 0.05);
    ctx.lineTo(r * 0.62, r * 0.25);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.28, -r * 0.32, r * 0.32, r * 0.18, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawDiamond25D(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    c: number,
    def: CaveBiome,
    isFalling: boolean
  ): void {
    const phase = this.time * 4.5 + r * 1.1 + c * 0.8;
    const bob = isFalling ? 0 : Math.sin(phase) * 2.2;
    const spin = 0.72 + 0.28 * Math.abs(Math.cos(phase * 0.85));
    const glint = 0.7 + 0.3 * Math.sin(this.time * 8 + r * 2 + c);

    ctx.save();
    ctx.translate(cx, cy + bob);

    // Dynamic ambient crystal glow on surrounding cave
    const aura = ctx.createRadialGradient(0, 0, 2, 0, 0, TILE * 0.85);
    aura.addColorStop(0, def.diamondGlow + '55');
    aura.addColorStop(1, def.diamondMain + '00');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, TILE * 0.85, 0, Math.PI * 2);
    ctx.fill();

    // Multi-faceted 3D cut diamond
    const w = 16 * spin;
    const h = 19;
    ctx.fillStyle = def.diamondMain;
    ctx.beginPath();
    ctx.moveTo(0, -h);
    ctx.lineTo(w, -2);
    ctx.lineTo(0, h);
    ctx.lineTo(-w, -2);
    ctx.closePath();
    ctx.fill();

    // Left sunlit facet
    ctx.fillStyle = def.diamondGlow;
    ctx.beginPath();
    ctx.moveTo(0, -h);
    ctx.lineTo(-w * 0.35, -2);
    ctx.lineTo(-w, -2);
    ctx.closePath();
    ctx.fill();

    // Right deeper shadow facet
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(w, -2);
    ctx.lineTo(w * 0.25, -2);
    ctx.closePath();
    ctx.fill();

    // Inner bright specular table
    ctx.fillStyle = '#FFFFFF';
    ctx.globalAlpha = 0.88;
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.56);
    ctx.lineTo(w * 0.45, -2);
    ctx.lineTo(0, h * 0.45);
    ctx.lineTo(-w * 0.45, -2);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    if (glint > 0.9) {
      drawStarGlint(ctx, -w * 0.4, -h * 0.42, 8.5, '#FFFFFF', this.time * 5);
    }
    ctx.restore();
  }

  private drawFirefly25D(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    c: number
  ): void {
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 16 + r + c);
    ctx.save();
    ctx.translate(cx, cy);

    // Warm orange point light halo
    const aura = ctx.createRadialGradient(0, 0, 3, 0, 0, TILE * 0.95);
    aura.addColorStop(0, 'rgba(251, 146, 60, 0.55)');
    aura.addColorStop(1, 'rgba(251, 146, 60, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, TILE * 0.95, 0, Math.PI * 2);
    ctx.fill();

    // Counter-rotating blazing plasma rings
    ctx.rotate(this.time * 4.5 + r);
    ctx.fillStyle = '#EA580C';
    ctx.beginPath();
    ctx.roundRect(-15, -15, 30, 30, 7);
    ctx.fill();
    ctx.strokeStyle = '#FEF08A';
    ctx.lineWidth = 2.4;
    ctx.stroke();

    ctx.rotate(-this.time * 9);
    ctx.fillStyle = '#F97316';
    ctx.beginPath();
    ctx.roundRect(-10, -10, 20, 20, 5);
    ctx.fill();

    // Incandescent core
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(0, 0, 6 + pulse * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawButterfly25D(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    c: number
  ): void {
    const flap = Math.sin(this.time * 20 + r + c);
    const wingW = 11 + flap * 3.5;
    ctx.save();
    ctx.translate(cx, cy + Math.sin(this.time * 8 + c) * 2.5);

    // Cyan bioluminescent halo
    const aura = ctx.createRadialGradient(0, 0, 2, 0, 0, TILE * 0.9);
    aura.addColorStop(0, 'rgba(56, 189, 248, 0.48)');
    aura.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, TILE * 0.9, 0, Math.PI * 2);
    ctx.fill();

    // Iridescent upper & lower jeweled wings
    const wg = ctx.createLinearGradient(-16, -14, 16, 14);
    wg.addColorStop(0, '#7DD3FC');
    wg.addColorStop(0.5, '#38BDF8');
    wg.addColorStop(1, '#A855F7');
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.ellipse(-wingW * 0.72, -5, wingW * 0.75, 10, -0.35, 0, Math.PI * 2);
    ctx.ellipse(wingW * 0.72, -5, wingW * 0.75, 10, 0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#E0F2FE';
    ctx.beginPath();
    ctx.ellipse(-wingW * 0.55, 7, wingW * 0.52, 6.5, 0.3, 0, Math.PI * 2);
    ctx.ellipse(wingW * 0.55, 7, wingW * 0.52, 6.5, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Gem thorax + antennae
    ctx.fillStyle = '#F472B6';
    ctx.beginPath();
    ctx.roundRect(-3.2, -13, 6.4, 26, 3.2);
    ctx.fill();
    ctx.strokeStyle = '#FBCFE8';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-1, -12);
    ctx.quadraticCurveTo(-7, -20, -10, -18);
    ctx.moveTo(1, -12);
    ctx.quadraticCurveTo(7, -20, 10, -18);
    ctx.stroke();
    ctx.restore();
  }

  private drawRockford25D(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    const stride = this.playerMoveT < 0.99 ? Math.sin(this.stridePhase) : 0;
    const bounce = Math.abs(stride) * 2.8;
    const lean = this.pushStrain > 0 ? this.pushDirC * 0.16 : stride * 0.08 * this.facing;

    ctx.save();
    ctx.translate(cx, cy - bounce);

    // Volumetric headlamp cone lighting up the cavern ahead
    const angle = Math.atan2(this.lookDirY, this.lookDirX);
    ctx.save();
    ctx.rotate(angle);
    const beam = ctx.createRadialGradient(8, 0, 4, 58, 0, 118);
    beam.addColorStop(0, 'rgba(254, 249, 195, 0.42)');
    beam.addColorStop(0.55, 'rgba(254, 240, 138, 0.14)');
    beam.addColorStop(1, 'rgba(254, 240, 138, 0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(6, -6);
    ctx.lineTo(138, -56);
    ctx.lineTo(138, 56);
    ctx.lineTo(6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Soft radial personal glow around Rockford
    const halo = ctx.createRadialGradient(0, 0, 4, 0, 0, 52);
    halo.addColorStop(0, 'rgba(254, 240, 138, 0.18)');
    halo.addColorStop(1, 'rgba(254, 240, 138, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, Math.PI * 2);
    ctx.fill();

    // Ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 18 + bounce, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(lean);
    ctx.scale(this.facing, 1);

    // Animated sturdy miner boots
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.roundRect(-10 + stride * 5, 11, 9, 8, 3);
    ctx.roundRect(1 - stride * 5, 11, 9, 8, 3);
    ctx.fill();

    // Purple explorer jacket & utility belt
    const bodyG = ctx.createLinearGradient(-12, -2, 12, 14);
    bodyG.addColorStop(0, '#A855F7');
    bodyG.addColorStop(1, '#581C87');
    ctx.fillStyle = bodyG;
    ctx.beginPath();
    ctx.roundRect(-12, -1, 24, 15, 6);
    ctx.fill();
    // Gold belt buckle
    ctx.fillStyle = '#475569';
    ctx.fillRect(-11, 8, 22, 3.5);
    ctx.fillStyle = '#FACC15';
    ctx.fillRect(1, 7.5, 5, 4.5);

    // Expressive face with blinking eyes & grin
    ctx.fillStyle = '#FDBA74';
    ctx.beginPath();
    ctx.roundRect(-9.5, -11, 19, 12, 5);
    ctx.fill();
    const blink = Math.sin(this.time * 2.4) > 0.96;
    ctx.fillStyle = '#0F172A';
    if (!blink) {
      ctx.beginPath();
      ctx.arc(2.5, -6, 2.2, 0, Math.PI * 2);
      ctx.arc(7.5, -6, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(2.8, -7, 1.1, 1.1);
      ctx.fillRect(7.8, -7, 1.1, 1.1);
    } else {
      ctx.fillRect(1, -6, 3.5, 1.4);
      ctx.fillRect(6, -6, 3.5, 1.4);
    }

    // 3D Yellow Hard Hat with glowing crystal headlamp
    const hatG = ctx.createRadialGradient(-4, -17, 2, 0, -12, 16);
    hatG.addColorStop(0, '#FEF08A');
    hatG.addColorStop(0.55, '#FACC15');
    hatG.addColorStop(1, '#B45309');
    ctx.fillStyle = hatG;
    ctx.beginPath();
    ctx.arc(0, -10, 13.5, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-16, -11, 32, 4);

    // Headlamp bezel + glowing bulb
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.roundRect(7, -18, 7, 7, 2);
    ctx.fill();
    ctx.fillStyle = '#FEF9C3';
    ctx.shadowColor = '#FEF08A';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(12, -14.5, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Animated steel pickaxe (swings visibly during Snap-Dig!)
    ctx.save();
    const swingAngle = this.pickaxeSwing > 0 ? -1.4 + (1 - this.pickaxeSwing) * 2.4 : 0.25 + stride * 0.25;
    ctx.translate(10, 3);
    ctx.rotate(swingAngle);
    ctx.strokeStyle = '#92400E';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(13, -12);
    ctx.stroke();
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(6, -16);
    ctx.quadraticCurveTo(13, -13, 18, -5);
    ctx.stroke();
    ctx.restore();

    ctx.restore();

    // Pickaxe sparkle glint at Snap-Dig target tile
    if (this.pickaxeSwing > 0.25) {
      drawStarGlint(
        ctx,
        this.pickaxeTargetC * TILE + TILE * 0.5,
        this.pickaxeTargetR * TILE + TILE * 0.5,
        12 * this.pickaxeSwing,
        '#FEF08A',
        this.time * 12
      );
    }
  }

  private renderTopHud(ctx: CanvasRenderingContext2D, def: CaveBiome): void {
    const g = ctx.createLinearGradient(0, 0, 0, HUD_H);
    g.addColorStop(0, '#0E1424');
    g.addColorStop(1, '#080C17');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, HUD_H);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, HUD_H - 1, VIEW_W, 1);

    ctx.textBaseline = 'middle';

    // Left: Cave Biome Name
    ctx.textAlign = 'left';
    ctx.font = '800 17px "Outfit", sans-serif';
    ctx.fillStyle = def.diamondGlow;
    ctx.fillText(def.name.toUpperCase(), 20, 20);
    ctx.font = '500 12px "Outfit", sans-serif';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText(
      this.magicWallState === 'active'
        ? `MAGIC WALL ACTIVE (${Math.ceil(this.magicWallTimer)}s)`
        : 'Hold Space + Dir to Snap-Dig · Push Boulders horizontally',
      20,
      39
    );

    // Center: Diamond Quota Progress Bar
    const barW = 290;
    const barH = 14;
    const barX = VIEW_W * 0.5 - barW * 0.5;
    const barY = 29;
    const pct = Math.min(1, this.diamondsCollected / Math.max(1, this.diamondQuota));
    const unlocked = this.diamondsCollected >= this.diamondQuota;

    ctx.textAlign = 'center';
    ctx.font = '700 13px "Outfit", sans-serif';
    ctx.fillStyle = unlocked ? '#4ADE80' : '#E2E8F0';
    ctx.fillText(
      unlocked
        ? `DIAMONDS ${this.diamondsCollected} / ${this.diamondQuota} · EXIT OPEN! (EXTRA +30)`
        : `DIAMOND QUOTA: ${this.diamondsCollected} / ${this.diamondQuota}`,
      VIEW_W * 0.5,
      15
    );

    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 7);
    ctx.fill();
    const fillGrad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
    if (unlocked) {
      fillGrad.addColorStop(0, '#22C55E');
      fillGrad.addColorStop(1, '#4ADE80');
    } else {
      fillGrad.addColorStop(0, def.diamondMain);
      fillGrad.addColorStop(1, def.diamondGlow);
    }
    ctx.fillStyle = fillGrad;
    if (pct > 0) {
      ctx.beginPath();
      ctx.roundRect(barX, barY, Math.max(12, barW * pct), barH, 7);
      ctx.fill();
    }

    // Right: Score & Urgent Timer
    const urgent = this.caveTimeLeft < 25;
    ctx.textAlign = 'right';
    ctx.font = '800 18px "JetBrains Mono", monospace';
    ctx.fillStyle = urgent && Math.floor(this.time * 6) % 2 === 0 ? '#FB7185' : '#F8FAFC';
    ctx.fillText(`${Math.ceil(this.caveTimeLeft)}s`, VIEW_W - 22, 22);
    ctx.font = '600 12px "Outfit", sans-serif';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText(`SCORE ${this.score.toLocaleString()} · LIVES ${this.lives}`, VIEW_W - 22, 40);
  }
}

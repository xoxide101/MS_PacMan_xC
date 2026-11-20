import { arcadeAudio } from './audio';
import { CLASSIC_MAZE } from './classicMaze';
import { DIR_VECTORS } from './engine';
import { cloneMazeGrid, isWalkableForGhost, isWalkableForPlayer } from './mazes';
import {
  Direction,
  FloatingPopup,
  GamePhase,
  GhostMode,
  GRID_COLS,
  GRID_ROWS,
  MazeDefinition,
  Particle,
  SpeedMode,
  TileType,
  Vec2,
} from './types';

export type PlusGhostId = 'blinky' | 'pinky' | 'inky' | 'clyde';

export type PlusBonusType =
  | 'soda'
  | 'cocktail'
  | 'peas'
  | 'apple'
  | 'pancakes'
  | 'icecream'
  | 'galaxian'
  | 'key';

export interface PlusBonusSpec {
  type: PlusBonusType;
  label: string;
  points: number;
  color: string;
}

export const PLUS_BONUS_SPECS: Record<PlusBonusType, PlusBonusSpec> = {
  soda: { type: 'soda', label: 'Soda Can', points: 100, color: '#EF4444' },
  cocktail: { type: 'cocktail', label: 'Cocktail', points: 300, color: '#38BDF8' },
  peas: { type: 'peas', label: 'Pea Pod', points: 500, color: '#4ADE80' },
  apple: { type: 'apple', label: 'Apple', points: 700, color: '#F43F5E' },
  pancakes: { type: 'pancakes', label: 'Pancakes', points: 1000, color: '#F59E0B' },
  icecream: { type: 'icecream', label: 'Ice Cream', points: 2000, color: '#F472B6' },
  galaxian: { type: 'galaxian', label: 'Galaxian', points: 3000, color: '#FACC15' },
  key: { type: 'key', label: 'Key', points: 5000, color: '#38BDF8' },
};

export const PLUS_BONUS_ORDER: PlusBonusType[] = [
  'soda',
  'cocktail',
  'peas',
  'apple',
  'pancakes',
  'icecream',
  'galaxian',
  'key',
];

export type PlusWildcardEffect =
  | 'NONE'
  | 'INVISIBLE_MAZE'
  | 'INVISIBLE_GHOSTS_2X'
  | 'STUBBORN_GHOST'
  | 'SPECTRAL_GHOSTS';

export interface PlusPlayerState {
  x: number;
  y: number;
  dir: Direction;
  desiredDir: Direction;
  facing: Direction;
  mouthPhase: number;
  moving: boolean;
  deathProgress: number;
}

export interface PlusGhostState {
  id: PlusGhostId;
  name: string;
  nickname: string;
  color: string;
  accentColor: string;
  x: number;
  y: number;
  dir: Direction;
  mode: GhostMode | 'ENTERING_HOUSE';
  previousMode: 'SCATTER' | 'CHASE';
  scatterTarget: Vec2;
  releaseDelay: number;
  eatenThisPower: boolean;
  invisible: boolean;
  stubborn: boolean; // Refuses to turn blue on a wildcard energizer!
  animPhase: number;
  lastDecisionTileKey: string;
}

export interface PlusHudSnapshot {
  phase: GamePhase;
  score: number;
  highScore: number;
  isNewHighScore: boolean;
  lives: number;
  level: number;
  pelletsLeft: number;
  totalPellets: number;
  ghostsEatenTotal: number;
  wildcardsTriggered: number;
  bonusesCollected: PlusBonusType[];
  currentBonus: PlusBonusType;
  bonusActive: boolean;
  frightenedRemaining: number;
  mazeInvisibleRemaining: number;
  doubleGhostPtsActive: boolean;
  activeWildcard: PlusWildcardEffect;
  extraLifeAwarded: boolean;
}

const PLUS_HIGH_SCORE_KEY = 'pacman_plus_hd_highscore_v1';
const EXTRA_LIFE_SCORE = 10000;

const OPPOSITE_DIR: Record<Direction, Direction> = {
  UP: 'DOWN',
  DOWN: 'UP',
  LEFT: 'RIGHT',
  RIGHT: 'LEFT',
  NONE: 'NONE',
};

const PRIORITY_DIRS: Direction[] = ['UP', 'LEFT', 'DOWN', 'RIGHT'];

function distSq(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function wrapCol(col: number): number {
  if (col < 0) return GRID_COLS - 1;
  if (col >= GRID_COLS) return 0;
  return col;
}

export const PLUS_MAZE: MazeDefinition = {
  ...CLASSIC_MAZE,
  id: 101,
  theme: {
    name: 'Pac-Man Plus 1982',
    subtitle: 'Midway Emerald Maze',
    wallOuter: '#22C55E',
    wallInner: '#062614',
    wallHighlight: '#BBF7D0',
    wallGlow: 'rgba(34, 197, 94, 0.52)',
    floorTint: '#030A07',
    pelletColor: '#FFF0C2',
    pelletGlow: 'rgba(255, 224, 150, 0.55)',
    gateColor: '#F472B6',
    accentHex: '#10B981',
  },
};

export class PacManPlusEngine {
  public phase: GamePhase = 'TITLE_MENU';
  public previousPhase: GamePhase = 'PLAYING';
  public speedMode: SpeedMode = 'arcade';

  public score = 0;
  public highScore = 0;
  public isNewHighScore = false;
  public lives = 3;
  public extraLifeAwarded = false;
  public level = 1;
  public ghostsEatenTotal = 0;
  public wildcardsTriggered = 0;
  public bonusesCollected: PlusBonusType[] = [];

  public maze: MazeDefinition = PLUS_MAZE;
  public grid: TileType[][] = cloneMazeGrid(PLUS_MAZE);
  public pelletsLeft = PLUS_MAZE.totalPellets;
  public totalPellets = PLUS_MAZE.totalPellets;

  public player: PlusPlayerState;
  public ghosts: PlusGhostState[] = [];
  public bonus = {
    active: false,
    type: 'soda' as PlusBonusType,
    x: 14,
    y: 17.5,
    timer: 0,
  };

  public particles: Particle[] = [];
  public popups: FloatingPopup[] = [];

  public phaseTimer = 0;
  public elapsed = 0;
  public frightenedRemaining = 0;
  public mazeInvisibleRemaining = 0;
  public doubleGhostPtsActive = false;
  public activeWildcard: PlusWildcardEffect = 'NONE';
  public ghostCombo = 0;
  public modeWaveIndex = 0;
  public modeWaveTimer = 6;
  public globalGhostMode: 'SCATTER' | 'CHASE' = 'SCATTER';
  public screenShake = 0;
  public eatenGhostFreezeId: PlusGhostId | null = null;
  public stageClearFlashPhase = 0;

  private pelletsEatenThisStage = 0;
  private bonusSpawnsThisStage = 0;
  private energizersEatenThisStage = 0;
  private attractDecisionTimer = 0;

  constructor() {
    this.highScore = this.loadHighScore();
    this.player = this.createInitialPlayer();
    this.setupStage(1, true);
    this.phase = 'TITLE_MENU';
  }

  public get currentBonus(): PlusBonusType {
    return PLUS_BONUS_ORDER[Math.min(PLUS_BONUS_ORDER.length - 1, this.level - 1)];
  }

  private loadHighScore(): number {
    if (typeof window === 'undefined') return 0;
    try {
      const saved = window.localStorage.getItem(PLUS_HIGH_SCORE_KEY);
      const parsed = saved ? parseInt(saved, 10) : 0;
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch {
      return 0;
    }
  }

  private saveHighScore(val: number): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(PLUS_HIGH_SCORE_KEY, String(val));
    } catch {
      // ignore storage errors
    }
  }

  private addScore(points: number): void {
    this.score += points;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.isNewHighScore = true;
      this.saveHighScore(this.highScore);
    }
    if (!this.extraLifeAwarded && this.score >= EXTRA_LIFE_SCORE) {
      this.extraLifeAwarded = true;
      this.lives = Math.min(5, this.lives + 1);
      if (this.phase !== 'TITLE_MENU') {
        arcadeAudio.playExtraLife();
      }
      this.spawnPopup(this.player.x, this.player.y - 0.8, '1UP', '#4ADE80', 1.35);
    }
  }

  private createInitialPlayer(): PlusPlayerState {
    return {
      x: PLUS_MAZE.playerSpawn.x,
      y: PLUS_MAZE.playerSpawn.y,
      dir: 'LEFT',
      desiredDir: 'LEFT',
      facing: 'LEFT',
      mouthPhase: 0.25,
      moving: false,
      deathProgress: 0,
    };
  }

  private createInitialGhosts(): PlusGhostState[] {
    const c = PLUS_MAZE.ghostHouseCenter;
    const door = PLUS_MAZE.ghostHouseDoor;
    const speedFactor = Math.max(0.38, 1 - (this.level - 1) * 0.1);
    return [
      {
        id: 'blinky',
        name: 'Blinky',
        nickname: 'Shadow',
        color: '#FF2A42',
        accentColor: '#FF8593',
        x: door.x,
        y: door.y,
        dir: 'LEFT',
        mode: 'SCATTER',
        previousMode: 'SCATTER',
        scatterTarget: { x: 25.5, y: 1.5 },
        releaseDelay: 0,
        eatenThisPower: false,
        invisible: false,
        stubborn: false,
        animPhase: 0,
        lastDecisionTileKey: '',
      },
      {
        id: 'pinky',
        name: 'Pinky',
        nickname: 'Speedy',
        color: '#FF80C8',
        accentColor: '#FFC4E6',
        x: c.x,
        y: c.y,
        dir: 'UP',
        mode: 'IN_HOUSE',
        previousMode: 'SCATTER',
        scatterTarget: { x: 2.5, y: 1.5 },
        releaseDelay: 1.0 * speedFactor,
        eatenThisPower: false,
        invisible: false,
        stubborn: false,
        animPhase: 1.2,
        lastDecisionTileKey: '',
      },
      {
        id: 'inky',
        name: 'Inky',
        nickname: 'Bashful',
        color: '#1CE4FF',
        accentColor: '#9AF3FF',
        x: c.x - 1.8,
        y: c.y,
        dir: 'UP',
        mode: 'IN_HOUSE',
        previousMode: 'SCATTER',
        scatterTarget: { x: 26.5, y: 29.5 },
        releaseDelay: 2.8 * speedFactor,
        eatenThisPower: false,
        invisible: false,
        stubborn: false,
        animPhase: 2.4,
        lastDecisionTileKey: '',
      },
      {
        id: 'clyde',
        name: 'Clyde',
        nickname: 'Pokey',
        color: '#FF9B26',
        accentColor: '#FFD094',
        x: c.x + 1.8,
        y: c.y,
        dir: 'UP',
        mode: 'IN_HOUSE',
        previousMode: 'SCATTER',
        scatterTarget: { x: 1.5, y: 29.5 },
        releaseDelay: 5.0 * speedFactor,
        eatenThisPower: false,
        invisible: false,
        stubborn: false,
        animPhase: 3.6,
        lastDecisionTileKey: '',
      },
    ];
  }

  public startNewGame(): void {
    arcadeAudio.unlock();
    this.score = 0;
    this.isNewHighScore = false;
    this.lives = 3;
    this.extraLifeAwarded = false;
    this.level = 1;
    this.ghostsEatenTotal = 0;
    this.wildcardsTriggered = 0;
    this.bonusesCollected = [];
    this.particles = [];
    this.popups = [];
    this.setupStage(1, true);
    this.phase = 'READY';
    this.phaseTimer = 2.2;
    arcadeAudio.playPlusStartFanfare();
  }

  public returnToTitle(): void {
    arcadeAudio.stopAmbient();
    this.setupStage(1, true);
    this.phase = 'TITLE_MENU';
  }

  public setSpeedMode(mode: SpeedMode): void {
    this.speedMode = mode;
  }

  public setDesiredDirection(dir: Direction): void {
    if (this.phase === 'TITLE_MENU') return;
    this.player.desiredDir = dir;
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING' || this.phase === 'READY') {
      this.previousPhase = this.phase;
      this.phase = 'PAUSED';
      arcadeAudio.stopAmbient();
    } else if (this.phase === 'PAUSED') {
      this.phase = this.previousPhase;
    }
  }

  private setupStage(level: number, resetBoard: boolean): void {
    this.level = level;
    if (resetBoard) {
      this.grid = cloneMazeGrid(PLUS_MAZE);
      this.pelletsLeft = PLUS_MAZE.totalPellets;
      this.totalPellets = PLUS_MAZE.totalPellets;
      this.pelletsEatenThisStage = 0;
      this.bonusSpawnsThisStage = 0;
      this.energizersEatenThisStage = 0;
      this.bonus.active = false;
      this.bonus.type = this.currentBonus;
    }
    this.resetPositions();
  }

  private resetPositions(): void {
    this.player = this.createInitialPlayer();
    this.ghosts = this.createInitialGhosts();
    this.frightenedRemaining = 0;
    this.mazeInvisibleRemaining = 0;
    this.doubleGhostPtsActive = false;
    this.activeWildcard = 'NONE';
    this.ghostCombo = 0;
    this.modeWaveIndex = 0;
    this.modeWaveTimer = 6;
    this.globalGhostMode = 'SCATTER';
    this.eatenGhostFreezeId = null;
    this.bonus.active = false;
  }

  public step(dt: number): void {
    this.elapsed += dt;
    this.updateParticles(dt);
    this.updatePopups(dt);
    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 16);
    }

    if (this.phase === 'PAUSED' || this.phase === 'GAME_OVER') {
      arcadeAudio.stopAmbient();
      return;
    }

    if (this.phase === 'TITLE_MENU') {
      this.stepAttractMode(dt);
      return;
    }

    if (this.phase === 'READY') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) this.phase = 'PLAYING';
      return;
    }

    if (this.phase === 'GHOST_EATEN_PAUSE') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.eatenGhostFreezeId = null;
        this.phase = 'PLAYING';
      }
      return;
    }

    if (this.phase === 'DYING') {
      this.phaseTimer -= dt;
      this.player.deathProgress = Math.min(1, 1 - this.phaseTimer / 1.45);
      if (this.phaseTimer <= 0) {
        this.lives -= 1;
        if (this.lives <= 0) {
          this.phase = 'GAME_OVER';
          arcadeAudio.stopAmbient();
        } else {
          this.resetPositions();
          this.phase = 'READY';
          this.phaseTimer = 1.6;
        }
      }
      return;
    }

    if (this.phase === 'STAGE_CLEAR') {
      this.phaseTimer -= dt;
      this.stageClearFlashPhase += dt * 7;
      if (this.phaseTimer <= 0) {
        this.setupStage(this.level + 1, true);
        this.phase = 'READY';
        this.phaseTimer = 1.9;
      }
      return;
    }

    this.stepGameplay(dt, false);
  }

  private stepAttractMode(dt: number): void {
    this.attractDecisionTimer -= dt;
    if (this.attractDecisionTimer <= 0) {
      this.attractDecisionTimer = 0.14;
      this.chooseAttractDirection();
    }
    this.stepGameplay(dt, true);
  }

  private chooseAttractDirection(): void {
    const col = Math.floor(this.player.x);
    const row = Math.floor(this.player.y);
    const candidates: Direction[] = (['UP', 'DOWN', 'LEFT', 'RIGHT'] as Direction[]).filter((d) => {
      const v = DIR_VECTORS[d];
      return isWalkableForPlayer(this.grid, col + v.x, row + v.y);
    });
    if (candidates.length === 0) return;

    const nonReverse = candidates.filter((d) => d !== OPPOSITE_DIR[this.player.dir]);
    const pool = nonReverse.length > 0 ? nonReverse : candidates;
    let bestDir = pool[0];
    let bestScore = -Infinity;

    for (const d of pool) {
      const v = DIR_VECTORS[d];
      const nx = col + v.x + 0.5;
      const ny = row + v.y + 0.5;
      let score = Math.random() * 1.4;
      const tile = this.grid[row + v.y]?.[wrapCol(col + v.x)];
      if (tile === '.') score += 6;
      else if (tile === 'o') score += 12;

      for (const g of this.ghosts) {
        if (g.mode === 'IN_HOUSE' || g.mode === 'EXITING_HOUSE' || g.mode === 'EATEN') continue;
        const d2 = distSq(nx, ny, g.x, g.y);
        if (g.mode === 'FRIGHTENED') score += 24 / (d2 + 1.2);
        else if (d2 < 20) score -= 58 / (d2 + 0.5);
      }
      if (score > bestScore) {
        bestScore = score;
        bestDir = d;
      }
    }
    this.player.desiredDir = bestDir;
  }

  private stepGameplay(dt: number, isAttract: boolean): void {
    this.updateModeWaves(dt);

    if (this.mazeInvisibleRemaining > 0) {
      this.mazeInvisibleRemaining = Math.max(0, this.mazeInvisibleRemaining - dt);
      if (this.mazeInvisibleRemaining === 0 && this.activeWildcard === 'INVISIBLE_MAZE') {
        this.activeWildcard = 'NONE';
      }
    }

    if (this.frightenedRemaining > 0) {
      this.frightenedRemaining = Math.max(0, this.frightenedRemaining - dt);
      if (this.frightenedRemaining === 0) {
        this.ghostCombo = 0;
        this.doubleGhostPtsActive = false;
        if (this.mazeInvisibleRemaining <= 0) {
          this.activeWildcard = 'NONE';
        }
        for (const g of this.ghosts) {
          if (g.mode === 'FRIGHTENED') g.mode = this.globalGhostMode;
          g.eatenThisPower = false;
          g.invisible = false;
          g.stubborn = false;
        }
      }
    }

    if (this.bonus.active) {
      this.bonus.timer -= dt;
      if (this.bonus.timer <= 0) this.bonus.active = false;
    }

    // Pac-Man Plus runs briskly (~10% faster than original 1980 Pac-Man!)
    const speedMult = this.speedMode === 'turbo' ? 1.22 : 1.0;
    const levelBonus = Math.min(0.18, (this.level - 1) * 0.025);
    const playerSpeed = (7.95 + levelBonus * 7.95) * speedMult;

    this.movePlayer(dt, playerSpeed);
    this.consumePelletAtPlayer(isAttract);
    this.checkBonusCollision(isAttract);

    for (const g of this.ghosts) {
      this.updateGhost(g, dt, speedMult);
    }

    this.checkGhostCollisions(isAttract);

    if (!isAttract && this.phase === 'PLAYING') {
      const anyEyes = this.ghosts.some((g) => g.mode === 'EATEN');
      const progress = this.totalPellets > 0 ? 1 - this.pelletsLeft / this.totalPellets : 0;
      if (anyEyes) arcadeAudio.updateAmbient('eyes', dt, progress);
      else if (this.frightenedRemaining > 0) arcadeAudio.updateAmbient('fright', dt, progress);
      else arcadeAudio.updateAmbient('siren', dt, progress);
    }
  }

  private updateModeWaves(dt: number): void {
    if (this.frightenedRemaining > 0) return;
    const waves = [6, 22, 6, 22, 4, 24, 4, 9999];
    this.modeWaveTimer -= dt;
    if (this.modeWaveTimer <= 0) {
      this.modeWaveIndex = Math.min(waves.length - 1, this.modeWaveIndex + 1);
      this.modeWaveTimer = waves[this.modeWaveIndex];
      const nextMode: 'SCATTER' | 'CHASE' = this.modeWaveIndex % 2 === 0 ? 'SCATTER' : 'CHASE';
      if (nextMode !== this.globalGhostMode) {
        this.globalGhostMode = nextMode;
        for (const g of this.ghosts) {
          if (g.mode === 'SCATTER' || g.mode === 'CHASE') {
            g.mode = nextMode;
            g.previousMode = nextMode;
            g.dir = OPPOSITE_DIR[g.dir];
            g.lastDecisionTileKey = '';
          }
        }
      }
    }
  }

  private movePlayer(dt: number, speed: number): void {
    const p = this.player;
    const stepDist = speed * dt;
    const col = Math.floor(p.x);
    const row = Math.floor(p.y);
    const cx = col + 0.5;
    const cy = row + 0.5;

    if (p.desiredDir !== 'NONE' && p.desiredDir !== p.dir) {
      if (p.desiredDir === OPPOSITE_DIR[p.dir]) {
        p.dir = p.desiredDir;
        p.facing = p.dir;
      } else {
        const dv = DIR_VECTORS[p.desiredDir];
        if (isWalkableForPlayer(this.grid, col + dv.x, row + dv.y)) {
          const isHorizontal = dv.x !== 0;
          const alignDist = isHorizontal ? Math.abs(p.y - cy) : Math.abs(p.x - cx);
          if (alignDist <= 0.34) {
            if (isHorizontal) p.y = cy;
            else p.x = cx;
            p.dir = p.desiredDir;
            p.facing = p.dir;
          }
        }
      }
    }

    if (p.dir === 'NONE') {
      p.moving = false;
      return;
    }

    const v = DIR_VECTORS[p.dir];
    if (v.x !== 0) p.y += (cy - p.y) * Math.min(1, dt * 22);
    else if (v.y !== 0) p.x += (cx - p.x) * Math.min(1, dt * 22);

    let nextX = p.x + v.x * stepDist;
    let nextY = p.y + v.y * stepDist;
    if (!isWalkableForPlayer(this.grid, col + v.x, row + v.y)) {
      if (v.x > 0 && nextX > cx) nextX = cx;
      if (v.x < 0 && nextX < cx) nextX = cx;
      if (v.y > 0 && nextY > cy) nextY = cy;
      if (v.y < 0 && nextY < cy) nextY = cy;
    }

    const moved = Math.abs(nextX - p.x) > 0.0001 || Math.abs(nextY - p.y) > 0.0001;
    p.x = nextX;
    p.y = nextY;
    p.moving = moved;

    if (p.x < -0.45) p.x = GRID_COLS + 0.45;
    else if (p.x > GRID_COLS + 0.45) p.x = -0.45;

    if (moved) {
      p.facing = p.dir;
      p.mouthPhase = (p.mouthPhase + dt * 20) % (Math.PI * 2);
    }
  }

  private consumePelletAtPlayer(isAttract: boolean): void {
    const col = Math.floor(this.player.x);
    const row = Math.floor(this.player.y);
    if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) return;

    const tile = this.grid[row][col];
    if (tile !== '.' && tile !== 'o') return;

    this.grid[row][col] = ' ';
    this.pelletsLeft -= 1;
    this.pelletsEatenThisStage += 1;

    if (tile === '.') {
      if (!isAttract) {
        this.addScore(10);
        arcadeAudio.playWaka();
      }
      this.spawnBurst(col + 0.5, row + 0.5, '#FEF08A', 3, 2.0);
    } else {
      this.energizersEatenThisStage += 1;
      if (!isAttract) {
        this.addScore(50);
        arcadeAudio.playPowerPellet();
      }
      this.spawnBurst(col + 0.5, row + 0.5, '#4ADE80', 18, 5.2);
      this.triggerEnergizerWithWildcard(isAttract);
    }

    // Spawn authentic 1982 Pac-Man Plus bonus item (Soda Can, Cocktail, Pea Pod, etc.)
    if (
      (this.pelletsEatenThisStage === 65 && this.bonusSpawnsThisStage === 0) ||
      (this.pelletsEatenThisStage === 165 && this.bonusSpawnsThisStage === 1)
    ) {
      this.bonusSpawnsThisStage += 1;
      this.bonus = {
        active: true,
        type: this.currentBonus,
        x: 14,
        y: 17.5,
        timer: 10.5,
      };
    }

    if (this.pelletsLeft <= 0) {
      if (isAttract) {
        this.setupStage((this.level % 4) + 1, true);
      } else {
        this.phase = 'STAGE_CLEAR';
        this.phaseTimer = 2.4;
        this.stageClearFlashPhase = 0;
        this.bonus.active = false;
        this.mazeInvisibleRemaining = 0;
        arcadeAudio.stopAmbient();
        arcadeAudio.playStageClear();
      }
    }
  }

  // Signature Pac-Man Plus Energizer Wildcards!
  private triggerEnergizerWithWildcard(isAttract: boolean): void {
    const duration = Math.max(2.6, 6.8 - (this.level - 1) * 0.5);
    this.frightenedRemaining = duration;
    this.doubleGhostPtsActive = false;
    this.ghostCombo = 0;

    // Cycle authentic Pac-Man Plus unpredictable energizer effects!
    const roll = (this.energizersEatenThisStage + this.level) % 4;
    let stubbornIndex = -1;

    if (roll === 1) {
      // INVISIBLE MAZE! Walls vanish into pitch black!
      this.activeWildcard = 'INVISIBLE_MAZE';
      this.mazeInvisibleRemaining = Math.min(4.6, duration);
      if (!isAttract) {
        this.wildcardsTriggered += 1;
        arcadeAudio.playPlusWildcard();
      }
      this.spawnPopup(14, 15.5, 'MAZE VANISHED!', '#4ADE80', 1.4);
    } else if (roll === 2) {
      // ONE STUBBORN GHOST refuses to turn blue!
      this.activeWildcard = 'STUBBORN_GHOST';
      const activeIndices = this.ghosts
        .map((g, i) => (g.mode === 'SCATTER' || g.mode === 'CHASE' ? i : -1))
        .filter((i) => i >= 0);
      if (activeIndices.length > 0) {
        stubbornIndex = activeIndices[Math.floor(Math.random() * activeIndices.length)];
      }
      if (!isAttract) {
        this.wildcardsTriggered += 1;
        arcadeAudio.playPlusWildcard();
      }
      this.spawnPopup(14, 15.5, '1 ROGUE GHOST!', '#FB7185', 1.4);
    } else if (roll === 3) {
      // SPECTRAL GHOSTS: frightened ghosts turn ghostly invisible!
      this.activeWildcard = 'SPECTRAL_GHOSTS';
      if (!isAttract) {
        this.wildcardsTriggered += 1;
        arcadeAudio.playPlusWildcard();
      }
      this.spawnPopup(14, 15.5, 'GHOST CLOAK!', '#38BDF8', 1.4);
    } else {
      this.activeWildcard = 'NONE';
    }

    this.ghosts.forEach((g, idx) => {
      g.eatenThisPower = false;
      g.stubborn = idx === stubbornIndex;
      g.invisible = roll === 3;
      if (g.stubborn) return;
      if (g.mode === 'SCATTER' || g.mode === 'CHASE' || g.mode === 'FRIGHTENED') {
        if (g.mode !== 'FRIGHTENED') {
          g.previousMode = g.mode;
          g.dir = OPPOSITE_DIR[g.dir];
          g.lastDecisionTileKey = '';
        }
        g.mode = 'FRIGHTENED';
      }
    });
  }

  // Signature Pac-Man Plus Bonus Power-Up: eating Soda Can/Cocktail/etc. turns ALL ghosts INVISIBLE, EDIBLE & 2X POINTS!
  private checkBonusCollision(isAttract: boolean): void {
    if (!this.bonus.active) return;
    if (distSq(this.player.x, this.player.y, this.bonus.x, this.bonus.y) < 0.72 * 0.72) {
      const spec = PLUS_BONUS_SPECS[this.bonus.type];
      this.bonus.active = false;
      this.frightenedRemaining = Math.max(4.5, 6.4 - (this.level - 1) * 0.35);
      this.doubleGhostPtsActive = true;
      this.activeWildcard = 'INVISIBLE_GHOSTS_2X';
      this.ghostCombo = 0;

      for (const g of this.ghosts) {
        g.eatenThisPower = false;
        g.stubborn = false;
        g.invisible = true;
        if (g.mode === 'SCATTER' || g.mode === 'CHASE' || g.mode === 'FRIGHTENED') {
          if (g.mode !== 'FRIGHTENED') {
            g.previousMode = g.mode;
            g.dir = OPPOSITE_DIR[g.dir];
            g.lastDecisionTileKey = '';
          }
          g.mode = 'FRIGHTENED';
        }
      }

      if (!isAttract) {
        this.bonusesCollected.push(this.bonus.type);
        this.wildcardsTriggered += 1;
        this.addScore(spec.points);
        arcadeAudio.playEatFruit();
        arcadeAudio.playPlusWildcard();
      }
      this.screenShake = 5;
      this.spawnBurst(this.bonus.x, this.bonus.y, spec.color, 22, 5.8);
      this.spawnPopup(this.bonus.x, this.bonus.y - 0.35, `${spec.points} · 2X GHOSTS!`, '#FDE047', 1.45);
    }
  }

  private updateGhost(g: PlusGhostState, dt: number, speedMult: number): void {
    g.animPhase += dt * 10;
    const houseCenter = this.maze.ghostHouseCenter;
    const houseDoor = this.maze.ghostHouseDoor;

    if (g.mode === 'IN_HOUSE') {
      g.releaseDelay -= dt;
      g.y = houseCenter.y + Math.sin(this.elapsed * 5.5 + g.animPhase) * 0.25;
      if (g.releaseDelay <= 0) g.mode = 'EXITING_HOUSE';
      return;
    }

    if (g.mode === 'EXITING_HOUSE') {
      const exitSpeed = 4.6 * speedMult;
      if (Math.abs(g.x - houseDoor.x) > 0.08) {
        g.x += Math.sign(houseDoor.x - g.x) * Math.min(Math.abs(houseDoor.x - g.x), exitSpeed * dt);
        g.dir = houseDoor.x > g.x ? 'RIGHT' : 'LEFT';
      } else {
        g.x = houseDoor.x;
        g.y -= exitSpeed * dt;
        g.dir = 'UP';
        if (g.y <= houseDoor.y) {
          g.y = houseDoor.y;
          g.dir = Math.random() < 0.5 ? 'LEFT' : 'RIGHT';
          g.mode =
            this.frightenedRemaining > 0 && !g.eatenThisPower && !g.stubborn
              ? 'FRIGHTENED'
              : this.globalGhostMode;
          g.lastDecisionTileKey = '';
        }
      }
      return;
    }

    if (g.mode === 'ENTERING_HOUSE') {
      const enterSpeed = 7.8 * speedMult;
      if (Math.abs(g.x - houseCenter.x) > 0.08) {
        g.x += Math.sign(houseCenter.x - g.x) * Math.min(Math.abs(houseCenter.x - g.x), enterSpeed * dt);
      } else {
        g.x = houseCenter.x;
        g.y += enterSpeed * dt;
        if (g.y >= houseCenter.y) {
          g.y = houseCenter.y;
          g.invisible = false;
          g.stubborn = false;
          g.mode = 'EXITING_HOUSE';
        }
      }
      return;
    }

    const levelFactor = Math.min(0.24, (this.level - 1) * 0.03);
    const inTunnel = this.maze.tunnelRows.includes(Math.floor(g.y)) && (g.x < 5 || g.x > GRID_COLS - 5);
    let ghostSpeed = (7.45 + levelFactor * 7.45) * speedMult;
    if (g.mode === 'FRIGHTENED') ghostSpeed = 4.35 * speedMult;
    else if (g.mode === 'EATEN') ghostSpeed = 14.2 * speedMult;
    else if (inTunnel) ghostSpeed *= 0.62;

    const col = Math.floor(g.x);
    const row = Math.floor(g.y);
    const cx = col + 0.5;
    const cy = row + 0.5;

    if (g.mode === 'EATEN' && distSq(g.x, g.y, houseDoor.x, houseDoor.y) < 0.25) {
      g.x = houseDoor.x;
      g.y = houseDoor.y;
      g.mode = 'ENTERING_HOUSE';
      return;
    }

    const tileKey = `${col},${row}`;
    const distCenter = Math.hypot(g.x - cx, g.y - cy);
    if (distCenter <= Math.max(0.14, ghostSpeed * dt * 1.15) && g.lastDecisionTileKey !== tileKey) {
      g.x = cx;
      g.y = cy;
      g.lastDecisionTileKey = tileKey;
      g.dir = this.chooseGhostDirection(g, col, row);
    }

    const v = DIR_VECTORS[g.dir];
    g.x += v.x * ghostSpeed * dt;
    g.y += v.y * ghostSpeed * dt;

    if (g.x < -0.45) g.x = GRID_COLS + 0.45;
    else if (g.x > GRID_COLS + 0.45) g.x = -0.45;
  }

  private chooseGhostDirection(g: PlusGhostState, col: number, row: number): Direction {
    const opposite = OPPOSITE_DIR[g.dir];
    const validDirs: Direction[] = [];
    for (const d of PRIORITY_DIRS) {
      if (d === opposite) continue;
      const v = DIR_VECTORS[d];
      if (isWalkableForGhost(this.grid, col + v.x, row + v.y, false)) {
        validDirs.push(d);
      }
    }
    if (validDirs.length === 0) {
      const rev = DIR_VECTORS[opposite];
      if (isWalkableForGhost(this.grid, col + rev.x, row + rev.y, false)) {
        return opposite;
      }
      return g.dir;
    }
    if (validDirs.length === 1) return validDirs[0];
    if (g.mode === 'FRIGHTENED') {
      return validDirs[Math.floor(Math.random() * validDirs.length)];
    }

    const target = this.getGhostTarget(g);
    let bestDir = validDirs[0];
    let bestDist = Infinity;
    for (const d of validDirs) {
      const v = DIR_VECTORS[d];
      const d2 = distSq(col + v.x + 0.5, row + v.y + 0.5, target.x, target.y);
      if (d2 < bestDist) {
        bestDist = d2;
        bestDir = d;
      }
    }
    return bestDir;
  }

  private getGhostTarget(g: PlusGhostState): Vec2 {
    if (g.mode === 'EATEN') return this.maze.ghostHouseDoor;
    if (g.mode === 'SCATTER') return g.scatterTarget;

    const p = this.player;
    const pv = DIR_VECTORS[p.facing];
    if (g.id === 'blinky') return { x: p.x, y: p.y };
    if (g.id === 'pinky') return { x: p.x + pv.x * 4, y: p.y + pv.y * 4 };
    if (g.id === 'inky') {
      const blinky = this.ghosts[0];
      const px = p.x + pv.x * 2;
      const py = p.y + pv.y * 2;
      return { x: px + (px - blinky.x), y: py + (py - blinky.y) };
    }
    const d2 = distSq(g.x, g.y, p.x, p.y);
    return d2 > 64 ? { x: p.x, y: p.y } : g.scatterTarget;
  }

  private checkGhostCollisions(isAttract: boolean): void {
    const p = this.player;
    for (const g of this.ghosts) {
      if (
        g.mode === 'IN_HOUSE' ||
        g.mode === 'EXITING_HOUSE' ||
        g.mode === 'ENTERING_HOUSE' ||
        g.mode === 'EATEN'
      ) {
        continue;
      }
      const d2 = distSq(p.x, p.y, g.x, g.y);
      if (d2 >= 0.62 * 0.62) continue;

      if (g.mode === 'FRIGHTENED') {
        g.mode = 'EATEN';
        g.eatenThisPower = true;
        g.invisible = false;
        this.ghostCombo = Math.min(4, this.ghostCombo + 1);
        const mult = this.doubleGhostPtsActive ? 2 : 1;
        const pts = 200 * Math.pow(2, this.ghostCombo - 1) * mult;
        if (!isAttract) {
          this.ghostsEatenTotal += 1;
          this.addScore(pts);
          arcadeAudio.playEatGhost();
          this.phase = 'GHOST_EATEN_PAUSE';
          this.phaseTimer = 0.42;
          this.eatenGhostFreezeId = g.id;
        }
        this.screenShake = 6;
        this.spawnBurst(g.x, g.y, this.doubleGhostPtsActive ? '#FDE047' : '#38BDF8', 22, 6.0);
        this.spawnPopup(
          g.x,
          g.y - 0.25,
          String(pts),
          this.doubleGhostPtsActive ? '#FDE047' : '#7DD3FC',
          1.2
        );
        return;
      }

      if (isAttract) {
        this.resetPositions();
        return;
      }

      this.phase = 'DYING';
      this.phaseTimer = 1.45;
      this.player.deathProgress = 0;
      this.screenShake = 8;
      arcadeAudio.stopAmbient();
      arcadeAudio.playDeath();
      this.spawnBurst(p.x, p.y, '#FFE135', 22, 5.2);
      return;
    }
  }

  private spawnBurst(x: number, y: number, color: string, count: number, speed: number): void {
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.45;
      const mag = speed * (0.4 + Math.random() * 0.85);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * mag,
        vy: Math.sin(a) * mag,
        life: 0.32 + Math.random() * 0.34,
        maxLife: 0.66,
        radius: 1.8 + Math.random() * 2.4,
        alpha: 1,
        color,
      });
    }
  }

  private spawnPopup(x: number, y: number, text: string, color: string, duration: number): void {
    this.popups.push({ x, y, text, color, life: duration, maxLife: duration, scale: 1 });
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.93;
      pt.vy *= 0.93;
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
  }

  private updatePopups(dt: number): void {
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.y -= dt * 0.72;
      pop.life -= dt;
      if (pop.life <= 0) this.popups.splice(i, 1);
    }
  }

  public getHudSnapshot(): PlusHudSnapshot {
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      isNewHighScore: this.isNewHighScore,
      lives: this.lives,
      level: this.level,
      pelletsLeft: this.pelletsLeft,
      totalPellets: this.totalPellets,
      ghostsEatenTotal: this.ghostsEatenTotal,
      wildcardsTriggered: this.wildcardsTriggered,
      bonusesCollected: [...this.bonusesCollected],
      currentBonus: this.currentBonus,
      bonusActive: this.bonus.active,
      frightenedRemaining: this.frightenedRemaining,
      mazeInvisibleRemaining: this.mazeInvisibleRemaining,
      doubleGhostPtsActive: this.doubleGhostPtsActive,
      activeWildcard: this.activeWildcard,
      extraLifeAwarded: this.extraLifeAwarded,
    };
  }
}

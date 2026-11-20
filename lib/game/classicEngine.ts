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
  PlayerState,
  SpeedMode,
  TileType,
  Vec2,
} from './types';

export type ClassicGhostId = 'blinky' | 'pinky' | 'inky' | 'clyde';

export type ClassicBonusType =
  | 'cherry'
  | 'strawberry'
  | 'orange'
  | 'apple'
  | 'melon'
  | 'galaxian'
  | 'bell'
  | 'key';

export interface ClassicBonusSpec {
  type: ClassicBonusType;
  label: string;
  points: number;
  color: string;
}

export const CLASSIC_BONUS_SPECS: Record<ClassicBonusType, ClassicBonusSpec> = {
  cherry: { type: 'cherry', label: 'Cherry', points: 100, color: '#FF3B5C' },
  strawberry: { type: 'strawberry', label: 'Strawberry', points: 300, color: '#FF4D79' },
  orange: { type: 'orange', label: 'Orange', points: 500, color: '#FF9829' },
  apple: { type: 'apple', label: 'Apple', points: 700, color: '#F43F5E' },
  melon: { type: 'melon', label: 'Melon', points: 1000, color: '#4ADE80' },
  galaxian: { type: 'galaxian', label: 'Galaxian', points: 2000, color: '#FACC15' },
  bell: { type: 'bell', label: 'Bell', points: 3000, color: '#FDE047' },
  key: { type: 'key', label: 'Key', points: 5000, color: '#38BDF8' },
};

export const CLASSIC_BONUS_ORDER: ClassicBonusType[] = [
  'cherry',
  'strawberry',
  'orange',
  'apple',
  'melon',
  'galaxian',
  'bell',
  'key',
];

export interface ClassicGhostState {
  id: ClassicGhostId;
  name: string;
  nickname: string;
  color: string;
  accentColor: string;
  x: number;
  y: number;
  dir: Direction;
  mode: GhostMode;
  previousMode: 'SCATTER' | 'CHASE';
  scatterTarget: Vec2;
  releaseDelay: number;
  eatenThisPower: boolean;
  animPhase: number;
  lastDecisionTileKey: string;
}

export interface ClassicHudSnapshot {
  phase: GamePhase;
  score: number;
  highScore: number;
  isNewHighScore: boolean;
  lives: number;
  level: number;
  pelletsLeft: number;
  totalPellets: number;
  ghostsEatenTotal: number;
  bonusesCollected: ClassicBonusType[];
  currentBonus: ClassicBonusType;
  bonusActive: boolean;
  frightenedRemaining: number;
  extraLifeAwarded: boolean;
}

const CLASSIC_HIGH_SCORE_KEY = 'classic_pacman_hd_highscore_v1';
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

export class ClassicPacManEngine {
  public phase: GamePhase = 'TITLE_MENU';
  public maze: MazeDefinition = CLASSIC_MAZE;
  public grid: TileType[][] = cloneMazeGrid(CLASSIC_MAZE);

  public score = 0;
  public highScore = 0;
  public isNewHighScore = false;
  public lives = 3;
  public level = 1;
  public pelletsLeft = 0;
  public pelletsEatenThisLevel = 0;
  public ghostsEatenTotal = 0;
  public bonusesCollected: ClassicBonusType[] = [];
  public extraLifeAwarded = false;
  public speedMode: SpeedMode = 'arcade';

  public player!: PlayerState;
  public ghosts: ClassicGhostState[] = [];
  public bonus = {
    active: false,
    type: 'cherry' as ClassicBonusType,
    x: 14,
    y: 17.5,
    timer: 0,
  };
  public particles: Particle[] = [];
  public popups: FloatingPopup[] = [];

  public elapsedTime = 0;
  public phaseTimer = 0;
  public frightenedTimer = 0;
  public ghostComboCount = 0;
  public eatenGhostId: ClassicGhostId | null = null;
  public stageClearFlashPhase = 0;

  private waveIndex = 0;
  private waveTimer = 0;
  private globalGhostMode: 'SCATTER' | 'CHASE' = 'SCATTER';
  private bonusSpawnCount = 0;
  private attractDecisionKey = '';

  constructor() {
    this.highScore = this.loadHighScore();
    this.resetLevelGrid();
    this.resetPositions();
    this.phase = 'TITLE_MENU';
  }

  private loadHighScore(): number {
    if (typeof window === 'undefined') return 0;
    try {
      const val = window.localStorage.getItem(CLASSIC_HIGH_SCORE_KEY);
      const parsed = val ? parseInt(val, 10) : 0;
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch {
      return 0;
    }
  }

  private saveHighScore(val: number): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(CLASSIC_HIGH_SCORE_KEY, String(val));
    } catch {
      // ignore
    }
  }

  public getCurrentBonusType(): ClassicBonusType {
    if (this.level === 1) return 'cherry';
    if (this.level === 2) return 'strawberry';
    if (this.level <= 4) return 'orange';
    if (this.level <= 6) return 'apple';
    if (this.level <= 8) return 'melon';
    if (this.level <= 10) return 'galaxian';
    if (this.level <= 12) return 'bell';
    return 'key';
  }

  public getHudSnapshot(): ClassicHudSnapshot {
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      isNewHighScore: this.isNewHighScore,
      lives: this.lives,
      level: this.level,
      pelletsLeft: this.pelletsLeft,
      totalPellets: this.maze.totalPellets,
      ghostsEatenTotal: this.ghostsEatenTotal,
      bonusesCollected: [...this.bonusesCollected],
      currentBonus: this.getCurrentBonusType(),
      bonusActive: this.bonus.active,
      frightenedRemaining: Math.max(0, this.frightenedTimer),
      extraLifeAwarded: this.extraLifeAwarded,
    };
  }

  public setSpeedMode(mode: SpeedMode): void {
    this.speedMode = mode;
  }

  public startNewGame(): void {
    arcadeAudio.unlock();
    this.score = 0;
    this.isNewHighScore = false;
    this.lives = 3;
    this.level = 1;
    this.ghostsEatenTotal = 0;
    this.bonusesCollected = [];
    this.extraLifeAwarded = false;
    this.particles = [];
    this.popups = [];
    this.resetLevelGrid();
    this.resetPositions();
    this.phase = 'READY';
    this.phaseTimer = 2.05;
    arcadeAudio.playClassicStartFanfare();
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') {
      this.phase = 'PAUSED';
      arcadeAudio.stopAmbient();
    } else if (this.phase === 'PAUSED') {
      this.phase = 'PLAYING';
    }
  }

  public returnToTitle(): void {
    arcadeAudio.stopAmbient();
    this.resetLevelGrid();
    this.resetPositions();
    this.particles = [];
    this.popups = [];
    this.phase = 'TITLE_MENU';
  }

  public setDesiredDirection(dir: Direction): void {
    if (dir === 'NONE') return;
    if (this.phase === 'PLAYING' || this.phase === 'READY' || this.phase === 'GHOST_EATEN_PAUSE') {
      this.player.nextDir = dir;
    }
  }

  private resetLevelGrid(): void {
    this.grid = cloneMazeGrid(this.maze);
    this.pelletsLeft = this.maze.totalPellets;
    this.pelletsEatenThisLevel = 0;
    this.bonusSpawnCount = 0;
  }

  private getBaseSpeedMultiplier(): number {
    const levelBoost = Math.min(0.28, (this.level - 1) * 0.032);
    const turboBoost = this.speedMode === 'turbo' ? 1.24 : 1.0;
    return (1 + levelBoost) * turboBoost;
  }

  private resetPositions(): void {
    const speedFactor = this.getBaseSpeedMultiplier();
    this.player = {
      x: this.maze.playerSpawn.x,
      y: this.maze.playerSpawn.y,
      dir: 'LEFT',
      nextDir: 'LEFT',
      mouthPhase: 0.35,
      moving: true,
      speed: 7.6 * speedFactor,
      deathProgress: 0,
      trail: [],
    };

    const releaseScale = Math.max(0.35, 1 - (this.level - 1) * 0.1);
    this.ghosts = [
      {
        id: 'blinky',
        name: 'Blinky',
        nickname: 'Shadow',
        color: '#FF2A42',
        accentColor: '#FF8593',
        x: 14,
        y: 11.5,
        dir: 'LEFT',
        mode: 'SCATTER',
        previousMode: 'SCATTER',
        scatterTarget: { x: 25.5, y: -2 },
        releaseDelay: 0,
        eatenThisPower: false,
        animPhase: 0,
        lastDecisionTileKey: '',
      },
      {
        id: 'pinky',
        name: 'Pinky',
        nickname: 'Speedy',
        color: '#FF80C8',
        accentColor: '#FFC4E6',
        x: 14,
        y: 14.5,
        dir: 'UP',
        mode: 'IN_HOUSE',
        previousMode: 'SCATTER',
        scatterTarget: { x: 2.5, y: -2 },
        releaseDelay: 0.6 * releaseScale,
        eatenThisPower: false,
        animPhase: 1.5,
        lastDecisionTileKey: '',
      },
      {
        id: 'inky',
        name: 'Inky',
        nickname: 'Bashful',
        color: '#1CE4FF',
        accentColor: '#A3F4FF',
        x: 12.2,
        y: 14.5,
        dir: 'UP',
        mode: 'IN_HOUSE',
        previousMode: 'SCATTER',
        scatterTarget: { x: 27.5, y: 31.5 },
        releaseDelay: 3.8 * releaseScale,
        eatenThisPower: false,
        animPhase: 3.1,
        lastDecisionTileKey: '',
      },
      {
        id: 'clyde',
        name: 'Clyde',
        nickname: 'Pokey',
        color: '#FF9B26',
        accentColor: '#FFD199',
        x: 15.8,
        y: 14.5,
        dir: 'DOWN',
        mode: 'IN_HOUSE',
        previousMode: 'SCATTER',
        scatterTarget: { x: 0.5, y: 31.5 },
        releaseDelay: 7.2 * releaseScale,
        eatenThisPower: false,
        animPhase: 4.7,
        lastDecisionTileKey: '',
      },
    ];

    this.bonus = {
      active: false,
      type: this.getCurrentBonusType(),
      x: 14,
      y: 17.5,
      timer: 0,
    };

    this.waveIndex = 0;
    this.waveTimer = 0;
    this.globalGhostMode = 'SCATTER';
    this.frightenedTimer = 0;
    this.ghostComboCount = 0;
    this.eatenGhostId = null;
    this.attractDecisionKey = '';
  }

  private addScore(points: number, popupX?: number, popupY?: number, popupColor = '#FFE45E'): void {
    this.score += points;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.isNewHighScore = true;
      this.saveHighScore(this.highScore);
    }

    if (!this.extraLifeAwarded && this.score >= EXTRA_LIFE_SCORE) {
      this.extraLifeAwarded = true;
      this.lives = Math.min(5, this.lives + 1);
      arcadeAudio.playExtraLife();
      this.popups.push({
        x: this.player.x,
        y: this.player.y - 0.8,
        text: '1UP!',
        color: '#4ADE80',
        life: 1.4,
        maxLife: 1.4,
        scale: 1.25,
      });
    }

    if (popupX !== undefined && popupY !== undefined) {
      this.popups.push({
        x: popupX,
        y: popupY,
        text: String(points),
        color: popupColor,
        life: 0.95,
        maxLife: 0.95,
        scale: points >= 800 ? 1.2 : 1.0,
      });
    }
  }

  private spawnParticles(x: number, y: number, color: string, count: number, speed: number, ring = false): void {
    if (ring) {
      this.particles.push({
        x,
        y,
        vx: 0,
        vy: 0,
        radius: 0.25,
        color,
        alpha: 0.95,
        life: 0.42,
        maxLife: 0.42,
        ring: true,
      });
    }
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.45;
      const mag = speed * (0.45 + Math.random() * 0.85);
      const maxLife = 0.28 + Math.random() * 0.34;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * mag,
        vy: Math.sin(angle) * mag,
        radius: 0.08 + Math.random() * 0.11,
        color,
        alpha: 1,
        life: maxLife,
        maxLife,
      });
    }
  }

  public step(dt: number): void {
    this.elapsedTime += dt;
    this.updateParticlesAndPopups(dt);

    if (this.phase === 'PAUSED' || this.phase === 'GAME_OVER') return;

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
        this.eatenGhostId = null;
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
          this.phaseTimer = 1.35;
        }
      }
      return;
    }

    if (this.phase === 'STAGE_CLEAR') {
      this.phaseTimer -= dt;
      this.stageClearFlashPhase += dt * 7.5;
      if (this.phaseTimer <= 0) {
        this.level += 1;
        this.resetLevelGrid();
        this.resetPositions();
        this.phase = 'READY';
        this.phaseTimer = 1.75;
        arcadeAudio.playClassicStartFanfare();
      }
      return;
    }

    this.updateWaveAndFrightened(dt);
    this.updatePlayer(dt, false);
    this.checkPelletConsumption();
    if (this.bonus.active) {
      this.bonus.timer -= dt;
      if (this.bonus.timer <= 0) this.bonus.active = false;
    }
    this.updateGhosts(dt);
    this.checkEntityCollisions();
    this.updateAmbientAudio(dt);
  }

  private stepAttractMode(dt: number): void {
    const col = Math.floor(this.player.x);
    const row = Math.floor(this.player.y);
    const key = `${col},${row}`;
    if (Math.hypot(this.player.x - (col + 0.5), this.player.y - (row + 0.5)) < 0.16 && key !== this.attractDecisionKey) {
      this.attractDecisionKey = key;
      const valid = PRIORITY_DIRS.filter((d) => {
        if (d === OPPOSITE_DIR[this.player.dir]) return false;
        const v = DIR_VECTORS[d];
        return isWalkableForPlayer(this.grid, wrapCol(col + v.x), row + v.y);
      });
      if (valid.length > 0) this.player.nextDir = valid[Math.floor(Math.random() * valid.length)];
    }
    this.updatePlayer(dt, true);
    this.updateWaveAndFrightened(dt);
    this.updateGhosts(dt);
    for (const ghost of this.ghosts) {
      if (ghost.mode === 'IN_HOUSE' || ghost.mode === 'EXITING_HOUSE') continue;
      if (distSq(this.player.x, this.player.y, ghost.x, ghost.y) < 0.65) {
        ghost.dir = OPPOSITE_DIR[ghost.dir];
      }
    }
  }

  private updateParticlesAndPopups(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      if (p.ring) {
        p.radius += dt * 4.2;
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.94;
        p.vy *= 0.94;
      }
      p.alpha = Math.max(0, p.life / p.maxLife);
    }

    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.life -= dt;
      pop.y -= dt * 0.65;
      if (pop.life <= 0) this.popups.splice(i, 1);
    }
  }

  private updateWaveAndFrightened(dt: number): void {
    if (this.frightenedTimer > 0) {
      this.frightenedTimer -= dt;
      if (this.frightenedTimer <= 0) {
        this.frightenedTimer = 0;
        this.ghostComboCount = 0;
        for (const ghost of this.ghosts) {
          if (ghost.mode === 'FRIGHTENED') ghost.mode = this.globalGhostMode;
          ghost.eatenThisPower = false;
        }
      }
      return;
    }

    const schedule: Array<{ mode: 'SCATTER' | 'CHASE'; duration: number }> = [
      { mode: 'SCATTER', duration: 7 },
      { mode: 'CHASE', duration: 20 },
      { mode: 'SCATTER', duration: 7 },
      { mode: 'CHASE', duration: 20 },
      { mode: 'SCATTER', duration: 5 },
      { mode: 'CHASE', duration: 20 },
      { mode: 'SCATTER', duration: 5 },
      { mode: 'CHASE', duration: 999999 },
    ];
    const current = schedule[Math.min(this.waveIndex, schedule.length - 1)];
    this.waveTimer += dt;
    if (this.waveTimer >= current.duration && this.waveIndex < schedule.length - 1) {
      this.waveTimer = 0;
      this.waveIndex += 1;
      const next = schedule[this.waveIndex];
      this.globalGhostMode = next.mode;
      for (const ghost of this.ghosts) {
        if (ghost.mode === 'SCATTER' || ghost.mode === 'CHASE') {
          ghost.mode = next.mode;
          ghost.previousMode = next.mode;
          ghost.dir = OPPOSITE_DIR[ghost.dir];
          ghost.lastDecisionTileKey = '';
        }
      }
    }
  }

  private updatePlayer(dt: number, attractMode: boolean): void {
    const p = this.player;
    const baseSpeed = 7.75 * this.getBaseSpeedMultiplier();
    p.speed = (attractMode ? baseSpeed * 0.85 : baseSpeed) * (this.frightenedTimer > 0 ? 1.07 : 1.0);

    if (p.moving && !attractMode) {
      p.trail.push({ x: p.x, y: p.y, alpha: 0.34 });
      if (p.trail.length > 6) p.trail.shift();
    }
    for (let i = p.trail.length - 1; i >= 0; i--) {
      p.trail[i].alpha -= dt * 2.2;
      if (p.trail[i].alpha <= 0) p.trail.splice(i, 1);
    }

    if (p.nextDir !== 'NONE' && p.nextDir === OPPOSITE_DIR[p.dir]) {
      p.dir = p.nextDir;
    }

    const col = Math.floor(p.x);
    const row = Math.floor(p.y);
    const centerX = col + 0.5;
    const centerY = row + 0.5;

    if (p.nextDir !== 'NONE' && p.nextDir !== p.dir) {
      const nv = DIR_VECTORS[p.nextDir];
      if (isWalkableForPlayer(this.grid, wrapCol(col + nv.x), row + nv.y)) {
        const alignDist =
          p.nextDir === 'UP' || p.nextDir === 'DOWN'
            ? Math.abs(p.x - centerX)
            : Math.abs(p.y - centerY);
        if (alignDist <= 0.28) {
          if (p.nextDir === 'UP' || p.nextDir === 'DOWN') p.x = centerX;
          else p.y = centerY;
          p.dir = p.nextDir;
        }
      }
    }

    const v = DIR_VECTORS[p.dir];
    const targetX = p.x + v.x * p.speed * dt;
    const targetY = p.y + v.y * p.speed * dt;

    if (p.dir === 'LEFT' || p.dir === 'RIGHT') {
      p.y += (centerY - p.y) * Math.min(1, dt * 24);
    } else if (p.dir === 'UP' || p.dir === 'DOWN') {
      p.x += (centerX - p.x) * Math.min(1, dt * 24);
    }

    const blockedAhead = !isWalkableForPlayer(this.grid, wrapCol(Math.floor(p.x) + v.x), Math.floor(p.y) + v.y);
    if (blockedAhead) {
      if (p.dir === 'RIGHT' && targetX > centerX) {
        p.x = centerX;
        p.moving = false;
      } else if (p.dir === 'LEFT' && targetX < centerX) {
        p.x = centerX;
        p.moving = false;
      } else if (p.dir === 'DOWN' && targetY > centerY) {
        p.y = centerY;
        p.moving = false;
      } else if (p.dir === 'UP' && targetY < centerY) {
        p.y = centerY;
        p.moving = false;
      } else {
        p.x = targetX;
        p.y = targetY;
        p.moving = true;
      }
    } else {
      p.x = targetX;
      p.y = targetY;
      p.moving = true;
    }

    if (p.x < -0.45) p.x = GRID_COLS + 0.45;
    else if (p.x > GRID_COLS + 0.45) p.x = -0.45;

    if (p.moving) p.mouthPhase += dt * 19.5;
  }

  private checkPelletConsumption(): void {
    const col = Math.floor(this.player.x);
    const row = Math.floor(this.player.y);
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return;
    const tile = this.grid[row][col];
    if (tile !== '.' && tile !== 'o') return;
    if (Math.hypot(this.player.x - (col + 0.5), this.player.y - (row + 0.5)) > 0.42) return;

    this.grid[row][col] = ' ';
    this.pelletsLeft -= 1;
    this.pelletsEatenThisLevel += 1;

    if (tile === '.') {
      this.addScore(10);
      arcadeAudio.playWaka();
      this.spawnParticles(col + 0.5, row + 0.5, this.maze.theme.pelletColor, 4, 2.3);
    } else {
      this.addScore(50);
      arcadeAudio.playPowerPellet();
      this.spawnParticles(col + 0.5, row + 0.5, '#FFE45E', 14, 4.6, true);
      this.triggerFrightenedMode();
    }

    // Classic stationary center bonus item after 70 & 170 dots
    if (
      (this.pelletsEatenThisLevel === 70 && this.bonusSpawnCount === 0) ||
      (this.pelletsEatenThisLevel === 170 && this.bonusSpawnCount === 1)
    ) {
      this.bonusSpawnCount += 1;
      this.bonus = {
        active: true,
        type: this.getCurrentBonusType(),
        x: 14,
        y: 17.5,
        timer: 10.5,
      };
    }

    if (this.pelletsLeft <= 0) {
      this.phase = 'STAGE_CLEAR';
      this.phaseTimer = 2.35;
      this.stageClearFlashPhase = 0;
      this.bonus.active = false;
      arcadeAudio.playStageClear();
    }
  }

  private triggerFrightenedMode(): void {
    const baseFright = Math.max(1.8, 7.6 - (this.level - 1) * 0.72);
    this.frightenedTimer = baseFright;
    this.ghostComboCount = 0;
    for (const ghost of this.ghosts) {
      if (ghost.mode === 'SCATTER' || ghost.mode === 'CHASE' || ghost.mode === 'FRIGHTENED') {
        ghost.mode = 'FRIGHTENED';
        ghost.dir = OPPOSITE_DIR[ghost.dir];
        ghost.lastDecisionTileKey = '';
      }
      ghost.eatenThisPower = false;
    }
  }

  private getGhostTarget(ghost: ClassicGhostState): Vec2 {
    if (ghost.mode === 'EATEN') return this.maze.ghostHouseDoor;
    if (ghost.mode === 'SCATTER') return ghost.scatterTarget;
    const px = this.player.x;
    const py = this.player.y;
    const pv = DIR_VECTORS[this.player.dir];
    switch (ghost.id) {
      case 'blinky':
        return { x: px, y: py };
      case 'pinky':
        return { x: px + pv.x * 4, y: py + pv.y * 4 };
      case 'inky': {
        const b = this.ghosts[0];
        const ax = px + pv.x * 2;
        const ay = py + pv.y * 2;
        return { x: ax + (ax - b.x), y: ay + (ay - b.y) };
      }
      case 'clyde':
        return distSq(ghost.x, ghost.y, px, py) > 64 ? { x: px, y: py } : ghost.scatterTarget;
    }
  }

  private updateGhosts(dt: number): void {
    const baseGhostSpeed = 7.2 * this.getBaseSpeedMultiplier();
    const elroyBoost = this.pelletsLeft <= 20 ? 1.08 : this.pelletsLeft <= 10 ? 1.13 : 1.0;

    for (const ghost of this.ghosts) {
      ghost.animPhase += dt * (ghost.mode === 'FRIGHTENED' ? 11 : 9);

      if (ghost.mode === 'IN_HOUSE') {
        ghost.releaseDelay -= dt;
        ghost.y = 14.5 + Math.sin(this.elapsedTime * 5.2 + ghost.animPhase) * 0.28;
        if (ghost.releaseDelay <= 0) ghost.mode = 'EXITING_HOUSE';
        continue;
      }

      if (ghost.mode === 'EXITING_HOUSE') {
        const exitSpeed = 4.2 * this.getBaseSpeedMultiplier();
        if (Math.abs(ghost.x - 14) > 0.08) {
          const dirX = Math.sign(14 - ghost.x);
          ghost.x += dirX * Math.min(Math.abs(14 - ghost.x), exitSpeed * dt);
          ghost.dir = dirX > 0 ? 'RIGHT' : 'LEFT';
        } else {
          ghost.x = 14;
          ghost.dir = 'UP';
          ghost.y -= exitSpeed * dt;
          if (ghost.y <= 11.5) {
            ghost.y = 11.5;
            ghost.dir = 'LEFT';
            ghost.mode =
              this.frightenedTimer > 0 && !ghost.eatenThisPower ? 'FRIGHTENED' : this.globalGhostMode;
            ghost.previousMode = this.globalGhostMode;
            ghost.lastDecisionTileKey = '';
          }
        }
        continue;
      }

      if (ghost.mode === 'EATEN') {
        if (Math.hypot(ghost.x - 14, ghost.y - 11.5) < 0.35) {
          ghost.x = 14;
          ghost.y = 14.5;
          ghost.mode = 'EXITING_HOUSE';
          ghost.eatenThisPower = true;
          this.spawnParticles(14, 14.5, ghost.color, 10, 2.8);
          continue;
        }
      }

      let speed = baseGhostSpeed;
      const inTunnel = Math.floor(ghost.y) === 14 && (ghost.x < 5.5 || ghost.x > GRID_COLS - 5.5);
      if (ghost.mode === 'EATEN') speed = baseGhostSpeed * 1.9;
      else if (ghost.mode === 'FRIGHTENED') speed = baseGhostSpeed * 0.58;
      else {
        if (ghost.id === 'blinky') speed *= elroyBoost;
        if (inTunnel) speed *= 0.55;
      }

      const col = Math.floor(ghost.x);
      const row = Math.floor(ghost.y);
      const centerX = col + 0.5;
      const centerY = row + 0.5;
      const tileKey = `${col},${row}`;

      if (col >= 0 && col < GRID_COLS && Math.hypot(ghost.x - centerX, ghost.y - centerY) <= Math.max(0.14, speed * dt * 0.85)) {
        if (tileKey !== ghost.lastDecisionTileKey) {
          ghost.lastDecisionTileKey = tileKey;
          const validDirs = PRIORITY_DIRS.filter((d) => {
            if (d === OPPOSITE_DIR[ghost.dir]) return false;
            const v = DIR_VECTORS[d];
            return isWalkableForGhost(this.grid, wrapCol(col + v.x), row + v.y, false);
          });

          if (validDirs.length === 0) ghost.dir = OPPOSITE_DIR[ghost.dir];
          else if (validDirs.length === 1) ghost.dir = validDirs[0];
          else if (ghost.mode === 'FRIGHTENED') {
            ghost.dir = validDirs[Math.floor(Math.random() * validDirs.length)];
          } else {
            const target = this.getGhostTarget(ghost);
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
            ghost.dir = bestDir;
          }

          if (ghost.dir === 'UP' || ghost.dir === 'DOWN') ghost.x = centerX;
          else ghost.y = centerY;
        }
      }

      const v = DIR_VECTORS[ghost.dir];
      ghost.x += v.x * speed * dt;
      ghost.y += v.y * speed * dt;
      if (ghost.x < -0.45) ghost.x = GRID_COLS + 0.45;
      else if (ghost.x > GRID_COLS + 0.45) ghost.x = -0.45;
    }
  }

  private checkEntityCollisions(): void {
    if (this.bonus.active && distSq(this.player.x, this.player.y, this.bonus.x, this.bonus.y) < 0.62) {
      const spec = CLASSIC_BONUS_SPECS[this.bonus.type];
      this.bonusesCollected.push(this.bonus.type);
      this.addScore(spec.points, this.bonus.x, this.bonus.y - 0.2, '#FDE047');
      this.spawnParticles(this.bonus.x, this.bonus.y, spec.color, 18, 4.4, true);
      this.bonus.active = false;
      arcadeAudio.playEatFruit();
    }

    for (const ghost of this.ghosts) {
      if (ghost.mode === 'IN_HOUSE' || ghost.mode === 'EXITING_HOUSE' || ghost.mode === 'EATEN') continue;
      if (distSq(this.player.x, this.player.y, ghost.x, ghost.y) < 0.48) {
        if (ghost.mode === 'FRIGHTENED') {
          this.ghostComboCount += 1;
          const pts = 200 * Math.pow(2, Math.min(3, this.ghostComboCount - 1));
          this.ghostsEatenTotal += 1;
          ghost.mode = 'EATEN';
          ghost.eatenThisPower = true;
          ghost.lastDecisionTileKey = '';
          this.eatenGhostId = ghost.id;
          this.addScore(pts, ghost.x, ghost.y - 0.15, '#5EEAD4');
          this.spawnParticles(ghost.x, ghost.y, '#38BDF8', 22, 5.2, true);
          arcadeAudio.playEatGhost();
          this.phase = 'GHOST_EATEN_PAUSE';
          this.phaseTimer = 0.46;
          return;
        } else {
          this.phase = 'DYING';
          this.phaseTimer = 1.45;
          this.player.deathProgress = 0;
          this.spawnParticles(this.player.x, this.player.y, '#FACC15', 16, 3.6);
          arcadeAudio.playDeath();
          return;
        }
      }
    }
  }

  private updateAmbientAudio(dt: number): void {
    const anyEyes = this.ghosts.some((g) => g.mode === 'EATEN');
    const intensity = 1 - this.pelletsLeft / Math.max(1, this.maze.totalPellets);
    if (anyEyes) arcadeAudio.updateAmbient('eyes', dt, intensity);
    else if (this.frightenedTimer > 0) arcadeAudio.updateAmbient('fright', dt, intensity);
    else arcadeAudio.updateAmbient('siren', dt, intensity);
  }
}

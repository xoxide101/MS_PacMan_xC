import { arcadeAudio } from './audio';
import {
  cloneMazeGrid,
  getMazeIndexForLevel,
  isWalkableForGhost,
  isWalkableForPlayer,
  MAZES,
} from './mazes';
import {
  Direction,
  FloatingPopup,
  FRUIT_SPECS,
  FruitType,
  GamePhase,
  GhostId,
  GhostState,
  GRID_COLS,
  GRID_ROWS,
  HudSnapshot,
  LEVEL_FRUIT_ORDER,
  MazeDefinition,
  Particle,
  PlayerState,
  RoamingFruit,
  SpeedMode,
  TileType,
  Vec2,
} from './types';

const HIGH_SCORE_STORAGE_KEY = 'ms_pacman_hd_highscore_v1';
const EXTRA_LIFE_SCORE = 10000;

export const DIR_VECTORS: Record<Direction, Vec2> = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
  NONE: { x: 0, y: 0 },
};

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

export class MsPacManEngine {
  public phase: GamePhase = 'TITLE_MENU';
  public mazeIndex = 0;
  public maze: MazeDefinition = MAZES[0];
  public grid: TileType[][] = cloneMazeGrid(MAZES[0]);

  public score = 0;
  public highScore = 0;
  public isNewHighScore = false;
  public lives = 3;
  public level = 1;
  public pelletsLeft = 0;
  public pelletsEatenThisLevel = 0;
  public ghostsEatenTotal = 0;
  public fruitsCollected: FruitType[] = [];
  public extraLifeAwarded = false;

  public speedMode: SpeedMode = 'arcade';

  public player!: PlayerState;
  public ghosts: GhostState[] = [];
  public fruit!: RoamingFruit;
  public particles: Particle[] = [];
  public popups: FloatingPopup[] = [];

  public elapsedTime = 0;
  public phaseTimer = 0;
  public frightenedTimer = 0;
  public frightenedDuration = 7.0;
  public ghostComboCount = 0;
  public eatenGhostId: GhostId | null = null;
  public stageClearFlashPhase = 0;

  // Global Scatter/Chase wave schedule
  private waveIndex = 0;
  private waveTimer = 0;
  private globalGhostMode: 'SCATTER' | 'CHASE' = 'SCATTER';

  // Fruit spawning milestones (64 and 176 pellets eaten)
  private fruitSpawnCountThisLevel = 0;
  private fruitBounceSoundCooldown = 0;
  private fruitActiveTimer = 0;

  // Attract mode AI timer (when on TITLE_MENU)
  private attractDecisionKey = '';

  constructor() {
    this.highScore = this.loadHighScore();
    this.setupMaze(0, true);
    this.resetPositions();
    this.phase = 'TITLE_MENU';
  }

  private loadHighScore(): number {
    if (typeof window === 'undefined') return 0;
    try {
      const saved = window.localStorage.getItem(HIGH_SCORE_STORAGE_KEY);
      const parsed = saved ? parseInt(saved, 10) : 0;
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch {
      return 0;
    }
  }

  private saveHighScore(val: number): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(HIGH_SCORE_STORAGE_KEY, String(val));
    } catch {
      // ignore storage errors
    }
  }

  public getCurrentFruitType(): FruitType {
    const idx = Math.min(this.level - 1, LEVEL_FRUIT_ORDER.length - 1);
    // After level 7, Ms. Pac-Man picks randomly among all 7 fruits on each stage,
    // deterministic per level so HUD preview stays consistent.
    if (this.level > LEVEL_FRUIT_ORDER.length) {
      return LEVEL_FRUIT_ORDER[(this.level * 3 + 2) % LEVEL_FRUIT_ORDER.length];
    }
    return LEVEL_FRUIT_ORDER[idx];
  }

  public getHudSnapshot(): HudSnapshot {
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      isNewHighScore: this.isNewHighScore,
      lives: this.lives,
      level: this.level,
      mazeIndex: this.mazeIndex,
      mazeName: this.maze.theme.name,
      mazeAccent: this.maze.theme.accentHex,
      pelletsLeft: this.pelletsLeft,
      totalPellets: this.maze.totalPellets,
      ghostsEatenTotal: this.ghostsEatenTotal,
      fruitsCollected: [...this.fruitsCollected],
      currentFruit: this.getCurrentFruitType(),
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
    this.fruitsCollected = [];
    this.extraLifeAwarded = false;
    this.particles = [];
    this.popups = [];
    this.setupMaze(getMazeIndexForLevel(1), true);
    this.resetPositions();
    this.phase = 'READY';
    this.phaseTimer = 2.05;
    arcadeAudio.playStartFanfare();
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
    this.setupMaze(0, true);
    this.resetPositions();
    this.particles = [];
    this.popups = [];
    this.phase = 'TITLE_MENU';
  }

  public previewMaze(mazeIdx: number): void {
    if (this.phase !== 'TITLE_MENU') return;
    this.setupMaze(mazeIdx, true);
    this.resetPositions();
    this.particles = [];
    this.popups = [];
  }

  public setDesiredDirection(dir: Direction): void {
    if (dir === 'NONE') return;
    if (this.phase === 'PLAYING' || this.phase === 'READY' || this.phase === 'GHOST_EATEN_PAUSE') {
      this.player.nextDir = dir;
    }
  }

  private setupMaze(mazeIdx: number, resetPellets: boolean): void {
    this.mazeIndex = mazeIdx % MAZES.length;
    this.maze = MAZES[this.mazeIndex];
    if (resetPellets) {
      this.grid = cloneMazeGrid(this.maze);
      this.pelletsLeft = this.maze.totalPellets;
      this.pelletsEatenThisLevel = 0;
      this.fruitSpawnCountThisLevel = 0;
    }
  }

  private getWaveSchedule(): Array<{ mode: 'SCATTER' | 'CHASE'; duration: number }> {
    const fast = this.level >= 5;
    return [
      { mode: 'SCATTER', duration: fast ? 5 : 7 },
      { mode: 'CHASE', duration: 20 },
      { mode: 'SCATTER', duration: fast ? 5 : 7 },
      { mode: 'CHASE', duration: 20 },
      { mode: 'SCATTER', duration: 5 },
      { mode: 'CHASE', duration: fast ? 1037 : 20 },
      { mode: 'SCATTER', duration: fast ? 0.1 : 5 },
      { mode: 'CHASE', duration: 999999 },
    ];
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
      speed: 7.5 * speedFactor,
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
        houseTarget: { x: 14, y: 14.5 },
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
        houseTarget: { x: 14, y: 14.5 },
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
        houseTarget: { x: 12.2, y: 14.5 },
        releaseDelay: 3.6 * releaseScale,
        eatenThisPower: false,
        animPhase: 3.1,
        lastDecisionTileKey: '',
      },
      {
        id: 'sue',
        name: 'Sue',
        nickname: 'Pokey',
        color: '#FF9B26',
        accentColor: '#FFD199',
        x: 15.8,
        y: 14.5,
        dir: 'DOWN',
        mode: 'IN_HOUSE',
        previousMode: 'SCATTER',
        scatterTarget: { x: 0.5, y: 31.5 },
        houseTarget: { x: 15.8, y: 14.5 },
        releaseDelay: 6.8 * releaseScale,
        eatenThisPower: false,
        animPhase: 4.7,
        lastDecisionTileKey: '',
      },
    ];

    this.fruit = {
      active: false,
      type: this.getCurrentFruitType(),
      points: FRUIT_SPECS[this.getCurrentFruitType()].points,
      x: -1,
      y: this.maze.tunnelRows[0] + 0.5,
      dir: 'RIGHT',
      bouncePhase: 0,
      stage: 'TO_CENTER',
      exitRow: this.maze.tunnelRows[0],
      exitSide: 'RIGHT',
      lastDecisionTileKey: '',
    };

    this.waveIndex = 0;
    this.waveTimer = 0;
    this.globalGhostMode = 'SCATTER';
    this.frightenedTimer = 0;
    this.ghostComboCount = 0;
    this.eatenGhostId = null;
    this.attractDecisionKey = '';
  }

  private getBaseSpeedMultiplier(): number {
    const levelBoost = Math.min(0.28, (this.level - 1) * 0.032);
    const turboBoost = this.speedMode === 'turbo' ? 1.24 : 1.0;
    return (1 + levelBoost) * turboBoost;
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

  private spawnParticles(
    x: number,
    y: number,
    color: string,
    count: number,
    speed: number,
    ring = false
  ): void {
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

    if (this.phase === 'PAUSED' || this.phase === 'GAME_OVER') {
      return;
    }

    if (this.phase === 'TITLE_MENU') {
      this.stepAttractMode(dt);
      return;
    }

    if (this.phase === 'READY') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.phase = 'PLAYING';
      }
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
      const totalDeathDuration = 1.45;
      this.player.deathProgress = Math.min(1, 1 - this.phaseTimer / totalDeathDuration);
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
        this.setupMaze(getMazeIndexForLevel(this.level), true);
        this.resetPositions();
        this.phase = 'READY';
        this.phaseTimer = 1.75;
        arcadeAudio.playStartFanfare();
      }
      return;
    }

    // Active PLAYING state
    this.updateWaveAndFrightened(dt);
    this.updatePlayer(dt, false);
    this.checkPelletConsumption();
    this.updateRoamingFruit(dt);
    this.updateGhosts(dt);
    this.checkEntityCollisions();
    this.updateAmbientAudio(dt);
  }

  private stepAttractMode(dt: number): void {
    // Live autonomous cruise for Title Screen backdrop
    const col = Math.floor(this.player.x);
    const row = Math.floor(this.player.y);
    const key = `${col},${row}`;
    const distToCenter = Math.hypot(this.player.x - (col + 0.5), this.player.y - (row + 0.5));
    if (distToCenter < 0.16 && key !== this.attractDecisionKey) {
      this.attractDecisionKey = key;
      const valid = PRIORITY_DIRS.filter((d) => {
        if (d === OPPOSITE_DIR[this.player.dir]) return false;
        const v = DIR_VECTORS[d];
        return isWalkableForPlayer(this.grid, col + v.x, row + v.y);
      });
      if (valid.length > 0) {
        this.player.nextDir = valid[Math.floor(Math.random() * valid.length)];
      }
    }

    this.updatePlayer(dt, true);
    this.updateWaveAndFrightened(dt);
    this.updateGhosts(dt);

    // If a ghost touches Ms. Pac-Man in attract mode, playfully bounce ghosts into frightened scatter
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
      if (pop.life <= 0) {
        this.popups.splice(i, 1);
      }
    }
  }

  private updateWaveAndFrightened(dt: number): void {
    if (this.frightenedTimer > 0) {
      this.frightenedTimer -= dt;
      if (this.frightenedTimer <= 0) {
        this.frightenedTimer = 0;
        this.ghostComboCount = 0;
        for (const ghost of this.ghosts) {
          if (ghost.mode === 'FRIGHTENED') {
            ghost.mode = this.globalGhostMode;
          }
          ghost.eatenThisPower = false;
        }
      }
      return;
    }

    const schedule = this.getWaveSchedule();
    const currentWave = schedule[Math.min(this.waveIndex, schedule.length - 1)];
    this.waveTimer += dt;
    if (this.waveTimer >= currentWave.duration && this.waveIndex < schedule.length - 1) {
      this.waveTimer = 0;
      this.waveIndex += 1;
      const nextWave = schedule[this.waveIndex];
      this.globalGhostMode = nextWave.mode;
      for (const ghost of this.ghosts) {
        if (ghost.mode === 'SCATTER' || ghost.mode === 'CHASE') {
          ghost.mode = nextWave.mode;
          ghost.previousMode = nextWave.mode;
          ghost.dir = OPPOSITE_DIR[ghost.dir];
          ghost.lastDecisionTileKey = '';
        }
      }
    }
  }

  private updatePlayer(dt: number, attractMode: boolean): void {
    const p = this.player;
    const baseSpeed = 7.75 * this.getBaseSpeedMultiplier();
    const frightBonus = this.frightenedTimer > 0 ? 1.07 : 1.0;
    p.speed = (attractMode ? baseSpeed * 0.85 : baseSpeed) * frightBonus;

    // Trail update for silky HD motion feel
    if (p.moving && !attractMode) {
      p.trail.push({ x: p.x, y: p.y, alpha: 0.38 });
      if (p.trail.length > 6) p.trail.shift();
    }
    for (let i = p.trail.length - 1; i >= 0; i--) {
      p.trail[i].alpha -= dt * 2.2;
      if (p.trail[i].alpha <= 0) p.trail.splice(i, 1);
    }

    // Instant 180-degree reversal
    if (p.nextDir !== 'NONE' && p.nextDir === OPPOSITE_DIR[p.dir]) {
      p.dir = p.nextDir;
    }

    const col = Math.floor(p.x);
    const row = Math.floor(p.y);
    const centerX = col + 0.5;
    const centerY = row + 0.5;

    // Responsive pre-cornering buffered turn check
    if (p.nextDir !== 'NONE' && p.nextDir !== p.dir) {
      const nv = DIR_VECTORS[p.nextDir];
      const nextCol = wrapCol(col + nv.x);
      const nextRow = row + nv.y;
      const canTurn = isWalkableForPlayer(this.grid, nextCol, nextRow);

      if (canTurn) {
        const alignDist =
          p.nextDir === 'UP' || p.nextDir === 'DOWN'
            ? Math.abs(p.x - centerX)
            : Math.abs(p.y - centerY);
        if (alignDist <= 0.28) {
          // Snap cleanly onto perpendicular track center
          if (p.nextDir === 'UP' || p.nextDir === 'DOWN') {
            p.x = centerX;
          } else {
            p.y = centerY;
          }
          p.dir = p.nextDir;
        }
      }
    }

    // Move along current direction
    const v = DIR_VECTORS[p.dir];
    const stepDist = p.speed * dt;
    const targetX = p.x + v.x * stepDist;
    const targetY = p.y + v.y * stepDist;

    // Gentle lane centering perpendicular to motion
    if (p.dir === 'LEFT' || p.dir === 'RIGHT') {
      p.y += (centerY - p.y) * Math.min(1, dt * 24);
    } else if (p.dir === 'UP' || p.dir === 'DOWN') {
      p.x += (centerX - p.x) * Math.min(1, dt * 24);
    }

    // Check forward wall collision
    const aheadCol = wrapCol(Math.floor(p.x) + v.x);
    const aheadRow = Math.floor(p.y) + v.y;
    const blockedAhead = !isWalkableForPlayer(this.grid, aheadCol, aheadRow);

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

    // Tunnel wraparound
    if (p.x < -0.45) {
      p.x = GRID_COLS + 0.45;
    } else if (p.x > GRID_COLS + 0.45) {
      p.x = -0.45;
    }

    // Smooth 60fps mouth chomping
    if (p.moving) {
      p.mouthPhase += dt * 19.5;
    }
  }

  private checkPelletConsumption(): void {
    const col = Math.floor(this.player.x);
    const row = Math.floor(this.player.y);
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return;

    const tile = this.grid[row][col];
    if (tile !== '.' && tile !== 'o') return;

    const d = Math.hypot(this.player.x - (col + 0.5), this.player.y - (row + 0.5));
    if (d > 0.42) return;

    this.grid[row][col] = ' ';
    this.pelletsLeft -= 1;
    this.pelletsEatenThisLevel += 1;

    if (tile === '.') {
      this.addScore(10);
      arcadeAudio.playWaka();
      this.spawnParticles(col + 0.5, row + 0.5, this.maze.theme.pelletColor, 4, 2.4);
    } else if (tile === 'o') {
      this.addScore(50);
      arcadeAudio.playPowerPellet();
      this.spawnParticles(col + 0.5, row + 0.5, '#FFE45E', 14, 4.6, true);
      this.triggerFrightenedMode();
    }

    // Check roaming bonus fruit milestones (64 and 176 pellets eaten)
    if (
      (this.pelletsEatenThisLevel === 64 && this.fruitSpawnCountThisLevel === 0) ||
      (this.pelletsEatenThisLevel === 176 && this.fruitSpawnCountThisLevel === 1)
    ) {
      this.fruitSpawnCountThisLevel += 1;
      this.spawnRoamingFruit();
    }

    // Stage clear check!
    if (this.pelletsLeft <= 0) {
      this.phase = 'STAGE_CLEAR';
      this.phaseTimer = 2.35;
      this.stageClearFlashPhase = 0;
      this.fruit.active = false;
      arcadeAudio.playStageClear();
    }
  }

  private triggerFrightenedMode(): void {
    const baseFright = Math.max(1.8, 7.6 - (this.level - 1) * 0.72);
    this.frightenedDuration = baseFright;
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

  private spawnRoamingFruit(): void {
    const type = this.getCurrentFruitType();
    const spec = FRUIT_SPECS[type];
    const tunnels = this.maze.tunnelRows;
    const entryRow = tunnels[Math.floor(Math.random() * tunnels.length)];
    const exitRow = tunnels[Math.floor(Math.random() * tunnels.length)];
    const fromLeft = Math.random() < 0.5;

    this.fruitActiveTimer = 24;
    this.fruit = {
      active: true,
      type,
      points: spec.points,
      x: fromLeft ? 0.2 : GRID_COLS - 0.2,
      y: entryRow + 0.5,
      dir: fromLeft ? 'RIGHT' : 'LEFT',
      bouncePhase: 0,
      stage: 'TO_CENTER',
      exitRow,
      exitSide: Math.random() < 0.5 ? 'LEFT' : 'RIGHT',
      lastDecisionTileKey: '',
    };
  }

  private updateRoamingFruit(dt: number): void {
    if (!this.fruit.active) return;

    this.fruitActiveTimer -= dt;
    if (this.fruitActiveTimer <= 0) {
      this.fruit.active = false;
      return;
    }

    const f = this.fruit;
    const speed = 3.55 * this.getBaseSpeedMultiplier();
    f.bouncePhase += dt * 11.5;

    this.fruitBounceSoundCooldown -= dt;
    if (this.fruitBounceSoundCooldown <= 0 && Math.abs(Math.sin(f.bouncePhase)) < 0.12) {
      arcadeAudio.playFruitBounce();
      this.fruitBounceSoundCooldown = 0.55;
    }

    const col = Math.floor(f.x);
    const row = Math.floor(f.y);
    const centerX = col + 0.5;
    const centerY = row + 0.5;
    const key = `${col},${row}`;

    // Transition from heading toward center to heading out an exit tunnel
    if (f.stage === 'TO_CENTER' && distSq(f.x, f.y, 14, 17.5) < 1.2) {
      f.stage = 'TO_EXIT';
      f.lastDecisionTileKey = '';
    }

    // Decide turns cleanly at tile centers
    if (
      col >= 0 &&
      col < GRID_COLS &&
      Math.hypot(f.x - centerX, f.y - centerY) < 0.14 &&
      key !== f.lastDecisionTileKey
    ) {
      f.lastDecisionTileKey = key;
      const target: Vec2 =
        f.stage === 'TO_CENTER'
          ? { x: 14, y: 17.5 }
          : { x: f.exitSide === 'LEFT' ? -1 : GRID_COLS + 1, y: f.exitRow + 0.5 };

      const valid = PRIORITY_DIRS.filter((d) => {
        if (d === OPPOSITE_DIR[f.dir]) return false;
        const v = DIR_VECTORS[d];
        const nc = col + v.x;
        const nr = row + v.y;
        // Allow fruit to step out of the map only on exit stage at exit row
        if (nc < 0 || nc >= GRID_COLS) {
          return f.stage === 'TO_EXIT' && nr === f.exitRow;
        }
        return isWalkableForPlayer(this.grid, nc, nr);
      });

      if (valid.length > 0) {
        let bestDir = valid[0];
        let bestDist = Infinity;
        for (const d of valid) {
          const v = DIR_VECTORS[d];
          const d2 = distSq(col + v.x + 0.5, row + v.y + 0.5, target.x, target.y);
          if (d2 < bestDist) {
            bestDist = d2;
            bestDir = d;
          }
        }
        f.dir = bestDir;
        f.x = centerX;
        f.y = centerY;
      }
    }

    const v = DIR_VECTORS[f.dir];
    f.x += v.x * speed * dt;
    f.y += v.y * speed * dt;

    // Despawn once it exits out of the maze tunnel
    if (f.stage === 'TO_EXIT' && (f.x < -0.6 || f.x > GRID_COLS + 0.6)) {
      f.active = false;
    }
  }

  private getGhostTarget(ghost: GhostState): Vec2 {
    if (ghost.mode === 'EATEN') {
      return { x: this.maze.ghostHouseDoor.x, y: this.maze.ghostHouseDoor.y };
    }

    if (ghost.mode === 'SCATTER') {
      return ghost.scatterTarget;
    }

    // Authentic Ms. Pac-Man Chase targeting for Blinky, Pinky, Inky, Sue
    const px = this.player.x;
    const py = this.player.y;
    const pv = DIR_VECTORS[this.player.dir];

    switch (ghost.id) {
      case 'blinky':
        return { x: px, y: py };

      case 'pinky':
        return { x: px + pv.x * 4, y: py + pv.y * 4 };

      case 'inky': {
        const blinky = this.ghosts[0];
        const aheadX = px + pv.x * 2;
        const aheadY = py + pv.y * 2;
        return {
          x: aheadX + (aheadX - blinky.x),
          y: aheadY + (aheadY - blinky.y),
        };
      }

      case 'sue': {
        const d2 = distSq(ghost.x, ghost.y, px, py);
        if (d2 > 64) {
          return { x: px, y: py };
        }
        return ghost.scatterTarget;
      }
    }
  }

  private updateGhosts(dt: number): void {
    const baseGhostSpeed = 7.2 * this.getBaseSpeedMultiplier();
    const elroyBoost = this.pelletsLeft <= 24 ? 1.07 : this.pelletsLeft <= 10 ? 1.12 : 1.0;

    for (const ghost of this.ghosts) {
      ghost.animPhase += dt * (ghost.mode === 'FRIGHTENED' ? 11 : 9);

      if (ghost.mode === 'IN_HOUSE') {
        ghost.releaseDelay -= dt;
        // Smooth bobbing inside the ghost house
        ghost.y = 14.5 + Math.sin(this.elapsedTime * 5.2 + ghost.animPhase) * 0.28;
        if (ghost.releaseDelay <= 0) {
          ghost.mode = 'EXITING_HOUSE';
        }
        continue;
      }

      if (ghost.mode === 'EXITING_HOUSE') {
        const exitSpeed = 4.2 * this.getBaseSpeedMultiplier();
        const centerX = 14;
        const doorY = 11.5;

        if (Math.abs(ghost.x - centerX) > 0.08) {
          const dirX = Math.sign(centerX - ghost.x);
          ghost.x += dirX * Math.min(Math.abs(centerX - ghost.x), exitSpeed * dt);
          ghost.dir = dirX > 0 ? 'RIGHT' : 'LEFT';
        } else {
          ghost.x = centerX;
          ghost.dir = 'UP';
          ghost.y -= exitSpeed * dt;
          if (ghost.y <= doorY) {
            ghost.y = doorY;
            ghost.dir = Math.random() < 0.5 ? 'LEFT' : 'RIGHT';
            ghost.mode =
              this.frightenedTimer > 0 && !ghost.eatenThisPower
                ? 'FRIGHTENED'
                : this.globalGhostMode;
            ghost.previousMode = this.globalGhostMode;
            ghost.lastDecisionTileKey = '';
          }
        }
        continue;
      }

      // Check if EATEN eyes have reached the ghost house door
      if (ghost.mode === 'EATEN') {
        const distToDoor = Math.hypot(
          ghost.x - this.maze.ghostHouseDoor.x,
          ghost.y - this.maze.ghostHouseDoor.y
        );
        if (distToDoor < 0.35) {
          // Drop smoothly inside and regenerate
          ghost.x = 14;
          ghost.y = 14.5;
          ghost.mode = 'EXITING_HOUSE';
          ghost.eatenThisPower = true;
          this.spawnParticles(14, 14.5, ghost.color, 10, 2.8);
          continue;
        }
      }

      // Compute speed based on state & tunnel slowdown
      let speed = baseGhostSpeed;
      const inTunnel =
        this.maze.tunnelRows.includes(Math.floor(ghost.y)) &&
        (ghost.x < 4.5 || ghost.x > GRID_COLS - 4.5);

      if (ghost.mode === 'EATEN') {
        speed = baseGhostSpeed * 1.9;
      } else if (ghost.mode === 'FRIGHTENED') {
        speed = baseGhostSpeed * 0.58;
      } else {
        if (ghost.id === 'blinky') speed *= elroyBoost;
        if (inTunnel) speed *= 0.56;
      }

      const col = Math.floor(ghost.x);
      const row = Math.floor(ghost.y);
      const centerX = col + 0.5;
      const centerY = row + 0.5;
      const tileKey = `${col},${row}`;

      // Make intersection turn choice when crossing tile center
      const distToCenter = Math.hypot(ghost.x - centerX, ghost.y - centerY);
      if (col >= 0 && col < GRID_COLS && distToCenter <= Math.max(0.14, speed * dt * 0.85)) {
        if (tileKey !== ghost.lastDecisionTileKey) {
          ghost.lastDecisionTileKey = tileKey;

          const validDirs = PRIORITY_DIRS.filter((d) => {
            if (d === OPPOSITE_DIR[ghost.dir]) return false;
            const v = DIR_VECTORS[d];
            const nc = wrapCol(col + v.x);
            const nr = row + v.y;
            return isWalkableForGhost(this.grid, nc, nr, false);
          });

          if (validDirs.length === 0) {
            // Fallback: reverse if cornered
            ghost.dir = OPPOSITE_DIR[ghost.dir];
          } else if (validDirs.length === 1) {
            ghost.dir = validDirs[0];
          } else if (
            ghost.mode === 'FRIGHTENED' ||
            (this.waveIndex === 0 &&
              ghost.mode === 'SCATTER' &&
              (ghost.id === 'blinky' || ghost.id === 'pinky'))
          ) {
            // Authentic Ms. Pac-Man: frightened ghosts & Blinky/Pinky in Wave 0 scatter choose randomly!
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

          // Snap cleanly onto tile center when turning
          if (ghost.dir === 'UP' || ghost.dir === 'DOWN') {
            ghost.x = centerX;
          } else {
            ghost.y = centerY;
          }
        }
      }

      const v = DIR_VECTORS[ghost.dir];
      ghost.x += v.x * speed * dt;
      ghost.y += v.y * speed * dt;

      // Tunnel wraparound
      if (ghost.x < -0.45) {
        ghost.x = GRID_COLS + 0.45;
      } else if (ghost.x > GRID_COLS + 0.45) {
        ghost.x = -0.45;
      }
    }
  }

  private checkEntityCollisions(): void {
    // 1. Roaming Fruit collision
    if (this.fruit.active) {
      if (distSq(this.player.x, this.player.y, this.fruit.x, this.fruit.y) < 0.62) {
        const spec = FRUIT_SPECS[this.fruit.type];
        this.fruitsCollected.push(this.fruit.type);
        this.addScore(spec.points, this.fruit.x, this.fruit.y - 0.25, '#FF9BE2');
        this.spawnParticles(this.fruit.x, this.fruit.y, spec.color, 18, 4.4, true);
        this.fruit.active = false;
        arcadeAudio.playEatFruit();
      }
    }

    // 2. Ghost collisions
    for (const ghost of this.ghosts) {
      if (ghost.mode === 'IN_HOUSE' || ghost.mode === 'EXITING_HOUSE' || ghost.mode === 'EATEN') {
        continue;
      }

      const d2 = distSq(this.player.x, this.player.y, ghost.x, ghost.y);
      if (d2 < 0.48) {
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
          // Ms. Pac-Man caught!
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
    if (anyEyes) {
      arcadeAudio.updateAmbient('eyes', dt, intensity);
    } else if (this.frightenedTimer > 0) {
      arcadeAudio.updateAmbient('fright', dt, intensity);
    } else {
      arcadeAudio.updateAmbient('siren', dt, intensity);
    }
  }
}

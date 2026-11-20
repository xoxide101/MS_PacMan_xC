import { arcadeAudio } from './audio';
import { DIR_VECTORS } from './engine';
import {
  cloneSuperGrid,
  isSuperWalkableForGhost,
  isSuperWalkableForPlayer,
  SUPER_MAZE,
  SUPER_THEMES,
} from './superMazes';
import {
  SUPER_PRIZE_ORDER,
  SUPER_PRIZE_SPECS,
  SuperGhostId,
  SuperGhostState,
  SuperHudSnapshot,
  SuperMazeTheme,
  SuperPlayerState,
  SuperPrizeType,
  SuperTileType,
} from './superTypes';
import {
  Direction,
  FloatingPopup,
  GamePhase,
  GRID_COLS,
  GRID_ROWS,
  Particle,
  SpeedMode,
  Vec2,
} from './types';

const SUPER_HIGH_SCORE_KEY = 'super_pacman_hd_highscore_v1';
const EXTRA_LIFE_SCORE = 15000;

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

export class SuperPacManEngine {
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
  public doorsSmashedTotal = 0;
  public prizesCleared: SuperPrizeType[] = [];

  public grid: SuperTileType[][] = cloneSuperGrid(SUPER_MAZE.grid);
  public treasuresLeft = SUPER_MAZE.totalTreasures;
  public totalTreasures = SUPER_MAZE.totalTreasures;
  public keysLeft = SUPER_MAZE.totalKeys;
  public doorsLocked = SUPER_MAZE.totalDoors;

  public player: SuperPlayerState;
  public ghosts: SuperGhostState[] = [];

  public particles: Particle[] = [];
  public popups: FloatingPopup[] = [];

  public phaseTimer = 0;
  public elapsed = 0;
  public superRemaining = 0;
  public isSuperBoostHeld = false;
  public frightenedRemaining = 0;
  public ghostCombo = 0;
  public modeWaveIndex = 0;
  public modeWaveTimer = 7;
  public globalGhostMode: 'SCATTER' | 'CHASE' = 'SCATTER';
  public screenShake = 0;
  public eatenGhostFreezeId: SuperGhostId | null = null;
  public stageClearFlashPhase = 0;

  public bonusStarActive = false;
  public bonusStarTimer = 0;
  public bonusStarSpawns = 0;
  public bonusStarPoints = 1000;

  private treasuresEatenThisStage = 0;
  private trailTimer = 0;
  private attractDecisionTimer = 0;

  constructor() {
    this.highScore = this.loadHighScore();
    this.player = this.createInitialPlayer();
    this.setupStage(1, true);
    this.phase = 'TITLE_MENU';
  }

  public get theme(): SuperMazeTheme {
    return SUPER_THEMES[(this.level - 1) % SUPER_THEMES.length];
  }

  public get currentPrize(): SuperPrizeType {
    return SUPER_PRIZE_ORDER[(this.level - 1) % SUPER_PRIZE_ORDER.length];
  }

  public get isSuperActive(): boolean {
    return this.superRemaining > 0;
  }

  private loadHighScore(): number {
    if (typeof window === 'undefined') return 0;
    try {
      const saved = window.localStorage.getItem(SUPER_HIGH_SCORE_KEY);
      const parsed = saved ? parseInt(saved, 10) : 0;
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch {
      return 0;
    }
  }

  private saveHighScore(val: number): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(SUPER_HIGH_SCORE_KEY, String(val));
    } catch {
      // Ignore storage quota issues
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

  private createInitialPlayer(): SuperPlayerState {
    return {
      x: SUPER_MAZE.playerSpawn.x,
      y: SUPER_MAZE.playerSpawn.y,
      dir: 'LEFT',
      desiredDir: 'LEFT',
      facing: 'LEFT',
      mouthPhase: 0.25,
      moving: false,
      deathProgress: 0,
    };
  }

  private createInitialGhosts(): SuperGhostState[] {
    const c = SUPER_MAZE.ghostHouseCenter;
    const door = SUPER_MAZE.ghostHouseDoor;
    const speedFactor = Math.max(0.42, 1 - (this.level - 1) * 0.08);
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
        releaseDelay: 1.4 * speedFactor,
        eatenThisPower: false,
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
        releaseDelay: 3.6 * speedFactor,
        eatenThisPower: false,
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
        releaseDelay: 6.2 * speedFactor,
        eatenThisPower: false,
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
    this.doorsSmashedTotal = 0;
    this.prizesCleared = [];
    this.particles = [];
    this.popups = [];
    this.isSuperBoostHeld = false;
    this.setupStage(1, true);
    this.phase = 'READY';
    this.phaseTimer = 2.4;
    arcadeAudio.playSuperStartFanfare();
  }

  public returnToTitle(): void {
    arcadeAudio.stopAmbient();
    this.isSuperBoostHeld = false;
    this.setupStage(1, true);
    this.phase = 'TITLE_MENU';
  }

  public setSpeedMode(mode: SpeedMode): void {
    this.speedMode = mode;
  }

  public setSuperBoost(held: boolean): void {
    this.isSuperBoostHeld = held;
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
      this.grid = cloneSuperGrid(SUPER_MAZE.grid);
      this.treasuresLeft = SUPER_MAZE.totalTreasures;
      this.totalTreasures = SUPER_MAZE.totalTreasures;
      this.keysLeft = SUPER_MAZE.totalKeys;
      this.doorsLocked = SUPER_MAZE.totalDoors;
      this.treasuresEatenThisStage = 0;
      this.bonusStarSpawns = 0;
      this.bonusStarActive = false;
      this.bonusStarTimer = 0;
    }
    this.resetPositions();
  }

  private resetPositions(): void {
    this.player = this.createInitialPlayer();
    this.ghosts = this.createInitialGhosts();
    this.superRemaining = 0;
    this.frightenedRemaining = 0;
    this.ghostCombo = 0;
    this.modeWaveIndex = 0;
    this.modeWaveTimer = 7;
    this.globalGhostMode = 'SCATTER';
    this.eatenGhostFreezeId = null;
    this.bonusStarActive = false;
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
      if (this.phaseTimer <= 0) {
        this.phase = 'PLAYING';
      }
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
          this.phaseTimer = 1.65;
        }
      }
      return;
    }

    if (this.phase === 'STAGE_CLEAR') {
      this.phaseTimer -= dt;
      this.stageClearFlashPhase += dt * 7;
      if (this.phaseTimer <= 0) {
        this.prizesCleared.push(this.currentPrize);
        this.setupStage(this.level + 1, true);
        this.phase = 'READY';
        this.phaseTimer = 2.0;
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
      return isSuperWalkableForPlayer(this.grid, col + v.x, row + v.y, this.isSuperActive);
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
      if (tile === 'S') score += 16;
      else if (tile === 'K') score += 13;
      else if (tile === 'T') score += 11;
      else if (tile === 'V' && this.isSuperActive) score += 10;
      else if (tile === 'o') score += 8;

      for (const g of this.ghosts) {
        if (g.mode === 'IN_HOUSE' || g.mode === 'EXITING_HOUSE' || g.mode === 'EATEN') continue;
        const d2 = distSq(nx, ny, g.x, g.y);
        if (g.mode === 'FRIGHTENED') {
          score += 24 / (d2 + 1.4);
        } else if (!this.isSuperActive && d2 < 24) {
          score -= 60 / (d2 + 0.5);
        }
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

    // Super Mode timer
    if (this.superRemaining > 0) {
      this.superRemaining = Math.max(0, this.superRemaining - dt);
      this.trailTimer -= dt;
      if (this.trailTimer <= 0 && this.player.moving) {
        this.trailTimer = this.isSuperBoostHeld ? 0.032 : 0.075;
        this.particles.push({
          x: this.player.x + (Math.random() - 0.5) * 0.45,
          y: this.player.y + (Math.random() - 0.5) * 0.45,
          vx: (Math.random() - 0.5) * 1.6,
          vy: (Math.random() - 0.5) * 1.6,
          life: 0.28,
          maxLife: 0.28,
          radius: this.isSuperBoostHeld ? 4.2 : 2.8,
          alpha: 1,
          color: this.isSuperBoostHeld ? '#4ADE80' : '#FDE047',
        });
      }
    }

    // Frightened timer
    if (this.frightenedRemaining > 0) {
      this.frightenedRemaining = Math.max(0, this.frightenedRemaining - dt);
      if (this.frightenedRemaining === 0) {
        this.ghostCombo = 0;
        for (const g of this.ghosts) {
          if (g.mode === 'FRIGHTENED') {
            g.mode = this.globalGhostMode;
          }
          g.eatenThisPower = false;
        }
      }
    }

    // Bonus Star timer
    if (this.bonusStarActive) {
      this.bonusStarTimer -= dt;
      if (this.bonusStarTimer <= 0) {
        this.bonusStarActive = false;
      }
    }

    const speedMult = this.speedMode === 'turbo' ? 1.24 : 1.0;
    const superBoostMult =
      this.isSuperActive && (this.isSuperBoostHeld || isAttract)
        ? 1.48
        : this.isSuperActive
          ? 1.14
          : 1.0;
    const levelBonus = Math.min(0.16, (this.level - 1) * 0.02);
    const playerSpeed = (7.45 + levelBonus * 7.45) * speedMult * superBoostMult;

    this.movePlayer(dt, playerSpeed);
    this.consumeTileAtPlayer(isAttract);
    this.checkBonusStarCollision(isAttract);

    for (const ghost of this.ghosts) {
      this.updateGhost(ghost, dt, speedMult);
    }

    this.checkGhostCollisions(isAttract);

    if (!isAttract && this.phase === 'PLAYING') {
      const anyEyes = this.ghosts.some((g) => g.mode === 'EATEN');
      const progress =
        this.totalTreasures > 0 ? 1 - this.treasuresLeft / this.totalTreasures : 0;
      if (anyEyes) {
        arcadeAudio.updateAmbient('eyes', dt, progress);
      } else if (this.frightenedRemaining > 0 || this.isSuperActive) {
        arcadeAudio.updateAmbient('fright', dt, progress);
      } else {
        arcadeAudio.updateAmbient('siren', dt, progress);
      }
    }
  }

  private updateModeWaves(dt: number): void {
    if (this.frightenedRemaining > 0) return;
    const waves = [7, 20, 7, 20, 5, 22, 5, 9999];
    this.modeWaveTimer -= dt;
    if (this.modeWaveTimer <= 0) {
      this.modeWaveIndex = Math.min(waves.length - 1, this.modeWaveIndex + 1);
      this.modeWaveTimer = waves[this.modeWaveIndex];
      const nextMode: 'SCATTER' | 'CHASE' =
        this.modeWaveIndex % 2 === 0 ? 'SCATTER' : 'CHASE';
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
    const isSuper = this.isSuperActive;

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
        const canTurn = isSuperWalkableForPlayer(this.grid, col + dv.x, row + dv.y, isSuper);
        if (canTurn) {
          const isHorizontalTurn = dv.x !== 0;
          const alignDist = isHorizontalTurn ? Math.abs(p.y - cy) : Math.abs(p.x - cx);
          if (alignDist <= 0.34) {
            if (isHorizontalTurn) p.y = cy;
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
    if (v.x !== 0) {
      p.y += (cy - p.y) * Math.min(1, dt * 22);
    } else if (v.y !== 0) {
      p.x += (cx - p.x) * Math.min(1, dt * 22);
    }

    let nextX = p.x + v.x * stepDist;
    let nextY = p.y + v.y * stepDist;

    const aheadCol = col + v.x;
    const aheadRow = row + v.y;
    const aheadWalkable = isSuperWalkableForPlayer(this.grid, aheadCol, aheadRow, isSuper);

    if (!aheadWalkable) {
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
      const chompRate = this.isSuperActive && this.isSuperBoostHeld ? 26 : 18.5;
      p.mouthPhase = (p.mouthPhase + dt * chompRate) % (Math.PI * 2);
    }
  }

  private consumeTileAtPlayer(isAttract: boolean): void {
    const col = Math.floor(this.player.x);
    const row = Math.floor(this.player.y);
    if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) return;

    const tile = this.grid[row][col];

    // Smash locked door as Giant Super Pac-Man!
    if (tile === 'V' && this.isSuperActive) {
      this.grid[row][col] = ' ';
      this.doorsLocked = Math.max(0, this.doorsLocked - 1);
      this.doorsSmashedTotal += 1;
      if (!isAttract) {
        this.addScore(50);
        arcadeAudio.playGateSmash();
      }
      this.screenShake = 5.5;
      this.spawnBurst(col + 0.5, row + 0.5, this.theme.gateLocked, 16, 6.2);
      this.spawnPopup(col + 0.5, row + 0.2, 'SMASH!', '#4ADE80', 0.8);
      return;
    }

    // Golden Key unlocks linked vault doors!
    if (tile === 'K') {
      this.grid[row][col] = ' ';
      this.keysLeft = Math.max(0, this.keysLeft - 1);
      if (!isAttract) {
        this.addScore(50);
        arcadeAudio.playKeyUnlock();
      }
      this.spawnBurst(col + 0.5, row + 0.5, '#FACC15', 14, 4.5);
      this.spawnPopup(col + 0.5, row + 0.2, '+50', '#FDE047', 0.7);

      const link = SUPER_MAZE.doorLinks.find((l) => l.keyCol === col && l.keyRow === row);
      if (link) {
        for (const door of link.doors) {
          if (this.grid[door.row]?.[door.col] === 'V') {
            this.grid[door.row][door.col] = ' ';
            this.doorsLocked = Math.max(0, this.doorsLocked - 1);
            this.spawnBurst(door.col + 0.5, door.row + 0.5, this.theme.gateLocked, 12, 4.2);
          }
        }
      }

      // Safety guarantee: when final key is grabbed, unlock any remaining vault doors
      if (this.keysLeft === 0) {
        for (let r = 0; r < GRID_ROWS; r++) {
          for (let c = 0; c < GRID_COLS; c++) {
            if (this.grid[r][c] === 'V') {
              this.grid[r][c] = ' ';
              this.doorsLocked = Math.max(0, this.doorsLocked - 1);
              this.spawnBurst(c + 0.5, r + 0.5, this.theme.gateLocked, 8, 3.2);
            }
          }
        }
      }
      return;
    }

    // Standard Power Pellet
    if (tile === 'o') {
      this.grid[row][col] = ' ';
      if (!isAttract) {
        this.addScore(50);
        arcadeAudio.playPowerPellet();
      }
      this.spawnBurst(col + 0.5, row + 0.5, '#FFE8A3', 16, 4.8);
      this.triggerFrightenedMode();
      return;
    }

    // Green Super Pellet -> Giant Super Pac-Man!
    if (tile === 'S') {
      this.grid[row][col] = ' ';
      const superDur = Math.max(6.8, 11.4 - (this.level - 1) * 0.45);
      this.superRemaining = superDur;
      this.screenShake = 6;
      if (!isAttract) {
        this.addScore(100);
        arcadeAudio.playSuperTransform();
      }
      this.spawnBurst(col + 0.5, row + 0.5, '#4ADE80', 24, 6.4);
      this.spawnPopup(col + 0.5, row + 0.1, 'SUPER!', '#4ADE80', 1.2);
      return;
    }

    // Treasure Prize Item!
    if (tile === 'T') {
      this.grid[row][col] = ' ';
      this.treasuresLeft = Math.max(0, this.treasuresLeft - 1);
      this.treasuresEatenThisStage += 1;
      const spec = SUPER_PRIZE_SPECS[this.currentPrize];
      const pts = this.isSuperActive ? spec.points * 2 : spec.points;

      if (!isAttract) {
        this.addScore(pts);
        arcadeAudio.playEatFruit();
      }
      this.spawnBurst(col + 0.5, row + 0.5, spec.color, 12, 4.0);
      this.spawnPopup(col + 0.5, row + 0.25, String(pts), spec.color, 0.78);

      // Trigger Bonus Star after 10 and 22 treasures
      if (
        (this.treasuresEatenThisStage === 10 && this.bonusStarSpawns === 0) ||
        (this.treasuresEatenThisStage === 22 && this.bonusStarSpawns === 1)
      ) {
        this.bonusStarSpawns += 1;
        this.bonusStarActive = true;
        this.bonusStarTimer = 11.5;
        this.bonusStarPoints = Math.min(5000, 500 + this.level * 500);
      }

      if (this.treasuresLeft <= 0) {
        if (isAttract) {
          this.setupStage((this.level % 4) + 1, true);
        } else {
          this.phase = 'STAGE_CLEAR';
          this.phaseTimer = 2.4;
          this.stageClearFlashPhase = 0;
          this.bonusStarActive = false;
          arcadeAudio.stopAmbient();
          arcadeAudio.playStageClear();
        }
      }
    }
  }

  private checkBonusStarCollision(isAttract: boolean): void {
    if (!this.bonusStarActive) return;
    const pos = SUPER_MAZE.bonusStarPos;
    const hitRadius = this.isSuperActive ? 1.05 : 0.72;
    if (distSq(this.player.x, this.player.y, pos.x, pos.y) < hitRadius * hitRadius) {
      this.bonusStarActive = false;
      const pts = this.bonusStarPoints;
      if (!isAttract) {
        this.addScore(pts);
        arcadeAudio.playExtraLife();
      }
      this.spawnBurst(pos.x, pos.y, '#FDE047', 22, 6.0);
      this.spawnPopup(pos.x, pos.y - 0.3, `★ ${pts}`, '#FDE047', 1.35);
    }
  }

  private triggerFrightenedMode(): void {
    const duration = Math.max(2.4, 7.2 - (this.level - 1) * 0.55);
    this.frightenedRemaining = duration;
    this.ghostCombo = 0;

    for (const g of this.ghosts) {
      g.eatenThisPower = false;
      if (g.mode === 'SCATTER' || g.mode === 'CHASE' || g.mode === 'FRIGHTENED') {
        if (g.mode !== 'FRIGHTENED') {
          g.previousMode = g.mode;
          g.dir = OPPOSITE_DIR[g.dir];
          g.lastDecisionTileKey = '';
        }
        g.mode = 'FRIGHTENED';
      }
    }
  }

  private updateGhost(g: SuperGhostState, dt: number, speedMult: number): void {
    g.animPhase += dt * 9.5;
    const houseCenter = SUPER_MAZE.ghostHouseCenter;
    const houseDoor = SUPER_MAZE.ghostHouseDoor;

    if (g.mode === 'IN_HOUSE') {
      g.releaseDelay -= dt;
      g.y = houseCenter.y + Math.sin(this.elapsed * 5.2 + g.animPhase) * 0.25;
      if (g.releaseDelay <= 0) {
        g.mode = 'EXITING_HOUSE';
      }
      return;
    }

    if (g.mode === 'EXITING_HOUSE') {
      const exitSpeed = 4.4 * speedMult;
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
            this.frightenedRemaining > 0 && !g.eatenThisPower
              ? 'FRIGHTENED'
              : this.globalGhostMode;
          g.lastDecisionTileKey = '';
        }
      }
      return;
    }

    if (g.mode === 'ENTERING_HOUSE') {
      const enterSpeed = 7.4 * speedMult;
      if (Math.abs(g.x - houseCenter.x) > 0.08) {
        g.x += Math.sign(houseCenter.x - g.x) * Math.min(Math.abs(houseCenter.x - g.x), enterSpeed * dt);
      } else {
        g.x = houseCenter.x;
        g.y += enterSpeed * dt;
        if (g.y >= houseCenter.y) {
          g.y = houseCenter.y;
          g.mode = 'EXITING_HOUSE';
        }
      }
      return;
    }

    const levelFactor = Math.min(0.2, (this.level - 1) * 0.025);
    const inTunnel = SUPER_MAZE.tunnelRows.includes(Math.floor(g.y)) && (g.x < 5 || g.x > GRID_COLS - 5);
    let ghostSpeed = (6.85 + levelFactor * 6.85) * speedMult;
    if (g.mode === 'FRIGHTENED') {
      ghostSpeed = 4.05 * speedMult;
    } else if (g.mode === 'EATEN') {
      ghostSpeed = 13.6 * speedMult;
    } else if (inTunnel) {
      ghostSpeed *= 0.62;
    }

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

  private chooseGhostDirection(g: SuperGhostState, col: number, row: number): Direction {
    const opposite = OPPOSITE_DIR[g.dir];
    const validDirs: Direction[] = [];
    for (const d of PRIORITY_DIRS) {
      if (d === opposite) continue;
      const v = DIR_VECTORS[d];
      if (isSuperWalkableForGhost(this.grid, col + v.x, row + v.y, false)) {
        validDirs.push(d);
      }
    }
    if (validDirs.length === 0) {
      const rev = DIR_VECTORS[opposite];
      if (isSuperWalkableForGhost(this.grid, col + rev.x, row + rev.y, false)) {
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

  private getGhostTarget(g: SuperGhostState): Vec2 {
    if (g.mode === 'EATEN') return SUPER_MAZE.ghostHouseDoor;
    if (g.mode === 'SCATTER') return g.scatterTarget;

    const p = this.player;
    const pv = DIR_VECTORS[p.facing];
    if (g.id === 'blinky') return { x: p.x, y: p.y };
    if (g.id === 'pinky') return { x: p.x + pv.x * 4, y: p.y + pv.y * 4 };
    if (g.id === 'inky') {
      const blinky = this.ghosts[0];
      const pivotX = p.x + pv.x * 2;
      const pivotY = p.y + pv.y * 2;
      return { x: pivotX + (pivotX - blinky.x), y: pivotY + (pivotY - blinky.y) };
    }
    const d2 = distSq(g.x, g.y, p.x, p.y);
    return d2 > 64 ? { x: p.x, y: p.y } : g.scatterTarget;
  }

  private checkGhostCollisions(isAttract: boolean): void {
    const p = this.player;
    const eatRadius = this.isSuperActive ? 0.95 : 0.64;

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

      if (g.mode === 'FRIGHTENED' && d2 < eatRadius * eatRadius) {
        g.mode = 'EATEN';
        g.eatenThisPower = true;
        this.ghostCombo = Math.min(4, this.ghostCombo + 1);
        const basePts = 200 * Math.pow(2, this.ghostCombo - 1);
        const pts = this.isSuperActive ? basePts * 2 : basePts;
        if (!isAttract) {
          this.ghostsEatenTotal += 1;
          this.addScore(pts);
          arcadeAudio.playEatGhost();
          this.phase = 'GHOST_EATEN_PAUSE';
          this.phaseTimer = 0.42;
          this.eatenGhostFreezeId = g.id;
        }
        this.screenShake = 7;
        this.spawnBurst(g.x, g.y, this.isSuperActive ? '#4ADE80' : '#38BDF8', 22, 6.2);
        this.spawnPopup(g.x, g.y - 0.25, String(pts), this.isSuperActive ? '#4ADE80' : '#7DD3FC', 1.2);
        return;
      }

      // Giant Super Pac-Man is invincible to normal ghosts!
      if (this.isSuperActive) {
        continue;
      }

      if (d2 < 0.56 * 0.56) {
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
  }

  private spawnBurst(x: number, y: number, color: string, count: number, speed: number): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.45;
      const mag = speed * (0.4 + Math.random() * 0.85);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * mag,
        vy: Math.sin(angle) * mag,
        life: 0.35 + Math.random() * 0.35,
        maxLife: 0.68,
        radius: 1.8 + Math.random() * 2.5,
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

  public getHudSnapshot(): SuperHudSnapshot {
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      isNewHighScore: this.isNewHighScore,
      lives: this.lives,
      level: this.level,
      themeName: this.theme.name,
      themeAccent: this.theme.accentHex,
      treasuresLeft: this.treasuresLeft,
      totalTreasures: this.totalTreasures,
      keysLeft: this.keysLeft,
      doorsLocked: this.doorsLocked,
      ghostsEatenTotal: this.ghostsEatenTotal,
      doorsSmashedTotal: this.doorsSmashedTotal,
      currentPrize: this.currentPrize,
      prizesCleared: [...this.prizesCleared],
      superRemaining: this.superRemaining,
      isSuperBoosting: this.isSuperActive && this.isSuperBoostHeld,
      frightenedRemaining: this.frightenedRemaining,
      bonusStarActive: this.bonusStarActive,
      extraLifeAwarded: this.extraLifeAwarded,
    };
  }
}

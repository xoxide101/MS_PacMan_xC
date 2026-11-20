import { arcadeAudio } from './audio';
import { DIR_VECTORS } from './engine';
import {
  PacManiaGhostId,
  PacManiaGhostState,
  PacManiaHudSnapshot,
  PacManiaPlayerState,
  PacManiaSpecialItem,
  PacManiaTileType,
  PacManiaWorldDef,
  PM_GRID_COLS,
  PM_GRID_ROWS,
} from './pacmaniaTypes';
import {
  clonePacManiaGrid,
  isPMWalkableForGhost,
  isPMWalkableForPlayer,
  PACMANIA_WORLDS,
} from './pacmaniaWorlds';
import { Direction, FloatingPopup, GamePhase, Particle, SpeedMode, Vec2 } from './types';

const PACMANIA_HIGH_SCORE_KEY = 'pacmania_hd_highscore_v1';
const EXTRA_LIFE_SCORE = 20000;
const JUMP_VELOCITY = 9.0;
const JUMP_GRAVITY = 25.5;

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
  if (col < 0) return PM_GRID_COLS - 1;
  if (col >= PM_GRID_COLS) return 0;
  return col;
}

export class PacManiaEngine {
  public phase: GamePhase = 'TITLE_MENU';
  public previousPhase: GamePhase = 'PLAYING';
  public speedMode: SpeedMode = 'arcade';

  public score = 0;
  public highScore = 0;
  public isNewHighScore = false;
  public lives = 3;
  public extraLifeAwarded = false;
  public level = 1;
  public worldIndex = 0;
  public ghostsEatenTotal = 0;
  public jumpsClearedTotal = 0;

  public world: PacManiaWorldDef = PACMANIA_WORLDS[0];
  public grid: PacManiaTileType[][] = clonePacManiaGrid(PACMANIA_WORLDS[0].grid);
  public pelletsLeft = PACMANIA_WORLDS[0].totalPellets;
  public totalPellets = PACMANIA_WORLDS[0].totalPellets;

  public player: PacManiaPlayerState;
  public ghosts: PacManiaGhostState[] = [];
  public specialItem: PacManiaSpecialItem = {
    active: false,
    type: 'green_speed',
    x: 11,
    y: 14.5,
    timer: 0,
  };

  public camX = 11;
  public camY = 18;
  public particles: Particle[] = [];
  public popups: FloatingPopup[] = [];

  public phaseTimer = 0;
  public elapsed = 0;
  public frightenedRemaining = 0;
  public speedBoostRemaining = 0;
  public doubleScoreRemaining = 0;
  public ghostCombo = 0;
  public modeWaveIndex = 0;
  public modeWaveTimer = 7;
  public globalGhostMode: 'SCATTER' | 'CHASE' = 'SCATTER';
  public screenShake = 0;
  public eatenGhostFreezeId: PacManiaGhostId | null = null;
  public stageClearFlashPhase = 0;

  private pelletsEatenThisStage = 0;
  private specialSpawns = 0;
  private attractDecisionTimer = 0;
  private jumpedOverIdsThisArc = new Set<PacManiaGhostId>();

  constructor() {
    this.highScore = this.loadHighScore();
    this.player = this.createInitialPlayer();
    this.setupStage(1, true);
    this.phase = 'TITLE_MENU';
  }

  private loadHighScore(): number {
    if (typeof window === 'undefined') return 0;
    try {
      const saved = window.localStorage.getItem(PACMANIA_HIGH_SCORE_KEY);
      const parsed = saved ? parseInt(saved, 10) : 0;
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch {
      return 0;
    }
  }

  private saveHighScore(val: number): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(PACMANIA_HIGH_SCORE_KEY, String(val));
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

  private createInitialPlayer(): PacManiaPlayerState {
    return {
      x: this.world.playerSpawn.x,
      y: this.world.playerSpawn.y,
      z: 0,
      vz: 0,
      dir: 'LEFT',
      desiredDir: 'LEFT',
      facing: 'LEFT',
      mouthPhase: 0.25,
      moving: false,
      deathProgress: 0,
      jumpCount: 0,
    };
  }

  private createInitialGhosts(): PacManiaGhostState[] {
    const c = this.world.ghostHouseCenter;
    const door = this.world.ghostHouseDoor;
    const f = Math.max(0.45, 1 - (this.level - 1) * 0.08);
    const roster: PacManiaGhostState[] = [
      {
        id: 'blinky',
        name: 'Blinky',
        nickname: 'Shadow',
        color: '#FF2A42',
        accentColor: '#FF8593',
        x: door.x,
        y: door.y,
        z: 0,
        vz: 0,
        canJump: 'none',
        dir: 'LEFT',
        mode: 'SCATTER',
        previousMode: 'SCATTER',
        scatterTarget: { x: 19.5, y: 1.5 },
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
        z: 0,
        vz: 0,
        canJump: 'none',
        dir: 'UP',
        mode: 'IN_HOUSE',
        previousMode: 'SCATTER',
        scatterTarget: { x: 2.5, y: 1.5 },
        releaseDelay: 1.2 * f,
        eatenThisPower: false,
        animPhase: 1.1,
        lastDecisionTileKey: '',
      },
      {
        id: 'inky',
        name: 'Inky',
        nickname: 'Bashful',
        color: '#1CE4FF',
        accentColor: '#9AF3FF',
        x: c.x - 1.1,
        y: c.y,
        z: 0,
        vz: 0,
        canJump: 'none',
        dir: 'UP',
        mode: 'IN_HOUSE',
        previousMode: 'SCATTER',
        scatterTarget: { x: 19.5, y: 23.5 },
        releaseDelay: 3.0 * f,
        eatenThisPower: false,
        animPhase: 2.2,
        lastDecisionTileKey: '',
      },
      {
        id: 'clyde',
        name: 'Clyde',
        nickname: 'Pokey',
        color: '#FF9B26',
        accentColor: '#FFD094',
        x: c.x + 1.1,
        y: c.y,
        z: 0,
        vz: 0,
        canJump: 'none',
        dir: 'UP',
        mode: 'IN_HOUSE',
        previousMode: 'SCATTER',
        scatterTarget: { x: 2.5, y: 23.5 },
        releaseDelay: 4.8 * f,
        eatenThisPower: false,
        animPhase: 3.3,
        lastDecisionTileKey: '',
      },
      {
        id: 'sue',
        name: 'Sue',
        nickname: 'Violet',
        color: '#A855F7',
        accentColor: '#E9D5FF',
        x: c.x - 0.55,
        y: c.y + 0.2,
        z: 0,
        vz: 0,
        canJump: 'none',
        dir: 'UP',
        mode: 'IN_HOUSE',
        previousMode: 'SCATTER',
        scatterTarget: { x: 11, y: 1.5 },
        releaseDelay: 6.4 * f,
        eatenThisPower: false,
        animPhase: 4.1,
        lastDecisionTileKey: '',
      },
      {
        id: 'funky',
        name: 'Funky',
        nickname: 'Green Hopper',
        color: '#22C55E',
        accentColor: '#86EFAC',
        x: c.x + 0.55,
        y: c.y + 0.2,
        z: 0,
        vz: 0,
        canJump: 'low',
        dir: 'UP',
        mode: 'IN_HOUSE',
        previousMode: 'SCATTER',
        scatterTarget: { x: 11, y: 23.5 },
        releaseDelay: 7.8 * f,
        eatenThisPower: false,
        animPhase: 5.0,
        lastDecisionTileKey: '',
      },
    ];

    // Spunky (Silver High-Jumping Ghost) joins from World 2 (Stage 2+)!
    if (this.level >= 2) {
      roster.push({
        id: 'spunky',
        name: 'Spunky',
        nickname: 'High Jumper',
        color: '#94A3B8',
        accentColor: '#E2E8F0',
        x: c.x,
        y: c.y + 0.3,
        z: 0,
        vz: 0,
        canJump: 'high',
        dir: 'UP',
        mode: 'IN_HOUSE',
        previousMode: 'SCATTER',
        scatterTarget: { x: 19.5, y: 12.5 },
        releaseDelay: 9.2 * f,
        eatenThisPower: false,
        animPhase: 5.8,
        lastDecisionTileKey: '',
      });
    }

    return roster;
  }

  public startNewGame(): void {
    arcadeAudio.unlock();
    this.score = 0;
    this.isNewHighScore = false;
    this.lives = 3;
    this.extraLifeAwarded = false;
    this.level = 1;
    this.ghostsEatenTotal = 0;
    this.jumpsClearedTotal = 0;
    this.particles = [];
    this.popups = [];
    this.setupStage(1, true);
    this.phase = 'READY';
    this.phaseTimer = 2.4;
    arcadeAudio.playPacManiaStartFanfare();
  }

  public previewWorld(idx: number): void {
    if (this.phase !== 'TITLE_MENU') return;
    this.worldIndex = Math.max(0, Math.min(PACMANIA_WORLDS.length - 1, idx));
    this.world = PACMANIA_WORLDS[this.worldIndex];
    this.level = this.worldIndex + 1;
    this.grid = clonePacManiaGrid(this.world.grid);
    this.pelletsLeft = this.world.totalPellets;
    this.totalPellets = this.world.totalPellets;
    this.resetPositions();
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

  public triggerJump(): void {
    if (this.phase !== 'PLAYING') return;
    if (this.player.z > 0.02) return; // Already airborne

    arcadeAudio.unlock();
    this.player.vz = JUMP_VELOCITY;
    this.player.z = 0.03;
    this.player.jumpCount += 1;
    this.jumpedOverIdsThisArc.clear();
    arcadeAudio.playJumpBoing();

    // Synced enemy jumpers: Funky (lower arc) & Spunky (full arc)!
    for (const g of this.ghosts) {
      if (
        g.canJump !== 'none' &&
        (g.mode === 'SCATTER' || g.mode === 'CHASE') &&
        g.z <= 0.02
      ) {
        g.vz = g.canJump === 'high' ? JUMP_VELOCITY * 0.96 : JUMP_VELOCITY * 0.64;
        g.z = 0.03;
      }
    }
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
    this.worldIndex = (level - 1) % PACMANIA_WORLDS.length;
    this.world = PACMANIA_WORLDS[this.worldIndex];
    if (resetBoard) {
      this.grid = clonePacManiaGrid(this.world.grid);
      this.pelletsLeft = this.world.totalPellets;
      this.totalPellets = this.world.totalPellets;
      this.pelletsEatenThisStage = 0;
      this.specialSpawns = 0;
    }
    this.resetPositions();
  }

  private resetPositions(): void {
    this.player = this.createInitialPlayer();
    this.ghosts = this.createInitialGhosts();
    this.camX = this.player.x;
    this.camY = this.player.y - 1.2;
    this.frightenedRemaining = 0;
    this.speedBoostRemaining = 0;
    this.doubleScoreRemaining = 0;
    this.ghostCombo = 0;
    this.modeWaveIndex = 0;
    this.modeWaveTimer = 7;
    this.globalGhostMode = 'SCATTER';
    this.eatenGhostFreezeId = null;
    this.specialItem.active = false;
    this.jumpedOverIdsThisArc.clear();
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
      this.updateCamera(dt);
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
    // Auto-jump over close ghosts during attract demo so the lobby preview shows jumping!
    if (this.player.z <= 0.02) {
      for (const g of this.ghosts) {
        if (g.mode === 'SCATTER' || g.mode === 'CHASE') {
          if (distSq(this.player.x, this.player.y, g.x, g.y) < 3.4) {
            this.player.vz = JUMP_VELOCITY;
            this.player.z = 0.03;
            for (const fg of this.ghosts) {
              if (fg.canJump !== 'none' && (fg.mode === 'SCATTER' || fg.mode === 'CHASE') && fg.z <= 0.02) {
                fg.vz = fg.canJump === 'high' ? JUMP_VELOCITY * 0.96 : JUMP_VELOCITY * 0.64;
                fg.z = 0.03;
              }
            }
            break;
          }
        }
      }
    }
    this.stepGameplay(dt, true);
  }

  private chooseAttractDirection(): void {
    const col = Math.floor(this.player.x);
    const row = Math.floor(this.player.y);
    const candidates: Direction[] = (['UP', 'DOWN', 'LEFT', 'RIGHT'] as Direction[]).filter((d) => {
      const v = DIR_VECTORS[d];
      return isPMWalkableForPlayer(this.grid, col + v.x, row + v.y, this.world.tunnelRows);
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
      const t = this.grid[row + v.y]?.[wrapCol(col + v.x)];
      if (t === '.') score += 6;
      else if (t === 'o') score += 12;

      for (const g of this.ghosts) {
        if (g.mode === 'IN_HOUSE' || g.mode === 'EXITING_HOUSE' || g.mode === 'EATEN') continue;
        const d2 = distSq(nx, ny, g.x, g.y);
        if (g.mode === 'FRIGHTENED') score += 22 / (d2 + 1.2);
        else if (d2 < 14) score -= 45 / (d2 + 0.6);
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

    if (this.speedBoostRemaining > 0) {
      this.speedBoostRemaining = Math.max(0, this.speedBoostRemaining - dt);
    }
    if (this.doubleScoreRemaining > 0) {
      this.doubleScoreRemaining = Math.max(0, this.doubleScoreRemaining - dt);
    }

    if (this.frightenedRemaining > 0) {
      this.frightenedRemaining = Math.max(0, this.frightenedRemaining - dt);
      if (this.frightenedRemaining === 0) {
        this.ghostCombo = 0;
        for (const g of this.ghosts) {
          if (g.mode === 'FRIGHTENED') g.mode = this.globalGhostMode;
          g.eatenThisPower = false;
        }
      }
    }

    if (this.specialItem.active) {
      this.specialItem.timer -= dt;
      if (this.specialItem.timer <= 0) {
        this.specialItem.active = false;
      }
    }

    const speedMult = this.speedMode === 'turbo' ? 1.22 : 1.0;
    const greenBoost = this.speedBoostRemaining > 0 ? 1.32 : 1.0;
    const levelBonus = Math.min(0.16, (this.level - 1) * 0.02);
    const playerSpeed = (6.85 + levelBonus * 6.85) * speedMult * greenBoost;

    this.movePlayer(dt, playerSpeed);
    this.updateVerticalPhysics(dt);
    this.consumePelletAtPlayer(isAttract);
    this.checkSpecialCollision(isAttract);

    for (const g of this.ghosts) {
      this.updateGhost(g, dt, speedMult);
    }

    this.checkGhostCollisions(isAttract);
    this.updateCamera(dt);

    if (!isAttract && this.phase === 'PLAYING') {
      const anyEyes = this.ghosts.some((g) => g.mode === 'EATEN');
      const progress = this.totalPellets > 0 ? 1 - this.pelletsLeft / this.totalPellets : 0;
      if (anyEyes) arcadeAudio.updateAmbient('eyes', dt, progress);
      else if (this.frightenedRemaining > 0) arcadeAudio.updateAmbient('fright', dt, progress);
      else arcadeAudio.updateAmbient('siren', dt, progress);
    }
  }

  private updateVerticalPhysics(dt: number): void {
    // Player jump arc
    if (this.player.z > 0 || this.player.vz > 0) {
      this.player.z += this.player.vz * dt;
      this.player.vz -= JUMP_GRAVITY * dt;
      if (this.player.z <= 0) {
        this.player.z = 0;
        this.player.vz = 0;
        this.jumpedOverIdsThisArc.clear();
      }
    }

    // Jumping ghosts (Funky & Spunky)
    for (const g of this.ghosts) {
      if (g.z > 0 || g.vz > 0) {
        g.z += g.vz * dt;
        g.vz -= JUMP_GRAVITY * dt;
        if (g.z <= 0) {
          g.z = 0;
          g.vz = 0;
        }
      }
    }
  }

  private updateCamera(dt: number): void {
    const pv = DIR_VECTORS[this.player.facing];
    const targetX = this.player.x + pv.x * 1.1;
    const targetY = this.player.y + pv.y * 0.9;
    const smooth = 1 - Math.exp(-dt * 7.2);
    this.camX += (targetX - this.camX) * smooth;
    this.camY += (targetY - this.camY) * smooth;
    // Soft clamp to world bounds
    this.camX = Math.max(4.5, Math.min(PM_GRID_COLS - 4.5, this.camX));
    this.camY = Math.max(4.5, Math.min(PM_GRID_ROWS - 4.5, this.camY));
  }

  private updateModeWaves(dt: number): void {
    if (this.frightenedRemaining > 0) return;
    const waves = [7, 20, 7, 20, 5, 22, 5, 9999];
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
        if (isPMWalkableForPlayer(this.grid, col + dv.x, row + dv.y, this.world.tunnelRows)) {
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
    if (!isPMWalkableForPlayer(this.grid, col + v.x, row + v.y, this.world.tunnelRows)) {
      if (v.x > 0 && nextX > cx) nextX = cx;
      if (v.x < 0 && nextX < cx) nextX = cx;
      if (v.y > 0 && nextY > cy) nextY = cy;
      if (v.y < 0 && nextY < cy) nextY = cy;
    }

    const moved = Math.abs(nextX - p.x) > 0.0001 || Math.abs(nextY - p.y) > 0.0001;
    p.x = nextX;
    p.y = nextY;
    p.moving = moved;

    if (p.x < -0.45) {
      p.x = PM_GRID_COLS + 0.45;
      this.camX = p.x;
    } else if (p.x > PM_GRID_COLS + 0.45) {
      p.x = -0.45;
      this.camX = p.x;
    }

    if (moved) {
      p.facing = p.dir;
      p.mouthPhase = (p.mouthPhase + dt * 19) % (Math.PI * 2);
    }
  }

  private consumePelletAtPlayer(isAttract: boolean): void {
    // Only eat ground pellets when close to the floor!
    if (this.player.z > 0.45) return;

    const col = Math.floor(this.player.x);
    const row = Math.floor(this.player.y);
    if (row < 0 || row >= PM_GRID_ROWS || col < 0 || col >= PM_GRID_COLS) return;

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
      this.spawnBurst(col + 0.5, row + 0.5, '#FEF08A', 4, 2.2);
    } else {
      if (!isAttract) {
        this.addScore(50);
        arcadeAudio.playPowerPellet();
      }
      this.spawnBurst(col + 0.5, row + 0.5, '#FFFFFF', 16, 4.8);
      this.triggerFrightenedMode();
    }

    // Spawn Pac-Mania Special Pellets (Green Speed Boost & Red Double Score)
    if (this.pelletsEatenThisStage === 45 && this.specialSpawns === 0) {
      this.specialSpawns = 1;
      this.specialItem = {
        active: true,
        type: 'green_speed',
        x: this.world.specialSpawn.x,
        y: this.world.specialSpawn.y,
        timer: 11,
      };
    } else if (this.pelletsEatenThisStage === 105 && this.specialSpawns === 1) {
      this.specialSpawns = 2;
      this.specialItem = {
        active: true,
        type: 'red_double',
        x: this.world.specialSpawn.x,
        y: this.world.specialSpawn.y,
        timer: 11,
      };
    }

    if (this.pelletsLeft <= 0) {
      if (isAttract) {
        this.setupStage((this.level % PACMANIA_WORLDS.length) + 1, true);
      } else {
        this.phase = 'STAGE_CLEAR';
        this.phaseTimer = 2.4;
        this.stageClearFlashPhase = 0;
        arcadeAudio.stopAmbient();
        arcadeAudio.playStageClear();
      }
    }
  }

  private checkSpecialCollision(isAttract: boolean): void {
    if (!this.specialItem.active || this.player.z > 0.55) return;
    if (distSq(this.player.x, this.player.y, this.specialItem.x, this.specialItem.y) < 0.72 * 0.72) {
      const type = this.specialItem.type;
      this.specialItem.active = false;
      if (type === 'green_speed') {
        this.speedBoostRemaining = 10;
        if (!isAttract) {
          this.addScore(500);
          arcadeAudio.playSuperTransform();
        }
        this.spawnBurst(this.specialItem.x, this.specialItem.y, '#4ADE80', 18, 5.2);
        this.spawnPopup(this.specialItem.x, this.specialItem.y - 0.3, 'SPEED UP!', '#4ADE80', 1.25);
      } else {
        this.doubleScoreRemaining = 12;
        if (!isAttract) {
          this.addScore(1000);
          arcadeAudio.playExtraLife();
        }
        this.spawnBurst(this.specialItem.x, this.specialItem.y, '#FB7185', 20, 5.5);
        this.spawnPopup(this.specialItem.x, this.specialItem.y - 0.3, '2X BONUS!', '#FB7185', 1.25);
      }
    }
  }

  private triggerFrightenedMode(): void {
    const duration = Math.max(2.6, 7.6 - (this.level - 1) * 0.5);
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

  private updateGhost(g: PacManiaGhostState, dt: number, speedMult: number): void {
    g.animPhase += dt * 9.5;
    const houseCenter = this.world.ghostHouseCenter;
    const houseDoor = this.world.ghostHouseDoor;

    if (g.mode === 'IN_HOUSE') {
      g.releaseDelay -= dt;
      g.y = houseCenter.y + Math.sin(this.elapsed * 5 + g.animPhase) * 0.22;
      if (g.releaseDelay <= 0) g.mode = 'EXITING_HOUSE';
      return;
    }

    if (g.mode === 'EXITING_HOUSE') {
      const exitSpeed = 4.2 * speedMult;
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

    const levelFactor = Math.min(0.22, (this.level - 1) * 0.025);
    const inTunnel =
      this.world.tunnelRows.includes(Math.floor(g.y)) && (g.x < 4 || g.x > PM_GRID_COLS - 4);
    let ghostSpeed = (6.1 + levelFactor * 6.1) * speedMult;
    if (g.id === 'funky') ghostSpeed *= 1.04;
    if (g.id === 'spunky') ghostSpeed *= 1.08;
    if (g.mode === 'FRIGHTENED') ghostSpeed = 3.7 * speedMult;
    else if (g.mode === 'EATEN') ghostSpeed = 12.6 * speedMult;
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

    if (g.x < -0.45) g.x = PM_GRID_COLS + 0.45;
    else if (g.x > PM_GRID_COLS + 0.45) g.x = -0.45;
  }

  private chooseGhostDirection(g: PacManiaGhostState, col: number, row: number): Direction {
    const opposite = OPPOSITE_DIR[g.dir];
    const validDirs: Direction[] = [];
    for (const d of PRIORITY_DIRS) {
      if (d === opposite) continue;
      const v = DIR_VECTORS[d];
      if (isPMWalkableForGhost(this.grid, col + v.x, row + v.y, this.world.tunnelRows, false)) {
        validDirs.push(d);
      }
    }
    if (validDirs.length === 0) {
      const rev = DIR_VECTORS[opposite];
      if (isPMWalkableForGhost(this.grid, col + rev.x, row + rev.y, this.world.tunnelRows, false)) {
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

  private getGhostTarget(g: PacManiaGhostState): Vec2 {
    if (g.mode === 'EATEN') return this.world.ghostHouseDoor;
    if (g.mode === 'SCATTER') return g.scatterTarget;

    const p = this.player;
    const pv = DIR_VECTORS[p.facing];
    if (g.id === 'blinky' || g.id === 'spunky') return { x: p.x, y: p.y };
    if (g.id === 'pinky' || g.id === 'funky') return { x: p.x + pv.x * 3, y: p.y + pv.y * 3 };
    if (g.id === 'inky') {
      const blinky = this.ghosts[0];
      const px = p.x + pv.x * 2;
      const py = p.y + pv.y * 2;
      return { x: px + (px - blinky.x), y: py + (py - blinky.y) };
    }
    if (g.id === 'sue') return { x: p.x - pv.x * 2, y: p.y - pv.y * 2 };
    const d2 = distSq(g.x, g.y, p.x, p.y);
    return d2 > 42 ? { x: p.x, y: p.y } : g.scatterTarget;
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
      if (d2 >= 0.58 * 0.58) continue;

      const zDiff = Math.abs(p.z - g.z);
      // Safely vaulted right over the ghost!
      if (p.z > g.z + 0.42) {
        if (!this.jumpedOverIdsThisArc.has(g.id)) {
          this.jumpedOverIdsThisArc.add(g.id);
          if (!isAttract) {
            this.jumpsClearedTotal += 1;
            this.addScore(100);
          }
          this.spawnPopup(p.x, p.y - 0.5, 'VAULT +100', '#38BDF8', 0.85);
        }
        continue;
      }

      if (zDiff > 0.45) continue;

      if (g.mode === 'FRIGHTENED') {
        g.mode = 'EATEN';
        g.eatenThisPower = true;
        this.ghostCombo = Math.min(4, this.ghostCombo + 1);
        const mult = this.doubleScoreRemaining > 0 ? 2 : 1;
        const pts = 200 * Math.pow(2, this.ghostCombo - 1) * mult;
        if (!isAttract) {
          this.ghostsEatenTotal += 1;
          this.addScore(pts);
          arcadeAudio.playEatGhost();
          this.phase = 'GHOST_EATEN_PAUSE';
          this.phaseTimer = 0.4;
          this.eatenGhostFreezeId = g.id;
        }
        this.screenShake = 6;
        this.spawnBurst(g.x, g.y, '#38BDF8', 20, 5.5);
        this.spawnPopup(g.x, g.y - 0.3, String(pts), '#7DD3FC', 1.15);
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
        life: 0.32 + Math.random() * 0.32,
        maxLife: 0.64,
        radius: 2.0 + Math.random() * 2.4,
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
      pt.vx *= 0.92;
      pt.vy *= 0.92;
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
  }

  private updatePopups(dt: number): void {
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.y -= dt * 0.65;
      pop.life -= dt;
      if (pop.life <= 0) this.popups.splice(i, 1);
    }
  }

  public getHudSnapshot(): PacManiaHudSnapshot {
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      isNewHighScore: this.isNewHighScore,
      lives: this.lives,
      level: this.level,
      worldIndex: this.worldIndex,
      worldName: this.world.theme.name,
      worldSubtitle: this.world.theme.subtitle,
      worldAccent: this.world.theme.accentHex,
      pelletsLeft: this.pelletsLeft,
      totalPellets: this.totalPellets,
      ghostsEatenTotal: this.ghostsEatenTotal,
      jumpsClearedTotal: this.jumpsClearedTotal,
      frightenedRemaining: this.frightenedRemaining,
      speedBoostRemaining: this.speedBoostRemaining,
      doubleScoreRemaining: this.doubleScoreRemaining,
      isAirborne: this.player.z > 0.05,
      spunkyActive: this.level >= 2,
      extraLifeAwarded: this.extraLifeAwarded,
    };
  }
}

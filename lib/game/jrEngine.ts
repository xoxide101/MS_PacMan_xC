import { arcadeAudio } from './audio';
import { DIR_VECTORS } from './engine';
import {
  cloneJrMazeGrid,
  getJrMazeIndexForLevel,
  isJrWalkableForGhost,
  isJrWalkableForPlayer,
  JR_MAZES,
} from './jrMazes';
import {
  Direction,
  FloatingPopup,
  GamePhase,
  JR_GRID_COLS,
  JR_GRID_ROWS,
  JR_LEVEL_PRIZE_ORDER,
  JR_PRIZE_SPECS,
  JR_VIEWPORT_COLS,
  JrGhostId,
  JrGhostState,
  JrHudSnapshot,
  JrMazeDefinition,
  JrPlayerState,
  JrPrizeType,
  JrRoamingPrize,
  JrTileType,
  Particle,
  SpeedMode,
  Vec2,
} from './jrTypes';

const JR_HIGH_SCORE_STORAGE_KEY = 'jr_pacman_hd_highscore_v1';
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

export class JrPacManEngine {
  public phase: GamePhase = 'TITLE_MENU';
  public mazeIndex = 0;
  public maze: JrMazeDefinition = JR_MAZES[0];
  public grid: JrTileType[][] = cloneJrMazeGrid(JR_MAZES[0]);

  public score = 0;
  public highScore = 0;
  public isNewHighScore = false;
  public lives = 3;
  public level = 1;
  public pelletsLeft = 0;
  public pelletsEatenThisLevel = 0;
  public mutatedDotsCount = 0;
  public energizersLeft = 6;
  public energizersDestroyed = 0;
  public ghostsEatenTotal = 0;
  public prizesCollected: JrPrizeType[] = [];
  public extraLifeAwarded = false;

  public speedMode: SpeedMode = 'arcade';

  // Smooth horizontal scrolling camera in tile coordinates (0 .. JR_GRID_COLS - JR_VIEWPORT_COLS)
  public cameraX = (JR_GRID_COLS - JR_VIEWPORT_COLS) / 2;
  public screenShakeTimer = 0;

  public player!: JrPlayerState;
  public ghosts: JrGhostState[] = [];
  public prize!: JrRoamingPrize;
  public particles: Particle[] = [];
  public popups: FloatingPopup[] = [];

  public elapsedTime = 0;
  public phaseTimer = 0;
  public frightenedTimer = 0;
  public frightenedDuration = 7.0;
  public ghostComboCount = 0;
  public eatenGhostId: JrGhostId | null = null;
  public stageClearFlashPhase = 0;

  private waveIndex = 0;
  private waveTimer = 0;
  private globalGhostMode: 'SCATTER' | 'CHASE' = 'SCATTER';

  private prizeMilestonesTriggered = 0;
  private prizeBounceCooldown = 0;
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
      const saved = window.localStorage.getItem(JR_HIGH_SCORE_STORAGE_KEY);
      const parsed = saved ? parseInt(saved, 10) : 0;
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch {
      return 0;
    }
  }

  private saveHighScore(val: number): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(JR_HIGH_SCORE_STORAGE_KEY, String(val));
    } catch {
      // ignore storage errors
    }
  }

  public getCurrentPrizeType(): JrPrizeType {
    if (this.level <= JR_LEVEL_PRIZE_ORDER.length) {
      return JR_LEVEL_PRIZE_ORDER[this.level - 1];
    }
    return JR_LEVEL_PRIZE_ORDER[(this.level * 2 + 1) % JR_LEVEL_PRIZE_ORDER.length];
  }

  public getHudSnapshot(): JrHudSnapshot {
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
      mutatedDotsCount: this.mutatedDotsCount,
      energizersLeft: this.energizersLeft,
      energizersDestroyed: this.energizersDestroyed,
      ghostsEatenTotal: this.ghostsEatenTotal,
      prizesCollected: [...this.prizesCollected],
      currentPrize: this.getCurrentPrizeType(),
      prizeActive: this.prize.active,
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
    this.prizesCollected = [];
    this.extraLifeAwarded = false;
    this.particles = [];
    this.popups = [];
    this.setupMaze(getJrMazeIndexForLevel(1), true);
    this.resetPositions();
    this.phase = 'READY';
    this.phaseTimer = 2.0;
    arcadeAudio.playJrStartFanfare();
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
    this.mazeIndex = mazeIdx % JR_MAZES.length;
    this.maze = JR_MAZES[this.mazeIndex];
    if (resetPellets) {
      this.grid = cloneJrMazeGrid(this.maze);
      this.pelletsLeft = this.maze.totalPellets;
      this.pelletsEatenThisLevel = 0;
      this.mutatedDotsCount = 0;
      this.energizersLeft = this.maze.totalEnergizers;
      this.energizersDestroyed = 0;
      this.prizeMilestonesTriggered = 0;
    }
  }

  private getBaseSpeedMultiplier(): number {
    const levelBoost = Math.min(0.28, (this.level - 1) * 0.032);
    const turboBoost = this.speedMode === 'turbo' ? 1.24 : 1.0;
    return (1 + levelBoost) * turboBoost;
  }

  private getWaveSchedule(): Array<{ mode: 'SCATTER' | 'CHASE'; duration: number }> {
    const fast = this.level >= 4;
    return [
      { mode: 'SCATTER', duration: fast ? 5 : 7 },
      { mode: 'CHASE', duration: 22 },
      { mode: 'SCATTER', duration: fast ? 5 : 7 },
      { mode: 'CHASE', duration: 22 },
      { mode: 'SCATTER', duration: 5 },
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
      propellerPhase: 0,
      moving: true,
      speed: 8.1 * speedFactor,
      slowdownTimer: 0,
      deathProgress: 0,
      trail: [],
    };

    // Center scrolling camera on Jr. Pac-Man
    this.cameraX = this.clampCamera(this.player.x - JR_VIEWPORT_COLS / 2);

    const releaseScale = Math.max(0.35, 1 - (this.level - 1) * 0.1);

    this.ghosts = [
      {
        id: 'blinky',
        name: 'Blinky',
        nickname: 'Shadow',
        color: '#FF2A42',
        accentColor: '#FF8593',
        x: 28,
        y: 11.5,
        dir: 'LEFT',
        mode: 'SCATTER',
        previousMode: 'SCATTER',
        scatterTarget: { x: 53.5, y: -2 },
        houseTarget: { x: 28, y: 14.5 },
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
        x: 28,
        y: 14.5,
        dir: 'UP',
        mode: 'IN_HOUSE',
        previousMode: 'SCATTER',
        scatterTarget: { x: 2.5, y: -2 },
        houseTarget: { x: 28, y: 14.5 },
        releaseDelay: 0.7 * releaseScale,
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
        x: 26.2,
        y: 14.5,
        dir: 'UP',
        mode: 'IN_HOUSE',
        previousMode: 'SCATTER',
        scatterTarget: { x: 55.5, y: 31.5 },
        houseTarget: { x: 26.2, y: 14.5 },
        releaseDelay: 3.4 * releaseScale,
        eatenThisPower: false,
        animPhase: 3.1,
        lastDecisionTileKey: '',
      },
      {
        id: 'tim',
        name: 'Tim',
        nickname: 'Pokey',
        color: '#FF9B26',
        accentColor: '#FFD199',
        x: 29.8,
        y: 14.5,
        dir: 'DOWN',
        mode: 'IN_HOUSE',
        previousMode: 'SCATTER',
        scatterTarget: { x: 0.5, y: 31.5 },
        houseTarget: { x: 29.8, y: 14.5 },
        releaseDelay: 6.4 * releaseScale,
        eatenThisPower: false,
        animPhase: 4.7,
        lastDecisionTileKey: '',
      },
    ];

    this.prize = {
      active: false,
      exitingHouse: false,
      type: this.getCurrentPrizeType(),
      points: JR_PRIZE_SPECS[this.getCurrentPrizeType()].points,
      x: 28,
      y: 14.5,
      dir: 'UP',
      bouncePhase: 0,
      targetEnergizer: null,
      lastDecisionTileKey: '',
      lifetime: 0,
    };

    this.waveIndex = 0;
    this.waveTimer = 0;
    this.globalGhostMode = 'SCATTER';
    this.frightenedTimer = 0;
    this.ghostComboCount = 0;
    this.eatenGhostId = null;
    this.screenShakeTimer = 0;
    this.attractDecisionKey = '';
  }

  private clampCamera(x: number): number {
    return Math.max(0, Math.min(JR_GRID_COLS - JR_VIEWPORT_COLS, x));
  }

  private updateCamera(dt: number): void {
    const lookAhead =
      this.player.dir === 'RIGHT' ? 2.4 : this.player.dir === 'LEFT' ? -2.4 : 0;
    const desired = this.clampCamera(this.player.x + lookAhead - JR_VIEWPORT_COLS / 2);
    const lerp = 1 - Math.exp(-dt * 6.8);
    this.cameraX += (desired - this.cameraX) * lerp;
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
        y: this.player.y - 0.85,
        text: '1UP!',
        color: '#4ADE80',
        life: 1.45,
        maxLife: 1.45,
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
        life: 0.44,
        maxLife: 0.44,
        ring: true,
      });
    }
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.45;
      const mag = speed * (0.45 + Math.random() * 0.85);
      const maxLife = 0.28 + Math.random() * 0.36;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * mag,
        vy: Math.sin(angle) * mag,
        radius: 0.08 + Math.random() * 0.12,
        color,
        alpha: 1,
        life: maxLife,
        maxLife,
      });
    }
  }

  public step(dt: number): void {
    this.elapsedTime += dt;
    if (this.screenShakeTimer > 0) {
      this.screenShakeTimer = Math.max(0, this.screenShakeTimer - dt);
    }
    this.updateParticlesAndPopups(dt);

    if (this.phase === 'PAUSED' || this.phase === 'GAME_OVER') {
      return;
    }

    if (this.phase === 'TITLE_MENU') {
      this.stepAttractMode(dt);
      return;
    }

    if (this.phase === 'READY') {
      this.player.propellerPhase += dt * 10;
      this.updateCamera(dt);
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
        this.setupMaze(getJrMazeIndexForLevel(this.level), true);
        this.resetPositions();
        this.phase = 'READY';
        this.phaseTimer = 1.75;
        arcadeAudio.playJrStartFanfare();
      }
      return;
    }

    // Active PLAYING
    this.updateWaveAndFrightened(dt);
    this.updatePlayer(dt, false);
    this.updateCamera(dt);
    this.checkPelletConsumption();
    this.updateRoamingPrize(dt);
    this.updateGhosts(dt);
    this.checkEntityCollisions();
    this.updateAmbientAudio(dt);
  }

  private stepAttractMode(dt: number): void {
    const col = Math.floor(this.player.x);
    const row = Math.floor(this.player.y);
    const key = `${col},${row}`;
    const distToCenter = Math.hypot(this.player.x - (col + 0.5), this.player.y - (row + 0.5));
    if (distToCenter < 0.16 && key !== this.attractDecisionKey) {
      this.attractDecisionKey = key;
      const valid = PRIORITY_DIRS.filter((d) => {
        if (d === OPPOSITE_DIR[this.player.dir]) return false;
        const v = DIR_VECTORS[d];
        return isJrWalkableForPlayer(this.grid, col + v.x, row + v.y);
      });
      if (valid.length > 0) {
        this.player.nextDir = valid[Math.floor(Math.random() * valid.length)];
      }
    }

    this.updatePlayer(dt, true);
    this.updateCamera(dt);
    this.updateWaveAndFrightened(dt);
    this.updateGhosts(dt);

    for (const ghost of this.ghosts) {
      if (ghost.mode === 'IN_HOUSE' || ghost.mode === 'EXITING_HOUSE') continue;
      if (distSq(this.player.x, this.player.y, ghost.x, ghost.y) < 0.7) {
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
        p.radius += dt * 4.8;
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
      pop.y -= dt * 0.7;
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
    if (p.slowdownTimer > 0) {
      p.slowdownTimer = Math.max(0, p.slowdownTimer - dt);
    }

    const baseSpeed = 8.15 * this.getBaseSpeedMultiplier();
    const frightBonus = this.frightenedTimer > 0 ? 1.07 : 1.0;
    const bigDotDrag = p.slowdownTimer > 0 ? 0.74 : 1.0;
    p.speed = (attractMode ? baseSpeed * 0.85 : baseSpeed) * frightBonus * bigDotDrag;

    // Propeller beanie spins briskly when cruising, gently when idle
    p.propellerPhase += dt * (p.moving ? 22 * this.getBaseSpeedMultiplier() : 9);

    if (p.moving && !attractMode) {
      p.trail.push({ x: p.x, y: p.y, alpha: 0.36 });
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

    // Buffered pre-cornering turn
    if (p.nextDir !== 'NONE' && p.nextDir !== p.dir) {
      const nv = DIR_VECTORS[p.nextDir];
      const canTurn = isJrWalkableForPlayer(this.grid, col + nv.x, row + nv.y);
      if (canTurn) {
        const alignDist =
          p.nextDir === 'UP' || p.nextDir === 'DOWN'
            ? Math.abs(p.x - centerX)
            : Math.abs(p.y - centerY);
        if (alignDist <= 0.28) {
          if (p.nextDir === 'UP' || p.nextDir === 'DOWN') {
            p.x = centerX;
          } else {
            p.y = centerY;
          }
          p.dir = p.nextDir;
        }
      }
    }

    const v = DIR_VECTORS[p.dir];
    const stepDist = p.speed * dt;
    const targetX = p.x + v.x * stepDist;
    const targetY = p.y + v.y * stepDist;

    if (p.dir === 'LEFT' || p.dir === 'RIGHT') {
      p.y += (centerY - p.y) * Math.min(1, dt * 24);
    } else if (p.dir === 'UP' || p.dir === 'DOWN') {
      p.x += (centerX - p.x) * Math.min(1, dt * 24);
    }

    const aheadCol = Math.floor(p.x) + v.x;
    const aheadRow = Math.floor(p.y) + v.y;
    const blockedAhead = !isJrWalkableForPlayer(this.grid, aheadCol, aheadRow);

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

    if (p.moving) {
      p.mouthPhase += dt * 19.5;
    }
  }

  private checkPelletConsumption(): void {
    const col = Math.floor(this.player.x);
    const row = Math.floor(this.player.y);
    if (col < 0 || col >= JR_GRID_COLS || row < 0 || row >= JR_GRID_ROWS) return;

    const tile = this.grid[row][col];
    if (tile !== '.' && tile !== 'M' && tile !== 'o') return;

    const d = Math.hypot(this.player.x - (col + 0.5), this.player.y - (row + 0.5));
    if (d > 0.44) return;

    this.grid[row][col] = ' ';
    this.pelletsLeft -= 1;
    this.pelletsEatenThisLevel += 1;

    if (tile === '.') {
      this.addScore(10);
      arcadeAudio.playWaka();
      this.spawnParticles(col + 0.5, row + 0.5, this.maze.theme.pelletColor, 4, 2.3);
    } else if (tile === 'M') {
      // Authentic Jr. Pac-Man Mutated Super Dot: 50 pts + slight heavy chomp drag!
      this.mutatedDotsCount = Math.max(0, this.mutatedDotsCount - 1);
      this.player.slowdownTimer = 0.085;
      this.addScore(50);
      arcadeAudio.playBigDotWaka();
      this.spawnParticles(col + 0.5, row + 0.5, '#FBBF24', 9, 3.6);
    } else if (tile === 'o') {
      this.energizersLeft = Math.max(0, this.energizersLeft - 1);
      this.addScore(50);
      arcadeAudio.playPowerPellet();
      this.spawnParticles(col + 0.5, row + 0.5, '#FFE45E', 16, 4.8, true);
      this.triggerFrightenedMode();
    }

    // Spawn roaming toys from the Ghost House at classic milestones across the wide maze!
    const milestones = [55, 175, 340, 520];
    if (
      !this.prize.active &&
      this.prizeMilestonesTriggered < milestones.length &&
      this.pelletsEatenThisLevel >= milestones[this.prizeMilestonesTriggered]
    ) {
      this.prizeMilestonesTriggered += 1;
      this.spawnRoamingPrize();
    }

    if (this.pelletsLeft <= 0) {
      this.phase = 'STAGE_CLEAR';
      this.phaseTimer = 2.35;
      this.stageClearFlashPhase = 0;
      this.prize.active = false;
      arcadeAudio.playStageClear();
    }
  }

  private triggerFrightenedMode(): void {
    const baseFright = Math.max(1.8, 7.2 - (this.level - 1) * 0.68);
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

  private findTargetEnergizer(): Vec2 | null {
    const candidates: Vec2[] = [];
    for (let r = 0; r < JR_GRID_ROWS; r++) {
      for (let c = 0; c < JR_GRID_COLS; c++) {
        if (this.grid[r][c] === 'o') {
          candidates.push({ x: c + 0.5, y: r + 0.5 });
        }
      }
    }
    if (candidates.length === 0) return null;
    // Prefer an energizer on the opposite side of Jr. Pac-Man to maximize dramatic chase
    candidates.sort(
      (a, b) =>
        distSq(b.x, b.y, this.player.x, this.player.y) -
        distSq(a.x, a.y, this.player.x, this.player.y)
    );
    const pool = candidates.slice(0, Math.min(3, candidates.length));
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private spawnRoamingPrize(): void {
    const type = this.getCurrentPrizeType();
    const spec = JR_PRIZE_SPECS[type];
    this.prize = {
      active: true,
      exitingHouse: true,
      type,
      points: spec.points,
      x: 28,
      y: 14.5,
      dir: 'UP',
      bouncePhase: 0,
      targetEnergizer: this.findTargetEnergizer(),
      lastDecisionTileKey: '',
      lifetime: 38,
    };
  }

  private updateRoamingPrize(dt: number): void {
    if (!this.prize.active) return;

    const pr = this.prize;
    pr.lifetime -= dt;
    if (pr.lifetime <= 0) {
      pr.active = false;
      return;
    }

    pr.bouncePhase += dt * 11.2;

    // Exit Ghost House smoothly first (authentic Jr. Pac-Man!)
    if (pr.exitingHouse) {
      const exitSpeed = 4.2 * this.getBaseSpeedMultiplier();
      pr.y -= exitSpeed * dt;
      if (pr.y <= 11.5) {
        pr.y = 11.5;
        pr.exitingHouse = false;
        pr.dir =
          pr.targetEnergizer && pr.targetEnergizer.x < 28 ? 'LEFT' : 'RIGHT';
        pr.lastDecisionTileKey = '';
      }
      return;
    }

    const speed = 4.35 * this.getBaseSpeedMultiplier();

    this.prizeBounceCooldown -= dt;
    if (this.prizeBounceCooldown <= 0 && Math.abs(Math.sin(pr.bouncePhase)) < 0.14) {
      // Only play subtle bounce chime when toy is reasonably near the viewport
      if (Math.abs(pr.x - this.player.x) < 18) {
        arcadeAudio.playFruitBounce();
      }
      this.prizeBounceCooldown = 0.58;
    }

    const col = Math.floor(pr.x);
    const row = Math.floor(pr.y);

    // Check current tile for Dot Mutation ('.' -> 'M') or Energizer Destruction ('o' -> BOOM!)
    if (col >= 0 && col < JR_GRID_COLS && row >= 0 && row < JR_GRID_ROWS) {
      const tile = this.grid[row][col];
      if (tile === '.') {
        this.grid[row][col] = 'M';
        this.mutatedDotsCount += 1;
        this.spawnParticles(col + 0.5, row + 0.5, '#FBBF24', 5, 2.1);
        if (Math.abs(pr.x - this.player.x) < 16) {
          arcadeAudio.playDotMutate();
        }
      } else if (tile === 'o') {
        // ICONIC JR. PAC-MAN MECHANIC: Toy reaches Energizer and EXPLODES BOTH!
        this.grid[row][col] = ' ';
        this.pelletsLeft = Math.max(0, this.pelletsLeft - 1);
        this.energizersLeft = Math.max(0, this.energizersLeft - 1);
        this.energizersDestroyed += 1;
        pr.active = false;
        this.screenShakeTimer = 0.36;
        arcadeAudio.playEnergizerExplode();
        this.spawnParticles(col + 0.5, row + 0.5, '#FB7185', 28, 6.2, true);
        this.spawnParticles(col + 0.5, row + 0.5, '#FACC15', 16, 4.4, false);
        this.popups.push({
          x: col + 0.5,
          y: row + 0.3,
          text: 'BOOM!',
          color: '#FB7185',
          life: 1.25,
          maxLife: 1.25,
          scale: 1.3,
        });

        if (this.pelletsLeft <= 0) {
          this.phase = 'STAGE_CLEAR';
          this.phaseTimer = 2.35;
          this.stageClearFlashPhase = 0;
          arcadeAudio.playStageClear();
        }
        return;
      }
    }

    // Re-pick energizer target if our targeted one was already eaten by Jr. Pac-Man
    if (pr.targetEnergizer) {
      const tc = Math.floor(pr.targetEnergizer.x);
      const tr = Math.floor(pr.targetEnergizer.y);
      if (this.grid[tr]?.[tc] !== 'o') {
        pr.targetEnergizer = this.findTargetEnergizer();
      }
    }

    const centerX = col + 0.5;
    const centerY = row + 0.5;
    const key = `${col},${row}`;

    if (
      col >= 0 &&
      col < JR_GRID_COLS &&
      Math.hypot(pr.x - centerX, pr.y - centerY) < 0.14 &&
      key !== pr.lastDecisionTileKey
    ) {
      pr.lastDecisionTileKey = key;
      const valid = PRIORITY_DIRS.filter((d) => {
        if (d === OPPOSITE_DIR[pr.dir]) return false;
        const v = DIR_VECTORS[d];
        return isJrWalkableForPlayer(this.grid, col + v.x, row + v.y);
      });

      if (valid.length === 0) {
        pr.dir = OPPOSITE_DIR[pr.dir];
      } else if (!pr.targetEnergizer || Math.random() < 0.18) {
        pr.dir = valid[Math.floor(Math.random() * valid.length)];
      } else {
        let bestDir = valid[0];
        let bestDist = Infinity;
        for (const d of valid) {
          const v = DIR_VECTORS[d];
          const d2 = distSq(
            col + v.x + 0.5,
            row + v.y + 0.5,
            pr.targetEnergizer.x,
            pr.targetEnergizer.y
          );
          if (d2 < bestDist) {
            bestDist = d2;
            bestDir = d;
          }
        }
        pr.dir = bestDir;
      }

      pr.x = centerX;
      pr.y = centerY;
    }

    const v = DIR_VECTORS[pr.dir];
    pr.x += v.x * speed * dt;
    pr.y += v.y * speed * dt;
  }

  private getGhostTarget(ghost: JrGhostState): Vec2 {
    if (ghost.mode === 'EATEN') {
      return { x: this.maze.ghostHouseDoor.x, y: this.maze.ghostHouseDoor.y };
    }

    if (ghost.mode === 'SCATTER') {
      return ghost.scatterTarget;
    }

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
      case 'tim': {
        const d2 = distSq(ghost.x, ghost.y, px, py);
        return d2 > 64 ? { x: px, y: py } : ghost.scatterTarget;
      }
    }
  }

  private updateGhosts(dt: number): void {
    const baseGhostSpeed = 7.55 * this.getBaseSpeedMultiplier();
    const elroyBoost = this.pelletsLeft <= 45 ? 1.07 : this.pelletsLeft <= 18 ? 1.13 : 1.0;

    for (const ghost of this.ghosts) {
      ghost.animPhase += dt * (ghost.mode === 'FRIGHTENED' ? 11 : 9);

      if (ghost.mode === 'IN_HOUSE') {
        ghost.releaseDelay -= dt;
        ghost.y = 14.5 + Math.sin(this.elapsedTime * 5.2 + ghost.animPhase) * 0.28;
        if (ghost.releaseDelay <= 0) {
          ghost.mode = 'EXITING_HOUSE';
        }
        continue;
      }

      if (ghost.mode === 'EXITING_HOUSE') {
        const exitSpeed = 4.4 * this.getBaseSpeedMultiplier();
        const centerX = 28;
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

      if (ghost.mode === 'EATEN') {
        const distToDoor = Math.hypot(
          ghost.x - this.maze.ghostHouseDoor.x,
          ghost.y - this.maze.ghostHouseDoor.y
        );
        if (distToDoor < 0.38) {
          ghost.x = 28;
          ghost.y = 14.5;
          ghost.mode = 'EXITING_HOUSE';
          ghost.eatenThisPower = true;
          this.spawnParticles(28, 14.5, ghost.color, 10, 2.8);
          continue;
        }
      }

      let speed = baseGhostSpeed;
      if (ghost.mode === 'EATEN') {
        speed = baseGhostSpeed * 2.05;
      } else if (ghost.mode === 'FRIGHTENED') {
        speed = baseGhostSpeed * 0.58;
      } else if (ghost.id === 'blinky') {
        speed *= elroyBoost;
      }

      const col = Math.floor(ghost.x);
      const row = Math.floor(ghost.y);
      const centerX = col + 0.5;
      const centerY = row + 0.5;
      const tileKey = `${col},${row}`;

      const distToCenter = Math.hypot(ghost.x - centerX, ghost.y - centerY);
      if (col >= 0 && col < JR_GRID_COLS && distToCenter <= Math.max(0.14, speed * dt * 0.85)) {
        if (tileKey !== ghost.lastDecisionTileKey) {
          ghost.lastDecisionTileKey = tileKey;

          const validDirs = PRIORITY_DIRS.filter((d) => {
            if (d === OPPOSITE_DIR[ghost.dir]) return false;
            const v = DIR_VECTORS[d];
            return isJrWalkableForGhost(this.grid, col + v.x, row + v.y, false);
          });

          if (validDirs.length === 0) {
            ghost.dir = OPPOSITE_DIR[ghost.dir];
          } else if (validDirs.length === 1) {
            ghost.dir = validDirs[0];
          } else if (ghost.mode === 'FRIGHTENED') {
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
    }
  }

  private checkEntityCollisions(): void {
    // 1. Roaming Toy Prize collision
    if (this.prize.active && !this.prize.exitingHouse) {
      if (distSq(this.player.x, this.player.y, this.prize.x, this.prize.y) < 0.66) {
        const spec = JR_PRIZE_SPECS[this.prize.type];
        this.prizesCollected.push(this.prize.type);
        this.addScore(spec.points, this.prize.x, this.prize.y - 0.25, '#A5F3FC');
        this.spawnParticles(this.prize.x, this.prize.y, spec.color, 20, 4.6, true);
        this.prize.active = false;
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
          this.phase = 'DYING';
          this.phaseTimer = 1.45;
          this.player.deathProgress = 0;
          this.spawnParticles(this.player.x, this.player.y, '#FACC15', 18, 3.8);
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

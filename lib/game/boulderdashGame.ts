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

const VIEW_W = 864;
const VIEW_H = 640;
const TILE = 32;
const CAVE_COLS = 32;
const CAVE_ROWS = 20;
const STORAGE_KEY = 'boulderdash_hd_highscore_v1';

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

interface CaveDef {
  name: string;
  quota: number;
  timeLimit: number;
  dirtColor: string;
  wallColor: string;
  diamondColor: string;
  seed: number;
  boulders: number;
  diamonds: number;
  fireflies: number;
  butterflies: number;
}

const CAVES: CaveDef[] = [
  {
    name: 'Cave A · Crystal Intro',
    quota: 10,
    timeLimit: 120,
    dirtColor: '#7C4A22',
    wallColor: '#64748B',
    diamondColor: '#38BDF8',
    seed: 101,
    boulders: 64,
    diamonds: 18,
    fireflies: 2,
    butterflies: 0,
  },
  {
    name: 'Cave B · Butterfly Vault',
    quota: 14,
    timeLimit: 130,
    dirtColor: '#5B3A70',
    wallColor: '#7C3AED',
    diamondColor: '#F472B6',
    seed: 202,
    boulders: 72,
    diamonds: 12,
    fireflies: 2,
    butterflies: 3,
  },
  {
    name: 'Cave C · Avalanche Shaft',
    quota: 16,
    timeLimit: 125,
    dirtColor: '#1E5B4F',
    wallColor: '#14B8A6',
    diamondColor: '#FDE047',
    seed: 303,
    boulders: 84,
    diamonds: 22,
    fireflies: 3,
    butterflies: 2,
  },
  {
    name: 'Cave D · Firefly Labyrinth',
    quota: 18,
    timeLimit: 135,
    dirtColor: '#6B2D38',
    wallColor: '#E11D48',
    diamondColor: '#4ADE80',
    seed: 404,
    boulders: 78,
    diamonds: 22,
    fireflies: 4,
    butterflies: 2,
  },
  {
    name: 'Cave E · Diamond Cascade',
    quota: 20,
    timeLimit: 140,
    dirtColor: '#2B3F6B',
    wallColor: '#3B82F6',
    diamondColor: '#22D3EE',
    seed: 505,
    boulders: 88,
    diamonds: 24,
    fireflies: 3,
    butterflies: 4,
  },
];

// Deterministic PRNG so caves are consistent and always solvable
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

  private input: ArcadeInputState = createEmptyInput();
  private grid: number[][] = [];
  private falling: boolean[][] = [];
  private enemyDir: number[][] = []; // 0=R,1=D,2=L,3=U
  private playerR = 2;
  private playerC = 2;
  private exitR = CAVE_ROWS - 3;
  private exitC = CAVE_COLS - 3;
  private diamondsCollected = 0;
  private diamondQuota = 10;
  private caveTimeLeft = 120;
  private exitFlashTimer = 0;

  private tickAcc = 0;
  private playerMoveAcc = 0;
  private camX = 0;
  private camY = 0;
  private facing: -1 | 1 = 1;

  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  constructor() {
    this.buildCave(1);
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
    this.buildCave(1);
    this.phase = 'READY';
    this.phaseTimer = 1.05;
    this.bannerText = CAVES[0].name.toUpperCase();
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

  private addScore(pts: number, c?: number, r?: number, color = '#38BDF8'): void {
    if (this.phase === 'TITLE') return;
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(STORAGE_KEY, this.highScore);
    }
    if (c !== undefined && r !== undefined && pts >= 10) {
      this.popups.push({
        x: c * TILE + TILE * 0.5 - this.camX,
        y: r * TILE + TILE * 0.5 - this.camY,
        text: `+${pts}`,
        color,
        life: 0.9,
        maxLife: 0.9,
      });
    }
  }

  private buildCave(levelNum: number): void {
    const def = CAVES[(levelNum - 1) % CAVES.length];
    const rand = mulberry32(def.seed + Math.floor((levelNum - 1) / CAVES.length) * 37);

    this.grid = Array.from({ length: CAVE_ROWS }, (_, r) =>
      Array.from({ length: CAVE_COLS }, (_, c) =>
        r === 0 || r === CAVE_ROWS - 1 || c === 0 || c === CAVE_COLS - 1 ? STEEL : DIRT
      )
    );
    this.falling = Array.from({ length: CAVE_ROWS }, () => Array<boolean>(CAVE_COLS).fill(false));
    this.enemyDir = Array.from({ length: CAVE_ROWS }, () => Array<number>(CAVE_COLS).fill(0));

    // Carve structural horizontal brick ledges
    for (let ledge = 0; ledge < 3; ledge++) {
      const lr = 5 + ledge * 5;
      const startC = 3 + Math.floor(rand() * 10);
      const len = 7 + Math.floor(rand() * 8);
      for (let c = startC; c < Math.min(CAVE_COLS - 3, startC + len); c++) {
        this.grid[lr][c] = WALL;
      }
    }

    // Place Player at top-left safe pocket
    this.playerR = 2;
    this.playerC = 2;
    this.grid[this.playerR][this.playerC] = PLAYER;
    this.grid[2][3] = DIRT;
    this.grid[3][2] = DIRT;

    // Place Exit at bottom-right
    this.exitR = CAVE_ROWS - 3;
    this.exitC = CAVE_COLS - 3;
    this.grid[this.exitR][this.exitC] = EXIT_CLOSED;

    // Place Boulders
    let placed = 0;
    let guard = 0;
    while (placed < def.boulders && guard < 800) {
      guard++;
      const r = 1 + Math.floor(rand() * (CAVE_ROWS - 3));
      const c = 1 + Math.floor(rand() * (CAVE_COLS - 2));
      if (Math.abs(r - this.playerR) <= 2 && Math.abs(c - this.playerC) <= 2) continue;
      if (r === this.exitR && c === this.exitC) continue;
      if (this.grid[r][c] === DIRT) {
        this.grid[r][c] = BOULDER;
        placed++;
      }
    }

    // Place Diamonds
    placed = 0;
    guard = 0;
    while (placed < def.diamonds && guard < 800) {
      guard++;
      const r = 1 + Math.floor(rand() * (CAVE_ROWS - 2));
      const c = 1 + Math.floor(rand() * (CAVE_COLS - 2));
      if (Math.abs(r - this.playerR) <= 1 && Math.abs(c - this.playerC) <= 1) continue;
      if (this.grid[r][c] === DIRT) {
        this.grid[r][c] = DIAMOND;
        placed++;
      }
    }

    // Carve open chambers for Fireflies & Butterflies
    const placeEnemyChamber = (kind: number, count: number) => {
      for (let i = 0; i < count; i++) {
        for (let tries = 0; tries < 40; tries++) {
          const r = 3 + Math.floor(rand() * (CAVE_ROWS - 6));
          const c = 5 + Math.floor(rand() * (CAVE_COLS - 9));
          if (Math.abs(r - this.playerR) < 4 && Math.abs(c - this.playerC) < 5) continue;
          if (Math.abs(r - this.exitR) < 3 && Math.abs(c - this.exitC) < 3) continue;
          // Carve 3x3 room
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (this.grid[r + dr][c + dc] !== STEEL && this.grid[r + dr][c + dc] !== EXIT_CLOSED) {
                this.grid[r + dr][c + dc] = EMPTY;
              }
            }
          }
          // Put a boulder above butterfly rooms so player can drop rocks to harvest 9 diamonds!
          if (kind === BUTTERFLY && r - 2 >= 1 && this.grid[r - 2][c] === DIRT) {
            this.grid[r - 2][c] = BOULDER;
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
    this.diamondQuota = def.quota;
    this.caveTimeLeft = def.timeLimit;
    this.exitFlashTimer = 0;
    this.tickAcc = 0;
    this.playerMoveAcc = 0;
    this.centerCameraImmediate();
  }

  private centerCameraImmediate(): void {
    const maxCamX = Math.max(0, CAVE_COLS * TILE - VIEW_W);
    const maxCamY = Math.max(0, CAVE_ROWS * TILE - VIEW_H);
    this.camX = Math.max(0, Math.min(maxCamX, this.playerC * TILE + TILE * 0.5 - VIEW_W * 0.5));
    this.camY = Math.max(0, Math.min(maxCamY, this.playerR * TILE + TILE * 0.5 - VIEW_H * 0.5));
  }

  public step(dt: number): void {
    this.time += dt;
    stepParticlesAndPopups(this.particles, this.popups, dt);
    if (this.exitFlashTimer > 0) this.exitFlashTimer = Math.max(0, this.exitFlashTimer - dt);

    if (this.phase === 'PAUSED' || this.phase === 'GAME_OVER') return;

    if (this.phase === 'READY') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.phase = 'PLAYING';
        this.bannerText = '';
      }
      return;
    }

    if (this.phase === 'STAGE_CLEAR') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.level += 1;
        this.buildCave(this.level);
        this.phase = 'READY';
        this.phaseTimer = 1.1;
        this.bannerText = CAVES[(this.level - 1) % CAVES.length].name.toUpperCase();
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

    // Smooth camera tracking
    const maxCamX = Math.max(0, CAVE_COLS * TILE - VIEW_W);
    const maxCamY = Math.max(0, CAVE_ROWS * TILE - VIEW_H);
    const targetCamX = Math.max(0, Math.min(maxCamX, this.playerC * TILE + TILE * 0.5 - VIEW_W * 0.5));
    const targetCamY = Math.max(0, Math.min(maxCamY, this.playerR * TILE + TILE * 0.5 - VIEW_H * 0.5));
    this.camX += (targetCamX - this.camX) * Math.min(1, dt * 8);
    this.camY += (targetCamY - this.camY) * Math.min(1, dt * 8);

    // Responsive player grid movement (~8.2 tiles/sec)
    this.playerMoveAcc += dt;
    if (this.playerMoveAcc >= 0.125) {
      const moved = this.stepPlayer(isAttract);
      if (moved) this.playerMoveAcc = 0;
      else this.playerMoveAcc = 0.125;
    }

    // Authentic cellular physics tick (~7.4 ticks/sec)
    this.tickAcc += dt;
    if (this.tickAcc >= 0.135) {
      this.tickAcc -= 0.135;
      this.stepPhysics(isAttract);
    }
  }

  private stepPlayer(isAttract: boolean): boolean {
    let dr = 0;
    let dc = 0;

    if (isAttract) {
      // Seek nearest diamond or open exit
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
          // Avoid walking directly under a falling boulder
          if (this.grid[nr - 1]?.[nc] === BOULDER && this.falling[nr - 1]?.[nc]) continue;
          const dist = Math.abs(nr - targetR) + Math.abs(nc - targetC) + Math.random() * 0.5;
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
      else return false;
    }

    if (dc !== 0) this.facing = dc < 0 ? -1 : 1;

    const nr = this.playerR + dr;
    const nc = this.playerC + dc;
    const target = this.grid[nr]?.[nc];
    if (target === undefined || target === STEEL || target === WALL || target === EXIT_CLOSED) {
      return false;
    }

    // Snap-dig (hold Fire + direction to clear adjacent dirt/diamond without stepping into it!)
    if (!isAttract && this.input.fire && (target === DIRT || target === DIAMOND)) {
      if (target === DIAMOND) {
        this.collectDiamond(nc, nr, isAttract);
      } else {
        arcadeAudio.playDigStep();
      }
      this.grid[nr][nc] = EMPTY;
      return true;
    }

    // Push boulder horizontally into empty space
    if (target === BOULDER && dr === 0 && !this.falling[nr][nc]) {
      const pushC = nc + dc;
      if (this.grid[nr]?.[pushC] === EMPTY) {
        this.grid[nr][pushC] = BOULDER;
        this.grid[nr][nc] = PLAYER;
        this.grid[this.playerR][this.playerC] = EMPTY;
        this.playerC = nc;
        if (!isAttract) arcadeAudio.playRockThud();
        return true;
      }
      return false;
    }

    if (target === BOULDER) return false;

    if (target === FIREFLY || target === BUTTERFLY) {
      this.explodeAt(nr, nc, target === BUTTERFLY, isAttract);
      return true;
    }

    if (target === DIAMOND) {
      this.collectDiamond(nc, nr, isAttract);
    } else if (target === DIRT && !isAttract) {
      arcadeAudio.playDigStep();
    }

    if (target === EXIT_OPEN) {
      if (isAttract) {
        this.buildCave(1);
        return true;
      }
      const timeBonus = Math.ceil(this.caveTimeLeft) * 10;
      this.addScore(timeBonus, nc, nr, '#4ADE80');
      arcadeAudio.playStageClear();
      this.phase = 'STAGE_CLEAR';
      this.phaseTimer = 1.4;
      this.bannerText = `CAVE CLEAR! +${timeBonus}`;
      return true;
    }

    this.grid[this.playerR][this.playerC] = EMPTY;
    this.playerR = nr;
    this.playerC = nc;
    this.grid[this.playerR][this.playerC] = PLAYER;
    return true;
  }

  private collectDiamond(c: number, r: number, isAttract: boolean): void {
    this.diamondsCollected += 1;
    const extra = this.diamondsCollected > this.diamondQuota;
    const pts = extra ? 25 : 15;
    if (!isAttract) arcadeAudio.playDiamond();
    spawnBurst(
      this.particles,
      c * TILE + TILE * 0.5 - this.camX,
      r * TILE + TILE * 0.5 - this.camY,
      CAVES[(this.level - 1) % CAVES.length].diamondColor,
      12,
      150,
      3
    );
    this.addScore(pts, c, r, '#38BDF8');

    if (this.diamondsCollected === this.diamondQuota) {
      this.grid[this.exitR][this.exitC] = EXIT_OPEN;
      this.exitFlashTimer = 0.45;
      if (!isAttract) arcadeAudio.playKeyUnlock();
      this.popups.push({
        x: VIEW_W * 0.5,
        y: VIEW_H * 0.25,
        text: 'EXIT OPEN!',
        color: '#4ADE80',
        life: 1.5,
        maxLife: 1.5,
      });
    }
  }

  private explodeAt(cr: number, cc: number, intoDiamonds: boolean, isAttract: boolean): void {
    if (!isAttract) arcadeAudio.playExplosion(true);
    spawnBurst(
      this.particles,
      cc * TILE + TILE * 0.5 - this.camX,
      cr * TILE + TILE * 0.5 - this.camY,
      intoDiamonds ? '#38BDF8' : '#FB923C',
      26,
      240,
      4.5
    );
    let killedPlayer = false;
    for (let r = cr - 1; r <= cr + 1; r++) {
      for (let c = cc - 1; c <= cc + 1; c++) {
        if (r <= 0 || r >= CAVE_ROWS - 1 || c <= 0 || c >= CAVE_COLS - 1) continue;
        if (this.grid[r][c] === STEEL) continue;
        if (r === this.playerR && c === this.playerC) killedPlayer = true;
        this.grid[r][c] = intoDiamonds ? DIAMOND : EMPTY;
        this.falling[r][c] = false;
      }
    }
    if (intoDiamonds) {
      this.addScore(250, cc, cr, '#38BDF8');
    }
    if (killedPlayer) {
      if (isAttract) this.buildCave(1);
      else this.killPlayer();
    }
  }

  private killPlayer(): void {
    arcadeAudio.playDeath();
    this.lives -= 1;
    if (this.lives <= 0) {
      this.phase = 'GAME_OVER';
      this.bannerText = 'GAME OVER';
      return;
    }
    this.buildCave(this.level);
    this.phase = 'READY';
    this.phaseTimer = 1.1;
    this.bannerText = 'TRY AGAIN!';
  }

  private isRounded(cell: number): boolean {
    return cell === BOULDER || cell === DIAMOND || cell === WALL;
  }

  private stepPhysics(isAttract: boolean): void {
    const moved = Array.from({ length: CAVE_ROWS }, () => Array<boolean>(CAVE_COLS).fill(false));

    // Bottom-to-top scan for authentic falling rock & diamond roll-off physics
    for (let r = CAVE_ROWS - 2; r >= 1; r--) {
      for (let c = 1; c < CAVE_COLS - 1; c++) {
        if (moved[r][c]) continue;
        const cell = this.grid[r][c];

        if (cell === BOULDER || cell === DIAMOND) {
          const below = this.grid[r + 1][c];
          if (below === EMPTY) {
            this.grid[r + 1][c] = cell;
            this.grid[r][c] = EMPTY;
            this.falling[r + 1][c] = true;
            this.falling[r][c] = false;
            moved[r + 1][c] = true;
          } else if (this.falling[r][c] && (below === PLAYER || below === FIREFLY || below === BUTTERFLY)) {
            this.explodeAt(r + 1, c, below === BUTTERFLY, isAttract);
            return;
          } else if (this.isRounded(below)) {
            // Roll left or right if adjacent + below-adjacent are empty
            if (this.grid[r][c - 1] === EMPTY && this.grid[r + 1][c - 1] === EMPTY) {
              this.grid[r][c - 1] = cell;
              this.grid[r][c] = EMPTY;
              this.falling[r][c - 1] = true;
              this.falling[r][c] = false;
              moved[r][c - 1] = true;
            } else if (this.grid[r][c + 1] === EMPTY && this.grid[r + 1][c + 1] === EMPTY) {
              this.grid[r][c + 1] = cell;
              this.grid[r][c] = EMPTY;
              this.falling[r][c + 1] = true;
              this.falling[r][c] = false;
              moved[r][c + 1] = true;
            } else {
              if (this.falling[r][c] && !isAttract && cell === BOULDER) {
                arcadeAudio.playRockThud();
              }
              this.falling[r][c] = false;
            }
          } else {
            if (this.falling[r][c] && !isAttract && cell === BOULDER) {
              arcadeAudio.playRockThud();
            }
            this.falling[r][c] = false;
          }
        } else if (cell === FIREFLY || cell === BUTTERFLY) {
          // Check adjacent player -> explode!
          const adjPlayer =
            Math.abs(r - this.playerR) + Math.abs(c - this.playerC) === 1;
          if (adjPlayer) {
            this.explodeAt(r, c, cell === BUTTERFLY, isAttract);
            return;
          }

          // Firefly follows left wall; Butterfly follows right wall
          const d = this.enemyDir[r][c];
          const turnPref = cell === FIREFLY ? [(d + 3) % 4, d, (d + 1) % 4, (d + 2) % 4] : [(d + 1) % 4, d, (d + 3) % 4, (d + 2) % 4];
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
              moved[nr][nc] = true;
              break;
            }
          }
        }
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const def = CAVES[(this.level - 1) % CAVES.length];

    ctx.fillStyle = this.exitFlashTimer > 0 ? '#E2E8F0' : '#090A10';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    ctx.save();
    ctx.translate(-Math.round(this.camX), -Math.round(this.camY));

    const minC = Math.max(0, Math.floor(this.camX / TILE));
    const maxC = Math.min(CAVE_COLS - 1, Math.ceil((this.camX + VIEW_W) / TILE));
    const minR = Math.max(0, Math.floor(this.camY / TILE));
    const maxR = Math.min(CAVE_ROWS - 1, Math.ceil((this.camY + VIEW_H) / TILE));

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const cell = this.grid[r][c];
        if (cell === EMPTY) continue;
        const x = c * TILE;
        const y = r * TILE;

        if (cell === STEEL) {
          ctx.fillStyle = '#334155';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.strokeStyle = '#64748B';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
          ctx.fillStyle = '#94A3B8';
          ctx.fillRect(x + 6, y + 6, 4, 4);
          ctx.fillRect(x + TILE - 10, y + TILE - 10, 4, 4);
        } else if (cell === DIRT) {
          ctx.fillStyle = def.dirtColor;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          if ((r + c) % 2 === 0) {
            ctx.fillRect(x + 5, y + 7, 5, 4);
            ctx.fillRect(x + 19, y + 20, 6, 4);
          } else {
            ctx.fillRect(x + 17, y + 8, 5, 4);
            ctx.fillRect(x + 7, y + 22, 5, 4);
          }
        } else if (cell === WALL) {
          ctx.fillStyle = def.wallColor;
          ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE / 2 - 1);
          ctx.strokeRect(x + 1, y + TILE / 2, TILE - 2, TILE / 2 - 1);
        } else if (cell === BOULDER) {
          const grad = ctx.createRadialGradient(x + 11, y + 11, 2, x + 16, y + 16, 15);
          grad.addColorStop(0, '#E2E8F0');
          grad.addColorStop(0.55, '#94A3B8');
          grad.addColorStop(1, '#475569');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(x + 16, y + 16, 14.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#1E293B';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else if (cell === DIAMOND) {
          const glint = 0.78 + Math.sin(this.time * 7 + r + c) * 0.22;
          ctx.save();
          ctx.translate(x + 16, y + 16);
          ctx.shadowColor = def.diamondColor;
          ctx.shadowBlur = 10 * glint;
          ctx.fillStyle = def.diamondColor;
          ctx.beginPath();
          ctx.moveTo(0, -13);
          ctx.lineTo(12, 0);
          ctx.lineTo(0, 13);
          ctx.lineTo(-12, 0);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.moveTo(0, -7);
          ctx.lineTo(5, 0);
          ctx.lineTo(0, 7);
          ctx.lineTo(-5, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else if (cell === EXIT_CLOSED) {
          ctx.fillStyle = '#475569';
          ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
          ctx.strokeStyle = '#94A3B8';
          ctx.strokeRect(x + 6, y + 6, TILE - 12, TILE - 12);
        } else if (cell === EXIT_OPEN) {
          const flash = Math.floor(this.time * 8) % 2 === 0;
          ctx.save();
          ctx.shadowColor = '#4ADE80';
          ctx.shadowBlur = 14;
          ctx.fillStyle = flash ? '#4ADE80' : '#16A34A';
          ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
          ctx.fillStyle = '#052E16';
          ctx.fillRect(x + 8, y + 8, TILE - 16, TILE - 16);
          ctx.restore();
        } else if (cell === FIREFLY) {
          const pulse = Math.sin(this.time * 16 + r) * 2;
          ctx.save();
          ctx.translate(x + 16, y + 16);
          ctx.fillStyle = '#FB923C';
          ctx.beginPath();
          ctx.roundRect(-11, -11, 22, 22, 6);
          ctx.fill();
          ctx.fillStyle = '#FEF08A';
          ctx.beginPath();
          ctx.arc(0, 0, 5 + pulse * 0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (cell === BUTTERFLY) {
          const flap = Math.sin(this.time * 18 + c) * 4;
          ctx.save();
          ctx.translate(x + 16, y + 16);
          ctx.fillStyle = '#38BDF8';
          ctx.beginPath();
          ctx.ellipse(-7, -3, 6, 8 - flap * 0.4, -0.3, 0, Math.PI * 2);
          ctx.ellipse(7, -3, 6, 8 - flap * 0.4, 0.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#F472B6';
          ctx.fillRect(-2.5, -10, 5, 20);
          ctx.restore();
        } else if (cell === PLAYER) {
          // Rockford miner hero
          ctx.save();
          ctx.translate(x + 16, y + 16);
          ctx.scale(this.facing, 1);
          // Hard hat
          ctx.fillStyle = '#FACC15';
          ctx.beginPath();
          ctx.arc(0, -5, 11, Math.PI, 0);
          ctx.fill();
          ctx.fillRect(-13, -6, 26, 3);
          // Face & body
          ctx.fillStyle = '#FDBA74';
          ctx.fillRect(-7, -3, 14, 8);
          ctx.fillStyle = '#0F172A';
          ctx.fillRect(1, -1, 3, 3);
          ctx.fillStyle = '#A855F7';
          ctx.beginPath();
          ctx.roundRect(-9, 5, 18, 9, 4);
          ctx.fill();
          ctx.restore();
        }
      }
    }

    ctx.restore();

    renderParticlesAndPopups(ctx, this.particles, this.popups);

    if (this.bannerText && (this.phase === 'READY' || this.phase === 'STAGE_CLEAR')) {
      ctx.save();
      ctx.font = '800 28px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(4, 6, 13, 0.84)';
      ctx.fillRect(VIEW_W * 0.2, VIEW_H * 0.42, VIEW_W * 0.6, 56);
      ctx.fillStyle = '#C084FC';
      ctx.fillText(this.bannerText, VIEW_W * 0.5, VIEW_H * 0.42 + 28);
      ctx.restore();
    }

    if (visualMode === 'crt') renderCrtOverlay(ctx, VIEW_W, VIEW_H);
  }
}

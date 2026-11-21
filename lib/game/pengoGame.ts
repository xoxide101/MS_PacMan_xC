import { arcadeAudio } from './audio';
import {
  ArcadeGameInstance,
  ArcadeInputState,
  ClassicGameHud,
  ClassicGamePhase,
  ScorePopup,
  SimpleParticle,
  createEmptyInput,
  readHighScore,
  renderCrtOverlay,
  renderParticlesAndPopups,
  saveHighScore,
  spawnBurst,
  stepParticlesAndPopups,
} from './classicArcadeInterface';

const LOGICAL_W = 494;
const LOGICAL_H = 590;
const GRID_COLS = 13;
const GRID_ROWS = 15;
const TILE = 34;
const BOARD_X = Math.floor((LOGICAL_W - GRID_COLS * TILE) / 2); // 26
const BOARD_Y = 58;

type TileKind = 0 | 1 | 2 | 3; // 0 = empty, 1 = ice, 2 = diamond, 3 = egg ice

interface SlidingBlock {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: 1 | 2;
  crushCount: number;
}

interface SnoBee {
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  stunTimer: number;
  digTimer: number;
  alive: boolean;
  color: string;
}

const ACT_PALETTES = [
  { wall: '#38BDF8', ice: '#7DD3FC', iceDark: '#0284C7', bg: '#050C1B', name: 'ACT 1 · ARCTIC' },
  { wall: '#A855F7', ice: '#D8B4FE', iceDark: '#7E22CE', bg: '#0B0619', name: 'ACT 2 · AURORA' },
  { wall: '#F472B6', ice: '#FBCFE8', iceDark: '#BE185D', bg: '#160613', name: 'ACT 3 · GLACIER' },
  { wall: '#4ADE80', ice: '#BBF7D0', iceDark: '#15803D', bg: '#04140D', name: 'ACT 4 · PERMAFROST' },
  { wall: '#FACC15', ice: '#FEF08A', iceDark: '#CA8A04', bg: '#141004', name: 'ACT 5 · POLAR CROWN' },
];

export class PengoArcadeGame implements ArcadeGameInstance {
  public readonly logicalWidth = LOGICAL_W;
  public readonly logicalHeight = LOGICAL_H;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'Shove / Shake';
  public readonly secondaryActionLabel = undefined;

  private readonly storageKey = 'pengo_hd_highscore_v1';
  private phase: ClassicGamePhase = 'TITLE';
  private score = 0;
  private highScore = 0;
  private level = 1;
  private lives = 3;
  private input: ArcadeInputState = createEmptyInput();
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  private grid: TileKind[][] = [];
  private sliders: SlidingBlock[] = [];
  private bees: SnoBee[] = [];
  private eggsRemaining = 0;
  private diamondsAligned = false;

  // Pengo hero
  private px = 0;
  private py = 0;
  private faceX = 0;
  private faceY = 1;
  private pushAnim = 0;
  private invuln = 0;

  // Electrified outer wall shake
  private wallShakeSide: 'top' | 'bottom' | 'left' | 'right' | null = null;
  private wallShakeTimer = 0;

  private time = 0;
  private readyTimer = 0;
  private clearTimer = 0;
  private eggFlashTimer = 3.2;

  constructor() {
    this.highScore = readHighScore(this.storageKey);
    this.buildAct(1);
  }

  public startNewGame(): void {
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.particles = [];
    this.popups = [];
    this.buildAct(1);
    this.phase = 'READY';
    this.readyTimer = 1.1;
    arcadeAudio.playArcadeStart();
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.buildAct(1);
  }

  public restartStage(): void {
    if (this.phase === 'PLAYING' || this.phase === 'PAUSED') {
      this.buildAct(this.level);
      this.phase = 'READY';
      this.readyTimer = 0.85;
    }
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  private tileCenter(c: number, r: number): { x: number; y: number } {
    return {
      x: BOARD_X + c * TILE + TILE * 0.5,
      y: BOARD_Y + r * TILE + TILE * 0.5,
    };
  }

  private addScore(pts: number, x: number, y: number, text?: string, color = '#FDE047'): void {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(this.storageKey, this.highScore);
    }
    this.popups.push({
      x,
      y,
      text: text ?? `+${pts}`,
      color,
      life: 1.0,
      maxLife: 1.0,
    });
  }

  private buildAct(lvl: number): void {
    this.level = lvl;
    this.sliders = [];
    this.bees = [];
    this.diamondsAligned = false;
    this.wallShakeSide = null;
    this.wallShakeTimer = 0;
    this.eggFlashTimer = 3.0;

    // Generate clean navigable ice corridor maze
    this.grid = Array.from({ length: GRID_ROWS }, () =>
      Array.from({ length: GRID_COLS }, () => 1 as TileKind)
    );

    // Carve guaranteed classic arcade loops
    for (let r = 1; r < GRID_ROWS - 1; r += 2) {
      for (let c = 1; c < GRID_COLS - 1; c++) {
        if ((c + r + lvl) % 3 !== 0) this.grid[r][c] = 0;
      }
    }
    for (let c = 1; c < GRID_COLS - 1; c += 2) {
      for (let r = 1; r < GRID_ROWS - 1; r++) {
        if ((c * 2 + r + lvl) % 3 !== 0) this.grid[r][c] = 0;
      }
    }

    // Clear Pengo center spawn cross
    const sc = 6;
    const sr = 7;
    this.grid[sr][sc] = 0;
    this.grid[sr - 1][sc] = 0;
    this.grid[sr + 1][sc] = 0;
    this.grid[sr][sc - 1] = 0;
    this.grid[sr][sc + 1] = 0;
    const startPos = this.tileCenter(sc, sr);
    this.px = startPos.x;
    this.py = startPos.y;
    this.faceX = 0;
    this.faceY = 1;
    this.invuln = 1.0;

    // Place 3 Glowing Diamond Blocks (non-aligned initially)
    const diamondCoords = [
      [2, 2],
      [10, 4],
      [4, 12],
    ];
    for (const [dc, dr] of diamondCoords) {
      this.grid[dr][dc] = 2;
    }

    // Place flashing Egg Blocks
    const eggTarget = Math.min(6, 2 + lvl);
    let placedEggs = 0;
    for (let tries = 0; tries < 80 && placedEggs < eggTarget; tries++) {
      const rc = Math.floor(Math.random() * GRID_COLS);
      const rr = Math.floor(Math.random() * GRID_ROWS);
      if (this.grid[rr][rc] === 1 && Math.hypot(rc - sc, rr - sr) > 3) {
        this.grid[rr][rc] = 3;
        placedEggs++;
      }
    }
    this.eggsRemaining = placedEggs;

    // Spawn starting Sno-Bees in corners
    const spawnCorners = [
      [1, 1],
      [GRID_COLS - 2, 1],
      [1, GRID_ROWS - 2],
      [GRID_COLS - 2, GRID_ROWS - 2],
    ];
    const beeColors = ['#4ADE80', '#F472B6', '#FB923C', '#FACC15'];
    const initialBees = Math.min(4, 2 + Math.floor((lvl + 1) / 2));
    for (let i = 0; i < initialBees; i++) {
      const [bc, br] = spawnCorners[i % spawnCorners.length];
      this.grid[br][bc] = 0;
      const pos = this.tileCenter(bc, br);
      this.bees.push({
        x: pos.x,
        y: pos.y,
        dirX: i % 2 === 0 ? 1 : -1,
        dirY: 0,
        stunTimer: 0,
        digTimer: 0,
        alive: true,
        color: beeColors[i % beeColors.length],
      });
    }
  }

  private gridCoords(x: number, y: number): { c: number; r: number } {
    return {
      c: Math.max(0, Math.min(GRID_COLS - 1, Math.floor((x - BOARD_X) / TILE))),
      r: Math.max(0, Math.min(GRID_ROWS - 1, Math.floor((y - BOARD_Y) / TILE))),
    };
  }

  private isSolid(c: number, r: number): boolean {
    if (c < 0 || c >= GRID_COLS || r < 0 || r >= GRID_ROWS) return true;
    return this.grid[r][c] !== 0;
  }

  private checkDiamondAlignment(): void {
    if (this.diamondsAligned) return;
    const coords: Array<{ c: number; r: number }> = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (this.grid[r][c] === 2) coords.push({ c, r });
      }
    }
    if (coords.length !== 3) return;

    // Horizontal consecutive?
    const sameRow = coords[0].r === coords[1].r && coords[1].r === coords[2].r;
    const sortedC = [...coords].sort((a, b) => a.c - b.c);
    const hLine = sameRow && sortedC[1].c === sortedC[0].c + 1 && sortedC[2].c === sortedC[1].c + 1;

    // Vertical consecutive?
    const sameCol = coords[0].c === coords[1].c && coords[1].c === coords[2].c;
    const sortedR = [...coords].sort((a, b) => a.r - b.r);
    const vLine = sameCol && sortedR[1].r === sortedR[0].r + 1 && sortedR[2].r === sortedR[1].r + 1;

    if (!hLine && !vLine) return;

    this.diamondsAligned = true;
    const onWall =
      (hLine && (coords[0].r === 0 || coords[0].r === GRID_ROWS - 1)) ||
      (vLine && (coords[0].c === 0 || coords[0].c === GRID_COLS - 1));
    const bonus = onWall ? 5000 : 10000;
    const mid = this.tileCenter(coords[1].c, coords[1].r);
    this.addScore(bonus, mid.x, mid.y, `DIAMOND BONUS +${bonus}!`, '#FACC15');
    spawnBurst(this.particles, mid.x, mid.y, '#FDE047', 36, 240, 4.5);
    arcadeAudio.playDiamond();

    // Freeze ALL active Sno-Bees!
    for (const b of this.bees) {
      if (b.alive) b.stunTimer = 6.5;
    }
  }

  private performPushOrShake(): void {
    this.pushAnim = 0.16;
    const cur = this.gridCoords(this.px, this.py);
    const tc = cur.c + this.faceX;
    const tr = cur.r + this.faceY;

    // Outer perimeter wall shake!
    if (tc < 0 || tc >= GRID_COLS || tr < 0 || tr >= GRID_ROWS) {
      this.wallShakeSide =
        tc < 0 ? 'left' : tc >= GRID_COLS ? 'right' : tr < 0 ? 'top' : 'bottom';
      this.wallShakeTimer = 0.48;
      arcadeAudio.playElectricZap();
      for (const b of this.bees) {
        if (!b.alive) continue;
        const bc = this.gridCoords(b.x, b.y);
        const touching =
          (this.wallShakeSide === 'left' && bc.c === 0) ||
          (this.wallShakeSide === 'right' && bc.c === GRID_COLS - 1) ||
          (this.wallShakeSide === 'top' && bc.r === 0) ||
          (this.wallShakeSide === 'bottom' && bc.r === GRID_ROWS - 1);
        if (touching) {
          b.stunTimer = 4.6;
          spawnBurst(this.particles, b.x, b.y, '#38BDF8', 12, 130, 3);
        }
      }
      return;
    }

    const tile = this.grid[tr][tc];
    if (tile === 0) return;

    const beyondC = tc + this.faceX;
    const beyondR = tr + this.faceY;
    const blockedBehind = this.isSolid(beyondC, beyondR);

    if (blockedBehind) {
      // Diamond blocks cannot be shattered
      if (tile === 2) {
        arcadeAudio.playRockThud();
        return;
      }
      // Shatter ice block (or hidden egg!)
      const center = this.tileCenter(tc, tr);
      if (tile === 3) {
        this.eggsRemaining = Math.max(0, this.eggsRemaining - 1);
        this.addScore(500, center.x, center.y, 'EGG +500!', '#F472B6');
        arcadeAudio.playCoin();
      } else {
        this.addScore(30, center.x, center.y, '+30', '#7DD3FC');
        arcadeAudio.playPop();
      }
      this.grid[tr][tc] = 0;
      spawnBurst(this.particles, center.x, center.y, '#BAE6FD', 14, 160, 3.2);
    } else {
      // Slide ice/diamond block!
      const kind: 1 | 2 = tile === 2 ? 2 : 1;
      if (tile === 3) {
        // Sliding an egg block crushes the egg inside
        this.eggsRemaining = Math.max(0, this.eggsRemaining - 1);
        const center = this.tileCenter(tc, tr);
        this.addScore(500, center.x, center.y, 'EGG CRUSH +500!', '#F472B6');
      }
      this.grid[tr][tc] = 0;
      const start = this.tileCenter(tc, tr);
      this.sliders.push({
        x: start.x,
        y: start.y,
        vx: this.faceX * 390,
        vy: this.faceY * 390,
        kind,
        crushCount: 0,
      });
      arcadeAudio.playBoulderPush();
    }
  }

  private hatchNextEgg(): void {
    const eggTiles: Array<{ c: number; r: number }> = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (this.grid[r][c] === 3) eggTiles.push({ c, r });
      }
    }
    if (eggTiles.length === 0) return;
    const pick = eggTiles[Math.floor(Math.random() * eggTiles.length)];
    this.grid[pick.r][pick.c] = 0;
    this.eggsRemaining = Math.max(0, this.eggsRemaining - 1);
    const pos = this.tileCenter(pick.c, pick.r);
    const colors = ['#4ADE80', '#F472B6', '#FB923C', '#FACC15'];
    this.bees.push({
      x: pos.x,
      y: pos.y,
      dirX: 1,
      dirY: 0,
      stunTimer: 0.4,
      digTimer: 0,
      alive: true,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
    spawnBurst(this.particles, pos.x, pos.y, '#FDE047', 12, 120, 3);
  }

  public step(dt: number): void {
    this.time += dt;
    stepParticlesAndPopups(this.particles, this.popups, dt);
    if (this.phase === 'PAUSED') return;

    if (this.eggFlashTimer > 0) this.eggFlashTimer = Math.max(0, this.eggFlashTimer - dt);
    if (this.wallShakeTimer > 0) {
      this.wallShakeTimer = Math.max(0, this.wallShakeTimer - dt);
      if (this.wallShakeTimer <= 0) this.wallShakeSide = null;
    }
    if (this.pushAnim > 0) this.pushAnim = Math.max(0, this.pushAnim - dt);
    if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);

    if (this.phase === 'TITLE') {
      // Gentle attract motion for Sno-Bees
      for (const b of this.bees) {
        const nextX = b.x + b.dirX * 48 * dt;
        const nextY = b.y + b.dirY * 48 * dt;
        const nc = this.gridCoords(nextX + b.dirX * 13, nextY + b.dirY * 13);
        if (this.isSolid(nc.c, nc.r)) {
          const tmp = b.dirX;
          b.dirX = -b.dirY;
          b.dirY = tmp;
        } else {
          b.x = nextX;
          b.y = nextY;
        }
      }
      return;
    }

    if (this.phase === 'READY') {
      this.readyTimer -= dt;
      if (this.readyTimer <= 0) this.phase = 'PLAYING';
      return;
    }

    if (this.phase === 'STAGE_CLEAR') {
      this.clearTimer -= dt;
      if (this.clearTimer <= 0) {
        this.buildAct(this.level + 1);
        this.phase = 'READY';
        this.readyTimer = 1.0;
      }
      return;
    }

    if (this.phase === 'GAME_OVER') return;

    // Player movement with crisp corridor alignment
    const spd = 142 * (this.input.moveScale ?? 1);
    let mx = 0;
    let my = 0;
    if (this.input.left) mx = -1;
    else if (this.input.right) mx = 1;
    else if (this.input.up) my = -1;
    else if (this.input.down) my = 1;

    if (mx !== 0 || my !== 0) {
      this.faceX = mx;
      this.faceY = my;
      const cur = this.gridCoords(this.px, this.py);
      const center = this.tileCenter(cur.c, cur.r);
      // Assist corner-turning smoothly
      if (mx !== 0) this.py += (center.y - this.py) * Math.min(1, dt * 16);
      if (my !== 0) this.px += (center.x - this.px) * Math.min(1, dt * 16);

      const nx = this.px + mx * spd * dt;
      const ny = this.py + my * spd * dt;
      const probeX = nx + mx * (TILE * 0.42);
      const probeY = ny + my * (TILE * 0.42);
      const outOfBounds =
        probeX < BOARD_X + 2 ||
        probeX > BOARD_X + GRID_COLS * TILE - 2 ||
        probeY < BOARD_Y + 2 ||
        probeY > BOARD_Y + GRID_ROWS * TILE - 2;
      const pc = this.gridCoords(probeX, probeY);
      if (!outOfBounds && !this.isSolid(pc.c, pc.r)) {
        this.px = nx;
        this.py = ny;
      }
    }

    if (this.input.fireJustPressed || this.input.secondaryJustPressed) {
      this.performPushOrShake();
    }

    // Update Sliding Blocks & Multi-Squash Combos
    for (let i = this.sliders.length - 1; i >= 0; i--) {
      const s = this.sliders[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;

      // Crush Sno-Bees in path!
      for (const b of this.bees) {
        if (!b.alive) continue;
        if (Math.hypot(b.x - s.x, b.y - s.y) < TILE * 0.65) {
          b.alive = false;
          s.crushCount += 1;
          const comboTable = [400, 1600, 3200, 6400];
          const pts = comboTable[Math.min(comboTable.length - 1, s.crushCount - 1)];
          this.addScore(
            pts,
            b.x,
            b.y,
            s.crushCount > 1 ? `${s.crushCount}× CRUSH +${pts}!` : `+${pts}`,
            '#FDE047'
          );
          spawnBurst(this.particles, b.x, b.y, b.color, 18, 200, 4);
          arcadeAudio.playDigDugCrush(s.crushCount);
        }
      }

      const dirX = Math.sign(s.vx);
      const dirY = Math.sign(s.vy);
      const frontX = s.x + dirX * (TILE * 0.52);
      const frontY = s.y + dirY * (TILE * 0.52);
      const hitBorder =
        frontX < BOARD_X ||
        frontX > BOARD_X + GRID_COLS * TILE ||
        frontY < BOARD_Y ||
        frontY > BOARD_Y + GRID_ROWS * TILE;
      const fc = this.gridCoords(frontX, frontY);

      if (hitBorder || this.isSolid(fc.c, fc.r)) {
        const stopCell = this.gridCoords(s.x, s.y);
        this.grid[stopCell.r][stopCell.c] = s.kind;
        arcadeAudio.playRockThud();
        this.sliders.splice(i, 1);
        if (s.kind === 2) this.checkDiamondAlignment();
      }
    }

    // Update Sno-Bees
    const beeSpd = 68 + Math.min(48, (this.level - 1) * 9);
    let aliveCount = 0;
    for (const b of this.bees) {
      if (!b.alive) continue;
      aliveCount++;
      if (b.stunTimer > 0) {
        b.stunTimer = Math.max(0, b.stunTimer - dt);
        // Pengo can stomp stunned Sno-Bees!
        if (Math.hypot(b.x - this.px, b.y - this.py) < 22) {
          b.alive = false;
          aliveCount--;
          this.addScore(100, b.x, b.y, 'STOMP +100', '#38BDF8');
          spawnBurst(this.particles, b.x, b.y, '#38BDF8', 14, 150, 3.4);
          arcadeAudio.playStomp();
        }
        continue;
      }

      const nx = b.x + b.dirX * beeSpd * dt;
      const ny = b.y + b.dirY * beeSpd * dt;
      const probeX = nx + b.dirX * (TILE * 0.45);
      const probeY = ny + b.dirY * (TILE * 0.45);
      const out =
        probeX < BOARD_X + 2 ||
        probeX > BOARD_X + GRID_COLS * TILE - 2 ||
        probeY < BOARD_Y + 2 ||
        probeY > BOARD_Y + GRID_ROWS * TILE - 2;
      const pc = this.gridCoords(probeX, probeY);

      if (!out && !this.isSolid(pc.c, pc.r)) {
        b.x = nx;
        b.y = ny;
        // Occasionally steer toward Pengo at tile centers
        const cur = this.gridCoords(b.x, b.y);
        const ctr = this.tileCenter(cur.c, cur.r);
        if (Math.hypot(b.x - ctr.x, b.y - ctr.y) < 3 && Math.random() < 0.08) {
          const wantX = Math.sign(this.px - b.x);
          const wantY = Math.sign(this.py - b.y);
          if (Math.random() < 0.5 && wantX !== 0 && !this.isSolid(cur.c + wantX, cur.r)) {
            b.dirX = wantX;
            b.dirY = 0;
          } else if (wantY !== 0 && !this.isSolid(cur.c, cur.r + wantY)) {
            b.dirX = 0;
            b.dirY = wantY;
          }
        }
      } else {
        // Sno-Bee can occasionally dig through normal ice blocks!
        if (!out && this.grid[pc.r][pc.c] === 1 && Math.random() < 0.25) {
          b.digTimer += dt * 12;
          if (b.digTimer > 0.35) {
            this.grid[pc.r][pc.c] = 0;
            b.digTimer = 0;
            const cPos = this.tileCenter(pc.c, pc.r);
            spawnBurst(this.particles, cPos.x, cPos.y, '#BAE6FD', 8, 90, 2.5);
          }
        } else {
          // Pick open perpendicular or reverse direction
          const cur = this.gridCoords(b.x, b.y);
          const dirs = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ].filter(([dx, dy]) => !this.isSolid(cur.c + dx, cur.r + dy));
          if (dirs.length > 0) {
            const pick = dirs[Math.floor(Math.random() * dirs.length)];
            b.dirX = pick[0];
            b.dirY = pick[1];
          } else {
            b.dirX = -b.dirX;
            b.dirY = -b.dirY;
          }
        }
      }

      // Collision with Pengo
      if (this.invuln <= 0 && Math.hypot(b.x - this.px, b.y - this.py) < 20) {
        this.lives -= 1;
        arcadeAudio.playDeath();
        spawnBurst(this.particles, this.px, this.py, '#EF4444', 20, 180, 4);
        if (this.lives <= 0) {
          this.phase = 'GAME_OVER';
        } else {
          const sp = this.tileCenter(6, 7);
          this.px = sp.x;
          this.py = sp.y;
          this.invuln = 2.0;
        }
        return;
      }
    }

    // Keep Sno-Bee pressure up by hatching eggs when active count drops
    if (aliveCount < 3 && this.eggsRemaining > 0) {
      this.hatchNextEgg();
      aliveCount++;
    }

    // Act Clear when all Sno-Bees & eggs eliminated!
    if (aliveCount === 0 && this.eggsRemaining === 0) {
      this.addScore(1500, LOGICAL_W * 0.5, LOGICAL_H * 0.45, 'ACT CLEAR +1500!', '#4ADE80');
      arcadeAudio.playStageClear();
      this.phase = 'STAGE_CLEAR';
      this.clearTimer = 1.7;
    }
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    const pal = ACT_PALETTES[(this.level - 1) % ACT_PALETTES.length];
    ctx.save();
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // Top HUD
    ctx.font = '800 13px "JetBrains Mono", monospace';
    ctx.fillStyle = pal.wall;
    ctx.textAlign = 'left';
    ctx.fillText(`PENGO · ${pal.name}`, 18, 26);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#FDE047';
    ctx.fillText(`SCORE ${this.score.toLocaleString()}`, LOGICAL_W - 18, 26);
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#94A3B8';
    ctx.textAlign = 'left';
    ctx.fillText(`EGGS ${this.eggsRemaining}`, 18, 44);
    ctx.textAlign = 'right';
    ctx.fillStyle = this.diamondsAligned ? '#4ADE80' : '#FACC15';
    ctx.fillText(
      this.diamondsAligned ? 'DIAMONDS ALIGNED!' : 'ALIGN 3 DIAMONDS = 10,000',
      LOGICAL_W - 18,
      44
    );

    // Outer Electrified Arena Frame
    const bw = GRID_COLS * TILE;
    const bh = GRID_ROWS * TILE;
    const shakeOff = this.wallShakeTimer > 0 ? Math.sin(this.time * 65) * 3.5 : 0;
    ctx.save();
    ctx.lineWidth = 8;
    ctx.strokeStyle = this.wallShakeTimer > 0 ? '#FDE047' : pal.wall;
    ctx.strokeRect(
      BOARD_X - 4 + (this.wallShakeSide === 'left' || this.wallShakeSide === 'right' ? shakeOff : 0),
      BOARD_Y - 4 + (this.wallShakeSide === 'top' || this.wallShakeSide === 'bottom' ? shakeOff : 0),
      bw + 8,
      bh + 8
    );
    ctx.restore();

    // Draw Ice, Diamond & Flashing Egg Blocks
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const t = this.grid[r][c];
        if (t === 0) continue;
        const x = BOARD_X + c * TILE;
        const y = BOARD_Y + r * TILE;
        if (t === 2) {
          // Glowing Diamond Block
          const dg = ctx.createLinearGradient(x, y, x + TILE, y + TILE);
          dg.addColorStop(0, '#FEF08A');
          dg.addColorStop(0.5, '#F59E0B');
          dg.addColorStop(1, '#FDE047');
          ctx.fillStyle = dg;
          ctx.beginPath();
          ctx.roundRect(x + 2, y + 2, TILE - 4, TILE - 4, 5);
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.stroke();
          // Faceted diamond icon
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.moveTo(x + TILE * 0.5, y + 6);
          ctx.lineTo(x + TILE - 7, y + TILE * 0.5);
          ctx.lineTo(x + TILE * 0.5, y + TILE - 6);
          ctx.lineTo(x + 7, y + TILE * 0.5);
          ctx.closePath();
          ctx.fill();
        } else {
          const isEggFlash =
            t === 3 && this.eggFlashTimer > 0 && Math.floor(this.time * 9) % 2 === 0;
          const ig = ctx.createLinearGradient(x, y, x, y + TILE);
          ig.addColorStop(0, isEggFlash ? '#F472B6' : pal.ice);
          ig.addColorStop(1, isEggFlash ? '#BE185D' : pal.iceDark);
          ctx.fillStyle = ig;
          ctx.beginPath();
          ctx.roundRect(x + 1.5, y + 1.5, TILE - 3, TILE - 3, 4);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.28)';
          ctx.fillRect(x + 4, y + 4, TILE - 10, 4);
        }
      }
    }

    // Draw Sliding Blocks
    for (const s of this.sliders) {
      const x = s.x - TILE * 0.5;
      const y = s.y - TILE * 0.5;
      ctx.fillStyle = s.kind === 2 ? '#FACC15' : '#E0F2FE';
      ctx.beginPath();
      ctx.roundRect(x + 1, y + 1, TILE - 2, TILE - 2, 5);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw Sno-Bees
    for (const b of this.bees) {
      if (!b.alive) continue;
      ctx.save();
      ctx.translate(b.x, b.y);
      const wobble = b.stunTimer > 0 ? Math.sin(this.time * 32) * 3 : Math.sin(this.time * 10) * 1.5;
      ctx.fillStyle = b.stunTimer > 0 ? '#38BDF8' : b.color;
      ctx.beginPath();
      ctx.arc(wobble, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      // Antennae & eyes
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-4, -10);
      ctx.lineTo(-8, -16);
      ctx.moveTo(4, -10);
      ctx.lineTo(8, -16);
      ctx.stroke();
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(-4 + wobble, -2, 2.3, 0, Math.PI * 2);
      ctx.arc(4 + wobble, -2, 2.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw Pengo Penguin Hero
    if (this.invuln <= 0 || Math.floor(this.time * 14) % 2 === 0) {
      ctx.save();
      ctx.translate(this.px, this.py);
      const lunge = this.pushAnim > 0 ? 4 : 0;
      ctx.translate(this.faceX * lunge, this.faceY * lunge);
      // Red arctic coat body
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.ellipse(0, 1, 12, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      // White belly
      ctx.fillStyle = '#F8FAFC';
      ctx.beginPath();
      ctx.ellipse(0, 3, 7, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      // Beak
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.moveTo(this.faceX * 8, this.faceY * 8 - 3);
      ctx.lineTo(this.faceX * 14 + 3, this.faceY * 14);
      ctx.lineTo(this.faceX * 8, this.faceY * 8 + 3);
      ctx.closePath();
      ctx.fill();
      // Eyes
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(-4, -5, 2.1, 0, Math.PI * 2);
      ctx.arc(4, -5, 2.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    renderParticlesAndPopups(ctx, this.particles, this.popups);
    if (visualMode === 'crt') renderCrtOverlay(ctx, LOGICAL_W, LOGICAL_H);
    ctx.restore();
  }

  public getHudSnapshot(): ClassicGameHud {
    const aliveBees = this.bees.filter((b) => b.alive).length;
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: Math.max(0, this.lives),
      stageName: `PENGO · ACT ${this.level}`,
      primaryMetricLabel: 'SNO-BEES',
      primaryMetricValue: `${aliveBees} (+${this.eggsRemaining} EGGS)`,
      secondaryMetricLabel: 'DIAMONDS',
      secondaryMetricValue: this.diamondsAligned ? 'ALIGNED!' : '3 ACTIVE',
      bannerText:
        this.phase === 'TITLE'
          ? 'PENGO — SLIDE ICE & ALIGN 3 DIAMONDS'
          : this.phase === 'GAME_OVER'
          ? 'GAME OVER'
          : '',
      canRestartStage: true,
    };
  }
}

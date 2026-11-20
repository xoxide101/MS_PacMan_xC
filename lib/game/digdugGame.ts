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

const COLS = 15;
const ROWS = 17; // Rows 0..1 sky surface, 2..16 underground soil
const TILE = 48;
const WIDTH = COLS * TILE; // 720
const HEIGHT = ROWS * TILE; // 816
const STORAGE_KEY = 'digdug_hd_highscore_v1';

type Dir = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

const VEC: Record<Dir, { x: number; y: number }> = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};

interface Monster {
  id: number;
  kind: 'pooka' | 'fygar';
  x: number; // grid coords (center at +0.5)
  y: number;
  dir: Dir;
  ghostMode: boolean;
  ghostTimer: number;
  inflate: number; // 0..4 (4 pops!)
  deflateTimer: number;
  flameTimer: number;
  flameCooldown: number;
  fleeing: boolean;
  crushedByRockId: number | null;
  anim: number;
}

interface Rock {
  id: number;
  x: number;
  y: number;
  state: 'idle' | 'wobble' | 'falling' | 'shatter';
  timer: number;
  crushedCount: number;
}

interface PumpLine {
  active: boolean;
  dir: Dir;
  length: number; // in tiles 0..2.7
  hookedMonsterId: number | null;
  retracting: boolean;
}

interface BonusVeggie {
  active: boolean;
  x: number;
  y: number;
  timer: number;
  points: number;
  label: string;
  color: string;
}

const VEGGIES: Array<{ label: string; points: number; color: string }> = [
  { label: 'Carrot', points: 400, color: '#F97316' },
  { label: 'Turnip', points: 600, color: '#E2E8F0' },
  { label: 'Mushroom', points: 800, color: '#EF4444' },
  { label: 'Cucumber', points: 1000, color: '#22C55E' },
  { label: 'Eggplant', points: 2000, color: '#A855F7' },
  { label: 'Watermelon', points: 4000, color: '#10B981' },
  { label: 'Pineapple', points: 8000, color: '#FACC15' },
];

export class DigDugGame implements ArcadeGameInstance {
  public readonly logicalWidth = WIDTH;
  public readonly logicalHeight = HEIGHT;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'Pump';

  private phase: ClassicGamePhase = 'TITLE';
  private score = 0;
  private highScore = readHighScore(STORAGE_KEY);
  private nextExtraLife = 10000;
  private level = 1;
  private lives = 3;
  private phaseTimer = 0;
  private time = 0;
  private bannerText = '';

  private input: ArcadeInputState = createEmptyInput();
  // true = dirt still intact, false = dug tunnel
  private dirt: boolean[][] = [];
  private playerX = 7.5;
  private playerY = 8.5;
  private playerDir: Dir = 'RIGHT';
  private playerAnim = 0;
  private digSoundTimer = 0;

  private pump: PumpLine = { active: false, dir: 'RIGHT', length: 0, hookedMonsterId: null, retracting: false };
  private monsters: Monster[] = [];
  private rocks: Rock[] = [];
  private rocksDroppedThisRound = 0;
  private bonus: BonusVeggie = { active: false, x: 7.5, y: 8.5, timer: 0, points: 400, label: 'Carrot', color: '#F97316' };
  private nextId = 1;

  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  constructor() {
    this.setupStage(1);
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public startNewGame(): void {
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.nextExtraLife = 10000;
    this.level = 1;
    this.lives = 3;
    this.particles = [];
    this.popups = [];
    this.setupStage(1);
    this.phase = 'READY';
    this.phaseTimer = 1.1;
    this.bannerText = 'ROUND 1';
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.level = 1;
    this.setupStage(1);
  }

  public getHudSnapshot(): ClassicGameHud {
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: `Round ${this.level}`,
      primaryMetricLabel: 'Monsters',
      primaryMetricValue: String(this.monsters.length),
      secondaryMetricLabel: 'Rocks Left',
      secondaryMetricValue: String(this.rocks.filter((r) => r.state !== 'shatter').length),
      bannerText: this.bannerText,
    };
  }

  private addScore(pts: number, gx?: number, gy?: number, color = '#FDE047'): void {
    if (this.phase === 'TITLE') return;
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(STORAGE_KEY, this.highScore);
    }
    if (this.score >= this.nextExtraLife) {
      this.lives = Math.min(6, this.lives + 1);
      this.nextExtraLife += 20000;
      arcadeAudio.playExtraLife();
      this.popups.push({ x: this.playerX * TILE, y: this.playerY * TILE - 24, text: '1UP!', color: '#4ADE80', life: 1.3, maxLife: 1.3 });
    }
    if (gx !== undefined && gy !== undefined && pts >= 50) {
      this.popups.push({ x: gx * TILE, y: gy * TILE - 12, text: `${pts}`, color, life: 1.0, maxLife: 1.0 });
    }
  }

  private setupStage(round: number): void {
    this.dirt = Array.from({ length: ROWS }, (_, r) =>
      Array.from({ length: COLS }, () => r >= 2)
    );
    // Vertical entry shaft & center chamber
    for (let r = 2; r <= 8; r++) this.dirt[r][7] = false;
    this.dirt[8][6] = false;
    this.dirt[8][7] = false;
    this.dirt[8][8] = false;

    this.playerX = 7.5;
    this.playerY = 8.5;
    this.playerDir = 'RIGHT';
    this.pump = { active: false, dir: 'RIGHT', length: 0, hookedMonsterId: null, retracting: false };
    this.rocksDroppedThisRound = 0;
    this.bonus.active = false;

    // Carve monster chambers & place Pookas & Fygars
    this.monsters = [];
    const chambers: Array<{ x1: number; y1: number; x2: number; y2: number; kind: 'pooka' | 'fygar' }> = [
      { x1: 2, y1: 5, x2: 4, y2: 5, kind: 'pooka' },
      { x1: 11, y1: 4, x2: 11, y2: 7, kind: 'pooka' },
      { x1: 2, y1: 12, x2: 5, y2: 12, kind: 'fygar' },
      { x1: 10, y1: 13, x2: 13, y2: 13, kind: 'fygar' },
    ];
    if (round >= 2) chambers.push({ x1: 6, y1: 15, x2: 9, y2: 15, kind: 'pooka' });
    if (round >= 3) chambers.push({ x1: 1, y1: 8, x2: 3, y2: 8, kind: 'fygar' });

    for (const ch of chambers) {
      for (let r = ch.y1; r <= ch.y2; r++) {
        for (let c = ch.x1; c <= ch.x2; c++) {
          this.dirt[r][c] = false;
        }
      }
      this.monsters.push({
        id: this.nextId++,
        kind: ch.kind,
        x: (ch.x1 + ch.x2) * 0.5 + 0.5,
        y: (ch.y1 + ch.y2) * 0.5 + 0.5,
        dir: ch.x1 === ch.x2 ? 'DOWN' : 'RIGHT',
        ghostMode: false,
        ghostTimer: 5 + Math.random() * 5,
        inflate: 0,
        deflateTimer: 0,
        flameTimer: 0,
        flameCooldown: 2 + Math.random() * 2.5,
        fleeing: false,
        crushedByRockId: null,
        anim: Math.random() * 5,
      });
    }

    // Place 3–4 falling rocks above monster caves
    const rockCoords: Array<[number, number]> = [
      [3, 3],
      [11, 2],
      [4, 9],
      [11, 10],
    ];
    this.rocks = rockCoords.slice(0, round >= 2 ? 4 : 3).map(([c, r]) => ({
      id: this.nextId++,
      x: c + 0.5,
      y: r + 0.5,
      state: 'idle',
      timer: 0,
      crushedCount: 0,
    }));
  }

  private getDepthLayer(row: number): number {
    if (row < 6) return 0;
    if (row < 10) return 1;
    if (row < 14) return 2;
    return 3;
  }

  public step(dt: number): void {
    this.time += dt;
    stepParticlesAndPopups(this.particles, this.popups, dt);

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
        this.setupStage(this.level);
        this.phase = 'READY';
        this.phaseTimer = 1.05;
        this.bannerText = `ROUND ${this.level}`;
      }
      return;
    }

    const isAttract = this.phase === 'TITLE';
    this.updatePlayer(dt, isAttract);
    this.updatePump(dt, isAttract);
    this.updateRocks(dt, isAttract);
    this.updateMonsters(dt, isAttract);

    if (this.bonus.active) {
      this.bonus.timer -= dt;
      if (this.bonus.timer <= 0) this.bonus.active = false;
      else if (Math.hypot(this.playerX - this.bonus.x, this.playerY - this.bonus.y) < 0.72) {
        this.bonus.active = false;
        if (!isAttract) arcadeAudio.playEatFruit();
        this.addScore(this.bonus.points, this.bonus.x, this.bonus.y, this.bonus.color);
      }
    }

    if (this.monsters.length === 0) {
      if (isAttract) {
        this.setupStage(1);
      } else {
        arcadeAudio.playStageClear();
        this.phase = 'STAGE_CLEAR';
        this.phaseTimer = 1.3;
        this.bannerText = `ROUND ${this.level} CLEAR!`;
      }
    }
  }

  private isRockBlocking(col: number, row: number): boolean {
    return this.rocks.some(
      (rk) => rk.state !== 'shatter' && Math.floor(rk.x) === col && Math.floor(rk.y) === row
    );
  }

  private updatePlayer(dt: number, isAttract: boolean): void {
    if (this.digSoundTimer > 0) this.digSoundTimer -= dt;

    // Trigger pump action
    if (!isAttract && this.input.fireJustPressed) {
      if (this.pump.active && this.pump.hookedMonsterId !== null) {
        const m = this.monsters.find((x) => x.id === this.pump.hookedMonsterId);
        if (m) {
          m.inflate += 1;
          m.deflateTimer = 1.35;
          arcadeAudio.playPump(m.inflate);
          if (m.inflate >= 4) {
            this.popMonster(m);
          }
        }
      } else if (!this.pump.active) {
        this.pump = {
          active: true,
          dir: this.playerDir,
          length: 0.25,
          hookedMonsterId: null,
          retracting: false,
        };
        arcadeAudio.playPump(1);
      }
    }

    let wantDir: Dir | null = null;
    if (isAttract) {
      const target = this.monsters[0];
      if (target) {
        const dx = target.x - this.playerX;
        const dy = target.y - this.playerY;
        const dist = Math.hypot(dx, dy);
        if (dist < 2.1 && !this.pump.active && Math.random() < 0.08) {
          this.playerDir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'RIGHT' : 'LEFT') : dy > 0 ? 'DOWN' : 'UP';
          this.pump = { active: true, dir: this.playerDir, length: 0.3, hookedMonsterId: null, retracting: false };
        } else if (this.pump.hookedMonsterId !== null) {
          if (Math.random() < 0.09) {
            const m = this.monsters.find((x) => x.id === this.pump.hookedMonsterId);
            if (m) {
              m.inflate += 1;
              m.deflateTimer = 1.3;
              if (m.inflate >= 4) this.popMonster(m);
            }
          }
        } else {
          wantDir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'RIGHT' : 'LEFT') : dy > 0 ? 'DOWN' : 'UP';
        }
      }
    } else {
      if (this.input.left) wantDir = 'LEFT';
      else if (this.input.right) wantDir = 'RIGHT';
      else if (this.input.up) wantDir = 'UP';
      else if (this.input.down) wantDir = 'DOWN';
    }

    if (!wantDir) return;

    // Moving detaches the pump line
    if (this.pump.active) {
      this.pump.active = false;
      this.pump.hookedMonsterId = null;
    }

    this.playerDir = wantDir;
    this.playerAnim += dt * 14;
    const v = VEC[wantDir];
    const col = Math.floor(this.playerX);
    const row = Math.floor(this.playerY);
    const cx = col + 0.5;
    const cy = row + 0.5;

    // Smooth corridor centering along perpendicular axis
    if (v.x !== 0) this.playerY += (cy - this.playerY) * Math.min(1, dt * 16);
    else this.playerX += (cx - this.playerX) * Math.min(1, dt * 16);

    const aheadCol = Math.max(0, Math.min(COLS - 1, Math.floor(this.playerX + v.x * 0.48)));
    const aheadRow = Math.max(2, Math.min(ROWS - 1, Math.floor(this.playerY + v.y * 0.48)));

    if (this.isRockBlocking(aheadCol, aheadRow)) return;

    const digging = this.dirt[aheadRow]?.[aheadCol] ?? false;
    const speed = digging ? 3.2 : 4.4;
    const nx = Math.max(0.5, Math.min(COLS - 0.5, this.playerX + v.x * speed * dt));
    const ny = Math.max(2.5, Math.min(ROWS - 0.5, this.playerY + v.y * speed * dt));

    this.playerX = nx;
    this.playerY = ny;

    const nowC = Math.floor(this.playerX);
    const nowR = Math.floor(this.playerY);
    if (this.dirt[nowR]?.[nowC]) {
      this.dirt[nowR][nowC] = false;
      this.addScore(10);
      if (!isAttract && this.digSoundTimer <= 0) {
        arcadeAudio.playDigStep();
        this.digSoundTimer = 0.14;
      }
    }
  }

  private popMonster(m: Monster): void {
    const idx = this.monsters.findIndex((x) => x.id === m.id);
    if (idx === -1) return;
    const layer = this.getDepthLayer(Math.floor(m.y));
    const basePts = [200, 300, 400, 500][layer];
    const sideBonus = m.kind === 'fygar' && (this.pump.dir === 'LEFT' || this.pump.dir === 'RIGHT') ? 2 : 1;
    const pts = basePts * sideBonus;

    this.monsters.splice(idx, 1);
    this.pump.active = false;
    this.pump.hookedMonsterId = null;

    if (this.phase !== 'TITLE') arcadeAudio.playPop();
    spawnBurst(this.particles, m.x * TILE, m.y * TILE, m.kind === 'fygar' ? '#4ADE80' : '#EF4444', 22, 230, 4);
    this.addScore(pts, m.x, m.y, sideBonus === 2 ? '#38BDF8' : '#FDE047');

    if (this.monsters.length === 1) {
      this.monsters[0].fleeing = true;
    }
  }

  private updatePump(dt: number, isAttract: boolean): void {
    if (!this.pump.active) return;

    if (this.pump.hookedMonsterId !== null) {
      const m = this.monsters.find((x) => x.id === this.pump.hookedMonsterId);
      if (!m) {
        this.pump.active = false;
        this.pump.hookedMonsterId = null;
      }
      return;
    }

    const v = VEC[this.pump.dir];
    if (!this.pump.retracting) {
      this.pump.length += 11.5 * dt;
      const tipX = this.playerX + v.x * this.pump.length;
      const tipY = this.playerY + v.y * this.pump.length;

      // Check monster hit
      for (const m of this.monsters) {
        if (m.crushedByRockId !== null) continue;
        if (Math.hypot(tipX - m.x, tipY - m.y) < 0.56) {
          this.pump.hookedMonsterId = m.id;
          m.ghostMode = false;
          m.flameTimer = 0;
          m.inflate = Math.min(3, m.inflate + 1);
          m.deflateTimer = 1.4;
          if (!isAttract) arcadeAudio.playPump(m.inflate);
          return;
        }
      }

      const tc = Math.floor(tipX);
      const tr = Math.floor(tipY);
      const out = tc < 0 || tc >= COLS || tr < 2 || tr >= ROWS;
      const hitWall = out || this.dirt[tr]?.[tc] || this.isRockBlocking(tc, tr);
      if (this.pump.length >= 2.65 || (hitWall && this.pump.length > 0.65)) {
        this.pump.retracting = true;
      }
    } else {
      this.pump.length -= 13 * dt;
      if (this.pump.length <= 0.1) {
        this.pump.active = false;
      }
    }
  }

  private updateRocks(dt: number, isAttract: boolean): void {
    for (let i = this.rocks.length - 1; i >= 0; i--) {
      const rk = this.rocks[i];
      const col = Math.floor(rk.x);
      const row = Math.floor(rk.y);

      if (rk.state === 'idle') {
        const belowRow = row + 1;
        if (belowRow < ROWS && !this.dirt[belowRow][col]) {
          rk.state = 'wobble';
          rk.timer = 0.65;
        }
      } else if (rk.state === 'wobble') {
        rk.timer -= dt;
        if (rk.timer <= 0) {
          rk.state = 'falling';
          rk.crushedCount = 0;
        }
      } else if (rk.state === 'falling') {
        rk.y += 7.2 * dt;
        const curRow = Math.floor(rk.y);
        if (curRow >= 2 && curRow < ROWS) this.dirt[curRow][col] = false;

        // Crush monsters in path
        for (const m of this.monsters) {
          if (m.crushedByRockId === null && Math.hypot(m.x - rk.x, m.y - rk.y) < 0.68) {
            m.crushedByRockId = rk.id;
            rk.crushedCount += 1;
          }
          if (m.crushedByRockId === rk.id) {
            m.x = rk.x;
            m.y = rk.y + 0.25;
          }
        }

        // Crush Dig Dug if directly underneath
        if (!isAttract && Math.hypot(this.playerX - rk.x, this.playerY - rk.y) < 0.56) {
          this.handlePlayerHit();
          return;
        }

        const nextRow = Math.floor(rk.y + 0.52);
        if (nextRow >= ROWS || this.dirt[nextRow]?.[col]) {
          rk.y = Math.floor(rk.y) + 0.5;
          rk.state = 'shatter';
          rk.timer = 0.5;
          if (!isAttract) arcadeAudio.playRockThud();
          spawnBurst(this.particles, rk.x * TILE, rk.y * TILE, '#94A3B8', 18, 170, 3.8);

          // Award big rock-crush points!
          if (rk.crushedCount > 0) {
            const crushTable = [0, 1000, 2500, 4000, 6000, 8000];
            const pts = crushTable[Math.min(crushTable.length - 1, rk.crushedCount)];
            this.monsters = this.monsters.filter((m) => m.crushedByRockId !== rk.id);
            this.addScore(pts, rk.x, rk.y, '#38BDF8');
            if (this.monsters.length === 1) this.monsters[0].fleeing = true;
          }

          this.rocksDroppedThisRound += 1;
          if (this.rocksDroppedThisRound === 2) {
            const veg = VEGGIES[(this.level - 1) % VEGGIES.length];
            this.bonus = {
              active: true,
              x: 7.5,
              y: 8.5,
              timer: 10,
              points: veg.points,
              label: veg.label,
              color: veg.color,
            };
          }
        }
      } else if (rk.state === 'shatter') {
        rk.timer -= dt;
        if (rk.timer <= 0) this.rocks.splice(i, 1);
      }
    }
  }

  private updateMonsters(dt: number, isAttract: boolean): void {
    const speed = Math.min(3.8, 2.35 + (this.level - 1) * 0.22);

    for (let i = this.monsters.length - 1; i >= 0; i--) {
      const m = this.monsters[i];
      if (m.crushedByRockId !== null) continue;
      m.anim += dt * 10;

      // Handle inflation & deflation
      if (m.inflate > 0) {
        m.deflateTimer -= dt;
        if (m.deflateTimer <= 0) {
          m.inflate = Math.max(0, m.inflate - 1);
          m.deflateTimer = 0.85;
          if (m.inflate === 0 && this.pump.hookedMonsterId === m.id) {
            this.pump.hookedMonsterId = null;
            this.pump.active = false;
          }
        }
        continue;
      }

      // Fygar fire breath
      if (m.kind === 'fygar' && !m.ghostMode) {
        if (m.flameTimer > 0) {
          m.flameTimer -= dt;
          const fDir = m.dir === 'LEFT' ? -1 : 1;
          const flameLen = 2.4;
          const dx = (this.playerX - m.x) * fDir;
          const dy = Math.abs(this.playerY - m.y);
          if (!isAttract && dx > 0.2 && dx < flameLen && dy < 0.5) {
            this.handlePlayerHit();
            return;
          }
          continue;
        } else {
          m.flameCooldown -= dt;
          if (
            m.flameCooldown <= 0 &&
            Math.abs(this.playerY - m.y) < 0.65 &&
            Math.abs(this.playerX - m.x) < 3.4
          ) {
            m.dir = this.playerX > m.x ? 'RIGHT' : 'LEFT';
            m.flameTimer = 0.72;
            m.flameCooldown = 3.2;
            if (!isAttract) arcadeAudio.playFlame();
            continue;
          }
        }
      }

      // Ghost phasing timer
      m.ghostTimer -= dt;
      if (!m.ghostMode && m.ghostTimer <= 0) {
        m.ghostMode = true;
        m.ghostTimer = 3.2;
      }

      const targetX = m.fleeing ? 0.5 : this.playerX;
      const targetY = m.fleeing ? 2.5 : this.playerY;

      if (m.ghostMode) {
        const dx = targetX - m.x;
        const dy = targetY - m.y;
        const dist = Math.hypot(dx, dy) || 1;
        m.x += (dx / dist) * speed * 0.74 * dt;
        m.y += (dy / dist) * speed * 0.74 * dt;
        m.x = Math.max(0.5, Math.min(COLS - 0.5, m.x));
        m.y = Math.max(2.5, Math.min(ROWS - 0.5, m.y));
        const c = Math.floor(m.x);
        const r = Math.floor(m.y);
        if (!this.dirt[r]?.[c] && m.ghostTimer < 2.2) {
          m.ghostMode = false;
          m.ghostTimer = 5.5 + Math.random() * 4;
        }
      } else {
        const col = Math.floor(m.x);
        const row = Math.floor(m.y);
        const cx = col + 0.5;
        const cy = row + 0.5;

        // Choose best tunnel direction near tile center
        if (Math.hypot(m.x - cx, m.y - cy) < 0.14) {
          const dirs: Dir[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
          const open = dirs.filter((d) => {
            const nc = col + VEC[d].x;
            const nr = row + VEC[d].y;
            return nc >= 0 && nc < COLS && nr >= 2 && nr < ROWS && !this.dirt[nr][nc] && !this.isRockBlocking(nc, nr);
          });
          if (open.length > 0) {
            let best = open[0];
            let bestDist = Infinity;
            for (const d of open) {
              const dist = Math.hypot(col + VEC[d].x + 0.5 - targetX, row + VEC[d].y + 0.5 - targetY);
              if (dist < bestDist) {
                bestDist = dist;
                best = d;
              }
            }
            m.dir = best;
          } else {
            m.ghostMode = true;
            m.ghostTimer = 2.6;
          }
        }

        const v = VEC[m.dir];
        const nextC = Math.floor(m.x + v.x * 0.45);
        const nextR = Math.floor(m.y + v.y * 0.45);
        if (
          nextC >= 0 &&
          nextC < COLS &&
          nextR >= 2 &&
          nextR < ROWS &&
          !this.dirt[nextR][nextC] &&
          !this.isRockBlocking(nextC, nextR)
        ) {
          m.x += v.x * speed * dt;
          m.y += v.y * speed * dt;
          if (v.x !== 0) m.y += (cy - m.y) * Math.min(1, dt * 12);
          else m.x += (cx - m.x) * Math.min(1, dt * 12);
        } else {
          // Turn around if blocked
          const opp: Record<Dir, Dir> = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };
          m.dir = opp[m.dir];
        }
      }

      // Fleeing monster escapes off top-left surface!
      if (m.fleeing && m.y <= 2.7 && m.x <= 0.9) {
        this.monsters.splice(i, 1);
        continue;
      }

      if (!isAttract && Math.hypot(m.x - this.playerX, m.y - this.playerY) < 0.62) {
        this.handlePlayerHit();
        return;
      }
    }
  }

  private handlePlayerHit(): void {
    arcadeAudio.playDeath();
    spawnBurst(this.particles, this.playerX * TILE, this.playerY * TILE, '#38BDF8', 24, 230, 4);
    this.lives -= 1;
    this.pump.active = false;
    this.pump.hookedMonsterId = null;
    if (this.lives <= 0) {
      this.phase = 'GAME_OVER';
      this.bannerText = 'GAME OVER';
      return;
    }
    this.playerX = 7.5;
    this.playerY = 8.5;
    for (const m of this.monsters) {
      m.inflate = 0;
      m.flameTimer = 0;
      if (Math.hypot(m.x - 7.5, m.y - 8.5) < 3.5) {
        m.x = m.x < 7.5 ? 2.5 : 12.5;
      }
    }
    this.phase = 'READY';
    this.phaseTimer = 1.25;
    this.bannerText = 'READY!';
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Sky surface (rows 0..1)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, TILE * 2);
    skyGrad.addColorStop(0, '#0284C7');
    skyGrad.addColorStop(1, '#38BDF8');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, WIDTH, TILE * 2);

    // Grass rim
    ctx.fillStyle = '#22C55E';
    ctx.fillRect(0, TILE * 2 - 7, WIDTH, 9);

    // Deep underground tunnel cavity background
    ctx.fillStyle = '#0A0706';
    ctx.fillRect(0, TILE * 2, WIDTH, HEIGHT - TILE * 2);

    // Stratified earthy soil layers (authentic 4-band Namco warmth)
    const layerColors = ['#D97706', '#B45309', '#9A3412', '#7C2D12'];
    const layerHighlights = ['#F59E0B', '#D97706', '#C2410C', '#9A3412'];

    for (let r = 2; r < ROWS; r++) {
      const layer = this.getDepthLayer(r);
      for (let c = 0; c < COLS; c++) {
        if (!this.dirt[r][c]) continue;
        const x = c * TILE;
        const y = r * TILE;
        ctx.fillStyle = layerColors[layer];
        ctx.fillRect(x, y, TILE + 0.5, TILE + 0.5);

        // Subtle mineral pebble texture
        ctx.fillStyle = layerHighlights[layer];
        if ((r + c) % 2 === 0) {
          ctx.fillRect(x + 8, y + 10, 6, 4);
          ctx.fillRect(x + 28, y + 30, 8, 4);
        } else {
          ctx.fillRect(x + 24, y + 12, 7, 4);
          ctx.fillRect(x + 10, y + 32, 6, 4);
        }
      }
    }

    // Bonus Veggie
    if (this.bonus.active) {
      this.drawBonusVeggie(ctx, this.bonus);
    }

    // Rocks
    for (const rk of this.rocks) {
      this.drawRock(ctx, rk);
    }

    // Pump Harpoon Line
    if (this.pump.active) {
      const v = VEC[this.pump.dir];
      const sx = this.playerX * TILE;
      const sy = this.playerY * TILE;
      const ex = sx + v.x * this.pump.length * TILE;
      const ey = sy + v.y * this.pump.length * TILE;
      ctx.save();
      ctx.strokeStyle = '#F8FAFC';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(ex, ey, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Monsters
    for (const m of this.monsters) {
      this.drawMonster(ctx, m);
    }

    // Dig Dug Hero
    if (this.phase !== 'GAME_OVER') {
      this.drawDigDug(ctx, this.playerX * TILE, this.playerY * TILE);
    }

    renderParticlesAndPopups(ctx, this.particles, this.popups);

    if (this.bannerText && (this.phase === 'READY' || this.phase === 'STAGE_CLEAR')) {
      ctx.save();
      ctx.font = '800 30px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(4, 6, 13, 0.8)';
      ctx.fillRect(WIDTH * 0.24, HEIGHT * 0.44, WIDTH * 0.52, 56);
      ctx.fillStyle = '#38BDF8';
      ctx.fillText(this.bannerText, WIDTH * 0.5, HEIGHT * 0.44 + 28);
      ctx.restore();
    }

    if (visualMode === 'crt') renderCrtOverlay(ctx, WIDTH, HEIGHT);
  }

  private drawDigDug(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.translate(x, y);
    if (this.playerDir === 'LEFT') ctx.scale(-1, 1);

    // White-and-blue iconic suit
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.roundRect(-14, -14, 28, 28, 10);
    ctx.fill();

    // Blue helmet trim & visor
    ctx.fillStyle = '#0284C7';
    ctx.beginPath();
    ctx.arc(0, -5, 13, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#FDBA74';
    ctx.fillRect(1, -9, 10, 8);
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(6, -7, 3, 4);

    // Red air pump backpack & feet
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(-16, -6, 6, 14);
    const step = Math.sin(this.playerAnim) * 3;
    ctx.fillStyle = '#2563EB';
    ctx.fillRect(-9, 12 + step * 0.5, 7, 5);
    ctx.fillRect(2, 12 - step * 0.5, 7, 5);
    ctx.restore();
  }

  private drawMonster(ctx: CanvasRenderingContext2D, m: Monster): void {
    const x = m.x * TILE;
    const y = m.y * TILE;
    const scale = 1 + m.inflate * 0.28;

    ctx.save();
    ctx.translate(x, y);

    if (m.ghostMode) {
      // Translucent drifting eyes through dirt
      ctx.globalAlpha = 0.65;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-6, -2, 6, 0, Math.PI * 2);
      ctx.arc(6, -2, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(-5, -2, 2.8, 0, Math.PI * 2);
      ctx.arc(7, -2, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    // Fygar Flame Jet
    if (m.kind === 'fygar' && m.flameTimer > 0) {
      const fDir = m.dir === 'LEFT' ? -1 : 1;
      const grad = ctx.createLinearGradient(0, 0, fDir * TILE * 2.4, 0);
      grad.addColorStop(0, '#FEF08A');
      grad.addColorStop(0.5, '#F97316');
      grad.addColorStop(1, 'rgba(239, 68, 68, 0.15)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(fDir * 14, -8);
      ctx.lineTo(fDir * TILE * 2.4, -18 + Math.sin(this.time * 40) * 4);
      ctx.lineTo(fDir * TILE * 2.4, 18 + Math.cos(this.time * 40) * 4);
      ctx.lineTo(fDir * 14, 8);
      ctx.closePath();
      ctx.fill();
    }

    ctx.scale(scale, scale);

    if (m.kind === 'pooka') {
      // Iconic red round Pooka with yellow goggles
      ctx.fillStyle = m.inflate >= 3 ? '#FB7185' : '#EF4444';
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.fill();
      // Yellow goggle band
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.roundRect(-13, -7, 26, 10, 5);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-5, -2, 3.6, 0, Math.PI * 2);
      ctx.arc(5, -2, 3.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(-4.5, -2, 1.8, 0, Math.PI * 2);
      ctx.arc(5.5, -2, 1.8, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Iconic green fire-breathing Fygar dragon
      if (m.dir === 'LEFT') ctx.scale(-1, 1);
      ctx.fillStyle = m.inflate >= 3 ? '#86EFAC' : '#22C55E';
      ctx.beginPath();
      ctx.roundRect(-15, -13, 30, 26, 9);
      ctx.fill();
      // Crimson dorsal wing/spikes
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.moveTo(-14, -4);
      ctx.lineTo(-22, -12);
      ctx.lineTo(-10, 4);
      ctx.closePath();
      ctx.fill();
      // Snout & eye
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(6, -5, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(7.5, -5, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawRock(ctx: CanvasRenderingContext2D, rk: Rock): void {
    const shake = rk.state === 'wobble' ? Math.sin(this.time * 55) * 4 : 0;
    ctx.save();
    ctx.translate(rk.x * TILE + shake, rk.y * TILE);
    if (rk.state === 'shatter') ctx.globalAlpha = Math.max(0, rk.timer * 2);

    const grad = ctx.createRadialGradient(-6, -6, 3, 0, 0, 22);
    grad.addColorStop(0, '#E2E8F0');
    grad.addColorStop(0.55, '#94A3B8');
    grad.addColorStop(1, '#475569');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(-20, -19, 40, 38, 12);
    ctx.fill();

    // Facet cracks
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, -10);
    ctx.lineTo(2, 0);
    ctx.lineTo(-4, 10);
    ctx.stroke();
    ctx.restore();
  }

  private drawBonusVeggie(ctx: CanvasRenderingContext2D, b: BonusVeggie): void {
    ctx.save();
    ctx.translate(b.x * TILE, b.y * TILE + Math.sin(this.time * 6) * 3);
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(0, 2, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#22C55E';
    ctx.beginPath();
    ctx.ellipse(0, -12, 7, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

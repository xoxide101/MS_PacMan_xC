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

    // Bright Namco sky surface (rows 0..1) with soft clouds & stage flowers
    const skyGrad = ctx.createLinearGradient(0, 0, 0, TILE * 2);
    skyGrad.addColorStop(0, '#0369A1');
    skyGrad.addColorStop(0.65, '#0EA5E9');
    skyGrad.addColorStop(1, '#7DD3FC');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, WIDTH, TILE * 2);

    // Drifting puffy sky clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    for (let i = 0; i < 4; i++) {
      const cx = ((i * 210 + this.time * 12) % (WIDTH + 100)) - 50;
      const cy = 26 + (i % 2) * 14;
      ctx.beginPath();
      ctx.arc(cx, cy, 13, 0, Math.PI * 2);
      ctx.arc(cx + 14, cy - 3, 15, 0, Math.PI * 2);
      ctx.arc(cx + 28, cy, 12, 0, Math.PI * 2);
      ctx.fill();
    }

    // Iconic Namco round stage flowers along top right
    const flowerCount = Math.min(8, this.level);
    for (let f = 0; f < flowerCount; f++) {
      const fx = WIDTH - 32 - f * 26;
      const fy = TILE * 2 - 14;
      ctx.fillStyle = '#16A34A';
      ctx.fillRect(fx - 1.5, fy - 4, 3, 14);
      ctx.fillStyle = '#FFFFFF';
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(fx + Math.cos(a) * 5.5, fy - 8 + Math.sin(a) * 5.5, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(fx, fy - 8, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sculpted grass turf rim
    const grassGrad = ctx.createLinearGradient(0, TILE * 2 - 9, 0, TILE * 2 + 2);
    grassGrad.addColorStop(0, '#4ADE80');
    grassGrad.addColorStop(0.6, '#22C55E');
    grassGrad.addColorStop(1, '#15803D');
    ctx.fillStyle = grassGrad;
    ctx.fillRect(0, TILE * 2 - 9, WIDTH, 11);

    // Deep underground tunnel cavity background with subtle rock grain
    ctx.fillStyle = '#0D0908';
    ctx.fillRect(0, TILE * 2, WIDTH, HEIGHT - TILE * 2);

    // Stratified earthy soil layers (authentic 4-band Namco warmth with darkened tunnel rims)
    const layerColors = ['#E58E17', '#C85E12', '#A83F14', '#852B12'];
    const layerDark = ['#9A5207', '#7C3207', '#631F07', '#4B1406'];
    const layerHighlights = ['#FBBF24', '#F59E0B', '#EA580C', '#C2410C'];

    for (let r = 2; r < ROWS; r++) {
      const layer = this.getDepthLayer(r);
      for (let c = 0; c < COLS; c++) {
        if (!this.dirt[r][c]) continue;
        const x = c * TILE;
        const y = r * TILE;
        ctx.fillStyle = layerColors[layer];
        ctx.fillRect(x, y, TILE + 0.5, TILE + 0.5);

        // Soft bevel rim where dirt borders a dug tunnel
        ctx.fillStyle = layerDark[layer];
        if (r > 2 && !this.dirt[r - 1][c]) ctx.fillRect(x, y, TILE, 5);
        if (r < ROWS - 1 && !this.dirt[r + 1][c]) ctx.fillRect(x, y + TILE - 5, TILE, 5);
        if (c > 0 && !this.dirt[r][c - 1]) ctx.fillRect(x, y, 5, TILE);
        if (c < COLS - 1 && !this.dirt[r][c + 1]) ctx.fillRect(x + TILE - 5, y, 5, TILE);

        // Subtle mineral pebble & strata speckles
        ctx.fillStyle = layerHighlights[layer];
        if ((r + c) % 2 === 0) {
          ctx.beginPath();
          ctx.roundRect(x + 9, y + 11, 7, 4, 2);
          ctx.roundRect(x + 28, y + 30, 9, 4.5, 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.roundRect(x + 24, y + 12, 8, 4.5, 2);
          ctx.roundRect(x + 11, y + 31, 7, 4, 2);
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
        ctx.fillRect(x + ((c * 19 + r * 11) % 30) + 6, y + ((r * 17 + c * 7) % 28) + 6, 4, 3);
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

    // Coiled Pneumatic Pump Harpoon Hose & Spearhead
    if (this.pump.active) {
      const v = VEC[this.pump.dir];
      const sx = this.playerX * TILE;
      const sy = this.playerY * TILE;
      const ex = sx + v.x * this.pump.length * TILE;
      const ey = sy + v.y * this.pump.length * TILE;
      ctx.save();
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 4.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const segs = 10;
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const wob = i === 0 || i === segs ? 0 : Math.sin(t * Math.PI * 6 + this.time * 24) * 2.5;
        const px = sx + (ex - sx) * t + (-v.y) * wob;
        const py = sy + (ey - sy) * t + v.x * wob;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Glowing blue pneumatic spear tip
      ctx.translate(ex, ey);
      ctx.rotate(Math.atan2(v.y, v.x));
      ctx.fillStyle = '#38BDF8';
      ctx.shadowColor = '#38BDF8';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(-4, -6);
      ctx.lineTo(-1, 0);
      ctx.lineTo(-4, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Monsters
    for (const m of this.monsters) {
      this.drawMonster(ctx, m);
    }

    // Dig Dug Hero (Taizo Hori)
    if (this.phase !== 'GAME_OVER') {
      this.drawDigDug(ctx, this.playerX * TILE, this.playerY * TILE);
    }

    renderParticlesAndPopups(ctx, this.particles, this.popups);

    if (this.bannerText && (this.phase === 'READY' || this.phase === 'STAGE_CLEAR')) {
      ctx.save();
      ctx.font = '800 30px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(4, 6, 13, 0.85)';
      ctx.fillRect(WIDTH * 0.24, HEIGHT * 0.44, WIDTH * 0.52, 58);
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2;
      ctx.strokeRect(WIDTH * 0.24, HEIGHT * 0.44, WIDTH * 0.52, 58);
      ctx.fillStyle = '#38BDF8';
      ctx.fillText(this.bannerText, WIDTH * 0.5, HEIGHT * 0.44 + 29);
      ctx.restore();
    }

    if (visualMode === 'crt') renderCrtOverlay(ctx, WIDTH, HEIGHT);
  }

  private drawDigDug(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.translate(x, y);
    if (this.playerDir === 'LEFT') ctx.scale(-1, 1);

    const step = Math.sin(this.playerAnim) * 4;
    // Soft ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.ellipse(0, 17, 13, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Red air-pump backpack
    const packG = ctx.createLinearGradient(-18, -6, -11, 10);
    packG.addColorStop(0, '#F87171');
    packG.addColorStop(1, '#B91C1C');
    ctx.fillStyle = packG;
    ctx.beginPath();
    ctx.roundRect(-17, -6, 7.5, 16, 3);
    ctx.fill();

    // Animated blue boots
    ctx.fillStyle = '#1D4ED8';
    ctx.beginPath();
    ctx.roundRect(-9 + step * 0.5, 11, 8, 6.5, 3);
    ctx.roundRect(1 - step * 0.5, 11, 8, 6.5, 3);
    ctx.fill();

    // Iconic white spacesuit torso with blue chest stripe
    const suitG = ctx.createLinearGradient(-11, -6, 11, 13);
    suitG.addColorStop(0, '#FFFFFF');
    suitG.addColorStop(1, '#CBD5E1');
    ctx.fillStyle = suitG;
    ctx.beginPath();
    ctx.roundRect(-12, -2, 24, 15, 7);
    ctx.fill();
    ctx.fillStyle = '#0284C7';
    ctx.fillRect(-11, 4, 22, 4);

    // Classic Taizo Hori white/blue rounded helmet
    const helmG = ctx.createRadialGradient(-3, -12, 2, 0, -7, 15);
    helmG.addColorStop(0, '#38BDF8');
    helmG.addColorStop(0.5, '#0284C7');
    helmG.addColorStop(1, '#075985');
    ctx.fillStyle = helmG;
    ctx.beginPath();
    ctx.arc(0, -7, 13, 0, Math.PI * 2);
    ctx.fill();
    // White visor hood opening
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(-2, -14, 14, 13, 6);
    ctx.fill();
    // Expressive face & eyes
    ctx.fillStyle = '#FDBA74';
    ctx.beginPath();
    ctx.roundRect(1, -12, 10, 9.5, 4);
    ctx.fill();
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(6.5, -10, 2.8, 4.5);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(7.2, -9.5, 1.2, 1.5);

    // Handheld pump nozzle when pumping
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.roundRect(8, 1, 7, 5, 2);
    ctx.fill();
    ctx.restore();
  }

  private drawMonster(ctx: CanvasRenderingContext2D, m: Monster): void {
    const x = m.x * TILE;
    const y = m.y * TILE;
    const scale = 1 + m.inflate * 0.28;
    const wobble = m.inflate > 0 ? Math.sin(this.time * 32) * m.inflate * 1.4 : 0;

    ctx.save();
    ctx.translate(x + wobble, y);

    if (m.ghostMode) {
      // Iconic Namco translucent drifting ghost-eyes through dirt
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(-5.5, -1, 5.5, 6.5, 0, 0, Math.PI * 2);
      ctx.ellipse(5.5, -1, 5.5, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(-4.5, -1, 2.6, 0, Math.PI * 2);
      ctx.arc(6.5, -1, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    // Layered volumetric Fygar Flame Jet
    if (m.kind === 'fygar' && m.flameTimer > 0) {
      const fDir = m.dir === 'LEFT' ? -1 : 1;
      const flicker = Math.sin(this.time * 42) * 5;
      const grad = ctx.createLinearGradient(fDir * 12, 0, fDir * TILE * 2.5, 0);
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(0.25, '#FEF08A');
      grad.addColorStop(0.6, '#F97316');
      grad.addColorStop(1, 'rgba(239, 68, 68, 0.05)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(fDir * 14, -7);
      ctx.quadraticCurveTo(fDir * TILE * 1.4, -18 + flicker, fDir * TILE * 2.5, -14 - flicker * 0.5);
      ctx.lineTo(fDir * TILE * 2.5, 14 + flicker * 0.5);
      ctx.quadraticCurveTo(fDir * TILE * 1.4, 18 - flicker, fDir * 14, 7);
      ctx.closePath();
      ctx.fill();
    }

    ctx.scale(scale, scale);

    if (m.kind === 'pooka') {
      // Little kicking yellow feet
      const stride = Math.sin(this.time * 14 + m.id) * 3;
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.ellipse(-6 + stride * 0.4, 14, 5, 3, 0, 0, Math.PI * 2);
      ctx.ellipse(6 - stride * 0.4, 14, 5, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Glossy red round Pooka body
      const pg = ctx.createRadialGradient(-5, -6, 2, 0, 0, 17);
      pg.addColorStop(0, '#FCA5A5');
      pg.addColorStop(0.35, m.inflate >= 3 ? '#FB7185' : '#EF4444');
      pg.addColorStop(1, '#991B1B');
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(0, 0, 15.5, 0, Math.PI * 2);
      ctx.fill();

      // Iconic yellow ski goggles with strap & specular lenses
      ctx.fillStyle = '#EAB308';
      ctx.fillRect(-15, -5, 30, 4);
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.roundRect(-13.5, -8.5, 27, 11.5, 5.5);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-5.2, -2.8, 4.2, 0, Math.PI * 2);
      ctx.arc(5.2, -2.8, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(-4.6, -2.8, 2, 0, Math.PI * 2);
      ctx.arc(5.8, -2.8, 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Iconic emerald fire-breathing Fygar dragon with flapping wings & dorsal ridge
      if (m.dir === 'LEFT') ctx.scale(-1, 1);
      const wingFlap = Math.sin(this.time * 18 + m.id) * 4;
      // Crimson wings
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.moveTo(-10, -4);
      ctx.lineTo(-24, -15 + wingFlap);
      ctx.lineTo(-18, 2 + wingFlap * 0.5);
      ctx.lineTo(-8, 4);
      ctx.closePath();
      ctx.fill();
      // Yellow belly & emerald dragon body
      const fg = ctx.createRadialGradient(-4, -5, 2, 0, 0, 18);
      fg.addColorStop(0, '#86EFAC');
      fg.addColorStop(0.45, m.inflate >= 3 ? '#4ADE80' : '#22C55E');
      fg.addColorStop(1, '#14532D');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.roundRect(-15, -13, 31, 26, 9);
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.ellipse(2, 6, 11, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Dorsal crests
      ctx.fillStyle = '#DC2626';
      ctx.beginPath();
      ctx.moveTo(-12, -13);
      ctx.lineTo(-8, -19);
      ctx.lineTo(-4, -13);
      ctx.lineTo(0, -18);
      ctx.lineTo(4, -13);
      ctx.closePath();
      ctx.fill();
      // Expressive dragon eye & snout
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(7, -5, 4.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(8.5, -5, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Stress sweat drop when inflated!
    if (m.inflate >= 2) {
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(13, -12, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawRock(ctx: CanvasRenderingContext2D, rk: Rock): void {
    const shake = rk.state === 'wobble' ? Math.sin(this.time * 55) * 4.5 : 0;
    ctx.save();
    ctx.translate(rk.x * TILE + shake, rk.y * TILE);
    if (rk.state === 'shatter') ctx.globalAlpha = Math.max(0, rk.timer * 2);

    const grad = ctx.createRadialGradient(-7, -7, 3, 0, 0, 23);
    grad.addColorStop(0, '#F1F5F9');
    grad.addColorStop(0.5, '#94A3B8');
    grad.addColorStop(1, '#334155');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(-20, -19, 40, 38, 13);
    ctx.fill();

    // Moss accent & sharp geological cracks
    ctx.fillStyle = 'rgba(74, 222, 128, 0.35)';
    ctx.beginPath();
    ctx.ellipse(-8, -13, 8, 3.5, -0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-8, -11);
    ctx.lineTo(2, 0);
    ctx.lineTo(-4, 11);
    ctx.moveTo(2, 0);
    ctx.lineTo(12, 4);
    ctx.stroke();
    ctx.restore();
  }

  private drawBonusVeggie(ctx: CanvasRenderingContext2D, b: BonusVeggie): void {
    ctx.save();
    ctx.translate(b.x * TILE, b.y * TILE + Math.sin(this.time * 6) * 3);
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 14;
    const vg = ctx.createRadialGradient(-4, -3, 2, 0, 2, 15);
    vg.addColorStop(0, '#FFFFFF');
    vg.addColorStop(0.35, b.color);
    vg.addColorStop(1, '#1E293B');
    ctx.fillStyle = vg;
    ctx.beginPath();
    ctx.arc(0, 2, 13.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#22C55E';
    ctx.beginPath();
    ctx.ellipse(-4, -12, 6, 3.5, -0.4, 0, Math.PI * 2);
    ctx.ellipse(4, -12, 6, 3.5, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

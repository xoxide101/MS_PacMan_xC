import { drawStarGlint } from './arcadeGfx';
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

// ============================================================================
// DIG DUG 2.5D — MODERN SUBTERRANEAN DIORAMA ENGINE
// Faithful 1982 Namco arcade rules (depth-tiered scoring, 2x Fygar side-pump,
// 4-stage balloon inflation, ghost phasing, rock crush chains, 2-rock bonus
// veggies, last-monster flee) rebuilt with sub-tile organic tunnel carving,
// 2.5D beveled geological strata, buried fossils, volumetric Fygar flame,
// squash-and-stretch characters, screen shake, and rich Foley soundscapes.
// ============================================================================

const COLS = 15;
const ROWS = 16; // Rows 0..1 surface sky, 2..15 underground strata
const TILE = 54;
const SUB = 3; // 3x3 sub-cells per tile (18px) for organic smooth tunnel carving!
const SUB_COLS = COLS * SUB;
const SUB_ROWS = ROWS * SUB;
const SUB_SIZE = TILE / SUB; // 18px
const WIDTH = COLS * TILE; // 810
const HEIGHT = ROWS * TILE; // 864
const STORAGE_KEY = 'digdug_hd_highscore_v1';

type Dir = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

const VEC: Record<Dir, { x: number; y: number }> = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};

interface StrataTheme {
  name: string;
  skyTop: string;
  skyMid: string;
  skyHorizon: string;
  hillBack: string;
  hillFront: string;
  grassTop: string;
  grassMid: string;
  grassDark: string;
  cavityBg: string;
  bands: [string, string, string, string];
  bandDark: [string, string, string, string];
  bandLight: [string, string, string, string];
}

const THEMES: StrataTheme[] = [
  {
    name: 'Sunlit Meadow',
    skyTop: '#0284C7',
    skyMid: '#38BDF8',
    skyHorizon: '#BAE6FD',
    hillBack: '#15803D',
    hillFront: '#22C55E',
    grassTop: '#86EFAC',
    grassMid: '#22C55E',
    grassDark: '#166534',
    cavityBg: '#120C0A',
    bands: ['#EA9520', '#CC6214', '#A83B14', '#7F2312'],
    bandDark: ['#9A5709', '#7E3508', '#661D07', '#4B1006'],
    bandLight: ['#FCD34D', '#F59E0B', '#EA580C', '#DC2626'],
  },
  {
    name: 'Emerald Basin',
    skyTop: '#0F766E',
    skyMid: '#2DD4BF',
    skyHorizon: '#CCFBF1',
    hillBack: '#065F46',
    hillFront: '#10B981',
    grassTop: '#A7F3D0',
    grassMid: '#10B981',
    grassDark: '#064E3B',
    cavityBg: '#091211',
    bands: ['#349672', '#237563', '#195454', '#133742'],
    bandDark: ['#1E5E47', '#13473D', '#0D3336', '#091E26'],
    bandLight: ['#6EE7B7', '#34D399', '#2DD4BF', '#38BDF8'],
  },
  {
    name: 'Sunset Mesa',
    skyTop: '#4C1D95',
    skyMid: '#DB2777',
    skyHorizon: '#FDBA74',
    hillBack: '#7C2D12',
    hillFront: '#B45309',
    grassTop: '#FDE047',
    grassMid: '#D97706',
    grassDark: '#78350F',
    cavityBg: '#140B10',
    bands: ['#D97736', '#B54B34', '#852D42', '#521B3B'],
    bandDark: ['#8C4317', '#73281A', '#521726', '#330C24'],
    bandLight: ['#FDBA74', '#FB923C', '#F472B6', '#C084FC'],
  },
  {
    name: 'Crystal Glacier',
    skyTop: '#1E1B4B',
    skyMid: '#2563EB',
    skyHorizon: '#93C5FD',
    hillBack: '#1E3A8A',
    hillFront: '#3B82F6',
    grassTop: '#E0F2FE',
    grassMid: '#7DD3FC',
    grassDark: '#0369A1',
    cavityBg: '#070D1A',
    bands: ['#3E82B8', '#2C619E', '#244585', '#1C2C63'],
    bandDark: ['#225078', '#173A63', '#132752', '#0D173B'],
    bandLight: ['#7DD3FC', '#60A5FA', '#818CF8', '#A78BFA'],
  },
];

interface Monster {
  id: number;
  kind: 'pooka' | 'fygar';
  x: number; // grid coords (center at col + 0.5)
  y: number;
  dir: Dir;
  ghostMode: boolean;
  ghostTimer: number;
  inflate: number; // 0..4 (4 pops!)
  inflateBounce: number; // squash/stretch impulse
  deflateTimer: number;
  flameCharge: number; // 0..0.38s telegraphed inhale before breathing fire
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
  wobbleSoundTimer: number;
  crushedCount: number;
}

interface PumpLine {
  active: boolean;
  dir: Dir;
  length: number; // in tiles 0..2.75
  hookedMonsterId: number | null;
  retracting: boolean;
  pumpPulse: number;
}

interface BonusVeggie {
  active: boolean;
  x: number;
  y: number;
  timer: number;
  points: number;
  label: string;
  color: string;
  kind: 'carrot' | 'turnip' | 'mushroom' | 'cucumber' | 'eggplant' | 'watermelon' | 'galaxian' | 'pineapple';
}

interface ShockRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  life: number;
  maxLife: number;
}

interface BuriedFossil {
  x: number;
  y: number;
  kind: 'ammonite' | 'bone' | 'crystal';
  rot: number;
  scale: number;
}

const VEGGIES: Array<{
  label: string;
  points: number;
  color: string;
  kind: BonusVeggie['kind'];
}> = [
  { label: 'Carrot', points: 400, color: '#F97316', kind: 'carrot' },
  { label: 'Turnip', points: 600, color: '#F1F5F9', kind: 'turnip' },
  { label: 'Mushroom', points: 800, color: '#EF4444', kind: 'mushroom' },
  { label: 'Cucumber', points: 1000, color: '#22C55E', kind: 'cucumber' },
  { label: 'Eggplant', points: 2000, color: '#A855F7', kind: 'eggplant' },
  { label: 'Watermelon', points: 4000, color: '#10B981', kind: 'watermelon' },
  { label: 'Galaxian', points: 7000, color: '#38BDF8', kind: 'galaxian' },
  { label: 'Pineapple', points: 8000, color: '#FACC15', kind: 'pineapple' },
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
  private bannerSub = '';

  private input: ArcadeInputState = createEmptyInput();
  // Logical 15x16 tile dirt grid (for AI & rock support)
  private dirt: boolean[][] = [];
  // High-res 3x sub-tile dirt grid (45x48) for organic smooth tunnel carving!
  private subDirt: boolean[][] = [];
  private fossils: BuriedFossil[] = [];

  private playerX = 7.5;
  private playerY = 8.5;
  private playerDir: Dir = 'RIGHT';
  private playerAnim = 0;
  private playerDigging = false;
  private pumpAnim = 0;
  private digSoundTimer = 0;

  private pump: PumpLine = {
    active: false,
    dir: 'RIGHT',
    length: 0,
    hookedMonsterId: null,
    retracting: false,
    pumpPulse: 0,
  };
  private monsters: Monster[] = [];
  private rocks: Rock[] = [];
  private rocksDroppedThisRound = 0;
  private bonus: BonusVeggie = {
    active: false,
    x: 7.5,
    y: 8.5,
    timer: 0,
    points: 400,
    label: 'Carrot',
    color: '#F97316',
    kind: 'carrot',
  };
  private nextId = 1;

  private shakeTime = 0;
  private shakeMag = 0;

  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];
  private shockRings: ShockRing[] = [];

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
    this.shockRings = [];
    this.setupStage(1);
    this.phase = 'READY';
    this.phaseTimer = 1.2;
    this.bannerText = 'ROUND 1';
    this.bannerSub = THEMES[0].name.toUpperCase();
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
    const theme = THEMES[(this.level - 1) % THEMES.length];
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: `Round ${this.level} · ${theme.name}`,
      primaryMetricLabel: 'Monsters',
      primaryMetricValue: String(this.monsters.length),
      secondaryMetricLabel: 'Rocks Left',
      secondaryMetricValue: String(this.rocks.filter((r) => r.state !== 'shatter').length),
      bannerText: this.bannerText,
    };
  }

  private addShake(mag: number, dur = 0.2): void {
    if (this.phase === 'TITLE') return;
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeTime = Math.max(this.shakeTime, dur);
  }

  private addScore(pts: number, gx?: number, gy?: number, color = '#FDE047', label?: string): void {
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
      this.popups.push({
        x: this.playerX * TILE,
        y: this.playerY * TILE - 28,
        text: '1UP!',
        color: '#4ADE80',
        life: 1.5,
        maxLife: 1.5,
      });
    }
    if (gx !== undefined && gy !== undefined && pts >= 50) {
      this.popups.push({
        x: gx * TILE,
        y: gy * TILE - 14,
        text: label ?? `${pts}`,
        color,
        life: 1.1,
        maxLife: 1.1,
      });
    }
  }

  private carveTile(c: number, r: number): void {
    if (r < 2 || r >= ROWS || c < 0 || c >= COLS) return;
    this.dirt[r][c] = false;
    for (let sr = r * SUB; sr < (r + 1) * SUB; sr++) {
      for (let sc = c * SUB; sc < (c + 1) * SUB; sc++) {
        this.subDirt[sr][sc] = false;
      }
    }
  }

  private carveCircleAt(gx: number, gy: number, radiusTiles = 0.56): boolean {
    let carvedAny = false;
    const minSC = Math.max(0, Math.floor((gx - radiusTiles) * SUB));
    const maxSC = Math.min(SUB_COLS - 1, Math.floor((gx + radiusTiles) * SUB));
    const minSR = Math.max(2 * SUB, Math.floor((gy - radiusTiles) * SUB));
    const maxSR = Math.min(SUB_ROWS - 1, Math.floor((gy + radiusTiles) * SUB));

    for (let sr = minSR; sr <= maxSR; sr++) {
      for (let sc = minSC; sc <= maxSC; sc++) {
        if (!this.subDirt[sr][sc]) continue;
        const cx = (sc + 0.5) / SUB;
        const cy = (sr + 0.5) / SUB;
        if (Math.hypot(cx - gx, cy - gy) <= radiusTiles) {
          this.subDirt[sr][sc] = false;
          carvedAny = true;
        }
      }
    }
    return carvedAny;
  }

  private setupStage(round: number): void {
    this.dirt = Array.from({ length: ROWS }, (_, r) =>
      Array.from({ length: COLS }, () => r >= 2)
    );
    this.subDirt = Array.from({ length: SUB_ROWS }, (_, sr) =>
      Array.from({ length: SUB_COLS }, () => sr >= 2 * SUB)
    );

    // Deterministic decorative subterranean fossils embedded in cavern backwall
    this.fossils = [];
    for (let i = 0; i < 14; i++) {
      const kinds: BuriedFossil['kind'][] = ['ammonite', 'bone', 'crystal'];
      this.fossils.push({
        x: 65 + ((i * 173 + round * 47) % (WIDTH - 130)),
        y: TILE * 2.8 + ((i * 129 + round * 31) % (HEIGHT - TILE * 3.5)),
        kind: kinds[i % 3],
        rot: ((i * 1.13) % (Math.PI * 2)),
        scale: 0.75 + (i % 3) * 0.22,
      });
    }

    // Classic Dig Dug vertical entry shaft & center home chamber
    for (let r = 2; r <= 8; r++) this.carveTile(7, r);
    this.carveTile(6, 8);
    this.carveTile(7, 8);
    this.carveTile(8, 8);

    this.playerX = 7.5;
    this.playerY = 8.5;
    this.playerDir = 'RIGHT';
    this.playerDigging = false;
    this.pump = {
      active: false,
      dir: 'RIGHT',
      length: 0,
      hookedMonsterId: null,
      retracting: false,
      pumpPulse: 0,
    };
    this.rocksDroppedThisRound = 0;
    this.bonus.active = false;

    // Varied authentic arcade chamber layouts per round
    this.monsters = [];
    const layoutIdx = (round - 1) % 4;
    const baseChambers: Array<
      Array<{ x1: number; y1: number; x2: number; y2: number; kind: 'pooka' | 'fygar' }>
    > = [
      [
        { x1: 2, y1: 4, x2: 4, y2: 4, kind: 'pooka' },
        { x1: 11, y1: 4, x2: 11, y2: 7, kind: 'pooka' },
        { x1: 2, y1: 11, x2: 5, y2: 11, kind: 'fygar' },
        { x1: 10, y1: 12, x2: 13, y2: 12, kind: 'fygar' },
      ],
      [
        { x1: 1, y1: 5, x2: 4, y2: 5, kind: 'pooka' },
        { x1: 10, y1: 3, x2: 13, y2: 3, kind: 'fygar' },
        { x1: 2, y1: 13, x2: 2, y2: 10, kind: 'pooka' },
        { x1: 11, y1: 10, x2: 11, y2: 13, kind: 'fygar' },
      ],
      [
        { x1: 2, y1: 3, x2: 5, y2: 3, kind: 'fygar' },
        { x1: 10, y1: 5, x2: 13, y2: 5, kind: 'pooka' },
        { x1: 1, y1: 12, x2: 4, y2: 12, kind: 'pooka' },
        { x1: 9, y1: 13, x2: 13, y2: 13, kind: 'fygar' },
      ],
      [
        { x1: 3, y1: 4, x2: 3, y2: 7, kind: 'pooka' },
        { x1: 12, y1: 4, x2: 12, y2: 7, kind: 'fygar' },
        { x1: 2, y1: 12, x2: 5, y2: 12, kind: 'fygar' },
        { x1: 10, y1: 12, x2: 13, y2: 12, kind: 'pooka' },
      ],
    ];

    const chambers = [...baseChambers[layoutIdx]];
    if (round >= 2) chambers.push({ x1: 5, y1: 14, x2: 9, y2: 14, kind: 'pooka' });
    if (round >= 3) chambers.push({ x1: 1, y1: 8, x2: 3, y2: 8, kind: 'fygar' });
    if (round >= 5) chambers.push({ x1: 11, y1: 8, x2: 13, y2: 8, kind: 'pooka' });

    for (const ch of chambers) {
      const rMin = Math.min(ch.y1, ch.y2);
      const rMax = Math.max(ch.y1, ch.y2);
      const cMin = Math.min(ch.x1, ch.x2);
      const cMax = Math.max(ch.x1, ch.x2);
      for (let r = rMin; r <= rMax; r++) {
        for (let c = cMin; c <= cMax; c++) {
          this.carveTile(c, r);
        }
      }
      this.monsters.push({
        id: this.nextId++,
        kind: ch.kind,
        x: (cMin + cMax) * 0.5 + 0.5,
        y: (rMin + rMax) * 0.5 + 0.5,
        dir: cMin === cMax ? 'DOWN' : 'RIGHT',
        ghostMode: false,
        ghostTimer: 4.8 + Math.random() * 4.5,
        inflate: 0,
        inflateBounce: 0,
        deflateTimer: 0,
        flameCharge: 0,
        flameTimer: 0,
        flameCooldown: 2 + Math.random() * 2.5,
        fleeing: false,
        crushedByRockId: null,
        anim: Math.random() * 5,
      });
    }

    // Place 3–4 strategic hanging rocks above caves
    const rockCoords: Array<[number, number]> = [
      [3, 2],
      [11, 2],
      [4, 9],
      [11, 9],
    ];
    this.rocks = rockCoords.slice(0, round >= 2 ? 4 : 3).map(([c, r]) => ({
      id: this.nextId++,
      x: c + 0.5,
      y: r + 0.5,
      state: 'idle',
      timer: 0,
      wobbleSoundTimer: 0,
      crushedCount: 0,
    }));
  }

  private getDepthLayer(row: number): number {
    if (row < 6) return 0;
    if (row < 9) return 1;
    if (row < 13) return 2;
    return 3;
  }

  public step(dt: number): void {
    this.time += dt;
    stepParticlesAndPopups(this.particles, this.popups, dt);

    for (let i = this.shockRings.length - 1; i >= 0; i--) {
      const sr = this.shockRings[i];
      sr.life -= dt;
      const p = 1 - Math.max(0, sr.life / sr.maxLife);
      sr.radius = sr.maxRadius * (1 - (1 - p) * (1 - p));
      if (sr.life <= 0) this.shockRings.splice(i, 1);
    }

    if (this.shakeTime > 0) {
      this.shakeTime = Math.max(0, this.shakeTime - dt);
      if (this.shakeTime === 0) this.shakeMag = 0;
    }
    if (this.pumpAnim > 0) this.pumpAnim = Math.max(0, this.pumpAnim - dt * 5.5);
    if (this.pump.pumpPulse > 0) this.pump.pumpPulse = Math.max(0, this.pump.pumpPulse - dt * 6);

    if (this.phase === 'PAUSED' || this.phase === 'GAME_OVER') return;

    if (this.phase === 'READY') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.phase = 'PLAYING';
        this.bannerText = '';
        this.bannerSub = '';
      }
      return;
    }

    if (this.phase === 'STAGE_CLEAR') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.level += 1;
        this.setupStage(this.level);
        this.phase = 'READY';
        this.phaseTimer = 1.2;
        const theme = THEMES[(this.level - 1) % THEMES.length];
        this.bannerText = `ROUND ${this.level}`;
        this.bannerSub = theme.name.toUpperCase();
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
        spawnBurst(this.particles, this.bonus.x * TILE, this.bonus.y * TILE, this.bonus.color, 20, 200, 4);
        this.addScore(
          this.bonus.points,
          this.bonus.x,
          this.bonus.y,
          this.bonus.color,
          `${this.bonus.label.toUpperCase()} +${this.bonus.points}`
        );
      }
    }

    if (this.monsters.length === 0) {
      if (isAttract) {
        this.setupStage(1);
      } else {
        arcadeAudio.playStageClear();
        this.phase = 'STAGE_CLEAR';
        this.phaseTimer = 1.5;
        this.bannerText = `ROUND ${this.level} CLEAR!`;
        this.bannerSub = 'Descending to Deeper Strata...';
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
    this.playerDigging = false;

    // Trigger harpoon / inflate pump!
    if (!isAttract && this.input.fireJustPressed) {
      if (this.pump.active && this.pump.hookedMonsterId !== null) {
        const m = this.monsters.find((x) => x.id === this.pump.hookedMonsterId);
        if (m) {
          m.inflate += 1;
          m.inflateBounce = 1;
          m.deflateTimer = 1.4;
          this.pumpAnim = 1;
          this.pump.pumpPulse = 1;
          arcadeAudio.playDigDugInflate(m.inflate);
          spawnBurst(this.particles, m.x * TILE, m.y * TILE, '#BAE6FD', 6, 110, 2.4);
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
          pumpPulse: 1,
        };
        this.pumpAnim = 1;
        arcadeAudio.playDigDugHarpoon();
      }
    }

    let wantDir: Dir | null = null;
    if (isAttract) {
      const target = this.monsters[0];
      if (target) {
        const dx = target.x - this.playerX;
        const dy = target.y - this.playerY;
        const dist = Math.hypot(dx, dy);
        if (dist < 2.15 && !this.pump.active && Math.random() < 0.085) {
          this.playerDir =
            Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'RIGHT' : 'LEFT') : dy > 0 ? 'DOWN' : 'UP';
          this.pump = {
            active: true,
            dir: this.playerDir,
            length: 0.3,
            hookedMonsterId: null,
            retracting: false,
            pumpPulse: 1,
          };
        } else if (this.pump.hookedMonsterId !== null) {
          if (Math.random() < 0.1) {
            const m = this.monsters.find((x) => x.id === this.pump.hookedMonsterId);
            if (m) {
              m.inflate += 1;
              m.inflateBounce = 1;
              m.deflateTimer = 1.3;
              if (m.inflate >= 4) this.popMonster(m);
            }
          }
        } else {
          wantDir =
            Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'RIGHT' : 'LEFT') : dy > 0 ? 'DOWN' : 'UP';
        }
      }
    } else {
      if (this.input.left) wantDir = 'LEFT';
      else if (this.input.right) wantDir = 'RIGHT';
      else if (this.input.up) wantDir = 'UP';
      else if (this.input.down) wantDir = 'DOWN';
    }

    if (!wantDir) return;

    // Moving detaches pump hose cleanly
    if (this.pump.active) {
      this.pump.active = false;
      this.pump.hookedMonsterId = null;
    }

    this.playerDir = wantDir;
    this.playerAnim += dt * 15;
    const v = VEC[wantDir];
    const col = Math.floor(this.playerX);
    const row = Math.floor(this.playerY);
    const cx = col + 0.5;
    const cy = row + 0.5;

    // Smooth corridor centering along perpendicular axis
    if (v.x !== 0) this.playerY += (cy - this.playerY) * Math.min(1, dt * 17);
    else this.playerX += (cx - this.playerX) * Math.min(1, dt * 17);

    const aheadCol = Math.max(0, Math.min(COLS - 1, Math.floor(this.playerX + v.x * 0.48)));
    const aheadRow = Math.max(2, Math.min(ROWS - 1, Math.floor(this.playerY + v.y * 0.48)));

    if (this.isRockBlocking(aheadCol, aheadRow)) return;

    const digging = this.dirt[aheadRow]?.[aheadCol] ?? false;
    this.playerDigging = digging;
    const speed = digging ? 3.35 : 4.65;
    const nx = Math.max(0.5, Math.min(COLS - 0.5, this.playerX + v.x * speed * dt));
    const ny = Math.max(2.5, Math.min(ROWS - 0.5, this.playerY + v.y * speed * dt));

    this.playerX = nx;
    this.playerY = ny;

    // Continuously sculpt smooth rounded sub-tile tunnel ahead of Taizo!
    const carvedSub = this.carveCircleAt(this.playerX + v.x * 0.12, this.playerY + v.y * 0.12, 0.56);
    if (carvedSub) {
      const theme = THEMES[(this.level - 1) % THEMES.length];
      const band = this.getDepthLayer(Math.floor(this.playerY));
      spawnBurst(
        this.particles,
        (this.playerX + v.x * 0.35) * TILE,
        (this.playerY + v.y * 0.35) * TILE,
        theme.bands[band],
        3,
        105,
        3.2
      );
      if (!isAttract && this.digSoundTimer <= 0) {
        arcadeAudio.playDigDugStep(band);
        this.digSoundTimer = 0.12;
      }
    }

    const nowC = Math.floor(this.playerX);
    const nowR = Math.floor(this.playerY);
    if (this.dirt[nowR]?.[nowC]) {
      this.dirt[nowR][nowC] = false;
      this.addScore(10);
    }
  }

  private popMonster(m: Monster): void {
    const idx = this.monsters.findIndex((x) => x.id === m.id);
    if (idx === -1) return;
    const layer = this.getDepthLayer(Math.floor(m.y));
    const basePts = [200, 300, 400, 500][layer];
    const sideBonus =
      m.kind === 'fygar' && (this.pump.dir === 'LEFT' || this.pump.dir === 'RIGHT') ? 2 : 1;
    const pts = basePts * sideBonus;

    this.monsters.splice(idx, 1);
    this.pump.active = false;
    this.pump.hookedMonsterId = null;

    if (this.phase !== 'TITLE') {
      arcadeAudio.playDigDugPop();
      this.addShake(6, 0.2);
    }
    spawnBurst(
      this.particles,
      m.x * TILE,
      m.y * TILE,
      m.kind === 'fygar' ? '#4ADE80' : '#EF4444',
      28,
      260,
      4.5
    );
    spawnBurst(this.particles, m.x * TILE, m.y * TILE, '#FEF08A', 14, 190, 3);
    this.shockRings.push({
      x: m.x * TILE,
      y: m.y * TILE,
      radius: 10,
      maxRadius: 72,
      color: m.kind === 'fygar' ? '#86EFAC' : '#FCA5A5',
      life: 0.34,
      maxLife: 0.34,
    });

    this.addScore(
      pts,
      m.x,
      m.y,
      sideBonus === 2 ? '#38BDF8' : '#FDE047',
      sideBonus === 2 ? `2× SIDE ${pts}!` : `${pts}`
    );

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
      this.pump.length += 12.4 * dt;
      const tipX = this.playerX + v.x * this.pump.length;
      const tipY = this.playerY + v.y * this.pump.length;

      for (const m of this.monsters) {
        if (m.crushedByRockId !== null) continue;
        if (Math.hypot(tipX - m.x, tipY - m.y) < 0.58) {
          this.pump.hookedMonsterId = m.id;
          m.ghostMode = false;
          m.flameTimer = 0;
          m.flameCharge = 0;
          m.inflate = Math.min(3, m.inflate + 1);
          m.inflateBounce = 1;
          m.deflateTimer = 1.45;
          if (!isAttract) arcadeAudio.playDigDugInflate(m.inflate);
          spawnBurst(this.particles, m.x * TILE, m.y * TILE, '#7DD3FC', 8, 120, 2.5);
          return;
        }
      }

      const tc = Math.floor(tipX);
      const tr = Math.floor(tipY);
      const out = tc < 0 || tc >= COLS || tr < 2 || tr >= ROWS;
      const hitWall = out || this.dirt[tr]?.[tc] || this.isRockBlocking(tc, tr);
      if (this.pump.length >= 2.7 || (hitWall && this.pump.length > 0.65)) {
        this.pump.retracting = true;
      }
    } else {
      this.pump.length -= 14 * dt;
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
          rk.timer = 0.7;
          rk.wobbleSoundTimer = 0;
        }
      } else if (rk.state === 'wobble') {
        rk.timer -= dt;
        rk.wobbleSoundTimer -= dt;
        if (rk.wobbleSoundTimer <= 0) {
          if (!isAttract) arcadeAudio.playDigDugRockWobble();
          rk.wobbleSoundTimer = 0.18;
          // Trickling pebbles warn the player!
          spawnBurst(this.particles, rk.x * TILE, (rk.y + 0.45) * TILE, '#CBD5E1', 3, 60, 2.2);
        }
        if (rk.timer <= 0) {
          rk.state = 'falling';
          rk.crushedCount = 0;
        }
      } else if (rk.state === 'falling') {
        rk.y += 7.6 * dt;
        const curRow = Math.floor(rk.y);
        if (curRow >= 2 && curRow < ROWS) {
          this.dirt[curRow][col] = false;
          this.carveCircleAt(rk.x, rk.y, 0.56);
        }

        // Crush monsters in path!
        for (const m of this.monsters) {
          if (m.crushedByRockId === null && Math.hypot(m.x - rk.x, m.y - rk.y) < 0.72) {
            m.crushedByRockId = rk.id;
            rk.crushedCount += 1;
          }
          if (m.crushedByRockId === rk.id) {
            m.x = rk.x;
            m.y = rk.y + 0.28;
          }
        }

        if (!isAttract && Math.hypot(this.playerX - rk.x, this.playerY - rk.y) < 0.56) {
          this.handlePlayerHit();
          return;
        }

        const nextRow = Math.floor(rk.y + 0.52);
        if (nextRow >= ROWS || this.dirt[nextRow]?.[col]) {
          rk.y = Math.floor(rk.y) + 0.5;
          rk.state = 'shatter';
          rk.timer = 0.55;
          this.addShake(rk.crushedCount > 0 ? 10 : 6, 0.26);
          if (!isAttract) {
            if (rk.crushedCount > 0) arcadeAudio.playDigDugCrush(rk.crushedCount);
            else arcadeAudio.playRockThud();
          }
          spawnBurst(this.particles, rk.x * TILE, rk.y * TILE, '#94A3B8', 22, 200, 4.2);
          spawnBurst(this.particles, rk.x * TILE, rk.y * TILE, '#E2E8F0', 10, 140, 2.6);
          this.shockRings.push({
            x: rk.x * TILE,
            y: rk.y * TILE,
            radius: 8,
            maxRadius: 68,
            color: '#E2E8F0',
            life: 0.32,
            maxLife: 0.32,
          });

          if (rk.crushedCount > 0) {
            const crushTable = [0, 1000, 2500, 4000, 6000, 8000, 10000];
            const pts = crushTable[Math.min(crushTable.length - 1, rk.crushedCount)];
            this.monsters = this.monsters.filter((m) => m.crushedByRockId !== rk.id);
            this.addScore(pts, rk.x, rk.y, '#38BDF8', `CRUSH ×${rk.crushedCount} +${pts}!`);
            if (this.monsters.length === 1) this.monsters[0].fleeing = true;
          }

          this.rocksDroppedThisRound += 1;
          if (this.rocksDroppedThisRound === 2) {
            const veg = VEGGIES[(this.level - 1) % VEGGIES.length];
            this.bonus = {
              active: true,
              x: 7.5,
              y: 8.5,
              timer: 11,
              points: veg.points,
              label: veg.label,
              color: veg.color,
              kind: veg.kind,
            };
            this.popups.push({
              x: 7.5 * TILE,
              y: 7.6 * TILE,
              text: `${veg.label.toUpperCase()} APPEARED!`,
              color: veg.color,
              life: 1.5,
              maxLife: 1.5,
            });
          }
        }
      } else if (rk.state === 'shatter') {
        rk.timer -= dt;
        if (rk.timer <= 0) this.rocks.splice(i, 1);
      }
    }
  }

  private updateMonsters(dt: number, isAttract: boolean): void {
    const baseSpeed = Math.min(4.0, 2.4 + (this.level - 1) * 0.22);

    for (let i = this.monsters.length - 1; i >= 0; i--) {
      const m = this.monsters[i];
      if (m.crushedByRockId !== null) continue;
      m.anim += dt * 11;
      if (m.inflateBounce > 0) m.inflateBounce = Math.max(0, m.inflateBounce - dt * 5);

      const speed = m.fleeing ? baseSpeed * 1.18 : baseSpeed;

      // Handle balloon inflation & slow deflation
      if (m.inflate > 0) {
        m.deflateTimer -= dt;
        if (m.deflateTimer <= 0) {
          m.inflate = Math.max(0, m.inflate - 1);
          m.deflateTimer = 0.88;
          if (m.inflate === 0 && this.pump.hookedMonsterId === m.id) {
            this.pump.hookedMonsterId = null;
            this.pump.active = false;
          }
        }
        continue;
      }

      // Fygar telegraphed charge + volumetric fire breath
      if (m.kind === 'fygar' && !m.ghostMode && !m.fleeing) {
        if (m.flameCharge > 0) {
          m.flameCharge -= dt;
          if (m.flameCharge <= 0) {
            m.flameTimer = 0.72;
            if (!isAttract) arcadeAudio.playFlame();
          }
          continue;
        }
        if (m.flameTimer > 0) {
          m.flameTimer -= dt;
          const fDir = m.dir === 'LEFT' ? -1 : 1;
          const flameLen = 2.45;
          const dx = (this.playerX - m.x) * fDir;
          const dy = Math.abs(this.playerY - m.y);
          if (Math.random() < 0.45) {
            spawnBurst(
              this.particles,
              (m.x + fDir * (0.6 + Math.random() * 1.7)) * TILE,
              m.y * TILE,
              '#F97316',
              1,
              90,
              2.8
            );
          }
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
            m.flameCharge = 0.36; // Authentic wing-flare telegraph!
            m.flameCooldown = 3.2;
            if (!isAttract) arcadeAudio.playFygarCharge();
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
        m.x += (dx / dist) * speed * 0.76 * dt;
        m.y += (dy / dist) * speed * 0.76 * dt;
        m.x = Math.max(0.5, Math.min(COLS - 0.5, m.x));
        m.y = Math.max(2.5, Math.min(ROWS - 0.5, m.y));
        const c = Math.floor(m.x);
        const r = Math.floor(m.y);
        if (!this.dirt[r]?.[c] && m.ghostTimer < 2.2) {
          m.ghostMode = false;
          m.ghostTimer = 5.2 + Math.random() * 4;
        }
      } else {
        const col = Math.floor(m.x);
        const row = Math.floor(m.y);
        const cx = col + 0.5;
        const cy = row + 0.5;

        if (Math.hypot(m.x - cx, m.y - cy) < 0.14) {
          const dirs: Dir[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
          const open = dirs.filter((d) => {
            const nc = col + VEC[d].x;
            const nr = row + VEC[d].y;
            return (
              nc >= 0 &&
              nc < COLS &&
              nr >= 2 &&
              nr < ROWS &&
              !this.dirt[nr][nc] &&
              !this.isRockBlocking(nc, nr)
            );
          });
          if (open.length > 0) {
            let best = open[0];
            let bestDist = Infinity;
            for (const d of open) {
              const dist = Math.hypot(
                col + VEC[d].x + 0.5 - targetX,
                row + VEC[d].y + 0.5 - targetY
              );
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
          if (v.x !== 0) m.y += (cy - m.y) * Math.min(1, dt * 13);
          else m.x += (cx - m.x) * Math.min(1, dt * 13);
        } else {
          const opp: Record<Dir, Dir> = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };
          m.dir = opp[m.dir];
        }
      }

      if (m.fleeing && m.y <= 2.75 && m.x <= 0.95) {
        this.monsters.splice(i, 1);
        continue;
      }

      if (!isAttract && Math.hypot(m.x - this.playerX, m.y - this.playerY) < 0.6) {
        this.handlePlayerHit();
        return;
      }
    }
  }

  private handlePlayerHit(): void {
    arcadeAudio.playDeath();
    this.addShake(11, 0.32);
    spawnBurst(this.particles, this.playerX * TILE, this.playerY * TILE, '#38BDF8', 28, 240, 4.5);
    this.lives -= 1;
    this.pump.active = false;
    this.pump.hookedMonsterId = null;
    if (this.lives <= 0) {
      this.phase = 'GAME_OVER';
      this.bannerText = 'GAME OVER';
      this.bannerSub = `Final Score: ${this.score.toLocaleString()}`;
      return;
    }
    this.playerX = 7.5;
    this.playerY = 8.5;
    for (const m of this.monsters) {
      m.inflate = 0;
      m.flameTimer = 0;
      m.flameCharge = 0;
      if (Math.hypot(m.x - 7.5, m.y - 8.5) < 3.6) {
        m.x = m.x < 7.5 ? 2.5 : 12.5;
      }
    }
    this.phase = 'READY';
    this.phaseTimer = 1.25;
    this.bannerText = 'READY!';
    this.bannerSub = `${this.lives} ${this.lives === 1 ? 'Life' : 'Lives'} Remaining`;
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const theme = THEMES[(this.level - 1) % THEMES.length];

    const sx = this.shakeTime > 0 ? (Math.random() - 0.5) * this.shakeMag * 2 : 0;
    const sy = this.shakeTime > 0 ? (Math.random() - 0.5) * this.shakeMag * 2 : 0;

    ctx.save();
    ctx.translate(Math.round(sx), Math.round(sy));

    // 1. Lush 2.5D Surface Sky & Rolling Hills (rows 0..1)
    this.drawSurfaceWorld(ctx, theme);

    // 2. Deep Subterranean Cavern Backwall (visible inside dug tunnels)
    this.drawCavernBackwall(ctx, theme);

    // 3. Organic Sub-Tile 2.5D Stratified Earth Terrain
    this.drawStratifiedEarth(ctx, theme);

    // 4. Overhanging Grass Turf Lip along top of row 2
    this.drawGrassLip(ctx, theme);

    // 5. World-Space Shockwave Rings
    for (const sr of this.shockRings) {
      const alpha = Math.max(0, sr.life / sr.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha * 0.85;
      ctx.strokeStyle = sr.color;
      ctx.lineWidth = 3.2 * alpha + 1;
      ctx.beginPath();
      ctx.arc(sr.x, sr.y, sr.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 6. Bonus Treasure Veggie with Golden Spotlight
    if (this.bonus.active) {
      this.drawBonusVeggie(ctx, this.bonus);
    }

    // 7. 2.5D Hanging / Falling Rocks
    for (const rk of this.rocks) {
      this.drawRock25D(ctx, rk);
    }

    // 8. Coiled Pneumatic Air-Pump Hose & Brass Spearhead
    if (this.pump.active) {
      this.drawPumpHose(ctx);
    }

    // 9. Pookas & Fygars
    for (const m of this.monsters) {
      this.drawMonster25D(ctx, m);
    }

    // 10. Taizo Hori (Dig Dug)
    if (this.phase !== 'GAME_OVER') {
      this.drawDigDug25D(ctx, this.playerX * TILE, this.playerY * TILE);
    }

    ctx.restore();

    renderParticlesAndPopups(ctx, this.particles, this.popups);

    // Sleek Stage / Ready Banner
    if (this.bannerText && (this.phase === 'READY' || this.phase === 'STAGE_CLEAR')) {
      ctx.save();
      const bw = 460;
      const bh = 90;
      const bx = (WIDTH - bw) * 0.5;
      const by = HEIGHT * 0.43;
      const bg = ctx.createLinearGradient(bx, by, bx, by + bh);
      bg.addColorStop(0, 'rgba(9, 13, 24, 0.94)');
      bg.addColorStop(1, 'rgba(4, 7, 15, 0.92)');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 16);
      ctx.fill();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '800 30px "Outfit", sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(this.bannerText, WIDTH * 0.5, by + 34);
      if (this.bannerSub) {
        ctx.font = '600 14px "Outfit", sans-serif';
        ctx.fillStyle = '#7DD3FC';
        ctx.fillText(this.bannerSub, WIDTH * 0.5, by + 64);
      }
      ctx.restore();
    }

    if (visualMode === 'crt') renderCrtOverlay(ctx, WIDTH, HEIGHT);
  }

  private drawSurfaceWorld(ctx: CanvasRenderingContext2D, theme: StrataTheme): void {
    const surfaceY = TILE * 2;
    const skyGrad = ctx.createLinearGradient(0, 0, 0, surfaceY);
    skyGrad.addColorStop(0, theme.skyTop);
    skyGrad.addColorStop(0.62, theme.skyMid);
    skyGrad.addColorStop(1, theme.skyHorizon);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, WIDTH, surfaceY);

    // Warm sunlit sky orb
    const sunG = ctx.createRadialGradient(110, 34, 4, 110, 34, 48);
    sunG.addColorStop(0, 'rgba(254, 249, 195, 0.95)');
    sunG.addColorStop(0.4, 'rgba(253, 224, 71, 0.35)');
    sunG.addColorStop(1, 'rgba(253, 224, 71, 0)');
    ctx.fillStyle = sunG;
    ctx.beginPath();
    ctx.arc(110, 34, 48, 0, Math.PI * 2);
    ctx.fill();

    // Soft drifting volumetric clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
    for (let i = 0; i < 4; i++) {
      const cx = ((i * 235 + this.time * (9 + i * 2)) % (WIDTH + 140)) - 70;
      const cy = 24 + (i % 2) * 16;
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.arc(cx + 16, cy - 4, 18, 0, Math.PI * 2);
      ctx.arc(cx + 34, cy - 1, 14, 0, Math.PI * 2);
      ctx.arc(cx + 46, cy + 2, 10, 0, Math.PI * 2);
      ctx.fill();
    }

    // Rolling distant parallax hills
    ctx.fillStyle = theme.hillBack;
    ctx.beginPath();
    ctx.moveTo(0, surfaceY);
    for (let x = 0; x <= WIDTH; x += 20) {
      const hy = surfaceY - 22 - Math.sin(x * 0.011 + 1.2) * 14 - Math.cos(x * 0.023) * 6;
      ctx.lineTo(x, hy);
    }
    ctx.lineTo(WIDTH, surfaceY);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = theme.hillFront;
    ctx.beginPath();
    ctx.moveTo(0, surfaceY);
    for (let x = 0; x <= WIDTH; x += 20) {
      const hy = surfaceY - 11 - Math.sin(x * 0.017 + 2.8) * 9;
      ctx.lineTo(x, hy);
    }
    ctx.lineTo(WIDTH, surfaceY);
    ctx.closePath();
    ctx.fill();

    // Wooden mine-head timber frame above center entry shaft!
    const shaftX = 7.5 * TILE;
    ctx.fillStyle = '#78350F';
    ctx.fillRect(shaftX - 28, surfaceY - 30, 7, 30);
    ctx.fillRect(shaftX + 21, surfaceY - 30, 7, 30);
    ctx.fillStyle = '#92400E';
    ctx.beginPath();
    ctx.roundRect(shaftX - 33, surfaceY - 36, 66, 9, 3);
    ctx.fill();
    ctx.fillStyle = '#FACC15';
    ctx.fillRect(shaftX - 18, surfaceY - 33, 36, 3);

    // Authentic Namco Stage Flowers (10-round big golden blooms + single-round daisies)
    const bigFlowers = Math.floor(this.level / 10);
    const smallFlowers = this.level % 10;
    let fx = WIDTH - 32;
    for (let i = 0; i < Math.min(4, bigFlowers); i++) {
      const sway = Math.sin(this.time * 2.5 + i) * 2.5;
      ctx.strokeStyle = '#16A34A';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(fx, surfaceY - 4);
      ctx.quadraticCurveTo(fx + sway * 0.5, surfaceY - 16, fx + sway, surfaceY - 26);
      ctx.stroke();
      ctx.fillStyle = '#FACC15';
      for (let p = 0; p < 6; p++) {
        const a = (p / 6) * Math.PI * 2 + this.time * 0.4;
        ctx.beginPath();
        ctx.arc(fx + sway + Math.cos(a) * 8, surfaceY - 27 + Math.sin(a) * 8, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(fx + sway, surfaceY - 27, 4.5, 0, Math.PI * 2);
      ctx.fill();
      fx -= 32;
    }
    for (let f = 0; f < smallFlowers; f++) {
      const sway = Math.sin(this.time * 3 + f * 0.7) * 2;
      ctx.strokeStyle = '#16A34A';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(fx, surfaceY - 4);
      ctx.quadraticCurveTo(fx + sway * 0.5, surfaceY - 12, fx + sway, surfaceY - 20);
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(fx + sway + Math.cos(a) * 5.8, surfaceY - 20 + Math.sin(a) * 5.8, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(fx + sway, surfaceY - 20, 3.3, 0, Math.PI * 2);
      ctx.fill();
      fx -= 24;
    }

    // Top-left subtle round HUD badge
    ctx.fillStyle = 'rgba(7, 12, 24, 0.52)';
    ctx.beginPath();
    ctx.roundRect(14, 12, 232, 34, 10);
    ctx.fill();
    ctx.font = '700 13px "Outfit", sans-serif';
    ctx.fillStyle = '#F8FAFC';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`ROUND ${this.level} · ${theme.name.toUpperCase()}`, 26, 29);
  }

  private drawCavernBackwall(ctx: CanvasRenderingContext2D, theme: StrataTheme): void {
    const startY = TILE * 2;
    ctx.fillStyle = theme.cavityBg;
    ctx.fillRect(0, startY, WIDTH, HEIGHT - startY);

    // Subtle dark rocky depth strata behind dug tunnels
    for (let band = 0; band < 4; band++) {
      const y0 = startY + band * (HEIGHT - startY) * 0.25;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.032 - band * 0.005})`;
      ctx.fillRect(0, y0, WIDTH, (HEIGHT - startY) * 0.25);
    }

    // Buried decorative fossils & subterranean crystal shards revealed as you dig!
    ctx.save();
    for (const f of this.fossils) {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);
      ctx.scale(f.scale, f.scale);
      if (f.kind === 'ammonite') {
        ctx.strokeStyle = 'rgba(214, 194, 165, 0.16)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let a = 0; a < Math.PI * 4.5; a += 0.3) {
          const rad = a * 1.15;
          const px = Math.cos(a) * rad;
          const py = Math.sin(a) * rad;
          if (a === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      } else if (f.kind === 'bone') {
        ctx.fillStyle = 'rgba(226, 232, 240, 0.13)';
        ctx.fillRect(-12, -2.5, 24, 5);
        ctx.beginPath();
        ctx.arc(-13, -3, 3.8, 0, Math.PI * 2);
        ctx.arc(-13, 3, 3.8, 0, Math.PI * 2);
        ctx.arc(13, -3, 3.8, 0, Math.PI * 2);
        ctx.arc(13, 3, 3.8, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(6, 0);
        ctx.lineTo(0, 10);
        ctx.lineTo(-6, 0);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  private drawStratifiedEarth(ctx: CanvasRenderingContext2D, theme: StrataTheme): void {
    // Pass 1: Recessed drop-shadow cast by solid earth onto dug tunnels below/right
    ctx.fillStyle = 'rgba(0, 0, 0, 0.44)';
    for (let sr = 2 * SUB; sr < SUB_ROWS; sr++) {
      for (let sc = 0; sc < SUB_COLS; sc++) {
        if (this.subDirt[sr][sc]) continue;
        const x = sc * SUB_SIZE;
        const y = sr * SUB_SIZE;
        if (sr > 2 * SUB && this.subDirt[sr - 1][sc]) {
          ctx.fillRect(x, y, SUB_SIZE, 6);
        }
        if (sc > 0 && this.subDirt[sr][sc - 1]) {
          ctx.fillRect(x, y, 5, SUB_SIZE);
        }
      }
    }

    // Pass 2: 2.5D Stratified Soil Sub-Cells with beveled cliff rims & rich mineral texture
    for (let sr = 2 * SUB; sr < SUB_ROWS; sr++) {
      const tileRow = Math.floor(sr / SUB);
      const band = this.getDepthLayer(tileRow);
      for (let sc = 0; sc < SUB_COLS; sc++) {
        if (!this.subDirt[sr][sc]) continue;
        const x = sc * SUB_SIZE;
        const y = sr * SUB_SIZE;

        ctx.fillStyle = theme.bands[band];
        ctx.fillRect(x, y, SUB_SIZE + 0.5, SUB_SIZE + 0.5);

        // Organic 2.5D bevel edges wherever earth meets a carved tunnel
        const openUp = sr > 2 * SUB && !this.subDirt[sr - 1][sc];
        const openDown = sr < SUB_ROWS - 1 && !this.subDirt[sr + 1][sc];
        const openLeft = sc > 0 && !this.subDirt[sr][sc - 1];
        const openRight = sc < SUB_COLS - 1 && !this.subDirt[sr][sc + 1];

        if (openDown) {
          ctx.fillStyle = theme.bandDark[band];
          ctx.fillRect(x, y + SUB_SIZE - 5, SUB_SIZE + 0.5, 5.5);
        }
        if (openUp) {
          ctx.fillStyle = theme.bandLight[band];
          ctx.fillRect(x, y, SUB_SIZE + 0.5, 3.5);
        }
        if (openLeft) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
          ctx.fillRect(x, y, 3, SUB_SIZE);
        }
        if (openRight) {
          ctx.fillStyle = theme.bandDark[band];
          ctx.fillRect(x + SUB_SIZE - 3.5, y, 4, SUB_SIZE);
        }

        // Deterministic pebbles & layered sedimentary texture
        const h = (sr * 31 + sc * 67) & 63;
        if (h < 14) {
          ctx.fillStyle = theme.bandLight[band];
          ctx.globalAlpha = 0.42;
          ctx.beginPath();
          ctx.roundRect(x + (h % 9) + 2, y + ((h >> 1) % 8) + 3, 6, 3.5, 1.5);
          ctx.fill();
          ctx.globalAlpha = 1;
        } else if (h > 50) {
          ctx.fillStyle = theme.bandDark[band];
          ctx.globalAlpha = 0.45;
          ctx.fillRect(x + (h % 8) + 3, y + ((h >> 2) % 9) + 3, 5, 3);
          ctx.globalAlpha = 1;
        }
      }
    }

    // Subtle depth-band strata divider lines with point-value tags on far left edge
    const bandRows = [2, 6, 9, 13];
    const bandPts = ['200', '300', '400', '500'];
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    for (let i = 0; i < 4; i++) {
      const y = bandRows[i] * TILE;
      if (i > 0) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
        ctx.fillRect(0, y - 1, WIDTH, 2.5);
      }
      ctx.fillStyle = 'rgba(255, 255, 255, 0.34)';
      ctx.fillText(bandPts[i], 6, y + 6);
    }
  }

  private drawGrassLip(ctx: CanvasRenderingContext2D, theme: StrataTheme): void {
    const y = TILE * 2;
    const grassGrad = ctx.createLinearGradient(0, y - 9, 0, y + 7);
    grassGrad.addColorStop(0, theme.grassTop);
    grassGrad.addColorStop(0.55, theme.grassMid);
    grassGrad.addColorStop(1, theme.grassDark);
    ctx.fillStyle = grassGrad;

    // Draw grass turf everywhere except the open center entry shaft
    for (let sc = 0; sc < SUB_COLS; sc++) {
      if (!this.subDirt[2 * SUB][sc]) continue;
      const x = sc * SUB_SIZE;
      ctx.beginPath();
      ctx.roundRect(x - 1, y - 8, SUB_SIZE + 2, 14, 4);
      ctx.fill();
    }
  }

  private drawPumpHose(ctx: CanvasRenderingContext2D): void {
    const v = VEC[this.pump.dir];
    const sx = this.playerX * TILE;
    const sy = this.playerY * TILE;
    const ex = sx + v.x * this.pump.length * TILE;
    const ey = sy + v.y * this.pump.length * TILE;

    ctx.save();
    // Dark hose outline + gleaming coiled pneumatic cable
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 7.5;
    ctx.beginPath();
    const segs = 14;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const wob =
        i === 0 || i === segs
          ? 0
          : Math.sin(t * Math.PI * 7 + this.time * 26) * (2.6 + this.pump.pumpPulse * 2.5);
      const px = sx + (ex - sx) * t + -v.y * wob;
      const py = sy + (ey - sy) * t + v.x * wob;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    ctx.strokeStyle = this.pump.pumpPulse > 0.2 ? '#7DD3FC' : '#E2E8F0';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Glowing cyan pressurized spearhead tip
    ctx.translate(ex, ey);
    ctx.rotate(Math.atan2(v.y, v.x));
    ctx.fillStyle = '#38BDF8';
    ctx.shadowColor = '#38BDF8';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(13, 0);
    ctx.lineTo(-4, -7.5);
    ctx.lineTo(0, 0);
    ctx.lineTo(-4, 7.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(0, -3);
    ctx.lineTo(0, 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawDigDug25D(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const stride = Math.sin(this.playerAnim);
    const bounce = Math.abs(stride) * 2.5;
    const pumpSquash = this.pumpAnim * 0.14;

    ctx.save();
    ctx.translate(x, y - bounce);
    if (this.playerDir === 'LEFT') ctx.scale(-1, 1);
    ctx.scale(1 + pumpSquash, 1 - pumpSquash * 0.7);

    // Soft ambient tunnel contact shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    ctx.beginPath();
    ctx.ellipse(0, 19 + bounce, 15, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pressurized Red Air-Pump Tank Backpack with gauge
    const packG = ctx.createLinearGradient(-20, -8, -11, 12);
    packG.addColorStop(0, '#FCA5A5');
    packG.addColorStop(0.4, '#EF4444');
    packG.addColorStop(1, '#991B1B');
    ctx.fillStyle = packG;
    ctx.beginPath();
    ctx.roundRect(-20, -7, 9.5, 19, 4);
    ctx.fill();
    ctx.fillStyle = '#FACC15';
    ctx.fillRect(-18, -10, 5.5, 3.5);

    // Animated blue spacesuit boots
    ctx.fillStyle = '#1D4ED8';
    ctx.beginPath();
    ctx.roundRect(-10 + stride * 5, 11, 9.5, 8, 3.5);
    ctx.roundRect(1 - stride * 5, 11, 9.5, 8, 3.5);
    ctx.fill();

    // 3D-shaded iconic white spacesuit torso with azure chest stripe
    const suitG = ctx.createLinearGradient(-13, -4, 13, 14);
    suitG.addColorStop(0, '#FFFFFF');
    suitG.addColorStop(0.6, '#E2E8F0');
    suitG.addColorStop(1, '#94A3B8');
    ctx.fillStyle = suitG;
    ctx.beginPath();
    ctx.roundRect(-13.5, -3, 27, 17, 8);
    ctx.fill();
    ctx.fillStyle = '#0284C7';
    ctx.fillRect(-12.5, 4, 25, 4.5);

    // Classic Taizo Hori glossy cobalt helmet with specular highlight
    const helmG = ctx.createRadialGradient(-4, -14, 2, 0, -8, 16.5);
    helmG.addColorStop(0, '#7DD3FC');
    helmG.addColorStop(0.45, '#0284C7');
    helmG.addColorStop(1, '#075985');
    ctx.fillStyle = helmG;
    ctx.beginPath();
    ctx.arc(0, -8, 14.5, 0, Math.PI * 2);
    ctx.fill();

    // White padded visor rim
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(-2.5, -16, 15.5, 14.5, 7);
    ctx.fill();

    // Expressive face & blinking eyes
    ctx.fillStyle = '#FDBA74';
    ctx.beginPath();
    ctx.roundRect(1, -14, 11, 11, 4.5);
    ctx.fill();
    const blink = Math.sin(this.time * 2.6) > 0.96;
    ctx.fillStyle = '#0F172A';
    if (!blink) {
      ctx.beginPath();
      ctx.ellipse(8.2, -9.5, 1.8, 2.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(8.5, -11.2, 1.2, 1.4);
    } else {
      ctx.fillRect(6.5, -9.5, 3.5, 1.4);
    }

    // Active digging shovel / drill tip OR handheld red air-pump handle
    if (this.playerDigging) {
      ctx.save();
      ctx.translate(12, 3);
      ctx.rotate(Math.sin(this.time * 32) * 0.45);
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(0, -7);
      ctx.lineTo(0, 7);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#92400E';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.roundRect(9, 1, 9, 5.5, 2.5);
      ctx.fill();
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(15, 2.2, 4, 3);
    }

    ctx.restore();
  }

  private drawMonster25D(ctx: CanvasRenderingContext2D, m: Monster): void {
    const x = m.x * TILE;
    const y = m.y * TILE;
    const bounceImpulse = m.inflateBounce * 0.16;
    const scaleX = 1 + m.inflate * 0.3 + bounceImpulse;
    const scaleY = 1 + m.inflate * 0.3 - bounceImpulse * 0.5;
    const wobble = m.inflate > 0 ? Math.sin(this.time * 36) * m.inflate * 1.7 : 0;

    ctx.save();
    ctx.translate(x + wobble, y);

    // Flattened cartoon pancake if currently being crushed under a falling rock!
    if (m.crushedByRockId !== null) {
      ctx.scale(1.35, 0.36);
    }

    if (m.ghostMode) {
      // Shimmering translucent spectral orb + glowing tracking eyes phasing through dirt
      const hover = Math.sin(this.time * 8 + m.id) * 3;
      ctx.translate(0, hover);
      const aura = ctx.createRadialGradient(0, 0, 2, 0, 0, 24);
      aura.addColorStop(0, 'rgba(224, 242, 254, 0.55)');
      aura.addColorStop(0.6, 'rgba(125, 211, 252, 0.22)');
      aura.addColorStop(1, 'rgba(125, 211, 252, 0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(-6.5, -1, 6, 7.2, 0, 0, Math.PI * 2);
      ctx.ellipse(6.5, -1, 6, 7.2, 0, 0, Math.PI * 2);
      ctx.fill();
      const lookX = Math.sign(this.playerX - m.x) * 1.8;
      const lookY = Math.sign(this.playerY - m.y) * 1.4;
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(-6.5 + lookX, -1 + lookY, 2.8, 0, Math.PI * 2);
      ctx.arc(6.5 + lookX, -1 + lookY, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    // Fygar volumetric plasma fire breath
    if (m.kind === 'fygar' && m.flameTimer > 0) {
      const fDir = m.dir === 'LEFT' ? -1 : 1;
      const flicker = Math.sin(this.time * 48) * 6;
      const len = TILE * 2.55;

      // Ambient fiery glow lighting up nearby tunnel
      const glow = ctx.createRadialGradient(fDir * len * 0.45, 0, 8, fDir * len * 0.45, 0, len * 0.72);
      glow.addColorStop(0, 'rgba(251, 146, 60, 0.48)');
      glow.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(fDir * len * 0.45, 0, len * 0.72, 0, Math.PI * 2);
      ctx.fill();

      const grad = ctx.createLinearGradient(fDir * 14, 0, fDir * len, 0);
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(0.22, '#FEF08A');
      grad.addColorStop(0.55, '#F97316');
      grad.addColorStop(0.85, '#EF4444');
      grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(fDir * 15, -8);
      ctx.quadraticCurveTo(fDir * len * 0.55, -22 + flicker, fDir * len, -15 - flicker * 0.5);
      ctx.lineTo(fDir * len, 15 + flicker * 0.5);
      ctx.quadraticCurveTo(fDir * len * 0.55, 22 - flicker, fDir * 15, 8);
      ctx.closePath();
      ctx.fill();
    }

    // Fygar inhale charge glow warning!
    if (m.kind === 'fygar' && m.flameCharge > 0) {
      const fDir = m.dir === 'LEFT' ? -1 : 1;
      const p = 1 - m.flameCharge / 0.36;
      const cg = ctx.createRadialGradient(fDir * 14, -1, 1, fDir * 14, -1, 18 * p + 6);
      cg.addColorStop(0, '#FFFFFF');
      cg.addColorStop(0.5, '#FACC15');
      cg.addColorStop(1, 'rgba(249, 115, 22, 0)');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(fDir * 14, -1, 18 * p + 6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.scale(scaleX, scaleY);

    if (m.kind === 'pooka') {
      // Contact shadow
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.beginPath();
      ctx.ellipse(0, 17, 13, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Kicking yellow feet
      const stride = Math.sin(m.anim + m.id) * 4;
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.ellipse(-7 + stride * 0.5, 15, 6, 3.6, 0, 0, Math.PI * 2);
      ctx.ellipse(7 - stride * 0.5, 15, 6, 3.6, 0, 0, Math.PI * 2);
      ctx.fill();

      // 3D glossy spherical crimson body (flushes taut pink-red at high inflation!)
      const pg = ctx.createRadialGradient(-6, -7, 2, 0, 0, 19);
      pg.addColorStop(0, m.inflate >= 3 ? '#FFE4E6' : '#FCA5A5');
      pg.addColorStop(0.35, m.inflate >= 3 ? '#FB7185' : '#EF4444');
      pg.addColorStop(1, '#881337');
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(0, 0, 17, 0, Math.PI * 2);
      ctx.fill();

      // Iconic yellow ski goggles with tracking pupils
      ctx.fillStyle = '#CA8A04';
      ctx.fillRect(-16.5, -5.5, 33, 4.5);
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.roundRect(-14.5, -9.5, 29, 12.5, 6);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-5.6, -3.2, 4.6, 0, Math.PI * 2);
      ctx.arc(5.6, -3.2, 4.6, 0, Math.PI * 2);
      ctx.fill();

      const lx = Math.sign(this.playerX - m.x) * 1.4;
      const ly = Math.sign(this.playerY - m.y) * 1.0;
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(-5.6 + lx, -3.2 + ly, 2.2, 0, Math.PI * 2);
      ctx.arc(5.6 + lx, -3.2 + ly, 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Emerald 2.5D Fire-Breathing Fygar Dragon
      if (m.dir === 'LEFT') ctx.scale(-1, 1);
      const wingFlap = Math.sin(this.time * (m.flameCharge > 0 ? 34 : 18) + m.id) * 5.5;

      // Ground shadow
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.beginPath();
      ctx.ellipse(0, 16, 16, 4.8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Crimson dragon wings (flare rapidly during fire charge!)
      const wg = ctx.createLinearGradient(-26, -16, -8, 6);
      wg.addColorStop(0, '#FB7185');
      wg.addColorStop(1, '#B91C1C');
      ctx.fillStyle = wg;
      ctx.beginPath();
      ctx.moveTo(-10, -4);
      ctx.lineTo(-27, -17 + wingFlap);
      ctx.lineTo(-20, 3 + wingFlap * 0.5);
      ctx.lineTo(-8, 5);
      ctx.closePath();
      ctx.fill();

      // 3D emerald dragon body & golden belly scales
      const fg = ctx.createRadialGradient(-4, -6, 2, 0, 0, 20);
      fg.addColorStop(0, m.flameCharge > 0 ? '#FEF08A' : '#86EFAC');
      fg.addColorStop(0.45, m.inflate >= 3 ? '#4ADE80' : '#16A34A');
      fg.addColorStop(1, '#14532D');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.roundRect(-16, -14, 34, 28, 10);
      ctx.fill();

      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.ellipse(3, 7, 12, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Crimson dorsal crest spikes
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.moveTo(-13, -14);
      ctx.lineTo(-9, -21);
      ctx.lineTo(-4, -14);
      ctx.lineTo(0, -20);
      ctx.lineTo(5, -14);
      ctx.closePath();
      ctx.fill();

      // Fierce dragon eye & nostrils
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(8, -5.5, 4.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(9.5, -5.5, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#14532D';
      ctx.beginPath();
      ctx.arc(15, -1, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Panic sweat drops when inflated or fleeing!
    if (m.inflate >= 2) {
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(15, -14, 3.2, 0, Math.PI * 2);
      ctx.arc(-15, -12, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Fleeing last-monster panic marker ("!")
    if (m.fleeing && m.crushedByRockId === null) {
      ctx.save();
      ctx.font = '900 18px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = Math.floor(this.time * 10) % 2 === 0 ? '#FEF08A' : '#EF4444';
      ctx.fillText('!', x, y - 26 - Math.abs(Math.sin(this.time * 12)) * 4);
      ctx.restore();
    }
  }

  private drawRock25D(ctx: CanvasRenderingContext2D, rk: Rock): void {
    const shake = rk.state === 'wobble' ? Math.sin(this.time * 62) * 5 : 0;
    const x = rk.x * TILE + shake;
    const y = rk.y * TILE;

    ctx.save();
    ctx.translate(x, y);
    if (rk.state === 'shatter') ctx.globalAlpha = Math.max(0, rk.timer * 1.9);

    // Falling motion blur streak
    if (rk.state === 'falling') {
      const trail = ctx.createLinearGradient(0, -48, 0, 0);
      trail.addColorStop(0, 'rgba(203, 213, 225, 0)');
      trail.addColorStop(1, 'rgba(203, 213, 225, 0.35)');
      ctx.fillStyle = trail;
      ctx.fillRect(-19, -48, 38, 48);
    }

    // Shadow underneath boulder
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 21, 20, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sculpted 3D craggy granite boulder
    const grad = ctx.createRadialGradient(-9, -10, 3, 0, 0, 26);
    grad.addColorStop(0, '#F8FAFC');
    grad.addColorStop(0.4, '#CBD5E1');
    grad.addColorStop(0.75, '#64748B');
    grad.addColorStop(1, '#1E293B');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(-23, -22, 46, 44, 16);
    ctx.fill();

    // Lush emerald moss patch on top crown
    ctx.fillStyle = 'rgba(74, 222, 128, 0.45)';
    ctx.beginPath();
    ctx.ellipse(-9, -15, 10, 4.2, -0.22, 0, Math.PI * 2);
    ctx.fill();

    // Deep geological fissure cracks
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-10, -13);
    ctx.lineTo(2, 0);
    ctx.lineTo(-5, 13);
    ctx.moveTo(2, 0);
    ctx.lineTo(14, 5);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(-23, -22, 46, 44, 16);
    ctx.stroke();
    ctx.restore();
  }

  private drawBonusVeggie(ctx: CanvasRenderingContext2D, b: BonusVeggie): void {
    const x = b.x * TILE;
    const y = b.y * TILE + Math.sin(this.time * 6) * 3.5;

    ctx.save();
    ctx.translate(x, y);

    // Golden treasure aura
    const aura = ctx.createRadialGradient(0, 0, 3, 0, 0, 32);
    aura.addColorStop(0, b.color + '88');
    aura.addColorStop(1, b.color + '00');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, 32, 0, Math.PI * 2);
    ctx.fill();

    if (b.kind === 'carrot') {
      ctx.fillStyle = '#F97316';
      ctx.beginPath();
      ctx.moveTo(-9, -6);
      ctx.lineTo(9, -6);
      ctx.lineTo(0, 18);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#22C55E';
      ctx.beginPath();
      ctx.ellipse(-5, -11, 6, 3.5, -0.5, 0, Math.PI * 2);
      ctx.ellipse(5, -11, 6, 3.5, 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.kind === 'galaxian') {
      // Iconic Namco Galaxian Flagship cameo!
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.moveTo(0, -15);
      ctx.lineTo(15, 6);
      ctx.lineTo(6, 12);
      ctx.lineTo(0, 4);
      ctx.lineTo(-6, 12);
      ctx.lineTo(-15, 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(-10, -2, 20, 5);
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(0, -3, 4.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Sculpted glowing produce orb + leafy crown
      const vg = ctx.createRadialGradient(-4, -3, 2, 0, 2, 16);
      vg.addColorStop(0, '#FFFFFF');
      vg.addColorStop(0.35, b.color);
      vg.addColorStop(1, '#1E293B');
      ctx.fillStyle = vg;
      ctx.beginPath();
      ctx.arc(0, 2, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#22C55E';
      ctx.beginPath();
      ctx.ellipse(-5, -13, 6.5, 3.5, -0.4, 0, Math.PI * 2);
      ctx.ellipse(5, -13, 6.5, 3.5, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    drawStarGlint(ctx, 11, -11, 7, '#FFFFFF', this.time * 5);
    ctx.restore();
  }
}

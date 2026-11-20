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

export type PuzzleBobbleVariant = 'puzzlebobble' | 'puzzlebobble2' | 'puzzlebobble3';

type OrbColor = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type OrbSpecial = 'normal' | 'star' | 'iron' | 'fairy' | 'rainbow' | 'bomb' | 'lightning' | 'prism';

interface GridOrb {
  color: OrbColor;
  special: OrbSpecial;
  armor: number; // 1 for frosted/prism armored shell in PB3 Evo
  // 2.5D spring & shimmer animation state
  jiggleX: number;
  jiggleY: number;
  vx: number;
  vy: number;
  scaleX: number;
  scaleY: number;
  shimmerSeed: number;
  bornTime: number;
}

interface ActiveShot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: OrbColor;
  special: OrbSpecial;
  squashX: number;
  squashY: number;
  trail: Array<{ x: number; y: number; life: number }>;
  banks: number;
}

interface FallingOrb {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  color: OrbColor;
  special: OrbSpecial;
  bounced: boolean;
  life: number;
}

interface PoppingOrb {
  x: number;
  y: number;
  color: OrbColor;
  special: OrbSpecial;
  age: number;
  duration: number;
  delay: number;
}

interface LightningBeam {
  y: number;
  life: number;
  maxLife: number;
  color: string;
}

interface ShockRing {
  x: number;
  y: number;
  maxR: number;
  life: number;
  maxLife: number;
  color: string;
}

interface RescuedFairy {
  x: number;
  y: number;
  t: number;
  hue: number;
}

interface ReloadArc {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: OrbColor;
  special: OrbSpecial;
  t: number;
  duration: number;
}

interface StageTheme {
  name: string;
  skyTop: string;
  skyMid: string;
  skyBot: string;
  hillBack: string;
  hillFront: string;
  frameOuter: string;
  frameInner: string;
  frameTrim: string;
  wellBgTop: string;
  wellBgBot: string;
  accent: string;
  starlight: boolean;
}

interface StageBlueprint {
  name: string;
  themeIdx: number;
  rows: string[];
  shotsPerDrop: number;
  isBoss?: boolean;
}

interface ColorStyle {
  name: string;
  light: string;
  mid: string;
  dark: string;
  rim: string;
  iconBg: string;
  spark: string;
}

// 7 signature jewel-bright Taito Puzzle Bobble colors with rich 2.5D shading
const ORB_PALETTE: ColorStyle[] = [
  {
    name: 'Ruby',
    light: '#FF9EAA',
    mid: '#EF4444',
    dark: '#991B1B',
    rim: '#FECACA',
    iconBg: '#FFF1F2',
    spark: '#FCA5A5',
  },
  {
    name: 'Sapphire',
    light: '#93E5FF',
    mid: '#2563EB',
    dark: '#1E3A8A',
    rim: '#BAE6FD',
    iconBg: '#EFF6FF',
    spark: '#7DD3FC',
  },
  {
    name: 'Emerald',
    light: '#9BF8B6',
    mid: '#16A34A',
    dark: '#14532D',
    rim: '#BBF7D0',
    iconBg: '#F0FDF4',
    spark: '#86EFAC',
  },
  {
    name: 'Sunbeam',
    light: '#FEF08A',
    mid: '#F59E0B',
    dark: '#92400E',
    rim: '#FEF9C3',
    iconBg: '#FFFBEB',
    spark: '#FDE047',
  },
  {
    name: 'Amethyst',
    light: '#E9B5FF',
    mid: '#9333EA',
    dark: '#4C1D95',
    rim: '#F3E8FF',
    iconBg: '#FAF5FF',
    spark: '#D8B4FE',
  },
  {
    name: 'Tangerine',
    light: '#FFD19A',
    mid: '#F97316',
    dark: '#9A3412',
    rim: '#FFEDD5',
    iconBg: '#FFF7ED',
    spark: '#FDBA74',
  },
  {
    name: 'Sakura',
    light: '#FFC2E2',
    mid: '#EC4899',
    dark: '#831843',
    rim: '#FCE7F3',
    iconBg: '#FDF2F8',
    spark: '#F9A8D4',
  },
];

const STAGE_THEMES: StageTheme[] = [
  {
    name: 'Sunny Meadow',
    skyTop: '#38BDF8',
    skyMid: '#7DD3FC',
    skyBot: '#FEF3C7',
    hillBack: '#4ADE80',
    hillFront: '#16A34A',
    frameOuter: '#B45309',
    frameInner: '#F59E0B',
    frameTrim: '#FEF08A',
    wellBgTop: 'rgba(15, 36, 72, 0.84)',
    wellBgBot: 'rgba(30, 58, 110, 0.78)',
    accent: '#34D399',
    starlight: false,
  },
  {
    name: 'Candy Cloud Spire',
    skyTop: '#818CF8',
    skyMid: '#C084FC',
    skyBot: '#FBCFE8',
    hillBack: '#F472B6',
    hillFront: '#DB2777',
    frameOuter: '#7E22CE',
    frameInner: '#C084FC',
    frameTrim: '#FDE68A',
    wellBgTop: 'rgba(36, 17, 68, 0.86)',
    wellBgBot: 'rgba(67, 25, 98, 0.80)',
    accent: '#F472B6',
    starlight: true,
  },
  {
    name: 'Starlight Forest',
    skyTop: '#0F172A',
    skyMid: '#1E3A8A',
    skyBot: '#312E81',
    hillBack: '#0D9488',
    hillFront: '#115E59',
    frameOuter: '#1D4ED8',
    frameInner: '#38BDF8',
    frameTrim: '#E0F2FE',
    wellBgTop: 'rgba(8, 18, 42, 0.90)',
    wellBgBot: 'rgba(19, 36, 74, 0.84)',
    accent: '#38BDF8',
    starlight: true,
  },
  {
    name: 'Sunset Harbor',
    skyTop: '#7C2D12',
    skyMid: '#EA580C',
    skyBot: '#FDE047',
    hillBack: '#C2410C',
    hillFront: '#7C2D12',
    frameOuter: '#9A3412',
    frameInner: '#FB923C',
    frameTrim: '#FEF08A',
    wellBgTop: 'rgba(42, 16, 14, 0.87)',
    wellBgBot: 'rgba(72, 26, 22, 0.82)',
    accent: '#FB923C',
    starlight: false,
  },
  {
    name: 'Aurora Crystal Peaks',
    skyTop: '#042F2E',
    skyMid: '#0F766E',
    skyBot: '#38BDF8',
    hillBack: '#0284C7',
    hillFront: '#0369A1',
    frameOuter: '#0F766E',
    frameInner: '#2DD4BF',
    frameTrim: '#CCFBF1',
    wellBgTop: 'rgba(6, 29, 44, 0.88)',
    wellBgBot: 'rgba(12, 54, 72, 0.82)',
    accent: '#2DD4BF',
    starlight: true,
  },
  {
    name: 'Royal Prism Sanctum',
    skyTop: '#1E1B4B',
    skyMid: '#581C87',
    skyBot: '#EC4899',
    hillBack: '#7E22CE',
    hillFront: '#4C1D95',
    frameOuter: '#A16207',
    frameInner: '#FACC15',
    frameTrim: '#FEF9C3',
    wellBgTop: 'rgba(22, 10, 48, 0.90)',
    wellBgBot: 'rgba(48, 16, 82, 0.84)',
    accent: '#FACC15',
    starlight: true,
  },
];

// Legend for handcrafted blueprints:
// 0..6 = OrbColor (Red, Blue, Green, Yellow, Purple, Orange, Pink)
// S = Star Orb, I = Iron Metal Orb, F = Fairy/Chack'n Rescue Core
// W = Rainbow Wildcard, B = Bomb Orb, L = Lightning Orb
// P = Prism Armored Red, Q = Prism Armored Blue, G = Prism Armored Green, Y = Prism Armored Yellow
// . = Empty

const PB1_STAGES: StageBlueprint[] = [
  {
    name: 'Sunny Meadow Arch',
    themeIdx: 0,
    shotsPerDrop: 8,
    rows: [
      '00112233',
      '0011223',
      '11223300',
      '1122330',
      '..0033..',
    ],
  },
  {
    name: 'Twin Bell Towers',
    themeIdx: 1,
    shotsPerDrop: 8,
    rows: [
      '001..223',
      '011..23',
      '114..422',
      '440..34',
      '400..334',
      '.0....3',
    ],
  },
  {
    name: 'Rainbow Cascade',
    themeIdx: 2,
    shotsPerDrop: 7,
    rows: [
      '01234012',
      '0123401',
      '12340123',
      '1234012',
      '23401234',
    ],
  },
  {
    name: 'Dragon Heart Vault',
    themeIdx: 3,
    shotsPerDrop: 7,
    rows: [
      '.00..00.',
      '0660660',
      '06333360',
      '.634436',
      '..0330..',
      '...00..',
    ],
  },
  {
    name: 'Checker Fortress',
    themeIdx: 4,
    shotsPerDrop: 7,
    rows: [
      '12121212',
      '2323232',
      '34343434',
      '4545454',
      '.505050.',
      '..0101.',
    ],
  },
  {
    name: 'Grand Bubble Crown',
    themeIdx: 5,
    shotsPerDrop: 6,
    rows: [
      '3.3333.3',
      '3034430',
      '00144100',
      '1125521',
      '22655622',
      '.66..66',
    ],
  },
];

const PB2_STAGES: StageBlueprint[] = [
  {
    name: 'Starlight Opening',
    themeIdx: 1,
    shotsPerDrop: 8,
    rows: [
      '00112233',
      '0S122S3',
      '11223300',
      '.144441',
      '..4444..',
    ],
  },
  {
    name: 'Chack’n Fairy Spire',
    themeIdx: 0,
    shotsPerDrop: 8,
    rows: [
      '..1122..',
      '.133322',
      '130F0242',
      '.300042',
      '..3442..',
    ],
  },
  {
    name: 'Iron Bell Citadel',
    themeIdx: 3,
    shotsPerDrop: 7,
    rows: [
      '00I11I22',
      '00I11I2',
      '334II455',
      '344SS45',
      '.33..55.',
    ],
  },
  {
    name: 'Twin Fairy Sanctuary',
    themeIdx: 2,
    shotsPerDrop: 7,
    rows: [
      '112..211',
      '1F2..2F',
      '44S..S44',
      '4003300',
      '.033330.',
    ],
  },
  {
    name: 'Starburst Carousel',
    themeIdx: 4,
    shotsPerDrop: 7,
    rows: [
      '60123456',
      '6S123S5',
      '01I33I45',
      '0124425',
      '.12SS24.',
      '..2332.',
    ],
  },
  {
    name: 'Chack’n Sky Palace',
    themeIdx: 5,
    shotsPerDrop: 6,
    rows: [
      'I334433I',
      '3004403',
      '001FF100',
      '11S55S1',
      '22566522',
      '.26II62',
    ],
  },
];

const PB3_STAGES: StageBlueprint[] = [
  {
    name: 'Prism Meadow Awakening',
    themeIdx: 0,
    shotsPerDrop: 8,
    rows: [
      '00112233',
      '0W122W3',
      '11PQGY22',
      '.123412',
      '..3443..',
    ],
  },
  {
    name: 'Lightning Arcade Deck',
    themeIdx: 2,
    shotsPerDrop: 8,
    rows: [
      '44111144',
      '4Q1LL1Q',
      '22333322',
      '2G3BB3G',
      '.005500.',
    ],
  },
  {
    name: 'Pulley Scale Gardens',
    themeIdx: 1,
    shotsPerDrop: 7,
    rows: [
      '660..335',
      '6P0..3Y',
      '00W..W55',
      '114..42',
      '1B4..4B2',
      '.1....2',
    ],
  },
  {
    name: 'Star & Bomb Vault',
    themeIdx: 3,
    shotsPerDrop: 7,
    rows: [
      'I001122I',
      '0P1BB2G',
      '012SS345',
      '123LL45',
      '.234432.',
    ],
  },
  {
    name: 'Aurora Prism Mirror',
    themeIdx: 4,
    shotsPerDrop: 7,
    rows: [
      '12344321',
      'Q2W44W2',
      '345II543',
      '45L00L5',
      '560BB065',
      '.601106',
    ],
  },
  {
    name: 'Crystal Core Boss Sanctum',
    themeIdx: 5,
    shotsPerDrop: 7,
    isBoss: true,
    rows: [
      'I334433I',
      '3PQWWGY',
      '001LL100',
      '11B22B1',
      '225SS522',
      '.56..65',
    ],
  },
];

const WELL_X = 132;
const WELL_W = 336;
const WELL_RIGHT = WELL_X + WELL_W;
const WELL_TOP = 86;
const BUBBLE_R = 21;
const BUBBLE_D = BUBBLE_R * 2;
const ROW_H = 36;
const GRID_COLS = 8;
const MAX_ROWS = 14;
const DEADLINE_Y = 582;
const LAUNCHER_X = 300;
const LAUNCHER_Y = 636;
const SHOT_SPEED = 840;
const HURRY_LIMIT = 11.5;

export class PuzzleBobbleGame implements ArcadeGameInstance {
  public readonly logicalWidth = 600;
  public readonly logicalHeight = 760;
  public readonly supportsPointerAim = true;
  public readonly primaryActionLabel = 'Launch';
  public readonly secondaryActionLabel?: string;

  private readonly variant: PuzzleBobbleVariant;
  private readonly storageKey: string;
  private readonly blueprints: StageBlueprint[];

  private phase: ClassicGamePhase = 'TITLE';
  private score = 0;
  private highScore = 0;
  private level = 1;
  private lives = 3;
  private clock = 0;
  private phaseTimer = 0;

  private input: ArcadeInputState = createEmptyInput();
  private lastPointerX = 0.5;
  private lastPointerY = 0.5;

  // Hex grid
  private grid: Array<Array<GridOrb | null>> = [];
  private rowParity = 0;
  private ceilingDropPx = 0;
  private targetCeilingDropPx = 0;
  private shotsSinceDrop = 0;
  private shotsPerDrop = 8;
  private compressorShake = 0;

  // Launcher & orbs
  private aimAngle = -Math.PI / 2;
  private crankAngle = 0;
  private currentOrb: { color: OrbColor; special: OrbSpecial } = { color: 0, special: 'normal' };
  private nextOrb: { color: OrbColor; special: OrbSpecial } = { color: 1, special: 'normal' };
  private activeShot: ActiveShot | null = null;
  private reloadArc: ReloadArc | null = null;
  private shotTimer = 0;
  private swapAnim = 0;
  private fireCooldown = 0;

  // Combo, Fever & Evolution mechanics
  private comboStreak = 0;
  private feverGauge = 0; // 0..100 in PB3 Evo
  private feverTimer = 0;
  private leftScaleWeight = 0;
  private rightScaleWeight = 0;
  private scaleTilt = 0; // -1..1
  private scaleTiltVel = 0;

  // PB3 Stage 6 Crystal Boss Core
  private bossActive = false;
  private bossHp = 0;
  private bossMaxHp = 8;
  private bossHitFlash = 0;

  // Characters & visual effects
  private dragonMood: 'idle' | 'cheer' | 'panic' | 'victory' = 'idle';
  private dragonMoodTimer = 0;
  private wallFlashLeft = 0;
  private wallFlashRight = 0;
  private screenShake = 0;

  private fallingOrbs: FallingOrb[] = [];
  private poppingOrbs: PoppingOrb[] = [];
  private lightningBeams: LightningBeam[] = [];
  private shockRings: ShockRing[] = [];
  private rescuedFairies: RescuedFairy[] = [];
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  // Ambient clouds & sparkles
  private clouds: Array<{ x: number; y: number; scale: number; speed: number }> = [];
  private sparkles: Array<{ x: number; y: number; phase: number; size: number }> = [];

  constructor(variant: PuzzleBobbleVariant = 'puzzlebobble') {
    this.variant = variant;
    this.storageKey =
      variant === 'puzzlebobble3'
        ? 'puzzlebobble3_hd_highscore_v1'
        : variant === 'puzzlebobble2'
        ? 'puzzlebobble2_hd_highscore_v1'
        : 'puzzlebobble_hd_highscore_v2';
    this.blueprints =
      variant === 'puzzlebobble3'
        ? PB3_STAGES
        : variant === 'puzzlebobble2'
        ? PB2_STAGES
        : PB1_STAGES;
    this.secondaryActionLabel = variant === 'puzzlebobble' ? 'Quick Swap' : 'Swap Orb';
    this.highScore = readHighScore(this.storageKey);

    for (let i = 0; i < 8; i++) {
      this.clouds.push({
        x: (i * 95) % (this.logicalWidth + 120) - 60,
        y: 55 + (i % 4) * 78 + (i % 2) * 18,
        scale: 0.65 + (i % 3) * 0.28,
        speed: 9 + (i % 4) * 5,
      });
    }
    for (let i = 0; i < 28; i++) {
      this.sparkles.push({
        x: (i * 73 + 29) % this.logicalWidth,
        y: (i * 97 + 41) % (this.logicalHeight - 80),
        phase: i * 0.85,
        size: 2.2 + (i % 4) * 1.1,
      });
    }

    this.loadStage(1);
    this.phase = 'TITLE';
  }

  public startNewGame(): void {
    arcadeAudio.unlock();
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.comboStreak = 0;
    this.feverGauge = 0;
    this.feverTimer = 0;
    this.loadStage(1);
    this.phase = 'READY';
    this.phaseTimer = 1.15;
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') {
      this.phase = 'PAUSED';
    } else if (this.phase === 'PAUSED') {
      this.phase = 'PLAYING';
    }
  }

  public resetToTitle(): void {
    this.loadStage(1);
    this.phase = 'TITLE';
    this.phaseTimer = 0;
  }

  public restartStage(): void {
    if (this.phase === 'PLAYING' || this.phase === 'PAUSED') {
      this.loadStage(this.level);
      this.phase = 'READY';
      this.phaseTimer = 0.9;
    }
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public getHudSnapshot(): ClassicGameHud {
    const bp = this.getCurrentBlueprint();
    const count = this.countRemainingOrbs();
    const dropRemain = Math.max(0, this.shotsPerDrop - this.shotsSinceDrop);
    const metricLabel =
      this.variant === 'puzzlebobble3'
        ? this.feverTimer > 0
          ? 'FEVER'
          : 'COMBO'
        : this.variant === 'puzzlebobble2'
        ? 'DROP IN'
        : 'DROP IN';
    const metricVal =
      this.variant === 'puzzlebobble3'
        ? this.feverTimer > 0
          ? `${Math.ceil(this.feverTimer)}s · ×${Math.min(4, 2 + Math.floor(this.comboStreak / 2))}`
          : `${Math.round(this.feverGauge)}%`
        : `${dropRemain} SHOTS`;

    let banner = '';
    if (this.phase === 'READY') banner = `ROUND ${this.level} — ${bp.name.toUpperCase()}`;
    else if (this.phase === 'STAGE_CLEAR') banner = `ROUND ${this.level} CLEAR!`;
    else if (this.phase === 'PAUSED') banner = 'PAUSED';
    else if (this.phase === 'GAME_OVER') banner = 'GAME OVER';

    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: bp.name,
      primaryMetricLabel: this.bossActive ? 'CORE HP' : 'ORBS LEFT',
      primaryMetricValue: this.bossActive ? `${this.bossHp}/${this.bossMaxHp}` : String(count),
      secondaryMetricLabel: metricLabel,
      secondaryMetricValue: metricVal,
      bannerText: banner,
      canRestartStage: this.phase === 'PLAYING' || this.phase === 'PAUSED',
    };
  }

  private getCurrentBlueprint(): StageBlueprint {
    const idx = (this.level - 1) % this.blueprints.length;
    return this.blueprints[idx];
  }

  private getCurrentTheme(): StageTheme {
    const bp = this.getCurrentBlueprint();
    return STAGE_THEMES[bp.themeIdx % STAGE_THEMES.length];
  }

  private addScore(points: number, x?: number, y?: number, label?: string, color = '#FEF08A'): void {
    const feverMult = this.variant === 'puzzlebobble3' && this.feverTimer > 0 ? 2 : 1;
    const total = Math.round(points * feverMult);
    this.score += total;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(this.storageKey, this.highScore);
    }
    if (x !== undefined && y !== undefined) {
      this.popups.push({
        x,
        y,
        text: label ?? `+${total}`,
        color,
        life: 0.95,
        maxLife: 0.95,
      });
    }
  }

  private loadStage(lvl: number): void {
    this.level = lvl;
    const bp = this.getCurrentBlueprint();
    const loopTier = Math.floor((lvl - 1) / this.blueprints.length);

    this.grid = Array.from({ length: MAX_ROWS }, () => Array<GridOrb | null>(GRID_COLS).fill(null));
    this.rowParity = 0;
    this.ceilingDropPx = 0;
    this.targetCeilingDropPx = 0;
    this.shotsSinceDrop = 0;
    this.shotsPerDrop = Math.max(5, bp.shotsPerDrop - loopTier);
    this.activeShot = null;
    this.reloadArc = null;
    this.shotTimer = 0;
    this.aimAngle = -Math.PI / 2;
    this.fallingOrbs = [];
    this.poppingOrbs = [];
    this.lightningBeams = [];
    this.shockRings = [];
    this.rescuedFairies = [];
    this.leftScaleWeight = 0;
    this.rightScaleWeight = 0;
    this.scaleTilt = 0;
    this.scaleTiltVel = 0;
    this.dragonMood = 'idle';
    this.dragonMoodTimer = 0;

    this.bossActive = Boolean(bp.isBoss && this.variant === 'puzzlebobble3');
    this.bossMaxHp = 8 + loopTier * 2;
    this.bossHp = this.bossMaxHp;
    this.bossHitFlash = 0;

    // Color rotation on higher loops keeps replays fresh
    const colorShift = (loopTier * 2) % 7;

    for (let r = 0; r < bp.rows.length && r < MAX_ROWS - 3; r++) {
      const rowStr = bp.rows[r];
      const maxCols = this.colsForRow(r);
      for (let c = 0; c < rowStr.length && c < maxCols; c++) {
        const ch = rowStr[c];
        if (ch === '.' || ch === ' ') continue;
        let color: OrbColor = 0;
        let special: OrbSpecial = 'normal';
        let armor = 0;

        if (ch >= '0' && ch <= '6') {
          color = ((parseInt(ch, 10) + colorShift) % 7) as OrbColor;
        } else if (ch === 'S') {
          special = 'star';
          color = 3;
        } else if (ch === 'I') {
          special = 'iron';
          color = 0;
        } else if (ch === 'F') {
          special = 'fairy';
          color = 6;
        } else if (ch === 'W') {
          special = 'rainbow';
          color = 3;
        } else if (ch === 'B') {
          special = 'bomb';
          color = 0;
        } else if (ch === 'L') {
          special = 'lightning';
          color = 1;
        } else if (ch === 'P') {
          special = 'prism';
          color = ((0 + colorShift) % 7) as OrbColor;
          armor = 1;
        } else if (ch === 'Q') {
          special = 'prism';
          color = ((1 + colorShift) % 7) as OrbColor;
          armor = 1;
        } else if (ch === 'G') {
          special = 'prism';
          color = ((2 + colorShift) % 7) as OrbColor;
          armor = 1;
        } else if (ch === 'Y') {
          special = 'prism';
          color = ((3 + colorShift) % 7) as OrbColor;
          armor = 1;
        }

        this.grid[r][c] = this.makeGridOrb(color, special, armor);
      }
    }

    this.currentOrb = this.pickNextLauncherOrb(false);
    this.nextOrb = this.pickNextLauncherOrb(true);
  }

  private makeGridOrb(color: OrbColor, special: OrbSpecial = 'normal', armor = 0): GridOrb {
    return {
      color,
      special,
      armor,
      jiggleX: 0,
      jiggleY: 0,
      vx: 0,
      vy: 0,
      scaleX: 1,
      scaleY: 1,
      shimmerSeed: Math.random() * Math.PI * 2,
      bornTime: this.clock,
    };
  }

  private colsForRow(r: number): number {
    return (r + this.rowParity) % 2 === 0 ? GRID_COLS : GRID_COLS - 1;
  }

  private cellCenter(r: number, c: number): { x: number; y: number } {
    const isOdd = (r + this.rowParity) % 2 === 1;
    const x = WELL_X + BUBBLE_R + (isOdd ? BUBBLE_R : 0) + c * BUBBLE_D;
    const y = WELL_TOP + this.ceilingDropPx + BUBBLE_R + r * ROW_H;
    return { x, y };
  }

  private getNeighbors(r: number, c: number): Array<[number, number]> {
    const isOdd = (r + this.rowParity) % 2 === 1;
    const deltas: Array<[number, number]> = isOdd
      ? [
          [0, -1],
          [0, 1],
          [-1, 0],
          [-1, 1],
          [1, 0],
          [1, 1],
        ]
      : [
          [0, -1],
          [0, 1],
          [-1, -1],
          [-1, 0],
          [1, -1],
          [1, 0],
        ];
    const out: Array<[number, number]> = [];
    for (const [dr, dc] of deltas) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < MAX_ROWS && nc >= 0 && nc < this.colsForRow(nr)) {
        out.push([nr, nc]);
      }
    }
    return out;
  }

  private getActiveBoardColors(): OrbColor[] {
    const set = new Set<OrbColor>();
    for (let r = 0; r < MAX_ROWS; r++) {
      for (let c = 0; c < this.colsForRow(r); c++) {
        const orb = this.grid[r][c];
        if (!orb) continue;
        if (orb.special === 'normal' || orb.special === 'prism') {
          set.add(orb.color);
        }
      }
    }
    if (set.size === 0) return [0, 1, 2, 3];
    return Array.from(set);
  }

  private pickNextLauncherOrb(allowSpecial: boolean): { color: OrbColor; special: OrbSpecial } {
    const colors = this.getActiveBoardColors();
    const color = colors[Math.floor(Math.random() * colors.length)] ?? 0;

    if (allowSpecial) {
      if (this.variant === 'puzzlebobble2' && Math.random() < 0.09) {
        return { color: 3, special: 'star' };
      }
      if (this.variant === 'puzzlebobble3') {
        const roll = Math.random();
        if (this.feverTimer > 0 && roll < 0.24) {
          return { color: 3, special: roll < 0.14 ? 'rainbow' : 'bomb' };
        }
        if (roll < 0.065) return { color: 3, special: 'rainbow' };
        if (roll < 0.105) return { color: 0, special: 'bomb' };
        if (roll < 0.135) return { color: 1, special: 'lightning' };
        if (roll < 0.16) return { color: 3, special: 'star' };
      }
    }
    return { color, special: 'normal' };
  }

  private countRemainingOrbs(): number {
    let n = 0;
    for (let r = 0; r < MAX_ROWS; r++) {
      for (let c = 0; c < this.colsForRow(r); c++) {
        const orb = this.grid[r][c];
        if (orb && orb.special !== 'iron') n++;
      }
    }
    return n;
  }

  private hasFairyHub(): boolean {
    for (let r = 0; r < MAX_ROWS; r++) {
      for (let c = 0; c < this.colsForRow(r); c++) {
        if (this.grid[r][c]?.special === 'fairy') return true;
      }
    }
    return false;
  }

  public step(dt: number): void {
    const safeDt = Math.min(0.05, Math.max(0.001, dt));
    this.clock += safeDt;

    // Ambient clouds drift in all phases
    for (const cloud of this.clouds) {
      cloud.x += cloud.speed * safeDt;
      if (cloud.x > this.logicalWidth + 90) cloud.x = -90;
    }

    stepParticlesAndPopups(this.particles, this.popups, safeDt);
    this.stepEffects(safeDt);

    if (this.phase === 'TITLE') {
      // Gentle attract aim sway
      this.aimAngle = -Math.PI / 2 + Math.sin(this.clock * 1.45) * 0.72;
      this.crankAngle += Math.cos(this.clock * 1.45) * safeDt * 2.6;
      if (this.input.fireJustPressed) {
        this.startNewGame();
      }
      return;
    }

    if (this.phase === 'PAUSED') return;

    if (this.phase === 'GAME_OVER') {
      if (this.input.fireJustPressed) {
        this.startNewGame();
      }
      return;
    }

    if (this.phase === 'READY') {
      this.phaseTimer -= safeDt;
      this.stepGridSprings(safeDt);
      if (this.phaseTimer <= 0) {
        this.phase = 'PLAYING';
      }
      return;
    }

    if (this.phase === 'STAGE_CLEAR') {
      this.phaseTimer -= safeDt;
      this.dragonMood = 'victory';
      if (this.phaseTimer <= 0) {
        this.loadStage(this.level + 1);
        this.phase = 'READY';
        this.phaseTimer = 1.1;
      }
      return;
    }

    // --- PLAYING PHASE ---
    this.fireCooldown = Math.max(0, this.fireCooldown - safeDt);
    this.wallFlashLeft = Math.max(0, this.wallFlashLeft - safeDt * 3.5);
    this.wallFlashRight = Math.max(0, this.wallFlashRight - safeDt * 3.5);
    this.compressorShake = Math.max(0, this.compressorShake - safeDt * 2.8);
    this.screenShake = Math.max(0, this.screenShake - safeDt * 3.2);
    this.swapAnim = Math.max(0, this.swapAnim - safeDt * 4.5);
    this.bossHitFlash = Math.max(0, this.bossHitFlash - safeDt * 3.5);

    if (this.feverTimer > 0) {
      this.feverTimer = Math.max(0, this.feverTimer - safeDt);
      if (this.feverTimer === 0) {
        this.feverGauge = 0;
      }
    }

    // Smooth compressor slide
    if (Math.abs(this.ceilingDropPx - this.targetCeilingDropPx) > 0.25) {
      this.ceilingDropPx += (this.targetCeilingDropPx - this.ceilingDropPx) * Math.min(1, safeDt * 12);
    } else {
      this.ceilingDropPx = this.targetCeilingDropPx;
    }

    // Pulley balance scale damped spring physics (PB3 Evo)
    if (this.variant === 'puzzlebobble3') {
      const targetTilt = Math.max(-1, Math.min(1, (this.rightScaleWeight - this.leftScaleWeight) / 14));
      const accel = (targetTilt - this.scaleTilt) * 28 - this.scaleTiltVel * 5.2;
      this.scaleTiltVel += accel * safeDt;
      this.scaleTilt += this.scaleTiltVel * safeDt;
      // Gently decay weights over time
      this.leftScaleWeight = Math.max(0, this.leftScaleWeight - safeDt * 0.45);
      this.rightScaleWeight = Math.max(0, this.rightScaleWeight - safeDt * 0.45);
    }

    // Reload toss arc animation
    if (this.reloadArc) {
      this.reloadArc.t += safeDt;
      if (this.reloadArc.t >= this.reloadArc.duration) {
        this.reloadArc = null;
      }
    }

    // Aiming: keyboard/joystick + accurate normalized pointer aiming
    const prevAngle = this.aimAngle;
    const aimSpeed = 1.85;
    if (this.input.left) this.aimAngle -= aimSpeed * safeDt;
    if (this.input.right) this.aimAngle += aimSpeed * safeDt;

    const pointerMoved =
      Math.abs(this.input.pointerX - this.lastPointerX) > 0.002 ||
      Math.abs(this.input.pointerY - this.lastPointerY) > 0.002;
    this.lastPointerX = this.input.pointerX;
    this.lastPointerY = this.input.pointerY;

    if (this.input.pointerActive && (pointerMoved || this.input.fireJustPressed)) {
      const px = this.input.pointerX * this.logicalWidth;
      const py = this.input.pointerY * this.logicalHeight;
      if (py < LAUNCHER_Y + 26) {
        const desired = Math.atan2(Math.min(-18, py - LAUNCHER_Y), px - LAUNCHER_X);
        this.aimAngle = desired;
      }
    }

    this.aimAngle = Math.max(-Math.PI + 0.17, Math.min(-0.17, this.aimAngle));
    this.crankAngle += (this.aimAngle - prevAngle) * 4.2;

    // Swap current & next orb
    if ((this.input.secondaryJustPressed || this.input.down) && !this.activeShot && this.swapAnim <= 0.05) {
      const tmp = this.currentOrb;
      this.currentOrb = this.nextOrb;
      this.nextOrb = tmp;
      this.swapAnim = 1;
      arcadeAudio.playBubbleSwap();
    }

    // Hurry-up shot timer & launching
    if (!this.activeShot) {
      this.shotTimer += safeDt;
      const wantFire =
        (this.input.fireJustPressed || this.input.up) && this.fireCooldown <= 0;
      if (wantFire || this.shotTimer >= HURRY_LIMIT) {
        this.launchBubble();
      }
    } else {
      this.stepActiveShot(safeDt);
    }

    // Grid spring physics
    this.stepGridSprings(safeDt);

    // Update dragon mood
    if (this.dragonMoodTimer > 0) {
      this.dragonMoodTimer -= safeDt;
    } else {
      const lowestY = this.getLowestOrbY();
      if (lowestY > DEADLINE_Y - ROW_H * 2.2) {
        this.dragonMood = 'panic';
      } else {
        this.dragonMood = 'idle';
      }
    }

    // Check stage clear / defeat
    this.checkWinOrLoss();
  }

  private launchBubble(): void {
    this.shotTimer = 0;
    this.fireCooldown = 0.22;
    const vx = Math.cos(this.aimAngle) * SHOT_SPEED;
    const vy = Math.sin(this.aimAngle) * SHOT_SPEED;
    this.activeShot = {
      x: LAUNCHER_X + Math.cos(this.aimAngle) * 24,
      y: LAUNCHER_Y + Math.sin(this.aimAngle) * 24,
      vx,
      vy,
      color: this.currentOrb.color,
      special: this.currentOrb.special,
      squashX: 0.86,
      squashY: 1.18,
      trail: [],
      banks: 0,
    };

    // Advance next orb with cute reload toss from Bub's basket
    const loadedNext = this.nextOrb;
    this.reloadArc = {
      fromX: 224,
      fromY: 664,
      toX: LAUNCHER_X,
      toY: LAUNCHER_Y,
      color: loadedNext.color,
      special: loadedNext.special,
      t: 0,
      duration: 0.26,
    };
    this.currentOrb = loadedNext;
    this.nextOrb = this.pickNextLauncherOrb(true);

    arcadeAudio.playBubbleLaunch();
    spawnBurst(
      this.particles,
      LAUNCHER_X + Math.cos(this.aimAngle) * 28,
      LAUNCHER_Y + Math.sin(this.aimAngle) * 28,
      ORB_PALETTE[this.activeShot.color].spark,
      7,
      110,
      2.6
    );
  }

  private stepActiveShot(dt: number): void {
    const shot = this.activeShot;
    if (!shot) return;

    // Sub-step to guarantee zero tunneling at high speed
    const subSteps = 4;
    const subDt = dt / subSteps;

    shot.squashX += (1 - shot.squashX) * Math.min(1, dt * 14);
    shot.squashY += (1 - shot.squashY) * Math.min(1, dt * 14);

    for (let s = 0; s < subSteps; s++) {
      shot.x += shot.vx * subDt;
      shot.y += shot.vy * subDt;

      // Bank bounce off crystal walls
      if (shot.x - BUBBLE_R <= WELL_X) {
        shot.x = WELL_X + BUBBLE_R;
        shot.vx = Math.abs(shot.vx);
        shot.squashX = 0.72;
        shot.squashY = 1.28;
        shot.banks++;
        this.wallFlashLeft = 1;
        arcadeAudio.playBubbleBank();
        spawnBurst(this.particles, WELL_X + 3, shot.y, '#FFFFFF', 7, 130, 2.5);
      } else if (shot.x + BUBBLE_R >= WELL_RIGHT) {
        shot.x = WELL_RIGHT - BUBBLE_R;
        shot.vx = -Math.abs(shot.vx);
        shot.squashX = 0.72;
        shot.squashY = 1.28;
        shot.banks++;
        this.wallFlashRight = 1;
        arcadeAudio.playBubbleBank();
        spawnBurst(this.particles, WELL_RIGHT - 3, shot.y, '#FFFFFF', 7, 130, 2.5);
      }

      // Check ceiling collision
      if (shot.y - BUBBLE_R <= WELL_TOP + this.ceilingDropPx) {
        this.snapShotToGrid(shot, null);
        return;
      }

      // Check collision with existing grid orbs
      const hitDistSq = (BUBBLE_D * 0.87) * (BUBBLE_D * 0.87);
      for (let r = 0; r < MAX_ROWS; r++) {
        const cols = this.colsForRow(r);
        for (let c = 0; c < cols; c++) {
          const orb = this.grid[r][c];
          if (!orb) continue;
          const pos = this.cellCenter(r, c);
          const dx = shot.x - pos.x;
          const dy = shot.y - pos.y;
          if (dx * dx + dy * dy <= hitDistSq) {
            this.snapShotToGrid(shot, [r, c]);
            return;
          }
        }
      }
    }

    // Add shimmering flight trail
    shot.trail.push({ x: shot.x, y: shot.y, life: 0.18 });
    for (let i = shot.trail.length - 1; i >= 0; i--) {
      shot.trail[i].life -= dt;
      if (shot.trail[i].life <= 0) shot.trail.splice(i, 1);
    }
  }

  private snapShotToGrid(shot: ActiveShot, hitCell: [number, number] | null): void {
    this.activeShot = null;

    // Special instant-trigger: if player shot hit a grid Star Bubble directly!
    if (hitCell) {
      const target = this.grid[hitCell[0]][hitCell[1]];
      if (target && target.special === 'star' && shot.special === 'normal') {
        this.triggerStarBurst(hitCell[0], hitCell[1], shot.color);
        this.afterShotResolved(true, shot.banks);
        return;
      }
    }

    // Find best empty cell closest to shot impact position
    let bestR = 0;
    let bestC = 0;
    let bestDist = Infinity;

    const consider = (r: number, c: number) => {
      if (r < 0 || r >= MAX_ROWS || c < 0 || c >= this.colsForRow(r)) return;
      if (this.grid[r][c]) return;
      const pos = this.cellCenter(r, c);
      const d = (pos.x - shot.x) ** 2 + (pos.y - shot.y) ** 2;
      if (d < bestDist) {
        bestDist = d;
        bestR = r;
        bestC = c;
      }
    };

    if (hitCell) {
      for (const [nr, nc] of this.getNeighbors(hitCell[0], hitCell[1])) {
        consider(nr, nc);
      }
    }
    // Fallback: scan all empty cells anchored to ceiling or adjacent to any orb
    if (!Number.isFinite(bestDist)) {
      for (let r = 0; r < MAX_ROWS; r++) {
        for (let c = 0; c < this.colsForRow(r); c++) {
          if (this.grid[r][c]) continue;
          const anchored =
            r === 0 || this.getNeighbors(r, c).some(([nr, nc]) => this.grid[nr][nc] !== null);
          if (anchored) consider(r, c);
        }
      }
    }

    const placed = this.makeGridOrb(shot.color, shot.special, 0);
    placed.scaleX = 1.24;
    placed.scaleY = 0.78;
    this.grid[bestR][bestC] = placed;

    const impactPos = this.cellCenter(bestR, bestC);
    this.applyImpactRipple(impactPos.x, impactPos.y);
    arcadeAudio.playBubbleSnap();

    // Resolve specials or classic color match!
    let poppedAny = false;

    if (shot.special === 'bomb') {
      poppedAny = this.triggerBombBlast(bestR, bestC);
    } else if (shot.special === 'lightning') {
      poppedAny = this.triggerLightningRow(bestR, bestC);
    } else if (shot.special === 'star') {
      // Pick struck neighbor color (or shot color)
      let strikeColor = shot.color;
      if (hitCell) {
        const hOrb = this.grid[hitCell[0]][hitCell[1]];
        if (hOrb && (hOrb.special === 'normal' || hOrb.special === 'prism')) {
          strikeColor = hOrb.color;
        }
      }
      poppedAny = this.triggerStarBurst(bestR, bestC, strikeColor);
    } else if (shot.special === 'rainbow') {
      poppedAny = this.triggerRainbowMatch(bestR, bestC);
    } else {
      poppedAny = this.resolveNormalMatch(bestR, bestC, shot.color);
    }

    this.afterShotResolved(poppedAny, shot.banks);
  }

  private applyImpactRipple(ix: number, iy: number): void {
    const maxDist = BUBBLE_D * 2.6;
    for (let r = 0; r < MAX_ROWS; r++) {
      for (let c = 0; c < this.colsForRow(r); c++) {
        const orb = this.grid[r][c];
        if (!orb) continue;
        const pos = this.cellCenter(r, c);
        const dx = pos.x - ix;
        const dy = pos.y - iy;
        const dist = Math.hypot(dx, dy);
        if (dist > 1 && dist < maxDist) {
          const force = (1 - dist / maxDist) * 145;
          orb.vx += (dx / dist) * force;
          orb.vy += (dy / dist) * force;
        }
      }
    }
  }

  private triggerStarBurst(originR: number, originC: number, targetColor: OrbColor): boolean {
    const originPos = this.cellCenter(originR, originC);
    this.grid[originR][originC] = null;
    this.queuePopVisual(originPos.x, originPos.y, 3, 'star', 0);

    let count = 1;
    let delay = 0.03;
    for (let r = 0; r < MAX_ROWS; r++) {
      for (let c = 0; c < this.colsForRow(r); c++) {
        const orb = this.grid[r][c];
        if (!orb) continue;
        if ((orb.special === 'normal' || orb.special === 'prism') && orb.color === targetColor) {
          const p = this.cellCenter(r, c);
          this.grid[r][c] = null;
          this.queuePopVisual(p.x, p.y, orb.color, orb.special, delay);
          delay += 0.025;
          count++;
        }
      }
    }

    this.shockRings.push({
      x: originPos.x,
      y: originPos.y,
      maxR: 185,
      life: 0.45,
      maxLife: 0.45,
      color: '#FDE047',
    });
    this.screenShake = 0.45;
    arcadeAudio.playBubblePopChain(count, this.comboStreak + 2);
    this.addScore(count * 150, originPos.x, originPos.y - 12, `STAR BURST ×${count}!`, '#FEF08A');
    return true;
  }

  private triggerBombBlast(originR: number, originC: number): boolean {
    const center = this.cellCenter(originR, originC);
    const radius = BUBBLE_D * 2.15;
    let count = 0;

    for (let r = 0; r < MAX_ROWS; r++) {
      for (let c = 0; c < this.colsForRow(r); c++) {
        const orb = this.grid[r][c];
        if (!orb || orb.special === 'fairy') continue;
        const pos = this.cellCenter(r, c);
        if (Math.hypot(pos.x - center.x, pos.y - center.y) <= radius) {
          this.grid[r][c] = null;
          this.queuePopVisual(pos.x, pos.y, orb.color, orb.special, count * 0.015);
          count++;
        }
      }
    }

    this.shockRings.push({
      x: center.x,
      y: center.y,
      maxR: radius + 24,
      life: 0.42,
      maxLife: 0.42,
      color: '#FB923C',
    });
    this.screenShake = 0.65;
    arcadeAudio.playExplosion(true);
    this.addScore(count * 140, center.x, center.y - 10, `BOMB BLAST ×${count}!`, '#FDBA74');
    return count > 0;
  }

  private triggerLightningRow(originR: number, originC: number): boolean {
    const center = this.cellCenter(originR, originC);
    let count = 0;
    const cols = this.colsForRow(originR);
    for (let c = 0; c < cols; c++) {
      const orb = this.grid[originR][c];
      if (!orb || orb.special === 'fairy') continue;
      const pos = this.cellCenter(originR, c);
      this.grid[originR][c] = null;
      this.queuePopVisual(pos.x, pos.y, orb.color, orb.special, Math.abs(c - originC) * 0.03);
      count++;
    }
    this.lightningBeams.push({
      y: center.y,
      life: 0.42,
      maxLife: 0.42,
      color: '#38BDF8',
    });
    this.screenShake = 0.5;
    arcadeAudio.playSuperzapper();
    this.addScore(count * 160, WELL_X + WELL_W * 0.5, center.y - 14, `LIGHTNING ROW ×${count}!`, '#7DD3FC');
    return count > 0;
  }

  private triggerRainbowMatch(originR: number, originC: number): boolean {
    const adjColors = new Set<OrbColor>();
    for (const [nr, nc] of this.getNeighbors(originR, originC)) {
      const n = this.grid[nr][nc];
      if (n && (n.special === 'normal' || n.special === 'prism')) {
        adjColors.add(n.color);
      }
    }
    const toPop = new Set<string>([`${originR},${originC}`]);
    for (const col of adjColors) {
      const cluster = this.collectCluster(originR, originC, col);
      if (cluster.length >= 2) {
        for (const [r, c] of cluster) toPop.add(`${r},${c}`);
      }
    }
    if (toPop.size < 2) {
      // Even lone rainbow bursts its neighbors!
      for (const [nr, nc] of this.getNeighbors(originR, originC)) {
        const n = this.grid[nr][nc];
        if (n && n.special !== 'iron' && n.special !== 'fairy') {
          toPop.add(`${nr},${nc}`);
        }
      }
    }
    const coords = Array.from(toPop).map((k) => k.split(',').map(Number) as [number, number]);
    this.popMatchedCoords(coords, this.cellCenter(originR, originC), 'PRISM RAINBOW!');
    return true;
  }

  private collectCluster(startR: number, startC: number, color: OrbColor): Array<[number, number]> {
    const visited = new Set<string>();
    const queue: Array<[number, number]> = [[startR, startC]];
    const cluster: Array<[number, number]> = [];
    visited.add(`${startR},${startC}`);

    while (queue.length > 0) {
      const [r, c] = queue.shift()!;
      cluster.push([r, c]);
      for (const [nr, nc] of this.getNeighbors(r, c)) {
        const key = `${nr},${nc}`;
        if (visited.has(key)) continue;
        const n = this.grid[nr][nc];
        if (!n) continue;
        if (
          n.special === 'rainbow' ||
          ((n.special === 'normal' || n.special === 'prism') && n.color === color)
        ) {
          visited.add(key);
          queue.push([nr, nc]);
        }
      }
    }
    return cluster;
  }

  private resolveNormalMatch(startR: number, startC: number, color: OrbColor): boolean {
    const cluster = this.collectCluster(startR, startC, color);
    if (cluster.length < 3) return false;
    this.popMatchedCoords(cluster, this.cellCenter(startR, startC));
    return true;
  }

  private popMatchedCoords(
    coords: Array<[number, number]>,
    anchorPos: { x: number; y: number },
    customBanner?: string
  ): void {
    const extraSpecials: Array<{ r: number; c: number; special: OrbSpecial; color: OrbColor }> = [];
    let leftPopCount = 0;
    let rightPopCount = 0;

    // First crack any adjacent armored prism orbs & detect adjacent Star/Bomb/Lightning chain triggers!
    const poppedSet = new Set(coords.map(([r, c]) => `${r},${c}`));
    for (const [r, c] of coords) {
      for (const [nr, nc] of this.getNeighbors(r, c)) {
        if (poppedSet.has(`${nr},${nc}`)) continue;
        const adj = this.grid[nr][nc];
        if (!adj) continue;
        if (adj.armor > 0) {
          adj.armor = 0;
          adj.special = 'normal';
          const ap = this.cellCenter(nr, nc);
          spawnBurst(this.particles, ap.x, ap.y, '#E0F2FE', 10, 140, 2.8);
        } else if (adj.special === 'bomb' || adj.special === 'lightning' || adj.special === 'star') {
          extraSpecials.push({ r: nr, c: nc, special: adj.special, color: adj.color });
        }
      }
    }

    let poppedCount = 0;
    coords.forEach(([r, c], idx) => {
      const orb = this.grid[r][c];
      if (!orb) return;
      // Prism armor absorbs 1 hit if not directly popped by bomb/lightning, wait—matching 3 same-color prism orbs SHOULD shatter them!
      const p = this.cellCenter(r, c);
      if (p.x < LAUNCHER_X) leftPopCount++;
      else rightPopCount++;
      this.grid[r][c] = null;
      this.queuePopVisual(p.x, p.y, orb.color, orb.special, idx * 0.025);
      poppedCount++;
    });

    this.comboStreak++;
    if (this.variant === 'puzzlebobble3') {
      this.leftScaleWeight += leftPopCount * 0.9;
      this.rightScaleWeight += rightPopCount * 0.9;
      this.feverGauge = Math.min(100, this.feverGauge + poppedCount * 7 + this.comboStreak * 6);
      if (this.feverGauge >= 100 && this.feverTimer <= 0) {
        this.feverTimer = 11.5;
        arcadeAudio.playRainbowBonus();
        this.popups.push({
          x: LAUNCHER_X,
          y: 260,
          text: 'RAINBOW FEVER ×2!',
          color: '#FEF08A',
          life: 1.5,
          maxLife: 1.5,
        });
      }
      // Damage Boss Core if active!
      if (this.bossActive && this.bossHp > 0) {
        const dmg = poppedCount >= 5 ? 2 : 1;
        this.bossHp = Math.max(0, this.bossHp - dmg);
        this.bossHitFlash = 1;
        spawnBurst(this.particles, LAUNCHER_X, WELL_TOP + this.ceilingDropPx + 74, '#FDE047', 16, 180, 3.2);
      }
    }

    this.shockRings.push({
      x: anchorPos.x,
      y: anchorPos.y,
      maxR: 62 + poppedCount * 10,
      life: 0.34,
      maxLife: 0.34,
      color: ORB_PALETTE[coords[0] ? this.currentOrb.color : 3]?.spark ?? '#FFFFFF',
    });

    arcadeAudio.playBubblePopChain(poppedCount, this.comboStreak);
    const pts = poppedCount * 100 * Math.min(4, 1 + Math.floor((this.comboStreak - 1) / 2));
    const label =
      customBanner ??
      (this.comboStreak >= 3
        ? `CHAIN ×${this.comboStreak}! +${pts}`
        : poppedCount >= 5
        ? `GREAT ×${poppedCount}! +${pts}`
        : `+${pts}`);
    this.addScore(pts, anchorPos.x, anchorPos.y - 12, label, '#FEF08A');

    // Trigger any chained special orbs touched by the pop!
    for (const sp of extraSpecials) {
      if (!this.grid[sp.r][sp.c]) continue;
      if (sp.special === 'bomb') this.triggerBombBlast(sp.r, sp.c);
      else if (sp.special === 'lightning') this.triggerLightningRow(sp.r, sp.c);
      else if (sp.special === 'star') this.triggerStarBurst(sp.r, sp.c, this.currentOrb.color);
    }
  }

  private queuePopVisual(x: number, y: number, color: OrbColor, special: OrbSpecial, delay: number): void {
    this.poppingOrbs.push({
      x,
      y,
      color,
      special,
      age: 0,
      duration: 0.24,
      delay,
    });
  }

  private afterShotResolved(popped: boolean, banks: number): void {
    if (popped) {
      this.dragonMood = 'cheer';
      this.dragonMoodTimer = 1.25;
      if (banks > 0) {
        this.addScore(250 * banks, LAUNCHER_X, 460, `BANK SHOT +${250 * banks}!`, '#7DD3FC');
      }
      // Drop all unanchored bubbles with bouncing gravity avalanche!
      this.dropDisconnectedAvalanche();
      // Check Chack'n Fairy rescue in PB2!
      this.checkFairyRescue();
      // Check PB3 Evo Pulley Scale surge!
      this.checkPulleyScaleSurge();
    } else {
      this.comboStreak = 0;
    }

    // Compressor descent check
    this.shotsSinceDrop++;
    if (this.shotsSinceDrop >= this.shotsPerDrop) {
      this.shotsSinceDrop = 0;
      this.targetCeilingDropPx += ROW_H;
      this.compressorShake = 1;
      this.screenShake = Math.max(this.screenShake, 0.32);
      arcadeAudio.playCompressorDrop();
    }

    // Ensure next/current launcher orbs remain useful colors if board colors shrank
    const activeColors = this.getActiveBoardColors();
    if (this.currentOrb.special === 'normal' && !activeColors.includes(this.currentOrb.color)) {
      this.currentOrb.color = activeColors[0] ?? 0;
    }
    if (this.nextOrb.special === 'normal' && !activeColors.includes(this.nextOrb.color)) {
      this.nextOrb.color = activeColors[Math.floor(Math.random() * activeColors.length)] ?? 0;
    }
  }

  private dropDisconnectedAvalanche(): void {
    // BFS from top ceiling row (r === 0) AND any active Fairy hub (in PB2, hubs anchor their cluster!)
    const anchored = new Set<string>();
    const queue: Array<[number, number]> = [];

    for (let c = 0; c < this.colsForRow(0); c++) {
      if (this.grid[0][c]) {
        const k = `0,${c}`;
        anchored.add(k);
        queue.push([0, c]);
      }
    }
    for (let r = 1; r < MAX_ROWS; r++) {
      for (let c = 0; c < this.colsForRow(r); c++) {
        if (this.grid[r][c]?.special === 'fairy') {
          const k = `${r},${c}`;
          if (!anchored.has(k)) {
            anchored.add(k);
            queue.push([r, c]);
          }
        }
      }
    }

    while (queue.length > 0) {
      const [r, c] = queue.shift()!;
      for (const [nr, nc] of this.getNeighbors(r, c)) {
        const k = `${nr},${nc}`;
        if (!anchored.has(k) && this.grid[nr][nc]) {
          anchored.add(k);
          queue.push([nr, nc]);
        }
      }
    }

    let dropped = 0;
    let leftDrop = 0;
    let rightDrop = 0;
    let sumX = 0;
    let sumY = 0;

    for (let r = 0; r < MAX_ROWS; r++) {
      for (let c = 0; c < this.colsForRow(r); c++) {
        const orb = this.grid[r][c];
        if (!orb || anchored.has(`${r},${c}`)) continue;
        const pos = this.cellCenter(r, c);
        this.grid[r][c] = null;
        this.fallingOrbs.push({
          x: pos.x,
          y: pos.y,
          vx: (Math.random() - 0.5) * 150 + (pos.x < LAUNCHER_X ? -40 : 40),
          vy: -135 - Math.random() * 95,
          rot: 0,
          vrot: (Math.random() - 0.5) * 8,
          color: orb.color,
          special: orb.special,
          bounced: false,
          life: 2.2,
        });
        dropped++;
        sumX += pos.x;
        sumY += pos.y;
        if (pos.x < LAUNCHER_X) leftDrop++;
        else rightDrop++;
      }
    }

    if (dropped > 0) {
      const bonus = Math.min(20000, dropped * dropped * 120 + dropped * 200);
      arcadeAudio.playBubbleAvalanche(dropped);
      this.addScore(
        bonus,
        sumX / dropped,
        sumY / dropped,
        dropped >= 4 ? `AVALANCHE ×${dropped}! +${bonus}` : `DROP ×${dropped} +${bonus}`,
        '#86EFAC'
      );
      if (this.variant === 'puzzlebobble3') {
        this.leftScaleWeight += leftDrop * 2.2;
        this.rightScaleWeight += rightDrop * 2.2;
        this.feverGauge = Math.min(100, this.feverGauge + dropped * 8);
        if (this.bossActive && this.bossHp > 0 && dropped >= 3) {
          this.bossHp = Math.max(0, this.bossHp - 1);
          this.bossHitFlash = 1;
        }
      }
    }
  }

  private checkFairyRescue(): void {
    if (this.variant !== 'puzzlebobble2') return;
    let freed = 0;
    for (let r = 0; r < MAX_ROWS; r++) {
      for (let c = 0; c < this.colsForRow(r); c++) {
        const orb = this.grid[r][c];
        if (!orb || orb.special !== 'fairy') continue;
        const touchingNonFairy = this.getNeighbors(r, c).some(([nr, nc]) => {
          const n = this.grid[nr][nc];
          return n !== null && n.special !== 'fairy';
        });
        if (!touchingNonFairy) {
          const p = this.cellCenter(r, c);
          this.grid[r][c] = null;
          this.rescuedFairies.push({ x: p.x, y: p.y, t: 0, hue: 320 + freed * 45 });
          spawnBurst(this.particles, p.x, p.y, '#FDE047', 24, 200, 3.6);
          this.shockRings.push({
            x: p.x,
            y: p.y,
            maxR: 130,
            life: 0.55,
            maxLife: 0.55,
            color: '#F472B6',
          });
          freed++;
        }
      }
    }
    if (freed > 0) {
      arcadeAudio.playFairyRescue();
      this.addScore(2500 * freed, LAUNCHER_X, 310, `FAIRY RESCUED! +${2500 * freed}`, '#F9A8D4');
      // If ALL fairies in a Fairy stage are rescued, pop remaining board for celebration!
      if (!this.hasFairyHub()) {
        for (let r = 0; r < MAX_ROWS; r++) {
          for (let c = 0; c < this.colsForRow(r); c++) {
            const o = this.grid[r][c];
            if (!o) continue;
            const p = this.cellCenter(r, c);
            this.grid[r][c] = null;
            this.fallingOrbs.push({
              x: p.x,
              y: p.y,
              vx: (Math.random() - 0.5) * 200,
              vy: -180 - Math.random() * 110,
              rot: 0,
              vrot: (Math.random() - 0.5) * 9,
              color: o.color,
              special: o.special,
              bounced: false,
              life: 2.0,
            });
          }
        }
      }
    }
  }

  private checkPulleyScaleSurge(): void {
    if (this.variant !== 'puzzlebobble3') return;
    if (Math.abs(this.leftScaleWeight - this.rightScaleWeight) >= 10) {
      const surgeLift = ROW_H * 0.75;
      this.targetCeilingDropPx = Math.max(0, this.targetCeilingDropPx - surgeLift);
      this.leftScaleWeight *= 0.35;
      this.rightScaleWeight *= 0.35;
      arcadeAudio.playPowerUp();
      this.addScore(1500, LAUNCHER_X, 175, 'PULLEY LIFT! +1500', '#67E8F9');
      spawnBurst(this.particles, 68, 360, '#FDE047', 14, 150, 3);
      spawnBurst(this.particles, 532, 360, '#FDE047', 14, 150, 3);
    }
  }

  private getLowestOrbY(): number {
    let maxY = WELL_TOP;
    for (let r = 0; r < MAX_ROWS; r++) {
      for (let c = 0; c < this.colsForRow(r); c++) {
        if (!this.grid[r][c]) continue;
        const p = this.cellCenter(r, c);
        if (p.y + BUBBLE_R > maxY) maxY = p.y + BUBBLE_R;
      }
    }
    return maxY;
  }

  private checkWinOrLoss(): void {
    if (this.bossActive && this.bossHp <= 0) {
      // Shatter entire boss board!
      this.bossActive = false;
      for (let r = 0; r < MAX_ROWS; r++) {
        for (let c = 0; c < this.colsForRow(r); c++) {
          const orb = this.grid[r][c];
          if (!orb) continue;
          const p = this.cellCenter(r, c);
          this.grid[r][c] = null;
          this.fallingOrbs.push({
            x: p.x,
            y: p.y,
            vx: (Math.random() - 0.5) * 260,
            vy: -220 - Math.random() * 140,
            rot: 0,
            vrot: (Math.random() - 0.5) * 10,
            color: orb.color,
            special: orb.special,
            bounced: false,
            life: 2.2,
          });
        }
      }
      this.addScore(10000, LAUNCHER_X, 270, 'CRYSTAL BOSS CLEAR! +10000', '#FEF08A');
      arcadeAudio.playStageClear();
      this.phase = 'STAGE_CLEAR';
      this.phaseTimer = 2.4;
      return;
    }

    if (this.countRemainingOrbs() === 0 && !this.bossActive) {
      const clearBonus = 2000 + this.level * 500;
      this.addScore(clearBonus, LAUNCHER_X, 290, `ROUND CLEAR! +${clearBonus}`, '#86EFAC');
      arcadeAudio.playStageClear();
      this.phase = 'STAGE_CLEAR';
      this.phaseTimer = 2.2;
      return;
    }

    if (this.getLowestOrbY() >= DEADLINE_Y) {
      this.lives--;
      this.screenShake = 0.7;
      arcadeAudio.playDeath();
      if (this.lives <= 0) {
        this.phase = 'GAME_OVER';
      } else {
        this.loadStage(this.level);
        this.phase = 'READY';
        this.phaseTimer = 1.25;
      }
    }
  }

  private stepGridSprings(dt: number): void {
    for (let r = 0; r < MAX_ROWS; r++) {
      for (let c = 0; c < this.colsForRow(r); c++) {
        const orb = this.grid[r][c];
        if (!orb) continue;
        // Damped spring back to (0, 0)
        const k = 150;
        const damp = 12;
        orb.vx += (-orb.jiggleX * k - orb.vx * damp) * dt;
        orb.vy += (-orb.jiggleY * k - orb.vy * damp) * dt;
        orb.jiggleX += orb.vx * dt;
        orb.jiggleY += orb.vy * dt;
        orb.scaleX += (1 - orb.scaleX) * Math.min(1, dt * 13);
        orb.scaleY += (1 - orb.scaleY) * Math.min(1, dt * 13);
      }
    }
  }

  private stepEffects(dt: number): void {
    // Popping orbs (delayed chain pop bursts!)
    for (let i = this.poppingOrbs.length - 1; i >= 0; i--) {
      const po = this.poppingOrbs[i];
      if (po.delay > 0) {
        po.delay -= dt;
        continue;
      }
      if (po.age === 0) {
        const col = ORB_PALETTE[po.color]?.spark ?? '#FFFFFF';
        spawnBurst(this.particles, po.x, po.y, col, 11, 175, 3.0);
      }
      po.age += dt;
      if (po.age >= po.duration) {
        this.poppingOrbs.splice(i, 1);
      }
    }

    // Falling bouncing avalanche orbs
    for (let i = this.fallingOrbs.length - 1; i >= 0; i--) {
      const fo = this.fallingOrbs[i];
      fo.vy += 880 * dt;
      fo.x += fo.vx * dt;
      fo.y += fo.vy * dt;
      fo.rot += fo.vrot * dt;
      fo.life -= dt;

      if (fo.x < WELL_X + BUBBLE_R) {
        fo.x = WELL_X + BUBBLE_R;
        fo.vx = Math.abs(fo.vx) * 0.75;
      } else if (fo.x > WELL_RIGHT - BUBBLE_R) {
        fo.x = WELL_RIGHT - BUBBLE_R;
        fo.vx = -Math.abs(fo.vx) * 0.75;
      }

      if (!fo.bounced && fo.y >= DEADLINE_Y + 34) {
        fo.y = DEADLINE_Y + 34;
        fo.vy = -Math.abs(fo.vy) * 0.48;
        fo.bounced = true;
        spawnBurst(this.particles, fo.x, fo.y, ORB_PALETTE[fo.color]?.spark ?? '#FFF', 6, 115, 2.4);
      }

      if (fo.y > this.logicalHeight + 45 || fo.life <= 0) {
        this.fallingOrbs.splice(i, 1);
      }
    }

    // Shockwave rings
    for (let i = this.shockRings.length - 1; i >= 0; i--) {
      this.shockRings[i].life -= dt;
      if (this.shockRings[i].life <= 0) this.shockRings.splice(i, 1);
    }

    // Lightning beams
    for (let i = this.lightningBeams.length - 1; i >= 0; i--) {
      this.lightningBeams[i].life -= dt;
      if (this.lightningBeams[i].life <= 0) this.lightningBeams.splice(i, 1);
    }

    // Rescued fairies ascending in sparkles
    for (let i = this.rescuedFairies.length - 1; i >= 0; i--) {
      const f = this.rescuedFairies[i];
      f.t += dt;
      f.y -= 130 * dt;
      f.x += Math.sin(f.t * 8) * 90 * dt;
      if (Math.random() < 0.4) {
        spawnBurst(this.particles, f.x, f.y, '#FDE047', 2, 45, 2.2);
      }
      if (f.y < -40 || f.t > 3.5) this.rescuedFairies.splice(i, 1);
    }
  }

  // ============================================================================
  // 2.5D RENDERER — CUTE ANIMATION, SHIMMERING GLASS ORBS & STORYBOOK WORLDS
  // ============================================================================
  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.save();
    ctx.scale(dpr, dpr);

    // Subtle impact shake
    if (this.screenShake > 0.01) {
      const mag = this.screenShake * 6;
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }

    const theme = this.getCurrentTheme();
    this.renderBackdrop(ctx, theme);
    this.renderArcadeFrame25D(ctx, theme);

    if (this.variant === 'puzzlebobble3') {
      this.renderPulleyScales25D(ctx);
      this.renderFeverMeter(ctx);
    }

    this.renderWellInterior(ctx, theme);
    this.renderCompressor25D(ctx, theme);

    if (this.bossActive) {
      this.renderCrystalBossCore(ctx);
    }

    // Aim trajectory crystal preview
    if (this.phase === 'PLAYING' && !this.activeShot) {
      this.renderAimGuide(ctx);
    }

    // Render all grid orbs
    this.renderGridOrbs(ctx);

    // Render popping bursts
    this.renderPoppingOrbs(ctx);

    // Render active flying bubble
    if (this.activeShot) {
      this.renderActiveShot(ctx, this.activeShot);
    }

    // Render lightning & shockwave rings
    this.renderBeamsAndRings(ctx);

    // Render falling avalanche orbs
    this.renderFallingOrbs(ctx);

    // Render rescued fluttering fairies
    this.renderRescuedFairies(ctx);

    // Render geared 2.5D Bubble Launcher + Bub & Bob dragons!
    this.renderLauncherAndDragons(ctx, theme);

    // Particles & score popups
    renderParticlesAndPopups(ctx, this.particles, this.popups);

    // Hurry-up animated badge
    if (this.phase === 'PLAYING' && !this.activeShot && this.shotTimer > HURRY_LIMIT - 4.2) {
      this.renderHurryUpBadge(ctx);
    }

    // Top HUD ribbon inside canvas
    this.renderTopRibbon(ctx, theme);

    // Phase overlays
    if (this.phase === 'TITLE') {
      this.renderTitleOverlay(ctx);
    } else if (this.phase === 'READY') {
      this.renderBannerOverlay(
        ctx,
        `ROUND ${this.level}`,
        this.getCurrentBlueprint().name,
        'READY... AIM!'
      );
    } else if (this.phase === 'STAGE_CLEAR') {
      this.renderBannerOverlay(
        ctx,
        `ROUND ${this.level} CLEAR!`,
        'BUB & BOB CELEBRATE!',
        `SCORE ${this.score.toLocaleString()}`
      );
    } else if (this.phase === 'PAUSED') {
      this.renderBannerOverlay(ctx, 'PAUSED', 'TAKE A BREATHER', 'PRESS P TO RESUME');
    } else if (this.phase === 'GAME_OVER') {
      this.renderBannerOverlay(
        ctx,
        'GAME OVER',
        `FINAL SCORE ${this.score.toLocaleString()}`,
        'PRESS SPACE OR CLICK TO PLAY AGAIN'
      );
    }

    if (visualMode === 'crt') {
      renderCrtOverlay(ctx, this.logicalWidth, this.logicalHeight);
    }

    ctx.restore();
  }

  private renderBackdrop(ctx: CanvasRenderingContext2D, theme: StageTheme): void {
    const W = this.logicalWidth;
    const H = this.logicalHeight;

    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, theme.skyTop);
    sky.addColorStop(0.55, theme.skyMid);
    sky.addColorStop(1, theme.skyBot);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Soft distant sun or crescent moon glow
    ctx.save();
    const orbX = theme.starlight ? 515 : 88;
    const orbY = 128;
    const sunGlow = ctx.createRadialGradient(orbX, orbY, 8, orbX, orbY, 74);
    sunGlow.addColorStop(0, theme.starlight ? 'rgba(254, 249, 195, 0.92)' : 'rgba(255, 251, 235, 0.95)');
    sunGlow.addColorStop(0.45, theme.starlight ? 'rgba(192, 132, 252, 0.25)' : 'rgba(253, 224, 71, 0.35)');
    sunGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(orbX, orbY, 74, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Twinkling ambient sparkles / stars
    for (const sp of this.sparkles) {
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(this.clock * 2.4 + sp.phase));
      ctx.save();
      ctx.globalAlpha = theme.starlight ? tw * 0.9 : tw * 0.45;
      drawStarGlint(ctx, sp.x, sp.y, sp.size * (0.7 + tw * 0.5), '#FFFFFF', this.clock * 0.6 + sp.phase);
      ctx.restore();
    }

    // Fluffy drifting 2.5D storybook clouds
    for (const cl of this.clouds) {
      ctx.save();
      ctx.translate(cl.x, cl.y);
      ctx.scale(cl.scale, cl.scale);
      ctx.fillStyle = theme.starlight ? 'rgba(226, 232, 240, 0.22)' : 'rgba(255, 255, 255, 0.78)';
      ctx.beginPath();
      ctx.arc(-20, 4, 18, 0, Math.PI * 2);
      ctx.arc(0, -4, 24, 0, Math.PI * 2);
      ctx.arc(22, 4, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = theme.starlight ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.94)';
      ctx.beginPath();
      ctx.arc(-6, -8, 14, 0, Math.PI * 2);
      ctx.arc(10, -4, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Distant candy castle silhouettes on left & right wings
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = theme.hillBack;
    // Left tower
    ctx.fillRect(22, 430, 38, 190);
    ctx.beginPath();
    ctx.moveTo(16, 430);
    ctx.lineTo(41, 388);
    ctx.lineTo(66, 430);
    ctx.closePath();
    ctx.fill();
    // Right tower
    ctx.fillRect(540, 445, 38, 175);
    ctx.beginPath();
    ctx.moveTo(534, 445);
    ctx.lineTo(559, 400);
    ctx.lineTo(584, 445);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Rolling layered hills at bottom
    ctx.fillStyle = theme.hillBack;
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, 610);
    ctx.quadraticCurveTo(140, 540, 300, 595);
    ctx.quadraticCurveTo(460, 645, W, 568);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = theme.hillFront;
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, 652);
    ctx.quadraticCurveTo(180, 616, 330, 650);
    ctx.quadraticCurveTo(485, 682, W, 628);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }

  private renderArcadeFrame25D(ctx: CanvasRenderingContext2D, theme: StageTheme): void {
    const colW = 20;
    const topY = WELL_TOP - 22;
    const botY = 716;

    // Cast 2.5D drop shadow behind the playfield temple frame
    ctx.fillStyle = 'rgba(6, 10, 26, 0.42)';
    ctx.beginPath();
    ctx.roundRect(WELL_X - colW + 8, topY + 10, WELL_W + colW * 2, botY - topY, 18);
    ctx.fill();

    // Left & right extruded 2.5D pillars
    for (const side of ['left', 'right'] as const) {
      const px = side === 'left' ? WELL_X - colW : WELL_RIGHT;
      const flash = side === 'left' ? this.wallFlashLeft : this.wallFlashRight;
      const g = ctx.createLinearGradient(px, topY, px + colW, topY);
      g.addColorStop(0, theme.frameOuter);
      g.addColorStop(0.32, theme.frameInner);
      g.addColorStop(0.55, theme.frameTrim);
      g.addColorStop(0.85, theme.frameInner);
      g.addColorStop(1, theme.frameOuter);

      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(px, topY, colW, botY - topY, 8);
      ctx.fill();

      // Bank bounce shimmer flash!
      if (flash > 0.02) {
        ctx.fillStyle = `rgba(255, 255, 255, ${flash * 0.65})`;
        ctx.beginPath();
        ctx.roundRect(px, topY, colW, botY - topY, 8);
        ctx.fill();
      }

      // Decorative gem rivets down the pillar
      for (let ry = topY + 34; ry < botY - 26; ry += 56) {
        ctx.fillStyle = theme.frameOuter;
        ctx.beginPath();
        ctx.arc(px + colW * 0.5, ry + 1.5, 4.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = theme.frameTrim;
        ctx.beginPath();
        ctx.arc(px + colW * 0.5, ry, 3.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Top extruded header arch
    const archG = ctx.createLinearGradient(0, topY, 0, WELL_TOP);
    archG.addColorStop(0, theme.frameTrim);
    archG.addColorStop(0.45, theme.frameInner);
    archG.addColorStop(1, theme.frameOuter);
    ctx.fillStyle = archG;
    ctx.beginPath();
    ctx.roundRect(WELL_X - colW - 4, topY, WELL_W + colW * 2 + 8, 26, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Bottom wooden/marble stage deck where Bub & Bob stand!
    const deckG = ctx.createLinearGradient(0, 682, 0, botY + 12);
    deckG.addColorStop(0, theme.frameTrim);
    deckG.addColorStop(0.25, theme.frameInner);
    deckG.addColorStop(1, theme.frameOuter);
    ctx.fillStyle = deckG;
    ctx.beginPath();
    ctx.roundRect(WELL_X - colW - 8, 684, WELL_W + colW * 2 + 16, 36, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.38)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  private renderWellInterior(ctx: CanvasRenderingContext2D, theme: StageTheme): void {
    // Deep translucent stained-glass playfield backdrop so shimmering bubbles POP with high contrast!
    const bg = ctx.createLinearGradient(WELL_X, WELL_TOP, WELL_X, 684);
    bg.addColorStop(0, theme.wellBgTop);
    bg.addColorStop(1, theme.wellBgBot);
    ctx.fillStyle = bg;
    ctx.fillRect(WELL_X, WELL_TOP, WELL_W, 684 - WELL_TOP);

    // Subtle soft hex lattice shimmer guide inside the well
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.045)';
    ctx.lineWidth = 1;
    for (let r = 0; r < 13; r++) {
      const y = WELL_TOP + this.ceilingDropPx + BUBBLE_R + r * ROW_H;
      if (y > DEADLINE_Y) break;
      ctx.beginPath();
      ctx.moveTo(WELL_X + 6, y);
      ctx.lineTo(WELL_RIGHT - 6, y);
      ctx.stroke();
    }
    ctx.restore();

    // Iconic glowing dashed Deadline Rope with pulsing warning when orbs approach!
    const lowestY = this.getLowestOrbY();
    const danger = lowestY > DEADLINE_Y - ROW_H * 2.5;
    const pulse = danger ? 0.55 + 0.45 * Math.sin(this.clock * 12) : 0.42;

    ctx.save();
    ctx.strokeStyle = danger
      ? `rgba(248, 113, 113, ${pulse})`
      : 'rgba(254, 240, 138, 0.45)';
    ctx.lineWidth = danger ? 3 : 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(WELL_X + 4, DEADLINE_Y);
    ctx.lineTo(WELL_RIGHT - 4, DEADLINE_Y);
    ctx.stroke();
    ctx.setLineDash([]);

    if (danger) {
      ctx.fillStyle = `rgba(239, 68, 68, ${pulse * 0.16})`;
      ctx.fillRect(WELL_X, DEADLINE_Y - 24, WELL_W, 24);
    }
    ctx.restore();
  }

  private renderCompressor25D(ctx: CanvasRenderingContext2D, theme: StageTheme): void {
    const drop = this.ceilingDropPx;
    if (drop <= 0.5 && this.compressorShake <= 0.05) {
      // Subtle top steel rim
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fillRect(WELL_X, WELL_TOP, WELL_W, 4);
      return;
    }

    const shakeY = Math.sin(this.clock * 55) * this.compressorShake * 3;
    const plateY = WELL_TOP + drop + shakeY;

    ctx.save();
    // Clip to playfield well
    ctx.beginPath();
    ctx.rect(WELL_X, WELL_TOP, WELL_W, Math.max(0, plateY - WELL_TOP + 12));
    ctx.clip();

    // Twin hydraulic steel piston rods
    for (const rodX of [WELL_X + 74, WELL_RIGHT - 74]) {
      const rg = ctx.createLinearGradient(rodX - 10, 0, rodX + 10, 0);
      rg.addColorStop(0, '#475569');
      rg.addColorStop(0.4, '#F1F5F9');
      rg.addColorStop(0.7, '#94A3B8');
      rg.addColorStop(1, '#334155');
      ctx.fillStyle = rg;
      ctx.fillRect(rodX - 10, WELL_TOP, 20, Math.max(0, plateY - WELL_TOP));

      // Diagonal hydraulic grooves
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)';
      ctx.lineWidth = 2;
      for (let gy = WELL_TOP + 8; gy < plateY - 8; gy += 14) {
        ctx.beginPath();
        ctx.moveTo(rodX - 10, gy);
        ctx.lineTo(rodX + 10, gy + 6);
        ctx.stroke();
      }
    }

    // Center brass gear wheel behind the compressor plate
    this.drawBrassGear(ctx, LAUNCHER_X, WELL_TOP + drop * 0.5, 22, 10, this.clock * 1.2);
    ctx.restore();

    // Extruded heavy beveled compressor bar
    const barH = 16;
    const barG = ctx.createLinearGradient(0, plateY - barH, 0, plateY);
    barG.addColorStop(0, '#E2E8F0');
    barG.addColorStop(0.5, '#94A3B8');
    barG.addColorStop(1, '#334155');
    ctx.fillStyle = barG;
    ctx.fillRect(WELL_X, plateY - barH, WELL_W, barH);

    // Hazard stripe accent along bottom edge
    ctx.fillStyle = theme.accent;
    for (let sx = WELL_X + 8; sx < WELL_RIGHT - 12; sx += 26) {
      ctx.fillRect(sx, plateY - 5, 14, 3);
    }
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(WELL_X, plateY - barH, WELL_W, barH);
  }

  private renderPulleyScales25D(ctx: CanvasRenderingContext2D): void {
    // Twin hanging 2.5D golden balance scales flanking the well (PB3 Evo!)
    const leftY = 330 + this.scaleTilt * 44;
    const rightY = 330 - this.scaleTilt * 44;

    const drawScale = (cx: number, panY: number, weight: number, label: string) => {
      ctx.save();
      // Top pulley wheel
      this.drawBrassGear(ctx, cx, 132, 14, 8, this.scaleTilt * 3);

      // Golden chain rope
      ctx.strokeStyle = '#FDE047';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx, 146);
      ctx.lineTo(cx, panY - 24);
      ctx.stroke();

      // Triangle suspension chains
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx, panY - 24);
      ctx.lineTo(cx - 26, panY);
      ctx.moveTo(cx, panY - 24);
      ctx.lineTo(cx + 26, panY);
      ctx.stroke();

      // 2.5D curved brass scale pan
      const panG = ctx.createLinearGradient(cx - 28, panY, cx + 28, panY + 14);
      panG.addColorStop(0, '#B45309');
      panG.addColorStop(0.45, '#FEF08A');
      panG.addColorStop(1, '#92400E');
      ctx.fillStyle = panG;
      ctx.beginPath();
      ctx.moveTo(cx - 30, panY);
      ctx.quadraticCurveTo(cx, panY + 18, cx + 30, panY);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#451A03';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // Stacked shimmering crystal weights on the pan
      const gems = Math.min(5, Math.floor(weight / 2));
      for (let i = 0; i < gems; i++) {
        const gx = cx + ((i % 3) - 1) * 12;
        const gy = panY - 5 - Math.floor(i / 3) * 9;
        ctx.fillStyle = i % 2 === 0 ? '#38BDF8' : '#F472B6';
        ctx.beginPath();
        ctx.arc(gx, gy, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(gx - 1.8, gy - 1.8, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.font = '800 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FEF9C3';
      ctx.fillText(label, cx, panY + 26);
      ctx.restore();
    };

    drawScale(58, leftY, this.leftScaleWeight, 'L-SCALE');
    drawScale(542, rightY, this.rightScaleWeight, 'R-SCALE');
  }

  private renderFeverMeter(ctx: CanvasRenderingContext2D): void {
    // Sleek vertical Rainbow Fever crystal tube on left wing bottom
    const x = 44;
    const y = 455;
    const w = 28;
    const h = 152;
    const pct = this.feverTimer > 0 ? this.feverTimer / 11.5 : this.feverGauge / 100;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = this.feverTimer > 0 ? '#FEF08A' : 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const fillH = Math.max(0, (h - 8) * Math.min(1, pct));
    if (fillH > 2) {
      const fg = ctx.createLinearGradient(x, y + h, x, y);
      fg.addColorStop(0, '#EC4899');
      fg.addColorStop(0.35, '#F59E0B');
      fg.addColorStop(0.7, '#34D399');
      fg.addColorStop(1, '#38BDF8');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.roundRect(x + 4, y + h - 4 - fillH, w - 8, fillH, 10);
      ctx.fill();
    }

    ctx.font = '900 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = this.feverTimer > 0 ? '#FEF08A' : '#FFFFFF';
    ctx.fillText(this.feverTimer > 0 ? 'FEVER!' : 'PRISM', x + w * 0.5, y - 9);
    ctx.restore();
  }

  private renderCrystalBossCore(ctx: CanvasRenderingContext2D): void {
    const cx = LAUNCHER_X;
    const cy = WELL_TOP + this.ceilingDropPx + 74;
    const pulse = 1 + Math.sin(this.clock * 4.5) * 0.06;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(pulse, pulse);

    // Radiant halo
    const aura = ctx.createRadialGradient(0, 0, 8, 0, 0, 52);
    aura.addColorStop(0, this.bossHitFlash > 0.1 ? 'rgba(255,255,255,0.95)' : 'rgba(232, 121, 249, 0.7)');
    aura.addColorStop(0.6, 'rgba(56, 189, 248, 0.25)');
    aura.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, Math.PI * 2);
    ctx.fill();

    // Faceted rotating crystal core
    ctx.rotate(this.clock * 0.7);
    const cg = ctx.createLinearGradient(-22, -22, 22, 22);
    cg.addColorStop(0, '#FDF4FF');
    cg.addColorStop(0.5, '#E879F9');
    cg.addColorStop(1, '#6366F1');
    ctx.fillStyle = this.bossHitFlash > 0.2 ? '#FFFFFF' : cg;
    ctx.strokeStyle = '#FEF08A';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const rad = i % 2 === 0 ? 28 : 20;
      if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
      else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.rotate(-this.clock * 0.7);
    ctx.font = '900 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0F172A';
    ctx.fillText(`HP ${this.bossHp}`, 0, 1);
    ctx.restore();
  }

  private renderAimGuide(ctx: CanvasRenderingContext2D): void {
    // Raycast sparkling bank-shot preview!
    // PB1 & PB2: 1 wall bounce; PB3 Evo (or Fever): 2 wall bounces!
    const maxBounces = this.variant === 'puzzlebobble3' && this.feverTimer > 0 ? 2 : 1;
    let x = LAUNCHER_X;
    let y = LAUNCHER_Y;
    let dx = Math.cos(this.aimAngle);
    let dy = Math.sin(this.aimAngle);

    const points: Array<{ x: number; y: number }> = [{ x, y }];
    let bounces = 0;
    const stepSize = 8;
    const maxSteps = this.variant === 'puzzlebobble3' ? 92 : 64;

    for (let i = 0; i < maxSteps; i++) {
      x += dx * stepSize;
      y += dy * stepSize;

      if (x - BUBBLE_R <= WELL_X) {
        x = WELL_X + BUBBLE_R;
        if (bounces >= maxBounces) break;
        dx = Math.abs(dx);
        bounces++;
      } else if (x + BUBBLE_R >= WELL_RIGHT) {
        x = WELL_RIGHT - BUBBLE_R;
        if (bounces >= maxBounces) break;
        dx = -Math.abs(dx);
        bounces++;
      }

      if (y - BUBBLE_R <= WELL_TOP + this.ceilingDropPx) {
        points.push({ x, y });
        break;
      }

      // Stop preview when nearing an existing orb
      let hit = false;
      for (let r = 0; r < MAX_ROWS && !hit; r++) {
        for (let c = 0; c < this.colsForRow(r); c++) {
          if (!this.grid[r][c]) continue;
          const p = this.cellCenter(r, c);
          if ((p.x - x) ** 2 + (p.y - y) ** 2 < (BUBBLE_D * 0.88) ** 2) {
            hit = true;
            break;
          }
        }
      }
      points.push({ x, y });
      if (hit) break;
    }

    const orbCol =
      this.currentOrb.special === 'rainbow'
        ? '#FDE047'
        : ORB_PALETTE[this.currentOrb.color]?.spark ?? '#FFFFFF';

    ctx.save();
    for (let i = 3; i < points.length; i += 2) {
      const p = points[i];
      const frac = i / points.length;
      const pulse = 0.65 + 0.35 * Math.sin(this.clock * 10 - i * 0.6);
      ctx.globalAlpha = (1 - frac * 0.55) * pulse;
      ctx.fillStyle = i % 4 === 0 ? '#FFFFFF' : orbCol;
      ctx.beginPath();
      ctx.arc(p.x, p.y, i === points.length - 1 ? 5.2 : 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Crisp glowing target ring at impact point
    const last = points[points.length - 1];
    if (last && points.length > 4) {
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = orbCol;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(last.x, last.y, BUBBLE_R * 0.62, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private renderGridOrbs(ctx: CanvasRenderingContext2D): void {
    const lowestY = this.getLowestOrbY();
    const panicWiggle = lowestY > DEADLINE_Y - ROW_H * 2.2;

    for (let r = 0; r < MAX_ROWS; r++) {
      const cols = this.colsForRow(r);
      for (let c = 0; c < cols; c++) {
        const orb = this.grid[r][c];
        if (!orb) continue;
        const pos = this.cellCenter(r, c);
        const panicX = panicWiggle ? Math.sin(this.clock * 32 + r + c) * 1.4 : 0;
        const drawX = pos.x + orb.jiggleX + panicX;
        const drawY = pos.y + orb.jiggleY;

        this.drawShimmerOrb25D(
          ctx,
          drawX,
          drawY,
          BUBBLE_R,
          orb.color,
          orb.special,
          orb.armor,
          orb.scaleX,
          orb.scaleY,
          orb.shimmerSeed
        );
      }
    }
  }

  private renderPoppingOrbs(ctx: CanvasRenderingContext2D): void {
    for (const po of this.poppingOrbs) {
      if (po.delay > 0) {
        // Still waiting its micro-staggered pop cue: swell bright!
        this.drawShimmerOrb25D(ctx, po.x, po.y, BUBBLE_R, po.color, po.special, 0, 1.12, 1.12, 0);
        continue;
      }
      const t = Math.min(1, po.age / po.duration);
      ctx.save();
      ctx.globalAlpha = 1 - t;
      const rad = BUBBLE_R * (1 + t * 0.72);
      const col = ORB_PALETTE[po.color]?.light ?? '#FFFFFF';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3.5 * (1 - t);
      ctx.beginPath();
      ctx.arc(po.x, po.y, rad, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = col;
      ctx.globalAlpha = (1 - t) * 0.45;
      ctx.beginPath();
      ctx.arc(po.x, po.y, rad * 0.78, 0, Math.PI * 2);
      ctx.fill();

      drawStarGlint(ctx, po.x, po.y, rad * 0.65, '#FFFFFF', t * 2.2);
      ctx.restore();
    }
  }

  private renderActiveShot(ctx: CanvasRenderingContext2D, shot: ActiveShot): void {
    const col = ORB_PALETTE[shot.color]?.spark ?? '#FFFFFF';
    for (const tr of shot.trail) {
      const a = Math.max(0, tr.life / 0.18);
      ctx.save();
      ctx.globalAlpha = a * 0.42;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(tr.x, tr.y, BUBBLE_R * 0.48 * a, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    this.drawShimmerOrb25D(
      ctx,
      shot.x,
      shot.y,
      BUBBLE_R,
      shot.color,
      shot.special,
      0,
      shot.squashX,
      shot.squashY,
      this.clock * 3
    );
  }

  private renderFallingOrbs(ctx: CanvasRenderingContext2D): void {
    for (const fo of this.fallingOrbs) {
      ctx.save();
      ctx.translate(fo.x, fo.y);
      ctx.rotate(fo.rot);
      this.drawShimmerOrb25D(ctx, 0, 0, BUBBLE_R * 0.94, fo.color, fo.special, 0, 1, 1, fo.rot);
      ctx.restore();
    }
  }

  private renderBeamsAndRings(ctx: CanvasRenderingContext2D): void {
    for (const ring of this.shockRings) {
      const t = 1 - ring.life / ring.maxLife;
      ctx.save();
      ctx.globalAlpha = (1 - t) * 0.85;
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 5 * (1 - t) + 1;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, 12 + ring.maxR * t, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (const beam of this.lightningBeams) {
      const a = beam.life / beam.maxLife;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 11 * a;
      ctx.beginPath();
      ctx.moveTo(WELL_X, beam.y);
      ctx.lineTo(WELL_RIGHT, beam.y);
      ctx.stroke();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      for (let x = WELL_X; x <= WELL_RIGHT; x += 18) {
        const jy = beam.y + (Math.random() - 0.5) * 16;
        if (x === WELL_X) ctx.moveTo(x, beam.y);
        else ctx.lineTo(x, jy);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  private renderRescuedFairies(ctx: CanvasRenderingContext2D): void {
    for (const f of this.rescuedFairies) {
      this.drawCuteFairySprite(ctx, f.x, f.y, 1.35);
    }
  }

  // ============================================================================
  // SIGNATURE 2.5D SHIMMERING GLASS ORB RENDERER (ZERO shadowBlur = 60 FPS!)
  // ============================================================================
  private drawShimmerOrb25D(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    color: OrbColor,
    special: OrbSpecial,
    armor: number,
    scaleX: number,
    scaleY: number,
    shimmerSeed: number
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scaleX, scaleY);

    // 2.5D grounded drop shadow for real depth off the playfield wall
    ctx.fillStyle = 'rgba(4, 9, 24, 0.34)';
    ctx.beginPath();
    ctx.ellipse(2.6, 4.2, r * 0.94, r * 0.88, 0, 0, Math.PI * 2);
    ctx.fill();

    if (special === 'iron') {
      // Brushed gunmetal 2.5D steel sphere with 4 rivets
      const ig = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
      ig.addColorStop(0, '#F1F5F9');
      ig.addColorStop(0.35, '#94A3B8');
      ig.addColorStop(0.78, '#475569');
      ig.addColorStop(1, '#1E293B');
      ctx.fillStyle = ig;
      ctx.beginPath();
      ctx.arc(0, 0, r - 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Equatorial steel band & 4 shiny rivets
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.88, r * 0.34, 0, 0, Math.PI * 2);
      ctx.stroke();
      for (const [rx, ry] of [
        [-9, -7],
        [9, -7],
        [-9, 7],
        [9, 7],
      ]) {
        ctx.fillStyle = '#E2E8F0';
        ctx.beginPath();
        ctx.arc(rx, ry, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      return;
    }

    if (special === 'fairy') {
      // Glowing golden-pink crystal rescue orb with animated winged Chack'n Fairy inside!
      const fg = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
      fg.addColorStop(0, '#FFFFFF');
      fg.addColorStop(0.45, '#FBCFE8');
      fg.addColorStop(0.82, '#F472B6');
      fg.addColorStop(1, '#BE185D');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(0, 0, r + 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 2.2;
      ctx.stroke();

      this.drawCuteFairySprite(ctx, 0, Math.sin(this.clock * 7 + shimmerSeed) * 2.2, 0.92);
      // Glossy glass sheen over fairy
      ctx.fillStyle = 'rgba(255, 255, 255, 0.58)';
      ctx.beginPath();
      ctx.ellipse(-r * 0.34, -r * 0.42, r * 0.34, r * 0.17, -0.65, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    if (special === 'rainbow') {
      // Animated shifting prismatic 2.5D crystal sphere
      const hueShift = (this.clock * 140) % 360;
      const rg = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.12, 0, 0, r);
      rg.addColorStop(0, '#FFFFFF');
      rg.addColorStop(0.32, `hsl(${hueShift}, 95%, 72%)`);
      rg.addColorStop(0.68, `hsl(${(hueShift + 115) % 360}, 92%, 58%)`);
      rg.addColorStop(1, `hsl(${(hueShift + 230) % 360}, 88%, 40%)`);
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(0, 0, r - 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Spinning inner prism star
      drawStarGlint(ctx, 0, 0, r * 0.62, '#FFFFFF', this.clock * 2.5);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
      ctx.beginPath();
      ctx.ellipse(-r * 0.34, -r * 0.4, r * 0.32, r * 0.16, -0.65, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    // Standard / Star / Bomb / Lightning / Prism colored 2.5D jewel sphere
    const style = ORB_PALETTE[color] ?? ORB_PALETTE[0];
    const grad = ctx.createRadialGradient(-r * 0.34, -r * 0.38, r * 0.12, 0, 0, r);
    if (special === 'star') {
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(0.35, '#FEF08A');
      grad.addColorStop(0.78, '#F59E0B');
      grad.addColorStop(1, '#B45309');
    } else if (special === 'bomb') {
      grad.addColorStop(0, '#94A3B8');
      grad.addColorStop(0.45, '#334155');
      grad.addColorStop(0.85, '#0F172A');
      grad.addColorStop(1, '#020617');
    } else if (special === 'lightning') {
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(0.35, '#7DD3FC');
      grad.addColorStop(0.78, '#0284C7');
      grad.addColorStop(1, '#0C4A6E');
    } else {
      grad.addColorStop(0, style.light);
      grad.addColorStop(0.42, style.mid);
      grad.addColorStop(0.86, style.dark);
      grad.addColorStop(1, style.rim);
    }

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r - 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Subtle deep outline for crisp arcade separation
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Warm 2.5D Fresnel bounce crescent along bottom-right rim
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.34)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, r - 3.2, 0.3, Math.PI * 0.72);
    ctx.stroke();

    // Authentic Cute Taito Inner Icon inside each bubble!
    if (special === 'star') {
      drawStarGlint(ctx, 0, 0, r * 0.65, '#FFFBEB', this.clock * 2.2 + shimmerSeed);
    } else if (special === 'bomb') {
      // Cute sparking cartoon bomb face + fuse!
      ctx.fillStyle = '#FB923C';
      ctx.beginPath();
      ctx.arc(0, -r * 0.58, 3.8, 0, Math.PI * 2);
      ctx.fill();
      drawStarGlint(ctx, 5, -r * 0.65, 6.5, '#FEF08A', this.clock * 9);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 11px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('B!', 0, 2);
    } else if (special === 'lightning') {
      // Crisp golden lightning bolt
      ctx.fillStyle = '#FEF08A';
      ctx.strokeStyle = '#92400E';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(2, -11);
      ctx.lineTo(-7, 1);
      ctx.lineTo(-1, 1);
      ctx.lineTo(-3, 11);
      ctx.lineTo(7, -2);
      ctx.lineTo(1, -2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      this.drawCuteOrbEmblem(ctx, color, r);
    }

    // Translucent top-left glass specular crescent + secondary pinpoint
    ctx.fillStyle = 'rgba(255, 255, 255, 0.66)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.34, -r * 0.4, r * 0.34, r * 0.16, -0.68, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    ctx.beginPath();
    ctx.arc(-r * 0.5, -r * 0.14, r * 0.09, 0, Math.PI * 2);
    ctx.fill();

    // Animated periodic jewel shimmer twinkle gliding across the sphere!
    const shimmerPhase = (this.clock * 1.45 + shimmerSeed) % (Math.PI * 2);
    if (shimmerPhase < 1.1) {
      const st = Math.sin((shimmerPhase / 1.1) * Math.PI);
      const gx = -r * 0.38 + (shimmerPhase / 1.1) * r * 0.72;
      const gy = -r * 0.44 + (shimmerPhase / 1.1) * r * 0.25;
      ctx.globalAlpha = st * 0.92;
      drawStarGlint(ctx, gx, gy, r * 0.28 * st, '#FFFFFF', this.clock * 2.5);
      ctx.globalAlpha = 1;
    }

    // Frosted diamond facet shell for PB3 Evo Prism Armored orbs!
    if (armor > 0) {
      ctx.strokeStyle = '#E0F2FE';
      ctx.fillStyle = 'rgba(224, 242, 254, 0.28)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
        const px = Math.cos(a) * (r + 0.5);
        const py = Math.sin(a) * (r + 0.5);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawCuteOrbEmblem(ctx: CanvasRenderingContext2D, color: OrbColor, r: number): void {
    ctx.save();
    ctx.globalAlpha = 0.82;
    const s = r * 0.44;
    switch (color) {
      case 0: // Ruby: Cute Apple-Heart
        ctx.fillStyle = '#FFF1F2';
        ctx.beginPath();
        ctx.moveTo(0, s * 0.85);
        ctx.bezierCurveTo(-s * 1.25, s * 0.1, -s * 1.1, -s * 0.95, 0, -s * 0.35);
        ctx.bezierCurveTo(s * 1.1, -s * 0.95, s * 1.25, s * 0.1, 0, s * 0.85);
        ctx.fill();
        break;
      case 1: // Sapphire: Cute Smiling Waterdrop
        ctx.fillStyle = '#E0F2FE';
        ctx.beginPath();
        ctx.moveTo(0, -s * 1.05);
        ctx.quadraticCurveTo(s * 0.95, s * 0.15, 0, s * 0.95);
        ctx.quadraticCurveTo(-s * 0.95, s * 0.15, 0, -s * 1.05);
        ctx.fill();
        break;
      case 2: // Emerald: Cute Twin Sprout Leaf
        ctx.fillStyle = '#DCFCE7';
        ctx.beginPath();
        ctx.ellipse(-s * 0.42, -s * 0.1, s * 0.55, s * 0.32, -0.5, 0, Math.PI * 2);
        ctx.ellipse(s * 0.42, -s * 0.1, s * 0.55, s * 0.32, 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#DCFCE7';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(0, s * 0.8);
        ctx.lineTo(0, -s * 0.15);
        ctx.stroke();
        break;
      case 3: // Sunbeam: Plump Cute 5-Point Star
        ctx.fillStyle = '#FFFBEB';
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
          const rad = i % 2 === 0 ? s * 1.02 : s * 0.48;
          if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
          else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
        }
        ctx.closePath();
        ctx.fill();
        break;
      case 4: // Amethyst: Cute Crescent Moon
        ctx.fillStyle = '#FAF5FF';
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.88, 0.45, Math.PI * 1.72);
        ctx.arc(s * 0.38, -s * 0.22, s * 0.66, Math.PI * 1.65, 0.5, true);
        ctx.closePath();
        ctx.fill();
        break;
      case 5: // Tangerine: Cute Smiling Sunburst
        ctx.fillStyle = '#FFF7ED';
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.58, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFF7ED';
        ctx.lineWidth = 1.7;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * s * 0.72, Math.sin(a) * s * 0.72);
          ctx.lineTo(Math.cos(a) * s * 1.02, Math.sin(a) * s * 1.02);
          ctx.stroke();
        }
        break;
      case 6: // Sakura: Cute 5-Petal Cherry Blossom
        ctx.fillStyle = '#FDF2F8';
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * s * 0.46, Math.sin(a) * s * 0.46, s * 0.36, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#FDE047';
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.24, 0, Math.PI * 2);
        ctx.fill();
        break;
    }
    ctx.restore();
  }

  private drawCuteFairySprite(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number): void {
    const flap = Math.sin(this.clock * 22) * 0.38;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Translucent fluttering fairy wings
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.save();
    ctx.rotate(-0.4 + flap);
    ctx.beginPath();
    ctx.ellipse(-9, -2, 8, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.rotate(0.4 - flap);
    ctx.beginPath();
    ctx.ellipse(9, -2, 8, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Cute Chack'n / Fairy golden body & blush face
    ctx.fillStyle = '#FEF08A';
    ctx.strokeStyle = '#92400E';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Big glossy eyes & rosy cheeks
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(-2.6, -1, 1.5, 0, Math.PI * 2);
    ctx.arc(2.6, -1, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FB7185';
    ctx.beginPath();
    ctx.arc(-4.6, 1.4, 1.4, 0, Math.PI * 2);
    ctx.arc(4.6, 1.4, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ============================================================================
  // GEARED 2.5D BUBBLE LAUNCHER + ANIMATED CUTE BUB & BOB DRAGONS
  // ============================================================================
  private renderLauncherAndDragons(ctx: CanvasRenderingContext2D, theme: StageTheme): void {
    // Decorative brass geared wheel base
    this.drawBrassGear(ctx, LAUNCHER_X, LAUNCHER_Y + 4, 34, 14, this.crankAngle);
    this.drawBrassGear(ctx, LAUNCHER_X + 38, LAUNCHER_Y + 18, 17, 8, -this.crankAngle * 1.8);

    // Aiming pointer arrow turret (2.5D golden pointer!)
    ctx.save();
    ctx.translate(LAUNCHER_X, LAUNCHER_Y);
    ctx.rotate(this.aimAngle + Math.PI / 2);

    // Ornate pointer shaft & arrowhead
    const arrowG = ctx.createLinearGradient(-10, -58, 10, 12);
    arrowG.addColorStop(0, '#FEF9C3');
    arrowG.addColorStop(0.4, '#F59E0B');
    arrowG.addColorStop(1, '#92400E');
    ctx.fillStyle = arrowG;
    ctx.strokeStyle = '#451A03';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(0, -64);
    ctx.lineTo(14, -40);
    ctx.lineTo(5.5, -42);
    ctx.lineTo(5.5, 10);
    ctx.lineTo(-5.5, 10);
    ctx.lineTo(-5.5, -42);
    ctx.lineTo(-14, -40);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Jewel ring cradle
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.arc(0, 0, 23, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FDE047';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    // Active loaded bubble inside the launcher cradle (or reload toss arc!)
    if (this.reloadArc) {
      const p = Math.min(1, this.reloadArc.t / this.reloadArc.duration);
      const ax = this.reloadArc.fromX + (this.reloadArc.toX - this.reloadArc.fromX) * p;
      const ay =
        this.reloadArc.fromY +
        (this.reloadArc.toY - this.reloadArc.fromY) * p -
        Math.sin(p * Math.PI) * 34;
      this.drawShimmerOrb25D(ctx, ax, ay, BUBBLE_R * 0.92, this.reloadArc.color, this.reloadArc.special, 0, 1, 1, 1);
    } else if (!this.activeShot) {
      const sw = 1 + Math.sin(this.swapAnim * Math.PI) * 0.22;
      this.drawShimmerOrb25D(
        ctx,
        LAUNCHER_X,
        LAUNCHER_Y,
        BUBBLE_R * 0.92,
        this.currentOrb.color,
        this.currentOrb.special,
        0,
        sw,
        2 - sw,
        0.5
      );
    }

    // Woven NEXT bubble basket beside Bub
    const basketX = 226;
    const basketY = 668;
    this.drawShimmerOrb25D(
      ctx,
      basketX,
      basketY - 12,
      BUBBLE_R * 0.72,
      this.nextOrb.color,
      this.nextOrb.special,
      0,
      1,
      1,
      2.1
    );
    ctx.save();
    const bg = ctx.createLinearGradient(basketX - 20, basketY - 4, basketX + 20, basketY + 14);
    bg.addColorStop(0, '#D97706');
    bg.addColorStop(0.5, '#F59E0B');
    bg.addColorStop(1, '#78350F');
    ctx.fillStyle = bg;
    ctx.strokeStyle = '#451A03';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(basketX - 20, basketY - 4, 40, 18, 7);
    ctx.fill();
    ctx.stroke();
    ctx.font = '800 8px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FEF3C7';
    ctx.fillText('NEXT', basketX, basketY + 8);
    ctx.restore();

    // Cute Animated BUB (Green Dragon, left) & BOB (Blue Dragon, right cranking!)
    this.drawCuteBubbleDragon(ctx, 180, 662, 'bub', 1);
    this.drawCuteBubbleDragon(ctx, 412, 662, 'bob', -1);

    // Subtle swap hint pill on deck
    ctx.save();
    ctx.font = '800 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = theme.frameTrim;
    ctx.fillText('SWAP ORB: SHIFT / X / DOWN', LAUNCHER_X, 706);
    ctx.restore();
  }

  private drawBrassGear(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    teeth: number,
    rot: number
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);

    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 2, 0, 0, r + 4);
    g.addColorStop(0, '#FEF9C3');
    g.addColorStop(0.5, '#F59E0B');
    g.addColorStop(1, '#92400E');
    ctx.fillStyle = g;
    ctx.strokeStyle = '#451A03';
    ctx.lineWidth = 1.4;

    ctx.beginPath();
    for (let i = 0; i < teeth * 2; i++) {
      const a = (i / (teeth * 2)) * Math.PI * 2;
      const rad = i % 2 === 0 ? r + 4.5 : r - 1.5;
      if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
      else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Inner hub
    ctx.fillStyle = '#78350F';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FDE047';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawCuteBubbleDragon(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    who: 'bub' | 'bob',
    facing: 1 | -1
  ): void {
    const isBub = who === 'bub';
    const bodyLight = isBub ? '#86EFAC' : '#7DD3FC';
    const bodyMid = isBub ? '#22C55E' : '#2563EB';
    const bodyDark = isBub ? '#15803D' : '#1E40AF';
    const spineCol = isBub ? '#FB923C' : '#F472B6';

    const cheerBounce =
      this.dragonMood === 'cheer' || this.dragonMood === 'victory'
        ? Math.abs(Math.sin(this.clock * 11 + (isBub ? 0 : 1.2))) * -14
        : Math.sin(this.clock * 4.2 + (isBub ? 0 : 1.5)) * 2.2;
    const panicShake = this.dragonMood === 'panic' ? Math.sin(this.clock * 36) * 2.2 : 0;

    ctx.save();
    ctx.translate(x + panicShake, y + cheerBounce);
    ctx.scale(facing, 1);

    // Contact shadow
    ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 22 - cheerBounce * 0.7, 17, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cute curved dino tail
    ctx.fillStyle = bodyMid;
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-10, 12);
    ctx.quadraticCurveTo(-26, 14, -22, 2);
    ctx.quadraticCurveTo(-15, 6, -9, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Spiky cute back ridges
    ctx.fillStyle = spineCol;
    for (const [sx, sy] of [
      [-12, -16],
      [-15, -7],
      [-14, 2],
    ]) {
      ctx.beginPath();
      ctx.moveTo(sx, sy - 4);
      ctx.lineTo(sx - 7, sy);
      ctx.lineTo(sx, sy + 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Plump rounded 2.5D dragon body
    const bg = ctx.createRadialGradient(4, -4, 3, 0, 4, 22);
    bg.addColorStop(0, bodyLight);
    bg.addColorStop(0.55, bodyMid);
    bg.addColorStop(1, bodyDark);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.ellipse(0, 5, 16, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Cream tummy patch
    ctx.fillStyle = '#FEF9C3';
    ctx.beginPath();
    ctx.ellipse(5, 7, 9, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cute rounded sneakers / feet
    ctx.fillStyle = bodyDark;
    ctx.beginPath();
    ctx.ellipse(-6, 20, 7, 4.5, 0, 0, Math.PI * 2);
    ctx.ellipse(7, 20, 7.5, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Big adorable head & snout
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(1, -12, 13.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Plump snout bump
    ctx.beginPath();
    ctx.ellipse(12, -9.5, 8, 6.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Rosy cheek blush
    ctx.fillStyle = 'rgba(251, 113, 133, 0.62)';
    ctx.beginPath();
    ctx.ellipse(7.5, -6, 3.6, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Big expressive glossy eyes (with periodic blinking & starry cheer!)
    const blinking = Math.sin(this.clock * 1.9 + (isBub ? 0 : 2.1)) > 0.96;
    if (blinking && this.dragonMood === 'idle') {
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(2, -14);
      ctx.quadraticCurveTo(6, -16, 9, -14);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(5.5, -14, 4.2, 5.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.ellipse(6.5, -13.8, 2.2, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(5.8, -15.4, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Happy smile (or surprised O-mouth when panicking!)
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.6;
    if (this.dragonMood === 'panic') {
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(13.5, -6.5, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Nervous flying blue sweat drop!
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(-6, -24 + Math.sin(this.clock * 14) * 3, 3.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(11.5, -8.2, 4, 0.25, Math.PI * 0.85);
      ctx.stroke();
    }

    // Articulated arm: Bob turns the crank, Bub waves/cheers!
    ctx.save();
    ctx.translate(10, 2);
    const armRot = !isBub
      ? Math.sin(this.crankAngle) * 0.65
      : this.dragonMood === 'cheer' || this.dragonMood === 'victory'
      ? -1.15 + Math.sin(this.clock * 14) * 0.35
      : -0.2;
    ctx.rotate(armRot);
    ctx.fillStyle = bodyMid;
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(-2, -3.5, 14, 7, 3.5);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  private renderHurryUpBadge(ctx: CanvasRenderingContext2D): void {
    const remain = Math.max(0, Math.ceil(HURRY_LIMIT - this.shotTimer));
    const bounce = Math.abs(Math.sin(this.clock * 12)) * -7;
    ctx.save();
    ctx.translate(LAUNCHER_X, 554 + bounce);
    ctx.fillStyle = 'rgba(220, 38, 38, 0.92)';
    ctx.strokeStyle = '#FEF08A';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.roundRect(-78, -15, 156, 30, 15);
    ctx.fill();
    ctx.stroke();
    ctx.font = '900 13px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`HURRY UP! ${remain}`, 0, 1);
    ctx.restore();
  }

  private renderTopRibbon(ctx: CanvasRenderingContext2D, theme: StageTheme): void {
    ctx.save();
    ctx.fillStyle = 'rgba(9, 15, 34, 0.72)';
    ctx.fillRect(0, 0, this.logicalWidth, 46);
    ctx.fillStyle = theme.accent;
    ctx.fillRect(0, 45, this.logicalWidth, 2);

    ctx.font = '900 13px "JetBrains Mono", monospace';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FEF08A';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${this.score.toLocaleString()}`, 16, 23);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    const badge =
      this.variant === 'puzzlebobble3'
        ? 'PUZZLE BOBBLE EVO 2.5D'
        : this.variant === 'puzzlebobble2'
        ? 'PUZZLE BOBBLE 2 · 2.5D'
        : 'PUZZLE BOBBLE · 2.5D';
    ctx.fillText(`${badge} · RD ${this.level}`, this.logicalWidth * 0.5, 23);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#7DD3FC';
    ctx.fillText(`HI ${this.highScore.toLocaleString()}`, this.logicalWidth - 16, 23);
    ctx.restore();
  }

  private renderTitleOverlay(ctx: CanvasRenderingContext2D): void {
    const cx = this.logicalWidth * 0.5;
    ctx.save();
    ctx.fillStyle = 'rgba(10, 14, 34, 0.62)';
    ctx.beginPath();
    ctx.roundRect(74, 152, 452, 342, 26);
    ctx.fill();
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.72)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Floating orbiting shimmering title bubbles
    for (let i = 0; i < 6; i++) {
      const a = this.clock * 1.1 + (i / 6) * Math.PI * 2;
      const bx = cx + Math.cos(a) * 165;
      const by = 228 + Math.sin(a) * 24;
      this.drawShimmerOrb25D(
        ctx,
        bx,
        by,
        15,
        (i % 7) as OrbColor,
        i === 0 && this.variant === 'puzzlebobble3' ? 'rainbow' : i === 3 && this.variant !== 'puzzlebobble' ? 'star' : 'normal',
        0,
        1,
        1,
        i
      );
    }

    const titleMain =
      this.variant === 'puzzlebobble3'
        ? 'PUZZLE BOBBLE EVO'
        : this.variant === 'puzzlebobble2'
        ? 'PUZZLE BOBBLE 2'
        : 'PUZZLE BOBBLE';
    const sub =
      this.variant === 'puzzlebobble3'
        ? '2.5D PRISM EVOLUTION · PULLEY SCALES · FEVER & BOSS'
        : this.variant === 'puzzlebobble2'
        ? 'BUST-A-MOVE AGAIN 2.5D · STAR ORBS & FAIRY RESCUE'
        : '1994 TAITO CLASSIC 2.5D · BUB & BOB SHIMMER EDITION';

    ctx.textAlign = 'center';
    ctx.font = '900 36px "Outfit", sans-serif';
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#1E1B4B';
    ctx.strokeText(titleMain, cx, 248);
    const tg = ctx.createLinearGradient(cx - 140, 220, cx + 140, 265);
    tg.addColorStop(0, '#FEF08A');
    tg.addColorStop(0.5, '#F9A8D4');
    tg.addColorStop(1, '#7DD3FC');
    ctx.fillStyle = tg;
    ctx.fillText(titleMain, cx, 248);

    ctx.font = '800 11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#E0F2FE';
    ctx.fillText(sub, cx, 286);

    // Feature highlight pills inside title card
    const bullets =
      this.variant === 'puzzlebobble3'
        ? [
            'Rainbow Prism, Bomb & Lightning Orbs',
            'Twin Pulley Balance Scales & Fever ×2',
            'Mouse / Touch / Joystick Precision Aim',
          ]
        : this.variant === 'puzzlebobble2'
        ? [
            'Star Bubbles Pop Entire Colors Instantly',
            'Rescue Trapped Winged Fairies & Drop Iron Orbs',
            'Press Shift / X / Down to Swap Active Orb',
          ]
        : [
            '2.5D Shimmering Glass Orbs & Cute Taito Icons',
            'Animated Bub & Bob Geared Bubble Launcher',
            'Bank Shots & Bouncing Avalanche Drops',
          ];

    ctx.font = '700 13px "Outfit", sans-serif';
    ctx.fillStyle = '#F8FAFC';
    bullets.forEach((b, i) => {
      ctx.fillText(`✦ ${b}`, cx, 336 + i * 26);
    });

    // Pulsing Start Prompt
    const pulse = 0.72 + 0.28 * Math.sin(this.clock * 6);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#34D399';
    ctx.beginPath();
    ctx.roundRect(cx - 134, 426, 268, 42, 21);
    ctx.fill();
    ctx.font = '900 15px "JetBrains Mono", monospace';
    ctx.fillStyle = '#052E16';
    ctx.fillText('PRESS SPACE / CLICK TO PLAY', cx, 452);
    ctx.restore();
  }

  private renderBannerOverlay(
    ctx: CanvasRenderingContext2D,
    title: string,
    sub: string,
    hint: string
  ): void {
    const cx = this.logicalWidth * 0.5;
    const cy = 340;
    ctx.save();
    ctx.fillStyle = 'rgba(10, 16, 38, 0.84)';
    ctx.strokeStyle = '#FEF08A';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.roundRect(cx - 190, cy - 72, 380, 144, 22);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = '900 30px "Outfit", sans-serif';
    ctx.fillStyle = '#FEF08A';
    ctx.fillText(title, cx, cy - 20);

    ctx.font = '700 14px "Outfit", sans-serif';
    ctx.fillStyle = '#F8FAFC';
    ctx.fillText(sub, cx, cy + 14);

    ctx.font = '800 12px "JetBrains Mono", monospace';
    ctx.fillStyle = '#7DD3FC';
    ctx.fillText(hint, cx, cy + 44);
    ctx.restore();
  }
}

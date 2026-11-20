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
import { drawPixelMatrixHD } from './arcadeGfx';
import { arcadeAudio } from './audio';

export type GalaxianShooterVariant = 'galaxian' | 'galaga' | 'phoenix' | 'gyruss';

// ============================================================================
// AUTHENTIC MULTI-COLOR PIXEL ART MATRICES (CACHED 2x HiDPI VIA arcadeGfx.ts)
// Each arcade classic has completely distinct enemy & starfighter silhouettes!
// ============================================================================

// --- GALAXIAN (1979 Namco) ---
const GALAXIAN_FLAGSHIP_0 = [
  '.....YY.....',
  '....YYYY....',
  '..Y.YRRYY.Y.',
  '.YY.RRRR.YY.',
  '.YYYYYYYYYY.',
  'Y.YBBBBBBY.Y',
  'Y..BYYYYB..Y',
  '...BB..BB...',
];
const GALAXIAN_FLAGSHIP_1 = [
  '.....YY.....',
  '....YYYY....',
  '.YY.YRRYY.YY',
  'YY..RRRR..YY',
  '.YYYYYYYYYY.',
  '..YBBBBBBY..',
  '...BYYYYB...',
  '..BB....BB..',
];
const GALAXIAN_ESCORT_0 = [
  '..R......R..',
  '...RR..RR...',
  '..RRRRRRRR..',
  '.RRYYRRYYRR.',
  'RRRRRRRRRRRR',
  'R.RRBBBBBR.R',
  '..R..BB..R..',
  '.R........R.',
];
const GALAXIAN_ESCORT_1 = [
  '...R....R...',
  '..RRR..RRR..',
  '.RRRRRRRRRR.',
  'RRRYYRRYYRRR',
  '.RRRRRRRRRR.',
  '..RRBBBBBR..',
  '...R.BB.R...',
  '..R......R..',
];
const GALAXIAN_CHARGER_0 = [
  '....PPPP....',
  '..PPPPPPPP..',
  '.PPYYPPYYPP.',
  'PPPPPPPPPPPP',
  'PP.PCCCCP.PP',
  '...PP..PP...',
  '..PP....PP..',
];
const GALAXIAN_CHARGER_1 = [
  '....PPPP....',
  '.PPPPPPPPPP.',
  'PPPYYPPYYPPP',
  '.PPPPPPPPPP.',
  '...PCCCCP...',
  '..PP....PP..',
  '.PP......PP.',
];
const GALAXIAN_DRONE_0 = [
  '...CCCCCC...',
  '.CCCCCCCCCC.',
  'CCYYCCCCYYCC',
  'CCCCCCCCCCCC',
  'CC.CRRRRC.CC',
  '...CC..CC...',
  '..CC....CC..',
];
const GALAXIAN_DRONE_1 = [
  '...CCCCCC...',
  '.CCCCCCCCCC.',
  'CCYYCCCCYYCC',
  '.CCCCCCCCCC.',
  '..CCRRRRC...',
  '.CC......CC.',
  'CC........CC',
];
const GALAXIP_ARMED = [
  '.....YY.....',
  '.....YY.....',
  '....WWWW....',
  '....WRRW....',
  '..B.WRRW.B..',
  '.BBWWWWWWBB.',
  'BBBBWWWWBBBB',
  'BB..WWWW..BB',
  'B...R..R...B',
];
const GALAXIP_FIRED = [
  '............',
  '............',
  '....WWWW....',
  '....WRRW....',
  '..B.WRRW.B..',
  '.BBWWWWWWBB.',
  'BBBBWWWWBBBB',
  'BB..WWWW..BB',
  'B...R..R...B',
];

// --- GALAGA (1981 Namco) ---
const GALAGA_BOSS_0 = [
  '....GGGG....',
  '..GGGGGGGG..',
  '.GGYYGGYYGG.',
  'GGRRGGGGRRGG',
  'GGGGGGGGGGGG',
  'G.GGYYYYGG.G',
  'G..G.GG.G..G',
  '..GG....GG..',
];
const GALAGA_BOSS_1 = [
  '....GGGG....',
  '..GGGGGGGG..',
  '.GGYYGGYYGG.',
  'GGRRGGGGRRGG',
  '.GGGGGGGGGG.',
  '..GGYYYYGG..',
  '.G.G.GG.G.G.',
  '.G........G.',
];
const GALAGA_GOEI_0 = [
  '..R......R..',
  '.RRR....RRR.',
  'RRRRWBBWRRRR',
  'RRRWWBBWWRRR',
  '.RRRWWWWWRR.',
  '..RR.WW.RR..',
  '...R....R...',
];
const GALAGA_GOEI_1 = [
  '...R....R...',
  '..RRR..RRR..',
  '.RRRWBBWRRR.',
  '.RRWWBBWWRR.',
  '..RRWWWWWR..',
  '..RR.WW.RR..',
  '.R........R.',
];
const GALAGA_ZAKO_0 = [
  '....YYYY....',
  '..YYBBBBYY..',
  '.YYBBRRBBYY.',
  'YYYYBBBBYYYY',
  'YY..BBBB..YY',
  '...YY..YY...',
  '..YY....YY..',
];
const GALAGA_ZAKO_1 = [
  '....YYYY....',
  '.YYYBBBBYYY.',
  '.YYBBRRBBYY.',
  '.YYYBBBBYYY.',
  '...YBBBBY...',
  '..YY....YY..',
  '.YY......YY.',
];
const GALAGA_BONUS_DRAGONFLY = [
  '....CCCC....',
  '.YYYYCCYYYY.',
  'YY.YYCCYY.YY',
  '....CRRC....',
  '..YYCCCCYY..',
  '....CCCC....',
  '...CC..CC...',
];
const GALAGA_FIGHTER = [
  '.....WW.....',
  '.....WW.....',
  '....WWWW....',
  '..R.WWWW.R..',
  '..RWWBBWWR..',
  'W.RWWBBWWR.W',
  'WWWRWWWWWRWW',
  'WWWRRWWWRRWW',
  'W..R....R..W',
];

// --- PHOENIX (1980 Amstar / Centuri) ---
const PHOENIX_SMALL_0 = [
  'W..........W',
  'WW...YY...WW',
  '.WW.YCCY.WW.',
  '..WWCCCCWW..',
  '...CCCCCC...',
  '..CC.RR.CC..',
  '....C..C....',
];
const PHOENIX_SMALL_1 = [
  '.....YY.....',
  '....YCCY....',
  '..WWCCCCWW..',
  '.WWCCCCCCWW.',
  'WW.CCRRCC.WW',
  'W...C..C...W',
  '............',
];
const PHOENIX_PLAYER = [
  '.....CC.....',
  '....CCCC....',
  '...CCWWCC...',
  '.C.CCWWCC.C.',
  'CC.CWWWWC.CC',
  'CCCCCCCCCCCC',
  'CC..RRRR..CC',
  '....R..R....',
];

// --- GYRUSS (1983 Konami) ---
const GYRUSS_ENEMY_A = [
  '....RRRR....',
  '..RRYYYYRR..',
  '.RRYWWWWYRR.',
  'RRRRCCCCRRRR',
  '.RR.CCCC.RR.',
  '..R......R..',
];
const GYRUSS_ENEMY_B = [
  '..CC....CC..',
  '.CCCYYYYCCC.',
  'CCCCWWWWCCCC',
  '.CCCRRRRCCC.',
  '...CC..CC...',
  '..C......C..',
];
const GYRUSS_PLAYER = [
  '.....WW.....',
  '....WWWW....',
  '...WWCCWW...',
  '..WWCCCCWW..',
  '.RWWWWWWWWR.',
  'RRWWWRRWWWRR',
  'R..YY..YY..R',
];

const GALAXIAN_PALETTE = { Y: '#FACC15', R: '#EF4444', B: '#38BDF8', W: '#F8FAFC', P: '#E879F9', C: '#22D3EE' };
const GALAGA_BOSS_GREEN = { G: '#22C55E', Y: '#FACC15', R: '#EF4444' };
const GALAGA_BOSS_BLUE = { G: '#38BDF8', Y: '#E879F9', R: '#FEF08A' };
const GALAGA_PALETTE = { R: '#EF4444', W: '#F8FAFC', B: '#3B82F6', Y: '#FACC15', C: '#38BDF8' };
const GALAGA_CAPTURED_PAL = { R: '#F43F5E', W: '#FB7185', B: '#9F1239' };
const PHOENIX_BLUE_PAL = { W: '#E0F2FE', Y: '#FACC15', C: '#38BDF8', R: '#F43F5E' };
const PHOENIX_GOLD_PAL = { W: '#FEF08A', Y: '#F97316', C: '#FACC15', R: '#EF4444' };
const PHOENIX_PINK_PAL = { W: '#FCE7F3', Y: '#FACC15', C: '#F472B6', R: '#EF4444' };
const PHOENIX_SHIP_PAL = { C: '#38BDF8', W: '#F8FAFC', R: '#F97316' };
const GYRUSS_PAL_A = { R: '#F43F5E', Y: '#FACC15', W: '#FFFFFF', C: '#38BDF8' };
const GYRUSS_PAL_B = { C: '#22D3EE', Y: '#A855F7', W: '#FFFFFF', R: '#F472B6' };
const GYRUSS_SHIP_PAL = { W: '#F8FAFC', C: '#38BDF8', R: '#EF4444', Y: '#FACC15' };

interface AlienUnit {
  id: number;
  kind:
    | 'grunt'
    | 'charger'
    | 'escort'
    | 'flagship'
    | 'bossGalaga'
    | 'phoenixSmall'
    | 'phoenixGiant'
    | 'satelliteRed'
    | 'satelliteOrb'
    | 'gyrussAsteroid'
    | 'bonusBug';
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  heading: number;
  hp: number;
  maxHp: number;
  state: 'entering' | 'formation' | 'diving' | 'beam' | 'egg';
  t: number;
  entrySide: number;
  color: string;
  fireCd: number;
  beamTimer: number;
  capturedShip: boolean;
  leftWing: boolean;
  rightWing: boolean;
  wingRegenTimer: number;
  orbitAngle: number;
  orbitR: number;
  orbitTargetR: number;
  escortLeaderId?: number;
}

interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fromEnemy: boolean;
  color: string;
  trail?: boolean;
}

interface StarDot {
  x: number;
  y: number;
  spd: number;
  angle: number;
  r: number;
  color: string;
  twinklePhase: number;
  size: number;
}

interface GyrussPlanet {
  name: string;
  radius: number;
  colorA: string;
  colorB: string;
  ringColor?: string;
}

const GYRUSS_PLANETS: GyrussPlanet[] = [
  { name: 'NEPTUNE', radius: 34, colorA: '#38BDF8', colorB: '#1D4ED8' },
  { name: 'URANUS', radius: 36, colorA: '#67E8F9', colorB: '#0E7490', ringColor: 'rgba(165, 243, 252, 0.55)' },
  { name: 'SATURN', radius: 38, colorA: '#FDE68A', colorB: '#B45309', ringColor: 'rgba(250, 204, 21, 0.72)' },
  { name: 'JUPITER', radius: 44, colorA: '#FDBA74', colorB: '#9A3412' },
  { name: 'MARS', radius: 32, colorA: '#FB7185', colorB: '#991B1B' },
  { name: 'EARTH', radius: 40, colorA: '#38BDF8', colorB: '#15803D' },
];

export class GalaxianShooterGame implements ArcadeGameInstance {
  public readonly logicalWidth = 640;
  public readonly logicalHeight = 680;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'Fire Laser';
  public readonly secondaryActionLabel: string;

  private readonly variant: GalaxianShooterVariant;
  private readonly storageKey: string;
  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();

  private score = 0;
  private highScore = 0;
  private level = 1;
  private lives = 3;
  private clock = 0;
  private stateTimer = 0;
  private nextId = 1;

  // Player state
  private px = 320;
  private py = 616;
  private gyrussAngle = Math.PI * 0.5;
  private gyrussRadius = 252;
  private dualFighter = false;
  private doubleLaser = false;
  private capturedAnimTimer = 0;
  private capturingBossId: number | null = null;
  private rescueDockTimer = 0;
  private rescueShipX = 320;
  private rescueShipY = 300;
  private invulnTimer = 0;
  private fireCd = 0;

  // Phoenix shield & Mothership boss
  private shieldTimer = 0;
  private shieldCd = 0;
  private mothershipActive = false;
  private mothershipY = 122;
  private mothershipBeltOffset = 0;
  private mothershipArmor: boolean[] = [];
  private mothershipCoreHp = 6;
  private mothershipMaxHp = 6;

  // Galaga Challenging Stage & Gyruss Chance Stage
  private bonusStage = false;
  private bonusHits = 0;
  private bonusTotal = 24;
  private bonusSpawned = 0;
  private bonusTimer = 0;

  private formSway = 0;
  private diveCd = 1.6;
  private aliens: AlienUnit[] = [];
  private shots: Shot[] = [];
  private stars: StarDot[] = [];
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];
  private screenFlash = 0;

  constructor(variant: GalaxianShooterVariant) {
    this.variant = variant;
    this.storageKey = `${variant}_hd_highscore_v2`;
    this.highScore = readHighScore(this.storageKey);
    this.secondaryActionLabel = variant === 'phoenix' ? 'Force Shield' : 'Rapid Fire';
    this.initStars();
    this.setupWave(1);
  }

  private initStars(): void {
    this.stars = [];
    const palette =
      this.variant === 'galaxian'
        ? ['#EF4444', '#38BDF8', '#FACC15', '#E879F9', '#22C55E', '#F8FAFC']
        : this.variant === 'galaga'
          ? ['#60A5FA', '#F43F5E', '#FDE047', '#34D399', '#FFFFFF', '#C084FC']
          : this.variant === 'phoenix'
            ? ['#FDE68A', '#FB923C', '#F472B6', '#C084FC', '#E0F2FE']
            : ['#FFFFFF', '#38BDF8', '#C084FC', '#FACC15', '#F472B6'];
    const count = this.variant === 'gyruss' ? 92 : 76;
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: Math.random() * this.logicalWidth,
        y: Math.random() * this.logicalHeight,
        spd: 28 + Math.random() * 115,
        angle: Math.random() * Math.PI * 2,
        r: 10 + Math.random() * 340,
        color: palette[i % palette.length],
        twinklePhase: Math.random() * Math.PI * 2,
        size: i % 5 === 0 ? 2.6 : 1.7,
      });
    }
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public startNewGame(): void {
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.dualFighter = false;
    this.doubleLaser = false;
    this.capturedAnimTimer = 0;
    this.capturingBossId = null;
    this.rescueDockTimer = 0;
    this.phase = 'READY';
    this.stateTimer = 0.9;
    this.setupWave(1);
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.setupWave(1);
  }

  private addScore(pts: number, x?: number, y?: number, label?: string): void {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(this.storageKey, this.highScore);
    }
    if (x !== undefined && y !== undefined) {
      this.popups.push({
        x,
        y,
        text: label ? `${label} +${pts}` : `+${pts}`,
        color: '#FEF08A',
        life: 0.9,
        maxLife: 0.9,
      });
    }
  }

  private setupWave(lvl: number): void {
    this.aliens = [];
    this.shots = [];
    this.mothershipActive = false;
    this.bonusStage = false;
    this.bonusHits = 0;
    this.bonusSpawned = 0;
    this.bonusTimer = 0;
    this.diveCd = 1.5;
    this.px = this.logicalWidth * 0.5;
    this.invulnTimer = 1.1;

    if (this.variant === 'galaga' && lvl % 3 === 0) {
      this.bonusStage = true;
      this.bonusTotal = 24;
      this.bonusTimer = 0.25;
      return;
    }

    if (this.variant === 'gyruss' && lvl % 3 === 0) {
      this.bonusStage = true;
      this.bonusTotal = 24;
      this.bonusTimer = 0.22;
      return;
    }

    if (this.variant === 'phoenix') {
      const cycle = ((lvl - 1) % 5) + 1;
      if (cycle === 5) {
        this.mothershipActive = true;
        this.mothershipY = 118;
        this.mothershipArmor = Array(14).fill(true);
        this.mothershipMaxHp = 6 + Math.floor(lvl / 5) * 2;
        this.mothershipCoreHp = this.mothershipMaxHp;
        for (let i = 0; i < 6; i++) {
          this.aliens.push({
            id: this.nextId++,
            kind: 'phoenixSmall',
            homeX: 110 + i * 84,
            homeY: 262,
            x: 110 + i * 84,
            y: -40 - i * 24,
            vx: 0,
            vy: 0,
            heading: 0,
            hp: 1,
            maxHp: 1,
            state: 'entering',
            t: 0,
            entrySide: i % 2 === 0 ? -1 : 1,
            color: '#F472B6',
            fireCd: 1.4 + Math.random(),
            beamTimer: 0,
            capturedShip: false,
            leftWing: true,
            rightWing: true,
            wingRegenTimer: 0,
            orbitAngle: 0,
            orbitR: 0,
            orbitTargetR: 0,
          });
        }
        return;
      }

      if (cycle === 3 || cycle === 4) {
        const count = cycle === 3 ? 6 : 8;
        for (let i = 0; i < count; i++) {
          const hx = 104 + (i % 4) * 144;
          const hy = 136 + Math.floor(i / 4) * 112;
          this.aliens.push({
            id: this.nextId++,
            kind: 'phoenixGiant',
            homeX: hx,
            homeY: hy,
            x: hx,
            y: hy,
            vx: (i % 2 === 0 ? 1 : -1) * (82 + lvl * 4),
            vy: 0,
            heading: 0,
            hp: 1,
            maxHp: 1,
            state: 'egg',
            t: 0.65 + i * 0.24,
            entrySide: 1,
            color: cycle === 3 ? '#F97316' : '#EF4444',
            fireCd: 1.3 + Math.random(),
            beamTimer: 0,
            capturedShip: false,
            leftWing: true,
            rightWing: true,
            wingRegenTimer: 0,
            orbitAngle: 0,
            orbitR: 0,
            orbitTargetR: 0,
          });
        }
        return;
      }

      // Waves 1–2: Iconic Small Blue (Wave 1) & Gold/Pink (Wave 2) Phoenix Birds
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 8; c++) {
          const hx = 96 + c * 64;
          const hy = 112 + r * 64;
          this.aliens.push({
            id: this.nextId++,
            kind: 'phoenixSmall',
            homeX: hx,
            homeY: hy,
            x: hx,
            y: -30 - r * 52,
            vx: 0,
            vy: 0,
            heading: 0,
            hp: 1,
            maxHp: 1,
            state: 'entering',
            t: -(r * 8 + c) * 0.06,
            entrySide: c < 4 ? -1 : 1,
            color: cycle === 1 ? '#38BDF8' : '#FACC15',
            fireCd: 1.4 + Math.random() * 1.5,
            beamTimer: 0,
            capturedShip: false,
            leftWing: true,
            rightWing: true,
            wingRegenTimer: 0,
            orbitAngle: 0,
            orbitR: 0,
            orbitTargetR: 0,
          });
        }
      }
      return;
    }

    if (this.variant === 'gyruss') {
      const count = Math.min(22, 14 + lvl * 2);
      for (let i = 0; i < count; i++) {
        const ring = i % 2;
        this.aliens.push({
          id: this.nextId++,
          kind: ring === 0 ? 'grunt' : 'charger',
          homeX: 0,
          homeY: 0,
          x: this.logicalWidth * 0.5,
          y: this.logicalHeight * 0.5,
          vx: 0,
          vy: 0,
          heading: 0,
          hp: 1,
          maxHp: 1,
          state: 'entering',
          t: -(i * 0.12),
          entrySide: i % 2 === 0 ? 1 : -1,
          color: ring === 0 ? '#F43F5E' : '#22D3EE',
          fireCd: 1.7 + Math.random() * 1.5,
          beamTimer: 0,
          capturedShip: false,
          leftWing: true,
          rightWing: true,
          wingRegenTimer: 0,
          orbitAngle: (i / count) * Math.PI * 2,
          orbitR: 6,
          orbitTargetR: ring === 0 ? 96 : 154,
        });
      }
      // Authentic 3-Satellite Trio: 2 outer cyan orbs + center Red Laser Upgrade Satellite!
      const satAngles = [-0.24, 0, 0.24];
      satAngles.forEach((off, idx) => {
        this.aliens.push({
          id: this.nextId++,
          kind: idx === 1 ? 'satelliteRed' : 'satelliteOrb',
          homeX: 0,
          homeY: 0,
          x: this.logicalWidth * 0.5,
          y: this.logicalHeight * 0.5,
          vx: 0,
          vy: 0,
          heading: 0,
          hp: 1,
          maxHp: 1,
          state: 'entering',
          t: -2.2,
          entrySide: 1,
          color: idx === 1 ? '#EF4444' : '#38BDF8',
          fireCd: 99,
          beamTimer: 0,
          capturedShip: false,
          leftWing: true,
          rightWing: true,
          wingRegenTimer: 0,
          orbitAngle: off,
          orbitR: 8,
          orbitTargetR: 186,
        });
      });
      // Spinning Space Asteroid hazard on Warp 2+
      if (lvl >= 2) {
        this.aliens.push({
          id: this.nextId++,
          kind: 'gyrussAsteroid',
          homeX: 0,
          homeY: 0,
          x: this.logicalWidth * 0.5,
          y: this.logicalHeight * 0.5,
          vx: 0,
          vy: 0,
          heading: 0,
          hp: 3,
          maxHp: 3,
          state: 'diving',
          t: -1.5,
          entrySide: -1,
          color: '#FB923C',
          fireCd: 99,
          beamTimer: 0,
          capturedShip: false,
          leftWing: true,
          rightWing: true,
          wingRegenTimer: 0,
          orbitAngle: Math.PI * 1.15,
          orbitR: 14,
          orbitTargetR: 260,
        });
      }
      return;
    }

    // Galaxian (1979) vs Galaga (1981) — authentic differing formation architectures!
    if (this.variant === 'galaxian') {
      // Authentic Galaxian: 2 Golden Flagships on row 0, 6 Red Escorts on row 1, 8 Purple Chargers on row 2, 10 Blue Drones on rows 3-4!
      const rowDefs: Array<{ cols: number; kind: AlienUnit['kind']; color: string }> = [
        { cols: 2, kind: 'flagship', color: '#FACC15' },
        { cols: 6, kind: 'escort', color: '#EF4444' },
        { cols: 8, kind: 'charger', color: '#E879F9' },
        { cols: 10, kind: 'grunt', color: '#38BDF8' },
        { cols: 10, kind: 'grunt', color: '#38BDF8' },
      ];
      rowDefs.forEach((rd, r) => {
        const spacing = 48;
        const startX = this.logicalWidth * 0.5 - ((rd.cols - 1) * spacing) * 0.5;
        for (let c = 0; c < rd.cols; c++) {
          const hx = startX + c * spacing;
          const hy = 96 + r * 44;
          this.aliens.push({
            id: this.nextId++,
            kind: rd.kind,
            homeX: hx,
            homeY: hy,
            x: hx,
            y: hy,
            vx: 0,
            vy: 0,
            heading: 0,
            hp: 1,
            maxHp: 1,
            state: 'formation',
            t: 0,
            entrySide: c < rd.cols * 0.5 ? -1 : 1,
            color: rd.color,
            fireCd: 1.5 + Math.random() * 2.4,
            beamTimer: 0,
            capturedShip: false,
            leftWing: true,
            rightWing: true,
            wingRegenTimer: 0,
            orbitAngle: 0,
            orbitR: 0,
            orbitTargetR: 0,
          });
        }
      });
      return;
    }

    // Galaga (1981): 4 Boss Galagas (2 HP, Green→Blue), 2 rows of 8 Red Goei Butterflies, 2 rows of 10 Yellow Zako Bees — flying in synchronized choreographed entrance ribbons!
    const galagaRows: Array<{ cols: number; kind: AlienUnit['kind']; color: string; hp: number }> = [
      { cols: 4, kind: 'bossGalaga', color: '#22C55E', hp: 2 },
      { cols: 8, kind: 'escort', color: '#EF4444', hp: 1 },
      { cols: 8, kind: 'escort', color: '#EF4444', hp: 1 },
      { cols: 10, kind: 'grunt', color: '#FACC15', hp: 1 },
      { cols: 10, kind: 'grunt', color: '#FACC15', hp: 1 },
    ];
    let orderIdx = 0;
    galagaRows.forEach((rd, r) => {
      const spacing = 48;
      const startX = this.logicalWidth * 0.5 - ((rd.cols - 1) * spacing) * 0.5;
      for (let c = 0; c < rd.cols; c++) {
        const hx = startX + c * spacing;
        const hy = 96 + r * 44;
        const side = c < rd.cols * 0.5 ? -1 : 1;
        this.aliens.push({
          id: this.nextId++,
          kind: rd.kind,
          homeX: hx,
          homeY: hy,
          x: side < 0 ? -32 : this.logicalWidth + 32,
          y: 44 + r * 44,
          vx: 0,
          vy: 0,
          heading: 0,
          hp: rd.hp,
          maxHp: rd.hp,
          state: 'entering',
          t: -(orderIdx * 0.065),
          entrySide: side,
          color: rd.color,
          fireCd: 1.5 + Math.random() * 2.2,
          beamTimer: 0,
          capturedShip: false,
          leftWing: true,
          rightWing: true,
          wingRegenTimer: 0,
          orbitAngle: 0,
          orbitR: 0,
          orbitTargetR: 0,
        });
        orderIdx++;
      }
    });
  }

  private getPlayerPos(): { x: number; y: number } {
    if (this.variant === 'gyruss') {
      const cx = this.logicalWidth * 0.5;
      const cy = this.logicalHeight * 0.5;
      return {
        x: cx + Math.cos(this.gyrussAngle) * this.gyrussRadius,
        y: cy + Math.sin(this.gyrussAngle) * this.gyrussRadius,
      };
    }
    return { x: this.px, y: this.py };
  }

  private hurtPlayer(): void {
    if (this.invulnTimer > 0 || this.shieldTimer > 0 || this.phase !== 'PLAYING') return;
    if (this.dualFighter) {
      this.dualFighter = false;
      this.invulnTimer = 1.6;
      this.screenFlash = 0.25;
      arcadeAudio.playExplosion(false);
      spawnBurst(this.particles, this.px + 18, this.py, '#FACC15', 18, 210, 3.2);
      return;
    }
    this.lives -= 1;
    this.doubleLaser = false;
    this.invulnTimer = 2.0;
    this.screenFlash = 0.35;
    const p = this.getPlayerPos();
    spawnBurst(this.particles, p.x, p.y, '#38BDF8', 26, 250, 3.8);
    arcadeAudio.playDeath();
    if (this.lives <= 0) this.phase = 'GAME_OVER';
  }

  public step(dt: number): void {
    this.clock += dt;
    this.screenFlash = Math.max(0, this.screenFlash - dt * 1.8);
    stepParticlesAndPopups(this.particles, this.popups, dt);
    if (this.phase === 'PAUSED' || this.phase === 'GAME_OVER') return;
    if (this.phase === 'READY') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) this.phase = 'PLAYING';
      return;
    }
    if (this.phase === 'STAGE_CLEAR') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.level += 1;
        this.phase = 'READY';
        this.stateTimer = 0.85;
        this.setupWave(this.level);
      }
      return;
    }

    const attract = this.phase === 'TITLE';
    this.fireCd = Math.max(0, this.fireCd - dt);
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    this.shieldTimer = Math.max(0, this.shieldTimer - dt);
    this.shieldCd = Math.max(0, this.shieldCd - dt);
    this.formSway = Math.sin(this.clock * (this.variant === 'galaxian' ? 1.35 : 1.55)) * 42;

    // Starfield
    for (const s of this.stars) {
      if (this.variant === 'gyruss') {
        s.r += dt * (110 + s.r * 1.15);
        if (s.r > 380) {
          s.r = 6;
          s.angle = Math.random() * Math.PI * 2;
        }
      } else {
        s.y = (s.y + s.spd * dt) % this.logicalHeight;
      }
    }

    // Galaga Fighter Rescue Docking Animation!
    if (this.rescueDockTimer > 0) {
      this.rescueDockTimer -= dt;
      const targetX = this.px + 20;
      this.rescueShipX += (targetX - this.rescueShipX) * Math.min(1, dt * 6);
      this.rescueShipY += (this.py - this.rescueShipY) * Math.min(1, dt * 5);
      if (this.rescueDockTimer <= 0) {
        this.dualFighter = true;
        spawnBurst(this.particles, this.px, this.py, '#FACC15', 18, 190, 3);
      }
    }

    // Galaga Tractor Beam Capture Animation!
    if (this.capturedAnimTimer > 0) {
      this.capturedAnimTimer -= dt;
      const boss = this.aliens.find((a) => a.id === this.capturingBossId);
      if (boss) {
        this.px += (boss.x - this.px) * Math.min(1, dt * 5.2);
        this.py += (boss.y - 28 - this.py) * Math.min(1, dt * 4.2);
      }
      if (this.capturedAnimTimer <= 0) {
        if (boss) {
          boss.capturedShip = true;
          boss.state = 'formation';
        }
        this.capturingBossId = null;
        this.lives -= 1;
        if (this.lives <= 0) {
          this.phase = 'GAME_OVER';
          return;
        }
        this.px = this.logicalWidth * 0.5;
        this.py = 616;
        this.invulnTimer = 2.0;
      }
      return;
    }

    // Phoenix Shield activation
    if (!attract && this.variant === 'phoenix' && (this.input.secondaryJustPressed || this.input.down) && this.shieldCd <= 0) {
      this.shieldTimer = 1.75;
      this.shieldCd = 4.4;
      arcadeAudio.playPowerUp();
    }

    // Player movement
    if (this.variant === 'gyruss') {
      if (attract) {
        this.gyrussAngle += 1.45 * dt;
      } else {
        const rotSpd = 3.6;
        if (this.input.left) this.gyrussAngle += rotSpd * dt;
        if (this.input.right) this.gyrussAngle -= rotSpd * dt;
        if (this.input.up) {
          const target = -Math.PI * 0.5;
          let d = target - this.gyrussAngle;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          this.gyrussAngle += Math.sign(d) * Math.min(Math.abs(d), rotSpd * dt);
        }
        if (this.input.down) {
          const target = Math.PI * 0.5;
          let d = target - this.gyrussAngle;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          this.gyrussAngle += Math.sign(d) * Math.min(Math.abs(d), rotSpd * dt);
        }
      }
    } else if (this.shieldTimer <= 0) {
      if (attract) {
        this.px = this.logicalWidth * 0.5 + Math.sin(this.clock * 1.55) * 210;
      } else {
        const spd = 340;
        if (this.input.left) this.px -= spd * dt;
        if (this.input.right) this.px += spd * dt;
        const pad = this.dualFighter ? 48 : 30;
        this.px = Math.max(pad, Math.min(this.logicalWidth - pad, this.px));
      }
    }

    // Authentic Player Firing Limits
    const playerShots = this.shots.filter((s) => !s.fromEnemy).length;
    const maxShots =
      this.variant === 'galaxian'
        ? 1
        : this.variant === 'galaga'
          ? this.dualFighter
            ? 4
            : 2
          : this.variant === 'gyruss'
            ? this.doubleLaser
              ? 6
              : 4
            : 2;

    const wantFire = attract ? Math.sin(this.clock * 6) > 0.72 : this.input.fire || this.input.fireJustPressed;
    if (wantFire && this.fireCd <= 0 && playerShots < maxShots && this.shieldTimer <= 0) {
      this.fireCd = this.variant === 'galaxian' ? 0.14 : 0.15;
      if (this.variant === 'gyruss') {
        const p = this.getPlayerPos();
        const cx = this.logicalWidth * 0.5;
        const cy = this.logicalHeight * 0.5;
        const dx = cx - p.x;
        const dy = cy - p.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = dx / len;
        const ny = dy / len;
        if (this.doubleLaser) {
          const pxOff = -ny * 10;
          const pyOff = nx * 10;
          this.shots.push({ x: p.x + pxOff, y: p.y + pyOff, vx: nx * 580, vy: ny * 580, fromEnemy: false, color: '#FACC15', trail: true });
          this.shots.push({ x: p.x - pxOff, y: p.y - pyOff, vx: nx * 580, vy: ny * 580, fromEnemy: false, color: '#FACC15', trail: true });
        } else {
          this.shots.push({ x: p.x, y: p.y, vx: nx * 580, vy: ny * 580, fromEnemy: false, color: '#38BDF8', trail: true });
        }
      } else if (this.dualFighter) {
        this.shots.push({ x: this.px - 17, y: this.py - 18, vx: 0, vy: -610, fromEnemy: false, color: '#FACC15', trail: true });
        this.shots.push({ x: this.px + 17, y: this.py - 18, vx: 0, vy: -610, fromEnemy: false, color: '#FACC15', trail: true });
      } else {
        const shotCol =
          this.variant === 'galaxian'
            ? '#FACC15'
            : this.variant === 'galaga'
              ? '#38BDF8'
              : '#67E8F9';
        this.shots.push({ x: this.px, y: this.py - 20, vx: 0, vy: -610, fromEnemy: false, color: shotCol, trail: true });
      }
      if (!attract) arcadeAudio.playLaser();
    }

    // Challenging / Chance Bonus Stage spawner
    if (this.bonusStage) {
      this.bonusTimer -= dt;
      if (this.bonusTimer <= 0 && this.bonusSpawned < this.bonusTotal) {
        this.bonusTimer = 0.22;
        const side = Math.floor(this.bonusSpawned / 6) % 2 === 0 ? -1 : 1;
        this.bonusSpawned += 1;
        this.aliens.push({
          id: this.nextId++,
          kind: 'bonusBug',
          homeX: 320,
          homeY: 200,
          x: this.variant === 'gyruss' ? this.logicalWidth * 0.5 : side < 0 ? -24 : this.logicalWidth + 24,
          y: this.variant === 'gyruss' ? this.logicalHeight * 0.5 : 136 + (this.bonusSpawned % 6) * 28,
          vx: side * 215,
          vy: 74,
          heading: 0,
          hp: 1,
          maxHp: 1,
          state: 'diving',
          t: 0,
          entrySide: side,
          color: '#38BDF8',
          fireCd: 99,
          beamTimer: 0,
          capturedShip: false,
          leftWing: true,
          rightWing: true,
          wingRegenTimer: 0,
          orbitAngle: (this.bonusSpawned / 6) * Math.PI * 2,
          orbitR: 8,
          orbitTargetR: 268,
        });
      }
    }

    // Update Phoenix Mothership
    if (this.mothershipActive) {
      this.mothershipBeltOffset = (this.mothershipBeltOffset + dt * 98) % 44;
      this.mothershipY = Math.min(395, this.mothershipY + dt * (5.2 + this.level * 0.4));
      if (Math.random() < dt * 1.45 && !attract) {
        this.shots.push({
          x: 155 + Math.random() * 330,
          y: this.mothershipY + 46,
          vx: (Math.random() - 0.5) * 68,
          vy: 235,
          fromEnemy: true,
          color: '#F97316',
        });
      }
      if (!attract && this.mothershipY >= 390) {
        this.hurtPlayer();
        this.mothershipY = 140;
      }
    }

    // Trigger authentic Diving Squadrons
    this.diveCd -= dt;
    if (!this.bonusStage && this.diveCd <= 0 && this.aliens.length > 0) {
      this.diveCd = Math.max(0.68, 2.1 - this.level * 0.14);
      const ready = this.aliens.filter((a) => a.state === 'formation' && a.kind !== 'satelliteRed' && a.kind !== 'satelliteOrb');
      if (ready.length > 0) {
        const pick = ready[Math.floor(Math.random() * ready.length)];
        if (pick.kind === 'bossGalaga' && !pick.capturedShip && !this.dualFighter && this.rescueDockTimer <= 0 && Math.random() < 0.44) {
          pick.state = 'beam';
          pick.beamTimer = 2.8;
          pick.t = 0;
        } else {
          pick.state = 'diving';
          pick.t = 0;
          if (pick.kind === 'flagship') {
            const escorts = ready
              .filter((e) => e.kind === 'escort')
              .sort((a, b) => Math.abs(a.homeX - pick.homeX) - Math.abs(b.homeX - pick.homeX))
              .slice(0, 2);
            for (const esc of escorts) {
              esc.state = 'diving';
              esc.t = 0;
              esc.escortLeaderId = pick.id;
            }
          }
        }
      }
    }

    // Update Aliens
    const pPos = this.getPlayerPos();
    for (let i = this.aliens.length - 1; i >= 0; i--) {
      const a = this.aliens[i];
      if (a.state === 'egg') {
        a.t -= dt;
        if (a.t <= 0) {
          a.state = 'formation';
          spawnBurst(this.particles, a.x, a.y, '#FACC15', 10, 140, 2.4);
        }
        continue;
      }

      const prevX = a.x;
      const prevY = a.y;

      if (this.variant === 'gyruss') {
        const cx = this.logicalWidth * 0.5;
        const cy = this.logicalHeight * 0.5;
        if (this.bonusStage) {
          a.orbitR += dt * 118;
          a.orbitAngle += dt * 2.25 * a.entrySide;
          a.x = cx + Math.cos(a.orbitAngle) * a.orbitR;
          a.y = cy + Math.sin(a.orbitAngle) * a.orbitR;
          if (a.orbitR > 356) {
            this.aliens.splice(i, 1);
            continue;
          }
        } else if (a.state === 'entering') {
          a.t += dt;
          if (a.t > 0) {
            a.orbitR = Math.min(a.orbitTargetR, a.orbitR + dt * 145);
            a.orbitAngle += dt * 3.15 * a.entrySide;
            a.x = cx + Math.cos(a.orbitAngle) * a.orbitR;
            a.y = cy + Math.sin(a.orbitAngle) * a.orbitR;
            if (a.orbitR >= a.orbitTargetR) a.state = 'formation';
          }
        } else if (a.state === 'formation') {
          const spd = a.kind === 'satelliteRed' || a.kind === 'satelliteOrb' ? 1.45 : 0.96 + this.level * 0.08;
          a.orbitAngle += dt * spd * a.entrySide;
          a.x = cx + Math.cos(a.orbitAngle) * a.orbitTargetR;
          a.y = cy + Math.sin(a.orbitAngle) * a.orbitTargetR;
        } else if (a.state === 'diving') {
          if (a.t < 0) {
            a.t += dt;
            continue;
          }
          a.orbitR += dt * (a.kind === 'gyrussAsteroid' ? 145 : 192);
          a.orbitAngle += dt * (a.kind === 'gyrussAsteroid' ? 0.55 : 1.4) * a.entrySide;
          a.x = cx + Math.cos(a.orbitAngle) * a.orbitR;
          a.y = cy + Math.sin(a.orbitAngle) * a.orbitR;
          if (a.orbitR > 345) {
            a.orbitR = 14;
            a.orbitAngle = Math.random() * Math.PI * 2;
            if (a.kind !== 'gyrussAsteroid') a.state = 'entering';
          }
        }
      } else if (a.state === 'entering') {
        a.t += dt;
        if (a.t > 0) {
          const prog = Math.min(1, a.t / 1.12);
          const curveX = a.entrySide < 0 ? 115 + Math.sin(prog * Math.PI) * 270 : 525 - Math.sin(prog * Math.PI) * 270;
          const curveY = 475 * Math.sin(prog * Math.PI * 0.85);
          a.x = curveX * (1 - prog) + (a.homeX + this.formSway) * prog;
          a.y = curveY * (1 - prog) + a.homeY * prog;
          if (prog >= 1) {
            a.state = 'formation';
            a.heading = 0;
          }
        }
      } else if (a.state === 'formation') {
        if (a.kind === 'phoenixGiant') {
          a.x += a.vx * dt;
          if (a.x < 72 || a.x > this.logicalWidth - 72) a.vx = -a.vx;
          a.y = a.homeY + Math.sin(this.clock * 2.5 + a.id) * 24;
          if (!a.leftWing || !a.rightWing) {
            a.wingRegenTimer += dt;
            if (a.wingRegenTimer >= 4.2) {
              a.leftWing = true;
              a.rightWing = true;
              a.wingRegenTimer = 0;
            }
          }
        } else {
          a.x = a.homeX + this.formSway;
          a.y = a.homeY;
          a.heading = 0;
        }
      } else if (a.state === 'beam') {
        const targetY = 414;
        if (a.y < targetY) {
          a.y += 225 * dt;
          a.x += (this.px - a.x) * Math.min(1, dt * 1.9);
        } else {
          a.beamTimer -= dt;
          if (!attract && this.invulnTimer <= 0 && !this.dualFighter && Math.abs(this.px - a.x) < 42) {
            this.capturedAnimTimer = 1.35;
            this.capturingBossId = a.id;
            arcadeAudio.playPowerUp();
            this.popups.push({ x: this.px, y: this.py - 32, text: 'FIGHTER CAPTURED!', color: '#38BDF8', life: 1.35, maxLife: 1.35 });
            return;
          }
          if (a.beamTimer <= 0) {
            a.state = 'formation';
          }
        }
      } else if (a.state === 'diving') {
        a.t += dt;
        if (this.bonusStage) {
          a.x += a.vx * dt;
          a.y += Math.sin(a.t * 3.9) * 168 * dt + 44 * dt;
          if (a.x < -50 || a.x > this.logicalWidth + 50 || a.y > this.logicalHeight + 40) {
            this.aliens.splice(i, 1);
            continue;
          }
        } else {
          a.y += (215 + this.level * 14) * dt;
          a.x += Math.sin(a.t * 4.6 + a.id) * 185 * dt + Math.sign(this.px - a.x) * 50 * dt;
          if (a.y > this.logicalHeight + 24) {
            a.y = -24;
            a.state = 'formation';
            a.heading = 0;
          }
        }
      }

      // Compute smooth bank/heading angle for diving & entering ships
      if (a.state === 'diving' || a.state === 'entering') {
        const dx = a.x - prevX;
        const dy = a.y - prevY;
        if (Math.hypot(dx, dy) > 0.25) {
          a.heading = Math.atan2(dy, dx) - Math.PI * 0.5;
        }
      }

      // Enemy firing
      if (
        !this.bonusStage &&
        a.state !== 'entering' &&
        a.state !== 'beam' &&
        a.kind !== 'satelliteRed' &&
        a.kind !== 'satelliteOrb' &&
        a.kind !== 'gyrussAsteroid'
      ) {
        a.fireCd -= dt;
        if (a.fireCd <= 0 && !attract) {
          a.fireCd = Math.max(1.15, 2.95 - this.level * 0.14) + Math.random();
          const dx = pPos.x - a.x;
          const dy = pPos.y - a.y;
          const len = Math.hypot(dx, dy) || 1;
          const bSpd = 218 + this.level * 10;
          const enemyShotCol =
            this.variant === 'phoenix' ? '#FACC15' : this.variant === 'gyruss' ? '#F472B6' : '#F43F5E';
          this.shots.push({
            x: a.x,
            y: a.y + 10,
            vx: this.variant === 'gyruss' ? (dx / len) * bSpd : (dx / len) * bSpd * 0.45,
            vy: this.variant === 'gyruss' ? (dy / len) * bSpd : bSpd,
            fromEnemy: true,
            color: enemyShotCol,
          });
        }
      }

      // Direct collision with player
      if (!attract && Math.hypot(a.x - pPos.x, a.y - pPos.y) < 25) {
        if (this.shieldTimer > 0) {
          spawnBurst(this.particles, a.x, a.y, '#38BDF8', 18, 210, 3.2);
          this.aliens.splice(i, 1);
          this.addScore(200, a.x, a.y, 'SHIELD ZAP');
        } else {
          this.hurtPlayer();
          if (a.state === 'diving' && a.kind !== 'gyrussAsteroid') this.aliens.splice(i, 1);
        }
      }
    }

    // Update shots & check hits
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.x < -20 || s.x > this.logicalWidth + 20 || s.y < -20 || s.y > this.logicalHeight + 20) {
        this.shots.splice(i, 1);
        continue;
      }
      if (this.variant === 'gyruss' && !s.fromEnemy && Math.hypot(s.x - this.logicalWidth * 0.5, s.y - this.logicalHeight * 0.5) < 16) {
        this.shots.splice(i, 1);
        continue;
      }

      if (s.fromEnemy) {
        if (!attract && Math.hypot(s.x - pPos.x, s.y - pPos.y) < 17) {
          this.shots.splice(i, 1);
          this.hurtPlayer();
        }
        continue;
      }

      // Check Phoenix Mothership shield belt & core!
      if (this.mothershipActive && s.y <= this.mothershipY + 46 && s.y >= this.mothershipY - 40 && s.x >= 110 && s.x <= 530) {
        const col = Math.floor((s.x - 110) / 30);
        if (s.y >= this.mothershipY + 14 && col >= 0 && col < this.mothershipArmor.length && this.mothershipArmor[col]) {
          this.mothershipArmor[col] = false;
          this.shots.splice(i, 1);
          spawnBurst(this.particles, s.x, s.y, '#38BDF8', 10, 150, 2.6);
          arcadeAudio.playRockThud();
          this.addScore(100);
          continue;
        }
        if (Math.abs(s.x - this.logicalWidth * 0.5) < 40 && s.y <= this.mothershipY + 14) {
          this.shots.splice(i, 1);
          this.mothershipCoreHp -= 1;
          this.screenFlash = 0.22;
          spawnBurst(this.particles, s.x, s.y, '#FACC15', 18, 230, 3.4);
          arcadeAudio.playExplosion(false);
          if (this.mothershipCoreHp <= 0) {
            this.mothershipActive = false;
            this.aliens = [];
            this.screenFlash = 0.5;
            arcadeAudio.playStageClear();
            spawnBurst(this.particles, this.logicalWidth * 0.5, this.mothershipY, '#F97316', 44, 310, 4.4);
            this.addScore(4000, this.logicalWidth * 0.5, this.mothershipY, 'MOTHERSHIP DESTROYED!');
            this.phase = 'STAGE_CLEAR';
            this.stateTimer = 1.65;
          }
          continue;
        }
      }

      // Check Alien hits
      for (let j = this.aliens.length - 1; j >= 0; j--) {
        const a = this.aliens[j];
        if (a.state === 'egg' || (a.state === 'entering' && a.t < 0)) continue;

        if (a.kind === 'phoenixGiant') {
          if (Math.abs(s.y - a.y) < 22) {
            if (Math.abs(s.x - a.x) < 17) {
              this.shots.splice(i, 1);
              this.aliens.splice(j, 1);
              spawnBurst(this.particles, a.x, a.y, '#F97316', 24, 240, 3.5);
              if (!attract) {
                arcadeAudio.playExplosion(true);
                this.addScore(600, a.x, a.y, 'PHOENIX CORE');
              }
              break;
            } else if (a.leftWing && s.x < a.x - 16 && s.x > a.x - 56) {
              a.leftWing = false;
              a.wingRegenTimer = 0;
              this.shots.splice(i, 1);
              spawnBurst(this.particles, s.x, s.y, '#FACC15', 12, 165, 2.7);
              if (!attract) {
                arcadeAudio.playRockThud();
                this.addScore(150, s.x, s.y, 'WING');
              }
              break;
            } else if (a.rightWing && s.x > a.x + 16 && s.x < a.x + 56) {
              a.rightWing = false;
              a.wingRegenTimer = 0;
              this.shots.splice(i, 1);
              spawnBurst(this.particles, s.x, s.y, '#FACC15', 12, 165, 2.7);
              if (!attract) {
                arcadeAudio.playRockThud();
                this.addScore(150, s.x, s.y, 'WING');
              }
              break;
            }
          }
          continue;
        }

        if (Math.hypot(a.x - s.x, a.y - s.y) < 21) {
          this.shots.splice(i, 1);
          a.hp -= 1;
          if (a.hp > 0) {
            if (a.kind === 'bossGalaga') a.color = '#38BDF8';
            spawnBurst(this.particles, a.x, a.y, '#38BDF8', 8, 130, 2.2);
            arcadeAudio.playRockThud();
          } else {
            this.aliens.splice(j, 1);
            spawnBurst(this.particles, a.x, a.y, a.color, 16, 205, 3.1);
            if (!attract) {
              arcadeAudio.playExplosion(a.kind === 'bossGalaga' || a.kind === 'flagship');
              if (a.kind === 'satelliteRed') {
                this.doubleLaser = true;
                this.screenFlash = 0.2;
                arcadeAudio.playPowerUp();
                this.addScore(1000, a.x, a.y, 'DOUBLE LASER!');
              } else if (a.kind === 'satelliteOrb') {
                this.addScore(300, a.x, a.y);
              } else if (a.kind === 'gyrussAsteroid') {
                this.addScore(500, a.x, a.y, 'METEOR');
              } else if (a.capturedShip) {
                if (a.state === 'diving') {
                  this.rescueDockTimer = 0.95;
                  this.rescueShipX = a.x;
                  this.rescueShipY = a.y - 24;
                  arcadeAudio.playExtraLife();
                  this.addScore(1000, a.x, a.y, 'FIGHTER RESCUED!');
                } else {
                  this.addScore(400, a.x, a.y, 'RESCUE ON DIVE!');
                }
              } else if (a.kind === 'flagship' && a.state === 'diving') {
                const liveEscorts = this.aliens.filter((e) => e.escortLeaderId === a.id).length;
                const pts = liveEscorts === 0 ? 800 : liveEscorts === 1 ? 300 : 200;
                this.addScore(pts, a.x, a.y, liveEscorts === 0 ? 'FLAGSHIP 800!' : undefined);
              } else {
                const pts = a.kind === 'bossGalaga' ? 400 : a.state === 'diving' ? 160 : 80;
                this.addScore(pts, a.x, a.y);
              }
              if (this.bonusStage) this.bonusHits += 1;
            }
          }
          break;
        }
      }
    }

    // Wave / Bonus Stage completion
    if (!attract) {
      if (this.bonusStage && this.bonusSpawned >= this.bonusTotal && this.aliens.length === 0) {
        const perfect = this.bonusHits >= this.bonusTotal;
        this.addScore(
          perfect ? 10000 : this.bonusHits * 100,
          this.logicalWidth * 0.5,
          290,
          perfect ? 'PERFECT STAGE!' : 'BONUS'
        );
        arcadeAudio.playStageClear();
        this.phase = 'STAGE_CLEAR';
        this.stateTimer = 1.6;
      } else if (
        !this.bonusStage &&
        !this.mothershipActive &&
        this.aliens.filter((a) => a.kind !== 'gyrussAsteroid').length === 0
      ) {
        arcadeAudio.playStageClear();
        this.phase = 'STAGE_CLEAR';
        this.stateTimer = 1.3;
      }
    }
  }

  public getHudSnapshot(): ClassicGameHud {
    const planet = GYRUSS_PLANETS[(this.level - 1) % GYRUSS_PLANETS.length];
    const phoenixWave = ((this.level - 1) % 5) + 1;
    const names: Record<GalaxianShooterVariant, string> = {
      galaxian: 'GALAXIAN (1979)',
      galaga: this.bonusStage ? 'GALAGA · CHALLENGING STAGE' : 'GALAGA (1981)',
      phoenix: this.mothershipActive
        ? 'PHOENIX · MOTHERSHIP BOSS'
        : phoenixWave >= 3
          ? 'PHOENIX · GIANT BIRDS'
          : 'PHOENIX · FIREBIRDS',
      gyruss: this.bonusStage ? `GYRUSS · CHANCE STAGE` : `GYRUSS · TO ${planet.name}`,
    };
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: `${names[this.variant]} · STAGE ${this.level}`,
      primaryMetricLabel: this.bonusStage ? 'HITS' : this.mothershipActive ? 'CORE HP' : 'SWARM',
      primaryMetricValue: this.bonusStage
        ? `${this.bonusHits}/${this.bonusTotal}`
        : this.mothershipActive
          ? `${this.mothershipCoreHp}/${this.mothershipMaxHp}`
          : String(this.aliens.length),
      secondaryMetricLabel:
        this.variant === 'galaga'
          ? 'FIGHTER'
          : this.variant === 'phoenix'
            ? 'SHIELD'
            : this.variant === 'gyruss'
              ? 'WEAPON'
              : 'GALAXIP',
      secondaryMetricValue:
        this.variant === 'galaga'
          ? this.dualFighter
            ? 'DUAL 2X'
            : 'SINGLE'
          : this.variant === 'phoenix'
            ? this.shieldTimer > 0
              ? 'ACTIVE!'
              : this.shieldCd <= 0
                ? 'READY'
                : `${Math.ceil(this.shieldCd)}s`
            : this.variant === 'gyruss'
              ? this.doubleLaser
                ? 'DOUBLE'
                : 'SINGLE'
              : this.shots.some((s) => !s.fromEnemy)
                ? 'IN FLIGHT'
                : 'ARMED',
      bannerText: this.phase === 'STAGE_CLEAR' ? 'STAGE CLEARED!' : this.phase === 'GAME_OVER' ? 'GAME OVER' : '',
    };
  }

  private renderBackdrop(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    if (this.variant === 'galaxian') {
      // 1979 Namco pitch-black starfield with twinkling multicolor RGB phosphor stars
      ctx.fillStyle = '#02030A';
      ctx.fillRect(0, 0, W, H);
      for (const s of this.stars) {
        const blink = Math.sin(this.clock * 7.5 + s.twinklePhase) > -0.25;
        if (!blink) continue;
        ctx.fillStyle = s.color;
        ctx.fillRect(s.x, s.y, s.size, s.size);
      }
      // Subtle top & bottom Namco crimson/amber cabinet pinstripe accents
      ctx.fillStyle = 'rgba(250, 204, 21, 0.16)';
      ctx.fillRect(16, H - 30, W - 32, 1.5);
    } else if (this.variant === 'galaga') {
      // 1981 Namco deep indigo-void with crisp multi-layer twinkling Galaga starfield
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#020410');
      bg.addColorStop(0.55, '#05081A');
      bg.addColorStop(1, '#02030C');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      for (const s of this.stars) {
        const a = 0.45 + 0.55 * Math.sin(this.clock * 9 + s.twinklePhase);
        ctx.globalAlpha = a;
        ctx.fillStyle = s.color;
        ctx.fillRect(s.x, s.y, s.size, s.size);
      }
      ctx.globalAlpha = 1;
    } else if (this.variant === 'phoenix') {
      // 1980 Amstar warm twilight cosmic violet-and-nebula sky!
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0B0418');
      bg.addColorStop(0.45, '#190829');
      bg.addColorStop(0.85, '#10071F');
      bg.addColorStop(1, '#06030E');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Glowing distant cosmic phoenix nebula band
      const neb = ctx.createRadialGradient(W * 0.5, H * 0.34, 20, W * 0.5, H * 0.34, 280);
      neb.addColorStop(0, 'rgba(249, 115, 22, 0.15)');
      neb.addColorStop(0.55, 'rgba(192, 38, 211, 0.08)');
      neb.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = neb;
      ctx.fillRect(0, 0, W, H);

      for (const s of this.stars) {
        ctx.fillStyle = s.color;
        ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(this.clock * 4 + s.twinklePhase));
        ctx.fillRect(s.x, s.y, s.size, s.size);
      }
      ctx.globalAlpha = 1;

      // Iconic Amstar horizon energy baseline
      ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.fillRect(24, H - 36, W - 48, 2);
    } else {
      // 1983 Konami Gyruss — 3D Hyperspace Warp Tunnel & Approaching Destination Planet!
      const cx = W * 0.5;
      const cy = H * 0.5;
      const bg = ctx.createRadialGradient(cx, cy, 12, cx, cy, 380);
      bg.addColorStop(0, '#130A2E');
      bg.addColorStop(0.45, '#06071C');
      bg.addColorStop(1, '#02020A');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Pulsing 3D warp depth tunnel rings expanding from vanishing point
      ctx.lineWidth = 1.25;
      for (let k = 0; k < 5; k++) {
        const ringR = ((this.clock * 78 + k * 72) % 360) + 14;
        const alpha = Math.max(0, 0.16 * (1 - ringR / 375));
        ctx.strokeStyle = `rgba(99, 102, 241, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Radial streaking warp stars!
      for (const s of this.stars) {
        const r0 = Math.max(4, s.r - (3 + s.r * 0.045));
        const x0 = cx + Math.cos(s.angle) * r0;
        const y0 = cy + Math.sin(s.angle) * r0;
        const x1 = cx + Math.cos(s.angle) * s.r;
        const y1 = cy + Math.sin(s.angle) * s.r;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.r > 180 ? 2 : 1.2;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }

      // Approaching Destination Planet at the warp vanishing point!
      const planet = GYRUSS_PLANETS[(this.level - 1) % GYRUSS_PLANETS.length];
      const pScale = 0.52 + Math.min(0.48, (this.clock * 0.015) % 0.48);
      const pr = planet.radius * pScale;
      ctx.save();
      ctx.translate(cx, cy);
      if (planet.ringColor) {
        ctx.strokeStyle = planet.ringColor;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(0, 0, pr * 1.85, pr * 0.46, -0.32, 0, Math.PI * 2);
        ctx.stroke();
      }
      const pg = ctx.createRadialGradient(-pr * 0.35, -pr * 0.35, pr * 0.12, 0, 0, pr);
      pg.addColorStop(0, planet.colorA);
      pg.addColorStop(1, planet.colorB);
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(0, 0, pr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Subtle Gyruss outer orbital flight track ring
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.arc(cx, cy, this.gyrussRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  private renderPhoenixMothership(ctx: CanvasRenderingContext2D, W: number): void {
    const my = this.mothershipY;
    ctx.save();

    // Outer armored saucer silhouette
    const hullGrad = ctx.createLinearGradient(110, my - 44, 110, my + 38);
    hullGrad.addColorStop(0, '#4338CA');
    hullGrad.addColorStop(0.5, '#1E1B4B');
    hullGrad.addColorStop(1, '#312E81');
    ctx.fillStyle = hullGrad;
    ctx.beginPath();
    ctx.moveTo(154, my - 42);
    ctx.lineTo(W - 154, my - 42);
    ctx.lineTo(W - 102, my - 8);
    ctx.lineTo(W - 110, my + 34);
    ctx.lineTo(110, my + 34);
    ctx.lineTo(102, my - 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 2.8;
    ctx.stroke();

    // Illuminated side portholes
    for (let i = 0; i < 6; i++) {
      const lit = (Math.floor(this.clock * 8) + i) % 2 === 0;
      ctx.fillStyle = lit ? '#FEF08A' : '#FB923C';
      ctx.fillRect(136 + i * 24, my - 24, 10, 6);
      ctx.fillRect(W - 146 - i * 24, my - 24, 10, 6);
    }

    // Central glass cupola housing the animated green Alien Commander!
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(W * 0.5, my - 10, 28, Math.PI, 0);
    ctx.lineTo(W * 0.5 + 28, my + 8);
    ctx.lineTo(W * 0.5 - 28, my + 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Pulsing Alien Commander inside the dome
    const bob = Math.sin(this.clock * 7) * 2.5;
    ctx.fillStyle = this.mothershipCoreHp <= 2 ? '#EF4444' : '#22C55E';
    ctx.beginPath();
    ctx.ellipse(W * 0.5, my - 6 + bob, 14, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FEF08A';
    ctx.fillRect(W * 0.5 - 7, my - 10 + bob, 4, 4);
    ctx.fillRect(W * 0.5 + 3, my - 10 + bob, 4, 4);

    // Destructible Armor Hull Blocks (above conveyor belt)
    for (let i = 0; i < this.mothershipArmor.length; i++) {
      if (!this.mothershipArmor[i]) continue;
      const bx = 112 + i * 30;
      ctx.fillStyle = i % 2 === 0 ? '#22C55E' : '#F97316';
      ctx.fillRect(bx, my + 11, 26, 11);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(bx, my + 11, 26, 3);
    }

    // Iconic Scrolling Cyan & Gold Conveyor Shield Belt!
    ctx.fillStyle = '#0E7490';
    ctx.fillRect(110, my + 24, W - 220, 11);
    for (let x = 110 + this.mothershipBeltOffset; x < W - 122; x += 44) {
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(x, my + 25, 24, 9);
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(x + 4, my + 27, 16, 4);
    }
    ctx.restore();
  }

  private renderGiantPhoenix(ctx: CanvasRenderingContext2D, a: AlienUnit): void {
    const flap = Math.sin(this.clock * 10 + a.id) * 11;
    const isCrimson = a.color === '#EF4444';
    const outerCol = isCrimson ? '#EF4444' : '#F97316';
    const midCol = isCrimson ? '#F472B6' : '#FACC15';

    // Articulated Multi-Feather Left Wing (independently shootable!)
    if (a.leftWing) {
      ctx.fillStyle = outerCol;
      ctx.beginPath();
      ctx.moveTo(-10, -2);
      ctx.lineTo(-56, -18 + flap);
      ctx.lineTo(-48, 2 + flap * 0.7);
      ctx.lineTo(-52, 16 + flap * 0.45);
      ctx.lineTo(-14, 12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = midCol;
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(-42, -10 + flap * 0.85);
      ctx.lineTo(-36, 9 + flap * 0.4);
      ctx.closePath();
      ctx.fill();
    } else {
      // Smoking wing stump while regenerating
      ctx.fillStyle = '#64748B';
      ctx.fillRect(-20, -3, 10, 6);
    }

    // Articulated Multi-Feather Right Wing (independently shootable!)
    if (a.rightWing) {
      ctx.fillStyle = outerCol;
      ctx.beginPath();
      ctx.moveTo(10, -2);
      ctx.lineTo(56, -18 + flap);
      ctx.lineTo(48, 2 + flap * 0.7);
      ctx.lineTo(52, 16 + flap * 0.45);
      ctx.lineTo(14, 12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = midCol;
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(42, -10 + flap * 0.85);
      ctx.lineTo(36, 9 + flap * 0.4);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = '#64748B';
      ctx.fillRect(10, -3, 10, 6);
    }

    // Fiery Tail Plume & Crested Head
    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.moveTo(0, -19);
    ctx.lineTo(7, -11);
    ctx.lineTo(-7, -11);
    ctx.closePath();
    ctx.fill();

    // Pulsing Vulnerable Core Heart
    const pulse = 1 + Math.sin(this.clock * 14 + a.id) * 0.1;
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(0, 0, 14 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(0, 2, 7.5 * pulse, 0, Math.PI * 2);
    ctx.fill();

    // Fierce Phoenix Eyes
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(-6, -6, 4, 4);
    ctx.fillRect(2, -6, 4, 4);
  }

  private renderFooterBadges(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    // Authentic Namco Stage Flags & Reserve Ships along the bottom bezel!
    if (this.variant === 'galaxian' || this.variant === 'galaga') {
      // Reserve life mini-ships (bottom-left)
      const reserve = Math.max(0, Math.min(5, this.lives - 1));
      for (let i = 0; i < reserve; i++) {
        drawPixelMatrixHD(
          ctx,
          this.variant === 'galaxian' ? GALAXIP_ARMED : GALAGA_FIGHTER,
          36 + i * 26,
          H - 16,
          1.4,
          this.variant === 'galaxian' ? GALAXIAN_PALETTE : GALAGA_PALETTE
        );
      }
      // Stage Flag Pennants (bottom-right)
      const tens = Math.floor(this.level / 10);
      const ones = this.level % 10;
      let fx = W - 28;
      for (let i = 0; i < Math.min(6, ones); i++) {
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(fx, H - 24, 2, 14);
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.moveTo(fx + 2, H - 24);
        ctx.lineTo(fx + 12, H - 20);
        ctx.lineTo(fx + 2, H - 16);
        ctx.closePath();
        ctx.fill();
        fx -= 16;
      }
      for (let i = 0; i < Math.min(3, tens); i++) {
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(fx, H - 26, 2.5, 16);
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(fx + 2.5, H - 26, 12, 9);
        fx -= 20;
      }
    } else if (this.variant === 'phoenix') {
      // Phoenix Shield Charge Bar at bottom center
      const ready = this.shieldCd <= 0;
      const pct = ready ? 1 : 1 - this.shieldCd / 4.4;
      const bw = 160;
      const bx = W * 0.5 - bw * 0.5;
      const by = H - 22;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(bx, by, bw, 10);
      ctx.fillStyle = this.shieldTimer > 0 ? '#FFFFFF' : ready ? '#38BDF8' : '#F97316';
      ctx.fillRect(bx + 1, by + 1, (bw - 2) * pct, 8);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, bw, 10);
      ctx.font = '800 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = ready ? '#67E8F9' : '#CBD5E1';
      ctx.fillText(this.shieldTimer > 0 ? 'FORCE SHIELD ACTIVE' : ready ? 'SHIELD READY [SHIFT / DOWN]' : 'RECHARGING SHIELD', W * 0.5, by - 4);
    } else {
      // Gyruss Planet Warp Telemetry Strip at bottom
      const planet = GYRUSS_PLANETS[(this.level - 1) % GYRUSS_PLANETS.length];
      ctx.font = '800 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#67E8F9';
      ctx.fillText(`DESTINATION: ${planet.name}  ·  ${this.doubleLaser ? 'DOUBLE PLASMA ACTIVE' : 'SHOOT RED SATELLITE FOR 2X LASER'}`, W * 0.5, H - 14);
    }
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = this.logicalWidth;
    const H = this.logicalHeight;

    this.renderBackdrop(ctx, W, H);

    // Phoenix Mothership Boss
    if (this.mothershipActive) {
      this.renderPhoenixMothership(ctx, W);
    }

    const animFrame = Math.floor(this.clock * 4.2) % 2;

    // Aliens
    for (const a of this.aliens) {
      if ((a.state === 'entering' || a.state === 'diving') && a.t < 0) continue;
      ctx.save();
      ctx.translate(a.x, a.y);

      // Authentic Galaga Harmonic Pulsing Tractor Beam!
      if (a.state === 'beam' && a.y >= 408) {
        const beamH = 212;
        const g = ctx.createLinearGradient(0, 14, 0, beamH);
        g.addColorStop(0, 'rgba(56, 189, 248, 0.72)');
        g.addColorStop(0.5, 'rgba(192, 132, 252, 0.45)');
        g.addColorStop(1, 'rgba(34, 211, 238, 0.14)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-12, 14);
        ctx.lineTo(12, 14);
        ctx.lineTo(56, beamH);
        ctx.lineTo(-56, beamH);
        ctx.closePath();
        ctx.fill();

        // Cascading concentric harmonic rings inside tractor beam
        for (let r = 0; r < 7; r++) {
          const prog = ((this.clock * 2.4 + r / 7) % 1);
          const ry = 18 + prog * (beamH - 22);
          const rw = 12 + prog * 44;
          ctx.strokeStyle = r % 2 === 0 ? 'rgba(255,255,255,0.78)' : 'rgba(56,189,248,0.85)';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.ellipse(0, ry, rw, 5.5, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      if (a.state === 'egg') {
        // Speckled Hatching Cosmic Egg
        ctx.rotate(Math.sin(this.clock * 14 + a.id) * 0.22);
        ctx.fillStyle = '#4C1D95';
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, 11, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#F97316';
        ctx.fillRect(-4, -5, 3, 3);
        ctx.fillRect(2, 2, 4, 3);
      } else if (a.kind === 'phoenixGiant') {
        this.renderGiantPhoenix(ctx, a);
      } else if (a.kind === 'phoenixSmall') {
        const mat = animFrame === 0 ? PHOENIX_SMALL_0 : PHOENIX_SMALL_1;
        const pal =
          a.color === '#38BDF8' ? PHOENIX_BLUE_PAL : a.color === '#FACC15' ? PHOENIX_GOLD_PAL : PHOENIX_PINK_PAL;
        if (a.state === 'diving') ctx.rotate(a.heading);
        drawPixelMatrixHD(ctx, mat, 0, 0, 2.75, pal, a.color);
      } else if (a.kind === 'satelliteRed' || a.kind === 'satelliteOrb') {
        // Authentic Gyruss Perspective-Scaled Solar Satellites!
        const scale = Math.max(0.32, Math.min(1.15, a.orbitR / 170));
        ctx.scale(scale, scale);
        ctx.rotate(this.clock * (a.kind === 'satelliteRed' ? 5.5 : -4));
        ctx.strokeStyle = a.kind === 'satelliteRed' ? '#EF4444' : '#38BDF8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 0, 18, 8, 0.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = a.kind === 'satelliteRed' ? '#FACC15' : '#E0F2FE';
        ctx.beginPath();
        ctx.arc(0, 0, a.kind === 'satelliteRed' ? 10 : 7, 0, Math.PI * 2);
        ctx.fill();
      } else if (a.kind === 'gyrussAsteroid') {
        const scale = Math.max(0.28, Math.min(1.25, a.orbitR / 190));
        ctx.scale(scale, scale);
        ctx.rotate(this.clock * 3.5);
        ctx.fillStyle = '#9A3412';
        ctx.strokeStyle = '#FDBA74';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        for (let k = 0; k < 8; k++) {
          const ang = (k / 8) * Math.PI * 2;
          const rad = k % 2 === 0 ? 20 : 14;
          if (k === 0) ctx.moveTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
          else ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (this.variant === 'gyruss') {
        // 3D Perspective-Scaled Konami Gyruss Fighters spiraling out of the warp core!
        const scale = Math.max(0.28, Math.min(1.12, a.orbitR / 155));
        ctx.scale(scale, scale);
        ctx.rotate(a.orbitAngle + Math.PI * 0.5);
        const mat = a.kind === 'grunt' ? GYRUSS_ENEMY_A : GYRUSS_ENEMY_B;
        const pal = a.kind === 'grunt' ? GYRUSS_PAL_A : GYRUSS_PAL_B;
        drawPixelMatrixHD(ctx, mat, 0, 0, 2.75, pal, a.color);
      } else if (this.variant === 'galaxian') {
        if (a.state === 'diving') ctx.rotate(a.heading);
        const mat =
          a.kind === 'flagship'
            ? animFrame === 0
              ? GALAXIAN_FLAGSHIP_0
              : GALAXIAN_FLAGSHIP_1
            : a.kind === 'escort'
              ? animFrame === 0
                ? GALAXIAN_ESCORT_0
                : GALAXIAN_ESCORT_1
              : a.kind === 'charger'
                ? animFrame === 0
                  ? GALAXIAN_CHARGER_0
                  : GALAXIAN_CHARGER_1
                : animFrame === 0
                  ? GALAXIAN_DRONE_0
                  : GALAXIAN_DRONE_1;
        drawPixelMatrixHD(ctx, mat, 0, 0, 2.75, GALAXIAN_PALETTE, a.color);
      } else {
        // GALAGA (1981) — Boss Galaga, Goei Butterfly, Zako Bee, Challenging Dragonfly!
        if (a.state === 'diving' || a.state === 'entering') ctx.rotate(a.heading);
        if (a.kind === 'bossGalaga') {
          const mat = animFrame === 0 ? GALAGA_BOSS_0 : GALAGA_BOSS_1;
          const pal = a.hp > 1 ? GALAGA_BOSS_GREEN : GALAGA_BOSS_BLUE;
          drawPixelMatrixHD(ctx, mat, 0, 0, 2.95, pal, a.hp > 1 ? '#22C55E' : '#38BDF8');
          if (a.capturedShip) {
            drawPixelMatrixHD(ctx, GALAGA_FIGHTER, 0, -32, 2.15, GALAGA_CAPTURED_PAL, '#F43F5E');
          }
        } else if (a.kind === 'bonusBug') {
          drawPixelMatrixHD(ctx, GALAGA_BONUS_DRAGONFLY, 0, 0, 2.8, GALAGA_PALETTE, '#38BDF8');
        } else if (a.kind === 'escort') {
          const mat = animFrame === 0 ? GALAGA_GOEI_0 : GALAGA_GOEI_1;
          drawPixelMatrixHD(ctx, mat, 0, 0, 2.7, GALAGA_PALETTE, '#EF4444');
        } else {
          const mat = animFrame === 0 ? GALAGA_ZAKO_0 : GALAGA_ZAKO_1;
          drawPixelMatrixHD(ctx, mat, 0, 0, 2.65, GALAGA_PALETTE, '#FACC15');
        }
      }
      ctx.restore();
    }

    // Rescued Galaga Fighter spiraling down to dock!
    if (this.rescueDockTimer > 0) {
      ctx.save();
      ctx.translate(this.rescueShipX, this.rescueShipY);
      ctx.rotate(this.rescueDockTimer * 14);
      drawPixelMatrixHD(ctx, GALAGA_FIGHTER, 0, 0, 2.8, GALAGA_PALETTE, '#FACC15');
      ctx.restore();
    }

    // Shots (2-pass crisp glow, zero shadowBlur!)
    for (const s of this.shots) {
      const ang = Math.atan2(s.vy, s.vx);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(ang + Math.PI * 0.5);
      ctx.fillStyle = s.color;
      ctx.globalAlpha = 0.32;
      ctx.fillRect(-4.5, -10, 9, 20);
      ctx.globalAlpha = 1;
      ctx.fillRect(-2.2, -8, 4.4, 15);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-1, -6, 2, 10);
      ctx.restore();
    }

    // Distinct Per-Game Player Starfighter(s)!
    const blink = this.invulnTimer > 0 && Math.floor(this.clock * 14) % 2 === 0;
    if (!blink) {
      const pPos = this.getPlayerPos();
      const ships = this.dualFighter ? [pPos.x - 18, pPos.x + 18] : [pPos.x];
      for (const sx of ships) {
        ctx.save();
        ctx.translate(sx, pPos.y);
        if (this.variant === 'gyruss') {
          ctx.rotate(this.gyrussAngle - Math.PI * 0.5);
          // Twin glowing thruster plumes on Gyruss ship
          const fl = 8 + Math.sin(this.clock * 28) * 3;
          ctx.fillStyle = '#F97316';
          ctx.fillRect(-7, 11, 4, fl);
          ctx.fillRect(3, 11, 4, fl);
          drawPixelMatrixHD(ctx, GYRUSS_PLAYER, 0, 0, 2.85, GYRUSS_SHIP_PAL, '#38BDF8');
        } else if (this.variant === 'galaxian') {
          const hasShotInFlight = this.shots.some((s) => !s.fromEnemy);
          drawPixelMatrixHD(
            ctx,
            hasShotInFlight ? GALAXIP_FIRED : GALAXIP_ARMED,
            0,
            0,
            3.1,
            GALAXIAN_PALETTE,
            '#38BDF8'
          );
        } else if (this.variant === 'galaga') {
          drawPixelMatrixHD(ctx, GALAGA_FIGHTER, 0, 0, 3.05, GALAGA_PALETTE, '#60A5FA');
        } else {
          drawPixelMatrixHD(ctx, PHOENIX_PLAYER, 0, 0, 3.1, PHOENIX_SHIP_PAL, '#38BDF8');
        }
        ctx.restore();
      }

      // Iconic Blazing Multi-Ring Phoenix Force Shield!
      if (this.shieldTimer > 0) {
        ctx.save();
        ctx.translate(pPos.x, pPos.y);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
        ctx.beginPath();
        ctx.arc(0, 0, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = Math.floor(this.clock * 16) % 2 === 0 ? '#FFFFFF' : '#38BDF8';
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.arc(0, 0, 32 + Math.sin(this.clock * 24) * 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, 0, 25, this.clock * 6, this.clock * 6 + Math.PI * 1.4);
        ctx.stroke();
        ctx.restore();
      }
    }

    this.renderFooterBadges(ctx, W, H);
    renderParticlesAndPopups(ctx, this.particles, this.popups);

    if (this.screenFlash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${(this.screenFlash * 0.45).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (this.phase === 'TITLE') {
      ctx.fillStyle = 'rgba(4, 6, 17, 0.78)';
      ctx.fillRect(0, H * 0.35, W, 124);
      ctx.textAlign = 'center';
      ctx.font = '900 34px "JetBrains Mono", monospace';
      ctx.fillStyle =
        this.variant === 'galaxian'
          ? '#FACC15'
          : this.variant === 'galaga'
            ? '#38BDF8'
            : this.variant === 'phoenix'
              ? '#FB923C'
              : '#67E8F9';
      const header: Record<GalaxianShooterVariant, string> = {
        galaxian: 'GALAXIAN · 1979',
        galaga: 'GALAGA · 1981',
        phoenix: 'PHOENIX · 1980',
        gyruss: 'GYRUSS · 1983',
      };
      ctx.fillText(header[this.variant], W * 0.5, H * 0.35 + 48);
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillStyle = '#E2E8F0';
      const sub: Record<GalaxianShooterVariant, string> = {
        galaxian: '1-SHOT GALAXIP · SWOOPING FLAGSHIPS & RED ESCORTS FOR 800 PTS',
        galaga: 'CHOREOGRAPHED RIBBONS · TRACTOR BEAM DUAL FIGHTER · CHALLENGING STAGES',
        phoenix: 'HATCHING GIANT BIRDS · REGENERATING WINGS · MOTHERSHIP & FORCE SHIELD',
        gyruss: '3D WARP TUNNEL TO EARTH · 3-SATELLITE DOUBLE LASER · ASTEROIDS',
      };
      ctx.fillText(sub[this.variant], W * 0.5, H * 0.35 + 84);
    }
    if (visualMode === 'crt') renderCrtOverlay(ctx, W, H);
  }
}

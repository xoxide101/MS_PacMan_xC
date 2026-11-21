import {
  ArcadeGameInstance,
  ArcadeInputState,
  ClassicGameHud,
  ClassicGamePhase,
  ScorePopup,
  SimpleParticle,
  createEmptyInput,
  getPrecisionMoveVector,
  readHighScore,
  renderCrtOverlay,
  renderParticlesAndPopups,
  saveHighScore,
  spawnBurst,
  stepParticlesAndPopups,
} from './classicArcadeInterface';
import { arcadeAudio } from './audio';
import {
  drawHDDonkeyKong,
  drawHDMarioHero,
  drawSoftShadow,
  drawStarGlint,
} from './arcadeGfx';

export type DonkeyKongVariant = 'dkong' | 'dkongjr' | 'dkong3';

const W = 720;
const H = 640;

// --- Shared Geometry Types ---
interface Girder {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  conveyorDir?: -1 | 1;
}

interface Ladder {
  x: number;
  topY: number;
  botY: number;
  retractable?: boolean;
  retracted?: boolean;
}

interface Rivet {
  x: number;
  y: number;
  removed: boolean;
}

interface HammerPickup {
  x: number;
  y: number;
  taken: boolean;
}

interface PaulineItem {
  x: number;
  y: number;
  kind: 'purse' | 'umbrella' | 'hat';
  pts: number;
  taken: boolean;
}

interface Barrel {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  blue: boolean;
  jumpingScored: boolean;
  climbingLadder: boolean;
}

interface Fireball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dir: -1 | 1;
  climbing: boolean;
  anim: number;
}

interface CementPie {
  x: number;
  y: number;
  girderIdx: number;
  dir: -1 | 1;
}

interface ElevatorPlatform {
  x: number;
  y: number;
  w: number;
  vy: number;
  minY: number;
  maxY: number;
}

interface JackSpring {
  x: number;
  y: number;
  vx: number;
  vy: number;
  bounces: number;
}

// --- DK Jr. Types ---
interface Vine {
  x: number;
  topY: number;
  botY: number;
  isChain?: boolean;
}

interface JunglePlatform {
  x: number;
  y: number;
  w: number;
  vx?: number;
  minX?: number;
  maxX?: number;
}

interface Snapjaw {
  x: number;
  y: number;
  vineIdx: number;
  dirY: -1 | 1;
  red: boolean;
  isSpark?: boolean;
  anim: number;
}

interface Nitpicker {
  x: number;
  y: number;
  vx: number;
  phase: number;
  eggTimer: number;
}

interface JrEgg {
  x: number;
  y: number;
  vy: number;
}

interface JungleFruit {
  x: number;
  y: number;
  kind: 'apple' | 'banana' | 'melon';
  state: 'hanging' | 'falling' | 'used';
  vy: number;
  comboCount: number;
}

interface CageKey {
  x: number;
  y: number;
  collected: boolean;
}

// --- DK 3 Types ---
interface SprayShot {
  x: number;
  y: number;
  vy: number;
  superPower: boolean;
  life: number;
}

interface GreenhouseBug {
  id: number;
  kind: 'buzzbee' | 'beespy' | 'creepy' | 'beebomb';
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  fireTimer: number;
  carryingFlowerIdx: number | null;
  phase: number;
}

interface BugShot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  isCoconut?: boolean;
}

interface PottedFlower {
  x: number;
  y: number;
  alive: boolean;
  beingCarried: boolean;
  color: string;
}

interface ConservatoryTheme {
  name: string;
  skyTop: string;
  skyBot: string;
  glassFrame: string;
  deckTop: string;
  deckBot: string;
}

const DK3_THEMES: ConservatoryTheme[] = [
  {
    name: 'BLUE GLASSHOUSE',
    skyTop: '#071A2F',
    skyBot: '#0F3354',
    glassFrame: '#38BDF8',
    deckTop: '#CA8A04',
    deckBot: '#713F12',
  },
  {
    name: 'AMBER CONSERVATORY',
    skyTop: '#241405',
    skyBot: '#43250A',
    glassFrame: '#F59E0B',
    deckTop: '#16A34A',
    deckBot: '#14532D',
  },
  {
    name: 'CRIMSON BOTANICAL HALL',
    skyTop: '#260812',
    skyBot: '#4C1023',
    glassFrame: '#FB7185',
    deckTop: '#0284C7',
    deckBot: '#0C4A6E',
  },
];

function girderYAt(g: Girder, x: number): number {
  const t = Math.max(0, Math.min(1, (x - g.x1) / Math.max(1, g.x2 - g.x1)));
  return g.y1 + (g.y2 - g.y1) * t;
}

export class DonkeyKongGame implements ArcadeGameInstance {
  public readonly logicalWidth = W;
  public readonly logicalHeight = H;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel: string;
  public readonly secondaryActionLabel?: string;

  private readonly variant: DonkeyKongVariant;
  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();
  private score = 0;
  private highScore = 0;
  private level = 1;
  private lives = 3;
  private bonusTimer = 5000;
  private nextExtraLifeScore = 10000;
  private time = 0;
  private phaseTimer = 0;
  private bannerText = '';
  private screenShake = 0;

  // Player state (Jumpman / DK Jr. / Stanley)
  private px = 110;
  private py = 560;
  private pvx = 0;
  private pvy = 0;
  private facing: -1 | 1 = 1;
  private grounded = true;
  private onLadder = false;
  private climbingVines = 0; // 0 none, 1 single vine, 2 dual vines!
  private hammerTimer = 0;
  private walkAnim = 0;
  private invulnTimer = 0;

  // --- DK1 (4 Authentic Stages: 0=25m, 1=50m Pie, 2=75m Elevators, 3=100m Rivets) ---
  private dk1StageType = 0;
  private girders: Girder[] = [];
  private ladders: Ladder[] = [];
  private rivets: Rivet[] = [];
  private hammers: HammerPickup[] = [];
  private paulineItems: PaulineItem[] = [];
  private barrels: Barrel[] = [];
  private fireballs: Fireball[] = [];
  private pies: CementPie[] = [];
  private elevators: ElevatorPlatform[] = [];
  private springs: JackSpring[] = [];
  private barrelTimer = 1.6;
  private springTimer = 2.0;
  private conveyorSwitchTimer = 5.5;
  private ladderRetractTimer = 4.0;
  private dkHeaveAnim = 0;
  private oilLit = false;

  // --- DK Jr. (3 Authentic Stages: 0=Vines, 1=Springboard, 2=Electric Hideout) ---
  private dkJrStageType = 0;
  private vines: Vine[] = [];
  private jrPlatforms: JunglePlatform[] = [];
  private snapjaws: Snapjaw[] = [];
  private nitpickers: Nitpicker[] = [];
  private jrEggs: JrEgg[] = [];
  private fruits: JungleFruit[] = [];
  private keys: CageKey[] = [];
  private springboardX = 110;
  private springboardY = 556;
  private springboardCompression = 0;
  private marioPatrolX = 430;
  private marioPatrolDir: -1 | 1 = 1;
  private snapjawTimer = 2.4;

  // --- DK 3 (3 Conservatory Themes) ---
  private dk3Y = 235;
  private dk3PushTarget = 110;
  private dk3FloorIdx = 0;
  private dk3JumpOffset = 0;
  private dk3JumpVel = 0;
  private dk3CoconutTimer = 2.6;
  private superSprayTimer = 0;
  private superCanX = 360;
  private superCanY = 270;
  private superCanActive = false;
  private sprayCooldown = 0;
  private sprays: SprayShot[] = [];
  private bugs: GreenhouseBug[] = [];
  private bugShots: BugShot[] = [];
  private flowers: PottedFlower[] = [];
  private bugSpawnTimer = 1.3;
  private nextBugId = 1;

  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  constructor(variant: DonkeyKongVariant) {
    this.variant = variant;
    this.primaryActionLabel =
      variant === 'dkong3' ? 'BUG SPRAY' : variant === 'dkongjr' ? 'JUMP / VINE' : 'JUMP';
    this.secondaryActionLabel = variant === 'dkong3' ? 'HOP' : undefined;
    this.highScore = readHighScore(`arcade_hs_${variant}`);
    this.setupStage(1);
    this.bannerText = this.getTitleBanner();
  }

  private getTitleBanner(): string {
    if (this.variant === 'dkong') return 'HOW HIGH CAN YOU GET? · PRESS PLAY';
    if (this.variant === 'dkongjr') return 'RESCUE PAPA KONG! · PRESS PLAY';
    return 'DEFEND STANLEY’S GREENHOUSE! · PRESS PLAY';
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public startNewGame(): void {
    arcadeAudio.unlock();
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.nextExtraLifeScore = 10000;
    this.particles = [];
    this.popups = [];
    this.setupStage(1);
    this.phase = 'READY';
    this.phaseTimer = 1.5;
    this.bannerText = this.getReadyBanner();
  }

  private getReadyBanner(): string {
    if (this.variant === 'dkong') {
      const names = ['25m · GIRDERS', '50m · PIE FACTORY', '75m · ELEVATORS', '100m · RIVETS'];
      return `HOW HIGH CAN YOU GET? · ${names[this.dk1StageType]}`;
    }
    if (this.variant === 'dkongjr') {
      const names = ['JUNGLE VINES', 'SPRINGBOARD CANOPY', 'MARIO’S ELECTRIC HIDEOUT'];
      return `STAGE ${this.level} · ${names[this.dkJrStageType]}`;
    }
    const theme = DK3_THEMES[(this.level - 1) % DK3_THEMES.length];
    return `ROUND ${this.level} · ${theme.name}`;
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') {
      this.phase = 'PAUSED';
      this.bannerText = 'PAUSED';
    } else if (this.phase === 'PAUSED') {
      this.phase = 'PLAYING';
      this.bannerText = '';
    }
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.setupStage(1);
    this.bannerText = this.getTitleBanner();
  }

  public getHudSnapshot(): ClassicGameHud {
    if (this.variant === 'dkong') {
      const stageNames = ['25m GIRDERS', '50m PIE FACTORY', '75m ELEVATORS', '100m RIVETS'];
      const rivetsLeft = this.rivets.filter((r) => !r.removed).length;
      return {
        phase: this.phase,
        score: this.score,
        highScore: this.highScore,
        level: this.level,
        lives: this.lives,
        stageName: `L${this.level} · ${stageNames[this.dk1StageType]}`,
        primaryMetricLabel: this.dk1StageType === 3 ? 'RIVETS LEFT' : 'HAMMER',
        primaryMetricValue:
          this.dk1StageType === 3
            ? `${rivetsLeft}/8`
            : this.hammerTimer > 0
              ? `${this.hammerTimer.toFixed(1)}s`
              : 'READY',
        secondaryMetricLabel: 'BONUS',
        secondaryMetricValue: `${Math.max(0, Math.floor(this.bonusTimer))}`,
        bannerText: this.bannerText,
      };
    }
    if (this.variant === 'dkongjr') {
      const stageNames = ['JUNGLE VINES', 'SPRINGBOARD', 'ELECTRIC HIDEOUT'];
      const keysLeft = this.keys.filter((k) => !k.collected).length;
      return {
        phase: this.phase,
        score: this.score,
        highScore: this.highScore,
        level: this.level,
        lives: this.lives,
        stageName: `STAGE ${this.level} · ${stageNames[this.dkJrStageType]}`,
        primaryMetricLabel: 'KEYS LEFT',
        primaryMetricValue: `${keysLeft}/${this.keys.length}`,
        secondaryMetricLabel: 'BONUS',
        secondaryMetricValue: `${Math.max(0, Math.floor(this.bonusTimer))}`,
        bannerText: this.bannerText,
      };
    }
    const theme = DK3_THEMES[(this.level - 1) % DK3_THEMES.length];
    const flowersAlive = this.flowers.filter((f) => f.alive).length;
    const pct = Math.max(0, Math.min(100, Math.round(((320 - this.dk3Y) / (320 - this.dk3PushTarget)) * 100)));
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: `RD ${this.level} · ${theme.name}`,
      primaryMetricLabel: 'DK PUSHED',
      primaryMetricValue: `${pct}%`,
      secondaryMetricLabel: 'FLOWERS',
      secondaryMetricValue: `${flowersAlive}/5`,
      bannerText: this.bannerText,
    };
  }

  private addScore(points: number, x?: number, y?: number, color = '#FACC15', label?: string): void {
    this.score += points;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(`arcade_hs_${this.variant}`, this.highScore);
    }
    if (this.score >= this.nextExtraLifeScore) {
      this.lives = Math.min(5, this.lives + 1);
      this.nextExtraLifeScore += 15000;
      arcadeAudio.playExtraLife();
      this.popups.push({
        x: this.px,
        y: this.py - 36,
        text: '1UP!',
        color: '#4ADE80',
        life: 1.5,
        maxLife: 1.5,
      });
    }
    if (x !== undefined && y !== undefined) {
      this.popups.push({
        x,
        y,
        text: label ?? `+${points}`,
        color,
        life: 0.95,
        maxLife: 0.95,
      });
    }
  }

  private setupStage(lvl: number): void {
    this.level = lvl;
    this.bonusTimer = 5000 + Math.min(3000, (lvl - 1) * 500);
    this.hammerTimer = 0;
    this.invulnTimer = 1.4;
    this.pvx = 0;
    this.pvy = 0;
    this.onLadder = false;
    this.climbingVines = 0;

    if (this.variant === 'dkong') {
      this.setupDk1Stage(lvl);
    } else if (this.variant === 'dkongjr') {
      this.setupDkJrStage(lvl);
    } else {
      this.setupDk3Stage(lvl);
    }
  }

  // ===================== DONKEY KONG (1981) — 4 STAGES =====================
  private setupDk1Stage(lvl: number): void {
    this.dk1StageType = (lvl - 1) % 4;
    this.barrels = [];
    this.fireballs = [];
    this.pies = [];
    this.elevators = [];
    this.springs = [];
    this.rivets = [];
    this.hammers = [];
    this.paulineItems = [];
    this.oilLit = false;
    this.barrelTimer = 1.2;
    this.springTimer = 1.6;
    this.conveyorSwitchTimer = 5.5;
    this.ladderRetractTimer = 4.0;

    if (this.dk1StageType === 0) {
      // 25m GIRDERS
      this.girders = [
        { x1: 42, y1: 586, x2: 678, y2: 562 },
        { x1: 42, y1: 486, x2: 632, y2: 512 },
        { x1: 88, y1: 428, x2: 678, y2: 400 },
        { x1: 42, y1: 318, x2: 632, y2: 344 },
        { x1: 88, y1: 256, x2: 678, y2: 228 },
        { x1: 42, y1: 158, x2: 540, y2: 162 },
        { x1: 265, y1: 96, x2: 455, y2: 96 }, // Pauline deck
      ];
      this.ladders = [
        { x: 565, topY: 508, botY: 566 },
        { x: 145, topY: 425, botY: 492 },
        { x: 355, topY: 414, botY: 500 },
        { x: 545, topY: 338, botY: 406 },
        { x: 175, topY: 252, botY: 325 },
        { x: 395, topY: 242, botY: 335 },
        { x: 475, topY: 160, botY: 236 },
        { x: 398, topY: 96, botY: 160 },
      ];
      this.hammers = [
        { x: 135, y: 390, taken: false },
        { x: 550, y: 204, taken: false },
      ];
      this.paulineItems = [
        { x: 250, y: 404, kind: 'umbrella', pts: 300, taken: false },
        { x: 580, y: 326, kind: 'purse', pts: 500, taken: false },
      ];
      this.px = 110;
      this.py = girderYAt(this.girders[0], 110);
      this.grounded = true;
    } else if (this.dk1StageType === 1) {
      // 50m PIE FACTORY (Conveyors + Cement Pies + Retractable Ladders!)
      this.girders = [
        { x1: 44, y1: 580, x2: 676, y2: 580 },
        { x1: 44, y1: 474, x2: 676, y2: 474, conveyorDir: 1 },
        { x1: 44, y1: 368, x2: 335, y2: 368, conveyorDir: 1 },
        { x1: 385, y1: 368, x2: 676, y2: 368, conveyorDir: -1 },
        { x1: 44, y1: 262, x2: 676, y2: 262, conveyorDir: -1 },
        { x1: 44, y1: 164, x2: 676, y2: 164 },
        { x1: 265, y1: 96, x2: 455, y2: 96 },
      ];
      this.ladders = [
        { x: 110, topY: 474, botY: 580 },
        { x: 610, topY: 474, botY: 580 },
        { x: 220, topY: 368, botY: 474 },
        { x: 500, topY: 368, botY: 474 },
        { x: 115, topY: 262, botY: 368, retractable: true, retracted: false },
        { x: 605, topY: 262, botY: 368, retractable: true, retracted: false },
        { x: 360, topY: 164, botY: 262 },
        { x: 405, topY: 96, botY: 164 },
      ];
      this.hammers = [
        { x: 360, y: 440, taken: false },
        { x: 360, y: 230, taken: false },
      ];
      this.paulineItems = [
        { x: 160, y: 348, kind: 'hat', pts: 300, taken: false },
        { x: 560, y: 242, kind: 'purse', pts: 800, taken: false },
      ];
      // Cement pies sliding on conveyor belts
      this.pies = [
        { x: 140, y: 462, girderIdx: 1, dir: 1 },
        { x: 540, y: 462, girderIdx: 1, dir: 1 },
        { x: 210, y: 250, girderIdx: 4, dir: -1 },
        { x: 520, y: 250, girderIdx: 4, dir: -1 },
      ];
      this.fireballs = [
        { x: 360, y: 356, vx: 82, vy: 0, dir: 1, climbing: false, anim: 0 },
        { x: 240, y: 152, vx: -85, vy: 0, dir: -1, climbing: false, anim: 2 },
      ];
      this.oilLit = true;
      this.px = 360;
      this.py = 580;
      this.grounded = true;
    } else if (this.dk1StageType === 2) {
      // 75m ELEVATORS & BOUNCING JACK SPRINGS
      this.girders = [
        { x1: 42, y1: 580, x2: 195, y2: 580 },
        { x1: 42, y1: 374, x2: 190, y2: 374 },
        { x1: 305, y1: 446, x2: 430, y2: 446 },
        { x1: 305, y1: 320, x2: 430, y2: 320 },
        { x1: 530, y1: 512, x2: 678, y2: 512 },
        { x1: 530, y1: 374, x2: 678, y2: 374 },
        { x1: 530, y1: 246, x2: 678, y2: 246 },
        { x1: 42, y1: 168, x2: 678, y2: 168 },
        { x1: 265, y1: 96, x2: 455, y2: 96 },
      ];
      this.ladders = [
        { x: 86, topY: 374, botY: 580 },
        { x: 368, topY: 320, botY: 446 },
        { x: 625, topY: 374, botY: 512 },
        { x: 600, topY: 246, botY: 374 },
        { x: 635, topY: 168, botY: 246 },
        { x: 405, topY: 96, botY: 168 },
      ];
      this.elevators = [
        { x: 246, y: 540, w: 68, vy: -82, minY: 230, maxY: 560 },
        { x: 246, y: 340, w: 68, vy: -82, minY: 230, maxY: 560 },
        { x: 478, y: 260, w: 68, vy: 82, minY: 230, maxY: 550 },
        { x: 478, y: 450, w: 68, vy: 82, minY: 230, maxY: 550 },
      ];
      this.paulineItems = [
        { x: 368, y: 300, kind: 'umbrella', pts: 500, taken: false },
        { x: 590, y: 492, kind: 'purse', pts: 800, taken: false },
      ];
      this.fireballs = [
        { x: 360, y: 434, vx: 75, vy: 0, dir: 1, climbing: false, anim: 0 },
      ];
      this.px = 110;
      this.py = 580;
      this.grounded = true;
    } else {
      // 100m RIVETS (Pull all 8 golden rivets to collapse DK's steel tower!)
      this.girders = [
        { x1: 42, y1: 580, x2: 678, y2: 580 },
        { x1: 68, y1: 480, x2: 652, y2: 480 },
        { x1: 94, y1: 380, x2: 626, y2: 380 },
        { x1: 120, y1: 280, x2: 600, y2: 280 },
        { x1: 146, y1: 180, x2: 574, y2: 180 },
      ];
      this.ladders = [
        { x: 94, topY: 480, botY: 580 },
        { x: 626, topY: 480, botY: 580 },
        { x: 120, topY: 380, botY: 480 },
        { x: 600, topY: 380, botY: 480 },
        { x: 146, topY: 280, botY: 380 },
        { x: 574, topY: 280, botY: 380 },
        { x: 172, topY: 180, botY: 280 },
        { x: 548, topY: 180, botY: 280 },
        { x: 360, topY: 480, botY: 580 },
        { x: 360, topY: 280, botY: 380 },
      ];
      const rivetYs = [480, 380, 280, 180];
      for (const ry of rivetYs) {
        this.rivets.push({ x: 222, y: ry, removed: false });
        this.rivets.push({ x: 498, y: ry, removed: false });
      }
      this.hammers = [
        { x: 360, y: 448, taken: false },
        { x: 360, y: 248, taken: false },
      ];
      this.paulineItems = [
        { x: 360, y: 558, kind: 'hat', pts: 300, taken: false },
        { x: 360, y: 358, kind: 'umbrella', pts: 500, taken: false },
      ];
      this.fireballs = [
        { x: 160, y: 468, vx: 82, vy: 0, dir: 1, climbing: false, anim: 0 },
        { x: 560, y: 368, vx: -86, vy: 0, dir: -1, climbing: false, anim: 1.5 },
        { x: 260, y: 268, vx: 90, vy: 0, dir: 1, climbing: false, anim: 3 },
      ];
      this.px = 120;
      this.py = 580;
      this.grounded = true;
    }
  }

  // ===================== DONKEY KONG JR. (1982) — 3 STAGES =====================
  private setupDkJrStage(lvl: number): void {
    this.dkJrStageType = (lvl - 1) % 3;
    this.snapjaws = [];
    this.nitpickers = [];
    this.jrEggs = [];
    this.fruits = [];
    this.keys = [];
    this.snapjawTimer = 2.0;

    if (this.dkJrStageType === 0) {
      // Stage 1: Jungle Vines
      this.jrPlatforms = [
        { x: 34, y: 566, w: 184 },
        { x: 260, y: 552, w: 130 },
        { x: 440, y: 540, w: 120 },
        { x: 590, y: 522, w: 100 },
        { x: 255, y: 374, w: 160 },
        { x: 455, y: 332, w: 170 },
        { x: 120, y: 230, w: 160 },
        { x: 170, y: 138, w: 390 },
      ];
      this.vines = [
        { x: 145, topY: 138, botY: 545 },
        { x: 192, topY: 138, botY: 545 },
        { x: 300, topY: 138, botY: 530 },
        { x: 348, topY: 138, botY: 530 },
        { x: 488, topY: 138, botY: 515 },
        { x: 540, topY: 138, botY: 515 },
        { x: 635, topY: 138, botY: 500 },
      ];
      this.fruits = [
        { x: 168, y: 270, kind: 'apple', state: 'hanging', vy: 0, comboCount: 0 },
        { x: 324, y: 250, kind: 'banana', state: 'hanging', vy: 0, comboCount: 0 },
        { x: 514, y: 240, kind: 'melon', state: 'hanging', vy: 0, comboCount: 0 },
      ];
      this.keys = [
        { x: 230, y: 112, collected: false },
        { x: 360, y: 112, collected: false },
        { x: 495, y: 112, collected: false },
      ];
      this.snapjaws = [
        { x: 300, y: 210, vineIdx: 2, dirY: 1, red: true, anim: 0 },
        { x: 488, y: 290, vineIdx: 4, dirY: 1, red: false, anim: 1.4 },
      ];
      this.px = 86;
      this.py = 566;
    } else if (this.dkJrStageType === 1) {
      // Stage 2: Springboard & Moving Jungle Islands + Nitpickers!
      this.jrPlatforms = [
        { x: 40, y: 566, w: 160 },
        { x: 245, y: 455, w: 120, vx: 78, minX: 215, maxX: 430 },
        { x: 490, y: 512, w: 165 },
        { x: 280, y: 322, w: 120, vx: -86, minX: 160, maxX: 460 },
        { x: 520, y: 275, w: 145 },
        { x: 170, y: 138, w: 390 },
      ];
      this.vines = [
        { x: 205, topY: 138, botY: 420 },
        { x: 248, topY: 138, botY: 420 },
        { x: 555, topY: 138, botY: 495 },
        { x: 602, topY: 138, botY: 495 },
      ];
      this.springboardX = 148;
      this.springboardY = 556;
      this.fruits = [
        { x: 226, y: 240, kind: 'banana', state: 'hanging', vy: 0, comboCount: 0 },
        { x: 578, y: 220, kind: 'melon', state: 'hanging', vy: 0, comboCount: 0 },
      ];
      this.keys = [
        { x: 220, y: 112, collected: false },
        { x: 360, y: 112, collected: false },
        { x: 500, y: 112, collected: false },
      ];
      this.nitpickers = [
        { x: 640, y: 215, vx: -120, phase: 0, eggTimer: 1.8 },
        { x: 90, y: 340, vx: 115, phase: 2.1, eggTimer: 2.6 },
      ];
      this.snapjaws = [
        { x: 555, y: 220, vineIdx: 2, dirY: 1, red: true, anim: 0 },
      ];
      this.px = 82;
      this.py = 566;
    } else {
      // Stage 3: Mario's Electric Hideout (6 Golden Keys + Electric Sparks!)
      this.jrPlatforms = [
        { x: 40, y: 568, w: 640 },
        { x: 80, y: 426, w: 220 },
        { x: 420, y: 426, w: 220 },
        { x: 160, y: 292, w: 400 },
        { x: 140, y: 138, w: 440 },
      ];
      this.vines = [
        { x: 130, topY: 138, botY: 558, isChain: true },
        { x: 185, topY: 138, botY: 558, isChain: true },
        { x: 280, topY: 138, botY: 558, isChain: true },
        { x: 360, topY: 138, botY: 558, isChain: true },
        { x: 440, topY: 138, botY: 558, isChain: true },
        { x: 545, topY: 138, botY: 558, isChain: true },
      ];
      this.keys = [
        { x: 130, y: 116, collected: false },
        { x: 185, y: 116, collected: false },
        { x: 280, y: 116, collected: false },
        { x: 360, y: 116, collected: false },
        { x: 440, y: 116, collected: false },
        { x: 545, y: 116, collected: false },
      ];
      this.snapjaws = [
        { x: 185, y: 240, vineIdx: 1, dirY: 1, red: true, isSpark: true, anim: 0 },
        { x: 360, y: 380, vineIdx: 3, dirY: -1, red: false, isSpark: true, anim: 1.2 },
        { x: 440, y: 220, vineIdx: 4, dirY: 1, red: true, isSpark: true, anim: 2.3 },
      ];
      this.px = 86;
      this.py = 568;
    }
    this.grounded = true;
  }

  // ===================== DONKEY KONG 3 (1983) — CONSERVATORY =====================
  private setupDk3Stage(lvl: number): void {
    this.dk3Y = 250;
    this.dk3PushTarget = 104;
    this.dk3FloorIdx = 0;
    this.dk3JumpOffset = 0;
    this.dk3JumpVel = 0;
    this.dk3CoconutTimer = 2.6;
    this.superSprayTimer = 0;
    this.superCanActive = false;
    this.sprays = [];
    this.bugs = [];
    this.bugShots = [];
    this.bugSpawnTimer = 1.0;

    const flowerColors = ['#F43F5E', '#FACC15', '#A855F7', '#38BDF8', '#FB923C'];
    this.flowers = [140, 250, 360, 470, 580].map((fx, i) => ({
      x: fx,
      y: 590,
      alive: true,
      beingCarried: false,
      color: flowerColors[i % flowerColors.length],
    }));

    this.px = 360;
    this.py = 540;
    this.grounded = true;

    // Seed initial Buzzbees & Creepy caterpillar
    for (let i = 0; i < 2 + Math.min(3, lvl); i++) {
      this.spawnGreenhouseBug(i % 2 === 0 ? 'buzzbee' : 'beespy');
    }
  }

  private spawnGreenhouseBug(kind?: GreenhouseBug['kind']): void {
    const pick: GreenhouseBug['kind'] =
      kind ??
      (Math.random() < 0.45
        ? 'buzzbee'
        : Math.random() < 0.72
          ? 'beespy'
          : Math.random() < 0.88
            ? 'creepy'
            : 'beebomb');
    const fromLeft = Math.random() < 0.5;
    if (pick === 'creepy') {
      const deckYs = [540, 444, 348];
      const dy = deckYs[Math.floor(Math.random() * deckYs.length)];
      this.bugs.push({
        id: this.nextBugId++,
        kind: 'creepy',
        x: fromLeft ? 90 : 630,
        y: dy - 10,
        vx: (fromLeft ? 1 : -1) * (88 + this.level * 8),
        vy: 0,
        hp: 1,
        fireTimer: 99,
        carryingFlowerIdx: null,
        phase: Math.random() * 6,
      });
    } else {
      this.bugs.push({
        id: this.nextBugId++,
        kind: pick,
        x: fromLeft ? 60 : W - 60,
        y: 130 + Math.random() * 140,
        vx: (fromLeft ? 1 : -1) * (82 + this.level * 10),
        vy: 35,
        hp: pick === 'beebomb' ? 2 : 1,
        fireTimer: 1.6 + Math.random() * 1.6,
        carryingFlowerIdx: null,
        phase: Math.random() * 6,
      });
    }
  }

  public step(dt: number): void {
    this.time += dt;
    if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - dt * 20);
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (this.dkHeaveAnim > 0) this.dkHeaveAnim = Math.max(0, this.dkHeaveAnim - dt * 3);
    if (this.springboardCompression > 0)
      this.springboardCompression = Math.max(0, this.springboardCompression - dt * 5);

    if (this.phase === 'PAUSED') return;

    if (this.phase === 'TITLE') {
      if (this.input.fireJustPressed) {
        this.startNewGame();
      }
      return;
    }

    if (this.phase === 'READY') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.phase = 'PLAYING';
        this.bannerText = '';
      }
      return;
    }

    if (this.phase === 'STAGE_CLEAR') {
      stepParticlesAndPopups(this.particles, this.popups, dt);
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.setupStage(this.level + 1);
        this.phase = 'READY';
        this.phaseTimer = 1.45;
        this.bannerText = this.getReadyBanner();
      }
      return;
    }

    if (this.phase === 'GAME_OVER') {
      stepParticlesAndPopups(this.particles, this.popups, dt);
      if (this.input.fireJustPressed) {
        this.startNewGame();
      }
      return;
    }

    // PLAYING
    this.bonusTimer = Math.max(0, this.bonusTimer - dt * 48);

    if (this.variant === 'dkong') {
      this.stepDk1(dt);
    } else if (this.variant === 'dkongjr') {
      this.stepDkJr(dt);
    } else {
      this.stepDk3(dt);
    }

    stepParticlesAndPopups(this.particles, this.popups, dt);
  }

  // ===================== DK 1 STEP =====================
  private stepDk1(dt: number): void {
    const moveVec = getPrecisionMoveVector(this.input);
    const moveSpeed = 192 * moveVec.scale;
    const climbSpeed = 142 * moveVec.scale;

    if (this.hammerTimer > 0) {
      this.hammerTimer = Math.max(0, this.hammerTimer - dt);
    }

    // Conveyor reversal & retractable ladders on 50m Pie Factory
    if (this.dk1StageType === 1) {
      this.conveyorSwitchTimer -= dt;
      if (this.conveyorSwitchTimer <= 0) {
        this.conveyorSwitchTimer = 5.5;
        for (const g of this.girders) {
          if (g.conveyorDir) g.conveyorDir = (g.conveyorDir * -1) as -1 | 1;
        }
      }
      this.ladderRetractTimer -= dt;
      if (this.ladderRetractTimer <= 0) {
        this.ladderRetractTimer = 3.8;
        for (const l of this.ladders) {
          if (l.retractable) l.retracted = !l.retracted;
        }
      }
    }

    // Elevators on 75m
    for (const el of this.elevators) {
      el.y += el.vy * dt;
      if (el.vy < 0 && el.y < el.minY) el.y = el.maxY;
      if (el.vy > 0 && el.y > el.maxY) el.y = el.minY;
    }

    // Check active ladder proximity (cannot climb while swinging hammer!)
    const activeLadder =
      this.hammerTimer <= 0
        ? this.ladders.find(
            (l) =>
              !l.retracted &&
              Math.abs(l.x - this.px) < 18 &&
              this.py >= l.topY - 6 &&
              this.py <= l.botY + 10
          )
        : undefined;

    if (activeLadder && (this.input.up || this.input.down || Math.abs(moveVec.vy) > 0.35)) {
      this.onLadder = true;
      this.px += (activeLadder.x - this.px) * Math.min(1, dt * 16);
      this.pvy = 0;
      const climbDir = moveVec.vy !== 0 ? Math.sign(moveVec.vy) : this.input.up ? -1 : 1;
      this.py += climbDir * climbSpeed * dt;
      this.walkAnim += dt * 12;
      if (this.py <= activeLadder.topY) {
        this.py = activeLadder.topY;
        this.onLadder = false;
        this.grounded = true;
      } else if (this.py >= activeLadder.botY) {
        this.py = activeLadder.botY;
        this.onLadder = false;
        this.grounded = true;
      }
    } else {
      if (!activeLadder) this.onLadder = false;

      // Horizontal run
      if (Math.abs(moveVec.vx) > 0.1) {
        this.facing = moveVec.vx > 0 ? 1 : -1;
        this.px += moveVec.vx * 192 * dt;
        this.walkAnim += dt * 14 * Math.abs(moveVec.vx);
      }

      // Jump
      if (this.grounded && this.hammerTimer <= 0 && this.input.fireJustPressed) {
        this.pvy = -375;
        this.grounded = false;
        arcadeAudio.playJumpBoing();
      }

      // Gravity & Girder/Elevator support
      const prevY = this.py;
      this.pvy += 1080 * dt;
      this.py += this.pvy * dt;
      this.grounded = false;

      // Check girders (skip broken rivet gaps on 100m!)
      for (const g of this.girders) {
        if (this.px >= g.x1 - 8 && this.px <= g.x2 + 8) {
          // On 100m Rivets, if standing over a removed rivet gap, fall!
          const overGap = this.rivets.some(
            (r) => r.removed && Math.abs(r.x - this.px) < 16 && Math.abs(r.y - g.y1) < 12
          );
          if (overGap) continue;

          const gy = girderYAt(g, this.px);
          if (this.pvy >= 0 && prevY <= gy + 10 && this.py >= gy - 4) {
            this.py = gy;
            this.pvy = 0;
            this.grounded = true;
            if (g.conveyorDir) {
              this.px += g.conveyorDir * 56 * dt;
            }
            break;
          }
        }
      }

      // Check moving elevators on 75m
      if (!this.grounded) {
        for (const el of this.elevators) {
          if (
            this.px >= el.x - el.w * 0.5 - 6 &&
            this.px <= el.x + el.w * 0.5 + 6 &&
            this.pvy >= 0 &&
            prevY <= el.y + 12 &&
            this.py >= el.y - 8
          ) {
            this.py = el.y;
            this.pvy = 0;
            this.grounded = true;
            break;
          }
        }
      }

      this.px = Math.max(46, Math.min(W - 46, this.px));
      if (this.py > H + 12) {
        this.damagePlayer();
        return;
      }
    }

    // Pull golden rivets on 100m!
    if (this.dk1StageType === 3) {
      for (const r of this.rivets) {
        if (!r.removed && Math.abs(this.px - r.x) < 18 && Math.abs(this.py - r.y) < 14) {
          r.removed = true;
          arcadeAudio.playCoin();
          this.addScore(100, r.x, r.y - 18, '#FACC15', 'RIVET +100');
          spawnBurst(this.particles, r.x, r.y, '#FACC15', 12, 160, 3);
        }
      }
      if (this.rivets.every((r) => r.removed)) {
        this.clearCurrentStage('TOWER COLLAPSED! DK DEFEATED!');
        return;
      }
    } else {
      // Reach Pauline on top deck!
      if (this.py <= 106 && Math.abs(this.px - 355) < 76) {
        this.clearCurrentStage('PAULINE RESCUED!');
        return;
      }
    }

    // Grab Hammers
    for (const h of this.hammers) {
      if (!h.taken && Math.hypot(this.px - h.x, this.py - 18 - h.y) < 28) {
        h.taken = true;
        this.hammerTimer = 8.5;
        arcadeAudio.playPowerUp();
        this.popups.push({
          x: h.x,
          y: h.y - 20,
          text: 'HAMMER TIME!',
          color: '#FACC15',
          life: 1.2,
          maxLife: 1.2,
        });
      }
    }

    // Grab Pauline's Purse / Umbrella / Hat
    for (const item of this.paulineItems) {
      if (!item.taken && Math.hypot(this.px - item.x, this.py - 16 - item.y) < 26) {
        item.taken = true;
        arcadeAudio.playCoin();
        this.addScore(item.pts, item.x, item.y - 14, '#F472B6', `+${item.pts}`);
        spawnBurst(this.particles, item.x, item.y, '#F472B6', 12, 150, 2.8);
      }
    }

    // Stage-specific hazards:
    // 1) Barrels on 25m
    if (this.dk1StageType === 0) {
      this.barrelTimer -= dt;
      if (this.barrelTimer <= 0) {
        this.barrelTimer = Math.max(1.15, 2.55 - this.level * 0.16);
        this.dkHeaveAnim = 1.0;
        const isBlue = Math.random() < 0.25;
        this.barrels.push({
          x: 170,
          y: 152,
          vx: (isBlue ? 185 : 155) + this.level * 10,
          vy: 0,
          angle: 0,
          blue: isBlue,
          jumpingScored: false,
          climbingLadder: false,
        });
      }
      this.stepBarrels(dt);
      if (this.phase !== 'PLAYING') return;
    }

    // 2) Cement Pies on 50m
    if (this.dk1StageType === 1) {
      for (const pie of this.pies) {
        const g = this.girders[pie.girderIdx];
        const dir = g?.conveyorDir ?? pie.dir;
        pie.x += dir * (78 + this.level * 8) * dt;
        if (pie.x < 52) pie.x = 668;
        if (pie.x > 668) pie.x = 52;
        if (Math.hypot(pie.x - this.px, pie.y - (this.py - 14)) < 22) {
          if (this.hammerTimer > 0) {
            pie.x = dir > 0 ? 54 : 666;
            arcadeAudio.playHammerSmash();
            this.addScore(300, this.px, this.py - 28, '#FACC15', 'SMASH +300');
            spawnBurst(this.particles, pie.x, pie.y, '#94A3B8', 14, 180, 3);
          } else if (this.invulnTimer <= 0) {
            this.damagePlayer();
            return;
          }
        }
      }
    }

    // 3) Bouncing Jack Springs on 75m
    if (this.dk1StageType === 2) {
      this.springTimer -= dt;
      if (this.springTimer <= 0) {
        this.springTimer = Math.max(1.3, 2.35 - this.level * 0.12);
        this.springs.push({
          x: 68,
          y: 162,
          vx: 165 + this.level * 8,
          vy: -250,
          bounces: 0,
        });
      }
      for (let i = this.springs.length - 1; i >= 0; i--) {
        const s = this.springs[i];
        s.vy += 860 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (s.y >= 166 && s.x < 530 && s.vy > 0) {
          s.y = 166;
          s.vy = -290;
          s.bounces++;
          arcadeAudio.playSpring();
        }
        if (Math.hypot(s.x - this.px, s.y - (this.py - 14)) < 22 && this.invulnTimer <= 0) {
          this.damagePlayer();
          return;
        }
        if (s.y > H + 30 || s.x > W + 30) {
          this.springs.splice(i, 1);
        }
      }
    }

    // 4) Fireballs (25m after oil lit, 50m, 75m, 100m)
    this.stepFireballs(dt);
  }

  private stepBarrels(dt: number): void {
    for (let i = this.barrels.length - 1; i >= 0; i--) {
      const b = this.barrels[i];
      if (!b) continue;
      b.angle += b.vx * dt * 0.06;

      if (b.climbingLadder) {
        b.vy = 165;
        b.y += b.vy * dt;
        // Stop falling when landing on next lower girder
        for (const g of this.girders) {
          if (b.x >= g.x1 && b.x <= g.x2) {
            const gy = girderYAt(g, b.x);
            if (Math.abs(b.y - (gy - 11)) < 9) {
              b.climbingLadder = false;
              b.y = gy - 11;
              b.vy = 0;
              b.vx = (g.y2 > g.y1 ? 1 : -1) * (155 + this.level * 10);
              break;
            }
          }
        }
      } else {
        b.vy += 940 * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;

        // Roll along girders
        for (const g of this.girders) {
          if (b.x >= g.x1 - 4 && b.x <= g.x2 + 4) {
            const gy = girderYAt(g, b.x);
            if (b.vy >= 0 && b.y >= gy - 14 && b.y <= gy + 12) {
              b.y = gy - 11;
              b.vy = 0;
              const slopeDir = g.y2 > g.y1 ? 1 : -1;
              b.vx = slopeDir * ((b.blue ? 185 : 155) + this.level * 10);

              // Chance to tumble down a ladder toward player
              const lad = this.ladders.find(
                (l) => Math.abs(l.x - b.x) < 8 && Math.abs(l.topY - gy) < 12
              );
              if (lad && b.y < this.py - 30 && Math.random() < (b.blue ? 0.45 : 0.18)) {
                b.climbingLadder = true;
                b.x = lad.x;
                b.vx = 0;
              }
              break;
            }
          }
        }
      }

      // Oil drum ignition on bottom left!
      if (b.y > 555 && b.x < 92) {
        if (!this.oilLit || b.blue) {
          this.oilLit = true;
          if (this.fireballs.length < 3) {
            this.fireballs.push({
              x: 84,
              y: 562,
              vx: 85,
              vy: 0,
              dir: 1,
              climbing: false,
              anim: 0,
            });
            spawnBurst(this.particles, 84, 560, '#F97316', 16, 170, 3.2);
          }
        }
        this.barrels.splice(i, 1);
        continue;
      }

      if (b.y > H + 30 || b.x < -30 || b.x > W + 30) {
        this.barrels.splice(i, 1);
        continue;
      }

      // Jump-over barrel bonus (+100)!
      if (
        !b.jumpingScored &&
        !this.grounded &&
        Math.abs(b.x - this.px) < 18 &&
        this.py < b.y - 6 &&
        this.py > b.y - 64
      ) {
        b.jumpingScored = true;
        arcadeAudio.playCoin();
        this.addScore(100, this.px, this.py - 32, '#38BDF8', 'LEAP +100');
      }

      // Collision with player (or Hammer Smash!)
      if (Math.hypot(b.x - this.px, b.y - (this.py - 14)) < 23) {
        if (this.hammerTimer > 0) {
          this.barrels.splice(i, 1);
          arcadeAudio.playHammerSmash();
          this.screenShake = 5;
          const pts = b.blue ? 500 : 300;
          this.addScore(pts, b.x, b.y - 16, '#FACC15', `SMASH +${pts}!`);
          spawnBurst(this.particles, b.x, b.y, b.blue ? '#38BDF8' : '#F59E0B', 16, 200, 3.4);
          continue;
        } else if (this.invulnTimer <= 0) {
          this.damagePlayer();
          return;
        }
      }
    }
  }

  private stepFireballs(dt: number): void {
    for (let i = this.fireballs.length - 1; i >= 0; i--) {
      const f = this.fireballs[i];
      if (!f) continue;
      f.anim += dt * 12;

      if (f.climbing) {
        f.y += f.vy * dt;
        const lad = this.ladders.find((l) => Math.abs(l.x - f.x) < 12);
        if (!lad || f.y <= lad.topY - 8 || f.y >= lad.botY - 8) {
          f.climbing = false;
          f.vy = 0;
          f.dir = this.px >= f.x ? 1 : -1;
        }
      } else {
        f.x += f.dir * (78 + this.level * 7) * dt;
        // Follow girder surface
        let onGirder: Girder | null = null;
        for (const g of this.girders) {
          if (f.x >= g.x1 + 8 && f.x <= g.x2 - 8) {
            const gy = girderYAt(g, f.x);
            if (Math.abs(f.y - (gy - 12)) < 20) {
              f.y = gy - 12;
              onGirder = g;
              break;
            }
          }
        }
        // Bounce off girder ends or removed rivet gaps
        const nearRemovedRivet = this.rivets.some(
          (r) => r.removed && Math.abs(r.x - f.x) < 20 && Math.abs(r.y - (f.y + 12)) < 16
        );
        if (!onGirder || f.x < 56 || f.x > W - 56 || nearRemovedRivet) {
          f.dir = (f.dir * -1) as -1 | 1;
          f.x += f.dir * 8;
        }

        // Occasionally climb a ladder toward Jumpman!
        const nearLad = this.ladders.find(
          (l) => !l.retracted && Math.abs(l.x - f.x) < 6 && Math.abs(l.botY - (f.y + 12)) < 14
        );
        if (nearLad && this.py < f.y - 24 && Math.random() < dt * 2.5) {
          f.climbing = true;
          f.x = nearLad.x;
          f.vy = -88;
        }
      }

      if (Math.hypot(f.x - this.px, f.y - (this.py - 14)) < 22) {
        if (this.hammerTimer > 0) {
          this.fireballs.splice(i, 1);
          arcadeAudio.playHammerSmash();
          this.addScore(500, f.x, f.y - 16, '#FACC15', 'SMASH +500!');
          spawnBurst(this.particles, f.x, f.y, '#F97316', 18, 210, 3.4);
          continue;
        } else if (this.invulnTimer <= 0) {
          this.damagePlayer();
          return;
        }
      }
    }
  }

  // ===================== DK JR. STEP =====================
  private stepDkJr(dt: number): void {
    const moveVec = getPrecisionMoveVector(this.input);
    const runSpeed = 195 * moveVec.scale;

    // Mario pacing near Papa Kong's cage
    this.marioPatrolX += this.marioPatrolDir * 64 * dt;
    if (this.marioPatrolX < 380) this.marioPatrolDir = 1;
    if (this.marioPatrolX > 520) this.marioPatrolDir = -1;

    // Move moving jungle platforms on Stage 2
    for (const plat of this.jrPlatforms) {
      if (plat.vx && plat.minX !== undefined && plat.maxX !== undefined) {
        const oldX = plat.x;
        plat.x += plat.vx * dt;
        if (plat.x < plat.minX) {
          plat.x = plat.minX;
          plat.vx = Math.abs(plat.vx);
        } else if (plat.x > plat.maxX) {
          plat.x = plat.maxX;
          plat.vx = -Math.abs(plat.vx);
        }
        // Carry Jr. if standing on this moving island
        if (
          this.grounded &&
          Math.abs(this.py - plat.y) < 8 &&
          this.px >= oldX - 6 &&
          this.px <= oldX + plat.w + 6
        ) {
          this.px += plat.x - oldX;
        }
      }
    }

    // Check how many vines Jr. is gripping (1 vine = fast slide down, 2 vines = 2× fast climb up!)
    const nearbyVines = this.vines.filter(
      (v) => Math.abs(v.x - this.px) < 34 && this.py >= v.topY - 6 && this.py <= v.botY + 12
    );

    if (
      nearbyVines.length > 0 &&
      (this.climbingVines > 0 || this.input.up || this.input.down || Math.abs(moveVec.vy) > 0.35)
    ) {
      this.climbingVines = Math.min(2, nearbyVines.length);
      this.grounded = false;
      this.pvy = 0;

      // Horizontal shift between adjacent vines
      if (Math.abs(moveVec.vx) > 0.15) {
        this.facing = moveVec.vx > 0 ? 1 : -1;
        this.px += moveVec.vx * 135 * dt;
      }

      // Authentic 1982 Dual-Vine Climb vs Single-Vine Fast Slide physics!
      if (this.input.up || moveVec.vy < -0.25) {
        const upSpd = (this.climbingVines >= 2 ? 196 : 112) * moveVec.scale;
        this.py -= upSpd * dt;
        this.walkAnim += dt * (this.climbingVines >= 2 ? 18 : 10);
      } else if (this.input.down || moveVec.vy > 0.25) {
        const downSpd = (this.climbingVines === 1 ? 210 : 120) * moveVec.scale;
        this.py += downSpd * dt;
        this.walkAnim += dt * 14;
      }

      // Leap off vine!
      if (this.input.fireJustPressed) {
        this.climbingVines = 0;
        this.pvy = -360;
        this.px += this.facing * 14;
        arcadeAudio.playJumpBoing();
      } else if (nearbyVines.every((v) => this.py < v.topY)) {
        this.py = nearbyVines[0].topY;
        this.climbingVines = 0;
        this.grounded = true;
      } else if (nearbyVines.every((v) => this.py > v.botY)) {
        this.climbingVines = 0;
      }
    } else {
      this.climbingVines = 0;
      if (Math.abs(moveVec.vx) > 0.1) {
        this.facing = moveVec.vx > 0 ? 1 : -1;
        this.px += moveVec.vx * runSpeed * dt;
        this.walkAnim += dt * 14 * Math.abs(moveVec.vx);
      }

      if (this.grounded && this.input.fireJustPressed) {
        this.pvy = -385;
        this.grounded = false;
        arcadeAudio.playJumpBoing();
      }

      const prevY = this.py;
      this.pvy += 1020 * dt;
      this.py += this.pvy * dt;
      this.grounded = false;

      // Springboard catapult on Stage 2!
      if (
        this.dkJrStageType === 1 &&
        this.pvy >= 0 &&
        Math.abs(this.px - this.springboardX) < 26 &&
        Math.abs(this.py - this.springboardY) < 16
      ) {
        this.pvy = -610;
        this.springboardCompression = 1.0;
        arcadeAudio.playSpring();
        spawnBurst(this.particles, this.springboardX, this.springboardY, '#4ADE80', 12, 160, 2.8);
      }

      for (const plat of this.jrPlatforms) {
        if (
          this.px >= plat.x - 10 &&
          this.px <= plat.x + plat.w + 10 &&
          this.pvy >= 0 &&
          prevY <= plat.y + 12 &&
          this.py >= plat.y - 6
        ) {
          this.py = plat.y;
          this.pvy = 0;
          this.grounded = true;
          break;
        }
      }

      this.px = Math.max(36, Math.min(W - 36, this.px));
      if (this.py > H + 12) {
        this.damagePlayer();
        return;
      }
    }

    // Drop suspended jungle fruits!
    for (const f of this.fruits) {
      if (f.state === 'hanging' && Math.hypot(this.px - f.x, this.py - 16 - f.y) < 28) {
        f.state = 'falling';
        f.vy = 120;
        arcadeAudio.playCoin();
        this.addScore(400, f.x, f.y - 14, '#4ADE80', 'FRUIT +400');
      } else if (f.state === 'falling') {
        f.vy += 880 * dt;
        f.y += f.vy * dt;
        for (let si = this.snapjaws.length - 1; si >= 0; si--) {
          const sj = this.snapjaws[si];
          if (Math.hypot(sj.x - f.x, sj.y - f.y) < 30) {
            f.comboCount++;
            const pts = Math.min(1600, 400 * Math.pow(2, f.comboCount - 1));
            this.snapjaws.splice(si, 1);
            arcadeAudio.playStomp();
            this.addScore(pts, sj.x, sj.y - 12, '#FACC15', `CRUSH +${pts}!`);
            spawnBurst(this.particles, sj.x, sj.y, '#EF4444', 16, 190, 3.2);
          }
        }
        if (f.y > H + 20) f.state = 'used';
      }
    }

    // Collect Golden Cage Keys!
    for (const k of this.keys) {
      if (!k.collected && Math.hypot(this.px - k.x, this.py - 16 - k.y) < 30) {
        k.collected = true;
        arcadeAudio.playKeyUnlock();
        this.addScore(500, k.x, k.y - 16, '#FACC15', 'KEY +500!');
        spawnBurst(this.particles, k.x, k.y, '#FACC15', 16, 180, 3.2);
      }
    }
    if (this.keys.every((k) => k.collected)) {
      this.clearCurrentStage('PAPA KONG FREED!');
      return;
    }

    // Snapjaws / Electric Sparks climbing vines
    this.snapjawTimer -= dt;
    if (this.snapjawTimer <= 0 && this.snapjaws.length < 3 + Math.min(3, this.level)) {
      this.snapjawTimer = Math.max(1.8, 3.4 - this.level * 0.2);
      const vi = Math.floor(Math.random() * this.vines.length);
      const v = this.vines[vi];
      this.snapjaws.push({
        x: v.x,
        y: v.topY + 12,
        vineIdx: vi,
        dirY: 1,
        red: Math.random() < 0.55,
        isSpark: this.dkJrStageType === 2,
        anim: 0,
      });
    }

    for (let i = this.snapjaws.length - 1; i >= 0; i--) {
      const sj = this.snapjaws[i];
      const v = this.vines[sj.vineIdx];
      if (!v) continue;
      sj.anim += dt * 12;
      sj.x = v.x;
      sj.y += sj.dirY * (88 + this.level * 9) * dt;
      if (sj.y > v.botY) {
        if (sj.red || sj.isSpark) {
          sj.dirY = -1;
        } else {
          this.snapjaws.splice(i, 1);
          continue;
        }
      } else if (sj.y < v.topY + 8) {
        sj.dirY = 1;
      }

      if (this.invulnTimer <= 0 && Math.hypot(sj.x - this.px, sj.y - (this.py - 16)) < 22) {
        this.damagePlayer();
        return;
      }
    }

    // Nitpicker Birds & Eggs (Stage 2)
    for (const np of this.nitpickers) {
      np.phase += dt * 8;
      np.x += np.vx * dt;
      if (np.x < -30) np.x = W + 30;
      if (np.x > W + 30) np.x = -30;
      np.eggTimer -= dt;
      if (np.eggTimer <= 0) {
        np.eggTimer = 2.4 + Math.random() * 1.4;
        this.jrEggs.push({ x: np.x, y: np.y + 10, vy: 80 });
      }
      if (this.invulnTimer <= 0 && Math.hypot(np.x - this.px, np.y - (this.py - 14)) < 22) {
        this.damagePlayer();
        return;
      }
    }
    for (let i = this.jrEggs.length - 1; i >= 0; i--) {
      const egg = this.jrEggs[i];
      egg.vy += 420 * dt;
      egg.y += egg.vy * dt;
      if (egg.y > H + 10) {
        this.jrEggs.splice(i, 1);
        continue;
      }
      if (this.invulnTimer <= 0 && Math.hypot(egg.x - this.px, egg.y - (this.py - 14)) < 18) {
        this.damagePlayer();
        return;
      }
    }
  }

  // ===================== DK 3 STEP (STANLEY'S GREENHOUSE) =====================
  private stepDk3(dt: number): void {
    const moveVec = getPrecisionMoveVector(this.input);
    const deckYs = [540, 444, 348];
    const ladderXs = [195, 525];

    if (this.superSprayTimer > 0) this.superSprayTimer = Math.max(0, this.superSprayTimer - dt);
    if (this.sprayCooldown > 0) this.sprayCooldown = Math.max(0, this.sprayCooldown - dt);

    // Stanley movement across greenhouse decks
    if (Math.abs(moveVec.vx) > 0.1) {
      this.facing = moveVec.vx > 0 ? 1 : -1;
      this.px += moveVec.vx * 220 * dt;
      this.px = Math.max(92, Math.min(W - 92, this.px));
      this.walkAnim += dt * 15 * Math.abs(moveVec.vx);
    }

    // Climb between the 3 wooden greenhouse decks near the twin ladders
    const nearLadder = ladderXs.some((lx) => Math.abs(this.px - lx) < 28);
    if (nearLadder && this.dk3JumpOffset === 0) {
      if ((this.input.up || moveVec.vy < -0.45) && this.dk3FloorIdx < 2) {
        this.dk3FloorIdx++;
        this.py = deckYs[this.dk3FloorIdx];
        arcadeAudio.playMoveTick();
      } else if ((this.input.down || moveVec.vy > 0.45) && this.dk3FloorIdx > 0) {
        this.dk3FloorIdx--;
        this.py = deckYs[this.dk3FloorIdx];
        arcadeAudio.playMoveTick();
      }
    }

    // Authentic Stanley Hop/Jump over creeping caterpillars or coconuts (Shift/X or Up away from ladder)
    if (this.dk3JumpOffset === 0 && (this.input.secondaryJustPressed || (!nearLadder && this.input.up))) {
      this.dk3JumpVel = 310;
      arcadeAudio.playJumpBoing();
    }
    if (this.dk3JumpOffset > 0 || this.dk3JumpVel > 0) {
      this.dk3JumpOffset += this.dk3JumpVel * dt;
      this.dk3JumpVel -= 980 * dt;
      if (this.dk3JumpOffset <= 0) {
        this.dk3JumpOffset = 0;
        this.dk3JumpVel = 0;
      }
    }
    this.py = deckYs[this.dk3FloorIdx] - this.dk3JumpOffset;

    // Fire pressurized Bug Spray straight upward!
    if ((this.input.fire || this.input.fireJustPressed) && this.sprayCooldown <= 0) {
      const isSuper = this.superSprayTimer > 0;
      this.sprayCooldown = isSuper ? 0.08 : 0.16;
      arcadeAudio.playSpray();
      this.sprays.push({
        x: this.px,
        y: this.py - 28,
        vy: isSuper ? -640 : -470,
        superPower: isSuper,
        life: isSuper ? 0.65 : 0.48,
      });
    }

    // Donkey Kong slowly creeps down the twin vines & tosses Coconuts!
    this.dk3Y = Math.min(316, this.dk3Y + (12 + this.level * 2.2) * dt);
    this.dk3CoconutTimer -= dt;
    if (this.dk3CoconutTimer <= 0) {
      this.dk3CoconutTimer = Math.max(1.4, 2.8 - this.level * 0.16);
      this.dkHeaveAnim = 1.0;
      this.bugShots.push({
        x: 360 + (Math.random() - 0.5) * 40,
        y: this.dk3Y + 18,
        vx: (this.px - 360) * 0.45,
        vy: 230,
        isCoconut: true,
      });
    }

    // Shake loose golden Super Spray Can once DK is pushed above y=185!
    if (!this.superCanActive && this.superSprayTimer <= 0 && this.dk3Y < 185) {
      this.superCanActive = true;
      this.superCanX = 360;
      this.superCanY = 185;
    }
    if (this.superCanActive) {
      this.superCanY = Math.min(deckYs[1] - 12, this.superCanY + 160 * dt);
      if (Math.hypot(this.px - this.superCanX, this.py - 16 - this.superCanY) < 30) {
        this.superCanActive = false;
        this.superSprayTimer = 7.5;
        arcadeAudio.playPowerUp();
        this.addScore(500, this.px, this.py - 30, '#FACC15', 'SUPER SPRAY!');
      }
    }

    // Step Spray blasts
    for (let i = this.sprays.length - 1; i >= 0; i--) {
      const s = this.sprays[i];
      s.y += s.vy * dt;
      s.life -= dt;
      if (s.life <= 0 || s.y < 70) {
        this.sprays.splice(i, 1);
        continue;
      }

      // Hit Donkey Kong overhead — push him up toward the beehive!
      if (Math.abs(s.x - 360) < 42 && Math.abs(s.y - this.dk3Y) < 34) {
        const push = s.superPower ? 28 : 13;
        this.dk3Y -= push;
        this.addScore(s.superPower ? 150 : 50, 360, this.dk3Y - 22, '#FACC15');
        spawnBurst(this.particles, 360, this.dk3Y + 14, s.superPower ? '#FACC15' : '#4ADE80', 8, 130, 2.5);
        this.sprays.splice(i, 1);

        if (this.dk3Y <= this.dk3PushTarget) {
          const flowerBonus = this.flowers.filter((f) => f.alive).length * 400;
          this.addScore(flowerBonus, 360, 140, '#4ADE80', `FLOWERS +${flowerBonus}`);
          this.clearCurrentStage('DONKEY KONG BEEHIVE KNOCKOUT!');
          return;
        }
        continue;
      }

      // Hit bugs
      let hitBug = false;
      for (let bi = this.bugs.length - 1; bi >= 0; bi--) {
        const bug = this.bugs[bi];
        if (Math.hypot(s.x - bug.x, s.y - bug.y) < 24) {
          bug.hp -= s.superPower ? 2 : 1;
          hitBug = true;
          if (bug.hp <= 0) {
            if (bug.carryingFlowerIdx !== null) {
              const fl = this.flowers[bug.carryingFlowerIdx];
              if (fl) {
                fl.beingCarried = false;
                fl.y = 590;
              }
            }
            const pts = bug.kind === 'beebomb' ? 400 : bug.kind === 'beespy' ? 250 : 150;
            this.addScore(pts, bug.x, bug.y - 12, '#4ADE80');
            spawnBurst(this.particles, bug.x, bug.y, '#FACC15', 14, 170, 3);
            arcadeAudio.playStomp();
            this.bugs.splice(bi, 1);
          }
          break;
        }
      }
      if (hitBug) this.sprays.splice(i, 1);
    }

    // Spawn bugs
    this.bugSpawnTimer -= dt;
    if (this.bugSpawnTimer <= 0 && this.bugs.length < 5 + Math.min(4, this.level)) {
      this.bugSpawnTimer = Math.max(1.2, 2.5 - this.level * 0.14);
      this.spawnGreenhouseBug();
    }

    // Step bugs
    for (let i = this.bugs.length - 1; i >= 0; i--) {
      const bug = this.bugs[i];
      if (!bug) continue;
      bug.phase += dt * 7;

      if (bug.kind === 'creepy') {
        bug.x += bug.vx * dt;
        if (bug.x < 92 || bug.x > W - 92) bug.vx *= -1;
      } else if (bug.carryingFlowerIdx !== null) {
        // Flying away with a stolen potted flower!
        bug.vy = -64;
        bug.y += bug.vy * dt;
        const fl = this.flowers[bug.carryingFlowerIdx];
        if (fl) {
          fl.x = bug.x;
          fl.y = bug.y + 18;
          if (bug.y < 90) {
            fl.alive = false;
            fl.beingCarried = false;
            this.bugs.splice(i, 1);
            continue;
          }
        }
      } else {
        bug.x += bug.vx * dt;
        bug.y += Math.sin(bug.phase * 0.6) * 55 * dt + bug.vy * dt;
        if (bug.x < 64 || bug.x > W - 64) bug.vx *= -1;
        if (bug.y < 120) bug.vy = Math.abs(bug.vy);
        if (bug.y > 570) {
          // Try to grab a flower!
          const targetIdx = this.flowers.findIndex(
            (f) => f.alive && !f.beingCarried && Math.abs(f.x - bug.x) < 42
          );
          if (targetIdx >= 0 && bug.kind === 'buzzbee') {
            bug.carryingFlowerIdx = targetIdx;
            this.flowers[targetIdx].beingCarried = true;
            bug.vx = 0;
          } else {
            bug.vy = -Math.abs(bug.vy);
          }
        }

        bug.fireTimer -= dt;
        if (bug.fireTimer <= 0 && (bug.kind === 'beespy' || bug.kind === 'beebomb')) {
          bug.fireTimer = 2.0 + Math.random() * 1.4;
          const dx = this.px - bug.x;
          const dy = this.py - bug.y;
          const dist = Math.max(1, Math.hypot(dx, dy));
          this.bugShots.push({
            x: bug.x,
            y: bug.y,
            vx: (dx / dist) * 185,
            vy: (dy / dist) * 185,
          });
        }
      }

      if (this.invulnTimer <= 0 && Math.hypot(bug.x - this.px, bug.y - (this.py - 16)) < 22) {
        this.damagePlayer();
        return;
      }
    }

    // Step Bug Stingers & DK Coconuts
    for (let i = this.bugShots.length - 1; i >= 0; i--) {
      const s = this.bugShots[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.y > H + 20 || s.x < -20 || s.x > W + 20) {
        this.bugShots.splice(i, 1);
        continue;
      }
      if (this.invulnTimer <= 0 && Math.hypot(s.x - this.px, s.y - (this.py - 16)) < 18) {
        this.bugShots.splice(i, 1);
        this.damagePlayer();
        return;
      }
    }

    // Lose if DK drops too low or all 5 flowers are stolen
    if (this.dk3Y >= 314 || this.flowers.every((f) => !f.alive)) {
      this.damagePlayer();
    }
  }

  private clearCurrentStage(msg: string): void {
    this.phase = 'STAGE_CLEAR';
    this.phaseTimer = 2.0;
    const bonus = Math.max(500, Math.floor(this.bonusTimer));
    this.addScore(bonus, W * 0.5, H * 0.44, '#4ADE80', `BONUS +${bonus}!`);
    this.bannerText = `${msg} · +${bonus}`;
    arcadeAudio.playStageClear();
  }

  private damagePlayer(): void {
    arcadeAudio.playDeath();
    spawnBurst(this.particles, this.px, this.py - 14, '#EF4444', 22, 220, 3.6);
    this.screenShake = 9;
    this.lives -= 1;
    if (this.lives <= 0) {
      this.phase = 'GAME_OVER';
      this.bannerText = 'GAME OVER · PRESS PLAY TO TRY AGAIN';
      return;
    }
    this.setupStage(this.level);
    this.phase = 'READY';
    this.phaseTimer = 1.3;
    this.bannerText = 'READY!';
  }

  // ===================== RENDER DISPATCH =====================
  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.save();
    ctx.scale(dpr, dpr);

    const shakeX = this.screenShake > 0 ? (Math.random() - 0.5) * this.screenShake : 0;
    const shakeY = this.screenShake > 0 ? (Math.random() - 0.5) * this.screenShake : 0;

    ctx.save();
    ctx.translate(shakeX, shakeY);

    if (this.variant === 'dkong') {
      this.renderDk1(ctx);
    } else if (this.variant === 'dkongjr') {
      this.renderDkJr(ctx);
    } else {
      this.renderDk3(ctx);
    }

    renderParticlesAndPopups(ctx, this.particles, this.popups);
    ctx.restore();

    // Top HUD bar
    ctx.fillStyle = 'rgba(2, 6, 23, 0.86)';
    ctx.fillRect(0, 0, W, 38);
    ctx.fillStyle =
      this.variant === 'dkong' ? '#F97316' : this.variant === 'dkongjr' ? '#22C55E' : '#A3E635';
    ctx.fillRect(0, 37, W, 2);

    ctx.font = '800 12px "JetBrains Mono", monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FACC15';
    ctx.fillText(`1UP ${String(this.score).padStart(6, '0')}`, 14, 19);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#38BDF8';
    ctx.fillText(this.getHudSnapshot().stageName, W * 0.5, 19);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#4ADE80';
    ctx.fillText(`HI ${String(this.highScore).padStart(6, '0')} · ♥${this.lives}`, W - 14, 19);

    // Title Card or Status Banner
    if (this.phase === 'TITLE') {
      this.renderTitleOverlay(ctx);
    } else if (this.bannerText) {
      ctx.save();
      ctx.fillStyle = 'rgba(2, 6, 23, 0.82)';
      ctx.fillRect(W * 0.5 - 230, H * 0.5 - 26, 460, 52);
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2.2;
      ctx.strokeRect(W * 0.5 - 230, H * 0.5 - 26, 460, 52);
      ctx.font = '800 15px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FEF08A';
      ctx.fillText(this.bannerText, W * 0.5, H * 0.5);
      ctx.restore();
    }

    if (visualMode === 'crt') {
      renderCrtOverlay(ctx, W, H);
    }
    ctx.restore();
  }

  // ===================== RENDER DK 1 =====================
  private renderDk1(ctx: CanvasRenderingContext2D): void {
    // Authentic dark midnight construction site skyline
    const bg = ctx.createLinearGradient(0, 38, 0, H);
    bg.addColorStop(0, '#070914');
    bg.addColorStop(1, '#15101F');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Subtle steel crane silhouette in background
    ctx.strokeStyle = 'rgba(244,63,94,0.08)';
    ctx.lineWidth = 2;
    for (let sx = 60; sx < W; sx += 120) {
      ctx.beginPath();
      ctx.moveTo(sx, 40);
      ctx.lineTo(sx, H);
      ctx.stroke();
    }

    // Ladders
    for (const l of this.ladders) {
      if (l.retracted) continue;
      ctx.strokeStyle = l.retractable ? '#FACC15' : '#38BDF8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(l.x - 10, l.topY);
      ctx.lineTo(l.x - 10, l.botY);
      ctx.moveTo(l.x + 10, l.topY);
      ctx.lineTo(l.x + 10, l.botY);
      for (let ry = l.topY + 10; ry < l.botY; ry += 12) {
        ctx.moveTo(l.x - 10, ry);
        ctx.lineTo(l.x + 10, ry);
      }
      ctx.stroke();
    }

    // Steel I-Beam Girders (or Conveyor Belts on 50m!)
    for (const g of this.girders) {
      const col = g.conveyorDir ? '#94A3B8' : this.dk1StageType === 3 ? '#3B82F6' : '#E11D48';
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(g.x1, g.y1 + 6);
      ctx.lineTo(g.x2, g.y2 + 6);
      ctx.stroke();

      // Inner lattice truss zig-zag
      ctx.strokeStyle = g.conveyorDir ? '#FACC15' : '#FDA4AF';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      const steps = Math.max(6, Math.floor((g.x2 - g.x1) / 22));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const gx = g.x1 + (g.x2 - g.x1) * t;
        const gy = g.y1 + (g.y2 - g.y1) * t;
        if (i === 0) ctx.moveTo(gx, gy + 2);
        else ctx.lineTo(gx, gy + (i % 2 === 0 ? 2 : 10));
      }
      ctx.stroke();

      // Conveyor pulleys if conveyor
      if (g.conveyorDir) {
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.arc(g.x1 + 8, g.y1 + 6, 6, 0, Math.PI * 2);
        ctx.arc(g.x2 - 8, g.y2 + 6, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Golden Rivets on 100m
    for (const r of this.rivets) {
      if (r.removed) {
        ctx.fillStyle = '#070914';
        ctx.fillRect(r.x - 14, r.y - 1, 28, 15);
      } else {
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(r.x - 12, r.y, 24, 12);
        ctx.fillStyle = '#FEF9C3';
        ctx.fillRect(r.x - 8, r.y + 2, 16, 4);
      }
    }

    // Moving Elevators on 75m
    for (const el of this.elevators) {
      ctx.strokeStyle = 'rgba(148,163,184,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(el.x, el.minY - 12);
      ctx.lineTo(el.x, el.maxY + 12);
      ctx.stroke();

      ctx.fillStyle = '#F97316';
      ctx.fillRect(el.x - el.w * 0.5, el.y, el.w, 10);
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(el.x - el.w * 0.5 + 4, el.y + 2, el.w - 8, 3);
    }

    // Oil Drum (25m bottom left or 50m center)
    if (this.dk1StageType === 0 || this.dk1StageType === 1) {
      const ox = this.dk1StageType === 0 ? 74 : 360;
      const oy = this.dk1StageType === 0 ? 580 : 368;
      ctx.fillStyle = '#1D4ED8';
      ctx.fillRect(ox - 16, oy - 34, 32, 34);
      ctx.fillStyle = '#38BDF8';
      ctx.font = '800 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('OIL', ox, oy - 13);
      if (this.oilLit) {
        const flH = 14 + Math.sin(this.time * 20) * 5;
        ctx.fillStyle = '#F97316';
        ctx.beginPath();
        ctx.moveTo(ox - 12, oy - 34);
        ctx.lineTo(ox, oy - 34 - flH);
        ctx.lineTo(ox + 12, oy - 34);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.moveTo(ox - 6, oy - 34);
        ctx.lineTo(ox, oy - 34 - flH * 0.65);
        ctx.lineTo(ox + 6, oy - 34);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Donkey Kong & Pauline!
    const dkX = this.dk1StageType === 3 ? 360 : 122;
    const dkY = this.dk1StageType === 3 ? 132 : 120;
    drawHDDonkeyKong(ctx, dkX, dkY, 1.0, this.time, this.dkHeaveAnim > 0);

    // Pauline (pink dress, golden hair, waving HELP!)
    const paulineX = this.dk1StageType === 3 ? 360 : 326;
    const paulineY = this.dk1StageType === 3 ? 72 : 96;
    ctx.save();
    ctx.translate(paulineX, paulineY - 16);
    ctx.fillStyle = '#EC4899';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(10, 14);
    ctx.lineTo(-10, 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#FDE68A';
    ctx.beginPath();
    ctx.arc(0, -10, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#92400E';
    ctx.fillRect(-7, -16, 14, 5);
    if (Math.floor(this.time * 2.5) % 2 === 0) {
      ctx.font = '800 10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#38BDF8';
      ctx.textAlign = 'center';
      ctx.fillText('HELP!', 26, -14);
    }
    ctx.restore();

    // Hammers
    for (const h of this.hammers) {
      if (h.taken) continue;
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.fillStyle = '#B45309';
      ctx.fillRect(-2, -4, 4, 16);
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(-10, -12, 20, 10);
      drawStarGlint(ctx, 8, -10, 4, '#FFFFFF', 0.8);
      ctx.restore();
    }

    // Pauline's Items
    for (const item of this.paulineItems) {
      if (item.taken) continue;
      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.fillStyle = item.kind === 'purse' ? '#F472B6' : item.kind === 'umbrella' ? '#38BDF8' : '#FACC15';
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.restore();
    }

    // Barrels
    for (const b of this.barrels) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);
      ctx.fillStyle = b.blue ? '#2563EB' : '#B45309';
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = b.blue ? '#93C5FD' : '#F59E0B';
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.lineTo(8, 0);
      ctx.stroke();
      ctx.restore();
    }

    // Cement Pies
    for (const pie of this.pies) {
      ctx.save();
      ctx.translate(pie.x, pie.y);
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(-13, -7, 26, 14);
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(-11, -5, 22, 4);
      ctx.restore();
    }

    // Bouncing Jack Springs
    for (const s of this.springs) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-8, -10);
      ctx.lineTo(8, -4);
      ctx.lineTo(-8, 2);
      ctx.lineTo(8, 8);
      ctx.stroke();
      ctx.restore();
    }

    // Climbing Fireballs
    for (const f of this.fireballs) {
      ctx.save();
      ctx.translate(f.x, f.y);
      const col = this.hammerTimer > 0 ? '#38BDF8' : '#F97316';
      ctx.fillStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, 0, 11 + Math.sin(f.anim) * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(-5, -3, 3, 4);
      ctx.fillRect(2, -3, 3, 4);
      ctx.restore();
    }

    // Jumpman Hero + Hammer Swing!
    if (this.invulnTimer <= 0 || Math.floor(this.time * 16) % 2 === 0) {
      drawHDMarioHero(ctx, {
        x: this.px,
        y: this.py,
        facing: this.facing,
        scale: 1.0,
        walkPhase: this.walkAnim,
        isMoving: Math.abs(this.pvx) > 1 || this.walkAnim > 0,
        isJumping: !this.grounded && !this.onLadder,
        isClimbing: this.onLadder,
        character: 'jumpman',
        hammerSwing: this.hammerTimer > 0 ? this.time * 16 : null,
        clock: this.time,
      });
      if (this.hammerTimer > 0) {
        const swing = Math.sin(this.time * 24) > 0;
        ctx.save();
        ctx.translate(this.px, this.py - 18);
        ctx.fillStyle = '#B45309';
        ctx.fillRect(swing ? this.facing * 10 : -3, swing ? -2 : -22, swing ? 16 : 5, swing ? 5 : 18);
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(swing ? this.facing * 20 : -9, swing ? -10 : -30, 18, 12);
        ctx.restore();
      }
    }
  }

  // ===================== RENDER DK JR. =====================
  private renderDkJr(ctx: CanvasRenderingContext2D): void {
    const isHideout = this.dkJrStageType === 2;
    const bg = ctx.createLinearGradient(0, 38, 0, H);
    if (isHideout) {
      bg.addColorStop(0, '#090D1E');
      bg.addColorStop(1, '#1E1B4B');
    } else {
      bg.addColorStop(0, '#04231D');
      bg.addColorStop(0.6, '#064E3B');
      bg.addColorStop(1, '#022C22');
    }
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Lush animated jungle waterfall & palm silhouettes (Stages 1 & 2)
    if (!isHideout) {
      ctx.fillStyle = 'rgba(56,189,248,0.16)';
      ctx.fillRect(280, 40, 88, H - 40);
      ctx.fillStyle = 'rgba(186,230,253,0.22)';
      const wfOffset = (this.time * 90) % 40;
      for (let wy = 40 + wfOffset; wy < H; wy += 40) {
        ctx.fillRect(292, wy, 12, 16);
        ctx.fillRect(334, wy + 18, 10, 14);
      }
    }

    // Vines or Steel Chains
    for (const v of this.vines) {
      ctx.strokeStyle = v.isChain ? '#94A3B8' : '#22C55E';
      ctx.lineWidth = v.isChain ? 4.5 : 5;
      ctx.beginPath();
      ctx.moveTo(v.x, v.topY);
      ctx.lineTo(v.x, v.botY);
      ctx.stroke();

      // Leaves on jungle vines
      if (!v.isChain) {
        ctx.fillStyle = '#4ADE80';
        for (let ly = v.topY + 24; ly < v.botY - 12; ly += 32) {
          ctx.beginPath();
          ctx.ellipse(v.x + ((ly / 32) % 2 === 0 ? 7 : -7), ly, 6, 3, 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Jungle Grass Platforms / Steel Decks
    for (const plat of this.jrPlatforms) {
      ctx.fillStyle = isHideout ? '#475569' : '#92400E';
      ctx.fillRect(plat.x, plat.y, plat.w, 16);
      ctx.fillStyle = isHideout ? '#38BDF8' : '#22C55E';
      ctx.fillRect(plat.x, plat.y, plat.w, 5);
    }

    // Springboard on Stage 2
    if (this.dkJrStageType === 1) {
      ctx.save();
      ctx.translate(this.springboardX, this.springboardY);
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(-20, 2 + this.springboardCompression * 5, 40, 6);
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-12, 8);
      ctx.lineTo(12, 14);
      ctx.lineTo(-12, 18);
      ctx.stroke();
      ctx.restore();
    }

    // Papa Donkey Kong inside his barred cage + Pacing Mario!
    drawHDDonkeyKong(ctx, 265, 102, 0.85, this.time, false);
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 3;
    ctx.strokeRect(228, 66, 74, 70);
    for (let bx = 242; bx <= 288; bx += 14) {
      ctx.beginPath();
      ctx.moveTo(bx, 66);
      ctx.lineTo(bx, 136);
      ctx.stroke();
    }
    // Pacing Mario guard next to the cage!
    drawHDMarioHero(ctx, {
      x: this.marioPatrolX,
      y: 138,
      facing: this.marioPatrolDir,
      scale: 0.9,
      walkPhase: this.time * 8,
      isMoving: true,
      character: 'mario',
      clock: this.time,
    });

    // Golden Keys
    for (const k of this.keys) {
      if (k.collected) continue;
      ctx.save();
      ctx.translate(k.x, k.y);
      ctx.fillStyle = '#FACC15';
      ctx.shadowColor = '#FACC15';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, -6, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-2.5, 0, 5, 14);
      ctx.fillRect(2, 6, 5, 3);
      ctx.fillRect(2, 11, 5, 3);
      ctx.restore();
    }

    // Hanging / Falling Fruits
    for (const f of this.fruits) {
      if (f.state === 'used') continue;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.fillStyle = f.kind === 'apple' ? '#EF4444' : f.kind === 'banana' ? '#FACC15' : '#4ADE80';
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#22C55E';
      ctx.fillRect(-2, -14, 4, 5);
      ctx.restore();
    }

    // Snapjaws / Electric Sparks
    for (const sj of this.snapjaws) {
      ctx.save();
      ctx.translate(sj.x, sj.y);
      if (sj.isSpark) {
        ctx.fillStyle = Math.floor(this.time * 16) % 2 === 0 ? '#38BDF8' : '#FACC15';
        ctx.shadowColor = '#38BDF8';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = sj.red ? '#EF4444' : '#3B82F6';
        ctx.beginPath();
        ctx.ellipse(0, 0, 13, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        // Snapping white jaws
        const open = 2 + Math.abs(Math.sin(sj.anim)) * 4;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(-7, -open, 14, 3);
        ctx.fillRect(-7, open - 2, 14, 3);
      }
      ctx.restore();
    }

    // Nitpickers & Eggs
    for (const np of this.nitpickers) {
      ctx.save();
      ctx.translate(np.x, np.y);
      ctx.scale(np.vx >= 0 ? 1 : -1, 1);
      ctx.fillStyle = '#F43F5E';
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.moveTo(12, -2);
      ctx.lineTo(22, 1);
      ctx.lineTo(12, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    for (const egg of this.jrEggs) {
      ctx.fillStyle = '#FEF9C3';
      ctx.beginPath();
      ctx.ellipse(egg.x, egg.y, 6, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Expressive Donkey Kong Jr. Sprite (White singlet with red "J"!)
    if (this.invulnTimer <= 0 || Math.floor(this.time * 16) % 2 === 0) {
      this.drawDonkeyKongJr(ctx);
    }
  }

  private drawDonkeyKongJr(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.px, this.py - 16);
    if (this.grounded) drawSoftShadow(ctx, 0, 16, 13, 4, 0.4);
    ctx.scale(this.facing, 1);

    // Fur body & head
    ctx.fillStyle = '#92400E';
    ctx.beginPath();
    ctx.ellipse(0, 2, 12, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(2, -10, 9, 0, Math.PI * 2);
    ctx.fill();

    // Tan snout & face
    ctx.fillStyle = '#FDE68A';
    ctx.beginPath();
    ctx.ellipse(6, -8, 6, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(5, -12, 2.5, 2.5);

    // Iconic White Singlet with bold red "J"!
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(-8, -3, 16, 12);
    ctx.font = '900 10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#EF4444';
    ctx.textAlign = 'center';
    ctx.fillText('J', 0, 6);

    // Articulated climbing arms (spread wide when gripping 2 vines!)
    ctx.strokeStyle = '#92400E';
    ctx.lineWidth = 4;
    const armReach = this.climbingVines >= 2 ? 17 : 11;
    const swing = Math.sin(this.walkAnim) * 5;
    ctx.beginPath();
    ctx.moveTo(-7, -2);
    ctx.lineTo(-armReach, -8 + swing);
    ctx.moveTo(7, -2);
    ctx.lineTo(armReach, -8 - swing);
    ctx.stroke();

    // Feet
    ctx.fillStyle = '#FDE68A';
    ctx.fillRect(-7 + swing * 0.5, 11, 6, 4);
    ctx.fillRect(2 - swing * 0.5, 11, 6, 4);

    ctx.restore();
  }

  // ===================== RENDER DK 3 (GREENHOUSE) =====================
  private renderDk3(ctx: CanvasRenderingContext2D): void {
    const theme = DK3_THEMES[(this.level - 1) % DK3_THEMES.length];
    const bg = ctx.createLinearGradient(0, 38, 0, H);
    bg.addColorStop(0, theme.skyTop);
    bg.addColorStop(1, theme.skyBot);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Glasshouse conservatory arched steel frame
    ctx.strokeStyle = theme.glassFrame;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 3;
    for (let gx = 90; gx <= W - 90; gx += 108) {
      ctx.beginPath();
      ctx.moveTo(gx, 40);
      ctx.lineTo(gx, H);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(W * 0.5, 190, 290, Math.PI, 0);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Overhead Twin Vines & Golden Beehive Target
    ctx.strokeStyle = '#22C55E';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(334, 60);
    ctx.lineTo(334, 330);
    ctx.moveTo(386, 60);
    ctx.lineTo(386, 330);
    ctx.stroke();

    // Golden Beehive at top center!
    ctx.save();
    ctx.translate(360, 72);
    ctx.fillStyle = '#FACC15';
    ctx.shadowColor = '#FACC15';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.ellipse(0, 0, 28, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#B45309';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-22, -4);
    ctx.lineTo(22, -4);
    ctx.moveTo(-24, 4);
    ctx.lineTo(24, 4);
    ctx.stroke();
    ctx.restore();

    // Donkey Kong hanging from twin vines!
    drawHDDonkeyKong(ctx, 360, this.dk3Y, 1.05, this.time, this.dkHeaveAnim > 0);

    // 3 Greenhouse Wooden Decks & Twin Ladders
    const deckYs = [540, 444, 348];
    for (const dy of deckYs) {
      const grad = ctx.createLinearGradient(0, dy, 0, dy + 12);
      grad.addColorStop(0, theme.deckTop);
      grad.addColorStop(1, theme.deckBot);
      ctx.fillStyle = grad;
      ctx.fillRect(80, dy, W - 160, 12);
    }
    for (const lx of [195, 525]) {
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(lx - 10, 348);
      ctx.lineTo(lx - 10, 540);
      ctx.moveTo(lx + 10, 348);
      ctx.lineTo(lx + 10, 540);
      for (let ry = 360; ry < 540; ry += 14) {
        ctx.moveTo(lx - 10, ry);
        ctx.lineTo(lx + 10, ry);
      }
      ctx.stroke();
    }

    // 5 Individually Drawn Potted Blooming Flowers!
    for (const fl of this.flowers) {
      if (!fl.alive) continue;
      ctx.save();
      ctx.translate(fl.x, fl.y);
      // Terracotta pot
      ctx.fillStyle = '#C2410C';
      ctx.beginPath();
      ctx.moveTo(-10, 14);
      ctx.lineTo(10, 14);
      ctx.lineTo(13, 0);
      ctx.lineTo(-13, 0);
      ctx.closePath();
      ctx.fill();
      // Green stem & leaves
      ctx.strokeStyle = '#22C55E';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -14);
      ctx.stroke();
      // Blooming petals
      ctx.fillStyle = fl.color;
      for (let p = 0; p < 5; p++) {
        const a = (p * Math.PI * 2) / 5 + this.time * 0.5;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 6, -16 + Math.sin(a) * 6, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(0, -16, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Super Spray Can pickup
    if (this.superCanActive) {
      ctx.save();
      ctx.translate(this.superCanX, this.superCanY);
      ctx.fillStyle = '#FACC15';
      ctx.shadowColor = '#FACC15';
      ctx.shadowBlur = 14;
      ctx.fillRect(-9, -12, 18, 24);
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(-5, -16, 10, 4);
      ctx.font = '900 9px "JetBrains Mono", monospace';
      ctx.fillStyle = '#0F172A';
      ctx.textAlign = 'center';
      ctx.fillText('SUP', 0, 3);
      ctx.restore();
    }

    // Bug Spray Clouds
    for (const s of this.sprays) {
      ctx.save();
      ctx.translate(s.x, s.y);
      const col = s.superPower ? '#FACC15' : '#A3E635';
      ctx.fillStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.ellipse(0, 0, s.superPower ? 12 : 8, s.superPower ? 18 : 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Greenhouse Insects
    for (const bug of this.bugs) {
      ctx.save();
      ctx.translate(bug.x, bug.y);
      if (bug.kind === 'creepy') {
        ctx.fillStyle = '#4ADE80';
        for (let seg = -1; seg <= 1; seg++) {
          ctx.beginPath();
          ctx.arc(seg * 8, Math.sin(bug.phase + seg) * 2, 6.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        const wing = Math.sin(bug.phase * 2.4) * 5;
        ctx.fillStyle = 'rgba(226,232,240,0.75)';
        ctx.beginPath();
        ctx.ellipse(-9, -6 + wing * 0.4, 8, 4, -0.4, 0, Math.PI * 2);
        ctx.ellipse(9, -6 + wing * 0.4, 8, 4, 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle =
          bug.kind === 'beebomb' ? '#EF4444' : bug.kind === 'beespy' ? '#38BDF8' : '#FACC15';
        ctx.beginPath();
        ctx.ellipse(0, 0, 10, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-8, -1, 16, 3);
      }
      ctx.restore();
    }

    // Bug Stingers & DK Coconuts
    for (const s of this.bugShots) {
      ctx.save();
      ctx.translate(s.x, s.y);
      if (s.isCoconut) {
        ctx.fillStyle = '#78350F';
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#D97706';
        ctx.beginPath();
        ctx.arc(-2, -2, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#FB7185';
        ctx.beginPath();
        ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Expressive Stanley the Bugman Sprite
    if (this.invulnTimer <= 0 || Math.floor(this.time * 16) % 2 === 0) {
      this.drawStanley(ctx);
    }
  }

  private drawStanley(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.px, this.py - 16);
    if (this.dk3JumpOffset === 0) drawSoftShadow(ctx, 0, 16, 13, 3.5, 0.4);
    ctx.scale(this.facing, 1);

    // Pressurized Sprayer Backpack
    ctx.fillStyle = this.superSprayTimer > 0 ? '#FACC15' : '#38BDF8';
    ctx.fillRect(-13, -6, 7, 15);
    // Nozzle pointed straight up
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(-2, -26, 4, 16);

    // Blue overalls & white shirt
    ctx.fillStyle = '#2563EB';
    ctx.fillRect(-7, 0, 14, 12);
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(-6, -6, 12, 7);

    // Head & green gardener cap
    ctx.fillStyle = '#FDE68A';
    ctx.beginPath();
    ctx.arc(0, -11, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#16A34A';
    ctx.fillRect(-8, -18, 16, 6);
    ctx.fillRect(2, -14, 9, 2.5);

    const stride = Math.sin(this.walkAnim) * 4;
    ctx.fillStyle = '#78350F';
    ctx.fillRect(-6 + stride, 12, 5, 4);
    ctx.fillRect(1 - stride, 12, 5, 4);
    ctx.restore();
  }

  private renderTitleOverlay(ctx: CanvasRenderingContext2D): void {
    const accent =
      this.variant === 'dkong' ? '#F97316' : this.variant === 'dkongjr' ? '#22C55E' : '#A3E635';
    const title =
      this.variant === 'dkong'
        ? 'DONKEY KONG'
        : this.variant === 'dkongjr'
          ? 'DONKEY KONG JR.'
          : 'DONKEY KONG 3';
    const sub =
      this.variant === 'dkong'
        ? '1981 NINTENDO · ALL 4 ARCADE STAGES (25m / 50m / 75m / 100m)'
        : this.variant === 'dkongjr'
          ? '1982 NINTENDO · 3 JUNGLE & ELECTRIC HIDEOUT STAGES'
          : '1983 NINTENDO · STANLEY’S BOTANICAL GREENHOUSE';
    const line2 =
      this.variant === 'dkong'
        ? 'GIRDERS · PIE CONVEYORS · ELEVATOR SPRINGS · RIVETS & FIREBALLS'
        : this.variant === 'dkongjr'
          ? '2-VINE FAST CLIMB · DROP FRUIT CRUSHES · SPRINGBOARDS & SPARKS'
          : 'SUPER SPRAY CAN · 5 POTTED FLOWERS · DODGE DK COCONUTS & BUGS';

    ctx.save();
    ctx.fillStyle = 'rgba(2, 6, 23, 0.8)';
    ctx.fillRect(W * 0.5 - 255, H * 0.5 - 100, 510, 200);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.strokeRect(W * 0.5 - 255, H * 0.5 - 100, 510, 200);

    ctx.textAlign = 'center';
    ctx.font = '900 38px "JetBrains Mono", monospace';
    ctx.fillStyle = accent;
    ctx.fillText(title, W * 0.5, H * 0.5 - 40);

    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.fillStyle = '#F8FAFC';
    ctx.fillText(sub, W * 0.5, H * 0.5 - 4);

    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText(line2, W * 0.5, H * 0.5 + 26);

    ctx.font = '800 15px "JetBrains Mono", monospace';
    ctx.fillStyle = Math.floor(this.time * 3) % 2 === 0 ? '#FACC15' : '#4ADE80';
    ctx.fillText('PRESS PLAY OR SPACE TO START', W * 0.5, H * 0.5 + 68);
    ctx.restore();
  }
}

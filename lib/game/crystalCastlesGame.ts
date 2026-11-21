import { arcadeAudio } from './audio';
import {
  ArcadeGameInstance,
  ArcadeInputState,
  ClassicGameHud,
  ClassicGamePhase,
  createEmptyInput,
  getPrecisionMoveVector,
  readHighScore,
  renderCrtOverlay,
  renderParticlesAndPopups,
  saveHighScore,
  ScorePopup,
  SimpleParticle,
  spawnBurst,
  stepParticlesAndPopups,
} from './classicArcadeInterface';

const W = 720;
const H = 600;
const GRID = 12;
const TILE_W = 26;
const TILE_H = 14;
const ELEV_H = 22;
const ORIGIN_X = W * 0.5;
const ORIGIN_Y = 148;
const STORAGE_KEY = 'crystalcastles_atari_highscore_v4';

type StairDir = 'nx' | 'px' | 'ny' | 'py' | null;

interface CastleTile {
  /** -1 = open chasm/moat, 0..3 = solid deck elevation */
  h: number;
  /** Optional staircase climbing UP in the given grid direction */
  stair: StairDir;
  /** Decorative crystal turret/pillar accent on corners (walkable cap or rim) */
  trim: 'none' | 'pillar' | 'arch' | 'glow';
}

interface CastleElevator {
  gx: number;
  gy: number;
  minH: number;
  maxH: number;
  curH: number;
  speed: number;
  phase: number;
}

interface CastleTheme {
  name: string;
  bgTop: string;
  bgMid: string;
  bgBottom: string;
  moatColor: string;
  tileTopA: string;
  tileTopB: string;
  tileHi: string;
  tileLeft: string;
  tileRight: string;
  stairTop: string;
  stairSide: string;
  gemColor: string;
  gemCore: string;
  gemGlow: string;
  accent: string;
}

const CASTLE_THEMES: CastleTheme[] = [
  {
    name: 'BLUE CRYSTAL COURTYARD',
    bgTop: '#050919',
    bgMid: '#0D1736',
    bgBottom: '#16244D',
    moatColor: 'rgba(56, 189, 248, 0.22)',
    tileTopA: '#60A5FA',
    tileTopB: '#3B82F6',
    tileHi: '#BFDBFE',
    tileLeft: '#1D4ED8',
    tileRight: '#1E3A8A',
    stairTop: '#93C5FD',
    stairSide: '#1E40AF',
    gemColor: '#67E8F9',
    gemCore: '#FFFFFF',
    gemGlow: '#38BDF8',
    accent: '#38BDF8',
  },
  {
    name: 'EMERALD PYRAMID',
    bgTop: '#041310',
    bgMid: '#0A2720',
    bgBottom: '#113A2F',
    moatColor: 'rgba(52, 211, 153, 0.22)',
    tileTopA: '#34D399',
    tileTopB: '#10B981',
    tileHi: '#A7F3D0',
    tileLeft: '#047857',
    tileRight: '#065F46',
    stairTop: '#6EE7B7',
    stairSide: '#064E3B',
    gemColor: '#FDE047',
    gemCore: '#FFFBEB',
    gemGlow: '#FACC15',
    accent: '#FACC15',
  },
  {
    name: 'SUNSET SKY BRIDGES',
    bgTop: '#160916',
    bgMid: '#2E1125',
    bgBottom: '#4A1828',
    moatColor: 'rgba(251, 146, 60, 0.22)',
    tileTopA: '#FB923C',
    tileTopB: '#F97316',
    tileHi: '#FED7AA',
    tileLeft: '#C2410C',
    tileRight: '#9A3412',
    stairTop: '#FDBA74',
    stairSide: '#7C2D12',
    gemColor: '#F472B6',
    gemCore: '#FDF2F8',
    gemGlow: '#EC4899',
    accent: '#F472B6',
  },
  {
    name: 'SAPPHIRE TWIN TOWERS',
    bgTop: '#080B24',
    bgMid: '#15194A',
    bgBottom: '#221F61',
    moatColor: 'rgba(129, 140, 248, 0.24)',
    tileTopA: '#818CF8',
    tileTopB: '#6366F1',
    tileHi: '#C7D2FE',
    tileLeft: '#4338CA',
    tileRight: '#312E81',
    stairTop: '#A5B4FC',
    stairSide: '#3730A3',
    gemColor: '#34D399',
    gemCore: '#ECFDF5',
    gemGlow: '#10B981',
    accent: '#34D399',
  },
  {
    name: 'AMETHYST LABYRINTH',
    bgTop: '#120724',
    bgMid: '#27104D',
    bgBottom: '#3C156B',
    moatColor: 'rgba(192, 132, 252, 0.24)',
    tileTopA: '#C084FC',
    tileTopB: '#A855F7',
    tileHi: '#E9D5FF',
    tileLeft: '#7E22CE',
    tileRight: '#581C87',
    stairTop: '#D8B4FE',
    stairSide: '#6B21A8',
    gemColor: '#FBBF24',
    gemCore: '#FEF9C3',
    gemGlow: '#F59E0B',
    accent: '#FBBF24',
  },
  {
    name: 'RUBY RAMPARTS',
    bgTop: '#170710',
    bgMid: '#310E20',
    bgBottom: '#4C142B',
    moatColor: 'rgba(244, 63, 94, 0.22)',
    tileTopA: '#FB7185',
    tileTopB: '#F43F5E',
    tileHi: '#FECDD3',
    tileLeft: '#BE123C',
    tileRight: '#881337',
    stairTop: '#FDA4AF',
    stairSide: '#9F1239',
    gemColor: '#38BDF8',
    gemCore: '#F0F9FF',
    gemGlow: '#0EA5E9',
    accent: '#38BDF8',
  },
  {
    name: 'GLACIAL SPIRE',
    bgTop: '#04121E',
    bgMid: '#0A253B',
    bgBottom: '#133C59',
    moatColor: 'rgba(103, 232, 249, 0.24)',
    tileTopA: '#67E8F9',
    tileTopB: '#22D3EE',
    tileHi: '#CFFAFE',
    tileLeft: '#0E7490',
    tileRight: '#155E75',
    stairTop: '#A5F3FC',
    stairSide: '#164E63',
    gemColor: '#F472B6',
    gemCore: '#FFFFFF',
    gemGlow: '#EC4899',
    accent: '#F472B6',
  },
  {
    name: "BERTHILDA'S OBSIDIAN CITADEL",
    bgTop: '#0C0614',
    bgMid: '#1F0C2E',
    bgBottom: '#341145',
    moatColor: 'rgba(232, 121, 249, 0.26)',
    tileTopA: '#F472B6',
    tileTopB: '#DB2777',
    tileHi: '#FBCFE8',
    tileLeft: '#9D174D',
    tileRight: '#701A75',
    stairTop: '#F9A8D4',
    stairSide: '#831843',
    gemColor: '#67E8F9',
    gemCore: '#FFFFFF',
    gemGlow: '#22D3EE',
    accent: '#67E8F9',
  },
];

interface CastleGem {
  gx: number;
  gy: number;
  collected: boolean;
  sparklePhase: number;
  value: number;
}

interface CastleEnemy {
  kind: 'gem_eater' | 'tree' | 'crystal_ball' | 'skeleton' | 'witch' | 'bee_swarm';
  gx: number;
  gy: number;
  vx: number;
  vy: number;
  eatingTimer: number;
  stunTimer: number;
  phase: number;
  facing: number;
}

interface TrailGhost {
  gx: number;
  gy: number;
  elev: number;
  life: number;
  color: string;
}

export class CrystalCastlesGame implements ArcadeGameInstance {
  public readonly logicalWidth = W;
  public readonly logicalHeight = H;
  public readonly supportsPointerAim = true;
  public readonly primaryActionLabel = 'Jump!';
  public readonly secondaryActionLabel = 'Dash';

  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();
  private score = 0;
  private highScore = readHighScore(STORAGE_KEY);
  private nextExtraLife = 12000;
  private level = 1;
  private lives = 3;
  private clock = 0;
  private stateTimer = 0;
  private castleTimer = 0;
  private beesSpawned = false;

  // 12x12 architectural grid
  private tiles: CastleTile[][] = [];
  private elevators: CastleElevator[] = [];
  private gems: CastleGem[] = [];
  private gemCombo = 0;
  private gemComboTimer = 0;

  // Bentley Bear state
  private bx = 5.5;
  private by = 10.4;
  private curElev = 0; // smooth world elevation
  private bz = 0; // jump height above ground/elevator
  private bvz = 0;
  private bFacingX = 1;
  private bFacingY = 1; // +1 = toward camera, -1 = away from camera
  private walkAnim = 0;
  private squash = 1; // squash & stretch factor
  private invulnTimer = 0;
  private hatTimer = 0;
  private dashTimer = 0;
  private dashCooldown = 0;
  private dashDx = 0;
  private dashDy = 0;
  private hurtAnimTimer = 0;
  private cheerTimer = 0;
  private spawnX = 5.5;
  private spawnY = 10.4;

  // Bonus items
  private magicHat: { gx: number; gy: number; active: boolean } = { gx: 1.5, gy: 1.5, active: true };
  private honeyPot: { gx: number; gy: number; active: boolean } = { gx: 10.5, gy: 5.5, active: false };
  private warpPad: { gx: number; gy: number; active: boolean } = { gx: 10.5, gy: 1.5, active: false };

  private enemies: CastleEnemy[] = [];
  private trails: TrailGhost[] = [];
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  constructor() {
    this.setupCastle(1);
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public startNewGame(): void {
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.nextExtraLife = 12000;
    this.level = 1;
    this.lives = 3;
    this.phase = 'READY';
    this.stateTimer = 0.85;
    this.setupCastle(1);
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.setupCastle(1);
  }

  private getTheme(): CastleTheme {
    return CASTLE_THEMES[(this.level - 1) % CASTLE_THEMES.length];
  }

  private getTile(gx: number, gy: number): CastleTile | null {
    const ix = Math.floor(gx);
    const iy = Math.floor(gy);
    if (ix < 0 || ix >= GRID || iy < 0 || iy >= GRID) return null;
    return this.tiles[iy][ix];
  }

  /** Returns continuous surface elevation including smooth stair slope & live elevators (-1 = void) */
  private surfaceElevation(gx: number, gy: number): number {
    const ix = Math.floor(gx);
    const iy = Math.floor(gy);
    if (ix < 0 || ix >= GRID || iy < 0 || iy >= GRID) return -1;

    // Check elevators first!
    for (const el of this.elevators) {
      if (Math.abs(gx - (el.gx + 0.5)) < 0.56 && Math.abs(gy - (el.gy + 0.5)) < 0.56) {
        return el.curH;
      }
    }

    const t = this.tiles[iy][ix];
    if (t.h < 0) return -1;
    if (!t.stair) return t.h;

    const fx = gx - ix;
    const fy = gy - iy;
    // Stair rises smoothly from t.h to t.h + 1 in the stair direction
    if (t.stair === 'px') return t.h + fx;
    if (t.stair === 'nx') return t.h + (1 - fx);
    if (t.stair === 'py') return t.h + fy;
    return t.h + (1 - fy);
  }

  private iso(gx: number, gy: number, elevation = 0): { x: number; y: number } {
    return {
      x: ORIGIN_X + (gx - gy) * TILE_W,
      y: ORIGIN_Y + (gx + gy) * TILE_H - elevation * ELEV_H,
    };
  }

  private screenToGrid(sx: number, sy: number, refElev = 0): { gx: number; gy: number } {
    const adjY = sy + refElev * ELEV_H;
    const dx = (sx - ORIGIN_X) / TILE_W;
    const dy = (adjY - ORIGIN_Y) / TILE_H;
    return {
      gx: (dx + dy) * 0.5,
      gy: (dy - dx) * 0.5,
    };
  }

  private addScore(pts: number, gx?: number, gy?: number, color = '#FEF08A', label?: string): void {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(STORAGE_KEY, this.highScore);
    }
    if (this.score >= this.nextExtraLife) {
      this.lives = Math.min(6, this.lives + 1);
      this.nextExtraLife += 12000;
      arcadeAudio.playExtraLife();
      const p = this.iso(this.bx, this.by, Math.max(0, this.curElev) + 1.5);
      this.popups.push({ x: p.x, y: p.y, text: '1UP EXTRA BEAR!', color: '#4ADE80', life: 1.4, maxLife: 1.4 });
    }
    if (gx !== undefined && gy !== undefined) {
      const h = Math.max(0, this.surfaceElevation(gx, gy));
      const p = this.iso(gx, gy, h + 1.0);
      this.popups.push({
        x: p.x,
        y: p.y,
        text: label || `+${pts}`,
        color,
        life: 0.95,
        maxLife: 0.95,
      });
    }
  }

  private setRect(x0: number, y0: number, x1: number, y1: number, h: number): void {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (x >= 0 && x < GRID && y >= 0 && y < GRID) {
          this.tiles[y][x].h = h;
          this.tiles[y][x].stair = null;
        }
      }
    }
  }

  private setStair(x: number, y: number, baseH: number, dir: StairDir): void {
    if (x < 0 || x >= GRID || y < 0 || y >= GRID) return;
    this.tiles[y][x].h = baseH;
    this.tiles[y][x].stair = dir;
  }

  private setupCastle(lv: number): void {
    this.level = lv;
    this.tiles = Array.from({ length: GRID }, () =>
      Array.from({ length: GRID }, () => ({ h: 0, stair: null as StairDir, trim: 'none' as const }))
    );
    this.elevators = [];
    this.trails = [];
    this.castleTimer = 0;
    this.beesSpawned = false;
    this.hurtAnimTimer = 0;
    this.cheerTimer = 0;

    const layoutIdx = (lv - 1) % 8;

    if (layoutIdx === 0) {
      // Castle 1: Iconic 1983 Blue Crystal Courtyard with corner towers, center terrace, stairs & elevator!
      this.setRect(0, 0, 11, 11, 0);
      // Decorative front moat cutouts
      this.setRect(0, 9, 1, 11, -1);
      this.setRect(10, 9, 11, 11, -1);
      // Center raised courtyard terrace
      this.setRect(2, 2, 9, 7, 1);
      // Back-left & back-right Level-2 towers
      this.setRect(0, 0, 2, 2, 2);
      this.setRect(9, 0, 11, 2, 2);
      // Central summit balcony
      this.setRect(4, 1, 7, 3, 2);
      // Sculpted stairways!
      this.setStair(5, 8, 0, 'ny');
      this.setStair(6, 8, 0, 'ny');
      this.setStair(1, 5, 0, 'px');
      this.setStair(10, 5, 0, 'nx');
      this.setStair(3, 2, 1, 'nx');
      this.setStair(8, 2, 1, 'px');
      this.setStair(5, 4, 1, 'ny');
      // Crystal Elevator on right wall lifting from ground (0) to tower (2)!
      this.elevators.push({ gx: 10, gy: 3, minH: 0, maxH: 2, curH: 0, speed: 0.9, phase: 0 });
      this.tiles[0][0].trim = 'pillar';
      this.tiles[0][11].trim = 'pillar';
      this.spawnX = 5.5;
      this.spawnY = 10.4;
      this.magicHat = { gx: 5.5, gy: 1.5, active: true };
      this.honeyPot = { gx: 1.5, gy: 1.5, active: true };
      this.warpPad = { gx: 10.5, gy: 1.5, active: true };
    } else if (layoutIdx === 1) {
      // Castle 2: Emerald Pyramid Ziggurat (0 -> 1 -> 2 -> 3 summit!)
      this.setRect(0, 0, 11, 11, 0);
      this.setRect(1, 1, 10, 10, 1);
      this.setRect(3, 3, 8, 8, 2);
      this.setRect(5, 5, 6, 6, 3);
      // 4 symmetrical grand staircases
      this.setStair(5, 11, 0, 'ny');
      this.setStair(6, 0, 0, 'py');
      this.setStair(0, 5, 0, 'px');
      this.setStair(11, 6, 0, 'nx');
      this.setStair(5, 9, 1, 'ny');
      this.setStair(6, 2, 1, 'py');
      this.setStair(2, 5, 1, 'px');
      this.setStair(9, 6, 1, 'nx');
      this.setStair(5, 7, 2, 'ny');
      this.setStair(6, 4, 2, 'py');
      this.tiles[5][5].trim = 'glow';
      this.tiles[6][6].trim = 'glow';
      this.spawnX = 5.5;
      this.spawnY = 11.4;
      this.magicHat = { gx: 5.5, gy: 5.5, active: true };
      this.honeyPot = { gx: 10.5, gy: 1.5, active: true };
      this.warpPad = { gx: 1.5, gy: 1.5, active: false };
    } else if (layoutIdx === 2) {
      // Castle 3: Sunset Sky Bridges over glowing chasm moat + twin elevators
      this.setRect(0, 0, 11, 11, -1);
      // Front landing pad
      this.setRect(3, 8, 8, 11, 0);
      // Left & right mid islands
      this.setRect(0, 3, 3, 7, 1);
      this.setRect(8, 3, 11, 7, 1);
      // Back grand rampart
      this.setRect(1, 0, 10, 2, 2);
      // Connecting sky bridges
      this.setRect(4, 5, 7, 6, 1);
      this.setRect(5, 2, 6, 5, 1);
      this.setStair(5, 7, 0, 'ny');
      this.setStair(6, 7, 0, 'ny');
      this.setStair(2, 3, 1, 'ny');
      this.setStair(9, 3, 1, 'ny');
      this.elevators.push({ gx: 3, gy: 8, minH: 0, maxH: 1, curH: 0, speed: 1.0, phase: 0 });
      this.elevators.push({ gx: 8, gy: 8, minH: 0, maxH: 1, curH: 1, speed: 1.0, phase: Math.PI });
      this.tiles[0][1].trim = 'pillar';
      this.tiles[0][10].trim = 'pillar';
      this.spawnX = 5.5;
      this.spawnY = 10.2;
      this.magicHat = { gx: 1.5, gy: 1.2, active: true };
      this.honeyPot = { gx: 10.2, gy: 5.5, active: true };
      this.warpPad = { gx: 9.5, gy: 1.2, active: true };
    } else if (layoutIdx === 3) {
      // Castle 4: Sapphire Twin Towers linked by elevated aqueduct
      this.setRect(0, 0, 11, 11, 0);
      this.setRect(4, 7, 7, 8, -1);
      this.setRect(0, 0, 3, 4, 2);
      this.setRect(8, 0, 11, 4, 2);
      this.setRect(4, 1, 7, 2, 2); // High sky aqueduct!
      this.setRect(1, 5, 3, 8, 1);
      this.setRect(8, 5, 10, 8, 1);
      this.setStair(2, 9, 0, 'ny');
      this.setStair(9, 9, 0, 'ny');
      this.setStair(2, 5, 1, 'ny');
      this.setStair(9, 5, 1, 'ny');
      this.elevators.push({ gx: 5, gy: 4, minH: 0, maxH: 2, curH: 0, speed: 0.95, phase: 0 });
      this.tiles[0][0].trim = 'pillar';
      this.tiles[0][11].trim = 'pillar';
      this.spawnX = 5.5;
      this.spawnY = 10.4;
      this.magicHat = { gx: 1.5, gy: 1.5, active: true };
      this.honeyPot = { gx: 10.2, gy: 1.5, active: true };
      this.warpPad = { gx: 5.5, gy: 1.5, active: false };
    } else if (layoutIdx === 4) {
      // Castle 5: Amethyst Labyrinth with stepped perimeter gallery & center jewel vault
      this.setRect(0, 0, 11, 11, 0);
      this.setRect(0, 0, 11, 1, 1);
      this.setRect(0, 0, 1, 10, 1);
      this.setRect(10, 0, 11, 10, 1);
      this.setRect(4, 4, 7, 7, 2);
      this.setRect(3, 3, 3, 3, -1);
      this.setRect(8, 3, 8, 3, -1);
      this.setRect(3, 8, 3, 8, -1);
      this.setRect(8, 8, 8, 8, -1);
      this.setStair(2, 5, 0, 'nx');
      this.setStair(9, 5, 0, 'px');
      this.setStair(5, 2, 0, 'ny');
      this.setStair(5, 8, 0, 'ny');
      this.setStair(5, 7, 1, 'ny');
      this.elevators.push({ gx: 6, gy: 8, minH: 0, maxH: 2, curH: 0, speed: 1.05, phase: 0.5 });
      this.spawnX = 5.5;
      this.spawnY = 10.4;
      this.magicHat = { gx: 5.5, gy: 5.5, active: true };
      this.honeyPot = { gx: 0.8, gy: 0.8, active: true };
      this.warpPad = { gx: 10.5, gy: 0.8, active: true };
    } else if (layoutIdx === 5) {
      // Castle 6: Ruby Ramparts — grand stepped fortress walls
      this.setRect(0, 0, 11, 11, 0);
      this.setRect(0, 0, 11, 2, 2);
      this.setRect(1, 3, 10, 5, 1);
      this.setRect(4, 0, 7, 1, 3);
      this.setRect(0, 8, 2, 11, -1);
      this.setRect(9, 8, 11, 11, -1);
      this.setStair(3, 6, 0, 'ny');
      this.setStair(8, 6, 0, 'ny');
      this.setStair(2, 3, 1, 'ny');
      this.setStair(9, 3, 1, 'ny');
      this.setStair(5, 2, 2, 'ny');
      this.elevators.push({ gx: 5, gy: 6, minH: 0, maxH: 2, curH: 0, speed: 1.1, phase: 0 });
      this.tiles[0][4].trim = 'pillar';
      this.tiles[0][7].trim = 'pillar';
      this.spawnX = 5.5;
      this.spawnY = 10.2;
      this.magicHat = { gx: 5.5, gy: 0.7, active: true };
      this.honeyPot = { gx: 1.5, gy: 1.2, active: true };
      this.warpPad = { gx: 10.5, gy: 1.2, active: false };
    } else if (layoutIdx === 6) {
      // Castle 7: Glacial Spire — icy central citadel ringed by moats & crystal bridges
      this.setRect(0, 0, 11, 11, -1);
      this.setRect(0, 0, 11, 1, 1);
      this.setRect(0, 10, 11, 11, 0);
      this.setRect(0, 0, 1, 11, 0);
      this.setRect(10, 0, 11, 11, 0);
      this.setRect(3, 3, 8, 8, 1);
      this.setRect(4, 4, 7, 7, 2);
      this.setRect(5, 5, 6, 6, 3);
      // Bridges across icy moat
      this.setRect(5, 8, 6, 9, 0);
      this.setRect(5, 2, 6, 2, 1);
      this.setRect(2, 5, 2, 6, 0);
      this.setRect(9, 5, 9, 6, 0);
      this.setStair(5, 8, 0, 'ny');
      this.setStair(2, 5, 0, 'px');
      this.setStair(9, 6, 0, 'nx');
      this.setStair(5, 7, 1, 'ny');
      this.setStair(6, 4, 1, 'py');
      this.setStair(5, 6, 2, 'ny');
      this.elevators.push({ gx: 10, gy: 2, minH: 0, maxH: 1, curH: 0, speed: 1.1, phase: 0 });
      this.spawnX = 5.5;
      this.spawnY = 10.6;
      this.magicHat = { gx: 5.5, gy: 5.5, active: true };
      this.honeyPot = { gx: 0.7, gy: 0.7, active: true };
      this.warpPad = { gx: 10.5, gy: 0.7, active: false };
    } else {
      // Castle 8: Berthilda's Obsidian Citadel — tiered gothic throne castle
      this.setRect(0, 0, 11, 11, 0);
      this.setRect(1, 1, 10, 8, 1);
      this.setRect(2, 1, 9, 4, 2);
      this.setRect(4, 0, 7, 2, 3);
      this.setRect(0, 6, 0, 8, -1);
      this.setRect(11, 6, 11, 8, -1);
      this.setStair(5, 9, 0, 'ny');
      this.setStair(6, 9, 0, 'ny');
      this.setStair(3, 5, 1, 'ny');
      this.setStair(8, 5, 1, 'ny');
      this.setStair(5, 3, 2, 'ny');
      this.setStair(6, 3, 2, 'ny');
      this.elevators.push({ gx: 1, gy: 5, minH: 1, maxH: 2, curH: 1, speed: 1.2, phase: 0 });
      this.elevators.push({ gx: 10, gy: 5, minH: 1, maxH: 2, curH: 2, speed: 1.2, phase: Math.PI });
      this.tiles[0][4].trim = 'pillar';
      this.tiles[0][7].trim = 'pillar';
      this.spawnX = 5.5;
      this.spawnY = 10.5;
      this.magicHat = { gx: 5.5, gy: 1.0, active: true };
      this.honeyPot = { gx: 2.5, gy: 2.5, active: true };
      this.warpPad = { gx: 9.5, gy: 2.5, active: false };
    }

    // Place Bentley safely at entrance
    this.bx = this.spawnX;
    this.by = this.spawnY;
    this.curElev = Math.max(0, this.surfaceElevation(this.bx, this.by));
    this.bz = 0;
    this.bvz = 0;
    this.bFacingX = 1;
    this.bFacingY = 1;
    this.invulnTimer = 1.8;
    this.hatTimer = 0;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.gemCombo = 0;

    // Populate sparkling gems across solid walkable tiles (skipping spawn & elevator shafts)
    this.gems = [];
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const t = this.tiles[y][x];
        if (t.h < 0 || t.stair) continue;
        if (Math.hypot(x + 0.5 - this.spawnX, y + 0.5 - this.spawnY) < 1.25) continue;
        if (this.elevators.some((el) => el.gx === x && el.gy === y)) continue;
        // Checker pattern on lower levels, rich gem density on high towers!
        const place = t.h >= 2 ? (x + y) % 2 === 0 || (x % 3 === 0) : (x + y) % 2 === 0;
        if (place) {
          this.gems.push({
            gx: x + 0.5,
            gy: y + 0.5,
            collected: false,
            sparklePhase: (x * 1.15 + y * 0.85) % (Math.PI * 2),
            value: t.h >= 2 ? 150 : 100,
          });
        }
      }
    }

    // Populate authentic Atari enemies on safe solid tiles away from Bentley
    this.enemies = [];
    const baseSpd = 1.08 + Math.min(0.95, (lv - 1) * 0.12);
    const findSafeSpot = (prefX: number, prefY: number): { gx: number; gy: number } => {
      if (this.surfaceElevation(prefX, prefY) >= 0) return { gx: prefX, gy: prefY };
      for (let y = 1; y < GRID - 2; y++) {
        for (let x = 1; x < GRID - 1; x++) {
          if (this.tiles[y][x].h >= 0 && Math.hypot(x + 0.5 - this.spawnX, y + 0.5 - this.spawnY) > 4) {
            return { gx: x + 0.5, gy: y + 0.5 };
          }
        }
      }
      return { gx: 5.5, gy: 2.5 };
    };

    const p1 = findSafeSpot(2.5, 4.5);
    this.enemies.push({ kind: 'gem_eater', gx: p1.gx, gy: p1.gy, vx: baseSpd, vy: 0, eatingTimer: 0, stunTimer: 0, phase: 0, facing: 1 });
    const p2 = findSafeSpot(8.5, 3.5);
    this.enemies.push({ kind: 'tree', gx: p2.gx, gy: p2.gy, vx: 0, vy: baseSpd * 0.85, eatingTimer: 0, stunTimer: 0, phase: 1.2, facing: -1 });
    const p3 = findSafeSpot(5.5, 4.5);
    this.enemies.push({ kind: 'crystal_ball', gx: p3.gx, gy: p3.gy, vx: -baseSpd * 1.05, vy: baseSpd * 0.65, eatingTimer: 0, stunTimer: 0, phase: 2.1, facing: -1 });
    if (lv >= 2) {
      const p4 = findSafeSpot(2.5, 6.5);
      this.enemies.push({ kind: 'skeleton', gx: p4.gx, gy: p4.gy, vx: baseSpd * 1.08, vy: 0, eatingTimer: 0, stunTimer: 0, phase: 0.7, facing: 1 });
    }
    if (lv >= 4) {
      const p5 = findSafeSpot(9.5, 6.5);
      this.enemies.push({ kind: 'gem_eater', gx: p5.gx, gy: p5.gy, vx: -baseSpd, vy: 0, eatingTimer: 0, stunTimer: 0, phase: 1.9, facing: -1 });
    }
    // Berthilda the Witch patrols overhead!
    this.enemies.push({ kind: 'witch', gx: 9.5, gy: 1.5, vx: -baseSpd * 1.1, vy: baseSpd * 0.75, eatingTimer: 0, stunTimer: 0, phase: 3.1, facing: -1 });
  }

  private damageBentley(): void {
    if (this.invulnTimer > 0 || this.hatTimer > 0 || this.hurtAnimTimer > 0) return;
    this.lives--;
    const p = this.iso(this.bx, this.by, Math.max(0, this.curElev) + 0.6);
    spawnBurst(this.particles, p.x, p.y, '#F472B6', 24, 200, 3.5);
    this.popups.push({ x: p.x, y: p.y - 26, text: 'BYE!', color: '#FEF08A', life: 1.05, maxLife: 1.05 });
    arcadeAudio.playDeath();
    if (this.lives <= 0) {
      this.phase = 'GAME_OVER';
    } else {
      this.hurtAnimTimer = 0.65;
      this.invulnTimer = 2.4;
      this.bx = this.spawnX;
      this.by = this.spawnY;
      this.curElev = Math.max(0, this.surfaceElevation(this.bx, this.by));
      this.bz = 0;
      this.bvz = 0;
      this.dashTimer = 0;
    }
  }

  public step(dt: number): void {
    const safeDt = Math.min(0.05, Math.max(0, dt));
    this.clock += safeDt;
    stepParticlesAndPopups(this.particles, this.popups, safeDt);

    // Update golden dash trail ghosts
    for (let i = this.trails.length - 1; i >= 0; i--) {
      this.trails[i].life -= safeDt * 3.4;
      if (this.trails[i].life <= 0) this.trails.splice(i, 1);
    }

    if (this.phase === 'PAUSED' || this.phase === 'GAME_OVER') return;

    // Animate elevators even during Ready / Title
    for (const el of this.elevators) {
      el.phase += safeDt * el.speed;
      const t = 0.5 - 0.5 * Math.cos(el.phase);
      // Slight dwell pause at bottom and top so Bentley can step on/off comfortably!
      const eased = t < 0.14 ? 0 : t > 0.86 ? 1 : (t - 0.14) / 0.72;
      el.curH = el.minH + (el.maxH - el.minH) * eased;
    }

    if (this.phase === 'READY') {
      this.stateTimer -= safeDt;
      if (this.stateTimer <= 0) this.phase = 'PLAYING';
      return;
    }
    if (this.phase === 'STAGE_CLEAR') {
      this.cheerTimer += safeDt;
      this.bz = Math.abs(Math.sin(this.cheerTimer * 9)) * 0.55;
      this.stateTimer -= safeDt;
      if (this.stateTimer <= 0) {
        this.phase = 'READY';
        this.stateTimer = 0.8;
        this.setupCastle(this.level + 1);
      }
      return;
    }

    const attract = this.phase === 'TITLE';
    if (!attract) this.castleTimer += safeDt;
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - safeDt);
    if (this.hatTimer > 0) this.hatTimer = Math.max(0, this.hatTimer - safeDt);
    if (this.dashCooldown > 0) this.dashCooldown = Math.max(0, this.dashCooldown - safeDt);
    if (this.hurtAnimTimer > 0) this.hurtAnimTimer = Math.max(0, this.hurtAnimTimer - safeDt);
    this.squash += (1 - this.squash) * Math.min(1, safeDt * 12);

    if (this.gemComboTimer > 0) {
      this.gemComboTimer = Math.max(0, this.gemComboTimer - safeDt);
      if (this.gemComboTimer <= 0) this.gemCombo = 0;
    }

    // Spawn Atari Swarm of Bees if player lingers > 55s in one castle
    if (!attract && !this.beesSpawned && this.castleTimer > 55) {
      this.beesSpawned = true;
      this.enemies.push({
        kind: 'bee_swarm',
        gx: 0.6,
        gy: 0.6,
        vx: 1.5,
        vy: 1.5,
        eatingTimer: 0,
        stunTimer: 0,
        phase: 0,
        facing: 1,
      });
      const p = this.iso(this.bx, this.by, this.curElev + 1.4);
      this.popups.push({ x: p.x, y: p.y, text: 'BEE SWARM!', color: '#FACC15', life: 1.4, maxLife: 1.4 });
    }

    // Precision isometric steering (Keyboard / Stick / Accelerometer Tilt / Pointer)
    const { vx: rawVx, vy: rawVy, scale } = getPrecisionMoveVector(this.input);
    const baseSpeed = (this.hatTimer > 0 ? 4.45 : 3.55) * scale;
    let dgx = 0;
    let dgy = 0;

    if (attract) {
      const target = this.gems.find((g) => !g.collected);
      if (target) {
        const dx = target.gx - this.bx;
        const dy = target.gy - this.by;
        const d = Math.hypot(dx, dy) || 1;
        dgx = (dx / d) * 2.55;
        dgy = (dy / d) * 2.55;
      }
    } else if (this.input.pointerActive && !this.input.tiltActive) {
      const target = this.screenToGrid(this.input.pointerX * W, this.input.pointerY * H, this.curElev);
      const dx = target.gx - this.bx;
      const dy = target.gy - this.by;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.14) {
        const stepSpd = Math.min(baseSpeed, dist * 5.2 * scale);
        dgx = (dx / dist) * stepSpd;
        dgy = (dy / dist) * stepSpd;
      }
    } else if (Math.hypot(rawVx, rawVy) > 0.04) {
      // Natural screen-aligned 45° isometric projection
      const isoDx = (rawVx + rawVy) * 0.78;
      const isoDy = (rawVy - rawVx) * 0.78;
      const mag = Math.hypot(isoDx, isoDy) || 1;
      const eff = Math.min(1, Math.hypot(rawVx, rawVy));
      dgx = (isoDx / mag) * baseSpeed * eff;
      dgy = (isoDy / mag) * baseSpeed * eff;
    }

    // Secondary action: Bear Dash / Golden Magic Hat Dash!
    if (!attract && this.input.secondaryJustPressed && this.dashCooldown <= 0) {
      const m = Math.hypot(dgx, dgy);
      if (m > 0.1) {
        this.dashDx = dgx / m;
        this.dashDy = dgy / m;
      } else {
        this.dashDx = this.bFacingX * 0.7;
        this.dashDy = this.bFacingY * 0.7;
      }
      this.dashTimer = this.hatTimer > 0 ? 0.28 : 0.19;
      this.dashCooldown = this.hatTimer > 0 ? 0.55 : 0.95;
      this.squash = 1.25;
      arcadeAudio.playJump();
    }

    if (this.dashTimer > 0) {
      this.dashTimer -= safeDt;
      const dashSpd = this.hatTimer > 0 ? 8.2 : 6.4;
      dgx = this.dashDx * dashSpd;
      dgy = this.dashDy * dashSpd;
      if (Math.random() < 0.75) {
        this.trails.push({
          gx: this.bx,
          gy: this.by,
          elev: this.curElev + this.bz * 1.15,
          life: 1,
          color: this.hatTimer > 0 ? '#FACC15' : '#67E8F9',
        });
      }
    }

    if (Math.hypot(dgx, dgy) > 0.12) {
      this.walkAnim += safeDt * (this.hatTimer > 0 ? 16 : 13);
      // Screen-space horizontal facing & front/back facing!
      const screenDx = dgx - dgy;
      const screenDy = dgx + dgy;
      if (Math.abs(screenDx) > 0.08) this.bFacingX = screenDx >= 0 ? 1 : -1;
      this.bFacingY = screenDy >= -0.15 ? 1 : -1;
    }

    // Jump physics with squash & stretch!
    const jumpPressed = attract ? Math.sin(this.clock * 2.5) > 0.96 : this.input.fireJustPressed;
    if (jumpPressed && this.bz <= 0.02) {
      this.bvz = 6.1;
      this.squash = 1.28;
      if (!attract) arcadeAudio.playJump();
    }
    const wasAir = this.bz > 0.02;
    if (this.bz > 0 || this.bvz > 0) {
      this.bz += this.bvz * safeDt;
      this.bvz -= 17.5 * safeDt;
      if (this.bz <= 0) {
        this.bz = 0;
        this.bvz = 0;
        if (wasAir) {
          this.squash = 0.76;
          const lp = this.iso(this.bx, this.by, Math.max(0, this.curElev));
          spawnBurst(this.particles, lp.x, lp.y, '#E2E8F0', 5, 65, 1.8);
        }
      }
    }

    // Apply movement with smart elevation & chasm protection
    const curSurf = this.surfaceElevation(this.bx, this.by);
    const curH = curSurf >= 0 ? curSurf : this.curElev;
    const tryMove = (tx: number, ty: number): boolean => {
      if (tx < 0.25 || tx > GRID - 0.25 || ty < 0.25 || ty > GRID - 0.25) return false;
      const nh = this.surfaceElevation(tx, ty);
      // Allow vaulting over narrow void moats only while airborne!
      if (nh < 0) return this.bz > 0.3;
      // Smooth stair climb OR stepping up <= 0.65 OR jumping up <= 1.25 tiers!
      const climbable = nh - curH <= 0.65 || (this.bz >= 0.35 && nh - curH <= 1.35);
      return climbable;
    };

    const nx = this.bx + dgx * safeDt;
    const ny = this.by + dgy * safeDt;
    if (tryMove(nx, ny)) {
      this.bx = nx;
      this.by = ny;
    } else if (tryMove(nx, this.by)) {
      this.bx = nx;
    } else if (tryMove(this.bx, ny)) {
      this.by = ny;
    }

    // Update smooth ground elevation (and recover safely if landing in moat)
    const landedSurf = this.surfaceElevation(this.bx, this.by);
    if (landedSurf >= 0) {
      this.curElev += (landedSurf - this.curElev) * Math.min(1, safeDt * 18);
    } else if (this.bz <= 0.02) {
      // Fell into moat chasm!
      if (!attract) {
        this.damageBentley();
        if (this.phase !== 'PLAYING') return;
      } else {
        this.bx = this.spawnX;
        this.by = this.spawnY;
        this.curElev = Math.max(0, this.surfaceElevation(this.bx, this.by));
      }
    }

    // Collect sparkling crystal gems!
    let remaining = 0;
    for (const gem of this.gems) {
      if (gem.collected) continue;
      remaining++;
      gem.sparklePhase += safeDt * 4.8;
      const gemH = Math.max(0, this.surfaceElevation(gem.gx, gem.gy));
      if (
        Math.hypot(gem.gx - this.bx, gem.gy - this.by) < 0.58 &&
        Math.abs(gemH - this.curElev) < 0.75 &&
        this.bz < 0.9
      ) {
        gem.collected = true;
        remaining--;
        this.gemCombo++;
        this.gemComboTimer = 1.8;
        const p = this.iso(gem.gx, gem.gy, gemH + 0.35);
        spawnBurst(this.particles, p.x, p.y, this.getTheme().gemColor, 9, 130, 2.5);
        if (!attract) {
          arcadeAudio.playGemChime(this.gemCombo);
          const pts = remaining === 0 ? 1000 : gem.value;
          this.addScore(
            pts,
            gem.gx,
            gem.gy,
            remaining === 0 ? '#FDE047' : this.getTheme().gemColor,
            remaining === 0 ? 'LAST GEM +1000!' : `+${pts}`
          );
        }
      }
    }

    // Collect Magic Hat
    if (
      this.magicHat.active &&
      Math.hypot(this.magicHat.gx - this.bx, this.magicHat.gy - this.by) < 0.62 &&
      Math.abs(Math.max(0, this.surfaceElevation(this.magicHat.gx, this.magicHat.gy)) - this.curElev) < 0.85
    ) {
      this.magicHat.active = false;
      this.hatTimer = 9.0;
      const p = this.iso(this.magicHat.gx, this.magicHat.gy, this.curElev + 0.5);
      spawnBurst(this.particles, p.x, p.y, '#FACC15', 22, 195, 3.2);
      if (!attract) {
        arcadeAudio.playMagicHat();
        this.addScore(500, this.magicHat.gx, this.magicHat.gy, '#FACC15', 'MAGIC HAT!');
      }
    }

    // Collect Honey Pot
    if (
      this.honeyPot.active &&
      Math.hypot(this.honeyPot.gx - this.bx, this.honeyPot.gy - this.by) < 0.62 &&
      Math.abs(Math.max(0, this.surfaceElevation(this.honeyPot.gx, this.honeyPot.gy)) - this.curElev) < 0.85
    ) {
      this.honeyPot.active = false;
      const p = this.iso(this.honeyPot.gx, this.honeyPot.gy, this.curElev + 0.5);
      spawnBurst(this.particles, p.x, p.y, '#FB923C', 18, 170, 3.0);
      if (!attract) {
        arcadeAudio.playPowerUp();
        this.addScore(1500, this.honeyPot.gx, this.honeyPot.gy, '#FDE047', 'HONEY POT +1500!');
      }
    }

    // Secret Warp Pad (jump onto the glowing cyan rune to warp ahead!)
    if (
      !attract &&
      this.warpPad.active &&
      this.bz > 0.25 &&
      Math.hypot(this.warpPad.gx - this.bx, this.warpPad.gy - this.by) < 0.58
    ) {
      this.warpPad.active = false;
      arcadeAudio.playMagicHat();
      this.addScore(3000, this.warpPad.gx, this.warpPad.gy, '#38BDF8', 'SECRET WARP +3000!');
      this.phase = 'STAGE_CLEAR';
      this.stateTimer = 1.5;
      this.cheerTimer = 0;
      return;
    }

    // Step Enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const en = this.enemies[i];
      if (!en) continue;
      en.phase += safeDt * 5.4;
      if (en.stunTimer > 0) {
        en.stunTimer -= safeDt;
        continue;
      }

      const prevX = en.gx;
      const prevY = en.gy;

      if (en.kind === 'gem_eater') {
        if (en.eatingTimer > 0) {
          en.eatingTimer -= safeDt;
        } else {
          let best: CastleGem | null = null;
          let bestD = 999;
          for (const g of this.gems) {
            if (g.collected) continue;
            const d = Math.hypot(g.gx - en.gx, g.gy - en.gy);
            if (d < bestD) {
              bestD = d;
              best = g;
            }
          }
          if (best && bestD > 0.08) {
            const spd = 1.0 + this.level * 0.07;
            const mx = ((best.gx - en.gx) / bestD) * spd * safeDt;
            const my = ((best.gy - en.gy) / bestD) * spd * safeDt;
            if (this.surfaceElevation(en.gx + mx, en.gy + my) >= 0) {
              en.gx += mx;
              en.gy += my;
            } else {
              en.gx += mx * 0.5;
              en.gy += my * 0.5;
            }
            if (bestD < 0.34) {
              best.collected = true;
              en.eatingTimer = 1.75; // Vulnerable while chomping!
            }
          }
        }
      } else if (en.kind === 'witch' || en.kind === 'bee_swarm') {
        const dx = this.bx - en.gx;
        const dy = this.by - en.gy;
        const d = Math.hypot(dx, dy) || 1;
        const spd = en.kind === 'bee_swarm' ? 1.85 : 1.15 + Math.min(0.85, this.level * 0.09);
        en.gx += (dx / d) * spd * safeDt;
        en.gy += (dy / d) * spd * safeDt;
      } else {
        const nxE = en.gx + en.vx * safeDt;
        const nyE = en.gy + en.vy * safeDt;
        const solidNext = this.surfaceElevation(nxE, nyE) >= 0;
        if (!solidNext || nxE < 0.45 || nxE > GRID - 0.45) {
          en.vx = -en.vx;
        } else {
          en.gx = nxE;
        }
        if (!solidNext || nyE < 0.45 || nyE > GRID - 0.45) {
          en.vy = -en.vy;
        } else {
          en.gy = nyE;
        }
      }

      const sdx = en.gx - prevX - (en.gy - prevY);
      if (Math.abs(sdx) > 0.002) en.facing = sdx >= 0 ? 1 : -1;

      // Enemy-Bentley collision
      const dist = Math.hypot(en.gx - this.bx, en.gy - this.by);
      const enH =
        en.kind === 'witch' || en.kind === 'bee_swarm'
          ? Math.max(this.curElev, Math.max(0, this.surfaceElevation(en.gx, en.gy)))
          : Math.max(0, this.surfaceElevation(en.gx, en.gy));
      const sameTier = en.kind === 'witch' || en.kind === 'bee_swarm' || Math.abs(enH - this.curElev) < 0.85;

      if (!attract && sameTier && dist < 0.56) {
        if (this.hatTimer > 0) {
          const bonus = en.kind === 'witch' ? 3000 : 900;
          const p = this.iso(en.gx, en.gy, enH + 0.5);
          spawnBurst(this.particles, p.x, p.y, '#FACC15', 24, 215, 3.6);
          arcadeAudio.playExplosion(en.kind === 'witch');
          this.addScore(
            bonus,
            en.gx,
            en.gy,
            '#FACC15',
            en.kind === 'witch' ? 'BERTHILDA DEFEATED +3000!' : `KNOCKOUT +${bonus}`
          );
          this.enemies.splice(i, 1);
        } else if (en.kind === 'gem_eater' && en.eatingTimer > 0) {
          const p = this.iso(en.gx, en.gy, enH + 0.4);
          spawnBurst(this.particles, p.x, p.y, '#4ADE80', 18, 180, 3.0);
          arcadeAudio.playPowerUp();
          this.addScore(1000, en.gx, en.gy, '#4ADE80', 'GEM EATER +1000!');
          this.enemies.splice(i, 1);
        } else if (this.bz < 0.55) {
          this.damageBentley();
          if (this.phase !== 'PLAYING') break;
        }
      }
    }

    // Castle Clear!
    if (!attract && remaining <= 0) {
      arcadeAudio.playStageClear();
      this.addScore(2000 + this.level * 500, this.bx, this.by, '#67E8F9', `CASTLE ${this.level} CLEAR!`);
      this.phase = 'STAGE_CLEAR';
      this.stateTimer = 2.0;
      this.cheerTimer = 0;
    }
  }

  public getHudSnapshot(): ClassicGameHud {
    const left = this.gems.filter((g) => !g.collected).length;
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: `CASTLE ${this.level} · ${this.getTheme().name}`,
      primaryMetricLabel: 'GEMS LEFT',
      primaryMetricValue: `${left}`,
      secondaryMetricLabel: 'MAGIC HAT',
      secondaryMetricValue:
        this.hatTimer > 0 ? `${Math.ceil(this.hatTimer)}s` : this.magicHat.active ? 'READY' : 'USED',
      bannerText: this.phase === 'STAGE_CLEAR' ? `CASTLE ${this.level} CONQUERED!` : '',
    };
  }

  private drawIsoBlock(
    ctx: CanvasRenderingContext2D,
    gx: number,
    gy: number,
    tile: CastleTile,
    theme: CastleTheme
  ): void {
    if (tile.h < 0) return;

    const h = tile.h;
    const baseDepth = 20 + h * ELEV_H;
    const p = this.iso(gx + 0.5, gy + 0.5, h);

    // Subtle glowing moat reflection underneath lowest blocks
    if (h === 0) {
      ctx.fillStyle = theme.moatColor;
      ctx.beginPath();
      ctx.moveTo(p.x - TILE_W, p.y + baseDepth);
      ctx.lineTo(p.x, p.y + TILE_H + baseDepth);
      ctx.lineTo(p.x + TILE_W, p.y + baseDepth);
      ctx.lineTo(p.x, p.y + TILE_H + baseDepth + 6);
      ctx.closePath();
      ctx.fill();
    }

    // Left 3D crystalline wall face with vertical bevel shading
    const leftG = ctx.createLinearGradient(p.x - TILE_W, p.y, p.x - TILE_W, p.y + baseDepth + TILE_H);
    leftG.addColorStop(0, theme.tileLeft);
    leftG.addColorStop(1, '#090D1F');
    ctx.fillStyle = leftG;
    ctx.beginPath();
    ctx.moveTo(p.x - TILE_W, p.y);
    ctx.lineTo(p.x, p.y + TILE_H);
    ctx.lineTo(p.x, p.y + TILE_H + baseDepth);
    ctx.lineTo(p.x - TILE_W, p.y + baseDepth);
    ctx.closePath();
    ctx.fill();

    // Right 3D shaded wall face
    const rightG = ctx.createLinearGradient(p.x + TILE_W, p.y, p.x + TILE_W, p.y + baseDepth + TILE_H);
    rightG.addColorStop(0, theme.tileRight);
    rightG.addColorStop(1, '#050814');
    ctx.fillStyle = rightG;
    ctx.beginPath();
    ctx.moveTo(p.x + TILE_W, p.y);
    ctx.lineTo(p.x, p.y + TILE_H);
    ctx.lineTo(p.x, p.y + TILE_H + baseDepth);
    ctx.lineTo(p.x + TILE_W, p.y + baseDepth);
    ctx.closePath();
    ctx.fill();

    // Subtle stone masonry seam lines on tall walls
    if (h >= 1) {
      ctx.strokeStyle = 'rgba(255,255,255,0.11)';
      ctx.lineWidth = 1;
      for (let tier = 1; tier <= h; tier++) {
        const ty = tier * ELEV_H;
        ctx.beginPath();
        ctx.moveTo(p.x - TILE_W, p.y + ty);
        ctx.lineTo(p.x, p.y + TILE_H + ty);
        ctx.lineTo(p.x + TILE_W, p.y + ty);
        ctx.stroke();
      }
    }

    // Top faceted diamond face (brighter on higher castle tiers for crystal depth!)
    const isLight = (gx + gy) % 2 === 0;
    const topG = ctx.createLinearGradient(p.x, p.y - TILE_H, p.x, p.y + TILE_H);
    if (tile.trim === 'glow') {
      topG.addColorStop(0, '#FEF08A');
      topG.addColorStop(1, theme.tileTopA);
    } else if (h >= 2) {
      topG.addColorStop(0, isLight ? theme.tileHi : theme.tileTopA);
      topG.addColorStop(1, isLight ? theme.tileTopA : theme.tileTopB);
    } else {
      topG.addColorStop(0, isLight ? theme.tileTopA : theme.tileTopB);
      topG.addColorStop(1, theme.tileLeft);
    }
    ctx.fillStyle = topG;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - TILE_H);
    ctx.lineTo(p.x + TILE_W, p.y);
    ctx.lineTo(p.x, p.y + TILE_H);
    ctx.lineTo(p.x - TILE_W, p.y);
    ctx.closePath();
    ctx.fill();

    // Crisp crystal edge highlight along top ridges
    ctx.strokeStyle = h >= 2 ? 'rgba(255,255,255,0.34)' : 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Sculpted 3D Staircase steps!
    if (tile.stair) {
      this.drawStairSteps(ctx, gx, gy, h, tile.stair, theme);
    }

    // Decorative corner crystal battlement turret on key spires
    if (tile.trim === 'pillar') {
      ctx.save();
      ctx.fillStyle = theme.tileHi;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 34);
      ctx.lineTo(p.x + 8, p.y - 10);
      ctx.lineTo(p.x, p.y - 5);
      ctx.lineTo(p.x - 8, p.y - 10);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 34);
      ctx.lineTo(p.x + 3, p.y - 12);
      ctx.lineTo(p.x, p.y - 8);
      ctx.lineTo(p.x - 3, p.y - 12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  private drawStairSteps(
    ctx: CanvasRenderingContext2D,
    gx: number,
    gy: number,
    baseH: number,
    dir: StairDir,
    theme: CastleTheme
  ): void {
    const steps = 4;
    for (let s = 0; s < steps; s++) {
      const f0 = s / steps;
      const f1 = (s + 1) / steps;
      const sh = baseH + f1;

      let c0: { x: number; y: number };
      let c1: { x: number; y: number };
      let c2: { x: number; y: number };
      let c3: { x: number; y: number };

      if (dir === 'ny') {
        const yA = gy + (1 - f0);
        const yB = gy + (1 - f1);
        c0 = this.iso(gx + 0.08, yB, sh);
        c1 = this.iso(gx + 0.92, yB, sh);
        c2 = this.iso(gx + 0.92, yA, sh);
        c3 = this.iso(gx + 0.08, yA, sh);
      } else if (dir === 'py') {
        const yA = gy + f0;
        const yB = gy + f1;
        c0 = this.iso(gx + 0.08, yA, sh);
        c1 = this.iso(gx + 0.92, yA, sh);
        c2 = this.iso(gx + 0.92, yB, sh);
        c3 = this.iso(gx + 0.08, yB, sh);
      } else if (dir === 'nx') {
        const xA = gx + (1 - f0);
        const xB = gx + (1 - f1);
        c0 = this.iso(xB, gy + 0.08, sh);
        c1 = this.iso(xA, gy + 0.08, sh);
        c2 = this.iso(xA, gy + 0.92, sh);
        c3 = this.iso(xB, gy + 0.92, sh);
      } else {
        const xA = gx + f0;
        const xB = gx + f1;
        c0 = this.iso(xA, gy + 0.08, sh);
        c1 = this.iso(xB, gy + 0.08, sh);
        c2 = this.iso(xB, gy + 0.92, sh);
        c3 = this.iso(xA, gy + 0.92, sh);
      }

      const riser = ELEV_H / steps + 1.5;
      // Front riser face
      ctx.fillStyle = theme.stairSide;
      ctx.beginPath();
      ctx.moveTo(c3.x, c3.y);
      ctx.lineTo(c2.x, c2.y);
      ctx.lineTo(c2.x, c2.y + riser);
      ctx.lineTo(c3.x, c3.y + riser);
      ctx.closePath();
      ctx.fill();

      // Tread top face
      ctx.fillStyle = s % 2 === 0 ? theme.stairTop : theme.tileHi;
      ctx.beginPath();
      ctx.moveTo(c0.x, c0.y);
      ctx.lineTo(c1.x, c1.y);
      ctx.lineTo(c2.x, c2.y);
      ctx.lineTo(c3.x, c3.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }

  private drawElevator(ctx: CanvasRenderingContext2D, el: CastleElevator): void {
    const p = this.iso(el.gx + 0.5, el.gy + 0.5, el.curH);
    const bot = this.iso(el.gx + 0.5, el.gy + 0.5, el.minH);

    // Glowing lift beam track
    ctx.strokeStyle = 'rgba(103, 232, 249, 0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bot.x, bot.y + 4);
    ctx.lineTo(p.x, p.y + 6);
    ctx.stroke();

    // Side skirt of moving platform
    ctx.fillStyle = '#0284C7';
    ctx.beginPath();
    ctx.moveTo(p.x - TILE_W * 0.85, p.y);
    ctx.lineTo(p.x, p.y + TILE_H * 0.85);
    ctx.lineTo(p.x, p.y + TILE_H * 0.85 + 7);
    ctx.lineTo(p.x - TILE_W * 0.85, p.y + 7);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#0369A1';
    ctx.beginPath();
    ctx.moveTo(p.x + TILE_W * 0.85, p.y);
    ctx.lineTo(p.x, p.y + TILE_H * 0.85);
    ctx.lineTo(p.x, p.y + TILE_H * 0.85 + 7);
    ctx.lineTo(p.x + TILE_W * 0.85, p.y + 7);
    ctx.closePath();
    ctx.fill();

    // Golden-trimmed crystal lift top
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - TILE_H * 0.85);
    ctx.lineTo(p.x + TILE_W * 0.85, p.y);
    ctx.lineTo(p.x, p.y + TILE_H * 0.85);
    ctx.lineTo(p.x - TILE_W * 0.85, p.y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#38BDF8';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - TILE_H * 0.55);
    ctx.lineTo(p.x + TILE_W * 0.55, p.y);
    ctx.lineTo(p.x, p.y + TILE_H * 0.55);
    ctx.lineTo(p.x - TILE_W * 0.55, p.y);
    ctx.closePath();
    ctx.fill();
  }

  private drawBentleyBear(ctx: CanvasRenderingContext2D): void {
    const blink = this.invulnTimer > 0 && Math.floor(this.clock * 18) % 2 === 0;
    if (blink) return;

    const shadowP = this.iso(this.bx, this.by, Math.max(0, this.curElev));
    const p = this.iso(this.bx, this.by, Math.max(0, this.curElev) + this.bz * 1.15);

    // Precise footing ring + grounded drop shadow so Bentley's exact tile position is crystal clear!
    const shScale = Math.max(0.55, 1 - this.bz * 0.28);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.44)';
    ctx.beginPath();
    ctx.ellipse(shadowP.x, shadowP.y + 2, 12.5 * shScale, 6.2 * shScale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = this.hatTimer > 0 ? 'rgba(250, 204, 21, 0.72)' : 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.ellipse(shadowP.x, shadowP.y + 2, 14 * shScale, 7 * shScale, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Golden Magic Hat Halo Aura!
    if (this.hatTimer > 0) {
      const pulse = 0.65 + 0.35 * Math.sin(this.clock * 16);
      ctx.save();
      const aura = ctx.createRadialGradient(p.x, p.y - 16, 4, p.x, p.y - 16, 26);
      aura.addColorStop(0, `rgba(254, 240, 138, ${0.42 * pulse})`);
      aura.addColorStop(0.6, `rgba(192, 132, 252, ${0.22 * pulse})`);
      aura.addColorStop(1, 'rgba(250, 204, 21, 0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 16, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const isAir = this.bz > 0.05;
    const stride = isAir ? 0 : Math.sin(this.walkAnim);
    const stepBob = isAir ? 0 : Math.abs(stride) * 2.8;
    const lean = this.dashTimer > 0 ? this.bFacingX * 0.22 : stride * 0.05;
    const isCheering = this.phase === 'STAGE_CLEAR';

    ctx.save();
    ctx.translate(p.x, p.y - stepBob);
    ctx.rotate(lean);
    ctx.scale(1 / Math.sqrt(this.squash), this.squash);

    const furDark = this.hatTimer > 0 ? '#B45309' : '#78350F';
    const furMain = this.hatTimer > 0 ? '#F59E0B' : '#B45309';
    const furLight = this.hatTimer > 0 ? '#FDE047' : '#D97706';
    const cream = '#FEF3C7';
    const f = this.bFacingX;

    // 1. Animated Stubby Feet / Paws
    const leftLegY = isAir ? -3 : -2 + Math.max(0, stride) * 3.2;
    const rightLegY = isAir ? -3 : -2 + Math.max(0, -stride) * 3.2;
    ctx.fillStyle = furDark;
    ctx.beginPath();
    ctx.ellipse(-5.2, leftLegY, 4.3, 3.2, 0, 0, Math.PI * 2);
    ctx.ellipse(5.2, rightLegY, 4.3, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Cute paw pads when facing forward
    if (this.bFacingY > 0) {
      ctx.fillStyle = '#FCD34D';
      ctx.beginPath();
      ctx.ellipse(-5.2, leftLegY + 0.6, 2.2, 1.5, 0, 0, Math.PI * 2);
      ctx.ellipse(5.2, rightLegY + 0.6, 2.2, 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Back Arm (drawn behind torso)
    const armSwing = isCheering ? -9 : isAir ? -6 : stride * 4.5;
    ctx.fillStyle = furDark;
    ctx.beginPath();
    ctx.ellipse(-f * 9.5, -13 - armSwing * 0.45, 3.6, 5.2, -f * (isCheering ? 0.8 : 0.3), 0, Math.PI * 2);
    ctx.fill();

    // 3. Plump Shaded Teddy-Bear Torso
    const bodyG = ctx.createRadialGradient(-3 * f, -15, 2, 0, -12, 13);
    bodyG.addColorStop(0, furLight);
    bodyG.addColorStop(0.55, furMain);
    bodyG.addColorStop(1, furDark);
    ctx.fillStyle = bodyG;
    ctx.beginPath();
    ctx.ellipse(0, -12.5, 10.5, 11.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Warm Cream Belly Patch (or fluffy tail when walking away!)
    if (this.bFacingY > 0) {
      ctx.fillStyle = cream;
      ctx.beginPath();
      ctx.ellipse(f * 1.4, -11.5, 6.2, 7.2, 0, 0, Math.PI * 2);
      ctx.fill();
      // Iconic Bentley Bear crimson bowtie / scarf accent!
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.moveTo(f * 1.5, -18.5);
      ctx.lineTo(f * 1.5 - 4.2, -20.5);
      ctx.lineTo(f * 1.5 - 4.2, -16.5);
      ctx.closePath();
      ctx.moveTo(f * 1.5, -18.5);
      ctx.lineTo(f * 1.5 + 4.2, -20.5);
      ctx.lineTo(f * 1.5 + 4.2, -16.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(f * 1.5, -18.5, 1.6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Fluffy round bear tail on back!
      ctx.fillStyle = furLight;
      ctx.beginPath();
      ctx.arc(0, -8.5, 4.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Front Swinging Arm
    ctx.fillStyle = furMain;
    ctx.beginPath();
    ctx.ellipse(f * 9.8, -13 + (isCheering ? -6 : armSwing * 0.45), 3.7, 5.2, f * (isCheering ? 0.9 : 0.35), 0, Math.PI * 2);
    ctx.fill();

    // 5. Expressive Round Bear Head + Fluffy Inner Ears!
    const earBob = isAir ? -1.5 : Math.abs(stride) * 0.8;
    // Outer Ears
    ctx.fillStyle = furMain;
    ctx.beginPath();
    ctx.arc(-7.2, -30.5 + earBob, 4.4, 0, Math.PI * 2);
    ctx.arc(7.2, -30.5 + earBob, 4.4, 0, Math.PI * 2);
    ctx.fill();
    // Inner Pink/Cream Ears
    ctx.fillStyle = '#FDE68A';
    ctx.beginPath();
    ctx.arc(-7.2, -30.5 + earBob, 2.3, 0, Math.PI * 2);
    ctx.arc(7.2, -30.5 + earBob, 2.3, 0, Math.PI * 2);
    ctx.fill();

    // Head Sphere
    const headG = ctx.createRadialGradient(-2.5 * f, -28.5, 1.5, 0, -25.5, 10.5);
    headG.addColorStop(0, furLight);
    headG.addColorStop(0.6, furMain);
    headG.addColorStop(1, furDark);
    ctx.fillStyle = headG;
    ctx.beginPath();
    ctx.ellipse(0, -25.5, 9.2, 8.2, 0, 0, Math.PI * 2);
    ctx.fill();

    if (this.bFacingY > 0) {
      // Snout Muzzle
      ctx.fillStyle = cream;
      ctx.beginPath();
      ctx.ellipse(f * 2.4, -23.2, 4.6, 3.3, 0, 0, Math.PI * 2);
      ctx.fill();
      // Glossy Button Nose
      ctx.fillStyle = '#1E1B4B';
      ctx.beginPath();
      ctx.ellipse(f * 3.1, -24.4, 2.1, 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Cute Smile
      ctx.strokeStyle = '#78350F';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(f * 2.4, -22.8, 2.1, 0.15, Math.PI - 0.15);
      ctx.stroke();

      // Rosy Cheeks
      ctx.fillStyle = 'rgba(244, 114, 182, 0.45)';
      ctx.beginPath();
      ctx.ellipse(f * 2.4 - 5.2, -23.2, 1.9, 1.2, 0, 0, Math.PI * 2);
      ctx.ellipse(f * 2.4 + 4.4, -23.2, 1.9, 1.2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Big Glossy Expressive Eyes with White Catchlights!
      const ex1 = f * 2.0 - 3.0;
      const ex2 = f * 2.0 + 3.0;
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.ellipse(ex1, -27.2, 1.75, 2.2, 0, 0, Math.PI * 2);
      ctx.ellipse(ex2, -27.2, 1.75, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(ex1 - 0.5, -28.0, 0.75, 0, Math.PI * 2);
      ctx.arc(ex2 - 0.5, -28.0, 0.75, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6. Starry Enchanted Wizard Magic Hat on Bentley's Head when active!
    if (this.hatTimer > 0) {
      ctx.save();
      ctx.translate(0, -32.5);
      ctx.rotate(-f * 0.12);
      // Golden brim
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.ellipse(0, 1, 11.5, 3.6, 0, 0, Math.PI * 2);
      ctx.fill();
      // Violet cone
      const hatG = ctx.createLinearGradient(0, -17, 0, 1);
      hatG.addColorStop(0, '#C084FC');
      hatG.addColorStop(1, '#581C87');
      ctx.fillStyle = hatG;
      ctx.beginPath();
      ctx.moveTo(f * 2, -17);
      ctx.lineTo(7.5, 0.5);
      ctx.lineTo(-7.5, 0.5);
      ctx.closePath();
      ctx.fill();
      // Gold hatband & twinkling star
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(-6.8, -2, 13.6, 2.4);
      ctx.beginPath();
      ctx.arc(0, -8.5, 1.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, en: CastleEnemy): void {
    const rawH = this.surfaceElevation(en.gx, en.gy);
    const baseH = Math.max(0, rawH);
    const h = en.kind === 'witch' || en.kind === 'bee_swarm' ? Math.max(2.3, this.curElev + 0.85) : baseH;
    const p = this.iso(en.gx, en.gy, h);
    const sh = this.iso(en.gx, en.gy, baseH);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(sh.x, sh.y + 2, 10.5, 5.2, 0, 0, Math.PI * 2);
    ctx.fill();

    if (en.kind === 'gem_eater') {
      const eating = en.eatingTimer > 0;
      const chomp = eating ? Math.abs(Math.sin(this.clock * 20)) : 0;
      if (eating) {
        // Clear vulnerable golden ring cue!
        ctx.strokeStyle = `rgba(250, 204, 21, ${0.55 + 0.45 * Math.sin(this.clock * 22)})`;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(p.x, p.y - 11, 15.5, 0, Math.PI * 2);
        ctx.stroke();
      }
      const g = ctx.createRadialGradient(p.x - 3, p.y - 15, 2, p.x, p.y - 11, 13);
      g.addColorStop(0, eating ? '#FEF08A' : '#86EFAC');
      g.addColorStop(0.55, eating ? '#FACC15' : '#22C55E');
      g.addColorStop(1, eating ? '#B45309' : '#14532D');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 11, 11.5 + chomp * 1.8, 0, Math.PI * 2);
      ctx.fill();
      // Fuzzy top antennae tufts
      ctx.strokeStyle = eating ? '#FEF08A' : '#4ADE80';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x - 4, p.y - 21);
      ctx.lineTo(p.x - 7, p.y - 26);
      ctx.moveTo(p.x + 4, p.y - 21);
      ctx.lineTo(p.x + 7, p.y - 26);
      ctx.stroke();
      // Expressive eyes
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(p.x - 4.2, p.y - 14, 3, 0, Math.PI * 2);
      ctx.arc(p.x + 4.2, p.y - 14, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(p.x - 4.2 + en.facing * 0.9, p.y - 14, 1.4, 0, Math.PI * 2);
      ctx.arc(p.x + 4.2 + en.facing * 0.9, p.y - 14, 1.4, 0, Math.PI * 2);
      ctx.fill();
      // Chomping mouth
      ctx.fillStyle = '#991B1B';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - 7, 5, 2 + chomp * 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (en.kind === 'tree') {
      const sway = Math.sin(en.phase * 1.4) * 2.5;
      // Gnarled walking trunk & roots
      ctx.fillStyle = '#78350F';
      ctx.fillRect(p.x - 4, p.y - 10, 8, 11);
      // 2-tier enchanted evergreen canopy
      ctx.fillStyle = '#15803D';
      ctx.beginPath();
      ctx.moveTo(p.x + sway, p.y - 36);
      ctx.lineTo(p.x + 14, p.y - 17);
      ctx.lineTo(p.x - 14, p.y - 17);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#16A34A';
      ctx.beginPath();
      ctx.moveTo(p.x + sway * 0.6, p.y - 27);
      ctx.lineTo(p.x + 16, p.y - 8);
      ctx.lineTo(p.x - 16, p.y - 8);
      ctx.closePath();
      ctx.fill();
      // Glowing mischievous amber eyes
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(p.x - 4 + sway * 0.4, p.y - 17, 2.2, 0, Math.PI * 2);
      ctx.arc(p.x + 4 + sway * 0.4, p.y - 17, 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (en.kind === 'crystal_ball') {
      const bounce = Math.abs(Math.sin(en.phase * 1.35)) * 13;
      const g = ctx.createRadialGradient(p.x - 4, p.y - 14 - bounce, 1.5, p.x, p.y - 10 - bounce, 12);
      g.addColorStop(0, '#FFFFFF');
      g.addColorStop(0.35, '#E0F2FE');
      g.addColorStop(0.75, '#64748B');
      g.addColorStop(1, '#1E293B');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 10 - bounce, 10.5, 0, Math.PI * 2);
      ctx.fill();
      // Prismatic shimmer glint
      ctx.strokeStyle = 'rgba(103, 232, 249, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 10 - bounce, 10.5, -2.4, -1.1);
      ctx.stroke();
    } else if (en.kind === 'skeleton') {
      const bob = Math.abs(Math.sin(en.phase * 2)) * 2.5;
      ctx.fillStyle = '#F8FAFC';
      // Skull
      ctx.beginPath();
      ctx.arc(p.x, p.y - 24 - bob, 6.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(p.x - 4, p.y - 19 - bob, 8, 3);
      // Ribcage & Spine
      ctx.fillRect(p.x - 2, p.y - 16 - bob, 4, 11);
      ctx.fillRect(p.x - 7, p.y - 14 - bob, 14, 2.2);
      ctx.fillRect(p.x - 6, p.y - 10 - bob, 12, 2.2);
      // Glowing cyan eyes
      ctx.fillStyle = '#22D3EE';
      ctx.fillRect(p.x - 3.8, p.y - 25.5 - bob, 2.5, 2.5);
      ctx.fillRect(p.x + 1.3, p.y - 25.5 - bob, 2.5, 2.5);
    } else if (en.kind === 'bee_swarm') {
      for (let b = 0; b < 6; b++) {
        const ang = this.clock * 8 + b * 1.1;
        const bx = p.x + Math.cos(ang) * 12;
        const by = p.y - 14 + Math.sin(ang * 1.5) * 8;
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.ellipse(bx, by, 4, 2.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(bx - 1, by - 2.4, 2, 4.8);
      }
    } else {
      // Berthilda the Witch flying on her enchanted broomstick!
      const hover = Math.sin(en.phase * 1.4) * 6;
      const f = en.facing;
      ctx.save();
      ctx.translate(p.x, p.y + hover);
      // Broom bristles + wooden handle
      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(-f * 20, -6);
      ctx.lineTo(f * 18, -11);
      ctx.stroke();
      ctx.fillStyle = '#FDE047';
      ctx.beginPath();
      ctx.moveTo(-f * 16, -7);
      ctx.lineTo(-f * 26, -12);
      ctx.lineTo(-f * 26, -1);
      ctx.closePath();
      ctx.fill();
      // Billowing purple cloak
      const robeG = ctx.createLinearGradient(0, -30, 0, -6);
      robeG.addColorStop(0, '#C084FC');
      robeG.addColorStop(1, '#581C87');
      ctx.fillStyle = robeG;
      ctx.beginPath();
      ctx.moveTo(0, -29);
      ctx.lineTo(10, -7);
      ctx.lineTo(-10, -7);
      ctx.closePath();
      ctx.fill();
      // Green witch face
      ctx.fillStyle = '#4ADE80';
      ctx.beginPath();
      ctx.arc(f * 1.5, -28, 4.5, 0, Math.PI * 2);
      ctx.fill();
      // Iconic pointed black-violet witch hat
      ctx.fillStyle = '#1E1B4B';
      ctx.beginPath();
      ctx.ellipse(0, -31, 11, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-f * 3, -44);
      ctx.lineTo(7, -31);
      ctx.lineTo(-7, -31);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const theme = this.getTheme();

    // Rich starlit fairytale twilight sky
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, theme.bgTop);
    bg.addColorStop(0.5, theme.bgMid);
    bg.addColorStop(1, theme.bgBottom);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Subtle magical aurora glow behind the castle spire
    const aurora = ctx.createRadialGradient(W * 0.5, 165, 20, W * 0.5, 220, 320);
    aurora.addColorStop(0, theme.moatColor);
    aurora.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = aurora;
    ctx.fillRect(0, 0, W, H);

    // Twinkling stars
    for (let s = 0; s < 38; s++) {
      const sx = ((s * 97 + 19) % (W - 36)) + 18;
      const sy = ((s * 53 + 11) % 145) + 10;
      const tw = 0.3 + 0.65 * Math.sin(this.clock * 2.5 + s);
      ctx.fillStyle = `rgba(255, 255, 255, ${tw})`;
      ctx.fillRect(sx, sy, s % 5 === 0 ? 2.5 : 1.8, s % 5 === 0 ? 2.5 : 1.8);
    }

    // Build per-diagonal-layer (gx + gy) entity buckets for TRUE 3D Painter's Depth Interleaving!
    const layerItems: Map<number, Array<{ depth: number; draw: () => void }>> = new Map();
    const pushItem = (gx: number, gy: number, subBias: number, draw: () => void) => {
      const layer = Math.max(0, Math.min((GRID - 1) * 2, Math.floor(gx) + Math.floor(gy)));
      const arr = layerItems.get(layer) ?? [];
      arr.push({ depth: gx + gy + subBias, draw });
      layerItems.set(layer, arr);
    };

    // Elevators
    for (const el of this.elevators) {
      pushItem(el.gx + 0.5, el.gy + 0.5, -0.35, () => this.drawElevator(ctx, el));
    }

    // Secret Warp Pad
    if (this.warpPad.active) {
      pushItem(this.warpPad.gx, this.warpPad.gy, -0.2, () => {
        const h = Math.max(0, this.surfaceElevation(this.warpPad.gx, this.warpPad.gy));
        const wp = this.iso(this.warpPad.gx, this.warpPad.gy, h);
        const pulse = 0.55 + 0.45 * Math.sin(this.clock * 8);
        ctx.strokeStyle = `rgba(56, 189, 248, ${pulse})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(wp.x, wp.y, 13, 7, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgba(103, 232, 249, ${0.28 * pulse})`;
        ctx.fill();
      });
    }

    // Gems
    for (const g of this.gems) {
      if (g.collected) continue;
      pushItem(g.gx, g.gy, -0.1, () => {
        const h = Math.max(0, this.surfaceElevation(g.gx, g.gy));
        const bob = Math.sin(g.sparklePhase) * 2.5;
        const p = this.iso(g.gx, g.gy, h);
        ctx.fillStyle = 'rgba(0,0,0,0.32)';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + 2, 5.5, 2.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = theme.gemColor;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 12.5 + bob);
        ctx.lineTo(p.x + 6, p.y - 5 + bob);
        ctx.lineTo(p.x, p.y + 1 + bob);
        ctx.lineTo(p.x - 6, p.y - 5 + bob);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = theme.gemCore;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 10.5 + bob);
        ctx.lineTo(p.x + 2.4, p.y - 6 + bob);
        ctx.lineTo(p.x, p.y - 3.5 + bob);
        ctx.lineTo(p.x - 2.4, p.y - 6 + bob);
        ctx.closePath();
        ctx.fill();
      });
    }

    // Magic Hat Pickup
    if (this.magicHat.active) {
      pushItem(this.magicHat.gx, this.magicHat.gy, 0, () => {
        const h = Math.max(0, this.surfaceElevation(this.magicHat.gx, this.magicHat.gy));
        const mh = this.iso(this.magicHat.gx, this.magicHat.gy, h);
        const bob = Math.sin(this.clock * 6) * 3.5;
        ctx.fillStyle = 'rgba(250, 204, 21, 0.25)';
        ctx.beginPath();
        ctx.ellipse(mh.x, mh.y + 1, 13, 6.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.ellipse(mh.x, mh.y - 5 + bob, 12, 4.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7C3AED';
        ctx.beginPath();
        ctx.moveTo(mh.x, mh.y - 23 + bob);
        ctx.lineTo(mh.x + 8, mh.y - 6 + bob);
        ctx.lineTo(mh.x - 8, mh.y - 6 + bob);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(mh.x, mh.y - 13 + bob, 2.2, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Honey Pot Pickup
    if (this.honeyPot.active) {
      pushItem(this.honeyPot.gx, this.honeyPot.gy, 0, () => {
        const h = Math.max(0, this.surfaceElevation(this.honeyPot.gx, this.honeyPot.gy));
        const hp = this.iso(this.honeyPot.gx, this.honeyPot.gy, h);
        const bob = Math.sin(this.clock * 5 + 1) * 2;
        ctx.fillStyle = '#D97706';
        ctx.beginPath();
        ctx.ellipse(hp.x, hp.y - 7 + bob, 8.5, 7.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FDE047';
        ctx.beginPath();
        ctx.ellipse(hp.x, hp.y - 13 + bob, 6.5, 2.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#78350F';
        ctx.font = '900 7px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('H', hp.x, hp.y - 4.5 + bob);
      });
    }

    // Dash trail ghosts
    for (const tr of this.trails) {
      pushItem(tr.gx, tr.gy, -0.02, () => {
        const tp = this.iso(tr.gx, tr.gy, tr.elev);
        ctx.save();
        ctx.globalAlpha = tr.life * 0.45;
        ctx.fillStyle = tr.color;
        ctx.beginPath();
        ctx.arc(tp.x, tp.y - 15, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }

    // Grounded Enemies (flying Witch & Bees draw after everything so they soar clearly overhead)
    const flyingEnemies: CastleEnemy[] = [];
    for (const en of this.enemies) {
      if (en.kind === 'witch' || en.kind === 'bee_swarm') {
        flyingEnemies.push(en);
      } else {
        pushItem(en.gx, en.gy, 0.04, () => this.drawEnemy(ctx, en));
      }
    }

    // Bentley Bear interleaved at his exact 3D isometric depth!
    pushItem(this.bx, this.by, 0.08, () => this.drawBentleyBear(ctx));

    // Render Diagonal Layers Back-to-Front: Tiles first, then Entities on that diagonal!
    for (let sum = 0; sum <= (GRID - 1) * 2; sum++) {
      for (let gx = 0; gx < GRID; gx++) {
        const gy = sum - gx;
        if (gy < 0 || gy >= GRID) continue;
        this.drawIsoBlock(ctx, gx, gy, this.tiles[gy][gx], theme);
      }
      const items = layerItems.get(sum);
      if (items) {
        items.sort((a, b) => a.depth - b.depth);
        for (const item of items) item.draw();
      }
    }

    // Flying Witch & Bee Swarm soar above all parapets
    for (const fe of flyingEnemies) {
      this.drawEnemy(ctx, fe);
    }

    renderParticlesAndPopups(ctx, this.particles, this.popups);

    // Subtle bottom castle badge during active play
    if (this.phase === 'PLAYING' || this.phase === 'READY') {
      ctx.save();
      ctx.fillStyle = 'rgba(7, 11, 28, 0.72)';
      ctx.beginPath();
      ctx.roundRect(W * 0.5 - 155, H - 36, 310, 24, 12);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.fillStyle = theme.accent;
      ctx.fillText(`CASTLE ${this.level} · ${theme.name}`, W * 0.5, H - 24);
      ctx.restore();
    }

    if (this.phase === 'TITLE') {
      ctx.save();
      ctx.fillStyle = 'rgba(7, 11, 30, 0.8)';
      ctx.beginPath();
      ctx.roundRect(W * 0.1, H * 0.34, W * 0.8, 152, 16);
      ctx.fill();
      ctx.strokeStyle = 'rgba(103, 232, 249, 0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#38BDF8';
      ctx.shadowBlur = 18;
      ctx.font = '900 40px "Outfit", sans-serif';
      ctx.fillStyle = '#67E8F9';
      ctx.fillText('CRYSTAL CASTLES', W * 0.5, H * 0.34 + 46);
      ctx.shadowBlur = 0;
      ctx.font = '700 13px "JetBrains Mono", monospace';
      ctx.fillStyle = '#FDE047';
      ctx.fillText('1983 ATARI · 8 3D CASTLES · STAIRS · ELEVATORS · BENTLEY BEAR', W * 0.5, H * 0.34 + 84);
      ctx.font = '600 11.5px "JetBrains Mono", monospace';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText('SPACE TO JUMP · SHIFT TO DASH · GRAB MAGIC HAT TO DEFEAT BERTHILDA!', W * 0.5, H * 0.34 + 118);
      ctx.restore();
    }

    if (visualMode === 'crt') renderCrtOverlay(ctx, W, H);
  }
}

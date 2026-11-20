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
import { arcadeAudio } from './audio';

export type BreakerVariant = 'superbreakout' | 'arkanoid' | 'arkanoid2';
type SuperBreakoutMode = 'cavity' | 'double' | 'progressive';

interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  color: string;
  accent: string;
  gold: boolean;
  regen: boolean;
  regenTimer: number;
  moveVx: number;
  moveMinX: number;
  moveMaxX: number;
  hitFlash: number;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  stuck: boolean;
  stuckOffset: number;
  mega: boolean; // Arkanoid II Mega-Ball: pierces straight through bricks!
  trappedInCavity: boolean; // Super Breakout Cavity pocket ball!
  trail: Array<{ x: number; y: number }>;
}

type CapsuleKind = 'E' | 'L' | 'D' | 'C' | 'S' | 'B' | 'P' | 'M' | 'T' | 'I' | 'N';

interface Capsule {
  x: number;
  y: number;
  kind: CapsuleKind;
  color: string;
  accent: string;
  spin: number;
}

interface SpaceEnemy {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  color: string;
  shape: 'harmful' | 'pyrad' | 'trisphere' | 'oppopo' | 'biodrone' | 'slime' | 'minislime';
  hp: number;
}

interface DohShot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
}

// ============================================================================
// AUTHENTIC MULTI-STAGE ARCHITECTURAL MAZE DEFINITIONS
// Completely distinct stage sets for Arkanoid 1 vs Arkanoid II!
// Legend:
//   . = empty, R=Red, O=Orange, Y=Yellow, G=Green, C=Cyan, B=Blue, P=Pink, V=Violet
//   S = Silver (multi-hit), K = Regenerating Silver (Arkanoid II), X = Gold Indestructible
//   H = Horizontal Sliding Gold/Silver Gate (Arkanoid II)
// ============================================================================

const ARKANOID1_STAGES: Array<{ name: string; pattern: string[]; theme: number }> = [
  {
    name: 'ROUND 1 · CLASSIC WALL',
    theme: 0,
    pattern: [
      'SSSSSSSSSSS',
      'RRRRRRRRRRR',
      'YYYYYYYYYYY',
      'BBBBBBBBBBB',
      'PPPPPPPPPPP',
      'GGGGGGGGGGG',
    ],
  },
  {
    name: 'ROUND 2 · RAINBOW WEDGE',
    theme: 1,
    pattern: [
      'R..........',
      'RO.........',
      'ROY........',
      'ROYG.......',
      'ROYGC......',
      'ROYGCB.....',
      'ROYGCBP....',
      'ROYGCBPR...',
      'ROYGCBPRO..',
      'SSSSSSSSSSS',
    ],
  },
  {
    name: 'ROUND 3 · GOLD CORRIDORS',
    theme: 2,
    pattern: [
      'GGGGGGGGGGG',
      'XXX.XXX.XXX',
      'RRRRRRRRRRR',
      '.XXX.XXX.XX',
      'CCCCCCCCCCC',
      'XXX.XXX.XXX',
      'YYYYYYYYYYY',
      'SSSSSSSSSSS',
    ],
  },
  {
    name: 'ROUND 4 · TWIN TOWERS',
    theme: 3,
    pattern: [
      '.RRRR.BBBB.',
      '.ROOR.BCCB.',
      '.RYYR.BPPB.',
      '.RGGR.BGGB.',
      '.RSSR.BSSB.',
      '.RXXR.BXXB.',
      '.ROOR.BCCB.',
      '.RRRR.BBBB.',
    ],
  },
  {
    name: 'ROUND 5 · SPACE INVADER',
    theme: 0,
    pattern: [
      '..G.....G..',
      '...G...G...',
      '..GGGGGGG..',
      '.GGYGGGYGG.',
      'GGGGGGGGGGG',
      'G.GGGGGGG.G',
      'G.G.....G.G',
      '...SS.SS...',
    ],
  },
  {
    name: 'ROUND 6 · FORTRESS VAULTS',
    theme: 1,
    pattern: [
      'X.RRRRRRR.X',
      'X.RYYYYYR.X',
      'X.RYCCCYR.X',
      'X.RY.S.YR.X',
      'X.RRRRRRR.X',
      'XX..XXX..XX',
      'BBBBBBBBBBB',
      'PPPPPPPPPPP',
    ],
  },
  {
    name: 'ROUND 7 · DIAMOND PRISM',
    theme: 2,
    pattern: [
      '.....R.....',
      '....ROR....',
      '...ROYOR...',
      '..ROYGYOR..',
      '.ROYGSGYOR.',
      '..ROYGYOR..',
      '...ROYOR...',
      '....ROR....',
      '.....R.....',
    ],
  },
];

const ARKANOID2_STAGES: Array<{ name: string; pattern: string[]; theme: number }> = [
  {
    name: 'ZONE 1 · TWIN BIO-RIBS',
    theme: 0,
    pattern: [
      'VVVV...VVVV',
      'PPPP...PPPP',
      'KKKK.H.KKKK',
      'CCCC...CCCC',
      'GGGG.H.GGGG',
      'YYYY...YYYY',
      'XXXX...XXXX',
    ],
  },
  {
    name: 'ZONE 2 · CROSSHAIR CRUCIBLE',
    theme: 1,
    pattern: [
      '....KXK....',
      '...KPPPK...',
      '..KPCCCPK..',
      'KKPCYYCPKK.',
      'XXPCYRCPXX.',
      'KKPCYYCPKK.',
      '..KPCCCPK..',
      '...KPPPK...',
      '....KXK....',
    ],
  },
  {
    name: 'ZONE 3 · SLIDING VAULTS',
    theme: 2,
    pattern: [
      'RRRRRRRRRRR',
      '..H.....H..',
      'KK.YYYYY.KK',
      '....H......',
      'XX.CCCCC.XX',
      '..H.....H..',
      'PPPPPPPPPPP',
      'KKKKKKKKKKK',
    ],
  },
  {
    name: 'ZONE 4 · HOURGLASS FUNNEL',
    theme: 3,
    pattern: [
      'VVVVVVVVVVV',
      '.OOOOOOOOO.',
      '..KKKKKKK..',
      '...GGGGG...',
      '....XXX....',
      '...CCCCC...',
      '..KKKKKKK..',
      '.PPPPPPPPP.',
      'YYYYYYYYYYY',
    ],
  },
  {
    name: 'ZONE 5 · CYBER HONEYCOMB',
    theme: 0,
    pattern: [
      'P.K.P.K.P.K',
      '.C.Y.C.Y.C.',
      'K.P.K.P.K.P',
      '.Y.C.Y.C.Y.',
      'X.G.H.G.X.G',
      '.R.V.R.V.R.',
      'K.K.K.K.K.K',
    ],
  },
  {
    name: 'ZONE 6 · TWIN BRIDGES',
    theme: 1,
    pattern: [
      'XXXXXXXXXXX',
      'K.RRRRRRR.K',
      'K.OOOOOOO.K',
      '....H......',
      'K.GGGGGGG.K',
      'K.CCCCCCC.K',
      'XX..KKK..XX',
      'PPPPPPPPPPP',
    ],
  },
  {
    name: 'ZONE 7 · SPIRE LABYRINTH',
    theme: 2,
    pattern: [
      'X.K.V.V.K.X',
      'X.K.P.P.K.X',
      'X...C.C...X',
      'X.H.Y.Y.H.X',
      'X.K.G.G.K.X',
      'X.K.R.R.K.X',
      'KKK..H..KKK',
    ],
  },
];

const BRICK_STYLE: Record<string, { color: string; accent: string }> = {
  R: { color: '#EF4444', accent: '#FCA5A5' },
  O: { color: '#F97316', accent: '#FDBA74' },
  Y: { color: '#FACC15', accent: '#FEF08A' },
  G: { color: '#22C55E', accent: '#86EFAC' },
  C: { color: '#06B6D4', accent: '#67E8F9' },
  B: { color: '#3B82F6', accent: '#93C5FD' },
  P: { color: '#EC4899', accent: '#F9A8D4' },
  V: { color: '#A855F7', accent: '#D8B4FE' },
  S: { color: '#94A3B8', accent: '#F1F5F9' },
  K: { color: '#CBD5E1', accent: '#38BDF8' },
  X: { color: '#D97706', accent: '#FDE047' },
  H: { color: '#14B8A6', accent: '#99F6E4' },
};

export class BreakerArcadeGame implements ArcadeGameInstance {
  public readonly logicalWidth = 620;
  public readonly logicalHeight = 680;
  public readonly supportsPointerAim = true;
  public readonly primaryActionLabel: string;
  public readonly secondaryActionLabel: string;

  private readonly variant: BreakerVariant;
  private readonly storageKey: string;
  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();

  private score = 0;
  private highScore = 0;
  private level = 1;
  private lives = 3;
  private clock = 0;
  private stateTimer = 0;

  // Super Breakout authentic 3-mode state
  private sbMode: SuperBreakoutMode = 'cavity';
  private sbBounceCount = 0;
  private sbWallShrunk = false;
  private prevSecondary = false;

  // Vaus / Paddle state
  private paddleX = 310;
  private paddleW = 92;
  private readonly paddleY = 626;
  private laserActive = false;
  private catchActive = false;
  private twinVaus = false; // Arkanoid II 'T' Twin Vaus!
  private illusionActive = false; // Arkanoid II 'I' Illusion afterimage paddles!
  private illusionHistory: number[] = [];
  private warpGateOpen = false;
  private fireCd = 0;
  private hatchOpenTimer = 0;

  // DOH Boss fight (Round 8, 16, ... in Arkanoid 1 & 2!)
  private dohActive = false;
  private dohHp = 16;
  private dohMaxHp = 16;
  private dohHitFlash = 0;
  private dohFireCd = 1.6;
  private dohMouthOpen = 0;
  private dohShots: DohShot[] = [];

  private stageLabel = '';
  private stageTheme = 0;
  private bricks: Brick[] = [];
  private balls: Ball[] = [];
  private capsules: Capsule[] = [];
  private lasers: Array<{ x: number; y: number }> = [];
  private enemies: SpaceEnemy[] = [];
  private enemySpawnCd = 3.5;

  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];
  private screenFlash = 0;

  // Offscreen cached geometric tiled backdrop (60fps zero-cost redraw!)
  private backdropCache: HTMLCanvasElement | null = null;
  private backdropCacheKey = '';

  constructor(variant: BreakerVariant) {
    this.variant = variant;
    this.storageKey = `${variant}_hd_highscore_v2`;
    this.highScore = readHighScore(this.storageKey);
    this.primaryActionLabel = variant === 'superbreakout' ? 'Serve Ball' : 'Launch / Laser';
    this.secondaryActionLabel =
      variant === 'superbreakout'
        ? 'Mode: Cavity/Double/Prog'
        : variant === 'arkanoid2'
          ? 'Dual L/R Warp Doors'
          : 'Warp Gate';
    this.setupRound(1);
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public startNewGame(): void {
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.phase = 'READY';
    this.stateTimer = 0.85;
    this.setupRound(1);
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.setupRound(1);
  }

  public restartStage(): void {
    if (this.variant === 'superbreakout') {
      const order: SuperBreakoutMode[] = ['cavity', 'double', 'progressive'];
      this.sbMode = order[(order.indexOf(this.sbMode) + 1) % order.length];
      this.setupSuperBreakoutWall();
      arcadeAudio.playPowerUp();
    }
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
        life: 0.85,
        maxLife: 0.85,
      });
    }
  }

  private makeBall(x: number, y: number, vx: number, vy: number, stuck = false, trappedInCavity = false): Ball {
    return { x, y, vx, vy, stuck, stuckOffset: 0, mega: false, trappedInCavity, trail: [] };
  }

  private setupRound(lvl: number): void {
    this.paddleX = this.logicalWidth * 0.5;
    this.paddleW = this.variant === 'superbreakout' ? 86 : 94;
    this.laserActive = false;
    this.catchActive = false;
    this.twinVaus = false;
    this.illusionActive = false;
    this.illusionHistory = [];
    this.warpGateOpen = false;
    this.sbBounceCount = 0;
    this.sbWallShrunk = false;
    this.capsules = [];
    this.lasers = [];
    this.enemies = [];
    this.dohShots = [];
    this.dohActive = false;
    this.enemySpawnCd = 3.2;
    this.bricks = [];

    if (this.variant === 'superbreakout') {
      // Cycle authentic 1978 Atari Super Breakout modes across rounds (or manually via R!)
      if (lvl === 1) {
        // Keep user's selected mode if cycling, otherwise default Cavity
      } else {
        const modes: SuperBreakoutMode[] = ['cavity', 'double', 'progressive'];
        this.sbMode = modes[(lvl - 1) % modes.length];
      }
      this.setupSuperBreakoutWall();
      return;
    }

    // Arkanoid 1 & Arkanoid 2: Round 8, 16, ... is the iconic DOH Boss Fight!
    this.balls = [this.makeBall(this.paddleX, this.paddleY - 14, 215, -350, true)];
    if (lvl % 8 === 0) {
      this.dohActive = true;
      this.dohMaxHp = this.variant === 'arkanoid2' ? 22 : 16;
      this.dohHp = this.dohMaxHp;
      this.dohFireCd = 1.4;
      this.stageTheme = 3;
      this.stageLabel =
        this.variant === 'arkanoid2'
          ? 'FINAL ZONE · REVENGE OF DOH CORE'
          : 'FINAL ROUND · DIMENSION OF HARM (DOH)';
      return;
    }

    const bank = this.variant === 'arkanoid2' ? ARKANOID2_STAGES : ARKANOID1_STAGES;
    const stageDef = bank[(lvl - 1) % bank.length];
    this.stageLabel = stageDef.name;
    this.stageTheme = stageDef.theme;

    const cols = 11;
    const bw = 48;
    const bh = 22;
    const ox = (this.logicalWidth - cols * bw) * 0.5;
    const oy = 96;

    stageDef.pattern.forEach((rowStr, r) => {
      for (let c = 0; c < Math.min(cols, rowStr.length); c++) {
        const ch = rowStr[c];
        if (ch === '.' || ch === ' ') continue;
        const st = BRICK_STYLE[ch] ?? BRICK_STYLE.B;
        const isGold = ch === 'X';
        const isSilver = ch === 'S' || ch === 'K';
        const isSliding = ch === 'H';
        const hp = isGold ? 999 : isSliding ? 3 : isSilver ? 2 + Math.floor(lvl / 4) : 1;
        this.bricks.push({
          x: ox + c * bw + 2,
          y: oy + r * bh + 2,
          w: bw - 4,
          h: bh - 4,
          hp,
          maxHp: hp,
          color: st.color,
          accent: st.accent,
          gold: isGold,
          regen: ch === 'K',
          regenTimer: 0,
          moveVx: isSliding ? (r % 2 === 0 ? 78 : -78) : 0,
          moveMinX: 38,
          moveMaxX: this.logicalWidth - 38 - (bw - 4),
          hitFlash: 0,
        });
      }
    });
  }

  private setupSuperBreakoutWall(): void {
    this.bricks = [];
    this.balls = [this.makeBall(this.paddleX, this.paddleY - 14, 210, -345, true)];
    this.stageTheme = 0;

    // Authentic 1978 Atari 6-band Color Cellophane Wall!
    const cols = 12;
    const bw = 46;
    const bh = 18;
    const ox = (this.logicalWidth - cols * bw) * 0.5;
    const oy = this.sbMode === 'progressive' ? 110 : 102;
    const bands = [
      { color: '#F59E0B', accent: '#FDE68A' }, // Top Amber
      { color: '#EF4444', accent: '#FCA5A5' }, // Red
      { color: '#F97316', accent: '#FDBA74' }, // Orange
      { color: '#EAB308', accent: '#FEF08A' }, // Yellow
      { color: '#22C55E', accent: '#86EFAC' }, // Green
      { color: '#38BDF8', accent: '#BAE6FD' }, // Cyan-Blue
    ];

    if (this.sbMode === 'cavity') {
      this.stageLabel = 'SUPER BREAKOUT · CAVITY 3-BALL';
      // Carve two authentic hollow cavities holding 2 trapped balls!
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < cols; c++) {
          const inLeftPocket = (r === 2 || r === 3) && (c === 2 || c === 3);
          const inRightPocket = (r === 2 || r === 3) && (c === 8 || c === 9);
          if (inLeftPocket || inRightPocket) continue;
          const bStyle = bands[r];
          this.bricks.push({
            x: ox + c * bw + 1.5,
            y: oy + r * bh + 1.5,
            w: bw - 3,
            h: bh - 3,
            hp: 1,
            maxHp: 1,
            color: bStyle.color,
            accent: bStyle.accent,
            gold: false,
            regen: false,
            regenTimer: 0,
            moveVx: 0,
            moveMinX: 0,
            moveMaxX: 0,
            hitFlash: 0,
          });
        }
      }
      // Two live balls bouncing inside the left & right Cavity pockets!
      this.balls.push(this.makeBall(ox + 3 * bw, oy + 3 * bh, 170, -190, false, true));
      this.balls.push(this.makeBall(ox + 9 * bw, oy + 3 * bh, -170, 190, false, true));
    } else if (this.sbMode === 'double') {
      this.stageLabel = 'SUPER BREAKOUT · DOUBLE PADDLE';
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < cols; c++) {
          const bStyle = bands[r];
          this.bricks.push({
            x: ox + c * bw + 1.5,
            y: oy + r * bh + 1.5,
            w: bw - 3,
            h: bh - 3,
            hp: 1,
            maxHp: 1,
            color: bStyle.color,
            accent: bStyle.accent,
            gold: false,
            regen: false,
            regenTimer: 0,
            moveVx: 0,
            moveMinX: 0,
            moveMaxX: 0,
            hitFlash: 0,
          });
        }
      }
      // Second live ball on upper double paddle!
      this.balls.push(this.makeBall(this.paddleX + 12, this.paddleY - 88, -205, -340, false, false));
    } else {
      this.stageLabel = 'SUPER BREAKOUT · PROGRESSIVE WALL';
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < cols; c++) {
          const bStyle = bands[r % bands.length];
          this.bricks.push({
            x: ox + c * bw + 1.5,
            y: oy + r * bh + 1.5,
            w: bw - 3,
            h: bh - 3,
            hp: 1,
            maxHp: 1,
            color: bStyle.color,
            accent: bStyle.accent,
            gold: false,
            regen: false,
            regenTimer: 0,
            moveVx: 0,
            moveMinX: 0,
            moveMaxX: 0,
            hitFlash: 0,
          });
        }
      }
    }
  }

  private maybeDropCapsule(x: number, y: number): void {
    if (this.variant === 'superbreakout' || Math.random() > 0.25) return;
    if (this.capsules.length >= 2) return;

    const pool: Array<{ kind: CapsuleKind; color: string; accent: string }> =
      this.variant === 'arkanoid2'
        ? [
            { kind: 'M', color: '#D946EF', accent: '#F5D0FE' }, // Mega-Ball Piercer!
            { kind: 'T', color: '#06B6D4', accent: '#CFFAFE' }, // Twin Vaus!
            { kind: 'I', color: '#10B981', accent: '#A7F3D0' }, // Illusion Shadow Paddle!
            { kind: 'N', color: '#6366F1', accent: '#C7D2FE' }, // New 8-Ball Disruption!
            { kind: 'L', color: '#EF4444', accent: '#FECACA' }, // Laser Vaus
            { kind: 'E', color: '#2563EB', accent: '#BFDBFE' }, // Expand
            { kind: 'C', color: '#22C55E', accent: '#BBF7D0' }, // Catch
            { kind: 'B', color: '#EC4899', accent: '#FBCFE8' }, // Dual Warp Doors!
            { kind: 'P', color: '#EAB308', accent: '#FEF08A' }, // Extra Vaus
          ]
        : [
            { kind: 'E', color: '#2563EB', accent: '#BFDBFE' }, // Expand
            { kind: 'L', color: '#EF4444', accent: '#FECACA' }, // Laser
            { kind: 'D', color: '#06B6D4', accent: '#CFFAFE' }, // Disruption 3-Ball
            { kind: 'C', color: '#22C55E', accent: '#BBF7D0' }, // Catch
            { kind: 'S', color: '#F97316', accent: '#FED7AA' }, // Slow
            { kind: 'B', color: '#EC4899', accent: '#FBCFE8' }, // Break Right Warp Gate
            { kind: 'P', color: '#94A3B8', accent: '#F8FAFC' }, // Extra Player
          ];
    const pick = pool[Math.floor(Math.random() * pool.length)];
    this.capsules.push({ x, y, kind: pick.kind, color: pick.color, accent: pick.accent, spin: 0 });
  }

  private getPaddleSegments(): Array<{ cx: number; cy: number; w: number; isShadow?: boolean }> {
    const segs: Array<{ cx: number; cy: number; w: number; isShadow?: boolean }> = [];
    if (this.variant === 'superbreakout' && this.sbMode === 'double') {
      segs.push({ cx: this.paddleX, cy: this.paddleY, w: this.paddleW });
      segs.push({ cx: this.paddleX, cy: this.paddleY - 74, w: this.paddleW });
    } else if (this.twinVaus) {
      const half = Math.max(48, this.paddleW * 0.62);
      segs.push({ cx: this.paddleX - half * 0.85, cy: this.paddleY, w: half });
      segs.push({ cx: this.paddleX + half * 0.85, cy: this.paddleY, w: half });
    } else {
      segs.push({ cx: this.paddleX, cy: this.paddleY, w: this.paddleW });
    }
    if (this.illusionActive && this.illusionHistory.length >= 6) {
      segs.push({ cx: this.illusionHistory[0], cy: this.paddleY, w: this.paddleW * 0.9, isShadow: true });
    }
    return segs;
  }

  public step(dt: number): void {
    this.clock += dt;
    this.screenFlash = Math.max(0, this.screenFlash - dt * 2.2);
    this.hatchOpenTimer = Math.max(0, this.hatchOpenTimer - dt);
    this.dohHitFlash = Math.max(0, this.dohHitFlash - dt * 4);
    this.dohMouthOpen = Math.max(0, this.dohMouthOpen - dt * 1.4);
    stepParticlesAndPopups(this.particles, this.popups, dt);

    // Super Breakout Mode Switch ('R' / secondary button)
    const secEdge = this.input.secondaryJustPressed || (this.input.secondary && !this.prevSecondary);
    this.prevSecondary = this.input.secondary;
    if (this.variant === 'superbreakout' && secEdge && (this.phase === 'PLAYING' || this.phase === 'TITLE')) {
      const order: SuperBreakoutMode[] = ['cavity', 'double', 'progressive'];
      this.sbMode = order[(order.indexOf(this.sbMode) + 1) % order.length];
      this.setupSuperBreakoutWall();
      arcadeAudio.playPowerUp();
    }

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
        this.setupRound(this.level);
      }
      return;
    }

    const attract = this.phase === 'TITLE';
    this.fireCd = Math.max(0, this.fireCd - dt);

    // Paddle movement
    if (attract) {
      const activeBall = this.balls.find((b) => !b.trappedInCavity) ?? this.balls[0];
      const targetX = activeBall?.x ?? this.logicalWidth * 0.5;
      this.paddleX += (targetX - this.paddleX) * Math.min(1, dt * 8.5);
    } else if (this.input.pointerActive) {
      this.paddleX = this.input.pointerX;
    } else {
      const spd = 490;
      if (this.input.left) this.paddleX -= spd * dt;
      if (this.input.right) this.paddleX += spd * dt;
    }

    const effectiveHalfW = this.twinVaus ? Math.max(66, this.paddleW * 0.85) : this.paddleW * 0.5;
    const minX = 28 + effectiveHalfW;
    const maxX = this.logicalWidth - 28 - effectiveHalfW;

    // Authentic Arkanoid Break Warp Gate Exit (Right in Ark 1; Left OR Right in Ark 2!)
    if (!attract && this.warpGateOpen && (this.paddleX >= maxX - 3 || (this.variant === 'arkanoid2' && this.paddleX <= minX + 3))) {
      const dir = this.paddleX <= minX + 3 ? 'LEFT DIMENSION WARP!' : 'RIGHT DIMENSION WARP!';
      arcadeAudio.playStageClear();
      this.screenFlash = 0.4;
      this.addScore(10000, this.paddleX, this.paddleY - 26, this.variant === 'arkanoid2' ? dir : 'BREAK WARP!');
      this.phase = 'STAGE_CLEAR';
      this.stateTimer = 1.4;
      return;
    }
    this.paddleX = Math.max(minX, Math.min(maxX, this.paddleX));

    // Record Illusion shadow paddle trail (Arkanoid II 'I')
    if (this.illusionActive) {
      this.illusionHistory.push(this.paddleX);
      if (this.illusionHistory.length > 10) this.illusionHistory.shift();
    }

    // Launch stuck balls or fire Vaus Lasers
    const wantAction = attract ? this.balls.some((b) => b.stuck) : this.input.fire || this.input.fireJustPressed;
    if (wantAction) {
      for (const b of this.balls) {
        if (b.stuck) {
          b.stuck = false;
          if (!attract) arcadeAudio.playPaddleBounce();
        }
      }
      if (this.laserActive && this.fireCd <= 0 && !attract) {
        this.fireCd = 0.21;
        const segs = this.getPaddleSegments().filter((s) => !s.isShadow);
        for (const seg of segs) {
          this.lasers.push({ x: seg.cx - seg.w * 0.34, y: seg.cy - 14 });
          this.lasers.push({ x: seg.cx + seg.w * 0.34, y: seg.cy - 14 });
        }
        arcadeAudio.playLaser();
      }
    }

    // Update Bricks (sliding gates & regenerating silver bricks in Arkanoid II!)
    for (const br of this.bricks) {
      br.hitFlash = Math.max(0, br.hitFlash - dt * 5);
      if (br.moveVx !== 0) {
        br.x += br.moveVx * dt;
        if (br.x <= br.moveMinX) {
          br.x = br.moveMinX;
          br.moveVx = Math.abs(br.moveVx);
        } else if (br.x >= br.moveMaxX) {
          br.x = br.moveMaxX;
          br.moveVx = -Math.abs(br.moveVx);
        }
      }
      if (br.regen && br.hp > 0 && br.hp < br.maxHp) {
        br.regenTimer += dt;
        if (br.regenTimer >= 4.8) {
          br.hp = Math.min(br.maxHp, br.hp + 1);
          br.regenTimer = 0;
          br.hitFlash = 1;
        }
      }
    }

    // Update DOH Dimensional Boss (Round 8, 16...)
    if (this.dohActive) {
      this.dohFireCd -= dt;
      if (this.dohFireCd <= 0 && !attract) {
        this.dohFireCd = this.variant === 'arkanoid2' ? 1.55 : 2.0;
        this.dohMouthOpen = 0.7;
        const cx = this.logicalWidth * 0.5;
        const cy = 248;
        const baseAng = Math.atan2(this.paddleY - cy, this.paddleX - cx);
        const spreads = this.variant === 'arkanoid2' ? [-0.26, 0, 0.26] : [-0.14, 0.14];
        for (const off of spreads) {
          this.dohShots.push({
            x: cx,
            y: cy + 28,
            vx: Math.cos(baseAng + off) * 215,
            vy: Math.sin(baseAng + off) * 215,
            color: this.variant === 'arkanoid2' ? '#E879F9' : '#FB923C',
          });
        }
      }
      for (let i = this.dohShots.length - 1; i >= 0; i--) {
        const ds = this.dohShots[i];
        ds.x += ds.vx * dt;
        ds.y += ds.vy * dt;
        if (ds.y > this.logicalHeight + 20 || ds.x < 20 || ds.x > this.logicalWidth - 20) {
          this.dohShots.splice(i, 1);
          continue;
        }
        if (!attract && Math.abs(ds.x - this.paddleX) < this.paddleW * 0.48 && Math.abs(ds.y - this.paddleY) < 16) {
          this.dohShots.splice(i, 1);
          this.loseLife();
          break;
        }
      }
    }

    // Authentic Arkanoid 1 & 2 Space Enemies entering through top hatch gates!
    if (this.variant !== 'superbreakout' && !this.dohActive) {
      this.enemySpawnCd -= dt;
      if (this.enemySpawnCd <= 0 && this.enemies.length < (this.variant === 'arkanoid2' ? 4 : 3)) {
        this.enemySpawnCd = this.variant === 'arkanoid2' ? 3.8 : 4.5;
        this.hatchOpenTimer = 0.9;
        const hatchXs = this.variant === 'arkanoid2' ? [145, this.logicalWidth * 0.5, this.logicalWidth - 145] : [155, this.logicalWidth - 155];
        const spawnX = hatchXs[Math.floor(Math.random() * hatchXs.length)];
        const shapesArk1: SpaceEnemy['shape'][] = ['harmful', 'pyrad', 'trisphere', 'oppopo'];
        const shapesArk2: SpaceEnemy['shape'][] = ['biodrone', 'slime', 'pyrad'];
        const shape =
          this.variant === 'arkanoid2'
            ? shapesArk2[Math.floor(Math.random() * shapesArk2.length)]
            : shapesArk1[Math.floor(Math.random() * shapesArk1.length)];
        const col =
          shape === 'harmful'
            ? '#EF4444'
            : shape === 'pyrad'
              ? '#38BDF8'
              : shape === 'trisphere'
                ? '#22C55E'
                : shape === 'oppopo'
                  ? '#60A5FA'
                  : shape === 'slime'
                    ? '#4ADE80'
                    : '#F472B6';
        this.enemies.push({
          x: spawnX,
          y: 44,
          vx: (Math.random() < 0.5 ? -1 : 1) * 68,
          vy: 56,
          phase: Math.random() * 6,
          color: col,
          shape,
          hp: shape === 'slime' ? 2 : 1,
        });
      }
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        e.phase += dt * 4.2;
        e.x += (e.vx + Math.sin(e.phase) * 40) * dt;
        e.y += e.vy * dt;
        if (e.x < 42 || e.x > this.logicalWidth - 42) e.vx = -e.vx;
        if (e.y > this.logicalHeight + 24) this.enemies.splice(i, 1);
      }
    }

    // Update Lasers
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const l = this.lasers[i];
      l.y -= 660 * dt;
      if (l.y < 32) {
        this.lasers.splice(i, 1);
        continue;
      }
      let hit = false;
      for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
        const e = this.enemies[ei];
        if (Math.hypot(e.x - l.x, e.y - l.y) < 18) {
          this.destroySpaceEnemy(ei, attract);
          hit = true;
          break;
        }
      }
      if (!hit && this.dohActive && Math.abs(l.x - this.logicalWidth * 0.5) < 62 && l.y <= 300 && l.y >= 140) {
        hit = true;
        this.damageDoh(1, l.x, l.y, attract);
      }
      if (!hit) {
        for (let bi = this.bricks.length - 1; bi >= 0; bi--) {
          const br = this.bricks[bi];
          if (l.x >= br.x && l.x <= br.x + br.w && l.y >= br.y && l.y <= br.y + br.h) {
            hit = true;
            if (!br.gold) {
              br.hp -= 1;
              br.hitFlash = 1;
              br.regenTimer = 0;
              if (br.hp <= 0) {
                spawnBurst(this.particles, br.x + br.w * 0.5, br.y + br.h * 0.5, br.color, 10, 155, 2.6);
                this.addScore(90, br.x + br.w * 0.5, br.y);
                this.maybeDropCapsule(br.x + br.w * 0.5, br.y + br.h * 0.5);
                this.bricks.splice(bi, 1);
              }
            }
            break;
          }
        }
      }
      if (hit) this.lasers.splice(i, 1);
    }

    // Update Power Capsules
    const paddleSegs = this.getPaddleSegments();
    for (let i = this.capsules.length - 1; i >= 0; i--) {
      const c = this.capsules[i];
      c.y += 155 * dt;
      c.spin += dt * 7;
      const caught = paddleSegs.some((seg) => !seg.isShadow && Math.abs(c.x - seg.cx) < seg.w * 0.55 + 10 && Math.abs(c.y - seg.cy) < 20);
      if (caught) {
        this.applyCapsule(c);
        this.capsules.splice(i, 1);
        continue;
      }
      if (c.y > this.logicalHeight + 24) this.capsules.splice(i, 1);
    }

    // Update Balls
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      if (b.stuck) {
        b.x = this.paddleX + b.stuckOffset;
        b.y = this.paddleY - 14;
        continue;
      }

      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > (b.mega ? 9 : 5)) b.trail.shift();

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.x < 30) {
        b.x = 30;
        b.vx = Math.abs(b.vx);
      } else if (b.x > this.logicalWidth - 30) {
        b.x = this.logicalWidth - 30;
        b.vx = -Math.abs(b.vx);
      }
      if (b.y < 36) {
        b.y = 36;
        b.vy = Math.abs(b.vy);
        // Authentic 1978 Atari Super Breakout: hitting the top ceiling shrinks paddle width!
        if (this.variant === 'superbreakout' && !this.sbWallShrunk) {
          this.sbWallShrunk = true;
          this.paddleW = 54;
          if (!attract) this.addScore(100, b.x, 54, 'BREAKTHROUGH!');
        }
      }

      // Paddle bounce (supports Double Paddle, Twin Vaus, and Illusion Shadow Paddle!)
      if (b.vy > 0 && !b.trappedInCavity) {
        for (const seg of paddleSegs) {
          if (b.y >= seg.cy - 13 && b.y <= seg.cy + 12 && Math.abs(b.x - seg.cx) <= seg.w * 0.5 + 8) {
            const hitRatio = Math.max(-1, Math.min(1, (b.x - seg.cx) / (seg.w * 0.5)));
            const speed = Math.min(560, Math.max(360, Math.hypot(b.vx, b.vy) * 1.015));
            const angle = -Math.PI * 0.5 + hitRatio * 1.12;
            b.vx = Math.cos(angle) * speed;
            b.vy = Math.sin(angle) * speed;
            b.y = seg.cy - 14;
            if (this.catchActive && !attract && !seg.isShadow) {
              b.stuck = true;
              b.stuckOffset = b.x - this.paddleX;
            }
            if (!attract) arcadeAudio.playPaddleBounce();

            // Super Breakout Progressive Mode: every 5 rebounds shifts wall downward & adds a fresh top row!
            if (this.variant === 'superbreakout' && this.sbMode === 'progressive') {
              this.sbBounceCount++;
              if (this.sbBounceCount % 5 === 0) {
                this.advanceProgressiveWall();
              }
            }
            break;
          }
        }
      }

      // DOH Boss hit check
      if (this.dohActive && Math.abs(b.x - this.logicalWidth * 0.5) < 66 && b.y > 136 && b.y < 306) {
        const dx = b.x - this.logicalWidth * 0.5;
        const dy = b.y - 220;
        if (Math.abs(dx) > Math.abs(dy) * 0.85) b.vx = Math.sign(dx || 1) * Math.abs(b.vx);
        else b.vy = Math.sign(dy || 1) * Math.abs(b.vy);
        this.damageDoh(b.mega ? 2 : 1, b.x, b.y, attract);
      }

      // Space Enemy deflection!
      for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
        const e = this.enemies[ei];
        if (Math.hypot(e.x - b.x, e.y - b.y) < 20) {
          if (!b.mega) {
            b.vx = (Math.random() < 0.5 ? -1 : 1) * Math.abs(b.vx);
            b.vy = -b.vy;
          }
          this.destroySpaceEnemy(ei, attract);
          break;
        }
      }

      // Brick collisions
      for (let bi = this.bricks.length - 1; bi >= 0; bi--) {
        const br = this.bricks[bi];
        if (b.x + 7 > br.x && b.x - 7 < br.x + br.w && b.y + 7 > br.y && b.y - 7 < br.y + br.h) {
          if (b.trappedInCavity) {
            // Cavity balls bounce cleanly inside until player opens a breach!
            const overlapX = Math.min(b.x + 7 - br.x, br.x + br.w - (b.x - 7));
            const overlapY = Math.min(b.y + 7 - br.y, br.y + br.h - (b.y - 7));
            if (overlapX < overlapY) b.vx = -b.vx;
            else b.vy = -b.vy;
            break;
          }

          if (!b.mega) {
            const overlapX = Math.min(b.x + 7 - br.x, br.x + br.w - (b.x - 7));
            const overlapY = Math.min(b.y + 7 - br.y, br.y + br.h - (b.y - 7));
            if (overlapX < overlapY) b.vx = -b.vx;
            else b.vy = -b.vy;
          }

          if (!br.gold || b.mega) {
            br.hp -= b.mega ? 999 : 1;
            br.hitFlash = 1;
            br.regenTimer = 0;
            if (br.hp <= 0) {
              spawnBurst(this.particles, br.x + br.w * 0.5, br.y + br.h * 0.5, br.color, 11, 165, 2.7);
              if (!attract) {
                arcadeAudio.playCoin();
                this.addScore(br.gold ? 200 : br.maxHp > 1 ? 150 : 70, br.x + br.w * 0.5, br.y);
                this.maybeDropCapsule(br.x + br.w * 0.5, br.y + br.h * 0.5);
              }
              this.bricks.splice(bi, 1);

              // Super Breakout Cavity: check if any trapped cavity ball now has an open escape below!
              if (this.variant === 'superbreakout' && this.sbMode === 'cavity') {
                for (const cb of this.balls) {
                  if (cb.trappedInCavity && Math.hypot(cb.x - (br.x + br.w * 0.5), cb.y - (br.y + br.h * 0.5)) < 68) {
                    cb.trappedInCavity = false;
                    cb.vy = Math.abs(cb.vy) + 120;
                    if (!attract) {
                      arcadeAudio.playPowerUp();
                      this.addScore(500, cb.x, cb.y, 'CAVITY FREED!');
                    }
                  }
                }
              }
            } else if (!attract) {
              arcadeAudio.playRockThud();
            }
          } else if (!attract) {
            br.hitFlash = 1;
            arcadeAudio.playRockThud();
          }
          if (!b.mega) break;
        }
      }

      if (b.y > this.logicalHeight + 22) {
        this.balls.splice(i, 1);
      }
    }

    // Check if all free balls lost
    const freeBalls = this.balls.filter((b) => !b.trappedInCavity);
    if (freeBalls.length === 0) {
      if (attract) {
        this.balls.push(this.makeBall(this.paddleX, this.paddleY - 14, 215, -340, false));
      } else {
        this.loseLife();
      }
    }

    // Round Clear check
    if (!attract && !this.dohActive && this.bricks.every((br) => br.gold)) {
      arcadeAudio.playStageClear();
      this.addScore(1500, this.logicalWidth * 0.5, 280, 'ROUND CLEAR!');
      this.phase = 'STAGE_CLEAR';
      this.stateTimer = 1.4;
    }
  }

  private advanceProgressiveWall(): void {
    const bh = 18;
    for (const br of this.bricks) {
      br.y += bh;
      if (br.y + br.h >= this.paddleY - 22) {
        this.loseLife();
        this.setupSuperBreakoutWall();
        return;
      }
    }
    const cols = 12;
    const bw = 46;
    const ox = (this.logicalWidth - cols * bw) * 0.5;
    const colors = [
      { color: '#F59E0B', accent: '#FDE68A' },
      { color: '#EF4444', accent: '#FCA5A5' },
      { color: '#22C55E', accent: '#86EFAC' },
      { color: '#38BDF8', accent: '#BAE6FD' },
    ];
    const st = colors[Math.floor(this.sbBounceCount / 5) % colors.length];
    for (let c = 0; c < cols; c++) {
      this.bricks.push({
        x: ox + c * bw + 1.5,
        y: 110 + 1.5,
        w: bw - 3,
        h: bh - 3,
        hp: 1,
        maxHp: 1,
        color: st.color,
        accent: st.accent,
        gold: false,
        regen: false,
        regenTimer: 0,
        moveVx: 0,
        moveMinX: 0,
        moveMaxX: 0,
        hitFlash: 0,
      });
    }
  }

  private loseLife(): void {
    this.lives -= 1;
    this.laserActive = false;
    this.catchActive = false;
    this.twinVaus = false;
    this.illusionActive = false;
    this.paddleW = this.variant === 'superbreakout' ? 86 : 94;
    this.sbWallShrunk = false;
    arcadeAudio.playDeath();
    if (this.lives <= 0) {
      this.phase = 'GAME_OVER';
    } else {
      this.balls = this.balls.filter((b) => b.trappedInCavity);
      this.balls.push(this.makeBall(this.paddleX, this.paddleY - 14, 215, -345, true));
    }
  }

  private destroySpaceEnemy(idx: number, attract: boolean): void {
    const e = this.enemies[idx];
    e.hp -= 1;
    if (e.hp > 0) {
      spawnBurst(this.particles, e.x, e.y, e.color, 8, 130, 2.2);
      if (!attract) arcadeAudio.playRockThud();
      return;
    }
    spawnBurst(this.particles, e.x, e.y, e.color, 15, 185, 3);
    if (!attract) {
      arcadeAudio.playExplosion(false);
      this.addScore(150, e.x, e.y);
    }
    this.enemies.splice(idx, 1);
    // Arkanoid II Green Slime Splitter spawns 2 mini-slimes!
    if (e.shape === 'slime') {
      this.enemies.push({ x: e.x - 14, y: e.y, vx: -85, vy: 62, phase: 0, color: '#86EFAC', shape: 'minislime', hp: 1 });
      this.enemies.push({ x: e.x + 14, y: e.y, vx: 85, vy: 62, phase: 2, color: '#86EFAC', shape: 'minislime', hp: 1 });
    }
  }

  private damageDoh(dmg: number, x: number, y: number, attract: boolean): void {
    this.dohHp -= dmg;
    this.dohHitFlash = 1;
    spawnBurst(this.particles, x, y, '#FACC15', 14, 210, 3);
    if (!attract) {
      arcadeAudio.playExplosion(false);
      this.addScore(250, x, y);
    }
    if (this.dohHp <= 0) {
      this.dohActive = false;
      this.dohShots = [];
      this.screenFlash = 0.65;
      spawnBurst(this.particles, this.logicalWidth * 0.5, 220, '#FACC15', 48, 320, 4.5);
      if (!attract) {
        arcadeAudio.playStageClear();
        this.addScore(20000, this.logicalWidth * 0.5, 220, 'DOH VANQUISHED!');
        this.phase = 'STAGE_CLEAR';
        this.stateTimer = 1.8;
      }
    }
  }

  private applyCapsule(c: Capsule): void {
    arcadeAudio.playPowerUp();
    const labelMap: Record<CapsuleKind, string> = {
      E: 'EXPAND VAUS',
      L: 'LASER VAUS',
      D: 'DISRUPTION 3X',
      C: 'CATCH MAGNET',
      S: 'SLOW BALL',
      B: this.variant === 'arkanoid2' ? 'DUAL WARP DOORS!' : 'BREAK WARP!',
      P: '1UP EXTRA VAUS!',
      M: 'MEGA-BALL PIERCER!',
      T: 'TWIN VAUS!',
      I: 'ILLUSION SHADOW!',
      N: 'NEW 8-BALL CHAOS!',
    };
    if (c.kind === 'E') {
      this.twinVaus = false;
      this.paddleW = Math.min(164, this.paddleW + 34);
    } else if (c.kind === 'L') {
      this.laserActive = true;
      this.catchActive = false;
    } else if (c.kind === 'C') {
      this.catchActive = true;
      this.laserActive = false;
    } else if (c.kind === 'B') {
      this.warpGateOpen = true;
    } else if (c.kind === 'P') {
      this.lives += 1;
      arcadeAudio.playExtraLife();
    } else if (c.kind === 'S') {
      for (const b of this.balls) {
        b.vx *= 0.78;
        b.vy *= 0.78;
      }
    } else if (c.kind === 'M') {
      for (const b of this.balls) b.mega = true;
    } else if (c.kind === 'T') {
      this.twinVaus = true;
    } else if (c.kind === 'I') {
      this.illusionActive = true;
    } else if (c.kind === 'D' || c.kind === 'N') {
      const cap = c.kind === 'N' ? 8 : 4;
      const ref = this.balls[0];
      if (ref) {
        const toAdd = c.kind === 'N' ? 4 : 2;
        for (let k = 0; k < toAdd && this.balls.length < cap; k++) {
          const ang = -Math.PI * 0.5 + (k - toAdd * 0.5) * 0.42;
          const spd = Math.max(360, Math.hypot(ref.vx, ref.vy));
          const nb = this.makeBall(ref.x, ref.y, Math.cos(ang) * spd, Math.sin(ang) * spd, false);
          nb.mega = ref.mega;
          this.balls.push(nb);
        }
      }
    }
    this.addScore(250, c.x, c.y - 14, labelMap[c.kind]);
  }

  public getHudSnapshot(): ClassicGameHud {
    const activePower =
      this.variant === 'superbreakout'
        ? this.sbMode.toUpperCase()
        : this.warpGateOpen
          ? 'WARP OPEN!'
          : this.balls.some((b) => b.mega)
            ? 'MEGA-BALL'
            : this.twinVaus
              ? 'TWIN VAUS'
              : this.illusionActive
                ? 'ILLUSION'
                : this.laserActive
                  ? 'LASER'
                  : this.catchActive
                    ? 'CATCH'
                    : 'STANDARD';
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: this.stageLabel || `${this.variant.toUpperCase()} · ROUND ${this.level}`,
      primaryMetricLabel: this.dohActive ? 'DOH HP' : 'BRICKS',
      primaryMetricValue: this.dohActive
        ? `${this.dohHp}/${this.dohMaxHp}`
        : String(this.bricks.filter((b) => !b.gold).length),
      secondaryMetricLabel: this.variant === 'superbreakout' ? 'MODE [R]' : 'VAUS',
      secondaryMetricValue: activePower,
      bannerText: this.phase === 'STAGE_CLEAR' ? 'ROUND CLEARED!' : this.phase === 'GAME_OVER' ? 'GAME OVER' : '',
    };
  }

  private getOrBuildBackdrop(W: number, H: number): HTMLCanvasElement | null {
    const key = `${this.variant}:${this.stageTheme}`;
    if (this.backdropCache && this.backdropCacheKey === key) return this.backdropCache;
    if (typeof document === 'undefined') return null;

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const bctx = canvas.getContext('2d');
    if (!bctx) return null;

    if (this.variant === 'superbreakout') {
      // Authentic 1978 Atari jet-black high-contrast CRT cabinet background!
      bctx.fillStyle = '#03050A';
      bctx.fillRect(0, 0, W, H);
      // Very subtle cellophane band tint behind brick rows
      const tints = ['rgba(245,158,11,0.06)', 'rgba(239,68,68,0.05)', 'rgba(234,179,8,0.05)', 'rgba(34,197,94,0.05)', 'rgba(56,189,248,0.06)'];
      tints.forEach((t, idx) => {
        bctx.fillStyle = t;
        bctx.fillRect(26, 98 + idx * 24, W - 52, 24);
      });
    } else if (this.variant === 'arkanoid') {
      // Authentic 1986 Taito Space Geometric Mosaic Tiles (4 classic colorways!)
      const palettes = [
        { bg: '#0A1944', stroke: '#1D4ED8', hi: '#2563EB' }, // Royal Blue Hex
        { bg: '#062C22', stroke: '#0F766E', hi: '#14B8A6' }, // Emerald Circuit
        { bg: '#3B0A18', stroke: '#9F1239', hi: '#E11D48' }, // Crimson Weave
        { bg: '#0C163B', stroke: '#3730A3', hi: '#6366F1' }, // Cobalt Star Tiles
      ];
      const pal = palettes[this.stageTheme % palettes.length];
      bctx.fillStyle = pal.bg;
      bctx.fillRect(0, 0, W, H);

      bctx.strokeStyle = pal.stroke;
      bctx.lineWidth = 1.5;
      const tile = 36;
      for (let y = 24; y < H; y += tile) {
        for (let x = 24; x < W - 24; x += tile) {
          if (this.stageTheme % 2 === 0) {
            // Hex / Octagon metallic relief tile
            bctx.strokeRect(x + 3, y + 3, tile - 6, tile - 6);
            bctx.fillStyle = 'rgba(255,255,255,0.035)';
            bctx.fillRect(x + 7, y + 7, tile - 14, tile - 14);
          } else {
            // Taito circuit diamond mesh
            bctx.beginPath();
            bctx.moveTo(x + tile * 0.5, y + 2);
            bctx.lineTo(x + tile - 2, y + tile * 0.5);
            bctx.lineTo(x + tile * 0.5, y + tile - 2);
            bctx.lineTo(x + 2, y + tile * 0.5);
            bctx.closePath();
            bctx.stroke();
          }
        }
      }
      // Subtle radial depth vignette
      const vig = bctx.createRadialGradient(W * 0.5, H * 0.45, 90, W * 0.5, H * 0.45, 400);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(2,6,23,0.52)');
      bctx.fillStyle = vig;
      bctx.fillRect(0, 0, W, H);
    } else {
      // Arkanoid II: Revenge of DOH — 1987 Cyber-Organic Bioluminescent Fortress Tiles!
      const palettes = [
        { bg: '#16092B', grid: '#581C87', node: '#C084FC' }, // Cyber Violet
        { bg: '#1F0718', grid: '#881337', node: '#FB7185' }, // DOH Crimson
        { bg: '#05222E', grid: '#155E75', node: '#22D3EE' }, // Bio-Teal
        { bg: '#1A1107', grid: '#78350F', node: '#FBBF24' }, // Relic Gold
      ];
      const pal = palettes[this.stageTheme % palettes.length];
      bctx.fillStyle = pal.bg;
      bctx.fillRect(0, 0, W, H);

      const step = 44;
      bctx.strokeStyle = pal.grid;
      bctx.lineWidth = 1.4;
      for (let y = 26; y < H; y += step) {
        for (let x = 26; x < W - 26; x += step) {
          // Bio-tech hexagon cell
          bctx.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
            const hx = x + step * 0.5 + Math.cos(a) * 18;
            const hy = y + step * 0.5 + Math.sin(a) * 18;
            if (k === 0) bctx.moveTo(hx, hy);
            else bctx.lineTo(hx, hy);
          }
          bctx.closePath();
          bctx.stroke();
          bctx.fillStyle = pal.node;
          bctx.globalAlpha = 0.14;
          bctx.beginPath();
          bctx.arc(x + step * 0.5, y + step * 0.5, 4, 0, Math.PI * 2);
          bctx.fill();
          bctx.globalAlpha = 1;
        }
      }
      const vig = bctx.createRadialGradient(W * 0.5, H * 0.45, 80, W * 0.5, H * 0.45, 400);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(4,2,14,0.58)');
      bctx.fillStyle = vig;
      bctx.fillRect(0, 0, W, H);
    }

    this.backdropCache = canvas;
    this.backdropCacheKey = key;
    return canvas;
  }

  private renderArenaFrame(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    if (this.variant === 'superbreakout') {
      // Crisp 1978 Atari white/silver flat segmented playfield frame!
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(14, 18, W - 28, 12); // Top wall
      ctx.fillRect(14, 18, 12, H - 18); // Left wall
      ctx.fillRect(W - 26, 18, 12, H - 18); // Right wall
      // Colored cellophane strips along side rails
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(14, 102, 12, 36);
      ctx.fillRect(W - 26, 102, 12, 36);
      ctx.fillStyle = '#22C55E';
      ctx.fillRect(14, 174, 12, 36);
      ctx.fillRect(W - 26, 174, 12, 36);
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(14, 616, 12, 22);
      ctx.fillRect(W - 26, 616, 12, 22);
      return;
    }

    const isArk2 = this.variant === 'arkanoid2';
    // Machined Metallic Pipe Frame (Silver Chrome in Ark 1, Cyber-Titanium + Neon Conduit in Ark 2!)
    const railBase = isArk2 ? '#4C1D95' : '#475569';
    const railHi = isArk2 ? '#A855F7' : '#CBD5E1';
    const railEdge = isArk2 ? '#2E1065' : '#1E293B';

    // Top, Left, Right rails
    ctx.fillStyle = railBase;
    ctx.fillRect(12, 16, W - 24, 16);
    ctx.fillRect(12, 16, 16, H - 16);
    ctx.fillRect(W - 28, 16, 16, H - 16);

    // Metallic pipe highlight strip
    ctx.fillStyle = railHi;
    ctx.fillRect(16, 19, W - 32, 4);
    ctx.fillRect(15, 20, 4, H - 20);
    ctx.fillRect(W - 25, 20, 4, H - 20);

    // Pipe joint rivets every 48px
    ctx.fillStyle = railEdge;
    for (let y = 52; y < H; y += 48) {
      ctx.fillRect(12, y, 16, 4);
      ctx.fillRect(W - 28, y, 16, 4);
    }
    for (let x = 52; x < W - 40; x += 56) {
      ctx.fillRect(x, 16, 4, 16);
    }

    // Animated Top Enemy Hatch Doors (2 hatches in Arkanoid 1, 3 neon hatches in Arkanoid 2!)
    const hatchXs = isArk2 ? [145, W * 0.5, W - 145] : [155, W - 155];
    const slide = this.hatchOpenTimer > 0 ? Math.min(14, this.hatchOpenTimer * 20) : 0;
    for (const hx of hatchXs) {
      ctx.fillStyle = '#020617';
      ctx.fillRect(hx - 24, 17, 48, 14);
      ctx.fillStyle = isArk2 ? '#EC4899' : '#38BDF8';
      ctx.fillRect(hx - 24, 18, Math.max(4, 22 - slide), 12);
      ctx.fillRect(hx + 2 + slide, 18, Math.max(4, 22 - slide), 12);
    }

    // Glowing Dimensional Warp Doors (Right only in Ark 1; BOTH Left & Right in Ark 2!)
    if (this.warpGateOpen) {
      const pulse = Math.floor(this.clock * 12) % 2 === 0 ? '#F472B6' : '#FEF08A';
      ctx.fillStyle = pulse;
      ctx.fillRect(W - 28, this.paddleY - 28, 16, 56);
      if (isArk2) {
        ctx.fillStyle = Math.floor(this.clock * 12) % 2 === 0 ? '#22D3EE' : '#FEF08A';
        ctx.fillRect(12, this.paddleY - 28, 16, 56);
      }
    }
  }

  private renderDohBoss(ctx: CanvasRenderingContext2D, W: number): void {
    const cx = W * 0.5;
    const cy = 220;
    const isArk2 = this.variant === 'arkanoid2';
    ctx.save();
    ctx.translate(cx, cy);

    // Iconic Easter Island Moai Dimensional Silhouette!
    const stone = this.dohHitFlash > 0 ? '#FEF08A' : isArk2 ? '#581C87' : '#B45309';
    const light = this.dohHitFlash > 0 ? '#FFFFFF' : isArk2 ? '#C084FC' : '#F59E0B';
    const dark = isArk2 ? '#2E1065' : '#78350F';

    ctx.fillStyle = stone;
    ctx.beginPath();
    ctx.moveTo(-46, -84);
    ctx.lineTo(46, -84);
    ctx.lineTo(62, -20);
    ctx.lineTo(54, 72);
    ctx.lineTo(28, 86);
    ctx.lineTo(-28, 86);
    ctx.lineTo(-54, 72);
    ctx.lineTo(-62, -20);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = light;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Heavy Brow Ridge & Glowing Eyes
    ctx.fillStyle = dark;
    ctx.fillRect(-44, -44, 88, 14);
    ctx.fillStyle = isArk2 ? '#22D3EE' : '#FEF08A';
    ctx.fillRect(-32, -26, 20, 12);
    ctx.fillRect(12, -26, 20, 12);

    // Sculpted Nose Bridge
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.moveTo(-8, -32);
    ctx.lineTo(8, -32);
    ctx.lineTo(14, 18);
    ctx.lineTo(-14, 18);
    ctx.closePath();
    ctx.fill();

    // Mouth (opens glowing plasma maw when firing!)
    const mouthH = this.dohMouthOpen > 0 ? 22 : 8;
    ctx.fillStyle = this.dohMouthOpen > 0 ? (isArk2 ? '#E879F9' : '#FB923C') : dark;
    ctx.fillRect(-26, 36, 52, mouthH);

    // Health bar above DOH
    const pct = Math.max(0, this.dohHp / this.dohMaxHp);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(-60, -104, 120, 10);
    ctx.fillStyle = isArk2 ? '#E879F9' : '#FACC15';
    ctx.fillRect(-58, -102, 116 * pct, 6);
    ctx.restore();
  }

  private renderSpaceEnemy(ctx: CanvasRenderingContext2D, e: SpaceEnemy): void {
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.shape === 'harmful') {
      // Arkanoid 1 Red Atom / Molecule Orb
      ctx.rotate(e.phase);
      ctx.strokeStyle = '#FCA5A5';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 6, Math.PI / 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.shape === 'pyrad') {
      // Rotating Cyan 3D Pyramid
      ctx.rotate(e.phase * 0.8);
      ctx.fillStyle = '#0284C7';
      ctx.strokeStyle = '#7DD3FC';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(13, 10);
      ctx.lineTo(-13, 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (e.shape === 'trisphere') {
      // Green Tri-Sphere Cluster
      ctx.rotate(e.phase);
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        ctx.fillStyle = '#22C55E';
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 7, Math.sin(a) * 7, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (e.shape === 'slime' || e.shape === 'minislime') {
      // Arkanoid II Pulsing Green Slime Splitter
      const r = e.shape === 'slime' ? 13 : 8;
      const sq = 1 + Math.sin(e.phase * 2) * 0.14;
      ctx.scale(sq, 2 - sq);
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#052E16';
      ctx.fillRect(-4, -3, 3, 3);
      ctx.fillRect(2, -3, 3, 3);
    } else {
      // Oppopo Cone / Bio-Drone Diamond
      ctx.rotate(e.phase);
      ctx.fillStyle = e.color;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.lineTo(12, 0);
      ctx.lineTo(0, 13);
      ctx.lineTo(-12, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  private renderPaddle(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, isShadow = false): void {
    ctx.save();
    if (isShadow) ctx.globalAlpha = 0.42;

    if (this.variant === 'superbreakout') {
      // Iconic 1978 Atari flat high-contrast cyan/white rectangular paddle!
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(cx - w * 0.5, cy - 6, w, 12);
      ctx.fillStyle = '#E0F2FE';
      ctx.fillRect(cx - w * 0.5, cy - 6, w, 3);
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(cx - w * 0.5, cy - 6, 10, 12);
      ctx.fillRect(cx + w * 0.5 - 10, cy - 6, 10, 12);
      ctx.restore();
      return;
    }

    const isArk2 = this.variant === 'arkanoid2';
    // Detailed Vaus / Vaus-II Spacecraft!
    const hullGrad = ctx.createLinearGradient(0, cy - 9, 0, cy + 9);
    if (this.laserActive) {
      hullGrad.addColorStop(0, '#FCA5A5');
      hullGrad.addColorStop(0.5, '#DC2626');
      hullGrad.addColorStop(1, '#7F1D1D');
    } else if (isArk2) {
      hullGrad.addColorStop(0, '#F5D0FE');
      hullGrad.addColorStop(0.5, '#A855F7');
      hullGrad.addColorStop(1, '#4C1D95');
    } else {
      hullGrad.addColorStop(0, '#F8FAFC');
      hullGrad.addColorStop(0.5, '#94A3B8');
      hullGrad.addColorStop(1, '#475569');
    }

    ctx.fillStyle = hullGrad;
    ctx.beginPath();
    ctx.roundRect(cx - w * 0.5, cy - 8, w, 16, 8);
    ctx.fill();

    // Glowing Side Bumper Caps (Orange in Ark 1, Cyan/Gold in Ark 2)
    ctx.fillStyle = isArk2 ? '#22D3EE' : '#F97316';
    ctx.beginPath();
    ctx.roundRect(cx - w * 0.5, cy - 8, 15, 16, [8, 2, 2, 8]);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(cx + w * 0.5 - 15, cy - 8, 15, 16, [2, 8, 8, 2]);
    ctx.fill();

    // Center Cockpit Glass
    ctx.fillStyle = this.catchActive ? '#4ADE80' : '#38BDF8';
    ctx.fillRect(cx - w * 0.22, cy - 4, w * 0.44, 8);

    // Laser Cannons mounted on top when Laser active!
    if (this.laserActive) {
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(cx - w * 0.36, cy - 13, 5, 6);
      ctx.fillRect(cx + w * 0.36 - 5, cy - 13, 5, 6);
    }

    // Vaus-II underside thruster glow
    if (isArk2) {
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(cx - w * 0.28, cy + 8, 10, 3);
      ctx.fillRect(cx + w * 0.28 - 10, cy + 8, 10, 3);
    }
    ctx.restore();
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = this.logicalWidth;
    const H = this.logicalHeight;

    // 1. Pre-baked offscreen geometric backdrop (single O(1) drawImage!)
    const bg = this.getOrBuildBackdrop(W, H);
    if (bg) {
      ctx.drawImage(bg, 0, 0);
    } else {
      ctx.fillStyle = '#070B19';
      ctx.fillRect(0, 0, W, H);
    }

    // 2. Arena Borders, Top Hatches & Dimensional Warp Gates
    this.renderArenaFrame(ctx, W, H);

    // 3. DOH Boss (Round 8, 16...)
    if (this.dohActive) {
      this.renderDohBoss(ctx, W);
    }

    // 4. Bricks (Distinct Atari flat-cellophane vs 3D Beveled Arkanoid vs Bio-Crystal Arkanoid II!)
    for (const br of this.bricks) {
      if (this.variant === 'superbreakout') {
        ctx.fillStyle = br.color;
        ctx.fillRect(br.x, br.y, br.w, br.h);
        ctx.fillStyle = br.accent;
        ctx.fillRect(br.x, br.y, br.w, 3);
      } else {
        // Drop shadow for 3D depth on Taito backdrops
        ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
        ctx.fillRect(br.x + 3, br.y + 3, br.w, br.h);

        ctx.fillStyle = br.hitFlash > 0 ? '#FFFFFF' : br.color;
        ctx.fillRect(br.x, br.y, br.w, br.h);

        // Top & left glossy 3D bevel
        ctx.fillStyle = br.accent;
        ctx.fillRect(br.x, br.y, br.w, 4);
        ctx.fillRect(br.x, br.y, 3, br.h);

        // Bottom & right bevel shade
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fillRect(br.x, br.y + br.h - 3, br.w, 3);
        ctx.fillRect(br.x + br.w - 3, br.y, 3, br.h);

        // Diagonal metallic sheen on Gold, Silver, Sliding, & Regenerating bricks!
        if (br.gold || br.maxHp > 1) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
          ctx.beginPath();
          ctx.moveTo(br.x + 8, br.y + 3);
          ctx.lineTo(br.x + 17, br.y + 3);
          ctx.lineTo(br.x + 10, br.y + br.h - 3);
          ctx.lineTo(br.x + 3, br.y + br.h - 3);
          ctx.closePath();
          ctx.fill();
        }
        // Regenerating shimmer indicator (Arkanoid II)
        if (br.regen && br.hp < br.maxHp) {
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 1.6;
          ctx.strokeRect(br.x + 1, br.y + 1, br.w - 2, br.h - 2);
        }
      }
    }

    // 5. Space Enemies (Arkanoid 1 & 2)
    for (const e of this.enemies) {
      this.renderSpaceEnemy(ctx, e);
    }

    // 6. DOH Energy Spheres
    for (const ds of this.dohShots) {
      ctx.fillStyle = ds.color;
      ctx.beginPath();
      ctx.arc(ds.x, ds.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(ds.x - 2, ds.y - 2, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 7. Spinning 3D Lettered Power Capsules
    for (const c of this.capsules) {
      const sheen = Math.sin(c.spin) * 4;
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.roundRect(c.x - 18, c.y - 8, 36, 16, 8);
      ctx.fill();
      ctx.fillStyle = c.accent;
      ctx.fillRect(c.x - 12, c.y - 5 + sheen * 0.4, 24, 3);
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(c.kind, c.x, c.y + 4);
    }

    // 8. Vaus Twin Lasers
    ctx.fillStyle = '#FEF08A';
    for (const l of this.lasers) {
      ctx.fillRect(l.x - 2.2, l.y - 11, 4.4, 18);
    }

    // 9. Energy Balls (Square Atari pixel ball vs Glossy Arkanoid Orb vs Blazing Mega-Ball!)
    for (const b of this.balls) {
      // Motion trail
      for (let t = 0; t < b.trail.length; t++) {
        const pt = b.trail[t];
        const a = ((t + 1) / (b.trail.length + 1)) * (b.mega ? 0.55 : 0.25);
        ctx.fillStyle = b.mega ? `rgba(217, 70, 239, ${a.toFixed(2)})` : `rgba(56, 189, 248, ${a.toFixed(2)})`;
        if (this.variant === 'superbreakout') {
          ctx.fillRect(pt.x - 4, pt.y - 4, 8, 8);
        } else {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, b.mega ? 7 : 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (this.variant === 'superbreakout') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(b.x - 5, b.y - 5, 10, 10);
      } else {
        ctx.fillStyle = b.mega ? '#F0ABFC' : '#38BDF8';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.mega ? 10 : 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = b.mega ? '#FEF08A' : '#FFFFFF';
        ctx.beginPath();
        ctx.arc(b.x - 1.5, b.y - 1.5, b.mega ? 5.5 : 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 10. Paddle(s) — Single, Double-Stacked, Twin Vaus, or Illusion Shadow!
    for (const seg of this.getPaddleSegments()) {
      this.renderPaddle(ctx, seg.cx, seg.cy, seg.w, seg.isShadow);
    }

    // Subtle footer mode hint for Super Breakout
    if (this.variant === 'superbreakout') {
      ctx.font = '800 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText(`ATARI 1978 · MODE: ${this.sbMode.toUpperCase()}  (PRESS R TO SWITCH CAVITY / DOUBLE / PROGRESSIVE)`, W * 0.5, H - 10);
    }

    renderParticlesAndPopups(ctx, this.particles, this.popups);

    if (this.screenFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${(this.screenFlash * 0.4).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (this.phase === 'TITLE') {
      ctx.fillStyle = 'rgba(7, 11, 25, 0.8)';
      ctx.fillRect(0, H * 0.35, W, 122);
      ctx.textAlign = 'center';
      ctx.font = '900 30px "JetBrains Mono", monospace';
      ctx.fillStyle =
        this.variant === 'superbreakout' ? '#F59E0B' : this.variant === 'arkanoid' ? '#38BDF8' : '#E879F9';
      ctx.fillText(
        this.variant === 'superbreakout'
          ? 'SUPER BREAKOUT · 1978'
          : this.variant === 'arkanoid'
            ? 'ARKANOID · 1986'
            : 'ARKANOID II: REVENGE OF DOH',
        W * 0.5,
        H * 0.35 + 48
      );
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillStyle = '#E2E8F0';
      const sub: Record<BreakerVariant, string> = {
        superbreakout: '3 AUTHENTIC MODES [R]: CAVITY 3-BALL · DOUBLE PADDLE · PROGRESSIVE WALL',
        arkanoid: '7 CLASSIC TAITO STAGES + DOH BOSS · E/L/C/D/S/B/P CAPSULES & SPACE ENEMIES',
        arkanoid2: 'MEGA-BALL PIERCER · TWIN VAUS · ILLUSION SHADOW · SLIDING & REGEN BRICKS',
      };
      ctx.fillText(sub[this.variant], W * 0.5, H * 0.35 + 84);
    }
    if (visualMode === 'crt') renderCrtOverlay(ctx, W, H);
  }
}

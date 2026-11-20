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
  stepParticlesAndPopups,
} from './classicArcadeInterface';
import { MeltOVisionBuffer } from './tempestGeometry';

// ============================================================================
// BREAKOUT 2016 EVO — Modern Llamasoft Melt-O-Vision × Tempest × Arkanoid × Warlords
// - Real-time offscreen Melt-O-Vision feedback trails (liquid-neon zoom & swirl)
// - Dynamic Tempest 3D rotating perspective vector web backdrop
// - Warlords 4-Corner Citadel Sieges (AI Rival Shields + Destructible King Cores!)
// - Arkanoid Architectural Crystal Fortresses + Sliding Gates + Regenerating Prisms
// - Warlords Catch & Charged Fireball Sling (hold Space/Click to supercharge!)
// - Tempest Superzapper Lightning Pulse (Shift/X) + Phase Parry Boost (Up/W)
// - Autonomous Tempest A.I. Droid Wingman + 9 Neon Evo Capsules + Evolved DOH-Pulsar Boss
// ============================================================================

const LOGICAL_W = 760;
const LOGICAL_H = 760;
const CX = LOGICAL_W * 0.5;
const CY = LOGICAL_H * 0.48;
const ARENA_PAD = 34;

type EvoBrickKind = 'prism' | 'armored' | 'gold' | 'regen' | 'sliding' | 'castle' | 'explosive' | 'portal';

interface EvoBrick {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  hue: number;
  kind: EvoBrickKind;
  castleOwner?: number; // 0=NW, 1=NE, 2=SW, 3=SE (Warlords Citadels)
  regenTimer: number;
  moveVx: number;
  moveMinX: number;
  moveMaxX: number;
  hitFlash: number;
}

interface EvoBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
  stuck: boolean;
  stuckOffset: number;
  charge: number; // 0..1 Warlords Catch-and-Sling Fireball charge
  fireballTimer: number; // Piercing Mega-Fireball duration
  hyperSpin: number; // Phase-Parry 2x damage spin boost
  hue: number;
  trail: Array<{ x: number; y: number }>;
}

type EvoCapsuleKind = 'M' | 'D' | 'L' | 'E' | 'C' | 'A' | 'Z' | 'S' | 'W';

interface EvoCapsule {
  x: number;
  y: number;
  vy: number;
  kind: EvoCapsuleKind;
  color: string;
  label: string;
  spin: number;
}

interface EvoEnemy {
  id: number;
  kind: 'flipper' | 'drone' | 'fuseball';
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  phase: number;
  hue: number;
}

interface WarlordKing {
  id: number;
  corner: 'NW' | 'NE' | 'TOP';
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  shieldAngle: number;
  shieldMinAngle: number;
  shieldMaxAngle: number;
  shieldRadius: number;
  shieldDir: number;
  color: string;
  hitFlash: number;
}

interface PixelFountain {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}

interface ShockRing {
  x: number;
  y: number;
  r: number;
  maxR: number;
  color: string;
  life: number;
  maxLife: number;
}

interface StageBlueprint {
  name: string;
  subtitle: string;
  mode: 'vortex' | 'warlords' | 'tempestRing' | 'citadelDual' | 'labyrinth' | 'bossDoh';
  webSides: number;
  baseHue: number;
}

const EVO_STAGES: StageBlueprint[] = [
  {
    name: 'STAGE 1 · NEON VORTEX',
    subtitle: 'MELT-O-VISION PRISM MATRIX · TEMPEST FLIPPERS',
    mode: 'vortex',
    webSides: 8,
    baseHue: 195,
  },
  {
    name: 'STAGE 2 · WARLORDS CITADEL',
    subtitle: 'SMASH 3 RIVAL CASTLE WALLS & DESTROY THEIR KINGS!',
    mode: 'warlords',
    webSides: 4,
    baseHue: 35,
  },
  {
    name: 'STAGE 3 · TEMPEST RING REACTOR',
    subtitle: 'BREACH THE CONCENTRIC PRISM CORE & FUSEBALLS',
    mode: 'tempestRing',
    webSides: 12,
    baseHue: 285,
  },
  {
    name: 'STAGE 4 · TWIN CITADEL SIEGE',
    subtitle: 'DUAL WARLORD FORTIFICATIONS · SLIDING ENERGY GATES',
    mode: 'citadelDual',
    webSides: 6,
    baseHue: 155,
  },
  {
    name: 'STAGE 5 · MELT-O-VISION LABYRINTH',
    subtitle: 'EXPLOSIVE NOVA CELLS · REGENERATING CRYSTAL WALLS',
    mode: 'labyrinth',
    webSides: 10,
    baseHue: 325,
  },
  {
    name: 'STAGE 6 · DOH-PULSAR OVERLORD',
    subtitle: 'HYBRID TEMPEST-ARKANOID CITADEL BOSS · UNLEASH EVERYTHING!',
    mode: 'bossDoh',
    webSides: 16,
    baseHue: 10,
  },
];

const CAPSULE_META: Record<EvoCapsuleKind, { color: string; label: string }> = {
  M: { color: '#F97316', label: 'MEGA FIREBALL' },
  D: { color: '#22D3EE', label: 'MULTI-BALL 3X' },
  L: { color: '#EF4444', label: 'PARTICLE LASER' },
  E: { color: '#3B82F6', label: 'EXPAND AEGIS' },
  C: { color: '#22C55E', label: 'WARLORD CATCH' },
  A: { color: '#E879F9', label: 'TEMPEST A.I. DROID' },
  Z: { color: '#FACC15', label: '+1 SUPERZAPPER' },
  S: { color: '#38BDF8', label: 'SAFETY BARRIER' },
  W: { color: '#EC4899', label: 'HYPER WARP GATE' },
};

export class Breakout2016EvoGame implements ArcadeGameInstance {
  public readonly logicalWidth = LOGICAL_W;
  public readonly logicalHeight = LOGICAL_H;
  public readonly supportsPointerAim = true;
  public readonly primaryActionLabel = 'Catch / Sling / Laser';
  public readonly secondaryActionLabel = 'Superzapper';

  private readonly storageKey = 'breakout2016evo_hd_highscore_v1';
  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();

  private score = 0;
  private highScore = 0;
  private nextExtraLife = 35000;
  private level = 1;
  private lives = 3;
  private clock = 0;
  private stateTimer = 0;
  private nextId = 1;

  // Player Cyber-Vaus Paddle + Tempest/Warlords abilities
  private paddleX = CX;
  private paddleW = 122;
  private readonly paddleY = LOGICAL_H - 68;
  private parryTimer = 0;
  private parryCd = 0;
  private laserActive = false;
  private catchActive = false;
  private warpGateOpen = false;
  private safetyBarrierHp = 0;
  private fireCd = 0;

  // Tempest Superzapper & Combo Multiplier
  private zapperCharges = 1;
  private zapperGauge = 0; // 0..100 fills via combos!
  private zapperFlash = 0;
  private combo = 0;
  private comboTimer = 0;
  private multiplier = 1;

  // Tempest 2000 Autonomous A.I. Droid Wingman
  private droidTimer = 0;
  private droidAngle = 0;
  private droidX = CX;
  private droidY = CY;
  private droidFireCd = 0;

  // Warlords Rival Kings & Hybrid DOH-Pulsar Boss
  private kings: WarlordKing[] = [];
  private bossActive = false;
  private bossX = CX;
  private bossY = 232;
  private bossHp = 28;
  private bossMaxHp = 28;
  private bossHitFlash = 0;
  private bossFireCd = 1.6;
  private bossShieldAngle = 0;
  private bossShots: Array<{ x: number; y: number; vx: number; vy: number; color: string }> = [];

  // Entities & VFX
  private bricks: EvoBrick[] = [];
  private balls: EvoBall[] = [];
  private capsules: EvoCapsule[] = [];
  private lasers: Array<{ x: number; y: number; vx: number; vy: number; color: string }> = [];
  private enemies: EvoEnemy[] = [];
  private enemySpawnCd = 4.0;

  private fountains: PixelFountain[] = [];
  private shockRings: ShockRing[] = [];
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];
  private calloutText = '';
  private calloutTimer = 0;
  private calloutColor = '#FEF08A';
  private screenShake = 0;
  private screenFlash = 0;

  // Real-Time Llamasoft Melt-O-Vision Offscreen Feedback Buffer!
  private meltBuffer = new MeltOVisionBuffer(380, 380);
  private stageDef: StageBlueprint = EVO_STAGES[0];

  constructor() {
    this.highScore = readHighScore(this.storageKey);
    this.setupStage(1);
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public startNewGame(): void {
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.nextExtraLife = 35000;
    this.level = 1;
    this.lives = 3;
    this.zapperCharges = 1;
    this.zapperGauge = 0;
    this.meltBuffer.clear();
    this.phase = 'READY';
    this.stateTimer = 0.95;
    this.setupStage(1);
    this.triggerCallout('BREAKOUT 2016 EVO!', '#22D3EE');
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.setupStage(1);
  }

  private triggerCallout(text: string, color = '#FEF08A'): void {
    this.calloutText = text;
    this.calloutColor = color;
    this.calloutTimer = 1.65;
  }

  private addScore(pts: number, x?: number, y?: number, label?: string): void {
    const earned = Math.round(pts * this.multiplier);
    this.score += earned;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(this.storageKey, this.highScore);
    }
    if (this.score >= this.nextExtraLife) {
      this.lives += 1;
      this.nextExtraLife += 45000;
      arcadeAudio.playExtraLife();
      this.triggerCallout('EXTRA AEGIS 1UP!', '#4ADE80');
    }
    if (x !== undefined && y !== undefined) {
      this.popups.push({
        x,
        y,
        text: label ? `${label} +${earned}` : `+${earned}`,
        color: this.multiplier >= 3 ? '#F472B6' : '#FEF08A',
        life: 0.85,
        maxLife: 0.85,
      });
    }
  }

  private bumpCombo(x: number, y: number): void {
    this.combo += 1;
    this.comboTimer = 2.6;
    const prevMult = this.multiplier;
    this.multiplier = Math.min(8, 1 + Math.floor(this.combo / 5));
    if (this.multiplier > prevMult && this.phase === 'PLAYING') {
      this.triggerCallout(`${this.multiplier}X MELT COMBO!`, '#F472B6');
      this.spawnShockRing(x, y, 120, '#F472B6');
    }
    this.zapperGauge = Math.min(100, this.zapperGauge + 4.5);
    if (this.zapperGauge >= 100 && this.zapperCharges < 3) {
      this.zapperGauge = 0;
      this.zapperCharges += 1;
      arcadeAudio.playPowerUp();
      this.triggerCallout('SUPERZAPPER CHARGED!', '#FACC15');
    }
  }

  private spawnFountain(x: number, y: number, hue: number, count = 14): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 75 + Math.random() * 240;
      this.fountains.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 40,
        color: `hsl(${(hue + (Math.random() - 0.5) * 45 + 360) % 360}, 100%, 64%)`,
        life: 0.5 + Math.random() * 0.45,
        maxLife: 0.95,
        size: 2.6 + Math.random() * 2.8,
      });
    }
  }

  private spawnShockRing(x: number, y: number, maxR: number, color: string): void {
    this.shockRings.push({ x, y, r: 10, maxR, color, life: 0.42, maxLife: 0.42 });
  }

  private makeBall(x: number, y: number, vx: number, vy: number, stuck = false): EvoBall {
    return {
      x,
      y,
      vx,
      vy,
      stuck,
      stuckOffset: 0,
      charge: 0,
      fireballTimer: 0,
      hyperSpin: 0,
      hue: this.stageDef.baseHue,
      trail: [],
    };
  }

  private addBrick(
    x: number,
    y: number,
    w: number,
    h: number,
    kind: EvoBrickKind,
    hue: number,
    opts?: Partial<EvoBrick>
  ): void {
    const hp =
      kind === 'gold'
        ? 999
        : kind === 'armored' || kind === 'regen' || kind === 'sliding'
          ? 2 + Math.floor(this.level / 4)
          : kind === 'castle'
            ? 2
            : 1;
    this.bricks.push({
      id: this.nextId++,
      x,
      y,
      w,
      h,
      hp,
      maxHp: hp,
      hue,
      kind,
      regenTimer: 0,
      moveVx: 0,
      moveMinX: ARENA_PAD + 10,
      moveMaxX: LOGICAL_W - ARENA_PAD - 10 - w,
      hitFlash: 0,
      ...opts,
    });
  }

  private setupStage(lvl: number): void {
    this.stageDef = EVO_STAGES[(lvl - 1) % EVO_STAGES.length];
    this.paddleX = CX;
    this.paddleW = 122;
    this.laserActive = false;
    this.catchActive = false;
    this.warpGateOpen = false;
    this.safetyBarrierHp = lvl === 1 ? 2 : 1; // Modern Evo forgiving energy shield!
    this.droidTimer = 0;
    this.zapperCharges = Math.max(1, this.zapperCharges);
    this.combo = 0;
    this.multiplier = 1;
    this.bricks = [];
    this.kings = [];
    this.bossActive = false;
    this.bossShots = [];
    this.capsules = [];
    this.lasers = [];
    this.enemies = [];
    this.enemySpawnCd = 3.6;

    this.balls = [this.makeBall(this.paddleX, this.paddleY - 16, 235, -395, true)];

    const bw = 54;
    const bh = 24;
    const cols = 11;
    const ox = (LOGICAL_W - cols * bw) * 0.5;
    const oy = 96;

    if (this.stageDef.mode === 'vortex') {
      // Stage 1: Glowing Tempest Chevron Prism Fortress + Explosive Nova Cores!
      const rows = [
        'AA..AAA..AA',
        'PP.PPPPP.PP',
        'P.PPENEPP.P',
        'CC.CCCCC.CC',
        'GG.GAAAG.GG',
        '..YY...YY..',
      ];
      rows.forEach((rowStr, r) => {
        for (let c = 0; c < cols; c++) {
          const ch = rowStr[c];
          if (!ch || ch === '.') continue;
          const kind: EvoBrickKind = ch === 'A' ? 'armored' : ch === 'E' || ch === 'N' ? 'explosive' : 'prism';
          const hue = (180 + r * 28 + c * 8) % 360;
          this.addBrick(ox + c * bw + 2, oy + r * bh + 2, bw - 4, bh - 4, kind, hue);
        }
      });
    } else if (this.stageDef.mode === 'warlords') {
      // Stage 2: Authentic WARLORDS 3-Citadel Siege! 3 Rival Kings behind fortified brick castles + patrolling AI Shield Paddles!
      const citadels: Array<{ corner: WarlordKing['corner']; x: number; y: number; color: string; minA: number; maxA: number; hue: number }> = [
        { corner: 'NW', x: 112, y: 128, color: '#EF4444', minA: 0.12, maxA: Math.PI * 0.48, hue: 5 },
        { corner: 'TOP', x: CX, y: 116, color: '#FACC15', minA: Math.PI * 0.2, maxA: Math.PI * 0.8, hue: 46 },
        { corner: 'NE', x: LOGICAL_W - 112, y: 128, color: '#A855F7', minA: Math.PI * 0.52, maxA: Math.PI * 0.88, hue: 280 },
      ];
      citadels.forEach((ci, idx) => {
        this.kings.push({
          id: idx + 1,
          corner: ci.corner,
          x: ci.x,
          y: ci.y,
          hp: 3,
          maxHp: 3,
          alive: true,
          shieldAngle: (ci.minA + ci.maxA) * 0.5,
          shieldMinAngle: ci.minA,
          shieldMaxAngle: ci.maxA,
          shieldRadius: 96,
          shieldDir: idx % 2 === 0 ? 1 : -1,
          color: ci.color,
          hitFlash: 0,
        });
        // Build concentric Warlords Castle Wall bricks shielding each King!
        for (let ring = 0; ring < 2; ring++) {
          const rad = 50 + ring * 24;
          const segs = ring === 0 ? 5 : 7;
          for (let s = 0; s < segs; s++) {
            const ang = ci.minA + ((s + 0.5) / segs) * (ci.maxA - ci.minA);
            const bx = ci.x + Math.cos(ang) * rad - 16;
            const by = ci.y + Math.sin(ang) * rad - 10;
            this.addBrick(bx, by, 32, 20, ring === 0 ? 'castle' : 'prism', ci.hue + ring * 25, { castleOwner: idx });
          }
        }
      });
      // Center explosive crystal barrier between citadels
      for (let c = 3; c <= 7; c++) {
        this.addBrick(ox + c * bw + 2, 310, bw - 4, bh - 4, c === 5 ? 'explosive' : 'prism', 195 + c * 15);
      }
    } else if (this.stageDef.mode === 'tempestRing') {
      // Stage 3: Concentric Tempest Radial Crystal Ring around an Explosive Reactor!
      const ringDefs = [
        { r: 62, count: 8, kind: 'explosive' as EvoBrickKind, hue: 330 },
        { r: 108, count: 14, kind: 'prism' as EvoBrickKind, hue: 270 },
        { r: 154, count: 18, kind: 'armored' as EvoBrickKind, hue: 190 },
      ];
      const rcx = CX;
      const rcy = 278;
      for (const rd of ringDefs) {
        for (let k = 0; k < rd.count; k++) {
          const a = (k / rd.count) * Math.PI * 2;
          const bx = rcx + Math.cos(a) * rd.r - 20;
          const by = rcy + Math.sin(a) * rd.r - 11;
          this.addBrick(bx, by, 40, 22, rd.kind, (rd.hue + k * 14) % 360);
        }
      }
    } else if (this.stageDef.mode === 'citadelDual') {
      // Stage 4: Twin Warlords Side Castles + Arkanoid II Sliding Energy Gates!
      const sideKings = [
        { corner: 'NW' as const, x: 118, y: 150, color: '#22D3EE', minA: -0.15, maxA: Math.PI * 0.45, hue: 190 },
        { corner: 'NE' as const, x: LOGICAL_W - 118, y: 150, color: '#F472B6', minA: Math.PI * 0.55, maxA: Math.PI * 1.15, hue: 325 },
      ];
      sideKings.forEach((ci, idx) => {
        this.kings.push({
          id: idx + 1,
          corner: ci.corner,
          x: ci.x,
          y: ci.y,
          hp: 4,
          maxHp: 4,
          alive: true,
          shieldAngle: (ci.minA + ci.maxA) * 0.5,
          shieldMinAngle: ci.minA,
          shieldMaxAngle: ci.maxA,
          shieldRadius: 102,
          shieldDir: idx === 0 ? 1 : -1,
          color: ci.color,
          hitFlash: 0,
        });
        for (let s = 0; s < 6; s++) {
          const ang = ci.minA + ((s + 0.5) / 6) * (ci.maxA - ci.minA);
          this.addBrick(ci.x + Math.cos(ang) * 62 - 17, ci.y + Math.sin(ang) * 62 - 10, 34, 20, 'castle', ci.hue, { castleOwner: idx });
        }
      });
      // Center fortress columns + 2 horizontal Sliding Energy Gates!
      for (let r = 0; r < 5; r++) {
        for (let c = 4; c <= 6; c++) {
          this.addBrick(ox + c * bw + 2, 118 + r * 28, bw - 4, 22, r === 2 ? 'explosive' : 'regen', 140 + r * 24);
        }
      }
      this.addBrick(190, 326, 78, 22, 'sliding', 175, { moveVx: 110 });
      this.addBrick(490, 366, 78, 22, 'sliding', 305, { moveVx: -110 });
    } else if (this.stageDef.mode === 'labyrinth') {
      // Stage 5: Melt-O-Vision Crystal Labyrinth with Gold Channels, Explosive Novas & Regenerating Prisms!
      const rows = [
        'G.RRR.RRR.G',
        'G.P.E.E.P.G',
        'G.PPKPKPP.G',
        '..GG...GG..',
        'CC.E.C.E.CC',
        'KK.CCCCC.KK',
        'YYYYYYYYYYY',
      ];
      rows.forEach((rowStr, r) => {
        for (let c = 0; c < cols; c++) {
          const ch = rowStr[c];
          if (!ch || ch === '.') continue;
          const kind: EvoBrickKind =
            ch === 'G' ? 'gold' : ch === 'E' ? 'explosive' : ch === 'K' ? 'regen' : 'prism';
          this.addBrick(ox + c * bw + 2, oy + r * bh + 2, bw - 4, bh - 4, kind, (300 + r * 32 + c * 12) % 360);
        }
      });
    } else {
      // Stage 6: EVOLVED DOH-PULSAR OVERLORD BOSS!
      this.bossActive = true;
      this.bossMaxHp = 26 + Math.floor(lvl / 6) * 8;
      this.bossHp = this.bossMaxHp;
      this.bossX = CX;
      this.bossY = 228;
      this.bossFireCd = 1.4;
      // Escort rotating crystal bumper blocks flanking the Boss
      for (let c = 0; c < 4; c++) {
        this.addBrick(84 + c * 56, 360, 48, 20, c % 2 === 0 ? 'explosive' : 'regen', 15 + c * 35);
        this.addBrick(LOGICAL_W - 132 - c * 56, 360, 48, 20, c % 2 === 0 ? 'explosive' : 'regen', 195 + c * 35);
      }
    }
  }

  private maybeDropCapsule(x: number, y: number, guaranteed = false): void {
    if (!guaranteed && Math.random() > 0.24) return;
    if (this.capsules.length >= 3) return;
    const pool: EvoCapsuleKind[] = ['M', 'D', 'L', 'E', 'C', 'A', 'Z', 'S', 'W'];
    const kind = pool[Math.floor(Math.random() * pool.length)];
    const meta = CAPSULE_META[kind];
    this.capsules.push({ x, y, vy: 158, kind, color: meta.color, label: meta.label, spin: 0 });
  }

  private triggerSuperzapper(attract: boolean): void {
    if (this.zapperCharges <= 0 || attract) return;
    this.zapperCharges -= 1;
    this.zapperFlash = 1.0;
    this.screenShake = 0.45;
    this.screenFlash = 0.6;
    arcadeAudio.playExplosion(true);
    this.triggerCallout('SUPERZAPPER OVERLOAD!!', '#FACC15');
    this.spawnShockRing(CX, CY, 420, '#FACC15');
    this.spawnShockRing(CX, CY, 340, '#22D3EE');

    // Vaporize all roaming Tempest/Arkanoid enemies & enemy shots!
    for (const e of this.enemies) {
      this.spawnFountain(e.x, e.y, e.hue, 18);
      this.addScore(400, e.x, e.y, 'ZAPPED');
    }
    this.enemies = [];
    this.bossShots = [];

    // Crack bricks & damage Kings / Boss!
    for (let bi = this.bricks.length - 1; bi >= 0; bi--) {
      const br = this.bricks[bi];
      if (br.kind === 'gold') continue;
      if (Math.random() < 0.45 || br.hp <= 1) {
        br.hp -= 1;
        br.hitFlash = 1;
        if (br.hp <= 0) {
          this.spawnFountain(br.x + br.w * 0.5, br.y + br.h * 0.5, br.hue, 8);
          this.addScore(100);
          this.bricks.splice(bi, 1);
        }
      }
    }
    if (this.bossActive) {
      this.damageBoss(4, this.bossX, this.bossY, false);
    }
  }

  private detonateExplosiveBrick(cx: number, cy: number, attract: boolean): void {
    this.screenShake = Math.max(this.screenShake, 0.25);
    this.spawnShockRing(cx, cy, 130, '#F97316');
    this.spawnFountain(cx, cy, 25, 22);
    if (!attract) arcadeAudio.playExplosion(false);
    for (let i = this.bricks.length - 1; i >= 0; i--) {
      const nb = this.bricks[i];
      if (nb.kind === 'gold') continue;
      const bx = nb.x + nb.w * 0.5;
      const by = nb.y + nb.h * 0.5;
      if (Math.hypot(bx - cx, by - cy) < 105) {
        nb.hp -= 2;
        nb.hitFlash = 1;
        if (nb.hp <= 0) {
          this.spawnFountain(bx, by, nb.hue, 8);
          if (!attract) this.addScore(120, bx, by);
          this.bricks.splice(i, 1);
        }
      }
    }
  }

  private damageBoss(dmg: number, x: number, y: number, attract: boolean): void {
    this.bossHp -= dmg;
    this.bossHitFlash = 1;
    this.spawnFountain(x, y, 35, 16);
    if (!attract) {
      arcadeAudio.playExplosion(false);
      this.addScore(300, x, y);
    }
    if (this.bossHp <= 0) {
      this.bossActive = false;
      this.bossShots = [];
      this.screenFlash = 0.75;
      this.screenShake = 0.6;
      this.spawnShockRing(this.bossX, this.bossY, 340, '#FACC15');
      this.spawnFountain(this.bossX, this.bossY, 45, 56);
      if (!attract) {
        arcadeAudio.playStageClear();
        this.addScore(25000, this.bossX, this.bossY, 'OVERLORD VANQUISHED!');
        this.triggerCallout('EVO VICTORY! NEXT LOOP!', '#4ADE80');
        this.phase = 'STAGE_CLEAR';
        this.stateTimer = 1.9;
      }
    }
  }

  private loseLife(): void {
    this.lives -= 1;
    this.laserActive = false;
    this.catchActive = false;
    this.paddleW = 122;
    this.combo = 0;
    this.multiplier = 1;
    this.screenShake = 0.4;
    this.screenFlash = 0.4;
    arcadeAudio.playDeath();
    if (this.lives <= 0) {
      this.phase = 'GAME_OVER';
    } else {
      this.balls = [this.makeBall(this.paddleX, this.paddleY - 16, 235, -395, true)];
    }
  }

  public step(dt: number): void {
    this.clock += dt;
    this.zapperFlash = Math.max(0, this.zapperFlash - dt * 2.2);
    this.screenShake = Math.max(0, this.screenShake - dt * 2.4);
    this.screenFlash = Math.max(0, this.screenFlash - dt * 2.4);
    this.calloutTimer = Math.max(0, this.calloutTimer - dt);
    this.parryTimer = Math.max(0, this.parryTimer - dt);
    this.parryCd = Math.max(0, this.parryCd - dt);
    this.bossHitFlash = Math.max(0, this.bossHitFlash - dt * 4);
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.multiplier = 1;
      }
    }

    stepParticlesAndPopups(this.particles, this.popups, dt);

    // Update Melt-O-Vision Pixel Fountains & Shock Rings
    for (let i = this.fountains.length - 1; i >= 0; i--) {
      const f = this.fountains[i];
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vy += 320 * dt; // Gravity drip like Jaguar Tempest 2000!
      f.life -= dt;
      if (f.life <= 0) this.fountains.splice(i, 1);
    }
    for (let i = this.shockRings.length - 1; i >= 0; i--) {
      const sr = this.shockRings[i];
      sr.life -= dt;
      sr.r = sr.maxR * (1 - sr.life / sr.maxLife);
      if (sr.life <= 0) this.shockRings.splice(i, 1);
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
        this.stateTimer = 0.95;
        this.setupStage(this.level);
        this.triggerCallout(this.stageDef.name, '#38BDF8');
      }
      return;
    }

    const attract = this.phase === 'TITLE';
    this.fireCd = Math.max(0, this.fireCd - dt);

    // Paddle Control
    if (attract) {
      const targetX = this.balls[0]?.x ?? CX;
      this.paddleX += (targetX - this.paddleX) * Math.min(1, dt * 9);
    } else if (this.input.pointerActive) {
      this.paddleX = this.input.pointerX;
    } else {
      const spd = 560;
      if (this.input.left) this.paddleX -= spd * dt;
      if (this.input.right) this.paddleX += spd * dt;
    }

    const minX = ARENA_PAD + this.paddleW * 0.5;
    const maxX = LOGICAL_W - ARENA_PAD - this.paddleW * 0.5;

    // Hyper-Warp Gate exit!
    if (!attract && this.warpGateOpen && (this.paddleX >= maxX - 3 || this.paddleX <= minX + 3)) {
      arcadeAudio.playStageClear();
      this.screenFlash = 0.5;
      this.addScore(10000, this.paddleX, this.paddleY - 26, 'HYPER WARP!');
      this.triggerCallout('WARP JUMP +10,000!', '#EC4899');
      this.phase = 'STAGE_CLEAR';
      this.stateTimer = 1.4;
      return;
    }
    this.paddleX = Math.max(minX, Math.min(maxX, this.paddleX));

    // Phase-Parry Boost (Up / W)
    if (!attract && this.input.up && this.parryCd <= 0) {
      this.parryTimer = 0.24;
      this.parryCd = 0.9;
      this.spawnShockRing(this.paddleX, this.paddleY, 64, '#22D3EE');
    }

    // Tempest Superzapper (Shift / X)
    if (!attract && this.input.secondaryJustPressed) {
      this.triggerSuperzapper(false);
    }

    // Warlords Catch-and-Sling Fireball Charging & Launch / Particle Lasers!
    const hasStuck = this.balls.some((b) => b.stuck);
    if (hasStuck) {
      for (const b of this.balls) {
        if (!b.stuck) continue;
        if (!attract && this.input.fire) {
          // Hold Fire while ball is caught to charge Warlords Fireball!
          b.charge = Math.min(1, b.charge + dt * 1.15);
        } else if (attract || this.input.fireJustPressed || b.charge > 0.08) {
          b.stuck = false;
          if (b.charge >= 0.72) {
            b.fireballTimer = 4.5;
            this.triggerCallout('WARLORD FIREBALL SLING!', '#F97316');
            this.spawnShockRing(b.x, b.y, 95, '#F97316');
          }
          const boost = 1 + b.charge * 0.35;
          const speed = 440 * boost;
          const ang = -Math.PI * 0.5 + (b.stuckOffset / (this.paddleW * 0.5)) * 0.75;
          b.vx = Math.cos(ang) * speed;
          b.vy = Math.sin(ang) * speed;
          b.charge = 0;
          if (!attract) arcadeAudio.playPaddleBounce();
        }
      }
    } else if (!attract && this.laserActive && (this.input.fire || this.input.fireJustPressed) && this.fireCd <= 0) {
      this.fireCd = 0.18;
      this.lasers.push({ x: this.paddleX - this.paddleW * 0.35, y: this.paddleY - 16, vx: 0, vy: -720, color: '#FACC15' });
      this.lasers.push({ x: this.paddleX + this.paddleW * 0.35, y: this.paddleY - 16, vx: 0, vy: -720, color: '#FACC15' });
      arcadeAudio.playLaser();
    }

    // Update Tempest A.I. Droid Wingman
    if (this.droidTimer > 0) {
      this.droidTimer -= dt;
      this.droidAngle += dt * 2.2;
      this.droidX = CX + Math.cos(this.droidAngle) * 230;
      this.droidY = 470 + Math.sin(this.droidAngle * 1.6) * 65;
      this.droidFireCd -= dt;
      if (this.droidFireCd <= 0) {
        this.droidFireCd = 0.42;
        this.lasers.push({ x: this.droidX, y: this.droidY - 12, vx: 0, vy: -640, color: '#E879F9' });
      }
    }

    // Update Bricks (Sliding gates & Regenerating prism bricks)
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
      if (br.kind === 'regen' && br.hp > 0 && br.hp < br.maxHp) {
        br.regenTimer += dt;
        if (br.regenTimer >= 5.2) {
          br.hp = Math.min(br.maxHp, br.hp + 1);
          br.regenTimer = 0;
          br.hitFlash = 1;
        }
      }
    }

    // Update Warlords Rival Kings & Patrolling AI Shield Paddles!
    for (const k of this.kings) {
      if (!k.alive) continue;
      k.hitFlash = Math.max(0, k.hitFlash - dt * 5);
      // AI shield actively tracks nearest ball if close, else patrols castle arc
      const b0 = this.balls[0];
      if (b0 && Math.hypot(b0.x - k.x, b0.y - k.y) < 220) {
        const targetAng = Math.atan2(b0.y - k.y, b0.x - k.x);
        const clamped = Math.max(k.shieldMinAngle, Math.min(k.shieldMaxAngle, targetAng));
        k.shieldAngle += (clamped - k.shieldAngle) * Math.min(1, dt * 4.5);
      } else {
        k.shieldAngle += k.shieldDir * 1.15 * dt;
        if (k.shieldAngle >= k.shieldMaxAngle) {
          k.shieldAngle = k.shieldMaxAngle;
          k.shieldDir = -1;
        } else if (k.shieldAngle <= k.shieldMinAngle) {
          k.shieldAngle = k.shieldMinAngle;
          k.shieldDir = 1;
        }
      }
    }

    // Update Evolved DOH-Pulsar Boss
    if (this.bossActive) {
      this.bossShieldAngle += dt * 1.5;
      this.bossX = CX + Math.sin(this.clock * 0.9) * 110;
      this.bossFireCd -= dt;
      if (this.bossFireCd <= 0 && !attract) {
        this.bossFireCd = 1.45;
        const base = Math.atan2(this.paddleY - this.bossY, this.paddleX - this.bossX);
        for (const off of [-0.28, 0, 0.28]) {
          this.bossShots.push({
            x: this.bossX,
            y: this.bossY + 34,
            vx: Math.cos(base + off) * 240,
            vy: Math.sin(base + off) * 240,
            color: '#F472B6',
          });
        }
      }
      for (let i = this.bossShots.length - 1; i >= 0; i--) {
        const bs = this.bossShots[i];
        bs.x += bs.vx * dt;
        bs.y += bs.vy * dt;
        if (bs.y > LOGICAL_H + 20 || bs.x < 20 || bs.x > LOGICAL_W - 20) {
          this.bossShots.splice(i, 1);
          continue;
        }
        if (!attract && Math.abs(bs.x - this.paddleX) < this.paddleW * 0.48 && Math.abs(bs.y - this.paddleY) < 16) {
          this.bossShots.splice(i, 1);
          if (this.parryTimer > 0) {
            this.spawnShockRing(bs.x, bs.y, 70, '#22D3EE');
            this.addScore(350, bs.x, bs.y, 'PARRIED!');
            arcadeAudio.playPaddleBounce();
          } else {
            this.loseLife();
            break;
          }
        }
      }
    }

    // Spawn Tempest Flippers & Arkanoid Crystal Drones
    this.enemySpawnCd -= dt;
    if (this.enemySpawnCd <= 0 && this.enemies.length < 3 && !this.bossActive) {
      this.enemySpawnCd = Math.max(2.6, 4.6 - this.level * 0.2);
      const kinds: EvoEnemy['kind'][] = ['flipper', 'drone', 'fuseball'];
      const kind = kinds[Math.floor(Math.random() * kinds.length)];
      this.enemies.push({
        id: this.nextId++,
        kind,
        x: 110 + Math.random() * (LOGICAL_W - 220),
        y: 52,
        vx: (Math.random() < 0.5 ? -1 : 1) * 78,
        vy: 56 + this.level * 4,
        hp: 1,
        phase: Math.random() * 6,
        hue: kind === 'flipper' ? 320 : kind === 'fuseball' ? 50 : 190,
      });
    }
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.phase += dt * 5;
      e.x += (e.vx + Math.sin(e.phase) * 55) * dt;
      e.y += e.vy * dt;
      if (e.x < ARENA_PAD + 20 || e.x > LOGICAL_W - ARENA_PAD - 20) e.vx = -e.vx;
      if (e.y > LOGICAL_H + 24) this.enemies.splice(i, 1);
    }

    // Update Lasers
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const l = this.lasers[i];
      l.x += l.vx * dt;
      l.y += l.vy * dt;
      if (l.y < ARENA_PAD) {
        this.lasers.splice(i, 1);
        continue;
      }
      let hit = false;
      for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
        const e = this.enemies[ei];
        if (Math.hypot(e.x - l.x, e.y - l.y) < 20) {
          this.spawnFountain(e.x, e.y, e.hue, 16);
          if (!attract) {
            arcadeAudio.playExplosion(false);
            this.addScore(250, e.x, e.y);
            this.maybeDropCapsule(e.x, e.y, true);
          }
          this.enemies.splice(ei, 1);
          hit = true;
          break;
        }
      }
      if (!hit && this.bossActive && Math.hypot(l.x - this.bossX, l.y - this.bossY) < 62) {
        hit = true;
        this.damageBoss(1, l.x, l.y, attract);
      }
      if (!hit) {
        for (let bi = this.bricks.length - 1; bi >= 0; bi--) {
          const br = this.bricks[bi];
          if (l.x >= br.x && l.x <= br.x + br.w && l.y >= br.y && l.y <= br.y + br.h) {
            hit = true;
            if (br.kind !== 'gold') this.hitBrick(bi, 1, attract);
            break;
          }
        }
      }
      if (hit) this.lasers.splice(i, 1);
    }

    // Update Capsules
    for (let i = this.capsules.length - 1; i >= 0; i--) {
      const c = this.capsules[i];
      c.y += c.vy * dt;
      c.spin += dt * 6;
      if (Math.abs(c.x - this.paddleX) < this.paddleW * 0.56 + 10 && Math.abs(c.y - this.paddleY) < 22) {
        this.applyCapsule(c);
        this.capsules.splice(i, 1);
        continue;
      }
      if (c.y > LOGICAL_H + 24) this.capsules.splice(i, 1);
    }

    // Update Balls
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      b.fireballTimer = Math.max(0, b.fireballTimer - dt);
      b.hyperSpin = Math.max(0, b.hyperSpin - dt);
      if (b.stuck) {
        b.x = this.paddleX + b.stuckOffset;
        b.y = this.paddleY - 16;
        continue;
      }

      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 10) b.trail.shift();

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.x < ARENA_PAD + 8) {
        b.x = ARENA_PAD + 8;
        b.vx = Math.abs(b.vx);
        this.spawnShockRing(b.x, b.y, 28, '#22D3EE');
      } else if (b.x > LOGICAL_W - ARENA_PAD - 8) {
        b.x = LOGICAL_W - ARENA_PAD - 8;
        b.vx = -Math.abs(b.vx);
        this.spawnShockRing(b.x, b.y, 28, '#22D3EE');
      }
      if (b.y < ARENA_PAD + 8) {
        b.y = ARENA_PAD + 8;
        b.vy = Math.abs(b.vy);
        this.spawnShockRing(b.x, b.y, 28, '#22D3EE');
      }

      // Paddle Bounce (+ Warlords Catch & Tempest Phase-Parry Hyper Spin!)
      if (
        b.vy > 0 &&
        b.y >= this.paddleY - 14 &&
        b.y <= this.paddleY + 14 &&
        Math.abs(b.x - this.paddleX) <= this.paddleW * 0.5 + 10
      ) {
        const hitRatio = Math.max(-1, Math.min(1, (b.x - this.paddleX) / (this.paddleW * 0.5)));
        const speed = Math.min(620, Math.max(410, Math.hypot(b.vx, b.vy) * 1.018));
        const angle = -Math.PI * 0.5 + hitRatio * 1.15;
        b.vx = Math.cos(angle) * speed;
        b.vy = Math.sin(angle) * speed;
        b.y = this.paddleY - 15;

        if (!attract && this.parryTimer > 0) {
          b.hyperSpin = 4.0;
          b.vx *= 1.15;
          b.vy *= 1.15;
          this.spawnShockRing(b.x, b.y, 85, '#22D3EE');
          this.triggerCallout('PHASE PARRY 2X!', '#22D3EE');
        }
        if (!attract && (this.catchActive || this.input.fire)) {
          b.stuck = true;
          b.stuckOffset = b.x - this.paddleX;
          b.charge = 0;
        }
        if (!attract) arcadeAudio.playPaddleBounce();
      }

      // Safety Barrier Laser Floor bounce!
      if (b.vy > 0 && b.y >= LOGICAL_H - 22 && this.safetyBarrierHp > 0) {
        b.y = LOGICAL_H - 23;
        b.vy = -Math.abs(b.vy);
        this.safetyBarrierHp -= 1;
        this.spawnShockRing(b.x, LOGICAL_H - 20, 75, '#38BDF8');
        if (!attract) arcadeAudio.playPaddleBounce();
      }

      // Warlords Rival AI Shield Deflection & King Core hits!
      for (const k of this.kings) {
        if (!k.alive) continue;
        // Check patrolling AI shield arc
        const sx = k.x + Math.cos(k.shieldAngle) * k.shieldRadius;
        const sy = k.y + Math.sin(k.shieldAngle) * k.shieldRadius;
        if (Math.hypot(b.x - sx, b.y - sy) < 28 && b.fireballTimer <= 0) {
          const nx = (b.x - k.x) / (Math.hypot(b.x - k.x, b.y - k.y) || 1);
          const ny = (b.y - k.y) / (Math.hypot(b.x - k.x, b.y - k.y) || 1);
          const spd = Math.hypot(b.vx, b.vy);
          b.vx = nx * spd;
          b.vy = ny * spd;
          this.spawnShockRing(sx, sy, 44, k.color);
          if (!attract) arcadeAudio.playRockThud();
          continue;
        }
        // Direct hit on the Rival Warlord King Core!
        if (Math.hypot(b.x - k.x, b.y - k.y) < 30) {
          k.hp -= b.fireballTimer > 0 || b.hyperSpin > 0 ? 2 : 1;
          k.hitFlash = 1;
          b.vy = Math.abs(b.vy);
          this.spawnFountain(k.x, k.y, 40, 20);
          if (!attract) {
            arcadeAudio.playExplosion(k.hp <= 0);
            this.addScore(k.hp <= 0 ? 3500 : 400, k.x, k.y, k.hp <= 0 ? 'KING DEFEATED!' : 'KING HIT!');
          }
          if (k.hp <= 0) {
            k.alive = false;
            this.screenShake = 0.45;
            this.spawnShockRing(k.x, k.y, 190, k.color);
            this.triggerCallout('WARLORD CITADEL FALLEN!', k.color);
            // Collapse that King's remaining castle wall bricks in a chain reaction!
            for (let bi = this.bricks.length - 1; bi >= 0; bi--) {
              if (this.bricks[bi].castleOwner === k.id - 1) {
                const br = this.bricks[bi];
                this.spawnFountain(br.x + br.w * 0.5, br.y + br.h * 0.5, br.hue, 10);
                this.bricks.splice(bi, 1);
              }
            }
          }
        }
      }

      // Evolved DOH-Pulsar Boss collision
      if (this.bossActive && Math.hypot(b.x - this.bossX, b.y - this.bossY) < 66) {
        const dx = b.x - this.bossX;
        const dy = b.y - this.bossY;
        const len = Math.hypot(dx, dy) || 1;
        const spd = Math.hypot(b.vx, b.vy);
        b.vx = (dx / len) * spd;
        b.vy = (dy / len) * spd;
        this.damageBoss(b.fireballTimer > 0 || b.hyperSpin > 0 ? 3 : 1, b.x, b.y, attract);
      }

      // Enemy collisions
      for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
        const e = this.enemies[ei];
        if (Math.hypot(e.x - b.x, e.y - b.y) < 22) {
          if (b.fireballTimer <= 0) b.vy = -b.vy;
          this.spawnFountain(e.x, e.y, e.hue, 18);
          if (!attract) {
            arcadeAudio.playExplosion(false);
            this.bumpCombo(e.x, e.y);
            this.addScore(300, e.x, e.y);
            this.maybeDropCapsule(e.x, e.y, true);
          }
          this.enemies.splice(ei, 1);
          break;
        }
      }

      // Brick collisions
      for (let bi = this.bricks.length - 1; bi >= 0; bi--) {
        const br = this.bricks[bi];
        if (b.x + 8 > br.x && b.x - 8 < br.x + br.w && b.y + 8 > br.y && b.y - 8 < br.y + br.h) {
          const piercing = b.fireballTimer > 0;
          if (!piercing) {
            const ox = Math.min(b.x + 8 - br.x, br.x + br.w - (b.x - 8));
            const oy = Math.min(b.y + 8 - br.y, br.y + br.h - (b.y - 8));
            if (ox < oy) b.vx = -b.vx;
            else b.vy = -b.vy;
          }
          b.hue = br.hue;
          if (br.kind !== 'gold' || piercing) {
            const dmg = piercing ? 999 : b.hyperSpin > 0 ? 2 : 1;
            this.hitBrick(bi, dmg, attract);
          } else if (!attract) {
            br.hitFlash = 1;
            arcadeAudio.playRockThud();
          }
          if (!piercing) break;
        }
      }

      if (b.y > LOGICAL_H + 26) {
        this.balls.splice(i, 1);
      }
    }

    if (this.balls.length === 0) {
      if (attract) {
        this.balls.push(this.makeBall(this.paddleX, this.paddleY - 16, 235, -395, false));
      } else {
        this.loseLife();
      }
    }

    // Stage Clear Check!
    if (!attract && !this.bossActive) {
      const kingsAlive = this.kings.some((k) => k.alive);
      const breakableBricks = this.bricks.some((br) => br.kind !== 'gold');
      const cleared = this.kings.length > 0 ? !kingsAlive : !breakableBricks;
      if (cleared) {
        arcadeAudio.playStageClear();
        this.screenFlash = 0.55;
        this.addScore(2500, CX, CY, 'STAGE EVOLVED!');
        this.triggerCallout('SECTOR EVOLVED!', '#4ADE80');
        this.phase = 'STAGE_CLEAR';
        this.stateTimer = 1.5;
      }
    }
  }

  private hitBrick(idx: number, dmg: number, attract: boolean): void {
    const br = this.bricks[idx];
    if (!br) return;
    br.hp -= dmg;
    br.hitFlash = 1;
    br.regenTimer = 0;
    const bx = br.x + br.w * 0.5;
    const by = br.y + br.h * 0.5;

    if (br.hp <= 0) {
      const wasExplosive = br.kind === 'explosive';
      this.spawnFountain(bx, by, br.hue, 12);
      this.bricks.splice(idx, 1);
      if (!attract) {
        arcadeAudio.playCoin();
        this.bumpCombo(bx, by);
        this.addScore(br.maxHp > 1 ? 180 : 100, bx, by);
        this.maybeDropCapsule(bx, by);
      }
      if (wasExplosive) {
        this.detonateExplosiveBrick(bx, by, attract);
      }
    } else if (!attract) {
      arcadeAudio.playRockThud();
    }
  }

  private applyCapsule(c: EvoCapsule): void {
    arcadeAudio.playPowerUp();
    this.triggerCallout(c.label, c.color);
    this.spawnShockRing(this.paddleX, this.paddleY, 95, c.color);
    if (c.kind === 'M') {
      for (const b of this.balls) b.fireballTimer = 8.5;
    } else if (c.kind === 'D') {
      const ref = this.balls[0];
      if (ref) {
        for (let k = -1; k <= 1 && this.balls.length < 6; k += 2) {
          const nb = this.makeBall(ref.x, ref.y, ref.vx * 0.8 + k * 140, -Math.abs(ref.vy), false);
          nb.fireballTimer = ref.fireballTimer;
          this.balls.push(nb);
        }
      }
    } else if (c.kind === 'L') {
      this.laserActive = true;
    } else if (c.kind === 'E') {
      this.paddleW = Math.min(204, this.paddleW + 38);
    } else if (c.kind === 'C') {
      this.catchActive = true;
    } else if (c.kind === 'A') {
      this.droidTimer = 18;
    } else if (c.kind === 'Z') {
      this.zapperCharges = Math.min(3, this.zapperCharges + 1);
    } else if (c.kind === 'S') {
      this.safetyBarrierHp = Math.min(4, this.safetyBarrierHp + 2);
    } else if (c.kind === 'W') {
      this.warpGateOpen = true;
    }
    this.addScore(350, c.x, c.y - 16, c.label);
  }

  public getHudSnapshot(): ClassicGameHud {
    const aliveKings = this.kings.filter((k) => k.alive).length;
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: `${this.stageDef.name} (LV ${this.level})`,
      primaryMetricLabel: this.bossActive ? 'BOSS HP' : this.kings.length > 0 ? 'KINGS' : 'COMBO',
      primaryMetricValue: this.bossActive
        ? `${this.bossHp}/${this.bossMaxHp}`
        : this.kings.length > 0
          ? `${aliveKings}/${this.kings.length}`
          : `${this.multiplier}X`,
      secondaryMetricLabel: 'ZAPPER',
      secondaryMetricValue: `${'⚡'.repeat(this.zapperCharges)} ${Math.round(this.zapperGauge)}%`,
      bannerText: this.phase === 'STAGE_CLEAR' ? 'SECTOR EVOLVED!' : this.phase === 'GAME_OVER' ? 'GAME OVER' : '',
    };
  }

  private renderMeltOVisionBackdrop(ctx: CanvasRenderingContext2D): void {
    // 1. Step real-time Llamasoft Melt-O-Vision feedback canvas!
    const mctx = this.meltBuffer.stepFeedback({
      zoom: 1.022,
      rotateRad: Math.sin(this.clock * 0.45) * 0.008,
      driftX: 0,
      driftY: 1.15, // Authentic Jaguar Melt-O-Vision downward neon melt!
      decay: 0.91,
      tintColor: `hsl(${(this.stageDef.baseHue + this.clock * 22) % 360}, 90%, 50%)`,
      tintAlpha: 0.035,
    });

    if (mctx) {
      const sx = this.meltBuffer.width / LOGICAL_W;
      const sy = this.meltBuffer.height / LOGICAL_H;

      // Stamp glowing balls, pixel fountains, shockwaves, and lasers directly into Melt-O-Vision!
      for (const b of this.balls) {
        mctx.fillStyle = b.fireballTimer > 0 ? '#FB923C' : `hsl(${(b.hue + this.clock * 90) % 360}, 100%, 65%)`;
        mctx.beginPath();
        mctx.arc(b.x * sx, b.y * sy, b.fireballTimer > 0 ? 7.5 : 5, 0, Math.PI * 2);
        mctx.fill();
      }
      for (const f of this.fountains) {
        mctx.fillStyle = f.color;
        mctx.fillRect(f.x * sx, f.y * sy, f.size * sx * 1.4, f.size * sy * 1.4);
      }
      for (const sr of this.shockRings) {
        mctx.strokeStyle = sr.color;
        mctx.lineWidth = 2.5;
        mctx.beginPath();
        mctx.arc(sr.x * sx, sr.y * sy, sr.r * sx, 0, Math.PI * 2);
        mctx.stroke();
      }
      if (this.zapperFlash > 0.2) {
        mctx.strokeStyle = '#FEF08A';
        mctx.lineWidth = 4;
        mctx.strokeRect(14, 14, this.meltBuffer.width - 28, this.meltBuffer.height - 28);
      }
    }

    // 2. Deep psychedelic void base
    ctx.fillStyle = '#03040E';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // 3. Composite the Melt-O-Vision buffer additively!
    this.meltBuffer.compositeTo(ctx, LOGICAL_W, LOGICAL_H, 0.92, 'lighter');

    // 4. Tempest 3D Rotating Perspective Vector Web behind playfield!
    const sides = this.stageDef.webSides;
    const webRot = this.clock * 0.22;
    const hue = (this.stageDef.baseHue + this.clock * 18) % 360;
    ctx.save();
    ctx.translate(CX, CY);
    // Radial perspective lane spokes
    ctx.strokeStyle = `hsla(${hue}, 95%, 62%, 0.22)`;
    ctx.lineWidth = 1.4;
    for (let i = 0; i < sides; i++) {
      const a = webRot + (i / sides) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 32, Math.sin(a) * 32);
      ctx.lineTo(Math.cos(a) * 440, Math.sin(a) * 440);
      ctx.stroke();
    }
    // Pulsing concentric depth polygon rings
    for (let ring = 0; ring < 6; ring++) {
      const prog = ((this.clock * 0.35 + ring / 6) % 1);
      const rad = 26 + prog * prog * 410;
      const alpha = (1 - Math.abs(prog - 0.5) * 1.4) * 0.32;
      if (alpha <= 0) continue;
      ctx.strokeStyle = `hsla(${(hue + ring * 24) % 360}, 100%, 65%, ${alpha.toFixed(3)})`;
      ctx.lineWidth = 1.5 + prog * 1.2;
      ctx.beginPath();
      for (let i = 0; i <= sides; i++) {
        const a = webRot + (i / sides) * Math.PI * 2;
        const px = Math.cos(a) * rad;
        const py = Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  private renderBossOverlord(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.bossX, this.bossY);
    // Rotating Tempest Laser Shield Ring around DOH-Pulsar!
    ctx.save();
    ctx.rotate(this.bossShieldAngle);
    ctx.strokeStyle = '#22D3EE';
    ctx.lineWidth = 5;
    for (let i = 0; i < 6; i++) {
      if (i % 2 === 1) continue;
      const a0 = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(0, 0, 74, a0, a0 + 0.72);
      ctx.stroke();
    }
    ctx.restore();

    // Cyber-Moai Armored Overlord Core
    ctx.fillStyle = this.bossHitFlash > 0 ? '#FFFFFF' : '#4C1D95';
    ctx.strokeStyle = '#E879F9';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-42, -56);
    ctx.lineTo(42, -56);
    ctx.lineTo(56, 0);
    ctx.lineTo(38, 56);
    ctx.lineTo(-38, 56);
    ctx.lineTo(-56, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Glowing Pulsar Eyes & Plasma Mouth
    ctx.fillStyle = '#FACC15';
    ctx.fillRect(-28, -22, 18, 10);
    ctx.fillRect(10, -22, 18, 10);
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(-20, 14, 40, 12);

    // HP Bar
    const pct = Math.max(0, this.bossHp / this.bossMaxHp);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(-62, -76, 124, 10);
    ctx.fillStyle = '#F472B6';
    ctx.fillRect(-60, -74, 120 * pct, 6);
    ctx.restore();
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.save();
    if (this.screenShake > 0) {
      const mag = this.screenShake * 11;
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }

    // 1. Melt-O-Vision + Tempest 3D Vector Web
    this.renderMeltOVisionBackdrop(ctx);

    // 2. Neon Cyber-Frame & Hyper-Warp Doors
    const frameHue = (this.stageDef.baseHue + this.clock * 25) % 360;
    ctx.strokeStyle = `hsl(${frameHue}, 90%, 58%)`;
    ctx.lineWidth = 4;
    ctx.strokeRect(ARENA_PAD - 6, ARENA_PAD - 6, LOGICAL_W - (ARENA_PAD - 6) * 2, LOGICAL_H - (ARENA_PAD - 6) + 12);

    if (this.warpGateOpen) {
      const pulse = Math.floor(this.clock * 14) % 2 === 0 ? '#EC4899' : '#FEF08A';
      ctx.fillStyle = pulse;
      ctx.fillRect(LOGICAL_W - ARENA_PAD - 4, this.paddleY - 34, 14, 68);
      ctx.fillRect(ARENA_PAD - 10, this.paddleY - 34, 14, 68);
    }

    // Safety Barrier Laser Floor!
    if (this.safetyBarrierHp > 0) {
      ctx.strokeStyle = this.safetyBarrierHp >= 2 ? '#38BDF8' : '#FACC15';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(ARENA_PAD, LOGICAL_H - 18);
      ctx.lineTo(LOGICAL_W - ARENA_PAD, LOGICAL_H - 18);
      ctx.stroke();
    }

    // 3. Warlords Rival Kings & Patrolling Shield Paddles!
    for (const k of this.kings) {
      if (!k.alive) continue;
      // Glowing Castle Throne & Crowned King Core
      ctx.save();
      ctx.translate(k.x, k.y);
      ctx.fillStyle = k.hitFlash > 0 ? '#FFFFFF' : k.color;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();
      // Royal Crown Silhouette inside throne
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.moveTo(-12, 8);
      ctx.lineTo(-14, -6);
      ctx.lineTo(-5, 0);
      ctx.lineTo(0, -10);
      ctx.lineTo(5, 0);
      ctx.lineTo(14, -6);
      ctx.lineTo(12, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Patrolling Warlords Curved AI Shield Paddle!
      ctx.save();
      ctx.strokeStyle = k.color;
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(k.x, k.y, k.shieldRadius, k.shieldAngle - 0.28, k.shieldAngle + 0.28);
      ctx.stroke();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }

    // 4. Evolved DOH-Pulsar Overlord Boss
    if (this.bossActive) {
      this.renderBossOverlord(ctx);
    }

    // 5. Gouraud-Style Neon Prism Bricks
    for (const br of this.bricks) {
      const h = (br.hue + (br.kind === 'prism' ? Math.sin(this.clock * 2.4 + br.x * 0.01) * 18 : 0) + 360) % 360;
      const fill =
        br.hitFlash > 0
          ? '#FFFFFF'
          : br.kind === 'gold'
            ? '#D97706'
            : br.kind === 'explosive'
              ? `hsl(${(22 + Math.sin(this.clock * 14) * 14 + 360) % 360}, 100%, 56%)`
              : `hsl(${h}, 92%, ${br.kind === 'armored' || br.kind === 'regen' ? 44 : 52}%)`;

      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.roundRect(br.x, br.y, br.w, br.h, 4);
      ctx.fill();

      // Specular crystalline bevel
      ctx.fillStyle = 'rgba(255, 255, 255, 0.34)';
      ctx.fillRect(br.x + 2, br.y + 2, br.w - 4, 4);

      if (br.kind === 'explosive') {
        ctx.fillStyle = '#FEF08A';
        ctx.font = '900 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('★', br.x + br.w * 0.5, br.y + br.h * 0.5 + 4);
      } else if (br.kind === 'armored' || br.kind === 'regen' || br.kind === 'sliding') {
        ctx.strokeStyle = br.kind === 'regen' ? '#38BDF8' : '#F8FAFC';
        ctx.lineWidth = 1.6;
        ctx.strokeRect(br.x + 1.5, br.y + 1.5, br.w - 3, br.h - 3);
      }
    }

    // 6. Tempest Flippers, Fuseballs & Arkanoid Drones
    for (const e of this.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.phase);
      ctx.strokeStyle = `hsl(${e.hue}, 100%, 64%)`;
      ctx.fillStyle = `hsla(${e.hue}, 100%, 55%, 0.28)`;
      ctx.lineWidth = 2.5;
      if (e.kind === 'flipper') {
        // Iconic Tempest Bow-Tie Flipper!
        ctx.beginPath();
        ctx.moveTo(-16, -10);
        ctx.lineTo(16, 10);
        ctx.lineTo(16, -10);
        ctx.lineTo(-16, 10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (e.kind === 'fuseball') {
        // Crackling Tempest Star Fuseball!
        ctx.beginPath();
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          const r = k % 2 === 0 ? 15 : 5;
          if (k === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.stroke();
      } else {
        // Arkanoid Crystal Drone
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.lineTo(14, 0);
        ctx.lineTo(0, 14);
        ctx.lineTo(-14, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    // 7. Autonomous Tempest A.I. Droid Wingman!
    if (this.droidTimer > 0) {
      ctx.save();
      ctx.translate(this.droidX, this.droidY);
      ctx.rotate(this.clock * 5);
      ctx.strokeStyle = '#E879F9';
      ctx.fillStyle = 'rgba(232, 121, 249, 0.35)';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(13, 8);
      ctx.lineTo(-13, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 8. Spinning Octagonal Evo Capsules
    for (const c of this.capsules) {
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.roundRect(c.x - 19, c.y - 9, 38, 18, 9);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.fillStyle = '#0F172A';
      ctx.font = '900 12px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(c.kind, c.x, c.y + 4);
    }

    // 9. Lasers & Boss Shots
    for (const l of this.lasers) {
      ctx.fillStyle = l.color;
      ctx.fillRect(l.x - 2.5, l.y - 12, 5, 22);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(l.x - 1, l.y - 10, 2, 16);
    }
    for (const bs of this.bossShots) {
      ctx.fillStyle = bs.color;
      ctx.beginPath();
      ctx.arc(bs.x, bs.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(bs.x, bs.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 10. Shockwave Rings & Pixel Fountains
    for (const sr of this.shockRings) {
      ctx.strokeStyle = sr.color;
      ctx.globalAlpha = Math.max(0, sr.life / sr.maxLife);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sr.x, sr.y, sr.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    for (const f of this.fountains) {
      ctx.fillStyle = f.color;
      ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
      ctx.fillRect(f.x, f.y, f.size, f.size);
    }
    ctx.globalAlpha = 1;

    // 11. Energy / Fireball / Hyper-Spin Balls
    for (const b of this.balls) {
      for (let t = 0; t < b.trail.length; t++) {
        const pt = b.trail[t];
        const a = ((t + 1) / (b.trail.length + 1)) * 0.55;
        ctx.fillStyle =
          b.fireballTimer > 0
            ? `rgba(249, 115, 22, ${a.toFixed(2)})`
            : b.hyperSpin > 0
              ? `rgba(34, 211, 238, ${a.toFixed(2)})`
              : `rgba(244, 114, 182, ${a.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 6.5 * ((t + 2) / (b.trail.length + 2)), 0, Math.PI * 2);
        ctx.fill();
      }
      // Warlords Charge Aura around caught ball!
      if (b.stuck && b.charge > 0.05) {
        ctx.strokeStyle = b.charge >= 0.72 ? '#F97316' : '#FEF08A';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 12 + b.charge * 14, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = b.fireballTimer > 0 ? '#F97316' : b.hyperSpin > 0 ? '#22D3EE' : '#F472B6';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.fireballTimer > 0 ? 11 : 8.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(b.x - 1.5, b.y - 1.5, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 12. Cyber-Vaus Curved Claw Shield Paddle!
    const px = this.paddleX;
    const py = this.paddleY;
    const hw = this.paddleW * 0.5;
    ctx.save();
    // Phase-Parry halo
    if (this.parryTimer > 0) {
      ctx.strokeStyle = '#22D3EE';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(px - hw - 6, py - 14, this.paddleW + 12, 28, 14);
      ctx.stroke();
    }
    const pGrad = ctx.createLinearGradient(px - hw, py, px + hw, py);
    pGrad.addColorStop(0, '#22D3EE');
    pGrad.addColorStop(0.5, this.laserActive ? '#EF4444' : '#F8FAFC');
    pGrad.addColorStop(1, '#EC4899');
    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.moveTo(px - hw, py + 6);
    ctx.quadraticCurveTo(px, py - 15, px + hw, py + 6);
    ctx.lineTo(px + hw - 8, py + 11);
    ctx.quadraticCurveTo(px, py - 4, px - hw + 8, py + 11);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Tempest Claw Tips on paddle ends
    ctx.fillStyle = '#FACC15';
    ctx.fillRect(px - hw + 4, py - 4, 6, 10);
    ctx.fillRect(px + hw - 10, py - 4, 6, 10);
    ctx.restore();

    // 13. Jaguar Tempest-Style Floating Neon Callout Banner!
    if (this.calloutTimer > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.calloutTimer * 1.4);
      ctx.font = '900 24px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = this.calloutColor;
      ctx.fillText(this.calloutText, CX, 560 - (1.65 - this.calloutTimer) * 20);
      ctx.restore();
    }

    renderParticlesAndPopups(ctx, this.particles, this.popups);

    if (this.screenFlash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${(this.screenFlash * 0.48).toFixed(3)})`;
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    }

    ctx.restore();

    if (this.phase === 'TITLE') {
      ctx.fillStyle = 'rgba(4, 5, 18, 0.82)';
      ctx.fillRect(0, LOGICAL_H * 0.34, LOGICAL_W, 148);
      ctx.textAlign = 'center';
      ctx.font = '900 38px "JetBrains Mono", monospace';
      ctx.fillStyle = '#22D3EE';
      ctx.fillText('BREAKOUT 2016 EVO', CX, LOGICAL_H * 0.34 + 52);
      ctx.font = '800 13px "JetBrains Mono", monospace';
      ctx.fillStyle = '#F472B6';
      ctx.fillText('TEMPEST MELT-O-VISION × ARKANOID × WARLORDS CITADEL SIEGE', CX, LOGICAL_H * 0.34 + 86);
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText('HOLD SPACE TO CHARGE WARLORD FIREBALL · UP FOR PHASE PARRY · SHIFT FOR SUPERZAPPER', CX, LOGICAL_H * 0.34 + 118);
    }
    if (visualMode === 'crt') renderCrtOverlay(ctx, LOGICAL_W, LOGICAL_H);
  }
}

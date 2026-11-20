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
// FOOD FIGHT 2.5D — MODERN PATIO BISTRO ARCADE ENGINE
// Faithful 1983 GCC / Atari mechanics (Charley Chuck, 4 distinct chefs Oscar /
// Angelo / Jacques / Zorba, piercing Watermelons, Cream Pies, mid-air food
// collisions, melting Giant Triple-Scoop Ice Cream Cone, and genuine recorded
// "INSTANT REPLAY!") rebuilt in a lush depth-sorted 2.5D bistro plaza with
// parabolic 3D lobbed food, dive-roll dodge, 4 venues, and slapstick Foley!
// ============================================================================

const WIDTH = 1152;
const HEIGHT = 720;
const PLAY_TOP = 94;
const PLAY_BOTTOM = HEIGHT - 34;
const PLAY_LEFT = 46;
const PLAY_RIGHT = WIDTH - 46;
const STORAGE_KEY = 'foodfight_hd_highscore_v1';

type FoodKind = 'watermelon' | 'pie' | 'tomato' | 'banana' | 'peas' | 'meatball';

interface FoodSpec {
  label: string;
  color: string;
  accent: string;
  points: number;
  speed: number;
  pierce: boolean;
  spreadCount: number;
  curve: number;
  heavy: boolean;
}

const FOOD_SPECS: Record<FoodKind, FoodSpec> = {
  watermelon: {
    label: 'Watermelon',
    color: '#22C55E',
    accent: '#EF4444',
    points: 350,
    speed: 560,
    pierce: true,
    spreadCount: 1,
    curve: 0,
    heavy: true,
  },
  pie: {
    label: 'Cream Pie',
    color: '#FEF3C7',
    accent: '#F59E0B',
    points: 250,
    speed: 520,
    pierce: false,
    spreadCount: 1,
    curve: 0,
    heavy: true,
  },
  tomato: {
    label: 'Tomato',
    color: '#EF4444',
    accent: '#4ADE80',
    points: 175,
    speed: 620,
    pierce: false,
    spreadCount: 1,
    curve: 0,
    heavy: false,
  },
  banana: {
    label: 'Banana',
    color: '#FACC15',
    accent: '#92400E',
    points: 200,
    speed: 550,
    pierce: false,
    spreadCount: 1,
    curve: 185,
    heavy: false,
  },
  peas: {
    label: 'Peas',
    color: '#4ADE80',
    accent: '#166534',
    points: 125,
    speed: 640,
    pierce: false,
    spreadCount: 3,
    curve: 0,
    heavy: false,
  },
  meatball: {
    label: 'Meatball',
    color: '#92400E',
    accent: '#EF4444',
    points: 225,
    speed: 540,
    pierce: false,
    spreadCount: 1,
    curve: 0,
    heavy: true,
  },
};

interface PlazaTheme {
  name: string;
  tileA: string;
  tileB: string;
  grout: string;
  awningA: string;
  awningA2: string;
  awningB: string;
  awningB2: string;
  wallTrim: string;
  bulbGlow: string;
}

const PLAZA_THEMES: PlazaTheme[] = [
  {
    name: 'Parisian Patio Bistro',
    tileA: '#28334A',
    tileB: '#1E273B',
    grout: 'rgba(10, 15, 28, 0.55)',
    awningA: '#BE123C',
    awningA2: '#F43F5E',
    awningB: '#E2E8F0',
    awningB2: '#FFFFFF',
    wallTrim: '#F59E0B',
    bulbGlow: '#FEF08A',
  },
  {
    name: 'Boardwalk Gelateria',
    tileA: '#1E3A47',
    tileB: '#162C38',
    grout: 'rgba(8, 20, 28, 0.55)',
    awningA: '#0E7490',
    awningA2: '#22D3EE',
    awningB: '#FEF3C7',
    awningB2: '#FFFBEB',
    wallTrim: '#38BDF8',
    bulbGlow: '#BAE6FD',
  },
  {
    name: 'Twilight Piazza',
    tileA: '#2E2344',
    tileB: '#221936',
    grout: 'rgba(12, 8, 22, 0.6)',
    awningA: '#6D28D9',
    awningA2: '#A855F7',
    awningB: '#FDE68A',
    awningB2: '#FEF9C3',
    wallTrim: '#C084FC',
    bulbGlow: '#FDE047',
  },
  {
    name: 'Grand Banquet Courtyard',
    tileA: '#1C382F',
    tileB: '#152A24',
    grout: 'rgba(6, 18, 14, 0.58)',
    awningA: '#047857',
    awningA2: '#10B981',
    awningB: '#FDE68A',
    awningB2: '#FFFFFF',
    wallTrim: '#4ADE80',
    bulbGlow: '#BBF7D0',
  },
];

interface FoodPile {
  x: number;
  y: number;
  kind: FoodKind;
  count: number;
  maxCount: number;
  bounce: number;
}

interface ThrownFood {
  x: number;
  y: number;
  vx: number;
  vy: number;
  z: number; // 2.5D altitude above floor
  vz: number;
  kind: FoodKind;
  fromPlayer: boolean;
  spin: number;
  curveSign: number;
  hits: number;
}

interface ChefHole {
  x: number;
  y: number;
  openAnim: number; // 0..1
}

type ChefPersonality = 'pursuer' | 'sniper' | 'flanker' | 'guard';

interface Chef {
  name: string;
  color: string;
  personality: ChefPersonality;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: -1 | 1;
  state: 'active' | 'splatted' | 'respawning';
  timer: number;
  throwCooldown: number;
  windup: number; // >0 when holding food overhead before throwing!
  heldFood: FoodKind | null;
  splatColor: string;
  anim: number;
}

interface SplatDecal {
  x: number;
  y: number;
  color: string;
  accent: string;
  r: number;
  seed: number;
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

// Lightweight frame snapshot for authentic 1983 Food Fight INSTANT REPLAY!
interface ReplayFrame {
  px: number;
  py: number;
  facingX: number;
  dash: boolean;
  coneMelt: number;
  chefs: Array<{ x: number; y: number; color: string; state: Chef['state']; facing: -1 | 1; splatColor: string }>;
  projectiles: Array<{ x: number; y: number; z: number; kind: FoodKind; spin: number }>;
}

const CHEF_ROSTER: Array<{ name: string; color: string; personality: ChefPersonality }> = [
  { name: 'Oscar', color: '#38BDF8', personality: 'pursuer' },
  { name: 'Angelo', color: '#F97316', personality: 'sniper' },
  { name: 'Jacques', color: '#A855F7', personality: 'flanker' },
  { name: 'Zorba', color: '#22C55E', personality: 'guard' },
];

export class FoodFightGame implements ArcadeGameInstance {
  public readonly logicalWidth = WIDTH;
  public readonly logicalHeight = HEIGHT;
  public readonly supportsPointerAim = true;
  public readonly primaryActionLabel = 'Throw';
  public readonly secondaryActionLabel = 'Dive Roll';

  private phase: ClassicGamePhase = 'TITLE';
  private score = 0;
  private highScore = readHighScore(STORAGE_KEY);
  private nextExtraLife = 15000;
  private level = 1;
  private lives = 3;
  private phaseTimer = 0;
  private time = 0;
  private bannerText = '';
  private bannerSub = '';

  private input: ArcadeInputState = createEmptyInput();
  private playerX = 104;
  private playerY = (PLAY_TOP + PLAY_BOTTOM) * 0.5;
  private facingX = 1;
  private facingY = 0;
  private playerAnim = 0;
  private throwCooldown = 0;
  private throwAnim = 0;
  private invulnTimer = 0;
  private dashTimer = 0;
  private dashCooldown = 0;
  private dashDirX = 1;
  private dashDirY = 0;
  private comboCount = 0;
  private comboTimer = 0;

  private coneX = WIDTH - 102;
  private coneY = (PLAY_TOP + PLAY_BOTTOM) * 0.5;
  private coneMelt = 0; // 0..1
  private dripTimer = 0;
  private chefsSplattedThisStage = 0;

  private piles: FoodPile[] = [];
  private holes: ChefHole[] = [];
  private chefs: Chef[] = [];
  private projectiles: ThrownFood[] = [];
  private splatMarks: SplatDecal[] = [];
  private shockRings: ShockRing[] = [];

  // Authentic Instant Replay buffer (stores 30fps snapshots of final 3.5 seconds!)
  private replayBuffer: ReplayFrame[] = [];
  private replaySampleAcc = 0;
  private replayActive = false;
  private replayPlayIdx = 0;
  private replayStepAcc = 0;

  private shakeTime = 0;
  private shakeMag = 0;

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
    this.nextExtraLife = 15000;
    this.level = 1;
    this.lives = 3;
    this.particles = [];
    this.popups = [];
    this.shockRings = [];
    this.replayActive = false;
    this.setupStage(1);
    this.phase = 'READY';
    this.phaseTimer = 1.25;
    this.bannerText = 'GET THE ICE CREAM!';
    this.bannerSub = PLAZA_THEMES[0].name.toUpperCase();
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.level = 1;
    this.replayActive = false;
    this.setupStage(1);
  }

  public getHudSnapshot(): ClassicGameHud {
    const coneLeftPct = Math.max(0, Math.round((1 - this.coneMelt) * 100));
    const theme = PLAZA_THEMES[(this.level - 1) % PLAZA_THEMES.length];
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: `${theme.name} · Lv.${this.level}`,
      primaryMetricLabel: 'Ice Cream',
      primaryMetricValue: `${coneLeftPct}%`,
      secondaryMetricLabel: 'Chefs Hit',
      secondaryMetricValue: String(this.chefsSplattedThisStage),
      bannerText: this.bannerText,
    };
  }

  private addShake(mag: number, dur = 0.2): void {
    if (this.phase === 'TITLE') return;
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeTime = Math.max(this.shakeTime, dur);
  }

  private addScore(pts: number, x?: number, y?: number, color = '#FDE047', label?: string): void {
    if (this.phase === 'TITLE') return;
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(STORAGE_KEY, this.highScore);
    }
    if (this.score >= this.nextExtraLife) {
      this.lives = Math.min(6, this.lives + 1);
      this.nextExtraLife += 15000;
      arcadeAudio.playExtraLife();
      this.popups.push({
        x: this.playerX,
        y: this.playerY - 34,
        text: '1UP!',
        color: '#4ADE80',
        life: 1.5,
        maxLife: 1.5,
      });
    }
    if (x !== undefined && y !== undefined && pts >= 50) {
      this.popups.push({
        x,
        y: y - 16,
        text: label ?? `+${pts}`,
        color,
        life: 1.05,
        maxLife: 1.05,
      });
    }
  }

  private setupStage(lvl: number): void {
    const midY = (PLAY_TOP + PLAY_BOTTOM) * 0.5;
    this.playerX = 104;
    this.playerY = midY;
    this.facingX = 1;
    this.facingY = 0;
    this.invulnTimer = 1.25;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.throwAnim = 0;
    this.comboCount = 0;
    this.comboTimer = 0;

    this.coneX = WIDTH - 102;
    this.coneY = midY;
    this.coneMelt = 0;
    this.dripTimer = 0.4;
    this.chefsSplattedThisStage = 0;
    this.projectiles = [];
    this.splatMarks = [];
    this.replayBuffer = [];
    this.replayActive = false;

    // 8 Vibrant Bistro Food Tables cleanly distributed across the wide plaza
    const kinds: FoodKind[] = [
      'watermelon',
      'pie',
      'tomato',
      'banana',
      'peas',
      'meatball',
      'pie',
      'watermelon',
    ];
    const pileCoords: Array<[number, number]> = [
      [255, 200],
      [265, 560],
      [455, 395],
      [515, 175],
      [530, 600],
      [715, 275],
      [735, 515],
      [885, 390],
    ];
    this.piles = pileCoords.map(([x, y], i) => {
      const cnt = 6 + ((i + lvl) % 3) * 2;
      return {
        x,
        y,
        kind: kinds[(i + lvl - 1) % kinds.length],
        count: cnt,
        maxCount: cnt,
        bounce: 0,
      };
    });

    // Black Chef Emergence Holes (scales from 4 up to 7 across levels)
    const holeCoords: Array<[number, number]> = [
      [365, 165],
      [370, 600],
      [625, 155],
      [630, 610],
      [835, 200],
      [840, 565],
      [940, 260],
    ];
    this.holes = holeCoords.slice(0, Math.min(holeCoords.length, 3 + lvl)).map(([x, y]) => ({
      x,
      y,
      openAnim: 1,
    }));

    // 4 Iconic Chefs with distinct roles
    this.chefs = CHEF_ROSTER.map((spec, i) => {
      const hole = this.holes[i % this.holes.length];
      return {
        name: spec.name,
        color: spec.color,
        personality: spec.personality,
        x: hole.x,
        y: hole.y,
        vx: 0,
        vy: 0,
        facing: -1,
        state: 'respawning',
        timer: 0.45 + i * 0.45,
        throwCooldown: 1.4 + i * 0.55,
        windup: 0,
        heldFood: null,
        splatColor: '#FEF3C7',
        anim: i * 1.4,
      };
    });
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
    if (this.throwAnim > 0) this.throwAnim = Math.max(0, this.throwAnim - dt * 5.8);
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.comboCount = 0;
    }
    for (const p of this.piles) {
      if (p.bounce > 0) p.bounce = Math.max(0, p.bounce - dt * 6);
    }

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
      if (this.replayActive) {
        // Play back recorded Instant Replay at cinematic 0.72x speed! (Press Fire to skip)
        if (this.input.fireJustPressed) {
          this.replayActive = false;
          this.phaseTimer = 0.2;
          return;
        }
        this.replayStepAcc += dt;
        if (this.replayStepAcc >= 0.042) {
          this.replayStepAcc -= 0.042;
          this.replayPlayIdx += 1;
          if (this.replayPlayIdx >= this.replayBuffer.length) {
            this.replayActive = false;
            this.phaseTimer = 0.7;
          }
        }
        return;
      }

      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.level += 1;
        this.setupStage(this.level);
        this.phase = 'READY';
        this.phaseTimer = 1.2;
        const theme = PLAZA_THEMES[(this.level - 1) % PLAZA_THEMES.length];
        this.bannerText = `LEVEL ${this.level} · HURRY!`;
        this.bannerSub = theme.name.toUpperCase();
      }
      return;
    }

    const isAttract = this.phase === 'TITLE';

    // Ice cream cone melts steadily + animated pink droplets!
    const meltSpeed = 1 / Math.max(17, 30 - (this.level - 1) * 1.7);
    this.coneMelt = Math.min(1, this.coneMelt + meltSpeed * dt);
    this.dripTimer -= dt;
    if (this.dripTimer <= 0) {
      this.dripTimer = Math.max(0.18, 0.55 - this.coneMelt * 0.35);
      this.particles.push({
        x: this.coneX + (Math.random() - 0.5) * 26,
        y: this.coneY - 10,
        vx: (Math.random() - 0.5) * 14,
        vy: 55 + Math.random() * 35,
        color: Math.random() < 0.5 ? '#F472B6' : '#FEF3C7',
        radius: 3.2,
        life: 0.45,
        maxLife: 0.45,
      });
    }

    if (this.coneMelt >= 1) {
      if (isAttract) {
        this.setupStage(1);
      } else {
        this.handlePlayerHit('CONE MELTED!');
      }
      return;
    }

    this.updatePlayer(dt, isAttract);
    this.updateChefs(dt, isAttract);
    this.updateProjectiles(dt, isAttract);

    // Record Replay Snapshot at 30fps (keep last 95 frames = ~3.2s)
    if (!isAttract) {
      this.replaySampleAcc += dt;
      if (this.replaySampleAcc >= 1 / 30) {
        this.replaySampleAcc -= 1 / 30;
        this.replayBuffer.push({
          px: this.playerX,
          py: this.playerY,
          facingX: this.facingX,
          dash: this.dashTimer > 0,
          coneMelt: this.coneMelt,
          chefs: this.chefs.map((c) => ({
            x: c.x,
            y: c.y,
            color: c.color,
            state: c.state,
            facing: c.facing,
            splatColor: c.splatColor,
          })),
          projectiles: this.projectiles.map((p) => ({
            x: p.x,
            y: p.y,
            z: p.z,
            kind: p.kind,
            spin: p.spin,
          })),
        });
        if (this.replayBuffer.length > 95) this.replayBuffer.shift();
      }
    }

    // Check reaching the Giant Ice Cream Cone!
    if (Math.hypot(this.playerX - this.coneX, this.playerY - this.coneY) < 52) {
      if (isAttract) {
        this.setupStage(1);
      } else {
        const coneBonus = 500 + Math.round((1 - this.coneMelt) * 1200) + this.level * 250;
        const triggerReplay =
          this.replayBuffer.length >= 25 &&
          (this.chefsSplattedThisStage >= 3 || this.coneMelt > 0.72);

        if (triggerReplay) arcadeAudio.playInstantReplayFanfare();
        else arcadeAudio.playConeChomp();

        this.addShake(5, 0.25);
        spawnBurst(this.particles, this.coneX, this.coneY - 12, '#F472B6', 32, 260, 4.6);
        spawnBurst(this.particles, this.coneX, this.coneY - 12, '#FEF08A', 20, 210, 3.4);
        this.shockRings.push({
          x: this.coneX,
          y: this.coneY,
          radius: 12,
          maxRadius: 110,
          color: '#F472B6',
          life: 0.5,
          maxLife: 0.5,
        });
        this.addScore(coneBonus, this.coneX - 36, this.coneY - 30, '#F472B6', `YUM! +${coneBonus}`);

        this.phase = 'STAGE_CLEAR';
        if (triggerReplay) {
          this.replayActive = true;
          this.replayPlayIdx = 0;
          this.replayStepAcc = 0;
          this.bannerText = '★ INSTANT REPLAY! ★';
          this.bannerSub = `Cone Bonus +${coneBonus.toLocaleString()} · Tap Space to Skip`;
        } else {
          this.replayActive = false;
          this.phaseTimer = 1.5;
          this.bannerText = `DELICIOUS! +${coneBonus.toLocaleString()}`;
          this.bannerSub = `${this.chefsSplattedThisStage} Chefs Splatted!`;
        }
      }
    }
  }

  private getNearestPile(x: number, y: number, maxDist: number): FoodPile | null {
    let best: FoodPile | null = null;
    let bestD = maxDist;
    for (const p of this.piles) {
      if (p.count <= 0) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  private updatePlayer(dt: number, isAttract: boolean): void {
    if (this.throwCooldown > 0) this.throwCooldown = Math.max(0, this.throwCooldown - dt);
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (this.dashCooldown > 0) this.dashCooldown = Math.max(0, this.dashCooldown - dt);

    let mx = 0;
    let my = 0;

    if (isAttract) {
      let tx = this.coneX;
      let ty = this.coneY;
      const nearbyPile = this.getNearestPile(this.playerX, this.playerY, 72);
      const closeChef = this.chefs.find(
        (c) => c.state === 'active' && Math.hypot(c.x - this.playerX, c.y - this.playerY) < 210
      );
      if (nearbyPile && closeChef && this.throwCooldown <= 0) {
        const dx = closeChef.x - this.playerX;
        const dy = closeChef.y - this.playerY;
        const d = Math.hypot(dx, dy) || 1;
        this.facingX = dx / d;
        this.facingY = dy / d;
        this.throwFoodFromPile(nearbyPile, true);
      } else if (closeChef) {
        tx = this.playerX - (closeChef.x - this.playerX) * 0.55 + 110;
        ty = this.playerY - (closeChef.y - this.playerY);
      }
      const dx = tx - this.playerX;
      const dy = ty - this.playerY;
      const dist = Math.hypot(dx, dy) || 1;
      mx = dx / dist;
      my = dy / dist;
    } else {
      mx = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
      my = (this.input.down ? 1 : 0) - (this.input.up ? 1 : 0);
      if (mx !== 0 && my !== 0) {
        mx *= 0.7071;
        my *= 0.7071;
      }

      // Dive-Roll Dodge (`Shift / X`)!
      if (this.input.secondaryJustPressed && this.dashCooldown <= 0 && this.dashTimer <= 0) {
        this.dashTimer = 0.24;
        this.dashCooldown = 0.85;
        this.dashDirX = mx !== 0 || my !== 0 ? mx : this.facingX;
        this.dashDirY = mx !== 0 || my !== 0 ? my : this.facingY;
        const len = Math.hypot(this.dashDirX, this.dashDirY) || 1;
        this.dashDirX /= len;
        this.dashDirY /= len;
        arcadeAudio.playCharleyDash();
        spawnBurst(this.particles, this.playerX, this.playerY + 12, '#E2E8F0', 10, 120, 3);
      }
    }

    if (this.dashTimer > 0) {
      this.dashTimer = Math.max(0, this.dashTimer - dt);
      const dashSpeed = 520;
      this.playerX = Math.max(PLAY_LEFT, Math.min(PLAY_RIGHT, this.playerX + this.dashDirX * dashSpeed * dt));
      this.playerY = Math.max(PLAY_TOP + 18, Math.min(PLAY_BOTTOM, this.playerY + this.dashDirY * dashSpeed * dt));
      this.playerAnim += dt * 26;
      if (Math.random() < 0.6) {
        this.particles.push({
          x: this.playerX,
          y: this.playerY + 12,
          vx: -this.dashDirX * 40,
          vy: -this.dashDirY * 40,
          color: '#FEF08A',
          radius: 3.5,
          life: 0.25,
          maxLife: 0.25,
        });
      }
      return;
    }

    if (mx !== 0 || my !== 0) {
      this.facingX = mx;
      this.facingY = my;
      this.playerAnim += dt * 15;
      const speed = 285;
      this.playerX = Math.max(PLAY_LEFT, Math.min(PLAY_RIGHT, this.playerX + mx * speed * dt));
      this.playerY = Math.max(PLAY_TOP + 18, Math.min(PLAY_BOTTOM, this.playerY + my * speed * dt));
    }

    // Grab & hurl food when near a food table!
    if (!isAttract && (this.input.fire || this.input.fireJustPressed) && this.throwCooldown <= 0) {
      const pile = this.getNearestPile(this.playerX, this.playerY, 76);
      if (pile) {
        // Support mouse pointer aim if actively aiming with mouse
        if (this.input.pointerActive) {
          const pdx = this.input.pointerX - this.playerX;
          const pdy = this.input.pointerY - this.playerY;
          const pdist = Math.hypot(pdx, pdy);
          if (pdist > 14) {
            this.facingX = pdx / pdist;
            this.facingY = pdy / pdist;
          }
        }
        this.throwFoodFromPile(pile, false);
      }
    }
  }

  private throwFoodFromPile(pile: FoodPile, isAttract: boolean): void {
    const spec = FOOD_SPECS[pile.kind];
    pile.count -= 1;
    pile.bounce = 1;
    this.throwCooldown = spec.heavy ? 0.22 : 0.16;
    this.throwAnim = 1;

    const baseAngle = Math.atan2(this.facingY, this.facingX);
    const count = spec.spreadCount;
    for (let i = 0; i < count; i++) {
      const spreadOffset = count === 1 ? 0 : (i - (count - 1) * 0.5) * 0.17;
      const a = baseAngle + spreadOffset;
      this.projectiles.push({
        x: this.playerX + Math.cos(a) * 18,
        y: this.playerY + Math.sin(a) * 18,
        vx: Math.cos(a) * spec.speed,
        vy: Math.sin(a) * spec.speed,
        z: 18,
        vz: spec.heavy ? 125 : 155,
        kind: pile.kind,
        fromPlayer: true,
        spin: 0,
        curveSign: this.facingX >= 0 ? 1 : -1,
        hits: 0,
      });
    }
    if (!isAttract) arcadeAudio.playFoodWhoosh(spec.heavy);
  }

  private updateChefs(dt: number, isAttract: boolean): void {
    const baseSpeed = Math.min(245, 138 + (this.level - 1) * 14);

    for (const chef of this.chefs) {
      chef.anim += dt * 13;

      if (chef.state === 'splatted') {
        chef.timer -= dt;
        if (chef.timer <= 0) {
          const hole = this.holes[Math.floor(Math.random() * this.holes.length)];
          chef.x = hole.x;
          chef.y = hole.y;
          chef.state = 'respawning';
          chef.timer = 1.2;
          chef.windup = 0;
          chef.heldFood = null;
        }
        continue;
      }

      if (chef.state === 'respawning') {
        const prev = chef.timer;
        chef.timer -= dt;
        if (prev >= 0.5 && chef.timer < 0.5 && !isAttract) {
          arcadeAudio.playChefPopUp();
        }
        if (chef.timer <= 0) {
          chef.state = 'active';
          spawnBurst(this.particles, chef.x, chef.y, '#CBD5E1', 6, 85, 2.5);
        }
        continue;
      }

      // Chef throw windup telegraph (holds food overhead briefly before tossing!)
      if (chef.windup > 0) {
        chef.windup -= dt;
        if (chef.windup <= 0 && chef.heldFood) {
          const dx = this.playerX - chef.x;
          const dy = this.playerY - chef.y;
          const dist = Math.hypot(dx, dy) || 1;
          const spd = 345 + this.level * 18;
          this.projectiles.push({
            x: chef.x,
            y: chef.y,
            vx: (dx / dist) * spd,
            vy: (dy / dist) * spd,
            z: 24,
            vz: 110,
            kind: chef.heldFood,
            fromPlayer: false,
            spin: 0,
            curveSign: 1,
            hits: 0,
          });
          if (!isAttract) arcadeAudio.playFoodWhoosh(false);
          chef.heldFood = null;
        }
        continue;
      }

      // Distinct 1983 personality targeting
      let tx = this.playerX;
      let ty = this.playerY;
      let speedMult = 1;
      if (chef.personality === 'flanker') {
        tx = Math.min(PLAY_RIGHT - 40, this.playerX + this.facingX * 115);
        ty = Math.max(PLAY_TOP + 30, Math.min(PLAY_BOTTOM - 20, this.playerY + this.facingY * 95));
        speedMult = 1.04;
      } else if (chef.personality === 'guard') {
        // Patrol between Charley and the Giant Ice Cream Cone
        tx = this.playerX * 0.62 + this.coneX * 0.38;
        ty = this.playerY * 0.62 + this.coneY * 0.38;
        speedMult = 0.96;
      } else if (chef.personality === 'sniper') {
        // Prefer nearby piles to throw from
        const nearPile = this.getNearestPile(chef.x, chef.y, 170);
        if (nearPile && chef.throwCooldown < 0.7) {
          tx = nearPile.x;
          ty = nearPile.y;
        }
        speedMult = 1.06;
      }

      const dx = tx - chef.x;
      const dy = ty - chef.y;
      const dist = Math.hypot(dx, dy) || 1;
      chef.vx = (dx / dist) * baseSpeed * speedMult;
      chef.vy = (dy / dist) * baseSpeed * speedMult;
      if (Math.abs(chef.vx) > 8) chef.facing = chef.vx >= 0 ? 1 : -1;

      chef.x = Math.max(PLAY_LEFT, Math.min(PLAY_RIGHT, chef.x + chef.vx * dt));
      chef.y = Math.max(PLAY_TOP + 18, Math.min(PLAY_BOTTOM, chef.y + chef.vy * dt));

      // Grab food from passing pile & wind up throw
      const distToCharley = Math.hypot(this.playerX - chef.x, this.playerY - chef.y);
      chef.throwCooldown -= dt;
      if (chef.throwCooldown <= 0 && distToCharley < 420 && distToCharley > 65) {
        const pile = this.getNearestPile(chef.x, chef.y, 58);
        if (pile) {
          pile.count = Math.max(1, pile.count - 1);
          pile.bounce = 0.8;
          chef.heldFood = pile.kind;
          chef.windup = 0.28;
          chef.throwCooldown = Math.max(1.25, 2.6 - this.level * 0.18);
        }
      }

      // Catching Charley (Dive-Roll gives brief dodge frames!)
      if (!isAttract && this.invulnTimer <= 0 && this.dashTimer <= 0 && distToCharley < 30) {
        this.handlePlayerHit(`${chef.name.toUpperCase()} CAUGHT YOU!`);
        return;
      }
    }
  }

  private updateProjectiles(dt: number, isAttract: boolean): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      const spec = FOOD_SPECS[pr.kind];

      // Slight banana curve!
      if (spec.curve !== 0 && pr.fromPlayer) {
        const perpX = -pr.vy / (Math.hypot(pr.vx, pr.vy) || 1);
        const perpY = pr.vx / (Math.hypot(pr.vx, pr.vy) || 1);
        pr.vx += perpX * spec.curve * pr.curveSign * dt;
        pr.vy += perpY * spec.curve * pr.curveSign * dt;
      }

      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.z += pr.vz * dt;
      pr.vz -= 360 * dt; // 2.5D parabolic gravity arc!
      pr.spin += dt * (spec.heavy ? 11 : 17);

      // Hit the floor or plaza border -> splat!
      if (
        pr.z <= 0 ||
        pr.x < PLAY_LEFT - 18 ||
        pr.x > PLAY_RIGHT + 18 ||
        pr.y < PLAY_TOP - 8 ||
        pr.y > PLAY_BOTTOM + 14
      ) {
        if (pr.z <= 0) {
          this.addSplatDecal(pr.x, pr.y, spec.color, spec.accent, spec.heavy ? 16 : 11);
          spawnBurst(this.particles, pr.x, pr.y, spec.accent, 6, 110, 2.8);
        }
        this.projectiles.splice(i, 1);
        continue;
      }

      if (pr.fromPlayer) {
        // Mid-air Food-vs-Food Interception!
        let intercepted = false;
        for (let j = this.projectiles.length - 1; j >= 0; j--) {
          if (i === j) continue;
          const other = this.projectiles[j];
          if (other.fromPlayer) continue;
          if (Math.hypot(pr.x - other.x, pr.y - other.y) < 26) {
            spawnBurst(this.particles, other.x, other.y - other.z, '#FEF08A', 12, 175, 3.2);
            if (!isAttract) arcadeAudio.playFoodSplat(false);
            this.addScore(100, other.x, other.y - other.z, '#38BDF8', 'BLOCK +100');
            this.projectiles.splice(j, 1);
            if (j < i) i--;
            if (!spec.pierce) {
              intercepted = true;
              break;
            }
          }
        }
        if (intercepted) {
          this.projectiles.splice(i, 1);
          continue;
        }

        // Hitting Chefs!
        let consumed = false;
        for (const chef of this.chefs) {
          if (chef.state !== 'active') continue;
          const hitRad = pr.kind === 'pie' || pr.kind === 'watermelon' ? 34 : 28;
          if (Math.hypot(pr.x - chef.x, pr.y - chef.y) < hitRad) {
            chef.state = 'splatted';
            chef.timer = 2.0;
            chef.windup = 0;
            chef.heldFood = null;
            chef.splatColor = pr.kind === 'pie' ? '#FFFFFF' : spec.accent;
            this.chefsSplattedThisStage += 1;
            pr.hits += 1;

            this.comboCount = Math.min(6, this.comboCount + 1);
            this.comboTimer = 2.4;
            const bonusPts = spec.points + (this.comboCount > 1 ? (this.comboCount - 1) * 75 : 0);

            this.addSplatDecal(chef.x, chef.y + 8, spec.color, spec.accent, spec.heavy ? 24 : 18);
            if (!isAttract) {
              arcadeAudio.playFoodSplat(spec.heavy);
              this.addShake(spec.heavy ? 6.5 : 4, 0.16);
            }
            spawnBurst(this.particles, chef.x, chef.y - 10, spec.accent, 18, 220, 4.2);
            spawnBurst(this.particles, chef.x, chef.y - 10, spec.color, 10, 170, 3.2);
            this.shockRings.push({
              x: chef.x,
              y: chef.y,
              radius: 8,
              maxRadius: spec.heavy ? 58 : 42,
              color: spec.accent,
              life: 0.28,
              maxLife: 0.28,
            });
            this.addScore(
              bonusPts,
              chef.x,
              chef.y - 18,
              this.comboCount >= 2 ? '#FB7185' : '#FDE047',
              pr.hits >= 2
                ? `PIERCE ×${pr.hits} +${bonusPts}!`
                : this.comboCount >= 2
                ? `SPLAT ×${this.comboCount} +${bonusPts}`
                : `+${bonusPts}`
            );

            if (!spec.pierce) {
              consumed = true;
              break;
            }
          }
        }
        if (consumed) {
          this.projectiles.splice(i, 1);
          continue;
        }
      } else {
        // Enemy chef projectile hitting Charley!
        if (
          !isAttract &&
          this.invulnTimer <= 0 &&
          this.dashTimer <= 0 &&
          Math.hypot(pr.x - this.playerX, pr.y - this.playerY) < 25
        ) {
          this.addSplatDecal(this.playerX, this.playerY, spec.color, spec.accent, 22);
          this.projectiles.splice(i, 1);
          this.handlePlayerHit('SPLATTED!');
          return;
        }
      }
    }
  }

  private addSplatDecal(x: number, y: number, color: string, accent: string, r: number): void {
    this.splatMarks.push({ x, y, color, accent, r, seed: Math.random() * 10 });
    if (this.splatMarks.length > 42) this.splatMarks.shift();
  }

  private handlePlayerHit(reason: string): void {
    arcadeAudio.playDeath();
    this.addShake(11, 0.34);
    spawnBurst(this.particles, this.playerX, this.playerY, '#FB7185', 30, 260, 4.8);
    this.lives -= 1;
    this.projectiles = [];
    if (this.lives <= 0) {
      this.phase = 'GAME_OVER';
      this.bannerText = 'GAME OVER';
      this.bannerSub = `Final Score: ${this.score.toLocaleString()}`;
      return;
    }
    this.setupStage(this.level);
    this.phase = 'READY';
    this.phaseTimer = 1.3;
    this.bannerText = reason;
    this.bannerSub = `${this.lives} ${this.lives === 1 ? 'Life' : 'Lives'} Remaining`;
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const theme = PLAZA_THEMES[(this.level - 1) % PLAZA_THEMES.length];

    // If playing back an authentic INSTANT REPLAY, read positions from recorded frame!
    const rf =
      this.phase === 'STAGE_CLEAR' && this.replayActive
        ? this.replayBuffer[Math.min(this.replayBuffer.length - 1, this.replayPlayIdx)]
        : null;

    const sx = this.shakeTime > 0 ? (Math.random() - 0.5) * this.shakeMag * 2 : 0;
    const sy = this.shakeTime > 0 ? (Math.random() - 0.5) * this.shakeMag * 2 : 0;

    ctx.save();
    ctx.translate(Math.round(sx), Math.round(sy));

    // 1. Checkered 2.5D Patio Bistro Floor with subtle stone bevel & warm sunlight
    this.drawPatioFloor(ctx, theme);

    // 2. Persistent Messy Food Splat Decals
    for (const sm of this.splatMarks) {
      ctx.save();
      ctx.globalAlpha = 0.42;
      ctx.fillStyle = sm.accent;
      ctx.beginPath();
      ctx.ellipse(sm.x, sm.y, sm.r, sm.r * 0.64, sm.seed, 0, Math.PI * 2);
      ctx.ellipse(
        sm.x + Math.cos(sm.seed) * sm.r * 0.85,
        sm.y + Math.sin(sm.seed) * sm.r * 0.45,
        sm.r * 0.48,
        sm.r * 0.34,
        0,
        0,
        Math.PI * 2
      );
      ctx.ellipse(
        sm.x - Math.sin(sm.seed) * sm.r * 0.72,
        sm.y + Math.cos(sm.seed) * sm.r * 0.42,
        sm.r * 0.36,
        sm.r * 0.25,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.fillStyle = sm.color;
      ctx.globalAlpha = 0.26;
      ctx.beginPath();
      ctx.ellipse(sm.x - 2, sm.y - 1, sm.r * 0.52, sm.r * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 3. Recessed 2.5D Chef Pop-Up Holes
    for (const hole of this.holes) {
      this.drawChefHole(ctx, hole);
    }

    // 4. World-Space Shockwave Rings
    for (const sr of this.shockRings) {
      const alpha = Math.max(0, sr.life / sr.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha * 0.85;
      ctx.strokeStyle = sr.color;
      ctx.lineWidth = 3 * alpha + 1;
      ctx.beginPath();
      ctx.ellipse(sr.x, sr.y, sr.radius, sr.radius * 0.65, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 5. Y-Depth-Sorted 2.5D Scene Renderables (Tables, Cone, Chefs, Charley, Flying Food!)
    const drawList: Array<{ y: number; draw: () => void }> = [];

    const px = rf ? rf.px : this.playerX;
    const py = rf ? rf.py : this.playerY;
    const grabPile = rf ? null : this.getNearestPile(px, py, 76);

    for (const p of this.piles) {
      if (p.count <= 0) continue;
      drawList.push({
        y: p.y,
        draw: () => this.drawFoodTable25D(ctx, p, p === grabPile),
      });
    }

    drawList.push({
      y: this.coneY + 6,
      draw: () => this.drawIceCreamCone25D(ctx, this.coneX, this.coneY, rf ? rf.coneMelt : this.coneMelt),
    });

    if (rf) {
      for (const rc of rf.chefs) {
        drawList.push({
          y: rc.y,
          draw: () =>
            this.drawChef25D(ctx, {
              name: '',
              color: rc.color,
              personality: 'pursuer',
              x: rc.x,
              y: rc.y,
              vx: 0,
              vy: 0,
              facing: rc.facing,
              state: rc.state,
              timer: 0.4,
              throwCooldown: 1,
              windup: 0,
              heldFood: null,
              splatColor: rc.splatColor,
              anim: this.time * 12,
            }),
        });
      }
    } else {
      for (const chef of this.chefs) {
        if (chef.state === 'respawning' && chef.timer > 0.55) continue;
        drawList.push({
          y: chef.y,
          draw: () => this.drawChef25D(ctx, chef),
        });
      }
    }

    if (this.phase !== 'GAME_OVER') {
      const blink = !rf && this.invulnTimer > 0 && Math.floor(this.time * 16) % 2 === 0;
      if (!blink) {
        drawList.push({
          y: py,
          draw: () =>
            this.drawCharley25D(ctx, px, py, rf ? rf.facingX : this.facingX, rf ? rf.dash : this.dashTimer > 0),
        });
      }
    }

    const activeProjectiles = rf
      ? rf.projectiles
      : this.projectiles.map((p) => ({ x: p.x, y: p.y, z: p.z, kind: p.kind, spin: p.spin }));
    for (const pr of activeProjectiles) {
      drawList.push({
        y: pr.y + 4,
        draw: () => this.drawFlyingFood25D(ctx, pr.x, pr.y, pr.z, pr.kind, pr.spin),
      });
    }

    drawList.sort((a, b) => a.y - b.y);
    for (const item of drawList) item.draw();

    // 6. 3D Scalloped Striped Café Awning + Glowing Bistro Festoon String Lights + Top HUD
    this.drawBistroAwningAndHud(ctx, theme, rf ? rf.coneMelt : this.coneMelt);

    ctx.restore();

    renderParticlesAndPopups(ctx, this.particles, this.popups);

    // Vintage Sepia Film-Reel Frame during authentic INSTANT REPLAY!
    if (rf) {
      ctx.save();
      ctx.fillStyle = 'rgba(245, 158, 11, 0.1)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      // Film-strip sprocket borders along left & right
      ctx.fillStyle = 'rgba(10, 12, 20, 0.85)';
      ctx.fillRect(0, 0, 26, HEIGHT);
      ctx.fillRect(WIDTH - 26, 0, 26, HEIGHT);
      ctx.fillStyle = '#FEF3C7';
      const sprocketOffset = (this.time * 110) % 34;
      for (let y = -34 + sprocketOffset; y < HEIGHT + 34; y += 34) {
        ctx.beginPath();
        ctx.roundRect(6, y, 14, 20, 3);
        ctx.roundRect(WIDTH - 20, y, 14, 20, 3);
        ctx.fill();
      }
      // Flashing top-center INSTANT REPLAY badge
      ctx.fillStyle = 'rgba(10, 12, 22, 0.9)';
      ctx.beginPath();
      ctx.roundRect(WIDTH * 0.5 - 220, HEIGHT - 76, 440, 56, 14);
      ctx.fill();
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '900 22px "Outfit", sans-serif';
      ctx.fillStyle = Math.floor(this.time * 6) % 2 === 0 ? '#FACC15' : '#FFFFFF';
      ctx.fillText('★ INSTANT REPLAY ★', WIDTH * 0.5, HEIGHT - 56);
      ctx.font = '600 12px "Outfit", sans-serif';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText(this.bannerSub, WIDTH * 0.5, HEIGHT - 35);
      ctx.restore();
    } else if (this.bannerText && (this.phase === 'READY' || this.phase === 'STAGE_CLEAR')) {
      ctx.save();
      const bw = 540;
      const bh = 94;
      const bx = (WIDTH - bw) * 0.5;
      const by = (HEIGHT - bh) * 0.48;
      const bg = ctx.createLinearGradient(bx, by, bx, by + bh);
      bg.addColorStop(0, 'rgba(12, 16, 30, 0.94)');
      bg.addColorStop(1, 'rgba(6, 9, 18, 0.92)');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 16);
      ctx.fill();
      ctx.strokeStyle = '#FB7185';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '900 30px "Outfit", sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(this.bannerText, WIDTH * 0.5, by + 35);
      if (this.bannerSub) {
        ctx.font = '600 14px "Outfit", sans-serif';
        ctx.fillStyle = '#FDA4AF';
        ctx.fillText(this.bannerSub, WIDTH * 0.5, by + 66);
      }
      ctx.restore();
    }

    if (visualMode === 'crt') renderCrtOverlay(ctx, WIDTH, HEIGHT);
  }

  private drawPatioFloor(ctx: CanvasRenderingContext2D, theme: PlazaTheme): void {
    ctx.fillStyle = theme.tileB;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const tileW = 64;
    const tileH = 52;
    for (let r = 1; r < Math.ceil(HEIGHT / tileH); r++) {
      for (let c = 0; c < Math.ceil(WIDTH / tileW); c++) {
        const even = (r + c) % 2 === 0;
        const x = c * tileW;
        const y = r * tileH;
        ctx.fillStyle = even ? theme.tileA : theme.tileB;
        ctx.fillRect(x, y, tileW, tileH);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
        ctx.fillRect(x + 1, y + 1, tileW - 2, 2);
        ctx.strokeStyle = theme.grout;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, tileW - 1, tileH - 1);
      }
    }

    // Warm overhead patio spotlight pool
    const spot = ctx.createRadialGradient(WIDTH * 0.52, HEIGHT * 0.54, 40, WIDTH * 0.52, HEIGHT * 0.54, WIDTH * 0.62);
    spot.addColorStop(0, 'rgba(254, 240, 138, 0.08)');
    spot.addColorStop(1, 'rgba(2, 6, 23, 0.36)');
    ctx.fillStyle = spot;
    ctx.fillRect(0, PLAY_TOP - 10, WIDTH, HEIGHT - PLAY_TOP + 10);

    // Decorative corner potted bistro plants along bottom border
    for (const px of [24, WIDTH - 24]) {
      ctx.fillStyle = '#92400E';
      ctx.beginPath();
      ctx.roundRect(px - 14, HEIGHT - 32, 28, 22, 4);
      ctx.fill();
      ctx.fillStyle = '#15803D';
      ctx.beginPath();
      ctx.arc(px, HEIGHT - 36, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4ADE80';
      ctx.beginPath();
      ctx.arc(px - 5, HEIGHT - 40, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawBistroAwningAndHud(ctx: CanvasRenderingContext2D, theme: PlazaTheme, melt: number): void {
    // Awning drop shadow cast onto patio floor
    ctx.fillStyle = 'rgba(2, 6, 23, 0.48)';
    ctx.fillRect(0, 68, WIDTH, 18);

    // Scalloped 3D Bistro Awning Stripes
    const stripeW = 48;
    for (let x = 0; x < WIDTH; x += stripeW) {
      const a = Math.floor(x / stripeW) % 2 === 0;
      const g = ctx.createLinearGradient(0, 0, 0, 68);
      g.addColorStop(0, a ? theme.awningA : theme.awningB);
      g.addColorStop(0.75, a ? theme.awningA2 : theme.awningB2);
      g.addColorStop(1, a ? theme.awningA : theme.awningB);
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, stripeW, 56);
      ctx.beginPath();
      ctx.arc(x + stripeW * 0.5, 56, stripeW * 0.5, 0, Math.PI);
      ctx.fill();
    }

    // Festoon glowing patio café string lights draped below awning!
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= WIDTH; x += 12) {
      const sag = Math.sin((x / 144) * Math.PI) * 10;
      const ly = 72 + Math.abs(sag);
      if (x === 0) ctx.moveTo(x, ly);
      else ctx.lineTo(x, ly);
    }
    ctx.stroke();

    for (let x = 36; x < WIDTH; x += 72) {
      const sag = Math.abs(Math.sin((x / 144) * Math.PI)) * 10;
      const ly = 74 + sag;
      const glow = 0.65 + 0.35 * Math.sin(this.time * 4 + x * 0.05);
      ctx.fillStyle = theme.bulbGlow;
      ctx.globalAlpha = 0.35 * glow;
      ctx.beginPath();
      ctx.arc(x, ly, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(x, ly, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Floating Bistro Marquee HUD Bar integrated cleanly on top of awning
    ctx.fillStyle = 'rgba(8, 12, 24, 0.86)';
    ctx.beginPath();
    ctx.roundRect(18, 10, WIDTH - 36, 42, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textBaseline = 'middle';
    // Left: Venue & Controls
    ctx.textAlign = 'left';
    ctx.font = '800 15px "Outfit", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`LV.${this.level} · ${theme.name.toUpperCase()}`, 34, 24);
    ctx.font = '500 11px "Outfit", sans-serif';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('Space/Click: Throw Food · Shift/X: Dive-Roll Dodge', 34, 41);

    // Center: Live Melting Ice Cream Cone Meter
    const pct = Math.max(0, 1 - melt);
    const urgent = pct < 0.28;
    const barW = 280;
    const barX = WIDTH * 0.5 - barW * 0.5;
    ctx.textAlign = 'center';
    ctx.font = '800 12px "Outfit", sans-serif';
    ctx.fillStyle = urgent && Math.floor(this.time * 8) % 2 === 0 ? '#FB7185' : '#FBCFE8';
    ctx.fillText(`ICE CREAM CONE: ${Math.round(pct * 100)}% LEFT`, WIDTH * 0.5, 22);

    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.roundRect(barX, 32, barW, 11, 5.5);
    ctx.fill();
    const mGrad = ctx.createLinearGradient(barX, 32, barX + barW, 32);
    mGrad.addColorStop(0, urgent ? '#EF4444' : '#EC4899');
    mGrad.addColorStop(1, urgent ? '#F97316' : '#FBCFE8');
    ctx.fillStyle = mGrad;
    if (pct > 0) {
      ctx.beginPath();
      ctx.roundRect(barX, 32, Math.max(10, barW * pct), 11, 5.5);
      ctx.fill();
    }

    // Right: Score & Lives
    ctx.textAlign = 'right';
    ctx.font = '800 16px "JetBrains Mono", monospace';
    ctx.fillStyle = '#FACC15';
    ctx.fillText(`${this.score.toLocaleString()} PTS`, WIDTH - 34, 24);
    ctx.font = '600 11px "Outfit", sans-serif';
    ctx.fillStyle = '#CBD5E1';
    ctx.fillText(`CHEFS SPLATTED: ${this.chefsSplattedThisStage} · LIVES: ${this.lives}`, WIDTH - 34, 41);
  }

  private drawChefHole(ctx: CanvasRenderingContext2D, hole: ChefHole): void {
    ctx.save();
    ctx.translate(hole.x, hole.y);

    // Beveled stone manhole rim
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.ellipse(0, 2, 34, 21, 0, 0, Math.PI * 2);
    ctx.fill();

    // Deep dark subterranean void
    const vg = ctx.createRadialGradient(0, 3, 4, 0, 0, 30);
    vg.addColorStop(0, '#000000');
    vg.addColorStop(0.7, '#020617');
    vg.addColorStop(1, '#1E293B');
    ctx.fillStyle = vg;
    ctx.beginPath();
    ctx.ellipse(0, 0, 29, 17, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(226, 232, 240, 0.25)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, 0, 29, 17, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawFoodTable25D(ctx: CanvasRenderingContext2D, pile: FoodPile, inRange: boolean): void {
    const bounceY = Math.sin(pile.bounce * Math.PI) * -5;
    ctx.save();
    ctx.translate(pile.x, pile.y);

    // Golden animated grab ring when Charley is within throwing range!
    if (inRange) {
      const pulse = 0.7 + 0.3 * Math.sin(this.time * 10);
      ctx.strokeStyle = '#FACC15';
      ctx.shadowColor = '#FACC15';
      ctx.shadowBlur = 14 * pulse;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 14, 42, 24, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // 2.5D Bistro Café Pedestal Table shadow & stand
    ctx.fillStyle = 'rgba(2, 6, 23, 0.5)';
    ctx.beginPath();
    ctx.ellipse(0, 17, 32, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pedestal leg
    ctx.fillStyle = '#475569';
    ctx.fillRect(-5, 2, 10, 15);
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.ellipse(0, 16, 15, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tabletop with checkered linen cloth & silver platter rim
    ctx.translate(0, bounceY);
    ctx.fillStyle = '#94A3B8';
    ctx.beginPath();
    ctx.ellipse(0, 4, 30, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    const topG = ctx.createRadialGradient(-8, -2, 2, 0, 1, 29);
    topG.addColorStop(0, '#FFFFFF');
    topG.addColorStop(0.75, '#E2E8F0');
    topG.addColorStop(1, '#94A3B8');
    ctx.fillStyle = topG;
    ctx.beginPath();
    ctx.ellipse(0, 1, 27, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Stack up to 4 sculpted 2.5D food items on the platter
    const shown = Math.min(4, pile.count);
    const offsets: Array<[number, number]> = [
      [-11, 2],
      [11, 2],
      [0, -4],
      [0, -13],
    ];
    for (let i = 0; i < shown; i++) {
      this.drawFoodItem(ctx, offsets[i][0], offsets[i][1], pile.kind, 0, 1.0);
    }

    // Crisp remaining count pill if player is in range
    if (inRange) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.beginPath();
      ctx.roundRect(-34, -36, 68, 18, 9);
      ctx.fill();
      ctx.font = '800 10px "Outfit", sans-serif';
      ctx.fillStyle = '#FEF08A';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${FOOD_SPECS[pile.kind].label.toUpperCase()} ×${pile.count}`, 0, -27);
    }

    ctx.restore();
  }

  private drawFlyingFood25D(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    z: number,
    kind: FoodKind,
    spin: number
  ): void {
    // Ground drop shadow shows 2.5D parabolic height!
    const shadowScale = Math.max(0.45, 1 - z / 90);
    ctx.fillStyle = 'rgba(2, 6, 23, 0.42)';
    ctx.beginPath();
    ctx.ellipse(x, y + 8, 14 * shadowScale, 6.5 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Airborne rotating food sprite elevated by `z`
    const airScale = 1.12 + Math.min(0.32, z / 110);
    this.drawFoodItem(ctx, x, y - z, kind, spin, airScale);
  }

  private drawFoodItem(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    kind: FoodKind,
    rot: number,
    scale: number
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(scale, scale);

    if (kind === 'watermelon') {
      ctx.fillStyle = '#15803D';
      ctx.beginPath();
      ctx.arc(0, -2, 15, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#DCFCE7';
      ctx.beginPath();
      ctx.arc(0, -2, 12.2, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(0, -2, 10.6, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(-5, 1, 2, 3);
      ctx.fillRect(0, 3.5, 2, 3);
      ctx.fillRect(4.5, 1, 2, 3);
    } else if (kind === 'pie') {
      ctx.fillStyle = '#B45309';
      ctx.beginPath();
      ctx.ellipse(0, 5, 15, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      const cream = ctx.createRadialGradient(-4, -3, 1, 0, 0, 13);
      cream.addColorStop(0, '#FFFFFF');
      cream.addColorStop(0.7, '#FEF3C7');
      cream.addColorStop(1, '#FDE68A');
      ctx.fillStyle = cream;
      ctx.beginPath();
      ctx.arc(0, 2, 12, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(0, -10, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-1, -11, 1.1, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'tomato') {
      const tg = ctx.createRadialGradient(-3, -3, 1, 0, 1, 12);
      tg.addColorStop(0, '#FCA5A5');
      tg.addColorStop(0.45, '#EF4444');
      tg.addColorStop(1, '#991B1B');
      ctx.fillStyle = tg;
      ctx.beginPath();
      ctx.arc(0, 1, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#22C55E';
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(5, -7);
      ctx.lineTo(-5, -7);
      ctx.closePath();
      ctx.fill();
    } else if (kind === 'banana') {
      ctx.strokeStyle = '#CA8A04';
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, -3, 11, 0.2 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 5;
      ctx.stroke();
    } else if (kind === 'meatball') {
      const mg = ctx.createRadialGradient(-3, -3, 1, 0, 0, 12);
      mg.addColorStop(0, '#D97706');
      mg.addColorStop(0.5, '#92400E');
      mg.addColorStop(1, '#451A03');
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.arc(0, 0, 10.5, 0, Math.PI * 2);
      ctx.fill();
      // Marinara sauce glaze
      ctx.fillStyle = 'rgba(239, 68, 68, 0.72)';
      ctx.beginPath();
      ctx.ellipse(-2, -4, 6, 3.2, -0.3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      for (const [px, py] of [
        [-6, 2],
        [6, 2],
        [0, -5],
      ]) {
        ctx.fillStyle = '#22C55E';
        ctx.beginPath();
        ctx.arc(px, py, 5.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#DCFCE7';
        ctx.beginPath();
        ctx.arc(px - 1.5, py - 1.6, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private drawIceCreamCone25D(ctx: CanvasRenderingContext2D, x: number, y: number, melt: number): void {
    ctx.save();
    ctx.translate(x, y);

    // Sculpted Marble Bistro Pedestal + Glowing Goal Ring
    const pulse = 0.6 + 0.4 * Math.sin(this.time * (melt > 0.7 ? 12 : 4));
    const goalAura = ctx.createRadialGradient(0, 26, 6, 0, 26, 68);
    goalAura.addColorStop(0, `rgba(244, 114, 182, ${0.42 * pulse})`);
    goalAura.addColorStop(1, 'rgba(244, 114, 182, 0)');
    ctx.fillStyle = goalAura;
    ctx.beginPath();
    ctx.ellipse(0, 32, 68, 36, 0, 0, Math.PI * 2);
    ctx.fill();

    // Expanding Glossy Melted Ice Cream Puddle!
    ctx.fillStyle = 'rgba(244, 114, 182, 0.72)';
    ctx.beginPath();
    ctx.ellipse(0, 40, 20 + melt * 44, 8 + melt * 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(254, 243, 199, 0.55)';
    ctx.beginPath();
    ctx.ellipse(6, 38, 12 + melt * 24, 5 + melt * 8, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Cross-hatched Golden Waffle Cone
    const coneG = ctx.createLinearGradient(-22, 2, 22, 46);
    coneG.addColorStop(0, '#FDE047');
    coneG.addColorStop(0.5, '#D97706');
    coneG.addColorStop(1, '#78350F');
    ctx.fillStyle = coneG;
    ctx.beginPath();
    ctx.moveTo(-22, 4);
    ctx.lineTo(22, 4);
    ctx.lineTo(0, 46);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(120, 53, 15, 0.55)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-14, 11);
    ctx.lineTo(9, 29);
    ctx.moveTo(-6, 6);
    ctx.lineTo(14, 21);
    ctx.moveTo(14, 11);
    ctx.lineTo(-9, 29);
    ctx.stroke();

    // Towering Shrinking Triple-Scoop Ice Cream (Chocolate + Strawberry + Vanilla + Cherry!)
    const scoopScale = Math.max(0.18, 1 - melt * 0.84);
    ctx.save();
    ctx.translate(0, 6 - scoopScale * 14);
    ctx.scale(scoopScale, scoopScale);

    // Bottom Chocolate Scoop
    const sc0 = ctx.createRadialGradient(-6, 4, 2, 0, 6, 24);
    sc0.addColorStop(0, '#D97706');
    sc0.addColorStop(0.5, '#92400E');
    sc0.addColorStop(1, '#451A03');
    ctx.fillStyle = sc0;
    ctx.beginPath();
    ctx.arc(0, 8, 22, 0, Math.PI * 2);
    ctx.fill();

    // Middle Strawberry Scoop
    const sc1 = ctx.createRadialGradient(-6, -12, 2, 0, -9, 22);
    sc1.addColorStop(0, '#FCE7F3');
    sc1.addColorStop(0.45, '#F472B6');
    sc1.addColorStop(1, '#BE185D');
    ctx.fillStyle = sc1;
    ctx.beginPath();
    ctx.arc(0, -10, 20, 0, Math.PI * 2);
    ctx.fill();

    // Top Vanilla Scoop + Sprinkles
    const sc2 = ctx.createRadialGradient(-4, -29, 2, 0, -25, 17);
    sc2.addColorStop(0, '#FFFFFF');
    sc2.addColorStop(0.65, '#FEF3C7');
    sc2.addColorStop(1, '#FDE68A');
    ctx.fillStyle = sc2;
    ctx.beginPath();
    ctx.arc(0, -26, 16, 0, Math.PI * 2);
    ctx.fill();

    // Glossy Cherry on Top + Sparkle Glint
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(0, -43, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-2, -45, 1.8, 0, Math.PI * 2);
    ctx.fill();
    drawStarGlint(ctx, 12, -38, 8, '#FFFFFF', this.time * 4);
    ctx.restore();

    ctx.restore();
  }

  private drawCharley25D(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    facingX: number,
    dashing: boolean
  ): void {
    const stride = Math.sin(this.playerAnim);
    const bounce = Math.abs(stride) * 3;

    ctx.save();
    ctx.translate(x, y - bounce);

    // Ground contact shadow
    ctx.fillStyle = 'rgba(2, 6, 23, 0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 20 + bounce, 18, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    if (dashing) {
      // Energetic spin-roll tumble!
      ctx.rotate(this.time * 24 * (facingX >= 0 ? 1 : -1));
      ctx.shadowColor = '#FACC15';
      ctx.shadowBlur = 14;
    }

    if (facingX < -0.1) ctx.scale(-1, 1);

    // Articulated jeans & bright sneakers
    ctx.fillStyle = '#2563EB';
    ctx.beginPath();
    ctx.roundRect(-9 + stride * 5.5, 6, 7.5, 11, 3);
    ctx.roundRect(2 - stride * 5.5, 6, 7.5, 11, 3);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-10 + stride * 5.5, 15, 9.5, 4);
    ctx.fillRect(1 - stride * 5.5, 15, 9.5, 4);

    // Classic Charley Chuck yellow tee with crimson chest stripe
    const teeG = ctx.createLinearGradient(-13, -10, 13, 10);
    teeG.addColorStop(0, '#FEF08A');
    teeG.addColorStop(0.55, '#FACC15');
    teeG.addColorStop(1, '#CA8A04');
    ctx.fillStyle = teeG;
    ctx.beginPath();
    ctx.roundRect(-13, -9, 26, 18, 7);
    ctx.fill();
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(-12, -2, 24, 3.5);

    // Throwing arm animation!
    ctx.save();
    ctx.translate(9, -3);
    ctx.rotate(this.throwAnim > 0 ? -1.5 + (1 - this.throwAnim) * 2.5 : stride * 0.4);
    ctx.fillStyle = '#FDBA74';
    ctx.beginPath();
    ctx.roundRect(-3, -2, 13, 6, 3);
    ctx.fill();
    ctx.restore();

    // Expressive Head, Big Grin & Red Baseball Cap
    ctx.fillStyle = '#FDBA74';
    ctx.beginPath();
    ctx.arc(0, -17, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(0, -20.5, 12, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(1, -21.5, 13.5, 4);
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.ellipse(4.5, -18, 1.8, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7C2D12';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(4, -13, 4.2, 0.1, Math.PI * 0.85);
    ctx.stroke();

    ctx.restore();
  }

  private drawChef25D(ctx: CanvasRenderingContext2D, chef: Chef): void {
    const stride = Math.sin(chef.anim);
    const bounce = chef.state === 'active' ? Math.abs(stride) * 2.5 : 0;

    ctx.save();
    ctx.translate(chef.x, chef.y - bounce);

    // Emerging pop-up animation out of the dark hole!
    if (chef.state === 'respawning') {
      const emerge = Math.max(0.15, 1 - chef.timer / 0.55);
      ctx.translate(0, (1 - emerge) * 18);
      ctx.scale(0.85 + emerge * 0.15, emerge);
    }

    if (chef.state === 'splatted') {
      ctx.rotate(Math.sin(this.time * 16) * 0.18 + 0.35);
    }

    // Contact shadow
    ctx.fillStyle = 'rgba(2, 6, 23, 0.44)';
    ctx.beginPath();
    ctx.ellipse(0, 19 + bounce, 17, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.scale(chef.facing, 1);

    // Kicking black chef shoes
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.roundRect(-10 + stride * 4.5, 12, 8.5, 6.5, 3);
    ctx.roundRect(2 - stride * 4.5, 12, 8.5, 6.5, 3);
    ctx.fill();

    // Colored Chef Coat + Crisp White Apron & Double-Breasted Buttons
    ctx.fillStyle = chef.color;
    ctx.beginPath();
    ctx.roundRect(-14.5, -8, 29, 24, 7);
    ctx.fill();
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.roundRect(-9.5, -5, 19, 19, 4);
    ctx.fill();
    ctx.fillStyle = '#334155';
    for (const [bx, by] of [
      [-4, -1],
      [2, -1],
      [-4, 5],
      [2, 5],
    ]) {
      ctx.fillRect(bx, by, 2.4, 2.4);
    }

    // Face, Eyebrows & Signature Handlebar Mustache
    ctx.fillStyle = '#FDBA74';
    ctx.beginPath();
    ctx.arc(0, -16, 11.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(-4.5, -19, 2.6, 3.2);
    ctx.fillRect(2.5, -19, 2.6, 3.2);
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.ellipse(-4, -12.5, 5.2, 2.2, -0.16, 0, Math.PI * 2);
    ctx.ellipse(4, -12.5, 5.2, 2.2, 0.16, 0, Math.PI * 2);
    ctx.fill();

    // Tall Pleated Puffy White Toque Chef Hat!
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(-11, -30, 22, 9);
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-7, -31.5, 7, 0, Math.PI * 2);
    ctx.arc(0, -35.5, 8.5, 0, Math.PI * 2);
    ctx.arc(7, -31.5, 7, 0, Math.PI * 2);
    ctx.fill();

    // Hilarious Pie/Food Splat Coating on Face when Splatted!
    if (chef.state === 'splatted') {
      ctx.fillStyle = chef.splatColor;
      ctx.beginPath();
      ctx.arc(1, -15, 11, 0, Math.PI * 2);
      ctx.arc(7, -11, 5.5, 0, Math.PI * 2);
      ctx.arc(-5, -9, 4.5, 0, Math.PI * 2);
      ctx.fill();
      // Dizzy orbiting stars above chef hat!
      for (let s = 0; s < 3; s++) {
        const a = this.time * 7 + (s * Math.PI * 2) / 3;
        drawStarGlint(ctx, Math.cos(a) * 16, -42 + Math.sin(a) * 5, 6, '#FACC15', this.time * 8);
      }
    }

    ctx.restore();

    // Telegraph food held overhead during throw windup!
    if (chef.windup > 0 && chef.heldFood) {
      this.drawFoodItem(ctx, chef.facing * 10, -44, chef.heldFood, this.time * 8, 1.05);
    }

    ctx.restore();
  }
}

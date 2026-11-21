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
  spawnBurst,
  stepParticlesAndPopups,
} from './classicArcadeInterface';

const W = 560;
const H = 680;
const STORAGE_KEY = 'ww1942_hd_highscore_v1';

interface TheaterPalette {
  name: string;
  toTokyo: number;
  oceanTop: string;
  oceanMid: string;
  oceanBot: string;
  waveColor: string;
  lagoonColor: string;
  sandColor: string;
  jungleDark: string;
  jungleLight: string;
  cloudTint: string;
}

const THEATERS: TheaterPalette[] = [
  {
    name: 'MIDWAY ATOLL',
    toTokyo: 32,
    oceanTop: '#035397',
    oceanMid: '#0768B5',
    oceanBot: '#023E73',
    waveColor: 'rgba(186, 230, 253, 0.28)',
    lagoonColor: 'rgba(45, 212, 191, 0.38)',
    sandColor: '#E7C98A',
    jungleDark: '#14532D',
    jungleLight: '#22C55E',
    cloudTint: 'rgba(241, 245, 249, 0.24)',
  },
  {
    name: 'CORAL SEA',
    toTokyo: 24,
    oceanTop: '#026B8A',
    oceanMid: '#0891B2',
    oceanBot: '#044E68',
    waveColor: 'rgba(165, 243, 252, 0.3)',
    lagoonColor: 'rgba(103, 232, 249, 0.42)',
    sandColor: '#F3D9A4',
    jungleDark: '#166534',
    jungleLight: '#4ADE80',
    cloudTint: 'rgba(240, 253, 250, 0.22)',
  },
  {
    name: 'OKINAWA SUNSET',
    toTokyo: 16,
    oceanTop: '#312E81',
    oceanMid: '#4338CA',
    oceanBot: '#1E1B4B',
    waveColor: 'rgba(253, 186, 116, 0.26)',
    lagoonColor: 'rgba(251, 146, 60, 0.28)',
    sandColor: '#D4A373',
    jungleDark: '#14532D',
    jungleLight: '#15803D',
    cloudTint: 'rgba(254, 215, 170, 0.24)',
  },
  {
    name: 'TOKYO HARBOR',
    toTokyo: 8,
    oceanTop: '#0F172A',
    oceanMid: '#1E3A5F',
    oceanBot: '#091124',
    waveColor: 'rgba(148, 163, 184, 0.24)',
    lagoonColor: 'rgba(56, 189, 248, 0.22)',
    sandColor: '#94A3B8',
    jungleDark: '#1E293B',
    jungleLight: '#334155',
    cloudTint: 'rgba(203, 213, 225, 0.2)',
  },
];

type EnemyKind = 'zero' | 'red_ace' | 'silver_bomber' | 'blue_diver' | 'ayako';
type PowKind = 'quad' | 'wingmen' | 'crash' | 'roll' | 'yashichi' | '1up';

interface PlayerBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  heavy: boolean;
}

interface EnemyBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  large?: boolean;
}

interface EnemyPlane {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  score: number;
  age: number;
  fireCd: number;
  formationId?: number;
  pattern: 'straight' | 'sine' | 'loop_left' | 'loop_right' | 'dive' | 'boss';
  angle: number;
  hitFlash: number;
  turretAngle: number;
}

interface PowPickup {
  x: number;
  y: number;
  vy: number;
  kind: PowKind;
  age: number;
}

interface AtollIsland {
  x: number;
  y: number;
  rx: number;
  ry: number;
  rot: number;
  hasRunway: boolean;
  seed: number;
}

interface CloudPuff {
  x: number;
  y: number;
  r: number;
  speed: number;
  alpha: number;
}

interface SmokePuff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  maxLife: number;
  dark: boolean;
}

interface FireballRing {
  x: number;
  y: number;
  r: number;
  maxR: number;
  life: number;
  maxLife: number;
  color: string;
}

export class Ww1942Game implements ArcadeGameInstance {
  public readonly logicalWidth = W;
  public readonly logicalHeight = H;
  public readonly supportsPointerAim = true;
  public readonly primaryActionLabel = 'FIRE';
  public readonly secondaryActionLabel = 'LOOP ROLL';

  private phase: ClassicGamePhase = 'TITLE';
  private score = 0;
  private highScore = 0;
  private level = 1;
  private lives = 3;
  private nextExtraLife = 30000;
  private elapsed = 0;
  private phaseTimer = 0;
  private bannerText = '1942 · SUPER ACE PACIFIC CAMPAIGN';

  // Player P-38 Lightning state
  private px = W * 0.5;
  private py = H - 110;
  private bank = 0; // -1..1 wing roll banking
  private quadGun = false;
  private wingmen = 0; // 0, 1, or 2 escort planes
  private rollsLeft = 3;
  private rollTimer = 0; // > 0 during 360° vertical loop-the-loop
  private invulnTimer = 0;
  private fireCd = 0;
  private muzzleFlash = 0;

  // Stage & Carrier Launch/Landing sequence
  private stageScroll = 0;
  private stageLength = 2300;
  private takeoffTimer = 0; // > 0 during carrier deck takeoff
  private landingTimer = 0; // > 0 during stage-clear carrier touchdown
  private carrierY = H - 80;
  private bossSpawned = false;
  private bossDefeated = false;
  private enemiesSpawned = 0;
  private enemiesDestroyed = 0;
  private lastShotDownPct = 0;
  private lastRollBonus = 0;

  // Formations & Entities
  private nextId = 1;
  private nextFormationId = 1;
  private formationRemaining = new Map<number, number>();
  private powCycleIndex = 0;
  private spawnCd = 0.6;
  private redWaveCd = 3.2;
  private bomberCd = 6.5;

  private pBullets: PlayerBullet[] = [];
  private eBullets: EnemyBullet[] = [];
  private enemies: EnemyPlane[] = [];
  private pows: PowPickup[] = [];
  private islands: AtollIsland[] = [];
  private clouds: CloudPuff[] = [];
  private smokes: SmokePuff[] = [];
  private rings: FireballRing[] = [];
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];
  private shakeTimer = 0;
  private flashTimer = 0;

  private input: ArcadeInputState = createEmptyInput();

  constructor() {
    this.highScore = readHighScore(STORAGE_KEY);
    this.seedEnvironment();
    this.seedAttractScene();
  }

  private getTheater(): TheaterPalette {
    return THEATERS[(this.level - 1) % THEATERS.length];
  }

  private seedEnvironment(): void {
    this.islands = [
      { x: 105, y: 120, rx: 58, ry: 40, rot: -0.3, hasRunway: false, seed: 1 },
      { x: 445, y: 310, rx: 72, ry: 48, rot: 0.45, hasRunway: true, seed: 2 },
      { x: 170, y: 540, rx: 52, ry: 34, rot: 0.2, hasRunway: false, seed: 3 },
      { x: 410, y: -90, rx: 64, ry: 42, rot: -0.5, hasRunway: false, seed: 4 },
    ];
    this.clouds = [
      { x: 90, y: 90, r: 46, speed: 128, alpha: 0.85 },
      { x: 470, y: 220, r: 58, speed: 144, alpha: 0.78 },
      { x: 260, y: 460, r: 52, speed: 135, alpha: 0.72 },
      { x: 130, y: 610, r: 42, speed: 122, alpha: 0.65 },
    ];
  }

  private seedAttractScene(): void {
    this.pBullets = [];
    this.eBullets = [];
    this.enemies = [];
    this.pows = [];
    this.smokes = [];
    this.rings = [];
    this.particles = [];
    this.popups = [];
    this.px = W * 0.5;
    this.py = H - 125;
    this.quadGun = true;
    this.wingmen = 2;
    this.rollsLeft = 3;
    this.rollTimer = 0;
    this.carrierY = H + 260;

    // Immediate lively Pacific dogfight for cabinet preview!
    this.spawnRedFormation(true);
    this.enemies.push({
      id: this.nextId++,
      kind: 'ayako',
      x: W * 0.5,
      y: 138,
      vx: 38,
      vy: 0,
      hp: 40,
      maxHp: 40,
      score: 5000,
      age: 1.2,
      fireCd: 1.1,
      pattern: 'boss',
      angle: Math.PI / 2,
      hitFlash: 0,
      turretAngle: Math.PI / 2,
    });
    this.pows.push({ x: W * 0.34, y: 310, vy: 42, kind: 'quad', age: 0 });
  }

  public startNewGame(): void {
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.nextExtraLife = 30000;
    this.quadGun = false;
    this.wingmen = 0;
    this.powCycleIndex = 0;
    this.setupStage(1);
    arcadeAudio.playCarrierTakeoff();
  }

  private setupStage(lv: number): void {
    this.level = lv;
    this.phase = 'PLAYING';
    this.stageScroll = 0;
    this.stageLength = 2100 + Math.min(4, lv - 1) * 350;
    this.takeoffTimer = 1.75;
    this.landingTimer = 0;
    this.carrierY = H - 115;
    this.bossSpawned = false;
    this.bossDefeated = false;
    this.enemiesSpawned = 0;
    this.enemiesDestroyed = 0;
    this.rollsLeft = Math.max(this.rollsLeft, 3);
    this.rollTimer = 0;
    this.invulnTimer = 2.0;
    this.px = W * 0.5;
    this.py = H - 105;
    this.bank = 0;
    this.pBullets = [];
    this.eBullets = [];
    this.enemies = [];
    this.pows = [];
    this.smokes = [];
    this.rings = [];
    this.particles = [];
    this.popups = [];
    this.spawnCd = 1.1;
    this.redWaveCd = 3.2;
    this.bomberCd = 6.2;
    this.formationRemaining.clear();

    const th = this.getTheater();
    this.bannerText = `STAGE ${lv} · ${th.name} · TO TOKYO: ${Math.max(1, th.toTokyo - Math.floor((lv - 1) / 4) * 4)}`;
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.level = 1;
    this.bannerText = '1942 · SUPER ACE PACIFIC CAMPAIGN';
    this.seedAttractScene();
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public getHudSnapshot(): ClassicGameHud {
    const th = this.getTheater();
    const toTokyo = Math.max(1, 33 - this.level);
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: `STAGE ${this.level} · ${th.name}`,
      primaryMetricLabel: 'ROLLS',
      primaryMetricValue: `${'●'.repeat(Math.min(5, this.rollsLeft)) || '0'} (${this.rollsLeft})`,
      secondaryMetricLabel: 'TO TOKYO',
      secondaryMetricValue: `${toTokyo} · ${this.quadGun ? 'QUAD' : 'TWIN'}${this.wingmen > 0 ? `+${this.wingmen}W` : ''}`,
      bannerText: this.bannerText,
    };
  }

  private addScore(pts: number, x?: number, y?: number, color = '#FEF08A', label?: string): void {
    if (this.phase !== 'PLAYING' && this.phase !== 'STAGE_CLEAR') return;
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(STORAGE_KEY, this.highScore);
    }
    if (this.score >= this.nextExtraLife) {
      this.nextExtraLife += 50000;
      this.lives = Math.min(6, this.lives + 1);
      arcadeAudio.playExtraLife();
      this.popups.push({
        x: this.px,
        y: this.py - 34,
        text: '1UP BONUS ACE!',
        color: '#4ADE80',
        life: 1.4,
        maxLife: 1.4,
      });
    }
    if (x !== undefined && y !== undefined) {
      this.popups.push({
        x,
        y,
        text: label ?? `+${pts}`,
        color,
        life: 0.95,
        maxLife: 0.95,
      });
    }
  }

  private spawnRedFormation(attract = false): void {
    const fid = this.nextFormationId++;
    const count = 5;
    const fromLeft = Math.random() < 0.5;
    const startX = fromLeft ? 78 : W - 78;
    const pattern: EnemyPlane['pattern'] = fromLeft ? 'loop_right' : 'loop_left';
    this.formationRemaining.set(fid, count);
    for (let i = 0; i < count; i++) {
      this.enemies.push({
        id: this.nextId++,
        kind: 'red_ace',
        x: startX + (fromLeft ? -i * 12 : i * 12),
        y: (attract ? 140 : -36) - i * 44,
        vx: fromLeft ? 48 : -48,
        vy: 155 + this.level * 6,
        hp: 1,
        maxHp: 1,
        score: 200,
        age: -i * 0.16,
        fireCd: 1.0 + i * 0.28,
        formationId: fid,
        pattern,
        angle: Math.PI / 2,
        hitFlash: 0,
        turretAngle: Math.PI / 2,
      });
      if (!attract) this.enemiesSpawned++;
    }
  }

  private spawnPow(x: number, y: number): void {
    const order: PowKind[] = ['quad', 'wingmen', 'roll', 'crash', 'yashichi', '1up'];
    // Favor quad -> wingmen first so players immediately feel iconic 1942 progression!
    let kind: PowKind;
    if (!this.quadGun) kind = 'quad';
    else if (this.wingmen < 2 && this.powCycleIndex % 2 === 1) kind = 'wingmen';
    else kind = order[this.powCycleIndex % order.length];
    this.powCycleIndex++;

    this.pows.push({
      x: Math.max(46, Math.min(W - 46, x)),
      y: Math.max(54, Math.min(H - 180, y)),
      vy: 66,
      kind,
      age: 0,
    });
  }

  private spawnAyakoBoss(): void {
    this.bossSpawned = true;
    const maxHp = 44 + this.level * 14;
    this.enemies.push({
      id: this.nextId++,
      kind: 'ayako',
      x: W * 0.5,
      y: -95,
      vx: 58 + this.level * 5,
      vy: 64,
      hp: maxHp,
      maxHp,
      score: 5000 + this.level * 1000,
      age: 0,
      fireCd: 1.1,
      pattern: 'boss',
      angle: Math.PI / 2,
      hitFlash: 0,
      turretAngle: Math.PI / 2,
    });
    this.enemiesSpawned++;
    this.bannerText = 'WARNING! GIANT AYAKO SUPER-BOMBER APPROACHING!';
    arcadeAudio.playSirenSweep();
  }

  private firePlayerVolley(attract = false): void {
    const spd = -690;
    if (this.quadGun) {
      // Iconic 1942 Quad Gun — wide 4-barrel parallel burst!
      this.pBullets.push(
        { x: this.px - 15, y: this.py - 14, vx: -12, vy: spd, heavy: true },
        { x: this.px - 5, y: this.py - 22, vx: 0, vy: spd, heavy: true },
        { x: this.px + 5, y: this.py - 22, vx: 0, vy: spd, heavy: true },
        { x: this.px + 15, y: this.py - 14, vx: 12, vy: spd, heavy: true }
      );
    } else {
      this.pBullets.push(
        { x: this.px - 8, y: this.py - 20, vx: 0, vy: spd, heavy: false },
        { x: this.px + 8, y: this.py - 20, vx: 0, vy: spd, heavy: false }
      );
    }

    // Synchronized Wingmen fire!
    if (this.wingmen >= 1) {
      this.pBullets.push({ x: this.px - 42, y: this.py - 2, vx: 0, vy: spd, heavy: false });
    }
    if (this.wingmen >= 2) {
      this.pBullets.push({ x: this.px + 42, y: this.py - 2, vx: 0, vy: spd, heavy: false });
    }

    this.muzzleFlash = 0.065;
    if (!attract) arcadeAudio.playLaser(this.quadGun ? 980 : 860, 260, 0.05);
  }

  private triggerLoopRoll(attract = false): void {
    if (this.rollTimer > 0 || this.rollsLeft <= 0) return;
    if (!attract) this.rollsLeft--;
    this.rollTimer = 1.05;
    if (!attract) {
      arcadeAudio.playLoopRoll();
      this.popups.push({
        x: this.px,
        y: this.py - 28,
        text: 'LOOP-THE-LOOP!',
        color: '#38BDF8',
        life: 0.85,
        maxLife: 0.85,
      });
    }
  }

  private damagePlayer(): void {
    if (this.invulnTimer > 0 || this.rollTimer > 0 || this.takeoffTimer > 0 || this.landingTimer > 0) {
      return;
    }
    // Wingman absorbs a hit just like classic 1942!
    if (this.wingmen > 0) {
      const wx = this.wingmen === 2 ? this.px + 42 : this.px - 42;
      this.wingmen--;
      this.invulnTimer = 1.25;
      this.shakeTimer = 0.2;
      arcadeAudio.playExplosion(false);
      spawnBurst(this.particles, wx, this.py + 6, '#F97316', 18, 200, 3.6);
      this.rings.push({ x: wx, y: this.py + 6, r: 6, maxR: 40, life: 0.35, maxLife: 0.35, color: '#FB923C' });
      this.popups.push({
        x: wx,
        y: this.py - 16,
        text: 'WINGMAN DOWN!',
        color: '#FB923C',
        life: 1.0,
        maxLife: 1.0,
      });
      return;
    }

    this.lives--;
    this.quadGun = false;
    this.invulnTimer = 2.6;
    this.shakeTimer = 0.4;
    this.flashTimer = 0.22;
    arcadeAudio.playExplosion(true);
    spawnBurst(this.particles, this.px, this.py, '#F97316', 32, 260, 4.4);
    this.rings.push({ x: this.px, y: this.py, r: 10, maxR: 72, life: 0.45, maxLife: 0.45, color: '#FACC15' });

    if (this.lives <= 0) {
      this.phase = 'GAME_OVER';
      this.bannerText = 'SUPER ACE SHOT DOWN · PRESS START TO FLY AGAIN';
    } else {
      this.rollsLeft = Math.max(this.rollsLeft, 3);
      this.px = W * 0.5;
      this.py = H - 105;
      this.eBullets = [];
    }
  }

  public step(dt: number): void {
    const safeDt = Math.min(0.05, Math.max(0, dt));
    this.elapsed += safeDt;
    if (this.shakeTimer > 0) this.shakeTimer = Math.max(0, this.shakeTimer - safeDt);
    if (this.flashTimer > 0) this.flashTimer = Math.max(0, this.flashTimer - safeDt);
    if (this.muzzleFlash > 0) this.muzzleFlash = Math.max(0, this.muzzleFlash - safeDt);

    if (this.phase === 'PAUSED' || this.phase === 'GAME_OVER') {
      stepParticlesAndPopups(this.particles, this.popups, safeDt);
      return;
    }

    const attract = this.phase === 'TITLE';

    if (this.phase === 'STAGE_CLEAR') {
      this.phaseTimer -= safeDt;
      // Carrier smoothly slides beneath the descending P-38!
      this.carrierY += (H - 135 - this.carrierY) * Math.min(1, safeDt * 3.5);
      this.px += (W * 0.5 - this.px) * Math.min(1, safeDt * 4.5);
      this.py += (this.carrierY - 12 - this.py) * Math.min(1, safeDt * 3.2);
      stepParticlesAndPopups(this.particles, this.popups, safeDt);
      this.stepEffects(safeDt);
      if (this.phaseTimer <= 0) {
        this.setupStage(this.level + 1);
        arcadeAudio.playCarrierTakeoff();
      }
      return;
    }

    // Scroll Pacific ocean, islands, clouds & carrier
    const scrollRate = this.takeoffTimer > 0 ? 115 : 92;
    this.stageScroll += scrollRate * safeDt;
    if (this.takeoffTimer > 0) {
      this.takeoffTimer = Math.max(0, this.takeoffTimer - safeDt);
      this.carrierY += 145 * safeDt;
      // Climb forward off the deck
      this.py = Math.max(H - 135, this.py - 28 * safeDt);
    } else if (this.carrierY < H + 320) {
      this.carrierY += 165 * safeDt;
    }

    for (const isl of this.islands) {
      isl.y += scrollRate * 0.62 * safeDt;
      if (isl.y - isl.ry > H + 60) {
        isl.y = -isl.ry - 60 - Math.random() * 110;
        isl.x = 70 + Math.random() * (W - 140);
      }
    }
    for (const cl of this.clouds) {
      cl.y += cl.speed * safeDt;
      if (cl.y - cl.r > H + 40) {
        cl.y = -cl.r - 40;
        cl.x = 40 + Math.random() * (W - 80);
      }
    }

    // Player movement / Attract AI
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - safeDt);
    if (this.rollTimer > 0) this.rollTimer = Math.max(0, this.rollTimer - safeDt);
    if (this.fireCd > 0) this.fireCd = Math.max(0, this.fireCd - safeDt);

    let targetBank = 0;
    if (attract) {
      const targetX = W * 0.5 + Math.sin(this.elapsed * 1.45) * 165;
      const targetY = H - 135 + Math.cos(this.elapsed * 1.1) * 38;
      const dx = targetX - this.px;
      this.px += dx * Math.min(1, safeDt * 4.5);
      this.py += (targetY - this.py) * Math.min(1, safeDt * 3.5);
      targetBank = Math.max(-1, Math.min(1, dx * 0.035));
      if (this.fireCd <= 0) {
        this.fireCd = 0.14;
        this.firePlayerVolley(true);
      }
      if (Math.floor(this.elapsed * 10) % 72 === 35 && this.rollTimer <= 0) {
        this.triggerLoopRoll(true);
      }
    } else if (this.takeoffTimer <= 0.35) {
      const spd = 305;
      let vx = 0;
      let vy = 0;
      if (this.input.left) vx -= spd;
      if (this.input.right) vx += spd;
      if (this.input.up) vy -= spd;
      if (this.input.down) vy += spd;
      if (vx !== 0 && vy !== 0) {
        vx *= 0.7071;
        vy *= 0.7071;
      }
      if (this.input.pointerActive && vx === 0 && vy === 0) {
        const tx = Math.max(32, Math.min(W - 32, this.input.pointerX * W));
        const ty = Math.max(54, Math.min(H - 42, this.input.pointerY * H));
        const dx = tx - this.px;
        const dy = ty - this.py;
        const stepX = Math.max(-spd * 1.45, Math.min(spd * 1.45, dx * 12));
        const stepY = Math.max(-spd * 1.45, Math.min(spd * 1.45, dy * 12));
        this.px += stepX * safeDt;
        this.py += stepY * safeDt;
        targetBank = Math.max(-1, Math.min(1, dx * 0.04));
      } else {
        this.px += vx * safeDt;
        this.py += vy * safeDt;
        targetBank = vx < 0 ? -1 : vx > 0 ? 1 : 0;
      }
      this.px = Math.max(30, Math.min(W - 30, this.px));
      this.py = Math.max(58, Math.min(H - 38, this.py));

      if (this.input.secondaryJustPressed) {
        this.triggerLoopRoll(false);
      }
      if ((this.input.fire || this.input.fireJustPressed) && this.fireCd <= 0 && this.rollTimer <= 0) {
        this.fireCd = this.quadGun ? 0.115 : 0.135;
        this.firePlayerVolley(false);
      }
    }

    this.bank += (targetBank - this.bank) * Math.min(1, safeDt * 12);

    // Wingtip vapor trails during roll or sharp bank
    if (this.rollTimer > 0 || Math.abs(this.bank) > 0.65) {
      if (Math.random() < safeDt * 28) {
        this.smokes.push({
          x: this.px - 22,
          y: this.py + 8,
          vx: -10,
          vy: 110,
          r: 2.5,
          life: 0.25,
          maxLife: 0.25,
          dark: false,
        });
        this.smokes.push({
          x: this.px + 22,
          y: this.py + 8,
          vx: 10,
          vy: 110,
          r: 2.5,
          life: 0.25,
          maxLife: 0.25,
          dark: false,
        });
      }
    }

    // Spawning enemy waves
    if (this.takeoffTimer <= 0) {
      this.spawnCd -= safeDt;
      this.redWaveCd -= safeDt;
      this.bomberCd -= safeDt;

      if (!attract && !this.bossSpawned && this.stageScroll >= this.stageLength) {
        this.spawnAyakoBoss();
      }

      if (this.redWaveCd <= 0 && (!this.bossSpawned || attract)) {
        this.redWaveCd = attract ? 5.2 : Math.max(4.4, 7.2 - this.level * 0.35);
        this.spawnRedFormation(attract);
      }

      if (this.spawnCd <= 0 && this.enemies.length < (this.bossSpawned ? 7 : 12)) {
        this.spawnCd = Math.max(0.45, 1.05 - this.level * 0.06);
        const roll = Math.random();
        if (roll < 0.62) {
          // Green A6M Zero fighter
          const sx = 44 + Math.random() * (W - 88);
          this.enemies.push({
            id: this.nextId++,
            kind: 'zero',
            x: sx,
            y: -26,
            vx: (Math.random() - 0.5) * 65,
            vy: 145 + this.level * 10,
            hp: 1,
            maxHp: 1,
            score: 100,
            age: 0,
            fireCd: 0.75 + Math.random() * 0.9,
            pattern: Math.random() < 0.5 ? 'sine' : 'straight',
            angle: Math.PI / 2,
            hitFlash: 0,
            turretAngle: Math.PI / 2,
          });
          if (!attract) this.enemiesSpawned++;
        } else {
          // Blue Diving Ace (swoops down fast then pulls up!)
          const sx = 64 + Math.random() * (W - 128);
          this.enemies.push({
            id: this.nextId++,
            kind: 'blue_diver',
            x: sx,
            y: -28,
            vx: sx < W * 0.5 ? 55 : -55,
            vy: 235 + this.level * 12,
            hp: 2,
            maxHp: 2,
            score: 250,
            age: 0,
            fireCd: 0.65,
            pattern: 'dive',
            angle: Math.PI / 2,
            hitFlash: 0,
            turretAngle: Math.PI / 2,
          });
          if (!attract) this.enemiesSpawned++;
        }
      }

      if (this.bomberCd <= 0 && !this.bossSpawned && !attract) {
        this.bomberCd = Math.max(4.6, 8.2 - this.level * 0.45);
        this.enemies.push({
          id: this.nextId++,
          kind: 'silver_bomber',
          x: 74 + Math.random() * (W - 148),
          y: -48,
          vx: (Math.random() - 0.5) * 32,
          vy: 78 + this.level * 4,
          hp: 7 + Math.floor(this.level * 1.2),
          maxHp: 7 + Math.floor(this.level * 1.2),
          score: 1000,
          age: 0,
          fireCd: 0.95,
          pattern: 'straight',
          angle: Math.PI / 2,
          hitFlash: 0,
          turretAngle: Math.PI / 2,
        });
        this.enemiesSpawned++;
      }
    }

    // Step player bullets
    for (let i = this.pBullets.length - 1; i >= 0; i--) {
      const b = this.pBullets[i];
      b.x += b.vx * safeDt;
      b.y += b.vy * safeDt;
      if (b.y < -28 || b.x < -20 || b.x > W + 20) {
        this.pBullets.splice(i, 1);
      }
    }

    // Step enemy bullets
    for (let i = this.eBullets.length - 1; i >= 0; i--) {
      const eb = this.eBullets[i];
      if (!eb) continue;
      eb.x += eb.vx * safeDt;
      eb.y += eb.vy * safeDt;
      if (eb.y > H + 30 || eb.y < -30 || eb.x < -30 || eb.x > W + 30) {
        this.eBullets.splice(i, 1);
        continue;
      }
      if (!attract && Math.hypot(eb.x - this.px, eb.y - this.py) < (eb.large ? 17 : 13)) {
        this.eBullets.splice(i, 1);
        this.damagePlayer();
        // damagePlayer() may clear this.eBullets or end the game; stop iterating this frame
        if (this.eBullets.length === 0 || this.phase !== 'PLAYING') {
          break;
        }
      }
    }

    // Step enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const en = this.enemies[i];
      en.age += safeDt;
      if (en.hitFlash > 0) en.hitFlash = Math.max(0, en.hitFlash - safeDt);

      const prevX = en.x;
      const prevY = en.y;

      if (en.kind === 'ayako') {
        if (en.y < 142) {
          en.y += en.vy * safeDt;
        } else {
          en.x += en.vx * safeDt;
          en.y = 142 + Math.sin(en.age * 1.5) * 20;
          if (en.x < 105) {
            en.x = 105;
            en.vx = Math.abs(en.vx);
          } else if (en.x > W - 105) {
            en.x = W - 105;
            en.vx = -Math.abs(en.vx);
          }
        }
        en.turretAngle = Math.atan2(this.py - en.y, this.px - en.x);
        // Damaged engine smoke!
        if (en.hp < en.maxHp * 0.65 && Math.random() < safeDt * 18) {
          this.smokes.push({
            x: en.x + (Math.random() < 0.5 ? -36 : 36),
            y: en.y + 8,
            vx: (Math.random() - 0.5) * 18,
            vy: 60,
            r: 5 + Math.random() * 5,
            life: 0.55,
            maxLife: 0.55,
            dark: true,
          });
        }
        en.fireCd -= safeDt;
        if (en.fireCd <= 0 && en.y > 40) {
          en.fireCd = Math.max(0.65, 1.35 - this.level * 0.08);
          const base = Math.atan2(this.py - en.y, this.px - en.x);
          const spread = [-0.36, -0.18, 0, 0.18, 0.36];
          for (const off of spread) {
            this.eBullets.push({
              x: en.x + Math.cos(base + off) * 28,
              y: en.y + 18,
              vx: Math.cos(base + off) * 215,
              vy: Math.sin(base + off) * 215,
              large: Math.abs(off) < 0.05,
            });
          }
        }
      } else if (en.pattern === 'loop_left' || en.pattern === 'loop_right') {
        const dir = en.pattern === 'loop_right' ? 1 : -1;
        if (en.age < 1.25) {
          en.y += en.vy * safeDt;
          en.x += dir * 68 * safeDt;
        } else if (en.age < 2.65) {
          const t = (en.age - 1.25) / 1.4;
          const a = t * Math.PI * 2;
          en.x += Math.cos(a) * dir * 130 * safeDt;
          en.y += Math.sin(a) * 105 * safeDt + 28 * safeDt;
        } else {
          en.y += en.vy * 1.15 * safeDt;
          en.x -= dir * 42 * safeDt;
        }
      } else if (en.pattern === 'sine') {
        en.y += en.vy * safeDt;
        en.x += Math.sin(en.age * 4.2) * 115 * safeDt;
      } else if (en.pattern === 'dive') {
        en.y += en.vy * safeDt;
        en.x += en.vx * safeDt;
        if (en.y > H * 0.56) {
          en.vy = -195;
          en.vx *= 1.1;
        }
      } else {
        en.x += en.vx * safeDt;
        en.y += en.vy * safeDt;
      }

      const dmx = en.x - prevX;
      const dmy = en.y - prevY;
      if (Math.hypot(dmx, dmy) > 0.2 && en.kind !== 'ayako') {
        en.angle = Math.atan2(dmy, dmx);
      }

      if (en.kind === 'silver_bomber' && en.hp < en.maxHp * 0.6 && Math.random() < safeDt * 12) {
        this.smokes.push({
          x: en.x - 14,
          y: en.y + 4,
          vx: 0,
          vy: 50,
          r: 4,
          life: 0.4,
          maxLife: 0.4,
          dark: true,
        });
      }

      if (en.kind !== 'ayako') {
        en.fireCd -= safeDt;
        if (en.fireCd <= 0 && en.y > 24 && en.y < H - 150) {
          en.fireCd = en.kind === 'silver_bomber' ? 1.15 : 1.75;
          const ang = Math.atan2(this.py - en.y, this.px - en.x);
          const bSpd = en.kind === 'silver_bomber' ? 210 : 185 + this.level * 8;
          if (en.kind === 'silver_bomber') {
            for (const off of [-0.22, 0, 0.22]) {
              this.eBullets.push({
                x: en.x,
                y: en.y + 12,
                vx: Math.cos(ang + off) * bSpd,
                vy: Math.sin(ang + off) * bSpd,
              });
            }
          } else {
            this.eBullets.push({
              x: en.x,
              y: en.y + 8,
              vx: Math.cos(ang) * bSpd,
              vy: Math.sin(ang) * bSpd,
            });
          }
        }
      }

      // Offscreen cleanup
      if (en.kind !== 'ayako' && (en.y > H + 70 || en.y < -260 || en.x < -90 || en.x > W + 90)) {
        this.enemies.splice(i, 1);
        continue;
      }

      // Collision with Player
      const colRad = en.kind === 'ayako' ? 56 : en.kind === 'silver_bomber' ? 28 : 19;
      if (!attract && Math.hypot(en.x - this.px, en.y - this.py) < colRad) {
        this.damagePlayer();
        if (this.phase !== 'PLAYING') break;
      }

      // Collision with Player Bullets
      const hitW = en.kind === 'ayako' ? 68 : en.kind === 'silver_bomber' ? 30 : 19;
      const hitH = en.kind === 'ayako' ? 36 : en.kind === 'silver_bomber' ? 22 : 18;
      let killed = false;
      for (let j = this.pBullets.length - 1; j >= 0; j--) {
        const pb = this.pBullets[j];
        if (Math.abs(pb.x - en.x) < hitW && Math.abs(pb.y - en.y) < hitH) {
          this.pBullets.splice(j, 1);
          en.hp -= pb.heavy ? 1.25 : 1;
          en.hitFlash = 0.08;
          spawnBurst(this.particles, pb.x, pb.y, '#FDE047', 4, 110, 2.2);

          if (en.hp <= 0) {
            killed = true;
            if (!attract) this.enemiesDestroyed++;
            const heavy = en.kind === 'ayako' || en.kind === 'silver_bomber';
            if (!attract) arcadeAudio.playExplosion(heavy);
            spawnBurst(this.particles, en.x, en.y, en.kind === 'red_ace' ? '#F87171' : '#FB923C', heavy ? 34 : 16, heavy ? 250 : 175, heavy ? 4.4 : 3.1);
            this.rings.push({
              x: en.x,
              y: en.y,
              r: 6,
              maxR: en.kind === 'ayako' ? 115 : en.kind === 'silver_bomber' ? 54 : 30,
              life: heavy ? 0.52 : 0.3,
              maxLife: heavy ? 0.52 : 0.3,
              color: en.kind === 'ayako' ? '#FACC15' : '#FB923C',
            });
            if (heavy) this.shakeTimer = en.kind === 'ayako' ? 0.55 : 0.22;

            this.addScore(en.score, en.x, en.y, '#FEF08A');

            // Complete Red Squadron check -> iconic 1942 POW drop!
            if (en.formationId !== undefined) {
              const left = (this.formationRemaining.get(en.formationId) ?? 1) - 1;
              if (left <= 0) {
                this.formationRemaining.delete(en.formationId);
                this.spawnPow(en.x, en.y);
                this.addScore(1000, en.x, en.y - 18, '#4ADE80', 'RED SQUADRON +1000!');
              } else {
                this.formationRemaining.set(en.formationId, left);
              }
            }

            if (en.kind === 'ayako') {
              if (attract) {
                // Respawn boss later in attract mode
                en.hp = en.maxHp;
                killed = false;
              } else {
                this.bossDefeated = true;
                this.flashTimer = 0.35;
                this.eBullets = [];
                this.lastShotDownPct =
                  this.enemiesSpawned > 0
                    ? Math.min(100, Math.round((this.enemiesDestroyed / this.enemiesSpawned) * 100))
                    : 100;
                this.lastRollBonus = this.rollsLeft * 1000;
                const pctBonus = this.lastShotDownPct >= 90 ? 10000 : this.lastShotDownPct * 50;
                this.addScore(this.lastRollBonus + pctBonus);
                arcadeAudio.playStageClear();
                this.phase = 'STAGE_CLEAR';
                this.phaseTimer = 3.2;
                this.carrierY = -120;
                this.bannerText = `STAGE ${this.level} CLEAR! SHOOTING DOWN: ${this.lastShotDownPct}%`;
              }
            }
            break;
          }
        }
      }
      if (killed) {
        this.enemies.splice(i, 1);
      }
    }

    // Step POW Pickups
    for (let i = this.pows.length - 1; i >= 0; i--) {
      const pw = this.pows[i];
      pw.age += safeDt;
      pw.y += pw.vy * safeDt;
      if (pw.y > H + 30) {
        this.pows.splice(i, 1);
        continue;
      }
      if (!attract && Math.hypot(pw.x - this.px, pw.y - this.py) < 32) {
        this.collectPow(pw);
        this.pows.splice(i, 1);
      }
    }

    this.stepEffects(safeDt);
    stepParticlesAndPopups(this.particles, this.popups, safeDt);
  }

  private collectPow(pw: PowPickup): void {
    arcadeAudio.playPowerUp();
    if (pw.kind === 'quad') {
      this.quadGun = true;
      this.addScore(1000, pw.x, pw.y, '#4ADE80', 'QUAD CANNONS!');
    } else if (pw.kind === 'wingmen') {
      this.wingmen = 2;
      this.addScore(1000, pw.x, pw.y, '#E2E8F0', 'WINGMEN ESCORTS!');
    } else if (pw.kind === 'roll') {
      this.rollsLeft = Math.min(5, this.rollsLeft + 1);
      this.addScore(1000, pw.x, pw.y, '#38BDF8', '+1 LOOP ROLL!');
    } else if (pw.kind === 'crash') {
      // Iconic Orange POW — blows up all non-boss aircraft on screen!
      this.flashTimer = 0.28;
      this.shakeTimer = 0.32;
      arcadeAudio.playExplosion(true);
      let cleared = 0;
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (e.kind === 'ayako') {
          e.hp = Math.max(4, e.hp - 12);
          e.hitFlash = 0.25;
        } else {
          spawnBurst(this.particles, e.x, e.y, '#FB923C', 14, 190, 3.2);
          this.addScore(e.score);
          this.enemies.splice(j, 1);
          cleared++;
        }
      }
      this.eBullets = [];
      this.addScore(1500 + cleared * 200, pw.x, pw.y, '#FB923C', 'SMART CRASH CLEAR!');
    } else if (pw.kind === 'yashichi') {
      this.addScore(5000, pw.x, pw.y, '#FACC15', 'YASHICHI +5000!');
    } else {
      this.lives = Math.min(6, this.lives + 1);
      arcadeAudio.playExtraLife();
      this.addScore(1000, pw.x, pw.y, '#F472B6', '1UP EXTRA ACE!');
    }
  }

  private stepEffects(dt: number): void {
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const s = this.smokes[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.r += 10 * dt;
      s.life -= dt;
      if (s.life <= 0) this.smokes.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      const t = 1 - Math.max(0, r.life / r.maxLife);
      r.r = r.maxR * t;
      if (r.life <= 0) this.rings.splice(i, 1);
    }
  }

  // ==================== RICH 1984 CAPCOM PACIFIC RENDERING ====================

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.save();
    ctx.scale(dpr, dpr);

    if (this.shakeTimer > 0) {
      const mag = this.shakeTimer * 14;
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }

    const th = this.getTheater();

    // 1. Deep Sunlit Pacific Ocean
    const og = ctx.createLinearGradient(0, 0, 0, H);
    og.addColorStop(0, th.oceanTop);
    og.addColorStop(0.55, th.oceanMid);
    og.addColorStop(1, th.oceanBot);
    ctx.fillStyle = og;
    ctx.fillRect(0, 0, W, H);

    // Animated sunlit ocean wave bands & specular sparkles
    ctx.strokeStyle = th.waveColor;
    ctx.lineWidth = 2;
    const waveOff = (this.stageScroll * 0.95) % 44;
    for (let y = -44 + waveOff; y < H + 44; y += 44) {
      for (let x = 20; x < W - 20; x += 88) {
        const shift = ((Math.floor(y / 44) % 2) * 44) + Math.sin(this.elapsed * 2 + x * 0.03) * 6;
        ctx.beginPath();
        ctx.moveTo(x + shift - 16, y);
        ctx.quadraticCurveTo(x + shift, y - 4, x + shift + 16, y);
        ctx.stroke();
      }
    }

    // 2. Multi-Layer Pacific Atolls & Coral Reefs
    for (const isl of this.islands) {
      this.drawAtoll(ctx, isl, th);
    }

    // 3. USS Hornet Aircraft Carrier Flight Deck (on Takeoff & Stage Clear Landing!)
    if (this.carrierY > -220 && this.carrierY < H + 260) {
      this.drawCarrierDeck(ctx, W * 0.5, this.carrierY);
    }

    // 4. Smoke trails & Fireball Shockwaves
    for (const s of this.smokes) {
      const a = Math.max(0, s.life / s.maxLife);
      ctx.fillStyle = s.dark
        ? `rgba(24, 24, 30, ${a * 0.55})`
        : `rgba(226, 232, 240, ${a * 0.5})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. POW Pickups
    for (const pw of this.pows) {
      this.drawPowPickup(ctx, pw);
    }

    // 6. Enemy Aircraft Shadows & Sprites
    for (const en of this.enemies) {
      this.drawEnemyPlane(ctx, en);
    }

    // 7. Player P-38 Lightning + Wingmen Escorts
    if (this.phase !== 'GAME_OVER') {
      const blink = this.invulnTimer > 0 && Math.floor(this.elapsed * 18) % 2 === 0;
      if (!blink) {
        if (this.wingmen >= 1 && this.rollTimer <= 0) {
          this.drawWingman(ctx, this.px - 42, this.py + 8);
        }
        if (this.wingmen >= 2 && this.rollTimer <= 0) {
          this.drawWingman(ctx, this.px + 42, this.py + 8);
        }
        this.drawPlayerP38(ctx);
      }
    }

    // 8. Player & Enemy Bullets
    for (const b of this.pBullets) {
      ctx.save();
      ctx.fillStyle = b.heavy ? '#38BDF8' : '#FEF08A';
      ctx.shadowColor = b.heavy ? '#38BDF8' : '#FACC15';
      ctx.shadowBlur = 6;
      ctx.fillRect(b.x - (b.heavy ? 2.6 : 2), b.y - 11, b.heavy ? 5.2 : 4, 15);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(b.x - 1, b.y - 9, 2, 10);
      ctx.restore();
    }

    for (const eb of this.eBullets) {
      const r = eb.large ? 6.2 : 4.4;
      ctx.save();
      ctx.fillStyle = eb.large ? '#F97316' : '#EF4444';
      ctx.beginPath();
      ctx.arc(eb.x, eb.y, r + 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(eb.x, eb.y, r * 0.58, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 9. Expanding Fireball Rings & Explosion Particles
    for (const ring of this.rings) {
      const a = Math.max(0, ring.life / ring.maxLife);
      ctx.save();
      ctx.globalAlpha = a * 0.85;
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 4 * a + 1;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    renderParticlesAndPopups(ctx, this.particles, this.popups);

    // 10. High-Altitude Drifting Cloud Layer (subtle soft depth!)
    for (const cl of this.clouds) {
      ctx.save();
      ctx.fillStyle = th.cloudTint;
      ctx.beginPath();
      ctx.arc(cl.x, cl.y, cl.r, 0, Math.PI * 2);
      ctx.arc(cl.x - cl.r * 0.55, cl.y + 8, cl.r * 0.72, 0, Math.PI * 2);
      ctx.arc(cl.x + cl.r * 0.58, cl.y + 6, cl.r * 0.68, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (this.flashTimer > 0) {
      ctx.fillStyle = `rgba(255, 250, 220, ${this.flashTimer * 1.6})`;
      ctx.fillRect(0, 0, W, H);
    }

    // 11. Authentic 1942 Top/Bottom Arcade HUD Overlay
    this.drawInCanvasHud(ctx, th);

    // 12. Stage Clear Carrier Landing Tally Card
    if (this.phase === 'STAGE_CLEAR') {
      this.drawStageClearTally(ctx);
    }

    if (visualMode === 'crt') {
      renderCrtOverlay(ctx, W, H);
    }
    ctx.restore();
  }

  private drawAtoll(ctx: CanvasRenderingContext2D, isl: AtollIsland, th: TheaterPalette): void {
    ctx.save();
    ctx.translate(isl.x, isl.y);
    ctx.rotate(isl.rot);

    // Shallow turquoise coral lagoon + animated white surf ring
    ctx.fillStyle = th.lagoonColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, isl.rx + 18, isl.ry + 16, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, isl.rx + 8 + Math.sin(this.elapsed * 3 + isl.seed) * 2.5, isl.ry + 6, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Sandy beach
    ctx.fillStyle = th.sandColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, isl.rx, isl.ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Jungle canopy base
    ctx.fillStyle = th.jungleDark;
    ctx.beginPath();
    ctx.ellipse(-4, -2, isl.rx * 0.78, isl.ry * 0.74, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sunlit palm mounds
    ctx.fillStyle = th.jungleLight;
    ctx.beginPath();
    ctx.ellipse(-10, -6, isl.rx * 0.48, isl.ry * 0.44, 0, 0, Math.PI * 2);
    ctx.ellipse(14, 6, isl.rx * 0.34, isl.ry * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();

    // Optional Pacific airstrip cross-runway
    if (isl.hasRunway) {
      ctx.fillStyle = '#475569';
      ctx.fillRect(-isl.rx * 0.55, -5, isl.rx * 1.1, 10);
      ctx.strokeStyle = '#E2E8F0';
      ctx.setLineDash([6, 5]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-isl.rx * 0.48, 0);
      ctx.lineTo(isl.rx * 0.48, 0);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  private drawCarrierDeck(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    ctx.save();
    ctx.translate(cx, cy);

    // Foaming stern wake
    const wakeGrad = ctx.createLinearGradient(0, 120, 0, 230);
    wakeGrad.addColorStop(0, 'rgba(224, 242, 254, 0.55)');
    wakeGrad.addColorStop(1, 'rgba(224, 242, 254, 0)');
    ctx.fillStyle = wakeGrad;
    ctx.beginPath();
    ctx.moveTo(-38, 122);
    ctx.lineTo(38, 122);
    ctx.lineTo(58, 235);
    ctx.lineTo(-58, 235);
    ctx.closePath();
    ctx.fill();

    // Steel hull lower shadow
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.roundRect(-62, -134, 124, 266, 12);
    ctx.fill();

    // Wooden flight deck with plank grain
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(-46, -130);
    ctx.lineTo(46, -130);
    ctx.lineTo(56, -90);
    ctx.lineTo(56, 126);
    ctx.lineTo(-56, 126);
    ctx.lineTo(-56, -90);
    ctx.closePath();
    ctx.fill();

    // Deck planking lines
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)';
    ctx.lineWidth = 1;
    for (let y = -112; y <= 116; y += 16) {
      ctx.beginPath();
      ctx.moveTo(-52, y);
      ctx.lineTo(52, y);
      ctx.stroke();
    }

    // White runway dashed centerline & yellow edge trim
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 2;
    ctx.strokeRect(-48, -120, 96, 238);

    ctx.strokeStyle = '#F8FAFC';
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 12]);
    ctx.beginPath();
    ctx.moveTo(0, -118);
    ctx.lineTo(0, 114);
    ctx.stroke();
    ctx.setLineDash([]);

    // Iconic "68" hull designation on the bow
    ctx.fillStyle = '#F8FAFC';
    ctx.font = '800 22px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('68', 0, -86);

    // Starboard Island Superstructure & Spinning Radar
    ctx.fillStyle = '#64748B';
    ctx.fillRect(34, -36, 24, 78);
    ctx.fillStyle = '#94A3B8';
    ctx.fillRect(38, -28, 16, 42);
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(42, -20, 8, 14);

    // Radar mast
    ctx.save();
    ctx.translate(46, -8);
    ctx.rotate(this.elapsed * 3.5);
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-9, 0);
    ctx.lineTo(9, 0);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  private drawPlayerP38(ctx: CanvasRenderingContext2D): void {
    const rolling = this.rollTimer > 0;
    const rollProgress = rolling ? 1 - this.rollTimer / 1.05 : 0;
    // Scale peaks at 1.48x during the top of the 360° loop!
    const takeoffScale = this.takeoffTimer > 0 ? 0.72 + (1 - this.takeoffTimer / 1.75) * 0.28 : 1;
    const scale = takeoffScale * (rolling ? 1 + Math.sin(rollProgress * Math.PI) * 0.5 : 1);
    const flipY = rolling ? Math.cos(rollProgress * Math.PI * 2) : 1;
    const shadowOffset = rolling ? 22 + Math.sin(rollProgress * Math.PI) * 34 : this.takeoffTimer > 0 ? 4 + (1 - this.takeoffTimer / 1.75) * 14 : 18;

    // Grounded parallax drop shadow on ocean surface
    ctx.save();
    ctx.translate(this.px + shadowOffset, this.py + shadowOffset + 4);
    ctx.scale(0.85, 0.85 * Math.max(0.25, Math.abs(flipY)));
    ctx.fillStyle = 'rgba(2, 6, 23, 0.34)';
    ctx.fillRect(-26, -4, 52, 9);
    ctx.fillRect(-13, -15, 5, 34);
    ctx.fillRect(8, -15, 5, 34);
    ctx.fillRect(-3, -19, 6, 24);
    ctx.fillRect(-13, 15, 26, 5);
    ctx.restore();

    // Actual Silver P-38 Lightning ("Super Ace")
    ctx.save();
    ctx.translate(this.px, this.py);
    ctx.scale(scale * (1 - Math.abs(this.bank) * 0.14), scale * (Math.abs(flipY) < 0.22 ? 0.22 : flipY));
    ctx.rotate(this.bank * 0.14);

    // Main swept silver metallic wings
    const wg = ctx.createLinearGradient(-28, 0, 28, 0);
    wg.addColorStop(0, '#94A3B8');
    wg.addColorStop(0.5, '#F8FAFC');
    wg.addColorStop(1, '#94A3B8');
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.moveTo(-29, 2);
    ctx.lineTo(-27, -6);
    ctx.lineTo(27, -6);
    ctx.lineTo(29, 2);
    ctx.lineTo(16, 7);
    ctx.lineTo(-16, 7);
    ctx.closePath();
    ctx.fill();

    // US Star-and-Bar wing roundels
    ctx.fillStyle = '#1D4ED8';
    ctx.beginPath();
    ctx.arc(-20, -1, 3.6, 0, Math.PI * 2);
    ctx.arc(20, -1, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-25, -2, 10, 2);
    ctx.fillRect(15, -2, 10, 2);

    // Twin Tail Booms & Horizontal Stabilizer (signature P-38 silhouette!)
    ctx.fillStyle = '#CBD5E1';
    ctx.fillRect(-14, -14, 5.5, 36);
    ctx.fillRect(8.5, -14, 5.5, 36);
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(-14, 16, 28, 5.5);

    // Red tail fin trim
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(-13.5, 13, 4.5, 9);
    ctx.fillRect(9, 13, 4.5, 9);

    // Center Cockpit Pod & Nose Cone
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.ellipse(0, -4, 5.5, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(0, -17, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // Specular Cockpit Glass
    ctx.fillStyle = '#0284C7';
    ctx.beginPath();
    ctx.ellipse(0, -6, 3.2, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#BAE6FD';
    ctx.fillRect(-1.5, -10, 1.5, 5);

    // Spinning Dual Propeller Blur Discs
    const propW = 7 + Math.sin(this.elapsed * 65) * 3;
    ctx.fillStyle = 'rgba(241, 245, 249, 0.72)';
    ctx.fillRect(-11.2 - propW * 0.5, -17, propW, 2.5);
    ctx.fillRect(11.2 - propW * 0.5, -17, propW, 2.5);

    // Muzzle Flash Glow
    if (this.muzzleFlash > 0) {
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(0, -22, 5.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawWingman(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(2, 6, 23, 0.3)';
    ctx.fillRect(-8 + 12, -2 + 14, 16, 5);
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(-11, -2, 22, 4.5);
    ctx.fillRect(-2.5, -10, 5, 18);
    ctx.fillRect(-6, 6, 12, 3);
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(-1.5, -5, 3, 4);
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(-10, -1, 3, 2.5);
    ctx.fillRect(7, -1, 3, 2.5);
    ctx.restore();
  }

  private drawEnemyPlane(ctx: CanvasRenderingContext2D, en: EnemyPlane): void {
    ctx.save();
    ctx.translate(en.x, en.y);

    if (en.kind === 'ayako') {
      // Giant 1942 AYAKO 4-Engine Green/Silver Heavy Super-Bomber!
      // Ocean shadow
      ctx.save();
      ctx.translate(22, 26);
      ctx.fillStyle = 'rgba(2, 6, 23, 0.34)';
      ctx.fillRect(-76, -12, 152, 22);
      ctx.fillRect(-14, -44, 28, 86);
      ctx.fillRect(-34, -44, 68, 12);
      ctx.restore();

      const flash = en.hitFlash > 0;
      // Swept heavy bomber wings
      ctx.fillStyle = flash ? '#FFFFFF' : '#15803D';
      ctx.beginPath();
      ctx.moveTo(-78, -6);
      ctx.lineTo(-74, 12);
      ctx.lineTo(74, 12);
      ctx.lineTo(78, -6);
      ctx.lineTo(36, -16);
      ctx.lineTo(-36, -16);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#052E16';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 4 Propeller Engine Nacelles
      for (const nx of [-54, -28, 28, 54]) {
        ctx.fillStyle = flash ? '#FEF08A' : '#334155';
        ctx.fillRect(nx - 5, -12, 10, 28);
        const pw = 8 + Math.sin(this.elapsed * 55 + nx) * 4;
        ctx.fillStyle = 'rgba(226, 232, 240, 0.78)';
        ctx.fillRect(nx - pw * 0.5, 16, pw, 2.5);
      }

      // Main armored fuselage & twin vertical tails
      ctx.fillStyle = flash ? '#FFFFFF' : '#166534';
      ctx.beginPath();
      ctx.roundRect(-14, -46, 28, 88, 12);
      ctx.fill();
      ctx.fillStyle = flash ? '#FFFFFF' : '#15803D';
      ctx.fillRect(-36, -46, 72, 12);

      // Hinomaru red sun insignia on wings
      ctx.fillStyle = '#DC2626';
      ctx.beginPath();
      ctx.arc(-52, -2, 8, 0, Math.PI * 2);
      ctx.arc(52, -2, 8, 0, Math.PI * 2);
      ctx.fill();

      // Nose glass canopy & rotating dorsal turret
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.ellipse(0, 26, 8, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(0, -4);
      ctx.rotate(en.turretAngle - Math.PI / 2);
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#CBD5E1';
      ctx.fillRect(-2, 0, 4, 14);
      ctx.restore();

      // Boss Health Bar directly above fuselage
      const pct = Math.max(0, en.hp / en.maxHp);
      ctx.fillStyle = 'rgba(4, 8, 18, 0.8)';
      ctx.fillRect(-52, -60, 104, 7);
      ctx.fillStyle = pct > 0.45 ? '#FACC15' : '#EF4444';
      ctx.fillRect(-50, -58.5, 100 * pct, 4);

      ctx.restore();
      return;
    }

    if (en.kind === 'silver_bomber') {
      // Shadow
      ctx.fillStyle = 'rgba(2, 6, 23, 0.3)';
      ctx.fillRect(-28 + 14, -4 + 16, 56, 10);
      ctx.fillRect(-5 + 14, -22 + 16, 10, 44);

      const flash = en.hitFlash > 0;
      ctx.fillStyle = flash ? '#FFFFFF' : '#CBD5E1';
      ctx.beginPath();
      ctx.moveTo(-34, -2);
      ctx.lineTo(-30, 8);
      ctx.lineTo(30, 8);
      ctx.lineTo(34, -2);
      ctx.lineTo(14, -8);
      ctx.lineTo(-14, -8);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = flash ? '#FFFFFF' : '#94A3B8';
      ctx.beginPath();
      ctx.ellipse(0, 0, 7, 22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-14, -22, 28, 6);

      // Twin engine pods + Hinomaru circles
      ctx.fillStyle = '#475569';
      ctx.fillRect(-16, -5, 6, 16);
      ctx.fillRect(10, -5, 6, 16);
      ctx.fillStyle = '#DC2626';
      ctx.beginPath();
      ctx.arc(-22, 1, 4.2, 0, Math.PI * 2);
      ctx.arc(22, 1, 4.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#0EA5E9';
      ctx.beginPath();
      ctx.ellipse(0, 10, 4, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      return;
    }

    // Small agile fighters: Green Zero, Red Squadron Ace, Blue Diver
    ctx.rotate(en.angle - Math.PI / 2);

    // Shadow
    ctx.fillStyle = 'rgba(2, 6, 23, 0.28)';
    ctx.fillRect(-16 + 10, -3 + 12, 32, 6);
    ctx.fillRect(-3 + 10, -14 + 12, 6, 26);

    const mainCol =
      en.hitFlash > 0
        ? '#FFFFFF'
        : en.kind === 'red_ace'
          ? '#EF4444'
          : en.kind === 'blue_diver'
            ? '#38BDF8'
            : '#22C55E';
    const darkCol =
      en.kind === 'red_ace' ? '#991B1B' : en.kind === 'blue_diver' ? '#0369A1' : '#14532D';

    // Wings
    ctx.fillStyle = mainCol;
    ctx.beginPath();
    ctx.moveTo(-18, -1);
    ctx.lineTo(-16, 5);
    ctx.lineTo(16, 5);
    ctx.lineTo(18, -1);
    ctx.lineTo(6, -5);
    ctx.lineTo(-6, -5);
    ctx.closePath();
    ctx.fill();

    // Fuselage & Tail
    ctx.fillStyle = darkCol;
    ctx.beginPath();
    ctx.ellipse(0, 0, 4, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = mainCol;
    ctx.fillRect(-8, -14, 16, 4);

    // Hinomaru roundels
    ctx.fillStyle = en.kind === 'red_ace' ? '#FEF08A' : '#DC2626';
    ctx.beginPath();
    ctx.arc(-11, 1, 2.8, 0, Math.PI * 2);
    ctx.arc(11, 1, 2.8, 0, Math.PI * 2);
    ctx.fill();

    // Cockpit & spinning nose prop
    ctx.fillStyle = '#E0F2FE';
    ctx.fillRect(-2, 1, 4, 5);
    const pw = 6 + Math.sin(this.elapsed * 60 + en.id) * 3;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(-pw * 0.5, 13, pw, 2);

    ctx.restore();
  }

  private drawPowPickup(ctx: CanvasRenderingContext2D, pw: PowPickup): void {
    const colors: Record<PowKind, { bg: string; border: string; label: string }> = {
      quad: { bg: '#15803D', border: '#4ADE80', label: 'POW' },
      wingmen: { bg: '#334155', border: '#F8FAFC', label: 'WING' },
      crash: { bg: '#C2410C', border: '#FDBA74', label: 'BOMB' },
      roll: { bg: '#0369A1', border: '#38BDF8', label: '+ROLL' },
      yashichi: { bg: '#B45309', border: '#FACC15', label: '5000' },
      '1up': { bg: '#BE123C', border: '#FDA4AF', label: '1UP' },
    };
    const cfg = colors[pw.kind];
    const pulse = 1 + Math.sin(pw.age * 9) * 0.08;

    ctx.save();
    ctx.translate(pw.x, pw.y);
    ctx.scale(pulse, pulse);

    // Outer gleaming badge aura
    ctx.fillStyle = `${cfg.border}40`;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();

    // Hexagonal/rounded Capcom POW emblem
    ctx.fillStyle = cfg.bg;
    ctx.strokeStyle = cfg.border;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-18, -11, 36, 22, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cfg.label, 0, 0.5);
    ctx.restore();
  }

  private drawInCanvasHud(ctx: CanvasRenderingContext2D, th: TheaterPalette): void {
    ctx.save();
    // Top subtle vintage arcade header bar
    ctx.fillStyle = 'rgba(4, 10, 24, 0.62)';
    ctx.fillRect(0, 0, W, 34);

    ctx.font = '800 13px "JetBrains Mono", monospace';
    ctx.textBaseline = 'middle';

    ctx.textAlign = 'left';
    ctx.fillStyle = '#F8FAFC';
    ctx.fillText(`1UP ${String(this.score).padStart(7, '0')}`, 14, 17);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#FACC15';
    ctx.fillText(`HI ${String(this.highScore).padStart(7, '0')}`, W * 0.5, 17);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#7DD3FC';
    ctx.fillText(`TO TOKYO ${Math.max(1, 33 - this.level)}`, W - 14, 17);

    // Bottom classic 1942 mini plane icons (left) + Roll 'R' icons (right)
    ctx.fillStyle = 'rgba(4, 10, 24, 0.58)';
    ctx.fillRect(0, H - 28, W, 28);

    // Remaining Lives icons (left)
    for (let i = 0; i < Math.min(5, this.lives); i++) {
      const lx = 20 + i * 22;
      const ly = H - 14;
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(lx - 7, ly - 1.5, 14, 3);
      ctx.fillRect(lx - 1.5, ly - 7, 3, 13);
      ctx.fillRect(lx - 4, ly + 4, 8, 2);
    }

    // Active Weapon status (center)
    ctx.textAlign = 'center';
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.fillStyle = this.quadGun ? '#4ADE80' : '#CBD5E1';
    ctx.fillText(
      `${th.name} · ${this.quadGun ? 'QUAD GUN' : 'TWIN GUN'}${this.wingmen > 0 ? ` + ${this.wingmen} WINGMEN` : ''}`,
      W * 0.5,
      H - 13
    );

    // Remaining Loop Rolls 'R' badges (right)
    for (let i = 0; i < this.rollsLeft; i++) {
      const rx = W - 20 - i * 20;
      const ry = H - 14;
      ctx.fillStyle = '#0284C7';
      ctx.beginPath();
      ctx.arc(rx, ry, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 10px "JetBrains Mono", monospace';
      ctx.fillText('R', rx, ry + 0.5);
    }

    if (this.phase === 'TITLE') {
      ctx.fillStyle = 'rgba(4, 10, 24, 0.72)';
      ctx.beginPath();
      ctx.roundRect(W * 0.5 - 178, H * 0.48 - 44, 356, 88, 12);
      ctx.fill();
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.45)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = '#F8FAFC';
      ctx.font = '900 34px "Outfit", sans-serif';
      ctx.fillText('1942', W * 0.5, H * 0.48 - 10);
      ctx.fillStyle = '#FACC15';
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillText('SUPER ACE · CARRIER LAUNCH · LOOP-THE-LOOP', W * 0.5, H * 0.48 + 20);
    }

    ctx.restore();
  }

  private drawStageClearTally(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = 'rgba(4, 10, 24, 0.84)';
    ctx.beginPath();
    ctx.roundRect(W * 0.5 - 190, 128, 380, 152, 12);
    ctx.fill();
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#FACC15';
    ctx.font = '800 20px "JetBrains Mono", monospace';
    ctx.fillText(`STAGE ${this.level} CLEAR!`, W * 0.5, 158);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '700 14px "JetBrains Mono", monospace';
    ctx.fillText(`SHOOTING DOWN PERCENTAGE  ${this.lastShotDownPct}%`, W * 0.5, 196);
    ctx.fillStyle = '#4ADE80';
    ctx.fillText(`REMAINING ROLLS BONUS  +${this.lastRollBonus}`, W * 0.5, 226);
    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 12px "JetBrains Mono", monospace';
    ctx.fillText('LANDING ON USS HORNET — NEXT SORTIE READY', W * 0.5, 258);
    ctx.restore();
  }
}

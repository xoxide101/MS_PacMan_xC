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
const STORAGE_KEY = 'ww1943_hd_highscore_v1';

type Weapon1943 = 'normal' | 'shotgun' | 'threeway' | 'auto' | 'shell' | 'laser';
type PowCycleItem = 'shotgun' | 'threeway' | 'auto' | 'shell' | 'laser' | 'energy' | 'side';
type FlagshipKind = 'tone' | 'kaga' | 'ayako2' | 'yamato';

interface MissionConfig {
  missionNum: number;
  flagship: FlagshipKind;
  targetName: string;
  targetSubtitle: string;
  seaTop: string;
  seaMid: string;
  seaBot: string;
  shimmerColor: string;
  cloudSea: boolean;
  sunsetGlow: boolean;
  stormy: boolean;
}

const MISSIONS: MissionConfig[] = [
  {
    missionNum: 1,
    flagship: 'tone',
    targetName: 'CRUISER TONE',
    targetSubtitle: 'MIDWAY VANGUARD FLEET',
    seaTop: '#063B4D',
    seaMid: '#0B556B',
    seaBot: '#042533',
    shimmerColor: 'rgba(125, 211, 252, 0.24)',
    cloudSea: false,
    sunsetGlow: false,
    stormy: false,
  },
  {
    missionNum: 2,
    flagship: 'kaga',
    targetName: 'CARRIER KAGA',
    targetSubtitle: 'MIDWAY SUNSET STRIKE',
    seaTop: '#4A1D3D',
    seaMid: '#7C2D12',
    seaBot: '#1E1B4B',
    shimmerColor: 'rgba(253, 186, 116, 0.3)',
    cloudSea: false,
    sunsetGlow: true,
    stormy: false,
  },
  {
    missionNum: 3,
    flagship: 'ayako2',
    targetName: 'AYAKO MK-II',
    targetSubtitle: 'STRATOSPHERE CLOUD FORTRESS',
    seaTop: '#0C4A6E',
    seaMid: '#0284C7',
    seaBot: '#075985',
    shimmerColor: 'rgba(240, 249, 255, 0.35)',
    cloudSea: true,
    sunsetGlow: false,
    stormy: false,
  },
  {
    missionNum: 4,
    flagship: 'yamato',
    targetName: 'BATTLESHIP YAMATO',
    targetSubtitle: 'MIDWAY STORM SHOWDOWN',
    seaTop: '#0B132B',
    seaMid: '#1C2541',
    seaBot: '#060A18',
    shimmerColor: 'rgba(147, 197, 253, 0.24)',
    cloudSea: false,
    sunsetGlow: false,
    stormy: true,
  },
];

const POW_CYCLE_ORDER: PowCycleItem[] = [
  'shotgun',
  'threeway',
  'auto',
  'shell',
  'laser',
  'energy',
  'side',
];

interface PlayerShot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  kind: Weapon1943;
  life: number;
  pierce: boolean;
  erasesBullets: boolean;
}

interface EnemyShot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  shell?: boolean;
}

interface AirEnemy {
  id: number;
  kind: 'zero' | 'red_leader' | 'torpedo_bomber' | 'heavy_escort';
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
  angle: number;
  hitFlash: number;
}

interface ShipTurret {
  id: number;
  ox: number; // offset from ship center
  oy: number;
  kind: 'main_gun' | 'aa_mount' | 'bridge' | 'engine_pod';
  hp: number;
  maxHp: number;
  angle: number;
  fireCd: number;
  destroyed: boolean;
  hitFlash: number;
  score: number;
}

interface NavalShip {
  id: number;
  isBoss: boolean;
  kind: FlagshipKind | 'destroyer';
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  length: number;
  turrets: ShipTurret[];
  sinking: boolean;
  sinkTimer: number;
  launchCd: number;
}

interface PowItem {
  id: number;
  x: number;
  y: number;
  vy: number;
  cycleIdx: number;
  shotLockCd: number;
  age: number;
}

interface LightningBolt {
  points: Array<{ x: number; y: number }>;
  life: number;
  maxLife: number;
}

interface SeaSmoke {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  maxLife: number;
}

interface WaterRing {
  x: number;
  y: number;
  r: number;
  maxR: number;
  life: number;
  maxLife: number;
  color: string;
}

export class Ww1943Game implements ArcadeGameInstance {
  public readonly logicalWidth = W;
  public readonly logicalHeight = H;
  public readonly supportsPointerAim = true;
  public readonly primaryActionLabel = 'FIRE';
  public readonly secondaryActionLabel = 'LIGHTNING';

  private phase: ClassicGamePhase = 'TITLE';
  private score = 0;
  private highScore = 0;
  private level = 1;
  private energy = 64;
  private maxEnergy = 64;
  private elapsed = 0;
  private phaseTimer = 0;
  private bannerText = '1943 · THE BATTLE OF MIDWAY';

  // Player P-38 Midway state
  private px = W * 0.5;
  private py = H - 110;
  private bank = 0;
  private weapon: Weapon1943 = 'normal';
  private weaponTimer = 0;
  private sideFighters = 0; // 0 or 2 armored wingmen
  private invulnTimer = 0;
  private fireCd = 0;
  private muzzleFlash = 0;

  // Mission & Fleet Progression
  private scrollDist = 0;
  private bossApproachDist = 1750;
  private bossAlertTimer = 0;
  private bossSpawned = false;
  private lastDestructionPct = 100;

  // Entities
  private nextId = 1;
  private nextFormId = 1;
  private formCount = new Map<number, number>();
  private airSpawnCd = 0.6;
  private redFormCd = 3.0;
  private escortShipCd = 5.0;

  private pShots: PlayerShot[] = [];
  private eShots: EnemyShot[] = [];
  private airEnemies: AirEnemy[] = [];
  private ships: NavalShip[] = [];
  private pows: PowItem[] = [];
  private bolts: LightningBolt[] = [];
  private smokes: SeaSmoke[] = [];
  private rings: WaterRing[] = [];
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];
  private shakeTimer = 0;
  private lightningFlash = 0;

  private input: ArcadeInputState = createEmptyInput();

  constructor() {
    this.highScore = readHighScore(STORAGE_KEY);
    this.seedAttractScene();
  }

  private getMission(): MissionConfig {
    return MISSIONS[(this.level - 1) % MISSIONS.length];
  }

  private seedAttractScene(): void {
    this.level = 4; // Show iconic Battleship Yamato storm duel in cabinet preview!
    this.px = W * 0.5;
    this.py = H - 125;
    this.weapon = 'shotgun';
    this.weaponTimer = 32;
    this.sideFighters = 2;
    this.energy = 64;
    this.pShots = [];
    this.eShots = [];
    this.airEnemies = [];
    this.ships = [];
    this.pows = [];
    this.bolts = [];
    this.smokes = [];
    this.rings = [];
    this.particles = [];
    this.popups = [];

    this.spawnFlagship('yamato', true);
    this.pows.push({
      id: this.nextId++,
      x: W * 0.28,
      y: 350,
      vy: 38,
      cycleIdx: 0,
      shotLockCd: 0,
      age: 0,
    });
  }

  public startNewGame(): void {
    this.score = 0;
    this.level = 1;
    this.maxEnergy = 64;
    this.energy = 64;
    this.weapon = 'normal';
    this.weaponTimer = 0;
    this.sideFighters = 0;
    this.setupMission(1);
    arcadeAudio.playCarrierTakeoff();
  }

  private setupMission(lv: number): void {
    this.level = lv;
    this.phase = 'PLAYING';
    this.maxEnergy = Math.min(96, 64 + (lv - 1) * 8);
    this.energy = Math.min(this.maxEnergy, Math.max(this.energy + 24, this.maxEnergy * 0.85));
    this.scrollDist = 0;
    this.bossApproachDist = 1650 + Math.min(3, lv - 1) * 280;
    this.bossAlertTimer = 0;
    this.bossSpawned = false;
    this.px = W * 0.5;
    this.py = H - 110;
    this.bank = 0;
    this.invulnTimer = 1.8;
    this.pShots = [];
    this.eShots = [];
    this.airEnemies = [];
    this.ships = [];
    this.pows = [];
    this.bolts = [];
    this.smokes = [];
    this.rings = [];
    this.particles = [];
    this.popups = [];
    this.airSpawnCd = 0.85;
    this.redFormCd = 3.2;
    this.escortShipCd = 4.5;
    this.formCount.clear();

    const m = this.getMission();
    this.bannerText = `MISSION ${lv} · ATTACK ${m.targetName} (${m.targetSubtitle})`;
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.bannerText = '1943 · THE BATTLE OF MIDWAY';
    this.seedAttractScene();
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public getHudSnapshot(): ClassicGameHud {
    const m = this.getMission();
    const weapName =
      this.weapon === 'normal'
        ? 'TWIN'
        : `${this.weapon.toUpperCase()} ${Math.ceil(this.weaponTimer)}s`;
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: Math.max(0, Math.ceil((this.energy / this.maxEnergy) * 3)),
      stageName: `MISSION ${this.level} · ${m.targetName}`,
      primaryMetricLabel: 'ENERGY',
      primaryMetricValue: `${Math.max(0, Math.ceil(this.energy))}/${this.maxEnergy}`,
      secondaryMetricLabel: 'WEAPON',
      secondaryMetricValue: `${weapName}${this.sideFighters > 0 ? ' +SIDE' : ''}`,
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

  private spawnRedSquadron(attract = false): void {
    const fid = this.nextFormId++;
    const count = 5;
    const fromLeft = Math.random() < 0.5;
    this.formCount.set(fid, count);
    for (let i = 0; i < count; i++) {
      this.airEnemies.push({
        id: this.nextId++,
        kind: 'red_leader',
        x: (fromLeft ? 74 : W - 74) + (fromLeft ? -i * 18 : i * 18),
        y: -30 - i * 42,
        vx: fromLeft ? 72 : -72,
        vy: 168 + this.level * 8,
        hp: 1,
        maxHp: 1,
        score: 250,
        age: -i * 0.14,
        fireCd: 1.0 + i * 0.25,
        formationId: fid,
        angle: Math.PI / 2,
        hitFlash: 0,
      });
    }
    if (attract && this.airEnemies.length > 10) {
      this.airEnemies.splice(0, 3);
    }
  }

  private spawnEscortDestroyer(): void {
    const x = 95 + Math.random() * (W - 190);
    const hpScale = 4 + this.level;
    this.ships.push({
      id: this.nextId++,
      isBoss: false,
      kind: 'destroyer',
      x,
      y: -120,
      vx: 0,
      vy: 56,
      width: 44,
      length: 145,
      sinking: false,
      sinkTimer: 0,
      launchCd: 99,
      turrets: [
        { id: this.nextId++, ox: 0, oy: -42, kind: 'main_gun', hp: hpScale, maxHp: hpScale, angle: Math.PI / 2, fireCd: 1.1, destroyed: false, hitFlash: 0, score: 800 },
        { id: this.nextId++, ox: 0, oy: 34, kind: 'aa_mount', hp: hpScale, maxHp: hpScale, angle: Math.PI / 2, fireCd: 1.5, destroyed: false, hitFlash: 0, score: 600 },
      ],
    });
  }

  private spawnFlagship(kind: FlagshipKind, attract = false): void {
    this.bossSpawned = true;
    const hpBoost = Math.max(0, this.level - 1) * 3;

    if (kind === 'tone') {
      this.ships.push({
        id: this.nextId++,
        isBoss: true,
        kind: 'tone',
        x: W * 0.5,
        y: attract ? 165 : -190,
        vx: 36,
        vy: 42,
        width: 96,
        length: 280,
        sinking: false,
        sinkTimer: 0,
        launchCd: 99,
        turrets: [
          { id: this.nextId++, ox: 0, oy: -82, kind: 'main_gun', hp: 14 + hpBoost, maxHp: 14 + hpBoost, angle: Math.PI / 2, fireCd: 1.1, destroyed: false, hitFlash: 0, score: 1500 },
          { id: this.nextId++, ox: 0, oy: -38, kind: 'main_gun', hp: 14 + hpBoost, maxHp: 14 + hpBoost, angle: Math.PI / 2, fireCd: 1.5, destroyed: false, hitFlash: 0, score: 1500 },
          { id: this.nextId++, ox: 0, oy: 6, kind: 'bridge', hp: 18 + hpBoost, maxHp: 18 + hpBoost, angle: Math.PI / 2, fireCd: 1.8, destroyed: false, hitFlash: 0, score: 2500 },
          { id: this.nextId++, ox: -34, oy: 24, kind: 'aa_mount', hp: 9 + hpBoost, maxHp: 9 + hpBoost, angle: Math.PI / 2, fireCd: 1.3, destroyed: false, hitFlash: 0, score: 900 },
          { id: this.nextId++, ox: 34, oy: 24, kind: 'aa_mount', hp: 9 + hpBoost, maxHp: 9 + hpBoost, angle: Math.PI / 2, fireCd: 1.6, destroyed: false, hitFlash: 0, score: 900 },
          { id: this.nextId++, ox: 0, oy: 82, kind: 'main_gun', hp: 14 + hpBoost, maxHp: 14 + hpBoost, angle: Math.PI / 2, fireCd: 1.2, destroyed: false, hitFlash: 0, score: 1500 },
        ],
      });
    } else if (kind === 'kaga') {
      this.ships.push({
        id: this.nextId++,
        isBoss: true,
        kind: 'kaga',
        x: W * 0.5,
        y: attract ? 175 : -210,
        vx: 30,
        vy: 38,
        width: 132,
        length: 310,
        sinking: false,
        sinkTimer: 0,
        launchCd: 2.4,
        turrets: [
          { id: this.nextId++, ox: 46, oy: -18, kind: 'bridge', hp: 22 + hpBoost, maxHp: 22 + hpBoost, angle: Math.PI / 2, fireCd: 1.2, destroyed: false, hitFlash: 0, score: 3000 },
          { id: this.nextId++, ox: -54, oy: -72, kind: 'aa_mount', hp: 11 + hpBoost, maxHp: 11 + hpBoost, angle: Math.PI / 2, fireCd: 1.1, destroyed: false, hitFlash: 0, score: 1100 },
          { id: this.nextId++, ox: 54, oy: -72, kind: 'aa_mount', hp: 11 + hpBoost, maxHp: 11 + hpBoost, angle: Math.PI / 2, fireCd: 1.5, destroyed: false, hitFlash: 0, score: 1100 },
          { id: this.nextId++, ox: -54, oy: 48, kind: 'aa_mount', hp: 11 + hpBoost, maxHp: 11 + hpBoost, angle: Math.PI / 2, fireCd: 1.3, destroyed: false, hitFlash: 0, score: 1100 },
          { id: this.nextId++, ox: 54, oy: 48, kind: 'aa_mount', hp: 11 + hpBoost, maxHp: 11 + hpBoost, angle: Math.PI / 2, fireCd: 1.7, destroyed: false, hitFlash: 0, score: 1100 },
          { id: this.nextId++, ox: -10, oy: 105, kind: 'main_gun', hp: 16 + hpBoost, maxHp: 16 + hpBoost, angle: Math.PI / 2, fireCd: 1.4, destroyed: false, hitFlash: 0, score: 1800 },
        ],
      });
    } else if (kind === 'ayako2') {
      this.ships.push({
        id: this.nextId++,
        isBoss: true,
        kind: 'ayako2',
        x: W * 0.5,
        y: attract ? 155 : -130,
        vx: 62,
        vy: 50,
        width: 220,
        length: 120,
        sinking: false,
        sinkTimer: 0,
        launchCd: 3.4,
        turrets: [
          { id: this.nextId++, ox: -78, oy: 4, kind: 'engine_pod', hp: 14 + hpBoost, maxHp: 14 + hpBoost, angle: Math.PI / 2, fireCd: 1.1, destroyed: false, hitFlash: 0, score: 1600 },
          { id: this.nextId++, ox: -36, oy: -8, kind: 'main_gun', hp: 16 + hpBoost, maxHp: 16 + hpBoost, angle: Math.PI / 2, fireCd: 1.4, destroyed: false, hitFlash: 0, score: 1800 },
          { id: this.nextId++, ox: 0, oy: 18, kind: 'bridge', hp: 24 + hpBoost, maxHp: 24 + hpBoost, angle: Math.PI / 2, fireCd: 1.0, destroyed: false, hitFlash: 0, score: 3500 },
          { id: this.nextId++, ox: 36, oy: -8, kind: 'main_gun', hp: 16 + hpBoost, maxHp: 16 + hpBoost, angle: Math.PI / 2, fireCd: 1.6, destroyed: false, hitFlash: 0, score: 1800 },
          { id: this.nextId++, ox: 78, oy: 4, kind: 'engine_pod', hp: 14 + hpBoost, maxHp: 14 + hpBoost, angle: Math.PI / 2, fireCd: 1.2, destroyed: false, hitFlash: 0, score: 1600 },
        ],
      });
    } else {
      // Colossal Super-Battleship YAMATO!
      this.ships.push({
        id: this.nextId++,
        isBoss: true,
        kind: 'yamato',
        x: W * 0.5,
        y: attract ? 175 : -230,
        vx: 26,
        vy: 34,
        width: 144,
        length: 340,
        sinking: false,
        sinkTimer: 0,
        launchCd: 99,
        turrets: [
          { id: this.nextId++, ox: 0, oy: -102, kind: 'main_gun', hp: 20 + hpBoost, maxHp: 20 + hpBoost, angle: Math.PI / 2, fireCd: 1.0, destroyed: false, hitFlash: 0, score: 2500 },
          { id: this.nextId++, ox: 0, oy: -52, kind: 'main_gun', hp: 20 + hpBoost, maxHp: 20 + hpBoost, angle: Math.PI / 2, fireCd: 1.4, destroyed: false, hitFlash: 0, score: 2500 },
          { id: this.nextId++, ox: 0, oy: 8, kind: 'bridge', hp: 28 + hpBoost, maxHp: 28 + hpBoost, angle: Math.PI / 2, fireCd: 1.2, destroyed: false, hitFlash: 0, score: 4500 },
          { id: this.nextId++, ox: -52, oy: -14, kind: 'aa_mount', hp: 12 + hpBoost, maxHp: 12 + hpBoost, angle: Math.PI / 2, fireCd: 1.1, destroyed: false, hitFlash: 0, score: 1200 },
          { id: this.nextId++, ox: 52, oy: -14, kind: 'aa_mount', hp: 12 + hpBoost, maxHp: 12 + hpBoost, angle: Math.PI / 2, fireCd: 1.5, destroyed: false, hitFlash: 0, score: 1200 },
          { id: this.nextId++, ox: -50, oy: 48, kind: 'aa_mount', hp: 12 + hpBoost, maxHp: 12 + hpBoost, angle: Math.PI / 2, fireCd: 1.3, destroyed: false, hitFlash: 0, score: 1200 },
          { id: this.nextId++, ox: 50, oy: 48, kind: 'aa_mount', hp: 12 + hpBoost, maxHp: 12 + hpBoost, angle: Math.PI / 2, fireCd: 1.7, destroyed: false, hitFlash: 0, score: 1200 },
          { id: this.nextId++, ox: 0, oy: 96, kind: 'main_gun', hp: 20 + hpBoost, maxHp: 20 + hpBoost, angle: Math.PI / 2, fireCd: 1.25, destroyed: false, hitFlash: 0, score: 2500 },
        ],
      });
    }

    if (!attract) {
      this.bossAlertTimer = 2.6;
      const m = this.getMission();
      this.bannerText = `ATTACK FORMATION! TARGET: ${m.targetName}`;
      arcadeAudio.playSirenSweep();
    }
  }

  private firePlayerWeapon(attract = false): void {
    const w = this.weapon;
    if (w === 'shotgun') {
      // Iconic 1943 Bullet-Erasing Buckshot Fan!
      for (const ang of [-0.34, -0.17, 0, 0.17, 0.34]) {
        this.pShots.push({
          x: this.px + Math.sin(ang) * 10,
          y: this.py - 18,
          vx: Math.sin(ang) * 560,
          vy: -Math.cos(ang) * 560,
          dmg: 1.15,
          kind: 'shotgun',
          life: 0.42,
          pierce: false,
          erasesBullets: true,
        });
      }
      if (!attract) arcadeAudio.playShotgunBlast();
    } else if (w === 'threeway') {
      for (const ang of [-0.3, 0, 0.3]) {
        this.pShots.push({
          x: this.px,
          y: this.py - 18,
          vx: Math.sin(ang) * 690,
          vy: -Math.cos(ang) * 690,
          dmg: 1.25,
          kind: 'threeway',
          life: 1.1,
          pierce: false,
          erasesBullets: false,
        });
      }
      if (!attract) arcadeAudio.playLaser(940, 280, 0.055);
    } else if (w === 'shell') {
      // Heavy explosive twin armor-piercing shells!
      this.pShots.push(
        { x: this.px - 10, y: this.py - 20, vx: 0, vy: -620, dmg: 2.6, kind: 'shell', life: 1.1, pierce: false, erasesBullets: false },
        { x: this.px + 10, y: this.py - 20, vx: 0, vy: -620, dmg: 2.6, kind: 'shell', life: 1.1, pierce: false, erasesBullets: false }
      );
      if (!attract) arcadeAudio.playLaser(560, 140, 0.08);
    } else if (w === 'laser') {
      // Blazing piercing plasma beam!
      this.pShots.push({
        x: this.px,
        y: this.py - 24,
        vx: 0,
        vy: -880,
        dmg: 2.1,
        kind: 'laser',
        life: 0.9,
        pierce: true,
        erasesBullets: false,
      });
      if (!attract) arcadeAudio.playLaser(1320, 480, 0.06);
    } else {
      // Normal or Auto rapid twin heavy cannons
      const heavy = w === 'auto';
      this.pShots.push(
        { x: this.px - 9, y: this.py - 18, vx: 0, vy: -720, dmg: heavy ? 1.25 : 1, kind: w, life: 1.0, pierce: false, erasesBullets: false },
        { x: this.px + 9, y: this.py - 18, vx: 0, vy: -720, dmg: heavy ? 1.25 : 1, kind: w, life: 1.0, pierce: false, erasesBullets: false }
      );
      if (!attract) arcadeAudio.playLaser(heavy ? 1050 : 880, 260, 0.045);
    }

    // Armored Side-Fighters fire twin emerald bolts!
    if (this.sideFighters >= 1) {
      this.pShots.push({ x: this.px - 42, y: this.py - 4, vx: 0, vy: -700, dmg: 1, kind: 'threeway', life: 1.0, pierce: false, erasesBullets: false });
    }
    if (this.sideFighters >= 2) {
      this.pShots.push({ x: this.px + 42, y: this.py - 4, vx: 0, vy: -700, dmg: 1, kind: 'threeway', life: 1.0, pierce: false, erasesBullets: false });
    }
    this.muzzleFlash = 0.06;
  }

  private triggerLightningCrash(attract = false): void {
    if (!attract && this.energy <= 14) {
      this.popups.push({
        x: this.px,
        y: this.py - 28,
        text: 'LOW ENERGY!',
        color: '#F87171',
        life: 0.85,
        maxLife: 0.85,
      });
      return;
    }

    if (!attract) this.energy = Math.max(4, this.energy - 10);
    this.lightningFlash = 0.45;
    this.shakeTimer = 0.52;
    this.invulnTimer = Math.max(this.invulnTimer, 0.85);
    if (!attract) arcadeAudio.playLightningCrash();

    // Generate 5 crackling forked lightning arcs down the screen!
    for (let k = 0; k < 5; k++) {
      const pts: Array<{ x: number; y: number }> = [];
      let cx = 60 + k * 110 + (Math.random() - 0.5) * 40;
      for (let y = 0; y <= H; y += 48) {
        pts.push({ x: cx, y });
        cx += (Math.random() - 0.5) * 62;
      }
      this.bolts.push({ points: pts, life: 0.44, maxLife: 0.44 });
    }

    // Tidal shockwave ring expanding from P-38!
    this.rings.push({
      x: this.px,
      y: this.py,
      r: 12,
      maxR: 360,
      life: 0.55,
      maxLife: 0.55,
      color: '#38BDF8',
    });

    // Vaporize ALL enemy bullets!
    for (const eb of this.eShots) {
      spawnBurst(this.particles, eb.x, eb.y, '#7DD3FC', 3, 90, 2);
    }
    this.eShots = [];

    // Electrocute airborne enemies!
    for (let i = this.airEnemies.length - 1; i >= 0; i--) {
      const en = this.airEnemies[i];
      en.hp -= 5;
      en.hitFlash = 0.25;
      if (en.hp <= 0) {
        spawnBurst(this.particles, en.x, en.y, '#38BDF8', 14, 180, 3.2);
        this.addScore(en.score, en.x, en.y, '#7DD3FC');
        this.airEnemies.splice(i, 1);
      }
    }

    // Hammer every active naval ship turret!
    for (const ship of this.ships) {
      if (ship.sinking) continue;
      for (const t of ship.turrets) {
        if (t.destroyed) continue;
        this.damageTurret(ship, t, 6, attract);
      }
    }

    if (!attract) {
      this.popups.push({
        x: this.px,
        y: this.py - 32,
        text: 'LIGHTNING MEGA-CRASH!',
        color: '#38BDF8',
        life: 1.1,
        maxLife: 1.1,
      });
    }
  }

  private damagePlayer(cost = 12): void {
    if (this.invulnTimer > 0) return;
    if (this.sideFighters > 0) {
      const sx = this.sideFighters === 2 ? this.px + 42 : this.px - 42;
      this.sideFighters--;
      this.invulnTimer = 1.15;
      this.shakeTimer = 0.22;
      arcadeAudio.playExplosion(false);
      spawnBurst(this.particles, sx, this.py + 4, '#F97316', 16, 180, 3.5);
      this.popups.push({ x: sx, y: this.py - 16, text: 'SIDE FIGHTER LOST!', color: '#FB923C', life: 0.95, maxLife: 0.95 });
      return;
    }

    this.energy = Math.max(0, this.energy - cost);
    this.invulnTimer = 1.45;
    this.shakeTimer = 0.34;
    arcadeAudio.playExplosion(true);
    spawnBurst(this.particles, this.px, this.py, '#F97316', 24, 220, 4);

    if (this.energy <= 0) {
      this.phase = 'GAME_OVER';
      this.bannerText = 'FUEL DEPLETED · MISSION FAILED · PRESS START';
    }
  }

  private damageTurret(ship: NavalShip, t: ShipTurret, dmg: number, attract = false): void {
    t.hp -= dmg;
    t.hitFlash = 0.12;
    const tx = ship.x + t.ox;
    const ty = ship.y + t.oy;
    if (t.hp <= 0 && !t.destroyed) {
      t.destroyed = true;
      if (!attract) arcadeAudio.playExplosion(true);
      spawnBurst(this.particles, tx, ty, '#F97316', 24, 220, 4.2);
      this.rings.push({ x: tx, y: ty, r: 8, maxR: 58, life: 0.42, maxLife: 0.42, color: '#FACC15' });
      this.shakeTimer = Math.max(this.shakeTimer, 0.24);
      this.addScore(t.score, tx, ty, '#FEF08A', `TURRET +${t.score}`);

      // Check if entire warship is destroyed!
      const aliveCount = ship.turrets.filter((mt) => !mt.destroyed).length;
      if (aliveCount === 0 && !ship.sinking) {
        if (attract) {
          // Reset turrets after brief firework in attract demo
          for (const mt of ship.turrets) {
            mt.destroyed = false;
            mt.hp = mt.maxHp;
          }
          return;
        }
        ship.sinking = true;
        ship.sinkTimer = 2.6;
        arcadeAudio.playShipSinking();
        this.shakeTimer = 0.7;
        this.lightningFlash = 0.32;
        if (ship.isBoss) {
          this.eShots = [];
          this.lastDestructionPct = 100;
          const bonus = 10000 + this.level * 5000;
          this.addScore(bonus, ship.x, ship.y, '#4ADE80', `FLAGSHIP SUNK +${bonus}!`);
          this.energy = Math.min(this.maxEnergy, this.energy + 22);
          arcadeAudio.playStageClear();
          this.phase = 'STAGE_CLEAR';
          this.phaseTimer = 3.2;
          const m = this.getMission();
          this.bannerText = `${m.targetName} SUNK! 100% DESTRUCTION BONUS!`;
        } else {
          this.addScore(3000, ship.x, ship.y, '#4ADE80', 'DESTROYER SUNK +3000!');
          // Escort destroyers drop a POW crate!
          this.pows.push({
            id: this.nextId++,
            x: ship.x,
            y: Math.max(90, Math.min(H - 180, ship.y)),
            vy: 56,
            cycleIdx: 5, // starts on Energy refill!
            shotLockCd: 0.25,
            age: 0,
          });
        }
      }
    }
  }

  public step(dt: number): void {
    const safeDt = Math.min(0.05, Math.max(0, dt));
    this.elapsed += safeDt;
    if (this.shakeTimer > 0) this.shakeTimer = Math.max(0, this.shakeTimer - safeDt);
    if (this.lightningFlash > 0) this.lightningFlash = Math.max(0, this.lightningFlash - safeDt);
    if (this.muzzleFlash > 0) this.muzzleFlash = Math.max(0, this.muzzleFlash - safeDt);
    if (this.bossAlertTimer > 0) this.bossAlertTimer = Math.max(0, this.bossAlertTimer - safeDt);

    if (this.phase === 'PAUSED' || this.phase === 'GAME_OVER') {
      stepParticlesAndPopups(this.particles, this.popups, safeDt);
      return;
    }

    const attract = this.phase === 'TITLE';

    if (this.phase === 'STAGE_CLEAR') {
      this.phaseTimer -= safeDt;
      // Keep flagship bubbling and sinking into the foaming sea!
      for (const ship of this.ships) {
        if (ship.sinking && Math.random() < safeDt * 18) {
          const rx = ship.x + (Math.random() - 0.5) * ship.width * 0.9;
          const ry = ship.y + (Math.random() - 0.5) * ship.length * 0.8;
          spawnBurst(this.particles, rx, ry, '#F97316', 10, 140, 3.2);
          this.rings.push({ x: rx, y: ry, r: 6, maxR: 48, life: 0.4, maxLife: 0.4, color: '#FEF08A' });
        }
        ship.sinkTimer = Math.max(0, ship.sinkTimer - safeDt);
      }
      this.stepEffects(safeDt);
      stepParticlesAndPopups(this.particles, this.popups, safeDt);
      if (this.phaseTimer <= 0) {
        this.setupMission(this.level + 1);
        arcadeAudio.playCarrierTakeoff();
      }
      return;
    }

    // Scroll ocean & Energy / Weapon timers
    this.scrollDist += 96 * safeDt;
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - safeDt);
    if (this.fireCd > 0) this.fireCd = Math.max(0, this.fireCd - safeDt);

    if (!attract) {
      // Authentic 1943 gradual fuel drain!
      this.energy -= 0.85 * safeDt;
      if (this.energy <= 0) {
        this.energy = 0;
        this.phase = 'GAME_OVER';
        this.bannerText = 'OUT OF FUEL! COLLECT ENERGY POW DROPS TO SURVIVE!';
        return;
      }
      if (this.weapon !== 'normal') {
        this.weaponTimer -= safeDt;
        if (this.weaponTimer <= 0) {
          this.weapon = 'normal';
          this.weaponTimer = 0;
        }
      }
    }

    // Player movement / Attract AI
    let targetBank = 0;
    if (attract) {
      const tx = W * 0.5 + Math.sin(this.elapsed * 1.4) * 165;
      const ty = H - 135 + Math.cos(this.elapsed * 0.95) * 36;
      const dx = tx - this.px;
      this.px += dx * Math.min(1, safeDt * 4.5);
      this.py += (ty - this.py) * Math.min(1, safeDt * 3.5);
      targetBank = Math.max(-1, Math.min(1, dx * 0.035));
      if (this.fireCd <= 0) {
        this.fireCd = 0.22;
        this.firePlayerWeapon(true);
      }
      if (Math.floor(this.elapsed * 10) % 75 === 42) {
        this.triggerLightningCrash(true);
      }
    } else {
      const spd = 315;
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
        const tx = Math.max(30, Math.min(W - 30, this.input.pointerX * W));
        const ty = Math.max(54, Math.min(H - 42, this.input.pointerY * H));
        const dx = tx - this.px;
        const dy = ty - this.py;
        this.px += Math.max(-spd * 1.45, Math.min(spd * 1.45, dx * 12)) * safeDt;
        this.py += Math.max(-spd * 1.45, Math.min(spd * 1.45, dy * 12)) * safeDt;
        targetBank = Math.max(-1, Math.min(1, dx * 0.04));
      } else {
        this.px += vx * safeDt;
        this.py += vy * safeDt;
        targetBank = vx < 0 ? -1 : vx > 0 ? 1 : 0;
      }
      this.px = Math.max(30, Math.min(W - 30, this.px));
      this.py = Math.max(54, Math.min(H - 42, this.py));

      if (this.input.secondaryJustPressed) {
        this.triggerLightningCrash(false);
      }
      if ((this.input.fire || this.input.fireJustPressed) && this.fireCd <= 0) {
        this.fireCd =
          this.weapon === 'auto'
            ? 0.085
            : this.weapon === 'shotgun'
              ? 0.22
              : this.weapon === 'shell'
                ? 0.21
                : 0.135;
        this.firePlayerWeapon(false);
      }
    }
    this.bank += (targetBank - this.bank) * Math.min(1, safeDt * 12);

    // Spawn waves & Fleet Flagship
    this.airSpawnCd -= safeDt;
    this.redFormCd -= safeDt;
    this.escortShipCd -= safeDt;

    if (!attract && !this.bossSpawned && this.scrollDist >= this.bossApproachDist) {
      this.spawnFlagship(this.getMission().flagship, false);
    }

    if (this.redFormCd <= 0) {
      this.redFormCd = attract ? 5.6 : Math.max(4.4, 6.8 - this.level * 0.3);
      this.spawnRedSquadron(attract);
    }

    if (this.escortShipCd <= 0 && !this.bossSpawned && !attract && !this.getMission().cloudSea) {
      this.escortShipCd = Math.max(4.6, 7.2 - this.level * 0.4);
      this.spawnEscortDestroyer();
    }

    if (this.airSpawnCd <= 0 && this.airEnemies.length < 10) {
      this.airSpawnCd = Math.max(0.5, 1.1 - this.level * 0.06);
      const heavy = Math.random() < 0.22;
      this.airEnemies.push({
        id: this.nextId++,
        kind: heavy ? 'heavy_escort' : 'zero',
        x: 50 + Math.random() * (W - 100),
        y: -28,
        vx: (Math.random() - 0.5) * 65,
        vy: heavy ? 95 : 165 + this.level * 10,
        hp: heavy ? 5 + this.level : 1,
        maxHp: heavy ? 5 + this.level : 1,
        score: heavy ? 900 : 120,
        age: 0,
        fireCd: 0.9 + Math.random() * 0.7,
        angle: Math.PI / 2,
        hitFlash: 0,
      });
    }

    // Step Player Shots (+ Iconic 1943 Bullet-Erasing Shotgun + Shoot-to-Cycle POW!)
    for (let i = this.pShots.length - 1; i >= 0; i--) {
      const s = this.pShots[i];
      s.x += s.vx * safeDt;
      s.y += s.vy * safeDt;
      s.life -= safeDt;
      if (s.life <= 0 || s.y < -30 || s.x < -20 || s.x > W + 20) {
        this.pShots.splice(i, 1);
        continue;
      }

      // 1943 SHOTGUN ERASES ENEMY BULLETS MID-AIR!
      if (s.erasesBullets) {
        for (let b = this.eShots.length - 1; b >= 0; b--) {
          const eb = this.eShots[b];
          if (Math.hypot(eb.x - s.x, eb.y - s.y) < 18) {
            spawnBurst(this.particles, eb.x, eb.y, '#FEF08A', 4, 80, 2);
            this.eShots.splice(b, 1);
          }
        }
      }

      // Authentic 1943 SHOOTABLE POW CYCLING!
      let consumed = false;
      for (const pw of this.pows) {
        if (pw.shotLockCd <= 0 && Math.hypot(pw.x - s.x, pw.y - s.y) < 24) {
          pw.cycleIdx = (pw.cycleIdx + 1) % POW_CYCLE_ORDER.length;
          pw.shotLockCd = 0.22;
          pw.vy = -45; // slight upward bounce when shot!
          if (!attract) {
            arcadeAudio.playPowCycle();
            this.popups.push({
              x: pw.x,
              y: pw.y - 18,
              text: POW_CYCLE_ORDER[pw.cycleIdx].toUpperCase(),
              color: '#38BDF8',
              life: 0.55,
              maxLife: 0.55,
            });
          }
          if (!s.pierce) {
            consumed = true;
            break;
          }
        }
      }
      if (consumed) {
        this.pShots.splice(i, 1);
        continue;
      }

      // Hits on Air Enemies
      for (let j = this.airEnemies.length - 1; j >= 0; j--) {
        const en = this.airEnemies[j];
        const rad = en.kind === 'heavy_escort' ? 28 : 19;
        if (Math.hypot(en.x - s.x, en.y - s.y) < rad) {
          en.hp -= s.dmg;
          en.hitFlash = 0.08;
          spawnBurst(this.particles, s.x, s.y, '#FDE047', 4, 100, 2);
          if (en.hp <= 0) {
            if (!attract) arcadeAudio.playExplosion(en.kind === 'heavy_escort');
            spawnBurst(this.particles, en.x, en.y, en.kind === 'red_leader' ? '#F87171' : '#FB923C', 16, 180, 3.2);
            this.addScore(en.score, en.x, en.y, '#FEF08A');

            if (en.formationId !== undefined) {
              const rem = (this.formCount.get(en.formationId) ?? 1) - 1;
              if (rem <= 0) {
                this.formCount.delete(en.formationId);
                this.pows.push({
                  id: this.nextId++,
                  x: Math.max(46, Math.min(W - 46, en.x)),
                  y: Math.max(60, Math.min(H - 180, en.y)),
                  vy: 56,
                  cycleIdx: this.energy < this.maxEnergy * 0.5 ? 5 : 0,
                  shotLockCd: 0.25,
                  age: 0,
                });
                this.addScore(1000, en.x, en.y - 18, '#38BDF8', 'POW DROPPED! SHOOT TO CYCLE!');
              } else {
                this.formCount.set(en.formationId, rem);
              }
            }
            this.airEnemies.splice(j, 1);
          }
          if (!s.pierce) {
            consumed = true;
            break;
          }
        }
      }
      if (consumed) {
        this.pShots.splice(i, 1);
        continue;
      }

      // Hits on Naval Warship Turrets!
      for (const ship of this.ships) {
        if (ship.sinking) continue;
        for (const t of ship.turrets) {
          if (t.destroyed) continue;
          const tx = ship.x + t.ox;
          const ty = ship.y + t.oy;
          const hitR = t.kind === 'bridge' ? 28 : t.kind === 'main_gun' ? 22 : 17;
          if (Math.hypot(tx - s.x, ty - s.y) < hitR) {
            this.damageTurret(ship, t, s.dmg, attract);
            spawnBurst(this.particles, s.x, s.y, '#FDE047', 5, 115, 2.3);
            if (!s.pierce) {
              consumed = true;
              break;
            }
          }
        }
        if (consumed) break;
      }
      if (consumed) {
        this.pShots.splice(i, 1);
      }
    }

    // Step Enemy Shots
    for (let i = this.eShots.length - 1; i >= 0; i--) {
      const eb = this.eShots[i];
      if (!eb) continue;
      eb.x += eb.vx * safeDt;
      eb.y += eb.vy * safeDt;
      if (eb.y > H + 30 || eb.y < -30 || eb.x < -30 || eb.x > W + 30) {
        this.eShots.splice(i, 1);
        continue;
      }
      if (!attract && Math.hypot(eb.x - this.px, eb.y - this.py) < (eb.shell ? 16 : 12)) {
        this.eShots.splice(i, 1);
        this.damagePlayer(eb.shell ? 15 : 10);
        if (this.eShots.length === 0 || this.phase !== 'PLAYING') break;
      }
    }

    // Step Air Enemies
    for (let i = this.airEnemies.length - 1; i >= 0; i--) {
      const en = this.airEnemies[i];
      if (!en) continue;
      en.age += safeDt;
      if (en.hitFlash > 0) en.hitFlash = Math.max(0, en.hitFlash - safeDt);
      const px0 = en.x;
      const py0 = en.y;
      if (en.kind === 'red_leader') {
        en.y += en.vy * safeDt;
        en.x += Math.sin(en.age * 3.4) * 145 * safeDt;
      } else {
        en.x += en.vx * safeDt;
        en.y += en.vy * safeDt;
      }
      if (Math.hypot(en.x - px0, en.y - py0) > 0.2) {
        en.angle = Math.atan2(en.y - py0, en.x - px0);
      }
      en.fireCd -= safeDt;
      if (en.fireCd <= 0 && en.y > 24 && en.y < H - 150) {
        en.fireCd = en.kind === 'heavy_escort' ? 1.15 : 1.7;
        const ang = Math.atan2(this.py - en.y, this.px - en.x);
        const spd = 205 + this.level * 8;
        this.eShots.push({ x: en.x, y: en.y + 8, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd });
      }
      if (!attract && Math.hypot(en.x - this.px, en.y - this.py) < 22) {
        this.damagePlayer(12);
        this.airEnemies.splice(i, 1);
        if (this.phase !== 'PLAYING') break;
        continue;
      }
      if (en.y > H + 60 || en.x < -90 || en.x > W + 90) {
        this.airEnemies.splice(i, 1);
      }
    }

    // Step Naval Warships & Turret AI
    for (let i = this.ships.length - 1; i >= 0; i--) {
      const ship = this.ships[i];
      if (ship.sinking) {
        ship.sinkTimer -= safeDt;
        ship.y += 24 * safeDt;
        if (Math.random() < safeDt * 12) {
          this.smokes.push({
            x: ship.x + (Math.random() - 0.5) * ship.width * 0.7,
            y: ship.y + (Math.random() - 0.5) * ship.length * 0.6,
            vx: 0,
            vy: 30,
            r: 7,
            life: 0.7,
            maxLife: 0.7,
          });
        }
        if (ship.sinkTimer <= 0 && !ship.isBoss) {
          this.ships.splice(i, 1);
        }
        continue;
      }

      if (ship.isBoss) {
        const hoverY = ship.kind === 'ayako2' ? 148 : 192;
        if (ship.y < hoverY) {
          ship.y += ship.vy * safeDt;
        } else {
          ship.x += ship.vx * safeDt;
          const margin = ship.width * 0.6 + 34;
          if (ship.x < margin) {
            ship.x = margin;
            ship.vx = Math.abs(ship.vx);
          } else if (ship.x > W - margin) {
            ship.x = W - margin;
            ship.vx = -Math.abs(ship.vx);
          }
        }
        // Carrier Kaga & Ayako Mk-II launch live Zero fighters!
        if (ship.kind === 'kaga' || ship.kind === 'ayako2') {
          ship.launchCd -= safeDt;
          if (ship.launchCd <= 0 && this.airEnemies.length < 7) {
            ship.launchCd = 3.2;
            this.airEnemies.push({
              id: this.nextId++,
              kind: 'zero',
              x: ship.x - 14,
              y: ship.y + 40,
              vx: (Math.random() - 0.5) * 90,
              vy: 175,
              hp: 1,
              maxHp: 1,
              score: 150,
              age: 0,
              fireCd: 1.0,
              angle: Math.PI / 2,
              hitFlash: 0,
            });
          }
        }
      } else {
        ship.y += ship.vy * safeDt;
        if (ship.y - ship.length * 0.6 > H + 60) {
          this.ships.splice(i, 1);
          continue;
        }
      }

      for (const t of ship.turrets) {
        if (t.hitFlash > 0) t.hitFlash = Math.max(0, t.hitFlash - safeDt);
        const tx = ship.x + t.ox;
        const ty = ship.y + t.oy;
        if (t.destroyed) {
          if (Math.random() < safeDt * 6) {
            this.smokes.push({
              x: tx + (Math.random() - 0.5) * 8,
              y: ty,
              vx: (Math.random() - 0.5) * 14,
              vy: 42,
              r: 5,
              life: 0.55,
              maxLife: 0.55,
            });
          }
          continue;
        }
        t.angle = Math.atan2(this.py - ty, this.px - tx);
        t.fireCd -= safeDt;
        if (t.fireCd <= 0 && ty > 20 && ty < H - 110) {
          const isMain = t.kind === 'main_gun' || t.kind === 'bridge';
          t.fireCd = Math.max(0.85, (isMain ? 1.55 : 1.9) - this.level * 0.08);
          const bSpd = isMain ? 210 : 185;
          if (isMain) {
            for (const off of [-0.14, 0, 0.14]) {
              this.eShots.push({
                x: tx + Math.cos(t.angle) * 16,
                y: ty + Math.sin(t.angle) * 16,
                vx: Math.cos(t.angle + off) * bSpd,
                vy: Math.sin(t.angle + off) * bSpd,
                shell: true,
              });
            }
          } else {
            this.eShots.push({
              x: tx + Math.cos(t.angle) * 10,
              y: ty + Math.sin(t.angle) * 10,
              vx: Math.cos(t.angle) * bSpd,
              vy: Math.sin(t.angle) * bSpd,
            });
          }
        }
      }
    }

    // Step Shootable POW Pickups
    for (let i = this.pows.length - 1; i >= 0; i--) {
      const pw = this.pows[i];
      pw.age += safeDt;
      if (pw.shotLockCd > 0) pw.shotLockCd = Math.max(0, pw.shotLockCd - safeDt);
      pw.vy = Math.min(62, pw.vy + 135 * safeDt);
      pw.y += pw.vy * safeDt;
      if (pw.y > H + 30) {
        this.pows.splice(i, 1);
        continue;
      }
      if (!attract && Math.hypot(pw.x - this.px, pw.y - this.py) < 30) {
        this.collectPow(pw);
        this.pows.splice(i, 1);
      }
    }

    this.stepEffects(safeDt);
    stepParticlesAndPopups(this.particles, this.popups, safeDt);
  }

  private collectPow(pw: PowItem): void {
    const kind = POW_CYCLE_ORDER[pw.cycleIdx];
    arcadeAudio.playPowerUp();
    if (kind === 'energy') {
      this.energy = Math.min(this.maxEnergy, this.energy + 28);
      this.addScore(1000, pw.x, pw.y, '#4ADE80', 'ENERGY +28 FUEL!');
    } else if (kind === 'side') {
      this.sideFighters = 2;
      this.addScore(1500, pw.x, pw.y, '#38BDF8', 'SIDE FIGHTERS LOCKED!');
    } else {
      const bonusTime = this.weapon === kind ? 20 : 26;
      this.weapon = kind;
      this.weaponTimer = Math.min(64, (this.weapon === kind ? this.weaponTimer : 0) + bonusTime);
      this.addScore(1000, pw.x, pw.y, '#FACC15', `${kind.toUpperCase()} ARMED!`);
    }
  }

  private stepEffects(dt: number): void {
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      this.bolts[i].life -= dt;
      if (this.bolts[i].life <= 0) this.bolts.splice(i, 1);
    }
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const s = this.smokes[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.r += 11 * dt;
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

  // ==================== RICH 1987 MIDWAY NAVAL RENDERING ====================

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.save();
    ctx.scale(dpr, dpr);

    if (this.shakeTimer > 0) {
      const mag = this.shakeTimer * 16;
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }

    const m = this.getMission();

    // 1. Atmospheric Midway Sea / Sunset / Storm Sky
    const sg = ctx.createLinearGradient(0, 0, 0, H);
    sg.addColorStop(0, m.seaTop);
    sg.addColorStop(0.55, m.seaMid);
    sg.addColorStop(1, m.seaBot);
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, W, H);

    // Optional Midway Sunset sun reflection column on the sea!
    if (m.sunsetGlow) {
      const sunGrad = ctx.createRadialGradient(W * 0.5, 95, 16, W * 0.5, 160, 260);
      sunGrad.addColorStop(0, 'rgba(253, 186, 116, 0.38)');
      sunGrad.addColorStop(1, 'rgba(253, 186, 116, 0)');
      ctx.fillStyle = sunGrad;
      ctx.fillRect(0, 0, W, H);
    }

    // Animated Ocean Swells OR High-Altitude Stratosphere Cloud Sea!
    if (m.cloudSea) {
      const cloudOff = (this.scrollDist * 1.15) % 130;
      ctx.fillStyle = 'rgba(241, 245, 249, 0.24)';
      for (let y = -130 + cloudOff; y < H + 130; y += 130) {
        for (let x = 35; x < W + 40; x += 115) {
          ctx.beginPath();
          ctx.arc(x, y, 52, 0, Math.PI * 2);
          ctx.arc(x + 36, y + 14, 42, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else {
      ctx.strokeStyle = m.shimmerColor;
      ctx.lineWidth = 2;
      const off = (this.scrollDist * 1.1) % 38;
      for (let y = -38 + off; y < H + 38; y += 38) {
        for (let x = 16; x < W - 16; x += 72) {
          const shift = (Math.floor(y / 38) % 2) * 36;
          ctx.beginPath();
          ctx.moveTo(x + shift - 14, y);
          ctx.lineTo(x + shift + 14, y);
          ctx.stroke();
        }
      }
    }

    // 2. Naval Warships (Escort Destroyers, Cruiser Tone, Carrier Kaga, Battleship Yamato, Ayako Mk-II)
    for (const ship of this.ships) {
      this.drawNavalShip(ctx, ship);
    }

    // 3. Thick Naval Flak & Burning Deck Smoke
    for (const s of this.smokes) {
      const a = Math.max(0, s.life / s.maxLife);
      ctx.fillStyle = `rgba(15, 23, 42, ${a * 0.62})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Shoot-to-Cycle POW Pickups
    for (const pw of this.pows) {
      this.drawPow1943(ctx, pw);
    }

    // 5. Airborne Enemy Fighters & Escorts
    for (const en of this.airEnemies) {
      this.drawAirEnemy(ctx, en);
    }

    // 6. Player Upgraded Midway P-38 + Side Fighters
    if (this.phase !== 'GAME_OVER') {
      const blink = this.invulnTimer > 0 && Math.floor(this.elapsed * 18) % 2 === 0;
      if (!blink) {
        if (this.sideFighters >= 1) this.drawSideFighter(ctx, this.px - 42, this.py + 6);
        if (this.sideFighters >= 2) this.drawSideFighter(ctx, this.px + 42, this.py + 6);
        this.drawPlayer1943P38(ctx);
      }
    }

    // 7. Player Special Weapon Shots (Shotgun / 3-Way / Shell / Laser!)
    for (const s of this.pShots) {
      ctx.save();
      if (s.kind === 'laser') {
        ctx.fillStyle = '#22D3EE';
        ctx.shadowColor = '#22D3EE';
        ctx.shadowBlur = 12;
        ctx.fillRect(s.x - 4.5, s.y - 26, 9, 44);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(s.x - 1.8, s.y - 24, 3.6, 40);
      } else if (s.kind === 'shotgun') {
        ctx.fillStyle = '#FEF08A';
        ctx.shadowColor = '#FACC15';
        ctx.shadowBlur = 7;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 4.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(s.x, s.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (s.kind === 'shell') {
        ctx.fillStyle = '#FB923C';
        ctx.shadowColor = '#F97316';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, 4.4, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.ellipse(s.x, s.y - 2, 2, 6, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = s.kind === 'threeway' ? '#4ADE80' : '#38BDF8';
        ctx.fillRect(s.x - 2.4, s.y - 11, 4.8, 15);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(s.x - 1, s.y - 9, 2, 10);
      }
      ctx.restore();
    }

    // 8. Enemy Bullets & Naval Shells
    for (const eb of this.eShots) {
      const r = eb.shell ? 6 : 4.2;
      ctx.save();
      ctx.fillStyle = eb.shell ? '#F97316' : '#EF4444';
      ctx.beginPath();
      ctx.arc(eb.x, eb.y, r + 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(eb.x, eb.y, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 9. Forked Lightning Mega-Crash & Tidal Shockwaves!
    for (const ring of this.rings) {
      const a = Math.max(0, ring.life / ring.maxLife);
      ctx.save();
      ctx.globalAlpha = a * 0.85;
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 4.5 * a + 1.5;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (const bolt of this.bolts) {
      const a = Math.max(0, bolt.life / bolt.maxLife);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 6;
      ctx.shadowColor = '#38BDF8';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      bolt.points.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.restore();
    }

    renderParticlesAndPopups(ctx, this.particles, this.popups);

    if (this.lightningFlash > 0) {
      ctx.fillStyle = `rgba(186, 230, 253, ${this.lightningFlash * 0.9})`;
      ctx.fillRect(0, 0, W, H);
    }

    // 10. Authentic 1943 Attack Formation Alert Banner & In-Canvas HUD
    this.drawHud1943(ctx, m);

    if (visualMode === 'crt') {
      renderCrtOverlay(ctx, W, H);
    }
    ctx.restore();
  }

  private drawNavalShip(ctx: CanvasRenderingContext2D, ship: NavalShip): void {
    ctx.save();
    ctx.translate(ship.x, ship.y);

    if (ship.sinking) {
      ctx.globalAlpha = Math.max(0.25, ship.sinkTimer / 2.6);
    }

    if (ship.kind === 'ayako2') {
      // High-altitude twin-fuselage Cloud Fortress Ayako Mk-II
      ctx.fillStyle = 'rgba(2, 6, 23, 0.34)';
      ctx.fillRect(-108 + 20, -14 + 26, 216, 26);

      // Massive metallic swept delta wing
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(-112, -8);
      ctx.lineTo(-104, 18);
      ctx.lineTo(104, 18);
      ctx.lineTo(112, -8);
      ctx.lineTo(48, -28);
      ctx.lineTo(-48, -28);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Twin armored fuselages & center bridge pod
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.roundRect(-52, -52, 22, 98, 8);
      ctx.roundRect(30, -52, 22, 98, 8);
      ctx.roundRect(-18, -32, 36, 76, 12);
      ctx.fill();
      ctx.fillStyle = '#DC2626';
      ctx.beginPath();
      ctx.arc(-82, 4, 9, 0, Math.PI * 2);
      ctx.arc(82, 4, 9, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Naval Warships: Escort Destroyer, Cruiser Tone, Carrier Kaga, Battleship Yamato!
      const hw = ship.width * 0.5;
      const hl = ship.length * 0.5;

      // Churning White Bow Wake & Stern Foam!
      const wakePulse = Math.sin(this.elapsed * 8) * 5;
      const wakeGrad = ctx.createLinearGradient(0, -hl - 14, 0, hl + 75);
      wakeGrad.addColorStop(0, 'rgba(224, 242, 254, 0.55)');
      wakeGrad.addColorStop(0.65, 'rgba(186, 230, 253, 0.28)');
      wakeGrad.addColorStop(1, 'rgba(186, 230, 253, 0)');
      ctx.fillStyle = wakeGrad;
      ctx.beginPath();
      ctx.moveTo(0, -hl - 16);
      ctx.lineTo(hw + 22 + wakePulse, hl + 68);
      ctx.lineTo(-hw - 22 - wakePulse, hl + 68);
      ctx.closePath();
      ctx.fill();

      // Armored Steel Naval Hull
      ctx.fillStyle = ship.kind === 'yamato' ? '#334155' : '#475569';
      ctx.beginPath();
      ctx.moveTo(0, -hl);
      ctx.quadraticCurveTo(hw * 0.95, -hl * 0.55, hw, 0);
      ctx.quadraticCurveTo(hw * 0.9, hl * 0.72, hw * 0.55, hl);
      ctx.lineTo(-hw * 0.55, hl);
      ctx.quadraticCurveTo(-hw * 0.9, hl * 0.72, -hw, 0);
      ctx.quadraticCurveTo(-hw * 0.95, -hl * 0.55, 0, -hl);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Wooden Teak Deck (Yamato/Tone) OR Full Flight Deck (Carrier Kaga)
      if (ship.kind === 'kaga') {
        ctx.fillStyle = '#785A3A';
        ctx.fillRect(-hw + 12, -hl + 14, ship.width - 24, ship.length - 28);
        ctx.strokeStyle = '#F8FAFC';
        ctx.lineWidth = 2;
        ctx.setLineDash([12, 10]);
        ctx.beginPath();
        ctx.moveTo(-6, -hl + 22);
        ctx.lineTo(-6, hl - 22);
        ctx.stroke();
        ctx.setLineDash([]);
        // Rising Sun bow marking on Kaga deck
        ctx.fillStyle = '#DC2626';
        ctx.beginPath();
        ctx.arc(-6, -hl + 44, 13, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = ship.kind === 'yamato' ? '#92734E' : '#7C6245';
        ctx.beginPath();
        ctx.moveTo(0, -hl + 12);
        ctx.quadraticCurveTo(hw * 0.78, -hl * 0.45, hw * 0.8, 0);
        ctx.quadraticCurveTo(hw * 0.72, hl * 0.65, hw * 0.42, hl - 12);
        ctx.lineTo(-hw * 0.42, hl - 12);
        ctx.quadraticCurveTo(-hw * 0.72, hl * 0.65, -hw * 0.8, 0);
        ctx.quadraticCurveTo(-hw * 0.78, -hl * 0.45, 0, -hl + 12);
        ctx.closePath();
        ctx.fill();

        // Armored steel citadel center plate
        ctx.fillStyle = '#64748B';
        ctx.fillRect(-hw * 0.45, -hl * 0.45, hw * 0.9, hl * 0.95);
      }
    }

    // Individually Destructible Rotating Naval Turrets & Pagoda Bridge!
    for (const t of ship.turrets) {
      ctx.save();
      ctx.translate(t.ox, t.oy);

      if (t.destroyed) {
        // Blackened smoking deck crater!
        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.arc(0, 0, t.kind === 'bridge' ? 18 : 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#EA580C';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(0, 0, t.kind === 'bridge' ? 11 : 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        continue;
      }

      const flash = t.hitFlash > 0;
      if (t.kind === 'bridge') {
        ctx.fillStyle = flash ? '#FFFFFF' : '#94A3B8';
        ctx.beginPath();
        ctx.roundRect(-20, -24, 40, 48, 6);
        ctx.fill();
        ctx.fillStyle = flash ? '#FEF08A' : '#475569';
        ctx.fillRect(-13, -16, 26, 30);
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(-9, -11, 18, 8);
      } else if (t.kind === 'main_gun') {
        ctx.rotate(t.angle - Math.PI / 2);
        // Massive Triple/Twin 18-inch Barrels!
        ctx.fillStyle = flash ? '#FFFFFF' : '#CBD5E1';
        ctx.fillRect(-7, 4, 3.2, 22);
        ctx.fillRect(-1.6, 4, 3.2, 24);
        ctx.fillRect(3.8, 4, 3.2, 22);
        // Armored Gun Turret Housing
        ctx.fillStyle = flash ? '#FEF08A' : '#64748B';
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-14, -12, 28, 22, 6);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.rotate(t.angle - Math.PI / 2);
        ctx.fillStyle = flash ? '#FFFFFF' : '#CBD5E1';
        ctx.fillRect(-2, 2, 4, 14);
        ctx.fillStyle = flash ? '#FEF08A' : '#475569';
        ctx.beginPath();
        ctx.arc(0, 0, 9.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.restore();
  }

  private drawPlayer1943P38(ctx: CanvasRenderingContext2D): void {
    const weapGlow =
      this.weapon === 'shotgun'
        ? '#FACC15'
        : this.weapon === 'laser'
          ? '#22D3EE'
          : this.weapon === 'shell'
            ? '#FB923C'
            : '#4ADE80';

    // Crisp ocean shadow
    ctx.save();
    ctx.translate(this.px + 18, this.py + 22);
    ctx.fillStyle = 'rgba(2, 6, 23, 0.36)';
    ctx.fillRect(-26, -4, 52, 8);
    ctx.fillRect(-13, -14, 5, 34);
    ctx.fillRect(8, -14, 5, 34);
    ctx.fillRect(-13, 15, 26, 5);
    ctx.restore();

    ctx.save();
    ctx.translate(this.px, this.py);
    ctx.scale(1 - Math.abs(this.bank) * 0.14, 1);
    ctx.rotate(this.bank * 0.15);

    // Subtle energized weapon aura when carrying a 1943 special weapon
    if (this.weapon !== 'normal') {
      ctx.fillStyle = `${weapGlow}22`;
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sleek Midway Silver & Emerald P-38 Wings
    const wg = ctx.createLinearGradient(-30, 0, 30, 0);
    wg.addColorStop(0, '#64748B');
    wg.addColorStop(0.5, '#F1F5F9');
    wg.addColorStop(1, '#64748B');
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.moveTo(-30, 2);
    ctx.lineTo(-28, -6);
    ctx.lineTo(28, -6);
    ctx.lineTo(30, 2);
    ctx.lineTo(16, 7);
    ctx.lineTo(-16, 7);
    ctx.closePath();
    ctx.fill();

    // Signature 1943 Emerald Green Wing Stripes!
    ctx.fillStyle = '#10B981';
    ctx.fillRect(-24, -4, 7, 8);
    ctx.fillRect(17, -4, 7, 8);

    // Twin Booms + Tail Stabilizer
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(-14, -14, 5.5, 36);
    ctx.fillRect(8.5, -14, 5.5, 36);
    ctx.fillRect(-14, 16, 28, 5.5);
    ctx.fillStyle = '#10B981';
    ctx.fillRect(-13.5, 13, 4.5, 9);
    ctx.fillRect(9, 13, 4.5, 9);

    // Center Fuselage & Emerald Canopy Trim
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.ellipse(0, -4, 5.8, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#38BDF8';
    ctx.beginPath();
    ctx.ellipse(0, -6, 3.2, 6.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Twin Prop Blur Discs
    const pw = 8 + Math.sin(this.elapsed * 68) * 3;
    ctx.fillStyle = 'rgba(224, 242, 254, 0.78)';
    ctx.fillRect(-11.2 - pw * 0.5, -17, pw, 2.5);
    ctx.fillRect(11.2 - pw * 0.5, -17, pw, 2.5);

    if (this.muzzleFlash > 0) {
      ctx.fillStyle = weapGlow;
      ctx.beginPath();
      ctx.arc(0, -23, 6.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawSideFighter(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#10B981';
    ctx.fillRect(-11, -2, 22, 4.5);
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(-2.5, -10, 5, 18);
    ctx.fillRect(-6, 6, 12, 3);
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(-1.5, -5, 3, 4);
    ctx.restore();
  }

  private drawAirEnemy(ctx: CanvasRenderingContext2D, en: AirEnemy): void {
    ctx.save();
    ctx.translate(en.x, en.y);
    ctx.rotate(en.angle - Math.PI / 2);

    const flash = en.hitFlash > 0;
    if (en.kind === 'heavy_escort') {
      ctx.fillStyle = flash ? '#FFFFFF' : '#94A3B8';
      ctx.fillRect(-28, -4, 56, 9);
      ctx.fillRect(-6, -18, 12, 36);
      ctx.fillRect(-12, -18, 24, 5);
      ctx.fillStyle = '#DC2626';
      ctx.beginPath();
      ctx.arc(-18, 0, 4, 0, Math.PI * 2);
      ctx.arc(18, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = flash ? '#FFFFFF' : en.kind === 'red_leader' ? '#EF4444' : '#4ADE80';
      ctx.fillRect(-17, -2, 34, 5.5);
      ctx.fillStyle = en.kind === 'red_leader' ? '#991B1B' : '#166534';
      ctx.fillRect(-3.5, -13, 7, 25);
      ctx.fillRect(-7, -13, 14, 3.5);
      ctx.fillStyle = '#DC2626';
      ctx.beginPath();
      ctx.arc(-10, 0.5, 2.6, 0, Math.PI * 2);
      ctx.arc(10, 0.5, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawPow1943(ctx: CanvasRenderingContext2D, pw: PowItem): void {
    const kind = POW_CYCLE_ORDER[pw.cycleIdx];
    const map: Record<PowCycleItem, { bg: string; rim: string; text: string }> = {
      shotgun: { bg: '#854D0E', rim: '#FACC15', text: 'SHOT' },
      threeway: { bg: '#065F46', rim: '#4ADE80', text: '3WAY' },
      auto: { bg: '#1E3A8A', rim: '#60A5FA', text: 'AUTO' },
      shell: { bg: '#9A3412', rim: '#FB923C', text: 'SHLL' },
      laser: { bg: '#155E75', rim: '#22D3EE', text: 'LASR' },
      energy: { bg: '#14532D', rim: '#86EFAC', text: 'FUEL' },
      side: { bg: '#312E81', rim: '#A5B4FC', text: 'SIDE' },
    };
    const cfg = map[kind];
    const pulse = 1 + Math.sin(pw.age * 10) * 0.08;

    ctx.save();
    ctx.translate(pw.x, pw.y);
    ctx.scale(pulse, pulse);

    ctx.fillStyle = `${cfg.rim}44`;
    ctx.beginPath();
    ctx.arc(0, 0, 21, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = cfg.bg;
    ctx.strokeStyle = cfg.rim;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-20, -12, 40, 24, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cfg.text, 0, 0.5);
    ctx.restore();
  }

  private drawHud1943(ctx: CanvasRenderingContext2D, m: MissionConfig): void {
    ctx.save();

    // Top Naval Command Bar
    ctx.fillStyle = 'rgba(4, 10, 24, 0.68)';
    ctx.fillRect(0, 0, W, 38);

    ctx.font = '800 13px "JetBrains Mono", monospace';
    ctx.textBaseline = 'middle';

    ctx.textAlign = 'left';
    ctx.fillStyle = '#F8FAFC';
    ctx.fillText(`1P ${String(this.score).padStart(7, '0')}`, 12, 19);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#FACC15';
    ctx.fillText(`HI ${String(this.highScore).padStart(7, '0')}`, W * 0.5, 19);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#38BDF8';
    ctx.fillText(
      this.weapon === 'normal'
        ? 'TWIN GUN'
        : `${this.weapon.toUpperCase()} ${Math.ceil(this.weaponTimer)}s`,
      W - 12,
      19
    );

    // Boss Destruction % Meter (Authentic 1943 Feature!)
    const boss = this.ships.find((s) => s.isBoss);
    if (boss) {
      const total = boss.turrets.length;
      const done = boss.turrets.filter((t) => t.destroyed).length;
      const pct = Math.round((done / Math.max(1, total)) * 100);
      ctx.fillStyle = 'rgba(4, 10, 24, 0.78)';
      ctx.beginPath();
      ctx.roundRect(W * 0.5 - 148, 44, 296, 24, 6);
      ctx.fill();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = '#F8FAFC';
      ctx.font = '800 11px "JetBrains Mono", monospace';
      ctx.fillText(`${m.targetName} · DESTRUCTION ${pct}%`, W * 0.5, 56);
    }

    // Authentic 1943 Bottom Energy / Fuel Gauge!
    ctx.fillStyle = 'rgba(4, 10, 24, 0.72)';
    ctx.fillRect(0, H - 32, W, 32);

    const energyPct = Math.max(0, Math.min(1, this.energy / this.maxEnergy));
    const lowFuel = energyPct < 0.28;
    ctx.textAlign = 'left';
    ctx.font = '800 11px "JetBrains Mono", monospace';
    ctx.fillStyle = lowFuel && Math.floor(this.elapsed * 10) % 2 === 0 ? '#EF4444' : '#FACC15';
    ctx.fillText(lowFuel ? 'LOW FUEL!' : 'ENERGY', 12, H - 16);

    const barX = 82;
    const barW = 240;
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(barX, H - 22, barW, 12);
    ctx.fillStyle = energyPct > 0.5 ? '#22C55E' : energyPct > 0.25 ? '#FACC15' : '#EF4444';
    ctx.fillRect(barX + 1.5, H - 20.5, (barW - 3) * energyPct, 9);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#7DD3FC';
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.fillText('SHIFT: LIGHTNING · SHOOT POW TO CYCLE', W - 12, H - 16);

    // Attack Formation Alert Flash
    if (this.bossAlertTimer > 0 && Math.floor(this.elapsed * 8) % 2 === 0) {
      ctx.fillStyle = 'rgba(153, 27, 27, 0.82)';
      ctx.beginPath();
      ctx.roundRect(W * 0.5 - 190, H * 0.42 - 26, 380, 52, 8);
      ctx.fill();
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FEF08A';
      ctx.font = '900 18px "JetBrains Mono", monospace';
      ctx.fillText(`ATTACK FORMATION! ${m.targetName}`, W * 0.5, H * 0.42);
    }

    if (this.phase === 'TITLE') {
      ctx.fillStyle = 'rgba(4, 10, 24, 0.78)';
      ctx.beginPath();
      ctx.roundRect(W * 0.5 - 196, H * 0.52 - 46, 392, 92, 12);
      ctx.fill();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = '#38BDF8';
      ctx.font = '900 32px "Outfit", sans-serif';
      ctx.fillText('1943', W * 0.5, H * 0.52 - 12);
      ctx.fillStyle = '#FACC15';
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.fillText('THE BATTLE OF MIDWAY · SHOTGUN · YAMATO FLEET', W * 0.5, H * 0.52 + 18);
    }

    ctx.restore();
  }
}

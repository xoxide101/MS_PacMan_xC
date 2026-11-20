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

// Custom 2.5D Extruded Isometric-Perspective Engine for Gauntlet: Dark Legacy (Midway, 2000)
const VIEW_W = 1280;
const VIEW_H = 800;
const TILE = 52;
const WALL_H = 26; // 2.5D extruded stone wall height
const MAP_COLS = 36;
const MAP_ROWS = 26;

const T_FLOOR = 0;
const T_WALL = 1;
const T_DOOR = 2;
const T_PORTAL = 3;
const T_HAZARD = 4; // Ice/Lava/Acid hazard per realm
const T_BRIDGE = 5; // Elevated bridge / marble walkway
const T_PILLAR = 6; // Tall 2.5D stone obelisk/pillar
const T_BRAZIER = 7; // Glowing fire brazier on stone plinth

type DLColorId = 'red' | 'blue' | 'yellow' | 'green';

interface DLColorSpec {
  id: DLColorId;
  label: string;
  primary: string;
  dark: string;
  light: string;
  trim: string;
}

const DL_COLORS: DLColorSpec[] = [
  { id: 'red', label: 'RED', primary: '#EF4444', dark: '#7F1D1D', light: '#FCA5A5', trim: '#FDE047' },
  { id: 'blue', label: 'BLUE', primary: '#3B82F6', dark: '#1E3A8A', light: '#93C5FD', trim: '#E0F2FE' },
  { id: 'yellow', label: 'YELLOW', primary: '#EAB308', dark: '#713F12', light: '#FEF08A', trim: '#FFFBEB' },
  { id: 'green', label: 'GREEN', primary: '#22C55E', dark: '#14532D', light: '#86EFAC', trim: '#FACC15' },
];

type DLClassId =
  | 'knight'
  | 'valkyrie'
  | 'wizard'
  | 'archer'
  | 'jester'
  | 'dwarf'
  | 'sorceress'
  | 'minotaur';

interface DLHeroClass {
  id: DLClassId;
  name: string;
  defaultColorIdx: number;
  weapon: string;
  turboName: string;
  turboColor: string;
  str: number; // 1..5
  spd: number;
  arm: number;
  mag: number;
  baseSpeed: number;
  baseDmg: number;
  baseHp: number;
  fireRate: number;
  meleeRange: number;
}

const DL_CLASSES: DLHeroClass[] = [
  {
    id: 'knight',
    name: 'Knight',
    defaultColorIdx: 0,
    weapon: 'Broadsword',
    turboName: 'Solar Whirlwind',
    turboColor: '#F59E0B',
    str: 5,
    spd: 3,
    arm: 4,
    mag: 2,
    baseSpeed: 235,
    baseDmg: 28,
    baseHp: 320,
    fireRate: 0.22,
    meleeRange: 64,
  },
  {
    id: 'valkyrie',
    name: 'Valkyrie',
    defaultColorIdx: 1,
    weapon: 'Halberd',
    turboName: 'Divine Lance Nova',
    turboColor: '#38BDF8',
    str: 4,
    spd: 4,
    arm: 5,
    mag: 3,
    baseSpeed: 252,
    baseDmg: 25,
    baseHp: 350,
    fireRate: 0.19,
    meleeRange: 72,
  },
  {
    id: 'wizard',
    name: 'Wizard',
    defaultColorIdx: 2,
    weapon: 'Arcane Staff',
    turboName: 'Meteor Storm',
    turboColor: '#F97316',
    str: 3,
    spd: 3,
    arm: 2,
    mag: 5,
    baseSpeed: 242,
    baseDmg: 26,
    baseHp: 260,
    fireRate: 0.17,
    meleeRange: 56,
  },
  {
    id: 'archer',
    name: 'Archer',
    defaultColorIdx: 3,
    weapon: 'Longbow',
    turboName: 'Starfall Volley',
    turboColor: '#4ADE80',
    str: 3,
    spd: 5,
    arm: 2,
    mag: 4,
    baseSpeed: 286,
    baseDmg: 21,
    baseHp: 270,
    fireRate: 0.13,
    meleeRange: 54,
  },
  {
    id: 'jester',
    name: 'Jester',
    defaultColorIdx: 0,
    weapon: 'Chaos Bombs',
    turboName: 'Firework Barrage',
    turboColor: '#EC4899',
    str: 3,
    spd: 5,
    arm: 3,
    mag: 4,
    baseSpeed: 282,
    baseDmg: 24,
    baseHp: 285,
    fireRate: 0.16,
    meleeRange: 58,
  },
  {
    id: 'dwarf',
    name: 'Dwarf',
    defaultColorIdx: 1,
    weapon: 'War Hammer',
    turboName: 'Seismic Quake',
    turboColor: '#FACC15',
    str: 5,
    spd: 2,
    arm: 5,
    mag: 2,
    baseSpeed: 222,
    baseDmg: 33,
    baseHp: 380,
    fireRate: 0.25,
    meleeRange: 66,
  },
  {
    id: 'sorceress',
    name: 'Sorceress',
    defaultColorIdx: 2,
    weapon: 'Twin Orbs',
    turboName: 'Lightning Tempest',
    turboColor: '#C084FC',
    str: 2,
    spd: 4,
    arm: 2,
    mag: 5,
    baseSpeed: 262,
    baseDmg: 23,
    baseHp: 255,
    fireRate: 0.15,
    meleeRange: 56,
  },
  {
    id: 'minotaur',
    name: 'Minotaur',
    defaultColorIdx: 3,
    weapon: 'Greataxe',
    turboName: 'Berserker Wave',
    turboColor: '#EF4444',
    str: 5,
    spd: 3,
    arm: 4,
    mag: 2,
    baseSpeed: 244,
    baseDmg: 35,
    baseHp: 365,
    fireRate: 0.24,
    meleeRange: 74,
  },
];

interface RealmSpec {
  id: number;
  name: string;
  subtitle: string;
  bossName: string;
  bossKind: 'frost_dragon' | 'lich' | 'chimera' | 'plague_fiend' | 'skorne';
  floorA: string;
  floorB: string;
  wallTop: string;
  wallFace: string;
  wallDark: string;
  hazardColor: string;
  hazardGlow: string;
  ambientGlow: string;
  enemyPool: Array<'orc' | 'skeleton' | 'golem' | 'gargoyle' | 'imp' | 'dark_knight' | 'hellhound'>;
}

const REALMS: RealmSpec[] = [
  {
    id: 1,
    name: 'Mountain Kingdom',
    subtitle: 'Frozen Ramparts & Dragon Crag',
    bossName: 'DRAKUS · FROST DRAGON',
    bossKind: 'frost_dragon',
    floorA: '#1E293B',
    floorB: '#172031',
    wallTop: '#94A3B8',
    wallFace: '#475569',
    wallDark: '#1E293B',
    hazardColor: '#0EA5E9',
    hazardGlow: '#7DD3FC',
    ambientGlow: 'rgba(56, 189, 248, 0.06)',
    enemyPool: ['orc', 'golem', 'skeleton'],
  },
  {
    id: 2,
    name: 'Forsaken Province',
    subtitle: 'Haunted Crypts & Cursed Barrow',
    bossName: 'LORD MALAK · NECRO LICH',
    bossKind: 'lich',
    floorA: '#1A2421',
    floorB: '#141C1A',
    wallTop: '#526A63',
    wallFace: '#31443F',
    wallDark: '#1A2623',
    hazardColor: '#22C55E',
    hazardGlow: '#86EFAC',
    ambientGlow: 'rgba(34, 197, 94, 0.06)',
    enemyPool: ['skeleton', 'gargoyle', 'orc'],
  },
  {
    id: 3,
    name: 'Castle Stronghold',
    subtitle: 'Torchlit Keep & Armory Halls',
    bossName: 'PYROS · IRON CHIMERA',
    bossKind: 'chimera',
    floorA: '#291C1B',
    floorB: '#211615',
    wallTop: '#9A6B4F',
    wallFace: '#63402D',
    wallDark: '#362116',
    hazardColor: '#EA580C',
    hazardGlow: '#FDBA74',
    ambientGlow: 'rgba(249, 115, 22, 0.07)',
    enemyPool: ['dark_knight', 'imp', 'gargoyle'],
  },
  {
    id: 4,
    name: 'Sky Dominion',
    subtitle: 'Floating Citadel of Storms',
    bossName: 'VEXIS · STORM FIEND',
    bossKind: 'plague_fiend',
    floorA: '#1E2542',
    floorB: '#181E38',
    wallTop: '#A5B4FC',
    wallFace: '#4F46E5',
    wallDark: '#312E81',
    hazardColor: '#A855F7',
    hazardGlow: '#E9D5FF',
    ambientGlow: 'rgba(129, 140, 248, 0.07)',
    enemyPool: ['gargoyle', 'golem', 'dark_knight'],
  },
  {
    id: 5,
    name: 'Desecrated Temple',
    subtitle: 'Skorne’s Molten Underworld',
    bossName: 'SKORNE · LORD OF DARKNESS',
    bossKind: 'skorne',
    floorA: '#241115',
    floorB: '#1B0C10',
    wallTop: '#B91C1C',
    wallFace: '#7F1D1D',
    wallDark: '#450A0A',
    hazardColor: '#F97316',
    hazardGlow: '#FEF08A',
    ambientGlow: 'rgba(239, 68, 68, 0.09)',
    enemyPool: ['hellhound', 'dark_knight', 'imp'],
  },
];

type DLEnemyKind =
  | 'orc'
  | 'skeleton'
  | 'golem'
  | 'gargoyle'
  | 'imp'
  | 'dark_knight'
  | 'hellhound'
  | 'death'
  | 'boss';

interface DLEnemy {
  kind: DLEnemyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  dmg: number;
  xpValue: number;
  fireTimer: number;
  specialTimer: number;
  hitFlash: number;
  anim: number;
}

interface DLSpawner {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  enemyKind: DLEnemyKind;
  timer: number;
  hitFlash: number;
}

interface DLBarrel {
  x: number;
  y: number;
  hp: number;
}

type DLPickupKind =
  | 'gold'
  | 'chest'
  | 'meat'
  | 'key'
  | 'runestone'
  | 'relic_3way'
  | 'relic_rapid'
  | 'relic_halo'
  | 'relic_phoenix';

interface DLPickup {
  x: number;
  y: number;
  kind: DLPickupKind;
  value: number;
}

interface DLProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fromPlayer: boolean;
  damage: number;
  color: string;
  radius: number;
  life: number;
  pierce: number;
  explosive: boolean;
  spin: number;
}

interface SlashArc {
  x: number;
  y: number;
  angle: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
  comboStep: number;
}

interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  life: number;
  maxLife: number;
}

interface ShopOption {
  id: 'str' | 'spd' | 'arm' | 'mag' | 'phoenix';
  name: string;
  desc: string;
  cost: number;
  color: string;
}

const SHOP_OPTIONS: ShopOption[] = [
  { id: 'str', name: 'Strength Gauntlets', desc: '+18% Melee & Shot Damage', cost: 400, color: '#EF4444' },
  { id: 'spd', name: 'Winged Boots', desc: '+14% Move & Attack Speed', cost: 350, color: '#22C55E' },
  { id: 'arm', name: 'Dragonscale Armor', desc: '+60 Max HP & Full Heal', cost: 450, color: '#3B82F6' },
  { id: 'mag', name: 'Arcane Runestone', desc: '+30% Turbo Charge & Power', cost: 400, color: '#FACC15' },
  { id: 'phoenix', name: 'Phoenix & 3-Way Relic', desc: 'Summon Phoenix + Triple Shot', cost: 600, color: '#F97316' },
];

export class GauntletDarkLegacyGame implements ArcadeGameInstance {
  public readonly logicalWidth = VIEW_W;
  public readonly logicalHeight = VIEW_H;
  public readonly supportsPointerAim = true;
  public readonly primaryActionLabel = 'Combo / Shoot';
  public readonly secondaryActionLabel = 'Turbo Attack';

  private readonly storageKey = 'gauntlet_dark_legacy_hd_highscore_v1';

  private phase: ClassicGamePhase = 'TITLE';
  private subMode: 'SELECT' | 'PLAY' | 'SHOP' = 'PLAY';
  private score = 0;
  private highScore = 0;
  private realmIdx = 0;
  private classIdx = 0;
  private colorIdx = 0;

  // RPG Progression
  private heroLevel = 1;
  private xp = 0;
  private nextXp = 220;
  private gold = 0;
  private keys = 1;
  private runestonesCollected = 0;
  private totalRunestones = 0;
  private hp = 320;
  private maxHp = 320;
  private turbo = 65; // 0..100

  // Shop upgrades
  private upgStr = 0;
  private upgSpd = 0;
  private upgArm = 0;
  private upgMag = 0;
  private shopCursor = 0;

  // Timed Dark Legacy Relics
  private threeWayTimer = 0;
  private rapidFireTimer = 0;
  private haloTimer = 0;
  private phoenixTimer = 0;
  private phoenixAngle = 0;
  private phoenixFireCd = 0;

  private playerX = TILE * 3.5;
  private playerY = TILE * 3.5;
  private aimX = 1;
  private aimY = 0;
  private walkAnim = 0;
  private comboStep = 0;
  private comboResetTimer = 0;
  private fireCooldown = 0;
  private invulnTimer = 0;
  private levelUpFlash = 0;
  private shakeTimer = 0;
  private shakeMag = 0;

  private grid: number[][] = [];
  private camX = 0;
  private camY = 0;
  private time = 0;
  private phaseTimer = 0;
  private bannerText = '';
  private alertText = '';
  private alertTimer = 0;
  private bossDefeated = false;

  private input: ArcadeInputState = createEmptyInput();
  private prevLeft = false;
  private prevRight = false;
  private prevUp = false;
  private prevDown = false;
  private uiLock = 0;

  private enemies: DLEnemy[] = [];
  private spawners: DLSpawner[] = [];
  private barrels: DLBarrel[] = [];
  private pickups: DLPickup[] = [];
  private projectiles: DLProjectile[] = [];
  private slashes: SlashArc[] = [];
  private shockwaves: Shockwave[] = [];
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  constructor() {
    this.highScore = readHighScore(this.storageKey);
    this.buildRealm(0);
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public startNewGame(): void {
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.realmIdx = 0;
    this.heroLevel = 1;
    this.xp = 0;
    this.nextXp = 220;
    this.gold = 250;
    this.keys = 1;
    this.totalRunestones = 0;
    this.upgStr = 0;
    this.upgSpd = 0;
    this.upgArm = 0;
    this.upgMag = 0;
    this.threeWayTimer = 0;
    this.rapidFireTimer = 0;
    this.haloTimer = 0;
    this.phoenixTimer = 0;
    this.particles = [];
    this.popups = [];
    this.slashes = [];
    this.shockwaves = [];
    this.subMode = 'SELECT';
    this.uiLock = 0.25;
    this.phase = 'PLAYING';
    this.bannerText = '';
    this.syncStatsToClass();
    this.buildRealm(0);
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING' && this.subMode === 'PLAY') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.subMode = 'PLAY';
    this.realmIdx = 0;
    this.buildRealm(0);
  }

  // Pressing R cycles Dark Legacy Hero Class on the fly!
  public restartStage(): void {
    this.classIdx = (this.classIdx + 1) % DL_CLASSES.length;
    this.colorIdx = DL_CLASSES[this.classIdx].defaultColorIdx;
    this.syncStatsToClass(true);
    this.showAlert(`HERO CHANGED: ${this.getColor().label} ${this.getHero().name.toUpperCase()}`);
  }

  private getHero(): DLHeroClass {
    return DL_CLASSES[this.classIdx];
  }

  private getColor(): DLColorSpec {
    return DL_COLORS[this.colorIdx];
  }

  private getRealm(): RealmSpec {
    return REALMS[this.realmIdx % REALMS.length];
  }

  private getRankTitle(): string {
    if (this.heroLevel >= 12) return 'DARK LEGEND';
    if (this.heroLevel >= 8) return 'WARLORD';
    if (this.heroLevel >= 5) return 'CHAMPION';
    if (this.heroLevel >= 3) return 'VETERAN';
    return 'ADVENTURER';
  }

  private syncStatsToClass(keepRatio = false): void {
    const ratio = keepRatio && this.maxHp > 0 ? this.hp / this.maxHp : 1;
    this.maxHp = this.getHero().baseHp + (this.heroLevel - 1) * 28 + this.upgArm * 60;
    this.hp = Math.min(this.maxHp, Math.max(40, Math.round(this.maxHp * ratio)));
  }

  public getHudSnapshot(): ClassicGameHud {
    const realm = this.getRealm();
    const stageStr =
      this.subMode === 'SELECT'
        ? 'SUMNER’S TOWER · SELECT HERO'
        : this.subMode === 'SHOP'
          ? 'SUMNER’S ARMORY SHOP'
          : `${realm.name} · Lv.${this.heroLevel} ${this.getHero().name}`;
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.realmIdx + 1,
      lives: Math.max(0, Math.min(6, Math.ceil((this.hp / this.maxHp) * 5))),
      stageName: stageStr,
      primaryMetricLabel: 'HP / Turbo',
      primaryMetricValue: `${Math.ceil(this.hp)}/${this.maxHp} · ${Math.floor(this.turbo)}%`,
      secondaryMetricLabel: 'Gold / Runes',
      secondaryMetricValue: `${this.gold}G · ${this.totalRunestones}R`,
      bannerText: this.bannerText || this.alertText,
      canRestartStage: true,
    };
  }

  private showAlert(text: string): void {
    this.alertText = text;
    this.alertTimer = 2.6;
  }

  private triggerShake(mag: number, dur = 0.22): void {
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeTimer = Math.max(this.shakeTimer, dur);
  }

  private addScore(pts: number, x?: number, y?: number, color = '#FDE047', label?: string): void {
    if (this.phase === 'TITLE') return;
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(this.storageKey, this.highScore);
    }
    if (x !== undefined && y !== undefined) {
      this.popups.push({
        x: x - this.camX,
        y: y - this.camY,
        text: label ?? `+${pts}`,
        color,
        life: 0.9,
        maxLife: 0.9,
      });
    }
  }

  private gainXp(amount: number): void {
    if (this.phase === 'TITLE') return;
    this.xp += amount;
    while (this.xp >= this.nextXp) {
      this.xp -= this.nextXp;
      this.heroLevel += 1;
      this.nextXp = Math.round(this.nextXp * 1.38);
      this.syncStatsToClass(false);
      this.turbo = 100;
      this.levelUpFlash = 1.1;
      arcadeAudio.playStageClear();
      this.shockwaves.push({
        x: this.playerX,
        y: this.playerY,
        radius: 16,
        maxRadius: 210,
        color: '#FACC15',
        life: 0.65,
        maxLife: 0.65,
      });
      this.popups.push({
        x: this.playerX - this.camX,
        y: this.playerY - this.camY - 26,
        text: `LEVEL ${this.heroLevel} · ${this.getRankTitle()}!`,
        color: '#FEF08A',
        life: 1.5,
        maxLife: 1.5,
      });
      this.showAlert(`LEVEL UP! YOU ARE NOW LEVEL ${this.heroLevel} ${this.getRankTitle()}!`);
    }
  }

  private buildRealm(idx: number): void {
    const realm = REALMS[idx % REALMS.length];
    const loopMult = 1 + Math.floor(idx / REALMS.length) * 0.45;
    this.bossDefeated = false;
    this.runestonesCollected = 0;

    // Create 36x26 2.5D multi-wing realm fortress with courtyard, side vaults, bridges & boss sanctum!
    const g: number[][] = Array.from({ length: MAP_ROWS }, (_, r) =>
      Array.from({ length: MAP_COLS }, (_, c) =>
        r === 0 || r === MAP_ROWS - 1 || c === 0 || c === MAP_COLS - 1 ? T_WALL : T_FLOOR
      )
    );

    const wallH = (r: number, c1: number, c2: number) => {
      for (let c = c1; c <= c2; c++) g[r][c] = T_WALL;
    };
    const wallV = (c: number, r1: number, r2: number) => {
      for (let r = r1; r <= r2; r++) g[r][c] = T_WALL;
    };

    // Entrance Courtyard (left) -> Grand Central Hall -> Eastern Boss Sanctum!
    wallV(10, 1, 24);
    g[11][10] = T_FLOOR;
    g[12][10] = T_FLOOR;
    g[13][10] = T_FLOOR;
    g[5][10] = T_DOOR;
    g[6][10] = T_DOOR;

    // Upper & Lower Treasure Wings in central hall
    wallH(8, 10, 23);
    wallH(17, 10, 23);
    g[8][15] = T_FLOOR;
    g[8][16] = T_FLOOR;
    g[17][17] = T_DOOR;
    g[17][18] = T_DOOR;

    // Boss Sanctum Gatehouse at col 23
    wallV(23, 1, 24);
    g[11][23] = T_FLOOR;
    g[12][23] = T_FLOOR;
    g[13][23] = T_FLOOR;
    g[14][23] = T_FLOOR;

    // Scenic Hazard Moat + Stone Bridge leading into Boss Sanctum!
    for (let r = 9; r <= 16; r++) {
      g[r][21] = T_HAZARD;
      g[r][22] = T_HAZARD;
    }
    for (let r = 11; r <= 14; r++) {
      g[r][21] = T_BRIDGE;
      g[r][22] = T_BRIDGE;
    }

    // Realm-specific scenic hazards & 2.5D pillars/braziers
    const pillarCoords: Array<[number, number]> = [
      [5, 6],
      [5, 19],
      [14, 11],
      [14, 14],
      [19, 11],
      [19, 14],
      [27, 6],
      [27, 19],
      [32, 6],
      [32, 19],
    ];
    for (const [pc, pr] of pillarCoords) g[pr][pc] = T_PILLAR;

    const brazierCoords: Array<[number, number]> = [
      [8, 10],
      [8, 15],
      [12, 5],
      [20, 5],
      [12, 20],
      [20, 20],
      [25, 10],
      [25, 15],
      [33, 10],
      [33, 15],
    ];
    for (const [bc, br] of brazierCoords) g[br][bc] = T_BRAZIER;

    // Hazard pools in side wings
    g[4][14] = T_HAZARD;
    g[4][15] = T_HAZARD;
    g[21][14] = T_HAZARD;
    g[21][15] = T_HAZARD;
    g[12][6] = T_HAZARD;

    // Realm Exit Portal inside Boss Sanctum (activates once Boss is slain!)
    g[12][34] = T_PORTAL;
    g[13][34] = T_PORTAL;

    this.grid = g;
    this.playerX = 3.5 * TILE;
    this.playerY = 12.5 * TILE;
    this.aimX = 1;
    this.aimY = 0;

    this.enemies = [];
    this.spawners = [];
    this.barrels = [];
    this.pickups = [];
    this.projectiles = [];
    this.slashes = [];
    this.shockwaves = [];

    // Monster Spawners across Courtyard, North/South Wings & Sanctum Approach
    const spawnerSpots: Array<[number, number]> = [
      [7, 4],
      [7, 21],
      [16, 4],
      [21, 5],
      [16, 21],
      [19, 13],
      [26, 4],
      [26, 21],
    ];
    spawnerSpots.forEach(([sc, sr], si) => {
      const ek = realm.enemyPool[si % realm.enemyPool.length];
      this.spawners.push({
        x: (sc + 0.5) * TILE,
        y: (sr + 0.5) * TILE,
        hp: Math.round(95 * loopMult),
        maxHp: Math.round(95 * loopMult),
        enemyKind: ek,
        timer: 1.4 + (si % 3) * 0.7,
        hitFlash: 0,
      });
    });

    // Initial patrolling enemies
    const patrolSpots: Array<[number, number]> = [
      [8, 8],
      [8, 17],
      [13, 12],
      [17, 13],
      [18, 4],
      [14, 20],
      [25, 8],
      [25, 17],
    ];
    patrolSpots.forEach(([ec, er], ei) => {
      const ek = realm.enemyPool[ei % realm.enemyPool.length];
      this.enemies.push(this.createEnemy(ek, (ec + 0.5) * TILE, (er + 0.5) * TILE, loopMult));
    });

    // Classic Death stalker in deeper realms
    if (idx >= 1) {
      this.enemies.push(this.createEnemy('death', 19.5 * TILE, 21.5 * TILE, loopMult));
    }

    // THE REALM BOSS in the Eastern Sanctum!
    const bossHp = Math.round((560 + idx * 210) * loopMult);
    this.enemies.push({
      kind: 'boss',
      x: 30.5 * TILE,
      y: 12.5 * TILE,
      vx: 0,
      vy: 0,
      hp: bossHp,
      maxHp: bossHp,
      speed: 98 + idx * 8,
      radius: 36,
      dmg: 26 + idx * 4,
      xpValue: 450 + idx * 140,
      fireTimer: 1.5,
      specialTimer: 4.0,
      hitFlash: 0,
      anim: 0,
    });

    // Explosive Powder Kegs (Dark Legacy signature — shoot to blast swarms!)
    const barrelCoords: Array<[number, number]> = [
      [8, 12],
      [15, 6],
      [16, 13],
      [15, 19],
      [27, 12],
      [29, 8],
      [29, 17],
    ];
    for (const [bc, br] of barrelCoords) {
      this.barrels.push({ x: (bc + 0.5) * TILE, y: (br + 0.5) * TILE, hp: 18 });
    }

    // Pickups: 2 Glowing Runestones, Keys, Meat, Gold, Chests, & Dark Legacy Relics!
    const items: Array<[number, number, DLPickupKind, number]> = [
      [18, 2, 'runestone', 500],
      [13, 23, 'runestone', 500],
      [4, 4, 'key', 100],
      [12, 14, 'key', 100],
      [6, 17, 'meat', 90],
      [18, 12, 'meat', 90],
      [25, 12, 'meat', 110],
      [28, 3, 'meat', 110],
      [12, 2, 'relic_3way', 200],
      [20, 22, 'relic_phoenix', 250],
      [5, 22, 'relic_rapid', 200],
      [31, 4, 'relic_halo', 250],
      [3, 18, 'gold', 120],
      [14, 3, 'chest', 260],
      [21, 2, 'chest', 260],
      [18, 23, 'chest', 300],
      [32, 22, 'chest', 350],
    ];
    for (const [ic, ir, kind, value] of items) {
      this.pickups.push({ x: (ic + 0.5) * TILE, y: (ir + 0.5) * TILE, kind, value });
    }

    this.centerCamera(true);
  }

  private createEnemy(kind: DLEnemyKind, x: number, y: number, mult: number): DLEnemy {
    const table: Record<
      Exclude<DLEnemyKind, 'boss'>,
      { hp: number; spd: number; r: number; dmg: number; xp: number }
    > = {
      orc: { hp: 58, spd: 112, r: 17, dmg: 14, xp: 34 },
      skeleton: { hp: 44, spd: 132, r: 15, dmg: 12, xp: 28 },
      golem: { hp: 110, spd: 80, r: 21, dmg: 22, xp: 58 },
      gargoyle: { hp: 72, spd: 142, r: 17, dmg: 16, xp: 46 },
      imp: { hp: 48, spd: 138, r: 14, dmg: 15, xp: 36 },
      dark_knight: { hp: 124, spd: 108, r: 19, dmg: 24, xp: 68 },
      hellhound: { hp: 64, spd: 168, r: 16, dmg: 18, xp: 48 },
      death: { hp: 9999, spd: 124, r: 19, dmg: 32, xp: 250 },
    };
    const t = table[kind === 'boss' ? 'dark_knight' : kind];
    const scaledHp = kind === 'death' ? 9999 : Math.round(t.hp * mult);
    return {
      kind,
      x,
      y,
      vx: 0,
      vy: 0,
      hp: scaledHp,
      maxHp: scaledHp,
      speed: t.spd,
      radius: t.r,
      dmg: Math.round(t.dmg * mult),
      xpValue: Math.round(t.xp * mult),
      fireTimer: 1.5 + Math.random() * 1.4,
      specialTimer: 3.0,
      hitFlash: 0,
      anim: Math.random() * 6,
    };
  }

  private centerCamera(immediate: boolean): void {
    const maxX = Math.max(0, MAP_COLS * TILE - VIEW_W);
    const maxY = Math.max(0, MAP_ROWS * TILE - VIEW_H);
    const tx = Math.max(0, Math.min(maxX, this.playerX - VIEW_W * 0.5));
    const ty = Math.max(0, Math.min(maxY, this.playerY - VIEW_H * 0.5));
    if (immediate) {
      this.camX = tx;
      this.camY = ty;
    } else {
      this.camX += (tx - this.camX) * 0.14;
      this.camY += (ty - this.camY) * 0.14;
    }
  }

  public step(dt: number): void {
    this.time += dt;
    stepParticlesAndPopups(this.particles, this.popups, dt);
    if (this.alertTimer > 0) {
      this.alertTimer -= dt;
      if (this.alertTimer <= 0) this.alertText = '';
    }
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (this.levelUpFlash > 0) this.levelUpFlash = Math.max(0, this.levelUpFlash - dt);
    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
      if (this.shakeTimer <= 0) this.shakeMag = 0;
    }
    if (this.threeWayTimer > 0) this.threeWayTimer = Math.max(0, this.threeWayTimer - dt);
    if (this.rapidFireTimer > 0) this.rapidFireTimer = Math.max(0, this.rapidFireTimer - dt);
    if (this.haloTimer > 0) this.haloTimer = Math.max(0, this.haloTimer - dt);
    if (this.phoenixTimer > 0) this.phoenixTimer = Math.max(0, this.phoenixTimer - dt);

    for (let i = this.slashes.length - 1; i >= 0; i--) {
      this.slashes[i].life -= dt;
      if (this.slashes[i].life <= 0) this.slashes.splice(i, 1);
    }
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.life -= dt;
      const t = 1 - Math.max(0, s.life / s.maxLife);
      s.radius = 20 + (s.maxRadius - 20) * t;
      if (s.life <= 0) this.shockwaves.splice(i, 1);
    }

    if (this.phase === 'PAUSED' || this.phase === 'GAME_OVER') return;

    if (this.phase === 'PLAYING' && this.subMode === 'SELECT') {
      this.stepHeroSelect(dt);
      return;
    }
    if (this.phase === 'PLAYING' && this.subMode === 'SHOP') {
      this.stepArmoryShop(dt);
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
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.realmIdx += 1;
        this.subMode = 'SHOP';
        this.uiLock = 0.25;
        this.shopCursor = 0;
        this.phase = 'PLAYING';
        this.bannerText = '';
      }
      return;
    }

    const isAttract = this.phase === 'TITLE';
    this.updatePlayer(dt, isAttract);
    this.updatePhoenix(dt, isAttract);
    this.updateSpawners(dt);
    this.updateEnemies(dt, isAttract);
    this.updateProjectiles(dt, isAttract);
    this.centerCamera(false);
  }

  private stepHeroSelect(dt: number): void {
    if (this.uiLock > 0) this.uiLock = Math.max(0, this.uiLock - dt);
    const lJ = this.input.left && !this.prevLeft;
    const rJ = this.input.right && !this.prevRight;
    const uJ = this.input.up && !this.prevUp;
    const dJ = this.input.down && !this.prevDown;
    this.prevLeft = this.input.left;
    this.prevRight = this.input.right;
    this.prevUp = this.input.up;
    this.prevDown = this.input.down;

    if (lJ) {
      this.classIdx = (this.classIdx + DL_CLASSES.length - 1) % DL_CLASSES.length;
      arcadeAudio.playMoveTick();
    } else if (rJ) {
      this.classIdx = (this.classIdx + 1) % DL_CLASSES.length;
      arcadeAudio.playMoveTick();
    }
    if (uJ) {
      this.colorIdx = (this.colorIdx + DL_COLORS.length - 1) % DL_COLORS.length;
      arcadeAudio.playMoveTick();
    } else if (dJ) {
      this.colorIdx = (this.colorIdx + 1) % DL_COLORS.length;
      arcadeAudio.playMoveTick();
    }

    if (this.input.pointerActive && this.uiLock <= 0) {
      const px = this.input.pointerX * VIEW_W;
      const py = this.input.pointerY * VIEW_H;
      // 8 class tiles in 2 rows of 4
      const cw = 266;
      const ch = 205;
      const gapX = 20;
      const gapY = 18;
      const sx = (VIEW_W - (cw * 4 + gapX * 3)) * 0.5;
      const sy = 148;
      for (let i = 0; i < DL_CLASSES.length; i++) {
        const col = i % 4;
        const row = Math.floor(i / 4);
        const cx = sx + col * (cw + gapX);
        const cy = sy + row * (ch + gapY);
        if (px >= cx && px <= cx + cw && py >= cy && py <= cy + ch) {
          this.classIdx = i;
          if (this.input.fireJustPressed) {
            this.confirmHeroStart();
            return;
          }
        }
      }
      // 4 color buttons row
      if (py >= 596 && py <= 646) {
        const bw = 148;
        const bgap = 18;
        const bsx = (VIEW_W - (bw * 4 + bgap * 3)) * 0.5;
        for (let ci = 0; ci < 4; ci++) {
          const bx = bsx + ci * (bw + bgap);
          if (px >= bx && px <= bx + bw && this.input.fireJustPressed) {
            this.colorIdx = ci;
            arcadeAudio.playMoveTick();
            return;
          }
        }
      }
      // Enter Realm button
      if (py >= 674 && py <= 740 && px >= VIEW_W * 0.5 - 220 && px <= VIEW_W * 0.5 + 220 && this.input.fireJustPressed) {
        this.confirmHeroStart();
        return;
      }
    }

    if (this.uiLock <= 0 && (this.input.fireJustPressed || this.input.secondaryJustPressed)) {
      this.confirmHeroStart();
    }
  }

  private confirmHeroStart(): void {
    this.syncStatsToClass(false);
    this.subMode = 'PLAY';
    this.phase = 'READY';
    this.phaseTimer = 1.3;
    this.bannerText = `${this.getRealm().name.toUpperCase()} · ${this.getRealm().subtitle.toUpperCase()}`;
    this.showAlert('COLLECT RUNESTONES & SLAY THE REALM BOSS TO OPEN THE PORTAL!');
    arcadeAudio.playStageClear();
  }

  private stepArmoryShop(dt: number): void {
    if (this.uiLock > 0) this.uiLock = Math.max(0, this.uiLock - dt);
    const lJ = this.input.left && !this.prevLeft;
    const rJ = this.input.right && !this.prevRight;
    this.prevLeft = this.input.left;
    this.prevRight = this.input.right;

    if (lJ) {
      this.shopCursor = (this.shopCursor + SHOP_OPTIONS.length) % (SHOP_OPTIONS.length + 1);
      arcadeAudio.playMoveTick();
    } else if (rJ) {
      this.shopCursor = (this.shopCursor + 1) % (SHOP_OPTIONS.length + 1);
      arcadeAudio.playMoveTick();
    }

    if (this.input.pointerActive && this.uiLock <= 0) {
      const px = this.input.pointerX * VIEW_W;
      const py = this.input.pointerY * VIEW_H;
      const cw = 212;
      const gap = 18;
      const sx = (VIEW_W - (cw * 5 + gap * 4)) * 0.5;
      if (py >= 240 && py <= 520) {
        for (let i = 0; i < SHOP_OPTIONS.length; i++) {
          const cx = sx + i * (cw + gap);
          if (px >= cx && px <= cx + cw) {
            this.shopCursor = i;
            if (this.input.fireJustPressed) {
              this.buyShopItem(i);
              return;
            }
          }
        }
      }
      if (py >= 590 && py <= 660 && px >= VIEW_W * 0.5 - 210 && px <= VIEW_W * 0.5 + 210) {
        this.shopCursor = SHOP_OPTIONS.length;
        if (this.input.fireJustPressed) {
          this.leaveShopToNextRealm();
          return;
        }
      }
    }

    if (this.uiLock <= 0 && this.input.fireJustPressed) {
      if (this.shopCursor === SHOP_OPTIONS.length) {
        this.leaveShopToNextRealm();
      } else {
        this.buyShopItem(this.shopCursor);
      }
    } else if (this.uiLock <= 0 && this.input.secondaryJustPressed) {
      this.leaveShopToNextRealm();
    }
  }

  private buyShopItem(idx: number): void {
    const opt = SHOP_OPTIONS[idx];
    if (!opt) return;
    if (this.gold < opt.cost) {
      arcadeAudio.playSplat();
      this.showAlert(`NEED ${opt.cost} GOLD FOR ${opt.name.toUpperCase()}!`);
      return;
    }
    this.gold -= opt.cost;
    arcadeAudio.playKeyUnlock();
    if (opt.id === 'str') this.upgStr += 1;
    else if (opt.id === 'spd') this.upgSpd += 1;
    else if (opt.id === 'arm') {
      this.upgArm += 1;
      this.syncStatsToClass(false);
    } else if (opt.id === 'mag') {
      this.upgMag += 1;
      this.turbo = 100;
    } else if (opt.id === 'phoenix') {
      this.phoenixTimer = 45;
      this.threeWayTimer = 45;
    }
    this.showAlert(`PURCHASED ${opt.name.toUpperCase()}!`);
  }

  private leaveShopToNextRealm(): void {
    this.hp = Math.min(this.maxHp, this.hp + Math.round(this.maxHp * 0.45));
    this.buildRealm(this.realmIdx);
    this.subMode = 'PLAY';
    this.phase = 'READY';
    this.phaseTimer = 1.3;
    this.bannerText = `${this.getRealm().name.toUpperCase()} · ${this.getRealm().subtitle.toUpperCase()}`;
    arcadeAudio.playStageClear();
  }

  private isSolid(x: number, y: number, canUnlockDoor: boolean): boolean {
    const c = Math.floor(x / TILE);
    const r = Math.floor(y / TILE);
    const cell = this.grid[r]?.[c];
    if (cell === undefined || cell === T_WALL || cell === T_PILLAR || cell === T_BRAZIER) return true;
    if (cell === T_DOOR) {
      if (canUnlockDoor && this.keys > 0) {
        this.keys -= 1;
        this.unlockDoor(r, c);
        if (this.phase !== 'TITLE') {
          arcadeAudio.playKeyUnlock();
          this.showAlert('TREASURE GATE UNLOCKED!');
        }
        return false;
      }
      return true;
    }
    return false;
  }

  private unlockDoor(sr: number, sc: number): void {
    const q: Array<[number, number]> = [[sr, sc]];
    while (q.length > 0) {
      const [r, c] = q.shift()!;
      if (this.grid[r]?.[c] !== T_DOOR) continue;
      this.grid[r][c] = T_FLOOR;
      spawnBurst(this.particles, (c + 0.5) * TILE - this.camX, (r + 0.5) * TILE - this.camY, '#FACC15', 12, 160, 3.5);
      q.push([r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]);
    }
  }

  private updatePlayer(dt: number, isAttract: boolean): void {
    if (this.fireCooldown > 0) this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (this.comboResetTimer > 0) {
      this.comboResetTimer -= dt;
      if (this.comboResetTimer <= 0) this.comboStep = 0;
    }
    // Gentle passive Turbo trickle
    this.turbo = Math.min(100, this.turbo + (2.5 + this.upgMag * 1.2) * dt);

    const hero = this.getHero();
    const moveSpeed = hero.baseSpeed * (1 + this.upgSpd * 0.14);

    let mx = 0;
    let my = 0;

    if (isAttract) {
      const target = this.enemies[0] ?? { x: 30 * TILE, y: 12.5 * TILE };
      const dx = target.x - this.playerX;
      const dy = target.y - this.playerY;
      const dist = Math.hypot(dx, dy) || 1;
      this.aimX = dx / dist;
      this.aimY = dy / dist;
      mx = dist > 130 ? this.aimX : -this.aimX * 0.4;
      my = dist > 130 ? this.aimY : -this.aimY * 0.4;
      this.walkAnim += dt * 11;
      if (this.fireCooldown <= 0) this.performAttack(true);
    } else {
      mx = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
      my = (this.input.down ? 1 : 0) - (this.input.up ? 1 : 0);
      if (mx !== 0 || my !== 0) {
        const len = Math.hypot(mx, my);
        mx /= len;
        my /= len;
        this.walkAnim += dt * 12;
        if (!this.input.pointerActive) {
          this.aimX = mx;
          this.aimY = my;
        }
      }
      if (this.input.pointerActive) {
        const worldPx = this.camX + this.input.pointerX * VIEW_W;
        const worldPy = this.camY + this.input.pointerY * VIEW_H;
        const adx = worldPx - this.playerX;
        const ady = worldPy - this.playerY;
        const alen = Math.hypot(adx, ady) || 1;
        this.aimX = adx / alen;
        this.aimY = ady / alen;
      }

      if (this.input.secondaryJustPressed) {
        this.performTurboAttack(false);
      }
      if ((this.input.fire || this.input.fireJustPressed) && this.fireCooldown <= 0) {
        this.performAttack(false);
      }
    }

    const r = 15;
    const nx = this.playerX + mx * moveSpeed * dt;
    const ny = this.playerY + my * moveSpeed * dt;
    if (
      !this.isSolid(nx - r, this.playerY - r, true) &&
      !this.isSolid(nx + r, this.playerY + r, true) &&
      !this.isSolid(nx + r, this.playerY - r, true) &&
      !this.isSolid(nx - r, this.playerY + r, true)
    ) {
      this.playerX = nx;
    }
    if (
      !this.isSolid(this.playerX - r, ny - r, true) &&
      !this.isSolid(this.playerX + r, ny + r, true) &&
      !this.isSolid(this.playerX + r, ny - r, true) &&
      !this.isSolid(this.playerX - r, ny + r, true)
    ) {
      this.playerY = ny;
    }

    // Tile hazard & Realm Portal check
    const pc = Math.floor(this.playerX / TILE);
    const pr = Math.floor(this.playerY / TILE);
    const cell = this.grid[pr]?.[pc];
    if (cell === T_HAZARD && !isAttract && this.haloTimer <= 0) {
      this.damagePlayer(18 * dt, false);
    } else if (cell === T_PORTAL) {
      if (isAttract) {
        this.buildRealm(0);
      } else if (this.bossDefeated) {
        arcadeAudio.playStageClear();
        this.addScore(1500, this.playerX, this.playerY, '#4ADE80', 'REALM CLEARED!');
        this.phase = 'STAGE_CLEAR';
        this.phaseTimer = 1.4;
        this.bannerText = `${this.getRealm().name.toUpperCase()} LIBERATED!`;
      } else if (this.alertTimer <= 0) {
        this.showAlert(`DEFEAT ${this.getRealm().bossName} TO UNLOCK THE REALM PORTAL!`);
      }
    }

    // Collect Pickups
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      if (Math.hypot(p.x - this.playerX, p.y - this.playerY) < 32) {
        this.pickups.splice(i, 1);
        if (p.kind === 'gold' || p.kind === 'chest') {
          this.gold += p.value;
          if (!isAttract) arcadeAudio.playDiamond();
          this.addScore(p.value, p.x, p.y, '#FACC15', `+${p.value}G`);
        } else if (p.kind === 'meat') {
          this.hp = Math.min(this.maxHp, this.hp + p.value);
          if (!isAttract) arcadeAudio.playEatFruit();
          this.popups.push({
            x: p.x - this.camX,
            y: p.y - this.camY,
            text: `+${p.value} HP`,
            color: '#4ADE80',
            life: 0.9,
            maxLife: 0.9,
          });
        } else if (p.kind === 'key') {
          this.keys += 1;
          if (!isAttract) arcadeAudio.playKeyUnlock();
          this.addScore(100, p.x, p.y, '#FDE047', '+1 KEY');
        } else if (p.kind === 'runestone') {
          this.runestonesCollected += 1;
          this.totalRunestones += 1;
          this.turbo = 100;
          if (!isAttract) arcadeAudio.playStageClear();
          this.addScore(1000, p.x, p.y, '#38BDF8', 'RUNESTONE!');
          this.gainXp(140);
          this.showAlert(`RUNESTONE RECOVERED! (${this.runestonesCollected}/2 IN REALM)`);
        } else if (p.kind === 'relic_3way') {
          this.threeWayTimer = 25;
          if (!isAttract) arcadeAudio.playPowerPellet();
          this.showAlert('RELIC: 3-WAY SHOT ACTIVATED!');
        } else if (p.kind === 'relic_rapid') {
          this.rapidFireTimer = 22;
          if (!isAttract) arcadeAudio.playPowerPellet();
          this.showAlert('RELIC: RAPID FIRE ACTIVATED!');
        } else if (p.kind === 'relic_halo') {
          this.haloTimer = 14;
          if (!isAttract) arcadeAudio.playPowerPellet();
          this.showAlert('RELIC: INVULNERABILITY HALO!');
        } else if (p.kind === 'relic_phoenix') {
          this.phoenixTimer = 32;
          if (!isAttract) arcadeAudio.playPowerPellet();
          this.showAlert('RELIC: PHOENIX FAMILIAR SUMMONED!');
        }
      }
    }
  }

  private performAttack(isAttract: boolean): void {
    const hero = this.getHero();
    const rateMult = (this.rapidFireTimer > 0 ? 0.55 : 1) / (1 + this.upgSpd * 0.14);
    this.fireCooldown = Math.max(0.085, hero.fireRate * rateMult);

    const baseDmg = hero.baseDmg * (1 + (this.heroLevel - 1) * 0.14 + this.upgStr * 0.18);
    const aimAngle = Math.atan2(this.aimY, this.aimX);

    // Check if any enemy/spawner/barrel is in Melee Combo Range -> Execute blazing 3-hit Melee Slash!
    let meleeHit = false;
    const comboMult = this.comboStep === 2 ? 1.55 : 1.0;
    const meleeDmg = baseDmg * 1.25 * comboMult;
    const range = hero.meleeRange;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const dx = e.x - this.playerX;
      const dy = e.y - this.playerY;
      const dist = Math.hypot(dx, dy);
      if (dist <= range + e.radius) {
        const angDiff = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - aimAngle), Math.cos(Math.atan2(dy, dx) - aimAngle)));
        if (angDiff < 1.35 || dist < 38) {
          meleeHit = true;
          this.damageEnemy(i, meleeDmg, (dx / (dist || 1)) * 220, (dy / (dist || 1)) * 220, isAttract, this.comboStep === 2);
        }
      }
    }

    if (meleeHit) {
      this.slashes.push({
        x: this.playerX,
        y: this.playerY,
        angle: aimAngle,
        radius: range,
        color: this.comboStep === 2 ? '#FEF08A' : this.getColor().light,
        life: 0.16,
        maxLife: 0.16,
        comboStep: this.comboStep,
      });
      this.comboStep = (this.comboStep + 1) % 3;
      this.comboResetTimer = 0.7;
      if (!isAttract) arcadeAudio.playLaser(this.comboStep === 0 ? 480 : 620);
      if (this.comboStep === 0) this.triggerShake(4.5, 0.12);
    }

    // Always also fire Dark Legacy Ranged Weapon/Spell (and 3-Way Spread if Relic active!)
    const spreads = this.threeWayTimer > 0 ? [-0.22, 0, 0.22] : [0];
    const col = this.getColor();
    for (const sp of spreads) {
      const a = aimAngle + sp;
      const spd = hero.id === 'archer' ? 680 : hero.id === 'jester' ? 500 : 590;
      this.projectiles.push({
        x: this.playerX + Math.cos(a) * 18,
        y: this.playerY + Math.sin(a) * 18,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        fromPlayer: true,
        damage: baseDmg,
        color: hero.id === 'wizard' || hero.id === 'sorceress' ? hero.turboColor : col.light,
        radius: hero.id === 'dwarf' || hero.id === 'minotaur' ? 8 : 6,
        life: 0.9,
        pierce: hero.id === 'archer' ? 1 : 0,
        explosive: hero.id === 'jester',
        spin: 0,
      });
    }
    if (!meleeHit && !isAttract) arcadeAudio.playLaser(hero.id === 'archer' ? 920 : 720);
  }

  private performTurboAttack(isAttract: boolean): void {
    if (this.turbo < 40) {
      if (!isAttract) this.showAlert('BUILD TURBO GAUGE TO 40%+ FOR TURBO ATTACK!');
      return;
    }
    const hero = this.getHero();
    const powerScale = (this.turbo / 100) * (1 + this.upgMag * 0.3 + (this.heroLevel - 1) * 0.12);
    this.turbo = 0;

    if (!isAttract) {
      arcadeAudio.playPotionBlast();
      this.triggerShake(10, 0.34);
      this.showAlert(`${hero.turboName.toUpperCase()}!`);
    }

    const blastRad = 260 + this.upgMag * 35;
    this.shockwaves.push({
      x: this.playerX,
      y: this.playerY,
      radius: 20,
      maxRadius: blastRad,
      color: hero.turboColor,
      life: 0.45,
      maxLife: 0.45,
    });
    spawnBurst(this.particles, this.playerX - this.camX, this.playerY - this.camY, hero.turboColor, 28, 280, 4.5);

    const turboDmg = Math.round((130 + hero.mag * 24) * powerScale);

    // Blast all nearby enemies (including Death!)
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const dist = Math.hypot(e.x - this.playerX, e.y - this.playerY);
      if (dist <= blastRad) {
        if (e.kind === 'death') {
          this.enemies.splice(i, 1);
          spawnBurst(this.particles, e.x - this.camX, e.y - this.camY, '#38BDF8', 22, 220, 4);
          this.addScore(1500, e.x, e.y, '#38BDF8', 'DEATH BANISHED!');
          this.gainXp(250);
          continue;
        }
        const kx = ((e.x - this.playerX) / (dist || 1)) * 340;
        const ky = ((e.y - this.playerY) / (dist || 1)) * 340;
        this.damageEnemy(i, turboDmg, kx, ky, isAttract, true);
      }
    }

    // Blast spawners & barrels inside Turbo radius
    for (let gi = this.spawners.length - 1; gi >= 0; gi--) {
      const s = this.spawners[gi];
      if (Math.hypot(s.x - this.playerX, s.y - this.playerY) <= blastRad) {
        s.hp -= turboDmg;
        s.hitFlash = 0.25;
        if (s.hp <= 0) this.destroySpawner(gi, isAttract);
      }
    }
    for (let bi = this.barrels.length - 1; bi >= 0; bi--) {
      if (Math.hypot(this.barrels[bi].x - this.playerX, this.barrels[bi].y - this.playerY) <= blastRad) {
        this.detonateBarrel(bi, isAttract);
      }
    }
  }

  private updatePhoenix(dt: number, isAttract: boolean): void {
    if (this.phoenixTimer <= 0) return;
    this.phoenixAngle += dt * 3.2;
    this.phoenixFireCd -= dt;
    const fx = this.playerX + Math.cos(this.phoenixAngle) * 44;
    const fy = this.playerY + Math.sin(this.phoenixAngle) * 44;
    if (this.phoenixFireCd <= 0 && this.enemies.length > 0) {
      let best: DLEnemy | null = null;
      let bestD = 360;
      for (const e of this.enemies) {
        if (e.kind === 'death') continue;
        const d = Math.hypot(e.x - fx, e.y - fy);
        if (d < bestD) {
          bestD = d;
          best = e;
        }
      }
      if (best) {
        this.phoenixFireCd = 0.42;
        const ang = Math.atan2(best.y - fy, best.x - fx);
        this.projectiles.push({
          x: fx,
          y: fy,
          vx: Math.cos(ang) * 560,
          vy: Math.sin(ang) * 560,
          fromPlayer: true,
          damage: 24 + this.heroLevel * 3,
          color: '#F97316',
          radius: 5.5,
          life: 0.8,
          pierce: 0,
          explosive: false,
          spin: 0,
        });
        if (!isAttract) arcadeAudio.playLaser(980);
      }
    }
  }

  private updateSpawners(dt: number): void {
    const loopMult = 1 + Math.floor(this.realmIdx / REALMS.length) * 0.45;
    for (const s of this.spawners) {
      if (s.hitFlash > 0) s.hitFlash = Math.max(0, s.hitFlash - dt);
      s.timer -= dt;
      if (s.timer <= 0 && this.enemies.length < 28) {
        s.timer = 4.2;
        if (Math.hypot(s.x - this.playerX, s.y - this.playerY) < 620) {
          this.enemies.push(
            this.createEnemy(
              s.enemyKind,
              s.x + (Math.random() - 0.5) * 28,
              s.y + (Math.random() - 0.5) * 28,
              loopMult
            )
          );
        }
      }
    }
  }

  private destroySpawner(gi: number, isAttract: boolean): void {
    const s = this.spawners[gi];
    this.spawners.splice(gi, 1);
    if (!isAttract) arcadeAudio.playExplosion(false);
    spawnBurst(this.particles, s.x - this.camX, s.y - this.camY, '#F59E0B', 20, 210, 4);
    this.gold += 60;
    this.addScore(250, s.x, s.y, '#FACC15', '+250');
    this.gainXp(65);
  }

  private detonateBarrel(bi: number, isAttract: boolean): void {
    const b = this.barrels[bi];
    this.barrels.splice(bi, 1);
    if (!isAttract) {
      arcadeAudio.playExplosion(true);
      this.triggerShake(7.5, 0.22);
    }
    this.shockwaves.push({
      x: b.x,
      y: b.y,
      radius: 14,
      maxRadius: 155,
      color: '#F97316',
      life: 0.34,
      maxLife: 0.34,
    });
    spawnBurst(this.particles, b.x - this.camX, b.y - this.camY, '#F97316', 24, 240, 4.2);

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.kind === 'death') continue;
      const d = Math.hypot(e.x - b.x, e.y - b.y);
      if (d <= 160) {
        this.damageEnemy(i, 125, ((e.x - b.x) / (d || 1)) * 280, ((e.y - b.y) / (d || 1)) * 280, isAttract, true);
      }
    }
    for (let gi = this.spawners.length - 1; gi >= 0; gi--) {
      if (Math.hypot(this.spawners[gi].x - b.x, this.spawners[gi].y - b.y) <= 155) {
        this.spawners[gi].hp -= 120;
        if (this.spawners[gi].hp <= 0) this.destroySpawner(gi, isAttract);
      }
    }
  }

  private damageEnemy(
    idx: number,
    dmg: number,
    kx: number,
    ky: number,
    isAttract: boolean,
    isCrit: boolean
  ): void {
    const e = this.enemies[idx];
    if (!e) return;
    if (e.kind === 'death') {
      spawnBurst(this.particles, e.x - this.camX, e.y - this.camY, '#94A3B8', 5, 90, 2.2);
      if (!isAttract && Math.random() < 0.25) this.showAlert('USE TURBO ATTACK (SHIFT/X) TO BANISH DEATH!');
      return;
    }

    const finalDmg = Math.round(dmg);
    e.hp -= finalDmg;
    e.hitFlash = 0.14;
    if (e.kind !== 'boss') {
      e.vx += kx;
      e.vy += ky;
    }
    this.turbo = Math.min(100, this.turbo + (e.kind === 'boss' ? 4.5 : 3.2) * (1 + this.upgMag * 0.25));

    this.popups.push({
      x: e.x - this.camX + (Math.random() - 0.5) * 14,
      y: e.y - this.camY - 14,
      text: isCrit ? `CRIT -${finalDmg}!` : `-${finalDmg}`,
      color: isCrit ? '#FACC15' : '#FFFFFF',
      life: 0.62,
      maxLife: 0.62,
    });

    if (e.hp <= 0) {
      const wasBoss = e.kind === 'boss';
      this.enemies.splice(idx, 1);
      if (!isAttract) arcadeAudio.playExplosion(wasBoss);
      spawnBurst(
        this.particles,
        e.x - this.camX,
        e.y - this.camY,
        wasBoss ? '#FACC15' : '#EF4444',
        wasBoss ? 44 : 14,
        wasBoss ? 300 : 190,
        wasBoss ? 5 : 3.5
      );
      this.gainXp(e.xpValue);
      const dropGold = wasBoss ? 450 : 25 + Math.floor(Math.random() * 25);
      this.gold += dropGold;
      this.addScore(wasBoss ? 4000 : e.xpValue * 3, e.x, e.y, '#FDE047');

      if (wasBoss) {
        this.bossDefeated = true;
        this.triggerShake(12, 0.45);
        this.showAlert(`${this.getRealm().bossName} VANQUISHED! STEP INTO THE EASTERN PORTAL!`);
        this.pickups.push({ x: e.x - 24, y: e.y, kind: 'chest', value: 300 });
        this.pickups.push({ x: e.x + 24, y: e.y, kind: 'meat', value: 150 });
      }
    }
  }

  private damagePlayer(rawDmg: number, allowKnockback = true): void {
    if (this.phase === 'TITLE' || this.haloTimer > 0) return;
    if (allowKnockback && this.invulnTimer > 0) return;
    const armorMult = Math.max(0.45, 1 - (this.getHero().arm - 1) * 0.08 - this.upgArm * 0.05);
    const actual = rawDmg * armorMult;
    this.hp -= actual;
    if (allowKnockback) {
      this.invulnTimer = 0.42;
      this.triggerShake(5, 0.14);
      arcadeAudio.playSplat();
    }
    if (this.hp <= 0) {
      this.hp = 0;
      arcadeAudio.playDeath();
      this.phase = 'GAME_OVER';
      this.bannerText = `${this.getColor().label} ${this.getHero().name.toUpperCase()} HAS FALLEN`;
    }
  }

  private updateEnemies(dt: number, isAttract: boolean): void {
    const realm = this.getRealm();
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.anim += dt * 9;
      if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);

      // Apply & decay knockback velocity
      if (Math.hypot(e.vx, e.vy) > 5) {
        const kx = e.x + e.vx * dt;
        const ky = e.y + e.vy * dt;
        if (!this.isSolid(kx, e.y, false)) e.x = kx;
        if (!this.isSolid(e.x, ky, false)) e.y = ky;
        e.vx *= Math.max(0, 1 - dt * 8);
        e.vy *= Math.max(0, 1 - dt * 8);
      }

      const dx = this.playerX - e.x;
      const dy = this.playerY - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const aggro = e.kind === 'boss' ? 620 : 540;
      if (dist > aggro) continue;

      const nx = e.x + (dx / dist) * e.speed * dt;
      const ny = e.y + (dy / dist) * e.speed * dt;
      if (!this.isSolid(nx, e.y, false)) e.x = nx;
      if (!this.isSolid(e.x, ny, false)) e.y = ny;

      // Ranged attacks for Imps, Gargoyles & Multi-Phase Realm Bosses!
      if (e.kind === 'imp' || e.kind === 'gargoyle') {
        e.fireTimer -= dt;
        if (e.fireTimer <= 0 && dist < 380) {
          e.fireTimer = 2.3;
          this.projectiles.push({
            x: e.x,
            y: e.y,
            vx: (dx / dist) * 290,
            vy: (dy / dist) * 290,
            fromPlayer: false,
            damage: e.dmg,
            color: e.kind === 'imp' ? '#F97316' : '#C084FC',
            radius: 6,
            life: 1.5,
            pierce: 0,
            explosive: false,
            spin: 0,
          });
        }
      } else if (e.kind === 'boss') {
        e.fireTimer -= dt;
        e.specialTimer -= dt;
        if (e.fireTimer <= 0) {
          e.fireTimer = e.hp < e.maxHp * 0.5 ? 1.15 : 1.65;
          const base = Math.atan2(dy, dx);
          const count = e.hp < e.maxHp * 0.5 ? 5 : 3;
          for (let k = 0; k < count; k++) {
            const a = base + (k - (count - 1) * 0.5) * 0.24;
            this.projectiles.push({
              x: e.x,
              y: e.y,
              vx: Math.cos(a) * 330,
              vy: Math.sin(a) * 330,
              fromPlayer: false,
              damage: e.dmg,
              color: realm.hazardGlow,
              radius: 8,
              life: 1.8,
              pierce: 0,
              explosive: false,
              spin: 0,
            });
          }
        }
        if (e.specialTimer <= 0) {
          e.specialTimer = 4.6;
          // Boss Nova Ring!
          this.shockwaves.push({
            x: e.x,
            y: e.y,
            radius: 20,
            maxRadius: 170,
            color: realm.hazardColor,
            life: 0.45,
            maxLife: 0.45,
          });
          if (!isAttract && dist < 165) {
            this.damagePlayer(e.dmg * 1.15, true);
          }
        }
      }

      if (dist < e.radius + 16 && !isAttract) {
        this.damagePlayer(e.dmg, true);
      }
    }
  }

  private updateProjectiles(dt: number, isAttract: boolean): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.spin += dt * 16;
      const nx = p.x + p.vx * dt;
      const ny = p.y + p.vy * dt;
      if (p.life <= 0 || this.isSolid(nx, ny, false)) {
        spawnBurst(this.particles, p.x - this.camX, p.y - this.camY, p.color, 4, 80, 2);
        this.projectiles.splice(i, 1);
        continue;
      }
      p.x = nx;
      p.y = ny;

      if (p.fromPlayer) {
        let hit = false;
        // Powder Kegs!
        for (let bi = this.barrels.length - 1; bi >= 0; bi--) {
          if (Math.hypot(p.x - this.barrels[bi].x, p.y - this.barrels[bi].y) < 24) {
            this.detonateBarrel(bi, isAttract);
            hit = true;
            break;
          }
        }
        // Spawners
        if (!hit) {
          for (let gi = this.spawners.length - 1; gi >= 0; gi--) {
            const s = this.spawners[gi];
            if (Math.hypot(p.x - s.x, p.y - s.y) < 28) {
              s.hp -= p.damage;
              s.hitFlash = 0.14;
              hit = true;
              if (s.hp <= 0) this.destroySpawner(gi, isAttract);
              break;
            }
          }
        }
        // Enemies
        if (!hit) {
          for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
            const e = this.enemies[ei];
            if (Math.hypot(p.x - e.x, p.y - e.y) < e.radius + p.radius) {
              const spd = Math.hypot(p.vx, p.vy) || 1;
              this.damageEnemy(ei, p.damage, (p.vx / spd) * 140, (p.vy / spd) * 140, isAttract, false);
              if (p.explosive) {
                this.shockwaves.push({
                  x: p.x,
                  y: p.y,
                  radius: 10,
                  maxRadius: 72,
                  color: '#EC4899',
                  life: 0.22,
                  maxLife: 0.22,
                });
              }
              if (p.pierce > 0) {
                p.pierce -= 1;
              } else {
                hit = true;
              }
              break;
            }
          }
        }
        if (hit) this.projectiles.splice(i, 1);
      } else if (Math.hypot(p.x - this.playerX, p.y - this.playerY) < 18 + p.radius) {
        if (!isAttract) this.damagePlayer(p.damage, true);
        this.projectiles.splice(i, 1);
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (this.phase === 'PLAYING' && this.subMode === 'SELECT') {
      this.renderHeroPedestalSelect(ctx);
      if (visualMode === 'crt') renderCrtOverlay(ctx, VIEW_W, VIEW_H);
      return;
    }
    if (this.phase === 'PLAYING' && this.subMode === 'SHOP') {
      this.renderArmoryShop(ctx);
      if (visualMode === 'crt') renderCrtOverlay(ctx, VIEW_W, VIEW_H);
      return;
    }

    const realm = this.getRealm();
    ctx.fillStyle = '#05070E';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const sx = this.shakeTimer > 0 ? (Math.random() - 0.5) * this.shakeMag * 2 : 0;
    const sy = this.shakeTimer > 0 ? (Math.random() - 0.5) * this.shakeMag * 2 : 0;

    ctx.save();
    ctx.translate(-Math.round(this.camX) + sx, -Math.round(this.camY) + sy);

    this.render25DFloor(ctx, realm);

    // Depth-sorted 2.5D Render List (Walls, Pillars, Braziers, Pickups, Barrels, Spawners, Enemies, Player!)
    const drawItems: Array<{ y: number; draw: () => void }> = [];

    const minC = Math.max(0, Math.floor(this.camX / TILE) - 1);
    const maxC = Math.min(MAP_COLS - 1, Math.ceil((this.camX + VIEW_W) / TILE) + 1);
    const minR = Math.max(0, Math.floor(this.camY / TILE) - 1);
    const maxR = Math.min(MAP_ROWS - 1, Math.ceil((this.camY + VIEW_H) / TILE) + 2);

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const cell = this.grid[r][c];
        if (cell === T_WALL || cell === T_DOOR || cell === T_PILLAR || cell === T_BRAZIER) {
          const baseY = (r + 1) * TILE;
          drawItems.push({
            y: baseY,
            draw: () => this.drawExtrudedTile(ctx, c, r, cell, realm),
          });
        }
      }
    }

    for (const pk of this.pickups) {
      drawItems.push({ y: pk.y, draw: () => this.drawPickup(ctx, pk) });
    }
    for (const b of this.barrels) {
      drawItems.push({ y: b.y, draw: () => this.drawBarrel(ctx, b) });
    }
    for (const sp of this.spawners) {
      drawItems.push({ y: sp.y, draw: () => this.drawSpawner(ctx, sp) });
    }
    for (const e of this.enemies) {
      drawItems.push({ y: e.y, draw: () => this.drawEnemy(ctx, e, realm) });
    }
    drawItems.push({
      y: this.playerY,
      draw: () => this.drawDLHero(ctx, this.playerX, this.playerY, Math.atan2(this.aimY, this.aimX), this.getHero(), this.getColor(), 1),
    });

    drawItems.sort((a, b) => a.y - b.y);
    for (const item of drawItems) item.draw();

    // Render Phoenix Familiar if active
    if (this.phoenixTimer > 0) {
      const fx = this.playerX + Math.cos(this.phoenixAngle) * 44;
      const fy = this.playerY + Math.sin(this.phoenixAngle) * 44 - 22;
      ctx.save();
      ctx.translate(fx, fy);
      ctx.shadowColor = '#F97316';
      ctx.shadowBlur = 16;
      const flap = Math.sin(this.time * 18) * 6;
      ctx.fillStyle = '#F97316';
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(14, 2 + flap);
      ctx.lineTo(0, 6);
      ctx.lineTo(-14, 2 + flap);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(0, -2, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Glowing Melee Slash Arcs & Shockwaves
    for (const sl of this.slashes) {
      const a = sl.life / sl.maxLife;
      ctx.save();
      ctx.translate(sl.x, sl.y - 8);
      ctx.strokeStyle = sl.color;
      ctx.globalAlpha = a * 0.9;
      ctx.lineWidth = sl.comboStep === 2 ? 12 : 7;
      ctx.shadowColor = sl.color;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(0, 0, sl.radius * 0.86, sl.angle - 1.15, sl.angle + 1.15);
      ctx.stroke();
      ctx.restore();
    }
    for (const sw of this.shockwaves) {
      const a = sw.life / sw.maxLife;
      ctx.save();
      ctx.globalAlpha = a * 0.85;
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = 6 * a + 2;
      ctx.shadowColor = sw.color;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Projectiles
    for (const p of this.projectiles) {
      ctx.save();
      ctx.translate(p.x, p.y - 10);
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(0, 0, p.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Golden Level-Up Pillar of Light!
    if (this.levelUpFlash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.65, this.levelUpFlash);
      const lg = ctx.createLinearGradient(this.playerX - 38, 0, this.playerX + 38, 0);
      lg.addColorStop(0, 'rgba(250, 204, 21, 0)');
      lg.addColorStop(0.5, 'rgba(254, 240, 138, 0.85)');
      lg.addColorStop(1, 'rgba(250, 204, 21, 0)');
      ctx.fillStyle = lg;
      ctx.fillRect(this.playerX - 38, this.playerY - 260, 76, 270);
      ctx.restore();
    }

    ctx.restore();

    // Realm Atmospheric Glow + Particles
    ctx.fillStyle = realm.ambientGlow;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    renderParticlesAndPopups(ctx, this.particles, this.popups);

    // Rich Dark Legacy Gilded HUD Overlay
    this.renderDarkLegacyHud(ctx, realm);

    if (visualMode === 'crt') renderCrtOverlay(ctx, VIEW_W, VIEW_H);
  }

  private render25DFloor(ctx: CanvasRenderingContext2D, realm: RealmSpec): void {
    const minC = Math.max(0, Math.floor(this.camX / TILE));
    const maxC = Math.min(MAP_COLS - 1, Math.ceil((this.camX + VIEW_W) / TILE));
    const minR = Math.max(0, Math.floor(this.camY / TILE));
    const maxR = Math.min(MAP_ROWS - 1, Math.ceil((this.camY + VIEW_H) / TILE));

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const x = c * TILE;
        const y = r * TILE;
        const cell = this.grid[r][c];
        if (cell === T_HAZARD) {
          ctx.fillStyle = '#09090F';
          ctx.fillRect(x, y, TILE, TILE);
          const pulse = 0.65 + 0.35 * Math.sin(this.time * 5 + c + r);
          ctx.fillStyle = realm.hazardColor;
          ctx.globalAlpha = pulse * 0.85;
          ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
          ctx.globalAlpha = 1;
          ctx.fillStyle = realm.hazardGlow;
          ctx.beginPath();
          ctx.arc(x + 18 + Math.sin(this.time * 3 + r) * 5, y + 22, 4, 0, Math.PI * 2);
          ctx.arc(x + 34, y + 34 + Math.cos(this.time * 4 + c) * 4, 3, 0, Math.PI * 2);
          ctx.fill();
        } else if (cell === T_BRIDGE) {
          ctx.fillStyle = '#573B26';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = '#785438';
          for (let p = 0; p < 4; p++) {
            ctx.fillRect(x + 2, y + 3 + p * 12, TILE - 4, 9);
          }
          ctx.fillStyle = '#FACC15';
          ctx.fillRect(x, y, TILE, 3);
          ctx.fillRect(x, y + TILE - 3, TILE, 3);
        } else {
          ctx.fillStyle = (r + c) % 2 === 0 ? realm.floorA : realm.floorB;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.strokeStyle = 'rgba(0,0,0,0.35)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
          // Cast 2.5D shadow beneath north wall
          if (this.grid[r - 1]?.[c] === T_WALL) {
            const sh = ctx.createLinearGradient(x, y, x, y + 18);
            sh.addColorStop(0, 'rgba(0,0,0,0.58)');
            sh.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = sh;
            ctx.fillRect(x, y, TILE, 18);
          }
        }

        if (cell === T_PORTAL) {
          ctx.save();
          const cx = x + TILE * 0.5;
          const cy = y + TILE * 0.5;
          ctx.shadowColor = this.bossDefeated ? '#4ADE80' : '#EF4444';
          ctx.shadowBlur = 18;
          ctx.strokeStyle = this.bossDefeated ? '#4ADE80' : '#991B1B';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.arc(cx, cy, 20, this.time * 3, this.time * 3 + Math.PI * 1.6);
          ctx.stroke();
          ctx.fillStyle = this.bossDefeated ? 'rgba(74, 222, 128, 0.32)' : 'rgba(127, 29, 29, 0.35)';
          ctx.beginPath();
          ctx.arc(cx, cy, 18, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }
  }

  private drawExtrudedTile(
    ctx: CanvasRenderingContext2D,
    c: number,
    r: number,
    cell: number,
    realm: RealmSpec
  ): void {
    const x = c * TILE;
    const y = r * TILE;

    if (cell === T_WALL) {
      // 2.5D Extruded Front Stone Facade + Raised Rooftop!
      ctx.fillStyle = realm.wallFace;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = realm.wallDark;
      ctx.fillRect(x, y + TILE - 7, TILE, 7);
      // Raised rooftop shifted up by WALL_H!
      ctx.fillStyle = realm.wallTop;
      ctx.fillRect(x, y - WALL_H, TILE, TILE);
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(x + 1, y - WALL_H + 1, TILE - 2, 3);
      ctx.strokeStyle = 'rgba(0,0,0,0.42)';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(x + 0.5, y - WALL_H + 0.5, TILE - 1, TILE - 1);
      // Masonry mortar lines on front facade
      ctx.strokeRect(x + 0.5, y + TILE - WALL_H, TILE - 1, WALL_H);
    } else if (cell === T_DOOR) {
      ctx.fillStyle = '#78350F';
      ctx.fillRect(x, y - WALL_H * 0.7, TILE, TILE + WALL_H * 0.7);
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2.4;
      ctx.strokeRect(x + 4, y - WALL_H * 0.55, TILE - 8, TILE + WALL_H * 0.4);
      ctx.fillStyle = '#FDE047';
      ctx.beginPath();
      ctx.arc(x + TILE * 0.5, y + 8, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (cell === T_PILLAR) {
      const cx = x + TILE * 0.5;
      const cy = y + TILE * 0.5;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.ellipse(cx + 4, cy + 8, 20, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = realm.wallFace;
      ctx.fillRect(cx - 14, cy - 30, 28, 38);
      ctx.fillStyle = realm.wallTop;
      ctx.beginPath();
      ctx.ellipse(cx, cy - 30, 16, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    } else if (cell === T_BRAZIER) {
      const cx = x + TILE * 0.5;
      const cy = y + TILE * 0.5;
      const flick = Math.sin(this.time * 15 + cx) * 3;
      const glow = ctx.createRadialGradient(cx, cy - 16, 4, cx, cy - 16, 95 + flick * 2);
      glow.addColorStop(0, 'rgba(251, 146, 60, 0.36)');
      glow.addColorStop(1, 'rgba(251, 146, 60, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy - 16, 95 + flick * 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#334155';
      ctx.fillRect(cx - 11, cy - 12, 22, 20);
      ctx.fillStyle = '#F97316';
      ctx.beginPath();
      ctx.arc(cx, cy - 16 + flick * 0.3, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(cx, cy - 17, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawPickup(ctx: CanvasRenderingContext2D, p: DLPickup): void {
    ctx.save();
    ctx.translate(p.x, p.y - 6 + Math.sin(this.time * 4.5 + p.x) * 3);
    if (p.kind === 'runestone') {
      ctx.shadowColor = '#38BDF8';
      ctx.shadowBlur = 18;
      // Vertical beacon beam
      const bg = ctx.createLinearGradient(0, -64, 0, 12);
      bg.addColorStop(0, 'rgba(56,189,248,0)');
      bg.addColorStop(1, 'rgba(56,189,248,0.45)');
      ctx.fillStyle = bg;
      ctx.fillRect(-10, -64, 20, 76);
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(13, 0);
      ctx.lineTo(0, 16);
      ctx.lineTo(-13, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#E0F2FE';
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(6, 0);
      ctx.lineTo(0, 8);
      ctx.lineTo(-6, 0);
      ctx.closePath();
      ctx.fill();
    } else if (p.kind === 'gold') {
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(-5, 2, 6, 0, Math.PI * 2);
      ctx.arc(5, 3, 6, 0, Math.PI * 2);
      ctx.arc(0, -3, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'chest') {
      ctx.fillStyle = '#92400E';
      ctx.beginPath();
      ctx.roundRect(-14, -10, 28, 20, 4);
      ctx.fill();
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(-14, -3, 28, 4);
      ctx.fillRect(-4, -5, 8, 9);
    } else if (p.kind === 'meat') {
      ctx.fillStyle = '#CBD5E1';
      ctx.beginPath();
      ctx.ellipse(0, 4, 16, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#B45309';
      ctx.beginPath();
      ctx.ellipse(-2, 0, 12, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FEF3C7';
      ctx.fillRect(9, -2, 8, 4);
    } else if (p.kind === 'key') {
      ctx.shadowColor = '#FACC15';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(-6, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(0, -2, 14, 4);
      ctx.fillRect(8, 2, 3, 5);
    } else {
      const col =
        p.kind === 'relic_3way'
          ? '#38BDF8'
          : p.kind === 'relic_rapid'
            ? '#4ADE80'
            : p.kind === 'relic_halo'
              ? '#FDE047'
              : '#F97316';
      const txt =
        p.kind === 'relic_3way'
          ? '3X'
          : p.kind === 'relic_rapid'
            ? 'RF'
            : p.kind === 'relic_halo'
              ? 'HL'
              : 'PX';
      ctx.shadowColor = col;
      ctx.shadowBlur = 14;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.font = '900 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, 0, 0.5);
    }
    ctx.restore();
  }

  private drawBarrel(ctx: CanvasRenderingContext2D, b: DLBarrel): void {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 8, 15, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#991B1B';
    ctx.beginPath();
    ctx.roundRect(-12, -18, 24, 26, 6);
    ctx.fill();
    ctx.fillStyle = '#475569';
    ctx.fillRect(-12, -13, 24, 3);
    ctx.fillRect(-12, -2, 24, 3);
    ctx.fillStyle = '#FACC15';
    ctx.font = '900 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TNT', 0, -4);
    ctx.restore();
  }

  private drawSpawner(ctx: CanvasRenderingContext2D, s: DLSpawner): void {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 8, 22, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = s.hitFlash > 0 ? '#FFFFFF' : '#451A03';
    ctx.beginPath();
    ctx.roundRect(-19, -24, 38, 32, 7);
    ctx.fill();
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.fillStyle = '#F97316';
    ctx.beginPath();
    ctx.arc(0, -8, 8 + Math.sin(this.time * 7 + s.x) * 2, 0, Math.PI * 2);
    ctx.fill();
    // Spawner HP bar
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(-18, -32, 36, 5);
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(-18, -32, 36 * Math.max(0, s.hp / s.maxHp), 5);
    ctx.restore();
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: DLEnemy, realm: RealmSpec): void {
    ctx.save();
    ctx.translate(e.x, e.y);
    const bob = Math.sin(e.anim) * 2.5;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 10, e.radius, e.radius * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (e.hitFlash > 0) {
      ctx.shadowColor = '#FFFFFF';
      ctx.shadowBlur = 16;
    }

    if (e.kind === 'boss') {
      // Towering 2.5D Realm Boss!
      const wing = Math.sin(this.time * 8) * 11;
      const primary =
        realm.bossKind === 'frost_dragon'
          ? '#0284C7'
          : realm.bossKind === 'lich'
            ? '#7E22CE'
            : realm.bossKind === 'chimera'
              ? '#EA580C'
              : realm.bossKind === 'plague_fiend'
                ? '#4F46E5'
                : '#B91C1C';
      // Huge wings/aura
      ctx.fillStyle = primary;
      ctx.beginPath();
      ctx.moveTo(-18, -12);
      ctx.lineTo(-58, -38 + wing);
      ctx.lineTo(-42, 12 + wing * 0.5);
      ctx.closePath();
      ctx.moveTo(18, -12);
      ctx.lineTo(58, -38 + wing);
      ctx.lineTo(42, 12 + wing * 0.5);
      ctx.closePath();
      ctx.fill();

      // Armored Boss Torso + Crowned Horned Head
      const g = ctx.createRadialGradient(-8, -22, 4, 0, -14, 38);
      g.addColorStop(0, '#FEF08A');
      g.addColorStop(0.35, primary);
      g.addColorStop(1, '#09090F');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(-28, -42 + bob * 0.5, 56, 50, 16);
      ctx.fill();
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2.4;
      ctx.stroke();

      // Glowing Boss Eyes
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(-10, -24 + bob * 0.5, 5, 0, Math.PI * 2);
      ctx.arc(10, -24 + bob * 0.5, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'death') {
      ctx.shadowColor = '#EF4444';
      ctx.shadowBlur = 16;
      ctx.fillStyle = '#090D16';
      ctx.beginPath();
      ctx.roundRect(-14, -26, 28, 34, 12);
      ctx.fill();
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(-6, -16, 4, 4);
      ctx.fillRect(2, -16, 4, 4);
    } else {
      const colMap: Record<string, string> = {
        orc: '#65A30D',
        skeleton: '#E2E8F0',
        golem: '#64748B',
        gargoyle: '#7C3AED',
        imp: '#EA580C',
        dark_knight: '#334155',
        hellhound: '#DC2626',
      };
      ctx.fillStyle = e.hitFlash > 0 ? '#FFFFFF' : colMap[e.kind] ?? '#EF4444';
      ctx.beginPath();
      ctx.roundRect(-e.radius * 0.85, -e.radius * 1.4 + bob * 0.5, e.radius * 1.7, e.radius * 1.85, 8);
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(-5, -e.radius * 0.9 + bob * 0.5, 3.5, 3.5);
      ctx.fillRect(2, -e.radius * 0.9 + bob * 0.5, 3.5, 3.5);
      if (e.hp < e.maxHp) {
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-15, -e.radius * 1.85, 30, 4);
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(-15, -e.radius * 1.85, 30 * Math.max(0, e.hp / e.maxHp), 4);
      }
    }
    ctx.restore();
  }

  private drawDLHero(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number,
    hero: DLHeroClass,
    col: DLColorSpec,
    scale = 1
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Invulnerability Halo ring!
    if (this.haloTimer > 0 && scale === 1) {
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 6, 26, 14, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(0, 10, 17, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2.5D Standing Hero Body with flowing cape, broad armor & class headgear
    const stride = Math.sin(this.walkAnim) * 2.5;
    ctx.fillStyle = col.dark;
    ctx.beginPath();
    ctx.roundRect(-13, -18 + stride * 0.3, 26, 26, 8);
    ctx.fill();

    // Chest cuirass / tunic in RED / BLUE / YELLOW / GREEN
    ctx.fillStyle = col.primary;
    ctx.beginPath();
    ctx.roundRect(-11, -20 + stride * 0.3, 22, 22, 7);
    ctx.fill();
    ctx.strokeStyle = col.trim;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Head & Class Signature Crest
    ctx.fillStyle = '#FDE68A';
    ctx.beginPath();
    ctx.arc(0, -24 + stride * 0.25, 8.5, 0, Math.PI * 2);
    ctx.fill();

    if (hero.id === 'knight' || hero.id === 'dwarf') {
      ctx.fillStyle = '#CBD5E1';
      ctx.beginPath();
      ctx.arc(0, -26 + stride * 0.25, 9, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = col.primary;
      ctx.fillRect(-2.5, -36, 5, 9);
    } else if (hero.id === 'wizard' || hero.id === 'sorceress') {
      ctx.fillStyle = col.primary;
      ctx.beginPath();
      ctx.moveTo(-11, -26);
      ctx.lineTo(0, -44);
      ctx.lineTo(11, -26);
      ctx.closePath();
      ctx.fill();
    } else if (hero.id === 'jester') {
      ctx.fillStyle = col.primary;
      ctx.beginPath();
      ctx.moveTo(-12, -26);
      ctx.lineTo(-14, -38);
      ctx.lineTo(0, -28);
      ctx.lineTo(14, -38);
      ctx.lineTo(12, -26);
      ctx.closePath();
      ctx.fill();
    } else if (hero.id === 'minotaur' || hero.id === 'valkyrie') {
      ctx.fillStyle = '#FEF3C7';
      ctx.beginPath();
      ctx.moveTo(-8, -28);
      ctx.lineTo(-16, -38);
      ctx.lineTo(-4, -30);
      ctx.moveTo(8, -28);
      ctx.lineTo(16, -38);
      ctx.lineTo(4, -30);
      ctx.fill();
    } else {
      // Archer hood
      ctx.fillStyle = col.dark;
      ctx.beginPath();
      ctx.arc(0, -26, 9.5, Math.PI * 0.9, Math.PI * 2.1);
      ctx.fill();
    }

    // Aimed Weapon indicator pointing toward target
    const wx = Math.cos(angle) * 20;
    const wy = Math.sin(angle) * 20 - 12;
    ctx.strokeStyle = '#F8FAFC';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * 6, Math.sin(angle) * 6 - 12);
    ctx.lineTo(wx, wy);
    ctx.stroke();
    ctx.fillStyle = hero.turboColor;
    ctx.beginPath();
    ctx.arc(wx, wy, 4.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private renderDarkLegacyHud(ctx: CanvasRenderingContext2D, realm: RealmSpec): void {
    const hero = this.getHero();
    const col = this.getColor();

    // Top-Left Gilded Dark Legacy Hero Panel
    ctx.fillStyle = 'rgba(6, 9, 18, 0.88)';
    ctx.beginPath();
    ctx.roundRect(16, 14, 354, 114, 12);
    ctx.fill();
    ctx.strokeStyle = col.primary;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = col.light;
    ctx.font = '900 13px "JetBrains Mono", monospace';
    ctx.fillText(`${col.label} ${hero.name.toUpperCase()} · LV.${this.heroLevel} ${this.getRankTitle()}`, 30, 36);

    // Health Bar
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.roundRect(30, 44, 240, 16, 4);
    ctx.fill();
    ctx.fillStyle = this.hp < this.maxHp * 0.3 ? '#EF4444' : '#22C55E';
    ctx.beginPath();
    ctx.roundRect(30, 44, 240 * Math.max(0, this.hp / this.maxHp), 16, 4);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 11px "JetBrains Mono", monospace';
    ctx.fillText(`HP ${Math.ceil(this.hp)}/${this.maxHp}`, 278, 56);

    // Turbo Bar (Glows when >= 40% Ready!)
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.roundRect(30, 66, 240, 14, 4);
    ctx.fill();
    ctx.fillStyle = this.turbo >= 40 ? hero.turboColor : '#475569';
    ctx.beginPath();
    ctx.roundRect(30, 66, 240 * (this.turbo / 100), 14, 4);
    ctx.fill();
    ctx.fillStyle = this.turbo >= 40 ? '#FEF08A' : '#94A3B8';
    ctx.font = '800 10px "JetBrains Mono", monospace';
    ctx.fillText(this.turbo >= 40 ? 'TURBO READY!' : `TURBO ${Math.floor(this.turbo)}%`, 278, 77);

    // XP Strip + Gold / Keys / Runestones
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(30, 86, 326, 6);
    ctx.fillStyle = '#FACC15';
    ctx.fillRect(30, 86, 326 * Math.min(1, this.xp / this.nextXp), 6);

    ctx.fillStyle = '#FDE047';
    ctx.font = '800 12px "JetBrains Mono", monospace';
    ctx.fillText(`GOLD ${this.gold}   KEYS ${this.keys}   RUNES ${this.runestonesCollected}/2`, 30, 114);

    // Active Relic Timers
    const activeRelics: Array<[string, string]> = [];
    if (this.threeWayTimer > 0) activeRelics.push([`3-WAY ${Math.ceil(this.threeWayTimer)}s`, '#38BDF8']);
    if (this.rapidFireTimer > 0) activeRelics.push([`RAPID ${Math.ceil(this.rapidFireTimer)}s`, '#4ADE80']);
    if (this.phoenixTimer > 0) activeRelics.push([`PHOENIX ${Math.ceil(this.phoenixTimer)}s`, '#F97316']);
    if (this.haloTimer > 0) activeRelics.push([`HALO ${Math.ceil(this.haloTimer)}s`, '#FEF08A']);
    activeRelics.forEach(([txt, color], i) => {
      const rx = 18 + i * 114;
      ctx.fillStyle = 'rgba(8, 12, 24, 0.85)';
      ctx.beginPath();
      ctx.roundRect(rx, 136, 108, 24, 6);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = '800 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(txt, rx + 54, 152);
    });

    // Top-Right Realm Banner & Mini-Radar
    const mapW = 180;
    const mapH = 130;
    const mx = VIEW_W - mapW - 18;
    const my = 16;
    ctx.fillStyle = 'rgba(6, 9, 18, 0.84)';
    ctx.beginPath();
    ctx.roundRect(mx - 6, my - 4, mapW + 12, mapH + 34, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#E2E8F0';
    ctx.font = '800 11px "JetBrains Mono", monospace';
    ctx.fillText(realm.name.toUpperCase(), mx + mapW * 0.5, my + 12);

    const cw = mapW / MAP_COLS;
    const ch = mapH / MAP_ROWS;
    const rmy = my + 20;
    for (let r = 0; r < MAP_ROWS; r++) {
      for (let c = 0; c < MAP_COLS; c++) {
        const t = this.grid[r][c];
        if (t === T_WALL) {
          ctx.fillStyle = '#334155';
          ctx.fillRect(mx + c * cw, rmy + r * ch, cw, ch);
        } else if (t === T_PORTAL) {
          ctx.fillStyle = this.bossDefeated ? '#4ADE80' : '#EF4444';
          ctx.fillRect(mx + c * cw, rmy + r * ch, cw * 1.4, ch * 1.4);
        }
      }
    }
    // Runestones & Boss on radar
    for (const pk of this.pickups) {
      if (pk.kind === 'runestone') {
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(mx + (pk.x / TILE) * cw - 2, rmy + (pk.y / TILE) * ch - 2, 4, 4);
      }
    }
    const boss = this.enemies.find((e) => e.kind === 'boss');
    if (boss) {
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(mx + (boss.x / TILE) * cw, rmy + (boss.y / TILE) * ch, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = col.primary;
    ctx.beginPath();
    ctx.arc(mx + (this.playerX / TILE) * cw, rmy + (this.playerY / TILE) * ch, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Bottom Boss Health Bar when Boss is alive!
    if (boss && this.phase === 'PLAYING') {
      const bw = 520;
      const bx = (VIEW_W - bw) * 0.5;
      const by = VIEW_H - 52;
      ctx.fillStyle = 'rgba(6, 9, 18, 0.9)';
      ctx.beginPath();
      ctx.roundRect(bx - 12, by - 20, bw + 24, 54, 10);
      ctx.fill();
      ctx.strokeStyle = realm.hazardColor;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillStyle = realm.hazardGlow;
      ctx.font = '900 13px "JetBrains Mono", monospace';
      ctx.fillText(realm.bossName, VIEW_W * 0.5, by - 3);
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(bx, by + 8, bw, 14);
      ctx.fillStyle = realm.hazardColor;
      ctx.fillRect(bx, by + 8, bw * Math.max(0, boss.hp / boss.maxHp), 14);
    }

    if (this.alertText && this.phase === 'PLAYING') {
      ctx.fillStyle = 'rgba(6, 9, 18, 0.9)';
      ctx.beginPath();
      ctx.roundRect(VIEW_W * 0.5 - 260, 18, 520, 36, 8);
      ctx.fill();
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FEF08A';
      ctx.font = '800 13px "JetBrains Mono", monospace';
      ctx.fillText(this.alertText, VIEW_W * 0.5, 41);
    }

    if (this.bannerText && (this.phase === 'READY' || this.phase === 'STAGE_CLEAR')) {
      ctx.fillStyle = 'rgba(5, 8, 18, 0.92)';
      ctx.beginPath();
      ctx.roundRect(VIEW_W * 0.14, VIEW_H * 0.42, VIEW_W * 0.72, 76, 14);
      ctx.fill();
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2.6;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FEF08A';
      ctx.font = '900 26px "Outfit", sans-serif';
      ctx.fillText(this.bannerText, VIEW_W * 0.5, VIEW_H * 0.42 + 46);
    }
  }

  private renderHeroPedestalSelect(ctx: CanvasRenderingContext2D): void {
    const bg = ctx.createRadialGradient(VIEW_W * 0.5, VIEW_H * 0.35, 80, VIEW_W * 0.5, VIEW_H * 0.5, VIEW_W * 0.72);
    bg.addColorStop(0, '#1E1133');
    bg.addColorStop(1, '#05070E');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#FACC15';
    ctx.font = '900 40px "Outfit", sans-serif';
    ctx.fillText('GAUNTLET: DARK LEGACY · SUMNER’S TOWER', VIEW_W * 0.5, 68);
    ctx.fillStyle = '#CBD5E1';
    ctx.font = '600 14px "JetBrains Mono", monospace';
    ctx.fillText(
      'CHOOSE FROM 8 HEROES (LEFT/RIGHT) & 4 COLORS (UP/DOWN: RED · BLUE · YELLOW · GREEN) · SPACE OR CLICK',
      VIEW_W * 0.5,
      104
    );

    const cw = 266;
    const ch = 205;
    const gapX = 20;
    const gapY = 18;
    const sx = (VIEW_W - (cw * 4 + gapX * 3)) * 0.5;
    const sy = 148;

    DL_CLASSES.forEach((h, i) => {
      const selected = i === this.classIdx;
      const col = selected ? this.getColor() : DL_COLORS[h.defaultColorIdx];
      const cx = sx + (i % 4) * (cw + gapX);
      const cy = sy + Math.floor(i / 4) * (ch + gapY);

      ctx.save();
      ctx.fillStyle = selected ? 'rgba(255,255,255,0.1)' : 'rgba(12,18,34,0.8)';
      ctx.beginPath();
      ctx.roundRect(cx, cy, cw, ch, 14);
      ctx.fill();
      ctx.strokeStyle = selected ? col.primary : 'rgba(255,255,255,0.12)';
      ctx.lineWidth = selected ? 3.2 : 1.4;
      if (selected) {
        ctx.shadowColor = col.primary;
        ctx.shadowBlur = 20;
      }
      ctx.stroke();
      ctx.restore();

      // Standing 2.5D hero pedestal portrait
      this.drawDLHero(ctx, cx + 56, cy + 106, selected ? Math.sin(this.time * 3) * 0.5 : 0.2, h, col, 1.38);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 22px "Outfit", sans-serif';
      ctx.fillText(h.name.toUpperCase(), cx + 102, cy + 44);
      ctx.fillStyle = col.light;
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.fillText(h.weapon, cx + 102, cy + 64);
      ctx.fillStyle = h.turboColor;
      ctx.fillText(`⚡ ${h.turboName}`, cx + 102, cy + 82);

      const bars: Array<[string, number]> = [
        ['STR', h.str],
        ['SPD', h.spd],
        ['ARM', h.arm],
        ['MAG', h.mag],
      ];
      bars.forEach(([lbl, val], bi) => {
        const by = cy + 112 + bi * 22;
        ctx.fillStyle = '#94A3B8';
        ctx.font = '700 10px "JetBrains Mono", monospace';
        ctx.fillText(lbl, cx + 102, by);
        for (let k = 0; k < 5; k++) {
          ctx.fillStyle = k < val ? col.primary : 'rgba(255,255,255,0.1)';
          ctx.fillRect(cx + 136 + k * 22, by - 9, 17, 10);
        }
      });
    });

    // 4 Color Selection Gems (RED / BLUE / YELLOW / GREEN)
    const bw = 148;
    const bgap = 18;
    const bsx = (VIEW_W - (bw * 4 + bgap * 3)) * 0.5;
    DL_COLORS.forEach((c, ci) => {
      const on = ci === this.colorIdx;
      const bx = bsx + ci * (bw + bgap);
      ctx.fillStyle = on ? c.primary : 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      ctx.roundRect(bx, 598, bw, 46, 10);
      ctx.fill();
      ctx.strokeStyle = c.primary;
      ctx.lineWidth = on ? 2.6 : 1.2;
      ctx.stroke();
      ctx.fillStyle = on && c.id === 'yellow' ? '#0F172A' : '#FFFFFF';
      ctx.font = '900 14px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${c.label} HERO`, bx + bw * 0.5, 626);
    });

    // Enter Realm CTA
    const activeCol = this.getColor();
    ctx.fillStyle = activeCol.primary;
    ctx.beginPath();
    ctx.roundRect(VIEW_W * 0.5 - 220, 676, 440, 58, 12);
    ctx.fill();
    ctx.fillStyle = activeCol.id === 'yellow' ? '#0F172A' : '#FFFFFF';
    ctx.font = '900 20px "Outfit", sans-serif';
    ctx.fillText(`ENTER REALM AS ${activeCol.label} ${this.getHero().name.toUpperCase()}`, VIEW_W * 0.5, 712);
  }

  private renderArmoryShop(ctx: CanvasRenderingContext2D): void {
    const bg = ctx.createRadialGradient(VIEW_W * 0.5, VIEW_H * 0.4, 80, VIEW_W * 0.5, VIEW_H * 0.5, VIEW_W * 0.72);
    bg.addColorStop(0, '#27170C');
    bg.addColorStop(1, '#060811');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#FACC15';
    ctx.font = '900 38px "Outfit", sans-serif';
    ctx.fillText('SUMNER’S TOWER · ARMORY & RELIC SHOP', VIEW_W * 0.5, 78);

    ctx.fillStyle = '#FEF08A';
    ctx.font = '900 22px "JetBrains Mono", monospace';
    ctx.fillText(`TREASURY: ${this.gold} GOLD   ·   NEXT REALM: ${this.getRealm().name.toUpperCase()}`, VIEW_W * 0.5, 124);

    if (this.alertText) {
      ctx.fillStyle = '#4ADE80';
      ctx.font = '800 15px "JetBrains Mono", monospace';
      ctx.fillText(this.alertText, VIEW_W * 0.5, 166);
    }

    const cw = 212;
    const ch = 264;
    const gap = 18;
    const sx = (VIEW_W - (cw * 5 + gap * 4)) * 0.5;
    SHOP_OPTIONS.forEach((opt, i) => {
      const sel = this.shopCursor === i;
      const canBuy = this.gold >= opt.cost;
      const cx = sx + i * (cw + gap);
      const cy = 240;

      ctx.fillStyle = sel ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.78)';
      ctx.beginPath();
      ctx.roundRect(cx, cy, cw, ch, 14);
      ctx.fill();
      ctx.strokeStyle = sel ? opt.color : 'rgba(255,255,255,0.12)';
      ctx.lineWidth = sel ? 3 : 1.4;
      ctx.stroke();

      ctx.fillStyle = opt.color;
      ctx.beginPath();
      ctx.arc(cx + cw * 0.5, cy + 56, 26, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 16px "Outfit", sans-serif';
      ctx.fillText(opt.name, cx + cw * 0.5, cy + 124);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '600 12px "JetBrains Mono", monospace';
      ctx.fillText(opt.desc, cx + cw * 0.5, cy + 158);

      ctx.fillStyle = canBuy ? '#FACC15' : '#64748B';
      ctx.font = '900 20px "JetBrains Mono", monospace';
      ctx.fillText(`${opt.cost} GOLD`, cx + cw * 0.5, cy + 228);
    });

    const readySel = this.shopCursor === SHOP_OPTIONS.length;
    ctx.fillStyle = readySel ? '#22C55E' : '#16A34A';
    ctx.beginPath();
    ctx.roundRect(VIEW_W * 0.5 - 210, 594, 420, 62, 12);
    ctx.fill();
    if (readySel) {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.fillStyle = '#052E16';
    ctx.font = '900 20px "Outfit", sans-serif';
    ctx.fillText(`ENTER ${this.getRealm().name.toUpperCase()} (SHIFT / CLICK)`, VIEW_W * 0.5, 632);
  }
}

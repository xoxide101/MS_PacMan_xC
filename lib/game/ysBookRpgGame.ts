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
  saveHighScore,
  spawnBurst,
  stepParticlesAndPopups,
} from './classicArcadeInterface';
import { arcadeMusic } from './musicEngine';
import { ysAcousticSfx } from './ysAcousticSfx';
import {
  ForageItemId,
  PortraitId,
  WorldChest,
  WorldCraftStation,
  WorldForageNode,
  WorldInspectable,
  WorldNpc,
  WorldShrub,
  WorldTile,
  YsBookVariant,
  ZoneDef,
  ZonePortal,
  createYs1World,
  createYs2World,
} from './ysWorldBuilder';
import {
  Dir4,
  YsPixelAtlas,
  getYsPixelAtlas,
  themeToWallKind,
} from './ysPixelAtlas';
import {
  YsCameraZoomMode,
  YsThreeNpcRuntimeView,
  YsThreeWorldRenderer,
  YsWeatherKind,
} from './ysThreeWorldRenderer';

export type { YsBookVariant } from './ysWorldBuilder';

const sfx = {
  playCoin: () => ysAcousticSfx.playHarpChime(),
  playShoot: () => ysAcousticSfx.playAiryCast(),
  playPellet: () => ysAcousticSfx.playSoftTap(),
  playPowerup: () => ysAcousticSfx.playDiscoveryBloom(),
  playBounce: () => ysAcousticSfx.playWoodKnock(),
  playEnemyHit: () => ysAcousticSfx.playTactileHit(),
  playExplosion: () => ysAcousticSfx.playResonantBloom(),
  playStageClear: () => ysAcousticSfx.playPianoVictory(),
  playGameOver: () => ysAcousticSfx.playPianoRetreat(),
  playThunder: () => ysAcousticSfx.playDistantThunder(),
};

// ============================================================================
// YS BOOK I & II (TurboGrafx-16 CD / PC Engine CD Evo Edition)
// 4x-Scale 2.5D Full-World 4-Way Scrolling Action RPG:
// - Walk-behind 2.5D tree canopies & sloped roofs (true perspective occlusion!)
// - Spring-physics rustling shrubs you can jump into & investigate
// - Rich inspectable shrines, statues, fountains, crates, signs & multi-step quests
// - 3D-feel continuously rotating directional Evo characters (Adol, NPCs, Bosses)
// - Seamless multi-tile wide map portals with safe inner spawns & cooldown
// ============================================================================

interface WorldEnemy {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  kind: 'slime' | 'goblin' | 'knight' | 'mage' | 'wyvern' | 'boss';
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  exp: number;
  gold: number;
  speed: number;
  color: string;
  accent: string;
  aiTimer: number;
  hitFlash: number;
  knockVx: number;
  knockVy: number;
  bossId?: string;
  bossPattern?: number;
  bossPhaseTimer?: number;
}

interface MagicProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fromPlayer: boolean;
  damage: number;
  color: string;
  radius: number;
  life: number;
}

interface CombatSparkBolt {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  life: number;
  maxLife: number;
  seed: number;
}

interface ImpactFlash {
  x: number;
  y: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
}

interface ArmorGib {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rot: number;
  vrot: number;
  w: number;
  h: number;
  color: string;
  rim: string;
  life: number;
  maxLife: number;
}

type MenuShopKind = 'weapon' | 'armor' | 'inn' | 'bakery' | 'forge' | 'alchemy' | 'cooking' | 'satchel';

interface DialogueOverlay {
  speaker: string;
  portrait: PortraitId;
  lines: string[];
  shopKind?: MenuShopKind;
  cursor: number;
  speakerNpc?: WorldNpc;
  focusPos?: { x: number; y: number };
}

interface ShopOption {
  label: string;
  cost: number;
  desc: string;
  action: () => string;
}

interface InteractTarget {
  kind: 'npc' | 'inspect' | 'shrub' | 'chest' | 'forage' | 'station';
  x: number;
  y: number;
  label: string;
  npc?: WorldNpc;
  inspectable?: WorldInspectable;
  shrub?: WorldShrub;
  chest?: WorldChest;
  forage?: WorldForageNode;
  station?: WorldCraftStation;
}

const FORAGE_META: Record<
  ForageItemId,
  { name: string; short: string; color: string; category: 'herb' | 'food' | 'ore' | 'wood' | 'relic' }
> = {
  sunleaf_herb: { name: 'Sunleaf Herb', short: 'Sunleaf', color: '#4ade80', category: 'herb' },
  moonblossom: { name: 'Moonblossom', short: 'Blossom', color: '#c084fc', category: 'herb' },
  celceta_mint: { name: 'Celceta Mint', short: 'Mint', color: '#2dd4bf', category: 'herb' },
  wild_berries: { name: 'Wild Berries', short: 'Berries', color: '#f43f5e', category: 'food' },
  chanterelle: { name: 'Golden Chanterelle', short: 'Mushroom', color: '#fb923c', category: 'food' },
  orchard_apple: { name: 'Orchard Apple', short: 'Apple', color: '#ef4444', category: 'food' },
  honeycomb: { name: 'Wild Honeycomb', short: 'Honey', color: '#facc15', category: 'food' },
  iron_ore: { name: 'Iron Ore', short: 'Iron', color: '#cbd5e1', category: 'ore' },
  silver_ore: { name: 'Silver Ore', short: 'Silver', color: '#38bdf8', category: 'ore' },
  obsidian_shard: { name: 'Obsidian Shard', short: 'Obsidian', color: '#a855f7', category: 'ore' },
  oak_timber: { name: 'Seasoned Oak', short: 'Timber', color: '#d97706', category: 'wood' },
  ancient_gear: { name: 'Ancient Gear', short: 'Gear', color: '#fde047', category: 'relic' },
};

function createStarterForageBag(): Record<ForageItemId, number> {
  return {
    sunleaf_herb: 1,
    moonblossom: 0,
    celceta_mint: 0,
    wild_berries: 1,
    chanterelle: 0,
    orchard_apple: 0,
    honeycomb: 0,
    iron_ore: 0,
    silver_ore: 0,
    obsidian_shard: 0,
    oak_timber: 0,
    ancient_gear: 0,
  };
}

const TILE = 44;
// Authentic 2.5D Front-Angled Oblique Perspective (~44° pitch):
// Ground plane foreshortens cleanly to 32px rows while cliffs, cottages, trees & heroes rise tall!
const TILT = 32 / 44;
const TILE_H = 32;

function angleToDir4(a: number): Dir4 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  if (Math.abs(c) > Math.abs(s) * 1.15) return c >= 0 ? 'right' : 'left';
  return s < 0 ? 'up' : 'down';
}

function normalizeAngle(a: number): number {
  let out = a;
  while (out > Math.PI) out -= Math.PI * 2;
  while (out < -Math.PI) out += Math.PI * 2;
  return out;
}

function lerpAngle(current: number, target: number, t: number): number {
  const diff = normalizeAngle(target - current);
  return current + diff * Math.min(1, t);
}

export class YsBookRpgGame implements ArcadeGameInstance {
  public readonly logicalWidth = 920;
  public readonly logicalHeight = 640;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'Investigate / Dash';
  public readonly secondaryActionLabel = 'Magic / Map';

  private readonly variant: YsBookVariant;
  private readonly highScoreKey: string;

  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();
  private time = 0;
  private phaseTimer = 0;
  private score = 0;
  private highScore = 0;

  // RPG Hero (Adol Christin) Stats & 3D Directional Kinematics
  private px = 0;
  private py = 0;
  private facingX = 0;
  private facingY = 1;
  private bodyAngle = Math.PI * 0.5; // Continuous smooth 3D body yaw (radians)
  private moveSpeedFrac = 0;
  private walkAnim = 0;
  private footstepTimer = 0;
  private standStillTimer = 0;
  private invulnTimer = 0;
  private lungeTimer = 0;
  private lungeCd = 0;
  private slashArcTimer = 0;
  private inShrubId: string | null = null;
  private occludedByCanopy = false;

  // Portal transition stability (fixes map-bounce bug completely!)
  private portalCooldown = 0;
  private zoneFade = 0;
  private activeMusicTrackId = '';

  private level = 1;
  private exp = 0;
  private expNext = 45;
  private hp = 68;
  private maxHp = 68;
  private mp = 40;
  private maxMp = 40;
  private gold = 220;
  private herbs = 2;

  private weaponTier = 0;
  private armorTier = 0;
  private shieldTier = 0;
  private equippedRing: 'none' | 'power' | 'shield' | 'time' = 'none';
  private booksCollected = 0;
  private totalBooks = 6;
  private secretsFound = 0;
  private unlockedMagic = new Set<'fire' | 'shield' | 'time'>();
  private shieldAuraTimer = 0;
  private timeFreezeTimer = 0;
  private magicCd = 0;
  private autoHealPulse = 0;

  // Scavenging Satchel & Forge / Alchemy / Cooking Crafting Progression
  private forageBag: Record<ForageItemId, number> = createStarterForageBag();
  private craftedItems = { salve: 0, elixir: 0, tonic: 0, stew: 0, pie: 0 };
  private forgedAtkBonus = 0;
  private forgedDefBonus = 0;
  private forgedRelics = new Set<string>();
  private speedBuffTimer = 0;
  private totalForaged = 0;
  private totalCrafted = 0;

  private flags = new Set<string>();
  private openedChests = new Set<string>();
  private npcAngles = new Map<string, number>();
  private npcStates = new Map<
    string,
    YsThreeNpcRuntimeView & {
      wpIdx: number;
      waitTimer: number;
      fxCooldown: number;
      behaviorTimer: number;
      behaviorCooldown: number;
      springVelY: number;
      chatPartnerId?: string;
    }
  >();

  // World, Pixel Atlas & Camera
  private zones: Record<string, ZoneDef> = {};
  private currentZoneId = '';
  private camX = 0;
  private camY = 0;
  private enemies: WorldEnemy[] = [];
  private projectiles: MagicProjectile[] = [];
  private nextEnemyId = 1;
  private activeBoss: WorldEnemy | null = null;
  private engagedEnemy: { name: string; hp: number; maxHp: number; timer: number } | null = null;
  private showFullMap = false;
  private nearestInteract: InteractTarget | null = null;
  private atlas: YsPixelAtlas | null = null;
  private threeRenderer: YsThreeWorldRenderer | null = null;
  private threeInitFailed = false;
  private cameraStep90 = 0; // 0=N (45° normal), 1=W (135°), 2=S (225°), 3=E (315°)
  private cameraYaw = Math.PI * 0.25; // True 45° Isometric 2.5D Evo Angle!
  private targetCameraYaw = Math.PI * 0.25;
  private cameraZoomMode: YsCameraZoomMode = 'evo45';
  private cameraZoomScale = 1.0;
  private prevPointerActive = false;
  private cameraKeyHandler: ((e: KeyboardEvent) => void) | null = null;
  private cameraWheelHandler: ((e: WheelEvent) => void) | null = null;

  // Dynamic Calendar (Days of Week), Circadian Time-of-Day, Weather & Directional Wind Engine
  private dayOfWeek = 1; // 0=SUN, 1=MON, ..., 6=SAT
  private dayNumber = 1;
  private timeOfDayHours = 9.5; // Starts crisp at 09:30 AM Monday
  private weather: YsWeatherKind = 'clear';
  private weatherTimer = 78;
  private lightningFlash = 0;
  private lightningTimer = 6.5;
  private windCompassDeg = 60; // 0°=N (up-screen in 45° normal view), 90°=E, 180°=S, 270°=W
  private targetWindCompassDeg = 60;
  private windShiftTimer = 34;

  // PC Engine CD / Chronicles+ Dialogue & Combat VFX
  private dialogue: DialogueOverlay | null = null;
  private navRepeatCd = 0;
  private zoneBannerText = '';
  private zoneBannerTimer = 0;
  private screenShake = 0;
  private hitStopTimer = 0;

  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];
  private combatBolts: CombatSparkBolt[] = [];
  private impactFlashes: ImpactFlash[] = [];
  private armorGibs: ArmorGib[] = [];

  private readonly WEAPONS = [
    { name: 'Short Sword', atk: 12, cost: 0 },
    { name: 'Long Sword', atk: 20, cost: 220 },
    { name: 'Talwar Blade', atk: 30, cost: 480 },
    { name: 'Silver Sword', atk: 44, cost: 900 },
    { name: 'Cleria Flameblade', atk: 58, cost: 1450 },
  ];

  private readonly ARMORS = [
    { name: 'Chain Mail', def: 6, cost: 0 },
    { name: 'Plate Mail', def: 13, cost: 200 },
    { name: 'Reflex Armor', def: 22, cost: 460 },
    { name: 'Silver Armor', def: 34, cost: 850 },
    { name: 'Battle Armor', def: 46, cost: 1380 },
  ];

  private readonly SHIELDS = [
    { name: 'Small Shield', def: 4, cost: 0 },
    { name: 'Large Shield', def: 10, cost: 180 },
    { name: 'Silver Shield', def: 20, cost: 520 },
    { name: 'Battle Shield', def: 30, cost: 980 },
  ];

  constructor(variant: YsBookVariant) {
    this.variant = variant;
    this.highScoreKey = `arcade_${variant}_tgcd_high_v3`;
    this.highScore = readHighScore(this.highScoreKey);
    this.zones = variant === 'ys1' ? createYs1World() : createYs2World();
    this.resetHeroState();
    this.enterZone(variant === 'ys1' ? 'minea' : 'lance', variant === 'ys1' ? 52 : 48, variant === 'ys1' ? 40 : 36, false);
    this.phase = 'TITLE';

    if (typeof window !== 'undefined') {
      this.cameraKeyHandler = (e: KeyboardEvent) => {
        const k = e.key.toLowerCase();
        if (k === 'c' && this.phase === 'PLAYING') {
          if (this.dialogue?.shopKind === 'satchel') {
            this.dialogue = null;
            sfx.playPellet();
          } else if (!this.dialogue && !this.showFullMap) {
            this.openSatchelMenu();
            sfx.playPellet();
          }
          return;
        }
        if (k === 'escape' && this.dialogue) {
          this.dialogue = null;
          sfx.playPellet();
          return;
        }
        if (this.dialogue) return;
        if (k === 'v') {
          this.cycleCameraZoomMode();
        } else if (k === 'q') {
          this.rotateCamera90(-1); // Crisp -90° rotation from 45° isometric!
        } else if (k === 'e') {
          this.rotateCamera90(1); // Crisp +90° rotation from 45° isometric!
        } else if (k === 't') {
          this.advanceTimeOfDay(3);
        } else if (k === 'g') {
          this.cycleWeather();
        } else if (k === 'b') {
          this.shiftWindDirection(45);
        } else if (k === '=' || k === '+') {
          this.cameraZoomScale = Math.max(0.48, +(this.cameraZoomScale - 0.14).toFixed(2));
          this.zoneBannerText = `ZOOM · ${Math.round((1 / this.cameraZoomScale) * 100)}%`;
          this.zoneBannerTimer = 1.1;
        } else if (k === '-' || k === '_') {
          this.cameraZoomScale = Math.min(1.85, +(this.cameraZoomScale + 0.14).toFixed(2));
          this.zoneBannerText = `ZOOM · ${Math.round((1 / this.cameraZoomScale) * 100)}%`;
          this.zoneBannerTimer = 1.1;
        } else if (k === 'r') {
          this.cameraStep90 = 0;
          this.targetCameraYaw = Math.PI * 0.25; // Snap back to North-facing 45° normal isometric view
          this.cameraZoomScale = 1.0;
          this.zoneBannerText = 'CAMERA · N (45° NORMAL VIEW)';
          this.zoneBannerTimer = 1.6;
        }
      };
      this.cameraWheelHandler = (e: WheelEvent) => {
        if (this.phase !== 'PLAYING' || this.dialogue) return;
        const target = e.target as HTMLElement | null;
        if (!target || target.tagName !== 'CANVAS') return;
        e.preventDefault();
        const step = Math.sign(e.deltaY) * 0.09;
        this.cameraZoomScale = Math.max(0.48, Math.min(1.85, +(this.cameraZoomScale + step).toFixed(3)));
      };
      window.addEventListener('keydown', this.cameraKeyHandler);
      window.addEventListener('wheel', this.cameraWheelHandler, { passive: false });
    }
  }

  private rotateCamera90(deltaStep: number): void {
    this.cameraStep90 += deltaStep;
    this.targetCameraYaw = Math.PI * 0.25 + this.cameraStep90 * (Math.PI * 0.5);
    const compass = this.getCameraCompassInfo();
    this.zoneBannerText = `FACING ${compass.dir} · ${compass.deg}° VIEW`;
    this.zoneBannerTimer = 1.5;
    sfx.playPellet();
  }

  private getCameraCompassInfo(): { dir: string; deg: number; compassDeg: number } {
    // N/S/E/W aligned directly along the 45° normal view:
    // step 0 (45°) looks N, step 1 (135°) looks W, step 2 (225°) looks S, step 3 (315°) looks E!
    const idx = ((this.cameraStep90 % 4) + 4) % 4;
    const dirs = ['N', 'W', 'S', 'E'];
    const degs = [45, 135, 225, 315];
    const compassDegs = [0, 270, 180, 90];
    return { dir: dirs[idx], deg: degs[idx], compassDeg: compassDegs[idx] };
  }

  private getWindPhysics(): {
    compassDeg: number;
    compassRad: number;
    dirX: number;
    dirZ: number;
    speed: number;
    knots: number;
    label: string;
  } {
    const normDeg = ((this.windCompassDeg % 360) + 360) % 360;
    const compassRad = (normDeg * Math.PI) / 180;
    // Align 0° (N) straight along the 45° normal camera forward vector (-0.7071, -0.7071),
    // 90° (E) to (+0.7071, -0.7071), 180° (S) to (+0.7071, +0.7071), 270° (W) to (-0.7071, +0.7071)!
    const worldAngle = Math.PI * 0.25 - compassRad;
    const dirX = -Math.sin(worldAngle);
    const dirZ = -Math.cos(worldAngle);
    const baseSpeed =
      this.weather === 'storm'
        ? 4.05
        : this.weather === 'breezy'
          ? 2.85
          : this.weather === 'rain'
            ? 2.25
            : this.weather === 'snow'
              ? 1.75
              : 1.55;
    const gust = 1 + Math.sin(this.time * 0.65) * 0.14;
    const speed = baseSpeed * gust;
    const knots = Math.max(3, Math.round(speed * 5.2));
    const labels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const label = labels[Math.round(normDeg / 45) % 8];
    return { compassDeg: normDeg, compassRad, dirX, dirZ, speed, knots, label };
  }

  private shiftWindDirection(deltaDeg = 45): void {
    this.targetWindCompassDeg = (((this.targetWindCompassDeg + deltaDeg) % 360) + 360) % 360;
    this.windShiftTimer = 36;
    const labels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const nextLbl = labels[Math.round(this.targetWindCompassDeg / 45) % 8];
    const wind = this.getWindPhysics();
    this.zoneBannerText = `WIND SHIFT · BLOWING ${nextLbl} (${wind.knots} KT)`;
    this.zoneBannerTimer = 1.7;
    sfx.playPellet();
  }

  private getDayTimeMeta(): {
    dayShort: string;
    dayFull: string;
    timeStr: string;
    period: 'DAWN' | 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT';
    isMarketDay: boolean;
    weatherLabel: string;
  } {
    const shortDays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const fullDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const h24 = Math.floor(this.timeOfDayHours) % 24;
    const mins = Math.floor((this.timeOfDayHours - Math.floor(this.timeOfDayHours)) * 60);
    const ampm = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    const timeStr = `${String(h12).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${ampm}`;
    const period =
      this.timeOfDayHours >= 5 && this.timeOfDayHours < 8
        ? 'DAWN'
        : this.timeOfDayHours >= 8 && this.timeOfDayHours < 12
          ? 'MORNING'
          : this.timeOfDayHours >= 12 && this.timeOfDayHours < 17
            ? 'AFTERNOON'
            : this.timeOfDayHours >= 17 && this.timeOfDayHours < 20.5
              ? 'EVENING'
              : 'NIGHT';
    const weatherLabels: Record<YsWeatherKind, string> = {
      clear: period === 'NIGHT' ? 'STARLIT' : 'SUNNY',
      breezy: 'BREEZY',
      rain: 'RAIN',
      storm: 'STORM',
      snow: 'SNOW',
    };
    const dIdx = ((this.dayOfWeek % 7) + 7) % 7;
    return {
      dayShort: shortDays[dIdx],
      dayFull: fullDays[dIdx],
      timeStr,
      period,
      isMarketDay: dIdx === 0 || dIdx === 3 || dIdx === 6,
      weatherLabel: weatherLabels[this.weather],
    };
  }

  private getDesiredPianoTrack(zone: ZoneDef): string {
    const meta = this.getDayTimeMeta();
    const outdoor =
      zone.theme !== 'interior' &&
      zone.theme !== 'shrine' &&
      zone.theme !== 'tower' &&
      zone.theme !== 'lava';
    if (outdoor && meta.period === 'NIGHT') {
      return 'ys_night_nocturne';
    }
    if (zone.theme === 'town' || zone.theme === 'village' || zone.theme === 'interior') {
      return this.variant === 'ys2' ? 'ys_feena' : 'ys_town_fountain';
    }
    if (zone.theme === 'plains' || zone.theme === 'ruins') {
      return 'ys_falcom_rock';
    }
    if (zone.theme === 'tower' || zone.theme === 'lava' || zone.theme === 'ice') {
      return 'ys_tower_end';
    }
    return 'ys_shrine_palace';
  }

  private syncZonePianoScore(zone: ZoneDef): void {
    if (typeof window === 'undefined') return;
    const trackId = this.getDesiredPianoTrack(zone);
    if (trackId !== this.activeMusicTrackId) {
      this.activeMusicTrackId = trackId;
      arcadeMusic.switchTrackById(trackId);
    }
  }

  private advanceTimeOfDay(deltaHours: number): void {
    this.timeOfDayHours += deltaHours;
    while (this.timeOfDayHours >= 24) {
      this.timeOfDayHours -= 24;
      this.dayOfWeek = (this.dayOfWeek + 1) % 7;
      this.dayNumber++;
    }
    const meta = this.getDayTimeMeta();
    this.zoneBannerText = `${meta.dayShort} DAY ${this.dayNumber} · ${meta.timeStr} (${meta.period})`;
    this.zoneBannerTimer = 2.0;
    const activeZone = this.zones[this.currentZoneId];
    if (activeZone && this.phase === 'PLAYING') {
      this.syncZonePianoScore(activeZone);
    }
    sfx.playPellet();
  }

  private cycleWeather(): void {
    const order: YsWeatherKind[] = ['clear', 'breezy', 'rain', 'storm', 'snow'];
    const idx = order.indexOf(this.weather);
    this.weather = order[(idx + 1) % order.length];
    this.weatherTimer = 95;
    if (this.weather === 'storm') {
      this.lightningFlash = 0.85;
      this.lightningTimer = 4.5;
      sfx.playThunder();
    }
    const meta = this.getDayTimeMeta();
    this.zoneBannerText = `WEATHER · ${meta.weatherLabel}`;
    this.zoneBannerTimer = 1.8;
    sfx.playPellet();
  }

  private stepTimeAndWeather(dt: number, zone: ZoneDef): void {
    // 1 game hour every ~45 real seconds (24h cycle in ~18 minutes, always feels alive!)
    this.timeOfDayHours += dt / 45;
    if (this.timeOfDayHours >= 24) {
      this.timeOfDayHours -= 24;
      this.dayOfWeek = (this.dayOfWeek + 1) % 7;
      this.dayNumber++;
      const meta = this.getDayTimeMeta();
      this.zoneBannerText = `DAWN OF ${meta.dayFull.toUpperCase()} · DAY ${this.dayNumber}`;
      this.zoneBannerTimer = 2.4;
    }

    // Smoothly transition between daytime piano themes and the serene starlit night nocturne
    this.syncZonePianoScore(zone);

    if (this.lightningFlash > 0) {
      this.lightningFlash = Math.max(0, this.lightningFlash - dt * 3.4);
    }

    const outdoor = zone.theme !== 'interior' && zone.theme !== 'shrine' && zone.theme !== 'tower' && zone.theme !== 'lava';
    if (outdoor && this.weather === 'storm') {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightningFlash = 0.92;
        this.lightningTimer = 5.5 + Math.random() * 7.5;
        this.screenShake = Math.max(this.screenShake, 0.14);
        sfx.playThunder();
      }
    }

    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      this.weatherTimer = 68 + Math.random() * 55;
      if (zone.theme === 'ice') {
        this.weather = Math.random() < 0.65 ? 'snow' : 'breezy';
      } else {
        const roll = Math.random();
        if (roll < 0.42) this.weather = 'clear';
        else if (roll < 0.66) this.weather = 'breezy';
        else if (roll < 0.86) this.weather = 'rain';
        else if (roll < 0.96) this.weather = 'storm';
        else this.weather = 'snow';
      }
      this.targetWindCompassDeg = (((this.targetWindCompassDeg + (Math.random() - 0.5) * 90) % 360) + 360) % 360;
    }

    // Smoothly veer directional wind along the 45°-aligned N/S/E/W compass
    this.windShiftTimer -= dt;
    if (this.windShiftTimer <= 0) {
      this.windShiftTimer = 28 + Math.random() * 24;
      const veer = (Math.random() < 0.5 ? -1 : 1) * (25 + Math.random() * 35);
      this.targetWindCompassDeg = (((this.targetWindCompassDeg + veer) % 360) + 360) % 360;
    }
    const windDiff = ((((this.targetWindCompassDeg - this.windCompassDeg) % 360) + 540) % 360) - 180;
    this.windCompassDeg = (((this.windCompassDeg + windDiff * (1 - Math.exp(-2.2 * dt))) % 360) + 360) % 360;
  }

  private cycleCameraZoomMode(): void {
    const order: YsCameraZoomMode[] = ['close45', 'evo45', 'wide45', 'fullmap45'];
    const idx = order.indexOf(this.cameraZoomMode);
    this.cameraZoomMode = order[(idx + 1) % order.length];
    this.cameraZoomScale = 1.0;
    const compass = this.getCameraCompassInfo();
    const labels: Record<YsCameraZoomMode, string> = {
      close45: `CAMERA · ${compass.dir} ${compass.deg}° CLOSE-UP`,
      evo45: `CAMERA · ${compass.dir} ${compass.deg}° EVO 2.5D`,
      wide45: `CAMERA · ${compass.dir} ${compass.deg}° WIDE VISTA`,
      fullmap45: `CAMERA · ${compass.dir} ${compass.deg}° FULL MAP`,
    };
    this.zoneBannerText = labels[this.cameraZoomMode];
    this.zoneBannerTimer = 2.0;
    sfx.playPellet();
  }

  private resetHeroState(): void {
    this.level = 1;
    this.exp = 0;
    this.expNext = 45;
    this.maxHp = 68;
    this.hp = 68;
    this.maxMp = 42;
    this.mp = 42;
    this.gold = 220;
    this.herbs = 2;
    this.weaponTier = 0;
    this.armorTier = 0;
    this.shieldTier = 0;
    this.booksCollected = 0;
    this.secretsFound = 0;
    this.score = 0;
    this.facingX = 0;
    this.facingY = 1;
    this.bodyAngle = Math.PI * 0.5;
    this.flags.clear();
    this.openedChests.clear();
    this.npcAngles.clear();
    this.npcStates.clear();
    this.unlockedMagic.clear();
    this.equippedRing = this.variant === 'ys2' ? 'power' : 'none';
    if (this.variant === 'ys2') {
      this.unlockedMagic.add('fire');
    }
    this.shieldAuraTimer = 0;
    this.timeFreezeTimer = 0;
    this.autoHealPulse = 0;
    this.hitStopTimer = 0;
    this.portalCooldown = 0;
    this.zoneFade = 0;
    this.forageBag = createStarterForageBag();
    this.craftedItems = { salve: 0, elixir: 0, tonic: 0, stew: 0, pie: 0 };
    this.forgedAtkBonus = 0;
    this.forgedDefBonus = 0;
    this.forgedRelics.clear();
    this.speedBuffTimer = 0;
    this.totalForaged = 0;
    this.totalCrafted = 0;
    this.dialogue = null;
    this.showFullMap = false;
    this.cameraStep90 = 0;
    this.cameraYaw = Math.PI * 0.25;
    this.targetCameraYaw = Math.PI * 0.25;
    this.dayOfWeek = 1;
    this.dayNumber = 1;
    this.timeOfDayHours = 9.5;
    this.weather = 'clear';
    this.weatherTimer = 78;
    this.lightningFlash = 0;
    this.lightningTimer = 6.5;
    this.windCompassDeg = 60;
    this.targetWindCompassDeg = 60;
    this.windShiftTimer = 34;
    this.particles = [];
    this.popups = [];
    this.combatBolts = [];
    this.impactFlashes = [];
    this.armorGibs = [];
  }

  public startNewGame(): void {
    this.zones = this.variant === 'ys1' ? createYs1World() : createYs2World();
    this.resetHeroState();
    this.activeMusicTrackId = '';
    if (typeof window !== 'undefined') {
      arcadeMusic.startTrackForGame(this.variant);
    }
    const startZone = this.variant === 'ys1' ? 'minea' : 'lance';
    this.enterZone(startZone, this.variant === 'ys1' ? 52 : 48, this.variant === 'ys1' ? 40 : 36, true);
    this.phase = 'PLAYING';
    sfx.playCoin();

    if (this.variant === 'ys1') {
      this.dialogue = {
        speaker: 'SARA THE FORTUNE TELLER',
        portrait: 'sara',
        lines: [
          'Adol! Welcome to the grand port of Minea—step through any glowing golden doorway to enter shops, smitheries, taverns, & parlors!',
          'Visit me inside Sara’s Fortune Parlor (NW), Pim’s Weapon Smithery (NE), & inspect fountains, anvils, & rustling shrubs!',
          'Walk through the North Gate to explore the vast Esteria Plains, Zepik Village houses, & the Shrine of Solomon!',
        ],
        cursor: 0,
      };
    } else {
      this.dialogue = {
        speaker: 'LILIA OF LANCE VILLAGE',
        portrait: 'lilia',
        lines: [
          'Adol, you awakened atop the vast Floating Land of Ys! Step through golden doorways to visit cottages, Ys Forge, & Dr. Flair’s Clinic!',
          'Search our flower shrubs for the Celceta Blossom, visit me inside my cottage (NW), & press [SHIFT/X] for Fire Magic!',
          'Head through the North Gate to explore Moondoria, Ice Ridge of Noltia, & Solomon Core!',
        ],
        cursor: 0,
      };
    }
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.dialogue = null;
    this.showFullMap = false;
    this.phase = 'TITLE';
  }

  public restartStage(): void {
    this.hp = this.maxHp;
    this.mp = this.maxMp;
    const town = this.variant === 'ys1' ? 'minea' : 'lance';
    this.enterZone(town, this.variant === 'ys1' ? 52 : 48, this.variant === 'ys1' ? 40 : 36, true);
    this.phase = 'PLAYING';
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public dispose(): void {
    if (this.cameraKeyHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.cameraKeyHandler);
      this.cameraKeyHandler = null;
    }
    if (this.cameraWheelHandler && typeof window !== 'undefined') {
      window.removeEventListener('wheel', this.cameraWheelHandler);
      this.cameraWheelHandler = null;
    }
    if (this.threeRenderer) {
      this.threeRenderer.dispose();
      this.threeRenderer = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Active Quest Objective Helper (keeps exploration clear & purposeful!)
  // ---------------------------------------------------------------------------
  private getActiveQuestHint(): string {
    if (this.variant === 'ys1') {
      if (!this.flags.has('sara_crystal')) return 'Quest: Search Minea Plaza shrubs & enter Sara’s Parlor (NW)';
      if (!this.flags.has('sara_blessing')) return 'Quest: Enter Sara’s Fortune Parlor (NW) with her Crystal';
      if (!this.flags.has('roda_blessing')) return 'Quest: Investigate the Ancient Roda Tree in Esteria Plains';
      if (!this.flags.has('shrine_boss')) return 'Quest: Explore Shrine of Solomon (NW) & defeat Jenocres';
      if (!this.flags.has('ys1_clear')) return 'Quest: Ascend Darm Tower (NE) & vanquish Dark Fact';
      return 'Esteria Saved! Explore remaining buildings, secrets & Books of Ys!';
    } else {
      if (!this.flags.has('celceta_blossom')) return 'Quest: Search western Lance shrubs & enter Lilia’s Cottage (NW)';
      if (!this.flags.has('lilia_charm')) return 'Quest: Enter Lilia’s Cottage (NW) with the Celceta Blossom';
      if (!this.flags.has('velagunder')) return 'Quest: Investigate Ruins of Moondoria & defeat Velagunder';
      if (!this.flags.has('tyalmath')) return 'Quest: Cross Ice Ridge of Noltia & defeat Tyalmath';
      if (!this.flags.has('ys2_clear')) return 'Quest: Enter Solomon Core & vanquish Darm!';
      return 'Floating Land of Ys Restored! Discover all hidden secrets!';
    }
  }

  // ---------------------------------------------------------------------------
  // Zone Transitions (Safe Inner Spawn + Portal Cooldown + Smooth Fade!)
  // ---------------------------------------------------------------------------
  private enterZone(zoneId: string, destTx: number, destTy: number, announce: boolean): void {
    const z = this.zones[zoneId];
    if (!z) return;
    this.currentZoneId = zoneId;
    this.px = (destTx + 0.5) * TILE;
    this.py = (destTy + 0.5) * TILE;
    this.portalCooldown = 0.8;
    this.zoneFade = announce ? 0.95 : 0;
    this.projectiles = [];
    this.combatBolts = [];
    this.impactFlashes = [];
    this.armorGibs = [];
    this.enemies = [];
    this.activeBoss = null;
    this.inShrubId = null;
    this.initNpcStates(z);

    // Populate zone enemies
    for (const sp of z.enemySpawns) {
      this.enemies.push(this.createEnemy(sp.kind, (sp.tx + 0.5) * TILE, (sp.ty + 0.5) * TILE));
    }

    // Spawn zone boss if not yet defeated
    if (z.bossSpawn && !this.flags.has(z.bossSpawn.defeatFlag)) {
      const bs = z.bossSpawn;
      const boss: WorldEnemy = {
        id: this.nextEnemyId++,
        x: (bs.tx + 0.5) * TILE,
        y: (bs.ty + 0.5) * TILE,
        vx: 0,
        vy: 0,
        angle: Math.PI * 0.5,
        kind: 'boss',
        name: bs.name,
        hp: bs.hp,
        maxHp: bs.hp,
        atk: bs.atk,
        def: bs.def,
        exp: bs.exp,
        gold: bs.gold,
        speed: 92,
        color: bs.color,
        accent: bs.accent,
        aiTimer: 0.8,
        hitFlash: 0,
        knockVx: 0,
        knockVy: 0,
        bossId: bs.bossId,
        bossPattern: 0,
        bossPhaseTimer: 2.0,
      };
      this.enemies.push(boss);
      this.activeBoss = boss;
    }

    // Clamp initial camera cleanly inside the full-viewport tilted 2.5D zone
    const halfW = this.logicalWidth * 0.5;
    const halfHWorld = (this.logicalHeight * 0.5) / TILT;
    this.camX = Math.max(halfW, Math.min(z.width * TILE - halfW, this.px));
    this.camY = Math.max(halfHWorld, Math.min(z.height * TILE - halfHWorld, this.py));

    // Switch serene per-zone & circadian Concert Grand Piano soundtrack
    if (announce && typeof window !== 'undefined') {
      this.syncZonePianoScore(z);
    }

    if (announce) {
      const burstCol = z.theme === 'interior' ? '#fde047' : '#38bdf8';
      spawnBurst(this.particles, this.px, this.py, burstCol, 14, 115, 2.8);
      this.threeRenderer?.spawnGpuBurst(this.px, this.py, burstCol, 18, 3.4);
      this.zoneBannerText = `${z.name} — ${z.subtitle}`;
      this.zoneBannerTimer = 2.8;
    }
  }

  private createEnemy(kind: WorldEnemy['kind'], x: number, y: number): WorldEnemy {
    const scale = this.variant === 'ys2' ? 1.16 : 1.0;
    const defs: Record<
      Exclude<WorldEnemy['kind'], 'boss'>,
      { name: string; hp: number; atk: number; def: number; exp: number; gold: number; speed: number; color: string; accent: string }
    > = {
      slime: { name: 'Roda Slime', hp: 26, atk: 10, def: 3, exp: 14, gold: 30, speed: 66, color: '#22c55e', accent: '#86efac' },
      goblin: { name: 'Esteria Goblin', hp: 42, atk: 15, def: 6, exp: 24, gold: 48, speed: 84, color: '#ea580c', accent: '#fde047' },
      knight: { name: 'Dark Knight', hp: 72, atk: 22, def: 11, exp: 40, gold: 85, speed: 80, color: '#4f46e5', accent: '#cbd5e1' },
      mage: { name: 'Darm Warlock', hp: 58, atk: 24, def: 8, exp: 44, gold: 95, speed: 72, color: '#9333ea', accent: '#f472b6' },
      wyvern: { name: 'Crimson Wyvern', hp: 96, atk: 29, def: 13, exp: 60, gold: 130, speed: 100, color: '#dc2626', accent: '#fbbf24' },
    };
    const d = defs[kind === 'boss' ? 'knight' : kind];
    return {
      id: this.nextEnemyId++,
      x,
      y,
      vx: 0,
      vy: 0,
      angle: Math.PI * 0.5,
      kind,
      name: d.name,
      hp: Math.round(d.hp * scale),
      maxHp: Math.round(d.hp * scale),
      atk: Math.round(d.atk * scale),
      def: Math.round(d.def * scale),
      exp: d.exp,
      gold: d.gold,
      speed: d.speed,
      color: d.color,
      accent: d.accent,
      aiTimer: Math.random() * 1.5,
      hitFlash: 0,
      knockVx: 0,
      knockVy: 0,
    };
  }

  private getEffectiveAtk(): number {
    const tonicBonus = this.speedBuffTimer > 0 ? 6 : 0;
    const base = 8 + this.level * 4 + this.WEAPONS[this.weaponTier].atk + this.forgedAtkBonus + tonicBonus;
    return this.equippedRing === 'power' ? Math.round(base * 1.25) : base;
  }

  private getEffectiveDef(): number {
    const base = 4 + this.level * 3 + this.ARMORS[this.armorTier].def + this.SHIELDS[this.shieldTier].def + this.forgedDefBonus;
    return this.equippedRing === 'shield' ? Math.round(base * 1.25) : base;
  }

  private getTotalBagCount(): number {
    let total = 0;
    for (const v of Object.values(this.forageBag)) total += v;
    total += this.craftedItems.salve + this.craftedItems.elixir + this.craftedItems.tonic + this.craftedItems.stew + this.craftedItems.pie;
    return total;
  }

  private getBagSummaryLine(): string {
    const b = this.forageBag;
    const parts: string[] = [];
    if (b.sunleaf_herb > 0) parts.push(`Sunleaf:${b.sunleaf_herb}`);
    if (b.moonblossom > 0) parts.push(`Blossom:${b.moonblossom}`);
    if (b.celceta_mint > 0) parts.push(`Mint:${b.celceta_mint}`);
    if (b.wild_berries > 0) parts.push(`Berries:${b.wild_berries}`);
    if (b.chanterelle > 0) parts.push(`Shroom:${b.chanterelle}`);
    if (b.orchard_apple > 0) parts.push(`Apple:${b.orchard_apple}`);
    if (b.honeycomb > 0) parts.push(`Honey:${b.honeycomb}`);
    if (b.iron_ore > 0) parts.push(`Iron:${b.iron_ore}`);
    if (b.silver_ore > 0) parts.push(`Silver:${b.silver_ore}`);
    if (b.obsidian_shard > 0) parts.push(`Obsidian:${b.obsidian_shard}`);
    if (b.oak_timber > 0) parts.push(`Oak:${b.oak_timber}`);
    if (b.ancient_gear > 0) parts.push(`Gear:${b.ancient_gear}`);
    return parts.length > 0
      ? `Satchel: ${parts.join(' · ')}`
      : 'Satchel empty — gather wild herbs, berries, mushrooms, ore & timber across fields and towns!';
  }

  private openSatchelMenu(): void {
    this.dialogue = {
      speaker: 'SCAVENGER SATCHEL [C]',
      portrait: 'adol',
      lines: [
        this.getBagSummaryLine(),
        `Crafted: Salve:${this.craftedItems.salve} · Elixir:${this.craftedItems.elixir} · Tonic:${this.craftedItems.tonic} · Stew:${this.craftedItems.stew} · Pie:${this.craftedItems.pie}`,
      ],
      shopKind: 'satchel',
      cursor: 0,
    };
  }

  private hasMaterials(reqs: Partial<Record<ForageItemId, number>>): boolean {
    for (const [k, need] of Object.entries(reqs) as Array<[ForageItemId, number]>) {
      if ((this.forageBag[k] ?? 0) < need) return false;
    }
    return true;
  }

  private consumeMaterials(reqs: Partial<Record<ForageItemId, number>>): void {
    for (const [k, need] of Object.entries(reqs) as Array<[ForageItemId, number]>) {
      this.forageBag[k] = Math.max(0, (this.forageBag[k] ?? 0) - need);
    }
  }

  private addScore(pts: number): void {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(this.highScoreKey, this.highScore);
    }
  }

  private grantExp(amount: number): void {
    this.exp += amount;
    this.addScore(amount * 10);
    while (this.exp >= this.expNext) {
      this.exp -= this.expNext;
      this.level++;
      this.expNext = Math.round(this.expNext * 1.48);
      this.maxHp += 18;
      this.hp = this.maxHp;
      this.maxMp += 10;
      this.mp = this.maxMp;
      sfx.playStageClear();
      spawnBurst(this.particles, this.px, this.py, '#fde047', 26, 180, 3.8);
      this.threeRenderer?.spawnGpuBurst(this.px, this.py, '#fde047', 28, 4.6);
      this.popups.push({ x: this.px, y: this.py - 30, text: `LEVEL ${this.level}!`, color: '#fde047', life: 1.5, maxLife: 1.5 });
    }
  }

  private getShopOptions(kind: MenuShopKind): ShopOption[] {
    if (kind === 'forge') {
      const b = this.forageBag;
      return [
        {
          label: this.forgedRelics.has('iron_blade') ? 'Tempered Iron Blade [FORGED]' : 'Forge Tempered Iron Blade',
          cost: 0,
          desc: `2 Iron (${b.iron_ore}) + 1 Oak (${b.oak_timber}) → +6 ATK`,
          action: () => {
            if (this.forgedRelics.has('iron_blade')) return 'Already forged Tempered Iron Blade!';
            if (!this.hasMaterials({ iron_ore: 2, oak_timber: 1 })) {
              return 'Need 2 Iron Ore & 1 Seasoned Oak! Scavenge ore outcrops & timber stacks.';
            }
            this.consumeMaterials({ iron_ore: 2, oak_timber: 1 });
            this.forgedRelics.add('iron_blade');
            this.forgedAtkBonus += 6;
            this.weaponTier = Math.max(this.weaponTier, 1);
            this.totalCrafted++;
            this.addScore(280);
            sfx.playStageClear();
            spawnBurst(this.particles, this.px, this.py, '#fb923c', 22, 150, 3.4);
            this.threeRenderer?.spawnGpuBurst(this.px, this.py, '#fb923c', 26, 4.0);
            this.popups.push({ x: this.px, y: this.py - 28, text: 'FORGED IRON BLADE! +6 ATK', color: '#fb923c', life: 1.6, maxLife: 1.6 });
            return 'Clang! Hammered a razor-sharp Tempered Iron Blade (+6 ATK)!';
          },
        },
        {
          label: this.forgedRelics.has('sun_buckler') ? 'Sunforged Buckler [FORGED]' : 'Forge Sunforged Buckler',
          cost: 0,
          desc: `2 Iron (${b.iron_ore}) + 1 Silver (${b.silver_ore}) → +5 DEF`,
          action: () => {
            if (this.forgedRelics.has('sun_buckler')) return 'Already forged Sunforged Buckler!';
            if (!this.hasMaterials({ iron_ore: 2, silver_ore: 1 })) {
              return 'Need 2 Iron Ore & 1 Silver Ore! Look along rocky hills & ruined walls.';
            }
            this.consumeMaterials({ iron_ore: 2, silver_ore: 1 });
            this.forgedRelics.add('sun_buckler');
            this.forgedDefBonus += 5;
            this.shieldTier = Math.max(this.shieldTier, 1);
            this.totalCrafted++;
            this.addScore(320);
            sfx.playStageClear();
            spawnBurst(this.particles, this.px, this.py, '#38bdf8', 22, 150, 3.4);
            this.threeRenderer?.spawnGpuBurst(this.px, this.py, '#38bdf8', 24, 3.8);
            this.popups.push({ x: this.px, y: this.py - 28, text: 'FORGED BUCKLER! +5 DEF', color: '#38bdf8', life: 1.6, maxLife: 1.6 });
            return 'Quenched & gleaming! Sunforged Buckler equipped (+5 DEF)!';
          },
        },
        {
          label: this.forgedRelics.has('silver_longsword') ? 'Silver-Edged Longsword [FORGED]' : 'Forge Silver-Edged Longsword',
          cost: 0,
          desc: `3 Silver (${b.silver_ore}) + 2 Iron (${b.iron_ore}) → +12 ATK`,
          action: () => {
            if (this.forgedRelics.has('silver_longsword')) return 'Already forged Silver-Edged Longsword!';
            if (!this.hasMaterials({ silver_ore: 3, iron_ore: 2 })) {
              return 'Need 3 Silver Ore & 2 Iron Ore to smelt Silver-Edged steel!';
            }
            this.consumeMaterials({ silver_ore: 3, iron_ore: 2 });
            this.forgedRelics.add('silver_longsword');
            this.forgedAtkBonus += 12;
            this.weaponTier = Math.max(this.weaponTier, 3);
            this.totalCrafted++;
            this.addScore(520);
            sfx.playStageClear();
            spawnBurst(this.particles, this.px, this.py, '#e0f2fe', 26, 170, 3.8);
            this.threeRenderer?.spawnGpuBurst(this.px, this.py, '#38bdf8', 28, 4.2);
            this.popups.push({ x: this.px, y: this.py - 28, text: 'SILVER LONGSWORD! +12 ATK', color: '#bae6fd', life: 1.7, maxLife: 1.7 });
            return 'Masterwork! Silver-Edged Longsword blazes with Esterian sheen (+12 ATK)!';
          },
        },
        {
          label: this.forgedRelics.has('silver_charm') ? 'Traveler Silver Charm [FORGED]' : 'Craft Traveler Silver Charm',
          cost: 0,
          desc: `1 Silver (${b.silver_ore}) + 1 Gear (${b.ancient_gear}) + 1 Blossom (${b.moonblossom}) → +25 HP/+3 DEF`,
          action: () => {
            if (this.forgedRelics.has('silver_charm')) return 'Already crafted Traveler Silver Charm!';
            if (!this.hasMaterials({ silver_ore: 1, ancient_gear: 1, moonblossom: 1 })) {
              return 'Need 1 Silver Ore, 1 Ancient Gear & 1 Moonblossom!';
            }
            this.consumeMaterials({ silver_ore: 1, ancient_gear: 1, moonblossom: 1 });
            this.forgedRelics.add('silver_charm');
            this.maxHp = Math.min(450, this.maxHp + 25);
            this.hp = Math.min(this.maxHp, this.hp + 25);
            this.forgedDefBonus += 3;
            this.totalCrafted++;
            this.addScore(420);
            sfx.playStageClear();
            spawnBurst(this.particles, this.px, this.py, '#fde047', 24, 155, 3.6);
            this.threeRenderer?.spawnGpuBurst(this.px, this.py, '#fde047', 26, 4.0);
            this.popups.push({ x: this.px, y: this.py - 28, text: '+25 MAX HP · +3 DEF!', color: '#fde047', life: 1.6, maxLife: 1.6 });
            return 'Filigree silver charm crafted! +25 Max HP & +3 DEF!';
          },
        },
        {
          label: this.forgedRelics.has('obsidian_blade') ? 'Obsidian Runeblade [FORGED]' : 'Forge Obsidian Runeblade',
          cost: 0,
          desc: `2 Obsidian (${b.obsidian_shard}) + 2 Silver (${b.silver_ore}) + 1 Gear (${b.ancient_gear}) → +18 ATK`,
          action: () => {
            if (this.forgedRelics.has('obsidian_blade')) return 'Already forged the legendary Obsidian Runeblade!';
            if (!this.hasMaterials({ obsidian_shard: 2, silver_ore: 2, ancient_gear: 1 })) {
              return 'Need 2 Obsidian Shards, 2 Silver Ore & 1 Ancient Gear from ruins & shrines!';
            }
            this.consumeMaterials({ obsidian_shard: 2, silver_ore: 2, ancient_gear: 1 });
            this.forgedRelics.add('obsidian_blade');
            this.forgedAtkBonus += 18;
            this.weaponTier = Math.max(this.weaponTier, 4);
            this.totalCrafted++;
            this.addScore(750);
            sfx.playStageClear();
            spawnBurst(this.particles, this.px, this.py, '#c084fc', 30, 185, 4.0);
            this.threeRenderer?.spawnGpuBurst(this.px, this.py, '#c084fc', 34, 4.8);
            this.popups.push({ x: this.px, y: this.py - 30, text: 'OBSIDIAN RUNEBLADE! +18 ATK', color: '#e879f9', life: 1.9, maxLife: 1.9 });
            return 'Legendary! The Obsidian Runeblade hums with ancient Ys resonance (+18 ATK)!';
          },
        },
        { label: 'Step Away from Forge', cost: 0, desc: 'Return to world', action: () => 'CLOSE' },
      ];
    }
    if (kind === 'alchemy') {
      const b = this.forageBag;
      return [
        {
          label: `Brew Celceta Healing Salve (Have ${this.craftedItems.salve})`,
          cost: 0,
          desc: `2 Sunleaf (${b.sunleaf_herb}) + 1 Berries (${b.wild_berries}) → +70 HP`,
          action: () => {
            if (!this.hasMaterials({ sunleaf_herb: 2, wild_berries: 1 })) {
              return 'Need 2 Sunleaf Herbs & 1 Wild Berries from town gardens or meadows!';
            }
            this.consumeMaterials({ sunleaf_herb: 2, wild_berries: 1 });
            this.craftedItems.salve++;
            this.totalCrafted++;
            this.addScore(140);
            sfx.playPowerup();
            spawnBurst(this.particles, this.px, this.py, '#4ade80', 18, 130, 3.2);
            this.threeRenderer?.spawnGpuBurst(this.px, this.py, '#4ade80', 22, 3.6);
            return `Simmered emerald Celceta Salve! Press [C] Satchel anytime to heal +70 HP (x${this.craftedItems.salve}).`;
          },
        },
        {
          label: `Distill Moonlight Mana Elixir (Have ${this.craftedItems.elixir})`,
          cost: 0,
          desc: `2 Blossom (${b.moonblossom}) + 1 Honey (${b.honeycomb}) → Full MP +40 HP`,
          action: () => {
            if (!this.hasMaterials({ moonblossom: 2, honeycomb: 1 })) {
              return 'Need 2 Moonblossoms & 1 Wild Honeycomb!';
            }
            this.consumeMaterials({ moonblossom: 2, honeycomb: 1 });
            this.craftedItems.elixir++;
            this.totalCrafted++;
            this.addScore(180);
            sfx.playPowerup();
            spawnBurst(this.particles, this.px, this.py, '#38bdf8', 20, 140, 3.2);
            this.threeRenderer?.spawnGpuBurst(this.px, this.py, '#38bdf8', 22, 3.8);
            return `Bottled shimmering Mana Elixir! Use from [C] Satchel (x${this.craftedItems.elixir}).`;
          },
        },
        {
          label: `Mix Hero Swiftness Tonic (Have ${this.craftedItems.tonic})`,
          cost: 0,
          desc: `2 Mint (${b.celceta_mint}) + 1 Shroom (${b.chanterelle}) → 25s Speed & +6 ATK`,
          action: () => {
            if (!this.hasMaterials({ celceta_mint: 2, chanterelle: 1 })) {
              return 'Need 2 Celceta Mint & 1 Golden Chanterelle!';
            }
            this.consumeMaterials({ celceta_mint: 2, chanterelle: 1 });
            this.craftedItems.tonic++;
            this.totalCrafted++;
            this.addScore(180);
            sfx.playPowerup();
            spawnBurst(this.particles, this.px, this.py, '#2dd4bf', 20, 140, 3.2);
            this.threeRenderer?.spawnGpuBurst(this.px, this.py, '#2dd4bf', 22, 3.8);
            return `Zesty Swiftness Tonic bottled! Drink in [C] Satchel for 25s Speed & +6 ATK (x${this.craftedItems.tonic}).`;
          },
        },
        {
          label: `Bundle Auto-Revive Herb (Have ${this.herbs})`,
          cost: 0,
          desc: `2 Sunleaf (${b.sunleaf_herb}) + 1 Mint (${b.celceta_mint}) → +1 Emergency Herb`,
          action: () => {
            if (!this.hasMaterials({ sunleaf_herb: 2, celceta_mint: 1 })) {
              return 'Need 2 Sunleaf Herbs & 1 Celceta Mint!';
            }
            this.consumeMaterials({ sunleaf_herb: 2, celceta_mint: 1 });
            this.herbs++;
            this.totalCrafted++;
            this.addScore(150);
            sfx.playStageClear();
            spawnBurst(this.particles, this.px, this.py, '#86efac', 18, 130, 3.0);
            this.threeRenderer?.spawnGpuBurst(this.px, this.py, '#86efac', 20, 3.4);
            return `Wove a fresh Auto-Revive Herb! Total Emergency Herbs: ${this.herbs}.`;
          },
        },
        { label: 'Step Away from Cauldron', cost: 0, desc: 'Return to world', action: () => 'CLOSE' },
      ];
    }
    if (kind === 'cooking') {
      const b = this.forageBag;
      return [
        {
          label: 'Roast Trail Berry Ration (Instant)',
          cost: 0,
          desc: `2 Berries (${b.wild_berries}) + 1 Apple (${b.orchard_apple}) → Instant +45 HP`,
          action: () => {
            if (!this.hasMaterials({ wild_berries: 2, orchard_apple: 1 })) {
              return 'Need 2 Wild Berries & 1 Orchard Apple!';
            }
            this.consumeMaterials({ wild_berries: 2, orchard_apple: 1 });
            this.hp = Math.min(this.maxHp, this.hp + 45);
            this.totalCrafted++;
            this.addScore(110);
            sfx.playPowerup();
            spawnBurst(this.particles, this.px, this.py, '#fb923c', 16, 125, 3.0);
            this.threeRenderer?.spawnGpuBurst(this.px, this.py, '#fde047', 18, 3.4);
            return 'Warm sweet berries & glazed apple! Restored +45 HP right away!';
          },
        },
        {
          label: `Simmer Hearty Mushroom Stew (Have ${this.craftedItems.stew})`,
          cost: 0,
          desc: `2 Shroom (${b.chanterelle}) + 2 Berries (${b.wild_berries}) → +85 HP`,
          action: () => {
            if (!this.hasMaterials({ chanterelle: 2, wild_berries: 2 })) {
              return 'Need 2 Golden Chanterelles & 2 Wild Berries!';
            }
            this.consumeMaterials({ chanterelle: 2, wild_berries: 2 });
            this.craftedItems.stew++;
            this.totalCrafted++;
            this.addScore(160);
            sfx.playPowerup();
            spawnBurst(this.particles, this.px, this.py, '#fb923c', 20, 140, 3.2);
            this.threeRenderer?.spawnGpuBurst(this.px, this.py, '#fb923c', 22, 3.6);
            return `Savory Woodland Stew ladled into your Satchel [C] (+85 HP, x${this.craftedItems.stew})!`;
          },
        },
        {
          label: `Bake Honey-Glazed Orchard Pie (Have ${this.craftedItems.pie})`,
          cost: 0,
          desc: `2 Apple (${b.orchard_apple}) + 1 Honey (${b.honeycomb}) → Full HP/MP & +5 Max HP`,
          action: () => {
            if (!this.hasMaterials({ orchard_apple: 2, honeycomb: 1 })) {
              return 'Need 2 Orchard Apples & 1 Wild Honeycomb!';
            }
            this.consumeMaterials({ orchard_apple: 2, honeycomb: 1 });
            this.craftedItems.pie++;
            this.totalCrafted++;
            this.addScore(240);
            sfx.playStageClear();
            spawnBurst(this.particles, this.px, this.py, '#fde047', 22, 145, 3.4);
            this.threeRenderer?.spawnGpuBurst(this.px, this.py, '#fde047', 24, 3.8);
            return `Golden Orchard Pie packed in your Satchel [C]! Eat for Full HP/MP & +5 Max HP (x${this.craftedItems.pie})!`;
          },
        },
        { label: 'Step Away from Hearth', cost: 0, desc: 'Return to world', action: () => 'CLOSE' },
      ];
    }
    if (kind === 'satchel') {
      const b = this.forageBag;
      const c = this.craftedItems;
      return [
        {
          label: `Eat Wild Berries / Orchard Apple (${b.wild_berries}B · ${b.orchard_apple}A)`,
          cost: 0,
          desc: 'Restores +22 HP on the trail',
          action: () => {
            if (b.wild_berries > 0) {
              b.wild_berries--;
              this.hp = Math.min(this.maxHp, this.hp + 20);
              sfx.playPellet();
              spawnBurst(this.particles, this.px, this.py, '#f43f5e', 12, 110, 2.6);
              return 'Ate fresh Wild Berries! Restored +20 HP.';
            }
            if (b.orchard_apple > 0) {
              b.orchard_apple--;
              this.hp = Math.min(this.maxHp, this.hp + 25);
              sfx.playPellet();
              spawnBurst(this.particles, this.px, this.py, '#ef4444', 12, 110, 2.6);
              return 'Crisp Orchard Apple! Restored +25 HP.';
            }
            return 'No Berries or Apples! Gather berry bushes & apple crates outdoors.';
          },
        },
        {
          label: `Eat Wild Honeycomb (${b.honeycomb})`,
          cost: 0,
          desc: 'Restores +30 HP & +15 MP',
          action: () => {
            if (b.honeycomb <= 0) return 'No Wild Honeycomb! Check hollow trees & sunny meadows.';
            b.honeycomb--;
            this.hp = Math.min(this.maxHp, this.hp + 30);
            this.mp = Math.min(this.maxMp, this.mp + 15);
            sfx.playPowerup();
            spawnBurst(this.particles, this.px, this.py, '#facc15', 14, 120, 2.8);
            return 'Sweet Wild Honeycomb! Restored +30 HP & +15 MP!';
          },
        },
        {
          label: `Use Celceta Salve / Stew (${c.salve} Salve · ${c.stew} Stew)`,
          cost: 0,
          desc: 'Heals +70 to +85 HP',
          action: () => {
            if (c.stew > 0) {
              c.stew--;
              this.hp = Math.min(this.maxHp, this.hp + 85);
              sfx.playStageClear();
              spawnBurst(this.particles, this.px, this.py, '#fb923c', 18, 130, 3.2);
              return 'Hearty Mushroom Stew! Restored +85 HP!';
            }
            if (c.salve > 0) {
              c.salve--;
              this.hp = Math.min(this.maxHp, this.hp + 70);
              sfx.playStageClear();
              spawnBurst(this.particles, this.px, this.py, '#4ade80', 18, 130, 3.2);
              return 'Applied Celceta Salve! Restored +70 HP!';
            }
            return 'No Salve or Stew yet! Brew at an Alchemy Cauldron or Hearth Kettle.';
          },
        },
        {
          label: `Use Mana Elixir / Orchard Pie (${c.elixir} Elixir · ${c.pie} Pie)`,
          cost: 0,
          desc: 'Full MP + HP (Pie gives +5 Max HP!)',
          action: () => {
            if (c.pie > 0) {
              c.pie--;
              this.maxHp = Math.min(450, this.maxHp + 5);
              this.hp = this.maxHp;
              this.mp = this.maxMp;
              sfx.playStageClear();
              spawnBurst(this.particles, this.px, this.py, '#fde047', 22, 150, 3.6);
              this.threeRenderer?.spawnGpuBurst(this.px, this.py, '#fde047', 24, 3.8);
              return 'Honey-Glazed Orchard Pie! Full HP/MP & +5 Max HP!';
            }
            if (c.elixir > 0) {
              c.elixir--;
              this.mp = this.maxMp;
              this.hp = Math.min(this.maxHp, this.hp + 40);
              sfx.playStageClear();
              spawnBurst(this.particles, this.px, this.py, '#38bdf8', 20, 140, 3.4);
              this.threeRenderer?.spawnGpuBurst(this.px, this.py, '#38bdf8', 22, 3.6);
              return 'Moonlight Mana Elixir! Full MP & +40 HP!';
            }
            return 'No Elixir or Pie yet! Craft at a Cauldron or Cooking Hearth.';
          },
        },
        {
          label: `Drink Hero Swiftness Tonic (${c.tonic})`,
          cost: 0,
          desc: '25s +28% Move Speed & +6 ATK',
          action: () => {
            if (c.tonic <= 0) return 'No Swiftness Tonic! Brew 2 Celceta Mint + 1 Chanterelle at a Cauldron.';
            c.tonic--;
            this.speedBuffTimer = 25;
            sfx.playStageClear();
            spawnBurst(this.particles, this.px, this.py, '#2dd4bf', 22, 150, 3.4);
            this.threeRenderer?.spawnGpuBurst(this.px, this.py, '#2dd4bf', 24, 4.0);
            this.popups.push({ x: this.px, y: this.py - 28, text: 'SWIFTNESS! +SPD & +6 ATK', color: '#2dd4bf', life: 1.6, maxLife: 1.6 });
            return 'Surging energy! +28% Movement Speed & +6 ATK for 25 seconds!';
          },
        },
        { label: 'Close Satchel', cost: 0, desc: 'Return to exploration', action: () => 'CLOSE' },
      ];
    }
    if (kind === 'bakery') {
      return [
        {
          label: 'Golden Hearth Loaf (35G)',
          cost: 35,
          desc: 'Restores +60 HP & +15 MP right away!',
          action: () => {
            if (this.gold < 35) return 'Need 35 Gold! Search shrubs or help townsfolk for Gold.';
            this.gold -= 35;
            this.hp = Math.min(this.maxHp, this.hp + 60);
            this.mp = Math.min(this.maxMp, this.mp + 15);
            this.addScore(100);
            sfx.playPowerup();
            spawnBurst(this.particles, this.px, this.py, '#fde047', 16, 125, 3.0);
            this.threeRenderer?.spawnGpuBurst(this.px, this.py, '#fde047', 18, 3.4);
            return 'Warm & crusty! Restored +60 HP & +15 MP!';
          },
        },
        {
          label: 'Esteria Honey Tart (65G)',
          cost: 65,
          desc: 'Full HP & MP + +5 Max HP vigor boost!',
          action: () => {
            if (this.gold < 65) return 'Need 65 Gold for a fresh Honey Tart!';
            this.gold -= 65;
            this.maxHp = Math.min(400, this.maxHp + 5);
            this.hp = this.maxHp;
            this.mp = this.maxMp;
            this.addScore(180);
            sfx.playStageClear();
            spawnBurst(this.particles, this.px, this.py, '#4ade80', 18, 135, 3.2);
            this.threeRenderer?.spawnGpuBurst(this.px, this.py, '#fde047', 22, 3.8);
            return 'Delicious Honey Tart! Full HP/MP & +5 Max HP!';
          },
        },
        {
          label: 'Traveler Bread Pack (95G)',
          cost: 95,
          desc: '+1 Emergency Heal Herb & full HP!',
          action: () => {
            if (this.gold < 95) return 'Need 95 Gold for a Traveler Pack!';
            this.gold -= 95;
            this.herbs++;
            this.hp = this.maxHp;
            this.addScore(150);
            sfx.playPellet();
            spawnBurst(this.particles, this.px, this.py, '#4ade80', 14, 115, 2.8);
            this.threeRenderer?.spawnGpuBurst(this.px, this.py, '#4ade80', 18, 3.2);
            return `Packed warm rations! Heal Herbs: ${this.herbs}`;
          },
        },
        { label: 'Leave Bakery', cost: 0, desc: 'Return to Minea Square', action: () => 'CLOSE' },
      ];
    }
    if (kind === 'weapon') {
      const nextTier = Math.min(this.WEAPONS.length - 1, this.weaponTier + 1);
      const nextW = this.WEAPONS[nextTier];
      return [
        {
          label: this.weaponTier < this.WEAPONS.length - 1 ? `Buy ${nextW.name} (${nextW.cost}G)` : 'Max Weapon Forged!',
          cost: nextW.cost,
          desc: `ATK +${nextW.atk}`,
          action: () => {
            if (this.weaponTier >= this.WEAPONS.length - 1) return 'You already wield the strongest blade!';
            if (this.gold < nextW.cost) return `Need ${nextW.cost} Gold! Search shrubs or defeat monsters.`;
            this.gold -= nextW.cost;
            this.weaponTier = nextTier;
            sfx.playPowerup();
            spawnBurst(this.particles, this.px, this.py, '#fde047', 18, 135, 3.2);
            this.threeRenderer?.spawnGpuBurst(this.px, this.py, '#fde047', 22, 3.8);
            this.threeRenderer?.spawnGpuBurst(this.px, this.py, '#fb923c', 12, 3.1);
            return `Equipped ${nextW.name}!`;
          },
        },
        {
          label: 'Buy Heal Herb (90G)',
          cost: 90,
          desc: 'Auto-revives 70% HP in emergencies',
          action: () => {
            if (this.gold < 90) return 'Not enough Gold (90G needed).';
            this.gold -= 90;
            this.herbs++;
            sfx.playPellet();
            spawnBurst(this.particles, this.px, this.py, '#4ade80', 14, 110, 2.8);
            this.threeRenderer?.spawnGpuBurst(this.px, this.py, '#4ade80', 16, 3.2);
            return `Bought Heal Herb (Now carrying ${this.herbs}).`;
          },
        },
        { label: 'Leave Shop', cost: 0, desc: 'Return to exploration', action: () => 'CLOSE' },
      ];
    }
    if (kind === 'armor') {
      const nextA = this.ARMORS[Math.min(this.ARMORS.length - 1, this.armorTier + 1)];
      const nextS = this.SHIELDS[Math.min(this.SHIELDS.length - 1, this.shieldTier + 1)];
      return [
        {
          label: this.armorTier < this.ARMORS.length - 1 ? `Buy ${nextA.name} (${nextA.cost}G)` : 'Max Armor Equipped!',
          cost: nextA.cost,
          desc: `DEF +${nextA.def}`,
          action: () => {
            if (this.armorTier >= this.ARMORS.length - 1) return 'Your armor is already legendary!';
            if (this.gold < nextA.cost) return `Need ${nextA.cost} Gold!`;
            this.gold -= nextA.cost;
            this.armorTier++;
            sfx.playPowerup();
            spawnBurst(this.particles, this.px, this.py, '#38bdf8', 18, 135, 3.2);
            this.threeRenderer?.spawnGpuBurst(this.px, this.py, '#38bdf8', 22, 3.8);
            this.threeRenderer?.spawnGpuBurst(this.px, this.py, '#fde047', 12, 3.0);
            return `Equipped ${nextA.name}!`;
          },
        },
        {
          label: this.shieldTier < this.SHIELDS.length - 1 ? `Buy ${nextS.name} (${nextS.cost}G)` : 'Max Shield Equipped!',
          cost: nextS.cost,
          desc: `DEF +${nextS.def}`,
          action: () => {
            if (this.shieldTier >= this.SHIELDS.length - 1) return 'Your shield is already top-tier!';
            if (this.gold < nextS.cost) return `Need ${nextS.cost} Gold!`;
            this.gold -= nextS.cost;
            this.shieldTier++;
            sfx.playPowerup();
            spawnBurst(this.particles, this.px, this.py, '#38bdf8', 16, 125, 3.0);
            this.threeRenderer?.spawnGpuBurst(this.px, this.py, '#38bdf8', 18, 3.5);
            return `Equipped ${nextS.name}!`;
          },
        },
        { label: 'Leave Armory', cost: 0, desc: 'Return to exploration', action: () => 'CLOSE' },
      ];
    }
    return [
      {
        label: 'Rest at Inn (40G)',
        cost: 40,
        desc: 'Full HP & MP recovery',
        action: () => {
          if (this.gold < 40) return 'Not enough Gold (40G). Stand still in fields or inspect fountains to heal!';
          this.gold -= 40;
          this.hp = this.maxHp;
          this.mp = this.maxMp;
          sfx.playStageClear();
          spawnBurst(this.particles, this.px, this.py, '#4ade80', 20, 140, 3.4);
          this.threeRenderer?.spawnGpuBurst(this.px, this.py, '#4ade80', 24, 3.8);
          this.threeRenderer?.spawnGpuBurst(this.px, this.py, '#fde047', 14, 3.0);
          return 'Rested soundly! HP & MP fully restored!';
        },
      },
      {
        label: 'Buy Heal Herb (90G)',
        cost: 90,
        desc: 'Emergency auto-heal',
        action: () => {
          if (this.gold < 90) return 'Not enough Gold (90G).';
          this.gold -= 90;
          this.herbs++;
          sfx.playPellet();
          spawnBurst(this.particles, this.px, this.py, '#4ade80', 14, 110, 2.8);
          this.threeRenderer?.spawnGpuBurst(this.px, this.py, '#4ade80', 16, 3.2);
          return `Heal Herbs: ${this.herbs}`;
        },
      },
      { label: 'Leave Inn', cost: 0, desc: 'Return to adventure', action: () => 'CLOSE' },
    ];
  }

  public step(dt: number): void {
    this.time += dt;
    this.screenShake = Math.max(0, this.screenShake - dt * 2.8);
    if (this.zoneBannerTimer > 0) this.zoneBannerTimer -= dt;
    if (this.zoneFade > 0) this.zoneFade = Math.max(0, this.zoneFade - dt * 2.4);
    if (this.portalCooldown > 0) this.portalCooldown = Math.max(0, this.portalCooldown - dt);
    if (this.engagedEnemy) {
      this.engagedEnemy.timer -= dt;
      if (this.engagedEnemy.timer <= 0) this.engagedEnemy = null;
    }
    stepParticlesAndPopups(this.particles, this.popups, dt);
    this.stepCombatVfx(dt);

    // Smoothly interpolate 90°-stepped 45° camera yaw + direct tap/click on top-right HUD pills!
    const camYawLerp = 1 - Math.exp(-8.5 * dt);
    this.cameraYaw += (this.targetCameraYaw - this.cameraYaw) * camYawLerp;
    if (this.input.pointerActive && !this.prevPointerActive && !this.dialogue) {
      const pxClick = this.input.pointerX;
      const pyClick = this.input.pointerY;
      const pillX = this.logicalWidth - 148;
      const midX = pillX + 70;
      if (pxClick >= pillX && pxClick <= this.logicalWidth - 8 && pyClick >= 128 && pyClick <= 162) {
        if (pxClick >= midX) {
          this.rotateCamera90(1);
        } else {
          this.cycleCameraZoomMode();
        }
      } else if (pxClick >= pillX && pxClick <= this.logicalWidth - 8 && pyClick >= 166 && pyClick <= 204) {
        if (pxClick >= midX) {
          this.cycleWeather();
        } else {
          this.advanceTimeOfDay(3);
        }
      } else if (pxClick >= pillX && pxClick <= this.logicalWidth - 8 && pyClick >= 206 && pyClick <= 296) {
        this.shiftWindDirection(45);
      }
    }
    this.prevPointerActive = this.input.pointerActive;

    if (this.phase === 'TITLE') {
      this.walkAnim += dt * 3;
      this.bodyAngle = Math.sin(this.time * 0.7) * 0.9 + Math.PI * 0.5;
      const titleZone = this.zones[this.currentZoneId];
      if (titleZone) this.stepNpcFacing(dt, titleZone);
      return;
    }
    if (this.phase === 'PAUSED' || this.phase === 'GAME_OVER') return;

    if (this.phase === 'STAGE_CLEAR') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) this.phase = 'PLAYING';
      return;
    }

    const activeZoneNow = this.zones[this.currentZoneId];
    if (activeZoneNow) {
      this.stepTimeAndWeather(dt, activeZoneNow);
    }

    // Handle Chronicles+ Dialogue / Shop Window (keep living world & speakers animating during close-up!)
    if (this.dialogue) {
      if (activeZoneNow) {
        this.stepNpcFacing(dt, activeZoneNow);
      }
      this.navRepeatCd = Math.max(0, this.navRepeatCd - dt);
      if (this.dialogue.shopKind) {
        const opts = this.getShopOptions(this.dialogue.shopKind);
        if (this.navRepeatCd <= 0) {
          if (this.input.up) {
            this.dialogue.cursor = (this.dialogue.cursor + opts.length - 1) % opts.length;
            this.navRepeatCd = 0.2;
            sfx.playPellet();
          } else if (this.input.down) {
            this.dialogue.cursor = (this.dialogue.cursor + 1) % opts.length;
            this.navRepeatCd = 0.2;
            sfx.playPellet();
          }
        }
        if (this.input.fireJustPressed) {
          const result = opts[this.dialogue.cursor].action();
          if (result === 'CLOSE') {
            this.dialogue = null;
          } else if (
            this.dialogue.shopKind === 'forge' ||
            this.dialogue.shopKind === 'alchemy' ||
            this.dialogue.shopKind === 'cooking' ||
            this.dialogue.shopKind === 'satchel'
          ) {
            this.dialogue.lines = [result, this.getBagSummaryLine()];
          } else {
            this.dialogue.lines = [result];
          }
        } else if (this.input.secondaryJustPressed) {
          this.dialogue = null;
        }
      } else {
        if (this.input.fireJustPressed || this.input.secondaryJustPressed) {
          this.dialogue = null;
        }
      }
      return;
    }

    // Toggle full world map & quest log cleanly if open
    if (this.showFullMap) {
      if (this.input.secondaryJustPressed || this.input.fireJustPressed) {
        this.showFullMap = false;
        sfx.playPellet();
      }
      return;
    }

    // Snappy Chronicles+ tactile hit-stop on solid sword impacts
    if (this.hitStopTimer > 0) {
      this.hitStopTimer = Math.max(0, this.hitStopTimer - dt);
      return;
    }

    if (this.invulnTimer > 0) this.invulnTimer -= dt;
    if (this.lungeTimer > 0) this.lungeTimer -= dt;
    if (this.lungeCd > 0) this.lungeCd -= dt;
    if (this.slashArcTimer > 0) this.slashArcTimer -= dt;
    if (this.magicCd > 0) this.magicCd -= dt;
    if (this.shieldAuraTimer > 0) this.shieldAuraTimer -= dt;
    if (this.timeFreezeTimer > 0) this.timeFreezeTimer -= dt;
    if (this.speedBuffTimer > 0) this.speedBuffTimer = Math.max(0, this.speedBuffTimer - dt);

    const zone = this.zones[this.currentZoneId];
    this.stepPlayer(dt, zone);
    this.stepShrubs(dt, zone);
    this.stepForageNodes(dt, zone);
    this.stepNpcFacing(dt, zone);
    this.stepProjectiles(dt, zone);
    this.stepEnemies(dt, zone);

    // Smooth 4-way scrolling camera (unclamped in Three.js 45° 3D Diorama so edges & harbor stay centered!)
    const activeZone = this.zones[this.currentZoneId];
    let targetCamX = this.px;
    let targetCamY = this.py;
    if (!this.threeRenderer) {
      const halfW = this.logicalWidth * 0.5;
      const halfHWorld = (this.logicalHeight * 0.5) / TILT;
      const worldW = activeZone.width * TILE;
      const worldH = activeZone.height * TILE;
      targetCamX = Math.max(halfW, Math.min(worldW - halfW, this.px));
      targetCamY = Math.max(halfHWorld, Math.min(worldH - halfHWorld, this.py));
    }
    const lerpK = 1 - Math.exp(-9.2 * dt);
    this.camX += (targetCamX - this.camX) * lerpK;
    this.camY += (targetCamY - this.camY) * lerpK;
  }

  private stepCombatVfx(dt: number): void {
    for (let i = this.combatBolts.length - 1; i >= 0; i--) {
      this.combatBolts[i].life -= dt;
      if (this.combatBolts[i].life <= 0) this.combatBolts.splice(i, 1);
    }
    for (let i = this.impactFlashes.length - 1; i >= 0; i--) {
      this.impactFlashes[i].life -= dt;
      if (this.impactFlashes[i].life <= 0) this.impactFlashes.splice(i, 1);
    }
    for (let i = this.armorGibs.length - 1; i >= 0; i--) {
      const g = this.armorGibs[i];
      g.life -= dt;
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      g.vz -= 640 * dt;
      g.z += g.vz * dt;
      g.rot += g.vrot * dt;
      if (g.z < 0) {
        g.z = 0;
        g.vz = Math.abs(g.vz) * 0.42;
        g.vx *= 0.68;
        g.vy *= 0.68;
        g.vrot *= 0.6;
      }
      if (g.life <= 0) this.armorGibs.splice(i, 1);
    }
  }

  // ---------------------------------------------------------------------------
  // 2.5D Perspective Collision: Trees & Pillars only block their narrow TRUNK
  // so Adol can walk freely behind their canopies and vanish behind leaves!
  // ---------------------------------------------------------------------------
  private isPointBlocked(zone: ZoneDef, wx: number, wy: number): boolean {
    const tx = Math.floor(wx / TILE);
    const ty = Math.floor(wy / TILE);
    if (tx < 0 || ty < 0 || tx >= zone.width || ty >= zone.height) return true;
    const c = zone.tiles[ty][tx];

    if (c === 1 || c === 3 || c === 7) return true;

    // Sloped cottage roofs: let Adol walk behind the northern top half of the roof overhang!
    if (c === 5) {
      const localY = wy - ty * TILE;
      return localY > TILE * 0.42;
    }

    // Tall 2.5D Trees, Multi-Tile Groves, Ancient Roda Tree & Marble Pillars:
    // Large multi-tile groves & Roda Trees are SOLID (no walking through large trees!),
    // preserving a tiny northern edge sliver so Adol can still tuck behind the back rim for X-Ray silhouette!
    if (c === 2 || c === 9) {
      const hasNeighborTree =
        (tx > 0 && (zone.tiles[ty][tx - 1] === 2 || zone.tiles[ty][tx - 1] === 9)) ||
        (tx + 1 < zone.width && (zone.tiles[ty][tx + 1] === 2 || zone.tiles[ty][tx + 1] === 9)) ||
        (ty > 0 && (zone.tiles[ty - 1][tx] === 2 || zone.tiles[ty - 1][tx] === 9)) ||
        (ty + 1 < zone.height && (zone.tiles[ty + 1][tx] === 2 || zone.tiles[ty + 1][tx] === 9));
      if (c === 9 || hasNeighborTree) {
        const northIsTree = ty > 0 && (zone.tiles[ty - 1][tx] === 2 || zone.tiles[ty - 1][tx] === 9);
        if (!northIsTree) {
          const localY = wy - ty * TILE;
          if (localY < TILE * 0.16) return false;
        }
        return true;
      }
      // Standalone 1x1 tree: solid trunk & flared root base!
      const cx = (tx + 0.5) * TILE;
      const trunkY = (ty + 0.64) * TILE;
      const dx = wx - cx;
      const dy = wy - trunkY;
      return dx * dx + dy * dy < 17 * 17;
    }

    // Solid Inspectables (Fountains, Wells, Statues, Crates, Campfires, Bookshelves, Anvils, Bells, Signs!)
    for (const obj of zone.inspectables) {
      if (Math.abs(obj.tx - tx) <= 2 && Math.abs(obj.ty - ty) <= 2) {
        const ox = (obj.tx + 0.5) * TILE;
        const oy = (obj.ty + 0.56) * TILE;
        const rad =
          obj.kind === 'fountain'
            ? 72
            : obj.kind === 'well'
              ? 22
              : obj.kind === 'statue' ||
                  obj.kind === 'pedestal' ||
                  obj.kind === 'bookshelf' ||
                  obj.kind === 'crates' ||
                  obj.kind === 'campfire' ||
                  obj.kind === 'dock_cargo'
                ? 19
                : 16;
        if (Math.hypot(wx - ox, wy - oy) < rad) return true;
      }
    }

    // Solid Treasure Chests (auto-open smoothly when bumping the front rim!)
    for (const ch of zone.chests) {
      if (Math.abs(ch.tx - tx) <= 1 && Math.abs(ch.ty - ty) <= 1) {
        const cx = (ch.tx + 0.5) * TILE;
        const cy = (ch.ty + 0.56) * TILE;
        if (Math.hypot(wx - cx, wy - cy) < 15) return true;
      }
    }

    // Dynamic 3D Environment Obstacles (Ornate Streetlamps, Stalls, Wagons, Windmills, Waterwheels, Hedgerows, Tables, Bakery Oven, Craftworks & Pastures!)
    if (this.threeRenderer?.isPointInDynamicObstacle(wx, wy)) return true;

    return false;
  }

  private canOccupy(zone: ZoneDef, wx: number, wy: number, r = 11): boolean {
    return (
      !this.isPointBlocked(zone, wx - r, wy - r * 0.6) &&
      !this.isPointBlocked(zone, wx + r, wy - r * 0.6) &&
      !this.isPointBlocked(zone, wx - r, wy + r) &&
      !this.isPointBlocked(zone, wx + r, wy + r)
    );
  }

  private checkCanopyOcclusion(zone: ZoneDef): boolean {
    const tx = Math.floor(this.px / TILE);
    const ty = Math.floor(this.py / TILE);
    // Check current tile and the row directly SOUTH of Adol (where a tall tree/roof rises up over Adol!)
    for (let dr = 0; dr <= 2; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = ty + dr;
        const c = tx + dc;
        if (r < 0 || r >= zone.height || c < 0 || c >= zone.width) continue;
        const code = zone.tiles[r][c];
        if (code === 2 || code === 9) {
          const treeCx = (c + 0.5) * TILE;
          const baseY = (r + 0.78) * TILE;
          const canopyCy = (r + 0.08) * TILE;
          const canopyRad = code === 9 ? 46 : 30;
          if (this.py < baseY - 2 && Math.hypot(this.px - treeCx, this.py - 10 - canopyCy) < canopyRad) {
            return true;
          }
        } else if (code === 5) {
          const rx = c * TILE;
          const ry = r * TILE;
          if (this.py < ry + TILE * 0.5 && this.px > rx - 6 && this.px < rx + TILE + 6 && this.py > ry - 18) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private stepPlayer(dt: number, zone: ZoneDef): void {
    const mv = getPrecisionMoveVector(this.input);
    const dashBoost = this.lungeTimer > 0 ? 1.66 : 1.0;
    const tonicBoost = this.speedBuffTimer > 0 ? 1.28 : 1.0;
    const inShrubSlow = this.inShrubId ? 0.84 : 1.0;
    const spd = 208 * mv.scale * dashBoost * tonicBoost * inShrubSlow;

    const mag = Math.hypot(mv.vx, mv.vy);
    const moving = mag > 0.08;
    if (moving) {
      // Align directional movement seamlessly with the 45° 3D isometric camera yaw!
      const yaw = this.threeRenderer ? this.cameraYaw : 0;
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const rawX = mv.vx / mag;
      const rawY = mv.vy / mag;
      const ux = rawX * cosY + rawY * sinY;
      const uy = -rawX * sinY + rawY * cosY;
      this.facingX = ux;
      this.facingY = uy;
      const targetAngle = Math.atan2(uy, ux);
      this.bodyAngle = lerpAngle(this.bodyAngle, targetAngle, dt * 19);
      this.moveSpeedFrac = Math.min(1, this.moveSpeedFrac + dt * 11);
      this.standStillTimer = 0;
      this.autoHealPulse = Math.max(0, this.autoHealPulse - dt * 4);
      this.walkAnim += dt * (this.lungeTimer > 0 ? 18 : 13.5);

      const nx = this.px + ux * spd * dt;
      if (this.canOccupy(zone, nx, this.py)) {
        this.px = nx;
      }
      const ny = this.py + uy * spd * dt;
      if (this.canOccupy(zone, this.px, ny)) {
        this.py = ny;
      }

      // Subtle Rhythmic Footstep Dust / Pollen / Snow / Oak Sparkle Puffs while running!
      this.footstepTimer += dt;
      if (this.footstepTimer >= (this.lungeTimer > 0 ? 0.09 : 0.22) && this.moveSpeedFrac > 0.35) {
        this.footstepTimer = 0;
        const ftc = Math.max(0, Math.min(zone.width - 1, Math.floor(this.px / TILE)));
        const ftr = Math.max(0, Math.min(zone.height - 1, Math.floor(this.py / TILE)));
        const ft = zone.tiles[ftr]?.[ftc] ?? 0;
        const stepCol =
          zone.theme === 'ice'
            ? '#e0f2fe'
            : zone.theme === 'interior'
              ? '#fde68a'
              : zone.theme === 'lava' || zone.theme === 'tower'
                ? '#fb923c'
                : ft === 6 || ft === 4
                  ? '#e7d5b2'
                  : '#86efac';
        this.particles.push({
          x: this.px - ux * 6 + (Math.random() - 0.5) * 6,
          y: this.py + 5,
          vx: -ux * 16 + (Math.random() - 0.5) * 14,
          vy: -uy * 10 - 12,
          life: 0.3,
          maxLife: 0.3,
          color: stepCol,
          radius: 2.3,
        });
        this.threeRenderer?.spawnGpuBurst(this.px - ux * 6, this.py - uy * 6, stepCol, 3, 1.5);
      }

      if (this.lungeTimer > 0 && Math.random() < 0.45) {
        this.particles.push({
          x: this.px - ux * 10 + (Math.random() - 0.5) * 6,
          y: this.py + 6,
          vx: -ux * 24,
          vy: -uy * 16 - 10,
          life: 0.28,
          maxLife: 0.28,
          color: 'rgba(226, 232, 240, 0.55)',
          radius: 3.2,
        });
      }
    } else {
      this.moveSpeedFrac = Math.max(0, this.moveSpeedFrac - dt * 11);
      this.standStillTimer += dt;
      if (zone.canAutoHeal && this.standStillTimer > 0.55 && (this.hp < this.maxHp || this.mp < this.maxMp)) {
        this.autoHealPulse = Math.min(1, this.autoHealPulse + dt * 3);
        if (this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + 18 * dt);
        if (this.mp < this.maxMp) this.mp = Math.min(this.maxMp, this.mp + 13 * dt);
      } else {
        this.autoHealPulse = Math.max(0, this.autoHealPulse - dt * 4);
      }
    }

    // Track whether Adol is tucked behind a 2.5D tree canopy or cottage roof
    this.occludedByCanopy = this.checkCanopyOcclusion(zone);

    // Find closest interactable (NPC, Statue/Sign/Fountain, Shrub, Chest) for contextual prompt!
    this.nearestInteract = this.findNearestInteractable(zone);

    // Primary Action: Prioritize Interaction / Investigation, else Sword Dash Lunge!
    if (this.input.fireJustPressed) {
      if (!this.tryInteract(zone)) {
        if (this.lungeCd <= 0) {
          this.lungeTimer = 0.22;
          this.lungeCd = 0.42;
          this.slashArcTimer = 0.2;
          sfx.playShoot();
          spawnBurst(this.particles, this.px + this.facingX * 12, this.py + this.facingY * 12, '#bae6fd', 10, 120, 2.6);
          this.threeRenderer?.spawnGpuBurst(this.px + this.facingX * 12, this.py + this.facingY * 12, '#bae6fd', 12, 3.2);
        }
      }
    }

    // Secondary Action: Cast Magic (Ys II) OR Toggle Full Exploration Map & Quest Log (Ys I)
    if (this.input.secondaryJustPressed) {
      if (this.variant === 'ys2' && this.unlockedMagic.size > 0) {
        this.castYs2Magic();
      } else {
        this.showFullMap = !this.showFullMap;
        sfx.playPellet();
      }
    }

    // Auto-open Treasure Chests on direct contact with their solid rim
    for (const ch of zone.chests) {
      if (this.openedChests.has(ch.id)) continue;
      const cx = (ch.tx + 0.5) * TILE;
      const cy = (ch.ty + 0.5) * TILE;
      if (Math.hypot(this.px - cx, this.py - cy) < 34) {
        this.openChest(ch);
      }
    }

    // Check Wide Zone Portals & Building Doorways (with cooldown so you NEVER bounce back!)
    if (this.portalCooldown <= 0) {
      for (const p of zone.portals) {
        const minX = p.tx * TILE - 8;
        const maxX = (p.tx + p.widthTiles) * TILE + 8;
        const minY = p.ty * TILE - 8;
        const maxY = (p.ty + p.heightTiles) * TILE + 8;
        if (this.px >= minX && this.px <= maxX && this.py >= minY && this.py <= maxY) {
          if (p.requiredFlag && !this.flags.has(p.requiredFlag)) {
            this.dialogue = {
              speaker: 'ANCIENT BARRIER',
              portrait: 'adol',
              lines: [p.lockedMessage ?? 'This passage is sealed!'],
              cursor: 0,
            };
            this.portalCooldown = 0.65;
            spawnBurst(this.particles, this.px, this.py, '#f43f5e', 12, 110, 2.8);
            this.threeRenderer?.spawnGpuBurst(this.px, this.py, '#f43f5e', 14, 3.0);
            // Gently step back away from the sealed gate
            if (p.direction === 'north') this.py += 38;
            else if (p.direction === 'south') this.py -= 38;
          } else {
            sfx.playPowerup();
            this.enterZone(p.targetZone, p.destTx, p.destTy, true);
          }
          break;
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Interactive Rustling Shrubs — Walk / Jump In OR Press Action to Investigate!
  // ---------------------------------------------------------------------------
  private stepShrubs(dt: number, zone: ZoneDef): void {
    let activeShrub: string | null = null;
    for (const sh of zone.shrubs) {
      if (sh.rustleCooldown > 0) sh.rustleCooldown = Math.max(0, sh.rustleCooldown - dt);
      if (sh.shakeAmp > 0.01) {
        sh.shakePhase += dt * 26;
        sh.shakeAmp *= Math.exp(-5.2 * dt);
      } else {
        sh.shakeAmp = 0;
      }

      const sx = (sh.tx + 0.5) * TILE;
      const sy = (sh.ty + 0.52) * TILE;
      const dist = Math.hypot(this.px - sx, this.py - sy);
      if (dist < 24) {
        activeShrub = sh.id;
        // Jumping / walking into the shrub makes it rustle, burst leaves, and investigate!
        if (sh.rustleCooldown <= 0) {
          this.triggerShrubRustle(sh, zone, true);
        }
      }
    }
    this.inShrubId = activeShrub;
  }

  private triggerShrubRustle(sh: WorldShrub, zone: ZoneDef, autoWalkIn: boolean): void {
    const sx = (sh.tx + 0.5) * TILE;
    const sy = (sh.ty + 0.5) * TILE;
    sh.shakeAmp = 1.0;
    sh.rustleCooldown = 0.85;

    // Burst fluttering leaves & blossom petals!
    const leafCol =
      sh.variant === 'blossom'
        ? '#f472b6'
        : sh.variant === 'frost_bush'
          ? '#7dd3fc'
          : sh.variant === 'ember_fern'
            ? '#fb923c'
            : '#4ade80';
    spawnBurst(this.particles, sx, sy - 6, leafCol, 10, 95, 3.0);
    this.threeRenderer?.spawnGpuBurst(sx, sy, leafCol, 12, 3.1);
    if (sh.variant === 'blossom' || sh.variant === 'berry') {
      spawnBurst(this.particles, sx, sy - 6, '#fde047', 4, 75, 2.2);
      this.threeRenderer?.spawnGpuBurst(sx, sy, '#fde047', 6, 2.8);
    }
    sfx.playPellet();

    if (sh.searched) {
      if (!autoWalkIn) {
        this.popups.push({ x: sx, y: sy - 20, text: '*rustle*', color: '#86efac', life: 0.7, maxLife: 0.7 });
      }
      return;
    }

    sh.searched = true;
    if (sh.hiddenKind === 'nothing') {
      this.popups.push({ x: sx, y: sy - 20, text: '*rustle*', color: '#86efac', life: 0.75, maxLife: 0.75 });
      return;
    }

    this.secretsFound++;
    this.addScore(150);

    if (sh.hiddenKind === 'gold') {
      const amt = sh.hiddenAmount ?? 45;
      this.gold += amt;
      sfx.playCoin();
      spawnBurst(this.particles, sx, sy, '#fde047', 16, 130, 3.2);
      this.threeRenderer?.spawnGpuBurst(sx, sy, '#fde047', 20, 3.8);
      this.popups.push({ x: sx, y: sy - 24, text: `+${amt} GOLD!`, color: '#fde047', life: 1.3, maxLife: 1.3 });
    } else if (sh.hiddenKind === 'herb') {
      this.herbs++;
      sfx.playPowerup();
      spawnBurst(this.particles, sx, sy, '#4ade80', 16, 125, 3.1);
      this.threeRenderer?.spawnGpuBurst(sx, sy, '#4ade80', 20, 3.6);
      this.popups.push({ x: sx, y: sy - 24, text: 'FOUND HEAL HERB!', color: '#4ade80', life: 1.4, maxLife: 1.4 });
    } else if (sh.hiddenKind === 'seed') {
      this.maxHp += 10;
      this.hp = Math.min(this.maxHp, this.hp + 20);
      sfx.playStageClear();
      spawnBurst(this.particles, sx, sy, '#38bdf8', 20, 145, 3.4);
      this.threeRenderer?.spawnGpuBurst(sx, sy, '#38bdf8', 24, 4.0);
      this.popups.push({ x: sx, y: sy - 26, text: sh.rewardName ?? '+10 MAX HP!', color: '#38bdf8', life: 1.6, maxLife: 1.6 });
    } else if (sh.hiddenKind === 'quest_item') {
      if (sh.grantFlag) this.flags.add(sh.grantFlag);
      sfx.playStageClear();
      spawnBurst(this.particles, sx, sy, '#38bdf8', 24, 165, 3.6);
      this.threeRenderer?.spawnGpuBurst(sx, sy, '#38bdf8', 26, 4.4);
      this.threeRenderer?.spawnGpuBurst(sx, sy, '#fde047', 18, 3.6);
      this.dialogue = {
        speaker: 'DISCOVERY IN THE SHRUB!',
        portrait: 'adol',
        lines: [
          `You part the rustling foliage and discover: ${sh.rewardName ?? 'Mysterious Relic'}!`,
          this.variant === 'ys1'
            ? 'Bring Sara’s Sapphire Crystal inside Sara’s Fortune Parlor (NW) in Minea Town!'
            : 'Bring the rare Celceta Blossom inside Lilia’s Cottage (NW) in Lance Village!',
        ],
        cursor: 0,
      };
    } else if (sh.hiddenKind === 'clue' && sh.clueText) {
      sfx.playPowerup();
      spawnBurst(this.particles, sx, sy, '#fde047', 14, 115, 2.8);
      this.threeRenderer?.spawnGpuBurst(sx, sy, '#fde047', 16, 3.2);
      this.dialogue = {
        speaker: 'INVESTIGATION CLUE',
        portrait: 'adol',
        lines: [sh.clueText],
        cursor: 0,
      };
    } else if (sh.hiddenKind === 'slime' && !zone.safeZone) {
      sfx.playBounce();
      spawnBurst(this.particles, sx, sy, '#f97316', 14, 125, 3.0);
      this.threeRenderer?.spawnGpuBurst(sx, sy, '#f97316', 16, 3.5);
      this.enemies.push(this.createEnemy('slime', sx + 22, sy));
      this.popups.push({ x: sx, y: sy - 24, text: 'WILD SLIME LEAPED OUT!', color: '#f97316', life: 1.3, maxLife: 1.3 });
    }
  }

  private initNpcStates(zone: ZoneDef): void {
    this.npcStates.clear();
    for (let i = 0; i < zone.npcs.length; i++) {
      const npc = zone.npcs[i];
      const firstWp = npc.waypoints?.[0];
      const startX = (npc.tx + 0.5) * TILE;
      const startY = (npc.ty + 0.5) * TILE;
      this.npcStates.set(npc.id, {
        x: startX,
        y: startY,
        angle: firstWp?.faceAngle ?? Math.PI * 0.5,
        speedFrac: 0,
        walkAnim: i * 1.37,
        wpIdx: npc.waypoints && npc.waypoints.length > 1 ? 1 : 0,
        waitTimer: firstWp?.waitSec ? Math.min(firstWp.waitSec, 0.8 + (i % 4) * 0.9) : 0,
        working: Boolean(firstWp?.performTask),
        workPhase: i * 1.1,
        taskLabel: firstWp?.activityLabel ?? '',
        fxCooldown: 0.6 + (i % 5) * 0.25,
        behaviorMode: 'routine',
        headLookYaw: 0,
        springOffsetY: 0,
        springVelY: 0,
        talking: false,
        behaviorTimer: 0,
        behaviorCooldown: 2.5 + (i % 5) * 1.4,
      });
    }
  }

  private getNpcWorldPos(npc: WorldNpc): { x: number; y: number } {
    const st = this.npcStates.get(npc.id);
    if (st) return { x: st.x, y: st.y };
    return { x: (npc.tx + 0.5) * TILE, y: (npc.ty + 0.5) * TILE };
  }

  private stepNpcFacing(dt: number, zone: ZoneDef): void {
    const dayMeta = this.getDayTimeMeta();
    const isNight = dayMeta.period === 'NIGHT';
    const isEvening = dayMeta.period === 'EVENING';
    const isOutdoor = zone.theme !== 'interior' && zone.theme !== 'shrine' && zone.theme !== 'tower' && zone.theme !== 'lava';
    const isRainyOutdoor = isOutdoor && (this.weather === 'rain' || this.weather === 'storm');
    const activeSpeakerId = this.dialogue?.speakerNpc?.id ?? null;

    for (const npc of zone.npcs) {
      let st = this.npcStates.get(npc.id);
      if (!st) {
        st = {
          x: (npc.tx + 0.5) * TILE,
          y: (npc.ty + 0.5) * TILE,
          angle: Math.PI * 0.5,
          speedFrac: 0,
          walkAnim: 0,
          wpIdx: 0,
          waitTimer: 0,
          working: false,
          workPhase: 0,
          taskLabel: '',
          fxCooldown: 0.8,
          behaviorMode: 'routine',
          headLookYaw: 0,
          springOffsetY: 0,
          talking: false,
          behaviorTimer: 0,
          behaviorCooldown: 3.0,
          springVelY: 0,
        };
        this.npcStates.set(npc.id, st);
      }

      // Vertical Spring-Damper Bounce Physics for lively hops, reactions & greetings!
      const curSpringY = st.springOffsetY ?? 0;
      const springAccel = -92 * curSpringY - 10.5 * st.springVelY;
      st.springVelY += springAccel * dt;
      let nextSpringY = curSpringY + st.springVelY * dt;
      if (nextSpringY < 0) {
        nextSpringY = 0;
        if (Math.abs(st.springVelY) > 0.35) st.springVelY = -st.springVelY * 0.28;
        else st.springVelY = 0;
      }
      st.springOffsetY = nextSpringY;

      const distToPlayer = Math.hypot(this.px - st.x, this.py - st.y);
      const isDialogueSpeaker = activeSpeakerId === npc.id;
      const talkingOrNear = this.phase === 'PLAYING' && (isDialogueSpeaker || distToPlayer < 64);
      const isChild = npc.ageGroup === 'child' || npc.task === 'play';
      const waypoints = npc.waypoints;

      st.talking = isDialogueSpeaker;
      if (st.behaviorCooldown > 0) st.behaviorCooldown = Math.max(0, st.behaviorCooldown - dt);

      // Natural Head-Tracking toward Adol when passing nearby (< 3.6 tiles)!
      const desiredHeadYaw =
        this.phase === 'PLAYING' && distToPlayer < 160 && !isDialogueSpeaker
          ? Math.max(-0.68, Math.min(0.68, normalizeAngle(Math.atan2(this.py - st.y, this.px - st.x) - st.angle)))
          : 0;
      st.headLookYaw = (st.headLookYaw ?? 0) + (desiredHeadYaw - (st.headLookYaw ?? 0)) * Math.min(1, dt * 6.5);

      // Update active spontaneous social/physics behavior timers
      if (st.behaviorTimer > 0) {
        st.behaviorTimer = Math.max(0, st.behaviorTimer - dt);
        if (st.behaviorTimer <= 0) {
          st.behaviorMode = 'routine';
          st.chatPartnerId = undefined;
          st.behaviorCooldown = 5.0 + Math.random() * 6.5;
        }
      }

      // Friendly wave when Adol walks within greeting distance!
      if (
        !isDialogueSpeaker &&
        this.phase === 'PLAYING' &&
        distToPlayer > 54 &&
        distToPlayer < 138 &&
        st.behaviorMode === 'routine' &&
        st.behaviorCooldown <= 0 &&
        Math.random() < dt * 0.75
      ) {
        st.behaviorMode = 'wave';
        st.behaviorTimer = 1.9;
        st.behaviorCooldown = 9.0;
        st.springVelY = isChild ? 2.4 : 1.35;
      }

      // Spontaneous NPC-to-NPC Pair Chatting when two townsfolk pass within 2.5 tiles!
      if (
        !isDialogueSpeaker &&
        st.behaviorMode === 'routine' &&
        st.behaviorCooldown <= 0 &&
        !isRainyOutdoor &&
        distToPlayer > 72 &&
        Math.random() < dt * (dayMeta.isMarketDay || isEvening ? 0.55 : 0.32)
      ) {
        for (const other of zone.npcs) {
          if (other.id === npc.id || other.id === activeSpeakerId) continue;
          const ost = this.npcStates.get(other.id);
          if (!ost || ost.behaviorMode !== 'routine' || ost.behaviorCooldown > 0) continue;
          if (Math.hypot(ost.x - st.x, ost.y - st.y) < 112) {
            const dur = 3.2 + Math.random() * 2.4;
            st.behaviorMode = 'chat_pair';
            st.behaviorTimer = dur;
            st.chatPartnerId = other.id;
            st.springVelY = 1.1;
            ost.behaviorMode = 'chat_pair';
            ost.behaviorTimer = dur;
            ost.chatPartnerId = npc.id;
            ost.springVelY = 1.1;
            break;
          }
        }
      }

      // Active dialogue speaker: face Adol cleanly & animate expressive conversation!
      if (isDialogueSpeaker) {
        st.speedFrac = Math.max(0, st.speedFrac - dt * 8);
        st.working = false;
        st.behaviorMode = 'routine';
        const targetA = Math.atan2(this.py - st.y, this.px - st.x);
        st.angle = lerpAngle(st.angle, targetA, dt * 10);
        this.bodyAngle = lerpAngle(this.bodyAngle, Math.atan2(st.y - this.py, st.x - this.px), dt * 10);
        this.npcAngles.set(npc.id, st.angle);
        continue;
      }

      // Pair-Chatting Pause: turn toward partner & nod/gesture!
      if (st.behaviorMode === 'chat_pair' && st.chatPartnerId) {
        const partner = this.npcStates.get(st.chatPartnerId);
        if (partner) {
          st.speedFrac = Math.max(0, st.speedFrac - dt * 6);
          st.working = false;
          st.taskLabel = dayMeta.isMarketDay ? 'Market chat' : 'Chatting';
          st.angle = lerpAngle(st.angle, Math.atan2(partner.y - st.y, partner.x - st.x), dt * 7);
          this.npcAngles.set(npc.id, st.angle);
          continue;
        }
      }

      // Routine-Driven Speed & Rest Modifiers (Time of Day + Day of Week + Weather!)
      let routineSpeedMult = 1.0;
      if (isRainyOutdoor) {
        routineSpeedMult = isChild ? 1.25 : 1.32;
        if (st.behaviorMode === 'routine') {
          st.behaviorMode = isChild ? 'hop' : 'shelter';
          st.behaviorTimer = isChild ? 0.9 : 1.4;
          if (isChild && (st.springOffsetY ?? 0) < 0.02) st.springVelY = 2.8;
        }
      } else if (isNight) {
        routineSpeedMult = npc.task === 'patrol' ? 1.14 : isChild ? 0.55 : 0.7;
      } else if (dayMeta.isMarketDay) {
        routineSpeedMult = 1.12;
      } else if (dayMeta.period === 'MORNING') {
        routineSpeedMult = 1.08;
      }

      if (waypoints && waypoints.length > 0) {
        const wp = waypoints[st.wpIdx % waypoints.length];
        if (talkingOrNear) {
          // Politely pause and turn toward Adol when the player approaches!
          st.speedFrac = Math.max(0, st.speedFrac - dt * 6);
          st.working = false;
          const target = Math.atan2(this.py - st.y, this.px - st.x);
          st.angle = lerpAngle(st.angle, target, dt * 8);
        } else if (st.waitTimer > 0) {
          st.waitTimer -= dt;
          st.speedFrac = Math.max(0, st.speedFrac - dt * 6);
          const prevIdx = (st.wpIdx - 1 + waypoints.length) % waypoints.length;
          const stationWp = waypoints[prevIdx];
          st.working = Boolean(stationWp.performTask) && !isNight;
          st.taskLabel = isNight && npc.task !== 'patrol' ? 'Evening rest' : (stationWp.activityLabel ?? '');
          if (stationWp.faceAngle !== undefined) {
            const lookSweep = npc.task === 'patrol' ? Math.sin(st.workPhase * 0.55) * 0.65 : 0;
            st.angle = lerpAngle(st.angle, stationWp.faceAngle + lookSweep, dt * 5);
          }

          // Random idle physical behaviors: stretch, look around, or joyful child hop!
          if (st.behaviorMode === 'routine' && st.behaviorCooldown <= 0 && Math.random() < dt * 0.45) {
            const roll = Math.random();
            if (isChild && roll < 0.6) {
              st.behaviorMode = 'hop';
              st.behaviorTimer = 1.0;
              st.springVelY = 3.1;
            } else if (roll < 0.5) {
              st.behaviorMode = 'stretch';
              st.behaviorTimer = 2.1;
            } else {
              st.behaviorMode = 'look_around';
              st.behaviorTimer = 2.4;
            }
          }

          if (st.working) {
            st.workPhase += dt * 4.4;
            st.fxCooldown -= dt;
            if (st.fxCooldown <= 0) {
              if (npc.task === 'hammer') {
                st.fxCooldown = 0.82;
                this.threeRenderer?.spawnGpuBurst(
                  st.x + Math.cos(st.angle) * 14,
                  st.y + Math.sin(st.angle) * 14,
                  '#facc15',
                  7,
                  2.4
                );
              } else if (npc.task === 'water_carry' || npc.task === 'garden') {
                st.fxCooldown = 0.72;
                this.threeRenderer?.spawnGpuBurst(
                  st.x + Math.cos(st.angle) * 14,
                  st.y + Math.sin(st.angle) * 14,
                  '#7dd3fc',
                  6,
                  1.9
                );
              } else if (npc.task === 'sweep') {
                st.fxCooldown = 0.95;
                this.threeRenderer?.spawnGpuBurst(
                  st.x + Math.cos(st.angle) * 12,
                  st.y + Math.sin(st.angle) * 12,
                  '#fde68a',
                  4,
                  1.4
                );
              } else if (npc.task === 'fish') {
                st.fxCooldown = 1.85;
                this.threeRenderer?.spawnGpuBurst(
                  st.x + Math.cos(st.angle) * 44,
                  st.y + Math.sin(st.angle) * 44,
                  '#bae6fd',
                  5,
                  1.6
                );
              } else {
                st.fxCooldown = 1.5;
              }
            }
          }
        } else {
          // Walk smoothly toward next waypoint along the town route!
          const tx = (wp.tx + 0.5) * TILE;
          const ty = (wp.ty + 0.5) * TILE;
          const dx = tx - st.x;
          const dy = ty - st.y;
          const d = Math.hypot(dx, dy);
          const moveSpeed = (npc.walkSpeed ?? 1.45) * routineSpeedMult * TILE;
          if (d <= Math.max(4, moveSpeed * dt)) {
            st.x = tx;
            st.y = ty;
            const waitMult = isRainyOutdoor ? 0.6 : isNight ? 1.45 : 1.0;
            st.waitTimer = (wp.waitSec ?? 2.2) * waitMult;
            st.working = Boolean(wp.performTask) && !isNight;
            st.taskLabel = isRainyOutdoor ? (isChild ? 'Puddle play!' : 'Seeking cover') : (wp.activityLabel ?? '');
            st.wpIdx = (st.wpIdx + 1) % waypoints.length;
          } else {
            const step = moveSpeed * dt;
            st.x += (dx / d) * step;
            st.y += (dy / d) * step;
            st.angle = lerpAngle(st.angle, Math.atan2(dy, dx), dt * 8);
            st.speedFrac = Math.min(1, st.speedFrac + dt * 5);
            st.walkAnim += dt * (npc.walkSpeed ?? 1.45) * routineSpeedMult * 4.4;
            st.working = false;
            st.taskLabel = isRainyOutdoor ? (isChild ? 'Splashing!' : 'Hurrying') : (wp.activityLabel ?? '');
          }
        }
      } else {
        const cur = this.npcAngles.get(npc.id) ?? Math.PI * 0.5;
        const target = distToPlayer < 130 ? Math.atan2(this.py - st.y, this.px - st.x) : Math.PI * 0.5;
        st.angle = lerpAngle(cur, target, dt * 7);
        st.speedFrac = 0;
        st.working = false;
        if (st.behaviorMode === 'routine' && st.behaviorCooldown <= 0 && distToPlayer > 75 && Math.random() < dt * 0.28) {
          st.behaviorMode = Math.random() < 0.5 ? 'stretch' : 'look_around';
          st.behaviorTimer = 2.2;
        }
      }

      this.npcAngles.set(npc.id, st.angle);
    }
  }

  private stepForageNodes(dt: number, zone: ZoneDef): void {
    const nodes = zone.forageNodes;
    if (!nodes || nodes.length === 0) return;
    for (const node of nodes) {
      if (!node.gathered) continue;
      node.respawnTimer = Math.max(0, (node.respawnTimer ?? 0) - dt);
      if (node.respawnTimer <= 0) {
        node.gathered = false;
        this.threeRenderer?.syncForageNodeState(node.id, false);
      }
    }
  }

  private findNearestInteractable(zone: ZoneDef): InteractTarget | null {
    let best: InteractTarget | null = null;
    let bestDist = 56;

    for (const npc of zone.npcs) {
      const { x, y } = this.getNpcWorldPos(npc);
      const d = Math.hypot(this.px - x, this.py - y);
      if (d < bestDist) {
        bestDist = d;
        best = { kind: 'npc', x, y, label: `TALK · ${npc.name}`, npc };
      }
    }

    for (const st of zone.craftStations ?? []) {
      const x = (st.tx + 0.5) * TILE;
      const y = (st.ty + 0.5) * TILE;
      const d = Math.hypot(this.px - x, this.py - y);
      const reach = 74;
      if (d < reach && d < bestDist + 18) {
        bestDist = Math.min(bestDist, d);
        const verb = st.stationKind === 'forge' ? 'FORGE' : st.stationKind === 'alchemy' ? 'BREW' : 'COOK';
        best = { kind: 'station', x, y, label: `${verb} · ${st.title}`, station: st };
      }
    }

    for (const fn of zone.forageNodes ?? []) {
      if (fn.gathered) continue;
      const x = (fn.tx + 0.5) * TILE;
      const y = (fn.ty + 0.5) * TILE;
      const d = Math.hypot(this.px - x, this.py - y);
      if (d < Math.min(bestDist, 52)) {
        bestDist = d;
        const meta = FORAGE_META[fn.itemId];
        best = { kind: 'forage', x, y, label: `GATHER · ${meta.name}`, forage: fn };
      }
    }

    for (const obj of zone.inspectables) {
      const x = (obj.tx + 0.5) * TILE;
      const y = (obj.ty + 0.5) * TILE;
      const d = Math.hypot(this.px - x, this.py - y);
      const reach = obj.kind === 'fountain' ? 114 : 58;
      if (d < reach && (d < bestDist || obj.kind === 'fountain')) {
        bestDist = Math.min(bestDist, d);
        const verb =
          obj.kind === 'sign' || obj.kind === 'tablet' || obj.kind === 'noticeboard' || obj.kind === 'bookshelf'
            ? 'READ'
            : obj.kind === 'bell'
              ? 'RING'
              : obj.kind === 'telescope'
                ? 'LOOK'
                : 'INSPECT';
        best = { kind: 'inspect', x, y, label: `${verb} · ${obj.title}`, inspectable: obj };
      }
    }

    for (const ch of zone.chests) {
      if (this.openedChests.has(ch.id)) continue;
      const x = (ch.tx + 0.5) * TILE;
      const y = (ch.ty + 0.5) * TILE;
      const d = Math.hypot(this.px - x, this.py - y);
      if (d < bestDist) {
        bestDist = d;
        best = { kind: 'chest', x, y, label: 'OPEN CHEST', chest: ch };
      }
    }

    for (const sh of zone.shrubs) {
      const x = (sh.tx + 0.5) * TILE;
      const y = (sh.ty + 0.5) * TILE;
      const d = Math.hypot(this.px - x, this.py - y);
      if (d < Math.min(bestDist, 42)) {
        bestDist = d;
        best = { kind: 'shrub', x, y, label: sh.searched ? 'RUSTLE SHRUB' : 'SEARCH SHRUB', shrub: sh };
      }
    }

    return best;
  }

  private tryInteract(zone: ZoneDef): boolean {
    const target = this.nearestInteract;
    if (!target) return false;

    if (target.kind === 'npc' && target.npc) {
      const npc = target.npc;
      sfx.playPellet();
      // Face the NPC smoothly & emit celebratory greeting sparkles!
      this.bodyAngle = Math.atan2(target.y - this.py, target.x - this.px);
      const talkCol = npc.role === 'quest' ? '#fde047' : '#38bdf8';
      spawnBurst(this.particles, target.x, target.y - 10, talkCol, 12, 95, 2.6);
      this.threeRenderer?.spawnGpuBurst(target.x, target.y, talkCol, 14, 3.0);

      let text = npc.greeting;
      if (npc.followUpFlag && this.flags.has(npc.followUpFlag) && npc.followUpGreeting) {
        text = npc.followUpGreeting;
        if (npc.grantFlag && !this.flags.has(npc.grantFlag)) {
          this.flags.add(npc.grantFlag);
          const pts = npc.rewardPoints ?? 500;
          if (npc.rewardGold) {
            this.gold += npc.rewardGold;
            this.addScore(pts);
            sfx.playStageClear();
            spawnBurst(this.particles, target.x, target.y, '#fde047', 24, 155, 3.4);
            this.threeRenderer?.spawnGpuBurst(target.x, target.y, '#fde047', 28, 4.2);
            this.threeRenderer?.spawnGpuBurst(this.px, this.py, '#38bdf8', 16, 3.4);
            this.popups.push({
              x: target.x,
              y: target.y - 28,
              text: `+${npc.rewardGold}G · +${pts} PTS!`,
              color: '#fde047',
              life: 1.8,
              maxLife: 1.8,
            });
          }
        }
      }

      const stTalk = this.npcStates.get(npc.id);
      if (stTalk) {
        stTalk.talking = true;
        stTalk.springVelY = 1.45;
      }
      const meta = this.getDayTimeMeta();
      const lines: string[] = [text];
      if (npc.role === 'villager' && zone.theme !== 'interior') {
        if (this.weather === 'rain' || this.weather === 'storm') {
          lines.push(`"Quite a ${this.weather} this ${meta.dayFull} ${meta.period.toLowerCase()}—stay warm under the eaves!"`);
        } else if (this.weather === 'snow') {
          lines.push(`"Watch the snowfall this ${meta.dayFull}! The streetlamps look magical tonight."`);
        } else if (meta.period === 'NIGHT') {
          lines.push(`"Good evening, traveler! The town lanterns keep the ${meta.dayFull} night bright."`);
        } else if (meta.isMarketDay) {
          lines.push(`"Happy ${meta.dayFull} Market Day! The plaza and bakery are bustling today!"`);
        }
      }

      this.dialogue = {
        speaker: npc.name,
        portrait: npc.portrait,
        lines,
        shopKind: npc.role === 'quest' || npc.role === 'villager' ? undefined : npc.role,
        cursor: 0,
        speakerNpc: npc,
        focusPos: { x: target.x, y: target.y },
      };
      return true;
    }

    if (target.kind === 'inspect' && target.inspectable) {
      const obj = target.inspectable;
      this.bodyAngle = Math.atan2(target.y - this.py, target.x - this.px);
      sfx.playPowerup();

      // Themed 3D GPU + 2D Particle Burst for EVERY Object Inspection!
      const inspectCol =
        obj.kind === 'anvil' || obj.kind === 'campfire'
          ? '#fb923c'
          : obj.kind === 'fountain' || obj.kind === 'well' || obj.kind === 'telescope' || obj.kind === 'statue'
            ? '#38bdf8'
            : '#fde047';
      spawnBurst(this.particles, target.x, target.y - 8, inspectCol, 18, 125, 3.0);
      this.threeRenderer?.spawnGpuBurst(target.x, target.y, inspectCol, 22, 3.6);

      if (!obj.inspected) {
        obj.inspected = true;
        this.secretsFound++;
        const pts = obj.rewardPoints ?? 200;
        this.addScore(pts);
        if (obj.grantFlag) this.flags.add(obj.grantFlag);
        if (obj.rewardGold) {
          this.gold += obj.rewardGold;
          sfx.playCoin();
          spawnBurst(this.particles, target.x, target.y, '#fde047', 16, 135, 3.2);
          this.threeRenderer?.spawnGpuBurst(target.x, target.y, '#fde047', 20, 4.0);
          this.popups.push({
            x: target.x,
            y: target.y - 24,
            text: `+${obj.rewardGold}G · +${pts} PTS!`,
            color: '#fde047',
            life: 1.5,
            maxLife: 1.5,
          });
        } else if (obj.rewardPoints) {
          this.popups.push({
            x: target.x,
            y: target.y - 24,
            text: `+${pts} QUEST PTS!`,
            color: '#38bdf8',
            life: 1.4,
            maxLife: 1.4,
          });
        }
      }
      if (obj.healMp) {
        this.hp = this.maxHp;
        this.mp = this.maxMp;
        spawnBurst(this.particles, this.px, this.py, '#38bdf8', 18, 130, 3.2);
        this.threeRenderer?.spawnGpuBurst(this.px, this.py, '#38bdf8', 22, 3.6);
        this.threeRenderer?.spawnGpuBurst(this.px, this.py, '#4ade80', 14, 3.0);
      }

      this.dialogue = {
        speaker: obj.title,
        portrait: 'adol',
        lines: obj.lines,
        cursor: 0,
        focusPos: { x: target.x, y: target.y },
      };
      return true;
    }

    if (target.kind === 'station' && target.station) {
      const st = target.station;
      this.bodyAngle = Math.atan2(target.y - this.py, target.x - this.px);
      sfx.playPowerup();
      const burstCol = st.stationKind === 'forge' ? '#fb923c' : st.stationKind === 'alchemy' ? '#34d399' : '#facc15';
      spawnBurst(this.particles, target.x, target.y - 10, burstCol, 18, 125, 3.0);
      this.threeRenderer?.spawnGpuBurst(target.x, target.y, burstCol, 22, 3.6);
      this.dialogue = {
        speaker: st.title,
        portrait: 'adol',
        lines: [st.subtitle, this.getBagSummaryLine()],
        shopKind: st.stationKind,
        cursor: 0,
        focusPos: { x: target.x, y: target.y },
      };
      return true;
    }

    if (target.kind === 'forage' && target.forage) {
      const fn = target.forage;
      if (fn.gathered) return false;
      this.bodyAngle = Math.atan2(target.y - this.py, target.x - this.px);
      fn.gathered = true;
      fn.respawnTimer = 45;
      this.threeRenderer?.syncForageNodeState(fn.id, true);
      const qty = Math.max(1, fn.amount);
      this.forageBag[fn.itemId] = (this.forageBag[fn.itemId] ?? 0) + qty;
      this.totalForaged += qty;
      this.addScore(45 * qty);
      const meta = FORAGE_META[fn.itemId];
      sfx.playCoin();
      spawnBurst(this.particles, target.x, target.y - 6, meta.color, 16, 120, 2.8);
      this.threeRenderer?.spawnGpuBurst(target.x, target.y, meta.color, 18, 3.4);
      this.popups.push({
        x: target.x,
        y: target.y - 22,
        text: `+${qty} ${meta.name}!`,
        color: meta.color,
        life: 1.5,
        maxLife: 1.5,
      });
      return true;
    }

    if (target.kind === 'chest' && target.chest) {
      this.openChest(target.chest);
      return true;
    }

    if (target.kind === 'shrub' && target.shrub) {
      this.triggerShrubRustle(target.shrub, zone, false);
      return true;
    }

    return false;
  }

  private openChest(ch: WorldChest): void {
    this.openedChests.add(ch.id);
    ch.opened = true;
    const cx = (ch.tx + 0.5) * TILE;
    const cy = (ch.ty + 0.5) * TILE;
    spawnBurst(this.particles, cx, cy, '#fde047', 24, 165, 3.6);
    this.threeRenderer?.spawnGpuBurst(cx, cy, '#fde047', 28, 4.3);
    this.threeRenderer?.spawnGpuBurst(cx, cy, '#38bdf8', 16, 3.4);
    sfx.playPowerup();

    if (ch.rewardKind === 'gold') {
      this.gold += ch.amount ?? 150;
    } else if (ch.rewardKind === 'book') {
      this.booksCollected = Math.min(this.totalBooks, this.booksCollected + 1);
      this.addScore(1500);
    } else if (ch.rewardKind === 'silver_sword') {
      this.weaponTier = Math.max(this.weaponTier, this.variant === 'ys2' ? 4 : 3);
      this.addScore(2000);
    } else if (ch.rewardKind === 'silver_armor') {
      this.armorTier = Math.max(this.armorTier, this.variant === 'ys2' ? 4 : 3);
      this.addScore(2000);
    } else if (ch.rewardKind === 'fire_ring') {
      this.unlockedMagic.add('fire');
      this.equippedRing = 'power';
      this.maxMp += 15;
      this.mp = this.maxMp;
    } else if (ch.rewardKind === 'shield_ring') {
      this.unlockedMagic.add('shield');
      this.equippedRing = 'shield';
    } else if (ch.rewardKind === 'time_ring') {
      this.unlockedMagic.add('time');
      this.equippedRing = 'time';
    } else if (ch.rewardKind === 'herb') {
      this.herbs++;
    }
    if (ch.grantFlag) this.flags.add(ch.grantFlag);

    this.popups.push({ x: cx, y: cy - 20, text: ch.rewardName, color: '#fde047', life: 1.5, maxLife: 1.5 });
  }

  private castYs2Magic(): void {
    if (this.magicCd > 0) return;
    if (this.mp < 6) {
      this.popups.push({ x: this.px, y: this.py - 22, text: 'LOW MP!', color: '#94a3b8', life: 0.8, maxLife: 0.8 });
      return;
    }
    this.mp = Math.max(0, this.mp - 6);
    this.magicCd = 0.28;
    const baseAngle = this.bodyAngle;
    const angles = this.unlockedMagic.has('time') ? [-0.22, 0, 0.22] : [0];
    for (const off of angles) {
      const a = baseAngle + off;
      this.projectiles.push({
        x: this.px + Math.cos(a) * 18,
        y: this.py + Math.sin(a) * 18,
        vx: Math.cos(a) * 370,
        vy: Math.sin(a) * 370,
        fromPlayer: true,
        damage: Math.round(this.getEffectiveAtk() * 0.92),
        color: '#f97316',
        radius: 8,
        life: 1.35,
      });
    }
    spawnBurst(this.particles, this.px + Math.cos(baseAngle) * 14, this.py + Math.sin(baseAngle) * 14, '#fb923c', 12, 110, 2.8);
    this.threeRenderer?.spawnGpuBurst(this.px + Math.cos(baseAngle) * 14, this.py + Math.sin(baseAngle) * 14, '#fb923c', 16, 3.4);
    if (this.unlockedMagic.has('shield') && this.shieldAuraTimer <= 0) {
      this.shieldAuraTimer = 3.5;
      this.threeRenderer?.spawnGpuBurst(this.px, this.py, '#38bdf8', 14, 3.0);
    }
    sfx.playShoot();
  }

  private stepProjectiles(dt: number, zone: ZoneDef): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;

      if (p.life <= 0 || this.isPointBlocked(zone, p.x, p.y)) {
        spawnBurst(this.particles, p.x, p.y, p.color, 8, 90, 2.4);
        this.threeRenderer?.spawnGpuBurst(p.x, p.y, p.color, 10, 2.8);
        this.projectiles.splice(i, 1);
        continue;
      }

      if (p.fromPlayer) {
        let hit = false;
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          const r = e.kind === 'boss' ? 34 : 21;
          if (Math.hypot(p.x - e.x, p.y - e.y) < r) {
            this.damageEnemy(e, p.damage, p.vx, p.vy);
            this.threeRenderer?.spawnGpuBurst(p.x, p.y, p.color, 14, 3.5);
            hit = true;
            break;
          }
        }
        if (hit) this.projectiles.splice(i, 1);
      } else {
        if (Math.hypot(p.x - this.px, p.y - this.py) < 18) {
          this.damagePlayer(p.damage);
          this.threeRenderer?.spawnGpuBurst(p.x, p.y, p.color, 12, 3.2);
          this.projectiles.splice(i, 1);
        }
      }
    }
  }

  private stepEnemies(dt: number, zone: ZoneDef): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.hp <= 0) {
        this.enemies.splice(i, 1);
        continue;
      }
      if (e.hitFlash > 0) e.hitFlash -= dt;

      if (Math.hypot(e.knockVx, e.knockVy) > 5) {
        const kx = e.x + e.knockVx * dt;
        const ky = e.y + e.knockVy * dt;
        if (!this.isPointBlocked(zone, kx, ky)) {
          e.x = kx;
          e.y = ky;
        }
        e.knockVx *= Math.max(0, 1 - dt * 10);
        e.knockVy *= Math.max(0, 1 - dt * 10);
      }

      const dx = this.px - e.x;
      const dy = this.py - e.y;
      const dist = Math.hypot(dx, dy);

      if (e.kind === 'boss') {
        e.bossPhaseTimer = (e.bossPhaseTimer ?? 2) - dt;
        if (dist < 420 && dist > 18) {
          const bSpd = e.speed * (this.timeFreezeTimer > 0 ? 0.35 : 1);
          const nx = e.x + (dx / dist) * bSpd * dt;
          const ny = e.y + (dy / dist) * bSpd * dt;
          if (!this.isPointBlocked(zone, nx, e.y)) e.x = nx;
          if (!this.isPointBlocked(zone, e.x, ny)) e.y = ny;
          e.angle = lerpAngle(e.angle, Math.atan2(dy, dx), dt * 8);

          if (e.bossPhaseTimer <= 0) {
            e.bossPhaseTimer = 2.15;
            const bolts = e.bossId === 'darkfact' || e.bossId === 'darm' ? 8 : 5;
            const baseA = Math.atan2(dy, dx);
            for (let b = 0; b < bolts; b++) {
              const a = baseA + (Math.PI * 2 * b) / bolts;
              this.projectiles.push({
                x: e.x,
                y: e.y,
                vx: Math.cos(a) * 195,
                vy: Math.sin(a) * 195,
                fromPlayer: false,
                damage: e.atk,
                color: e.accent,
                radius: 7,
                life: 2.3,
              });
            }
            sfx.playBounce();
          }
        }
      } else {
        e.aiTimer -= dt;
        if (dist < 240 && dist > 1) {
          e.vx = (dx / dist) * e.speed;
          e.vy = (dy / dist) * e.speed;
          if (e.kind === 'mage' && e.aiTimer <= 0) {
            e.aiTimer = 2.6;
            this.projectiles.push({
              x: e.x,
              y: e.y,
              vx: (dx / dist) * 175,
              vy: (dy / dist) * 175,
              fromPlayer: false,
              damage: e.atk,
              color: '#f472b6',
              radius: 6,
              life: 1.9,
            });
          }
        } else if (e.aiTimer <= 0) {
          const a = Math.random() * Math.PI * 2;
          e.vx = Math.cos(a) * e.speed * 0.55;
          e.vy = Math.sin(a) * e.speed * 0.55;
          e.aiTimer = 1.4 + Math.random() * 1.4;
        }
        if (Math.hypot(e.vx, e.vy) > 4) {
          e.angle = lerpAngle(e.angle, Math.atan2(e.vy, e.vx), dt * 9);
        }
        const nx = e.x + e.vx * dt;
        const ny = e.y + e.vy * dt;
        if (!this.isPointBlocked(zone, nx, e.y)) e.x = nx;
        if (!this.isPointBlocked(zone, e.x, ny)) e.y = ny;
      }

      // Authentic Ys OFF-CENTER BUMP COMBAT!
      const hitRad = e.kind === 'boss' ? 34 : 24;
      if (dist < hitRad && e.hitFlash <= 0) {
        const movingInto = this.moveSpeedFrac > 0.12;
        const toEx = (e.x - this.px) / Math.max(1, dist);
        const toEy = (e.y - this.py) / Math.max(1, dist);
        const align = Math.abs(toEx * this.facingX + toEy * this.facingY);
        const offCenterAdvantage = this.lungeTimer > 0 || (movingInto && align < 0.92);

        const dmg = Math.max(4, this.getEffectiveAtk() - Math.floor(e.def * 0.45) + (offCenterAdvantage ? 7 : 0));
        this.slashArcTimer = 0.18;
        this.damageEnemy(e, dmg, toEx * 260, toEy * 260);

        if (!offCenterAdvantage && Math.random() < 0.6) {
          this.damagePlayer(e.atk);
        }
      }
    }
  }

  private damageEnemy(e: WorldEnemy, dmg: number, kx: number, ky: number): void {
    e.hp = Math.max(0, e.hp - dmg);
    e.hitFlash = 0.24;
    e.knockVx = kx;
    e.knockVy = ky;
    this.hitStopTimer = 0.032;
    this.screenShake = Math.max(this.screenShake, e.kind === 'boss' ? 0.32 : 0.16);
    this.engagedEnemy = { name: e.name, hp: e.hp, maxHp: e.maxHp, timer: 4.5 };
    sfx.playEnemyHit();

    // Explosive Chronicles+ cyan-white impact burst + golden jagged lightning arcs + crimson sparks!
    const mx = (this.px + e.x) * 0.5;
    const my = (this.py + e.y) * 0.5;
    this.impactFlashes.push({ x: e.x, y: e.y, radius: e.kind === 'boss' ? 38 : 24, color: '#e0f2fe', life: 0.17, maxLife: 0.17 });
    for (let b = 0; b < 3; b++) {
      this.combatBolts.push({
        x1: this.px + (Math.random() - 0.5) * 8,
        y1: this.py - 8,
        x2: e.x + (Math.random() - 0.5) * 14,
        y2: e.y - 6 + (Math.random() - 0.5) * 10,
        color: b === 0 ? '#fef08a' : '#7dd3fc',
        life: 0.19,
        maxLife: 0.19,
        seed: Math.random() * 100,
      });
    }
    spawnBurst(this.particles, mx, my, '#fef08a', 8, 150, 2.8);
    spawnBurst(this.particles, e.x, e.y, '#ef4444', 6, 130, 2.4);
    this.threeRenderer?.spawnGpuBurst(e.x, e.y, '#fef08a', 14, 4.2);
    this.threeRenderer?.spawnGpuBurst(e.x, e.y, '#38bdf8', 8, 3.6);
    this.popups.push({ x: e.x, y: e.y - 22, text: `-${dmg}`, color: '#fef08a', life: 0.68, maxLife: 0.68 });

    if (e.hp <= 0) {
      this.grantExp(e.exp);
      this.gold += e.gold;
      sfx.playExplosion();
      this.impactFlashes.push({ x: e.x, y: e.y, radius: e.kind === 'boss' ? 62 : 34, color: '#38bdf8', life: 0.26, maxLife: 0.26 });
      spawnBurst(this.particles, e.x, e.y, e.color, e.kind === 'boss' ? 40 : 18, 220, 3.8);
      this.threeRenderer?.spawnGpuBurst(e.x, e.y, e.accent, e.kind === 'boss' ? 48 : 22, 5.2);

      // Authentic Chronicles+ tumbling pixel armor gibs flying upward & bouncing onto the 2.5D ground!
      const gibCount = e.kind === 'boss' ? 14 : 6;
      for (let g = 0; g < gibCount; g++) {
        const ang = (Math.PI * 2 * g) / gibCount + (Math.random() - 0.5) * 0.5;
        const spd = 65 + Math.random() * 95;
        this.armorGibs.push({
          x: e.x + (Math.random() - 0.5) * 10,
          y: e.y + (Math.random() - 0.5) * 8,
          z: 10 + Math.random() * 14,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd * 0.7,
          vz: 140 + Math.random() * 120,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 18,
          w: 6 + Math.floor(Math.random() * 5),
          h: 5 + Math.floor(Math.random() * 5),
          color: g % 2 === 0 ? '#64748b' : e.color,
          rim: g % 2 === 0 ? '#cbd5e1' : e.accent,
          life: 0.85 + Math.random() * 0.35,
          maxLife: 1.2,
        });
      }

      if (e.kind === 'boss') {
        const zone = this.zones[this.currentZoneId];
        const bs = zone.bossSpawn;
        this.activeBoss = null;
        this.screenShake = 0.55;
        sfx.playStageClear();
        if (bs) {
          this.flags.add(bs.defeatFlag);
          this.booksCollected = Math.min(this.totalBooks, this.booksCollected + 1);
          this.addScore(5000);
          if (bs.finalBoss) {
            this.dialogue = {
              speaker: this.variant === 'ys1' ? 'FEENA · BOOK I CLEARED!' : 'LILIA · BOOK II CLEARED!',
              portrait: this.variant === 'ys1' ? 'feena' : 'lilia',
              lines: [
                `Victory! ${bs.name} has been vanquished!`,
                this.variant === 'ys1'
                  ? 'The 6 Books of Ys shine brightly—the sky opens toward Ys Book II!'
                  : 'Peace returns to the Floating Land of Ys! Adol’s legend lives on!',
              ],
              cursor: 0,
            };
          } else {
            this.dialogue = {
              speaker: 'SEAL BROKEN!',
              portrait: 'adol',
              lines: [
                `Defeated ${bs.name}! (+${bs.exp} EXP, +${bs.gold}G)`,
                'The sealed gateway to the next realm is now open!',
              ],
              cursor: 0,
            };
          }
        }
      }
    }
  }

  private damagePlayer(rawAtk: number): void {
    if (this.invulnTimer > 0) return;
    const shieldMult = this.shieldAuraTimer > 0 ? 0.45 : 1.0;
    const dmg = Math.max(2, Math.round((rawAtk - this.getEffectiveDef() * 0.45) * shieldMult));
    this.hp = Math.max(0, this.hp - dmg);
    this.invulnTimer = 0.55;
    this.screenShake = Math.max(this.screenShake, 0.25);
    sfx.playBounce();
    spawnBurst(this.particles, this.px, this.py, '#ef4444', 14, 130, 3.0);
    this.threeRenderer?.spawnGpuBurst(this.px, this.py, '#ef4444', 18, 3.6);
    this.popups.push({ x: this.px, y: this.py - 22, text: `-${dmg}`, color: '#f87171', life: 0.7, maxLife: 0.7 });

    if (this.hp <= 0 && this.herbs > 0) {
      this.herbs--;
      this.hp = Math.round(this.maxHp * 0.7);
      sfx.playPowerup();
      spawnBurst(this.particles, this.px, this.py, '#4ade80', 22, 150, 3.6);
      this.threeRenderer?.spawnGpuBurst(this.px, this.py, '#4ade80', 28, 4.2);
      this.popups.push({ x: this.px, y: this.py - 36, text: 'HEAL HERB!', color: '#4ade80', life: 1.2, maxLife: 1.2 });
    } else if (this.hp <= 0) {
      sfx.playGameOver();
      this.phase = 'GAME_OVER';
    }
  }

  public getHudSnapshot(): ClassicGameHud {
    const z = this.zones[this.currentZoneId];
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: Math.max(1, this.herbs + 1),
      stageName: z ? z.name : 'ESTERIA',
      primaryMetricLabel: 'HP / GOLD',
      primaryMetricValue: `${Math.ceil(this.hp)}/${this.maxHp} · ${this.gold}G`,
      secondaryMetricLabel: this.variant === 'ys1' ? 'BOOKS / SECRETS' : 'MP / CRESTS',
      secondaryMetricValue:
        this.variant === 'ys1'
          ? `${this.booksCollected}/${this.totalBooks} · ${this.secretsFound}★`
          : `${Math.ceil(this.mp)}MP · ${this.booksCollected}/${this.totalBooks}`,
      bannerText: this.zoneBannerTimer > 0 ? this.zoneBannerText : '',
      canRestartStage: true,
    };
  }

  // ===========================================================================
  // MODERN EVO THREE.JS WEBGL + GPU PHYSICS RENDERER (with 2.5D Pixel Fallback)
  // Real PBR materials, RoomEnvironment IBL, real-time PCFSoftShadowMap shadows,
  // GPU vertex-shader wind/player-bending grass, GPU Gerstner water waves, GPU
  // ballistic sparks, & Chronicles+ Floating Winged-Goddess HUD composited cleanly!
  // ===========================================================================
  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.save();
    ctx.scale(dpr, dpr);
    const W = this.logicalWidth;
    const H = this.logicalHeight;
    const viewH = H;
    const zone = this.zones[this.currentZoneId];
    const isDungeon = zone.theme === 'shrine' || zone.theme === 'tower' || zone.theme === 'lava';

    // Lazy-init Three.js WebGL + GPU Physics Evo Renderer
    if (!this.threeRenderer && !this.threeInitFailed && typeof document !== 'undefined') {
      try {
        this.threeRenderer = new YsThreeWorldRenderer(W, H);
      } catch {
        this.threeInitFailed = true;
      }
    }

    if (this.threeRenderer) {
      const renderYaw =
        this.phase === 'TITLE' ? Math.PI * 0.25 + Math.sin(this.time * 0.32) * 0.16 : this.cameraYaw;
      let dlgFocus: { active: boolean; x: number; y: number; npcId?: string } | null = null;
      if (this.dialogue?.speakerNpc) {
        const livePos = this.getNpcWorldPos(this.dialogue.speakerNpc);
        dlgFocus = { active: true, x: livePos.x, y: livePos.y, npcId: this.dialogue.speakerNpc.id };
      } else if (this.dialogue?.focusPos) {
        dlgFocus = { active: true, x: this.dialogue.focusPos.x, y: this.dialogue.focusPos.y };
      }

      const wind = this.getWindPhysics();
      this.threeRenderer.renderFrame({
        zone,
        time: this.time,
        camX: this.camX,
        camY: this.camY,
        screenShake: this.screenShake,
        cameraYaw: renderYaw,
        cameraZoomMode: this.phase === 'TITLE' ? 'wide45' : this.cameraZoomMode,
        cameraZoomScale: this.phase === 'TITLE' ? 1.0 : this.cameraZoomScale,
        timeOfDayHours: this.timeOfDayHours,
        weather: this.weather,
        windDirX: wind.dirX,
        windDirZ: wind.dirZ,
        windSpeed: wind.speed,
        lightningFlash: this.lightningFlash,
        dialogueFocus: dlgFocus,
        px: this.px,
        py: this.py,
        bodyAngle: this.bodyAngle,
        moveSpeedFrac: this.moveSpeedFrac,
        walkAnim: this.walkAnim,
        lungeTimer: this.lungeTimer,
        slashArcTimer: this.slashArcTimer,
        invulnTimer: this.invulnTimer,
        autoHealPulse: this.autoHealPulse,
        shieldAuraTimer: this.shieldAuraTimer,
        weaponTier: this.weaponTier,
        armorTier: this.armorTier,
        shieldTier: this.shieldTier,
        openedChests: this.openedChests,
        flags: this.flags,
        npcAngles: this.npcAngles,
        npcStates: this.npcStates,
        enemies: this.enemies,
        projectiles: this.projectiles,
        armorGibs: this.armorGibs,
        combatBolts: this.combatBolts,
      });

      // Composite hardware-accelerated 3D WebGL scene directly onto the arcade viewport!
      ctx.drawImage(this.threeRenderer.domElement, 0, 0, W, H);

      // Subtle radial dungeon edge vignette centered on 3D-projected Adol
      if (isDungeon) {
        const heroScr = this.threeRenderer.projectWorldToScreen(this.px, this.py, 0.75);
        this.drawDungeonTorchlight(ctx, W, viewH, heroScr.x, heroScr.y);
      }

      // Crisp 3D-Projected World-Space UI (NPC Nameplates, Portal Labels, Enemy HP, Popups & Interact Badge!)
      this.drawThreeWorldOverlays(ctx, zone, W, viewH);
    } else {
      // Graceful 2.5D Pixel Atlas Fallback if WebGL is unavailable
      if (!this.atlas && typeof document !== 'undefined') {
        this.atlas = getYsPixelAtlas();
      }
      const atlas = this.atlas;

      ctx.fillStyle = isDungeon ? '#04060c' : '#09111f';
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, viewH);
      ctx.clip();
      ctx.imageSmoothingEnabled = false;

      const shakeX = this.screenShake > 0 ? (Math.random() - 0.5) * 9 * this.screenShake : 0;
      const shakeY = this.screenShake > 0 ? (Math.random() - 0.5) * 7 * this.screenShake : 0;
      const originX = Math.round(W * 0.5 - this.camX + shakeX);
      const originY = Math.round(viewH * 0.5 - this.camY * TILT + shakeY);
      ctx.translate(originX, originY);

      const cMin = Math.max(0, Math.floor((this.camX - W * 0.5) / TILE) - 2);
      const cMax = Math.min(zone.width - 1, Math.ceil((this.camX + W * 0.5) / TILE) + 2);
      const rMin = Math.max(0, Math.floor((this.camY * TILT - viewH * 0.5) / TILE_H) - 3);
      const rMax = Math.min(zone.height - 1, Math.ceil((this.camY * TILT + viewH * 0.5) / TILE_H) + 3);

      for (let r = rMin; r <= rMax; r++) {
        for (let c = cMin; c <= cMax; c++) {
          this.drawGroundTile(ctx, atlas, zone, zone.tiles[r][c], c * TILE, r * TILE_H, c, r);
        }
      }
      this.drawWorldDirectionalShadows(ctx, zone, cMin, cMax, rMin, rMax, isDungeon);
      for (const p of zone.portals) {
        this.drawZonePortal(ctx, p);
      }

      const drawList: Array<{ sortY: number; draw: () => void }> = [];
      for (let r = rMin; r <= rMax; r++) {
        for (let c = cMin; c <= cMax; c++) {
          const code = zone.tiles[r][c];
          const x = c * TILE;
          const y = r * TILE_H;
          if (code === 1) {
            const hasRoofAbove = r > 0 && zone.tiles[r - 1][c] === 5;
            drawList.push({
              sortY: (r + 1) * TILE_H - 1,
              draw: () => this.drawWallTile(ctx, atlas, zone.theme, x, y, c, r, hasRoofAbove),
            });
          } else if (code === 5) {
            drawList.push({
              sortY: (r + 1) * TILE_H + 3,
              draw: () => this.drawRoofTile(ctx, zone.theme, x, y, c, r),
            });
          } else if (code === 2 || code === 9) {
            const baseY = (r + 0.78) * TILE_H;
            drawList.push({
              sortY: baseY + 4,
              draw: () => this.drawTreeOrPillarPixel(ctx, atlas, zone.theme, code, x, y, c, r),
            });
          } else if (code === 7) {
            drawList.push({
              sortY: (r + 0.72) * TILE_H,
              draw: () => this.drawBrazier(ctx, x, y),
            });
          }
        }
      }
      for (const sh of zone.shrubs) {
        if (sh.tx < cMin - 1 || sh.tx > cMax + 1 || sh.ty < rMin - 1 || sh.ty > rMax + 1) continue;
        const sx = (sh.tx + 0.5) * TILE;
        const sy = (sh.ty + 0.58) * TILE_H;
        drawList.push({ sortY: sy + 2, draw: () => this.drawShrubPixel(ctx, atlas, sh, sx, sy) });
      }
      for (const obj of zone.inspectables) {
        if (obj.tx < cMin - 1 || obj.tx > cMax + 1 || obj.ty < rMin - 1 || obj.ty > rMax + 1) continue;
        const ox = (obj.tx + 0.5) * TILE;
        const oy = (obj.ty + 0.62) * TILE_H;
        drawList.push({ sortY: oy, draw: () => this.drawInspectable(ctx, obj, ox, oy) });
      }
      for (const ch of zone.chests) {
        if (ch.tx < cMin - 1 || ch.tx > cMax + 1 || ch.ty < rMin - 1 || ch.ty > rMax + 1) continue;
        const cx = (ch.tx + 0.5) * TILE;
        const cy = (ch.ty + 0.62) * TILE_H;
        drawList.push({ sortY: cy, draw: () => this.drawChest(ctx, atlas, cx, cy, this.openedChests.has(ch.id)) });
      }
      for (const npc of zone.npcs) {
        const pos = this.getNpcWorldPos(npc);
        const ntx = pos.x / TILE;
        const nty = pos.y / TILE;
        if (ntx < cMin - 1 || ntx > cMax + 1 || nty < rMin - 1 || nty > rMax + 1) continue;
        const nx = pos.x;
        const ny = (nty + 0.12) * TILE_H;
        drawList.push({ sortY: ny, draw: () => this.drawNpc3D(ctx, atlas, npc, nx, ny) });
      }
      for (const e of this.enemies) {
        const esy = e.y * TILT;
        drawList.push({ sortY: esy + 3, draw: () => this.drawEnemy3D(ctx, atlas, e, isDungeon) });
      }
      drawList.push({ sortY: this.py * TILT + 3, draw: () => this.drawAdol3D(ctx, atlas, false) });
      drawList.sort((a, b) => a.sortY - b.sortY);
      for (const item of drawList) item.draw();

      if (this.occludedByCanopy) {
        ctx.save();
        ctx.globalAlpha = 0.24;
        this.drawAdol3D(ctx, atlas, true);
        ctx.restore();
      }
      for (const p of this.projectiles) {
        const py = p.y * TILT;
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.26)';
        ctx.beginPath();
        ctx.ellipse(p.x + 4, py + 4, p.radius * 0.85, p.radius * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 14;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, py - 12, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, py - 12, p.radius * 0.72, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      this.drawCombatVfx(ctx);
      this.drawTiltedParticlesAndPopups(ctx);
      if (this.nearestInteract && !this.dialogue && this.phase === 'PLAYING') {
        this.drawInteractPrompt(ctx, this.nearestInteract);
      }
      this.drawAmbientWorldLife(ctx, zone, this.camX, this.camY * TILT, W, viewH);
      ctx.restore();

      if (isDungeon) {
        this.drawDungeonTorchlight(ctx, W, viewH, this.px + originX, this.py * TILT + originY - 14);
      }
    }

    // Smooth zone-transition fade flash
    if (this.zoneFade > 0) {
      ctx.fillStyle = `rgba(4, 7, 16, ${this.zoneFade * 0.9})`;
      ctx.fillRect(0, 0, W, viewH);
    }

    // AUTHENTIC YS I & II CHRONICLES+ FLOATING WINGED-GODDESS HUD!
    if (!this.showFullMap) {
      this.drawChroniclesTopLeftStats(ctx);
      this.drawChroniclesZoneAndMiniMap(ctx, zone, W);
      this.drawChroniclesBottomHud(ctx, W, H);
    }

    // Full World Exploration Map & Quest Journal Overlay
    if (this.showFullMap) {
      this.drawFullMapOverlay(ctx, zone, W, viewH);
    }

    // Large Half-Body Right-Side Anime Bust Portrait + Twin Winged Goddesses Dialogue
    if (this.dialogue) {
      this.drawDialogueOverlay(ctx, W, viewH);
    }

    if (visualMode === 'crt') renderCrtOverlay(ctx, W, H);
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // 3D-Projected Screen-Space Overlays (Nameplates, Portal Banners, Popups, Prompts)
  // ---------------------------------------------------------------------------
  private drawThreeWorldOverlays(ctx: CanvasRenderingContext2D, zone: ZoneDef, W: number, H: number): void {
    const tr = this.threeRenderer;
    if (!tr) return;

    // 1. Bright Chronicles+ Screen-Space Impact Flashes projected onto 3D hits!
    for (const f of this.impactFlashes) {
      const p = tr.projectWorldToScreen(f.x, f.y, 0.7);
      if (!p.visible) continue;
      const t = Math.max(0, f.life / f.maxLife);
      const rad = f.radius * (1.3 - t * 0.35);
      ctx.save();
      ctx.globalAlpha = t * 0.92;
      const grad = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, rad);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.45, f.color);
      grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 2. RPG-JS Frosted Zone Portal & Warm Golden Building Doorway Badges
    ctx.save();
    ctx.font = '800 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    for (const portal of zone.portals) {
      const px = (portal.tx + portal.widthTiles * 0.5) * TILE;
      const py = (portal.ty + portal.heightTiles * 0.5) * TILE;
      // Show outdoor building doorway hints cleanly when Adol approaches (~15 tiles), and always inside interiors!
      if (portal.isDoorway && zone.theme !== 'interior') {
        const distTiles = Math.hypot(this.px - px, this.py - py) / TILE;
        if (distTiles > 15) continue;
      }
      const scr = tr.projectWorldToScreen(px, py, portal.isDoorway ? 1.55 : 2.25);
      if (!scr.visible || scr.x < -80 || scr.x > W + 80 || scr.y < -40 || scr.y > H + 40) continue;
      const locked = Boolean(portal.requiredFlag && !this.flags.has(portal.requiredFlag));
      const label = locked ? `LOCKED · ${portal.label}` : portal.label;
      const tw = ctx.measureText(label).width + 16;
      ctx.fillStyle = portal.isDoorway ? 'rgba(38, 22, 10, 0.88)' : 'rgba(17, 25, 56, 0.86)';
      ctx.strokeStyle = locked
        ? 'rgba(251, 113, 133, 0.92)'
        : portal.isDoorway
          ? 'rgba(253, 224, 71, 0.92)'
          : 'rgba(186, 230, 253, 0.9)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(scr.x - tw * 0.5, scr.y - 9, tw, 17, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = locked ? '#fecdd3' : portal.isDoorway ? '#fef08a' : '#e0f2fe';
      ctx.fillText(label, scr.x, scr.y + 3);
    }

    // 2B. RPG-JS Crisp 3D-Projected Guild & Landmark Building Signplates
    if (zone.buildings) {
      ctx.font = '800 8.5px "JetBrains Mono", monospace';
      for (const b of zone.buildings) {
        const bx = (b.tx + b.w * 0.5) * TILE;
        const by = (b.ty + b.h) * TILE;
        const scr = tr.projectWorldToScreen(bx, by, 2.35);
        if (!scr.visible || scr.x < -80 || scr.x > W + 80 || scr.y < -30 || scr.y > H + 30) continue;
        const tw = ctx.measureText(b.name).width + 14;
        ctx.fillStyle = 'rgba(19, 28, 60, 0.84)';
        ctx.strokeStyle = 'rgba(226, 232, 240, 0.78)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(scr.x - tw * 0.5, scr.y - 8, tw, 15, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fde68a';
        ctx.fillText(b.name, scr.x, scr.y + 2.5);
      }
      ctx.font = '800 9px "JetBrains Mono", monospace';
    }

    // 3. RPG-JS Frosted NPC Nameplates + Floating Golden Quest (!) / Shop Badges & Live Secondary Activity Tags
    for (const npc of zone.npcs) {
      const { x: nx, y: ny } = this.getNpcWorldPos(npc);
      const distTiles = Math.hypot(nx - this.px, ny - this.py) / TILE;
      // Keep distant secondary townsfolk visually clean until Adol strolls within 15 tiles
      if (npc.secondary && distTiles > 15) continue;

      const ageHeight = npc.ageGroup === 'child' ? 1.62 : npc.ageGroup === 'elder' ? 2.68 : 2.94;
      const scr = tr.projectWorldToScreen(nx, ny, ageHeight);
      if (!scr.visible || scr.x < -60 || scr.x > W + 60 || scr.y < -40 || scr.y > H + 40) continue;

      // Floating RPG-JS golden Quest "!" or Shop/Inn/Bakery badge above nameplate
      const isActiveQuest = (npc.role === 'quest' || (npc.role === 'bakery' && Boolean(npc.followUpFlag))) && (!npc.grantFlag || !this.flags.has(npc.grantFlag));
      const isShopOrInn = npc.role === 'weapon' || npc.role === 'armor' || npc.role === 'inn' || npc.role === 'bakery';
      if (isActiveQuest || isShopOrInn) {
        const bobY = scr.y - 21 + Math.sin(this.time * 5.2 + npc.tx) * 2.4;
        ctx.save();
        ctx.fillStyle = isActiveQuest ? '#facc15' : '#38bdf8';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(scr.x, bobY, 7.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#0f172a';
        ctx.font = '900 10px "JetBrains Mono", monospace';
        ctx.fillText(isActiveQuest ? '!' : npc.role === 'inn' ? '+' : '$', scr.x, bobY + 3.5);
        ctx.restore();
        ctx.font = '800 9px "JetBrains Mono", monospace';
      }

      const st = this.npcStates.get(npc.id);
      const showActivity = Boolean(npc.secondary && st?.working && st.taskLabel && distTiles < 10.5);
      const tw = ctx.measureText(npc.name).width + 12;
      ctx.fillStyle = npc.secondary ? 'rgba(15, 23, 42, 0.72)' : 'rgba(17, 25, 56, 0.84)';
      ctx.strokeStyle = npc.secondary ? 'rgba(148, 163, 184, 0.55)' : 'rgba(226, 232, 240, 0.72)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.roundRect(scr.x - tw * 0.5, scr.y - 8, tw, 14, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = isActiveQuest ? '#fef08a' : npc.secondary ? '#e2e8f0' : '#f8fafc';
      ctx.fillText(npc.name, scr.x, scr.y + 2);

      if (showActivity && st?.taskLabel) {
        ctx.save();
        ctx.font = '700 8px "JetBrains Mono", monospace';
        const aw = ctx.measureText(st.taskLabel).width + 10;
        ctx.fillStyle = 'rgba(15, 118, 110, 0.82)';
        ctx.beginPath();
        ctx.roundRect(scr.x - aw * 0.5, scr.y - 21, aw, 11, 3);
        ctx.fill();
        ctx.fillStyle = '#ccfbf1';
        ctx.fillText(st.taskLabel, scr.x, scr.y - 13);
        ctx.restore();
        ctx.font = '800 9px "JetBrains Mono", monospace';
      }
    }

    // 3b. Interactive Crafting Station Overhead Badges (Forge / Alchemy Cauldron / Hearth Cooking)
    for (const st of zone.craftStations ?? []) {
      const sx = (st.tx + 0.5) * TILE;
      const sy = (st.ty + 0.5) * TILE;
      if (Math.hypot(sx - this.px, sy - this.py) / TILE > 18) continue;
      const scr = tr.projectWorldToScreen(sx, sy, st.stationKind === 'forge' ? 2.55 : 2.15);
      if (!scr.visible || scr.x < -70 || scr.x > W + 70 || scr.y < -40 || scr.y > H + 40) continue;
      const tag = st.stationKind === 'forge' ? 'FORGE' : st.stationKind === 'alchemy' ? 'ALCHEMY' : 'COOKING';
      const accent = st.stationKind === 'forge' ? '#fb923c' : st.stationKind === 'alchemy' ? '#34d399' : '#facc15';
      const label = `${tag} · ${st.title}`;
      ctx.font = '800 8.5px "JetBrains Mono", monospace';
      const tw = ctx.measureText(label).width + 14;
      ctx.fillStyle = 'rgba(15, 23, 52, 0.88)';
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.roundRect(scr.x - tw * 0.5, scr.y - 8, tw, 15, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.fillText(label, scr.x, scr.y + 2.5);
    }

    // 3c. Nearby Scavengeable Forage Node Sparkle Tags (within 7.5 tiles so flora & ores pop cleanly!)
    ctx.font = '800 8px "JetBrains Mono", monospace';
    for (const fn of zone.forageNodes ?? []) {
      if (fn.gathered) continue;
      const fx = (fn.tx + 0.5) * TILE;
      const fy = (fn.ty + 0.5) * TILE;
      if (Math.hypot(fx - this.px, fy - this.py) / TILE > 7.5) continue;
      const scr = tr.projectWorldToScreen(fx, fy, 1.05);
      if (!scr.visible || scr.x < -50 || scr.x > W + 50 || scr.y < -30 || scr.y > H + 30) continue;
      const meta = FORAGE_META[fn.itemId];
      const bob = Math.sin(this.time * 4.5 + fn.tx * 1.7) * 2;
      const tw = ctx.measureText(meta.short).width + 10;
      ctx.fillStyle = 'rgba(10, 18, 38, 0.8)';
      ctx.strokeStyle = meta.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(scr.x - tw * 0.5, scr.y - 7 + bob, tw, 12.5, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = meta.color;
      ctx.fillText(meta.short, scr.x, scr.y + 2 + bob);
    }

    // 4. Crisp RPG-JS Overhead HP Bars above Hurt Non-Boss Enemies (matched to Short vs Tall enemy stature!)
    for (const e of this.enemies) {
      if (e.kind === 'boss' || e.hp >= e.maxHp) continue;
      const barH = e.kind === 'slime' ? 1.45 : e.kind === 'goblin' ? 2.05 : e.kind === 'wyvern' ? 3.3 : 3.05;
      const scr = tr.projectWorldToScreen(e.x, e.y, barH);
      if (!scr.visible) continue;
      const bw = 34;
      const frac = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = 'rgba(15, 23, 52, 0.9)';
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.75)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(scr.x - bw * 0.5 - 1.5, scr.y - 4, bw + 3, 6.5, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.roundRect(scr.x - bw * 0.5, scr.y - 2.5, Math.max(2, bw * frac), 3.5, 1.5);
      ctx.fill();
    }

    // 5. Floating Damage, Level-Up & Discovery Popups
    ctx.font = '900 13px "JetBrains Mono", monospace';
    for (const pop of this.popups) {
      const scr = tr.projectWorldToScreen(pop.x, pop.y, 1.85 + (1 - pop.life / Math.max(0.01, pop.maxLife)) * 0.95);
      if (!scr.visible) continue;
      const alpha = Math.max(0, pop.life / Math.max(0.01, pop.maxLife));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#020617';
      ctx.fillText(pop.text, scr.x + 1.5, scr.y + 1.5);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, scr.x, scr.y);
    }
    ctx.globalAlpha = 1;

    // 6. RPG-JS Contextual [SPACE] Interaction Prompt Badge projected cleanly over target
    if (this.nearestInteract && !this.dialogue && this.phase === 'PLAYING') {
      const t = this.nearestInteract;
      const promptH =
        t.kind === 'npc'
          ? t.npc?.ageGroup === 'child'
            ? 2.05
            : 3.38
          : t.kind === 'station'
            ? 2.85
            : t.kind === 'forage'
              ? 1.55
              : 1.95;
      const scr = tr.projectWorldToScreen(t.x, t.y, promptH);
      if (scr.visible) {
        const floatY = scr.y + Math.sin(this.time * 6) * 2.5;
        const text = `[SPACE] ${t.label}`;
        ctx.font = '800 10px "JetBrains Mono", monospace';
        const tw = ctx.measureText(text).width + 18;
        ctx.fillStyle = 'rgba(18, 27, 62, 0.92)';
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.roundRect(scr.x - tw * 0.5, floatY - 11, tw, 20, 6);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(scr.x - tw * 0.5 + 2, floatY - 9, tw - 4, 16, 4.5);
        ctx.stroke();
        ctx.fillStyle = '#fef08a';
        ctx.fillText(text, scr.x, floatY + 2.5);
      }
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // PASS 1: 2.5D Foreshortened Pixel Ground Plane & Shorelines
  // ---------------------------------------------------------------------------
  private drawGroundTile(
    ctx: CanvasRenderingContext2D,
    atlas: YsPixelAtlas | null,
    zone: ZoneDef,
    code: WorldTile,
    x: number,
    y: number,
    c: number,
    r: number
  ): void {
    const theme = zone.theme;
    const variant = Math.abs(c * 31 + r * 17) & 3;

    if (atlas) {
      if (code === 3) {
        const wKind = theme === 'tower' || theme === 'lava' ? 'lava' : theme === 'village' ? 'sky' : 'ocean';
        const frame = Math.floor(this.time * 3.4 + (c + r) * 0.35) & 3;
        ctx.drawImage(atlas.waterFrames[wKind][frame], x, y, TILE, TILE_H);
        // Realistic 2.5D shadowed cliff/bank rim where dry land drops into water directly above!
        if (r > 0 && zone.tiles[r - 1][c] !== 3 && zone.tiles[r - 1][c] !== 4) {
          ctx.fillStyle = wKind === 'lava' ? '#450a0a' : '#2c3d2f';
          ctx.fillRect(x, y, TILE, 5);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
          ctx.fillRect(x, y + 5, TILE, 4);
        }
        return;
      }

      if (code === 4) {
        const bKind = theme === 'ice' ? 'ice' : 'wood';
        ctx.drawImage(atlas.bridge[bKind], x, y, TILE, TILE_H);
        return;
      }

      let groundKey = 'meadow';
      if (code === 6) {
        groundKey = theme === 'shrine' || theme === 'tower' || theme === 'lava' ? 'carpet' : 'cobble';
      } else if (theme === 'town') {
        groundKey = 'meadow';
      } else if (theme === 'village') {
        groundKey = 'village';
      } else if (theme === 'plains' || theme === 'ruins') {
        // Organic Chronicles+ cracked rocky earth & lush emerald meadow moss clusters!
        const blob = Math.sin(c * 0.36 + r * 0.24) + Math.cos(c * 0.21 - r * 0.41);
        groundKey = code === 8 || blob > 0.22 ? 'plains_grass' : 'plains_earth';
      } else if (theme === 'shrine') {
        groundKey = 'mine';
      } else if (theme === 'tower' || theme === 'lava') {
        groundKey = 'tower';
      } else if (theme === 'ice') {
        groundKey = 'ice';
      }

      const tileset = atlas.ground[groundKey] ?? atlas.ground.meadow;
      ctx.drawImage(tileset[variant % tileset.length], x, y, TILE, TILE_H);

      // Decorative pixel wildflower meadow tufts (code 8)
      if (code === 8) {
        const seed = (c * 29 + r * 19) % 7;
        ctx.fillStyle = '#2d5a24';
        ctx.fillRect(x + 8 + seed * 2, y + 10, 6, 4);
        ctx.fillRect(x + 26 - seed, y + 20, 6, 4);
        ctx.fillStyle = seed % 2 === 0 ? '#fde047' : '#f9a8d4';
        ctx.fillRect(x + 10 + seed * 2, y + 8, 4, 4);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 28 - seed, y + 18, 4, 4);
        ctx.fillStyle = '#93c5fd';
        ctx.fillRect(x + 18, y + 22 - (seed % 3) * 2, 4, 4);
      }
      return;
    }

    // Fallback solid fill if offscreen canvas unavailable
    ctx.fillStyle = code === 3 ? '#0369a1' : code === 6 ? '#c2a67d' : '#3d7434';
    ctx.fillRect(x, y, TILE, TILE_H);
  }

  // ---------------------------------------------------------------------------
  // PASS 1.5: Realistic Directional Sunlit Cast Shadows & Ambient Occlusion!
  // ---------------------------------------------------------------------------
  private drawWorldDirectionalShadows(
    ctx: CanvasRenderingContext2D,
    zone: ZoneDef,
    cMin: number,
    cMax: number,
    rMin: number,
    rMax: number,
    isDungeon: boolean
  ): void {
    const shadowAlpha = isDungeon ? 0.42 : 0.28;
    const aoAlpha = isDungeon ? 0.5 : 0.34;
    ctx.save();

    for (let r = rMin; r <= rMax; r++) {
      for (let c = cMin; c <= cMax; c++) {
        const code = zone.tiles[r][c];
        const x = c * TILE;
        const y = r * TILE_H;

        // Tall walls / cliffs / cottages cast oblique lower-right shadows onto adjacent walkable ground!
        if (code === 1 || code === 5) {
          const rightOpen = c + 1 < zone.width && zone.tiles[r][c + 1] !== 1 && zone.tiles[r][c + 1] !== 5;
          const southOpen = r + 1 < zone.height && zone.tiles[r + 1][c] !== 1 && zone.tiles[r + 1][c] !== 5;

          if (rightOpen) {
            ctx.fillStyle = `rgba(6, 10, 20, ${shadowAlpha})`;
            ctx.beginPath();
            ctx.moveTo(x + TILE, y - 4);
            ctx.lineTo(x + TILE + 18, y + 8);
            ctx.lineTo(x + TILE + 18, y + TILE_H + 10);
            ctx.lineTo(x + TILE, y + TILE_H);
            ctx.closePath();
            ctx.fill();
          }
          if (southOpen) {
            // Crisp dark base ambient occlusion strip + soft angled cast shadow
            ctx.fillStyle = `rgba(4, 8, 18, ${aoAlpha})`;
            ctx.fillRect(x, y + TILE_H, TILE, 5);
            ctx.fillStyle = `rgba(6, 10, 20, ${shadowAlpha * 0.85})`;
            ctx.beginPath();
            ctx.moveTo(x, y + TILE_H);
            ctx.lineTo(x + TILE, y + TILE_H);
            ctx.lineTo(x + TILE + 16, y + TILE_H + 12);
            ctx.lineTo(x + 12, y + TILE_H + 12);
            ctx.closePath();
            ctx.fill();
          }
        } else if (code === 2 || code === 9) {
          // Dappled oblique sunlit tree/column shadow stretched toward lower-right!
          const cx = x + TILE * 0.5;
          const baseY = y + TILE_H * 0.8;
          const isRoda = code === 9;
          ctx.fillStyle = `rgba(5, 11, 18, ${shadowAlpha * 1.05})`;
          ctx.beginPath();
          ctx.ellipse(
            cx + (isRoda ? 22 : 14),
            baseY + (isRoda ? 8 : 5),
            isRoda ? 44 : 26,
            isRoda ? 14 : 9,
            0.22,
            0,
            Math.PI * 2
          );
          ctx.fill();
          // Tight dark trunk contact AO
          ctx.fillStyle = `rgba(3, 7, 14, ${aoAlpha})`;
          ctx.beginPath();
          ctx.ellipse(cx, baseY + 2, isRoda ? 20 : 12, isRoda ? 7 : 4.5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  private drawZonePortal(ctx: CanvasRenderingContext2D, p: ZonePortal): void {
    const x = p.tx * TILE;
    const y = p.ty * TILE_H;
    const w = p.widthTiles * TILE;
    const h = p.heightTiles * TILE_H;
    const cx = x + w * 0.5;
    const cy = y + h * 0.5;
    const locked = Boolean(p.requiredFlag && !this.flags.has(p.requiredFlag));
    const pulse = 0.55 + Math.sin(this.time * 4.5) * 0.25;

    const grad = ctx.createRadialGradient(cx, cy, 8, cx, cy, Math.max(w, h) * 0.65);
    if (locked) {
      grad.addColorStop(0, `rgba(244, 63, 94, ${pulse * 0.72})`);
      grad.addColorStop(1, 'rgba(244, 63, 94, 0)');
    } else {
      grad.addColorStop(0, `rgba(56, 189, 248, ${pulse * 0.75})`);
      grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(x - 16, y - 16, w + 32, h + 32);

    const arrow = p.direction === 'north' ? '▲' : p.direction === 'south' ? '▼' : '▶';
    const labelY = p.direction === 'north' ? y + h + 15 : y - 9;
    ctx.save();
    ctx.font = '800 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    const txt = `${locked ? '🔒' : arrow} ${p.label}`;
    const tw = ctx.measureText(txt).width + 16;
    ctx.fillStyle = locked ? 'rgba(69, 10, 10, 0.88)' : 'rgba(9, 17, 34, 0.86)';
    ctx.strokeStyle = locked ? '#fb7185' : '#38bdf8';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(cx - tw * 0.5, labelY - 11, tw, 17, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = locked ? '#fecdd3' : '#e0f2fe';
    ctx.fillText(txt, cx, labelY + 1);
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // PASS 2: Tall 2.5D Front-Angled Pixel Cliffs, Half-Timbered Cottages & Trees
  // ---------------------------------------------------------------------------
  private drawWallTile(
    ctx: CanvasRenderingContext2D,
    atlas: YsPixelAtlas | null,
    theme: ZoneDef['theme'],
    x: number,
    y: number,
    c: number,
    r: number,
    hasRoofAbove: boolean
  ): void {
    // Tall 2.5D front-angled Medieval Half-Timbered Town Cottage Facade under a roof!
    if ((theme === 'town' || theme === 'village') && hasRoofAbove) {
      const topY = y - 22;
      const wallH = TILE_H + 22;
      // Warm sunlit plaster wall with subtle horizontal shading
      ctx.fillStyle = '#ead9bc';
      ctx.fillRect(x, topY, TILE, wallH);
      ctx.fillStyle = '#d7c099';
      ctx.fillRect(x, topY + 26, TILE, wallH - 26);
      // Stone foundation plinth at ground level
      ctx.fillStyle = '#736c62';
      ctx.fillRect(x, y + TILE_H - 10, TILE, 10);
      ctx.fillStyle = '#534d45';
      ctx.fillRect(x, y + TILE_H - 4, TILE, 4);
      ctx.fillStyle = '#999286';
      ctx.fillRect(x + 2, y + TILE_H - 9, 12, 3);
      ctx.fillRect(x + 20, y + TILE_H - 9, 14, 3);
      // Deep roof eave cast shadow across top of facade!
      ctx.fillStyle = 'rgba(18, 14, 24, 0.36)';
      ctx.fillRect(x, topY, TILE, 8);
      // Crisp dark oak half-timber framing
      ctx.fillStyle = '#542a10';
      ctx.fillRect(x, topY, 4, wallH);
      ctx.fillRect(x + TILE - 4, topY, 4, wallH);
      ctx.fillRect(x, topY, TILE, 4);
      ctx.fillRect(x, topY + 22, TILE, 4);
      ctx.fillStyle = '#7c431b';
      ctx.fillRect(x + 1, topY + 1, 2, wallH - 2);

      // Alternate arched oak doorway vs glowing mullioned pixel window with flowerbox!
      if ((c + r) % 3 === 0) {
        // Recessed arched oak door
        ctx.fillStyle = '#2d1508';
        ctx.fillRect(x + 12, topY + 16, 20, wallH - 18);
        ctx.fillStyle = '#6b3614';
        ctx.fillRect(x + 14, topY + 18, 16, wallH - 20);
        ctx.fillStyle = '#8b4a1f';
        ctx.fillRect(x + 16, topY + 20, 5, wallH - 24);
        ctx.fillRect(x + 23, topY + 20, 5, wallH - 24);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(x + 26, topY + 34, 3, 3);
      } else {
        // Warm glowing pixel-art mullioned window + light spill onto street!
        ctx.fillStyle = 'rgba(254, 240, 138, 0.16)';
        ctx.fillRect(x + 8, y + TILE_H, 28, 12);
        ctx.fillStyle = '#4a250e';
        ctx.fillRect(x + 10, topY + 12, 24, 20);
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(x + 12, topY + 14, 20, 16);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(x + 12, topY + 22, 20, 8);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 14, topY + 15, 5, 4);
        // Mullion crossbars
        ctx.fillStyle = '#542a10';
        ctx.fillRect(x + 21, topY + 12, 2, 20);
        ctx.fillRect(x + 10, topY + 21, 24, 2);
        // Pixel terracotta flowerbox
        ctx.fillStyle = '#9a3412';
        ctx.fillRect(x + 9, topY + 32, 26, 6);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(x + 10, topY + 30, 24, 3);
        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(x + 13, topY + 28, 3, 3);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(x + 21, topY + 28, 3, 3);
        ctx.fillStyle = '#f472b6';
        ctx.fillRect(x + 28, topY + 28, 3, 3);
      }
      return;
    }

    // Crisp 2x HD-2D Front-Angled Cliff / Castle Wall / Dungeon Wall Sprite (44 x 60 px!)
    if (atlas) {
      const kind = themeToWallKind(theme);
      const variants = atlas.wall[kind];
      const sprite = variants[Math.abs(c * 13 + r * 7) % variants.length];
      ctx.drawImage(sprite, x, y + TILE_H - 60, TILE, 60);
      return;
    }

    ctx.fillStyle = '#475569';
    ctx.fillRect(x, y - 24, TILE, TILE_H + 24);
  }

  private drawRoofTile(
    ctx: CanvasRenderingContext2D,
    theme: ZoneDef['theme'],
    x: number,
    y: number,
    c: number,
    r: number
  ): void {
    const isBlue = theme === 'village';
    const topY = y - 22;
    const roofH = TILE_H + 22;
    // Stepped pixel terracotta / royal slate shingles with sunlit upper-left sheen
    const ramp = isBlue
      ? ['#93c5fd', '#3b82f6', '#2563eb', '#1d4ed8', '#1e3a8a']
      : ['#fca5a5', '#dc2626', '#b91c1c', '#991b1b', '#6b1414'];

    ctx.fillStyle = ramp[2];
    ctx.fillRect(x - 2, topY, TILE + 4, roofH);
    // Sunlit ridge crest
    ctx.fillStyle = ramp[0];
    ctx.fillRect(x - 2, topY, TILE + 4, 4);
    ctx.fillStyle = ramp[1];
    ctx.fillRect(x - 2, topY + 4, TILE + 4, 8);
    // Layered pixel shingle courses
    for (let sy = 10; sy < roofH - 4; sy += 8) {
      ctx.fillStyle = ramp[3];
      ctx.fillRect(x - 2, topY + sy, TILE + 4, 2);
      const off = (sy / 8) % 2 === 0 ? 0 : 6;
      ctx.fillStyle = ramp[1];
      for (let sx = off; sx < TILE; sx += 12) {
        ctx.fillRect(x + sx, topY + sy - 4, 8, 3);
      }
    }
    // Deep shadowed lower eave trim
    ctx.fillStyle = ramp[4];
    ctx.fillRect(x - 2, y + TILE_H - 4, TILE + 4, 5);
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(x - 2, y + TILE_H - 5, TILE + 4, 1.5);

    // Occasional stone chimney puffing gentle pixel smoke wisps!
    if ((c * 7 + r * 11) % 7 === 0) {
      ctx.fillStyle = '#64748b';
      ctx.fillRect(x + 26, topY - 12, 12, 16);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(x + 26, topY - 12, 5, 16);
      ctx.fillStyle = '#475569';
      ctx.fillRect(x + 24, topY - 14, 16, 4);
      const puff = (this.time * 14 + c * 5) % 18;
      ctx.fillStyle = `rgba(226, 232, 240, ${0.42 * (1 - puff / 18)})`;
      ctx.fillRect(Math.round(x + 29 + Math.sin(this.time * 2 + c) * 4), Math.round(topY - 18 - puff), 6, 5);
    }
  }

  private drawTreeOrPillarPixel(
    ctx: CanvasRenderingContext2D,
    atlas: YsPixelAtlas | null,
    theme: ZoneDef['theme'],
    code: WorldTile,
    x: number,
    y: number,
    c: number,
    r: number
  ): void {
    const cx = x + TILE * 0.5;
    const baseY = y + TILE_H * 0.82;
    const isRoda = code === 9;
    const sway =
      theme === 'shrine' || theme === 'ruins' || theme === 'ice' || theme === 'tower' || theme === 'lava'
        ? 0
        : Math.round(Math.sin(this.time * 1.9 + c * 0.9 + r * 0.7) * 1.4);

    if (atlas) {
      let key: keyof YsPixelAtlas['tree'] = 'oak';
      if (isRoda) key = 'roda';
      else if (theme === 'shrine' || theme === 'ruins') key = 'marble';
      else if (theme === 'ice') key = 'ice';
      else if (theme === 'tower' || theme === 'lava') key = 'obsidian';
      else if (theme === 'village' && (c + r) % 2 === 0) key = 'blossom';

      const sprite = atlas.tree[key];
      const dw = isRoda ? 104 : 68;
      const dh = isRoda ? 132 : 92;
      ctx.drawImage(sprite, Math.round(cx - dw * 0.5 + sway), Math.round(baseY - dh + 8), dw, dh);

      // Subtle glowing sunlit pollen sparkle on the monumental Roda Tree!
      if (isRoda) {
        ctx.fillStyle = 'rgba(254, 249, 195, 0.82)';
        for (let i = 0; i < 4; i++) {
          const a = i * 1.57 + this.time * 0.65;
          ctx.fillRect(Math.round(cx + Math.cos(a) * 28 + sway), Math.round(baseY - 76 + Math.sin(a) * 18), 3, 3);
        }
      }
      return;
    }

    ctx.fillStyle = '#15803d';
    ctx.fillRect(cx - 20, baseY - 64, 40, 64);
  }

  private drawBrazier(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const cx = x + TILE * 0.5;
    const cy = y + TILE_H * 0.65;

    // Angled ground cast shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
    ctx.beginPath();
    ctx.ellipse(cx + 6, cy + 7, 13, 5, 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Warm radial lantern light pool on the tilted ground
    const flick = Math.sin(this.time * 16 + x) * 2.5;
    const glow = ctx.createRadialGradient(cx, cy - 12, 3, cx, cy - 12, 46 + flick);
    glow.addColorStop(0, 'rgba(251, 191, 36, 0.56)');
    glow.addColorStop(0.55, 'rgba(234, 88, 12, 0.18)');
    glow.addColorStop(1, 'rgba(251, 191, 36, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy - 12, 46 + flick, 0, Math.PI * 2);
    ctx.fill();

    // Pixel iron brazier pedestal & bowl
    ctx.fillStyle = '#334155';
    ctx.fillRect(cx - 8, cy - 10, 16, 18);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(cx - 6, cy - 10, 5, 16);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(cx - 11, cy - 14, 22, 6);
    // Crisp animated pixel flame
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(cx - 7, cy - 22 + Math.round(flick * 0.4), 14, 10);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(cx - 5, cy - 25 + Math.round(flick * 0.5), 10, 9);
    ctx.fillStyle = '#fef9c3';
    ctx.fillRect(cx - 2, cy - 22, 4, 6);
  }

  private drawShrubPixel(
    ctx: CanvasRenderingContext2D,
    atlas: YsPixelAtlas | null,
    sh: WorldShrub,
    x: number,
    y: number
  ): void {
    const wiggle = Math.sin(sh.shakePhase) * sh.shakeAmp * 5.2;
    const squash = 1 + Math.abs(Math.sin(sh.shakePhase)) * sh.shakeAmp * 0.14;

    ctx.save();
    ctx.translate(Math.round(x + wiggle), Math.round(y));

    // Directional angled ground cast shadow
    ctx.fillStyle = 'rgba(4, 10, 14, 0.34)';
    ctx.beginPath();
    ctx.ellipse(6, 5, 19, 7, 0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.scale(squash, 1 / Math.sqrt(squash));
    if (atlas) {
      const sp = atlas.shrub[sh.variant];
      ctx.drawImage(sp, -20, -26, 40, 34);
    } else {
      ctx.fillStyle = '#16a34a';
      ctx.fillRect(-14, -18, 28, 22);
    }

    if (!sh.searched && sh.hiddenKind !== 'nothing') {
      const spark = 0.4 + Math.sin(this.time * 5.2 + sh.tx) * 0.38;
      ctx.fillStyle = `rgba(254, 240, 138, ${spark})`;
      ctx.fillRect(-2, -26, 4, 4);
      ctx.fillStyle = `rgba(255, 255, 255, ${spark})`;
      ctx.fillRect(-1, -25, 2, 2);
    }
    ctx.restore();
  }

  private drawInspectable(ctx: CanvasRenderingContext2D, obj: WorldInspectable, x: number, y: number): void {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));

    // Directional angled ground shadow for every landmark
    ctx.fillStyle = 'rgba(4, 9, 18, 0.36)';
    ctx.beginPath();
    ctx.ellipse(obj.kind === 'fountain' ? 10 : 7, 7, obj.kind === 'fountain' ? 30 : 16, obj.kind === 'fountain' ? 11 : 6, 0.16, 0, Math.PI * 2);
    ctx.fill();

    if (obj.kind === 'fountain') {
      // Sculpted 2.5D Minea Plaza Stone Fountain with animated sparkling water!
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.ellipse(0, 4, 28, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.ellipse(0, 0, 26, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.ellipse(0, 0, 21, 8.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.ellipse(-2, -1, 15, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Center pedestal & pixel water jet
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(-6, -24, 12, 24);
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(-4, -24, 5, 22);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-10, -28, 20, 6);
      const jet = Math.round(Math.sin(this.time * 9) * 2.5);
      ctx.fillStyle = '#bae6fd';
      ctx.fillRect(-4, -36 + jet, 8, 9);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-2, -38 + jet, 4, 4);
      ctx.fillRect(-11, -18 - jet, 3, 12);
      ctx.fillRect(8, -18 + jet, 3, 12);
    } else if (obj.kind === 'sign') {
      ctx.fillStyle = '#5c2d0c';
      ctx.fillRect(-3, -8, 6, 16);
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-15, -26, 30, 19);
      ctx.fillStyle = '#b45309';
      ctx.fillRect(-13, -24, 26, 15);
      ctx.fillStyle = '#fde68a';
      ctx.fillRect(-9, -20, 18, 2);
      ctx.fillRect(-9, -15, 14, 2);
    } else if (obj.kind === 'statue' || obj.kind === 'pedestal') {
      // Tall carved marble Winged-Goddess Shrine Statue!
      ctx.fillStyle = '#64748b';
      ctx.fillRect(-13, -6, 26, 14);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(-11, -8, 22, 6);
      // Marble wings & robed figure
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-15, -34, 30, 14);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(-7, -38, 14, 32);
      ctx.fillRect(-5, -46, 10, 9);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(2, -38, 5, 30);
      const pulse = 0.4 + Math.sin(this.time * 4) * 0.25;
      ctx.strokeStyle = `rgba(56, 189, 248, ${pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -24, 18, 0, Math.PI * 2);
      ctx.stroke();
    } else if (obj.kind === 'crates') {
      ctx.fillStyle = '#5c2d0c';
      ctx.fillRect(-16, -16, 19, 22);
      ctx.fillStyle = '#a15216';
      ctx.fillRect(-14, -14, 15, 18);
      ctx.fillStyle = '#d97706';
      ctx.fillRect(-14, -14, 15, 4);
      ctx.fillStyle = '#78350f';
      ctx.fillRect(0, -9, 17, 17);
      ctx.fillStyle = '#b45309';
      ctx.fillRect(2, -7, 13, 13);
    } else if (obj.kind === 'well') {
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.ellipse(0, 2, 16, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(-15, -8, 30, 10);
      ctx.fillStyle = '#0369a1';
      ctx.beginPath();
      ctx.ellipse(0, -8, 12, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5c2d0c';
      ctx.fillRect(-13, -32, 4, 24);
      ctx.fillRect(9, -32, 4, 24);
      ctx.fillStyle = '#991b1b';
      ctx.fillRect(-17, -38, 34, 10);
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(-15, -38, 30, 4);
    } else if (obj.kind === 'campfire') {
      ctx.fillStyle = '#5c2d0c';
      ctx.fillRect(-11, -1, 22, 6);
      const fl = Math.round(Math.sin(this.time * 14) * 2.5);
      const glow = ctx.createRadialGradient(0, -8, 2, 0, -8, 36);
      glow.addColorStop(0, 'rgba(251, 146, 60, 0.45)');
      glow.addColorStop(1, 'rgba(251, 146, 60, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, -8, 36, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f97316';
      ctx.fillRect(-7, -14 + fl, 14, 13);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(-4, -12, 8, 9);
    } else {
      // Engraved Ancient Tablet / Roda Altar / Cell Door
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-14, -32, 28, 38);
      ctx.fillStyle = '#475569';
      ctx.fillRect(-12, -30, 24, 34);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(-12, -30, 24, 3);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(-8, -21, 16, 3);
      ctx.fillRect(-8, -14, 16, 3);
      ctx.fillRect(-8, -7, 12, 3);
    }
    ctx.restore();
  }

  private drawChest(
    ctx: CanvasRenderingContext2D,
    atlas: YsPixelAtlas | null,
    x: number,
    y: number,
    opened: boolean
  ): void {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.fillStyle = 'rgba(4, 8, 16, 0.38)';
    ctx.beginPath();
    ctx.ellipse(5, 6, 16, 6, 0.15, 0, Math.PI * 2);
    ctx.fill();
    if (atlas) {
      ctx.drawImage(opened ? atlas.chestOpen : atlas.chestClosed, -16, -24, 32, 30);
    } else {
      ctx.fillStyle = opened ? '#57280a' : '#b45309';
      ctx.fillRect(-14, -14, 28, 20);
    }
    ctx.restore();
  }

  // ===========================================================================
  // HD-2D MODERN-COLOR PIXEL SPRITES (ADOL, NPCs, MONSTERS & BOSSES)
  // Crisp 2x nearest-neighbor pixel art standing tall on angled cast shadows!
  // ===========================================================================
  private drawAdol3D(ctx: CanvasRenderingContext2D, atlas: YsPixelAtlas | null, silhouetteOnly: boolean): void {
    if (!silhouetteOnly && this.invulnTimer > 0 && Math.floor(this.time * 18) % 2 === 0) return;

    const sx = Math.round(this.px);
    const sy = Math.round(this.py * TILT);
    const dir = angleToDir4(this.bodyAngle);
    const frame = this.moveSpeedFrac > 0.15 ? Math.floor(this.walkAnim * 0.75) & 1 : 0;
    const lungePushX = this.lungeTimer > 0 ? Math.round(Math.cos(this.bodyAngle) * 5) : 0;
    const lungePushY = this.lungeTimer > 0 ? Math.round(Math.sin(this.bodyAngle) * 3) : 0;

    ctx.save();
    ctx.translate(sx + lungePushX, sy + lungePushY);

    // Realistic angled directional sunlit shadow + dark contact AO core under boots!
    if (!silhouetteOnly) {
      ctx.fillStyle = 'rgba(5, 10, 18, 0.32)';
      ctx.beginPath();
      ctx.ellipse(7, 4, 15, 6, 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(3, 6, 12, 0.5)';
      ctx.beginPath();
      ctx.ellipse(0, 2, 11, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Emerald Standing Auto-Heal Shimmer Ring
    if (!silhouetteOnly && this.autoHealPulse > 0.05) {
      const r = 16 + Math.sin(this.time * 7) * 3;
      ctx.strokeStyle = `rgba(74, 222, 128, ${this.autoHealPulse * 0.65})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, -2, r, r * 0.45, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Ys II Sapphire Shield Magic Aura
    if (!silhouetteOnly && this.shieldAuraTimer > 0) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, -16, 24, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Sword Slash Crescent Trail on Lunge / Bump!
    if (!silhouetteOnly && this.slashArcTimer > 0) {
      ctx.save();
      ctx.translate(0, -14);
      ctx.rotate(this.bodyAngle);
      ctx.strokeStyle = `rgba(224, 242, 254, ${Math.min(1, this.slashArcTimer * 4.8)})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(8, 0, 24, -0.88, 0.88);
      ctx.stroke();
      ctx.strokeStyle = `rgba(254, 240, 138, ${Math.min(1, this.slashArcTimer * 3.8)})`;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(10, 0, 27, -0.7, 0.7);
      ctx.stroke();
      ctx.restore();
    }

    // Draw crisp 2x Modern-Color Pixel Art Adol Christin (40 x 52 px)
    if (atlas) {
      const sprite = atlas.adol[dir][frame];
      ctx.drawImage(sprite, -20, -47, 40, 52);

      // Subtle golden/silver weapon gleam when wielding upgraded blades!
      if (!silhouetteOnly && this.weaponTier >= 2) {
        const glint = 0.4 + Math.sin(this.time * 8) * 0.35;
        ctx.fillStyle =
          this.weaponTier >= 4
            ? `rgba(251, 146, 60, ${glint})`
            : `rgba(186, 230, 253, ${glint})`;
        const gx = dir === 'left' ? -15 : dir === 'right' ? 13 : 9;
        ctx.fillRect(gx, -22, 4, 10);
      }
    } else {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-10, -34, 20, 34);
    }

    ctx.restore();
  }

  private drawNpc3D(
    ctx: CanvasRenderingContext2D,
    atlas: YsPixelAtlas | null,
    npc: WorldNpc,
    x: number,
    y: number
  ): void {
    const a = this.npcAngles.get(npc.id) ?? Math.PI * 0.5;
    const dir = angleToDir4(a);
    const breathe = Math.round(Math.sin(this.time * 2.6 + npc.tx) * 0.8);

    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));

    // Realistic angled cast shadow + dark contact core
    ctx.fillStyle = 'rgba(5, 10, 18, 0.32)';
    ctx.beginPath();
    ctx.ellipse(6, 4, 14, 5.5, 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(3, 6, 12, 0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    if (atlas) {
      const sprite = atlas.getNpcSprite(npc.hairColor, npc.tunicColor, npc.cloakColor, dir);
      ctx.drawImage(sprite, -18, -44 + breathe, 36, 48);
    } else {
      ctx.fillStyle = npc.cloakColor;
      ctx.fillRect(-10, -32, 20, 32);
    }

    // Crisp translucent nameplate above NPC
    ctx.font = '800 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    const tw = ctx.measureText(npc.name).width + 10;
    ctx.fillStyle = 'rgba(7, 11, 22, 0.72)';
    ctx.beginPath();
    ctx.roundRect(-tw * 0.5, -56, tw, 13, 4);
    ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.fillText(npc.name, 0, -46.5);
    ctx.restore();
  }

  private drawEnemy3D(
    ctx: CanvasRenderingContext2D,
    atlas: YsPixelAtlas | null,
    e: WorldEnemy,
    isDungeon: boolean
  ): void {
    const sx = Math.round(e.x);
    const sy = Math.round(e.y * TILT);
    const isBoss = e.kind === 'boss';
    const frame = Math.floor(this.time * 5.2 + e.id) & 1;
    const flash = e.hitFlash > 0 && Math.floor(this.time * 32) % 2 === 0;
    const flipX = Math.cos(e.angle) < -0.15;

    ctx.save();
    ctx.translate(sx, sy);

    // Realistic angled sunlit shadow + dark contact core
    ctx.fillStyle = 'rgba(5, 10, 18, 0.34)';
    ctx.beginPath();
    ctx.ellipse(isBoss ? 14 : 7, 4, isBoss ? 34 : 16, isBoss ? 12 : 6, 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(3, 6, 12, 0.5)';
    ctx.beginPath();
    ctx.ellipse(0, 2, isBoss ? 24 : 11, isBoss ? 8 : 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Glowing Sapphire Magic Weapon Aura in Dungeons (authentic Screenshot #2 detail!)
    if (isDungeon && (e.kind === 'knight' || e.kind === 'mage' || isBoss)) {
      const wx = flipX ? -16 : 16;
      const wy = isBoss ? -34 : -18;
      const g = ctx.createRadialGradient(wx, wy, 2, wx, wy, isBoss ? 28 : 16);
      g.addColorStop(0, 'rgba(224, 242, 254, 0.92)');
      g.addColorStop(0.45, 'rgba(56, 189, 248, 0.62)');
      g.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(wx, wy, isBoss ? 28 : 16, 0, Math.PI * 2);
      ctx.fill();
    }

    if (atlas) {
      const sprite = atlas.enemy[e.kind][frame];
      const dw = isBoss ? 88 : 44;
      const dh = isBoss ? 96 : 48;
      ctx.save();
      if (flipX) ctx.scale(-1, 1);
      if (flash) {
        ctx.filter = 'brightness(2.4) contrast(1.2)';
      }
      ctx.drawImage(sprite, -dw * 0.5, -dh + 6, dw, dh);
      ctx.restore();
    } else {
      ctx.fillStyle = flash ? '#ffffff' : e.color;
      ctx.fillRect(-14, -32, 28, 32);
    }

    // Mini crisp damage bar directly above hurt non-boss enemies
    if (!isBoss && e.hp < e.maxHp) {
      const bw = 28;
      const frac = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = 'rgba(7, 11, 20, 0.8)';
      ctx.fillRect(-bw * 0.5 - 1, -48, bw + 2, 5);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-bw * 0.5, -47, bw * frac, 3);
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // PASS 2.5: Explosive Chronicles+ Bump-Combat VFX & Tilted Particles/Popups
  // ---------------------------------------------------------------------------
  private drawCombatVfx(ctx: CanvasRenderingContext2D): void {
    // 1. Tumbling Pixel Armor Gibs bouncing onto the 2.5D tilted ground!
    for (const g of this.armorGibs) {
      const gy = g.y * TILT;
      const alpha = Math.min(1, g.life / (g.maxLife * 0.4));
      ctx.save();
      ctx.globalAlpha = alpha;
      // Ground shadow under bouncing armor piece
      ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
      ctx.beginPath();
      ctx.ellipse(g.x + 2, gy + 2, Math.max(2, g.w * 0.6), 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Tumbling pixel plate chunk
      ctx.translate(Math.round(g.x), Math.round(gy - g.z));
      ctx.rotate(g.rot);
      ctx.fillStyle = g.color;
      ctx.fillRect(-g.w * 0.5, -g.h * 0.5, g.w, g.h);
      ctx.fillStyle = g.rim;
      ctx.fillRect(-g.w * 0.5, -g.h * 0.5, g.w, 2);
      ctx.restore();
    }

    // 2. Jagged Golden-White Lightning Slash Bolts!
    for (const b of this.combatBolts) {
      const alpha = Math.max(0, b.life / b.maxLife);
      const y1 = b.y1 * TILT - 12;
      const y2 = b.y2 * TILT - 12;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 2.4;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(b.x1, y1);
      const segs = 4;
      for (let i = 1; i < segs; i++) {
        const t = i / segs;
        const jx = Math.sin(b.seed + i * 9.3) * 11;
        const jy = Math.cos(b.seed + i * 7.1) * 9;
        ctx.lineTo(b.x1 + (b.x2 - b.x1) * t + jx, y1 + (y2 - y1) * t + jy);
      }
      ctx.lineTo(b.x2, y2);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Bright Cyan-White Chronicles+ Impact Flashes!
    for (const f of this.impactFlashes) {
      const t = Math.max(0, f.life / f.maxLife);
      const fy = f.y * TILT - 14;
      const rad = f.radius * (1.25 - t * 0.35);
      ctx.save();
      ctx.globalAlpha = t;
      const grad = ctx.createRadialGradient(f.x, fy, 2, f.x, fy, rad);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.45, f.color);
      grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(f.x, fy, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawTiltedParticlesAndPopups(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / Math.max(0.01, p.maxLife));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      const sz = Math.max(2, Math.round(p.radius * 1.6));
      ctx.fillRect(Math.round(p.x - sz * 0.5), Math.round(p.y * TILT - 12 - sz * 0.5), sz, sz);
      ctx.restore();
    }
    for (const pop of this.popups) {
      const alpha = Math.max(0, pop.life / Math.max(0.01, pop.maxLife));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '900 12px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      const py = Math.round(pop.y * TILT - 20);
      ctx.fillStyle = '#020617';
      ctx.fillText(pop.text, Math.round(pop.x) + 1.5, py + 1.5);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, Math.round(pop.x), py);
      ctx.restore();
    }
  }

  private drawInteractPrompt(ctx: CanvasRenderingContext2D, target: InteractTarget): void {
    const floatY = target.y * TILT - 54 + Math.sin(this.time * 6) * 2.5;
    const text = `[SPACE] ${target.label}`;
    ctx.save();
    ctx.font = '800 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    const tw = ctx.measureText(text).width + 16;
    ctx.fillStyle = 'rgba(9, 15, 30, 0.92)';
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(target.x - tw * 0.5, floatY - 11, tw, 19, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fef08a';
    ctx.fillText(text, target.x, floatY + 2);
    ctx.restore();
  }

  private drawAmbientWorldLife(
    ctx: CanvasRenderingContext2D,
    zone: ZoneDef,
    camX: number,
    camScreenY: number,
    W: number,
    viewH: number
  ): void {
    const left = camX - W * 0.55;
    const top = camScreenY - viewH * 0.55;
    ctx.save();

    // Subtle warm sunlit diagonal god-rays in outdoor zones for HD-2D realism!
    if (zone.theme === 'town' || zone.theme === 'plains' || zone.theme === 'village' || zone.theme === 'ruins') {
      const rayGrad = ctx.createLinearGradient(left, top, left + W * 0.7, top + viewH * 0.7);
      rayGrad.addColorStop(0, 'rgba(254, 243, 199, 0.08)');
      rayGrad.addColorStop(0.5, 'rgba(254, 243, 199, 0.02)');
      rayGrad.addColorStop(1, 'rgba(254, 243, 199, 0)');
      ctx.fillStyle = rayGrad;
      ctx.fillRect(left, top, W * 1.1, viewH * 1.1);
    }

    for (let i = 0; i < 14; i++) {
      const seed = i * 97.3;
      const mx = left + (((seed * 13.7 + this.time * (zone.theme === 'ice' ? 28 : 16)) % (W * 1.1)) + W * 1.1) % (W * 1.1);
      const my =
        top +
        (((seed * 23.1 + this.time * (zone.theme === 'tower' || zone.theme === 'lava' ? -24 : 11)) % (viewH * 1.1)) +
          viewH * 1.1) %
          (viewH * 1.1);

      if (zone.theme === 'town' || zone.theme === 'plains' || zone.theme === 'village') {
        const flutter = Math.sin(this.time * 12 + i) * 3;
        ctx.fillStyle =
          i % 3 === 0 ? 'rgba(254, 240, 138, 0.78)' : i % 3 === 1 ? 'rgba(249, 168, 212, 0.72)' : 'rgba(255, 255, 255, 0.55)';
        ctx.fillRect(Math.round(mx), Math.round(my + flutter), 4, 3);
      } else if (zone.theme === 'ice') {
        ctx.fillStyle = 'rgba(224, 242, 254, 0.78)';
        ctx.fillRect(Math.round(mx), Math.round(my), 3, 3);
      } else if (zone.theme === 'tower' || zone.theme === 'lava') {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(251, 146, 60, 0.78)' : 'rgba(254, 240, 138, 0.68)';
        ctx.fillRect(Math.round(mx + Math.sin(this.time * 4 + i) * 6), Math.round(my), 3, 3);
      } else {
        ctx.fillStyle = 'rgba(125, 211, 252, 0.54)';
        ctx.fillRect(Math.round(mx), Math.round(my + Math.sin(this.time * 2 + i) * 5), 3, 3);
      }
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // PASS 3: Chronicles+ Dungeon Radial Torchlight Darkness (Screenshot #2!)
  // ---------------------------------------------------------------------------
  private drawDungeonTorchlight(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    adolScreenX: number,
    adolScreenY: number
  ): void {
    const pulse = Math.sin(this.time * 5.4) * 6;
    const grad = ctx.createRadialGradient(
      adolScreenX,
      adolScreenY,
      78 + pulse * 0.4,
      adolScreenX,
      adolScreenY,
      248 + pulse
    );
    grad.addColorStop(0, 'rgba(254, 215, 170, 0.04)');
    grad.addColorStop(0.55, 'rgba(6, 8, 16, 0.36)');
    grad.addColorStop(0.84, 'rgba(3, 5, 12, 0.88)');
    grad.addColorStop(1, 'rgba(1, 2, 6, 0.97)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // ---------------------------------------------------------------------------
  // PASS 4: RPG-JS (RSamaium/RPG-JS) FROSTED INDIGO-SLATE JRPG HUD & GUI!
  // ---------------------------------------------------------------------------
  private drawRpgJsWindow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    radius = 9,
    borderColor = 'rgba(226, 232, 240, 0.88)'
  ): void {
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, 'rgba(24, 36, 78, 0.88)');
    grad.addColorStop(0.55, 'rgba(15, 23, 54, 0.9)');
    grad.addColorStop(1, 'rgba(9, 15, 36, 0.94)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fill();

    // Crisp outer luminous white-silver RPG-JS window frame
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Subtle inner indigo-cyan double trim line
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.34)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x + 2.5, y + 2.5, w - 5, h - 5, Math.max(2, radius - 2));
    ctx.stroke();
  }

  private drawRpgJsBar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    frac: number,
    topColor: string,
    botColor: string
  ): void {
    const clamped = Math.max(0, Math.min(1, frac));
    ctx.fillStyle = 'rgba(7, 11, 26, 0.88)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h * 0.5);
    ctx.fill();

    if (clamped > 0.005) {
      const barGrad = ctx.createLinearGradient(x, y, x, y + h);
      barGrad.addColorStop(0, topColor);
      barGrad.addColorStop(1, botColor);
      ctx.fillStyle = barGrad;
      ctx.beginPath();
      ctx.roundRect(x + 1, y + 1, Math.max(h - 2, (w - 2) * clamped), h - 2, (h - 2) * 0.5);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(203, 213, 225, 0.42)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h * 0.5);
    ctx.stroke();
  }

  private drawAdolMiniAvatar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
    ctx.save();
    // Glowing RPG-JS portrait medallion
    const bg = ctx.createRadialGradient(cx - 4, cy - 5, 2, cx, cy, r);
    bg.addColorStop(0, '#3b5998');
    bg.addColorStop(1, '#0f172a');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1.5, 0, Math.PI * 2);
    ctx.clip();

    // Armor shoulders & red tunic scarf
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.82, r * 0.85, r * 0.58, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(cx - r * 0.38, cy + r * 0.36, r * 0.76, r * 0.24);

    // Warm anime face
    ctx.fillStyle = '#fed7aa';
    ctx.beginPath();
    ctx.arc(cx, cy + 1, r * 0.48, 0, Math.PI * 2);
    ctx.fill();

    // Crisp expressive eyes
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(cx - 5, cy + 1, 3, 3.5);
    ctx.fillRect(cx + 2, cy + 1, 3, 3.5);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 4.5, cy + 1.2, 1.4, 1.4);
    ctx.fillRect(cx + 2.5, cy + 1.2, 1.4, 1.4);

    // Signature crimson windswept Adol hair
    const hGrad = ctx.createLinearGradient(cx, cy - r, cx, cy + 4);
    hGrad.addColorStop(0, '#f87171');
    hGrad.addColorStop(0.55, '#dc2626');
    hGrad.addColorStop(1, '#991b1b');
    ctx.fillStyle = hGrad;
    ctx.beginPath();
    ctx.arc(cx, cy - 2, r * 0.58, Math.PI * 0.96, Math.PI * 0.04);
    ctx.lineTo(cx + r * 0.55, cy + 3);
    ctx.lineTo(cx + r * 0.28, cy - 4);
    ctx.lineTo(cx + 1, cy + 1);
    ctx.lineTo(cx - r * 0.28, cy - 4);
    ctx.lineTo(cx - r * 0.55, cy + 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Crisp silver-gold ring border
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawChroniclesTopLeftStats(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const x = 12;
    const y = 12;
    const w = 234;
    const h = 92;

    // RPG-JS Hero Status Card
    this.drawRpgJsWindow(ctx, x, y, w, h, 10);

    // Circular Adol Portrait Medallion + LV Pill
    const avCx = x + 30;
    const avCy = y + 36;
    this.drawAdolMiniAvatar(ctx, avCx, avCy, 20);

    ctx.fillStyle = '#1d4ed8';
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(avCx - 17, avCy + 14, 34, 14, 4);
    ctx.fill();
    ctx.stroke();
    ctx.font = '800 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fef08a';
    ctx.fillText(`LV.${this.level}`, avCx, avCy + 24);

    // Right Column: Hero Name + Gold Coin Badge
    const rx = x + 58;
    const rw = w - 68;
    ctx.font = '800 11.5px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText('Adol Christin', rx, y + 20);

    ctx.font = '800 10.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fde047';
    ctx.fillText(`${this.gold} G`, x + w - 10, y + 20);

    // HP Bar (Emerald RPG-JS pill bar)
    const hpFrac = this.hp / Math.max(1, this.maxHp);
    ctx.font = '800 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#86efac';
    ctx.fillText('HP', rx, y + 35);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(`${Math.ceil(this.hp)}/${this.maxHp}`, x + w - 10, y + 35);
    this.drawRpgJsBar(ctx, rx + 20, y + 27, rw - 66, 9, hpFrac, '#4ade80', '#15803d');

    // MP Bar (Ys II) or EXP Progress Bar
    const expFrac = this.exp / Math.max(1, this.expNext);
    if (this.variant === 'ys2') {
      const mpFrac = this.mp / Math.max(1, this.maxMp);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#7dd3fc';
      ctx.fillText('MP', rx, y + 51);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#e0f2fe';
      ctx.fillText(`${Math.ceil(this.mp)}/${this.maxMp}`, x + w - 10, y + 51);
      this.drawRpgJsBar(ctx, rx + 20, y + 43, rw - 66, 9, mpFrac, '#38bdf8', '#0369a1');
    } else {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fde047';
      ctx.fillText('EXP', rx, y + 51);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fef9c3';
      ctx.fillText(`${this.exp}/${this.expNext}`, x + w - 10, y + 51);
      this.drawRpgJsBar(ctx, rx + 24, y + 43, rw - 76, 9, expFrac, '#facc15', '#b45309');
    }

    // Compact STR / DEF + Equipment Tier Strip
    ctx.fillStyle = 'rgba(15, 23, 42, 0.56)';
    ctx.beginPath();
    ctx.roundRect(x + 8, y + 66, w - 16, 19, 5);
    ctx.fill();

    ctx.font = '700 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#cbd5e1';
    const swordShort = this.WEAPONS[this.weaponTier].name.replace(' Sword', '');
    ctx.fillText(`STR ${this.getEffectiveAtk()} · DEF ${this.getEffectiveDef()}`, x + 14, y + 79);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#93c5fd';
    ctx.fillText(`${swordShort}`, x + w - 14, y + 79);
    ctx.restore();
  }

  private drawChroniclesZoneAndMiniMap(ctx: CanvasRenderingContext2D, zone: ZoneDef, W: number): void {
    ctx.save();
    const mw = 136;
    const mx = W - mw - 12;
    const my = 12;

    // RPG-JS Frosted Zone Header + Minimap Container
    this.drawRpgJsWindow(ctx, mx, my, mw, 114, 10);

    // Zone Name Pill Strip at top of Minimap Card
    ctx.fillStyle = 'rgba(30, 58, 138, 0.55)';
    ctx.beginPath();
    ctx.roundRect(mx + 6, my + 6, mw - 12, 18, 5);
    ctx.fill();

    ctx.font = '800 9.5px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fef08a';
    const zTitle = zone.name.length > 18 ? `${zone.name.slice(0, 17)}…` : zone.name;
    ctx.fillText(zTitle, mx + mw * 0.5, my + 18.5);

    // Embedded Live Minimap
    this.drawMiniMap(ctx, zone, mx + 6, my + 27, mw - 12, 80);

    // Interactive RPG-JS 90°-Stepped 45° Camera & Compass Strip right beneath Minimap!
    const badgeY = my + 118;
    this.drawRpgJsWindow(ctx, mx, badgeY, mw, 32, 7, 'rgba(125, 211, 252, 0.78)');
    const compass = this.getCameraCompassInfo();
    const modeLabel =
      this.cameraZoomMode === 'close45'
        ? 'CLOSE'
        : this.cameraZoomMode === 'fullmap45'
          ? 'FULL'
          : this.cameraZoomMode === 'wide45'
            ? 'WIDE'
            : 'EVO';
    const zoomPct = Math.round((1 / this.cameraZoomScale) * 100);
    ctx.font = '800 8px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fef08a';
    ctx.fillText(`LOOK ${compass.dir} · ${modeLabel} ${zoomPct}%`, mx + mw * 0.5, badgeY + 13);
    ctx.font = '700 7px "JetBrains Mono", monospace';
    ctx.fillStyle = '#93c5fd';
    ctx.fillText('[Q/E] ↺90° · [V] VIEW · [R] RESET', mx + mw * 0.5, badgeY + 25);

    // Compact Live Calendar (Day of Week), Clock & Weather Widget!
    const calY = badgeY + 36;
    const meta = this.getDayTimeMeta();
    const weatherCol =
      this.weather === 'storm'
        ? '#c084fc'
        : this.weather === 'rain'
          ? '#7dd3fc'
          : this.weather === 'snow'
            ? '#e2e8f0'
            : this.weather === 'breezy'
              ? '#86efac'
              : meta.period === 'NIGHT'
                ? '#a5b4fc'
                : '#fde047';
    this.drawRpgJsWindow(ctx, mx, calY, mw, 36, 7, 'rgba(186, 230, 253, 0.72)');
    ctx.font = '800 8.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = meta.isMarketDay ? '#fde047' : '#f8fafc';
    ctx.fillText(`${meta.dayShort} D${this.dayNumber}`, mx + 8, calY + 13.5);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#bae6fd';
    ctx.fillText(meta.timeStr, mx + mw - 8, calY + 13.5);

    ctx.font = '700 7.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = weatherCol;
    ctx.fillText(meta.weatherLabel, mx + 8, calY + 27);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('[T]+3H · [G]SKY', mx + mw - 8, calY + 27);

    // Directional Wind & 45°-Aligned N/S/E/W Looking Compass Rose Map!
    const windY = calY + 40;
    const windH = 84;
    this.drawRpgJsWindow(ctx, mx, windY, mw, windH, 8, 'rgba(103, 232, 249, 0.76)');
    const wind = this.getWindPhysics();
    const cx = mx + 38;
    const cy = windY + windH * 0.5;
    const rad = 28;

    // Dial Background & Concentric Compass Rings
    const dialGrad = ctx.createRadialGradient(cx, cy - 4, 3, cx, cy, rad);
    dialGrad.addColorStop(0, 'rgba(15, 38, 72, 0.92)');
    dialGrad.addColorStop(1, 'rgba(7, 16, 36, 0.96)');
    ctx.fillStyle = dialGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.48)';
    ctx.lineWidth = 1.25;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(cx, cy, rad * 0.55, 0, Math.PI * 2);
    ctx.stroke();

    // 8-point compass ticks (N=up along 45° normal view!)
    for (let ti = 0; ti < 8; ti++) {
      const ta = (ti * Math.PI) / 4 - Math.PI * 0.5;
      const inner = ti % 2 === 0 ? rad - 4.5 : rad - 3;
      ctx.strokeStyle = ti === 0 ? 'rgba(251, 191, 36, 0.85)' : 'rgba(148, 163, 184, 0.45)';
      ctx.lineWidth = ti % 2 === 0 ? 1.2 : 0.8;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ta) * inner, cy + Math.sin(ta) * inner);
      ctx.lineTo(cx + Math.cos(ta) * rad, cy + Math.sin(ta) * rad);
      ctx.stroke();
    }

    // Live Looking Direction View Cone (aligned so 45° normal view points straight UP = North!)
    const lookCompassRad = -(this.cameraYaw - Math.PI * 0.25);
    const lookCanvasAng = lookCompassRad - Math.PI * 0.5;
    const coneHalf = 0.42;
    const coneGrad = ctx.createRadialGradient(cx, cy, 1, cx, cy, rad - 2);
    coneGrad.addColorStop(0, 'rgba(251, 191, 36, 0.46)');
    coneGrad.addColorStop(1, 'rgba(251, 191, 36, 0.04)');
    ctx.fillStyle = coneGrad;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, rad - 2, lookCanvasAng - coneHalf, lookCanvasAng + coneHalf);
    ctx.closePath();
    ctx.fill();

    // Bright Golden Looking Pointer Needle
    const lookTipX = cx + Math.cos(lookCanvasAng) * (rad - 6.5);
    const lookTipY = cy + Math.sin(lookCanvasAng) * (rad - 6.5);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(lookTipX, lookTipY);
    ctx.stroke();
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(lookTipX, lookTipY, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Animated Directional Wind Streamlines & Cyan Wind Vector Arrow!
    const windCanvasAng = wind.compassRad - Math.PI * 0.5;
    const wCos = Math.cos(windCanvasAng);
    const wSin = Math.sin(windCanvasAng);
    const pCos = -wSin;
    const pSin = wCos;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, rad - 3, 0, Math.PI * 2);
    ctx.clip();
    for (let si = -1; si <= 1; si++) {
      const flow = ((this.time * (0.45 + wind.speed * 0.18) + (si + 1) * 0.33) % 1) * 2 - 1;
      const sx = cx + wCos * (flow * 20) + pCos * (si * 9);
      const sy = cy + wSin * (flow * 20) + pSin * (si * 9);
      ctx.strokeStyle = 'rgba(103, 232, 249, 0.42)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(sx - wCos * 5.5, sy - wSin * 5.5);
      ctx.lineTo(sx + wCos * 5.5, sy + wSin * 5.5);
      ctx.stroke();
    }
    ctx.restore();

    const wStartX = cx - wCos * 12;
    const wStartY = cy - wSin * 12;
    const wEndX = cx + wCos * 16.5;
    const wEndY = cy + wSin * 16.5;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(wStartX, wStartY);
    ctx.lineTo(wEndX, wEndY);
    ctx.stroke();
    // Crisp Wind Arrowhead
    ctx.fillStyle = '#67e8f9';
    ctx.beginPath();
    ctx.moveTo(wEndX + wCos * 2.4, wEndY + wSin * 2.4);
    ctx.lineTo(wEndX - wCos * 4.5 + pCos * 3.8, wEndY - wSin * 4.5 + pSin * 3.8);
    ctx.lineTo(wEndX - wCos * 4.5 - pCos * 3.8, wEndY - wSin * 4.5 - pSin * 3.8);
    ctx.closePath();
    ctx.fill();

    // Center Compass Pivot Pin
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(cx, cy, 2.3, 0, Math.PI * 2);
    ctx.fill();

    // Cardinal Labels (N at top aligned to 45° normal view!)
    ctx.font = '800 7.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde047';
    ctx.fillText('N', cx, cy - rad + 7);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('S', cx, cy + rad - 6.5);
    ctx.fillText('E', cx + rad - 6.5, cy);
    ctx.fillText('W', cx - rad + 7, cy);
    ctx.textBaseline = 'alphabetic';

    // Right Column Telemetry Readouts (Looking Direction + Live Wind Heading & Speed)
    const infoX = mx + 74;
    ctx.textAlign = 'left';
    ctx.font = '700 6.8px "JetBrains Mono", monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('LOOKING', infoX, windY + 17);
    ctx.font = '800 10.5px "JetBrains Mono", monospace';
    ctx.fillStyle = '#fde047';
    ctx.fillText(`${compass.dir}`, infoX, windY + 29);
    ctx.font = '700 7.2px "JetBrains Mono", monospace';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(`${compass.compassDeg}°`, infoX + 22, windY + 29);

    ctx.font = '700 6.8px "JetBrains Mono", monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('WIND', infoX, windY + 45);
    ctx.font = '800 10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#67e8f9';
    ctx.fillText(`${wind.label}`, infoX, windY + 57);
    ctx.font = '700 7.5px "JetBrains Mono", monospace';
    ctx.fillStyle = '#bae6fd';
    ctx.fillText(`${wind.knots}KT`, infoX + 24, windY + 57);

    ctx.font = '700 6.8px "JetBrains Mono", monospace';
    ctx.fillStyle = '#7dd3fc';
    ctx.fillText('[B] SHIFT', infoX, windY + 73);
    ctx.restore();
  }

  private drawChroniclesBottomHud(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    ctx.save();

    // 1. TOP-CENTER: Sleek RPG-JS Target Enemy / Boss Status Bar (only when engaged!)
    const targetEnemy =
      this.activeBoss && this.activeBoss.hp > 0
        ? { name: this.activeBoss.name, hp: this.activeBoss.hp, maxHp: this.activeBoss.maxHp, isBoss: true }
        : this.engagedEnemy
          ? { name: this.engagedEnemy.name, hp: this.engagedEnemy.hp, maxHp: this.engagedEnemy.maxHp, isBoss: false }
          : null;

    if (targetEnemy) {
      const ew = 248;
      const eh = 38;
      const ex = Math.round(W * 0.5 - ew * 0.5);
      const ey = 12;
      this.drawRpgJsWindow(
        ctx,
        ex,
        ey,
        ew,
        eh,
        9,
        targetEnemy.isBoss ? 'rgba(251, 191, 36, 0.92)' : 'rgba(248, 113, 113, 0.88)'
      );
      ctx.font = '800 10px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = targetEnemy.isBoss ? '#fde047' : '#fecdd3';
      ctx.fillText(targetEnemy.isBoss ? `★ ${targetEnemy.name}` : targetEnemy.name, ex + 10, ey + 15);
      ctx.font = '800 9.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(`${Math.ceil(targetEnemy.hp)}/${targetEnemy.maxHp}`, ex + ew - 10, ey + 15);
      this.drawRpgJsBar(
        ctx,
        ex + 10,
        ey + 21,
        ew - 20,
        9,
        targetEnemy.hp / Math.max(1, targetEnemy.maxHp),
        targetEnemy.isBoss ? '#fb923c' : '#fb7185',
        '#991b1b'
      );
    }

    // 2. BOTTOM-CENTER: RPG-JS Frosted Action / Skill / Item Hotbar (keeps 3D center 100% open!)
    if (!this.dialogue) {
      const hint = this.getActiveQuestHint();
      ctx.font = '700 9.5px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      const hintTxt = hint.length > 54 ? `${hint.slice(0, 52)}…` : hint;
      const hw = Math.min(W - 40, Math.max(210, ctx.measureText(hintTxt).width + 26));
      const dockW = 434;
      const dockH = 48;
      const dockX = Math.round(W * 0.5 - dockW * 0.5);
      const dockY = H - dockH - 10;

      // Subtle RPG-JS quest tracker whisper strip sitting neatly above the bottom hotbar
      ctx.fillStyle = 'rgba(15, 23, 52, 0.82)';
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(W * 0.5 - hw * 0.5, dockY - 22, hw, 18, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fef08a';
      ctx.fillText(hintTxt, W * 0.5, dockY - 9.5);

      // Main RPG-JS 6-Slot Hotbar Dock (including [C] Scavenger Satchel!)
      this.drawRpgJsWindow(ctx, dockX, dockY, dockW, dockH, 10);

      const slots: Array<{ key: string; title: string; value: string; accent: string; kind: 'sword' | 'magic' | 'herb' | 'bag' | 'ring' | 'relic' }> = [
        {
          key: 'SPC',
          title: 'ACTION',
          value: this.WEAPONS[this.weaponTier].name.split(' ')[0],
          accent: '#38bdf8',
          kind: 'sword',
        },
        {
          key: 'SHF',
          title: this.variant === 'ys2' ? 'FIRE' : 'MAP',
          value: this.variant === 'ys2' ? `${Math.ceil(this.mp)} MP` : 'CHART',
          accent: this.variant === 'ys2' ? '#fb923c' : '#a78bfa',
          kind: 'magic',
        },
        {
          key: 'C',
          title: 'BAG',
          value: `x${this.getTotalBagCount()}`,
          accent: this.speedBuffTimer > 0 ? '#2dd4bf' : '#34d399',
          kind: 'bag',
        },
        {
          key: 'HRB',
          title: 'HERB',
          value: `x${this.herbs}`,
          accent: this.herbs > 0 ? '#4ade80' : '#64748b',
          kind: 'herb',
        },
        {
          key: 'RNG',
          title: 'RING',
          value:
            this.equippedRing === 'power'
              ? 'PWR'
              : this.equippedRing === 'shield'
                ? 'SHD'
                : this.equippedRing === 'time'
                  ? 'TIM'
                  : 'NONE',
          accent:
            this.equippedRing === 'power'
              ? '#f97316'
              : this.equippedRing === 'shield'
                ? '#38bdf8'
                : this.equippedRing === 'time'
                  ? '#c084fc'
                  : '#64748b',
          kind: 'ring',
        },
        {
          key: 'YS',
          title: this.variant === 'ys1' ? 'BOOKS' : 'CRESTS',
          value: `${this.booksCollected}/${this.totalBooks} ★${this.secretsFound}`,
          accent: '#facc15',
          kind: 'relic',
        },
      ];

      const slotGap = 6;
      const slotW = (dockW - 16 - slotGap * (slots.length - 1)) / slots.length;
      const slotH = 36;
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        const sx = dockX + 8 + i * (slotW + slotGap);
        const sy = dockY + 6;
        ctx.fillStyle = 'rgba(9, 14, 34, 0.78)';
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.roundRect(sx, sy, slotW, slotH, 6);
        ctx.fill();
        ctx.stroke();

        // Top color accent strip
        ctx.fillStyle = s.accent;
        ctx.fillRect(sx + 4, sy + 2, slotW - 8, 2);

        // Keycap badge
        ctx.font = '800 7.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(s.key, sx + 5, sy + 13);

        ctx.textAlign = 'right';
        ctx.fillStyle = s.accent;
        ctx.fillText(s.title, sx + slotW - 5, sy + 13);

        ctx.font = '800 9.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(s.value, sx + slotW * 0.5, sy + 29);
      }
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // Live Compact Mini-Map & Full World Exploration Chart (RPG-JS Style)
  // ---------------------------------------------------------------------------
  private drawMiniMap(ctx: CanvasRenderingContext2D, zone: ZoneDef, x: number, y: number, w: number, h: number): void {
    ctx.save();
    ctx.fillStyle = 'rgba(10, 16, 36, 0.92)';
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.52)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 5);
    ctx.fill();
    ctx.stroke();

    const cw = (w - 6) / zone.width;
    const ch = (h - 6) / zone.height;
    for (let r = 0; r < zone.height; r++) {
      for (let c = 0; c < zone.width; c++) {
        const t = zone.tiles[r][c];
        ctx.fillStyle =
          t === 1 || t === 5
            ? '#64748b'
            : t === 3
              ? '#0284c7'
              : t === 6 || t === 4
                ? '#e2b675'
                : t === 2 || t === 9
                  ? '#15803d'
                  : zone.theme === 'shrine' || zone.theme === 'tower' || zone.theme === 'lava'
                    ? '#334155'
                    : '#22a055';
        ctx.fillRect(x + 3 + c * cw, y + 3 + r * ch, Math.ceil(cw), Math.ceil(ch));
      }
    }

    for (const p of zone.portals) {
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(x + 3 + p.tx * cw, y + 3 + p.ty * ch, Math.max(4, p.widthTiles * cw), Math.max(3, p.heightTiles * ch));
    }
    for (const chObj of zone.chests) {
      if (this.openedChests.has(chObj.id)) continue;
      ctx.fillStyle = '#fde047';
      ctx.fillRect(x + 3 + chObj.tx * cw - 1, y + 3 + chObj.ty * ch - 1, 3, 3);
    }
    for (const npc of zone.npcs) {
      const pos = this.getNpcWorldPos(npc);
      ctx.fillStyle = npc.role === 'quest' ? '#fde047' : npc.secondary ? '#5eead4' : '#f472b6';
      ctx.fillRect(x + 3 + (pos.x / TILE) * cw - 1, y + 3 + (pos.y / TILE) * ch - 1, npc.secondary ? 2.2 : 3, npc.secondary ? 2.2 : 3);
    }

    const ax = x + 3 + (this.px / TILE) * cw;
    const ay = y + 3 + (this.py / TILE) * ch;
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.95)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax + Math.cos(this.bodyAngle) * 7, ay + Math.sin(this.bodyAngle) * 7);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ax, ay, 2.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawFullMapOverlay(ctx: CanvasRenderingContext2D, zone: ZoneDef, W: number, viewH: number): void {
    ctx.save();
    ctx.fillStyle = 'rgba(7, 11, 28, 0.88)';
    ctx.fillRect(0, 0, W, viewH);

    const px = 34;
    const py = 26;
    const pw = W - 68;
    const ph = viewH - 52;
    this.drawRpgJsWindow(ctx, px, py, pw, ph, 12);

    const mx = px + 18;
    const my = py + 18;
    const mw = pw - 36;
    const mh = ph - 126;
    this.drawMiniMap(ctx, zone, mx, my, mw, mh);

    ctx.fillStyle = '#fef08a';
    ctx.font = '800 17px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${zone.name} · WORLD MAP`, W * 0.5, my + mh + 28);

    ctx.fillStyle = '#f1f5f9';
    ctx.font = '600 12.5px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(this.getActiveQuestHint(), W * 0.5, my + mh + 52);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 10.5px "JetBrains Mono", monospace';
    ctx.fillText(
      `Cyan = Zone Portals · Gold = Quest/Chests · Pink = Citizens · Secrets: ${this.secretsFound}`,
      W * 0.5,
      my + mh + 74
    );
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('Press [SPACE] or [SHIFT] to return to adventure', W * 0.5, my + mh + 96);
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // CHRONICLES+ LARGE HALF-BODY RIGHT-SIDE ANIME BUST & TWIN-GODDESS DIALOGUE
  // ---------------------------------------------------------------------------
  private drawLargeAnimeBust(
    ctx: CanvasRenderingContext2D,
    id: PortraitId,
    cx: number,
    bottomY: number,
    speakerNpc?: WorldNpc
  ): void {
    ctx.save();
    ctx.translate(cx, bottomY);

    const hairMap: Record<PortraitId, [string, string, string]> = {
      adol: ['#f87171', '#dc2626', '#7f1d1d'],
      sara: ['#fef08a', '#eab308', '#a16207'],
      feena: ['#93c5fd', '#3b82f6', '#1d4ed8'],
      lilia: ['#fda4af', '#e11d48', '#881337'],
      merchant: ['#fbbf24', '#b45309', '#78350f'],
      darkfact: ['#d8b4fe', '#7e22ce', '#3b0764'],
      dalles: ['#f87171', '#991b1b', '#450a0a'],
      elder: ['#f8fafc', '#cbd5e1', '#64748b'],
    };
    const outfitMap: Record<PortraitId, [string, string, string]> = {
      adol: ['#e2e8f0', '#dc2626', '#fbbf24'],
      sara: ['#7c3aed', '#4c1d95', '#facc15'],
      feena: ['#f0f9ff', '#38bdf8', '#fde047'],
      lilia: ['#f43f5e', '#fff1f2', '#fb7185'],
      merchant: ['#b45309', '#78350f', '#fde68a'],
      darkfact: ['#1e1b4b', '#6b21a8', '#c084fc'],
      dalles: ['#450a0a', '#991b1b', '#f87171'],
      elder: ['#334155', '#1e293b', '#cbd5e1'],
    };

    const isChildNpc = Boolean(speakerNpc && (speakerNpc.ageGroup === 'child' || speakerNpc.task === 'play'));
    const isElderNpc = Boolean(speakerNpc && (speakerNpc.ageGroup === 'elder' || speakerNpc.portrait === 'elder'));
    const isBakerNpc = Boolean(speakerNpc && (speakerNpc.role === 'bakery' || speakerNpc.task === 'baker'));
    const isGuardNpc = Boolean(speakerNpc && speakerNpc.task === 'patrol');
    const isSmithNpc = Boolean(speakerNpc && (speakerNpc.role === 'weapon' || speakerNpc.role === 'armor' || speakerNpc.task === 'hammer' || speakerNpc.task === 'craft'));

    if (isChildNpc) {
      ctx.scale(0.84, 0.84);
    }

    const [baseHi, baseMid, baseLo] = hairMap[id];
    const hairHi = speakerNpc ? speakerNpc.hairColor : baseHi;
    const hairMid = speakerNpc ? speakerNpc.hairColor : baseMid;
    const hairLo = speakerNpc ? '#1e293b' : baseLo;

    const [baseCoat, baseSub, baseTrim] = outfitMap[id];
    const coatMain = speakerNpc ? speakerNpc.tunicColor : baseCoat;
    const coatSub = speakerNpc ? speakerNpc.cloakColor : baseSub;
    const trimCol = speakerNpc
      ? isBakerNpc
        ? '#fef3c7'
        : isGuardNpc
          ? '#e2e8f0'
          : '#facc15'
      : baseTrim;

    const isFemale =
      id === 'feena' ||
      id === 'lilia' ||
      id === 'sara' ||
      Boolean(speakerNpc && (speakerNpc.task === 'garden' || speakerNpc.task === 'serve' || speakerNpc.task === 'water_carry'));

    // Soft anime rim glow behind character bust
    const aura = ctx.createRadialGradient(0, -110, 12, 0, -110, 118);
    aura.addColorStop(0, 'rgba(255, 255, 255, 0.24)');
    aura.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, -110, 118, 0, Math.PI * 2);
    ctx.fill();

    // Long flowing back-hair cascade
    if (isFemale || id === 'darkfact') {
      const backGrad = ctx.createLinearGradient(-46, -180, 46, 0);
      backGrad.addColorStop(0, hairMid);
      backGrad.addColorStop(1, hairLo);
      ctx.fillStyle = backGrad;
      ctx.beginPath();
      ctx.moveTo(-42, -162);
      ctx.quadraticCurveTo(-62, -90, -54, 4);
      ctx.lineTo(54, 4);
      ctx.quadraticCurveTo(62, -90, 42, -162);
      ctx.closePath();
      ctx.fill();
    }

    // Half-Body Shoulders, Draped Cloak & Armor / Tunic matching exact speaker colors!
    const bodyGrad = ctx.createLinearGradient(-56, -98, 56, 4);
    bodyGrad.addColorStop(0, coatMain);
    bodyGrad.addColorStop(1, coatSub);
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(-68, 4);
    ctx.quadraticCurveTo(-62, -74, -22, -92);
    ctx.lineTo(22, -92);
    ctx.quadraticCurveTo(62, -74, 68, 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.65)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Guard / Smith armored pauldrons or apron detail
    if (isGuardNpc || isSmithNpc) {
      ctx.fillStyle = isGuardNpc ? '#94a3b8' : '#78350f';
      ctx.beginPath();
      ctx.ellipse(-44, -62, 18, 13, -0.35, 0, Math.PI * 2);
      ctx.ellipse(44, -62, 18, 13, 0.35, 0, Math.PI * 2);
      ctx.fill();
    } else if (isBakerNpc) {
      ctx.fillStyle = '#fffbeb';
      ctx.fillRect(-26, -78, 52, 82);
    }

    // Decorative collar, brooch & lapel trim
    ctx.strokeStyle = trimCol;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-24, -88);
    ctx.lineTo(0, -44);
    ctx.lineTo(24, -88);
    ctx.stroke();
    ctx.fillStyle = trimCol;
    ctx.beginPath();
    ctx.arc(0, -48, 6, 0, Math.PI * 2);
    ctx.fill();

    // Slender Neck & Warm Cel-Shaded Anime Face
    ctx.fillStyle = id === 'darkfact' || id === 'dalles' ? '#94a3b8' : '#f5b889';
    ctx.fillRect(-11, -110, 22, 24);
    ctx.fillStyle = 'rgba(120, 53, 15, 0.16)';
    ctx.beginPath();
    ctx.ellipse(0, -104, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    const faceGrad = ctx.createRadialGradient(-8, -142, 6, 0, -138, 42);
    if (id === 'darkfact' || id === 'dalles') {
      faceGrad.addColorStop(0, '#e2e8f0');
      faceGrad.addColorStop(1, '#94a3b8');
    } else {
      faceGrad.addColorStop(0, '#fff1e2');
      faceGrad.addColorStop(0.75, '#fed7aa');
      faceGrad.addColorStop(1, '#f5b889');
    }
    ctx.fillStyle = faceGrad;
    ctx.beginPath();
    ctx.moveTo(-30, -152);
    ctx.quadraticCurveTo(-32, -116, 0, -102);
    ctx.quadraticCurveTo(32, -116, 30, -152);
    ctx.quadraticCurveTo(28, -182, 0, -182);
    ctx.quadraticCurveTo(-28, -182, -30, -152);
    ctx.closePath();
    ctx.fill();

    // Rosy cheeks for children
    if (isChildNpc) {
      ctx.fillStyle = 'rgba(251, 113, 133, 0.28)';
      ctx.beginPath();
      ctx.ellipse(-18, -126, 6.5, 3.6, 0, 0, Math.PI * 2);
      ctx.ellipse(18, -126, 6.5, 3.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Expressive Large Chronicles+ Anime Eyes with Specular Highlights & Lashes
    const eyeY = -138;
    const eyeR = isChildNpc ? 1.12 : 1.0;
    const irisCol = id === 'darkfact' || id === 'dalles' ? '#ef4444' : id === 'feena' ? '#2563eb' : id === 'lilia' ? '#059669' : '#1e3a8a';
    for (const side of [-1, 1]) {
      const ex = side * 13.5;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, 8.2 * eyeR, 6.8 * eyeR, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = irisCol;
      ctx.beginPath();
      ctx.ellipse(ex - side * 0.6, eyeY + 0.5, 5.4 * eyeR, 6.0 * eyeR, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(ex - side * 0.6, eyeY + 0.8, 2.8 * eyeR, 0, Math.PI * 2);
      ctx.fill();
      // Crisp double anime eye catchlights
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex - 2.4, eyeY - 2.2, 2.2, 0, Math.PI * 2);
      ctx.arc(ex + 2.0, eyeY + 2.4, 1.1, 0, Math.PI * 2);
      ctx.fill();
      // Upper eyelash arc
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(ex, eyeY + 1, 8.5 * eyeR, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }

    // Subtle nose, expression mouth & optional Elder Beard
    ctx.fillStyle = 'rgba(154, 52, 18, 0.35)';
    ctx.fillRect(-1, -126, 2, 4);
    if (isElderNpc && !isFemale) {
      ctx.fillStyle = hairHi;
      ctx.beginPath();
      ctx.moveTo(-20, -118);
      ctx.quadraticCurveTo(0, -82, 20, -118);
      ctx.quadraticCurveTo(0, -108, -20, -118);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.strokeStyle = '#9a3412';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, -117, 6, 0.16 * Math.PI, 0.84 * Math.PI);
      ctx.stroke();
    }

    // Layered Anime Hair Crown, Swept Bangs & Side Framing Locks
    const hGrad = ctx.createLinearGradient(0, -196, 0, -120);
    hGrad.addColorStop(0, hairHi);
    hGrad.addColorStop(0.55, hairMid);
    hGrad.addColorStop(1, hairLo);
    ctx.fillStyle = hGrad;
    ctx.beginPath();
    ctx.arc(0, -152, 38, Math.PI * 0.94, Math.PI * 0.06);
    ctx.lineTo(36, -124);
    ctx.lineTo(24, -148);
    ctx.lineTo(14, -134);
    ctx.lineTo(4, -150);
    ctx.lineTo(-4, -132);
    ctx.lineTo(-14, -148);
    ctx.lineTo(-24, -134);
    ctx.lineTo(-36, -124);
    ctx.closePath();
    ctx.fill();

    // Sweeping side hair locks framing cheeks
    ctx.fillStyle = hairMid;
    ctx.beginPath();
    ctx.moveTo(-36, -152);
    ctx.quadraticCurveTo(-42, -112, -28, -86);
    ctx.quadraticCurveTo(-28, -116, -26, -144);
    ctx.closePath();
    ctx.moveTo(36, -152);
    ctx.quadraticCurveTo(42, -112, 28, -86);
    ctx.quadraticCurveTo(28, -116, 26, -144);
    ctx.closePath();
    ctx.fill();

    // Glossy anime hair halo specular sheen
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.48)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -156, 26, Math.PI * 1.18, Math.PI * 1.78);
    ctx.stroke();

    // Signature Character-Specific Headgear & Hair Accessories!
    if (isBakerNpc) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, -196, 30, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillRect(-24, -188, 48, 16);
    } else if (isGuardNpc) {
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.arc(0, -162, 39, Math.PI, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.ellipse(0, -206, 8, 14, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (id === 'sara') {
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, -154, 34, Math.PI * 1.14, Math.PI * 1.86);
      ctx.stroke();
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(0, -187, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (id === 'adol' && !speakerNpc) {
      ctx.fillStyle = hairHi;
      ctx.beginPath();
      ctx.moveTo(-18, -182);
      ctx.lineTo(-6, -206);
      ctx.lineTo(4, -186);
      ctx.lineTo(18, -202);
      ctx.lineTo(22, -180);
      ctx.closePath();
      ctx.fill();
    } else if (id === 'feena' || id === 'lilia' || isFemale) {
      ctx.fillStyle = id === 'feena' ? '#fde047' : '#f472b6';
      ctx.beginPath();
      ctx.arc(27, -166, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef9c3';
      ctx.beginPath();
      ctx.arc(27, -166, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawDialogueOverlay(ctx: CanvasRenderingContext2D, W: number, viewH: number): void {
    const dlg = this.dialogue;
    if (!dlg) return;

    const opts = dlg.shopKind ? this.getShopOptions(dlg.shopKind) : [];
    const bx = 24;
    const bw = W - 48;
    const bh = dlg.shopKind ? Math.min(viewH - 72, Math.max(188, 108 + opts.length * 24)) : 134;
    const by = viewH - bh - 18;

    ctx.save();
    // Light cinematic vignette so the zoomed-in 3D characters speaking stay bright & prominent!
    ctx.fillStyle = 'rgba(6, 10, 26, 0.16)';
    ctx.fillRect(0, 0, W, viewH);

    // Character-Specific Half-Body Right-Side Anime Bust Portrait matching the exact NPC speaking!
    this.drawLargeAnimeBust(ctx, dlg.portrait, W - 104, by + 14, dlg.speakerNpc);

    // Iconic RPG-JS Default-GUI Translucent Indigo-Slate Window with Crisp White-Silver Double Border
    this.drawRpgJsWindow(ctx, bx, by, bw, bh, 11, 'rgba(241, 245, 249, 0.92)');

    // Perched RPG-JS Speaker Name Pill Tab resting on top-left edge of dialogue box
    ctx.font = '800 12.5px "Plus Jakarta Sans", sans-serif';
    const spW = Math.max(118, ctx.measureText(dlg.speaker).width + 28);
    const spX = bx + 18;
    const spY = by - 16;
    this.drawRpgJsWindow(ctx, spX, spY, spW, 28, 7, 'rgba(186, 230, 253, 0.92)');
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fef08a';
    ctx.fillText(dlg.speaker, spX + 14, spY + 18.5);

    // RPG-JS Dialogue Copy with Automatic Cyan Keyword Highlighting
    const tx = bx + 22;
    ctx.font = '600 12px "Plus Jakarta Sans", sans-serif';
    let lineY = by + 32;
    for (const line of dlg.lines) {
      lineY = this.drawHighlightedWrappedLine(ctx, line, tx, lineY, bw - 166, 17.5) + 3;
    }

    if (dlg.shopKind) {
      const rowW = bw - 156;
      let oy = Math.max(by + 88, lineY + 12);
      opts.forEach((o, i) => {
        const sel = i === dlg.cursor;
        if (sel) {
          const selGrad = ctx.createLinearGradient(tx - 8, oy - 13, tx - 8 + rowW, oy - 13);
          selGrad.addColorStop(0, 'rgba(56, 189, 248, 0.34)');
          selGrad.addColorStop(1, 'rgba(59, 130, 246, 0.12)');
          ctx.fillStyle = selGrad;
          ctx.strokeStyle = 'rgba(125, 211, 252, 0.85)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.roundRect(tx - 8, oy - 13, rowW, 21, 6);
          ctx.fill();
          ctx.stroke();
        }
        ctx.textAlign = 'left';
        ctx.font = sel ? '800 11.5px "JetBrains Mono", monospace' : '600 11.5px "JetBrains Mono", monospace';
        ctx.fillStyle = sel ? '#fef08a' : '#e2e8f0';
        ctx.fillText(`${sel ? '▶' : ' '} ${o.label}`, tx, oy + 1.5);

        if (o.desc) {
          ctx.textAlign = 'right';
          ctx.font = '600 10px "JetBrains Mono", monospace';
          ctx.fillStyle = sel ? '#bae6fd' : '#94a3b8';
          ctx.fillText(o.desc, tx - 14 + rowW, oy + 1.5);
        }
        oy += 23.5;
      });
    } else {
      const bounce = Math.sin(this.time * 7) * 2.2;
      ctx.font = '800 10.5px "JetBrains Mono", monospace';
      ctx.fillStyle = '#7dd3fc';
      ctx.textAlign = 'right';
      ctx.fillText('[SPACE] CONTINUE ▼', bx + bw - 22, by + bh - 12 + bounce * 0.5);
    }
    ctx.restore();
  }

  private drawHighlightedWrappedLine(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxW: number,
    lineH: number
  ): number {
    const keywordRe =
      /^(Esteria|Minea|Shrine|Solomon|Darm|Tower|Silver|Crystal|Books?|Ys|Celceta|Blossom|Fire|Magic|Roda|Tree|Sara|Feena|Lilia|Dark|Fact|Gold|Ring|North|Gate|Moondoria|Noltia|Velagunder|Tyalmath|Jenocres|Lance|Heal|Herb)s?[.,!?:’'"]*$/i;
    const words = text.split(' ');
    let curX = x;
    let curY = y;
    const spaceW = ctx.measureText(' ').width;

    for (const w of words) {
      const ww = ctx.measureText(w).width;
      if (curX > x && curX + ww > x + maxW) {
        curX = x;
        curY += lineH;
      }
      ctx.fillStyle = keywordRe.test(w) ? '#38bdf8' : '#f1f5f9';
      ctx.fillText(w, curX, curY);
      curX += ww + spaceW;
    }
    return curY + lineH;
  }
}

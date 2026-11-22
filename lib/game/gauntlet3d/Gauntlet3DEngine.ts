// Genuine Three.js 3D WebGL Engine for Gauntlet: Dark Legacy (Arcade + Console Mechanics)
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  CameraMode,
  DungeonLayout,
  ELEMENT_COLORS,
  ElementColorId,
  generateRealmDungeon,
  getLegendRankTitle,
  HERO_CLASSES,
  HERO_MAP,
  HeroClassId,
  REALM_LIST,
  REALM_MAP,
  RealmId,
  RELIC_DEFS,
  RelicId,
  TileCode,
} from './typesAndData';
import {
  buildBarrelModel,
  buildBossModel,
  buildBrazierModel,
  buildChestModel,
  buildEnemyModel,
  buildGeneratorModel,
  buildHeroModel,
  buildPickupModel,
  buildPortalModel,
  createRealmTextures,
  disposeRealmTextures,
  EnemyKind,
  HeroRig,
  RealmTextureSet,
} from './texturesAndModels';
import { gauntletSfx } from './soundFx';

// Module-scope reusable scratch objects (zero per-frame GC)
const _v3 = new THREE.Vector3();
const _v3b = new THREE.Vector3();
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s3 = new THREE.Vector3();
const _col = new THREE.Color();

const HIGH_SCORE_KEY = 'gauntlet_dark_legacy_hd_highscore_v1';

export interface ActiveRelicTimer {
  id: RelicId;
  remaining: number;
  duration: number;
}

export interface HudSnapshot {
  realmId: RealmId;
  realmName: string;
  isBossArena: boolean;
  isHub: boolean;
  heroId: HeroClassId;
  colorId: ElementColorId;
  heroTitle: string;
  level: number;
  xp: number;
  xpNext: number;
  hp: number;
  maxHp: number;
  turbo: number; // 0..100
  score: number;
  highScore: number;
  gold: number;
  keys: number;
  potions: number;
  runestonesCollected: number;
  totalRunestones: number;
  clearedRealms: RealmId[];
  legendaryWeapons: string[]; // legendary weapon ids collected
  activeRealmLegendaryName: string | null;
  hasMatchingLegendary: boolean;
  inventoryRelics: RelicId[]; // up to 5 carried console relics
  activeRelics: ActiveRelicTimer[];
  boss: {
    name: string;
    hp: number;
    maxHp: number;
    phase: 1 | 2;
    weakened: boolean;
  } | null;
  narratorLine: string;
  narratorSeq: number;
  proximityPrompt: {
    label: string;
    action: 'armory' | 'hero_pedestal' | 'sumner' | 'portal' | 'boss_portal' | 'return_hub';
    realmId?: RealmId;
  } | null;
  stats: {
    strength: number;
    speed: number;
    armor: number;
    magic: number;
  };
  unlockedSecretHeroes: HeroClassId[];
  freeWarp: boolean;
  arcadeDrain: boolean;
  cameraMode: CameraMode;
  gameOver: boolean;
  victory: boolean;
  isSoftwareGl: boolean;
}

interface EnemyEntity {
  id: number;
  kind: EnemyKind;
  mesh: THREE.Group;
  x: number;
  z: number;
  vx: number;
  vz: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  radius: number;
  attackCd: number;
  burnTimer: number;
  freezeTimer: number;
  poisonTimer: number;
  hitFlash: number;
  isBoss?: boolean;
  bossPhase?: 1 | 2;
  bossWeakened?: boolean;
  bossSpecialCd?: number;
}

interface GeneratorEntity {
  id: number;
  tier: 1 | 2 | 3;
  mesh: THREE.Group;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  spawnTimer: number;
  hitFlash: number;
}

interface PropEntity {
  id: number;
  kind:
    | 'chest'
    | 'barrel'
    | 'food_turkey'
    | 'food_ham'
    | 'food_apple'
    | 'poison_cider'
    | 'key'
    | 'potion'
    | 'gold_pile'
    | 'runestone'
    | 'legendary_weapon'
    | 'relic'
    | 'switch'
    | 'brazier'
    | 'boss_portal'
    | 'return_portal'
    | 'hub_portal'
    | 'sumner_npc'
    | 'armory_stand'
    | 'hero_stand';
  mesh: THREE.Group;
  x: number;
  z: number;
  active: boolean;
  relicId?: RelicId;
  realmId?: RealmId;
  runestoneKey?: string;
  legendaryId?: string;
  goldValue?: number;
  triggered?: boolean;
}

interface ProjectileEntity {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  fromPlayer: boolean;
  damage: number;
  life: number;
  piercing: boolean;
  element: 'burn' | 'freeze' | 'shock' | 'poison' | 'enemy';
  radius: number;
}

interface ParticleEntity {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  scale: number;
  color: THREE.Color;
}

interface GateWallRecord {
  tx: number;
  tz: number;
  mesh: THREE.Mesh;
  kind: 'gate' | 'cracked';
  hp: number;
  open: boolean;
}

function detectSoftwareGl(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return true;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererStr = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '';
    const isSw = /SwiftShader|llvmpipe|Software|Mesa OffScreen|ANGLE.*SwiftShader/i.test(rendererStr);
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return isSw;
  } catch {
    return false;
  }
}

export class Gauntlet3DEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private pmremGenerator: THREE.PMREMGenerator;
  private envRT: THREE.WebGLRenderTarget;
  private isSoftwareGl: boolean;
  private maxAniso: number;

  // Dynamic lights
  private hemiLight: THREE.HemisphereLight;
  private keyLight: THREE.DirectionalLight;
  private fillLight: THREE.DirectionalLight;
  private heroLight: THREE.PointLight;
  private fxLight: THREE.PointLight;
  private fxLightTimer = 0;

  // World groups
  private worldGroup = new THREE.Group();
  private entityGroup = new THREE.Group();
  private fxGroup = new THREE.Group();
  private realmTextures: RealmTextureSet | null = null;
  private worldDisposables: Array<{ dispose: () => void }> = [];

  // Particle InstancedMesh pool (zero per-frame mesh allocation)
  private readonly MAX_PARTICLES = 240;
  private particleMesh: THREE.InstancedMesh;
  private particles: ParticleEntity[] = [];

  // Shared projectile geometry
  private projGeo: THREE.SphereGeometry;
  private slashRing: THREE.Mesh;
  private slashTimer = 0;

  // Hero state
  private heroRig: HeroRig | null = null;
  private heroId: HeroClassId = 'knight';
  private colorId: ElementColorId = 'red';
  private heroX = 0;
  private heroZ = 0;
  private heroFacing = Math.PI; // facing north (-Z) initially or south
  private walkCycle = 0;
  private swingTimer = 0;
  private comboStep = 0;
  private comboResetTimer = 0;
  private attackCd = 0;
  private heavyCd = 0;
  private invulnTimer = 0;
  private blocking = false;

  // RPG Progression (Arcade + Console!)
  private level = 1;
  private xp = 0;
  private xpNext = 500;
  private hp = 950;
  private maxHp = 950;
  private turbo = 60;
  private score = 0;
  private highScore = 0;
  private gold = 600;
  private keys = 1;
  private potions = 2;
  private bonusStats = { strength: 0, speed: 0, armor: 0, magic: 0 };
  private collectedRunestones = new Set<string>();
  private clearedRealms = new Set<RealmId>();
  private legendaryWeapons = new Set<string>();
  private unlockedSecretHeroes = new Set<HeroClassId>();
  private inventoryRelics: RelicId[] = ['phoenix', 'three_way'];
  private activeRelics = new Map<RelicId, { remaining: number; duration: number }>();

  // World & Simulation state
  private realmId: RealmId = 'hub';
  private isBossArena = false;
  private layout: DungeonLayout | null = null;
  private bridgeRaised = false;
  private bridgeMeshes: THREE.Mesh[] = [];
  private gateWalls: GateWallRecord[] = [];
  private enemies: EnemyEntity[] = [];
  private generators: GeneratorEntity[] = [];
  private props: PropEntity[] = [];
  private projectiles: ProjectileEntity[] = [];
  private nextEntityId = 1;
  private bossEntity: EnemyEntity | null = null;
  private phoenixShootCd = 0;
  private healthDrainAccum = 0;
  private lowHealthWarnCd = 0;
  private deathSpawnedInRealm = false;

  // Modes & Controls
  private freeWarp = false;
  private arcadeDrain = true;
  private cameraMode: CameraMode = 'arcade';
  private speedMultiplier = 1.0;
  private paused = false;
  private gameOver = false;
  private victory = false;
  private screenShake = 0;

  // Input state
  private keysDown = new Set<string>();
  private virtualMove = { x: 0, z: 0 };
  private tiltMove = { x: 0, z: 0 };
  private pointerAimActive = false;
  private pointerTargetX = 0;
  private pointerTargetZ = 0;
  private pointerHoldAttack = false;
  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  // Camera smoothing
  private camPos = new THREE.Vector3(0, 16, 16);
  private camLook = new THREE.Vector3(0, 0, 0);

  // Narrator & HUD callback
  private narratorLine = 'Welcome to Sumner’s Tower! Walk into a Realm Portal or open the Realm Map to begin!';
  private narratorSeq = 1;
  private hudEmitAccum = 0;
  private onHudUpdate: (snap: HudSnapshot) => void;
  private onOpenModal: (modal: 'armory' | 'hero' | 'portals') => void;

  // Loop lifecycle
  private disposed = false;
  private rafId = 0;
  private swTimerId: ReturnType<typeof setTimeout> | null = null;
  private lastTime = 0;
  private elapsed = 0;
  private resizeObserver: ResizeObserver;

  constructor(
    container: HTMLElement,
    onHudUpdate: (snap: HudSnapshot) => void,
    onOpenModal: (modal: 'armory' | 'hero' | 'portals') => void
  ) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.onOpenModal = onOpenModal;
    this.isSoftwareGl = detectSoftwareGl();

    try {
      const saved = window.localStorage.getItem(HIGH_SCORE_KEY);
      if (saved) this.highScore = Math.max(0, parseInt(saved, 10) || 0);
    } catch {
      // ignore
    }

    const w = Math.max(320, container.clientWidth);
    const h = Math.max(240, container.clientHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.isSoftwareGl ? 1 : 2));
    this.renderer.setSize(w, h);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.maxAniso = this.isSoftwareGl ? 1 : Math.min(8, this.renderer.capabilities.getMaxAnisotropy());

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#1d1510');
    this.scene.fog = new THREE.FogExp2('#1d1510', 0.0155);

    // RoomEnvironment IBL on ALL devices (never skip on software WebGL)
    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.envRT = this.pmremGenerator.fromScene(roomEnv, 0.04);
    this.scene.environment = this.envRT.texture;
    roomEnv.dispose();

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.5, 160);
    this.camera.position.copy(this.camPos);

    // Authentic 2000 Midway Dark Legacy warm torchlit medieval gothic lighting (NO purple/cyan neon wash!)
    this.hemiLight = new THREE.HemisphereLight('#d6b98c', '#291c14', 0.82);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight('#ffdba8', 1.95);
    this.keyLight.position.set(16, 28, 18);
    if (!this.isSoftwareGl) {
      this.keyLight.castShadow = true;
      this.keyLight.shadow.mapSize.set(1024, 1024);
      this.keyLight.shadow.camera.near = 2;
      this.keyLight.shadow.camera.far = 75;
      const d = 22;
      this.keyLight.shadow.camera.left = -d;
      this.keyLight.shadow.camera.right = d;
      this.keyLight.shadow.camera.top = d;
      this.keyLight.shadow.camera.bottom = -d;
      this.keyLight.shadow.bias = -0.0005;
    }
    this.scene.add(this.keyLight);
    this.scene.add(this.keyLight.target);

    this.fillLight = new THREE.DirectionalLight('#8a9bb5', 0.42);
    this.fillLight.position.set(-18, 14, -14);
    this.scene.add(this.fillLight);

    // Warm medieval torchlight following hero
    this.heroLight = new THREE.PointLight('#ffaa44', 2.8, 14, 1.45);
    this.scene.add(this.heroLight);

    this.fxLight = new THREE.PointLight('#fbbf24', 0, 18, 1.4);
    this.scene.add(this.fxLight);

    this.scene.add(this.worldGroup, this.entityGroup, this.fxGroup);

    // Pooled InstancedMesh for 3D spell/combat/gold particles
    const pGeo = new THREE.OctahedronGeometry(0.16, 0);
    const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.particleMesh = new THREE.InstancedMesh(pGeo, pMat, this.MAX_PARTICLES);
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.count = 0;
    this.particleMesh.frustumCulled = false;
    this.fxGroup.add(this.particleMesh);

    this.projGeo = new THREE.SphereGeometry(0.24, 8, 8);

    // 3D Melee Slash Arc VFX
    this.slashRing = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 2.2, 20, 1, -Math.PI * 0.45, Math.PI * 0.9),
      new THREE.MeshBasicMaterial({
        color: 0xff7b3b,
        transparent: true,
        opacity: 0.78,
        side: THREE.DoubleSide,
      })
    );
    this.slashRing.rotation.x = -Math.PI / 2;
    this.slashRing.visible = false;
    this.fxGroup.add(this.slashRing);

    // Resize observer
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    // Build Hero + Sumner's Tower Hub
    this.rebuildHeroMesh();
    this.loadRealm('hub', false);
    this.emitHud();

    // Start paced render loop
    this.lastTime = performance.now();
    this.scheduleNextFrame();
  }

  private handleResize(): void {
    if (this.disposed) return;
    const w = Math.max(320, this.container.clientWidth);
    const h = Math.max(240, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private scheduleNextFrame(): void {
    if (this.disposed) return;
    if (!this.isSoftwareGl) {
      this.rafId = requestAnimationFrame(this.loop);
      return;
    }
    // Software WebGL pacing with gl.fenceSync + 80ms breathing room
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const waitSync = () => {
        if (this.disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        if (sync && gl.clientWaitSync(sync, 0, 0) === gl.TIMEOUT_EXPIRED) {
          this.swTimerId = setTimeout(waitSync, 16);
        } else {
          if (sync) gl.deleteSync(sync);
          this.swTimerId = setTimeout(() => {
            if (!this.disposed) this.rafId = requestAnimationFrame(this.loop);
          }, 80);
        }
      };
      this.swTimerId = setTimeout(waitSync, 16);
    } else {
      this.swTimerId = setTimeout(() => {
        if (!this.disposed) this.rafId = requestAnimationFrame(this.loop);
      }, 80);
    }
  }

  private loop = (now: number): void => {
    if (this.disposed) return;
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(0.05, Math.max(0.001, rawDt));

    if (!this.paused) {
      this.elapsed += dt;
      this.update(dt);
    }
    this.renderer.render(this.scene, this.camera);
    this.scheduleNextFrame();
  };

  // ---------------------------------------------------------------------------
  // Public Control & UI Actions
  // ---------------------------------------------------------------------------
  public setPaused(p: boolean): void {
    this.paused = p;
    if (p) this.keysDown.clear();
  }

  public setSpeedMultiplier(mult: number): void {
    this.speedMultiplier = Math.max(0.45, Math.min(1.25, mult));
  }

  public setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
    this.emitHud();
  }

  public cycleCameraMode(): void {
    const order: CameraMode[] = ['arcade', 'action', 'tactical'];
    const idx = order.indexOf(this.cameraMode);
    this.cameraMode = order[(idx + 1) % order.length];
    this.emitHud();
  }

  public toggleFreeWarp(): void {
    this.freeWarp = !this.freeWarp;
    this.announce(
      this.freeWarp
        ? 'Arcade Free-Warp ON: All 9 Realms unlocked in Sumner’s Tower!'
        : 'Classic Runestone Progression restored.'
    );
    this.emitHud();
  }

  public toggleArcadeDrain(): void {
    this.arcadeDrain = !this.arcadeDrain;
    this.announce(
      this.arcadeDrain
        ? 'Arcade Health-as-Timer enabled (find Roast Turkey & Food!).'
        : 'Console Explore Mode: passive health drain paused.'
    );
    this.emitHud();
  }

  public setHeroSelection(heroId: HeroClassId, colorId: ElementColorId): void {
    this.heroId = heroId;
    this.colorId = colorId;
    this.recalcMaxHp();
    this.rebuildHeroMesh();
    const el = ELEMENT_COLORS[colorId];
    const h = HERO_MAP[heroId];
    this.announce(`${el.name} ${h.name} enters the quest with ${h.weaponName}!`, true);
    gauntletSfx.playLevelUp();
    this.emitHud();
  }

  public redeemSecretCode(rawCode: string): string {
    const code = rawCode.trim().toUpperCase();
    const match = HERO_CLASSES.find((h) => h.secret && h.secretCode === code);
    if (match) {
      this.unlockedSecretHeroes.add(match.id);
      this.setHeroSelection(match.id, this.colorId);
      return `Secret Hero ${match.name} unlocked!`;
    }
    if (code === '100000' || code === 'GOLD') {
      this.gold += 2500;
      gauntletSfx.playGoldPickup();
      this.announce('Console Code Accepted! +2,500 Gold bestowed by Sumner!', true);
      this.emitHud();
      return '+2,500 Gold added!';
    }
    if (code === 'LEGEND' || code === 'RUNES') {
      this.freeWarp = true;
      for (const h of HERO_CLASSES) {
        if (h.secret) this.unlockedSecretHeroes.add(h.id);
      }
      gauntletSfx.playRunestoneFanfare();
      this.announce('Dark Legacy Master Code! All Secret Heroes & Realms unlocked!', true);
      this.emitHud();
      return 'All Secret Heroes & Realms unlocked!';
    }
    return 'Unknown code. Try SUMNER, MEDUSA, JACKAL, OGRE, GOLD, or LEGEND.';
  }

  public buyArmoryItem(
    item: 'strength' | 'speed' | 'armor' | 'magic' | 'turkey' | 'potion' | 'key' | RelicId
  ): boolean {
    if (item === 'strength' || item === 'speed' || item === 'armor' || item === 'magic') {
      const currentBonus = this.bonusStats[item];
      const cost = 300 + currentBonus * 30;
      if (this.gold < cost) return false;
      this.gold -= cost;
      this.bonusStats[item] += 8;
      if (item === 'armor') this.recalcMaxHp();
      gauntletSfx.playLevelUp();
      this.announce(`Sumner forged +8 ${item.toUpperCase()}!`);
      this.emitHud();
      return true;
    }
    if (item === 'turkey') {
      if (this.gold < 180) return false;
      this.gold -= 180;
      this.hp = Math.min(this.maxHp, this.hp + 400);
      gauntletSfx.playFoodEat();
      this.announce('Roast Turkey restored +400 Health!');
      this.emitHud();
      return true;
    }
    if (item === 'potion') {
      if (this.gold < 240 || this.potions >= 9) return false;
      this.gold -= 240;
      this.potions += 1;
      gauntletSfx.playKeyUnlock();
      this.announce('Acquired +1 Elemental Magic Potion!');
      this.emitHud();
      return true;
    }
    if (item === 'key') {
      if (this.gold < 160 || this.keys >= 9) return false;
      this.gold -= 160;
      this.keys += 1;
      gauntletSfx.playKeyUnlock();
      this.announce('Acquired +1 Golden Dungeon Key!');
      this.emitHud();
      return true;
    }
    // Relic purchase
    const def = RELIC_DEFS[item];
    if (!def || this.gold < def.cost) return false;
    this.gold -= def.cost;
    this.grantRelic(item);
    gauntletSfx.playLegendaryClaim();
    this.emitHud();
    return true;
  }

  public enterRealm(realmId: RealmId, bossArena = false): void {
    if (realmId !== 'hub') {
      const def = REALM_MAP[realmId];
      if (!this.freeWarp && this.collectedRunestones.size < def.requiredRunestones) {
        this.announce(
          `${def.name} requires ${def.requiredRunestones} Runestones (or enable Free-Warp)!`
        );
        return;
      }
    }
    this.gameOver = false;
    this.victory = false;
    if (this.hp <= 0) this.hp = this.maxHp;
    gauntletSfx.playPortalWarp();
    this.loadRealm(realmId, bossArena);
    this.emitHud();
  }

  public restartRun(): void {
    this.gameOver = false;
    this.victory = false;
    this.hp = this.maxHp;
    this.potions = Math.max(2, this.potions);
    this.keys = Math.max(1, this.keys);
    this.turbo = 75;
    this.loadRealm('hub', false);
    this.announce('Sumner has revived you inside the Tower! Re-enter any Realm Portal.', true);
    this.emitHud();
  }

  public triggerPrimaryAttack(): void {
    if (this.paused || this.gameOver) return;
    if (this.realmId === 'hub') {
      const prox = this.getProximityPrompt();
      if (prox) {
        this.executeProximityAction(prox);
        return;
      }
    }
    this.performPrimaryAttack();
  }

  public triggerHeavyAttack(): void {
    if (this.paused || this.gameOver || this.realmId === 'hub') return;
    this.performHeavyAttack();
  }

  public triggerTurboAttack(): void {
    if (this.paused || this.gameOver || this.realmId === 'hub') return;
    this.performTurboAttack();
  }

  public triggerPotionBlast(): void {
    if (this.paused || this.gameOver || this.realmId === 'hub') return;
    this.performPotionBlast();
  }

  public activateInventorySlot(slotIdx: number): void {
    if (slotIdx < 0 || slotIdx >= this.inventoryRelics.length) return;
    const relicId = this.inventoryRelics[slotIdx];
    this.inventoryRelics.splice(slotIdx, 1);
    const def = RELIC_DEFS[relicId];
    this.activeRelics.set(relicId, { remaining: def.duration, duration: def.duration });
    gauntletSfx.playLegendaryClaim();
    this.announce(`${def.name} activated! ${def.desc}`);
    this.spawnBurst(this.heroX, 1.1, this.heroZ, def.colorHex, 24, 5.5);
    this.emitHud();
  }

  public setVirtualMove(x: number, z: number): void {
    this.virtualMove.x = x;
    this.virtualMove.z = z;
  }

  public setTiltMove(x: number, z: number): void {
    this.tiltMove.x = x;
    this.tiltMove.z = z;
  }

  public setBlocking(b: boolean): void {
    this.blocking = b;
  }

  public handleKeyDown(code: string): void {
    this.keysDown.add(code);
    if (this.paused) return;

    if (code === 'Space' || code === 'KeyZ') {
      if (this.realmId === 'hub') {
        const prox = this.getProximityPrompt();
        if (prox) {
          this.executeProximityAction(prox);
          return;
        }
      }
      this.performPrimaryAttack();
    } else if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'KeyX') {
      this.performHeavyAttack();
    } else if (code === 'KeyT' || code === 'KeyF') {
      this.performTurboAttack();
    } else if (code === 'KeyQ' || code === 'KeyE') {
      const prox = this.getProximityPrompt();
      if (prox && code === 'KeyE') {
        this.executeProximityAction(prox);
      } else {
        this.performPotionBlast();
      }
    } else if (code === 'KeyV') {
      this.cycleCameraMode();
    } else if (code === 'KeyH') {
      this.enterRealm('hub', false);
    } else if (code === 'Digit1') {
      this.activateInventorySlot(0);
    } else if (code === 'Digit2') {
      this.activateInventorySlot(1);
    } else if (code === 'Digit3') {
      this.activateInventorySlot(2);
    } else if (code === 'Digit4') {
      this.activateInventorySlot(3);
    } else if (code === 'Digit5') {
      this.activateInventorySlot(4);
    }
  }

  public handleKeyUp(code: string): void {
    this.keysDown.delete(code);
  }

  public handlePointerDown(clientX: number, clientY: number, button: number): void {
    if (this.paused || this.gameOver) return;
    gauntletSfx.unlock();
    this.updatePointerGround(clientX, clientY);

    if (button === 2) {
      this.performHeavyAttack();
      return;
    }

    // In Sumner's Tower, clicking near a portal/pedestal activates it if close, or steers toward it
    if (this.realmId === 'hub') {
      const prox = this.getProximityPrompt();
      if (prox && Math.hypot(this.pointerTargetX - this.heroX, this.pointerTargetZ - this.heroZ) < 3.6) {
        this.executeProximityAction(prox);
        return;
      }
    }
    this.pointerAimActive = true;
    this.pointerHoldAttack = true;
    this.facePoint(this.pointerTargetX, this.pointerTargetZ);
    this.performPrimaryAttack();
  }

  public handlePointerMove(clientX: number, clientY: number): void {
    if (!this.pointerAimActive) return;
    this.updatePointerGround(clientX, clientY);
    this.facePoint(this.pointerTargetX, this.pointerTargetZ);
  }

  public handlePointerUp(): void {
    this.pointerAimActive = false;
    this.pointerHoldAttack = false;
  }

  private updatePointerGround(clientX: number, clientY: number): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    if (this.raycaster.ray.intersectPlane(this.groundPlane, _v3)) {
      this.pointerTargetX = _v3.x;
      this.pointerTargetZ = _v3.z;
    }
  }

  private facePoint(tx: number, tz: number): void {
    const dx = tx - this.heroX;
    const dz = tz - this.heroZ;
    if (dx * dx + dz * dz > 0.04) {
      this.heroFacing = Math.atan2(dx, dz);
    }
  }

  // ---------------------------------------------------------------------------
  // World & 3D Scene Builder
  // ---------------------------------------------------------------------------
  private clearWorld(): void {
    while (this.worldGroup.children.length > 0) {
      this.worldGroup.remove(this.worldGroup.children[0]);
    }
    while (this.entityGroup.children.length > 0) {
      const ch = this.entityGroup.children[0];
      if (ch !== this.heroRig?.root) {
        this.entityGroup.remove(ch);
      } else {
        break;
      }
    }
    // Keep heroRig attached cleanly
    this.entityGroup.clear();
    if (this.heroRig) this.entityGroup.add(this.heroRig.root);

    for (const p of this.projectiles) {
      this.fxGroup.remove(p.mesh);
      (p.mesh.material as THREE.Material).dispose();
    }
    this.projectiles = [];
    this.particles = [];
    this.particleMesh.count = 0;

    for (const d of this.worldDisposables) {
      try {
        d.dispose();
      } catch {
        // ignore
      }
    }
    this.worldDisposables = [];

    if (this.realmTextures) {
      disposeRealmTextures(this.realmTextures);
      this.realmTextures = null;
    }

    this.enemies = [];
    this.generators = [];
    this.props = [];
    this.gateWalls = [];
    this.bridgeMeshes = [];
    this.bossEntity = null;
    this.bridgeRaised = false;
    this.deathSpawnedInRealm = false;
  }

  private rebuildHeroMesh(): void {
    if (this.heroRig) {
      this.entityGroup.remove(this.heroRig.root);
      this.disposeObjectTree(this.heroRig.root);
    }
    this.heroRig = buildHeroModel(this.heroId, this.colorId, this.level);
    this.heroRig.root.position.set(this.heroX, 0, this.heroZ);
    this.heroRig.root.rotation.y = this.heroFacing;
    this.entityGroup.add(this.heroRig.root);
    const el = ELEMENT_COLORS[this.colorId];
    this.heroLight.color.set(el.glowHex);
    (this.slashRing.material as THREE.MeshBasicMaterial).color.set(el.glowHex);
  }

  private loadRealm(realmId: RealmId, isBossArena: boolean): void {
    this.clearWorld();
    this.realmId = realmId;
    this.isBossArena = isBossArena;

    const realmDef = realmId === 'hub' ? null : REALM_MAP[realmId];
    const layout = generateRealmDungeon(realmId, isBossArena);
    this.layout = layout;

    // Atmosphere: Horizon-matched warm medieval FogExp2 + torchlit ambient balance
    const fogHex = realmDef ? realmDef.fogHex : '#1f1610';
    const ambHex = realmDef ? realmDef.ambientHex : '#c9a679';
    this.scene.background = new THREE.Color(fogHex);
    this.scene.fog = new THREE.FogExp2(fogHex, realmId === 'hub' ? 0.013 : 0.0165);
    this.hemiLight.color.set(ambHex);
    this.hemiLight.groundColor.set(fogHex);

    // Procedural PBR CanvasTextures
    this.realmTextures = createRealmTextures(realmId, realmDef, this.maxAniso);

    const ts = layout.tileSize;
    const halfW = (layout.width * ts) / 2;
    const halfH = (layout.height * ts) / 2;
    const toWorldX = (tx: number) => tx * ts - halfW + ts * 0.5;
    const toWorldZ = (tz: number) => tz * ts - halfH + ts * 0.5;

    // Count tile categories for batched InstancedMeshes
    const floorCoords: Array<[number, number]> = [];
    const wallCoords: Array<[number, number]> = [];
    const pillarCoords: Array<[number, number]> = [];
    const hazardCoords: Array<[number, number]> = [];

    for (let tz = 0; tz < layout.height; tz++) {
      for (let tx = 0; tx < layout.width; tx++) {
        const code = layout.tiles[tz][tx];
        if (code === 0 || code === 2 || code === 4 || code === 5 || code === 6) {
          floorCoords.push([tx, tz]);
        }
        if (code === 1) {
          // Only render walls bordering walkable space (keeps draw/vertex count super crisp)
          let bordersOpen = false;
          for (let dz = -1; dz <= 1 && !bordersOpen; dz++) {
            for (let dx = -1; dx <= 1 && !bordersOpen; dx++) {
              const n = layout.tiles[tz + dz]?.[tx + dx];
              if (n !== undefined && n !== 1) bordersOpen = true;
            }
          }
          if (bordersOpen) wallCoords.push([tx, tz]);
        } else if (code === 2) {
          pillarCoords.push([tx, tz]);
        } else if (code === 3) {
          hazardCoords.push([tx, tz]);
        } else if (code === 4 || code === 5) {
          // Interactive Medieval Iron Portcullis Gate OR Cracked Secret Stone Wall
          const gGeo = new THREE.BoxGeometry(ts, 2.9, code === 4 ? ts * 0.35 : ts);
          const gMat =
            code === 4
              ? new THREE.MeshStandardMaterial({
                  color: 0x8f6626,
                  metalness: 0.78,
                  roughness: 0.35,
                })
              : new THREE.MeshStandardMaterial({
                  map: this.realmTextures.crackedWall,
                  roughness: 0.82,
                  metalness: 0.08,
                });
          const mesh = new THREE.Mesh(gGeo, gMat);
          mesh.position.set(toWorldX(tx), 1.45, toWorldZ(tz));
          mesh.castShadow = !this.isSoftwareGl;
          mesh.receiveShadow = true;
          this.worldGroup.add(mesh);
          this.worldDisposables.push(gGeo, gMat);
          this.gateWalls.push({
            tx,
            tz,
            mesh,
            kind: code === 4 ? 'gate' : 'cracked',
            hp: code === 5 ? 90 : 9999,
            open: false,
          });
        }
      }
    }

    // 1. Instanced Floor Tiles
    if (floorCoords.length > 0) {
      const fGeo = new THREE.BoxGeometry(ts, 0.36, ts);
      const fMat = new THREE.MeshStandardMaterial({
        map: this.realmTextures.floor,
        roughness: realmId === 'ice' ? 0.22 : 0.72,
        metalness: realmId === 'ice' ? 0.25 : 0.12,
      });
      const inst = new THREE.InstancedMesh(fGeo, fMat, floorCoords.length);
      inst.receiveShadow = true;
      floorCoords.forEach(([tx, tz], i) => {
        _m4.makeTranslation(toWorldX(tx), -0.18, toWorldZ(tz));
        inst.setMatrixAt(i, _m4);
        const shade = 0.92 + (((tx * 17 + tz * 31) % 7) / 7) * 0.16;
        _col.setRGB(shade, shade, shade);
        inst.setColorAt(i, _col);
      });
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      inst.computeBoundingSphere();
      this.worldGroup.add(inst);
      this.worldDisposables.push(fGeo, fMat);
    }

    // 2. Instanced Walls (with subtle organic height variance for rich 3D silhouette!)
    if (wallCoords.length > 0) {
      const wGeo = new THREE.BoxGeometry(ts, 3.3, ts);
      const wMat = new THREE.MeshStandardMaterial({
        map: this.realmTextures.wall,
        roughness: 0.78,
        metalness: 0.12,
      });
      const inst = new THREE.InstancedMesh(wGeo, wMat, wallCoords.length);
      inst.castShadow = !this.isSoftwareGl;
      inst.receiveShadow = true;
      wallCoords.forEach(([tx, tz], i) => {
        const hVar = 0.9 + (((tx * 13 + tz * 29) % 11) / 11) * 0.24;
        _v3.set(toWorldX(tx), (3.3 * hVar) * 0.5, toWorldZ(tz));
        _q.identity();
        _s3.set(1, hVar, 1);
        _m4.compose(_v3, _q, _s3);
        inst.setMatrixAt(i, _m4);
      });
      inst.instanceMatrix.needsUpdate = true;
      inst.computeBoundingSphere();
      this.worldGroup.add(inst);
      this.worldDisposables.push(wGeo, wMat);
    }

    // 3. Realm-Specific Composite 3D Landmarks (Forest Redwoods, Desert Obelisks, Glacier Spires, Gothic Columns!)
    if (pillarCoords.length > 0) {
      if (realmId === 'forest') {
        const trunkGeo = new THREE.CylinderGeometry(ts * 0.2, ts * 0.28, 3.0, 8);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.9, metalness: 0.05 });
        const leafGeo = new THREE.ConeGeometry(ts * 0.68, 3.4, 8);
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x1e5c2e, roughness: 0.78, metalness: 0.04 });
        const topGeo = new THREE.ConeGeometry(ts * 0.48, 2.5, 8);
        const topMat = new THREE.MeshStandardMaterial({ color: 0x2f7d40, roughness: 0.72, metalness: 0.04 });
        for (const [tx, tz] of pillarCoords) {
          const g = new THREE.Group();
          const tr = new THREE.Mesh(trunkGeo, trunkMat);
          tr.position.y = 1.5;
          const l1 = new THREE.Mesh(leafGeo, leafMat);
          l1.position.y = 3.5;
          const l2 = new THREE.Mesh(topGeo, topMat);
          l2.position.y = 5.1;
          g.add(tr, l1, l2);
          g.position.set(toWorldX(tx), 0, toWorldZ(tz));
          this.worldGroup.add(g);
        }
        this.worldDisposables.push(trunkGeo, trunkMat, leafGeo, leafMat, topGeo, topMat);
      } else if (realmId === 'ice') {
        const spireGeo = new THREE.ConeGeometry(ts * 0.36, 4.9, 6);
        const spireMat = new THREE.MeshStandardMaterial({
          color: 0x7dd3fc,
          emissive: 0x0284c7,
          emissiveIntensity: 0.35,
          roughness: 0.16,
          metalness: 0.45,
        });
        const baseGeo = new THREE.CylinderGeometry(ts * 0.44, ts * 0.5, 0.9, 6);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.25, metalness: 0.3 });
        for (const [tx, tz] of pillarCoords) {
          const g = new THREE.Group();
          const b = new THREE.Mesh(baseGeo, baseMat);
          b.position.y = 0.45;
          const s = new THREE.Mesh(spireGeo, spireMat);
          s.position.y = 2.9;
          g.add(b, s);
          g.position.set(toWorldX(tx), 0, toWorldZ(tz));
          this.worldGroup.add(g);
        }
        this.worldDisposables.push(spireGeo, spireMat, baseGeo, baseMat);
      } else if (realmId === 'desert') {
        const shaftGeo = new THREE.CylinderGeometry(ts * 0.24, ts * 0.38, 4.2, 4);
        const shaftMat = new THREE.MeshStandardMaterial({ color: 0xb89458, roughness: 0.72, metalness: 0.1 });
        const capGeo = new THREE.ConeGeometry(ts * 0.3, 0.9, 4);
        const capMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.25, metalness: 0.85 });
        for (const [tx, tz] of pillarCoords) {
          const g = new THREE.Group();
          const sh = new THREE.Mesh(shaftGeo, shaftMat);
          sh.position.y = 2.1;
          sh.rotation.y = Math.PI / 4;
          const cap = new THREE.Mesh(capGeo, capMat);
          cap.position.y = 4.65;
          cap.rotation.y = Math.PI / 4;
          g.add(sh, cap);
          g.position.set(toWorldX(tx), 0, toWorldZ(tz));
          this.worldGroup.add(g);
        }
        this.worldDisposables.push(shaftGeo, shaftMat, capGeo, capMat);
      } else {
        // Composite Fluted Gothic Stone Column with Plinth Base, Carved Capital & Accent Band!
        const pGeo = new THREE.CylinderGeometry(ts * 0.3, ts * 0.36, 4.2, 10);
        const pMat = new THREE.MeshStandardMaterial({
          map: this.realmTextures.pillar,
          roughness: 0.55,
          metalness: 0.22,
        });
        const plinthGeo = new THREE.BoxGeometry(ts * 0.86, 0.52, ts * 0.86);
        const plinthMat = new THREE.MeshStandardMaterial({
          color: realmDef ? realmDef.wallAccentHex : '#7a6450',
          roughness: 0.78,
          metalness: 0.14,
        });
        const bandGeo = new THREE.TorusGeometry(ts * 0.35, 0.08, 6, 12);
        const bandMat = new THREE.MeshStandardMaterial({
          color: realmDef ? realmDef.portalHex : '#d97706',
          emissive: realmDef ? realmDef.portalHex : '#78350f',
          emissiveIntensity: 0.28,
          metalness: 0.7,
          roughness: 0.28,
        });
        for (const [tx, tz] of pillarCoords) {
          const g = new THREE.Group();
          const base = new THREE.Mesh(plinthGeo, plinthMat);
          base.position.y = 0.26;
          const shaft = new THREE.Mesh(pGeo, pMat);
          shaft.position.y = 2.35;
          shaft.castShadow = !this.isSoftwareGl;
          shaft.receiveShadow = true;
          const cap = new THREE.Mesh(plinthGeo, plinthMat);
          cap.position.y = 4.55;
          const band = new THREE.Mesh(bandGeo, bandMat);
          band.rotation.x = Math.PI / 2;
          band.position.y = 3.6;
          g.add(base, shaft, cap, band);
          g.position.set(toWorldX(tx), 0, toWorldZ(tz));
          this.worldGroup.add(g);
        }
        this.worldDisposables.push(pGeo, pMat, plinthGeo, plinthMat, bandGeo, bandMat);
      }
    }

    // 3b. Towering 3D Overhead Gothic Stone Archways framing scrolling dungeon thresholds!
    if (layout.arches && layout.arches.length > 0) {
      const colGeo = new THREE.BoxGeometry(0.68, 4.6, 0.88);
      const lintelGeo = new THREE.BoxGeometry(ts * 3.4, 0.72, 1.05);
      const crestGeo = new THREE.OctahedronGeometry(0.45, 0);
      const stoneMat = new THREE.MeshStandardMaterial({
        map: this.realmTextures.wall,
        roughness: 0.76,
        metalness: 0.14,
      });
      const crestMat = new THREE.MeshStandardMaterial({
        color: realmDef ? realmDef.portalHex : '#d97706',
        emissive: realmDef ? realmDef.portalHex : '#b45309',
        emissiveIntensity: 0.45,
        metalness: 0.72,
        roughness: 0.25,
      });
      for (const arch of layout.arches) {
        const ag = new THREE.Group();
        const leftP = new THREE.Mesh(colGeo, stoneMat);
        leftP.position.set(-ts * 1.45, 2.3, 0);
        const rightP = new THREE.Mesh(colGeo, stoneMat);
        rightP.position.set(ts * 1.45, 2.3, 0);
        const lintel = new THREE.Mesh(lintelGeo, stoneMat);
        lintel.position.set(0, 4.75, 0);
        const crest = new THREE.Mesh(crestGeo, crestMat);
        crest.position.set(0, 5.4, 0);
        ag.add(leftP, rightP, lintel, crest);
        ag.position.set(toWorldX(arch.tx), 0, toWorldZ(arch.tz));
        ag.rotation.y = arch.rotY;
        this.worldGroup.add(ag);
      }
      this.worldDisposables.push(colGeo, lintelGeo, crestGeo, stoneMat, crestMat);
    }

    // 4. Instanced Glowing Hazard Pools (Lava / Acid / Glacial Chasm / Void)
    if (hazardCoords.length > 0) {
      const hGeo = new THREE.BoxGeometry(ts, 0.2, ts);
      const hMat = new THREE.MeshStandardMaterial({
        map: this.realmTextures.hazard,
        emissive: new THREE.Color(realmDef ? realmDef.hazardHex : '#f97316'),
        emissiveIntensity: 0.85,
        roughness: 0.25,
      });
      const inst = new THREE.InstancedMesh(hGeo, hMat, hazardCoords.length);
      hazardCoords.forEach(([tx, tz], i) => {
        _m4.makeTranslation(toWorldX(tx), -0.22, toWorldZ(tz));
        inst.setMatrixAt(i, _m4);
      });
      inst.instanceMatrix.needsUpdate = true;
      inst.computeBoundingSphere();
      this.worldGroup.add(inst);
      this.worldDisposables.push(hGeo, hMat);
    }

    // Position Hero
    this.heroX = toWorldX(layout.playerStart.x);
    this.heroZ = toWorldZ(layout.playerStart.z);
    this.heroFacing = Math.PI;
    if (this.heroRig) {
      this.heroRig.root.position.set(this.heroX, 0, this.heroZ);
      this.heroRig.root.rotation.y = this.heroFacing;
    }

    // Snap camera immediately on load
    this.snapCamera();

    // Populate Sumner's Tower Hub OR Dungeon Spawns OR Boss Arena
    if (realmId === 'hub') {
      this.populateSumnersTower(toWorldX, toWorldZ);
    } else {
      this.populateDungeonSpawns(layout, realmDef!, toWorldX, toWorldZ);
      if (isBossArena) {
        this.spawnRealmBoss(realmDef!, toWorldX(9), toWorldZ(6.2));
      } else {
        this.announce(
          `Entered ${realmDef!.name}! Seek ${realmDef!.legendaryWeapon.name} & Runestones before facing ${realmDef!.bossName}!`
        );
      }
    }
  }

  private populateSumnersTower(
    toWorldX: (tx: number) => number,
    toWorldZ: (tz: number) => number
  ): void {
    const cx = toWorldX(10);
    const cz = toWorldZ(10);

    // Central Sumner Carved Sandstone Dais + Bronze Trim + Oak Spellbook Lectern!
    const daisGeo = new THREE.CylinderGeometry(2.5, 3.0, 0.48, 12);
    const daisMat = new THREE.MeshStandardMaterial({
      color: 0x6b5842,
      metalness: 0.18,
      roughness: 0.78,
    });
    const dais = new THREE.Mesh(daisGeo, daisMat);
    dais.position.set(cx, 0.24, cz);
    dais.receiveShadow = true;
    this.worldGroup.add(dais);
    this.worldDisposables.push(daisGeo, daisMat);

    // Decorative antique bronze inlaid celestial floor ring around Sumner's Tower
    const inlayGeo = new THREE.RingGeometry(4.4, 4.85, 32);
    const inlayMat = new THREE.MeshStandardMaterial({
      color: 0xb0843c,
      metalness: 0.74,
      roughness: 0.36,
      side: THREE.DoubleSide,
    });
    const inlay = new THREE.Mesh(inlayGeo, inlayMat);
    inlay.rotation.x = -Math.PI / 2;
    inlay.position.set(cx, 0.03, cz);
    this.worldGroup.add(inlay);
    this.worldDisposables.push(inlayGeo, inlayMat);

    // Tall Gothic Stained-Glass Cathedral Windows & Crimson Tapestries around Sumner's Tower walls!
    const glassGeo = new THREE.BoxGeometry(1.75, 4.2, 0.24);
    const frameGeo = new THREE.BoxGeometry(2.1, 4.6, 0.32);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x473c32, roughness: 0.85 });
    const glassColors = [0xd97706, 0xb91c1c, 0x2563eb, 0x15803d];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const wx = cx + Math.cos(a) * 20.6;
      const wz = cz + Math.sin(a) * 20.6;
      const gMat = new THREE.MeshStandardMaterial({
        color: glassColors[i % glassColors.length],
        emissive: glassColors[i % glassColors.length],
        emissiveIntensity: 0.52,
        roughness: 0.25,
      });
      const frame = new THREE.Mesh(frameGeo, frameMat);
      frame.position.set(wx, 3.6, wz);
      frame.lookAt(cx, 3.6, cz);
      const glass = new THREE.Mesh(glassGeo, gMat);
      glass.position.set(cx + Math.cos(a) * 20.4, 3.6, cz + Math.sin(a) * 20.4);
      glass.lookAt(cx, 3.6, cz);
      this.worldGroup.add(frame, glass);
      this.worldDisposables.push(gMat);
    }
    this.worldDisposables.push(glassGeo, frameGeo, frameMat);

    // Sumner NPC model standing beside his medieval oak spellbook podium
    const sumnerRig = buildHeroModel('sumner', 'blue', 25);
    sumnerRig.root.position.set(cx, 0.48, cz);
    sumnerRig.root.scale.setScalar(1.18);
    this.entityGroup.add(sumnerRig.root);
    this.props.push({
      id: this.nextEntityId++,
      kind: 'sumner_npc',
      mesh: sumnerRig.root,
      x: cx,
      z: cz,
      active: true,
    });

    // 13-Runestone Medallions orbiting above Sumner's Tower Dais
    const runeCount = this.collectedRunestones.size;
    for (let i = 0; i < 13; i++) {
      const a = (i / 13) * Math.PI * 2;
      const lit = i < runeCount;
      const rGeo = new THREE.OctahedronGeometry(0.24, 0);
      const rMat = new THREE.MeshStandardMaterial({
        color: lit ? 0xfbbf24 : 0x4a4035,
        emissive: lit ? 0xd97706 : 0x000000,
        emissiveIntensity: lit ? 1.4 : 0,
        roughness: 0.28,
        metalness: 0.55,
      });
      const gem = new THREE.Mesh(rGeo, rMat);
      gem.position.set(cx + Math.cos(a) * 2.5, 3.1, cz + Math.sin(a) * 2.5);
      this.worldGroup.add(gem);
      this.worldDisposables.push(rGeo, rMat);
    }

    // Hero Hall Archway (West) & Sumner's Medieval Armory Forge (East)
    const heroStand = buildPortalModel('#b91c1c', 0.85);
    heroStand.position.set(cx - 5.8, 0, cz + 2.8);
    this.entityGroup.add(heroStand);
    this.props.push({
      id: this.nextEntityId++,
      kind: 'hero_stand',
      mesh: heroStand,
      x: cx - 5.8,
      z: cz + 2.8,
      active: true,
    });

    const armoryStand = buildPortalModel('#d97706', 0.85);
    armoryStand.position.set(cx + 5.8, 0, cz + 2.8);
    this.entityGroup.add(armoryStand);
    this.props.push({
      id: this.nextEntityId++,
      kind: 'armory_stand',
      mesh: armoryStand,
      x: cx + 5.8,
      z: cz + 2.8,
      active: true,
    });

    // All 9 Swirling 3D Realm Portals arranged in an arc around the Tower Colonnade!
    REALM_LIST.forEach((realm, idx) => {
      const angle = Math.PI + ((idx - 4) / 4.4) * (Math.PI * 0.62);
      const px = cx + Math.sin(angle) * 16.5;
      const pz = cz + Math.cos(angle) * 16.5;
      const unlocked = this.freeWarp || this.collectedRunestones.size >= realm.requiredRunestones;
      const pMesh = buildPortalModel(unlocked ? realm.portalHex : '#475569', 0.92);
      pMesh.position.set(px, 0, pz);
      pMesh.lookAt(cx, 0, cz);
      this.entityGroup.add(pMesh);
      this.props.push({
        id: this.nextEntityId++,
        kind: 'hub_portal',
        mesh: pMesh,
        x: px,
        z: pz,
        active: true,
        realmId: realm.id,
      });
    });

    // Corner braziers
    for (const sp of this.layout!.spawns) {
      if (sp.kind === 'brazier') {
        const b = buildBrazierModel();
        b.position.set(toWorldX(sp.x), 0, toWorldZ(sp.z));
        this.entityGroup.add(b);
        this.props.push({
          id: this.nextEntityId++,
          kind: 'brazier',
          mesh: b,
          x: b.position.x,
          z: b.position.z,
          active: true,
        });
      }
    }
  }

  private populateDungeonSpawns(
    layout: DungeonLayout,
    realm: (typeof REALM_LIST)[number],
    toWorldX: (tx: number) => number,
    toWorldZ: (tz: number) => number
  ): void {
    for (const sp of layout.spawns) {
      const wx = toWorldX(sp.x);
      const wz = toWorldZ(sp.z);

      if (sp.kind === 'generator_wood' || sp.kind === 'generator_stone' || sp.kind === 'generator_steel') {
        const tier: 1 | 2 | 3 = sp.kind === 'generator_wood' ? 1 : sp.kind === 'generator_stone' ? 2 : 3;
        const mesh = buildGeneratorModel(tier);
        mesh.position.set(wx, 0, wz);
        this.entityGroup.add(mesh);
        const maxHp = (120 + tier * 90) * (1 + (realm.order - 1) * 0.14);
        this.generators.push({
          id: this.nextEntityId++,
          tier,
          mesh,
          x: wx,
          z: wz,
          hp: maxHp,
          maxHp,
          spawnTimer: 1.5 + Math.random() * 2.5,
          hitFlash: 0,
        });
      } else if (sp.kind === 'barrel') {
        const mesh = buildBarrelModel();
        mesh.position.set(wx, 0, wz);
        this.entityGroup.add(mesh);
        this.props.push({ id: this.nextEntityId++, kind: 'barrel', mesh, x: wx, z: wz, active: true });
      } else if (sp.kind === 'chest') {
        const mesh = buildChestModel();
        mesh.position.set(wx, 0, wz);
        this.entityGroup.add(mesh);
        this.props.push({ id: this.nextEntityId++, kind: 'chest', mesh, x: wx, z: wz, active: true });
      } else if (sp.kind === 'brazier') {
        const mesh = buildBrazierModel();
        mesh.position.set(wx, 0, wz);
        this.entityGroup.add(mesh);
        this.props.push({ id: this.nextEntityId++, kind: 'brazier', mesh, x: wx, z: wz, active: true });
      } else if (sp.kind === 'boss_portal') {
        const mesh = buildPortalModel(realm.portalHex, 1.15);
        mesh.position.set(wx, 0, wz);
        this.entityGroup.add(mesh);
        this.props.push({ id: this.nextEntityId++, kind: 'boss_portal', mesh, x: wx, z: wz, active: true });
      } else if (sp.kind === 'return_portal') {
        const mesh = buildPortalModel('#a855f7', 0.88);
        mesh.position.set(wx, 0, wz);
        this.entityGroup.add(mesh);
        this.props.push({ id: this.nextEntityId++, kind: 'return_portal', mesh, x: wx, z: wz, active: true });
      } else if (sp.kind === 'switch') {
        const g = new THREE.Group();
        const pad = new THREE.Mesh(
          new THREE.CylinderGeometry(0.65, 0.75, 0.18, 8),
          new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.7 })
        );
        pad.position.y = 0.09;
        g.add(pad);
        g.position.set(wx, 0, wz);
        this.entityGroup.add(g);
        this.props.push({ id: this.nextEntityId++, kind: 'switch', mesh: g, x: wx, z: wz, active: true });
      } else if (sp.kind === 'runestone') {
        const runeKey = `${realm.id}_${sp.runestoneIndex ?? 0}`;
        if (this.collectedRunestones.has(runeKey)) continue;
        const mesh = buildPickupModel('runestone');
        mesh.position.set(wx, 0, wz);
        this.entityGroup.add(mesh);
        this.props.push({
          id: this.nextEntityId++,
          kind: 'runestone',
          mesh,
          x: wx,
          z: wz,
          active: true,
          runestoneKey: runeKey,
        });
      } else if (sp.kind === 'legendary_weapon') {
        if (this.legendaryWeapons.has(realm.legendaryWeapon.id)) continue;
        const mesh = buildPickupModel('legendary_weapon', realm.legendaryWeapon.colorHex);
        mesh.position.set(wx, 0, wz);
        this.entityGroup.add(mesh);
        this.props.push({
          id: this.nextEntityId++,
          kind: 'legendary_weapon',
          mesh,
          x: wx,
          z: wz,
          active: true,
          legendaryId: realm.legendaryWeapon.id,
        });
      } else if (sp.kind === 'death_spawn') {
        // Red Death guards the northern sanctum approach!
        if (!this.deathSpawnedInRealm) {
          this.deathSpawnedInRealm = true;
          this.spawnEnemy('death', wx, wz, realm.order);
        }
      } else {
        const accentHex = sp.relicId ? RELIC_DEFS[sp.relicId].colorHex : '#fbbf24';
        const mesh = buildPickupModel(sp.kind, accentHex);
        mesh.position.set(wx, 0, wz);
        this.entityGroup.add(mesh);
        this.props.push({
          id: this.nextEntityId++,
          kind: sp.kind,
          mesh,
          x: wx,
          z: wz,
          active: true,
          relicId: sp.relicId,
          goldValue: sp.kind === 'gold_pile' ? 180 + realm.order * 35 : undefined,
        });
      }
    }

    // Spawn an initial patrol wave of monsters across the scrolling dungeon chambers
    if (!layout.isBossArena) {
      const patrolCoords = layout.patrolCoords ?? [
        [12, 16],
        [14, 16],
        [13, 13],
        [4.5, 13],
        [22, 14],
        [13, 6],
      ];
      patrolCoords.forEach(([tx, tz], i) => {
        const kind = realm.enemyMix[i % realm.enemyMix.length];
        this.spawnEnemy(kind, toWorldX(tx), toWorldZ(tz), realm.order);
      });
    }
  }

  private spawnEnemy(kind: EnemyKind, x: number, z: number, realmOrder: number): void {
    const mesh = buildEnemyModel(kind);
    mesh.position.set(x, 0, z);
    this.entityGroup.add(mesh);

    const scale = 1 + (realmOrder - 1) * 0.16;
    const isDeath = kind === 'death';
    const isGeneral = kind === 'general';
    const isGolem = kind === 'golem';

    const maxHp = isDeath
      ? 650 * scale
      : isGeneral
        ? 260 * scale
        : isGolem
          ? 185 * scale
          : kind === 'gargoyle'
            ? 110 * scale
            : 78 * scale;

    const speed = isDeath ? 4.35 : kind === 'gargoyle' ? 4.9 : isGolem ? 2.8 : isGeneral ? 3.8 : 4.2;
    const damage = (isDeath ? 75 : isGeneral ? 48 : isGolem ? 40 : 24) * (1 + (realmOrder - 1) * 0.1);

    this.enemies.push({
      id: this.nextEntityId++,
      kind,
      mesh,
      x,
      z,
      vx: 0,
      vz: 0,
      hp: maxHp,
      maxHp,
      speed,
      damage,
      radius: isGolem || isGeneral ? 0.85 : 0.62,
      attackCd: 0.7,
      burnTimer: 0,
      freezeTimer: 0,
      poisonTimer: 0,
      hitFlash: 0,
    });
  }

  private spawnRealmBoss(realm: (typeof REALM_LIST)[number], x: number, z: number): void {
    const hasLeg = this.legendaryWeapons.has(realm.legendaryWeapon.id);
    const mesh = buildBossModel(realm.bossType, false);
    mesh.position.set(x, 0, z);
    this.entityGroup.add(mesh);

    const baseHp = (1200 + realm.order * 320) * (realm.id === 'underworld' ? 1.45 : 1);
    const boss: EnemyEntity = {
      id: this.nextEntityId++,
      kind: 'general',
      mesh,
      x,
      z,
      vx: 0,
      vz: 0,
      hp: baseHp,
      maxHp: baseHp,
      speed: 3.9 + realm.order * 0.14,
      damage: 58 + realm.order * 7,
      radius: 1.65,
      attackCd: 1.2,
      burnTimer: 0,
      freezeTimer: 0,
      poisonTimer: 0,
      hitFlash: 0,
      isBoss: true,
      bossPhase: 1,
      bossWeakened: hasLeg,
      bossSpecialCd: 2.8,
    };
    this.enemies.push(boss);
    this.bossEntity = boss;

    gauntletSfx.playBossRoar();
    if (hasLeg) {
      this.announce(
        `${realm.legendaryWeapon.name} Weakens ${realm.bossName}! ${realm.legendaryWeapon.effectText}`,
        true
      );
    } else {
      this.announce(
        `BOSS BATTLE: ${realm.bossName}! Tip: Find ${realm.legendaryWeapon.name} in ${realm.shortName} to deal 2.5× damage!`,
        true
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Combat Mechanics (3-Hit Melee, Ranged, Heavy, Elemental Turbo, Magic Potion)
  // ---------------------------------------------------------------------------
  private getEffectiveStats() {
    const base = HERO_MAP[this.heroId];
    const lvlBonus = (this.level - 1) * 4;
    const growthMult = this.activeRelics.has('growth') ? 1.65 : 1.0;
    return {
      strength: Math.round((base.strength + this.bonusStats.strength + lvlBonus) * growthMult),
      speed: Math.min(130, base.speed + this.bonusStats.speed + Math.floor(lvlBonus * 0.5)),
      armor: Math.min(140, base.armor + this.bonusStats.armor + lvlBonus),
      magic: base.magic + this.bonusStats.magic + lvlBonus,
    };
  }

  private recalcMaxHp(): void {
    const st = this.getEffectiveStats();
    this.maxHp = 700 + st.armor * 5 + (this.level - 1) * 45;
    if (this.hp > this.maxHp) this.hp = this.maxHp;
  }

  private performPrimaryAttack(): void {
    if (this.attackCd > 0) return;
    const rapid = this.activeRelics.has('rapid_fire');
    this.attackCd = rapid ? 0.13 : 0.24;
    const stats = this.getEffectiveStats();
    const heroDef = HERO_MAP[this.heroId];
    const el = ELEMENT_COLORS[this.colorId];

    // Check if any enemy, generator, barrel, or cracked wall is within melee arc -> 3-Hit Melee Combo!
    const meleeRange = heroDef.meleeRange * (this.activeRelics.has('growth') ? 1.35 : 1.0);
    const fx = Math.sin(this.heroFacing);
    const fz = Math.cos(this.heroFacing);
    let meleeHitAny = false;

    const comboMult = this.comboStep === 2 ? 1.55 : this.comboStep === 1 ? 1.2 : 1.0;
    const meleeDmg = (26 + stats.strength * 0.55) * comboMult;

    for (const e of this.enemies) {
      const dx = e.x - this.heroX;
      const dz = e.z - this.heroZ;
      const dist = Math.hypot(dx, dz);
      if (dist <= meleeRange + e.radius) {
        const dot = (dx * fx + dz * fz) / Math.max(0.01, dist);
        if (dot > 0.05 || dist < 1.35) {
          this.damageEnemy(e, meleeDmg, el.statusEffect, true);
          meleeHitAny = true;
        }
      }
    }
    for (const gen of this.generators) {
      if (Math.hypot(gen.x - this.heroX, gen.z - this.heroZ) <= meleeRange + 0.9) {
        this.damageGenerator(gen, meleeDmg * 1.15);
        meleeHitAny = true;
      }
    }
    for (const gw of this.gateWalls) {
      if (gw.kind === 'cracked' && !gw.open) {
        if (Math.hypot(gw.mesh.position.x - this.heroX, gw.mesh.position.z - this.heroZ) <= meleeRange + 1.4) {
          this.damageCrackedWall(gw, meleeDmg);
          meleeHitAny = true;
        }
      }
    }
    for (const prop of this.props) {
      if (prop.active && prop.kind === 'barrel') {
        if (Math.hypot(prop.x - this.heroX, prop.z - this.heroZ) <= meleeRange + 0.7) {
          this.detonateBarrel(prop);
          meleeHitAny = true;
        }
      }
    }

    // Trigger 3D Swing Animation + Slash Arc
    this.swingTimer = 0.22;
    this.slashTimer = 0.16;
    this.slashRing.visible = true;
    this.slashRing.position.set(this.heroX, 0.95, this.heroZ);
    this.slashRing.rotation.z = -this.heroFacing + Math.PI * 0.5;
    this.slashRing.scale.setScalar(this.comboStep === 2 ? 1.25 : 0.95);

    if (meleeHitAny) {
      gauntletSfx.playMeleeSlash(this.comboStep);
      this.comboStep = (this.comboStep + 1) % 3;
      this.comboResetTimer = 0.95;
    } else {
      // Classic Gauntlet Ranged Throw / Spell Shot!
      this.fireHeroProjectile(stats, heroDef, el);
      gauntletSfx.playRangedShot(el.statusEffect);
    }
  }

  private fireHeroProjectile(
    stats: ReturnType<Gauntlet3DEngine['getEffectiveStats']>,
    heroDef: (typeof HERO_CLASSES)[number],
    el: (typeof ELEMENT_COLORS)[ElementColorId]
  ): void {
    const threeWay = this.activeRelics.has('three_way');
    const superShot = this.activeRelics.has('super_shot');
    const angles = threeWay ? [-0.22, 0, 0.22] : [0];
    const dmg = (22 + stats.magic * 0.42 + stats.strength * 0.22) * (superShot ? 1.85 : 1.0);

    for (const off of angles) {
      const a = this.heroFacing + off;
      const mat = new THREE.MeshBasicMaterial({ color: superShot ? '#ffffff' : el.glowHex });
      const mesh = new THREE.Mesh(this.projGeo, mat);
      const scale = superShot ? 1.55 : 0.95;
      mesh.scale.setScalar(scale);
      const sx = this.heroX + Math.sin(a) * 0.9;
      const sz = this.heroZ + Math.cos(a) * 0.9;
      mesh.position.set(sx, 1.05, sz);
      this.fxGroup.add(mesh);

      this.projectiles.push({
        mesh,
        x: sx,
        y: 1.05,
        z: sz,
        vx: Math.sin(a) * heroDef.rangedSpeed,
        vz: Math.cos(a) * heroDef.rangedSpeed,
        fromPlayer: true,
        damage: dmg,
        life: 1.45,
        piercing: superShot,
        element: el.statusEffect,
        radius: superShot ? 0.5 : 0.3,
      });
    }
  }

  private performHeavyAttack(): void {
    if (this.heavyCd > 0) return;
    this.heavyCd = 0.72;
    this.swingTimer = 0.34;
    const stats = this.getEffectiveStats();
    const el = ELEMENT_COLORS[this.colorId];
    const dmg = 54 + stats.strength * 0.9;
    const radius = 3.8 * (this.activeRelics.has('growth') ? 1.35 : 1.0);

    gauntletSfx.playHeavySmash();
    this.screenShake = Math.max(this.screenShake, 0.22);
    this.triggerFxLight(this.heroX, this.heroZ, el.glowHex, 4.5, 0.25);
    this.spawnBurst(this.heroX, 0.6, this.heroZ, el.glowHex, 26, 7.5);

    for (const e of this.enemies) {
      const dx = e.x - this.heroX;
      const dz = e.z - this.heroZ;
      const dist = Math.hypot(dx, dz);
      if (dist <= radius + e.radius) {
        this.damageEnemy(e, dmg, el.statusEffect, true);
        if (!e.isBoss && dist > 0.05) {
          e.vx += (dx / dist) * 9;
          e.vz += (dz / dist) * 9;
        }
      }
    }
    for (const gen of this.generators) {
      if (Math.hypot(gen.x - this.heroX, gen.z - this.heroZ) <= radius + 1.0) {
        this.damageGenerator(gen, dmg * 1.3);
      }
    }
    for (const gw of this.gateWalls) {
      if (gw.kind === 'cracked' && !gw.open) {
        if (Math.hypot(gw.mesh.position.x - this.heroX, gw.mesh.position.z - this.heroZ) <= radius + 1.4) {
          this.damageCrackedWall(gw, dmg * 1.4);
        }
      }
    }
    for (const prop of this.props) {
      if (prop.active && prop.kind === 'barrel') {
        if (Math.hypot(prop.x - this.heroX, prop.z - this.heroZ) <= radius + 0.8) {
          this.detonateBarrel(prop);
        }
      }
    }
  }

  private performTurboAttack(): void {
    if (this.turbo < 50) {
      this.announce('Charge Turbo Gauge to 50%+ by fighting monsters!');
      return;
    }
    const powerTier = this.turbo >= 95 ? 1.65 : this.turbo >= 75 ? 1.3 : 1.0;
    this.turbo = 0;
    const stats = this.getEffectiveStats();
    const heroDef = HERO_MAP[this.heroId];
    const el = ELEMENT_COLORS[this.colorId];
    const dmg = (120 + stats.magic * 1.4 + stats.strength * 0.7) * powerTier;

    gauntletSfx.playTurboAttack();
    this.screenShake = 0.42;
    this.triggerFxLight(this.heroX, this.heroZ, el.glowHex, 8, 0.45);
    this.spawnBurst(this.heroX, 1.0, this.heroZ, el.glowHex, 52, 12);

    // 12-way Elemental Turbo Nova Ring + direct shockwave
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const mat = new THREE.MeshBasicMaterial({ color: el.glowHex });
      const mesh = new THREE.Mesh(this.projGeo, mat);
      mesh.scale.setScalar(1.45);
      mesh.position.set(this.heroX, 1.0, this.heroZ);
      this.fxGroup.add(mesh);
      this.projectiles.push({
        mesh,
        x: this.heroX,
        y: 1.0,
        z: this.heroZ,
        vx: Math.sin(a) * 18,
        vz: Math.cos(a) * 18,
        fromPlayer: true,
        damage: dmg * 0.55,
        life: 0.9,
        piercing: true,
        element: el.statusEffect,
        radius: 0.55,
      });
    }

    for (const e of this.enemies) {
      if (Math.hypot(e.x - this.heroX, e.z - this.heroZ) <= 8.5) {
        this.damageEnemy(e, dmg, el.statusEffect, true);
      }
    }
    for (const gen of this.generators) {
      if (Math.hypot(gen.x - this.heroX, gen.z - this.heroZ) <= 8.5) {
        this.damageGenerator(gen, dmg);
      }
    }
    this.announce(`${el.name} ${heroDef.name} unleashed ${heroDef.turboName}!`);
    this.emitHud();
  }

  private performPotionBlast(): void {
    if (this.potions <= 0) {
      this.announce('No Magic Potions left! Buy more at Sumner’s Armory or find Flasks.');
      return;
    }
    this.potions -= 1;
    const stats = this.getEffectiveStats();
    const el = ELEMENT_COLORS[this.colorId];
    const dmg = 260 + stats.magic * 2.4;

    gauntletSfx.playPotionBlast();
    this.screenShake = 0.58;
    this.triggerFxLight(this.heroX, this.heroZ, el.glowHex, 12, 0.7);
    this.spawnBurst(this.heroX, 1.2, this.heroZ, el.glowHex, 78, 16);

    // Classic Gauntlet Potion clears enemies & blasts Red Death!
    for (const e of [...this.enemies]) {
      if (Math.hypot(e.x - this.heroX, e.z - this.heroZ) <= 18) {
        const mult = e.kind === 'death' ? 2.6 : 1.0;
        this.damageEnemy(e, dmg * mult, el.statusEffect, true);
      }
    }
    for (const gen of [...this.generators]) {
      if (Math.hypot(gen.x - this.heroX, gen.z - this.heroZ) <= 18) {
        this.damageGenerator(gen, dmg * 0.85);
      }
    }
    this.announce(`${el.element.toUpperCase()} POTION BLAST! Foes & Death scorched!`);
    this.emitHud();
  }

  // ---------------------------------------------------------------------------
  // Simulation Update Loop
  // ---------------------------------------------------------------------------
  private update(dt: number): void {
    // Cooldowns
    if (this.attackCd > 0) this.attackCd -= dt;
    if (this.heavyCd > 0) this.heavyCd -= dt;
    if (this.invulnTimer > 0) this.invulnTimer -= dt;
    if (this.swingTimer > 0) this.swingTimer -= dt;
    if (this.comboResetTimer > 0) {
      this.comboResetTimer -= dt;
      if (this.comboResetTimer <= 0) this.comboStep = 0;
    }
    if (this.slashTimer > 0) {
      this.slashTimer -= dt;
      if (this.slashTimer <= 0) this.slashRing.visible = false;
    }
    if (this.lowHealthWarnCd > 0) this.lowHealthWarnCd -= dt;
    if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - dt * 1.8);
    if (this.fxLightTimer > 0) {
      this.fxLightTimer -= dt;
      if (this.fxLightTimer <= 0) this.fxLight.intensity = 0;
    }

    // Active Console Relic Timers
    for (const [id, t] of this.activeRelics.entries()) {
      t.remaining -= dt;
      if (t.remaining <= 0) this.activeRelics.delete(id);
    }

    if (this.gameOver) {
      this.updateParticles(dt);
      this.updateCamera(dt);
      return;
    }

    // 1. Hero Movement
    this.updateHeroMovement(dt);

    // Hold-click continuous attack
    if (this.pointerHoldAttack && this.realmId !== 'hub') {
      this.performPrimaryAttack();
    }

    // 2. Arcade Health-as-Timer (gentle authentic drain inside dungeons only)
    if (this.arcadeDrain && this.realmId !== 'hub' && !this.victory) {
      this.healthDrainAccum += dt;
      if (this.healthDrainAccum >= 1.0) {
        this.healthDrainAccum -= 1.0;
        this.hp = Math.max(0, this.hp - 2);
        if (this.hp < this.maxHp * 0.22 && this.lowHealthWarnCd <= 0) {
          this.lowHealthWarnCd = 12;
          const el = ELEMENT_COLORS[this.colorId];
          const h = HERO_MAP[this.heroId];
          this.announce(`${el.name.toUpperCase()} ${h.name.toUpperCase()} NEEDS FOOD BADLY!`, true);
        }
        if (this.hp <= 0) this.triggerGameOver();
      }
    }

    // 3. Phoenix Familiar Auto-Fire
    if (this.activeRelics.has('phoenix') && this.enemies.length > 0) {
      this.phoenixShootCd -= dt;
      if (this.phoenixShootCd <= 0) {
        this.phoenixShootCd = 0.72;
        let nearest: EnemyEntity | null = null;
        let bestD = 14;
        for (const e of this.enemies) {
          const d = Math.hypot(e.x - this.heroX, e.z - this.heroZ);
          if (d < bestD) {
            bestD = d;
            nearest = e;
          }
        }
        if (nearest) {
          const a = Math.atan2(nearest.x - this.heroX, nearest.z - this.heroZ);
          const mat = new THREE.MeshBasicMaterial({ color: '#fb923c' });
          const mesh = new THREE.Mesh(this.projGeo, mat);
          mesh.position.set(this.heroX, 1.9, this.heroZ);
          this.fxGroup.add(mesh);
          this.projectiles.push({
            mesh,
            x: this.heroX,
            y: 1.9,
            z: this.heroZ,
            vx: Math.sin(a) * 19,
            vz: Math.cos(a) * 19,
            fromPlayer: true,
            damage: 42 + this.level * 5,
            life: 1.2,
            piercing: false,
            element: 'burn',
            radius: 0.34,
          });
        }
      }
    }

    // 4. Generators, Enemies, Props, Projectiles, Particles
    this.updateGenerators(dt);
    this.updateEnemies(dt);
    this.updateProps(dt);
    this.updateProjectiles(dt);
    this.updateParticles(dt);
    this.updateXRayVisuals();
    this.updateCamera(dt);

    // Emit HUD snapshot ~15fps for ultra-crisp React UI without overhead
    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.065) {
      this.hudEmitAccum = 0;
      this.emitHud();
    }
  }

  private updateHeroMovement(dt: number): void {
    let mx = this.virtualMove.x + this.tiltMove.x;
    let mz = this.virtualMove.z + this.tiltMove.z;
    if (this.keysDown.has('ArrowLeft') || this.keysDown.has('KeyA')) mx -= 1;
    if (this.keysDown.has('ArrowRight') || this.keysDown.has('KeyD')) mx += 1;
    if (this.keysDown.has('ArrowUp') || this.keysDown.has('KeyW')) mz -= 1;
    if (this.keysDown.has('ArrowDown') || this.keysDown.has('KeyS')) mz += 1;

    this.blocking =
      this.blocking ||
      this.keysDown.has('ControlLeft') ||
      this.keysDown.has('ControlRight') ||
      this.keysDown.has('KeyC');
    if (
      !this.keysDown.has('ControlLeft') &&
      !this.keysDown.has('ControlRight') &&
      !this.keysDown.has('KeyC')
    ) {
      // keep blocking controlled via button only if explicitly toggled off by pointer
    }

    const len = Math.hypot(mx, mz);
    const stats = this.getEffectiveStats();
    const baseMove = (5.2 + stats.speed * 0.042) * this.speedMultiplier * (this.blocking ? 0.5 : 1.0);

    if (len > 0.08) {
      const nx = mx / Math.max(1, len);
      const nz = mz / Math.max(1, len);
      const stepX = nx * baseMove * dt;
      const stepZ = nz * baseMove * dt;

      if (!this.collidesWall(this.heroX + stepX, this.heroZ, 0.56, true)) {
        this.heroX += stepX;
      }
      if (!this.collidesWall(this.heroX, this.heroZ + stepZ, 0.56, true)) {
        this.heroZ += stepZ;
      }
      if (!this.pointerAimActive) {
        const targetAngle = Math.atan2(nx, nz);
        let diff = targetAngle - this.heroFacing;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.heroFacing += diff * (1 - Math.exp(-16 * dt));
      }
      this.walkCycle += dt * 11;
    } else {
      this.walkCycle *= Math.exp(-10 * dt);
    }

    // Check Hazard tile damage (unless Levitation Boots or Reflect Shield active!)
    const tile = this.getTileAtWorld(this.heroX, this.heroZ);
    const levitating = this.activeRelics.has('levitation');
    if (tile === 3 && !levitating && !this.bridgeRaised) {
      this.damageHero(22 * dt, false);
    }

    // Animate 3D Articulated Hero Rig
    if (this.heroRig) {
      const giantScale = this.activeRelics.has('growth') ? 1.75 : 1.0;
      const hoverY = levitating ? 0.42 + Math.sin(this.elapsed * 5) * 0.12 : 0;
      this.heroRig.root.position.set(this.heroX, hoverY, this.heroZ);
      this.heroRig.root.rotation.y = this.heroFacing;
      this.heroRig.root.scale.setScalar(giantScale);

      const stride = len > 0.08 ? Math.sin(this.walkCycle) * 0.55 : 0;
      this.heroRig.leftLeg.rotation.x = stride;
      this.heroRig.rightLeg.rotation.x = -stride;
      this.heroRig.cape.rotation.x = 0.2 + Math.abs(stride) * 0.35;

      // Weapon swing arc
      if (this.swingTimer > 0) {
        const p = 1 - this.swingTimer / 0.26;
        this.heroRig.rightArm.rotation.x = -1.4 + p * 2.4;
        this.heroRig.rightArm.rotation.y = (this.comboStep % 2 === 0 ? -0.6 : 0.6) * (1 - p);
      } else {
        this.heroRig.rightArm.rotation.x = -stride * 0.4;
        this.heroRig.rightArm.rotation.y = 0;
      }
      this.heroRig.leftArm.rotation.x = this.blocking ? -0.9 : stride * 0.35;

      // Active Relic 3D Visuals
      this.heroRig.auraRing.rotation.z = this.elapsed * 1.4;
      this.heroRig.haloRing.visible = this.activeRelics.has('anti_death');
      if (this.heroRig.haloRing.visible) {
        this.heroRig.haloRing.rotation.z = this.elapsed * 3.5;
      }
      this.heroRig.shieldDome.visible = this.activeRelics.has('reflect_shield') || this.blocking;
      this.heroRig.phoenixGroup.visible = this.activeRelics.has('phoenix');
      if (this.heroRig.phoenixGroup.visible) {
        const pa = this.elapsed * 2.8;
        this.heroRig.phoenixGroup.position.set(Math.cos(pa) * 1.35, 1.85 + Math.sin(pa * 2) * 0.2, Math.sin(pa) * 1.35);
        this.heroRig.phoenixGroup.rotation.y = -pa;
      }
    }

    this.heroLight.position.set(this.heroX, 2.4, this.heroZ);
    this.keyLight.position.set(this.heroX + 14, 26, this.heroZ + 16);
    this.keyLight.target.position.set(this.heroX, 0, this.heroZ);
  }

  private updateGenerators(dt: number): void {
    const realm = this.realmId === 'hub' ? null : REALM_MAP[this.realmId];
    if (!realm) return;
    for (const gen of this.generators) {
      const crystal = gen.mesh.getObjectByName('crystal');
      if (crystal) {
        crystal.rotation.y += dt * (1.2 + gen.tier * 0.6);
        crystal.position.y = 1.55 + gen.tier * 0.28 + Math.sin(this.elapsed * 3 + gen.id) * 0.14;
      }
      if (gen.hitFlash > 0) {
        gen.hitFlash -= dt;
        gen.mesh.scale.setScalar(1 + gen.hitFlash * 0.45);
      } else {
        gen.mesh.scale.setScalar(1);
      }

      const distToHero = Math.hypot(gen.x - this.heroX, gen.z - this.heroZ);
      if (distToHero < 19 && this.enemies.length < 22) {
        gen.spawnTimer -= dt;
        if (gen.spawnTimer <= 0) {
          gen.spawnTimer = Math.max(2.6, 5.4 - gen.tier * 0.8);
          const pool = realm.enemyMix;
          const kind =
            gen.tier === 3 && Math.random() < 0.28
              ? 'general'
              : pool[Math.floor(Math.random() * pool.length)];
          const a = Math.random() * Math.PI * 2;
          this.spawnEnemy(kind, gen.x + Math.cos(a) * 1.4, gen.z + Math.sin(a) * 1.4, realm.order);
          this.spawnBurst(gen.x, 1.2, gen.z, '#a855f7', 10, 4);
        }
      }
    }
  }

  private updateEnemies(dt: number): void {
    const hasAntiDeath = this.activeRelics.has('anti_death');
    const isGiant = this.activeRelics.has('growth');

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];

      // Elemental Status Effects (Fire burn, Ice slow/freeze, Acid poison)
      if (e.burnTimer > 0) {
        e.burnTimer -= dt;
        e.hp -= 16 * dt;
      }
      if (e.poisonTimer > 0) {
        e.poisonTimer -= dt;
        e.hp -= 12 * dt;
      }
      const speedMult = e.freezeTimer > 0 ? 0.35 : 1.0;
      if (e.freezeTimer > 0) e.freezeTimer -= dt;
      if (e.hitFlash > 0) e.hitFlash -= dt;
      if (e.attackCd > 0) e.attackCd -= dt;

      if (e.hp <= 0) {
        this.killEnemy(e, i);
        continue;
      }

      const dx = this.heroX - e.x;
      const dz = this.heroZ - e.z;
      const dist = Math.hypot(dx, dz);

      if (dist < 24 || e.isBoss) {
        const dirX = dx / Math.max(0.01, dist);
        const dirZ = dz / Math.max(0.01, dist);

        // Apply knockback decay + chase velocity
        e.vx *= Math.exp(-8 * dt);
        e.vz *= Math.exp(-8 * dt);

        const desiredSpd = e.speed * speedMult * (e.isBoss && e.bossWeakened ? 0.78 : 1.0);
        const stepX = (dirX * desiredSpd + e.vx) * dt;
        const stepZ = (dirZ * desiredSpd + e.vz) * dt;

        if (!this.collidesWall(e.x + stepX, e.z, e.radius * 0.7, false)) e.x += stepX;
        if (!this.collidesWall(e.x, e.z + stepZ, e.radius * 0.7, false)) e.z += stepZ;

        e.mesh.rotation.y = Math.atan2(dirX, dirZ);

        // Wing flap or hover animation
        const wL = e.mesh.getObjectByName('wingL');
        const wR = e.mesh.getObjectByName('wingR');
        if (wL && wR) {
          const flap = Math.sin(this.elapsed * 9 + e.id) * 0.38;
          wL.rotation.z = 0.25 + flap;
          wR.rotation.z = -0.25 - flap;
        }
        const bob = e.kind === 'death' || e.kind === 'gargoyle' ? 0.22 + Math.sin(this.elapsed * 4 + e.id) * 0.18 : 0;
        e.mesh.position.set(e.x, bob, e.z);
        e.mesh.scale.setScalar(e.hitFlash > 0 ? 1.12 : 1.0);

        // Ranged Imp / Boss Special Attacks
        if (e.kind === 'imp' && dist < 13 && e.attackCd <= 0) {
          e.attackCd = 2.4;
          this.spawnEnemyProjectile(e.x, e.z, dirX, dirZ, 11, e.damage * 0.85, '#f97316');
        }
        if (e.isBoss) {
          e.bossSpecialCd = (e.bossSpecialCd ?? 2.5) - dt;
          if (e.bossSpecialCd <= 0) {
            e.bossSpecialCd = e.bossPhase === 2 ? 1.85 : 2.65;
            const spread = e.bossPhase === 2 ? 7 : 5;
            const baseA = Math.atan2(dirX, dirZ);
            for (let s = 0; s < spread; s++) {
              const a = baseA + (s - (spread - 1) / 2) * 0.28;
              this.spawnEnemyProjectile(
                e.x,
                e.z,
                Math.sin(a),
                Math.cos(a),
                e.bossPhase === 2 ? 13 : 10.5,
                e.damage * 0.75,
                e.bossPhase === 2 ? '#fef08a' : '#f43f5e'
              );
            }
            gauntletSfx.playBossRoar();
          }
        }

        // Contact Combat with Hero
        if (dist <= e.radius + 0.65) {
          // Anti-Death Halo instantly banishes Red Death!
          if (e.kind === 'death' && hasAntiDeath) {
            gauntletSfx.playLegendaryClaim();
            this.spawnBurst(e.x, 1.4, e.z, '#fde047', 44, 10);
            this.gold += 800;
            this.awardXp(650);
            this.addScore(2500);
            this.announce('ANTI-DEATH HALO BANISHED RED DEATH! +2,500 Score & +800 Gold!', true);
            this.entityGroup.remove(e.mesh);
            this.disposeObjectTree(e.mesh);
            this.enemies.splice(i, 1);
            continue;
          }

          // Growth Giant tramples small enemies!
          if (isGiant && !e.isBoss && e.kind !== 'death' && e.kind !== 'general') {
            this.damageEnemy(e, 140, 'burn', true);
            continue;
          }

          if (e.attackCd <= 0) {
            e.attackCd = e.kind === 'death' ? 0.55 : 0.95;
            if (e.kind === 'death') {
              gauntletSfx.playDeathBell();
              this.damageHero(e.damage, true);
              this.announce('RED DEATH DRAINS YOUR LIFE! Use a Potion or Anti-Death Halo!');
            } else {
              this.damageHero(e.damage, true);
            }
          }
        }
      }
    }
  }

  private updateProps(dt: number): void {
    const magnet = this.activeRelics.has('coin_magnet');

    for (const p of this.props) {
      if (!p.active) continue;

      // Idle 3D animations for props
      if (
        p.kind === 'runestone' ||
        p.kind === 'legendary_weapon' ||
        p.kind === 'relic' ||
        p.kind === 'key' ||
        p.kind === 'potion'
      ) {
        p.mesh.rotation.y += dt * 1.9;
        p.mesh.position.y = Math.sin(this.elapsed * 3.4 + p.id) * 0.14;
      } else if (p.kind === 'brazier') {
        const fl = p.mesh.getObjectByName('flame');
        if (fl) fl.scale.setScalar(0.88 + Math.sin(this.elapsed * 14 + p.id) * 0.16);
      } else if (p.kind === 'boss_portal' || p.kind === 'return_portal' || p.kind === 'hub_portal') {
        const v = p.mesh.getObjectByName('vortex');
        if (v) v.rotation.z += dt * 2.2;
      } else if (p.kind === 'barrel') {
        const sp = p.mesh.getObjectByName('spark');
        if (sp) sp.scale.setScalar(0.75 + Math.sin(this.elapsed * 18 + p.id) * 0.35);
      }

      // Coin Magnet pulls loot toward hero!
      if (
        magnet &&
        (p.kind === 'gold_pile' ||
          p.kind === 'food_apple' ||
          p.kind === 'food_ham' ||
          p.kind === 'food_turkey' ||
          p.kind === 'key' ||
          p.kind === 'potion')
      ) {
        const dx = this.heroX - p.x;
        const dz = this.heroZ - p.z;
        const d = Math.hypot(dx, dz);
        if (d < 8.5 && d > 0.2) {
          p.x += (dx / d) * 10 * dt;
          p.z += (dz / d) * 10 * dt;
          p.mesh.position.x = p.x;
          p.mesh.position.z = p.z;
        }
      }

      const dist = Math.hypot(p.x - this.heroX, p.z - this.heroZ);
      if (dist > 1.35) continue;

      // Pickup / Trigger Handlers
      if (p.kind === 'gold_pile') {
        const val = p.goldValue ?? 150;
        this.gold += val;
        this.addScore(val);
        gauntletSfx.playGoldPickup();
        this.spawnBurst(p.x, 0.5, p.z, '#facc15', 14, 4.5);
        this.consumeProp(p);
      } else if (p.kind === 'food_turkey' || p.kind === 'food_ham' || p.kind === 'food_apple') {
        const heal = p.kind === 'food_turkey' ? 350 : p.kind === 'food_ham' ? 220 : 120;
        this.hp = Math.min(this.maxHp, this.hp + heal);
        gauntletSfx.playFoodEat();
        this.spawnBurst(p.x, 0.6, p.z, '#4ade80', 14, 4);
        this.announce(
          p.kind === 'food_turkey'
            ? `Roast Turkey! +${heal} Health!`
            : p.kind === 'food_ham'
              ? `Dungeon Ham! +${heal} Health!`
              : `Fresh Apple! +${heal} Health!`
        );
        this.consumeProp(p);
      } else if (p.kind === 'poison_cider') {
        gauntletSfx.playPoisonHurt();
        this.damageHero(110, false);
        this.spawnBurst(p.x, 0.7, p.z, '#a855f7', 18, 5);
        this.announce('POISON CIDER! Shoot purple jugs from afar next time!');
        this.consumeProp(p);
      } else if (p.kind === 'key') {
        this.keys = Math.min(9, this.keys + 1);
        gauntletSfx.playKeyUnlock();
        this.spawnBurst(p.x, 0.8, p.z, '#fde047', 12, 4);
        this.announce('Collected a Golden Key! Unlocks Bronze/Gold Gates & Chests.');
        this.consumeProp(p);
      } else if (p.kind === 'potion') {
        this.potions = Math.min(9, this.potions + 1);
        gauntletSfx.playKeyUnlock();
        this.spawnBurst(p.x, 0.8, p.z, '#38bdf8', 14, 4);
        this.announce('Found an Elemental Magic Potion! Press [Q] to unleash!');
        this.consumeProp(p);
      } else if (p.kind === 'chest') {
        const rewardGold = 260 + (this.realmId !== 'hub' ? REALM_MAP[this.realmId].order * 55 : 0);
        this.gold += rewardGold;
        this.addScore(rewardGold * 2);
        this.turbo = Math.min(100, this.turbo + 30);
        gauntletSfx.playGoldPickup();
        this.spawnBurst(p.x, 0.7, p.z, '#fbbf24', 24, 6);
        this.announce(`Treasure Chest Opened! +${rewardGold} Gold & +30% Turbo!`);
        this.consumeProp(p);
      } else if (p.kind === 'runestone' && p.runestoneKey) {
        this.collectedRunestones.add(p.runestoneKey);
        this.addScore(2000);
        this.awardXp(550);
        gauntletSfx.playRunestoneFanfare();
        this.spawnBurst(p.x, 1.1, p.z, '#38bdf8', 36, 8);
        this.checkSecretHeroUnlocks();
        const el = ELEMENT_COLORS[this.colorId];
        const h = HERO_MAP[this.heroId];
        this.announce(
          `${el.name.toUpperCase()} ${h.name.toUpperCase()} FOUND A RUNESTONE! (${this.collectedRunestones.size}/13)`,
          true
        );
        this.consumeProp(p);
      } else if (p.kind === 'legendary_weapon' && p.legendaryId) {
        this.legendaryWeapons.add(p.legendaryId);
        this.addScore(2500);
        this.awardXp(600);
        const realm = REALM_MAP[this.realmId];
        gauntletSfx.playLegendaryClaim();
        this.spawnBurst(p.x, 1.3, p.z, realm.legendaryWeapon.colorHex, 42, 9);
        this.announce(
          `CLAIMED ${realm.legendaryWeapon.name.toUpperCase()}! ${realm.legendaryWeapon.effectText}`,
          true
        );
        this.consumeProp(p);
      } else if (p.kind === 'relic' && p.relicId) {
        this.grantRelic(p.relicId);
        gauntletSfx.playLegendaryClaim();
        this.spawnBurst(p.x, 0.9, p.z, RELIC_DEFS[p.relicId].colorHex, 20, 5.5);
        this.consumeProp(p);
      } else if (p.kind === 'switch' && !p.triggered) {
        p.triggered = true;
        this.raiseEastBridge();
      } else if (p.kind === 'boss_portal' && !this.isBossArena) {
        this.enterRealm(this.realmId, true);
        return;
      } else if (p.kind === 'return_portal' && dist < 1.15 && this.elapsed > 1.5) {
        this.enterRealm('hub', false);
        return;
      }
    }
  }

  private raiseEastBridge(): void {
    if (this.bridgeRaised || !this.layout) return;
    this.bridgeRaised = true;
    const ts = this.layout.tileSize;
    const halfW = (this.layout.width * ts) / 2;
    const halfH = (this.layout.height * ts) / 2;
    const bGeo = new THREE.BoxGeometry(ts * 1.15, 0.25, ts);
    const bMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.6,
      roughness: 0.35,
      emissive: 0x78350f,
      emissiveIntensity: 0.35,
    });
    const tilesToRaise: Array<[number, number]> = this.layout.bridgeTiles ?? [
      [22, 7],
      [22, 8],
      [22, 9],
    ];
    for (const [tx, tz] of tilesToRaise) {
      this.layout.tiles[tz][tx] = 6;
      const m = new THREE.Mesh(bGeo, bMat);
      m.position.set(tx * ts - halfW + ts * 0.5, -0.02, tz * ts - halfH + ts * 0.5);
      this.worldGroup.add(m);
      this.bridgeMeshes.push(m);
    }
    this.worldDisposables.push(bGeo, bMat);
    gauntletSfx.playKeyUnlock();
    this.screenShake = 0.25;
    this.announce('Secret Floor Switch pressed! Stone Bridge raised across the Chasm!', true);
  }

  private updateProjectiles(dt: number): void {
    const reflectActive = this.activeRelics.has('reflect_shield');

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      pr.x += pr.vx * dt;
      pr.z += pr.vz * dt;
      pr.mesh.position.set(pr.x, pr.y, pr.z);

      let remove = pr.life <= 0 || this.collidesWall(pr.x, pr.z, 0.2, false);

      if (!remove && pr.fromPlayer) {
        // Hit Cracked Secret Walls
        for (const gw of this.gateWalls) {
          if (gw.kind === 'cracked' && !gw.open) {
            if (Math.hypot(gw.mesh.position.x - pr.x, gw.mesh.position.z - pr.z) < 1.55) {
              this.damageCrackedWall(gw, pr.damage);
              if (!pr.piercing) remove = true;
            }
          }
        }
        // Hit Explosive Powder Kegs & Poison Cider (classic Gauntlet safe-shoot!)
        for (const prop of this.props) {
          if (!prop.active) continue;
          if (prop.kind === 'barrel' && Math.hypot(prop.x - pr.x, prop.z - pr.z) < 0.85) {
            this.detonateBarrel(prop);
            if (!pr.piercing) remove = true;
          } else if (prop.kind === 'poison_cider' && Math.hypot(prop.x - pr.x, prop.z - pr.z) < 0.75) {
            this.spawnBurst(prop.x, 0.5, prop.z, '#a855f7', 16, 4.5);
            this.consumeProp(prop);
            this.addScore(150);
            this.announce('Shot Poison Cider safely from afar! +150 Score!');
            if (!pr.piercing) remove = true;
          }
        }
        // Hit Generators
        for (const gen of this.generators) {
          if (Math.hypot(gen.x - pr.x, gen.z - pr.z) < 0.95 + pr.radius) {
            this.damageGenerator(gen, pr.damage);
            if (!pr.piercing) remove = true;
            break;
          }
        }
        // Hit Enemies
        if (!remove) {
          for (const e of this.enemies) {
            if (Math.hypot(e.x - pr.x, e.z - pr.z) < e.radius + pr.radius) {
              this.damageEnemy(e, pr.damage, pr.element === 'enemy' ? 'burn' : pr.element, false);
              if (!pr.piercing) {
                remove = true;
                break;
              }
            }
          }
        }
      } else if (!remove && !pr.fromPlayer) {
        // Enemy projectile vs Hero
        if (Math.hypot(this.heroX - pr.x, this.heroZ - pr.z) < 0.8 + pr.radius) {
          if (reflectActive) {
            pr.fromPlayer = true;
            pr.vx *= -1.35;
            pr.vz *= -1.35;
            pr.damage *= 2.2;
            (pr.mesh.material as THREE.MeshBasicMaterial).color.set('#38bdf8');
            gauntletSfx.playKeyUnlock();
          } else {
            this.damageHero(pr.damage, true);
            remove = true;
          }
        }
      }

      if (remove) {
        this.fxGroup.remove(pr.mesh);
        (pr.mesh.material as THREE.Material).dispose();
        this.projectiles.splice(i, 1);
      }
    }
  }

  private damageEnemy(
    e: EnemyEntity,
    rawDmg: number,
    element: 'burn' | 'freeze' | 'shock' | 'poison',
    isMelee: boolean
  ): void {
    const dmg = e.isBoss && e.bossWeakened ? rawDmg * 2.5 : rawDmg;
    e.hp -= dmg;
    e.hitFlash = 0.14;
    if (element === 'burn') e.burnTimer = 2.6;
    if (element === 'freeze') e.freezeTimer = 2.4;
    if (element === 'poison') e.poisonTimer = 3.2;

    if (element === 'shock') {
      // Yellow Lightning arcs to 1 nearby enemy!
      for (const other of this.enemies) {
        if (other !== e && Math.hypot(other.x - e.x, other.z - e.z) < 5.5) {
          other.hp -= dmg * 0.45;
          other.hitFlash = 0.12;
          this.spawnBurst(other.x, 1.0, other.z, '#fde047', 6, 3.5);
          break;
        }
      }
    }

    this.turbo = Math.min(100, this.turbo + (isMelee ? 4.5 : 2.2));
    gauntletSfx.playEnemyHit(isMelee);
    this.spawnBurst(e.x, 1.1, e.z, ELEMENT_COLORS[this.colorId].glowHex, 6, 4);

    // Final Boss Skorne -> True Skorne Phase 2 Transformation!
    if (e.isBoss && this.realmId === 'underworld' && e.bossPhase === 1 && e.hp <= e.maxHp * 0.45 && e.hp > 0) {
      e.bossPhase = 2;
      e.speed *= 1.28;
      this.entityGroup.remove(e.mesh);
      this.disposeObjectTree(e.mesh);
      e.mesh = buildBossModel('skorne', true);
      e.mesh.position.set(e.x, 0, e.z);
      this.entityGroup.add(e.mesh);
      gauntletSfx.playBossRoar();
      this.screenShake = 0.65;
      this.spawnBurst(e.x, 2.2, e.z, '#ff4500', 55, 12);
      this.announce('SKORNE TRANSFORMS INTO TRUE SKORNE! UNLEASH SOUL SAVIOR!', true);
    }
  }

  private killEnemy(e: EnemyEntity, index: number): void {
    const isBoss = Boolean(e.isBoss);
    this.entityGroup.remove(e.mesh);
    this.disposeObjectTree(e.mesh);
    this.enemies.splice(index, 1);

    const xpGain = isBoss ? 1500 : e.kind === 'general' ? 240 : e.kind === 'golem' ? 145 : 75;
    const goldGain = isBoss ? 1200 : e.kind === 'general' ? 140 : 40;
    this.gold += goldGain;
    this.awardXp(xpGain);
    this.addScore(xpGain * 2);
    this.turbo = Math.min(100, this.turbo + (isBoss ? 100 : 12));
    this.spawnBurst(e.x, 1.1, e.z, isBoss ? '#fbbf24' : '#f97316', isBoss ? 65 : 18, isBoss ? 12 : 6);

    if (isBoss) {
      this.bossEntity = null;
      this.handleBossDefeated();
    }
  }

  private handleBossDefeated(): void {
    const realm = REALM_MAP[this.realmId];
    this.clearedRealms.add(this.realmId);
    // Award realm bonus runestone if player missed any in the realm
    const bonusKey = `${realm.id}_boss`;
    if (this.collectedRunestones.size < 13) {
      this.collectedRunestones.add(bonusKey);
    }
    this.checkSecretHeroUnlocks();
    this.hp = this.maxHp;
    gauntletSfx.playBossVictory();

    if (this.realmId === 'underworld') {
      this.victory = true;
      this.addScore(15000);
      this.announce('TRUE SKORNE HAS FALLEN! YOU ARE THE SAVIOR OF THE REALMS!', true);
    } else {
      this.announce(
        `${realm.bossName.toUpperCase()} SLAIN! Step into the Victory Portal to return to Sumner’s Tower!`,
        true
      );
      // Spawn Return Portal in center of Boss Arena
      const portalMesh = buildPortalModel('#fbbf24', 1.25);
      portalMesh.position.set(0, 0, 0);
      this.entityGroup.add(portalMesh);
      this.props.push({
        id: this.nextEntityId++,
        kind: 'return_portal',
        mesh: portalMesh,
        x: 0,
        z: 0,
        active: true,
      });
    }
    this.emitHud();
  }

  private damageGenerator(gen: GeneratorEntity, dmg: number): void {
    gen.hp -= dmg;
    gen.hitFlash = 0.16;
    gauntletSfx.playEnemyHit(true);
    this.spawnBurst(gen.x, 1.2, gen.z, '#38bdf8', 7, 4.5);
    if (gen.hp <= 0) {
      const idx = this.generators.indexOf(gen);
      if (idx >= 0) this.generators.splice(idx, 1);
      this.entityGroup.remove(gen.mesh);
      this.disposeObjectTree(gen.mesh);
      this.gold += 90 * gen.tier;
      this.awardXp(160 * gen.tier);
      this.addScore(450 * gen.tier);
      this.spawnBurst(gen.x, 1.1, gen.z, '#fbbf24', 28, 7.5);
      gauntletSfx.playBarrelExplosion();
    }
  }

  private damageCrackedWall(gw: GateWallRecord, dmg: number): void {
    gw.hp -= dmg;
    this.spawnBurst(gw.mesh.position.x, 1.3, gw.mesh.position.z, '#fbbf24', 10, 5);
    if (gw.hp <= 0 && !gw.open) {
      gw.open = true;
      gw.mesh.visible = false;
      if (this.layout) this.layout.tiles[gw.tz][gw.tx] = 0;
      gauntletSfx.playBarrelExplosion();
      this.screenShake = 0.3;
      this.announce('SECRET WALL SHATTERED! Hidden Runestone & Treasure Vault revealed!', true);
    }
  }

  private detonateBarrel(prop: PropEntity): void {
    if (!prop.active) return;
    this.consumeProp(prop);
    gauntletSfx.playBarrelExplosion();
    this.screenShake = 0.45;
    this.triggerFxLight(prop.x, prop.z, '#ff6b00', 10, 0.38);
    this.spawnBurst(prop.x, 0.8, prop.z, '#ff6b00', 42, 11);

    const blastR = 5.4;
    for (const e of [...this.enemies]) {
      if (Math.hypot(e.x - prop.x, e.z - prop.z) <= blastR) {
        this.damageEnemy(e, 240, 'burn', true);
      }
    }
    for (const gen of [...this.generators]) {
      if (Math.hypot(gen.x - prop.x, gen.z - prop.z) <= blastR) {
        this.damageGenerator(gen, 240);
      }
    }
    for (const gw of this.gateWalls) {
      if (gw.kind === 'cracked' && !gw.open) {
        if (Math.hypot(gw.mesh.position.x - prop.x, gw.mesh.position.z - prop.z) <= blastR + 1.2) {
          this.damageCrackedWall(gw, 240);
        }
      }
    }
    // Chain reaction to adjacent barrels!
    for (const other of this.props) {
      if (other.active && other.kind === 'barrel' && Math.hypot(other.x - prop.x, other.z - prop.z) <= blastR) {
        this.detonateBarrel(other);
      }
    }
  }

  private damageHero(rawDmg: number, respectInvuln: boolean): void {
    if (this.gameOver || this.activeRelics.has('reflect_shield')) return;
    if (respectInvuln && this.invulnTimer > 0) return;

    const stats = this.getEffectiveStats();
    const armorReduction = Math.min(0.62, stats.armor * 0.0042);
    const blockMult = this.blocking ? 0.3 : 1.0;
    const dmg = Math.max(2, rawDmg * (1 - armorReduction) * blockMult);
    this.hp = Math.max(0, this.hp - dmg);
    if (respectInvuln) {
      this.invulnTimer = 0.48;
      gauntletSfx.playPlayerHurt();
      this.screenShake = Math.max(this.screenShake, 0.24);
    }
    if (this.hp <= 0) this.triggerGameOver();
  }

  private triggerGameOver(): void {
    this.gameOver = true;
    gauntletSfx.playDeathBell();
    this.announce('YOUR HERO HAS FALLEN! Insert Coin / Revive at Sumner’s Tower!', true);
    this.emitHud();
  }

  private awardXp(amount: number): void {
    this.xp += amount;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level += 1;
      this.xpNext = Math.round(this.xpNext * 1.38);
      this.recalcMaxHp();
      this.hp = Math.min(this.maxHp, this.hp + 250);
      this.rebuildHeroMesh();
      gauntletSfx.playLevelUp();
      this.spawnBurst(this.heroX, 1.2, this.heroZ, '#fbbf24', 44, 9);
      const title = getLegendRankTitle(this.level, HERO_MAP[this.heroId].name);
      this.announce(`LEVEL ${this.level}! ${ELEMENT_COLORS[this.colorId].name} ${title}!`, true);
    }
  }

  private checkSecretHeroUnlocks(): void {
    const count = this.collectedRunestones.size;
    for (const h of HERO_CLASSES) {
      if (h.secret && h.unlockRunestones && count >= h.unlockRunestones && !this.unlockedSecretHeroes.has(h.id)) {
        this.unlockedSecretHeroes.add(h.id);
        this.announce(`SECRET HERO UNLOCKED: ${h.name.toUpperCase()}! Visit Sumner’s Hero Pedestal!`, true);
      }
    }
  }

  private grantRelic(relicId: RelicId): void {
    const def = RELIC_DEFS[relicId];
    if (this.inventoryRelics.length < 5) {
      this.inventoryRelics.push(relicId);
      this.announce(`Stored ${def.name} in Inventory Slot ${this.inventoryRelics.length}!`);
    } else {
      this.activeRelics.set(relicId, { remaining: def.duration, duration: def.duration });
      this.announce(`${def.name} auto-activated!`);
    }
  }

  private addScore(pts: number): void {
    this.score += Math.round(pts);
    if (this.score > this.highScore) {
      this.highScore = this.score;
      try {
        window.localStorage.setItem(HIGH_SCORE_KEY, String(this.highScore));
      } catch {
        // ignore
      }
    }
  }

  private spawnEnemyProjectile(
    x: number,
    z: number,
    dx: number,
    dz: number,
    speed: number,
    damage: number,
    colorHex: string
  ): void {
    const mat = new THREE.MeshBasicMaterial({ color: colorHex });
    const mesh = new THREE.Mesh(this.projGeo, mat);
    mesh.scale.setScalar(1.1);
    mesh.position.set(x, 1.15, z);
    this.fxGroup.add(mesh);
    this.projectiles.push({
      mesh,
      x,
      y: 1.15,
      z,
      vx: dx * speed,
      vz: dz * speed,
      fromPlayer: false,
      damage,
      life: 2.4,
      piercing: false,
      element: 'enemy',
      radius: 0.34,
    });
  }

  private consumeProp(p: PropEntity): void {
    p.active = false;
    this.entityGroup.remove(p.mesh);
    this.disposeObjectTree(p.mesh);
  }

  private updateXRayVisuals(): void {
    const xray = this.activeRelics.has('xray_glasses');
    for (const gw of this.gateWalls) {
      if (gw.kind === 'cracked' && !gw.open) {
        const mat = gw.mesh.material as THREE.MeshStandardMaterial;
        mat.emissive.set(xray ? '#22d3ee' : '#000000');
        mat.emissiveIntensity = xray ? 0.65 + Math.sin(this.elapsed * 8) * 0.25 : 0;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Collision & Tile Helpers
  // ---------------------------------------------------------------------------
  private getTileAtWorld(wx: number, wz: number): TileCode {
    if (!this.layout) return 1;
    const ts = this.layout.tileSize;
    const halfW = (this.layout.width * ts) / 2;
    const halfH = (this.layout.height * ts) / 2;
    const tx = Math.floor((wx + halfW) / ts);
    const tz = Math.floor((wz + halfH) / ts);
    if (tx < 0 || tz < 0 || tx >= this.layout.width || tz >= this.layout.height) return 1;
    return this.layout.tiles[tz][tx];
  }

  private collidesWall(wx: number, wz: number, radius: number, isPlayer: boolean): boolean {
    if (!this.layout) return true;
    const ts = this.layout.tileSize;
    const halfW = (this.layout.width * ts) / 2;
    const halfH = (this.layout.height * ts) / 2;
    const pts = [
      [wx - radius, wz - radius],
      [wx + radius, wz - radius],
      [wx - radius, wz + radius],
      [wx + radius, wz + radius],
    ];
    for (const [px, pz] of pts) {
      const tx = Math.floor((px + halfW) / ts);
      const tz = Math.floor((pz + halfH) / ts);
      if (tx < 0 || tz < 0 || tx >= this.layout.width || tz >= this.layout.height) return true;
      const code = this.layout.tiles[tz][tx];
      if (code === 1 || code === 2 || code === 5) return true;
      if (code === 4) {
        if (isPlayer && this.keys > 0) {
          this.unlockGateCluster(tx, tz);
          return false;
        }
        if (isPlayer) {
          this.announce('Locked Gate! Find a Golden Key to reach the Legendary Weapon Shrine!');
        }
        return true;
      }
    }
    return false;
  }

  private unlockGateCluster(tx: number, tz: number): void {
    this.keys -= 1;
    gauntletSfx.playKeyUnlock();
    for (const gw of this.gateWalls) {
      if (gw.kind === 'gate' && !gw.open && Math.abs(gw.tx - tx) <= 2 && Math.abs(gw.tz - tz) <= 2) {
        gw.open = true;
        gw.mesh.visible = false;
        if (this.layout) this.layout.tiles[gw.tz][gw.tx] = 0;
        this.spawnBurst(gw.mesh.position.x, 1.4, gw.mesh.position.z, '#fde047', 16, 5);
      }
    }
    this.announce('Golden Gate Unlocked! Claim the Legendary Boss-Weakening Weapon inside!', true);
    this.emitHud();
  }

  // ---------------------------------------------------------------------------
  // Proximity Interactions (Sumner's Tower Hub)
  // ---------------------------------------------------------------------------
  private getProximityPrompt(): HudSnapshot['proximityPrompt'] {
    if (this.realmId !== 'hub') return null;
    for (const p of this.props) {
      if (!p.active) continue;
      const d = Math.hypot(p.x - this.heroX, p.z - this.heroZ);
      if (p.kind === 'sumner_npc' && d < 3.4) {
        return { label: 'Speak with Sumner · Open Realm Portal Map [E / Space]', action: 'sumner' };
      }
      if (p.kind === 'armory_stand' && d < 2.8) {
        return { label: 'Enter Sumner’s Armory Shop [E / Space]', action: 'armory' };
      }
      if (p.kind === 'hero_stand' && d < 2.8) {
        return { label: 'Change Hero Class, Color & Secret Codes [E / Space]', action: 'hero_pedestal' };
      }
      if (p.kind === 'hub_portal' && p.realmId && d < 2.6) {
        const r = REALM_MAP[p.realmId];
        return {
          label: `Enter ${r.name} Portal (${r.bossName}) [E / Space]`,
          action: 'portal',
          realmId: r.id,
        };
      }
    }
    return null;
  }

  private executeProximityAction(prox: NonNullable<HudSnapshot['proximityPrompt']>): void {
    if (prox.action === 'armory') {
      this.onOpenModal('armory');
    } else if (prox.action === 'hero_pedestal') {
      this.onOpenModal('hero');
    } else if (prox.action === 'sumner') {
      this.onOpenModal('portals');
    } else if (prox.action === 'portal' && prox.realmId) {
      this.enterRealm(prox.realmId, false);
    }
  }

  // ---------------------------------------------------------------------------
  // 3D Particles, FX Lights & Smooth Camera
  // ---------------------------------------------------------------------------
  private triggerFxLight(x: number, z: number, hex: string, intensity: number, dur: number): void {
    this.fxLight.position.set(x, 2.2, z);
    this.fxLight.color.set(hex);
    this.fxLight.intensity = intensity;
    this.fxLightTimer = dur;
  }

  private spawnBurst(x: number, y: number, z: number, hex: string, count: number, speed: number): void {
    const baseCol = new THREE.Color(hex);
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.MAX_PARTICLES) {
        this.particles.shift();
      }
      const a = Math.random() * Math.PI * 2;
      const spd = (0.35 + Math.random() * 0.75) * speed;
      const life = 0.28 + Math.random() * 0.42;
      this.particles.push({
        x,
        y,
        z,
        vx: Math.cos(a) * spd,
        vy: 1.5 + Math.random() * (speed * 0.65),
        vz: Math.sin(a) * spd,
        life,
        maxLife: life,
        scale: 0.6 + Math.random() * 1.0,
        color: baseCol.clone(),
      });
    }
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy -= 14 * dt;
      p.x += p.vx * dt;
      p.y = Math.max(0.1, p.y + p.vy * dt);
      p.z += p.vz * dt;
    }

    const n = this.particles.length;
    this.particleMesh.count = n;
    for (let i = 0; i < n; i++) {
      const p = this.particles[i];
      const s = p.scale * (p.life / p.maxLife);
      _v3.set(p.x, p.y, p.z);
      _q.identity();
      _s3.set(s, s, s);
      _m4.compose(_v3, _q, _s3);
      this.particleMesh.setMatrixAt(i, _m4);
      this.particleMesh.setColorAt(i, p.color);
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
  }

  private getDesiredCameraOffsets(): { y: number; z: number; lookAhead: number } {
    if (this.cameraMode === 'action') return { y: 9.2, z: 10.2, lookAhead: 2.2 };
    if (this.cameraMode === 'tactical') return { y: 21.5, z: 14.5, lookAhead: 0.6 };
    // Classic Gauntlet: Dark Legacy Angled 3D Arcade Camera
    return { y: 14.8, z: 12.6, lookAhead: 1.2 };
  }

  private snapCamera(): void {
    const off = this.getDesiredCameraOffsets();
    this.camPos.set(this.heroX, off.y, this.heroZ + off.z);
    this.camLook.set(this.heroX, 0.8, this.heroZ);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  private updateCamera(dt: number): void {
    const off = this.getDesiredCameraOffsets();
    const lx = this.heroX + Math.sin(this.heroFacing) * off.lookAhead;
    const lz = this.heroZ + Math.cos(this.heroFacing) * off.lookAhead;

    _v3.set(this.heroX, off.y, this.heroZ + off.z);
    _v3b.set(lx, 0.9, lz);

    const k = 1 - Math.exp(-7.5 * dt);
    this.camPos.lerp(_v3, k);
    this.camLook.lerp(_v3b, k);

    const shakeX = this.screenShake > 0 ? (Math.random() - 0.5) * this.screenShake * 0.9 : 0;
    const shakeY = this.screenShake > 0 ? (Math.random() - 0.5) * this.screenShake * 0.9 : 0;
    this.camera.position.set(this.camPos.x + shakeX, this.camPos.y + shakeY, this.camPos.z);
    this.camera.lookAt(this.camLook);
  }

  private announce(line: string, speak = false): void {
    this.narratorLine = line;
    this.narratorSeq += 1;
    if (speak) {
      gauntletSfx.speakNarrator(line, true);
    }
  }

  private emitHud(): void {
    const realm = this.realmId === 'hub' ? null : REALM_MAP[this.realmId];
    const hero = HERO_MAP[this.heroId];
    const el = ELEMENT_COLORS[this.colorId];
    const activeRelicsArr: ActiveRelicTimer[] = [];
    for (const [id, v] of this.activeRelics.entries()) {
      activeRelicsArr.push({ id, remaining: v.remaining, duration: v.duration });
    }

    const snap: HudSnapshot = {
      realmId: this.realmId,
      realmName: realm ? realm.name : 'Sumner’s Tower',
      isBossArena: this.isBossArena,
      isHub: this.realmId === 'hub',
      heroId: this.heroId,
      colorId: this.colorId,
      heroTitle: `${el.name} ${getLegendRankTitle(this.level, hero.name)}`,
      level: this.level,
      xp: this.xp,
      xpNext: this.xpNext,
      hp: Math.ceil(this.hp),
      maxHp: this.maxHp,
      turbo: Math.round(this.turbo),
      score: this.score,
      highScore: this.highScore,
      gold: this.gold,
      keys: this.keys,
      potions: this.potions,
      runestonesCollected: this.collectedRunestones.size,
      totalRunestones: 13,
      clearedRealms: Array.from(this.clearedRealms),
      legendaryWeapons: Array.from(this.legendaryWeapons),
      activeRealmLegendaryName: realm ? realm.legendaryWeapon.name : null,
      hasMatchingLegendary: realm ? this.legendaryWeapons.has(realm.legendaryWeapon.id) : false,
      inventoryRelics: [...this.inventoryRelics],
      activeRelics: activeRelicsArr,
      boss: this.bossEntity
        ? {
            name:
              this.realmId === 'underworld' && this.bossEntity.bossPhase === 2
                ? 'True Skorne'
                : realm?.bossName ?? 'Boss',
            hp: Math.max(0, Math.ceil(this.bossEntity.hp)),
            maxHp: Math.ceil(this.bossEntity.maxHp),
            phase: this.bossEntity.bossPhase ?? 1,
            weakened: Boolean(this.bossEntity.bossWeakened),
          }
        : null,
      narratorLine: this.narratorLine,
      narratorSeq: this.narratorSeq,
      proximityPrompt: this.getProximityPrompt(),
      stats: this.getEffectiveStats(),
      unlockedSecretHeroes: Array.from(this.unlockedSecretHeroes),
      freeWarp: this.freeWarp,
      arcadeDrain: this.arcadeDrain,
      cameraMode: this.cameraMode,
      gameOver: this.gameOver,
      victory: this.victory,
      isSoftwareGl: this.isSoftwareGl,
    };
    this.onHudUpdate(snap);
  }

  private disposeObjectTree(obj: THREE.Object3D): void {
    obj.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    if (this.swTimerId) clearTimeout(this.swTimerId);
    this.resizeObserver.disconnect();
    this.clearWorld();
    if (this.heroRig) {
      this.disposeObjectTree(this.heroRig.root);
      this.heroRig = null;
    }
    this.particleMesh.geometry.dispose();
    (this.particleMesh.material as THREE.Material).dispose();
    this.projGeo.dispose();
    this.slashRing.geometry.dispose();
    (this.slashRing.material as THREE.Material).dispose();
    this.envRT.dispose();
    this.pmremGenerator.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}

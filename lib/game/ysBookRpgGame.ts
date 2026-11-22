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
import { arcadeAudio } from './audio';
import { arcadeMusic } from './musicEngine';
import {
  PortraitId,
  WorldChest,
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
import { YsThreeWorldRenderer } from './ysThreeWorldRenderer';

export type { YsBookVariant } from './ysWorldBuilder';

const sfx = {
  playCoin: () => arcadeAudio.playCoin(),
  playShoot: () => arcadeAudio.playLaser(),
  playPellet: () => arcadeAudio.playWaka(),
  playPowerup: () => arcadeAudio.playKeyUnlock(),
  playBounce: () => arcadeAudio.playRockThud(),
  playEnemyHit: () => arcadeAudio.playEatGhost(),
  playExplosion: () => arcadeAudio.playExplosion(),
  playStageClear: () => arcadeAudio.playStageClear(),
  playGameOver: () => arcadeAudio.playDeath(),
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

interface DialogueOverlay {
  speaker: string;
  portrait: PortraitId;
  lines: string[];
  shopKind?: 'weapon' | 'armor' | 'inn';
  cursor: number;
}

interface ShopOption {
  label: string;
  cost: number;
  desc: string;
  action: () => string;
}

interface InteractTarget {
  kind: 'npc' | 'inspect' | 'shrub' | 'chest';
  x: number;
  y: number;
  label: string;
  npc?: WorldNpc;
  inspectable?: WorldInspectable;
  shrub?: WorldShrub;
  chest?: WorldChest;
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
  public readonly logicalWidth = 640;
  public readonly logicalHeight = 680;
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

  private flags = new Set<string>();
  private openedChests = new Set<string>();
  private npcAngles = new Map<string, number>();

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
    this.enterZone(variant === 'ys1' ? 'minea' : 'lance', 28, 22, false);
    this.phase = 'TITLE';
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
    this.dialogue = null;
    this.showFullMap = false;
    this.particles = [];
    this.popups = [];
    this.combatBolts = [];
    this.impactFlashes = [];
    this.armorGibs = [];
  }

  public startNewGame(): void {
    this.zones = this.variant === 'ys1' ? createYs1World() : createYs2World();
    this.resetHeroState();
    const startZone = this.variant === 'ys1' ? 'minea' : 'lance';
    this.enterZone(startZone, 28, 22, true);
    this.phase = 'PLAYING';
    sfx.playCoin();

    if (this.variant === 'ys1') {
      this.dialogue = {
        speaker: 'SARA THE FORTUNE TELLER',
        portrait: 'sara',
        lines: [
          'Adol! Esteria is vast—investigate townsfolk, signs, statues, & rustling shrubs!',
          'Walk right into bushes to search them, & slip behind tall trees to scout hidden lanes.',
          'Walk through the wide North Gate to enter Esteria Plains & the Shrine of Solomon!',
        ],
        cursor: 0,
      };
    } else {
      this.dialogue = {
        speaker: 'LILIA OF LANCE VILLAGE',
        portrait: 'lilia',
        lines: [
          'Adol, you awakened atop the sprawling Floating Land of Ys!',
          'Search our flower shrubs for the Celceta Blossom, & press [SHIFT/X] for Fire Magic!',
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
    this.enterZone(town, 28, 22, true);
    this.phase = 'PLAYING';
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public dispose(): void {
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
      if (!this.flags.has('sara_crystal')) return 'Quest: Search Minea Plaza shrubs for Sara’s Crystal';
      if (!this.flags.has('sara_blessing')) return 'Quest: Return Sapphire Crystal to Sara in Minea';
      if (!this.flags.has('roda_blessing')) return 'Quest: Investigate the Ancient Roda Tree in Esteria Plains';
      if (!this.flags.has('shrine_boss')) return 'Quest: Explore Shrine of Solomon (NW) & defeat Jenocres';
      if (!this.flags.has('ys1_clear')) return 'Quest: Ascend Darm Tower (NE) & vanquish Dark Fact';
      return 'Esteria Saved! Explore remaining secrets & Books of Ys!';
    } else {
      if (!this.flags.has('celceta_blossom')) return 'Quest: Search western Lance shrubs for Celceta Blossom';
      if (!this.flags.has('lilia_charm')) return 'Quest: Bring Celceta Blossom to Lilia in Lance Village';
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

    // Switch charming per-zone background soundtrack (Town Fountain / Esteria Field / Palace Shrine)
    if (announce && typeof window !== 'undefined') {
      const trackId =
        z.theme === 'town' || z.theme === 'village'
          ? 'ys_town_fountain'
          : z.theme === 'plains' || z.theme === 'ruins'
            ? 'ys_falcom_rock'
            : 'ys_shrine_palace';
      arcadeMusic.switchTrackById(trackId);
    }

    if (announce) {
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
    const base = 8 + this.level * 4 + this.WEAPONS[this.weaponTier].atk;
    return this.equippedRing === 'power' ? Math.round(base * 1.25) : base;
  }

  private getEffectiveDef(): number {
    const base = 4 + this.level * 3 + this.ARMORS[this.armorTier].def + this.SHIELDS[this.shieldTier].def;
    return this.equippedRing === 'shield' ? Math.round(base * 1.25) : base;
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

  private getShopOptions(kind: 'weapon' | 'armor' | 'inn'): ShopOption[] {
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

    if (this.phase === 'TITLE') {
      this.walkAnim += dt * 3;
      this.bodyAngle = Math.sin(this.time * 0.7) * 0.9 + Math.PI * 0.5;
      return;
    }
    if (this.phase === 'PAUSED' || this.phase === 'GAME_OVER') return;

    if (this.phase === 'STAGE_CLEAR') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) this.phase = 'PLAYING';
      return;
    }

    // Handle Chronicles+ Dialogue / Shop Window
    if (this.dialogue) {
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

    const zone = this.zones[this.currentZoneId];
    this.stepPlayer(dt, zone);
    this.stepShrubs(dt, zone);
    this.stepNpcFacing(dt, zone);
    this.stepProjectiles(dt, zone);
    this.stepEnemies(dt, zone);

    // Smooth 4-way scrolling camera clamped to full-viewport tilted 2.5D zone bounds
    const activeZone = this.zones[this.currentZoneId];
    const halfW = this.logicalWidth * 0.5;
    const halfHWorld = (this.logicalHeight * 0.5) / TILT;
    const worldW = activeZone.width * TILE;
    const worldH = activeZone.height * TILE;
    const targetCamX = Math.max(halfW, Math.min(worldW - halfW, this.px));
    const targetCamY = Math.max(halfHWorld, Math.min(worldH - halfHWorld, this.py));
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

    // Tall 2.5D Trees, Marble Pillars, Crystal Spires: ONLY block the compact trunk base!
    if (c === 2 || c === 9) {
      const cx = (tx + 0.5) * TILE;
      const trunkY = (ty + 0.72) * TILE;
      const dx = wx - cx;
      const dy = wy - trunkY;
      const rad = c === 9 ? 16 : 11;
      return dx * dx + dy * dy < rad * rad;
    }

    // Solid inspectables (fountains, statues, wells, crates) block their center pedestal only
    for (const obj of zone.inspectables) {
      if (obj.kind === 'campfire') continue;
      if (Math.abs(obj.tx - tx) <= 1 && Math.abs(obj.ty - ty) <= 1) {
        const ox = (obj.tx + 0.5) * TILE;
        const oy = (obj.ty + 0.58) * TILE;
        const rad = obj.kind === 'fountain' ? 20 : 12;
        if (Math.hypot(wx - ox, wy - oy) < rad) return true;
      }
    }

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
    const inShrubSlow = this.inShrubId ? 0.84 : 1.0;
    const spd = 208 * mv.scale * dashBoost * inShrubSlow;

    const mag = Math.hypot(mv.vx, mv.vy);
    const moving = mag > 0.08;
    if (moving) {
      const ux = mv.vx / mag;
      const uy = mv.vy / mag;
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

    // Auto-open Treasure Chests on direct contact
    for (const ch of zone.chests) {
      if (this.openedChests.has(ch.id)) continue;
      const cx = (ch.tx + 0.5) * TILE;
      const cy = (ch.ty + 0.5) * TILE;
      if (Math.hypot(this.px - cx, this.py - cy) < 28) {
        this.openChest(ch);
      }
    }

    // Check Wide Zone Portals (with cooldown so you NEVER bounce back!)
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
      this.popups.push({ x: sx, y: sy - 24, text: `+${amt} GOLD!`, color: '#fde047', life: 1.3, maxLife: 1.3 });
    } else if (sh.hiddenKind === 'herb') {
      this.herbs++;
      sfx.playPowerup();
      this.popups.push({ x: sx, y: sy - 24, text: 'FOUND HEAL HERB!', color: '#4ade80', life: 1.4, maxLife: 1.4 });
    } else if (sh.hiddenKind === 'seed') {
      this.maxHp += 10;
      this.hp = Math.min(this.maxHp, this.hp + 20);
      sfx.playStageClear();
      this.popups.push({ x: sx, y: sy - 26, text: sh.rewardName ?? '+10 MAX HP!', color: '#38bdf8', life: 1.6, maxLife: 1.6 });
    } else if (sh.hiddenKind === 'quest_item') {
      if (sh.grantFlag) this.flags.add(sh.grantFlag);
      sfx.playStageClear();
      spawnBurst(this.particles, sx, sy, '#38bdf8', 22, 160, 3.6);
      this.dialogue = {
        speaker: 'DISCOVERY IN THE SHRUB!',
        portrait: 'adol',
        lines: [
          `You part the rustling foliage and discover: ${sh.rewardName ?? 'Mysterious Relic'}!`,
          this.variant === 'ys1'
            ? 'Bring Sara’s Sapphire Crystal back to Sara in Minea Town!'
            : 'Bring the rare Celceta Blossom to Lilia in Lance Village!',
        ],
        cursor: 0,
      };
    } else if (sh.hiddenKind === 'clue' && sh.clueText) {
      sfx.playPowerup();
      this.dialogue = {
        speaker: 'INVESTIGATION CLUE',
        portrait: 'adol',
        lines: [sh.clueText],
        cursor: 0,
      };
    } else if (sh.hiddenKind === 'slime' && !zone.safeZone) {
      sfx.playBounce();
      this.enemies.push(this.createEnemy('slime', sx + 22, sy));
      this.popups.push({ x: sx, y: sy - 24, text: 'WILD SLIME LEAPED OUT!', color: '#f97316', life: 1.3, maxLife: 1.3 });
    }
  }

  private stepNpcFacing(dt: number, zone: ZoneDef): void {
    for (const npc of zone.npcs) {
      const nx = (npc.tx + 0.5) * TILE;
      const ny = (npc.ty + 0.5) * TILE;
      const dist = Math.hypot(this.px - nx, this.py - ny);
      const cur = this.npcAngles.get(npc.id) ?? Math.PI * 0.5;
      const target = dist < 130 ? Math.atan2(this.py - ny, this.px - nx) : Math.PI * 0.5;
      this.npcAngles.set(npc.id, lerpAngle(cur, target, dt * 7));
    }
  }

  private findNearestInteractable(zone: ZoneDef): InteractTarget | null {
    let best: InteractTarget | null = null;
    let bestDist = 56;

    for (const npc of zone.npcs) {
      const x = (npc.tx + 0.5) * TILE;
      const y = (npc.ty + 0.5) * TILE;
      const d = Math.hypot(this.px - x, this.py - y);
      if (d < bestDist) {
        bestDist = d;
        best = { kind: 'npc', x, y, label: `TALK · ${npc.name}`, npc };
      }
    }

    for (const obj of zone.inspectables) {
      const x = (obj.tx + 0.5) * TILE;
      const y = (obj.ty + 0.5) * TILE;
      const d = Math.hypot(this.px - x, this.py - y);
      if (d < bestDist) {
        bestDist = d;
        const verb = obj.kind === 'sign' || obj.kind === 'tablet' ? 'READ' : 'INSPECT';
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
      // Face the NPC smoothly
      this.bodyAngle = Math.atan2(target.y - this.py, target.x - this.px);

      let text = npc.greeting;
      if (npc.followUpFlag && this.flags.has(npc.followUpFlag) && npc.followUpGreeting) {
        text = npc.followUpGreeting;
        if (npc.grantFlag && !this.flags.has(npc.grantFlag)) {
          this.flags.add(npc.grantFlag);
          if (npc.rewardGold) {
            this.gold += npc.rewardGold;
            this.addScore(500);
            sfx.playStageClear();
          }
        }
      }

      this.dialogue = {
        speaker: npc.name,
        portrait: npc.portrait,
        lines: [text],
        shopKind: npc.role === 'quest' || npc.role === 'villager' ? undefined : npc.role,
        cursor: 0,
      };
      return true;
    }

    if (target.kind === 'inspect' && target.inspectable) {
      const obj = target.inspectable;
      this.bodyAngle = Math.atan2(target.y - this.py, target.x - this.px);
      sfx.playPowerup();

      if (!obj.inspected) {
        obj.inspected = true;
        this.secretsFound++;
        this.addScore(200);
        if (obj.grantFlag) this.flags.add(obj.grantFlag);
        if (obj.rewardGold) {
          this.gold += obj.rewardGold;
          sfx.playCoin();
        }
      }
      if (obj.healMp) {
        this.hp = this.maxHp;
        this.mp = this.maxMp;
        spawnBurst(this.particles, this.px, this.py, '#38bdf8', 18, 130, 3.2);
        this.threeRenderer?.spawnGpuBurst(this.px, this.py, '#38bdf8', 22, 3.6);
      }

      this.dialogue = {
        speaker: obj.title,
        portrait: 'adol',
        lines: obj.lines,
        cursor: 0,
      };
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
    spawnBurst(this.particles, cx, cy, '#fde047', 22, 160, 3.6);
    this.threeRenderer?.spawnGpuBurst(cx, cy, '#fde047', 24, 4.1);
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
    if (this.unlockedMagic.has('shield') && this.shieldAuraTimer <= 0) {
      this.shieldAuraTimer = 3.5;
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
        spawnBurst(this.particles, p.x, p.y, p.color, 6, 80, 2.2);
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
            hit = true;
            break;
          }
        }
        if (hit) this.projectiles.splice(i, 1);
      } else {
        if (Math.hypot(p.x - this.px, p.y - this.py) < 18) {
          this.damagePlayer(p.damage);
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
    this.popups.push({ x: this.px, y: this.py - 22, text: `-${dmg}`, color: '#f87171', life: 0.7, maxLife: 0.7 });

    if (this.hp <= 0 && this.herbs > 0) {
      this.herbs--;
      this.hp = Math.round(this.maxHp * 0.7);
      sfx.playPowerup();
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
      this.threeRenderer.renderFrame({
        zone,
        time: this.time,
        camX: this.camX,
        camY: this.camY,
        screenShake: this.screenShake,
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
        if (npc.tx < cMin - 1 || npc.tx > cMax + 1 || npc.ty < rMin - 1 || npc.ty > rMax + 1) continue;
        const nx = (npc.tx + 0.5) * TILE;
        const ny = (npc.ty + 0.62) * TILE_H;
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

    // 2. Glowing Zone Portal Destination Banners
    ctx.save();
    ctx.font = '800 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    for (const portal of zone.portals) {
      const px = (portal.tx + portal.widthTiles * 0.5) * TILE;
      const py = (portal.ty + portal.heightTiles * 0.5) * TILE;
      const scr = tr.projectWorldToScreen(px, py, 2.25);
      if (!scr.visible || scr.x < -80 || scr.x > W + 80 || scr.y < -40 || scr.y > H + 40) continue;
      const locked = Boolean(portal.requiredFlag && !this.flags.has(portal.requiredFlag));
      const label = locked ? `LOCKED · ${portal.label}` : portal.label;
      const tw = ctx.measureText(label).width + 14;
      ctx.fillStyle = 'rgba(7, 11, 22, 0.78)';
      ctx.strokeStyle = locked ? 'rgba(244, 63, 94, 0.85)' : 'rgba(56, 189, 248, 0.85)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(scr.x - tw * 0.5, scr.y - 8, tw, 15, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = locked ? '#fda4af' : '#e0f2fe';
      ctx.fillText(label, scr.x, scr.y + 3);
    }

    // 3. Crisp NPC Nameplates
    for (const npc of zone.npcs) {
      const nx = (npc.tx + 0.5) * TILE;
      const ny = (npc.ty + 0.5) * TILE;
      const scr = tr.projectWorldToScreen(nx, ny, 1.55);
      if (!scr.visible || scr.x < -60 || scr.x > W + 60 || scr.y < -40 || scr.y > H + 40) continue;
      const tw = ctx.measureText(npc.name).width + 10;
      ctx.fillStyle = 'rgba(7, 11, 22, 0.72)';
      ctx.beginPath();
      ctx.roundRect(scr.x - tw * 0.5, scr.y - 8, tw, 13, 4);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.fillText(npc.name, scr.x, scr.y + 1.5);
    }

    // 4. Mini HP Bars above Hurt Non-Boss Enemies
    for (const e of this.enemies) {
      if (e.kind === 'boss' || e.hp >= e.maxHp) continue;
      const scr = tr.projectWorldToScreen(e.x, e.y, 1.5);
      if (!scr.visible) continue;
      const bw = 30;
      const frac = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = 'rgba(7, 11, 20, 0.85)';
      ctx.fillRect(scr.x - bw * 0.5 - 1, scr.y - 3, bw + 2, 5);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(scr.x - bw * 0.5, scr.y - 2, bw * frac, 3);
    }

    // 5. Floating Damage, Level-Up & Discovery Popups
    ctx.font = '900 13px "JetBrains Mono", monospace';
    for (const pop of this.popups) {
      const scr = tr.projectWorldToScreen(pop.x, pop.y, 1.4 + (1 - pop.life / Math.max(0.01, pop.maxLife)) * 0.85);
      if (!scr.visible) continue;
      const alpha = Math.max(0, pop.life / Math.max(0.01, pop.maxLife));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#020617';
      ctx.fillText(pop.text, scr.x + 1.5, scr.y + 1.5);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, scr.x, scr.y);
    }
    ctx.globalAlpha = 1;

    // 6. Contextual [SPACE] Interaction Prompt Badge projected cleanly over target
    if (this.nearestInteract && !this.dialogue && this.phase === 'PLAYING') {
      const t = this.nearestInteract;
      const scr = tr.projectWorldToScreen(t.x, t.y, 1.85);
      if (scr.visible) {
        const floatY = scr.y + Math.sin(this.time * 6) * 2.5;
        const text = `[SPACE] ${t.label}`;
        ctx.font = '800 10px "JetBrains Mono", monospace';
        const tw = ctx.measureText(text).width + 16;
        ctx.fillStyle = 'rgba(9, 15, 30, 0.92)';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.roundRect(scr.x - tw * 0.5, floatY - 11, tw, 19, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fef08a';
        ctx.fillText(text, scr.x, floatY + 2);
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
  // PASS 4: AUTHENTIC YS I & II CHRONICLES+ FLOATING WINGED-GODDESS HUD!
  // ---------------------------------------------------------------------------
  private drawChroniclesTopLeftStats(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const x = 14;
    let y = 20;
    const drawCrispText = (txt: string, tx: number, ty: number, color = '#f8fafc', size = 12, bold = false) => {
      ctx.font = `${bold ? '800' : '700'} ${size}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(2, 6, 23, 0.92)';
      ctx.fillText(txt, tx + 1.5, ty + 1.5);
      ctx.fillText(txt, tx - 0.8, ty + 0.8);
      ctx.fillStyle = color;
      ctx.fillText(txt, tx, ty);
    };

    drawCrispText('Adol Christin', x, y, '#f8fafc', 12.5, true);
    y += 16;
    drawCrispText(`Lv.${this.level} Swordsman`, x, y, '#e2e8f0', 11.5);
    y += 16;
    drawCrispText(`HP: ${Math.ceil(this.hp)} / ${this.maxHp}`, x, y, '#e2e8f0', 11.5);
    y += 16;
    drawCrispText(`STR: ${this.getEffectiveAtk()}`, x, y, '#e2e8f0', 11.5);
    y += 16;
    drawCrispText(`DEF: ${this.getEffectiveDef()}`, x, y, '#e2e8f0', 11.5);
    y += 16;
    drawCrispText(`EXP: ${this.exp}`, x, y, '#e2e8f0', 11.5);
    y += 18;

    // Mini crisp pixel Sword / Shield / Armor equipment icons + names (just like Screenshot #2!)
    // 1. Sword icon
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(x + 8, y - 10, 2, 2);
    ctx.fillRect(x + 6, y - 8, 3, 3);
    ctx.fillRect(x + 4, y - 6, 3, 3);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(x + 2, y - 4, 5, 2);
    ctx.fillRect(x + 1, y - 2, 2, 3);
    drawCrispText(this.WEAPONS[this.weaponTier].name, x + 16, y, '#f8fafc', 11);
    y += 16;

    // 2. Shield icon
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(x + 2, y - 10, 9, 10);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(x + 5, y - 9, 3, 8);
    ctx.fillRect(x + 3, y - 6, 7, 2);
    drawCrispText(this.SHIELDS[this.shieldTier].name, x + 16, y, '#f8fafc', 11);
    y += 16;

    // 3. Armor icon
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(x + 2, y - 10, 9, 9);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(x + 4, y - 9, 5, 6);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(x + 5, y - 7, 3, 2);
    drawCrispText(this.ARMORS[this.armorTier].name, x + 16, y, '#f8fafc', 11);

    // Compact Books / MP status tag underneath
    y += 17;
    const statusTag =
      this.variant === 'ys1'
        ? `Books ${this.booksCollected}/${this.totalBooks} · ★${this.secretsFound}`
        : `MP ${Math.ceil(this.mp)}/${this.maxMp} · Crests ${this.booksCollected}/${this.totalBooks}`;
    drawCrispText(statusTag, x, y, '#fde047', 10.5, true);
    ctx.restore();
  }

  private drawChroniclesZoneAndMiniMap(ctx: CanvasRenderingContext2D, zone: ZoneDef, W: number): void {
    ctx.save();
    // Embossed Golden Serif Zone Title (exact Chronicles+ Screenshot #2 style!)
    ctx.font = '800 18px Georgia, "Times New Roman", serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(2, 6, 23, 0.94)';
    ctx.fillText(zone.name, W - 12, 26);
    ctx.fillText(zone.name, W - 15, 25);
    const goldGrad = ctx.createLinearGradient(0, 10, 0, 28);
    goldGrad.addColorStop(0, '#fef9c3');
    goldGrad.addColorStop(0.55, '#facc15');
    goldGrad.addColorStop(1, '#ca8a04');
    ctx.fillStyle = goldGrad;
    ctx.fillText(zone.name, W - 14, 24);

    // Sleek compact translucent mini-map tucked neatly below the golden zone title
    this.drawMiniMap(ctx, zone, W - 126, 32, 114, 78);
    ctx.restore();
  }

  private drawWingedGoddessSculpture(ctx: CanvasRenderingContext2D, x: number, y: number, flip = false, scale = 1): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flip ? -scale : scale, scale);

    // Outstretched sculpted ivory-gold feathered wings!
    const wingGrad = ctx.createLinearGradient(0, -34, 48, 4);
    wingGrad.addColorStop(0, '#fef3c7');
    wingGrad.addColorStop(0.5, '#d6c198');
    wingGrad.addColorStop(1, '#786646');
    ctx.fillStyle = wingGrad;
    ctx.beginPath();
    ctx.moveTo(8, -12);
    ctx.quadraticCurveTo(22, -40, 50, -32);
    ctx.quadraticCurveTo(34, -22, 42, -16);
    ctx.quadraticCurveTo(28, -12, 34, -6);
    ctx.quadraticCurveTo(18, -4, 8, 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#473a24';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Sculpted Ivory Goddess Bust (reminiscent of Feena / Reah relief in Chronicles+!)
    const bustGrad = ctx.createLinearGradient(-12, -42, 14, 4);
    bustGrad.addColorStop(0, '#fef9c3');
    bustGrad.addColorStop(0.55, '#d8c5a0');
    bustGrad.addColorStop(1, '#6e5c3e');
    ctx.fillStyle = bustGrad;
    // Draped shoulders & flowing robe
    ctx.beginPath();
    ctx.moveTo(-16, 8);
    ctx.quadraticCurveTo(-15, -14, -4, -18);
    ctx.lineTo(10, -16);
    ctx.quadraticCurveTo(16, -6, 18, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Classical head & flowing hair curls
    ctx.beginPath();
    ctx.arc(1, -27, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Hair tresses sweeping over shoulder
    ctx.fillStyle = '#c8b288';
    ctx.beginPath();
    ctx.moveTo(-5, -33);
    ctx.quadraticCurveTo(-13, -24, -11, -10);
    ctx.lineTo(-4, -14);
    ctx.quadraticCurveTo(-5, -24, 0, -28);
    ctx.closePath();
    ctx.fill();
    // Gentle closed eyes & brow
    ctx.fillStyle = '#5c4b30';
    ctx.fillRect(2, -28, 4, 1.5);
    ctx.restore();
  }

  private drawChroniclesBottomHud(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    ctx.save();
    const baseY = H - 14;

    // 1. BOTTOM-LEFT: Sculpted Ivory Winged-Goddess Relief + Item/Ring Slots + Angled Silver HP Bar + Gold!
    // Beveled Item & Ring Slate Slots resting above the HP bar
    const drawSlot = (sx: number, sy: number, label: string, subText: string, iconKind: 'herb' | 'ring') => {
      ctx.fillStyle = 'rgba(12, 18, 30, 0.84)';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(sx + 5, sy);
      ctx.lineTo(sx + 44, sy);
      ctx.lineTo(sx + 39, sy + 26);
      ctx.lineTo(sx, sy + 26);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      if (iconKind === 'herb') {
        // Crisp green leaf herb icon
        ctx.fillStyle = this.herbs > 0 ? '#4ade80' : '#475569';
        ctx.fillRect(sx + 16, sy + 7, 10, 8);
        ctx.fillStyle = this.herbs > 0 ? '#bbf7d0' : '#64748b';
        ctx.fillRect(sx + 18, sy + 5, 6, 4);
      } else {
        // Crisp Ring icon (colored by equipped ring!)
        const ringCol =
          this.equippedRing === 'power'
            ? '#f97316'
            : this.equippedRing === 'shield'
              ? '#38bdf8'
              : this.equippedRing === 'time'
                ? '#c084fc'
                : '#475569';
        ctx.strokeStyle = ringCol;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(sx + 22, sy + 12, 5.5, 0, Math.PI * 2);
        ctx.stroke();
        if (this.equippedRing !== 'none') {
          ctx.fillStyle = '#fef9c3';
          ctx.fillRect(sx + 20, sy + 5, 4, 3);
        }
      }

      ctx.font = '800 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#020617';
      ctx.fillText(label, sx + 5, sy + 23);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(label, sx + 4, sy + 22);

      if (subText) {
        ctx.textAlign = 'right';
        ctx.fillStyle = '#fde047';
        ctx.fillText(subText, sx + 37, sy + 12);
      }
    };

    drawSlot(54, baseY - 58, 'Item', this.herbs > 0 ? `x${this.herbs}` : '', 'herb');
    const ringTag =
      this.equippedRing === 'power' ? 'PWR' : this.equippedRing === 'shield' ? 'SHD' : this.equippedRing === 'time' ? 'TIM' : '';
    drawSlot(102, baseY - 58, 'Ring', ringTag, 'ring');

    // Angled Metallic-Silver Framed Emerald HP Bar (matching Screenshots #1 & #2!)
    const hpBarX = 48;
    const hpBarY = baseY - 30;
    const hpBarW = 216;
    const hpBarH = 11;
    const hpFrac = Math.max(0, Math.min(1, this.hp / Math.max(1, this.maxHp)));

    // Metallic bevel housing
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hpBarX, hpBarY);
    ctx.lineTo(hpBarX + hpBarW - 6, hpBarY);
    ctx.lineTo(hpBarX + hpBarW, hpBarY + hpBarH);
    ctx.lineTo(hpBarX - 4, hpBarY + hpBarH);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Bright vivid emerald HP gradient fill
    const hpGrad = ctx.createLinearGradient(hpBarX, hpBarY, hpBarX, hpBarY + hpBarH);
    hpGrad.addColorStop(0, '#bbf7d0');
    hpGrad.addColorStop(0.4, '#22c55e');
    hpGrad.addColorStop(1, '#15803d');
    ctx.fillStyle = hpGrad;
    ctx.fillRect(hpBarX + 2, hpBarY + 2, Math.max(0, (hpBarW - 8) * hpFrac), hpBarH - 4);

    // Razor-thin gold EXP progress needle tucked right below HP bar
    const expFrac = Math.max(0, Math.min(1, this.exp / Math.max(1, this.expNext)));
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(hpBarX + 2, hpBarY + hpBarH + 2, hpBarW - 14, 3);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(hpBarX + 2, hpBarY + hpBarH + 2, (hpBarW - 14) * expFrac, 3);

    // Bright Green HP Readout (`77/80`) perched right above the HP bar!
    ctx.font = '900 16px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    const hpTxt = `${Math.ceil(this.hp)}`;
    ctx.fillStyle = '#020617';
    ctx.fillText(hpTxt, hpBarX + hpBarW - 44, hpBarY - 4);
    ctx.fillStyle = '#4ade80';
    ctx.fillText(hpTxt, hpBarX + hpBarW - 45, hpBarY - 5);
    ctx.font = '800 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#020617';
    ctx.fillText(`/${this.maxHp}`, hpBarX + hpBarW - 42, hpBarY - 4);
    ctx.fillStyle = '#bbf7d0';
    ctx.fillText(`/${this.maxHp}`, hpBarX + hpBarW - 43, hpBarY - 5);

    // Gold Coin Pouch Icon + Embossed Gold Readout underneath HP bar
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.arc(hpBarX + 26, baseY - 6, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#facc15';
    ctx.fillRect(hpBarX + 24, baseY - 11, 4, 3);
    ctx.font = '800 14px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#020617';
    ctx.fillText(`${this.gold}`, hpBarX + 37, baseY - 1);
    ctx.fillStyle = '#fde047';
    ctx.fillText(`${this.gold}`, hpBarX + 36, baseY - 2);

    // Sculpted Ivory Winged-Goddess anchored on the far bottom-left corner!
    this.drawWingedGoddessSculpture(ctx, 26, baseY - 4, false, 1.0);

    // 2. BOTTOM-RIGHT: Matching Angled Metallic ENEMY HP Bar with Sculpted Wing Filigree!
    const targetEnemy =
      this.activeBoss && this.activeBoss.hp > 0
        ? { name: this.activeBoss.name, hp: this.activeBoss.hp, maxHp: this.activeBoss.maxHp }
        : this.engagedEnemy;
    const eBarW = 200;
    const eBarX = W - eBarW - 22;
    const eBarY = baseY - 30;
    const eBarH = 11;

    // Subtle decorative wing scroll behind Enemy bar
    ctx.fillStyle = 'rgba(180, 155, 110, 0.52)';
    ctx.beginPath();
    ctx.moveTo(W - 68, eBarY + 2);
    ctx.quadraticCurveTo(W - 44, eBarY - 20, W - 12, eBarY - 12);
    ctx.quadraticCurveTo(W - 24, eBarY + 12, W - 52, eBarY + 16);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(eBarX + 6, eBarY);
    ctx.lineTo(eBarX + eBarW, eBarY);
    ctx.lineTo(eBarX + eBarW + 4, eBarY + eBarH);
    ctx.lineTo(eBarX, eBarY + eBarH);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (targetEnemy) {
      const eFrac = Math.max(0, Math.min(1, targetEnemy.hp / Math.max(1, targetEnemy.maxHp)));
      const eGrad = ctx.createLinearGradient(eBarX, eBarY, eBarX, eBarY + eBarH);
      eGrad.addColorStop(0, '#fca5a5');
      eGrad.addColorStop(0.45, '#ef4444');
      eGrad.addColorStop(1, '#991b1b');
      ctx.fillStyle = eGrad;
      const fillW = (eBarW - 6) * eFrac;
      ctx.fillRect(eBarX + eBarW - 3 - fillW, eBarY + 2, fillW, eBarH - 4);

      ctx.font = '800 10.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#020617';
      ctx.fillText(targetEnemy.name, eBarX + eBarW, eBarY - 4);
      ctx.fillStyle = '#fde68a';
      ctx.fillText(targetEnemy.name, eBarX + eBarW - 1, eBarY - 5);
    }

    ctx.font = 'italic 900 12px Georgia, serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#020617';
    ctx.fillText('ENEMY', eBarX + eBarW + 2, baseY - 2);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText('ENEMY', eBarX + eBarW + 1, baseY - 3);

    // 3. Subtle Bottom-Center Whisper Quest Hint (cleanly tucked between Left & Right wings)
    if (!this.dialogue) {
      const hint = this.getActiveQuestHint();
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      const hw = Math.min(268, ctx.measureText(hint).width + 18);
      ctx.fillStyle = 'rgba(6, 10, 20, 0.72)';
      ctx.beginPath();
      ctx.roundRect(W * 0.5 - hw * 0.5, baseY - 13, hw, 16, 4);
      ctx.fill();
      ctx.fillStyle = '#fde68a';
      ctx.fillText(hint.length > 42 ? `${hint.slice(0, 40)}…` : hint, W * 0.5, baseY - 2);
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // Live Compact Mini-Map & Full World Exploration Chart
  // ---------------------------------------------------------------------------
  private drawMiniMap(ctx: CanvasRenderingContext2D, zone: ZoneDef, x: number, y: number, w: number, h: number): void {
    ctx.save();
    ctx.fillStyle = 'rgba(7, 11, 22, 0.76)';
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.fill();
    ctx.stroke();

    const cw = (w - 8) / zone.width;
    const ch = (h - 8) / zone.height;
    for (let r = 0; r < zone.height; r++) {
      for (let c = 0; c < zone.width; c++) {
        const t = zone.tiles[r][c];
        ctx.fillStyle =
          t === 1 || t === 5
            ? '#64748b'
            : t === 3
              ? '#0284c7'
              : t === 6 || t === 4
                ? '#d97706'
                : t === 2 || t === 9
                  ? '#15803d'
                  : '#1e293b';
        ctx.fillRect(x + 4 + c * cw, y + 4 + r * ch, Math.ceil(cw), Math.ceil(ch));
      }
    }

    for (const p of zone.portals) {
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(x + 4 + p.tx * cw, y + 4 + p.ty * ch, Math.max(4, p.widthTiles * cw), Math.max(3, p.heightTiles * ch));
    }
    for (const chObj of zone.chests) {
      if (this.openedChests.has(chObj.id)) continue;
      ctx.fillStyle = '#fde047';
      ctx.fillRect(x + 4 + chObj.tx * cw - 1, y + 4 + chObj.ty * ch - 1, 3, 3);
    }
    for (const npc of zone.npcs) {
      ctx.fillStyle = '#f472b6';
      ctx.fillRect(x + 4 + npc.tx * cw - 1, y + 4 + npc.ty * ch - 1, 3, 3);
    }

    const ax = x + 4 + (this.px / TILE) * cw;
    const ay = y + 4 + (this.py / TILE) * ch;
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax + Math.cos(this.bodyAngle) * 7, ay + Math.sin(this.bodyAngle) * 7);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ax, ay, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawFullMapOverlay(ctx: CanvasRenderingContext2D, zone: ZoneDef, W: number, viewH: number): void {
    ctx.save();
    ctx.fillStyle = 'rgba(5, 9, 20, 0.9)';
    ctx.fillRect(0, 0, W, viewH);

    const mx = 46;
    const my = 38;
    const mw = W - 92;
    const mh = viewH - 160;
    this.drawMiniMap(ctx, zone, mx, my, mw, mh);

    ctx.fillStyle = '#fde047';
    ctx.font = '800 18px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${zone.name} · EXPLORATION CHART`, W * 0.5, my + mh + 28);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 12.5px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(this.getActiveQuestHint(), W * 0.5, my + mh + 52);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.fillText(
      `Cyan = Zone Gateways · Pink = Citizens · Yellow = Chests · Secrets Found: ${this.secretsFound}`,
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
  private drawLargeAnimeBust(ctx: CanvasRenderingContext2D, id: PortraitId, cx: number, bottomY: number): void {
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
    const [hairHi, hairMid, hairLo] = hairMap[id];
    const [coatMain, coatSub, trimCol] = outfitMap[id];
    const isFemale = id === 'feena' || id === 'lilia' || id === 'sara';

    // Soft anime rim glow behind character bust
    const aura = ctx.createRadialGradient(0, -110, 12, 0, -110, 118);
    aura.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
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

    // Half-Body Shoulders, Draped Cloak & Armor / Tunic
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

    // Expressive Large Chronicles+ Anime Eyes with Specular Highlights & Lashes
    const eyeY = -138;
    const irisCol = id === 'darkfact' || id === 'dalles' ? '#ef4444' : id === 'feena' ? '#2563eb' : id === 'lilia' ? '#059669' : '#1e3a8a';
    for (const side of [-1, 1]) {
      const ex = side * 13.5;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, 8.2, 6.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = irisCol;
      ctx.beginPath();
      ctx.ellipse(ex - side * 0.6, eyeY + 0.5, 5.4, 6.0, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(ex - side * 0.6, eyeY + 0.8, 2.8, 0, Math.PI * 2);
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
      ctx.arc(ex, eyeY + 1, 8.5, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }

    // Subtle nose & gentle expression mouth
    ctx.fillStyle = 'rgba(154, 52, 18, 0.35)';
    ctx.fillRect(-1, -126, 2, 4);
    ctx.strokeStyle = '#9a3412';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, -117, 6, 0.16 * Math.PI, 0.84 * Math.PI);
    ctx.stroke();

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

    // Signature Hair Accessories (Adol windswept spikes, Feena/Lilia hair ornament)
    if (id === 'adol') {
      ctx.fillStyle = hairHi;
      ctx.beginPath();
      ctx.moveTo(-18, -182);
      ctx.lineTo(-6, -206);
      ctx.lineTo(4, -186);
      ctx.lineTo(18, -202);
      ctx.lineTo(22, -180);
      ctx.closePath();
      ctx.fill();
    } else if (id === 'feena' || id === 'lilia') {
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

    const bx = 26;
    const bw = W - 52;
    const bh = dlg.shopKind ? 186 : 138;
    const by = viewH - bh - 20;

    ctx.save();
    // Subtle scenic dim so the large anime portrait & Twin-Goddess box stand out cleanly
    ctx.fillStyle = 'rgba(4, 7, 16, 0.34)';
    ctx.fillRect(0, 0, W, viewH);

    // Large Half-Body Right-Side Anime Bust Portrait rising above the dialogue box!
    this.drawLargeAnimeBust(ctx, dlg.portrait, W - 108, by + 12);

    // Ornate Chronicles+ Dark Slate-Parchment Dialogue Frame with Botanical Gold Border
    const boxGrad = ctx.createLinearGradient(bx, by, bx, by + bh);
    boxGrad.addColorStop(0, 'rgba(13, 20, 38, 0.96)');
    boxGrad.addColorStop(1, 'rgba(7, 11, 24, 0.98)');
    ctx.fillStyle = boxGrad;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 10);
    ctx.fill();

    // Double gilded botanical vine border
    ctx.strokeStyle = '#ca8a04';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.52)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.roundRect(bx + 4, by + 4, bw - 8, bh - 8, 7);
    ctx.stroke();

    // Twin Sculpted Winged Goddesses flanking the bottom corners of the dialogue box!
    this.drawWingedGoddessSculpture(ctx, bx + 14, by + bh - 4, false, 0.72);
    this.drawWingedGoddessSculpture(ctx, bx + bw - 14, by + bh - 4, true, 0.72);

    // Speaker Nameplate Tab
    const tx = bx + 48;
    ctx.font = '800 13.5px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fde047';
    ctx.fillText(dlg.speaker, tx, by + 26);
    ctx.fillStyle = 'rgba(250, 204, 21, 0.35)';
    ctx.fillRect(tx, by + 31, Math.min(260, ctx.measureText(dlg.speaker).width + 24), 1.5);

    // Highlighted Chronicles+ Dialogue Text (automatic cyan-blue #38bdf8 keywords!)
    ctx.font = '600 12.5px "Plus Jakarta Sans", sans-serif';
    let lineY = by + 51;
    for (const line of dlg.lines) {
      lineY = this.drawHighlightedWrappedLine(ctx, line, tx, lineY, bw - 96, 18) + 4;
    }

    if (dlg.shopKind) {
      const opts = this.getShopOptions(dlg.shopKind);
      let oy = by + 98;
      opts.forEach((o, i) => {
        const sel = i === dlg.cursor;
        if (sel) {
          ctx.fillStyle = 'rgba(250, 204, 21, 0.22)';
          ctx.beginPath();
          ctx.roundRect(tx - 6, oy - 13, bw - 96, 22, 5);
          ctx.fill();
        }
        ctx.font = sel ? '800 12px "JetBrains Mono", monospace' : '600 12px "JetBrains Mono", monospace';
        ctx.fillStyle = sel ? '#fde047' : '#cbd5e1';
        ctx.fillText(`${sel ? '▶' : ' '} ${o.label}`, tx, oy + 2);
        oy += 25;
      });
    } else {
      const bounce = Math.sin(this.time * 7) * 2;
      ctx.font = '700 10.5px "JetBrains Mono", monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.textAlign = 'right';
      ctx.fillText('PRESS [SPACE / ACTION] ▼', bx + bw - 48, by + bh - 12 + bounce * 0.5);
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

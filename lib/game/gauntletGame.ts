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
import {
  DUNGEON_THEMES,
  DungeonTheme,
  G_ACID,
  G_CARPET,
  G_DOOR,
  G_EXIT,
  G_FLOOR,
  G_FORCEFIELD,
  G_PILLAR,
  G_SECRET_WALL,
  G_STUN,
  G_TELEPORT,
  G_TORCH_WALL,
  G_WALL,
  GAUNTLET_COLS,
  GAUNTLET_ROWS,
  GauntletGenKind,
  GauntletMapBlueprint,
  GauntletMonsterKind,
  GauntletPickupKind,
  getGauntletMap,
} from './gauntletMaps';

// Crisp Atari HD 1152x768 layout: 904x768 dungeon viewport + 248x768 Atari Status Sidebar
const VIEW_W = 1152;
const VIEW_H = 768;
const PANEL_W = 248;
const PLAY_W = VIEW_W - PANEL_W; // 904
const TILE = 44;

type HeroClassId = 'warrior' | 'valkyrie' | 'wizard' | 'elf';
type CabinetColorId = 'red' | 'blue' | 'yellow' | 'green';

interface CabinetColorSpec {
  id: CabinetColorId;
  label: string;
  primary: string;
  dark: string;
  light: string;
  glow: string;
}

const CABINET_COLORS: CabinetColorSpec[] = [
  { id: 'red', label: 'RED', primary: '#EF4444', dark: '#991B1B', light: '#FCA5A5', glow: 'rgba(239,68,68,0.45)' },
  { id: 'blue', label: 'BLUE', primary: '#3B82F6', dark: '#1D4ED8', light: '#93C5FD', glow: 'rgba(59,130,246,0.45)' },
  { id: 'yellow', label: 'YELLOW', primary: '#FACC15', dark: '#A16207', light: '#FEF08A', glow: 'rgba(250,204,21,0.45)' },
  { id: 'green', label: 'GREEN', primary: '#22C55E', dark: '#15803D', light: '#86EFAC', glow: 'rgba(34,197,94,0.45)' },
];

interface HeroClassSpec {
  id: HeroClassId;
  defaultColorIdx: number; // 0=Red Warrior, 1=Blue Valkyrie, 2=Yellow Wizard, 3=Green Elf
  heroName: string;
  className: string;
  weaponName: string;
  speed: number;
  shotSpeed: number;
  shotDamage: number;
  shotCooldown: number;
  armor: number; // incoming damage multiplier (lower = tougher!)
  magicPower: number; // potion effectiveness & radius
  statArmor: number; // 1..5 display bar
  statPower: number;
  statSpeed: number;
  statMagic: number;
}

// 100% Authentic Atari Gauntlet Hero Classes & True Arcade Colors:
// RED = Thor the Warrior, BLUE = Thyra the Valkyrie, YELLOW = Merlin the Wizard, GREEN = Questor the Elf
const HERO_CLASSES: HeroClassSpec[] = [
  {
    id: 'warrior',
    defaultColorIdx: 0, // RED
    heroName: 'Thor',
    className: 'Warrior',
    weaponName: 'Battle Axe',
    speed: 196,
    shotSpeed: 470,
    shotDamage: 2.5,
    shotCooldown: 0.21,
    armor: 0.72,
    magicPower: 1.0,
    statArmor: 4,
    statPower: 5,
    statSpeed: 2,
    statMagic: 1,
  },
  {
    id: 'valkyrie',
    defaultColorIdx: 1, // BLUE
    heroName: 'Thyra',
    className: 'Valkyrie',
    weaponName: 'Broadsword',
    speed: 224,
    shotSpeed: 510,
    shotDamage: 1.9,
    shotCooldown: 0.17,
    armor: 0.54,
    magicPower: 1.5,
    statArmor: 5,
    statPower: 4,
    statSpeed: 3,
    statMagic: 3,
  },
  {
    id: 'wizard',
    defaultColorIdx: 2, // YELLOW
    heroName: 'Merlin',
    className: 'Wizard',
    weaponName: 'Fireball',
    speed: 214,
    shotSpeed: 540,
    shotDamage: 2.2,
    shotCooldown: 0.16,
    armor: 1.0,
    magicPower: 2.6,
    statArmor: 2,
    statPower: 4,
    statSpeed: 3,
    statMagic: 5,
  },
  {
    id: 'elf',
    defaultColorIdx: 3, // GREEN
    heroName: 'Questor',
    className: 'Elf',
    weaponName: 'Elven Bow',
    speed: 274,
    shotSpeed: 620,
    shotDamage: 1.5,
    shotCooldown: 0.125,
    armor: 0.88,
    magicPower: 1.8,
    statArmor: 2,
    statPower: 3,
    statSpeed: 5,
    statMagic: 4,
  },
];

interface Pickup {
  x: number;
  y: number;
  kind: GauntletPickupKind;
}

interface Generator {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  tier: 1 | 2 | 3;
  kind: GauntletGenKind;
  timer: number;
}

interface Monster {
  kind: GauntletMonsterKind;
  tier: 1 | 2 | 3;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  fireTimer: number;
  anim: number;
  facingX: number;
  facingY: number;
  // Special Atari mechanics
  invisTimer: number; // Sorcerer blink phase
  drainRemaining: number; // Death vanishes after draining 200 HP!
  stolenItem: 'key' | 'potion' | null; // Thief steals & flees!
  hitFlash: number;
}

interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fromPlayer: boolean;
  weaponStyle: HeroClassId | 'fireball' | 'boulder' | 'dragon_flame';
  damage: number;
  bounces: number;
  color: string;
  overWalls: boolean; // Lobber boulders arc right over stone walls!
  flightTime: number;
  maxFlight: number;
  spin: number;
}

export class GauntletGame implements ArcadeGameInstance {
  public readonly logicalWidth = VIEW_W;
  public readonly logicalHeight = VIEW_H;
  public readonly supportsPointerAim = true;
  public readonly primaryActionLabel = 'Attack';
  public readonly secondaryActionLabel = 'Magic Potion';

  private readonly isSequel: boolean;
  private readonly storageKey: string;

  private phase: ClassicGamePhase = 'TITLE';
  private subMode: 'SELECT' | 'PLAY' = 'PLAY';
  private score = 0;
  private highScore = 0;
  private level = 1;
  private heroIdx = 0; // 0=Warrior, 1=Valkyrie, 2=Wizard, 3=Elf
  private colorIdx = 0; // 0=Red, 1=Blue, 2=Yellow, 3=Green
  private health = 700;
  private keys = 1;
  private potions = 2;

  // Permanent/Floor Power-Up Amulets
  private bonusPower = 0;
  private bonusSpeed = 0;
  private bonusArmor = 0;
  private bonusMagic = 0;
  private ricochetActive = false;
  private invisTime = 0;
  private stunTimer = 0;
  private itTagged = false; // Gauntlet II "YOU ARE IT!"
  private teleportCooldown = 0;
  private forcefieldsOpen = false;
  private forcefieldCycle = 0;

  private phaseTimer = 0;
  private time = 0;
  private bannerText = '';
  private announcerLog: string[] = [];
  private alertText = '';
  private alertTimer = 0;

  private input: ArcadeInputState = createEmptyInput();
  private prevLeft = false;
  private prevRight = false;
  private prevUp = false;
  private prevDown = false;
  private selectLock = 0;

  private blueprint!: GauntletMapBlueprint;
  private grid: number[][] = [];
  private playerX = TILE * 3.5;
  private playerY = TILE * 3.5;
  private aimX = 1;
  private aimY = 0;
  private walkAnim = 0;
  private fireCooldown = 0;
  private potionFlash = 0;
  private damageFlash = 0;
  private camX = 0;
  private camY = 0;

  private pickups: Pickup[] = [];
  private generators: Generator[] = [];
  private monsters: Monster[] = [];
  private projectiles: Projectile[] = [];
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  constructor(variant: 'gauntlet' | 'gauntlet2') {
    this.isSequel = variant === 'gauntlet2';
    this.storageKey = this.isSequel ? 'gauntlet2_hd_highscore_v2' : 'gauntlet_hd_highscore_v2';
    this.highScore = readHighScore(this.storageKey);
    this.heroIdx = 0;
    this.colorIdx = 0;
    this.loadFloor(1);
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public startNewGame(): void {
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.level = 1;
    this.health = 750;
    this.keys = 1;
    this.potions = 2;
    this.bonusPower = 0;
    this.bonusSpeed = 0;
    this.bonusArmor = 0;
    this.bonusMagic = 0;
    this.ricochetActive = this.isSequel;
    this.invisTime = 0;
    this.stunTimer = 0;
    this.itTagged = false;
    this.particles = [];
    this.popups = [];
    this.announcerLog = [];
    this.subMode = 'SELECT';
    this.selectLock = 0.25;
    this.phase = 'PLAYING';
    this.bannerText = '';
    this.loadFloor(1);
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING' && this.subMode === 'PLAY') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.subMode = 'PLAY';
    this.level = 1;
    this.loadFloor(1);
  }

  // Pressing R cycles hero (and in G1 sets matching arcade color; in G2 opens quick swap)
  public restartStage(): void {
    this.heroIdx = (this.heroIdx + 1) % HERO_CLASSES.length;
    if (!this.isSequel) {
      this.colorIdx = HERO_CLASSES[this.heroIdx].defaultColorIdx;
    } else {
      this.colorIdx = (this.colorIdx + 1) % CABINET_COLORS.length;
    }
    this.announce(`NOW PLAYING: ${this.getFullHeroTitle()}`);
  }

  private getHero(): HeroClassSpec {
    return HERO_CLASSES[this.heroIdx];
  }

  private getColor(): CabinetColorSpec {
    return CABINET_COLORS[this.colorIdx];
  }

  private getFullHeroTitle(): string {
    return `${this.getColor().label} ${this.getHero().className.toUpperCase()}`;
  }

  public getHudSnapshot(): ClassicGameHud {
    const label = this.subMode === 'SELECT' ? 'SELECT YOUR HERO' : this.blueprint.name;
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: Math.max(0, Math.min(6, Math.ceil(this.health / 150))),
      stageName: `${this.getFullHeroTitle()} · ${label}`,
      primaryMetricLabel: 'Health',
      primaryMetricValue: `${Math.max(0, Math.ceil(this.health))} HP`,
      secondaryMetricLabel: 'Keys / Potions',
      secondaryMetricValue: `${this.keys}K · ${this.potions}P`,
      bannerText: this.bannerText || this.alertText,
      canRestartStage: true,
    };
  }

  private announce(text: string): void {
    this.alertText = text;
    this.alertTimer = 2.6;
    this.announcerLog.unshift(text);
    if (this.announcerLog.length > 5) this.announcerLog.pop();
  }

  private addScore(pts: number, x?: number, y?: number, color = '#FDE047'): void {
    if (this.phase === 'TITLE') return;
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(this.storageKey, this.highScore);
    }
    if (x !== undefined && y !== undefined && pts >= 20) {
      this.popups.push({
        x: x - this.camX,
        y: y - this.camY,
        text: `+${pts}`,
        color,
        life: 0.85,
        maxLife: 0.85,
      });
    }
  }

  private loadFloor(floor: number): void {
    this.blueprint = getGauntletMap(this.isSequel, floor);
    this.grid = this.blueprint.grid.map((row) => [...row]);
    this.playerX = (this.blueprint.spawnTile[0] + 0.5) * TILE;
    this.playerY = (this.blueprint.spawnTile[1] + 0.5) * TILE;
    this.aimX = 1;
    this.aimY = 0;
    this.itTagged = false;
    this.stunTimer = 0;
    this.teleportCooldown = 0;
    this.projectiles = [];

    this.pickups = this.blueprint.pickups.map((p) => ({
      x: (p.col + 0.5) * TILE,
      y: (p.row + 0.5) * TILE,
      kind: p.kind,
    }));

    this.generators = this.blueprint.generators.map((g) => ({
      x: (g.col + 0.5) * TILE,
      y: (g.row + 0.5) * TILE,
      tier: g.tier,
      hp: 3 + g.tier * 2,
      maxHp: 3 + g.tier * 2,
      kind: g.kind,
      timer: 1.5 + ((g.col * 7 + g.row * 3) % 5) * 0.45,
    }));

    this.monsters = this.blueprint.monsters.map((m) => this.createMonster(m.kind, (m.col + 0.5) * TILE, (m.row + 0.5) * TILE, m.tier ?? 1));
    this.centerCamera(true);
  }

  private createMonster(kind: GauntletMonsterKind, x: number, y: number, tier: 1 | 2 | 3): Monster {
    let hp = 1;
    let speed = 100;
    if (kind === 'ghost') {
      hp = tier;
      speed = 112 + tier * 10;
    } else if (kind === 'grunt') {
      hp = 1 + tier * 1.5;
      speed = 92 + tier * 8;
    } else if (kind === 'demon') {
      hp = 2 + tier * 1.5;
      speed = 86 + tier * 7;
    } else if (kind === 'lobber') {
      hp = 1 + tier;
      speed = 84 + tier * 6;
    } else if (kind === 'sorcerer') {
      hp = 2 + tier;
      speed = 104 + tier * 8;
    } else if (kind === 'thief') {
      hp = 3;
      speed = 165;
    } else if (kind === 'death') {
      hp = 9999;
      speed = 118;
    } else if (kind === 'it') {
      hp = 9999;
      speed = 138;
    } else if (kind === 'dragon') {
      hp = 22 + this.level * 3;
      speed = 76;
    }

    return {
      kind,
      tier,
      x,
      y,
      hp,
      maxHp: hp,
      speed,
      fireTimer: 1.3 + Math.random() * 1.5,
      anim: Math.random() * 6,
      facingX: -1,
      facingY: 0,
      invisTimer: Math.random() * 4,
      drainRemaining: 200,
      stolenItem: null,
      hitFlash: 0,
    };
  }

  private centerCamera(immediate: boolean): void {
    const maxX = Math.max(0, GAUNTLET_COLS * TILE - PLAY_W);
    const maxY = Math.max(0, GAUNTLET_ROWS * TILE - VIEW_H);
    const tx = Math.max(0, Math.min(maxX, this.playerX - PLAY_W * 0.5));
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
    if (this.potionFlash > 0) this.potionFlash = Math.max(0, this.potionFlash - dt);
    if (this.damageFlash > 0) this.damageFlash = Math.max(0, this.damageFlash - dt);
    if (this.invisTime > 0) this.invisTime = Math.max(0, this.invisTime - dt);
    if (this.stunTimer > 0) this.stunTimer = Math.max(0, this.stunTimer - dt);
    if (this.teleportCooldown > 0) this.teleportCooldown = Math.max(0, this.teleportCooldown - dt);
    if (this.alertTimer > 0) {
      this.alertTimer -= dt;
      if (this.alertTimer <= 0) this.alertText = '';
    }

    // Cycle Gauntlet II forcefields every 3.5 seconds
    this.forcefieldCycle += dt;
    this.forcefieldsOpen = Math.floor(this.forcefieldCycle / 3.5) % 2 === 1;

    if (this.phase === 'PAUSED' || this.phase === 'GAME_OVER') return;

    // Interactive Hero & Color Select Screen
    if (this.phase === 'PLAYING' && this.subMode === 'SELECT') {
      this.stepHeroSelect(dt);
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
        this.loadFloor(this.level);
        this.phase = 'READY';
        this.phaseTimer = 1.25;
        this.bannerText = `${this.getFullHeroTitle()} · ${this.blueprint.name.toUpperCase()}`;
        this.announce(this.blueprint.introTip);
      }
      return;
    }

    const isAttract = this.phase === 'TITLE';
    if (!isAttract) {
      // Classic Atari Gauntlet continuous health drain + iconic callouts!
      const prevH = this.health;
      this.health -= 1.85 * dt;
      if (prevH >= 200 && this.health < 200) {
        this.announce(`${this.getFullHeroTitle()} NEEDS FOOD BADLY!`);
        arcadeAudio.playSplat();
      } else if (prevH >= 85 && this.health < 85) {
        this.announce(`${this.getFullHeroTitle()} IS ABOUT TO DIE!`);
        arcadeAudio.playSplat();
      }
      if (this.health <= 0) {
        this.health = 0;
        arcadeAudio.playDeath();
        this.phase = 'GAME_OVER';
        this.bannerText = `${this.getFullHeroTitle()} HAS DIED`;
        return;
      }
    }

    this.updatePlayer(dt, isAttract);
    this.updateGenerators(dt);
    this.updateMonsters(dt, isAttract);
    this.updateProjectiles(dt, isAttract);
    this.centerCamera(false);
  }

  private stepHeroSelect(dt: number): void {
    if (this.selectLock > 0) this.selectLock = Math.max(0, this.selectLock - dt);

    const leftJust = this.input.left && !this.prevLeft;
    const rightJust = this.input.right && !this.prevRight;
    const upJust = this.input.up && !this.prevUp;
    const downJust = this.input.down && !this.prevDown;
    this.prevLeft = this.input.left;
    this.prevRight = this.input.right;
    this.prevUp = this.input.up;
    this.prevDown = this.input.down;

    if (leftJust) {
      this.heroIdx = (this.heroIdx + HERO_CLASSES.length - 1) % HERO_CLASSES.length;
      if (!this.isSequel) this.colorIdx = HERO_CLASSES[this.heroIdx].defaultColorIdx;
      arcadeAudio.playMoveTick();
    } else if (rightJust) {
      this.heroIdx = (this.heroIdx + 1) % HERO_CLASSES.length;
      if (!this.isSequel) this.colorIdx = HERO_CLASSES[this.heroIdx].defaultColorIdx;
      arcadeAudio.playMoveTick();
    }

    // In Gauntlet II, Up/Down lets you pick ANY of the 4 cabinet colors for any hero!
    if (this.isSequel) {
      if (upJust) {
        this.colorIdx = (this.colorIdx + CABINET_COLORS.length - 1) % CABINET_COLORS.length;
        arcadeAudio.playMoveTick();
      } else if (downJust) {
        this.colorIdx = (this.colorIdx + 1) % CABINET_COLORS.length;
        arcadeAudio.playMoveTick();
      }
    }

    // Pointer hover/click on the 4 Hero Cards (and G2 Color Buttons)
    if (this.input.pointerActive && this.selectLock <= 0) {
      const px = this.input.pointerX * VIEW_W;
      const py = this.input.pointerY * VIEW_H;
      const cardW = 236;
      const gap = 22;
      const startX = (VIEW_W - (cardW * 4 + gap * 3)) * 0.5;
      const cardY = 170;
      const cardH = 380;

      for (let i = 0; i < 4; i++) {
        const cx = startX + i * (cardW + gap);
        if (px >= cx && px <= cx + cardW && py >= cardY && py <= cardY + cardH) {
          if (this.heroIdx !== i) {
            this.heroIdx = i;
            if (!this.isSequel) this.colorIdx = HERO_CLASSES[i].defaultColorIdx;
          }
          if (this.input.fireJustPressed) {
            this.confirmHeroSelection();
            return;
          }
        }
      }

      // Gauntlet II cabinet color row buttons
      if (this.isSequel && py >= 575 && py <= 625) {
        const colW = 132;
        const colGap = 16;
        const cStart = (VIEW_W - (colW * 4 + colGap * 3)) * 0.5;
        for (let ci = 0; ci < 4; ci++) {
          const bx = cStart + ci * (colW + colGap);
          if (px >= bx && px <= bx + colW && this.input.fireJustPressed) {
            this.colorIdx = ci;
            arcadeAudio.playMoveTick();
            return;
          }
        }
      }

      // Start button click
      if (py >= 645 && py <= 710 && px >= VIEW_W * 0.5 - 180 && px <= VIEW_W * 0.5 + 180 && this.input.fireJustPressed) {
        this.confirmHeroSelection();
        return;
      }
    }

    if (this.selectLock <= 0 && (this.input.fireJustPressed || this.input.secondaryJustPressed)) {
      this.confirmHeroSelection();
    }
  }

  private confirmHeroSelection(): void {
    this.subMode = 'PLAY';
    this.phase = 'READY';
    this.phaseTimer = 1.2;
    this.bannerText = `WELCOME, ${this.getFullHeroTitle()}!`;
    this.announce(this.blueprint.introTip);
    arcadeAudio.playStageClear();
  }

  private isSolid(x: number, y: number, canUnlockDoor: boolean): boolean {
    const c = Math.floor(x / TILE);
    const r = Math.floor(y / TILE);
    const cell = this.grid[r]?.[c];
    if (
      cell === undefined ||
      cell === G_WALL ||
      cell === G_TORCH_WALL ||
      cell === G_SECRET_WALL ||
      cell === G_PILLAR
    ) {
      return true;
    }
    if (cell === G_FORCEFIELD && !this.forcefieldsOpen) {
      return true;
    }
    if (cell === G_DOOR) {
      if (canUnlockDoor && this.keys > 0) {
        this.keys -= 1;
        this.unlockConnectedDoors(r, c);
        if (this.phase !== 'TITLE') {
          arcadeAudio.playKeyUnlock();
          this.announce('VAULT DOOR UNLOCKED!');
        }
        return false;
      }
      return true;
    }
    return false;
  }

  private unlockConnectedDoors(sr: number, sc: number): void {
    const queue: Array<[number, number]> = [[sr, sc]];
    while (queue.length > 0) {
      const [r, c] = queue.shift()!;
      if (this.grid[r]?.[c] !== G_DOOR) continue;
      this.grid[r][c] = G_FLOOR;
      spawnBurst(
        this.particles,
        c * TILE + TILE * 0.5 - this.camX,
        r * TILE + TILE * 0.5 - this.camY,
        '#FACC15',
        9,
        130,
        3
      );
      queue.push([r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]);
    }
  }

  private usePotion(isAttract: boolean): void {
    if (this.potions <= 0) {
      if (!isAttract) this.announce('NO MAGIC POTIONS LEFT!');
      return;
    }
    this.potions -= 1;
    this.potionFlash = 0.5;
    if (!isAttract) arcadeAudio.playPotionBlast();
    const hero = this.getHero();
    const totalMagic = hero.magicPower + this.bonusMagic * 0.5;
    const radius = 340 + totalMagic * 115;

    let cleared = 0;
    for (let i = this.monsters.length - 1; i >= 0; i--) {
      const m = this.monsters[i];
      if (Math.hypot(m.x - this.playerX, m.y - this.playerY) <= radius) {
        if (m.kind === 'dragon') {
          const dmg = 8 + totalMagic * 5;
          m.hp -= dmg;
          m.hitFlash = 0.3;
          spawnBurst(this.particles, m.x - this.camX, m.y - this.camY, '#38BDF8', 18, 220, 4);
          if (m.hp > 0) continue;
        }
        if (m.kind === 'it') {
          this.itTagged = false;
        }
        const pts =
          m.kind === 'death'
            ? Math.round(1000 * totalMagic)
            : m.kind === 'dragon'
              ? 3000
              : m.kind === 'thief'
                ? 500
                : 100;
        if (m.kind === 'thief' && m.stolenItem) {
          this.pickups.push({ x: m.x, y: m.y, kind: m.stolenItem });
        }
        this.monsters.splice(i, 1);
        spawnBurst(this.particles, m.x - this.camX, m.y - this.camY, '#38BDF8', 15, 210, 3.6);
        this.addScore(pts, m.x, m.y, '#38BDF8');
        cleared++;
      }
    }

    // Wizard & boosted magic ALSO damage/destroy nearby Monster Generators (authentic Gauntlet!)
    if (totalMagic >= 2.0) {
      for (let gi = this.generators.length - 1; gi >= 0; gi--) {
        const g = this.generators[gi];
        if (Math.hypot(g.x - this.playerX, g.y - this.playerY) <= radius * 0.85) {
          g.hp -= totalMagic * 2.5;
          if (g.hp <= 0) {
            this.generators.splice(gi, 1);
            spawnBurst(this.particles, g.x - this.camX, g.y - this.camY, '#FACC15', 14, 180, 3.5);
            this.addScore(200, g.x, g.y, '#FACC15');
            cleared++;
          }
        }
      }
    }

    this.announce(
      cleared > 0
        ? `${this.getFullHeroTitle()} CAST MAGIC — ${cleared} VANQUISHED!`
        : `${this.getFullHeroTitle()} USED A MAGIC POTION!`
    );
  }

  private updatePlayer(dt: number, isAttract: boolean): void {
    if (this.fireCooldown > 0) this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    const hero = this.getHero();
    const effectiveSpeed = hero.speed + this.bonusSpeed * 28;
    const effectiveArmor = Math.max(0.32, hero.armor - this.bonusArmor * 0.08);

    let mx = 0;
    let my = 0;

    if (isAttract) {
      // Attract mode smoothly showcases hero navigating & firing
      const target = this.monsters[0]
        ? { x: this.monsters[0].x, y: this.monsters[0].y }
        : {
            x: (this.blueprint.exits[0].col + 0.5) * TILE,
            y: (this.blueprint.exits[0].row + 0.5) * TILE,
          };
      const dx = target.x - this.playerX;
      const dy = target.y - this.playerY;
      const dist = Math.hypot(dx, dy) || 1;
      this.aimX = dx / dist;
      this.aimY = dy / dist;
      mx = dist > 160 ? this.aimX : -this.aimX * 0.45;
      my = dist > 160 ? this.aimY : -this.aimY * 0.45;
      if (this.fireCooldown <= 0) this.spawnPlayerShot(hero, true);
    } else if (this.stunTimer <= 0) {
      mx = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
      my = (this.input.down ? 1 : 0) - (this.input.up ? 1 : 0);
      if (mx !== 0 || my !== 0) {
        const len = Math.hypot(mx, my);
        mx /= len;
        my /= len;
        this.aimX = mx;
        this.aimY = my;
        this.walkAnim += dt * 11;
      }

      if (this.input.secondaryJustPressed) {
        this.usePotion(false);
      }

      if ((this.input.fire || this.input.fireJustPressed) && this.fireCooldown <= 0) {
        this.spawnPlayerShot(hero, false);
      }
    }

    const r = 13.5;
    const nx = this.playerX + mx * effectiveSpeed * dt;
    const ny = this.playerY + my * effectiveSpeed * dt;
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

    // Tile interactions
    const pc = Math.floor(this.playerX / TILE);
    const pr = Math.floor(this.playerY / TILE);
    const curCell = this.grid[pr]?.[pc];

    if (curCell === G_ACID && !isAttract) {
      this.health -= 28 * effectiveArmor * dt;
      if (Math.random() < 0.2) {
        spawnBurst(this.particles, this.playerX - this.camX, this.playerY - this.camY, '#4ADE80', 2, 70, 2);
      }
    } else if (curCell === G_STUN && !isAttract && this.stunTimer <= 0) {
      this.stunTimer = 0.85;
      this.grid[pr][pc] = G_FLOOR;
      this.announce(`${this.getFullHeroTitle()} WAS STUNNED!`);
      arcadeAudio.playSplat();
    } else if (curCell === G_TELEPORT && this.teleportCooldown <= 0 && this.blueprint.teleporters.length >= 2) {
      const pads = this.blueprint.teleporters;
      const curIdx = pads.findIndex(([tc, tr]) => tc === pc && tr === pr);
      const nextPad = pads[(curIdx + 1) % pads.length];
      this.playerX = (nextPad[0] + 0.5) * TILE;
      this.playerY = (nextPad[1] + 0.5) * TILE;
      this.teleportCooldown = 1.4;
      spawnBurst(this.particles, this.playerX - this.camX, this.playerY - this.camY, '#22D3EE', 16, 180, 3.2);
      if (!isAttract) {
        arcadeAudio.playPowerPellet();
        this.announce('TELEPORTED ACROSS DUNGEON!');
      }
    } else if (curCell === G_EXIT) {
      if (isAttract) {
        this.loadFloor(1);
      } else {
        const exitMeta = this.blueprint.exits.find((e) => e.col === pc && e.row === pr);
        const skip = exitMeta?.skipFloors ?? 1;
        arcadeAudio.playStageClear();
        this.addScore(500 * skip, this.playerX, this.playerY, '#4ADE80');
        this.level += skip;
        this.phase = 'STAGE_CLEAR';
        this.phaseTimer = 1.3;
        this.bannerText =
          skip > 1 ? `SECRET EXIT! WARPING TO FLOOR ${this.level}!` : `FLOOR ${this.level - 1} ESCAPED!`;
      }
      return;
    }

    // Collect Pickups
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      if (Math.hypot(p.x - this.playerX, p.y - this.playerY) < 27) {
        this.pickups.splice(i, 1);
        if (p.kind === 'food_ham' || p.kind === 'food_cider') {
          const heal = p.kind === 'food_ham' ? 140 : 100;
          this.health = Math.min(999, this.health + heal);
          if (!isAttract) arcadeAudio.playEatFruit();
          this.popups.push({
            x: p.x - this.camX,
            y: p.y - this.camY,
            text: `+${heal} HP`,
            color: '#4ADE80',
            life: 0.9,
            maxLife: 0.9,
          });
        } else if (p.kind === 'poison_cider') {
          if (!isAttract) {
            this.health -= 75 * effectiveArmor;
            this.damageFlash = 0.35;
            arcadeAudio.playSplat();
            this.announce('POISON CIDER! SHOOT PURPLE BOTTLES!');
          }
        } else if (p.kind === 'key') {
          this.keys += 1;
          if (!isAttract) arcadeAudio.playKeyUnlock();
          this.addScore(100, p.x, p.y, '#FACC15');
        } else if (p.kind === 'potion') {
          this.potions = Math.min(9, this.potions + 1);
          if (!isAttract) arcadeAudio.playKeyUnlock();
          this.addScore(150, p.x, p.y, '#38BDF8');
        } else if (p.kind === 'treasure') {
          if (!isAttract) arcadeAudio.playDiamond();
          this.addScore(250, p.x, p.y, '#FDE047');
        } else if (p.kind === 'amulet_power') {
          this.bonusPower = Math.min(4, this.bonusPower + 1);
          if (!isAttract) arcadeAudio.playPowerPellet();
          this.announce(`${this.getFullHeroTitle()} GAINED EXTRA SHOT POWER!`);
        } else if (p.kind === 'amulet_speed') {
          this.bonusSpeed = Math.min(4, this.bonusSpeed + 1);
          if (!isAttract) arcadeAudio.playPowerPellet();
          this.announce(`${this.getFullHeroTitle()} GAINED EXTRA SPEED!`);
        } else if (p.kind === 'amulet_armor') {
          this.bonusArmor = Math.min(4, this.bonusArmor + 1);
          if (!isAttract) arcadeAudio.playPowerPellet();
          this.announce(`${this.getFullHeroTitle()} GAINED EXTRA ARMOR!`);
        } else if (p.kind === 'amulet_magic') {
          this.bonusMagic = Math.min(4, this.bonusMagic + 1);
          if (!isAttract) arcadeAudio.playPowerPellet();
          this.announce(`${this.getFullHeroTitle()} GAINED EXTRA MAGIC POWER!`);
        } else if (p.kind === 'amulet_ricochet') {
          this.ricochetActive = true;
          if (!isAttract) arcadeAudio.playPowerPellet();
          this.announce('REFLECTIVE SHOTS ACTIVATED!');
        } else if (p.kind === 'amulet_invis') {
          this.invisTime = 12;
          if (!isAttract) arcadeAudio.playPowerPellet();
          this.announce(`${this.getFullHeroTitle()} IS INVISIBLE!`);
        }
      }
    }
  }

  private spawnPlayerShot(hero: HeroClassSpec, isAttract: boolean): void {
    this.fireCooldown = Math.max(0.085, hero.shotCooldown - this.bonusSpeed * 0.015);
    const col = this.getColor();
    this.projectiles.push({
      x: this.playerX + this.aimX * 16,
      y: this.playerY + this.aimY * 16,
      vx: this.aimX * (hero.shotSpeed + this.bonusSpeed * 35),
      vy: this.aimY * (hero.shotSpeed + this.bonusSpeed * 35),
      fromPlayer: true,
      weaponStyle: hero.id,
      damage: hero.shotDamage + this.bonusPower * 0.85,
      bounces: this.ricochetActive ? 2 : 0,
      color: col.light,
      overWalls: false,
      flightTime: 0,
      maxFlight: 1.5,
      spin: 0,
    });
    if (!isAttract) arcadeAudio.playLaser(hero.id === 'elf' ? 920 : hero.id === 'wizard' ? 620 : 760);
  }

  private updateGenerators(dt: number): void {
    for (const g of this.generators) {
      g.timer -= dt;
      if (g.timer <= 0 && this.monsters.length < 40) {
        g.timer = Math.max(2.0, 4.4 - this.level * 0.18 - g.tier * 0.25);
        if (Math.hypot(g.x - this.playerX, g.y - this.playerY) < 580) {
          const sx = g.x + (Math.random() - 0.5) * 20;
          const sy = g.y + (Math.random() - 0.5) * 20;
          this.monsters.push(this.createMonster(g.kind, sx, sy, g.tier));
        }
      }
    }
  }

  private updateMonsters(dt: number, isAttract: boolean): void {
    const hero = this.getHero();
    const effectiveArmor = Math.max(0.32, hero.armor - this.bonusArmor * 0.08);
    const aggroRange = this.itTagged ? 920 : this.invisTime > 0 ? 130 : 620;

    for (let i = this.monsters.length - 1; i >= 0; i--) {
      const m = this.monsters[i];
      m.anim += dt * 10;
      if (m.hitFlash > 0) m.hitFlash = Math.max(0, m.hitFlash - dt);
      if (m.kind === 'sorcerer') m.invisTimer += dt;

      let targetX = this.playerX;
      let targetY = this.playerY;
      // Thief flees toward exit once he stole your key/potion!
      if (m.kind === 'thief' && m.stolenItem) {
        const ex = this.blueprint.exits[0];
        targetX = (ex.col + 0.5) * TILE;
        targetY = (ex.row + 0.5) * TILE;
        if (Math.hypot(targetX - m.x, targetY - m.y) < 30) {
          this.monsters.splice(i, 1);
          this.announce('THE THIEF ESCAPED WITH YOUR LOOT!');
          continue;
        }
      }

      const dx = targetX - m.x;
      const dy = targetY - m.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist > aggroRange && !(m.kind === 'thief' && m.stolenItem)) continue;

      // Lobber backs up slightly if player gets too close, then lobs boulders over walls!
      let moveSign = 1;
      if (m.kind === 'lobber' && dist < 145) moveSign = -0.65;

      const spd = m.speed * (this.itTagged && m.kind !== 'it' ? 1.24 : 1);
      m.facingX = dx / dist;
      m.facingY = dy / dist;

      const nx = m.x + m.facingX * spd * moveSign * dt;
      const ny = m.y + m.facingY * spd * moveSign * dt;
      if (!this.isSolid(nx, m.y, false)) m.x = nx;
      if (!this.isSolid(m.x, ny, false)) m.y = ny;

      // Ranged attacks: Demon Fireball, Lobber Over-Wall Boulder, Dragon 3-Way Flame Breath!
      if ((m.kind === 'demon' || m.kind === 'lobber' || m.kind === 'dragon') && dist < 410) {
        m.fireTimer -= dt;
        if (m.fireTimer <= 0) {
          if (m.kind === 'dragon') {
            m.fireTimer = 1.6;
            const baseAng = Math.atan2(dy, dx);
            for (const spread of [-0.24, 0, 0.24]) {
              const a = baseAng + spread;
              this.projectiles.push({
                x: m.x,
                y: m.y,
                vx: Math.cos(a) * 320,
                vy: Math.sin(a) * 320,
                fromPlayer: false,
                weaponStyle: 'dragon_flame',
                damage: 22,
                bounces: 0,
                color: '#F97316',
                overWalls: false,
                flightTime: 0,
                maxFlight: 1.4,
                spin: 0,
              });
            }
          } else if (m.kind === 'lobber') {
            m.fireTimer = 2.25;
            const flight = Math.max(0.55, Math.min(1.15, dist / 280));
            this.projectiles.push({
              x: m.x,
              y: m.y,
              vx: dx / flight,
              vy: dy / flight,
              fromPlayer: false,
              weaponStyle: 'boulder',
              damage: 16,
              bounces: 0,
              color: '#C084FC',
              overWalls: true, // Authentic Lobber: flies cleanly over walls!
              flightTime: 0,
              maxFlight: flight,
              spin: 0,
            });
          } else {
            m.fireTimer = 2.35;
            this.projectiles.push({
              x: m.x,
              y: m.y,
              vx: (dx / dist) * 265,
              vy: (dy / dist) * 265,
              fromPlayer: false,
              weaponStyle: 'fireball',
              damage: 14 + m.tier * 2,
              bounces: 0,
              color: '#FB923C',
              overWalls: false,
              flightTime: 0,
              maxFlight: 1.6,
              spin: 0,
            });
          }
        }
      }

      // Melee Contact & Special Atari Monster Effects
      const hitRad = m.kind === 'dragon' ? 36 : 23;
      if (Math.hypot(this.playerX - m.x, this.playerY - m.y) < hitRad) {
        if (m.kind === 'thief' && !m.stolenItem && !isAttract) {
          if (this.potions > 0) {
            this.potions -= 1;
            m.stolenItem = 'potion';
            this.announce('THIEF STOLE A MAGIC POTION! STOP HIM!');
          } else if (this.keys > 0) {
            this.keys -= 1;
            m.stolenItem = 'key';
            this.announce('THIEF STOLE A KEY! STOP HIM!');
          } else {
            this.health -= 20 * effectiveArmor;
            m.stolenItem = 'key';
          }
          arcadeAudio.playSplat();
          continue;
        }

        if (m.kind === 'it' && !isAttract) {
          if (!this.itTagged) {
            this.itTagged = true;
            this.announce(`${this.getFullHeroTitle()} IS IT! MONSTERS SWARM!`);
            arcadeAudio.playSplat();
          }
          this.monsters.splice(i, 1);
          spawnBurst(this.particles, m.x - this.camX, m.y - this.camY, '#22D3EE', 16, 180, 3.2);
          continue;
        }

        if (!isAttract) {
          const dps =
            m.kind === 'death'
              ? 110
              : m.kind === 'dragon'
                ? 58
                : m.kind === 'sorcerer'
                  ? 38
                  : 32 + m.tier * 4;
          const drain = dps * effectiveArmor * dt;
          this.health -= drain;
          this.damageFlash = 0.14;

          if (m.kind === 'death') {
            m.drainRemaining -= drain;
            if (m.drainRemaining <= 0) {
              // Authentic Death vanishes after draining 200 HP!
              this.monsters.splice(i, 1);
              spawnBurst(this.particles, m.x - this.camX, m.y - this.camY, '#94A3B8', 18, 170, 3);
              this.announce('DEATH VANISHED AFTER DRAINING YOUR LIFE!');
              continue;
            }
          }
        }

        if (m.kind === 'ghost') {
          this.monsters.splice(i, 1);
          spawnBurst(this.particles, m.x - this.camX, m.y - this.camY, '#E2E8F0', 10, 140, 2.5);
        }
      }
    }
  }

  private updateProjectiles(dt: number, isAttract: boolean): void {
    const hero = this.getHero();
    const effectiveArmor = Math.max(0.32, hero.armor - this.bonusArmor * 0.08);

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.flightTime += dt;
      p.spin += dt * 18;
      const nx = p.x + p.vx * dt;
      const ny = p.y + p.vy * dt;

      // Lobber arcing boulders detonate at landing point and ignore walls in mid-air!
      if (p.overWalls) {
        p.x = nx;
        p.y = ny;
        if (p.flightTime >= p.maxFlight) {
          spawnBurst(this.particles, p.x - this.camX, p.y - this.camY, '#C084FC', 8, 120, 2.5);
          if (!isAttract && Math.hypot(p.x - this.playerX, p.y - this.playerY) < 28) {
            this.health -= p.damage * effectiveArmor;
            this.damageFlash = 0.25;
            arcadeAudio.playSplat();
          }
          this.projectiles.splice(i, 1);
        }
        continue;
      }

      if (p.flightTime >= p.maxFlight) {
        this.projectiles.splice(i, 1);
        continue;
      }

      // Check secret shootable walls!
      const tc = Math.floor(nx / TILE);
      const tr = Math.floor(ny / TILE);
      if (p.fromPlayer && this.grid[tr]?.[tc] === G_SECRET_WALL) {
        this.grid[tr][tc] = G_FLOOR;
        spawnBurst(this.particles, nx - this.camX, ny - this.camY, '#FACC15', 14, 170, 3.2);
        if (!isAttract) {
          arcadeAudio.playExplosion(false);
          this.announce('SECRET WALL CRUMBLED!');
        }
        this.projectiles.splice(i, 1);
        continue;
      }

      if (this.isSolid(nx, ny, false)) {
        if (p.bounces > 0) {
          p.bounces -= 1;
          if (this.isSolid(nx, p.y, false)) p.vx = -p.vx;
          if (this.isSolid(p.x, ny, false)) p.vy = -p.vy;
          spawnBurst(this.particles, p.x - this.camX, p.y - this.camY, '#F472B6', 4, 80, 2);
        } else {
          this.projectiles.splice(i, 1);
        }
        continue;
      }
      p.x = nx;
      p.y = ny;

      if (p.fromPlayer) {
        let hit = false;

        // Authentic Atari Gauntlet: Shooting Food destroys it ("RED WARRIOR SHOT THE FOOD!") & shooting Poison Cider safely clears it!
        for (let pi = this.pickups.length - 1; pi >= 0; pi--) {
          const pk = this.pickups[pi];
          if (
            (pk.kind === 'food_ham' || pk.kind === 'food_cider' || pk.kind === 'poison_cider') &&
            Math.hypot(p.x - pk.x, p.y - pk.y) < 18
          ) {
            this.pickups.splice(pi, 1);
            hit = true;
            if (pk.kind === 'poison_cider') {
              spawnBurst(this.particles, pk.x - this.camX, pk.y - this.camY, '#A855F7', 10, 130, 2.6);
              this.addScore(100, pk.x, pk.y, '#C084FC');
              if (!isAttract) this.announce('DESTROYED POISON CIDER!');
            } else if (!isAttract) {
              spawnBurst(this.particles, pk.x - this.camX, pk.y - this.camY, '#F59E0B', 8, 100, 2.4);
              arcadeAudio.playSplat();
              this.announce(`${this.getFullHeroTitle()} SHOT THE FOOD!`);
            }
            break;
          }
        }

        // Hit Monster Generators
        if (!hit) {
          for (let gi = this.generators.length - 1; gi >= 0; gi--) {
            const g = this.generators[gi];
            if (Math.hypot(p.x - g.x, p.y - g.y) < 23) {
              g.hp -= p.damage;
              hit = true;
              spawnBurst(this.particles, p.x - this.camX, p.y - this.camY, '#FDE047', 4, 90, 2);
              if (g.hp <= 0) {
                this.generators.splice(gi, 1);
                if (!isAttract) arcadeAudio.playExplosion(false);
                spawnBurst(this.particles, g.x - this.camX, g.y - this.camY, '#F59E0B', 16, 190, 3.2);
                this.addScore(100 + g.tier * 50, g.x, g.y, '#F59E0B');
              }
              break;
            }
          }
        }

        // Hit Monsters
        if (!hit) {
          for (let mi = this.monsters.length - 1; mi >= 0; mi--) {
            const m = this.monsters[mi];
            const rad = m.kind === 'dragon' ? 34 : 21;
            if (Math.hypot(p.x - m.x, p.y - m.y) < rad) {
              hit = true;
              if (m.kind === 'death' || m.kind === 'it') {
                spawnBurst(this.particles, p.x - this.camX, p.y - this.camY, '#94A3B8', 6, 100, 2);
                if (m.kind === 'death' && !isAttract && Math.random() < 0.35) {
                  this.announce('WEAPONS CANNOT HARM DEATH — USE A POTION!');
                }
                break;
              }
              m.hp -= p.damage;
              m.hitFlash = 0.14;
              if (m.hp <= 0) {
                if (m.kind === 'thief' && m.stolenItem) {
                  this.pickups.push({ x: m.x, y: m.y, kind: m.stolenItem });
                  if (!isAttract) this.announce('RECOVERED LOOT FROM THE THIEF!');
                }
                this.monsters.splice(mi, 1);
                if (!isAttract) arcadeAudio.playExplosion(m.kind === 'dragon');
                spawnBurst(
                  this.particles,
                  m.x - this.camX,
                  m.y - this.camY,
                  m.kind === 'dragon' ? '#F97316' : '#EF4444',
                  m.kind === 'dragon' ? 32 : 12,
                  200,
                  3.5
                );
                const pts =
                  m.kind === 'dragon'
                    ? 3000
                    : m.kind === 'thief'
                      ? 500
                      : m.kind === 'sorcerer'
                        ? 120
                        : m.kind === 'demon'
                          ? 80
                          : m.kind === 'lobber'
                            ? 60
                            : m.kind === 'grunt'
                              ? 40
                              : 20;
                this.addScore(pts, m.x, m.y, '#FDE047');
              }
              break;
            }
          }
        }
        if (hit) this.projectiles.splice(i, 1);
      } else {
        if (Math.hypot(p.x - this.playerX, p.y - this.playerY) < 18) {
          if (!isAttract) {
            this.health -= p.damage * effectiveArmor;
            this.damageFlash = 0.25;
            arcadeAudio.playSplat();
          }
          this.projectiles.splice(i, 1);
        }
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (this.phase === 'PLAYING' && this.subMode === 'SELECT') {
      this.renderHeroSelect(ctx);
      if (visualMode === 'crt') renderCrtOverlay(ctx, VIEW_W, VIEW_H);
      return;
    }

    const theme = DUNGEON_THEMES[this.blueprint.theme];
    ctx.fillStyle = this.potionFlash > 0 ? '#1E3A8A' : '#070910';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // Clip to left Dungeon Viewport (904 x 768)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, PLAY_W, VIEW_H);
    ctx.clip();

    ctx.save();
    ctx.translate(-Math.round(this.camX), -Math.round(this.camY));
    this.renderDungeonTiles(ctx, theme);
    this.renderPickups(ctx);
    this.renderGenerators(ctx);
    this.renderMonsters(ctx);
    this.renderHeroSprite(ctx, this.playerX, this.playerY, Math.atan2(this.aimY, this.aimX), this.getHero(), this.getColor(), 1.0, this.invisTime > 0 ? 0.45 : 1.0);
    this.renderProjectiles(ctx);
    ctx.restore();

    // Subtle ambient tint & damage flash inside dungeon pane
    ctx.fillStyle = theme.ambientTint;
    ctx.fillRect(0, 0, PLAY_W, VIEW_H);
    if (this.damageFlash > 0) {
      ctx.fillStyle = `rgba(239, 68, 68, ${this.damageFlash * 0.45})`;
      ctx.fillRect(0, 0, PLAY_W, VIEW_H);
    }

    renderParticlesAndPopups(ctx, this.particles, this.popups);

    // Classic Atari Announcer Ticker Banner across top of Dungeon Viewport
    if (this.alertText && this.phase === 'PLAYING') {
      ctx.save();
      ctx.font = '800 15px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(4, 6, 13, 0.88)';
      ctx.beginPath();
      ctx.roundRect(PLAY_W * 0.1, 14, PLAY_W * 0.8, 34, 8);
      ctx.fill();
      ctx.strokeStyle = this.getColor().primary;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#FEF08A';
      ctx.fillText(this.alertText, PLAY_W * 0.5, 36);
      ctx.restore();
    }

    // Dragon Boss Health Bar if a Dragon is active in the dungeon
    const activeDragon = this.monsters.find((m) => m.kind === 'dragon');
    if (activeDragon && this.phase === 'PLAYING') {
      const bw = 380;
      const bx = (PLAY_W - bw) * 0.5;
      const by = VIEW_H - 36;
      ctx.fillStyle = 'rgba(8, 10, 18, 0.88)';
      ctx.beginPath();
      ctx.roundRect(bx - 8, by - 14, bw + 16, 36, 8);
      ctx.fill();
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.fillStyle = '#FCA5A5';
      ctx.font = '800 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('FIRE DRAGON GUARDIAN', PLAY_W * 0.5, by - 2);
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(bx, by + 4, bw, 10);
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(bx, by + 4, bw * Math.max(0, activeDragon.hp / activeDragon.maxHp), 10);
    }

    if (this.bannerText && (this.phase === 'READY' || this.phase === 'STAGE_CLEAR')) {
      ctx.save();
      ctx.font = '800 24px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(4, 6, 14, 0.9)';
      ctx.beginPath();
      ctx.roundRect(PLAY_W * 0.1, VIEW_H * 0.43, PLAY_W * 0.8, 66, 12);
      ctx.fill();
      ctx.strokeStyle = this.getColor().primary;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = this.getColor().light;
      ctx.fillText(this.bannerText, PLAY_W * 0.5, VIEW_H * 0.43 + 33);
      ctx.restore();
    }

    ctx.restore(); // end dungeon viewport clip

    // Authentic Atari Gauntlet Right-Side Arcade Status Panel (248 x 768)
    this.renderAtariSidePanel(ctx);

    if (visualMode === 'crt') renderCrtOverlay(ctx, VIEW_W, VIEW_H);
  }

  private renderDungeonTiles(ctx: CanvasRenderingContext2D, theme: DungeonTheme): void {
    const minC = Math.max(0, Math.floor(this.camX / TILE));
    const maxC = Math.min(GAUNTLET_COLS - 1, Math.ceil((this.camX + PLAY_W) / TILE));
    const minR = Math.max(0, Math.floor(this.camY / TILE));
    const maxR = Math.min(GAUNTLET_ROWS - 1, Math.ceil((this.camY + VIEW_H) / TILE));

    // Pass 1: Floor tiles, Carpets, Acid, Stun, Teleporters, Exits
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const x = c * TILE;
        const y = r * TILE;
        const cell = this.grid[r][c];
        const isWallLike =
          cell === G_WALL || cell === G_TORCH_WALL || cell === G_SECRET_WALL || cell === G_DOOR;
        if (isWallLike) continue;

        // Flagstone base with subtle masonry cracks & rivets
        ctx.fillStyle = (r + c) % 2 === 0 ? theme.floorA : theme.floorB;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = theme.floorGrout;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);

        // Subtle stone grain specks
        if ((r * 13 + c * 7) % 5 === 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.035)';
          ctx.fillRect(x + 8, y + 12, 10, 2);
          ctx.fillRect(x + 24, y + 30, 8, 2);
        }

        // Cast shadow from north wall for crisp 2.5D Atari depth!
        const north = this.grid[r - 1]?.[c];
        if (north === G_WALL || north === G_TORCH_WALL || north === G_SECRET_WALL || north === G_DOOR) {
          const sh = ctx.createLinearGradient(x, y, x, y + 12);
          sh.addColorStop(0, 'rgba(0,0,0,0.52)');
          sh.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = sh;
          ctx.fillRect(x, y, TILE, 12);
        }

        if (cell === G_CARPET) {
          ctx.fillStyle = theme.carpetMain;
          ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
          ctx.strokeStyle = theme.carpetTrim;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x + 5, y + 5, TILE - 10, TILE - 10);
        } else if (cell === G_ACID) {
          ctx.fillStyle = '#052E16';
          ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
          const bub = Math.sin(this.time * 6 + r * 2 + c) * 2.5;
          ctx.fillStyle = '#22C55E';
          ctx.beginPath();
          ctx.ellipse(x + TILE * 0.5, y + TILE * 0.5, 17, 12 + bub * 0.6, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#BBF7D0';
          ctx.beginPath();
          ctx.arc(x + 15 + bub, y + 19, 3.2, 0, Math.PI * 2);
          ctx.arc(x + 29 - bub, y + 25, 2.4, 0, Math.PI * 2);
          ctx.fill();
        } else if (cell === G_STUN) {
          const pulse = 0.55 + 0.45 * Math.sin(this.time * 7 + c);
          ctx.strokeStyle = `rgba(192, 132, 252, ${pulse})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x + TILE * 0.5, y + TILE * 0.5, 14, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = `rgba(168, 85, 247, ${pulse * 0.45})`;
          ctx.fill();
          ctx.fillStyle = '#F5D0FE';
          ctx.font = '900 10px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('⚡', x + TILE * 0.5, y + TILE * 0.5);
        } else if (cell === G_TELEPORT) {
          ctx.save();
          ctx.shadowColor = '#22D3EE';
          ctx.shadowBlur = 12;
          const rot = this.time * 2.5;
          ctx.strokeStyle = '#22D3EE';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(x + TILE * 0.5, y + TILE * 0.5, 16, rot, rot + Math.PI * 1.6);
          ctx.stroke();
          ctx.strokeStyle = '#A5F3FC';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.arc(x + TILE * 0.5, y + TILE * 0.5, 10, -rot * 1.4, -rot * 1.4 + Math.PI * 1.4);
          ctx.stroke();
          ctx.restore();
        } else if (cell === G_FORCEFIELD) {
          if (!this.forcefieldsOpen) {
            ctx.save();
            ctx.shadowColor = '#38BDF8';
            ctx.shadowBlur = 10;
            ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
            ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
            ctx.strokeStyle = '#7DD3FC';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(x + 4, y + TILE * 0.5 + Math.sin(this.time * 28) * 3);
            ctx.lineTo(x + TILE - 4, y + TILE * 0.5 - Math.sin(this.time * 28) * 3);
            ctx.stroke();
            ctx.restore();
          } else {
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(x + 5, y + 5, TILE - 10, TILE - 10);
            ctx.setLineDash([]);
          }
        } else if (cell === G_EXIT) {
          const exMeta = this.blueprint.exits.find((e) => e.col === c && e.row === r);
          const skip = exMeta?.skipFloors ?? 1;
          ctx.save();
          ctx.shadowColor = skip > 1 ? '#FACC15' : '#4ADE80';
          ctx.shadowBlur = 14;
          ctx.fillStyle = skip > 1 ? '#713F12' : '#064E3B';
          ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
          ctx.strokeStyle = skip > 1 ? '#FACC15' : '#4ADE80';
          ctx.lineWidth = 2.6;
          ctx.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
          ctx.fillStyle = skip > 1 ? '#FDE047' : '#10B981';
          for (let s = 0; s < 4; s++) {
            ctx.fillRect(x + 8, y + 8 + s * 6.5, TILE - 16, 3.2);
          }
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '900 10px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(skip > 1 ? `EXIT+${skip}` : 'EXIT', x + TILE * 0.5, y + TILE * 0.5);
          ctx.restore();
        } else if (cell === G_PILLAR) {
          // Carved octagonal stone dungeon column
          ctx.fillStyle = 'rgba(0,0,0,0.45)';
          ctx.beginPath();
          ctx.ellipse(x + TILE * 0.5 + 3, y + TILE * 0.5 + 5, 16, 14, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = theme.wallFace;
          ctx.beginPath();
          ctx.arc(x + TILE * 0.5, y + TILE * 0.5, 15, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = theme.wallTop;
          ctx.beginPath();
          ctx.arc(x + TILE * 0.5, y + TILE * 0.5 - 3, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = theme.wallHighlight;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    }

    // Pass 2: 3D Extruded Beveled Masonry Walls, Secret Cracked Walls, Iron Doors & Torch Sconces
    const torches: Array<[number, number]> = [];
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const x = c * TILE;
        const y = r * TILE;
        const cell = this.grid[r][c];
        if (cell === G_WALL || cell === G_TORCH_WALL || cell === G_SECRET_WALL) {
          // Top stone face + lower extruded facade
          const wg = ctx.createLinearGradient(x, y, x, y + TILE);
          wg.addColorStop(0, theme.wallTop);
          wg.addColorStop(0.68, theme.wallFace);
          wg.addColorStop(1, theme.wallDark);
          ctx.fillStyle = wg;
          ctx.fillRect(x, y, TILE, TILE);

          // Crisp masonry brick course lines
          ctx.fillStyle = 'rgba(255,255,255,0.16)';
          ctx.fillRect(x + 1, y + 1, TILE - 2, 3);
          ctx.fillStyle = 'rgba(0,0,0,0.38)';
          ctx.fillRect(x, y + TILE - 4, TILE, 4);
          ctx.strokeStyle = 'rgba(0,0,0,0.45)';
          ctx.lineWidth = 1.3;
          ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE * 0.5);
          ctx.strokeRect(x + 0.5, y + TILE * 0.5, TILE - 1, TILE * 0.5);
          // Staggered vertical mortar joints
          ctx.beginPath();
          ctx.moveTo(x + TILE * 0.5, y);
          ctx.lineTo(x + TILE * 0.5, y + TILE * 0.5);
          ctx.moveTo(x + TILE * 0.25, y + TILE * 0.5);
          ctx.lineTo(x + TILE * 0.25, y + TILE);
          ctx.moveTo(x + TILE * 0.75, y + TILE * 0.5);
          ctx.lineTo(x + TILE * 0.75, y + TILE);
          ctx.stroke();

          if (cell === G_SECRET_WALL) {
            // Subtle glowing fracture fissures hinting you can shoot this wall!
            ctx.strokeStyle = '#FACC15';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(x + 10, y + 8);
            ctx.lineTo(x + 20, y + 20);
            ctx.lineTo(x + 15, y + 34);
            ctx.moveTo(x + 20, y + 20);
            ctx.lineTo(x + 33, y + 26);
            ctx.stroke();
          }
          if (cell === G_TORCH_WALL) {
            torches.push([x + TILE * 0.5, y + TILE - 6]);
          }
        } else if (cell === G_DOOR) {
          // Iron-banded timber vault door with brass keyhole
          ctx.fillStyle = '#78350F';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = '#92400E';
          ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
          ctx.fillStyle = '#475569';
          ctx.fillRect(x + 2, y + 9, TILE - 4, 4.5);
          ctx.fillRect(x + 2, y + TILE - 13.5, TILE - 4, 4.5);
          ctx.strokeStyle = '#FACC15';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
          ctx.fillStyle = '#FDE047';
          ctx.beginPath();
          ctx.arc(x + TILE * 0.5, y + TILE * 0.5 - 1, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#0F172A';
          ctx.fillRect(x + TILE * 0.5 - 1.6, y + TILE * 0.5 - 2, 3.2, 6.5);
        }
      }
    }

    // Pass 3: Warm Flickering Torchlight Braziers
    for (const [tx, ty] of torches) {
      const flick = Math.sin(this.time * 16 + tx * 0.2) * 3;
      const glow = ctx.createRadialGradient(tx, ty + 8, 2, tx, ty + 8, 66 + flick * 2);
      glow.addColorStop(0, 'rgba(251, 146, 60, 0.34)');
      glow.addColorStop(0.5, 'rgba(245, 158, 11, 0.12)');
      glow.addColorStop(1, 'rgba(245, 158, 11, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(tx, ty + 8, 68 + flick * 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#334155';
      ctx.fillRect(tx - 4, ty - 2, 8, 6);
      ctx.fillStyle = '#F97316';
      ctx.beginPath();
      ctx.arc(tx, ty - 4 + flick * 0.3, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(tx, ty - 4, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderPickups(ctx: CanvasRenderingContext2D): void {
    for (const p of this.pickups) {
      ctx.save();
      ctx.translate(p.x, p.y + Math.sin(this.time * 4.5 + p.x) * 1.6);
      if (p.kind === 'food_ham') {
        ctx.fillStyle = '#94A3B8';
        ctx.beginPath();
        ctx.ellipse(0, 4, 15, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#D97706';
        ctx.beginPath();
        ctx.ellipse(-2, 1, 11.5, 7.5, -0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FEF3C7';
        ctx.fillRect(8, -1, 7, 4);
        ctx.beginPath();
        ctx.arc(15, -1, 2.4, 0, Math.PI * 2);
        ctx.arc(15, 3, 2.4, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'food_cider' || p.kind === 'poison_cider') {
        const isPoison = p.kind === 'poison_cider';
        ctx.fillStyle = isPoison ? '#9333EA' : '#D97706';
        ctx.beginPath();
        ctx.roundRect(-7, -4, 14, 15, 4);
        ctx.fill();
        ctx.fillStyle = isPoison ? '#E9D5FF' : '#FEF08A';
        ctx.fillRect(-3, -10, 6, 7);
        if (isPoison) {
          ctx.fillStyle = '#F0ABFC';
          ctx.font = '900 9px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText('☠', 0, 7);
        }
      } else if (p.kind === 'key') {
        ctx.shadowColor = '#FACC15';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.arc(-6, 0, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.arc(-6, 0, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(-1, -2, 13, 4);
        ctx.fillRect(6, 2, 2.8, 4.5);
        ctx.fillRect(10, 2, 2.8, 3.5);
      } else if (p.kind === 'potion') {
        ctx.shadowColor = '#38BDF8';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#0284C7';
        ctx.beginPath();
        ctx.arc(0, 4, 9.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7DD3FC';
        ctx.beginPath();
        ctx.arc(-2.5, 2, 3.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#E0F2FE';
        ctx.fillRect(-3.5, -10, 7, 6);
        ctx.fillStyle = '#D97706';
        ctx.fillRect(-4, -12, 8, 3);
      } else if (p.kind === 'treasure') {
        ctx.fillStyle = '#92400E';
        ctx.beginPath();
        ctx.roundRect(-12, -8, 24, 16, 3);
        ctx.fill();
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(-12, -3, 24, 3);
        ctx.fillRect(-3, -5, 6, 7);
        ctx.strokeStyle = '#FEF08A';
        ctx.lineWidth = 1.6;
        ctx.strokeRect(-11, -7, 22, 14);
      } else {
        // Glowing Gauntlet Power-Up Amulet / Gem
        const amCol =
          p.kind === 'amulet_power'
            ? '#EF4444'
            : p.kind === 'amulet_armor'
              ? '#3B82F6'
              : p.kind === 'amulet_magic'
                ? '#FACC15'
                : p.kind === 'amulet_speed'
                  ? '#22C55E'
                  : p.kind === 'amulet_ricochet'
                    ? '#EC4899'
                    : '#A855F7';
        const glyph =
          p.kind === 'amulet_power'
            ? 'P'
            : p.kind === 'amulet_armor'
              ? 'A'
              : p.kind === 'amulet_magic'
                ? 'M'
                : p.kind === 'amulet_speed'
                  ? 'S'
                  : p.kind === 'amulet_ricochet'
                    ? 'R'
                    : 'I';
        ctx.shadowColor = amCol;
        ctx.shadowBlur = 12;
        ctx.fillStyle = amCol;
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(12, 0);
        ctx.lineTo(0, 12);
        ctx.lineTo(-12, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(glyph, 0, 0.5);
      }
      ctx.restore();
    }
  }

  private renderGenerators(ctx: CanvasRenderingContext2D): void {
    for (const g of this.generators) {
      ctx.save();
      ctx.translate(g.x, g.y);
      const pulse = 0.78 + 0.22 * Math.sin(this.time * 6 + g.x);

      if (g.kind === 'ghost') {
        // Authentic Atari Ghost Bone Pile!
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.ellipse(0, 6, 16, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-11, -5);
        ctx.lineTo(11, 7);
        ctx.moveTo(11, -5);
        ctx.lineTo(-11, 7);
        ctx.stroke();
        ctx.fillStyle = '#F8FAFC';
        ctx.beginPath();
        ctx.arc(0, -3, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-3.5, -5, 2.2, 2.8);
        ctx.fillRect(1.3, -5, 2.2, 2.8);
      } else {
        // Tiered Stone/Iron/Obsidian Monster Spawner Box
        const bg =
          g.kind === 'grunt'
            ? '#78350F'
            : g.kind === 'demon'
              ? '#7F1D1D'
              : g.kind === 'lobber'
                ? '#581C87'
                : '#1E3A8A';
        const rim = g.tier === 3 ? '#FACC15' : g.tier === 2 ? '#CBD5E1' : '#94A3B8';
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.roundRect(-16, -16, 32, 32, 6);
        ctx.fill();
        ctx.strokeStyle = rim;
        ctx.lineWidth = 2.4;
        ctx.stroke();
        ctx.fillStyle = `rgba(255,255,255,${pulse * 0.75})`;
        ctx.font = '900 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(g.tier === 3 ? 'III' : g.tier === 2 ? 'II' : 'I', 0, 0);
      }

      // Small damage bar if hit
      if (g.hp < g.maxHp) {
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(-14, -22, 28, 4);
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(-14, -22, 28 * Math.max(0, g.hp / g.maxHp), 4);
      }
      ctx.restore();
    }
  }

  private renderMonsters(ctx: CanvasRenderingContext2D): void {
    for (const m of this.monsters) {
      ctx.save();
      ctx.translate(m.x, m.y);
      const bob = Math.sin(m.anim) * 2.2;

      // Ground shadow
      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      ctx.beginPath();
      ctx.ellipse(0, 12, m.kind === 'dragon' ? 28 : 13, m.kind === 'dragon' ? 12 : 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Sorcerer authentic invisibility shimmer!
      if (m.kind === 'sorcerer') {
        const vis = Math.sin(m.invisTimer * 2.2) > -0.25 ? 0.95 : 0.16;
        ctx.globalAlpha = vis;
      }

      if (m.hitFlash > 0) {
        ctx.shadowColor = '#FFFFFF';
        ctx.shadowBlur = 14;
      }

      if (m.kind === 'dragon') {
        const wing = Math.sin(this.time * 10) * 8;
        ctx.fillStyle = '#991B1B';
        ctx.beginPath();
        ctx.moveTo(-14, 0);
        ctx.lineTo(-38, -20 + wing);
        ctx.lineTo(-28, 14 + wing * 0.5);
        ctx.closePath();
        ctx.moveTo(14, 0);
        ctx.lineTo(38, -20 + wing);
        ctx.lineTo(28, 14 + wing * 0.5);
        ctx.closePath();
        ctx.fill();
        const dg = ctx.createRadialGradient(-4, -6, 3, 0, 0, 28);
        dg.addColorStop(0, '#F87171');
        dg.addColorStop(0.55, '#DC2626');
        dg.addColorStop(1, '#450A0A');
        ctx.fillStyle = dg;
        ctx.beginPath();
        ctx.roundRect(-24, -20, 48, 40, 14);
        ctx.fill();
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.arc(-8, -6, 4.8, 0, Math.PI * 2);
        ctx.arc(8, -6, 4.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-9, -8, 2, 4);
        ctx.fillRect(7, -8, 2, 4);
      } else if (m.kind === 'death') {
        // Black hooded Death with curved silver scythe & crimson skull glow
        ctx.shadowColor = '#EF4444';
        ctx.shadowBlur = 14;
        ctx.fillStyle = '#090D16';
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 2.2;
        ctx.stroke();
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.moveTo(13, 13);
        ctx.lineTo(13, -13);
        ctx.quadraticCurveTo(25, -18, 20, -3);
        ctx.stroke();
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(-6, -4, 4, 4);
        ctx.fillRect(2, -4, 4, 4);
      } else if (m.kind === 'it') {
        // Gauntlet II glowing cyan/blue phantom "It"
        ctx.shadowColor = '#22D3EE';
        ctx.shadowBlur = 16;
        ctx.fillStyle = '#06B6D4';
        ctx.beginPath();
        ctx.arc(0, bob * 0.5, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 12px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('IT', 0, bob * 0.5);
      } else if (m.kind === 'thief') {
        // Agile hooded crimson/black bandit holding stolen loot!
        ctx.fillStyle = '#1E293B';
        ctx.beginPath();
        ctx.arc(0, 0, 12.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#DC2626';
        ctx.beginPath();
        ctx.moveTo(-12, 4);
        ctx.lineTo(0, -14);
        ctx.lineTo(12, 4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#FEF08A';
        ctx.fillRect(-4, -3, 2.5, 2.5);
        ctx.fillRect(1.5, -3, 2.5, 2.5);
        if (m.stolenItem) {
          ctx.fillStyle = m.stolenItem === 'key' ? '#FACC15' : '#38BDF8';
          ctx.beginPath();
          ctx.arc(10, -8, 4.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (m.kind === 'lobber') {
        // Purple/indigo stone-hurling Lobber holding boulder overhead
        ctx.fillStyle = '#6D28D9';
        ctx.beginPath();
        ctx.arc(0, 1, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#A78BFA';
        ctx.beginPath();
        ctx.arc(0, -9 + bob * 0.5, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FEF08A';
        ctx.fillRect(-5, -2, 3, 3);
        ctx.fillRect(2, -2, 3, 3);
      } else if (m.kind === 'sorcerer') {
        // Cyan/violet phasing Sorcerer mage
        ctx.fillStyle = '#4C1D95';
        ctx.beginPath();
        ctx.arc(0, 2, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.moveTo(-10, -2);
        ctx.lineTo(0, -17);
        ctx.lineTo(10, -2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(-4.5, -1, 3, 3);
        ctx.fillRect(1.5, -1, 3, 3);
      } else if (m.kind === 'ghost') {
        ctx.globalAlpha = 0.88;
        ctx.fillStyle = m.tier === 3 ? '#BAE6FD' : '#F1F5F9';
        ctx.beginPath();
        ctx.arc(0, -3 + bob * 0.5, 11.5, Math.PI, 0);
        ctx.lineTo(11.5, 10);
        ctx.lineTo(5, 6);
        ctx.lineTo(0, 11);
        ctx.lineTo(-5, 6);
        ctx.lineTo(-11.5, 10);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.arc(-4, -3 + bob * 0.5, 2.2, 0, Math.PI * 2);
        ctx.arc(4, -3 + bob * 0.5, 2.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (m.kind === 'grunt') {
        ctx.fillStyle = m.tier === 3 ? '#7C2D12' : '#92400E';
        ctx.beginPath();
        ctx.arc(0, 0, 13.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(10, -11 + bob, 4.8, 17);
        ctx.fillStyle = '#FEF3C7';
        ctx.fillRect(-5, 4, 2.5, 4);
        ctx.fillRect(2.5, 4, 2.5, 4);
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-5, -4, 3, 3);
        ctx.fillRect(2, -4, 3, 3);
      } else {
        // Horned Red Demon
        ctx.fillStyle = m.tier === 3 ? '#991B1B' : '#DC2626';
        ctx.beginPath();
        ctx.arc(0, 1, 13.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.moveTo(-9, -8);
        ctx.lineTo(-15, -18);
        ctx.lineTo(-3, -11);
        ctx.moveTo(9, -8);
        ctx.lineTo(15, -18);
        ctx.lineTo(3, -11);
        ctx.fill();
        ctx.fillRect(-5.5, -4, 3.5, 3);
        ctx.fillRect(2, -4, 3.5, 3);
      }
      ctx.restore();
    }
  }

  private renderHeroSprite(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number,
    hero: HeroClassSpec,
    col: CabinetColorSpec,
    scale = 1,
    alpha = 1
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;

    // Ground drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 11, 13, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(angle);
    ctx.shadowColor = col.primary;
    ctx.shadowBlur = 12;

    if (hero.id === 'warrior') {
      // THOR THE WARRIOR: Broad armored shoulders in cabinet color (RED default), horned Viking helm, battle axe
      ctx.fillStyle = col.dark;
      ctx.beginPath();
      ctx.ellipse(-2, 0, 12, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = col.primary;
      ctx.beginPath();
      ctx.arc(0, 0, 11.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#CBD5E1';
      ctx.beginPath();
      ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
      ctx.fill();
      // Viking horns
      ctx.fillStyle = '#FEF3C7';
      ctx.beginPath();
      ctx.moveTo(-1, -7);
      ctx.lineTo(-5, -15);
      ctx.lineTo(4, -6);
      ctx.moveTo(-1, 7);
      ctx.lineTo(-5, 15);
      ctx.lineTo(4, 6);
      ctx.fill();
      // Gleaming Battle Axe forward
      ctx.fillStyle = '#92400E';
      ctx.fillRect(5, -2, 14, 3.6);
      ctx.fillStyle = '#F8FAFC';
      ctx.beginPath();
      ctx.arc(16, 0, 6.5, -1.25, 1.25);
      ctx.fill();
    } else if (hero.id === 'valkyrie') {
      // THYRA THE VALKYRIE: Royal armor in cabinet color (BLUE default), winged helm, kite shield & broadsword
      ctx.fillStyle = col.dark;
      ctx.beginPath();
      ctx.arc(0, 0, 13.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = col.primary;
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      // Golden braided hair / winged helm
      ctx.fillStyle = '#FDE047';
      ctx.beginPath();
      ctx.arc(-2, 0, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F8FAFC';
      ctx.beginPath();
      ctx.ellipse(-2, -10.5, 6.5, 3, -0.35, 0, Math.PI * 2);
      ctx.ellipse(-2, 10.5, 6.5, 3, 0.35, 0, Math.PI * 2);
      ctx.fill();
      // Broadsword & Kite Shield
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(8, -8.5, 13, 3);
      ctx.fillStyle = col.light;
      ctx.beginPath();
      ctx.ellipse(9, 7.5, 5.5, 7.5, 0.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (hero.id === 'wizard') {
      // MERLIN THE WIZARD: Flowing robes & pointed wizard hat in cabinet color (YELLOW default) + orb staff
      ctx.fillStyle = col.dark;
      ctx.beginPath();
      ctx.arc(-1, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = col.primary;
      ctx.beginPath();
      ctx.arc(-1, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      // Pointed star hat brim
      ctx.fillStyle = col.light;
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(4, -8);
      ctx.lineTo(4, 8);
      ctx.closePath();
      ctx.fill();
      // Arcane Fire Staff
      ctx.fillStyle = '#92400E';
      ctx.fillRect(5, -1.5, 11, 3);
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(16, 0, 4.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(16, 0, 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // QUESTOR THE ELF: Hooded ranger cloak in cabinet color (GREEN default) + drawn recurve bow
      ctx.fillStyle = col.dark;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = col.primary;
      ctx.beginPath();
      ctx.moveTo(-13, 0);
      ctx.lineTo(6, -10);
      ctx.lineTo(6, 10);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = col.light;
      ctx.beginPath();
      ctx.arc(2, 0, 5.5, 0, Math.PI * 2);
      ctx.fill();
      // Recurve Bow + Arrow
      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(6, 0, 11.5, -1.1, 1.1);
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(6, -1, 12, 2);
    }

    ctx.restore();
  }

  private renderProjectiles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.projectiles) {
      ctx.save();
      if (p.overWalls) {
        // Arcing Lobber boulder with ground shadow & height lift!
        const frac = p.flightTime / p.maxFlight;
        const lift = Math.sin(frac * Math.PI) * 44;
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + 4, 8, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.translate(p.x, p.y - lift);
        ctx.rotate(p.spin);
        ctx.fillStyle = '#A855F7';
        ctx.beginPath();
        ctx.arc(0, 0, 7.5 + lift * 0.08, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#E9D5FF';
        ctx.beginPath();
        ctx.arc(-2, -2, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        continue;
      }

      ctx.translate(p.x, p.y);
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;

      if (p.weaponStyle === 'warrior') {
        // Spinning Battle Axe!
        ctx.rotate(p.spin);
        ctx.fillStyle = '#92400E';
        ctx.fillRect(-8, -1.8, 16, 3.6);
        ctx.fillStyle = '#F8FAFC';
        ctx.beginPath();
        ctx.arc(6, 0, 6.5, -1.3, 1.3);
        ctx.fill();
      } else if (p.weaponStyle === 'valkyrie') {
        // Gleaming Broadsword!
        ctx.rotate(Math.atan2(p.vy, p.vx));
        ctx.fillStyle = '#E0F2FE';
        ctx.beginPath();
        ctx.moveTo(11, 0);
        ctx.lineTo(-5, -3.5);
        ctx.lineTo(-5, 3.5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(-7, -6, 3, 12);
      } else if (p.weaponStyle === 'wizard') {
        // Blazing Golden Fireball!
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.weaponStyle === 'elf') {
        // Fast Elven Arrow!
        ctx.rotate(Math.atan2(p.vy, p.vx));
        ctx.fillStyle = '#86EFAC';
        ctx.fillRect(-10, -1.5, 19, 3);
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.lineTo(5, -4);
        ctx.lineTo(5, 4);
        ctx.closePath();
        ctx.fill();
      } else {
        // Demon / Dragon Fireball
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.weaponStyle === 'dragon_flame' ? 7.5 : 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private renderAtariSidePanel(ctx: CanvasRenderingContext2D): void {
    const px = PLAY_W;
    const hero = this.getHero();
    const col = this.getColor();

    // Dark brushed Atari cabinet bezel
    const bg = ctx.createLinearGradient(px, 0, VIEW_W, 0);
    bg.addColorStop(0, '#0C1120');
    bg.addColorStop(1, '#070A14');
    ctx.fillStyle = bg;
    ctx.fillRect(px, 0, PANEL_W, VIEW_H);

    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px + 1, 0);
    ctx.lineTo(px + 1, VIEW_H);
    ctx.stroke();

    // Header Title
    ctx.textAlign = 'center';
    ctx.fillStyle = this.isSequel ? '#FB7185' : '#FACC15';
    ctx.font = '900 20px "Outfit", sans-serif';
    ctx.fillText(this.isSequel ? 'GAUNTLET II' : 'GAUNTLET', px + PANEL_W * 0.5, 34);
    ctx.fillStyle = '#94A3B8';
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.fillText(this.blueprint.name.toUpperCase(), px + PANEL_W * 0.5, 54);

    // Active Hero Portrait Card in true RED / BLUE / YELLOW / GREEN arcade color!
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.beginPath();
    ctx.roundRect(px + 14, 68, PANEL_W - 28, 120, 12);
    ctx.fill();
    ctx.strokeStyle = col.primary;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    this.renderHeroSprite(ctx, px + 56, 124, -0.35, hero, col, 1.45, 1);

    ctx.textAlign = 'left';
    ctx.fillStyle = col.light;
    ctx.font = '800 12px "JetBrains Mono", monospace';
    ctx.fillText(col.label, px + 96, 98);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 18px "Outfit", sans-serif';
    ctx.fillText(hero.className.toUpperCase(), px + 96, 120);
    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.fillText(`${hero.heroName} · ${hero.weaponName}`, px + 96, 140);
    ctx.fillStyle = '#64748B';
    ctx.font = '600 10px "JetBrains Mono", monospace';
    ctx.fillText('Press R to Swap Hero', px + 96, 162);

    // Classic Gauntlet Health Counter + Bar
    ctx.textAlign = 'left';
    ctx.fillStyle = '#94A3B8';
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.fillText('HEALTH', px + 18, 214);
    ctx.textAlign = 'right';
    ctx.fillStyle = this.health < 200 ? '#F87171' : '#4ADE80';
    ctx.font = '900 22px "JetBrains Mono", monospace';
    ctx.fillText(String(Math.max(0, Math.ceil(this.health))), px + PANEL_W - 18, 216);

    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.roundRect(px + 18, 224, PANEL_W - 36, 12, 4);
    ctx.fill();
    ctx.fillStyle = this.health < 200 ? '#EF4444' : col.primary;
    ctx.beginPath();
    ctx.roundRect(px + 18, 224, (PANEL_W - 36) * Math.min(1, this.health / 900), 12, 4);
    ctx.fill();

    // Score & Floor Row
    ctx.textAlign = 'left';
    ctx.fillStyle = '#94A3B8';
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.fillText('SCORE', px + 18, 260);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#FDE047';
    ctx.font = '900 18px "JetBrains Mono", monospace';
    ctx.fillText(this.score.toLocaleString(), px + PANEL_W - 18, 262);

    // Keys & Magic Potions Slots
    const slotY = 280;
    const slotW = (PANEL_W - 44) * 0.5;
    ctx.fillStyle = 'rgba(250, 204, 21, 0.08)';
    ctx.beginPath();
    ctx.roundRect(px + 18, slotY, slotW, 56, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.35)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FACC15';
    ctx.font = '800 10px "JetBrains Mono", monospace';
    ctx.fillText('KEYS', px + 18 + slotW * 0.5, slotY + 18);
    ctx.font = '900 22px "JetBrains Mono", monospace';
    ctx.fillText(String(this.keys), px + 18 + slotW * 0.5, slotY + 44);

    const px2 = px + 26 + slotW;
    ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.beginPath();
    ctx.roundRect(px2, slotY, slotW, 56, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.stroke();
    ctx.fillStyle = '#38BDF8';
    ctx.font = '800 10px "JetBrains Mono", monospace';
    ctx.fillText('POTIONS', px2 + slotW * 0.5, slotY + 18);
    ctx.font = '900 22px "JetBrains Mono", monospace';
    ctx.fillText(String(this.potions), px2 + slotW * 0.5, slotY + 44);

    // Active Power-Up Badges
    ctx.textAlign = 'left';
    ctx.fillStyle = '#94A3B8';
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.fillText('ACTIVE POWERS', px + 18, 358);
    const badges: Array<[string, string, boolean]> = [
      [`PWR+${this.bonusPower}`, '#EF4444', this.bonusPower > 0],
      [`ARM+${this.bonusArmor}`, '#3B82F6', this.bonusArmor > 0],
      [`MAG+${this.bonusMagic}`, '#FACC15', this.bonusMagic > 0],
      [`SPD+${this.bonusSpeed}`, '#22C55E', this.bonusSpeed > 0],
      ['BOUNCE', '#EC4899', this.ricochetActive],
      ['IT!', '#22D3EE', this.itTagged],
    ];
    badges.forEach(([txt, color, on], idx) => {
      const bx = px + 18 + (idx % 3) * 72;
      const by = 368 + Math.floor(idx / 3) * 28;
      ctx.fillStyle = on ? `${color}30` : 'rgba(255,255,255,0.03)';
      ctx.beginPath();
      ctx.roundRect(bx, by, 66, 22, 5);
      ctx.fill();
      ctx.strokeStyle = on ? color : 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = on ? '#FFFFFF' : '#475569';
      ctx.font = '800 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(txt, bx + 33, by + 15);
    });

    // Live Dungeon Mini-Map Radar
    const mapX = px + 18;
    const mapY = 442;
    const cellW = (PANEL_W - 36) / GAUNTLET_COLS; // ~6.6px
    const cellH = cellW;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#94A3B8';
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.fillText('DUNGEON RADAR', mapX, mapY - 8);
    ctx.fillStyle = '#04060D';
    ctx.fillRect(mapX - 2, mapY - 2, GAUNTLET_COLS * cellW + 4, GAUNTLET_ROWS * cellH + 4);
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.strokeRect(mapX - 2, mapY - 2, GAUNTLET_COLS * cellW + 4, GAUNTLET_ROWS * cellH + 4);

    for (let r = 0; r < GAUNTLET_ROWS; r++) {
      for (let c = 0; c < GAUNTLET_COLS; c++) {
        const t = this.grid[r][c];
        if (t === G_WALL || t === G_TORCH_WALL || t === G_PILLAR) {
          ctx.fillStyle = '#334155';
          ctx.fillRect(mapX + c * cellW, mapY + r * cellH, cellW, cellH);
        } else if (t === G_DOOR) {
          ctx.fillStyle = '#FACC15';
          ctx.fillRect(mapX + c * cellW, mapY + r * cellH, cellW, cellH);
        } else if (t === G_EXIT) {
          ctx.fillStyle = '#4ADE80';
          ctx.fillRect(mapX + c * cellW, mapY + r * cellH, cellW, cellH);
        } else if (t === G_TELEPORT) {
          ctx.fillStyle = '#22D3EE';
          ctx.fillRect(mapX + c * cellW, mapY + r * cellH, cellW, cellH);
        }
      }
    }
    // Generators & Boss dots on mini-map
    ctx.fillStyle = '#F97316';
    for (const g of this.generators) {
      ctx.fillRect(mapX + (g.x / TILE) * cellW - 1.5, mapY + (g.y / TILE) * cellH - 1.5, 3, 3);
    }
    for (const m of this.monsters) {
      if (m.kind === 'dragon' || m.kind === 'death') {
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(mapX + (m.x / TILE) * cellW, mapY + (m.y / TILE) * cellH, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Player dot
    ctx.fillStyle = col.primary;
    ctx.beginPath();
    ctx.arc(mapX + (this.playerX / TILE) * cellW, mapY + (this.playerY / TILE) * cellH, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Atari Voice Announcer Log
    const logY = mapY + GAUNTLET_ROWS * cellH + 26;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#94A3B8';
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.fillText('DUNGEON CHRONICLE', mapX, logY);
    ctx.font = '600 10px "JetBrains Mono", monospace';
    for (let i = 0; i < Math.min(4, this.announcerLog.length); i++) {
      ctx.fillStyle = i === 0 ? '#FEF08A' : '#64748B';
      const line = this.announcerLog[i].slice(0, 29);
      ctx.fillText(line, mapX, logY + 18 + i * 18);
    }
  }

  private renderHeroSelect(ctx: CanvasRenderingContext2D): void {
    // Rich stone castle hero selection hall
    const bg = ctx.createRadialGradient(VIEW_W * 0.5, VIEW_H * 0.4, 80, VIEW_W * 0.5, VIEW_H * 0.5, VIEW_W * 0.72);
    bg.addColorStop(0, this.isSequel ? '#2B0D18' : '#141B2D');
    bg.addColorStop(1, '#060811');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    ctx.textAlign = 'center';
    ctx.fillStyle = this.isSequel ? '#FB7185' : '#FACC15';
    ctx.font = '900 38px "Outfit", sans-serif';
    ctx.fillText(
      this.isSequel ? 'GAUNTLET II · CHOOSE HERO & COLOR' : 'GAUNTLET · CHOOSE YOUR HERO',
      VIEW_W * 0.5,
      68
    );

    ctx.fillStyle = '#CBD5E1';
    ctx.font = '600 14px "JetBrains Mono", monospace';
    ctx.fillText(
      this.isSequel
        ? 'LEFT/RIGHT: CLASS  ·  UP/DOWN: RED / BLUE / YELLOW / GREEN  ·  SPACE OR CLICK TO ENTER'
        : 'LEFT/RIGHT OR CLICK TO PICK RED WARRIOR · BLUE VALKYRIE · YELLOW WIZARD · GREEN ELF',
      VIEW_W * 0.5,
      104
    );

    // 4 Authentic Arcade Hero Cards
    const cardW = 236;
    const gap = 22;
    const startX = (VIEW_W - (cardW * 4 + gap * 3)) * 0.5;
    const cardY = 152;
    const cardH = 396;

    HERO_CLASSES.forEach((h, i) => {
      const selected = i === this.heroIdx;
      const col = this.isSequel && selected ? this.getColor() : CABINET_COLORS[h.defaultColorIdx];
      const cx = startX + i * (cardW + gap);

      ctx.save();
      ctx.fillStyle = selected ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.72)';
      ctx.beginPath();
      ctx.roundRect(cx, cardY, cardW, cardH, 16);
      ctx.fill();
      ctx.strokeStyle = selected ? col.primary : 'rgba(255,255,255,0.12)';
      ctx.lineWidth = selected ? 3.5 : 1.5;
      if (selected) {
        ctx.shadowColor = col.primary;
        ctx.shadowBlur = 22;
      }
      ctx.stroke();
      ctx.restore();

      // Color banner pill
      ctx.fillStyle = col.primary;
      ctx.beginPath();
      ctx.roundRect(cx + 22, cardY + 18, cardW - 44, 26, 6);
      ctx.fill();
      ctx.fillStyle = col.id === 'yellow' ? '#0F172A' : '#FFFFFF';
      ctx.font = '900 12px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${col.label} PLAYER`, cx + cardW * 0.5, cardY + 35);

      // Live rotating animated Hero Sprite Portrait!
      this.renderHeroSprite(
        ctx,
        cx + cardW * 0.5,
        cardY + 114,
        selected ? Math.sin(this.time * 2.5) * 0.6 - 0.3 : -0.4,
        h,
        col,
        2.35,
        1
      );

      // Hero Class & Name
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 24px "Outfit", sans-serif';
      ctx.fillText(h.className.toUpperCase(), cx + cardW * 0.5, cardY + 184);
      ctx.fillStyle = col.light;
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillText(`${h.heroName} · ${h.weaponName}`, cx + cardW * 0.5, cardY + 206);

      // 4 Classic Atari Stat Bars
      const stats: Array<[string, number]> = [
        ['ARMOR', h.statArmor],
        ['POWER', h.statPower],
        ['SPEED', h.statSpeed],
        ['MAGIC', h.statMagic],
      ];
      stats.forEach(([sLabel, val], si) => {
        const sy = cardY + 236 + si * 34;
        ctx.textAlign = 'left';
        ctx.fillStyle = '#94A3B8';
        ctx.font = '700 11px "JetBrains Mono", monospace';
        ctx.fillText(sLabel, cx + 22, sy);
        for (let b = 0; b < 5; b++) {
          ctx.fillStyle = b < val ? col.primary : 'rgba(255,255,255,0.1)';
          ctx.beginPath();
          ctx.roundRect(cx + 84 + b * 26, sy - 10, 21, 12, 3);
          ctx.fill();
        }
      });
    });

    // Gauntlet II: Interactive 4-Color Selector Row (RED / BLUE / YELLOW / GREEN)
    if (this.isSequel) {
      const colW = 132;
      const colGap = 16;
      const cStart = (VIEW_W - (colW * 4 + colGap * 3)) * 0.5;
      CABINET_COLORS.forEach((c, ci) => {
        const active = ci === this.colorIdx;
        const bx = cStart + ci * (colW + colGap);
        ctx.fillStyle = active ? c.primary : 'rgba(255,255,255,0.06)';
        ctx.beginPath();
        ctx.roundRect(bx, 574, colW, 42, 8);
        ctx.fill();
        ctx.strokeStyle = c.primary;
        ctx.lineWidth = active ? 2.5 : 1.2;
        ctx.stroke();
        ctx.fillStyle = active && c.id === 'yellow' ? '#0F172A' : '#FFFFFF';
        ctx.font = '900 13px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(c.label, bx + colW * 0.5, 600);
      });
    }

    // Confirm CTA Button
    const activeCol = this.getColor();
    ctx.fillStyle = activeCol.primary;
    ctx.beginPath();
    ctx.roundRect(VIEW_W * 0.5 - 190, 646, 380, 56, 12);
    ctx.fill();
    ctx.fillStyle = activeCol.id === 'yellow' ? '#0F172A' : '#FFFFFF';
    ctx.font = '900 18px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`ENTER DUNGEON AS ${this.getFullHeroTitle()}`, VIEW_W * 0.5, 680);
  }
}

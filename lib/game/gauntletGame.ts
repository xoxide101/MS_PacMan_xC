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

const VIEW_W = 864;
const VIEW_H = 640;
const TILE = 40;
const MAP_COLS = 30;
const MAP_ROWS = 22;

const FLOOR = 0;
const WALL = 1;
const DOOR = 2;
const EXIT = 3;
const ACID = 4; // Gauntlet II hazard

type HeroClassId = 'warrior' | 'valkyrie' | 'wizard' | 'elf';

interface HeroClassSpec {
  id: HeroClassId;
  name: string;
  color: string;
  accent: string;
  speed: number;
  shotSpeed: number;
  shotDamage: number;
  armor: number; // multiplier on incoming damage
  magicPower: number;
}

const HERO_CLASSES: HeroClassSpec[] = [
  { id: 'warrior', name: 'Warrior', color: '#3B82F6', accent: '#93C5FD', speed: 205, shotSpeed: 460, shotDamage: 2, armor: 0.72, magicPower: 1 },
  { id: 'valkyrie', name: 'Valkyrie', color: '#EC4899', accent: '#F9A8D4', speed: 225, shotSpeed: 500, shotDamage: 1.6, armor: 0.65, magicPower: 1.3 },
  { id: 'wizard', name: 'Wizard', color: '#FACC15', accent: '#FEF08A', speed: 215, shotSpeed: 520, shotDamage: 1.8, armor: 1.0, magicPower: 2.2 },
  { id: 'elf', name: 'Elf', color: '#22C55E', accent: '#86EFAC', speed: 265, shotSpeed: 560, shotDamage: 1.4, armor: 0.9, magicPower: 1.5 },
];

type PickupKind = 'food' | 'key' | 'potion' | 'treasure' | 'ricochet';
interface Pickup {
  x: number;
  y: number;
  kind: PickupKind;
}

interface Generator {
  x: number;
  y: number;
  hp: number;
  kind: 'ghost' | 'grunt' | 'demon';
  timer: number;
}

interface Monster {
  kind: 'ghost' | 'grunt' | 'demon' | 'death' | 'dragon';
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  fireTimer: number;
  anim: number;
}

interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fromPlayer: boolean;
  damage: number;
  bounces: number;
  color: string;
}

function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export class GauntletGame implements ArcadeGameInstance {
  public readonly logicalWidth = VIEW_W;
  public readonly logicalHeight = VIEW_H;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'Attack';
  public readonly secondaryActionLabel = 'Potion';

  private readonly isSequel: boolean;
  private readonly storageKey: string;

  private phase: ClassicGamePhase = 'TITLE';
  private score = 0;
  private highScore = 0;
  private level = 1;
  private heroIdx = 0;
  private health = 700;
  private keys = 1;
  private potions = 2;
  private ricochetActive = false;
  private phaseTimer = 0;
  private time = 0;
  private bannerText = '';
  private alertText = '';
  private alertTimer = 0;

  private input: ArcadeInputState = createEmptyInput();
  private grid: number[][] = [];
  private playerX = TILE * 2.5;
  private playerY = TILE * 2.5;
  private aimX = 1;
  private aimY = 0;
  private fireCooldown = 0;
  private potionFlash = 0;
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
    this.storageKey = this.isSequel ? 'gauntlet2_hd_highscore_v1' : 'gauntlet_hd_highscore_v1';
    this.highScore = readHighScore(this.storageKey);
    this.buildDungeon(1);
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public startNewGame(): void {
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.level = 1;
    this.health = 700;
    this.keys = 1;
    this.potions = 2;
    this.ricochetActive = this.isSequel;
    this.particles = [];
    this.popups = [];
    this.buildDungeon(1);
    this.phase = 'READY';
    this.phaseTimer = 1.1;
    this.bannerText = `${this.getHero().name.toUpperCase()} · FLOOR 1`;
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.level = 1;
    this.buildDungeon(1);
  }

  // Pressing R cycles hero class!
  public restartStage(): void {
    this.heroIdx = (this.heroIdx + 1) % HERO_CLASSES.length;
    const h = this.getHero();
    this.showAlert(`HERO SWITCHED: ${h.name.toUpperCase()}`);
  }

  private getHero(): HeroClassSpec {
    return HERO_CLASSES[this.heroIdx];
  }

  public getHudSnapshot(): ClassicGameHud {
    const hero = this.getHero();
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: Math.max(0, Math.min(6, Math.ceil(this.health / 150))),
      stageName: `${hero.name} · Dungeon ${this.level}`,
      primaryMetricLabel: 'Health',
      primaryMetricValue: `${Math.max(0, Math.ceil(this.health))} HP`,
      secondaryMetricLabel: 'Keys / Potions',
      secondaryMetricValue: `${this.keys}K · ${this.potions}P`,
      bannerText: this.bannerText || this.alertText,
      canRestartStage: true,
    };
  }

  private showAlert(text: string): void {
    this.alertText = text;
    this.alertTimer = 2.0;
  }

  private addScore(pts: number, x?: number, y?: number, color = '#FDE047'): void {
    if (this.phase === 'TITLE') return;
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(this.storageKey, this.highScore);
    }
    if (x !== undefined && y !== undefined && pts >= 20) {
      this.popups.push({ x: x - this.camX, y: y - this.camY, text: `+${pts}`, color, life: 0.85, maxLife: 0.85 });
    }
  }

  private buildDungeon(floor: number): void {
    const rand = seededRand((this.isSequel ? 777 : 333) + floor * 97);
    this.grid = Array.from({ length: MAP_ROWS }, (_, r) =>
      Array.from({ length: MAP_COLS }, (_, c) =>
        r === 0 || r === MAP_ROWS - 1 || c === 0 || c === MAP_COLS - 1 ? WALL : FLOOR
      )
    );

    // Build interconnected stone chambers with doorways
    for (let r = 4; r < MAP_ROWS - 3; r += 5) {
      for (let c = 1; c < MAP_COLS - 1; c++) {
        if (c % 7 === 3 || c % 7 === 4) continue;
        this.grid[r][c] = WALL;
      }
      // Locked vault door on one corridor
      const doorC = 3 + Math.floor(rand() * 3) * 7;
      if (doorC < MAP_COLS - 2) {
        this.grid[r][doorC] = DOOR;
        this.grid[r][doorC + 1] = DOOR;
      }
    }
    for (let c = 7; c < MAP_COLS - 3; c += 7) {
      for (let r = 1; r < MAP_ROWS - 1; r++) {
        if (r % 5 === 2) continue;
        if (rand() < 0.72) this.grid[r][c] = WALL;
      }
    }

    // Gauntlet II signature acid puddles
    if (this.isSequel) {
      for (let i = 0; i < 8 + floor; i++) {
        const r = 2 + Math.floor(rand() * (MAP_ROWS - 4));
        const c = 4 + Math.floor(rand() * (MAP_COLS - 6));
        if (this.grid[r][c] === FLOOR) this.grid[r][c] = ACID;
      }
    }

    this.playerX = TILE * 2.5;
    this.playerY = TILE * 2.5;
    this.grid[2][2] = FLOOR;
    this.grid[2][3] = FLOOR;
    this.grid[3][2] = FLOOR;

    // Exit portal at bottom-right vault
    this.grid[MAP_ROWS - 3][MAP_COLS - 3] = EXIT;
    this.grid[MAP_ROWS - 3][MAP_COLS - 4] = FLOOR;
    this.grid[MAP_ROWS - 4][MAP_COLS - 3] = FLOOR;

    this.pickups = [];
    this.generators = [];
    this.monsters = [];
    this.projectiles = [];

    const findOpenTile = (minDist = 4): [number, number] => {
      for (let t = 0; t < 80; t++) {
        const r = 1 + Math.floor(rand() * (MAP_ROWS - 2));
        const c = 1 + Math.floor(rand() * (MAP_COLS - 2));
        if (this.grid[r][c] !== FLOOR) continue;
        if (Math.hypot(c - 2, r - 2) < minDist) continue;
        return [c * TILE + TILE * 0.5, r * TILE + TILE * 0.5];
      }
      return [TILE * 10.5, TILE * 10.5];
    };

    // Place Food, Keys, Potions, Treasure
    const counts: Array<[PickupKind, number]> = [
      ['food', 6],
      ['key', 5],
      ['potion', 3],
      ['treasure', 10],
    ];
    if (this.isSequel) counts.push(['ricochet', 2]);
    for (const [kind, n] of counts) {
      for (let i = 0; i < n; i++) {
        const [x, y] = findOpenTile(3);
        this.pickups.push({ x, y, kind });
      }
    }

    // Place Monster Generators
    const genKinds: Array<'ghost' | 'grunt' | 'demon'> = ['ghost', 'grunt', 'demon'];
    for (let i = 0; i < 6 + Math.min(5, floor); i++) {
      const [x, y] = findOpenTile(5);
      this.generators.push({
        x,
        y,
        hp: 4,
        kind: genKinds[i % genKinds.length],
        timer: 1.2 + rand() * 2.5,
      });
    }

    // Spawn initial patrols + Death (floor >= 2) + Gauntlet II Fire Dragon!
    for (let i = 0; i < 8 + floor * 2; i++) {
      const [x, y] = findOpenTile(6);
      const kind = genKinds[i % genKinds.length];
      this.monsters.push({
        kind,
        x,
        y,
        hp: kind === 'demon' ? 3 : kind === 'grunt' ? 2 : 1,
        maxHp: kind === 'demon' ? 3 : kind === 'grunt' ? 2 : 1,
        speed: kind === 'ghost' ? 115 : kind === 'grunt' ? 96 : 86,
        fireTimer: 1.5 + rand() * 2,
        anim: rand() * 6,
      });
    }

    if (floor >= 2 || this.isSequel) {
      const [dx, dy] = findOpenTile(10);
      this.monsters.push({
        kind: 'death',
        x: dx,
        y: dy,
        hp: 999,
        maxHp: 999,
        speed: 122,
        fireTimer: 99,
        anim: 0,
      });
    }

    if (this.isSequel) {
      const [bx, by] = [TILE * (MAP_COLS - 6.5), TILE * (MAP_ROWS - 5.5)];
      this.monsters.push({
        kind: 'dragon',
        x: bx,
        y: by,
        hp: 14,
        maxHp: 14,
        speed: 78,
        fireTimer: 1.4,
        anim: 0,
      });
    }

    this.centerCamera(true);
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
    if (this.potionFlash > 0) this.potionFlash = Math.max(0, this.potionFlash - dt);
    if (this.alertTimer > 0) {
      this.alertTimer -= dt;
      if (this.alertTimer <= 0) this.alertText = '';
    }

    if (this.phase === 'PAUSED' || this.phase === 'GAME_OVER') return;

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
        this.level += 1;
        this.buildDungeon(this.level);
        this.phase = 'READY';
        this.phaseTimer = 1.05;
        this.bannerText = `${this.getHero().name.toUpperCase()} · FLOOR ${this.level}`;
      }
      return;
    }

    const isAttract = this.phase === 'TITLE';

    if (!isAttract) {
      // Classic Gauntlet health drain!
      const prevH = this.health;
      this.health -= 2.2 * dt;
      if (prevH >= 200 && this.health < 200) {
        this.showAlert(`${this.getHero().name.toUpperCase()} NEEDS FOOD BADLY!`);
      }
      if (this.health <= 0) {
        this.health = 0;
        arcadeAudio.playDeath();
        this.phase = 'GAME_OVER';
        this.bannerText = 'GAME OVER';
        return;
      }
    }

    this.updatePlayer(dt, isAttract);
    this.updateGenerators(dt);
    this.updateMonsters(dt, isAttract);
    this.updateProjectiles(dt, isAttract);
    this.centerCamera(false);
  }

  private isSolid(x: number, y: number, canUnlockDoor: boolean): boolean {
    const c = Math.floor(x / TILE);
    const r = Math.floor(y / TILE);
    const cell = this.grid[r]?.[c];
    if (cell === undefined || cell === WALL) return true;
    if (cell === DOOR) {
      if (canUnlockDoor && this.keys > 0) {
        this.keys -= 1;
        this.unlockConnectedDoors(r, c);
        if (this.phase !== 'TITLE') arcadeAudio.playKeyUnlock();
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
      if (this.grid[r]?.[c] !== DOOR) continue;
      this.grid[r][c] = FLOOR;
      spawnBurst(this.particles, c * TILE + 20 - this.camX, r * TILE + 20 - this.camY, '#FACC15', 8, 120, 3);
      queue.push([r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]);
    }
  }

  private usePotion(isAttract: boolean): void {
    if (this.potions <= 0) return;
    this.potions -= 1;
    this.potionFlash = 0.45;
    if (!isAttract) arcadeAudio.playPotionBlast();
    const hero = this.getHero();
    let cleared = 0;
    for (let i = this.monsters.length - 1; i >= 0; i--) {
      const m = this.monsters[i];
      if (Math.hypot(m.x - this.playerX, m.y - this.playerY) < 460) {
        const pts = m.kind === 'death' ? 2000 : m.kind === 'dragon' ? 1500 : 100;
        if (m.kind === 'dragon' && hero.magicPower < 2) {
          m.hp -= 6;
          if (m.hp > 0) continue;
        }
        this.monsters.splice(i, 1);
        spawnBurst(this.particles, m.x - this.camX, m.y - this.camY, '#38BDF8', 14, 200, 3.5);
        this.addScore(pts, m.x, m.y, '#38BDF8');
        cleared++;
      }
    }
    if (cleared > 0) this.showAlert(`MAGIC POTION BLAST! (${cleared} VANQUISHED)`);
  }

  private updatePlayer(dt: number, isAttract: boolean): void {
    if (this.fireCooldown > 0) this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    const hero = this.getHero();

    let mx = 0;
    let my = 0;

    if (isAttract) {
      // Attract hero roams toward exit while blasting nearby monsters
      const target = this.monsters[0]
        ? { x: this.monsters[0].x, y: this.monsters[0].y }
        : { x: (MAP_COLS - 3) * TILE, y: (MAP_ROWS - 3) * TILE };
      const dx = target.x - this.playerX;
      const dy = target.y - this.playerY;
      const dist = Math.hypot(dx, dy) || 1;
      this.aimX = dx / dist;
      this.aimY = dy / dist;
      mx = dist > 150 ? this.aimX : -this.aimX * 0.4;
      my = dist > 150 ? this.aimY : -this.aimY * 0.4;
      if (this.fireCooldown <= 0) {
        this.spawnPlayerShot(hero, true);
      }
    } else {
      mx = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
      my = (this.input.down ? 1 : 0) - (this.input.up ? 1 : 0);
      if (mx !== 0 || my !== 0) {
        const len = Math.hypot(mx, my);
        mx /= len;
        my /= len;
        this.aimX = mx;
        this.aimY = my;
      }

      if (this.input.secondaryJustPressed) {
        this.usePotion(false);
      }

      if ((this.input.fire || this.input.fireJustPressed) && this.fireCooldown <= 0) {
        this.spawnPlayerShot(hero, false);
      }
    }

    const r = 13;
    const nx = this.playerX + mx * hero.speed * dt;
    const ny = this.playerY + my * hero.speed * dt;
    if (!this.isSolid(nx - r, this.playerY - r, true) && !this.isSolid(nx + r, this.playerY + r, true) && !this.isSolid(nx + r, this.playerY - r, true) && !this.isSolid(nx - r, this.playerY + r, true)) {
      this.playerX = nx;
    }
    if (!this.isSolid(this.playerX - r, ny - r, true) && !this.isSolid(this.playerX + r, ny + r, true) && !this.isSolid(this.playerX + r, ny - r, true) && !this.isSolid(this.playerX - r, ny + r, true)) {
      this.playerY = ny;
    }

    // Tile interactions
    const pc = Math.floor(this.playerX / TILE);
    const pr = Math.floor(this.playerY / TILE);
    const curCell = this.grid[pr]?.[pc];
    if (curCell === ACID && !isAttract) {
      this.health -= 24 * hero.armor * dt;
    } else if (curCell === EXIT) {
      if (isAttract) {
        this.buildDungeon(1);
      } else {
        arcadeAudio.playStageClear();
        this.addScore(500, this.playerX, this.playerY, '#4ADE80');
        this.phase = 'STAGE_CLEAR';
        this.phaseTimer = 1.25;
        this.bannerText = `FLOOR ${this.level} ESCAPED!`;
      }
      return;
    }

    // Collect pickups
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      if (Math.hypot(p.x - this.playerX, p.y - this.playerY) < 26) {
        this.pickups.splice(i, 1);
        if (p.kind === 'food') {
          this.health = Math.min(999, this.health + 120);
          if (!isAttract) arcadeAudio.playEatFruit();
          this.popups.push({ x: p.x - this.camX, y: p.y - this.camY, text: '+120 HP', color: '#4ADE80', life: 0.9, maxLife: 0.9 });
        } else if (p.kind === 'key') {
          this.keys += 1;
          if (!isAttract) arcadeAudio.playKeyUnlock();
          this.addScore(100, p.x, p.y, '#FACC15');
        } else if (p.kind === 'potion') {
          this.potions = Math.min(9, this.potions + 1);
          if (!isAttract) arcadeAudio.playKeyUnlock();
          this.addScore(150, p.x, p.y, '#38BDF8');
        } else if (p.kind === 'ricochet') {
          this.ricochetActive = true;
          this.showAlert('REFLECTIVE SHOTS ACTIVATED!');
          if (!isAttract) arcadeAudio.playPowerPellet();
        } else {
          if (!isAttract) arcadeAudio.playDiamond();
          this.addScore(250, p.x, p.y, '#FDE047');
        }
      }
    }
  }

  private spawnPlayerShot(hero: HeroClassSpec, isAttract: boolean): void {
    this.fireCooldown = 0.16;
    this.projectiles.push({
      x: this.playerX + this.aimX * 16,
      y: this.playerY + this.aimY * 16,
      vx: this.aimX * hero.shotSpeed,
      vy: this.aimY * hero.shotSpeed,
      fromPlayer: true,
      damage: hero.shotDamage,
      bounces: this.ricochetActive ? 2 : 0,
      color: hero.accent,
    });
    if (!isAttract) arcadeAudio.playLaser(760);
  }

  private updateGenerators(dt: number): void {
    for (const g of this.generators) {
      g.timer -= dt;
      if (g.timer <= 0 && this.monsters.length < 34) {
        g.timer = Math.max(2.2, 4.6 - this.level * 0.25);
        if (Math.hypot(g.x - this.playerX, g.y - this.playerY) < 520) {
          this.monsters.push({
            kind: g.kind,
            x: g.x + (Math.random() - 0.5) * 18,
            y: g.y + (Math.random() - 0.5) * 18,
            hp: g.kind === 'demon' ? 3 : g.kind === 'grunt' ? 2 : 1,
            maxHp: g.kind === 'demon' ? 3 : g.kind === 'grunt' ? 2 : 1,
            speed: g.kind === 'ghost' ? 115 : g.kind === 'grunt' ? 96 : 86,
            fireTimer: 1.8,
            anim: 0,
          });
        }
      }
    }
  }

  private updateMonsters(dt: number, isAttract: boolean): void {
    const hero = this.getHero();
    for (let i = this.monsters.length - 1; i >= 0; i--) {
      const m = this.monsters[i];
      m.anim += dt * 10;
      const dx = this.playerX - m.x;
      const dy = this.playerY - m.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist > 640) continue;

      const nx = m.x + (dx / dist) * m.speed * dt;
      const ny = m.y + (dy / dist) * m.speed * dt;
      if (!this.isSolid(nx, m.y, false)) m.x = nx;
      if (!this.isSolid(m.x, ny, false)) m.y = ny;

      // Demon & Dragon fireballs
      if ((m.kind === 'demon' || m.kind === 'dragon') && dist < 340) {
        m.fireTimer -= dt;
        if (m.fireTimer <= 0) {
          m.fireTimer = m.kind === 'dragon' ? 1.4 : 2.5;
          const spd = m.kind === 'dragon' ? 310 : 250;
          this.projectiles.push({
            x: m.x,
            y: m.y,
            vx: (dx / dist) * spd,
            vy: (dy / dist) * spd,
            fromPlayer: false,
            damage: m.kind === 'dragon' ? 24 : 14,
            bounces: 0,
            color: '#F97316',
          });
        }
      }

      // Melee contact damage
      const hitRad = m.kind === 'dragon' ? 32 : 22;
      if (dist < hitRad) {
        if (!isAttract) {
          const dps = m.kind === 'death' ? 95 : m.kind === 'dragon' ? 50 : 32;
          this.health -= dps * hero.armor * dt;
        }
        if (m.kind === 'ghost') {
          // Ghosts vaporize on contact after hitting you
          this.monsters.splice(i, 1);
          spawnBurst(this.particles, m.x - this.camX, m.y - this.camY, '#E2E8F0', 10, 140, 2.5);
        }
      }
    }
  }

  private updateProjectiles(dt: number, isAttract: boolean): void {
    const hero = this.getHero();
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const nx = p.x + p.vx * dt;
      const ny = p.y + p.vy * dt;

      if (this.isSolid(nx, ny, false)) {
        if (p.bounces > 0) {
          p.bounces -= 1;
          if (this.isSolid(nx, p.y, false)) p.vx = -p.vx;
          if (this.isSolid(p.x, ny, false)) p.vy = -p.vy;
        } else {
          this.projectiles.splice(i, 1);
        }
        continue;
      }
      p.x = nx;
      p.y = ny;

      if (p.fromPlayer) {
        let hit = false;
        // Hit generators
        for (let gi = this.generators.length - 1; gi >= 0; gi--) {
          const g = this.generators[gi];
          if (Math.hypot(p.x - g.x, p.y - g.y) < 22) {
            g.hp -= p.damage;
            hit = true;
            if (g.hp <= 0) {
              this.generators.splice(gi, 1);
              if (!isAttract) arcadeAudio.playExplosion(false);
              spawnBurst(this.particles, g.x - this.camX, g.y - this.camY, '#F59E0B', 14, 180, 3);
              this.addScore(150, g.x, g.y, '#F59E0B');
            }
            break;
          }
        }
        // Hit monsters
        if (!hit) {
          for (let mi = this.monsters.length - 1; mi >= 0; mi--) {
            const m = this.monsters[mi];
            const rad = m.kind === 'dragon' ? 30 : 20;
            if (Math.hypot(p.x - m.x, p.y - m.y) < rad) {
              hit = true;
              if (m.kind === 'death') {
                spawnBurst(this.particles, p.x - this.camX, p.y - this.camY, '#94A3B8', 5, 90, 2);
                break;
              }
              m.hp -= p.damage;
              if (m.hp <= 0) {
                this.monsters.splice(mi, 1);
                if (!isAttract) arcadeAudio.playExplosion(m.kind === 'dragon');
                spawnBurst(this.particles, m.x - this.camX, m.y - this.camY, '#EF4444', m.kind === 'dragon' ? 28 : 12, 190, 3.5);
                const pts = m.kind === 'dragon' ? 2500 : m.kind === 'demon' ? 80 : m.kind === 'grunt' ? 40 : 20;
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
            this.health -= p.damage * hero.armor;
            arcadeAudio.playSplat();
          }
          this.projectiles.splice(i, 1);
        }
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = this.potionFlash > 0 ? '#1E3A8A' : '#090B12';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    ctx.save();
    ctx.translate(-Math.round(this.camX), -Math.round(this.camY));

    const minC = Math.max(0, Math.floor(this.camX / TILE));
    const maxC = Math.min(MAP_COLS - 1, Math.ceil((this.camX + VIEW_W) / TILE));
    const minR = Math.max(0, Math.floor(this.camY / TILE));
    const maxR = Math.min(MAP_ROWS - 1, Math.ceil((this.camY + VIEW_H) / TILE));

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const x = c * TILE;
        const y = r * TILE;
        const cell = this.grid[r][c];
        if (cell === WALL) {
          // Chiseled beveled dungeon masonry blocks
          const wg = ctx.createLinearGradient(x, y, x + TILE, y + TILE);
          if (this.isSequel) {
            wg.addColorStop(0, '#881337');
            wg.addColorStop(0.5, '#4C1D24');
            wg.addColorStop(1, '#2D0D14');
          } else {
            wg.addColorStop(0, '#64748B');
            wg.addColorStop(0.5, '#334155');
            wg.addColorStop(1, '#1E293B');
          }
          ctx.fillStyle = wg;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = 'rgba(255,255,255,0.16)';
          ctx.fillRect(x + 1, y + 1, TILE - 2, 3);
          ctx.fillRect(x + 1, y + 1, 3, TILE - 2);
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.fillRect(x + 1, y + TILE - 3, TILE - 2, 3);
          ctx.strokeStyle = 'rgba(0,0,0,0.45)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE * 0.5 - 1);
          ctx.strokeRect(x + 1, y + TILE * 0.5, TILE - 2, TILE * 0.5 - 1);
        } else if (cell === DOOR) {
          // Iron-banded timber vault door with golden keyhole
          ctx.fillStyle = '#78350F';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = '#92400E';
          ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
          ctx.fillStyle = '#475569';
          ctx.fillRect(x + 2, y + 8, TILE - 4, 4);
          ctx.fillRect(x + 2, y + TILE - 12, TILE - 4, 4);
          ctx.strokeStyle = '#FACC15';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
          ctx.fillStyle = '#FDE047';
          ctx.beginPath();
          ctx.arc(x + TILE * 0.5, y + TILE * 0.5 - 1, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#0F172A';
          ctx.fillRect(x + TILE * 0.5 - 1.5, y + TILE * 0.5 - 2, 3, 6);
        } else if (cell === EXIT) {
          // Glowing emerald spiral staircase portal
          ctx.save();
          ctx.shadowColor = '#4ADE80';
          ctx.shadowBlur = 12;
          ctx.fillStyle = '#064E3B';
          ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
          ctx.strokeStyle = '#4ADE80';
          ctx.lineWidth = 2.6;
          ctx.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
          ctx.fillStyle = '#10B981';
          for (let s = 0; s < 4; s++) {
            ctx.fillRect(x + 7, y + 8 + s * 6, TILE - 14, 3);
          }
          ctx.fillStyle = '#DCFCE7';
          ctx.font = '900 9px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('EXIT', x + TILE * 0.5, y + TILE * 0.5);
          ctx.restore();
        } else if (cell === ACID) {
          ctx.fillStyle = '#052E16';
          ctx.fillRect(x, y, TILE, TILE);
          const bub = Math.sin(this.time * 6 + r + c) * 2.5;
          ctx.fillStyle = '#22C55E';
          ctx.beginPath();
          ctx.ellipse(x + 20, y + 20, 15, 10 + bub * 0.6, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#BBF7D0';
          ctx.beginPath();
          ctx.arc(x + 15 + bub, y + 18, 3, 0, Math.PI * 2);
          ctx.arc(x + 25 - bub, y + 23, 2.2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Flagstone dungeon floor
          ctx.fillStyle = (r + c) % 2 === 0 ? '#141928' : '#101421';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.strokeStyle = 'rgba(255,255,255,0.03)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        }
      }
    }

    // Dungeon Pickups (Turkey Platter, Key, Glowing Potion, Ricochet Gem, Gold Chest)
    for (const p of this.pickups) {
      ctx.save();
      ctx.translate(p.x, p.y + Math.sin(this.time * 4 + p.x) * 1.5);
      if (p.kind === 'food') {
        // Roast Turkey / Ham platter
        ctx.fillStyle = '#94A3B8';
        ctx.beginPath();
        ctx.ellipse(0, 4, 15, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#D97706';
        ctx.beginPath();
        ctx.ellipse(-2, 1, 11.5, 7.5, -0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FDE68A';
        ctx.fillRect(8, -1, 7, 4);
        ctx.beginPath();
        ctx.arc(15, -1, 2.5, 0, Math.PI * 2);
        ctx.arc(15, 3, 2.5, 0, Math.PI * 2);
        ctx.fill();
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
        ctx.arc(0, 4, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7DD3FC';
        ctx.beginPath();
        ctx.arc(-2.5, 2, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#E0F2FE';
        ctx.fillRect(-3.5, -10, 7, 6);
        ctx.fillStyle = '#D97706';
        ctx.fillRect(-4, -12, 8, 3);
      } else if (p.kind === 'ricochet') {
        ctx.shadowColor = '#EC4899';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#EC4899';
        ctx.beginPath();
        ctx.moveTo(0, -11);
        ctx.lineTo(11, 0);
        ctx.lineTo(0, 11);
        ctx.lineTo(-11, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#FBCFE8';
        ctx.beginPath();
        ctx.moveTo(0, -5);
        ctx.lineTo(5, 0);
        ctx.lineTo(0, 5);
        ctx.lineTo(-5, 0);
        ctx.closePath();
        ctx.fill();
      } else {
        // Golden Treasure Chest
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
      }
      ctx.restore();
    }

    // Bone-pile & Archway Monster Generators
    for (const g of this.generators) {
      ctx.save();
      ctx.translate(g.x, g.y);
      const pulse = 0.8 + 0.2 * Math.sin(this.time * 6 + g.x);
      ctx.fillStyle = g.kind === 'ghost' ? '#94A3B8' : g.kind === 'grunt' ? '#78350F' : '#7F1D1D';
      ctx.beginPath();
      ctx.roundRect(-15, -15, 30, 30, 7);
      ctx.fill();
      ctx.strokeStyle = g.kind === 'ghost' ? '#E2E8F0' : '#FACC15';
      ctx.lineWidth = 2.2;
      ctx.stroke();
      // Skull / Bone emblem inside generator
      ctx.fillStyle = g.kind === 'ghost' ? '#FFFFFF' : g.kind === 'grunt' ? '#FDE68A' : '#FCA5A5';
      ctx.globalAlpha = pulse;
      ctx.beginPath();
      ctx.arc(0, -2, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(-3, -4, 2, 2.5);
      ctx.fillRect(1, -4, 2, 2.5);
      ctx.restore();
    }

    // Distinct Atari Gauntlet Monsters
    for (const m of this.monsters) {
      ctx.save();
      ctx.translate(m.x, m.y);
      const bob = Math.sin(this.time * 10 + m.x * 0.1) * 2;
      if (m.kind === 'dragon') {
        // Winged Fire Dragon (Gauntlet II Boss!)
        const wing = Math.sin(this.time * 10) * 6;
        ctx.fillStyle = '#991B1B';
        ctx.beginPath();
        ctx.moveTo(-14, 0);
        ctx.lineTo(-34, -18 + wing);
        ctx.lineTo(-26, 12 + wing * 0.5);
        ctx.closePath();
        ctx.moveTo(14, 0);
        ctx.lineTo(34, -18 + wing);
        ctx.lineTo(26, 12 + wing * 0.5);
        ctx.closePath();
        ctx.fill();
        const dg = ctx.createRadialGradient(-4, -6, 3, 0, 0, 26);
        dg.addColorStop(0, '#F87171');
        dg.addColorStop(0.5, '#DC2626');
        dg.addColorStop(1, '#450A0A');
        ctx.fillStyle = dg;
        ctx.beginPath();
        ctx.roundRect(-22, -18, 44, 36, 13);
        ctx.fill();
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.arc(-8, -6, 4.5, 0, Math.PI * 2);
        ctx.arc(8, -6, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-9, -7.5, 2, 3.5);
        ctx.fillRect(7, -7.5, 2, 3.5);
      } else if (m.kind === 'death') {
        // Hooded Skeletal Death with curved Scythe!
        ctx.shadowColor = '#EF4444';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.arc(0, 0, 15.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 2.2;
        ctx.stroke();
        // Curved silver scythe blade
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(12, 12);
        ctx.lineTo(12, -12);
        ctx.quadraticCurveTo(22, -16, 18, -4);
        ctx.stroke();
        // Glowing crimson eyes
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(-6, -4, 4, 4);
        ctx.fillRect(2, -4, 4, 4);
      } else if (m.kind === 'ghost') {
        // Ethereal waving white Ghost
        ctx.globalAlpha = 0.88;
        ctx.fillStyle = '#F1F5F9';
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
        // Tusked club-wielding brown Grunt
        ctx.fillStyle = '#92400E';
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(10, -10 + bob, 4.5, 16); // Club
        ctx.fillStyle = '#FEF3C7';
        ctx.fillRect(-5, 4, 2.5, 4);
        ctx.fillRect(2.5, 4, 2.5, 4);
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-5, -4, 3, 3);
        ctx.fillRect(2, -4, 3, 3);
      } else {
        // Horned Fire-Spitting Demon
        ctx.fillStyle = '#DC2626';
        ctx.beginPath();
        ctx.arc(0, 1, 13, 0, Math.PI * 2);
        ctx.fill();
        // Curved horns
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.moveTo(-9, -8);
        ctx.lineTo(-14, -17);
        ctx.lineTo(-3, -11);
        ctx.moveTo(9, -8);
        ctx.lineTo(14, -17);
        ctx.lineTo(3, -11);
        ctx.fill();
        ctx.fillStyle = '#FEF08A';
        ctx.fillRect(-5.5, -4, 3.5, 3);
        ctx.fillRect(2, -4, 3.5, 3);
      }
      ctx.restore();
    }

    // 4 Unmistakable Articulated Gauntlet Hero Classes (Warrior, Valkyrie, Wizard, Elf)
    const hero = this.getHero();
    const aimAngle = Math.atan2(this.aimY, this.aimX);
    ctx.save();
    ctx.translate(this.playerX, this.playerY);
    ctx.rotate(aimAngle);
    ctx.shadowColor = hero.color;
    ctx.shadowBlur = 12;

    if (hero.id === 'warrior') {
      // Thor the Warrior: Blue tunic, horned Viking helm, swinging battle-axe
      ctx.fillStyle = '#1D4ED8';
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#CBD5E1';
      ctx.beginPath();
      ctx.arc(0, 0, 8.5, 0, Math.PI * 2);
      ctx.fill();
      // Viking horns
      ctx.fillStyle = '#FEF3C7';
      ctx.beginPath();
      ctx.moveTo(-2, -8);
      ctx.lineTo(-6, -15);
      ctx.lineTo(4, -7);
      ctx.moveTo(-2, 8);
      ctx.lineTo(-6, 15);
      ctx.lineTo(4, 7);
      ctx.fill();
      // Battle-axe forward
      ctx.fillStyle = '#92400E';
      ctx.fillRect(4, -2, 13, 3.5);
      ctx.fillStyle = '#E2E8F0';
      ctx.beginPath();
      ctx.arc(15, 0, 6, -1.2, 1.2);
      ctx.fill();
    } else if (hero.id === 'valkyrie') {
      // Thyra the Valkyrie: Rose armor, winged helm, kite shield & sword
      ctx.fillStyle = '#DB2777';
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.ellipse(-2, -10, 6, 3, -0.4, 0, Math.PI * 2);
      ctx.ellipse(-2, 10, 6, 3, 0.4, 0, Math.PI * 2);
      ctx.fill();
      // Silver sword & kite shield
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(8, -8, 12, 2.8);
      ctx.fillStyle = '#F472B6';
      ctx.beginPath();
      ctx.ellipse(9, 7, 5, 7, 0.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (hero.id === 'wizard') {
      // Merlin the Wizard: Golden-blue robe, pointed star hat & glowing staff
      ctx.fillStyle = '#D97706';
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(-1, 0, 9.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(14, 0, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(14, 0, 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Questor the Elf: Emerald hooded cloak & drawn recurve bow
      ctx.fillStyle = '#15803D';
      ctx.beginPath();
      ctx.arc(0, 0, 12.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4ADE80';
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(5, -9);
      ctx.lineTo(5, 9);
      ctx.closePath();
      ctx.fill();
      // Drawn wooden bow
      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(6, 0, 11, -1.1, 1.1);
      ctx.stroke();
    }
    ctx.restore();

    // Projectiles (glowing class weapons / fireballs)
    for (const p of this.projectiles) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.atan2(p.vy, p.vx));
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 12;
      if (p.fromPlayer) {
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(-4, -4.5);
        ctx.lineTo(-2, 0);
        ctx.lineTo(-4, 4.5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(2, 0, 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(0, 0, 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.restore();
    renderParticlesAndPopups(ctx, this.particles, this.popups);

    if (this.alertText && this.phase === 'PLAYING') {
      ctx.save();
      ctx.font = '700 15px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(4, 6, 13, 0.85)';
      ctx.fillRect(VIEW_W * 0.2, 14, VIEW_W * 0.6, 30);
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(VIEW_W * 0.2, 14, VIEW_W * 0.6, 30);
      ctx.fillStyle = '#FACC15';
      ctx.fillText(this.alertText, VIEW_W * 0.5, 34);
      ctx.restore();
    }

    if (this.bannerText && (this.phase === 'READY' || this.phase === 'STAGE_CLEAR')) {
      ctx.save();
      ctx.font = '800 28px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(4, 6, 13, 0.86)';
      ctx.fillRect(VIEW_W * 0.18, VIEW_H * 0.42, VIEW_W * 0.64, 56);
      ctx.strokeStyle = this.isSequel ? '#FB7185' : '#FACC15';
      ctx.lineWidth = 2;
      ctx.strokeRect(VIEW_W * 0.18, VIEW_H * 0.42, VIEW_W * 0.64, 56);
      ctx.fillStyle = this.isSequel ? '#FB7185' : '#FACC15';
      ctx.fillText(this.bannerText, VIEW_W * 0.5, VIEW_H * 0.42 + 28);
      ctx.restore();
    }

    if (visualMode === 'crt') renderCrtOverlay(ctx, VIEW_W, VIEW_H);
  }
}

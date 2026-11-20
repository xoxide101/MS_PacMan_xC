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
import { arcadeAudio } from './audio';

// ============================================================================
// 1. YS BOOK I & II (1987/1989 Falcom — Off-Center Bump Combat, Pillars, Stand-Still Heal & Bosses!)
// ============================================================================
interface YsEnemy {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  kind: 'slime' | 'knight' | 'bat' | 'darkfact';
  invuln: number;
  fireCd: number;
  splitTimer?: number;
  color: string;
}

export class YsBookArcadeGame implements ArcadeGameInstance {
  public readonly logicalWidth = 720;
  public readonly logicalHeight = 560;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'Fireball Magic (Ys II)';
  public readonly secondaryActionLabel = 'Dash Charge';

  private readonly variant: 'ys1' | 'ys2';
  private storageKey = 'ysbook12_hd_highscore_v2';
  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();

  private score = 0;
  private highScore = 0;
  private floor = 1; // Floors 1-2: Darm Tower (Ys I), Floor 3: Vagullion Boss, Floor 4: Shrine of Solomon (Ys II), Floor 5: Dark Fact!
  private clock = 0;
  private stateTimer = 0;

  private px = 360;
  private py = 465;
  private lastDirX = 0;
  private lastDirY = -1;
  private hp = 100;
  private maxHp = 100;
  private mp = 50;
  private maxMp = 50;
  private gold = 0;
  private xp = 0;
  private heroLevel = 1;
  private swordTier = 0; // 0 Short Sword, 1 Long Sword, 2 Talwar, 3 Silver Sword!
  private idleHealTimer = 0;
  private invulnTimer = 0;
  private fireCd = 0;

  private pillars: Array<{ x: number; y: number; w: number; h: number }> = [];
  private brokenTiles: Array<{ x: number; y: number }> = [];
  private enemies: YsEnemy[] = [];
  private shots: Array<{ x: number; y: number; vx: number; vy: number; fromPlayer: boolean }> = [];
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  constructor(variant: 'ys1' | 'ys2' = 'ys1') {
    this.variant = variant;
    this.storageKey = `${variant}_hd_highscore_v2`;
    this.highScore = readHighScore(this.storageKey);
    const startFloor = this.variant === 'ys2' ? 4 : 1;
    this.floor = startFloor;
    this.setupFloor(startFloor);
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public startNewGame(): void {
    arcadeAudio.playArcadeStart();
    const startFloor = this.variant === 'ys2' ? 4 : 1;
    this.score = 0;
    this.floor = startFloor;
    this.heroLevel = this.variant === 'ys2' ? 3 : 1;
    this.xp = 0;
    this.gold = 0;
    this.swordTier = this.variant === 'ys2' ? 1 : 0;
    this.maxHp = this.variant === 'ys2' ? 130 : 100;
    this.hp = this.maxHp;
    this.maxMp = this.variant === 'ys2' ? 90 : 50;
    this.mp = this.maxMp;
    this.phase = 'READY';
    this.stateTimer = 0.85;
    this.setupFloor(startFloor);
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    const startFloor = this.variant === 'ys2' ? 4 : 1;
    this.floor = startFloor;
    this.setupFloor(startFloor);
  }

  private setupFloor(fl: number): void {
    this.px = 360;
    this.py = 472;
    this.invulnTimer = 1.0;
    this.shots = [];
    this.brokenTiles = [];
    this.enemies = [];

    // Stone Darm Tower / Solomon Shrine architectural pillars!
    this.pillars =
      fl % 5 === 0
        ? []
        : [
            { x: 170, y: 150, w: 56, h: 56 },
            { x: 494, y: 150, w: 56, h: 56 },
            { x: 170, y: 345, w: 56, h: 56 },
            { x: 494, y: 345, w: 56, h: 56 },
          ];

    if (fl % 5 === 3) {
      // Iconic Boss: VAGULLION (splitting bat swarm that reforms into vulnerable vampire!)
      this.enemies.push({
        x: 360,
        y: 190,
        vx: 140,
        vy: 90,
        hp: 16 + fl * 2,
        maxHp: 16 + fl * 2,
        kind: 'bat',
        invuln: 0,
        fireCd: 1.4,
        splitTimer: 3.0,
        color: '#A855F7',
      });
    } else if (fl % 5 === 0) {
      // Iconic Final Boss: DARK FACT (blasts floor holes while zooming across Darm Tower summit!)
      this.enemies.push({
        x: 360,
        y: 160,
        vx: 195,
        vy: 145,
        hp: 22 + fl * 2,
        maxHp: 22 + fl * 2,
        kind: 'darkfact',
        invuln: 0,
        fireCd: 1.0,
        color: '#EF4444',
      });
    } else {
      const count = 4 + Math.min(6, fl);
      for (let i = 0; i < count; i++) {
        this.enemies.push({
          x: 110 + ((i * 115) % 500),
          y: 110 + (i % 3) * 85,
          vx: (i % 2 === 0 ? 1 : -1) * (68 + fl * 7),
          vy: (i % 3 === 0 ? 1 : -1) * (54 + fl * 5),
          hp: 2 + Math.floor(fl / 2),
          maxHp: 2 + Math.floor(fl / 2),
          kind: i % 2 === 0 ? 'knight' : 'slime',
          invuln: 0,
          fireCd: 2.4 + Math.random(),
          color: i % 2 === 0 ? '#38BDF8' : '#22C55E',
        });
      }
    }
  }

  private hitsPillar(x: number, y: number, r: number): boolean {
    for (const p of this.pillars) {
      if (x + r > p.x && x - r < p.x + p.w && y + r > p.y && y - r < p.y + p.h) return true;
    }
    return false;
  }

  public step(dt: number): void {
    this.clock += dt;
    stepParticlesAndPopups(this.particles, this.popups, dt);
    if (this.phase === 'PAUSED' || this.phase === 'GAME_OVER') return;
    if (this.phase === 'READY') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) this.phase = 'PLAYING';
      return;
    }
    if (this.phase === 'STAGE_CLEAR') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.floor += 1;
        this.hp = Math.min(this.maxHp, this.hp + 25);
        this.phase = 'READY';
        this.stateTimer = 0.85;
        this.setupFloor(this.floor);
      }
      return;
    }

    const attract = this.phase === 'TITLE';
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    this.fireCd = Math.max(0, this.fireCd - dt);
    this.mp = Math.min(this.maxMp, this.mp + dt * 5.5);

    let dx = 0;
    let dy = 0;
    if (attract) {
      dx = Math.cos(this.clock * 1.4);
      dy = Math.sin(this.clock * 1.1);
    } else {
      if (this.input.left) dx -= 1;
      if (this.input.right) dx += 1;
      if (this.input.up) dy -= 1;
      if (this.input.down) dy += 1;
    }

    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      this.lastDirX = dx / len;
      this.lastDirY = dy / len;
      this.idleHealTimer = 0;
      const spd = (this.input.secondary ? 285 : 225) + this.swordTier * 10;
      const nx = Math.max(46, Math.min(this.logicalWidth - 46, this.px + this.lastDirX * spd * dt));
      const ny = Math.max(54, Math.min(this.logicalHeight - 46, this.py + this.lastDirY * spd * dt));
      if (!this.hitsPillar(nx, this.py, 15)) this.px = nx;
      if (!this.hitsPillar(this.px, ny, 15)) this.py = ny;
    } else if (!attract) {
      // Authentic Ys Stand-Still HP Regeneration!
      this.idleHealTimer += dt;
      if (this.idleHealTimer > 0.85 && this.hp < this.maxHp) {
        this.hp = Math.min(this.maxHp, this.hp + dt * 11);
      }
    }

    // Ys II Fireball Magic!
    if (!attract && this.input.fireJustPressed && this.fireCd <= 0 && this.mp >= 10) {
      this.mp -= 10;
      this.fireCd = 0.25;
      this.shots.push({
        x: this.px + this.lastDirX * 18,
        y: this.py + this.lastDirY * 18,
        vx: this.lastDirX * 480,
        vy: this.lastDirY * 480,
        fromPlayer: true,
      });
      arcadeAudio.playLaser();
    }

    // Check Dark Fact broken floor holes!
    for (const h of this.brokenTiles) {
      if (!attract && this.invulnTimer <= 0 && Math.hypot(h.x - this.px, h.y - this.py) < 20) {
        this.hp -= 12;
        this.invulnTimer = 0.8;
        arcadeAudio.playRockThud();
      }
    }

    // Update Shots
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.x < 24 || s.x > this.logicalWidth - 24 || s.y < 24 || s.y > this.logicalHeight - 24 || this.hitsPillar(s.x, s.y, 4)) {
        this.shots.splice(i, 1);
        continue;
      }
      if (!s.fromPlayer) {
        if (!attract && this.invulnTimer <= 0 && Math.hypot(s.x - this.px, s.y - this.py) < 18) {
          this.hp -= 14;
          this.invulnTimer = 0.7;
          arcadeAudio.playRockThud();
          this.shots.splice(i, 1);
          if (this.hp <= 0) {
            arcadeAudio.playDeath();
            this.phase = 'GAME_OVER';
            return;
          }
        }
        continue;
      }
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (Math.hypot(e.x - s.x, e.y - s.y) < 24) {
          this.shots.splice(i, 1);
          this.damageEnemy(j, 2 + this.swordTier);
          break;
        }
      }
    }

    // Update Enemies & AUTHENTIC YS OFF-CENTER BUMP COMBAT!
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.invuln = Math.max(0, e.invuln - dt);

      const nx = e.x + e.vx * dt;
      const ny = e.y + e.vy * dt;
      if (nx < 54 || nx > this.logicalWidth - 54 || this.hitsPillar(nx, e.y, 16)) e.vx = -e.vx;
      else e.x = nx;
      if (ny < 64 || ny > this.logicalHeight - 54 || this.hitsPillar(e.x, ny, 16)) e.vy = -e.vy;
      else e.y = ny;

      if (e.kind === 'darkfact') {
        e.fireCd -= dt;
        if (e.fireCd <= 0 && !attract) {
          e.fireCd = 1.25;
          const ang = Math.atan2(this.py - e.y, this.px - e.x);
          this.shots.push({ x: e.x, y: e.y, vx: Math.cos(ang) * 240, vy: Math.sin(ang) * 240, fromPlayer: false });
          if (this.brokenTiles.length < 14) this.brokenTiles.push({ x: e.x, y: e.y });
        }
      }

      // Authentic Ys Bump-Combat Check!
      const dist = Math.hypot(e.x - this.px, e.y - this.py);
      if (!attract && dist < 30 && e.invuln <= 0) {
        const toEnemyX = (e.x - this.px) / (dist || 1);
        const toEnemyY = (e.y - this.py) / (dist || 1);
        // Dot product of Adol's facing vs enemy's movement direction:
        // Off-center/flank/back bump (or charging with Dash) slashes enemy cleanly!
        // Pure dead-center head-on collision hurts Adol!
        const eLen = Math.hypot(e.vx, e.vy) || 1;
        const headOnDot = toEnemyX * (-e.vx / eLen) + toEnemyY * (-e.vy / eLen);
        const offCenterOffset = Math.abs(toEnemyX * this.lastDirY - toEnemyY * this.lastDirX);
        const cleanSlash = offCenterOffset > 0.22 || headOnDot < 0.72 || this.input.secondary;

        if (cleanSlash) {
          e.invuln = 0.28;
          e.x += toEnemyX * 22;
          e.y += toEnemyY * 22;
          this.damageEnemy(i, 1 + this.swordTier);
        } else if (this.invulnTimer <= 0) {
          this.hp -= 14;
          this.invulnTimer = 0.65;
          this.px -= toEnemyX * 20;
          this.py -= toEnemyY * 20;
          arcadeAudio.playRockThud();
          this.popups.push({ x: this.px, y: this.py - 22, text: 'HEAD-ON! HIT OFF-CENTER!', color: '#EF4444', life: 0.85, maxLife: 0.85 });
          if (this.hp <= 0) {
            arcadeAudio.playDeath();
            this.phase = 'GAME_OVER';
            return;
          }
        }
      }
    }

    if (!attract && this.enemies.length === 0) {
      arcadeAudio.playStageClear();
      this.score += 1000;
      this.phase = 'STAGE_CLEAR';
      this.stateTimer = 1.4;
    }
  }

  private damageEnemy(idx: number, dmg: number): void {
    const e = this.enemies[idx];
    if (!e) return;
    e.hp -= dmg;
    spawnBurst(this.particles, e.x, e.y, '#FEF08A', 12, 180, 3);
    arcadeAudio.playExplosion(false);
    if (e.hp <= 0) {
      this.enemies.splice(idx, 1);
      const gainXp = e.kind === 'darkfact' ? 80 : e.kind === 'bat' ? 60 : 20;
      const gainGold = e.kind === 'darkfact' ? 400 : 80;
      this.xp += gainXp;
      this.gold += gainGold;
      this.score += gainXp * 15;
      if (this.score > this.highScore) {
        this.highScore = this.score;
        saveHighScore(this.storageKey, this.highScore);
      }
      if (this.xp >= this.heroLevel * 60) {
        this.heroLevel += 1;
        this.maxHp += 20;
        this.hp = this.maxHp;
        arcadeAudio.playPowerUp();
        this.popups.push({ x: this.px, y: this.py - 30, text: `LEVEL UP LV.${this.heroLevel}!`, color: '#4ADE80', life: 1.1, maxLife: 1.1 });
      }
      // Automatic Ys Town Equipment Upgrades with Gold!
      const nextTierCost = (this.swordTier + 1) * 260;
      if (this.swordTier < 3 && this.gold >= nextTierCost) {
        this.swordTier += 1;
        const swords = ['SHORT SWORD', 'LONG SWORD', 'TALWAR', 'SILVER SWORD'];
        arcadeAudio.playExtraLife();
        this.popups.push({ x: this.px, y: this.py - 46, text: `EQUIPPED ${swords[this.swordTier]}!`, color: '#38BDF8', life: 1.2, maxLife: 1.2 });
      }
    }
  }

  public getHudSnapshot(): ClassicGameHud {
    const swords = ['SHORT SWORD', 'LONG SWORD', 'TALWAR', 'SILVER SWORD'];
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.floor,
      lives: Math.max(1, Math.ceil(this.hp / 34)),
      stageName: this.floor % 5 === 0 ? 'YS · DARK FACT SUMMIT' : this.floor % 5 === 3 ? 'YS · VAGULLION LAIR' : `YS BOOK I & II · FLOOR ${this.floor}`,
      primaryMetricLabel: `LV.${this.heroLevel} HP/MP`,
      primaryMetricValue: `${Math.round(this.hp)}/${this.maxHp} · ${Math.round(this.mp)}MP`,
      secondaryMetricLabel: 'WEAPON',
      secondaryMetricValue: swords[this.swordTier],
      bannerText: this.phase === 'STAGE_CLEAR' ? 'FLOOR CLEARED!' : this.phase === 'GAME_OVER' ? 'ADOL FALLEN' : '',
    };
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = this.logicalWidth;
    const H = this.logicalHeight;

    ctx.fillStyle = '#1E1B2E';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#6366F1';
    ctx.lineWidth = 10;
    ctx.strokeRect(26, 26, W - 52, H - 52);

    // Stone floor tiles
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.lineWidth = 1;
    for (let x = 32; x < W - 32; x += 44) {
      ctx.beginPath();
      ctx.moveTo(x, 32);
      ctx.lineTo(x, H - 32);
      ctx.stroke();
    }
    for (let y = 32; y < H - 32; y += 44) {
      ctx.beginPath();
      ctx.moveTo(32, y);
      ctx.lineTo(W - 32, y);
      ctx.stroke();
    }

    // Broken Dark Fact Holes
    for (const h of this.brokenTiles) {
      ctx.fillStyle = '#020617';
      ctx.beginPath();
      ctx.arc(h.x, h.y, 18, 0, Math.PI * 2);
      ctx.fill();
    }

    // Dungeon Pillars
    for (const p of this.pillars) {
      ctx.fillStyle = '#475569';
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(p.x, p.y, p.w, 8);
    }

    // Enemies
    for (const e of this.enemies) {
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.kind === 'darkfact' || e.kind === 'bat' ? 22 : 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(e.x - 16, e.y - 28, 32, 5);
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(e.x - 16, e.y - 28, 32 * (e.hp / e.maxHp), 5);
    }

    // Fireballs
    for (const s of this.shots) {
      ctx.fillStyle = s.fromPlayer ? '#FACC15' : '#F43F5E';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Red-haired Adol Christin!
    ctx.save();
    ctx.translate(this.px, this.py);
    ctx.fillStyle = '#CBD5E1'; // Silver Armor
    ctx.fillRect(-10, -8, 20, 22);
    ctx.fillStyle = '#EF4444'; // Iconic crimson hair!
    ctx.beginPath();
    ctx.arc(0, -14, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(this.lastDirX * 22, this.lastDirY * 22);
    ctx.stroke();
    ctx.restore();

    renderParticlesAndPopups(ctx, this.particles, this.popups);
    if (this.phase === 'TITLE') {
      ctx.fillStyle = 'rgba(15, 10, 28, 0.75)';
      ctx.fillRect(0, H * 0.36, W, 110);
      ctx.textAlign = 'center';
      ctx.font = '900 34px "JetBrains Mono", monospace';
      ctx.fillStyle = '#EF4444';
      ctx.fillText('YS BOOK I & II', W * 0.5, H * 0.36 + 46);
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText('OFF-CENTER BUMP COMBAT · STAND STILL TO HEAL · SPACE = FIREBALL · DEFEAT DARK FACT!', W * 0.5, H * 0.36 + 80);
    }
    if (visualMode === 'crt') renderCrtOverlay(ctx, W, H);
  }
}

// ============================================================================
// 2. M.U.L.E. (1983 Ozark Softscape — 4-Phase Turn: Land Grant, Town M.U.L.E. Outfitting, Events & Economy!)
// ============================================================================
type MuleResource = 'food' | 'energy' | 'smithore' | 'crystite';
type MuleTurnPhase = 'LAND_GRANT' | 'DEVELOP' | 'EVENT_RESULTS';

interface IrataPlot {
  col: number;
  row: number;
  terrain: 'river' | 'plains' | 'hills' | 'town';
  owner: number; // -1 none, 0 player, 1..3 AI rivals
  mule: MuleResource | null;
}

export class MuleArcadeGame implements ArcadeGameInstance {
  public readonly logicalWidth = 760;
  public readonly logicalHeight = 560;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'Claim / Buy MULE / Install';
  public readonly secondaryActionLabel = 'Cycle Outfitting / Pub Cash';

  private storageKey = 'mule_hd_highscore_v2';
  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();
  private score = 0;
  private highScore = 0;
  private month = 1; // 12 Months on Planet Irata!
  private clock = 0;
  private stateTimer = 0;

  private turnPhase: MuleTurnPhase = 'LAND_GRANT';
  private turnTimer = 28;
  private cursorCol = 4;
  private cursorRow = 2;
  private moveCd = 0;

  // Colonist real-time position during Development Phase!
  private cx = 380;
  private cy = 280;
  private carryingMule: MuleResource | null = null;
  private selectedOutfit: MuleResource = 'energy';

  private money = 1000;
  private food = 4;
  private energy = 3;
  private smithore = 1;
  private crystite = 0;
  private eventBanner = '';
  private plots: IrataPlot[] = [];
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  constructor() {
    this.highScore = readHighScore(this.storageKey);
    this.initPlanet();
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public startNewGame(): void {
    arcadeAudio.playArcadeStart();
    this.score = 1000;
    this.month = 1;
    this.money = 1000;
    this.food = 4;
    this.energy = 3;
    this.smithore = 1;
    this.crystite = 0;
    this.initPlanet();
    this.turnPhase = 'LAND_GRANT';
    this.eventBanner = 'CLAIM A FREE RIVER OR PLAINS PLOT!';
    this.phase = 'READY';
    this.stateTimer = 0.85;
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.initPlanet();
  }

  private initPlanet(): void {
    this.plots = [];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 9; c++) {
        const isTown = r === 2 && c === 4;
        const terrain: IrataPlot['terrain'] = isTown
          ? 'town'
          : c === 4
            ? 'river'
            : (r + c) % 3 === 0
              ? 'hills'
              : 'plains';
        this.plots.push({ col: c, row: r, terrain, owner: -1, mule: null });
      }
    }
    this.cursorCol = 4;
    this.cursorRow = 1;
    this.cx = 380;
    this.cy = 280;
    this.carryingMule = null;
  }

  private plotRect(col: number, row: number): { x: number; y: number; w: number; h: number } {
    return { x: 46 + col * 74, y: 74 + row * 82, w: 70, h: 78 };
  }

  private runAiAndProduction(): void {
    // AI Rivals (Packer, Mechtron, Gollumer) claim & outfit a plot!
    for (let ai = 1; ai <= 3; ai++) {
      const free = this.plots.filter((p) => p.owner === -1 && p.terrain !== 'town');
      if (free.length > 0) {
        const pick = free[Math.floor(Math.random() * free.length)];
        pick.owner = ai;
        pick.mule = pick.terrain === 'river' ? 'food' : pick.terrain === 'hills' ? 'smithore' : 'energy';
      }
    }

    // Authentic Planet Irata Random Colony Event!
    const events = [
      { name: 'ACID RAIN! FOOD PLOTS BOOSTED +2', kind: 'rain' },
      { name: 'SUNSPOTS! ENERGY PLOTS BOOSTED +2', kind: 'sun' },
      { name: 'METEORITE STRIKE! +2 CRYSTITE FOUND', kind: 'meteor' },
      { name: 'SPACE PIRATES RAIDED COLONY (-$120)', kind: 'pirates' },
    ];
    const ev = events[Math.floor(Math.random() * events.length)];
    this.eventBanner = ev.name;
    if (ev.kind === 'meteor') this.crystite += 2;
    if (ev.kind === 'pirates') this.money = Math.max(0, this.money - 120);

    // Authentic M.U.L.E. Production & Energy/Food Upkeep!
    const myPlots = this.plots.filter((p) => p.owner === 0 && p.mule !== null);
    let energyNeeded = myPlots.length;
    let poweredPlots = 0;
    for (const p of myPlots) {
      if (this.energy <= 0 && p.mule !== 'energy') continue; // Energy shortage stalls non-energy MULEs!
      poweredPlots++;
      if (p.mule === 'food') this.food += (p.terrain === 'river' ? 4 : 2) + (ev.kind === 'rain' ? 2 : 0);
      else if (p.mule === 'energy') this.energy += (p.terrain === 'plains' ? 4 : 2) + (ev.kind === 'sun' ? 2 : 0);
      else if (p.mule === 'smithore') this.smithore += p.terrain === 'hills' ? 4 : 2;
      else if (p.mule === 'crystite') this.crystite += p.terrain === 'hills' ? 3 : 1;
    }

    // Upkeep & Auto-Auction of Surplus Resources!
    this.energy = Math.max(0, this.energy - energyNeeded);
    this.food = Math.max(0, this.food - 3);
    const surplusSales = Math.max(0, this.food - 4) * 35 + Math.max(0, this.energy - 4) * 40 + this.smithore * 65 + this.crystite * 110;
    this.money += surplusSales;
    this.food = Math.min(4, this.food);
    this.energy = Math.min(4, this.energy);
    this.smithore = 0;
    this.crystite = 0;

    this.score = this.money + this.plots.filter((p) => p.owner === 0).length * 500 + poweredPlots * 200;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(this.storageKey, this.highScore);
    }
    arcadeAudio.playPowerUp();
    this.popups.push({ x: 380, y: 240, text: `AUCTION +$${surplusSales}!`, color: '#4ADE80', life: 1.4, maxLife: 1.4 });
  }

  public step(dt: number): void {
    this.clock += dt;
    stepParticlesAndPopups(this.particles, this.popups, dt);
    if (this.phase === 'PAUSED' || this.phase === 'GAME_OVER') return;
    if (this.phase === 'READY') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) this.phase = 'PLAYING';
      return;
    }
    if (this.phase === 'TITLE') return;

    this.moveCd = Math.max(0, this.moveCd - dt);

    if (this.turnPhase === 'LAND_GRANT') {
      if (this.moveCd <= 0) {
        if (this.input.left) {
          this.cursorCol = (this.cursorCol + 8) % 9;
          this.moveCd = 0.14;
        } else if (this.input.right) {
          this.cursorCol = (this.cursorCol + 1) % 9;
          this.moveCd = 0.14;
        } else if (this.input.up) {
          this.cursorRow = (this.cursorRow + 4) % 5;
          this.moveCd = 0.14;
        } else if (this.input.down) {
          this.cursorRow = (this.cursorRow + 1) % 5;
          this.moveCd = 0.14;
        }
      }
      if (this.input.fireJustPressed) {
        const plot = this.plots.find((p) => p.col === this.cursorCol && p.row === this.cursorRow);
        if (plot && plot.owner === -1 && plot.terrain !== 'town') {
          plot.owner = 0;
          arcadeAudio.playCoin();
          // Transition to Real-Time Development Phase!
          this.turnPhase = 'DEVELOP';
          this.turnTimer = 22 + this.food * 2;
          this.cx = 380;
          this.cy = 280;
          this.carryingMule = null;
          this.eventBanner = 'ENTER CENTER TOWN TO BUY M.U.L.E. · SPACE ON YOUR PLOT TO INSTALL!';
        }
      }
    } else if (this.turnPhase === 'DEVELOP') {
      this.turnTimer -= dt;
      const spd = 225;
      if (this.input.left) this.cx -= spd * dt;
      if (this.input.right) this.cx += spd * dt;
      if (this.input.up) this.cy -= spd * dt;
      if (this.input.down) this.cy += spd * dt;
      this.cx = Math.max(54, Math.min(706, this.cx));
      this.cy = Math.max(82, Math.min(478, this.cy));

      // Cycle M.U.L.E. outfitting type (or Gamble in Town Pub!)
      const col = Math.max(0, Math.min(8, Math.floor((this.cx - 46) / 74)));
      const row = Math.max(0, Math.min(4, Math.floor((this.cy - 74) / 82)));
      const curPlot = this.plots.find((p) => p.col === col && p.row === row);

      if (this.input.secondaryJustPressed) {
        if (curPlot?.terrain === 'town' && !this.carryingMule) {
          // Authentic M.U.L.E. Pub Gambling ends turn early for bonus cash!
          const pubCash = Math.round(this.turnTimer * 8) + 40;
          this.money += pubCash;
          arcadeAudio.playPowerUp();
          this.popups.push({ x: 380, y: 260, text: `PUB GAMBLE +$${pubCash}!`, color: '#FACC15', life: 1.2, maxLife: 1.2 });
          this.turnTimer = 0;
        } else {
          const order: MuleResource[] = ['energy', 'food', 'smithore', 'crystite'];
          this.selectedOutfit = order[(order.indexOf(this.selectedOutfit) + 1) % 4];
          arcadeAudio.playCoin();
        }
      }

      if (this.input.fireJustPressed && curPlot) {
        if (curPlot.terrain === 'town' && !this.carryingMule) {
          const cost = this.selectedOutfit === 'crystite' ? 220 : 150;
          if (this.money >= cost) {
            this.money -= cost;
            this.carryingMule = this.selectedOutfit;
            arcadeAudio.playPowerUp();
            this.popups.push({ x: this.cx, y: this.cy - 24, text: `BOUGHT ${this.selectedOutfit.toUpperCase()} MULE`, color: '#38BDF8', life: 0.9, maxLife: 0.9 });
          }
        } else if (curPlot.owner === 0 && this.carryingMule) {
          curPlot.mule = this.carryingMule;
          this.carryingMule = null;
          arcadeAudio.playStageClear();
          this.popups.push({ x: this.cx, y: this.cy - 24, text: 'M.U.L.E. INSTALLED!', color: '#4ADE80', life: 0.9, maxLife: 0.9 });
        }
      }

      if (this.turnTimer <= 0) {
        this.runAiAndProduction();
        this.turnPhase = 'EVENT_RESULTS';
        this.stateTimer = 2.1;
      }
    } else if (this.turnPhase === 'EVENT_RESULTS') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.month += 1;
        if (this.month > 12) {
          arcadeAudio.playStageClear();
          this.phase = 'GAME_OVER';
        } else {
          this.turnPhase = 'LAND_GRANT';
          this.eventBanner = `MONTH ${this.month}/12 · CLAIM A NEW LAND GRANT!`;
        }
      }
    }
  }

  public getHudSnapshot(): ClassicGameHud {
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.month,
      lives: 1,
      stageName: `M.U.L.E. · MONTH ${this.month}/12 (${this.turnPhase.replace('_', ' ')})`,
      primaryMetricLabel: 'FUNDS / OUTFIT',
      primaryMetricValue: `$${this.money} · ${this.selectedOutfit.toUpperCase()}`,
      secondaryMetricLabel: this.turnPhase === 'DEVELOP' ? 'TURN TIME' : 'STOCK',
      secondaryMetricValue: this.turnPhase === 'DEVELOP' ? `${Math.max(0, Math.ceil(this.turnTimer))}s` : `F:${this.food} E:${this.energy}`,
      bannerText: this.phase === 'GAME_OVER' ? `COLONY COMPLETE! FINAL SCORE ${this.score}` : '',
    };
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = this.logicalWidth;
    const H = this.logicalHeight;

    ctx.fillStyle = '#1E1B4B';
    ctx.fillRect(0, 0, W, H);

    // Top Event & Instruction Banner
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(28, 16, W - 56, 42);
    ctx.fillStyle = '#FACC15';
    ctx.font = '800 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(this.eventBanner || 'PLANET IRATA COLONY', W * 0.5, 42);

    // 9x5 Planet Irata Map!
    const ownerCols = ['#38BDF8', '#EF4444', '#FACC15', '#A855F7'];
    for (const p of this.plots) {
      const r = this.plotRect(p.col, p.row);
      ctx.fillStyle =
        p.terrain === 'town'
          ? '#6366F1'
          : p.terrain === 'river'
            ? '#0284C7'
            : p.terrain === 'hills'
              ? '#92400E'
              : '#D97706';
      ctx.fillRect(r.x, r.y, r.w, r.h);

      if (p.owner >= 0) {
        ctx.strokeStyle = ownerCols[p.owner];
        ctx.lineWidth = 4;
        ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
      }

      if (p.terrain === 'town') {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('STORE', r.x + r.w * 0.5, r.y + 34);
        ctx.fillStyle = '#FEF08A';
        ctx.fillText('& PUB', r.x + r.w * 0.5, r.y + 52);
      } else if (p.mule) {
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(r.x + 12, r.y + 24, r.w - 24, 24);
        ctx.fillStyle = '#4ADE80';
        ctx.font = '900 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(p.mule.slice(0, 4).toUpperCase(), r.x + r.w * 0.5, r.y + 40);
      }
    }

    // Land Grant Selection Cursor
    if (this.turnPhase === 'LAND_GRANT' && this.phase === 'PLAYING') {
      const cr = this.plotRect(this.cursorCol, this.cursorRow);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 4;
      ctx.strokeRect(cr.x - 2, cr.y - 2, cr.w + 4, cr.h + 4);
    }

    // Real-Time Colonist + Tethered M.U.L.E. Robot during Development Phase!
    if (this.turnPhase === 'DEVELOP') {
      if (this.carryingMule) {
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.cx, this.cy);
        ctx.lineTo(this.cx - 24, this.cy + 14);
        ctx.stroke();
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(this.cx - 34, this.cy + 6, 20, 14);
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(this.cx - 6, this.cy - 2, 12, 8);
    }

    // Footer legend
    ctx.fillStyle = '#CBD5E1';
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SHIFT: CYCLE OUTFIT (ENERGY/FOOD/SMITHORE/CRYSTITE) OR PUB GAMBLE IN TOWN · SPACE: BUY / INSTALL', W * 0.5, H - 22);

    renderParticlesAndPopups(ctx, this.particles, this.popups);
    if (this.phase === 'TITLE') {
      ctx.fillStyle = 'rgba(15, 18, 46, 0.78)';
      ctx.fillRect(0, H * 0.36, W, 110);
      ctx.textAlign = 'center';
      ctx.font = '900 36px "JetBrains Mono", monospace';
      ctx.fillStyle = '#FACC15';
      ctx.fillText('M.U.L.E.', W * 0.5, H * 0.36 + 46);
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText('CLAIM IRATA LAND · BUY & OUTFIT M.U.L.E.S IN TOWN · BEAT RIVALS & COLONY EVENTS!', W * 0.5, H * 0.36 + 80);
    }
    if (visualMode === 'crt') renderCrtOverlay(ctx, W, H);
  }
}

export class YsActionRpgGame extends YsBookArcadeGame {
  constructor(variant: 'ys1' | 'ys2' = 'ys1') {
    super(variant);
  }
}


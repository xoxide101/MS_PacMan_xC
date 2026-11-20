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
// 1. SPY HUNTER (1983 Bally Midway — Curving Road, Boat Mode, Weapons Van, Road Lord & Helicopter!)
// ============================================================================
interface RoadAgent {
  kind: 'switchblade' | 'roadlord' | 'civilian' | 'weaponsVan';
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  spinOut: number;
}

export class SpyHunterArcadeGame implements ArcadeGameInstance {
  public readonly logicalWidth = 660;
  public readonly logicalHeight = 640;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'Machine Guns';
  public readonly secondaryActionLabel = 'Oil Slick / Smoke / Missile';

  private storageKey = 'spyhunter_hd_highscore_v2';
  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();
  private score = 0;
  private highScore = 0;
  private level = 1;
  private lives = 3;
  private clock = 0;
  private stateTimer = 0;

  private px = 330;
  private py = 500;
  private speed = 340;
  private scrollY = 0;
  private boatMode = false;
  private fireCd = 0;
  private gadget: 'oil' | 'smoke' | 'missile' = 'oil';
  private gadgetAmmo = 5;
  private civilianPenaltyTimer = 0;
  private vanCd = 9.0;

  private agents: RoadAgent[] = [];
  private chopper: { active: boolean; x: number; y: number; dropCd: number } = { active: false, x: 330, y: 80, dropCd: 2.0 };
  private bullets: Array<{ x: number; y: number; vy: number; missile?: boolean }> = [];
  private hazards: Array<{ x: number; y: number; kind: 'oil' | 'bomb' }> = [];
  private spawnCd = 0.7;
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  constructor() {
    this.highScore = readHighScore(this.storageKey);
    this.resetRun();
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public startNewGame(): void {
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.phase = 'READY';
    this.stateTimer = 0.85;
    this.resetRun();
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.resetRun();
  }

  private resetRun(): void {
    this.px = 330;
    this.py = 500;
    this.speed = 340;
    this.scrollY = 0;
    this.boatMode = false;
    this.gadget = 'oil';
    this.gadgetAmmo = 5;
    this.agents = [];
    this.bullets = [];
    this.hazards = [];
    this.chopper.active = false;
    this.vanCd = 8.0;
    this.civilianPenaltyTimer = 0;
  }

  private getRoadBounds(worldY: number): { left: number; right: number; center: number; isWater: boolean } {
    // Authentic Spy Hunter winding roads + periodic Boathouse water transitions!
    const seg = Math.floor(worldY / 3800) % 3;
    const isWater = seg === 2;
    const center = 330 + Math.sin(worldY * 0.0014) * 105 + Math.cos(worldY * 0.0007) * 45;
    const halfW = isWater ? 155 : 138 + Math.sin(worldY * 0.0021) * 28;
    return { left: center - halfW, right: center + halfW, center, isWater };
  }

  private addScore(pts: number, x?: number, y?: number, label?: string): void {
    if (this.civilianPenaltyTimer > 0) return;
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(this.storageKey, this.highScore);
    }
    if (x !== undefined && y !== undefined) {
      this.popups.push({
        x,
        y,
        text: label ? `${label} +${pts}` : `+${pts}`,
        color: '#FEF08A',
        life: 0.85,
        maxLife: 0.85,
      });
    }
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

    const attract = this.phase === 'TITLE';
    this.fireCd = Math.max(0, this.fireCd - dt);
    this.civilianPenaltyTimer = Math.max(0, this.civilianPenaltyTimer - dt);

    const playerRoad = this.getRoadBounds(this.scrollY + (this.logicalHeight - this.py));
    this.boatMode = playerRoad.isWater;

    if (attract) {
      this.px += (playerRoad.center - this.px) * Math.min(1, dt * 5);
      this.speed = 350;
    } else {
      if (this.input.up) this.speed = Math.min(540, this.speed + 260 * dt);
      else if (this.input.down) this.speed = Math.max(190, this.speed - 320 * dt);
      else this.speed += (340 - this.speed) * Math.min(1, dt * 3);

      if (this.input.left) this.px -= 285 * dt;
      if (this.input.right) this.px += 285 * dt;

      // Off-road crash check!
      if (this.px < playerRoad.left + 12 || this.px > playerRoad.right - 12) {
        this.lives -= 1;
        arcadeAudio.playDeath();
        spawnBurst(this.particles, this.px, this.py, '#F97316', 24, 240, 3.6);
        if (this.lives <= 0) this.phase = 'GAME_OVER';
        else this.px = playerRoad.center;
        return;
      }

      // Machine Guns
      if ((this.input.fire || this.input.fireJustPressed) && this.fireCd <= 0) {
        this.fireCd = 0.12;
        this.bullets.push({ x: this.px - 9, y: this.py - 26, vy: -640 });
        this.bullets.push({ x: this.px + 9, y: this.py - 26, vy: -640 });
        arcadeAudio.playLaser();
      }
      // Secondary Gadget (Oil Slick / Smoke Screen / Surface-to-Air Missile!)
      if (this.input.secondaryJustPressed && this.gadgetAmmo > 0) {
        this.gadgetAmmo -= 1;
        if (this.gadget === 'missile') {
          this.bullets.push({ x: this.px, y: this.py - 28, vy: -520, missile: true });
          arcadeAudio.playExplosion(false);
        } else {
          this.hazards.push({ x: this.px, y: this.py + 28, kind: 'oil' });
          arcadeAudio.playThrow();
        }
      }
    }

    this.scrollY += this.speed * dt;
    if (!attract && this.speed > 260) {
      this.addScore(Math.round(this.speed * dt * 0.08));
      this.level = 1 + Math.floor(this.scrollY / 4500);
    }

    // Weapons Van spawner (pull into its rear ramp to reload/upgrade gadget!)
    this.vanCd -= dt;
    if (this.vanCd <= 0 && !this.boatMode && !this.agents.some((a) => a.kind === 'weaponsVan')) {
      this.vanCd = 15.0;
      const topRoad = this.getRoadBounds(this.scrollY + this.logicalHeight + 40);
      this.agents.push({ kind: 'weaponsVan', x: topRoad.center, y: -40, vx: 0, vy: 110, hp: 999, spinOut: 0 });
    }

    // Mad Bomber Helicopter!
    if (!this.chopper.active && this.level >= 2 && Math.random() < dt * 0.09) {
      this.chopper = { active: true, x: this.px, y: 78, dropCd: 1.5 };
    }
    if (this.chopper.active) {
      this.chopper.x += (this.px - this.chopper.x) * Math.min(1, dt * 1.4);
      this.chopper.dropCd -= dt;
      if (this.chopper.dropCd <= 0 && !attract) {
        this.chopper.dropCd = 1.9;
        this.hazards.push({ x: this.chopper.x, y: this.chopper.y + 18, kind: 'bomb' });
      }
    }

    // Spawn Switch Blade, Bulletproof Road Lord, & Civilian Cars
    this.spawnCd -= dt;
    if (this.spawnCd <= 0) {
      this.spawnCd = Math.max(0.55, 1.15 - this.level * 0.06);
      const topRoad = this.getRoadBounds(this.scrollY + this.logicalHeight + 30);
      const roll = Math.random();
      const kind: RoadAgent['kind'] = roll < 0.34 ? 'civilian' : roll < 0.7 ? 'switchblade' : 'roadlord';
      this.agents.push({
        kind,
        x: topRoad.left + 32 + Math.random() * (topRoad.right - topRoad.left - 64),
        y: -36,
        vx: 0,
        vy: kind === 'civilian' ? 140 : 175,
        hp: kind === 'roadlord' ? 999 : 2, // Road Lord is BULLETPROOF!
        spinOut: 0,
      });
    }

    // Update bullets & missiles
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.y += b.vy * dt;
      if (b.missile && this.chopper.active && Math.hypot(b.x - this.chopper.x, b.y - this.chopper.y) < 34) {
        this.chopper.active = false;
        spawnBurst(this.particles, this.chopper.x, this.chopper.y, '#FACC15', 26, 250, 3.8);
        arcadeAudio.playExplosion(true);
        this.addScore(1500, this.chopper.x, this.chopper.y, 'CHOPPER DOWN!');
        this.bullets.splice(i, 1);
        continue;
      }
      let hit = false;
      for (let j = this.agents.length - 1; j >= 0; j--) {
        const a = this.agents[j];
        if (a.kind === 'weaponsVan') continue;
        if (Math.hypot(a.x - b.x, a.y - b.y) < 22) {
          hit = true;
          if (a.kind === 'roadlord') {
            // Bullets bounce off armored Road Lord!
            arcadeAudio.playRockThud();
          } else {
            a.hp -= 1;
            if (a.hp <= 0) {
              spawnBurst(this.particles, a.x, a.y, a.kind === 'civilian' ? '#94A3B8' : '#F97316', 16, 200, 3);
              if (!attract) {
                if (a.kind === 'civilian') {
                  this.civilianPenaltyTimer = 4.0;
                  this.popups.push({ x: a.x, y: a.y, text: 'CIVILIAN! NO POINTS', color: '#EF4444', life: 1.0, maxLife: 1.0 });
                } else {
                  arcadeAudio.playExplosion(false);
                  this.addScore(500, a.x, a.y);
                }
              }
              this.agents.splice(j, 1);
            }
          }
          break;
        }
      }
      if (hit || b.y < -20) this.bullets.splice(i, 1);
    }

    // Update Oil Slicks & Helicopter Bombs
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.y += (h.kind === 'oil' ? this.speed * 0.72 : 240) * dt;
      if (h.kind === 'bomb' && !attract && Math.hypot(h.x - this.px, h.y - this.py) < 22) {
        this.hazards.splice(i, 1);
        this.lives -= 1;
        arcadeAudio.playDeath();
        if (this.lives <= 0) this.phase = 'GAME_OVER';
        return;
      }
      if (h.kind === 'oil') {
        for (const a of this.agents) {
          if (a.kind !== 'weaponsVan' && Math.hypot(a.x - h.x, a.y - h.y) < 26) {
            a.spinOut = 1.4;
            a.vx = a.x < this.px ? -260 : 260;
          }
        }
      }
      if (h.y > this.logicalHeight + 30) this.hazards.splice(i, 1);
    }

    // Update Road Agents (Switch Blade tries to ram you; bump Road Lord off-road!)
    for (let i = this.agents.length - 1; i >= 0; i--) {
      const a = this.agents[i];
      const rBounds = this.getRoadBounds(this.scrollY + (this.logicalHeight - a.y));
      if (a.spinOut > 0) {
        a.spinOut -= dt;
        a.x += a.vx * dt;
        a.y += 180 * dt;
      } else if (a.kind === 'weaponsVan') {
        a.x += (rBounds.center - a.x) * Math.min(1, dt * 4);
        a.y += (this.speed * 0.32) * dt;
      } else {
        if (a.kind === 'switchblade' && Math.abs(a.y - this.py) < 120) {
          a.x += Math.sign(this.px - a.x) * 95 * dt;
        } else {
          a.x += (rBounds.center - a.x) * Math.min(1, dt * 1.2);
        }
        a.y += (this.speed - a.vy) * dt;
      }

      // Enemy knocked off-road -> Explodes for authentic 500 pts (the ONLY way to kill Road Lord besides Oil)!
      if (a.kind !== 'weaponsVan' && (a.x < rBounds.left - 4 || a.x > rBounds.right + 4)) {
        spawnBurst(this.particles, a.x, a.y, '#F97316', 18, 220, 3.2);
        if (!attract && a.kind !== 'civilian') {
          arcadeAudio.playExplosion(true);
          this.addScore(a.kind === 'roadlord' ? 750 : 500, a.x, a.y, 'OFF-ROAD KO!');
        }
        this.agents.splice(i, 1);
        continue;
      }

      // Collision with Player G-6155 Interceptor
      if (!attract && Math.hypot(a.x - this.px, a.y - this.py) < 28) {
        if (a.kind === 'weaponsVan') {
          const cycle: Array<'oil' | 'smoke' | 'missile'> = ['oil', 'missile', 'smoke'];
          this.gadget = cycle[(cycle.indexOf(this.gadget) + 1) % cycle.length];
          this.gadgetAmmo = 6;
          arcadeAudio.playPowerUp();
          this.addScore(500, this.px, this.py - 30, `VAN EQUIP: ${this.gadget.toUpperCase()}`);
          this.agents.splice(i, 1);
          continue;
        }
        // Bump enemy sideways!
        const push = Math.sign(a.x - this.px) || 1;
        a.x += push * 34;
        a.vx = push * 180;
        this.px -= push * 14;
        arcadeAudio.playRockThud();
      }
      if (a.y > this.logicalHeight + 60 || a.y < -90) this.agents.splice(i, 1);
    }
  }

  public getHudSnapshot(): ClassicGameHud {
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: this.boatMode ? `SPY HUNTER · BOAT SECTOR ${this.level}` : `SPY HUNTER · HIGHWAY ${this.level}`,
      primaryMetricLabel: 'GADGET',
      primaryMetricValue: `${this.gadget.toUpperCase()} (${this.gadgetAmmo})`,
      secondaryMetricLabel: 'SPEED',
      secondaryMetricValue: `${Math.round(this.speed * 0.35)} MPH`,
      bannerText: this.phase === 'GAME_OVER' ? 'INTERCEPTOR LOST' : '',
    };
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = this.logicalWidth;
    const H = this.logicalHeight;

    ctx.fillStyle = '#14532D';
    ctx.fillRect(0, 0, W, H);

    // Curving Road / Waterway ribbon!
    for (let y = 0; y < H; y += 16) {
      const rb = this.getRoadBounds(this.scrollY + (H - y));
      ctx.fillStyle = rb.isWater ? '#0284C7' : '#334155';
      ctx.fillRect(rb.left, y, rb.right - rb.left, 18);
      ctx.fillStyle = rb.isWater ? '#38BDF8' : '#E2E8F0';
      ctx.fillRect(rb.left - 6, y, 6, 18);
      ctx.fillRect(rb.right, y, 6, 18);
      if (!rb.isWater && Math.floor((this.scrollY + (H - y)) / 42) % 2 === 0) {
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(rb.center - 2, y, 4, 16);
      }
    }

    // Hazards (Oil / Bombs)
    for (const h of this.hazards) {
      ctx.fillStyle = h.kind === 'oil' ? '#09090B' : '#EF4444';
      ctx.beginPath();
      ctx.ellipse(h.x, h.y, h.kind === 'oil' ? 18 : 8, h.kind === 'oil' ? 10 : 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Road Agents
    for (const a of this.agents) {
      ctx.save();
      ctx.translate(a.x, a.y);
      if (a.spinOut > 0) ctx.rotate(this.clock * 14);
      if (a.kind === 'weaponsVan') {
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(-18, -32, 36, 64);
        ctx.fillStyle = '#FEF08A';
        ctx.font = '900 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('VAN', 0, 4);
      } else {
        ctx.fillStyle = a.kind === 'civilian' ? '#38BDF8' : a.kind === 'roadlord' ? '#FACC15' : '#94A3B8';
        ctx.beginPath();
        ctx.roundRect(-14, -22, 28, 44, 6);
        ctx.fill();
        if (a.kind === 'switchblade') {
          ctx.fillStyle = '#EF4444';
          ctx.fillRect(-20, -4, 40, 6); // Tire slasher blades!
        }
      }
      ctx.restore();
    }

    // Bullets & Missiles
    for (const b of this.bullets) {
      ctx.fillStyle = b.missile ? '#F97316' : '#FEF08A';
      ctx.fillRect(b.x - (b.missile ? 4 : 2), b.y - 8, b.missile ? 8 : 4, 14);
    }

    // Player G-6155 Interceptor (Car or Speedboat!)
    ctx.save();
    ctx.translate(this.px, this.py);
    ctx.fillStyle = this.boatMode ? '#38BDF8' : '#F8FAFC';
    ctx.beginPath();
    ctx.moveTo(0, -28);
    ctx.lineTo(15, -6);
    ctx.lineTo(15, 22);
    ctx.lineTo(-15, 22);
    ctx.lineTo(-15, -6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(-9, -8, 18, 14);
    ctx.restore();

    // Mad Bomber Helicopter
    if (this.chopper.active) {
      ctx.save();
      ctx.translate(this.chopper.x, this.chopper.y);
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.ellipse(0, 0, 22, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 3;
      const rot = Math.sin(this.clock * 28) * 34;
      ctx.beginPath();
      ctx.moveTo(-rot, -10);
      ctx.lineTo(rot, -10);
      ctx.stroke();
      ctx.restore();
    }

    renderParticlesAndPopups(ctx, this.particles, this.popups);
    if (this.phase === 'TITLE') {
      ctx.fillStyle = 'rgba(4, 10, 24, 0.72)';
      ctx.fillRect(0, H * 0.36, W, 110);
      ctx.textAlign = 'center';
      ctx.font = '900 34px "JetBrains Mono", monospace';
      ctx.fillStyle = '#FACC15';
      ctx.fillText('SPY HUNTER', W * 0.5, H * 0.36 + 46);
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText('WINDING HIGHWAY & BOAT MODE · WEAPONS VAN · OIL SLICKS & MISSILES!', W * 0.5, H * 0.36 + 80);
    }
    if (visualMode === 'crt') renderCrtOverlay(ctx, W, H);
  }
}

// ============================================================================
// 2. TAPPER & ROOT BEER TAPPER (1983 Bally Midway — Walk Bar for Tips & Catch Empty Mugs!)
// ============================================================================
interface TapperPatron {
  lane: number;
  x: number;
  speed: number;
  drinking: number;
  color: string;
}

interface TapperMug {
  lane: number;
  x: number;
  vx: number;
  full: boolean;
}

export class TapperArcadeGame implements ArcadeGameInstance {
  public readonly logicalWidth = 740;
  public readonly logicalHeight = 560;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel: string;

  private readonly rootBeer: boolean;
  private readonly storageKey: string;
  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();
  private score = 0;
  private highScore = 0;
  private level = 1;
  private lives = 3;
  private clock = 0;
  private stateTimer = 0;

  private readonly barYs = [132, 240, 348, 456];
  private lane = 0;
  private bx = 612; // Authentic walkable bartender position along bar counter!
  private laneCd = 0;
  private pourCd = 0;
  private danceTimer = 0; // Tip Distraction pauses patrons!

  private patrons: TapperPatron[] = [];
  private mugs: TapperMug[] = [];
  private tips: Array<{ lane: number; x: number }> = [];
  private served = 0;
  private goal = 18;
  private spawnCd = 0.8;
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  constructor(rootBeer: boolean) {
    this.rootBeer = rootBeer;
    this.storageKey = rootBeer ? 'rootbeertapper_hd_highscore_v2' : 'tapper_hd_highscore_v2';
    this.highScore = readHighScore(this.storageKey);
    this.primaryActionLabel = rootBeer ? 'Serve Root Beer!' : 'Serve Frothy Mug!';
    this.setupStage(1);
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public startNewGame(): void {
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.phase = 'READY';
    this.stateTimer = 0.85;
    this.setupStage(1);
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.setupStage(1);
  }

  private setupStage(lvl: number): void {
    this.lane = 0;
    this.bx = 612;
    this.patrons = [];
    this.mugs = [];
    this.tips = [];
    this.served = 0;
    this.goal = 14 + lvl * 4;
    this.danceTimer = 0;
    this.spawnCd = 0.6;
  }

  private failRound(reason: string): void {
    this.lives -= 1;
    arcadeAudio.playDeath();
    this.popups.push({ x: 370, y: 240, text: reason, color: '#EF4444', life: 1.0, maxLife: 1.0 });
    if (this.lives <= 0) this.phase = 'GAME_OVER';
    else {
      this.patrons = [];
      this.mugs = [];
      this.bx = 612;
    }
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
        this.level += 1;
        this.phase = 'READY';
        this.stateTimer = 0.85;
        this.setupStage(this.level);
      }
      return;
    }

    const attract = this.phase === 'TITLE';
    this.laneCd = Math.max(0, this.laneCd - dt);
    this.pourCd = Math.max(0, this.pourCd - dt);
    this.danceTimer = Math.max(0, this.danceTimer - dt);

    if (!attract) {
      if (this.laneCd <= 0) {
        if (this.input.up) {
          this.lane = (this.lane + 3) % 4;
          this.bx = 612;
          this.laneCd = 0.16;
          arcadeAudio.playPaddleBounce();
        } else if (this.input.down) {
          this.lane = (this.lane + 1) % 4;
          this.bx = 612;
          this.laneCd = 0.16;
          arcadeAudio.playPaddleBounce();
        }
      }
      // Walk Left/Right along the bar to grab Tips and catch returning empty mugs!
      if (this.input.left) this.bx = Math.max(120, this.bx - 320 * dt);
      if (this.input.right) this.bx = Math.min(612, this.bx + 320 * dt);

      if (this.input.fireJustPressed && this.pourCd <= 0) {
        this.bx = 612; // Snap to tap & pour!
        this.pourCd = 0.2;
        this.mugs.push({ lane: this.lane, x: 590, vx: -420, full: true });
        arcadeAudio.playThrow();
      }
    }

    // Collect shimmering Tips! (Triggers Can-Can Dancer distraction pausing patrons!)
    for (let i = this.tips.length - 1; i >= 0; i--) {
      const tip = this.tips[i];
      if (!attract && tip.lane === this.lane && Math.abs(tip.x - this.bx) < 32) {
        this.tips.splice(i, 1);
        this.score += 1500;
        if (this.score > this.highScore) {
          this.highScore = this.score;
          saveHighScore(this.storageKey, this.highScore);
        }
        this.danceTimer = 3.6;
        arcadeAudio.playPowerUp();
        this.popups.push({ x: this.bx, y: this.barYs[this.lane] - 28, text: 'TIP! DANCERS +1500', color: '#4ADE80', life: 1.0, maxLife: 1.0 });
      }
    }

    // Spawn Patrons
    this.spawnCd -= dt;
    if (this.spawnCd <= 0 && this.patrons.length < 4 + this.level) {
      this.spawnCd = Math.max(0.85, 1.85 - this.level * 0.12);
      const lane = Math.floor(Math.random() * 4);
      const colors = ['#EF4444', '#38BDF8', '#A855F7', '#F59E0B'];
      this.patrons.push({
        lane,
        x: 92,
        speed: 44 + this.level * 8,
        drinking: 0,
        color: colors[lane % 4],
      });
    }

    // Move Mugs
    for (let i = this.mugs.length - 1; i >= 0; i--) {
      const m = this.mugs[i];
      m.x += m.vx * dt;
      if (m.full) {
        let caught = false;
        for (const p of this.patrons) {
          if (p.lane === m.lane && p.drinking <= 0 && Math.abs(p.x - m.x) < 26) {
            p.drinking = 0.7;
            p.x -= 82;
            caught = true;
            this.score += 100;
            if (this.score > this.highScore) {
              this.highScore = this.score;
              saveHighScore(this.storageKey, this.highScore);
            }
            if (p.x < 96) {
              // Patron satisfied & exits door!
              this.served += 1;
              if (Math.random() < 0.35) this.tips.push({ lane: p.lane, x: 220 + Math.random() * 240 });
              arcadeAudio.playCoin();
            } else {
              // Slides empty mug back toward bartender!
              this.mugs.push({ lane: m.lane, x: p.x + 24, vx: 195 + this.level * 12, full: false });
            }
            break;
          }
        }
        if (caught) {
          this.mugs.splice(i, 1);
          continue;
        }
        if (m.x < 85) {
          this.mugs.splice(i, 1);
          if (!attract) this.failRound('SMASHED FULL MUG!');
          return;
        }
      } else {
        // Returning empty mug — catch anywhere along the bar!
        if (!attract && m.lane === this.lane && Math.abs(m.x - this.bx) < 34) {
          this.score += 100;
          arcadeAudio.playCoin();
          this.mugs.splice(i, 1);
          continue;
        }
        if (m.x > 635) {
          this.mugs.splice(i, 1);
          if (!attract) this.failRound('DROPPED EMPTY MUG!');
          return;
        }
      }
    }

    // Update Patrons
    for (let i = this.patrons.length - 1; i >= 0; i--) {
      const p = this.patrons[i];
      if (p.x < 96) {
        this.patrons.splice(i, 1);
        continue;
      }
      if (p.drinking > 0) {
        p.drinking -= dt;
      } else if (this.danceTimer <= 0) {
        p.x += p.speed * dt;
      }
      if (!attract && p.x > 596) {
        this.failRound('PATRON REACHED THE TAP!');
        return;
      }
    }

    if (!attract && this.served >= this.goal) {
      arcadeAudio.playStageClear();
      this.score += 1500;
      this.phase = 'STAGE_CLEAR';
      this.stateTimer = 1.4;
    }
  }

  public getHudSnapshot(): ClassicGameHud {
    const venues = this.rootBeer ? ['SODA SHOP', 'ARCADE CAFE', 'MALT BAR', 'SPACE DINER'] : ['WESTERN SALOON', 'SPORTS BAR', 'PUNK CLUB', 'ALIEN CANTINA'];
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: `${venues[(this.level - 1) % 4]} · ROUND ${this.level}`,
      primaryMetricLabel: 'SERVED',
      primaryMetricValue: `${this.served}/${this.goal}`,
      secondaryMetricLabel: 'SHOW',
      secondaryMetricValue: this.danceTimer > 0 ? 'DANCERS!' : 'WALK FOR TIPS',
      bannerText: this.phase === 'STAGE_CLEAR' ? 'CLOSING TIME!' : this.phase === 'GAME_OVER' ? 'GAME OVER' : '',
    };
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = this.logicalWidth;
    const H = this.logicalHeight;

    ctx.fillStyle = this.rootBeer ? '#1E1B4B' : '#29150E';
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < 4; i++) {
      const y = this.barYs[i];
      // Swinging entrance door
      ctx.fillStyle = '#78350F';
      ctx.fillRect(58, y - 30, 26, 48);
      // Polished wooden bar counter
      ctx.fillStyle = '#B45309';
      ctx.fillRect(92, y, 535, 22);
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(92, y, 535, 5);
      // Brass Keg Tap on right!
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(634, y - 22, 22, 34);
    }

    // Shimmering Tips on bar counters
    for (const tip of this.tips) {
      const y = this.barYs[tip.lane];
      ctx.fillStyle = '#4ADE80';
      ctx.fillRect(tip.x - 10, y - 14, 20, 12);
      ctx.fillStyle = '#052E16';
      ctx.font = '900 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('$', tip.x, y - 5);
    }

    // Patrons
    for (const p of this.patrons) {
      const y = this.barYs[p.lane];
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 12, y - 28, 24, 28);
      ctx.fillStyle = '#FDE68A';
      ctx.beginPath();
      ctx.arc(p.x, y - 36, 9, 0, Math.PI * 2);
      ctx.fill();
    }

    // Mugs
    for (const m of this.mugs) {
      const y = this.barYs[m.lane];
      ctx.fillStyle = m.full ? (this.rootBeer ? '#92400E' : '#F59E0B') : '#CBD5E1';
      ctx.fillRect(m.x - 8, y - 18, 16, 18);
      if (m.full) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(m.x - 9, y - 22, 18, 6);
      }
    }

    // Bartender (walkable along bar!)
    const by = this.barYs[this.lane];
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(this.bx - 10, by - 30, 20, 30);
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(this.bx - 10, by - 14, 20, 14);
    ctx.fillStyle = '#FDE68A';
    ctx.beginPath();
    ctx.arc(this.bx, by - 38, 9, 0, Math.PI * 2);
    ctx.fill();

    renderParticlesAndPopups(ctx, this.particles, this.popups);
    if (this.phase === 'TITLE') {
      ctx.fillStyle = 'rgba(20, 10, 6, 0.72)';
      ctx.fillRect(0, H * 0.36, W, 110);
      ctx.textAlign = 'center';
      ctx.font = '900 34px "JetBrains Mono", monospace';
      ctx.fillStyle = '#FACC15';
      ctx.fillText(this.rootBeer ? 'ROOT BEER TAPPER' : 'TAPPER', W * 0.5, H * 0.36 + 46);
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText('SPACE TO POUR · LEFT/RIGHT TO WALK BAR FOR TIPS & CATCH EMPTY MUGS!', W * 0.5, H * 0.36 + 80);
    }
    if (visualMode === 'crt') renderCrtOverlay(ctx, W, H);
  }
}

// ============================================================================
// 3. PUZZLE BOBBLE / BUST-A-MOVE (1994 Taito — Descending Compressor, Shot Timer & Bank Aim!)
// ============================================================================
export class PuzzleBobbleArcadeGame implements ArcadeGameInstance {
  public readonly logicalWidth = 540;
  public readonly logicalHeight = 680;
  public readonly supportsPointerAim = true;
  public readonly primaryActionLabel = 'Launch Bubble';

  private storageKey = 'puzzlebobble_hd_highscore_v2';
  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();
  private score = 0;
  private highScore = 0;
  private level = 1;
  private clock = 0;
  private stateTimer = 0;

  private readonly cols = 8;
  private readonly rows = 12;
  private readonly r = 24;
  private readonly leftWall = 78;
  private readonly palette = ['#EF4444', '#38BDF8', '#22C55E', '#FACC15', '#A855F7'];

  private grid: number[][] = [];
  private ceilingDrop = 0; // Authentic Taito descending metal compressor!
  private shotsUntilDrop = 7;
  private aimAngle = -Math.PI * 0.5;
  private shotTimer = 8.0; // Authentic auto-fire countdown!
  private curColor = 0;
  private nextColor = 1;
  private flying: { x: number; y: number; vx: number; vy: number; color: number } | null = null;
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  constructor() {
    this.highScore = readHighScore(this.storageKey);
    this.setupRound(1);
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public startNewGame(): void {
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.level = 1;
    this.phase = 'READY';
    this.stateTimer = 0.85;
    this.setupRound(1);
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.setupRound(1);
  }

  private cellPos(row: number, col: number): { x: number; y: number } {
    const offset = row % 2 === 1 ? this.r : 0;
    return {
      x: this.leftWall + col * (this.r * 2) + this.r + offset,
      y: 66 + this.ceilingDrop * 42 + row * 42,
    };
  }

  private setupRound(lvl: number): void {
    this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(-1));
    this.ceilingDrop = 0;
    this.shotsUntilDrop = Math.max(4, 8 - Math.floor(lvl / 3));
    this.shotTimer = 8.0;
    this.flying = null;
    const fillRows = Math.min(6, 3 + Math.floor((lvl + 1) / 2));
    for (let r = 0; r < fillRows; r++) {
      const maxC = r % 2 === 1 ? this.cols - 1 : this.cols;
      for (let c = 0; c < maxC; c++) {
        this.grid[r][c] = (r + Math.floor(c / 2) + lvl) % this.palette.length;
      }
    }
    this.curColor = this.pickLiveColor();
    this.nextColor = this.pickLiveColor();
  }

  private pickLiveColor(): number {
    const live = new Set<number>();
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) if (this.grid[r][c] >= 0) live.add(this.grid[r][c]);
    const arr = Array.from(live);
    return arr.length > 0 ? arr[Math.floor(Math.random() * arr.length)] : Math.floor(Math.random() * this.palette.length);
  }

  private neighbors(r: number, c: number): Array<[number, number]> {
    const odd = r % 2 === 1;
    const offs = odd
      ? [
          [0, -1],
          [0, 1],
          [-1, 0],
          [-1, 1],
          [1, 0],
          [1, 1],
        ]
      : [
          [0, -1],
          [0, 1],
          [-1, -1],
          [-1, 0],
          [1, -1],
          [1, 0],
        ];
    const out: Array<[number, number]> = [];
    for (const [dr, dc] of offs) {
      const nr = r + dr;
      const nc = c + dc;
      const maxC = nr % 2 === 1 ? this.cols - 1 : this.cols;
      if (nr >= 0 && nr < this.rows && nc >= 0 && nc < maxC) out.push([nr, nc]);
    }
    return out;
  }

  private snapBubble(x: number, y: number, color: number): void {
    let bestR = 0;
    let bestC = 0;
    let bestD = 9999;
    for (let r = 0; r < this.rows; r++) {
      const maxC = r % 2 === 1 ? this.cols - 1 : this.cols;
      for (let c = 0; c < maxC; c++) {
        if (this.grid[r][c] !== -1) continue;
        const p = this.cellPos(r, c);
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < bestD) {
          bestD = d;
          bestR = r;
          bestC = c;
        }
      }
    }
    this.grid[bestR][bestC] = color;

    // Flood-fill matching 3+ cluster!
    const visited = new Set<string>([`${bestR},${bestC}`]);
    const stack: Array<[number, number]> = [[bestR, bestC]];
    const group: Array<[number, number]> = [];
    while (stack.length > 0) {
      const [cr, cc] = stack.pop()!;
      group.push([cr, cc]);
      for (const [nr, nc] of this.neighbors(cr, cc)) {
        const key = `${nr},${nc}`;
        if (!visited.has(key) && this.grid[nr][nc] === color) {
          visited.add(key);
          stack.push([nr, nc]);
        }
      }
    }

    if (group.length >= 3) {
      for (const [gr, gc] of group) {
        const p = this.cellPos(gr, gc);
        spawnBurst(this.particles, p.x, p.y, this.palette[color], 8, 160, 2.8);
        this.grid[gr][gc] = -1;
      }
      arcadeAudio.playPowerUp();
      this.score += group.length * 100;

      // Drop unanchored floating bubbles!
      const anchored = new Set<string>();
      const q: Array<[number, number]> = [];
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[0][c] >= 0) {
          anchored.add(`0,${c}`);
          q.push([0, c]);
        }
      }
      while (q.length > 0) {
        const [cr, cc] = q.pop()!;
        for (const [nr, nc] of this.neighbors(cr, cc)) {
          const key = `${nr},${nc}`;
          if (!anchored.has(key) && this.grid[nr][nc] >= 0) {
            anchored.add(key);
            q.push([nr, nc]);
          }
        }
      }
      let dropped = 0;
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          if (this.grid[r][c] >= 0 && !anchored.has(`${r},${c}`)) {
            const p = this.cellPos(r, c);
            spawnBurst(this.particles, p.x, p.y, this.palette[this.grid[r][c]], 6, 130, 2.4);
            this.grid[r][c] = -1;
            dropped++;
          }
        }
      }
      if (dropped > 0) {
        this.score += dropped * 250;
        this.popups.push({ x: 270, y: 260, text: `DROP BONUS +${dropped * 250}!`, color: '#4ADE80', life: 0.9, maxLife: 0.9 });
      }
      if (this.score > this.highScore) {
        this.highScore = this.score;
        saveHighScore(this.storageKey, this.highScore);
      }
    } else {
      arcadeAudio.playRockThud();
    }

    // Authentic Descending Ceiling Compressor!
    this.shotsUntilDrop -= 1;
    if (this.shotsUntilDrop <= 0) {
      this.ceilingDrop += 1;
      this.shotsUntilDrop = Math.max(4, 8 - Math.floor(this.level / 3));
      arcadeAudio.playRockThud();
    }

    // Check clear or game over line!
    let anyLeft = false;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c] >= 0) {
          anyLeft = true;
          if (this.cellPos(r, c).y >= 542) {
            arcadeAudio.playDeath();
            this.phase = 'GAME_OVER';
            return;
          }
        }
      }
    }
    if (!anyLeft) {
      arcadeAudio.playStageClear();
      this.score += 1500;
      this.phase = 'STAGE_CLEAR';
      this.stateTimer = 1.4;
      return;
    }

    this.curColor = this.nextColor;
    this.nextColor = this.pickLiveColor();
    this.shotTimer = 8.0;
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
        this.level += 1;
        this.phase = 'READY';
        this.stateTimer = 0.85;
        this.setupRound(this.level);
      }
      return;
    }

    const attract = this.phase === 'TITLE';
    if (attract) {
      this.aimAngle = -Math.PI * 0.5 + Math.sin(this.clock * 1.4) * 1.05;
    } else if (this.input.pointerActive) {
      this.aimAngle = Math.atan2(this.input.pointerY - 600, this.input.pointerX - 270);
    } else {
      if (this.input.left) this.aimAngle -= 1.85 * dt;
      if (this.input.right) this.aimAngle += 1.85 * dt;
    }
    this.aimAngle = Math.max(-Math.PI + 0.24, Math.min(-0.24, this.aimAngle));

    if (!this.flying) {
      if (!attract) this.shotTimer -= dt;
      const fire = attract ? Math.sin(this.clock * 3) > 0.95 : this.input.fireJustPressed || this.input.up || this.shotTimer <= 0;
      if (fire) {
        this.flying = {
          x: 270,
          y: 600,
          vx: Math.cos(this.aimAngle) * 620,
          vy: Math.sin(this.aimAngle) * 620,
          color: this.curColor,
        };
        if (!attract) arcadeAudio.playThrow();
      }
    } else {
      this.flying.x += this.flying.vx * dt;
      this.flying.y += this.flying.vy * dt;
      const rightWall = this.leftWall + this.cols * (this.r * 2);
      if (this.flying.x - this.r < this.leftWall) {
        this.flying.x = this.leftWall + this.r;
        this.flying.vx = Math.abs(this.flying.vx);
        if (!attract) arcadeAudio.playPaddleBounce();
      } else if (this.flying.x + this.r > rightWall) {
        this.flying.x = rightWall - this.r;
        this.flying.vx = -Math.abs(this.flying.vx);
        if (!attract) arcadeAudio.playPaddleBounce();
      }
      let hit = this.flying.y <= 66 + this.ceilingDrop * 42;
      if (!hit) {
        for (let r = 0; r < this.rows && !hit; r++) {
          for (let c = 0; c < this.cols && !hit; c++) {
            if (this.grid[r][c] < 0) continue;
            const p = this.cellPos(r, c);
            if (Math.hypot(p.x - this.flying.x, p.y - this.flying.y) < this.r * 1.82) hit = true;
          }
        }
      }
      if (hit) {
        const f = this.flying;
        this.flying = null;
        if (!attract) this.snapBubble(f.x, f.y, f.color);
      }
    }
  }

  public getHudSnapshot(): ClassicGameHud {
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: 1,
      stageName: `PUZZLE BOBBLE · ROUND ${this.level}`,
      primaryMetricLabel: 'DROP IN',
      primaryMetricValue: `${this.shotsUntilDrop} SHOTS`,
      secondaryMetricLabel: 'TIMER',
      secondaryMetricValue: `${Math.max(0, Math.ceil(this.shotTimer))}s`,
      bannerText: this.phase === 'STAGE_CLEAR' ? 'ROUND CLEAR!' : this.phase === 'GAME_OVER' ? 'GAME OVER' : '',
    };
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = this.logicalWidth;
    const H = this.logicalHeight;

    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, W, H);

    const rightWall = this.leftWall + this.cols * (this.r * 2);
    // Playfield frame + Descending Ceiling Compressor
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(this.leftWall, 42, rightWall - this.leftWall, 580);
    ctx.fillStyle = '#475569';
    ctx.fillRect(this.leftWall, 42, rightWall - this.leftWall, this.ceilingDrop * 42 + 4);
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 4;
    ctx.strokeRect(this.leftWall, 42, rightWall - this.leftWall, 580);

    // Danger Deadline
    ctx.strokeStyle = '#EF4444';
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(this.leftWall, 542);
    ctx.lineTo(rightWall, 542);
    ctx.stroke();
    ctx.setLineDash([]);

    // Bubbles
    const drawBubble = (x: number, y: number, cIdx: number) => {
      ctx.fillStyle = this.palette[cIdx];
      ctx.beginPath();
      ctx.arc(x, y, this.r - 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.42)';
      ctx.beginPath();
      ctx.arc(x - 7, y - 7, 6, 0, Math.PI * 2);
      ctx.fill();
    };

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c] < 0) continue;
        const p = this.cellPos(r, c);
        drawBubble(p.x, p.y, this.grid[r][c]);
      }
    }
    if (this.flying) drawBubble(this.flying.x, this.flying.y, this.flying.color);

    // Dotted Bank-Shot Aim Guide
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
    ctx.setLineDash([6, 8]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(270, 600);
    ctx.lineTo(270 + Math.cos(this.aimAngle) * 180, 600 + Math.sin(this.aimAngle) * 180);
    ctx.stroke();
    ctx.setLineDash([]);

    // Launcher pointer + current & next bubble
    drawBubble(270, 600, this.curColor);
    drawBubble(195, 622, this.nextColor);

    renderParticlesAndPopups(ctx, this.particles, this.popups);
    if (this.phase === 'TITLE') {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.fillRect(0, H * 0.36, W, 110);
      ctx.textAlign = 'center';
      ctx.font = '900 32px "JetBrains Mono", monospace';
      ctx.fillStyle = '#4ADE80';
      ctx.fillText('PUZZLE BOBBLE', W * 0.5, H * 0.36 + 46);
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText('MATCH 3+ BUBBLES · BEAT THE DESCENDING CEILING & SHOT TIMER!', W * 0.5, H * 0.36 + 80);
    }
    if (visualMode === 'crt') renderCrtOverlay(ctx, W, H);
  }
}

// ============================================================================
// 4. CRYSTAL CASTLES (1983 Atari — Multi-Level Isometric 3D Castle, Gem Eaters, Magic Hat & Berthilda!)
// ============================================================================
export class CrystalCastlesArcadeGame implements ArcadeGameInstance {
  public readonly logicalWidth = 720;
  public readonly logicalHeight = 580;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'Jump!';

  private storageKey = 'crystalcastles_hd_highscore_v2';
  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();
  private score = 0;
  private highScore = 0;
  private level = 1;
  private lives = 3;
  private clock = 0;
  private stateTimer = 0;

  // 10x10 isometric castle with authentic heights (0 ground, 1 stairs/ramp, 2 upper terrace, -1 wall)!
  private readonly size = 10;
  private heightMap: number[][] = [];
  private gems: boolean[][] = [];
  private bx = 1.5;
  private by = 8.5;
  private bz = 0;
  private bJump = 0;
  private bJumpV = 0;
  private invulnTimer = 0;
  private hatTimer = 0;
  private magicHat = { x: 8, y: 1, taken: false };

  private foes: Array<{ x: number; y: number; vx: number; vy: number; kind: 'gemeater' | 'berthilda' | 'skeleton'; eatingTimer: number }> = [];
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  constructor() {
    this.highScore = readHighScore(this.storageKey);
    this.setupCastle(1);
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public startNewGame(): void {
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.phase = 'READY';
    this.stateTimer = 0.85;
    this.setupCastle(1);
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.setupCastle(1);
  }

  private iso(gx: number, gy: number, gz: number): { x: number; y: number } {
    return {
      x: 360 + (gx - gy) * 32,
      y: 165 + (gx + gy) * 18 - gz * 24,
    };
  }

  private setupCastle(lvl: number): void {
    // Authentic multi-elevation castle with raised central terrace, stairs, and battlements!
    this.heightMap = Array.from({ length: this.size }, (_, r) =>
      Array.from({ length: this.size }, (__, c) => {
        if (r >= 2 && r <= 6 && c >= 2 && c <= 6) {
          if (r === 4 && c === 4) return -1; // Central tower pillar
          return 2; // Upper raised castle deck
        }
        if ((r === 4 && c === 1) || (r === 4 && c === 7) || (r === 7 && c === 4)) return 1; // Staircases!
        return 0; // Courtyard floor
      }),
    );
    this.gems = Array.from({ length: this.size }, (_, r) =>
      Array.from({ length: this.size }, (__, c) => this.heightMap[r][c] >= 0 && (r + c) % 2 === 0),
    );
    this.bx = 1.2;
    this.by = 8.4;
    this.bz = 0;
    this.bJump = 0;
    this.bJumpV = 0;
    this.hatTimer = 0;
    this.magicHat = { x: 8, y: 1, taken: false };
    this.invulnTimer = 1.2;

    this.foes = [
      { x: 5.5, y: 2.5, vx: 1.4, vy: 0, kind: 'gemeater', eatingTimer: 0 },
      { x: 2.5, y: 5.5, vx: 0, vy: 1.4, kind: 'gemeater', eatingTimer: 0 },
      { x: 8.2, y: 2.2, vx: -1.6, vy: 1.1, kind: 'berthilda', eatingTimer: 0 },
    ];
    if (lvl >= 2) this.foes.push({ x: 7.5, y: 7.5, vx: -1.5, vy: 0, kind: 'skeleton', eatingTimer: 0 });
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
        this.level += 1;
        this.phase = 'READY';
        this.stateTimer = 0.85;
        this.setupCastle(this.level);
      }
      return;
    }

    const attract = this.phase === 'TITLE';
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    this.hatTimer = Math.max(0, this.hatTimer - dt);

    if (!attract) {
      let dx = 0;
      let dy = 0;
      if (this.input.left) {
        dx -= 1;
        dy += 1;
      }
      if (this.input.right) {
        dx += 1;
        dy -= 1;
      }
      if (this.input.up) {
        dx -= 1;
        dy -= 1;
      }
      if (this.input.down) {
        dx += 1;
        dy += 1;
      }
      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy);
        const nx = Math.max(0.2, Math.min(this.size - 0.3, this.bx + (dx / len) * 3.8 * dt));
        const ny = Math.max(0.2, Math.min(this.size - 0.3, this.by + (dy / len) * 3.8 * dt));
        const targetH = this.heightMap[Math.floor(ny)][Math.floor(nx)];
        // Can walk onto stairs/same elevation OR jump up to higher terrace!
        if (targetH >= 0 && targetH <= this.bz + 1.1 + (this.bJump > 0.35 ? 1.2 : 0)) {
          this.bx = nx;
          this.by = ny;
          this.bz = targetH;
        }
      }
      if (this.input.fireJustPressed && this.bJump <= 0) {
        this.bJumpV = 5.4;
        arcadeAudio.playJump();
      }
    }

    if (this.bJump > 0 || this.bJumpV > 0) {
      this.bJump += this.bJumpV * dt;
      this.bJumpV -= 15.5 * dt;
      if (this.bJump <= 0) {
        this.bJump = 0;
        this.bJumpV = 0;
      }
    }

    // Collect Magic Hat (defeats Berthilda the Witch!)
    if (!attract && !this.magicHat.taken && Math.hypot(this.bx - this.magicHat.x, this.by - this.magicHat.y) < 0.7) {
      this.magicHat.taken = true;
      this.hatTimer = 7.0;
      arcadeAudio.playPowerUp();
      const pt = this.iso(this.bx, this.by, this.bz);
      this.popups.push({ x: pt.x, y: pt.y - 24, text: 'MAGIC HAT! HUNT BERTHILDA!', color: '#FACC15', life: 1.2, maxLife: 1.2 });
    }

    // Collect Gems
    const gr = Math.floor(this.by);
    const gc = Math.floor(this.bx);
    if (!attract && this.gems[gr]?.[gc]) {
      this.gems[gr][gc] = false;
      this.score += 100;
      if (this.score > this.highScore) {
        this.highScore = this.score;
        saveHighScore(this.storageKey, this.highScore);
      }
      arcadeAudio.playCoin();
    }

    // Update Foes (Gem Eaters actually eat gems and are vulnerable while eating!)
    for (let i = this.foes.length - 1; i >= 0; i--) {
      const f = this.foes[i];
      if (f.eatingTimer > 0) {
        f.eatingTimer -= dt;
      } else {
        if (f.kind === 'berthilda') {
          const ang = Math.atan2(this.by - f.y, this.bx - f.x);
          const dir = this.hatTimer > 0 ? -1 : 1;
          f.x = Math.max(0.5, Math.min(this.size - 0.5, f.x + Math.cos(ang) * dir * 1.9 * dt));
          f.y = Math.max(0.5, Math.min(this.size - 0.5, f.y + Math.sin(ang) * dir * 1.9 * dt));
        } else {
          f.x += f.vx * dt;
          f.y += f.vy * dt;
          if (f.x < 0.5 || f.x > this.size - 0.5) f.vx = -f.vx;
          if (f.y < 0.5 || f.y > this.size - 0.5) f.vy = -f.vy;
          if (f.kind === 'gemeater') {
            const fr = Math.floor(f.y);
            const fc = Math.floor(f.x);
            if (this.gems[fr]?.[fc]) {
              this.gems[fr][fc] = false;
              f.eatingTimer = 1.6; // Vulnerable while chomping gem!
            }
          }
        }
      }

      if (!attract && this.bJump < 0.55 && Math.hypot(f.x - this.bx, f.y - this.by) < 0.65) {
        if (this.hatTimer > 0 || (f.kind === 'gemeater' && f.eatingTimer > 0)) {
          const pt = this.iso(f.x, f.y, 1);
          spawnBurst(this.particles, pt.x, pt.y, '#FACC15', 18, 200, 3);
          arcadeAudio.playStomp();
          this.score += f.kind === 'berthilda' ? 3000 : 1000;
          this.popups.push({ x: pt.x, y: pt.y - 20, text: f.kind === 'berthilda' ? 'BERTHILDA KO +3000!' : 'GEM EATER +1000!', color: '#4ADE80', life: 1.0, maxLife: 1.0 });
          this.foes.splice(i, 1);
        } else if (this.invulnTimer <= 0) {
          this.lives -= 1;
          this.invulnTimer = 1.6;
          arcadeAudio.playDeath();
          if (this.lives <= 0) this.phase = 'GAME_OVER';
          else {
            this.bx = 1.2;
            this.by = 8.4;
            this.bz = 0;
          }
          return;
        }
      }
    }

    let left = 0;
    for (let r = 0; r < this.size; r++) for (let c = 0; c < this.size; c++) if (this.gems[r][c]) left++;
    if (!attract && left === 0) {
      arcadeAudio.playStageClear();
      this.score += 2000;
      this.phase = 'STAGE_CLEAR';
      this.stateTimer = 1.4;
    }
  }

  public getHudSnapshot(): ClassicGameHud {
    let left = 0;
    for (let r = 0; r < this.size; r++) for (let c = 0; c < this.size; c++) if (this.gems[r][c]) left++;
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: `CRYSTAL CASTLES · LEVEL ${this.level}`,
      primaryMetricLabel: 'GEMS LEFT',
      primaryMetricValue: String(left),
      secondaryMetricLabel: 'MAGIC HAT',
      secondaryMetricValue: this.hatTimer > 0 ? `${Math.ceil(this.hatTimer)}s` : this.magicHat.taken ? 'USED' : 'AVAILABLE',
      bannerText: this.phase === 'STAGE_CLEAR' ? 'CASTLE CLEARED!' : this.phase === 'GAME_OVER' ? 'GAME OVER' : '',
    };
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = this.logicalWidth;
    const H = this.logicalHeight;

    ctx.fillStyle = '#0B0F26';
    ctx.fillRect(0, 0, W, H);

    // Multi-elevation 3D Isometric Castle Tiles!
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const h = this.heightMap[r][c];
        const drawZ = h < 0 ? 3 : h;
        const p = this.iso(c + 0.5, r + 0.5, drawZ);
        // Side extrusion wall for raised terraces & tower!
        if (drawZ > 0) {
          ctx.fillStyle = h < 0 ? '#475569' : '#312E81';
          ctx.beginPath();
          ctx.moveTo(p.x - 30, p.y);
          ctx.lineTo(p.x, p.y + 17);
          ctx.lineTo(p.x + 30, p.y);
          ctx.lineTo(p.x + 30, p.y + drawZ * 24);
          ctx.lineTo(p.x, p.y + 17 + drawZ * 24);
          ctx.lineTo(p.x - 30, p.y + drawZ * 24);
          ctx.closePath();
          ctx.fill();
        }
        // Top diamond face
        ctx.fillStyle = h < 0 ? '#64748B' : h === 2 ? '#4F46E5' : h === 1 ? '#F59E0B' : (r + c) % 2 === 0 ? '#1E3A8A' : '#1D4ED8';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 17);
        ctx.lineTo(p.x + 30, p.y);
        ctx.lineTo(p.x, p.y + 17);
        ctx.lineTo(p.x - 30, p.y);
        ctx.closePath();
        ctx.fill();

        if (this.gems[r][c]) {
          ctx.fillStyle = '#38BDF8';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y - 11);
          ctx.lineTo(p.x + 7, p.y - 2);
          ctx.lineTo(p.x, p.y + 6);
          ctx.lineTo(p.x - 7, p.y - 2);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    // Magic Hat
    if (!this.magicHat.taken) {
      const hp = this.iso(this.magicHat.x + 0.5, this.magicHat.y + 0.5, 0);
      ctx.fillStyle = '#A855F7';
      ctx.beginPath();
      ctx.moveTo(hp.x, hp.y - 22);
      ctx.lineTo(hp.x + 12, hp.y - 2);
      ctx.lineTo(hp.x - 12, hp.y - 2);
      ctx.closePath();
      ctx.fill();
    }

    // Foes
    for (const f of this.foes) {
      const fz = Math.max(0, this.heightMap[Math.floor(f.y)]?.[Math.floor(f.x)] ?? 0);
      const fp = this.iso(f.x, f.y, f.kind === 'berthilda' ? 2.5 : fz);
      ctx.fillStyle = f.eatingTimer > 0 ? '#4ADE80' : f.kind === 'berthilda' ? '#EC4899' : '#EF4444';
      ctx.beginPath();
      ctx.arc(fp.x, fp.y - 10, 12, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bentley Bear
    const bp = this.iso(this.bx, this.by, this.bz + this.bJump * 0.6);
    ctx.fillStyle = this.hatTimer > 0 ? '#FACC15' : '#D97706';
    ctx.beginPath();
    ctx.arc(bp.x, bp.y - 12, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(bp.x, bp.y - 10, 6, 0, Math.PI * 2);
    ctx.fill();

    renderParticlesAndPopups(ctx, this.particles, this.popups);
    if (this.phase === 'TITLE') {
      ctx.fillStyle = 'rgba(11, 15, 38, 0.72)';
      ctx.fillRect(0, H * 0.36, W, 110);
      ctx.textAlign = 'center';
      ctx.font = '900 34px "JetBrains Mono", monospace';
      ctx.fillStyle = '#38BDF8';
      ctx.fillText('CRYSTAL CASTLES', W * 0.5, H * 0.36 + 46);
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText('CLIMB 3D STAIRS & TERRACES · SQUISH EATING GEM EATERS · MAGIC HAT VS BERTHILDA!', W * 0.5, H * 0.36 + 80);
    }
    if (visualMode === 'crt') renderCrtOverlay(ctx, W, H);
  }
}

// ============================================================================
// 5. RAMPAGE (1986 Bally Midway — Walk Street, Climb Buildings, Smash Windows for Food/People!)
// ============================================================================
interface RampageWindow {
  wx: number;
  wy: number;
  broken: boolean;
  item: 'none' | 'person' | 'food' | 'shock';
}

interface RampageBuilding {
  x: number;
  w: number;
  h: number;
  maxH: number;
  hp: number;
  maxHp: number;
  color: string;
  windows: RampageWindow[];
}

export class RampageArcadeGame implements ArcadeGameInstance {
  public readonly logicalWidth = 720;
  public readonly logicalHeight = 560;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'Punch / Eat!';
  public readonly secondaryActionLabel = 'Jump / Switch Monster';

  private storageKey = 'rampage_hd_highscore_v2';
  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();
  private score = 0;
  private highScore = 0;
  private level = 1;
  private health = 100;
  private clock = 0;
  private stateTimer = 0;

  private monsterIdx = 0; // 0 George, 1 Lizzie, 2 Ralph
  private px = 190;
  private py = 474;
  private pvy = 0;
  private climbing = false;
  private punchCd = 0;
  private buildings: RampageBuilding[] = [];
  private choppers: Array<{ x: number; y: number; vx: number; fireCd: number }> = [];
  private tanks: Array<{ x: number; vx: number; fireCd: number }> = [];
  private shots: Array<{ x: number; y: number; vx: number; vy: number }> = [];
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  constructor() {
    this.highScore = readHighScore(this.storageKey);
    this.setupCity(1);
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public startNewGame(): void {
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.level = 1;
    this.health = 100;
    this.phase = 'READY';
    this.stateTimer = 0.85;
    this.setupCity(1);
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.setupCity(1);
  }

  private setupCity(day: number): void {
    this.px = 180;
    this.py = 474;
    this.pvy = 0;
    this.climbing = false;
    this.shots = [];
    const specs = [
      { x: 90, w: 120, h: 270, color: '#64748B' },
      { x: 242, w: 132, h: 340, color: '#475569' },
      { x: 406, w: 122, h: 300, color: '#92400E' },
      { x: 556, w: 112, h: 240, color: '#1E3A8A' },
    ];
    this.buildings = specs.map((sp) => {
      const windows: RampageWindow[] = [];
      for (let wy = 500 - sp.h + 24; wy < 476; wy += 36) {
        for (let wx = sp.x + 22; wx < sp.x + sp.w - 18; wx += 32) {
          const r = Math.random();
          windows.push({ wx, wy, broken: false, item: r < 0.25 ? 'person' : r < 0.45 ? 'food' : r < 0.56 ? 'shock' : 'none' });
        }
      }
      return { ...sp, maxH: sp.h, hp: 8 + day, maxHp: 8 + day, windows };
    });
    this.choppers = [
      { x: 100, y: 110, vx: 115, fireCd: 1.8 },
      { x: 600, y: 168, vx: -125, fireCd: 2.2 },
    ];
    this.tanks = [{ x: 650, vx: -72, fireCd: 2.2 }];
  }

  private getClimbedBuilding(): RampageBuilding | undefined {
    return this.buildings.find((b) => b.hp > 0 && this.px >= b.x - 16 && this.px <= b.x + b.w + 16 && this.py >= 500 - b.h - 14);
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
        this.level += 1;
        this.health = Math.min(100, this.health + 35);
        this.phase = 'READY';
        this.stateTimer = 0.85;
        this.setupCity(this.level);
      }
      return;
    }

    const attract = this.phase === 'TITLE';
    this.punchCd = Math.max(0, this.punchCd - dt);

    if (attract) {
      this.px = 360 + Math.sin(this.clock * 1.0) * 190;
      this.py = 474;
    } else {
      const onBld = this.getClimbedBuilding();
      this.climbing = Boolean(onBld && this.py < 472);

      const spd = 215;
      if (this.input.left) this.px -= spd * dt;
      if (this.input.right) this.px += spd * dt;
      if (this.input.up && onBld) {
        this.climbing = true;
        this.pvy = 0;
        this.py = Math.max(500 - onBld.h, this.py - spd * 0.85 * dt);
      } else if (this.input.down && this.climbing) {
        this.py = Math.min(474, this.py + spd * 0.9 * dt);
      } else if (!this.climbing) {
        // Real gravity when walking street or leaping between skyscrapers!
        this.pvy += 880 * dt;
        this.py += this.pvy * dt;
        if (this.py >= 474) {
          this.py = 474;
          this.pvy = 0;
        }
      }

      if (this.input.secondaryJustPressed) {
        if (this.py >= 470 || this.climbing) {
          this.climbing = false;
          this.pvy = -410; // Leap across to adjacent building!
          arcadeAudio.playJump();
        } else {
          this.monsterIdx = (this.monsterIdx + 1) % 3;
          arcadeAudio.playCoin();
        }
      }
      this.px = Math.max(36, Math.min(this.logicalWidth - 36, this.px));

      if (this.input.fireJustPressed && this.punchCd <= 0) {
        this.punchCd = 0.22;
        arcadeAudio.playExplosion(false);
        // Swat Helicopter or Stomp Tank!
        for (const c of this.choppers) {
          if (Math.hypot(c.x - this.px, c.y - this.py) < 58) {
            spawnBurst(this.particles, c.x, c.y, '#FACC15', 20, 240, 3.6);
            c.x = c.vx > 0 ? -40 : this.logicalWidth + 40;
            this.score += 750;
            this.health = Math.min(100, this.health + 12);
            this.popups.push({ x: this.px, y: this.py - 32, text: 'CHOPPER EATEN! +750', color: '#4ADE80', life: 0.9, maxLife: 0.9 });
          }
        }
        for (const t of this.tanks) {
          if (this.py > 430 && Math.abs(t.x - this.px) < 46) {
            spawnBurst(this.particles, t.x, 482, '#F97316', 18, 220, 3.4);
            t.x = t.vx > 0 ? -50 : this.logicalWidth + 50;
            this.score += 500;
            this.popups.push({ x: this.px, y: 445, text: 'TANK SMASHED! +500', color: '#FACC15', life: 0.9, maxLife: 0.9 });
          }
        }
        // Smash Building Windows -> Reveal People/Food/Shock!
        for (const b of this.buildings) {
          if (b.hp > 0 && this.px >= b.x - 24 && this.px <= b.x + b.w + 24 && this.py >= 500 - b.h - 24) {
            const win = b.windows.find((w) => !w.broken && Math.hypot(w.wx - this.px, w.wy - this.py) < 42);
            if (win) {
              win.broken = true;
              if (win.item === 'person' || win.item === 'food') {
                this.health = Math.min(100, this.health + 14);
                this.score += 300;
                this.popups.push({ x: win.wx, y: win.wy - 16, text: win.item === 'person' ? 'GULP! +HP' : 'ROAST FOOD +HP', color: '#4ADE80', life: 0.9, maxLife: 0.9 });
              } else if (win.item === 'shock') {
                this.health -= 10;
                this.popups.push({ x: win.wx, y: win.wy - 16, text: 'ZAPPED BY TV!', color: '#EF4444', life: 0.9, maxLife: 0.9 });
              }
            }
            b.hp -= 1;
            b.h = Math.max(0, (b.hp / b.maxHp) * b.maxH);
            spawnBurst(this.particles, this.px, this.py, '#CBD5E1', 12, 200, 3.2);
            this.score += b.hp <= 0 ? 1000 : 150;
            if (this.score > this.highScore) {
              this.highScore = this.score;
              saveHighScore(this.storageKey, this.highScore);
            }
            if (b.hp <= 0) {
              arcadeAudio.playExplosion(true);
              this.climbing = false;
              this.popups.push({ x: b.x + b.w * 0.5, y: 420, text: 'COLLAPSED! +1000', color: '#FACC15', life: 1.0, maxLife: 1.0 });
            }
            break;
          }
        }
      }
    }

    // Helicopters & Street Tanks
    for (const c of this.choppers) {
      c.x += c.vx * dt;
      if (c.x < 40 || c.x > this.logicalWidth - 40) c.vx = -c.vx;
      c.fireCd -= dt;
      if (c.fireCd <= 0 && !attract) {
        c.fireCd = Math.max(1.3, 2.5 - this.level * 0.12);
        const ang = Math.atan2(this.py - c.y, this.px - c.x);
        this.shots.push({ x: c.x, y: c.y, vx: Math.cos(ang) * 230, vy: Math.sin(ang) * 230 });
      }
    }
    for (const t of this.tanks) {
      t.x += t.vx * dt;
      if (t.x < 35 || t.x > this.logicalWidth - 35) t.vx = -t.vx;
      t.fireCd -= dt;
      if (t.fireCd <= 0 && !attract) {
        t.fireCd = 2.4;
        const ang = Math.atan2(this.py - 482, this.px - t.x);
        this.shots.push({ x: t.x, y: 482, vx: Math.cos(ang) * 220, vy: Math.sin(ang) * 220 });
      }
    }

    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (Math.hypot(s.x - this.px, s.y - this.py) < 24) {
        this.shots.splice(i, 1);
        this.health -= 10;
        arcadeAudio.playRockThud();
        if (this.health <= 0) {
          arcadeAudio.playDeath();
          this.phase = 'GAME_OVER';
        }
      } else if (s.x < 0 || s.x > this.logicalWidth || s.y < 0 || s.y > this.logicalHeight) {
        this.shots.splice(i, 1);
      }
    }

    if (!attract && this.buildings.every((b) => b.hp <= 0)) {
      arcadeAudio.playStageClear();
      this.score += 2000;
      this.phase = 'STAGE_CLEAR';
      this.stateTimer = 1.4;
    }
  }

  public getHudSnapshot(): ClassicGameHud {
    const names = ['GEORGE', 'LIZZIE', 'RALPH'];
    const standing = this.buildings.filter((b) => b.hp > 0).length;
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: Math.max(1, Math.ceil(this.health / 34)),
      stageName: `RAMPAGE · DAY ${this.level} (${names[this.monsterIdx]})`,
      primaryMetricLabel: 'BUILDINGS',
      primaryMetricValue: `${standing}/4`,
      secondaryMetricLabel: 'HEALTH',
      secondaryMetricValue: `${Math.max(0, Math.round(this.health))}%`,
      bannerText: this.phase === 'STAGE_CLEAR' ? 'CITY DEMOLISHED!' : this.phase === 'GAME_OVER' ? 'MONSTER DEFEATED' : '',
    };
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = this.logicalWidth;
    const H = this.logicalHeight;

    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#1E1B4B');
    sky.addColorStop(0.75, '#7C2D12');
    sky.addColorStop(1, '#1E293B');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 500, W, 60);

    for (const b of this.buildings) {
      if (b.hp <= 0) {
        ctx.fillStyle = '#475569';
        ctx.fillRect(b.x, 488, b.w, 14);
        continue;
      }
      const topY = 500 - b.h;
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, topY, b.w, b.h);
      for (const w of b.windows) {
        if (w.wy < topY + 6) continue;
        ctx.fillStyle = w.broken ? '#09090B' : '#FEF08A';
        ctx.fillRect(w.wx - 7, w.wy - 9, 14, 18);
      }
    }

    // Tanks & Helicopters
    for (const t of this.tanks) {
      ctx.fillStyle = '#15803D';
      ctx.fillRect(t.x - 18, 480, 36, 18);
    }
    for (const c of this.choppers) {
      ctx.fillStyle = '#22C55E';
      ctx.fillRect(c.x - 20, c.y - 8, 40, 16);
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(c.x - 28, c.y - 14, 56, 3);
    }

    ctx.fillStyle = '#EF4444';
    for (const s of this.shots) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    const mCols = ['#78350F', '#22C55E', '#94A3B8'];
    ctx.save();
    ctx.translate(this.px, this.py);
    ctx.fillStyle = mCols[this.monsterIdx];
    ctx.beginPath();
    ctx.roundRect(-20, -26, 40, 50, 10);
    ctx.fill();
    ctx.fillStyle = '#FEF08A';
    ctx.fillRect(-9, -16, 6, 6);
    ctx.fillRect(3, -16, 6, 6);
    if (this.punchCd > 0.08) {
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(24, -6, 13, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    renderParticlesAndPopups(ctx, this.particles, this.popups);
    if (this.phase === 'TITLE') {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
      ctx.fillRect(0, H * 0.36, W, 110);
      ctx.textAlign = 'center';
      ctx.font = '900 36px "JetBrains Mono", monospace';
      ctx.fillStyle = '#22C55E';
      ctx.fillText('RAMPAGE', W * 0.5, H * 0.36 + 46);
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText('WALK STREET · CLIMB SKYSCRAPERS · SMASH WINDOWS FOR FOOD · SHIFT TO LEAP!', W * 0.5, H * 0.36 + 80);
    }
    if (visualMode === 'crt') renderCrtOverlay(ctx, W, H);
  }
}

// ============================================================================
// 6. DRAGON'S LAIR (1983 Cinematronics — Edge-Triggered Multi-Beat Don Bluth Laserdisc Scenes!)
// ============================================================================
type LairPrompt = 'LEFT' | 'RIGHT' | 'UP' | 'DOWN' | 'SWORD';

interface LairBeat {
  cue: LairPrompt;
  desc: string;
  flashX: number;
  flashY: number;
}

interface LairScene {
  title: string;
  bgA: string;
  bgB: string;
  hazard: 'bridge' | 'ropes' | 'lizard' | 'knight' | 'dragon';
  beats: LairBeat[];
}

const LAIR_SCENES: LairScene[] = [
  {
    title: 'DRAWBRIDGE MOAT',
    bgA: '#1E1B4B',
    bgB: '#312E81',
    hazard: 'bridge',
    beats: [
      { cue: 'SWORD', desc: 'SLASH THE TENTACLE!', flashX: 430, flashY: 320 },
      { cue: 'UP', desc: 'LEAP THE BROKEN PLANKS!', flashX: 360, flashY: 220 },
      { cue: 'RIGHT', desc: 'DASH INTO THE CASTLE GATE!', flashX: 540, flashY: 310 },
    ],
  },
  {
    title: 'FLAMING ROPES CHAMBER',
    bgA: '#450A0A',
    bgB: '#7F1D1D',
    hazard: 'ropes',
    beats: [
      { cue: 'RIGHT', desc: 'GRAB THE SWINGING ROPE!', flashX: 480, flashY: 240 },
      { cue: 'UP', desc: 'VAULT OVER THE LAVA JET!', flashX: 360, flashY: 190 },
      { cue: 'LEFT', desc: 'LAND ON THE STONE ARCH!', flashX: 200, flashY: 310 },
    ],
  },
  {
    title: 'LIZARD KING THRONE',
    bgA: '#064E3B',
    bgB: '#1E293B',
    hazard: 'lizard',
    beats: [
      { cue: 'LEFT', desc: 'DODGE THE GOLD AVALANCHE!', flashX: 190, flashY: 300 },
      { cue: 'SWORD', desc: 'STRIKE THE LIZARD KING!', flashX: 460, flashY: 270 },
      { cue: 'UP', desc: 'ESCAPE UP THE SPIRAL STAIR!', flashX: 360, flashY: 185 },
    ],
  },
  {
    title: 'PHANTOM KNIGHT HALL',
    bgA: '#0F172A',
    bgB: '#1E293B',
    hazard: 'knight',
    beats: [
      { cue: 'DOWN', desc: 'DUCK THE PHANTOM LANCE!', flashX: 360, flashY: 420 },
      { cue: 'SWORD', desc: 'SHATTER THE SPECTRAL SHIELD!', flashX: 465, flashY: 265 },
      { cue: 'RIGHT', desc: 'ENTER SINGE’S LAIR!', flashX: 545, flashY: 300 },
    ],
  },
  {
    title: 'SINGE THE DRAGON’S CAVERN',
    bgA: '#3B0764',
    bgB: '#7C2D12',
    hazard: 'dragon',
    beats: [
      { cue: 'LEFT', desc: 'ROLL PAST DRAGONFIRE!', flashX: 190, flashY: 320 },
      { cue: 'UP', desc: 'CLAIM THE MAGIC SWORD!', flashX: 360, flashY: 190 },
      { cue: 'SWORD', desc: 'SLAY SINGE & FREE DAPHNE!', flashX: 475, flashY: 255 },
    ],
  },
];

export class DragonsLairArcadeGame implements ArcadeGameInstance {
  public readonly logicalWidth = 720;
  public readonly logicalHeight = 560;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'Sword Strike';

  private storageKey = 'dragonslair_hd_highscore_v2';
  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();
  private prevDirs = { left: false, right: false, up: false, down: false };

  private score = 0;
  private highScore = 0;
  private level = 1;
  private lives = 3;
  private clock = 0;
  private stateTimer = 0;

  private sceneIdx = 0;
  private beatIdx = 0;
  private cueWindow = 2.4;
  private cueElapsed = 0;
  private beatCooldown = 0;
  private dirkPose: 'idle' | 'slash' | 'leap' | 'dodge' | 'hurt' = 'idle';
  private poseTimer = 0;
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  constructor() {
    this.highScore = readHighScore(this.storageKey);
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public startNewGame(): void {
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.sceneIdx = 0;
    this.beatIdx = 0;
    this.cueElapsed = 0;
    this.beatCooldown = 0.35;
    this.dirkPose = 'idle';
    this.phase = 'READY';
    this.stateTimer = 0.85;
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.sceneIdx = 0;
    this.beatIdx = 0;
  }

  public step(dt: number): void {
    this.clock += dt;
    stepParticlesAndPopups(this.particles, this.popups, dt);

    const leftJust = this.input.left && !this.prevDirs.left;
    const rightJust = this.input.right && !this.prevDirs.right;
    const upJust = this.input.up && !this.prevDirs.up;
    const downJust = this.input.down && !this.prevDirs.down;
    this.prevDirs = { left: this.input.left, right: this.input.right, up: this.input.up, down: this.input.down };

    if (this.phase === 'PAUSED' || this.phase === 'GAME_OVER') return;
    if (this.phase === 'READY') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) this.phase = 'PLAYING';
      return;
    }
    if (this.phase === 'STAGE_CLEAR') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.level += 1;
        this.sceneIdx = 0;
        this.beatIdx = 0;
        this.cueElapsed = 0;
        this.beatCooldown = 0.4;
        this.phase = 'READY';
        this.stateTimer = 0.9;
      }
      return;
    }

    if (this.phase === 'TITLE') {
      this.sceneIdx = Math.floor(this.clock * 0.35) % LAIR_SCENES.length;
      return;
    }

    if (this.poseTimer > 0) {
      this.poseTimer -= dt;
      if (this.poseTimer <= 0) this.dirkPose = 'idle';
    }
    if (this.beatCooldown > 0) {
      this.beatCooldown -= dt;
      return;
    }

    const scene = LAIR_SCENES[this.sceneIdx];
    const beat = scene.beats[this.beatIdx];
    this.cueWindow = Math.max(1.25, 2.5 - this.level * 0.18);
    this.cueElapsed += dt;

    // Edge-triggered prompt check (holding a key will NEVER insta-fail the next beat!)
    let pressed: LairPrompt | null = null;
    if (this.input.fireJustPressed) pressed = 'SWORD';
    else if (leftJust) pressed = 'LEFT';
    else if (rightJust) pressed = 'RIGHT';
    else if (upJust) pressed = 'UP';
    else if (downJust) pressed = 'DOWN';

    if (pressed) {
      if (pressed === beat.cue) {
        this.dirkPose = pressed === 'SWORD' ? 'slash' : pressed === 'UP' ? 'leap' : 'dodge';
        this.poseTimer = 0.45;
        this.beatCooldown = 0.42;
        arcadeAudio.playPowerUp();
        const bonus = Math.round((this.cueWindow - this.cueElapsed) * 400) + 500;
        this.score += bonus;
        if (this.score > this.highScore) {
          this.highScore = this.score;
          saveHighScore(this.storageKey, this.highScore);
        }
        spawnBurst(this.particles, beat.flashX, beat.flashY, '#FACC15', 22, 240, 3.8);
        this.popups.push({ x: beat.flashX, y: beat.flashY - 24, text: `HEROIC! +${bonus}`, color: '#4ADE80', life: 0.85, maxLife: 0.85 });
        this.cueElapsed = 0;
        this.beatIdx += 1;
        if (this.beatIdx >= scene.beats.length) {
          this.beatIdx = 0;
          this.sceneIdx += 1;
          if (this.sceneIdx >= LAIR_SCENES.length) {
            arcadeAudio.playStageClear();
            this.phase = 'STAGE_CLEAR';
            this.stateTimer = 1.7;
          }
        }
        return;
      } else {
        this.failBeat();
        return;
      }
    }

    if (this.cueElapsed >= this.cueWindow) {
      this.failBeat();
    }
  }

  private failBeat(): void {
    this.dirkPose = 'hurt';
    this.poseTimer = 0.65;
    this.beatCooldown = 0.7;
    this.lives -= 1;
    this.cueElapsed = 0;
    arcadeAudio.playDeath();
    spawnBurst(this.particles, 230, 340, '#EF4444', 24, 220, 3.6);
    if (this.lives <= 0) this.phase = 'GAME_OVER';
  }

  public getHudSnapshot(): ClassicGameHud {
    const scene = LAIR_SCENES[Math.min(this.sceneIdx, LAIR_SCENES.length - 1)];
    const beat = scene.beats[Math.min(this.beatIdx, scene.beats.length - 1)];
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: `${scene.title} (${this.beatIdx + 1}/${scene.beats.length})`,
      primaryMetricLabel: 'SCENE',
      primaryMetricValue: `${Math.min(this.sceneIdx + 1, LAIR_SCENES.length)}/${LAIR_SCENES.length}`,
      secondaryMetricLabel: 'FLASH CUE',
      secondaryMetricValue: beat.cue,
      bannerText: this.phase === 'STAGE_CLEAR' ? 'PRINCESS DAPHNE RESCUED!' : this.phase === 'GAME_OVER' ? 'DIRK FALLS!' : '',
    };
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = this.logicalWidth;
    const H = this.logicalHeight;
    const scene = LAIR_SCENES[Math.min(this.sceneIdx, LAIR_SCENES.length - 1)];
    const beat = scene.beats[Math.min(this.beatIdx, scene.beats.length - 1)];

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, scene.bgA);
    bg.addColorStop(1, scene.bgB);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Gothic Stone Arch
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.25)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(360, 360, 250, Math.PI, 0);
    ctx.stroke();

    // Animated Scene Hazard / Singe the Dragon
    const pulse = Math.sin(this.clock * 6) * 14;
    ctx.save();
    ctx.translate(475, 255 + pulse * 0.4);
    ctx.fillStyle = scene.hazard === 'dragon' || scene.hazard === 'lizard' ? '#16A34A' : '#EF4444';
    ctx.beginPath();
    ctx.ellipse(0, 0, 74, 48, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.arc(-28, -14, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Animated Dirk the Daring!
    ctx.save();
    const dx = this.dirkPose === 'dodge' ? -42 : this.dirkPose === 'slash' ? 32 : 0;
    const dy = this.dirkPose === 'leap' ? -64 : 0;
    ctx.translate(225 + dx, 370 + dy);
    ctx.fillStyle = this.dirkPose === 'hurt' ? '#EF4444' : '#38BDF8';
    ctx.fillRect(-18, -32, 36, 56);
    ctx.fillStyle = '#FDE68A';
    ctx.beginPath();
    ctx.arc(0, -48, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#E2E8F0';
    ctx.rotate(this.dirkPose === 'slash' ? -0.45 : 0);
    ctx.fillRect(16, -24, 52, 6);
    ctx.restore();

    // Authentic Golden Laserdisc Flash Highlight on the actual hazard/exit!
    if (this.phase === 'PLAYING' && this.beatCooldown <= 0) {
      const timeLeft = Math.max(0, 1 - this.cueElapsed / this.cueWindow);
      const glow = 0.55 + 0.45 * Math.sin(this.clock * 20);
      ctx.strokeStyle = `rgba(250, 204, 21, ${glow})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(beat.flashX, beat.flashY, 44 + glow * 8, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
      ctx.beginPath();
      ctx.roundRect(160, 48, 400, 88, 14);
      ctx.fill();
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.font = '900 22px "JetBrains Mono", monospace';
      ctx.fillStyle = '#FEF08A';
      ctx.fillText(`${beat.cue === 'SWORD' ? 'SPACE (SWORD)' : beat.cue} — ${beat.desc}`, W * 0.5, 84);
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(200, 104, 320, 12);
      ctx.fillStyle = timeLeft > 0.35 ? '#4ADE80' : '#EF4444';
      ctx.fillRect(200, 104, 320 * timeLeft, 12);
    }

    renderParticlesAndPopups(ctx, this.particles, this.popups);
    if (this.phase === 'TITLE') {
      ctx.fillStyle = 'rgba(10, 6, 20, 0.72)';
      ctx.fillRect(0, H * 0.36, W, 110);
      ctx.textAlign = 'center';
      ctx.font = '900 34px "JetBrains Mono", monospace';
      ctx.fillStyle = '#FACC15';
      ctx.fillText("DRAGON'S LAIR", W * 0.5, H * 0.36 + 46);
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText('MULTI-BEAT LASERDISC SCENES · REACT TO GOLDEN FLASH CUES · DEFEAT SINGE!', W * 0.5, H * 0.36 + 80);
    }
    if (visualMode === 'crt') renderCrtOverlay(ctx, W, H);
  }
}

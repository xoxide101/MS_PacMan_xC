import {
  drawHDDonkeyKong,
  drawHDMarioHero,
  drawSoftShadow,
  drawStarGlint,
} from './arcadeGfx';
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

export type DonkeyKongVariant = 'dkong' | 'dkongjr' | 'dkong3';

interface Girder {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  conveyorDir?: 1 | -1;
}

interface Ladder {
  x: number;
  yTop: number;
  yBot: number;
}

interface Barrel {
  x: number;
  y: number;
  vx: number;
  vy: number;
  isBlue: boolean;
  jumpedOver: boolean;
  rot: number;
}

interface Rivet {
  x: number;
  y: number;
  pulled: boolean;
}

interface Vine {
  x: number;
  yTop: number;
  yBot: number;
}

interface JungleFruit {
  x: number;
  y: number;
  vy: number;
  falling: boolean;
  color: string;
}

interface Snapjaw {
  x: number;
  y: number;
  vx: number;
  vy: number;
  vineIdx: number | null;
  color: string;
}

interface SprayShot {
  x: number;
  y: number;
  vy: number;
  isSuper: boolean;
}

interface GreenhouseBug {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: 'buzzbee' | 'beespy' | 'creepy';
  carryingFlower: boolean;
  hp: number;
}

const LOGICAL_W = 864;
const LOGICAL_H = 640;
const GRAVITY = 1280;

function girderYAt(g: Girder, x: number): number {
  const t = Math.max(0, Math.min(1, (x - g.x0) / Math.max(1, g.x1 - g.x0)));
  return g.y0 + (g.y1 - g.y0) * t;
}

export class DonkeyKongGame implements ArcadeGameInstance {
  public readonly logicalWidth = LOGICAL_W;
  public readonly logicalHeight = LOGICAL_H;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel: string;

  private variant: DonkeyKongVariant;
  private storageKey: string;
  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();

  private score = 0;
  private highScore = 0;
  private nextExtraLife = 10000;
  private level = 1;
  private lives = 3;
  private clock = 0;
  private phaseTimer = 0;
  private bonusTimer = 5000;

  // Player state (Jumpman / DK Jr. / Stanley)
  private px = 140;
  private py = 560;
  private pvx = 0;
  private pvy = 0;
  private pFacing: 1 | -1 = 1;
  private onGround = true;
  private onLadder = false;
  private onVineIdx: number | null = null;
  private invulnTimer = 0;
  private hammerTimer = 0;

  // DK1 state
  private dkStageKind: 'girders' | 'rivets' = 'girders';
  private girders: Girder[] = [];
  private ladders: Ladder[] = [];
  private barrels: Barrel[] = [];
  private rivets: Rivet[] = [];
  private hammerPickups: Array<{ x: number; y: number; taken: boolean }> = [];
  private barrelTimer = 1.6;

  // DK Jr. state
  private vines: Vine[] = [];
  private fruits: JungleFruit[] = [];
  private snapjaws: Snapjaw[] = [];
  private keysCollected = 0;
  private keySlots: Array<{ x: number; y: number; collected: boolean }> = [];
  private snapSpawnTimer = 2.0;

  // DK3 (Stanley) state
  private dk3Y = 230;
  private dk3VineX = LOGICAL_W * 0.5;
  private dk3TargetY = 86;
  private superSprayTimer = 0;
  private superCanY = 128;
  private superCanDropped = false;
  private sprayCd = 0;
  private shots: SprayShot[] = [];
  private bugs: GreenhouseBug[] = [];
  private flowersAlive = 5;
  private bugSpawnTimer = 1.4;

  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  constructor(variant: DonkeyKongVariant) {
    this.variant = variant;
    this.storageKey = `${variant}_hd_highscore_v1`;
    this.highScore = readHighScore(this.storageKey);
    this.primaryActionLabel = variant === 'dkong3' ? 'Bug Spray' : 'Jump';
    this.loadLevel(1);
    this.phase = 'TITLE';
  }

  private getTitleName(): string {
    if (this.variant === 'dkong') return 'Donkey Kong';
    if (this.variant === 'dkongjr') return 'Donkey Kong Jr.';
    return 'Donkey Kong 3';
  }

  private loadLevel(lvl: number): void {
    this.bonusTimer = 5000 + (lvl - 1) * 500;
    this.hammerTimer = 0;
    this.onLadder = false;
    this.onVineIdx = null;
    this.pvx = 0;
    this.pvy = 0;

    if (this.variant === 'dkong') {
      this.dkStageKind = lvl % 2 === 1 ? 'girders' : 'rivets';
      this.barrels = [];
      this.barrelTimer = 1.1;

      if (this.dkStageKind === 'girders') {
        // Iconic 25m Slanted Steel Girders
        this.girders = [
          { x0: 56, y0: 590, x1: 808, y1: 576 },
          { x0: 56, y0: 472, x1: 752, y1: 496 },
          { x0: 112, y0: 400, x1: 808, y1: 374 },
          { x0: 56, y0: 274, x1: 752, y1: 298 },
          { x0: 112, y0: 204, x1: 808, y1: 184 },
          { x0: 332, y0: 118, x1: 532, y1: 118 }, // Pauline top platform
        ];
        this.ladders = [
          { x: 690, yTop: 494, yBot: 580 },
          { x: 200, yTop: 396, yBot: 476 },
          { x: 430, yTop: 388, yBot: 486 },
          { x: 685, yTop: 296, yBot: 378 },
          { x: 210, yTop: 200, yBot: 278 },
          { x: 470, yTop: 192, yBot: 288 },
          { x: 505, yTop: 118, yBot: 190 },
        ];
        this.hammerPickups = [
          { x: 168, y: 446, taken: false },
          { x: 645, y: 264, taken: false },
        ];
        this.rivets = [];
        this.px = 140;
        this.py = 562;
      } else {
        // Iconic 100m Rivet Stage!
        this.girders = [
          { x0: 64, y0: 584, x1: 800, y1: 584 },
          { x0: 100, y0: 468, x1: 764, y1: 468 },
          { x0: 136, y0: 354, x1: 728, y1: 354 },
          { x0: 172, y0: 240, x1: 692, y1: 240 },
          { x0: 224, y0: 132, x1: 640, y1: 132 },
        ];
        this.ladders = [
          { x: 145, yTop: 468, yBot: 584 },
          { x: 718, yTop: 468, yBot: 584 },
          { x: 220, yTop: 354, yBot: 468 },
          { x: 642, yTop: 354, yBot: 468 },
          { x: 185, yTop: 240, yBot: 354 },
          { x: 675, yTop: 240, yBot: 354 },
          { x: 260, yTop: 132, yBot: 240 },
          { x: 604, yTop: 132, yBot: 240 },
        ];
        this.rivets = [
          { x: 245, y: 468, pulled: false },
          { x: 618, y: 468, pulled: false },
          { x: 270, y: 354, pulled: false },
          { x: 592, y: 354, pulled: false },
          { x: 295, y: 240, pulled: false },
          { x: 568, y: 240, pulled: false },
          { x: 325, y: 132, pulled: false },
          { x: 538, y: 132, pulled: false },
        ];
        this.hammerPickups = [{ x: LOGICAL_W * 0.5, y: 326, taken: false }];
        this.px = 120;
        this.py = 556;
      }
    } else if (this.variant === 'dkongjr') {
      // Jungle Vine Stage
      this.girders = [
        { x0: 44, y0: 586, x1: 260, y1: 586 },
        { x0: 320, y0: 560, x1: 488, y1: 560 },
        { x0: 550, y0: 534, x1: 790, y1: 534 },
        { x0: 44, y0: 374, x1: 310, y1: 374 },
        { x0: 460, y0: 314, x1: 785, y1: 314 },
        { x0: 140, y0: 158, x1: 720, y1: 158 }, // Mario & Papa Kong cage deck
      ];
      this.vines = [
        { x: 118, yTop: 158, yBot: 540 },
        { x: 162, yTop: 158, yBot: 520 },
        { x: 270, yTop: 180, yBot: 495 },
        { x: 396, yTop: 158, yBot: 510 },
        { x: 526, yTop: 158, yBot: 485 },
        { x: 644, yTop: 158, yBot: 495 },
        { x: 742, yTop: 158, yBot: 495 },
      ];
      this.fruits = [
        { x: 270, y: 250, vy: 0, falling: false, color: '#FACC15' },
        { x: 526, y: 240, vy: 0, falling: false, color: '#EF4444' },
        { x: 644, y: 265, vy: 0, falling: false, color: '#A855F7' },
      ];
      this.keySlots = [
        { x: 396, y: 116, collected: false },
        { x: 526, y: 116, collected: false },
        { x: 644, y: 116, collected: false },
      ];
      this.keysCollected = 0;
      this.snapjaws = [
        { x: 200, y: 158, vx: 110, vy: 0, vineIdx: null, color: '#EF4444' },
        { x: 600, y: 314, vx: -105, vy: 0, vineIdx: null, color: '#38BDF8' },
      ];
      this.snapSpawnTimer = 2.6;
      this.px = 96;
      this.py = 560;
    } else {
      // Donkey Kong 3 Greenhouse!
      this.girders = [
        { x0: 96, y0: 548, x1: 768, y1: 548 },
        { x0: 146, y0: 454, x1: 718, y1: 454 },
        { x0: 196, y0: 364, x1: 668, y1: 364 },
      ];
      this.ladders = [
        { x: 185, yTop: 454, yBot: 548 },
        { x: 678, yTop: 454, yBot: 548 },
        { x: 245, yTop: 364, yBot: 454 },
        { x: 618, yTop: 364, yBot: 454 },
      ];
      this.dk3Y = 236;
      this.dk3TargetY = 86;
      this.superSprayTimer = 0;
      this.superCanY = 130;
      this.superCanDropped = false;
      this.shots = [];
      this.bugs = [];
      this.flowersAlive = 5;
      this.bugSpawnTimer = 1.0;
      this.px = LOGICAL_W * 0.5;
      this.py = 522;
    }
  }

  public startNewGame(): void {
    this.score = 0;
    this.nextExtraLife = 10000;
    this.level = 1;
    this.lives = 3;
    this.particles = [];
    this.popups = [];
    this.loadLevel(1);
    this.invulnTimer = 1.6;
    this.phase = 'READY';
    this.phaseTimer = 1.1;
    arcadeAudio.playArcadeStart();
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.loadLevel(1);
    this.phase = 'TITLE';
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  private addScore(pts: number, x?: number, y?: number, color = '#FDE047'): void {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(this.storageKey, this.highScore);
    }
    if (this.score >= this.nextExtraLife) {
      this.nextExtraLife += 10000;
      this.lives = Math.min(6, this.lives + 1);
      arcadeAudio.playExtraLife();
      this.popups.push({ x: this.px, y: this.py - 32, text: '1UP!', color: '#4ADE80', life: 1.1, maxLife: 1.1 });
    }
    if (x !== undefined && y !== undefined) {
      this.popups.push({ x, y, text: `${pts}`, color, life: 0.85, maxLife: 0.85 });
    }
  }

  private loseLife(): void {
    if (this.invulnTimer > 0) return;
    arcadeAudio.playExplosion(false);
    spawnBurst(this.particles, this.px, this.py, '#F97316', 22, 220, 3.2);
    this.lives -= 1;
    if (this.lives <= 0) {
      this.phase = 'GAME_OVER';
      arcadeAudio.playDeath();
      return;
    }
    this.loadLevel(this.level);
    this.invulnTimer = 2.2;
  }

  public step(dt: number): void {
    this.clock += dt;
    stepParticlesAndPopups(this.particles, this.popups, dt);

    if (this.phase === 'TITLE') {
      this.px = LOGICAL_W * 0.5 + Math.sin(this.clock * 1.1) * 160;
      return;
    }
    if (this.phase === 'PAUSED' || this.phase === 'GAME_OVER') return;
    if (this.phase === 'READY') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) this.phase = 'PLAYING';
      return;
    }
    if (this.phase === 'STAGE_CLEAR') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.level += 1;
        this.loadLevel(this.level);
        this.phase = 'READY';
        this.phaseTimer = 1.1;
      }
      return;
    }

    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    this.bonusTimer = Math.max(0, this.bonusTimer - 120 * dt);

    if (this.variant === 'dkong') this.stepDK1(dt);
    else if (this.variant === 'dkongjr') this.stepDKJr(dt);
    else this.stepDK3(dt);
  }

  private stepDK1(dt: number): void {
    if (this.hammerTimer > 0) this.hammerTimer = Math.max(0, this.hammerTimer - dt);

    // Check ladder grab
    const nearLadder = this.ladders.find(
      (l) => Math.abs(this.px - l.x) < 18 && this.py + 16 >= l.yTop - 8 && this.py + 16 <= l.yBot + 14
    );

    if (this.hammerTimer <= 0 && nearLadder && (this.input.up || this.input.down)) {
      this.onLadder = true;
      this.px = nearLadder.x;
      this.pvx = 0;
      this.pvy = 0;
      if (this.input.up) this.py -= 135 * dt;
      if (this.input.down) this.py += 135 * dt;
      if (this.py + 16 <= nearLadder.yTop + 2) {
        this.py = nearLadder.yTop - 16;
        this.onLadder = false;
      } else if (this.py + 16 >= nearLadder.yBot) {
        this.py = nearLadder.yBot - 16;
        this.onLadder = false;
      }
    } else {
      if (this.onLadder && (this.input.left || this.input.right)) {
        this.onLadder = false;
      }
      if (!this.onLadder) {
        const moveSpd = 185;
        this.pvx = this.input.left ? -moveSpd : this.input.right ? moveSpd : 0;
        if (this.pvx !== 0) this.pFacing = this.pvx > 0 ? 1 : -1;

        if ((this.input.fireJustPressed || (this.input.up && !nearLadder)) && this.onGround && this.hammerTimer <= 0) {
          this.pvy = -455;
          this.onGround = false;
          arcadeAudio.playJumpBoing();
        }

        this.pvy = Math.min(640, this.pvy + GRAVITY * dt);
        const prevY = this.py;
        this.px = Math.max(66, Math.min(LOGICAL_W - 66, this.px + this.pvx * dt));
        this.py += this.pvy * dt;
        this.onGround = false;

        for (const g of this.girders) {
          if (this.px >= g.x0 - 8 && this.px <= g.x1 + 8) {
            const gy = girderYAt(g, this.px);
            if (this.pvy >= 0 && prevY + 16 <= gy + 10 && this.py + 16 >= gy - 2) {
              this.py = gy - 16;
              this.pvy = 0;
              this.onGround = true;
            }
          }
        }
        if (this.py > LOGICAL_H + 20) {
          this.loseLife();
          return;
        }
      }
    }

    // Grab Hammer pickup!
    for (const h of this.hammerPickups) {
      if (!h.taken && Math.hypot(h.x - this.px, h.y - this.py) < 28) {
        h.taken = true;
        this.hammerTimer = 8.5;
        arcadeAudio.playPowerUp();
        this.popups.push({ x: this.px, y: this.py - 28, text: 'HAMMER TIME!', color: '#FACC15', life: 1.0, maxLife: 1.0 });
      }
    }

    // Pull rivets in Rivet stage!
    if (this.dkStageKind === 'rivets') {
      for (const r of this.rivets) {
        if (!r.pulled && Math.abs(this.px - r.x) < 18 && Math.abs(this.py + 16 - r.y) < 14) {
          r.pulled = true;
          this.addScore(100, r.x, r.y - 18, '#FACC15');
          arcadeAudio.playCoin();
          spawnBurst(this.particles, r.x, r.y, '#FACC15', 10, 140, 2.5);
        }
      }
      if (this.rivets.every((r) => r.pulled)) {
        this.addScore(Math.round(this.bonusTimer), LOGICAL_W * 0.5, 180, '#4ADE80');
        arcadeAudio.playStageClear();
        this.phase = 'STAGE_CLEAR';
        this.phaseTimer = 1.8;
        return;
      }
    } else {
      // Rescue Pauline at top deck!
      if (this.py < 130 && Math.abs(this.px - 432) < 95) {
        this.addScore(Math.round(this.bonusTimer), 432, 100, '#F472B6');
        arcadeAudio.playStageClear();
        this.phase = 'STAGE_CLEAR';
        this.phaseTimer = 1.8;
        return;
      }
    }

    // Spawn barrels from Donkey Kong
    this.barrelTimer -= dt;
    if (this.barrelTimer <= 0) {
      this.barrelTimer = Math.max(1.15, 2.5 - this.level * 0.2);
      const isBlue = Math.random() < 0.24;
      this.barrels.push({
        x: this.dkStageKind === 'girders' ? 195 : LOGICAL_W * 0.5,
        y: this.dkStageKind === 'girders' ? 182 : 114,
        vx: (this.dkStageKind === 'rivets' && Math.random() < 0.5 ? -1 : 1) * (155 + this.level * 14),
        vy: 0,
        isBlue,
        jumpedOver: false,
        rot: 0,
      });
    }

    // Update barrels
    for (let i = this.barrels.length - 1; i >= 0; i--) {
      const b = this.barrels[i];
      b.vy = Math.min(540, b.vy + GRAVITY * 0.85 * dt);
      const prevY = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rot += (b.vx / 14) * dt;

      let landed = false;
      for (const g of this.girders) {
        if (b.x >= g.x0 && b.x <= g.x1) {
          const gy = girderYAt(g, b.x);
          if (b.vy >= 0 && prevY + 12 <= gy + 8 && b.y + 12 >= gy - 2) {
            b.y = gy - 12;
            b.vy = 0;
            landed = true;
            // Roll downhill according to girder slope!
            const slope = g.y1 - g.y0;
            if (Math.abs(slope) > 1) {
              b.vx = Math.sign(slope) * Math.abs(b.vx);
            }
          }
        }
      }
      if (!landed && (b.x < 56 || b.x > LOGICAL_W - 56)) {
        b.vx = -b.vx;
      }

      if (b.y > LOGICAL_H + 30 || (b.y > 550 && b.x < 95)) {
        this.barrels.splice(i, 1);
        continue;
      }

      // Jump-over +100 detection!
      if (!b.jumpedOver && !this.onGround && Math.abs(b.x - this.px) < 16 && b.y > this.py + 12 && b.y < this.py + 64) {
        b.jumpedOver = true;
        this.addScore(100, this.px, this.py - 22, '#FDE047');
        arcadeAudio.playCoin();
      }

      // Smash barrel with Hammer or collide!
      const dist = Math.hypot(b.x - this.px, b.y - this.py);
      if (this.hammerTimer > 0 && dist < 44) {
        this.addScore(b.isBlue ? 500 : 300, b.x, b.y - 12, '#FACC15');
        spawnBurst(this.particles, b.x, b.y, '#F97316', 16, 200, 3);
        arcadeAudio.playStomp();
        this.barrels.splice(i, 1);
      } else if (dist < 22) {
        this.loseLife();
        return;
      }
    }
  }

  private stepDKJr(dt: number): void {
    // Check if near any jungle vine (or between two vines for rapid dual-vine climb!)
    const nearVines = this.vines
      .map((v, idx) => ({ v, idx }))
      .filter(({ v }) => Math.abs(this.px - v.x) < 26 && this.py >= v.yTop - 10 && this.py <= v.yBot + 14);

    if (nearVines.length > 0 && (this.input.up || this.input.down || this.onVineIdx !== null)) {
      if (this.onVineIdx === null) {
        this.onVineIdx = nearVines[0].idx;
      }
      const dualGrab = nearVines.length >= 2;
      const climbUpSpd = dualGrab ? 210 : 125;
      const slideDownSpd = dualGrab ? 130 : 215;

      if (this.input.up) this.py -= climbUpSpd * dt;
      if (this.input.down) this.py += slideDownSpd * dt;
      if (this.input.left) this.px -= 155 * dt;
      if (this.input.right) this.px += 155 * dt;

      if (this.input.fireJustPressed) {
        this.onVineIdx = null;
        this.pvy = -440;
        this.pvx = this.input.left ? -210 : this.input.right ? 210 : 0;
        arcadeAudio.playJumpBoing();
      } else if (nearVines.length === 0) {
        this.onVineIdx = null;
      }
    } else {
      this.onVineIdx = null;
      const moveSpd = 200;
      this.pvx = this.input.left ? -moveSpd : this.input.right ? moveSpd : 0;
      if (this.pvx !== 0) this.pFacing = this.pvx > 0 ? 1 : -1;

      if (this.input.fireJustPressed && this.onGround) {
        this.pvy = -465;
        this.onGround = false;
        arcadeAudio.playJumpBoing();
      }

      this.pvy = Math.min(640, this.pvy + GRAVITY * dt);
      const prevY = this.py;
      this.px = Math.max(48, Math.min(LOGICAL_W - 48, this.px + this.pvx * dt));
      this.py += this.pvy * dt;
      this.onGround = false;

      for (const g of this.girders) {
        if (this.px >= g.x0 - 8 && this.px <= g.x1 + 8) {
          const gy = girderYAt(g, this.px);
          if (this.pvy >= 0 && prevY + 16 <= gy + 10 && this.py + 16 >= gy - 2) {
            this.py = gy - 16;
            this.pvy = 0;
            this.onGround = true;
          }
        }
      }
      if (this.py > LOGICAL_H + 18) {
        this.loseLife();
        return;
      }
    }

    // Trigger dropping tropical fruits when touching them!
    for (let i = this.fruits.length - 1; i >= 0; i--) {
      const f = this.fruits[i];
      if (!f.falling && Math.hypot(f.x - this.px, f.y - this.py) < 28) {
        f.falling = true;
        arcadeAudio.playEatFruit();
        this.addScore(400, f.x, f.y - 16, '#FACC15');
      }
      if (f.falling) {
        f.vy += 900 * dt;
        f.y += f.vy * dt;
        // Crush Snapjaws below!
        for (let j = this.snapjaws.length - 1; j >= 0; j--) {
          if (Math.hypot(this.snapjaws[j].x - f.x, this.snapjaws[j].y - f.y) < 30) {
            this.addScore(800, this.snapjaws[j].x, this.snapjaws[j].y, '#4ADE80');
            spawnBurst(this.particles, this.snapjaws[j].x, this.snapjaws[j].y, '#4ADE80', 14, 180, 3);
            arcadeAudio.playStomp();
            this.snapjaws.splice(j, 1);
          }
        }
        if (f.y > LOGICAL_H + 20) this.fruits.splice(i, 1);
      }
    }

    // Collect Golden Keys at top to unlock Papa Kong's Cage!
    for (const k of this.keySlots) {
      if (!k.collected && Math.hypot(k.x - this.px, k.y - this.py) < 34) {
        k.collected = true;
        this.keysCollected += 1;
        this.addScore(500, k.x, k.y, '#FACC15');
        arcadeAudio.playKeyUnlock();
        spawnBurst(this.particles, k.x, k.y, '#FACC15', 16, 180, 3);
      }
    }
    if (this.keysCollected >= this.keySlots.length) {
      this.addScore(Math.round(this.bonusTimer), LOGICAL_W * 0.5, 130, '#4ADE80');
      arcadeAudio.playStageClear();
      this.phase = 'STAGE_CLEAR';
      this.phaseTimer = 1.8;
      return;
    }

    // Spawn & move Snapjaws
    this.snapSpawnTimer -= dt;
    if (this.snapSpawnTimer <= 0 && this.snapjaws.length < 4 + this.level) {
      this.snapSpawnTimer = Math.max(1.8, 3.8 - this.level * 0.25);
      const vIdx = Math.floor(Math.random() * this.vines.length);
      this.snapjaws.push({
        x: this.vines[vIdx].x,
        y: 162,
        vx: (Math.random() > 0.5 ? 1 : -1) * (105 + this.level * 10),
        vy: 95 + this.level * 8,
        vineIdx: Math.random() < 0.55 ? vIdx : null,
        color: Math.random() < 0.5 ? '#EF4444' : '#38BDF8',
      });
    }

    for (let i = this.snapjaws.length - 1; i >= 0; i--) {
      const s = this.snapjaws[i];
      if (s.vineIdx !== null) {
        s.y += s.vy * dt;
        if (s.y > this.vines[s.vineIdx].yBot) {
          this.snapjaws.splice(i, 1);
          continue;
        }
      } else {
        s.x += s.vx * dt;
        if (s.x < 64 || s.x > LOGICAL_W - 64) s.vx = -s.vx;
      }
      if (Math.hypot(s.x - this.px, s.y - this.py) < 22) {
        this.loseLife();
        return;
      }
    }
  }

  private stepDK3(dt: number): void {
    if (this.superSprayTimer > 0) this.superSprayTimer = Math.max(0, this.superSprayTimer - dt);
    if (this.sprayCd > 0) this.sprayCd = Math.max(0, this.sprayCd - dt);

    // Move Stanley across 3 greenhouse platforms + ladders
    const nearLadder = this.ladders.find(
      (l) => Math.abs(this.px - l.x) < 18 && this.py + 16 >= l.yTop - 8 && this.py + 16 <= l.yBot + 14
    );
    if (nearLadder && (this.input.up || this.input.down)) {
      this.px = nearLadder.x;
      if (this.input.up) this.py -= 160 * dt;
      if (this.input.down) this.py += 160 * dt;
      this.py = Math.max(nearLadder.yTop - 16, Math.min(nearLadder.yBot - 16, this.py));
    } else {
      const moveSpd = 235;
      if (this.input.left) {
        this.px -= moveSpd * dt;
        this.pFacing = -1;
      }
      if (this.input.right) {
        this.px += moveSpd * dt;
        this.pFacing = 1;
      }
      // Snap Stanley to nearest platform under his feet
      let bestG = this.girders[0];
      let bestD = Infinity;
      for (const g of this.girders) {
        if (this.px >= g.x0 && this.px <= g.x1) {
          const d = Math.abs(g.y0 - (this.py + 16));
          if (d < bestD) {
            bestD = d;
            bestG = g;
          }
        }
      }
      this.px = Math.max(bestG.x0 + 10, Math.min(bestG.x1 - 10, this.px));
      this.py = bestG.y0 - 16;
    }

    // Fire upward Bug Spray!
    const isSuper = this.superSprayTimer > 0;
    if ((this.input.fire || this.input.fireJustPressed) && this.sprayCd <= 0) {
      this.sprayCd = isSuper ? 0.08 : 0.16;
      this.shots.push({ x: this.px, y: this.py - 20, vy: isSuper ? -640 : -480, isSuper });
      arcadeAudio.playSpray();
    }

    // Donkey Kong slowly descends twin vines unless sprayed!
    this.dk3Y += (18 + this.level * 3.5) * dt;
    if (this.dk3Y >= 332) {
      this.loseLife();
      return;
    }

    // Super Spray Can drops once DK is pushed high enough
    if (!this.superCanDropped && this.dk3Y < 165) {
      this.superCanDropped = true;
    }
    if (this.superCanDropped && this.superCanY < 344) {
      this.superCanY += 155 * dt;
    }
    if (this.superCanDropped && Math.hypot(this.dk3VineX - this.px, this.superCanY - this.py) < 32) {
      this.superSprayTimer = 7.5;
      this.superCanY = 999;
      arcadeAudio.playPowerUp();
      this.popups.push({ x: this.px, y: this.py - 28, text: 'SUPER SPRAY!', color: '#FACC15', life: 1.0, maxLife: 1.0 });
    }

    // Update spray shots
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.y += s.vy * dt;
      if (s.y < 52) {
        this.shots.splice(i, 1);
        continue;
      }

      // Hit Donkey Kong -> push him up toward the Beehive!
      if (Math.abs(s.x - this.dk3VineX) < 38 && Math.abs(s.y - this.dk3Y) < 36) {
        this.dk3Y -= s.isSuper ? 22 : 12;
        this.addScore(s.isSuper ? 200 : 100, s.x, s.y, '#FACC15');
        spawnBurst(this.particles, s.x, s.y, s.isSuper ? '#FACC15' : '#A3E635', 6, 120, 2.5);
        this.shots.splice(i, 1);
        if (this.dk3Y <= this.dk3TargetY) {
          this.addScore(2000 + this.flowersAlive * 300, this.dk3VineX, 110, '#4ADE80');
          arcadeAudio.playStageClear();
          this.phase = 'STAGE_CLEAR';
          this.phaseTimer = 1.8;
          return;
        }
        continue;
      }

      // Hit bugs
      for (let j = this.bugs.length - 1; j >= 0; j--) {
        const b = this.bugs[j];
        if (Math.hypot(b.x - s.x, b.y - s.y) < 22) {
          this.addScore(b.kind === 'beespy' ? 300 : 150, b.x, b.y, '#A3E635');
          spawnBurst(this.particles, b.x, b.y, '#FACC15', 10, 160, 2.5);
          arcadeAudio.playPop();
          this.bugs.splice(j, 1);
          this.shots.splice(i, 1);
          break;
        }
      }
    }

    // Spawn buzzing greenhouse insects
    this.bugSpawnTimer -= dt;
    if (this.bugSpawnTimer <= 0 && this.bugs.length < 5 + this.level) {
      this.bugSpawnTimer = Math.max(0.85, 2.1 - this.level * 0.14);
      const fromLeft = Math.random() < 0.5;
      this.bugs.push({
        x: fromLeft ? 130 : LOGICAL_W - 130,
        y: 120,
        vx: (fromLeft ? 1 : -1) * (95 + Math.random() * 55),
        vy: 65 + this.level * 6,
        kind: Math.random() < 0.45 ? 'beespy' : 'buzzbee',
        carryingFlower: false,
        hp: 1,
      });
    }

    for (let i = this.bugs.length - 1; i >= 0; i--) {
      const b = this.bugs[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < 96 || b.x > LOGICAL_W - 96) b.vx = -b.vx;
      if (b.y > 578) {
        if (!b.carryingFlower && this.flowersAlive > 0) {
          b.carryingFlower = true;
          b.vy = -85;
          this.flowersAlive -= 1;
        } else {
          b.vy = -Math.abs(b.vy);
        }
      }
      if (b.carryingFlower && b.y < 100) {
        this.bugs.splice(i, 1);
        continue;
      }
      if (Math.hypot(b.x - this.px, b.y - this.py) < 22) {
        this.loseLife();
        return;
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.save();
    ctx.scale(dpr, dpr);

    // Rich thematic arcade backdrop per game
    const bgGrad = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
    if (this.variant === 'dkongjr') {
      bgGrad.addColorStop(0, '#03150E');
      bgGrad.addColorStop(1, '#072217');
    } else if (this.variant === 'dkong3') {
      bgGrad.addColorStop(0, '#071B10');
      bgGrad.addColorStop(1, '#0C1720');
    } else {
      bgGrad.addColorStop(0, '#040611');
      bgGrad.addColorStop(1, '#0A0D1E');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // Subtle atmospheric architecture (construction struts / jungle canopy / greenhouse glass rafters)
    if (this.variant === 'dkong3') {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
      ctx.lineWidth = 2;
      for (let x = 120; x < LOGICAL_W; x += 144) {
        ctx.beginPath();
        ctx.moveTo(x, 42);
        ctx.lineTo(x, LOGICAL_H - 34);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(60, 120);
      ctx.lineTo(LOGICAL_W * 0.5, 42);
      ctx.lineTo(LOGICAL_W - 60, 120);
      ctx.stroke();
    } else if (this.variant === 'dkongjr') {
      ctx.fillStyle = 'rgba(22, 163, 74, 0.08)';
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(80 + i * 150, 68, 72, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Authentic Riveted Steel I-Beam Girders with metallic highlight & zig-zag truss
    for (const g of this.girders) {
      ctx.save();
      const topCol =
        this.variant === 'dkong'
          ? this.dkStageKind === 'rivets'
            ? '#38BDF8'
            : '#F43F5E'
          : this.variant === 'dkongjr'
          ? '#FB923C'
          : '#CA8A04';
      const darkCol =
        this.variant === 'dkong'
          ? this.dkStageKind === 'rivets'
            ? '#0369A1'
            : '#881337'
          : this.variant === 'dkongjr'
          ? '#9A3412'
          : '#713F12';

      // Dark truss interior fill
      ctx.strokeStyle = darkCol;
      ctx.lineWidth = 15;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(g.x0, g.y0 + 7.5);
      ctx.lineTo(g.x1, g.y1 + 7.5);
      ctx.stroke();

      // Top & bottom metallic flange rails
      ctx.strokeStyle = topCol;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(g.x0, g.y0 + 1.5);
      ctx.lineTo(g.x1, g.y1 + 1.5);
      ctx.moveTo(g.x0, g.y0 + 13.5);
      ctx.lineTo(g.x1, g.y1 + 13.5);
      ctx.stroke();

      // Authentic zig-zag steel truss struts
      ctx.strokeStyle = topCol;
      ctx.lineWidth = 2;
      const stepW = 18;
      const steps = Math.floor((g.x1 - g.x0) / stepW);
      ctx.beginPath();
      for (let i = 0; i < steps; i++) {
        const xA = g.x0 + i * stepW;
        const xB = xA + stepW;
        const yA = girderYAt(g, xA);
        const yB = girderYAt(g, xB);
        if (i % 2 === 0) {
          ctx.moveTo(xA, yA + 2);
          ctx.lineTo(xB, yB + 13);
        } else {
          ctx.moveTo(xA, yA + 13);
          ctx.lineTo(xB, yB + 2);
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    // Crisp Arcade Ladders (DK1 & DK3)
    if (this.variant !== 'dkongjr') {
      for (const l of this.ladders) {
        ctx.save();
        ctx.strokeStyle = '#0284C7';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(l.x - 10, l.yTop);
        ctx.lineTo(l.x - 10, l.yBot);
        ctx.moveTo(l.x + 10, l.yTop);
        ctx.lineTo(l.x + 10, l.yBot);
        ctx.stroke();

        ctx.strokeStyle = '#7DD3FC';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(l.x - 10.5, l.yTop);
        ctx.lineTo(l.x - 10.5, l.yBot);
        ctx.moveTo(l.x + 9.5, l.yTop);
        ctx.lineTo(l.x + 9.5, l.yBot);
        for (let y = l.yTop + 8; y < l.yBot; y += 13) {
          ctx.moveTo(l.x - 10, y);
          ctx.lineTo(l.x + 10, y);
        }
        ctx.stroke();
        ctx.restore();
      }
    }

    if (this.variant === 'dkong') {
      // Iconic Flaming Oil Drum at bottom-left on Girders stage!
      if (this.dkStageKind === 'girders') {
        const ox = 84;
        const oy = 576;
        ctx.save();
        // Animated fire glow above barrel
        const flicker = Math.sin(this.clock * 24) * 3;
        const fg = ctx.createRadialGradient(ox, oy - 22, 2, ox, oy - 24, 24);
        fg.addColorStop(0, '#FFFFFF');
        fg.addColorStop(0.35, '#FACC15');
        fg.addColorStop(0.7, '#F97316');
        fg.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(ox, oy - 24, 22 + flicker * 0.5, 0, Math.PI * 2);
        ctx.fill();
        // Blue steel OIL drum
        const og = ctx.createLinearGradient(ox - 14, oy, ox + 14, oy);
        og.addColorStop(0, '#1E3A8A');
        og.addColorStop(0.45, '#3B82F6');
        og.addColorStop(1, '#172554');
        ctx.fillStyle = og;
        ctx.strokeStyle = '#93C5FD';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(ox - 14, oy - 16, 28, 34, 3);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FACC15';
        ctx.font = '900 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('OIL', ox, oy + 4);
        ctx.restore();
      }

      // Golden Rivet Bolts
      for (const r of this.rivets) {
        if (r.pulled) continue;
        const rg = ctx.createLinearGradient(r.x - 9, r.y, r.x + 9, r.y);
        rg.addColorStop(0, '#CA8A04');
        rg.addColorStop(0.5, '#FEF08A');
        rg.addColorStop(1, '#A16207');
        ctx.fillStyle = rg;
        ctx.strokeStyle = '#422006';
        ctx.lineWidth = 1.5;
        ctx.fillRect(r.x - 9, r.y - 2, 18, 16);
        ctx.strokeRect(r.x - 9, r.y - 2, 18, 16);
      }

      // Golden Hammer Pickups with subtle pulse glint
      for (const h of this.hammerPickups) {
        if (h.taken) continue;
        ctx.save();
        ctx.translate(h.x, h.y + Math.sin(this.clock * 6) * 2);
        ctx.fillStyle = '#D97706';
        ctx.strokeStyle = '#451A03';
        ctx.lineWidth = 1.3;
        ctx.fillRect(-3, -6, 6, 18);
        ctx.strokeRect(-3, -6, 6, 18);
        const hg = ctx.createLinearGradient(-11, -15, 11, -5);
        hg.addColorStop(0, '#FEF08A');
        hg.addColorStop(0.5, '#EF4444');
        hg.addColorStop(1, '#991B1B');
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.roundRect(-12, -16, 24, 11, 3);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Stack of wooden barrels next to DK on girders stage
      if (this.dkStageKind === 'girders') {
        for (let b = 0; b < 3; b++) {
          const bx = 76 + (b % 2) * 22;
          const by = 176 - Math.floor(b / 2) * 24;
          ctx.fillStyle = '#92400E';
          ctx.strokeStyle = '#451A03';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(bx - 10, by - 12, 20, 24, 5);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#38BDF8';
          ctx.fillRect(bx - 10, by - 6, 20, 3);
          ctx.fillRect(bx - 10, by + 4, 20, 3);
        }
      }

      // Donkey Kong & Waving Pauline with animated "HELP!" callout
      this.drawKong(
        ctx,
        this.dkStageKind === 'girders' ? 150 : LOGICAL_W * 0.5,
        this.dkStageKind === 'girders' ? 160 : 94,
        1.12
      );

      // Pauline in ruffled pink arcade dress + golden hair + waving arms
      const px = 432;
      const py = 96;
      const wave = Math.sin(this.clock * 10) * 0.35;
      ctx.save();
      ctx.translate(px, py);
      // Flowing blonde hair
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(0, -10, 9, 0, Math.PI * 2);
      ctx.fill();
      // Pink ruffled gown
      const pg = ctx.createLinearGradient(-12, -5, 12, 18);
      pg.addColorStop(0, '#F9A8D4');
      pg.addColorStop(0.55, '#EC4899');
      pg.addColorStop(1, '#BE185D');
      ctx.fillStyle = pg;
      ctx.strokeStyle = '#500724';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-6, -4);
      ctx.lineTo(6, -4);
      ctx.lineTo(13, 18);
      ctx.lineTo(-13, 18);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Waving arms
      ctx.strokeStyle = '#FDBA74';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-5, -1);
      ctx.lineTo(-12, -10 + wave * 8);
      ctx.moveTo(5, -1);
      ctx.lineTo(12, -10 - wave * 8);
      ctx.stroke();
      // Face
      ctx.fillStyle = '#FDBA74';
      ctx.beginPath();
      ctx.arc(0, -10, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(-2.5, -11, 1.8, 2);
      ctx.fillRect(1, -11, 1.8, 2);
      // Periodic arcade "HELP!" callout
      if (Math.floor(this.clock * 1.4) % 2 === 0) {
        ctx.fillStyle = '#38BDF8';
        ctx.font = '800 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText('HELP!', 16, -12);
      }
      ctx.restore();

      // Authentic Rolling Wooden Barrels with iron hoops & wood-grain rotation!
      for (const b of this.barrels) {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        const bg = ctx.createRadialGradient(-3, -3, 1, 0, 0, 13);
        bg.addColorStop(0, b.isBlue ? '#93C5FD' : '#F59E0B');
        bg.addColorStop(0.55, b.isBlue ? '#2563EB' : '#B45309');
        bg.addColorStop(1, b.isBlue ? '#1E3A8A' : '#451A03');
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.arc(0, 0, 12.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = b.isBlue ? '#E0F2FE' : '#FDE047';
        ctx.lineWidth = 2.2;
        ctx.stroke();
        // Crossed barrel stave spokes showing real spin!
        ctx.strokeStyle = b.isBlue ? '#60A5FA' : '#78350F';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(10, 0);
        ctx.moveTo(0, -10);
        ctx.lineTo(0, 10);
        ctx.stroke();
        ctx.fillStyle = b.isBlue ? '#FFFFFF' : '#FDE047';
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    } else if (this.variant === 'dkongjr') {
      // Woven Jungle Vines with lush alternating leaves
      for (const v of this.vines) {
        ctx.save();
        ctx.strokeStyle = '#15803D';
        ctx.lineWidth = 6.5;
        ctx.beginPath();
        ctx.moveTo(v.x, v.yTop);
        ctx.lineTo(v.x, v.yBot);
        ctx.stroke();
        ctx.strokeStyle = '#4ADE80';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(v.x - 1, v.yTop);
        ctx.lineTo(v.x - 1, v.yBot);
        ctx.stroke();
        for (let y = v.yTop + 18; y < v.yBot; y += 30) {
          const side = Math.floor(y / 30) % 2 === 0 ? 1 : -1;
          ctx.fillStyle = '#22C55E';
          ctx.strokeStyle = '#14532D';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(v.x + side * 8, y, 7.5, 3.6, side * 0.35, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      }

      // Papa Kong inside Mario's riveted iron cage!
      this.drawKong(ctx, 225, 118, 0.95);
      ctx.save();
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 3.5;
      ctx.strokeRect(184, 74, 82, 80);
      for (let bx = 198; bx < 264; bx += 14) {
        ctx.beginPath();
        ctx.moveTo(bx, 74);
        ctx.lineTo(bx, 154);
        ctx.stroke();
      }
      ctx.restore();

      // Gleaming Golden Arcade Keys
      for (const k of this.keySlots) {
        if (k.collected) continue;
        ctx.save();
        ctx.translate(k.x, k.y + Math.sin(this.clock * 5 + k.x) * 2);
        ctx.shadowColor = '#FACC15';
        ctx.shadowBlur = 12;
        ctx.strokeStyle = '#FEF08A';
        ctx.fillStyle = '#FACC15';
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.arc(0, -4, 7.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillRect(-2.5, 3, 5, 14);
        ctx.fillRect(2, 9, 5, 3);
        ctx.fillRect(2, 14, 4, 3);
        drawStarGlint(ctx, 5, -9, 4, '#FFFFFF', this.clock * 4);
        ctx.restore();
      }

      // Shaded Tropical Fruits with leafy stem
      for (const f of this.fruits) {
        ctx.save();
        ctx.translate(f.x, f.y);
        const frg = ctx.createRadialGradient(-3, -3, 1, 0, 0, 12);
        frg.addColorStop(0, '#FFFFFF');
        frg.addColorStop(0.35, f.color);
        frg.addColorStop(1, '#451A03');
        ctx.fillStyle = frg;
        ctx.beginPath();
        ctx.arc(0, 1, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4ADE80';
        ctx.beginPath();
        ctx.ellipse(3, -11, 5.5, 2.8, -0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Animated Chomping Mechanical Snapjaws!
      for (const s of this.snapjaws) {
        const chomp = Math.abs(Math.sin(this.clock * 14 + s.x * 0.1)) * 4;
        ctx.save();
        ctx.translate(s.x, s.y);
        if (s.vx < 0) ctx.scale(-1, 1);
        ctx.fillStyle = s.color;
        ctx.strokeStyle = '#1E1B24';
        ctx.lineWidth = 1.4;
        // Upper jaw
        ctx.beginPath();
        ctx.roundRect(-14, -11 - chomp * 0.3, 28, 11, 5);
        ctx.fill();
        ctx.stroke();
        // Lower jaw
        ctx.beginPath();
        ctx.roundRect(-14, 1 + chomp * 0.4, 28, 8, 4);
        ctx.fill();
        ctx.stroke();
        // Jagged white steel teeth
        ctx.fillStyle = '#FFFFFF';
        for (let tx = -8; tx <= 8; tx += 5.5) {
          ctx.beginPath();
          ctx.moveTo(tx - 2.5, 0);
          ctx.lineTo(tx, 4.5);
          ctx.lineTo(tx + 2.5, 0);
          ctx.fill();
        }
        // Fierce eye
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(6, -6, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(6, -7, 1.8, 2);
        ctx.restore();
      }
    } else {
      // Donkey Kong 3 Twin Greenhouse Vines + Dripping Golden Beehive
      ctx.strokeStyle = '#22C55E';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(this.dk3VineX - 24, 58);
      ctx.lineTo(this.dk3VineX - 24, 345);
      ctx.moveTo(this.dk3VineX + 24, 58);
      ctx.lineTo(this.dk3VineX + 24, 345);
      ctx.stroke();

      // Ribbed Golden Beehive
      ctx.save();
      ctx.translate(this.dk3VineX, 72);
      for (let tier = 0; tier < 3; tier++) {
        ctx.fillStyle = tier % 2 === 0 ? '#FACC15' : '#EAB308';
        ctx.strokeStyle = '#854D0E';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, -8 + tier * 9, 28 - Math.abs(tier - 1) * 5, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = '#422006';
      ctx.beginPath();
      ctx.arc(0, 6, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Super Spray Canister
      if (this.superCanY < 500) {
        ctx.save();
        ctx.translate(this.dk3VineX, this.superCanY);
        ctx.shadowColor = '#FACC15';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#FACC15';
        ctx.strokeStyle = '#78350F';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(-9, -12, 18, 24, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(-5, -18, 10, 6);
        ctx.fillStyle = '#0F172A';
        ctx.font = '900 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('S', 0, 3);
        ctx.restore();
      }

      this.drawKong(ctx, this.dk3VineX, this.dk3Y, 1.05);

      // 5 Terracotta Potted Blooming Flowers
      for (let i = 0; i < 5; i++) {
        const fx = 210 + i * 110;
        ctx.save();
        ctx.translate(fx, 594);
        ctx.fillStyle = '#B45309';
        ctx.strokeStyle = '#451A03';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-14, -6);
        ctx.lineTo(14, -6);
        ctx.lineTo(10, 12);
        ctx.lineTo(-10, 12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillRect(-16, -10, 32, 5);
        if (i < this.flowersAlive) {
          const sway = Math.sin(this.clock * 4 + i) * 2;
          ctx.strokeStyle = '#22C55E';
          ctx.lineWidth = 3.2;
          ctx.beginPath();
          ctx.moveTo(0, -10);
          ctx.quadraticCurveTo(sway, -20, sway, -28);
          ctx.stroke();
          // 5 Pink Flower Petals
          ctx.fillStyle = '#F472B6';
          for (let p = 0; p < 5; p++) {
            const a = (p / 5) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(sway + Math.cos(a) * 6.5, -28 + Math.sin(a) * 6.5, 4.5, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = '#FACC15';
          ctx.beginPath();
          ctx.arc(sway, -28, 4.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Billowy Volumetric Insecticide Spray Clouds
      for (const s of this.shots) {
        ctx.save();
        ctx.translate(s.x, s.y);
        const col = s.isSuper ? '#FACC15' : '#A3E635';
        ctx.shadowColor = col;
        ctx.shadowBlur = 12;
        ctx.fillStyle = col;
        const r = s.isSuper ? 10 : 6.5;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.arc(-r * 0.6, 3, r * 0.7, 0, Math.PI * 2);
        ctx.arc(r * 0.6, 3, r * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.beginPath();
        ctx.arc(-1, -2, r * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Articulated Striped Buzzbees & Beespies with Rapid Wing Blur!
      for (const b of this.bugs) {
        const wing = Math.sin(this.clock * 46 + b.x) * 4;
        ctx.save();
        ctx.translate(b.x, b.y);
        if (b.vx < 0) ctx.scale(-1, 1);
        ctx.fillStyle = 'rgba(224, 242, 254, 0.75)';
        ctx.beginPath();
        ctx.ellipse(-4, -9 + wing * 0.35, 9, 4.5, -0.35, 0, Math.PI * 2);
        ctx.ellipse(3, -10 - wing * 0.35, 8, 4, 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = b.kind === 'beespy' ? '#EF4444' : '#FACC15';
        ctx.strokeStyle = '#1E1B24';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.ellipse(0, 0, 12.5, 8.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Black bee stripes
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-6, -7.5, 3.2, 15);
        ctx.fillRect(0, -8, 3.2, 16);
        // Eye & stinger
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(7, -2, 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(7.5, -3, 1.5, 2);
        ctx.restore();
      }
    }

    // Draw Player (Jumpman / DK Jr. / Stanley)
    if (this.phase !== 'GAME_OVER') {
      const blink = this.invulnTimer > 0 && Math.floor(this.clock * 16) % 2 === 0;
      if (!blink) {
        this.drawPlayer(ctx, this.px, this.py);
      }
    }

    renderParticlesAndPopups(ctx, this.particles, this.popups);

    // Top HUD
    ctx.fillStyle = 'rgba(4, 7, 16, 0.72)';
    ctx.fillRect(0, 0, LOGICAL_W, 42);
    ctx.font = '700 14px "JetBrains Mono", monospace';
    ctx.fillStyle = '#FACC15';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${this.score.toLocaleString()}`, 22, 26);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#F97316';
    ctx.fillText(`${this.getTitleName().toUpperCase()} · L=${this.level}`, LOGICAL_W * 0.5, 26);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#38BDF8';
    ctx.fillText(`BONUS ${Math.round(this.bonusTimer)}`, LOGICAL_W - 22, 26);

    if (this.phase === 'READY' || this.phase === 'STAGE_CLEAR') {
      ctx.fillStyle = 'rgba(5, 7, 15, 0.84)';
      ctx.beginPath();
      ctx.roundRect(LOGICAL_W * 0.5 - 175, LOGICAL_H * 0.5 - 32, 350, 64, 10);
      ctx.fill();
      ctx.strokeStyle = '#F97316';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = '800 22px "Outfit", sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        this.phase === 'READY' ? `${this.getTitleName().toUpperCase()} · STAGE ${this.level}` : 'STAGE CLEARED!',
        LOGICAL_W * 0.5,
        LOGICAL_H * 0.5
      );
    }

    if (visualMode === 'crt') {
      renderCrtOverlay(ctx, LOGICAL_W, LOGICAL_H);
    }
    ctx.restore();
  }

  private drawKong(ctx: CanvasRenderingContext2D, x: number, y: number, sc: number): void {
    drawHDDonkeyKong(ctx, x, y, sc, this.clock, true);
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    if (this.variant === 'dkongjr') {
      // Articulated DK Jr. in iconic white singlet with red "J"
      const climb = this.onVineIdx !== null ? Math.sin(this.clock * 16) * 4 : Math.sin(this.clock * 14) * (Math.abs(this.pvx) > 10 ? 3.5 : 0);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(this.pFacing, 1);
      // Reaching arms & feet
      ctx.strokeStyle = '#7C2D12';
      ctx.lineWidth = 4.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-7, 2);
      ctx.lineTo(-14, -4 + climb);
      ctx.moveTo(7, 2);
      ctx.lineTo(14, -4 - climb);
      ctx.moveTo(-5, 11);
      ctx.lineTo(-9, 17 - climb * 0.5);
      ctx.moveTo(5, 11);
      ctx.lineTo(9, 17 + climb * 0.5);
      ctx.stroke();
      // White singlet with red 'J'
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(-9.5, -1, 19, 14, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#EF4444';
      ctx.font = '900 10px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('J', 0, 6);
      // Fur head & tan muzzle
      ctx.fillStyle = '#7C2D12';
      ctx.beginPath();
      ctx.arc(0, -9, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FDBA74';
      ctx.beginPath();
      ctx.ellipse(2.5, -7.5, 6.5, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(4, -10.5, 2.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(4.5, -11.5, 1.5, 2.2);
      ctx.restore();
    } else if (this.variant === 'dkong3') {
      // Articulated Stanley the Bugman with pressurized spray pump!
      drawHDMarioHero(ctx, {
        x,
        y: y - 2,
        facing: this.pFacing,
        scale: 0.92,
        walkPhase: this.clock * 15,
        isMoving: Math.abs(this.pvx) > 15,
        isJumping: !this.onGround && !this.onLadder,
        shirtColor: '#F8FAFC',
        overallColor: '#2563EB',
        capLetter: '',
        clock: this.clock,
      });
      // Upward Bug Sprayer Nozzle
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = this.superSprayTimer > 0 ? '#FACC15' : '#A3E635';
      ctx.strokeStyle = '#14532D';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.roundRect(-4, -30, 8, 16, 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(-6, -34, 12, 4);
      ctx.restore();
    } else {
      // Classic Jumpman (Mario) with articulated run/climb & Golden Hammer!
      drawHDMarioHero(ctx, {
        x,
        y: y - 2,
        facing: this.pFacing,
        scale: 0.92,
        walkPhase: this.clock * 15,
        isMoving: Math.abs(this.pvx) > 15,
        isJumping: !this.onGround && !this.onLadder,
        isClimbing: this.onLadder,
        character: 'jumpman',
        hammerSwing: this.hammerTimer > 0 ? -2.4 + Math.sin(this.clock * 22) * 1.15 : null,
        clock: this.clock,
      });
    }
  }

  public getHudSnapshot(): ClassicGameHud {
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: `${this.getTitleName()} · Stage ${this.level}`,
      primaryMetricLabel:
        this.variant === 'dkong'
          ? 'Bonus'
          : this.variant === 'dkongjr'
          ? 'Keys'
          : 'Flowers',
      primaryMetricValue:
        this.variant === 'dkong'
          ? `${Math.round(this.bonusTimer)}`
          : this.variant === 'dkongjr'
          ? `${this.keysCollected}/${this.keySlots.length}`
          : `${this.flowersAlive}/5`,
      secondaryMetricLabel:
        this.variant === 'dkong'
          ? 'Mode'
          : this.variant === 'dkongjr'
          ? 'Vines'
          : 'Sprayer',
      secondaryMetricValue:
        this.variant === 'dkong'
          ? this.hammerTimer > 0
            ? 'Hammer!'
            : this.dkStageKind === 'rivets'
            ? 'Rivets'
            : 'Girders'
          : this.variant === 'dkongjr'
          ? 'Dual-Climb'
          : this.superSprayTimer > 0
          ? 'Super!'
          : 'Standard',
      bannerText: '',
    };
  }
}

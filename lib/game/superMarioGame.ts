import {
  drawHDBrickTile,
  drawHDMarioHero,
  drawHDQuestionBlock,
  drawHDWarpPipe,
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

export type SuperMarioVariant = 'smb1' | 'smb2' | 'smb3';

type HeroId = 'mario' | 'luigi' | 'peach' | 'toad';
type PowerForm = 'small' | 'super' | 'fire' | 'raccoon';

interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'ground' | 'brick' | 'qblock' | 'used' | 'pipe' | 'note' | 'bridge';
  reward?: 'coin' | 'mushroom' | 'fire' | 'leaf';
  bumpTimer: number;
}

interface MarioEnemy {
  id: number;
  kind: 'goomba' | 'koopa' | 'shyguy' | 'birdo' | 'bowser' | 'paragoomba';
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  shelled: boolean;
  shellMoving: boolean;
  dead: boolean;
  fireCd: number;
}

interface PickupItem {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: 'coin' | 'mushroom' | 'fire' | 'leaf' | 'cherry';
  collected: boolean;
}

interface VeggieTuft {
  x: number;
  y: number;
  plucked: boolean;
  isPow: boolean;
}

interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fromPlayer: boolean;
  kind: 'fireball' | 'veggie' | 'egg' | 'bowserfire';
  life: number;
}

const LOGICAL_W = 864;
const LOGICAL_H = 640;
const GRAVITY = 1480;
const GROUND_Y = 560;

const SMB2_HEROES: Array<{ id: HeroId; name: string; color: string; jump: number; float: boolean; speed: number }> = [
  { id: 'mario', name: 'Mario', color: '#EF4444', jump: 620, float: false, speed: 270 },
  { id: 'luigi', name: 'Luigi', color: '#22C55E', jump: 710, float: false, speed: 255 },
  { id: 'peach', name: 'Peach', color: '#EC4899', jump: 590, float: true, speed: 250 },
  { id: 'toad', name: 'Toad', color: '#38BDF8', jump: 580, float: false, speed: 325 },
];

export class SuperMarioGame implements ArcadeGameInstance {
  public readonly logicalWidth = LOGICAL_W;
  public readonly logicalHeight = LOGICAL_H;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'Jump';
  public readonly secondaryActionLabel: string;

  private variant: SuperMarioVariant;
  private storageKey: string;
  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();

  private score = 0;
  private highScore = 0;
  private coins = 0;
  private level = 1;
  private lives = 3;
  private clock = 0;
  private phaseTimer = 0;

  // Player state
  private px = 110;
  private py = GROUND_Y - 24;
  private pvx = 0;
  private pvy = 0;
  private pFacing: 1 | -1 = 1;
  private onGround = true;
  private form: PowerForm = 'small';
  private heroIdx = 0; // SMB2 switchable hero
  private invulnTimer = 0;
  private floatTimer = 0; // Peach float (SMB2)
  private pSpeed = 0; // SMB3 P-Meter 0..100
  private tailSpinTimer = 0; // SMB3 Raccoon Tail spin
  private carryingVeggie = false; // SMB2 held turnip/enemy!
  private fireCd = 0;
  private cameraX = 0;
  private worldW = 3600;
  private goalX = 3360;

  private blocks: Block[] = [];
  private enemies: MarioEnemy[] = [];
  private items: PickupItem[] = [];
  private tufts: VeggieTuft[] = [];
  private projectiles: Projectile[] = [];
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];
  private nextId = 1;

  constructor(variant: SuperMarioVariant) {
    this.variant = variant;
    this.storageKey = `${variant}_hd_highscore_v1`;
    this.highScore = readHighScore(this.storageKey);
    this.secondaryActionLabel =
      variant === 'smb2' ? 'Pluck / Throw' : variant === 'smb3' ? 'Sprint / Tail' : 'Sprint / Fire';
    this.buildCourse(1);
    this.phase = 'TITLE';
  }

  private getTitleName(): string {
    if (this.variant === 'smb1') return 'Super Mario Bros.';
    if (this.variant === 'smb2') return 'Super Mario Bros. 2';
    return 'Super Mario Bros. 3';
  }

  private getWorldLabel(): string {
    if (this.variant === 'smb1') {
      const names = ['1-1 Overworld', '1-2 Underground', '1-3 Sky Bridges', '1-4 Bowser Castle'];
      return names[(this.level - 1) % names.length];
    }
    if (this.variant === 'smb2') {
      const names = ['1-1 Subcon Hills', '1-2 Desert Cliffs', '1-3 Birdo Fortress'];
      return names[(this.level - 1) % names.length];
    }
    const names = ['World 1 Grass Land', 'World 5 Sky Land', 'World 8 Koopa Airship'];
    return names[(this.level - 1) % names.length];
  }

  private buildCourse(lvl: number): void {
    this.blocks = [];
    this.enemies = [];
    this.items = [];
    this.tufts = [];
    this.projectiles = [];
    this.carryingVeggie = false;
    this.pSpeed = 0;
    this.px = 110;
    this.py = GROUND_Y - 24;
    this.pvx = 0;
    this.pvy = 0;
    this.cameraX = 0;

    this.worldW = 3600 + (lvl - 1) * 280;
    this.goalX = this.worldW - 240;

    // Ground segments with scenic pits
    const pitPositions = [1040, 1980, 2760];
    let gx = 0;
    for (const pitX of pitPositions) {
      this.blocks.push({ x: gx, y: GROUND_Y, w: pitX - gx, h: 80, kind: 'ground', bumpTimer: 0 });
      gx = pitX + 128;
    }
    this.blocks.push({ x: gx, y: GROUND_Y, w: this.worldW - gx, h: 80, kind: 'ground', bumpTimer: 0 });

    // Overhead ? blocks, bricks, note blocks, pipes & floating coins
    const sections = 10;
    for (let s = 0; s < sections; s++) {
      const baseX = 320 + s * 290;
      const tierY = s % 2 === 0 ? 416 : 368;

      if (this.variant === 'smb2') {
        // Subcon grass tufts to pluck turnips + elevated platforms!
        this.blocks.push({ x: baseX, y: tierY + 24, w: 144, h: 24, kind: 'brick', bumpTimer: 0 });
        this.tufts.push({ x: baseX + 40, y: GROUND_Y, plucked: false, isPow: s === 4 });
        this.tufts.push({ x: baseX + 70, y: tierY + 24, plucked: false, isPow: false });
        // Floating cherries
        this.items.push({ x: baseX + 72, y: tierY - 34, vx: 0, vy: 0, kind: 'cherry', collected: false });
      } else {
        // Classic Brick + ? Block cluster
        const reward: Block['reward'] =
          s === 0
            ? this.variant === 'smb3'
              ? 'leaf'
              : 'mushroom'
            : s === 3 || s === 7
            ? 'fire'
            : 'coin';

        this.blocks.push({ x: baseX, y: tierY, w: 40, h: 40, kind: 'brick', bumpTimer: 0 });
        this.blocks.push({ x: baseX + 40, y: tierY, w: 40, h: 40, kind: 'qblock', reward, bumpTimer: 0 });
        this.blocks.push({
          x: baseX + 80,
          y: tierY,
          w: 40,
          h: 40,
          kind: this.variant === 'smb3' && s % 3 === 1 ? 'note' : 'brick',
          bumpTimer: 0,
        });
        this.blocks.push({ x: baseX + 120, y: tierY, w: 40, h: 40, kind: 'qblock', reward: 'coin', bumpTimer: 0 });

        // Floating coin arc
        for (let c = 0; c < 3; c++) {
          this.items.push({
            x: baseX + 20 + c * 42,
            y: tierY - 62 - (c === 1 ? 18 : 0),
            vx: 0,
            vy: 0,
            kind: 'coin',
            collected: false,
          });
        }
      }

      // Iconic Emerald Warp Pipe every other section (away from pits)
      const pipeX = baseX + 188;
      if (pitPositions.every((p) => Math.abs(pipeX - (p + 64)) > 110) && pipeX < this.goalX - 240) {
        const pipeH = s % 3 === 0 ? 96 : 68;
        this.blocks.push({ x: pipeX, y: GROUND_Y - pipeH, w: 56, h: pipeH, kind: 'pipe', bumpTimer: 0 });
      }
    }

    // Spawn Enemies along course
    const enemyCount = 11 + lvl * 2;
    for (let i = 0; i < enemyCount; i++) {
      const ex = 440 + (i / enemyCount) * (this.goalX - 680);
      const kind: MarioEnemy['kind'] =
        this.variant === 'smb2'
          ? 'shyguy'
          : this.variant === 'smb3' && i % 3 === 1
          ? 'paragoomba'
          : i % 3 === 0
          ? 'koopa'
          : 'goomba';
      this.enemies.push({
        id: this.nextId++,
        kind,
        x: ex,
        y: GROUND_Y - 20,
        vx: -(74 + lvl * 8),
        vy: 0,
        hp: 1,
        shelled: false,
        shellMoving: false,
        dead: false,
        fireCd: 2.0,
      });
    }

    // Boss guarding the end of SMB2 (Birdo) or SMB1 Castle Stage (Bowser)!
    if (this.variant === 'smb2') {
      this.enemies.push({
        id: this.nextId++,
        kind: 'birdo',
        x: this.goalX - 120,
        y: GROUND_Y - 28,
        vx: -48,
        vy: 0,
        hp: 3,
        shelled: false,
        shellMoving: false,
        dead: false,
        fireCd: 1.6,
      });
    } else if (this.variant === 'smb1' && lvl % 4 === 0) {
      this.enemies.push({
        id: this.nextId++,
        kind: 'bowser',
        x: this.goalX - 130,
        y: GROUND_Y - 34,
        vx: -55,
        vy: 0,
        hp: 5,
        shelled: false,
        shellMoving: false,
        dead: false,
        fireCd: 1.5,
      });
    }
  }

  public startNewGame(): void {
    this.score = 0;
    this.coins = 0;
    this.level = 1;
    this.lives = 3;
    this.form = this.variant === 'smb3' ? 'raccoon' : 'super';
    this.particles = [];
    this.popups = [];
    this.buildCourse(1);
    this.invulnTimer = 1.6;
    this.phase = 'READY';
    this.phaseTimer = 1.05;
    arcadeAudio.playArcadeStart();
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.buildCourse(1);
    this.phase = 'TITLE';
  }

  public restartStage(): void {
    // In Super Mario Bros. 2, R cycles between Mario, Luigi, Princess Peach, and Toad!
    if (this.variant === 'smb2' && this.phase === 'PLAYING') {
      this.heroIdx = (this.heroIdx + 1) % SMB2_HEROES.length;
      const h = SMB2_HEROES[this.heroIdx];
      arcadeAudio.playPowerUp();
      this.popups.push({ x: this.px, y: this.py - 36, text: `HERO: ${h.name.toUpperCase()}!`, color: h.color, life: 1.0, maxLife: 1.0 });
    }
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  private addScore(pts: number, wx?: number, wy?: number, color = '#FDE047'): void {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(this.storageKey, this.highScore);
    }
    if (wx !== undefined && wy !== undefined) {
      this.popups.push({ x: wx, y: wy, text: `${pts}`, color, life: 0.85, maxLife: 0.85 });
    }
  }

  private addCoin(wx: number, wy: number): void {
    this.coins += 1;
    this.addScore(200, wx, wy, '#FACC15');
    arcadeAudio.playCoin();
    if (this.coins >= 100) {
      this.coins -= 100;
      this.lives = Math.min(6, this.lives + 1);
      arcadeAudio.playExtraLife();
      this.popups.push({ x: this.px, y: this.py - 40, text: '1UP!', color: '#4ADE80', life: 1.2, maxLife: 1.2 });
    }
  }

  private damagePlayer(): void {
    if (this.invulnTimer > 0) return;
    if (this.form !== 'small') {
      this.form = 'small';
      this.invulnTimer = 2.0;
      arcadeAudio.playRockThud();
      spawnBurst(this.particles, this.px, this.py, '#FACC15', 14, 180, 3);
      return;
    }
    arcadeAudio.playExplosion(false);
    spawnBurst(this.particles, this.px, this.py, '#EF4444', 22, 220, 3.2);
    this.lives -= 1;
    if (this.lives <= 0) {
      this.phase = 'GAME_OVER';
      arcadeAudio.playDeath();
      return;
    }
    this.buildCourse(this.level);
    this.invulnTimer = 2.2;
  }

  public step(dt: number): void {
    this.clock += dt;
    stepParticlesAndPopups(this.particles, this.popups, dt);

    for (const b of this.blocks) {
      if (b.bumpTimer > 0) b.bumpTimer = Math.max(0, b.bumpTimer - dt);
    }

    if (this.phase === 'TITLE') {
      this.cameraX = (this.clock * 70) % 1200;
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
        this.buildCourse(this.level);
        this.phase = 'READY';
        this.phaseTimer = 1.05;
      }
      return;
    }

    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (this.fireCd > 0) this.fireCd = Math.max(0, this.fireCd - dt);
    if (this.tailSpinTimer > 0) this.tailSpinTimer = Math.max(0, this.tailSpinTimer - dt);

    const smb2Hero = SMB2_HEROES[this.heroIdx];
    const sprinting = this.input.secondary;
    const baseMaxSpd = this.variant === 'smb2' ? smb2Hero.speed : sprinting ? 370 : 255;

    // Horizontal run & momentum
    const accel = this.onGround ? 1550 : 980;
    if (this.input.left && !this.input.right) {
      this.pFacing = -1;
      this.pvx = Math.max(-baseMaxSpd, this.pvx - accel * dt);
    } else if (this.input.right && !this.input.left) {
      this.pFacing = 1;
      this.pvx = Math.min(baseMaxSpd, this.pvx + accel * dt);
    } else {
      this.pvx *= Math.pow(this.onGround ? 0.0008 : 0.22, dt);
      if (Math.abs(this.pvx) < 6) this.pvx = 0;
    }

    // SMB3 P-Speed Meter builds when running fast on ground!
    if (this.variant === 'smb3') {
      if (this.onGround && Math.abs(this.pvx) > 290) {
        this.pSpeed = Math.min(100, this.pSpeed + 65 * dt);
      } else {
        this.pSpeed = Math.max(0, this.pSpeed - 35 * dt);
      }
    }

    // Jump + SMB3 Raccoon Flutter/Flight + SMB2 Peach Float!
    const jumpPressed = this.input.fireJustPressed || this.input.up;
    if (jumpPressed && this.onGround) {
      const jumpPower = this.variant === 'smb2' ? smb2Hero.jump : this.pSpeed >= 95 ? 700 : 635;
      this.pvy = -jumpPower;
      this.onGround = false;
      this.floatTimer = 1.25;
      arcadeAudio.playJumpBoing();
    } else if (!this.onGround && this.input.fireJustPressed && this.variant === 'smb3' && this.form === 'raccoon') {
      // Raccoon Tail flight when P-Meter full, or slow flutter descent!
      this.pvy = this.pSpeed >= 80 ? -360 : Math.min(this.pvy, 75);
      arcadeAudio.playThrow();
    }

    // Secondary action: SMB1/3 Fireball or Raccoon Tail Spin; SMB2 Pluck & Throw Veggies/Eggs!
    if (this.input.secondaryJustPressed) {
      if (this.variant === 'smb2') {
        if (this.carryingVeggie) {
          this.carryingVeggie = false;
          this.projectiles.push({
            x: this.px + this.pFacing * 18,
            y: this.py - 12,
            vx: this.pFacing * 480,
            vy: -160,
            fromPlayer: true,
            kind: 'veggie',
            life: 2.2,
          });
          arcadeAudio.playThrow();
        } else {
          // Try plucking a nearby tuft or stunned enemy/egg!
          const tuft = this.tufts.find((t) => !t.plucked && Math.hypot(t.x - this.px, t.y - (this.py + 22)) < 46);
          if (tuft) {
            tuft.plucked = true;
            if (tuft.isPow) {
              arcadeAudio.playPowBlock();
              for (const e of this.enemies) {
                if (!e.dead && Math.abs(e.x - this.px) < 420) {
                  e.dead = true;
                  this.addScore(400, e.x, e.y, '#38BDF8');
                }
              }
            } else {
              this.carryingVeggie = true;
              arcadeAudio.playPump(1);
            }
          } else {
            // Grab Birdo egg mid-air or Shy Guy underfoot!
            const eggIdx = this.projectiles.findIndex(
              (p) => !p.fromPlayer && p.kind === 'egg' && Math.hypot(p.x - this.px, p.y - this.py) < 48
            );
            if (eggIdx !== -1) {
              this.projectiles.splice(eggIdx, 1);
              this.carryingVeggie = true;
              arcadeAudio.playPump(2);
            }
          }
        }
      } else if (this.form === 'fire' && this.fireCd <= 0) {
        this.fireCd = 0.24;
        this.projectiles.push({
          x: this.px + this.pFacing * 16,
          y: this.py - 4,
          vx: this.pFacing * 460,
          vy: 140,
          fromPlayer: true,
          kind: 'fireball',
          life: 2.4,
        });
        arcadeAudio.playLaser(760);
      } else if (this.variant === 'smb3' && this.form === 'raccoon') {
        this.tailSpinTimer = 0.28;
        arcadeAudio.playThrow();
        for (const e of this.enemies) {
          if (!e.dead && Math.hypot(e.x - this.px, e.y - this.py) < 56) {
            e.dead = true;
            this.addScore(400, e.x, e.y - 16, '#FACC15');
            spawnBurst(this.particles, e.x, e.y, '#FACC15', 14, 180, 3);
            arcadeAudio.playStomp();
          }
        }
      }
    }

    // Peach mid-air dress float in SMB2!
    let effGrav = GRAVITY;
    if (
      this.variant === 'smb2' &&
      smb2Hero.float &&
      !this.onGround &&
      (this.input.fire || this.input.up) &&
      this.pvy > 0 &&
      this.floatTimer > 0
    ) {
      effGrav = 120;
      this.pvy = Math.min(this.pvy, 40);
      this.floatTimer -= dt;
    }

    this.pvy = Math.min(760, this.pvy + effGrav * dt);
    const halfW = 14;
    const halfH = this.form === 'small' ? 16 : 24;

    // Horizontal move & block pushout
    this.px = Math.max(24, Math.min(this.worldW - 24, this.px + this.pvx * dt));
    for (const b of this.blocks) {
      if (this.px + halfW > b.x && this.px - halfW < b.x + b.w && this.py + halfH > b.y + 4 && this.py - halfH < b.y + b.h - 4) {
        if (this.pvx > 0) this.px = b.x - halfW;
        else if (this.pvx < 0) this.px = b.x + b.w + halfW;
        this.pvx = 0;
      }
    }

    // Vertical move & block collisions
    const prevY = this.py;
    this.py += this.pvy * dt;
    this.onGround = false;

    for (const b of this.blocks) {
      if (this.px + halfW > b.x + 2 && this.px - halfW < b.x + b.w - 2) {
        if (this.pvy >= 0 && prevY + halfH <= b.y + 12 && this.py + halfH >= b.y) {
          this.py = b.y - halfH;
          if (b.kind === 'note') {
            this.pvy = -760;
            b.bumpTimer = 0.2;
            arcadeAudio.playSpring();
          } else {
            this.pvy = 0;
            this.onGround = true;
          }
        } else if (this.pvy < 0 && prevY - halfH >= b.y + b.h - 12 && this.py - halfH <= b.y + b.h) {
          this.py = b.y + b.h + halfH;
          this.pvy = 80;
          b.bumpTimer = 0.18;
          this.hitBlockFromBelow(b);
        }
      }
    }

    // Pit fall
    if (this.py > LOGICAL_H + 50) {
      this.form = 'small';
      this.damagePlayer();
      return;
    }

    // Smooth scrolling camera
    const targetCam = Math.max(0, Math.min(this.worldW - LOGICAL_W, this.px - LOGICAL_W * 0.36));
    this.cameraX += (targetCam - this.cameraX) * Math.min(1, dt * 8);

    // Update Pickup Items
    for (const it of this.items) {
      if (it.collected) continue;
      if (it.kind === 'mushroom') {
        it.vy = Math.min(500, it.vy + GRAVITY * 0.8 * dt);
        it.x += it.vx * dt;
        it.y += it.vy * dt;
        for (const b of this.blocks) {
          if (it.x + 12 > b.x && it.x - 12 < b.x + b.w && it.vy >= 0 && it.y + 12 >= b.y && it.y < b.y + 18) {
            it.y = b.y - 12;
            it.vy = 0;
          }
        }
      }
      if (Math.hypot(it.x - this.px, it.y - this.py) < 28) {
        it.collected = true;
        if (it.kind === 'coin' || it.kind === 'cherry') {
          this.addCoin(it.x, it.y - 12);
        } else if (it.kind === 'mushroom') {
          if (this.form === 'small') this.form = 'super';
          this.addScore(1000, it.x, it.y - 16, '#4ADE80');
          arcadeAudio.playPowerUp();
        } else if (it.kind === 'fire') {
          this.form = 'fire';
          this.addScore(1000, it.x, it.y - 16, '#FB923C');
          arcadeAudio.playPowerUp();
        } else if (it.kind === 'leaf') {
          this.form = 'raccoon';
          this.addScore(1000, it.x, it.y - 16, '#FACC15');
          arcadeAudio.playPowerUp();
        }
      }
    }

    // Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      if (pr.kind === 'fireball' || pr.kind === 'veggie') {
        pr.vy += 1100 * dt;
      }
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;

      if (pr.kind === 'fireball') {
        for (const b of this.blocks) {
          if (pr.x > b.x && pr.x < b.x + b.w && pr.vy > 0 && pr.y + 7 >= b.y && pr.y < b.y + 16) {
            pr.y = b.y - 7;
            pr.vy = -310;
          }
        }
      }

      if (pr.fromPlayer) {
        let hit = false;
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (Math.hypot(e.x - pr.x, e.y - pr.y) < (e.kind === 'bowser' || e.kind === 'birdo' ? 34 : 24)) {
            e.hp -= 1;
            if (e.hp <= 0) {
              e.dead = true;
              this.addScore(e.kind === 'bowser' || e.kind === 'birdo' ? 2000 : 200, e.x, e.y - 16, '#4ADE80');
              spawnBurst(this.particles, e.x, e.y, '#FACC15', 16, 200, 3);
            } else {
              this.addScore(300, e.x, e.y - 20, '#FB923C');
              spawnBurst(this.particles, e.x, e.y, '#FB923C', 8, 140, 2.5);
            }
            arcadeAudio.playStomp();
            hit = true;
            break;
          }
        }
        if (hit || pr.life <= 0) this.projectiles.splice(i, 1);
      } else {
        if (Math.hypot(pr.x - this.px, pr.y - this.py) < 22) {
          // Can ride Birdo's eggs in SMB2 if landing from above!
          if (pr.kind === 'egg' && this.py < pr.y - 8 && this.pvy >= 0) {
            this.pvy = -380;
            this.carryingVeggie = true;
            this.projectiles.splice(i, 1);
            arcadeAudio.playPump(2);
            continue;
          }
          this.projectiles.splice(i, 1);
          this.damagePlayer();
          return;
        }
        if (pr.life <= 0) this.projectiles.splice(i, 1);
      }
    }

    // Update Enemies
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (Math.abs(e.x - this.px) > 680) continue;

      if (e.kind === 'birdo' || e.kind === 'bowser') {
        e.x += e.vx * dt;
        if (e.x < this.goalX - 240) e.vx = Math.abs(e.vx);
        if (e.x > this.goalX - 60) e.vx = -Math.abs(e.vx);
        e.fireCd -= dt;
        if (e.fireCd <= 0) {
          e.fireCd = e.kind === 'birdo' ? 1.8 : 1.5;
          this.projectiles.push({
            x: e.x - 24,
            y: e.y - 6,
            vx: -240,
            vy: 0,
            fromPlayer: false,
            kind: e.kind === 'birdo' ? 'egg' : 'bowserfire',
            life: 3.0,
          });
          arcadeAudio.playFlame();
        }
      } else {
        if (!e.shelled || e.shellMoving) {
          e.x += e.vx * dt;
        }
        if (e.kind === 'paragoomba' && e.y >= GROUND_Y - 22) {
          e.vy = -420;
        }
        e.vy = Math.min(540, e.vy + GRAVITY * 0.85 * dt);
        e.y += e.vy * dt;
        for (const b of this.blocks) {
          if (e.x + 14 > b.x && e.x - 14 < b.x + b.w) {
            if (e.vy >= 0 && e.y + 16 >= b.y && e.y < b.y + 20) {
              e.y = b.y - 16;
              e.vy = 0;
            } else if (e.y + 10 > b.y + 4 && e.y - 10 < b.y + b.h - 4) {
              e.vx = -e.vx;
            }
          }
        }
        // Moving koopa shell bowls down other enemies!
        if (e.shelled && e.shellMoving) {
          for (const other of this.enemies) {
            if (other.id !== e.id && !other.dead && Math.hypot(other.x - e.x, other.y - e.y) < 26) {
              other.dead = true;
              this.addScore(400, other.x, other.y - 14, '#4ADE80');
              arcadeAudio.playStomp();
            }
          }
        }
      }

      // Player-Enemy collision!
      const hitDist = e.kind === 'bowser' || e.kind === 'birdo' ? 32 : 24;
      if (Math.abs(e.x - this.px) < hitDist && Math.abs(e.y - this.py) < hitDist + 6) {
        const stomping = this.pvy > 0 && this.py < e.y - 6;
        if (this.variant === 'smb2' && e.kind === 'shyguy' && stomping) {
          // Ride / pluck Shy Guy!
          this.pvy = -380;
          e.dead = true;
          this.carryingVeggie = true;
          this.addScore(200, e.x, e.y - 16, '#EC4899');
          arcadeAudio.playPump(2);
        } else if (stomping && e.kind !== 'bowser' && e.kind !== 'birdo') {
          this.pvy = -440;
          if (e.kind === 'koopa' && !e.shelled) {
            e.shelled = true;
            e.shellMoving = false;
            this.addScore(100, e.x, e.y - 14, '#4ADE80');
          } else if (e.shelled && !e.shellMoving) {
            e.shellMoving = true;
            e.vx = this.px <= e.x ? 420 : -420;
            this.addScore(200, e.x, e.y - 14, '#4ADE80');
          } else {
            e.dead = true;
            this.addScore(200, e.x, e.y - 14, '#FDE047');
            spawnBurst(this.particles, e.x, e.y, '#FACC15', 10, 150, 2.5);
          }
          arcadeAudio.playStomp();
        } else if (e.shelled && !e.shellMoving) {
          e.shellMoving = true;
          e.vx = this.px <= e.x ? 420 : -420;
          arcadeAudio.playStomp();
        } else {
          this.damagePlayer();
          return;
        }
      }
    }

    // Reached Flagpole / Hawk Mask / Goal Roulette Card!
    if (this.px >= this.goalX) {
      const bossAlive = this.enemies.some((e) => !e.dead && (e.kind === 'birdo' || e.kind === 'bowser'));
      if (!bossAlive || this.variant === 'smb1') {
        // If SMB1 castle, grabbing the axe drops Bowser!
        for (const e of this.enemies) {
          if (e.kind === 'bowser') e.dead = true;
        }
        const flagBonus = Math.round(Math.max(500, (GROUND_Y - this.py) * 10));
        this.addScore(flagBonus, this.goalX, this.py - 20, '#4ADE80');
        arcadeAudio.playStageClear();
        this.phase = 'STAGE_CLEAR';
        this.phaseTimer = 1.9;
      }
    }
  }

  private hitBlockFromBelow(b: Block): void {
    if (b.kind === 'qblock') {
      b.kind = 'used';
      if (b.reward === 'coin' || !b.reward) {
        this.addCoin(b.x + 20, b.y - 18);
      } else {
        this.items.push({
          x: b.x + 20,
          y: b.y - 18,
          vx: b.reward === 'mushroom' ? 115 : 0,
          vy: -140,
          kind: b.reward,
          collected: false,
        });
        arcadeAudio.playPowerUp();
      }
    } else if (b.kind === 'brick') {
      arcadeAudio.playRockThud();
    }
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.save();
    ctx.scale(dpr, dpr);

    const isUnderground = this.variant === 'smb1' && this.level % 4 === 2;
    const isCastle = this.variant === 'smb1' && this.level % 4 === 0;

    // Rich SNES All-Stars-Evolved Sky / Underground / Subcon / Castle Backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
    if (isUnderground) {
      bgGrad.addColorStop(0, '#04081A');
      bgGrad.addColorStop(1, '#0F1B33');
    } else if (isCastle) {
      bgGrad.addColorStop(0, '#18060A');
      bgGrad.addColorStop(0.6, '#3B0A10');
      bgGrad.addColorStop(1, '#7C2D12');
    } else if (this.variant === 'smb2') {
      bgGrad.addColorStop(0, '#1D4ED8');
      bgGrad.addColorStop(0.55, '#60A5FA');
      bgGrad.addColorStop(1, '#BFDBFE');
    } else if (this.variant === 'smb3') {
      bgGrad.addColorStop(0, '#0369A1');
      bgGrad.addColorStop(0.55, '#38BDF8');
      bgGrad.addColorStop(1, '#E0F2FE');
    } else {
      bgGrad.addColorStop(0, '#2563EB');
      bgGrad.addColorStop(0.6, '#60A5FA');
      bgGrad.addColorStop(1, '#DBEAFE');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // Parallax Cel-Shaded Fluffy Clouds (with iconic Mario eyes!) or Castle Pillars
    ctx.save();
    if (isCastle) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
      for (let i = 0; i < 8; i++) {
        const px = ((i * 190 - this.cameraX * 0.3) % (LOGICAL_W + 220) + (LOGICAL_W + 220)) % (LOGICAL_W + 220) - 80;
        ctx.fillRect(px, 44, 48, LOGICAL_H - 44);
        ctx.fillStyle = 'rgba(251, 146, 60, 0.25)';
        ctx.fillRect(px + 14, 150, 20, 44);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
      }
    } else if (!isUnderground) {
      for (let i = 0; i < 8; i++) {
        const cx = ((i * 250 - this.cameraX * 0.22) % (LOGICAL_W + 240) + (LOGICAL_W + 240)) % (LOGICAL_W + 240) - 100;
        const cy = 92 + (i % 3) * 46;
        // Soft blue underside shadow
        ctx.fillStyle = 'rgba(147, 197, 253, 0.85)';
        ctx.beginPath();
        ctx.arc(cx, cy + 5, 21, 0, Math.PI * 2);
        ctx.arc(cx + 22, cy - 2, 26, 0, Math.PI * 2);
        ctx.arc(cx + 46, cy + 5, 19, 0, Math.PI * 2);
        ctx.fill();
        // Crisp white cloud puff
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(cx, cy, 20, 0, Math.PI * 2);
        ctx.arc(cx + 22, cy - 7, 25, 0, Math.PI * 2);
        ctx.arc(cx + 46, cy, 18, 0, Math.PI * 2);
        ctx.fill();
        // Classic Nintendo Cloud Eyes
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(cx + 16, cy - 8, 2.5, 6);
        ctx.fillRect(cx + 26, cy - 8, 2.5, 6);
      }
    }
    ctx.restore();

    // World Space
    ctx.save();
    ctx.translate(-this.cameraX, 0);

    // Authentic Spotted Smiling Mario Hills & Bushes (Overworld / Subcon / Grass Land)
    if (!isUnderground && !isCastle) {
      for (let i = 0; i < 14; i++) {
        const hx = i * 310 + 90;
        const hr = 95 + (i % 2) * 34;
        const hg = ctx.createLinearGradient(hx, GROUND_Y - hr, hx, GROUND_Y);
        hg.addColorStop(0, this.variant === 'smb3' ? '#4ADE80' : '#22C55E');
        hg.addColorStop(1, '#15803D');
        ctx.fillStyle = hg;
        ctx.strokeStyle = '#14532D';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(hx, GROUND_Y, hr, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Iconic SMB3 / All-Stars vertical pill eyes & spots on hills
        ctx.fillStyle = '#14532D';
        ctx.beginPath();
        ctx.roundRect(hx - 14, GROUND_Y - hr * 0.56, 6, 16, 3);
        ctx.roundRect(hx + 8, GROUND_Y - hr * 0.56, 6, 16, 3);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.beginPath();
        ctx.ellipse(hx - hr * 0.35, GROUND_Y - hr * 0.3, 14, 10, -0.3, 0, Math.PI * 2);
        ctx.ellipse(hx + hr * 0.38, GROUND_Y - hr * 0.25, 11, 8, 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Evolved HD World Blocks, Pipes & Terracotta Ground
    for (const b of this.blocks) {
      if (b.x + b.w < this.cameraX - 48 || b.x > this.cameraX + LOGICAL_W + 48) continue;
      const lift = b.bumpTimer > 0 ? Math.sin((b.bumpTimer / 0.18) * Math.PI) * 11 : 0;
      const by = b.y - lift;

      if (b.kind === 'ground') {
        // Textured cobbled earth tiles + sculpted grass overhang
        const tileW = 40;
        const cols = Math.ceil(b.w / tileW);
        for (let ci = 0; ci < cols; ci++) {
          const tx = b.x + ci * tileW;
          const tw = Math.min(tileW, b.x + b.w - tx);
          drawHDBrickTile(
            ctx,
            tx,
            by + 16,
            tw,
            b.h - 16,
            isUnderground ? '#1E3A8A' : isCastle ? '#475569' : '#92400E',
            isUnderground ? '#3B82F6' : isCastle ? '#94A3B8' : '#D97706',
            isUnderground ? '#082F49' : '#291002'
          );
        }
        // Overhanging emerald grass lip
        if (!isUnderground && !isCastle) {
          const gg = ctx.createLinearGradient(0, by, 0, by + 18);
          gg.addColorStop(0, '#4ADE80');
          gg.addColorStop(0.65, '#16A34A');
          gg.addColorStop(1, '#14532D');
          ctx.fillStyle = gg;
          ctx.fillRect(b.x, by, b.w, 17);
          ctx.fillStyle = '#86EFAC';
          ctx.fillRect(b.x, by, b.w, 4);
        } else {
          ctx.fillStyle = isCastle ? '#94A3B8' : '#38BDF8';
          ctx.fillRect(b.x, by, b.w, 12);
        }
      } else if (b.kind === 'pipe') {
        drawHDWarpPipe(ctx, b.x, by, b.w, b.h, 'vertical');
      } else if (b.kind === 'qblock') {
        drawHDQuestionBlock(ctx, b.x, by, b.w, b.h, this.clock);
      } else if (b.kind === 'note') {
        // SMB3 Bouncy ♪ Music Note Block
        const bob = Math.sin(this.clock * 8 + b.x * 0.05) * 1.5;
        ctx.fillStyle = '#F8FAFC';
        ctx.strokeStyle = '#EC4899';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.roundRect(b.x + 1, by + 1 + bob, b.w - 2, b.h - 2, 5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#DB2777';
        ctx.font = '900 22px "Outfit", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('♪', b.x + b.w * 0.5, by + b.h * 0.5 + 1 + bob);
      } else if (b.kind === 'used') {
        ctx.fillStyle = '#78716C';
        ctx.strokeStyle = '#292524';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(b.x + 1, by + 1, b.w - 2, b.h - 2, 3);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#44403C';
        ctx.fillRect(b.x + 5, by + 5, 3, 3);
        ctx.fillRect(b.x + b.w - 8, by + 5, 3, 3);
        ctx.fillRect(b.x + 5, by + b.h - 8, 3, 3);
        ctx.fillRect(b.x + b.w - 8, by + b.h - 8, 3, 3);
      } else {
        drawHDBrickTile(
          ctx,
          b.x,
          by,
          b.w,
          b.h,
          isUnderground ? '#1D4ED8' : isCastle ? '#64748B' : '#B45309',
          isUnderground ? '#60A5FA' : isCastle ? '#CBD5E1' : '#EA580C',
          '#291002'
        );
      }
    }

    // SMB2 Wiggling Pluckable Grass Tufts
    for (const t of this.tufts) {
      if (t.plucked) continue;
      const sway = Math.sin(this.clock * 8 + t.x * 0.05) * 3;
      ctx.save();
      ctx.fillStyle = t.isPow ? '#38BDF8' : '#22C55E';
      ctx.strokeStyle = t.isPow ? '#0369A1' : '#14532D';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(t.x - 11, t.y);
      ctx.quadraticCurveTo(t.x - 10 + sway, t.y - 16, t.x - 5 + sway, t.y - 18);
      ctx.lineTo(t.x, t.y - 7);
      ctx.quadraticCurveTo(t.x + 8 + sway, t.y - 18, t.x + 11, t.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Iconic Goal Flagpole + Brick Castle Fortress behind it!
    ctx.save();
    // Classic Flagpole pedestal & shaft
    const poleGrad = ctx.createLinearGradient(this.goalX, 170, this.goalX + 8, 170);
    poleGrad.addColorStop(0, '#94A3B8');
    poleGrad.addColorStop(0.5, '#FFFFFF');
    poleGrad.addColorStop(1, '#475569');
    ctx.fillStyle = poleGrad;
    ctx.fillRect(this.goalX, 166, 9, GROUND_Y - 166);
    // Golden finial orb
    const orbG = ctx.createRadialGradient(this.goalX + 1, 160, 2, this.goalX + 4.5, 163, 13);
    orbG.addColorStop(0, '#FEF9C3');
    orbG.addColorStop(0.5, '#FACC15');
    orbG.addColorStop(1, '#B45309');
    ctx.fillStyle = orbG;
    ctx.beginPath();
    ctx.arc(this.goalX + 4.5, 163, 12.5, 0, Math.PI * 2);
    ctx.fill();
    // Fluttering pennant flag
    const flagWave = Math.sin(this.clock * 7) * 5;
    ctx.fillStyle = this.variant === 'smb3' ? '#FACC15' : '#22C55E';
    ctx.strokeStyle = '#052E16';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(this.goalX + 9, 178);
    ctx.quadraticCurveTo(this.goalX + 44, 192 + flagWave, this.goalX + 78, 206);
    ctx.quadraticCurveTo(this.goalX + 44, 220 + flagWave, this.goalX + 9, 234);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Detailed Collectible Power-Ups (Coins, Super Mushroom, Fire Flower, Super Leaf, Cherries)
    for (const it of this.items) {
      if (it.collected) continue;
      ctx.save();
      ctx.translate(it.x, it.y);
      if (it.kind === 'coin') {
        const spin = Math.max(0.24, Math.abs(Math.cos(this.clock * 7.5 + it.x * 0.02)));
        ctx.scale(spin, 1);
        const cg = ctx.createRadialGradient(-3, -3, 1, 0, 0, 12);
        cg.addColorStop(0, '#FEF9C3');
        cg.addColorStop(0.55, '#FACC15');
        cg.addColorStop(1, '#B45309');
        ctx.fillStyle = cg;
        ctx.strokeStyle = '#78350F';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, 9.5, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FEF08A';
        ctx.fillRect(-2, -6, 4, 12);
      } else if (it.kind === 'cherry') {
        ctx.strokeStyle = '#22C55E';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(-5, -1);
        ctx.quadraticCurveTo(0, -14, 5, 1);
        ctx.stroke();
        for (const [cx, cy] of [[-5, 4], [5, 6]]) {
          ctx.fillStyle = '#EF4444';
          ctx.strokeStyle = '#7F1D1D';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(cx, cy, 6.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.65)';
          ctx.beginPath();
          ctx.arc(cx - 2, cy - 2, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (it.kind === 'mushroom') {
        // Iconic Super Mushroom with expressive eyes & glossy cap spots
        ctx.fillStyle = '#FEF3C7';
        ctx.strokeStyle = '#78350F';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.roundRect(-8, -2, 16, 13, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-3.5, 1, 2, 4.5);
        ctx.fillRect(1.5, 1, 2, 4.5);
        ctx.fillStyle = '#EF4444';
        ctx.strokeStyle = '#7F1D1D';
        ctx.beginPath();
        ctx.arc(0, -1, 13.5, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(-5.5, -7, 3.8, 0, Math.PI * 2);
        ctx.arc(5.5, -7, 3.8, 0, Math.PI * 2);
        ctx.arc(0, -11, 3.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (it.kind === 'fire') {
        // Glowing Fire Flower
        ctx.fillStyle = '#22C55E';
        ctx.fillRect(-2.5, 4, 5, 10);
        ctx.beginPath();
        ctx.ellipse(-6, 9, 5, 2.5, -0.4, 0, Math.PI * 2);
        ctx.ellipse(6, 9, 5, 2.5, 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.ellipse(0, -4, 13, 9.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#F97316';
        ctx.beginPath();
        ctx.ellipse(0, -4, 9.5, 6.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FEF9C3';
        ctx.beginPath();
        ctx.ellipse(0, -4, 5.5, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-2.8, -6, 1.8, 3.8);
        ctx.fillRect(1, -6, 1.8, 3.8);
      } else {
        // Super Leaf (SMB3) swaying with vein ribs
        ctx.rotate(Math.sin(this.clock * 5) * 0.25);
        ctx.fillStyle = '#F59E0B';
        ctx.strokeStyle = '#78350F';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, 13, 9, -0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#FEF08A';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-10, 4);
        ctx.lineTo(10, -4);
        ctx.stroke();
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-2, -3, 1.8, 3.5);
        ctx.fillRect(2, -3, 1.8, 3.5);
      }
      ctx.restore();
    }

    // Enemies
    for (const e of this.enemies) {
      if (e.dead || e.x < this.cameraX - 70 || e.x > this.cameraX + LOGICAL_W + 70) continue;
      this.drawEnemy(ctx, e);
    }

    // Projectiles
    for (const pr of this.projectiles) {
      ctx.save();
      ctx.translate(pr.x, pr.y);
      if (pr.kind === 'fireball' || pr.kind === 'bowserfire') {
        const r = pr.kind === 'bowserfire' ? 14 : 8;
        const fg = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 1.5);
        fg.addColorStop(0, '#FFFFFF');
        fg.addColorStop(0.4, '#FEF08A');
        fg.addColorStop(0.75, '#F97316');
        fg.addColorStop(1, 'rgba(239,68,68,0)');
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (pr.kind === 'veggie') {
        ctx.rotate(this.clock * 14);
        ctx.fillStyle = '#22C55E';
        ctx.fillRect(-5, -13, 10, 6);
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(0, 1, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        // Birdo Egg with glossy spots
        ctx.fillStyle = '#F8FAFC';
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, 13.5, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#F472B6';
        ctx.beginPath();
        ctx.arc(-4, -2, 2.8, 0, Math.PI * 2);
        ctx.arc(4, 2, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Player Hero
    if (this.phase !== 'GAME_OVER') {
      const blink = this.invulnTimer > 0 && Math.floor(this.clock * 16) % 2 === 0;
      if (!blink) this.drawPlayer(ctx, this.px, this.py);
    }

    renderParticlesAndPopups(ctx, this.particles, this.popups);
    ctx.restore();

    // Top HUD Strip
    ctx.fillStyle = 'rgba(4, 7, 18, 0.76)';
    ctx.fillRect(0, 0, LOGICAL_W, 44);
    ctx.font = '700 13px "JetBrains Mono", monospace';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${this.score.toLocaleString()}   COINS ×${this.coins}`, 18, 27);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FACC15';
    ctx.fillText(this.getWorldLabel().toUpperCase(), LOGICAL_W * 0.5, 27);
    ctx.textAlign = 'right';
    if (this.variant === 'smb3') {
      ctx.fillStyle = this.pSpeed >= 95 ? '#FACC15' : '#38BDF8';
      ctx.fillText(`P-SPEED ${Math.round(this.pSpeed)}%`, LOGICAL_W - 18, 27);
    } else if (this.variant === 'smb2') {
      ctx.fillStyle = SMB2_HEROES[this.heroIdx].color;
      ctx.fillText(`HERO: ${SMB2_HEROES[this.heroIdx].name.toUpperCase()} (R)`, LOGICAL_W - 18, 27);
    } else {
      ctx.fillStyle = '#4ADE80';
      ctx.fillText(`FORM: ${this.form.toUpperCase()}`, LOGICAL_W - 18, 27);
    }

    if (this.phase === 'READY' || this.phase === 'STAGE_CLEAR') {
      ctx.fillStyle = 'rgba(5, 7, 16, 0.84)';
      ctx.beginPath();
      ctx.roundRect(LOGICAL_W * 0.5 - 190, LOGICAL_H * 0.5 - 34, 380, 68, 10);
      ctx.fill();
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = '800 22px "Outfit", sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        this.phase === 'READY' ? this.getWorldLabel().toUpperCase() : 'COURSE CLEAR!',
        LOGICAL_W * 0.5,
        LOGICAL_H * 0.5
      );
    }

    if (visualMode === 'crt') renderCrtOverlay(ctx, LOGICAL_W, LOGICAL_H);
    ctx.restore();
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const h = this.form === 'small' ? 0.8 : 1.06;
    const smb2Hero = this.variant === 'smb2' ? SMB2_HEROES[this.heroIdx].id : 'mario';
    const isFire = this.form === 'fire' && this.variant !== 'smb2';

    drawHDMarioHero(ctx, {
      x,
      y: y - (this.form === 'small' ? 0 : 2),
      facing: this.pFacing,
      scale: h,
      walkPhase: this.clock * (Math.abs(this.pvx) > 260 ? 22 : 15),
      isMoving: Math.abs(this.pvx) > 15,
      isJumping: !this.onGround,
      character: smb2Hero,
      shirtColor: isFire ? '#F8FAFC' : undefined,
      overallColor: isFire ? '#EF4444' : undefined,
      isRaccoon: this.variant === 'smb3' && this.form === 'raccoon',
      tailSpin: this.tailSpinTimer > 0,
      carryingVeggie: this.carryingVeggie,
      clock: this.clock,
    });

    if (this.variant === 'smb3' && this.pSpeed >= 95 && !this.onGround) {
      drawStarGlint(ctx, x - this.pFacing * 18, y + 8, 5, '#FEF08A', this.clock * 8);
    }
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: MarioEnemy): void {
    const walk = Math.sin(this.clock * 12 + e.id * 1.5);
    const dir = e.vx >= 0 ? 1 : -1;
    ctx.save();
    ctx.translate(e.x, e.y);

    if (e.kind === 'goomba' || e.kind === 'paragoomba') {
      drawSoftShadow(ctx, 0, 15, 13, 3.5, 0.34);
      // Waddling dark brown boots
      ctx.fillStyle = '#291002';
      ctx.beginPath();
      ctx.ellipse(-6, 12 + walk * 2.2, 5.5, 3.6, 0, 0, Math.PI * 2);
      ctx.ellipse(6, 12 - walk * 2.2, 5.5, 3.6, 0, 0, Math.PI * 2);
      ctx.fill();
      // Tan stem
      ctx.fillStyle = '#FED7AA';
      ctx.strokeStyle = '#451A03';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(-7, 4, 14, 9, 4);
      ctx.fill();
      ctx.stroke();
      // Flapping white wings for Para-Goomba
      if (e.kind === 'paragoomba') {
        const flap = Math.sin(this.clock * 18 + e.id) * 0.45;
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#64748B';
        ctx.save();
        ctx.translate(-12, -4);
        ctx.rotate(-0.4 + flap);
        ctx.beginPath();
        ctx.ellipse(-5, 0, 9, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.translate(12, -4);
        ctx.rotate(0.4 - flap);
        ctx.beginPath();
        ctx.ellipse(5, 0, 9, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      // Classic mushroom-cap head with furrowed angry V-brows & fangs!
      const gg = ctx.createRadialGradient(-4, -8, 2, 0, -1, 16);
      gg.addColorStop(0, '#D97706');
      gg.addColorStop(0.55, '#92400E');
      gg.addColorStop(1, '#451A03');
      ctx.fillStyle = gg;
      ctx.strokeStyle = '#291002';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-14, 7);
      ctx.quadraticCurveTo(-15, -13, 0, -14);
      ctx.quadraticCurveTo(15, -13, 14, 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Eyes & Angry V-brows
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(-4.8, -3, 3.2, 4.5, 0, 0, Math.PI * 2);
      ctx.ellipse(4.8, -3, 3.2, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(-5.2, -4.5, 2.2, 4.2);
      ctx.fillRect(3, -4.5, 2.2, 4.2);
      ctx.strokeStyle = '#291002';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-10, -8);
      ctx.lineTo(0, -4.5);
      ctx.lineTo(10, -8);
      ctx.stroke();
      // Little white fangs
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(-5, 5);
      ctx.lineTo(-3, 2);
      ctx.lineTo(-1, 5);
      ctx.moveTo(1, 5);
      ctx.lineTo(3, 2);
      ctx.lineTo(5, 5);
      ctx.fill();
    } else if (e.kind === 'koopa') {
      ctx.scale(dir, 1);
      drawSoftShadow(ctx, 0, 14, 14, 3.5, 0.34);
      if (!e.shelled) {
        // Koopa walking shoes
        ctx.fillStyle = '#22C55E';
        ctx.strokeStyle = '#052E16';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(-5 + walk * 3, 12, 5, 3.5, 0, 0, Math.PI * 2);
        ctx.ellipse(6 - walk * 3, 12, 5, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      // Sculpted hexagonal Koopa shell
      const kg = ctx.createRadialGradient(-4, -5, 2, 0, 2, 16);
      kg.addColorStop(0, '#86EFAC');
      kg.addColorStop(0.5, '#16A34A');
      kg.addColorStop(1, '#14532D');
      ctx.fillStyle = kg;
      ctx.strokeStyle = '#052E16';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 4, 14, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // White shell lip & belly
      ctx.fillStyle = '#FEF9C3';
      ctx.beginPath();
      ctx.roundRect(-14.5, 3, 29, 5.5, 2.5);
      ctx.fill();
      ctx.stroke();
      if (!e.shelled) {
        // Koopa Troopa head & snout
        ctx.fillStyle = '#FACC15';
        ctx.strokeStyle = '#78350F';
        ctx.beginPath();
        ctx.arc(11, -8, 7.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.ellipse(12.5, -10.5, 2.8, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(13, -11.5, 1.8, 3);
      }
    } else if (e.kind === 'shyguy') {
      ctx.scale(dir, 1);
      drawSoftShadow(ctx, 0, 16, 12, 3.5, 0.34);
      // Blue shoes
      ctx.fillStyle = '#1D4ED8';
      ctx.beginPath();
      ctx.ellipse(-5 + walk * 3, 13, 5, 3.5, 0, 0, Math.PI * 2);
      ctx.ellipse(6 - walk * 3, 13, 5, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Red hooded cloak + leather belt
      const sg = ctx.createRadialGradient(-4, -6, 2, 0, 0, 18);
      sg.addColorStop(0, '#F87171');
      sg.addColorStop(0.55, '#DC2626');
      sg.addColorStop(1, '#7F1D1D');
      ctx.fillStyle = sg;
      ctx.strokeStyle = '#450A0A';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(-13, -14, 26, 26, 11);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#78350F';
      ctx.fillRect(-12, 4, 24, 4);
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(2, 3.5, 4, 5);
      // Iconic Porcelain White Mask with hollow dark eyeholes & mouth
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.ellipse(4, -3, 8.5, 10.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.ellipse(2, -5.5, 2.2, 3, 0, 0, Math.PI * 2);
      ctx.ellipse(8, -5.5, 2.2, 3, 0, 0, Math.PI * 2);
      ctx.arc(5.5, 2.5, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'birdo') {
      drawSoftShadow(ctx, 0, 26, 18, 5, 0.36);
      const bg = ctx.createRadialGradient(-6, -8, 4, 0, 0, 28);
      bg.addColorStop(0, '#F9A8D4');
      bg.addColorStop(0.55, '#EC4899');
      bg.addColorStop(1, '#9D174D');
      ctx.fillStyle = bg;
      ctx.strokeStyle = '#500724';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(-18, -22, 36, 46, 15);
      ctx.fill();
      ctx.stroke();
      // Iconic tubular egg snout
      ctx.fillStyle = '#F472B6';
      ctx.beginPath();
      ctx.roundRect(-30, -13, 15, 13, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#500724';
      ctx.beginPath();
      ctx.ellipse(-29, -6.5, 3, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Iconic Red Hair Bow
      ctx.fillStyle = '#EF4444';
      ctx.strokeStyle = '#7F1D1D';
      ctx.beginPath();
      ctx.ellipse(-8, -26, 8, 5, -0.3, 0, Math.PI * 2);
      ctx.ellipse(8, -26, 8, 5, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Expressive eye with lashes
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(-6, -15, 4.5, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(-7.5, -15, 2.4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Mighty King Bowser!
      drawSoftShadow(ctx, 0, 32, 30, 6, 0.42);
      // Armored spiked shell on back
      ctx.fillStyle = '#15803D';
      ctx.strokeStyle = '#052E16';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(8, 2, 26, -Math.PI * 0.5, Math.PI * 0.65);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // White shell spikes
      ctx.fillStyle = '#F8FAFC';
      for (const [sx, sy, rot] of [[24, -14, 0.4], [32, 0, 1.3], [26, 14, 2.1]]) {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(rot);
        ctx.beginPath();
        ctx.moveTo(-5, 0);
        ctx.lineTo(0, -11);
        ctx.lineTo(5, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      // Yellow plated belly & green torso
      ctx.fillStyle = '#FACC15';
      ctx.strokeStyle = '#78350F';
      ctx.beginPath();
      ctx.ellipse(-6, 8, 18, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Fierce horned dragon head & fiery red mane
      ctx.fillStyle = '#16A34A';
      ctx.strokeStyle = '#052E16';
      ctx.beginPath();
      ctx.arc(-10, -16, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Horns
      ctx.fillStyle = '#FEF9C3';
      ctx.beginPath();
      ctx.moveTo(-16, -26);
      ctx.lineTo(-22, -38);
      ctx.lineTo(-9, -29);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Red mane tuft
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(-6, -30, 8, 0, Math.PI * 2);
      ctx.fill();
      // Glowing red fierce eye
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(-16, -18, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#DC2626';
      ctx.beginPath();
      ctx.arc(-17.5, -18, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  public getHudSnapshot(): ClassicGameHud {
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: `${this.getTitleName()} · ${this.getWorldLabel()}`,
      primaryMetricLabel: 'Coins',
      primaryMetricValue: `${this.coins}`,
      secondaryMetricLabel:
        this.variant === 'smb2' ? 'Hero' : this.variant === 'smb3' ? 'P-Speed' : 'Form',
      secondaryMetricValue:
        this.variant === 'smb2'
          ? SMB2_HEROES[this.heroIdx].name
          : this.variant === 'smb3'
          ? `${Math.round(this.pSpeed)}%`
          : this.form.toUpperCase(),
      bannerText: '',
      canRestartStage: this.variant === 'smb2',
    };
  }
}

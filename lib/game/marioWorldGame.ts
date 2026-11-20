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

export type MarioWorldVariant = 'smw1' | 'smw2';

interface WorldPlatform {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'ground' | 'pipe' | 'qblock' | 'turnblock' | 'cloud';
  used?: boolean;
  item?: 'mushroom' | 'feather' | 'coin';
}

interface WorldEnemy {
  x: number;
  y: number;
  vx: number;
  kind: 'koopa' | 'spiny' | 'rex' | 'shyguy' | 'piranha';
  shell: boolean;
  kicked: boolean;
  alive: boolean;
}

interface WorldCollectible {
  x: number;
  y: number;
  kind: 'coin' | 'dragonCoin' | 'flower' | 'mushroom' | 'feather' | 'wingedCloud';
  collected: boolean;
}

interface BouncingEgg {
  x: number;
  y: number;
  vx: number;
  vy: number;
  bounces: number;
}

export class MarioWorldGame implements ArcadeGameInstance {
  public readonly logicalWidth = 760;
  public readonly logicalHeight = 520;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel: string;
  public readonly secondaryActionLabel: string;

  private readonly variant: MarioWorldVariant;
  private readonly storageKey: string;
  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();

  private score = 0;
  private highScore = 0;
  private level = 1;
  private lives = 3;
  private clock = 0;
  private stateTimer = 0;

  // Player physics
  private px = 90;
  private py = 380;
  private vx = 0;
  private vy = 0;
  private facing = 1;
  private onGround = false;
  private spinJumping = false;
  private groundPounding = false;
  private invulnTimer = 0;
  private camX = 0;
  private worldLen = 3200;

  // SMW 1 Powerups + Reserve Box + Midway & Giant Goal Gate!
  private powerState: 'small' | 'super' | 'cape' = 'super';
  private reserveItem: 'none' | 'mushroom' | 'feather' = 'none';
  private midwayReached = false;
  private goalTapeY = 300;
  private coinsCollected = 0;

  // SMW 2 Yoshi's Island: Flutter Jump, Tongue Swallow, Egg Aim Reticle, Floating Baby Mario Bubble!
  private flutterTimer = 0;
  private tongueTimer = 0;
  private mouthFull = false;
  private eggs = 3;
  private aimingEgg = false;
  private eggAimAngle = -0.5;
  private eggAimDir = 1;
  private thrownEggs: BouncingEgg[] = [];
  private babyMarioSafe = true;
  private babyTimer = 10;
  private babyX = 0;
  private babyY = 0;
  private flowersCollected = 0;

  private platforms: WorldPlatform[] = [];
  private enemies: WorldEnemy[] = [];
  private items: WorldCollectible[] = [];
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  constructor(variant: MarioWorldVariant) {
    this.variant = variant;
    this.storageKey = `${variant}_hd_highscore_v2`;
    this.highScore = readHighScore(this.storageKey);
    this.primaryActionLabel = variant === 'smw1' ? 'Jump / Cape Glide' : 'Flutter Jump';
    this.secondaryActionLabel = variant === 'smw1' ? 'Spin Jump / Cape Spin' : 'Tongue / Aim & Throw Egg';
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
    this.powerState = 'super';
    this.reserveItem = 'none';
    this.coinsCollected = 0;
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

  private addScore(pts: number, x?: number, y?: number, label?: string): void {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(this.storageKey, this.highScore);
    }
    if (x !== undefined && y !== undefined) {
      this.popups.push({
        x: x - this.camX,
        y,
        text: label ? `${label} +${pts}` : `+${pts}`,
        color: '#FEF08A',
        life: 0.9,
        maxLife: 0.9,
      });
    }
  }

  private setupStage(lvl: number): void {
    this.px = this.midwayReached ? 1560 : 90;
    this.py = 370;
    this.vx = 0;
    this.vy = 0;
    this.camX = Math.max(0, this.px - 220);
    this.spinJumping = false;
    this.groundPounding = false;
    this.invulnTimer = 1.2;
    this.eggs = 3;
    this.mouthFull = false;
    this.aimingEgg = false;
    this.thrownEggs = [];
    this.babyMarioSafe = true;
    this.babyTimer = 10;
    this.flowersCollected = 0;
    this.worldLen = 3000 + lvl * 280;

    this.platforms = [
      { x: 0, y: 448, w: 860, h: 72, kind: 'ground' },
      { x: 960, y: 448, w: 820, h: 72, kind: 'ground' },
      { x: 1890, y: 448, w: 1450, h: 72, kind: 'ground' },
      // Question Blocks & Yellow Spinning Turn-Blocks!
      { x: 280, y: 318, w: 38, h: 38, kind: 'qblock', item: 'mushroom' },
      { x: 320, y: 318, w: 38, h: 38, kind: 'turnblock' },
      { x: 360, y: 318, w: 38, h: 38, kind: 'qblock', item: 'feather' },
      { x: 640, y: 382, w: 58, h: 66, kind: 'pipe' },
      { x: 1120, y: 312, w: 38, h: 38, kind: 'turnblock' },
      { x: 1160, y: 312, w: 38, h: 38, kind: 'qblock', item: 'feather' },
      { x: 1200, y: 312, w: 38, h: 38, kind: 'turnblock' },
      { x: 1460, y: 368, w: 60, h: 80, kind: 'pipe' },
      { x: 2080, y: 318, w: 140, h: 24, kind: 'cloud' },
      { x: 2350, y: 272, w: 140, h: 24, kind: 'cloud' },
      { x: 2600, y: 372, w: 58, h: 76, kind: 'pipe' },
    ];

    this.items = [];
    for (let i = 0; i < 18; i++) {
      this.items.push({ x: 220 + i * 145, y: 365 - (i % 3) * 58, kind: 'coin', collected: false });
    }
    // 5 Dragon Coins (SMW 1) or 5 Smiley Flowers + Winged Clouds (SMW 2)!
    for (let i = 0; i < 5; i++) {
      this.items.push({
        x: 470 + i * 510,
        y: 235 + (i % 2) * 55,
        kind: this.variant === 'smw1' ? 'dragonCoin' : 'flower',
        collected: false,
      });
      if (this.variant === 'smw2') {
        this.items.push({ x: 620 + i * 480, y: 195, kind: 'wingedCloud', collected: false });
      }
    }

    this.enemies = [];
    for (let i = 0; i < 10 + lvl * 2; i++) {
      const ex = 420 + i * 245;
      const isSpiny = i % 4 === 3;
      this.enemies.push({
        x: ex,
        y: 428,
        vx: -72 - lvl * 6,
        kind: this.variant === 'smw1' ? (isSpiny ? 'spiny' : i % 3 === 0 ? 'rex' : 'koopa') : 'shyguy',
        shell: false,
        kicked: false,
        alive: true,
      });
    }
  }

  private hurtPlayer(): void {
    if (this.invulnTimer > 0 || this.phase !== 'PLAYING') return;
    this.invulnTimer = 1.6;
    if (this.variant === 'smw1') {
      if (this.powerState !== 'small') {
        this.powerState = 'small';
        arcadeAudio.playRockThud();
        // Auto-drop Reserve Item Box if stocked!
        if (this.reserveItem !== 'none') {
          this.items.push({ x: this.px, y: this.py - 120, kind: this.reserveItem, collected: false });
          this.reserveItem = 'none';
        }
        return;
      }
      this.lives -= 1;
      arcadeAudio.playDeath();
      if (this.lives <= 0) this.phase = 'GAME_OVER';
      else this.setupStage(this.level);
    } else {
      // Authentic Yoshi's Island: Baby Mario floats away in a bubble with a 10-second countdown!
      if (this.babyMarioSafe) {
        this.babyMarioSafe = false;
        this.babyTimer = 10.0;
        this.babyX = this.px;
        this.babyY = this.py - 60;
        arcadeAudio.playDeath();
        this.popups.push({ x: this.px - this.camX, y: this.py - 50, text: 'RESCUE BABY MARIO!', color: '#EF4444', life: 1.2, maxLife: 1.2 });
      }
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
        this.midwayReached = false;
        this.phase = 'READY';
        this.stateTimer = 0.85;
        this.setupStage(this.level);
      }
      return;
    }

    const attract = this.phase === 'TITLE';
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    this.tongueTimer = Math.max(0, this.tongueTimer - dt);
    this.goalTapeY = 230 + Math.sin(this.clock * 2.4) * 140;

    // Horizontal run + jump controls
    if (attract) {
      this.vx = 165;
      this.facing = 1;
      if (this.onGround && Math.sin(this.clock * 2.2) > 0.85) this.vy = -480;
    } else {
      const accel = this.input.fire ? 295 : 235;
      if (this.input.left) {
        this.vx = -accel;
        this.facing = -1;
      } else if (this.input.right) {
        this.vx = accel;
        this.facing = 1;
      } else {
        this.vx *= Math.pow(0.8, dt * 60);
      }

      // Jump / Spin Jump / Flutter Jump!
      if ((this.input.up || this.input.fireJustPressed) && this.onGround) {
        this.vy = -515;
        this.onGround = false;
        this.spinJumping = false;
        this.groundPounding = false;
        this.flutterTimer = 0.72;
        arcadeAudio.playJump();
      } else if (this.variant === 'smw1' && this.input.secondaryJustPressed && this.onGround) {
        // Authentic SMW 1 Spin Jump!
        this.vy = -480;
        this.onGround = false;
        this.spinJumping = true;
        arcadeAudio.playJump();
      } else if (this.variant === 'smw2' && !this.onGround && this.vy > 0 && (this.input.up || this.input.fire) && this.flutterTimer > 0) {
        // Authentic Yoshi Flutter Jump!
        this.flutterTimer -= dt;
        this.vy = Math.max(-135, this.vy - 1250 * dt);
      } else if (this.variant === 'smw1' && this.powerState === 'cape' && !this.onGround && this.vy > 60 && (this.input.up || this.input.fire)) {
        // Cape Feather gentle glide!
        this.vy = Math.min(this.vy, 95);
      }

      // Authentic Yoshi's Island: Down in mid-air = Ground Pound; Down on ground with full mouth = Lay Egg!
      if (this.variant === 'smw2') {
        if (!this.onGround && this.input.down && !this.groundPounding) {
          this.groundPounding = true;
          this.vy = 560;
          arcadeAudio.playThrow();
        }
        if (this.onGround && this.input.down && this.mouthFull) {
          this.mouthFull = false;
          this.eggs = Math.min(6, this.eggs + 1);
          arcadeAudio.playCoin();
          this.popups.push({ x: this.px - this.camX, y: this.py - 32, text: 'EGG LAID!', color: '#4ADE80', life: 0.7, maxLife: 0.7 });
        }

        // Authentic Oscillating Egg Aim Reticle & Tongue Swallow!
        if (this.aimingEgg) {
          this.eggAimAngle += this.eggAimDir * 2.2 * dt;
          if (this.eggAimAngle < -1.35) {
            this.eggAimAngle = -1.35;
            this.eggAimDir = 1;
          } else if (this.eggAimAngle > 0.15) {
            this.eggAimAngle = 0.15;
            this.eggAimDir = -1;
          }
          if (this.input.secondaryJustPressed) {
            this.aimingEgg = false;
            if (this.eggs > 0) {
              this.eggs -= 1;
              const ang = this.facing > 0 ? this.eggAimAngle : Math.PI - this.eggAimAngle;
              this.thrownEggs.push({
                x: this.px,
                y: this.py - 18,
                vx: Math.cos(ang) * 560,
                vy: Math.sin(ang) * 560,
                bounces: 2,
              });
              arcadeAudio.playThrow();
            }
          }
        } else if (this.input.secondaryJustPressed) {
          if (this.eggs > 0 && !this.mouthFull) {
            this.aimingEgg = true;
            this.eggAimAngle = -0.35;
          } else {
            this.tongueTimer = 0.24;
            arcadeAudio.playThrow();
          }
        }
      }
    }

    // Apply gravity & move
    this.vy = Math.min(640, this.vy + 1180 * dt);
    this.px = Math.max(24, this.px + this.vx * dt);
    const prevY = this.py;
    this.py += this.vy * dt;
    this.onGround = false;

    // Platform collisions (including hitting `?` blocks from below & Spin-Jump smashing Turn-Blocks!)
    for (let i = this.platforms.length - 1; i >= 0; i--) {
      const p = this.platforms[i];
      if (this.px + 14 > p.x && this.px - 14 < p.x + p.w) {
        if (this.vy >= 0 && prevY <= p.y + 6 && this.py >= p.y) {
          if (p.kind === 'turnblock' && (this.spinJumping || this.groundPounding)) {
            spawnBurst(this.particles, p.x + 19 - this.camX, p.y + 19, '#FACC15', 14, 180, 3);
            arcadeAudio.playRockThud();
            this.platforms.splice(i, 1);
            this.vy = -260;
            continue;
          }
          this.py = p.y;
          this.vy = 0;
          this.onGround = true;
          this.spinJumping = false;
          this.groundPounding = false;
        } else if (this.vy < 0 && p.kind !== 'cloud' && prevY - 32 >= p.y + p.h - 8 && this.py - 32 <= p.y + p.h) {
          this.py = p.y + p.h + 32;
          this.vy = 40;
          if (p.kind === 'qblock' && !p.used) {
            p.used = true;
            arcadeAudio.playPowerUp();
            if (p.item === 'mushroom' || p.item === 'feather') {
              this.items.push({ x: p.x + 19, y: p.y - 20, kind: p.item, collected: false });
            } else {
              this.coinsCollected += 1;
              this.addScore(100, p.x, p.y - 24);
            }
          }
        }
      }
    }

    if (this.py > this.logicalHeight + 40) {
      if (attract) {
        this.px = 90;
        this.py = 360;
      } else {
        this.lives -= 1;
        arcadeAudio.playDeath();
        if (this.lives <= 0) this.phase = 'GAME_OVER';
        else this.setupStage(this.level);
        return;
      }
    }

    // Midway Gate!
    if (!this.midwayReached && this.px >= 1560) {
      this.midwayReached = true;
      if (this.variant === 'smw1' && this.powerState === 'small') this.powerState = 'super';
      if (!attract) {
        arcadeAudio.playPowerUp();
        this.addScore(1000, 1560, 340, 'MIDWAY GATE!');
      }
    }

    // Floating Baby Mario Bubble (Yoshi's Island)
    if (this.variant === 'smw2' && !this.babyMarioSafe && !attract) {
      this.babyTimer -= dt;
      this.babyX += Math.sin(this.clock * 2.2) * 75 * dt;
      this.babyY = 230 + Math.cos(this.clock * 1.9) * 85;
      if (Math.hypot(this.px - this.babyX, this.py - 20 - this.babyY) < 38) {
        this.babyMarioSafe = true;
        this.babyTimer = 10;
        arcadeAudio.playPowerUp();
        this.addScore(500, this.px, this.py - 30, 'BABY MARIO SAFE!');
      } else if (this.babyTimer <= 0) {
        this.lives -= 1;
        arcadeAudio.playDeath();
        if (this.lives <= 0) this.phase = 'GAME_OVER';
        else this.setupStage(this.level);
        return;
      }
    }

    // Thrown Ricocheting Eggs (hit Winged Clouds & Enemies!)
    for (let i = this.thrownEggs.length - 1; i >= 0; i--) {
      const eg = this.thrownEggs[i];
      eg.x += eg.vx * dt;
      eg.y += eg.vy * dt;
      if (eg.y < 30 || eg.y > 440) {
        eg.vy = -eg.vy;
        eg.bounces -= 1;
      }
      let used = false;
      for (const it of this.items) {
        if (!it.collected && it.kind === 'wingedCloud' && Math.hypot(it.x - eg.x, it.y - eg.y) < 30) {
          it.collected = true;
          used = true;
          this.babyTimer = Math.min(30, this.babyTimer + 5);
          arcadeAudio.playPowerUp();
          this.addScore(1000, it.x, it.y, 'WINGED CLOUD!');
          break;
        }
      }
      for (const e of this.enemies) {
        if (e.alive && Math.hypot(e.x - eg.x, e.y - eg.y) < 26) {
          e.alive = false;
          used = true;
          spawnBurst(this.particles, e.x - this.camX, e.y, '#4ADE80', 14, 190, 3);
          arcadeAudio.playExplosion(false);
          this.addScore(300, e.x, e.y);
          break;
        }
      }
      if (used || eg.bounces < 0 || Math.abs(eg.x - this.px) > 620) this.thrownEggs.splice(i, 1);
    }

    // Collectibles & Powerups
    for (const it of this.items) {
      if (it.collected) continue;
      if (Math.hypot(it.x - this.px, it.y - (this.py - 18)) < 30) {
        if (it.kind === 'wingedCloud') continue; // Must hit with Egg!
        it.collected = true;
        if (it.kind === 'mushroom') {
          if (this.powerState === 'cape') this.reserveItem = 'mushroom';
          else this.powerState = 'super';
          arcadeAudio.playPowerUp();
          this.addScore(1000, it.x, it.y, 'SUPER MUSHROOM!');
        } else if (it.kind === 'feather') {
          if (this.powerState === 'super') this.reserveItem = 'mushroom';
          this.powerState = 'cape';
          arcadeAudio.playPowerUp();
          this.addScore(1000, it.x, it.y, 'CAPE FEATHER!');
        } else if (it.kind === 'flower' || it.kind === 'dragonCoin') {
          this.flowersCollected += 1;
          arcadeAudio.playPowerUp();
          this.addScore(1000, it.x, it.y, it.kind === 'flower' ? 'SMILEY FLOWER!' : 'DRAGON COIN!');
        } else {
          this.coinsCollected += 1;
          arcadeAudio.playCoin();
          this.addScore(100);
        }
      }
    }

    // Enemies (Koopa Shells, Spin-Jump bounce off Spinies, Yoshi Tongue Swallow!)
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.x += e.vx * dt;
      if (e.x < 100 || e.x > this.worldLen - 160) e.vx = -e.vx;

      // Yoshi Tongue Swallow!
      if (this.tongueTimer > 0 && Math.abs(e.y - (this.py - 16)) < 32 && Math.sign(e.x - this.px) === this.facing && Math.abs(e.x - this.px) < 92) {
        e.alive = false;
        this.mouthFull = true;
        arcadeAudio.playCoin();
        this.popups.push({ x: e.x - this.camX, y: e.y - 20, text: 'GULP! PRESS DOWN FOR EGG', color: '#4ADE80', life: 1.0, maxLife: 1.0 });
        continue;
      }

      // Kicked Koopa Shell bowls over other enemies!
      if (e.kicked) {
        for (const other of this.enemies) {
          if (other !== e && other.alive && Math.hypot(other.x - e.x, other.y - e.y) < 26) {
            other.alive = false;
            arcadeAudio.playStomp();
            this.addScore(500, other.x, other.y, 'SHELL STRIKE!');
          }
        }
      }

      if (!attract && Math.hypot(e.x - this.px, e.y - (this.py - 16)) < 26) {
        if (e.shell && !e.kicked) {
          // Kick stationary Koopa Shell!
          e.kicked = true;
          e.vx = this.facing * 390;
          arcadeAudio.playThrow();
          this.addScore(400, e.x, e.y, 'KICK!');
          continue;
        }
        const stomping = this.vy > 0 && this.py - 10 < e.y;
        if (stomping) {
          if (e.kind === 'spiny' && !this.spinJumping) {
            this.hurtPlayer();
          } else {
            this.vy = -380;
            arcadeAudio.playStomp();
            if (e.kind === 'koopa' && !e.shell) {
              e.shell = true;
              e.vx = 0;
              this.addScore(200, e.x, e.y);
            } else {
              e.alive = false;
              this.addScore(300, e.x, e.y);
            }
          }
        } else {
          this.hurtPlayer();
        }
      }
    }

    // Giant Goal Gate Ribbon (SMW 1) or Goal Ring (SMW 2)!
    const goalX = this.worldLen - 160;
    if (!attract && this.px >= goalX) {
      const heightBonus = Math.max(500, Math.round((450 - this.py) * 12));
      arcadeAudio.playStageClear();
      this.addScore(heightBonus, goalX, this.py, 'COURSE CLEAR!');
      this.phase = 'STAGE_CLEAR';
      this.stateTimer = 1.65;
    }

    this.camX = Math.max(0, Math.min(this.worldLen - this.logicalWidth, this.px - 230));
  }

  public getHudSnapshot(): ClassicGameHud {
    if (this.variant === 'smw1') {
      return {
        phase: this.phase,
        score: this.score,
        highScore: this.highScore,
        level: this.level,
        lives: this.lives,
        stageName: `YOSHI'S ISLAND ${this.level} · ${this.powerState.toUpperCase()}`,
        primaryMetricLabel: 'DRAGON COINS',
        primaryMetricValue: `${this.flowersCollected}/5`,
        secondaryMetricLabel: 'RESERVE',
        secondaryMetricValue: this.reserveItem.toUpperCase(),
        bannerText: this.phase === 'STAGE_CLEAR' ? 'COURSE CLEAR!' : this.phase === 'GAME_OVER' ? 'GAME OVER' : '',
      };
    }
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: `YOSHI'S ISLAND 2 · WORLD ${this.level}`,
      primaryMetricLabel: 'EGGS / FLOWERS',
      primaryMetricValue: `${this.eggs} EGGS · ${this.flowersCollected}/5`,
      secondaryMetricLabel: 'BABY MARIO',
      secondaryMetricValue: this.babyMarioSafe ? 'SAFE' : `${Math.ceil(this.babyTimer)}s!`,
      bannerText: this.phase === 'STAGE_CLEAR' ? 'YOSHI CLEARED!' : this.phase === 'GAME_OVER' ? 'KAMEK STOLE BABY!' : '',
    };
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = this.logicalWidth;
    const H = this.logicalHeight;

    // Pastel Yoshi's Island / Dinosaur Land Sky!
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    if (this.variant === 'smw2') {
      sky.addColorStop(0, '#BAE6FD');
      sky.addColorStop(1, '#FEF9C3');
    } else {
      sky.addColorStop(0, '#38BDF8');
      sky.addColorStop(1, '#E0F2FE');
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Distant rounded SMW hills!
    ctx.fillStyle = this.variant === 'smw2' ? '#86EFAC' : '#22C55E';
    for (let i = 0; i < 8; i++) {
      const hx = ((i * 220 - this.camX * 0.35) % (W + 260)) - 80;
      ctx.beginPath();
      ctx.ellipse(hx, 450, 110, 125 + (i % 2) * 38, 0, Math.PI, 0);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(-this.camX, 0);

    // Platforms, Pipes, ? Blocks, Yellow Turn-Blocks
    for (const p of this.platforms) {
      if (p.x + p.w < this.camX - 40 || p.x > this.camX + W + 40) continue;
      if (p.kind === 'ground') {
        ctx.fillStyle = '#92400E';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = '#22C55E';
        ctx.fillRect(p.x, p.y, p.w, 14);
      } else if (p.kind === 'pipe') {
        ctx.fillStyle = '#16A34A';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = '#4ADE80';
        ctx.fillRect(p.x - 5, p.y, p.w + 10, 18);
      } else if (p.kind === 'qblock' || p.kind === 'turnblock') {
        ctx.fillStyle = p.used ? '#78350F' : p.kind === 'qblock' ? '#F59E0B' : '#FACC15';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x, p.y, p.w, p.h);
        if (!p.used) {
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '900 18px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(p.kind === 'qblock' ? '?' : '◉', p.x + 19, p.y + 26);
        }
      } else {
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.roundRect(p.x, p.y, p.w, p.h, 12);
        ctx.fill();
      }
    }

    // Midway Gate
    ctx.fillStyle = '#CBD5E1';
    ctx.fillRect(1555, 340, 8, 108);
    if (!this.midwayReached) {
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(1563, 385, 38, 8);
    }

    // Giant Goal Gate with moving white tape!
    const gx = this.worldLen - 160;
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(gx, 140, 12, 308);
    ctx.fillRect(gx + 54, 140, 12, 308);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(gx + 12, this.goalTapeY, 42, 10);

    // Collectibles, Powerups & Winged Clouds
    for (const it of this.items) {
      if (it.collected) continue;
      if (it.kind === 'wingedCloud') {
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(it.x, it.y, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(it.x - 24, it.y - 4, 10, 8);
        ctx.fillRect(it.x + 14, it.y - 4, 10, 8);
      } else if (it.kind === 'mushroom') {
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(it.x, it.y, 12, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#FDE68A';
        ctx.fillRect(it.x - 7, it.y, 14, 10);
      } else if (it.kind === 'feather') {
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.ellipse(it.x, it.y, 7, 14, 0.35, 0, Math.PI * 2);
        ctx.fill();
      } else if (it.kind === 'flower' || it.kind === 'dragonCoin') {
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.arc(it.x, it.y, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#EA580C';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else {
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.ellipse(it.x, it.y, 7, 11, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Enemies
    for (const e of this.enemies) {
      if (!e.alive) continue;
      ctx.fillStyle = e.shell ? '#22C55E' : e.kind === 'spiny' ? '#EF4444' : e.kind === 'shyguy' ? '#EC4899' : '#16A34A';
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.shell ? 13 : 15, 0, Math.PI * 2);
      ctx.fill();
      if (e.kind === 'spiny') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(e.x - 9, e.y - 18, 4, 6);
        ctx.fillRect(e.x + 5, e.y - 18, 4, 6);
      }
    }

    // Thrown Bouncing Eggs
    for (const eg of this.thrownEggs) {
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#22C55E';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(eg.x, eg.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Floating Baby Mario Bubble (Yoshi's Island)
    if (this.variant === 'smw2' && !this.babyMarioSafe) {
      ctx.strokeStyle = '#38BDF8';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.babyX, this.babyY, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(this.babyX, this.babyY, 10, 0, Math.PI * 2);
      ctx.fill();
    }

    // Trailing Eggs behind Yoshi!
    if (this.variant === 'smw2') {
      for (let k = 0; k < this.eggs; k++) {
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#22C55E';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(this.px - this.facing * (24 + k * 18), this.py - 10, 8, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      if (this.aimingEgg) {
        const ang = this.facing > 0 ? this.eggAimAngle : Math.PI - this.eggAimAngle;
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.px + Math.cos(ang) * 78, this.py - 18 + Math.sin(ang) * 78, 11, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (this.tongueTimer > 0) {
        ctx.strokeStyle = '#F43F5E';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(this.px, this.py - 20);
        ctx.lineTo(this.px + this.facing * 88, this.py - 20);
        ctx.stroke();
      }
    }

    // Player Character (Cape Mario OR Green Yoshi!)
    ctx.save();
    ctx.translate(this.px, this.py - 18);
    if (this.spinJumping) ctx.scale(Math.sin(this.clock * 32) > 0 ? 1 : -1, 1);
    if (this.variant === 'smw2') {
      ctx.fillStyle = '#22C55E';
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(this.facing * 9, -4, 7, 0, Math.PI * 2);
      ctx.fill();
      if (this.babyMarioSafe) {
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(-this.facing * 4, -18, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      const h = this.powerState === 'small' ? 24 : 34;
      if (this.powerState === 'cape') {
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.moveTo(-this.facing * 8, -10);
        ctx.lineTo(-this.facing * 26, 12);
        ctx.lineTo(-this.facing * 4, 14);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = '#2563EB';
      ctx.fillRect(-10, 18 - h, 20, h);
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(-11, 12 - h, 22, 8);
    }
    ctx.restore();
    ctx.restore();

    // SMW 1 Authentic Top-Center Reserve Item Box!
    if (this.variant === 'smw1') {
      ctx.strokeStyle = '#FACC15';
      ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
      ctx.lineWidth = 3;
      ctx.fillRect(W * 0.5 - 24, 14, 48, 48);
      ctx.strokeRect(W * 0.5 - 24, 14, 48, 48);
      if (this.reserveItem !== 'none') {
        ctx.fillStyle = this.reserveItem === 'feather' ? '#FACC15' : '#EF4444';
        ctx.beginPath();
        ctx.arc(W * 0.5, 38, 12, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    renderParticlesAndPopups(ctx, this.particles, this.popups);
    if (this.phase === 'TITLE') {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
      ctx.fillRect(0, H * 0.34, W, 118);
      ctx.textAlign = 'center';
      ctx.font = '900 32px "JetBrains Mono", monospace';
      ctx.fillStyle = '#FACC15';
      ctx.fillText(this.variant === 'smw1' ? 'SUPER MARIO WORLD' : "YOSHI'S ISLAND (SMW 2)", W * 0.5, H * 0.34 + 46);
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText(
        this.variant === 'smw1'
          ? 'CAPE FEATHER · SHIFT = SPIN JUMP (BREAKS TURN-BLOCKS!) · KOOPA SHELLS & GOAL GATE'
          : 'FLUTTER JUMP · TONGUE + DOWN TO LAY EGGS · AIM RICOCHET EGGS & GROUND POUND!',
        W * 0.5,
        H * 0.34 + 82,
      );
    }
    if (visualMode === 'crt') renderCrtOverlay(ctx, W, H);
  }
}

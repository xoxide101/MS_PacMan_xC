import {
  drawHDBrickTile,
  drawHDMarioHero,
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

type SewerEnemyKind = 'shellcreeper' | 'sidestepper' | 'fighterfly' | 'slipice';

interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
  floorIdx: number; // 0 = bottom solid floor, 1..3 = bumpable brick tiers
}

interface BrickBump {
  x: number;
  y: number;
  timer: number;
}

interface SewerEnemy {
  id: number;
  kind: SewerEnemyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  flipped: boolean;
  flipTimer: number;
  angry: boolean; // Sidesteppers take 2 bumps!
  kicked: boolean;
  hopTimer: number;
  onGround: boolean;
}

interface SewerCoin {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

const LOGICAL_W = 864;
const LOGICAL_H = 640;
const GRAVITY = 1350;

const PLATFORMS: Platform[] = [
  // Bottom solid brick floor
  { x: 0, y: 584, w: LOGICAL_W, h: 56, floorIdx: 0 },
  // Tier 1 (Left & Right)
  { x: 0, y: 454, w: 320, h: 20, floorIdx: 1 },
  { x: 544, y: 454, w: 320, h: 20, floorIdx: 1 },
  // Tier 2 (Center wide + small outer ledges)
  { x: 200, y: 326, w: 464, h: 20, floorIdx: 2 },
  { x: 0, y: 326, w: 112, h: 20, floorIdx: 2 },
  { x: 752, y: 326, w: 112, h: 20, floorIdx: 2 },
  // Tier 3 (Top left & right under upper pipes)
  { x: 0, y: 196, w: 364, h: 20, floorIdx: 3 },
  { x: 500, y: 196, w: 364, h: 20, floorIdx: 3 },
];

const POW_BOX = { x: LOGICAL_W * 0.5 - 24, y: 444, w: 48, h: 32 };

export class MarioBrosGame implements ArcadeGameInstance {
  public readonly logicalWidth = LOGICAL_W;
  public readonly logicalHeight = LOGICAL_H;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'Jump';

  private storageKey = 'mariobros_hd_highscore_v1';
  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();

  private score = 0;
  private highScore = 0;
  private nextExtraLife = 20000;
  private level = 1;
  private lives = 3;
  private clock = 0;
  private phaseTimer = 0;

  // Player Mario
  private px = LOGICAL_W * 0.5;
  private py = 544;
  private pvx = 0;
  private pvy = 0;
  private pFacing: 1 | -1 = 1;
  private onGround = true;
  private invulnTimer = 0;
  private kickChain = 0;

  // POW block & wave state
  private powCharges = 3;
  private powShake = 0;
  private remainingToSpawn = 4;
  private spawnTimer = 1.0;
  private nextId = 1;
  private enemies: SewerEnemy[] = [];
  private coins: SewerCoin[] = [];
  private bumps: BrickBump[] = [];
  private fireball: { x: number; y: number; vx: number; active: boolean; timer: number } = {
    x: -40,
    y: 410,
    vx: 160,
    active: false,
    timer: 14,
  };
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  constructor() {
    this.highScore = readHighScore(this.storageKey);
    this.loadPhase(1);
    this.phase = 'TITLE';
  }

  private loadPhase(lvl: number): void {
    this.px = LOGICAL_W * 0.5;
    this.py = 548;
    this.pvx = 0;
    this.pvy = 0;
    this.onGround = true;
    this.enemies = [];
    this.coins = [];
    this.bumps = [];
    this.powCharges = 3;
    this.kickChain = 0;
    this.remainingToSpawn = 4 + Math.min(8, lvl * 2);
    this.spawnTimer = 0.7;
    this.fireball = { x: -40, y: 420, vx: 155, active: false, timer: Math.max(8, 16 - lvl) };
  }

  public startNewGame(): void {
    this.score = 0;
    this.nextExtraLife = 20000;
    this.level = 1;
    this.lives = 3;
    this.particles = [];
    this.popups = [];
    this.loadPhase(1);
    this.invulnTimer = 1.8;
    this.phase = 'READY';
    this.phaseTimer = 1.1;
    arcadeAudio.playArcadeStart();
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.loadPhase(1);
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
      this.nextExtraLife += 20000;
      this.lives = Math.min(6, this.lives + 1);
      arcadeAudio.playExtraLife();
      this.popups.push({ x: this.px, y: this.py - 36, text: '1UP!', color: '#4ADE80', life: 1.1, maxLife: 1.1 });
    }
    if (x !== undefined && y !== undefined) {
      this.popups.push({ x, y, text: `${pts}`, color, life: 0.85, maxLife: 0.85 });
    }
  }

  private spawnEnemy(): void {
    const fromLeft = this.nextId % 2 === 0;
    const roll = Math.random();
    let kind: SewerEnemyKind = 'shellcreeper';
    if (this.level >= 2 && roll < 0.36) kind = 'sidestepper';
    else if (this.level >= 3 && roll < 0.62) kind = 'fighterfly';
    else if (this.level >= 4 && roll < 0.78) kind = 'slipice';

    const spd = (kind === 'sidestepper' ? 92 : kind === 'fighterfly' ? 105 : 78) + this.level * 7;
    this.enemies.push({
      id: this.nextId++,
      kind,
      x: fromLeft ? 78 : LOGICAL_W - 78,
      y: 162,
      vx: fromLeft ? spd : -spd,
      vy: 0,
      flipped: false,
      flipTimer: 0,
      angry: false,
      kicked: false,
      hopTimer: 0.7,
      onGround: false,
    });
  }

  private bumpFloorAt(bx: number, platY: number): void {
    this.bumps.push({ x: bx, y: platY, timer: 0.2 });
    arcadeAudio.playRockThud();

    for (const e of this.enemies) {
      if (e.kicked) continue;
      if (Math.abs(e.x - bx) < 48 && Math.abs(e.y + 18 - platY) < 28) {
        this.hitEnemyFromBelow(e);
      }
    }
  }

  private hitEnemyFromBelow(e: SewerEnemy): void {
    e.vy = -260;
    if (e.kind === 'slipice') {
      // Slipice shatters immediately!
      e.kicked = true;
      this.addScore(500, e.x, e.y - 16, '#38BDF8');
      spawnBurst(this.particles, e.x, e.y, '#38BDF8', 16, 200, 3);
      arcadeAudio.playStomp();
      return;
    }
    if (e.kind === 'sidestepper' && !e.angry && !e.flipped) {
      // Crabs get furious and faster on first bump!
      e.angry = true;
      e.vx *= 1.45;
      this.popups.push({ x: e.x, y: e.y - 20, text: 'ANGRY!', color: '#FB923C', life: 0.6, maxLife: 0.6 });
      arcadeAudio.playPump(2);
      return;
    }
    e.flipped = !e.flipped;
    e.flipTimer = e.flipped ? 6.5 : 0;
    if (e.flipped) {
      this.addScore(100, e.x, e.y - 14, '#FDE047');
      arcadeAudio.playStomp();
    }
  }

  private triggerPow(): void {
    if (this.powCharges <= 0) return;
    this.powCharges -= 1;
    this.powShake = 0.45;
    arcadeAudio.playPowBlock();
    spawnBurst(this.particles, LOGICAL_W * 0.5, POW_BOX.y + 16, '#38BDF8', 22, 240, 3.5);
    for (const e of this.enemies) {
      if (!e.kicked && e.onGround) {
        this.hitEnemyFromBelow(e);
      }
    }
  }

  private loseLife(): void {
    if (this.invulnTimer > 0) return;
    arcadeAudio.playExplosion(false);
    spawnBurst(this.particles, this.px, this.py, '#EF4444', 22, 220, 3.2);
    this.lives -= 1;
    if (this.lives <= 0) {
      this.phase = 'GAME_OVER';
      arcadeAudio.playDeath();
      return;
    }
    this.px = LOGICAL_W * 0.5;
    this.py = 130;
    this.pvx = 0;
    this.pvy = 0;
    this.invulnTimer = 2.4;
  }

  public step(dt: number): void {
    this.clock += dt;
    if (this.powShake > 0) this.powShake = Math.max(0, this.powShake - dt);
    stepParticlesAndPopups(this.particles, this.popups, dt);

    for (let i = this.bumps.length - 1; i >= 0; i--) {
      this.bumps[i].timer -= dt;
      if (this.bumps[i].timer <= 0) this.bumps.splice(i, 1);
    }

    if (this.phase === 'TITLE') {
      this.px = LOGICAL_W * 0.5 + Math.sin(this.clock * 1.4) * 210;
      this.pFacing = Math.cos(this.clock * 1.4) >= 0 ? 1 : -1;
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
        this.loadPhase(this.level);
        this.phase = 'READY';
        this.phaseTimer = 1.05;
      }
      return;
    }

    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);

    // Mario arcade run & skid inertia
    const accel = this.onGround ? 1450 : 950;
    const maxSpd = 265;
    if (this.input.left && !this.input.right) {
      this.pFacing = -1;
      this.pvx = Math.max(-maxSpd, this.pvx - accel * dt);
    } else if (this.input.right && !this.input.left) {
      this.pFacing = 1;
      this.pvx = Math.min(maxSpd, this.pvx + accel * dt);
    } else {
      const friction = this.onGround ? 0.0005 : 0.25;
      this.pvx *= Math.pow(friction, dt);
      if (Math.abs(this.pvx) < 6) this.pvx = 0;
    }

    // Jump on Up or Space
    if ((this.input.fireJustPressed || this.input.up) && this.onGround) {
      this.pvy = -615;
      this.onGround = false;
      arcadeAudio.playJumpBoing();
    }

    this.pvy = Math.min(720, this.pvy + GRAVITY * dt);
    const prevY = this.py;
    this.px += this.pvx * dt;
    this.py += this.pvy * dt;

    // Wrap horizontally across screen edges!
    if (this.px < -14) this.px = LOGICAL_W + 14;
    if (this.px > LOGICAL_W + 14) this.px = -14;

    // Platform collisions (landing & bumping from below!)
    this.onGround = false;
    const halfW = 14;
    const halfH = 19;

    // POW block collision from underneath
    if (
      this.powCharges > 0 &&
      this.pvy < 0 &&
      this.px + halfW > POW_BOX.x &&
      this.px - halfW < POW_BOX.x + POW_BOX.w &&
      prevY - halfH >= POW_BOX.y + POW_BOX.h - 6 &&
      this.py - halfH <= POW_BOX.y + POW_BOX.h
    ) {
      this.py = POW_BOX.y + POW_BOX.h + halfH;
      this.pvy = 80;
      this.triggerPow();
    }

    for (const p of PLATFORMS) {
      if (this.px + halfW > p.x && this.px - halfW < p.x + p.w) {
        // Landing on top
        if (this.pvy >= 0 && prevY + halfH <= p.y + 8 && this.py + halfH >= p.y) {
          this.py = p.y - halfH;
          this.pvy = 0;
          this.onGround = true;
          this.kickChain = 0;
        }
        // Head-bumping underside of tier 1..3!
        else if (
          p.floorIdx > 0 &&
          this.pvy < 0 &&
          prevY - halfH >= p.y + p.h - 8 &&
          this.py - halfH <= p.y + p.h
        ) {
          this.py = p.y + p.h + halfH;
          this.pvy = 90;
          this.bumpFloorAt(this.px, p.y);
        }
      }
    }

    // Spawner
    if (this.remainingToSpawn > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnEnemy();
        this.remainingToSpawn -= 1;
        this.spawnTimer = Math.max(1.3, 2.8 - this.level * 0.2);
      }
    }

    // Fireball hazard
    if (!this.fireball.active) {
      this.fireball.timer -= dt;
      if (this.fireball.timer <= 0) {
        this.fireball.active = true;
        this.fireball.x = -20;
        this.fireball.y = [285, 415, 540][Math.floor(Math.random() * 3)];
        this.fireball.vx = 165 + this.level * 12;
      }
    } else {
      this.fireball.x += this.fireball.vx * dt;
      if (this.fireball.x > LOGICAL_W + 40) {
        this.fireball.active = false;
        this.fireball.timer = Math.max(7, 14 - this.level);
      } else if (Math.hypot(this.fireball.x - this.px, this.fireball.y - this.py) < 24) {
        this.loseLife();
        return;
      }
    }

    // Update Enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.kicked) {
        e.vy += GRAVITY * dt;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        if (e.y > LOGICAL_H + 50) {
          this.enemies.splice(i, 1);
        }
        continue;
      }

      if (e.flipped) {
        e.flipTimer -= dt;
        if (e.flipTimer <= 0) {
          e.flipped = false;
          e.angry = true;
          e.vx = Math.sign(e.vx || 1) * (Math.abs(e.vx) * 1.25);
        }
      } else {
        e.x += e.vx * dt;
        if (e.kind === 'fighterfly' && e.onGround) {
          e.hopTimer -= dt;
          if (e.hopTimer <= 0) {
            e.vy = -340;
            e.onGround = false;
            e.hopTimer = 0.85;
          }
        }
      }

      // Wrap & bottom pipe recycling back to top pipes!
      if (e.y > 530 && (e.x < 52 || e.x > LOGICAL_W - 52)) {
        e.x = e.x < 52 ? 78 : LOGICAL_W - 78;
        e.y = 162;
        e.vx = e.x < LOGICAL_W * 0.5 ? Math.abs(e.vx) : -Math.abs(e.vx);
      } else {
        if (e.x < -14) e.x = LOGICAL_W + 14;
        if (e.x > LOGICAL_W + 14) e.x = -14;
      }

      e.vy = Math.min(620, e.vy + GRAVITY * dt);
      const ePrevY = e.y;
      e.y += e.vy * dt;
      e.onGround = false;

      for (const p of PLATFORMS) {
        if (e.x + 14 > p.x && e.x - 14 < p.x + p.w) {
          if (e.vy >= 0 && ePrevY + 16 <= p.y + 8 && e.y + 16 >= p.y) {
            e.y = p.y - 16;
            e.vy = 0;
            e.onGround = true;
          }
        }
      }

      // Mario collision with enemy!
      if (Math.abs(e.x - this.px) < 26 && Math.abs(e.y - this.py) < 28) {
        if (e.flipped) {
          // Kick flipped enemy off screen for escalating bonus + spawn bonus coin!
          e.kicked = true;
          e.vx = this.px <= e.x ? 290 : -290;
          e.vy = -320;
          this.kickChain += 1;
          const pts = 800 * Math.min(4, this.kickChain);
          this.addScore(pts, e.x, e.y - 16, '#4ADE80');
          arcadeAudio.playEatGhost();
          spawnBurst(this.particles, e.x, e.y, '#FACC15', 14, 190, 3);
          this.coins.push({
            x: e.x < LOGICAL_W * 0.5 ? 84 : LOGICAL_W - 84,
            y: 162,
            vx: e.x < LOGICAL_W * 0.5 ? 120 : -120,
            vy: -120,
            life: 10,
          });
        } else {
          this.loseLife();
          return;
        }
      }
    }

    // Update bonus coins
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      c.life -= dt;
      c.vy = Math.min(500, c.vy + GRAVITY * 0.7 * dt);
      const cyPrev = c.y;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      if (c.x < -10) c.x = LOGICAL_W + 10;
      if (c.x > LOGICAL_W + 10) c.x = -10;

      for (const p of PLATFORMS) {
        if (c.x > p.x && c.x < p.x + p.w && c.vy >= 0 && cyPrev + 10 <= p.y + 8 && c.y + 10 >= p.y) {
          c.y = p.y - 10;
          c.vy = -170;
        }
      }
      if (Math.hypot(c.x - this.px, c.y - this.py) < 28) {
        this.addScore(800, c.x, c.y - 14, '#FACC15');
        arcadeAudio.playCoin();
        spawnBurst(this.particles, c.x, c.y, '#FACC15', 10, 150, 2.5);
        this.coins.splice(i, 1);
      } else if (c.life <= 0) {
        this.coins.splice(i, 1);
      }
    }

    // Phase clear!
    if (this.remainingToSpawn <= 0 && this.enemies.every((e) => e.kicked)) {
      this.addScore(1500, this.px, this.py - 32, '#4ADE80');
      arcadeAudio.playStageClear();
      this.phase = 'STAGE_CLEAR';
      this.phaseTimer = 1.6;
    }
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.save();
    ctx.scale(dpr, dpr);

    // Rich subterranean arcade sewer vault backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
    bgGrad.addColorStop(0, '#040713');
    bgGrad.addColorStop(0.55, '#070D20');
    bgGrad.addColorStop(1, '#091124');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // Subtle arched subterranean brickwork & ambient water sheen behind action
    ctx.fillStyle = 'rgba(30, 58, 138, 0.08)';
    for (let row = 0; row < 14; row++) {
      const y = 52 + row * 38;
      const offset = (row % 2) * 32;
      for (let x = -32 + offset; x < LOGICAL_W; x += 64) {
        ctx.fillRect(x, y, 58, 32);
      }
    }
    // Distant sewer archways
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(190 + i * 242, 584, 96, Math.PI, 0);
      ctx.stroke();
    }

    if (this.powShake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * 14 * this.powShake,
        (Math.random() - 0.5) * 14 * this.powShake
      );
    }

    // 4 Iconic Glossy Emerald Sewer Pipes with curved elbow flanges
    this.drawPipe(ctx, 0, 126, 78, 48, true);
    this.drawPipe(ctx, LOGICAL_W - 78, 126, 78, 48, false);
    this.drawPipe(ctx, 0, 524, 66, 54, true);
    this.drawPipe(ctx, LOGICAL_W - 66, 524, 66, 54, false);

    // Authentic beveled brick tiers with bump-wave ripple!
    const tierPalettes: Array<[string, string, string]> = [
      ['#B45309', '#F59E0B', '#291002'], // Floor brick
      ['#0284C7', '#38BDF8', '#082F49'], // Tier 1 Arcade Blue
      ['#0284C7', '#38BDF8', '#082F49'], // Tier 2 Arcade Blue
      ['#0284C7', '#38BDF8', '#082F49'], // Tier 3 Arcade Blue
    ];
    for (const p of PLATFORMS) {
      const [base, light, mortar] = tierPalettes[p.floorIdx];
      const brickW = 28;
      const count = Math.ceil(p.w / brickW);
      for (let i = 0; i < count; i++) {
        const bx = p.x + i * brickW;
        const bw = Math.min(brickW, p.x + p.w - bx);
        let bumpLift = 0;
        for (const b of this.bumps) {
          if (Math.abs(b.y - p.y) < 4 && Math.abs(bx + bw * 0.5 - b.x) < 48) {
            const falloff = 1 - Math.abs(bx + bw * 0.5 - b.x) / 48;
            bumpLift = Math.max(bumpLift, Math.sin((b.timer / 0.2) * Math.PI) * 12 * falloff);
          }
        }
        drawHDBrickTile(ctx, bx, p.y - bumpLift, bw, p.h, base, light, mortar);
        if (bumpLift > 1.5) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
          ctx.fillRect(bx, p.y - bumpLift, bw, 3);
        }
      }
    }

    // Iconic 3D Beveled Arcade POW Block
    if (this.powCharges > 0) {
      const hScale = 0.5 + (this.powCharges / 3) * 0.5;
      const ph = POW_BOX.h * hScale;
      const py = POW_BOX.y + (POW_BOX.h - ph) * 0.5;
      const pulse = 0.5 + 0.5 * Math.sin(this.clock * 7);
      ctx.save();
      ctx.shadowColor = '#38BDF8';
      ctx.shadowBlur = 10 + pulse * 6;
      const pg = ctx.createLinearGradient(POW_BOX.x, py, POW_BOX.x, py + ph);
      pg.addColorStop(0, '#38BDF8');
      pg.addColorStop(0.5, '#1D4ED8');
      pg.addColorStop(1, '#1E3A8A');
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.roundRect(POW_BOX.x, py, POW_BOX.w, ph, 4);
      ctx.fill();
      ctx.strokeStyle = '#BAE6FD';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0F172A';
      ctx.font = '900 13px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('POW', POW_BOX.x + POW_BOX.w * 0.5 + 1, py + ph * 0.5 + 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('POW', POW_BOX.x + POW_BOX.w * 0.5, py + ph * 0.5 + 1);
      ctx.restore();
    }

    // Spinning Grooved Arcade Bonus Coins with glint
    for (const c of this.coins) {
      const spin = Math.max(0.22, Math.abs(Math.cos(this.clock * 10 + c.x * 0.05)));
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(spin, 1);
      const cg = ctx.createRadialGradient(-3, -3, 1, 0, 0, 11);
      cg.addColorStop(0, '#FEF9C3');
      cg.addColorStop(0.55, '#FACC15');
      cg.addColorStop(1, '#B45309');
      ctx.fillStyle = cg;
      ctx.strokeStyle = '#78350F';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, 10.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Inner embossed coin slot
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(-2, -5.5, 4, 11);
      ctx.restore();
      if (spin > 0.85) {
        drawStarGlint(ctx, c.x + 5, c.y - 6, 4.5, '#FFFFFF', this.clock * 5);
      }
    }

    // Swirling Multi-Layer Arcade Fireball Hazard
    if (this.fireball.active) {
      ctx.save();
      ctx.translate(this.fireball.x, this.fireball.y);
      const fg = ctx.createRadialGradient(0, 0, 2, 0, 0, 18);
      fg.addColorStop(0, '#FFFFFF');
      fg.addColorStop(0.35, '#FEF08A');
      fg.addColorStop(0.7, '#F97316');
      fg.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      // Orbiting flame licks
      ctx.rotate(this.clock * 14);
      ctx.fillStyle = '#EF4444';
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * 10, Math.sin(a) * 10, 5.5, 3, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Sewer Enemies
    for (const e of this.enemies) {
      this.drawEnemy(ctx, e);
    }

    // Player Mario
    if (this.phase !== 'GAME_OVER') {
      const blink = this.invulnTimer > 0 && Math.floor(this.clock * 16) % 2 === 0;
      if (!blink) {
        this.drawMario(ctx, this.px, this.py, this.pFacing);
      }
    }

    renderParticlesAndPopups(ctx, this.particles, this.popups);

    // Top HUD
    ctx.fillStyle = 'rgba(4, 7, 16, 0.72)';
    ctx.fillRect(0, 0, LOGICAL_W, 44);
    ctx.font = '700 14px "JetBrains Mono", monospace';
    ctx.fillStyle = '#FACC15';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${this.score.toLocaleString()}`, 22, 27);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#38BDF8';
    ctx.fillText(`PHASE ${this.level}`, LOGICAL_W * 0.5, 27);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText(`POW ×${this.powCharges}`, LOGICAL_W - 22, 27);

    if (this.phase === 'READY' || this.phase === 'STAGE_CLEAR') {
      ctx.fillStyle = 'rgba(4, 7, 16, 0.84)';
      ctx.beginPath();
      ctx.roundRect(LOGICAL_W * 0.5 - 165, LOGICAL_H * 0.5 - 32, 330, 64, 10);
      ctx.fill();
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = '800 22px "Outfit", sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        this.phase === 'READY' ? `SEWER PHASE ${this.level}` : `PHASE ${this.level} CLEAR!`,
        LOGICAL_W * 0.5,
        LOGICAL_H * 0.5
      );
    }

    if (visualMode === 'crt') {
      renderCrtOverlay(ctx, LOGICAL_W, LOGICAL_H);
    }
    ctx.restore();
  }

  private drawPipe(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    openRight: boolean
  ): void {
    drawHDWarpPipe(ctx, x, y, w, h, openRight ? 'right' : 'left');
  }

  private drawMario(ctx: CanvasRenderingContext2D, x: number, y: number, dir: 1 | -1): void {
    drawHDMarioHero(ctx, {
      x,
      y: y - 2,
      facing: dir,
      scale: 0.96,
      walkPhase: this.clock * 16,
      isMoving: Math.abs(this.pvx) > 15,
      isJumping: !this.onGround,
      character: 'mario',
      clock: this.clock,
    });
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: SewerEnemy): void {
    const facing = e.vx >= 0 ? 1 : -1;
    const walk = Math.sin(this.clock * 14 + e.id * 1.7);
    ctx.save();
    ctx.translate(e.x, e.y);
    if (!e.flipped) drawSoftShadow(ctx, 0, 12, 13, 3.5, 0.35);
    if (e.flipped) {
      ctx.rotate(Math.sin(this.clock * 22 + e.id) * 0.14);
      ctx.scale(1, -1);
    }

    if (e.kind === 'shellcreeper') {
      ctx.scale(facing, 1);
      // Animated kicking turtle legs
      const kick = e.flipped ? Math.sin(this.clock * 28) * 4 : walk * 3;
      ctx.fillStyle = '#FB923C';
      ctx.strokeStyle = '#7C2D12';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(-7 + kick * 0.4, 8, 4.5, 3, 0, 0, Math.PI * 2);
      ctx.ellipse(6 - kick * 0.4, 8, 4.5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Sculpted hexagonal turtle shell
      const shGrad = ctx.createRadialGradient(-4, -6, 2, 0, 0, 15);
      shGrad.addColorStop(0, e.angry ? '#FCA5A5' : '#86EFAC');
      shGrad.addColorStop(0.5, e.angry ? '#EF4444' : '#16A34A');
      shGrad.addColorStop(1, e.angry ? '#7F1D1D' : '#14532D');
      ctx.fillStyle = shGrad;
      ctx.strokeStyle = '#052E16';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 3, 13.5, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Shell scute ridge pattern
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-6, -2);
      ctx.lineTo(0, -8);
      ctx.lineTo(6, -2);
      ctx.stroke();

      // Cream belly rim
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.roundRect(-14, 2, 28, 5, 2.5);
      ctx.fill();
      ctx.strokeStyle = '#78350F';
      ctx.stroke();

      // Protruding turtle head & expressive eye
      ctx.fillStyle = '#FB923C';
      ctx.beginPath();
      ctx.arc(13, 0, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(14.5, -1.8, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(15.5, -1.8, 1.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'sidestepper') {
      // Scuttling crab legs
      ctx.strokeStyle = e.angry ? '#F43F5E' : '#EA580C';
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      for (const side of [-1, 1]) {
        for (let l = 0; l < 3; l++) {
          const lift = Math.sin(this.clock * 18 + l * 1.4 + side) * 3;
          ctx.beginPath();
          ctx.moveTo(side * 10, 4 + l * 2);
          ctx.lineTo(side * (16 + l * 1.5), 11 + lift);
          ctx.stroke();
        }
      }
      // Snapping big pincer claws overhead
      const snap = Math.abs(Math.sin(this.clock * (e.angry ? 22 : 12))) * 4.5;
      for (const side of [-1, 1]) {
        ctx.fillStyle = e.angry ? '#FB7185' : '#F97316';
        ctx.strokeStyle = '#431407';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.arc(side * 15, -9, 6.5, 0.4, Math.PI * 2 - 0.4);
        ctx.lineTo(side * 15, -9 - snap * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      // Armored crab carapace
      const cg = ctx.createRadialGradient(-4, -5, 2, 0, 1, 17);
      cg.addColorStop(0, e.angry ? '#FDA4AF' : '#FDBA74');
      cg.addColorStop(0.55, e.angry ? '#E11D48' : '#EA580C');
      cg.addColorStop(1, '#7C2D12');
      ctx.fillStyle = cg;
      ctx.strokeStyle = '#431407';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(-14, -6, 28, 15, 7);
      ctx.fill();
      ctx.stroke();
      // Angry furrowed eyes
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-5, -1, 3.2, 0, Math.PI * 2);
      ctx.arc(5, -1, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(-4.5, -1, 1.6, 0, Math.PI * 2);
      ctx.arc(4.5, -1, 1.6, 0, Math.PI * 2);
      ctx.fill();
      if (e.angry) {
        ctx.strokeStyle = '#FEF08A';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-9, -6);
        ctx.lineTo(-2, -3);
        ctx.moveTo(9, -6);
        ctx.lineTo(2, -3);
        ctx.stroke();
      }
    } else if (e.kind === 'fighterfly') {
      // Rapidly buzzing translucent iridescent wings
      const flap = Math.sin(this.clock * 42 + e.id) * 6;
      ctx.fillStyle = 'rgba(224, 242, 254, 0.72)';
      ctx.strokeStyle = '#7DD3FC';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.ellipse(-9, -8 + flap * 0.4, 9, 4.5, -0.45, 0, Math.PI * 2);
      ctx.ellipse(9, -8 - flap * 0.4, 9, 4.5, 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Violet fly body with glossy highlight
      const fg = ctx.createRadialGradient(-3, -2, 1, 0, 2, 14);
      fg.addColorStop(0, '#E9D5FF');
      fg.addColorStop(0.45, '#9333EA');
      fg.addColorStop(1, '#3B0764');
      ctx.fillStyle = fg;
      ctx.strokeStyle = '#1E1B4B';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(0, 2, 13, 9.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Glowing amber compound eyes
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(-4.5, 0, 3.6, 0, Math.PI * 2);
      ctx.arc(4.5, 0, 3.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(-4.5, 0, 1.5, 0, Math.PI * 2);
      ctx.arc(4.5, 0, 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Slipice crystalline faceted frost spirit
      const icg = ctx.createRadialGradient(-3, -4, 1, 0, 0, 16);
      icg.addColorStop(0, '#FFFFFF');
      icg.addColorStop(0.5, '#38BDF8');
      icg.addColorStop(1, '#0369A1');
      ctx.fillStyle = icg;
      ctx.strokeStyle = '#E0F2FE';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -15);
      ctx.lineTo(13, 0);
      ctx.lineTo(0, 14);
      ctx.lineTo(-13, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      drawStarGlint(ctx, -4, -5, 4.5, '#FFFFFF', this.clock * 4);
      // Icy eyes
      ctx.fillStyle = '#0C4A6E';
      ctx.fillRect(-5, -2, 3, 4);
      ctx.fillRect(2, -2, 3, 4);
    }
    ctx.restore();
  }

  public getHudSnapshot(): ClassicGameHud {
    const alive = this.enemies.filter((e) => !e.kicked).length + this.remainingToSpawn;
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: `Mario Bros. · Phase ${this.level}`,
      primaryMetricLabel: 'Pests Left',
      primaryMetricValue: `${alive}`,
      secondaryMetricLabel: 'POW Block',
      secondaryMetricValue: `${this.powCharges} Hits`,
      bannerText: '',
    };
  }
}

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

export type VectorSpaceVariant = 'asteroidsdeluxe' | 'spaceduel' | 'starcastle';

interface SpaceRock {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  size: 1 | 2 | 3;
  angle: number;
  spin: number;
  shape: 'rock' | 'spinner' | 'diamond' | 'pinwheel' | 'square';
  color: string;
  verts: number[];
}

interface KillerPod {
  x: number;
  y: number;
  vx: number;
  vy: number;
  stage: 'cluster' | 'shard';
  hp: number;
  angle: number;
}

interface UfoSaucer {
  x: number;
  y: number;
  vx: number;
  vy: number;
  small: boolean;
  fireCd: number;
}

interface CastleMine {
  ring: number; // 0..2 while riding ring, -1 while chasing player
  angle: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  chaseTimer: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  fromEnemy: boolean;
  color: string;
  radius: number;
}

export class VectorSpaceGame implements ArcadeGameInstance {
  public readonly logicalWidth = 760;
  public readonly logicalHeight = 580;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'Fire Cannon';
  public readonly secondaryActionLabel: string;

  private readonly variant: VectorSpaceVariant;
  private readonly storageKey: string;
  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();

  private score = 0;
  private highScore = 0;
  private level = 1;
  private lives = 3;
  private clock = 0;
  private stateTimer = 0;

  // Player ship physics
  private px = 380;
  private py = 290;
  private vx = 0;
  private vy = 0;
  private angle = -Math.PI / 2;
  private invulnTimer = 0;
  private fireCd = 0;
  private shieldEnergy = 100;
  private shieldActive = false;

  // Space Duel Tethered Twin-Ship mode!
  private tetherMode = true;
  private tetherAngle = 0;
  private tetherDist = 52;

  // Asteroids Deluxe & Space Duel entities
  private rocks: SpaceRock[] = [];
  private killerPods: KillerPod[] = [];
  private saucer: UfoSaucer | null = null;
  private saucerCd = 7.5;
  private killerCd = 9.0;

  // Star Castle authentic 3 concentric 12-segment shields + line-of-sight cannon + ring-riding mines
  private rings: Array<{ r: number; rot: number; speed: number; color: string; segments: boolean[] }> = [];
  private cannonAngle = 0;
  private cannonFireCd = 1.4;
  private castleMines: CastleMine[] = [];

  private bullets: Bullet[] = [];
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  constructor(variant: VectorSpaceVariant) {
    this.variant = variant;
    this.storageKey = `${variant}_hd_highscore_v2`;
    this.highScore = readHighScore(this.storageKey);
    this.secondaryActionLabel =
      variant === 'asteroidsdeluxe'
        ? 'Force Shield'
        : variant === 'spaceduel'
          ? 'Toggle Tether Ship'
          : 'Hyper Thrust';
    this.setupWave(1);
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public startNewGame(): void {
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.shieldEnergy = 100;
    this.phase = 'READY';
    this.stateTimer = 0.9;
    this.setupWave(1);
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.setupWave(1);
  }

  private addScore(pts: number, x?: number, y?: number, label?: string): void {
    const prev = Math.floor(this.score / 10000);
    this.score += pts;
    if (Math.floor(this.score / 10000) > prev) {
      this.lives += 1;
      arcadeAudio.playExtraLife();
    }
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

  private resetPlayer(): void {
    if (this.variant === 'starcastle') {
      this.px = 135;
      this.py = this.logicalHeight * 0.5;
      this.angle = 0;
    } else {
      this.px = this.logicalWidth * 0.5;
      this.py = this.logicalHeight * 0.5;
      this.angle = -Math.PI / 2;
    }
    this.vx = 0;
    this.vy = 0;
    this.invulnTimer = 2.0;
  }

  private makeRock(x: number, y: number, size: 1 | 2 | 3): SpaceRock {
    const radius = size === 3 ? 38 : size === 2 ? 23 : 13;
    const speed = (size === 3 ? 52 : size === 2 ? 84 : 124) + this.level * 7;
    const dir = Math.random() * Math.PI * 2;
    const shapes: SpaceRock['shape'][] =
      this.variant === 'spaceduel' ? ['spinner', 'diamond', 'pinwheel', 'square'] : ['rock'];
    const palette =
      this.variant === 'spaceduel' ? ['#38BDF8', '#F472B6', '#FACC15', '#4ADE80'] : ['#BAE6FD'];
    const verts: number[] = [];
    for (let i = 0; i < 10; i++) verts.push(0.76 + Math.random() * 0.42);
    return {
      x,
      y,
      vx: Math.cos(dir) * speed,
      vy: Math.sin(dir) * speed,
      r: radius,
      size,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 3.1,
      shape: shapes[Math.floor(Math.random() * shapes.length)],
      color: palette[Math.floor(Math.random() * palette.length)],
      verts,
    };
  }

  private setupWave(lvl: number): void {
    this.resetPlayer();
    this.bullets = [];
    this.rocks = [];
    this.killerPods = [];
    this.saucer = null;
    this.saucerCd = Math.max(4.5, 8.5 - lvl * 0.4);
    this.killerCd = Math.max(5.5, 10 - lvl * 0.5);

    if (this.variant === 'starcastle') {
      const baseSpeed = 0.58 + lvl * 0.08;
      this.rings = [
        { r: 54, rot: 0, speed: baseSpeed * 1.15, color: '#FACC15', segments: Array(12).fill(true) },
        { r: 80, rot: 0.4, speed: -baseSpeed * 0.92, color: '#38BDF8', segments: Array(12).fill(true) },
        { r: 106, rot: 0.9, speed: baseSpeed * 0.72, color: '#F472B6', segments: Array(12).fill(true) },
      ];
      this.castleMines = [0, 1, 2].map((idx) => ({
        ring: idx,
        angle: idx * 2.1,
        x: this.logicalWidth * 0.5,
        y: this.logicalHeight * 0.5,
        vx: 0,
        vy: 0,
        chaseTimer: 2.2 + idx * 1.5,
      }));
      this.cannonFireCd = 1.2;
    } else {
      const count = Math.min(9, 4 + lvl);
      for (let i = 0; i < count; i++) {
        let rx = Math.random() * this.logicalWidth;
        let ry = Math.random() * this.logicalHeight;
        if (Math.hypot(rx - this.px, ry - this.py) < 145) {
          rx = (rx + 260) % this.logicalWidth;
        }
        this.rocks.push(this.makeRock(rx, ry, 3));
      }
    }
  }

  private isLineOfSightClear(targetAngle: number): boolean {
    // Authentic Star Castle: Cannon can ONLY fire if a continuous radial gap exists through ALL 3 rings!
    const norm = (a: number) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    for (const ring of this.rings) {
      const rel = norm(targetAngle - ring.rot);
      const segIdx = Math.floor((rel / (Math.PI * 2)) * 12) % 12;
      if (ring.segments[segIdx]) return false;
    }
    return true;
  }

  private killPlayer(): void {
    if (this.invulnTimer > 0 || this.shieldActive || this.phase !== 'PLAYING') return;
    this.lives -= 1;
    spawnBurst(this.particles, this.px, this.py, '#38BDF8', 24, 240, 3.6);
    arcadeAudio.playDeath();
    if (this.lives <= 0) this.phase = 'GAME_OVER';
    else this.resetPlayer();
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
        this.setupWave(this.level);
      }
      return;
    }

    const attract = this.phase === 'TITLE';
    this.fireCd = Math.max(0, this.fireCd - dt);
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);

    // Secondary action
    if (!attract && this.variant === 'spaceduel' && this.input.secondaryJustPressed) {
      this.tetherMode = !this.tetherMode;
      arcadeAudio.playCoin();
    }
    this.shieldActive =
      !attract && this.variant === 'asteroidsdeluxe' && this.input.secondary && this.shieldEnergy > 5;
    if (this.shieldActive) {
      this.shieldEnergy = Math.max(0, this.shieldEnergy - dt * 36);
    } else {
      this.shieldEnergy = Math.min(100, this.shieldEnergy + dt * 11);
    }

    // Ship controls
    if (attract) {
      this.angle += 1.3 * dt;
      this.vx += Math.cos(this.angle) * 120 * dt;
      this.vy += Math.sin(this.angle) * 120 * dt;
    } else {
      if (this.input.left) this.angle -= 4.2 * dt;
      if (this.input.right) this.angle += 4.2 * dt;
      if (this.input.up || (this.variant === 'starcastle' && this.input.secondary)) {
        const thrust = this.variant === 'starcastle' && this.input.secondary ? 380 : 255;
        this.vx += Math.cos(this.angle) * thrust * dt;
        this.vy += Math.sin(this.angle) * thrust * dt;
      }
    }
    this.vx *= Math.pow(0.985, dt * 60);
    this.vy *= Math.pow(0.985, dt * 60);
    const spd = Math.hypot(this.vx, this.vy);
    if (spd > 310) {
      this.vx = (this.vx / spd) * 310;
      this.vy = (this.vy / spd) * 310;
    }
    this.px = (this.px + this.vx * dt + this.logicalWidth) % this.logicalWidth;
    this.py = (this.py + this.vy * dt + this.logicalHeight) % this.logicalHeight;
    this.tetherAngle += 1.55 * dt;

    // Player ships positions (1 ship normally, or 2 tethered ships in Space Duel!)
    const shipPts: Array<{ x: number; y: number; a: number }> =
      this.variant === 'spaceduel' && this.tetherMode
        ? [
            {
              x: this.px + Math.cos(this.tetherAngle) * (this.tetherDist * 0.5),
              y: this.py + Math.sin(this.tetherAngle) * (this.tetherDist * 0.5),
              a: this.angle,
            },
            {
              x: this.px - Math.cos(this.tetherAngle) * (this.tetherDist * 0.5),
              y: this.py - Math.sin(this.tetherAngle) * (this.tetherDist * 0.5),
              a: this.angle,
            },
          ]
        : [{ x: this.px, y: this.py, a: this.angle }];

    // Fire bullets
    const wantFire = attract ? Math.sin(this.clock * 4) > 0.85 : this.input.fire || this.input.fireJustPressed;
    if (wantFire && this.fireCd <= 0 && this.bullets.filter((b) => !b.fromEnemy).length < 7) {
      this.fireCd = 0.16;
      for (const sp of shipPts) {
        this.bullets.push({
          x: sp.x + Math.cos(sp.a) * 16,
          y: sp.y + Math.sin(sp.a) * 16,
          vx: Math.cos(sp.a) * 480 + this.vx * 0.25,
          vy: Math.sin(sp.a) * 480 + this.vy * 0.25,
          life: 1.05,
          fromEnemy: false,
          color: this.variant === 'spaceduel' ? '#FACC15' : '#FFFFFF',
          radius: 3,
        });
      }
      if (!attract) arcadeAudio.playLaser();
    }

    // Update bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x = (b.x + b.vx * dt + this.logicalWidth) % this.logicalWidth;
      b.y = (b.y + b.vy * dt + this.logicalHeight) % this.logicalHeight;
      b.life -= dt;
      if (b.life <= 0) {
        this.bullets.splice(i, 1);
        continue;
      }
      if (b.fromEnemy) {
        for (const sp of shipPts) {
          if (Math.hypot(sp.x - b.x, sp.y - b.y) < 15 + b.radius) {
            this.bullets.splice(i, 1);
            this.killPlayer();
            break;
          }
        }
      }
    }

    if (this.variant === 'starcastle') {
      this.stepStarCastle(dt, attract, shipPts);
    } else {
      this.stepAsteroidsOrDuel(dt, attract, shipPts);
    }
  }

  private stepStarCastle(dt: number, attract: boolean, shipPts: Array<{ x: number; y: number; a: number }>): void {
    const cx = this.logicalWidth * 0.5;
    const cy = this.logicalHeight * 0.5;

    // Rotate 3 concentric rings
    for (const r of this.rings) {
      r.rot += r.speed * dt;
    }

    // Keep ship outside outer shield ring
    const dPlayer = Math.hypot(this.px - cx, this.py - cy);
    if (dPlayer < 126) {
      const pushA = Math.atan2(this.py - cy, this.px - cx);
      this.px = cx + Math.cos(pushA) * 128;
      this.py = cy + Math.sin(pushA) * 128;
      this.vx = Math.cos(pushA) * 130;
      this.vy = Math.sin(pushA) * 130;
    }

    // Central Star Castle Cannon aims at player and ONLY fires when all 3 rings align open!
    const desired = Math.atan2(this.py - cy, this.px - cx);
    let diff = desired - this.cannonAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.cannonAngle += Math.sign(diff) * Math.min(Math.abs(diff), 2.1 * dt);
    this.cannonFireCd -= dt;
    if (this.cannonFireCd <= 0 && !attract && this.isLineOfSightClear(this.cannonAngle)) {
      this.cannonFireCd = Math.max(0.85, 1.5 - this.level * 0.08);
      this.bullets.push({
        x: cx + Math.cos(this.cannonAngle) * 28,
        y: cy + Math.sin(this.cannonAngle) * 28,
        vx: Math.cos(this.cannonAngle) * (310 + this.level * 18),
        vy: Math.sin(this.cannonAngle) * (310 + this.level * 18),
        life: 2.2,
        fromEnemy: true,
        color: '#F97316',
        radius: 6.5,
      });
      arcadeAudio.playExplosion(false);
    }

    // Ring-riding Homing Mines!
    for (const m of this.castleMines) {
      if (m.ring >= 0) {
        const ring = this.rings[m.ring];
        m.angle += (ring.speed * 1.4) * dt;
        m.x = cx + Math.cos(m.angle) * ring.r;
        m.y = cy + Math.sin(m.angle) * ring.r;
        m.chaseTimer -= dt;
        // Detach only if outer segments are breached OR timer expires
        if (m.chaseTimer <= 0 && !attract) {
          m.ring = -1;
          m.chaseTimer = 6.5;
        }
      } else {
        const a = Math.atan2(this.py - m.y, this.px - m.x);
        const mSpd = 98 + this.level * 10;
        m.vx += (Math.cos(a) * mSpd - m.vx) * Math.min(1, dt * 2.5);
        m.vy += (Math.sin(a) * mSpd - m.vy) * Math.min(1, dt * 2.5);
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        m.chaseTimer -= dt;
        if (m.chaseTimer <= 0) {
          m.ring = 2;
          m.chaseTimer = 3.2;
        }
        for (const sp of shipPts) {
          if (Math.hypot(sp.x - m.x, sp.y - m.y) < 16) {
            m.ring = 2;
            m.chaseTimer = 3.5;
            this.killPlayer();
          }
        }
      }
    }

    // Bullet collisions vs Mines, Shield Ring Segments, and Central Cannon
    const norm = (a: number) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      if (b.fromEnemy) continue;

      // Hit chasing mine
      let consumed = false;
      for (const m of this.castleMines) {
        if (m.ring === -1 && Math.hypot(m.x - b.x, m.y - b.y) < 15) {
          spawnBurst(this.particles, m.x, m.y, '#FACC15', 12, 180, 3);
          m.ring = 1;
          m.chaseTimer = 4.0;
          if (!attract) {
            arcadeAudio.playExplosion(false);
            this.addScore(150, m.x, m.y);
          }
          this.bullets.splice(i, 1);
          consumed = true;
          break;
        }
      }
      if (consumed) continue;

      const dist = Math.hypot(b.x - cx, b.y - cy);
      // Hit shield rings (outer to inner)
      for (let rIdx = 2; rIdx >= 0; rIdx--) {
        const ring = this.rings[rIdx];
        if (Math.abs(dist - ring.r) < 11) {
          const ang = norm(Math.atan2(b.y - cy, b.x - cx) - ring.rot);
          const seg = Math.floor((ang / (Math.PI * 2)) * 12) % 12;
          if (ring.segments[seg]) {
            ring.segments[seg] = false;
            spawnBurst(this.particles, b.x, b.y, ring.color, 10, 160, 2.6);
            if (!attract) {
              arcadeAudio.playRockThud();
              this.addScore(rIdx === 0 ? 100 : rIdx === 1 ? 50 : 25, b.x, b.y);
            }
            this.bullets.splice(i, 1);
            consumed = true;
            // Authentic Star Castle Ring Regeneration: if an entire ring is wiped out, shift outer rings inward and spawn new outer ring!
            if (ring.segments.every((s) => !s)) {
              for (let k = rIdx; k < 2; k++) {
                this.rings[k].segments = [...this.rings[k + 1].segments];
              }
              this.rings[2].segments = Array(12).fill(true);
              if (!attract) {
                this.addScore(500, cx, cy - 115, 'RING SHATTERED');
                arcadeAudio.playPowerUp();
              }
            }
            break;
          }
        }
      }
      if (consumed) continue;

      // Hit Central Star Castle Cannon!
      if (dist < 25) {
        this.bullets.splice(i, 1);
        spawnBurst(this.particles, cx, cy, '#FACC15', 42, 310, 4.6);
        if (!attract) {
          arcadeAudio.playStageClear();
          this.addScore(2500 + this.level * 500, cx, cy, 'STAR CASTLE DESTROYED!');
          this.phase = 'STAGE_CLEAR';
          this.stateTimer = 1.65;
        }
        return;
      }
    }
  }

  private stepAsteroidsOrDuel(dt: number, attract: boolean, shipPts: Array<{ x: number; y: number; a: number }>): void {
    // UFO Saucer spawning (Asteroids Deluxe)
    if (this.variant === 'asteroidsdeluxe') {
      if (!this.saucer) {
        this.saucerCd -= dt;
        if (this.saucerCd <= 0) {
          const fromLeft = Math.random() < 0.5;
          const small = this.score >= 4000 || this.level >= 2;
          this.saucer = {
            x: fromLeft ? 10 : this.logicalWidth - 10,
            y: 70 + Math.random() * (this.logicalHeight - 140),
            vx: (fromLeft ? 1 : -1) * (small ? 145 : 105),
            vy: (Math.random() - 0.5) * 45,
            small,
            fireCd: 1.2,
          };
          this.saucerCd = Math.max(5.5, 10 - this.level * 0.5);
        }
      } else {
        this.saucer.x += this.saucer.vx * dt;
        this.saucer.y = (this.saucer.y + this.saucer.vy * dt + this.logicalHeight) % this.logicalHeight;
        this.saucer.fireCd -= dt;
        if (this.saucer.fireCd <= 0 && !attract) {
          this.saucer.fireCd = this.saucer.small ? 1.15 : 1.7;
          const ang = this.saucer.small
            ? Math.atan2(this.py - this.saucer.y, this.px - this.saucer.x) + (Math.random() - 0.5) * 0.14
            : Math.random() * Math.PI * 2;
          this.bullets.push({
            x: this.saucer.x,
            y: this.saucer.y,
            vx: Math.cos(ang) * 290,
            vy: Math.sin(ang) * 290,
            life: 1.8,
            fromEnemy: true,
            color: '#F43F5E',
            radius: 4,
          });
        }
        if (this.saucer.x < -30 || this.saucer.x > this.logicalWidth + 30) {
          this.saucer = null;
        }
      }

      // Authentic Splitting Killer Satellite (Asteroids Deluxe signature!)
      this.killerCd -= dt;
      if (this.killerCd <= 0 && this.killerPods.length === 0) {
        this.killerCd = 13;
        this.killerPods.push({
          x: Math.random() < 0.5 ? 25 : this.logicalWidth - 25,
          y: Math.random() * this.logicalHeight,
          vx: 0,
          vy: 0,
          stage: 'cluster',
          hp: 1,
          angle: 0,
        });
      }
    }

    // Update Killer Satellite pods
    for (let i = this.killerPods.length - 1; i >= 0; i--) {
      const k = this.killerPods[i];
      const ang = Math.atan2(this.py - k.y, this.px - k.x);
      const spd = k.stage === 'cluster' ? 78 : 132;
      k.vx += (Math.cos(ang) * spd - k.vx) * Math.min(1, dt * 2.8);
      k.vy += (Math.sin(ang) * spd - k.vy) * Math.min(1, dt * 2.8);
      k.x = (k.x + k.vx * dt + this.logicalWidth) % this.logicalWidth;
      k.y = (k.y + k.vy * dt + this.logicalHeight) % this.logicalHeight;
      k.angle += dt * 3.5;

      for (const sp of shipPts) {
        if (Math.hypot(sp.x - k.x, sp.y - k.y) < 18) {
          if (this.shieldActive) {
            k.vx = -k.vx * 1.6;
            k.vy = -k.vy * 1.6;
          } else {
            this.killPlayer();
          }
        }
      }
    }

    // Update Rocks / Space Duel geometric shapes
    for (let i = this.rocks.length - 1; i >= 0; i--) {
      const r = this.rocks[i];
      r.x = (r.x + r.vx * dt + this.logicalWidth) % this.logicalWidth;
      r.y = (r.y + r.vy * dt + this.logicalHeight) % this.logicalHeight;
      r.angle += r.spin * dt;
      for (const sp of shipPts) {
        if (Math.hypot(sp.x - r.x, sp.y - r.y) < r.r + 11) {
          if (this.shieldActive) {
            r.vx = -r.vx;
            r.vy = -r.vy;
          } else {
            this.killPlayer();
          }
        }
      }
    }

    // Player bullets vs Saucer, Killer Satellite, and Rocks
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      if (b.fromEnemy) continue;
      let hit = false;

      if (this.saucer && Math.hypot(this.saucer.x - b.x, this.saucer.y - b.y) < (this.saucer.small ? 18 : 26)) {
        const pts = this.saucer.small ? 1000 : 200;
        spawnBurst(this.particles, this.saucer.x, this.saucer.y, '#F43F5E', 22, 220, 3.4);
        if (!attract) {
          arcadeAudio.playExplosion(true);
          this.addScore(pts, this.saucer.x, this.saucer.y, this.saucer.small ? 'SMALL UFO' : 'UFO');
        }
        this.saucer = null;
        this.bullets.splice(i, 1);
        continue;
      }

      for (let j = this.killerPods.length - 1; j >= 0; j--) {
        const k = this.killerPods[j];
        if (Math.hypot(k.x - b.x, k.y - b.y) < 18) {
          this.bullets.splice(i, 1);
          hit = true;
          spawnBurst(this.particles, k.x, k.y, '#FACC15', 16, 200, 3);
          if (!attract) {
            arcadeAudio.playExplosion(false);
            this.addScore(k.stage === 'cluster' ? 150 : 300, k.x, k.y);
          }
          this.killerPods.splice(j, 1);
          if (k.stage === 'cluster') {
            // Splits into 3 homing triangular pods!
            for (let s = 0; s < 3; s++) {
              const a = (s / 3) * Math.PI * 2;
              this.killerPods.push({
                x: k.x + Math.cos(a) * 14,
                y: k.y + Math.sin(a) * 14,
                vx: Math.cos(a) * 140,
                vy: Math.sin(a) * 140,
                stage: 'shard',
                hp: 1,
                angle: a,
              });
            }
          }
          break;
        }
      }
      if (hit) continue;

      for (let j = this.rocks.length - 1; j >= 0; j--) {
        const r = this.rocks[j];
        if (Math.hypot(r.x - b.x, r.y - b.y) < r.r + 5) {
          this.bullets.splice(i, 1);
          this.rocks.splice(j, 1);
          spawnBurst(this.particles, r.x, r.y, r.color, 14, 190, 2.8);
          if (!attract) {
            arcadeAudio.playExplosion(r.size === 3);
            this.addScore(r.size === 3 ? 20 : r.size === 2 ? 50 : 100, r.x, r.y);
          }
          if (r.size > 1) {
            const nextSize = (r.size - 1) as 1 | 2;
            this.rocks.push(this.makeRock(r.x + 8, r.y, nextSize));
            this.rocks.push(this.makeRock(r.x - 8, r.y, nextSize));
          }
          break;
        }
      }
    }

    if (!attract && this.rocks.length === 0 && this.killerPods.length === 0) {
      arcadeAudio.playStageClear();
      this.addScore(1000, this.logicalWidth * 0.5, this.logicalHeight * 0.45, 'SECTOR CLEAR');
      this.phase = 'STAGE_CLEAR';
      this.stateTimer = 1.4;
    }
  }

  public getHudSnapshot(): ClassicGameHud {
    const title =
      this.variant === 'asteroidsdeluxe'
        ? 'ASTEROIDS DELUXE'
        : this.variant === 'spaceduel'
          ? 'SPACE DUEL'
          : 'STAR CASTLE';
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: `${title} · WAVE ${this.level}`,
      primaryMetricLabel: this.variant === 'starcastle' ? 'SHIELD RINGS' : 'TARGETS',
      primaryMetricValue:
        this.variant === 'starcastle'
          ? `${this.rings.reduce((acc, r) => acc + r.segments.filter(Boolean).length, 0)}/36`
          : String(this.rocks.length + this.killerPods.length),
      secondaryMetricLabel:
        this.variant === 'asteroidsdeluxe'
          ? 'SHIELD'
          : this.variant === 'spaceduel'
            ? 'TETHER'
            : 'CANNON',
      secondaryMetricValue:
        this.variant === 'asteroidsdeluxe'
          ? `${Math.round(this.shieldEnergy)}%`
          : this.variant === 'spaceduel'
            ? this.tetherMode
              ? 'TWIN'
              : 'SOLO'
            : this.isLineOfSightClear(this.cannonAngle)
              ? 'LOCKED!'
              : 'SEALED',
      bannerText: this.phase === 'STAGE_CLEAR' ? 'SECTOR CLEARED!' : this.phase === 'GAME_OVER' ? 'GAME OVER' : '',
    };
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = this.logicalWidth;
    const H = this.logicalHeight;

    ctx.fillStyle = '#03060E';
    ctx.fillRect(0, 0, W, H);

    // Subtle vector background stars
    ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
    for (let i = 0; i < 42; i++) {
      const sx = ((i * 173 + 41) % W);
      const sy = ((i * 97 + 23) % H);
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }

    if (this.variant === 'starcastle') {
      const cx = W * 0.5;
      const cy = H * 0.5;
      // 3 Rotating 12-segment shields
      for (const ring of this.rings) {
        ctx.strokeStyle = ring.color;
        ctx.shadowColor = ring.color;
        ctx.shadowBlur = 10;
        ctx.lineWidth = 5;
        for (let s = 0; s < 12; s++) {
          if (!ring.segments[s]) continue;
          const a0 = ring.rot + (s / 12) * Math.PI * 2 + 0.04;
          const a1 = ring.rot + ((s + 1) / 12) * Math.PI * 2 - 0.04;
          ctx.beginPath();
          ctx.arc(cx, cy, ring.r, a0, a1);
          ctx.stroke();
        }
      }
      ctx.shadowBlur = 0;

      // Central Star Castle Cannon
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(this.cannonAngle);
      ctx.strokeStyle = this.isLineOfSightClear(this.cannonAngle) ? '#EF4444' : '#FACC15';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(24, 0);
      ctx.lineTo(-14, -14);
      ctx.lineTo(-8, 0);
      ctx.lineTo(-14, 14);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      // Ring-riding / chasing Spark Mines
      for (const m of this.castleMines) {
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.rotate(this.clock * 8);
        ctx.strokeStyle = m.ring === -1 ? '#F43F5E' : '#FDE047';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(-7, 0);
        ctx.lineTo(7, 0);
        ctx.moveTo(0, -7);
        ctx.lineTo(0, 7);
        ctx.stroke();
        ctx.restore();
      }
    } else {
      // Draw Asteroids / Space Duel Geometric Shapes
      for (const r of this.rocks) {
        ctx.save();
        ctx.translate(r.x, r.y);
        ctx.rotate(r.angle);
        ctx.strokeStyle = r.color;
        ctx.shadowColor = r.color;
        ctx.shadowBlur = 8;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        if (r.shape === 'rock') {
          for (let i = 0; i < r.verts.length; i++) {
            const a = (i / r.verts.length) * Math.PI * 2;
            const d = r.r * r.verts[i];
            if (i === 0) ctx.moveTo(Math.cos(a) * d, Math.sin(a) * d);
            else ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d);
          }
          ctx.closePath();
        } else if (r.shape === 'diamond') {
          ctx.moveTo(0, -r.r);
          ctx.lineTo(r.r * 0.78, 0);
          ctx.lineTo(0, r.r);
          ctx.lineTo(-r.r * 0.78, 0);
          ctx.closePath();
        } else if (r.shape === 'square') {
          ctx.rect(-r.r * 0.75, -r.r * 0.75, r.r * 1.5, r.r * 1.5);
        } else {
          // Pinwheel / Spinner star
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const d = i % 2 === 0 ? r.r : r.r * 0.35;
            if (i === 0) ctx.moveTo(Math.cos(a) * d, Math.sin(a) * d);
            else ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d);
          }
          ctx.closePath();
        }
        ctx.stroke();
        ctx.restore();
      }

      // UFO Saucer
      if (this.saucer) {
        const s = this.saucer;
        const w = s.small ? 14 : 22;
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.strokeStyle = '#F43F5E';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(-w, 0);
        ctx.lineTo(-w * 0.5, -w * 0.45);
        ctx.lineTo(w * 0.5, -w * 0.45);
        ctx.lineTo(w, 0);
        ctx.lineTo(w * 0.5, w * 0.4);
        ctx.lineTo(-w * 0.5, w * 0.4);
        ctx.closePath();
        ctx.moveTo(-w, 0);
        ctx.lineTo(w, 0);
        ctx.stroke();
        ctx.restore();
      }

      // Splitting Killer Satellite Pods
      for (const k of this.killerPods) {
        ctx.save();
        ctx.translate(k.x, k.y);
        ctx.rotate(k.angle);
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 2.4;
        const sz = k.stage === 'cluster' ? 16 : 11;
        ctx.beginPath();
        ctx.moveTo(sz, 0);
        ctx.lineTo(-sz * 0.7, -sz * 0.8);
        ctx.lineTo(-sz * 0.3, 0);
        ctx.lineTo(-sz * 0.7, sz * 0.8);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }
    }

    // Bullets
    for (const b of this.bullets) {
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Player ship(s)
    const blink = this.invulnTimer > 0 && Math.floor(this.clock * 14) % 2 === 0;
    if (!blink) {
      const shipPts =
        this.variant === 'spaceduel' && this.tetherMode
          ? [
              {
                x: this.px + Math.cos(this.tetherAngle) * (this.tetherDist * 0.5),
                y: this.py + Math.sin(this.tetherAngle) * (this.tetherDist * 0.5),
                color: '#38BDF8',
              },
              {
                x: this.px - Math.cos(this.tetherAngle) * (this.tetherDist * 0.5),
                y: this.py - Math.sin(this.tetherAngle) * (this.tetherDist * 0.5),
                color: '#4ADE80',
              },
            ]
          : [{ x: this.px, y: this.py, color: '#38BDF8' }];

      if (shipPts.length === 2) {
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.65)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(shipPts[0].x, shipPts[0].y);
        ctx.lineTo(shipPts[1].x, shipPts[1].y);
        ctx.stroke();
      }

      for (const sp of shipPts) {
        ctx.save();
        ctx.translate(sp.x, sp.y);
        ctx.rotate(this.angle);
        ctx.strokeStyle = sp.color;
        ctx.shadowColor = sp.color;
        ctx.shadowBlur = 10;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(15, 0);
        ctx.lineTo(-11, -10);
        ctx.lineTo(-6, 0);
        ctx.lineTo(-11, 10);
        ctx.closePath();
        ctx.stroke();
        if (this.input.up) {
          ctx.strokeStyle = '#F97316';
          ctx.beginPath();
          ctx.moveTo(-7, -4);
          ctx.lineTo(-16 - Math.random() * 6, 0);
          ctx.lineTo(-7, 4);
          ctx.stroke();
        }
        ctx.restore();
      }

      if (this.shieldActive) {
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(this.px, this.py, 22, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.shadowBlur = 0;

    renderParticlesAndPopups(ctx, this.particles, this.popups);
    if (this.phase === 'TITLE') {
      ctx.fillStyle = 'rgba(3, 6, 14, 0.72)';
      ctx.fillRect(0, H * 0.36, W, 114);
      ctx.textAlign = 'center';
      ctx.font = '900 34px "JetBrains Mono", monospace';
      ctx.fillStyle = '#38BDF8';
      const title =
        this.variant === 'asteroidsdeluxe'
          ? 'ASTEROIDS DELUXE'
          : this.variant === 'spaceduel'
            ? 'SPACE DUEL'
            : 'STAR CASTLE';
      ctx.fillText(title, W * 0.5, H * 0.36 + 48);
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillStyle = '#E2E8F0';
      const desc =
        this.variant === 'asteroidsdeluxe'
          ? 'ROTATE & THRUST · FORCE SHIELD (SHIFT) · SPLITTING KILLER SATELLITE & UFOS'
          : this.variant === 'spaceduel'
            ? 'TETHERED TWIN-SHIP COMBAT · PRESS SHIFT TO TOGGLE TETHER · GEOMETRIC SWARMS'
            : 'BREACH ALL 3 ROTATING RINGS · DODGE RING-RIDING MINES & LINE-OF-SIGHT CANNON';
      ctx.fillText(desc, W * 0.5, H * 0.36 + 82);
    }
    if (visualMode === 'crt') renderCrtOverlay(ctx, W, H);
  }
}

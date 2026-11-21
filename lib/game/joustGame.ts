import { arcadeAudio } from './audio';
import {
  ArcadeGameInstance,
  ArcadeInputState,
  ClassicGameHud,
  ClassicGamePhase,
  createEmptyInput,
  getPrecisionMoveVector,
  readHighScore,
  renderCrtOverlay,
  renderParticlesAndPopups,
  saveHighScore,
  ScorePopup,
  SimpleParticle,
  spawnBurst,
  stepParticlesAndPopups,
} from './classicArcadeInterface';

const W = 740;
const H = 560;
const LAVA_Y = 516;
const STORAGE_KEY = 'joust_williams_highscore_v3';

interface JoustPlatform {
  x: number;
  y: number;
  w: number;
  h: number;
  isBridge?: boolean;
  intact: boolean;
}

interface JoustKnight {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  tier: 'bounder' | 'hunter' | 'shadow';
  flapCd: number;
  wingAnim: number;
  grounded: boolean;
}

interface JoustEgg {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hatchTimer: number;
  tier: 'bounder' | 'hunter' | 'shadow';
  inAir: boolean;
}

interface LavaBubble {
  x: number;
  y: number;
  r: number;
  phase: number;
}

export class JoustGame implements ArcadeGameInstance {
  public readonly logicalWidth = W;
  public readonly logicalHeight = H;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'Flap Wings!';
  public readonly secondaryActionLabel = 'Skid Brake';

  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();
  private score = 0;
  private highScore = readHighScore(STORAGE_KEY);
  private nextExtraLife = 20000;
  private level = 1;
  private lives = 3;
  private clock = 0;
  private stateTimer = 0;
  private nextId = 1;

  // Player Ostrich Rider
  private px = W * 0.5;
  private py = 432;
  private pvx = 0;
  private pvy = 0;
  private pFacing: 1 | -1 = 1;
  private pGrounded = false;
  private pWingAnim = 0;
  private pRunAnim = 0;
  private invulnTimer = 0;
  private trollGrabbed = false;
  private trollPullsLeft = 0;
  private waveTimer = 0;
  private eggCombo = 0;
  private waveType: 'SURVIVAL' | 'EGG WAVE' | 'PTERO WAVE' = 'SURVIVAL';

  private platforms: JoustPlatform[] = [];
  private knights: JoustKnight[] = [];
  private eggs: JoustEgg[] = [];
  private bubbles: LavaBubble[] = [];
  private ptero: { active: boolean; x: number; y: number; vx: number; vy: number; flap: number } = {
    active: false,
    x: -60,
    y: 120,
    vx: 195,
    vy: 0,
    flap: 0,
  };
  private trollX = W * 0.5;
  private trollHandY = H + 20;
  private shakeTimer = 0;
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  constructor() {
    for (let i = 0; i < 16; i++) {
      this.bubbles.push({ x: 30 + i * 44, y: LAVA_Y + 12, r: 4 + (i % 4) * 2, phase: i * 0.9 });
    }
    this.setupWave(1);
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public startNewGame(): void {
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.nextExtraLife = 20000;
    this.level = 1;
    this.lives = 3;
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

  private addScore(pts: number, x?: number, y?: number, color = '#FEF08A', label?: string): void {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(STORAGE_KEY, this.highScore);
    }
    if (this.score >= this.nextExtraLife) {
      this.lives = Math.min(6, this.lives + 1);
      this.nextExtraLife += 20000;
      arcadeAudio.playExtraLife();
      this.popups.push({ x: this.px, y: this.py - 30, text: '1UP EXTRA OSTRICH!', color: '#4ADE80', life: 1.2, maxLife: 1.2 });
    }
    if (x !== undefined && y !== undefined) {
      this.popups.push({
        x,
        y,
        text: label || `+${pts}`,
        color,
        life: 0.9,
        maxLife: 0.9,
      });
    }
  }

  private setupWave(wave: number): void {
    this.level = wave;
    this.waveTimer = 0;
    this.eggCombo = 0;
    this.trollGrabbed = false;
    this.trollHandY = H + 20;
    this.ptero.active = false;
    this.eggs = [];
    this.knights = [];

    this.waveType = wave % 5 === 0 ? 'EGG WAVE' : wave % 4 === 0 ? 'PTERO WAVE' : 'SURVIVAL';

    // Authentic Williams Joust floating stone cliffs + crumbling magma bridge!
    const bridgeBurned = wave >= 3;
    this.platforms = [
      // Base lava island + retractable outer bridges
      { x: 185, y: 472, w: 370, h: 20, intact: true },
      { x: 32, y: 472, w: 153, h: 16, isBridge: true, intact: !bridgeBurned },
      { x: 555, y: 472, w: 153, h: 16, isBridge: true, intact: !bridgeBurned },
      // Mid-level wraparound ledges & center island
      { x: 0, y: 318, w: 148, h: 16, intact: true },
      { x: 592, y: 318, w: 148, h: 16, intact: true },
      { x: 256, y: 344, w: 228, h: 16, intact: true },
      // High cliffs
      { x: 0, y: 158, w: 188, h: 16, intact: true },
      { x: 552, y: 158, w: 188, h: 16, intact: true },
      { x: 276, y: 188, w: 188, h: 16, intact: true },
    ];

    this.px = W * 0.5;
    this.py = 448;
    this.pvx = 0;
    this.pvy = 0;
    this.pFacing = 1;
    this.invulnTimer = 1.85;

    if (this.waveType === 'EGG WAVE') {
      // Classic Joust Egg Wave: grab hatching eggs before Shadow Lords emerge!
      const spots = [
        { x: 100, y: 142 },
        { x: 640, y: 142 },
        { x: 370, y: 172 },
        { x: 90, y: 302 },
        { x: 650, y: 302 },
        { x: 370, y: 328 },
      ];
      for (const s of spots) {
        this.eggs.push({ x: s.x, y: s.y, vx: 0, vy: 0, hatchTimer: 6.5, tier: 'hunter', inAir: false });
      }
      return;
    }

    const total = Math.min(9, 3 + wave);
    for (let i = 0; i < total; i++) {
      const tier: 'bounder' | 'hunter' | 'shadow' =
        wave >= 4 && i % 3 === 0 ? 'shadow' : wave >= 2 && i % 2 === 0 ? 'hunter' : 'bounder';
      const spawnX = i % 2 === 0 ? 115 + (i * 42) % 140 : W - 115 - (i * 42) % 140;
      const spawnY = i % 3 === 0 ? 136 : 292;
      this.knights.push({
        id: this.nextId++,
        x: spawnX,
        y: spawnY,
        vx: (i % 2 === 0 ? 1 : -1) * (tier === 'shadow' ? 148 : tier === 'hunter' ? 116 : 92),
        vy: 0,
        facing: i % 2 === 0 ? 1 : -1,
        tier,
        flapCd: 0.35 + Math.random() * 0.6,
        wingAnim: Math.random() * 6,
        grounded: false,
      });
    }

    if (this.waveType === 'PTERO WAVE') {
      this.spawnPterodactyl();
    }
  }

  private spawnPterodactyl(): void {
    this.ptero.active = true;
    this.ptero.x = this.px > W * 0.5 ? -50 : W + 50;
    this.ptero.y = 120 + Math.random() * 140;
    this.ptero.vx = this.ptero.x < 0 ? 215 : -215;
    this.ptero.vy = 0;
    arcadeAudio.playPteroScreech();
  }

  private resolvePlatforms(ent: { x: number; y: number; vx: number; vy: number }, halfW: number, halfH: number): boolean {
    let landed = false;
    for (const p of this.platforms) {
      if (!p.intact) continue;
      if (ent.x + halfW > p.x && ent.x - halfW < p.x + p.w) {
        // Landing on top
        if (ent.vy >= 0 && ent.y + halfH >= p.y && ent.y + halfH <= p.y + 16) {
          ent.y = p.y - halfH;
          ent.vy = 0;
          landed = true;
        } else if (ent.vy < 0 && ent.y - halfH <= p.y + p.h && ent.y - halfH >= p.y + p.h - 14) {
          // Head bonk underneath platform
          ent.y = p.y + p.h + halfH;
          ent.vy = Math.abs(ent.vy) * 0.5;
        }
      }
    }
    return landed;
  }

  private damagePlayer(): void {
    if (this.invulnTimer > 0) return;
    this.lives--;
    this.trollGrabbed = false;
    this.shakeTimer = 0.35;
    spawnBurst(this.particles, this.px, this.py, '#FACC15', 26, 230, 3.6);
    arcadeAudio.playDeath();
    if (this.lives <= 0) {
      this.phase = 'GAME_OVER';
    } else {
      this.px = W * 0.5;
      this.py = 315;
      this.pvx = 0;
      this.pvy = -60;
      this.invulnTimer = 2.2;
    }
  }

  public step(dt: number): void {
    const safeDt = Math.min(0.05, Math.max(0, dt));
    this.clock += safeDt;
    if (this.shakeTimer > 0) this.shakeTimer = Math.max(0, this.shakeTimer - safeDt);
    stepParticlesAndPopups(this.particles, this.popups, safeDt);
    if (this.phase === 'PAUSED' || this.phase === 'GAME_OVER') return;

    if (this.phase === 'READY') {
      this.stateTimer -= safeDt;
      if (this.stateTimer <= 0) this.phase = 'PLAYING';
      return;
    }
    if (this.phase === 'STAGE_CLEAR') {
      this.stateTimer -= safeDt;
      if (this.stateTimer <= 0) {
        this.phase = 'READY';
        this.stateTimer = 0.85;
        this.setupWave(this.level + 1);
      }
      return;
    }

    const attract = this.phase === 'TITLE';
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - safeDt);
    this.waveTimer += safeDt;

    // Precision horizontal thrust + crisp Williams Flap Physics!
    const { vx: rawVx, scale } = getPrecisionMoveVector(this.input);
    const maxRun = 265 * scale;
    const accel = (this.pGrounded ? 640 : 410) * scale;

    if (attract) {
      const target = this.knights[0];
      const dir = target ? Math.sign(target.x - this.px) : Math.cos(this.clock);
      this.pvx += dir * 240 * safeDt;
      this.pvx = Math.max(-180, Math.min(180, this.pvx));
      if (this.py > (target ? target.y - 34 : 260) && this.pvy > -40 && Math.random() < 0.16) {
        this.pvy = -170;
        this.pWingAnim = 1;
      }
    } else {
      if (Math.abs(rawVx) > 0.04) {
        const pushingAgainst = Math.sign(rawVx) !== 0 && Math.sign(this.pvx) !== 0 && Math.sign(rawVx) !== Math.sign(this.pvx);
        // Classic Joust SKID BRAKING sparks when reversing direction on a platform!
        if (this.pGrounded && pushingAgainst && Math.abs(this.pvx) > 85 && Math.random() < safeDt * 24) {
          this.particles.push({
            x: this.px,
            y: this.py + 18,
            vx: -this.pvx * 0.25,
            vy: -30 - Math.random() * 35,
            life: 0.22,
            maxLife: 0.22,
            color: '#FDE047',
            radius: 2.3,
          });
        }
        this.pvx += rawVx * accel * safeDt;
        this.pFacing = rawVx > 0 ? 1 : -1;
      } else if (this.input.secondary) {
        // Explicit Skid Brake button for razor-sharp platform stops!
        this.pvx *= Math.pow(0.06, safeDt);
      } else {
        this.pvx *= this.pGrounded ? Math.pow(0.18, safeDt) : Math.pow(0.72, safeDt);
      }
      this.pvx = Math.max(-maxRun, Math.min(maxRun, this.pvx));

      const flapPressed = this.input.fireJustPressed || (this.input.up && this.pvy > 45);
      if (flapPressed) {
        if (this.trollGrabbed) {
          this.trollPullsLeft--;
          arcadeAudio.playWingFlap();
          if (this.trollPullsLeft <= 0) {
            this.trollGrabbed = false;
            this.pvy = -245;
            this.addScore(500, this.px, this.py - 20, '#38BDF8', 'ESCAPED TROLL +500!');
          }
        } else {
          this.pvy = Math.max(-285, this.pvy - 178);
          this.pWingAnim = 1;
          arcadeAudio.playWingFlap();
        }
      }
    }

    if (this.pWingAnim > 0) this.pWingAnim = Math.max(0, this.pWingAnim - safeDt * 4.2);

    // Apply gravity & motion
    if (this.trollGrabbed) {
      this.pvy = 48; // Slowly dragging Ostrich down into magma!
      this.pvx *= 0.85;
      this.trollX = this.px;
      this.trollHandY = this.py + 14;
    } else {
      this.pvy = Math.min(340, this.pvy + 455 * safeDt);
      this.trollHandY += (H + 25 - this.trollHandY) * Math.min(1, safeDt * 4);
    }

    this.px += this.pvx * safeDt;
    this.py += this.pvy * safeDt;

    // Iconic horizontal arcade screen wraparound!
    if (this.px < -18) this.px = W + 18;
    else if (this.px > W + 18) this.px = -18;
    if (this.py < 26) {
      this.py = 26;
      this.pvy = Math.abs(this.pvy) * 0.45;
    }

    const pEnt = { x: this.px, y: this.py, vx: this.pvx, vy: this.pvy };
    this.pGrounded = this.resolvePlatforms(pEnt, 15, 20);
    this.px = pEnt.x;
    this.py = pEnt.y;
    this.pvy = pEnt.vy;
    if (this.pGrounded && Math.abs(this.pvx) > 15) {
      this.pRunAnim += safeDt * Math.abs(this.pvx) * 0.085;
    }

    // Lava Troll grab when flying dangerously low over exposed magma!
    if (!attract && !this.trollGrabbed && this.py > 446 && (this.px < 180 || this.px > 560) && this.platforms.some((p) => p.isBridge && !p.intact)) {
      if (Math.random() < safeDt * 2.8) {
        this.trollGrabbed = true;
        this.trollPullsLeft = 3;
        this.trollX = this.px;
        this.trollHandY = this.py + 12;
        this.popups.push({ x: this.px, y: this.py - 28, text: 'LAVA TROLL! FLAP FAST!', color: '#F97316', life: 1.0, maxLife: 1.0 });
      }
    }

    // Falling into magma!
    if (this.py > LAVA_Y - 6) {
      if (attract) {
        this.py = 420;
        this.pvy = -210;
      } else {
        this.damagePlayer();
        return;
      }
    }

    // Spawn swooping Pterodactyl if wave drags on (>28s)!
    if (!attract && !this.ptero.active && this.waveTimer > 28) {
      this.spawnPterodactyl();
    }

    // Step Pterodactyl (lance directly into its open mouth for +1000 PTS!)
    if (this.ptero.active) {
      this.ptero.flap += safeDt * 12;
      this.ptero.x += this.ptero.vx * safeDt;
      this.ptero.vy += Math.sign(this.py - this.ptero.y) * 145 * safeDt;
      this.ptero.vy = Math.max(-110, Math.min(110, this.ptero.vy));
      this.ptero.y = Math.max(48, Math.min(440, this.ptero.y + this.ptero.vy * safeDt));
      if (this.ptero.x < -75) this.ptero.x = W + 75;
      else if (this.ptero.x > W + 75) this.ptero.x = -75;

      if (!attract && Math.hypot(this.ptero.x - this.px, this.ptero.y - this.py) < 28) {
        // Authentic Joust skill shot: facing the Pterodactyl at mouth height kills it!
        const facingMouth = Math.sign(this.ptero.x - this.px) === this.pFacing && Math.abs(this.ptero.y - this.py) < 12;
        if (facingMouth) {
          this.ptero.active = false;
          spawnBurst(this.particles, this.ptero.x, this.ptero.y, '#EF4444', 28, 240, 4);
          arcadeAudio.playExplosion(true);
          this.addScore(1000, this.ptero.x, this.ptero.y, '#FACC15', 'PTERODACTYL +1000!');
        } else {
          this.damagePlayer();
          return;
        }
      }
    }

    // Step Enemy Buzzard Knights
    for (let i = this.knights.length - 1; i >= 0; i--) {
      const k = this.knights[i];
      if (!k) continue;
      k.flapCd -= safeDt;
      if (k.wingAnim > 0) k.wingAnim = Math.max(0, k.wingAnim - safeDt * 4.5);

      const targetAlt = k.tier === 'bounder' ? 120 + Math.sin(this.clock + k.id) * 160 : this.py - (k.tier === 'shadow' ? 42 : 16);
      if (k.flapCd <= 0) {
        k.flapCd = k.tier === 'shadow' ? 0.24 : k.tier === 'hunter' ? 0.36 : 0.48;
        if (k.y > targetAlt || k.y > 410) {
          k.vy = Math.max(-240, k.vy - (k.tier === 'shadow' ? 185 : 155));
          k.wingAnim = 1;
        }
        if (k.tier !== 'bounder') {
          const aimDir = Math.sign(this.px - k.x) || 1;
          k.vx += aimDir * (k.tier === 'shadow' ? 75 : 48);
          const maxSpd = k.tier === 'shadow' ? 215 : 155;
          k.vx = Math.max(-maxSpd, Math.min(maxSpd, k.vx));
        }
      }

      k.vy = Math.min(280, k.vy + 410 * safeDt);
      k.x += k.vx * safeDt;
      k.y += k.vy * safeDt;
      if (Math.abs(k.vx) > 6) k.facing = k.vx >= 0 ? 1 : -1;

      if (k.x < -18) k.x = W + 18;
      else if (k.x > W + 18) k.x = -18;
      if (k.y < 28) {
        k.y = 28;
        k.vy = Math.abs(k.vy) * 0.5;
      }
      k.grounded = this.resolvePlatforms(k, 15, 20);
      if (k.y > LAVA_Y - 12) {
        k.y = LAVA_Y - 18;
        k.vy = -210;
      }

      // Authentic Joust Lance-Height Duel!
      if (!attract && Math.hypot(k.x - this.px, k.y - this.py) < 30) {
        const diffY = k.y - this.py; // positive = player is higher!
        if (diffY > 7) {
          // Player lance wins! Buzzard flees and Egg drops!
          const pts = k.tier === 'shadow' ? 1500 : k.tier === 'hunter' ? 750 : 500;
          spawnBurst(this.particles, k.x, k.y, '#FDE047', 18, 190, 3.2);
          arcadeAudio.playExplosion(false);
          this.addScore(pts, k.x, k.y, '#FEF08A', `${k.tier.toUpperCase()} +${pts}`);
          this.eggs.push({
            x: k.x,
            y: k.y,
            vx: k.vx * 0.55 + (Math.random() - 0.5) * 80,
            vy: -135,
            hatchTimer: 6.2,
            tier: k.tier === 'bounder' ? 'hunter' : 'shadow',
            inAir: true,
          });
          this.pvy = Math.min(-120, this.pvy);
          this.knights.splice(i, 1);
          continue;
        } else if (diffY < -7) {
          this.damagePlayer();
          return;
        } else {
          // Equal altitude -> Iconic Metallic Lance Clash Bounce!
          arcadeAudio.playLanceClash();
          spawnBurst(this.particles, (this.px + k.x) * 0.5, (this.py + k.y) * 0.5, '#FFFFFF', 10, 180, 2.5);
          const push = this.px < k.x ? -1 : 1;
          this.pvx = push * 185;
          k.vx = -push * 185;
          this.pvy = -85;
          k.vy = -85;
        }
      }
    }

    // Step Bouncing & Hatching Eggs
    for (let i = this.eggs.length - 1; i >= 0; i--) {
      const egg = this.eggs[i];
      if (!egg) continue;
      egg.vy = Math.min(310, egg.vy + 430 * safeDt);
      egg.x += egg.vx * safeDt;
      egg.y += egg.vy * safeDt;
      if (egg.x < -12) egg.x = W + 12;
      else if (egg.x > W + 12) egg.x = -12;

      const landed = this.resolvePlatforms(egg, 8, 9);
      if (landed) {
        egg.inAir = false;
        egg.vx *= Math.pow(0.15, safeDt);
      }

      if (egg.y > LAVA_Y - 6) {
        spawnBurst(this.particles, egg.x, LAVA_Y - 6, '#F97316', 10, 120, 2.4);
        this.eggs.splice(i, 1);
        continue;
      }

      // Collect Egg (with authentic Mid-Air Catch bonus!)
      if (!attract && Math.hypot(egg.x - this.px, egg.y - this.py) < 26) {
        this.eggCombo = Math.min(4, this.eggCombo + 1);
        const basePts = this.eggCombo * 250;
        const midAirBonus = egg.inAir ? 500 : 0;
        arcadeAudio.playPowerUp();
        spawnBurst(this.particles, egg.x, egg.y, '#4ADE80', 12, 150, 2.6);
        this.addScore(
          basePts + midAirBonus,
          egg.x,
          egg.y,
          egg.inAir ? '#38BDF8' : '#4ADE80',
          egg.inAir ? `MID-AIR +${basePts + midAirBonus}!` : `EGG +${basePts}`
        );
        this.eggs.splice(i, 1);
        continue;
      }

      // Egg hatches into upgraded Buzzard Knight if left uncollected!
      egg.hatchTimer -= safeDt;
      if (egg.hatchTimer <= 0) {
        this.knights.push({
          id: this.nextId++,
          x: egg.x,
          y: egg.y - 12,
          vx: (Math.random() < 0.5 ? -1 : 1) * 140,
          vy: -150,
          facing: 1,
          tier: egg.tier,
          flapCd: 0.35,
          wingAnim: 1,
          grounded: false,
        });
        spawnBurst(this.particles, egg.x, egg.y, '#F87171', 12, 150, 2.5);
        this.eggs.splice(i, 1);
      }
    }

    // Wave Clear!
    if (!attract && this.knights.length === 0 && this.eggs.length === 0) {
      arcadeAudio.playStageClear();
      this.addScore(1000 + this.level * 500, W * 0.5, H * 0.4, '#FACC15', `WAVE ${this.level} CLEAR!`);
      this.phase = 'STAGE_CLEAR';
      this.stateTimer = 1.7;
    }
  }

  public getHudSnapshot(): ClassicGameHud {
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: `JOUST · WAVE ${this.level} (${this.waveType})`,
      primaryMetricLabel: 'FOES',
      primaryMetricValue: `${this.knights.length} · ${this.eggs.length} EGGS`,
      secondaryMetricLabel: 'HAZARD',
      secondaryMetricValue: this.ptero.active ? 'PTERODACTYL!' : this.level >= 3 ? 'LAVA TROLL' : 'ARENA',
      bannerText: this.phase === 'STAGE_CLEAR' ? `WAVE ${this.level} VICTORY!` : '',
    };
  }

  private drawMount(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    facing: 1 | -1,
    wingAnim: number,
    runAnim: number,
    grounded: boolean,
    mountColor: string,
    knightColor: string,
    visorColor: string
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing, 1);

    // Animated running/tucked legs
    ctx.strokeStyle = '#FDBA74';
    ctx.lineWidth = 2.6;
    const stride = grounded ? Math.sin(runAnim) * 6 : 2;
    ctx.beginPath();
    ctx.moveTo(-4, 7);
    ctx.lineTo(-4 - stride, 19);
    ctx.moveTo(4, 7);
    ctx.lineTo(4 + stride, 19);
    ctx.stroke();

    // Bird body & graceful neck + beak
    ctx.fillStyle = mountColor;
    ctx.beginPath();
    ctx.ellipse(0, 4, 14, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    // Tail feathers
    ctx.beginPath();
    ctx.moveTo(-12, 2);
    ctx.lineTo(-22, -4);
    ctx.lineTo(-17, 7);
    ctx.closePath();
    ctx.fill();
    // Neck & head
    ctx.strokeStyle = mountColor;
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(15, -13);
    ctx.stroke();
    ctx.fillStyle = mountColor;
    ctx.beginPath();
    ctx.arc(16, -15, 5, 0, Math.PI * 2);
    ctx.fill();
    // Sharp beak
    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.moveTo(20, -16);
    ctx.lineTo(27, -14);
    ctx.lineTo(20, -12);
    ctx.closePath();
    ctx.fill();

    // Animated Flapping Wing!
    const wingY = wingAnim > 0.25 ? -13 * wingAnim : 4;
    ctx.fillStyle = '#FFFFFF';
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(-6, 1);
    ctx.lineTo(-15, wingY);
    ctx.lineTo(6, 2);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // Armored Knight Torso + Helmet + Plume
    ctx.fillStyle = knightColor;
    ctx.fillRect(-5, -13, 10, 12);
    ctx.beginPath();
    ctx.arc(0, -16, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = visorColor;
    ctx.fillRect(1, -18, 5, 3);

    // Gleaming Steel Lance!
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-4, -9);
    ctx.lineTo(29, -9);
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(29, -11.5);
    ctx.lineTo(35, -9);
    ctx.lineTo(29, -6.5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.save();
    if (this.shakeTimer > 0) {
      ctx.translate((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9);
    }

    // Volcanic cavern sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#07060F');
    sky.addColorStop(0.75, '#190C1C');
    sky.addColorStop(1, '#45120A');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Floating Stone Cliffs & Bridges with volcanic rim lighting
    for (const p of this.platforms) {
      if (!p.intact) continue;
      // Stone slab body
      const grad = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
      grad.addColorStop(0, p.isBridge ? '#B45309' : '#A16207');
      grad.addColorStop(1, p.isBridge ? '#7C2D12' : '#422006');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(p.x, p.y, p.w, p.h, 4);
      ctx.fill();
      // Top golden highlight edge
      ctx.fillStyle = p.isBridge ? '#F97316' : '#FACC15';
      ctx.fillRect(p.x + 2, p.y, p.w - 4, 3);
      // Cracked rock underside glow from magma below
      ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
      ctx.fillRect(p.x + 4, p.y + p.h - 3, p.w - 8, 3);
    }

    // Bubbling Volcanic Magma Pit!
    const lavaGrad = ctx.createLinearGradient(0, LAVA_Y, 0, H);
    lavaGrad.addColorStop(0, '#F97316');
    lavaGrad.addColorStop(0.45, '#DC2626');
    lavaGrad.addColorStop(1, '#7F1D1D');
    ctx.fillStyle = lavaGrad;
    ctx.fillRect(0, LAVA_Y, W, H - LAVA_Y);
    for (const b of this.bubbles) {
      const pop = Math.sin(this.clock * 4 + b.phase);
      if (pop > 0) {
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(b.x, LAVA_Y + 6 - pop * 6, b.r * pop, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Fiery Lava Troll Arm!
    if (this.trollHandY < H + 10) {
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.trollX, H);
      ctx.lineTo(this.trollX, this.trollHandY);
      ctx.stroke();
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(this.trollX, this.trollHandY, 9, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hatching Eggs
    for (const egg of this.eggs) {
      const wobble = egg.hatchTimer < 2.0 ? Math.sin(this.clock * 28) * 2.5 : 0;
      ctx.fillStyle = egg.hatchTimer < 1.5 ? '#FCA5A5' : '#4ADE80';
      ctx.beginPath();
      ctx.ellipse(egg.x + wobble, egg.y, 7.5, 9.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }

    // Swooping Pterodactyl!
    if (this.ptero.active) {
      ctx.save();
      ctx.translate(this.ptero.x, this.ptero.y);
      ctx.scale(this.ptero.vx >= 0 ? 1 : -1, 1);
      const flapY = Math.sin(this.ptero.flap) * 16;
      ctx.fillStyle = '#DC2626';
      ctx.beginPath();
      ctx.moveTo(-24, 0);
      ctx.lineTo(14, -5);
      ctx.lineTo(28, -2);
      ctx.lineTo(14, 6);
      ctx.closePath();
      ctx.fill();
      // Wide leathery wing
      ctx.fillStyle = '#F87171';
      ctx.beginPath();
      ctx.moveTo(-10, -2);
      ctx.lineTo(-4, -20 + flapY);
      ctx.lineTo(10, -2);
      ctx.closePath();
      ctx.fill();
      // Glowing open mouth target!
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.moveTo(18, -3);
      ctx.lineTo(32, -7);
      ctx.lineTo(32, 3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Enemy Buzzard Knights
    for (const k of this.knights) {
      const armor = k.tier === 'shadow' ? '#38BDF8' : k.tier === 'hunter' ? '#CBD5E1' : '#EF4444';
      const buzzard = k.tier === 'shadow' ? '#1E3A8A' : k.tier === 'hunter' ? '#475569' : '#7F1D1D';
      this.drawMount(ctx, k.x, k.y, k.facing, k.wingAnim, this.clock * 8, k.grounded, buzzard, armor, '#FEF08A');
    }

    // Player Golden Ostrich Rider!
    const blink = this.invulnTimer > 0 && Math.floor(this.clock * 18) % 2 === 0;
    if (!blink) {
      this.drawMount(ctx, this.px, this.py, this.pFacing, this.pWingAnim, this.pRunAnim, this.pGrounded, '#FDE047', '#F59E0B', '#38BDF8');
    }

    renderParticlesAndPopups(ctx, this.particles, this.popups);

    if (this.phase === 'TITLE') {
      ctx.fillStyle = 'rgba(7, 6, 15, 0.78)';
      ctx.fillRect(0, H * 0.34, W, 152);
      ctx.textAlign = 'center';
      ctx.font = '900 44px "JetBrains Mono", monospace';
      ctx.fillStyle = '#FACC15';
      ctx.fillText('JOUST', W * 0.5, H * 0.34 + 54);
      ctx.font = '700 13px "JetBrains Mono", monospace';
      ctx.fillStyle = '#FB923C';
      ctx.fillText('1982 WILLIAMS · FLAP PHYSICS · BOUNDERS, HUNTERS & SHADOW LORDS', W * 0.5, H * 0.34 + 88);
      ctx.font = '600 12px "JetBrains Mono", monospace';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText('HIGHER LANCE WINS · CATCH EGGS MID-AIR · WATCH THE LAVA TROLL & PTERODACTYL!', W * 0.5, H * 0.34 + 120);
    }

    ctx.restore();
    if (visualMode === 'crt') renderCrtOverlay(ctx, W, H);
  }
}

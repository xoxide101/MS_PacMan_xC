import { drawHDSonicHero, drawSoftShadow, drawStarGlint } from './arcadeGfx';
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

export type SonicVariant = 'sonic1' | 'sonic2' | 'sonic3';
type SonicHero = 'sonic' | 'tails' | 'knuckles';
type ShieldType = 'none' | 'classic' | 'fire' | 'electric' | 'bubble';

interface Ring {
  x: number;
  y: number;
  vx: number;
  vy: number;
  scattered: boolean;
  life: number;
  collected: boolean;
}

interface Spring {
  x: number;
  y: number;
  power: number;
  compress: number;
}

interface LoopDef {
  cx: number;
  cy: number;
  r: number;
}

interface MonitorBox {
  x: number;
  y: number;
  kind: 'rings' | 'shield' | 'speed' | 'fire' | 'electric' | 'bubble';
  broken: boolean;
}

interface Badnik {
  id: number;
  kind: 'motobug' | 'crabmeat' | 'buzzbomber' | 'robotnik';
  x: number;
  y: number;
  vx: number;
  baseY: number;
  hp: number;
  dead: boolean;
  phase: number;
}

const LOGICAL_W = 864;
const LOGICAL_H = 640;
const GRAVITY = 1320;

export class SonicGame implements ArcadeGameInstance {
  public readonly logicalWidth = LOGICAL_W;
  public readonly logicalHeight = LOGICAL_H;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'Spin Jump';
  public readonly secondaryActionLabel: string;

  private variant: SonicVariant;
  private storageKey: string;
  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();

  private score = 0;
  private highScore = 0;
  private rings = 0;
  private level = 1;
  private lives = 3;
  private clock = 0;
  private phaseTimer = 0;

  // Player physics
  private px = 120;
  private py = 460;
  private pvx = 0;
  private pvy = 0;
  private pFacing: 1 | -1 = 1;
  private onGround = true;
  private spinning = false;
  private spinDashCharge = 0;
  private speedShoesTimer = 0;
  private invulnTimer = 0;
  private shield: ShieldType = 'none';
  private superSonic = false;
  private instaShieldTimer = 0;
  private airActionUsed = false;

  // Loop-de-Loop state
  private activeLoop: LoopDef | null = null;
  private loopAngle = 0;

  // Sonic 2 Tails sidekick / Sonic 3 character switcher
  private hero: SonicHero = 'sonic';
  private tailsX = 76;
  private tailsY = 460;

  private cameraX = 0;
  private worldW = 5400;
  private goalX = 5080;

  private loops: LoopDef[] = [];
  private springs: Spring[] = [];
  private ringList: Ring[] = [];
  private monitors: MonitorBox[] = [];
  private badniks: Badnik[] = [];
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];
  private nextId = 1;

  constructor(variant: SonicVariant) {
    this.variant = variant;
    this.storageKey = `${variant}_hd_highscore_v1`;
    this.highScore = readHighScore(this.storageKey);
    this.secondaryActionLabel =
      variant === 'sonic1' ? 'Roll Attack' : variant === 'sonic2' ? 'Spin Dash' : 'Spin Dash / Shield';
    this.buildZone(1);
    this.phase = 'TITLE';
  }

  private getTitleName(): string {
    if (this.variant === 'sonic1') return 'Sonic the Hedgehog';
    if (this.variant === 'sonic2') return 'Sonic the Hedgehog 2';
    return 'Sonic the Hedgehog 3';
  }

  private getZoneName(): string {
    if (this.variant === 'sonic1') {
      return ['Green Hill Zone', 'Marble Zone', 'Star Light Zone'][(this.level - 1) % 3];
    }
    if (this.variant === 'sonic2') {
      return ['Emerald Hill Zone', 'Chemical Plant Zone', 'Casino Night Zone'][(this.level - 1) % 3];
    }
    return ['Angel Island Zone', 'Hydrocity Zone', 'Launch Base Zone'][(this.level - 1) % 3];
  }

  private groundYAt(wx: number): number {
    // Rolling 16-bit Sonic hills & valleys (flat near start, loops, and boss arena)
    if (wx < 360 || wx > this.goalX - 420) return 524;
    for (const lp of this.loops) {
      if (Math.abs(wx - lp.cx) < lp.r + 120) return 524;
    }
    return 506 + Math.sin(wx * 0.0052) * 44 + Math.cos(wx * 0.011) * 18;
  }

  private buildZone(lvl: number): void {
    this.worldW = 5400 + (lvl - 1) * 450;
    this.goalX = this.worldW - 260;
    this.px = 120;
    this.py = this.groundYAt(120) - 20;
    this.pvx = 0;
    this.pvy = 0;
    this.onGround = true;
    this.spinning = false;
    this.spinDashCharge = 0;
    this.activeLoop = null;
    this.tailsX = 74;
    this.tailsY = this.py;
    this.cameraX = 0;
    this.rings = 0;
    this.superSonic = false;
    this.shield = this.variant === 'sonic3' ? 'electric' : 'none';

    // 2 Iconic 360-Degree Loop-de-Loops!
    this.loops = [
      { cx: 1480, cy: 524 - 135, r: 135 },
      { cx: 3420, cy: 524 - 145, r: 145 },
    ];

    // Golden Rings along hills, arcs & loops!
    this.ringList = [];
    for (let x = 280; x < this.goalX - 380; x += 380) {
      for (let k = 0; k < 5; k++) {
        const rx = x + k * 34;
        const ry = this.groundYAt(rx) - 34 - Math.sin((k / 4) * Math.PI) * 58;
        this.ringList.push({ x: rx, y: ry, vx: 0, vy: 0, scattered: false, life: 999, collected: false });
      }
    }
    // Loop rings!
    for (const lp of this.loops) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        this.ringList.push({
          x: lp.cx + Math.cos(a) * (lp.r - 22),
          y: lp.cy + Math.sin(a) * (lp.r - 22),
          vx: 0,
          vy: 0,
          scattered: false,
          life: 999,
          collected: false,
        });
      }
    }

    // Bouncing Red Springs
    this.springs = [
      { x: 960, y: this.groundYAt(960), power: 760, compress: 0 },
      { x: 2480, y: this.groundYAt(2480), power: 800, compress: 0 },
      { x: 4180, y: this.groundYAt(4180), power: 780, compress: 0 },
    ];

    // Item Monitors
    const monitorKinds: MonitorBox['kind'][] =
      this.variant === 'sonic3'
        ? ['rings', 'fire', 'electric', 'bubble', 'speed']
        : ['rings', 'shield', 'speed', 'rings', 'shield'];
    this.monitors = monitorKinds.map((kind, i) => {
      const mx = 680 + i * 840;
      return { x: mx, y: this.groundYAt(mx) - 20, kind, broken: false };
    });

    // Badniks + Dr. Robotnik Eggmobile Boss!
    this.badniks = [];
    const count = 10 + lvl * 2;
    for (let i = 0; i < count; i++) {
      const bx = 540 + (i / count) * (this.goalX - 960);
      const kind: Badnik['kind'] = i % 3 === 0 ? 'buzzbomber' : i % 3 === 1 ? 'crabmeat' : 'motobug';
      const by = kind === 'buzzbomber' ? this.groundYAt(bx) - 135 : this.groundYAt(bx) - 18;
      this.badniks.push({
        id: this.nextId++,
        kind,
        x: bx,
        y: by,
        vx: -(75 + lvl * 8),
        baseY: by,
        hp: 1,
        dead: false,
        phase: i,
      });
    }
    this.badniks.push({
      id: this.nextId++,
      kind: 'robotnik',
      x: this.goalX - 180,
      y: 340,
      vx: -95,
      baseY: 340,
      hp: 4 + lvl,
      dead: false,
      phase: 0,
    });
  }

  public startNewGame(): void {
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.particles = [];
    this.popups = [];
    this.buildZone(1);
    this.invulnTimer = 1.4;
    this.phase = 'READY';
    this.phaseTimer = 1.05;
    arcadeAudio.playArcadeStart();
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.buildZone(1);
    this.phase = 'TITLE';
  }

  public restartStage(): void {
    // In Sonic 3, R cycles between Sonic, Tails (Flight), and Knuckles (Glide)!
    if (this.variant === 'sonic3' && this.phase === 'PLAYING') {
      const order: SonicHero[] = ['sonic', 'tails', 'knuckles'];
      this.hero = order[(order.indexOf(this.hero) + 1) % order.length];
      arcadeAudio.playPowerUp();
      const col = this.hero === 'sonic' ? '#3B82F6' : this.hero === 'tails' ? '#F59E0B' : '#EF4444';
      this.popups.push({ x: this.px, y: this.py - 36, text: `PLAYING AS ${this.hero.toUpperCase()}!`, color: col, life: 1.0, maxLife: 1.0 });
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
      this.popups.push({ x: wx, y: wy, text: `${pts}`, color, life: 0.8, maxLife: 0.8 });
    }
  }

  private damageSonic(): void {
    if (this.invulnTimer > 0 || this.superSonic) return;

    if (this.shield !== 'none') {
      this.shield = 'none';
      this.invulnTimer = 1.8;
      this.pvy = -340;
      this.pvx = -this.pFacing * 200;
      arcadeAudio.playExplosion(false);
      spawnBurst(this.particles, this.px, this.py, '#38BDF8', 18, 220, 3);
      return;
    }

    if (this.rings > 0) {
      // Iconic Sonic Ring Scatter!
      const scatterCount = Math.min(18, this.rings);
      this.rings = 0;
      this.invulnTimer = 2.0;
      this.pvy = -380;
      this.pvx = -this.pFacing * 220;
      arcadeAudio.playRingScatter();
      for (let i = 0; i < scatterCount; i++) {
        const a = -Math.PI * 0.15 - (i / scatterCount) * Math.PI * 0.7;
        const spd = 240 + (i % 3) * 85;
        this.ringList.push({
          x: this.px,
          y: this.py - 10,
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd - 120,
          scattered: true,
          life: 4.5,
          collected: false,
        });
      }
      return;
    }

    arcadeAudio.playExplosion(true);
    this.lives -= 1;
    if (this.lives <= 0) {
      this.phase = 'GAME_OVER';
      arcadeAudio.playDeath();
      return;
    }
    this.buildZone(this.level);
    this.invulnTimer = 2.0;
  }

  public step(dt: number): void {
    this.clock += dt;
    stepParticlesAndPopups(this.particles, this.popups, dt);

    for (const sp of this.springs) {
      if (sp.compress > 0) sp.compress = Math.max(0, sp.compress - dt * 5);
    }

    if (this.phase === 'TITLE') {
      this.cameraX = (this.clock * 140) % 2400;
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
        this.buildZone(this.level);
        this.phase = 'READY';
        this.phaseTimer = 1.05;
      }
      return;
    }

    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (this.speedShoesTimer > 0) this.speedShoesTimer = Math.max(0, this.speedShoesTimer - dt);
    if (this.instaShieldTimer > 0) this.instaShieldTimer = Math.max(0, this.instaShieldTimer - dt);

    // Super Sonic ring drain in Sonic 2 & 3!
    if (this.superSonic) {
      if (Math.floor(this.clock) !== Math.floor(this.clock - dt)) {
        this.rings = Math.max(0, this.rings - 1);
        if (this.rings <= 0) this.superSonic = false;
      }
    }

    // Active 360-degree Loop-de-Loop traversal!
    if (this.activeLoop) {
      const lp = this.activeLoop;
      this.loopAngle -= (Math.max(460, Math.abs(this.pvx)) / lp.r) * dt;
      this.px = lp.cx + Math.cos(this.loopAngle) * (lp.r - 18);
      this.py = lp.cy + Math.sin(this.loopAngle) * (lp.r - 18);
      this.spinning = true;
      if (this.loopAngle <= -Math.PI * 1.5) {
        this.activeLoop = null;
        this.px = lp.cx + lp.r * 0.4;
        this.py = 524 - 18;
        this.pvx = Math.max(540, this.pvx);
        this.onGround = true;
        this.addScore(500, this.px, this.py - 32, '#38BDF8');
      }
    } else {
      const topSpd = (this.superSonic ? 780 : this.speedShoesTimer > 0 ? 720 : 540);
      const accel = this.onGround ? 920 : 620;

      // Spin Dash (Sonic 2 & Sonic 3): Hold Down + tap Fire/Secondary!
      const crouching = this.onGround && this.input.down && Math.abs(this.pvx) < 110;
      if (crouching && this.variant !== 'sonic1' && (this.input.fireJustPressed || this.input.secondaryJustPressed)) {
        this.spinDashCharge = Math.min(4, this.spinDashCharge + 1);
        this.spinning = true;
        arcadeAudio.playSpinDash(this.spinDashCharge);
      } else if (!this.input.down && this.spinDashCharge > 0) {
        // Release Spin Dash rocket boost!
        this.pvx = this.pFacing * (520 + this.spinDashCharge * 95);
        this.spinDashCharge = 0;
        this.spinning = true;
        spawnBurst(this.particles, this.px - this.pFacing * 14, this.py + 12, '#38BDF8', 14, 220, 3);
      }

      if (this.spinDashCharge === 0) {
        if (this.input.left && !this.input.right) {
          this.pFacing = -1;
          this.pvx = Math.max(-topSpd, this.pvx - accel * dt);
        } else if (this.input.right && !this.input.left) {
          this.pFacing = 1;
          this.pvx = Math.min(topSpd, this.pvx + accel * dt);
        } else {
          this.pvx *= Math.pow(this.onGround ? 0.14 : 0.45, dt);
          if (Math.abs(this.pvx) < 8) this.pvx = 0;
        }

        // Rolling spin attack while running
        if (this.onGround && (this.input.down || this.input.secondary) && Math.abs(this.pvx) > 120) {
          this.spinning = true;
        } else if (this.onGround && !this.input.down && Math.abs(this.pvx) < 90) {
          this.spinning = false;
        }

        // Jump + Sonic 2 Super Sonic transform + Sonic 3 Elemental Shield / Insta-Shield!
        if ((this.input.fireJustPressed || this.input.up) && this.onGround && !crouching) {
          this.pvy = -615;
          this.onGround = false;
          this.spinning = true;
          this.airActionUsed = false;
          arcadeAudio.playJumpBoing();
        } else if (!this.onGround && (this.input.fireJustPressed || this.input.secondaryJustPressed) && !this.airActionUsed) {
          if (this.variant !== 'sonic1' && !this.superSonic && this.rings >= 50) {
            this.superSonic = true;
            this.airActionUsed = true;
            arcadeAudio.playSuperTransform();
            this.popups.push({ x: this.px, y: this.py - 36, text: 'SUPER SONIC!', color: '#FACC15', life: 1.3, maxLife: 1.3 });
          } else if (this.variant === 'sonic3') {
            this.airActionUsed = true;
            if (this.hero === 'tails') {
              this.pvy = -380;
              arcadeAudio.playSpring();
            } else if (this.shield === 'fire') {
              this.pvx = this.pFacing * 720;
              this.pvy = 0;
              arcadeAudio.playFlame();
            } else if (this.shield === 'electric') {
              this.pvy = -520;
              arcadeAudio.playSuperzapper();
            } else if (this.shield === 'bubble') {
              this.pvy = 640;
              arcadeAudio.playTrampolineBoing(2);
            } else {
              // Classic Sonic 3 Insta-Shield burst!
              this.instaShieldTimer = 0.22;
              arcadeAudio.playLaser(1100);
            }
          }
        }
      }

      this.pvy = Math.min(780, this.pvy + GRAVITY * dt);
      this.px = Math.max(24, Math.min(this.worldW - 24, this.px + this.pvx * dt));
      this.py += this.pvy * dt;

      // Ground terrain follow
      const gy = this.groundYAt(this.px);
      if (this.py + 18 >= gy) {
        if (this.shield === 'bubble' && this.airActionUsed && this.pvy > 480) {
          // Bubble shield high bounce!
          this.py = gy - 18;
          this.pvy = -660;
          this.airActionUsed = false;
          arcadeAudio.playSpring();
        } else {
          this.py = gy - 18;
          this.pvy = 0;
          this.onGround = true;
          this.airActionUsed = false;
          if (!this.input.down && !this.input.secondary) this.spinning = false;
        }
      } else {
        this.onGround = false;
      }

      // Enter 360-degree Loop-de-Loop when running fast enough!
      for (const lp of this.loops) {
        if (
          this.onGround &&
          this.pvx > 340 &&
          Math.abs(this.px - lp.cx) < 28 &&
          Math.abs(this.py + 18 - (lp.cy + lp.r)) < 30
        ) {
          this.activeLoop = lp;
          this.loopAngle = Math.PI * 0.5;
          arcadeAudio.playSpinDash(3);
          break;
        }
      }
    }

    // Sonic 2 AI Tails Sidekick smoothly follows Sonic!
    if (this.variant === 'sonic2') {
      this.tailsX += (this.px - this.pFacing * 48 - this.tailsX) * Math.min(1, dt * 6);
      this.tailsY += (this.py - 8 - this.tailsY) * Math.min(1, dt * 6);
    }

    // Camera tracking
    const targetCam = Math.max(0, Math.min(this.worldW - LOGICAL_W, this.px - LOGICAL_W * 0.34));
    this.cameraX += (targetCam - this.cameraX) * Math.min(1, dt * 9);

    // Springs
    for (const sp of this.springs) {
      if (Math.abs(sp.x - this.px) < 26 && Math.abs(sp.y - 12 - (this.py + 18)) < 22) {
        this.pvy = -sp.power;
        this.onGround = false;
        this.spinning = true;
        sp.compress = 1;
        arcadeAudio.playSpring();
      }
    }

    // Monitors
    for (const m of this.monitors) {
      if (m.broken) continue;
      if (Math.hypot(m.x - this.px, m.y - this.py) < 32 && (this.spinning || !this.onGround)) {
        m.broken = true;
        if (!this.onGround) this.pvy = -380;
        arcadeAudio.playPop();
        spawnBurst(this.particles, m.x, m.y, '#38BDF8', 16, 200, 3);
        if (m.kind === 'rings') {
          this.rings += 10;
          arcadeAudio.playRing();
          this.popups.push({ x: m.x, y: m.y - 24, text: '+10 RINGS!', color: '#FACC15', life: 0.9, maxLife: 0.9 });
        } else if (m.kind === 'speed') {
          this.speedShoesTimer = 12;
          arcadeAudio.playPowerUp();
          this.popups.push({ x: m.x, y: m.y - 24, text: 'SPEED SHOES!', color: '#FB923C', life: 1.0, maxLife: 1.0 });
        } else {
          this.shield = m.kind === 'shield' ? 'classic' : m.kind;
          arcadeAudio.playPowerUp();
          this.popups.push({ x: m.x, y: m.y - 24, text: `${this.shield.toUpperCase()} SHIELD!`, color: '#38BDF8', life: 1.0, maxLife: 1.0 });
        }
      }
    }

    // Rings (including Sonic 3 Electric Shield magnetic pull!)
    for (let i = this.ringList.length - 1; i >= 0; i--) {
      const r = this.ringList[i];
      if (r.collected) continue;

      if (r.scattered) {
        r.life -= dt;
        r.vy += 900 * dt;
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        const gy = this.groundYAt(r.x);
        if (r.y + 8 >= gy) {
          r.y = gy - 8;
          r.vy = -Math.abs(r.vy) * 0.65;
        }
        if (r.life <= 0) {
          this.ringList.splice(i, 1);
          continue;
        }
      } else if (this.shield === 'electric' && Math.hypot(r.x - this.px, r.y - this.py) < 165) {
        r.x += (this.px - r.x) * Math.min(1, dt * 8);
        r.y += (this.py - r.y) * Math.min(1, dt * 8);
      }

      const canPick = !r.scattered || r.life < 3.9;
      if (
        canPick &&
        (Math.hypot(r.x - this.px, r.y - this.py) < 28 ||
          (this.variant === 'sonic2' && Math.hypot(r.x - this.tailsX, r.y - this.tailsY) < 26))
      ) {
        r.collected = true;
        this.rings += 1;
        this.addScore(10);
        arcadeAudio.playRing();
      }
    }

    // Badniks & Dr. Robotnik Boss
    for (const b of this.badniks) {
      if (b.dead || Math.abs(b.x - this.px) > 660) continue;
      b.phase += dt * 3;
      if (b.kind === 'robotnik') {
        b.x += b.vx * dt;
        b.y = b.baseY + Math.sin(b.phase) * 48;
        if (b.x < this.goalX - 360) b.vx = Math.abs(b.vx);
        if (b.x > this.goalX - 80) b.vx = -Math.abs(b.vx);
      } else if (b.kind === 'buzzbomber') {
        b.x += b.vx * dt;
        b.y = b.baseY + Math.sin(b.phase * 1.4) * 26;
      } else {
        b.x += b.vx * dt;
        b.y = this.groundYAt(b.x) - 18;
      }

      const hitR = b.kind === 'robotnik' ? 38 : 26;
      if (Math.hypot(b.x - this.px, b.y - this.py) < hitR) {
        const attacking = this.spinning || this.superSonic || this.instaShieldTimer > 0 || !this.onGround;
        if (attacking) {
          b.hp -= 1;
          if (!this.onGround) this.pvy = -440;
          if (b.hp <= 0) {
            b.dead = true;
            this.addScore(b.kind === 'robotnik' ? 3000 : 100, b.x, b.y - 18, '#FACC15');
            spawnBurst(this.particles, b.x, b.y, '#FB923C', 20, 220, 3.5);
            arcadeAudio.playExplosion(b.kind === 'robotnik');
          } else {
            this.addScore(250, b.x, b.y - 20, '#38BDF8');
            spawnBurst(this.particles, b.x, b.y, '#FACC15', 10, 160, 2.5);
            arcadeAudio.playStomp();
          }
        } else {
          this.damageSonic();
          return;
        }
      }
    }

    // Reached Act Goal Signpost!
    if (this.px >= this.goalX) {
      const ringBonus = this.rings * 100;
      this.addScore(2000 + ringBonus, this.goalX, this.py - 32, '#FACC15');
      arcadeAudio.playStageClear();
      this.phase = 'STAGE_CLEAR';
      this.phaseTimer = 1.9;
    }
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.save();
    ctx.scale(dpr, dpr);

    const isChem = this.variant === 'sonic2' && this.level % 3 === 2;
    const isHydro = this.variant === 'sonic3' && this.level % 3 === 2;

    // Vibrant 16-Bit Multi-Band Genesis Sky
    const sky = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
    if (isChem) {
      sky.addColorStop(0, '#090D24');
      sky.addColorStop(0.55, '#1E1B4B');
      sky.addColorStop(1, '#581C87');
    } else if (isHydro) {
      sky.addColorStop(0, '#042F2E');
      sky.addColorStop(0.55, '#0E7490');
      sky.addColorStop(1, '#22D3EE');
    } else {
      sky.addColorStop(0, '#1D4ED8');
      sky.addColorStop(0.45, '#38BDF8');
      sky.addColorStop(0.72, '#BAE6FD');
      sky.addColorStop(1, '#0284C7');
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // Distant Parallax Clouds
    ctx.fillStyle = isChem ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255, 255, 255, 0.72)';
    for (let i = 0; i < 6; i++) {
      const cx = ((i * 230 - this.cameraX * 0.08 - this.clock * 12) % (LOGICAL_W + 240) + (LOGICAL_W + 240)) % (LOGICAL_W + 240) - 100;
      const cy = 78 + (i % 3) * 34;
      ctx.beginPath();
      ctx.roundRect(cx, cy, 110 + (i % 2) * 40, 18, 9);
      ctx.roundRect(cx + 22, cy - 12, 68, 16, 8);
      ctx.fill();
    }

    // Parallax Distant Checkered Mesas & Shimmering Ocean Band (Green/Emerald/Angel Island)
    if (isChem) {
      // Industrial Chemical Plant skyline towers + glowing magenta vats
      for (let i = 0; i < 8; i++) {
        const bx = ((i * 180 - this.cameraX * 0.16) % (LOGICAL_W + 200) + (LOGICAL_W + 200)) % (LOGICAL_W + 200) - 100;
        const bh = 130 + (i % 3) * 55;
        ctx.fillStyle = '#1E1B4B';
        ctx.fillRect(bx, 420 - bh, 72, bh);
        ctx.fillStyle = i % 2 === 0 ? '#EC4899' : '#38BDF8';
        for (let wy = 420 - bh + 18; wy < 400; wy += 24) {
          ctx.fillRect(bx + 12, wy, 18, 6);
          ctx.fillRect(bx + 42, wy, 18, 6);
        }
      }
    } else {
      // Distant Green Hill / Emerald Hill Mountains
      for (let i = 0; i < 6; i++) {
        const mx = ((i * 250 - this.cameraX * 0.14) % (LOGICAL_W + 300) + (LOGICAL_W + 300)) % (LOGICAL_W + 300) - 150;
        const mg = ctx.createLinearGradient(mx, 230, mx, 390);
        mg.addColorStop(0, '#0284C7');
        mg.addColorStop(1, '#1E3A8A');
        ctx.fillStyle = mg;
        ctx.beginPath();
        ctx.moveTo(mx, 390);
        ctx.lineTo(mx + 115, 225);
        ctx.lineTo(mx + 240, 390);
        ctx.closePath();
        ctx.fill();
        // Animated distant waterfall streak
        if (i % 2 === 0) {
          ctx.fillStyle = 'rgba(224, 242, 254, 0.55)';
          const wfOff = (this.clock * 65) % 18;
          ctx.fillRect(mx + 108, 290, 14, 100);
          ctx.fillStyle = '#FFFFFF';
          for (let wy = 292 + wfOff; wy < 388; wy += 18) {
            ctx.fillRect(mx + 110, wy, 10, 5);
          }
        }
      }

      // Shimmering 16-bit Parallax Ocean Horizon
      const oceanG = ctx.createLinearGradient(0, 388, 0, 510);
      oceanG.addColorStop(0, '#0369A1');
      oceanG.addColorStop(0.5, '#0284C7');
      oceanG.addColorStop(1, '#075985');
      ctx.fillStyle = oceanG;
      ctx.fillRect(0, 388, LOGICAL_W, 130);
      ctx.fillStyle = 'rgba(186, 230, 253, 0.45)';
      for (let r = 0; r < 5; r++) {
        const wy = 398 + r * 20;
        const shift = ((this.cameraX * (0.2 + r * 0.06) + this.clock * (22 + r * 8)) % 90);
        for (let x = -shift; x < LOGICAL_W; x += 90) {
          ctx.fillRect(x, wy, 36 + r * 6, 2.5);
        }
      }
    }

    // World Space
    ctx.save();
    ctx.translate(-this.cameraX, 0);

    // Tropical swaying Green Hill Palm Trees behind terrain
    if (!isChem && !isHydro) {
      for (let tx = 220; tx < this.worldW - 200; tx += 360) {
        if (tx < this.cameraX - 80 || tx > this.cameraX + LOGICAL_W + 80) continue;
        const baseY = this.groundYAt(tx);
        const sway = Math.sin(this.clock * 2.5 + tx * 0.01) * 5;
        ctx.save();
        // Segmented curved trunk
        ctx.strokeStyle = '#92400E';
        ctx.lineWidth = 14;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tx, baseY + 6);
        ctx.quadraticCurveTo(tx - 10, baseY - 60, tx + sway, baseY - 122);
        ctx.stroke();
        ctx.strokeStyle = '#D97706';
        ctx.lineWidth = 5;
        ctx.setLineDash([7, 7]);
        ctx.stroke();
        ctx.setLineDash([]);
        // Palm fronds
        ctx.translate(tx + sway, baseY - 124);
        for (let f = 0; f < 6; f++) {
          const ang = -Math.PI * 0.9 + (f / 5) * Math.PI * 1.1;
          ctx.save();
          ctx.rotate(ang);
          ctx.fillStyle = f % 2 === 0 ? '#16A34A' : '#22C55E';
          ctx.beginPath();
          ctx.ellipse(26, 0, 28, 7, 0.15, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        ctx.restore();
      }
    }

    // Iconic Checkered Sonic Terrain with beveled diamond-grid clipping!
    ctx.save();
    ctx.beginPath();
    const startX = Math.max(0, Math.floor(this.cameraX / 24) * 24 - 24);
    const endX = Math.min(this.worldW, this.cameraX + LOGICAL_W + 48);
    ctx.moveTo(startX, LOGICAL_H);
    for (let x = startX; x <= endX; x += 24) {
      ctx.lineTo(x, this.groundYAt(x));
    }
    ctx.lineTo(endX, LOGICAL_H);
    ctx.closePath();
    ctx.fillStyle = isChem ? '#1E1B4B' : isHydro ? '#155E75' : '#78350F';
    ctx.fill();
    ctx.clip();

    // Crisp classic 16-bit checkerboard soil tiles
    const tileS = 28;
    const tx0 = Math.floor(startX / tileS) * tileS;
    for (let x = tx0; x <= endX; x += tileS) {
      for (let y = 360; y < LOGICAL_H; y += tileS) {
        const alt = (Math.floor(x / tileS) + Math.floor(y / tileS)) % 2 === 0;
        ctx.fillStyle = alt
          ? isChem
            ? '#312E81'
            : isHydro
            ? '#0E7490'
            : '#B45309'
          : isChem
          ? '#1E1B4B'
          : isHydro
          ? '#164E63'
          : '#78350F';
        ctx.fillRect(x, y, tileS, tileS);
        if (alt) {
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          ctx.fillRect(x, y, tileS, 3);
        }
      }
    }
    ctx.restore();

    // Sculpted Lush Emerald Grass Overhang along slope
    ctx.save();
    ctx.strokeStyle = isChem ? '#EC4899' : '#14532D';
    ctx.lineWidth = 18;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let x = startX; x <= endX; x += 24) {
      const gy = this.groundYAt(x);
      if (x === startX) ctx.moveTo(x, gy + 6);
      else ctx.lineTo(x, gy + 6);
    }
    ctx.stroke();
    ctx.strokeStyle = isChem ? '#F472B6' : '#22C55E';
    ctx.lineWidth = 11;
    ctx.stroke();
    ctx.strokeStyle = isChem ? '#FBCFE8' : '#86EFAC';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    for (let x = startX; x <= endX; x += 24) {
      const gy = this.groundYAt(x);
      if (x === startX) ctx.moveTo(x, gy + 1);
      else ctx.lineTo(x, gy + 1);
    }
    ctx.stroke();
    ctx.restore();

    // 3D-Shaded Iconic 360-Degree Loop-de-Loops!
    for (const lp of this.loops) {
      if (lp.cx + lp.r < this.cameraX - 80 || lp.cx - lp.r > this.cameraX + LOGICAL_W + 80) continue;
      ctx.save();
      // Checkered outer stone ring
      ctx.strokeStyle = isChem ? '#312E81' : '#78350F';
      ctx.lineWidth = 32;
      ctx.beginPath();
      ctx.arc(lp.cx, lp.cy, lp.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = isChem ? '#4338CA' : '#B45309';
      ctx.lineWidth = 24;
      ctx.setLineDash([18, 18]);
      ctx.stroke();
      ctx.setLineDash([]);
      // Emerald inner running track & highlight
      ctx.strokeStyle = isChem ? '#EC4899' : '#22C55E';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(lp.cx, lp.cy, lp.r - 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = isChem ? '#FBCFE8' : '#86EFAC';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(lp.cx, lp.cy, lp.r - 17, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Coiled Metallic Sonic Bounce Springs
    for (const sp of this.springs) {
      const h = 18 - sp.compress * 9;
      ctx.save();
      ctx.translate(sp.x, sp.y);
      // Coiled silver spring zig-zag
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(10, -h * 0.33);
      ctx.lineTo(-10, -h * 0.66);
      ctx.lineTo(10, -h);
      ctx.stroke();
      // Red/Yellow cushioned bounce pad with star emblem
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(-16, -h - 3, 32, 4);
      ctx.fillStyle = '#EF4444';
      ctx.strokeStyle = '#7F1D1D';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-20, -h - 10, 40, 8, 3);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Classic 16-Bit CRT Item Monitors
    for (const m of this.monitors) {
      if (m.broken) continue;
      ctx.save();
      ctx.translate(m.x, m.y);
      drawSoftShadow(ctx, 0, 17, 16, 4, 0.38);
      const mg = ctx.createLinearGradient(-16, -16, 16, 16);
      mg.addColorStop(0, '#64748B');
      mg.addColorStop(1, '#1E293B');
      ctx.fillStyle = mg;
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(-16, -16, 32, 32, 4);
      ctx.fill();
      ctx.stroke();
      // Glowing CRT screen
      ctx.fillStyle =
        m.kind === 'fire'
          ? '#EA580C'
          : m.kind === 'electric'
          ? '#CA8A04'
          : m.kind === 'bubble'
          ? '#0284C7'
          : '#0F172A';
      ctx.fillRect(-12, -12, 24, 20);
      // Monitor scanline sheen
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(-12, -12, 24, 5);
      ctx.fillStyle = '#FEF08A';
      ctx.font = '900 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(m.kind === 'rings' ? '10' : m.kind[0].toUpperCase(), 0, -2);
      ctx.restore();
    }

    // Classic Spinning Goal Signpost
    const gBaseY = this.groundYAt(this.goalX);
    ctx.fillStyle = '#94A3B8';
    ctx.fillRect(this.goalX - 4, gBaseY - 72, 8, 72);
    const signSpin = this.phase === 'STAGE_CLEAR' ? Math.cos(this.clock * 18) : 1;
    ctx.save();
    ctx.translate(this.goalX, gBaseY - 90);
    ctx.scale(Math.max(0.15, Math.abs(signSpin)), 1);
    ctx.fillStyle = '#1E293B';
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-26, -20, 52, 40, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = this.phase === 'STAGE_CLEAR' ? '#3B82F6' : '#EF4444';
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FEF08A';
    ctx.font = '900 10px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.phase === 'STAGE_CLEAR' ? 'SONIC' : 'GOAL', 0, 1);
    ctx.restore();

    // 3D-Thickness Glinting Golden Rings
    for (const r of this.ringList) {
      if (r.collected || r.x < this.cameraX - 24 || r.x > this.cameraX + LOGICAL_W + 24) continue;
      if (r.scattered && r.life < 1.2 && Math.floor(this.clock * 16) % 2 === 0) continue;
      const spin = Math.max(0.24, Math.abs(Math.cos(this.clock * 7 + r.x * 0.02)));
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.scale(spin, 1);
      ctx.strokeStyle = '#B45309';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, 9.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 3.2;
      ctx.stroke();
      ctx.strokeStyle = '#FEF9C3';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, 9.5, -2.4, -0.6);
      ctx.stroke();
      ctx.restore();
      if (spin > 0.92) {
        drawStarGlint(ctx, r.x + 6, r.y - 6, 3.8, '#FFFFFF', this.clock * 4);
      }
    }

    // Badniks & Dr. Robotnik Eggmobile
    for (const b of this.badniks) {
      if (b.dead || b.x < this.cameraX - 70 || b.x > this.cameraX + LOGICAL_W + 70) continue;
      this.drawBadnik(ctx, b);
    }

    // Sonic 2 AI Tails Sidekick!
    if (this.variant === 'sonic2') {
      this.drawHedgehog(ctx, this.tailsX, this.tailsY, 'tails', false);
    }

    // Player Sonic / Tails / Knuckles (with high-speed afterimage!)
    if (this.phase !== 'GAME_OVER') {
      const blink = this.invulnTimer > 0 && Math.floor(this.clock * 18) % 2 === 0;
      if (!blink) {
        if (Math.abs(this.pvx) > 360 || this.superSonic) {
          ctx.save();
          ctx.globalAlpha = 0.28;
          this.drawHedgehog(ctx, this.px - this.pvx * 0.028, this.py - this.pvy * 0.02, this.hero, this.spinning);
          ctx.restore();
        }
        this.drawHedgehog(ctx, this.px, this.py, this.hero, this.spinning);
      }
    }

    renderParticlesAndPopups(ctx, this.particles, this.popups);
    ctx.restore();

    // Classic Sonic HUD Overlay
    ctx.fillStyle = 'rgba(4, 7, 18, 0.76)';
    ctx.fillRect(0, 0, LOGICAL_W, 44);
    ctx.font = '700 13px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = this.rings === 0 && Math.floor(this.clock * 6) % 2 === 0 ? '#EF4444' : '#FACC15';
    ctx.fillText(`RINGS ${this.rings}   SCORE ${this.score.toLocaleString()}`, 18, 27);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#38BDF8';
    ctx.fillText(this.getZoneName().toUpperCase(), LOGICAL_W * 0.5, 27);
    ctx.textAlign = 'right';
    ctx.fillStyle = this.superSonic ? '#FACC15' : '#A5B4FC';
    ctx.fillText(
      this.superSonic
        ? 'SUPER SONIC!'
        : this.variant === 'sonic3'
        ? `${this.hero.toUpperCase()} · ${this.shield.toUpperCase()}`
        : `SPD ${Math.round(Math.abs(this.pvx))}`,
      LOGICAL_W - 18,
      27
    );

    if (this.phase === 'READY' || this.phase === 'STAGE_CLEAR') {
      ctx.fillStyle = 'rgba(5, 7, 16, 0.84)';
      ctx.beginPath();
      ctx.roundRect(LOGICAL_W * 0.5 - 200, LOGICAL_H * 0.5 - 34, 400, 68, 10);
      ctx.fill();
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = '800 22px "Outfit", sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        this.phase === 'READY' ? `${this.getZoneName().toUpperCase()} · ACT ${this.level}` : 'SONIC GOT THROUGH ACT!',
        LOGICAL_W * 0.5,
        LOGICAL_H * 0.5
      );
    }

    if (visualMode === 'crt') renderCrtOverlay(ctx, LOGICAL_W, LOGICAL_H);
    ctx.restore();
  }

  private drawHedgehog(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    who: SonicHero,
    isSpinning: boolean
  ): void {
    const isPlayer = who === this.hero;
    drawHDSonicHero(ctx, {
      x,
      y: y - 2,
      facing: this.pFacing,
      who,
      isSuper: isPlayer && this.superSonic,
      isSpinning,
      speed: isPlayer ? this.pvx : this.pvx * 0.85,
      clock: this.clock,
      shield: isPlayer ? this.shield : 'none',
      instaShield: isPlayer && this.instaShieldTimer > 0,
    });
  }

  private drawBadnik(ctx: CanvasRenderingContext2D, b: Badnik): void {
    const dir = b.vx >= 0 ? 1 : -1;
    ctx.save();
    ctx.translate(b.x, b.y);
    if (b.kind === 'robotnik') {
      // Dr. Robotnik in Detailed Metallic Eggmobile!
      const hover = Math.sin(this.clock * 6) * 4;
      ctx.translate(0, hover);
      // Thruster flame underneath
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.moveTo(22, 12);
      ctx.lineTo(36 + Math.sin(this.clock * 30) * 5, 16);
      ctx.lineTo(22, 20);
      ctx.fill();
      // Eggmobile metallic cockpit pod
      const eg = ctx.createLinearGradient(0, -10, 0, 26);
      eg.addColorStop(0, '#CBD5E1');
      eg.addColorStop(0.5, '#64748B');
      eg.addColorStop(1, '#1E293B');
      ctx.fillStyle = eg;
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 10, 34, 19, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Iconic black & yellow hazard bumper stripes
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(-29, 3, 58, 7);
      ctx.fillStyle = '#0F172A';
      for (let sx = -26; sx <= 22; sx += 12) {
        ctx.fillRect(sx, 3, 6, 7);
      }
      // Dr. Robotnik in crimson coat, blue spectacles & wild flaring brown mustache!
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(0, -6, 15, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#FDBA74';
      ctx.beginPath();
      ctx.arc(0, -14, 11.5, 0, Math.PI * 2);
      ctx.fill();
      // Blue pince-nez glasses
      ctx.fillStyle = '#38BDF8';
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(-4.5, -16, 4.2, 0, Math.PI * 2);
      ctx.arc(4.5, -16, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Wild flaring brown mustache + pink nose
      ctx.fillStyle = '#78350F';
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(-22, -14);
      ctx.lineTo(-16, -7);
      ctx.lineTo(0, -9);
      ctx.lineTo(16, -7);
      ctx.lineTo(22, -14);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FB7185';
      ctx.beginPath();
      ctx.arc(0, -12, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.kind === 'motobug') {
      ctx.scale(dir, 1);
      // Spinning spoked rubber wheel
      ctx.save();
      ctx.translate(0, 8);
      ctx.rotate(this.clock * 14);
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(6, 0);
      ctx.moveTo(0, -6);
      ctx.lineTo(0, 6);
      ctx.stroke();
      ctx.restore();
      // Glossy red ladybug chassis + exhaust pipe
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(-18, -2, 7, 5);
      const mg = ctx.createRadialGradient(-4, -6, 2, 0, 2, 16);
      mg.addColorStop(0, '#FCA5A5');
      mg.addColorStop(0.5, '#EF4444');
      mg.addColorStop(1, '#7F1D1D');
      ctx.fillStyle = mg;
      ctx.strokeStyle = '#1E1B24';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 3, 15, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Black ladybug spots & robotic eye
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(-5, -4, 3, 0, Math.PI * 2);
      ctx.arc(3, -7, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(10, -2, 3.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.kind === 'crabmeat') {
      const snap = Math.sin(this.clock * 10 + b.phase) * 3;
      // Mechanical legs
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-10, 8);
      ctx.lineTo(-16, 16);
      ctx.moveTo(10, 8);
      ctx.lineTo(16, 16);
      ctx.stroke();
      // Articulated yellow pincer cannons
      ctx.fillStyle = '#FACC15';
      ctx.strokeStyle = '#78350F';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(-18, -7 + snap * 0.5, 7, 0.3, Math.PI * 2 - 0.3);
      ctx.arc(18, -7 - snap * 0.5, 7, 0.3, Math.PI * 2 - 0.3);
      ctx.fill();
      ctx.stroke();
      // Red armored crab chassis + eye stalks
      ctx.fillStyle = '#DC2626';
      ctx.strokeStyle = '#450A0A';
      ctx.beginPath();
      ctx.roundRect(-15, -5, 30, 15, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-5, -9, 3.5, 0, Math.PI * 2);
      ctx.arc(5, -9, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(-6, -10, 2, 2.5);
      ctx.fillRect(4, -10, 2, 2.5);
    } else {
      // Buzz Bomber metallic wasp with rapid translucent wings & glowing stinger!
      ctx.scale(dir, 1);
      const flap = Math.sin(this.clock * 44 + b.phase) * 5;
      ctx.fillStyle = 'rgba(224, 242, 254, 0.72)';
      ctx.beginPath();
      ctx.ellipse(-2, -10 + flap * 0.35, 13, 4.5, -0.25, 0, Math.PI * 2);
      ctx.fill();
      // Striped stinger abdomen
      ctx.fillStyle = '#FACC15';
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.ellipse(-10, 4, 9, 5.5, 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Cobalt metallic thorax & red visor eye
      const bg = ctx.createRadialGradient(2, -4, 1, 2, 0, 15);
      bg.addColorStop(0, '#93C5FD');
      bg.addColorStop(0.55, '#2563EB');
      bg.addColorStop(1, '#1E3A8A');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.ellipse(4, -1, 13, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.ellipse(11, -3, 4, 3, 0, 0, Math.PI * 2);
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
      stageName: `${this.getTitleName()} · ${this.getZoneName()}`,
      primaryMetricLabel: 'Rings',
      primaryMetricValue: `${this.rings}`,
      secondaryMetricLabel:
        this.variant === 'sonic3' ? 'Hero / Shield' : this.superSonic ? 'Form' : 'Speed',
      secondaryMetricValue:
        this.variant === 'sonic3'
          ? `${this.hero.toUpperCase()} (${this.shield})`
          : this.superSonic
          ? 'SUPER!'
          : `${Math.round(Math.abs(this.pvx))}`,
      bannerText: '',
      canRestartStage: this.variant === 'sonic3',
    };
  }
}

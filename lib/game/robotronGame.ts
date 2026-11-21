import { arcadeAudio } from './audio';
import {
  ArcadeGameInstance,
  ArcadeInputState,
  ClassicGameHud,
  ClassicGamePhase,
  ScorePopup,
  SimpleParticle,
  createEmptyInput,
  getPrecisionMoveVector,
  readHighScore,
  renderCrtOverlay,
  renderParticlesAndPopups,
  saveHighScore,
  spawnBurst,
  stepParticlesAndPopups,
} from './classicArcadeInterface';

const LOGICAL_W = 600;
const LOGICAL_H = 520;
const ARENA_PAD = 28;
const TOP_HUD = 48;

type BotKind =
  | 'grunt'
  | 'hulk'
  | 'electrode'
  | 'spheroid'
  | 'enforcer'
  | 'quark'
  | 'tank'
  | 'brain'
  | 'prog';

interface RobotronBot {
  kind: BotKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  timer: number;
  spawnCount: number;
  alive: boolean;
}

interface FamilyHuman {
  name: 'MOMMY' | 'DADDY' | 'MIKEY';
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alive: boolean;
}

interface PlasmaShot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  fromPlayer: boolean;
  bounces: number;
  homing?: boolean;
  color: string;
}

export class RobotronArcadeGame implements ArcadeGameInstance {
  public readonly logicalWidth = LOGICAL_W;
  public readonly logicalHeight = LOGICAL_H;
  public readonly supportsPointerAim = true;
  public readonly primaryActionLabel = 'Plasma Fire';
  public readonly secondaryActionLabel = '8-Way Burst';

  private readonly storageKey = 'robotron_hd_highscore_v1';
  private phase: ClassicGamePhase = 'TITLE';
  private score = 0;
  private highScore = 0;
  private level = 1;
  private lives = 4;
  private input: ArcadeInputState = createEmptyInput();
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  private px = LOGICAL_W * 0.5;
  private py = (LOGICAL_H + TOP_HUD) * 0.5;
  private aimAngle = 0;
  private fireCooldown = 0;
  private burstCooldown = 0;
  private invuln = 0;
  private rescueStreak = 0;

  private bots: RobotronBot[] = [];
  private humans: FamilyHuman[] = [];
  private shots: PlasmaShot[] = [];
  private time = 0;
  private readyTimer = 0;
  private clearTimer = 0;

  constructor() {
    this.highScore = readHighScore(this.storageKey);
    this.buildWave(1);
  }

  public startNewGame(): void {
    this.score = 0;
    this.level = 1;
    this.lives = 4;
    this.particles = [];
    this.popups = [];
    this.buildWave(1);
    this.phase = 'READY';
    this.readyTimer = 1.0;
    arcadeAudio.playArcadeStart();
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.buildWave(1);
  }

  public restartStage(): void {
    if (this.phase === 'PLAYING' || this.phase === 'PAUSED') {
      this.buildWave(this.level);
      this.phase = 'READY';
      this.readyTimer = 0.85;
    }
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  private randomSafePos(): { x: number; y: number } {
    for (let tries = 0; tries < 25; tries++) {
      const x = ARENA_PAD + 20 + Math.random() * (LOGICAL_W - ARENA_PAD * 2 - 40);
      const y = TOP_HUD + 20 + Math.random() * (LOGICAL_H - TOP_HUD - ARENA_PAD - 40);
      if (Math.hypot(x - LOGICAL_W * 0.5, y - (LOGICAL_H + TOP_HUD) * 0.5) > 105) {
        return { x, y };
      }
    }
    return { x: ARENA_PAD + 30, y: TOP_HUD + 30 };
  }

  private addScore(pts: number, x: number, y: number, text?: string, color = '#FDE047'): void {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(this.storageKey, this.highScore);
    }
    this.popups.push({
      x,
      y,
      text: text ?? `+${pts}`,
      color,
      life: 0.9,
      maxLife: 0.9,
    });
  }

  private buildWave(wave: number): void {
    this.level = wave;
    this.px = LOGICAL_W * 0.5;
    this.py = (LOGICAL_H + TOP_HUD) * 0.5;
    this.invuln = 1.6;
    this.rescueStreak = 0;
    this.bots = [];
    this.humans = [];
    this.shots = [];

    const isBrainWave = wave % 5 === 0;
    const isHulkWave = wave % 4 === 3;

    // Last Human Family (Mommy, Daddy, Mikey)
    const famCount = isBrainWave ? 8 : Math.min(7, 3 + Math.floor(wave / 2));
    const names: Array<FamilyHuman['name']> = ['MOMMY', 'DADDY', 'MIKEY'];
    const colors = ['#F472B6', '#38BDF8', '#FDE047'];
    for (let i = 0; i < famCount; i++) {
      const p = this.randomSafePos();
      const a = Math.random() * Math.PI * 2;
      this.humans.push({
        name: names[i % 3],
        x: p.x,
        y: p.y,
        vx: Math.cos(a) * 28,
        vy: Math.sin(a) * 28,
        color: colors[i % 3],
        alive: true,
      });
    }

    // Grunts
    const grunts = isBrainWave ? 6 : Math.min(26, 10 + wave * 3);
    for (let i = 0; i < grunts; i++) {
      const p = this.randomSafePos();
      this.bots.push({ kind: 'grunt', x: p.x, y: p.y, vx: 0, vy: 0, timer: 0, spawnCount: 0, alive: true });
    }
    // Electrodes
    const electrodes = Math.min(12, 4 + wave);
    for (let i = 0; i < electrodes; i++) {
      const p = this.randomSafePos();
      this.bots.push({ kind: 'electrode', x: p.x, y: p.y, vx: 0, vy: 0, timer: 0, spawnCount: 0, alive: true });
    }
    // Indestructible Hulks (Wave 2+)
    const hulks = wave >= 2 ? Math.min(7, isHulkWave ? 5 : 2 + Math.floor(wave / 3)) : 0;
    for (let i = 0; i < hulks; i++) {
      const p = this.randomSafePos();
      this.bots.push({ kind: 'hulk', x: p.x, y: p.y, vx: 0, vy: 0, timer: 0, spawnCount: 0, alive: true });
    }
    // Spheroids -> Enforcers (Wave 2+)
    const spheroids = wave >= 2 ? Math.min(5, 1 + Math.floor(wave / 2)) : 0;
    for (let i = 0; i < spheroids; i++) {
      const p = this.randomSafePos();
      this.bots.push({
        kind: 'spheroid',
        x: p.x,
        y: p.y,
        vx: (Math.random() - 0.5) * 90,
        vy: (Math.random() - 0.5) * 90,
        timer: 2.0 + Math.random() * 1.4,
        spawnCount: 3,
        alive: true,
      });
    }
    // Quarks -> Tanks (Wave 4+)
    if (wave >= 4) {
      const quarks = Math.min(4, 1 + Math.floor((wave - 2) / 2));
      for (let i = 0; i < quarks; i++) {
        const p = this.randomSafePos();
        this.bots.push({
          kind: 'quark',
          x: p.x,
          y: p.y,
          vx: (Math.random() - 0.5) * 85,
          vy: (Math.random() - 0.5) * 85,
          timer: 2.4 + Math.random() * 1.4,
          spawnCount: 2,
          alive: true,
        });
      }
    }
    // Brains (Wave 5+)
    if (isBrainWave || wave >= 6) {
      const brains = isBrainWave ? 6 : 2;
      for (let i = 0; i < brains; i++) {
        const p = this.randomSafePos();
        this.bots.push({
          kind: 'brain',
          x: p.x,
          y: p.y,
          vx: 0,
          vy: 0,
          timer: 2.2 + Math.random(),
          spawnCount: 0,
          alive: true,
        });
      }
    }
  }

  private firePlasma(angle: number): void {
    this.shots.push({
      x: this.px + Math.cos(angle) * 12,
      y: this.py + Math.sin(angle) * 12,
      vx: Math.cos(angle) * 490,
      vy: Math.sin(angle) * 490,
      life: 0.95,
      fromPlayer: true,
      bounces: 0,
      color: '#38BDF8',
    });
    arcadeAudio.playLaser(1120, 420, 0.05);
  }

  private killPlayer(): void {
    if (this.invuln > 0) return;
    this.lives -= 1;
    this.rescueStreak = 0;
    arcadeAudio.playDeath();
    spawnBurst(this.particles, this.px, this.py, '#EC4899', 26, 230, 4.2);
    if (this.lives <= 0) {
      this.phase = 'GAME_OVER';
    } else {
      this.px = LOGICAL_W * 0.5;
      this.py = (LOGICAL_H + TOP_HUD) * 0.5;
      this.invuln = 2.1;
      // Push nearby enemies away on respawn
      for (const b of this.bots) {
        const d = Math.hypot(b.x - this.px, b.y - this.py);
        if (d < 110 && d > 0.1) {
          b.x = Math.max(ARENA_PAD + 12, Math.min(LOGICAL_W - ARENA_PAD - 12, this.px + ((b.x - this.px) / d) * 120));
          b.y = Math.max(TOP_HUD + 12, Math.min(LOGICAL_H - ARENA_PAD - 12, this.py + ((b.y - this.py) / d) * 120));
        }
      }
    }
  }

  public step(dt: number): void {
    this.time += dt;
    stepParticlesAndPopups(this.particles, this.popups, dt);
    if (this.phase === 'PAUSED') return;

    if (this.phase === 'TITLE') {
      // Animated neon arena preview
      this.aimAngle += dt * 2.2;
      for (const b of this.bots) {
        if (b.kind === 'grunt') {
          const a = Math.atan2(this.py - b.y, this.px - b.x) + Math.PI * 0.48;
          b.x = Math.max(ARENA_PAD + 10, Math.min(LOGICAL_W - ARENA_PAD - 10, b.x + Math.cos(a) * 32 * dt));
          b.y = Math.max(TOP_HUD + 10, Math.min(LOGICAL_H - ARENA_PAD - 10, b.y + Math.sin(a) * 32 * dt));
        }
      }
      return;
    }

    if (this.phase === 'READY') {
      this.readyTimer -= dt;
      if (this.readyTimer <= 0) this.phase = 'PLAYING';
      return;
    }

    if (this.phase === 'STAGE_CLEAR') {
      this.clearTimer -= dt;
      if (this.clearTimer <= 0) {
        this.buildWave(this.level + 1);
        this.phase = 'READY';
        this.readyTimer = 0.9;
      }
      return;
    }

    if (this.phase === 'GAME_OVER') return;

    if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);
    if (this.fireCooldown > 0) this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (this.burstCooldown > 0) this.burstCooldown = Math.max(0, this.burstCooldown - dt);

    // 8-way / Analog precision hero movement
    const mv = getPrecisionMoveVector(this.input);
    const spd = 205;
    this.px = Math.max(ARENA_PAD + 12, Math.min(LOGICAL_W - ARENA_PAD - 12, this.px + mv.vx * spd * dt));
    this.py = Math.max(TOP_HUD + 12, Math.min(LOGICAL_H - ARENA_PAD - 12, this.py + mv.vy * spd * dt));

    // Aiming: pointer twin-stick OR auto-aim nearest lethal robot!
    if (this.input.pointerActive) {
      const tx = this.input.pointerX * LOGICAL_W;
      const ty = this.input.pointerY * LOGICAL_H;
      this.aimAngle = Math.atan2(ty - this.py, tx - this.px);
    } else {
      let bestDist = 9999;
      let target: RobotronBot | null = null;
      for (const b of this.bots) {
        if (!b.alive || b.kind === 'electrode') continue;
        const d = Math.hypot(b.x - this.px, b.y - this.py);
        if (d < bestDist) {
          bestDist = d;
          target = b;
        }
      }
      if (target) this.aimAngle = Math.atan2(target.y - this.py, target.x - this.px);
      else if (Math.hypot(mv.vx, mv.vy) > 0.1) this.aimAngle = Math.atan2(mv.vy, mv.vx);
    }

    // Rapid twin-stick plasma stream
    if ((this.input.fire || this.input.pointerActive) && this.fireCooldown <= 0) {
      this.fireCooldown = 0.095;
      this.firePlasma(this.aimAngle);
    }

    // 8-Way Panic Burst (Shift/X)
    if (this.input.secondaryJustPressed && this.burstCooldown <= 0) {
      this.burstCooldown = 2.4;
      for (let i = 0; i < 8; i++) {
        this.firePlasma((i / 8) * Math.PI * 2);
      }
      arcadeAudio.playSmartBomb();
    }

    // Step Humans (Last Human Family rescue chain!)
    for (const h of this.humans) {
      if (!h.alive) continue;
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      if (h.x < ARENA_PAD + 14 || h.x > LOGICAL_W - ARENA_PAD - 14) h.vx = -h.vx;
      if (h.y < TOP_HUD + 14 || h.y > LOGICAL_H - ARENA_PAD - 14) h.vy = -h.vy;

      if (Math.hypot(h.x - this.px, h.y - this.py) < 22) {
        h.alive = false;
        this.rescueStreak = Math.min(5, this.rescueStreak + 1);
        const pts = this.rescueStreak * 1000;
        this.addScore(pts, h.x, h.y, `${h.name} +${pts}!`, '#FDE047');
        spawnBurst(this.particles, h.x, h.y, h.color, 16, 170, 3.6);
        arcadeAudio.playCoin();
      }
    }

    // Step Robotron Enemies
    const newBots: RobotronBot[] = [];
    for (const b of this.bots) {
      if (!b.alive) continue;

      if (b.kind === 'grunt' || b.kind === 'prog') {
        const ang = Math.atan2(this.py - b.y, this.px - b.x);
        const sp = b.kind === 'prog' ? 118 : 58 + Math.min(52, this.level * 5);
        b.x += Math.cos(ang) * sp * dt;
        b.y += Math.sin(ang) * sp * dt;
      } else if (b.kind === 'hulk') {
        // Indestructible Hulks stomp humans and roam slowly
        let tx = this.px;
        let ty = this.py;
        const aliveHuman = this.humans.find((h) => h.alive);
        if (aliveHuman) {
          tx = aliveHuman.x;
          ty = aliveHuman.y;
        }
        const ang = Math.atan2(ty - b.y, tx - b.x);
        b.x += Math.cos(ang) * 42 * dt;
        b.y += Math.sin(ang) * 42 * dt;
        if (aliveHuman && Math.hypot(aliveHuman.x - b.x, aliveHuman.y - b.y) < 18) {
          aliveHuman.alive = false;
          spawnBurst(this.particles, aliveHuman.x, aliveHuman.y, '#EF4444', 10, 120, 3);
        }
      } else if (b.kind === 'spheroid' || b.kind === 'quark') {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.x < ARENA_PAD + 16 || b.x > LOGICAL_W - ARENA_PAD - 16) b.vx = -b.vx;
        if (b.y < TOP_HUD + 16 || b.y > LOGICAL_H - ARENA_PAD - 16) b.vy = -b.vy;
        b.timer -= dt;
        if (b.timer <= 0 && b.spawnCount > 0) {
          b.timer = 2.6;
          b.spawnCount -= 1;
          newBots.push({
            kind: b.kind === 'spheroid' ? 'enforcer' : 'tank',
            x: b.x,
            y: b.y,
            vx: 0,
            vy: 0,
            timer: 1.4,
            spawnCount: 0,
            alive: true,
          });
        }
      } else if (b.kind === 'enforcer' || b.kind === 'tank') {
        const ang = Math.atan2(this.py - b.y, this.px - b.x);
        b.x += Math.cos(ang) * (b.kind === 'enforcer' ? 76 : 54) * dt;
        b.y += Math.sin(ang) * (b.kind === 'enforcer' ? 76 : 54) * dt;
        b.timer -= dt;
        if (b.timer <= 0) {
          b.timer = b.kind === 'enforcer' ? 1.8 : 2.1;
          this.shots.push({
            x: b.x,
            y: b.y,
            vx: Math.cos(ang) * 210,
            vy: Math.sin(ang) * 210,
            life: 2.6,
            fromPlayer: false,
            bounces: b.kind === 'tank' ? 2 : 0,
            color: b.kind === 'tank' ? '#FACC15' : '#FB7185',
          });
        }
      } else if (b.kind === 'brain') {
        // Seek nearest surviving human to reprogram into a Prog!
        const targetH = this.humans.find((h) => h.alive);
        const tx = targetH ? targetH.x : this.px;
        const ty = targetH ? targetH.y : this.py;
        const ang = Math.atan2(ty - b.y, tx - b.x);
        b.x += Math.cos(ang) * 66 * dt;
        b.y += Math.sin(ang) * 66 * dt;
        if (targetH && Math.hypot(targetH.x - b.x, targetH.y - b.y) < 20) {
          targetH.alive = false;
          newBots.push({
            kind: 'prog',
            x: targetH.x,
            y: targetH.y,
            vx: 0,
            vy: 0,
            timer: 0,
            spawnCount: 0,
            alive: true,
          });
          this.popups.push({
            x: targetH.x,
            y: targetH.y - 12,
            text: 'PROG MUTATION!',
            color: '#E879F9',
            life: 0.9,
            maxLife: 0.9,
          });
        }
        b.timer -= dt;
        if (b.timer <= 0) {
          b.timer = 2.6;
          const pa = Math.atan2(this.py - b.y, this.px - b.x);
          this.shots.push({
            x: b.x,
            y: b.y,
            vx: Math.cos(pa) * 155,
            vy: Math.sin(pa) * 155,
            life: 2.8,
            fromPlayer: false,
            bounces: 0,
            homing: true,
            color: '#C084FC',
          });
        }
      }

      // Keep inside bounds
      b.x = Math.max(ARENA_PAD + 10, Math.min(LOGICAL_W - ARENA_PAD - 10, b.x));
      b.y = Math.max(TOP_HUD + 10, Math.min(LOGICAL_H - ARENA_PAD - 10, b.y));

      // Contact with player
      if (Math.hypot(b.x - this.px, b.y - this.py) < 17) {
        this.killPlayer();
        return;
      }
    }
    if (newBots.length > 0) this.bots.push(...newBots);

    // Step Shots & Collisions
    for (const s of this.shots) {
      if (s.life <= 0) continue;
      if (s.homing) {
        const ang = Math.atan2(this.py - s.y, this.px - s.x);
        s.vx += Math.cos(ang) * 240 * dt;
        s.vy += Math.sin(ang) * 240 * dt;
        const m = Math.hypot(s.vx, s.vy) || 1;
        s.vx = (s.vx / m) * 165;
        s.vy = (s.vy / m) * 165;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;

      if (s.x < ARENA_PAD || s.x > LOGICAL_W - ARENA_PAD) {
        if (s.bounces > 0) {
          s.vx = -s.vx;
          s.bounces -= 1;
        } else {
          s.life = 0;
        }
      }
      if (s.y < TOP_HUD || s.y > LOGICAL_H - ARENA_PAD) {
        if (s.bounces > 0) {
          s.vy = -s.vy;
          s.bounces -= 1;
        } else {
          s.life = 0;
        }
      }

      if (s.life <= 0) continue;

      if (s.fromPlayer) {
        for (const b of this.bots) {
          if (!b.alive) continue;
          if (Math.hypot(b.x - s.x, b.y - s.y) < 16) {
            s.life = 0;
            if (b.kind === 'hulk') {
              // Indestructible Hulk knockback!
              const m = Math.hypot(s.vx, s.vy) || 1;
              b.x += (s.vx / m) * 14;
              b.y += (s.vy / m) * 14;
              spawnBurst(this.particles, b.x, b.y, '#4ADE80', 4, 90, 2);
              arcadeAudio.playRockThud();
            } else {
              b.alive = false;
              const ptsMap: Record<BotKind, number> = {
                grunt: 100,
                electrode: 50,
                hulk: 0,
                spheroid: 1000,
                enforcer: 150,
                quark: 1000,
                tank: 200,
                brain: 500,
                prog: 100,
              };
              const pts = ptsMap[b.kind];
              this.addScore(pts, b.x, b.y, pts >= 500 ? `+${pts}!` : `+${pts}`);
              spawnBurst(this.particles, b.x, b.y, '#EC4899', 10, 170, 3);
              arcadeAudio.playExplosion(false);
            }
            break;
          }
        }
      } else if (Math.hypot(s.x - this.px, s.y - this.py) < 13) {
        s.life = 0;
        this.killPlayer();
        return;
      }
    }
    this.shots = this.shots.filter((s) => s.life > 0);
    this.bots = this.bots.filter((b) => b.alive);

    // Wave Clear when every non-Hulk, non-Electrode Robotron is eliminated!
    const remainingTargets = this.bots.filter((b) => b.kind !== 'hulk' && b.kind !== 'electrode').length;
    if (remainingTargets === 0) {
      this.addScore(2000, LOGICAL_W * 0.5, LOGICAL_H * 0.45, `WAVE ${this.level} CLEAR!`, '#4ADE80');
      arcadeAudio.playStageClear();
      this.phase = 'STAGE_CLEAR';
      this.clearTimer = 1.6;
    }
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.save();
    ctx.scale(dpr, dpr);

    // Deep neon grid arena
    ctx.fillStyle = '#04060F';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // Subtle glowing arena floor grid
    ctx.strokeStyle = 'rgba(236, 72, 153, 0.08)';
    ctx.lineWidth = 1;
    for (let x = ARENA_PAD; x <= LOGICAL_W - ARENA_PAD; x += 36) {
      ctx.beginPath();
      ctx.moveTo(x, TOP_HUD);
      ctx.lineTo(x, LOGICAL_H - ARENA_PAD);
      ctx.stroke();
    }
    for (let y = TOP_HUD; y <= LOGICAL_H - ARENA_PAD; y += 36) {
      ctx.beginPath();
      ctx.moveTo(ARENA_PAD, y);
      ctx.lineTo(LOGICAL_W - ARENA_PAD, y);
      ctx.stroke();
    }

    // Electric magenta/cyan neon arena border
    ctx.strokeStyle = this.level % 5 === 0 ? '#C084FC' : '#EC4899';
    ctx.lineWidth = 4;
    ctx.strokeRect(ARENA_PAD, TOP_HUD, LOGICAL_W - ARENA_PAD * 2, LOGICAL_H - TOP_HUD - ARENA_PAD);

    // Top HUD
    ctx.font = '800 13px "JetBrains Mono", monospace';
    ctx.fillStyle = '#EC4899';
    ctx.textAlign = 'left';
    ctx.fillText(`ROBOTRON: 2084 · WAVE ${this.level}`, ARENA_PAD, 28);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#FDE047';
    ctx.fillText(`SCORE ${this.score.toLocaleString()}`, LOGICAL_W - ARENA_PAD, 28);

    // Draw Humans
    for (const h of this.humans) {
      if (!h.alive) continue;
      ctx.fillStyle = h.color;
      ctx.fillRect(h.x - 4, h.y - 6, 8, 12);
      ctx.fillStyle = '#FDE68A';
      ctx.beginPath();
      ctx.arc(h.x, h.y - 9, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Robotrons
    for (const b of this.bots) {
      ctx.save();
      ctx.translate(b.x, b.y);
      if (b.kind === 'grunt') {
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(-8, -9, 16, 18);
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(-5, -5, 4, 4);
        ctx.fillRect(1, -5, 4, 4);
      } else if (b.kind === 'hulk') {
        ctx.fillStyle = '#22C55E';
        ctx.fillRect(-12, -13, 24, 26);
        ctx.fillStyle = '#DC2626';
        ctx.fillRect(-7, -8, 14, 5);
      } else if (b.kind === 'electrode') {
        ctx.rotate(this.time * 5);
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(-7, -7, 14, 14);
      } else if (b.kind === 'spheroid') {
        ctx.strokeStyle = '#EC4899';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 10 + Math.sin(this.time * 10) * 2, 0, Math.PI * 2);
        ctx.stroke();
      } else if (b.kind === 'enforcer') {
        ctx.fillStyle = '#FB7185';
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(10, 8);
        ctx.lineTo(-10, 8);
        ctx.closePath();
        ctx.fill();
      } else if (b.kind === 'quark') {
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 3;
        ctx.strokeRect(-9, -9, 18, 18);
      } else if (b.kind === 'tank') {
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(-10, -8, 20, 16);
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (b.kind === 'brain') {
        ctx.fillStyle = '#C084FC';
        ctx.beginPath();
        ctx.arc(0, -2, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(-6, -4, 12, 4);
      } else if (b.kind === 'prog') {
        ctx.fillStyle = Math.floor(this.time * 16) % 2 === 0 ? '#E879F9' : '#FACC15';
        ctx.fillRect(-7, -10, 14, 20);
      }
      ctx.restore();
    }

    // Plasma Bolts
    for (const s of this.shots) {
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.fromPlayer ? 3.5 : 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player Hero
    if (this.invuln <= 0 || Math.floor(this.time * 16) % 2 === 0) {
      ctx.save();
      ctx.translate(this.px, this.py);
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(-6, -4, 12, 12);
      ctx.fillStyle = '#FDE047';
      ctx.beginPath();
      ctx.arc(0, -8, 5, 0, Math.PI * 2);
      ctx.fill();
      // Aim laser sight
      ctx.strokeStyle = 'rgba(56,189,248,0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(this.aimAngle) * 26, Math.sin(this.aimAngle) * 26);
      ctx.stroke();
      ctx.restore();
    }

    renderParticlesAndPopups(ctx, this.particles, this.popups);
    if (visualMode === 'crt') renderCrtOverlay(ctx, LOGICAL_W, LOGICAL_H);
    ctx.restore();
  }

  public getHudSnapshot(): ClassicGameHud {
    const aliveHumans = this.humans.filter((h) => h.alive).length;
    const targets = this.bots.filter((b) => b.kind !== 'hulk' && b.kind !== 'electrode').length;
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: Math.max(0, this.lives),
      stageName: `ROBOTRON · WAVE ${this.level}`,
      primaryMetricLabel: 'ROBOTS',
      primaryMetricValue: `${targets} LEFT`,
      secondaryMetricLabel: 'FAMILY',
      secondaryMetricValue: `${aliveHumans} ALIVE`,
      bannerText:
        this.phase === 'TITLE'
          ? 'ROBOTRON: 2084 — SAVE THE LAST HUMAN FAMILY'
          : this.phase === 'GAME_OVER'
          ? 'GAME OVER'
          : '',
      canRestartStage: true,
    };
  }
}

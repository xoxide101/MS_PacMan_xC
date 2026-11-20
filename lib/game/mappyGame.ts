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

type TreasureKind = 'radio' | 'tv' | 'computer' | 'painting' | 'safe';

interface Treasure {
  id: number;
  kind: TreasureKind;
  pts: number;
  x: number;
  floor: number; // 0 (bottom) .. 5 (top)
  collected: boolean;
}

interface Door {
  id: number;
  x: number;
  floor: number;
  isPower: boolean;
  open: boolean;
  openDir: 1 | -1;
  usedPower: boolean;
}

interface Trampoline {
  x: number;
  bounces: number; // 0=green, 1=blue, 2=yellow, 3=red, 4=broken
  broken: boolean;
  compress: number;
}

interface CatEnemy {
  id: number;
  isGoro: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  floor: number;
  inShaft: number | null;
  stunTimer: number;
  sweptDir: 0 | 1 | -1;
  hidingTreasureId: number | null;
}

interface MicrowaveBeam {
  x: number;
  y: number;
  floor: number;
  dir: 1 | -1;
  life: number;
}

const LOGICAL_W = 864;
const LOGICAL_H = 640;
const WORLD_W = 1440;
const HUD_TOP = 64;
const FLOOR_COUNT = 6;
const FLOOR_H = 88;
const BOTTOM_FLOOR_Y = LOGICAL_H - 44;

const TRAMPOLINE_XS = [160, 520, 920, 1280];
const SHAFT_HALF_W = 34;

function floorY(f: number): number {
  return BOTTOM_FLOOR_Y - f * FLOOR_H;
}

export class MappyGame implements ArcadeGameInstance {
  public readonly logicalWidth = LOGICAL_W;
  public readonly logicalHeight = LOGICAL_H;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'Slam Door';

  private storageKey = 'mappy_hd_highscore_v1';
  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();

  private score = 0;
  private highScore = 0;
  private nextExtraLife = 20000;
  private level = 1;
  private lives = 3;
  private clock = 0;
  private phaseTimer = 0;

  // Mappy police mouse
  private mx = 720;
  private my = BOTTOM_FLOOR_Y;
  private mVx = 0;
  private mVy = 0;
  private mFacing: 1 | -1 = 1;
  private mFloor = 0;
  private mInShaft: number | null = null;
  private invulnTimer = 0;
  private cameraX = 288;

  // Pair matching bonus tracker
  private lastTreasureKind: TreasureKind | null = null;
  private pairMultiplier = 1;

  private treasures: Treasure[] = [];
  private doors: Door[] = [];
  private trampolines: Trampoline[] = [];
  private cats: CatEnemy[] = [];
  private beams: MicrowaveBeam[] = [];
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  constructor() {
    this.highScore = readHighScore(this.storageKey);
    this.loadMansion(1);
    this.phase = 'TITLE';
  }

  private loadMansion(lvl: number): void {
    this.mx = 720;
    this.my = floorY(0);
    this.mFloor = 0;
    this.mVx = 0;
    this.mVy = 0;
    this.mInShaft = null;
    this.cameraX = Math.max(0, Math.min(WORLD_W - LOGICAL_W, this.mx - LOGICAL_W * 0.5));
    this.lastTreasureKind = null;
    this.pairMultiplier = 1;
    this.beams = [];

    // 4 vertical trampoline shafts
    this.trampolines = TRAMPOLINE_XS.map((x) => ({
      x,
      bounces: 0,
      broken: false,
      compress: 0,
    }));

    // 10 paired stolen treasures across the 6 floors
    const spec: Array<{ kind: TreasureKind; pts: number; f1: number; x1: number; f2: number; x2: number }> = [
      { kind: 'radio', pts: 100, f1: 1, x1: 310, f2: 1, x2: 1120 },
      { kind: 'tv', pts: 200, f1: 2, x1: 680, f2: 2, x2: 1080 },
      { kind: 'computer', pts: 300, f1: 3, x1: 340, f2: 3, x2: 760 },
      { kind: 'painting', pts: 400, f1: 4, x1: 320, f2: 4, x2: 1120 },
      { kind: 'safe', pts: 500, f1: 5, x1: 350, f2: 5, x2: 1090 },
    ];
    this.treasures = [];
    let tid = 1;
    for (const s of spec) {
      const shift = ((lvl - 1) * 40) % 120;
      this.treasures.push({ id: tid++, kind: s.kind, pts: s.pts, floor: s.f1, x: s.x1 + (shift % 60), collected: false });
      this.treasures.push({ id: tid++, kind: s.kind, pts: s.pts, floor: s.f2, x: s.x2 - (shift % 60), collected: false });
    }

    // Doors (regular & flashing Power Microwave Doors)
    const doorLayouts: Array<{ floor: number; x: number; isPower: boolean }> = [
      { floor: 1, x: 420, isPower: false },
      { floor: 1, x: 1020, isPower: true },
      { floor: 2, x: 600, isPower: true },
      { floor: 2, x: 840, isPower: false },
      { floor: 3, x: 420, isPower: true },
      { floor: 3, x: 1020, isPower: false },
      { floor: 4, x: 620, isPower: false },
      { floor: 4, x: 820, isPower: true },
      { floor: 5, x: 640, isPower: false },
      { floor: 5, x: 800, isPower: false },
    ];
    this.doors = doorLayouts.map((d, idx) => ({
      id: idx + 1,
      x: d.x,
      floor: d.floor,
      isPower: d.isPower,
      open: false,
      openDir: 1,
      usedPower: false,
    }));

    // Boss Big Goro + Meowky cats
    const meowkyCount = Math.min(7, 3 + lvl);
    this.cats = [
      {
        id: 1,
        isGoro: true,
        x: 720,
        y: floorY(5),
        vx: 115 + lvl * 8,
        vy: 0,
        floor: 5,
        inShaft: null,
        stunTimer: 0,
        sweptDir: 0,
        hidingTreasureId: null,
      },
    ];
    for (let i = 0; i < meowkyCount; i++) {
      const f = 2 + (i % 4);
      const cx = i % 2 === 0 ? 280 + i * 70 : 1140 - i * 70;
      this.cats.push({
        id: i + 2,
        isGoro: false,
        x: cx,
        y: floorY(f),
        vx: (i % 2 === 0 ? 1 : -1) * (105 + lvl * 9),
        vy: 0,
        floor: f,
        inShaft: null,
        stunTimer: 0,
        sweptDir: 0,
        hidingTreasureId: null,
      });
    }
  }

  public startNewGame(): void {
    this.score = 0;
    this.nextExtraLife = 20000;
    this.level = 1;
    this.lives = 3;
    this.particles = [];
    this.popups = [];
    this.loadMansion(1);
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
    this.loadMansion(1);
    this.phase = 'TITLE';
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
    if (this.score >= this.nextExtraLife) {
      this.nextExtraLife += 20000;
      this.lives = Math.min(6, this.lives + 1);
      arcadeAudio.playExtraLife();
      this.popups.push({ x: this.mx, y: this.my - 36, text: '1UP!', color: '#4ADE80', life: 1.1, maxLife: 1.1 });
    }
    if (wx !== undefined && wy !== undefined) {
      this.popups.push({ x: wx, y: wy, text: `${pts}`, color, life: 0.9, maxLife: 0.9 });
    }
  }

  private findShaftAt(x: number): number | null {
    for (let i = 0; i < TRAMPOLINE_XS.length; i++) {
      if (Math.abs(x - TRAMPOLINE_XS[i]) < SHAFT_HALF_W - 6) return i;
    }
    return null;
  }

  private loseLife(): void {
    if (this.invulnTimer > 0) return;
    arcadeAudio.playExplosion(false);
    spawnBurst(this.particles, this.mx, this.my - 14, '#38BDF8', 20, 200, 3.2);
    this.lives -= 1;
    if (this.lives <= 0) {
      this.phase = 'GAME_OVER';
      arcadeAudio.playDeath();
      return;
    }
    this.mx = 720;
    this.my = floorY(0);
    this.mFloor = 0;
    this.mInShaft = null;
    this.mVy = 0;
    this.invulnTimer = 2.4;
    for (const tr of this.trampolines) {
      tr.bounces = 0;
      tr.broken = false;
    }
  }

  public step(dt: number): void {
    this.clock += dt;
    stepParticlesAndPopups(this.particles, this.popups, dt);

    for (const tr of this.trampolines) {
      if (tr.compress > 0) tr.compress = Math.max(0, tr.compress - dt * 4.5);
    }

    if (this.phase === 'TITLE') {
      this.mx = 720 + Math.sin(this.clock * 0.9) * 320;
      this.cameraX = Math.max(0, Math.min(WORLD_W - LOGICAL_W, this.mx - LOGICAL_W * 0.5));
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
        this.loadMansion(this.level);
        this.phase = 'READY';
        this.phaseTimer = 1.1;
      }
      return;
    }

    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);

    // Mappy movement
    const runSpeed = 245;
    if (this.mInShaft === null) {
      // Running along a mansion floor
      let vx = 0;
      if (this.input.left && !this.input.right) {
        vx = -runSpeed;
        this.mFacing = -1;
      } else if (this.input.right && !this.input.left) {
        vx = runSpeed;
        this.mFacing = 1;
      }

      let nextX = Math.max(48, Math.min(WORLD_W - 48, this.mx + vx * dt));

      // Block against closed doors on current floor
      for (const d of this.doors) {
        if (d.floor === this.mFloor && !d.open) {
          if ((this.mx <= d.x && nextX > d.x - 14) || (this.mx >= d.x && nextX < d.x + 14)) {
            nextX = this.mx < d.x ? d.x - 14 : d.x + 14;
          }
        }
      }

      this.mx = nextX;
      this.my = floorY(this.mFloor);

      // Reset all trampoline bounce counts when safely standing on a solid floor!
      for (const tr of this.trampolines) {
        if (!tr.broken) tr.bounces = 0;
      }

      // Enter trampoline shaft?
      const shaftIdx = this.findShaftAt(this.mx);
      if (shaftIdx !== null && (this.mFloor > 0 || !this.trampolines[shaftIdx].broken)) {
        this.mInShaft = shaftIdx;
        this.mx = TRAMPOLINE_XS[shaftIdx];
        if (this.mFloor === 0) {
          // Bounce up right off the bottom trampoline!
          this.bounceOnTrampoline(shaftIdx);
        } else {
          this.mVy = 60;
        }
      }

      // Slam / open nearby door on Space!
      if (this.input.fireJustPressed) {
        this.trySlamDoor();
      }
    } else {
      // Airborne in trampoline shaft!
      const shaftIdx = this.mInShaft;
      const shaftX = TRAMPOLINE_XS[shaftIdx];
      this.mx = shaftX;
      this.mVy += 720 * dt;
      this.my += this.mVy * dt;

      // Top roof bounce
      const roofY = floorY(FLOOR_COUNT - 1) - 18;
      if (this.my < roofY) {
        this.my = roofY;
        this.mVy = Math.max(40, -this.mVy * 0.25);
      }

      // Steer left/right onto a floor while passing it!
      if ((this.input.left || this.input.right) && Math.abs(this.mVy) < 420) {
        for (let f = 0; f < FLOOR_COUNT; f++) {
          const fy = floorY(f);
          if (Math.abs(this.my - fy) < 19) {
            const dir = this.input.left ? -1 : 1;
            const exitX = shaftX + dir * (SHAFT_HALF_W + 6);
            if (exitX > 48 && exitX < WORLD_W - 48) {
              this.mInShaft = null;
              this.mFloor = f;
              this.my = fy;
              this.mx = exitX;
              this.mFacing = dir;
              this.mVy = 0;
              break;
            }
          }
        }
      }

      // Hit bottom trampoline
      if (this.mInShaft !== null && this.my >= floorY(0)) {
        const tr = this.trampolines[shaftIdx];
        if (tr.broken) {
          this.loseLife();
          return;
        }
        this.bounceOnTrampoline(shaftIdx);
      }
    }

    // Smooth camera
    const targetCam = Math.max(0, Math.min(WORLD_W - LOGICAL_W, this.mx - LOGICAL_W * 0.5));
    this.cameraX += (targetCam - this.cameraX) * Math.min(1, dt * 7);

    // Collect stolen treasures!
    for (const t of this.treasures) {
      if (t.collected) continue;
      if (this.mInShaft === null && t.floor === this.mFloor && Math.abs(this.mx - t.x) < 26) {
        t.collected = true;
        let pts = t.pts;
        let labelColor = '#FDE047';
        if (this.lastTreasureKind === t.kind) {
          this.pairMultiplier = Math.min(6, this.pairMultiplier + 1);
          pts = t.pts * this.pairMultiplier;
          labelColor = '#4ADE80';
          this.lastTreasureKind = null;
          arcadeAudio.playKeyUnlock();
          this.popups.push({ x: t.x, y: floorY(t.floor) - 42, text: `${this.pairMultiplier}× PAIR!`, color: '#4ADE80', life: 1.0, maxLife: 1.0 });
        } else {
          this.lastTreasureKind = t.kind;
          arcadeAudio.playEatFruit();
        }
        this.addScore(pts, t.x, floorY(t.floor) - 22, labelColor);
        spawnBurst(this.particles, t.x, floorY(t.floor) - 14, labelColor, 14, 160, 3);

        // Did Goro hide behind this treasure? +1,000 bonus!
        const goro = this.cats.find((c) => c.isGoro && c.hidingTreasureId === t.id);
        if (goro) {
          goro.hidingTreasureId = null;
          goro.stunTimer = 2.0;
          this.addScore(1000, t.x, floorY(t.floor) - 56, '#F472B6');
        }
      }
    }

    // Update microwave beams
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.x += b.dir * 680 * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -60 || b.x > WORLD_W + 60) {
        this.beams.splice(i, 1);
        continue;
      }
      for (const c of this.cats) {
        if (c.sweptDir === 0 && c.inShaft === null && c.floor === b.floor && Math.abs(c.x - b.x) < 34) {
          c.sweptDir = b.dir;
          const pts = c.isGoro ? 1000 : 400;
          this.addScore(pts, c.x, c.y - 24, '#38BDF8');
          arcadeAudio.playEatGhost();
        }
      }
    }

    // Update cats (Goro & Meowkies)
    for (const c of this.cats) {
      if (c.sweptDir !== 0) {
        c.x += c.sweptDir * 680 * dt;
        if (c.x < -80 || c.x > WORLD_W + 80) {
          // Respawn at mansion attic after being swept off screen
          c.sweptDir = 0;
          c.floor = 5;
          c.y = floorY(5);
          c.x = 720;
          c.inShaft = null;
          c.stunTimer = 1.4;
        }
        continue;
      }

      if (c.stunTimer > 0) {
        c.stunTimer = Math.max(0, c.stunTimer - dt);
        continue;
      }

      if (c.inShaft !== null) {
        c.vy += 680 * dt;
        c.y += c.vy * dt;
        if (c.y >= floorY(0)) {
          c.y = floorY(0);
          c.vy = -790;
        }
        // Exit onto Mappy's floor or a random floor
        const targetF = this.mFloor;
        const fy = floorY(targetF);
        if (Math.abs(c.y - fy) < 16 && Math.abs(c.vy) < 420) {
          const dir = this.mx >= c.x ? 1 : -1;
          const ex = TRAMPOLINE_XS[c.inShaft] + dir * (SHAFT_HALF_W + 6);
          if (ex > 60 && ex < WORLD_W - 60) {
            c.inShaft = null;
            c.floor = targetF;
            c.y = fy;
            c.x = ex;
            c.vx = dir * (c.isGoro ? 128 : 112 + this.level * 8);
          }
        }
      } else {
        c.x += c.vx * dt;
        c.y = floorY(c.floor);
        if (c.x < 56) {
          c.x = 56;
          c.vx = Math.abs(c.vx);
        } else if (c.x > WORLD_W - 56) {
          c.x = WORLD_W - 56;
          c.vx = -Math.abs(c.vx);
        }

        // Bounce off closed doors
        for (const d of this.doors) {
          if (d.floor === c.floor && !d.open && Math.abs(c.x - d.x) < 16) {
            c.vx = -c.vx;
            c.x += Math.sign(c.vx) * 6;
          }
        }

        // Enter trampoline shaft to chase Mappy vertically!
        const sh = this.findShaftAt(c.x);
        if (sh !== null && c.floor !== this.mFloor && !this.trampolines[sh].broken && Math.random() < 0.7) {
          c.inShaft = sh;
          c.x = TRAMPOLINE_XS[sh];
          c.vy = c.floor < this.mFloor ? -760 : 80;
        }

        // Goro occasionally peeks behind uncollected treasures
        if (c.isGoro && c.hidingTreasureId === null && Math.random() < dt * 0.25) {
          const nearT = this.treasures.find((t) => !t.collected && t.floor === c.floor && Math.abs(t.x - c.x) < 18);
          if (nearT) {
            c.hidingTreasureId = nearT.id;
            c.stunTimer = 1.6;
          }
        }
      }

      // Collision with Mappy (Mappy is SAFE while airborne in a shaft!)
      if (this.mInShaft === null && c.inShaft === null && c.floor === this.mFloor && c.hidingTreasureId === null) {
        if (Math.abs(c.x - this.mx) < 22) {
          this.loseLife();
          return;
        }
      }
    }

    // All 10 treasures collected -> Mansion Clear!
    if (this.treasures.every((t) => t.collected)) {
      this.addScore(2000 + this.level * 500, this.mx, this.my - 36, '#4ADE80');
      arcadeAudio.playStageClear();
      this.phase = 'STAGE_CLEAR';
      this.phaseTimer = 1.8;
    }
  }

  private bounceOnTrampoline(shaftIdx: number): void {
    const tr = this.trampolines[shaftIdx];
    tr.bounces += 1;
    tr.compress = 1.0;
    if (tr.bounces >= 4) {
      // 4th bounce on Red -> SNAP!
      tr.broken = true;
      arcadeAudio.playExplosion(false);
      this.popups.push({ x: tr.x, y: floorY(0) - 24, text: 'SNAP!', color: '#F43F5E', life: 0.9, maxLife: 0.9 });
      this.loseLife();
      return;
    }
    this.my = floorY(0) - 2;
    this.mVy = -845;
    arcadeAudio.playTrampolineBoing(tr.bounces);
  }

  private trySlamDoor(): void {
    let closest: Door | null = null;
    let bestD = 54;
    for (const d of this.doors) {
      if (d.floor === this.mFloor) {
        const dist = Math.abs(d.x - this.mx);
        if (dist < bestD) {
          bestD = dist;
          closest = d;
        }
      }
    }
    if (!closest) return;

    closest.open = !closest.open;
    closest.openDir = this.mx <= closest.x ? 1 : -1;

    if (closest.open) {
      // Stun any cat right behind door!
      for (const c of this.cats) {
        if (c.inShaft === null && c.floor === closest.floor && Math.abs(c.x - closest.x) < 48) {
          c.stunTimer = 2.2;
          c.x += closest.openDir * 28;
          this.addScore(100, c.x, c.y - 24, '#FDE047');
        }
      }

      // Flashing Power Door unleashes horizontal Microwave Beam!
      if (closest.isPower && !closest.usedPower) {
        closest.usedPower = true;
        this.beams.push({
          x: closest.x + closest.openDir * 16,
          y: floorY(closest.floor) - 20,
          floor: closest.floor,
          dir: closest.openDir,
          life: 2.2,
        });
        arcadeAudio.playMicrowave();
        spawnBurst(this.particles, closest.x, floorY(closest.floor) - 20, '#38BDF8', 18, 220, 3.2);
      } else {
        arcadeAudio.playDoorSlam();
      }
    } else {
      arcadeAudio.playDoorSlam();
    }
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.save();
    ctx.scale(dpr, dpr);

    // Rich Namco Mansion wallpaper background
    ctx.fillStyle = '#0A1024';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // World space transform
    ctx.save();
    ctx.translate(-this.cameraX, 0);

    // Mansion interior wall panels
    const wallGrad = ctx.createLinearGradient(0, HUD_TOP, 0, LOGICAL_H);
    wallGrad.addColorStop(0, '#132145');
    wallGrad.addColorStop(1, '#0C152F');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(36, HUD_TOP + 8, WORLD_W - 72, LOGICAL_H - HUD_TOP - 16);

    // Subtle striped wallpaper accents
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    for (let x = 52; x < WORLD_W - 52; x += 48) {
      ctx.fillRect(x, HUD_TOP + 8, 16, LOGICAL_H - HUD_TOP - 28);
    }

    // Draw dark vertical shafts first
    for (const sx of TRAMPOLINE_XS) {
      ctx.fillStyle = '#050814';
      ctx.fillRect(sx - SHAFT_HALF_W, HUD_TOP + 8, SHAFT_HALF_W * 2, BOTTOM_FLOOR_Y - HUD_TOP);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(sx - SHAFT_HALF_W, HUD_TOP + 8, SHAFT_HALF_W * 2, BOTTOM_FLOOR_Y - HUD_TOP);
    }

    // Draw 6 Mansion Floors (skipping over trampoline shafts)
    const floorColors = ['#F59E0B', '#EC4899', '#38BDF8', '#4ADE80', '#A855F7', '#F97316'];
    for (let f = 0; f < FLOOR_COUNT; f++) {
      const fy = floorY(f);
      const segments: Array<[number, number]> = [];
      let cur = 36;
      for (const sx of TRAMPOLINE_XS) {
        if (f > 0) {
          segments.push([cur, sx - SHAFT_HALF_W]);
          cur = sx + SHAFT_HALF_W;
        }
      }
      segments.push([cur, WORLD_W - 36]);

      for (const [x0, x1] of segments) {
        if (x1 <= x0) continue;
        ctx.fillStyle = floorColors[f % floorColors.length];
        ctx.fillRect(x0, fy, x1 - x0, 8);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(x0, fy + 8, x1 - x0, 5);
      }
    }

    // Draw Trampolines at bottom of shafts
    const trampColors = ['#22C55E', '#3B82F6', '#FACC15', '#EF4444'];
    for (const tr of this.trampolines) {
      const fy = floorY(0);
      if (tr.broken) {
        ctx.strokeStyle = '#64748B';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(tr.x - SHAFT_HALF_W + 4, fy + 4);
        ctx.lineTo(tr.x - 10, fy + 16);
        ctx.moveTo(tr.x + SHAFT_HALF_W - 4, fy + 4);
        ctx.lineTo(tr.x + 10, fy + 16);
        ctx.stroke();
      } else {
        const sag = tr.compress * 12;
        const col = trampColors[Math.min(3, tr.bounces)];
        ctx.strokeStyle = col;
        ctx.lineWidth = 5;
        ctx.shadowColor = col;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(tr.x - SHAFT_HALF_W + 4, fy + 2);
        ctx.quadraticCurveTo(tr.x, fy + 6 + sag, tr.x + SHAFT_HALF_W - 4, fy + 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }

    // Doors
    for (const d of this.doors) {
      const fy = floorY(d.floor);
      const activePower = d.isPower && !d.usedPower;
      const col = activePower
        ? `hsl(${(this.clock * 280) % 360}, 95%, 60%)`
        : '#E2E8F0';
      ctx.save();
      if (!d.open) {
        ctx.fillStyle = col;
        ctx.fillRect(d.x - 5, fy - 62, 10, 62);
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(d.x - 2, fy - 34, 4, 8);
      } else {
        // Swung open sideways
        ctx.fillStyle = 'rgba(226, 232, 240, 0.35)';
        ctx.fillRect(d.x + (d.openDir === 1 ? 0 : -26), fy - 62, 26, 6);
        ctx.fillStyle = col;
        ctx.fillRect(d.x + (d.openDir === 1 ? 22 : -28), fy - 62, 6, 62);
      }
      ctx.restore();
    }

    // Stolen Treasures
    for (const t of this.treasures) {
      if (t.collected) continue;
      this.drawTreasure(ctx, t);
    }

    // Microwave Sonic Beams
    for (const b of this.beams) {
      ctx.save();
      const grad = ctx.createLinearGradient(b.x - b.dir * 85, b.y, b.x + b.dir * 12, b.y);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0)');
      grad.addColorStop(0.5, '#38BDF8');
      grad.addColorStop(1, '#FDE047');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 10;
      ctx.beginPath();
      for (let k = 0; k <= 12; k++) {
        const px = b.x - b.dir * (k * 7);
        const py = b.y + Math.sin(this.clock * 35 + k * 0.9) * 14;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Cats (Boss Goro & Meowkies)
    for (const c of this.cats) {
      if (c.hidingTreasureId !== null) continue;
      this.drawCat(ctx, c);
    }

    // Mappy Police Mouse
    if (this.phase !== 'GAME_OVER') {
      const blink = this.invulnTimer > 0 && Math.floor(this.clock * 16) % 2 === 0;
      if (!blink) {
        this.drawMappy(ctx, this.mx, this.my);
      }
    }

    renderParticlesAndPopups(ctx, this.particles, this.popups);
    ctx.restore();

    // Top Mansion Minimap & HUD Strip
    this.drawTopHud(ctx);

    if (this.phase === 'READY' || this.phase === 'STAGE_CLEAR') {
      ctx.save();
      ctx.fillStyle = 'rgba(6, 10, 24, 0.78)';
      ctx.fillRect(LOGICAL_W * 0.5 - 175, LOGICAL_H * 0.5 - 34, 350, 68);
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2;
      ctx.strokeRect(LOGICAL_W * 0.5 - 175, LOGICAL_H * 0.5 - 34, 350, 68);
      ctx.font = '800 22px "Outfit", sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        this.phase === 'READY' ? `MANSION ROUND ${this.level}` : `MANSION ${this.level} CLEARED!`,
        LOGICAL_W * 0.5,
        LOGICAL_H * 0.5
      );
      ctx.restore();
    }

    if (visualMode === 'crt') {
      renderCrtOverlay(ctx, LOGICAL_W, LOGICAL_H);
    }
    ctx.restore();
  }

  private drawTreasure(ctx: CanvasRenderingContext2D, t: Treasure): void {
    const x = t.x;
    const y = floorY(t.floor) - 18;
    const highlight = this.lastTreasureKind === t.kind;
    ctx.save();
    ctx.translate(x, y);
    if (highlight) {
      ctx.shadowColor = '#4ADE80';
      ctx.shadowBlur = 14 + Math.sin(this.clock * 12) * 5;
    }

    if (t.kind === 'radio') {
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(-13, -10, 26, 20);
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.arc(-5, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FDE047';
      ctx.fillRect(3, -6, 7, 12);
    } else if (t.kind === 'tv') {
      ctx.fillStyle = '#6366F1';
      ctx.fillRect(-14, -12, 28, 22);
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(-10, -8, 15, 14);
      ctx.fillStyle = '#FDE047';
      ctx.fillRect(7, -6, 4, 4);
      ctx.fillRect(7, 1, 4, 4);
    } else if (t.kind === 'computer') {
      ctx.fillStyle = '#CBD5E1';
      ctx.fillRect(-13, -14, 26, 17);
      ctx.fillStyle = '#22C55E';
      ctx.fillRect(-9, -10, 18, 10);
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(-15, 3, 30, 7);
    } else if (t.kind === 'painting') {
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(-13, -16, 26, 28);
      ctx.fillStyle = '#0F766E';
      ctx.fillRect(-9, -12, 18, 20);
      ctx.fillStyle = '#FDE68A';
      ctx.beginPath();
      ctx.arc(0, -4, 4.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Safe
      ctx.fillStyle = '#475569';
      ctx.fillRect(-14, -15, 28, 28);
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2;
      ctx.strokeRect(-11, -12, 22, 22);
      ctx.beginPath();
      ctx.arc(0, -1, 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawMappy(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.translate(x, y - 16);
    ctx.scale(this.mFacing, 1);

    // Police blue uniform body
    ctx.fillStyle = '#2563EB';
    ctx.beginPath();
    ctx.roundRect(-9, -4, 18, 17, 5);
    ctx.fill();
    ctx.fillStyle = '#FACC15';
    ctx.fillRect(-3, 2, 6, 4); // Gold police badge

    // Mouse head & big ears
    ctx.fillStyle = '#93C5FD';
    ctx.beginPath();
    ctx.arc(-6, -15, 6.5, 0, Math.PI * 2);
    ctx.arc(5, -15, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FDE68A';
    ctx.beginPath();
    ctx.arc(1, -9, 9, 0, Math.PI * 2);
    ctx.fill();

    // Police cap
    ctx.fillStyle = '#1D4ED8';
    ctx.fillRect(-8, -19, 16, 5);
    ctx.fillStyle = '#FACC15';
    ctx.fillRect(0, -18, 4, 3);

    // Eye & nose
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(5, -10, 2, 0, Math.PI * 2);
    ctx.arc(10, -8, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawCat(ctx: CanvasRenderingContext2D, c: CatEnemy): void {
    ctx.save();
    ctx.translate(c.x, c.y - (c.isGoro ? 20 : 16));
    if (c.stunTimer > 0) {
      ctx.rotate(Math.sin(this.clock * 25) * 0.25);
    }

    const r = c.isGoro ? 15 : 11;
    const fur = c.isGoro ? '#F59E0B' : '#EC4899';

    // Pointy cat ears
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.moveTo(-r + 2, -r * 0.5);
    ctx.lineTo(-r + 6, -r - 7);
    ctx.lineTo(-2, -r * 0.7);
    ctx.moveTo(r - 2, -r * 0.5);
    ctx.lineTo(r - 6, -r - 7);
    ctx.lineTo(2, -r * 0.7);
    ctx.fill();

    // Body / head
    ctx.beginPath();
    ctx.arc(0, -2, r, 0, Math.PI * 2);
    ctx.fill();

    // Belly
    ctx.fillStyle = '#FEF3C7';
    ctx.beginPath();
    ctx.arc(0, 4, r * 0.55, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-4, -5, 3.2, 0, Math.PI * 2);
    ctx.arc(4, -5, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(-4, -5, 1.6, 0, Math.PI * 2);
    ctx.arc(4, -5, 1.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawTopHud(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#060A16';
    ctx.fillRect(0, 0, LOGICAL_W, HUD_TOP);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, HUD_TOP);
    ctx.lineTo(LOGICAL_W, HUD_TOP);
    ctx.stroke();

    // Mansion Minimap centered in top HUD
    const mapW = 360;
    const mapH = 44;
    const mapX = (LOGICAL_W - mapW) * 0.5;
    const mapY = 10;
    ctx.fillStyle = '#0B1328';
    ctx.fillRect(mapX, mapY, mapW, mapH);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.strokeRect(mapX, mapY, mapW, mapH);

    const sx = (wx: number) => mapX + (wx / WORLD_W) * mapW;
    const sy = (wy: number) => mapY + ((wy - HUD_TOP) / (LOGICAL_H - HUD_TOP)) * mapH;

    // Treasures on minimap
    ctx.fillStyle = '#FACC15';
    for (const t of this.treasures) {
      if (t.collected) continue;
      ctx.fillRect(sx(t.x) - 1.5, sy(floorY(t.floor)) - 3, 3, 3);
    }

    // Cats on minimap
    for (const c of this.cats) {
      ctx.fillStyle = c.isGoro ? '#F59E0B' : '#EC4899';
      ctx.fillRect(sx(c.x) - 2, sy(c.y) - 3, 4, 4);
    }

    // Mappy on minimap
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(sx(this.mx) - 2.5, sy(this.my) - 3.5, 5, 5);

    ctx.font = '700 13px "JetBrains Mono", monospace';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${this.score.toLocaleString()}`, 20, 36);

    const left = this.treasures.filter((t) => !t.collected).length;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#FACC15';
    ctx.fillText(`LOOT ${10 - left}/10 · ${this.pairMultiplier}×`, LOGICAL_W - 20, 36);
  }

  public getHudSnapshot(): ClassicGameHud {
    const collected = this.treasures.filter((t) => t.collected).length;
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: `Mappy · Mansion ${this.level}`,
      primaryMetricLabel: 'Loot Recovered',
      primaryMetricValue: `${collected}/10`,
      secondaryMetricLabel: 'Pair Bonus',
      secondaryMetricValue: `${this.pairMultiplier}×`,
      bannerText: '',
    };
  }
}

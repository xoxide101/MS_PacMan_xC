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

type GroundObjectKind = 'rocket' | 'fuel' | 'mystery' | 'core';

interface GroundObject {
  id: number;
  kind: GroundObjectKind;
  worldX: number;
  y: number;
  launched: boolean;
  vy: number;
  hp: number;
  alive: boolean;
}

interface AirHazard {
  kind: 'ufo' | 'fireball';
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  baseY: number;
}

interface LaserBolt {
  x: number;
  y: number;
  vx: number;
}

interface BombShot {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const SECTOR_NAMES = [
  '1 · MOUNTAINS',
  '2 · CAVERN',
  '3 · FIREBALLS',
  '4 · METROPOLIS',
  '5 · MAZE TUNNEL',
  '6 · BASE CORE',
];

const SECTOR_LEN = 1280;
const TOTAL_RUN_LEN = SECTOR_LEN * 6;

export class ScrambleArcadeGame implements ArcadeGameInstance {
  public readonly logicalWidth = 840;
  public readonly logicalHeight = 640;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'LASER + BOMB';
  public readonly secondaryActionLabel = 'DROP BOMB';

  private readonly storageKey = 'retro_arcade_scramble_hd_hs_v2';

  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();

  private score = 0;
  private highScore = 0;
  private loopLevel = 1;
  private lives = 3;
  private nextExtraLife = 15000;

  // Ship state
  private sx = 148;
  private sy = 250;
  private fuel = 100;
  private invulnTimer = 0;
  private laserCd = 0;
  private bombCd = 0;
  private lowFuelBeepCd = 0;

  // World scrolling state
  private scrollX = 0;
  private scrollSpeed = 148;
  private groundObjects: GroundObject[] = [];
  private airHazards: AirHazard[] = [];
  private lasers: LaserBolt[] = [];
  private bombs: BombShot[] = [];
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];
  private nextId = 1;
  private airSpawnCd = 1.1;
  private screenShake = 0;
  private clock = 0;
  private readyTimer = 0;
  private clearTimer = 0;

  constructor() {
    this.highScore = readHighScore(this.storageKey);
  }

  public startNewGame(): void {
    arcadeAudio.unlock();
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.loopLevel = 1;
    this.lives = 3;
    this.nextExtraLife = 15000;
    this.setupRun(1);
    this.phase = 'READY';
    this.readyTimer = 1.05;
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  private getSectorIndex(wx: number): number {
    return Math.max(0, Math.min(5, Math.floor(wx / SECTOR_LEN)));
  }

  private getFloorY(wx: number): number {
    const sec = this.getSectorIndex(wx);
    const local = wx % SECTOR_LEN;
    if (sec === 0) {
      // Jagged Mountains
      return 485 - Math.abs(Math.sin(wx * 0.0085)) * 125 - Math.sin(wx * 0.023) * 28;
    }
    if (sec === 1) {
      // Cavern floor
      return 495 - Math.sin(wx * 0.009) * 65 - Math.cos(wx * 0.021) * 24;
    }
    if (sec === 2) {
      // Volcanic ridge
      return 515 - Math.abs(Math.sin(wx * 0.011)) * 75;
    }
    if (sec === 3) {
      // Metropolis terraced skyscrapers
      const block = Math.floor(wx / 68);
      return 495 - ((block * 37) % 5) * 32;
    }
    if (sec === 4) {
      // Tight Maze Tunnel floor!
      const corridorMid = 305 + Math.sin(wx * 0.0095) * 110;
      return Math.min(545, corridorMid + 84);
    }
    // Sector 6: Armored Base Reactor Trench
    if (local > SECTOR_LEN - 280) return 495;
    return 505 - Math.sin(wx * 0.012) * 35;
  }

  private getCeilingY(wx: number): number {
    const sec = this.getSectorIndex(wx);
    if (sec === 0 || sec === 2 || sec === 3) return 54; // Open sky!
    if (sec === 1) {
      return 92 + Math.abs(Math.sin(wx * 0.0085)) * 88;
    }
    if (sec === 4) {
      const corridorMid = 305 + Math.sin(wx * 0.0095) * 110;
      return Math.max(66, corridorMid - 84);
    }
    // Sector 6: Base ceiling overhang
    return 104 + Math.sin(wx * 0.014) * 36;
  }

  private setupRun(loop: number): void {
    this.loopLevel = loop;
    this.scrollX = 0;
    this.scrollSpeed = 148 + (loop - 1) * 22;
    this.sx = 148;
    this.sy = 250;
    this.fuel = 100;
    this.invulnTimer = 1.6;
    this.groundObjects = [];
    this.airHazards = [];
    this.lasers = [];
    this.bombs = [];
    this.particles = [];
    this.popups = [];
    this.airSpawnCd = 1.0;

    // Populate authentic Rockets, FUEL Silos, ? Mystery Bases across sectors 1..5
    for (let wx = 340; wx < TOTAL_RUN_LEN - 340; wx += 92) {
      const sec = this.getSectorIndex(wx);
      const fy = this.getFloorY(wx);
      const cy = this.getCeilingY(wx);
      if (fy - cy < 118) continue; // Keep tight maze corridors flyable

      const roll = ((wx * 13) % 100) / 100;
      let kind: GroundObjectKind = 'rocket';
      if (roll < 0.34) kind = 'fuel';
      else if (sec >= 3 && roll < 0.56) kind = 'mystery';

      this.groundObjects.push({
        id: this.nextId++,
        kind,
        worldX: wx,
        y: fy,
        launched: false,
        vy: 0,
        hp: 1,
        alive: true,
      });
    }

    // Final Base Core Reactor at end of Sector 6!
    const coreX = TOTAL_RUN_LEN - 150;
    this.groundObjects.push({
      id: this.nextId++,
      kind: 'core',
      worldX: coreX,
      y: this.getFloorY(coreX),
      launched: false,
      vy: 0,
      hp: 3,
      alive: true,
    });
  }

  private addScore(pts: number, x?: number, y?: number, color = '#fde047', label?: string): void {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(this.storageKey, this.highScore);
    }
    if (this.score >= this.nextExtraLife) {
      this.lives = Math.min(5, this.lives + 1);
      this.nextExtraLife += 20000;
      arcadeAudio.playExtraLife();
    }
    if (x !== undefined && y !== undefined) {
      this.popups.push({
        x,
        y,
        text: label ?? `+${pts}`,
        color,
        life: 0.9,
        maxLife: 0.9,
      });
    }
  }

  private crashShip(reason: string): void {
    this.lives--;
    this.screenShake = 15;
    arcadeAudio.playExplosion(true);
    spawnBurst(this.particles, this.sx, this.sy, '#f97316', 28, 250, 4.2);
    spawnBurst(this.particles, this.sx, this.sy, '#fde047', 18, 190, 3.2);
    this.popups.push({
      x: this.sx,
      y: this.sy - 20,
      text: reason,
      color: '#f87171',
      life: 1.2,
      maxLife: 1.2,
    });

    if (this.lives <= 0) {
      this.phase = 'GAME_OVER';
    } else {
      // Rewind to start of current sector with full fuel!
      const sec = this.getSectorIndex(this.scrollX + this.sx);
      this.scrollX = Math.max(0, sec * SECTOR_LEN - 60);
      this.sx = 148;
      this.sy = (this.getCeilingY(this.scrollX + this.sx) + this.getFloorY(this.scrollX + this.sx)) * 0.5;
      this.fuel = 100;
      this.invulnTimer = 2.0;
      this.airHazards = [];
      this.lasers = [];
      this.bombs = [];
      this.phase = 'READY';
      this.readyTimer = 0.95;
    }
  }

  public step(dt: number): void {
    this.clock += dt;
    if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - dt * 28);
    stepParticlesAndPopups(this.particles, this.popups, dt);

    if (this.phase === 'TITLE' || this.phase === 'PAUSED' || this.phase === 'GAME_OVER') {
      if ((this.phase === 'TITLE' || this.phase === 'GAME_OVER') && this.input.fireJustPressed) {
        this.startNewGame();
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
        this.setupRun(this.loopLevel + 1);
        this.phase = 'READY';
        this.readyTimer = 1.1;
      }
      return;
    }

    if (this.invulnTimer > 0) this.invulnTimer -= dt;
    if (this.laserCd > 0) this.laserCd -= dt;
    if (this.bombCd > 0) this.bombCd -= dt;

    // Advance continuous scroll
    this.scrollX += this.scrollSpeed * dt;
    const shipWorldX = this.scrollX + this.sx;
    const curSec = this.getSectorIndex(shipWorldX);

    // Fuel consumption!
    this.fuel = Math.max(0, this.fuel - (3.8 + this.loopLevel * 0.45) * dt);
    if (this.fuel < 25) {
      this.lowFuelBeepCd -= dt;
      if (this.lowFuelBeepCd <= 0) {
        this.lowFuelBeepCd = 0.45;
        arcadeAudio.playUfoPing(true);
      }
    }
    if (this.fuel <= 0) {
      this.sy += 180 * dt; // Out of fuel: nose-dive!
    } else {
      const mv = getPrecisionMoveVector(this.input);
      this.sx += mv.vx * 245 * dt;
      this.sy += mv.vy * 245 * dt;
      this.sx = Math.max(64, Math.min(this.logicalWidth * 0.56, this.sx));
      this.sy = Math.max(60, Math.min(this.logicalHeight - 66, this.sy));
    }

    // Firing Lasers + Parabolic Bombs!
    if (this.input.fire && this.laserCd <= 0) {
      this.lasers.push({ x: this.sx + 24, y: this.sy, vx: 690 });
      this.laserCd = 0.14;
      arcadeAudio.playLaser(1140, 420, 0.06);
      // Also auto-drop a bomb on alternating rhythm if holding Fire so 1-button players can raid fuel silos seamlessly
      if (this.bombCd <= 0 && this.bombs.length < 2) {
        this.bombs.push({ x: this.sx + 6, y: this.sy + 10, vx: this.scrollSpeed * 0.85 + 75, vy: 42 });
        this.bombCd = 0.34;
      }
    }
    if ((this.input.secondary || this.input.secondaryJustPressed) && this.bombCd <= 0 && this.bombs.length < 3) {
      this.bombs.push({ x: this.sx + 6, y: this.sy + 10, vx: this.scrollSpeed * 0.85 + 75, vy: 42 });
      this.bombCd = 0.24;
      arcadeAudio.playThrow();
    }

    // Terrain collision check
    const ceilY = this.getCeilingY(shipWorldX);
    const floorY = this.getFloorY(shipWorldX);
    if (this.invulnTimer <= 0 && (this.sy - 11 <= ceilY || this.sy + 11 >= floorY)) {
      this.crashShip(this.fuel <= 0 ? 'OUT OF FUEL!' : 'CAVERN IMPACT!');
      return;
    }

    // Spawn sector-authentic Air Hazards (UFOs in Sector 2, Fireballs in Sector 3!)
    this.airSpawnCd -= dt;
    if (this.airSpawnCd <= 0 && (curSec === 1 || curSec === 2)) {
      this.airSpawnCd = curSec === 2 ? Math.max(0.32, 0.72 - this.loopLevel * 0.06) : Math.max(0.55, 1.05 - this.loopLevel * 0.08);
      const spawnWX = this.scrollX + this.logicalWidth + 30;
      const cY = this.getCeilingY(spawnWX) + 34;
      const fY = this.getFloorY(spawnWX) - 34;
      const y = cY + Math.random() * Math.max(30, fY - cY);
      this.airHazards.push({
        kind: curSec === 2 ? 'fireball' : 'ufo',
        x: this.logicalWidth + 28,
        y,
        vx: curSec === 2 ? -(255 + this.loopLevel * 24) : -(165 + this.loopLevel * 18),
        vy: curSec === 2 ? (Math.random() - 0.5) * 35 : 0,
        phase: Math.random() * Math.PI * 2,
        baseY: y,
      });
    }

    // Update Air Hazards
    for (let i = this.airHazards.length - 1; i >= 0; i--) {
      const a = this.airHazards[i];
      a.phase += dt * 5.2;
      a.x += a.vx * dt;
      if (a.kind === 'ufo') {
        a.y = a.baseY + Math.sin(a.phase) * 44;
      } else {
        a.y += a.vy * dt;
      }
      if (a.x < -40) {
        this.airHazards.splice(i, 1);
        continue;
      }
      if (this.invulnTimer <= 0 && Math.hypot(a.x - this.sx, a.y - this.sy) < 22) {
        this.crashShip(a.kind === 'fireball' ? 'FIREBALL HIT!' : 'UFO COLLISION!');
        return;
      }
    }

    // Update Ground Objects (Rockets launch vertically as ship nears!)
    for (const g of this.groundObjects) {
      if (!g.alive) continue;
      const screenX = g.worldX - this.scrollX;
      if (g.kind === 'rocket' && !g.launched && screenX < this.sx + 250 && screenX > this.sx - 20) {
        g.launched = true;
        g.vy = -(165 + this.loopLevel * 16);
      }
      if (g.launched) {
        g.y += g.vy * dt;
        if (g.y < -40) g.alive = false;
      }
      if (this.invulnTimer <= 0 && Math.abs(screenX - this.sx) < 22 && Math.abs(g.y - 14 - this.sy) < 24) {
        this.crashShip('ROCKET COLLISION!');
        return;
      }
    }

    // Update Lasers
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const l = this.lasers[i];
      l.x += l.vx * dt;
      const lwx = this.scrollX + l.x;
      if (l.x > this.logicalWidth + 20 || l.y <= this.getCeilingY(lwx) || l.y >= this.getFloorY(lwx)) {
        this.lasers.splice(i, 1);
        continue;
      }
      let hit = false;
      // Hit UFOs (Fireballs are indestructible in authentic Scramble!)
      for (let ai = this.airHazards.length - 1; ai >= 0; ai--) {
        const a = this.airHazards[ai];
        if (Math.hypot(a.x - l.x, a.y - l.y) < 18) {
          if (a.kind === 'ufo') {
            this.addScore(100, a.x, a.y, '#38bdf8');
            arcadeAudio.playExplosion(false);
            spawnBurst(this.particles, a.x, a.y, '#38bdf8', 12, 160, 3);
            this.airHazards.splice(ai, 1);
          } else {
            spawnBurst(this.particles, l.x, l.y, '#fde047', 4, 90, 2);
          }
          hit = true;
          break;
        }
      }
      if (hit) {
        this.lasers.splice(i, 1);
        continue;
      }
      // Hit Ground Objects
      for (const g of this.groundObjects) {
        if (!g.alive) continue;
        const gx = g.worldX - this.scrollX;
        if (Math.abs(gx - l.x) < 20 && Math.abs(g.y - 14 - l.y) < 22) {
          this.damageGroundObject(g, gx);
          hit = true;
          break;
        }
      }
      if (hit) this.lasers.splice(i, 1);
    }

    // Update Parabolic Bombs
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const b = this.bombs[i];
      b.x += b.vx * dt;
      b.vy += 420 * dt;
      b.y += b.vy * dt;
      const bwx = this.scrollX + b.x;

      let detonated = false;
      for (const g of this.groundObjects) {
        if (!g.alive) continue;
        const gx = g.worldX - this.scrollX;
        if (Math.abs(gx - b.x) < 26 && Math.abs(g.y - 12 - b.y) < 26) {
          this.damageGroundObject(g, gx);
          detonated = true;
          break;
        }
      }

      if (!detonated && (b.y >= this.getFloorY(bwx) || b.x > this.logicalWidth + 20)) {
        spawnBurst(this.particles, b.x, b.y, '#f97316', 6, 95, 2.4);
        detonated = true;
      }
      if (detonated) this.bombs.splice(i, 1);
    }

    // Auto-advance if player flies past end of Sector 6 without destroying core (classic loop!)
    if (this.scrollX > TOTAL_RUN_LEN - 200) {
      const core = this.groundObjects.find((g) => g.kind === 'core');
      if (core && core.alive) {
        // Loop back to Sector 6 approach until Core is destroyed!
        this.scrollX = SECTOR_LEN * 5 + 100;
      }
    }
  }

  private damageGroundObject(g: GroundObject, screenX: number): void {
    g.hp--;
    if (g.hp > 0) {
      arcadeAudio.playPowCycle();
      spawnBurst(this.particles, screenX, g.y - 20, '#38bdf8', 10, 140, 2.8);
      return;
    }
    g.alive = false;
    if (g.kind === 'fuel') {
      this.fuel = Math.min(100, this.fuel + 24);
      this.addScore(150, screenX, g.y - 24, '#4ade80', 'FUEL +150');
      arcadeAudio.playPowerUp();
      spawnBurst(this.particles, screenX, g.y - 14, '#4ade80', 14, 170, 3.2);
    } else if (g.kind === 'mystery') {
      const bonusTable = [100, 200, 300, 800];
      const pts = bonusTable[Math.floor(Math.random() * bonusTable.length)];
      this.addScore(pts, screenX, g.y - 26, '#f472b6', `? +${pts}`);
      arcadeAudio.playGemChime(3);
      spawnBurst(this.particles, screenX, g.y - 14, '#f472b6', 14, 170, 3.2);
    } else if (g.kind === 'rocket') {
      const pts = g.launched ? 80 : 50;
      this.addScore(pts, screenX, g.y - 20, '#fbbf24');
      arcadeAudio.playExplosion(false);
      spawnBurst(this.particles, screenX, g.y - 14, '#fb923c', 12, 160, 3);
    } else if (g.kind === 'core') {
      this.addScore(800 * this.loopLevel, screenX, g.y - 36, '#fde047', `BASE DESTROYED +${800 * this.loopLevel}!`);
      arcadeAudio.playDeathStarSupernova();
      this.screenShake = 20;
      spawnBurst(this.particles, screenX, g.y - 24, '#fde047', 42, 320, 4.8);
      spawnBurst(this.particles, screenX, g.y - 24, '#f97316', 36, 240, 4.2);
      this.phase = 'STAGE_CLEAR';
      this.clearTimer = 2.0;
    }
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.save();
    ctx.scale(dpr, dpr);

    if (this.screenShake > 0.2) {
      ctx.translate(
        (Math.random() - 0.5) * this.screenShake,
        (Math.random() - 0.5) * this.screenShake
      );
    }

    const sec = this.getSectorIndex(this.scrollX + this.sx);

    // Deep space / cavern sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, this.logicalHeight);
    const skyColors: Array<[string, string]> = [
      ['#04071a', '#150d26'],
      ['#06101f', '#0d2236'],
      ['#1a0707', '#330f0a'],
      ['#070d24', '#161b3a'],
      ['#06121c', '#0e2436'],
      ['#17061c', '#290c21'],
    ];
    sky.addColorStop(0, skyColors[sec][0]);
    sky.addColorStop(1, skyColors[sec][1]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);

    // Multi-layer parallax starfield
    for (let i = 0; i < 65; i++) {
      const depth = (i % 3) + 1;
      const sx = (((i * 197 - this.scrollX * (0.14 * depth)) % this.logicalWidth) + this.logicalWidth) % this.logicalWidth;
      const sy = 56 + ((i * 73) % (this.logicalHeight - 130));
      ctx.fillStyle = depth === 3 ? 'rgba(255,255,255,0.85)' : 'rgba(148, 163, 184, 0.5)';
      ctx.fillRect(sx, sy, depth === 3 ? 2.2 : 1.4, depth === 3 ? 2.2 : 1.4);
    }

    // Draw Ceiling & Floor Terrain Polygons
    this.renderTerrain(ctx, sec);

    // Draw Ground Objects (Rockets, FUEL tanks, ? Mystery Bases, Final Base Core)
    for (const g of this.groundObjects) {
      if (!g.alive) continue;
      const gx = g.worldX - this.scrollX;
      if (gx < -48 || gx > this.logicalWidth + 48) continue;
      this.renderGroundObject(ctx, g, gx);
    }

    // Draw Air Hazards (UFOs & Blazing Fireballs)
    for (const a of this.airHazards) {
      this.renderAirHazard(ctx, a);
    }

    // Draw Lasers & Parabolic Bombs
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3.5;
    for (const l of this.lasers) {
      ctx.beginPath();
      ctx.moveTo(l.x - 14, l.y);
      ctx.lineTo(l.x + 12, l.y);
      ctx.stroke();
    }
    for (const b of this.bombs) {
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, 6, 3.8, Math.atan2(b.vy, b.vx), 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Player Starfighter
    this.renderShip(ctx);

    renderParticlesAndPopups(ctx, this.particles, this.popups);

    // Classic Konami Top Sector Progress Map & Bottom Fuel Gauge!
    this.renderScrambleHudBar(ctx, sec);

    if (this.phase === 'TITLE') {
      this.renderTitleOverlay(ctx);
    } else if (this.phase === 'READY') {
      this.renderCenterBanner(ctx, SECTOR_NAMES[sec], `LOOP ${this.loopLevel} · RAID FUEL SILOS & DESTROY THE BASE CORE!`, '#38bdf8');
    } else if (this.phase === 'STAGE_CLEAR') {
      this.renderCenterBanner(ctx, 'BASE CORE DESTROYED!', `FLAG ${this.loopLevel} CAPTURED · ENTERING HIGHER VELOCITY LOOP!`, '#4ade80');
    } else if (this.phase === 'GAME_OVER') {
      this.renderCenterBanner(ctx, 'MISSION FAILED', `SCORE ${this.score.toLocaleString()} · PRESS SPACE TO LAUNCH`, '#f87171');
    } else if (this.phase === 'PAUSED') {
      this.renderCenterBanner(ctx, 'PAUSED', 'PRESS P TO RESUME FLIGHT', '#38bdf8');
    }

    if (visualMode === 'crt') {
      renderCrtOverlay(ctx, this.logicalWidth, this.logicalHeight);
    }
    ctx.restore();
  }

  private renderTerrain(ctx: CanvasRenderingContext2D, sec: number): void {
    const step = 12;
    const floorFill = ['#7c3f1c', '#1e4e5f', '#7f1d1d', '#334155', '#1e3a5f', '#4c1d4b'][sec];
    const rimStroke = ['#fbbf24', '#38bdf8', '#f97316', '#94a3b8', '#22d3ee', '#f472b6'][sec];

    // Floor polygon
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, this.logicalHeight);
    for (let x = 0; x <= this.logicalWidth + step; x += step) {
      ctx.lineTo(x, this.getFloorY(this.scrollX + x));
    }
    ctx.lineTo(this.logicalWidth, this.logicalHeight);
    ctx.closePath();
    ctx.fillStyle = floorFill;
    ctx.fill();
    ctx.strokeStyle = rimStroke;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Ceiling polygon (for Cavern, Maze, Base sectors)
    if (sec === 1 || sec === 4 || sec === 5) {
      ctx.beginPath();
      ctx.moveTo(0, 44);
      for (let x = 0; x <= this.logicalWidth + step; x += step) {
        ctx.lineTo(x, this.getCeilingY(this.scrollX + x));
      }
      ctx.lineTo(this.logicalWidth, 44);
      ctx.closePath();
      ctx.fillStyle = floorFill;
      ctx.fill();
      ctx.strokeStyle = rimStroke;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.restore();
  }

  private renderGroundObject(ctx: CanvasRenderingContext2D, g: GroundObject, x: number): void {
    ctx.save();
    ctx.translate(x, g.y);

    if (g.kind === 'fuel') {
      // Iconic glowing green/cyan FUEL silo!
      ctx.fillStyle = '#0f766e';
      ctx.strokeStyle = '#5eead4';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-14, -28, 28, 28, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fef08a';
      ctx.font = '900 8px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('FUEL', 0, -11);
    } else if (g.kind === 'mystery') {
      ctx.fillStyle = '#7e22ce';
      ctx.strokeStyle = '#f472b6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-14, -28, 28, 28, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 16px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('?', 0, -8);
    } else if (g.kind === 'rocket') {
      // Vertical ICBM Missile
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(0, -34);
      ctx.lineTo(8, -16);
      ctx.lineTo(8, 0);
      ctx.lineTo(-8, 0);
      ctx.lineTo(-8, -16);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(0, -34);
      ctx.lineTo(6, -22);
      ctx.lineTo(-6, -22);
      ctx.closePath();
      ctx.fill();
      if (g.launched) {
        ctx.fillStyle = '#fb923c';
        ctx.beginPath();
        ctx.moveTo(-5, 0);
        ctx.lineTo(0, 14 + Math.random() * 8);
        ctx.lineTo(5, 0);
        ctx.fill();
      }
    } else if (g.kind === 'core') {
      // Final Armored Base Core!
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 3;
      ctx.fillRect(-26, -44, 52, 44);
      ctx.strokeRect(-26, -44, 52, 44);
      const pulse = 0.6 + 0.4 * Math.sin(this.clock * 10);
      ctx.fillStyle = `rgba(244, 63, 94, ${pulse})`;
      ctx.beginPath();
      ctx.arc(0, -24, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('CORE', 0, -48);
    }
    ctx.restore();
  }

  private renderAirHazard(ctx: CanvasRenderingContext2D, a: AirHazard): void {
    ctx.save();
    ctx.translate(a.x, a.y);
    if (a.kind === 'ufo') {
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f472b6';
      ctx.beginPath();
      ctx.arc(0, -4, 7, Math.PI, 0);
      ctx.fill();
    } else {
      // Flaming Meteor Fireball!
      const grad = ctx.createRadialGradient(-4, 0, 2, 0, 0, 16);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.45, '#fde047');
      grad.addColorStop(1, '#ef4444');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      // Blazing tail
      ctx.fillStyle = 'rgba(249, 115, 22, 0.55)';
      ctx.beginPath();
      ctx.moveTo(4, -9);
      ctx.lineTo(30 + Math.random() * 10, 0);
      ctx.lineTo(4, 9);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  private renderShip(ctx: CanvasRenderingContext2D): void {
    if (this.invulnTimer > 0 && Math.floor(this.clock * 18) % 2 === 0) return;
    ctx.save();
    ctx.translate(this.sx, this.sy);

    // Thruster flame
    if (this.fuel > 0) {
      ctx.fillStyle = '#fb923c';
      ctx.beginPath();
      ctx.moveTo(-18, -5);
      ctx.lineTo(-30 - Math.random() * 10, 0);
      ctx.lineTo(-18, 5);
      ctx.closePath();
      ctx.fill();
    }

    // Classic Konami Jet Silhouette
    ctx.fillStyle = '#e2e8f0';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(4, -7);
    ctx.lineTo(-14, -12);
    ctx.lineTo(-18, -5);
    ctx.lineTo(-18, 6);
    ctx.lineTo(-8, 10);
    ctx.lineTo(14, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cockpit canopy
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.ellipse(4, -3, 7, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private renderScrambleHudBar(ctx: CanvasRenderingContext2D, sec: number): void {
    // Top Sector Progress Strip (authentic 1 2 3 4 5 BASE indicator)
    ctx.save();
    ctx.fillStyle = 'rgba(4, 8, 22, 0.9)';
    ctx.fillRect(0, 0, this.logicalWidth, 44);
    const barX = 110;
    const barW = this.logicalWidth - 220;
    const segW = barW / 6;
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i === sec ? '#f59e0b' : i < sec ? '#16a34a' : '#1e293b';
      ctx.fillRect(barX + i * segW + 2, 10, segW - 4, 22);
      ctx.fillStyle = i === sec ? '#0f172a' : '#cbd5e1';
      ctx.font = '800 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(i === 5 ? 'BASE' : `SEC ${i + 1}`, barX + i * segW + segW * 0.5, 21);
    }

    // Bottom Fuel Gauge Bar
    ctx.fillStyle = 'rgba(4, 8, 22, 0.92)';
    ctx.fillRect(0, this.logicalHeight - 40, this.logicalWidth, 40);
    ctx.fillStyle = this.fuel < 25 && Math.floor(this.clock * 10) % 2 === 0 ? '#ef4444' : '#fde047';
    ctx.font = '900 13px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('FUEL', 120, this.logicalHeight - 20);

    const fx = 175;
    const fw = 480;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(fx, this.logicalHeight - 28, fw, 16);
    ctx.fillStyle = this.fuel < 25 ? '#ef4444' : this.fuel < 50 ? '#f59e0b' : '#22c55e';
    ctx.fillRect(fx, this.logicalHeight - 28, fw * (this.fuel / 100), 16);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(fx, this.logicalHeight - 28, fw, 16);
    ctx.restore();
  }

  private renderTitleOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(4, 6, 18, 0.78)';
    ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
    const cx = this.logicalWidth * 0.5;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#38bdf8';
    ctx.font = '900 46px "JetBrains Mono", monospace';
    ctx.fillText('SCRAMBLE', cx, 200);
    ctx.fillStyle = '#fde047';
    ctx.font = '800 15px "JetBrains Mono", monospace';
    ctx.fillText('1981 KONAMI · 6-SECTOR CONTINUOUS CAVERN RAID', cx, 242);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 14px "JetBrains Mono", monospace';
    ctx.fillText('MOUNTAINS · CAVERN · FIREBALLS · METROPOLIS · MAZE · BASE CORE', cx, 310);
    ctx.fillText('BOMB GREEN FUEL SILOS TO STAY AIRBORNE · DESTROY ? MYSTERY BASES', cx, 342);
    ctx.fillText('SPACE: LASER + AUTO-BOMB · SHIFT / X: RAPID PARABOLIC BOMBS', cx, 374);
    const pulse = 0.65 + 0.35 * Math.sin(this.clock * 6);
    ctx.fillStyle = `rgba(253, 224, 71, ${pulse})`;
    ctx.font = '900 20px "JetBrains Mono", monospace';
    ctx.fillText('PRESS SPACE TO SCRAMBLE JETS', cx, 458);
  }

  private renderCenterBanner(ctx: CanvasRenderingContext2D, title: string, sub: string, color: string): void {
    ctx.save();
    ctx.fillStyle = 'rgba(5, 8, 22, 0.85)';
    ctx.beginPath();
    ctx.roundRect(110, 250, this.logicalWidth - 220, 128, 14);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.font = '900 28px "JetBrains Mono", monospace';
    ctx.fillText(title, this.logicalWidth * 0.5, 298);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 13px "JetBrains Mono", monospace';
    ctx.fillText(sub, this.logicalWidth * 0.5, 342);
    ctx.restore();
  }

  public getHudSnapshot(): ClassicGameHud {
    const sec = this.getSectorIndex(this.scrollX + this.sx);
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.loopLevel,
      lives: this.lives,
      stageName: SECTOR_NAMES[sec],
      primaryMetricLabel: 'FUEL',
      primaryMetricValue: `${Math.ceil(this.fuel)}%`,
      secondaryMetricLabel: 'LOOP',
      secondaryMetricValue: `FLAG ${this.loopLevel}`,
      bannerText: `${SECTOR_NAMES[sec]} · WATCH YOUR FUEL GAUGE!`,
    };
  }
}

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

export type MissileQixVariant = 'missilecommand' | 'qix';

interface EnemyMissile {
  sx: number;
  sy: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  vx: number;
  vy: number;
  splitAtY?: number;
}

interface PlayerMissile {
  sx: number;
  sy: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  vx: number;
  vy: number;
}

interface Blast {
  x: number;
  y: number;
  r: number;
  maxR: number;
  growing: boolean;
}

interface BomberCraft {
  x: number;
  y: number;
  vx: number;
  isSatellite: boolean;
  dropCd: number;
}

interface QixEntity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  history: Array<{ x1: number; y1: number; x2: number; y2: number }>;
}

interface SparxEnemy {
  gx: number;
  gy: number;
  dir: number; // 0 right, 1 down, 2 left, 3 up
  superMode: boolean;
  moveAcc: number;
}

export class MissileQixGame implements ArcadeGameInstance {
  public readonly logicalWidth = 720;
  public readonly logicalHeight = 580;
  public readonly supportsPointerAim: boolean;
  public readonly primaryActionLabel: string;
  public readonly secondaryActionLabel: string;

  private readonly variant: MissileQixVariant;
  private readonly storageKey: string;
  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();

  private score = 0;
  private highScore = 0;
  private level = 1;
  private lives = 3;
  private clock = 0;
  private stateTimer = 0;

  // Missile Command state
  private aimX = 360;
  private aimY = 260;
  private cities: Array<{ x: number; alive: boolean }> = [];
  private silos: Array<{ x: number; ammo: number; fast: boolean }> = [];
  private enemyMissiles: EnemyMissile[] = [];
  private playerMissiles: PlayerMissile[] = [];
  private blasts: Blast[] = [];
  private bomber: BomberCraft | null = null;
  private bomberCd = 6.0;
  private waveMissilesLeft = 14;
  private spawnCd = 0.8;
  private nextBonusCityScore = 10000;

  // Qix authentic state (grid + Fuse + perimeter-hugging Sparx + Split-Qix!)
  private readonly cols = 48;
  private readonly rows = 36;
  private readonly cell = 13;
  private readonly ox = 48;
  private readonly oy = 56;
  // 0 = unclaimed, 1 = claimed border/solid, 2 = active Stix trail
  private qGrid: number[][] = [];
  private qx = 24;
  private qy = 35;
  private drawing = false;
  private slowDraw = false;
  private trail: Array<{ x: number; y: number }> = [];
  private fuseActive = false;
  private fuseIdx = 0;
  private fuseTimer = 0;
  private idleDrawTimer = 0;
  private qMoveCd = 0;
  private claimedPct = 0;
  private qixList: QixEntity[] = [];
  private sparx: SparxEnemy[] = [];
  private qixMult = 1;

  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  constructor(variant: MissileQixVariant) {
    this.variant = variant;
    this.storageKey = `${variant}_hd_highscore_v2`;
    this.highScore = readHighScore(this.storageKey);
    this.supportsPointerAim = variant === 'missilecommand';
    this.primaryActionLabel = variant === 'missilecommand' ? 'Fire ABM' : 'Fast Draw';
    this.secondaryActionLabel = variant === 'missilecommand' ? 'Center Silo' : 'Slow Draw (2×)';
    this.initCities();
    this.setupWave(1);
  }

  private initCities(): void {
    const xs = [138, 210, 282, 438, 510, 582];
    this.cities = xs.map((x) => ({ x, alive: true }));
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public startNewGame(): void {
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.nextBonusCityScore = 10000;
    this.qixMult = 1;
    this.initCities();
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
    this.initCities();
    this.setupWave(1);
  }

  private addScore(pts: number, x?: number, y?: number, label?: string): void {
    this.score += pts;
    if (this.variant === 'missilecommand' && this.score >= this.nextBonusCityScore) {
      this.nextBonusCityScore += 10000;
      const deadCity = this.cities.find((c) => !c.alive);
      if (deadCity) {
        deadCity.alive = true;
        arcadeAudio.playExtraLife();
        this.popups.push({ x: deadCity.x, y: 470, text: 'BONUS CITY!', color: '#4ADE80', life: 1.3, maxLife: 1.3 });
      }
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
        life: 0.9,
        maxLife: 0.9,
      });
    }
  }

  private setupWave(lvl: number): void {
    if (this.variant === 'missilecommand') {
      this.silos = [
        { x: 64, ammo: 10, fast: false },
        { x: 360, ammo: 10, fast: true },
        { x: 656, ammo: 10, fast: false },
      ];
      this.enemyMissiles = [];
      this.playerMissiles = [];
      this.blasts = [];
      this.bomber = null;
      this.bomberCd = Math.max(3.5, 7.5 - lvl * 0.5);
      this.waveMissilesLeft = 10 + lvl * 4;
      this.spawnCd = 0.6;
      return;
    }

    // Qix Board Setup
    this.qGrid = Array.from({ length: this.rows }, (_, r) =>
      Array.from({ length: this.cols }, (__, c) => (r === 0 || r === this.rows - 1 || c === 0 || c === this.cols - 1 ? 1 : 0)),
    );
    this.qx = Math.floor(this.cols / 2);
    this.qy = this.rows - 1;
    this.drawing = false;
    this.trail = [];
    this.fuseActive = false;
    this.idleDrawTimer = 0;
    this.claimedPct = 0;

    // Authentic Split-Qix (2 Qix on Level 3+!)
    const qCount = lvl >= 3 ? 2 : 1;
    this.qixList = [];
    for (let i = 0; i < qCount; i++) {
      this.qixList.push({
        x: this.ox + (14 + i * 18) * this.cell,
        y: this.oy + (12 + i * 8) * this.cell,
        vx: (i % 2 === 0 ? 1 : -1) * (115 + lvl * 12),
        vy: (i % 2 === 0 ? -1 : 1) * (105 + lvl * 12),
        color: i === 0 ? '#F472B6' : '#38BDF8',
        history: [],
      });
    }
    this.sparx = [
      { gx: 0, gy: 0, dir: 0, superMode: false, moveAcc: 0 },
      { gx: this.cols - 1, gy: 0, dir: 2, superMode: false, moveAcc: 0 },
    ];
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

    if (this.variant === 'missilecommand') {
      this.stepMissileCommand(dt, this.phase === 'TITLE');
    } else {
      this.stepQix(dt, this.phase === 'TITLE');
    }
  }

  // ============================================================================
  // MISSILE COMMAND (1980 Atari — 3 Silos, Bomber/Satellite, MIRVs, Multiplier!)
  // ============================================================================
  private stepMissileCommand(dt: number, attract: boolean): void {
    const waveMult = Math.min(6, Math.ceil(this.level / 2));

    if (attract) {
      this.aimX = 360 + Math.sin(this.clock * 1.4) * 230;
      this.aimY = 230 + Math.cos(this.clock * 1.1) * 110;
    } else if (this.input.pointerActive) {
      this.aimX = Math.max(20, Math.min(this.logicalWidth - 20, this.input.pointerX));
      this.aimY = Math.max(30, Math.min(480, this.input.pointerY));
    } else {
      const spd = 390;
      if (this.input.left) this.aimX -= spd * dt;
      if (this.input.right) this.aimX += spd * dt;
      if (this.input.up) this.aimY -= spd * dt;
      if (this.input.down) this.aimY += spd * dt;
      this.aimX = Math.max(20, Math.min(this.logicalWidth - 20, this.aimX));
      this.aimY = Math.max(30, Math.min(480, this.aimY));
    }

    // Fire ABM from closest available silo (or Center high-speed silo via Secondary!)
    const wantFire = attract ? Math.sin(this.clock * 3.5) > 0.92 : this.input.fireJustPressed || this.input.secondaryJustPressed;
    if (wantFire) {
      let chosen = this.input.secondaryJustPressed && this.silos[1].ammo > 0 ? this.silos[1] : null;
      if (!chosen) {
        let bestD = 9999;
        for (const s of this.silos) {
          if (s.ammo <= 0) continue;
          const d = Math.abs(s.x - this.aimX);
          if (d < bestD) {
            bestD = d;
            chosen = s;
          }
        }
      }
      if (chosen) {
        chosen.ammo -= 1;
        const speed = chosen.fast ? 580 : 410;
        const dx = this.aimX - chosen.x;
        const dy = this.aimY - 515;
        const len = Math.hypot(dx, dy) || 1;
        this.playerMissiles.push({
          sx: chosen.x,
          sy: 515,
          x: chosen.x,
          y: 515,
          tx: this.aimX,
          ty: this.aimY,
          vx: (dx / len) * speed,
          vy: (dy / len) * speed,
        });
        if (!attract) arcadeAudio.playLaser();
      }
    }

    // Spawn incoming ICBMs & MIRVs
    this.spawnCd -= dt;
    if (this.spawnCd <= 0 && this.waveMissilesLeft > 0) {
      this.spawnCd = Math.max(0.45, 1.45 - this.level * 0.09);
      const count = Math.min(this.waveMissilesLeft, Math.random() < 0.35 ? 2 : 1);
      for (let k = 0; k < count; k++) {
        this.waveMissilesLeft -= 1;
        this.spawnEnemyMissile(40 + Math.random() * (this.logicalWidth - 80), 0, this.level >= 2 && Math.random() < 0.28);
      }
    }

    // Authentic Bomber Plane & Killer Satellite!
    if (!this.bomber && this.waveMissilesLeft > 2) {
      this.bomberCd -= dt;
      if (this.bomberCd <= 0) {
        const fromLeft = Math.random() < 0.5;
        this.bomber = {
          x: fromLeft ? -25 : this.logicalWidth + 25,
          y: 95 + Math.random() * 140,
          vx: (fromLeft ? 1 : -1) * (88 + this.level * 8),
          isSatellite: this.level >= 2 && Math.random() < 0.5,
          dropCd: 1.6,
        };
        this.bomberCd = 8.5;
      }
    } else if (this.bomber) {
      this.bomber.x += this.bomber.vx * dt;
      this.bomber.dropCd -= dt;
      if (this.bomber.dropCd <= 0 && this.bomber.x > 60 && this.bomber.x < this.logicalWidth - 60) {
        this.bomber.dropCd = 1.9;
        this.spawnEnemyMissile(this.bomber.x, this.bomber.y, false);
      }
      if (this.bomber.x < -40 || this.bomber.x > this.logicalWidth + 40) {
        this.bomber = null;
      }
    }

    // Update player ABMs
    for (let i = this.playerMissiles.length - 1; i >= 0; i--) {
      const m = this.playerMissiles[i];
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (Math.hypot(m.x - m.tx, m.y - m.ty) < 14 || m.y <= m.ty) {
        this.blasts.push({ x: m.tx, y: m.ty, r: 6, maxR: 48, growing: true });
        if (!attract) arcadeAudio.playExplosion(false);
        this.playerMissiles.splice(i, 1);
      }
    }

    // Update blasts
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      const b = this.blasts[i];
      if (b.growing) {
        b.r += 95 * dt;
        if (b.r >= b.maxR) b.growing = false;
      } else {
        b.r -= 62 * dt;
        if (b.r <= 2) {
          this.blasts.splice(i, 1);
          continue;
        }
      }
      if (this.bomber && Math.hypot(this.bomber.x - b.x, this.bomber.y - b.y) < b.r + 16) {
        spawnBurst(this.particles, this.bomber.x, this.bomber.y, '#FACC15', 20, 220, 3.4);
        if (!attract) {
          arcadeAudio.playExplosion(true);
          this.addScore(100 * waveMult, this.bomber.x, this.bomber.y, this.bomber.isSatellite ? 'SATELLITE' : 'BOMBER');
        }
        this.bomber = null;
      }
      for (let j = this.enemyMissiles.length - 1; j >= 0; j--) {
        const em = this.enemyMissiles[j];
        if (Math.hypot(em.x - b.x, em.y - b.y) < b.r + 4) {
          this.blasts.push({ x: em.x, y: em.y, r: 8, maxR: 34, growing: true });
          if (!attract) this.addScore(25 * waveMult, em.x, em.y);
          this.enemyMissiles.splice(j, 1);
        }
      }
    }

    // Update enemy ICBMs & MIRV splitting!
    for (let i = this.enemyMissiles.length - 1; i >= 0; i--) {
      const em = this.enemyMissiles[i];
      em.x += em.vx * dt;
      em.y += em.vy * dt;
      if (em.splitAtY && em.y >= em.splitAtY) {
        em.splitAtY = undefined;
        this.spawnEnemyMissile(em.x, em.y, false);
        this.spawnEnemyMissile(em.x, em.y, false);
      }
      if (em.y >= 518) {
        this.blasts.push({ x: em.x, y: 518, r: 8, maxR: 36, growing: true });
        if (!attract) {
          arcadeAudio.playExplosion(true);
          for (const c of this.cities) {
            if (c.alive && Math.abs(c.x - em.x) < 34) c.alive = false;
          }
          for (const s of this.silos) {
            if (Math.abs(s.x - em.x) < 32) s.ammo = 0;
          }
        }
        this.enemyMissiles.splice(i, 1);
      }
    }

    if (!attract && this.cities.every((c) => !c.alive)) {
      arcadeAudio.playDeath();
      this.phase = 'GAME_OVER';
      return;
    }

    if (!attract && this.waveMissilesLeft <= 0 && this.enemyMissiles.length === 0 && this.blasts.length === 0) {
      const aliveCities = this.cities.filter((c) => c.alive).length;
      const unusedAmmo = this.silos.reduce((a, s) => a + s.ammo, 0);
      const bonus = (aliveCities * 100 + unusedAmmo * 5) * waveMult;
      this.addScore(bonus, this.logicalWidth * 0.5, 250, `WAVE BONUS (${waveMult}×)`);
      arcadeAudio.playStageClear();
      this.phase = 'STAGE_CLEAR';
      this.stateTimer = 1.65;
    }
  }

  private spawnEnemyMissile(sx: number, sy: number, mirv: boolean): void {
    const aliveTargets = [
      ...this.cities.filter((c) => c.alive).map((c) => c.x),
      ...this.silos.map((s) => s.x),
    ];
    const tx = aliveTargets[Math.floor(Math.random() * aliveTargets.length)] ?? 360;
    const ty = 520;
    const speed = 54 + this.level * 11 + Math.random() * 20;
    const dx = tx - sx;
    const dy = ty - sy;
    const len = Math.hypot(dx, dy) || 1;
    this.enemyMissiles.push({
      sx,
      sy,
      x: sx,
      y: sy,
      tx,
      ty,
      vx: (dx / len) * speed,
      vy: (dy / len) * speed,
      splitAtY: mirv ? 150 + Math.random() * 140 : undefined,
    });
  }

  // ============================================================================
  // QIX (1981 Taito — Fast/Slow Draw, Burning Fuse, Perimeter Sparx, Split-Qix!)
  // ============================================================================
  private isBorderCell(gx: number, gy: number): boolean {
    if (this.qGrid[gy]?.[gx] !== 1) return false;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = gx + dx;
      const ny = gy + dy;
      if (nx < 0 || nx >= this.cols || ny < 0 || ny >= this.rows || this.qGrid[ny][nx] === 0) return true;
    }
    return false;
  }

  private failQixMarker(reason: string): void {
    // Erase unfinished trail and return marker to start of trail
    for (const pt of this.trail) {
      if (this.qGrid[pt.y][pt.x] === 2) this.qGrid[pt.y][pt.x] = 0;
    }
    if (this.trail.length > 0) {
      this.qx = this.trail[0].x;
      this.qy = this.trail[0].y;
    }
    this.trail = [];
    this.drawing = false;
    this.fuseActive = false;
    this.lives -= 1;
    arcadeAudio.playDeath();
    this.popups.push({
      x: this.ox + this.qx * this.cell,
      y: this.oy + this.qy * this.cell - 16,
      text: reason,
      color: '#EF4444',
      life: 1.0,
      maxLife: 1.0,
    });
    if (this.lives <= 0) this.phase = 'GAME_OVER';
  }

  private completeQixClaim(): void {
    for (const pt of this.trail) this.qGrid[pt.y][pt.x] = 1;

    // Flood-fill from every Qix to keep Qix chambers unclaimed; claim everything else!
    const visited = Array.from({ length: this.rows }, () => Array(this.cols).fill(false));
    const qixRegions: number[] = [];

    for (let qIdx = 0; qIdx < this.qixList.length; qIdx++) {
      const q = this.qixList[qIdx];
      const sgx = Math.max(1, Math.min(this.cols - 2, Math.floor((q.x - this.ox) / this.cell)));
      const sgy = Math.max(1, Math.min(this.rows - 2, Math.floor((q.y - this.oy) / this.cell)));
      if (visited[sgy][sgx]) {
        qixRegions.push(0);
        continue;
      }
      qixRegions.push(qIdx + 1);
      const stack = [[sgx, sgy]];
      visited[sgy][sgx] = true;
      while (stack.length > 0) {
        const [cx, cy] = stack.pop()!;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows && !visited[ny][nx] && this.qGrid[ny][nx] === 0) {
            visited[ny][nx] = true;
            stack.push([nx, ny]);
          }
        }
      }
    }

    // Authentic Split-Qix detection! If 2 Qix end up in 2 disconnected regions, immediate stage bonus & 2× multiplier!
    const distinctRegions = qixRegions.filter((r) => r > 0).length;
    if (this.qixList.length >= 2 && distinctRegions >= 2) {
      this.qixMult = Math.min(8, this.qixMult + 1);
      arcadeAudio.playStageClear();
      this.addScore(4000 * this.qixMult, this.logicalWidth * 0.5, 280, `SPLIT QIX! ${this.qixMult}×`);
      this.phase = 'STAGE_CLEAR';
      this.stateTimer = 1.6;
      return;
    }

    let newlyClaimed = 0;
    let totalClaimed = 0;
    const totalPlayable = (this.cols - 2) * (this.rows - 2);
    for (let r = 1; r < this.rows - 1; r++) {
      for (let c = 1; c < this.cols - 1; c++) {
        if (this.qGrid[r][c] === 0 && !visited[r][c]) {
          this.qGrid[r][c] = 1;
          newlyClaimed += 1;
        }
        if (this.qGrid[r][c] === 1) totalClaimed += 1;
      }
    }

    this.claimedPct = Math.round((totalClaimed / totalPlayable) * 100);
    const pts = newlyClaimed * (this.slowDraw ? 20 : 10) * this.qixMult;
    arcadeAudio.playPowerUp();
    this.addScore(pts, this.ox + this.qx * this.cell, this.oy + this.qy * this.cell, this.slowDraw ? 'SLOW 2×' : 'CLAIMED');
    this.drawing = false;
    this.trail = [];
    this.fuseActive = false;

    if (this.claimedPct >= 75) {
      const extraBonus = Math.max(0, this.claimedPct - 75) * 1000;
      this.addScore(1500 + extraBonus, this.logicalWidth * 0.5, 270, `${this.claimedPct}% CLAIMED!`);
      arcadeAudio.playStageClear();
      this.phase = 'STAGE_CLEAR';
      this.stateTimer = 1.5;
    }
  }

  private stepQix(dt: number, attract: boolean): void {
    this.qMoveCd = Math.max(0, this.qMoveCd - dt);

    if (!attract && this.qMoveCd <= 0) {
      let dx = 0;
      let dy = 0;
      if (this.input.left) dx = -1;
      else if (this.input.right) dx = 1;
      else if (this.input.up) dy = -1;
      else if (this.input.down) dy = 1;

      if (dx !== 0 || dy !== 0) {
        const nx = this.qx + dx;
        const ny = this.qy + dy;
        const inBounds = nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows;
        if (inBounds) {
          const targetCell = this.qGrid[ny][nx];
          const wantsDraw = this.input.fire || this.input.secondary || this.drawing;
          if (!this.drawing && targetCell === 1 && this.isBorderCell(nx, ny)) {
            this.qx = nx;
            this.qy = ny;
            this.qMoveCd = 0.05;
          } else if (wantsDraw && targetCell === 0) {
            if (!this.drawing) {
              this.drawing = true;
              this.slowDraw = this.input.secondary;
              this.trail = [{ x: this.qx, y: this.qy }];
              this.fuseActive = false;
              this.fuseIdx = 0;
            }
            this.qx = nx;
            this.qy = ny;
            this.qGrid[ny][nx] = 2;
            this.trail.push({ x: nx, y: ny });
            this.idleDrawTimer = 0;
            this.qMoveCd = this.slowDraw ? 0.085 : 0.048;
          } else if (this.drawing && targetCell === 1) {
            this.qx = nx;
            this.qy = ny;
            this.completeQixClaim();
          }
        }
      }
    }

    // Authentic Qix Burning Fuse when player pauses mid-Stix!
    if (!attract && this.drawing) {
      this.idleDrawTimer += dt;
      if (this.idleDrawTimer > 0.42) {
        this.fuseActive = true;
      }
      if (this.fuseActive) {
        this.fuseTimer += dt;
        if (this.fuseTimer >= 0.075) {
          this.fuseTimer = 0;
          this.fuseIdx += 1;
          if (this.fuseIdx >= this.trail.length - 1) {
            this.failQixMarker('FUSE BURNED!');
            return;
          }
        }
      }
    }

    // Move Qix entities smoothly inside unclaimed area
    for (const q of this.qixList) {
      const nx = q.x + q.vx * dt;
      const ny = q.y + q.vy * dt;
      const gx = Math.floor((nx - this.ox) / this.cell);
      const gy = Math.floor((ny - this.oy) / this.cell);
      if (gx <= 0 || gx >= this.cols - 1 || this.qGrid[Math.max(0, Math.min(this.rows - 1, Math.floor((q.y - this.oy) / this.cell)))][Math.max(0, Math.min(this.cols - 1, gx))] === 1) {
        q.vx = -q.vx + (Math.random() - 0.5) * 35;
      } else {
        q.x = nx;
      }
      if (gy <= 0 || gy >= this.rows - 1 || this.qGrid[Math.max(0, Math.min(this.rows - 1, gy))][Math.max(0, Math.min(this.cols - 1, Math.floor((q.x - this.ox) / this.cell)))] === 1) {
        q.vy = -q.vy + (Math.random() - 0.5) * 35;
      } else {
        q.y = ny;
      }

      const ang = this.clock * 4.5 + q.x * 0.02;
      q.history.unshift({
        x1: q.x + Math.cos(ang) * 28,
        y1: q.y + Math.sin(ang) * 28,
        x2: q.x - Math.cos(ang + 0.7) * 28,
        y2: q.y - Math.sin(ang + 0.7) * 28,
      });
      if (q.history.length > 9) q.history.pop();

      // Check Qix touching active Stix trail!
      if (!attract && this.drawing) {
        for (const pt of this.trail) {
          const px = this.ox + pt.x * this.cell + this.cell * 0.5;
          const py = this.oy + pt.y * this.cell + this.cell * 0.5;
          if (Math.hypot(q.x - px, q.y - py) < 22) {
            this.failQixMarker('QIX STRUCK STIX!');
            return;
          }
        }
      }
    }

    // Perimeter-hugging Sparx!
    const dirs = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ];
    for (const sp of this.sparx) {
      sp.moveAcc += dt * (8 + this.level * 1.1);
      while (sp.moveAcc >= 1) {
        sp.moveAcc -= 1;
        // Prefer turning along claimed perimeter edges
        const tryOrder = [(sp.dir + 1) % 4, sp.dir, (sp.dir + 3) % 4, (sp.dir + 2) % 4];
        for (const d of tryOrder) {
          const nx = sp.gx + dirs[d][0];
          const ny = sp.gy + dirs[d][1];
          if (nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows && this.isBorderCell(nx, ny)) {
            sp.gx = nx;
            sp.gy = ny;
            sp.dir = d;
            break;
          }
        }
        if (!attract && sp.gx === this.qx && sp.gy === this.qy) {
          this.failQixMarker('SPARX ZAPPED!');
          return;
        }
      }
    }
  }

  public getHudSnapshot(): ClassicGameHud {
    if (this.variant === 'missilecommand') {
      const aliveCities = this.cities.filter((c) => c.alive).length;
      const ammo = this.silos.reduce((a, s) => a + s.ammo, 0);
      return {
        phase: this.phase,
        score: this.score,
        highScore: this.highScore,
        level: this.level,
        lives: aliveCities,
        stageName: `MISSILE COMMAND · WAVE ${this.level} (${Math.min(6, Math.ceil(this.level / 2))}×)`,
        primaryMetricLabel: 'CITIES',
        primaryMetricValue: `${aliveCities}/6`,
        secondaryMetricLabel: 'ABM AMMO',
        secondaryMetricValue: String(ammo),
        bannerText: this.phase === 'STAGE_CLEAR' ? 'WAVE DEFENDED!' : this.phase === 'GAME_OVER' ? 'THE END' : '',
      };
    }
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: `QIX · FIELD ${this.level} (${this.qixMult}×)`,
      primaryMetricLabel: 'CLAIMED',
      primaryMetricValue: `${this.claimedPct}% / 75%`,
      secondaryMetricLabel: 'MODE',
      secondaryMetricValue: this.fuseActive ? 'FUSE LIT!' : this.slowDraw ? 'SLOW 2×' : 'FAST',
      bannerText: this.phase === 'STAGE_CLEAR' ? 'AREA CLAIMED!' : this.phase === 'GAME_OVER' ? 'GAME OVER' : '',
    };
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = this.logicalWidth;
    const H = this.logicalHeight;

    if (this.variant === 'missilecommand') {
      this.renderMissileCommand(ctx, W, H);
    } else {
      this.renderQix(ctx, W, H);
    }

    renderParticlesAndPopups(ctx, this.particles, this.popups);
    if (this.phase === 'TITLE') {
      ctx.fillStyle = 'rgba(4, 6, 16, 0.72)';
      ctx.fillRect(0, H * 0.36, W, 114);
      ctx.textAlign = 'center';
      ctx.font = '900 34px "JetBrains Mono", monospace';
      ctx.fillStyle = '#FACC15';
      ctx.fillText(this.variant === 'missilecommand' ? 'MISSILE COMMAND' : 'QIX', W * 0.5, H * 0.36 + 46);
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText(
        this.variant === 'missilecommand'
          ? 'DEFEND 6 CITIES · INTERCEPT MIRVS, BOMBERS & SATELLITES · BONUS CITY AT 10K'
          : 'CLAIM 75% AREA · SHIFT = SLOW 2× DRAW · KEEP MOVING OR THE FUSE BURNS!',
        W * 0.5,
        H * 0.36 + 80,
      );
    }
    if (visualMode === 'crt') renderCrtOverlay(ctx, W, H);
  }

  private renderMissileCommand(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    ctx.fillStyle = '#050814';
    ctx.fillRect(0, 0, W, H);

    // Ground & Silo Hills
    ctx.fillStyle = '#D97706';
    ctx.fillRect(0, 520, W, 60);

    // 6 Cities
    for (const c of this.cities) {
      if (!c.alive) continue;
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(c.x - 18, 502, 10, 18);
      ctx.fillRect(c.x - 6, 494, 12, 26);
      ctx.fillRect(c.x + 8, 504, 10, 16);
    }

    // 3 Silos with ammo indicators
    for (const s of this.silos) {
      ctx.fillStyle = s.fast ? '#FACC15' : '#94A3B8';
      ctx.beginPath();
      ctx.moveTo(s.x - 24, 520);
      ctx.lineTo(s.x - 12, 500);
      ctx.lineTo(s.x + 12, 500);
      ctx.lineTo(s.x + 24, 520);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.font = '900 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(String(s.ammo), s.x, 516);
    }

    // Bomber / Satellite
    if (this.bomber) {
      ctx.fillStyle = this.bomber.isSatellite ? '#F472B6' : '#22C55E';
      ctx.beginPath();
      ctx.arc(this.bomber.x, this.bomber.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.bomber.x - 20, this.bomber.y);
      ctx.lineTo(this.bomber.x + 20, this.bomber.y);
      ctx.stroke();
    }

    // Enemy Missile trails
    for (const em of this.enemyMissiles) {
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(em.sx, em.sy);
      ctx.lineTo(em.x, em.y);
      ctx.stroke();
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(em.x - 2.5, em.y - 2.5, 5, 5);
    }

    // Player ABM trails
    for (const pm of this.playerMissiles) {
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pm.sx, pm.sy);
      ctx.lineTo(pm.x, pm.y);
      ctx.stroke();
      ctx.strokeStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(pm.tx - 5, pm.ty - 5);
      ctx.lineTo(pm.tx + 5, pm.ty + 5);
      ctx.moveTo(pm.tx + 5, pm.ty - 5);
      ctx.lineTo(pm.tx - 5, pm.ty + 5);
      ctx.stroke();
    }

    // Blasts
    for (const b of this.blasts) {
      const g = ctx.createRadialGradient(b.x, b.y, 2, b.x, b.y, b.r);
      g.addColorStop(0, '#FFFFFF');
      g.addColorStop(0.45, '#FACC15');
      g.addColorStop(1, 'rgba(239, 68, 68, 0.25)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Crosshair
    ctx.strokeStyle = '#4ADE80';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.aimX - 12, this.aimY);
    ctx.lineTo(this.aimX + 12, this.aimY);
    ctx.moveTo(this.aimX, this.aimY - 12);
    ctx.lineTo(this.aimX, this.aimY + 12);
    ctx.stroke();
  }

  private renderQix(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    ctx.fillStyle = '#050712';
    ctx.fillRect(0, 0, W, H);

    // Draw Qix grid cells
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const v = this.qGrid[r][c];
        if (v === 1) {
          const border = this.isBorderCell(c, r);
          ctx.fillStyle = border ? '#38BDF8' : 'rgba(14, 116, 144, 0.42)';
          ctx.fillRect(this.ox + c * this.cell, this.oy + r * this.cell, this.cell, this.cell);
        } else if (v === 2) {
          ctx.fillStyle = this.slowDraw ? '#F97316' : '#FACC15';
          ctx.fillRect(this.ox + c * this.cell + 2, this.oy + r * this.cell + 2, this.cell - 4, this.cell - 4);
        }
      }
    }

    // Burning Fuse Spark racing along the Stix!
    if (this.fuseActive && this.trail[this.fuseIdx]) {
      const f = this.trail[this.fuseIdx];
      const fx = this.ox + f.x * this.cell + this.cell * 0.5;
      const fy = this.oy + f.y * this.cell + this.cell * 0.5;
      ctx.fillStyle = '#EF4444';
      ctx.shadowColor = '#FACC15';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(fx, fy, 8 + Math.sin(this.clock * 28) * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Qix Rainbow Ribbon Lines!
    for (const q of this.qixList) {
      q.history.forEach((seg, idx) => {
        ctx.strokeStyle = idx === 0 ? '#FFFFFF' : q.color;
        ctx.globalAlpha = 1 - idx / q.history.length;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
    }

    // Perimeter Sparx
    for (const sp of this.sparx) {
      const sx = this.ox + sp.gx * this.cell + this.cell * 0.5;
      const sy = this.oy + sp.gy * this.cell + this.cell * 0.5;
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(sx, sy, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player Diamond Marker
    const mx = this.ox + this.qx * this.cell + this.cell * 0.5;
    const my = this.oy + this.qy * this.cell + this.cell * 0.5;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(mx, my - 9);
    ctx.lineTo(mx + 9, my);
    ctx.lineTo(mx, my + 9);
    ctx.lineTo(mx - 9, my);
    ctx.closePath();
    ctx.fill();
  }
}

export class MissileCommandGame extends MissileQixGame {
  constructor() {
    super('missilecommand');
  }
}

export class QixArcadeGame extends MissileQixGame {
  constructor() {
    super('qix');
  }
}

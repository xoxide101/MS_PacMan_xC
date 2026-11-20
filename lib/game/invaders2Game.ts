import { arcadeAudio } from './audio';
import {
  ArcadeGameInstance,
  ArcadeInputState,
  ClassicGameHud,
  ClassicGamePhase,
  createEmptyInput,
  readHighScore,
  renderCrtOverlay,
  renderParticlesAndPopups,
  saveHighScore,
  ScorePopup,
  SimpleParticle,
  spawnBurst,
  stepParticlesAndPopups,
} from './classicArcadeInterface';

const WIDTH = 720;
const HEIGHT = 816;
const STORAGE_KEY = 'space_invaders2_hd_highscore_v1';

interface Invader2 {
  row: number;
  col: number;
  kind: 'splitter' | 'mini' | 'crab' | 'octopus';
  points: number;
  x: number;
  y: number;
  alive: boolean;
  color: string;
}

interface MiniDiver {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetRow: number;
  color: string;
}

interface EnemyShot2 {
  x: number;
  y: number;
  vy: number;
  phase: number;
}

interface Bunker2 {
  x: number;
  y: number;
  cols: number;
  rows: number;
  cellSize: number;
  cells: boolean[][];
}

export class SpaceInvaders2Game implements ArcadeGameInstance {
  public readonly logicalWidth = WIDTH;
  public readonly logicalHeight = HEIGHT;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'Fire';

  private phase: ClassicGamePhase = 'TITLE';
  private score = 0;
  private highScore = readHighScore(STORAGE_KEY);
  private bonusLifeGiven = false;
  private level = 1;
  private lives = 3;
  private phaseTimer = 0;
  private time = 0;
  private bannerText = '';

  private input: ArcadeInputState = createEmptyInput();
  private playerX = WIDTH * 0.5;
  private playerY = HEIGHT - 76;
  private playerShot = { active: false, x: 0, y: 0 };
  private invulnTimer = 0;

  private invaders: Invader2[] = [];
  private miniDivers: MiniDiver[] = [];
  private formationDir: 1 | -1 = 1;
  private marchTimer = 0.45;
  private marchAnimFrame = 0;
  private marchStepCount = 0;

  private enemyShots: EnemyShot2[] = [];
  private enemyFireTimer = 0.7;
  private bunkers: Bunker2[] = [];

  // Part II signature: Flashing Cloaked UFO & Golden Reinforcement Dropship UFO!
  private ufo = {
    active: false,
    kind: 'flashing' as 'flashing' | 'dropship',
    x: 0,
    y: 78,
    dir: 1 as 1 | -1,
    spawnTimer: 9,
    dropTimer: 1.5,
    soundTimer: 0,
  };

  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  constructor() {
    this.setupWave(1, true);
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public startNewGame(): void {
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.bonusLifeGiven = false;
    this.level = 1;
    this.lives = 3;
    this.particles = [];
    this.popups = [];
    this.setupWave(1, true);
    this.phase = 'READY';
    this.phaseTimer = 1.05;
    this.bannerText = 'PART II · WAVE 1';
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.level = 1;
    this.setupWave(1, true);
  }

  public getHudSnapshot(): ClassicGameHud {
    const alive = this.invaders.filter((a) => a.alive).length + this.miniDivers.length;
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: `Part II · Wave ${this.level}`,
      primaryMetricLabel: 'Hostiles',
      primaryMetricValue: String(alive),
      secondaryMetricLabel: 'Active UFO',
      secondaryMetricValue: this.ufo.active
        ? this.ufo.kind === 'dropship'
          ? 'DROPSHIP'
          : 'CLOAK UFO'
        : 'Scanning',
      bannerText: this.bannerText,
    };
  }

  private addScore(pts: number, x?: number, y?: number, color = '#22D3EE'): void {
    if (this.phase === 'TITLE') return;
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(STORAGE_KEY, this.highScore);
    }
    if (!this.bonusLifeGiven && this.score >= 2000) {
      this.bonusLifeGiven = true;
      this.lives = Math.min(6, this.lives + 1);
      arcadeAudio.playExtraLife();
      this.popups.push({ x: this.playerX, y: this.playerY - 26, text: '1UP!', color: '#4ADE80', life: 1.3, maxLife: 1.3 });
    }
    if (x !== undefined && y !== undefined && pts >= 50) {
      this.popups.push({ x, y, text: `${pts}`, color, life: 0.95, maxLife: 0.95 });
    }
  }

  private createBunkers(): void {
    this.bunkers = [];
    const cols = 14;
    const rows = 9;
    const cellSize = 6;
    const bunkerW = cols * cellSize;
    const spacing = (WIDTH - 4 * bunkerW) / 5;
    for (let i = 0; i < 4; i++) {
      const bx = spacing + i * (bunkerW + spacing);
      const by = HEIGHT - 186;
      const cells = Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          if (r === 0 && (c < 2 || c >= cols - 2)) return false;
          if (r === 1 && (c < 1 || c >= cols - 1)) return false;
          if (r >= 6 && c >= 4 && c <= 9) return false;
          if (r === 5 && c >= 5 && c <= 8) return false;
          return true;
        })
      );
      this.bunkers.push({ x: bx, y: by, cols, rows, cellSize, cells });
    }
  }

  private setupWave(wave: number, resetBunkers: boolean): void {
    this.invaders = [];
    this.miniDivers = [];
    const startY = Math.min(265, 146 + (wave - 1) * 22);
    const colSpacing = 50;
    const rowSpacing = 44;
    const startX = (WIDTH - 10 * colSpacing) * 0.5;
    const rowColors = ['#F43F5E', '#A855F7', '#38BDF8', '#22C55E', '#FACC15'];

    for (let r = 0; r < 5; r++) {
      const kind: Invader2['kind'] = r === 0 ? 'splitter' : r <= 2 ? 'crab' : 'octopus';
      const points = r === 0 ? 30 : r <= 2 ? 20 : 10;
      for (let c = 0; c < 11; c++) {
        this.invaders.push({
          row: r,
          col: c,
          kind,
          points,
          x: startX + c * colSpacing,
          y: startY + r * rowSpacing,
          alive: true,
          color: rowColors[r],
        });
      }
    }

    this.formationDir = 1;
    this.marchTimer = 0.45;
    this.marchAnimFrame = 0;
    this.marchStepCount = 0;
    this.enemyShots = [];
    this.playerShot.active = false;
    this.playerX = WIDTH * 0.5;
    this.invulnTimer = 1.2;
    this.ufo.active = false;
    this.ufo.spawnTimer = 8;
    if (resetBunkers) this.createBunkers();
  }

  public step(dt: number): void {
    this.time += dt;
    stepParticlesAndPopups(this.particles, this.popups, dt);

    if (this.phase === 'PAUSED' || this.phase === 'GAME_OVER') return;

    if (this.phase === 'READY') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.phase = 'PLAYING';
        this.bannerText = '';
      }
      return;
    }

    if (this.phase === 'STAGE_CLEAR') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.level += 1;
        this.setupWave(this.level, true);
        this.phase = 'READY';
        this.phaseTimer = 1.05;
        this.bannerText = `PART II · WAVE ${this.level}`;
      }
      return;
    }

    const isAttract = this.phase === 'TITLE';
    this.updatePlayer(dt, isAttract);
    this.updatePlayerShot(dt, isAttract);
    this.updateFormation(dt, isAttract);
    this.updateMiniDivers(dt, isAttract);
    this.updateEnemyShots(dt, isAttract);
    this.updateUfo(dt, isAttract);

    const anyLeft = this.invaders.some((a) => a.alive) || this.miniDivers.length > 0;
    if (!anyLeft) {
      if (isAttract) {
        this.setupWave(1, true);
      } else {
        arcadeAudio.playStageClear();
        this.phase = 'STAGE_CLEAR';
        this.phaseTimer = 1.35;
        this.bannerText = `WAVE ${this.level} CLEARED!`;
      }
    }
  }

  private updatePlayer(dt: number, isAttract: boolean): void {
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);

    if (isAttract) {
      const targetX = this.ufo.active
        ? this.ufo.x
        : this.miniDivers[0]?.x ?? this.invaders.find((a) => a.alive)?.x ?? WIDTH * 0.5;
      const dx = targetX - this.playerX;
      this.playerX += Math.sign(dx) * Math.min(Math.abs(dx), 290 * dt);
      if (!this.playerShot.active && Math.abs(dx) < 38) {
        this.playerShot = { active: true, x: this.playerX, y: this.playerY - 18 };
      }
      return;
    }

    const dir = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    this.playerX = Math.max(38, Math.min(WIDTH - 38, this.playerX + dir * 340 * dt));

    if ((this.input.fire || this.input.fireJustPressed) && !this.playerShot.active) {
      this.playerShot = { active: true, x: this.playerX, y: this.playerY - 18 };
      arcadeAudio.playLaser(1040);
    }
  }

  private damageBunkerAt(x: number, y: number, radius: number): boolean {
    for (const bk of this.bunkers) {
      const lx = x - bk.x;
      const ly = y - bk.y;
      if (lx < -radius || ly < -radius || lx > bk.cols * bk.cellSize + radius || ly > bk.rows * bk.cellSize + radius) {
        continue;
      }
      const c0 = Math.floor(lx / bk.cellSize);
      const r0 = Math.floor(ly / bk.cellSize);
      if (r0 >= 0 && r0 < bk.rows && c0 >= 0 && c0 < bk.cols && bk.cells[r0][c0]) {
        const cr = Math.ceil(radius / bk.cellSize);
        for (let r = Math.max(0, r0 - cr); r <= Math.min(bk.rows - 1, r0 + cr); r++) {
          for (let c = Math.max(0, c0 - cr); c <= Math.min(bk.cols - 1, c0 + cr); c++) {
            if (Math.hypot((c - c0) * bk.cellSize, (r - r0) * bk.cellSize) <= radius) {
              bk.cells[r][c] = false;
            }
          }
        }
        return true;
      }
    }
    return false;
  }

  private updatePlayerShot(dt: number, isAttract: boolean): void {
    if (!this.playerShot.active) return;
    this.playerShot.y -= 810 * dt;
    if (this.playerShot.y < 42) {
      this.playerShot.active = false;
      return;
    }

    if (this.damageBunkerAt(this.playerShot.x, this.playerShot.y, 11)) {
      this.playerShot.active = false;
      return;
    }

    // Intercept enemy shots
    for (let i = this.enemyShots.length - 1; i >= 0; i--) {
      const es = this.enemyShots[i];
      if (Math.hypot(this.playerShot.x - es.x, this.playerShot.y - es.y) < 14) {
        this.enemyShots.splice(i, 1);
        this.playerShot.active = false;
        spawnBurst(this.particles, es.x, es.y, '#22D3EE', 10, 140, 2.5);
        return;
      }
    }

    // Hit UFO (Flashing Cloak UFO or Golden Dropship)
    if (this.ufo.active && Math.hypot(this.playerShot.x - this.ufo.x, this.playerShot.y - this.ufo.y) < 28) {
      const pts = this.ufo.kind === 'dropship' ? 500 : 300;
      const color = this.ufo.kind === 'dropship' ? '#FACC15' : '#F472B6';
      this.ufo.active = false;
      this.ufo.spawnTimer = 12 + Math.random() * 5;
      this.playerShot.active = false;
      if (!isAttract) arcadeAudio.playExplosion(true);
      spawnBurst(this.particles, this.ufo.x, this.ufo.y, color, 26, 250, 4);
      this.addScore(pts, this.ufo.x, this.ufo.y, color);
      return;
    }

    // Hit fast split mini-divers!
    for (let i = this.miniDivers.length - 1; i >= 0; i--) {
      const md = this.miniDivers[i];
      if (Math.hypot(this.playerShot.x - md.x, this.playerShot.y - md.y) < 18) {
        this.miniDivers.splice(i, 1);
        this.playerShot.active = false;
        if (!isAttract) arcadeAudio.playExplosion(false);
        spawnBurst(this.particles, md.x, md.y, '#FB7185', 14, 180, 3);
        this.addScore(60, md.x, md.y, '#FB7185');
        return;
      }
    }

    // Hit formation invaders
    for (const inv of this.invaders) {
      if (!inv.alive) continue;
      if (Math.abs(this.playerShot.x - inv.x) < 19 && Math.abs(this.playerShot.y - inv.y) < 16) {
        const remainingBefore = this.invaders.filter((a) => a.alive).length + this.miniDivers.length;
        inv.alive = false;
        this.playerShot.active = false;
        if (!isAttract) arcadeAudio.playExplosion(false);
        spawnBurst(this.particles, inv.x, inv.y, inv.color, 14, 180, 3);

        // Part II signature: Splitter Command Invader splits into 2 fast mini-invaders!
        if (inv.kind === 'splitter' && this.miniDivers.length < 6) {
          this.miniDivers.push(
            { x: inv.x - 10, y: inv.y, vx: -130, vy: 110, targetRow: inv.row + 1, color: '#FB7185' },
            { x: inv.x + 10, y: inv.y, vx: 130, vy: 110, targetRow: inv.row + 1, color: '#FDA4AF' }
          );
          this.popups.push({ x: inv.x, y: inv.y - 16, text: 'SPLIT!', color: '#FB7185', life: 0.75, maxLife: 0.75 });
        }

        // Authentic Part II Rainbow Bonus: 500 pts if very last invader is an Octopus!
        if (remainingBefore === 1 && inv.kind === 'octopus') {
          this.addScore(500, inv.x, inv.y, '#FACC15');
          this.popups.push({ x: WIDTH * 0.5, y: HEIGHT * 0.36, text: 'RAINBOW BONUS +500!', color: '#FACC15', life: 1.5, maxLife: 1.5 });
        } else {
          this.addScore(inv.points, inv.x, inv.y, inv.color);
        }
        return;
      }
    }
  }

  private updateMiniDivers(dt: number, isAttract: boolean): void {
    for (let i = this.miniDivers.length - 1; i >= 0; i--) {
      const md = this.miniDivers[i];
      md.x += md.vx * dt;
      md.y += md.vy * dt;
      if (md.x < 28 || md.x > WIDTH - 28) md.vx = -md.vx;
      if (this.damageBunkerAt(md.x, md.y, 14)) {
        md.vy = Math.max(85, md.vy);
      }
      if (!isAttract && this.invulnTimer <= 0 && Math.hypot(md.x - this.playerX, md.y - this.playerY) < 22) {
        this.miniDivers.splice(i, 1);
        this.handlePlayerHit();
        return;
      }
      if (md.y > HEIGHT - 40) {
        this.miniDivers.splice(i, 1);
      }
    }
  }

  private updateFormation(dt: number, isAttract: boolean): void {
    const alive = this.invaders.filter((a) => a.alive);
    if (alive.length === 0) return;

    const ratio = alive.length / 55;
    const stepInterval = Math.max(0.05, 0.05 + Math.pow(ratio, 1.3) * Math.max(0.38, 0.62 - (this.level - 1) * 0.04));

    this.marchTimer -= dt;
    if (this.marchTimer > 0) return;
    this.marchTimer = stepInterval;
    this.marchAnimFrame = 1 - this.marchAnimFrame;
    if (!isAttract) arcadeAudio.playInvaderStep(this.marchStepCount);
    this.marchStepCount++;

    const stepX = alive.length === 1 ? 17 : 12;
    let minX = Infinity;
    let maxX = -Infinity;
    for (const inv of alive) {
      if (inv.x < minX) minX = inv.x;
      if (inv.x > maxX) maxX = inv.x;
    }

    const hitEdge = (this.formationDir === 1 && maxX + stepX > WIDTH - 32) || (this.formationDir === -1 && minX - stepX < 32);
    if (hitEdge) {
      this.formationDir = this.formationDir === 1 ? -1 : 1;
      for (const inv of alive) {
        inv.y += 22;
        this.damageBunkerAt(inv.x, inv.y + 8, 22);
        if (inv.y >= this.playerY - 20) {
          if (isAttract) {
            this.setupWave(1, true);
            return;
          }
          this.lives = 0;
          this.handlePlayerHit();
          return;
        }
      }
    } else {
      for (const inv of alive) {
        inv.x += this.formationDir * stepX;
        this.damageBunkerAt(inv.x, inv.y + 8, 18);
      }
    }
  }

  private updateEnemyShots(dt: number, isAttract: boolean): void {
    this.enemyFireTimer -= dt;
    const maxShots = Math.min(6, 3 + Math.floor(this.level * 0.6));
    if (this.enemyFireTimer <= 0 && this.enemyShots.length < maxShots) {
      this.enemyFireTimer = Math.max(0.3, 0.92 - this.level * 0.08);
      const bottomByCol = new Map<number, Invader2>();
      for (const inv of this.invaders) {
        if (!inv.alive) continue;
        const prev = bottomByCol.get(inv.col);
        if (!prev || inv.row > prev.row) bottomByCol.set(inv.col, inv);
      }
      const shooters = Array.from(bottomByCol.values());
      if (shooters.length > 0) {
        const chosen =
          Math.random() < 0.42
            ? shooters.reduce((b, c) => (Math.abs(c.x - this.playerX) < Math.abs(b.x - this.playerX) ? c : b))
            : shooters[Math.floor(Math.random() * shooters.length)];
        this.enemyShots.push({
          x: chosen.x,
          y: chosen.y + 16,
          vy: 295 + this.level * 24,
          phase: 0,
        });
      }
    }

    for (let i = this.enemyShots.length - 1; i >= 0; i--) {
      const s = this.enemyShots[i];
      s.y += s.vy * dt;
      s.phase += dt * 26;

      if (this.damageBunkerAt(s.x, s.y, 12)) {
        this.enemyShots.splice(i, 1);
        continue;
      }

      if (!isAttract && this.invulnTimer <= 0 && Math.abs(s.x - this.playerX) < 22 && Math.abs(s.y - this.playerY) < 16) {
        this.enemyShots.splice(i, 1);
        this.handlePlayerHit();
        return;
      }

      if (s.y > HEIGHT - 40) this.enemyShots.splice(i, 1);
    }
  }

  private updateUfo(dt: number, isAttract: boolean): void {
    const aliveCount = this.invaders.filter((a) => a.alive).length;
    if (!this.ufo.active) {
      this.ufo.spawnTimer -= dt;
      if (this.ufo.spawnTimer <= 0 && aliveCount >= 6) {
        const fromLeft = Math.random() < 0.5;
        const shouldDropship = aliveCount < 32 && Math.random() < 0.55;
        this.ufo = {
          active: true,
          kind: shouldDropship ? 'dropship' : 'flashing',
          x: fromLeft ? -34 : WIDTH + 34,
          y: 76,
          dir: fromLeft ? 1 : -1,
          spawnTimer: 13,
          dropTimer: 1.4,
          soundTimer: 0,
        };
      }
    } else {
      this.ufo.x += this.ufo.dir * (this.ufo.kind === 'dropship' ? 140 : 185) * dt;
      if (!isAttract) {
        this.ufo.soundTimer -= dt;
        if (this.ufo.soundTimer <= 0) {
          this.ufo.soundTimer = 0.15;
          arcadeAudio.playUfoPing(this.ufo.kind === 'flashing');
        }
      }

      // Dropship UFO deploys reinforcement invaders into dead top-row slots!
      if (this.ufo.kind === 'dropship') {
        this.ufo.dropTimer -= dt;
        if (this.ufo.dropTimer <= 0) {
          this.ufo.dropTimer = 1.6;
          const deadTop = this.invaders.find(
            (a) => !a.alive && a.row <= 1 && Math.abs(a.x - this.ufo.x) < 60
          );
          if (deadTop) {
            deadTop.alive = true;
            deadTop.kind = 'crab';
            deadTop.color = '#38BDF8';
            spawnBurst(this.particles, deadTop.x, deadTop.y, '#FACC15', 10, 120, 2.5);
          }
        }
      }

      if (this.ufo.x < -46 || this.ufo.x > WIDTH + 46) {
        this.ufo.active = false;
        this.ufo.spawnTimer = 12 + Math.random() * 6;
      }
    }
  }

  private handlePlayerHit(): void {
    arcadeAudio.playDeath();
    spawnBurst(this.particles, this.playerX, this.playerY, '#22D3EE', 28, 250, 4);
    this.lives -= 1;
    this.enemyShots = [];
    this.playerShot.active = false;
    if (this.lives <= 0) {
      this.phase = 'GAME_OVER';
      this.bannerText = 'GAME OVER';
      return;
    }
    this.playerX = WIDTH * 0.5;
    this.invulnTimer = 1.6;
    this.phase = 'READY';
    this.phaseTimer = 1.1;
    this.bannerText = 'READY!';
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Rich Part II cosmic twilight starfield
    const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    bg.addColorStop(0, '#04081A');
    bg.addColorStop(1, '#070412');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    for (let i = 0; i < 48; i++) {
      const sx = (i * 211) % WIDTH;
      const sy = ((i * 337 + this.time * 12) % (HEIGHT - 90)) + 16;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(56,189,248,0.28)' : 'rgba(255,255,255,0.22)';
      ctx.fillRect(sx, sy, 2, 2);
    }

    // Cyan-gold floor line
    ctx.fillStyle = '#06B6D4';
    ctx.fillRect(24, HEIGHT - 36, WIDTH - 48, 3);

    // Shield Bunkers
    ctx.fillStyle = '#22D3EE';
    for (const bk of this.bunkers) {
      for (let r = 0; r < bk.rows; r++) {
        for (let c = 0; c < bk.cols; c++) {
          if (bk.cells[r][c]) {
            ctx.fillRect(bk.x + c * bk.cellSize, bk.y + r * bk.cellSize, bk.cellSize - 0.4, bk.cellSize - 0.4);
          }
        }
      }
    }

    // UFO
    if (this.ufo.active) {
      const cloaked = this.ufo.kind === 'flashing' && Math.sin(this.time * 14) > 0.35;
      ctx.save();
      ctx.globalAlpha = cloaked ? 0.24 : 1;
      ctx.translate(this.ufo.x, this.ufo.y);
      ctx.shadowColor = this.ufo.kind === 'dropship' ? '#FACC15' : '#EC4899';
      ctx.shadowBlur = 16;
      ctx.fillStyle = this.ufo.kind === 'dropship' ? '#F59E0B' : '#EC4899';
      ctx.beginPath();
      ctx.ellipse(0, 0, 28, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(0, -5, 12, Math.PI, 0);
      ctx.fill();
      ctx.restore();
    }

    // Formation invaders
    for (const inv of this.invaders) {
      if (!inv.alive) continue;
      this.drawInvader2(ctx, inv, this.marchAnimFrame);
    }

    // Fast split mini-divers
    for (const md of this.miniDivers) {
      ctx.save();
      ctx.translate(md.x, md.y);
      ctx.fillStyle = md.color;
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(10, 4);
      ctx.lineTo(0, 10);
      ctx.lineTo(-10, 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(-4, -2, 3, 3);
      ctx.fillRect(1, -2, 3, 3);
      ctx.restore();
    }

    // Enemy shots
    for (const s of this.enemyShots) {
      ctx.save();
      ctx.strokeStyle = '#F472B6';
      ctx.lineWidth = 3;
      const zig = Math.sin(s.phase) * 4;
      ctx.beginPath();
      ctx.moveTo(s.x - zig, s.y - 9);
      ctx.lineTo(s.x + zig, s.y);
      ctx.lineTo(s.x - zig, s.y + 9);
      ctx.stroke();
      ctx.restore();
    }

    // Player laser
    if (this.playerShot.active) {
      ctx.save();
      ctx.fillStyle = '#FEF08A';
      ctx.shadowColor = '#22D3EE';
      ctx.shadowBlur = 12;
      ctx.fillRect(this.playerShot.x - 2.2, this.playerShot.y - 12, 4.4, 21);
      ctx.restore();
    }

    // Player Cannon
    if (this.phase !== 'GAME_OVER') {
      const blink = this.invulnTimer > 0 && Math.floor(this.time * 16) % 2 === 0;
      if (!blink) {
        ctx.save();
        ctx.translate(this.playerX, this.playerY);
        ctx.fillStyle = '#06B6D4';
        ctx.shadowColor = '#22D3EE';
        ctx.shadowBlur = 12;
        ctx.fillRect(-23, 0, 46, 14);
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(-15, -7, 30, 7);
        ctx.fillStyle = '#FEF08A';
        ctx.fillRect(-3.5, -17, 7, 12);
        ctx.restore();
      }
    }

    renderParticlesAndPopups(ctx, this.particles, this.popups);

    if (this.bannerText && (this.phase === 'READY' || this.phase === 'STAGE_CLEAR')) {
      ctx.save();
      ctx.font = '800 28px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(4, 6, 13, 0.85)';
      ctx.fillRect(WIDTH * 0.2, HEIGHT * 0.44, WIDTH * 0.6, 56);
      ctx.fillStyle = '#22D3EE';
      ctx.fillText(this.bannerText, WIDTH * 0.5, HEIGHT * 0.44 + 28);
      ctx.restore();
    }

    if (visualMode === 'crt') renderCrtOverlay(ctx, WIDTH, HEIGHT);
  }

  private drawInvader2(ctx: CanvasRenderingContext2D, inv: Invader2, frame: number): void {
    ctx.save();
    ctx.translate(inv.x, inv.y);
    ctx.fillStyle = inv.color;

    if (inv.kind === 'splitter') {
      // Twin-core Splitter Command Invader
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(15, -2);
      ctx.lineTo(12, 8);
      ctx.lineTo(-12, 8);
      ctx.lineTo(-15, -2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(-2, -10, 4, 16); // Glowing split seam!
    } else if (inv.kind === 'crab') {
      ctx.fillRect(-13, -7, 26, 13);
      ctx.fillRect(-9, -12, 4, 5);
      ctx.fillRect(5, -12, 4, 5);
      if (frame === 0) {
        ctx.fillRect(-17, -10, 4, 11);
        ctx.fillRect(13, -10, 4, 11);
      } else {
        ctx.fillRect(-17, 0, 4, 10);
        ctx.fillRect(13, 0, 4, 10);
      }
    } else {
      ctx.beginPath();
      ctx.roundRect(-15, -9, 30, 15, 5);
      ctx.fill();
      const s = frame === 0 ? 2 : -2;
      ctx.fillRect(-13 + s, 6, 6, 6);
      ctx.fillRect(7 - s, 6, 6, 6);
    }

    ctx.fillStyle = '#04060B';
    ctx.fillRect(-7, -4, 4, 4);
    ctx.fillRect(3, -4, 4, 4);
    ctx.restore();
  }
}

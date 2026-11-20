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
const STORAGE_KEY = 'space_invaders_hd_highscore_v1';

interface Invader {
  row: number;
  col: number;
  kind: 'squid' | 'crab' | 'octopus';
  points: number;
  x: number;
  y: number;
  alive: boolean;
}

interface EnemyShot {
  x: number;
  y: number;
  vy: number;
  kind: 'rolling' | 'plunger' | 'squiggly';
  phase: number;
}

interface Bunker {
  x: number;
  y: number;
  cols: number;
  rows: number;
  cellSize: number;
  cells: boolean[][];
}

// Authentic Taito UFO shot-count score table (15th shot = 300!)
const UFO_TABLE = [100, 50, 50, 100, 150, 100, 100, 50, 300, 100, 100, 100, 50, 150, 100];

export class SpaceInvadersGame implements ArcadeGameInstance {
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
  private playerShot: { active: boolean; x: number; y: number } = { active: false, x: 0, y: 0 };
  private shotsFired = 0;
  private invulnTimer = 0;

  private invaders: Invader[] = [];
  private formationDir: 1 | -1 = 1;
  private marchTimer = 0;
  private marchAnimFrame = 0;
  private marchStepCount = 0;

  private enemyShots: EnemyShot[] = [];
  private enemyFireTimer = 0.8;
  private bunkers: Bunker[] = [];

  private ufo = { active: false, x: 0, y: 78, dir: 1 as 1 | -1, spawnTimer: 11, soundTimer: 0 };

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
    this.shotsFired = 0;
    this.particles = [];
    this.popups = [];
    this.setupWave(1, true);
    this.phase = 'READY';
    this.phaseTimer = 1.0;
    this.bannerText = 'WAVE 1';
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
    const remaining = this.invaders.filter((a) => a.alive).length;
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: `Sector Wave ${this.level}`,
      primaryMetricLabel: 'Invaders',
      primaryMetricValue: `${remaining} / 55`,
      secondaryMetricLabel: 'UFO Bonus',
      secondaryMetricValue: `${UFO_TABLE[this.shotsFired % UFO_TABLE.length]} pts`,
      bannerText: this.bannerText,
    };
  }

  private addScore(pts: number, x?: number, y?: number, color = '#4ADE80'): void {
    if (this.phase === 'TITLE') return;
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(STORAGE_KEY, this.highScore);
    }
    if (!this.bonusLifeGiven && this.score >= 1500) {
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
          // Chamfered top corners & bottom arch
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
    const startY = Math.min(270, 146 + (wave - 1) * 24);
    const colSpacing = 50;
    const rowSpacing = 44;
    const startX = (WIDTH - 10 * colSpacing) * 0.5;

    for (let r = 0; r < 5; r++) {
      const kind = r === 0 ? 'squid' : r <= 2 ? 'crab' : 'octopus';
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
        });
      }
    }

    this.formationDir = 1;
    this.marchTimer = 0.5;
    this.marchAnimFrame = 0;
    this.marchStepCount = 0;
    this.enemyShots = [];
    this.playerShot.active = false;
    this.playerX = WIDTH * 0.5;
    this.invulnTimer = 1.2;
    this.ufo.active = false;
    this.ufo.spawnTimer = 9 + Math.random() * 5;
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
        this.phaseTimer = 1.0;
        this.bannerText = `WAVE ${this.level}`;
      }
      return;
    }

    const isAttract = this.phase === 'TITLE';
    this.updatePlayer(dt, isAttract);
    this.updatePlayerShot(dt, isAttract);
    this.updateFormation(dt, isAttract);
    this.updateEnemyShots(dt, isAttract);
    this.updateUfo(dt, isAttract);

    if (!this.invaders.some((a) => a.alive)) {
      if (isAttract) {
        this.setupWave(1, true);
      } else {
        arcadeAudio.playStageClear();
        this.phase = 'STAGE_CLEAR';
        this.phaseTimer = 1.3;
        this.bannerText = `WAVE ${this.level} CLEARED!`;
      }
    }
  }

  private updatePlayer(dt: number, isAttract: boolean): void {
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);

    if (isAttract) {
      const alive = this.invaders.filter((a) => a.alive);
      const target = this.ufo.active
        ? { x: this.ufo.x }
        : alive[Math.floor(this.time * 1.5) % Math.max(1, alive.length)] ?? { x: WIDTH * 0.5 };
      const dx = target.x - this.playerX;
      this.playerX += Math.sign(dx) * Math.min(Math.abs(dx), 260 * dt);
      if (!this.playerShot.active && Math.abs(dx) < 35) {
        this.playerShot = { active: true, x: this.playerX, y: this.playerY - 18 };
      }
      return;
    }

    const dir = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    this.playerX = Math.max(38, Math.min(WIDTH - 38, this.playerX + dir * 320 * dt));

    if ((this.input.fire || this.input.fireJustPressed) && !this.playerShot.active) {
      this.playerShot = { active: true, x: this.playerX, y: this.playerY - 18 };
      this.shotsFired += 1;
      arcadeAudio.playLaser(920);
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
    this.playerShot.y -= 760 * dt;
    if (this.playerShot.y < 42) {
      this.playerShot.active = false;
      spawnBurst(this.particles, this.playerShot.x, 46, '#EF4444', 6, 90, 2);
      return;
    }

    // Bunker hit
    if (this.damageBunkerAt(this.playerShot.x, this.playerShot.y, 11)) {
      this.playerShot.active = false;
      spawnBurst(this.particles, this.playerShot.x, this.playerShot.y, '#4ADE80', 6, 80, 2);
      return;
    }

    // Shot-vs-shot intercept!
    for (let i = this.enemyShots.length - 1; i >= 0; i--) {
      const es = this.enemyShots[i];
      if (Math.hypot(this.playerShot.x - es.x, this.playerShot.y - es.y) < 13) {
        this.enemyShots.splice(i, 1);
        this.playerShot.active = false;
        spawnBurst(this.particles, es.x, es.y, '#FDE047', 10, 130, 2.5);
        return;
      }
    }

    // UFO hit
    if (this.ufo.active && Math.hypot(this.playerShot.x - this.ufo.x, this.playerShot.y - this.ufo.y) < 28) {
      const pts = UFO_TABLE[this.shotsFired % UFO_TABLE.length];
      this.ufo.active = false;
      this.ufo.spawnTimer = 14 + Math.random() * 6;
      this.playerShot.active = false;
      if (!isAttract) arcadeAudio.playExplosion(true);
      spawnBurst(this.particles, this.ufo.x, this.ufo.y, '#EF4444', 24, 240, 3.8);
      this.addScore(pts, this.ufo.x, this.ufo.y, '#F87171');
      return;
    }

    // Invader hit
    for (const inv of this.invaders) {
      if (!inv.alive) continue;
      if (Math.abs(this.playerShot.x - inv.x) < 19 && Math.abs(this.playerShot.y - inv.y) < 16) {
        inv.alive = false;
        this.playerShot.active = false;
        if (!isAttract) arcadeAudio.playExplosion(false);
        const col = inv.kind === 'squid' ? '#F8FAFC' : inv.kind === 'crab' ? '#38BDF8' : '#4ADE80';
        spawnBurst(this.particles, inv.x, inv.y, col, 14, 180, 3);
        this.addScore(inv.points, inv.x, inv.y, col);
        return;
      }
    }
  }

  private updateFormation(dt: number, isAttract: boolean): void {
    const alive = this.invaders.filter((a) => a.alive);
    if (alive.length === 0) return;

    // Authentic Space Invaders accelerating tempo as aliens are destroyed!
    const ratio = alive.length / 55;
    const stepInterval = Math.max(0.055, 0.055 + Math.pow(ratio, 1.35) * Math.max(0.42, 0.68 - (this.level - 1) * 0.04));

    this.marchTimer -= dt;
    if (this.marchTimer > 0) return;
    this.marchTimer = stepInterval;
    this.marchAnimFrame = 1 - this.marchAnimFrame;
    if (!isAttract) arcadeAudio.playInvaderStep(this.marchStepCount);
    this.marchStepCount++;

    const stepX = alive.length === 1 ? 16 : 11;
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
        // Invaders erode bunkers they march across
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
    const maxShots = Math.min(5, 2 + Math.floor(this.level * 0.6));
    if (this.enemyFireTimer <= 0 && this.enemyShots.length < maxShots) {
      this.enemyFireTimer = Math.max(0.35, 1.05 - this.level * 0.08);
      // Only bottom-most alive alien in each column can fire!
      const bottomByCol = new Map<number, Invader>();
      for (const inv of this.invaders) {
        if (!inv.alive) continue;
        const prev = bottomByCol.get(inv.col);
        if (!prev || inv.row > prev.row) bottomByCol.set(inv.col, inv);
      }
      const shooters = Array.from(bottomByCol.values());
      if (shooters.length > 0) {
        const roll = Math.random();
        let chosen = shooters[Math.floor(Math.random() * shooters.length)];
        if (roll < 0.35) {
          // Targeted rolling shot picks column closest to player
          chosen = shooters.reduce((best, cur) =>
            Math.abs(cur.x - this.playerX) < Math.abs(best.x - this.playerX) ? cur : best
          );
        }
        const kinds: Array<'rolling' | 'plunger' | 'squiggly'> = ['rolling', 'plunger', 'squiggly'];
        this.enemyShots.push({
          x: chosen.x,
          y: chosen.y + 16,
          vy: 270 + this.level * 22,
          kind: kinds[Math.floor(Math.random() * kinds.length)],
          phase: 0,
        });
      }
    }

    for (let i = this.enemyShots.length - 1; i >= 0; i--) {
      const s = this.enemyShots[i];
      s.y += s.vy * dt;
      s.phase += dt * 24;

      if (this.damageBunkerAt(s.x, s.y, 12)) {
        this.enemyShots.splice(i, 1);
        spawnBurst(this.particles, s.x, s.y, '#4ADE80', 6, 80, 2);
        continue;
      }

      if (!isAttract && this.invulnTimer <= 0 && Math.abs(s.x - this.playerX) < 22 && Math.abs(s.y - this.playerY) < 16) {
        this.enemyShots.splice(i, 1);
        this.handlePlayerHit();
        return;
      }

      if (s.y > HEIGHT - 40) {
        this.enemyShots.splice(i, 1);
      }
    }
  }

  private updateUfo(dt: number, isAttract: boolean): void {
    if (!this.ufo.active) {
      this.ufo.spawnTimer -= dt;
      if (this.ufo.spawnTimer <= 0 && this.invaders.filter((a) => a.alive).length >= 8) {
        const fromLeft = Math.random() < 0.5;
        this.ufo = {
          active: true,
          x: fromLeft ? -34 : WIDTH + 34,
          y: 76,
          dir: fromLeft ? 1 : -1,
          spawnTimer: 15,
          soundTimer: 0,
        };
      }
    } else {
      this.ufo.x += this.ufo.dir * 165 * dt;
      if (!isAttract) {
        this.ufo.soundTimer -= dt;
        if (this.ufo.soundTimer <= 0) {
          this.ufo.soundTimer = 0.16;
          arcadeAudio.playUfoPing(true);
        }
      }
      if (this.ufo.x < -46 || this.ufo.x > WIDTH + 46) {
        this.ufo.active = false;
        this.ufo.spawnTimer = 14 + Math.random() * 6;
      }
    }
  }

  private handlePlayerHit(): void {
    arcadeAudio.playDeath();
    spawnBurst(this.particles, this.playerX, this.playerY, '#4ADE80', 28, 250, 4);
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

    // Classic Space Invaders pitch black deep-space field
    ctx.fillStyle = '#04060B';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Faint starlight dust
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    for (let i = 0; i < 36; i++) {
      const sx = ((i * 197) % WIDTH);
      const sy = ((i * 313) % (HEIGHT - 120)) + 20;
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }

    // Phosphor green ground baseline
    ctx.fillStyle = '#22C55E';
    ctx.fillRect(24, HEIGHT - 36, WIDTH - 48, 3);

    // Bunkers
    ctx.fillStyle = '#4ADE80';
    for (const bk of this.bunkers) {
      for (let r = 0; r < bk.rows; r++) {
        for (let c = 0; c < bk.cols; c++) {
          if (bk.cells[r][c]) {
            ctx.fillRect(bk.x + c * bk.cellSize, bk.y + r * bk.cellSize, bk.cellSize - 0.4, bk.cellSize - 0.4);
          }
        }
      }
    }

    // Mystery Red UFO
    if (this.ufo.active) {
      this.drawUfo(ctx, this.ufo.x, this.ufo.y);
    }

    // Invaders (classic cellophane color bands: white top, cyan mid, green low)
    for (const inv of this.invaders) {
      if (!inv.alive) continue;
      const color = inv.y > HEIGHT - 260 ? '#4ADE80' : inv.kind === 'squid' ? '#F8FAFC' : inv.kind === 'crab' ? '#E2E8F0' : '#BAE6FD';
      this.drawInvader(ctx, inv, color, this.marchAnimFrame);
    }

    // Enemy shots
    for (const s of this.enemyShots) {
      ctx.save();
      ctx.strokeStyle = s.kind === 'squiggly' ? '#F472B6' : '#FDE047';
      ctx.lineWidth = 3;
      ctx.beginPath();
      const zig = Math.sin(s.phase) * 4;
      ctx.moveTo(s.x - zig, s.y - 9);
      ctx.lineTo(s.x + zig, s.y);
      ctx.lineTo(s.x - zig, s.y + 9);
      ctx.stroke();
      ctx.restore();
    }

    // Player laser beam
    if (this.playerShot.active) {
      ctx.save();
      ctx.fillStyle = '#F8FAFC';
      ctx.shadowColor = '#4ADE80';
      ctx.shadowBlur = 10;
      ctx.fillRect(this.playerShot.x - 2, this.playerShot.y - 12, 4, 20);
      ctx.restore();
    }

    // Player laser cannon
    if (this.phase !== 'GAME_OVER') {
      const blink = this.invulnTimer > 0 && Math.floor(this.time * 16) % 2 === 0;
      if (!blink) this.drawCannon(ctx, this.playerX, this.playerY);
    }

    renderParticlesAndPopups(ctx, this.particles, this.popups);

    if (this.bannerText && (this.phase === 'READY' || this.phase === 'STAGE_CLEAR')) {
      ctx.save();
      ctx.font = '800 30px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(4, 6, 13, 0.84)';
      ctx.fillRect(WIDTH * 0.25, HEIGHT * 0.44, WIDTH * 0.5, 56);
      ctx.fillStyle = '#4ADE80';
      ctx.fillText(this.bannerText, WIDTH * 0.5, HEIGHT * 0.44 + 28);
      ctx.restore();
    }

    if (visualMode === 'crt') renderCrtOverlay(ctx, WIDTH, HEIGHT);
  }

  private drawCannon(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#4ADE80';
    ctx.shadowColor = '#22C55E';
    ctx.shadowBlur = 10;
    ctx.fillRect(-22, 0, 44, 14);
    ctx.fillRect(-16, -6, 32, 6);
    ctx.fillRect(-3.5, -16, 7, 12);
    ctx.restore();
  }

  private drawUfo(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = '#EF4444';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.ellipse(0, 0, 26, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FCA5A5';
    ctx.beginPath();
    ctx.arc(0, -4, 12, Math.PI, 0);
    ctx.fill();
    // Blinking rim lights
    ctx.fillStyle = '#FEF08A';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.arc(i * 9, 1, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawInvader(
    ctx: CanvasRenderingContext2D,
    inv: Invader,
    color: string,
    frame: number
  ): void {
    ctx.save();
    ctx.translate(inv.x, inv.y);
    ctx.fillStyle = color;

    if (inv.kind === 'squid') {
      // Top-row classic Squid
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.lineTo(12, -2);
      ctx.lineTo(10, 6);
      ctx.lineTo(-10, 6);
      ctx.lineTo(-12, -2);
      ctx.closePath();
      ctx.fill();
      const spread = frame === 0 ? 11 : 6;
      ctx.fillRect(-spread, 6, 4, 7);
      ctx.fillRect(-2, 6, 4, 7);
      ctx.fillRect(spread - 4, 6, 4, 7);
    } else if (inv.kind === 'crab') {
      // Middle-row iconic Crab
      ctx.fillRect(-13, -7, 26, 13);
      ctx.fillRect(-9, -12, 4, 5);
      ctx.fillRect(5, -12, 4, 5);
      if (frame === 0) {
        ctx.fillRect(-17, -10, 4, 11);
        ctx.fillRect(13, -10, 4, 11);
        ctx.fillRect(-11, 6, 5, 6);
        ctx.fillRect(6, 6, 5, 6);
      } else {
        ctx.fillRect(-17, 0, 4, 10);
        ctx.fillRect(13, 0, 4, 10);
        ctx.fillRect(-6, 6, 5, 6);
        ctx.fillRect(1, 6, 5, 6);
      }
    } else {
      // Bottom-row chunky Octopus
      ctx.beginPath();
      ctx.roundRect(-15, -9, 30, 15, 5);
      ctx.fill();
      const shift = frame === 0 ? 2 : -2;
      ctx.fillRect(-14 + shift, 6, 6, 6);
      ctx.fillRect(-3, 6, 6, 6);
      ctx.fillRect(8 - shift, 6, 6, 6);
    }

    // Dark eyes
    ctx.fillStyle = '#04060B';
    ctx.fillRect(-7, -4, 4, 4);
    ctx.fillRect(3, -4, 4, 4);
    ctx.restore();
  }
}

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
import {
  drawPixelMatrixHD,
  drawStarGlint,
  TAITO_CRAB_F0,
  TAITO_CRAB_F1,
  TAITO_OCTO_F0,
  TAITO_OCTO_F1,
  TAITO_SQUID_F0,
  TAITO_SQUID_F1,
  TAITO_UFO_MATRIX,
} from './arcadeGfx';

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

    // Deep cosmic arcade monitor backdrop with subtle Taito lunar-cabinet tint
    const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    bg.addColorStop(0, '#04060E');
    bg.addColorStop(0.72, '#04070D');
    bg.addColorStop(1, '#05110B');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Faint authentic cellophane band atmosphere (red UFO band, green defender band)
    ctx.fillStyle = 'rgba(239, 68, 68, 0.045)';
    ctx.fillRect(0, 44, WIDTH, 64);
    ctx.fillStyle = 'rgba(34, 197, 94, 0.045)';
    ctx.fillRect(0, HEIGHT - 236, WIDTH, 200);

    // Subtle twinkling deep-space stars
    for (let i = 0; i < 52; i++) {
      const sx = (i * 197 + 23) % WIDTH;
      const sy = ((i * 313 + 17) % (HEIGHT - 130)) + 24;
      const twinkle = 0.14 + 0.22 * (0.5 + 0.5 * Math.sin(this.time * 2.4 + i * 1.7));
      ctx.fillStyle = i % 5 === 0 ? `rgba(186,230,253,${twinkle})` : `rgba(255,255,255,${twinkle})`;
      ctx.fillRect(sx, sy, i % 4 === 0 ? 2 : 1.4, i % 4 === 0 ? 2 : 1.4);
    }

    // Phosphor green ground baseline with glow
    ctx.save();
    ctx.shadowColor = '#22C55E';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#22C55E';
    ctx.fillRect(24, HEIGHT - 36, WIDTH - 48, 3.5);
    ctx.fillStyle = '#BBF7D0';
    ctx.fillRect(24, HEIGHT - 36, WIDTH - 48, 1.2);
    ctx.restore();

    // Beveled phosphor-lit destructible bunkers
    for (const bk of this.bunkers) {
      for (let r = 0; r < bk.rows; r++) {
        for (let c = 0; c < bk.cols; c++) {
          if (!bk.cells[r][c]) continue;
          const bx = bk.x + c * bk.cellSize;
          const by = bk.y + r * bk.cellSize;
          const topExposed = r === 0 || !bk.cells[r - 1][c];
          const botExposed = r === bk.rows - 1 || !bk.cells[r + 1][c];
          ctx.fillStyle = topExposed ? '#86EFAC' : botExposed ? '#16A34A' : '#4ADE80';
          ctx.fillRect(bx + 0.25, by + 0.25, bk.cellSize - 0.5, bk.cellSize - 0.5);
          if (topExposed) {
            ctx.fillStyle = 'rgba(255,255,255,0.45)';
            ctx.fillRect(bx + 0.5, by + 0.3, bk.cellSize - 1, 1.4);
          }
        }
      }
    }

    // Mystery Red UFO
    if (this.ufo.active) {
      this.drawUfo(ctx, this.ufo.x, this.ufo.y);
    }

    // Invaders (classic Taito cellophane bands: crisp white/cyan upper, emerald phosphor lower)
    for (const inv of this.invaders) {
      if (!inv.alive) continue;
      const color =
        inv.y > HEIGHT - 240
          ? '#4ADE80'
          : inv.kind === 'squid'
          ? '#F8FAFC'
          : inv.kind === 'crab'
          ? '#E0F2FE'
          : '#7DD3FC';
      this.drawInvader(ctx, inv, color, this.marchAnimFrame);
    }

    // Jagged electric enemy shots with white-hot cores
    for (const s of this.enemyShots) {
      ctx.save();
      const boltColor = s.kind === 'squiggly' ? '#F472B6' : s.kind === 'plunger' ? '#38BDF8' : '#FDE047';
      const zig = Math.sin(s.phase) * 4.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = boltColor;
      ctx.shadowBlur = 10;
      ctx.strokeStyle = boltColor;
      ctx.lineWidth = 4;
      ctx.beginPath();
      if (s.kind === 'plunger') {
        ctx.moveTo(s.x, s.y - 10);
        ctx.lineTo(s.x, s.y + 8);
        ctx.moveTo(s.x - 4.5, s.y + 4 + Math.sin(s.phase) * 2.5);
        ctx.lineTo(s.x + 4.5, s.y + 4 + Math.sin(s.phase) * 2.5);
      } else {
        ctx.moveTo(s.x - zig, s.y - 10);
        ctx.lineTo(s.x + zig, s.y - 3);
        ctx.lineTo(s.x - zig, s.y + 4);
        ctx.lineTo(s.x + zig, s.y + 10);
      }
      ctx.stroke();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.restore();
    }

    // Player laser beam with glowing plasma halo
    if (this.playerShot.active) {
      ctx.save();
      ctx.shadowColor = '#4ADE80';
      ctx.shadowBlur = 14;
      const beam = ctx.createLinearGradient(0, this.playerShot.y - 14, 0, this.playerShot.y + 10);
      beam.addColorStop(0, '#FFFFFF');
      beam.addColorStop(0.55, '#86EFAC');
      beam.addColorStop(1, 'rgba(34, 197, 94, 0)');
      ctx.fillStyle = beam;
      ctx.fillRect(this.playerShot.x - 2.6, this.playerShot.y - 14, 5.2, 24);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(this.playerShot.x - 1.1, this.playerShot.y - 13, 2.2, 16);
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
      ctx.fillStyle = 'rgba(4, 6, 13, 0.86)';
      ctx.fillRect(WIDTH * 0.24, HEIGHT * 0.44, WIDTH * 0.52, 58);
      ctx.strokeStyle = '#4ADE80';
      ctx.lineWidth = 2;
      ctx.strokeRect(WIDTH * 0.24, HEIGHT * 0.44, WIDTH * 0.52, 58);
      ctx.fillStyle = '#4ADE80';
      ctx.fillText(this.bannerText, WIDTH * 0.5, HEIGHT * 0.44 + 29);
      ctx.restore();
    }

    if (visualMode === 'crt') renderCrtOverlay(ctx, WIDTH, HEIGHT);
  }

  private drawCannon(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = '#22C55E';
    ctx.shadowBlur = 12;

    // Classic Taito stepped Laser Base silhouette evolved with metallic bevels
    const bodyGrad = ctx.createLinearGradient(0, -16, 0, 14);
    bodyGrad.addColorStop(0, '#BBF7D0');
    bodyGrad.addColorStop(0.45, '#4ADE80');
    bodyGrad.addColorStop(1, '#15803D');
    ctx.fillStyle = bodyGrad;

    // Wide lower chassis with chamfered corners
    ctx.beginPath();
    ctx.roundRect(-23, 0, 46, 14, [3, 3, 2, 2]);
    ctx.fill();
    // Upper turret shoulder
    ctx.beginPath();
    ctx.roundRect(-16, -6, 32, 7, [3, 3, 0, 0]);
    ctx.fill();
    // Central emitter barrel
    ctx.beginPath();
    ctx.roundRect(-4, -15, 8, 10, [2, 2, 0, 0]);
    ctx.fill();
    ctx.fillStyle = '#DCFCE7';
    ctx.fillRect(-2, -19, 4, 5);

    // Panel seam & specular highlight
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
    ctx.fillRect(-15, -5.5, 30, 1.8);
    ctx.fillRect(-21, 1, 42, 1.8);
    ctx.fillStyle = '#052E16';
    ctx.fillRect(-12, 5, 6, 4);
    ctx.fillRect(6, 5, 6, 4);
    ctx.fillStyle = '#FEF08A';
    ctx.fillRect(-2.5, 5, 5, 4);

    // Muzzle flash shimmer when shot just launched
    if (this.playerShot.active && this.playerShot.y > this.playerY - 75) {
      drawStarGlint(ctx, 0, -20, 8, '#DCFCE7', this.time * 10);
    }
    ctx.restore();
  }

  private drawUfo(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    drawPixelMatrixHD(
      ctx,
      TAITO_UFO_MATRIX,
      x,
      y,
      3.4,
      { '#': '#EF4444' },
      'rgba(239, 68, 68, 0.85)'
    );
    // Animated chasing rim lights on authentic saucer
    ctx.save();
    ctx.translate(x, y);
    const activeIdx = Math.floor(this.time * 12) % 5;
    for (let i = -2; i <= 2; i++) {
      const lit = i + 2 === activeIdx;
      ctx.fillStyle = lit ? '#FFFFFF' : '#FEF08A';
      ctx.beginPath();
      ctx.arc(i * 9.5, 0.5, lit ? 2.6 : 1.8, 0, Math.PI * 2);
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
    const matrix =
      inv.kind === 'squid'
        ? frame === 0
          ? TAITO_SQUID_F0
          : TAITO_SQUID_F1
        : inv.kind === 'crab'
        ? frame === 0
          ? TAITO_CRAB_F0
          : TAITO_CRAB_F1
        : frame === 0
        ? TAITO_OCTO_F0
        : TAITO_OCTO_F1;
    const cell = inv.kind === 'squid' ? 3.2 : inv.kind === 'crab' ? 3.05 : 2.95;
    drawPixelMatrixHD(ctx, matrix, inv.x, inv.y, cell, { '#': color }, color);
  }
}

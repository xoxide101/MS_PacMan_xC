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

const COLS = 30;
const ROWS = 34;
const TILE = 24;
const WIDTH = COLS * TILE;
const HEIGHT = ROWS * TILE;
const PLAYER_MIN_ROW = 26;
const STORAGE_KEY = 'millipede_hd_highscore_v1';

interface MilliTile {
  kind: 'mush' | 'flower';
  hp: number;
  poisoned: boolean;
}

interface DdtBomb {
  col: number;
  row: number;
}

interface DdtCloud {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
}

interface MilliSegment {
  x: number;
  y: number;
  dir: 1 | -1;
  isHead: boolean;
  diving: boolean;
  targetRow: number;
  goingUp: boolean;
  wiggle: number;
}

interface BugEntity {
  kind: 'spider' | 'beetle' | 'inchworm' | 'mosquito' | 'earwig';
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  timer: number;
  anim: number;
}

export class MillipedeGame implements ArcadeGameInstance {
  public readonly logicalWidth = WIDTH;
  public readonly logicalHeight = HEIGHT;
  public readonly supportsPointerAim = true;
  public readonly primaryActionLabel = 'Fire';

  private phase: ClassicGamePhase = 'TITLE';
  private score = 0;
  private highScore = readHighScore(STORAGE_KEY);
  private nextExtraLife = 15000;
  private level = 1;
  private lives = 3;
  private phaseTimer = 0;
  private time = 0;
  private bannerText = '';

  private input: ArcadeInputState = createEmptyInput();
  private playerX = WIDTH * 0.5;
  private playerY = (ROWS - 2.4) * TILE;
  private fireCooldown = 0;
  private invulnTimer = 0;
  private slowMoTimer = 0;

  private grid: (MilliTile | null)[][] = [];
  private ddtBombs: DdtBomb[] = [];
  private ddtClouds: DdtCloud[] = [];
  private segments: MilliSegment[] = [];
  private bugs: BugEntity[] = [];
  private bullets: Array<{ x: number; y: number }> = [];

  private bugSpawnTimer = 2.4;
  private ddtRespawnTimer = 9;
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  constructor() {
    this.initArena(true);
    this.spawnWave(1);
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public startNewGame(): void {
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.nextExtraLife = 15000;
    this.level = 1;
    this.lives = 3;
    this.slowMoTimer = 0;
    this.bullets = [];
    this.ddtClouds = [];
    this.particles = [];
    this.popups = [];
    this.initArena(true);
    this.resetPlayer();
    this.spawnWave(1);
    this.phase = 'READY';
    this.phaseTimer = 1.1;
    this.bannerText = 'MILLIPEDE WAVE 1';
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.level = 1;
    this.slowMoTimer = 0;
    this.bullets = [];
    this.ddtClouds = [];
    this.initArena(true);
    this.resetPlayer();
    this.spawnWave(1);
  }

  public getHudSnapshot(): ClassicGameHud {
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: this.slowMoTimer > 0 ? `Wave ${this.level} · SLOW-MO` : `Millipede Wave ${this.level}`,
      primaryMetricLabel: 'DDT Bombs',
      primaryMetricValue: String(this.ddtBombs.length),
      secondaryMetricLabel: 'Segments',
      secondaryMetricValue: String(this.segments.length),
      bannerText: this.bannerText,
    };
  }

  private addScore(pts: number, x?: number, y?: number, color = '#FB923C'): void {
    if (this.phase === 'TITLE') return;
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(STORAGE_KEY, this.highScore);
    }
    if (this.score >= this.nextExtraLife) {
      this.lives = Math.min(6, this.lives + 1);
      this.nextExtraLife += 15000;
      arcadeAudio.playExtraLife();
      this.popups.push({ x: this.playerX, y: this.playerY - 22, text: '1UP!', color: '#4ADE80', life: 1.3, maxLife: 1.3 });
    }
    if (x !== undefined && y !== undefined && pts >= 50) {
      this.popups.push({ x, y, text: `${pts}`, color, life: 0.9, maxLife: 0.9 });
    }
  }

  private initArena(full: boolean): void {
    if (full) {
      this.grid = Array.from({ length: ROWS }, () => Array<MilliTile | null>(COLS).fill(null));
      for (let i = 0; i < 42; i++) {
        const r = 2 + Math.floor(Math.random() * (PLAYER_MIN_ROW - 1));
        const c = 1 + Math.floor(Math.random() * (COLS - 2));
        this.grid[r][c] = { kind: 'mush', hp: 4, poisoned: false };
      }
    }
    this.ddtBombs = [];
    this.spawnDdtBombs(4);
    this.bugs = [];
    this.bugSpawnTimer = 2.0;
  }

  private spawnDdtBombs(targetCount: number): void {
    let attempts = 0;
    while (this.ddtBombs.length < targetCount && attempts < 60) {
      attempts++;
      const r = 5 + Math.floor(Math.random() * (PLAYER_MIN_ROW - 8));
      const c = 2 + Math.floor(Math.random() * (COLS - 4));
      if (!this.ddtBombs.some((d) => Math.abs(d.col - c) < 4 && Math.abs(d.row - r) < 3)) {
        this.grid[r][c] = null;
        this.ddtBombs.push({ col: c, row: r });
      }
    }
  }

  private resetPlayer(): void {
    this.playerX = WIDTH * 0.5;
    this.playerY = (ROWS - 2.3) * TILE;
    this.invulnTimer = 1.5;
  }

  private spawnWave(wave: number): void {
    this.segments = [];
    const len = 12;
    const startCol = Math.floor(COLS * 0.5);
    for (let i = 0; i < len; i++) {
      this.segments.push({
        x: (startCol - i) * TILE + TILE * 0.5,
        y: TILE * 1.5,
        dir: 1,
        isHead: i === 0,
        diving: false,
        targetRow: 1,
        goingUp: false,
        wiggle: i * 0.5,
      });
    }
    // Extra fast heads on higher waves
    const extra = Math.min(4, Math.floor((wave - 1) / 2));
    for (let i = 0; i < extra; i++) {
      this.segments.push({
        x: i % 2 === 0 ? TILE * 1.5 : WIDTH - TILE * 1.5,
        y: TILE * 2.5,
        dir: i % 2 === 0 ? 1 : -1,
        isHead: true,
        diving: false,
        targetRow: 2,
        goingUp: false,
        wiggle: i,
      });
    }
    this.spawnDdtBombs(4);
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
        this.spawnWave(this.level);
        this.phase = 'READY';
        this.phaseTimer = 1.05;
        this.bannerText = `MILLIPEDE WAVE ${this.level}`;
      }
      return;
    }

    const isAttract = this.phase === 'TITLE';
    if (this.slowMoTimer > 0) this.slowMoTimer = Math.max(0, this.slowMoTimer - dt);
    const enemyDt = this.slowMoTimer > 0 ? dt * 0.42 : dt;

    this.updatePlayer(dt, isAttract);
    this.updateBullets(dt, isAttract);
    this.updateDdtClouds(dt, isAttract);
    this.updateSegments(enemyDt, isAttract);
    this.updateBugs(enemyDt, isAttract);

    this.ddtRespawnTimer -= dt;
    if (this.ddtRespawnTimer <= 0) {
      this.ddtRespawnTimer = 12;
      if (this.ddtBombs.length < 3) this.spawnDdtBombs(4);
    }

    if (this.segments.length === 0) {
      if (isAttract) {
        this.spawnWave(1);
      } else {
        arcadeAudio.playStageClear();
        this.phase = 'STAGE_CLEAR';
        this.phaseTimer = 1.25;
        this.bannerText = `WAVE ${this.level} CLEARED!`;
      }
    }
  }

  private updatePlayer(dt: number, isAttract: boolean): void {
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (this.fireCooldown > 0) this.fireCooldown = Math.max(0, this.fireCooldown - dt);

    const minY = PLAYER_MIN_ROW * TILE + TILE * 0.5;
    const maxY = (ROWS - 1) * TILE - TILE * 0.5;
    const minX = TILE * 0.6;
    const maxX = WIDTH - TILE * 0.6;

    if (isAttract) {
      const targetX = this.ddtBombs[0]
        ? this.ddtBombs[0].col * TILE + TILE * 0.5
        : this.segments[0]?.x ?? WIDTH * 0.5;
      const dx = targetX - this.playerX;
      this.playerX += Math.sign(dx) * Math.min(Math.abs(dx), 310 * dt);
      this.playerY = (ROWS - 2.3) * TILE + Math.cos(this.time * 2.4) * 24;
      if (this.fireCooldown <= 0 && this.bullets.length < 3) {
        this.bullets.push({ x: this.playerX, y: this.playerY - 14 });
        this.fireCooldown = 0.19;
      }
      return;
    }

    const speed = 355;
    let nx = this.playerX;
    let ny = this.playerY;

    if (this.input.pointerActive) {
      const tx = this.input.pointerX * WIDTH;
      const ty = Math.max(minY, Math.min(maxY, this.input.pointerY * HEIGHT));
      const dx = tx - this.playerX;
      const dy = ty - this.playerY;
      const dist = Math.hypot(dx, dy);
      if (dist > 2) {
        const mv = Math.min(dist, 580 * dt);
        nx += (dx / dist) * mv;
        ny += (dy / dist) * mv;
      }
    } else {
      let mx = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
      let my = (this.input.down ? 1 : 0) - (this.input.up ? 1 : 0);
      if (mx !== 0 && my !== 0) {
        mx *= 0.7071;
        my *= 0.7071;
      }
      nx += mx * speed * dt;
      ny += my * speed * dt;
    }

    nx = Math.max(minX, Math.min(maxX, nx));
    ny = Math.max(minY, Math.min(maxY, ny));

    const c = Math.floor(nx / TILE);
    const r = Math.floor(ny / TILE);
    if (!this.grid[r]?.[c]) {
      this.playerX = nx;
      this.playerY = ny;
    } else {
      if (!this.grid[Math.floor(this.playerY / TILE)]?.[c]) this.playerX = nx;
      if (!this.grid[r]?.[Math.floor(this.playerX / TILE)]) this.playerY = ny;
    }

    if ((this.input.fire || this.input.fireJustPressed) && this.fireCooldown <= 0 && this.bullets.length < 4) {
      this.bullets.push({ x: this.playerX, y: this.playerY - 14 });
      this.fireCooldown = 0.12;
      arcadeAudio.playLaser(1180);
    }
  }

  private detonateDdt(col: number, row: number, isAttract: boolean): void {
    const cx = col * TILE + TILE * 0.5;
    const cy = row * TILE + TILE * 0.5;
    if (!isAttract) arcadeAudio.playExplosion(true);
    spawnBurst(this.particles, cx, cy, '#FB923C', 28, 280, 4.5);
    spawnBurst(this.particles, cx, cy, '#FDE047', 16, 190, 3.5);
    this.ddtClouds.push({
      x: cx,
      y: cy,
      radius: 18,
      maxRadius: TILE * 4.4,
      life: 0.95,
      maxLife: 0.95,
    });
    this.addScore(800, cx, cy - 16, '#FACC15');
  }

  private updateDdtClouds(dt: number, isAttract: boolean): void {
    for (let i = this.ddtClouds.length - 1; i >= 0; i--) {
      const cloud = this.ddtClouds[i];
      cloud.life -= dt;
      const progress = 1 - Math.max(0, cloud.life / cloud.maxLife);
      cloud.radius = 22 + Math.sin(Math.min(1, progress * 1.4) * Math.PI * 0.5) * (cloud.maxRadius - 22);

      // Vaporize mushrooms in blast radius
      const minC = Math.max(0, Math.floor((cloud.x - cloud.radius) / TILE));
      const maxC = Math.min(COLS - 1, Math.floor((cloud.x + cloud.radius) / TILE));
      const minR = Math.max(1, Math.floor((cloud.y - cloud.radius) / TILE));
      const maxR = Math.min(ROWS - 2, Math.floor((cloud.y + cloud.radius) / TILE));
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          if (this.grid[r][c]) {
            const tx = c * TILE + TILE * 0.5;
            const ty = r * TILE + TILE * 0.5;
            if (Math.hypot(tx - cloud.x, ty - cloud.y) <= cloud.radius) {
              this.grid[r][c] = null;
            }
          }
        }
      }

      // Chain-detonate nearby DDT bombs!
      for (let dIdx = this.ddtBombs.length - 1; dIdx >= 0; dIdx--) {
        const d = this.ddtBombs[dIdx];
        const dx = d.col * TILE + TILE * 0.5;
        const dy = d.row * TILE + TILE * 0.5;
        if (Math.hypot(dx - cloud.x, dy - cloud.y) <= cloud.radius) {
          this.ddtBombs.splice(dIdx, 1);
          this.detonateDdt(d.col, d.row, isAttract);
        }
      }

      // Destroy millipede segments for 3x points!
      for (let s = this.segments.length - 1; s >= 0; s--) {
        const seg = this.segments[s];
        if (Math.hypot(seg.x - cloud.x, seg.y - cloud.y) <= cloud.radius) {
          const pts = seg.isHead ? 300 : 30;
          if (s + 1 < this.segments.length) this.segments[s + 1].isHead = true;
          this.segments.splice(s, 1);
          spawnBurst(this.particles, seg.x, seg.y, '#FDE047', 10, 160);
          this.addScore(pts, seg.x, seg.y, '#FDE047');
        }
      }

      // Destroy bugs for 3x points!
      for (let b = this.bugs.length - 1; b >= 0; b--) {
        const bug = this.bugs[b];
        if (Math.hypot(bug.x - cloud.x, bug.y - cloud.y) <= cloud.radius) {
          this.bugs.splice(b, 1);
          spawnBurst(this.particles, bug.x, bug.y, '#38BDF8', 14, 190);
          this.addScore(1200, bug.x, bug.y, '#FDE047');
        }
      }

      if (cloud.life <= 0) this.ddtClouds.splice(i, 1);
    }
  }

  private scrollFieldDownOneRow(): void {
    for (let r = ROWS - 2; r >= 2; r--) {
      for (let c = 0; c < COLS; c++) {
        this.grid[r][c] = this.grid[r - 1][c];
      }
    }
    for (let c = 0; c < COLS; c++) {
      this.grid[1][c] = Math.random() < 0.08 ? { kind: 'mush', hp: 4, poisoned: false } : null;
    }
    for (const d of this.ddtBombs) {
      d.row = Math.min(PLAYER_MIN_ROW - 2, d.row + 1);
    }
  }

  private updateBullets(dt: number, isAttract: boolean): void {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.y -= 880 * dt;
      if (b.y < TILE) {
        this.bullets.splice(i, 1);
        continue;
      }

      let hit = false;

      // Hit DDT bomb
      for (let dIdx = this.ddtBombs.length - 1; dIdx >= 0; dIdx--) {
        const d = this.ddtBombs[dIdx];
        const dx = d.col * TILE + TILE * 0.5;
        const dy = d.row * TILE + TILE * 0.5;
        if (Math.hypot(b.x - dx, b.y - dy) < 16) {
          this.ddtBombs.splice(dIdx, 1);
          this.detonateDdt(d.col, d.row, isAttract);
          hit = true;
          break;
        }
      }

      // Hit bugs
      if (!hit) {
        for (let bi = this.bugs.length - 1; bi >= 0; bi--) {
          const bug = this.bugs[bi];
          if (Math.hypot(b.x - bug.x, b.y - bug.y) < 20) {
            bug.hp -= 1;
            hit = true;
            if (bug.hp <= 0) {
              this.bugs.splice(bi, 1);
              if (bug.kind === 'inchworm') {
                this.slowMoTimer = 4.5;
                if (!isAttract) arcadeAudio.playSlowMo();
                this.addScore(100, bug.x, bug.y, '#38BDF8');
                this.popups.push({ x: bug.x, y: bug.y - 18, text: 'SLOW-MO!', color: '#38BDF8', life: 1.1, maxLife: 1.1 });
              } else if (bug.kind === 'mosquito') {
                if (!isAttract) arcadeAudio.playExplosion(false);
                this.scrollFieldDownOneRow();
                this.addScore(400, bug.x, bug.y, '#FB923C');
              } else if (bug.kind === 'beetle') {
                if (!isAttract) arcadeAudio.playExplosion(false);
                this.addScore(300, bug.x, bug.y, '#A855F7');
              } else if (bug.kind === 'earwig') {
                if (!isAttract) arcadeAudio.playExplosion(true);
                this.addScore(1000, bug.x, bug.y, '#FACC15');
              } else {
                if (!isAttract) arcadeAudio.playExplosion(false);
                this.addScore(600, bug.x, bug.y, '#F472B6');
              }
              spawnBurst(this.particles, bug.x, bug.y, '#FB923C', 16, 210);
            }
            break;
          }
        }
      }

      // Hit millipede segments
      if (!hit) {
        for (let si = 0; si < this.segments.length; si++) {
          const seg = this.segments[si];
          if (Math.hypot(b.x - seg.x, b.y - seg.y) < 16) {
            const c = Math.max(0, Math.min(COLS - 1, Math.floor(seg.x / TILE)));
            const r = Math.max(1, Math.min(ROWS - 2, Math.floor(seg.y / TILE)));
            this.grid[r][c] = { kind: 'mush', hp: 4, poisoned: false };
            if (si + 1 < this.segments.length) this.segments[si + 1].isHead = true;
            this.segments.splice(si, 1);
            if (!isAttract) arcadeAudio.playExplosion(false);
            spawnBurst(this.particles, seg.x, seg.y, '#F97316', 14, 190);
            this.addScore(seg.isHead ? 100 : 10, seg.x, seg.y, '#FDE047');
            hit = true;
            break;
          }
        }
      }

      // Hit mushroom / flower
      if (!hit) {
        const mc = Math.floor(b.x / TILE);
        const mr = Math.floor(b.y / TILE);
        const cell = this.grid[mr]?.[mc];
        if (cell) {
          cell.hp -= 1;
          hit = true;
          if (cell.hp <= 0) {
            this.grid[mr][mc] = null;
            this.addScore(cell.kind === 'flower' ? 5 : 1);
          }
        }
      }

      if (hit) this.bullets.splice(i, 1);
    }
  }

  private updateSegments(dt: number, isAttract: boolean): void {
    const speed = Math.min(370, 190 + (this.level - 1) * 22);
    for (const seg of this.segments) {
      seg.wiggle += dt * 18;
      const spd = seg.diving ? speed * 1.45 : speed;
      const targetY = seg.targetRow * TILE + TILE * 0.5;

      if (seg.diving) {
        seg.y += spd * dt;
        if (Math.floor(seg.y / TILE) >= PLAYER_MIN_ROW) {
          seg.diving = false;
          seg.targetRow = PLAYER_MIN_ROW;
          seg.y = seg.targetRow * TILE + TILE * 0.5;
        }
      } else if (Math.abs(seg.y - targetY) > 1.5) {
        seg.y += Math.sign(targetY - seg.y) * Math.min(Math.abs(targetY - seg.y), spd * 1.15 * dt);
      } else {
        seg.y = targetY;
        const nx = seg.x + seg.dir * spd * dt;
        const aheadCol = Math.floor((nx + seg.dir * TILE * 0.44) / TILE);
        const wall = aheadCol < 0 || aheadCol >= COLS;
        const cell = !wall ? this.grid[seg.targetRow]?.[aheadCol] : null;
        if (wall || cell) {
          if (cell && (cell.poisoned || cell.kind === 'flower') && seg.targetRow < PLAYER_MIN_ROW) {
            seg.diving = true;
          } else {
            seg.dir = seg.dir === 1 ? -1 : 1;
            if (!seg.goingUp) {
              seg.targetRow += 1;
              if (seg.targetRow >= ROWS - 1) {
                seg.targetRow = ROWS - 2;
                seg.goingUp = true;
              }
            } else {
              seg.targetRow -= 1;
              if (seg.targetRow <= PLAYER_MIN_ROW) {
                seg.targetRow = PLAYER_MIN_ROW;
                seg.goingUp = false;
              }
            }
          }
        } else {
          seg.x = nx;
        }
      }

      if (!isAttract && this.invulnTimer <= 0 && Math.hypot(seg.x - this.playerX, seg.y - this.playerY) < 19) {
        this.handlePlayerHit();
        return;
      }
    }
  }

  private updateBugs(dt: number, isAttract: boolean): void {
    this.bugSpawnTimer -= dt;
    if (this.bugSpawnTimer <= 0 && this.bugs.length < 3) {
      this.bugSpawnTimer = Math.max(2.1, 4.2 - this.level * 0.25);
      const roll = Math.random();
      const fromLeft = Math.random() < 0.5;
      if (roll < 0.3) {
        this.bugs.push({
          kind: 'spider',
          x: fromLeft ? -14 : WIDTH + 14,
          y: (PLAYER_MIN_ROW + 2) * TILE,
          vx: (fromLeft ? 1 : -1) * 145,
          vy: 150,
          hp: 1,
          timer: 0.5,
          anim: 0,
        });
      } else if (roll < 0.52) {
        this.bugs.push({
          kind: 'beetle',
          x: fromLeft ? -14 : WIDTH + 14,
          y: (PLAYER_MIN_ROW - 1) * TILE + TILE * 0.5,
          vx: (fromLeft ? 1 : -1) * 135,
          vy: 0,
          hp: 1,
          timer: 1,
          anim: 0,
        });
      } else if (roll < 0.72) {
        this.bugs.push({
          kind: 'inchworm',
          x: fromLeft ? -14 : WIDTH + 14,
          y: (8 + Math.floor(Math.random() * 12)) * TILE + TILE * 0.5,
          vx: (fromLeft ? 1 : -1) * 95,
          vy: 0,
          hp: 1,
          timer: 1,
          anim: 0,
        });
      } else if (roll < 0.88) {
        this.bugs.push({
          kind: 'mosquito',
          x: 40 + Math.random() * (WIDTH - 80),
          y: TILE,
          vx: (Math.random() < 0.5 ? -1 : 1) * 165,
          vy: 120,
          hp: 1,
          timer: 0.6,
          anim: 0,
        });
      } else {
        this.bugs.push({
          kind: 'earwig',
          x: fromLeft ? -16 : WIDTH + 16,
          y: (4 + Math.floor(Math.random() * 14)) * TILE + TILE * 0.5,
          vx: (fromLeft ? 1 : -1) * 175,
          vy: 0,
          hp: 1,
          timer: 1,
          anim: 0,
        });
      }
    }

    for (let i = this.bugs.length - 1; i >= 0; i--) {
      const bug = this.bugs[i];
      bug.anim += dt * 14;
      bug.x += bug.vx * dt;
      bug.y += bug.vy * dt;

      if (bug.kind === 'spider') {
        bug.timer -= dt;
        if (bug.timer <= 0) {
          bug.timer = 0.35 + Math.random() * 0.45;
          bug.vy = (Math.random() < 0.5 ? -1 : 1) * 165;
        }
        if (bug.y < (PLAYER_MIN_ROW - 2) * TILE) bug.vy = Math.abs(bug.vy);
        if (bug.y > (ROWS - 1.5) * TILE) bug.vy = -Math.abs(bug.vy);
      } else if (bug.kind === 'mosquito') {
        if (bug.x < 18 || bug.x > WIDTH - 18) bug.vx = -bug.vx;
      } else if (bug.kind === 'beetle') {
        const c = Math.floor(bug.x / TILE);
        const r = Math.floor(bug.y / TILE);
        if (this.grid[r]?.[c]) {
          this.grid[r][c]!.kind = 'flower';
        }
      } else if (bug.kind === 'earwig') {
        const c = Math.floor(bug.x / TILE);
        const r = Math.floor(bug.y / TILE);
        if (this.grid[r]?.[c]) {
          this.grid[r][c]!.poisoned = true;
        }
      }

      if (bug.x < -40 || bug.x > WIDTH + 40 || bug.y > HEIGHT + 30) {
        this.bugs.splice(i, 1);
        continue;
      }

      if (!isAttract && this.invulnTimer <= 0 && Math.hypot(bug.x - this.playerX, bug.y - this.playerY) < 20) {
        this.handlePlayerHit();
        return;
      }
    }
  }

  private handlePlayerHit(): void {
    arcadeAudio.playDeath();
    spawnBurst(this.particles, this.playerX, this.playerY, '#FB923C', 26, 260, 4);
    this.lives -= 1;
    this.bullets = [];
    this.bugs = [];
    if (this.lives <= 0) {
      this.phase = 'GAME_OVER';
      this.bannerText = 'GAME OVER';
      return;
    }
    this.spawnWave(this.level);
    this.resetPlayer();
    this.phase = 'READY';
    this.phaseTimer = 1.2;
    this.bannerText = 'READY!';
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Rich cosmic indigo-amber arena (shifts icy cyan during Inchworm Slow-Mo!)
    const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    if (this.slowMoTimer > 0) {
      bg.addColorStop(0, '#07142C');
      bg.addColorStop(1, '#040B1A');
    } else {
      bg.addColorStop(0, '#0B0616');
      bg.addColorStop(1, '#120812');
    }
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Ambient twilight spores
    for (let i = 0; i < 24; i++) {
      const sx = ((i * 191 + Math.cos(this.time * 0.8 + i) * 16) + WIDTH) % WIDTH;
      const sy = (i * 263 + this.time * 9) % HEIGHT;
      ctx.fillStyle = this.slowMoTimer > 0 ? 'rgba(56,189,248,0.16)' : 'rgba(251,146,60,0.12)';
      ctx.beginPath();
      ctx.arc(sx, sy, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Subtle zone divider
    ctx.save();
    ctx.fillStyle = 'rgba(249, 115, 22, 0.04)';
    ctx.fillRect(0, PLAYER_MIN_ROW * TILE, WIDTH, HEIGHT - PLAYER_MIN_ROW * TILE);
    ctx.strokeStyle = 'rgba(249, 115, 22, 0.28)';
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, PLAYER_MIN_ROW * TILE);
    ctx.lineTo(WIDTH, PLAYER_MIN_ROW * TILE);
    ctx.stroke();
    ctx.restore();

    // Mushrooms & flowers
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = this.grid[r][c];
        if (!cell) continue;
        const cx = c * TILE + TILE * 0.5;
        const cy = r * TILE + TILE * 0.5;
        if (cell.kind === 'flower') {
          this.drawFlower(ctx, cx, cy);
        } else {
          this.drawMushroom(ctx, cx, cy, cell);
        }
      }
    }

    // DDT Bomb Canisters
    for (const d of this.ddtBombs) {
      this.drawDdtBomb(ctx, d.col * TILE + TILE * 0.5, d.row * TILE + TILE * 0.5);
    }

    // Expanding volumetric DDT Blast Clouds with shockwave ring
    for (const cloud of this.ddtClouds) {
      const alpha = Math.max(0, cloud.life / cloud.maxLife);
      ctx.save();
      const grad = ctx.createRadialGradient(cloud.x, cloud.y, 4, cloud.x, cloud.y, cloud.radius);
      grad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.9})`);
      grad.addColorStop(0.32, `rgba(254, 240, 138, ${alpha * 0.85})`);
      grad.addColorStop(0.68, `rgba(249, 115, 22, ${alpha * 0.58})`);
      grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(254, 240, 138, ${alpha * 0.7})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cloud.x, cloud.y, cloud.radius * 0.94, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Glowing cyan energy bolts
    for (const b of this.bullets) {
      ctx.save();
      ctx.shadowColor = '#38BDF8';
      ctx.shadowBlur = 12;
      const bgBolt = ctx.createLinearGradient(0, b.y - 11, 0, b.y + 9);
      bgBolt.addColorStop(0, '#FFFFFF');
      bgBolt.addColorStop(0.5, '#38BDF8');
      bgBolt.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = bgBolt;
      ctx.beginPath();
      ctx.roundRect(b.x - 2.6, b.y - 11, 5.2, 20, 2.5);
      ctx.fill();
      ctx.restore();
    }

    // Bugs
    for (const bug of this.bugs) {
      this.drawBug(ctx, bug);
    }

    // Millipede Segments
    for (let i = this.segments.length - 1; i >= 0; i--) {
      this.drawSegment(ctx, this.segments[i]);
    }

    // Player archer/blaster
    if (this.phase !== 'GAME_OVER') {
      const blink = this.invulnTimer > 0 && Math.floor(this.time * 16) % 2 === 0;
      if (!blink) this.drawPlayer(ctx, this.playerX, this.playerY);
    }

    renderParticlesAndPopups(ctx, this.particles, this.popups);

    if (this.bannerText && (this.phase === 'READY' || this.phase === 'STAGE_CLEAR')) {
      ctx.save();
      ctx.font = '800 28px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(4, 6, 13, 0.85)';
      ctx.fillRect(WIDTH * 0.2, HEIGHT * 0.44, WIDTH * 0.6, 56);
      ctx.strokeStyle = '#FB923C';
      ctx.lineWidth = 2;
      ctx.strokeRect(WIDTH * 0.2, HEIGHT * 0.44, WIDTH * 0.6, 56);
      ctx.fillStyle = '#FB923C';
      ctx.fillText(this.bannerText, WIDTH * 0.5, HEIGHT * 0.44 + 28);
      ctx.restore();
    }

    if (visualMode === 'crt') renderCrtOverlay(ctx, WIDTH, HEIGHT);
  }

  private drawMushroom(ctx: CanvasRenderingContext2D, x: number, y: number, m: MilliTile): void {
    const dmg = 4 - m.hp;
    ctx.save();
    ctx.translate(x, y);
    if (m.poisoned) {
      ctx.shadowColor = '#E879F9';
      ctx.shadowBlur = 10;
    }
    const stemG = ctx.createLinearGradient(-4, 0, 4, 0);
    stemG.addColorStop(0, '#9A3412');
    stemG.addColorStop(0.5, '#FED7AA');
    stemG.addColorStop(1, '#C2410C');
    ctx.fillStyle = stemG;
    ctx.beginPath();
    ctx.roundRect(-4.2, -0.5, 8.4, Math.max(3, 9.2 - dmg * 1.4), [1, 1, 3, 3]);
    ctx.fill();

    const capR = 10.2 - dmg * 0.75;
    const capG = ctx.createRadialGradient(-3, -6, 1, 0, -2, capR + 2);
    capG.addColorStop(0, '#FFF7ED');
    capG.addColorStop(0.32, m.poisoned ? '#E879F9' : '#F97316');
    capG.addColorStop(1, m.poisoned ? '#581C87' : '#7C2D12');
    ctx.fillStyle = capG;
    ctx.beginPath();
    ctx.arc(0, 0.5, capR, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(-3.5, -4.5, 1.7, 0, Math.PI * 2);
    ctx.arc(3.5, -5, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawFlower(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#16A34A';
    ctx.fillRect(-2, 1, 4, 9);
    // Tiny leaves
    ctx.fillStyle = '#4ADE80';
    ctx.beginPath();
    ctx.ellipse(-4.5, 6, 3, 1.6, -0.4, 0, Math.PI * 2);
    ctx.ellipse(4.5, 6, 3, 1.6, 0.4, 0, Math.PI * 2);
    ctx.fill();
    // 5 shaded magenta petals
    for (let a = 0; a < 5; a++) {
      const ang = (a / 5) * Math.PI * 2 + Math.sin(this.time * 2 + x) * 0.08;
      const px = Math.cos(ang) * 5.2;
      const py = Math.sin(ang) * 5.2 - 2.5;
      ctx.fillStyle = '#EC4899';
      ctx.beginPath();
      ctx.arc(px, py, 3.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FBCFE8';
      ctx.beginPath();
      ctx.arc(px - 0.8, py - 0.8, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#FDE047';
    ctx.beginPath();
    ctx.arc(0, -2.5, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawDdtBomb(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const pulse = 0.85 + Math.sin(this.time * 7) * 0.15;
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = '#EF4444';
    ctx.shadowBlur = 12 * pulse;

    // Metallic pressurized canister body
    const cg = ctx.createLinearGradient(-10, -10, 10, 10);
    cg.addColorStop(0, '#F87171');
    cg.addColorStop(0.45, '#DC2626');
    cg.addColorStop(1, '#7F1D1D');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.roundRect(-10.5, -10.5, 21, 21, 4);
    ctx.fill();

    // Caution yellow top/bottom bands & rivet caps
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#FACC15';
    ctx.fillRect(-10, -10, 20, 3);
    ctx.fillRect(-10, 7, 20, 3);
    ctx.strokeStyle = '#FEF08A';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-9.5, -9.5, 19, 19);

    ctx.fillStyle = '#FEF08A';
    ctx.font = '900 8.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DDT', 0, 0.5);
    ctx.restore();
  }

  private drawSegment(ctx: CanvasRenderingContext2D, seg: MilliSegment): void {
    ctx.save();
    ctx.translate(seg.x, seg.y);
    const swing = Math.sin(seg.wiggle) * 4;
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-5, -7);
    ctx.lineTo(-10, -13 + swing);
    ctx.moveTo(5, -7);
    ctx.lineTo(10, -13 - swing);
    ctx.moveTo(-5, 7);
    ctx.lineTo(-10, 13 - swing);
    ctx.moveTo(5, 7);
    ctx.lineTo(10, 13 + swing);
    ctx.stroke();

    const grad = ctx.createRadialGradient(-3.5, -3.5, 1, 0, 0, 11.5);
    grad.addColorStop(0, '#FFFBEB');
    grad.addColorStop(0.35, seg.isHead ? '#EF4444' : '#F97316');
    grad.addColorStop(1, '#7C2D12');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    if (seg.isHead) {
      // Glowing cyan mandibles & arcade eyes
      const ex = seg.dir * 4.5;
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(seg.dir * 9, -4);
      ctx.lineTo(seg.dir * 14, -2);
      ctx.moveTo(seg.dir * 9, 4);
      ctx.lineTo(seg.dir * 14, 2);
      ctx.stroke();
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(ex, -4, 3.1, 0, Math.PI * 2);
      ctx.arc(ex, 4, 3.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(ex + seg.dir * 1, -4, 1.3, 0, Math.PI * 2);
      ctx.arc(ex + seg.dir * 1, 4, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawBug(ctx: CanvasRenderingContext2D, bug: BugEntity): void {
    ctx.save();
    ctx.translate(bug.x, bug.y);
    if (bug.kind === 'inchworm') {
      const arch = Math.sin(bug.anim) * 5;
      ctx.strokeStyle = '#15803D';
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-12, 3);
      ctx.quadraticCurveTo(0, -11 + arch, 12, 3);
      ctx.stroke();
      ctx.strokeStyle = '#4ADE80';
      ctx.lineWidth = 5.5;
      ctx.stroke();
      const hx = bug.vx > 0 ? 12 : -12;
      ctx.fillStyle = '#FDE047';
      ctx.beginPath();
      ctx.arc(hx, 2, 3.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(hx - 1, 0.5, 2, 2);
    } else if (bug.kind === 'beetle') {
      const bg = ctx.createRadialGradient(-3, -3, 1, 0, 0, 13);
      bg.addColorStop(0, '#F3E8FF');
      bg.addColorStop(0.4, '#A855F7');
      bg.addColorStop(1, '#3B0764');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12.5, 9.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#E9D5FF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -8.5);
      ctx.lineTo(0, 8.5);
      ctx.stroke();
      ctx.fillStyle = '#FDE047';
      ctx.beginPath();
      ctx.arc(-4.5, -2, 1.8, 0, Math.PI * 2);
      ctx.arc(4.5, -2, 1.8, 0, Math.PI * 2);
      ctx.fill();
    } else if (bug.kind === 'mosquito') {
      const wing = Math.sin(bug.anim * 2.8) * 7;
      ctx.fillStyle = 'rgba(186, 230, 253, 0.78)';
      ctx.beginPath();
      ctx.ellipse(-10, -4 + wing * 0.4, 9, 4, -0.35, 0, Math.PI * 2);
      ctx.ellipse(10, -4 - wing * 0.4, 9, 4, 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F43F5E';
      ctx.beginPath();
      ctx.ellipse(0, 0, 5.5, 11.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 10);
      ctx.lineTo(0, 17);
      ctx.stroke();
    } else if (bug.kind === 'earwig') {
      const dir = bug.vx >= 0 ? 1 : -1;
      ctx.scale(dir, 1);
      const eg = ctx.createLinearGradient(-14, -6, 14, 6);
      eg.addColorStop(0, '#F59E0B');
      eg.addColorStop(0.5, '#FEF08A');
      eg.addColorStop(1, '#B45309');
      ctx.fillStyle = eg;
      ctx.beginPath();
      ctx.ellipse(0, 0, 14.5, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(-12, -3);
      ctx.quadraticCurveTo(-18, -9, -21, -4);
      ctx.moveTo(-12, 3);
      ctx.quadraticCurveTo(-18, 9, -21, 4);
      ctx.stroke();
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(9, -2, 1.8, 0, Math.PI * 2);
      ctx.arc(9, 2, 1.8, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Spider
      ctx.strokeStyle = '#FDE047';
      ctx.lineWidth = 2.3;
      ctx.lineCap = 'round';
      for (const s of [-1, 1]) {
        for (let l = -1; l <= 1; l++) {
          ctx.beginPath();
          ctx.moveTo(s * 6, l * 4);
          ctx.lineTo(s * 14, l * 5 - 4 + Math.sin(bug.anim + l) * 4);
          ctx.lineTo(s * 20, l * 6 + 4 - Math.sin(bug.anim + l) * 3);
          ctx.stroke();
        }
      }
      const sg = ctx.createRadialGradient(-3, -3, 1, 0, 0, 13);
      sg.addColorStop(0, '#FCE7F3');
      sg.addColorStop(0.4, '#EC4899');
      sg.addColorStop(1, '#831843');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12.5, 8.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-4, -2, 2.3, 0, Math.PI * 2);
      ctx.arc(4, -2, 2.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = '#FB923C';
    ctx.shadowBlur = 12;
    const hull = ctx.createLinearGradient(-12, -15, 12, 11);
    hull.addColorStop(0, '#FFFBEB');
    hull.addColorStop(0.5, '#FDE68A');
    hull.addColorStop(1, '#D97706');
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(13, 5);
    ctx.lineTo(7, 12);
    ctx.lineTo(-7, 12);
    ctx.lineTo(-13, 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#38BDF8';
    ctx.beginPath();
    ctx.arc(0, 1.5, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-1.5, 0, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

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

export type ArenaTwinStickVariant = 'berzerk' | 'robotron';

interface MazeWall {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ArenaEnemy {
  id: number;
  kind: 'robot' | 'grunt' | 'hulk' | 'sphereoid' | 'brain' | 'enforcer' | 'prog';
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  fireCd: number;
  color: string;
}

interface ArenaHuman {
  x: number;
  y: number;
  vx: number;
  vy: number;
  name: string;
  color: string;
}

interface ArenaShot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fromEnemy: boolean;
  ownerId?: number;
  color: string;
}

export class ArenaTwinStickGame implements ArcadeGameInstance {
  public readonly logicalWidth = 760;
  public readonly logicalHeight = 560;
  public readonly supportsPointerAim = true;
  public readonly primaryActionLabel: string;

  private readonly variant: ArenaTwinStickVariant;
  private readonly storageKey: string;
  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();

  private score = 0;
  private highScore = 0;
  private level = 1;
  private lives = 3;
  private clock = 0;
  private stateTimer = 0;
  private nextId = 1;

  private px = 380;
  private py = 280;
  private aimX = 1;
  private aimY = 0;
  private fireCd = 0;
  private invulnTimer = 0;

  // Berzerk authentic 5x3 pillar maze + room clear bonus + Evil Otto!
  private walls: MazeWall[] = [];
  private roomRobotsInitial = 0;
  private ottoActive = false;
  private ottoTimer = 14;
  private ottoX = 60;
  private ottoY = 60;

  // Robotron: 2084 authentic Electrodes + Humans (Mom, Dad, Mikey) + Brains->Progs + Sphereoids->Enforcers!
  private electrodes: Array<{ x: number; y: number }> = [];
  private humans: ArenaHuman[] = [];
  private humanStreak = 0;
  private enemies: ArenaEnemy[] = [];
  private shots: ArenaShot[] = [];
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  constructor(variant: ArenaTwinStickVariant) {
    this.variant = variant;
    this.storageKey = `${variant}_hd_highscore_v2`;
    this.highScore = readHighScore(this.storageKey);
    this.primaryActionLabel = variant === 'berzerk' ? 'Laser Fire' : '360° Twin-Stick Fire';
    this.setupRoom(1, 'left');
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public startNewGame(): void {
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.humanStreak = 0;
    this.phase = 'READY';
    this.stateTimer = 0.85;
    this.setupRoom(1, 'left');
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.setupRoom(1, 'left');
  }

  private addScore(pts: number, x?: number, y?: number, label?: string): void {
    this.score += pts;
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
        life: 0.85,
        maxLife: 0.85,
      });
    }
  }

  private setupRoom(lvl: number, entry: 'left' | 'right' | 'top' | 'bottom'): void {
    this.walls = [];
    this.enemies = [];
    this.shots = [];
    this.electrodes = [];
    this.humans = [];
    this.invulnTimer = 1.1;

    const W = this.logicalWidth;
    const H = this.logicalHeight;

    if (this.variant === 'berzerk') {
      // Authentic Berzerk electrified perimeter with 4 open doorways!
      const t = 14;
      const gapX = 110;
      const gapY = 96;
      this.walls.push(
        { x: 0, y: 0, w: W * 0.5 - gapX * 0.5, h: t },
        { x: W * 0.5 + gapX * 0.5, y: 0, w: W * 0.5 - gapX * 0.5, h: t },
        { x: 0, y: H - t, w: W * 0.5 - gapX * 0.5, h: t },
        { x: W * 0.5 + gapX * 0.5, y: H - t, w: W * 0.5 - gapX * 0.5, h: t },
        { x: 0, y: 0, w: t, h: H * 0.5 - gapY * 0.5 },
        { x: 0, y: H * 0.5 + gapY * 0.5, w: t, h: H * 0.5 - gapY * 0.5 },
        { x: W - t, y: 0, w: t, h: H * 0.5 - gapY * 0.5 },
        { x: W - t, y: H * 0.5 + gapY * 0.5, w: t, h: H * 0.5 - gapY * 0.5 },
      );

      // Authentic 5x3 pillar grid with randomized electric interior segments!
      const cols = 4;
      const rows = 2;
      const cw = (W - 140) / cols;
      const ch = (H - 120) / rows;
      for (let r = 1; r <= rows; r++) {
        for (let c = 1; c <= cols; c++) {
          const px = 70 + c * cw - cw * 0.5;
          const py = 60 + r * ch - ch * 0.5;
          const dir = Math.floor(Math.random() * 4);
          if (dir === 0) this.walls.push({ x: px, y: py, w: cw * 0.65, h: 10 });
          else if (dir === 1) this.walls.push({ x: px - cw * 0.65, y: py, w: cw * 0.65, h: 10 });
          else if (dir === 2) this.walls.push({ x: px, y: py, w: 10, h: ch * 0.65 });
          else this.walls.push({ x: px, y: py - ch * 0.65, w: 10, h: ch * 0.65 });
        }
      }

      if (entry === 'left') {
        this.px = 58;
        this.py = H * 0.5;
      } else if (entry === 'right') {
        this.px = W - 58;
        this.py = H * 0.5;
      } else if (entry === 'top') {
        this.px = W * 0.5;
        this.py = 56;
      } else {
        this.px = W * 0.5;
        this.py = H - 56;
      }

      this.ottoActive = false;
      this.ottoTimer = Math.max(9, 16 - lvl * 0.6);
      this.ottoX = this.px;
      this.ottoY = this.py;

      const count = Math.min(11, 5 + lvl);
      this.roomRobotsInitial = count;
      const robotColor = lvl === 1 ? '#FACC15' : lvl === 2 ? '#EF4444' : lvl === 3 ? '#38BDF8' : '#22C55E';
      for (let i = 0; i < count; i++) {
        let rx = 110 + Math.random() * (W - 220);
        let ry = 80 + Math.random() * (H - 160);
        if (Math.hypot(rx - this.px, ry - this.py) < 150 || this.hitsWall(rx, ry, 18)) {
          rx = this.px < W * 0.5 ? W - 130 : 130;
          ry = 110 + (i % 4) * 95;
        }
        this.enemies.push({
          id: this.nextId++,
          kind: 'robot',
          x: rx,
          y: ry,
          vx: 0,
          vy: 0,
          hp: 1,
          fireCd: 1.0 + Math.random() * 1.4,
          color: robotColor,
        });
      }
      return;
    }

    // Robotron: 2084 Authentic Wave Setup!
    this.px = W * 0.5;
    this.py = H * 0.5;
    this.humanStreak = 0;
    const isBrainWave = lvl % 5 === 0;

    // Stationary lethal Electrodes
    for (let i = 0; i < 6 + Math.min(8, lvl); i++) {
      let ex = 55 + Math.random() * (W - 110);
      let ey = 55 + Math.random() * (H - 110);
      if (Math.hypot(ex - this.px, ey - this.py) < 110) ex = ex < W * 0.5 ? 65 : W - 65;
      this.electrodes.push({ x: ex, y: ey });
    }

    // Last Human Family (Mom, Dad, Mikey)
    const names = ['MOM', 'DAD', 'MIKEY'];
    const hCols = ['#F472B6', '#38BDF8', '#4ADE80'];
    const hCount = isBrainWave ? 8 : 5;
    for (let i = 0; i < hCount; i++) {
      this.humans.push({
        x: 70 + Math.random() * (W - 140),
        y: 70 + Math.random() * (H - 140),
        vx: (Math.random() - 0.5) * 45,
        vy: (Math.random() - 0.5) * 45,
        name: names[i % 3],
        color: hCols[i % 3],
      });
    }

    const spawnFar = () => {
      let x = 45 + Math.random() * (W - 90);
      let y = 45 + Math.random() * (H - 90);
      if (Math.hypot(x - this.px, y - this.py) < 165) {
        x = x < W * 0.5 ? 55 : W - 55;
        y = y < H * 0.5 ? 55 : H - 55;
      }
      return { x, y };
    };

    // Grunts
    const grunts = isBrainWave ? 6 : Math.min(20, 8 + lvl * 2);
    for (let i = 0; i < grunts; i++) {
      const p = spawnFar();
      this.enemies.push({ id: this.nextId++, kind: 'grunt', x: p.x, y: p.y, vx: 0, vy: 0, hp: 1, fireCd: 99, color: '#EF4444' });
    }
    // Indestructible Hulks!
    for (let i = 0; i < Math.min(5, 1 + Math.floor(lvl / 2)); i++) {
      const p = spawnFar();
      this.enemies.push({ id: this.nextId++, kind: 'hulk', x: p.x, y: p.y, vx: 0, vy: 0, hp: 999, fireCd: 99, color: '#22C55E' });
    }
    // Sphereoids (spawn firing Enforcers!)
    for (let i = 0; i < Math.min(4, 1 + Math.floor(lvl / 2)); i++) {
      const p = spawnFar();
      this.enemies.push({ id: this.nextId++, kind: 'sphereoid', x: p.x, y: p.y, vx: 70, vy: 50, hp: 1, fireCd: 2.6, color: '#FACC15' });
    }
    // Brains (convert Humans into deadly Progs!)
    const brains = isBrainWave ? 5 : lvl >= 2 ? 2 : 0;
    for (let i = 0; i < brains; i++) {
      const p = spawnFar();
      this.enemies.push({ id: this.nextId++, kind: 'brain', x: p.x, y: p.y, vx: 0, vy: 0, hp: 1, fireCd: 2.4, color: '#A855F7' });
    }
  }

  private hitsWall(x: number, y: number, r: number): boolean {
    for (const w of this.walls) {
      if (x + r > w.x && x - r < w.x + w.w && y + r > w.y && y - r < w.y + w.h) return true;
    }
    return false;
  }

  private killPlayer(): void {
    if (this.invulnTimer > 0 || this.phase !== 'PLAYING') return;
    this.lives -= 1;
    this.invulnTimer = 1.8;
    arcadeAudio.playDeath();
    spawnBurst(this.particles, this.px, this.py, '#38BDF8', 24, 240, 3.6);
    if (this.lives <= 0) this.phase = 'GAME_OVER';
    else if (this.variant === 'berzerk') {
      this.setupRoom(this.level, 'left');
    } else {
      this.px = this.logicalWidth * 0.5;
      this.py = this.logicalHeight * 0.5;
      this.shots = [];
    }
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
        this.setupRoom(this.level, 'left');
      }
      return;
    }

    const attract = this.phase === 'TITLE';
    this.fireCd = Math.max(0, this.fireCd - dt);
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);

    // Player movement
    let dx = 0;
    let dy = 0;
    if (attract) {
      dx = Math.cos(this.clock * 1.6);
      dy = Math.sin(this.clock * 1.2);
    } else {
      if (this.input.left) dx -= 1;
      if (this.input.right) dx += 1;
      if (this.input.up) dy -= 1;
      if (this.input.down) dy += 1;
    }

    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      const spd = this.variant === 'berzerk' ? 185 : 235;
      const nx = this.px + (dx / len) * spd * dt;
      const ny = this.py + (dy / len) * spd * dt;
      if (this.variant === 'berzerk') {
        if (this.hitsWall(nx, ny, 12)) {
          if (!attract) this.killPlayer(); // Berzerk walls are ELECTRIFIED!
          return;
        }
        this.px = nx;
        this.py = ny;
      } else {
        this.px = Math.max(24, Math.min(this.logicalWidth - 24, nx));
        this.py = Math.max(24, Math.min(this.logicalHeight - 24, ny));
      }
      if (!this.input.pointerActive) {
        this.aimX = dx / len;
        this.aimY = dy / len;
      }
    }

    if (!attract && this.input.pointerActive) {
      const ax = this.input.pointerX - this.px;
      const ay = this.input.pointerY - this.py;
      const alen = Math.hypot(ax, ay) || 1;
      this.aimX = ax / alen;
      this.aimY = ay / alen;
    }

    // Berzerk room exits!
    if (this.variant === 'berzerk' && !attract) {
      let exit: 'left' | 'right' | 'top' | 'bottom' | null = null;
      if (this.px < 10) exit = 'right';
      else if (this.px > this.logicalWidth - 10) exit = 'left';
      else if (this.py < 10) exit = 'bottom';
      else if (this.py > this.logicalHeight - 10) exit = 'top';
      if (exit) {
        if (this.enemies.length === 0) {
          this.addScore(this.roomRobotsInitial * 10, this.logicalWidth * 0.5, 250, 'ROOM CLEAR BONUS');
        }
        this.level += 1;
        arcadeAudio.playPowerUp();
        this.setupRoom(this.level, exit);
        return;
      }
    }

    // Firing
    const wantFire = attract ? Math.sin(this.clock * 6) > 0.72 : this.input.fire || this.input.fireJustPressed || (this.variant === 'robotron' && this.input.pointerActive);
    if (wantFire && this.fireCd <= 0) {
      this.fireCd = this.variant === 'berzerk' ? 0.22 : 0.1;
      // Snap Berzerk fire to crisp 8-way directions!
      let fx = this.aimX;
      let fy = this.aimY;
      if (this.variant === 'berzerk') {
        const oct = Math.round(Math.atan2(fy, fx) / (Math.PI / 4)) * (Math.PI / 4);
        fx = Math.cos(oct);
        fy = Math.sin(oct);
      }
      this.shots.push({
        x: this.px + fx * 16,
        y: this.py + fy * 16,
        vx: fx * 540,
        vy: fy * 540,
        fromEnemy: false,
        color: this.variant === 'berzerk' ? '#4ADE80' : '#FEF08A',
      });
      if (!attract) arcadeAudio.playLaser();
    }

    if (this.variant === 'berzerk') {
      this.stepBerzerk(dt, attract);
    } else {
      this.stepRobotron(dt, attract);
    }
  }

  private stepBerzerk(dt: number, attract: boolean): void {
    // Evil Otto timer
    this.ottoTimer -= dt;
    if (this.ottoTimer <= 0 && !this.ottoActive) {
      this.ottoActive = true;
      this.ottoX = this.px < this.logicalWidth * 0.5 ? this.logicalWidth - 40 : 40;
      this.ottoY = 60;
      if (!attract) {
        this.popups.push({ x: this.logicalWidth * 0.5, y: 80, text: 'INTRUDER ALERT! EVIL OTTO!', color: '#FACC15', life: 1.4, maxLife: 1.4 });
      }
    }
    if (this.ottoActive) {
      const ang = Math.atan2(this.py - this.ottoY, this.px - this.ottoX);
      const oSpd = this.enemies.length === 0 ? 195 : 112;
      this.ottoX += Math.cos(ang) * oSpd * dt;
      this.ottoY += Math.sin(ang) * oSpd * dt;
      if (!attract && Math.hypot(this.ottoX - this.px, this.ottoY - this.py) < 22) {
        this.killPlayer();
        return;
      }
    }

    // Robots move & shoot STRICTLY in 8 directions when aligned (and can shoot/electrocute EACH OTHER!)
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const r = this.enemies[i];
      const dx = this.px - r.x;
      const dy = this.py - r.y;
      const rSpd = 58 + this.level * 5;
      const stepX = Math.abs(dx) > 16 ? Math.sign(dx) : 0;
      const stepY = Math.abs(dy) > 16 ? Math.sign(dy) : 0;
      r.x += stepX * rSpd * dt;
      r.y += stepY * rSpd * dt;

      // Robot walks into electrified wall -> fries itself!
      if (this.hitsWall(r.x, r.y, 12)) {
        spawnBurst(this.particles, r.x, r.y, r.color, 14, 180, 3);
        if (!attract) {
          arcadeAudio.playExplosion(false);
          this.addScore(50, r.x, r.y);
        }
        this.enemies.splice(i, 1);
        continue;
      }

      // Authentic 8-way laser alignment check
      r.fireCd -= dt;
      const alignedHoriz = Math.abs(dy) < 22;
      const alignedVert = Math.abs(dx) < 22;
      const alignedDiag = Math.abs(Math.abs(dx) - Math.abs(dy)) < 24;
      if (r.fireCd <= 0 && !attract && (alignedHoriz || alignedVert || alignedDiag)) {
        r.fireCd = Math.max(0.95, 2.0 - this.level * 0.08);
        const sx = alignedVert ? 0 : Math.sign(dx);
        const sy = alignedHoriz ? 0 : Math.sign(dy);
        const len = Math.hypot(sx, sy) || 1;
        this.shots.push({
          x: r.x + (sx / len) * 18,
          y: r.y + (sy / len) * 18,
          vx: (sx / len) * 310,
          vy: (sy / len) * 310,
          fromEnemy: true,
          ownerId: r.id,
          color: '#EF4444',
        });
      }

      if (!attract && Math.hypot(r.x - this.px, r.y - this.py) < 22) {
        this.killPlayer();
        return;
      }
    }

    // Update shots (friendly fire kills robots too!)
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.x < 0 || s.x > this.logicalWidth || s.y < 0 || s.y > this.logicalHeight || this.hitsWall(s.x, s.y, 3)) {
        this.shots.splice(i, 1);
        continue;
      }
      if (s.fromEnemy && !attract && Math.hypot(s.x - this.px, s.y - this.py) < 14) {
        this.shots.splice(i, 1);
        this.killPlayer();
        return;
      }
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const r = this.enemies[j];
        if (s.ownerId === r.id) continue;
        if (Math.hypot(r.x - s.x, r.y - s.y) < 17) {
          this.shots.splice(i, 1);
          spawnBurst(this.particles, r.x, r.y, r.color, 14, 190, 3);
          if (!attract) {
            arcadeAudio.playExplosion(false);
            this.addScore(50, r.x, r.y);
          }
          this.enemies.splice(j, 1);
          break;
        }
      }
    }
  }

  private stepRobotron(dt: number, attract: boolean): void {
    // Move & Rescue Humans
    for (let i = this.humans.length - 1; i >= 0; i--) {
      const h = this.humans[i];
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      if (h.x < 35 || h.x > this.logicalWidth - 35) h.vx = -h.vx;
      if (h.y < 35 || h.y > this.logicalHeight - 35) h.vy = -h.vy;
      if (!attract && Math.hypot(h.x - this.px, h.y - this.py) < 24) {
        this.humanStreak = Math.min(5, this.humanStreak + 1);
        const pts = this.humanStreak * 1000;
        arcadeAudio.playPowerUp();
        this.addScore(pts, h.x, h.y, `SAVED ${h.name}!`);
        this.humans.splice(i, 1);
      }
    }

    // Electrodes collision
    for (const el of this.electrodes) {
      if (!attract && Math.hypot(el.x - this.px, el.y - this.py) < 18) {
        this.killPlayer();
        return;
      }
    }

    // Update Robotrons (Grunts, Hulks, Sphereoids->Enforcers, Brains->Progs!)
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.kind === 'grunt' || e.kind === 'prog') {
        const ang = Math.atan2(this.py - e.y, this.px - e.x);
        const spd = e.kind === 'prog' ? 145 : 74 + this.level * 7;
        e.x += Math.cos(ang) * spd * dt;
        e.y += Math.sin(ang) * spd * dt;
      } else if (e.kind === 'hulk') {
        // Indestructible Hulks stomp toward Humans or Player!
        const target = this.humans[0] ?? { x: this.px, y: this.py };
        const ang = Math.atan2(target.y - e.y, target.x - e.x);
        e.x += Math.cos(ang) * 58 * dt;
        e.y += Math.sin(ang) * 58 * dt;
        for (let hi = this.humans.length - 1; hi >= 0; hi--) {
          if (Math.hypot(this.humans[hi].x - e.x, this.humans[hi].y - e.y) < 20) {
            spawnBurst(this.particles, this.humans[hi].x, this.humans[hi].y, '#EF4444', 12, 160, 2.8);
            this.humans.splice(hi, 1);
          }
        }
      } else if (e.kind === 'brain') {
        // Authentic Brain actively hunts Humans and converts them into deadly Progs!
        const target = this.humans[0] ?? { x: this.px, y: this.py };
        const ang = Math.atan2(target.y - e.y, target.x - e.x);
        e.x += Math.cos(ang) * 86 * dt;
        e.y += Math.sin(ang) * 86 * dt;
        for (let hi = this.humans.length - 1; hi >= 0; hi--) {
          if (Math.hypot(this.humans[hi].x - e.x, this.humans[hi].y - e.y) < 22) {
            const hx = this.humans[hi].x;
            const hy = this.humans[hi].y;
            this.humans.splice(hi, 1);
            this.enemies.push({ id: this.nextId++, kind: 'prog', x: hx, y: hy, vx: 0, vy: 0, hp: 1, fireCd: 99, color: '#EC4899' });
            this.popups.push({ x: hx, y: hy - 14, text: 'CONVERTED TO PROG!', color: '#EC4899', life: 0.9, maxLife: 0.9 });
          }
        }
      } else if (e.kind === 'sphereoid') {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        if (e.x < 40 || e.x > this.logicalWidth - 40) e.vx = -e.vx;
        if (e.y < 40 || e.y > this.logicalHeight - 40) e.vy = -e.vy;
        e.fireCd -= dt;
        if (e.fireCd <= 0 && this.enemies.length < 30) {
          e.fireCd = 3.0;
          this.enemies.push({
            id: this.nextId++,
            kind: 'enforcer',
            x: e.x,
            y: e.y,
            vx: (Math.random() - 0.5) * 130,
            vy: (Math.random() - 0.5) * 130,
            hp: 1,
            fireCd: 1.4,
            color: '#38BDF8',
          });
        }
      } else if (e.kind === 'enforcer') {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        if (e.x < 30 || e.x > this.logicalWidth - 30) e.vx = -e.vx;
        if (e.y < 30 || e.y > this.logicalHeight - 30) e.vy = -e.vy;
        e.fireCd -= dt;
        if (e.fireCd <= 0 && !attract) {
          e.fireCd = 1.9;
          const ang = Math.atan2(this.py - e.y, this.px - e.x);
          this.shots.push({ x: e.x, y: e.y, vx: Math.cos(ang) * 230, vy: Math.sin(ang) * 230, fromEnemy: true, color: '#38BDF8' });
        }
      }

      if (!attract && Math.hypot(e.x - this.px, e.y - this.py) < 20) {
        this.killPlayer();
        return;
      }
    }

    // Update shots
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.x < 10 || s.x > this.logicalWidth - 10 || s.y < 10 || s.y > this.logicalHeight - 10) {
        this.shots.splice(i, 1);
        continue;
      }
      if (s.fromEnemy) {
        if (!attract && Math.hypot(s.x - this.px, s.y - this.py) < 14) {
          this.shots.splice(i, 1);
          this.killPlayer();
          return;
        }
        continue;
      }

      // Destroy Electrodes
      let hit = false;
      for (let ei = this.electrodes.length - 1; ei >= 0; ei--) {
        if (Math.hypot(this.electrodes[ei].x - s.x, this.electrodes[ei].y - s.y) < 15) {
          this.electrodes.splice(ei, 1);
          this.shots.splice(i, 1);
          hit = true;
          break;
        }
      }
      if (hit) continue;

      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (Math.hypot(e.x - s.x, e.y - s.y) < 18) {
          this.shots.splice(i, 1);
          if (e.kind === 'hulk') {
            // Authentic Robotron: Hulks are INDESTRUCTIBLE — bullets knock them back!
            e.x += Math.sign(s.vx) * 10;
            e.y += Math.sign(s.vy) * 10;
            arcadeAudio.playRockThud();
          } else {
            spawnBurst(this.particles, e.x, e.y, e.color, 14, 200, 3);
            if (!attract) {
              arcadeAudio.playExplosion(false);
              const pts = e.kind === 'sphereoid' ? 1000 : e.kind === 'brain' ? 500 : e.kind === 'enforcer' ? 150 : 100;
              this.addScore(pts, e.x, e.y);
            }
            this.enemies.splice(j, 1);
          }
          break;
        }
      }
    }

    // Wave cleared when all destroyable Robotrons (everything except Hulks) are eliminated!
    if (!attract && this.enemies.every((e) => e.kind === 'hulk')) {
      arcadeAudio.playStageClear();
      this.addScore(1000, this.logicalWidth * 0.5, 250, 'WAVE CLEARED!');
      this.phase = 'STAGE_CLEAR';
      this.stateTimer = 1.4;
    }
  }

  public getHudSnapshot(): ClassicGameHud {
    if (this.variant === 'berzerk') {
      return {
        phase: this.phase,
        score: this.score,
        highScore: this.highScore,
        level: this.level,
        lives: this.lives,
        stageName: `BERZERK · ROOM ${this.level}`,
        primaryMetricLabel: 'ROBOTS',
        primaryMetricValue: String(this.enemies.length),
        secondaryMetricLabel: 'EVIL OTTO',
        secondaryMetricValue: this.ottoActive ? 'HUNTING!' : `${Math.ceil(this.ottoTimer)}s`,
        bannerText: this.phase === 'GAME_OVER' ? 'THE HUMANOID MUST NOT ESCAPE' : '',
      };
    }
    const destroyable = this.enemies.filter((e) => e.kind !== 'hulk').length;
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: this.level % 5 === 0 ? `ROBOTRON · WAVE ${this.level} (BRAIN WAVE!)` : `ROBOTRON: 2084 · WAVE ${this.level}`,
      primaryMetricLabel: 'ROBOTRONS',
      primaryMetricValue: String(destroyable),
      secondaryMetricLabel: 'HUMANS',
      secondaryMetricValue: String(this.humans.length),
      bannerText: this.phase === 'STAGE_CLEAR' ? 'HUMANITY SURVIVES!' : this.phase === 'GAME_OVER' ? 'GAME OVER' : '',
    };
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = this.logicalWidth;
    const H = this.logicalHeight;

    ctx.fillStyle = '#040610';
    ctx.fillRect(0, 0, W, H);

    if (this.variant === 'berzerk') {
      // Electrified neon blue maze walls
      ctx.fillStyle = '#2563EB';
      ctx.shadowColor = '#38BDF8';
      ctx.shadowBlur = 10;
      for (const w of this.walls) ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.shadowBlur = 0;

      // Evil Otto bouncing smiley!
      if (this.ottoActive) {
        const bounce = Math.abs(Math.sin(this.clock * 8)) * 10;
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.ottoX, this.ottoY - bounce, 16, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(this.ottoX, this.ottoY - bounce + 2, 9, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
      }
    } else {
      // Robotron glowing border frame + Electrodes + Humans
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 4;
      ctx.strokeRect(10, 10, W - 20, H - 20);

      for (const el of this.electrodes) {
        ctx.strokeStyle = '#F472B6';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(el.x - 8, el.y - 8);
        ctx.lineTo(el.x + 8, el.y + 8);
        ctx.moveTo(el.x + 8, el.y - 8);
        ctx.lineTo(el.x - 8, el.y + 8);
        ctx.stroke();
      }

      for (const h of this.humans) {
        ctx.fillStyle = h.color;
        ctx.fillRect(h.x - 5, h.y - 6, 10, 14);
        ctx.fillStyle = '#FDE68A';
        ctx.beginPath();
        ctx.arc(h.x, h.y - 11, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Enemies
    for (const e of this.enemies) {
      ctx.fillStyle = e.color;
      if (e.kind === 'hulk') {
        ctx.fillRect(e.x - 14, e.y - 14, 28, 28);
        ctx.strokeStyle = '#4ADE80';
        ctx.lineWidth = 2;
        ctx.strokeRect(e.x - 14, e.y - 14, 28, 28);
      } else if (e.kind === 'sphereoid') {
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 13, 0, Math.PI * 2);
        ctx.stroke();
      } else if (e.kind === 'brain') {
        ctx.beginPath();
        ctx.arc(e.x, e.y - 2, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(e.x - 5, e.y - 4, 3, 3);
        ctx.fillRect(e.x + 2, e.y - 4, 3, 3);
      } else {
        ctx.fillRect(e.x - 10, e.y - 11, 20, 22);
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(e.x - 6, e.y - 6, 12, 4);
      }
    }

    // Shots
    for (const s of this.shots) {
      ctx.fillStyle = s.color;
      ctx.fillRect(s.x - 3, s.y - 3, 6, 6);
    }

    // Player Hero
    ctx.fillStyle = '#4ADE80';
    ctx.fillRect(this.px - 8, this.py - 8, 16, 18);
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(this.px, this.py - 13, 6, 0, Math.PI * 2);
    ctx.fill();

    renderParticlesAndPopups(ctx, this.particles, this.popups);
    if (this.phase === 'TITLE') {
      ctx.fillStyle = 'rgba(4, 6, 16, 0.72)';
      ctx.fillRect(0, H * 0.36, W, 114);
      ctx.textAlign = 'center';
      ctx.font = '900 34px "JetBrains Mono", monospace';
      ctx.fillStyle = '#4ADE80';
      ctx.fillText(this.variant === 'berzerk' ? 'BERZERK' : 'ROBOTRON: 2084', W * 0.5, H * 0.36 + 46);
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText(
        this.variant === 'berzerk'
          ? 'ELECTRIFIED MAZE · 8-WAY LASER ROBOTS · FRIENDLY FIRE · ESCAPE EVIL OTTO'
          : 'SAVE THE LAST HUMAN FAMILY · BRAINS CREATE PROGS · INDESTRUCTIBLE HULKS',
        W * 0.5,
        H * 0.36 + 80,
      );
    }
    if (visualMode === 'crt') renderCrtOverlay(ctx, W, H);
  }
}

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
const WIDTH = COLS * TILE; // 720
const HEIGHT = ROWS * TILE; // 816
const PLAYER_MIN_ROW = 26;
const STORAGE_KEY = 'centipede_hd_highscore_v1';

interface Mushroom {
  hp: number; // 1..4
  poisoned: boolean;
}

interface Segment {
  id: number;
  x: number; // pixel center
  y: number;
  dir: 1 | -1;
  isHead: boolean;
  diving: boolean;
  targetRow: number;
  goingUp: boolean;
  wiggle: number;
}

interface Bullet {
  x: number;
  y: number;
}

interface Spider {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dirTimer: number;
  anim: number;
}

interface Flea {
  active: boolean;
  x: number;
  y: number;
  hp: number;
  lastDropRow: number;
}

interface Scorpion {
  active: boolean;
  x: number;
  y: number;
  dir: 1 | -1;
  anim: number;
}

interface WavePalette {
  bg: string;
  mushCap: string;
  mushStem: string;
  poisonCap: string;
  segBody: string;
  segHead: string;
  legColor: string;
  spiderColor: string;
}

const WAVE_PALETTES: WavePalette[] = [
  {
    bg: '#050812',
    mushCap: '#22C55E',
    mushStem: '#FDE047',
    poisonCap: '#EC4899',
    segBody: '#84CC16',
    segHead: '#EF4444',
    legColor: '#FDE047',
    spiderColor: '#F43F5E',
  },
  {
    bg: '#060714',
    mushCap: '#38BDF8',
    mushStem: '#F472B6',
    poisonCap: '#FACC15',
    segBody: '#06B6D4',
    segHead: '#F97316',
    legColor: '#FDE047',
    spiderColor: '#A855F7',
  },
  {
    bg: '#0B0612',
    mushCap: '#F97316',
    mushStem: '#34D399',
    poisonCap: '#38BDF8',
    segBody: '#EC4899',
    segHead: '#FACC15',
    legColor: '#38BDF8',
    spiderColor: '#22C55E',
  },
  {
    bg: '#050B0E',
    mushCap: '#A855F7',
    mushStem: '#FDE047',
    poisonCap: '#FB7185',
    segBody: '#F59E0B',
    segHead: '#22D3EE',
    legColor: '#F8FAFC',
    spiderColor: '#F97316',
  },
];

export class CentipedeGame implements ArcadeGameInstance {
  public readonly logicalWidth = WIDTH;
  public readonly logicalHeight = HEIGHT;
  public readonly supportsPointerAim = true;
  public readonly primaryActionLabel = 'Fire';

  private phase: ClassicGamePhase = 'TITLE';
  private score = 0;
  private highScore = readHighScore(STORAGE_KEY);
  private nextExtraLife = 12000;
  private level = 1;
  private lives = 3;
  private phaseTimer = 0;
  private time = 0;
  private bannerText = '';

  private input: ArcadeInputState = createEmptyInput();
  private playerX = WIDTH * 0.5;
  private playerY = (ROWS - 2) * TILE;
  private fireCooldown = 0;
  private invulnTimer = 0;

  private mushrooms: (Mushroom | null)[][] = [];
  private segments: Segment[] = [];
  private bullets: Bullet[] = [];
  private nextSegId = 1;

  private spider: Spider = { active: false, x: 0, y: 0, vx: 0, vy: 0, dirTimer: 0, anim: 0 };
  private flea: Flea = { active: false, x: 0, y: 0, hp: 2, lastDropRow: -1 };
  private scorpion: Scorpion = { active: false, x: 0, y: 0, dir: 1, anim: 0 };
  private spiderSpawnTimer = 4.5;
  private scorpionSpawnTimer = 11;
  private fleaCheckTimer = 2.0;
  private bottomHeadTimer = 7.5;
  private ufoSoundTimer = 0;

  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];
  private attractTargetX = WIDTH * 0.5;

  constructor() {
    this.initField(true);
    this.spawnCentipedeWave(1);
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public startNewGame(): void {
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.nextExtraLife = 12000;
    this.level = 1;
    this.lives = 3;
    this.particles = [];
    this.popups = [];
    this.bullets = [];
    this.initField(true);
    this.resetPlayerPosition();
    this.spawnCentipedeWave(1);
    this.phase = 'READY';
    this.phaseTimer = 1.1;
    this.bannerText = 'WAVE 1';
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') {
      this.phase = 'PAUSED';
    } else if (this.phase === 'PAUSED') {
      this.phase = 'PLAYING';
    }
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.level = 1;
    this.bullets = [];
    this.initField(true);
    this.resetPlayerPosition();
    this.spawnCentipedeWave(1);
  }

  public getHudSnapshot(): ClassicGameHud {
    const mushroomCount = this.countAllMushrooms();
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: `Garden Wave ${this.level}`,
      primaryMetricLabel: 'Segments',
      primaryMetricValue: String(this.segments.length),
      secondaryMetricLabel: 'Mushrooms',
      secondaryMetricValue: String(mushroomCount),
      bannerText: this.bannerText,
    };
  }

  private addScore(pts: number, x?: number, y?: number, color = '#FDE047'): void {
    if (this.phase === 'TITLE') return;
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(STORAGE_KEY, this.highScore);
    }
    if (this.score >= this.nextExtraLife) {
      this.lives = Math.min(6, this.lives + 1);
      this.nextExtraLife += 12000;
      arcadeAudio.playExtraLife();
      this.popups.push({ x: this.playerX, y: this.playerY - 24, text: '1UP!', color: '#4ADE80', life: 1.3, maxLife: 1.3 });
    }
    if (x !== undefined && y !== undefined && pts >= 50) {
      this.popups.push({ x, y, text: `${pts}`, color, life: 0.9, maxLife: 0.9 });
    }
  }

  private initField(fullReset: boolean): void {
    if (fullReset) {
      this.mushrooms = Array.from({ length: ROWS }, () => Array<Mushroom | null>(COLS).fill(null));
      const total = 44;
      for (let i = 0; i < total; i++) {
        const r = 2 + Math.floor(Math.random() * (PLAYER_MIN_ROW - 1));
        const c = 1 + Math.floor(Math.random() * (COLS - 2));
        if (!this.mushrooms[r][c]) {
          this.mushrooms[r][c] = { hp: 4, poisoned: false };
        }
      }
      // Guarantee at least 6 mushrooms in player zone
      for (let i = 0; i < 6; i++) {
        const r = PLAYER_MIN_ROW + Math.floor(Math.random() * 5);
        const c = 2 + Math.floor(Math.random() * (COLS - 4));
        this.mushrooms[r][c] = { hp: 4, poisoned: false };
      }
    }
    this.spider.active = false;
    this.flea.active = false;
    this.scorpion.active = false;
    this.spiderSpawnTimer = Math.max(2.5, 5.2 - this.level * 0.3);
    this.scorpionSpawnTimer = Math.max(6.5, 13 - this.level * 0.8);
    this.bottomHeadTimer = 8;
  }

  private resetPlayerPosition(): void {
    this.playerX = WIDTH * 0.5;
    this.playerY = (ROWS - 2.5) * TILE;
    this.invulnTimer = 1.6;
  }

  private spawnCentipedeWave(wave: number): void {
    this.segments = [];
    const mainLen = Math.max(6, 12 - Math.min(5, wave - 1));
    const extraHeads = Math.min(5, wave - 1);
    const startCol = Math.floor(COLS / 2);

    for (let i = 0; i < mainLen; i++) {
      this.segments.push({
        id: this.nextSegId++,
        x: (startCol - i) * TILE + TILE * 0.5,
        y: TILE * 1.5,
        dir: 1,
        isHead: i === 0,
        diving: false,
        targetRow: 1,
        goingUp: false,
        wiggle: i * 0.55,
      });
    }

    for (let h = 0; h < extraHeads; h++) {
      const fromLeft = h % 2 === 0;
      this.segments.push({
        id: this.nextSegId++,
        x: fromLeft ? TILE * (1 + h) : WIDTH - TILE * (1 + h),
        y: TILE * 1.5,
        dir: fromLeft ? 1 : -1,
        isHead: true,
        diving: false,
        targetRow: 1,
        goingUp: false,
        wiggle: h * 0.9,
      });
    }
  }

  private countAllMushrooms(): number {
    let n = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (this.mushrooms[r][c]) n++;
      }
    }
    return n;
  }

  private countPlayerZoneMushrooms(): number {
    let n = 0;
    for (let r = PLAYER_MIN_ROW; r < ROWS - 1; r++) {
      for (let c = 0; c < COLS; c++) {
        if (this.mushrooms[r][c]) n++;
      }
    }
    return n;
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
        this.spawnCentipedeWave(this.level);
        this.phase = 'READY';
        this.phaseTimer = 1.0;
        this.bannerText = `WAVE ${this.level}`;
      }
      return;
    }

    const isAttract = this.phase === 'TITLE';
    this.updatePlayer(dt, isAttract);
    this.updateBullets(dt, isAttract);
    this.updateSegments(dt, isAttract);
    this.updateEnemies(dt, isAttract);

    if (this.segments.length === 0) {
      if (isAttract) {
        this.spawnCentipedeWave(1);
      } else {
        arcadeAudio.playStageClear();
        // Repair damaged mushrooms for bonus points
        let repaired = 0;
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const m = this.mushrooms[r][c];
            if (m && (m.hp < 4 || m.poisoned)) {
              m.hp = 4;
              m.poisoned = false;
              repaired++;
            }
          }
        }
        if (repaired > 0) {
          this.addScore(repaired * 5, WIDTH * 0.5, HEIGHT * 0.48, '#4ADE80');
        }
        this.phase = 'STAGE_CLEAR';
        this.phaseTimer = 1.3;
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
      // Smart attract-mode AI
      const nearestThreat = this.spider.active
        ? { x: this.spider.x, y: this.spider.y }
        : this.segments[0]
          ? { x: this.segments[0].x, y: this.segments[0].y }
          : { x: WIDTH * 0.5, y: 120 };

      this.attractTargetX = Math.max(minX + 20, Math.min(maxX - 20, nearestThreat.x));
      const dx = this.attractTargetX - this.playerX;
      this.playerX += Math.sign(dx) * Math.min(Math.abs(dx), 290 * dt);
      this.playerY = (ROWS - 2.4) * TILE + Math.sin(this.time * 2.1) * 28;
      if (this.fireCooldown <= 0 && this.bullets.length < 2) {
        this.bullets.push({ x: this.playerX, y: this.playerY - 14 });
        this.fireCooldown = 0.2;
      }
      return;
    }

    const speed = 340;
    let nextX = this.playerX;
    let nextY = this.playerY;

    if (this.input.pointerActive) {
      const targetX = this.input.pointerX * WIDTH;
      const targetY = Math.max(minY, Math.min(maxY, this.input.pointerY * HEIGHT));
      const dx = targetX - this.playerX;
      const dy = targetY - this.playerY;
      const dist = Math.hypot(dx, dy);
      if (dist > 2) {
        const move = Math.min(dist, 560 * dt);
        nextX += (dx / dist) * move;
        nextY += (dy / dist) * move;
      }
    } else {
      let mx = 0;
      let my = 0;
      if (this.input.left) mx -= 1;
      if (this.input.right) mx += 1;
      if (this.input.up) my -= 1;
      if (this.input.down) my += 1;
      if (mx !== 0 && my !== 0) {
        mx *= 0.7071;
        my *= 0.7071;
      }
      nextX += mx * speed * dt;
      nextY += my * speed * dt;
    }

    nextX = Math.max(minX, Math.min(maxX, nextX));
    nextY = Math.max(minY, Math.min(maxY, nextY));

    // Prevent walking directly inside mushrooms
    const col = Math.floor(nextX / TILE);
    const row = Math.floor(nextY / TILE);
    if (!this.mushrooms[row]?.[col]) {
      this.playerX = nextX;
      this.playerY = nextY;
    } else {
      const colX = Math.floor(nextX / TILE);
      const curRow = Math.floor(this.playerY / TILE);
      if (!this.mushrooms[curRow]?.[colX]) this.playerX = nextX;
      const curCol = Math.floor(this.playerX / TILE);
      const rowY = Math.floor(nextY / TILE);
      if (!this.mushrooms[rowY]?.[curCol]) this.playerY = nextY;
    }

    if ((this.input.fire || this.input.fireJustPressed) && this.fireCooldown <= 0 && this.bullets.length < 3) {
      this.bullets.push({ x: this.playerX, y: this.playerY - 14 });
      this.fireCooldown = 0.135;
      arcadeAudio.playLaser(1080);
    }
  }

  private updateBullets(dt: number, isAttract: boolean): void {
    const bulletSpeed = 860;
    const palette = WAVE_PALETTES[(this.level - 1) % WAVE_PALETTES.length];

    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.y -= bulletSpeed * dt;
      if (b.y < TILE) {
        this.bullets.splice(i, 1);
        continue;
      }

      let hit = false;

      // Check spider
      if (this.spider.active && Math.hypot(b.x - this.spider.x, b.y - this.spider.y) < 22) {
        const dist = Math.abs(this.playerY - this.spider.y);
        const pts = dist < 72 ? 900 : dist < 140 ? 600 : 300;
        this.spider.active = false;
        this.spiderSpawnTimer = Math.max(2.6, 5.5 - this.level * 0.3);
        if (!isAttract) arcadeAudio.playExplosion(false);
        spawnBurst(this.particles, this.spider.x, this.spider.y, palette.spiderColor, 18, 220);
        this.addScore(pts, this.spider.x, this.spider.y, '#F472B6');
        hit = true;
      }

      // Check flea
      if (!hit && this.flea.active && Math.hypot(b.x - this.flea.x, b.y - this.flea.y) < 18) {
        this.flea.hp -= 1;
        hit = true;
        if (this.flea.hp <= 0) {
          this.flea.active = false;
          if (!isAttract) arcadeAudio.playExplosion(false);
          spawnBurst(this.particles, this.flea.x, this.flea.y, '#38BDF8', 16, 200);
          this.addScore(200, this.flea.x, this.flea.y, '#38BDF8');
        } else {
          spawnBurst(this.particles, this.flea.x, this.flea.y, '#FFFFFF', 6, 120);
        }
      }

      // Check scorpion
      if (!hit && this.scorpion.active && Math.hypot(b.x - this.scorpion.x, b.y - this.scorpion.y) < 22) {
        this.scorpion.active = false;
        this.scorpionSpawnTimer = Math.max(8, 15 - this.level * 0.7);
        if (!isAttract) arcadeAudio.playExplosion(true);
        spawnBurst(this.particles, this.scorpion.x, this.scorpion.y, '#EC4899', 22, 240);
        this.addScore(1000, this.scorpion.x, this.scorpion.y, '#FACC15');
        hit = true;
      }

      // Check centipede segments
      if (!hit) {
        for (let sIdx = 0; sIdx < this.segments.length; sIdx++) {
          const seg = this.segments[sIdx];
          if (Math.hypot(b.x - seg.x, b.y - seg.y) < 16) {
            const pts = seg.isHead ? 100 : 10;
            const c = Math.max(0, Math.min(COLS - 1, Math.floor(seg.x / TILE)));
            const r = Math.max(1, Math.min(ROWS - 2, Math.floor(seg.y / TILE)));
            this.mushrooms[r][c] = { hp: 4, poisoned: false };
            // Next trailing segment becomes a new independent head!
            if (sIdx + 1 < this.segments.length) {
              this.segments[sIdx + 1].isHead = true;
            }
            this.segments.splice(sIdx, 1);
            if (!isAttract) arcadeAudio.playExplosion(false);
            spawnBurst(this.particles, seg.x, seg.y, seg.isHead ? palette.segHead : palette.segBody, 14, 190);
            this.addScore(pts, seg.x, seg.y, seg.isHead ? '#FDE047' : '#A3E635');
            hit = true;
            break;
          }
        }
      }

      // Check mushrooms
      if (!hit) {
        const mc = Math.floor(b.x / TILE);
        const mr = Math.floor(b.y / TILE);
        const mush = this.mushrooms[mr]?.[mc];
        if (mush) {
          mush.hp -= 1;
          hit = true;
          spawnBurst(this.particles, mc * TILE + TILE * 0.5, mr * TILE + TILE * 0.5, mush.poisoned ? palette.poisonCap : palette.mushCap, 5, 95, 2.2);
          if (mush.hp <= 0) {
            this.mushrooms[mr][mc] = null;
            this.addScore(1);
          }
        }
      }

      if (hit) {
        this.bullets.splice(i, 1);
      }
    }
  }

  private updateSegments(dt: number, isAttract: boolean): void {
    const baseSpeed = Math.min(350, 170 + (this.level - 1) * 20);
    let anyInPlayerZone = false;

    for (const seg of this.segments) {
      seg.wiggle += dt * 16;
      const spd = seg.diving ? baseSpeed * 1.45 : baseSpeed;
      const targetY = seg.targetRow * TILE + TILE * 0.5;

      if (seg.diving) {
        seg.y += spd * dt;
        const row = Math.floor(seg.y / TILE);
        if (row >= PLAYER_MIN_ROW) {
          seg.diving = false;
          seg.targetRow = PLAYER_MIN_ROW;
          seg.y = seg.targetRow * TILE + TILE * 0.5;
        }
      } else if (Math.abs(seg.y - targetY) > 1.5) {
        const step = Math.sign(targetY - seg.y) * Math.min(Math.abs(targetY - seg.y), spd * 1.15 * dt);
        seg.y += step;
      } else {
        seg.y = targetY;
        const nextX = seg.x + seg.dir * spd * dt;
        const aheadCol = Math.floor((nextX + seg.dir * (TILE * 0.44)) / TILE);
        const curRow = seg.targetRow;
        const hitWall = aheadCol < 0 || aheadCol >= COLS;
        const mush = !hitWall ? this.mushrooms[curRow]?.[aheadCol] : null;

        if (hitWall || mush) {
          if (mush && mush.poisoned && curRow < PLAYER_MIN_ROW) {
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
          seg.x = nextX;
        }
      }

      if (seg.y >= PLAYER_MIN_ROW * TILE) anyInPlayerZone = true;

      if (!isAttract && this.invulnTimer <= 0 && Math.hypot(seg.x - this.playerX, seg.y - this.playerY) < 19) {
        this.handlePlayerHit();
        return;
      }
    }

    // Spawn bonus fast side heads if centipede lingers in bottom zone
    if (anyInPlayerZone && this.segments.length < 18) {
      this.bottomHeadTimer -= dt;
      if (this.bottomHeadTimer <= 0) {
        this.bottomHeadTimer = 8.5;
        const fromLeft = Math.random() < 0.5;
        this.segments.push({
          id: this.nextSegId++,
          x: fromLeft ? TILE * 0.5 : WIDTH - TILE * 0.5,
          y: PLAYER_MIN_ROW * TILE + TILE * 0.5,
          dir: fromLeft ? 1 : -1,
          isHead: true,
          diving: false,
          targetRow: PLAYER_MIN_ROW,
          goingUp: false,
          wiggle: 0,
        });
      }
    }
  }

  private updateEnemies(dt: number, isAttract: boolean): void {
    // Spider
    if (!this.spider.active) {
      this.spiderSpawnTimer -= dt;
      if (this.spiderSpawnTimer <= 0) {
        const fromLeft = Math.random() < 0.5;
        this.spider = {
          active: true,
          x: fromLeft ? -14 : WIDTH + 14,
          y: (PLAYER_MIN_ROW + 2) * TILE,
          vx: (fromLeft ? 1 : -1) * (120 + this.level * 12),
          vy: 140,
          dirTimer: 0.55,
          anim: 0,
        };
      }
    } else {
      const sp = this.spider;
      sp.anim += dt * 14;
      sp.dirTimer -= dt;
      if (sp.dirTimer <= 0) {
        sp.dirTimer = 0.35 + Math.random() * 0.5;
        sp.vy = (Math.random() < 0.5 ? -1 : 1) * (130 + Math.random() * 75);
      }
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      if (sp.y < (PLAYER_MIN_ROW - 2) * TILE) {
        sp.y = (PLAYER_MIN_ROW - 2) * TILE;
        sp.vy = Math.abs(sp.vy);
      } else if (sp.y > (ROWS - 1.5) * TILE) {
        sp.y = (ROWS - 1.5) * TILE;
        sp.vy = -Math.abs(sp.vy);
      }
      // Spider eats mushrooms it touches
      const sc = Math.floor(sp.x / TILE);
      const sr = Math.floor(sp.y / TILE);
      if (this.mushrooms[sr]?.[sc] && Math.random() < 0.35) {
        this.mushrooms[sr][sc] = null;
      }
      if (!isAttract) {
        this.ufoSoundTimer -= dt;
        if (this.ufoSoundTimer <= 0) {
          this.ufoSoundTimer = 0.24;
          arcadeAudio.playUfoPing(false);
        }
      }
      if (sp.x < -30 || sp.x > WIDTH + 30) {
        sp.active = false;
        this.spiderSpawnTimer = Math.max(2.6, 5.4 - this.level * 0.25);
      } else if (!isAttract && this.invulnTimer <= 0 && Math.hypot(sp.x - this.playerX, sp.y - this.playerY) < 21) {
        this.handlePlayerHit();
        return;
      }
    }

    // Flea (spawns if player zone has <5 mushrooms)
    if (!this.flea.active) {
      this.fleaCheckTimer -= dt;
      if (this.fleaCheckTimer <= 0) {
        this.fleaCheckTimer = 1.6;
        if (this.countPlayerZoneMushrooms() < 5) {
          const col = 1 + Math.floor(Math.random() * (COLS - 2));
          this.flea = {
            active: true,
            x: col * TILE + TILE * 0.5,
            y: TILE,
            hp: 2,
            lastDropRow: 0,
          };
        }
      }
    } else {
      const f = this.flea;
      f.y += (f.hp === 1 ? 420 : 250) * dt;
      const r = Math.floor(f.y / TILE);
      const c = Math.floor(f.x / TILE);
      if (r !== f.lastDropRow && r >= 2 && r < ROWS - 2) {
        f.lastDropRow = r;
        if (!this.mushrooms[r][c] && Math.random() < 0.28) {
          this.mushrooms[r][c] = { hp: 4, poisoned: false };
        }
      }
      if (f.y > HEIGHT + 20) {
        f.active = false;
      } else if (!isAttract && this.invulnTimer <= 0 && Math.hypot(f.x - this.playerX, f.y - this.playerY) < 19) {
        this.handlePlayerHit();
        return;
      }
    }

    // Scorpion (poisons mushrooms in upper field)
    if (!this.scorpion.active) {
      this.scorpionSpawnTimer -= dt;
      if (this.scorpionSpawnTimer <= 0) {
        const fromLeft = Math.random() < 0.5;
        const row = 3 + Math.floor(Math.random() * (PLAYER_MIN_ROW - 7));
        this.scorpion = {
          active: true,
          x: fromLeft ? -20 : WIDTH + 20,
          y: row * TILE + TILE * 0.5,
          dir: fromLeft ? 1 : -1,
          anim: 0,
        };
      }
    } else {
      const sc = this.scorpion;
      sc.anim += dt * 14;
      sc.x += sc.dir * (165 + this.level * 10) * dt;
      const col = Math.floor(sc.x / TILE);
      const row = Math.floor(sc.y / TILE);
      if (this.mushrooms[row]?.[col]) {
        this.mushrooms[row][col]!.poisoned = true;
      }
      if (sc.x < -36 || sc.x > WIDTH + 36) {
        sc.active = false;
        this.scorpionSpawnTimer = Math.max(7.5, 14 - this.level * 0.7);
      }
    }
  }

  private handlePlayerHit(): void {
    arcadeAudio.playDeath();
    spawnBurst(this.particles, this.playerX, this.playerY, '#FDE047', 26, 260, 4);
    this.lives -= 1;
    this.bullets = [];
    this.spider.active = false;
    this.flea.active = false;
    if (this.lives <= 0) {
      this.phase = 'GAME_OVER';
      this.bannerText = 'GAME OVER';
      return;
    }
    // Repair poisoned mushrooms and push bottom segments up slightly
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const m = this.mushrooms[r][c];
        if (m) m.poisoned = false;
      }
    }
    this.spawnCentipedeWave(this.level);
    this.resetPlayerPosition();
    this.phase = 'READY';
    this.phaseTimer = 1.25;
    this.bannerText = 'READY!';
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const palette = WAVE_PALETTES[(this.level - 1) % WAVE_PALETTES.length];

    // Deep arena backdrop
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Subtle player zone boundary line
    ctx.save();
    ctx.strokeStyle = 'rgba(132, 204, 22, 0.16)';
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, PLAYER_MIN_ROW * TILE);
    ctx.lineTo(WIDTH, PLAYER_MIN_ROW * TILE);
    ctx.stroke();
    ctx.restore();

    // Draw mushrooms
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const m = this.mushrooms[r][c];
        if (!m) continue;
        this.drawMushroom(ctx, c * TILE + TILE * 0.5, r * TILE + TILE * 0.5, m, palette);
      }
    }

    // Draw bullets
    for (const b of this.bullets) {
      ctx.save();
      ctx.fillStyle = '#FEF08A';
      ctx.shadowColor = '#FACC15';
      ctx.shadowBlur = 10;
      ctx.fillRect(b.x - 2.2, b.y - 10, 4.4, 18);
      ctx.restore();
    }

    // Draw scorpion
    if (this.scorpion.active) {
      this.drawScorpion(ctx, this.scorpion);
    }

    // Draw flea
    if (this.flea.active) {
      this.drawFlea(ctx, this.flea);
    }

    // Draw spider
    if (this.spider.active) {
      this.drawSpider(ctx, this.spider, palette.spiderColor);
    }

    // Draw centipede segments
    for (let i = this.segments.length - 1; i >= 0; i--) {
      this.drawSegment(ctx, this.segments[i], palette);
    }

    // Draw player blaster
    if (this.phase !== 'GAME_OVER') {
      const blink = this.invulnTimer > 0 && Math.floor(this.time * 16) % 2 === 0;
      if (!blink) {
        this.drawPlayer(ctx, this.playerX, this.playerY);
      }
    }

    renderParticlesAndPopups(ctx, this.particles, this.popups);

    if (this.bannerText && (this.phase === 'READY' || this.phase === 'STAGE_CLEAR')) {
      ctx.save();
      ctx.font = '800 30px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(4, 6, 13, 0.78)';
      ctx.fillRect(WIDTH * 0.25, HEIGHT * 0.44, WIDTH * 0.5, 58);
      ctx.fillStyle = '#A3E635';
      ctx.fillText(this.bannerText, WIDTH * 0.5, HEIGHT * 0.44 + 29);
      ctx.restore();
    }

    if (visualMode === 'crt') {
      renderCrtOverlay(ctx, WIDTH, HEIGHT);
    }
  }

  private drawMushroom(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    m: Mushroom,
    palette: WavePalette
  ): void {
    const capColor = m.poisoned ? palette.poisonCap : palette.mushCap;
    const dmg = 4 - m.hp;
    ctx.save();
    ctx.translate(x, y);

    if (m.poisoned) {
      ctx.shadowColor = palette.poisonCap;
      ctx.shadowBlur = 10;
    }

    // Stem
    ctx.fillStyle = palette.mushStem;
    ctx.beginPath();
    ctx.roundRect(-4.5, 0, 9, 9 - dmg * 1.4, 2);
    ctx.fill();

    // Cap dome
    ctx.fillStyle = capColor;
    ctx.beginPath();
    ctx.arc(0, 0, 10 - dmg * 0.8, Math.PI, 0);
    ctx.closePath();
    ctx.fill();

    // Cap highlight spots
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(-3.5, -4, 1.8, 0, Math.PI * 2);
    ctx.arc(3.5, -5, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Damage bite notches
    if (dmg > 0) {
      ctx.fillStyle = palette.bg;
      for (let d = 0; d < dmg; d++) {
        ctx.beginPath();
        ctx.arc(-6 + d * 6, 6 - d * 2, 3.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  private drawSegment(ctx: CanvasRenderingContext2D, seg: Segment, palette: WavePalette): void {
    ctx.save();
    ctx.translate(seg.x, seg.y);
    const legSwing = Math.sin(seg.wiggle) * 3.5;

    // Animated legs
    ctx.strokeStyle = palette.legColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-6, -8);
    ctx.lineTo(-9, -12 + legSwing);
    ctx.moveTo(6, -8);
    ctx.lineTo(9, -12 - legSwing);
    ctx.moveTo(-6, 8);
    ctx.lineTo(-9, 12 - legSwing);
    ctx.moveTo(6, 8);
    ctx.lineTo(9, 12 + legSwing);
    ctx.stroke();

    // Rounded neon carapace
    const grad = ctx.createRadialGradient(-3, -3, 1, 0, 0, 11);
    grad.addColorStop(0, '#FFFFFF');
    grad.addColorStop(0.35, seg.isHead ? palette.segHead : palette.segBody);
    grad.addColorStop(1, '#1E293B');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 10.5, 0, Math.PI * 2);
    ctx.fill();

    if (seg.isHead) {
      // Glowing arcade eyes facing travel direction
      const ex = seg.dir * 4.5;
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(ex, -4, 2.8, 0, Math.PI * 2);
      ctx.arc(ex, 4, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(ex + seg.dir * 1, -4, 1.2, 0, Math.PI * 2);
      ctx.arc(ex + seg.dir * 1, 4, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawSpider(ctx: CanvasRenderingContext2D, sp: Spider, color: string): void {
    ctx.save();
    ctx.translate(sp.x, sp.y);
    const legOsc = Math.sin(sp.anim) * 4;
    ctx.strokeStyle = '#FDE047';
    ctx.lineWidth = 2.2;
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const yOff = -4 + i * 4;
        ctx.beginPath();
        ctx.moveTo(side * 6, yOff);
        ctx.lineTo(side * 15, yOff - 5 + (i % 2 === 0 ? legOsc : -legOsc));
        ctx.lineTo(side * 20, yOff + 4 + (i % 2 === 0 ? -legOsc : legOsc));
        ctx.stroke();
      }
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 8.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-4, -2, 2.2, 0, Math.PI * 2);
    ctx.arc(4, -2, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawFlea(ctx: CanvasRenderingContext2D, f: Flea): void {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.fillStyle = f.hp === 1 ? '#FB7185' : '#38BDF8';
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FDE047';
    ctx.beginPath();
    ctx.arc(-4, 2, 2.2, 0, Math.PI * 2);
    ctx.arc(4, 2, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawScorpion(ctx: CanvasRenderingContext2D, sc: Scorpion): void {
    ctx.save();
    ctx.translate(sc.x, sc.y);
    ctx.scale(sc.dir, 1);
    ctx.fillStyle = '#EC4899';
    ctx.beginPath();
    ctx.ellipse(0, 2, 14, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // Curved stinger tail
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-12, 1);
    ctx.quadraticCurveTo(-20, -14, -4, -12);
    ctx.stroke();
    // Pincers
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(12, -2);
    ctx.lineTo(19, -7);
    ctx.moveTo(12, 4);
    ctx.lineTo(19, 8);
    ctx.stroke();
    ctx.restore();
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = '#38BDF8';
    ctx.shadowBlur = 12;

    // Sleek bug-blaster turret
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(11, 5);
    ctx.lineTo(7, 11);
    ctx.lineTo(-7, 11);
    ctx.lineTo(-11, 5);
    ctx.closePath();
    ctx.fill();

    // Glowing plasma core
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(0, 2, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FACC15';
    ctx.fillRect(-2, -16, 4, 6);
    ctx.restore();
  }
}

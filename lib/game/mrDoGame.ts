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
import { arcadeAudio } from './audio';

const sfx = {
  playCoin: () => arcadeAudio.playCoin(),
  playShoot: () => arcadeAudio.playLaser(),
  playPellet: () => arcadeAudio.playWaka(),
  playPowerup: () => arcadeAudio.playKeyUnlock(),
  playBounce: () => arcadeAudio.playRockThud(),
  playEnemyHit: () => arcadeAudio.playEatGhost(),
  playExplosion: () => arcadeAudio.playExplosion(),
  playStageClear: () => arcadeAudio.playStageClear(),
  playGameOver: () => arcadeAudio.playDeath(),
};

// ============================================================================
// 1. MR. DO! (1982 Universal) — Dedicated Upgraded Orchard Tunnel Engine
// ============================================================================
interface DoApple {
  x: number;
  y: number;
  vx: number;
  vy: number;
  state: 'rest' | 'wobble' | 'fall' | 'split';
  timer: number;
  fallRows: number;
  crushCount: number;
  diamond: boolean;
}

interface DoMonster {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: 'red' | 'digger' | 'muncher' | 'alpha';
  letterIdx: number; // 0..4 for E-X-T-R-A
  speed: number;
  dir: number; // 0=R,1=D,2=L,3=U
  turnCd: number;
  crushedBy: DoApple | null;
  alive: boolean;
  anim: number;
}

interface DoBall {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  bounces: number;
  life: number;
  returning: boolean;
}

const MRDO_THEMES = [
  { name: 'EMERALD ORCHARD', earth1: '#15803d', earth2: '#166534', soil: '#14532d', pebble: '#22c55e', sky: '#052e16' },
  { name: 'TEAL MEADOW', earth1: '#0f766e', earth2: '#115e59', soil: '#134e4a', pebble: '#2dd4bf', sky: '#042f2e' },
  { name: 'AUTUMN GROVE', earth1: '#b45309', earth2: '#92400e', soil: '#78350f', pebble: '#fbbf24', sky: '#2a1205' },
  { name: 'CRIMSON VINEYARD', earth1: '#9f1239', earth2: '#881337', soil: '#4c0519', pebble: '#fb7185', sky: '#240510' },
];

const EXTRA_WORD = ['E', 'X', 'T', 'R', 'A'];

export class MrDoArcadeGame implements ArcadeGameInstance {
  public readonly logicalWidth = 600;
  public readonly logicalHeight = 680;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'Powerball';
  public readonly secondaryActionLabel = 'Quick Turn';

  private readonly cols = 15;
  private readonly rows = 15;
  private readonly tile = 36;
  private readonly offX = 30;
  private readonly offY = 86;
  private readonly highScoreKey = 'arcade_mrdo_v2_high';

  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();
  private score = 0;
  private highScore = readHighScore(this.highScoreKey);
  private level = 1;
  private lives = 3;
  private phaseTimer = 0;
  private time = 0;

  // Grid: 1 = solid earth, 0 = dug tunnel
  private earth: number[][] = [];
  // Cherries: 1 = present
  private cherries: number[][] = [];
  private cherriesRemaining = 0;
  private cherryStreak = 0;
  private cherryStreakTimer = 0;

  // Player
  private px = 7;
  private py = 12;
  private pDir = 0; // 0=R,1=D,2=L,3=U
  private walkAnim = 0;
  private invulnTimer = 0;
  private ballReady = true;
  private ballCooldown = 0;
  private ball: DoBall = { active: false, x: 0, y: 0, vx: 0, vy: 0, bounces: 0, life: 0, returning: false };

  // Entities
  private apples: DoApple[] = [];
  private monsters: DoMonster[] = [];
  private diamonds: Array<{ x: number; y: number; life: number }> = [];
  private centerPrize: { active: boolean; x: number; y: number; timer: number } = { active: false, x: 7, y: 7, timer: 0 };
  private monsterSpawnQueue = 0;
  private spawnTimer = 0;
  private extraLit = [false, false, false, false, false];
  private activeAlphaIdx = 0;
  private alphaCycleTimer = 0;

  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];
  private screenShake = 0;

  constructor() {
    this.buildStage(1);
    this.phase = 'TITLE';
  }

  public startNewGame(): void {
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.extraLit = [false, false, false, false, false];
    this.particles = [];
    this.popups = [];
    this.buildStage(1);
    this.phase = 'READY';
    this.phaseTimer = 1.25;
    sfx.playCoin();
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.buildStage(1);
    this.phase = 'TITLE';
  }

  public restartStage(): void {
    this.buildStage(this.level);
    this.phase = 'READY';
    this.phaseTimer = 1.1;
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  private addScore(pts: number, wx?: number, wy?: number, color = '#fde047'): void {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(this.highScoreKey, this.highScore);
    }
    if (wx !== undefined && wy !== undefined) {
      this.popups.push({ x: wx, y: wy, text: `${pts}`, color, life: 0.9, maxLife: 0.9 });
    }
  }

  private gxToPx(gx: number): number {
    return this.offX + (gx + 0.5) * this.tile;
  }

  private gyToPy(gy: number): number {
    return this.offY + (gy + 0.5) * this.tile;
  }

  private buildStage(lvl: number): void {
    this.level = lvl;
    this.earth = Array.from({ length: this.rows }, () => Array(this.cols).fill(1));
    this.cherries = Array.from({ length: this.rows }, () => Array(this.cols).fill(0));
    this.apples = [];
    this.monsters = [];
    this.diamonds = [];
    this.ball = { active: false, x: 0, y: 0, vx: 0, vy: 0, bounces: 0, life: 0, returning: false };
    this.ballReady = true;
    this.ballCooldown = 0;
    this.cherryStreak = 0;
    this.cherryStreakTimer = 0;
    this.centerPrize = { active: false, x: 7, y: 7, timer: 10 };

    // Carve iconic Universal Mr. Do! initial central shaft & side alcoves
    for (let r = 2; r <= 12; r++) this.earth[r][7] = 0;
    for (let c = 5; c <= 9; c++) this.earth[7][c] = 0;
    for (let c = 2; c <= 4; c++) this.earth[3][c] = 0;
    for (let c = 10; c <= 12; c++) this.earth[3][c] = 0;
    for (let c = 2; c <= 4; c++) this.earth[11][c] = 0;
    for (let c = 10; c <= 12; c++) this.earth[11][c] = 0;

    // Place 4 classic 8-cherry orchard clusters (32 cherries total)
    const clusters: Array<[number, number, boolean]> = [
      [1, 1, true],
      [10, 1, true],
      [1, 9, false],
      [10, 9, false],
    ];
    this.cherriesRemaining = 0;
    for (const [cx, cy, horiz] of clusters) {
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 2; j++) {
          const r = horiz ? cy + j : cy + i;
          const c = horiz ? cx + i : cx + j;
          if (r >= 1 && r < this.rows - 1 && c >= 1 && c < this.cols - 1 && !(c === 7 && r === 7)) {
            this.cherries[r][c] = 1;
            this.cherriesRemaining++;
          }
        }
      }
    }

    // Place 6-8 overhanging Apples in strategic spots
    const appleSpots: Array<[number, number]> = [
      [3, 1],
      [11, 1],
      [5, 4],
      [9, 4],
      [2, 6],
      [12, 6],
      [5, 10],
      [9, 10],
    ];
    const count = Math.min(appleSpots.length, 6 + Math.min(2, Math.floor((lvl - 1) / 2)));
    for (let i = 0; i < count; i++) {
      const [ax, ay] = appleSpots[i];
      this.cherries[ay][ax] = 0;
      this.apples.push({
        x: ax,
        y: ay,
        vx: 0,
        vy: 0,
        state: 'rest',
        timer: 0,
        fallRows: 0,
        crushCount: 0,
        diamond: i === 2 || (lvl >= 2 && i === 5),
      });
    }
    // Recount cherries accurately
    this.cherriesRemaining = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.cherries[r][c] === 1) this.cherriesRemaining++;
      }
    }

    this.px = 7;
    this.py = 12;
    this.pDir = 0;
    this.invulnTimer = 1.6;
    this.monsterSpawnQueue = Math.min(9, 4 + lvl);
    this.spawnTimer = 0.6;
    this.activeAlphaIdx = this.extraLit.findIndex((v) => !v);
    if (this.activeAlphaIdx < 0) this.activeAlphaIdx = 0;
  }

  private spawnMonster(kind: DoMonster['kind'], gx: number, gy: number, letterIdx = 0): void {
    const baseSpeed = 2.65 + Math.min(1.6, (this.level - 1) * 0.22);
    this.monsters.push({
      x: gx,
      y: gy,
      vx: 0,
      vy: 0,
      kind,
      letterIdx,
      speed: kind === 'muncher' ? baseSpeed * 1.15 : kind === 'alpha' ? baseSpeed * 1.08 : baseSpeed,
      dir: Math.random() < 0.5 ? 0 : 2,
      turnCd: 0,
      crushedBy: null,
      alive: true,
      anim: Math.random() * 6,
    });
  }

  private firePowerball(): void {
    if (!this.ballReady || this.ball.active) return;
    const dirs = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ];
    const [dx, dy] = dirs[this.pDir];
    this.ball = {
      active: true,
      x: this.px + dx * 0.35,
      y: this.py + dy * 0.35,
      vx: dx * 9.8,
      vy: dy * 9.8,
      bounces: 5,
      life: 2.8,
      returning: false,
    };
    this.ballReady = false;
    this.ballCooldown = 1.85;
    sfx.playShoot();
  }

  public step(dt: number): void {
    this.time += dt;
    this.screenShake = Math.max(0, this.screenShake - dt * 2.8);
    stepParticlesAndPopups(this.particles, this.popups, dt);

    if (this.phase === 'TITLE') {
      // Gentle attract-mode idle animation
      this.walkAnim += dt * 4;
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
        this.buildStage(this.level + 1);
        this.phase = 'READY';
        this.phaseTimer = 1.25;
      }
      return;
    }

    // --- PLAYING ---
    if (this.invulnTimer > 0) this.invulnTimer -= dt;
    if (this.cherryStreakTimer > 0) {
      this.cherryStreakTimer -= dt;
      if (this.cherryStreakTimer <= 0) this.cherryStreak = 0;
    }
    this.alphaCycleTimer += dt;
    if (this.alphaCycleTimer >= 2.6) {
      this.alphaCycleTimer = 0;
      const unlit = [0, 1, 2, 3, 4].filter((i) => !this.extraLit[i]);
      if (unlit.length > 0) {
        const curPos = unlit.indexOf(this.activeAlphaIdx);
        this.activeAlphaIdx = unlit[(curPos + 1) % unlit.length];
      }
    }

    // Powerball recharge
    if (!this.ballReady && !this.ball.active) {
      this.ballCooldown -= dt;
      if (this.ballCooldown <= 0) {
        this.ballReady = true;
        sfx.playPowerup();
      }
    }

    // Monster spawning from central hub
    if (this.monsterSpawnQueue > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnMonster('red', 7, 7);
        this.monsterSpawnQueue--;
        this.spawnTimer = Math.max(1.2, 2.7 - this.level * 0.16);
      }
    } else if (!this.centerPrize.active && this.centerPrize.timer > 0) {
      this.centerPrize.timer -= dt;
      if (this.centerPrize.timer <= 0) {
        this.centerPrize.active = true;
        this.popups.push({
          x: this.gxToPx(7),
          y: this.gyToPy(6.6),
          text: 'TREAT!',
          color: '#f472b6',
          life: 1.2,
          maxLife: 1.2,
        });
      }
    }

    this.stepPlayer(dt);
    this.stepPowerball(dt);
    this.stepApples(dt);
    this.stepMonsters(dt);
    this.stepDiamonds(dt);

    // Win check: all cherries collected OR all active monsters defeated after queue empty
    const aliveCount = this.monsters.filter((m) => m.alive).length;
    if (this.cherriesRemaining <= 0 || (this.monsterSpawnQueue === 0 && aliveCount === 0 && !this.centerPrize.active)) {
      this.addScore(1000 * this.level, this.gxToPx(7), this.gyToPy(6), '#4ade80');
      sfx.playStageClear();
      this.phase = 'STAGE_CLEAR';
      this.phaseTimer = 1.9;
    }
  }

  private stepPlayer(dt: number): void {
    const mv = getPrecisionMoveVector(this.input);
    const moveSpeed = 4.65 * mv.scale;

    let dx = 0;
    let dy = 0;
    if (Math.abs(mv.vx) > 0.08 || Math.abs(mv.vy) > 0.08) {
      // Snap cleanly toward cardinal tunnels like authentic Mr. Do!
      if (Math.abs(mv.vx) >= Math.abs(mv.vy)) {
        dx = Math.sign(mv.vx);
        this.pDir = dx > 0 ? 0 : 2;
        const targetRow = Math.round(this.py);
        this.py += (targetRow - this.py) * Math.min(1, dt * 16);
      } else {
        dy = Math.sign(mv.vy);
        this.pDir = dy > 0 ? 1 : 3;
        const targetCol = Math.round(this.px);
        this.px += (targetCol - this.px) * Math.min(1, dt * 16);
      }
    }

    if (dx !== 0 || dy !== 0) {
      const nx = Math.max(0.4, Math.min(this.cols - 1.4, this.px + dx * moveSpeed * dt));
      const ny = Math.max(0.4, Math.min(this.rows - 1.4, this.py + dy * moveSpeed * dt));

      // Check apple push / collision
      let blocked = false;
      for (const a of this.apples) {
        if (a.state === 'split') continue;
        const dist = Math.hypot(nx - a.x, ny - a.y);
        if (dist < 0.72) {
          if (dx !== 0 && a.state === 'rest' && Math.abs(this.py - a.y) < 0.42) {
            const pushX = a.x + dx * moveSpeed * 0.55 * dt;
            const cCheck = Math.round(pushX + dx * 0.45);
            const rCheck = Math.round(a.y);
            if (cCheck >= 0 && cCheck < this.cols && !this.apples.some((o) => o !== a && Math.hypot(o.x - pushX, o.y - a.y) < 0.85)) {
              a.x = Math.max(0.4, Math.min(this.cols - 1.4, pushX));
              if (rCheck >= 0 && rCheck < this.rows && cCheck >= 0 && cCheck < this.cols) {
                this.earth[rCheck][cCheck] = 0;
              }
            } else {
              blocked = true;
            }
          } else {
            blocked = true;
          }
        }
      }

      if (!blocked) {
        const digRow = Math.round(ny);
        const digCol = Math.round(nx);
        const digging = this.earth[digRow]?.[digCol] === 1;
        const slowFactor = digging ? 0.84 : 1.0;
        this.px = Math.max(0.4, Math.min(this.cols - 1.4, this.px + dx * moveSpeed * slowFactor * dt));
        this.py = Math.max(0.4, Math.min(this.rows - 1.4, this.py + dy * moveSpeed * slowFactor * dt));
        this.walkAnim += dt * 11;

        const rNow = Math.round(this.py);
        const cNow = Math.round(this.px);
        if (this.earth[rNow]?.[cNow] === 1) {
          this.earth[rNow][cNow] = 0;
          spawnBurst(this.particles, this.gxToPx(cNow), this.gyToPy(rNow), '#86efac', 4, 70, 2.2);
        }
        if (this.cherries[rNow]?.[cNow] === 1) {
          this.cherries[rNow][cNow] = 0;
          this.cherriesRemaining--;
          this.cherryStreak++;
          this.cherryStreakTimer = 1.9;
          this.addScore(50, this.gxToPx(cNow), this.gyToPy(rNow), '#fb7185');
          sfx.playPellet();
          if (this.cherryStreak >= 8) {
            this.cherryStreak = 0;
            this.addScore(500, this.gxToPx(cNow), this.gyToPy(rNow) - 18, '#fde047');
            spawnBurst(this.particles, this.gxToPx(cNow), this.gyToPy(rNow), '#fde047', 18, 170, 3.6);
            sfx.playPowerup();
          }
        }
      }
    }

    // Center Prize Treat pickup -> spawns E-X-T-R-A Alphamonster + Munchers!
    if (this.centerPrize.active && Math.hypot(this.px - this.centerPrize.x, this.py - this.centerPrize.y) < 0.72) {
      this.centerPrize.active = false;
      this.addScore(1000, this.gxToPx(7), this.gyToPy(7), '#f472b6');
      spawnBurst(this.particles, this.gxToPx(7), this.gyToPy(7), '#f472b6', 24, 200, 3.8);
      sfx.playPowerup();
      // Spawn Alphamonster & 2 Munchers
      this.spawnMonster('alpha', 7, 2, this.activeAlphaIdx);
      this.spawnMonster('muncher', 5, 7);
      this.spawnMonster('muncher', 9, 7);
    }

    if (this.input.fireJustPressed) {
      this.firePowerball();
    }
    if (this.input.secondaryJustPressed) {
      this.pDir = (this.pDir + 2) % 4;
    }
  }

  private stepPowerball(dt: number): void {
    if (!this.ball.active) return;
    this.ball.life -= dt;
    if (this.ball.life <= 0) {
      this.ball.active = false;
      return;
    }

    if (this.ball.returning) {
      const dx = this.px - this.ball.x;
      const dy = this.py - this.ball.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.45) {
        this.ball.active = false;
        this.ballReady = true;
        return;
      }
      this.ball.x += (dx / d) * 11 * dt;
      this.ball.y += (dy / d) * 11 * dt;
    } else {
      const nx = this.ball.x + this.ball.vx * dt;
      const ny = this.ball.y + this.ball.vy * dt;
      const cX = Math.round(nx);
      const rY = Math.round(ny);
      let bounced = false;

      if (cX < 0 || cX >= this.cols || this.earth[Math.round(this.ball.y)]?.[cX] === 1) {
        this.ball.vx = -this.ball.vx;
        bounced = true;
      } else {
        this.ball.x = nx;
      }
      if (rY < 0 || rY >= this.rows || this.earth[rY]?.[Math.round(this.ball.x)] === 1) {
        this.ball.vy = -this.ball.vy;
        bounced = true;
      } else {
        this.ball.y = ny;
      }

      if (bounced) {
        this.ball.bounces--;
        sfx.playBounce();
        if (this.ball.bounces <= 0) {
          this.ball.returning = true;
        }
      }
    }

    // Hit monsters
    for (const m of this.monsters) {
      if (!m.alive) continue;
      if (Math.hypot(this.ball.x - m.x, this.ball.y - m.y) < 0.7) {
        this.defeatMonster(m, 500);
        this.ball.active = false;
        this.ballCooldown = 1.6;
        break;
      }
    }
  }

  private defeatMonster(m: DoMonster, pts: number): void {
    m.alive = false;
    const wx = this.gxToPx(m.x);
    const wy = this.gyToPy(m.y);
    spawnBurst(this.particles, wx, wy, m.kind === 'alpha' ? '#fde047' : '#ef4444', 18, 180, 3.6);
    sfx.playEnemyHit();
    this.addScore(pts, wx, wy, m.kind === 'alpha' ? '#fde047' : '#fb923c');

    if (m.kind === 'alpha') {
      this.extraLit[m.letterIdx] = true;
      this.popups.push({ x: wx, y: wy - 20, text: `LETTER ${EXTRA_WORD[m.letterIdx]}!`, color: '#fde047', life: 1.3, maxLife: 1.3 });
      if (this.extraLit.every(Boolean)) {
        this.lives++;
        this.extraLit = [false, false, false, false, false];
        this.addScore(5000, this.gxToPx(7), this.gyToPy(5), '#38bdf8');
        this.popups.push({ x: this.gxToPx(7), y: this.gyToPy(4.2), text: 'EXTRA 1UP!', color: '#4ade80', life: 1.8, maxLife: 1.8 });
        sfx.playStageClear();
        this.phase = 'STAGE_CLEAR';
        this.phaseTimer = 1.9;
      }
    }
  }

  private stepApples(dt: number): void {
    for (let i = this.apples.length - 1; i >= 0; i--) {
      const a = this.apples[i];
      if (a.state === 'split') {
        a.timer -= dt;
        if (a.timer <= 0) {
          if (a.diamond) {
            this.diamonds.push({ x: a.x, y: a.y, life: 9.0 });
          }
          this.apples.splice(i, 1);
        }
        continue;
      }

      const col = Math.round(a.x);
      const belowRow = Math.floor(a.y + 0.56);
      const belowOpen = belowRow < this.rows && this.earth[belowRow]?.[col] === 0;

      if (a.state === 'rest') {
        if (belowOpen) {
          a.state = 'wobble';
          a.timer = 0.58;
        }
      } else if (a.state === 'wobble') {
        a.timer -= dt;
        if (!belowOpen) {
          a.state = 'rest';
        } else if (a.timer <= 0) {
          a.state = 'fall';
          a.vy = 2.6;
          a.fallRows = 0;
          a.crushCount = 0;
        }
      } else if (a.state === 'fall') {
        a.vy = Math.min(11.5, a.vy + 22 * dt);
        const nextY = a.y + a.vy * dt;
        a.fallRows += a.vy * dt;
        const rFoot = Math.floor(nextY + 0.52);

        // Crush monsters underneath
        for (const m of this.monsters) {
          if (!m.alive) continue;
          if (Math.hypot(m.x - a.x, m.y - nextY) < 0.78) {
            a.crushCount++;
            const bonus = 1000 * Math.pow(2, Math.min(3, a.crushCount - 1));
            this.defeatMonster(m, bonus);
            this.screenShake = Math.max(this.screenShake, 0.3);
          }
        }

        // Crush Mr. Do if careless
        if (this.invulnTimer <= 0 && Math.hypot(this.px - a.x, this.py - nextY) < 0.62 && a.fallRows > 0.65) {
          this.loseLife();
        }

        // Hit solid floor or bottom boundary
        const hitBottom = rFoot >= this.rows || (this.earth[rFoot]?.[col] === 1 && a.fallRows > 0.45);
        if (hitBottom) {
          a.y = Math.min(this.rows - 1, rFoot - 1);
          if (a.fallRows >= 1.65 || a.crushCount > 0) {
            a.state = 'split';
            a.timer = 0.42;
            spawnBurst(this.particles, this.gxToPx(a.x), this.gyToPy(a.y), '#ef4444', 12, 120, 3);
            sfx.playExplosion();
          } else {
            a.state = 'rest';
            a.vy = 0;
          }
        } else {
          a.y = nextY;
          const rPass = Math.round(a.y);
          if (this.earth[rPass]?.[col] === 1) this.earth[rPass][col] = 0;
        }
      }
    }
  }

  private stepMonsters(dt: number): void {
    const dirs = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ];
    for (const m of this.monsters) {
      if (!m.alive) continue;
      m.anim += dt * 8;
      m.turnCd -= dt;

      // Occasionally morph red monster into a earth-digging Blue Digger!
      if (m.kind === 'red' && Math.random() < dt * (0.03 + this.level * 0.01)) {
        m.kind = 'digger';
      }

      const cx = Math.round(m.x);
      const cy = Math.round(m.y);
      const nearCenter = Math.hypot(m.x - cx, m.y - cy) < 0.14;

      if (nearCenter && m.turnCd <= 0) {
        const candidates: number[] = [];
        const opp = (m.dir + 2) % 4;
        for (let d = 0; d < 4; d++) {
          const nc = cx + dirs[d][0];
          const nr = cy + dirs[d][1];
          if (nc < 0 || nc >= this.cols || nr < 0 || nr >= this.rows) continue;
          const canDig = m.kind === 'digger' || m.kind === 'alpha' || m.kind === 'muncher';
          if (this.earth[nr][nc] === 0 || canDig) {
            candidates.push(d);
          }
        }
        if (candidates.length > 0) {
          const nonReverse = candidates.filter((d) => d !== opp);
          const pool = nonReverse.length > 0 ? nonReverse : candidates;
          // Choose direction closest to Mr. Do (preferring dug tunnels)
          let bestDir = pool[0];
          let bestScore = Infinity;
          for (const d of pool) {
            const nc = cx + dirs[d][0];
            const nr = cy + dirs[d][1];
            const dist = Math.hypot(nc - this.px, nr - this.py);
            const digPenalty = this.earth[nr][nc] === 1 ? 2.4 : 0;
            const jitter = (Math.random() - 0.5) * 1.4;
            const sc = dist + digPenalty + jitter;
            if (sc < bestScore) {
              bestScore = sc;
              bestDir = d;
            }
          }
          m.dir = bestDir;
          m.turnCd = 0.22;
        }
      }

      const [dx, dy] = dirs[m.dir];
      const digNow = this.earth[Math.round(m.y + dy * 0.45)]?.[Math.round(m.x + dx * 0.45)] === 1;
      const spd = m.speed * (digNow ? 0.62 : 1.0);
      const nx = Math.max(0.2, Math.min(this.cols - 1.2, m.x + dx * spd * dt));
      const ny = Math.max(0.2, Math.min(this.rows - 1.2, m.y + dy * spd * dt));
      const rc = Math.round(nx);
      const rr = Math.round(ny);
      if (this.earth[rr]?.[rc] === 1) {
        if (m.kind === 'digger' || m.kind === 'alpha' || m.kind === 'muncher') {
          this.earth[rr][rc] = 0;
        } else {
          m.dir = (m.dir + 1) % 4;
          continue;
        }
      }
      m.x = nx;
      m.y = ny;

      if (this.invulnTimer <= 0 && Math.hypot(m.x - this.px, m.y - this.py) < 0.62) {
        this.loseLife();
        break;
      }
    }
  }

  private stepDiamonds(dt: number): void {
    for (let i = this.diamonds.length - 1; i >= 0; i--) {
      const d = this.diamonds[i];
      d.life -= dt;
      if (Math.hypot(this.px - d.x, this.py - d.y) < 0.72) {
        this.addScore(8000, this.gxToPx(d.x), this.gyToPy(d.y), '#38bdf8');
        spawnBurst(this.particles, this.gxToPx(d.x), this.gyToPy(d.y), '#38bdf8', 26, 220, 4);
        sfx.playStageClear();
        this.diamonds.splice(i, 1);
      } else if (d.life <= 0) {
        this.diamonds.splice(i, 1);
      }
    }
  }

  private loseLife(): void {
    this.lives--;
    sfx.playGameOver();
    spawnBurst(this.particles, this.gxToPx(this.px), this.gyToPy(this.py), '#f87171', 26, 200, 3.8);
    this.screenShake = 0.45;
    if (this.lives <= 0) {
      this.phase = 'GAME_OVER';
    } else {
      this.px = 7;
      this.py = 12;
      this.invulnTimer = 2.4;
      for (const m of this.monsters) {
        if (Math.hypot(m.x - 7, m.y - 12) < 4) {
          m.x = 7;
          m.y = 3;
        }
      }
    }
  }

  public getHudSnapshot(): ClassicGameHud {
    const theme = MRDO_THEMES[(this.level - 1) % MRDO_THEMES.length];
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: `ORCHARD ${this.level} · ${theme.name}`,
      primaryMetricLabel: 'CHERRIES',
      primaryMetricValue: `${this.cherriesRemaining}`,
      secondaryMetricLabel: 'EXTRA',
      secondaryMetricValue: EXTRA_WORD.map((ch, i) => (this.extraLit[i] ? ch : '·')).join(''),
      bannerText:
        this.phase === 'READY'
          ? `STAGE ${this.level} · HARVEST CHERRIES & DROP APPLES!`
          : this.phase === 'STAGE_CLEAR'
            ? 'ORCHARD CLEARED!'
            : '',
      canRestartStage: true,
    };
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.save();
    ctx.scale(dpr, dpr);
    const W = this.logicalWidth;
    const H = this.logicalHeight;
    const theme = MRDO_THEMES[(this.level - 1) % MRDO_THEMES.length];

    // Backdrop & Top E-X-T-R-A Marquee Banner
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, theme.sky);
    bgGrad.addColorStop(1, '#05080f');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Subtle shake
    if (this.screenShake > 0) {
      ctx.translate((Math.random() - 0.5) * 9 * this.screenShake, (Math.random() - 0.5) * 9 * this.screenShake);
    }

    // E-X-T-R-A Top Header Badges
    for (let i = 0; i < 5; i++) {
      const bx = 135 + i * 70;
      const by = 22;
      const lit = this.extraLit[i];
      const active = i === this.activeAlphaIdx;
      ctx.fillStyle = lit ? '#eab308' : active ? '#1e293b' : '#0f172a';
      ctx.strokeStyle = lit ? '#fef08a' : active ? '#38bdf8' : '#334155';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(bx, by, 50, 42, 8);
      ctx.fill();
      ctx.stroke();

      ctx.font = '800 24px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = lit ? '#0f172a' : active ? '#38bdf8' : '#475569';
      ctx.fillText(EXTRA_WORD[i], bx + 25, by + 22);
    }

    // Orchard frame shadow
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.roundRect(this.offX - 6, this.offY - 6, this.cols * this.tile + 12, this.rows * this.tile + 12, 10);
    ctx.fill();

    // Draw carved tunnels & rich 2.5D earth blocks
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = this.offX + c * this.tile;
        const y = this.offY + r * this.tile;
        if (this.earth[r][c] === 0) {
          ctx.fillStyle = '#0b0e17';
          ctx.fillRect(x, y, this.tile, this.tile);
          // Subtle subterranean texture specks
          if ((r * 7 + c * 13) % 5 === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.035)';
            ctx.fillRect(x + 8, y + 10, 4, 4);
          }
        } else {
          const grad = ctx.createLinearGradient(x, y, x, y + this.tile);
          grad.addColorStop(0, theme.earth1);
          grad.addColorStop(1, theme.earth2);
          ctx.fillStyle = grad;
          ctx.fillRect(x, y, this.tile, this.tile);

          // 2.5D Soil lip highlight if top tile is open
          if (r > 0 && this.earth[r - 1][c] === 0) {
            ctx.fillStyle = theme.pebble;
            ctx.fillRect(x, y, this.tile, 4);
          }
          // Soil pebble dots
          ctx.fillStyle = theme.soil;
          const hash = (r * 31 + c * 17) % 9;
          ctx.beginPath();
          ctx.arc(x + 9 + (hash % 3) * 8, y + 10 + Math.floor(hash / 3) * 7, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Center Monster House Crest
    const hx = this.gxToPx(7);
    const hy = this.gyToPy(7);
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(hx - 17, hy - 17, 34, 34);
    if (this.centerPrize.active) {
      const pulse = 1 + Math.sin(this.time * 8) * 0.12;
      ctx.save();
      ctx.translate(hx, hy);
      ctx.scale(pulse, pulse);
      // Glowing Strawberry / Cake Treat
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(0, 2, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(-7, -3, 14, 5);
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(0, -8, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw Cherries (glossy twin cherries with green stems)
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.cherries[r][c] !== 1) continue;
        const cx = this.gxToPx(c);
        const cy = this.gyToPy(r);
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 5, cy + 2);
        ctx.quadraticCurveTo(cx, cy - 10, cx + 5, cy + 2);
        ctx.stroke();

        for (const ox of [-5.5, 5.5]) {
          ctx.fillStyle = '#dc2626';
          ctx.beginPath();
          ctx.arc(cx + ox, cy + 4, 6.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fecaca';
          ctx.beginPath();
          ctx.arc(cx + ox - 2, cy + 2, 2.1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Draw Diamonds
    for (const d of this.diamonds) {
      const dx = this.gxToPx(d.x);
      const dy = this.gyToPy(d.y);
      ctx.save();
      ctx.translate(dx, dy);
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.lineTo(12, 0);
      ctx.lineTo(0, 13);
      ctx.lineTo(-12, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(6, -1);
      ctx.lineTo(0, 3);
      ctx.lineTo(-6, -1);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Draw Physics Apples
    for (const a of this.apples) {
      const ax = this.gxToPx(a.x) + (a.state === 'wobble' ? Math.sin(this.time * 42) * 3.5 : 0);
      const ay = this.gyToPy(a.y);
      ctx.save();
      ctx.translate(ax, ay);
      if (a.state === 'split') {
        ctx.fillStyle = '#fef3c7';
        ctx.beginPath();
        ctx.arc(-8, 4, 9, 0, Math.PI * 2);
        ctx.arc(8, 4, 9, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const aGrad = ctx.createRadialGradient(-4, -5, 2, 0, 0, 16);
        aGrad.addColorStop(0, '#fb7185');
        aGrad.addColorStop(0.65, '#dc2626');
        aGrad.addColorStop(1, '#7f1d1d');
        ctx.fillStyle = aGrad;
        ctx.beginPath();
        ctx.arc(0, 2, 14.5, 0, Math.PI * 2);
        ctx.fill();
        // Highlight & leaf
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.beginPath();
        ctx.ellipse(-5, -3, 3.2, 5.2, -0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4ade80';
        ctx.beginPath();
        ctx.ellipse(4, -12, 6, 3.2, -0.45, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Draw Monsters
    for (const m of this.monsters) {
      if (!m.alive) continue;
      const mx = this.gxToPx(m.x);
      const my = this.gyToPy(m.y);
      ctx.save();
      ctx.translate(mx, my);
      const bob = Math.sin(m.anim) * 2;
      if (m.kind === 'alpha') {
        // Golden E-X-T-R-A Alphamonster
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.roundRect(-13, -13 + bob, 26, 26, 7);
        ctx.fill();
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.font = '900 17px "Outfit", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#0f172a';
        ctx.fillText(EXTRA_WORD[m.letterIdx], 0, 1 + bob);
      } else {
        const bodyCol = m.kind === 'digger' ? '#38bdf8' : m.kind === 'muncher' ? '#c084fc' : '#ef4444';
        ctx.fillStyle = bodyCol;
        ctx.beginPath();
        ctx.arc(0, bob, 13, 0, Math.PI * 2);
        ctx.fill();
        // Horns / crest
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.moveTo(-8, -9 + bob);
        ctx.lineTo(-12, -16 + bob);
        ctx.lineTo(-3, -11 + bob);
        ctx.moveTo(8, -9 + bob);
        ctx.lineTo(12, -16 + bob);
        ctx.lineTo(3, -11 + bob);
        ctx.fill();
        // Eyes
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-4.5, -2 + bob, 3.5, 0, Math.PI * 2);
        ctx.arc(4.5, -2 + bob, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(-4, -2 + bob, 1.7, 0, Math.PI * 2);
        ctx.arc(5, -2 + bob, 1.7, 0, Math.PI * 2);
        ctx.fill();
        // Teeth grin
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-6, 4 + bob, 12, 3.5);
      }
      ctx.restore();
    }

    // Draw Powerball
    if (this.ball.active) {
      const bx = this.gxToPx(this.ball.x);
      const by = this.gyToPy(this.ball.y);
      ctx.save();
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath();
      ctx.arc(bx, by, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(bx, by, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw Mr. Do! Hero Clown Sprite
    if (this.invulnTimer <= 0 || Math.floor(this.time * 16) % 2 === 0) {
      const x = this.gxToPx(this.px);
      const y = this.gyToPy(this.py);
      ctx.save();
      ctx.translate(x, y);
      if (this.ballReady) {
        // Orbiting ready Powerball sparkle
        const ox = Math.cos(this.time * 7) * 16;
        const oy = Math.sin(this.time * 7) * 16;
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(ox, oy, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      const stride = Math.sin(this.walkAnim) * 2.5;
      // Shoes
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.ellipse(-5, 11 + stride * 0.4, 5, 3, 0, 0, Math.PI * 2);
      ctx.ellipse(5, 11 - stride * 0.4, 5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      // White clown suit with red polka dots
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.roundRect(-10, -4, 20, 14, 6);
      ctx.fill();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(-4, 2, 2.2, 0, Math.PI * 2);
      ctx.arc(4, 5, 2.2, 0, Math.PI * 2);
      ctx.fill();
      // Head
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(0, -7, 8, 0, Math.PI * 2);
      ctx.fill();
      // Red clown nose & cheerful eyes
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(0, -6, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-4, -10, 2, 2.5);
      ctx.fillRect(2, -10, 2, 2.5);
      // Red & white pointed clown cap
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(-8, -11);
      ctx.lineTo(0, -20);
      ctx.lineTo(8, -11);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(0, -20, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    renderParticlesAndPopups(ctx, this.particles, this.popups);

    // Bottom Status Strip
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(this.offX, this.offY + this.rows * this.tile + 10, this.cols * this.tile, 34);
    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = this.ballReady ? '#38bdf8' : '#94a3b8';
    ctx.fillText(
      this.ballReady ? '● POWERBALL READY [SPACE]' : '○ POWERBALL RECHARGING...',
      this.offX + 12,
      this.offY + this.rows * this.tile + 27
    );
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fb7185';
    ctx.fillText(`CHERRIES LEFT: ${this.cherriesRemaining}`, this.offX + this.cols * this.tile - 12, this.offY + this.rows * this.tile + 27);

    if (visualMode === 'crt') renderCrtOverlay(ctx, W, H);
    ctx.restore();
  }
}

// ============================================================================
// 2. MR. DO'S CASTLE (1983 Universal) — Hammer, Tilting Ladders & Unicorns!
// ============================================================================
type CastleBlockKind = 'empty' | 'stone' | 'cherry' | 'key' | 'diamond';

interface CastleBlock {
  kind: CastleBlockKind;
  hp: number;
  rebuildTimer: number;
}

interface FallingBlock {
  col: number;
  y: number; // pixel Y
  vy: number;
  startFloor: number;
  kind: CastleBlockKind;
  crushCount: number;
}

interface TiltingLadder {
  topFloor: number; // 0..3 (connects topFloor to topFloor + 1)
  topCol: number;
  tilt: -1 | 1; // -1 leans left at bottom, +1 leans right at bottom
  fixed: boolean;
}

interface CastleUnicorn {
  x: number; // pixel X
  y: number; // pixel Y (feet)
  floor: number; // 0..4
  dir: -1 | 1;
  kind: 'red' | 'green' | 'blue' | 'alpha';
  letterIdx: number;
  state: 'walk' | 'climb' | 'fall';
  activeLadder: TiltingLadder | null;
  climbDir: -1 | 1;
  speed: number;
  anim: number;
  alive: boolean;
  smashCd: number;
}

const CASTLE_THEMES = [
  { name: 'CRIMSON CITADEL', wall: '#1e1b4b', mortar: '#312e81', stone: '#64748b', accent: '#f59e0b' },
  { name: 'EMERALD KEEP', wall: '#064e3b', mortar: '#065f46', stone: '#475569', accent: '#34d399' },
  { name: 'OBSIDIAN TOWER', wall: '#1f1024', mortar: '#3b0764', stone: '#6b7280', accent: '#c084fc' },
  { name: 'ROYAL SANCTUM', wall: '#3b0a18', mortar: '#7f1d1d', stone: '#78716c', accent: '#fbbf24' },
];

export class MrDosCastleGame implements ArcadeGameInstance {
  public readonly logicalWidth = 600;
  public readonly logicalHeight = 680;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'Hammer Smash';
  public readonly secondaryActionLabel = 'Flip Ladder';

  private readonly cols = 12;
  private readonly floors = 5; // 0 = top crown floor, 4 = bottom floor
  private readonly tileW = 44;
  private readonly offX = 36;
  private readonly floorY = [148, 254, 360, 466, 572];
  private readonly blockH = 26;
  private readonly highScoreKey = 'arcade_mrdocastle_v1_high';

  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();
  private score = 0;
  private highScore = readHighScore(this.highScoreKey);
  private level = 1;
  private lives = 3;
  private phaseTimer = 0;
  private time = 0;

  // Floor blocks: floors 0..3 have smashable blocks; floor 4 is solid castle foundation
  private blocks: CastleBlock[][] = [];
  private fallingBlocks: FallingBlock[] = [];
  private ladders: TiltingLadder[] = [];
  private unicorns: CastleUnicorn[] = [];
  private diamonds: Array<{ x: number; y: number; life: number }> = [];

  // Player state
  private px = 300;
  private py = 572;
  private pFloor = 4;
  private pFacing: -1 | 1 = 1;
  private pState: 'walk' | 'climb' | 'fall' = 'walk';
  private pLadder: TiltingLadder | null = null;
  private pVy = 0;
  private walkAnim = 0;
  private hammerTimer = 0;
  private hammerCd = 0;
  private invulnTimer = 0;

  // Objectives
  private cherryBlocksLeft = 0;
  private keysCollected = 0;
  private crownUnlocked = false;
  private crownClaimed = false;
  private extraLit = [false, false, false, false, false];
  private activeAlphaIdx = 0;
  private unicornSpawnTimer = 0;
  private screenShake = 0;

  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  constructor() {
    this.buildCastle(1);
    this.phase = 'TITLE';
  }

  public startNewGame(): void {
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.extraLit = [false, false, false, false, false];
    this.particles = [];
    this.popups = [];
    this.buildCastle(1);
    this.phase = 'READY';
    this.phaseTimer = 1.25;
    sfx.playCoin();
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.buildCastle(1);
    this.phase = 'TITLE';
  }

  public restartStage(): void {
    this.buildCastle(this.level);
    this.phase = 'READY';
    this.phaseTimer = 1.1;
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  private colCenterX(col: number): number {
    return this.offX + (col + 0.5) * this.tileW;
  }

  private xToCol(x: number): number {
    return Math.max(0, Math.min(this.cols - 1, Math.floor((x - this.offX) / this.tileW)));
  }

  private addScore(pts: number, wx?: number, wy?: number, color = '#fde047'): void {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(this.highScoreKey, this.highScore);
    }
    if (wx !== undefined && wy !== undefined) {
      this.popups.push({ x: wx, y: wy, text: `${pts}`, color, life: 0.95, maxLife: 0.95 });
    }
  }

  private buildCastle(lvl: number): void {
    this.level = lvl;
    this.fallingBlocks = [];
    this.unicorns = [];
    this.diamonds = [];
    this.keysCollected = 0;
    this.crownUnlocked = false;
    this.crownClaimed = false;
    this.cherryBlocksLeft = 0;
    this.activeAlphaIdx = this.extraLit.findIndex((v) => !v);
    if (this.activeAlphaIdx < 0) this.activeAlphaIdx = 0;

    // Initialize 4 smashable floors (0..3) + solid bottom foundation (floor 4)
    this.blocks = Array.from({ length: this.floors }, (_, f) =>
      Array.from({ length: this.cols }, (__, c): CastleBlock => {
        if (f === 4) return { kind: 'stone', hp: 99, rebuildTimer: 0 };
        // Edge ladder columns stay stone
        if (c === 0 || c === this.cols - 1) return { kind: 'stone', hp: 1, rebuildTimer: 0 };
        return { kind: 'stone', hp: 1, rebuildTimer: 0 };
      })
    );

    // Place 14-18 Cherry Blocks across floors 0..3
    const cherryLayout: Array<[number, number]> = [
      [2, 0], [3, 0], [8, 0], [9, 0],
      [1, 1], [4, 1], [7, 1], [10, 1],
      [2, 2], [5, 2], [6, 2], [9, 2],
      [1, 3], [3, 3], [8, 3], [10, 3],
    ];
    for (const [c, f] of cherryLayout) {
      this.blocks[f][c].kind = 'cherry';
      this.cherryBlocksLeft++;
    }

    // Place 3 Golden Key Blocks on floors 1, 2, 3
    const keyCoords: Array<[number, number]> = [
      [5 + (lvl % 2), 1],
      [3 + (lvl % 2), 2],
      [6, 3],
    ];
    for (const [c, f] of keyCoords) {
      if (this.blocks[f][c].kind === 'cherry') this.cherryBlocksLeft--;
      this.blocks[f][c].kind = 'key';
    }

    // One secret diamond block
    const dc = 4 + ((lvl * 3) % 4);
    if (this.blocks[0][dc].kind === 'stone') {
      this.blocks[0][dc].kind = 'diamond';
    }

    // Authentic Castle Ladders: Fixed Edge Ladders + Tilting Interior Ladders!
    this.ladders = [
      // Fixed edge ladders
      { topFloor: 0, topCol: 0, tilt: 1, fixed: true },
      { topFloor: 0, topCol: this.cols - 1, tilt: -1, fixed: true },
      { topFloor: 1, topCol: 0, tilt: 1, fixed: true },
      { topFloor: 1, topCol: this.cols - 1, tilt: -1, fixed: true },
      { topFloor: 2, topCol: 0, tilt: 1, fixed: true },
      { topFloor: 2, topCol: this.cols - 1, tilt: -1, fixed: true },
      { topFloor: 3, topCol: 0, tilt: 1, fixed: true },
      { topFloor: 3, topCol: this.cols - 1, tilt: -1, fixed: true },
      // Tilting interior ladders (flip when Mr. Do walks over their top!)
      { topFloor: 0, topCol: 4, tilt: 1, fixed: false },
      { topFloor: 0, topCol: 7, tilt: -1, fixed: false },
      { topFloor: 1, topCol: 3, tilt: 1, fixed: false },
      { topFloor: 1, topCol: 8, tilt: -1, fixed: false },
      { topFloor: 2, topCol: 5, tilt: 1, fixed: false },
      { topFloor: 2, topCol: 7, tilt: -1, fixed: false },
      { topFloor: 3, topCol: 3, tilt: 1, fixed: false },
      { topFloor: 3, topCol: 8, tilt: -1, fixed: false },
    ];

    // Reset player at bottom-center
    this.pFloor = 4;
    this.px = this.colCenterX(5);
    this.py = this.floorY[4];
    this.pState = 'walk';
    this.pLadder = null;
    this.pFacing = 1;
    this.invulnTimer = 1.8;
    this.hammerTimer = 0;
    this.hammerCd = 0;

    // Spawn initial patrol Unicorns on upper floors
    const initialCount = Math.min(6, 3 + Math.floor(lvl / 2));
    for (let i = 0; i < initialCount; i++) {
      const f = i % 3;
      const col = i % 2 === 0 ? 2 + (i % 3) : 9 - (i % 3);
      const kind: CastleUnicorn['kind'] = i === 0 && lvl >= 2 ? 'blue' : i % 2 === 1 ? 'green' : 'red';
      this.spawnUnicorn(kind, f, col);
    }
    this.unicornSpawnTimer = 7.5;
  }

  private spawnUnicorn(kind: CastleUnicorn['kind'], floor: number, col: number, letterIdx = 0): void {
    const base = 76 + Math.min(48, (this.level - 1) * 9);
    const mult = kind === 'green' ? 1.18 : kind === 'blue' ? 1.12 : kind === 'alpha' ? 1.05 : 1.0;
    this.unicorns.push({
      x: this.colCenterX(col),
      y: this.floorY[floor],
      floor,
      dir: Math.random() < 0.5 ? -1 : 1,
      kind,
      letterIdx,
      state: 'walk',
      activeLadder: null,
      climbDir: 1,
      speed: base * mult,
      anim: Math.random() * 6,
      alive: true,
      smashCd: 4 + Math.random() * 3,
    });
  }

  private ladderTopX(l: TiltingLadder): number {
    return this.colCenterX(l.topCol);
  }

  private ladderBottomX(l: TiltingLadder): number {
    const bottomCol = l.fixed ? l.topCol : Math.max(1, Math.min(this.cols - 2, l.topCol + l.tilt));
    return this.colCenterX(bottomCol);
  }

  private swingHammer(): void {
    if (this.hammerCd > 0 || this.pState !== 'walk') return;
    this.hammerTimer = 0.24;
    this.hammerCd = 0.34;
    sfx.playBounce();

    if (this.pFloor >= 4) return; // Bottom foundation is solid stone

    // Target the block slightly in front of Mr. Do's feet (or directly beneath)
    const targetX = this.px + this.pFacing * (this.tileW * 0.62);
    const col = this.xToCol(targetX);
    this.knockOutBlock(this.pFloor, col, true);
  }

  private knockOutBlock(floor: number, col: number, byPlayer: boolean): void {
    if (floor < 0 || floor >= 4 || col < 0 || col >= this.cols) return;
    const b = this.blocks[floor][col];
    if (b.kind === 'empty') return;

    const prevKind = b.kind;
    b.kind = 'empty';
    b.rebuildTimer = prevKind === 'stone' ? 6.5 : 11.0;

    const wx = this.colCenterX(col);
    const wy = this.floorY[floor] + 10;

    if (byPlayer && prevKind === 'cherry') {
      this.cherryBlocksLeft = Math.max(0, this.cherryBlocksLeft - 1);
      this.addScore(150, wx, wy - 10, '#fb7185');
      spawnBurst(this.particles, wx, wy, '#f43f5e', 14, 150, 3.2);
      sfx.playPellet();
    } else if (byPlayer && prevKind === 'key') {
      this.keysCollected++;
      this.addScore(500, wx, wy - 10, '#fde047');
      spawnBurst(this.particles, wx, wy, '#fde047', 22, 190, 3.8);
      sfx.playPowerup();
      if (this.keysCollected >= 3 && !this.crownUnlocked) {
        this.crownUnlocked = true;
        this.popups.push({
          x: this.logicalWidth * 0.5,
          y: 92,
          text: 'CROWN DOOR UNLOCKED!',
          color: '#fde047',
          life: 2.0,
          maxLife: 2.0,
        });
        sfx.playStageClear();
      }
    } else if (byPlayer && prevKind === 'diamond') {
      this.diamonds.push({ x: wx, y: this.floorY[floor] - 14, life: 10 });
      spawnBurst(this.particles, wx, wy, '#38bdf8', 18, 170, 3.4);
    } else {
      spawnBurst(this.particles, wx, wy, '#94a3b8', 8, 100, 2.5);
    }

    // Drop the knocked-out block straight down to crush Unicorns below!
    this.fallingBlocks.push({
      col,
      y: this.floorY[floor] + 12,
      vy: 60,
      startFloor: floor,
      kind: prevKind,
      crushCount: 0,
    });
  }

  public step(dt: number): void {
    this.time += dt;
    this.screenShake = Math.max(0, this.screenShake - dt * 2.8);
    stepParticlesAndPopups(this.particles, this.popups, dt);

    if (this.phase === 'TITLE') {
      this.walkAnim += dt * 4;
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
        this.buildCastle(this.level + 1);
        this.phase = 'READY';
        this.phaseTimer = 1.25;
      }
      return;
    }

    if (this.invulnTimer > 0) this.invulnTimer -= dt;
    if (this.hammerTimer > 0) this.hammerTimer -= dt;
    if (this.hammerCd > 0) this.hammerCd -= dt;

    // Rebuild emptied stone gaps slowly so the castle stays navigable
    for (let f = 0; f < 4; f++) {
      for (let c = 0; c < this.cols; c++) {
        const b = this.blocks[f][c];
        if (b.kind === 'empty' && b.rebuildTimer > 0) {
          b.rebuildTimer -= dt;
          if (b.rebuildTimer <= 0) {
            b.kind = 'stone';
          }
        }
      }
    }

    // Periodic reinforcement Unicorn if castle gets quiet
    this.unicornSpawnTimer -= dt;
    if (this.unicornSpawnTimer <= 0) {
      const alive = this.unicorns.filter((u) => u.alive).length;
      if (alive < 3 + Math.min(3, this.level)) {
        const kind: CastleUnicorn['kind'] = this.crownClaimed
          ? 'alpha'
          : Math.random() < 0.25
            ? 'blue'
            : Math.random() < 0.55
              ? 'green'
              : 'red';
        this.spawnUnicorn(kind, 0, Math.random() < 0.5 ? 2 : 9, this.activeAlphaIdx);
      }
      this.unicornSpawnTimer = Math.max(4.5, 9.0 - this.level * 0.5);
    }

    this.stepPlayer(dt);
    this.stepFallingBlocks(dt);
    this.stepUnicorns(dt);
    this.stepDiamonds(dt);

    if (this.cherryBlocksLeft <= 0) {
      this.addScore(1500 * this.level, this.logicalWidth * 0.5, 220, '#4ade80');
      sfx.playStageClear();
      this.phase = 'STAGE_CLEAR';
      this.phaseTimer = 1.9;
    }
  }

  private stepPlayer(dt: number): void {
    const mv = getPrecisionMoveVector(this.input);
    const walkSpd = 165 * mv.scale;
    const climbSpd = 132 * mv.scale;

    if (this.input.fireJustPressed) {
      this.swingHammer();
    }

    // Secondary action: flip nearest tilting ladder on current floor
    if (this.input.secondaryJustPressed && this.pState === 'walk') {
      for (const l of this.ladders) {
        if (!l.fixed && l.topFloor === this.pFloor && Math.abs(this.px - this.ladderTopX(l)) < 38) {
          l.tilt = l.tilt === 1 ? -1 : 1;
          sfx.playBounce();
        }
      }
    }

    if (this.pState === 'fall') {
      this.pVy = Math.min(540, this.pVy + 920 * dt);
      this.py += this.pVy * dt;
      // Land on next solid floor below
      for (let f = this.pFloor + 1; f < this.floors; f++) {
        if (this.py >= this.floorY[f]) {
          const col = this.xToCol(this.px);
          if (f === 4 || this.blocks[f][col].kind !== 'empty') {
            this.py = this.floorY[f];
            this.pFloor = f;
            this.pState = 'walk';
            this.pVy = 0;
            break;
          }
        }
      }
      if (this.py >= this.floorY[4]) {
        this.py = this.floorY[4];
        this.pFloor = 4;
        this.pState = 'walk';
        this.pVy = 0;
      }
      return;
    }

    if (this.pState === 'climb' && this.pLadder) {
      const l = this.pLadder;
      const topY = this.floorY[l.topFloor];
      const botY = this.floorY[l.topFloor + 1];
      if (Math.abs(mv.vy) > 0.1) {
        this.py += Math.sign(mv.vy) * climbSpd * dt;
        this.walkAnim += dt * 10;
      } else if (Math.abs(mv.vx) > 0.35 && Math.abs(this.py - topY) < 18) {
        this.py = topY;
        this.pFloor = l.topFloor;
        this.pState = 'walk';
        this.pLadder = null;
        return;
      } else if (Math.abs(mv.vx) > 0.35 && Math.abs(this.py - botY) < 18) {
        this.py = botY;
        this.pFloor = l.topFloor + 1;
        this.pState = 'walk';
        this.pLadder = null;
        return;
      }

      const t = Math.max(0, Math.min(1, (this.py - topY) / (botY - topY)));
      this.px = this.ladderTopX(l) + (this.ladderBottomX(l) - this.ladderTopX(l)) * t;

      if (this.py <= topY) {
        this.py = topY;
        this.pFloor = l.topFloor;
        this.pState = 'walk';
        this.pLadder = null;
      } else if (this.py >= botY) {
        this.py = botY;
        this.pFloor = l.topFloor + 1;
        this.pState = 'walk';
        this.pLadder = null;
      }
      return;
    }

    // WALKING STATE
    if (Math.abs(mv.vx) > 0.1) {
      const prevX = this.px;
      this.pFacing = mv.vx > 0 ? 1 : -1;
      this.px = Math.max(this.offX + 16, Math.min(this.offX + this.cols * this.tileW - 16, this.px + Math.sign(mv.vx) * walkSpd * dt));
      this.walkAnim += dt * 12;

      // Authentic Mr. Do's Castle: walking across the top of a tilting ladder flips its lean!
      for (const l of this.ladders) {
        if (!l.fixed && l.topFloor === this.pFloor) {
          const lx = this.ladderTopX(l);
          if ((prevX < lx && this.px >= lx) || (prevX > lx && this.px <= lx)) {
            l.tilt = this.pFacing;
          }
        }
      }
    }

    // Try climbing UP a ladder from its bottom
    if (mv.vy < -0.25 && this.pFloor > 0) {
      for (const l of this.ladders) {
        if (l.topFloor === this.pFloor - 1 && Math.abs(this.px - this.ladderBottomX(l)) < 22) {
          this.pState = 'climb';
          this.pLadder = l;
          this.px = this.ladderBottomX(l);
          return;
        }
      }
    }

    // Try climbing DOWN a ladder from its top
    if (mv.vy > 0.25 && this.pFloor < 4) {
      for (const l of this.ladders) {
        if (l.topFloor === this.pFloor && Math.abs(this.px - this.ladderTopX(l)) < 22) {
          this.pState = 'climb';
          this.pLadder = l;
          this.px = this.ladderTopX(l);
          return;
        }
      }
    }

    // Claim top Crown once 3 Key Blocks are knocked out!
    if (this.crownUnlocked && !this.crownClaimed && this.pFloor === 0 && Math.abs(this.px - this.logicalWidth * 0.5) < 34) {
      this.crownClaimed = true;
      this.addScore(2000, this.logicalWidth * 0.5, 92, '#fde047');
      spawnBurst(this.particles, this.logicalWidth * 0.5, 110, '#fde047', 30, 220, 4);
      sfx.playStageClear();
      // Transform live Unicorns into E-X-T-R-A Letter Monsters!
      let li = this.activeAlphaIdx;
      for (const u of this.unicorns) {
        if (!u.alive) continue;
        u.kind = 'alpha';
        u.letterIdx = li;
        li = (li + 1) % 5;
      }
      this.popups.push({
        x: this.logicalWidth * 0.5,
        y: 120,
        text: 'E-X-T-R-A MODE! CRUSH LETTER UNICORNS!',
        color: '#38bdf8',
        life: 2.2,
        maxLife: 2.2,
      });
    }

    // Check if standing over an open smashed gap -> fall safely to lower floor!
    if (this.pFloor < 4) {
      const col = this.xToCol(this.px);
      if (this.blocks[this.pFloor][col].kind === 'empty') {
        this.pState = 'fall';
        this.pVy = 40;
      }
    }
  }

  private stepFallingBlocks(dt: number): void {
    for (let i = this.fallingBlocks.length - 1; i >= 0; i--) {
      const fb = this.fallingBlocks[i];
      fb.vy = Math.min(620, fb.vy + 980 * dt);
      fb.y += fb.vy * dt;
      const bx = this.colCenterX(fb.col);

      // Crush Unicorns caught beneath the falling castle block!
      for (const u of this.unicorns) {
        if (!u.alive) continue;
        if (Math.abs(u.x - bx) < 28 && Math.abs(u.y - 16 - fb.y) < 28) {
          u.alive = false;
          fb.crushCount++;
          const dropFloors = Math.max(1, u.floor - fb.startFloor);
          const pts = 500 * dropFloors * Math.pow(2, Math.min(2, fb.crushCount - 1));
          this.addScore(pts, u.x, u.y - 20, '#fde047');
          spawnBurst(this.particles, u.x, u.y - 14, u.kind === 'alpha' ? '#fde047' : '#f43f5e', 20, 190, 3.8);
          sfx.playEnemyHit();
          this.screenShake = Math.max(this.screenShake, 0.32);

          if (u.kind === 'alpha') {
            this.extraLit[u.letterIdx] = true;
            this.popups.push({
              x: u.x,
              y: u.y - 40,
              text: `LETTER ${EXTRA_WORD[u.letterIdx]}!`,
              color: '#38bdf8',
              life: 1.5,
              maxLife: 1.5,
            });
            if (this.extraLit.every(Boolean)) {
              this.lives++;
              this.extraLit = [false, false, false, false, false];
              this.addScore(5000, this.logicalWidth * 0.5, 190, '#4ade80');
              sfx.playStageClear();
              this.phase = 'STAGE_CLEAR';
              this.phaseTimer = 1.9;
            }
          }
        }
      }

      // Land on next solid floor below
      let landed = false;
      for (let f = fb.startFloor + 1; f < this.floors; f++) {
        if (fb.y >= this.floorY[f] - 4) {
          if (f === 4 || this.blocks[f][fb.col].kind !== 'empty') {
            spawnBurst(this.particles, bx, this.floorY[f], '#cbd5e1', 12, 130, 2.8);
            sfx.playExplosion();
            landed = true;
            break;
          }
        }
      }
      if (landed || fb.y > this.floorY[4] + 20) {
        this.fallingBlocks.splice(i, 1);
      }
    }
  }

  private stepUnicorns(dt: number): void {
    for (const u of this.unicorns) {
      if (!u.alive) continue;
      u.anim += dt * 9;

      if (u.state === 'fall') {
        u.y += 380 * dt;
        for (let f = u.floor + 1; f < this.floors; f++) {
          if (u.y >= this.floorY[f]) {
            const c = this.xToCol(u.x);
            if (f === 4 || this.blocks[f][c].kind !== 'empty') {
              u.y = this.floorY[f];
              u.floor = f;
              u.state = 'walk';
              break;
            }
          }
        }
        if (u.y >= this.floorY[4]) {
          u.y = this.floorY[4];
          u.floor = 4;
          u.state = 'walk';
        }
      } else if (u.state === 'climb' && u.activeLadder) {
        const l = u.activeLadder;
        const topY = this.floorY[l.topFloor];
        const botY = this.floorY[l.topFloor + 1];
        u.y += u.climbDir * u.speed * 0.82 * dt;
        const t = Math.max(0, Math.min(1, (u.y - topY) / (botY - topY)));
        u.x = this.ladderTopX(l) + (this.ladderBottomX(l) - this.ladderTopX(l)) * t;
        if (u.climbDir < 0 && u.y <= topY) {
          u.y = topY;
          u.floor = l.topFloor;
          u.state = 'walk';
          u.activeLadder = null;
          u.dir = this.px >= u.x ? 1 : -1;
        } else if (u.climbDir > 0 && u.y >= botY) {
          u.y = botY;
          u.floor = l.topFloor + 1;
          u.state = 'walk';
          u.activeLadder = null;
          u.dir = this.px >= u.x ? 1 : -1;
        }
      } else {
        // Walk along floor, seeking ladders toward Mr. Do's floor
        u.x += u.dir * u.speed * dt;
        const minX = this.offX + 16;
        const maxX = this.offX + this.cols * this.tileW - 16;
        if (u.x <= minX) {
          u.x = minX;
          u.dir = 1;
        } else if (u.x >= maxX) {
          u.x = maxX;
          u.dir = -1;
        }

        // Fall if floor block beneath Unicorn was smashed out!
        if (u.floor < 4 && this.blocks[u.floor][this.xToCol(u.x)].kind === 'empty') {
          u.state = 'fall';
        } else {
          // Blue Unicorn occasionally smashes a block right above Mr. Do!
          if (u.kind === 'blue' && u.floor < 4 && u.floor < this.pFloor) {
            u.smashCd -= dt;
            if (u.smashCd <= 0 && Math.abs(u.x - this.px) < 42) {
              this.knockOutBlock(u.floor, this.xToCol(u.x), false);
              u.smashCd = 5.5;
            }
          }
          // Climb ladders toward Mr. Do's floor
          if (u.floor > this.pFloor) {
            for (const l of this.ladders) {
              if (l.topFloor === u.floor - 1 && Math.abs(u.x - this.ladderBottomX(l)) < 8) {
                u.state = 'climb';
                u.activeLadder = l;
                u.climbDir = -1;
                break;
              }
            }
          } else if (u.floor < this.pFloor) {
            for (const l of this.ladders) {
              if (l.topFloor === u.floor && Math.abs(u.x - this.ladderTopX(l)) < 8) {
                u.state = 'climb';
                u.activeLadder = l;
                u.climbDir = 1;
                break;
              }
            }
          }
        }
      }

      // Hit Mr. Do!
      if (this.invulnTimer <= 0 && Math.hypot(u.x - this.px, u.y - this.py) < 24) {
        this.loseLife();
        break;
      }
    }
  }

  private stepDiamonds(dt: number): void {
    for (let i = this.diamonds.length - 1; i >= 0; i--) {
      const d = this.diamonds[i];
      d.life -= dt;
      if (Math.hypot(this.px - d.x, this.py - 14 - d.y) < 28) {
        this.addScore(8000, d.x, d.y, '#38bdf8');
        spawnBurst(this.particles, d.x, d.y, '#38bdf8', 24, 210, 4);
        sfx.playStageClear();
        this.diamonds.splice(i, 1);
      } else if (d.life <= 0) {
        this.diamonds.splice(i, 1);
      }
    }
  }

  private loseLife(): void {
    this.lives--;
    sfx.playGameOver();
    spawnBurst(this.particles, this.px, this.py - 16, '#f87171', 24, 190, 3.6);
    this.screenShake = 0.45;
    if (this.lives <= 0) {
      this.phase = 'GAME_OVER';
    } else {
      this.pFloor = 4;
      this.px = this.colCenterX(5);
      this.py = this.floorY[4];
      this.pState = 'walk';
      this.pLadder = null;
      this.invulnTimer = 2.4;
      for (const u of this.unicorns) {
        if (u.floor === 4 && Math.abs(u.x - this.px) < 160) {
          u.floor = 0;
          u.y = this.floorY[0];
          u.state = 'walk';
        }
      }
    }
  }

  public getHudSnapshot(): ClassicGameHud {
    const theme = CASTLE_THEMES[(this.level - 1) % CASTLE_THEMES.length];
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: `CASTLE ${this.level} · ${theme.name}`,
      primaryMetricLabel: 'CHERRIES',
      primaryMetricValue: `${this.cherryBlocksLeft}`,
      secondaryMetricLabel: 'KEYS',
      secondaryMetricValue: `${this.keysCollected}/3 ${this.crownUnlocked ? '👑' : ''}`,
      bannerText:
        this.phase === 'READY'
          ? `CASTLE ${this.level} · SMASH CHERRY BLOCKS & CRUSH UNICORNS!`
          : this.phase === 'STAGE_CLEAR'
            ? 'CASTLE CONQUERED!'
            : '',
      canRestartStage: true,
    };
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.save();
    ctx.scale(dpr, dpr);
    const W = this.logicalWidth;
    const H = this.logicalHeight;
    const theme = CASTLE_THEMES[(this.level - 1) % CASTLE_THEMES.length];

    // Atmospheric Gothic Castle Interior Backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, theme.wall);
    bgGrad.addColorStop(1, '#090b12');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    if (this.screenShake > 0) {
      ctx.translate((Math.random() - 0.5) * 9 * this.screenShake, (Math.random() - 0.5) * 9 * this.screenShake);
    }

    // Subtle Castle Masonry Brick Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.045)';
    ctx.lineWidth = 1;
    for (let y = 76; y < 600; y += 26) {
      ctx.beginPath();
      ctx.moveTo(this.offX, y);
      ctx.lineTo(W - this.offX, y);
      ctx.stroke();
    }

    // Gothic Arched Windows with Flickering Torch Glow
    for (let wIdx = 0; wIdx < 3; wIdx++) {
      const wx = 128 + wIdx * 172;
      for (const wy of [190, 404]) {
        const glow = ctx.createRadialGradient(wx, wy, 4, wx, wy, 46);
        glow.addColorStop(0, 'rgba(251, 191, 36, 0.22)');
        glow.addColorStop(1, 'rgba(251, 191, 36, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(wx, wy, 46, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
        ctx.beginPath();
        ctx.arc(wx, wy - 8, 16, Math.PI, 0);
        ctx.lineTo(wx + 16, wy + 22);
        ctx.lineTo(wx - 16, wy + 22);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Top E-X-T-R-A Letter Plaques + Crown Vault Door
    for (let i = 0; i < 5; i++) {
      const bx = i < 2 ? 42 + i * 54 : i === 2 ? 278 : 408 + (i - 3) * 54;
      const by = 18;
      const lit = this.extraLit[i];
      ctx.fillStyle = lit ? '#eab308' : '#1e293b';
      ctx.strokeStyle = lit ? '#fef08a' : '#475569';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(bx, by, 42, 34, 6);
      ctx.fill();
      ctx.stroke();
      ctx.font = '800 20px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = lit ? '#0f172a' : '#94a3b8';
      ctx.fillText(EXTRA_WORD[i], bx + 21, by + 18);
    }

    // Top-Center Golden Crown Door (floor 0 sanctum)
    const cx = W * 0.5;
    const doorY = this.floorY[0];
    ctx.save();
    ctx.fillStyle = this.crownUnlocked ? '#451a03' : '#334155';
    ctx.strokeStyle = this.crownUnlocked ? '#fde047' : '#94a3b8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, doorY - 38, 28, Math.PI, 0);
    ctx.lineTo(cx + 28, doorY);
    ctx.lineTo(cx - 28, doorY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (!this.crownClaimed) {
      // Glowing Royal Crown inside door
      ctx.fillStyle = this.crownUnlocked ? '#fde047' : '#64748b';
      ctx.beginPath();
      ctx.moveTo(cx - 14, doorY - 12);
      ctx.lineTo(cx - 16, doorY - 30);
      ctx.lineTo(cx - 6, doorY - 22);
      ctx.lineTo(cx, doorY - 34);
      ctx.lineTo(cx + 6, doorY - 22);
      ctx.lineTo(cx + 16, doorY - 30);
      ctx.lineTo(cx + 14, doorY - 12);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Draw Ladders (Fixed Edge + Dynamic Tilting Interior Ladders!)
    for (const l of this.ladders) {
      const tx = this.ladderTopX(l);
      const bx = this.ladderBottomX(l);
      const ty = this.floorY[l.topFloor];
      const by = this.floorY[l.topFloor + 1];
      const railCol = l.fixed ? '#d97706' : '#38bdf8';
      const rungCol = l.fixed ? '#fbbf24' : '#7dd3fc';

      ctx.strokeStyle = railCol;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(tx - 10, ty);
      ctx.lineTo(bx - 10, by);
      ctx.moveTo(tx + 10, ty);
      ctx.lineTo(bx + 10, by);
      ctx.stroke();

      ctx.strokeStyle = rungCol;
      ctx.lineWidth = 2.5;
      const steps = 6;
      for (let s = 1; s < steps; s++) {
        const f = s / steps;
        const rx = tx + (bx - tx) * f;
        const ry = ty + (by - ty) * f;
        ctx.beginPath();
        ctx.moveTo(rx - 10, ry);
        ctx.lineTo(rx + 10, ry);
        ctx.stroke();
      }
    }

    // Draw 5 Tiers of Castle Blocks
    for (let f = 0; f < this.floors; f++) {
      for (let c = 0; c < this.cols; c++) {
        const b = this.blocks[f][c];
        if (b.kind === 'empty') continue;
        const x = this.offX + c * this.tileW;
        const y = this.floorY[f];
        this.drawCastleBlock(ctx, x, y, this.tileW, this.blockH, b.kind, f === 4);
      }
    }

    // Draw Falling Blocks
    for (const fb of this.fallingBlocks) {
      const x = this.offX + fb.col * this.tileW;
      this.drawCastleBlock(ctx, x, fb.y - this.blockH * 0.5, this.tileW, this.blockH, fb.kind === 'empty' ? 'stone' : fb.kind, false);
    }

    // Draw Diamonds
    for (const d of this.diamonds) {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(11, 0);
      ctx.lineTo(0, 12);
      ctx.lineTo(-11, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Draw Unicorns
    for (const u of this.unicorns) {
      if (!u.alive) continue;
      ctx.save();
      ctx.translate(u.x, u.y - 16);
      const bob = Math.sin(u.anim) * 2.2;
      if (u.kind === 'alpha') {
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.roundRect(-14, -15 + bob, 28, 28, 7);
        ctx.fill();
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.font = '900 18px "Outfit", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#0f172a';
        ctx.fillText(EXTRA_WORD[u.letterIdx], 0, bob);
      } else {
        ctx.scale(u.dir, 1);
        const col = u.kind === 'blue' ? '#3b82f6' : u.kind === 'green' ? '#22c55e' : '#ef4444';
        // Unicorn body & legs
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.roundRect(-13, -8 + bob, 24, 16, 6);
        ctx.fill();
        ctx.fillRect(-10, 6, 4, 10);
        ctx.fillRect(4, 6, 4, 10);
        // Snout & iconic gleaming golden horn!
        ctx.beginPath();
        ctx.arc(10, -8 + bob, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.moveTo(14, -14 + bob);
        ctx.lineTo(24, -22 + bob);
        ctx.lineTo(17, -9 + bob);
        ctx.closePath();
        ctx.fill();
        // Eye
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(12, -10 + bob, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(12, -11 + bob, 1.5, 2);
      }
      ctx.restore();
    }

    // Draw Mr. Do! with Giant Castle Hammer
    if (this.invulnTimer <= 0 || Math.floor(this.time * 16) % 2 === 0) {
      ctx.save();
      ctx.translate(this.px, this.py - 18);
      ctx.scale(this.pFacing, 1);
      const stride = Math.sin(this.walkAnim) * 2.5;
      // Shoes
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.ellipse(-5, 14 + stride * 0.4, 5, 3, 0, 0, Math.PI * 2);
      ctx.ellipse(5, 14 - stride * 0.4, 5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      // White polka-dot tunic
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.roundRect(-9, -2, 18, 15, 6);
      ctx.fill();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(-3, 4, 2.2, 0, Math.PI * 2);
      ctx.arc(4, 7, 2.2, 0, Math.PI * 2);
      ctx.fill();
      // Head & cap
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(0, -8, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(3, -7, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(-7, -12);
      ctx.lineTo(0, -21);
      ctx.lineTo(7, -12);
      ctx.closePath();
      ctx.fill();

      // Heavy Wooden Mallet / Hammer!
      ctx.save();
      const swingAngle = this.hammerTimer > 0 ? 1.15 : -0.55;
      ctx.translate(6, 2);
      ctx.rotate(swingAngle);
      ctx.fillStyle = '#b45309';
      ctx.fillRect(0, -2, 18, 4);
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.roundRect(14, -9, 11, 18, 3);
      ctx.fill();
      ctx.strokeStyle = '#fef3c7';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
      ctx.restore();
    }

    renderParticlesAndPopups(ctx, this.particles, this.popups);

    // Bottom Legend Bar
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.fillRect(this.offX, 616, this.cols * this.tileW, 40);
    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('SPACE: SMASH BLOCK ONTO UNICORNS', this.offX + 12, 636);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('BLUE LADDERS TILT AS YOU CROSS!', this.offX + this.cols * this.tileW - 12, 636);

    if (visualMode === 'crt') renderCrtOverlay(ctx, W, H);
    ctx.restore();
  }

  private drawCastleBlock(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    kind: CastleBlockKind,
    solidBase: boolean
  ): void {
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    if (solidBase) {
      grad.addColorStop(0, '#475569');
      grad.addColorStop(1, '#1e293b');
    } else if (kind === 'cherry') {
      grad.addColorStop(0, '#9f1239');
      grad.addColorStop(1, '#4c0519');
    } else if (kind === 'key') {
      grad.addColorStop(0, '#b45309');
      grad.addColorStop(1, '#78350f');
    } else if (kind === 'diamond') {
      grad.addColorStop(0, '#0369a1');
      grad.addColorStop(1, '#0c4a6e');
    } else {
      grad.addColorStop(0, '#64748b');
      grad.addColorStop(1, '#334155');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(x + 1, y, w - 2, h);
    ctx.strokeStyle = kind === 'key' ? '#fde047' : kind === 'cherry' ? '#fda4af' : 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 1.5, y + 0.5, w - 3, h - 1);

    const cx = x + w * 0.5;
    const cy = y + h * 0.5;
    if (kind === 'cherry') {
      ctx.fillStyle = '#fb7185';
      ctx.beginPath();
      ctx.arc(cx - 5, cy + 3, 5, 0, Math.PI * 2);
      ctx.arc(cx + 5, cy + 3, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy);
      ctx.lineTo(cx, cy - 7);
      ctx.lineTo(cx + 5, cy);
      ctx.stroke();
    } else if (kind === 'key') {
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(cx - 6, cy, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(cx - 2, cy - 1.5, 13, 3);
      ctx.fillRect(cx + 6, cy + 1.5, 2.5, 4);
      ctx.fillRect(cx + 10, cy + 1.5, 2.5, 4);
    } else if (kind === 'diamond') {
      ctx.fillStyle = '#7dd3fc';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 7);
      ctx.lineTo(cx + 7, cy);
      ctx.lineTo(cx, cy + 7);
      ctx.lineTo(cx - 7, cy);
      ctx.closePath();
      ctx.fill();
    }
  }
}

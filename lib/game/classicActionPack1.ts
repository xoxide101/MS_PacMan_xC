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

// ============================================================================
// 1. FROGGER (1981 Konami — 5 Road Lanes, 5 River Rows, Lady Frog, Fly, Gator!)
// ============================================================================
interface RoadVehicle {
  x: number;
  row: number;
  w: number;
  vx: number;
  color: string;
  kind: 'car' | 'dozer' | 'racer' | 'truck';
}

interface RiverFloat {
  x: number;
  row: number;
  w: number;
  vx: number;
  kind: 'log' | 'turtles' | 'gator';
  divePhase: number;
  dives: boolean;
  hasLadyFrog?: boolean;
}

export class FroggerArcadeGame implements ArcadeGameInstance {
  public readonly logicalWidth = 650;
  public readonly logicalHeight = 650;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'Hop Forward';

  private storageKey = 'frogger_hd_highscore_v2';
  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();
  private score = 0;
  private highScore = 0;
  private level = 1;
  private lives = 3;
  private clock = 0;
  private stateTimer = 0;

  // 13 authentic rows: 0=Homes, 1..5=River (5 rows!), 6=Median Bank, 7..11=Highway (5 lanes!), 12=Start Bank
  private readonly rows = 13;
  private readonly cols = 13;
  private readonly cell = 50;

  private fx = 325;
  private fRow = 12;
  private bestRow = 12;
  private carryingLadyFrog = false;
  private hopCd = 0;
  private timeLeft = 36;
  private homesFilled = [false, false, false, false, false];
  private bonusBayIdx = -1;
  private bonusBayKind: 'fly' | 'gator' = 'fly';
  private bonusBayTimer = 4.5;

  private snakeX = 120;
  private snakeVx = 85;
  private vehicles: RoadVehicle[] = [];
  private floats: RiverFloat[] = [];
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  constructor() {
    this.highScore = readHighScore(this.storageKey);
    this.setupStage(1);
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public startNewGame(): void {
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.phase = 'READY';
    this.stateTimer = 0.85;
    this.setupStage(1);
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.setupStage(1);
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
        life: 0.9,
        maxLife: 0.9,
      });
    }
  }

  private resetFrog(): void {
    this.fx = 325;
    this.fRow = 12;
    this.bestRow = 12;
    this.carryingLadyFrog = false;
    this.timeLeft = 36;
  }

  private setupStage(lvl: number): void {
    this.homesFilled = [false, false, false, false, false];
    this.resetFrog();
    const mult = 1 + (lvl - 1) * 0.14;

    // Authentic 5 Highway Lanes (Rows 7..11)
    this.vehicles = [
      // Row 7: Semi-trucks moving left
      { x: 110, row: 7, w: 96, vx: -85 * mult, color: '#E2E8F0', kind: 'truck' },
      { x: 430, row: 7, w: 96, vx: -85 * mult, color: '#CBD5E1', kind: 'truck' },
      // Row 8: Fast race cars moving right
      { x: 180, row: 8, w: 46, vx: 195 * mult, color: '#EF4444', kind: 'racer' },
      { x: 520, row: 8, w: 46, vx: 195 * mult, color: '#F97316', kind: 'racer' },
      // Row 9: Pink sedans moving left
      { x: 90, row: 9, w: 48, vx: -110 * mult, color: '#EC4899', kind: 'car' },
      { x: 310, row: 9, w: 48, vx: -110 * mult, color: '#EC4899', kind: 'car' },
      { x: 530, row: 9, w: 48, vx: -110 * mult, color: '#EC4899', kind: 'car' },
      // Row 10: Yellow bulldozers moving right
      { x: 140, row: 10, w: 54, vx: 78 * mult, color: '#FACC15', kind: 'dozer' },
      { x: 380, row: 10, w: 54, vx: 78 * mult, color: '#FACC15', kind: 'dozer' },
      // Row 11: Compact cars moving left
      { x: 70, row: 11, w: 46, vx: -95 * mult, color: '#38BDF8', kind: 'car' },
      { x: 270, row: 11, w: 46, vx: -95 * mult, color: '#38BDF8', kind: 'car' },
      { x: 480, row: 11, w: 46, vx: -95 * mult, color: '#38BDF8', kind: 'car' },
    ];

    // Authentic 5 River Rows (Rows 1..5) with Logs, Diving Turtles, Alligator Log & Lady Frog!
    this.floats = [
      // Row 1: Medium Logs + Alligator Log moving right
      { x: 90, row: 1, w: 126, vx: 82 * mult, kind: 'log', divePhase: 0, dives: false },
      { x: 340, row: 1, w: 126, vx: 82 * mult, kind: lvl >= 2 ? 'gator' : 'log', divePhase: 0, dives: false },
      { x: 575, row: 1, w: 126, vx: 82 * mult, kind: 'log', divePhase: 0, dives: false },
      // Row 2: 2-Turtle groups (some dive!) moving left
      { x: 100, row: 2, w: 78, vx: -96 * mult, kind: 'turtles', divePhase: 0, dives: true },
      { x: 290, row: 2, w: 78, vx: -96 * mult, kind: 'turtles', divePhase: 2.2, dives: false },
      { x: 490, row: 2, w: 78, vx: -96 * mult, kind: 'turtles', divePhase: 4.1, dives: true },
      // Row 3: Long Logs (with Lady Frog hitchhiker!) moving right
      { x: 140, row: 3, w: 185, vx: 108 * mult, kind: 'log', divePhase: 0, dives: false, hasLadyFrog: true },
      { x: 470, row: 3, w: 185, vx: 108 * mult, kind: 'log', divePhase: 0, dives: false },
      // Row 4: Short Logs moving right
      { x: 90, row: 4, w: 96, vx: 68 * mult, kind: 'log', divePhase: 0, dives: false },
      { x: 295, row: 4, w: 96, vx: 68 * mult, kind: 'log', divePhase: 0, dives: false },
      { x: 510, row: 4, w: 96, vx: 68 * mult, kind: 'log', divePhase: 0, dives: false },
      // Row 5: 3-Turtle groups moving left
      { x: 110, row: 5, w: 114, vx: -86 * mult, kind: 'turtles', divePhase: 1.0, dives: false },
      { x: 330, row: 5, w: 114, vx: -86 * mult, kind: 'turtles', divePhase: 3.3, dives: true },
      { x: 540, row: 5, w: 114, vx: -86 * mult, kind: 'turtles', divePhase: 5.0, dives: false },
    ];
  }

  private killFrog(reason: string): void {
    if (this.phase !== 'PLAYING') return;
    this.lives -= 1;
    spawnBurst(this.particles, this.fx, this.fRow * this.cell + 25, '#22C55E', 18, 210, 3.2);
    arcadeAudio.playDeath();
    this.popups.push({ x: this.fx, y: this.fRow * this.cell + 10, text: reason, color: '#EF4444', life: 0.9, maxLife: 0.9 });
    if (this.lives <= 0) this.phase = 'GAME_OVER';
    else this.resetFrog();
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
        this.setupStage(this.level);
      }
      return;
    }

    const attract = this.phase === 'TITLE';
    this.hopCd = Math.max(0, this.hopCd - dt);

    // Bonus Fly / Gator cycling in empty home bays
    this.bonusBayTimer -= dt;
    if (this.bonusBayTimer <= 0) {
      this.bonusBayTimer = 4.2;
      const open = this.homesFilled.map((f, i) => (!f ? i : -1)).filter((i) => i >= 0);
      if (open.length > 0 && Math.random() < 0.72) {
        this.bonusBayIdx = open[Math.floor(Math.random() * open.length)];
        this.bonusBayKind = Math.random() < 0.68 ? 'fly' : 'gator';
      } else {
        this.bonusBayIdx = -1;
      }
    }

    // Move median bank Snake (Level 2+)
    if (this.level >= 2) {
      this.snakeX += this.snakeVx * dt;
      if (this.snakeX < 40 || this.snakeX > this.logicalWidth - 40) this.snakeVx = -this.snakeVx;
    }

    // Move vehicles & floats
    for (const v of this.vehicles) {
      v.x += v.vx * dt;
      if (v.vx > 0 && v.x - v.w * 0.5 > this.logicalWidth + 20) v.x = -v.w * 0.5 - 20;
      if (v.vx < 0 && v.x + v.w * 0.5 < -20) v.x = this.logicalWidth + v.w * 0.5 + 20;
    }
    for (const fl of this.floats) {
      fl.x += fl.vx * dt;
      fl.divePhase += dt * 1.15;
      if (fl.vx > 0 && fl.x - fl.w * 0.5 > this.logicalWidth + 40) fl.x = -fl.w * 0.5 - 40;
      if (fl.vx < 0 && fl.x + fl.w * 0.5 < -40) fl.x = this.logicalWidth + fl.w * 0.5 + 40;
    }

    if (!attract) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.killFrog('TIME UP!');
        return;
      }

      if (this.hopCd <= 0) {
        let moved = false;
        if (this.input.up || this.input.fireJustPressed) {
          this.fRow = Math.max(0, this.fRow - 1);
          moved = true;
        } else if (this.input.down) {
          this.fRow = Math.min(this.rows - 1, this.fRow + 1);
          moved = true;
        } else if (this.input.left) {
          this.fx = Math.max(25, this.fx - this.cell);
          moved = true;
        } else if (this.input.right) {
          this.fx = Math.min(this.logicalWidth - 25, this.fx + this.cell);
          moved = true;
        }
        if (moved) {
          this.hopCd = 0.145;
          arcadeAudio.playJump();
          if (this.fRow < this.bestRow) {
            this.bestRow = this.fRow;
            this.addScore(10);
          }
        }
      }

      // Check Home Bays (Row 0)
      if (this.fRow === 0) {
        const bayCenters = [65, 195, 325, 455, 585];
        let landedIdx = -1;
        for (let i = 0; i < 5; i++) {
          if (Math.abs(this.fx - bayCenters[i]) < 34) landedIdx = i;
        }
        if (landedIdx < 0 || this.homesFilled[landedIdx] || (landedIdx === this.bonusBayIdx && this.bonusBayKind === 'gator')) {
          this.killFrog(landedIdx === this.bonusBayIdx && this.bonusBayKind === 'gator' ? 'CHOMPED!' : 'MISSED BAY!');
          return;
        }
        this.homesFilled[landedIdx] = true;
        let bonus = 50 + Math.round(this.timeLeft) * 10;
        let label = 'SAFE HOME';
        if (landedIdx === this.bonusBayIdx && this.bonusBayKind === 'fly') {
          bonus += 200;
          label = 'BONUS FLY!';
          this.bonusBayIdx = -1;
        }
        if (this.carryingLadyFrog) {
          bonus += 200;
          label = 'LADY FROG!';
        }
        arcadeAudio.playPowerUp();
        this.addScore(bonus, bayCenters[landedIdx], 42, label);
        if (this.homesFilled.every(Boolean)) {
          this.addScore(1000, 325, 290, 'ALL 5 FROGS HOME!');
          arcadeAudio.playStageClear();
          this.phase = 'STAGE_CLEAR';
          this.stateTimer = 1.5;
        } else {
          this.resetFrog();
        }
        return;
      }

      // Check River Rows (Rows 1..5)
      if (this.fRow >= 1 && this.fRow <= 5) {
        let onFloat: RiverFloat | null = null;
        for (const fl of this.floats) {
          if (fl.row !== this.fRow) continue;
          const submerged = fl.dives && Math.sin(fl.divePhase) < -0.72;
          if (submerged) continue;
          if (Math.abs(this.fx - fl.x) <= fl.w * 0.5 - 4) {
            // Alligator head at right end is deadly!
            if (fl.kind === 'gator' && this.fx > fl.x + fl.w * 0.22) {
              this.killFrog('ALLIGATOR JAWS!');
              return;
            }
            onFloat = fl;
            break;
          }
        }
        if (!onFloat) {
          this.killFrog('SPLASH!');
          return;
        }
        this.fx += onFloat.vx * dt;
        if (onFloat.hasLadyFrog && !this.carryingLadyFrog) {
          onFloat.hasLadyFrog = false;
          this.carryingLadyFrog = true;
          arcadeAudio.playCoin();
          this.popups.push({ x: this.fx, y: this.fRow * this.cell, text: 'LADY FROG +200!', color: '#F472B6', life: 0.9, maxLife: 0.9 });
        }
        if (this.fx < 12 || this.fx > this.logicalWidth - 12) {
          this.killFrog('DRIFTED OFF!');
          return;
        }
      }

      // Check Median Snake (Row 6)
      if (this.fRow === 6 && this.level >= 2 && Math.abs(this.fx - this.snakeX) < 30) {
        this.killFrog('SNAKE BITE!');
        return;
      }

      // Check Highway Lanes (Rows 7..11)
      if (this.fRow >= 7 && this.fRow <= 11) {
        for (const v of this.vehicles) {
          if (v.row === this.fRow && Math.abs(this.fx - v.x) < v.w * 0.5 + 14) {
            this.killFrog('SQUISHED!');
            return;
          }
        }
      }
    }
  }

  public getHudSnapshot(): ClassicGameHud {
    const homeCount = this.homesFilled.filter(Boolean).length;
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: `FROGGER · STAGE ${this.level}`,
      primaryMetricLabel: 'HOMES',
      primaryMetricValue: `${homeCount}/5`,
      secondaryMetricLabel: 'TIME',
      secondaryMetricValue: `${Math.max(0, Math.ceil(this.timeLeft))}s`,
      bannerText: this.phase === 'STAGE_CLEAR' ? 'ALL FROGS HOME!' : this.phase === 'GAME_OVER' ? 'GAME OVER' : '',
    };
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = this.logicalWidth;
    const H = this.logicalHeight;

    // River (rows 0..5)
    ctx.fillStyle = '#0B2569';
    ctx.fillRect(0, 0, W, this.cell * 6);
    // Home hedge bar (row 0)
    ctx.fillStyle = '#15803D';
    ctx.fillRect(0, 0, W, this.cell);
    const bayCenters = [65, 195, 325, 455, 585];
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(bayCenters[i] - 28, 6, 56, 44);
      if (this.homesFilled[i]) {
        ctx.fillStyle = '#4ADE80';
        ctx.beginPath();
        ctx.arc(bayCenters[i], 28, 14, 0, Math.PI * 2);
        ctx.fill();
      } else if (i === this.bonusBayIdx) {
        ctx.fillStyle = this.bonusBayKind === 'fly' ? '#FACC15' : '#22C55E';
        ctx.beginPath();
        ctx.arc(bayCenters[i], 28, this.bonusBayKind === 'fly' ? 8 : 13, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Median Bank (row 6) & Start Bank (row 12)
    ctx.fillStyle = '#6D28D9';
    ctx.fillRect(0, this.cell * 6, W, this.cell);
    ctx.fillRect(0, this.cell * 12, W, this.cell);
    // Highway (rows 7..11)
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, this.cell * 7, W, this.cell * 5);
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.35)';
    ctx.setLineDash([14, 14]);
    for (let r = 8; r <= 11; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * this.cell);
      ctx.lineTo(W, r * this.cell);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // River Floats (Logs, Turtles, Alligator Log, Lady Frog)
    for (const fl of this.floats) {
      const y = fl.row * this.cell + 25;
      const diveVal = fl.dives ? Math.sin(fl.divePhase) : 1;
      if (diveVal < -0.72) continue;
      ctx.globalAlpha = diveVal < -0.25 ? 0.45 : 1;
      if (fl.kind === 'turtles') {
        const count = fl.w > 95 ? 3 : 2;
        const step = fl.w / count;
        for (let k = 0; k < count; k++) {
          const tx = fl.x - fl.w * 0.5 + step * (k + 0.5);
          ctx.fillStyle = '#EF4444';
          ctx.beginPath();
          ctx.ellipse(tx, y, 15, 12, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#4ADE80';
          ctx.beginPath();
          ctx.arc(tx - 16, y, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (fl.kind === 'gator') {
        ctx.fillStyle = '#16A34A';
        ctx.beginPath();
        ctx.roundRect(fl.x - fl.w * 0.5, y - 13, fl.w, 26, 8);
        ctx.fill();
        ctx.fillStyle = '#EF4444'; // Snapping jaws at right end
        ctx.fillRect(fl.x + fl.w * 0.25, y - 8, fl.w * 0.24, 16);
      } else {
        ctx.fillStyle = '#92400E';
        ctx.beginPath();
        ctx.roundRect(fl.x - fl.w * 0.5, y - 14, fl.w, 28, 12);
        ctx.fill();
        ctx.fillStyle = '#B45309';
        ctx.fillRect(fl.x - fl.w * 0.42, y - 5, fl.w * 0.84, 5);
        if (fl.hasLadyFrog) {
          ctx.fillStyle = '#F472B6';
          ctx.beginPath();
          ctx.arc(fl.x, y, 10, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    // Median Snake
    if (this.level >= 2) {
      ctx.fillStyle = '#4ADE80';
      ctx.beginPath();
      ctx.roundRect(this.snakeX - 24, this.cell * 6 + 18, 48, 12, 6);
      ctx.fill();
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(this.snakeVx > 0 ? this.snakeX + 22 : this.snakeX - 28, this.cell * 6 + 22, 6, 4);
    }

    // Highway Vehicles
    for (const v of this.vehicles) {
      const y = v.row * this.cell + 25;
      ctx.fillStyle = v.color;
      ctx.beginPath();
      ctx.roundRect(v.x - v.w * 0.5, y - 15, v.w, 30, 6);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(v.x - v.w * 0.22, y - 10, v.w * 0.44, 20);
    }

    // Player Frog
    const fy = this.fRow * this.cell + 25;
    ctx.fillStyle = this.carryingLadyFrog ? '#F472B6' : '#22C55E';
    ctx.beginPath();
    ctx.arc(this.fx, fy, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(this.fx - 6, fy - 8, 4, 0, Math.PI * 2);
    ctx.arc(this.fx + 6, fy - 8, 4, 0, Math.PI * 2);
    ctx.fill();

    renderParticlesAndPopups(ctx, this.particles, this.popups);
    if (this.phase === 'TITLE') {
      ctx.fillStyle = 'rgba(7, 14, 34, 0.72)';
      ctx.fillRect(0, H * 0.38, W, 108);
      ctx.textAlign = 'center';
      ctx.font = '900 36px "JetBrains Mono", monospace';
      ctx.fillStyle = '#4ADE80';
      ctx.fillText('FROGGER', W * 0.5, H * 0.38 + 46);
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText('5 HIGHWAY LANES · 5 RIVER ROWS · LADY FROG · BONUS FLIES & ALLIGATORS', W * 0.5, H * 0.38 + 80);
    }
    if (visualMode === 'crt') renderCrtOverlay(ctx, W, H);
  }
}

// ============================================================================
// 2. JOUST (1982 Williams — Flap Physics, Lance Duels, Hatching Eggs, Troll & Pterodactyl!)
// ============================================================================
interface JoustKnight {
  x: number;
  y: number;
  vx: number;
  vy: number;
  tier: 'bounder' | 'hunter' | 'shadow';
  flapCd: number;
  color: string;
}

interface JoustEgg {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hatchTimer: number;
  hatchedKnight: boolean;
}

export class JoustArcadeGame implements ArcadeGameInstance {
  public readonly logicalWidth = 740;
  public readonly logicalHeight = 560;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'Flap Wings!';

  private storageKey = 'joust_hd_highscore_v2';
  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();
  private score = 0;
  private highScore = 0;
  private level = 1;
  private lives = 3;
  private clock = 0;
  private stateTimer = 0;

  private px = 370;
  private py = 440;
  private pvx = 0;
  private pvy = 0;
  private pFacing = 1;
  private invulnTimer = 0;
  private waveTimer = 0;

  private platforms: Array<{ x: number; y: number; w: number; h: number; baseBridge?: boolean }> = [];
  private knights: JoustKnight[] = [];
  private eggs: JoustEgg[] = [];
  private ptero: { active: boolean; x: number; y: number; vx: number; vy: number } = { active: false, x: -50, y: 120, vx: 190, vy: 0 };
  private trollHandY = 560;
  private trollX = 370;
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  constructor() {
    this.highScore = readHighScore(this.storageKey);
    this.setupWave(1);
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public startNewGame(): void {
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.phase = 'READY';
    this.stateTimer = 0.85;
    this.setupWave(1);
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.setupWave(1);
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

  private setupWave(lvl: number): void {
    this.px = 370;
    this.py = 446;
    this.pvx = 0;
    this.pvy = 0;
    this.invulnTimer = 1.6;
    this.waveTimer = 0;
    this.ptero.active = false;
    this.eggs = [];
    this.knights = [];

    // Authentic Williams Joust floating rock ledges + burning bottom bridge on Wave 2+!
    const bridgeW = lvl >= 2 ? 320 : 540;
    this.platforms = [
      { x: (this.logicalWidth - bridgeW) * 0.5, y: 472, w: bridgeW, h: 18, baseBridge: true },
      { x: 0, y: 315, w: 155, h: 16 },
      { x: this.logicalWidth - 155, y: 315, w: 155, h: 16 },
      { x: 245, y: 340, w: 250, h: 16 },
      { x: 270, y: 175, w: 200, h: 16 },
      { x: 0, y: 135, w: 120, h: 16 },
      { x: this.logicalWidth - 120, y: 135, w: 120, h: 16 },
    ];

    const count = Math.min(8, 2 + lvl);
    for (let i = 0; i < count; i++) {
      const tier: JoustKnight['tier'] = lvl >= 4 && i === 0 ? 'shadow' : lvl >= 2 && i % 2 === 1 ? 'hunter' : 'bounder';
      this.knights.push({
        x: 90 + ((i * 150) % (this.logicalWidth - 180)),
        y: 120 + (i % 2) * 165,
        vx: (i % 2 === 0 ? 1 : -1) * (tier === 'shadow' ? 165 : tier === 'hunter' ? 125 : 95),
        vy: 0,
        tier,
        flapCd: 0.4 + Math.random() * 0.5,
        color: tier === 'shadow' ? '#38BDF8' : tier === 'hunter' ? '#94A3B8' : '#EF4444',
      });
    }
  }

  private resolvePlatforms(ent: { x: number; y: number; vy: number }, halfH: number): void {
    for (const p of this.platforms) {
      if (ent.x >= p.x - 10 && ent.x <= p.x + p.w + 10) {
        if (ent.vy > 0 && ent.y + halfH >= p.y && ent.y + halfH <= p.y + 18) {
          ent.y = p.y - halfH;
          ent.vy = 0;
        } else if (ent.vy < 0 && ent.y - halfH <= p.y + p.h && ent.y - halfH >= p.y) {
          ent.y = p.y + p.h + halfH;
          ent.vy = Math.abs(ent.vy) * 0.45;
        }
      }
    }
  }

  private killPlayer(): void {
    if (this.invulnTimer > 0 || this.phase !== 'PLAYING') return;
    this.lives -= 1;
    this.invulnTimer = 2.0;
    arcadeAudio.playDeath();
    spawnBurst(this.particles, this.px, this.py, '#FACC15', 22, 230, 3.5);
    if (this.lives <= 0) this.phase = 'GAME_OVER';
    else {
      this.px = 370;
      this.py = 446;
      this.pvx = 0;
      this.pvy = 0;
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
        this.setupWave(this.level);
      }
      return;
    }

    const attract = this.phase === 'TITLE';
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    this.waveTimer += dt;

    // Player ostrich flight physics
    if (attract) {
      this.pvx = Math.sin(this.clock * 1.2) * 155;
      if (this.py > 320) this.pvy = -210;
    } else {
      if (this.input.left) {
        this.pvx -= 480 * dt;
        this.pFacing = -1;
      }
      if (this.input.right) {
        this.pvx += 480 * dt;
        this.pFacing = 1;
      }
      if (this.input.fireJustPressed || this.input.up) {
        this.pvy = Math.max(-280, this.pvy - 195);
        if (this.input.fireJustPressed) arcadeAudio.playJump();
      }
    }
    this.pvx *= Math.pow(0.965, dt * 60);
    this.pvx = Math.max(-260, Math.min(260, this.pvx));
    this.pvy = Math.min(340, this.pvy + 470 * dt);
    this.px = (this.px + this.pvx * dt + this.logicalWidth) % this.logicalWidth;
    this.py = Math.max(24, this.py + this.pvy * dt);
    const pObj = { x: this.px, y: this.py, vy: this.pvy };
    this.resolvePlatforms(pObj, 16);
    this.py = pObj.y;
    this.pvy = pObj.vy;

    // Lava pit & Lava Troll Hand!
    if (!attract && this.py > 505) {
      this.killPlayer();
      return;
    }
    if (this.py > 435 && (this.px < 200 || this.px > this.logicalWidth - 200)) {
      this.trollX += (this.px - this.trollX) * Math.min(1, dt * 4);
      this.trollHandY = Math.max(468, this.trollHandY - 120 * dt);
      if (!attract && Math.hypot(this.px - this.trollX, this.py - this.trollHandY) < 26) {
        this.pvy += 320 * dt; // Lava troll pulls you down!
      }
    } else {
      this.trollHandY = Math.min(560, this.trollHandY + 90 * dt);
    }

    // Authentic Pterodactyl spawns if player stalls > 24s!
    if (!attract && this.waveTimer > 24 && !this.ptero.active) {
      this.ptero = { active: true, x: 10, y: 150, vx: 215, vy: 0 };
      this.popups.push({ x: 370, y: 95, text: 'BEWARE THE PTERODACTYL!', color: '#EF4444', life: 1.5, maxLife: 1.5 });
    }
    if (this.ptero.active) {
      this.ptero.x = (this.ptero.x + this.ptero.vx * dt + this.logicalWidth) % this.logicalWidth;
      this.ptero.y += Math.sign(this.py - this.ptero.y) * 95 * dt;
      if (!attract && Math.hypot(this.ptero.x - this.px, this.ptero.y - this.py) < 26) {
        // Authentic weak spot: strike directly into its open beak at nearly same height!
        if (Math.abs(this.py - this.ptero.y) < 10 && Math.sign(this.ptero.x - this.px) === this.pFacing) {
          this.ptero.active = false;
          spawnBurst(this.particles, this.ptero.x, this.ptero.y, '#FACC15', 26, 250, 3.8);
          arcadeAudio.playExplosion(true);
          this.addScore(1000, this.ptero.x, this.ptero.y, 'PTERODACTYL SLAIN!');
        } else {
          this.killPlayer();
          return;
        }
      }
    }

    // Update Buzzard Knights & Lance Jousting!
    for (let i = this.knights.length - 1; i >= 0; i--) {
      const k = this.knights[i];
      k.flapCd -= dt;
      if (k.flapCd <= 0) {
        k.flapCd = k.tier === 'shadow' ? 0.34 : 0.56;
        if (k.y > (k.tier === 'bounder' ? 320 : this.py - 28)) k.vy = -195;
        if (k.tier !== 'bounder' && Math.random() < 0.45) {
          k.vx = Math.sign(this.px - k.x) * (k.tier === 'shadow' ? 180 : 135);
        }
      }
      k.vy = Math.min(280, k.vy + 400 * dt);
      k.x = (k.x + k.vx * dt + this.logicalWidth) % this.logicalWidth;
      k.y = Math.max(26, Math.min(455, k.y + k.vy * dt));
      this.resolvePlatforms(k, 16);

      if (!attract && Math.hypot(k.x - this.px, k.y - this.py) < 28) {
        if (this.py < k.y - 6) {
          // Player lance is HIGHER -> Unhorse enemy knight into an Egg!
          this.pvy = -195;
          spawnBurst(this.particles, k.x, k.y, k.color, 16, 200, 3);
          arcadeAudio.playStomp();
          const pts = k.tier === 'shadow' ? 1500 : k.tier === 'hunter' ? 750 : 500;
          this.addScore(pts, k.x, k.y);
          this.eggs.push({ x: k.x, y: k.y, vx: k.vx * 0.65, vy: -140, hatchTimer: 7.0, hatchedKnight: false });
          this.knights.splice(i, 1);
        } else if (k.y < this.py - 6) {
          this.killPlayer();
          return;
        } else {
          // Equal lance height -> Bounce apart!
          const push = Math.sign(this.px - k.x) || 1;
          this.pvx = push * 210;
          k.vx = -push * 180;
          arcadeAudio.playPaddleBounce();
        }
      }
    }

    // Eggs bounce, hatch into walking Knights, and remount into Buzzards!
    for (let i = this.eggs.length - 1; i >= 0; i--) {
      const e = this.eggs[i];
      e.vy = Math.min(340, e.vy + 520 * dt);
      e.x = (e.x + e.vx * dt + this.logicalWidth) % this.logicalWidth;
      e.y += e.vy * dt;
      e.vx *= Math.pow(0.97, dt * 60);
      this.resolvePlatforms(e, 10);
      if (e.y > 505) {
        this.eggs.splice(i, 1);
        continue;
      }
      if (!attract && Math.hypot(e.x - this.px, e.y - this.py) < 26) {
        arcadeAudio.playCoin();
        this.addScore(e.vy !== 0 ? 500 : 250, e.x, e.y, e.vy !== 0 ? 'MID-AIR EGG' : 'EGG');
        this.eggs.splice(i, 1);
        continue;
      }
      e.hatchTimer -= dt;
      if (e.hatchTimer <= 2.2) e.hatchedKnight = true;
      if (e.hatchTimer <= 0) {
        // Remounted into stronger Buzzard Knight!
        this.knights.push({
          x: e.x,
          y: e.y - 12,
          vx: (Math.random() < 0.5 ? -1 : 1) * 140,
          vy: -150,
          tier: 'hunter',
          flapCd: 0.4,
          color: '#94A3B8',
        });
        this.eggs.splice(i, 1);
      }
    }

    if (!attract && this.knights.length === 0 && this.eggs.length === 0) {
      arcadeAudio.playStageClear();
      this.addScore(1000, 370, 220, 'WAVE CLEARED');
      this.phase = 'STAGE_CLEAR';
      this.stateTimer = 1.4;
    }
  }

  public getHudSnapshot(): ClassicGameHud {
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: `JOUST · WAVE ${this.level}`,
      primaryMetricLabel: 'KNIGHTS',
      primaryMetricValue: `${this.knights.length} (${this.eggs.length} EGGS)`,
      secondaryMetricLabel: 'PTERO',
      secondaryMetricValue: this.ptero.active ? 'HUNTING!' : `${Math.max(0, Math.ceil(24 - this.waveTimer))}s`,
      bannerText: this.phase === 'STAGE_CLEAR' ? 'WAVE CONQUERED!' : this.phase === 'GAME_OVER' ? 'GAME OVER' : '',
    };
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = this.logicalWidth;
    const H = this.logicalHeight;

    ctx.fillStyle = '#07060F';
    ctx.fillRect(0, 0, W, H);

    // Molten Lava Pit + Troll Hand
    const lava = ctx.createLinearGradient(0, 505, 0, H);
    lava.addColorStop(0, '#F97316');
    lava.addColorStop(1, '#DC2626');
    ctx.fillStyle = lava;
    ctx.fillRect(0, 508, W, H - 508);
    if (this.trollHandY < 555) {
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(this.trollX - 10, this.trollHandY, 20, 560 - this.trollHandY);
      ctx.beginPath();
      ctx.arc(this.trollX, this.trollHandY, 13, Math.PI, 0);
      ctx.fill();
    }

    // Floating Rock Platforms
    for (const p of this.platforms) {
      ctx.fillStyle = p.baseBridge ? '#92400E' : '#B45309';
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(p.x, p.y, p.w, 4);
    }

    // Eggs & Hatching tiny Knights
    for (const e of this.eggs) {
      ctx.fillStyle = e.hatchedKnight ? '#FACC15' : '#4ADE80';
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, 8, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      if (e.hatchedKnight) {
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(e.x - 4, e.y - 16, 8, 8);
      }
    }

    // Enemy Buzzard Riders
    for (const k of this.knights) {
      ctx.save();
      ctx.translate(k.x, k.y);
      const dir = Math.sign(k.vx) || 1;
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.ellipse(0, 4, 16, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = k.color;
      ctx.fillRect(-7, -14, 14, 14);
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(dir > 0 ? 4 : -24, -8, 20, 3); // Lance
      ctx.restore();
    }

    // Pterodactyl
    if (this.ptero.active) {
      ctx.save();
      ctx.translate(this.ptero.x, this.ptero.y);
      ctx.fillStyle = '#22C55E';
      ctx.beginPath();
      ctx.moveTo(26, 0);
      ctx.lineTo(-22, -16);
      ctx.lineTo(-10, 0);
      ctx.lineTo(-22, 16);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(18, -3, 10, 6);
      ctx.restore();
    }

    // Player Golden Ostrich Knight
    ctx.save();
    ctx.translate(this.px, this.py);
    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.ellipse(0, 4, 16, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(-7, -14, 14, 14);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(this.pFacing > 0 ? 4 : -26, -9, 22, 3.5); // Player Lance
    ctx.restore();

    renderParticlesAndPopups(ctx, this.particles, this.popups);
    if (this.phase === 'TITLE') {
      ctx.fillStyle = 'rgba(7, 6, 15, 0.72)';
      ctx.fillRect(0, H * 0.36, W, 110);
      ctx.textAlign = 'center';
      ctx.font = '900 36px "JetBrains Mono", monospace';
      ctx.fillStyle = '#FACC15';
      ctx.fillText('JOUST', W * 0.5, H * 0.36 + 46);
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText('HIGHER LANCE WINS · CATCH EGGS BEFORE HATCHING · DODGE LAVA TROLL & PTERODACTYL', W * 0.5, H * 0.36 + 80);
    }
    if (visualMode === 'crt') renderCrtOverlay(ctx, W, H);
  }
}

// ============================================================================
// 3. PENGO (1982 Sega — Sliding Ice Blocks, Wall-Shake Stun, Hidden Eggs & Diamond Bonus!)
// ============================================================================
export class PengoArcadeGame implements ArcadeGameInstance {
  public readonly logicalWidth = 572;
  public readonly logicalHeight = 650;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'Push Block / Shake Wall';

  private storageKey = 'pengo_hd_highscore_v2';
  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();
  private score = 0;
  private highScore = 0;
  private level = 1;
  private lives = 3;
  private clock = 0;
  private stateTimer = 0;

  private readonly cols = 13;
  private readonly rows = 15;
  private readonly cell = 42;
  private readonly ox = 13;
  private readonly oy = 10;

  // 0 empty, 1 ice, 2 diamond, 3 hidden Sno-Bee egg ice block!
  private grid: number[][] = [];
  private px = 6;
  private py = 7;
  private dir = { x: 1, y: 0 };
  private moveCd = 0;
  private eggRevealTimer = 2.4;
  private wallShakeSide = -1; // 0 top, 1 right, 2 bottom, 3 left
  private wallShakeTimer = 0;
  private diamondBonusAwarded = false;

  private sliding: Array<{ x: number; y: number; vx: number; vy: number; isDiamond: boolean }> = [];
  private bees: Array<{ x: number; y: number; vx: number; vy: number; stunned: number }> = [];
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  constructor() {
    this.highScore = readHighScore(this.storageKey);
    this.setupStage(1);
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public startNewGame(): void {
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.phase = 'READY';
    this.stateTimer = 0.85;
    this.setupStage(1);
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.setupStage(1);
  }

  private addScore(pts: number, gx?: number, gy?: number, label?: string): void {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(this.storageKey, this.highScore);
    }
    if (gx !== undefined && gy !== undefined) {
      this.popups.push({
        x: this.ox + gx * this.cell + 21,
        y: this.oy + gy * this.cell + 10,
        text: label ? `${label} +${pts}` : `+${pts}`,
        color: '#FEF08A',
        life: 0.9,
        maxLife: 0.9,
      });
    }
  }

  private setupStage(lvl: number): void {
    this.grid = Array.from({ length: this.rows }, (_, r) =>
      Array.from({ length: this.cols }, (__, c) => {
        if (r === 7 && c === 6) return 0;
        if (r === 1 || r === this.rows - 2 || c === 1 || c === this.cols - 2) return Math.random() < 0.25 ? 1 : 0;
        return (r % 2 === 0 || c % 2 === 0) && Math.random() < 0.62 ? 1 : 0;
      }),
    );

    // Place 3 Diamond Blocks!
    const diamonds = [
      [3, 3],
      [9, 5],
      [5, 11],
    ];
    for (const [cx, cy] of diamonds) this.grid[cy][cx] = 2;

    // Place 3 Hidden Sno-Bee Egg Blocks (flash at stage start!)
    let eggsPlaced = 0;
    for (let r = 1; r < this.rows - 1 && eggsPlaced < 3; r++) {
      for (let c = 1; c < this.cols - 1 && eggsPlaced < 3; c++) {
        if (this.grid[r][c] === 1 && Math.random() < 0.08) {
          this.grid[r][c] = 3;
          eggsPlaced++;
        }
      }
    }

    this.px = 6;
    this.py = 7;
    this.sliding = [];
    this.eggRevealTimer = 2.6;
    this.diamondBonusAwarded = false;
    this.bees = [];
    const beeCount = Math.min(5, 2 + lvl);
    const starts = [
      [0, 0],
      [this.cols - 1, 0],
      [0, this.rows - 1],
      [this.cols - 1, this.rows - 1],
      [6, 0],
    ];
    for (let i = 0; i < beeCount; i++) {
      const [bx, by] = starts[i % starts.length];
      this.grid[by][bx] = 0;
      this.bees.push({ x: bx, y: by, vx: 1, vy: 0, stunned: 0 });
    }
  }

  private checkDiamondAlignment(): void {
    if (this.diamondBonusAwarded) return;
    const pts: Array<[number, number]> = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) if (this.grid[r][c] === 2) pts.push([c, r]);
    }
    if (pts.length !== 3) return;
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const horiz = pts[0][1] === pts[1][1] && pts[1][1] === pts[2][1] && pts[1][0] === pts[0][0] + 1 && pts[2][0] === pts[1][0] + 1;
    const vert = pts[0][0] === pts[1][0] && pts[1][0] === pts[2][0] && pts[1][1] === pts[0][1] + 1 && pts[2][1] === pts[1][1] + 1;
    if (horiz || vert) {
      this.diamondBonusAwarded = true;
      arcadeAudio.playExtraLife();
      this.addScore(10000, pts[1][0], pts[1][1], 'DIAMOND LINEUP!');
      for (const b of this.bees) b.stunned = 6.0;
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
        this.setupStage(this.level);
      }
      return;
    }

    const attract = this.phase === 'TITLE';
    this.moveCd = Math.max(0, this.moveCd - dt);
    this.eggRevealTimer = Math.max(0, this.eggRevealTimer - dt);
    this.wallShakeTimer = Math.max(0, this.wallShakeTimer - dt);

    if (!attract && this.moveCd <= 0) {
      let dx = 0;
      let dy = 0;
      if (this.input.left) dx = -1;
      else if (this.input.right) dx = 1;
      else if (this.input.up) dy = -1;
      else if (this.input.down) dy = 1;
      if (dx !== 0 || dy !== 0) {
        this.dir = { x: dx, y: dy };
        const nx = this.px + dx;
        const ny = this.py + dy;
        if (nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows && this.grid[ny][nx] === 0) {
          this.px = nx;
          this.py = ny;
          this.moveCd = 0.11;
        }
      }
    }

    // Authentic Push Block OR Wall-Shake Stun!
    if (!attract && this.input.fireJustPressed) {
      const tx = this.px + this.dir.x;
      const ty = this.py + this.dir.y;
      if (tx < 0 || tx >= this.cols || ty < 0 || ty >= this.rows) {
        // Authentic Sega Pengo Wall-Shake! Stuns any Sno-Bee touching that border wall!
        this.wallShakeSide = ty < 0 ? 0 : tx >= this.cols ? 1 : ty >= this.rows ? 2 : 3;
        this.wallShakeTimer = 0.45;
        arcadeAudio.playRockThud();
        for (const b of this.bees) {
          const touching =
            (this.wallShakeSide === 0 && b.y < 1.2) ||
            (this.wallShakeSide === 1 && b.x > this.cols - 2.2) ||
            (this.wallShakeSide === 2 && b.y > this.rows - 2.2) ||
            (this.wallShakeSide === 3 && b.x < 1.2);
          if (touching) b.stunned = 4.5;
        }
      } else if (this.grid[ty][tx] >= 1) {
        const val = this.grid[ty][tx];
        const bx = tx + this.dir.x;
        const by = ty + this.dir.y;
        const blocked = bx < 0 || bx >= this.cols || by < 0 || by >= this.rows || this.grid[by][bx] !== 0;
        if (blocked && val !== 2) {
          // Crush regular ice block (or hidden Egg block for 500 pts!)
          this.grid[ty][tx] = 0;
          spawnBurst(this.particles, this.ox + tx * this.cell + 21, this.oy + ty * this.cell + 21, val === 3 ? '#FACC15' : '#38BDF8', 14, 180, 3);
          arcadeAudio.playRockThud();
          if (val === 3) this.addScore(500, tx, ty, 'EGG CRUSHED');
        } else if (!blocked) {
          this.grid[ty][tx] = 0;
          this.sliding.push({ x: tx, y: ty, vx: this.dir.x * 13, vy: this.dir.y * 13, isDiamond: val === 2 });
          arcadeAudio.playThrow();
        }
      }
    }

    // Move sliding ice blocks
    for (let i = this.sliding.length - 1; i >= 0; i--) {
      const s = this.sliding[i];
      const nx = s.x + s.vx * dt;
      const ny = s.y + s.vy * dt;
      const gx = Math.round(nx);
      const gy = Math.round(ny);
      for (let j = this.bees.length - 1; j >= 0; j--) {
        if (Math.hypot(this.bees[j].x - nx, this.bees[j].y - ny) < 0.78) {
          spawnBurst(this.particles, this.ox + this.bees[j].x * this.cell + 21, this.oy + this.bees[j].y * this.cell + 21, '#FACC15', 16, 200, 3);
          if (!attract) {
            arcadeAudio.playStomp();
            this.addScore(400, this.bees[j].x, this.bees[j].y, 'CRUSH!');
          }
          this.bees.splice(j, 1);
        }
      }
      if (gx < 0 || gx >= this.cols || gy < 0 || gy >= this.rows || this.grid[gy][gx] !== 0) {
        const fx = Math.max(0, Math.min(this.cols - 1, Math.round(s.x)));
        const fy = Math.max(0, Math.min(this.rows - 1, Math.round(s.y)));
        this.grid[fy][fx] = s.isDiamond ? 2 : 1;
        this.sliding.splice(i, 1);
        if (s.isDiamond) this.checkDiamondAlignment();
      } else {
        s.x = nx;
        s.y = ny;
      }
    }

    // Move Sno-Bees (including authentic Ice-Block Tunneling + Stunned Squishing!)
    for (let i = this.bees.length - 1; i >= 0; i--) {
      const b = this.bees[i];
      if (b.stunned > 0) {
        b.stunned -= dt;
        if (!attract && Math.hypot(b.x - this.px, b.y - this.py) < 0.72) {
          spawnBurst(this.particles, this.ox + b.x * this.cell + 21, this.oy + b.y * this.cell + 21, '#4ADE80', 14, 180, 3);
          arcadeAudio.playStomp();
          this.addScore(100, b.x, b.y, 'SQUISH');
          this.bees.splice(i, 1);
        }
        continue;
      }

      const spd = 2.4 + this.level * 0.22;
      const nx = b.x + b.vx * spd * dt;
      const ny = b.y + b.vy * spd * dt;
      const gx = Math.round(nx);
      const gy = Math.round(ny);
      if (gx < 0 || gx >= this.cols || gy < 0 || gy >= this.rows || this.grid[gy][gx] !== 0) {
        // Sno-Bee can break normal ice blocks to tunnel toward Pengo!
        if (gx >= 0 && gx < this.cols && gy >= 0 && gy < this.rows && this.grid[gy][gx] === 1 && Math.random() < 0.22) {
          this.grid[gy][gx] = 0;
        }
        const dirs = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ];
        const pick = dirs[Math.floor(Math.random() * dirs.length)];
        b.vx = pick[0];
        b.vy = pick[1];
      } else {
        b.x = nx;
        b.y = ny;
      }

      if (!attract && Math.hypot(b.x - this.px, b.y - this.py) < 0.66) {
        this.lives -= 1;
        arcadeAudio.playDeath();
        if (this.lives <= 0) this.phase = 'GAME_OVER';
        else {
          this.px = 6;
          this.py = 7;
        }
        return;
      }
    }

    // If all active Sno-Bees defeated, hatch remaining hidden Egg block (or clear stage!)
    if (!attract && this.bees.length === 0) {
      let hatched = false;
      for (let r = 0; r < this.rows && !hatched; r++) {
        for (let c = 0; c < this.cols && !hatched; c++) {
          if (this.grid[r][c] === 3) {
            this.grid[r][c] = 0;
            this.bees.push({ x: c, y: r, vx: 1, vy: 0, stunned: 0 });
            hatched = true;
          }
        }
      }
      if (!hatched) {
        arcadeAudio.playStageClear();
        this.addScore(1500, 6, 7, 'ACT CLEAR');
        this.phase = 'STAGE_CLEAR';
        this.stateTimer = 1.4;
      }
    }
  }

  public getHudSnapshot(): ClassicGameHud {
    let eggs = 0;
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) if (this.grid[r][c] === 3) eggs++;
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: `PENGO · ACT ${this.level}`,
      primaryMetricLabel: 'SNO-BEES',
      primaryMetricValue: `${this.bees.length} (+${eggs} EGGS)`,
      secondaryMetricLabel: 'WALL SHAKE',
      secondaryMetricValue: this.wallShakeTimer > 0 ? 'STUN!' : 'READY',
      bannerText: this.phase === 'STAGE_CLEAR' ? 'ACT CLEARED!' : this.phase === 'GAME_OVER' ? 'GAME OVER' : '',
    };
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = this.logicalWidth;
    const H = this.logicalHeight;

    ctx.fillStyle = '#070E24';
    ctx.fillRect(0, 0, W, H);

    // Outer Shakeable Ice Border Frame
    ctx.strokeStyle = this.wallShakeTimer > 0 ? '#FACC15' : '#38BDF8';
    ctx.lineWidth = this.wallShakeTimer > 0 ? 10 : 6;
    ctx.strokeRect(this.ox - 4, this.oy - 4, this.cols * this.cell + 8, this.rows * this.cell + 8);

    // Ice, Egg, and Diamond Blocks
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const v = this.grid[r][c];
        if (v === 0) continue;
        const x = this.ox + c * this.cell + 2;
        const y = this.oy + r * this.cell + 2;
        const flashEgg = v === 3 && this.eggRevealTimer > 0 && Math.floor(this.clock * 10) % 2 === 0;
        ctx.fillStyle = v === 2 ? '#FACC15' : flashEgg ? '#F472B6' : '#0EA5E9';
        ctx.fillRect(x, y, this.cell - 4, this.cell - 4);
        ctx.fillStyle = 'rgba(255,255,255,0.34)';
        ctx.fillRect(x + 3, y + 3, this.cell - 10, 6);
        if (v === 2) {
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 6, y + 6, this.cell - 16, this.cell - 16);
        }
      }
    }

    // Sliding Blocks
    for (const s of this.sliding) {
      ctx.fillStyle = s.isDiamond ? '#FACC15' : '#7DD3FC';
      ctx.fillRect(this.ox + s.x * this.cell + 2, this.oy + s.y * this.cell + 2, this.cell - 4, this.cell - 4);
    }

    // Sno-Bees
    for (const b of this.bees) {
      const bx = this.ox + b.x * this.cell + 21;
      const by = this.oy + b.y * this.cell + 21;
      ctx.fillStyle = b.stunned > 0 ? '#94A3B8' : '#22C55E';
      ctx.beginPath();
      ctx.arc(bx, by, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(bx - 6, by - 4, 4, 4);
      ctx.fillRect(bx + 2, by - 4, 4, 4);
    }

    // Pengo Red Penguin
    const px = this.ox + this.px * this.cell + 21;
    const py = this.oy + this.py * this.cell + 21;
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(px, py, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.arc(px + this.dir.x * 8, py + this.dir.y * 8, 5, 0, Math.PI * 2);
    ctx.fill();

    renderParticlesAndPopups(ctx, this.particles, this.popups);
    if (this.phase === 'TITLE') {
      ctx.fillStyle = 'rgba(7, 14, 36, 0.72)';
      ctx.fillRect(0, H * 0.38, W, 108);
      ctx.textAlign = 'center';
      ctx.font = '900 36px "JetBrains Mono", monospace';
      ctx.fillStyle = '#38BDF8';
      ctx.fillText('PENGO', W * 0.5, H * 0.38 + 46);
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText('SLIDE ICE BLOCKS · SHAKE OUTER WALLS TO STUN · LINE UP 3 DIAMONDS!', W * 0.5, H * 0.38 + 80);
    }
    if (visualMode === 'crt') renderCrtOverlay(ctx, W, H);
  }
}

// ============================================================================
// 4. POPEYE (1982 Nintendo — 3 Distinct Stages, Sea Hag Bottles, Hanging Bucket & Brutus!)
// ============================================================================
export class PopeyeArcadeGame implements ArcadeGameInstance {
  public readonly logicalWidth = 680;
  public readonly logicalHeight = 560;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'Punch!';

  private storageKey = 'popeye_hd_highscore_v2';
  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();
  private score = 0;
  private highScore = 0;
  private level = 1;
  private lives = 3;
  private clock = 0;
  private stateTimer = 0;

  private readonly floors = [142, 248, 354, 468];
  private px = 340;
  private py = 468;
  private pdir = 1;
  private punchTimer = 0;
  private spinachTimer = 0;
  private spinachCan = { x: 110, y: 248, taken: false };
  private bucket = { x: 340, y: 120, falling: false, dropped: false };

  private collected = 0;
  private goal = 16;
  private items: Array<{ x: number; y: number; vy: number; kind: 'heart' | 'note' | 'letter'; label?: string }> = [];
  private bottles: Array<{ x: number; y: number; vx: number }> = [];
  private brutus = { x: 560, y: 248, koTimer: 0, leapCd: 2.5 };
  private itemCd = 0.8;
  private bottleCd = 2.4;
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  constructor() {
    this.highScore = readHighScore(this.storageKey);
    this.setupStage(1);
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public startNewGame(): void {
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.phase = 'READY';
    this.stateTimer = 0.85;
    this.setupStage(1);
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.setupStage(1);
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

  private setupStage(lvl: number): void {
    this.px = 340;
    this.py = 468;
    this.collected = 0;
    this.goal = 14 + lvl * 2;
    this.items = [];
    this.bottles = [];
    this.spinachTimer = 0;
    this.spinachCan = { x: lvl % 2 === 1 ? 105 : 575, y: 248, taken: false };
    this.bucket = { x: 340, y: 120, falling: false, dropped: false };
    this.brutus = { x: 560, y: 248, koTimer: 0, leapCd: 2.6 };
    this.itemCd = 0.7;
    this.bottleCd = 2.4;
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
        this.setupStage(this.level);
      }
      return;
    }

    const attract = this.phase === 'TITLE';
    this.punchTimer = Math.max(0, this.punchTimer - dt);
    this.spinachTimer = Math.max(0, this.spinachTimer - dt);

    const stairs = [170, 510];
    if (attract) {
      this.px = 340 + Math.sin(this.clock * 1.4) * 200;
    } else {
      const spd = this.spinachTimer > 0 ? 255 : 210;
      const nearStair = stairs.find((sx) => Math.abs(this.px - sx) < 22);
      if (this.input.left) {
        this.px -= spd * dt;
        this.pdir = -1;
      }
      if (this.input.right) {
        this.px += spd * dt;
        this.pdir = 1;
      }
      if (nearStair !== undefined && (this.input.up || this.input.down)) {
        this.px = nearStair;
        if (this.input.up) this.py -= spd * 0.88 * dt;
        if (this.input.down) this.py += spd * 0.88 * dt;
      } else {
        // Snap smoothly to nearest floor
        let bestF = this.floors[0];
        let bestD = 999;
        for (const fy of this.floors) {
          if (Math.abs(this.py - fy) < bestD) {
            bestD = Math.abs(this.py - fy);
            bestF = fy;
          }
        }
        this.py += (bestF - this.py) * Math.min(1, dt * 16);
      }
      this.px = Math.max(52, Math.min(this.logicalWidth - 52, this.px));
      this.py = Math.max(142, Math.min(468, this.py));

      if (this.input.fireJustPressed && this.punchTimer <= 0) {
        this.punchTimer = 0.24;
        arcadeAudio.playThrow();
        // Punch hanging bucket on Stage 1!
        if (!this.bucket.dropped && !this.bucket.falling && Math.hypot(this.px - this.bucket.x, this.py - this.bucket.y) < 42) {
          this.bucket.falling = true;
          arcadeAudio.playCoin();
        }
      }
    }

    // Falling Bucket drops onto Brutus's head!
    if (this.bucket.falling) {
      this.bucket.y += 310 * dt;
      if (this.brutus.koTimer <= 0 && Math.hypot(this.bucket.x - this.brutus.x, this.bucket.y - this.brutus.y) < 34) {
        this.brutus.koTimer = 4.5;
        this.bucket.falling = false;
        this.bucket.dropped = true;
        arcadeAudio.playStomp();
        this.addScore(1000, this.brutus.x, this.brutus.y - 20, 'BUCKET KO!');
      } else if (this.bucket.y > 495) {
        this.bucket.falling = false;
        this.bucket.dropped = true;
      }
    }

    // Spinach Can pickup
    if (!this.spinachCan.taken && Math.hypot(this.px - this.spinachCan.x, this.py - this.spinachCan.y) < 28) {
      this.spinachCan.taken = true;
      this.spinachTimer = 7.5;
      if (!attract) {
        arcadeAudio.playPowerUp();
        this.addScore(500, this.px, this.py - 20, 'SPINACH POWER!');
      }
    }

    // Olive Oyl drops Hearts (Stage 1), Music Notes (Stage 2), or H-E-L-P Letters (Stage 3)!
    const stageType = (this.level - 1) % 3;
    this.itemCd -= dt;
    if (this.itemCd <= 0) {
      this.itemCd = 1.0;
      const oliveX = 340 + Math.sin(this.clock * 1.1) * 220;
      const letters = ['H', 'E', 'L', 'P'];
      this.items.push({
        x: oliveX,
        y: 78,
        vy: 56 + this.level * 5,
        kind: stageType === 0 ? 'heart' : stageType === 1 ? 'note' : 'letter',
        label: stageType === 2 ? letters[this.collected % 4] : undefined,
      });
    }

    for (let i = this.items.length - 1; i >= 0; i--) {
      const h = this.items[i];
      h.y += h.vy * dt;
      h.x += Math.sin(this.clock * 3.8 + i) * 34 * dt;
      if (Math.hypot(h.x - this.px, h.y - this.py) < 28) {
        this.items.splice(i, 1);
        this.collected += 1;
        spawnBurst(this.particles, h.x, h.y, '#F472B6', 10, 150, 2.8);
        if (!attract) {
          arcadeAudio.playCoin();
          this.addScore(300, h.x, h.y);
          if (this.collected >= this.goal) {
            arcadeAudio.playStageClear();
            this.addScore(1500, 340, 240, 'OLIVE RESCUED!');
            this.phase = 'STAGE_CLEAR';
            this.stateTimer = 1.4;
          }
        }
        continue;
      }
      if (h.y > 515) this.items.splice(i, 1);
    }

    // Sea Hag throws Bottles (Punchable for +100 pts!)
    this.bottleCd -= dt;
    if (this.bottleCd <= 0 && !attract) {
      this.bottleCd = Math.max(1.5, 3.0 - this.level * 0.15);
      const fromLeft = Math.random() < 0.5;
      const fy = this.floors[Math.floor(Math.random() * 3) + 1];
      this.bottles.push({ x: fromLeft ? 20 : this.logicalWidth - 20, y: fy - 4, vx: (fromLeft ? 1 : -1) * 195 });
    }
    for (let i = this.bottles.length - 1; i >= 0; i--) {
      const b = this.bottles[i];
      b.x += b.vx * dt;
      if (this.punchTimer > 0 && Math.hypot(b.x - (this.px + this.pdir * 22), b.y - this.py) < 24) {
        spawnBurst(this.particles, b.x, b.y, '#4ADE80', 10, 160, 2.6);
        arcadeAudio.playRockThud();
        this.addScore(100, b.x, b.y, 'SMASH!');
        this.bottles.splice(i, 1);
        continue;
      }
      if (!attract && this.spinachTimer <= 0 && Math.hypot(b.x - this.px, b.y - this.py) < 20) {
        this.bottles.splice(i, 1);
        this.lives -= 1;
        arcadeAudio.playDeath();
        if (this.lives <= 0) this.phase = 'GAME_OVER';
        else {
          this.px = 340;
          this.py = 468;
        }
        return;
      }
      if (b.x < -20 || b.x > this.logicalWidth + 20) this.bottles.splice(i, 1);
    }

    // Brutus chase + authentic deck leaps!
    if (this.brutus.koTimer > 0) {
      this.brutus.koTimer -= dt;
    } else {
      const bSpd = 108 + this.level * 12;
      this.brutus.leapCd -= dt;
      if (this.brutus.leapCd <= 0 && Math.abs(this.brutus.x - this.px) < 42 && Math.abs(this.brutus.y - this.py) > 60 && Math.abs(this.brutus.y - this.py) < 130) {
        // Brutus leaps directly up/down between decks!
        this.brutus.y = this.py;
        this.brutus.leapCd = 3.2;
      } else if (Math.abs(this.brutus.y - this.py) > 25) {
        const nearestStair = Math.abs(this.brutus.x - 170) < Math.abs(this.brutus.x - 510) ? 170 : 510;
        if (Math.abs(this.brutus.x - nearestStair) > 10) {
          this.brutus.x += Math.sign(nearestStair - this.brutus.x) * bSpd * dt;
        } else {
          this.brutus.y += Math.sign(this.py - this.brutus.y) * bSpd * dt;
        }
      } else {
        this.brutus.x += Math.sign(this.px - this.brutus.x) * bSpd * dt;
      }

      if (Math.hypot(this.brutus.x - this.px, this.brutus.y - this.py) < 28) {
        if (this.spinachTimer > 0) {
          this.brutus.koTimer = 4.6;
          this.brutus.x = this.px < 340 ? 580 : 100;
          this.brutus.y = 354;
          spawnBurst(this.particles, this.px + this.pdir * 20, this.py, '#FACC15', 22, 240, 3.6);
          if (!attract) {
            arcadeAudio.playExplosion(true);
            this.addScore(3000, this.px, this.py - 20, 'BRUTUS KO!');
          }
        } else if (!attract) {
          this.lives -= 1;
          arcadeAudio.playDeath();
          if (this.lives <= 0) this.phase = 'GAME_OVER';
          else {
            this.px = 340;
            this.py = 468;
            this.brutus.x = 560;
            this.brutus.y = 248;
          }
        }
      }
    }
  }

  public getHudSnapshot(): ClassicGameHud {
    const names = ['DOCKS (HEARTS)', 'STREET (NOTES)', 'PIRATE SHIP (HELP)'];
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: `POPEYE · ${names[(this.level - 1) % 3]}`,
      primaryMetricLabel: 'COLLECTED',
      primaryMetricValue: `${this.collected}/${this.goal}`,
      secondaryMetricLabel: 'SPINACH',
      secondaryMetricValue: this.spinachTimer > 0 ? `${Math.ceil(this.spinachTimer)}s` : this.spinachCan.taken ? 'USED' : 'READY',
      bannerText: this.phase === 'STAGE_CLEAR' ? 'OLIVE RESCUED!' : this.phase === 'GAME_OVER' ? 'GAME OVER' : '',
    };
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = this.logicalWidth;
    const H = this.logicalHeight;

    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#0C4A6E');
    sky.addColorStop(0.85, '#1E3A8A');
    sky.addColorStop(1, '#0284C7');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Decks & Stairs
    for (const fy of this.floors) {
      ctx.fillStyle = '#B45309';
      ctx.fillRect(30, fy + 16, W - 60, 14);
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(30, fy + 16, W - 60, 4);
    }
    ctx.strokeStyle = '#FDE68A';
    ctx.lineWidth = 4;
    for (const sx of [170, 510]) {
      ctx.beginPath();
      ctx.moveTo(sx - 12, 141);
      ctx.lineTo(sx - 12, 484);
      ctx.moveTo(sx + 12, 141);
      ctx.lineTo(sx + 12, 484);
      ctx.stroke();
    }

    // Punchable Hanging Bucket
    if (!this.bucket.dropped) {
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(this.bucket.x - 12, this.bucket.y - 12, 24, 22);
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.bucket.x, 90);
      ctx.lineTo(this.bucket.x, this.bucket.y - 12);
      ctx.stroke();
    }

    // Olive Oyl
    const oliveX = 340 + Math.sin(this.clock * 1.1) * 220;
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(oliveX - 8, 52, 16, 24);
    ctx.fillStyle = '#FDE68A';
    ctx.beginPath();
    ctx.arc(oliveX, 44, 8, 0, Math.PI * 2);
    ctx.fill();

    // Spinach Can
    if (!this.spinachCan.taken) {
      ctx.fillStyle = '#16A34A';
      ctx.fillRect(this.spinachCan.x - 10, this.spinachCan.y - 10, 20, 22);
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(this.spinachCan.x - 7, this.spinachCan.y - 3, 14, 7);
    }

    // Falling Hearts / Music Notes / HELP Letters
    for (const h of this.items) {
      if (h.kind === 'heart') {
        ctx.fillStyle = '#F43F5E';
        ctx.beginPath();
        ctx.arc(h.x - 5, h.y - 2, 6, 0, Math.PI * 2);
        ctx.arc(h.x + 5, h.y - 2, 6, 0, Math.PI * 2);
        ctx.lineTo(h.x, h.y + 11);
        ctx.closePath();
        ctx.fill();
      } else if (h.kind === 'note') {
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.arc(h.x, h.y + 4, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(h.x + 4, h.y - 12, 3, 16);
      } else {
        ctx.fillStyle = '#FACC15';
        ctx.font = '900 16px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(h.label ?? 'H', h.x, h.y + 6);
      }
    }

    // Sea Hag Bottles
    for (const b of this.bottles) {
      ctx.fillStyle = '#4ADE80';
      ctx.fillRect(b.x - 8, b.y - 4, 16, 8);
    }

    // Brutus
    if (this.brutus.koTimer <= 0) {
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(this.brutus.x - 14, this.brutus.y - 16, 28, 32);
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(this.brutus.x - 10, this.brutus.y - 24, 20, 10);
    }

    // Popeye
    ctx.save();
    ctx.translate(this.px, this.py);
    ctx.fillStyle = this.spinachTimer > 0 ? '#4ADE80' : '#2563EB';
    ctx.fillRect(-10, -10, 20, 26);
    ctx.fillStyle = '#FDE68A';
    ctx.beginPath();
    ctx.arc(0, -18, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-10, -27, 20, 6);
    if (this.punchTimer > 0) {
      ctx.fillStyle = '#FDE68A';
      ctx.beginPath();
      ctx.arc(this.pdir * 22, -4, 9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    renderParticlesAndPopups(ctx, this.particles, this.popups);
    if (this.phase === 'TITLE') {
      ctx.fillStyle = 'rgba(7, 14, 34, 0.72)';
      ctx.fillRect(0, H * 0.36, W, 110);
      ctx.textAlign = 'center';
      ctx.font = '900 36px "JetBrains Mono", monospace';
      ctx.fillStyle = '#FACC15';
      ctx.fillText('POPEYE', W * 0.5, H * 0.36 + 46);
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText('CATCH HEARTS/NOTES/HELP · PUNCH SEA HAG BOTTLES & BUCKET · GRAB SPINACH!', W * 0.5, H * 0.36 + 80);
    }
    if (visualMode === 'crt') renderCrtOverlay(ctx, W, H);
  }
}

// ============================================================================
// 5. MR. DO! (1982 Universal — Pushable Apples, 8-Cherry Streak, Diggers & EXTRA Alpha-Monster!)
// ============================================================================
export class MrDoArcadeGame implements ArcadeGameInstance {
  public readonly logicalWidth = 600;
  public readonly logicalHeight = 640;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'Throw Powerball';

  private storageKey = 'mrdo_hd_highscore_v2';
  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();
  private score = 0;
  private highScore = 0;
  private level = 1;
  private lives = 3;
  private clock = 0;
  private stateTimer = 0;

  private readonly cols = 15;
  private readonly rows = 16;
  private readonly cell = 38;
  private readonly ox = 15;
  private readonly oy = 16;

  // 0 tunnel, 1 earth, 2 cherry
  private grid: number[][] = [];
  private px = 7;
  private py = 13;
  private pDir = { x: 1, y: 0 };
  private moveCd = 0;
  private cherryStreak = 0;
  private extraMask = [false, false, false, false, false]; // E X T R A
  private treatActive = false;

  private ball = { active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, recharge: 0 };
  private apples: Array<{ x: number; y: number; wobble: number; falling: boolean }> = [];
  private monsters: Array<{ x: number; y: number; vx: number; vy: number; kind: 'normal' | 'digger' | 'alpha'; letterIdx?: number; color: string; morphTimer: number }> = [];
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  constructor() {
    this.highScore = readHighScore(this.storageKey);
    this.setupStage(1);
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public startNewGame(): void {
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.extraMask = [false, false, false, false, false];
    this.phase = 'READY';
    this.stateTimer = 0.85;
    this.setupStage(1);
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.setupStage(1);
  }

  private addScore(pts: number, gx?: number, gy?: number, label?: string): void {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(this.storageKey, this.highScore);
    }
    if (gx !== undefined && gy !== undefined) {
      this.popups.push({
        x: this.ox + gx * this.cell + 19,
        y: this.oy + gy * this.cell + 10,
        text: label ? `${label} +${pts}` : `+${pts}`,
        color: '#FEF08A',
        life: 0.85,
        maxLife: 0.85,
      });
    }
  }

  private setupStage(lvl: number): void {
    this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(1));
    this.px = 7;
    this.py = 13;
    this.cherryStreak = 0;
    this.treatActive = true;
    this.ball = { active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, recharge: 0 };

    for (let r = 3; r <= 13; r++) this.grid[r][7] = 0;
    for (let c = 2; c <= 12; c++) this.grid[7][c] = 0;

    // 8-cherry orchard clusters!
    const clusters = [
      [2, 2],
      [11, 2],
      [2, 11],
      [11, 11],
      [6, 2],
      [6, 10],
    ];
    for (const [cx, cy] of clusters) {
      for (let dr = 0; dr < 2; dr++) {
        for (let dc = 0; dc < 2; dc++) {
          if (this.grid[cy + dr]?.[cx + dc] !== undefined) this.grid[cy + dr][cx + dc] = 2;
        }
      }
    }

    this.apples = [
      { x: 4, y: 3, wobble: 0, falling: false },
      { x: 10, y: 3, wobble: 0, falling: false },
      { x: 3, y: 9, wobble: 0, falling: false },
      { x: 11, y: 9, wobble: 0, falling: false },
    ];
    this.monsters = [];
    const count = Math.min(7, 3 + lvl);
    for (let i = 0; i < count; i++) {
      this.monsters.push({
        x: 7,
        y: 4 + (i % 3),
        vx: i % 2 === 0 ? 1 : -1,
        vy: 0,
        kind: 'normal',
        color: '#EF4444',
        morphTimer: 6 + i * 3,
      });
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
        this.setupStage(this.level);
      }
      return;
    }

    const attract = this.phase === 'TITLE';
    this.moveCd = Math.max(0, this.moveCd - dt);
    this.ball.recharge = Math.max(0, this.ball.recharge - dt);

    if (!attract && this.moveCd <= 0) {
      let dx = 0;
      let dy = 0;
      if (this.input.left) dx = -1;
      else if (this.input.right) dx = 1;
      else if (this.input.up) dy = -1;
      else if (this.input.down) dy = 1;
      if (dx !== 0 || dy !== 0) {
        this.pDir = { x: dx, y: dy };
        const nx = Math.max(0, Math.min(this.cols - 1, this.px + dx));
        const ny = Math.max(0, Math.min(this.rows - 1, this.py + dy));

        // Authentic Horizontal Apple Pushing!
        const pushApple = this.apples.find((a) => !a.falling && Math.round(a.x) === nx && Math.round(a.y) === ny);
        if (pushApple) {
          if (dy === 0 && nx + dx >= 0 && nx + dx < this.cols && this.grid[ny][nx + dx] === 0) {
            pushApple.x = nx + dx;
            this.px = nx;
            this.moveCd = 0.14;
            arcadeAudio.playRockThud();
          }
        } else {
          this.px = nx;
          this.py = ny;
          this.moveCd = 0.11;
          if (this.grid[ny][nx] === 2) {
            this.cherryStreak += 1;
            arcadeAudio.playCoin();
            this.addScore(50);
            if (this.cherryStreak >= 8) {
              this.cherryStreak = 0;
              this.addScore(500, nx, ny, '8-CHERRY STREAK!');
              arcadeAudio.playPowerUp();
            }
          } else {
            this.cherryStreak = 0;
            if (this.grid[ny][nx] === 1) arcadeAudio.playDigStep();
          }
          this.grid[ny][nx] = 0;
        }
      }
    }

    // Authentic Center Bonus Treat -> Summons E-X-T-R-A Alpha-Monster!
    if (!attract && this.treatActive && this.px === 7 && this.py === 7) {
      this.treatActive = false;
      arcadeAudio.playPowerUp();
      this.addScore(1000, 7, 7, 'ALPHA-MONSTER!');
      const nextIdx = this.extraMask.findIndex((m) => !m);
      this.monsters.push({
        x: 7,
        y: 3,
        vx: 1,
        vy: 0,
        kind: 'alpha',
        letterIdx: nextIdx >= 0 ? nextIdx : 0,
        color: '#FACC15',
        morphTimer: 99,
      });
    }

    // Powerball Throw & Recharge!
    if (!attract && this.input.fireJustPressed && !this.ball.active && this.ball.recharge <= 0) {
      this.ball = {
        active: true,
        x: this.px,
        y: this.py,
        vx: this.pDir.x * 11.5,
        vy: this.pDir.y * 11.5,
        life: 2.2,
        recharge: 0,
      };
      arcadeAudio.playThrow();
    }

    if (this.ball.active) {
      this.ball.life -= dt;
      const nx = this.ball.x + this.ball.vx * dt;
      const ny = this.ball.y + this.ball.vy * dt;
      const gx = Math.round(nx);
      const gy = Math.round(ny);
      if (gx < 0 || gx >= this.cols || gy < 0 || gy >= this.rows || this.grid[gy][gx] !== 0) {
        if (gx < 0 || gx >= this.cols || (gy >= 0 && gy < this.rows && this.grid[gy][Math.round(this.ball.x)] === 0)) {
          this.ball.vx = -this.ball.vx;
        } else {
          this.ball.vy = -this.ball.vy;
        }
      } else {
        this.ball.x = nx;
        this.ball.y = ny;
      }
      for (let i = this.monsters.length - 1; i >= 0; i--) {
        const m = this.monsters[i];
        if (Math.hypot(m.x - this.ball.x, m.y - this.ball.y) < 0.85) {
          spawnBurst(this.particles, this.ox + m.x * this.cell + 19, this.oy + m.y * this.cell + 19, m.color, 16, 200, 3);
          arcadeAudio.playExplosion(false);
          if (m.kind === 'alpha' && m.letterIdx !== undefined) {
            this.extraMask[m.letterIdx] = true;
            const letters = ['E', 'X', 'T', 'R', 'A'];
            this.addScore(1000, m.x, m.y, `LETTER ${letters[m.letterIdx]}!`);
            if (this.extraMask.every(Boolean)) {
              this.lives += 1;
              this.extraMask = [false, false, false, false, false];
              arcadeAudio.playExtraLife();
              this.phase = 'STAGE_CLEAR';
              this.stateTimer = 1.4;
            }
          } else {
            this.addScore(500, m.x, m.y);
          }
          this.monsters.splice(i, 1);
          this.ball.active = false;
          this.ball.recharge = 1.35;
          break;
        }
      }
      if (this.ball.life <= 0) this.ball.active = false;
    }

    // Wobbling & Falling Apples (crush monsters AND can crush Mr. Do!)
    for (let i = this.apples.length - 1; i >= 0; i--) {
      const a = this.apples[i];
      const belowY = Math.min(this.rows - 1, Math.floor(a.y) + 1);
      if (!a.falling && belowY < this.rows && this.grid[belowY][Math.round(a.x)] === 0) {
        a.wobble += dt;
        if (a.wobble >= 0.55) a.falling = true;
      }
      if (a.falling) {
        a.y += 7.8 * dt;
        if (!attract && Math.hypot(this.px - a.x, this.py - a.y) < 0.65) {
          this.lives -= 1;
          arcadeAudio.playDeath();
          if (this.lives <= 0) this.phase = 'GAME_OVER';
          else {
            this.px = 7;
            this.py = 13;
          }
          return;
        }
        for (let j = this.monsters.length - 1; j >= 0; j--) {
          const m = this.monsters[j];
          if (Math.hypot(m.x - a.x, m.y - a.y) < 0.85) {
            spawnBurst(this.particles, this.ox + m.x * this.cell + 19, this.oy + m.y * this.cell + 19, '#EF4444', 18, 220, 3.2);
            if (!attract) {
              arcadeAudio.playStomp();
              this.addScore(1000, m.x, m.y, 'CRUSH!');
            }
            this.monsters.splice(j, 1);
          }
        }
        const checkY = Math.floor(a.y) + 1;
        if (checkY >= this.rows || this.grid[checkY][Math.round(a.x)] !== 0) {
          arcadeAudio.playRockThud();
          this.apples.splice(i, 1);
        }
      }
    }

    // Move Monsters (Normal morphs into Blue Digger that carves earth toward Mr. Do!)
    for (const m of this.monsters) {
      if (m.kind === 'normal') {
        m.morphTimer -= dt;
        if (m.morphTimer <= 0) {
          m.kind = 'digger';
          m.color = '#38BDF8';
        }
      }
      const spd = (m.kind === 'alpha' ? 3.2 : 2.5) + this.level * 0.22;
      const nx = m.x + m.vx * spd * dt;
      const ny = m.y + m.vy * spd * dt;
      const gx = Math.round(nx);
      const gy = Math.round(ny);
      const canPass =
        gx >= 0 && gx < this.cols && gy >= 0 && gy < this.rows && (this.grid[gy][gx] === 0 || m.kind === 'digger');
      if (!canPass) {
        const dirs = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ];
        const valid = dirs.filter(([dx, dy]) => {
          const tx = Math.round(m.x) + dx;
          const ty = Math.round(m.y) + dy;
          return tx >= 0 && tx < this.cols && ty >= 0 && ty < this.rows && (this.grid[ty][tx] === 0 || m.kind === 'digger');
        });
        const pick = valid.length > 0 ? valid[Math.floor(Math.random() * valid.length)] : [0, 0];
        m.vx = pick[0];
        m.vy = pick[1];
      } else {
        m.x = nx;
        m.y = ny;
        if (m.kind === 'digger' && this.grid[gy][gx] === 1) this.grid[gy][gx] = 0;
      }

      if (!attract && Math.hypot(m.x - this.px, m.y - this.py) < 0.65) {
        this.lives -= 1;
        arcadeAudio.playDeath();
        if (this.lives <= 0) this.phase = 'GAME_OVER';
        else {
          this.px = 7;
          this.py = 13;
        }
        return;
      }
    }

    let cherries = 0;
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) if (this.grid[r][c] === 2) cherries++;
    if (!attract && (cherries === 0 || this.monsters.length === 0)) {
      arcadeAudio.playStageClear();
      this.addScore(1500, 7, 7, 'SCENE CLEAR');
      this.phase = 'STAGE_CLEAR';
      this.stateTimer = 1.3;
    }
  }

  public getHudSnapshot(): ClassicGameHud {
    let cherries = 0;
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) if (this.grid[r][c] === 2) cherries++;
    const extraStr = ['E', 'X', 'T', 'R', 'A'].map((l, i) => (this.extraMask[i] ? l : '_')).join('');
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: `MR. DO! · SCENE ${this.level}`,
      primaryMetricLabel: 'CHERRIES',
      primaryMetricValue: String(cherries),
      secondaryMetricLabel: 'EXTRA',
      secondaryMetricValue: extraStr,
      bannerText: this.phase === 'STAGE_CLEAR' ? 'SCENE CLEARED!' : this.phase === 'GAME_OVER' ? 'GAME OVER' : '',
    };
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = this.logicalWidth;
    const H = this.logicalHeight;

    ctx.fillStyle = '#070B14';
    ctx.fillRect(0, 0, W, H);

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = this.ox + c * this.cell;
        const y = this.oy + r * this.cell;
        if (this.grid[r][c] >= 1) {
          ctx.fillStyle = r % 2 === 0 ? '#15803D' : '#166534';
          ctx.fillRect(x, y, this.cell, this.cell);
        }
        if (this.grid[r][c] === 2) {
          ctx.fillStyle = '#EF4444';
          ctx.beginPath();
          ctx.arc(x + 14, y + 23, 7, 0, Math.PI * 2);
          ctx.arc(x + 24, y + 25, 7, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Center Bonus Treat
    if (this.treatActive) {
      const tx = this.ox + 7 * this.cell + 19;
      const ty = this.oy + 7 * this.cell + 19;
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(tx, ty, 11, 0, Math.PI * 2);
      ctx.fill();
    }

    // Apples (with wobble shake!)
    for (const a of this.apples) {
      const shake = !a.falling && a.wobble > 0 ? Math.sin(this.clock * 45) * 3 : 0;
      const ax = this.ox + a.x * this.cell + 19 + shake;
      const ay = this.oy + a.y * this.cell + 19;
      ctx.fillStyle = '#DC2626';
      ctx.beginPath();
      ctx.arc(ax, ay + 2, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4ADE80';
      ctx.fillRect(ax - 2, ay - 14, 7, 5);
    }

    // Monsters & Alpha-Monster
    const letters = ['E', 'X', 'T', 'R', 'A'];
    for (const m of this.monsters) {
      const mx = this.ox + m.x * this.cell + 19;
      const my = this.oy + m.y * this.cell + 19;
      ctx.fillStyle = m.color;
      ctx.beginPath();
      ctx.arc(mx, my, 13, 0, Math.PI * 2);
      ctx.fill();
      if (m.kind === 'alpha' && m.letterIdx !== undefined) {
        ctx.fillStyle = '#0F172A';
        ctx.font = '900 13px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(letters[m.letterIdx], mx, my + 5);
      } else {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(mx - 6, my - 4, 4, 4);
        ctx.fillRect(mx + 2, my - 4, 4, 4);
      }
    }

    if (this.ball.active) {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(this.ox + this.ball.x * this.cell + 19, this.oy + this.ball.y * this.cell + 19, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    const px = this.ox + this.px * this.cell + 19;
    const py = this.oy + this.py * this.cell + 19;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(px, py, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(px, py - 10, 10, Math.PI, 0);
    ctx.fill();

    renderParticlesAndPopups(ctx, this.particles, this.popups);
    if (this.phase === 'TITLE') {
      ctx.fillStyle = 'rgba(7, 11, 20, 0.72)';
      ctx.fillRect(0, H * 0.4, W, 110);
      ctx.textAlign = 'center';
      ctx.font = '900 36px "JetBrains Mono", monospace';
      ctx.fillStyle = '#EF4444';
      ctx.fillText('MR. DO!', W * 0.5, H * 0.4 + 46);
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText('PUSH APPLES · 8-CHERRY STREAK · DIGGER MONSTERS · SPELL E-X-T-R-A!', W * 0.5, H * 0.4 + 80);
    }
    if (visualMode === 'crt') renderCrtOverlay(ctx, W, H);
  }
}

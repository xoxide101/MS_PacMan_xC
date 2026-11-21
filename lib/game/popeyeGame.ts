import { arcadeAudio } from './audio';
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

const LOGICAL_W = 540;
const LOGICAL_H = 600;

// 4 deck Y coordinates (top -> bottom)
const DECK_Y = [155, 270, 385, 500];

interface StairDef {
  x: number;
  topDeck: number;
  botDeck: number;
}

interface DropToken {
  x: number;
  y: number;
  vx: number;
  vy: number;
  swayPhase: number;
  kind: 'heart' | 'note' | 'help';
  letter?: string;
  sinkTimer: number;
  alive: boolean;
}

interface HazardProj {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: 'bottle' | 'skull' | 'vulture';
  alive: boolean;
}

export class PopeyeArcadeGame implements ArcadeGameInstance {
  public readonly logicalWidth = LOGICAL_W;
  public readonly logicalHeight = LOGICAL_H;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'Punch';
  public readonly secondaryActionLabel = undefined;

  private readonly storageKey = 'popeye_hd_highscore_v1';
  private phase: ClassicGamePhase = 'TITLE';
  private score = 0;
  private highScore = 0;
  private level = 1; // cycles Stage 1 Docks, Stage 2 Sweet Haven Village, Stage 3 Pirate Ship
  private lives = 3;
  private input: ArcadeInputState = createEmptyInput();
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  private stairs: StairDef[] = [];
  private tokens: DropToken[] = [];
  private hazards: HazardProj[] = [];
  private collected = 0;
  private goalTokens = 16;

  // Popeye state
  private px = 120;
  private py = DECK_Y[3];
  private pDeck = 3;
  private pFacing = 1;
  private punchTimer = 0;
  private spinachTimer = 0;
  private invuln = 0;
  private seesawFlightTimer = 0;
  private seesawFlightVy = 0;

  // Brutus state
  private bx = 420;
  private by = DECK_Y[1];
  private bDeck = 1;
  private bDir = -1;
  private bStunTimer = 0;
  private bRespawnTimer = 0;

  // Olive Oyl (top balcony)
  private oliveX = LOGICAL_W * 0.5;
  private oliveDir = 1;
  private dropTimer = 1.2;

  // Stage-specific signature mechanics
  private spinachCan = { x: 80, y: DECK_Y[2] - 18, active: true };
  // Stage 1: Hanging Punching Bag + Barrel trap
  private barrelState: 'hanging' | 'falling' | 'resetting' = 'hanging';
  private barrelX = 270;
  private barrelY = 126;
  private barrelVy = 0;
  // Stage 2: Wimpy's Seesaw & Swee'Pea rescue
  private sweepeaRescued = false;
  private seesawX = 468;
  // Stage 3: Moving horizontal deck elevator & Bernard the Vulture
  private elevatorX = 270;
  private elevatorDir = 1;

  private hazardTimer = 2.6;
  private time = 0;
  private readyTimer = 0;
  private clearTimer = 0;

  constructor() {
    this.highScore = readHighScore(this.storageKey);
    this.buildStage(1);
  }

  public startNewGame(): void {
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.particles = [];
    this.popups = [];
    this.buildStage(1);
    this.phase = 'READY';
    this.readyTimer = 1.1;
    arcadeAudio.playArcadeStart();
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.buildStage(1);
  }

  public restartStage(): void {
    if (this.phase === 'PLAYING' || this.phase === 'PAUSED') {
      this.buildStage(this.level);
      this.phase = 'READY';
      this.readyTimer = 0.85;
    }
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  private stageKind(): 1 | 2 | 3 {
    const m = ((this.level - 1) % 3) + 1;
    return m as 1 | 2 | 3;
  }

  private addScore(pts: number, x: number, y: number, text?: string, color = '#FDE047'): void {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(this.storageKey, this.highScore);
    }
    this.popups.push({
      x,
      y,
      text: text ?? `+${pts}`,
      color,
      life: 1.0,
      maxLife: 1.0,
    });
  }

  private buildStage(lvl: number): void {
    this.level = lvl;
    const sk = this.stageKind();
    this.tokens = [];
    this.hazards = [];
    this.collected = 0;
    this.goalTokens = sk === 1 ? 16 : sk === 2 ? 18 : 20;

    this.px = 110;
    this.pDeck = 3;
    this.py = DECK_Y[3];
    this.pFacing = 1;
    this.punchTimer = 0;
    this.spinachTimer = 0;
    this.invuln = 1.0;
    this.seesawFlightTimer = 0;

    this.bx = 420;
    this.bDeck = 1;
    this.by = DECK_Y[1];
    this.bDir = -1;
    this.bStunTimer = 0;
    this.bRespawnTimer = 0;

    this.spinachCan = {
      x: sk === 2 ? 96 : 454,
      y: DECK_Y[sk === 3 ? 2 : 1] - 16,
      active: true,
    };
    this.barrelState = 'hanging';
    this.barrelX = 270;
    this.barrelY = 126;
    this.barrelVy = 0;
    this.sweepeaRescued = false;
    this.elevatorX = 270;
    this.elevatorDir = 1;
    this.dropTimer = 0.8;
    this.hazardTimer = 2.4;

    if (sk === 1) {
      // Stage 1: The Docks
      this.stairs = [
        { x: 118, topDeck: 0, botDeck: 1 },
        { x: 422, topDeck: 0, botDeck: 1 },
        { x: 270, topDeck: 1, botDeck: 2 },
        { x: 145, topDeck: 2, botDeck: 3 },
        { x: 395, topDeck: 2, botDeck: 3 },
      ];
    } else if (sk === 2) {
      // Stage 2: Sweet Haven Village
      this.stairs = [
        { x: 150, topDeck: 0, botDeck: 1 },
        { x: 350, topDeck: 0, botDeck: 1 },
        { x: 96, topDeck: 1, botDeck: 2 },
        { x: 280, topDeck: 1, botDeck: 2 },
        { x: 175, topDeck: 2, botDeck: 3 },
        { x: 365, topDeck: 2, botDeck: 3 },
      ];
    } else {
      // Stage 3: Sea Hag's Pirate Ship
      this.stairs = [
        { x: 94, topDeck: 0, botDeck: 1 },
        { x: 446, topDeck: 0, botDeck: 1 },
        { x: 160, topDeck: 1, botDeck: 2 },
        { x: 380, topDeck: 1, botDeck: 2 },
        { x: 110, topDeck: 2, botDeck: 3 },
        { x: 430, topDeck: 2, botDeck: 3 },
      ];
    }
  }

  private spawnOliveToken(): void {
    const sk = this.stageKind();
    const helpLetters = ['H', 'E', 'L', 'P'];
    this.tokens.push({
      x: this.oliveX,
      y: 92,
      vx: (Math.random() - 0.5) * 24,
      vy: 42 + this.level * 5,
      swayPhase: Math.random() * Math.PI * 2,
      kind: sk === 1 ? 'heart' : sk === 2 ? 'note' : 'help',
      letter: sk === 3 ? helpLetters[(this.collected + this.tokens.length) % 4] : undefined,
      sinkTimer: 4.5,
      alive: true,
    });
  }

  private killPopeye(): void {
    if (this.invuln > 0) return;
    this.lives -= 1;
    arcadeAudio.playDeath();
    spawnBurst(this.particles, this.px, this.py - 18, '#60A5FA', 20, 180, 4);
    if (this.lives <= 0) {
      this.phase = 'GAME_OVER';
    } else {
      this.px = 110;
      this.pDeck = 3;
      this.py = DECK_Y[3];
      this.invuln = 2.2;
      this.spinachTimer = 0;
    }
  }

  public step(dt: number): void {
    this.time += dt;
    stepParticlesAndPopups(this.particles, this.popups, dt);
    if (this.phase === 'PAUSED') return;

    // Olive Oyl patrols top balcony
    this.oliveX += this.oliveDir * 72 * dt;
    if (this.oliveX < 100) {
      this.oliveX = 100;
      this.oliveDir = 1;
    } else if (this.oliveX > LOGICAL_W - 100) {
      this.oliveX = LOGICAL_W - 100;
      this.oliveDir = -1;
    }

    // Stage 3 moving deck elevator
    if (this.stageKind() === 3) {
      this.elevatorX += this.elevatorDir * 84 * dt;
      if (this.elevatorX < 165) {
        this.elevatorX = 165;
        this.elevatorDir = 1;
      } else if (this.elevatorX > LOGICAL_W - 165) {
        this.elevatorX = LOGICAL_W - 165;
        this.elevatorDir = -1;
      }
    }

    if (this.phase === 'TITLE') {
      this.dropTimer -= dt;
      if (this.dropTimer <= 0 && this.tokens.length < 4) {
        this.dropTimer = 1.4;
        this.spawnOliveToken();
      }
      for (const t of this.tokens) {
        t.y += t.vy * 0.6 * dt;
        t.x += Math.sin(this.time * 3 + t.swayPhase) * 28 * dt;
        if (t.y > DECK_Y[3] + 20) t.alive = false;
      }
      this.tokens = this.tokens.filter((t) => t.alive);
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
        this.buildStage(this.level + 1);
        this.phase = 'READY';
        this.readyTimer = 1.0;
      }
      return;
    }

    if (this.phase === 'GAME_OVER') return;

    const sk = this.stageKind();
    if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);
    if (this.punchTimer > 0) this.punchTimer = Math.max(0, this.punchTimer - dt);
    if (this.spinachTimer > 0) this.spinachTimer = Math.max(0, this.spinachTimer - dt);

    // Seesaw spring-launch flight (Stage 2)
    if (this.seesawFlightTimer > 0) {
      this.seesawFlightTimer -= dt;
      this.py += this.seesawFlightVy * dt;
      this.seesawFlightVy += 420 * dt;
      if (!this.sweepeaRescued && this.py < 130 && Math.abs(this.px - 440) < 60) {
        this.sweepeaRescued = true;
        this.addScore(1500, 440, 108, "SWEE'PEA +1500!", '#FDE047');
        spawnBurst(this.particles, 440, 108, '#FDE047', 24, 190, 4);
        arcadeAudio.playExtraLife();
      }
      if (this.py >= DECK_Y[0] && this.seesawFlightVy > 0) {
        this.py = DECK_Y[0];
        this.pDeck = 0;
        this.seesawFlightTimer = 0;
      }
    } else {
      // Standard deck running + climbing
      const spd = (this.spinachTimer > 0 ? 225 : 168) * (this.input.moveScale ?? 1);
      if (this.input.left) {
        this.px -= spd * dt;
        this.pFacing = -1;
      } else if (this.input.right) {
        this.px += spd * dt;
        this.pFacing = 1;
      }
      // Side wrap-around on middle decks
      if (this.px < 20) this.px = LOGICAL_W - 22;
      if (this.px > LOGICAL_W - 20) this.px = 22;

      // Climb stairs
      const nearStair = this.stairs.find(
        (s) => Math.abs(this.px - s.x) < 26 && (s.topDeck === this.pDeck || s.botDeck === this.pDeck)
      );
      if (this.input.up && nearStair && this.pDeck === nearStair.botDeck) {
        this.px += (nearStair.x - this.px) * Math.min(1, dt * 14);
        this.py -= 138 * dt;
        if (this.py <= DECK_Y[nearStair.topDeck]) {
          this.py = DECK_Y[nearStair.topDeck];
          this.pDeck = nearStair.topDeck;
        }
      } else if (this.input.down && nearStair && this.pDeck === nearStair.topDeck) {
        this.px += (nearStair.x - this.px) * Math.min(1, dt * 14);
        this.py += 148 * dt;
        if (this.py >= DECK_Y[nearStair.botDeck]) {
          this.py = DECK_Y[nearStair.botDeck];
          this.pDeck = nearStair.botDeck;
        }
      } else {
        // Snap gently to nearest deck when not mid-stair
        let best = 0;
        let bestD = 9999;
        for (let d = 0; d < DECK_Y.length; d++) {
          const dist = Math.abs(this.py - DECK_Y[d]);
          if (dist < bestD) {
            bestD = dist;
            best = d;
          }
        }
        this.pDeck = best;
        this.py += (DECK_Y[best] - this.py) * Math.min(1, dt * 14);
      }

      // Stage 2: Wimpy's Teeter-Totter Seesaw launch on bottom-right!
      if (sk === 2 && this.pDeck === 3 && Math.abs(this.px - this.seesawX) < 34) {
        this.seesawFlightTimer = 1.5;
        this.seesawFlightVy = -490;
        arcadeAudio.playSpring();
        this.popups.push({
          x: this.seesawX,
          y: DECK_Y[3] - 24,
          text: 'WIMPY LAUNCH!',
          color: '#38BDF8',
          life: 0.9,
          maxLife: 0.9,
        });
      }
    }

    // Popeye Punch!
    if (this.input.fireJustPressed || this.input.secondaryJustPressed) {
      this.punchTimer = 0.22;
      arcadeAudio.playThrow();
      const fistX = this.px + this.pFacing * 28;
      const fistY = this.py - 18;

      // Stage 1: Punch the hanging punching bag to drop barrel onto Brutus!
      if (
        sk === 1 &&
        this.barrelState === 'hanging' &&
        Math.hypot(fistX - this.barrelX, fistY - this.barrelY) < 42
      ) {
        this.barrelState = 'falling';
        this.barrelVy = 120;
        this.addScore(500, this.barrelX, this.barrelY, 'BARREL DROP!', '#FACC15');
        arcadeAudio.playHammerSmash();
      }
    }

    // Stage 1 Falling Barrel Trap
    if (sk === 1 && this.barrelState === 'falling') {
      this.barrelVy += 480 * dt;
      this.barrelY += this.barrelVy * dt;
      if (
        this.bRespawnTimer <= 0 &&
        Math.hypot(this.barrelX - this.bx, this.barrelY - (this.by - 20)) < 36
      ) {
        this.bStunTimer = 4.5;
        this.addScore(1000, this.bx, this.by - 36, 'BONKED BRUTUS +1000!', '#4ADE80');
        spawnBurst(this.particles, this.bx, this.by - 20, '#F59E0B', 20, 180, 4);
        arcadeAudio.playBellClang();
        this.barrelState = 'resetting';
      } else if (this.barrelY > LOGICAL_H - 40) {
        this.barrelState = 'resetting';
      }
    } else if (sk === 1 && this.barrelState === 'resetting') {
      this.barrelY -= 90 * dt;
      if (this.barrelY <= 126) {
        this.barrelY = 126;
        this.barrelState = 'hanging';
      }
    }

    // Spinach pickup
    if (
      this.spinachCan.active &&
      Math.hypot(this.px - this.spinachCan.x, this.py - 16 - this.spinachCan.y) < 30
    ) {
      this.spinachCan.active = false;
      this.spinachTimer = 7.5;
      this.addScore(500, this.px, this.py - 32, 'SPINACH POWER!', '#4ADE80');
      spawnBurst(this.particles, this.px, this.py - 18, '#4ADE80', 22, 180, 3.8);
      arcadeAudio.playPowerUp();
    }

    // Spawn & step Olive Oyl's falling Hearts / Notes / HELP
    this.dropTimer -= dt;
    if (this.dropTimer <= 0 && this.tokens.length < 5) {
      this.dropTimer = Math.max(0.95, 1.8 - this.level * 0.12);
      this.spawnOliveToken();
    }

    for (const t of this.tokens) {
      if (!t.alive) continue;
      if (t.y < DECK_Y[3] + 22) {
        t.y += t.vy * dt;
        t.x += Math.sin(this.time * 3.4 + t.swayPhase) * 34 * dt;
        t.x = Math.max(36, Math.min(LOGICAL_W - 36, t.x));
      } else {
        t.sinkTimer -= dt;
        if (t.sinkTimer <= 0) t.alive = false;
      }

      if (Math.hypot(t.x - this.px, t.y - (this.py - 18)) < 28) {
        t.alive = false;
        this.collected += 1;
        const pts = t.y < DECK_Y[1] ? 500 : t.y < DECK_Y[2] ? 300 : 100;
        this.addScore(pts, t.x, t.y, `+${pts}`, '#F472B6');
        spawnBurst(this.particles, t.x, t.y, '#F472B6', 10, 120, 3);
        arcadeAudio.playCoin();
      }
    }
    this.tokens = this.tokens.filter((t) => t.alive);

    if (this.collected >= this.goalTokens) {
      this.addScore(2000, LOGICAL_W * 0.5, LOGICAL_H * 0.45, 'STAGE CLEAR +2000!', '#4ADE80');
      arcadeAudio.playStageClear();
      this.phase = 'STAGE_CLEAR';
      this.clearTimer = 1.7;
      return;
    }

    // Sea Hag Bottles / Skulls / Bernard the Vulture
    this.hazardTimer -= dt;
    if (this.hazardTimer <= 0) {
      this.hazardTimer = Math.max(1.5, 3.0 - this.level * 0.22);
      const fromLeft = Math.random() < 0.5;
      const deckIdx = Math.floor(Math.random() * 3);
      this.hazards.push({
        x: fromLeft ? 18 : LOGICAL_W - 18,
        y: DECK_Y[deckIdx] - 20,
        vx: (fromLeft ? 1 : -1) * (135 + this.level * 16),
        vy: sk === 3 && Math.random() < 0.45 ? 32 : 0,
        kind: sk === 1 ? 'bottle' : sk === 3 && Math.random() < 0.5 ? 'vulture' : 'skull',
        alive: true,
      });
    }

    for (const h of this.hazards) {
      if (!h.alive) continue;
      h.x += h.vx * dt;
      h.y += Math.sin(this.time * 6) * h.vy * dt;
      if (h.x < -30 || h.x > LOGICAL_W + 30) h.alive = false;

      // Punching bottles/skulls/vulture destroys them!
      if (this.punchTimer > 0) {
        const fistX = this.px + this.pFacing * 30;
        if (Math.hypot(h.x - fistX, h.y - (this.py - 18)) < 32) {
          h.alive = false;
          const pts = h.kind === 'vulture' ? 1000 : 200;
          this.addScore(pts, h.x, h.y, `SMASH +${pts}!`, '#38BDF8');
          spawnBurst(this.particles, h.x, h.y, '#38BDF8', 12, 160, 3);
          arcadeAudio.playPop();
          continue;
        }
      }

      if (Math.hypot(h.x - this.px, h.y - (this.py - 18)) < 20) {
        if (this.spinachTimer > 0) {
          h.alive = false;
          this.addScore(300, h.x, h.y, '+300', '#4ADE80');
        } else {
          h.alive = false;
          this.killPopeye();
        }
      }
    }
    this.hazards = this.hazards.filter((h) => h.alive);

    // Brutus AI
    if (this.bRespawnTimer > 0) {
      this.bRespawnTimer -= dt;
      if (this.bRespawnTimer <= 0) {
        this.bDeck = 0;
        this.by = DECK_Y[0];
        this.bx = LOGICAL_W - 80;
      }
    } else if (this.bStunTimer > 0) {
      this.bStunTimer -= dt;
    } else {
      const flee = this.spinachTimer > 0;
      const targetDir = flee ? Math.sign(this.bx - this.px) || 1 : Math.sign(this.px - this.bx) || 1;
      this.bDir = targetDir;
      const bSpd = (flee ? 84 : 92 + this.level * 10);
      this.bx += this.bDir * bSpd * dt;
      if (this.bx < 30) this.bx = 30;
      if (this.bx > LOGICAL_W - 30) this.bx = LOGICAL_W - 30;

      // Climb toward Popeye's deck
      if (this.bDeck !== this.pDeck && !flee) {
        const stair = this.stairs.find(
          (s) =>
            Math.abs(this.bx - s.x) < 16 &&
            ((this.pDeck < this.bDeck && s.botDeck === this.bDeck) ||
              (this.pDeck > this.bDeck && s.topDeck === this.bDeck))
        );
        if (stair) {
          this.bDeck = this.pDeck < this.bDeck ? stair.topDeck : stair.botDeck;
          this.by = DECK_Y[this.bDeck];
        }
      }

      // Contact with Popeye
      if (Math.hypot(this.bx - this.px, this.by - this.py) < 28) {
        if (this.spinachTimer > 0) {
          this.bRespawnTimer = 4.0;
          this.addScore(3000, this.bx, this.by - 28, 'BRUTUS KO +3000!', '#FACC15');
          spawnBurst(this.particles, this.bx, this.by - 20, '#FACC15', 30, 240, 4.5);
          arcadeAudio.playExplosion(true);
        } else {
          this.killPopeye();
        }
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    const sk = this.stageKind();
    ctx.save();
    ctx.scale(dpr, dpr);

    // Stage-specific atmosphere sky
    const bg = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
    if (sk === 1) {
      bg.addColorStop(0, '#0C1E3E');
      bg.addColorStop(1, '#1E3A8A');
    } else if (sk === 2) {
      bg.addColorStop(0, '#1E1B4B');
      bg.addColorStop(1, '#312E81');
    } else {
      bg.addColorStop(0, '#090E1C');
      bg.addColorStop(1, '#1E293B');
    }
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // Water waves at bottom
    ctx.fillStyle = '#0369A1';
    ctx.fillRect(0, DECK_Y[3] + 24, LOGICAL_W, LOGICAL_H - (DECK_Y[3] + 24));

    // Top HUD
    ctx.font = '800 13px "JetBrains Mono", monospace';
    ctx.fillStyle = '#60A5FA';
    ctx.textAlign = 'left';
    const stageNames = ['THE DOCKS', 'SWEET HAVEN VILLAGE', 'PIRATE SHIP'];
    ctx.fillText(`POPEYE · ${stageNames[sk - 1]}`, 16, 24);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#FDE047';
    ctx.fillText(`SCORE ${this.score.toLocaleString()}`, LOGICAL_W - 16, 24);

    // Olive Oyl's balcony
    ctx.fillStyle = sk === 2 ? '#B45309' : '#78350F';
    ctx.fillRect(72, 86, LOGICAL_W - 144, 10);
    // Olive Oyl sprite
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(this.oliveX - 7, 62, 14, 24);
    ctx.fillStyle = '#FDE68A';
    ctx.beginPath();
    ctx.arc(this.oliveX, 55, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(this.oliveX - 5, 53, 4, 0, Math.PI * 2);
    ctx.fill();

    // Swee'Pea icon on Stage 2 upper-right
    if (sk === 2 && !this.sweepeaRescued) {
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(440, 108, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.font = '800 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText("SWEE'PEA", 440, 92);
    }

    // Decks
    const deckColor = sk === 1 ? '#B45309' : sk === 2 ? '#D97706' : '#64748B';
    for (let i = 0; i < DECK_Y.length; i++) {
      const dy = DECK_Y[i];
      ctx.fillStyle = deckColor;
      ctx.fillRect(20, dy, LOGICAL_W - 40, 12);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(20, dy, LOGICAL_W - 40, 3);
    }

    // Stage 3 moving deck elevator highlight
    if (sk === 3) {
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(this.elevatorX - 38, DECK_Y[1] - 4, 76, 8);
    }

    // Stairs / Ladders
    ctx.strokeStyle = '#FDE047';
    ctx.lineWidth = 3;
    for (const s of this.stairs) {
      const y1 = DECK_Y[s.topDeck];
      const y2 = DECK_Y[s.botDeck];
      ctx.beginPath();
      ctx.moveTo(s.x - 10, y1);
      ctx.lineTo(s.x - 10, y2);
      ctx.moveTo(s.x + 10, y1);
      ctx.lineTo(s.x + 10, y2);
      for (let ry = y1 + 12; ry < y2; ry += 16) {
        ctx.moveTo(s.x - 10, ry);
        ctx.lineTo(s.x + 10, ry);
      }
      ctx.stroke();
    }

    // Stage 1 Hanging Punching Bag & Barrel Trap
    if (sk === 1) {
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.barrelX, 96);
      ctx.lineTo(this.barrelX, this.barrelY - 12);
      ctx.stroke();
      ctx.fillStyle = '#92400E';
      ctx.beginPath();
      ctx.roundRect(this.barrelX - 16, this.barrelY - 14, 32, 26, 6);
      ctx.fill();
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Stage 2 Wimpy's Seesaw
    if (sk === 2) {
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(this.seesawX - 30, DECK_Y[3] - 6, 60, 6);
      ctx.fillStyle = '#CBD5E1';
      ctx.beginPath();
      ctx.moveTo(this.seesawX, DECK_Y[3] - 6);
      ctx.lineTo(this.seesawX - 10, DECK_Y[3]);
      ctx.lineTo(this.seesawX + 10, DECK_Y[3]);
      ctx.fill();
    }

    // Spinach Can
    if (this.spinachCan.active) {
      ctx.fillStyle = '#16A34A';
      ctx.beginPath();
      ctx.roundRect(this.spinachCan.x - 11, this.spinachCan.y - 13, 22, 26, 4);
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      ctx.font = '900 8px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SPN', this.spinachCan.x, this.spinachCan.y + 3);
    }

    // Falling Hearts / Notes / HELP letters
    for (const t of this.tokens) {
      if (t.kind === 'heart') {
        ctx.fillStyle = '#F43F5E';
        ctx.beginPath();
        ctx.arc(t.x - 5, t.y - 3, 6, 0, Math.PI * 2);
        ctx.arc(t.x + 5, t.y - 3, 6, 0, Math.PI * 2);
        ctx.moveTo(t.x - 10, t.y);
        ctx.lineTo(t.x, t.y + 11);
        ctx.lineTo(t.x + 10, t.y);
        ctx.fill();
      } else if (t.kind === 'note') {
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.arc(t.x - 3, t.y + 4, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(t.x + 2, t.y - 11, 3, 15);
        ctx.fillRect(t.x + 2, t.y - 11, 9, 4);
      } else {
        ctx.fillStyle = '#FACC15';
        ctx.font = '900 18px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(t.letter ?? 'H', t.x, t.y + 6);
      }
    }

    // Hazards (Bottles, Skulls, Bernard the Vulture)
    for (const h of this.hazards) {
      if (h.kind === 'bottle') {
        ctx.fillStyle = '#4ADE80';
        ctx.fillRect(h.x - 6, h.y - 10, 12, 20);
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(h.x - 3, h.y - 15, 6, 6);
      } else if (h.kind === 'skull') {
        ctx.fillStyle = '#F8FAFC';
        ctx.beginPath();
        ctx.arc(h.x, h.y - 2, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(h.x - 5, h.y - 4, 3, 3);
        ctx.fillRect(h.x + 2, h.y - 4, 3, 3);
      } else {
        ctx.fillStyle = '#A855F7';
        ctx.beginPath();
        ctx.ellipse(h.x, h.y, 16, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(h.x + Math.sign(h.vx) * 14, h.y - 2, 7, 4);
      }
    }

    // Brutus
    if (this.bRespawnTimer <= 0) {
      ctx.save();
      ctx.translate(this.bx, this.by);
      const scared = this.spinachTimer > 0;
      ctx.fillStyle = scared ? '#38BDF8' : '#1E293B';
      ctx.fillRect(-14, -36, 28, 36);
      ctx.fillStyle = '#FDBA74';
      ctx.beginPath();
      ctx.arc(0, -42, 11, 0, Math.PI * 2);
      ctx.fill();
      // Thick black beard
      ctx.fillStyle = '#090D16';
      ctx.beginPath();
      ctx.arc(0, -37, 9, 0, Math.PI);
      ctx.fill();
      if (this.bStunTimer > 0) {
        ctx.fillStyle = '#FACC15';
        ctx.font = '900 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('★ STUN ★', 0, -58);
      }
      ctx.restore();
    }

    // Popeye
    if (this.invuln <= 0 || Math.floor(this.time * 14) % 2 === 0) {
      ctx.save();
      ctx.translate(this.px, this.py);
      const glow = this.spinachTimer > 0;
      if (glow) {
        ctx.strokeStyle = '#4ADE80';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, -20, 24, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Sailor trousers & shirt
      ctx.fillStyle = '#2563EB';
      ctx.fillRect(-10, -16, 20, 16);
      ctx.fillStyle = glow ? '#4ADE80' : '#0F172A';
      ctx.fillRect(-11, -32, 22, 16);
      // Red sailor collar
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(-10, -32, 20, 5);
      // Head & white sailor cap
      ctx.fillStyle = '#FDBA74';
      ctx.beginPath();
      ctx.arc(0, -39, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(-9, -49, 18, 6);
      // Big Popeye Punch Forearm!
      if (this.punchTimer > 0) {
        ctx.fillStyle = '#FDBA74';
        ctx.beginPath();
        ctx.roundRect(this.pFacing > 0 ? 8 : -34, -28, 26, 11, 5);
        ctx.fill();
      }
      ctx.restore();
    }

    renderParticlesAndPopups(ctx, this.particles, this.popups);
    if (visualMode === 'crt') renderCrtOverlay(ctx, LOGICAL_W, LOGICAL_H);
    ctx.restore();
  }

  public getHudSnapshot(): ClassicGameHud {
    const sk = this.stageKind();
    const names = ['THE DOCKS', 'SWEET HAVEN', 'PIRATE SHIP'];
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: Math.max(0, this.lives),
      stageName: `POPEYE · ${names[sk - 1]}`,
      primaryMetricLabel: sk === 1 ? 'HEARTS' : sk === 2 ? 'NOTES' : 'H-E-L-P',
      primaryMetricValue: `${this.collected}/${this.goalTokens}`,
      secondaryMetricLabel: 'SPINACH',
      secondaryMetricValue: this.spinachTimer > 0 ? `${this.spinachTimer.toFixed(1)}s` : this.spinachCan.active ? 'READY' : 'USED',
      bannerText:
        this.phase === 'TITLE'
          ? 'POPEYE — CATCH OLIVE’S TOKENS & KO BRUTUS'
          : this.phase === 'GAME_OVER'
          ? 'GAME OVER'
          : '',
      canRestartStage: true,
    };
  }
}

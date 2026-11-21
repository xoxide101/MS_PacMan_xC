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

export type FroggerVariant = 'frogger' | 'frogger2';

const LOGICAL_W = 520;
const LOGICAL_H = 620;
const COLS = 13;
const ROWS = 13; // 0 = top homes, 1..5 = river/upper, 6 = median, 7..11 = road/lower, 12 = start bank
const CELL_W = LOGICAL_W / COLS; // 40
const TOP_MARGIN = 52;
const CELL_H = (LOGICAL_H - TOP_MARGIN - 24) / ROWS; // ~41.8

type Frogger2Zone = 0 | 1 | 2; // 0: Underwater Reef, 1: Surface Lagoon, 2: Sky Kingdom

type LaneActorKind =
  | 'car_yellow'
  | 'dozer'
  | 'sedan_pink'
  | 'racer_white'
  | 'semi'
  | 'log'
  | 'turtle_pod'
  | 'gator'
  // Frogger II actors
  | 'whale'
  | 'shark'
  | 'sub'
  | 'eel'
  | 'jelly'
  | 'bubble_raft'
  | 'hippo'
  | 'speedboat'
  | 'raft'
  | 'cloud'
  | 'biplane'
  | 'bird'
  | 'balloon'
  | 'eagle';

interface LaneActor {
  x: number;
  w: number;
  kind: LaneActorKind;
  diveTimer: number;
  divePeriod: number;
  submerged: boolean;
  warning: boolean;
  gatorMouthOpen: boolean;
  hasLadyFrog?: boolean;
  hasLogSnake?: boolean;
  snakeOffset?: number;
  snakeDir?: number;
}

interface LaneDef {
  row: number;
  speed: number; // px/s (signed)
  isRideable: boolean; // true = safe when ON actor (water/air), false = lethal when touching actor (road/underwater)
  actors: LaneActor[];
}

interface HomeBerth {
  col: number;
  filled: boolean;
  hasFly: boolean;
  hasGator: boolean;
}

export class FroggerArcadeGame implements ArcadeGameInstance {
  public readonly logicalWidth = LOGICAL_W;
  public readonly logicalHeight = LOGICAL_H;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'Hop';
  public readonly secondaryActionLabel = undefined;

  private readonly variant: FroggerVariant;
  private readonly storageKey: string;

  private phase: ClassicGamePhase = 'TITLE';
  private score = 0;
  private highScore = 0;
  private level = 1;
  private lives = 5;
  private input: ArcadeInputState = createEmptyInput();
  private prevDir = { up: false, down: false, left: false, right: false };

  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];
  private time = 0;
  private readyTimer = 0;
  private clearTimer = 0;

  // Frogger II 3-zone progression
  private zone: Frogger2Zone = 0;

  // Player Frog state
  private frogX = LOGICAL_W * 0.5;
  private frogRow = 12;
  private frogFacing: 'up' | 'down' | 'left' | 'right' = 'up';
  private hopTimer = 0;
  private hopStartX = LOGICAL_W * 0.5;
  private hopStartY = 0;
  private hopTargetX = LOGICAL_W * 0.5;
  private hopTargetY = 0;
  private maxRowReached = 12;
  private carryingLady = false;
  private deathTimer = 0;
  private laneTime = 45;
  private maxLaneTime = 45;

  // Lanes & Homes
  private lanes: LaneDef[] = [];
  private homes: HomeBerth[] = [];
  private homeEventTimer = 4.2;

  // Median Snake (Stage 2+ Frogger)
  private medianSnakeActive = false;
  private medianSnakeX = 60;
  private medianSnakeDir = 1;

  // Attract Demo timer
  private attractHopTimer = 0.6;

  constructor(variant: FroggerVariant) {
    this.variant = variant;
    this.storageKey =
      variant === 'frogger2' ? 'frogger2_hd_highscore_v1' : 'frogger_hd_highscore_v1';
    this.highScore = readHighScore(this.storageKey);
    this.buildBoard(1, 0);
  }

  public startNewGame(): void {
    this.score = 0;
    this.level = 1;
    this.lives = 5;
    this.zone = 0;
    this.particles = [];
    this.popups = [];
    this.buildBoard(1, 0);
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
    this.level = 1;
    this.zone = 0;
    this.buildBoard(1, 0);
  }

  public restartStage(): void {
    if (this.phase === 'PLAYING' || this.phase === 'PAUSED') {
      this.buildBoard(this.level, this.zone);
      this.phase = 'READY';
      this.readyTimer = 0.85;
    }
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  private rowCenterY(row: number): number {
    return TOP_MARGIN + row * CELL_H + CELL_H * 0.5;
  }

  private resetFrogToStart(): void {
    this.frogRow = 12;
    this.frogX = LOGICAL_W * 0.5;
    this.frogFacing = 'up';
    this.hopTimer = 0;
    this.maxRowReached = 12;
    this.carryingLady = false;
    this.deathTimer = 0;
    this.maxLaneTime = Math.max(28, 46 - (this.level - 1) * 2);
    this.laneTime = this.maxLaneTime;
  }

  private makeActors(
    count: number,
    w: number,
    kind: LaneActorKind,
    spacing: number,
    canDive = false
  ): LaneActor[] {
    const out: LaneActor[] = [];
    for (let i = 0; i < count; i++) {
      out.push({
        x: i * spacing + (i % 2) * 14,
        w,
        kind,
        diveTimer: i * 1.9,
        divePeriod: canDive ? 5.6 + (i % 2) * 1.4 : 0,
        submerged: false,
        warning: false,
        gatorMouthOpen: false,
      });
    }
    return out;
  }

  private buildBoard(lvl: number, zone: Frogger2Zone): void {
    this.level = lvl;
    this.zone = zone;
    this.lanes = [];
    const spdScale = 1 + (lvl - 1) * 0.14;

    if (this.variant === 'frogger') {
      // 5 authentic lily-pad homes
      this.homes = [1, 3.5, 6, 8.5, 11].map((col) => ({
        col,
        filled: false,
        hasFly: false,
        hasGator: false,
      }));
      this.homes[2].hasFly = true;

      // River lanes (rows 1..5, rideable!)
      const r1Actors = this.makeActors(3, 128, 'log', 210);
      if (lvl >= 2) r1Actors[1].kind = 'gator';
      this.lanes.push({ row: 1, speed: 62 * spdScale, isRideable: true, actors: r1Actors });

      const r2Actors = this.makeActors(4, 78, 'turtle_pod', 155, true);
      this.lanes.push({ row: 2, speed: -74 * spdScale, isRideable: true, actors: r2Actors });

      const r3Actors = this.makeActors(2, 168, 'log', 290);
      r3Actors[0].hasLadyFrog = true;
      if (lvl >= 2) {
        r3Actors[1].hasLogSnake = true;
        r3Actors[1].snakeOffset = 40;
        r3Actors[1].snakeDir = 1;
      }
      this.lanes.push({ row: 3, speed: 94 * spdScale, isRideable: true, actors: r3Actors });

      const r4Actors = this.makeActors(3, 98, 'log', 195);
      this.lanes.push({ row: 4, speed: 54 * spdScale, isRideable: true, actors: r4Actors });

      const r5Actors = this.makeActors(4, 108, 'turtle_pod', 165, true);
      this.lanes.push({ row: 5, speed: -64 * spdScale, isRideable: true, actors: r5Actors });

      // Highway lanes (rows 7..11, hazards!)
      this.lanes.push({
        row: 7,
        speed: -76 * spdScale,
        isRideable: false,
        actors: this.makeActors(2, 104, 'semi', 270),
      });
      this.lanes.push({
        row: 8,
        speed: 138 * spdScale,
        isRideable: false,
        actors: this.makeActors(2, 54, 'racer_white', 280),
      });
      this.lanes.push({
        row: 9,
        speed: -68 * spdScale,
        isRideable: false,
        actors: this.makeActors(3, 56, 'sedan_pink', 190),
      });
      this.lanes.push({
        row: 10,
        speed: 58 * spdScale,
        isRideable: false,
        actors: this.makeActors(3, 58, 'dozer', 195),
      });
      this.lanes.push({
        row: 11,
        speed: -72 * spdScale,
        isRideable: false,
        actors: this.makeActors(3, 52, 'car_yellow', 188),
      });

      this.medianSnakeActive = lvl >= 2;
      this.medianSnakeX = 70;
      this.medianSnakeDir = 1;
    } else {
      // Frogger II: ThreeeDeep! — 3 Distinct Vertical Ecosystems
      if (zone === 0) {
        // Zone 1: Underwater Reef (dodge predators + ride bubble rafts to break surface!)
        this.homes = [2, 6, 10].map((col) => ({
          col,
          filled: false,
          hasFly: false,
          hasGator: false,
        }));
        // Upper ascent current (bubble rafts rideable rows 1..3)
        this.lanes.push({
          row: 1,
          speed: 74 * spdScale,
          isRideable: true,
          actors: this.makeActors(3, 118, 'bubble_raft', 200),
        });
        this.lanes.push({
          row: 2,
          speed: -82 * spdScale,
          isRideable: true,
          actors: this.makeActors(3, 104, 'whale', 210),
        });
        this.lanes.push({
          row: 3,
          speed: 66 * spdScale,
          isRideable: true,
          actors: this.makeActors(4, 92, 'bubble_raft', 160, true),
        });
        // Deep reef hazards (rows 4..5 & 7..11)
        this.lanes.push({
          row: 4,
          speed: -96 * spdScale,
          isRideable: false,
          actors: this.makeActors(3, 66, 'shark', 195),
        });
        this.lanes.push({
          row: 5,
          speed: 70 * spdScale,
          isRideable: false,
          actors: this.makeActors(2, 92, 'sub', 270),
        });
        this.lanes.push({
          row: 7,
          speed: -86 * spdScale,
          isRideable: false,
          actors: this.makeActors(3, 68, 'eel', 190),
        });
        this.lanes.push({
          row: 8,
          speed: 62 * spdScale,
          isRideable: false,
          actors: this.makeActors(4, 44, 'jelly', 155),
        });
        this.lanes.push({
          row: 9,
          speed: -102 * spdScale,
          isRideable: false,
          actors: this.makeActors(3, 68, 'shark', 200),
        });
        this.lanes.push({
          row: 10,
          speed: 74 * spdScale,
          isRideable: false,
          actors: this.makeActors(2, 96, 'sub', 275),
        });
        this.lanes.push({
          row: 11,
          speed: -64 * spdScale,
          isRideable: false,
          actors: this.makeActors(3, 64, 'eel', 195),
        });
        this.medianSnakeActive = false;
      } else if (zone === 1) {
        // Zone 2: Surface Lagoon (diving hippos, speedboats, crocodiles, rafts)
        this.homes = [2, 6, 10].map((col) => ({
          col,
          filled: false,
          hasFly: false,
          hasGator: false,
        }));
        this.homes[1].hasFly = true;
        this.lanes.push({
          row: 1,
          speed: 76 * spdScale,
          isRideable: true,
          actors: this.makeActors(3, 112, 'raft', 205),
        });
        this.lanes.push({
          row: 2,
          speed: -72 * spdScale,
          isRideable: true,
          actors: this.makeActors(4, 86, 'hippo', 165, true),
        });
        this.lanes.push({
          row: 3,
          speed: 98 * spdScale,
          isRideable: true,
          actors: this.makeActors(3, 120, 'gator', 210),
        });
        this.lanes.push({
          row: 4,
          speed: -84 * spdScale,
          isRideable: true,
          actors: this.makeActors(3, 108, 'raft', 200),
        });
        this.lanes.push({
          row: 5,
          speed: 68 * spdScale,
          isRideable: true,
          actors: this.makeActors(4, 84, 'hippo', 165, true),
        });
        // Lower speedboat bay (rows 7..11 hazards!)
        this.lanes.push({
          row: 7,
          speed: -124 * spdScale,
          isRideable: false,
          actors: this.makeActors(2, 74, 'speedboat', 270),
        });
        this.lanes.push({
          row: 8,
          speed: 88 * spdScale,
          isRideable: false,
          actors: this.makeActors(3, 62, 'speedboat', 195),
        });
        this.lanes.push({
          row: 9,
          speed: -76 * spdScale,
          isRideable: false,
          actors: this.makeActors(3, 74, 'gator', 200),
        });
        this.lanes.push({
          row: 10,
          speed: 112 * spdScale,
          isRideable: false,
          actors: this.makeActors(2, 72, 'speedboat', 260),
        });
        this.lanes.push({
          row: 11,
          speed: -68 * spdScale,
          isRideable: false,
          actors: this.makeActors(3, 64, 'speedboat', 195),
        });
        this.medianSnakeActive = lvl >= 2;
      } else {
        // Zone 3: Sky Kingdom (clouds, biplanes, birds, hot-air balloons, storm eagles -> 3 Rainbow Nests!)
        this.homes = [2, 6, 10].map((col) => ({
          col,
          filled: false,
          hasFly: false,
          hasGator: false,
        }));
        this.homes[0].hasFly = true;
        this.homes[2].hasFly = true;
        // Upper sky rideable platforms (rows 1..5)
        this.lanes.push({
          row: 1,
          speed: 82 * spdScale,
          isRideable: true,
          actors: this.makeActors(3, 114, 'cloud', 205),
        });
        this.lanes.push({
          row: 2,
          speed: -94 * spdScale,
          isRideable: true,
          actors: this.makeActors(3, 96, 'balloon', 205),
        });
        this.lanes.push({
          row: 3,
          speed: 108 * spdScale,
          isRideable: true,
          actors: this.makeActors(3, 108, 'biplane', 215),
        });
        this.lanes.push({
          row: 4,
          speed: -72 * spdScale,
          isRideable: true,
          actors: this.makeActors(4, 94, 'cloud', 162, true),
        });
        this.lanes.push({
          row: 5,
          speed: 86 * spdScale,
          isRideable: true,
          actors: this.makeActors(3, 104, 'balloon', 200),
        });
        // Lower sky dodge corridor (rows 7..11 hazards!)
        this.lanes.push({
          row: 7,
          speed: -116 * spdScale,
          isRideable: false,
          actors: this.makeActors(3, 56, 'eagle', 195),
        });
        this.lanes.push({
          row: 8,
          speed: 96 * spdScale,
          isRideable: false,
          actors: this.makeActors(3, 52, 'bird', 190),
        });
        this.lanes.push({
          row: 9,
          speed: -128 * spdScale,
          isRideable: false,
          actors: this.makeActors(2, 74, 'biplane', 270),
        });
        this.lanes.push({
          row: 10,
          speed: 84 * spdScale,
          isRideable: false,
          actors: this.makeActors(3, 54, 'eagle', 195),
        });
        this.lanes.push({
          row: 11,
          speed: -76 * spdScale,
          isRideable: false,
          actors: this.makeActors(3, 48, 'bird', 188),
        });
        this.medianSnakeActive = false;
      }
    }

    this.resetFrogToStart();
  }

  private addScore(pts: number, x: number, y: number, label?: string, color = '#FDE047'): void {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(this.storageKey, this.highScore);
    }
    this.popups.push({
      x,
      y,
      text: label ?? `+${pts}`,
      color,
      life: 0.9,
      maxLife: 0.9,
    });
  }

  private killFrog(reason: string): void {
    if (this.deathTimer > 0) return;
    this.deathTimer = 1.05;
    this.lives -= 1;
    arcadeAudio.playDeath();
    spawnBurst(this.particles, this.frogX, this.rowCenterY(this.frogRow), '#4ADE80', 18, 170, 4);
    this.popups.push({
      x: this.frogX,
      y: this.rowCenterY(this.frogRow) - 16,
      text: reason,
      color: '#F87171',
      life: 0.9,
      maxLife: 0.9,
    });
  }

  private stepLanes(dt: number): void {
    const wrapW = LOGICAL_W + 240;
    for (const lane of this.lanes) {
      for (const a of lane.actors) {
        a.x += lane.speed * dt;
        if (lane.speed > 0 && a.x > LOGICAL_W + 120) a.x -= wrapW;
        if (lane.speed < 0 && a.x + a.w < -120) a.x += wrapW;

        if (a.divePeriod > 0) {
          a.diveTimer = (a.diveTimer + dt) % a.divePeriod;
          const rem = a.divePeriod - a.diveTimer;
          a.submerged = rem < 1.15;
          a.warning = !a.submerged && rem < 2.2;
        }
        if (a.kind === 'gator') {
          a.gatorMouthOpen = Math.sin(this.time * 3.1 + a.x * 0.02) > 0.35;
        }
        if (a.hasLogSnake && a.snakeOffset !== undefined && a.snakeDir !== undefined) {
          a.snakeOffset += a.snakeDir * 36 * dt;
          if (a.snakeOffset < 16) {
            a.snakeOffset = 16;
            a.snakeDir = 1;
          } else if (a.snakeOffset > a.w - 16) {
            a.snakeOffset = a.w - 16;
            a.snakeDir = -1;
          }
        }
      }
    }

    if (this.medianSnakeActive) {
      this.medianSnakeX += this.medianSnakeDir * (64 + this.level * 8) * dt;
      if (this.medianSnakeX < 28) {
        this.medianSnakeX = 28;
        this.medianSnakeDir = 1;
      } else if (this.medianSnakeX > LOGICAL_W - 28) {
        this.medianSnakeX = LOGICAL_W - 28;
        this.medianSnakeDir = -1;
      }
    }

    // Cycle bonus flies & alcove gators in empty home berths
    this.homeEventTimer -= dt;
    if (this.homeEventTimer <= 0) {
      this.homeEventTimer = 3.8 + Math.random() * 2.2;
      for (const h of this.homes) {
        h.hasFly = false;
        h.hasGator = false;
      }
      const open = this.homes.filter((h) => !h.filled);
      if (open.length > 0) {
        const pick = open[Math.floor(Math.random() * open.length)];
        if (this.variant === 'frogger' && Math.random() < 0.36 && this.level >= 2) {
          pick.hasGator = true;
        } else {
          pick.hasFly = true;
        }
      }
    }
  }

  private tryHop(dr: number, dc: number, face: 'up' | 'down' | 'left' | 'right'): void {
    if (this.hopTimer > 0 || this.deathTimer > 0) return;
    const nextRow = this.frogRow + dr;
    const nextX = this.frogX + dc * CELL_W;
    if (nextRow < 0 || nextRow > 12) return;
    if (nextX < 18 || nextX > LOGICAL_W - 18) return;

    this.frogFacing = face;
    this.hopStartX = this.frogX;
    this.hopStartY = this.rowCenterY(this.frogRow);
    this.frogRow = nextRow;
    this.frogX = nextX;
    this.hopTargetX = nextX;
    this.hopTargetY = this.rowCenterY(nextRow);
    this.hopTimer = 0.11;
    arcadeAudio.playJump();

    if (this.phase === 'PLAYING' && nextRow < this.maxRowReached) {
      this.maxRowReached = nextRow;
      this.score += 10;
      if (this.score > this.highScore) {
        this.highScore = this.score;
        saveHighScore(this.storageKey, this.highScore);
      }
    }
  }

  private handleReachTopRow(): void {
    let matched: HomeBerth | null = null;
    for (const h of this.homes) {
      const hx = h.col * CELL_W + CELL_W * 0.5;
      if (Math.abs(this.frogX - hx) <= 28) {
        matched = h;
        break;
      }
    }

    if (!matched || matched.filled || matched.hasGator) {
      this.killFrog(matched?.hasGator ? 'CHOMP!' : 'SPLASH!');
      return;
    }

    // Scored a home berth (or reached next zone in Frogger II!)
    matched.filled = true;
    const timeBonus = Math.floor(this.laneTime) * 10;
    let pts = 50 + timeBonus;
    let label = `HOME +${pts}`;
    if (matched.hasFly) {
      pts += 200;
      label = `FLY +${pts}!`;
      matched.hasFly = false;
    }
    if (this.carryingLady) {
      pts += 200;
      label = `LADY FROG +${pts}!`;
      this.carryingLady = false;
    }
    this.addScore(pts, matched.col * CELL_W + CELL_W * 0.5, this.rowCenterY(0), label, '#4ADE80');
    spawnBurst(
      this.particles,
      matched.col * CELL_W + CELL_W * 0.5,
      this.rowCenterY(0),
      '#FDE047',
      22,
      190,
      3.8
    );
    arcadeAudio.playCoin();

    const allFilled = this.homes.every((h) => h.filled);

    if (this.variant === 'frogger2' && this.zone < 2) {
      // Frogger II: reaching a top portal immediately ascends to next vertical ecosystem!
      const nextZone = (this.zone + 1) as Frogger2Zone;
      const zName = nextZone === 1 ? 'SURFACE LAGOON!' : 'SKY KINGDOM!';
      this.addScore(500, LOGICAL_W * 0.5, LOGICAL_H * 0.45, zName, '#38BDF8');
      arcadeAudio.playStageClear();
      this.buildBoard(this.level, nextZone);
      this.phase = 'READY';
      this.readyTimer = 1.05;
      return;
    }

    if (allFilled) {
      this.addScore(1000, LOGICAL_W * 0.5, LOGICAL_H * 0.4, 'STAGE CLEAR +1000!', '#FACC15');
      arcadeAudio.playStageClear();
      this.phase = 'STAGE_CLEAR';
      this.clearTimer = 1.8;
    } else {
      this.resetFrogToStart();
    }
  }

  public step(dt: number): void {
    this.time += dt;
    stepParticlesAndPopups(this.particles, this.popups, dt);

    if (this.phase === 'PAUSED') return;

    // Live animated traffic/river/ecosystems even on TITLE & READY
    this.stepLanes(dt);

    if (this.phase === 'TITLE') {
      this.attractHopTimer -= dt;
      if (this.attractHopTimer <= 0) {
        this.attractHopTimer = 0.55;
        if (this.frogRow > 2) this.tryHop(-1, 0, 'up');
        else this.resetFrogToStart();
      }
      if (this.hopTimer > 0) this.hopTimer = Math.max(0, this.hopTimer - dt);
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
        this.buildBoard(this.level + 1, 0);
        this.phase = 'READY';
        this.readyTimer = 1.0;
      }
      return;
    }

    if (this.phase === 'GAME_OVER') return;

    // Death recovery
    if (this.deathTimer > 0) {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) {
        if (this.lives <= 0) {
          this.phase = 'GAME_OVER';
        } else {
          this.resetFrogToStart();
        }
      }
      return;
    }

    // Lane timer
    this.laneTime -= dt;
    if (this.laneTime <= 0) {
      this.killFrog('TIME UP!');
      return;
    }

    // Input edge detection for crisp classic grid hopping
    const upJust = (this.input.up && !this.prevDir.up) || this.input.fireJustPressed;
    const downJust = this.input.down && !this.prevDir.down;
    const leftJust = this.input.left && !this.prevDir.left;
    const rightJust = this.input.right && !this.prevDir.right;
    this.prevDir = {
      up: this.input.up,
      down: this.input.down,
      left: this.input.left,
      right: this.input.right,
    };

    if (upJust) this.tryHop(-1, 0, 'up');
    else if (downJust) this.tryHop(1, 0, 'down');
    else if (leftJust) this.tryHop(0, -1, 'left');
    else if (rightJust) this.tryHop(0, 1, 'right');

    if (this.hopTimer > 0) {
      this.hopTimer = Math.max(0, this.hopTimer - dt);
      return;
    }

    // Reached top home row
    if (this.frogRow === 0) {
      this.handleReachTopRow();
      return;
    }

    // Median snake check (row 6)
    if (this.frogRow === 6 && this.medianSnakeActive) {
      if (Math.abs(this.frogX - this.medianSnakeX) < 22) {
        this.killFrog('SNAKE BITE!');
        return;
      }
    }

    // Evaluate active lane collisions / riding
    const lane = this.lanes.find((l) => l.row === this.frogRow);
    if (!lane) return;

    if (lane.isRideable) {
      let riding: LaneActor | null = null;
      for (const a of lane.actors) {
        if (a.submerged) continue;
        if (this.frogX >= a.x + 6 && this.frogX <= a.x + a.w - 6) {
          // Gator mouth check!
          if (a.kind === 'gator' && a.gatorMouthOpen) {
            const headStart = lane.speed > 0 ? a.x + a.w - 28 : a.x;
            const headEnd = lane.speed > 0 ? a.x + a.w : a.x + 28;
            if (this.frogX >= headStart && this.frogX <= headEnd) {
              this.killFrog('GATOR SNAP!');
              return;
            }
          }
          // Log snake check
          if (a.hasLogSnake && a.snakeOffset !== undefined) {
            if (Math.abs(this.frogX - (a.x + a.snakeOffset)) < 16) {
              this.killFrog('LOG SNAKE!');
              return;
            }
          }
          riding = a;
          break;
        }
      }

      if (!riding) {
        const msg =
          this.variant === 'frogger2' && this.zone === 2
            ? 'FELL!'
            : this.variant === 'frogger2' && this.zone === 0
            ? 'SWEPT!'
            : 'SPLASH!';
        this.killFrog(msg);
        return;
      }

      // Carry frog along with the log/turtle/cloud/whale!
      this.frogX += lane.speed * dt;
      if (riding.hasLadyFrog && !this.carryingLady) {
        riding.hasLadyFrog = false;
        this.carryingLady = true;
        this.addScore(200, this.frogX, this.rowCenterY(this.frogRow) - 12, 'LADY FROG!', '#F472B6');
        arcadeAudio.playPowerUp();
      }
      if (this.frogX < 10 || this.frogX > LOGICAL_W - 10) {
        this.killFrog('DRIFTED!');
      }
    } else {
      // Road / predator dodge lane
      for (const a of lane.actors) {
        if (this.frogX + 11 > a.x + 4 && this.frogX - 11 < a.x + a.w - 4) {
          const msg =
            this.variant === 'frogger2'
              ? this.zone === 0
                ? 'CHOMPED!'
                : this.zone === 2
                ? 'SKY HIT!'
                : 'BOAT HIT!'
              : 'SPLAT!';
          this.killFrog(msg);
          return;
        }
      }
    }
  }

  private drawFrog(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale: number,
    pink = false
  ): void {
    ctx.save();
    ctx.translate(x, y);
    const angle =
      this.frogFacing === 'up'
        ? 0
        : this.frogFacing === 'right'
        ? Math.PI * 0.5
        : this.frogFacing === 'down'
        ? Math.PI
        : -Math.PI * 0.5;
    if (!pink) ctx.rotate(angle);
    ctx.scale(scale, scale);

    // Legs
    ctx.fillStyle = pink ? '#EC4899' : '#16A34A';
    ctx.fillRect(-13, -8, 6, 7);
    ctx.fillRect(7, -8, 6, 7);
    ctx.fillRect(-14, 3, 7, 8);
    ctx.fillRect(7, 3, 7, 8);

    // Body
    ctx.fillStyle = pink ? '#F472B6' : '#4ADE80';
    ctx.beginPath();
    ctx.ellipse(0, 1, 9.5, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    // Yellow belly stripe
    ctx.fillStyle = pink ? '#FBCFE8' : '#FEF08A';
    ctx.beginPath();
    ctx.ellipse(0, 2, 4.5, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-5.5, -7.5, 3.2, 0, Math.PI * 2);
    ctx.arc(5.5, -7.5, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(-5.5, -8.3, 1.5, 0, Math.PI * 2);
    ctx.arc(5.5, -8.3, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawActor(ctx: CanvasRenderingContext2D, a: LaneActor, cy: number, speed: number): void {
    const dir = speed >= 0 ? 1 : -1;
    const h = CELL_H - 8;
    const y = cy - h * 0.5;

    ctx.save();
    switch (a.kind) {
      case 'log': {
        const g = ctx.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0, '#92400E');
        g.addColorStop(0.45, '#B45309');
        g.addColorStop(1, '#78350F');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(a.x, y + 3, a.w, h - 6, 10);
        ctx.fill();
        ctx.strokeStyle = '#451A03';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Bark lines
        ctx.strokeStyle = 'rgba(254,243,199,0.22)';
        ctx.beginPath();
        ctx.moveTo(a.x + 12, cy - 3);
        ctx.lineTo(a.x + a.w - 14, cy - 3);
        ctx.moveTo(a.x + 20, cy + 4);
        ctx.lineTo(a.x + a.w - 18, cy + 4);
        ctx.stroke();
        if (a.hasLadyFrog) {
          this.drawFrog(ctx, a.x + a.w * 0.5, cy, 0.8, true);
        }
        if (a.hasLogSnake && a.snakeOffset !== undefined) {
          const sx = a.x + a.snakeOffset;
          ctx.strokeStyle = '#A3E635';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(sx - 12, cy + Math.sin(this.time * 12) * 3);
          ctx.quadraticCurveTo(sx, cy - 5, sx + 12, cy + Math.cos(this.time * 12) * 3);
          ctx.stroke();
          ctx.fillStyle = '#EF4444';
          ctx.beginPath();
          ctx.arc(sx + (a.snakeDir ?? 1) * 12, cy, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'turtle_pod': {
        if (a.submerged) {
          // Bubbles where turtles dove
          ctx.strokeStyle = 'rgba(186,230,253,0.55)';
          ctx.lineWidth = 1.5;
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(a.x + 16 + i * 24, cy + Math.sin(this.time * 7 + i) * 3, 4, 0, Math.PI * 2);
            ctx.stroke();
          }
          break;
        }
        const count = a.w > 95 ? 3 : 2;
        const step = a.w / count;
        const flash = a.warning && Math.floor(this.time * 12) % 2 === 0;
        for (let i = 0; i < count; i++) {
          const tx = a.x + step * (i + 0.5);
          ctx.fillStyle = flash ? '#FDE047' : '#DC2626';
          ctx.beginPath();
          ctx.ellipse(tx, cy, 13, 10, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#7F1D1D';
          ctx.lineWidth = 1.4;
          ctx.stroke();
          // Shell hex dot
          ctx.fillStyle = flash ? '#F97316' : '#FCA5A5';
          ctx.beginPath();
          ctx.arc(tx, cy, 4, 0, Math.PI * 2);
          ctx.fill();
          // Head
          ctx.fillStyle = '#4ADE80';
          ctx.beginPath();
          ctx.arc(tx + dir * 14, cy, 4.2, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'gator': {
        ctx.fillStyle = '#15803D';
        ctx.beginPath();
        ctx.roundRect(a.x + 4, y + 5, a.w - 8, h - 10, 8);
        ctx.fill();
        // Ridged scales
        ctx.fillStyle = '#4ADE80';
        for (let sx = a.x + 14; sx < a.x + a.w - 22; sx += 14) {
          ctx.fillRect(sx, cy - 6, 7, 12);
        }
        // Snapping jaw
        const hx = dir > 0 ? a.x + a.w - 16 : a.x + 16;
        ctx.fillStyle = a.gatorMouthOpen ? '#EF4444' : '#166534';
        ctx.beginPath();
        ctx.arc(hx, cy, a.gatorMouthOpen ? 10 : 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.arc(hx - dir * 4, cy - 5, 2.2, 0, Math.PI * 2);
        ctx.arc(hx - dir * 4, cy + 5, 2.2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'car_yellow':
      case 'dozer':
      case 'sedan_pink':
      case 'racer_white':
      case 'semi': {
        const bodyColor =
          a.kind === 'car_yellow'
            ? '#FACC15'
            : a.kind === 'dozer'
            ? '#F97316'
            : a.kind === 'sedan_pink'
            ? '#F472B6'
            : a.kind === 'racer_white'
            ? '#F8FAFC'
            : '#E2E8F0';
        // Headlight beams
        const frontX = dir > 0 ? a.x + a.w : a.x;
        const beamGrad = ctx.createLinearGradient(frontX, cy, frontX + dir * 36, cy);
        beamGrad.addColorStop(0, 'rgba(254, 240, 138, 0.38)');
        beamGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(frontX, cy - 8);
        ctx.lineTo(frontX + dir * 36, cy - 16);
        ctx.lineTo(frontX + dir * 36, cy + 16);
        ctx.lineTo(frontX, cy + 8);
        ctx.closePath();
        ctx.fill();

        // Chassis
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.roundRect(a.x + 2, y + 4, a.w - 4, h - 8, 6);
        ctx.fill();
        // Windshield / Cab
        ctx.fillStyle = a.kind === 'semi' ? '#38BDF8' : '#1E293B';
        if (a.kind === 'semi') {
          const cabX = dir > 0 ? a.x + a.w - 26 : a.x + 4;
          ctx.fillStyle = '#EF4444';
          ctx.fillRect(cabX, y + 5, 22, h - 10);
          ctx.fillStyle = '#38BDF8';
          ctx.fillRect(dir > 0 ? cabX + 12 : cabX + 2, y + 7, 8, h - 14);
        } else {
          ctx.fillRect(a.x + a.w * 0.28, y + 7, a.w * 0.42, h - 14);
        }
        // Tires
        ctx.fillStyle = '#090D16';
        ctx.fillRect(a.x + 8, y + 1, 10, 4);
        ctx.fillRect(a.x + a.w - 18, y + 1, 10, 4);
        ctx.fillRect(a.x + 8, y + h - 5, 10, 4);
        ctx.fillRect(a.x + a.w - 18, y + h - 5, 10, 4);
        break;
      }
      // Frogger II: Underwater / Surface / Sky Actors
      case 'bubble_raft':
      case 'cloud': {
        if (a.submerged) break;
        const flash = a.warning && Math.floor(this.time * 12) % 2 === 0;
        ctx.fillStyle =
          a.kind === 'bubble_raft'
            ? flash
              ? 'rgba(253,224,71,0.55)'
              : 'rgba(125,211,252,0.55)'
            : flash
            ? '#CBD5E1'
            : '#F8FAFC';
        const puffs = Math.max(3, Math.floor(a.w / 24));
        for (let i = 0; i < puffs; i++) {
          const px = a.x + 14 + (i * (a.w - 28)) / Math.max(1, puffs - 1);
          ctx.beginPath();
          ctx.arc(px, cy + (i % 2 === 0 ? -2 : 2), 13, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'whale': {
        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.roundRect(a.x + 4, y + 3, a.w - 8, h - 6, 14);
        ctx.fill();
        ctx.fillStyle = '#F8FAFC';
        ctx.beginPath();
        ctx.ellipse(a.x + a.w * 0.5, cy + 5, a.w * 0.34, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'shark': {
        ctx.fillStyle = '#64748B';
        ctx.beginPath();
        ctx.ellipse(a.x + a.w * 0.5, cy, a.w * 0.48, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        // Fin
        ctx.beginPath();
        ctx.moveTo(a.x + a.w * 0.45, cy - 15);
        ctx.lineTo(a.x + a.w * 0.62, cy - 4);
        ctx.lineTo(a.x + a.w * 0.36, cy - 4);
        ctx.fill();
        ctx.fillStyle = '#F87171';
        ctx.beginPath();
        ctx.arc(dir > 0 ? a.x + a.w - 10 : a.x + 10, cy - 2, 2.4, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'sub': {
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.roundRect(a.x + 4, y + 6, a.w - 8, h - 12, 11);
        ctx.fill();
        ctx.fillStyle = '#CA8A04';
        ctx.fillRect(a.x + a.w * 0.4, y + 1, 18, 7);
        ctx.fillStyle = '#38BDF8';
        for (let p = 0; p < 3; p++) {
          ctx.beginPath();
          ctx.arc(a.x + 24 + p * 22, cy, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'eel': {
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let t = 0; t <= 6; t++) {
          const ex = a.x + 6 + (t / 6) * (a.w - 12);
          const ey = cy + Math.sin(this.time * 11 + t * 1.1) * 5;
          if (t === 0) ctx.moveTo(ex, ey);
          else ctx.lineTo(ex, ey);
        }
        ctx.stroke();
        break;
      }
      case 'jelly': {
        ctx.fillStyle = '#E879F9';
        ctx.beginPath();
        ctx.arc(a.x + a.w * 0.5, cy - 2, 12, Math.PI, 0);
        ctx.fill();
        ctx.strokeStyle = '#F0ABFC';
        ctx.lineWidth = 2;
        for (let k = -8; k <= 8; k += 4) {
          ctx.beginPath();
          ctx.moveTo(a.x + a.w * 0.5 + k, cy - 2);
          ctx.lineTo(a.x + a.w * 0.5 + k + Math.sin(this.time * 9 + k) * 3, cy + 12);
          ctx.stroke();
        }
        break;
      }
      case 'hippo': {
        if (a.submerged) break;
        const flash = a.warning && Math.floor(this.time * 12) % 2 === 0;
        ctx.fillStyle = flash ? '#FDE047' : '#A855F7';
        ctx.beginPath();
        ctx.roundRect(a.x + 4, y + 4, a.w - 8, h - 8, 12);
        ctx.fill();
        ctx.fillStyle = '#F3E8FF';
        ctx.beginPath();
        ctx.arc(dir > 0 ? a.x + a.w - 16 : a.x + 16, cy - 4, 3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'raft': {
        ctx.fillStyle = '#D97706';
        ctx.beginPath();
        ctx.roundRect(a.x + 2, y + 5, a.w - 4, h - 10, 6);
        ctx.fill();
        ctx.strokeStyle = '#FEF3C7';
        ctx.lineWidth = 2;
        ctx.strokeRect(a.x + 10, y + 8, a.w - 20, h - 16);
        break;
      }
      case 'speedboat': {
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.moveTo(dir > 0 ? a.x + a.w : a.x, cy);
        ctx.lineTo(dir > 0 ? a.x + a.w - 22 : a.x + 22, y + 4);
        ctx.lineTo(dir > 0 ? a.x : a.x + a.w, y + 6);
        ctx.lineTo(dir > 0 ? a.x : a.x + a.w, y + h - 6);
        ctx.lineTo(dir > 0 ? a.x + a.w - 22 : a.x + 22, y + h - 4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#E0F2FE';
        ctx.fillRect(a.x + a.w * 0.35, cy - 5, a.w * 0.25, 10);
        break;
      }
      case 'biplane': {
        ctx.fillStyle = '#F43F5E';
        ctx.fillRect(a.x + 8, cy - 5, a.w - 16, 10);
        ctx.fillStyle = '#FDE047';
        ctx.fillRect(a.x + a.w * 0.28, y + 2, 18, h - 4);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(dir > 0 ? a.x + a.w - 6 : a.x + 2, cy - 9, 4, 18);
        break;
      }
      case 'balloon': {
        ctx.fillStyle = '#FB923C';
        ctx.beginPath();
        ctx.ellipse(a.x + a.w * 0.5, cy - 2, a.w * 0.36, 13, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(a.x + a.w * 0.5 - 6, cy + 7, 12, 7);
        break;
      }
      case 'bird':
      case 'eagle': {
        const wing = Math.sin(this.time * 14 + a.x * 0.04) * 7;
        ctx.strokeStyle = a.kind === 'eagle' ? '#F59E0B' : '#EC4899';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(a.x + 8, cy - wing);
        ctx.lineTo(a.x + a.w * 0.5, cy + 2);
        ctx.lineTo(a.x + a.w - 8, cy - wing);
        ctx.stroke();
        break;
      }
    }
    ctx.restore();
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.save();
    ctx.scale(dpr, dpr);

    // Top HUD bar
    ctx.fillStyle = '#050814';
    ctx.fillRect(0, 0, LOGICAL_W, TOP_MARGIN);
    ctx.font = '800 13px "JetBrains Mono", monospace';
    ctx.fillStyle = this.variant === 'frogger2' ? '#38BDF8' : '#4ADE80';
    ctx.textAlign = 'left';
    const zoneLabel =
      this.variant === 'frogger2'
        ? this.zone === 0
          ? 'ZONE 1 · UNDERWATER REEF'
          : this.zone === 1
          ? 'ZONE 2 · SURFACE LAGOON'
          : 'ZONE 3 · SKY KINGDOM'
        : `FROGGER · STAGE ${this.level}`;
    ctx.fillText(zoneLabel, 14, 21);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#FDE047';
    ctx.fillText(`SCORE ${this.score.toLocaleString()}`, LOGICAL_W - 14, 21);

    // Timer gauge
    const pct = Math.max(0, this.laneTime / this.maxLaneTime);
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(14, 31, LOGICAL_W - 28, 10);
    ctx.fillStyle = pct > 0.3 ? '#22C55E' : '#EF4444';
    ctx.fillRect(14, 31, (LOGICAL_W - 28) * pct, 10);

    // Zone / Ecosystem backgrounds
    const riverTop = TOP_MARGIN;
    const medianY = TOP_MARGIN + 6 * CELL_H;
    const roadY = TOP_MARGIN + 7 * CELL_H;
    const startY = TOP_MARGIN + 12 * CELL_H;

    if (this.variant === 'frogger') {
      // River
      const rg = ctx.createLinearGradient(0, riverTop, 0, medianY);
      rg.addColorStop(0, '#0C4A6E');
      rg.addColorStop(1, '#1D4ED8');
      ctx.fillStyle = rg;
      ctx.fillRect(0, riverTop, LOGICAL_W, 6 * CELL_H);
      // Purple safe median
      ctx.fillStyle = '#581C87';
      ctx.fillRect(0, medianY, LOGICAL_W, CELL_H);
      // Asphalt highway
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, roadY, LOGICAL_W, 5 * CELL_H);
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.32)';
      ctx.setLineDash([14, 14]);
      ctx.lineWidth = 2;
      for (let r = 8; r <= 11; r++) {
        const ly = TOP_MARGIN + r * CELL_H;
        ctx.beginPath();
        ctx.moveTo(0, ly);
        ctx.lineTo(LOGICAL_W, ly);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      // Start grass bank
      ctx.fillStyle = '#4C1D95';
      ctx.fillRect(0, startY, LOGICAL_W, LOGICAL_H - startY);
    } else if (this.zone === 0) {
      // Zone 1 Underwater Reef
      const ug = ctx.createLinearGradient(0, riverTop, 0, LOGICAL_H);
      ug.addColorStop(0, '#0284C7');
      ug.addColorStop(0.5, '#1E3A8A');
      ug.addColorStop(1, '#0F172A');
      ctx.fillStyle = ug;
      ctx.fillRect(0, riverTop, LOGICAL_W, LOGICAL_H - riverTop);
      ctx.fillStyle = 'rgba(56,189,248,0.16)';
      ctx.fillRect(0, medianY, LOGICAL_W, CELL_H);
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(0, startY, LOGICAL_W, LOGICAL_H - startY);
    } else if (this.zone === 1) {
      // Zone 2 Surface Lagoon
      const lg = ctx.createLinearGradient(0, riverTop, 0, LOGICAL_H);
      lg.addColorStop(0, '#0369A1');
      lg.addColorStop(1, '#0EA5E9');
      ctx.fillStyle = lg;
      ctx.fillRect(0, riverTop, LOGICAL_W, LOGICAL_H - riverTop);
      ctx.fillStyle = '#15803D';
      ctx.fillRect(0, medianY, LOGICAL_W, CELL_H);
      ctx.fillStyle = '#065F46';
      ctx.fillRect(0, startY, LOGICAL_W, LOGICAL_H - startY);
    } else {
      // Zone 3 Sky Kingdom
      const sg = ctx.createLinearGradient(0, riverTop, 0, LOGICAL_H);
      sg.addColorStop(0, '#312E81');
      sg.addColorStop(0.45, '#0284C7');
      sg.addColorStop(1, '#7DD3FC');
      ctx.fillStyle = sg;
      ctx.fillRect(0, riverTop, LOGICAL_W, LOGICAL_H - riverTop);
      // Rainbow Sky Bridge median
      const rbg = ctx.createLinearGradient(0, medianY, LOGICAL_W, medianY);
      rbg.addColorStop(0, '#EF4444');
      rbg.addColorStop(0.25, '#FACC15');
      rbg.addColorStop(0.5, '#4ADE80');
      rbg.addColorStop(0.75, '#38BDF8');
      rbg.addColorStop(1, '#A855F7');
      ctx.fillStyle = rbg;
      ctx.globalAlpha = 0.65;
      ctx.fillRect(0, medianY + 4, LOGICAL_W, CELL_H - 8);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#E0F2FE';
      ctx.fillRect(0, startY, LOGICAL_W, LOGICAL_H - startY);
    }

    // Top Home Bank & Berths
    ctx.fillStyle =
      this.variant === 'frogger2' && this.zone === 2
        ? '#4C1D95'
        : this.variant === 'frogger2' && this.zone === 0
        ? '#0369A1'
        : '#14532D';
    ctx.fillRect(0, TOP_MARGIN, LOGICAL_W, CELL_H);
    for (const h of this.homes) {
      const hx = h.col * CELL_W + CELL_W * 0.5;
      const hy = this.rowCenterY(0);
      ctx.fillStyle =
        this.variant === 'frogger2' && this.zone === 2 ? '#FDE047' : '#0EA5E9';
      ctx.beginPath();
      ctx.roundRect(hx - 24, TOP_MARGIN + 4, 48, CELL_H - 8, 8);
      ctx.fill();
      if (h.filled) {
        this.drawFrog(ctx, hx, hy, 0.9, false);
      } else if (h.hasFly) {
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.arc(hx + Math.sin(this.time * 12) * 3, hy, 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (h.hasGator) {
        ctx.fillStyle = '#22C55E';
        ctx.beginPath();
        ctx.arc(hx, hy, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(hx - 8, hy, 16, 5);
      }
    }

    // Draw all lanes
    for (const lane of this.lanes) {
      const cy = this.rowCenterY(lane.row);
      for (const a of lane.actors) {
        this.drawActor(ctx, a, cy, lane.speed);
      }
    }

    // Draw median snake
    if (this.medianSnakeActive) {
      const sy = this.rowCenterY(6);
      ctx.strokeStyle = '#84CC16';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(this.medianSnakeX - 18, sy + Math.sin(this.time * 10) * 4);
      ctx.quadraticCurveTo(this.medianSnakeX, sy - 6, this.medianSnakeX + 18, sy + Math.cos(this.time * 10) * 4);
      ctx.stroke();
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(this.medianSnakeX + this.medianSnakeDir * 19, sy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Player Frog
    if (this.deathTimer <= 0) {
      let fx = this.frogX;
      let fy = this.rowCenterY(this.frogRow);
      let hopScale = 1;
      if (this.hopTimer > 0) {
        const t = 1 - this.hopTimer / 0.11;
        fx = this.hopStartX + (this.hopTargetX - this.hopStartX) * t;
        fy = this.hopStartY + (this.hopTargetY - this.hopStartY) * t;
        hopScale = 1 + Math.sin(t * Math.PI) * 0.25;
      }
      this.drawFrog(ctx, fx, fy, hopScale, false);
      if (this.carryingLady) {
        this.drawFrog(ctx, fx + 9, fy - 7, 0.55, true);
      }
    }

    renderParticlesAndPopups(ctx, this.particles, this.popups);

    if (this.phase === 'READY') {
      ctx.fillStyle = 'rgba(5, 8, 20, 0.6)';
      ctx.fillRect(LOGICAL_W * 0.5 - 140, LOGICAL_H * 0.45 - 24, 280, 48);
      ctx.font = '900 20px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#4ADE80';
      ctx.fillText(
        this.variant === 'frogger2' ? `ZONE ${this.zone + 1} · READY!` : `STAGE ${this.level} · HOP!`,
        LOGICAL_W * 0.5,
        LOGICAL_H * 0.45 + 7
      );
    }

    if (visualMode === 'crt') renderCrtOverlay(ctx, LOGICAL_W, LOGICAL_H);
    ctx.restore();
  }

  public getHudSnapshot(): ClassicGameHud {
    const filledCount = this.homes.filter((h) => h.filled).length;
    const zoneNames = ['REEF', 'LAGOON', 'SKY'];
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: Math.max(0, this.lives),
      stageName:
        this.variant === 'frogger2'
          ? `THREEDEEP · ${zoneNames[this.zone]} ${this.level}`
          : `FROGGER · STAGE ${this.level}`,
      primaryMetricLabel: this.variant === 'frogger2' ? 'ZONE' : 'HOMES',
      primaryMetricValue:
        this.variant === 'frogger2'
          ? `${this.zone + 1}/3 ${zoneNames[this.zone]}`
          : `${filledCount}/${this.homes.length}`,
      secondaryMetricLabel: 'TIME',
      secondaryMetricValue: `${Math.ceil(Math.max(0, this.laneTime))}s`,
      bannerText:
        this.phase === 'TITLE'
          ? this.variant === 'frogger2'
            ? 'FROGGER II: THREEDEEP! — 3 ECOSYSTEMS'
            : 'FROGGER — PRESS START TO HOP'
          : this.phase === 'GAME_OVER'
          ? 'GAME OVER'
          : '',
      canRestartStage: true,
    };
  }
}

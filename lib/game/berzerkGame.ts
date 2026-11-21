import { arcadeAudio } from './audio';
import {
  ArcadeGameInstance,
  ArcadeInputState,
  ClassicGameHud,
  ClassicGamePhase,
  createEmptyInput,
  getPrecisionMoveVector,
  readHighScore,
  renderCrtOverlay,
  renderParticlesAndPopups,
  saveHighScore,
  ScorePopup,
  SimpleParticle,
  spawnBurst,
  stepParticlesAndPopups,
} from './classicArcadeInterface';

const W = 760;
const H = 560;
const STORAGE_KEY = 'berzerk_stern_highscore_v3';

interface MazeWall {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface RobotTier {
  name: string;
  body: string;
  trim: string;
  speed: number;
  maxShots: number;
  fireDelay: number;
  score: number;
}

// Authentic 1980 Stern Electronics Berzerk escalating robot color tiers!
const ROBOT_TIERS: RobotTier[] = [
  { name: 'YELLOW', body: '#FACC15', trim: '#FEF08A', speed: 52, maxShots: 1, fireDelay: 2.35, score: 50 },
  { name: 'RED', body: '#EF4444', trim: '#FCA5A5', speed: 66, maxShots: 1, fireDelay: 1.85, score: 50 },
  { name: 'CYAN', body: '#22D3EE', trim: '#A5F3FC', speed: 78, maxShots: 2, fireDelay: 1.5, score: 50 },
  { name: 'EMERALD', body: '#4ADE80', trim: '#BBF7D0', speed: 90, maxShots: 2, fireDelay: 1.25, score: 50 },
  { name: 'VIOLET', body: '#C084FC', trim: '#F3E8FF', speed: 102, maxShots: 3, fireDelay: 1.05, score: 50 },
  { name: 'WHITE ELITE', body: '#F8FAFC', trim: '#38BDF8', speed: 114, maxShots: 3, fireDelay: 0.9, score: 50 },
];

interface BerzerkRobot {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fireCd: number;
  stepPhase: number;
  eyeAngle: number;
  dyingTimer: number;
  activeShots: number;
}

interface LaserBolt {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fromEnemy: boolean;
  ownerId?: number;
  color: string;
  trail: Array<{ x: number; y: number }>;
}

interface SparkArc {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  life: number;
}

const VOICE_LINES = {
  intro: ['INTRUDER ALERT! INTRUDER ALERT!', 'THE HUMANOID MUST NOT ESCAPE!', 'GET THE HUMANOID!'],
  chicken: ['CHICKEN! FIGHT LIKE A ROBOT!', 'HUMANOID COWARD DETECTED!'],
  otto: ['EVIL OTTO APPROACHES!', 'DESTROY THE INTRUDER!'],
  clear: ['SECTOR CLEARED! BONUS AWARDED!', 'ALL ROBOTS TERMINATED!'],
};

export class BerzerkGame implements ArcadeGameInstance {
  public readonly logicalWidth = W;
  public readonly logicalHeight = H;
  public readonly supportsPointerAim = true;
  public readonly primaryActionLabel = 'Laser Fire';
  public readonly secondaryActionLabel = 'Hold / Aim';

  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();
  private score = 0;
  private highScore = readHighScore(STORAGE_KEY);
  private nextExtraLife = 5000;
  private level = 1;
  private lives = 3;
  private clock = 0;
  private stateTimer = 0;
  private nextId = 1;

  // Player Humanoid
  private px = 110;
  private py = H * 0.5;
  private entryX = 110;
  private entryY = H * 0.5;
  private aimX = 1;
  private aimY = 0;
  private walkPhase = 0;
  private fireCd = 0;
  private invulnTimer = 0;
  private zapDeathTimer = 0;

  // Electrified 5x3 Stern Maze
  private walls: MazeWall[] = [];
  private blockedDoor: 'left' | 'right' | 'top' | 'bottom' = 'left';
  private roomRobotsInitial = 0;
  private roomBonusAwarded = false;
  private robots: BerzerkRobot[] = [];
  private shots: LaserBolt[] = [];
  private sparks: SparkArc[] = [];
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];
  private shakeTimer = 0;

  // Iconic Bouncing Evil Otto
  private ottoActive = false;
  private ottoTimer = 15;
  private ottoX = 90;
  private ottoY = H * 0.5;
  private ottoBouncePhase = 0;

  // Synthesized Stern Voice Callout Banner
  private voiceText = 'INTRUDER ALERT! INTRUDER ALERT!';
  private voiceTimer = 2.5;

  constructor() {
    this.setupRoom(1, 'left', true);
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public startNewGame(): void {
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.nextExtraLife = 5000;
    this.level = 1;
    this.lives = 3;
    this.zapDeathTimer = 0;
    this.phase = 'READY';
    this.stateTimer = 0.85;
    this.setupRoom(1, 'left', false);
    this.sayVoice('INTRUDER ALERT! INTRUDER ALERT!');
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.setupRoom(1, 'left', true);
  }

  private getTier(): RobotTier {
    // Classic Berzerk escalates robot tier by score/sector!
    const idx = Math.min(ROBOT_TIERS.length - 1, Math.floor((this.level - 1) / 2));
    return ROBOT_TIERS[idx];
  }

  private sayVoice(text: string): void {
    this.voiceText = text;
    this.voiceTimer = 2.6;
  }

  private addScore(pts: number, x?: number, y?: number, color = '#FEF08A', label?: string): void {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(STORAGE_KEY, this.highScore);
    }
    if (this.score >= this.nextExtraLife) {
      this.lives = Math.min(6, this.lives + 1);
      this.nextExtraLife += 5000;
      arcadeAudio.playExtraLife();
      this.popups.push({ x: this.px, y: this.py - 28, text: '1UP EXTRA HUMANOID!', color: '#4ADE80', life: 1.2, maxLife: 1.2 });
    }
    if (x !== undefined && y !== undefined) {
      this.popups.push({
        x,
        y,
        text: label || `+${pts}`,
        color,
        life: 0.85,
        maxLife: 0.85,
      });
    }
  }

  private setupRoom(roomNum: number, entrySide: 'left' | 'right' | 'top' | 'bottom', attract = false): void {
    this.level = roomNum;
    this.robots = [];
    this.shots = [];
    this.sparks = [];
    this.roomBonusAwarded = false;
    this.blockedDoor = entrySide;

    const border = 26;
    const thick = 10;
    const doorHalf = 58;
    const midX = W * 0.5;
    const midY = H * 0.5;

    // Outer electrified frame with 4 cardinal exits (entry door seals behind you like 1980 arcade!)
    const walls: MazeWall[] = [
      { x: border, y: border, w: midX - doorHalf - border, h: thick },
      { x: midX + doorHalf, y: border, w: W - border - (midX + doorHalf), h: thick },
      { x: border, y: H - border - thick, w: midX - doorHalf - border, h: thick },
      { x: midX + doorHalf, y: H - border - thick, w: W - border - (midX + doorHalf), h: thick },
      { x: border, y: border, w: thick, h: midY - doorHalf - border },
      { x: border, y: midY + doorHalf, w: thick, h: H - border - (midY + doorHalf) },
      { x: W - border - thick, y: border, w: thick, h: midY - doorHalf - border },
      { x: W - border - thick, y: midY + doorHalf, w: thick, h: H - border - (midY + doorHalf) },
    ];

    // Seal entry doorway with a glowing force-barrier so player can't accidentally back out
    if (entrySide === 'left') walls.push({ x: border, y: midY - doorHalf, w: thick, h: doorHalf * 2 });
    else if (entrySide === 'right') walls.push({ x: W - border - thick, y: midY - doorHalf, w: thick, h: doorHalf * 2 });
    else if (entrySide === 'top') walls.push({ x: midX - doorHalf, y: border, w: doorHalf * 2, h: thick });
    else walls.push({ x: midX - doorHalf, y: H - border - thick, w: doorHalf * 2, h: thick });

    // Authentic 1980 Stern 4×2 internal pillar grid — each pillar shoots 1 deterministic/random electrified wall!
    const cellW = (W - border * 2) / 5;
    const cellH = (H - border * 2) / 3;
    for (let gx = 1; gx <= 4; gx++) {
      for (let gy = 1; gy <= 2; gy++) {
        const px = border + gx * cellW;
        const py = border + gy * cellH;
        const dir = Math.floor(Math.random() * 4);
        if (dir === 0) walls.push({ x: px - thick * 0.5, y: py - cellH, w: thick, h: cellH + thick * 0.5 });
        else if (dir === 1) walls.push({ x: px - thick * 0.5, y: py, w: thick, h: cellH });
        else if (dir === 2) walls.push({ x: px - cellW, y: py - thick * 0.5, w: cellW + thick * 0.5, h: thick });
        else walls.push({ x: px, y: py - thick * 0.5, w: cellW, h: thick });
      }
    }
    this.walls = walls;

    // Position Humanoid safely inside entry doorway
    if (entrySide === 'left') {
      this.px = border + 44;
      this.py = midY;
      this.aimX = 1;
      this.aimY = 0;
    } else if (entrySide === 'right') {
      this.px = W - border - 44;
      this.py = midY;
      this.aimX = -1;
      this.aimY = 0;
    } else if (entrySide === 'top') {
      this.px = midX;
      this.py = border + 44;
      this.aimX = 0;
      this.aimY = 1;
    } else {
      this.px = midX;
      this.py = H - border - 44;
      this.aimX = 0;
      this.aimY = -1;
    }
    this.entryX = this.px;
    this.entryY = this.py;
    this.invulnTimer = 1.65;

    // Reset Evil Otto countdown
    this.ottoActive = false;
    this.ottoTimer = Math.max(8.5, 16.5 - roomNum * 0.65);
    this.ottoX = this.entryX;
    this.ottoY = this.entryY;

    // Spawn Robots safely away from walls & player
    const tier = this.getTier();
    const count = attract ? 7 : Math.min(11, 5 + Math.floor(roomNum * 0.8));
    let attempts = 0;
    while (this.robots.length < count && attempts < 140) {
      attempts++;
      const rx = border + 48 + Math.random() * (W - (border + 48) * 2);
      const ry = border + 48 + Math.random() * (H - (border + 48) * 2);
      if (Math.hypot(rx - this.px, ry - this.py) < 165) continue;
      if (this.hitsWall(rx, ry, 20)) continue;
      if (this.robots.some((r) => Math.hypot(r.x - rx, r.y - ry) < 52)) continue;
      this.robots.push({
        id: this.nextId++,
        x: rx,
        y: ry,
        vx: 0,
        vy: 0,
        fireCd: 0.8 + Math.random() * tier.fireDelay,
        stepPhase: Math.random() * Math.PI * 2,
        eyeAngle: 0,
        dyingTimer: 0,
        activeShots: 0,
      });
    }
    this.roomRobotsInitial = this.robots.length;
  }

  private hitsWall(x: number, y: number, r: number): boolean {
    for (const w of this.walls) {
      if (x + r > w.x && x - r < w.x + w.w && y + r > w.y && y - r < w.y + w.h) {
        return true;
      }
    }
    return false;
  }

  private hasLineOfSight(x1: number, y1: number, x2: number, y2: number): boolean {
    const steps = 14;
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const sx = x1 + (x2 - x1) * t;
      const sy = y1 + (y2 - y1) * t;
      if (this.hitsWall(sx, sy, 3)) return false;
    }
    return true;
  }

  private killPlayer(byWall = false): void {
    if (this.invulnTimer > 0 || this.zapDeathTimer > 0) return;
    this.lives--;
    this.zapDeathTimer = 0.85;
    this.shakeTimer = 0.35;
    if (byWall) arcadeAudio.playElectricZap();
    else arcadeAudio.playExplosion(true);
    spawnBurst(this.particles, this.px, this.py, byWall ? '#38BDF8' : '#4ADE80', 26, 230, 3.6);
    if (this.lives <= 0) {
      this.phase = 'GAME_OVER';
      this.sayVoice('HUMANOID TERMINATED · INSERT COIN');
    } else {
      this.sayVoice(byWall ? 'HIGH VOLTAGE ELECTROCUTION!' : 'GOT THE HUMANOID!');
    }
  }

  private destroyRobot(rob: BerzerkRobot, byWall: boolean, attract: boolean): void {
    if (rob.dyingTimer > 0) return;
    rob.dyingTimer = 0.28;
    const tier = this.getTier();
    if (!attract) {
      if (byWall) arcadeAudio.playElectricZap();
      else arcadeAudio.playExplosion(false);
    }
    spawnBurst(this.particles, rob.x, rob.y, byWall ? '#60A5FA' : tier.body, 18, 200, 3.2);
    if (!attract) {
      this.addScore(tier.score, rob.x, rob.y, tier.trim, byWall ? 'ZAPPED +50' : '+50');
    }
  }

  public step(dt: number): void {
    const safeDt = Math.min(0.05, Math.max(0, dt));
    this.clock += safeDt;
    if (this.shakeTimer > 0) this.shakeTimer = Math.max(0, this.shakeTimer - safeDt);
    if (this.voiceTimer > 0) this.voiceTimer = Math.max(0, this.voiceTimer - safeDt);
    stepParticlesAndPopups(this.particles, this.popups, safeDt);

    for (let i = this.sparks.length - 1; i >= 0; i--) {
      this.sparks[i].life -= safeDt;
      if (this.sparks[i].life <= 0) this.sparks.splice(i, 1);
    }

    if (this.phase === 'PAUSED' || this.phase === 'GAME_OVER') return;

    if (this.phase === 'READY') {
      this.stateTimer -= safeDt;
      if (this.stateTimer <= 0) this.phase = 'PLAYING';
      return;
    }

    // Handle brief electrocution death animation before respawning in fresh room
    if (this.zapDeathTimer > 0) {
      this.zapDeathTimer -= safeDt;
      if (this.zapDeathTimer <= 0 && this.lives > 0) {
        this.setupRoom(this.level, this.blockedDoor, false);
        this.phase = 'READY';
        this.stateTimer = 0.65;
      }
      return;
    }

    const attract = this.phase === 'TITLE';
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - safeDt);
    if (this.fireCd > 0) this.fireCd = Math.max(0, this.fireCd - safeDt);

    // Ambient live wall electricity sparks!
    if (Math.random() < safeDt * 14 && this.walls.length > 0) {
      const w = this.walls[Math.floor(Math.random() * this.walls.length)];
      const sx = w.x + Math.random() * w.w;
      const sy = w.y + Math.random() * w.h;
      this.sparks.push({
        x1: sx,
        y1: sy,
        x2: sx + (Math.random() - 0.5) * 26,
        y2: sy + (Math.random() - 0.5) * 26,
        life: 0.12,
      });
    }

    // Player movement with precision moveScale & analog/tilt support
    const { vx: rawVx, vy: rawVy } = getPrecisionMoveVector(this.input);
    const baseSpeed = 162; // Deliberate, crisp 1980 arcade pace (further refined by moveScale!)
    let mvx = 0;
    let mvy = 0;

    if (attract) {
      mvx = Math.cos(this.clock * 1.1) * 0.55;
      mvy = Math.sin(this.clock * 1.5) * 0.55;
      const target = this.robots.find((r) => r.dyingTimer <= 0);
      if (target) {
        const ang = Math.atan2(target.y - this.py, target.x - this.px);
        this.aimX = Math.cos(ang);
        this.aimY = Math.sin(ang);
      }
      if (this.fireCd <= 0 && target) {
        this.fireCd = 0.42;
        this.shots.push({
          x: this.px + this.aimX * 14,
          y: this.py + this.aimY * 14,
          vx: this.aimX * 480,
          vy: this.aimY * 480,
          fromEnemy: false,
          color: '#4ADE80',
          trail: [],
        });
      }
    } else {
      // Holding Secondary (Shift/X) plants feet to aim/shoot in place like classic Berzerk!
      const holdToAim = this.input.secondary;
      if (!holdToAim) {
        mvx = rawVx;
        mvy = rawVy;
      }

      if (this.input.pointerActive && !this.input.tiltActive) {
        const tx = this.input.pointerX * W;
        const ty = this.input.pointerY * H;
        const adx = tx - this.px;
        const ady = ty - this.py;
        const dist = Math.hypot(adx, ady);
        if (dist > 8) {
          this.aimX = adx / dist;
          this.aimY = ady / dist;
        }
      } else if (Math.hypot(rawVx, rawVy) > 0.08) {
        // Snap cleanly to classic 8-way aim when using keyboard/joystick/tilt
        const ang = Math.round(Math.atan2(rawVy, rawVx) / (Math.PI / 4)) * (Math.PI / 4);
        this.aimX = Math.cos(ang);
        this.aimY = Math.sin(ang);
      }

      // Authentic Berzerk mechanic: briefly pause step while firing for surgical corridor shots
      if ((this.input.fire || this.input.fireJustPressed) && this.fireCd <= 0) {
        const activePlayerShots = this.shots.filter((s) => !s.fromEnemy).length;
        if (activePlayerShots < 2) {
          this.fireCd = 0.22;
          arcadeAudio.playLaser(920, 320, 0.065);
          this.shots.push({
            x: this.px + this.aimX * 15,
            y: this.py + this.aimY * 15,
            vx: this.aimX * 520,
            vy: this.aimY * 520,
            fromEnemy: false,
            color: '#4ADE80',
            trail: [],
          });
        }
      }
    }

    const moveStepX = mvx * baseSpeed * safeDt;
    const moveStepY = mvy * baseSpeed * safeDt;
    if (Math.hypot(moveStepX, moveStepY) > 0.1) {
      this.walkPhase += safeDt * 14;
    }

    const nextX = this.px + moveStepX;
    const nextY = this.py + moveStepY;
    if (this.hitsWall(nextX, nextY, 10.5)) {
      if (!attract) {
        this.killPlayer(true);
        return;
      }
    } else {
      this.px = nextX;
      this.py = nextY;
    }

    // Check if Humanoid escaped through one of the open room doorways!
    if (!attract) {
      let exitDir: 'left' | 'right' | 'top' | 'bottom' | null = null;
      if (this.px < 18) exitDir = 'right';
      else if (this.px > W - 18) exitDir = 'left';
      else if (this.py < 18) exitDir = 'bottom';
      else if (this.py > H - 18) exitDir = 'top';

      if (exitDir) {
        const aliveLeft = this.robots.filter((r) => r.dyingTimer <= 0).length;
        if (aliveLeft > 0) {
          const line = VOICE_LINES.chicken[Math.floor(Math.random() * VOICE_LINES.chicken.length)];
          this.sayVoice(line);
        } else {
          const line = VOICE_LINES.intro[Math.floor(Math.random() * VOICE_LINES.intro.length)];
          this.sayVoice(line);
        }
        arcadeAudio.playStageClear();
        this.setupRoom(this.level + 1, exitDir, false);
        this.phase = 'READY';
        this.stateTimer = 0.55;
        return;
      }
    }

    // Check Room Clear Bonus (all robots destroyed!)
    const aliveRobots = this.robots.filter((r) => r.dyingTimer <= 0);
    if (!attract && !this.roomBonusAwarded && this.roomRobotsInitial > 0 && aliveRobots.length === 0) {
      this.roomBonusAwarded = true;
      const bonus = this.roomRobotsInitial * 10;
      this.addScore(bonus, W * 0.5, H * 0.44, '#4ADE80', `ROOM CLEAR BONUS +${bonus}!`);
      arcadeAudio.playPowerUp();
      this.sayVoice(VOICE_LINES.clear[Math.floor(Math.random() * VOICE_LINES.clear.length)]);
    }

    // Step Evil Otto (enters after countdown, bounces straight through walls & crushes robots!)
    if (!attract) {
      if (!this.ottoActive) {
        this.ottoTimer -= safeDt;
        if (this.ottoTimer <= 0) {
          this.ottoActive = true;
          this.ottoX = this.entryX;
          this.ottoY = this.entryY;
          arcadeAudio.playOttoBounce();
          this.sayVoice(VOICE_LINES.otto[0]);
        }
      } else {
        this.ottoBouncePhase += safeDt * 9.5;
        if (Math.sin(this.ottoBouncePhase) < -0.96 && Math.random() < 0.35) {
          arcadeAudio.playOttoBounce();
        }
        // Authentic Berzerk rule: Otto moves FASTER once all robots are gone!
        const ottoSpeed = aliveRobots.length === 0 ? 148 : 88 + Math.min(40, this.level * 3);
        const dx = this.px - this.ottoX;
        const dy = this.py - this.ottoY;
        const d = Math.hypot(dx, dy) || 1;
        this.ottoX += (dx / d) * ottoSpeed * safeDt;
        this.ottoY += (dy / d) * ottoSpeed * safeDt;

        // Otto crushes any robot he bounces onto!
        for (const r of this.robots) {
          if (r.dyingTimer <= 0 && Math.hypot(r.x - this.ottoX, r.y - this.ottoY) < 22) {
            this.destroyRobot(r, false, false);
          }
        }

        if (Math.hypot(this.ottoX - this.px, this.ottoY - this.py) < 20) {
          this.killPlayer(false);
          return;
        }
      }
    }

    // Step Robots (patrol in 8 cardinal/diagonal vectors — can walk into walls or crossfire each other!)
    const tier = this.getTier();
    for (let i = this.robots.length - 1; i >= 0; i--) {
      const r = this.robots[i];
      if (!r) continue;
      if (r.dyingTimer > 0) {
        r.dyingTimer -= safeDt;
        if (r.dyingTimer <= 0) this.robots.splice(i, 1);
        continue;
      }

      const dx = this.px - r.x;
      const dy = this.py - r.y;
      r.eyeAngle = Math.atan2(dy, dx);
      r.stepPhase += safeDt * 7.5;

      // Authentic naive Berzerk AI: steps toward humanoid in 8 directions — can be lured into electrified walls!
      const sx = Math.abs(dx) > 14 ? Math.sign(dx) : 0;
      const sy = Math.abs(dy) > 14 ? Math.sign(dy) : 0;
      const mag = Math.hypot(sx, sy) || 1;
      const nx = r.x + (sx / mag) * tier.speed * safeDt;
      const ny = r.y + (sy / mag) * tier.speed * safeDt;

      if (this.hitsWall(nx, ny, 11.5)) {
        // Classic Berzerk trick: Robot electrocutes itself on the wall!
        this.destroyRobot(r, true, attract);
        continue;
      }
      r.x = nx;
      r.y = ny;

      // Robot-on-robot collision destroys both in sparks!
      for (let k = i - 1; k >= 0; k--) {
        const other = this.robots[k];
        if (other && other.dyingTimer <= 0 && Math.hypot(other.x - r.x, other.y - r.y) < 21) {
          this.destroyRobot(r, false, attract);
          this.destroyRobot(other, false, attract);
          break;
        }
      }
      if (r.dyingTimer > 0) continue;

      // Touching player
      if (!attract && Math.hypot(r.x - this.px, r.y - this.py) < 20) {
        this.destroyRobot(r, false, false);
        this.killPlayer(false);
        return;
      }

      // Robot firing along 8-way alignment with line-of-sight check
      r.fireCd -= safeDt;
      if (r.fireCd <= 0 && r.activeShots < tier.maxShots) {
        const aligned =
          Math.abs(dx) < 22 ||
          Math.abs(dy) < 22 ||
          Math.abs(Math.abs(dx) - Math.abs(dy)) < 24;
        if (aligned && this.hasLineOfSight(r.x, r.y, this.px, this.py)) {
          r.fireCd = tier.fireDelay * (0.8 + Math.random() * 0.4);
          const snapAng = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
          r.activeShots++;
          if (!attract) arcadeAudio.playLaser(560, 220, 0.06);
          this.shots.push({
            x: r.x + Math.cos(snapAng) * 16,
            y: r.y + Math.sin(snapAng) * 16,
            vx: Math.cos(snapAng) * (250 + Math.min(110, this.level * 12)),
            vy: Math.sin(snapAng) * (250 + Math.min(110, this.level * 12)),
            fromEnemy: true,
            ownerId: r.id,
            color: tier.body,
            trail: [],
          });
        } else {
          r.fireCd = 0.25;
        }
      }
    }

    // Step Laser Bolts
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      if (!s) continue;
      s.trail.push({ x: s.x, y: s.y });
      if (s.trail.length > 5) s.trail.shift();
      s.x += s.vx * safeDt;
      s.y += s.vy * safeDt;

      // Wall hit
      if (this.hitsWall(s.x, s.y, 3.5) || s.x < 10 || s.x > W - 10 || s.y < 10 || s.y > H - 10) {
        spawnBurst(this.particles, s.x, s.y, '#60A5FA', 5, 110, 2);
        this.releaseShotOwner(s);
        this.shots.splice(i, 1);
        continue;
      }

      // Evil Otto absorbs shots harmlessly!
      if (this.ottoActive && Math.hypot(s.x - this.ottoX, s.y - this.ottoY) < 16) {
        spawnBurst(this.particles, s.x, s.y, '#FACC15', 4, 90, 2);
        this.releaseShotOwner(s);
        this.shots.splice(i, 1);
        continue;
      }

      // Friendly fire & player shots hitting robots!
      let hitRobot = false;
      for (const r of this.robots) {
        if (r.dyingTimer > 0) continue;
        if (s.fromEnemy && s.ownerId === r.id) continue;
        if (Math.hypot(r.x - s.x, r.y - s.y) < 15) {
          this.destroyRobot(r, false, attract);
          hitRobot = true;
          break;
        }
      }
      if (hitRobot) {
        this.releaseShotOwner(s);
        this.shots.splice(i, 1);
        continue;
      }

      // Enemy bolt hitting player
      if (s.fromEnemy && !attract && Math.hypot(s.x - this.px, s.y - this.py) < 13) {
        this.releaseShotOwner(s);
        this.shots.splice(i, 1);
        this.killPlayer(false);
        return;
      }
    }
  }

  private releaseShotOwner(s: LaserBolt): void {
    if (s.fromEnemy && s.ownerId !== undefined) {
      const owner = this.robots.find((r) => r.id === s.ownerId);
      if (owner && owner.activeShots > 0) owner.activeShots--;
    }
  }

  public getHudSnapshot(): ClassicGameHud {
    const tier = this.getTier();
    const alive = this.robots.filter((r) => r.dyingTimer <= 0).length;
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: `BERZERK · SECTOR ${this.level} (${tier.name} BOTS)`,
      primaryMetricLabel: 'ROBOTS',
      primaryMetricValue: `${alive}/${this.roomRobotsInitial}`,
      secondaryMetricLabel: 'EVIL OTTO',
      secondaryMetricValue: this.ottoActive ? 'HUNTING!' : `${Math.ceil(Math.max(0, this.ottoTimer))}s`,
      bannerText: this.voiceTimer > 0 ? this.voiceText : '',
    };
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.save();
    if (this.shakeTimer > 0) {
      ctx.translate((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9);
    }

    // Deep pitch-black Stern arcade floor with subtle tactical circuit grid
    ctx.fillStyle = '#03050C';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(37, 99, 235, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 26; x < W - 20; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 26);
      ctx.lineTo(x, H - 26);
      ctx.stroke();
    }
    for (let y = 26; y < H - 20; y += 48) {
      ctx.beginPath();
      ctx.moveTo(26, y);
      ctx.lineTo(W - 26, y);
      ctx.stroke();
    }

    // Open Exit Doorway directional chevrons (pulsing emerald exit beacons!)
    const exitGlow = 0.45 + 0.35 * Math.sin(this.clock * 5.5);
    ctx.fillStyle = `rgba(74, 222, 128, ${exitGlow})`;
    ctx.font = '900 13px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    if (this.blockedDoor !== 'left') ctx.fillText('◀ EXIT', 52, H * 0.5 + 4);
    if (this.blockedDoor !== 'right') ctx.fillText('EXIT ▶', W - 52, H * 0.5 + 4);
    if (this.blockedDoor !== 'top') ctx.fillText('▲ EXIT', W * 0.5, 48);
    if (this.blockedDoor !== 'bottom') ctx.fillText('▼ EXIT', W * 0.5, H - 40);

    // Electrified High-Voltage Stern Maze Walls (Multi-layer plasma glow!)
    const pulse = 0.72 + Math.sin(this.clock * 14) * 0.28;
    for (const w of this.walls) {
      // Outer cobalt aura
      ctx.fillStyle = `rgba(37, 99, 235, ${0.26 * pulse})`;
      ctx.fillRect(w.x - 4, w.y - 4, w.w + 8, w.h + 8);
      // Core neon blue wall
      ctx.fillStyle = '#2563EB';
      ctx.fillRect(w.x, w.y, w.w, w.h);
      // Hot inner plasma filament
      ctx.fillStyle = '#93C5FD';
      ctx.fillRect(w.x + 2.5, w.y + 2.5, Math.max(2, w.w - 5), Math.max(2, w.h - 5));
    }

    // Crackling electric wall arcs
    ctx.strokeStyle = '#E0F2FE';
    ctx.lineWidth = 1.6;
    for (const sp of this.sparks) {
      ctx.beginPath();
      ctx.moveTo(sp.x1, sp.y1);
      ctx.lineTo((sp.x1 + sp.x2) * 0.5 + (Math.random() - 0.5) * 8, (sp.y1 + sp.y2) * 0.5 + (Math.random() - 0.5) * 8);
      ctx.lineTo(sp.x2, sp.y2);
      ctx.stroke();
    }

    // Laser Bolts with glowing plasma trails
    for (const s of this.shots) {
      if (s.trail.length > 1) {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 3.2;
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        ctx.moveTo(s.trail[0].x, s.trail[0].y);
        for (const p of s.trail) ctx.lineTo(p.x, p.y);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 3.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Articulated Stern Cyclops Robots!
    const tier = this.getTier();
    for (const r of this.robots) {
      ctx.save();
      ctx.translate(r.x, r.y);
      if (r.dyingTimer > 0) {
        // Electric-shatter death flash
        const flash = Math.floor(this.clock * 40) % 2 === 0;
        ctx.strokeStyle = flash ? '#FFFFFF' : '#38BDF8';
        ctx.lineWidth = 2.4;
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 + this.clock * 10;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * 4, Math.sin(a) * 4);
          ctx.lineTo(Math.cos(a) * 18, Math.sin(a) * 18);
          ctx.stroke();
        }
        ctx.restore();
        continue;
      }

      // Ground shadow
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 15, 11, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      const legSwing = Math.sin(r.stepPhase) * 4;
      // Legs
      ctx.fillStyle = tier.body;
      ctx.fillRect(-7, 6, 4.5, 9 + legSwing * 0.5);
      ctx.fillRect(2.5, 6, 4.5, 9 - legSwing * 0.5);
      // Armored torso
      ctx.beginPath();
      ctx.roundRect(-10, -7, 20, 14, 4);
      ctx.fill();
      // Shoulder cannons/arms
      ctx.fillStyle = tier.trim;
      ctx.fillRect(-13, -4, 3.5, 10);
      ctx.fillRect(9.5, -4, 3.5, 10);
      // Domed Cyclops head
      ctx.fillStyle = tier.body;
      ctx.beginPath();
      ctx.arc(0, -10, 7.5, Math.PI, 0);
      ctx.lineTo(7.5, -6);
      ctx.lineTo(-7.5, -6);
      ctx.closePath();
      ctx.fill();
      // Dark visor slit + glowing scanning crimson eye!
      ctx.fillStyle = '#090D16';
      ctx.fillRect(-6, -12, 12, 4);
      const scanX = Math.cos(r.eyeAngle) * 3.5;
      ctx.fillStyle = '#FF2A55';
      ctx.fillRect(scanX - 2, -11.5, 4, 3);
      ctx.restore();
    }

    // Invincible Bouncing EVIL OTTO!
    if (this.ottoActive) {
      const bounceY = Math.abs(Math.sin(this.ottoBouncePhase)) * 16;
      ctx.save();
      ctx.translate(this.ottoX, this.ottoY);
      // Ground shadow shrinks as Otto bounces up
      ctx.fillStyle = 'rgba(250, 204, 21, 0.25)';
      ctx.beginPath();
      ctx.ellipse(0, 14, Math.max(7, 15 - bounceY * 0.4), 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.translate(0, -bounceY);
      // Glowing menacing smiley ring
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 3.2;
      ctx.fillStyle = 'rgba(250, 204, 21, 0.16)';
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Evil red eyes
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(-5, -4, 2.7, 0, Math.PI * 2);
      ctx.arc(5, -4, 2.7, 0, Math.PI * 2);
      ctx.fill();
      // Wide wicked grin
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(0, 1, 9, 0.2, Math.PI - 0.2);
      ctx.stroke();
      ctx.restore();
    }

    // Articulated Green Stern Humanoid!
    const blinkHide = this.invulnTimer > 0 && Math.floor(this.clock * 18) % 2 === 0 && this.zapDeathTimer <= 0;
    if (!blinkHide) {
      ctx.save();
      ctx.translate(this.px, this.py);
      if (this.zapDeathTimer > 0) {
        // High-voltage electrocution skeleton flash!
        const alt = Math.floor(this.clock * 32) % 2 === 0;
        ctx.strokeStyle = alt ? '#FFFFFF' : '#38BDF8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, -11, 5, 0, Math.PI * 2);
        ctx.moveTo(0, -6);
        ctx.lineTo(0, 6);
        ctx.moveTo(-10, -2);
        ctx.lineTo(10, -2);
        ctx.moveTo(0, 6);
        ctx.lineTo(-7, 15);
        ctx.moveTo(0, 6);
        ctx.lineTo(7, 15);
        ctx.stroke();
      } else {
        const stride = Math.sin(this.walkPhase) * 4.5;
        ctx.strokeStyle = '#4ADE80';
        ctx.lineWidth = 3.6;
        ctx.lineCap = 'round';
        // Head
        ctx.fillStyle = '#86EFAC';
        ctx.beginPath();
        ctx.arc(0, -11, 4.6, 0, Math.PI * 2);
        ctx.fill();
        // Torso
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(0, 5);
        ctx.stroke();
        // Legs
        ctx.beginPath();
        ctx.moveTo(0, 5);
        ctx.lineTo(-5 - stride * 0.5, 15);
        ctx.moveTo(0, 5);
        ctx.lineTo(5 + stride * 0.5, 15);
        ctx.stroke();
        // Aiming laser arm
        ctx.strokeStyle = '#BBF7D0';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, -2);
        ctx.lineTo(this.aimX * 14, -2 + this.aimY * 14);
        ctx.stroke();
        // Subtle targeting laser reticle dot
        if (this.phase === 'PLAYING') {
          ctx.fillStyle = 'rgba(74, 222, 128, 0.55)';
          ctx.beginPath();
          ctx.arc(this.aimX * 26, -2 + this.aimY * 26, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    renderParticlesAndPopups(ctx, this.particles, this.popups);

    // Classic Stern Voice Synthesizer Callout Banner
    if (this.voiceTimer > 0 && this.phase === 'PLAYING') {
      ctx.fillStyle = 'rgba(2, 6, 23, 0.8)';
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(W * 0.5 - 210, 8, 420, 26, 8);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.font = '800 12px "JetBrains Mono", monospace';
      ctx.fillStyle = this.ottoActive ? '#FACC15' : '#93C5FD';
      ctx.fillText(`🔊 "${this.voiceText}"`, W * 0.5, 25);
    }

    if (this.phase === 'TITLE') {
      ctx.fillStyle = 'rgba(3, 5, 12, 0.78)';
      ctx.fillRect(0, H * 0.34, W, 152);
      ctx.textAlign = 'center';
      ctx.font = '900 44px "JetBrains Mono", monospace';
      ctx.fillStyle = '#4ADE80';
      ctx.fillText('BERZERK', W * 0.5, H * 0.34 + 54);
      ctx.font = '700 13px "JetBrains Mono", monospace';
      ctx.fillStyle = '#93C5FD';
      ctx.fillText('1980 STERN · ELECTRIFIED MAZES · ROBOT CROSSFIRE · EVIL OTTO', W * 0.5, H * 0.34 + 88);
      ctx.font = '600 12px "JetBrains Mono", monospace';
      ctx.fillStyle = '#FACC15';
      ctx.fillText('LURE ROBOTS INTO HIGH-VOLTAGE WALLS · ESCAPE BEFORE OTTO BOUNCES IN!', W * 0.5, H * 0.34 + 120);
    }

    ctx.restore();
    if (visualMode === 'crt') renderCrtOverlay(ctx, W, H);
  }
}

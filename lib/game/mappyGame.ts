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
import { drawSoftShadow, drawStarGlint } from './arcadeGfx';

const W = 720;
const H = 640;
const WORLD_W = 1120;
const FLOOR_COUNT = 6;
const FLOOR_SPACING = 88;
const TOP_FLOOR_Y = 128;

const TRAMPOLINE_XS = [165, 425, 695, 955];
const TRAMPOLINE_W = 66;

type LootKind = 'radio' | 'tv' | 'computer' | 'painting' | 'safe';

interface LootItem {
  id: number;
  kind: LootKind;
  floor: number;
  x: number;
  points: number;
  collected: boolean;
  label: string;
}

interface DoorItem {
  id: number;
  floor: number;
  x: number;
  isPower: boolean;
  openDir: -1 | 0 | 1;
  openTimer: number;
  usedPower: boolean;
}

interface MicrowaveBeam {
  floor: number;
  x: number;
  dir: -1 | 1;
  speed: number;
  active: boolean;
  capturedIds: number[];
}

interface Trampoline {
  x: number;
  bounces: number; // 0 green, 1 blue, 2 yellow, 3 red, 4 snapped
  stretch: number;
}

interface AtticBell {
  id: number;
  x: number;
  y: number;
  floor: number;
  state: 'hanging' | 'falling' | 'used';
  vy: number;
  swingPhase: number;
}

interface BonusBalloon {
  id: number;
  x: number;
  y: number;
  isGoro: boolean;
  color: string;
  popped: boolean;
  bobPhase: number;
}

interface MappyCat {
  id: number;
  isGoro: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  floor: number;
  inShaft: number | null;
  dir: -1 | 1;
  state: 'patrol' | 'hiding' | 'stunned' | 'swept' | 'respawning';
  stateTimer: number;
  hideLootId: number | null;
  anim: number;
}

interface GosenzoGhost {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
}

interface MansionTheme {
  name: string;
  wallTop: string;
  wallBot: string;
  stripe: string;
  wainscot: string;
  floorTop: string;
  floorBot: string;
  trim: string;
  accent: string;
  drape: string;
}

const MANSION_THEMES: MansionTheme[] = [
  {
    name: 'ROYAL COBALT PARLOR',
    wallTop: '#0A1632',
    wallBot: '#132752',
    stripe: 'rgba(125,211,252,0.06)',
    wainscot: '#1B3466',
    floorTop: '#92400E',
    floorBot: '#451A03',
    trim: '#F59E0B',
    accent: '#38BDF8',
    drape: '#1D4ED8',
  },
  {
    name: 'CRIMSON VELVET BALLROOM',
    wallTop: '#240812',
    wallBot: '#450F20',
    stripe: 'rgba(251,113,133,0.07)',
    wainscot: '#581529',
    floorTop: '#78350F',
    floorBot: '#3B1606',
    trim: '#FBBF24',
    accent: '#FB7185',
    drape: '#9F1239',
  },
  {
    name: 'EMERALD CONSERVATORY',
    wallTop: '#062019',
    wallBot: '#0D3A2D',
    stripe: 'rgba(52,211,153,0.07)',
    wainscot: '#134E3C',
    floorTop: '#854D0E',
    floorBot: '#422006',
    trim: '#34D399',
    accent: '#6EE7B7',
    drape: '#047857',
  },
  {
    name: 'GOLDEN PENTHOUSE SALON',
    wallTop: '#1F1606',
    wallBot: '#3D2A0B',
    stripe: 'rgba(250,204,21,0.07)',
    wainscot: '#53380E',
    floorTop: '#991B1B',
    floorBot: '#450A0A',
    trim: '#FDE047',
    accent: '#FACC15',
    drape: '#B45309',
  },
];

const LOOT_POINTS: Record<LootKind, number> = {
  radio: 100,
  tv: 200,
  computer: 300,
  painting: 400,
  safe: 500,
};

const LOOT_LABELS: Record<LootKind, string> = {
  radio: 'RADIO',
  tv: 'TV',
  computer: 'PC',
  painting: 'MONA',
  safe: 'SAFE',
};

function floorY(floorIndex: number): number {
  return TOP_FLOOR_Y + floorIndex * FLOOR_SPACING;
}

export class MappyGame implements ArcadeGameInstance {
  public readonly logicalWidth = W;
  public readonly logicalHeight = H;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'SLAM / WAVE';
  public readonly secondaryActionLabel = 'BELL / DOOR';

  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();
  private score = 0;
  private highScore = 0;
  private level = 1;
  private lives = 3;
  private nextExtraLifeScore = 20000;
  private time = 0;
  private phaseTimer = 0;
  private roundClock = 0;
  private hurryTriggered = false;
  private bannerText = 'PRESS PLAY OR SPACE TO ENTER THE MANSION';

  private isBonusRound = false;
  private bonusTimer = 20;
  private balloons: BonusBalloon[] = [];
  private bells: AtticBell[] = [];
  private gosenzo: GosenzoGhost = { active: false, x: 0, y: 0, vx: 0, vy: 0, spin: 0 };

  // Mappy player
  private px = WORLD_W / 2;
  private py = floorY(5);
  private pvx = 0;
  private pvy = 0;
  private pFloor = 5;
  private pShaft: number | null = null;
  private pDir: -1 | 1 = 1;
  private pInvuln = 0;
  private pAnim = 0;
  private cameraX = (WORLD_W - W) / 2;

  private loots: LootItem[] = [];
  private doors: DoorItem[] = [];
  private beams: MicrowaveBeam[] = [];
  private trampolines: Trampoline[] = [];
  private cats: MappyCat[] = [];
  private nextCatId = 1;

  private pendingPairKind: LootKind | null = null;
  private pairMultiplier = 1;
  private pairBannerTimer = 0;
  private screenShake = 0;

  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  constructor() {
    this.highScore = readHighScore('arcade_hs_mappy');
    this.setupMansion(1);
  }

  private getTheme(): MansionTheme {
    return MANSION_THEMES[(this.level - 1) % MANSION_THEMES.length];
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public startNewGame(): void {
    arcadeAudio.unlock();
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.nextExtraLifeScore = 20000;
    this.particles = [];
    this.popups = [];
    this.setupMansion(1);
    this.phase = 'READY';
    this.phaseTimer = 1.45;
    this.bannerText = 'ROUND 1 · ROYAL COBALT PARLOR!';
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') {
      this.phase = 'PAUSED';
      this.bannerText = 'PAUSED';
    } else if (this.phase === 'PAUSED') {
      this.phase = 'PLAYING';
      this.bannerText = '';
    }
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.setupMansion(1);
    this.bannerText = 'PRESS PLAY OR SPACE TO ENTER THE MANSION';
  }

  public getHudSnapshot(): ClassicGameHud {
    const remainingLoot = this.isBonusRound
      ? this.balloons.filter((b) => !b.popped).length
      : this.loots.filter((l) => !l.collected).length;
    const theme = this.getTheme();
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: this.isBonusRound
        ? `ROUND ${this.level} · BALLOON BONUS!`
        : `RD ${this.level} · ${theme.name}`,
      primaryMetricLabel: this.isBonusRound ? 'BALLOONS' : 'LOOT LEFT',
      primaryMetricValue: this.isBonusRound
        ? `${remainingLoot}/${this.balloons.length}`
        : `${remainingLoot}/10`,
      secondaryMetricLabel: this.isBonusRound ? 'BONUS TIME' : 'PAIR MULT',
      secondaryMetricValue: this.isBonusRound
        ? `${Math.ceil(Math.max(0, this.bonusTimer))}s`
        : `${this.pairMultiplier}×`,
      bannerText: this.bannerText,
    };
  }

  private addScore(points: number, x?: number, y?: number, color = '#FACC15', label?: string): void {
    this.score += points;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore('arcade_hs_mappy', this.highScore);
    }
    if (this.score >= this.nextExtraLifeScore) {
      this.lives = Math.min(5, this.lives + 1);
      this.nextExtraLifeScore += 30000;
      arcadeAudio.playExtraLife();
      this.popups.push({
        x: this.px,
        y: this.py - 34,
        text: '1UP!',
        color: '#4ADE80',
        life: 1.5,
        maxLife: 1.5,
      });
    }
    if (x !== undefined && y !== undefined) {
      this.popups.push({
        x,
        y,
        text: label ?? `+${points}`,
        color,
        life: 1.0,
        maxLife: 1.0,
      });
    }
  }

  private setupMansion(lvl: number): void {
    this.level = lvl;
    this.isBonusRound = lvl > 1 && lvl % 3 === 0;
    this.beams = [];
    this.pendingPairKind = null;
    this.pairMultiplier = 1;
    this.pairBannerTimer = 0;
    this.roundClock = 0;
    this.hurryTriggered = false;
    this.gosenzo = { active: false, x: 40, y: 110, vx: 110, vy: 55, spin: 0 };

    // 4 vertical trampoline shafts
    this.trampolines = TRAMPOLINE_XS.map((x) => ({
      x,
      bounces: 0,
      stretch: 0,
    }));

    this.px = 560;
    this.pFloor = 5;
    this.py = floorY(5);
    this.pvx = 0;
    this.pvy = 0;
    this.pShaft = null;
    this.pDir = 1;
    this.pInvuln = 1.6;
    this.cameraX = Math.max(0, Math.min(WORLD_W - W, this.px - W / 2));

    if (this.isBonusRound) {
      this.bonusTimer = 20;
      this.loots = [];
      this.doors = [];
      this.cats = [];
      this.bells = [];
      this.balloons = [];
      const colors = ['#EF4444', '#F97316', '#FACC15', '#38BDF8', '#A855F7', '#EC4899'];
      let bid = 1;
      // Place 15 colorful festive balloons across shafts and corridors + 1 Giant Goro Balloon on top floor
      const spots: Array<{ x: number; y: number; goro?: boolean }> = [
        { x: 165, y: floorY(4) - 24 },
        { x: 165, y: floorY(2) - 24 },
        { x: 165, y: floorY(0) - 24 },
        { x: 295, y: floorY(3) - 22 },
        { x: 295, y: floorY(1) - 22 },
        { x: 425, y: floorY(4) - 24 },
        { x: 425, y: floorY(2) - 24 },
        { x: 425, y: floorY(0) - 24 },
        { x: 560, y: floorY(3) - 22 },
        { x: 560, y: floorY(0) - 28, goro: true },
        { x: 695, y: floorY(4) - 24 },
        { x: 695, y: floorY(2) - 24 },
        { x: 695, y: floorY(0) - 24 },
        { x: 825, y: floorY(3) - 22 },
        { x: 955, y: floorY(3) - 24 },
        { x: 955, y: floorY(1) - 24 },
      ];
      for (const s of spots) {
        this.balloons.push({
          id: bid,
          x: s.x,
          y: s.y,
          isGoro: Boolean(s.goro),
          color: colors[bid % colors.length],
          popped: false,
          bobPhase: bid * 0.65,
        });
        bid++;
      }
      return;
    }

    this.balloons = [];

    // 10 paired stolen treasures (2 of each kind) — shift positions slightly by round for variety
    const shift = (lvl % 2) * 18 - 9;
    const lootSpecs: Array<{ kind: LootKind; floor: number; x: number }> = [
      { kind: 'radio', floor: 4, x: 280 + shift },
      { kind: 'radio', floor: 4, x: 840 - shift },
      { kind: 'tv', floor: 3, x: 295 - shift },
      { kind: 'tv', floor: 3, x: 830 + shift },
      { kind: 'computer', floor: 2, x: 555 + shift },
      { kind: 'computer', floor: 2, x: 1030 },
      { kind: 'painting', floor: 1, x: 85 },
      { kind: 'painting', floor: 1, x: 560 - shift },
      { kind: 'safe', floor: 0, x: 295 + shift },
      { kind: 'safe', floor: 0, x: 825 - shift },
    ];
    this.loots = lootSpecs.map((spec, idx) => ({
      id: idx + 1,
      kind: spec.kind,
      floor: spec.floor,
      x: spec.x,
      points: LOOT_POINTS[spec.kind],
      collected: false,
      label: LOOT_LABELS[spec.kind],
    }));

    // Doors (regular wooden + flashing Microwave power doors)
    const doorSpecs: Array<{ floor: number; x: number; isPower: boolean }> = [
      { floor: 5, x: 300, isPower: false },
      { floor: 5, x: 820, isPower: false },
      { floor: 4, x: 560, isPower: true },
      { floor: 3, x: 550, isPower: false },
      { floor: 3, x: 1020, isPower: true },
      { floor: 2, x: 290, isPower: true },
      { floor: 2, x: 830, isPower: false },
      { floor: 1, x: 295, isPower: false },
      { floor: 1, x: 825, isPower: true },
      { floor: 0, x: 560, isPower: false },
    ];
    this.doors = doorSpecs.map((d, idx) => ({
      id: idx + 1,
      floor: d.floor,
      x: d.x,
      isPower: d.isPower,
      openDir: 0,
      openTimer: 0,
      usedPower: false,
    }));

    // Attic Brass Bells (Round 2+: drop onto cats for stun & +500!)
    this.bells = [];
    if (lvl >= 2) {
      const bellSpots = [
        { x: 295, floor: 0 },
        { x: 560, floor: 1 },
        { x: 825, floor: 0 },
      ];
      bellSpots.forEach((b, idx) => {
        this.bells.push({
          id: idx + 1,
          x: b.x,
          y: floorY(b.floor) - 54,
          floor: b.floor,
          state: 'hanging',
          vy: 0,
          swingPhase: idx * 1.4,
        });
      });
    }

    // Spawn Boss Big Goro + Meowky cats
    this.cats = [];
    this.nextCatId = 1;
    const meowkyCount = Math.min(6, 3 + Math.floor(lvl * 0.7));
    this.cats.push({
      id: this.nextCatId++,
      isGoro: true,
      x: 560,
      y: floorY(0),
      vx: 0,
      vy: 0,
      floor: 0,
      inShaft: null,
      dir: 1,
      state: 'patrol',
      stateTimer: 0,
      hideLootId: null,
      anim: 0,
    });
    for (let i = 0; i < meowkyCount; i++) {
      const fl = i % 3;
      const sx = i % 2 === 0 ? 92 + i * 32 : WORLD_W - 92 - i * 32;
      this.cats.push({
        id: this.nextCatId++,
        isGoro: false,
        x: sx,
        y: floorY(fl),
        vx: 0,
        vy: 0,
        floor: fl,
        inShaft: null,
        dir: i % 2 === 0 ? 1 : -1,
        state: 'patrol',
        stateTimer: 0,
        hideLootId: null,
        anim: i * 0.8,
      });
    }
  }

  private isOverShaft(x: number): number | null {
    for (let i = 0; i < TRAMPOLINE_XS.length; i++) {
      if (Math.abs(x - TRAMPOLINE_XS[i]) < TRAMPOLINE_W * 0.44) {
        return i;
      }
    }
    return null;
  }

  public step(dt: number): void {
    this.time += dt;
    if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - dt * 20);
    if (this.pairBannerTimer > 0) this.pairBannerTimer = Math.max(0, this.pairBannerTimer - dt);

    if (this.phase === 'PAUSED') return;

    if (this.phase === 'TITLE') {
      this.cameraX = ((Math.sin(this.time * 0.35) + 1) * 0.5) * (WORLD_W - W);
      if (this.input.fireJustPressed) {
        this.startNewGame();
      }
      return;
    }

    if (this.phase === 'READY') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.phase = 'PLAYING';
        this.bannerText = '';
      }
      return;
    }

    if (this.phase === 'STAGE_CLEAR') {
      stepParticlesAndPopups(this.particles, this.popups, dt);
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.setupMansion(this.level + 1);
        this.phase = 'READY';
        this.phaseTimer = 1.45;
        this.bannerText = this.isBonusRound
          ? `ROUND ${this.level} · BALLOON BONUS STAGE!`
          : `ROUND ${this.level} · ${this.getTheme().name}`;
      }
      return;
    }

    if (this.phase === 'GAME_OVER') {
      stepParticlesAndPopups(this.particles, this.popups, dt);
      if (this.input.fireJustPressed) {
        this.startNewGame();
      }
      return;
    }

    // PLAYING
    if (this.pInvuln > 0) this.pInvuln = Math.max(0, this.pInvuln - dt);

    if (this.isBonusRound) {
      this.bonusTimer -= dt;
      this.stepPlayer(dt);
      this.stepBonusBalloons(dt);
      for (const tr of this.trampolines) {
        tr.stretch = Math.max(0, tr.stretch - dt * 5);
      }
      const targetCam = Math.max(0, Math.min(WORLD_W - W, this.px - W * 0.5));
      this.cameraX += (targetCam - this.cameraX) * Math.min(1, dt * 8);
      stepParticlesAndPopups(this.particles, this.popups, dt);

      const remaining = this.balloons.filter((b) => !b.popped).length;
      if (remaining === 0 || this.bonusTimer <= 0) {
        this.phase = 'STAGE_CLEAR';
        this.phaseTimer = 2.0;
        if (remaining === 0) {
          this.addScore(5000, this.px, this.py - 36, '#FACC15', 'PERFECT +5000!');
          this.bannerText = 'PERFECT BONUS! +5,000 PTS';
        } else {
          this.bannerText = 'BONUS TIME UP!';
        }
        arcadeAudio.playStageClear();
      }
      return;
    }

    // Standard Mansion Round
    this.roundClock += dt;
    if (!this.hurryTriggered && this.roundClock >= 45) {
      this.hurryTriggered = true;
      arcadeAudio.playSirenSweep();
      this.bannerText = 'HURRY UP!';
      this.popups.push({
        x: this.px,
        y: this.py - 40,
        text: 'HURRY UP!',
        color: '#F87171',
        life: 1.6,
        maxLife: 1.6,
      });
    }
    if (this.roundClock >= 65 && !this.gosenzo.active) {
      this.gosenzo = {
        active: true,
        x: this.px > WORLD_W * 0.5 ? 50 : WORLD_W - 50,
        y: TOP_FLOOR_Y - 12,
        vx: 118,
        vy: 64,
        spin: 0,
      };
      this.bannerText = 'GOSENZO COIN INCOMING!';
      arcadeAudio.playBellClang();
    }
    if (this.bannerText && this.roundClock > 48 && this.roundClock < 64) {
      this.bannerText = '';
    }

    this.stepPlayer(dt);
    this.stepDoorsAndBeams(dt);
    this.stepBells(dt);
    this.stepCats(dt);
    this.stepGosenzo(dt);
    this.stepLootPickup();

    for (const tr of this.trampolines) {
      tr.stretch = Math.max(0, tr.stretch - dt * 5);
    }

    const targetCam = Math.max(0, Math.min(WORLD_W - W, this.px - W * 0.5));
    this.cameraX += (targetCam - this.cameraX) * Math.min(1, dt * 8);

    stepParticlesAndPopups(this.particles, this.popups, dt);

    if (this.loots.every((l) => l.collected)) {
      this.phase = 'STAGE_CLEAR';
      this.phaseTimer = 1.9;
      const bonus = 1000 * this.level;
      this.addScore(bonus, this.px, this.py - 32, '#4ADE80', `CLEAR +${bonus}`);
      this.bannerText = `MANSION ${this.level} CLEARED! +${bonus}`;
      arcadeAudio.playStageClear();
    }
  }

  private stepBonusBalloons(dt: number): void {
    for (const b of this.balloons) {
      if (b.popped) continue;
      b.bobPhase += dt * 3.4;
      const by = b.y + Math.sin(b.bobPhase) * 6;
      const hitR = b.isGoro ? 34 : 24;
      if (Math.hypot(this.px - b.x, this.py - 16 - by) < hitR) {
        b.popped = true;
        arcadeAudio.playBalloonPop();
        const pts = b.isGoro ? 2000 : 200;
        this.addScore(pts, b.x, by, b.isGoro ? '#FACC15' : '#38BDF8', b.isGoro ? 'GORO +2000!' : '+200');
        spawnBurst(this.particles, b.x, by, b.isGoro ? '#FACC15' : b.color, b.isGoro ? 26 : 14, 200, 3.8);
      }
    }
  }

  private stepPlayer(dt: number): void {
    const moveVec = getPrecisionMoveVector(this.input);
    const speed = 225 * moveVec.scale;
    const rawH = moveVec.vx;
    const moveDir = rawH < -0.15 ? -1 : rawH > 0.15 ? 1 : 0;

    if (this.pShaft === null) {
      // Running on a solid floor
      if (moveDir !== 0) {
        this.pDir = moveDir;
        const nextX = this.px + rawH * 225 * dt;
        if (!this.isBlockedByClosedDoor(this.pFloor, this.px, nextX)) {
          this.px = Math.max(26, Math.min(WORLD_W - 26, nextX));
        }
        this.pAnim += dt * 15 * Math.abs(rawH);
      }

      // Check stepping into a trampoline shaft
      const shaft = this.isOverShaft(this.px);
      if (shaft !== null) {
        this.pShaft = shaft;
        this.px = TRAMPOLINE_XS[shaft];
        this.pvy = 45;
        this.trampolines[shaft].bounces = 0;
      }

      // Slam / trigger doors or drop overhead bell
      if (this.input.fireJustPressed || this.input.secondaryJustPressed) {
        const droppedBell = this.tryDropNearbyBell();
        if (!droppedBell) {
          this.tryTriggerNearbyDoor();
        }
      }
    } else {
      // Airborne in trampoline shaft! (Safe from Meowkies & Big Goro while airborne)
      const shaftIdx = this.pShaft;
      const tr = this.trampolines[shaftIdx];

      this.pvy += 860 * dt;
      this.py += this.pvy * dt;
      this.pAnim += dt * 10;

      // Check exiting onto any floor near peak or while moving left/right
      if (moveDir !== 0) {
        this.pDir = moveDir;
        for (let f = 0; f < FLOOR_COUNT; f++) {
          const fy = floorY(f);
          if (Math.abs(this.py - fy) < 20) {
            this.pShaft = null;
            this.pFloor = f;
            this.py = fy;
            this.pvy = 0;
            this.px = TRAMPOLINE_XS[shaftIdx] + moveDir * (TRAMPOLINE_W * 0.56);
            tr.bounces = 0;
            return;
          }
        }
      }

      // Ceiling bounce at top attic
      if (this.py < TOP_FLOOR_Y - 40) {
        this.py = TOP_FLOOR_Y - 40;
        this.pvy = Math.abs(this.pvy) * 0.3;
      }

      // Hit trampoline at bottom floor
      const bottomY = floorY(5) + 12;
      if (this.py >= bottomY) {
        if (tr.bounces >= 3 && !this.isBonusRound) {
          // Trampoline SNAPS on 4th consecutive bounce!
          tr.bounces = 4;
          arcadeAudio.playDoorSlam();
          spawnBurst(this.particles, tr.x, bottomY, '#EF4444', 18, 200, 3.6);
          this.popups.push({
            x: tr.x,
            y: bottomY - 22,
            text: 'SNAP!',
            color: '#EF4444',
            life: 1.0,
            maxLife: 1.0,
          });
          this.damagePlayer();
          return;
        }
        tr.bounces = this.isBonusRound ? Math.min(2, tr.bounces + 1) : tr.bounces + 1;
        tr.stretch = 1;
        this.py = bottomY - 2;
        this.pvy = -885; // High enough to bounce all the way to the top floor!
        arcadeAudio.playTrampolineBoing(tr.bounces);
        spawnBurst(this.particles, tr.x, bottomY, '#38BDF8', 8, 120, 2.4);
      }

      // Allow triggering attic bell from shaft apex too
      if (this.input.secondaryJustPressed || this.input.fireJustPressed) {
        this.tryDropNearbyBell();
      }
      // Subtle horizontal drift clamp inside shaft
      this.pvx = speed * 0;
    }
  }

  private tryDropNearbyBell(): boolean {
    for (const b of this.bells) {
      if (b.state !== 'hanging') continue;
      if (Math.abs(this.px - b.x) < 42 && Math.abs(this.py - floorY(b.floor)) < 56) {
        b.state = 'falling';
        b.vy = 140;
        arcadeAudio.playBellClang();
        spawnBurst(this.particles, b.x, b.y, '#FACC15', 14, 150, 3.2);
        return true;
      }
    }
    return false;
  }

  private stepBells(dt: number): void {
    for (const b of this.bells) {
      b.swingPhase += dt * 2.4;
      if (b.state !== 'falling') continue;
      b.vy += 900 * dt;
      b.y += b.vy * dt;

      // Knock out any cats hit on the way down!
      for (const cat of this.cats) {
        if (cat.state === 'respawning' || cat.state === 'swept') continue;
        if (Math.hypot(cat.x - b.x, cat.y - 16 - b.y) < 34) {
          cat.state = 'stunned';
          cat.stateTimer = 4.2;
          const pts = cat.isGoro ? 1000 : 500;
          this.addScore(pts, cat.x, cat.y - 24, '#FACC15', `BELL +${pts}!`);
          spawnBurst(this.particles, cat.x, cat.y - 14, '#FACC15', 16, 180, 3.4);
          this.screenShake = 4;
        }
      }

      if (b.y > floorY(5) + 18) {
        b.state = 'used';
        spawnBurst(this.particles, b.x, floorY(5) + 8, '#F59E0B', 14, 150, 3);
      }
    }
  }

  private isBlockedByClosedDoor(floor: number, curX: number, nextX: number): boolean {
    for (const d of this.doors) {
      if (d.floor !== floor || d.openDir !== 0) continue;
      if ((curX <= d.x - 8 && nextX > d.x - 10) || (curX >= d.x + 8 && nextX < d.x + 10)) {
        return true;
      }
    }
    return false;
  }

  private tryTriggerNearbyDoor(): void {
    let bestDoor: DoorItem | null = null;
    let bestDist = 52;
    for (const d of this.doors) {
      if (d.floor !== this.pFloor) continue;
      const dist = Math.abs(d.x - this.px);
      if (dist < bestDist) {
        bestDist = dist;
        bestDoor = d;
      }
    }
    if (!bestDoor) return;

    const pushDir: -1 | 1 = this.px <= bestDoor.x ? 1 : -1;
    bestDoor.openDir = pushDir;
    bestDoor.openTimer = 3.2;

    if (bestDoor.isPower && !bestDoor.usedPower) {
      bestDoor.usedPower = true;
      arcadeAudio.playMicrowave();
      this.screenShake = 5;
      this.beams.push({
        floor: bestDoor.floor,
        x: bestDoor.x + pushDir * 14,
        dir: pushDir,
        speed: 440,
        active: true,
        capturedIds: [],
      });
      spawnBurst(this.particles, bestDoor.x, floorY(bestDoor.floor) - 24, '#38BDF8', 18, 220, 3.5);
    } else {
      arcadeAudio.playDoorSlam();
      for (const cat of this.cats) {
        if (cat.state === 'respawning' || cat.state === 'swept') continue;
        if (cat.floor === bestDoor.floor && cat.inShaft === null) {
          const dx = cat.x - bestDoor.x;
          if (Math.sign(dx) === pushDir && Math.abs(dx) < 58) {
            cat.state = 'stunned';
            cat.stateTimer = 2.6;
            cat.x += pushDir * 24;
            this.addScore(150, cat.x, cat.y - 24, '#38BDF8', 'SLAM +150');
            spawnBurst(this.particles, cat.x, cat.y - 16, '#FACC15', 10, 140, 2.8);
          }
        }
      }
    }
  }

  private stepDoorsAndBeams(dt: number): void {
    for (const d of this.doors) {
      if (d.openTimer > 0) {
        d.openTimer -= dt;
        if (d.openTimer <= 0) {
          d.openDir = 0;
        }
      }
    }

    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.x += b.dir * b.speed * dt;

      for (const cat of this.cats) {
        if (cat.state === 'respawning' || cat.state === 'swept') continue;
        if (cat.floor === b.floor && Math.abs(cat.x - b.x) < 28) {
          cat.state = 'swept';
          cat.inShaft = null;
          if (!b.capturedIds.includes(cat.id)) {
            b.capturedIds.push(cat.id);
          }
        }
      }

      for (const cid of b.capturedIds) {
        const cat = this.cats.find((c) => c.id === cid);
        if (cat && cat.state === 'swept') {
          cat.x = b.x + b.dir * 8;
          cat.y = floorY(b.floor);
        }
      }

      if (b.x < -30 || b.x > WORLD_W + 30) {
        const count = b.capturedIds.length;
        if (count > 0) {
          const hasGoro = b.capturedIds.some((id) => this.cats.find((c) => c.id === id)?.isGoro);
          const pts = count * 400 + (hasGoro ? 800 : 0);
          const popupX = Math.max(60, Math.min(WORLD_W - 60, b.x));
          this.addScore(pts, popupX, floorY(b.floor) - 24, '#38BDF8', `WAVE ×${count} +${pts}`);
          for (const cid of b.capturedIds) {
            const cat = this.cats.find((c) => c.id === cid);
            if (cat) {
              cat.state = 'respawning';
              cat.stateTimer = 4.5;
              cat.x = 560;
              cat.floor = 0;
              cat.y = floorY(0);
            }
          }
        }
        this.beams.splice(i, 1);
      }
    }
  }

  private stepCats(dt: number): void {
    const hurryBoost = this.hurryTriggered ? 1.24 : 1.0;

    for (const cat of this.cats) {
      cat.anim += dt * (cat.isGoro ? 9 : 12);

      if (cat.state === 'swept') continue;

      if (cat.state === 'respawning' || cat.state === 'stunned') {
        cat.stateTimer -= dt;
        if (cat.stateTimer <= 0) {
          cat.state = 'patrol';
          cat.hideLootId = null;
        }
        continue;
      }

      if (cat.state === 'hiding') {
        cat.stateTimer -= dt;
        if (cat.stateTimer <= 0) {
          cat.state = 'patrol';
          cat.hideLootId = null;
        }
        continue;
      }

      const spd = (cat.isGoro ? 116 + this.level * 10 : 126 + this.level * 12) * hurryBoost;

      if (cat.inShaft !== null) {
        const sIdx = cat.inShaft;
        cat.vy += 820 * dt;
        cat.y += cat.vy * dt;

        const fy = floorY(this.pFloor);
        if (Math.abs(cat.y - fy) < 15 && Math.random() < 0.25) {
          cat.inShaft = null;
          cat.floor = this.pFloor;
          cat.y = fy;
          cat.vy = 0;
          cat.dir = this.px >= cat.x ? 1 : -1;
          cat.x = TRAMPOLINE_XS[sIdx] + cat.dir * (TRAMPOLINE_W * 0.54);
          continue;
        }

        const botY = floorY(5) + 12;
        if (cat.y >= botY) {
          cat.y = botY - 2;
          cat.vy = -840;
          this.trampolines[sIdx].stretch = 0.7;
        }
        if (cat.y < TOP_FLOOR_Y - 30) {
          cat.y = TOP_FLOOR_Y - 30;
          cat.vy = 90;
        }
      } else {
        if (cat.floor === this.pFloor) {
          cat.dir = this.px >= cat.x ? 1 : -1;
        }

        const nextX = cat.x + cat.dir * spd * dt;
        let blocked = false;
        if (nextX < 28 || nextX > WORLD_W - 28) blocked = true;
        if (this.isBlockedByClosedDoor(cat.floor, cat.x, nextX)) blocked = true;

        if (blocked) {
          cat.dir = (cat.dir * -1) as -1 | 1;
        } else {
          cat.x = nextX;
        }

        const shaft = this.isOverShaft(cat.x);
        if (shaft !== null && (cat.floor !== this.pFloor || Math.random() < 0.03)) {
          cat.inShaft = shaft;
          cat.x = TRAMPOLINE_XS[shaft];
          cat.vy = 20;
        }

        if (cat.isGoro && Math.random() < dt * 0.3) {
          const nearbyLoot = this.loots.find(
            (l) => !l.collected && l.floor === cat.floor && Math.abs(l.x - cat.x) < 18
          );
          if (nearbyLoot) {
            cat.state = 'hiding';
            cat.stateTimer = 2.6;
            cat.hideLootId = nearbyLoot.id;
            cat.x = nearbyLoot.x;
          }
        }
      }

      if (
        this.pShaft === null &&
        cat.inShaft === null &&
        cat.floor === this.pFloor &&
        this.pInvuln <= 0 &&
        Math.abs(cat.x - this.px) < 22
      ) {
        this.damagePlayer();
        return;
      }
    }
  }

  private stepGosenzo(dt: number): void {
    if (!this.gosenzo.active) return;
    this.gosenzo.spin += dt * 8;
    const dx = this.px - this.gosenzo.x;
    const dy = this.py - 16 - this.gosenzo.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const speed = 132 + this.level * 6;
    this.gosenzo.vx += ((dx / dist) * speed - this.gosenzo.vx) * Math.min(1, dt * 2.4);
    this.gosenzo.vy += ((dy / dist) * speed - this.gosenzo.vy) * Math.min(1, dt * 2.4);
    this.gosenzo.x += this.gosenzo.vx * dt;
    this.gosenzo.y += this.gosenzo.vy * dt;

    if (this.pInvuln <= 0 && Math.hypot(this.gosenzo.x - this.px, this.gosenzo.y - (this.py - 16)) < 24) {
      this.damagePlayer();
    }
  }

  private stepLootPickup(): void {
    if (this.pShaft !== null) return;
    for (const item of this.loots) {
      if (item.collected || item.floor !== this.pFloor) continue;
      if (Math.abs(item.x - this.px) < 24) {
        item.collected = true;
        arcadeAudio.playCoin();

        const goroBehind = this.cats.find(
          (c) => c.isGoro && c.state === 'hiding' && c.hideLootId === item.id
        );
        let pts = item.points;
        let label = `+${pts}`;
        let color = '#FACC15';

        if (this.pendingPairKind === item.kind) {
          this.pairMultiplier = Math.min(6, this.pairMultiplier + 1);
          pts = item.points * this.pairMultiplier;
          label = `PAIR ${this.pairMultiplier}× +${pts}!`;
          color = '#4ADE80';
          this.pendingPairKind = null;
          this.pairBannerTimer = 1.6;
          arcadeAudio.playPowerPellet();
        } else {
          this.pendingPairKind = item.kind;
        }

        if (goroBehind) {
          pts += 1000;
          label = `GORO BONUS +${pts}!`;
          color = '#F97316';
          goroBehind.state = 'stunned';
          goroBehind.stateTimer = 2.0;
          goroBehind.hideLootId = null;
          arcadeAudio.playStageClear();
        }

        this.addScore(pts, item.x, floorY(item.floor) - 26, color, label);
        spawnBurst(this.particles, item.x, floorY(item.floor) - 18, color, 16, 180, 3.2);
      }
    }
  }

  private damagePlayer(): void {
    arcadeAudio.playDeath();
    spawnBurst(this.particles, this.px, this.py - 16, '#38BDF8', 22, 230, 3.6);
    this.screenShake = 8;
    this.lives -= 1;
    if (this.lives <= 0) {
      this.phase = 'GAME_OVER';
      this.bannerText = 'GAME OVER · PRESS PLAY TO RETRY';
      return;
    }

    this.px = 560;
    this.pFloor = 5;
    this.py = floorY(5);
    this.pShaft = null;
    this.pvy = 0;
    this.pInvuln = 2.2;
    this.gosenzo.active = false;
    this.roundClock = Math.min(this.roundClock, 42);
    for (const tr of this.trampolines) {
      tr.bounces = 0;
    }
    this.cats.forEach((cat, idx) => {
      cat.floor = idx % 2;
      cat.y = floorY(cat.floor);
      cat.inShaft = null;
      cat.state = 'patrol';
      cat.x = idx % 2 === 0 ? 110 + idx * 40 : WORLD_W - 110 - idx * 40;
    });
    this.phase = 'READY';
    this.phaseTimer = 1.25;
    this.bannerText = 'GET READY, OFFICER MAPPY!';
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.save();
    ctx.scale(dpr, dpr);

    const shakeX = this.screenShake > 0 ? (Math.random() - 0.5) * this.screenShake : 0;
    const shakeY = this.screenShake > 0 ? (Math.random() - 0.5) * this.screenShake : 0;

    const theme = this.getTheme();

    // Rich Victorian Mansion Wallpaper backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    if (this.isBonusRound) {
      bgGrad.addColorStop(0, '#1E1B4B');
      bgGrad.addColorStop(0.5, '#312E81');
      bgGrad.addColorStop(1, '#1E1B4B');
    } else {
      bgGrad.addColorStop(0, theme.wallTop);
      bgGrad.addColorStop(1, theme.wallBot);
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(-this.cameraX + shakeX, shakeY);

    // Wallpaper damask vertical stripes & decorative wainscoting
    ctx.fillStyle = this.isBonusRound ? 'rgba(250,204,21,0.06)' : theme.stripe;
    for (let x = 0; x < WORLD_W; x += 28) {
      ctx.fillRect(x, 42, 6, H - 50);
    }

    // Gilded Mansion Roof & Attic Crest
    ctx.fillStyle = this.isBonusRound ? '#3730A3' : '#1E293B';
    ctx.fillRect(0, 38, WORLD_W, 24);
    ctx.fillStyle = theme.trim;
    ctx.fillRect(0, 60, WORLD_W, 4);

    // Chandeliers & gilded wall frames per floor
    for (let f = 0; f < FLOOR_COUNT; f++) {
      const fy = floorY(f);
      // Wainscoting band
      ctx.fillStyle = this.isBonusRound ? 'rgba(250,204,21,0.08)' : theme.wainscot;
      ctx.fillRect(10, fy - 24, WORLD_W - 20, 24);

      // Decorative gilded picture frames between shafts
      for (const px of [95, 295, 560, 825, 1030]) {
        if ((f + Math.floor(px / 100)) % 2 === 0) {
          ctx.fillStyle = 'rgba(15,23,42,0.55)';
          ctx.fillRect(px - 16, fy - 56, 32, 24);
          ctx.strokeStyle = theme.trim;
          ctx.lineWidth = 1.6;
          ctx.strokeRect(px - 16, fy - 56, 32, 24);
          // Mini chandelier bulb above
          if (f > 0 && f < 5) {
            ctx.fillStyle = '#FEF08A';
            ctx.beginPath();
            ctx.arc(px, fy - 76, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    // Draw dark vertical trampoline shafts with glowing safety rails
    for (const sx of TRAMPOLINE_XS) {
      const shaftGrad = ctx.createLinearGradient(sx - TRAMPOLINE_W / 2, 0, sx + TRAMPOLINE_W / 2, 0);
      shaftGrad.addColorStop(0, '#020617');
      shaftGrad.addColorStop(0.5, '#0F172A');
      shaftGrad.addColorStop(1, '#020617');
      ctx.fillStyle = shaftGrad;
      ctx.fillRect(sx - TRAMPOLINE_W / 2, 64, TRAMPOLINE_W, floorY(5) - 52);

      // Shaft brass guide rails
      ctx.strokeStyle = 'rgba(251,191,36,0.28)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx - TRAMPOLINE_W / 2, 64);
      ctx.lineTo(sx - TRAMPOLINE_W / 2, floorY(5) + 12);
      ctx.moveTo(sx + TRAMPOLINE_W / 2, 64);
      ctx.lineTo(sx + TRAMPOLINE_W / 2, floorY(5) + 12);
      ctx.stroke();

      // Upward chevron guide marks inside shaft
      ctx.strokeStyle = 'rgba(56,189,248,0.16)';
      ctx.lineWidth = 1.5;
      for (let cy = TOP_FLOOR_Y; cy < floorY(5); cy += 44) {
        ctx.beginPath();
        ctx.moveTo(sx - 8, cy + 5);
        ctx.lineTo(sx, cy - 3);
        ctx.lineTo(sx + 8, cy + 5);
        ctx.stroke();
      }
    }

    // Draw floors with rich wood planks & carpet runners, interrupted by shafts
    for (let f = 0; f < FLOOR_COUNT; f++) {
      const fy = floorY(f);
      let segStart = 12;
      const shafts = [...TRAMPOLINE_XS, WORLD_W - 12 + TRAMPOLINE_W / 2];
      for (const sx of shafts) {
        const segEnd = sx - TRAMPOLINE_W / 2;
        if (segEnd > segStart) {
          const flGrad = ctx.createLinearGradient(0, fy, 0, fy + 13);
          flGrad.addColorStop(0, theme.floorTop);
          flGrad.addColorStop(1, theme.floorBot);
          ctx.fillStyle = flGrad;
          ctx.fillRect(segStart, fy, segEnd - segStart, 13);

          // Carpet runner top trim
          ctx.fillStyle = theme.trim;
          ctx.fillRect(segStart, fy, segEnd - segStart, 2.5);

          // Brass floorboards bevel
          ctx.fillStyle = 'rgba(255,255,255,0.14)';
          ctx.fillRect(segStart, fy + 3, segEnd - segStart, 1.5);
        }
        segStart = sx + TRAMPOLINE_W / 2;
      }
    }

    // Solid bottom basement slab under trampolines
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, floorY(5) + 13, WORLD_W, 74);
    ctx.fillStyle = theme.trim;
    ctx.fillRect(0, floorY(5) + 13, WORLD_W, 2);

    // Draw trampolines (Green → Blue → Yellow → Red)
    const trampColors = ['#22C55E', '#38BDF8', '#FACC15', '#EF4444', '#475569'];
    for (const tr of this.trampolines) {
      const ty = floorY(5) + 14;
      const col = trampColors[Math.min(4, tr.bounces)];
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = tr.bounces === 4 ? 2 : 5.5;
      ctx.shadowColor = col;
      ctx.shadowBlur = tr.bounces === 4 ? 0 : 12;
      ctx.beginPath();
      if (tr.bounces === 4) {
        ctx.moveTo(tr.x - 30, ty);
        ctx.lineTo(tr.x - 10, ty + 14);
        ctx.moveTo(tr.x + 30, ty);
        ctx.lineTo(tr.x + 10, ty + 14);
      } else {
        ctx.moveTo(tr.x - 30, ty);
        ctx.quadraticCurveTo(tr.x, ty + 10 + tr.stretch * 20, tr.x + 30, ty);
      }
      ctx.stroke();

      // Bounce pips beneath trampoline
      for (let pip = 0; pip < 4; pip++) {
        ctx.fillStyle = pip < 4 - tr.bounces ? col : 'rgba(148,163,184,0.2)';
        ctx.fillRect(tr.x - 17 + pip * 10, ty + 15, 6, 4);
      }
      ctx.restore();
    }

    // Draw Attic Bells
    for (const b of this.bells) {
      if (b.state === 'used') continue;
      ctx.save();
      ctx.translate(b.x, b.y);
      if (b.state === 'hanging') {
        ctx.rotate(Math.sin(b.swingPhase) * 0.12);
        // Rope
        ctx.strokeStyle = '#D97706';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo(0, -8);
        ctx.stroke();
      }
      const bellGrad = ctx.createRadialGradient(-3, -2, 2, 0, 2, 16);
      bellGrad.addColorStop(0, '#FEF9C3');
      bellGrad.addColorStop(0.6, '#FACC15');
      bellGrad.addColorStop(1, '#B45309');
      ctx.fillStyle = bellGrad;
      ctx.beginPath();
      ctx.moveTo(-11, 10);
      ctx.quadraticCurveTo(-10, -10, 0, -11);
      ctx.quadraticCurveTo(10, -10, 11, 10);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#78350F';
      ctx.beginPath();
      ctx.arc(0, 11, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw Bonus Round Balloons
    for (const b of this.balloons) {
      if (b.popped) continue;
      const by = b.y + Math.sin(b.bobPhase) * 6;
      ctx.save();
      ctx.translate(b.x, by);
      // String
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, b.isGoro ? 26 : 16);
      ctx.quadraticCurveTo(4, b.isGoro ? 36 : 24, -2, b.isGoro ? 44 : 32);
      ctx.stroke();

      const rx = b.isGoro ? 24 : 14;
      const ry = b.isGoro ? 28 : 17;
      const bGrad = ctx.createRadialGradient(-rx * 0.3, -ry * 0.3, 2, 0, 0, ry);
      bGrad.addColorStop(0, '#FFFFFF');
      bGrad.addColorStop(0.3, b.isGoro ? '#F97316' : b.color);
      bGrad.addColorStop(1, b.isGoro ? '#9A3412' : '#1E293B');
      ctx.fillStyle = bGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();

      if (b.isGoro) {
        // Giant Goro face on balloon!
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(-7, -4, 4, 0, Math.PI * 2);
        ctx.arc(7, -4, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-8, -5, 2, 3);
        ctx.fillRect(6, -5, 2, 3);
        ctx.font = '800 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FEF08A';
        ctx.fillText('2000', 0, 12);
      }
      ctx.restore();
    }

    // Draw Doors
    for (const d of this.doors) {
      const fy = floorY(d.floor);
      const isPowerActive = d.isPower && !d.usedPower;
      ctx.save();
      if (d.openDir === 0) {
        if (isPowerActive) {
          ctx.shadowColor = '#38BDF8';
          ctx.shadowBlur = 12;
        }
        ctx.fillStyle = isPowerActive
          ? Math.floor(this.time * 8) % 2 === 0
            ? '#38BDF8'
            : '#F472B6'
          : '#D97706';
        ctx.fillRect(d.x - 5, fy - 50, 10, 50);
        ctx.fillStyle = '#FEF3C7';
        ctx.fillRect(d.x - 2, fy - 46, 4, 42);
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.arc(d.x + 2, fy - 24, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = isPowerActive ? '#38BDF8' : '#B45309';
        ctx.fillRect(d.openDir > 0 ? d.x : d.x - 32, fy - 48, 32, 48);
        ctx.strokeStyle = '#FEF08A';
        ctx.lineWidth = 2;
        ctx.strokeRect(d.openDir > 0 ? d.x : d.x - 32, fy - 48, 32, 48);
      }
      ctx.restore();
    }

    // Draw Microwave Beams
    for (const b of this.beams) {
      const by = floorY(b.floor) - 24;
      ctx.save();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 4.5;
      ctx.shadowColor = '#38BDF8';
      ctx.shadowBlur = 16;
      for (let w = 0; w < 3; w++) {
        ctx.beginPath();
        ctx.arc(b.x - b.dir * w * 12, by, 14 + w * 4, -0.8, 0.8);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Draw Stolen Loot Treasures (with flashing MATCH PAIR beacon!)
    for (const item of this.loots) {
      if (item.collected) continue;
      const isMatchingPair = this.pendingPairKind === item.kind;
      this.drawLoot(ctx, item, isMatchingPair);
    }

    // Draw Big Goro & Meowkies
    for (const cat of this.cats) {
      if (cat.state === 'respawning') continue;
      this.drawCat(ctx, cat);
    }

    // Draw Gosenzo Ancestor Coin Ghost
    if (this.gosenzo.active) {
      this.drawGosenzo(ctx);
    }

    // Draw Officer Mappy
    this.drawMappy(ctx);

    renderParticlesAndPopups(ctx, this.particles, this.popups);
    ctx.restore();

    // Top Mansion HUD Header Bar + Minimap Overview
    ctx.fillStyle = 'rgba(2,6,23,0.84)';
    ctx.fillRect(0, 0, W, 38);
    ctx.fillStyle = theme.trim;
    ctx.fillRect(0, 37, W, 2);

    ctx.font = '800 12px "JetBrains Mono", monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FACC15';
    ctx.fillText(`SCORE ${String(this.score).padStart(6, '0')}`, 14, 19);

    ctx.textAlign = 'center';
    ctx.fillStyle = this.isBonusRound ? '#F472B6' : '#38BDF8';
    ctx.fillText(
      this.isBonusRound
        ? `BONUS STAGE · POP ALL BALLOONS! ${Math.ceil(Math.max(0, this.bonusTimer))}s`
        : this.pendingPairKind
          ? `PAIR ACTIVE: FIND 2ND ${LOOT_LABELS[this.pendingPairKind]} (${Math.min(6, this.pairMultiplier + 1)}×)`
          : `RD ${this.level} · ${theme.name}`,
      W * 0.5,
      19
    );

    ctx.textAlign = 'right';
    ctx.fillStyle = '#4ADE80';
    ctx.fillText(`HI ${String(this.highScore).padStart(6, '0')} · ♥${this.lives}`, W - 14, 19);

    // Title Card Marquee Overlay
    if (this.phase === 'TITLE') {
      ctx.save();
      ctx.fillStyle = 'rgba(4, 9, 24, 0.72)';
      ctx.fillRect(W * 0.5 - 230, H * 0.5 - 108, 460, 216);
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 3;
      ctx.strokeRect(W * 0.5 - 230, H * 0.5 - 108, 460, 216);

      ctx.textAlign = 'center';
      ctx.font = '900 46px "JetBrains Mono", monospace';
      ctx.fillStyle = '#FACC15';
      ctx.fillText('MAPPY', W * 0.5, H * 0.5 - 48);

      ctx.font = '700 13px "JetBrains Mono", monospace';
      ctx.fillStyle = '#38BDF8';
      ctx.fillText('1983 NAMCO · POLICE MOUSE MANSION EDITION', W * 0.5, H * 0.5 - 12);

      ctx.font = '600 12px "JetBrains Mono", monospace';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText('4 VICTORIAN THEMES · ATTIC BELLS · BALLOON BONUS', W * 0.5, H * 0.5 + 22);
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('PAIR LOOT FOR 6× · SLAM MICROWAVE DOORS · BEWARE GOSENZO', W * 0.5, H * 0.5 + 46);

      ctx.fillStyle = Math.floor(this.time * 3) % 2 === 0 ? '#4ADE80' : '#FACC15';
      ctx.font = '800 15px "JetBrains Mono", monospace';
      ctx.fillText('PRESS PLAY OR SPACE TO START', W * 0.5, H * 0.5 + 84);
      ctx.restore();
    } else if (this.bannerText) {
      ctx.save();
      ctx.fillStyle = 'rgba(2, 6, 23, 0.78)';
      ctx.fillRect(W * 0.5 - 210, H * 0.5 - 26, 420, 52);
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2;
      ctx.strokeRect(W * 0.5 - 210, H * 0.5 - 26, 420, 52);
      ctx.font = '800 16px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FEF08A';
      ctx.fillText(this.bannerText, W * 0.5, H * 0.5);
      ctx.restore();
    }

    if (visualMode === 'crt') {
      renderCrtOverlay(ctx, W, H);
    }
    ctx.restore();
  }

  private drawLoot(ctx: CanvasRenderingContext2D, item: LootItem, isMatch: boolean): void {
    const fy = floorY(item.floor);
    ctx.save();
    ctx.translate(item.x, fy - 17);

    // Flashing golden halo if this completes the active pair!
    if (isMatch) {
      const pulse = 0.55 + Math.sin(this.time * 12) * 0.45;
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = '#4ADE80';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = '800 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#4ADE80';
      ctx.fillText('PAIR!', 0, -25);
      ctx.restore();
    }

    const goroBehind = this.cats.find(
      (c) => c.isGoro && c.state === 'hiding' && c.hideLootId === item.id
    );
    if (goroBehind) {
      // Iconic Big Goro peeking eyes & ears behind treasure!
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(0, -14, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(-5, -16, 4, 4);
      ctx.fillRect(1, -16, 4, 4);
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(-4, -15, 2, 2);
      ctx.fillRect(2, -15, 2, 2);
    }

    drawSoftShadow(ctx, 0, 16, 15, 4, 0.4);

    if (item.kind === 'radio') {
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(-14, -9, 28, 22);
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(-10, -5, 11, 10);
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.arc(7, 2, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (item.kind === 'tv') {
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(-15, -11, 30, 24);
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(-11, -7, 17, 15);
      ctx.fillStyle = '#BAE6FD';
      ctx.fillRect(-9, -5, 6, 4);
      // Rabbit ears
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-4, -11);
      ctx.lineTo(-9, -18);
      ctx.moveTo(4, -11);
      ctx.lineTo(9, -18);
      ctx.stroke();
    } else if (item.kind === 'computer') {
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(-14, -12, 28, 17);
      ctx.fillStyle = '#22C55E';
      ctx.fillRect(-10, -9, 20, 11);
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(-15, 6, 30, 7);
    } else if (item.kind === 'painting') {
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(-13, -15, 26, 29);
      ctx.fillStyle = '#1E3A8A';
      ctx.fillRect(-9, -11, 18, 21);
      ctx.fillStyle = '#FDE68A';
      ctx.beginPath();
      ctx.arc(0, -3, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#92400E';
      ctx.fillRect(-6, 2, 12, 8);
    } else {
      ctx.fillStyle = '#64748B';
      ctx.fillRect(-15, -13, 30, 27);
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2;
      ctx.strokeRect(-12, -10, 24, 21);
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
      ctx.fill();
    }

    drawStarGlint(ctx, 10, -10, 4, '#FFFFFF', 0.4 + Math.sin(this.time * 6 + item.id) * 0.4);
    ctx.restore();
  }

  private drawCat(ctx: CanvasRenderingContext2D, cat: MappyCat): void {
    if (cat.state === 'hiding') return;
    ctx.save();
    ctx.translate(cat.x, cat.y - 16);

    if (cat.state === 'stunned') {
      ctx.rotate(Math.sin(this.time * 22) * 0.32);
    }

    const scale = cat.isGoro ? 1.24 : 1.0;
    ctx.scale(cat.dir * scale, scale);

    drawSoftShadow(ctx, 0, 15, 13, 4, 0.4);

    // Expressive tail
    ctx.strokeStyle = cat.isGoro ? '#DC2626' : '#EC4899';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-10, 4);
    ctx.quadraticCurveTo(-18, -4 + Math.sin(cat.anim) * 4, -14, -11);
    ctx.stroke();

    // Body
    const bodyGrad = ctx.createRadialGradient(-3, -3, 2, 0, 2, 15);
    if (cat.isGoro) {
      bodyGrad.addColorStop(0, '#FB7185');
      bodyGrad.addColorStop(0.6, '#DC2626');
      bodyGrad.addColorStop(1, '#7F1D1D');
    } else {
      bodyGrad.addColorStop(0, '#F9A8D4');
      bodyGrad.addColorStop(0.6, '#EC4899');
      bodyGrad.addColorStop(1, '#9D174D');
    }
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 2, 11, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    // White belly patch
    ctx.fillStyle = '#FEF3C7';
    ctx.beginPath();
    ctx.ellipse(2, 4, 6, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pointed Cat Ears
    ctx.fillStyle = cat.isGoro ? '#DC2626' : '#EC4899';
    ctx.beginPath();
    ctx.moveTo(-9, -6);
    ctx.lineTo(-11, -17);
    ctx.lineTo(-2, -10);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(2, -10);
    ctx.lineTo(10, -17);
    ctx.lineTo(9, -6);
    ctx.closePath();
    ctx.fill();

    // Golden Crown on Big Goro
    if (cat.isGoro) {
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.moveTo(-6, -12);
      ctx.lineTo(-4, -19);
      ctx.lineTo(0, -15);
      ctx.lineTo(4, -19);
      ctx.lineTo(6, -12);
      ctx.closePath();
      ctx.fill();
    }

    // Eyes
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(3, -5, 3.2, 0, Math.PI * 2);
    ctx.arc(8, -5, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(3, -6, 1.8, 2.8);
    ctx.fillRect(8, -6, 1.8, 2.8);

    // Running feet
    const legSwing = Math.sin(cat.anim) * 4;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-5 + legSwing, 12, 5, 4);
    ctx.fillRect(2 - legSwing, 12, 5, 4);

    if (cat.state === 'stunned') {
      // Dizzy stars
      ctx.fillStyle = '#FACC15';
      for (let s = 0; s < 3; s++) {
        const a = this.time * 7 + (s * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 11, -18 + Math.sin(a) * 3, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  private drawGosenzo(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.gosenzo.x, this.gosenzo.y);
    const rx = Math.max(5, Math.abs(Math.cos(this.gosenzo.spin)) * 16);
    ctx.shadowColor = '#FACC15';
    ctx.shadowBlur = 18;
    const coinGrad = ctx.createRadialGradient(-3, -4, 2, 0, 0, 18);
    coinGrad.addColorStop(0, '#FEF9C3');
    coinGrad.addColorStop(0.55, '#FACC15');
    coinGrad.addColorStop(1, '#B45309');
    ctx.fillStyle = coinGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Glowing stern eyes on the ancestor coin
    if (rx > 9) {
      ctx.fillStyle = '#DC2626';
      ctx.fillRect(-5, -5, 3, 4);
      ctx.fillRect(2, -5, 3, 4);
      ctx.fillStyle = '#78350F';
      ctx.fillRect(-4, 4, 8, 2.5);
    }
    ctx.restore();
  }

  private drawMappy(ctx: CanvasRenderingContext2D): void {
    if (this.pInvuln > 0 && Math.floor(this.time * 16) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.px, this.py - 16);
    if (this.pShaft !== null) {
      // Expressive trampoline stretch & celebratory bounce pose!
      const tilt = Math.max(-0.25, Math.min(0.25, this.pvy * 0.0003));
      ctx.rotate(tilt * this.pDir);
    }
    ctx.scale(this.pDir, 1);

    if (this.pShaft === null) {
      drawSoftShadow(ctx, 0, 15, 12, 3.5, 0.42);
    }

    // Big round mouse ears
    ctx.fillStyle = '#60A5FA';
    ctx.beginPath();
    ctx.arc(-7, -12, 6.5, 0, Math.PI * 2);
    ctx.arc(3, -13, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FCA5A5';
    ctx.beginPath();
    ctx.arc(-7, -12, 3.4, 0, Math.PI * 2);
    ctx.arc(3, -13, 3.4, 0, Math.PI * 2);
    ctx.fill();

    // Blue police uniform torso
    const uniGrad = ctx.createLinearGradient(-9, -4, 9, 13);
    uniGrad.addColorStop(0, '#3B82F6');
    uniGrad.addColorStop(1, '#1D4ED8');
    ctx.fillStyle = uniGrad;
    ctx.beginPath();
    ctx.ellipse(0, 4, 10, 10.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Gold badge & belt
    ctx.fillStyle = '#FACC15';
    ctx.fillRect(2, 0, 4, 4);
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(-9, 7, 18, 3);

    // Mouse face & snout
    ctx.fillStyle = '#FDE68A';
    ctx.beginPath();
    ctx.ellipse(4, -5, 8.5, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Shiny nose
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(12, -5, 2.3, 0, Math.PI * 2);
    ctx.fill();
    // Bright eye
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(6, -7, 2, 0, Math.PI * 2);
    ctx.fill();

    // Officer Police Cap
    ctx.fillStyle = '#1E3A8A';
    ctx.fillRect(-7, -16, 16, 6);
    ctx.fillStyle = '#FACC15';
    ctx.fillRect(1, -15, 4, 3);
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(4, -11, 9, 2.5);

    // Running / airborne legs
    const stride = this.pShaft !== null ? 5 : Math.sin(this.pAnim) * 5;
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(-5 + stride, 12, 5, 4.5);
    ctx.fillRect(2 - stride, 12, 5, 4.5);

    ctx.restore();
  }
}

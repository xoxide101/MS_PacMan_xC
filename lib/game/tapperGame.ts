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

type BarThemeId = 'western' | 'sports' | 'punk' | 'space';

interface BarTheme {
  id: BarThemeId;
  name: string;
  wallTop: string;
  wallBottom: string;
  floorColor: string;
  woodTop: string;
  woodFace: string;
  trimColor: string;
  accentColor: string;
  patronShirt: string;
  patronAccent: string;
  patronName: string;
}

const BAR_THEMES: BarTheme[] = [
  {
    id: 'western',
    name: 'WESTERN SALOON',
    wallTop: '#3e1810',
    wallBottom: '#1c0b07',
    floorColor: '#26140c',
    woodTop: '#c47b34',
    woodFace: '#6b3510',
    trimColor: '#fbbf24',
    accentColor: '#ef4444',
    patronShirt: '#d97706',
    patronAccent: '#fde68a',
    patronName: 'COWBOY',
  },
  {
    id: 'sports',
    name: 'SPORTS BAR',
    wallTop: '#0f2d26',
    wallBottom: '#071713',
    floorColor: '#0e1f19',
    woodTop: '#b47435',
    woodFace: '#5a3312',
    trimColor: '#34d399',
    accentColor: '#38bdf8',
    patronShirt: '#2563eb',
    patronAccent: '#f8fafc',
    patronName: 'JOCK',
  },
  {
    id: 'punk',
    name: 'PUNK ROCK CLUB',
    wallTop: '#2b0f3a',
    wallBottom: '#11061c',
    floorColor: '#1a0c24',
    woodTop: '#8b467a',
    woodFace: '#431a3d',
    trimColor: '#f472b6',
    accentColor: '#a855f7',
    patronShirt: '#db2777',
    patronAccent: '#22d3ee',
    patronName: 'PUNK',
  },
  {
    id: 'space',
    name: 'GALACTIC CANTINA',
    wallTop: '#0b1838',
    wallBottom: '#050a1a',
    floorColor: '#0a1228',
    woodTop: '#475569',
    woodFace: '#1e293b',
    trimColor: '#38bdf8',
    accentColor: '#4ade80',
    patronShirt: '#16a34a',
    patronAccent: '#a3e635',
    patronName: 'ALIEN',
  },
];

interface Patron {
  id: number;
  lane: number;
  x: number;
  speed: number;
  baseSpeed: number;
  state: 'walking' | 'drinking' | 'sliding_back' | 'watching_show';
  stateTimer: number;
  drinksLeft: number;
  variant: number;
  animPhase: number;
  madness: number;
}

interface SlidingMug {
  lane: number;
  x: number;
  vx: number;
  full: boolean;
  foam: number;
  spin: number;
}

interface BarTip {
  lane: number;
  x: number;
  life: number;
  sparkle: number;
  value: number;
}

interface BonusCan {
  index: number;
  x: number;
  targetX: number;
  shaken: boolean;
  shakePhase: number;
  opened: boolean;
  spraying: boolean;
}

interface BarLaneGeom {
  y: number;
  leftX: number;
  rightX: number;
  doorX: number;
  tapX: number;
}

export class TapperArcadeGame implements ArcadeGameInstance {
  public readonly logicalWidth = 840;
  public readonly logicalHeight = 640;
  public readonly supportsPointerAim = true;
  public readonly primaryActionLabel = 'POUR & SLIDE';
  public readonly secondaryActionLabel = 'DASH TO TAP';

  private readonly isRootBeer: boolean;
  private readonly storageKey: string;

  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();
  private prevUp = false;
  private prevDown = false;
  private prevLeft = false;
  private prevRight = false;

  private score = 0;
  private highScore = 0;
  private level = 1;
  private lives = 3;
  private nextExtraLife = 20000;

  // 4 Perspective Bar Counters (authentic trapezoidal arcade depth!)
  private readonly lanes: BarLaneGeom[] = [
    { y: 175, leftX: 162, rightX: 660, doorX: 132, tapX: 690 },
    { y: 295, leftX: 134, rightX: 688, doorX: 102, tapX: 718 },
    { y: 418, leftX: 104, rightX: 718, doorX: 72, tapX: 748 },
    { y: 542, leftX: 74, rightX: 748, doorX: 42, tapX: 778 },
  ];

  // Bartender state
  private bartenderLane = 0;
  private bartenderX = 680;
  private pourTimer = 0;
  private pourAnim = 0;
  private runSpeed = 410;
  private bartenderStepPhase = 0;

  // Gameplay entities
  private patrons: Patron[] = [];
  private mugs: SlidingMug[] = [];
  private tips: BarTip[] = [];
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];
  private nextPatronId = 1;

  // Stage progression
  private patronsToSpawn = 14;
  private patronsServed = 0;
  private spawnTimer = 0.6;
  private comboCount = 0;
  private comboTimer = 0;
  private dancerTimer = 0;
  private dancerPhase = 0;
  private stageClearTimer = 0;
  private readyTimer = 0;
  private loseLifeTimer = 0;
  private failReason = '';
  private screenShake = 0;
  private clock = 0;

  // Authentic Shaken Can Bonus Round (every 2 stages!)
  private inBonusRound = false;
  private bonusPhase: 'shake' | 'shuffle' | 'pick' | 'result' = 'shake';
  private bonusTimer = 0;
  private bonusCans: BonusCan[] = [];
  private bonusSelected = 2;
  private bonusSwapCount = 0;
  private bonusSwapTimer = 0;
  private bonusWon = false;

  constructor(isRootBeer: boolean) {
    this.isRootBeer = isRootBeer;
    this.storageKey = isRootBeer
      ? 'retro_arcade_roottapper_evo_hs_v2'
      : 'retro_arcade_tapper_bud_evo_hs_v2';
    this.highScore = readHighScore(this.storageKey);
  }

  private getTheme(): BarTheme {
    const idx = Math.floor((this.level - 1) / 2) % BAR_THEMES.length;
    return BAR_THEMES[idx];
  }

  public startNewGame(): void {
    arcadeAudio.unlock();
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.nextExtraLife = 20000;
    this.inBonusRound = false;
    this.setupStage(1);
    this.phase = 'READY';
    this.readyTimer = 1.15;
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.inBonusRound = false;
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  private setupStage(level: number): void {
    this.level = level;
    this.patrons = [];
    this.mugs = [];
    this.tips = [];
    this.particles = [];
    this.popups = [];
    this.bartenderLane = 0;
    this.bartenderX = this.lanes[0].tapX - 18;
    this.pourTimer = 0;
    this.pourAnim = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.dancerTimer = 0;
    this.loseLifeTimer = 0;
    this.failReason = '';
    this.patronsToSpawn = 12 + level * 3;
    this.patronsServed = 0;
    this.spawnTimer = 0.55;

    // Seed 2 initial thirsty patrons right away
    this.spawnPatron(0);
    this.spawnPatron(2);
  }

  private startBonusRound(): void {
    this.inBonusRound = true;
    this.bonusPhase = 'shake';
    this.bonusTimer = 1.65;
    this.bonusSwapCount = 0;
    this.bonusSwapTimer = 0;
    this.bonusWon = false;
    this.bonusSelected = 2;
    this.particles = [];
    this.popups = [];

    const unshakenIdx = Math.floor(Math.random() * 6);
    this.bonusCans = [];
    for (let i = 0; i < 6; i++) {
      const cx = 145 + i * 110;
      this.bonusCans.push({
        index: i,
        x: cx,
        targetX: cx,
        shaken: i !== unshakenIdx,
        shakePhase: Math.random() * Math.PI * 2,
        opened: false,
        spraying: false,
      });
    }
    arcadeAudio.playStartFanfare();
  }

  private addScore(pts: number, x?: number, y?: number, color = '#fde047', label?: string): void {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(this.storageKey, this.highScore);
    }
    if (this.score >= this.nextExtraLife) {
      this.lives = Math.min(5, this.lives + 1);
      this.nextExtraLife += 25000;
      arcadeAudio.playExtraLife();
      this.popups.push({
        x: this.logicalWidth * 0.5,
        y: 120,
        text: '1UP! EXTRA BARTENDER!',
        color: '#4ade80',
        life: 1.4,
        maxLife: 1.4,
      });
    }
    if (x !== undefined && y !== undefined) {
      this.popups.push({
        x,
        y,
        text: label ?? `+${pts}`,
        color,
        life: 0.95,
        maxLife: 0.95,
      });
    }
  }

  private spawnPatron(forcedLane?: number): void {
    if (this.patronsToSpawn <= 0) return;
    // Choose a lane that isn't overcrowded at the door
    const candidates = [0, 1, 2, 3].filter(
      (ln) => !this.patrons.some((p) => p.lane === ln && p.x < this.lanes[ln].leftX + 58)
    );
    if (candidates.length === 0) return;
    const lane =
      forcedLane !== undefined && candidates.includes(forcedLane)
        ? forcedLane
        : candidates[Math.floor(Math.random() * candidates.length)];

    const geom = this.lanes[lane];
    const speedScale = 1 + (this.level - 1) * 0.11;
    const baseSpeed = (34 + Math.random() * 14) * speedScale;
    // Tougher patrons on higher stages require 2 drinks before flying out the door!
    const drinksLeft = this.level >= 2 && Math.random() < Math.min(0.55, 0.2 + this.level * 0.08) ? 2 : 1;

    this.patrons.push({
      id: this.nextPatronId++,
      lane,
      x: geom.leftX + 6,
      speed: baseSpeed,
      baseSpeed,
      state: 'walking',
      stateTimer: 0,
      drinksLeft,
      variant: Math.floor(Math.random() * 3),
      animPhase: Math.random() * Math.PI * 2,
      madness: 0,
    });
    this.patronsToSpawn--;
  }

  private triggerLoseLife(reason: string): void {
    if (this.loseLifeTimer > 0) return;
    this.failReason = reason;
    this.loseLifeTimer = 1.65;
    this.screenShake = 12;
    this.comboCount = 0;
    arcadeAudio.playDeath();
    spawnBurst(
      this.particles,
      this.bartenderX,
      this.lanes[this.bartenderLane].y - 24,
      '#fbbf24',
      24,
      220,
      4.5
    );
  }

  public step(dt: number): void {
    this.clock += dt;
    if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - dt * 28);
    stepParticlesAndPopups(this.particles, this.popups, dt);

    const upJust = this.input.up && !this.prevUp;
    const downJust = this.input.down && !this.prevDown;
    const leftJust = this.input.left && !this.prevLeft;
    const rightJust = this.input.right && !this.prevRight;
    this.prevUp = this.input.up;
    this.prevDown = this.input.down;
    this.prevLeft = this.input.left;
    this.prevRight = this.input.right;

    if (this.phase === 'TITLE' || this.phase === 'PAUSED' || this.phase === 'GAME_OVER') {
      if ((this.phase === 'TITLE' || this.phase === 'GAME_OVER') && this.input.fireJustPressed) {
        this.startNewGame();
      }
      return;
    }

    if (this.phase === 'READY') {
      this.readyTimer -= dt;
      if (this.readyTimer <= 0) this.phase = 'PLAYING';
      return;
    }

    if (this.phase === 'STAGE_CLEAR') {
      this.stageClearTimer -= dt;
      if (this.stageClearTimer <= 0) {
        if (!this.inBonusRound && this.level % 2 === 0) {
          this.phase = 'PLAYING';
          this.startBonusRound();
        } else {
          this.inBonusRound = false;
          this.setupStage(this.level + 1);
          this.phase = 'READY';
          this.readyTimer = 1.1;
        }
      }
      return;
    }

    // Handle Bonus Shaken-Can Shell Game
    if (this.inBonusRound) {
      this.stepBonusRound(dt, leftJust, rightJust);
      return;
    }

    // Losing a life animation
    if (this.loseLifeTimer > 0) {
      this.loseLifeTimer -= dt;
      if (this.loseLifeTimer <= 0) {
        this.lives--;
        if (this.lives <= 0) {
          this.phase = 'GAME_OVER';
        } else {
          // Reset active patrons & mugs on current level (preserve progress!)
          const remaining = this.patronsToSpawn + this.patrons.length;
          this.patrons = [];
          this.mugs = [];
          this.tips = [];
          this.patronsToSpawn = Math.max(4, remaining);
          this.bartenderLane = 0;
          this.bartenderX = this.lanes[0].tapX - 18;
          this.dancerTimer = 0;
          this.phase = 'READY';
          this.readyTimer = 1.05;
        }
      }
      return;
    }

    // Combo decay
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.comboCount = 0;
    }

    // Can-Can Dancer distraction timer
    if (this.dancerTimer > 0) {
      this.dancerTimer -= dt;
      this.dancerPhase += dt * 10;
      if (this.dancerTimer <= 0) {
        for (const p of this.patrons) {
          if (p.state === 'watching_show') p.state = 'walking';
        }
      }
    }

    // Bartender lane switching (instant arcade snap to tap end of new bar, like original Tapper!)
    if (upJust) {
      this.bartenderLane = (this.bartenderLane + 3) % 4;
      this.bartenderX = this.lanes[this.bartenderLane].tapX - 18;
      this.pourTimer = 0;
      arcadeAudio.playMoveTick();
    } else if (downJust) {
      this.bartenderLane = (this.bartenderLane + 1) % 4;
      this.bartenderX = this.lanes[this.bartenderLane].tapX - 18;
      this.pourTimer = 0;
      arcadeAudio.playMoveTick();
    }

    // Pointer quick-lane selection (if player clicks/drags vertically on a bar)
    if (this.input.pointerActive) {
      const py = this.input.pointerY * this.logicalHeight;
      let nearest = this.bartenderLane;
      let bestDist = 9999;
      for (let i = 0; i < this.lanes.length; i++) {
        const d = Math.abs(py - (this.lanes[i].y - 16));
        if (d < bestDist) {
          bestDist = d;
          nearest = i;
        }
      }
      if (nearest !== this.bartenderLane && bestDist < 54) {
        this.bartenderLane = nearest;
        this.bartenderX = this.lanes[nearest].tapX - 18;
        this.pourTimer = 0;
        arcadeAudio.playMoveTick();
      }
    }

    const curLane = this.lanes[this.bartenderLane];
    const moveScale = this.input.moveScale ?? 0.9;

    // Secondary button snaps instantly back to the tap!
    if (this.input.secondaryJustPressed) {
      this.bartenderX = curLane.tapX - 18;
      arcadeAudio.playMoveTick();
    }

    // Horizontal running along the current bar (to grab tips or catch returning empty glasses)
    let moveX = 0;
    if (this.input.left) moveX -= 1;
    if (this.input.right) moveX += 1;
    if (Math.abs(this.input.analogX ?? 0) > 0.15) {
      moveX = this.input.analogX!;
    }
    if (moveX !== 0) {
      this.bartenderX += moveX * this.runSpeed * moveScale * dt;
      this.bartenderX = Math.max(curLane.leftX + 18, Math.min(curLane.tapX - 18, this.bartenderX));
      this.bartenderStepPhase += dt * 16;
    }

    // Pour & launch drink!
    if (this.pourTimer > 0) this.pourTimer -= dt;
    if (this.pourAnim > 0) this.pourAnim = Math.max(0, this.pourAnim - dt * 4);

    if (this.input.fireJustPressed && this.pourTimer <= 0) {
      // Snap back to tap if pouring (classic Tapper instant tap pull!)
      this.bartenderX = curLane.tapX - 18;
      this.pourTimer = 0.2;
      this.pourAnim = 1;
      this.mugs.push({
        lane: this.bartenderLane,
        x: curLane.rightX - 10,
        vx: -420,
        full: true,
        foam: 1,
        spin: 0,
      });
      arcadeAudio.playBubbleLaunch();
      spawnBurst(
        this.particles,
        curLane.rightX - 6,
        curLane.y - 24,
        this.isRootBeer ? '#fef3c7' : '#fde047',
        8,
        110,
        2.6
      );
    }

    // Collect tips along current bar
    for (let i = this.tips.length - 1; i >= 0; i--) {
      const tip = this.tips[i];
      tip.life -= dt;
      tip.sparkle += dt * 8;
      if (tip.lane === this.bartenderLane && Math.abs(this.bartenderX - tip.x) < 34) {
        this.addScore(tip.value, tip.x, this.lanes[tip.lane].y - 34, '#fde047', `TIP +${tip.value}!`);
        arcadeAudio.playMagicHat();
        spawnBurst(this.particles, tip.x, this.lanes[tip.lane].y - 20, '#fde047', 18, 170, 3.2);
        // Trigger Can-Can Dancer Show distraction!
        this.dancerTimer = 4.6;
        for (const p of this.patrons) {
          if (p.state === 'walking') p.state = 'watching_show';
        }
        this.tips.splice(i, 1);
      } else if (tip.life <= 0) {
        this.tips.splice(i, 1);
      }
    }

    // Spawn new patrons steadily
    this.spawnTimer -= dt;
    const maxConcurrent = Math.min(11, 5 + this.level);
    if (this.spawnTimer <= 0 && this.patronsToSpawn > 0 && this.patrons.length < maxConcurrent) {
      this.spawnPatron();
      this.spawnTimer = Math.max(0.7, 2.05 - this.level * 0.14) * (0.75 + Math.random() * 0.5);
    }

    // Update sliding mugs (full mugs heading left, empty mugs returning right)
    for (let i = this.mugs.length - 1; i >= 0; i--) {
      const m = this.mugs[i];
      const lg = this.lanes[m.lane];
      m.x += m.vx * dt;
      m.spin += dt * 6;

      if (m.full) {
        // Check collision with rightmost walking/watching patron on this lane
        let caughtBy: Patron | null = null;
        for (const p of this.patrons) {
          if (
            p.lane === m.lane &&
            (p.state === 'walking' || p.state === 'watching_show') &&
            Math.abs(p.x - m.x) < 28
          ) {
            if (!caughtBy || p.x > caughtBy.x) caughtBy = p;
          }
        }
        if (caughtBy) {
          // Patron grabs the foamy mug and slides back guzzling!
          caughtBy.state = 'sliding_back';
          caughtBy.stateTimer = 0.58;
          caughtBy.drinksLeft--;
          this.comboCount++;
          this.comboTimer = 2.6;
          const bonus = 50 * Math.min(5, this.comboCount);
          this.addScore(bonus, caughtBy.x, lg.y - 44, '#38bdf8', this.comboCount >= 2 ? `+${bonus} ×${this.comboCount}` : `+${bonus}`);
          arcadeAudio.playPop();
          spawnBurst(
            this.particles,
            caughtBy.x,
            lg.y - 24,
            this.isRootBeer ? '#fde68a' : '#fef08a',
            10,
            130,
            2.8
          );
          this.mugs.splice(i, 1);
          continue;
        }
        // Full mug flew past the left end of the bar and shattered!
        if (m.x < lg.leftX - 10) {
          spawnBurst(this.particles, lg.leftX, lg.y - 12, '#fef08a', 18, 180, 3.2);
          this.triggerLoseLife('SHATTERED FULL MUG!');
          this.mugs.splice(i, 1);
          return;
        }
      } else {
        // Empty mug sliding back right — bartender MUST catch it!
        if (m.lane === this.bartenderLane && Math.abs(this.bartenderX - m.x) < 34) {
          this.addScore(100, m.x, lg.y - 34, '#4ade80', 'CATCH +100');
          arcadeAudio.playCoin();
          spawnBurst(this.particles, m.x, lg.y - 18, '#bae6fd', 8, 100, 2.4);
          this.mugs.splice(i, 1);
          continue;
        }
        if (m.x > lg.rightX + 10) {
          spawnBurst(this.particles, lg.rightX, lg.y - 12, '#e2e8f0', 20, 180, 3.2);
          this.triggerLoseLife('DROPPED EMPTY MUG!');
          this.mugs.splice(i, 1);
          return;
        }
      }
    }

    // Update Patrons
    for (let i = this.patrons.length - 1; i >= 0; i--) {
      const p = this.patrons[i];
      const lg = this.lanes[p.lane];
      p.animPhase += dt * 7;

      if (p.state === 'sliding_back') {
        p.x -= 240 * dt;
        p.stateTimer -= dt;

        // Pushed all the way out the swinging saloon door!
        if (p.x <= lg.doorX + 16) {
          this.patronsServed++;
          this.addScore(150, lg.doorX + 32, lg.y - 40, '#4ade80', 'OUT! +150');
          arcadeAudio.playDoorSlam();
          spawnBurst(this.particles, lg.doorX + 18, lg.y - 26, '#fbbf24', 14, 160, 3.2);
          this.patrons.splice(i, 1);
          continue;
        }

        if (p.stateTimer <= 0) {
          // Patron finishes guzzling!
          if (p.drinksLeft <= 0) {
            // One more gentle shove if close, otherwise slides empty glass & leaves a tip sometimes!
            p.x -= 28;
            if (p.x <= lg.leftX + 26) {
              this.patronsServed++;
              this.addScore(150, lg.leftX + 20, lg.y - 40, '#4ade80', 'SERVED! +150');
              arcadeAudio.playDoorSlam();
              this.patrons.splice(i, 1);
              continue;
            }
          }
          // Send empty mug sliding back down the bar!
          this.mugs.push({
            lane: p.lane,
            x: p.x + 18,
            vx: 155 + this.level * 12,
            full: false,
            foam: 0.25,
            spin: 0,
          });
          // Chance to leave a glittering Tip on the bar
          if (Math.random() < 0.34 && !this.tips.some((t) => t.lane === p.lane)) {
            this.tips.push({
              lane: p.lane,
              x: Math.max(lg.leftX + 52, Math.min(lg.rightX - 90, p.x + 12)),
              life: 8.5,
              sparkle: 0,
              value: 1500,
            });
          }
          p.state = this.dancerTimer > 0 ? 'watching_show' : 'walking';
          p.drinksLeft = Math.max(1, p.drinksLeft);
        }
      } else if (p.state === 'walking') {
        p.x += p.speed * dt;
        const progress = (p.x - lg.leftX) / (lg.rightX - lg.leftX);
        p.madness = Math.max(0, (progress - 0.65) / 0.35);
        // Patron reached the tap end — grabs bartender and hurls him down the bar!
        if (p.x >= lg.rightX - 18) {
          this.triggerLoseLife(`${this.getTheme().patronName} REACHED THE TAP!`);
          return;
        }
      } else if (p.state === 'watching_show') {
        // Distracted by the Can-Can Dancer Show!
        p.animPhase += dt * 4;
      }
    }

    // Stage cleared when all patrons are served and no empty mugs remain!
    if (this.patronsToSpawn <= 0 && this.patrons.length === 0 && this.mugs.every((m) => m.full)) {
      this.addScore(1000 * this.level, this.logicalWidth * 0.5, 220, '#fde047', `BAR CLEARED +${1000 * this.level}`);
      arcadeAudio.playStageClear();
      this.phase = 'STAGE_CLEAR';
      this.stageClearTimer = 1.9;
    }
  }

  private stepBonusRound(dt: number, leftJust: boolean, rightJust: boolean): void {
    this.bonusTimer -= dt;

    for (const c of this.bonusCans) {
      c.x += (c.targetX - c.x) * Math.min(1, dt * 11);
      if (this.bonusPhase === 'shake' && c.shaken) {
        c.shakePhase += dt * 38;
      }
    }

    if (this.bonusPhase === 'shake') {
      if (this.bonusTimer <= 0) {
        this.bonusPhase = 'shuffle';
        this.bonusSwapCount = 8 + Math.min(6, this.level);
        this.bonusSwapTimer = 0.22;
      }
    } else if (this.bonusPhase === 'shuffle') {
      this.bonusSwapTimer -= dt;
      if (this.bonusSwapTimer <= 0) {
        if (this.bonusSwapCount > 0) {
          const a = Math.floor(Math.random() * 6);
          let b = Math.floor(Math.random() * 6);
          if (b === a) b = (a + 1) % 6;
          const txA = this.bonusCans[a].targetX;
          this.bonusCans[a].targetX = this.bonusCans[b].targetX;
          this.bonusCans[b].targetX = txA;
          this.bonusSwapCount--;
          this.bonusSwapTimer = 0.24;
          arcadeAudio.playMoveTick();
        } else {
          // Sort cans visually by targetX so left/right cursor maps cleanly
          this.bonusCans.sort((a, b) => a.targetX - b.targetX);
          this.bonusPhase = 'pick';
          this.bonusTimer = 6.5;
        }
      }
    } else if (this.bonusPhase === 'pick') {
      if (leftJust) {
        this.bonusSelected = (this.bonusSelected + 5) % 6;
        arcadeAudio.playMoveTick();
      } else if (rightJust) {
        this.bonusSelected = (this.bonusSelected + 1) % 6;
        arcadeAudio.playMoveTick();
      }
      if (this.input.pointerActive) {
        const px = this.input.pointerX * this.logicalWidth;
        let best = this.bonusSelected;
        let dist = 9999;
        for (let i = 0; i < this.bonusCans.length; i++) {
          const d = Math.abs(px - this.bonusCans[i].x);
          if (d < dist) {
            dist = d;
            best = i;
          }
        }
        this.bonusSelected = best;
      }

      if (this.input.fireJustPressed || this.bonusTimer <= 0) {
        const chosen = this.bonusCans[this.bonusSelected];
        chosen.opened = true;
        this.bonusWon = !chosen.shaken;
        this.bonusPhase = 'result';
        this.bonusTimer = 2.2;
        if (this.bonusWon) {
          this.addScore(3000, chosen.x, 310, '#4ade80', 'UNSHAKEN! +3000!');
          arcadeAudio.playRainbowBonus();
          spawnBurst(this.particles, chosen.x, 360, '#fde047', 34, 240, 4.2);
        } else {
          chosen.spraying = true;
          this.screenShake = 10;
          arcadeAudio.playFoodSplat(true);
          spawnBurst(this.particles, chosen.x, 350, '#ffffff', 42, 290, 5.2);
          this.popups.push({
            x: chosen.x,
            y: 300,
            text: 'WHOOSH! SHAKEN CAN!',
            color: '#f87171',
            life: 1.8,
            maxLife: 1.8,
          });
        }
      }
    } else if (this.bonusPhase === 'result') {
      const chosen = this.bonusCans[this.bonusSelected];
      if (chosen?.spraying && Math.random() < 0.65) {
        spawnBurst(this.particles, chosen.x, 330, '#fef9c3', 3, 180, 3.6);
      }
      if (this.bonusTimer <= 0) {
        this.inBonusRound = false;
        this.setupStage(this.level + 1);
        this.phase = 'READY';
        this.readyTimer = 1.1;
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.save();
    ctx.scale(dpr, dpr);

    if (this.screenShake > 0.2) {
      ctx.translate(
        (Math.random() - 0.5) * this.screenShake,
        (Math.random() - 0.5) * this.screenShake
      );
    }

    if (this.inBonusRound) {
      this.renderBonusRound(ctx);
    } else {
      this.renderSaloonStage(ctx);
    }

    renderParticlesAndPopups(ctx, this.particles, this.popups);

    // Top-of-screen READY / STAGE CLEAR / LOSE LIFE / TITLE overlays
    if (this.phase === 'TITLE') {
      this.renderTitleOverlay(ctx);
    } else if (this.phase === 'READY') {
      this.renderCenterBanner(
        ctx,
        `${this.getTheme().name} · BAR ${this.level}`,
        this.isRootBeer
          ? 'POUR FROTHY ROOT BEER & CATCH EVERY EMPTY MUG!'
          : 'PULL THE BUDWEISER TAP & KEEP THE SALOON MOVING!',
        '#fde047'
      );
    } else if (this.phase === 'STAGE_CLEAR') {
      this.renderCenterBanner(
        ctx,
        `BAR ${this.level} CLEARED!`,
        this.level % 2 === 0
          ? 'NEXT UP: SHAKEN CAN BONUS ROUND!'
          : 'ADVANCING TO NEXT SALOON...',
        '#4ade80'
      );
    } else if (this.loseLifeTimer > 0) {
      this.renderCenterBanner(ctx, this.failReason || 'MUG SHATTERED!', 'CLEANUP ON AISLE BAR!', '#f87171');
    } else if (this.phase === 'GAME_OVER') {
      this.renderCenterBanner(
        ctx,
        'LAST CALL · GAME OVER',
        `FINAL SCORE ${this.score.toLocaleString()} · PRESS SPACE TO POUR AGAIN`,
        '#f87171'
      );
    } else if (this.phase === 'PAUSED') {
      this.renderCenterBanner(ctx, 'PAUSED', 'PRESS P TO RESUME POURING', '#38bdf8');
    }

    if (visualMode === 'crt') {
      renderCrtOverlay(ctx, this.logicalWidth, this.logicalHeight);
    }
    ctx.restore();
  }

  private renderSaloonStage(ctx: CanvasRenderingContext2D): void {
    const theme = this.getTheme();

    // Rich themed saloon back wall gradient
    const wallGrad = ctx.createLinearGradient(0, 0, 0, this.logicalHeight);
    wallGrad.addColorStop(0, theme.wallTop);
    wallGrad.addColorStop(0.55, theme.wallBottom);
    wallGrad.addColorStop(1, theme.floorColor);
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);

    // Subtle wood paneling / neon club stripes / galactic starfield backdrop
    if (theme.id === 'western') {
      ctx.strokeStyle = 'rgba(255, 200, 120, 0.06)';
      ctx.lineWidth = 2;
      for (let x = 24; x < this.logicalWidth; x += 48) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.logicalHeight);
        ctx.stroke();
      }
    } else if (theme.id === 'space') {
      for (let i = 0; i < 42; i++) {
        const sx = ((i * 197 + 41) % this.logicalWidth);
        const sy = ((i * 89 + 19) % 140);
        const tw = 0.4 + 0.6 * Math.sin(this.clock * 3 + i);
        ctx.fillStyle = `rgba(186, 230, 253, ${tw * 0.7})`;
        ctx.fillRect(sx, sy, 2, 2);
      }
    } else if (theme.id === 'punk') {
      ctx.fillStyle = 'rgba(168, 85, 247, 0.08)';
      for (let i = 0; i < 8; i++) {
        const bx = i * 112 + Math.sin(this.clock * 2 + i) * 16;
        ctx.fillRect(bx, 0, 28, 120);
      }
    }

    // Authentic Top Signage Marquee (1983 Budweiser Bowtie Emblem OR 1984 Root Beer Tapper Sign!)
    this.renderBrandBanner(ctx, theme);

    // Can-Can Dancer Stage Show (when tip distraction is active!)
    if (this.dancerTimer > 0) {
      this.renderCanCanShow(ctx);
    }

    // Draw all 4 Perspective Bar Counters back-to-front
    for (let i = 0; i < this.lanes.length; i++) {
      this.renderBarLane(ctx, i, theme);
    }
  }

  private renderBrandBanner(ctx: CanvasRenderingContext2D, theme: BarTheme): void {
    const cx = this.logicalWidth * 0.5;
    if (!this.isRootBeer) {
      // Authentic 1983 Original Budweiser Tapper Crimson-and-Gold Bowtie Sign!
      ctx.save();
      // Hanging brass chains
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx - 120, 0);
      ctx.lineTo(cx - 120, 26);
      ctx.moveTo(cx + 120, 0);
      ctx.lineTo(cx + 120, 26);
      ctx.stroke();

      // Crimson Bowtie Plaque
      ctx.fillStyle = '#b91c1c';
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - 172, 24);
      ctx.lineTo(cx - 110, 32);
      ctx.lineTo(cx, 20);
      ctx.lineTo(cx + 110, 32);
      ctx.lineTo(cx + 172, 24);
      ctx.lineTo(cx + 158, 78);
      ctx.lineTo(cx + 106, 70);
      ctx.lineTo(cx, 82);
      ctx.lineTo(cx - 106, 70);
      ctx.lineTo(cx - 158, 78);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Inner white filigree line
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(cx - 124, 33, 248, 36);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'italic 900 24px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Budweiser', cx, 50);

      ctx.fillStyle = '#fde047';
      ctx.font = '800 10px "JetBrains Mono", monospace';
      ctx.fillText(`TAPPER · ${theme.name} · BAR ${this.level}`, cx, 94);
      ctx.restore();
    } else {
      // Authentic 1984 Root Beer Tapper Copper & Cream Soda Fountain Crest!
      ctx.save();
      const grad = ctx.createLinearGradient(cx - 170, 20, cx + 170, 78);
      grad.addColorStop(0, '#78350f');
      grad.addColorStop(0.5, '#b45309');
      grad.addColorStop(1, '#78350f');
      ctx.fillStyle = grad;
      ctx.strokeStyle = '#fef3c7';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(cx - 178, 22, 356, 56, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fef3c7';
      ctx.font = '900 22px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('FROSTY ROOT BEER', cx, 49);

      ctx.fillStyle = '#fde68a';
      ctx.font = '800 10px "JetBrains Mono", monospace';
      ctx.fillText(`SODA FOUNTAIN · ${theme.name} · BAR ${this.level}`, cx, 94);
      ctx.restore();
    }
  }

  private renderCanCanShow(ctx: CanvasRenderingContext2D): void {
    const cx = this.logicalWidth * 0.5;
    ctx.save();
    // Golden stage spotlight cones
    const spot = ctx.createRadialGradient(cx, 112, 8, cx, 112, 175);
    spot.addColorStop(0, 'rgba(253, 224, 71, 0.38)');
    spot.addColorStop(1, 'rgba(253, 224, 71, 0)');
    ctx.fillStyle = spot;
    ctx.fillRect(cx - 180, 18, 360, 130);

    // 3 Dancing Can-Can Performers on the balcony!
    for (let i = -1; i <= 1; i++) {
      const dx = cx + i * 54;
      const kick = Math.sin(this.dancerPhase + i * 1.4);
      const dy = 114 - Math.abs(kick) * 8;
      // Dress frill
      ctx.fillStyle = i === 0 ? '#f43f5e' : '#ec4899';
      ctx.beginPath();
      ctx.moveTo(dx, dy - 16);
      ctx.lineTo(dx - 14, dy + 6);
      ctx.lineTo(dx + 14, dy + 6);
      ctx.closePath();
      ctx.fill();
      // High kick leg
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(dx, dy + 5);
      ctx.lineTo(dx + kick * 14, dy + 13 - Math.abs(kick) * 7);
      ctx.stroke();
      // Head + feather plume
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(dx, dy - 22, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(dx, dy - 28, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderBarLane(ctx: CanvasRenderingContext2D, idx: number, theme: BarTheme): void {
    const lg = this.lanes[idx];
    const barW = lg.rightX - lg.leftX;

    // 1. Left Swinging Saloon / Club Door
    ctx.save();
    ctx.fillStyle = '#180c08';
    ctx.fillRect(lg.doorX - 18, lg.y - 62, 38, 68);
    ctx.strokeStyle = theme.trimColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(lg.doorX - 18, lg.y - 62, 38, 68);
    // Double swinging door slats
    ctx.fillStyle = theme.woodFace;
    ctx.fillRect(lg.doorX - 14, lg.y - 48, 13, 38);
    ctx.fillRect(lg.doorX + 2, lg.y - 48, 13, 38);
    ctx.restore();

    // 2. Patrons behind/along the counter
    for (const p of this.patrons) {
      if (p.lane === idx) this.renderPatron(ctx, p, lg.y, theme);
    }

    // 3. Mahogany / Polished Bar Countertop + Brass Foot-Rail
    ctx.save();
    // Counter front panel
    const faceGrad = ctx.createLinearGradient(0, lg.y, 0, lg.y + 34);
    faceGrad.addColorStop(0, theme.woodFace);
    faceGrad.addColorStop(1, '#1c0f08');
    ctx.fillStyle = faceGrad;
    ctx.fillRect(lg.leftX, lg.y, barW, 30);

    // Decorative front wainscoting panels
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1.5;
    for (let px = lg.leftX + 16; px < lg.rightX - 42; px += 62) {
      ctx.strokeRect(px, lg.y + 6, 48, 16);
    }

    // Gleaming polished bar countertop
    const topGrad = ctx.createLinearGradient(0, lg.y - 12, 0, lg.y + 2);
    topGrad.addColorStop(0, '#fde68a');
    topGrad.addColorStop(0.25, theme.woodTop);
    topGrad.addColorStop(1, theme.woodFace);
    ctx.fillStyle = topGrad;
    ctx.beginPath();
    ctx.roundRect(lg.leftX - 6, lg.y - 11, barW + 14, 13, 4);
    ctx.fill();

    // Brass Foot-Rail along bottom
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(lg.leftX + 4, lg.y + 27);
    ctx.lineTo(lg.rightX - 4, lg.y + 27);
    ctx.stroke();

    // 4. Right-Side Golden Beer Keg / Root Beer Soda Barrel Tap!
    const kegX = lg.tapX + 8;
    const kegY = lg.y - 26;
    ctx.fillStyle = this.isRootBeer ? '#92400e' : '#d97706';
    ctx.beginPath();
    ctx.roundRect(kegX - 18, kegY - 24, 38, 52, 8);
    ctx.fill();
    ctx.strokeStyle = this.isRootBeer ? '#fef3c7' : '#fde047';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // Keg iron hoops
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(kegX - 18, kegY - 10);
    ctx.lineTo(kegX + 20, kegY - 10);
    ctx.moveTo(kegX - 18, kegY + 12);
    ctx.lineTo(kegX + 20, kegY + 12);
    ctx.stroke();
    // Budweiser Red Emblem or Root Beer Froth Badge on Keg!
    ctx.fillStyle = this.isRootBeer ? '#fef3c7' : '#dc2626';
    ctx.fillRect(kegX - 12, kegY - 6, 26, 13);
    ctx.fillStyle = this.isRootBeer ? '#78350f' : '#ffffff';
    ctx.font = '900 8px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(this.isRootBeer ? 'RB' : 'BUD', kegX + 1, kegY + 3);
    // Brass Tap Lever (tilts when pouring!)
    const leverTilt = this.bartenderLane === idx ? this.pourAnim * 0.65 : 0;
    ctx.save();
    ctx.translate(kegX - 20, kegY - 4);
    ctx.rotate(-0.2 - leverTilt);
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-10, -18);
    ctx.stroke();
    ctx.fillStyle = this.isRootBeer ? '#f59e0b' : '#ef4444';
    ctx.beginPath();
    ctx.arc(-11, -20, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();

    // 5. Glittering Tips on the bar
    for (const tip of this.tips) {
      if (tip.lane === idx) {
        const ty = lg.y - 14 + Math.sin(tip.sparkle) * 2;
        ctx.save();
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(tip.x - 10, ty - 6, 20, 11);
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(tip.x - 10, ty - 6, 20, 11);
        ctx.fillStyle = '#fef08a';
        ctx.font = '900 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('$', tip.x, ty + 3);
        ctx.restore();
      }
    }

    // 6. Sliding Foamy Mugs & Returning Empty Glasses
    for (const m of this.mugs) {
      if (m.lane === idx) this.renderMug(ctx, m, lg.y - 10);
    }

    // 7. Bartender on active lane
    if (this.bartenderLane === idx) {
      this.renderBartender(ctx, this.bartenderX, lg.y - 8);
    }
  }

  private renderPatron(ctx: CanvasRenderingContext2D, p: Patron, barY: number, theme: BarTheme): void {
    const bob = p.state === 'sliding_back' ? -4 : Math.abs(Math.sin(p.animPhase)) * 4;
    const py = barY - 26 - bob;
    ctx.save();
    ctx.translate(p.x, py);

    // Body / Shirt
    ctx.fillStyle = p.madness > 0.5 && Math.floor(this.clock * 10) % 2 === 0 ? '#ef4444' : theme.patronShirt;
    ctx.beginPath();
    ctx.roundRect(-13, -10, 26, 28, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Head
    ctx.fillStyle = theme.id === 'space' ? '#86efac' : '#fed7aa';
    ctx.beginPath();
    ctx.arc(0, -19, 11, 0, Math.PI * 2);
    ctx.fill();

    // Theme-authentic headgear!
    if (theme.id === 'western') {
      // Stetson Cowboy Hat
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-16, -28, 32, 4);
      ctx.beginPath();
      ctx.roundRect(-9, -37, 18, 11, 4);
      ctx.fill();
    } else if (theme.id === 'sports') {
      // Baseball Cap
      ctx.fillStyle = '#1d4ed8';
      ctx.beginPath();
      ctx.arc(0, -24, 11, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(2, -25, 13, 3.5);
    } else if (theme.id === 'punk') {
      // Spiky Neon Mohawk!
      ctx.fillStyle = p.variant === 0 ? '#f43f5e' : p.variant === 1 ? '#22d3ee' : '#a3e635';
      ctx.beginPath();
      ctx.moveTo(-6, -27);
      ctx.lineTo(-2, -41);
      ctx.lineTo(3, -30);
      ctx.lineTo(8, -39);
      ctx.lineTo(10, -26);
      ctx.closePath();
      ctx.fill();
    } else {
      // Galactic Alien Antennae + 3 Eyes!
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-4, -29);
      ctx.lineTo(-9, -38);
      ctx.moveTo(4, -29);
      ctx.lineTo(9, -38);
      ctx.stroke();
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(-9, -39, 2.8, 0, Math.PI * 2);
      ctx.arc(9, -39, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Eyes / Expression
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(2, -22, 3, 3);
    ctx.fillRect(7, -22, 3, 3);
    if (p.state === 'sliding_back') {
      // Guzzling mug happily!
      ctx.fillStyle = this.isRootBeer ? '#78350f' : '#f59e0b';
      ctx.fillRect(8, -18, 10, 12);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(7, -21, 12, 4);
    } else if (p.drinksLeft >= 2) {
      // Tough customer badge (needs 2 mugs)
      ctx.fillStyle = '#fde047';
      ctx.font = '900 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('×2', 0, -42);
    }
    ctx.restore();
  }

  private renderMug(ctx: CanvasRenderingContext2D, m: SlidingMug, y: number): void {
    ctx.save();
    ctx.translate(m.x, y);
    // Glass body
    ctx.fillStyle = m.full
      ? this.isRootBeer
        ? '#5b2608'
        : '#f59e0b'
      : 'rgba(226, 232, 240, 0.35)';
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-8, -18, 16, 18, 3);
    ctx.fill();
    ctx.stroke();

    // Handle
    ctx.beginPath();
    ctx.arc(9, -9, 5, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.stroke();

    // Frothy White Head!
    if (m.full) {
      ctx.fillStyle = this.isRootBeer ? '#fef3c7' : '#ffffff';
      ctx.beginPath();
      ctx.arc(-5, -19, 4.2, 0, Math.PI * 2);
      ctx.arc(0, -21, 5.2, 0, Math.PI * 2);
      ctx.arc(5, -19, 4.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Blinking urgent glow on returning empty glass
      if (Math.floor(this.clock * 12) % 2 === 0) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-11, -21, 24, 23);
      }
    }
    ctx.restore();
  }

  private renderBartender(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const bob = Math.abs(Math.sin(this.bartenderStepPhase)) * 3;
    ctx.save();
    ctx.translate(x, y - bob);

    // White shirt + classic apron
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.roundRect(-13, -34, 26, 30, 6);
    ctx.fill();
    // Apron / Soda-Jerk Stripes
    ctx.fillStyle = this.isRootBeer ? '#b45309' : '#dc2626';
    ctx.fillRect(-10, -22, 20, 22);
    if (this.isRootBeer) {
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(-6, -22, 3, 22);
      ctx.fillRect(3, -22, 3, 22);
    }

    // Iconic Red Bowtie!
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.lineTo(-7, -34);
    ctx.lineTo(-7, -26);
    ctx.closePath();
    ctx.moveTo(0, -30);
    ctx.lineTo(7, -34);
    ctx.lineTo(7, -26);
    ctx.closePath();
    ctx.fill();

    // Head + Handlebar Mustache + Hair
    ctx.fillStyle = '#fed7aa';
    ctx.beginPath();
    ctx.arc(0, -44, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#29150b';
    ctx.beginPath();
    ctx.arc(0, -48, 11, Math.PI, 0);
    ctx.fill();
    // Mustache
    ctx.strokeStyle = '#29150b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-7, -40);
    ctx.quadraticCurveTo(0, -43, 7, -40);
    ctx.stroke();

    // Pouring arm extension
    if (this.pourAnim > 0.05) {
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-8, -28);
      ctx.lineTo(-22, -24);
      ctx.stroke();
    }
    ctx.restore();
  }

  private renderBonusRound(ctx: CanvasRenderingContext2D): void {
    const bg = ctx.createLinearGradient(0, 0, 0, this.logicalHeight);
    bg.addColorStop(0, '#2a0f12');
    bg.addColorStop(1, '#120709');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);

    ctx.fillStyle = '#fde047';
    ctx.font = '900 28px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SHAKEN CAN BONUS ROUND!', this.logicalWidth * 0.5, 84);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 15px "JetBrains Mono", monospace';
    const sub =
      this.bonusPhase === 'shake'
        ? 'WATCH THE MASKED BANDIT SHAKE 5 OF THE 6 CANS...'
        : this.bonusPhase === 'shuffle'
          ? 'KEEP YOUR EYE ON THE SINGLE UNSHAKEN CAN!'
          : this.bonusPhase === 'pick'
            ? 'USE LEFT/RIGHT & PRESS SPACE TO PICK THE UNSHAKEN CAN (+3,000)!'
            : this.bonusWon
              ? 'PERFECT PICK! ICE-COLD REFRESHMENT +3,000!'
              : 'SPLAT! THAT ONE WAS SHAKEN!';
    ctx.fillText(sub, this.logicalWidth * 0.5, 122);

    // Grand mahogany bonus bar counter
    ctx.fillStyle = '#9a541e';
    ctx.fillRect(55, 420, this.logicalWidth - 110, 26);
    ctx.fillStyle = '#4c2409';
    ctx.fillRect(65, 446, this.logicalWidth - 130, 96);

    // Draw the 6 Cans!
    for (let i = 0; i < this.bonusCans.length; i++) {
      const can = this.bonusCans[i];
      const jitterX = this.bonusPhase === 'shake' && can.shaken ? Math.sin(can.shakePhase) * 9 : 0;
      const jitterY = this.bonusPhase === 'shake' && can.shaken ? Math.cos(can.shakePhase * 1.4) * 14 : 0;
      const cx = can.x + jitterX;
      const cy = 365 + jitterY;

      ctx.save();
      ctx.translate(cx, cy);

      // Selection spotlight
      if (this.bonusPhase === 'pick' && i === this.bonusSelected) {
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 4;
        ctx.strokeRect(-32, -56, 64, 114);
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.moveTo(0, -68);
        ctx.lineTo(-10, -82);
        ctx.lineTo(10, -82);
        ctx.closePath();
        ctx.fill();
      }

      // Metallic Can Body (Budweiser Red & White OR Frosty Root Beer Amber!)
      ctx.fillStyle = this.isRootBeer ? '#92400e' : '#dc2626';
      ctx.beginPath();
      ctx.roundRect(-24, -44, 48, 88, 6);
      ctx.fill();
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(-24, -18, 48, 36);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(-22, -48, 44, 6);
      ctx.fillRect(-22, 42, 44, 6);

      ctx.fillStyle = this.isRootBeer ? '#78350f' : '#b91c1c';
      ctx.font = '900 11px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.isRootBeer ? 'ROOT' : 'BUD', 0, -2);
      ctx.font = '800 9px "JetBrains Mono", monospace';
      ctx.fillText(this.isRootBeer ? 'BEER' : 'KING', 0, 12);

      // Reveal unshaken glow at result
      if (this.bonusPhase === 'result' && !can.shaken) {
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 4;
        ctx.strokeRect(-30, -54, 60, 108);
      }
      ctx.restore();
    }
  }

  private renderTitleOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(10, 6, 8, 0.72)';
    ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);

    const cx = this.logicalWidth * 0.5;
    ctx.textAlign = 'center';
    ctx.fillStyle = this.isRootBeer ? '#fde68a' : '#ef4444';
    ctx.font = '900 46px Georgia, serif';
    ctx.fillText(this.isRootBeer ? 'ROOT BEER TAPPER' : 'BUDWEISER TAPPER', cx, 210);

    ctx.fillStyle = '#fde047';
    ctx.font = '800 15px "JetBrains Mono", monospace';
    ctx.fillText(
      this.isRootBeer
        ? '1984 BALLY MIDWAY · AUTHENTIC EVOLUTION SODA FOUNTAIN EDITION'
        : '1983 BALLY MIDWAY · ORIGINAL BUDWEISER SALOON EVOLUTION EDITION',
      cx,
      252
    );

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 14px "JetBrains Mono", monospace';
    ctx.fillText('4 SALOONS: WESTERN · SPORTS · PUNK ROCK · GALACTIC CANTINA', cx, 315);
    ctx.fillText('SLIDE FOAMY MUGS · CATCH EMPTY GLASSES · GRAB TIPS FOR CAN-CAN SHOW', cx, 345);
    ctx.fillText('BEAT EVERY 2ND BAR FOR THE SHAKEN CAN BONUS ROUND!', cx, 375);

    const pulse = 0.65 + 0.35 * Math.sin(this.clock * 6);
    ctx.fillStyle = `rgba(253, 224, 71, ${pulse})`;
    ctx.font = '900 20px "JetBrains Mono", monospace';
    ctx.fillText('PRESS SPACE OR CLICK START TO OPEN THE BAR', cx, 462);
  }

  private renderCenterBanner(ctx: CanvasRenderingContext2D, title: string, sub: string, color: string): void {
    ctx.save();
    ctx.fillStyle = 'rgba(8, 10, 20, 0.8)';
    ctx.beginPath();
    ctx.roundRect(120, 250, this.logicalWidth - 240, 128, 14);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.font = '900 28px "JetBrains Mono", monospace';
    ctx.fillText(title, this.logicalWidth * 0.5, 298);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 13px "JetBrains Mono", monospace';
    ctx.fillText(sub, this.logicalWidth * 0.5, 342);
    ctx.restore();
  }

  public getHudSnapshot(): ClassicGameHud {
    const remaining = this.patronsToSpawn + this.patrons.length;
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: this.inBonusRound ? 'SHAKEN CAN BONUS' : this.getTheme().name,
      primaryMetricLabel: this.inBonusRound ? 'BONUS' : 'LEFT',
      primaryMetricValue: this.inBonusRound ? 'PICK 1' : String(remaining),
      secondaryMetricLabel: this.dancerTimer > 0 ? 'SHOW' : 'COMBO',
      secondaryMetricValue: this.dancerTimer > 0 ? `${this.dancerTimer.toFixed(1)}s` : `×${Math.max(1, this.comboCount)}`,
      bannerText: this.inBonusRound
        ? 'TRACK THE UNSHAKEN CAN!'
        : this.dancerTimer > 0
          ? 'CAN-CAN DANCERS DISTRACTING PATRONS!'
          : `${this.getTheme().name} · BAR ${this.level}`,
    };
  }
}

import {
  ArcadeGameInstance,
  ArcadeInputState,
  ClassicGameHud,
  ClassicGamePhase,
  ScorePopup,
  createEmptyInput,
  readHighScore,
  renderCrtOverlay,
  saveHighScore,
} from './classicArcadeInterface';
import { arcadeAudio } from './audio';

/**
 * STAR WARS: RETURN OF THE JEDI (1984 — Atari 2.5D / "2.3D" Diagonal Isometric Shaded Raster Engine — Deluxe Accurate Edition)
 *
 * Faithfully recreates and evolves the legendary 1984 Atari shaded-raster isometric cabinet:
 *  - Stage 1: FOREST MOON OF ENDOR (Princess Leia on 74-Z Speeder Bike)
 *      Diagonal sunlit forest track with river ravine bridges, towering textured redwoods with cast shadows,
 *      diagonal atmospheric sunbeams, rival Imperial Scout Troopers (shoot OR side-ram into trees for +1000!),
 *      shootable Ewok Vine Log-Traps, fallen log jumps, and arrival at the Ewok Treetop Village!
 *  - Stage 2: ENDOR IMPERIAL SHIELD BUNKER (Chewbacca in Hijacked AT-ST Chicken Walker)
 *      Articulated reverse-jointed AT-ST stomping through the fortified bunker clearing with dust puffs,
 *      Ewok Hang-Gliders dropping boulders on enemy turrets, swinging twin-redwood Ewok Log Traps,
 *      Imperial AT-ST Walkers, Speeder Troopers, Land Mines, E-Web Turrets, and a multi-part
 *      Fortified Shield Generator Bunker (destroy flanking power conduits -> shatter rotating Shield Dish!).
 *  - Stage 3: DEATH STAR II — SURFACE APPROACH, INTERIOR REACTOR TUNNEL & FIREBALL OUTRUN (Lando in Millennium Falcon!)
 *      3A) Outer Death Star II steel superstructure with open-space Rebel vs. Imperial capital ship battle off the edges,
 *          TIE Interceptors, Surface Turbolasers, and shootable Laser Force-Field Gates.
 *      3B) Interior Reactor Core Tunnel with dark steel ribs, glowing power conduits, and the multi-conduit
 *          Main Hypermatter Reactor Core Boss.
 *      3C) Iconic High-Speed Fireball Outrun Escape ahead of an expanding, roaring volumetric Raster Fireball Wall
 *          through collapsing blast doors to burst out into open space as Death Star II explodes!
 */

const W = 760;
const H = 560;
const HS_KEY = 'starwarsrotj_hd_highscore_v1';

// Diagonal Isometric Projection (Bottom-Left -> Top-Right travel ribbon just like 1984 Atari ROTJ!)
const ISO_ORIGIN_X = 188;
const ISO_ORIGIN_Y = 442;
const ISO_UX = 0.69;
const ISO_UY = -0.39;
const ISO_VX = 0.62;
const ISO_VY = 0.45;

function isoToScreen(u: number, v: number, zHeight = 0): { sx: number; sy: number } {
  return {
    sx: ISO_ORIGIN_X + u * ISO_UX + v * ISO_VX,
    sy: ISO_ORIGIN_Y + u * ISO_UY + v * ISO_VY - zHeight,
  };
}

function screenToIso(sx: number, sy: number): { u: number; v: number } {
  const dx = sx - ISO_ORIGIN_X;
  const dy = sy - ISO_ORIGIN_Y;
  const det = ISO_UX * ISO_VY - ISO_UY * ISO_VX;
  return {
    u: (dx * ISO_VY - dy * ISO_VX) / det,
    v: (ISO_UX * dy - ISO_UY * dx) / det,
  };
}

interface RasterExplosion {
  sx: number;
  sy: number;
  life: number;
  maxLife: number;
  radius: number;
  heavy: boolean;
  ringMax: number;
  puffs: Array<{ dx: number; dy: number; r: number; delay: number; col: string }>;
}

interface DebrisChunk {
  sx: number;
  sy: number;
  vx: number;
  vy: number;
  rot: number;
  vRot: number;
  life: number;
  maxLife: number;
  color: string;
  w: number;
  h: number;
  gravity: number;
}

interface DustPuff {
  u: number;
  v: number;
  z: number;
  r: number;
  life: number;
  maxLife: number;
  color: string;
}

interface ScorchMark {
  u: number;
  v: number;
  r: number;
  alpha: number;
}

interface SpaceBattleLaser {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
  life: number;
  maxLife: number;
}

interface EwokGlider {
  u: number;
  v: number;
  vu: number;
  vv: number;
  dropCd: number;
  wingFlap: number;
}

interface PickupItem {
  id: number;
  kind: 'shield' | 'overdrive' | 'rebel';
  u: number;
  v: number;
  bob: number;
}

interface RotjObstacle {
  id: number;
  kind: 'redwood' | 'log' | 'ewok_trap' | 'mine' | 'girder' | 'pylon' | 'force_gate' | 'blast_door';
  u: number;
  v: number;
  radius: number;
  height: number;
  shade: number;
  triggered?: boolean;
  triggerAnim?: number; // 0..1 swinging log crush or opening gate
  hp?: number;
  gapV?: number; // safe opening v for force_gate / blast_door
}

interface RotjEnemy {
  id: number;
  kind: 'scout' | 'atst' | 'turret' | 'interceptor' | 'bunker_conduit' | 'shield_dish' | 'core_conduit' | 'reactor_core';
  u: number;
  v: number;
  vu: number;
  vv: number;
  hp: number;
  maxHp: number;
  fireCd: number;
  stride: number;
  hitFlash: number;
  rammed?: boolean;
  side?: -1 | 1;
}

interface RotjBolt {
  u: number;
  v: number;
  z: number;
  vu: number;
  vv: number;
  vz: number;
  friendly: boolean;
  mortar?: boolean;
  color: string;
  life: number;
}

export class StarWarsRotjGame implements ArcadeGameInstance {
  public readonly logicalWidth = W;
  public readonly logicalHeight = H;
  public readonly supportsPointerAim = true;
  public readonly primaryActionLabel = 'BLASTER';
  public readonly secondaryActionLabel = 'TURBO / MORTAR';

  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();
  private score = 0;
  private highScore = readHighScore(HS_KEY);
  private wave = 1;
  private lives = 4;
  private shieldHits = 3; // 3 shield pips per vehicle life!
  private readonly maxShieldHits = 3;

  // Stage 0: Endor Speeder Bike (Leia)
  // Stage 1: Endor Shield Bunker AT-ST (Chewbacca)
  // Stage 2: Death Star II Falcon (subPhase 0: Surface, 1: Interior Tunnel, 2: Reactor Core, 3: Fireball Escape!)
  private subStage: 0 | 1 | 2 = 0;
  private dsPhase: 0 | 1 | 2 | 3 = 0;
  private stageDistance = 0;
  private stageGoal = 110;
  private bossSpawned = false;
  private villageApproaching = false;
  private villageU = 980;
  private escapeProgress = 0; // 0..100
  private fireballWallU = -280;
  private exitPortalU = 1100;

  // Player state in isometric coords
  private playerU = 60;
  private playerV = 0;
  private prevPlayerV = 0;
  private playerBank = 0; // visual banking roll (-1..1)
  private playerStride = 0;
  private invulnTimer = 0;
  private boostTimer = 0;
  private boostEnergy = 1;
  private overdriveTimer = 0;
  private fireCd = 0;

  // Combo scoring
  private comboCount = 0;
  private comboTimer = 0;

  // World scroll & spawners
  private scrollOffset = 0;
  private spawnObsCd = 0.3;
  private spawnEnemyCd = 0.85;
  private gliderCd = 4.5;
  private klaxonCd = 0;
  private shakeTimer = 0;
  private hitFlash = 0;
  private whiteFlash = 0;
  private phaseTimer = 0;
  private elapsed = 0;
  private bannerText = 'RETURN OF THE JEDI (1984) — 2.5D ISOMETRIC RASTER DELUXE';

  private nextId = 1;
  private obstacles: RotjObstacle[] = [];
  private enemies: RotjEnemy[] = [];
  private bolts: RotjBolt[] = [];
  private pickups: PickupItem[] = [];
  private gliders: EwokGlider[] = [];
  private explosions: RasterExplosion[] = [];
  private debris: DebrisChunk[] = [];
  private dust: DustPuff[] = [];
  private scorches: ScorchMark[] = [];
  private spaceLasers: SpaceBattleLaser[] = [];
  private popups: ScorePopup[] = [];

  // Background stars for Death Star II space edges
  private bgStars: Array<{ x: number; y: number; s: number; tw: number }> = [];

  constructor() {
    for (let i = 0; i < 95; i++) {
      this.bgStars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        s: 1 + Math.random() * 1.8,
        tw: Math.random() * Math.PI * 2,
      });
    }
  }

  public startNewGame(): void {
    arcadeAudio.unlock();
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.wave = 1;
    this.lives = 4;
    this.shieldHits = this.maxShieldHits;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.overdriveTimer = 0;
    this.setupSubStage(0);
    this.phase = 'READY';
    this.phaseTimer = 1.15;
    this.bannerText = 'STAGE 1 — FOREST MOON OF ENDOR: LEIA ON 74-Z SPEEDER BIKE!';
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.obstacles = [];
    this.enemies = [];
    this.bolts = [];
    this.pickups = [];
    this.gliders = [];
    this.explosions = [];
    this.debris = [];
    this.dust = [];
    this.scorches = [];
    this.popups = [];
    this.dsPhase = 0;
    this.bannerText = 'RETURN OF THE JEDI (1984) — 2.5D ISOMETRIC RASTER';
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public getHudSnapshot(): ClassicGameHud {
    let stageName = `W${this.wave} · ENDOR SPEEDER CHASE`;
    let pLabel = 'VILLAGE';
    let pVal = `${Math.min(100, Math.round((this.stageDistance / this.stageGoal) * 100))}%`;

    if (this.subStage === 1) {
      stageName = `W${this.wave} · AT-ST SHIELD BUNKER`;
      const dish = this.enemies.find((e) => e.kind === 'shield_dish');
      if (dish) {
        pLabel = 'SHIELD DISH';
        pVal = `${Math.max(0, Math.round((dish.hp / dish.maxHp) * 100))}%`;
      } else {
        pLabel = 'BUNKER';
      }
    } else if (this.subStage === 2) {
      if (this.dsPhase === 0) {
        stageName = `W${this.wave} · DEATH STAR II SURFACE`;
        pLabel = 'TUNNEL';
      } else if (this.dsPhase === 1) {
        stageName = `W${this.wave} · REACTOR TUNNEL`;
        pLabel = 'CORE DIST';
      } else if (this.dsPhase === 2) {
        stageName = `W${this.wave} · MAIN REACTOR CORE`;
        const core = this.enemies.find((e) => e.kind === 'reactor_core');
        pLabel = 'CORE HP';
        pVal = core ? `${Math.max(0, Math.round((core.hp / core.maxHp) * 100))}%` : '0%';
      } else {
        stageName = `W${this.wave} · FIREBALL ESCAPE!`;
        pLabel = 'ESCAPE';
        pVal = `${Math.min(100, Math.round(this.escapeProgress))}%`;
      }
    }

    const secLabels = ['RAM BOOST', 'MORTAR', 'AFTERBURN'];
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.wave,
      lives: this.lives,
      stageName,
      primaryMetricLabel: pLabel,
      primaryMetricValue: pVal,
      secondaryMetricLabel: this.comboCount >= 2 ? `COMBO ${this.comboCount}X` : secLabels[this.subStage],
      secondaryMetricValue: `${Math.round(this.boostEnergy * 100)}%`,
      bannerText: this.bannerText,
    };
  }

  private addScore(pts: number, sx?: number, sy?: number, color = '#FACC15', label?: string, countCombo = false): void {
    let mult = 1;
    if (countCombo) {
      this.comboCount = Math.min(6, this.comboCount + 1);
      this.comboTimer = 2.8;
      mult = Math.min(4, 1 + Math.floor((this.comboCount - 1) / 2));
    }
    const finalPts = pts * mult;
    this.score += finalPts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(HS_KEY, this.highScore);
    }
    if (sx !== undefined && sy !== undefined) {
      const txt = label ?? (mult > 1 ? `+${finalPts} (${mult}×)` : `+${finalPts}`);
      this.popups.push({
        x: sx,
        y: sy,
        text: txt,
        color,
        life: 1.0,
        maxLife: 1.0,
      });
    }
  }

  private setupSubStage(stage: 0 | 1 | 2): void {
    this.subStage = stage;
    this.dsPhase = 0;
    this.obstacles = [];
    this.enemies = [];
    this.bolts = [];
    this.pickups = [];
    this.gliders = [];
    this.scorches = [];
    this.dust = [];
    this.stageDistance = 0;
    this.bossSpawned = false;
    this.villageApproaching = false;
    this.villageU = 980;
    this.escapeProgress = 0;
    this.fireballWallU = -280;
    this.exitPortalU = 1120;
    this.playerU = 60;
    this.playerV = 0;
    this.prevPlayerV = 0;
    this.playerBank = 0;
    this.boostTimer = 0;
    this.boostEnergy = 1;
    this.invulnTimer = 1.3;
    this.spawnObsCd = 0.22;
    this.spawnEnemyCd = 0.85;
    this.gliderCd = 3.2;

    if (stage === 0) {
      this.stageGoal = 110 + this.wave * 15;
      this.bannerText = 'STAGE 1: ENDOR FOREST — RAM SCOUTS INTO REDWOODS [SHIFT] & SHOOT EWOK TRAPS!';
      for (let i = 0; i < 8; i++) {
        this.spawnObstacle(310 + i * 110);
      }
    } else if (stage === 1) {
      this.stageGoal = 95 + this.wave * 15;
      this.bannerText = 'STAGE 2: CHEWBACCA AT-ST — EWOK GLIDERS & LOG TRAPS AID YOUR BUNKER ASSAULT!';
      for (let i = 0; i < 5; i++) {
        this.spawnObstacle(340 + i * 155);
      }
    } else {
      this.stageGoal = 115 + this.wave * 15;
      this.bannerText = 'STAGE 3A: MILLENNIUM FALCON — BREACH DEATH STAR II SURFACE FORCE-GATES!';
      for (let i = 0; i < 5; i++) {
        this.spawnObstacle(360 + i * 160);
      }
    }
  }

  private spawnRasterExplosion(sx: number, sy: number, heavy = false, u?: number, v?: number, debrisColor = '#94A3B8'): void {
    const baseR = heavy ? 58 : 31;
    const puffs: RasterExplosion['puffs'] = [];
    const puffCount = heavy ? 13 : 7;
    const cols = ['#FEF08A', '#FB923C', '#F97316', '#EF4444', '#B91C1C'];
    for (let i = 0; i < puffCount; i++) {
      const a = (Math.PI * 2 * i) / puffCount + (Math.random() - 0.5) * 0.5;
      const dist = Math.random() * baseR * 0.68;
      puffs.push({
        dx: Math.cos(a) * dist,
        dy: Math.sin(a) * dist - Math.random() * 16,
        r: baseR * (0.34 + Math.random() * 0.46),
        delay: Math.random() * 0.14,
        col: cols[i % cols.length],
      });
    }
    this.explosions.push({
      sx,
      sy,
      life: heavy ? 0.92 : 0.56,
      maxLife: heavy ? 0.92 : 0.56,
      radius: baseR,
      heavy,
      ringMax: heavy ? 96 : 48,
      puffs,
    });

    // Spinning hull fragments, wood splinters & glowing embers
    const count = heavy ? 28 : 14;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = (heavy ? 135 : 85) + Math.random() * (heavy ? 225 : 140);
      const ml = 0.38 + Math.random() * 0.48;
      const isDebris = i % 3 === 0;
      this.debris.push({
        sx,
        sy,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - (heavy ? 75 : 48),
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 16,
        life: ml,
        maxLife: ml,
        color: isDebris ? debrisColor : i % 2 === 0 ? '#FEF08A' : '#F97316',
        w: isDebris ? (heavy ? 8 : 5) : 3.2,
        h: isDebris ? (heavy ? 4.5 : 3) : 3.2,
        gravity: isDebris ? 340 : 210,
      });
    }

    if (u !== undefined && v !== undefined) {
      this.scorches.push({ u, v, r: heavy ? 42 : 24, alpha: 0.78 });
      if (this.scorches.length > 22) this.scorches.shift();
    }

    if (heavy) {
      this.shakeTimer = Math.max(this.shakeTimer, 0.28);
      this.whiteFlash = Math.max(this.whiteFlash, 0.18);
    }
  }

  private maybeSpawnPickup(u: number, v: number): void {
    if (Math.random() > 0.26) return;
    const r = Math.random();
    const kind: PickupItem['kind'] = r < 0.38 ? 'shield' : r < 0.74 ? 'overdrive' : 'rebel';
    this.pickups.push({ id: this.nextId++, kind, u, v, bob: Math.random() * Math.PI * 2 });
  }

  private damagePlayer(reason: string): void {
    if (this.invulnTimer > 0) return;
    // Afterburner in Stage 3 Fireball escape grants brief grace deflection against small debris
    const p = isoToScreen(this.playerU, this.playerV, this.subStage === 2 ? 24 : 14);
    this.shieldHits -= 1;
    this.comboCount = 0;
    this.invulnTimer = 1.35;
    this.hitFlash = 0.42;
    this.shakeTimer = 0.3;

    if (this.shieldHits > 0) {
      arcadeAudio.playRasterExplosion(false);
      this.spawnRasterExplosion(p.sx, p.sy, false, this.playerU, this.playerV);
      this.bannerText = `ARMOR HIT (${this.shieldHits}/${this.maxShieldHits}) — ${reason}!`;
      return;
    }

    this.lives -= 1;
    this.shieldHits = this.maxShieldHits;
    this.invulnTimer = 1.85;
    arcadeAudio.playRasterExplosion(true);
    this.spawnRasterExplosion(p.sx, p.sy, true, this.playerU, this.playerV);
    this.bannerText = this.lives <= 1 ? `FINAL REBEL VEHICLE! — ${reason}` : `VEHICLE DESTROYED — ${reason}!`;

    if (this.lives <= 0) {
      this.phase = 'GAME_OVER';
      this.bannerText = 'THE EMPIRE PREVAILS — PRESS PLAY TO REJOIN THE REBELLION';
      arcadeAudio.playDeath();
    }
  }

  public step(dt: number): void {
    const safeDt = Math.min(0.05, dt);
    this.elapsed += safeDt;
    this.stepEffects(safeDt);

    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - safeDt);
    if (this.whiteFlash > 0) this.whiteFlash = Math.max(0, this.whiteFlash - safeDt);
    if (this.shakeTimer > 0) this.shakeTimer = Math.max(0, this.shakeTimer - safeDt);
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - safeDt);
    if (this.boostTimer > 0) this.boostTimer = Math.max(0, this.boostTimer - safeDt);
    if (this.overdriveTimer > 0) this.overdriveTimer = Math.max(0, this.overdriveTimer - safeDt);
    if (this.comboTimer > 0) {
      this.comboTimer -= safeDt;
      if (this.comboTimer <= 0) this.comboCount = 0;
    }

    // Background space battle laser exchanges in Stage 3A (Death Star II Surface!)
    if (this.subStage === 2 && this.dsPhase === 0 && Math.random() < safeDt * 4.5) {
      const topSide = Math.random() < 0.5;
      const x0 = topSide ? 35 + Math.random() * 190 : W - 190 + Math.random() * 150;
      const y0 = topSide ? 55 + Math.random() * 120 : H - 170 + Math.random() * 110;
      this.spaceLasers.push({
        x0,
        y0,
        x1: x0 + (topSide ? 95 : -95) + (Math.random() - 0.5) * 40,
        y1: y0 + (Math.random() - 0.5) * 55,
        color: Math.random() < 0.5 ? '#4ADE80' : '#EF4444',
        life: 0.24,
        maxLife: 0.24,
      });
    }

    if (this.phase === 'TITLE' || this.phase === 'PAUSED' || this.phase === 'GAME_OVER') {
      this.scrollOffset += safeDt * 185;
      return;
    }

    if (this.phase === 'READY') {
      this.scrollOffset += safeDt * 230;
      this.phaseTimer -= safeDt;
      if (this.phaseTimer <= 0) this.phase = 'PLAYING';
      return;
    }

    if (this.phase === 'STAGE_CLEAR') {
      this.scrollOffset += safeDt * 440;
      this.phaseTimer -= safeDt;
      if (Math.random() < safeDt * 11) {
        this.spawnRasterExplosion(110 + Math.random() * 340, 210 + Math.random() * 260, Math.random() < 0.35);
      }
      if (this.phaseTimer <= 0) {
        this.wave += 1;
        this.lives = Math.min(6, this.lives + 1);
        this.shieldHits = this.maxShieldHits;
        this.setupSubStage(0);
        this.phase = 'READY';
        this.phaseTimer = 1.2;
      }
      return;
    }

    // --- Smooth Diagonal-Isometric Steering (Mouse/Touch + Keyboard + On-Screen Joystick) ---
    this.prevPlayerV = this.playerV;
    const boostMult = this.boostTimer > 0 ? 1.58 : 1.0;
    const baseSpd = this.subStage === 1 ? 275 : 355;
    const moveSpd = baseSpd * boostMult;

    if (this.input.left) this.playerV -= moveSpd * safeDt;
    if (this.input.right) this.playerV += moveSpd * safeDt;
    if (this.input.up) this.playerU += moveSpd * 0.82 * safeDt;
    if (this.input.down) this.playerU -= moveSpd * 0.82 * safeDt;

    if (this.input.pointerActive) {
      const target = screenToIso(this.input.pointerX * W, this.input.pointerY * H);
      const clampedU = Math.max(-25, Math.min(255, target.u));
      const clampedV = Math.max(-195, Math.min(195, target.v));
      this.playerU += (clampedU - this.playerU) * Math.min(1, safeDt * 13);
      this.playerV += (clampedV - this.playerV) * Math.min(1, safeDt * 15);
    }

    const maxLane = this.subStage === 2 && this.dsPhase >= 1 ? 168 : 198;
    this.playerU = Math.max(-25, Math.min(255, this.playerU));
    this.playerV = Math.max(-maxLane, Math.min(maxLane, this.playerV));

    // Visual banking angle for Speeder Bike & Millennium Falcon
    const dvRate = (this.playerV - this.prevPlayerV) / Math.max(0.001, safeDt);
    const targetBank = Math.max(-1, Math.min(1, dvRate / 320));
    this.playerBank += (targetBank - this.playerBank) * Math.min(1, safeDt * 10);

    // Speeder hover dust / AT-ST stomping dust puffs
    if (this.subStage === 1) {
      const prevSin = Math.sin(this.playerStride);
      this.playerStride += safeDt * 8.4;
      if (prevSin < 0 && Math.sin(this.playerStride) >= 0) {
        arcadeAudio.playAtAtStomp();
        this.dust.push({
          u: this.playerU - 12,
          v: this.playerV + (Math.random() - 0.5) * 18,
          z: 4,
          r: 12,
          life: 0.42,
          maxLife: 0.42,
          color: '#A8A29E',
        });
      }
    } else if (this.subStage === 0 && Math.random() < safeDt * 16) {
      this.dust.push({
        u: this.playerU - 24,
        v: this.playerV + (Math.random() - 0.5) * 10,
        z: 3,
        r: this.boostTimer > 0 ? 11 : 7,
        life: 0.3,
        maxLife: 0.3,
        color: this.boostTimer > 0 ? '#7DD3FC' : '#BEF264',
      });
    }

    // World scroll velocity
    const worldSpeed =
      (this.subStage === 0
        ? 410
        : this.subStage === 1
          ? 245
          : this.dsPhase === 3
            ? 520
            : this.dsPhase === 2
              ? 180
              : 385) *
      boostMult *
      (1 + (this.wave - 1) * 0.08);
    this.scrollOffset += worldSpeed * safeDt;
    for (const sc of this.scorches) sc.u -= worldSpeed * safeDt;
    this.scorches = this.scorches.filter((sc) => sc.u > -260);
    for (const d of this.dust) {
      d.u -= worldSpeed * 0.65 * safeDt;
      d.z += 16 * safeDt;
      d.life -= safeDt;
    }
    this.dust = this.dust.filter((d) => d.life > 0);

    // --- Stage Progression & Authentic Landmarks ---
    if (this.subStage === 0) {
      this.stageDistance += safeDt * 8.6 * boostMult;
      if (!this.villageApproaching && this.stageDistance >= this.stageGoal * 0.86) {
        this.villageApproaching = true;
        this.villageU = 960;
        arcadeAudio.playEwokHorn();
        this.bannerText = 'EWOK TREETOP VILLAGE IN SIGHT — BREAK THROUGH TO THE CLEARING!';
      }
      if (this.villageApproaching) {
        this.villageU -= worldSpeed * 0.55 * safeDt;
        if (this.villageU <= this.playerU + 95) {
          const p = isoToScreen(this.playerU, this.playerV, 20);
          this.addScore(3000, p.sx, p.sy - 24, '#4ADE80', 'EWOK VILLAGE REACHED +3000!');
          arcadeAudio.playStageClear();
          this.setupSubStage(1);
          return;
        }
      }
    } else if (this.subStage === 1) {
      if (!this.bossSpawned) {
        this.stageDistance += safeDt * 7.6 * boostMult;
        if (this.stageDistance >= this.stageGoal) {
          this.spawnShieldBunkerBoss();
        }
      }
      // Friendly Ewok Hang-Gliders swoop over Stage 2 dropping boulders on Imperials!
      this.gliderCd -= safeDt;
      if (this.gliderCd <= 0 && this.gliders.length < 1) {
        this.gliderCd = 6.2;
        this.gliders.push({
          u: 760,
          v: -220,
          vu: -95,
          vv: 130,
          dropCd: 0.9,
          wingFlap: 0,
        });
      }
      this.stepEwokGliders(safeDt);
    } else if (this.subStage === 2) {
      if (this.dsPhase === 0) {
        // Outer Death Star II Surface -> Enter Interior Reactor Tunnel at 50%
        this.stageDistance += safeDt * 8.2 * boostMult;
        if (this.stageDistance >= this.stageGoal * 0.5) {
          this.dsPhase = 1;
          this.obstacles = [];
          this.bannerText = 'STAGE 3B: ENTERING DEATH STAR II REACTOR TUNNEL — WATCH THE GIRDERS!';
          arcadeAudio.playPowerUp();
        }
      } else if (this.dsPhase === 1) {
        // Interior Reactor Tunnel -> Main Reactor Core Chamber at 100%
        this.stageDistance += safeDt * 8.4 * boostMult;
        if (this.stageDistance >= this.stageGoal) {
          this.spawnReactorCoreBoss();
        }
      } else if (this.dsPhase === 3) {
        // Iconic Fireball Outrun Escape!
        this.escapeProgress += safeDt * (10.8 * boostMult);
        this.klaxonCd -= safeDt;
        if (this.klaxonCd <= 0) {
          this.klaxonCd = 1.6;
          arcadeAudio.playReactorKlaxon();
        }
        const wallTarget = this.playerU - (this.boostTimer > 0 ? 155 : 72) + Math.sin(this.elapsed * 7) * 14;
        this.fireballWallU += (wallTarget - this.fireballWallU) * Math.min(1, safeDt * 1.45);
        if (Math.random() < safeDt * 12) {
          const fp = isoToScreen(this.fireballWallU + 30, (Math.random() - 0.5) * 320, 18);
          this.spawnRasterExplosion(fp.sx, fp.sy, false);
        }
        if (this.escapeProgress >= 80) {
          this.exitPortalU = Math.max(this.playerU + 40, (100 - this.escapeProgress) * 32 + 120);
        }
        if (this.escapeProgress >= 100) {
          const bonus = 15000 + this.wave * 5000;
          this.whiteFlash = 0.75;
          this.addScore(bonus, W * 0.5, H * 0.34, '#FEF08A', `DEATH STAR II DESTROYED +${bonus}!`);
          arcadeAudio.playDeathStarSupernova();
          this.phase = 'STAGE_CLEAR';
          this.phaseTimer = 3.0;
          this.bannerText = 'YAHOO! MILLENNIUM FALCON BURST FREE OF THE DEATH STAR II SUPERNOVA!';
          return;
        }
      }
    }

    // --- Weapons & Secondary Actions ---
    if (this.fireCd > 0) this.fireCd -= safeDt;
    this.boostEnergy = Math.min(1, this.boostEnergy + safeDt * 0.24);

    if ((this.input.fire || this.input.fireJustPressed) && this.fireCd <= 0) {
      this.firePlayerWeapon(false);
    }
    if (this.input.secondaryJustPressed && this.boostEnergy >= 0.42) {
      if (this.subStage === 1) {
        this.boostEnergy = Math.max(0, this.boostEnergy - 0.42);
        this.firePlayerWeapon(true); // AT-ST Arcing Concussion Mortar Barrage
      } else {
        this.boostEnergy = Math.max(0, this.boostEnergy - 0.48);
        this.boostTimer = 1.35;
        arcadeAudio.playSpeederBikeLaser(true);
        const p = isoToScreen(this.playerU, this.playerV, 20);
        this.popups.push({
          x: p.sx,
          y: p.sy - 26,
          text: this.subStage === 0 ? 'TURBO RAM SURGE!' : 'FALCON AFTERBURNER!',
          color: '#38BDF8',
          life: 0.8,
          maxLife: 0.8,
        });
      }
    }

    // --- Spawn Obstacles & Enemies ---
    this.spawnObsCd -= safeDt;
    if (this.spawnObsCd <= 0) {
      const rate =
        this.subStage === 0
          ? 0.35
          : this.subStage === 1
            ? 0.65
            : this.dsPhase === 3
              ? 0.44
              : this.dsPhase === 2
                ? 1.5
                : 0.52;
      this.spawnObsCd = Math.max(0.22, rate - this.wave * 0.02);
      if ((!this.bossSpawned && !this.villageApproaching) || this.dsPhase === 3) {
        this.spawnObstacle(940);
      }
    }

    this.spawnEnemyCd -= safeDt;
    if (this.spawnEnemyCd <= 0 && this.enemies.length < (this.bossSpawned ? 5 : 6)) {
      this.spawnEnemyCd = Math.max(0.6, (this.subStage === 0 ? 1.25 : 1.45) - this.wave * 0.08);
      if (!this.villageApproaching && this.dsPhase !== 3) {
        this.spawnEnemy();
      }
    }

    this.stepObstacles(safeDt, worldSpeed);
    this.stepEnemies(safeDt, worldSpeed);
    this.stepBolts(safeDt);
    this.stepPickups(safeDt, worldSpeed);
  }

  private spawnShieldBunkerBoss(): void {
    this.bossSpawned = true;
    // Authentic multi-part Endor Shield Generator Complex: 2 Power Conduits + Rotating Dish!
    this.enemies.push(
      {
        id: this.nextId++,
        kind: 'bunker_conduit',
        side: -1,
        u: 610,
        v: -105,
        vu: 0,
        vv: 0,
        hp: 5 + this.wave,
        maxHp: 5 + this.wave,
        fireCd: 1.0,
        stride: 0,
        hitFlash: 0,
      },
      {
        id: this.nextId++,
        kind: 'bunker_conduit',
        side: 1,
        u: 610,
        v: 105,
        vu: 0,
        vv: 0,
        hp: 5 + this.wave,
        maxHp: 5 + this.wave,
        fireCd: 1.3,
        stride: 0,
        hitFlash: 0,
      },
      {
        id: this.nextId++,
        kind: 'shield_dish',
        u: 650,
        v: 0,
        vu: 0,
        vv: 55,
        hp: 14 + this.wave * 4,
        maxHp: 14 + this.wave * 4,
        fireCd: 1.1,
        stride: 0,
        hitFlash: 0,
      }
    );
    arcadeAudio.playEwokHorn();
    this.bannerText = 'IMPERIAL SHIELD BUNKER — DESTROY FLANKING CONDUITS THEN SHATTER THE DISH!';
  }

  private spawnReactorCoreBoss(): void {
    this.dsPhase = 2;
    this.bossSpawned = true;
    this.obstacles = [];
    this.enemies.push(
      {
        id: this.nextId++,
        kind: 'core_conduit',
        side: -1,
        u: 580,
        v: -98,
        vu: 0,
        vv: 0,
        hp: 6 + this.wave,
        maxHp: 6 + this.wave,
        fireCd: 0.9,
        stride: 0,
        hitFlash: 0,
      },
      {
        id: this.nextId++,
        kind: 'core_conduit',
        side: 1,
        u: 580,
        v: 98,
        vu: 0,
        vv: 0,
        hp: 6 + this.wave,
        maxHp: 6 + this.wave,
        fireCd: 1.2,
        stride: 0,
        hitFlash: 0,
      },
      {
        id: this.nextId++,
        kind: 'reactor_core',
        u: 625,
        v: 0,
        vu: 0,
        vv: 48,
        hp: 18 + this.wave * 5,
        maxHp: 18 + this.wave * 5,
        fireCd: 0.85,
        stride: 0,
        hitFlash: 0,
      }
    );
    arcadeAudio.playReactorKlaxon();
    this.bannerText = 'STAGE 3C: MAIN REACTOR CHAMBER — DESTROY REGULATOR CONDUITS & CORE!';
  }

  private stepEwokGliders(dt: number): void {
    for (let i = this.gliders.length - 1; i >= 0; i--) {
      const g = this.gliders[i];
      g.u += g.vu * dt;
      g.v += g.vv * dt;
      g.wingFlap += dt * 7;
      g.dropCd -= dt;
      if (g.dropCd <= 0) {
        g.dropCd = 1.1;
        // Drop friendly Ewok boulder onto Imperial enemies!
        this.bolts.push({
          u: g.u,
          v: g.v,
          z: 92,
          vu: 25,
          vv: 0,
          vz: -180,
          friendly: true,
          mortar: true,
          color: '#D97706',
          life: 1.1,
        });
      }
      if (g.v > 260 || g.u < -120) this.gliders.splice(i, 1);
    }
  }

  private stepObstacles(dt: number, worldSpeed: number): void {
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const ob = this.obstacles[i];
      ob.u -= worldSpeed * dt;

      if (ob.kind === 'ewok_trap' && ob.triggered) {
        ob.triggerAnim = Math.min(1, (ob.triggerAnim ?? 0) + dt * 3.8);
        // Swinging twin giant redwood logs crush any nearby enemy!
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const en = this.enemies[j];
          if (en.kind === 'shield_dish' || en.kind === 'reactor_core') continue;
          if (Math.abs(en.u - ob.u) < 95 && Math.abs(en.v - ob.v) < 135) {
            const p = isoToScreen(en.u, en.v, 22);
            arcadeAudio.playRasterExplosion(true);
            this.spawnRasterExplosion(p.sx, p.sy, true, en.u, en.v, '#78350F');
            this.addScore(1500, p.sx, p.sy - 20, '#4ADE80', 'EWOK LOG CRUSH +1500!', true);
            this.enemies.splice(j, 1);
          }
        }
      }

      if (ob.kind === 'force_gate' || ob.kind === 'blast_door') {
        if (!ob.triggered && Math.abs(ob.u - this.playerU) < 26) {
          const gap = ob.gapV ?? 0;
          if (Math.abs(this.playerV - gap) > 58) {
            this.damagePlayer(ob.kind === 'force_gate' ? 'LASER FORCE GATE' : 'COLLAPSING BLAST DOOR');
            ob.triggered = true;
          } else {
            ob.triggered = true;
            const p = isoToScreen(this.playerU, this.playerV, 24);
            this.addScore(250, p.sx, p.sy - 22, '#38BDF8', 'CLEAN PASS +250');
          }
        }
      } else if (ob.kind !== 'ewok_trap') {
        const du = Math.abs(ob.u - this.playerU);
        const dv = Math.abs(ob.v - this.playerV);
        if (du < ob.radius * 0.8 && dv < ob.radius * 0.8) {
          const label =
            ob.kind === 'redwood'
              ? 'REDWOOD TRUNK'
              : ob.kind === 'mine'
                ? 'IMPERIAL LAND MINE'
                : ob.kind === 'girder'
                  ? 'STEEL GIRDER'
                  : 'FALLEN LOG';
          this.damagePlayer(label);
          this.obstacles.splice(i, 1);
          continue;
        }
      }

      if (ob.u < -260) this.obstacles.splice(i, 1);
    }
  }

  private stepEnemies(dt: number, worldSpeed: number): void {
    const conduitsAlive = this.enemies.some((e) => e.kind === 'bunker_conduit' || e.kind === 'core_conduit');

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const en = this.enemies[i];
      if (en.hitFlash > 0) en.hitFlash -= dt;
      en.stride += dt * 6.5;

      if (
        en.kind === 'shield_dish' ||
        en.kind === 'bunker_conduit' ||
        en.kind === 'reactor_core' ||
        en.kind === 'core_conduit'
      ) {
        const targetU = en.kind === 'bunker_conduit' || en.kind === 'core_conduit' ? 500 : 565;
        en.u += (targetU - en.u) * Math.min(1, dt * 2.4);
        if (en.kind === 'shield_dish' || en.kind === 'reactor_core') {
          en.v += en.vv * dt;
          if (Math.abs(en.v) > 115) en.vv = -en.vv;
        }
        en.fireCd -= dt;
        if (en.fireCd <= 0) {
          en.fireCd = Math.max(0.62, (en.kind === 'reactor_core' ? 1.0 : 1.25) - this.wave * 0.08);
          const spreads = en.kind === 'shield_dish' || en.kind === 'reactor_core' ? [-65, 0, 65] : [0];
          for (const sp of spreads) {
            this.bolts.push({
              u: en.u - 30,
              v: en.v,
              z: 24,
              vu: -430,
              vv: sp + (this.playerV - en.v) * 0.36,
              vz: 0,
              friendly: false,
              color: en.kind === 'reactor_core' || en.kind === 'core_conduit' ? '#38BDF8' : '#EF4444',
              life: 2.2,
            });
          }
        }
        continue;
      }

      if (en.rammed) {
        // Side-rammed Imperial Scout Trooper careening into nearest Redwood trunk!
        en.v += en.vv * dt;
        en.u -= worldSpeed * 0.22 * dt;
        for (const ob of this.obstacles) {
          if (ob.kind === 'redwood' && Math.hypot(ob.u - en.u, ob.v - en.v) < ob.radius + 34) {
            const p = isoToScreen(en.u, en.v, 20);
            arcadeAudio.playRasterExplosion(true);
            this.spawnRasterExplosion(p.sx, p.sy, true, en.u, en.v, '#78350F');
            this.addScore(1000, p.sx, p.sy - 20, '#FEF08A', 'REDWOOD SMASH +1000!', true);
            this.maybeSpawnPickup(en.u, en.v);
            this.enemies.splice(i, 1);
            break;
          }
        }
        if (Math.abs(en.v) > 250) this.enemies.splice(i, 1);
        continue;
      }

      en.u += (en.vu - worldSpeed * (en.kind === 'turret' ? 1.0 : 0.44)) * dt;
      en.v += en.vv * dt;
      if (Math.abs(en.v) > 175) en.vv = -en.vv;

      // Iconic Stage 1 Speeder Bike Side-Ram Takedown!
      if (this.subStage === 0 && en.kind === 'scout') {
        const dist = Math.hypot(en.u - this.playerU, en.v - this.playerV);
        if (dist < 44) {
          if (this.boostTimer > 0 || Math.abs(this.playerBank) > 0.35) {
            en.rammed = true;
            en.vv = en.v >= this.playerV ? 450 : -450;
            const p = isoToScreen(en.u, en.v, 18);
            arcadeAudio.playGateSmash();
            this.addScore(500, p.sx, p.sy - 14, '#38BDF8', 'SIDESWIPE RAM +500!', true);
            continue;
          } else {
            this.damagePlayer('SCOUT COLLISION');
            this.enemies.splice(i, 1);
            continue;
          }
        }
      } else if (Math.hypot(en.u - this.playerU, en.v - this.playerV) < 38) {
        this.damagePlayer(en.kind === 'atst' ? 'IMPERIAL AT-ST' : 'IMPERIAL CRAFT');
        this.enemies.splice(i, 1);
        continue;
      }

      en.fireCd -= dt;
      if (en.fireCd <= 0 && en.u > this.playerU + 55 && en.u < 760) {
        en.fireCd = Math.max(0.8, 1.75 - this.wave * 0.09);
        this.bolts.push({
          u: en.u - 22,
          v: en.v,
          z: 22,
          vu: -420,
          vv: (this.playerV - en.v) * 0.42,
          vz: 0,
          friendly: false,
          color: en.kind === 'interceptor' ? '#4ADE80' : '#EF4444',
          life: 2.0,
        });
      }

      if (en.u < -220) this.enemies.splice(i, 1);
    }

    // Keep unused warning quiet while informing boss shield state
    void conduitsAlive;
  }

  private stepBolts(dt: number): void {
    const bunkerConduitsAlive = this.enemies.some((e) => e.kind === 'bunker_conduit');
    const coreConduitsAlive = this.enemies.some((e) => e.kind === 'core_conduit');

    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.u += b.vu * dt;
      b.v += b.vv * dt;
      if (b.mortar) {
        b.z += b.vz * dt;
        b.vz -= 260 * dt;
        if (b.z <= 2) {
          // Concussion Mortar ground splash impact!
          const p = isoToScreen(b.u, b.v, 6);
          arcadeAudio.playRasterExplosion(true);
          this.spawnRasterExplosion(p.sx, p.sy, true, b.u, b.v);
          this.damageAreaSplash(b.u, b.v, 92, 3);
          this.bolts.splice(i, 1);
          continue;
        }
      }
      b.life -= dt;
      if (b.life <= 0 || b.u > 980 || b.u < -220 || Math.abs(b.v) > 320) {
        this.bolts.splice(i, 1);
        continue;
      }

      if (b.friendly) {
        // 1. Check shootable Ewok Trap Triggers, Mines & Force Gate Generators!
        let hitObs = false;
        for (let k = this.obstacles.length - 1; k >= 0; k--) {
          const ob = this.obstacles[k];
          if (ob.kind === 'ewok_trap' && !ob.triggered && Math.hypot(ob.u - b.u, ob.v - b.v) < 55) {
            ob.triggered = true;
            ob.triggerAnim = 0.05;
            arcadeAudio.playEwokHorn();
            const p = isoToScreen(ob.u, ob.v, 36);
            this.addScore(400, p.sx, p.sy, '#4ADE80', 'EWOK TRAP SPRUNG!');
            hitObs = true;
            break;
          }
          if (ob.kind === 'mine' && Math.hypot(ob.u - b.u, ob.v - b.v) < 34) {
            const p = isoToScreen(ob.u, ob.v, 10);
            arcadeAudio.playRasterExplosion(false);
            this.spawnRasterExplosion(p.sx, p.sy, false, ob.u, ob.v);
            this.addScore(250, p.sx, p.sy, '#F97316', 'MINE CLEARED +250');
            this.obstacles.splice(k, 1);
            hitObs = true;
            break;
          }
        }
        if (hitObs && !b.mortar) {
          this.bolts.splice(i, 1);
          continue;
        }

        // 2. Check Enemy Hits
        let consumed = false;
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const en = this.enemies[j];
          const hitRad =
            en.kind === 'shield_dish' || en.kind === 'reactor_core'
              ? 68
              : en.kind === 'bunker_conduit' || en.kind === 'core_conduit'
                ? 44
                : en.kind === 'atst'
                  ? 44
                  : 36;
          if (Math.hypot(en.u - b.u, en.v - b.v) < hitRad) {
            const p = isoToScreen(en.u, en.v, 24);
            // Shielded Boss takes reduced damage until flanking power conduits are knocked out!
            const shielded =
              (en.kind === 'shield_dish' && bunkerConduitsAlive) ||
              (en.kind === 'reactor_core' && coreConduitsAlive);
            const dmg = b.mortar ? 3 : shielded ? 0.35 : this.overdriveTimer > 0 ? 1.8 : 1;
            en.hp -= dmg;
            en.hitFlash = 0.14;
            consumed = !b.mortar;

            if (en.hp <= 0) {
              this.handleEnemyDestroyed(en, p.sx, p.sy);
              this.enemies.splice(j, 1);
            } else {
              arcadeAudio.playRasterExplosion(false);
              this.spawnRasterExplosion(p.sx, p.sy, false);
              if (shielded && Math.random() < 0.35) {
                this.popups.push({
                  x: p.sx,
                  y: p.sy - 24,
                  text: 'HIT FLANK CONDUITS FIRST!',
                  color: '#38BDF8',
                  life: 0.7,
                  maxLife: 0.7,
                });
              }
            }
            if (consumed) break;
          }
        }
        if (consumed) this.bolts.splice(i, 1);
      } else {
        if (Math.hypot(b.u - this.playerU, b.v - this.playerV) < 28) {
          this.bolts.splice(i, 1);
          this.damagePlayer('IMPERIAL BLASTER');
        }
      }
    }
  }

  private damageAreaSplash(u: number, v: number, radius: number, dmg: number): void {
    // Destroy mines in radius
    for (let k = this.obstacles.length - 1; k >= 0; k--) {
      const ob = this.obstacles[k];
      if (ob.kind === 'mine' && Math.hypot(ob.u - u, ob.v - v) < radius) {
        this.obstacles.splice(k, 1);
      }
    }
    for (let j = this.enemies.length - 1; j >= 0; j--) {
      const en = this.enemies[j];
      if (Math.hypot(en.u - u, en.v - v) < radius) {
        en.hp -= dmg;
        en.hitFlash = 0.2;
        if (en.hp <= 0) {
          const p = isoToScreen(en.u, en.v, 24);
          this.handleEnemyDestroyed(en, p.sx, p.sy);
          this.enemies.splice(j, 1);
        }
      }
    }
  }

  private stepPickups(dt: number, worldSpeed: number): void {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.u -= worldSpeed * 0.55 * dt;
      pk.bob += dt * 6;
      if (Math.hypot(pk.u - this.playerU, pk.v - this.playerV) < 38) {
        const p = isoToScreen(pk.u, pk.v, 20);
        arcadeAudio.playPowerUp();
        if (pk.kind === 'shield') {
          this.shieldHits = this.maxShieldHits;
          this.addScore(500, p.sx, p.sy - 16, '#4ADE80', 'ARMOR REPAIRED!');
        } else if (pk.kind === 'overdrive') {
          this.overdriveTimer = 7.5;
          this.addScore(500, p.sx, p.sy - 16, '#38BDF8', 'QUAD OVERDRIVE!');
        } else {
          this.addScore(1000, p.sx, p.sy - 16, '#FEF08A', 'REBEL BONUS +1000!');
        }
        this.pickups.splice(i, 1);
        continue;
      }
      if (pk.u < -220) this.pickups.splice(i, 1);
    }
  }

  private handleEnemyDestroyed(en: RotjEnemy, sx: number, sy: number): void {
    const heavy =
      en.kind === 'atst' ||
      en.kind === 'shield_dish' ||
      en.kind === 'reactor_core' ||
      en.kind === 'bunker_conduit' ||
      en.kind === 'core_conduit';
    arcadeAudio.playRasterExplosion(heavy);
    this.spawnRasterExplosion(sx, sy, heavy, en.u, en.v);

    if (en.kind === 'bunker_conduit' || en.kind === 'core_conduit') {
      this.addScore(1500, sx, sy - 18, '#38BDF8', 'POWER CONDUIT BLOWN +1500!', true);
      return;
    }

    if (en.kind === 'shield_dish') {
      this.addScore(5000, sx, sy - 24, '#4ADE80', 'ENDOR SHIELD DOWN +5000!');
      this.whiteFlash = 0.45;
      arcadeAudio.playStageClear();
      this.setupSubStage(2);
      return;
    }

    if (en.kind === 'reactor_core') {
      this.addScore(7500, sx, sy - 24, '#FEF08A', 'CORE DETONATED +7500! ESCAPE!');
      this.whiteFlash = 0.55;
      this.spawnRasterExplosion(sx - 48, sy + 18, true);
      this.spawnRasterExplosion(sx + 48, sy - 18, true);
      this.enemies = [];
      this.bolts = [];
      this.obstacles = [];
      this.dsPhase = 3;
      this.escapeProgress = 0;
      this.fireballWallU = -195;
      this.boostEnergy = 1;
      this.klaxonCd = 0.4;
      this.bannerText = 'REACTOR MELTDOWN! HIT [SHIFT] AFTERBURNER & OUTRUN THE FIREBALL!';
      arcadeAudio.playDeathStarSupernova();
      return;
    }

    const pts = en.kind === 'atst' ? 900 : en.kind === 'interceptor' ? 800 : en.kind === 'scout' ? 600 : 450;
    this.addScore(pts, sx, sy - 14, '#FACC15', undefined, true);
    this.maybeSpawnPickup(en.u, en.v);
  }

  private firePlayerWeapon(mortar: boolean): void {
    const rapid = this.overdriveTimer > 0 ? 0.68 : 1.0;
    this.fireCd = (mortar ? 0.28 : 0.14) * rapid;

    if (this.subStage === 2) {
      arcadeAudio.playFalconQuadLaser();
      const lanes = this.overdriveTimer > 0 ? [-20, 0, 20] : [-15, 15];
      for (const dv of lanes) {
        this.bolts.push({
          u: this.playerU + 30,
          v: this.playerV + dv,
          z: 24,
          vu: 690,
          vv: 0,
          vz: 0,
          friendly: true,
          color: '#38BDF8',
          life: 1.45,
        });
      }
    } else if (mortar) {
      arcadeAudio.playSpeederBikeLaser(true);
      for (const sv of [-85, 0, 85]) {
        this.bolts.push({
          u: this.playerU + 24,
          v: this.playerV,
          z: 42,
          vu: 410,
          vv: sv,
          vz: 135,
          friendly: true,
          mortar: true,
          color: '#FACC15',
          life: 1.6,
        });
      }
    } else {
      arcadeAudio.playSpeederBikeLaser(false);
      const shots = this.overdriveTimer > 0 ? [-10, 10] : [0];
      for (const dv of shots) {
        this.bolts.push({
          u: this.playerU + 26,
          v: this.playerV + dv,
          z: this.subStage === 1 ? 36 : 18,
          vu: 650,
          vv: 0,
          vz: 0,
          friendly: true,
          color: this.subStage === 0 ? '#4ADE80' : '#F97316',
          life: 1.45,
        });
      }
    }
  }

  private spawnObstacle(uStart: number): void {
    const v = (Math.random() - 0.5) * 340;
    if (this.subStage === 0) {
      const r = Math.random();
      if (r < 0.14) {
        // Authentic Shootable Ewok Hanging Log Trap!
        this.obstacles.push({
          id: this.nextId++,
          kind: 'ewok_trap',
          u: uStart,
          v: (Math.random() - 0.5) * 140,
          radius: 34,
          height: 110,
          shade: Math.random(),
          triggered: false,
          triggerAnim: 0,
        });
      } else if (r < 0.36) {
        this.obstacles.push({
          id: this.nextId++,
          kind: 'log',
          u: uStart,
          v,
          radius: 30,
          height: 20,
          shade: Math.random(),
        });
      } else {
        this.obstacles.push({
          id: this.nextId++,
          kind: 'redwood',
          u: uStart,
          v,
          radius: 28,
          height: 145 + Math.random() * 55,
          shade: Math.random(),
        });
      }
    } else if (this.subStage === 1) {
      const r = Math.random();
      if (r < 0.24) {
        this.obstacles.push({
          id: this.nextId++,
          kind: 'ewok_trap',
          u: uStart,
          v: (Math.random() - 0.5) * 120,
          radius: 36,
          height: 120,
          shade: Math.random(),
          triggered: false,
          triggerAnim: 0,
        });
      } else if (r < 0.55) {
        this.obstacles.push({
          id: this.nextId++,
          kind: 'mine',
          u: uStart,
          v: (Math.random() - 0.5) * 260,
          radius: 24,
          height: 12,
          shade: Math.random(),
        });
      } else {
        this.obstacles.push({
          id: this.nextId++,
          kind: 'redwood',
          u: uStart,
          v: Math.abs(v) < 85 ? (v < 0 ? -145 : 145) : v,
          radius: 28,
          height: 125 + Math.random() * 45,
          shade: Math.random(),
        });
      }
    } else {
      // Death Star II Surface / Interior Tunnel / Escape Blast Doors!
      const r = Math.random();
      if (this.dsPhase === 3 && r < 0.45) {
        this.obstacles.push({
          id: this.nextId++,
          kind: 'blast_door',
          u: uStart,
          v: 0,
          radius: 30,
          height: 92,
          shade: 0,
          gapV: (Math.random() - 0.5) * 200,
        });
      } else if (this.dsPhase === 0 && r < 0.32) {
        this.obstacles.push({
          id: this.nextId++,
          kind: 'force_gate',
          u: uStart,
          v: 0,
          radius: 30,
          height: 72,
          shade: 0,
          gapV: (Math.random() - 0.5) * 210,
        });
      } else {
        this.obstacles.push({
          id: this.nextId++,
          kind: Math.random() < 0.55 ? 'girder' : 'pylon',
          u: uStart,
          v: (Math.random() - 0.5) * 290,
          radius: 30,
          height: 70 + Math.random() * 35,
          shade: Math.random(),
        });
      }
    }
  }

  private spawnEnemy(): void {
    if (this.subStage === 0) {
      this.enemies.push({
        id: this.nextId++,
        kind: 'scout',
        u: 770,
        v: (Math.random() - 0.5) * 270,
        vu: 38,
        vv: (Math.random() - 0.5) * 145,
        hp: 2,
        maxHp: 2,
        fireCd: 1.05,
        stride: 0,
        hitFlash: 0,
      });
    } else if (this.subStage === 1) {
      const r = Math.random();
      const kind: RotjEnemy['kind'] = r < 0.46 ? 'atst' : r < 0.78 ? 'turret' : 'scout';
      this.enemies.push({
        id: this.nextId++,
        kind,
        u: 790,
        v: (Math.random() - 0.5) * 265,
        vu: kind === 'turret' ? 0 : -18,
        vv: kind === 'turret' ? 0 : (Math.random() - 0.5) * 95,
        hp: kind === 'atst' ? 4 : 2,
        maxHp: kind === 'atst' ? 4 : 2,
        fireCd: 0.95,
        stride: Math.random() * 6,
        hitFlash: 0,
      });
    } else {
      const kind: RotjEnemy['kind'] = Math.random() < 0.65 ? 'interceptor' : 'turret';
      this.enemies.push({
        id: this.nextId++,
        kind,
        u: 810,
        v: (Math.random() - 0.5) * 275,
        vu: kind === 'interceptor' ? -85 : 0,
        vv: kind === 'interceptor' ? (Math.random() - 0.5) * 175 : 0,
        hp: kind === 'interceptor' ? 2 : 3,
        maxHp: kind === 'interceptor' ? 2 : 3,
        fireCd: 0.85,
        stride: 0,
        hitFlash: 0,
      });
    }
  }

  private stepEffects(dt: number): void {
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      this.explosions[i].life -= dt;
      if (this.explosions[i].life <= 0) this.explosions.splice(i, 1);
    }
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.sx += d.vx * dt;
      d.sy += d.vy * dt;
      d.vy += d.gravity * dt;
      d.rot += d.vRot * dt;
      d.life -= dt;
      if (d.life <= 0) this.debris.splice(i, 1);
    }
    for (let i = this.spaceLasers.length - 1; i >= 0; i--) {
      this.spaceLasers[i].life -= dt;
      if (this.spaceLasers[i].life <= 0) this.spaceLasers.splice(i, 1);
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.y -= 32 * dt;
      p.life -= dt;
      if (p.life <= 0) this.popups.splice(i, 1);
    }
  }

  // =========================================================================
  // ADVANCED 1984 ATARI 2.5D DIAGONAL ISOMETRIC SHADED RASTER RENDERER
  // =========================================================================
  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.save();
    ctx.scale(dpr, dpr);

    if (this.shakeTimer > 0) {
      const mag = this.shakeTimer * 25;
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }

    // 1. Rich Isometric Environment Backdrop
    if (this.subStage === 2 && this.phase !== 'TITLE') {
      this.renderDeathStar2World(ctx);
    } else {
      this.renderEndorWorld(ctx);
    }

    // Scorched explosion craters
    for (const sc of this.scorches) {
      const p = isoToScreen(sc.u, sc.v, 0);
      ctx.save();
      ctx.globalAlpha = sc.alpha * 0.6;
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.ellipse(p.sx, p.sy, sc.r, sc.r * 0.5, -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7C2D12';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // Dust / Speeder wake puffs
    for (const d of this.dust) {
      const p = isoToScreen(d.u, d.v, d.z);
      const a = Math.max(0, d.life / d.maxLife);
      ctx.save();
      ctx.globalAlpha = a * 0.55;
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, d.r * (1.4 - a * 0.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Ewok Treetop Village Finale Landmark in Stage 1
    if (this.subStage === 0 && this.villageApproaching) {
      this.renderEwokVillage(ctx);
    }

    // Death Star II Escape Exit Portal in Stage 3C
    if (this.subStage === 2 && this.dsPhase === 3 && this.escapeProgress >= 75) {
      this.renderEscapeExitPortal(ctx);
    }

    // 2. Depth-Sorted 2.5D Raster Actors (Painter's Algorithm!)
    interface Renderable {
      depth: number;
      draw: () => void;
    }
    const queue: Renderable[] = [];

    for (const ob of this.obstacles) {
      const p = isoToScreen(ob.u, ob.v, 0);
      queue.push({ depth: p.sy, draw: () => this.drawObstacle(ctx, ob, p.sx, p.sy) });
    }
    for (const pk of this.pickups) {
      const p = isoToScreen(pk.u, pk.v, 0);
      queue.push({ depth: p.sy, draw: () => this.drawPickup(ctx, pk, p.sx, p.sy) });
    }
    for (const en of this.enemies) {
      const p = isoToScreen(en.u, en.v, 0);
      queue.push({ depth: p.sy, draw: () => this.drawEnemy(ctx, en, p.sx, p.sy) });
    }
    if (this.phase !== 'TITLE') {
      const pp = isoToScreen(this.playerU, this.playerV, 0);
      queue.push({ depth: pp.sy + 2, draw: () => this.drawPlayerVehicle(ctx, pp.sx, pp.sy) });
    }

    queue.sort((a, b) => a.depth - b.depth);
    for (const item of queue) item.draw();

    // 3. Friendly Ewok Hang-Gliders swooping overhead in Stage 2!
    for (const g of this.gliders) {
      this.drawEwokGlider(ctx, g);
    }

    // 4. Bolts & Arcing Concussion Mortars
    for (const b of this.bolts) {
      const p0 = isoToScreen(b.u, b.v, b.z);
      if (b.mortar) {
        // Ground shadow beneath arcing mortar/boulder
        const sh = isoToScreen(b.u, b.v, 0);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(sh.sx, sh.sy, 8, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        const g = ctx.createRadialGradient(p0.sx - 2, p0.sy - 2, 1, p0.sx, p0.sy, 8);
        g.addColorStop(0, '#FFFFFF');
        g.addColorStop(0.5, b.color);
        g.addColorStop(1, '#78350F');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p0.sx, p0.sy, 7.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const p1 = isoToScreen(b.u - (b.friendly ? 38 : -28), b.v - b.vv * 0.04, b.z);
        ctx.save();
        ctx.lineCap = 'round';
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 6;
        ctx.globalAlpha = 0.38;
        ctx.beginPath();
        ctx.moveTo(p0.sx, p0.sy);
        ctx.lineTo(p1.sx, p1.sy);
        ctx.stroke();

        ctx.globalAlpha = 1;
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.moveTo(p0.sx, p0.sy);
        ctx.lineTo(p1.sx, p1.sy);
        ctx.stroke();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(p0.sx, p0.sy);
        ctx.lineTo(p1.sx, p1.sy);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 5. Roaring Expanding Volumetric Raster Fireball Wall during Stage 3C Escape!
    if (this.subStage === 2 && this.dsPhase === 3 && this.phase === 'PLAYING') {
      this.renderFireballWall(ctx);
    }

    // 6. Sunlit Diagonal Forest Sunbeams on Endor (Stage 1 & 2)!
    if (this.subStage < 2) {
      this.renderEndorSunbeams(ctx);
    }

    // 7. Volumetric Atari-Evolved Multi-Stage Raster Explosions & Flying Debris!
    this.renderRasterExplosions(ctx);

    // 8. Title Screen 3-Vehicle Isometric Showcase
    if (this.phase === 'TITLE') {
      this.renderTitleShowcase(ctx);
    }

    // 9. Score Popups
    for (const pop of this.popups) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (pop.life / pop.maxLife) * 1.8);
      ctx.font = '900 14px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(2, 6, 23, 0.92)';
      ctx.strokeText(pop.text, pop.x, pop.y);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x, pop.y);
      ctx.restore();
    }

    if (this.hitFlash > 0) {
      ctx.fillStyle = `rgba(239, 68, 68, ${Math.min(0.42, this.hitFlash)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (this.whiteFlash > 0) {
      ctx.fillStyle = `rgba(254, 249, 195, ${Math.min(0.65, this.whiteFlash)})`;
      ctx.fillRect(0, 0, W, H);
    }

    this.renderRasterHud(ctx);
    if (visualMode === 'crt') renderCrtOverlay(ctx, W, H);
    ctx.restore();
  }

  private renderEndorWorld(ctx: CanvasRenderingContext2D): void {
    // Rich layered deep emerald forest floor
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0F3D22');
    bg.addColorStop(0.5, '#14532D');
    bg.addColorStop(1, '#1A2E1A');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Raised Diagonal Forest Roadway / Bunker Clearing with earthen bevel cliffs!
    const pBL = isoToScreen(-290, -185);
    const pBR = isoToScreen(-290, 185);
    const pTR = isoToScreen(1160, 185);
    const pTL = isoToScreen(1160, -185);

    // Earthen 2.5D cliff edge lip on bottom-right side of ribbon
    ctx.fillStyle = '#3B2314';
    ctx.beginPath();
    ctx.moveTo(pBR.sx, pBR.sy);
    ctx.lineTo(pTR.sx, pTR.sy);
    ctx.lineTo(pTR.sx, pTR.sy + 20);
    ctx.lineTo(pBR.sx, pBR.sy + 20);
    ctx.closePath();
    ctx.fill();

    // Main sunlit Endor clearing trail
    const trailGrad = ctx.createLinearGradient(pBL.sx, pBL.sy, pTR.sx, pTR.sy);
    if (this.subStage === 1) {
      trailGrad.addColorStop(0, '#44403C');
      trailGrad.addColorStop(0.5, '#57534E');
      trailGrad.addColorStop(1, '#3F3F46');
    } else {
      trailGrad.addColorStop(0, '#3F6212');
      trailGrad.addColorStop(0.5, '#65A30D');
      trailGrad.addColorStop(1, '#365314');
    }
    ctx.fillStyle = trailGrad;
    ctx.beginPath();
    ctx.moveTo(pBL.sx, pBL.sy);
    ctx.lineTo(pBR.sx, pBR.sy);
    ctx.lineTo(pTR.sx, pTR.sy);
    ctx.lineTo(pTL.sx, pTL.sy);
    ctx.closePath();
    ctx.fill();

    // Winding warm earthen center dirt path on Stage 1
    if (this.subStage === 0) {
      const cBL = isoToScreen(-290, -58);
      const cBR = isoToScreen(-290, 58);
      const cTR = isoToScreen(1160, 58);
      const cTL = isoToScreen(1160, -58);
      ctx.fillStyle = 'rgba(146, 64, 14, 0.34)';
      ctx.beginPath();
      ctx.moveTo(cBL.sx, cBL.sy);
      ctx.lineTo(cBR.sx, cBR.sy);
      ctx.lineTo(cTR.sx, cTR.sy);
      ctx.lineTo(cTL.sx, cTL.sy);
      ctx.closePath();
      ctx.fill();
    }

    // Scrolling forest details: sparkling creek bridges, mossy fern banks & speed ridges
    const step = 135;
    const mod = this.scrollOffset % step;
    const baseIndex = Math.floor(this.scrollOffset / step);
    for (let k = -2; k < 10; k++) {
      const u = k * step - mod;
      const worldIdx = baseIndex + k;

      // Occasional sparkling Endor Forest Creek + Wooden Ewok Plank Bridge!
      if (this.subStage === 0 && Math.abs(worldIdx) % 5 === 2) {
        const wL1 = isoToScreen(u - 22, -230);
        const wR1 = isoToScreen(u - 22, 230);
        const wR2 = isoToScreen(u + 22, 230);
        const wL2 = isoToScreen(u + 22, -230);
        ctx.fillStyle = '#0284C7';
        ctx.beginPath();
        ctx.moveTo(wL1.sx, wL1.sy);
        ctx.lineTo(wR1.sx, wR1.sy);
        ctx.lineTo(wR2.sx, wR2.sy);
        ctx.lineTo(wL2.sx, wL2.sy);
        ctx.closePath();
        ctx.fill();
        // Water shimmer highlight
        const sL = isoToScreen(u, -195);
        const sR = isoToScreen(u, 195);
        ctx.strokeStyle = 'rgba(186, 230, 253, 0.7)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sL.sx, sL.sy);
        ctx.lineTo(sR.sx, sR.sy);
        ctx.stroke();
        // Wooden Ewok plank bridge over the center lane
        const bL1 = isoToScreen(u - 26, -85);
        const bR1 = isoToScreen(u - 26, 85);
        const bR2 = isoToScreen(u + 26, 85);
        const bL2 = isoToScreen(u + 26, -85);
        ctx.fillStyle = '#78350F';
        ctx.beginPath();
        ctx.moveTo(bL1.sx, bL1.sy);
        ctx.lineTo(bR1.sx, bR1.sy);
        ctx.lineTo(bR2.sx, bR2.sy);
        ctx.lineTo(bL2.sx, bL2.sy);
        ctx.closePath();
        ctx.fill();
      } else {
        const l = isoToScreen(u, -182);
        const r = isoToScreen(u, 182);
        ctx.strokeStyle = this.subStage === 1 ? 'rgba(203, 213, 225, 0.16)' : 'rgba(254, 240, 138, 0.16)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(l.sx, l.sy);
        ctx.lineTo(r.sx, r.sy);
        ctx.stroke();
      }

      // Lush 2.5D Forest Ferns along track shoulders
      for (const side of [-215, 215]) {
        const fp = isoToScreen(u + 40, side);
        ctx.fillStyle = '#15803D';
        ctx.beginPath();
        ctx.ellipse(fp.sx, fp.sy, 28, 14, -0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4ADE80';
        ctx.beginPath();
        ctx.ellipse(fp.sx - 5, fp.sy - 4, 13, 6, -0.35, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private renderEndorSunbeams(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const beamShift = (this.elapsed * 22) % 240;
    for (let i = 0; i < 4; i++) {
      const bx = i * 240 - beamShift + 40;
      const g = ctx.createLinearGradient(bx, 0, bx + 110, H);
      g.addColorStop(0, 'rgba(254, 249, 195, 0.09)');
      g.addColorStop(0.5, 'rgba(254, 240, 138, 0.04)');
      g.addColorStop(1, 'rgba(254, 240, 138, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(bx, 44);
      ctx.lineTo(bx + 68, 44);
      ctx.lineTo(bx + 188, H);
      ctx.lineTo(bx + 110, H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  private renderEwokVillage(ctx: CanvasRenderingContext2D): void {
    // Iconic Ewok Treetop Huts & Glowing Campfire greeting Leia at the end of Stage 1!
    for (const hv of [-125, 0, 125]) {
      const p = isoToScreen(this.villageU, hv, 0);
      // Giant village tree trunk
      ctx.fillStyle = '#78350F';
      ctx.fillRect(p.sx - 14, p.sy - 125, 28, 125);
      // Wooden Ewok platform & thatched dome hut
      ctx.fillStyle = '#92400E';
      ctx.beginPath();
      ctx.ellipse(p.sx, p.sy - 88, 40, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#D97706';
      ctx.beginPath();
      ctx.arc(p.sx, p.sy - 92, 26, Math.PI, 0);
      ctx.fill();
      // Warm hut doorway glow
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(p.sx - 6, p.sy - 104, 12, 12);
    }
    const bannerP = isoToScreen(this.villageU, 0, 135);
    ctx.font = '900 13px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FEF08A';
    ctx.fillText('EWOK VILLAGE', bannerP.sx, bannerP.sy);
  }

  private renderDeathStar2World(ctx: CanvasRenderingContext2D): void {
    // Deep Space Backdrop with twinkling stars & distant Space Battle capital ships (Stage 3A)!
    ctx.fillStyle = this.dsPhase >= 1 ? '#050811' : '#03060E';
    ctx.fillRect(0, 0, W, H);

    if (this.dsPhase === 0) {
      // Twinkling stars
      for (const st of this.bgStars) {
        ctx.fillStyle = `rgba(226, 232, 240, ${0.4 + Math.sin(this.elapsed * 3 + st.tw) * 0.4})`;
        ctx.fillRect(st.x, st.y, st.s, st.s);
      }
      // Distant Imperial Star Destroyer silhouette top-left & Rebel Mon Calamari Cruiser bottom-right!
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(145, 92);
      ctx.lineTo(48, 72);
      ctx.lineTo(66, 118);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.ellipse(W - 95, H - 72, 54, 16, -0.2, 0, Math.PI * 2);
      ctx.fill();

      // Capital ship turbolaser volleys off the edges!
      for (const sl of this.spaceLasers) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, sl.life / sl.maxLife);
        ctx.strokeStyle = sl.color;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(sl.x0, sl.y0);
        ctx.lineTo(sl.x1, sl.y1);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Diagonal Death Star II Metallic Superstructure Deck
    const laneHalf = this.dsPhase >= 1 ? 185 : 210;
    const pBL = isoToScreen(-290, -laneHalf);
    const pBR = isoToScreen(-290, laneHalf);
    const pTR = isoToScreen(1160, laneHalf);
    const pTL = isoToScreen(1160, -laneHalf);

    // 2.5D steel superstructure drop-off wall
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.moveTo(pBR.sx, pBR.sy);
    ctx.lineTo(pTR.sx, pTR.sy);
    ctx.lineTo(pTR.sx, pTR.sy + 26);
    ctx.lineTo(pBR.sx, pBR.sy + 26);
    ctx.closePath();
    ctx.fill();

    // Metallic greble deck gradient
    const deck = ctx.createLinearGradient(pBL.sx, pBL.sy, pTR.sx, pTR.sy);
    if (this.dsPhase === 3) {
      deck.addColorStop(0, '#451A03');
      deck.addColorStop(0.5, '#334155');
      deck.addColorStop(1, '#1E293B');
    } else if (this.dsPhase >= 1) {
      deck.addColorStop(0, '#0F172A');
      deck.addColorStop(0.5, '#1E293B');
      deck.addColorStop(1, '#0F172A');
    } else {
      deck.addColorStop(0, '#1E293B');
      deck.addColorStop(0.5, '#475569');
      deck.addColorStop(1, '#1E293B');
    }
    ctx.fillStyle = deck;
    ctx.beginPath();
    ctx.moveTo(pBL.sx, pBL.sy);
    ctx.lineTo(pBR.sx, pBR.sy);
    ctx.lineTo(pTR.sx, pTR.sy);
    ctx.lineTo(pTL.sx, pTL.sy);
    ctx.closePath();
    ctx.fill();

    // Scrolling Greble Plating, Glowing Reactor Conduits & Interior Tunnel Side Walls!
    const step = 92;
    const mod = this.scrollOffset % step;
    for (let u = -220 - mod; u < 1120; u += step) {
      const l = isoToScreen(u, -laneHalf);
      const r = isoToScreen(u, laneHalf);
      ctx.strokeStyle =
        this.dsPhase === 3
          ? 'rgba(251, 146, 60, 0.5)'
          : this.dsPhase >= 1
            ? 'rgba(56, 189, 248, 0.36)'
            : 'rgba(148, 163, 184, 0.32)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(l.sx, l.sy);
      ctx.lineTo(r.sx, r.sy);
      ctx.stroke();

      // Interior Tunnel Raised Steel Side Ribs in Stage 3B/3C!
      if (this.dsPhase >= 1) {
        ctx.fillStyle = '#334155';
        ctx.fillRect(l.sx - 10, l.sy - 88, 18, 88);
        ctx.fillStyle = this.dsPhase === 3 ? '#F97316' : '#38BDF8';
        ctx.fillRect(l.sx - 6, l.sy - 62, 10, 8);
      }
    }
    for (let v = -140; v <= 140; v += 70) {
      const a = isoToScreen(-260, v);
      const b = isoToScreen(1120, v);
      ctx.strokeStyle = 'rgba(203, 213, 225, 0.16)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.stroke();
    }
  }

  private renderEscapeExitPortal(ctx: CanvasRenderingContext2D): void {
    const pL = isoToScreen(this.exitPortalU, -135, 0);
    const pR = isoToScreen(this.exitPortalU, 135, 0);
    const pMid = isoToScreen(this.exitPortalU, 0, 50);
    ctx.save();
    const g = ctx.createRadialGradient(pMid.sx, pMid.sy, 8, pMid.sx, pMid.sy, 110);
    g.addColorStop(0, '#FFFFFF');
    g.addColorStop(0.45, 'rgba(56, 189, 248, 0.7)');
    g.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(pMid.sx, pMid.sy, 110, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#BAE6FD';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(pL.sx, pL.sy);
    ctx.lineTo(pL.sx, pL.sy - 95);
    ctx.lineTo(pR.sx, pR.sy - 95);
    ctx.lineTo(pR.sx, pR.sy);
    ctx.stroke();

    ctx.font = '900 13px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('OPEN SPACE EXIT!', pMid.sx, pMid.sy - 68);
    ctx.restore();
  }

  private drawObstacle(ctx: CanvasRenderingContext2D, ob: RotjObstacle, sx: number, sy: number): void {
    ctx.save();
    if (ob.kind === 'redwood') {
      // Diagonal sunlit forest trunk shadow
      ctx.fillStyle = 'rgba(6, 20, 10, 0.48)';
      ctx.beginPath();
      ctx.ellipse(sx + 26, sy + 8, 34, 13, 0.25, 0, Math.PI * 2);
      ctx.fill();

      // Textured Cylindrical Endor Redwood Trunk + Root Buttress
      const tw = 24;
      const trunk = ctx.createLinearGradient(sx - tw * 0.5, sy, sx + tw * 0.5, sy);
      trunk.addColorStop(0, '#3B1404');
      trunk.addColorStop(0.32, '#9A3412');
      trunk.addColorStop(0.62, '#78350F');
      trunk.addColorStop(1, '#230A02');
      ctx.fillStyle = trunk;
      ctx.fillRect(sx - tw * 0.5, sy - ob.height, tw, ob.height);

      // Bark ridge highlights
      ctx.strokeStyle = 'rgba(253, 186, 116, 0.28)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(sx - 3, sy - 6);
      ctx.lineTo(sx - 3, sy - ob.height + 12);
      ctx.stroke();

      // Root flare
      ctx.fillStyle = '#5C240B';
      ctx.beginPath();
      ctx.ellipse(sx, sy, 17, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // 3-Tier Sunlit Evergreen Redwood Canopy
      ctx.fillStyle = '#14532D';
      ctx.beginPath();
      ctx.ellipse(sx, sy - ob.height + 8, 46, 23, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#15803D';
      ctx.beginPath();
      ctx.ellipse(sx - 6, sy - ob.height - 6, 36, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4ADE80';
      ctx.beginPath();
      ctx.ellipse(sx - 12, sy - ob.height - 13, 17, 9, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (ob.kind === 'ewok_trap') {
      // Authentic Shootable Ewok Hanging Twin-Log Trap!
      const anim = ob.triggerAnim ?? 0;
      const pL = isoToScreen(ob.u, ob.v - 85, 0);
      const pR = isoToScreen(ob.u, ob.v + 85, 0);
      // Twin support posts
      ctx.fillStyle = '#78350F';
      ctx.fillRect(pL.sx - 6, pL.sy - 96, 12, 96);
      ctx.fillRect(pR.sx - 6, pR.sy - 96, 12, 96);
      // Vine ropes & swinging logs crashing together in the center when triggered!
      const swingL = pL.sx + (sx - pL.sx) * (0.2 + anim * 0.8);
      const swingR = pR.sx + (sx - pR.sx) * (0.2 + anim * 0.8);
      const logY = sy - 58 + anim * 34;
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pL.sx, pL.sy - 92);
      ctx.lineTo(swingL, logY);
      ctx.moveTo(pR.sx, pR.sy - 92);
      ctx.lineTo(swingR, logY);
      ctx.stroke();

      ctx.fillStyle = '#92400E';
      ctx.beginPath();
      ctx.ellipse(swingL, logY, 16, 9, 0.2, 0, Math.PI * 2);
      ctx.ellipse(swingR, logY, 16, 9, -0.2, 0, Math.PI * 2);
      ctx.fill();

      if (!ob.triggered) {
        ctx.fillStyle = Math.sin(this.elapsed * 12) > 0 ? '#FEF08A' : '#4ADE80';
        ctx.beginPath();
        ctx.arc(sx, sy - 64, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '800 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FEF08A';
        ctx.fillText('SHOOT TRAP', sx, sy - 76);
      }
    } else if (ob.kind === 'mine') {
      // Imperial Ground Mine pulsing crimson
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(sx, sy + 2, 16, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.ellipse(sx, sy - 2, 14, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = Math.sin(this.elapsed * 14 + ob.id) > 0 ? '#EF4444' : '#FCA5A5';
      ctx.beginPath();
      ctx.arc(sx, sy - 5, 4.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (ob.kind === 'log') {
      ctx.fillStyle = 'rgba(10, 20, 10, 0.44)';
      ctx.beginPath();
      ctx.ellipse(sx + 6, sy + 6, 36, 12, 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.translate(sx, sy - 6);
      ctx.rotate(0.45);
      const lg = ctx.createLinearGradient(0, -10, 0, 10);
      lg.addColorStop(0, '#B45309');
      lg.addColorStop(0.5, '#78350F');
      lg.addColorStop(1, '#451A03');
      ctx.fillStyle = lg;
      ctx.fillRect(-30, -9, 60, 18);
      ctx.fillStyle = '#FDE68A';
      ctx.beginPath();
      ctx.ellipse(30, 0, 5.5, 9, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (ob.kind === 'force_gate' || ob.kind === 'blast_door') {
      // Death Star II Laser Force-Gate / Collapsing Blast Door with Clear Safe Gap!
      const gap = ob.gapV ?? 0;
      const isGate = ob.kind === 'force_gate';
      const segs: Array<[number, number]> = [
        [-190, gap - 56],
        [gap + 56, 190],
      ];
      for (const [v0, v1] of segs) {
        if (v1 - v0 < 14) continue;
        const a = isoToScreen(ob.u, v0, 0);
        const b = isoToScreen(ob.u, v1, 0);
        if (isGate) {
          ctx.strokeStyle = '#EF4444';
          ctx.lineWidth = 6;
          ctx.globalAlpha = 0.85;
          ctx.beginPath();
          ctx.moveTo(a.sx, a.sy - 24);
          ctx.lineTo(b.sx, b.sy - 24);
          ctx.moveTo(a.sx, a.sy - 46);
          ctx.lineTo(b.sx, b.sy - 46);
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#94A3B8';
          ctx.fillRect(a.sx - 6, a.sy - 56, 12, 56);
          ctx.fillRect(b.sx - 6, b.sy - 56, 12, 56);
        } else {
          // Heavy armored metallic blast door halves
          ctx.fillStyle = '#475569';
          ctx.beginPath();
          ctx.moveTo(a.sx, a.sy);
          ctx.lineTo(b.sx, b.sy);
          ctx.lineTo(b.sx, b.sy - 78);
          ctx.lineTo(a.sx, a.sy - 78);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      }
      // Glowing Cyan Safe-Passage Arrow in the gap!
      const gp = isoToScreen(ob.u, gap, 28);
      ctx.fillStyle = '#38BDF8';
      ctx.font = '900 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('▲ GAP ▲', gp.sx, gp.sy);
    } else {
      // Death Star II 2.5D Shaded Steel Girder / Reactor Pylon
      ctx.fillStyle = 'rgba(2, 6, 23, 0.56)';
      ctx.beginPath();
      ctx.ellipse(sx + 10, sy + 6, 24, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      const g = ctx.createLinearGradient(sx - 15, sy, sx + 15, sy);
      g.addColorStop(0, '#475569');
      g.addColorStop(0.42, '#E2E8F0');
      g.addColorStop(1, '#1E293B');
      ctx.fillStyle = g;
      ctx.fillRect(sx - 13, sy - ob.height, 26, ob.height);
      ctx.fillStyle = ob.kind === 'pylon' ? '#38BDF8' : '#F59E0B';
      ctx.fillRect(sx - 13, sy - ob.height + 8, 26, 6);
      ctx.fillRect(sx - 13, sy - 18, 26, 5);
    }
    ctx.restore();
  }

  private drawPickup(ctx: CanvasRenderingContext2D, pk: PickupItem, sx: number, sy: number): void {
    const hover = 18 + Math.sin(pk.bob) * 5;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 2, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    const col = pk.kind === 'shield' ? '#4ADE80' : pk.kind === 'overdrive' ? '#38BDF8' : '#FEF08A';
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(sx, sy - hover, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#0F172A';
    ctx.font = '900 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pk.kind === 'shield' ? '+' : pk.kind === 'overdrive' ? 'Q' : '★', sx, sy - hover + 1);
    ctx.restore();
  }

  private drawEwokGlider(ctx: CanvasRenderingContext2D, g: EwokGlider): void {
    const p = isoToScreen(g.u, g.v, 96);
    const sh = isoToScreen(g.u, g.v, 0);
    ctx.save();
    // Ground shadow
    ctx.fillStyle = 'rgba(6, 20, 10, 0.35)';
    ctx.beginPath();
    ctx.ellipse(sh.sx, sh.sy, 26, 11, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Ewok primitive skin-wing Hang Glider!
    ctx.translate(p.sx, p.sy);
    ctx.rotate(Math.sin(g.wingFlap) * 0.08);
    ctx.fillStyle = '#D97706';
    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(30, 8);
    ctx.lineTo(0, 2);
    ctx.lineTo(-30, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Little Ewok pilot hanging underneath
    ctx.fillStyle = '#78350F';
    ctx.beginPath();
    ctx.arc(0, 10, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawSpeederBike(ctx: CanvasRenderingContext2D, sx: number, sy: number, isPlayer: boolean, boost: boolean, bank = 0): void {
    ctx.save();
    const bob = Math.sin(this.elapsed * 12 + sx * 0.04) * 2.5;
    // Soft hover shadow on Endor trail
    ctx.fillStyle = 'rgba(4, 15, 8, 0.48)';
    ctx.beginPath();
    ctx.ellipse(sx + 4, sy + 11, 28, 10, -0.45, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(sx, sy - 11 + bob);
    ctx.rotate(-0.52 + bank * 0.24);

    // Thruster exhaust flame
    ctx.fillStyle = boost ? '#38BDF8' : '#F97316';
    ctx.beginPath();
    ctx.ellipse(-28, 0, boost ? 20 : 10, boost ? 7 : 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    if (boost) {
      // Turbo Ram energy prow around front vanes
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(16, 0, 24, -0.9, 0.9);
      ctx.stroke();
    }

    // 74-Z Speeder Bike sleek armored fuselage
    ctx.fillStyle = isPlayer ? '#92400E' : '#475569';
    ctx.beginPath();
    ctx.moveTo(-25, -5.5);
    ctx.lineTo(14, -4.5);
    ctx.lineTo(32, -2);
    ctx.lineTo(32, 2);
    ctx.lineTo(14, 4.5);
    ctx.lineTo(-25, 5.5);
    ctx.closePath();
    ctx.fill();

    // Specular metallic highlight
    ctx.fillStyle = isPlayer ? '#F59E0B' : '#94A3B8';
    ctx.fillRect(-19, -3, 40, 2.6);

    // Twin forward steering vanes
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(12, -4);
    ctx.lineTo(34, -9);
    ctx.moveTo(12, 4);
    ctx.lineTo(34, 9);
    ctx.stroke();

    // Rider: Princess Leia (Endor Camo Poncho + Tan Helmet) vs Imperial Scout Trooper (White Armor + Black Visor)
    if (isPlayer) {
      ctx.fillStyle = '#15803D';
      ctx.beginPath();
      ctx.ellipse(-4, -3, 12, 7.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4ADE80';
      ctx.fillRect(-8, -5, 6, 3);
      ctx.fillStyle = '#E7E5E4';
      ctx.beginPath();
      ctx.arc(4, -5.5, 6.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.ellipse(-4, -3, 10, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F8FAFC';
      ctx.beginPath();
      ctx.arc(4, -5.5, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(6, -7.5, 4.5, 3);
    }
    ctx.restore();
  }

  private drawAtStWalker(ctx: CanvasRenderingContext2D, sx: number, sy: number, stride: number, friendly: boolean, hitFlash: number): void {
    ctx.save();
    ctx.fillStyle = 'rgba(4, 12, 8, 0.5)';
    ctx.beginPath();
    ctx.ellipse(sx + 6, sy + 6, 28, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Multi-segment reverse-jointed AT-ST mechanical legs (thigh -> hydraulic knee -> shin -> 3-toe claw)
    for (const side of [-1, 1]) {
      const ph = stride + (side === 1 ? Math.PI : 0);
      const swing = Math.sin(ph) * 12;
      const lift = Math.max(0, Math.cos(ph)) * 8;
      const hipX = sx + side * 9;
      const hipY = sy - 36;
      const kneeX = hipX - 7 + swing * 0.45;
      const kneeY = sy - 18 - lift * 0.45;
      const footX = hipX + swing;
      const footY = sy - lift;

      ctx.strokeStyle = hitFlash > 0 ? '#FFFFFF' : friendly ? '#CBD5E1' : '#64748B';
      ctx.lineWidth = 4.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(hipX, hipY);
      ctx.lineTo(kneeX, kneeY);
      ctx.lineTo(footX, footY);
      ctx.stroke();

      // Knee joint bolt
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.arc(kneeX, kneeY, 3.2, 0, Math.PI * 2);
      ctx.fill();

      // Armored claw foot
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(footX - 7, footY - 3, 14, 5.5);
    }

    // Boxy Armored AT-ST Head with 2.5D top/side/front bevel shading
    const bobY = Math.abs(Math.sin(stride)) * 3;
    const hx = sx;
    const hy = sy - 50 - bobY;
    ctx.fillStyle = hitFlash > 0 ? '#FFFFFF' : friendly ? '#94A3B8' : '#475569';
    ctx.beginPath();
    ctx.moveTo(hx - 19, hy - 10);
    ctx.lineTo(hx + 17, hy - 14);
    ctx.lineTo(hx + 25, hy + 5);
    ctx.lineTo(hx - 13, hy + 11);
    ctx.closePath();
    ctx.fill();

    // Bright top bevel plate
    ctx.fillStyle = hitFlash > 0 ? '#FFFFFF' : friendly ? '#E2E8F0' : '#94A3B8';
    ctx.beginPath();
    ctx.moveTo(hx - 19, hy - 10);
    ctx.lineTo(hx + 17, hy - 14);
    ctx.lineTo(hx + 9, hy - 23);
    ctx.lineTo(hx - 21, hy - 19);
    ctx.closePath();
    ctx.fill();

    // Side concussion pod & twin front blaster barrels
    ctx.fillStyle = '#334155';
    ctx.fillRect(hx + 18, hy - 2, 12, 3.5);
    ctx.fillStyle = friendly ? '#4ADE80' : '#EF4444';
    ctx.fillRect(hx + 6, hy - 8, 5, 4);
    ctx.fillRect(hx + 14, hy - 9, 5, 4);

    // Chewbacca roaring from open hatch on player's hijacked AT-ST!
    if (friendly) {
      ctx.fillStyle = '#78350F';
      ctx.beginPath();
      ctx.arc(hx - 4, hy - 21, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hx - 9, hy - 17);
      ctx.lineTo(hx + 2, hy - 23);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawMillenniumFalcon(ctx: CanvasRenderingContext2D, sx: number, sy: number, boost: boolean, bank = 0): void {
    ctx.save();
    // Cast metallic shadow onto Death Star II deck
    ctx.fillStyle = 'rgba(2, 6, 23, 0.58)';
    ctx.beginPath();
    ctx.ellipse(sx + 10, sy + 18, 38, 17, -0.42, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(sx, sy - 20);
    ctx.rotate(-0.5 + bank * 0.28);

    // Multi-cell Glowing Cyan Sublight Engine Strip + Afterburner Flare
    ctx.fillStyle = boost ? '#FFFFFF' : '#38BDF8';
    ctx.beginPath();
    ctx.ellipse(-28, 0, boost ? 18 : 10, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = boost ? 'rgba(186, 230, 253, 0.55)' : 'rgba(56, 189, 248, 0.34)';
    ctx.beginPath();
    ctx.ellipse(-36, 0, boost ? 32 : 16, 19, 0, 0, Math.PI * 2);
    ctx.fill();

    // Weathered Corellian YT-1300 Saucer Hull
    const hull = ctx.createRadialGradient(-4, -6, 4, 0, 0, 32);
    hull.addColorStop(0, '#F8FAFC');
    hull.addColorStop(0.55, '#CBD5E1');
    hull.addColorStop(1, '#64748B');
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.ellipse(-2, 0, 29, 23, 0, 0, Math.PI * 2);
    ctx.fill();

    // Panel seam lines & docking rings
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-24, 0);
    ctx.lineTo(14, 0);
    ctx.moveTo(-4, -22);
    ctx.lineTo(-4, 22);
    ctx.stroke();

    // Forward Twin Mandibles
    ctx.fillStyle = '#CBD5E1';
    ctx.beginPath();
    ctx.moveTo(12, -16);
    ctx.lineTo(38, -9);
    ctx.lineTo(38, -3);
    ctx.lineTo(14, -4);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(12, 16);
    ctx.lineTo(38, 9);
    ctx.lineTo(38, 3);
    ctx.lineTo(14, 4);
    ctx.closePath();
    ctx.fill();

    // Red hull stripe detail
    ctx.fillStyle = '#B91C1C';
    ctx.fillRect(16, -11, 10, 3);
    ctx.fillRect(16, 8, 10, 3);

    // Starboard Cockpit Tube
    ctx.fillStyle = '#94A3B8';
    ctx.beginPath();
    ctx.moveTo(6, 15);
    ctx.lineTo(25, 22);
    ctx.lineTo(23, 27);
    ctx.lineTo(2, 21);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#38BDF8';
    ctx.beginPath();
    ctx.arc(24, 24, 3.6, 0, Math.PI * 2);
    ctx.fill();

    // Dorsal quad-laser turret & iconic rectangular sensor dish
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(-2, 0, 7.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.arc(-10, -12, 4.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawPlayerVehicle(ctx: CanvasRenderingContext2D, sx: number, sy: number): void {
    if (this.invulnTimer > 0 && Math.floor(this.elapsed * 18) % 2 === 0) return;
    if (this.subStage === 0) {
      this.drawSpeederBike(ctx, sx, sy, true, this.boostTimer > 0, this.playerBank);
    } else if (this.subStage === 1) {
      this.drawAtStWalker(ctx, sx, sy, this.playerStride, true, 0);
    } else {
      this.drawMillenniumFalcon(ctx, sx, sy, this.boostTimer > 0, this.playerBank);
    }
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, en: RotjEnemy, sx: number, sy: number): void {
    if (en.kind === 'scout') {
      this.drawSpeederBike(ctx, sx, sy, false, false, 0);
    } else if (en.kind === 'atst') {
      this.drawAtStWalker(ctx, sx, sy, en.stride, false, en.hitFlash);
    } else if (en.kind === 'turret') {
      ctx.save();
      ctx.fillStyle = 'rgba(2, 6, 23, 0.45)';
      ctx.beginPath();
      ctx.ellipse(sx, sy + 4, 22, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = en.hitFlash > 0 ? '#FFFFFF' : '#475569';
      ctx.beginPath();
      ctx.arc(sx, sy - 6, 18, Math.PI, 0);
      ctx.lineTo(sx + 18, sy + 2);
      ctx.lineTo(sx - 18, sy + 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(sx - 15, sy - 11, 12, 4);
      ctx.restore();
    } else if (en.kind === 'interceptor') {
      ctx.save();
      ctx.translate(sx, sy - 24);
      ctx.fillStyle = 'rgba(2, 6, 23, 0.46)';
      ctx.beginPath();
      ctx.ellipse(0, 28, 22, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = en.hitFlash > 0 ? '#FFFFFF' : '#1E293B';
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-28, -15);
      ctx.lineTo(-10, -4);
      ctx.lineTo(-28, 13);
      ctx.lineTo(-19, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(28, -15);
      ctx.lineTo(10, -4);
      ctx.lineTo(28, 13);
      ctx.lineTo(19, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      const pod = ctx.createRadialGradient(-2, -3, 2, 0, 0, 10);
      pod.addColorStop(0, '#E2E8F0');
      pod.addColorStop(1, '#334155');
      ctx.fillStyle = pod;
      ctx.beginPath();
      ctx.arc(0, 0, 9.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4ADE80';
      ctx.beginPath();
      ctx.arc(-2, 1, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (en.kind === 'bunker_conduit' || en.kind === 'core_conduit') {
      // Flanking Shield Power Conduit Tower!
      ctx.save();
      ctx.fillStyle = en.hitFlash > 0 ? '#FFFFFF' : '#334155';
      ctx.fillRect(sx - 16, sy - 58, 32, 62);
      const glow = Math.sin(this.elapsed * 10 + en.id) > 0 ? '#38BDF8' : '#FEF08A';
      ctx.fillStyle = glow;
      ctx.fillRect(sx - 10, sy - 48, 20, 36);
      ctx.strokeStyle = '#E0F2FE';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx - 16, sy - 58, 32, 62);
      ctx.font = '800 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#38BDF8';
      ctx.fillText(`CONDUIT ${Math.ceil(en.hp)}`, sx, sy - 64);
      ctx.restore();
    } else if (en.kind === 'shield_dish') {
      const shielded = this.enemies.some((e) => e.kind === 'bunker_conduit');
      ctx.save();
      ctx.fillStyle = 'rgba(2, 6, 23, 0.5)';
      ctx.beginPath();
      ctx.ellipse(sx, sy + 8, 56, 26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#475569';
      ctx.fillRect(sx - 48, sy - 28, 96, 34);
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(sx - 40, sy - 34, 80, 8);
      const dish = ctx.createRadialGradient(sx - 8, sy - 56, 6, sx, sy - 52, 46);
      dish.addColorStop(0, en.hitFlash > 0 ? '#FFFFFF' : '#FEF08A');
      dish.addColorStop(0.5, '#38BDF8');
      dish.addColorStop(1, '#1E3A8A');
      ctx.fillStyle = dish;
      ctx.beginPath();
      ctx.ellipse(sx, sy - 52, 48, 29, -0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#E0F2FE';
      ctx.lineWidth = 3;
      ctx.stroke();

      if (shielded) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.72)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(sx, sy - 44, 58, 0, Math.PI * 2);
        ctx.stroke();
      }
      this.drawBossBar(ctx, sx, sy - 102, shielded ? 'SHIELDED DISH (HIT CONDUITS!)' : 'DEFLECTOR SHIELD DISH', en.hp / en.maxHp, '#38BDF8');
      ctx.restore();
    } else if (en.kind === 'reactor_core') {
      const shielded = this.enemies.some((e) => e.kind === 'core_conduit');
      ctx.save();
      const pulse = 1 + Math.sin(this.elapsed * 12) * 0.08;
      ctx.fillStyle = '#334155';
      ctx.fillRect(sx - 58, sy - 100, 18, 110);
      ctx.fillRect(sx + 40, sy - 100, 18, 110);

      const coreGrad = ctx.createRadialGradient(sx, sy - 44, 6, sx, sy - 44, 52 * pulse);
      coreGrad.addColorStop(0, '#FFFFFF');
      coreGrad.addColorStop(0.32, en.hitFlash > 0 ? '#FEF08A' : '#38BDF8');
      coreGrad.addColorStop(0.7, '#F97316');
      coreGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(sx, sy - 44, 54 * pulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = shielded ? '#38BDF8' : '#FEF08A';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.ellipse(sx, sy - 44, 38, 15, this.elapsed * 2.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(sx, sy - 44, 38, 15, -this.elapsed * 2.2, 0, Math.PI * 2);
      ctx.stroke();

      this.drawBossBar(ctx, sx, sy - 112, shielded ? 'CORE SHIELDED (HIT CONDUITS!)' : 'MAIN HYPERMATTER CORE', en.hp / en.maxHp, '#F97316');
      ctx.restore();
    }
  }

  private drawBossBar(ctx: CanvasRenderingContext2D, sx: number, sy: number, title: string, frac: number, col: string): void {
    const bw = 152;
    ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
    ctx.fillRect(sx - bw * 0.5, sy, bw, 12);
    ctx.fillStyle = col;
    ctx.fillRect(sx - bw * 0.5 + 2, sy + 2, Math.max(0, (bw - 4) * frac), 8);
    ctx.font = '800 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(title, sx, sy - 5);
  }

  private renderFireballWall(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    // Deep crimson heat wash behind wall
    for (let v = -240; v <= 240; v += 42) {
      const p = isoToScreen(this.fireballWallU, v, 18);
      const r = 74 + Math.sin(this.elapsed * 16 + v) * 16;
      const g = ctx.createRadialGradient(p.sx, p.sy, 8, p.sx, p.sy, r);
      g.addColorStop(0, '#FFFFFF');
      g.addColorStop(0.28, '#FEF08A');
      g.addColorStop(0.6, '#F97316');
      g.addColorStop(0.86, 'rgba(220, 38, 38, 0.9)');
      g.addColorStop(1, 'rgba(153, 27, 27, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderRasterExplosions(ctx: CanvasRenderingContext2D): void {
    for (const ex of this.explosions) {
      const prog = 1 - Math.max(0, ex.life / ex.maxLife);
      ctx.save();

      // Expanding thermal shockwave ring
      if (prog < 0.65) {
        ctx.globalAlpha = (1 - prog / 0.65) * 0.7;
        ctx.strokeStyle = '#FEF08A';
        ctx.lineWidth = ex.heavy ? 4 : 2.2;
        ctx.beginPath();
        ctx.arc(ex.sx, ex.sy, 8 + prog * ex.ringMax, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Billowing charcoal smoke cloud on mid-to-late frames
      if (prog > 0.22) {
        ctx.globalAlpha = Math.max(0, (1 - prog) * 0.78);
        for (const pf of ex.puffs) {
          const pr = pf.r * (0.68 + prog * 1.05);
          ctx.fillStyle = '#334155';
          ctx.beginPath();
          ctx.arc(ex.sx + pf.dx * (1 + prog * 0.9), ex.sy + pf.dy * (1 + prog * 0.9) - prog * 22, pr, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Blinding white/yellow/orange/crimson volumetric fireball spheres
      for (const pf of ex.puffs) {
        const localP = Math.max(0, Math.min(1, (prog - pf.delay) / Math.max(0.2, 1 - pf.delay)));
        if (localP <= 0) continue;
        ctx.globalAlpha = Math.max(0, 1 - localP * 1.1);
        const rad = pf.r * (0.45 + localP * 0.88);
        ctx.fillStyle = localP < 0.2 ? '#FFFFFF' : localP < 0.48 ? '#FEF08A' : pf.col;
        ctx.beginPath();
        ctx.arc(ex.sx + pf.dx * (0.4 + localP * 0.9), ex.sy + pf.dy * (0.4 + localP * 0.9) - localP * 12, rad, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Spinning raster debris chunks & embers
    for (const d of this.debris) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, d.life / d.maxLife);
      ctx.translate(d.sx, d.sy);
      ctx.rotate(d.rot);
      ctx.fillStyle = d.color;
      ctx.fillRect(-d.w * 0.5, -d.h * 0.5, d.w, d.h);
      ctx.restore();
    }
  }

  private renderRasterHud(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(7, 16, 12, 0.84)';
    ctx.fillRect(0, 0, W, 44);
    ctx.fillStyle = this.subStage === 2 ? '#F97316' : '#4ADE80';
    ctx.fillRect(0, 42, W, 2);

    ctx.font = '800 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#4ADE80';
    ctx.fillText(`VEHICLES:${this.lives}`, 14, 19);
    // 3-pip Armor Bar for current vehicle
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('ARMOR', 14, 35);
    for (let i = 0; i < this.maxShieldHits; i++) {
      ctx.fillStyle = i < this.shieldHits ? (this.shieldHits === 1 ? '#EF4444' : '#38BDF8') : '#1E293B';
      ctx.fillRect(58 + i * 16, 26, 12, 9);
    }

    ctx.textAlign = 'center';
    ctx.font = '800 12px "JetBrains Mono", monospace';
    ctx.fillStyle = '#FEF08A';
    const stageLbl =
      this.subStage === 0
        ? 'STAGE 1: ENDOR SPEEDER CHASE (LEIA)'
        : this.subStage === 1
          ? 'STAGE 2: HIJACKED AT-ST (CHEWBACCA)'
          : this.dsPhase === 3
            ? 'STAGE 3C: OUTRUN THE FIREBALL!'
            : this.dsPhase === 2
              ? 'STAGE 3B: MAIN REACTOR CORE'
              : 'STAGE 3A: DEATH STAR II (FALCON)';
    ctx.fillText(stageLbl, W * 0.5 + 10, 26);

    ctx.textAlign = 'right';
    ctx.fillStyle = this.overdriveTimer > 0 ? '#FEF08A' : this.boostEnergy >= 0.42 ? '#38BDF8' : '#94A3B8';
    const act = this.subStage === 0 ? 'RAM' : this.subStage === 1 ? 'MORTAR' : 'BOOST';
    ctx.fillText(
      this.overdriveTimer > 0 ? `OVERDRIVE ${Math.ceil(this.overdriveTimer)}S` : `${act} [SHIFT] ${Math.round(this.boostEnergy * 100)}%`,
      W - 14,
      26
    );
  }

  private renderTitleShowcase(ctx: CanvasRenderingContext2D): void {
    this.drawSpeederBike(ctx, 195, 355, true, true, 0);
    this.drawAtStWalker(ctx, 385, 330, this.elapsed * 4.5, true, 0);
    this.drawMillenniumFalcon(ctx, 575, 290, true, 0);

    ctx.save();
    ctx.fillStyle = 'rgba(6, 16, 10, 0.78)';
    ctx.fillRect(38, 68, W - 76, 118);
    ctx.strokeStyle = '#4ADE80';
    ctx.lineWidth = 2.2;
    ctx.strokeRect(38, 68, W - 76, 118);

    ctx.textAlign = 'center';
    ctx.font = '900 32px "JetBrains Mono", monospace';
    ctx.fillStyle = '#4ADE80';
    ctx.fillText('RETURN OF THE JEDI', W * 0.5, 108);
    ctx.font = '700 13px "JetBrains Mono", monospace';
    ctx.fillStyle = '#FEF08A';
    ctx.fillText('1984 ATARI 2.5D DIAGONAL ISOMETRIC RASTER — DELUXE EDITION', W * 0.5, 134);
    ctx.fillStyle = '#E2E8F0';
    ctx.fillText('EWOK TRAPS & VILLAGE · GLIDERS & SHIELD BUNKER · DEATH STAR II TUNNEL & FIREBALL', W * 0.5, 162);
    ctx.restore();
  }
}

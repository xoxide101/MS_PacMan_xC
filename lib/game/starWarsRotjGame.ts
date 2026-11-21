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
 * STAR WARS: RETURN OF THE JEDI (1984 — Atari 2.5D Diagonal Isometric Raster — True Arcade & Altitude Edition)
 *
 * Combines authentic 1984 Atari arcade set-pieces with full 3D spatial dodging (Left/Right Weave + Jump Over + Duck Under):
 *  - Stage 1: FOREST MOON OF ENDOR (Princess Leia on 74-Z Speeder Bike)
 *      • Dense Redwoods, Tree Stumps & Boulders rushing at you -> weave sharply LEFT & RIGHT!
 *      • Full-width Fallen Redwood Logs & Forest Creek Ravines -> press [SHIFT / X] to JUMP / VAULT over them
 *        with a true 2.5D altitude arc, cast ground shadow separation, and repulsor flare!
 *      • Overhead Hanging Branches & Ewok Rope Nets -> stay LOW on the ground plane to zip UNDER them!
 *      • Pursuing Imperial Scout Troopers tail you from behind & pull alongside — shoot them, side-ram them into
 *        Redwoods (+1,000), or be first through an Ewok Log/Rope Trap so it springs on the chasing trooper (+1,500)!
 *      • Culminates at the Ewok Treetop Village!
 *  - Stage 2: ENDOR SHIELD BUNKER ASSAULT (Chewbacca in Hijacked AT-ST Chicken Walker)
 *      • Authentic 1984 Rolling Logs tumbling down the slope — SHOOT them (+500), sidestep, or Hydraulic-Hop [SHIFT/X] over them!
 *      • Catapulted Rocks arcing in from the flanks with ground impact shadow telegraphs!
 *      • Friendly Ewok Hang-Gliders dropping boulders, swinging Ewok Twin-Log Traps, Imperial Mines, Enemy AT-STs (+2,000),
 *        and the multi-part Imperial Shield Bunker (destroy flanking Power Conduits -> shatter rotating Shield Dish!).
 *  - Stage 3: DEATH STAR II — SURFACE APPROACH, INTERIOR REACTOR TUNNEL, CORE & REVERSED-CAMERA FIREBALL ESCAPE!
 *      • 3A: Millennium Falcon + friendly Rebel X-Wing escorts flying over Death Star II with open-space capital ship battle!
 *            Weave LEFT/RIGHT around steel pylons, CLIMB/JUMP OVER low floor energy ridges [SHIFT/X], and fly UNDER
 *            overhead steel crossbeams!
 *      • 3B: Interior Reactor Core Tunnel -> Multi-part Main Hypermatter Reactor Core Boss!
 *      • 3C: AUTHENTIC 1984 REVERSED-CAMERA FIREBALL OUTRUN! Camera direction flips 180° — Falcon races diagonally
 *            DOWN-AND-LEFT back out of the tunnel while the roaring volumetric Raster Fireball Wall chases from TOP-RIGHT!
 *            Vault over collapsing floor barriers, thread Blast Doors, and burst out into open space!
 */

const W = 760;
const H = 560;
const HS_KEY = 'starwarsrotj_hd_highscore_v1';

// Diagonal Isometric Projection (u = 0..1000 bottom-left -> top-right, v = -210..+210 across track)
const ISO_ORIGIN_X = 188;
const ISO_ORIGIN_Y = 444;
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

interface CatapultRock {
  id: number;
  u: number;
  v: number;
  z: number;
  vu: number;
  vv: number;
  vz: number;
}

interface EscortXWing {
  offsetU: number;
  offsetV: number;
  bobPhase: number;
  fireCd: number;
}

interface PickupItem {
  id: number;
  kind: 'shield' | 'overdrive' | 'rebel';
  u: number;
  v: number;
  bob: number;
}

type ObstacleKind =
  | 'redwood'        // Tall tree -> weave LEFT/RIGHT
  | 'stump'          // Medium tree stump -> weave LEFT/RIGHT or JUMP OVER
  | 'jump_log'       // Wide fallen redwood log across lane -> JUMP OVER!
  | 'ravine'         // Sparkling forest ravine across track -> JUMP OVER or take narrow Ewok plank bridge!
  | 'high_branch'    // Overhead hanging branch / Ewok rope net -> STAY LOW (duck under, don't jump!)
  | 'ewok_trap'      // Authentic Ewok twin-log trap -> pass through first or shoot to crush chasing Imperials!
  | 'rolling_log'    // Authentic 1984 Stage 2 rolling log -> SHOOT (+500), sidestep, or JUMP OVER!
  | 'mine'           // Imperial ground mine -> SHOOT, sidestep, or JUMP OVER!
  | 'girder'         // Tall steel pylon -> weave LEFT/RIGHT
  | 'low_barrier'    // Low glowing Death Star II floor energy ridge -> CLIMB / JUMP OVER!
  | 'high_beam'      // Overhead tunnel steel crossbeam -> STAY LOW (fly under!)
  | 'force_gate'     // Vertical laser gate with safe gap -> weave into GAP
  | 'blast_door';    // Collapsing escape blast door with safe gap -> weave into GAP

interface RotjObstacle {
  id: number;
  kind: ObstacleKind;
  u: number;
  v: number;
  radius: number;
  height: number;
  widthV?: number;
  shade: number;
  triggered?: boolean;
  triggerAnim?: number;
  cleared?: boolean;
  hp?: number;
  gapV?: number; // safe bridge / gate gap lateral v
  rollAngle?: number;
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
  tailing?: boolean; // authentic 1984 Scout Trooper tailing behavior!
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
  public readonly secondaryActionLabel = 'JUMP / BOOST';

  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();
  private score = 0;
  private highScore = readHighScore(HS_KEY);
  private wave = 1;
  private lives = 4;
  private shieldHits = 3;
  private readonly maxShieldHits = 3;

  // Stage 0: Endor Speeder Bike (Leia)
  // Stage 1: Endor Shield Bunker AT-ST (Chewbacca)
  // Stage 2: Death Star II Falcon (dsPhase 0: Surface + X-Wings, 1: Interior Tunnel, 2: Reactor Core, 3: REVERSED-CAMERA Fireball Escape!)
  private subStage: 0 | 1 | 2 = 0;
  private dsPhase: 0 | 1 | 2 | 3 = 0;
  private stageDistance = 0;
  private stageGoal = 115;
  private bossSpawned = false;
  private villageApproaching = false;
  private villageU = 980;
  private escapeProgress = 0; // 0..100
  private fireballWallU = 920; // during reversed-camera escape, fireball chases from TOP-RIGHT (high u -> down toward player!)
  private exitPortalU = -140;  // open space exit appears at bottom-left during reversed escape!

  // Player 3D Isometric State (u = forward/back, v = left/right across track, z = altitude!)
  private playerU = 85;
  private playerV = 0;
  private prevPlayerV = 0;
  private playerZ = 0;      // true 3D height above terrain (0 = ground/cruise, up to 78 = airborne jump/climb!)
  private playerVz = 0;
  private playerBank = 0;   // banking roll (-1..1)
  private playerStride = 0;
  private invulnTimer = 0;
  private boostTimer = 0;
  private jumpCd = 0;
  private boostEnergy = 1;
  private overdriveTimer = 0;
  private fireCd = 0;

  // Combo scoring
  private comboCount = 0;
  private comboTimer = 0;

  // World scroll & spawners
  private scrollOffset = 0;
  private spawnObsCd = 0.3;
  private spawnEnemyCd = 0.9;
  private gliderCd = 4.2;
  private rockCd = 3.2;
  private klaxonCd = 0;
  private shakeTimer = 0;
  private hitFlash = 0;
  private whiteFlash = 0;
  private phaseTimer = 0;
  private elapsed = 0;
  private bannerText = 'RETURN OF THE JEDI (1984) — WEAVE, JUMP & DUCK IN 2.5D RASTER';

  private nextId = 1;
  private obstacles: RotjObstacle[] = [];
  private enemies: RotjEnemy[] = [];
  private bolts: RotjBolt[] = [];
  private pickups: PickupItem[] = [];
  private gliders: EwokGlider[] = [];
  private rocks: CatapultRock[] = [];
  private escorts: EscortXWing[] = [];
  private explosions: RasterExplosion[] = [];
  private debris: DebrisChunk[] = [];
  private dust: DustPuff[] = [];
  private scorches: ScorchMark[] = [];
  private spaceLasers: SpaceBattleLaser[] = [];
  private popups: ScorePopup[] = [];

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
    this.bannerText = 'STAGE 1 — ENDOR SPEEDER CHASE: WEAVE TREES, [SHIFT] JUMP LOGS, DUCK BRANCHES!';
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
    this.rocks = [];
    this.escorts = [];
    this.explosions = [];
    this.debris = [];
    this.dust = [];
    this.scorches = [];
    this.popups = [];
    this.dsPhase = 0;
    this.playerZ = 0;
    this.playerVz = 0;
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
        stageName = `W${this.wave} · REVERSED FIREBALL ESCAPE!`;
        pLabel = 'ESCAPE';
        pVal = `${Math.min(100, Math.round(this.escapeProgress))}%`;
      }
    }

    const altStr = this.playerZ > 16 ? 'AIRBORNE' : 'GROUND';
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.wave,
      lives: this.lives,
      stageName,
      primaryMetricLabel: pLabel,
      primaryMetricValue: pVal,
      secondaryMetricLabel: this.comboCount >= 2 ? `COMBO ${this.comboCount}X` : 'ALTITUDE',
      secondaryMetricValue: this.comboCount >= 2 ? `${Math.round(this.boostEnergy * 100)}%` : altStr,
      bannerText: this.bannerText,
    };
  }

  private addScore(pts: number, sx?: number, sy?: number, color = '#FACC15', label?: string, countCombo = false): void {
    let mult = 1;
    if (countCombo) {
      this.comboCount = Math.min(6, this.comboCount + 1);
      this.comboTimer = 2.9;
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
    this.rocks = [];
    this.escorts = [];
    this.scorches = [];
    this.dust = [];
    this.stageDistance = 0;
    this.bossSpawned = false;
    this.villageApproaching = false;
    this.villageU = 980;
    this.escapeProgress = 0;
    this.fireballWallU = 940;
    this.exitPortalU = -180;
    this.playerU = 85;
    this.playerV = 0;
    this.prevPlayerV = 0;
    this.playerZ = 0;
    this.playerVz = 0;
    this.playerBank = 0;
    this.boostTimer = 0;
    this.jumpCd = 0;
    this.boostEnergy = 1;
    this.invulnTimer = 1.3;
    this.spawnObsCd = 0.25;
    this.spawnEnemyCd = 0.85;
    this.gliderCd = 3.2;
    this.rockCd = 2.6;

    if (stage === 0) {
      this.stageGoal = 118 + this.wave * 15;
      this.bannerText = 'STAGE 1: ENDOR — WEAVE REDWOODS, [SHIFT] JUMP OVER LOGS/RAVINES, DUCK BRANCHES!';
      for (let i = 0; i < 7; i++) {
        this.spawnObstacle(340 + i * 115);
      }
    } else if (stage === 1) {
      this.stageGoal = 98 + this.wave * 15;
      this.bannerText = 'STAGE 2: CHEWBACCA AT-ST — SHOOT (+500) OR [SHIFT] HOP OVER ROLLING LOGS!';
      for (let i = 0; i < 4; i++) {
        this.spawnObstacle(360 + i * 165);
      }
    } else {
      this.stageGoal = 120 + this.wave * 15;
      // Authentic 1984 Rebel X-Wing wingmen flanking the Millennium Falcon on Death Star II approach!
      this.escorts = [
        { offsetU: -48, offsetV: -110, bobPhase: 0, fireCd: 0.7 },
        { offsetU: -48, offsetV: 110, bobPhase: Math.PI, fireCd: 1.1 },
      ];
      this.bannerText = 'STAGE 3A: FALCON + X-WINGS — [SHIFT] CLIMB OVER LOW RIDGES, STAY LOW UNDER BEAMS!';
      for (let i = 0; i < 4; i++) {
        this.spawnObstacle(380 + i * 165);
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
      this.whiteFlash = Math.max(this.whiteFlash, 0.16);
    }
  }

  private maybeSpawnPickup(u: number, v: number): void {
    if (Math.random() > 0.25) return;
    const r = Math.random();
    const kind: PickupItem['kind'] = r < 0.38 ? 'shield' : r < 0.74 ? 'overdrive' : 'rebel';
    this.pickups.push({ id: this.nextId++, kind, u, v, bob: Math.random() * Math.PI * 2 });
  }

  private damagePlayer(reason: string): void {
    if (this.invulnTimer > 0) return;
    const p = isoToScreen(this.playerU, this.playerV, this.playerZ + (this.subStage === 2 ? 24 : 14));
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

  private triggerJumpOrVault(): void {
    if (this.playerZ > 4 || this.jumpCd > 0) return;
    const isHeavy = this.subStage === 1;
    this.playerVz = this.subStage === 2 ? 320 : isHeavy ? 295 : 335;
    this.jumpCd = 0.16;
    this.boostTimer = this.subStage === 2 ? 0.95 : 0.72;
    arcadeAudio.playRepulsorJump(isHeavy);

    const p = isoToScreen(this.playerU, this.playerV, 20);
    // Burst of lift dust under speeder/AT-ST
    for (let i = 0; i < 4; i++) {
      this.dust.push({
        u: this.playerU - 8 + (Math.random() - 0.5) * 20,
        v: this.playerV + (Math.random() - 0.5) * 26,
        z: 4,
        r: 11,
        life: 0.36,
        maxLife: 0.36,
        color: this.subStage === 2 ? '#38BDF8' : '#E2E8F0',
      });
    }
    this.popups.push({
      x: p.sx,
      y: p.sy - 30,
      text: this.subStage === 2 ? 'CLIMB BOOST!' : isHeavy ? 'AT-ST HOP!' : 'VAULT JUMP!',
      color: '#38BDF8',
      life: 0.65,
      maxLife: 0.65,
    });
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
    if (this.jumpCd > 0) this.jumpCd = Math.max(0, this.jumpCd - safeDt);
    if (this.overdriveTimer > 0) this.overdriveTimer = Math.max(0, this.overdriveTimer - safeDt);
    if (this.comboTimer > 0) {
      this.comboTimer -= safeDt;
      if (this.comboTimer <= 0) this.comboCount = 0;
    }

    // Background space battle lasers off the Death Star II edges
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
      this.scrollOffset -= safeDt * 440;
      this.phaseTimer -= safeDt;
      if (Math.random() < safeDt * 11) {
        this.spawnRasterExplosion(360 + Math.random() * 340, 80 + Math.random() * 240, Math.random() < 0.35);
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

    const isReversedEscape = this.subStage === 2 && this.dsPhase === 3;

    // --- 3D Isometric Player Steering (Left/Right Weave + Forward/Back + True Altitude Jump!) ---
    this.prevPlayerV = this.playerV;
    const boostMult = this.boostTimer > 0 ? 1.42 : 1.0;
    const baseSpd = this.subStage === 1 ? 285 : 370;
    const moveSpd = baseSpd * boostMult;

    if (this.input.left) this.playerV -= moveSpd * safeDt;
    if (this.input.right) this.playerV += moveSpd * safeDt;
    if (this.input.up) this.playerU += moveSpd * 0.78 * safeDt;
    if (this.input.down) this.playerU -= moveSpd * 0.78 * safeDt;

    if (this.input.pointerActive) {
      const target = screenToIso(this.input.pointerX * W, this.input.pointerY * H);
      const minU = isReversedEscape ? 165 : -10;
      const maxU = isReversedEscape ? 480 : 270;
      const clampedU = Math.max(minU, Math.min(maxU, target.u));
      const clampedV = Math.max(-195, Math.min(195, target.v));
      this.playerU += (clampedU - this.playerU) * Math.min(1, safeDt * 13);
      this.playerV += (clampedV - this.playerV) * Math.min(1, safeDt * 15);
    }

    const maxLane = this.subStage === 2 && this.dsPhase >= 1 ? 168 : 198;
    const minU = isReversedEscape ? 155 : -15;
    const maxU = isReversedEscape ? 480 : 275;
    this.playerU = Math.max(minU, Math.min(maxU, this.playerU));
    this.playerV = Math.max(-maxLane, Math.min(maxLane, this.playerV));

    // Banking tilt
    const dvRate = (this.playerV - this.prevPlayerV) / Math.max(0.001, safeDt);
    const targetBank = Math.max(-1, Math.min(1, dvRate / 310));
    this.playerBank += (targetBank - this.playerBank) * Math.min(1, safeDt * 10);

    // True 3D Altitude Jump Physics (Jump Over Fallen Logs / Ravines / Rolling Logs / Low Energy Ridges!)
    if (this.playerZ > 0 || this.playerVz !== 0) {
      const prevZ = this.playerZ;
      this.playerZ += this.playerVz * safeDt;
      this.playerVz -= 740 * safeDt; // crisp arcade jump arc (~0.88s airtime, peak ~72px!)
      if (this.playerZ <= 0) {
        this.playerZ = 0;
        this.playerVz = 0;
        if (prevZ > 10 && this.subStage === 1) {
          // AT-ST heavy stomp landing shockwave!
          arcadeAudio.playAtAtStomp();
          this.shakeTimer = Math.max(this.shakeTimer, 0.14);
          this.dust.push({
            u: this.playerU,
            v: this.playerV,
            z: 4,
            r: 20,
            life: 0.42,
            maxLife: 0.42,
            color: '#CBD5E1',
          });
        }
      }
    }

    // AT-ST ground stomp & Speeder dust trails
    if (this.subStage === 1 && this.playerZ <= 1) {
      const prevSin = Math.sin(this.playerStride);
      this.playerStride += safeDt * 8.4;
      if (prevSin < 0 && Math.sin(this.playerStride) >= 0) {
        arcadeAudio.playAtAtStomp();
        this.dust.push({
          u: this.playerU - 12,
          v: this.playerV + (Math.random() - 0.5) * 18,
          z: 4,
          r: 12,
          life: 0.4,
          maxLife: 0.4,
          color: '#A8A29E',
        });
      }
    } else if (this.subStage === 0 && Math.random() < safeDt * 16) {
      this.dust.push({
        u: this.playerU - 24,
        v: this.playerV + (Math.random() - 0.5) * 10,
        z: Math.max(3, this.playerZ * 0.5),
        r: this.playerZ > 10 ? 11 : 7,
        life: 0.28,
        maxLife: 0.28,
        color: this.playerZ > 10 ? '#7DD3FC' : '#BEF264',
      });
    }

    // World scroll velocity (NOTE: Reverses sign on Stage 3C Reversed-Camera Fireball Escape!)
    const rawSpeed =
      (this.subStage === 0
        ? 415
        : this.subStage === 1
          ? 248
          : this.dsPhase === 3
            ? 505
            : this.dsPhase === 2
              ? 180
              : 385) *
      boostMult *
      (1 + (this.wave - 1) * 0.08);
    const scrollDir = isReversedEscape ? -1 : 1;
    this.scrollOffset += rawSpeed * scrollDir * safeDt;
    for (const sc of this.scorches) sc.u -= rawSpeed * scrollDir * safeDt;
    this.scorches = this.scorches.filter((sc) => sc.u > -260 && sc.u < 1180);
    for (const d of this.dust) {
      d.u -= rawSpeed * 0.65 * scrollDir * safeDt;
      d.z += 16 * safeDt;
      d.life -= safeDt;
    }
    this.dust = this.dust.filter((d) => d.life > 0);

    // --- Stage Progression & Set Pieces ---
    if (this.subStage === 0) {
      this.stageDistance += safeDt * 8.6 * boostMult;
      if (!this.villageApproaching && this.stageDistance >= this.stageGoal * 0.87) {
        this.villageApproaching = true;
        this.villageU = 960;
        arcadeAudio.playEwokHorn();
        this.bannerText = 'EWOK TREETOP VILLAGE AHEAD — BREAK THROUGH TO SAFETY!';
      }
      if (this.villageApproaching) {
        this.villageU -= rawSpeed * 0.55 * safeDt;
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
      // Ewok Hang-Gliders swooping overhead
      this.gliderCd -= safeDt;
      if (this.gliderCd <= 0 && this.gliders.length < 1) {
        this.gliderCd = 6.0;
        this.gliders.push({ u: 760, v: -220, vu: -95, vv: 130, dropCd: 0.9, wingFlap: 0 });
      }
      this.stepEwokGliders(safeDt);

      // Authentic 1984 Catapulted Rocks arcing in from the forest flanks!
      this.rockCd -= safeDt;
      if (this.rockCd <= 0 && this.rocks.length < 2) {
        this.rockCd = Math.max(1.8, 3.2 - this.wave * 0.2);
        const fromLeft = Math.random() < 0.5;
        this.rocks.push({
          id: this.nextId++,
          u: this.playerU + 160 + Math.random() * 140,
          v: fromLeft ? -255 : 255,
          z: 36,
          vu: -110,
          vv: fromLeft ? 210 : -210,
          vz: 165,
        });
      }
      this.stepCatapultRocks(safeDt);
    } else if (this.subStage === 2) {
      if (this.dsPhase === 0) {
        // Friendly Escort X-Wings flying formation and shooting TIEs!
        this.stepEscortXWings(safeDt);
        this.stageDistance += safeDt * 8.2 * boostMult;
        if (this.stageDistance >= this.stageGoal * 0.5) {
          this.dsPhase = 1;
          this.escorts = [];
          this.obstacles = [];
          this.bannerText = 'STAGE 3B: INTERIOR REACTOR TUNNEL — CLIMB OVER RIDGES, DUCK BEAMS!';
          arcadeAudio.playPowerUp();
        }
      } else if (this.dsPhase === 1) {
        this.stageDistance += safeDt * 8.4 * boostMult;
        if (this.stageDistance >= this.stageGoal) {
          this.spawnReactorCoreBoss();
        }
      } else if (this.dsPhase === 3) {
        // AUTHENTIC 1984 REVERSED-CAMERA FIREBALL OUTRUN! (Racing diagonally DOWN-AND-LEFT!)
        this.escapeProgress += safeDt * (10.5 * boostMult);
        this.klaxonCd -= safeDt;
        if (this.klaxonCd <= 0) {
          this.klaxonCd = 1.6;
          arcadeAudio.playReactorKlaxon();
        }
        // Roaring fireball wall chases from HIGH u (top-right) down toward playerU!
        const wallTarget = this.playerU + (this.boostTimer > 0 ? 225 : 135) + Math.sin(this.elapsed * 7) * 16;
        this.fireballWallU += (wallTarget - this.fireballWallU) * Math.min(1, safeDt * 1.45);
        if (Math.random() < safeDt * 13) {
          const fp = isoToScreen(this.fireballWallU - 24, (Math.random() - 0.5) * 320, 22);
          this.spawnRasterExplosion(fp.sx, fp.sy, false);
        }
        if (this.escapeProgress >= 75) {
          this.exitPortalU = Math.min(this.playerU - 40, -180 + (this.escapeProgress - 75) * 12);
        }
        if (this.escapeProgress >= 100) {
          const bonus = 15000 + this.wave * 5000;
          this.whiteFlash = 0.78;
          this.addScore(bonus, W * 0.5, H * 0.34, '#FEF08A', `DEATH STAR II DESTROYED +${bonus}!`);
          this.popups.push({
            x: W * 0.5,
            y: H * 0.44,
            text: '"A TRUE JEDI KNIGHT YOU ARE!" — YODA',
            color: '#4ADE80',
            life: 2.8,
            maxLife: 2.8,
          });
          arcadeAudio.playDeathStarSupernova();
          this.phase = 'STAGE_CLEAR';
          this.phaseTimer = 3.1;
          this.bannerText = 'YAHOO! MILLENNIUM FALCON ESCAPED — A TRUE JEDI KNIGHT YOU ARE!';
          return;
        }
      }
    }

    // --- Weapons & Jump / Boost Secondary ---
    if (this.fireCd > 0) this.fireCd -= safeDt;
    this.boostEnergy = Math.min(1, this.boostEnergy + safeDt * 0.25);

    if ((this.input.fire || this.input.fireJustPressed) && this.fireCd <= 0) {
      this.firePlayerWeapon();
    }
    if (this.input.secondaryJustPressed) {
      this.triggerJumpOrVault();
    }

    // --- Spawn Obstacles & Enemies ---
    this.spawnObsCd -= safeDt;
    if (this.spawnObsCd <= 0) {
      const rate =
        this.subStage === 0
          ? 0.4
          : this.subStage === 1
            ? 0.62
            : this.dsPhase === 3
              ? 0.52
              : this.dsPhase === 2
                ? 1.5
                : 0.56;
      this.spawnObsCd = Math.max(0.25, rate - this.wave * 0.02);
      if ((!this.bossSpawned && !this.villageApproaching) || this.dsPhase === 3) {
        // In Reversed-Camera Escape (dsPhase 3), obstacles rush from BOTTOM-LEFT (u = -210) up toward Falcon!
        this.spawnObstacle(isReversedEscape ? -220 : 940);
      }
    }

    this.spawnEnemyCd -= safeDt;
    if (this.spawnEnemyCd <= 0 && this.enemies.length < (this.bossSpawned ? 5 : 6)) {
      this.spawnEnemyCd = Math.max(0.62, (this.subStage === 0 ? 1.3 : 1.48) - this.wave * 0.08);
      if (!this.villageApproaching && this.dsPhase !== 3) {
        this.spawnEnemy();
      }
    }

    this.stepObstacles(safeDt, rawSpeed, scrollDir);
    this.stepEnemies(safeDt, rawSpeed);
    this.stepBolts(safeDt);
    this.stepPickups(safeDt, rawSpeed, scrollDir);
  }

  private stepEscortXWings(dt: number): void {
    for (const xw of this.escorts) {
      xw.bobPhase += dt * 4.5;
      xw.fireCd -= dt;
      if (xw.fireCd <= 0 && this.enemies.length > 0) {
        xw.fireCd = 1.4;
        this.bolts.push({
          u: this.playerU + xw.offsetU + 22,
          v: this.playerV + xw.offsetV,
          z: 24,
          vu: 650,
          vv: 0,
          vz: 0,
          friendly: true,
          color: '#EF4444',
          life: 1.2,
        });
      }
    }
  }

  private stepCatapultRocks(dt: number): void {
    for (let i = this.rocks.length - 1; i >= 0; i--) {
      const rk = this.rocks[i];
      rk.u += rk.vu * dt;
      rk.v += rk.vv * dt;
      rk.z += rk.vz * dt;
      rk.vz -= 340 * dt;
      if (rk.z <= 4) {
        const p = isoToScreen(rk.u, rk.v, 6);
        this.spawnRasterExplosion(p.sx, p.sy, false, rk.u, rk.v, '#78716C');
        if (Math.hypot(rk.u - this.playerU, rk.v - this.playerV) < 42 && this.playerZ < 24) {
          this.damagePlayer('CATAPULT BOULDER');
        }
        this.rocks.splice(i, 1);
      }
    }
  }

  private spawnShieldBunkerBoss(): void {
    this.bossSpawned = true;
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
    this.bannerText = 'STAGE 3B: MAIN REACTOR CORE — DESTROY REGULATOR CONDUITS & CORE!';
  }

  private stepEwokGliders(dt: number): void {
    for (let i = this.gliders.length - 1; i >= 0; i--) {
      const g = this.gliders[i];
      g.u += g.vu * dt;
      g.v += g.vv * dt;
      g.wingFlap += dt * 7;
      g.dropCd -= dt;
      if (g.dropCd <= 0) {
        g.dropCd = 1.05;
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

  private stepObstacles(dt: number, rawSpeed: number, scrollDir: number): void {
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const ob = this.obstacles[i];
      const extraSpd = ob.kind === 'rolling_log' ? 1.22 : 1.0;
      ob.u -= rawSpeed * extraSpd * scrollDir * dt;
      if (ob.kind === 'rolling_log') {
        ob.rollAngle = (ob.rollAngle ?? 0) + dt * 9.5;
      }

      // Authentic 1984 Ewok Trap: pass through FIRST safely -> it snaps shut behind you crushing chasing Scouts!
      if (ob.kind === 'ewok_trap') {
        if (!ob.triggered && ob.u < this.playerU - 18 && Math.abs(ob.v - this.playerV) < 115) {
          ob.triggered = true;
          ob.triggerAnim = 0.05;
          arcadeAudio.playEwokHorn();
        }
        if (ob.triggered) {
          ob.triggerAnim = Math.min(1, (ob.triggerAnim ?? 0) + dt * 3.8);
          for (let j = this.enemies.length - 1; j >= 0; j--) {
            const en = this.enemies[j];
            if (en.kind === 'shield_dish' || en.kind === 'reactor_core') continue;
            if (Math.abs(en.u - ob.u) < 98 && Math.abs(en.v - ob.v) < 145) {
              const p = isoToScreen(en.u, en.v, 22);
              arcadeAudio.playRasterExplosion(true);
              this.spawnRasterExplosion(p.sx, p.sy, true, en.u, en.v, '#78350F');
              this.addScore(1500, p.sx, p.sy - 20, '#4ADE80', 'EWOK TRAP CRUSH +1500!', true);
              this.enemies.splice(j, 1);
            }
          }
        }
      } else if (ob.kind === 'jump_log' || ob.kind === 'low_barrier') {
        // LOW FULL-WIDTH / WIDE BARRIER -> MUST JUMP OVER (playerZ >= 20 clears cleanly!)
        const halfW = ob.widthV ?? 160;
        if (!ob.cleared && Math.abs(ob.u - this.playerU) < 26 && Math.abs(ob.v - this.playerV) < halfW) {
          if (this.playerZ >= 18) {
            ob.cleared = true;
            const p = isoToScreen(this.playerU, this.playerV, this.playerZ + 22);
            this.addScore(300, p.sx, p.sy, '#38BDF8', ob.kind === 'jump_log' ? 'LOG VAULT +300!' : 'BARRIER CLEAR +300!');
          } else {
            ob.cleared = true;
            this.damagePlayer(ob.kind === 'jump_log' ? 'FALLEN LOG (PRESS SHIFT TO JUMP!)' : 'LOW ENERGY BARRIER (JUMP!)');
          }
        }
      } else if (ob.kind === 'ravine') {
        // FOREST CREEK RAVINE -> JUMP OVER OR TAKE THE NARROW WOODEN EWOK BRIDGE!
        if (!ob.cleared && Math.abs(ob.u - this.playerU) < 28) {
          const onBridge = Math.abs(this.playerV - (ob.gapV ?? 0)) < 52;
          if (onBridge || this.playerZ >= 16) {
            ob.cleared = true;
            if (!onBridge) {
              const p = isoToScreen(this.playerU, this.playerV, this.playerZ + 22);
              this.addScore(400, p.sx, p.sy, '#38BDF8', 'RAVINE LEAP +400!');
            }
          } else {
            ob.cleared = true;
            this.damagePlayer('CREEK RAVINE (BRIDGE OR SHIFT JUMP!)');
          }
        }
      } else if (ob.kind === 'high_branch' || ob.kind === 'high_beam') {
        // OVERHEAD HANGING BRANCH / TUNNEL CEILING BEAM -> MUST STAY LOW (duck under, don't jump!)
        const halfW = ob.widthV ?? 185;
        if (!ob.cleared && Math.abs(ob.u - this.playerU) < 24 && Math.abs(ob.v - this.playerV) < halfW) {
          if (this.playerZ < 24) {
            ob.cleared = true;
            const p = isoToScreen(this.playerU, this.playerV, 24);
            this.addScore(250, p.sx, p.sy - 20, '#4ADE80', 'LOW DUCK +250!');
          } else {
            ob.cleared = true;
            this.damagePlayer(ob.kind === 'high_branch' ? 'OVERHEAD BRANCH (STAY LOW!)' : 'CEILING BEAM (STAY LOW!)');
          }
        }
      } else if (ob.kind === 'force_gate' || ob.kind === 'blast_door') {
        if (!ob.triggered && Math.abs(ob.u - this.playerU) < 26) {
          const gap = ob.gapV ?? 0;
          if (Math.abs(this.playerV - gap) > 58) {
            this.damagePlayer(ob.kind === 'force_gate' ? 'LASER FORCE GATE' : 'COLLAPSING BLAST DOOR');
            ob.triggered = true;
          } else {
            ob.triggered = true;
            const p = isoToScreen(this.playerU, this.playerV, this.playerZ + 24);
            this.addScore(250, p.sx, p.sy - 22, '#38BDF8', 'CLEAN PASS +250');
          }
        }
      } else {
        // Tall Redwoods, Stumps, Rolling Logs, Mines, Steel Girders
        const du = Math.abs(ob.u - this.playerU);
        const dv = Math.abs(ob.v - this.playerV);
        const jumpableLow = ob.kind === 'stump' || ob.kind === 'rolling_log' || ob.kind === 'mine';
        if (du < ob.radius * 0.82 && dv < ob.radius * 0.82) {
          if (jumpableLow && this.playerZ >= 20) {
            if (!ob.cleared) {
              ob.cleared = true;
              const p = isoToScreen(this.playerU, this.playerV, this.playerZ + 22);
              this.addScore(300, p.sx, p.sy, '#38BDF8', 'HOPPED OVER +300!');
            }
          } else {
            const label =
              ob.kind === 'redwood'
                ? 'REDWOOD TRUNK'
                : ob.kind === 'rolling_log'
                  ? 'ROLLING LOG'
                  : ob.kind === 'mine'
                    ? 'IMPERIAL MINE'
                    : ob.kind === 'stump'
                      ? 'TREE STUMP'
                      : 'STEEL GIRDER';
            this.damagePlayer(label);
            this.obstacles.splice(i, 1);
            continue;
          }
        }
      }

      if ((scrollDir > 0 && ob.u < -260) || (scrollDir < 0 && ob.u > 1180)) {
        this.obstacles.splice(i, 1);
      }
    }
  }

  private stepEnemies(dt: number, rawSpeed: number): void {
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
        en.v += en.vv * dt;
        en.u -= rawSpeed * 0.22 * dt;
        for (const ob of this.obstacles) {
          if ((ob.kind === 'redwood' || ob.kind === 'stump') && Math.hypot(ob.u - en.u, ob.v - en.v) < ob.radius + 36) {
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

      if (en.tailing && en.kind === 'scout') {
        // Authentic 1984 Scout Trooper pulls up from behind to tail & flank Leia!
        en.u += (this.playerU + 55 - en.u) * Math.min(1, dt * 1.45);
        en.v += (this.playerV - en.v) * Math.min(1, dt * 1.15);
      } else {
        en.u += (en.vu - rawSpeed * (en.kind === 'turret' ? 1.0 : 0.44)) * dt;
        en.v += en.vv * dt;
        if (Math.abs(en.v) > 175) en.vv = -en.vv;
      }

      // Stage 1 Speeder Bike Side-Ram Takedown!
      if (this.subStage === 0 && en.kind === 'scout') {
        const dist = Math.hypot(en.u - this.playerU, en.v - this.playerV);
        if (dist < 44 && this.playerZ < 24) {
          if (this.boostTimer > 0 || Math.abs(this.playerBank) > 0.3) {
            en.rammed = true;
            en.tailing = false;
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
      } else if (Math.hypot(en.u - this.playerU, en.v - this.playerV) < 38 && this.playerZ < 26) {
        this.damagePlayer(en.kind === 'atst' ? 'IMPERIAL AT-ST' : 'IMPERIAL CRAFT');
        this.enemies.splice(i, 1);
        continue;
      }

      en.fireCd -= dt;
      if (en.fireCd <= 0 && en.u > this.playerU + 45 && en.u < 760) {
        en.fireCd = Math.max(0.85, 1.8 - this.wave * 0.09);
        this.bolts.push({
          u: en.u - 22,
          v: en.v,
          z: 22,
          vu: -420,
          vv: (this.playerV - en.v) * 0.4,
          vz: 0,
          friendly: false,
          color: en.kind === 'interceptor' ? '#4ADE80' : '#EF4444',
          life: 2.0,
        });
      }

      if (en.u < -240) this.enemies.splice(i, 1);
    }
  }

  private stepBolts(dt: number): void {
    const bunkerConduitsAlive = this.enemies.some((e) => e.kind === 'bunker_conduit');
    const coreConduitsAlive = this.enemies.some((e) => e.kind === 'core_conduit');
    const stageBefore = this.subStage;
    const dsPhaseBefore = this.dsPhase;

    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      if (!b) continue;
      b.u += b.vu * dt;
      b.v += b.vv * dt;
      if (b.mortar) {
        b.z += b.vz * dt;
        b.vz -= 260 * dt;
        if (b.z <= 2) {
          const p = isoToScreen(b.u, b.v, 6);
          arcadeAudio.playRasterExplosion(true);
          this.spawnRasterExplosion(p.sx, p.sy, true, b.u, b.v);
          this.bolts.splice(i, 1);
          this.damageAreaSplash(b.u, b.v, 95, 3);
          if (this.subStage !== stageBefore || this.dsPhase !== dsPhaseBefore) return;
          continue;
        }
      }
      b.life -= dt;
      if (b.life <= 0 || b.u > 980 || b.u < -260 || Math.abs(b.v) > 320) {
        this.bolts.splice(i, 1);
        continue;
      }

      if (b.friendly) {
        // 1. Shootable Authentic 1984 Rolling Logs (+500), Ewok Traps & Mines!
        let hitObs = false;
        for (let k = this.obstacles.length - 1; k >= 0; k--) {
          const ob = this.obstacles[k];
          if (ob.kind === 'rolling_log' && Math.hypot(ob.u - b.u, ob.v - b.v) < 42) {
            const p = isoToScreen(ob.u, ob.v, 14);
            arcadeAudio.playRasterExplosion(false);
            this.spawnRasterExplosion(p.sx, p.sy, false, ob.u, ob.v, '#78350F');
            this.addScore(500, p.sx, p.sy - 12, '#FEF08A', 'LOG SPLINTERED +500', true);
            this.obstacles.splice(k, 1);
            hitObs = true;
            break;
          }
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

        // 2. Enemy Hits
        let consumed = false;
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const en = this.enemies[j];
          if (!en) continue;
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
            const shielded =
              (en.kind === 'shield_dish' && bunkerConduitsAlive) ||
              (en.kind === 'reactor_core' && coreConduitsAlive);
            const dmg = b.mortar ? 3 : shielded ? 0.35 : this.overdriveTimer > 0 ? 1.8 : 1;
            en.hp -= dmg;
            en.hitFlash = 0.14;
            consumed = !b.mortar;

            if (en.hp <= 0) {
              this.enemies.splice(j, 1);
              this.handleEnemyDestroyed(en, p.sx, p.sy);
              if (this.subStage !== stageBefore || this.dsPhase !== dsPhaseBefore) return;
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
        if (consumed && i < this.bolts.length) this.bolts.splice(i, 1);
      } else {
        if (Math.hypot(b.u - this.playerU, b.v - this.playerV) < 28 && this.playerZ < 30) {
          this.bolts.splice(i, 1);
          this.damagePlayer('IMPERIAL BLASTER');
        }
      }
    }
  }

  private damageAreaSplash(u: number, v: number, radius: number, dmg: number): void {
    const stageBefore = this.subStage;
    const dsPhaseBefore = this.dsPhase;
    for (let k = this.obstacles.length - 1; k >= 0; k--) {
      const ob = this.obstacles[k];
      if ((ob.kind === 'mine' || ob.kind === 'rolling_log') && Math.hypot(ob.u - u, ob.v - v) < radius) {
        this.obstacles.splice(k, 1);
      }
    }
    for (let j = this.enemies.length - 1; j >= 0; j--) {
      const en = this.enemies[j];
      if (!en) continue;
      if (Math.hypot(en.u - u, en.v - v) < radius) {
        en.hp -= dmg;
        en.hitFlash = 0.2;
        if (en.hp <= 0) {
          const p = isoToScreen(en.u, en.v, 24);
          this.enemies.splice(j, 1);
          this.handleEnemyDestroyed(en, p.sx, p.sy);
          if (this.subStage !== stageBefore || this.dsPhase !== dsPhaseBefore) return;
        }
      }
    }
  }

  private stepPickups(dt: number, rawSpeed: number, scrollDir: number): void {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.u -= rawSpeed * 0.55 * scrollDir * dt;
      pk.bob += dt * 6;
      if (Math.hypot(pk.u - this.playerU, pk.v - this.playerV) < 40) {
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
      if (pk.u < -220 || pk.u > 1120) this.pickups.splice(i, 1);
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
      this.addScore(7500, sx, sy - 24, '#FEF08A', 'CORE DETONATED +7500! REVERSE OUTRUN!');
      this.whiteFlash = 0.6;
      this.spawnRasterExplosion(sx - 48, sy + 18, true);
      this.spawnRasterExplosion(sx + 48, sy - 18, true);
      this.enemies = [];
      this.bolts = [];
      this.obstacles = [];
      // Authentic 1984 REVERSED-CAMERA Escape! Falcon flips 180° to race DOWN-LEFT ahead of TOP-RIGHT fireball!
      this.dsPhase = 3;
      this.playerU = 340;
      this.escapeProgress = 0;
      this.fireballWallU = 760;
      this.exitPortalU = -200;
      this.boostEnergy = 1;
      this.klaxonCd = 0.3;
      this.bannerText = 'CAMERA REVERSED! RACE DOWN-LEFT — [SHIFT] VAULT BARRIERS & OUTRUN THE FIREBALL!';
      arcadeAudio.playDeathStarSupernova();
      return;
    }

    // Authentic 1984 Atari arcade scores: AT-ST = 2,000 pts!
    const pts = en.kind === 'atst' ? 2000 : en.kind === 'interceptor' ? 800 : en.kind === 'scout' ? 600 : 450;
    this.addScore(pts, sx, sy - 14, '#FACC15', undefined, true);
    this.maybeSpawnPickup(en.u, en.v);
  }

  private firePlayerWeapon(): void {
    const rapid = this.overdriveTimer > 0 ? 0.68 : 1.0;
    this.fireCd = 0.14 * rapid;
    const isReversed = this.subStage === 2 && this.dsPhase === 3;
    const dir = isReversed ? -1 : 1;

    if (this.subStage === 2) {
      arcadeAudio.playFalconQuadLaser();
      const lanes = this.overdriveTimer > 0 ? [-20, 0, 20] : [-15, 15];
      for (const dv of lanes) {
        this.bolts.push({
          u: this.playerU + 30 * dir,
          v: this.playerV + dv,
          z: this.playerZ + 24,
          vu: 690 * dir,
          vv: 0,
          vz: 0,
          friendly: true,
          color: '#38BDF8',
          life: 1.4,
        });
      }
    } else {
      arcadeAudio.playSpeederBikeLaser(false);
      const shots = this.overdriveTimer > 0 ? [-10, 10] : [0];
      for (const dv of shots) {
        this.bolts.push({
          u: this.playerU + 26,
          v: this.playerV + dv,
          z: this.playerZ + (this.subStage === 1 ? 36 : 18),
          vu: 650,
          vv: 0,
          vz: 0,
          friendly: true,
          color: this.subStage === 0 ? '#4ADE80' : '#F97316',
          life: 1.4,
        });
      }
    }
  }

  private spawnObstacle(uStart: number): void {
    const v = (Math.random() - 0.5) * 330;
    if (this.subStage === 0) {
      const r = Math.random();
      if (r < 0.17) {
        // Full-lane Fallen Redwood Log -> JUMP OVER!
        this.obstacles.push({
          id: this.nextId++,
          kind: 'jump_log',
          u: uStart,
          v: (Math.random() - 0.5) * 90,
          radius: 26,
          widthV: 145,
          height: 22,
          shade: Math.random(),
        });
      } else if (r < 0.28) {
        // Forest Creek Ravine -> JUMP OVER or take wooden Ewok plank bridge!
        this.obstacles.push({
          id: this.nextId++,
          kind: 'ravine',
          u: uStart,
          v: 0,
          radius: 30,
          height: 10,
          gapV: (Math.random() - 0.5) * 180,
          shade: 0,
        });
      } else if (r < 0.4) {
        // Overhead Hanging Branch / Ewok Rope Net -> STAY LOW (duck under!)
        this.obstacles.push({
          id: this.nextId++,
          kind: 'high_branch',
          u: uStart,
          v: 0,
          radius: 26,
          widthV: 195,
          height: 85,
          shade: Math.random(),
        });
      } else if (r < 0.52) {
        // Authentic Ewok Hanging Twin-Log Trap -> pass first to crush chasing Scout!
        this.obstacles.push({
          id: this.nextId++,
          kind: 'ewok_trap',
          u: uStart,
          v: (Math.random() - 0.5) * 130,
          radius: 34,
          height: 112,
          shade: Math.random(),
          triggered: false,
          triggerAnim: 0,
        });
      } else if (r < 0.66) {
        // Tree Stump -> weave around OR jump over!
        this.obstacles.push({
          id: this.nextId++,
          kind: 'stump',
          u: uStart,
          v,
          radius: 26,
          height: 26,
          shade: Math.random(),
        });
      } else {
        // Towering Endor Redwood Trunk -> weave LEFT / RIGHT!
        this.obstacles.push({
          id: this.nextId++,
          kind: 'redwood',
          u: uStart,
          v,
          radius: 28,
          height: 150 + Math.random() * 55,
          shade: Math.random(),
        });
      }
    } else if (this.subStage === 1) {
      const r = Math.random();
      if (r < 0.34) {
        // Authentic 1984 Rolling Log tumbling down the Endor slope -> SHOOT (+500), sidestep, or HOP OVER!
        this.obstacles.push({
          id: this.nextId++,
          kind: 'rolling_log',
          u: uStart,
          v: (Math.random() - 0.5) * 240,
          radius: 32,
          height: 24,
          shade: Math.random(),
          rollAngle: 0,
        });
      } else if (r < 0.54) {
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
      } else if (r < 0.74) {
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
          v: Math.abs(v) < 90 ? (v < 0 ? -150 : 150) : v,
          radius: 28,
          height: 130 + Math.random() * 45,
          shade: Math.random(),
        });
      }
    } else {
      // Death Star II: Low Floor Energy Ridges (CLIMB OVER!), High Overhead Beams (FLY UNDER!), Force Gates, Blast Doors & Steel Pylons!
      const r = Math.random();
      if (this.dsPhase === 3 && r < 0.44) {
        this.obstacles.push({
          id: this.nextId++,
          kind: 'blast_door',
          u: uStart,
          v: 0,
          radius: 30,
          height: 92,
          shade: 0,
          gapV: (Math.random() - 0.5) * 195,
        });
      } else if (r < 0.34) {
        this.obstacles.push({
          id: this.nextId++,
          kind: 'low_barrier',
          u: uStart,
          v: 0,
          radius: 26,
          widthV: 185,
          height: 26,
          shade: 0,
        });
      } else if (r < 0.58) {
        this.obstacles.push({
          id: this.nextId++,
          kind: 'high_beam',
          u: uStart,
          v: 0,
          radius: 26,
          widthV: 195,
          height: 82,
          shade: 0,
        });
      } else if (this.dsPhase === 0 && r < 0.76) {
        this.obstacles.push({
          id: this.nextId++,
          kind: 'force_gate',
          u: uStart,
          v: 0,
          radius: 30,
          height: 74,
          shade: 0,
          gapV: (Math.random() - 0.5) * 200,
        });
      } else {
        this.obstacles.push({
          id: this.nextId++,
          kind: 'girder',
          u: uStart,
          v: (Math.random() - 0.5) * 280,
          radius: 30,
          height: 76 + Math.random() * 35,
          shade: Math.random(),
        });
      }
    }
  }

  private spawnEnemy(): void {
    if (this.subStage === 0) {
      // 35% of Scout Troopers enter from BEHIND to authentically tail Leia!
      const tail = Math.random() < 0.35;
      this.enemies.push({
        id: this.nextId++,
        kind: 'scout',
        u: tail ? -95 : 780,
        v: (Math.random() - 0.5) * 260,
        vu: tail ? 120 : 35,
        vv: (Math.random() - 0.5) * 145,
        hp: 2,
        maxHp: 2,
        fireCd: 1.15,
        stride: 0,
        hitFlash: 0,
        tailing: tail,
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
      const kind: RotjEnemy['kind'] = Math.random() < 0.66 ? 'interceptor' : 'turret';
      this.enemies.push({
        id: this.nextId++,
        kind,
        u: 810,
        v: (Math.random() - 0.5) * 275,
        vu: kind === 'interceptor' ? -85 : 0,
        vv: kind === 'interceptor' ? (Math.random() - 0.5) * 175 : 0,
        hp: kind === 'interceptor' ? 2 : 3,
        maxHp: kind === 'interceptor' ? 2 : 3,
        fireCd: 0.88,
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
  // 2.5D DIAGONAL ISOMETRIC SHADED RASTER RENDERER
  // =========================================================================
  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.save();
    ctx.scale(dpr, dpr);

    if (this.shakeTimer > 0) {
      const mag = this.shakeTimer * 25;
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }

    // 1. Isometric Environment Backdrop
    if (this.subStage === 2 && this.phase !== 'TITLE') {
      this.renderDeathStar2World(ctx);
    } else {
      this.renderEndorWorld(ctx);
    }

    // Ground Ravines first (underneath all sprites!)
    for (const ob of this.obstacles) {
      if (ob.kind === 'ravine') this.drawRavineGround(ctx, ob);
    }

    // Scorched craters
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

    // Dust puffs
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

    if (this.subStage === 0 && this.villageApproaching) {
      this.renderEwokVillage(ctx);
    }
    if (this.subStage === 2 && this.dsPhase === 3 && this.escapeProgress >= 72) {
      this.renderEscapeExitPortal(ctx);
    }

    // 2. Depth-Sorted 2.5D Raster Actors (Painter's Algorithm!)
    interface Renderable {
      depth: number;
      draw: () => void;
    }
    const queue: Renderable[] = [];

    for (const ob of this.obstacles) {
      if (ob.kind === 'ravine') continue;
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
    for (const xw of this.escorts) {
      const p = isoToScreen(this.playerU + xw.offsetU, this.playerV + xw.offsetV, 0);
      queue.push({ depth: p.sy, draw: () => this.drawEscortXWing(ctx, p.sx, p.sy, xw.bobPhase) });
    }
    if (this.phase !== 'TITLE') {
      const pp = isoToScreen(this.playerU, this.playerV, 0);
      queue.push({ depth: pp.sy + 2, draw: () => this.drawPlayerVehicle(ctx, pp.sx, pp.sy) });
    }

    queue.sort((a, b) => a.depth - b.depth);
    for (const item of queue) item.draw();

    // 3. Overhead Ewok Gliders & Catapulted Rocks
    for (const g of this.gliders) this.drawEwokGlider(ctx, g);
    for (const rk of this.rocks) this.drawCatapultRock(ctx, rk);

    // 4. Bolts & Mortars
    for (const b of this.bolts) {
      const p0 = isoToScreen(b.u, b.v, b.z);
      if (b.mortar) {
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
        const dir = b.vu >= 0 ? 1 : -1;
        const p1 = isoToScreen(b.u - 36 * dir, b.v - b.vv * 0.04, b.z);
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

    // 5. Authentic Reversed-Camera Roaring Volumetric Raster Fireball Wall chasing from TOP-RIGHT!
    if (this.subStage === 2 && this.dsPhase === 3 && this.phase === 'PLAYING') {
      this.renderFireballWall(ctx);
    }

    // 6. Sunbeams on Endor
    if (this.subStage < 2) {
      this.renderEndorSunbeams(ctx);
    }

    // 7. Volumetric Multi-Stage Raster Explosions & Flying Debris
    this.renderRasterExplosions(ctx);

    // 8. Title Screen Showcase
    if (this.phase === 'TITLE') {
      this.renderTitleShowcase(ctx);
    }

    // 9. Popups
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
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0F3D22');
    bg.addColorStop(0.5, '#14532D');
    bg.addColorStop(1, '#1A2E1A');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const pBL = isoToScreen(-290, -185);
    const pBR = isoToScreen(-290, 185);
    const pTR = isoToScreen(1160, 185);
    const pTL = isoToScreen(1160, -185);

    ctx.fillStyle = '#3B2314';
    ctx.beginPath();
    ctx.moveTo(pBR.sx, pBR.sy);
    ctx.lineTo(pTR.sx, pTR.sy);
    ctx.lineTo(pTR.sx, pTR.sy + 20);
    ctx.lineTo(pBR.sx, pBR.sy + 20);
    ctx.closePath();
    ctx.fill();

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

    const step = 120;
    const mod = ((this.scrollOffset % step) + step) % step;
    for (let u = -220 - mod; u < 1120; u += step) {
      const l = isoToScreen(u, -182);
      const r = isoToScreen(u, 182);
      ctx.strokeStyle = this.subStage === 1 ? 'rgba(203, 213, 225, 0.16)' : 'rgba(254, 240, 138, 0.16)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(l.sx, l.sy);
      ctx.lineTo(r.sx, r.sy);
      ctx.stroke();

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

  private drawRavineGround(ctx: CanvasRenderingContext2D, ob: RotjObstacle): void {
    const wL1 = isoToScreen(ob.u - 28, -210);
    const wR1 = isoToScreen(ob.u - 28, 210);
    const wR2 = isoToScreen(ob.u + 28, 210);
    const wL2 = isoToScreen(ob.u + 28, -210);

    ctx.save();
    // Deep forest gorge water
    ctx.fillStyle = '#0369A1';
    ctx.beginPath();
    ctx.moveTo(wL1.sx, wL1.sy);
    ctx.lineTo(wR1.sx, wR1.sy);
    ctx.lineTo(wR2.sx, wR2.sy);
    ctx.lineTo(wL2.sx, wL2.sy);
    ctx.closePath();
    ctx.fill();

    // Sparkling rapids highlight
    const sL = isoToScreen(ob.u, -195);
    const sR = isoToScreen(ob.u, 195);
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sL.sx, sL.sy);
    ctx.lineTo(sR.sx, sR.sy);
    ctx.stroke();

    // Narrow Wooden Ewok Plank Bridge at gapV!
    const gv = ob.gapV ?? 0;
    const bL1 = isoToScreen(ob.u - 30, gv - 46);
    const bR1 = isoToScreen(ob.u - 30, gv + 46);
    const bR2 = isoToScreen(ob.u + 30, gv + 46);
    const bL2 = isoToScreen(ob.u + 30, gv - 46);
    ctx.fillStyle = '#78350F';
    ctx.beginPath();
    ctx.moveTo(bL1.sx, bL1.sy);
    ctx.lineTo(bR1.sx, bR1.sy);
    ctx.lineTo(bR2.sx, bR2.sy);
    ctx.lineTo(bL2.sx, bL2.sy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#FDE68A';
    ctx.lineWidth = 2;
    ctx.stroke();

    const lbl = isoToScreen(ob.u, gv > 0 ? -95 : 95, 16);
    ctx.font = '900 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#BAE6FD';
    ctx.fillText('▲ JUMP / BRIDGE', lbl.sx, lbl.sy);
    ctx.restore();
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
    for (const hv of [-125, 0, 125]) {
      const p = isoToScreen(this.villageU, hv, 0);
      ctx.fillStyle = '#78350F';
      ctx.fillRect(p.sx - 14, p.sy - 125, 28, 125);
      ctx.fillStyle = '#92400E';
      ctx.beginPath();
      ctx.ellipse(p.sx, p.sy - 88, 40, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#D97706';
      ctx.beginPath();
      ctx.arc(p.sx, p.sy - 92, 26, Math.PI, 0);
      ctx.fill();
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
    ctx.fillStyle = this.dsPhase >= 1 ? '#050811' : '#03060E';
    ctx.fillRect(0, 0, W, H);

    if (this.dsPhase === 0) {
      for (const st of this.bgStars) {
        ctx.fillStyle = `rgba(226, 232, 240, ${0.4 + Math.sin(this.elapsed * 3 + st.tw) * 0.4})`;
        ctx.fillRect(st.x, st.y, st.s, st.s);
      }
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

    const laneHalf = this.dsPhase >= 1 ? 185 : 210;
    const pBL = isoToScreen(-290, -laneHalf);
    const pBR = isoToScreen(-290, laneHalf);
    const pTR = isoToScreen(1160, laneHalf);
    const pTL = isoToScreen(1160, -laneHalf);

    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.moveTo(pBR.sx, pBR.sy);
    ctx.lineTo(pTR.sx, pTR.sy);
    ctx.lineTo(pTR.sx, pTR.sy + 26);
    ctx.lineTo(pBR.sx, pBR.sy + 26);
    ctx.closePath();
    ctx.fill();

    const deck = ctx.createLinearGradient(pBL.sx, pBL.sy, pTR.sx, pTR.sy);
    if (this.dsPhase === 3) {
      deck.addColorStop(0, '#1E293B');
      deck.addColorStop(0.55, '#334155');
      deck.addColorStop(1, '#7C2D12');
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

    const step = 92;
    const mod = ((this.scrollOffset % step) + step) % step;
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
    const g = ctx.createRadialGradient(pMid.sx, pMid.sy, 8, pMid.sx, pMid.sy, 115);
    g.addColorStop(0, '#FFFFFF');
    g.addColorStop(0.45, 'rgba(56, 189, 248, 0.78)');
    g.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(pMid.sx, pMid.sy, 115, 0, Math.PI * 2);
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
      ctx.fillStyle = 'rgba(6, 20, 10, 0.48)';
      ctx.beginPath();
      ctx.ellipse(sx + 26, sy + 8, 34, 13, 0.25, 0, Math.PI * 2);
      ctx.fill();

      const tw = 24;
      const trunk = ctx.createLinearGradient(sx - tw * 0.5, sy, sx + tw * 0.5, sy);
      trunk.addColorStop(0, '#3B1404');
      trunk.addColorStop(0.32, '#9A3412');
      trunk.addColorStop(0.62, '#78350F');
      trunk.addColorStop(1, '#230A02');
      ctx.fillStyle = trunk;
      ctx.fillRect(sx - tw * 0.5, sy - ob.height, tw, ob.height);

      ctx.strokeStyle = 'rgba(253, 186, 116, 0.28)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(sx - 3, sy - 6);
      ctx.lineTo(sx - 3, sy - ob.height + 12);
      ctx.stroke();

      ctx.fillStyle = '#5C240B';
      ctx.beginPath();
      ctx.ellipse(sx, sy, 17, 8, 0, 0, Math.PI * 2);
      ctx.fill();

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
    } else if (ob.kind === 'stump') {
      ctx.fillStyle = 'rgba(6, 20, 10, 0.44)';
      ctx.beginPath();
      ctx.ellipse(sx + 8, sy + 5, 22, 10, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#78350F';
      ctx.fillRect(sx - 16, sy - 24, 32, 24);
      ctx.fillStyle = '#FDE68A';
      ctx.beginPath();
      ctx.ellipse(sx, sy - 24, 16, 7.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#92400E';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (ob.kind === 'jump_log') {
      // Wide Fallen Redwood Log spanning track -> clear ▲ JUMP OVER cue!
      const hw = ob.widthV ?? 145;
      const a = isoToScreen(ob.u, ob.v - hw, 0);
      const b = isoToScreen(ob.u, ob.v + hw, 0);
      ctx.strokeStyle = 'rgba(10, 20, 10, 0.5)';
      ctx.lineWidth = 22;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(a.sx + 6, a.sy + 6);
      ctx.lineTo(b.sx + 6, b.sy + 6);
      ctx.stroke();

      ctx.strokeStyle = '#78350F';
      ctx.lineWidth = 20;
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy - 8);
      ctx.lineTo(b.sx, b.sy - 8);
      ctx.stroke();
      ctx.strokeStyle = '#B45309';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy - 13);
      ctx.lineTo(b.sx, b.sy - 13);
      ctx.stroke();

      // Clear amber/cyan JUMP cue
      ctx.font = '900 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FEF08A';
      ctx.fillText('▲ JUMP LOG [SHIFT] ▲', sx, sy - 26);
    } else if (ob.kind === 'rolling_log') {
      // Authentic 1984 Rolling Log tumbling down Endor terrain!
      const rot = ob.rollAngle ?? 0;
      ctx.fillStyle = 'rgba(10, 20, 10, 0.45)';
      ctx.beginPath();
      ctx.ellipse(sx + 6, sy + 6, 36, 13, 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.translate(sx, sy - 9);
      ctx.rotate(0.45);
      const lg = ctx.createLinearGradient(0, -11, 0, 11);
      lg.addColorStop(0, '#D97706');
      lg.addColorStop(0.5, '#78350F');
      lg.addColorStop(1, '#451A03');
      ctx.fillStyle = lg;
      ctx.fillRect(-34, -10, 68, 20);
      // Spinning bark stripe
      const stripeY = Math.sin(rot) * 7;
      ctx.fillStyle = '#FDE68A';
      ctx.fillRect(-32, stripeY - 1.5, 64, 3);
      ctx.beginPath();
      ctx.ellipse(34, 0, 5.5, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.rotate(-0.45);
      ctx.font = '900 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FEF08A';
      ctx.fillText('SHOOT / HOP', 0, -22);
    } else if (ob.kind === 'high_branch' || ob.kind === 'high_beam') {
      // OVERHEAD HANGING BRANCH / TUNNEL CEILING CROSSBEAM -> STAY LOW (duck under)!
      const hw = ob.widthV ?? 190;
      const a = isoToScreen(ob.u, ob.v - hw, 0);
      const b = isoToScreen(ob.u, ob.v + hw, 0);
      // Ground shadow strip showing clearance underneath!
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.32)';
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.stroke();

      // Side supports + high overhead beam/branch at z=66!
      const h = 66;
      ctx.fillStyle = ob.kind === 'high_branch' ? '#5C240B' : '#334155';
      ctx.fillRect(a.sx - 7, a.sy - h - 10, 14, h + 10);
      ctx.fillRect(b.sx - 7, b.sy - h - 10, 14, h + 10);

      ctx.strokeStyle = ob.kind === 'high_branch' ? '#78350F' : '#64748B';
      ctx.lineWidth = 18;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy - h);
      ctx.lineTo(b.sx, b.sy - h);
      ctx.stroke();
      ctx.strokeStyle = ob.kind === 'high_branch' ? '#22C55E' : '#F59E0B';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy - h - 6);
      ctx.lineTo(b.sx, b.sy - h - 6);
      ctx.stroke();

      ctx.font = '900 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#4ADE80';
      ctx.fillText('▼ STAY LOW (UNDER) ▼', sx, sy - h - 18);
    } else if (ob.kind === 'low_barrier') {
      // Death Star II Low Glowing Floor Energy Ridge -> CLIMB / JUMP OVER!
      const hw = ob.widthV ?? 185;
      const a = isoToScreen(ob.u, ob.v - hw, 0);
      const b = isoToScreen(ob.u, ob.v + hw, 0);
      ctx.strokeStyle = '#F97316';
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy - 10);
      ctx.lineTo(b.sx, b.sy - 10);
      ctx.stroke();
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy - 14);
      ctx.lineTo(b.sx, b.sy - 14);
      ctx.stroke();

      ctx.font = '900 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FEF08A';
      ctx.fillText('▲ CLIMB OVER [SHIFT] ▲', sx, sy - 28);
    } else if (ob.kind === 'ewok_trap') {
      const anim = ob.triggerAnim ?? 0;
      const pL = isoToScreen(ob.u, ob.v - 85, 0);
      const pR = isoToScreen(ob.u, ob.v + 85, 0);
      ctx.fillStyle = '#78350F';
      ctx.fillRect(pL.sx - 6, pL.sy - 96, 12, 96);
      ctx.fillRect(pR.sx - 6, pR.sy - 96, 12, 96);
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
        ctx.fillText('EWOK TRAP', sx, sy - 76);
      }
    } else if (ob.kind === 'mine') {
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
    } else if (ob.kind === 'force_gate' || ob.kind === 'blast_door') {
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
      const gp = isoToScreen(ob.u, gap, 28);
      ctx.fillStyle = '#38BDF8';
      ctx.font = '900 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('▲ GAP ▲', gp.sx, gp.sy);
    } else {
      // Steel Girder / Pylon
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
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(sx - 13, sy - ob.height + 8, 26, 6);
      ctx.fillRect(sx - 13, sy - 18, 26, 5);
    }
    ctx.restore();
  }

  private drawCatapultRock(ctx: CanvasRenderingContext2D, rk: CatapultRock): void {
    const sh = isoToScreen(rk.u, rk.v, 0);
    const p = isoToScreen(rk.u, rk.v, rk.z);
    ctx.save();
    // Warning shadow reticle on ground!
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(sh.sx, sh.sy, 16, 8, 0, 0, Math.PI * 2);
    ctx.stroke();

    const g = ctx.createRadialGradient(p.sx - 4, p.sy - 4, 2, p.sx, p.sy, 14);
    g.addColorStop(0, '#D6D3D1');
    g.addColorStop(0.6, '#78716C');
    g.addColorStop(1, '#292524');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawEscortXWing(ctx: CanvasRenderingContext2D, sx: number, sy: number, bobPhase: number): void {
    const bob = Math.sin(bobPhase) * 5;
    ctx.save();
    ctx.fillStyle = 'rgba(2, 6, 23, 0.45)';
    ctx.beginPath();
    ctx.ellipse(sx + 6, sy + 16, 18, 8, -0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(sx, sy - 18 + bob);
    ctx.rotate(-0.5);
    // Rebel X-Wing silhouette!
    ctx.fillStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(-14, -5);
    ctx.lineTo(-14, 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(-16, -18);
    ctx.moveTo(-8, 0);
    ctx.lineTo(-16, 18);
    ctx.stroke();
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(-10, -2, 8, 4);
    ctx.fillStyle = '#F97316';
    ctx.beginPath();
    ctx.arc(-16, -4, 3, 0, Math.PI * 2);
    ctx.arc(-16, 4, 3, 0, Math.PI * 2);
    ctx.fill();
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
    ctx.fillStyle = 'rgba(6, 20, 10, 0.35)';
    ctx.beginPath();
    ctx.ellipse(sh.sx, sh.sy, 26, 11, 0.3, 0, Math.PI * 2);
    ctx.fill();
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
    ctx.fillStyle = '#78350F';
    ctx.beginPath();
    ctx.arc(0, 10, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawSpeederBike(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    isPlayer: boolean,
    boost: boolean,
    bank = 0,
    altitude = 0
  ): void {
    ctx.save();
    const bob = Math.sin(this.elapsed * 12 + sx * 0.04) * 2.5;
    // Ground shadow shrinks slightly & separates vertically as bike vaults high in the air!
    const shScale = Math.max(0.55, 1 - altitude / 160);
    ctx.fillStyle = 'rgba(4, 15, 8, 0.48)';
    ctx.beginPath();
    ctx.ellipse(sx + 4, sy + 11, 28 * shScale, 10 * shScale, -0.45, 0, Math.PI * 2);
    ctx.fill();

    // Vertical cyan repulsor beam line when airborne so jump height reads unmistakably!
    if (altitude > 8) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.42)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(sx, sy + 6);
      ctx.lineTo(sx, sy - 11 - altitude);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.translate(sx, sy - 11 - altitude + bob);
    // Tilt nose upward during jump rise!
    const jumpPitch = altitude > 6 ? -0.22 : 0;
    ctx.rotate(-0.52 + bank * 0.24 + jumpPitch);

    ctx.fillStyle = boost || altitude > 10 ? '#38BDF8' : '#F97316';
    ctx.beginPath();
    ctx.ellipse(-28, 0, boost || altitude > 10 ? 20 : 10, boost ? 7 : 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

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

    ctx.fillStyle = isPlayer ? '#F59E0B' : '#94A3B8';
    ctx.fillRect(-19, -3, 40, 2.6);

    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(12, -4);
    ctx.lineTo(34, -9);
    ctx.moveTo(12, 4);
    ctx.lineTo(34, 9);
    ctx.stroke();

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

  private drawAtStWalker(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    stride: number,
    friendly: boolean,
    hitFlash: number,
    altitude = 0
  ): void {
    ctx.save();
    const shScale = Math.max(0.58, 1 - altitude / 160);
    ctx.fillStyle = 'rgba(4, 12, 8, 0.5)';
    ctx.beginPath();
    ctx.ellipse(sx + 6, sy + 6, 28 * shScale, 12 * shScale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(0, -altitude);

    for (const side of [-1, 1]) {
      const ph = stride + (side === 1 ? Math.PI : 0);
      const swing = altitude > 6 ? side * 8 : Math.sin(ph) * 12;
      const lift = altitude > 6 ? 12 : Math.max(0, Math.cos(ph)) * 8;
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

      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.arc(kneeX, kneeY, 3.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#1E293B';
      ctx.fillRect(footX - 7, footY - 3, 14, 5.5);
    }

    const bobY = altitude > 6 ? 0 : Math.abs(Math.sin(stride)) * 3;
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

    ctx.fillStyle = hitFlash > 0 ? '#FFFFFF' : friendly ? '#E2E8F0' : '#94A3B8';
    ctx.beginPath();
    ctx.moveTo(hx - 19, hy - 10);
    ctx.lineTo(hx + 17, hy - 14);
    ctx.lineTo(hx + 9, hy - 23);
    ctx.lineTo(hx - 21, hy - 19);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#334155';
    ctx.fillRect(hx + 18, hy - 2, 12, 3.5);
    ctx.fillStyle = friendly ? '#4ADE80' : '#EF4444';
    ctx.fillRect(hx + 6, hy - 8, 5, 4);
    ctx.fillRect(hx + 14, hy - 9, 5, 4);

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

  private drawMillenniumFalcon(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    boost: boolean,
    bank = 0,
    altitude = 0,
    reversed = false
  ): void {
    ctx.save();
    const shScale = Math.max(0.55, 1 - altitude / 160);
    ctx.fillStyle = 'rgba(2, 6, 23, 0.58)';
    ctx.beginPath();
    ctx.ellipse(sx + 10, sy + 18, 38 * shScale, 17 * shScale, -0.42, 0, Math.PI * 2);
    ctx.fill();

    if (altitude > 8) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(sx, sy + 12);
      ctx.lineTo(sx, sy - 20 - altitude);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.translate(sx, sy - 20 - altitude);
    // Flip 180° nose-down-left during the authentic 1984 Reversed-Camera Fireball Escape!
    ctx.rotate((reversed ? Math.PI - 0.5 : -0.5) + bank * 0.28);

    ctx.fillStyle = boost || altitude > 10 ? '#FFFFFF' : '#38BDF8';
    ctx.beginPath();
    ctx.ellipse(-28, 0, boost || altitude > 10 ? 20 : 10, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = boost ? 'rgba(186, 230, 253, 0.55)' : 'rgba(56, 189, 248, 0.34)';
    ctx.beginPath();
    ctx.ellipse(-36, 0, boost ? 34 : 16, 19, 0, 0, Math.PI * 2);
    ctx.fill();

    const hull = ctx.createRadialGradient(-4, -6, 4, 0, 0, 32);
    hull.addColorStop(0, '#F8FAFC');
    hull.addColorStop(0.55, '#CBD5E1');
    hull.addColorStop(1, '#64748B');
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.ellipse(-2, 0, 29, 23, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-24, 0);
    ctx.lineTo(14, 0);
    ctx.moveTo(-4, -22);
    ctx.lineTo(-4, 22);
    ctx.stroke();

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

    ctx.fillStyle = '#B91C1C';
    ctx.fillRect(16, -11, 10, 3);
    ctx.fillRect(16, 8, 10, 3);

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
      this.drawSpeederBike(ctx, sx, sy, true, this.boostTimer > 0, this.playerBank, this.playerZ);
    } else if (this.subStage === 1) {
      this.drawAtStWalker(ctx, sx, sy, this.playerStride, true, 0, this.playerZ);
    } else {
      this.drawMillenniumFalcon(ctx, sx, sy, this.boostTimer > 0, this.playerBank, this.playerZ, this.dsPhase === 3);
    }
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, en: RotjEnemy, sx: number, sy: number): void {
    if (en.kind === 'scout') {
      this.drawSpeederBike(ctx, sx, sy, false, false, 0, 0);
    } else if (en.kind === 'atst') {
      this.drawAtStWalker(ctx, sx, sy, en.stride, false, en.hitFlash, 0);
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
    const bw = 156;
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
    for (let v = -240; v <= 240; v += 40) {
      const p = isoToScreen(this.fireballWallU, v, 20);
      const r = 78 + Math.sin(this.elapsed * 16 + v) * 18;
      const g = ctx.createRadialGradient(p.sx, p.sy, 8, p.sx, p.sy, r);
      g.addColorStop(0, '#FFFFFF');
      g.addColorStop(0.28, '#FEF08A');
      g.addColorStop(0.6, '#F97316');
      g.addColorStop(0.86, 'rgba(220, 38, 38, 0.92)');
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
      if (prog < 0.65) {
        ctx.globalAlpha = (1 - prog / 0.65) * 0.7;
        ctx.strokeStyle = '#FEF08A';
        ctx.lineWidth = ex.heavy ? 4 : 2.2;
        ctx.beginPath();
        ctx.arc(ex.sx, ex.sy, 8 + prog * ex.ringMax, 0, Math.PI * 2);
        ctx.stroke();
      }
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
    ctx.fillStyle = 'rgba(7, 16, 12, 0.85)';
    ctx.fillRect(0, 0, W, 44);
    ctx.fillStyle = this.subStage === 2 ? '#F97316' : '#4ADE80';
    ctx.fillRect(0, 42, W, 2);

    ctx.font = '800 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#4ADE80';
    ctx.fillText(`VEHICLES:${this.lives}`, 14, 19);
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
            ? 'STAGE 3C: REVERSED FIREBALL ESCAPE!'
            : this.dsPhase === 2
              ? 'STAGE 3B: MAIN REACTOR CORE'
              : 'STAGE 3A: DEATH STAR II (FALCON)';
    ctx.fillText(stageLbl, W * 0.5 + 8, 26);

    ctx.textAlign = 'right';
    ctx.fillStyle = this.playerZ > 16 ? '#38BDF8' : this.overdriveTimer > 0 ? '#FEF08A' : '#CBD5E1';
    ctx.fillText(
      this.playerZ > 16
        ? 'ALTITUDE: AIRBORNE ▲'
        : this.overdriveTimer > 0
          ? `OVERDRIVE ${Math.ceil(this.overdriveTimer)}S`
          : '[SHIFT] JUMP / VAULT',
      W - 14,
      26
    );
  }

  private renderTitleShowcase(ctx: CanvasRenderingContext2D): void {
    this.drawSpeederBike(ctx, 195, 355, true, true, 0, Math.abs(Math.sin(this.elapsed * 3)) * 28);
    this.drawAtStWalker(ctx, 385, 330, this.elapsed * 4.5, true, 0, 0);
    this.drawMillenniumFalcon(ctx, 575, 290, true, 0, 12, false);

    ctx.save();
    ctx.fillStyle = 'rgba(6, 16, 10, 0.78)';
    ctx.fillRect(34, 66, W - 68, 122);
    ctx.strokeStyle = '#4ADE80';
    ctx.lineWidth = 2.2;
    ctx.strokeRect(34, 66, W - 68, 122);

    ctx.textAlign = 'center';
    ctx.font = '900 32px "JetBrains Mono", monospace';
    ctx.fillStyle = '#4ADE80';
    ctx.fillText('RETURN OF THE JEDI', W * 0.5, 106);
    ctx.font = '700 13px "JetBrains Mono", monospace';
    ctx.fillStyle = '#FEF08A';
    ctx.fillText('1984 ATARI 2.5D ISOMETRIC RASTER — WEAVE · JUMP · DUCK · REVERSED ESCAPE', W * 0.5, 132);
    ctx.fillStyle = '#E2E8F0';
    ctx.fillText('LEFT/RIGHT: WEAVE TREES  ·  SHIFT/X: JUMP LOGS & BARRIERS  ·  LOW: DUCK BRANCHES', W * 0.5, 160);
    ctx.restore();
  }
}

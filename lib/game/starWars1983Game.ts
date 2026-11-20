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
 * STAR WARS (1983 — Atari Color Vector / Quadrascan Evolved Engine)
 * Authentic 3-Phase 1983 Arcade Experience:
 *  Phase 1: Outer Space TIE Dogfight (TIE Fighters, invulnerable push-back Darth Vader TIE Advanced x1,
 *           shootable spinning Vector Fireballs, approaching 3D wireframe Death Star)
 *  Phase 2: Death Star Surface (3D perspective grid, tall Turbolaser Towers with pop-off crowns, Bunker Turrets)
 *  Phase 3: Death Star Trench Run (3D wireframe trench, horizontal Catwalk Deflector Beams with safe gaps,
 *           "USE THE FORCE" No-Fire Bonus, Thermal Exhaust Port & 3D Vector Death Star Supernova!)
 */

const W = 760;
const H = 560;
const CX = W * 0.5;
const CY = H * 0.48;
const HS_KEY = 'starwars_hd_highscore_v1';

interface VectorStar {
  x: number;
  y: number;
  z: number;
}

interface VectorLaser {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
  life: number;
  maxLife: number;
  torpedo?: boolean;
}

interface VectorShard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  vAngle: number;
  len: number;
  color: string;
  life: number;
  maxLife: number;
}

interface VectorShockRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  sides: number;
  color: string;
  rot: number;
  life: number;
  maxLife: number;
}

interface SpaceTie {
  id: number;
  kind: 'tie' | 'vader';
  wx: number; // world x (-2.2..2.2)
  wy: number; // world y (-1.5..1.5)
  z: number; // depth 1.0 (far) -> 0.06 (near)
  vx: number;
  vy: number;
  vz: number;
  roll: number;
  fireCd: number;
  vaderHits: number;
  hitFlash: number;
}

interface VectorFireball {
  wx: number;
  wy: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  spin: number;
  color: string;
}

interface SurfaceTower {
  id: number;
  wx: number;
  z: number;
  height: number;
  kind: 'tower' | 'bunker';
  topAlive: boolean;
  fireCd: number;
  hitFlash: number;
}

interface TrenchObstacle {
  id: number;
  z: number;
  gap: 'top' | 'mid' | 'bot';
  passed: boolean;
}

interface TrenchTurret {
  id: number;
  side: -1 | 1;
  wy: number;
  z: number;
  alive: boolean;
  fireCd: number;
}

export class StarWars1983Game implements ArcadeGameInstance {
  public readonly logicalWidth = W;
  public readonly logicalHeight = H;
  public readonly supportsPointerAim = true;
  public readonly primaryActionLabel = 'QUAD LASER';
  public readonly secondaryActionLabel = 'TORPEDO';

  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();
  private score = 0;
  private highScore = readHighScore(HS_KEY);
  private wave = 1;
  private shields = 6;
  private readonly maxShields = 8;

  private subStage: 0 | 1 | 2 = 0; // 0 = Space Dogfight, 1 = Surface Towers, 2 = Trench Run
  private stageProgress = 0;
  private stageTarget = 12;
  private trenchDist = 100;
  private exhaustPortOpen = false;
  private exhaustPortZ = 0.92;
  private usedForceBonusEligible = true;

  private aimX = CX;
  private aimY = CY;
  private fireCd = 0;
  private torpedoCharge = 1; // 0..1
  private hitFlash = 0;
  private shakeTimer = 0;
  private supernovaTimer = 0;
  private phaseTimer = 0;
  private elapsed = 0;
  private bannerText = 'RED FIVE STANDING BY — ENGAGE TIE FIGHTERS';

  private nextId = 1;
  private spawnCd = 0.6;
  private obstacleCd = 1.4;
  private turretCd = 1.1;
  private vaderSpawned = false;

  private stars: VectorStar[] = [];
  private lasers: VectorLaser[] = [];
  private shards: VectorShard[] = [];
  private rings: VectorShockRing[] = [];
  private popups: ScorePopup[] = [];

  private ties: SpaceTie[] = [];
  private fireballs: VectorFireball[] = [];
  private towers: SurfaceTower[] = [];
  private obstacles: TrenchObstacle[] = [];
  private trenchTurrets: TrenchTurret[] = [];

  constructor() {
    this.initStars();
  }

  private initStars(): void {
    this.stars = [];
    for (let i = 0; i < 85; i++) {
      this.stars.push({
        x: (Math.random() - 0.5) * 2.4,
        y: (Math.random() - 0.5) * 1.8,
        z: Math.random(),
      });
    }
  }

  public startNewGame(): void {
    arcadeAudio.unlock();
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.wave = 1;
    this.shields = 6;
    this.subStage = 0;
    this.setupSubStage(0);
    this.phase = 'READY';
    this.phaseTimer = 1.15;
    this.supernovaTimer = 0;
    this.bannerText = 'WAVE 1 — BATTLE OF YAVIN: TIE DOGFIGHT';
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.supernovaTimer = 0;
    this.ties = [];
    this.fireballs = [];
    this.towers = [];
    this.obstacles = [];
    this.trenchTurrets = [];
    this.lasers = [];
    this.shards = [];
    this.rings = [];
    this.popups = [];
    this.bannerText = 'STAR WARS (1983) — 3D COLOR VECTOR';
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public getHudSnapshot(): ClassicGameHud {
    const stageNames = [
      `W${this.wave} · SPACE DOGFIGHT`,
      `W${this.wave} · DEATH STAR SURFACE`,
      `W${this.wave} · DEATH STAR TRENCH`,
    ];
    let primaryLabel = 'TIES';
    let primaryVal = `${this.stageProgress}/${this.stageTarget}`;
    if (this.subStage === 1) {
      primaryLabel = 'TOWERS';
      primaryVal = `${this.stageProgress}/${this.stageTarget}`;
    } else if (this.subStage === 2) {
      primaryLabel = 'PORT DIST';
      primaryVal = this.exhaustPortOpen ? 'LOCK ON!' : `${Math.max(0, Math.round(this.trenchDist))}M`;
    }
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.wave,
      lives: this.shields,
      stageName: stageNames[this.subStage],
      primaryMetricLabel: primaryLabel,
      primaryMetricValue: primaryVal,
      secondaryMetricLabel: this.subStage === 2 && this.usedForceBonusEligible ? 'FORCE' : 'TORPEDO',
      secondaryMetricValue:
        this.subStage === 2 && this.usedForceBonusEligible
          ? 'READY'
          : `${Math.round(this.torpedoCharge * 100)}%`,
      bannerText: this.bannerText,
    };
  }

  private addScore(pts: number, x?: number, y?: number, color = '#FACC15', label?: string): void {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(HS_KEY, this.highScore);
    }
    if (x !== undefined && y !== undefined) {
      this.popups.push({
        x,
        y,
        text: label ?? `+${pts}`,
        color,
        life: 0.9,
        maxLife: 0.9,
      });
    }
  }

  private setupSubStage(stage: 0 | 1 | 2): void {
    this.subStage = stage;
    this.ties = [];
    this.fireballs = [];
    this.towers = [];
    this.obstacles = [];
    this.trenchTurrets = [];
    this.stageProgress = 0;
    this.vaderSpawned = false;
    this.exhaustPortOpen = false;
    this.exhaustPortZ = 0.95;
    this.spawnCd = 0.45;
    this.obstacleCd = 1.25;
    this.turretCd = 0.9;
    this.torpedoCharge = Math.min(1, this.torpedoCharge + 0.4);

    if (stage === 0) {
      this.stageTarget = 10 + this.wave * 3;
      this.bannerText = `WAVE ${this.wave} · PHASE 1: DESTROY TIE SQUADRON`;
    } else if (stage === 1) {
      this.stageTarget = 10 + this.wave * 3;
      this.bannerText = `WAVE ${this.wave} · PHASE 2: BLAST TURBOLASER TOWER TOPS`;
      // Pre-populate horizon surface towers
      for (let i = 0; i < 6; i++) {
        this.spawnSurfaceTower(0.45 + i * 0.11);
      }
    } else {
      this.trenchDist = 100;
      this.usedForceBonusEligible = true;
      this.bannerText = 'USE THE FORCE — REACH THE THERMAL EXHAUST PORT!';
    }
  }

  private spawnVectorExplosion(x: number, y: number, primary: string, secondary: string, heavy = false): void {
    const count = heavy ? 28 : 14;
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const spd = (heavy ? 180 : 120) + Math.random() * (heavy ? 240 : 150);
      const maxLife = (heavy ? 0.65 : 0.38) + Math.random() * 0.25;
      this.shards.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        angle: Math.random() * Math.PI * 2,
        vAngle: (Math.random() - 0.5) * 14,
        len: (heavy ? 16 : 10) + Math.random() * (heavy ? 18 : 10),
        color: i % 3 === 0 ? '#FFFFFF' : i % 2 === 0 ? primary : secondary,
        life: maxLife,
        maxLife,
      });
    }
    this.rings.push({
      x,
      y,
      radius: 6,
      maxRadius: heavy ? 115 : 52,
      sides: heavy ? 8 : 6,
      color: primary,
      rot: Math.random() * Math.PI,
      life: heavy ? 0.55 : 0.32,
      maxLife: heavy ? 0.55 : 0.32,
    });
    if (heavy) {
      this.rings.push({
        x,
        y,
        radius: 4,
        maxRadius: 72,
        sides: 10,
        color: '#FFFFFF',
        rot: 0.4,
        life: 0.4,
        maxLife: 0.4,
      });
      this.shakeTimer = Math.max(this.shakeTimer, 0.24);
    }
  }

  private takeShieldHit(reason: string): void {
    if (this.hitFlash > 0.1) return;
    this.shields -= 1;
    this.hitFlash = 0.42;
    this.shakeTimer = 0.28;
    arcadeAudio.playVectorExplosion(true);
    this.spawnVectorExplosion(CX + (Math.random() - 0.5) * 140, CY + (Math.random() - 0.5) * 90, '#EF4444', '#FACC15', false);
    this.bannerText = this.shields <= 2 ? `CRITICAL SHIELDS (${this.shields}) — ${reason}!` : `SHIELD HIT — ${reason}!`;

    if (this.shields <= 0) {
      this.phase = 'GAME_OVER';
      this.bannerText = 'RED FIVE DOWN — PRESS PLAY TO LAUNCH AGAIN';
      arcadeAudio.playDeath();
    }
  }

  public step(dt: number): void {
    const safeDt = Math.min(0.05, dt);
    this.elapsed += safeDt;

    // Update stars continuously
    const starSpeed = this.phase === 'PLAYING' ? (this.subStage === 2 ? 0.85 : 0.45) : 0.22;
    for (const s of this.stars) {
      s.z -= safeDt * starSpeed;
      if (s.z <= 0.02) {
        s.x = (Math.random() - 0.5) * 2.4;
        s.y = (Math.random() - 0.5) * 1.8;
        s.z = 1;
      }
    }

    // Update visual effects
    this.stepEffects(safeDt);

    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - safeDt);
    if (this.shakeTimer > 0) this.shakeTimer = Math.max(0, this.shakeTimer - safeDt);

    if (this.phase === 'TITLE' || this.phase === 'PAUSED' || this.phase === 'GAME_OVER') {
      return;
    }

    if (this.phase === 'READY') {
      this.phaseTimer -= safeDt;
      if (this.phaseTimer <= 0) this.phase = 'PLAYING';
      return;
    }

    if (this.phase === 'STAGE_CLEAR') {
      this.supernovaTimer = Math.max(0, this.supernovaTimer - safeDt);
      this.phaseTimer -= safeDt;
      if (this.supernovaTimer > 0.2 && Math.random() < safeDt * 12) {
        const ang = Math.random() * Math.PI * 2;
        const rad = Math.random() * 110;
        this.spawnVectorExplosion(
          CX + Math.cos(ang) * rad,
          CY + Math.sin(ang) * rad,
          Math.random() < 0.5 ? '#FACC15' : '#EF4444',
          '#38BDF8',
          false
        );
      }
      if (this.phaseTimer <= 0) {
        this.wave += 1;
        this.shields = Math.min(this.maxShields, this.shields + 1);
        this.setupSubStage(0);
        this.phase = 'READY';
        this.phaseTimer = 1.2;
      }
      return;
    }

    // --- Aiming (smooth pointer + keyboard / virtual joystick) ---
    const moveSpd = 430;
    if (this.input.left) this.aimX -= moveSpd * safeDt;
    if (this.input.right) this.aimX += moveSpd * safeDt;
    if (this.input.up) this.aimY -= moveSpd * safeDt;
    if (this.input.down) this.aimY += moveSpd * safeDt;

    if (this.input.pointerActive) {
      const tx = this.input.pointerX * W;
      const ty = this.input.pointerY * H;
      this.aimX += (tx - this.aimX) * Math.min(1, safeDt * 22);
      this.aimY += (ty - this.aimY) * Math.min(1, safeDt * 22);
    }

    // Keep within play zone
    const padX = this.subStage === 2 ? 115 : 46;
    const padTop = 68;
    const padBot = 62;
    this.aimX = Math.max(padX, Math.min(W - padX, this.aimX));
    this.aimY = Math.max(padTop, Math.min(H - padBot, this.aimY));

    // Weapon cooldown & torpedo charge
    if (this.fireCd > 0) this.fireCd -= safeDt;
    this.torpedoCharge = Math.min(1, this.torpedoCharge + safeDt * 0.16);

    if ((this.input.fire || this.input.fireJustPressed) && this.fireCd <= 0) {
      this.fireQuadLasers(false);
    }
    if (this.input.secondaryJustPressed && this.torpedoCharge >= 0.99) {
      this.torpedoCharge = 0;
      this.fireQuadLasers(true);
    }

    if (this.subStage === 0) this.stepSpaceDogfight(safeDt);
    else if (this.subStage === 1) this.stepSurfaceTowers(safeDt);
    else this.stepTrenchRun(safeDt);
  }

  private stepEffects(dt: number): void {
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      this.lasers[i].life -= dt;
      if (this.lasers[i].life <= 0) this.lasers.splice(i, 1);
    }
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const s = this.shards[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= 1 - Math.min(0.9, dt * 1.9);
      s.vy *= 1 - Math.min(0.9, dt * 1.9);
      s.angle += s.vAngle * dt;
      s.life -= dt;
      if (s.life <= 0) this.shards.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      const t = 1 - Math.max(0, r.life / r.maxLife);
      r.radius = 6 + (r.maxRadius - 6) * (1 - Math.pow(1 - t, 2.2));
      r.rot += dt * 2.4;
      if (r.life <= 0) this.rings.splice(i, 1);
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.y -= 32 * dt;
      p.life -= dt;
      if (p.life <= 0) this.popups.splice(i, 1);
    }
  }

  private project3D(wx: number, wy: number, z: number): { sx: number; sy: number; scale: number } {
    const safeZ = Math.max(0.06, z);
    const scale = 1 / safeZ;
    // Slight banking camera parallax from aim offset
    const camX = (this.aimX - CX) * 0.08;
    const camY = (this.aimY - CY) * 0.06;
    return {
      sx: CX + wx * 175 * scale - camX,
      sy: CY + wy * 145 * scale - camY,
      scale,
    };
  }

  private fireQuadLasers(torpedo: boolean): void {
    this.fireCd = torpedo ? 0.22 : 0.125;
    arcadeAudio.playXWingQuadLaser(torpedo);

    if (this.subStage === 2 && !this.exhaustPortOpen) {
      this.usedForceBonusEligible = false;
    }

    const corners: Array<[number, number]> = [
      [36, 54],
      [W - 36, 54],
      [36, H - 46],
      [W - 36, H - 46],
    ];
    const col = torpedo ? '#38BDF8' : '#4ADE80';
    for (const [cx, cy] of corners) {
      this.lasers.push({
        x0: cx,
        y0: cy,
        x1: this.aimX,
        y1: this.aimY,
        color: col,
        life: torpedo ? 0.16 : 0.095,
        maxLife: torpedo ? 0.16 : 0.095,
        torpedo,
      });
    }

    const hitRadius = torpedo ? 74 : 42;

    // 1. Intercept incoming glowing fireballs first (iconic 1983 mechanic!)
    for (let i = this.fireballs.length - 1; i >= 0; i--) {
      const fb = this.fireballs[i];
      const p = this.project3D(fb.wx, fb.wy, fb.z);
      const r = Math.max(18, 13 * p.scale) + hitRadius * 0.65;
      if (Math.hypot(p.sx - this.aimX, p.sy - this.aimY) <= r) {
        this.fireballs.splice(i, 1);
        this.addScore(33, p.sx, p.sy, '#F97316', '+33');
        this.spawnVectorExplosion(p.sx, p.sy, '#FACC15', '#EF4444', false);
      }
    }

    // 2. Phase 1: Space TIE Fighters & Darth Vader TIE Advanced x1
    if (this.subStage === 0) {
      for (let i = this.ties.length - 1; i >= 0; i--) {
        const t = this.ties[i];
        const p = this.project3D(t.wx, t.wy, t.z);
        const r = Math.max(24, 18 * p.scale) + hitRadius * 0.72;
        if (Math.hypot(p.sx - this.aimX, p.sy - this.aimY) <= r) {
          if (t.kind === 'vader') {
            // Authentic 1983 Vader: invulnerable, knocking him back awards 2,000 bonus!
            t.vaderHits += 1;
            t.hitFlash = 0.25;
            t.z = Math.min(0.95, t.z + 0.18);
            t.vx = -t.vx * 1.15;
            arcadeAudio.playVectorExplosion(false);
            this.spawnVectorExplosion(p.sx, p.sy, '#EF4444', '#FACC15', false);
            if (t.vaderHits >= 4) {
              this.addScore(2000, p.sx, p.sy, '#FACC15', 'VADER REPELLED +2000!');
              this.spawnVectorExplosion(p.sx, p.sy, '#FACC15', '#EF4444', true);
              this.ties.splice(i, 1);
              this.stageProgress += 2;
              this.bannerText = 'DARTH VADER FORCED BACK! +2000 PTS';
            } else {
              this.addScore(200, p.sx, p.sy, '#F87171', 'VADER HIT +200');
            }
          } else {
            this.ties.splice(i, 1);
            this.stageProgress += 1;
            arcadeAudio.playVectorExplosion(false);
            this.addScore(1000, p.sx, p.sy, '#4ADE80', '+1000');
            this.spawnVectorExplosion(p.sx, p.sy, '#38BDF8', '#FACC15', false);
          }
          if (!torpedo) break;
        }
      }
    }

    // 3. Phase 2: Death Star Surface Turbolaser Tower Crowns & Bunkers
    if (this.subStage === 1) {
      for (const tw of this.towers) {
        if (!tw.topAlive) continue;
        const topWy = 0.62 - tw.height;
        const p = this.project3D(tw.wx, topWy, tw.z);
        const r = Math.max(20, 14 * p.scale) + hitRadius * 0.72;
        if (Math.hypot(p.sx - this.aimX, p.sy - this.aimY) <= r) {
          tw.topAlive = false;
          tw.hitFlash = 0.25;
          this.stageProgress += 1;
          arcadeAudio.playVectorExplosion(false);
          const pts = tw.kind === 'tower' ? 200 : 300;
          this.addScore(pts, p.sx, p.sy, '#FACC15', tw.kind === 'tower' ? 'TOWER TOP +200' : 'BUNKER +300');
          this.spawnVectorExplosion(p.sx, p.sy, '#FACC15', '#EF4444', false);
          if (!torpedo) break;
        }
      }
    }

    // 4. Phase 3: Trench Wall Turrets & Thermal Exhaust Port!
    if (this.subStage === 2) {
      for (const tr of this.trenchTurrets) {
        if (!tr.alive) continue;
        const p = this.project3D(tr.side * 0.92, tr.wy, tr.z);
        const r = Math.max(20, 14 * p.scale) + hitRadius * 0.65;
        if (Math.hypot(p.sx - this.aimX, p.sy - this.aimY) <= r) {
          tr.alive = false;
          arcadeAudio.playVectorExplosion(false);
          this.addScore(100, p.sx, p.sy, '#F97316', '+100');
          this.spawnVectorExplosion(p.sx, p.sy, '#F97316', '#FACC15', false);
          if (!torpedo) break;
        }
      }

      if (this.exhaustPortOpen) {
        const ep = this.project3D(0, 0.22, this.exhaustPortZ);
        const portR = Math.max(26, 20 * ep.scale) + hitRadius * 0.85;
        if (Math.hypot(ep.sx - this.aimX, ep.sy - this.aimY) <= portR) {
          this.triggerDeathStarDestruction(ep.sx, ep.sy);
        }
      }
    }
  }

  private triggerDeathStarDestruction(x: number, y: number): void {
    const waveBonus = 10000 + this.wave * 5000;
    const forceBonus = this.usedForceBonusEligible ? 5000 * this.wave : 0;
    this.addScore(waveBonus + forceBonus, x, y - 24, '#FACC15', `DEATH STAR DESTROYED +${waveBonus}!`);
    if (forceBonus > 0) {
      this.popups.push({
        x: CX,
        y: CY - 64,
        text: `THE FORCE IS STRONG! +${forceBonus}`,
        color: '#38BDF8',
        life: 2.2,
        maxLife: 2.2,
      });
    }
    arcadeAudio.playDeathStarSupernova();
    this.spawnVectorExplosion(CX, CY, '#FACC15', '#EF4444', true);
    this.spawnVectorExplosion(CX, CY, '#38BDF8', '#FFFFFF', true);
    this.supernovaTimer = 2.6;
    this.phase = 'STAGE_CLEAR';
    this.phaseTimer = 2.8;
    this.bannerText = forceBonus > 0
      ? `GREAT SHOT KID! FORCE BONUS +${forceBonus}`
      : 'GREAT SHOT KID, THAT WAS ONE IN A MILLION!';
  }

  private stepSpaceDogfight(dt: number): void {
    const speedScale = 1 + (this.wave - 1) * 0.14;
    this.spawnCd -= dt;
    if (this.spawnCd <= 0 && this.ties.length < 4 + Math.min(3, this.wave)) {
      this.spawnCd = Math.max(0.55, 1.35 - this.wave * 0.1);
      const spawnVader = !this.vaderSpawned && this.stageProgress >= Math.floor(this.stageTarget * 0.45);
      if (spawnVader) {
        this.vaderSpawned = true;
        arcadeAudio.playTieScreech();
        this.bannerText = 'WARNING: DARTH VADER TIE ADVANCED DETECTED!';
      } else if (Math.random() < 0.35) {
        arcadeAudio.playTieScreech();
      }
      this.ties.push({
        id: this.nextId++,
        kind: spawnVader ? 'vader' : 'tie',
        wx: (Math.random() - 0.5) * 1.9,
        wy: (Math.random() - 0.5) * 1.15,
        z: 1.0,
        vx: (Math.random() - 0.5) * (spawnVader ? 1.1 : 0.75) * speedScale,
        vy: (Math.random() - 0.5) * 0.55 * speedScale,
        vz: (spawnVader ? 0.18 : 0.22 + Math.random() * 0.12) * speedScale,
        roll: 0,
        fireCd: 0.75 + Math.random() * 0.75,
        vaderHits: 0,
        hitFlash: 0,
      });
    }

    for (let i = this.ties.length - 1; i >= 0; i--) {
      const t = this.ties[i];
      if (t.hitFlash > 0) t.hitFlash -= dt;
      t.wx += t.vx * dt;
      t.wy += t.vy * dt + Math.sin(this.elapsed * 3 + t.id) * 0.22 * dt;
      t.z -= t.vz * dt;
      t.roll = Math.sin(this.elapsed * 2.5 + t.id) * 0.28;

      if (Math.abs(t.wx) > 1.35) t.vx = -t.vx;
      if (Math.abs(t.wy) > 0.92) t.vy = -t.vy;

      t.fireCd -= dt;
      if (t.fireCd <= 0 && t.z > 0.28 && t.z < 0.92) {
        t.fireCd = (t.kind === 'vader' ? 0.95 : 1.55) / speedScale;
        this.fireballs.push({
          wx: t.wx,
          wy: t.wy,
          z: t.z,
          vx: -t.wx * 0.65,
          vy: -t.wy * 0.65,
          vz: 0.42 * speedScale,
          spin: 0,
          color: t.kind === 'vader' ? '#EF4444' : '#F97316',
        });
      }

      if (t.z <= 0.08) {
        // Swooped past cockpit
        this.ties.splice(i, 1);
      }
    }

    this.stepFireballs(dt);

    if (this.stageProgress >= this.stageTarget) {
      arcadeAudio.playStageClear();
      this.setupSubStage(1);
    }
  }

  private spawnSurfaceTower(zStart = 1.0): void {
    const isBunker = Math.random() < 0.3;
    this.towers.push({
      id: this.nextId++,
      wx: (Math.random() - 0.5) * 1.9,
      z: zStart,
      height: isBunker ? 0.22 : 0.44 + Math.random() * 0.34,
      kind: isBunker ? 'bunker' : 'tower',
      topAlive: true,
      fireCd: 0.9 + Math.random() * 1.1,
      hitFlash: 0,
    });
  }

  private stepSurfaceTowers(dt: number): void {
    const speed = (0.34 + this.wave * 0.04);
    this.spawnCd -= dt;
    if (this.spawnCd <= 0 && this.towers.length < 11) {
      this.spawnCd = Math.max(0.28, 0.55 - this.wave * 0.04);
      this.spawnSurfaceTower(1.0);
    }

    for (let i = this.towers.length - 1; i >= 0; i--) {
      const tw = this.towers[i];
      if (tw.hitFlash > 0) tw.hitFlash -= dt;
      tw.z -= speed * dt;
      tw.fireCd -= dt;

      if (tw.topAlive && tw.fireCd <= 0 && tw.z > 0.32 && tw.z < 0.88) {
        tw.fireCd = 1.65;
        const topWy = 0.62 - tw.height;
        this.fireballs.push({
          wx: tw.wx,
          wy: topWy,
          z: tw.z,
          vx: -tw.wx * 0.62,
          vy: -topWy * 0.6,
          vz: 0.46 + this.wave * 0.04,
          spin: 0,
          color: '#FACC15',
        });
      }

      if (tw.z <= 0.1) {
        // Collision check if pilot dives straight into an intact tall tower center
        const p = this.project3D(tw.wx, 0.38, tw.z);
        if (tw.topAlive && Math.abs(p.sx - this.aimX) < 38 && this.aimY > H * 0.54) {
          this.takeShieldHit('TOWER COLLISION');
        }
        this.towers.splice(i, 1);
      }
    }

    this.stepFireballs(dt);

    if (this.stageProgress >= this.stageTarget) {
      arcadeAudio.playStageClear();
      this.setupSubStage(2);
    }
  }

  private stepTrenchRun(dt: number): void {
    const speed = 0.42 + this.wave * 0.04;
    if (!this.exhaustPortOpen) {
      this.trenchDist -= dt * (9.5 + this.wave * 1.1);
      if (this.trenchDist <= 0) {
        this.trenchDist = 0;
        this.exhaustPortOpen = true;
        this.exhaustPortZ = 0.96;
        this.bannerText = 'EXHAUST PORT IN SIGHT — FIRE PROTON TORPEDOES!';
        arcadeAudio.playPowerUp();
      }
    } else {
      this.exhaustPortZ -= dt * 0.17;
      if (this.exhaustPortZ <= 0.12) {
        // Missed exhaust port — loop back for another trench pass!
        this.exhaustPortOpen = false;
        this.trenchDist = 65;
        this.usedForceBonusEligible = false;
        this.bannerText = 'MISSED PORT — SWINGING AROUND FOR ANOTHER RUN!';
        this.takeShieldHit('MISSED EXHAUST PORT');
      }
    }

    // Spawn horizontal Catwalk Deflector Beams with clear Top/Mid/Bottom safe gaps
    this.obstacleCd -= dt;
    if (!this.exhaustPortOpen && this.obstacleCd <= 0) {
      this.obstacleCd = Math.max(0.85, 1.55 - this.wave * 0.08);
      const gaps: Array<'top' | 'mid' | 'bot'> = ['top', 'mid', 'bot'];
      this.obstacles.push({
        id: this.nextId++,
        z: 1.0,
        gap: gaps[Math.floor(Math.random() * gaps.length)],
        passed: false,
      });
    }

    // Spawn trench wall laser emplacements
    this.turretCd -= dt;
    if (this.turretCd <= 0 && this.trenchTurrets.length < 5) {
      this.turretCd = Math.max(0.75, 1.35 - this.wave * 0.07);
      this.trenchTurrets.push({
        id: this.nextId++,
        side: Math.random() < 0.5 ? -1 : 1,
        wy: (Math.random() - 0.5) * 0.7,
        z: 1.0,
        alive: true,
        fireCd: 0.8 + Math.random() * 0.6,
      });
    }

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const ob = this.obstacles[i];
      ob.z -= speed * dt;
      if (!ob.passed && ob.z <= 0.14) {
        ob.passed = true;
        const normY = (this.aimY - 68) / (H - 130); // 0=top, 1=bot
        const safe =
          (ob.gap === 'top' && normY < 0.42) ||
          (ob.gap === 'mid' && normY >= 0.28 && normY <= 0.72) ||
          (ob.gap === 'bot' && normY > 0.58);
        if (!safe) {
          this.takeShieldHit('CATWALK BEAM');
        } else {
          this.addScore(150, this.aimX, this.aimY - 22, '#38BDF8', 'CLEAR +150');
        }
      }
      if (ob.z <= 0.06) this.obstacles.splice(i, 1);
    }

    for (let i = this.trenchTurrets.length - 1; i >= 0; i--) {
      const tr = this.trenchTurrets[i];
      tr.z -= speed * dt;
      tr.fireCd -= dt;
      if (tr.alive && tr.fireCd <= 0 && tr.z > 0.3 && tr.z < 0.88) {
        tr.fireCd = 1.6;
        this.fireballs.push({
          wx: tr.side * 0.85,
          wy: tr.wy,
          z: tr.z,
          vx: -tr.side * 0.55,
          vy: -tr.wy * 0.4,
          vz: 0.44 + this.wave * 0.04,
          spin: 0,
          color: '#EF4444',
        });
      }
      if (tr.z <= 0.08) this.trenchTurrets.splice(i, 1);
    }

    this.stepFireballs(dt);
  }

  private stepFireballs(dt: number): void {
    for (let i = this.fireballs.length - 1; i >= 0; i--) {
      const fb = this.fireballs[i];
      fb.wx += fb.vx * dt;
      fb.wy += fb.vy * dt;
      fb.z -= fb.vz * dt;
      fb.spin += dt * 11;
      if (fb.z <= 0.09) {
        this.fireballs.splice(i, 1);
        this.takeShieldHit('ENEMY FIREBALL');
      }
    }
  }

  // --- High-Speed Luminous Double-Pass Color-Vector Renderer (No slow shadowBlur!) ---
  private drawGlowLine(
    ctx: CanvasRenderingContext2D,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    color: string,
    width = 2.0,
    alpha = 1
  ): void {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.globalAlpha = alpha * 0.28;
    ctx.strokeStyle = color;
    ctx.lineWidth = width * 3.1;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();

    ctx.globalAlpha = alpha * 0.72;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = Math.max(0.75, width * 0.42);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.restore();
  }

  private drawGlowPoly(
    ctx: CanvasRenderingContext2D,
    pts: Array<[number, number]>,
    color: string,
    width = 1.9,
    closed = true,
    alpha = 1
  ): void {
    if (pts.length < 2) return;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const trace = () => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      if (closed) ctx.closePath();
    };

    ctx.globalAlpha = alpha * 0.25;
    ctx.strokeStyle = color;
    ctx.lineWidth = width * 3.2;
    trace();
    ctx.stroke();

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    trace();
    ctx.stroke();

    ctx.globalAlpha = alpha * 0.62;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = Math.max(0.7, width * 0.36);
    trace();
    ctx.stroke();
    ctx.restore();
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.save();
    ctx.scale(dpr, dpr);

    // Deep Quadrascan CRT Void Black
    ctx.fillStyle = '#02040A';
    ctx.fillRect(0, 0, W, H);

    // Subtle radial phosphor bloom
    const bgGrad = ctx.createRadialGradient(CX, CY, 20, CX, CY, W * 0.65);
    bgGrad.addColorStop(0, this.subStage === 2 ? 'rgba(250, 204, 21, 0.055)' : 'rgba(56, 189, 248, 0.045)');
    bgGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    if (this.shakeTimer > 0) {
      const mag = this.shakeTimer * 26;
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }

    // 1. 3D Warp Starfield
    for (const s of this.stars) {
      const p = this.project3D(s.x, s.y, s.z);
      if (p.sx < 0 || p.sx > W || p.sy < 0 || p.sy > H) continue;
      const bright = Math.min(1, 1.2 - s.z);
      ctx.fillStyle = `rgba(226, 232, 240, ${bright})`;
      const sz = Math.max(1, (1 - s.z) * 2.6);
      ctx.fillRect(p.sx, p.sy, sz, sz);
    }

    // 2. Phase-Specific 3D Vector Environments
    if (this.phase === 'TITLE') {
      this.renderDeathStarWireframe(ctx, 1.05, 0);
      this.renderTitleOverlay(ctx);
    } else if (this.phase === 'STAGE_CLEAR') {
      const exp = Math.max(0, 1 - this.supernovaTimer / 2.6);
      this.renderDeathStarWireframe(ctx, 1.3 + exp * 1.4, exp);
    } else if (this.subStage === 0) {
      const progress = Math.min(1, this.stageProgress / Math.max(1, this.stageTarget));
      this.renderDeathStarWireframe(ctx, 0.45 + progress * 0.72, 0);
      this.renderSpaceTies(ctx);
    } else if (this.subStage === 1) {
      this.renderSurfaceGrid(ctx);
      this.renderSurfaceTowers(ctx);
    } else {
      this.renderTrench(ctx);
    }

    // 3. Incoming Vector Fireballs
    this.renderFireballs(ctx);

    // 4. Quad X-Wing Lasers
    for (const l of this.lasers) {
      const alpha = Math.max(0, l.life / l.maxLife);
      this.drawGlowLine(ctx, l.x0, l.y0, l.x1, l.y1, l.color, l.torpedo ? 3.4 : 2.1, alpha);
    }

    // 5. Evolved 3D Vector Shatter Shards & Shockwave Rings
    this.renderVectorExplosions(ctx);

    // 6. X-Wing Targeting Reticle & Cockpit Frame
    if (this.phase === 'PLAYING' || this.phase === 'READY') {
      this.renderXWingCockpit(ctx);
      this.renderReticle(ctx);
    }

    // 7. Score Popups
    for (const pop of this.popups) {
      const a = Math.min(1, (pop.life / pop.maxLife) * 1.8);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = '800 14px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x, pop.y);
      ctx.restore();
    }

    // Shield hit red flash
    if (this.hitFlash > 0) {
      ctx.fillStyle = `rgba(239, 68, 68, ${Math.min(0.42, this.hitFlash)})`;
      ctx.fillRect(0, 0, W, H);
    }

    // Classic Atari 1983 Vector Top Shield & Status Bar
    this.renderVectorHud(ctx);

    if (visualMode === 'crt') {
      renderCrtOverlay(ctx, W, H);
    }

    ctx.restore();
  }

  private renderDeathStarWireframe(ctx: CanvasRenderingContext2D, scale: number, explodeFrac: number): void {
    const r = 82 * scale;
    const cx = CX;
    const cy = CY - 10;
    const col = explodeFrac > 0 ? '#FACC15' : '#38BDF8';
    const alpha = Math.max(0, 1 - explodeFrac * 0.9);
    const drift = explodeFrac * 70;

    // Equatorial trench rings
    const segs = 16;
    const outerPts: Array<[number, number]> = [];
    for (let i = 0; i < segs; i++) {
      const a = (Math.PI * 2 * i) / segs + this.elapsed * 0.14;
      const rad = r + drift * (i % 2 === 0 ? 1 : 0.6);
      outerPts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
    }
    this.drawGlowPoly(ctx, outerPts, col, 1.8, true, alpha * 0.85);

    // Meridian arcs
    for (let m = -2; m <= 2; m++) {
      const rx = r * (0.28 + Math.abs(m) * 0.22);
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= 12; i++) {
        const a = -Math.PI * 0.5 + (Math.PI * i) / 12;
        pts.push([cx + Math.cos(a) * rx * (m < 0 ? -1 : 1) + drift * 0.25 * m, cy + Math.sin(a) * r]);
      }
      this.drawGlowPoly(ctx, pts, '#60A5FA', 1.1, false, alpha * 0.45);
    }

    // Iconic Equatorial Trench Band
    this.drawGlowLine(ctx, cx - r, cy - 3, cx + r, cy - 3, '#FACC15', 1.4, alpha * 0.78);
    this.drawGlowLine(ctx, cx - r, cy + 3, cx + r, cy + 3, '#FACC15', 1.4, alpha * 0.78);

    // Superlaser Concave Dish
    const dishX = cx + r * 0.28 + drift * 0.4;
    const dishY = cy - r * 0.34 - drift * 0.35;
    const dishR = r * 0.24;
    const dishPts: Array<[number, number]> = [];
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI * 2 * i) / 10;
      dishPts.push([dishX + Math.cos(a) * dishR, dishY + Math.sin(a) * dishR]);
    }
    this.drawGlowPoly(ctx, dishPts, '#4ADE80', 1.5, true, alpha * 0.9);
    this.drawGlowLine(ctx, dishX - dishR * 0.6, dishY, dishX + dishR * 0.6, dishY, '#4ADE80', 1, alpha * 0.6);
    this.drawGlowLine(ctx, dishX, dishY - dishR * 0.6, dishX, dishY + dishR * 0.6, '#4ADE80', 1, alpha * 0.6);
  }

  private renderSpaceTies(ctx: CanvasRenderingContext2D): void {
    const sorted = [...this.ties].sort((a, b) => b.z - a.z);
    for (const t of sorted) {
      const p = this.project3D(t.wx, t.wy, t.z);
      const s = Math.max(8, 22 * p.scale);
      ctx.save();
      ctx.translate(p.sx, p.sy);
      ctx.rotate(t.roll);

      if (t.kind === 'vader') {
        // Darth Vader's TIE Advanced x1 — Bent angled solar wings in crimson/gold vector!
        const wingCol = t.hitFlash > 0 ? '#FFFFFF' : '#EF4444';
        const coreCol = '#FACC15';
        // Left bent wing
        this.drawGlowPoly(
          ctx,
          [
            [-s * 1.15, -s * 0.95],
            [-s * 1.48, 0],
            [-s * 1.15, s * 0.95],
            [-s * 0.68, s * 0.62],
            [-s * 0.85, 0],
            [-s * 0.68, -s * 0.62],
          ],
          wingCol,
          2.0,
          true
        );
        // Right bent wing
        this.drawGlowPoly(
          ctx,
          [
            [s * 1.15, -s * 0.95],
            [s * 1.48, 0],
            [s * 1.15, s * 0.95],
            [s * 0.68, s * 0.62],
            [s * 0.85, 0],
            [s * 0.68, -s * 0.62],
          ],
          wingCol,
          2.0,
          true
        );
        // Central armored pod & struts
        this.drawGlowLine(ctx, -s * 0.82, 0, s * 0.82, 0, coreCol, 2.0);
        this.drawGlowPoly(
          ctx,
          [
            [-s * 0.36, -s * 0.32],
            [s * 0.36, -s * 0.32],
            [s * 0.44, 0],
            [s * 0.36, s * 0.32],
            [-s * 0.36, s * 0.32],
            [-s * 0.44, 0],
          ],
          coreCol,
          1.9,
          true
        );
        ctx.font = '800 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#F87171';
        ctx.fillText('VADER', 0, -s * 1.12);
      } else {
        // Classic 1983 TIE Fighter — Hexagonal Twin Wings + Green/Cyan Cockpit Pod
        const wingCol = '#38BDF8';
        const podCol = '#4ADE80';
        const leftWing: Array<[number, number]> = [
          [-s * 1.18, -s * 0.95],
          [-s * 1.28, 0],
          [-s * 1.18, s * 0.95],
          [-s * 0.78, s * 0.72],
          [-s * 0.78, -s * 0.72],
        ];
        const rightWing: Array<[number, number]> = [
          [s * 1.18, -s * 0.95],
          [s * 1.28, 0],
          [s * 1.18, s * 0.95],
          [s * 0.78, s * 0.72],
          [s * 0.78, -s * 0.72],
        ];
        this.drawGlowPoly(ctx, leftWing, wingCol, 1.8, true);
        this.drawGlowPoly(ctx, rightWing, wingCol, 1.8, true);
        // Wing struts + central octagonal viewport
        this.drawGlowLine(ctx, -s * 0.82, 0, s * 0.82, 0, podCol, 1.9);
        const pod: Array<[number, number]> = [];
        for (let i = 0; i < 8; i++) {
          const a = (Math.PI * 2 * i) / 8;
          pod.push([Math.cos(a) * s * 0.34, Math.sin(a) * s * 0.34]);
        }
        this.drawGlowPoly(ctx, pod, podCol, 1.8, true);
      }
      ctx.restore();
    }
  }

  private renderSurfaceGrid(ctx: CanvasRenderingContext2D): void {
    const horizonY = CY - 26;
    // Glowing horizon line
    this.drawGlowLine(ctx, 20, horizonY, W - 20, horizonY, '#FACC15', 1.6, 0.85);

    // Scrolling horizontal perspective deck lines
    const scroll = (this.elapsed * 0.95) % 1;
    for (let i = 0; i < 9; i++) {
      const z = 0.12 + ((i + (1 - scroll)) / 9) * 0.88;
      const pL = this.project3D(-2.4, 0.62, z);
      const pR = this.project3D(2.4, 0.62, z);
      if (pL.sy > horizonY && pL.sy < H) {
        this.drawGlowLine(ctx, Math.max(0, pL.sx), pL.sy, Math.min(W, pR.sx), pR.sy, '#EF4444', 1.2, 0.55);
      }
    }

    // Converging longitudinal Death Star surface lanes
    for (let gx = -5; gx <= 5; gx++) {
      const pFar = this.project3D(gx * 0.45, 0.62, 1.0);
      const pNear = this.project3D(gx * 0.45, 0.62, 0.12);
      this.drawGlowLine(ctx, pFar.sx, Math.max(horizonY, pFar.sy), pNear.sx, pNear.sy, '#F97316', 1.15, 0.45);
    }
  }

  private renderSurfaceTowers(ctx: CanvasRenderingContext2D): void {
    const sorted = [...this.towers].sort((a, b) => b.z - a.z);
    for (const tw of sorted) {
      const base = this.project3D(tw.wx, 0.62, tw.z);
      const top = this.project3D(tw.wx, 0.62 - tw.height, tw.z);
      const wHalf = Math.max(6, (tw.kind === 'bunker' ? 16 : 11) * base.scale);

      if (tw.kind === 'bunker') {
        // Sloped Armored Surface Bunker
        const col = tw.topAlive ? '#38BDF8' : '#475569';
        this.drawGlowPoly(
          ctx,
          [
            [base.sx - wHalf * 1.3, base.sy],
            [base.sx - wHalf * 0.75, top.sy],
            [base.sx + wHalf * 0.75, top.sy],
            [base.sx + wHalf * 1.3, base.sy],
          ],
          col,
          1.8,
          true
        );
        if (tw.topAlive) {
          this.drawGlowPoly(
            ctx,
            [
              [top.sx - wHalf * 0.4, top.sy],
              [top.sx, top.sy - wHalf * 0.65],
              [top.sx + wHalf * 0.4, top.sy],
            ],
            '#EF4444',
            2.0,
            true
          );
        }
      } else {
        // Iconic 1983 Tall Rectangular Turbolaser Tower + Glowing Pop-Off Crown
        const shaftCol = tw.topAlive ? '#FACC15' : '#64748B';
        this.drawGlowPoly(
          ctx,
          [
            [base.sx - wHalf, base.sy],
            [base.sx - wHalf, top.sy + wHalf * 0.5],
            [base.sx + wHalf, top.sy + wHalf * 0.5],
            [base.sx + wHalf, base.sy],
          ],
          shaftCol,
          1.7,
          true
        );
        // Side perspective edge
        this.drawGlowLine(ctx, base.sx, base.sy, base.sx, top.sy + wHalf * 0.5, shaftCol, 1.1, 0.65);

        if (tw.topAlive) {
          // Glowing shootable top gun turret crown!
          const crownCol = Math.sin(this.elapsed * 10 + tw.id) > 0 ? '#EF4444' : '#FACC15';
          this.drawGlowPoly(
            ctx,
            [
              [top.sx - wHalf * 1.25, top.sy + wHalf * 0.45],
              [top.sx - wHalf * 0.9, top.sy - wHalf * 0.65],
              [top.sx + wHalf * 0.9, top.sy - wHalf * 0.65],
              [top.sx + wHalf * 1.25, top.sy + wHalf * 0.45],
            ],
            crownCol,
            2.1,
            true
          );
        }
      }
    }
  }

  private renderTrench(ctx: CanvasRenderingContext2D): void {
    // 3D Wireframe Trench Walls & Floor Ribs
    const cornersFar = [
      this.project3D(-1.0, -0.78, 1.0),
      this.project3D(1.0, -0.78, 1.0),
      this.project3D(1.0, 0.78, 1.0),
      this.project3D(-1.0, 0.78, 1.0),
    ];
    const cornersNear = [
      this.project3D(-1.0, -0.78, 0.1),
      this.project3D(1.0, -0.78, 0.1),
      this.project3D(1.0, 0.78, 0.1),
      this.project3D(-1.0, 0.78, 0.1),
    ];

    // Longitudinal trench edges
    for (let i = 0; i < 4; i++) {
      this.drawGlowLine(
        ctx,
        cornersFar[i].sx,
        cornersFar[i].sy,
        cornersNear[i].sx,
        cornersNear[i].sy,
        i >= 2 ? '#FACC15' : '#38BDF8',
        1.8,
        0.85
      );
    }

    // Scrolling ribbed wall frames
    const scroll = (this.elapsed * 1.35) % 1;
    for (let i = 0; i < 8; i++) {
      const z = 0.14 + ((i + (1 - scroll)) / 8) * 0.86;
      const tl = this.project3D(-1.0, -0.78, z);
      const tr = this.project3D(1.0, -0.78, z);
      const br = this.project3D(1.0, 0.78, z);
      const bl = this.project3D(-1.0, 0.78, z);
      this.drawGlowPoly(
        ctx,
        [
          [tl.sx, tl.sy],
          [bl.sx, bl.sy],
          [br.sx, br.sy],
          [tr.sx, tr.sy],
        ],
        '#FACC15',
        1.25,
        false,
        0.58
      );
    }

    // Horizontal Catwalk Deflector Beams (show glowing red/orange blocked zones + cyan safe gap arrows)
    const sortedObs = [...this.obstacles].sort((a, b) => b.z - a.z);
    for (const ob of sortedObs) {
      const drawBar = (yTop: number, yBot: number) => {
        const tl = this.project3D(-1.0, yTop, ob.z);
        const tr = this.project3D(1.0, yTop, ob.z);
        const br = this.project3D(1.0, yBot, ob.z);
        const bl = this.project3D(-1.0, yBot, ob.z);
        this.drawGlowPoly(
          ctx,
          [
            [tl.sx, tl.sy],
            [tr.sx, tr.sy],
            [br.sx, br.sy],
            [bl.sx, bl.sy],
          ],
          '#EF4444',
          2.2,
          true,
          0.95
        );
        // Diagonal truss X inside catwalk
        this.drawGlowLine(ctx, tl.sx, tl.sy, br.sx, br.sy, '#F97316', 1.2, 0.65);
        this.drawGlowLine(ctx, tr.sx, tr.sy, bl.sx, bl.sy, '#F97316', 1.2, 0.65);
      };

      if (ob.gap === 'top') {
        drawBar(-0.08, 0.78);
      } else if (ob.gap === 'mid') {
        drawBar(-0.78, -0.26);
        drawBar(0.26, 0.78);
      } else {
        drawBar(-0.78, 0.08);
      }
    }

    // Trench Wall Turbolaser Turrets
    for (const tr of this.trenchTurrets) {
      if (!tr.alive) continue;
      const p = this.project3D(tr.side * 0.92, tr.wy, tr.z);
      const r = Math.max(6, 11 * p.scale);
      this.drawGlowPoly(
        ctx,
        [
          [p.sx - r, p.sy - r * 0.6],
          [p.sx + r, p.sy - r * 0.6],
          [p.sx + r, p.sy + r * 0.6],
          [p.sx - r, p.sy + r * 0.6],
        ],
        '#F97316',
        1.8,
        true
      );
    }

    // Iconic Thermal Exhaust Port!
    if (this.exhaustPortOpen) {
      const ep = this.project3D(0, 0.22, this.exhaustPortZ);
      const r = Math.max(16, 28 * ep.scale);
      const pulse = 1 + Math.sin(this.elapsed * 16) * 0.14;
      const col = Math.sin(this.elapsed * 14) > 0 ? '#EF4444' : '#FACC15';
      this.drawGlowPoly(
        ctx,
        [
          [ep.sx - r * pulse, ep.sy - r * 0.75 * pulse],
          [ep.sx + r * pulse, ep.sy - r * 0.75 * pulse],
          [ep.sx + r * pulse, ep.sy + r * 0.75 * pulse],
          [ep.sx - r * pulse, ep.sy + r * 0.75 * pulse],
        ],
        col,
        2.6,
        true
      );
      this.drawGlowPoly(
        ctx,
        [
          [ep.sx, ep.sy - r * 0.52],
          [ep.sx + r * 0.52, ep.sy],
          [ep.sx, ep.sy + r * 0.52],
          [ep.sx - r * 0.52, ep.sy],
        ],
        '#FFFFFF',
        2.0,
        true
      );
      ctx.font = '800 12px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FACC15';
      ctx.fillText('EXHAUST PORT — SHOOT!', ep.sx, ep.sy - r - 10);
    }
  }

  private renderFireballs(ctx: CanvasRenderingContext2D): void {
    for (const fb of this.fireballs) {
      const p = this.project3D(fb.wx, fb.wy, fb.z);
      const r = Math.max(7, 13 * p.scale);
      // Iconic Atari 1983 spinning vector starburst fireball!
      const pts: Array<[number, number]> = [];
      for (let i = 0; i < 8; i++) {
        const a = fb.spin + (Math.PI * 2 * i) / 8;
        const rad = i % 2 === 0 ? r : r * 0.42;
        pts.push([p.sx + Math.cos(a) * rad, p.sy + Math.sin(a) * rad]);
      }
      this.drawGlowPoly(ctx, pts, fb.color, 2.0, true);
      this.drawGlowLine(ctx, p.sx - r * 0.5, p.sy, p.sx + r * 0.5, p.sy, '#FFFFFF', 1.4);
    }
  }

  private renderVectorExplosions(ctx: CanvasRenderingContext2D): void {
    for (const r of this.rings) {
      const alpha = Math.max(0, r.life / r.maxLife);
      const pts: Array<[number, number]> = [];
      for (let i = 0; i < r.sides; i++) {
        const a = r.rot + (Math.PI * 2 * i) / r.sides;
        pts.push([r.x + Math.cos(a) * r.radius, r.y + Math.sin(a) * r.radius]);
      }
      this.drawGlowPoly(ctx, pts, r.color, 2.1, true, alpha);
    }
    for (const s of this.shards) {
      const alpha = Math.max(0, s.life / s.maxLife);
      const dx = Math.cos(s.angle) * s.len * 0.5;
      const dy = Math.sin(s.angle) * s.len * 0.5;
      this.drawGlowLine(ctx, s.x - dx, s.y - dy, s.x + dx, s.y + dy, s.color, 1.8, alpha);
    }
  }

  private renderXWingCockpit(ctx: CanvasRenderingContext2D): void {
    // Classic 1983 X-Wing cockpit canopy struts & quad cannon corner mounts
    const col = '#38BDF8';
    this.drawGlowLine(ctx, 0, 128, 52, 54, col, 1.8, 0.55);
    this.drawGlowLine(ctx, W, 128, W - 52, 54, col, 1.8, 0.55);
    this.drawGlowLine(ctx, 0, H - 96, 68, H - 36, '#FACC15', 1.8, 0.6);
    this.drawGlowLine(ctx, W, H - 96, W - 68, H - 36, '#FACC15', 1.8, 0.6);
    this.drawGlowLine(ctx, 68, H - 36, W - 68, H - 36, '#FACC15', 1.4, 0.45);
  }

  private renderReticle(ctx: CanvasRenderingContext2D): void {
    const x = this.aimX;
    const y = this.aimY;
    const col = this.exhaustPortOpen ? '#EF4444' : '#FACC15';
    const r = 17;
    this.drawGlowPoly(
      ctx,
      [
        [x - r, y - 6],
        [x - r, y - r],
        [x - 6, y - r],
      ],
      col,
      2.0,
      false
    );
    this.drawGlowPoly(
      ctx,
      [
        [x + 6, y - r],
        [x + r, y - r],
        [x + r, y - 6],
      ],
      col,
      2.0,
      false
    );
    this.drawGlowPoly(
      ctx,
      [
        [x + r, y + 6],
        [x + r, y + r],
        [x + 6, y + r],
      ],
      col,
      2.0,
      false
    );
    this.drawGlowPoly(
      ctx,
      [
        [x - 6, y + r],
        [x - r, y + r],
        [x - r, y + 6],
      ],
      col,
      2.0,
      false
    );
    this.drawGlowLine(ctx, x - 6, y, x + 6, y, '#4ADE80', 1.6);
    this.drawGlowLine(ctx, x, y - 6, x, y + 6, '#4ADE80', 1.6);
  }

  private renderVectorHud(ctx: CanvasRenderingContext2D): void {
    // Top Atari 1983 Vector Shield Bar & Wave Readout
    ctx.fillStyle = 'rgba(2, 6, 18, 0.76)';
    ctx.fillRect(0, 0, W, 44);
    this.drawGlowLine(ctx, 0, 44, W, 44, '#FACC15', 1.3, 0.7);

    ctx.font = '800 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FACC15';
    ctx.fillText(`SHIELDS`, 16, 26);

    for (let i = 0; i < this.maxShields; i++) {
      const bx = 82 + i * 20;
      const active = i < this.shields;
      ctx.strokeStyle = active ? (this.shields <= 2 ? '#EF4444' : '#4ADE80') : '#334155';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(bx, 13, 14, 16);
      if (active) {
        ctx.fillStyle = this.shields <= 2 ? 'rgba(239,68,68,0.65)' : 'rgba(74,222,128,0.55)';
        ctx.fillRect(bx + 2, 15, 10, 12);
      }
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#38BDF8';
    const phaseLabel =
      this.subStage === 0
        ? 'PHASE 1: TIE DOGFIGHT'
        : this.subStage === 1
          ? 'PHASE 2: DEATH STAR SURFACE'
          : 'PHASE 3: TRENCH RUN';
    ctx.fillText(phaseLabel, CX + 25, 26);

    ctx.textAlign = 'right';
    ctx.fillStyle = this.torpedoCharge >= 0.99 ? '#38BDF8' : '#94A3B8';
    ctx.fillText(
      this.torpedoCharge >= 0.99 ? 'TORPEDO [SHIFT] READY' : `TORPEDO ${Math.round(this.torpedoCharge * 100)}%`,
      W - 16,
      26
    );
  }

  private renderTitleOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '900 42px "JetBrains Mono", monospace';
    ctx.fillStyle = '#FACC15';
    ctx.fillText('STAR WARS', CX, CY - 118);
    ctx.font = '700 14px "JetBrains Mono", monospace';
    ctx.fillStyle = '#38BDF8';
    ctx.fillText('1983 ATARI QUADRASCAN 3D COLOR VECTOR EDITION', CX, CY - 88);

    ctx.font = '700 13px "JetBrains Mono", monospace';
    ctx.fillStyle = '#4ADE80';
    ctx.fillText('PHASE 1: TIE FIGHTERS & VADER  ·  PHASE 2: TOWERS  ·  PHASE 3: TRENCH RUN', CX, H - 96);
    ctx.fillStyle = '#E2E8F0';
    ctx.fillText('AIM: MOUSE / ARROWS / JOYSTICK   ·   FIRE: CLICK / SPACE   ·   TORPEDO: SHIFT', CX, H - 70);
    ctx.restore();
  }
}

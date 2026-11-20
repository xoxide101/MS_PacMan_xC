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
 * STAR WARS: THE EMPIRE STRIKES BACK (1985 — Atari Color Vector / Quadrascan Evolved Engine)
 * Distinct icy Hoth blue/cyan/glacial-white/amber color-vector palette & storyline:
 *  Phase 1: Hoth Ice Plains — Snowspeeder vs. Viper Probe Droids & Articulated 3D Wireframe AT-AT Imperial Walkers
 *           (Supports flashing Neck Weakpoint sniping AND authentic Harpoon Tow-Cable leg-wrapping takedowns!)
 *  Phase 2: Hoth Orbit Evacuation — Imperial Star Destroyer, Twin-Pod TIE Bombers (drifting proximity mines!)
 *           & Dagger-Winged TIE Interceptors
 *  Phase 3: Asteroid Field Escape — Tumbling 3D Polyhedral Wireframe Asteroids splitting into polygon shards,
 *           diving TIE Interceptors, and J-E-D-I Force Bonus Pods!
 *  Phase 4: Star Destroyer Bridge & Twin Shield Domes Finale!
 */

const W = 760;
const H = 560;
const CX = W * 0.5;
const CY = H * 0.48;
const HS_KEY = 'starwarsesb_hd_highscore_v1';

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

interface ProbeDroid {
  id: number;
  wx: number;
  wy: number;
  z: number;
  vx: number;
  bobPhase: number;
  transmitTimer: number;
  hp: number;
}

interface AtAtWalker {
  id: number;
  wx: number;
  z: number;
  vx: number;
  vz: number;
  stridePhase: number;
  stompToggle: boolean;
  hp: number;
  maxHp: number;
  cableWraps: number; // 0..3 -> 3 wraps topples AT-AT!
  toppleProgress: number; // 0 = standing, >0..1 = falling collapse animation
  toppleDir: -1 | 1;
  fireCd: number;
  hitFlash: number;
}

interface SpaceEnemy {
  id: number;
  kind: 'interceptor' | 'bomber' | 'mine';
  wx: number;
  wy: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  roll: number;
  fireCd: number;
  hp: number;
}

interface PolyAsteroid {
  id: number;
  wx: number;
  wy: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rot: number;
  vRot: number;
  size: number;
  hp: number;
  verts: Array<[number, number]>;
}

interface JediPod {
  id: number;
  letter: 'J' | 'E' | 'D' | 'I';
  wx: number;
  wy: number;
  z: number;
  vx: number;
}

interface EnemyBolt {
  wx: number;
  wy: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  color: string;
}

interface BridgeDome {
  side: -1 | 1;
  hp: number;
  maxHp: number;
  hitFlash: number;
}

export class StarWarsEsbGame implements ArcadeGameInstance {
  public readonly logicalWidth = W;
  public readonly logicalHeight = H;
  public readonly supportsPointerAim = true;
  public readonly primaryActionLabel = 'BLASTER';
  public readonly secondaryActionLabel = 'TOW CABLE';

  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();
  private score = 0;
  private highScore = readHighScore(HS_KEY);
  private wave = 1;
  private shields = 6;
  private readonly maxShields = 8;

  // 0: Hoth Ice Plains (Probes + AT-ATs), 1: Hoth Orbit (Bombers + Interceptors), 2: Asteroid Field (JEDI), 3: Star Destroyer Bridge Domes
  private subStage: 0 | 1 | 2 | 3 = 0;
  private stageProgress = 0;
  private stageTarget = 8;

  private aimX = CX;
  private aimY = CY;
  private fireCd = 0;
  private towCableCd = 0;
  private activeCableFlash = 0;
  private activeCableTarget: { x: number; y: number } | null = null;

  private jediCollected: boolean[] = [false, false, false, false];
  private jediForceTimer = 0;

  private hitFlash = 0;
  private shakeTimer = 0;
  private phaseTimer = 0;
  private elapsed = 0;
  private bannerText = 'EMPIRE STRIKES BACK (1985) — DEFEND ECHO BASE ON HOTH';

  private nextId = 1;
  private spawnCd = 0.5;
  private jediPodCd = 4.2;

  private stars: VectorStar[] = [];
  private lasers: VectorLaser[] = [];
  private shards: VectorShard[] = [];
  private rings: VectorShockRing[] = [];
  private popups: ScorePopup[] = [];

  private probes: ProbeDroid[] = [];
  private walkers: AtAtWalker[] = [];
  private spaceEnemies: SpaceEnemy[] = [];
  private asteroids: PolyAsteroid[] = [];
  private jediPods: JediPod[] = [];
  private enemyBolts: EnemyBolt[] = [];
  private bridgeDomes: BridgeDome[] = [];

  constructor() {
    this.initStars();
  }

  private initStars(): void {
    this.stars = [];
    for (let i = 0; i < 85; i++) {
      this.stars.push({
        x: (Math.random() - 0.5) * 2.5,
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
    this.jediCollected = [false, false, false, false];
    this.jediForceTimer = 0;
    this.setupSubStage(0);
    this.phase = 'READY';
    this.phaseTimer = 1.15;
    this.bannerText = 'WAVE 1 — BATTLE OF HOTH: INTERCEPT PROBES & AT-AT WALKERS';
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.probes = [];
    this.walkers = [];
    this.spaceEnemies = [];
    this.asteroids = [];
    this.jediPods = [];
    this.enemyBolts = [];
    this.lasers = [];
    this.shards = [];
    this.rings = [];
    this.popups = [];
    this.bannerText = 'EMPIRE STRIKES BACK (1985) — HOTH VECTOR EDITION';
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public getHudSnapshot(): ClassicGameHud {
    const names = [
      `W${this.wave} · HOTH AT-AT ASSAULT`,
      `W${this.wave} · HOTH ORBIT ESCAPE`,
      `W${this.wave} · ASTEROID FIELD`,
      `W${this.wave} · STAR DESTROYER BRIDGE`,
    ];
    const jediStr = ['J', 'E', 'D', 'I'].map((ch, idx) => (this.jediCollected[idx] ? ch : '·')).join('');
    let pLabel = 'WALKERS';
    let pVal = `${this.stageProgress}/${this.stageTarget}`;
    if (this.subStage === 1) pLabel = 'IMPERIALS';
    else if (this.subStage === 2) pLabel = 'ASTEROIDS';
    else if (this.subStage === 3) {
      pLabel = 'DOMES';
      const alive = this.bridgeDomes.filter((d) => d.hp > 0).length;
      pVal = `${2 - alive}/2`;
    }
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.wave,
      lives: this.shields,
      stageName: names[this.subStage],
      primaryMetricLabel: pLabel,
      primaryMetricValue: pVal,
      secondaryMetricLabel: this.jediForceTimer > 0 ? 'JEDI 2X' : 'J-E-D-I',
      secondaryMetricValue: this.jediForceTimer > 0 ? `${Math.ceil(this.jediForceTimer)}S` : jediStr,
      bannerText: this.bannerText,
    };
  }

  private addScore(pts: number, x?: number, y?: number, color = '#38BDF8', label?: string): void {
    const finalPts = this.jediForceTimer > 0 ? pts * 2 : pts;
    this.score += finalPts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(HS_KEY, this.highScore);
    }
    if (x !== undefined && y !== undefined) {
      this.popups.push({
        x,
        y,
        text: label ?? `+${finalPts}`,
        color,
        life: 0.95,
        maxLife: 0.95,
      });
    }
  }

  private setupSubStage(stage: 0 | 1 | 2 | 3): void {
    this.subStage = stage;
    this.stageProgress = 0;
    this.probes = [];
    this.walkers = [];
    this.spaceEnemies = [];
    this.asteroids = [];
    this.jediPods = [];
    this.enemyBolts = [];
    this.spawnCd = 0.4;
    this.activeCableTarget = null;

    if (stage === 0) {
      this.stageTarget = 5 + this.wave * 2;
      this.bannerText = 'HOTH PLAINS: DESTROY PROBE DROIDS & TRIP AT-AT WALKERS [SHIFT = TOW CABLE]';
      // Spawn initial Probe Droid scout + first giant AT-AT on horizon
      this.spawnProbeDroid();
      this.spawnAtAtWalker(0.95);
    } else if (stage === 1) {
      this.stageTarget = 9 + this.wave * 3;
      this.bannerText = 'HOTH ORBIT: INTERCEPT TIE BOMBER MINES & TIE INTERCEPTORS!';
    } else if (stage === 2) {
      this.stageTarget = 12 + this.wave * 3;
      this.jediPodCd = 2.6;
      this.bannerText = 'ASTEROID FIELD: SHATTER ROCKS & SPELL J-E-D-I FOR FORCE SHIELD!';
    } else {
      this.stageTarget = 2;
      this.bridgeDomes = [
        { side: -1, hp: 6 + this.wave * 2, maxHp: 6 + this.wave * 2, hitFlash: 0 },
        { side: 1, hp: 6 + this.wave * 2, maxHp: 6 + this.wave * 2, hitFlash: 0 },
      ];
      this.bannerText = 'STAR DESTROYER ASSAULT: DESTROY BOTH BRIDGE SHIELD DOMES!';
    }
  }

  private spawnVectorExplosion(x: number, y: number, primary: string, secondary: string, heavy = false): void {
    const count = heavy ? 30 : 14;
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const spd = (heavy ? 175 : 115) + Math.random() * (heavy ? 240 : 140);
      const maxLife = (heavy ? 0.72 : 0.4) + Math.random() * 0.25;
      this.shards.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        angle: Math.random() * Math.PI * 2,
        vAngle: (Math.random() - 0.5) * 14,
        len: (heavy ? 18 : 11) + Math.random() * (heavy ? 18 : 10),
        color: i % 3 === 0 ? '#FFFFFF' : i % 2 === 0 ? primary : secondary,
        life: maxLife,
        maxLife,
      });
    }
    this.rings.push({
      x,
      y,
      radius: 6,
      maxRadius: heavy ? 128 : 54,
      sides: heavy ? 8 : 6,
      color: primary,
      rot: Math.random() * Math.PI,
      life: heavy ? 0.6 : 0.34,
      maxLife: heavy ? 0.6 : 0.34,
    });
    if (heavy) this.shakeTimer = Math.max(this.shakeTimer, 0.28);
  }

  private takeShieldHit(reason: string): void {
    if (this.jediForceTimer > 0) {
      this.popups.push({
        x: CX,
        y: CY - 30,
        text: 'FORCE DEFLECTED!',
        color: '#38BDF8',
        life: 0.75,
        maxLife: 0.75,
      });
      return;
    }
    if (this.hitFlash > 0.1) return;
    this.shields -= 1;
    this.hitFlash = 0.42;
    this.shakeTimer = 0.28;
    arcadeAudio.playVectorExplosion(true);
    this.bannerText = this.shields <= 2 ? `CRITICAL SHIELDS (${this.shields}) — ${reason}!` : `SHIELD HIT — ${reason}!`;
    if (this.shields <= 0) {
      this.phase = 'GAME_OVER';
      this.bannerText = 'ROGUE SQUADRON LOST — PRESS PLAY TO DEFEND HOTH AGAIN';
      arcadeAudio.playDeath();
    }
  }

  private project3D(wx: number, wy: number, z: number): { sx: number; sy: number; scale: number } {
    const safeZ = Math.max(0.06, z);
    const scale = 1 / safeZ;
    const camX = (this.aimX - CX) * 0.08;
    const camY = (this.aimY - CY) * 0.06;
    return {
      sx: CX + wx * 175 * scale - camX,
      sy: CY + wy * 145 * scale - camY,
      scale,
    };
  }

  public step(dt: number): void {
    const safeDt = Math.min(0.05, dt);
    this.elapsed += safeDt;

    for (const s of this.stars) {
      s.z -= safeDt * (this.subStage === 0 ? 0.16 : 0.52);
      if (s.z <= 0.02) {
        s.x = (Math.random() - 0.5) * 2.5;
        s.y = (Math.random() - 0.5) * 1.8;
        s.z = 1;
      }
    }

    this.stepEffects(safeDt);
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - safeDt);
    if (this.shakeTimer > 0) this.shakeTimer = Math.max(0, this.shakeTimer - safeDt);
    if (this.activeCableFlash > 0) this.activeCableFlash = Math.max(0, this.activeCableFlash - safeDt);
    if (this.jediForceTimer > 0) this.jediForceTimer = Math.max(0, this.jediForceTimer - safeDt);

    if (this.phase === 'TITLE' || this.phase === 'PAUSED' || this.phase === 'GAME_OVER') return;

    if (this.phase === 'READY') {
      this.phaseTimer -= safeDt;
      if (this.phaseTimer <= 0) this.phase = 'PLAYING';
      return;
    }

    if (this.phase === 'STAGE_CLEAR') {
      this.phaseTimer -= safeDt;
      if (this.phaseTimer <= 0) {
        this.wave += 1;
        this.shields = Math.min(this.maxShields, this.shields + 1);
        this.setupSubStage(0);
        this.phase = 'READY';
        this.phaseTimer = 1.2;
      }
      return;
    }

    // Aiming (Pointer + Keyboard / Virtual Joystick)
    const moveSpd = 435;
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

    this.aimX = Math.max(44, Math.min(W - 44, this.aimX));
    this.aimY = Math.max(66, Math.min(H - 60, this.aimY));

    if (this.fireCd > 0) this.fireCd -= safeDt;
    if (this.towCableCd > 0) this.towCableCd -= safeDt;

    if ((this.input.fire || this.input.fireJustPressed) && this.fireCd <= 0) {
      this.fireBlasters();
    }
    if ((this.input.secondaryJustPressed || this.input.secondary) && this.towCableCd <= 0) {
      this.fireTowCableOrPulse();
    }

    if (this.subStage === 0) this.stepHothPlains(safeDt);
    else if (this.subStage === 1) this.stepHothOrbit(safeDt);
    else if (this.subStage === 2) this.stepAsteroidField(safeDt);
    else this.stepStarDestroyerBridge(safeDt);
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
      r.rot += dt * 2.2;
      if (r.life <= 0) this.rings.splice(i, 1);
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.y -= 30 * dt;
      p.life -= dt;
      if (p.life <= 0) this.popups.splice(i, 1);
    }
  }

  private fireBlasters(): void {
    this.fireCd = 0.12;
    arcadeAudio.playXWingQuadLaser(false);
    const col = this.subStage === 0 ? '#F87171' : '#38BDF8';
    // Dual forward Snowspeeder / Falcon twin cannons
    const origins: Array<[number, number]> = [
      [110, H - 46],
      [W - 110, H - 46],
    ];
    for (const [ox, oy] of origins) {
      this.lasers.push({
        x0: ox,
        y0: oy,
        x1: this.aimX,
        y1: this.aimY,
        color: col,
        life: 0.095,
        maxLife: 0.095,
      });
    }

    const hitR = 44;

    // Shoot down incoming enemy bolts
    for (let i = this.enemyBolts.length - 1; i >= 0; i--) {
      const eb = this.enemyBolts[i];
      const p = this.project3D(eb.wx, eb.wy, eb.z);
      if (Math.hypot(p.sx - this.aimX, p.sy - this.aimY) <= Math.max(18, 12 * p.scale) + hitR * 0.55) {
        this.enemyBolts.splice(i, 1);
        this.addScore(50, p.sx, p.sy, '#FACC15', '+50');
        this.spawnVectorExplosion(p.sx, p.sy, '#38BDF8', '#FFFFFF', false);
      }
    }

    // Phase 1: Viper Probe Droids & AT-AT Neck Weakpoints
    if (this.subStage === 0) {
      for (let i = this.probes.length - 1; i >= 0; i--) {
        const pr = this.probes[i];
        const p = this.project3D(pr.wx, pr.wy, pr.z);
        if (Math.hypot(p.sx - this.aimX, p.sy - this.aimY) <= Math.max(24, 18 * p.scale) + hitR * 0.65) {
          pr.hp -= 1;
          if (pr.hp <= 0) {
            this.probes.splice(i, 1);
            this.stageProgress += 1;
            arcadeAudio.playVectorExplosion(false);
            this.addScore(500, p.sx, p.sy, '#38BDF8', 'PROBE STOPPED +500');
            this.spawnVectorExplosion(p.sx, p.sy, '#38BDF8', '#FACC15', false);
          }
          return;
        }
      }

      for (const w of this.walkers) {
        if (w.toppleProgress > 0) continue;
        // Flashing Neck/Head Weakpoint sits above torso
        const neck = this.project3D(w.wx - 0.14, 0.08, w.z);
        const body = this.project3D(w.wx, 0.24, w.z);
        const neckR = Math.max(20, 15 * neck.scale) + hitR * 0.55;
        const bodyR = Math.max(30, 26 * body.scale) + hitR * 0.45;
        if (Math.hypot(neck.sx - this.aimX, neck.sy - this.aimY) <= neckR) {
          w.hp -= 2;
          w.hitFlash = 0.2;
          arcadeAudio.playVectorExplosion(false);
          this.spawnVectorExplosion(neck.sx, neck.sy, '#EF4444', '#FACC15', false);
          if (w.hp <= 0) {
            w.toppleProgress = 0.01;
            w.toppleDir = Math.random() < 0.5 ? -1 : 1;
            this.stageProgress += 1;
            arcadeAudio.playVectorExplosion(true);
            this.addScore(1200, neck.sx, neck.sy - 14, '#FACC15', 'AT-AT DESTROYED +1200');
            this.spawnVectorExplosion(body.sx, body.sy, '#FACC15', '#38BDF8', true);
          } else {
            this.addScore(150, neck.sx, neck.sy, '#F87171', 'NECK HIT!');
          }
          return;
        } else if (Math.hypot(body.sx - this.aimX, body.sy - this.aimY) <= bodyR) {
          // Armored hull deflects standard shots with sparks (authentic ESB detail!)
          w.hp -= 0.4;
          w.hitFlash = 0.12;
          this.popups.push({
            x: body.sx,
            y: body.sy - 14,
            text: 'ARMOR! AIM NECK OR [SHIFT] CABLE',
            color: '#94A3B8',
            life: 0.65,
            maxLife: 0.65,
          });
          return;
        }
      }
    }

    // Phase 2: TIE Bombers, Proximity Mines & TIE Interceptors
    if (this.subStage === 1) {
      for (let i = this.spaceEnemies.length - 1; i >= 0; i--) {
        const e = this.spaceEnemies[i];
        const p = this.project3D(e.wx, e.wy, e.z);
        const r = Math.max(22, (e.kind === 'mine' ? 14 : 20) * p.scale) + hitR * 0.65;
        if (Math.hypot(p.sx - this.aimX, p.sy - this.aimY) <= r) {
          e.hp -= 1;
          if (e.hp <= 0) {
            this.spaceEnemies.splice(i, 1);
            arcadeAudio.playVectorExplosion(e.kind === 'bomber');
            if (e.kind === 'mine') {
              this.addScore(250, p.sx, p.sy, '#FACC15', 'MINE +250');
            } else {
              this.stageProgress += 1;
              const pts = e.kind === 'bomber' ? 800 : 1000;
              this.addScore(pts, p.sx, p.sy, '#38BDF8', e.kind === 'bomber' ? 'BOMBER +800' : 'INTERCEPTOR +1000');
            }
            this.spawnVectorExplosion(p.sx, p.sy, e.kind === 'bomber' ? '#F97316' : '#38BDF8', '#FACC15', e.kind === 'bomber');
          }
          return;
        }
      }
    }

    // Phase 3: Polyhedral Asteroids, Diving Interceptors & J-E-D-I Pods
    if (this.subStage === 2) {
      for (let i = this.jediPods.length - 1; i >= 0; i--) {
        const pod = this.jediPods[i];
        const p = this.project3D(pod.wx, pod.wy, pod.z);
        if (Math.hypot(p.sx - this.aimX, p.sy - this.aimY) <= Math.max(24, 18 * p.scale) + hitR * 0.7) {
          this.collectJediLetter(pod.letter, p.sx, p.sy);
          this.jediPods.splice(i, 1);
          return;
        }
      }

      for (let i = this.asteroids.length - 1; i >= 0; i--) {
        const ast = this.asteroids[i];
        const p = this.project3D(ast.wx, ast.wy, ast.z);
        const r = Math.max(24, ast.size * 16 * p.scale) + hitR * 0.65;
        if (Math.hypot(p.sx - this.aimX, p.sy - this.aimY) <= r) {
          ast.hp -= 1;
          arcadeAudio.playVectorExplosion(false);
          this.spawnVectorExplosion(p.sx, p.sy, '#CBD5E1', '#38BDF8', false);
          if (ast.hp <= 0) {
            this.asteroids.splice(i, 1);
            this.stageProgress += 1;
            this.addScore(400, p.sx, p.sy, '#E2E8F0', '+400');
          }
          return;
        }
      }

      for (let i = this.spaceEnemies.length - 1; i >= 0; i--) {
        const e = this.spaceEnemies[i];
        const p = this.project3D(e.wx, e.wy, e.z);
        if (Math.hypot(p.sx - this.aimX, p.sy - this.aimY) <= Math.max(22, 18 * p.scale) + hitR * 0.65) {
          this.spaceEnemies.splice(i, 1);
          this.stageProgress += 1;
          arcadeAudio.playVectorExplosion(false);
          this.addScore(1000, p.sx, p.sy, '#38BDF8', 'INTERCEPTOR +1000');
          this.spawnVectorExplosion(p.sx, p.sy, '#38BDF8', '#FACC15', false);
          return;
        }
      }
    }

    // Phase 4: Star Destroyer Twin Bridge Shield Domes & Escort Interceptors
    if (this.subStage === 3) {
      for (const dome of this.bridgeDomes) {
        if (dome.hp <= 0) continue;
        const p = this.project3D(dome.side * 0.44, -0.26, 0.54);
        if (Math.hypot(p.sx - this.aimX, p.sy - this.aimY) <= 56) {
          dome.hp -= 1;
          dome.hitFlash = 0.18;
          arcadeAudio.playVectorExplosion(dome.hp <= 0);
          this.spawnVectorExplosion(p.sx, p.sy, '#38BDF8', '#FACC15', dome.hp <= 0);
          this.addScore(dome.hp <= 0 ? 2500 : 200, p.sx, p.sy, '#FACC15', dome.hp <= 0 ? 'SHIELD DOME BLOWN +2500!' : 'DOME HIT');
          if (this.bridgeDomes.every((d) => d.hp <= 0)) {
            this.triggerStarDestroyerVictory();
          }
          return;
        }
      }
      for (let i = this.spaceEnemies.length - 1; i >= 0; i--) {
        const e = this.spaceEnemies[i];
        const p = this.project3D(e.wx, e.wy, e.z);
        if (Math.hypot(p.sx - this.aimX, p.sy - this.aimY) <= Math.max(22, 18 * p.scale) + hitR * 0.65) {
          this.spaceEnemies.splice(i, 1);
          arcadeAudio.playVectorExplosion(false);
          this.addScore(1000, p.sx, p.sy, '#38BDF8', '+1000');
          this.spawnVectorExplosion(p.sx, p.sy, '#38BDF8', '#FACC15', false);
          return;
        }
      }
    }
  }

  private fireTowCableOrPulse(): void {
    this.towCableCd = 0.38;
    if (this.subStage === 0) {
      // Authentic Harpoon Tow Cable aimed at AT-AT Walker legs!
      let best: AtAtWalker | null = null;
      let bestDist = 145;
      for (const w of this.walkers) {
        if (w.toppleProgress > 0) continue;
        const legs = this.project3D(w.wx, 0.44, w.z);
        const d = Math.hypot(legs.sx - this.aimX, legs.sy - this.aimY);
        if (d < bestDist) {
          bestDist = d;
          best = w;
        }
      }
      if (best) {
        const legs = this.project3D(best.wx, 0.44, best.z);
        best.cableWraps += 1;
        this.activeCableFlash = 0.34;
        this.activeCableTarget = { x: legs.sx, y: legs.sy };
        arcadeAudio.playTowCableWrap(best.cableWraps);
        if (best.cableWraps >= 3) {
          best.toppleProgress = 0.01;
          best.toppleDir = Math.random() < 0.5 ? -1 : 1;
          this.stageProgress += 1;
          arcadeAudio.playVectorExplosion(true);
          this.addScore(1500, legs.sx, legs.sy - 32, '#FACC15', 'TOW-CABLE TOPPLE +1500!');
          this.spawnVectorExplosion(legs.sx, legs.sy - 18, '#FACC15', '#38BDF8', true);
          this.bannerText = 'AT-AT WALKER TOPPLED BY HARPOON TOW CABLE! +1500';
        } else {
          this.addScore(250, legs.sx, legs.sy - 18, '#FACC15', `CABLE WRAP ${best.cableWraps}/3`);
          this.bannerText = `HARPOON LOCKED! WRAP ${best.cableWraps}/3 — KEEP CIRCLING!`;
        }
      } else {
        // Fired cable into empty air
        this.activeCableFlash = 0.16;
        this.activeCableTarget = { x: this.aimX, y: this.aimY };
        arcadeAudio.playTowCableWrap(1);
      }
    } else {
      // In space phases, Secondary fires a wide Ion EMP Pulse that clears enemy bolts/mines
      arcadeAudio.playXWingQuadLaser(true);
      this.rings.push({
        x: this.aimX,
        y: this.aimY,
        radius: 10,
        maxRadius: 110,
        sides: 8,
        color: '#38BDF8',
        rot: 0,
        life: 0.36,
        maxLife: 0.36,
      });
      for (let i = this.enemyBolts.length - 1; i >= 0; i--) {
        const p = this.project3D(this.enemyBolts[i].wx, this.enemyBolts[i].wy, this.enemyBolts[i].z);
        if (Math.hypot(p.sx - this.aimX, p.sy - this.aimY) < 115) {
          this.enemyBolts.splice(i, 1);
          this.addScore(50, p.sx, p.sy, '#38BDF8', '+50');
        }
      }
    }
  }

  private collectJediLetter(letter: 'J' | 'E' | 'D' | 'I', x: number, y: number): void {
    const idx = ['J', 'E', 'D', 'I'].indexOf(letter);
    if (idx >= 0) this.jediCollected[idx] = true;
    arcadeAudio.playPowerUp();
    this.addScore(500, x, y, '#FACC15', `FORCE LETTER "${letter}" +500`);
    if (this.jediCollected.every(Boolean)) {
      this.jediCollected = [false, false, false, false];
      this.jediForceTimer = 11.0;
      this.shields = Math.min(this.maxShields, this.shields + 1);
      this.addScore(3000, CX, CY - 40, '#38BDF8', 'J-E-D-I COMPLETE! FORCE SHIELD + 2X!');
      this.bannerText = 'J-E-D-I MASTERED — INVULNERABILITY + 2X SCORE!';
    }
  }

  private triggerStarDestroyerVictory(): void {
    const bonus = 8000 + this.wave * 4000;
    this.addScore(bonus, CX, CY - 24, '#38BDF8', `HYPERSPACE ESCAPE +${bonus}!`);
    arcadeAudio.playDeathStarSupernova();
    this.spawnVectorExplosion(CX - 90, CY - 40, '#38BDF8', '#FACC15', true);
    this.spawnVectorExplosion(CX + 90, CY - 40, '#FACC15', '#FFFFFF', true);
    this.phase = 'STAGE_CLEAR';
    this.phaseTimer = 2.6;
    this.bannerText = 'STAR DESTROYER DISABLED — JUMPING TO HYPERSPACE!';
  }

  private spawnProbeDroid(): void {
    this.probes.push({
      id: this.nextId++,
      wx: (Math.random() - 0.5) * 1.4,
      wy: -0.25 + (Math.random() - 0.5) * 0.35,
      z: 0.95,
      vx: (Math.random() < 0.5 ? -1 : 1) * (0.28 + Math.random() * 0.2),
      bobPhase: Math.random() * Math.PI * 2,
      transmitTimer: 6.5,
      hp: 1,
    });
  }

  private spawnAtAtWalker(zStart = 1.0): void {
    const maxHp = 4 + Math.min(4, this.wave);
    this.walkers.push({
      id: this.nextId++,
      wx: (Math.random() - 0.5) * 1.35,
      z: zStart,
      vx: (Math.random() - 0.5) * 0.14,
      vz: 0.085 + this.wave * 0.012,
      stridePhase: Math.random() * Math.PI * 2,
      stompToggle: false,
      hp: maxHp,
      maxHp,
      cableWraps: 0,
      toppleProgress: 0,
      toppleDir: 1,
      fireCd: 1.4 + Math.random() * 1.0,
      hitFlash: 0,
    });
  }

  private stepHothPlains(dt: number): void {
    this.spawnCd -= dt;
    if (this.spawnCd <= 0) {
      this.spawnCd = Math.max(1.2, 2.3 - this.wave * 0.14);
      if (this.probes.length < 2 && Math.random() < 0.42) {
        this.spawnProbeDroid();
      } else if (this.walkers.filter((w) => w.toppleProgress === 0).length < 2 + Math.min(2, Math.floor(this.wave / 2))) {
        this.spawnAtAtWalker(1.0);
      }
    }

    // Update Viper Probe Droids
    for (let i = this.probes.length - 1; i >= 0; i--) {
      const pr = this.probes[i];
      pr.bobPhase += dt * 4.2;
      pr.wx += pr.vx * dt;
      pr.z = Math.max(0.28, pr.z - dt * 0.12);
      if (Math.abs(pr.wx) > 1.2) pr.vx = -pr.vx;
      pr.transmitTimer -= dt;
      if (pr.transmitTimer <= 0) {
        this.probes.splice(i, 1);
        this.bannerText = 'PROBE TRANSMITTED COORDINATES — AT-AT REINFORCEMENTS!';
        this.spawnAtAtWalker(0.88);
      }
    }

    // Update Articulated AT-AT Walkers
    for (let i = this.walkers.length - 1; i >= 0; i--) {
      const w = this.walkers[i];
      if (w.hitFlash > 0) w.hitFlash -= dt;
      if (w.toppleProgress > 0) {
        w.toppleProgress += dt * 1.35;
        if (w.toppleProgress >= 1) {
          const p = this.project3D(w.wx, 0.32, w.z);
          this.spawnVectorExplosion(p.sx, p.sy, '#38BDF8', '#FACC15', true);
          this.walkers.splice(i, 1);
        }
        continue;
      }

      const slowFactor = Math.max(0.25, 1 - w.cableWraps * 0.3);
      w.z -= w.vz * slowFactor * dt;
      w.wx += w.vx * slowFactor * dt;
      if (Math.abs(w.wx) > 1.05) w.vx = -w.vx;

      const prevSin = Math.sin(w.stridePhase);
      w.stridePhase += dt * 2.6 * slowFactor;
      const curSin = Math.sin(w.stridePhase);
      if (prevSin < 0 && curSin >= 0 && w.z < 0.72) {
        arcadeAudio.playAtAtStomp();
      }

      w.fireCd -= dt;
      if (w.fireCd <= 0 && w.z < 0.86 && w.z > 0.24) {
        w.fireCd = Math.max(1.15, 2.05 - this.wave * 0.12);
        this.enemyBolts.push({
          wx: w.wx - 0.14,
          wy: 0.12,
          z: w.z,
          vx: -w.wx * 0.55,
          vy: -0.1,
          vz: 0.42 + this.wave * 0.04,
          color: '#EF4444',
        });
      }

      if (w.z <= 0.16) {
        // Walker reached Echo Base perimeter!
        this.walkers.splice(i, 1);
        this.takeShieldHit('AT-AT BREACHED PERIMETER');
      }
    }

    this.stepEnemyBolts(dt);

    if (this.stageProgress >= this.stageTarget) {
      arcadeAudio.playStageClear();
      this.setupSubStage(1);
    }
  }

  private stepHothOrbit(dt: number): void {
    const spd = 1 + (this.wave - 1) * 0.14;
    this.spawnCd -= dt;
    if (this.spawnCd <= 0 && this.spaceEnemies.filter((e) => e.kind !== 'mine').length < 5) {
      this.spawnCd = Math.max(0.58, 1.3 - this.wave * 0.09);
      const isBomber = Math.random() < 0.48;
      if (!isBomber && Math.random() < 0.4) arcadeAudio.playTieScreech();
      this.spaceEnemies.push({
        id: this.nextId++,
        kind: isBomber ? 'bomber' : 'interceptor',
        wx: (Math.random() - 0.5) * 1.85,
        wy: (Math.random() - 0.5) * 1.1,
        z: 1.0,
        vx: (Math.random() - 0.5) * (isBomber ? 0.55 : 0.95) * spd,
        vy: (Math.random() - 0.5) * 0.55 * spd,
        vz: (isBomber ? 0.18 : 0.26) * spd,
        roll: 0,
        fireCd: isBomber ? 1.15 : 1.0,
        hp: isBomber ? 2 : 1,
      });
    }

    for (let i = this.spaceEnemies.length - 1; i >= 0; i--) {
      const e = this.spaceEnemies[i];
      e.wx += e.vx * dt;
      e.wy += e.vy * dt;
      e.z -= e.vz * dt;
      e.roll += dt * (e.kind === 'mine' ? 3.5 : 1.2);
      if (Math.abs(e.wx) > 1.35) e.vx = -e.vx;
      if (Math.abs(e.wy) > 0.9) e.vy = -e.vy;

      e.fireCd -= dt;
      if (e.kind === 'bomber' && e.fireCd <= 0 && e.z > 0.3 && e.z < 0.88) {
        e.fireCd = 1.65;
        // Drop drifting Proximity Vector Mine!
        this.spaceEnemies.push({
          id: this.nextId++,
          kind: 'mine',
          wx: e.wx,
          wy: e.wy,
          z: e.z,
          vx: -e.wx * 0.45,
          vy: -e.wy * 0.45,
          vz: 0.28 * spd,
          roll: 0,
          fireCd: 99,
          hp: 1,
        });
      } else if (e.kind === 'interceptor' && e.fireCd <= 0 && e.z > 0.28 && e.z < 0.88) {
        e.fireCd = 1.35 / spd;
        this.enemyBolts.push({
          wx: e.wx,
          wy: e.wy,
          z: e.z,
          vx: -e.wx * 0.6,
          vy: -e.wy * 0.6,
          vz: 0.46 * spd,
          color: '#4ADE80',
        });
      }

      if (e.z <= 0.1) {
        if (e.kind === 'mine') {
          this.takeShieldHit('PROXIMITY MINE');
        }
        this.spaceEnemies.splice(i, 1);
      }
    }

    this.stepEnemyBolts(dt);

    if (this.stageProgress >= this.stageTarget) {
      arcadeAudio.playStageClear();
      this.setupSubStage(2);
    }
  }

  private spawnPolyAsteroid(): void {
    const verts: Array<[number, number]> = [];
    const sides = 7 + Math.floor(Math.random() * 3);
    for (let i = 0; i < sides; i++) {
      const a = (Math.PI * 2 * i) / sides;
      const r = 0.72 + Math.random() * 0.42;
      verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    this.asteroids.push({
      id: this.nextId++,
      wx: (Math.random() - 0.5) * 1.9,
      wy: (Math.random() - 0.5) * 1.2,
      z: 1.0,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.35,
      vz: 0.3 + Math.random() * 0.16 + this.wave * 0.03,
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 3.2,
      size: 0.9 + Math.random() * 0.65,
      hp: 1 + (Math.random() < 0.3 ? 1 : 0),
      verts,
    });
  }

  private stepAsteroidField(dt: number): void {
    this.spawnCd -= dt;
    if (this.spawnCd <= 0 && this.asteroids.length < 7 + Math.min(4, this.wave)) {
      this.spawnCd = Math.max(0.32, 0.72 - this.wave * 0.05);
      this.spawnPolyAsteroid();
      if (Math.random() < 0.25 && this.spaceEnemies.length < 2) {
        this.spaceEnemies.push({
          id: this.nextId++,
          kind: 'interceptor',
          wx: (Math.random() - 0.5) * 1.6,
          wy: (Math.random() - 0.5) * 0.9,
          z: 1.0,
          vx: (Math.random() - 0.5) * 0.9,
          vy: (Math.random() - 0.5) * 0.5,
          vz: 0.28,
          roll: 0,
          fireCd: 1.2,
          hp: 1,
        });
      }
    }

    // Spawn J-E-D-I bonus letters
    this.jediPodCd -= dt;
    if (this.jediPodCd <= 0 && this.jediPods.length < 1) {
      this.jediPodCd = 4.5;
      const letters: Array<'J' | 'E' | 'D' | 'I'> = ['J', 'E', 'D', 'I'];
      const missingIdx = this.jediCollected.findIndex((c) => !c);
      const letter = letters[missingIdx >= 0 ? missingIdx : Math.floor(Math.random() * 4)];
      this.jediPods.push({
        id: this.nextId++,
        letter,
        wx: (Math.random() - 0.5) * 1.4,
        wy: (Math.random() - 0.5) * 0.85,
        z: 0.96,
        vx: (Math.random() - 0.5) * 0.24,
      });
    }

    for (let i = this.jediPods.length - 1; i >= 0; i--) {
      const pod = this.jediPods[i];
      pod.wx += pod.vx * dt;
      pod.z -= dt * 0.2;
      if (pod.z <= 0.1) this.jediPods.splice(i, 1);
    }

    for (let i = this.asteroids.length - 1; i >= 0; i--) {
      const ast = this.asteroids[i];
      ast.wx += ast.vx * dt;
      ast.wy += ast.vy * dt;
      ast.z -= ast.vz * dt;
      ast.rot += ast.vRot * dt;
      if (ast.z <= 0.11) {
        const p = this.project3D(ast.wx, ast.wy, ast.z);
        if (Math.hypot(p.sx - CX, p.sy - CY) < 175) {
          this.takeShieldHit('ASTEROID IMPACT');
        }
        this.asteroids.splice(i, 1);
      }
    }

    for (let i = this.spaceEnemies.length - 1; i >= 0; i--) {
      const e = this.spaceEnemies[i];
      e.wx += e.vx * dt;
      e.wy += e.vy * dt;
      e.z -= e.vz * dt;
      e.fireCd -= dt;
      if (e.fireCd <= 0 && e.z > 0.3 && e.z < 0.88) {
        e.fireCd = 1.45;
        this.enemyBolts.push({
          wx: e.wx,
          wy: e.wy,
          z: e.z,
          vx: -e.wx * 0.55,
          vy: -e.wy * 0.55,
          vz: 0.45,
          color: '#4ADE80',
        });
      }
      if (e.z <= 0.1) this.spaceEnemies.splice(i, 1);
    }

    this.stepEnemyBolts(dt);

    if (this.stageProgress >= this.stageTarget) {
      arcadeAudio.playStageClear();
      this.setupSubStage(3);
    }
  }

  private stepStarDestroyerBridge(dt: number): void {
    for (const d of this.bridgeDomes) {
      if (d.hitFlash > 0) d.hitFlash -= dt;
    }
    this.spawnCd -= dt;
    if (this.spawnCd <= 0 && this.spaceEnemies.length < 3) {
      this.spawnCd = Math.max(0.95, 1.8 - this.wave * 0.12);
      this.spaceEnemies.push({
        id: this.nextId++,
        kind: 'interceptor',
        wx: (Math.random() - 0.5) * 1.6,
        wy: (Math.random() - 0.5) * 0.7,
        z: 0.96,
        vx: (Math.random() - 0.5) * 0.95,
        vy: (Math.random() - 0.5) * 0.45,
        vz: 0.25,
        roll: 0,
        fireCd: 1.0,
        hp: 1,
      });
    }

    // Star Destroyer turbolaser fire from bridge
    if (Math.random() < dt * (1.1 + this.wave * 0.2)) {
      const side = Math.random() < 0.5 ? -1 : 1;
      this.enemyBolts.push({
        wx: side * 0.44,
        wy: -0.22,
        z: 0.54,
        vx: -side * 0.26 + (Math.random() - 0.5) * 0.25,
        vy: 0.12,
        vz: 0.44,
        color: '#EF4444',
      });
    }

    for (let i = this.spaceEnemies.length - 1; i >= 0; i--) {
      const e = this.spaceEnemies[i];
      e.wx += e.vx * dt;
      e.wy += e.vy * dt;
      e.z -= e.vz * dt;
      if (Math.abs(e.wx) > 1.3) e.vx = -e.vx;
      e.fireCd -= dt;
      if (e.fireCd <= 0 && e.z > 0.26) {
        e.fireCd = 1.35;
        this.enemyBolts.push({
          wx: e.wx,
          wy: e.wy,
          z: e.z,
          vx: -e.wx * 0.5,
          vy: -e.wy * 0.5,
          vz: 0.48,
          color: '#4ADE80',
        });
      }
      if (e.z <= 0.1) this.spaceEnemies.splice(i, 1);
    }

    this.stepEnemyBolts(dt);
  }

  private stepEnemyBolts(dt: number): void {
    for (let i = this.enemyBolts.length - 1; i >= 0; i--) {
      const eb = this.enemyBolts[i];
      eb.wx += eb.vx * dt;
      eb.wy += eb.vy * dt;
      eb.z -= eb.vz * dt;
      if (eb.z <= 0.09) {
        this.enemyBolts.splice(i, 1);
        this.takeShieldHit('IMPERIAL FIRE');
      }
    }
  }

  // --- Luminous Double-Pass Hoth Vector Renderer ---
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
    ctx.globalAlpha = alpha * 0.26;
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

    ctx.globalAlpha = alpha * 0.68;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = Math.max(0.7, width * 0.38);
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
    ctx.globalAlpha = alpha * 0.24;
    ctx.strokeStyle = color;
    ctx.lineWidth = width * 3.1;
    trace();
    ctx.stroke();

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    trace();
    ctx.stroke();

    ctx.globalAlpha = alpha * 0.58;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = Math.max(0.65, width * 0.34);
    trace();
    ctx.stroke();
    ctx.restore();
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.save();
    ctx.scale(dpr, dpr);

    // Distinct Icy Glacial Hoth Vector Backdrop vs Deep Hoth Orbit Black
    if (this.subStage === 0 || this.phase === 'TITLE') {
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#030B1B');
      grad.addColorStop(0.46, '#071B36');
      grad.addColorStop(0.5, '#0A2546');
      grad.addColorStop(1, '#040D1E');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = '#020612';
      ctx.fillRect(0, 0, W, H);
    }

    if (this.shakeTimer > 0) {
      const mag = this.shakeTimer * 26;
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }

    // Stars / Hoth blowing snow specks
    for (const s of this.stars) {
      const p = this.project3D(s.x, s.y, s.z);
      if (p.sx < 0 || p.sx > W || p.sy < 0 || p.sy > H) continue;
      if (this.subStage === 0 && p.sy > CY - 18) continue;
      ctx.fillStyle = `rgba(186, 230, 253, ${Math.min(1, 1.15 - s.z)})`;
      const sz = Math.max(1, (1 - s.z) * 2.5);
      ctx.fillRect(p.sx, p.sy, sz, sz);
    }

    if (this.phase === 'TITLE') {
      this.renderHothMountainsAndSnow(ctx);
      this.renderShowcaseAtAt(ctx);
      this.renderTitleOverlay(ctx);
    } else if (this.subStage === 0) {
      this.renderHothMountainsAndSnow(ctx);
      this.renderProbeDroids(ctx);
      this.renderAtAtWalkers(ctx);
    } else if (this.subStage === 1) {
      this.renderStarDestroyerWireframe(ctx, 0.72, false);
      this.renderSpaceEnemies(ctx);
    } else if (this.subStage === 2) {
      this.renderAsteroids(ctx);
      this.renderSpaceEnemies(ctx);
      this.renderJediPods(ctx);
    } else {
      this.renderStarDestroyerWireframe(ctx, 1.18, true);
      this.renderSpaceEnemies(ctx);
    }

    // Enemy bolts
    for (const eb of this.enemyBolts) {
      const p = this.project3D(eb.wx, eb.wy, eb.z);
      const r = Math.max(6, 12 * p.scale);
      this.drawGlowLine(ctx, p.sx - r, p.sy - r * 0.4, p.sx + r, p.sy + r * 0.4, eb.color, 2.4);
      this.drawGlowLine(ctx, p.sx - r, p.sy + r * 0.4, p.sx + r, p.sy - r * 0.4, '#FFFFFF', 1.4);
    }

    // Player blaster bolts
    for (const l of this.lasers) {
      this.drawGlowLine(ctx, l.x0, l.y0, l.x1, l.y1, l.color, 2.2, Math.max(0, l.life / l.maxLife));
    }

    // Active Harpoon Tow-Cable golden glowing vector tether!
    if (this.activeCableFlash > 0 && this.activeCableTarget) {
      const a = Math.min(1, this.activeCableFlash * 3.5);
      const tx = this.activeCableTarget.x;
      const ty = this.activeCableTarget.y;
      const midX = (CX + tx) * 0.5 + Math.sin(this.elapsed * 32) * 24;
      const midY = (H - 36 + ty) * 0.5 + 16;
      this.drawGlowPoly(
        ctx,
        [
          [CX, H - 36],
          [midX, midY],
          [tx, ty],
        ],
        '#FACC15',
        2.6,
        false,
        a
      );
    }

    // Vector Shatter Explosions
    this.renderVectorExplosions(ctx);

    // Snowspeeder / Falcon Cockpit + Reticle
    if (this.phase === 'PLAYING' || this.phase === 'READY') {
      this.renderSnowspeederCockpit(ctx);
      this.renderReticle(ctx);
    }

    // Score Popups
    for (const pop of this.popups) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (pop.life / pop.maxLife) * 1.8);
      ctx.font = '800 13px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x, pop.y);
      ctx.restore();
    }

    // Jedi Force aura border when active
    if (this.jediForceTimer > 0) {
      ctx.strokeStyle = `rgba(56, 189, 248, ${0.45 + Math.sin(this.elapsed * 12) * 0.25})`;
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 46, W - 6, H - 49);
    }

    if (this.hitFlash > 0) {
      ctx.fillStyle = `rgba(239, 68, 68, ${Math.min(0.4, this.hitFlash)})`;
      ctx.fillRect(0, 0, W, H);
    }

    this.renderHudBar(ctx);
    if (visualMode === 'crt') renderCrtOverlay(ctx, W, H);
    ctx.restore();
  }

  private renderHothMountainsAndSnow(ctx: CanvasRenderingContext2D): void {
    const horizonY = CY - 22;
    // Jagged Icy Hoth Mountain Range Silhouette (pure glowing cyan/blue vector!)
    const peaks: Array<[number, number]> = [
      [0, horizonY],
      [75, horizonY - 46],
      [148, horizonY - 12],
      [235, horizonY - 68],
      [320, horizonY - 18],
      [395, horizonY - 52],
      [485, horizonY - 16],
      [575, horizonY - 74],
      [660, horizonY - 22],
      [720, horizonY - 48],
      [W, horizonY],
    ];
    this.drawGlowPoly(ctx, peaks, '#38BDF8', 1.6, false, 0.72);
    this.drawGlowLine(ctx, 0, horizonY, W, horizonY, '#BAE6FD', 1.5, 0.8);

    // Echo Base Shield Generator Power Fins on distant left horizon
    this.drawGlowPoly(
      ctx,
      [
        [88, horizonY],
        [98, horizonY - 22],
        [114, horizonY - 22],
        [124, horizonY],
      ],
      '#FACC15',
      1.3,
      false,
      0.7
    );

    // Scrolling 3D Hoth Snowfield Vector Grid
    const scroll = (this.elapsed * 0.72) % 1;
    for (let i = 0; i < 8; i++) {
      const z = 0.14 + ((i + (1 - scroll)) / 8) * 0.86;
      const pL = this.project3D(-2.5, 0.62, z);
      const pR = this.project3D(2.5, 0.62, z);
      if (pL.sy > horizonY && pL.sy < H) {
        this.drawGlowLine(ctx, Math.max(0, pL.sx), pL.sy, Math.min(W, pR.sx), pR.sy, '#7DD3FC', 1.15, 0.42);
      }
    }
    for (let gx = -5; gx <= 5; gx++) {
      const pF = this.project3D(gx * 0.5, 0.62, 1.0);
      const pN = this.project3D(gx * 0.5, 0.62, 0.13);
      this.drawGlowLine(ctx, pF.sx, Math.max(horizonY, pF.sy), pN.sx, pN.sy, '#38BDF8', 1.05, 0.34);
    }
  }

  private renderProbeDroids(ctx: CanvasRenderingContext2D): void {
    for (const pr of this.probes) {
      const p = this.project3D(pr.wx, pr.wy + Math.sin(pr.bobPhase) * 0.04, pr.z);
      const s = Math.max(10, 17 * p.scale);
      // Pulsing red signal ring
      const pulseR = s * (1.2 + ((this.elapsed * 2.2) % 1) * 1.4);
      const ringPts: Array<[number, number]> = [];
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * 2 * i) / 8;
        ringPts.push([p.sx + Math.cos(a) * pulseR, p.sy + Math.sin(a) * pulseR]);
      }
      this.drawGlowPoly(ctx, ringPts, '#EF4444', 1.1, true, 0.55);

      // Imperial Viper Probe Droid dome + dangling articulated sensor tentacles!
      const dome: Array<[number, number]> = [];
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * 2 * i) / 8;
        dome.push([p.sx + Math.cos(a) * s * 0.68, p.sy - s * 0.2 + Math.sin(a) * s * 0.58]);
      }
      this.drawGlowPoly(ctx, dome, '#38BDF8', 1.8, true);
      // Glowing red central eye
      this.drawGlowLine(ctx, p.sx - s * 0.2, p.sy - s * 0.2, p.sx + s * 0.2, p.sy - s * 0.2, '#EF4444', 2.4);
      // 4 dangling probe tentacles
      for (let t = -1.5; t <= 1.5; t += 1) {
        const sway = Math.sin(this.elapsed * 5 + t + pr.id) * s * 0.22;
        this.drawGlowPoly(
          ctx,
          [
            [p.sx + t * s * 0.28, p.sy + s * 0.34],
            [p.sx + t * s * 0.42 + sway, p.sy + s * 0.95],
            [p.sx + t * s * 0.32 - sway * 0.5, p.sy + s * 1.45],
          ],
          '#FACC15',
          1.4,
          false
        );
      }
    }
  }

  private drawSingleAtAt(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    s: number,
    stride: number,
    cableWraps: number,
    topple: number,
    toppleDir: number,
    hitFlash: number
  ): void {
    ctx.save();
    ctx.translate(cx, cy + s * 1.5);
    if (topple > 0) {
      ctx.rotate(topple * toppleDir * 1.42);
    }
    ctx.translate(0, -s * 1.5);

    const armorCol = hitFlash > 0 ? '#FFFFFF' : '#E0F2FE';
    const detailCol = '#38BDF8';

    // 4 Articulated Hinged AT-AT Legs (back pair dimmer, front pair bright)
    const legs = [
      { ox: -0.78, phase: stride, col: '#7DD3FC' },
      { ox: 0.42, phase: stride + Math.PI, col: '#7DD3FC' },
      { ox: -0.52, phase: stride + Math.PI, col: armorCol },
      { ox: 0.68, phase: stride, col: armorCol },
    ];
    for (const lg of legs) {
      const hipX = lg.ox * s;
      const hipY = s * 0.25;
      const swing = Math.sin(lg.phase) * s * 0.26;
      const lift = Math.max(0, Math.cos(lg.phase)) * s * 0.14;
      const kneeX = hipX + swing * 0.65;
      const kneeY = s * 0.96 - lift * 0.5;
      const footX = hipX + swing;
      const footY = s * 1.62 - lift;
      this.drawGlowPoly(
        ctx,
        [
          [hipX, hipY],
          [kneeX, kneeY],
          [footX, footY],
        ],
        lg.col,
        2.1,
        false
      );
      // Wide circular armored footpad
      this.drawGlowLine(ctx, footX - s * 0.22, footY, footX + s * 0.22, footY, detailCol, 2.4);
    }

    // Heavy Sloped AT-AT Armored Torso Body
    this.drawGlowPoly(
      ctx,
      [
        [-s * 0.92, -s * 0.42],
        [s * 0.92, -s * 0.42],
        [s * 1.08, s * 0.04],
        [s * 0.82, s * 0.36],
        [-s * 0.82, s * 0.36],
        [-s * 1.05, s * 0.02],
      ],
      armorCol,
      2.2,
      true
    );
    // Side armor rib lines
    this.drawGlowLine(ctx, -s * 0.35, -s * 0.4, -s * 0.35, s * 0.34, detailCol, 1.3, 0.75);
    this.drawGlowLine(ctx, s * 0.35, -s * 0.4, s * 0.35, s * 0.34, detailCol, 1.3, 0.75);

    // Flashing Crimson/Gold Articulated Neck Weakpoint!
    const neckCol = Math.sin(this.elapsed * 14) > 0 ? '#EF4444' : '#FACC15';
    this.drawGlowPoly(
      ctx,
      [
        [-s * 1.02, -s * 0.18],
        [-s * 1.38, -s * 0.22],
        [-s * 1.38, s * 0.1],
        [-s * 1.02, s * 0.12],
      ],
      neckCol,
      2.3,
      true
    );

    // Armored AT-AT Head + Red Visor + Twin Chin Blasters
    this.drawGlowPoly(
      ctx,
      [
        [-s * 1.38, -s * 0.34],
        [-s * 1.98, -s * 0.24],
        [-s * 2.04, s * 0.16],
        [-s * 1.38, s * 0.22],
      ],
      armorCol,
      2.1,
      true
    );
    // Glowing red cockpit viewport slit
    this.drawGlowLine(ctx, -s * 1.94, -s * 0.06, -s * 1.62, -s * 0.06, '#EF4444', 2.4);
    // Chin laser barrels
    this.drawGlowLine(ctx, -s * 1.96, s * 0.12, -s * 2.34, s * 0.18, '#F97316', 1.8);

    // Golden Glowing Harpoon Tow-Cable Loops wrapped around AT-AT legs!
    for (let c = 0; c < cableWraps; c++) {
      const cyLoop = s * (0.78 + c * 0.26);
      this.drawGlowPoly(
        ctx,
        [
          [-s * 0.92, cyLoop],
          [0, cyLoop + s * 0.12],
          [s * 0.95, cyLoop],
          [0, cyLoop - s * 0.1],
        ],
        '#FACC15',
        2.4,
        true
      );
    }

    ctx.restore();
  }

  private renderAtAtWalkers(ctx: CanvasRenderingContext2D): void {
    const sorted = [...this.walkers].sort((a, b) => b.z - a.z);
    for (const w of sorted) {
      const p = this.project3D(w.wx, 0.24, w.z);
      const s = Math.max(12, 32 * p.scale);
      this.drawSingleAtAt(ctx, p.sx, p.sy, s, w.stridePhase, w.cableWraps, w.toppleProgress, w.toppleDir, w.hitFlash);
      if (w.toppleProgress === 0 && w.cableWraps > 0) {
        ctx.font = '800 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FACC15';
        ctx.fillText(`CABLE ${w.cableWraps}/3`, p.sx, p.sy - s * 0.85);
      }
    }
  }

  private renderShowcaseAtAt(ctx: CanvasRenderingContext2D): void {
    this.drawSingleAtAt(ctx, CX + 35, CY + 22, 54, this.elapsed * 2.2, 1, 0, 1, 0);
  }

  private renderStarDestroyerWireframe(ctx: CanvasRenderingContext2D, scale: number, showDomes: boolean): void {
    const cx = CX;
    const cy = CY - 34;
    const w = 230 * scale;
    const h = 76 * scale;
    // Iconic dagger-wedge Imperial Star Destroyer 3D wireframe!
    this.drawGlowPoly(
      ctx,
      [
        [cx, cy + h * 0.95],
        [cx - w, cy - h * 0.25],
        [cx, cy - h * 0.65],
        [cx + w, cy - h * 0.25],
      ],
      '#38BDF8',
      1.9,
      true,
      0.82
    );
    // Spine ridge & upper terraced hull
    this.drawGlowLine(ctx, cx, cy + h * 0.95, cx, cy - h * 0.65, '#BAE6FD', 1.4, 0.65);
    this.drawGlowPoly(
      ctx,
      [
        [cx - w * 0.36, cy - h * 0.34],
        [cx - w * 0.24, cy - h * 0.92],
        [cx + w * 0.24, cy - h * 0.92],
        [cx + w * 0.36, cy - h * 0.34],
      ],
      '#60A5FA',
      1.7,
      true,
      0.85
    );
    // Bridge Command Tower
    this.drawGlowPoly(
      ctx,
      [
        [cx - w * 0.28, cy - h * 0.92],
        [cx - w * 0.32, cy - h * 1.28],
        [cx + w * 0.32, cy - h * 1.28],
        [cx + w * 0.28, cy - h * 0.92],
      ],
      '#E0F2FE',
      1.9,
      true,
      0.9
    );

    if (showDomes) {
      for (const d of this.bridgeDomes) {
        const p = this.project3D(d.side * 0.44, -0.26, 0.54);
        if (d.hp <= 0) {
          this.drawGlowLine(ctx, p.sx - 14, p.sy - 14, p.sx + 14, p.sy + 14, '#475569', 1.5, 0.5);
          continue;
        }
        const r = 24;
        const pts: Array<[number, number]> = [];
        for (let i = 0; i < 10; i++) {
          const a = this.elapsed * 1.5 + (Math.PI * 2 * i) / 10;
          pts.push([p.sx + Math.cos(a) * r, p.sy + Math.sin(a) * r]);
        }
        const col = d.hitFlash > 0 ? '#FFFFFF' : '#FACC15';
        this.drawGlowPoly(ctx, pts, col, 2.2, true);
        this.drawGlowLine(ctx, p.sx - r, p.sy, p.sx + r, p.sy, '#38BDF8', 1.2);
        ctx.font = '800 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FACC15';
        ctx.fillText(`SHIELD ${d.hp}/${d.maxHp}`, p.sx, p.sy - r - 8);
      }
    }
  }

  private renderSpaceEnemies(ctx: CanvasRenderingContext2D): void {
    const sorted = [...this.spaceEnemies].sort((a, b) => b.z - a.z);
    for (const e of sorted) {
      const p = this.project3D(e.wx, e.wy, e.z);
      const s = Math.max(9, 22 * p.scale);
      ctx.save();
      ctx.translate(p.sx, p.sy);
      ctx.rotate(e.kind === 'mine' ? e.roll : Math.sin(e.roll) * 0.25);

      if (e.kind === 'mine') {
        // Pulsing Proximity Vector Mine dropped by TIE Bombers!
        const col = Math.sin(this.elapsed * 16 + e.id) > 0 ? '#EF4444' : '#FACC15';
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI * i) / 3;
          this.drawGlowLine(ctx, Math.cos(a) * -s * 0.75, Math.sin(a) * -s * 0.75, Math.cos(a) * s * 0.75, Math.sin(a) * s * 0.75, col, 1.8);
        }
      } else if (e.kind === 'bomber') {
        // Distinct Twin-Pod TIE Bomber!
        const wingCol = '#F97316';
        this.drawGlowPoly(ctx, [[-s * 1.4, -s * 0.8], [-s * 1.65, 0], [-s * 1.4, s * 0.8], [-s * 1.0, s * 0.55], [-s * 1.0, -s * 0.55]], wingCol, 1.9, true);
        this.drawGlowPoly(ctx, [[s * 1.4, -s * 0.8], [s * 1.65, 0], [s * 1.4, s * 0.8], [s * 1.0, s * 0.55], [s * 1.0, -s * 0.55]], wingCol, 1.9, true);
        // Twin side-by-side bomber pods
        for (const ox of [-0.42, 0.42]) {
          const pod: Array<[number, number]> = [];
          for (let i = 0; i < 6; i++) {
            const a = (Math.PI * 2 * i) / 6;
            pod.push([ox * s + Math.cos(a) * s * 0.34, Math.sin(a) * s * 0.34]);
          }
          this.drawGlowPoly(ctx, pod, '#FACC15', 1.8, true);
        }
        this.drawGlowLine(ctx, -s * 1.02, 0, s * 1.02, 0, '#E2E8F0', 1.5);
      } else {
        // Distinct Dagger-Winged TIE Interceptor!
        const col = '#38BDF8';
        this.drawGlowPoly(
          ctx,
          [
            [-s * 1.45, -s * 0.95],
            [-s * 0.9, -s * 0.16],
            [-s * 1.45, s * 0.95],
            [-s * 1.15, 0],
          ],
          col,
          2.0,
          true
        );
        this.drawGlowPoly(
          ctx,
          [
            [s * 1.45, -s * 0.95],
            [s * 0.9, -s * 0.16],
            [s * 1.45, s * 0.95],
            [s * 1.15, 0],
          ],
          col,
          2.0,
          true
        );
        this.drawGlowLine(ctx, -s * 0.95, 0, s * 0.95, 0, '#4ADE80', 1.8);
        this.drawGlowPoly(ctx, [[-s * 0.3, -s * 0.3], [s * 0.3, -s * 0.3], [s * 0.3, s * 0.3], [-s * 0.3, s * 0.3]], '#4ADE80', 1.8, true);
      }
      ctx.restore();
    }
  }

  private renderAsteroids(ctx: CanvasRenderingContext2D): void {
    const sorted = [...this.asteroids].sort((a, b) => b.z - a.z);
    for (const ast of sorted) {
      const p = this.project3D(ast.wx, ast.wy, ast.z);
      const r = Math.max(10, ast.size * 22 * p.scale);
      ctx.save();
      ctx.translate(p.sx, p.sy);
      ctx.rotate(ast.rot);
      const pts: Array<[number, number]> = ast.verts.map(([vx, vy]) => [vx * r, vy * r]);
      this.drawGlowPoly(ctx, pts, '#CBD5E1', 1.9, true);
      // Inner 3D facet lines for crisp polyhedral depth
      if (pts.length >= 6) {
        this.drawGlowLine(ctx, pts[0][0], pts[0][1], pts[3][0] * 0.45, pts[3][1] * 0.45, '#7DD3FC', 1.1, 0.55);
        this.drawGlowLine(ctx, pts[2][0], pts[2][1], pts[5][0] * 0.45, pts[5][1] * 0.45, '#7DD3FC', 1.1, 0.55);
      }
      ctx.restore();
    }
  }

  private renderJediPods(ctx: CanvasRenderingContext2D): void {
    for (const pod of this.jediPods) {
      const p = this.project3D(pod.wx, pod.wy, pod.z);
      const r = Math.max(14, 18 * p.scale);
      this.drawGlowPoly(
        ctx,
        [
          [p.sx, p.sy - r],
          [p.sx + r, p.sy],
          [p.sx, p.sy + r],
          [p.sx - r, p.sy],
        ],
        '#FACC15',
        2.2,
        true
      );
      ctx.font = `900 ${Math.round(r * 1.1)}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(pod.letter, p.sx, p.sy + 1);
      ctx.textBaseline = 'alphabetic';
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

  private renderSnowspeederCockpit(ctx: CanvasRenderingContext2D): void {
    // Distinct angular T-47 Snowspeeder armored canopy bars (unlike X-Wing!)
    const col = this.subStage === 0 ? '#7DD3FC' : '#38BDF8';
    this.drawGlowPoly(
      ctx,
      [
        [0, H - 108],
        [96, H - 48],
        [W - 96, H - 48],
        [W, H - 108],
      ],
      col,
      2.0,
      false,
      0.7
    );
    // Snowspeeder nose cowl ridge
    this.drawGlowLine(ctx, CX - 56, H - 48, CX - 34, H - 22, '#F97316', 1.8, 0.72);
    this.drawGlowLine(ctx, CX + 56, H - 48, CX + 34, H - 22, '#F97316', 1.8, 0.72);
  }

  private renderReticle(ctx: CanvasRenderingContext2D): void {
    const x = this.aimX;
    const y = this.aimY;
    const col = this.subStage === 0 ? '#38BDF8' : '#FACC15';
    // Distinct diamond Snowspeeder targeting sight
    this.drawGlowPoly(
      ctx,
      [
        [x, y - 19],
        [x + 19, y],
        [x, y + 19],
        [x - 19, y],
      ],
      col,
      2.0,
      true
    );
    this.drawGlowLine(ctx, x - 8, y, x + 8, y, '#FACC15', 1.6);
    this.drawGlowLine(ctx, x, y - 8, x, y + 8, '#FACC15', 1.6);
  }

  private renderHudBar(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(3, 11, 27, 0.8)';
    ctx.fillRect(0, 0, W, 44);
    this.drawGlowLine(ctx, 0, 44, W, 44, '#38BDF8', 1.3, 0.75);

    ctx.font = '800 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#7DD3FC';
    ctx.fillText('SHIELDS', 16, 26);

    for (let i = 0; i < this.maxShields; i++) {
      const bx = 82 + i * 20;
      const active = i < this.shields;
      ctx.strokeStyle = active ? (this.shields <= 2 ? '#EF4444' : '#38BDF8') : '#1E3A5F';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(bx, 13, 14, 16);
      if (active) {
        ctx.fillStyle = this.shields <= 2 ? 'rgba(239,68,68,0.65)' : 'rgba(56,189,248,0.55)';
        ctx.fillRect(bx + 2, 15, 10, 12);
      }
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#FACC15';
    const labels = ['PHASE 1: HOTH AT-AT', 'PHASE 2: HOTH ORBIT', 'PHASE 3: ASTEROIDS', 'PHASE 4: STAR DESTROYER'];
    ctx.fillText(labels[this.subStage], CX + 15, 26);

    ctx.textAlign = 'right';
    ctx.fillStyle = this.jediForceTimer > 0 ? '#38BDF8' : '#FACC15';
    ctx.fillText(
      this.subStage === 0 ? 'TOW CABLE [SHIFT]' : `JEDI: ${['J', 'E', 'D', 'I'].map((c, idx) => (this.jediCollected[idx] ? c : '_')).join('')}`,
      W - 16,
      26
    );
  }

  private renderTitleOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '900 32px "JetBrains Mono", monospace';
    ctx.fillStyle = '#38BDF8';
    ctx.fillText('THE EMPIRE STRIKES BACK', CX, 102);
    ctx.font = '700 13px "JetBrains Mono", monospace';
    ctx.fillStyle = '#BAE6FD';
    ctx.fillText('1985 ATARI COLOR VECTOR — HOTH SNOWSPEEDER & AT-AT ASSAULT', CX, 128);

    ctx.font = '700 13px "JetBrains Mono", monospace';
    ctx.fillStyle = '#FACC15';
    ctx.fillText('PROBES & AT-AT WALKERS  ·  TIE BOMBERS  ·  ASTEROID FIELD  ·  STAR DESTROYER', CX, H - 92);
    ctx.fillStyle = '#E2E8F0';
    ctx.fillText('FIRE: CLICK / SPACE   ·   HARPOON TOW CABLE / ION PULSE: SHIFT / X', CX, H - 66);
    ctx.restore();
  }
}

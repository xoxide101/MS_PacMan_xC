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
import {
  Camera3DState,
  MeltOVisionBuffer,
  TubeWebDef,
  buildClassic1981Webs,
  createDefaultCamera,
  getLaneCount,
  mapPointerToLanePos,
  matchesCellFiringSolution,
  projectCellFrame,
  projectTubePoint,
  shortestLaneStep,
  wrapContinuousLanePos,
  wrapLaneIndex,
} from './tempestGeometry';

// ============================================================================
// TEMPEST 2000 (1994 Atari Jaguar / Llamasoft — Jaguar Melt-O-Vision Engine)
// - Real-time offscreen Jaguar Melt-O-Vision feedback buffer (outward zoom +
//   gravity downward melt + pixel explosion fountains!)
// - Gouraud-shaded translucent 3D polygon web panels + dynamic 3D camera tilt/roll
// - Continuous 3D Cell-Space Claw (u in 0..1) aiming center OR side rails + 3D Jump!
// - Authentic T2K Upgrades: Particle Laser, Jump Thruster, A.I. Droid, Superzapper Recharge,
//   Warp Tokens (3 -> Psychedelic 3D Bonus Ring Tunnel!), & Iconic Jaguar Voice Callouts!
// - Authentic T2K Enemies: 3D Flippers, Flipper/Fuseball Tankers, Spikers, Rail-Riding Fuseballs,
//   Pulsars (Jump over electrified lane!), & Multi-HP Demon Heads!
// ============================================================================

type T2KEnemyKind = 'flipper' | 'tanker' | 'fuseTanker' | 'spiker' | 'fuseball' | 'pulsar' | 'demon';

interface T2KEnemy {
  id: number;
  kind: T2KEnemyKind;
  lane: number;
  u: number;
  z: number;
  hp: number;
  maxHp: number;
  speed: number;
  flipTimer: number;
  flipDir: 1 | -1;
  flipping: boolean;
  flipProgress: number;
  flipTargetLane: number;
  retreating: boolean;
  fireCd: number;
  pulseTimer: number;
  pulsing: boolean;
  railSide: 0 | 1;
}

interface T2KShot {
  lane: number;
  u: number;
  z: number;
  fromPlayer: boolean;
  speed: number;
  isParticleLaser: boolean;
}

interface T2KCapsule {
  lane: number;
  u: number;
  z: number;
  kind: 'laser' | 'jump' | 'droid' | 'zapper' | 'warp' | 'points';
}

interface PixelFountain {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}

interface BonusRing {
  x: number;
  y: number;
  z: number;
  hue: number;
  passed: boolean;
}

const LOGICAL_W = 760;
const LOGICAL_H = 760;
const CX = LOGICAL_W * 0.5;
const CY = LOGICAL_H * 0.52;

const T2K_WEBS = buildClassic1981Webs();

export class Tempest2000Game implements ArcadeGameInstance {
  public readonly logicalWidth = LOGICAL_W;
  public readonly logicalHeight = LOGICAL_H;
  public readonly supportsPointerAim = true;
  public readonly primaryActionLabel = 'Particle Laser';
  public readonly secondaryActionLabel = 'Superzapper';

  private readonly storageKey = 'tempest2000_jaguar_hd_highscore_v2';
  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();

  private score = 0;
  private highScore = 0;
  private nextExtraLife = 30000;
  private level = 1;
  private lives = 3;

  private clock = 0;
  private phaseTimer = 0;
  private zapperUses = 2;
  private zapperFlash = 0;

  // Continuous 3D cell-space movement + 3D Jump Thruster!
  private lanePos = 0.5;
  private angularVel = 0;
  private clawRecoil = 0;
  private fireCd = 0;
  private jumpHeight = 0;
  private jumpVel = 0;
  private invulnTimer = 0;

  // Authentic Tempest 2000 Upgrades & Warp Bonus State
  private hasParticleLaser = false;
  private hasJump = false;
  private hasDroid = false;
  private droidLane = 0;
  private droidAngle = 0;
  private droidFireCd = 0;
  private warpTokens = 0;

  // Bonus Ring Tunnel Mode (activated after collecting 3 Warp Tokens!)
  private inBonusTunnel = false;
  private bonusTimer = 0;
  private bonusShipX = 0;
  private bonusShipY = 0;
  private bonusRingsCleared = 0;
  private bonusRings: BonusRing[] = [];

  // Iconic Jaguar floating voice-callout banner ("YES! YES! YES!", "PARTICLE LASER!")
  private calloutText = '';
  private calloutColor = '#FACC15';
  private calloutTimer = 0;

  // Melt-O-Vision Jaguar feedback engine + 3D dynamic camera
  private meltBuffer = new MeltOVisionBuffer(380, 380);
  private cam: Camera3DState = createDefaultCamera(CX, CY, 294, 3.65);
  private warpProgress = 0;

  private tube: TubeWebDef = T2K_WEBS[0];
  private laneCount = 16;
  private spikes: number[] = [];
  private electrifiedLanes: number[] = [];
  private enemies: T2KEnemy[] = [];
  private remainingToSpawn = 0;
  private spawnTimer = 0;
  private nextEnemyId = 1;
  private shots: T2KShot[] = [];
  private capsules: T2KCapsule[] = [];
  private fountains: PixelFountain[] = [];
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  constructor() {
    this.highScore = readHighScore(this.storageKey);
    this.loadStage(1);
    this.phase = 'TITLE';
  }

  private getCurrentLane(): number {
    return wrapLaneIndex(this.tube, Math.floor(this.lanePos));
  }

  private getCurrentSubCell(): number {
    const fl = Math.floor(this.lanePos);
    return Math.max(0.05, Math.min(0.95, this.lanePos - fl));
  }

  private triggerCallout(text: string, color: string): void {
    this.calloutText = text;
    this.calloutColor = color;
    this.calloutTimer = 1.6;
  }

  private spawnJaguarFountain(x: number, y: number, hueBase: number, count = 24): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 70 + Math.random() * 250;
      const hue = (hueBase + Math.random() * 55) % 360;
      this.fountains.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 45,
        color: `hsl(${hue}, 100%, 62%)`,
        life: 0.45 + Math.random() * 0.45,
        maxLife: 0.9,
        size: 2.5 + Math.random() * 3.5,
      });
    }
  }

  private loadStage(lvl: number): void {
    this.tube = T2K_WEBS[(lvl - 1) % T2K_WEBS.length];
    this.laneCount = getLaneCount(this.tube);
    this.lanePos = wrapContinuousLanePos(this.tube, Math.min(this.lanePos, this.laneCount - 0.5));
    this.spikes = new Array(this.laneCount).fill(0);
    this.electrifiedLanes = new Array(this.laneCount).fill(0);
    this.enemies = [];
    this.shots = [];
    this.capsules = [];
    this.zapperUses = 2;
    this.remainingToSpawn = 14 + lvl * 4;
    this.spawnTimer = 0.5;
    this.warpProgress = 0;
    this.cam.warpZoom = 0;
    this.jumpHeight = 0;
    this.jumpVel = 0;
    this.inBonusTunnel = false;
  }

  private startBonusTunnel(): void {
    this.inBonusTunnel = true;
    this.bonusTimer = 11.0;
    this.bonusShipX = 0;
    this.bonusShipY = 0;
    this.bonusRingsCleared = 0;
    this.bonusRings = [];
    for (let i = 0; i < 14; i++) {
      this.bonusRings.push({
        x: Math.sin(i * 0.95) * 0.52,
        y: Math.cos(i * 0.72) * 0.44,
        z: 0.45 + i * 0.34,
        hue: (i * 34) % 360,
        passed: false,
      });
    }
    this.triggerCallout('WARP BONUS STAGE!', '#22D3EE');
    arcadeAudio.playSuperTransform();
  }

  public startNewGame(): void {
    this.score = 0;
    this.nextExtraLife = 30000;
    this.level = 1;
    this.lives = 3;
    this.hasParticleLaser = false;
    this.hasJump = false;
    this.hasDroid = false;
    this.warpTokens = 0;
    this.fountains = [];
    this.particles = [];
    this.popups = [];
    this.meltBuffer.clear();
    this.loadStage(1);
    this.lanePos = 0.5;
    this.invulnTimer = 1.6;
    this.phase = 'READY';
    this.phaseTimer = 1.05;
    this.triggerCallout('TEMPEST 2000!', '#F472B6');
    arcadeAudio.playArcadeStart();
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.meltBuffer.clear();
    this.loadStage(1);
    this.phase = 'TITLE';
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  private addScore(pts: number, laneIdx?: number, u = 0.5, z = 0.2, color = '#FDE047'): void {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(this.storageKey, this.highScore);
    }
    if (this.score >= this.nextExtraLife) {
      this.nextExtraLife += 30000;
      this.lives = Math.min(6, this.lives + 1);
      arcadeAudio.playExtraLife();
      this.triggerCallout('EXTRA LIFE! YES!', '#4ADE80');
    }
    if (laneIdx !== undefined) {
      const f = projectCellFrame(this.tube, laneIdx, u, z, this.cam);
      this.popups.push({ x: f.x, y: f.y - 10, text: `${pts}`, color, life: 0.78, maxLife: 0.78 });
    }
  }

  private triggerSuperzapper(): void {
    if (this.zapperUses <= 0) return;
    this.zapperFlash = 0.52;
    arcadeAudio.playSuperzapper();
    this.triggerCallout(this.zapperUses === 2 ? 'SUPERZAPPER!' : 'ZAPPER SURGE!', '#38BDF8');

    if (this.zapperUses === 2) {
      for (const e of this.enemies) {
        const f = projectCellFrame(this.tube, e.lane, e.u, e.z, this.cam);
        this.spawnJaguarFountain(f.x, f.y, 195, 14);
        this.addScore(200, e.lane, e.u, e.z, '#38BDF8');
      }
      this.enemies = [];
      this.zapperUses = 1;
    } else {
      if (this.enemies.length > 0) {
        this.enemies.sort((a, b) => a.z - b.z);
        const e = this.enemies.shift()!;
        const f = projectCellFrame(this.tube, e.lane, e.u, e.z, this.cam);
        this.spawnJaguarFountain(f.x, f.y, 50, 22);
        this.addScore(300, e.lane, e.u, e.z, '#FACC15');
      }
      this.zapperUses = 0;
    }
  }

  private spawnEnemy(): void {
    const lane = Math.floor(Math.random() * this.laneCount);
    const roll = Math.random();
    let kind: T2KEnemyKind = 'flipper';
    if (this.level >= 2 && roll < 0.16) kind = 'tanker';
    else if (this.level >= 3 && roll < 0.28) kind = 'fuseTanker';
    else if (this.level >= 2 && roll < 0.44) kind = 'spiker';
    else if (this.level >= 2 && roll < 0.6) kind = 'fuseball';
    else if (this.level >= 3 && roll < 0.74) kind = 'pulsar';
    else if (this.level >= 4 && roll < 0.84) kind = 'demon';

    const railSide: 0 | 1 = Math.random() > 0.5 ? 1 : 0;
    const hp = kind === 'demon' ? 4 : kind === 'fuseTanker' ? 2 : 1;

    this.enemies.push({
      id: this.nextEnemyId++,
      kind,
      lane,
      u: kind === 'fuseball' ? railSide : 0.5,
      z: 1.0,
      hp,
      maxHp: hp,
      speed: 0.24 + Math.min(0.3, this.level * 0.025) + (kind === 'fuseball' ? 0.1 : 0),
      flipTimer: 0.6 + Math.random() * 0.7,
      flipDir: Math.random() > 0.5 ? 1 : -1,
      flipping: false,
      flipProgress: 0,
      flipTargetLane: lane,
      retreating: false,
      fireCd: 1.3 + Math.random() * 1.6,
      pulseTimer: 1.3 + Math.random() * 1.1,
      pulsing: false,
      railSide,
    });
  }

  private loseLife(): void {
    if (this.invulnTimer > 0) return;
    const f = projectCellFrame(this.tube, this.getCurrentLane(), this.getCurrentSubCell(), 0, this.cam);
    this.spawnJaguarFountain(f.x, f.y, 15, 42);
    spawnBurst(this.particles, f.x, f.y, '#F472B6', 24, 260, 4);
    arcadeAudio.playExplosion(true);

    this.lives -= 1;
    // Authentic T2K: losing a life drops AI Droid (keeps Jump/Laser for fun arcade flow)
    this.hasDroid = false;
    if (this.lives <= 0) {
      this.phase = 'GAME_OVER';
      arcadeAudio.playDeath();
      return;
    }

    this.enemies = this.enemies.filter((e) => e.z > 0.28);
    this.shots = this.shots.filter((s) => s.fromPlayer);
    this.invulnTimer = 2.2;
    this.jumpHeight = 0;
    this.jumpVel = 0;
  }

  private updateCamera3D(dt: number): void {
    const lane = this.getCurrentLane();
    const u = this.getCurrentSubCell();
    const v0 = this.tube.vertices[lane];
    const v1 = this.tube.vertices[(lane + 1) % this.tube.vertices.length];
    const vx = v0.x + (v1.x - v0.x) * u;
    const vy = v0.y + (v1.y - v0.y) * u;

    // Authentic Jaguar T2K dynamic 3D perspective banking & tilt toward your active cell!
    const targetYaw = vx * 0.52;
    const targetPitch = vy * 0.42;
    const targetRoll = -vx * 0.14;
    this.cam.yaw += (targetYaw - this.cam.yaw) * Math.min(1, dt * 5.2);
    this.cam.pitch += (targetPitch - this.cam.pitch) * Math.min(1, dt * 5.2);
    this.cam.roll += (targetRoll - this.cam.roll) * Math.min(1, dt * 4.5);
    this.cam.warpZoom = this.phase === 'STAGE_CLEAR' && !this.inBonusTunnel ? this.warpProgress * 2.3 : 0;
  }

  private handleSteering(dt: number): void {
    if (this.input.pointerActive) {
      const px = this.input.pointerX * LOGICAL_W;
      const py = this.input.pointerY * LOGICAL_H;
      const targetPos = mapPointerToLanePos(this.tube, px, py, this.cam, this.lanePos);
      let diff = targetPos - this.lanePos;
      if (this.tube.closed) {
        if (diff > this.laneCount * 0.5) diff -= this.laneCount;
        if (diff < -this.laneCount * 0.5) diff += this.laneCount;
      }
      this.angularVel = Math.max(-16, Math.min(16, diff * 18));
      this.lanePos = targetPos;
      return;
    }

    const spinSpeed = 8.4;
    if (this.input.left && !this.input.right) {
      this.angularVel = Math.max(-spinSpeed, this.angularVel - 58 * dt);
    } else if (this.input.right && !this.input.left) {
      this.angularVel = Math.min(spinSpeed, this.angularVel + 58 * dt);
    } else {
      this.angularVel *= Math.pow(0.0004, dt);
      if (Math.abs(this.angularVel) < 0.08) this.angularVel = 0;
    }
    this.lanePos = wrapContinuousLanePos(this.tube, this.lanePos + this.angularVel * dt);
  }

  public step(dt: number): void {
    this.clock += dt;
    if (this.zapperFlash > 0) this.zapperFlash = Math.max(0, this.zapperFlash - dt);
    if (this.calloutTimer > 0) this.calloutTimer = Math.max(0, this.calloutTimer - dt);
    if (this.clawRecoil > 0) this.clawRecoil = Math.max(0, this.clawRecoil - dt * 8);
    stepParticlesAndPopups(this.particles, this.popups, dt);

    // Update Jaguar pixel explosion fountains (with downward Melt-O-Vision gravity!)
    for (let i = this.fountains.length - 1; i >= 0; i--) {
      const f = this.fountains[i];
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vy += 290 * dt;
      f.life -= dt;
      if (f.life <= 0) this.fountains.splice(i, 1);
    }

    if (this.phase === 'TITLE') {
      this.lanePos = wrapContinuousLanePos(this.tube, this.lanePos + dt * 2.8);
      this.updateCamera3D(dt);
      return;
    }

    if (this.phase === 'PAUSED' || this.phase === 'GAME_OVER') return;

    if (this.phase === 'READY') {
      this.phaseTimer -= dt;
      this.updateCamera3D(dt);
      if (this.phaseTimer <= 0) this.phase = 'PLAYING';
      return;
    }

    // TEMPEST 2000 PSYCHEDELIC 3D BONUS RING TUNNEL!
    if (this.inBonusTunnel) {
      this.bonusTimer -= dt;
      if (this.input.pointerActive) {
        this.bonusShipX = Math.max(-0.85, Math.min(0.85, (this.input.pointerX - 0.5) * 1.9));
        this.bonusShipY = Math.max(-0.85, Math.min(0.85, (this.input.pointerY - 0.5) * 1.9));
      } else {
        if (this.input.left) this.bonusShipX -= 1.45 * dt;
        if (this.input.right) this.bonusShipX += 1.45 * dt;
        if (this.input.up) this.bonusShipY -= 1.45 * dt;
        if (this.input.down) this.bonusShipY += 1.45 * dt;
        this.bonusShipX = Math.max(-0.85, Math.min(0.85, this.bonusShipX));
        this.bonusShipY = Math.max(-0.85, Math.min(0.85, this.bonusShipY));
      }

      for (const r of this.bonusRings) {
        r.z -= 0.78 * dt;
        if (!r.passed && r.z <= 0.14) {
          r.passed = true;
          const dist = Math.hypot(this.bonusShipX - r.x, this.bonusShipY - r.y);
          if (dist < 0.34) {
            this.bonusRingsCleared += 1;
            this.addScore(1000);
            arcadeAudio.playCoin();
            this.spawnJaguarFountain(CX + r.x * 260, CY + r.y * 260, r.hue, 18);
          }
        }
        if (r.z < -0.1) {
          r.z += 4.76;
          r.passed = false;
          r.x = Math.sin(this.clock * 1.7 + r.hue) * 0.54;
          r.y = Math.cos(this.clock * 1.3 + r.hue) * 0.44;
        }
      }

      if (this.bonusTimer <= 0) {
        const skipBonus = this.bonusRingsCleared >= 8 ? 3 : 1;
        this.addScore(this.bonusRingsCleared * 500);
        this.triggerCallout(
          this.bonusRingsCleared >= 8 ? `WARP COMPLETE! +${skipBonus} LEVELS!` : 'BONUS COMPLETE!',
          '#4ADE80'
        );
        this.inBonusTunnel = false;
        this.level += skipBonus;
        this.loadStage(this.level);
        this.phase = 'READY';
        this.phaseTimer = 1.0;
      }
      return;
    }

    if (this.phase === 'STAGE_CLEAR') {
      this.warpProgress += dt * 0.78;
      this.handleSteering(dt);
      this.updateCamera3D(dt);
      const curLane = this.getCurrentLane();
      const spikeLen = this.spikes[curLane] || 0;
      if (spikeLen > 0.1 && this.warpProgress > 1 - spikeLen - 0.1 && this.warpProgress < 1 - spikeLen + 0.09 && this.jumpHeight < 0.2) {
        if (this.input.fire || this.input.fireJustPressed) {
          this.spikes[curLane] = 0;
          this.addScore(200, curLane, 0.5, 0.15, '#4ADE80');
          arcadeAudio.playLaser(1150);
        } else {
          this.spikes[curLane] = 0;
          this.loseLife();
        }
      }
      if (this.warpProgress >= 1.15) {
        if (this.warpTokens >= 3) {
          this.warpTokens = 0;
          this.startBonusTunnel();
          return;
        }
        this.level += 1;
        this.loadStage(this.level);
        this.phase = 'READY';
        this.phaseTimer = 0.9;
      }
      return;
    }

    // PLAYING
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (this.fireCd > 0) this.fireCd = Math.max(0, this.fireCd - dt);
    for (let i = 0; i < this.electrifiedLanes.length; i++) {
      if (this.electrifiedLanes[i] > 0) this.electrifiedLanes[i] = Math.max(0, this.electrifiedLanes[i] - dt);
    }

    this.handleSteering(dt);
    this.updateCamera3D(dt);

    const curLane = this.getCurrentLane();
    const curSubU = this.getCurrentSubCell();

    // Tempest 2000 3D Jump Thruster (can steer & shoot while soaring above the rim!)
    if (this.hasJump && this.input.up && this.jumpHeight <= 0) {
      this.jumpVel = 3.5;
      arcadeAudio.playJumpBoing();
    }
    if (this.jumpHeight > 0 || this.jumpVel > 0) {
      this.jumpHeight += this.jumpVel * dt;
      this.jumpVel -= 7.4 * dt;
      if (this.jumpHeight <= 0) {
        this.jumpHeight = 0;
        this.jumpVel = 0;
      }
    }

    // Blaster / Particle Laser (fires along exact sub-cell u-line!)
    const rapidCd = this.hasParticleLaser ? 0.08 : 0.13;
    if ((this.input.fire || this.input.fireJustPressed) && this.fireCd <= 0) {
      this.fireCd = rapidCd;
      this.clawRecoil = 1.0;
      this.shots.push({
        lane: curLane,
        u: curSubU,
        z: 0.03,
        fromPlayer: true,
        speed: this.hasParticleLaser ? 2.85 : 2.35,
        isParticleLaser: this.hasParticleLaser,
      });
      arcadeAudio.playLaser(this.hasParticleLaser ? 1320 : 940);
    }

    if (this.input.secondaryJustPressed) {
      this.triggerSuperzapper();
    }

    // Authentic T2K Hovering A.I. Droid Wingman inside the tube!
    if (this.hasDroid) {
      this.droidAngle += dt * 2.5;
      this.droidFireCd -= dt;
      if (this.droidFireCd <= 0 && this.enemies.length > 0) {
        this.droidFireCd = 0.34;
        const target = this.enemies[Math.floor(Math.random() * this.enemies.length)];
        this.droidLane = target.lane;
        this.shots.push({
          lane: target.lane,
          u: target.u,
          z: 0.04,
          fromPlayer: true,
          speed: 2.8,
          isParticleLaser: true,
        });
      }
    }

    // Spawner
    if (this.remainingToSpawn > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnEnemy();
        this.remainingToSpawn -= 1;
        this.spawnTimer = Math.max(0.3, 1.05 - this.level * 0.05);
      }
    }

    // Update Shots
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      if (s.fromPlayer) {
        s.z += s.speed * dt;
        if (s.z >= 1.04) {
          this.shots.splice(i, 1);
          continue;
        }
        const spikeTipZ = 1 - (this.spikes[s.lane] || 0);
        if (this.spikes[s.lane] > 0.02 && Math.abs(s.u - 0.5) < 0.38 && s.z >= spikeTipZ) {
          this.spikes[s.lane] = Math.max(0, this.spikes[s.lane] - (s.isParticleLaser ? 0.22 : 0.14));
          this.addScore(50, s.lane, 0.5, spikeTipZ, '#4ADE80');
          this.shots.splice(i, 1);
          continue;
        }
        let hit = false;
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const e = this.enemies[j];
          const uTol = e.kind === 'fuseball' ? 0.3 : 0.4;
          if (Math.abs(e.z - s.z) < 0.1 && matchesCellFiringSolution(this.tube, s.lane, s.u, e.lane, e.u, uTol)) {
            e.hp -= s.isParticleLaser ? 1.5 : 1;
            if (e.hp <= 0) {
              this.destroyEnemy(j);
            } else {
              const f = projectCellFrame(this.tube, e.lane, e.u, e.z, this.cam);
              this.spawnJaguarFountain(f.x, f.y, 45, 8);
              arcadeAudio.playPaddleBounce();
            }
            hit = true;
            break;
          }
        }
        if (hit) this.shots.splice(i, 1);
      } else {
        s.z -= s.speed * dt;
        if (s.z <= 0.025) {
          if (this.jumpHeight < 0.2 && matchesCellFiringSolution(this.tube, curLane, curSubU, s.lane, s.u, 0.42)) {
            this.shots.splice(i, 1);
            this.loseLife();
            return;
          }
          this.shots.splice(i, 1);
        }
      }
    }

    // Power-Up Capsules (sliding up lanes!)
    for (let i = this.capsules.length - 1; i >= 0; i--) {
      const c = this.capsules[i];
      c.z -= 0.4 * dt;
      if (c.z <= 0.04) {
        if (matchesCellFiringSolution(this.tube, curLane, curSubU, c.lane, c.u, 0.55)) {
          arcadeAudio.playSuperTransform();
          const f = projectCellFrame(this.tube, c.lane, c.u, 0, this.cam);
          this.spawnJaguarFountain(f.x, f.y, 180, 26);
          if (c.kind === 'laser') {
            this.hasParticleLaser = true;
            this.triggerCallout('PARTICLE LASER!', '#38BDF8');
          } else if (c.kind === 'jump') {
            this.hasJump = true;
            this.triggerCallout('JUMP THRUSTER!', '#4ADE80');
          } else if (c.kind === 'droid') {
            this.hasDroid = true;
            this.triggerCallout('A.I. DROID ONLINE!', '#F472B6');
          } else if (c.kind === 'zapper') {
            this.zapperUses = 2;
            this.triggerCallout('SUPERZAPPER RECHARGE!', '#FACC15');
          } else if (c.kind === 'warp') {
            this.warpTokens = Math.min(3, this.warpTokens + 1);
            this.triggerCallout(
              this.warpTokens >= 3 ? 'WARP READY! YES! YES!' : `WARP TOKEN ${this.warpTokens}/3!`,
              '#22D3EE'
            );
          } else {
            this.addScore(2000, c.lane, c.u, 0, '#FACC15');
            this.triggerCallout('2000 BONUS! YES!', '#FACC15');
          }
        }
        this.capsules.splice(i, 1);
      }
    }

    // Update Enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.kind === 'spiker') {
        e.u = 0.5;
        if (!e.retreating) {
          e.z -= e.speed * dt;
          this.spikes[e.lane] = Math.max(this.spikes[e.lane], 1 - e.z);
          if (e.z <= 0.24) e.retreating = true;
        } else {
          e.z += e.speed * 1.15 * dt;
          if (e.z >= 1.0) {
            this.enemies.splice(i, 1);
            continue;
          }
        }
      } else if (e.kind === 'fuseball') {
        e.u = e.railSide;
        if (e.z > 0.01) {
          const burst = Math.sin(this.clock * 8 + e.id) > -0.2 ? 1.3 : 0.25;
          e.z = Math.max(0, e.z - e.speed * burst * dt);
        } else {
          e.flipTimer -= dt;
          if (e.flipTimer <= 0) {
            e.flipTimer = 0.34;
            e.lane = wrapLaneIndex(this.tube, e.lane + shortestLaneStep(this.tube, e.lane, curLane));
          }
        }
      } else if (e.kind === 'pulsar') {
        e.u = 0.5;
        if (e.z > 0.08) e.z = Math.max(0.08, e.z - e.speed * 0.72 * dt);
        e.pulseTimer -= dt;
        if (e.pulseTimer <= 0) {
          e.pulsing = !e.pulsing;
          e.pulseTimer = e.pulsing ? 0.9 : 1.7;
        }
        if (e.pulsing) this.electrifiedLanes[e.lane] = 0.14;
      } else if (e.kind === 'tanker' || e.kind === 'fuseTanker') {
        e.u = 0.5;
        e.z = Math.max(0, e.z - e.speed * 0.82 * dt);
        if (e.z <= 0.04) {
          this.splitTanker(e);
          this.enemies.splice(i, 1);
          continue;
        }
      } else if (e.kind === 'demon') {
        // Demon Head hovers near rim menacingly, firing rapid energy bolts!
        e.u = 0.5 + Math.sin(this.clock * 4 + e.id) * 0.22;
        if (e.z > 0.12) {
          e.z = Math.max(0.12, e.z - e.speed * 0.65 * dt);
        } else {
          e.flipTimer -= dt;
          if (e.flipTimer <= 0) {
            e.flipTimer = 0.72;
            e.lane = wrapLaneIndex(this.tube, e.lane + shortestLaneStep(this.tube, e.lane, curLane));
          }
        }
      } else {
        // 3D Cartwheeling Flipper
        if (e.flipping) {
          e.flipProgress += dt * 4.1;
          if (e.flipProgress < 0.5) {
            e.u = e.flipDir > 0 ? 0.5 + e.flipProgress : 0.5 - e.flipProgress;
          } else if (e.flipProgress < 1.0) {
            e.lane = e.flipTargetLane;
            const p = e.flipProgress - 0.5;
            e.u = e.flipDir > 0 ? p : 1.0 - p;
          } else {
            e.lane = e.flipTargetLane;
            e.u = 0.5;
            e.flipping = false;
            e.flipProgress = 0;
          }
        } else if (e.z > 0.01) {
          e.z = Math.max(0, e.z - e.speed * dt);
          if (e.z < 0.72 && e.z > 0.12) {
            e.flipTimer -= dt;
            if (e.flipTimer <= 0) {
              e.flipTimer = 0.75 + Math.random() * 0.65;
              e.flipping = true;
              e.flipProgress = 0;
              e.flipTargetLane = wrapLaneIndex(this.tube, e.lane + e.flipDir);
            }
          }
        } else {
          e.flipTimer -= dt;
          if (e.flipTimer <= 0) {
            e.flipTimer = Math.max(0.22, 0.42 - this.level * 0.015);
            e.flipDir = shortestLaneStep(this.tube, e.lane, curLane);
            e.flipping = true;
            e.flipProgress = 0;
            e.flipTargetLane = wrapLaneIndex(this.tube, e.lane + e.flipDir);
          }
        }
      }

      e.fireCd -= dt;
      if (e.fireCd <= 0 && e.z > 0.14 && e.z < 0.86 && e.kind !== 'fuseball') {
        e.fireCd = e.kind === 'demon' ? 1.05 : 1.9 + Math.random() * 1.6;
        this.shots.push({
          lane: e.lane,
          u: e.u,
          z: e.z,
          fromPlayer: false,
          speed: 0.78 + this.level * 0.04,
          isParticleLaser: false,
        });
      }

      if (e.z <= 0.035 && this.jumpHeight < 0.22 && matchesCellFiringSolution(this.tube, curLane, curSubU, e.lane, e.u, 0.42)) {
        this.enemies.splice(i, 1);
        this.loseLife();
        return;
      }
    }

    // Electrified Pulsar check (Jumping lets you safely soar over an electrified lane!)
    if (this.electrifiedLanes[curLane] > 0 && this.jumpHeight < 0.2 && this.invulnTimer <= 0) {
      this.loseLife();
      return;
    }

    if (this.remainingToSpawn <= 0 && this.enemies.length === 0) {
      this.addScore(1500 + this.level * 300, curLane, 0.5, 0.25, '#4ADE80');
      this.triggerCallout('OUTTA HERE!', '#4ADE80');
      arcadeAudio.playStageClear();
      this.phase = 'STAGE_CLEAR';
      this.warpProgress = 0;
    }
  }

  private splitTanker(e: T2KEnemy): void {
    const childKind: T2KEnemyKind = e.kind === 'fuseTanker' ? 'fuseball' : 'flipper';
    for (const dir of [-1, 1] as const) {
      this.enemies.push({
        id: this.nextEnemyId++,
        kind: childKind,
        lane: wrapLaneIndex(this.tube, e.lane + dir),
        u: childKind === 'fuseball' ? (dir > 0 ? 0 : 1) : 0.5,
        z: e.z,
        hp: 1,
        maxHp: 1,
        speed: e.speed * 1.15,
        flipTimer: 0.4,
        flipDir: dir,
        flipping: false,
        flipProgress: 0,
        flipTargetLane: wrapLaneIndex(this.tube, e.lane + dir),
        retreating: false,
        fireCd: 1.4,
        pulseTimer: 1.5,
        pulsing: false,
        railSide: dir > 0 ? 0 : 1,
      });
    }
  }

  private destroyEnemy(idx: number): void {
    const e = this.enemies[idx];
    this.enemies.splice(idx, 1);
    const f = projectCellFrame(this.tube, e.lane, e.u, e.z, this.cam);
    const hue =
      e.kind === 'flipper' ? 345 : e.kind === 'demon' ? 12 : e.kind === 'spiker' ? 135 : e.kind === 'pulsar' ? 295 : 52;
    const pts = e.kind === 'demon' ? 1000 : e.kind === 'fuseball' ? 750 : e.kind === 'tanker' || e.kind === 'fuseTanker' ? 300 : 150;
    this.spawnJaguarFountain(f.x, f.y, hue, e.kind === 'demon' ? 38 : 22);
    arcadeAudio.playExplosion(e.kind === 'demon' || e.kind === 'tanker');
    this.addScore(pts, e.lane, e.u, e.z, `hsl(${hue}, 100%, 66%)`);
    if (e.kind === 'tanker' || e.kind === 'fuseTanker') this.splitTanker(e);

    // Tempest 2000 progressive Power-Up Capsule drop!
    if (Math.random() < 0.24) {
      let kind: T2KCapsule['kind'] = 'points';
      if (!this.hasParticleLaser) kind = 'laser';
      else if (!this.hasJump) kind = 'jump';
      else if (!this.hasDroid) kind = 'droid';
      else if (this.zapperUses < 2 && Math.random() < 0.45) kind = 'zapper';
      else if (this.warpTokens < 3 && Math.random() < 0.65) kind = 'warp';
      this.capsules.push({ lane: e.lane, u: 0.5, z: e.z, kind });
    }
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Update Jaguar Melt-O-Vision Offscreen Feedback Buffer (outward zoom + gravity melt drip!)
    const meltHue = (this.clock * 42 + this.level * 55) % 360;
    const mctx = this.meltBuffer.stepFeedback({
      zoom: 1.016,
      rotateRad: Math.sin(this.clock * 0.9) * 0.0025,
      driftX: Math.sin(this.clock * 2.1) * 0.65,
      driftY: 1.45, // Authentic Jaguar Melt-O-Vision downward liquid melt!
      decay: 0.89,
      tintColor: `hsl(${meltHue}, 95%, 52%)`,
      tintAlpha: 0.03,
    });

    const curLane = this.getCurrentLane();
    const curSubU = this.getCurrentSubCell();

    if (mctx) {
      const sx = this.meltBuffer.width / LOGICAL_W;
      const sy = this.meltBuffer.height / LOGICAL_H;
      mctx.save();
      mctx.scale(sx, sy);

      // Stamp pixel explosion fountains into Melt-O-Vision buffer so they drip & streak!
      for (const pf of this.fountains) {
        mctx.fillStyle = pf.color;
        mctx.fillRect(pf.x - pf.size * 0.5, pf.y - pf.size * 0.5, pf.size, pf.size);
      }

      // Stamp glowing shot streaks & active lane pulse into melt buffer
      for (const s of this.shots) {
        const f = projectCellFrame(this.tube, s.lane, s.u, s.z, this.cam);
        mctx.fillStyle = s.fromPlayer ? (s.isParticleLaser ? '#38BDF8' : '#FACC15') : '#FB7185';
        mctx.beginPath();
        mctx.arc(f.x, f.y, s.isParticleLaser ? 5 : 3.5, 0, Math.PI * 2);
        mctx.fill();
      }

      // Stamp bonus rings into Melt-O-Vision buffer during Warp Bonus Stage!
      if (this.inBonusTunnel) {
        for (const r of this.bonusRings) {
          if (r.z <= 0.05 || r.z > 2.6) continue;
          const sc = 1 / (0.28 + r.z * 1.15);
          mctx.strokeStyle = `hsl(${(r.hue + this.clock * 90) % 360}, 100%, 62%)`;
          mctx.lineWidth = Math.max(2, 6 * sc);
          mctx.beginPath();
          mctx.arc(CX + r.x * 260 * sc, CY + r.y * 260 * sc, 92 * sc, 0, Math.PI * 2);
          mctx.stroke();
        }
      }
      mctx.restore();
    }

    // 2. Deep Jaguar Psychedelic Plasma Void Backdrop
    const bg = ctx.createRadialGradient(CX, CY, 25, CX, CY, 460);
    bg.addColorStop(0, `hsla(${(meltHue + 200) % 360}, 78%, 16%, 1)`);
    bg.addColorStop(0.55, `hsla(${(meltHue + 255) % 360}, 65%, 8%, 1)`);
    bg.addColorStop(1, '#03030B');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // Composite the Jaguar Melt-O-Vision liquid neon feedback trail!
    this.meltBuffer.compositeTo(ctx, LOGICAL_W, LOGICAL_H, 0.9, 'lighter');

    // If inside the Tempest 2000 Bonus Ring Warp Stage, render the 3D tunnel directly!
    if (this.inBonusTunnel) {
      this.renderBonusTunnel(ctx);
      if (visualMode === 'crt') renderCrtOverlay(ctx, LOGICAL_W, LOGICAL_H);
      ctx.restore();
      return;
    }

    const baseHue = (this.level * 48 + this.clock * 28) % 360;
    const webColor = `hsl(${baseHue}, 95%, 60%)`;

    // 3. Authentic Tempest 2000 Solid Gouraud-Shaded 3D Web Panels!
    for (let i = 0; i < this.laneCount; i++) {
      const v0 = this.tube.vertices[i];
      const v1 = this.tube.vertices[(i + 1) % this.tube.vertices.length];
      const o0 = projectTubePoint(v0.x, v0.y, 0, this.cam);
      const o1 = projectTubePoint(v1.x, v1.y, 0, this.cam);
      const f0 = projectTubePoint(v0.x, v0.y, 1, this.cam);
      const f1 = projectTubePoint(v1.x, v1.y, 1, this.cam);

      const isActive = i === curLane;
      const isElec = this.electrifiedLanes[i] > 0;
      const panelHue = (baseHue + i * 11) % 360;

      const grad = ctx.createLinearGradient((o0.x + o1.x) * 0.5, (o0.y + o1.y) * 0.5, (f0.x + f1.x) * 0.5, (f0.y + f1.y) * 0.5);
      if (isElec) {
        grad.addColorStop(0, 'rgba(244, 114, 182, 0.65)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0.25)');
      } else if (isActive) {
        grad.addColorStop(0, `hsla(${(baseHue + 48) % 360}, 100%, 60%, 0.42)`);
        grad.addColorStop(1, `hsla(${(baseHue + 48) % 360}, 95%, 28%, 0.08)`);
      } else {
        grad.addColorStop(0, `hsla(${panelHue}, 82%, 44%, 0.24)`);
        grad.addColorStop(1, `hsla(${panelHue}, 75%, 16%, 0.04)`);
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(o0.x, o0.y);
      ctx.lineTo(o1.x, o1.y);
      ctx.lineTo(f1.x, f1.y);
      ctx.lineTo(f0.x, f0.y);
      ctx.closePath();
      ctx.fill();
    }

    // 4. Multi-depth neon rings + glowing lane rails
    for (const rz of [1.0, 0.65, 0.32, 0.0]) {
      ctx.save();
      ctx.strokeStyle = rz === 0 ? webColor : `hsla(${baseHue}, 90%, 66%, ${rz === 1 ? 0.5 : 0.22})`;
      ctx.lineWidth = rz === 0 ? 3.8 : 1.3;
      if (rz === 0) {
        ctx.shadowColor = webColor;
        ctx.shadowBlur = 16;
      }
      ctx.beginPath();
      this.tube.vertices.forEach((v, idx) => {
        const p = projectTubePoint(v.x, v.y, rz, this.cam);
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      if (this.tube.closed) ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    for (let i = 0; i < this.tube.vertices.length; i++) {
      const v = this.tube.vertices[i];
      const o = projectTubePoint(v.x, v.y, 0, this.cam);
      const f = projectTubePoint(v.x, v.y, 1, this.cam);
      const isLeft = i === curLane;
      const isRight = i === (curLane + 1) % this.tube.vertices.length;
      const isEdge = isLeft || isRight;
      const railAim = (isLeft && curSubU < 0.28) || (isRight && curSubU > 0.72);
      ctx.save();
      ctx.strokeStyle = railAim ? '#FFFFFF' : isEdge ? '#FACC15' : webColor;
      ctx.lineWidth = railAim ? 4.0 : isEdge ? 3.2 : 1.7;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = isEdge ? 14 : 5;
      ctx.beginPath();
      ctx.moveTo(f.x, f.y);
      ctx.lineTo(o.x, o.y);
      ctx.stroke();
      ctx.restore();
    }

    // Active 3D cell-space targeting laser guide along exact u = curSubU!
    if (this.phase === 'PLAYING' || this.phase === 'READY') {
      const n = projectCellFrame(this.tube, curLane, curSubU, 0.02, this.cam, this.jumpHeight);
      const far = projectCellFrame(this.tube, curLane, curSubU, 0.96, this.cam);
      ctx.save();
      ctx.strokeStyle = this.hasParticleLaser ? 'rgba(56, 189, 248, 0.34)' : 'rgba(250, 204, 21, 0.28)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(n.x, n.y);
      ctx.lineTo(far.x, far.y);
      ctx.stroke();
      ctx.restore();
    }

    // Spikes
    for (let i = 0; i < this.laneCount; i++) {
      const sp = this.spikes[i];
      if (sp <= 0.02) continue;
      const far = projectCellFrame(this.tube, i, 0.5, 1.0, this.cam);
      const tip = projectCellFrame(this.tube, i, 0.5, 1.0 - sp, this.cam);
      ctx.save();
      ctx.strokeStyle = '#4ADE80';
      ctx.lineWidth = 4.0;
      ctx.shadowColor = '#4ADE80';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(far.x, far.y);
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Glowing Tempest 2000 Power-Up Capsules (rotating 3D pills & rainbow Warp Tokens!)
    for (const c of this.capsules) {
      const f = projectCellFrame(this.tube, c.lane, c.u, c.z, this.cam);
      const sc = Math.max(0.35, f.scale);
      ctx.save();
      ctx.translate(f.x, f.y);
      if (c.kind === 'warp') {
        ctx.rotate(this.clock * 6);
        const col = `hsl(${(this.clock * 240) % 360}, 100%, 62%)`;
        ctx.strokeStyle = col;
        ctx.shadowColor = col;
        ctx.shadowBlur = 16;
        ctx.lineWidth = 3.5 * sc;
        ctx.beginPath();
        ctx.arc(0, 0, 14 * sc, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `900 ${Math.max(8, Math.round(10 * sc))}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('W', 0, 0.5);
      } else {
        const col =
          c.kind === 'laser'
            ? '#38BDF8'
            : c.kind === 'jump'
              ? '#4ADE80'
              : c.kind === 'droid'
                ? '#F472B6'
                : c.kind === 'zapper'
                  ? '#FACC15'
                  : '#A855F7';
        ctx.fillStyle = col;
        ctx.shadowColor = col;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.roundRect(-13 * sc, -8 * sc, 26 * sc, 16 * sc, 8 * sc);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#04060D';
        ctx.font = `900 ${Math.max(8, Math.round(10 * sc))}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(c.kind[0].toUpperCase(), 0, 0.5);
      }
      ctx.restore();
    }

    // 3D Solid-Shaded Enemies (drawn far-to-near!)
    const sorted = [...this.enemies].sort((a, b) => b.z - a.z);
    for (const e of sorted) {
      this.drawT2KEnemy(ctx, e);
    }

    // Shots (blazing Particle Laser ribbons!)
    for (const s of this.shots) {
      const f = projectCellFrame(this.tube, s.lane, s.u, s.z, this.cam);
      const tail = projectCellFrame(this.tube, s.lane, s.u, Math.max(0, Math.min(1, s.z - (s.fromPlayer ? 0.085 : -0.05))), this.cam);
      ctx.save();
      if (s.fromPlayer) {
        const col = s.isParticleLaser ? '#38BDF8' : '#FACC15';
        ctx.strokeStyle = col;
        ctx.lineWidth = Math.max(2, (s.isParticleLaser ? 5.2 : 3.8) * f.scale);
        ctx.shadowColor = col;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(tail.x, tail.y);
        ctx.lineTo(f.x, f.y);
        ctx.stroke();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = Math.max(1, 1.8 * f.scale);
        ctx.stroke();
      } else {
        ctx.translate(f.x, f.y);
        ctx.rotate(this.clock * 14);
        const r = Math.max(4, 7 * f.scale);
        ctx.strokeStyle = '#FB7185';
        ctx.shadowColor = '#FB7185';
        ctx.shadowBlur = 12;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(-r, 0);
        ctx.lineTo(r, 0);
        ctx.moveTo(0, -r);
        ctx.lineTo(0, r);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Pixel Explosion Fountains
    for (const pf of this.fountains) {
      ctx.fillStyle = pf.color;
      ctx.globalAlpha = Math.max(0, pf.life / pf.maxLife);
      ctx.fillRect(pf.x - pf.size * 0.5, pf.y - pf.size * 0.5, pf.size, pf.size);
    }
    ctx.globalAlpha = 1;

    // Hovering 3D Octahedron A.I. Droid
    if (this.hasDroid) {
      const df = projectCellFrame(this.tube, this.droidLane, 0.5, 0.28, this.cam);
      const dx = CX + (df.x - CX) * 0.65 + Math.cos(this.droidAngle) * 32;
      const dy = CY + (df.y - CY) * 0.65 + Math.sin(this.droidAngle) * 32;
      ctx.save();
      ctx.translate(dx, dy);
      ctx.rotate(this.clock * 5);
      ctx.fillStyle = 'rgba(244, 114, 182, 0.45)';
      ctx.strokeStyle = '#F472B6';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#F472B6';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(14, 0);
      ctx.lineTo(0, 14);
      ctx.lineTo(-14, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 3D Solid-Shaded Tempest 2000 Wedge Claw (with 3D Jump elevation & cell-space banking!)
    if (this.phase !== 'GAME_OVER') {
      const blink = this.invulnTimer > 0 && Math.floor(this.clock * 16) % 2 === 0;
      if (!blink) {
        this.drawT2K3DClaw(ctx, curLane, curSubU);
      }
    }

    // Superzapper Surge
    if (this.zapperFlash > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(244, 114, 182, ${this.zapperFlash * 0.4})`;
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
      ctx.restore();
    }

    renderParticlesAndPopups(ctx, this.particles, this.popups);

    // Iconic Floating Jaguar Voice Callout Banner!
    if (this.calloutTimer > 0 && this.calloutText) {
      const alpha = Math.min(1, this.calloutTimer * 1.4);
      const pop = 1 + (1 - alpha) * 0.2;
      ctx.save();
      ctx.translate(CX, 108);
      ctx.scale(pop, pop);
      ctx.globalAlpha = alpha;
      ctx.font = '900 28px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = this.calloutColor;
      ctx.shadowBlur = 22;
      ctx.fillStyle = this.calloutColor;
      ctx.fillText(this.calloutText, 0, 0);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.2;
      ctx.strokeText(this.calloutText, 0, 0);
      ctx.restore();
    }

    // Jaguar T2K Top HUD
    ctx.save();
    ctx.font = '800 14px "JetBrains Mono", monospace';
    ctx.fillStyle = '#FACC15';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${this.score.toLocaleString()}`, 22, 30);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#F472B6';
    ctx.fillText(`TEMPEST 2000 · LV ${this.level} · WARP ${this.warpTokens}/3`, CX, 30);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#38BDF8';
    ctx.fillText(
      [this.hasParticleLaser ? 'LASER' : '', this.hasJump ? 'JUMP' : '', this.hasDroid ? 'DROID' : '']
        .filter(Boolean)
        .join(' · ') || 'STANDARD',
      LOGICAL_W - 22,
      30
    );
    ctx.restore();

    if (this.phase === 'READY' || this.phase === 'STAGE_CLEAR') {
      ctx.save();
      ctx.fillStyle = 'rgba(10, 4, 24, 0.78)';
      ctx.fillRect(CX - 210, CY - 34, 420, 68);
      ctx.strokeStyle = '#F472B6';
      ctx.lineWidth = 2.4;
      ctx.strokeRect(CX - 210, CY - 34, 420, 68);
      ctx.font = '900 22px "Outfit", sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        this.phase === 'READY' ? `LEVEL ${this.level} · ${this.tube.name.toUpperCase()}` : 'HYPER-TUBE WARP!',
        CX,
        CY
      );
      ctx.restore();
    }

    if (visualMode === 'crt') renderCrtOverlay(ctx, LOGICAL_W, LOGICAL_H);
    ctx.restore();
  }

  private renderBonusTunnel(ctx: CanvasRenderingContext2D): void {
    // Draw psychedelic 3D ring corridor
    const sortedRings = [...this.bonusRings].sort((a, b) => b.z - a.z);
    for (const r of sortedRings) {
      if (r.z <= 0.04 || r.z > 3.2) continue;
      const sc = 1 / (0.28 + r.z * 1.15);
      const rx = CX + r.x * 260 * sc;
      const ry = CY + r.y * 260 * sc;
      const rad = 96 * sc;
      ctx.save();
      ctx.strokeStyle = `hsl(${(r.hue + this.clock * 120) % 360}, 100%, 62%)`;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 18;
      ctx.lineWidth = Math.max(2, 7 * sc);
      ctx.beginPath();
      ctx.arc(rx, ry, rad, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Player flying 3D Claw in Bonus Stage!
    const sx = CX + this.bonusShipX * 260;
    const sy = CY + this.bonusShipY * 260;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.fillStyle = '#FACC15';
    ctx.strokeStyle = '#FFFFFF';
    ctx.shadowColor = '#38BDF8';
    ctx.shadowBlur = 18;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(24, 14);
    ctx.lineTo(0, 6);
    ctx.lineTo(-24, 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.font = '900 18px "JetBrains Mono", monospace';
    ctx.fillStyle = '#22D3EE';
    ctx.textAlign = 'center';
    ctx.fillText(`JAGUAR WARP BONUS · RINGS: ${this.bonusRingsCleared} · ${Math.ceil(this.bonusTimer)}s`, CX, 38);
    ctx.restore();
  }

  private drawT2K3DClaw(ctx: CanvasRenderingContext2D, lane: number, u: number): void {
    const f = projectCellFrame(this.tube, lane, u, 0, this.cam, this.jumpHeight);
    const ground = projectCellFrame(this.tube, lane, u, 0, this.cam, 0);
    const bank = Math.max(-0.34, Math.min(0.34, this.angularVel * 0.036));
    const recoil = this.clawRecoil * 7;
    const halfSpan = Math.min(28, Math.max(16, f.width * 0.36));

    // Jump thruster shadow & blue plasma plume underneath when airborne!
    if (this.jumpHeight > 0.04) {
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(ground.x, ground.y);
      ctx.lineTo(f.x, f.y);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.inwardAngle + bank);
    ctx.translate(-recoil, 0);

    // Solid Gouraud-lit 3D Twin-Wing Jaguar Claw!
    ctx.shadowColor = this.hasParticleLaser ? '#38BDF8' : '#FACC15';
    ctx.shadowBlur = 18;

    // Left bevel facet (lit gold)
    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.moveTo(28, 0);
    ctx.lineTo(-4, -halfSpan);
    ctx.lineTo(-16, -halfSpan * 0.52);
    ctx.lineTo(-6, 0);
    ctx.closePath();
    ctx.fill();

    // Right bevel facet (deep amber-orange 3D shading)
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.moveTo(28, 0);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-16, halfSpan * 0.52);
    ctx.lineTo(-4, halfSpan);
    ctx.closePath();
    ctx.fill();

    // Crimson / Cyan Particle Cockpit spine
    ctx.fillStyle = this.hasParticleLaser ? '#38BDF8' : '#EF4444';
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(-4, -halfSpan * 0.35);
    ctx.lineTo(-10, 0);
    ctx.lineTo(-4, halfSpan * 0.35);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(28, 0);
    ctx.lineTo(-4, -halfSpan);
    ctx.lineTo(-16, -halfSpan * 0.52);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-16, halfSpan * 0.52);
    ctx.lineTo(-4, halfSpan);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  private drawT2KEnemy(ctx: CanvasRenderingContext2D, e: T2KEnemy): void {
    const f = projectCellFrame(this.tube, e.lane, e.u, e.z, this.cam);
    const sc = Math.max(0.3, f.scale);

    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.tangentAngle);

    if (e.kind === 'flipper') {
      const spin = e.flipping ? e.flipProgress * Math.PI * e.flipDir : Math.sin(this.clock * 7 + e.id) * 0.16;
      ctx.rotate(spin);
      const w = Math.max(9, f.width * 0.45);
      const h = 13 * sc;
      // 3D Gouraud faceted bowtie
      ctx.shadowColor = '#F43F5E';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#F43F5E';
      ctx.beginPath();
      ctx.moveTo(-w, -h);
      ctx.lineTo(0, 0);
      ctx.lineTo(-w, h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FB7185';
      ctx.beginPath();
      ctx.moveTo(w, -h);
      ctx.lineTo(0, 0);
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#FFF1F2';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    } else if (e.kind === 'tanker' || e.kind === 'fuseTanker') {
      const r = Math.max(10, f.width * 0.42);
      const col = e.kind === 'fuseTanker' ? '#F59E0B' : '#A855F7';
      ctx.shadowColor = col;
      ctx.shadowBlur = 15;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.fillStyle = e.kind === 'fuseTanker' ? '#FEF08A' : '#38BDF8';
      ctx.fillRect(-r * 0.32, -r * 0.32, r * 0.64, r * 0.64);
    } else if (e.kind === 'demon') {
      // Iconic Tempest 2000 Horned Crimson Demon Head!
      const r = Math.max(12, f.width * 0.48);
      ctx.shadowColor = '#EF4444';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#DC2626';
      ctx.beginPath();
      ctx.moveTo(-r, -r * 0.85); // Left horn
      ctx.lineTo(-r * 0.4, -r * 0.35);
      ctx.lineTo(0, -r * 0.6);
      ctx.lineTo(r * 0.4, -r * 0.35);
      ctx.lineTo(r, -r * 0.85); // Right horn
      ctx.lineTo(r * 0.72, r * 0.45);
      ctx.lineTo(0, r * 0.9);
      ctx.lineTo(-r * 0.72, r * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Glowing yellow demon eyes!
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(-r * 0.3, -r * 0.05, r * 0.16, 0, Math.PI * 2);
      ctx.arc(r * 0.3, -r * 0.05, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'spiker') {
      ctx.rotate(this.clock * 10);
      ctx.shadowColor = '#4ADE80';
      ctx.shadowBlur = 14;
      ctx.strokeStyle = '#4ADE80';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      for (let t = 0; t <= 16; t++) {
        const a = t * 0.6;
        const r = t * 0.95 * sc;
        if (t === 0) ctx.moveTo(0, 0);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.stroke();
    } else if (e.kind === 'pulsar') {
      const w = Math.max(10, f.width * 0.46);
      const amp = (e.pulsing ? 16 : 7) * sc;
      ctx.shadowColor = '#F472B6';
      ctx.shadowBlur = 18;
      ctx.strokeStyle = e.pulsing ? '#FFFFFF' : '#F472B6';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      for (let k = 0; k <= 6; k++) {
        const px = -w + (k / 6) * w * 2;
        const py = k % 2 === 0 ? -amp : amp;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    } else {
      // Side-rail Fuseball crackling plasma!
      ctx.rotate(this.clock * 14);
      const cols = ['#FACC15', '#F43F5E', '#38BDF8', '#4ADE80'];
      const r = Math.max(8, 16 * sc);
      ctx.shadowColor = '#FACC15';
      ctx.shadowBlur = 16;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        ctx.strokeStyle = cols[k % 4];
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a + 0.25) * r * 0.55, Math.sin(a + 0.25) * r * 0.55);
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.stroke();
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(2.5, 4.2 * sc), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  public getHudSnapshot(): ClassicGameHud {
    const upgrades: string[] = [];
    if (this.hasParticleLaser) upgrades.push('Laser');
    if (this.hasJump) upgrades.push('Jump');
    if (this.hasDroid) upgrades.push('Droid');
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: this.inBonusTunnel ? 'Tempest 2000 · Warp Bonus Tunnel' : `Tempest 2000 · ${this.tube.name}`,
      primaryMetricLabel: 'Superzapper',
      primaryMetricValue: this.zapperUses === 2 ? 'Full' : this.zapperUses === 1 ? '1× Left' : 'Spent',
      secondaryMetricLabel: 'Warp / Gear',
      secondaryMetricValue: `${this.warpTokens}/3 · ${upgrades.length ? upgrades.join('+') : 'Std'}`,
      bannerText: this.calloutTimer > 0 ? this.calloutText : '',
    };
  }
}

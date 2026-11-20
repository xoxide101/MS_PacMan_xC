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
  buildNuonPrismWebs,
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
// TEMPEST 3000 (2000 Nuon / Llamasoft — VLM-2 Prism Melt-O-Vision Engine)
// - Real-time offscreen Nuon VLM-2 Kaleidoscopic Prism Melt-O-Vision buffer
//   (radial zoom + spiral vortex twist + iridescent feedback trails!)
// - Morphing, gently twisting & breathing translucent Stained-Glass 3D webs!
// - Continuous 3D Cell-Space Crystalline Cyber-Claw (u in 0..1) + Jump & Air-Hover Glide!
// - Strategic Mirror Reflector enemies: deflect dead-center shots — slide Claw toward
//   a SIDE RAIL (u < 0.30 or u > 0.70) to flank them or shatter with Harmonic Prism Spread!
// - 3-Tier Weapon Progression (Twin Plasma -> Prism Laser -> Triple Harmonic Spread),
//   Dual Orbiting Crystal A.I. Droids, Demon Overlords, & Nuon Kaleidoscope Bonus Tunnel!
// ============================================================================

type T3KEnemyKind = 'flipper' | 'mirror' | 'tanker' | 'spiker' | 'fuseball' | 'pulsar' | 'overlord';

interface T3KEnemy {
  id: number;
  kind: T3KEnemyKind;
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

interface T3KShot {
  lane: number;
  u: number;
  z: number;
  fromPlayer: boolean;
  speed: number;
  tier: number; // 1 = Twin Plasma, 2 = Prism Laser, 3 = Harmonic Spread
}

interface T3KCapsule {
  lane: number;
  u: number;
  z: number;
  kind: 'weapon' | 'droid' | 'zapper' | 'glyph' | 'points';
}

interface PrismSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hue: number;
  life: number;
  maxLife: number;
}

interface PrismRing {
  x: number;
  y: number;
  z: number;
  sides: number;
  hue: number;
  passed: boolean;
}

const LOGICAL_W = 760;
const LOGICAL_H = 760;
const CX = LOGICAL_W * 0.5;
const CY = LOGICAL_H * 0.52;

const T3K_WEBS = buildNuonPrismWebs();

export class Tempest3000Game implements ArcadeGameInstance {
  public readonly logicalWidth = LOGICAL_W;
  public readonly logicalHeight = LOGICAL_H;
  public readonly supportsPointerAim = true;
  public readonly primaryActionLabel = 'Prism Blaster';
  public readonly secondaryActionLabel = 'Superzapper';

  private readonly storageKey = 'tempest3000_nuon_hd_highscore_v2';
  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();

  private score = 0;
  private highScore = 0;
  private nextExtraLife = 40000;
  private level = 1;
  private lives = 3;

  private clock = 0;
  private phaseTimer = 0;
  private zapperUses = 2;
  private zapperFlash = 0;

  // Continuous 3D cell-space steering + Jump & Air-Hover Glide!
  private lanePos = 0.5;
  private angularVel = 0;
  private clawRecoil = 0;
  private fireCd = 0;
  private jumpHeight = 0;
  private jumpVel = 0;
  private hoverFuel = 0;
  private invulnTimer = 0;

  // Nuon T3K Progressive Arsenal (starts with Jump + Twin Plasma, upgrades to Prism & Triple Spread!)
  private weaponTier = 1; // 1 = Twin Plasma, 2 = Prism Laser, 3 = Triple Harmonic Spread
  private droidCount = 0; // Up to 2 orbiting crystal droids
  private droidAngle = 0;
  private droidFireCd = 0;
  private warpGlyphs = 0;

  // Nuon VLM-2 Kaleidoscope Bonus Tunnel
  private inBonusTunnel = false;
  private bonusTimer = 0;
  private bonusShipX = 0;
  private bonusShipY = 0;
  private bonusRingsCleared = 0;
  private bonusRings: PrismRing[] = [];

  private calloutText = '';
  private calloutColor = '#22D3EE';
  private calloutTimer = 0;

  // Nuon VLM-2 Kaleidoscopic Prism Melt-O-Vision Buffer + Morphing 3D Camera
  private vlmBuffer = new MeltOVisionBuffer(380, 380);
  private cam: Camera3DState = createDefaultCamera(CX, CY, 296, 3.95);
  private warpProgress = 0;

  private tube: TubeWebDef = T3K_WEBS[0];
  private laneCount = 16;
  private spikes: number[] = [];
  private electrifiedLanes: number[] = [];
  private enemies: T3KEnemy[] = [];
  private remainingToSpawn = 0;
  private spawnTimer = 0;
  private nextEnemyId = 1;
  private shots: T3KShot[] = [];
  private capsules: T3KCapsule[] = [];
  private sparks: PrismSpark[] = [];
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
    this.calloutTimer = 1.65;
  }

  private spawnPrismBurst(x: number, y: number, hueBase: number, count = 26): void {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.25;
      const spd = 90 + Math.random() * 240;
      this.sparks.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        hue: (hueBase + i * 14) % 360,
        life: 0.42 + Math.random() * 0.42,
        maxLife: 0.84,
      });
    }
  }

  private loadStage(lvl: number): void {
    this.tube = T3K_WEBS[(lvl - 1) % T3K_WEBS.length];
    this.laneCount = getLaneCount(this.tube);
    this.lanePos = wrapContinuousLanePos(this.tube, Math.min(this.lanePos, this.laneCount - 0.5));
    this.spikes = new Array(this.laneCount).fill(0);
    this.electrifiedLanes = new Array(this.laneCount).fill(0);
    this.enemies = [];
    this.shots = [];
    this.capsules = [];
    this.zapperUses = 2;
    this.remainingToSpawn = 16 + lvl * 4;
    this.spawnTimer = 0.48;
    this.warpProgress = 0;
    this.cam.warpZoom = 0;
    this.jumpHeight = 0;
    this.jumpVel = 0;
    this.inBonusTunnel = false;
  }

  private startKaleidoscopeBonus(): void {
    this.inBonusTunnel = true;
    this.bonusTimer = 11.5;
    this.bonusShipX = 0;
    this.bonusShipY = 0;
    this.bonusRingsCleared = 0;
    this.bonusRings = [];
    for (let i = 0; i < 15; i++) {
      this.bonusRings.push({
        x: Math.sin(i * 0.85) * 0.56,
        y: Math.cos(i * 1.1) * 0.46,
        z: 0.45 + i * 0.32,
        sides: i % 2 === 0 ? 6 : 8,
        hue: (i * 28) % 360,
        passed: false,
      });
    }
    this.triggerCallout('VLM-2 PRISM WARP!', '#22D3EE');
    arcadeAudio.playSuperTransform();
  }

  public startNewGame(): void {
    this.score = 0;
    this.nextExtraLife = 40000;
    this.level = 1;
    this.lives = 3;
    this.weaponTier = 2; // Tempest 3000 launches fast with Prism Laser + Jump Hover!
    this.droidCount = 0;
    this.warpGlyphs = 0;
    this.sparks = [];
    this.particles = [];
    this.popups = [];
    this.vlmBuffer.clear();
    this.loadStage(1);
    this.lanePos = 0.5;
    this.invulnTimer = 1.6;
    this.phase = 'READY';
    this.phaseTimer = 1.0;
    this.triggerCallout('TEMPEST 3000 · NUON VLM-2', '#22D3EE');
    arcadeAudio.playArcadeStart();
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.vlmBuffer.clear();
    this.loadStage(1);
    this.phase = 'TITLE';
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  private addScore(pts: number, laneIdx?: number, u = 0.5, z = 0.2, color = '#22D3EE'): void {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(this.storageKey, this.highScore);
    }
    if (this.score >= this.nextExtraLife) {
      this.nextExtraLife += 40000;
      this.lives = Math.min(6, this.lives + 1);
      arcadeAudio.playExtraLife();
      this.triggerCallout('EXTRA CYBER-CLAW!', '#4ADE80');
    }
    if (laneIdx !== undefined) {
      const f = projectCellFrame(this.tube, laneIdx, u, z, this.cam);
      this.popups.push({ x: f.x, y: f.y - 10, text: `${pts}`, color, life: 0.78, maxLife: 0.78 });
    }
  }

  private triggerSuperzapper(): void {
    if (this.zapperUses <= 0) return;
    this.zapperFlash = 0.55;
    arcadeAudio.playSuperzapper();
    this.triggerCallout(this.zapperUses === 2 ? 'PRISM SUPERZAPPER!' : 'RESONANCE ZAP!', '#38BDF8');

    if (this.zapperUses === 2) {
      for (const e of this.enemies) {
        const f = projectCellFrame(this.tube, e.lane, e.u, e.z, this.cam);
        this.spawnPrismBurst(f.x, f.y, 190, 16);
        this.addScore(250, e.lane, e.u, e.z, '#22D3EE');
      }
      this.enemies = [];
      this.zapperUses = 1;
    } else {
      if (this.enemies.length > 0) {
        this.enemies.sort((a, b) => a.z - b.z);
        const e = this.enemies.shift()!;
        const f = projectCellFrame(this.tube, e.lane, e.u, e.z, this.cam);
        this.spawnPrismBurst(f.x, f.y, 310, 26);
        this.addScore(350, e.lane, e.u, e.z, '#F472B6');
      }
      this.zapperUses = 0;
    }
  }

  private spawnEnemy(): void {
    const lane = Math.floor(Math.random() * this.laneCount);
    const roll = Math.random();
    let kind: T3KEnemyKind = 'flipper';
    if (this.level >= 1 && roll < 0.17) kind = 'mirror';
    else if (this.level >= 2 && roll < 0.32) kind = 'tanker';
    else if (this.level >= 2 && roll < 0.46) kind = 'spiker';
    else if (this.level >= 2 && roll < 0.64) kind = 'fuseball';
    else if (this.level >= 3 && roll < 0.78) kind = 'pulsar';
    else if (this.level >= 3 && roll < 0.88) kind = 'overlord';

    const railSide: 0 | 1 = Math.random() > 0.5 ? 1 : 0;
    const hp = kind === 'overlord' ? 5 : kind === 'mirror' ? 2 : 1;

    this.enemies.push({
      id: this.nextEnemyId++,
      kind,
      lane,
      u: kind === 'fuseball' ? railSide : 0.5,
      z: 1.0,
      hp,
      maxHp: hp,
      speed: 0.25 + Math.min(0.32, this.level * 0.025) + (kind === 'fuseball' ? 0.12 : 0),
      flipTimer: 0.55 + Math.random() * 0.65,
      flipDir: Math.random() > 0.5 ? 1 : -1,
      flipping: false,
      flipProgress: 0,
      flipTargetLane: lane,
      retreating: false,
      fireCd: 1.25 + Math.random() * 1.5,
      pulseTimer: 1.25 + Math.random() * 1.1,
      pulsing: false,
      railSide,
    });
  }

  private loseLife(): void {
    if (this.invulnTimer > 0) return;
    const f = projectCellFrame(this.tube, this.getCurrentLane(), this.getCurrentSubCell(), 0, this.cam);
    this.spawnPrismBurst(f.x, f.y, 190, 46);
    spawnBurst(this.particles, f.x, f.y, '#22D3EE', 24, 270, 4);
    arcadeAudio.playExplosion(true);

    this.lives -= 1;
    this.weaponTier = Math.max(1, this.weaponTier - 1);
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

    // Signature Nuon Tempest 3000 fluid 3D banking + gentle corkscrew twist & organic web breathing!
    const targetYaw = vx * 0.62;
    const targetPitch = vy * 0.48;
    const targetRoll = -vx * 0.2 + Math.sin(this.clock * 0.55) * 0.08;
    this.cam.yaw += (targetYaw - this.cam.yaw) * Math.min(1, dt * 5.8);
    this.cam.pitch += (targetPitch - this.cam.pitch) * Math.min(1, dt * 5.8);
    this.cam.roll += (targetRoll - this.cam.roll) * Math.min(1, dt * 4.5);
    this.cam.twistPerZ = Math.sin(this.clock * 0.62) * 0.28;
    this.cam.breatheAmp = 0.045;
    this.cam.breathePhase = this.clock * 2.1;
    this.cam.warpZoom = this.phase === 'STAGE_CLEAR' && !this.inBonusTunnel ? this.warpProgress * 2.45 : 0;
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
      this.angularVel = Math.max(-18, Math.min(18, diff * 19));
      this.lanePos = targetPos;
      return;
    }

    const spinSpeed = 9.2;
    if (this.input.left && !this.input.right) {
      this.angularVel = Math.max(-spinSpeed, this.angularVel - 64 * dt);
    } else if (this.input.right && !this.input.left) {
      this.angularVel = Math.min(spinSpeed, this.angularVel + 64 * dt);
    } else {
      this.angularVel *= Math.pow(0.0003, dt);
      if (Math.abs(this.angularVel) < 0.08) this.angularVel = 0;
    }
    this.lanePos = wrapContinuousLanePos(this.tube, this.lanePos + this.angularVel * dt);
  }

  public step(dt: number): void {
    this.clock += dt;
    if (this.zapperFlash > 0) this.zapperFlash = Math.max(0, this.zapperFlash - dt);
    if (this.calloutTimer > 0) this.calloutTimer = Math.max(0, this.calloutTimer - dt);
    if (this.clawRecoil > 0) this.clawRecoil = Math.max(0, this.clawRecoil - dt * 9);
    stepParticlesAndPopups(this.particles, this.popups, dt);

    // Update radial prism sparks (zero-gravity crystalline drift into VLM-2 buffer!)
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const sp = this.sparks[i];
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.vx *= Math.pow(0.25, dt);
      sp.vy *= Math.pow(0.25, dt);
      sp.life -= dt;
      if (sp.life <= 0) this.sparks.splice(i, 1);
    }

    if (this.phase === 'TITLE') {
      this.lanePos = wrapContinuousLanePos(this.tube, this.lanePos + dt * 3.1);
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

    // NUON VLM-2 KALEIDOSCOPE BONUS TUNNEL!
    if (this.inBonusTunnel) {
      this.bonusTimer -= dt;
      if (this.input.pointerActive) {
        this.bonusShipX = Math.max(-0.85, Math.min(0.85, (this.input.pointerX - 0.5) * 1.9));
        this.bonusShipY = Math.max(-0.85, Math.min(0.85, (this.input.pointerY - 0.5) * 1.9));
      } else {
        if (this.input.left) this.bonusShipX -= 1.55 * dt;
        if (this.input.right) this.bonusShipX += 1.55 * dt;
        if (this.input.up) this.bonusShipY -= 1.55 * dt;
        if (this.input.down) this.bonusShipY += 1.55 * dt;
        this.bonusShipX = Math.max(-0.85, Math.min(0.85, this.bonusShipX));
        this.bonusShipY = Math.max(-0.85, Math.min(0.85, this.bonusShipY));
      }

      for (const r of this.bonusRings) {
        r.z -= 0.86 * dt;
        if (!r.passed && r.z <= 0.14) {
          r.passed = true;
          if (Math.hypot(this.bonusShipX - r.x, this.bonusShipY - r.y) < 0.36) {
            this.bonusRingsCleared += 1;
            this.addScore(1500);
            arcadeAudio.playCoin();
            this.spawnPrismBurst(CX + r.x * 260, CY + r.y * 260, r.hue, 22);
          }
        }
        if (r.z < -0.1) {
          r.z += 4.8;
          r.passed = false;
          r.x = Math.sin(this.clock * 1.9 + r.hue) * 0.55;
          r.y = Math.cos(this.clock * 1.4 + r.hue) * 0.45;
        }
      }

      if (this.bonusTimer <= 0) {
        const skip = this.bonusRingsCleared >= 8 ? 3 : 1;
        this.addScore(this.bonusRingsCleared * 750);
        this.triggerCallout(`PRISM BONUS! +${skip} LEVELS`, '#4ADE80');
        this.inBonusTunnel = false;
        this.level += skip;
        this.loadStage(this.level);
        this.phase = 'READY';
        this.phaseTimer = 0.95;
      }
      return;
    }

    if (this.phase === 'STAGE_CLEAR') {
      this.warpProgress += dt * 0.82;
      this.handleSteering(dt);
      this.updateCamera3D(dt);
      const curLane = this.getCurrentLane();
      const spikeLen = this.spikes[curLane] || 0;
      if (spikeLen > 0.1 && this.warpProgress > 1 - spikeLen - 0.1 && this.warpProgress < 1 - spikeLen + 0.09 && this.jumpHeight < 0.2) {
        if (this.input.fire || this.input.fireJustPressed) {
          this.spikes[curLane] = 0;
          this.addScore(250, curLane, 0.5, 0.15, '#22D3EE');
          arcadeAudio.playLaser(1280);
        } else {
          this.spikes[curLane] = 0;
          this.loseLife();
        }
      }
      if (this.warpProgress >= 1.15) {
        if (this.warpGlyphs >= 3) {
          this.warpGlyphs = 0;
          this.startKaleidoscopeBonus();
          return;
        }
        this.level += 1;
        this.loadStage(this.level);
        this.phase = 'READY';
        this.phaseTimer = 0.85;
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

    // Tempest 3000 Jump + Mid-Air Hover Glide!
    if (this.input.up && this.jumpHeight <= 0) {
      this.jumpVel = 3.7;
      this.hoverFuel = 0.45;
      arcadeAudio.playJumpBoing();
    }
    if (this.jumpHeight > 0 || this.jumpVel > 0) {
      // Holding UP near apex activates brief zero-G Hover Glide across cells!
      const hovering = this.input.up && this.jumpVel < 0.25 && this.hoverFuel > 0;
      if (hovering) {
        this.hoverFuel -= dt;
        this.jumpVel = Math.max(-0.4, this.jumpVel - 1.2 * dt);
      } else {
        this.jumpVel -= 7.6 * dt;
      }
      this.jumpHeight += this.jumpVel * dt;
      if (this.jumpHeight <= 0) {
        this.jumpHeight = 0;
        this.jumpVel = 0;
      }
    }

    // 3-Tier Nuon Weapon System (firing along exact sub-cell u + harmonic rail spread at Tier 3!)
    const rapidCd = this.weaponTier >= 3 ? 0.072 : this.weaponTier === 2 ? 0.088 : 0.125;
    if ((this.input.fire || this.input.fireJustPressed) && this.fireCd <= 0) {
      this.fireCd = rapidCd;
      this.clawRecoil = 1.0;
      this.shots.push({
        lane: curLane,
        u: curSubU,
        z: 0.03,
        fromPlayer: true,
        speed: 2.95,
        tier: this.weaponTier,
      });
      if (this.weaponTier >= 3) {
        // Triple Harmonic Prism Spread sweeps adjacent rails too!
        this.shots.push({
          lane: wrapLaneIndex(this.tube, curLane - 1),
          u: 0.85,
          z: 0.06,
          fromPlayer: true,
          speed: 2.85,
          tier: 2,
        });
        this.shots.push({
          lane: wrapLaneIndex(this.tube, curLane + 1),
          u: 0.15,
          z: 0.06,
          fromPlayer: true,
          speed: 2.85,
          tier: 2,
        });
      }
      arcadeAudio.playLaser(1160 + this.weaponTier * 140);
    }

    if (this.input.secondaryJustPressed) {
      this.triggerSuperzapper();
    }

    // Dual Orbiting Crystal A.I. Droid Squadron
    if (this.droidCount > 0) {
      this.droidAngle += dt * 2.8;
      this.droidFireCd -= dt;
      if (this.droidFireCd <= 0 && this.enemies.length > 0) {
        this.droidFireCd = this.droidCount >= 2 ? 0.22 : 0.38;
        const target = this.enemies[Math.floor(Math.random() * this.enemies.length)];
        // Droids intelligently flank Mirror enemies via their side rail!
        const aimU = target.kind === 'mirror' ? 0.12 : target.u;
        this.shots.push({
          lane: target.lane,
          u: aimU,
          z: 0.04,
          fromPlayer: true,
          speed: 3.0,
          tier: 2,
        });
      }
    }

    // Spawner
    if (this.remainingToSpawn > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnEnemy();
        this.remainingToSpawn -= 1;
        this.spawnTimer = Math.max(0.28, 0.98 - this.level * 0.048);
      }
    }

    // Update Shots (including Mirror Reflector deflection mechanic!)
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
          this.spikes[s.lane] = Math.max(0, this.spikes[s.lane] - 0.24);
          this.addScore(60, s.lane, 0.5, spikeTipZ, '#22D3EE');
          this.shots.splice(i, 1);
          continue;
        }
        let hit = false;
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const e = this.enemies[j];
          const uTol = e.kind === 'fuseball' ? 0.3 : 0.44;
          if (Math.abs(e.z - s.z) < 0.1 && matchesCellFiringSolution(this.tube, s.lane, s.u, e.lane, e.u, uTol)) {
            // MIRROR REFLECTOR: dead-center shot bounces right back unless flanked near a side rail or hit by Tier-3!
            if (e.kind === 'mirror' && Math.abs(s.u - 0.5) < 0.16 && s.tier < 3) {
              s.fromPlayer = false;
              s.speed = 1.15;
              const f = projectCellFrame(this.tube, e.lane, e.u, e.z, this.cam);
              this.spawnPrismBurst(f.x, f.y, 195, 8);
              arcadeAudio.playPaddleBounce();
              this.popups.push({ x: f.x, y: f.y - 12, text: 'DEFLECT! AIM RAIL!', color: '#E2E8F0', life: 0.7, maxLife: 0.7 });
              hit = false;
              break;
            }
            e.hp -= s.tier >= 2 ? 1.5 : 1;
            if (e.hp <= 0) {
              this.destroyEnemy(j);
            } else {
              const f = projectCellFrame(this.tube, e.lane, e.u, e.z, this.cam);
              this.spawnPrismBurst(f.x, f.y, 280, 10);
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

    // Nuon Prism Capsules
    for (let i = this.capsules.length - 1; i >= 0; i--) {
      const c = this.capsules[i];
      c.z -= 0.42 * dt;
      if (c.z <= 0.04) {
        if (matchesCellFiringSolution(this.tube, curLane, curSubU, c.lane, c.u, 0.55)) {
          arcadeAudio.playSuperTransform();
          const f = projectCellFrame(this.tube, c.lane, c.u, 0, this.cam);
          this.spawnPrismBurst(f.x, f.y, 185, 30);
          if (c.kind === 'weapon') {
            this.weaponTier = Math.min(3, this.weaponTier + 1);
            this.triggerCallout(this.weaponTier >= 3 ? 'TRIPLE PRISM SPREAD!' : 'PRISM LASER!', '#22D3EE');
          } else if (c.kind === 'droid') {
            this.droidCount = Math.min(2, this.droidCount + 1);
            this.triggerCallout(this.droidCount >= 2 ? 'DUAL CRYSTAL DROIDS!' : 'CRYSTAL DROID!', '#F472B6');
          } else if (c.kind === 'zapper') {
            this.zapperUses = 2;
            this.triggerCallout('ZAPPER RECHARGED!', '#FACC15');
          } else if (c.kind === 'glyph') {
            this.warpGlyphs = Math.min(3, this.warpGlyphs + 1);
            this.triggerCallout(
              this.warpGlyphs >= 3 ? 'VLM-2 WARP UNLOCKED!' : `PRISM GLYPH ${this.warpGlyphs}/3`,
              '#A855F7'
            );
          } else {
            this.addScore(3000, c.lane, c.u, 0, '#FACC15');
            this.triggerCallout('3000 PRISM BONUS!', '#FACC15');
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
          const burst = Math.sin(this.clock * 9 + e.id) > -0.2 ? 1.35 : 0.25;
          e.z = Math.max(0, e.z - e.speed * burst * dt);
        } else {
          e.flipTimer -= dt;
          if (e.flipTimer <= 0) {
            e.flipTimer = 0.32;
            e.lane = wrapLaneIndex(this.tube, e.lane + shortestLaneStep(this.tube, e.lane, curLane));
          }
        }
      } else if (e.kind === 'pulsar') {
        e.u = 0.5;
        if (e.z > 0.08) e.z = Math.max(0.08, e.z - e.speed * 0.72 * dt);
        e.pulseTimer -= dt;
        if (e.pulseTimer <= 0) {
          e.pulsing = !e.pulsing;
          e.pulseTimer = e.pulsing ? 0.9 : 1.65;
        }
        if (e.pulsing) this.electrifiedLanes[e.lane] = 0.14;
      } else if (e.kind === 'mirror') {
        e.u = 0.5;
        e.z = Math.max(0, e.z - e.speed * 0.78 * dt);
      } else if (e.kind === 'tanker') {
        e.u = 0.5;
        e.z = Math.max(0, e.z - e.speed * 0.82 * dt);
        if (e.z <= 0.04) {
          this.splitTanker(e);
          this.enemies.splice(i, 1);
          continue;
        }
      } else if (e.kind === 'overlord') {
        e.u = 0.5 + Math.sin(this.clock * 4.5 + e.id) * 0.28;
        if (e.z > 0.14) {
          e.z = Math.max(0.14, e.z - e.speed * 0.62 * dt);
        } else {
          e.flipTimer -= dt;
          if (e.flipTimer <= 0) {
            e.flipTimer = 0.68;
            e.lane = wrapLaneIndex(this.tube, e.lane + shortestLaneStep(this.tube, e.lane, curLane));
          }
        }
      } else {
        if (e.flipping) {
          e.flipProgress += dt * 4.4;
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
              e.flipTimer = 0.7 + Math.random() * 0.65;
              e.flipping = true;
              e.flipProgress = 0;
              e.flipTargetLane = wrapLaneIndex(this.tube, e.lane + e.flipDir);
            }
          }
        } else {
          e.flipTimer -= dt;
          if (e.flipTimer <= 0) {
            e.flipTimer = Math.max(0.2, 0.38 - this.level * 0.014);
            e.flipDir = shortestLaneStep(this.tube, e.lane, curLane);
            e.flipping = true;
            e.flipProgress = 0;
            e.flipTargetLane = wrapLaneIndex(this.tube, e.lane + e.flipDir);
          }
        }
      }

      e.fireCd -= dt;
      if (e.fireCd <= 0 && e.z > 0.14 && e.z < 0.86 && e.kind !== 'fuseball') {
        e.fireCd = e.kind === 'overlord' ? 0.98 : 1.85 + Math.random() * 1.5;
        this.shots.push({
          lane: e.lane,
          u: e.u,
          z: e.z,
          fromPlayer: false,
          speed: 0.82 + this.level * 0.04,
          tier: 1,
        });
      }

      if (e.z <= 0.035 && this.jumpHeight < 0.22 && matchesCellFiringSolution(this.tube, curLane, curSubU, e.lane, e.u, 0.42)) {
        this.enemies.splice(i, 1);
        this.loseLife();
        return;
      }
    }

    if (this.electrifiedLanes[curLane] > 0 && this.jumpHeight < 0.2 && this.invulnTimer <= 0) {
      this.loseLife();
      return;
    }

    if (this.remainingToSpawn <= 0 && this.enemies.length === 0) {
      this.addScore(2000 + this.level * 350, curLane, 0.5, 0.25, '#22D3EE');
      this.triggerCallout('HYPER-PRISM WARP!', '#22D3EE');
      arcadeAudio.playStageClear();
      this.phase = 'STAGE_CLEAR';
      this.warpProgress = 0;
    }
  }

  private splitTanker(e: T3KEnemy): void {
    for (const dir of [-1, 1] as const) {
      this.enemies.push({
        id: this.nextEnemyId++,
        kind: 'flipper',
        lane: wrapLaneIndex(this.tube, e.lane + dir),
        u: 0.5,
        z: e.z,
        hp: 1,
        maxHp: 1,
        speed: e.speed * 1.18,
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
      e.kind === 'mirror' ? 192 : e.kind === 'overlord' ? 320 : e.kind === 'spiker' ? 145 : e.kind === 'pulsar' ? 275 : 42;
    const pts = e.kind === 'overlord' ? 1500 : e.kind === 'mirror' ? 600 : e.kind === 'fuseball' ? 850 : 200;
    this.spawnPrismBurst(f.x, f.y, hue, e.kind === 'overlord' ? 42 : 24);
    arcadeAudio.playExplosion(e.kind === 'overlord' || e.kind === 'mirror');
    this.addScore(pts, e.lane, e.u, e.z, `hsl(${hue}, 100%, 68%)`);
    if (e.kind === 'tanker') this.splitTanker(e);

    if (Math.random() < 0.27) {
      let kind: T3KCapsule['kind'] = 'points';
      if (this.weaponTier < 3) kind = 'weapon';
      else if (this.droidCount < 2) kind = 'droid';
      else if (this.zapperUses < 2 && Math.random() < 0.45) kind = 'zapper';
      else if (this.warpGlyphs < 3 && Math.random() < 0.7) kind = 'glyph';
      this.capsules.push({ lane: e.lane, u: 0.5, z: e.z, kind });
    }
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Advance Nuon VLM-2 Kaleidoscopic Prism Melt-O-Vision Feedback Buffer!
    // Distinct from Jaguar T2K: spirals subtly with radial kaleidoscope bloom instead of downward drip!
    const vlmHue = (this.clock * 56 + this.level * 64) % 360;
    const mctx = this.vlmBuffer.stepFeedback({
      zoom: 1.024,
      rotateRad: Math.sin(this.clock * 0.65) * 0.013, // Signature VLM-2 liquid prism spiral!
      driftX: Math.cos(this.clock * 1.4) * 0.5,
      driftY: Math.sin(this.clock * 1.4) * 0.5,
      decay: 0.91,
      tintColor: `hsl(${(vlmHue + 120) % 360}, 95%, 54%)`,
      tintAlpha: 0.032,
    });

    const curLane = this.getCurrentLane();
    const curSubU = this.getCurrentSubCell();

    if (mctx) {
      const sx = this.vlmBuffer.width / LOGICAL_W;
      const sy = this.vlmBuffer.height / LOGICAL_H;
      mctx.save();
      mctx.scale(sx, sy);

      // Stamp crystalline sparks & Cyber-Claw wing thruster ribbons into VLM-2 feedback buffer!
      for (const sp of this.sparks) {
        mctx.strokeStyle = `hsl(${sp.hue}, 100%, 66%)`;
        mctx.lineWidth = 3;
        mctx.beginPath();
        mctx.moveTo(sp.x, sp.y);
        mctx.lineTo(sp.x - sp.vx * 0.04, sp.y - sp.vy * 0.04);
        mctx.stroke();
      }

      // Stamp player Cyber-Claw iridescent trail into VLM-2
      if (this.phase === 'PLAYING') {
        const cf = projectCellFrame(this.tube, curLane, curSubU, 0, this.cam, this.jumpHeight);
        mctx.fillStyle = `hsl(${vlmHue}, 100%, 68%)`;
        mctx.beginPath();
        mctx.arc(cf.x, cf.y, 7, 0, Math.PI * 2);
        mctx.fill();
      }

      // Stamp plasma beams into VLM-2
      for (const s of this.shots) {
        const f = projectCellFrame(this.tube, s.lane, s.u, s.z, this.cam);
        mctx.fillStyle = s.fromPlayer ? `hsl(${(vlmHue + s.tier * 45) % 360}, 100%, 66%)` : '#FB7185';
        mctx.beginPath();
        mctx.arc(f.x, f.y, s.fromPlayer ? 5.5 : 4, 0, Math.PI * 2);
        mctx.fill();
      }

      // Stamp Kaleidoscope Bonus polygons into VLM-2
      if (this.inBonusTunnel) {
        for (const r of this.bonusRings) {
          if (r.z <= 0.05 || r.z > 2.8) continue;
          const sc = 1 / (0.28 + r.z * 1.15);
          this.strokeRegularPoly(
            mctx,
            CX + r.x * 260 * sc,
            CY + r.y * 260 * sc,
            96 * sc,
            r.sides,
            this.clock * 1.2 + r.z,
            `hsl(${(r.hue + this.clock * 120) % 360}, 100%, 66%)`,
            Math.max(2, 6 * sc)
          );
        }
      }
      mctx.restore();
    }

    // 2. Iridescent Deep Space Nuon Aura Backdrop
    const bg = ctx.createRadialGradient(CX, CY, 18, CX, CY, 470);
    bg.addColorStop(0, `hsla(${vlmHue}, 80%, 18%, 1)`);
    bg.addColorStop(0.5, `hsla(${(vlmHue + 75) % 360}, 70%, 9%, 1)`);
    bg.addColorStop(1, '#02020A');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // Composite VLM-2 Kaleidoscopic Melt-O-Vision Layer!
    this.vlmBuffer.compositeTo(ctx, LOGICAL_W, LOGICAL_H, 0.92, 'lighter');

    if (this.inBonusTunnel) {
      this.renderKaleidoscopeBonus(ctx);
      if (visualMode === 'crt') renderCrtOverlay(ctx, LOGICAL_W, LOGICAL_H);
      ctx.restore();
      return;
    }

    const baseHue = (this.tube.accentHue + this.clock * 36) % 360;
    const webColor = `hsl(${baseHue}, 98%, 64%)`;

    // 3. Signature Tempest 3000 Translucent Stained-Glass Iridescent 3D Facets!
    for (let i = 0; i < this.laneCount; i++) {
      const v0 = this.tube.vertices[i];
      const v1 = this.tube.vertices[(i + 1) % this.tube.vertices.length];
      const o0 = projectTubePoint(v0.x, v0.y, 0, this.cam);
      const o1 = projectTubePoint(v1.x, v1.y, 0, this.cam);
      const f0 = projectTubePoint(v0.x, v0.y, 1, this.cam);
      const f1 = projectTubePoint(v1.x, v1.y, 1, this.cam);

      const isActive = i === curLane;
      const isElec = this.electrifiedLanes[i] > 0;
      const glassHue = (baseHue + i * 22) % 360;

      const grad = ctx.createLinearGradient(o0.x, o0.y, f1.x, f1.y);
      if (isElec) {
        grad.addColorStop(0, 'rgba(192, 132, 252, 0.72)');
        grad.addColorStop(1, 'rgba(34, 211, 238, 0.3)');
      } else if (isActive) {
        grad.addColorStop(0, `hsla(${(baseHue + 160) % 360}, 100%, 66%, 0.44)`);
        grad.addColorStop(0.5, `hsla(${(baseHue + 90) % 360}, 95%, 52%, 0.22)`);
        grad.addColorStop(1, `hsla(${baseHue}, 90%, 30%, 0.08)`);
      } else {
        grad.addColorStop(0, `hsla(${glassHue}, 92%, 58%, 0.2)`);
        grad.addColorStop(0.6, `hsla(${(glassHue + 45) % 360}, 85%, 38%, 0.11)`);
        grad.addColorStop(1, `hsla(${(glassHue + 90) % 360}, 80%, 20%, 0.04)`);
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

    // 4. Shimmering Prismatic Depth Rings & Holographic Lane Rails
    for (const rz of [1.0, 0.72, 0.44, 0.2, 0.0]) {
      ctx.save();
      ctx.strokeStyle = rz === 0 ? webColor : `hsla(${(baseHue + rz * 80) % 360}, 95%, 70%, ${rz === 1 ? 0.55 : 0.26})`;
      ctx.lineWidth = rz === 0 ? 4.0 : 1.3;
      if (rz === 0) {
        ctx.shadowColor = webColor;
        ctx.shadowBlur = 18;
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
      ctx.strokeStyle = railAim ? '#FFFFFF' : isEdge ? '#22D3EE' : `hsla(${(baseHue + i * 18) % 360}, 95%, 64%, 0.85)`;
      ctx.lineWidth = railAim ? 4.2 : isEdge ? 3.2 : 1.7;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = isEdge ? 16 : 6;
      ctx.beginPath();
      ctx.moveTo(f.x, f.y);
      ctx.lineTo(o.x, o.y);
      ctx.stroke();
      ctx.restore();
    }

    // Translucent Holographic Prism Firing Solution Beam along exact u = curSubU!
    if (this.phase === 'PLAYING' || this.phase === 'READY') {
      const n = projectCellFrame(this.tube, curLane, curSubU, 0.02, this.cam, this.jumpHeight);
      const far = projectCellFrame(this.tube, curLane, curSubU, 0.96, this.cam);
      ctx.save();
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.42)';
      ctx.lineWidth = 2.0;
      ctx.setLineDash([10, 6]);
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
      ctx.strokeStyle = '#34D399';
      ctx.lineWidth = 4.2;
      ctx.shadowColor = '#34D399';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.moveTo(far.x, far.y);
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Nuon Prism Capsules & Glyphs
    for (const c of this.capsules) {
      const f = projectCellFrame(this.tube, c.lane, c.u, c.z, this.cam);
      const sc = Math.max(0.35, f.scale);
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(this.clock * 4);
      const col =
        c.kind === 'weapon'
          ? '#22D3EE'
          : c.kind === 'droid'
            ? '#F472B6'
            : c.kind === 'glyph'
              ? `hsl(${(this.clock * 260) % 360}, 100%, 66%)`
              : '#FACC15';
      this.strokeRegularPoly(ctx, 0, 0, 14 * sc, c.kind === 'glyph' ? 6 : 4, 0, col, 3 * sc);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `900 ${Math.max(8, Math.round(10 * sc))}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.rotate(-this.clock * 4);
      ctx.fillText(c.kind[0].toUpperCase(), 0, 0.5);
      ctx.restore();
    }

    // 3D Crystalline Enemies far-to-near
    const sorted = [...this.enemies].sort((a, b) => b.z - a.z);
    for (const e of sorted) {
      this.drawT3KEnemy(ctx, e);
    }

    // Harmonic Prism Beams
    for (const s of this.shots) {
      const f = projectCellFrame(this.tube, s.lane, s.u, s.z, this.cam);
      const tail = projectCellFrame(this.tube, s.lane, s.u, Math.max(0, Math.min(1, s.z - (s.fromPlayer ? 0.1 : -0.05))), this.cam);
      ctx.save();
      if (s.fromPlayer) {
        const col = s.tier >= 3 ? '#F472B6' : s.tier === 2 ? '#22D3EE' : '#FACC15';
        ctx.strokeStyle = col;
        ctx.lineWidth = Math.max(2, (s.tier >= 3 ? 6 : 4.5) * f.scale);
        ctx.shadowColor = col;
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.moveTo(tail.x, tail.y);
        ctx.lineTo(f.x, f.y);
        ctx.stroke();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = Math.max(1.2, 2.2 * f.scale);
        ctx.stroke();
      } else {
        ctx.translate(f.x, f.y);
        ctx.rotate(this.clock * 15);
        const r = Math.max(4, 7.5 * f.scale);
        ctx.strokeStyle = '#FB7185';
        ctx.shadowColor = '#FB7185';
        ctx.shadowBlur = 14;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(-r, -r * 0.5);
        ctx.lineTo(r, r * 0.5);
        ctx.moveTo(r, -r * 0.5);
        ctx.lineTo(-r, r * 0.5);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Dual Orbiting Crystal A.I. Droids
    for (let d = 0; d < this.droidCount; d++) {
      const a = this.droidAngle + d * Math.PI;
      const dx = CX + Math.cos(a) * 140;
      const dy = CY + Math.sin(a) * 140;
      ctx.save();
      ctx.translate(dx, dy);
      ctx.rotate(this.clock * 6);
      this.strokeRegularPoly(ctx, 0, 0, 13, 6, 0, '#22D3EE', 2.4);
      ctx.fillStyle = 'rgba(244, 114, 182, 0.4)';
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(0, 0, 3.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Sleek Crystalline Nuon Cyber-Claw!
    if (this.phase !== 'GAME_OVER') {
      const blink = this.invulnTimer > 0 && Math.floor(this.clock * 16) % 2 === 0;
      if (!blink) {
        this.drawT3KCyberClaw(ctx, curLane, curSubU, vlmHue);
      }
    }

    if (this.zapperFlash > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(34, 211, 238, ${this.zapperFlash * 0.42})`;
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
      ctx.restore();
    }

    renderParticlesAndPopups(ctx, this.particles, this.popups);

    if (this.calloutTimer > 0 && this.calloutText) {
      const alpha = Math.min(1, this.calloutTimer * 1.4);
      ctx.save();
      ctx.translate(CX, 108);
      ctx.globalAlpha = alpha;
      ctx.font = '900 26px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = this.calloutColor;
      ctx.shadowBlur = 24;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(this.calloutText, 0, 0);
      ctx.restore();
    }

    // Nuon Top HUD
    ctx.save();
    ctx.font = '800 14px "JetBrains Mono", monospace';
    ctx.fillStyle = '#22D3EE';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${this.score.toLocaleString()}`, 22, 30);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#E879F9';
    ctx.fillText(`TEMPEST 3000 · LV ${this.level} · GLYPHS ${this.warpGlyphs}/3`, CX, 30);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#FACC15';
    const wLabel = this.weaponTier >= 3 ? 'TRIPLE PRISM' : this.weaponTier === 2 ? 'PRISM LASER' : 'TWIN PLASMA';
    ctx.fillText(`${wLabel} · DROID×${this.droidCount}`, LOGICAL_W - 22, 30);
    ctx.restore();

    if (this.phase === 'READY' || this.phase === 'STAGE_CLEAR') {
      ctx.save();
      ctx.fillStyle = 'rgba(6, 4, 22, 0.8)';
      ctx.fillRect(CX - 220, CY - 34, 440, 68);
      ctx.strokeStyle = '#22D3EE';
      ctx.lineWidth = 2.4;
      ctx.strokeRect(CX - 220, CY - 34, 440, 68);
      ctx.font = '900 22px "Outfit", sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        this.phase === 'READY' ? `LEVEL ${this.level} · ${this.tube.name.toUpperCase()}` : 'HYPER-PRISM WARP!',
        CX,
        CY
      );
      ctx.restore();
    }

    if (visualMode === 'crt') renderCrtOverlay(ctx, LOGICAL_W, LOGICAL_H);
    ctx.restore();
  }

  private strokeRegularPoly(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    rad: number,
    sides: number,
    rot: number,
    color: string,
    lineWidth: number
  ): void {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    for (let i = 0; i <= sides; i++) {
      const a = rot + (i / sides) * Math.PI * 2;
      const px = x + Math.cos(a) * rad;
      const py = y + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  private renderKaleidoscopeBonus(ctx: CanvasRenderingContext2D): void {
    const sorted = [...this.bonusRings].sort((a, b) => b.z - a.z);
    for (const r of sorted) {
      if (r.z <= 0.04 || r.z > 3.2) continue;
      const sc = 1 / (0.28 + r.z * 1.15);
      this.strokeRegularPoly(
        ctx,
        CX + r.x * 260 * sc,
        CY + r.y * 260 * sc,
        102 * sc,
        r.sides,
        this.clock * 1.4 + r.z * 1.2,
        `hsl(${(r.hue + this.clock * 150) % 360}, 100%, 66%)`,
        Math.max(2, 6.5 * sc)
      );
    }

    const sx = CX + this.bonusShipX * 260;
    const sy = CY + this.bonusShipY * 260;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.fillStyle = '#22D3EE';
    ctx.strokeStyle = '#FFFFFF';
    ctx.shadowColor = '#F472B6';
    ctx.shadowBlur = 20;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(26, 12);
    ctx.lineTo(0, 4);
    ctx.lineTo(-26, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.font = '900 18px "JetBrains Mono", monospace';
    ctx.fillStyle = '#E879F9';
    ctx.textAlign = 'center';
    ctx.fillText(`NUON VLM-2 PRISM TUNNEL · GATES: ${this.bonusRingsCleared} · ${Math.ceil(this.bonusTimer)}s`, CX, 38);
    ctx.restore();
  }

  private drawT3KCyberClaw(ctx: CanvasRenderingContext2D, lane: number, u: number, hue: number): void {
    const f = projectCellFrame(this.tube, lane, u, 0, this.cam, this.jumpHeight);
    const ground = projectCellFrame(this.tube, lane, u, 0, this.cam, 0);
    const bank = Math.max(-0.38, Math.min(0.38, this.angularVel * 0.04));
    const recoil = this.clawRecoil * 7;
    const halfSpan = Math.min(30, Math.max(17, f.width * 0.38));

    if (this.jumpHeight > 0.04) {
      ctx.save();
      ctx.strokeStyle = 'rgba(232, 121, 249, 0.65)';
      ctx.lineWidth = 3.5;
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

    // Iridescent Crystalline Nuon Multi-Wing Craft!
    ctx.shadowColor = '#22D3EE';
    ctx.shadowBlur = 20;

    // Swept crystalline wings
    ctx.fillStyle = `hsla(${(hue + 180) % 360}, 95%, 62%, 0.85)`;
    ctx.beginPath();
    ctx.moveTo(30, 0);
    ctx.lineTo(2, -halfSpan * 0.65);
    ctx.lineTo(-10, -halfSpan);
    ctx.lineTo(-18, -halfSpan * 0.42);
    ctx.lineTo(-7, 0);
    ctx.lineTo(-18, halfSpan * 0.42);
    ctx.lineTo(-10, halfSpan);
    ctx.lineTo(2, halfSpan * 0.65);
    ctx.closePath();
    ctx.fill();

    // Specular silver-cyan canopy ridge
    ctx.fillStyle = '#E0F2FE';
    ctx.beginPath();
    ctx.moveTo(26, 0);
    ctx.lineTo(-6, -halfSpan * 0.28);
    ctx.lineTo(-12, 0);
    ctx.lineTo(-6, halfSpan * 0.28);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.restore();
  }

  private drawT3KEnemy(ctx: CanvasRenderingContext2D, e: T3KEnemy): void {
    const f = projectCellFrame(this.tube, e.lane, e.u, e.z, this.cam);
    const sc = Math.max(0.3, f.scale);

    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.tangentAngle);

    if (e.kind === 'mirror') {
      // Signature Tempest 3000 Chrome-Mirror Shield (deflects center shots — flank near side rail!)
      const w = Math.max(11, f.width * 0.46);
      const h = 15 * sc;
      const g = ctx.createLinearGradient(-w, -h, w, h);
      g.addColorStop(0, '#FFFFFF');
      g.addColorStop(0.5, '#38BDF8');
      g.addColorStop(1, '#E2E8F0');
      ctx.shadowColor = '#FFFFFF';
      ctx.shadowBlur = 16;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-w, 0);
      ctx.lineTo(-w * 0.5, -h);
      ctx.lineTo(w * 0.5, -h);
      ctx.lineTo(w, 0);
      ctx.lineTo(w * 0.5, h);
      ctx.lineTo(-w * 0.5, h);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (e.kind === 'overlord') {
      const r = Math.max(13, f.width * 0.5);
      ctx.shadowColor = '#F472B6';
      ctx.shadowBlur = 20;
      ctx.fillStyle = '#A21CAF';
      ctx.beginPath();
      ctx.moveTo(-r, -r * 0.9);
      ctx.lineTo(-r * 0.35, -r * 0.35);
      ctx.lineTo(0, -r * 0.72);
      ctx.lineTo(r * 0.35, -r * 0.35);
      ctx.lineTo(r, -r * 0.9);
      ctx.lineTo(r * 0.78, r * 0.5);
      ctx.lineTo(0, r);
      ctx.lineTo(-r * 0.78, r * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#22D3EE';
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-r * 0.32, 0, r * 0.16, 0, Math.PI * 2);
      ctx.arc(r * 0.32, 0, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'flipper') {
      const spin = e.flipping ? e.flipProgress * Math.PI * e.flipDir : Math.sin(this.clock * 8 + e.id) * 0.18;
      ctx.rotate(spin);
      const w = Math.max(10, f.width * 0.45);
      const h = 13 * sc;
      ctx.shadowColor = '#EC4899';
      ctx.shadowBlur = 16;
      ctx.fillStyle = 'rgba(236, 72, 153, 0.78)';
      ctx.beginPath();
      ctx.moveTo(-w, -h);
      ctx.lineTo(w, h);
      ctx.lineTo(w, -h);
      ctx.lineTo(-w, h);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    } else if (e.kind === 'tanker') {
      const r = Math.max(10, f.width * 0.4);
      this.strokeRegularPoly(ctx, 0, 0, r, 6, this.clock * 3, '#A855F7', 2.6);
      ctx.fillStyle = 'rgba(168, 85, 247, 0.4)';
      ctx.fill();
    } else if (e.kind === 'spiker') {
      ctx.rotate(this.clock * 11);
      ctx.shadowColor = '#34D399';
      ctx.shadowBlur = 16;
      ctx.strokeStyle = '#34D399';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      for (let t = 0; t <= 16; t++) {
        const a = t * 0.62;
        const r = t * 0.96 * sc;
        if (t === 0) ctx.moveTo(0, 0);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.stroke();
    } else if (e.kind === 'pulsar') {
      const w = Math.max(10, f.width * 0.46);
      const amp = (e.pulsing ? 17 : 7) * sc;
      ctx.shadowColor = '#C084FC';
      ctx.shadowBlur = 20;
      ctx.strokeStyle = e.pulsing ? '#FFFFFF' : '#22D3EE';
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
      ctx.rotate(this.clock * 16);
      const cols = ['#22D3EE', '#F472B6', '#FACC15', '#34D399'];
      const r = Math.max(8, 16 * sc);
      ctx.shadowColor = '#22D3EE';
      ctx.shadowBlur = 18;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        ctx.strokeStyle = cols[k % 4];
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a + 0.3) * r * 0.55, Math.sin(a + 0.3) * r * 0.55);
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.stroke();
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(2.5, 4.4 * sc), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  public getHudSnapshot(): ClassicGameHud {
    const wLabel = this.weaponTier >= 3 ? 'Triple Prism' : this.weaponTier === 2 ? 'Prism Laser' : 'Twin Plasma';
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: this.inBonusTunnel ? 'Tempest 3000 · VLM-2 Bonus Tunnel' : `Tempest 3000 · ${this.tube.name}`,
      primaryMetricLabel: 'Superzapper',
      primaryMetricValue: this.zapperUses === 2 ? 'Full' : this.zapperUses === 1 ? '1× Left' : 'Spent',
      secondaryMetricLabel: 'Prism / Droids',
      secondaryMetricValue: `${wLabel} · D×${this.droidCount} · G:${this.warpGlyphs}/3`,
      bannerText: this.calloutTimer > 0 ? this.calloutText : '',
    };
  }
}

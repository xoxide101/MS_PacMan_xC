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
// TEMPEST (1981 Atari — Authentic Quadrascan Color Vector Arcade Engine)
// - Pure razor-sharp glowing vector beams (no Melt-O-Vision blur)
// - 16 Authentic Atari Web Geometries + Classic Color-Tier Progression (Blue -> Red -> Yellow -> Cyan -> Stealth)
// - Continuous 3D Cell-Space Claw movement (u in 0..1) aiming center OR side rails!
// - Authentic 5-enemy roster: Cartwheeling Flippers, Splitting Tankers, Spike-laying Spikers,
//   Side-Rail-Riding Fuseballs (u = 0 or 1!), and Lane-Electrifying Pulsars!
// ============================================================================

type ClassicEnemyKind = 'flipper' | 'tanker' | 'spiker' | 'fuseball' | 'pulsar';

interface ClassicEnemy {
  id: number;
  kind: ClassicEnemyKind;
  lane: number;
  u: number; // 0 = left rail, 0.5 = cell center, 1 = right rail
  z: number; // 1.0 = far pit, 0.0 = rim
  speed: number;
  flipTimer: number;
  flipDir: 1 | -1;
  flipping: boolean;
  flipProgress: number; // 0..1 3D cartwheel pivot across rail!
  flipTargetLane: number;
  retreating: boolean;
  fireCd: number;
  pulseTimer: number;
  pulsing: boolean;
  railSide: 0 | 1; // For Fuseballs strictly riding left (0) or right (1) vertex rail
}

interface ClassicShot {
  lane: number;
  u: number;
  z: number;
  fromPlayer: boolean;
  speed: number;
}

const LOGICAL_W = 760;
const LOGICAL_H = 760;
const CX = LOGICAL_W * 0.5;
const CY = LOGICAL_H * 0.52;

const CLASSIC_WEBS = buildClassic1981Webs();

// Authentic Atari 1981 16-level web color tiers!
const TIER_PALETTES = [
  { web: '#3B82F6', rimGlow: '#60A5FA', claw: '#FACC15', clawAccent: '#EF4444', name: 'BLUE TIER' },
  { web: '#EF4444', rimGlow: '#F87171', claw: '#22D3EE', clawAccent: '#FACC15', name: 'RED TIER' },
  { web: '#FACC15', rimGlow: '#FEF08A', claw: '#EC4899', clawAccent: '#38BDF8', name: 'YELLOW TIER' },
  { web: '#22D3EE', rimGlow: '#67E8F9', claw: '#4ADE80', clawAccent: '#FACC15', name: 'CYAN TIER' },
  { web: '#1E293B', rimGlow: '#38BDF8', claw: '#FACC15', clawAccent: '#F43F5E', name: 'STEALTH TIER' },
];

export class Tempest1981Game implements ArcadeGameInstance {
  public readonly logicalWidth = LOGICAL_W;
  public readonly logicalHeight = LOGICAL_H;
  public readonly supportsPointerAim = true;
  public readonly primaryActionLabel = 'Vector Blaster';
  public readonly secondaryActionLabel = 'Superzapper';

  private readonly storageKey = 'tempest_1981_hd_highscore_v2';
  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();

  private score = 0;
  private highScore = 0;
  private nextExtraLife = 20000;
  private level = 1;
  private lives = 3;

  private clock = 0;
  private phaseTimer = 0;
  private zapperUses = 2;
  private zapperFlash = 0;

  // Continuous 3D cell-space steering! lanePos = lane + subCell (0..1 across cell)
  private lanePos = 0.5;
  private angularVel = 0;
  private clawRecoil = 0;
  private fireCd = 0;
  private invulnTimer = 0;
  private warpProgress = 0;
  private cam: Camera3DState = createDefaultCamera(CX, CY, 298, 3.85);

  private tube: TubeWebDef = CLASSIC_WEBS[0];
  private laneCount = 16;
  private spikes: number[] = [];
  private electrifiedLanes: number[] = []; // > 0 when a Pulsar energizes that lane!
  private enemies: ClassicEnemy[] = [];
  private remainingToSpawn = 0;
  private spawnTimer = 0;
  private nextEnemyId = 1;
  private shots: ClassicShot[] = [];
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

  private getTierPalette() {
    const tier = Math.floor((this.level - 1) / 16) % TIER_PALETTES.length;
    return TIER_PALETTES[tier];
  }

  private loadStage(lvl: number): void {
    this.tube = CLASSIC_WEBS[(lvl - 1) % CLASSIC_WEBS.length];
    this.laneCount = getLaneCount(this.tube);
    this.lanePos = wrapContinuousLanePos(this.tube, Math.min(this.lanePos, this.laneCount - 0.5));
    this.spikes = new Array(this.laneCount).fill(0);
    this.electrifiedLanes = new Array(this.laneCount).fill(0);
    this.enemies = [];
    this.shots = [];
    this.zapperUses = 2;
    this.remainingToSpawn = 12 + lvl * 3;
    this.spawnTimer = 0.55;
    this.warpProgress = 0;
    this.cam.warpZoom = 0;
  }

  public startNewGame(): void {
    this.score = 0;
    this.nextExtraLife = 20000;
    this.level = 1;
    this.lives = 3;
    this.particles = [];
    this.popups = [];
    this.loadStage(1);
    this.lanePos = 0.5;
    this.invulnTimer = 1.6;
    this.phase = 'READY';
    this.phaseTimer = 1.05;
    arcadeAudio.playArcadeStart();
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
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
      this.nextExtraLife += 20000;
      this.lives = Math.min(6, this.lives + 1);
      arcadeAudio.playExtraLife();
      this.popups.push({ x: CX, y: 120, text: 'EXTRA BLASTER!', color: '#4ADE80', life: 1.2, maxLife: 1.2 });
    }
    if (laneIdx !== undefined) {
      const f = projectCellFrame(this.tube, laneIdx, u, z, this.cam);
      this.popups.push({ x: f.x, y: f.y - 10, text: `${pts}`, color, life: 0.72, maxLife: 0.72 });
    }
  }

  private triggerSuperzapper(): void {
    if (this.zapperUses <= 0) return;
    this.zapperFlash = 0.48;
    arcadeAudio.playSuperzapper();

    if (this.zapperUses === 2) {
      for (const e of this.enemies) {
        const f = projectCellFrame(this.tube, e.lane, e.u, e.z, this.cam);
        spawnBurst(this.particles, f.x, f.y, '#60A5FA', 10, 190, 2.5);
        this.addScore(150, e.lane, e.u, e.z, '#60A5FA');
      }
      this.enemies = [];
      this.zapperUses = 1;
    } else {
      if (this.enemies.length > 0) {
        this.enemies.sort((a, b) => a.z - b.z);
        const e = this.enemies.shift()!;
        const f = projectCellFrame(this.tube, e.lane, e.u, e.z, this.cam);
        spawnBurst(this.particles, f.x, f.y, '#FACC15', 16, 220, 3);
        this.addScore(250, e.lane, e.u, e.z, '#FACC15');
      }
      this.zapperUses = 0;
    }
  }

  private spawnEnemy(): void {
    const lane = Math.floor(Math.random() * this.laneCount);
    const roll = Math.random();
    let kind: ClassicEnemyKind = 'flipper';
    if (this.level >= 2 && roll < 0.2) kind = 'tanker';
    else if (this.level >= 2 && roll < 0.38) kind = 'spiker';
    else if (this.level >= 3 && roll < 0.56) kind = 'fuseball';
    else if (this.level >= 4 && roll < 0.7) kind = 'pulsar';

    const railSide: 0 | 1 = Math.random() > 0.5 ? 1 : 0;
    this.enemies.push({
      id: this.nextEnemyId++,
      kind,
      lane,
      u: kind === 'fuseball' ? railSide : 0.5,
      z: 1.0,
      speed: 0.22 + Math.min(0.26, this.level * 0.022) + (kind === 'fuseball' ? 0.09 : 0),
      flipTimer: 0.65 + Math.random() * 0.85,
      flipDir: Math.random() > 0.5 ? 1 : -1,
      flipping: false,
      flipProgress: 0,
      flipTargetLane: lane,
      retreating: false,
      fireCd: 1.45 + Math.random() * 1.6,
      pulseTimer: 1.4 + Math.random() * 1.2,
      pulsing: false,
      railSide,
    });
  }

  private loseLife(): void {
    if (this.invulnTimer > 0) return;
    const f = projectCellFrame(this.tube, this.getCurrentLane(), this.getCurrentSubCell(), 0, this.cam);
    spawnBurst(this.particles, f.x, f.y, '#FACC15', 28, 260, 3.2);
    spawnBurst(this.particles, f.x, f.y, '#EF4444', 18, 190, 2.5);
    arcadeAudio.playExplosion(true);

    this.lives -= 1;
    if (this.lives <= 0) {
      this.phase = 'GAME_OVER';
      arcadeAudio.playDeath();
      return;
    }

    this.enemies = this.enemies.filter((e) => e.z > 0.28);
    this.shots = this.shots.filter((s) => s.fromPlayer);
    this.invulnTimer = 2.2;
  }

  private updateCamera3D(dt: number): void {
    const lane = this.getCurrentLane();
    const u = this.getCurrentSubCell();
    const v0 = this.tube.vertices[lane];
    const v1 = this.tube.vertices[(lane + 1) % this.tube.vertices.length];
    const targetVx = v0.x + (v1.x - v0.x) * u;
    const targetVy = v0.y + (v1.y - v0.y) * u;

    // Subtle classic 3D parallax leaning slightly toward the player's cell!
    const targetYaw = targetVx * 0.28;
    const targetPitch = targetVy * 0.22;
    this.cam.yaw += (targetYaw - this.cam.yaw) * Math.min(1, dt * 6);
    this.cam.pitch += (targetPitch - this.cam.pitch) * Math.min(1, dt * 6);
    this.cam.warpZoom = this.phase === 'STAGE_CLEAR' ? this.warpProgress * 2.15 : 0;
  }

  private handleSteering(dt: number): void {
    if (this.input.pointerActive) {
      const px = this.input.pointerX * LOGICAL_W;
      const py = this.input.pointerY * LOGICAL_H;
      const targetPos = mapPointerToLanePos(this.tube, px, py, this.cam, this.lanePos);
      // Shortest delta across closed tube for smooth velocity banking
      let diff = targetPos - this.lanePos;
      if (this.tube.closed) {
        if (diff > this.laneCount * 0.5) diff -= this.laneCount;
        if (diff < -this.laneCount * 0.5) diff += this.laneCount;
      }
      this.angularVel = Math.max(-14, Math.min(14, diff * 18));
      this.lanePos = targetPos;
      return;
    }

    // Continuous smooth cell-space spinner movement via keyboard!
    const spinSpeed = 7.6; // cells/sec so you can place Claw cleanly on left rail, center, or right rail
    if (this.input.left && !this.input.right) {
      this.angularVel = Math.max(-spinSpeed, this.angularVel - 52 * dt);
    } else if (this.input.right && !this.input.left) {
      this.angularVel = Math.min(spinSpeed, this.angularVel + 52 * dt);
    } else {
      // Crisp arcade rotary friction
      this.angularVel *= Math.pow(0.0005, dt);
      if (Math.abs(this.angularVel) < 0.08) this.angularVel = 0;
    }
    this.lanePos = wrapContinuousLanePos(this.tube, this.lanePos + this.angularVel * dt);
  }

  public step(dt: number): void {
    this.clock += dt;
    if (this.zapperFlash > 0) this.zapperFlash = Math.max(0, this.zapperFlash - dt);
    if (this.clawRecoil > 0) this.clawRecoil = Math.max(0, this.clawRecoil - dt * 7);
    stepParticlesAndPopups(this.particles, this.popups, dt);

    if (this.phase === 'TITLE') {
      this.lanePos = wrapContinuousLanePos(this.tube, this.lanePos + dt * 2.4);
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

    if (this.phase === 'STAGE_CLEAR') {
      this.warpProgress += dt * 0.72;
      this.handleSteering(dt);
      this.updateCamera3D(dt);
      const curLane = this.getCurrentLane();
      const spikeLen = this.spikes[curLane] || 0;
      if (spikeLen > 0.1 && this.warpProgress > 1 - spikeLen - 0.1 && this.warpProgress < 1 - spikeLen + 0.09) {
        if (this.input.fire || this.input.fireJustPressed) {
          this.spikes[curLane] = 0;
          this.addScore(150, curLane, 0.5, 0.15, '#4ADE80');
          arcadeAudio.playLaser(980);
        } else {
          this.spikes[curLane] = 0;
          this.loseLife();
        }
      }
      if (this.warpProgress >= 1.18) {
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

    // Classic 1981 Atari 8-shot cap + continuous cell-space firing solution (u = curSubU!)
    const activePlayerShots = this.shots.filter((s) => s.fromPlayer).length;
    if ((this.input.fire || this.input.fireJustPressed) && this.fireCd <= 0 && activePlayerShots < 8) {
      this.fireCd = 0.115;
      this.clawRecoil = 1.0;
      this.shots.push({
        lane: curLane,
        u: curSubU,
        z: 0.03,
        fromPlayer: true,
        speed: 2.45,
      });
      arcadeAudio.playLaser(900 + Math.abs(curSubU - 0.5) * 260);
    }

    if (this.input.secondaryJustPressed) {
      this.triggerSuperzapper();
    }

    // Spawner
    if (this.remainingToSpawn > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnEnemy();
        this.remainingToSpawn -= 1;
        this.spawnTimer = Math.max(0.32, 1.08 - this.level * 0.045);
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
        // Center-cell Spikes are chipped down by shots near the center line!
        const spikeTipZ = 1 - (this.spikes[s.lane] || 0);
        if (this.spikes[s.lane] > 0.02 && Math.abs(s.u - 0.5) < 0.36 && s.z >= spikeTipZ) {
          this.spikes[s.lane] = Math.max(0, this.spikes[s.lane] - 0.15);
          this.addScore(50, s.lane, 0.5, spikeTipZ, '#4ADE80');
          this.shots.splice(i, 1);
          continue;
        }
        // Enemy hit using continuous cell + shared-rail firing solution!
        let hit = false;
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const e = this.enemies[j];
          const uTol = e.kind === 'fuseball' ? 0.28 : 0.38;
          if (Math.abs(e.z - s.z) < 0.095 && matchesCellFiringSolution(this.tube, s.lane, s.u, e.lane, e.u, uTol)) {
            this.destroyEnemy(j);
            hit = true;
            break;
          }
        }
        if (hit) this.shots.splice(i, 1);
      } else {
        s.z -= s.speed * dt;
        if (s.z <= 0.025) {
          if (matchesCellFiringSolution(this.tube, curLane, curSubU, s.lane, s.u, 0.42)) {
            this.shots.splice(i, 1);
            this.loseLife();
            return;
          }
          this.shots.splice(i, 1);
        }
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
        // Authentic 1981 Fuseball: strictly travels along the SIDE RAIL (u = 0 or u = 1)!
        e.u = e.railSide;
        if (e.z > 0.01) {
          // Fuseballs dart in energetic bursts along the rail!
          const burst = Math.sin(this.clock * 7 + e.id) > -0.25 ? 1.25 : 0.25;
          e.z = Math.max(0, e.z - e.speed * burst * dt);
        } else {
          // On rim: hop to adjacent rail toward the Claw!
          e.flipTimer -= dt;
          if (e.flipTimer <= 0) {
            e.flipTimer = 0.36;
            const dir = shortestLaneStep(this.tube, e.lane, curLane);
            e.lane = wrapLaneIndex(this.tube, e.lane + dir);
          }
        }
      } else if (e.kind === 'pulsar') {
        e.u = 0.5;
        if (e.z > 0.08) {
          e.z = Math.max(0.08, e.z - e.speed * 0.72 * dt);
        }
        e.pulseTimer -= dt;
        if (e.pulseTimer <= 0) {
          e.pulsing = !e.pulsing;
          e.pulseTimer = e.pulsing ? 0.95 : 1.75;
        }
        if (e.pulsing) {
          this.electrifiedLanes[e.lane] = 0.14;
        }
      } else if (e.kind === 'tanker') {
        e.u = 0.5;
        e.z = Math.max(0, e.z - e.speed * 0.85 * dt);
        if (e.z <= 0.04) {
          // Tanker bursts at rim into 2 Flippers!
          this.splitTanker(e);
          this.enemies.splice(i, 1);
          continue;
        }
      } else {
        // FLIPPER: authentic 3D cartwheel flipping across side rails!
        if (e.flipping) {
          e.flipProgress += dt * 3.8;
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
          if (e.z < 0.72 && e.z > 0.12 && this.level >= 2) {
            e.flipTimer -= dt;
            if (e.flipTimer <= 0) {
              e.flipTimer = 0.85 + Math.random() * 0.7;
              e.flipping = true;
              e.flipProgress = 0;
              e.flipTargetLane = wrapLaneIndex(this.tube, e.lane + e.flipDir);
            }
          }
        } else {
          // Rim chase! Flipper flips lane-by-lane toward Claw
          e.flipTimer -= dt;
          if (e.flipTimer <= 0) {
            e.flipTimer = Math.max(0.24, 0.44 - this.level * 0.015);
            e.flipDir = shortestLaneStep(this.tube, e.lane, curLane);
            e.flipping = true;
            e.flipProgress = 0;
            e.flipTargetLane = wrapLaneIndex(this.tube, e.lane + e.flipDir);
          }
        }
      }

      // Enemy fires vector spark down its exact u-line!
      e.fireCd -= dt;
      if (e.fireCd <= 0 && e.z > 0.2 && e.z < 0.86 && e.kind !== 'fuseball') {
        e.fireCd = 2.0 + Math.random() * 1.8;
        this.shots.push({
          lane: e.lane,
          u: e.u,
          z: e.z,
          fromPlayer: false,
          speed: 0.74 + this.level * 0.035,
        });
      }

      // Rim collision
      if (e.z <= 0.035 && matchesCellFiringSolution(this.tube, curLane, curSubU, e.lane, e.u, 0.42)) {
        this.enemies.splice(i, 1);
        this.loseLife();
        return;
      }
    }

    // Electrified Pulsar lane check!
    if (this.electrifiedLanes[curLane] > 0 && this.invulnTimer <= 0) {
      this.loseLife();
      return;
    }

    // Stage Clear -> Classic 3D Warp Flight!
    if (this.remainingToSpawn <= 0 && this.enemies.length === 0) {
      this.addScore(1000 + this.level * 250, curLane, 0.5, 0.25, '#4ADE80');
      arcadeAudio.playStageClear();
      this.phase = 'STAGE_CLEAR';
      this.warpProgress = 0;
    }
  }

  private splitTanker(e: ClassicEnemy): void {
    const childKind: ClassicEnemyKind = this.level >= 5 ? 'fuseball' : 'flipper';
    for (const dir of [-1, 1] as const) {
      this.enemies.push({
        id: this.nextEnemyId++,
        kind: childKind,
        lane: wrapLaneIndex(this.tube, e.lane + dir),
        u: childKind === 'fuseball' ? (dir > 0 ? 0 : 1) : 0.5,
        z: e.z,
        speed: e.speed * 1.15,
        flipTimer: 0.45,
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
    const color =
      e.kind === 'flipper'
        ? '#F43F5E'
        : e.kind === 'tanker'
          ? '#C084FC'
          : e.kind === 'spiker'
            ? '#4ADE80'
            : e.kind === 'pulsar'
              ? '#E879F9'
              : '#FACC15';
    const pts = e.kind === 'fuseball' ? 750 : e.kind === 'pulsar' ? 200 : e.kind === 'tanker' ? 250 : 150;
    // Crisp Atari star-vector starburst explosion!
    spawnBurst(this.particles, f.x, f.y, color, 16, 210, 2.6);
    arcadeAudio.playExplosion(e.kind === 'tanker' || e.kind === 'pulsar');
    this.addScore(pts, e.lane, e.u, e.z, color);
    if (e.kind === 'tanker') this.splitTanker(e);
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.save();
    ctx.scale(dpr, dpr);

    // Pure 1981 Atari Quadrascan deep-black CRT phosphor backdrop (NO Melt-O-Vision!)
    ctx.fillStyle = '#020308';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // Subtle crisp vector warp stars during fly-through
    if (this.phase === 'STAGE_CLEAR') {
      ctx.save();
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * Math.PI * 2 + this.clock * 0.2;
        const cyc = (this.clock * 2.1 + i * 0.17) % 1;
        const r0 = 24 + cyc * 340;
        const r1 = r0 + 34;
        ctx.strokeStyle = `rgba(147, 197, 253, ${cyc * 0.65})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(CX + Math.cos(a) * r0, CY + Math.sin(a) * r0);
        ctx.lineTo(CX + Math.cos(a) * r1, CY + Math.sin(a) * r1);
        ctx.stroke();
      }
      ctx.restore();
    }

    const pal = this.getTierPalette();
    const curLane = this.getCurrentLane();
    const curSubU = this.getCurrentSubCell();

    // Draw Classic 1981 Vector Web: Far pit polygon + Rim polygon (razor sharp dual-pass vector glow!)
    for (const rz of [1.0, 0.0]) {
      ctx.save();
      ctx.strokeStyle = rz === 0 ? pal.web : 'rgba(96, 165, 250, 0.45)';
      ctx.lineWidth = rz === 0 ? 3.2 : 1.5;
      if (rz === 0) {
        ctx.shadowColor = pal.rimGlow;
        ctx.shadowBlur = 14;
      }
      ctx.beginPath();
      this.tube.vertices.forEach((v, idx) => {
        const p = projectTubePoint(v.x, v.y, rz, this.cam);
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      if (this.tube.closed) ctx.closePath();
      ctx.stroke();
      if (rz === 0) {
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.65)';
        ctx.lineWidth = 1.0;
        ctx.stroke();
      }
      ctx.restore();
    }

    // Longitudinal Vector Rails + Electrified Pulsar Surge + Active Cell Highlight!
    for (let i = 0; i < this.tube.vertices.length; i++) {
      const v = this.tube.vertices[i];
      const o = projectTubePoint(v.x, v.y, 0, this.cam);
      const f = projectTubePoint(v.x, v.y, 1, this.cam);
      const isLeftEdge = i === curLane;
      const isRightEdge = i === (curLane + 1) % this.tube.vertices.length;
      const isPlayerEdge = isLeftEdge || isRightEdge;
      // Highlight rail extra bright when Claw slides close to that side rail!
      const railAimBoost = (isLeftEdge && curSubU < 0.28) || (isRightEdge && curSubU > 0.72);
      const isElectrified =
        this.electrifiedLanes[i % this.laneCount] > 0 ||
        this.electrifiedLanes[(i - 1 + this.laneCount) % this.laneCount] > 0;

      ctx.save();
      ctx.strokeStyle = isElectrified
        ? '#F0ABFC'
        : railAimBoost
          ? '#FEF08A'
          : isPlayerEdge
            ? pal.claw
            : pal.web;
      ctx.lineWidth = isElectrified ? 4.2 : railAimBoost ? 3.8 : isPlayerEdge ? 2.8 : 1.5;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = isElectrified || railAimBoost ? 16 : isPlayerEdge ? 10 : 4;
      ctx.beginPath();
      ctx.moveTo(f.x, f.y);
      ctx.lineTo(o.x, o.y);
      ctx.stroke();

      // Authentic Quadrascan beam-dwell bright dot at rim vertices!
      ctx.fillStyle = isPlayerEdge ? '#FFFFFF' : pal.rimGlow;
      ctx.beginPath();
      ctx.arc(o.x, o.y, isPlayerEdge ? 2.6 : 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Active Cell Firing Solution Guide Line (shows exact 3D line down u = curSubU toward center or side rail!)
    if (this.phase === 'PLAYING' || this.phase === 'READY') {
      const near = projectCellFrame(this.tube, curLane, curSubU, 0.02, this.cam);
      const far = projectCellFrame(this.tube, curLane, curSubU, 0.98, this.cam);
      ctx.save();
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.24)';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.moveTo(near.x, near.y);
      ctx.lineTo(far.x, far.y);
      ctx.stroke();
      ctx.restore();
    }

    // Electrified Pulsar Lane Zig-Zag Arcs
    for (let i = 0; i < this.laneCount; i++) {
      if (this.electrifiedLanes[i] <= 0) continue;
      ctx.save();
      ctx.strokeStyle = Math.floor(this.clock * 30) % 2 === 0 ? '#FFFFFF' : '#E879F9';
      ctx.shadowColor = '#E879F9';
      ctx.shadowBlur = 16;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      for (let s = 0; s <= 10; s++) {
        const z = s / 10;
        const u = s % 2 === 0 ? 0.12 : 0.88;
        const pt = projectCellFrame(this.tube, i, u, z, this.cam);
        if (s === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Spikes down cell centers
    for (let i = 0; i < this.laneCount; i++) {
      const sp = this.spikes[i];
      if (sp <= 0.02) continue;
      const far = projectCellFrame(this.tube, i, 0.5, 1.0, this.cam);
      const tip = projectCellFrame(this.tube, i, 0.5, 1.0 - sp, this.cam);
      ctx.save();
      ctx.strokeStyle = '#4ADE80';
      ctx.lineWidth = 3.0;
      ctx.shadowColor = '#4ADE80';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(far.x, far.y);
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Enemies far-to-near with genuine 3D cell-width scaling & cartwheel flipping!
    const sorted = [...this.enemies].sort((a, b) => b.z - a.z);
    for (const e of sorted) {
      this.drawClassicEnemy(ctx, e);
    }

    // Vector Shots (traveling along exact shot u-line!)
    for (const s of this.shots) {
      const f = projectCellFrame(this.tube, s.lane, s.u, s.z, this.cam);
      const tail = projectCellFrame(this.tube, s.lane, s.u, Math.max(0, Math.min(1, s.z - (s.fromPlayer ? 0.055 : -0.045))), this.cam);
      ctx.save();
      if (s.fromPlayer) {
        ctx.strokeStyle = pal.claw;
        ctx.lineWidth = Math.max(1.5, 3.4 * f.scale);
        ctx.shadowColor = pal.claw;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(tail.x, tail.y);
        ctx.lineTo(f.x, f.y);
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(f.x, f.y, Math.max(2, 3.8 * f.scale), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.translate(f.x, f.y);
        ctx.rotate(this.clock * 14);
        const r = Math.max(3.5, 6.5 * f.scale);
        ctx.strokeStyle = '#FFFFFF';
        ctx.shadowColor = '#F43F5E';
        ctx.shadowBlur = 10;
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(-r, 0);
        ctx.lineTo(r, 0);
        ctx.moveTo(0, -r);
        ctx.lineTo(0, r);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Authentic 1981 3D Atari Vector C-Claw (slides smoothly within cell space & tilts with velocity!)
    if (this.phase !== 'GAME_OVER') {
      const blink = this.invulnTimer > 0 && Math.floor(this.clock * 16) % 2 === 0;
      if (!blink) {
        this.drawClassicVectorClaw(ctx, curLane, curSubU, pal.claw, pal.clawAccent);
      }
    }

    // Superzapper Quadrascan Lightning
    if (this.zapperFlash > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(96, 165, 250, ${this.zapperFlash * 0.42})`;
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
      ctx.strokeStyle = '#FFFFFF';
      ctx.shadowColor = '#60A5FA';
      ctx.shadowBlur = 16;
      ctx.lineWidth = 2.6;
      for (let b = 0; b < 6; b++) {
        const li = (curLane + b * 3) % this.laneCount;
        const rim = projectCellFrame(this.tube, li, 0.5, 0, this.cam);
        const mid = projectCellFrame(this.tube, li, 0.5, 0.5, this.cam);
        const pit = projectCellFrame(this.tube, li, 0.5, 1.0, this.cam);
        ctx.beginPath();
        ctx.moveTo(rim.x, rim.y);
        ctx.lineTo(mid.x + Math.sin(this.clock * 90 + b) * 18, mid.y);
        ctx.lineTo(pit.x, pit.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    renderParticlesAndPopups(ctx, this.particles, this.popups);

    // Classic Atari Vector HUD
    ctx.save();
    ctx.font = '700 14px "JetBrains Mono", monospace';
    ctx.fillStyle = pal.claw;
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${this.score.toLocaleString()}`, 22, 30);
    ctx.textAlign = 'center';
    ctx.fillStyle = pal.rimGlow;
    ctx.fillText(`TEMPEST '81 · LV ${this.level} · ${this.tube.name.toUpperCase()}`, CX, 30);
    ctx.textAlign = 'right';
    ctx.fillStyle = this.zapperUses > 0 ? '#4ADE80' : '#64748B';
    ctx.fillText(
      this.zapperUses === 2 ? 'ZAPPER FULL' : this.zapperUses === 1 ? 'ZAPPER 1×' : 'ZAPPER SPENT',
      LOGICAL_W - 22,
      30
    );
    ctx.restore();

    if (this.phase === 'READY' || this.phase === 'STAGE_CLEAR') {
      ctx.save();
      ctx.fillStyle = 'rgba(2, 4, 12, 0.84)';
      ctx.fillRect(CX - 205, CY - 34, 410, 68);
      ctx.strokeStyle = pal.web;
      ctx.lineWidth = 2;
      ctx.strokeRect(CX - 205, CY - 34, 410, 68);
      ctx.font = '800 20px "JetBrains Mono", monospace';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        this.phase === 'READY' ? `LEVEL ${this.level} · ${this.tube.name.toUpperCase()}` : 'AVOID SPIKES · WARP!',
        CX,
        CY
      );
      ctx.restore();
    }

    if (visualMode === 'crt') renderCrtOverlay(ctx, LOGICAL_W, LOGICAL_H);
    ctx.restore();
  }

  private drawClassicVectorClaw(
    ctx: CanvasRenderingContext2D,
    lane: number,
    u: number,
    clawColor: string,
    accentColor: string
  ): void {
    const f = projectCellFrame(this.tube, lane, u, 0, this.cam);
    const bank = Math.max(-0.28, Math.min(0.28, this.angularVel * 0.03));
    const recoil = this.clawRecoil * 6;
    const halfSpan = Math.min(26, Math.max(15, f.width * 0.32));

    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.inwardAngle + bank);
    ctx.translate(-recoil, 0);

    // 3D Vector C-Claw Hull (crisp hollow wireframe + subtle interior glowing ribs!)
    ctx.shadowColor = clawColor;
    ctx.shadowBlur = 16;
    ctx.strokeStyle = clawColor;
    ctx.fillStyle = 'rgba(250, 204, 21, 0.14)';
    ctx.lineWidth = 2.8;

    ctx.beginPath();
    ctx.moveTo(26, 0); // Forward nose gun pointing down the exact u-line!
    ctx.lineTo(-4, -halfSpan); // Left outer prong
    ctx.lineTo(-16, -halfSpan * 0.55); // Left rear fin
    ctx.lineTo(-4, -halfSpan * 0.22); // Inner left notch
    ctx.lineTo(-10, 0); // Rear core
    ctx.lineTo(-4, halfSpan * 0.22); // Inner right notch
    ctx.lineTo(-16, halfSpan * 0.55); // Right rear fin
    ctx.lineTo(-4, halfSpan); // Right outer prong
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Inner 3D vector depth ribs (gives unmistakable 1981 vector 3D solidity!)
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-6, -halfSpan * 0.6);
    ctx.moveTo(18, 0);
    ctx.lineTo(-6, halfSpan * 0.6);
    ctx.moveTo(26, 0);
    ctx.lineTo(-10, 0);
    ctx.stroke();

    // Hot white Quadrascan firing muzzle spark
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(26, 0, this.clawRecoil > 0.3 ? 4.2 : 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawClassicEnemy(ctx: CanvasRenderingContext2D, e: ClassicEnemy): void {
    const f = projectCellFrame(this.tube, e.lane, e.u, e.z, this.cam);
    const sc = Math.max(0.28, f.scale);

    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.tangentAngle);

    if (e.kind === 'flipper') {
      // Genuine 3D cartwheel rotation when flipping across a side rail!
      const flipSpin = e.flipping ? e.flipProgress * Math.PI * e.flipDir : Math.sin(this.clock * 6 + e.id) * 0.12;
      ctx.rotate(flipSpin);
      const w = Math.max(8, f.width * 0.44);
      const h = 12 * sc;
      ctx.shadowColor = '#F43F5E';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = '#F43F5E';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(-w, -h);
      ctx.lineTo(w, h);
      ctx.lineTo(w, -h);
      ctx.lineTo(-w, h);
      ctx.closePath();
      ctx.stroke();
      ctx.strokeStyle = '#FECDD3';
      ctx.lineWidth = 1.1;
      ctx.stroke();
    } else if (e.kind === 'tanker') {
      const r = Math.max(9, f.width * 0.38);
      ctx.shadowColor = '#C084FC';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = '#C084FC';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r, 0);
      ctx.closePath();
      ctx.stroke();
      ctx.strokeStyle = '#38BDF8';
      ctx.strokeRect(-r * 0.34, -r * 0.34, r * 0.68, r * 0.68);
    } else if (e.kind === 'spiker') {
      ctx.rotate(this.clock * 9);
      ctx.shadowColor = '#4ADE80';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = '#4ADE80';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let t = 0; t <= 16; t++) {
        const a = t * 0.6;
        const r = t * 0.9 * sc;
        if (t === 0) ctx.moveTo(0, 0);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.stroke();
    } else if (e.kind === 'pulsar') {
      // Authentic Atari 1981 Pulsar zig-zag spanning rail-to-rail!
      const w = Math.max(10, f.width * 0.46);
      const amp = (e.pulsing ? 15 : 7) * sc;
      ctx.shadowColor = '#E879F9';
      ctx.shadowBlur = e.pulsing ? 18 : 10;
      ctx.strokeStyle = e.pulsing ? '#FFFFFF' : '#E879F9';
      ctx.lineWidth = e.pulsing ? 3.0 : 2.2;
      ctx.beginPath();
      for (let k = 0; k <= 6; k++) {
        const px = -w + (k / 6) * w * 2;
        const py = k % 2 === 0 ? -amp : amp;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    } else {
      // Fuseball crackling on the SIDE RAIL!
      ctx.rotate(this.clock * 12);
      const colors = ['#FACC15', '#EF4444', '#38BDF8', '#4ADE80'];
      const r = Math.max(7, 15 * sc);
      ctx.shadowColor = '#FACC15';
      ctx.shadowBlur = 14;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        ctx.strokeStyle = colors[k % 4];
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a + 0.3) * r * 0.55, Math.sin(a + 0.3) * r * 0.55);
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.stroke();
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(2, 3.6 * sc), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  public getHudSnapshot(): ClassicGameHud {
    const pal = this.getTierPalette();
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: `Tempest '81 · ${this.tube.name} (${pal.name})`,
      primaryMetricLabel: 'Superzapper',
      primaryMetricValue: this.zapperUses === 2 ? 'Full' : this.zapperUses === 1 ? '1× Left' : 'Spent',
      secondaryMetricLabel: 'Remaining',
      secondaryMetricValue: `${this.remainingToSpawn + this.enemies.length}`,
      bannerText: '',
    };
  }
}

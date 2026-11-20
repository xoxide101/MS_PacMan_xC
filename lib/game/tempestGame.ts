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

export type TempestVariant = 'tempest' | 'tempest2000' | 'tempest3000';

interface TubeDef {
  name: string;
  closed: boolean;
  vertices: Array<{ x: number; y: number }>;
  color: string;
}

type TempestEnemyKind = 'flipper' | 'tanker' | 'spiker' | 'fuseball';

interface TempestEnemy {
  id: number;
  kind: TempestEnemyKind;
  lane: number;
  z: number; // 1.0 = far pit, 0.0 = outer rim
  speed: number;
  flipTimer: number;
  flipDir: 1 | -1;
  retreating: boolean;
  fireCd: number;
}

interface TempestShot {
  lane: number;
  z: number;
  fromPlayer: boolean;
  speed: number;
}

interface PowerUpCapsule {
  lane: number;
  z: number;
  kind: 'laser' | 'jump' | 'droid' | 'points';
}

const LOGICAL_W = 760;
const LOGICAL_H = 760;
const CX = LOGICAL_W * 0.5;
const CY = LOGICAL_H * 0.52;

function buildTubeShapes(): TubeDef[] {
  const circle = (n: number, rx = 1, ry = 1): Array<{ x: number; y: number }> => {
    const pts: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.PI * 0.5;
      pts.push({ x: Math.cos(a) * rx, y: Math.sin(a) * ry });
    }
    return pts;
  };

  // Square (16 points)
  const square: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < 4; i++) square.push({ x: -1 + i * 0.5, y: 1 });
  for (let i = 0; i < 4; i++) square.push({ x: 1, y: 1 - i * 0.5 });
  for (let i = 0; i < 4; i++) square.push({ x: 1 - i * 0.5, y: -1 });
  for (let i = 0; i < 4; i++) square.push({ x: -1, y: -1 + i * 0.5 });

  // Plus-Cross (16 points)
  const plus: Array<{ x: number; y: number }> = [
    { x: -0.38, y: 1.0 },
    { x: 0.0, y: 1.0 },
    { x: 0.38, y: 1.0 },
    { x: 0.38, y: 0.38 },
    { x: 1.0, y: 0.38 },
    { x: 1.0, y: 0.0 },
    { x: 1.0, y: -0.38 },
    { x: 0.38, y: -0.38 },
    { x: 0.38, y: -1.0 },
    { x: 0.0, y: -1.0 },
    { x: -0.38, y: -1.0 },
    { x: -0.38, y: -0.38 },
    { x: -1.0, y: -0.38 },
    { x: -1.0, y: 0.0 },
    { x: -1.0, y: 0.38 },
    { x: -0.38, y: 0.38 },
  ];

  // Star (16 points)
  const star: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + Math.PI * 0.5;
    const r = i % 2 === 0 ? 1.06 : 0.62;
    star.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }

  // Open V-Trough (13 vertices -> 12 open lanes)
  const vOpen: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const x = -1.15 + t * 2.3;
    const y = -0.35 + (1 - Math.abs(t - 0.5) * 2) * 1.15;
    vOpen.push({ x, y });
  }

  // Clover (16 points)
  const clover: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + Math.PI * 0.5;
    const r = 0.8 + 0.28 * Math.cos(a * 4);
    clover.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }

  // Triangle (15 points)
  const triVerts = [
    { x: 0, y: -1.08 },
    { x: 1.08, y: 0.82 },
    { x: -1.08, y: 0.82 },
  ];
  const triangle: Array<{ x: number; y: number }> = [];
  for (let s = 0; s < 3; s++) {
    const a = triVerts[s];
    const b = triVerts[(s + 1) % 3];
    for (let k = 0; k < 5; k++) {
      const f = k / 5;
      triangle.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
    }
  }

  // Bowtie (16 points)
  const bowtie: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = 0.72 + 0.36 * Math.abs(Math.cos(a));
    bowtie.push({ x: Math.cos(a) * r * 1.08, y: Math.sin(a) * r * 0.85 });
  }

  return [
    { name: 'Circle Web', closed: true, vertices: circle(16, 1.0, 1.0), color: '#3B82F6' },
    { name: 'Square Shaft', closed: true, vertices: square, color: '#EF4444' },
    { name: 'Cross Grid', closed: true, vertices: plus, color: '#FACC15' },
    { name: 'Star Vortex', closed: true, vertices: star, color: '#22D3EE' },
    { name: 'V-Canyon', closed: false, vertices: vOpen, color: '#22C55E' },
    { name: 'Clover Rift', closed: true, vertices: clover, color: '#EC4899' },
    { name: 'Prism Triad', closed: true, vertices: triangle, color: '#A855F7' },
    { name: 'Infinity Bowtie', closed: true, vertices: bowtie, color: '#F97316' },
  ];
}

const TUBES = buildTubeShapes();

export class TempestGame implements ArcadeGameInstance {
  public readonly logicalWidth = LOGICAL_W;
  public readonly logicalHeight = LOGICAL_H;
  public readonly supportsPointerAim = true;
  public readonly primaryActionLabel = 'Blaster';
  public readonly secondaryActionLabel = 'Superzapper';

  private variant: TempestVariant;
  private storageKey: string;
  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();

  private score = 0;
  private highScore = 0;
  private nextExtraLife = 20000;
  private level = 1;
  private lives = 3;

  private clock = 0;
  private phaseTimer = 0;
  private zapperUses = 2; // 2 = full clear ready, 1 = single zap ready, 0 = spent
  private zapperFlash = 0;

  // Player claw
  private lane = 0;
  private moveRepeatTimer = 0;
  private fireCd = 0;
  private jumpHeight = 0;
  private jumpVel = 0;
  private invulnTimer = 0;

  // Tempest 2000 / 3000 Powerups
  private hasParticleLaser = false;
  private hasJump = false;
  private droidCount = 0;
  private droidAngle = 0;
  private droidFireCd = 0;

  // Warp between levels
  private warpProgress = 0;

  // Tube & entities
  private tube: TubeDef = TUBES[0];
  private laneCount = 16;
  private spikes: number[] = []; // spike length 0..0.85 from far pit (z=1) toward rim
  private enemies: TempestEnemy[] = [];
  private remainingToSpawn = 0;
  private spawnTimer = 0;
  private nextEnemyId = 1;
  private shots: TempestShot[] = [];
  private capsules: PowerUpCapsule[] = [];
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  constructor(variant: TempestVariant) {
    this.variant = variant;
    this.storageKey = `${variant}_hd_highscore_v1`;
    this.highScore = readHighScore(this.storageKey);
    this.loadStage(1);
    this.phase = 'TITLE';
  }

  private getTitleName(): string {
    if (this.variant === 'tempest') return 'Tempest';
    if (this.variant === 'tempest2000') return 'Tempest 2000';
    return 'Tempest 3000';
  }

  private loadStage(lvl: number): void {
    this.tube = TUBES[(lvl - 1) % TUBES.length];
    this.laneCount = this.tube.closed ? this.tube.vertices.length : this.tube.vertices.length - 1;
    this.lane = Math.min(this.lane, this.laneCount - 1);
    this.spikes = new Array(this.laneCount).fill(0);
    this.enemies = [];
    this.shots = [];
    this.capsules = [];
    this.zapperUses = 2;
    this.remainingToSpawn = 12 + lvl * 4;
    this.spawnTimer = 0.6;
    this.warpProgress = 0;
    this.jumpHeight = 0;
    this.jumpVel = 0;

    // Tempest 3000 starts with Jump & Particle upgrade faster
    if (this.variant === 'tempest3000' && lvl === 1) {
      this.hasJump = true;
    }
  }

  public startNewGame(): void {
    this.score = 0;
    this.nextExtraLife = 20000;
    this.level = 1;
    this.lives = 3;
    this.hasParticleLaser = this.variant === 'tempest3000';
    this.hasJump = this.variant === 'tempest3000';
    this.droidCount = 0;
    this.particles = [];
    this.popups = [];
    this.loadStage(1);
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

  private wrapLane(l: number): number {
    if (this.tube.closed) {
      let r = l % this.laneCount;
      if (r < 0) r += this.laneCount;
      return r;
    }
    return Math.max(0, Math.min(this.laneCount - 1, l));
  }

  // 3D perspective projection of vertex (vx, vy) at depth z (0 = rim, 1 = deep pit)
  private projectVertex(vx: number, vy: number, z: number, jumpOffset = 0): { x: number; y: number } {
    const rimRadius = 292;
    const warpZoom = this.phase === 'STAGE_CLEAR' ? this.warpProgress * 2.2 : 0;
    const effZ = Math.max(-0.55, z - warpZoom);
    const scale = 1 / (1 + effZ * 3.9);
    const lift = 1 + jumpOffset * 0.17;
    const tiltY = effZ * 14; // slight downward perspective vanishing point
    return {
      x: CX + vx * rimRadius * scale * lift,
      y: CY + vy * rimRadius * scale * lift - tiltY,
    };
  }

  private laneCenter(laneIdx: number, z: number, jumpOffset = 0): { x: number; y: number; angle: number } {
    const v0 = this.tube.vertices[laneIdx];
    const v1 = this.tube.vertices[(laneIdx + 1) % this.tube.vertices.length];
    const p0 = this.projectVertex(v0.x, v0.y, z, jumpOffset);
    const p1 = this.projectVertex(v1.x, v1.y, z, jumpOffset);
    const mx = (p0.x + p1.x) * 0.5;
    const my = (p0.y + p1.y) * 0.5;
    const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    return { x: mx, y: my, angle };
  }

  private addScore(pts: number, laneIdx?: number, z?: number, color = '#FDE047'): void {
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
    if (laneIdx !== undefined && z !== undefined) {
      const p = this.laneCenter(laneIdx, z);
      this.popups.push({ x: p.x, y: p.y - 10, text: `${pts}`, color, life: 0.75, maxLife: 0.75 });
    }
  }

  private triggerSuperzapper(): void {
    if (this.zapperUses <= 0) return;
    this.zapperFlash = 0.48;
    arcadeAudio.playSuperzapper();

    if (this.zapperUses === 2) {
      // Full clear of all active enemies on web!
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        const pos = this.laneCenter(e.lane, e.z);
        spawnBurst(this.particles, pos.x, pos.y, '#38BDF8', 10, 180, 3);
        this.addScore(150, e.lane, e.z, '#38BDF8');
      }
      this.enemies = [];
      this.zapperUses = 1;
    } else {
      // Second zapper eliminates 1 closest enemy
      if (this.enemies.length > 0) {
        this.enemies.sort((a, b) => a.z - b.z);
        const e = this.enemies.shift()!;
        const pos = this.laneCenter(e.lane, e.z);
        spawnBurst(this.particles, pos.x, pos.y, '#FDE047', 16, 200, 3);
        this.addScore(200, e.lane, e.z, '#FDE047');
      }
      this.zapperUses = 0;
    }
  }

  private spawnEnemy(): void {
    const lane = Math.floor(Math.random() * this.laneCount);
    const roll = Math.random();
    let kind: TempestEnemyKind = 'flipper';
    if (this.level >= 2 && roll < 0.22) kind = 'tanker';
    else if (this.level >= 2 && roll < 0.42) kind = 'spiker';
    else if (this.level >= 3 && roll < 0.56) kind = 'fuseball';

    this.enemies.push({
      id: this.nextEnemyId++,
      kind,
      lane,
      z: 1.0,
      speed: 0.24 + Math.min(0.28, this.level * 0.025) + (kind === 'fuseball' ? 0.1 : 0),
      flipTimer: 0.65 + Math.random() * 0.7,
      flipDir: Math.random() > 0.5 ? 1 : -1,
      retreating: false,
      fireCd: 1.4 + Math.random() * 1.8,
    });
  }

  private loseLife(): void {
    if (this.invulnTimer > 0) return;
    const p = this.laneCenter(this.lane, 0);
    spawnBurst(this.particles, p.x, p.y, '#FACC15', 26, 260, 4);
    spawnBurst(this.particles, p.x, p.y, '#F43F5E', 18, 190, 3);
    arcadeAudio.playExplosion(true);

    this.lives -= 1;
    if (this.lives <= 0) {
      this.phase = 'GAME_OVER';
      arcadeAudio.playDeath();
      return;
    }

    // Clear close enemies & enemy shots so respawn is fair
    this.enemies = this.enemies.filter((e) => e.z > 0.25);
    this.shots = this.shots.filter((s) => s.fromPlayer);
    this.invulnTimer = 2.2;
    this.jumpHeight = 0;
    this.jumpVel = 0;
  }

  public step(dt: number): void {
    this.clock += dt;
    if (this.zapperFlash > 0) this.zapperFlash = Math.max(0, this.zapperFlash - dt);
    stepParticlesAndPopups(this.particles, this.popups, dt);

    if (this.phase === 'TITLE') {
      if (Math.floor(this.clock * 4) !== Math.floor((this.clock - dt) * 4)) {
        this.lane = this.wrapLane(this.lane + 1);
      }
      return;
    }

    if (this.phase === 'PAUSED' || this.phase === 'GAME_OVER') return;

    if (this.phase === 'READY') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) this.phase = 'PLAYING';
      return;
    }

    if (this.phase === 'STAGE_CLEAR') {
      this.warpProgress += dt * 0.72;
      // Allow dodging spikes while warping through the tube!
      this.handleLaneSteering(dt);
      // Check spike hit during warp
      const spikeLen = this.spikes[this.lane] || 0;
      if (spikeLen > 0.12 && this.warpProgress > 1 - spikeLen - 0.1 && this.warpProgress < 1 - spikeLen + 0.08 && this.jumpHeight < 0.2) {
        // Auto-blast spike if firing during warp!
        if (this.input.fire) {
          this.spikes[this.lane] = 0;
          this.addScore(150, this.lane, 0.2, '#4ADE80');
        } else {
          this.spikes[this.lane] = 0;
          this.loseLife();
        }
      }
      if (this.warpProgress >= 1.15) {
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

    this.handleLaneSteering(dt);

    // Jump Thruster (Tempest 2000 & 3000)
    if (this.hasJump && this.input.up && this.jumpHeight <= 0) {
      this.jumpVel = 3.2;
      arcadeAudio.playJumpBoing();
    }
    if (this.jumpHeight > 0 || this.jumpVel > 0) {
      this.jumpHeight += this.jumpVel * dt;
      this.jumpVel -= 7.8 * dt;
      if (this.jumpHeight <= 0) {
        this.jumpHeight = 0;
        this.jumpVel = 0;
      }
    }

    // Firing blaster
    const rapidCd = this.hasParticleLaser ? (this.variant === 'tempest3000' ? 0.07 : 0.095) : 0.14;
    if ((this.input.fire || this.input.fireJustPressed) && this.fireCd <= 0) {
      this.fireCd = rapidCd;
      this.shots.push({ lane: this.lane, z: 0.03, fromPlayer: true, speed: 2.35 });
      if (this.variant === 'tempest3000' && this.hasParticleLaser) {
        // Triple prism spread!
        this.shots.push({ lane: this.wrapLane(this.lane - 1), z: 0.06, fromPlayer: true, speed: 2.35 });
        this.shots.push({ lane: this.wrapLane(this.lane + 1), z: 0.06, fromPlayer: true, speed: 2.35 });
      }
      arcadeAudio.playLaser(this.hasParticleLaser ? 1240 : 940);
    }

    // Superzapper
    if (this.input.secondaryJustPressed) {
      this.triggerSuperzapper();
    }

    // AI Droid wingman (Tempest 2000 / 3000)
    if (this.droidCount > 0) {
      this.droidAngle += dt * 2.1;
      this.droidFireCd -= dt;
      if (this.droidFireCd <= 0 && this.enemies.length > 0) {
        this.droidFireCd = this.droidCount >= 2 ? 0.24 : 0.42;
        const target = this.enemies[Math.floor(Math.random() * this.enemies.length)];
        this.shots.push({ lane: target.lane, z: 0.04, fromPlayer: true, speed: 2.5 });
      }
    }

    // Spawner
    if (this.remainingToSpawn > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnEnemy();
        this.remainingToSpawn -= 1;
        this.spawnTimer = Math.max(0.32, 1.1 - this.level * 0.06);
      }
    }

    // Update shots
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      if (s.fromPlayer) {
        s.z += s.speed * dt;
        if (s.z >= 1.05) {
          this.shots.splice(i, 1);
          continue;
        }
        // Hit spike?
        const spikeTipZ = 1 - (this.spikes[s.lane] || 0);
        if (this.spikes[s.lane] > 0.02 && s.z >= spikeTipZ) {
          this.spikes[s.lane] = Math.max(0, this.spikes[s.lane] - 0.14);
          this.addScore(50, s.lane, spikeTipZ, '#4ADE80');
          this.shots.splice(i, 1);
          continue;
        }
        // Hit enemy?
        let hit = false;
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const e = this.enemies[j];
          if (e.lane === s.lane && Math.abs(e.z - s.z) < 0.095) {
            this.destroyEnemy(j);
            hit = true;
            break;
          }
        }
        if (hit) this.shots.splice(i, 1);
      } else {
        s.z -= s.speed * dt;
        if (s.z <= 0.02) {
          if (s.lane === this.lane && this.jumpHeight < 0.18) {
            this.shots.splice(i, 1);
            this.loseLife();
            return;
          }
          this.shots.splice(i, 1);
        }
      }
    }

    // Update Power-Up Capsules (Tempest 2000 & 3000)
    for (let i = this.capsules.length - 1; i >= 0; i--) {
      const c = this.capsules[i];
      c.z -= 0.42 * dt;
      if (c.z <= 0.03) {
        if (c.lane === this.lane) {
          arcadeAudio.playSuperTransform();
          const pos = this.laneCenter(c.lane, 0);
          spawnBurst(this.particles, pos.x, pos.y, '#FDE047', 16, 180, 3);
          if (c.kind === 'laser') {
            this.hasParticleLaser = true;
            this.popups.push({ x: pos.x, y: pos.y - 18, text: 'PARTICLE LASER!', color: '#38BDF8', life: 1.1, maxLife: 1.1 });
          } else if (c.kind === 'jump') {
            this.hasJump = true;
            this.popups.push({ x: pos.x, y: pos.y - 18, text: 'JUMP THRUSTER (UP)!', color: '#4ADE80', life: 1.1, maxLife: 1.1 });
          } else if (c.kind === 'droid') {
            this.droidCount = Math.min(this.variant === 'tempest3000' ? 2 : 1, this.droidCount + 1);
            this.popups.push({ x: pos.x, y: pos.y - 18, text: 'A.I. DROID ONLINE!', color: '#F472B6', life: 1.1, maxLife: 1.1 });
          } else {
            this.addScore(2000, c.lane, 0, '#FDE047');
          }
        }
        this.capsules.splice(i, 1);
      }
    }

    // Update enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.kind === 'spiker') {
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
      } else {
        if (e.z > 0.01) {
          e.z = Math.max(0, e.z - e.speed * dt);
          if (e.kind === 'flipper' && e.z < 0.7 && e.z > 0.1) {
            e.flipTimer -= dt;
            if (e.flipTimer <= 0) {
              e.flipTimer = 0.75 + Math.random() * 0.65;
              e.lane = this.wrapLane(e.lane + e.flipDir);
            }
          }
        } else {
          // On the rim! Flippers chase the player claw lane-by-lane!
          e.flipTimer -= dt;
          if (e.flipTimer <= 0) {
            e.flipTimer = Math.max(0.22, 0.46 - this.level * 0.02);
            const dir = this.shortestLaneDir(e.lane, this.lane);
            e.lane = this.wrapLane(e.lane + dir);
          }
        }
      }

      // Enemy shoots down lane
      e.fireCd -= dt;
      if (e.fireCd <= 0 && e.z > 0.18 && e.z < 0.85) {
        e.fireCd = 2.0 + Math.random() * 1.8;
        this.shots.push({ lane: e.lane, z: e.z, fromPlayer: false, speed: 0.72 + this.level * 0.04 });
      }

      // Rim collision with Blaster Claw
      if (e.z <= 0.035 && e.lane === this.lane && this.jumpHeight < 0.22) {
        this.enemies.splice(i, 1);
        this.loseLife();
        return;
      }
    }

    // Stage Clear -> initiate 3D Warp Flight!
    if (this.remainingToSpawn <= 0 && this.enemies.length === 0) {
      this.addScore(1000 + this.level * 250, this.lane, 0.2, '#4ADE80');
      arcadeAudio.playStageClear();
      this.phase = 'STAGE_CLEAR';
      this.warpProgress = 0;
    }
  }

  private handleLaneSteering(dt: number): void {
    // Pointer spinner aim maps mouse angle around tube center directly to nearest lane!
    if (this.input.pointerActive) {
      const px = this.input.pointerX * LOGICAL_W;
      const py = this.input.pointerY * LOGICAL_H;
      let bestLane = this.lane;
      let bestDist = Infinity;
      for (let i = 0; i < this.laneCount; i++) {
        const c = this.laneCenter(i, 0);
        const d = Math.hypot(px - c.x, py - c.y);
        if (d < bestDist) {
          bestDist = d;
          bestLane = i;
        }
      }
      this.lane = bestLane;
      return;
    }

    if (this.input.left && !this.input.right) {
      this.moveRepeatTimer -= dt;
      if (this.moveRepeatTimer <= 0) {
        this.lane = this.wrapLane(this.lane - 1);
        this.moveRepeatTimer = 0.078;
      }
    } else if (this.input.right && !this.input.left) {
      this.moveRepeatTimer -= dt;
      if (this.moveRepeatTimer <= 0) {
        this.lane = this.wrapLane(this.lane + 1);
        this.moveRepeatTimer = 0.078;
      }
    } else {
      this.moveRepeatTimer = 0;
    }
  }

  private shortestLaneDir(from: number, to: number): 1 | -1 {
    if (!this.tube.closed) return to >= from ? 1 : -1;
    const cw = (to - from + this.laneCount) % this.laneCount;
    const ccw = (from - to + this.laneCount) % this.laneCount;
    return cw <= ccw ? 1 : -1;
  }

  private destroyEnemy(idx: number): void {
    const e = this.enemies[idx];
    this.enemies.splice(idx, 1);
    const pos = this.laneCenter(e.lane, e.z);
    const color =
      e.kind === 'flipper'
        ? '#F43F5E'
        : e.kind === 'tanker'
        ? '#A855F7'
        : e.kind === 'spiker'
        ? '#4ADE80'
        : '#FACC15';
    const pts = e.kind === 'fuseball' ? 750 : e.kind === 'tanker' ? 250 : 150;
    spawnBurst(this.particles, pos.x, pos.y, color, 16, 200, 3);
    arcadeAudio.playExplosion(e.kind === 'tanker');
    this.addScore(pts, e.lane, e.z, color);

    // Tanker splits into 2 Flippers!
    if (e.kind === 'tanker') {
      for (const dir of [-1, 1] as const) {
        this.enemies.push({
          id: this.nextEnemyId++,
          kind: 'flipper',
          lane: this.wrapLane(e.lane + dir),
          z: e.z,
          speed: e.speed * 1.15,
          flipTimer: 0.4,
          flipDir: dir,
          retreating: false,
          fireCd: 1.5,
        });
      }
    }

    // Tempest 2000 & 3000 drop glowing Power-Up Capsules!
    if (this.variant !== 'tempest' && Math.random() < (this.variant === 'tempest3000' ? 0.24 : 0.17)) {
      let kind: PowerUpCapsule['kind'] = 'points';
      if (!this.hasParticleLaser) kind = 'laser';
      else if (!this.hasJump) kind = 'jump';
      else if (this.droidCount < (this.variant === 'tempest3000' ? 2 : 1)) kind = 'droid';
      this.capsules.push({ lane: e.lane, z: e.z, kind });
    }
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.save();
    ctx.scale(dpr, dpr);

    // Deep vector void / psychedelic prism backdrop
    if (this.variant === 'tempest3000') {
      const bg = ctx.createRadialGradient(CX, CY, 30, CX, CY, 440);
      bg.addColorStop(0, `hsla(${(this.clock * 45) % 360}, 65%, 14%, 1)`);
      bg.addColorStop(1, '#04030D');
      ctx.fillStyle = bg;
    } else if (this.variant === 'tempest2000') {
      const bg = ctx.createRadialGradient(CX, CY, 20, CX, CY, 420);
      bg.addColorStop(0, `hsla(${(this.clock * 32 + 220) % 360}, 60%, 10%, 1)`);
      bg.addColorStop(1, '#030510');
      ctx.fillStyle = bg;
    } else {
      ctx.fillStyle = '#02040A';
    }
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // Warp star streaks
    ctx.save();
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2 + this.clock * 0.12;
      const cycle = ((this.clock * (this.phase === 'STAGE_CLEAR' ? 1.8 : 0.35) + i * 0.19) % 1);
      const r0 = 28 + cycle * 360;
      const r1 = r0 + (this.phase === 'STAGE_CLEAR' ? 38 : 8);
      ctx.strokeStyle = `rgba(148, 163, 184, ${cycle * 0.35})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(CX + Math.cos(a) * r0, CY + Math.sin(a) * r0);
      ctx.lineTo(CX + Math.cos(a) * r1, CY + Math.sin(a) * r1);
      ctx.stroke();
    }
    ctx.restore();

    // Draw 3D Tube Web
    const baseHue = (this.level * 52 + (this.variant !== 'tempest' ? this.clock * 38 : 0)) % 360;
    const webColor =
      this.variant === 'tempest' ? this.tube.color : `hsl(${baseHue}, 92%, 60%)`;

    // Tempest 3000 translucent prism facet fills!
    if (this.variant === 'tempest3000') {
      for (let i = 0; i < this.laneCount; i++) {
        const v0 = this.tube.vertices[i];
        const v1 = this.tube.vertices[(i + 1) % this.tube.vertices.length];
        const o0 = this.projectVertex(v0.x, v0.y, 0);
        const o1 = this.projectVertex(v1.x, v1.y, 0);
        const f0 = this.projectVertex(v0.x, v0.y, 1);
        const f1 = this.projectVertex(v1.x, v1.y, 1);
        ctx.fillStyle =
          i === this.lane
            ? `hsla(${(baseHue + 60) % 360}, 95%, 55%, 0.24)`
            : `hsla(${(baseHue + i * 16) % 360}, 85%, 45%, 0.08)`;
        ctx.beginPath();
        ctx.moveTo(o0.x, o0.y);
        ctx.lineTo(o1.x, o1.y);
        ctx.lineTo(f1.x, f1.y);
        ctx.lineTo(f0.x, f0.y);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Active lane highlight
    {
      const v0 = this.tube.vertices[this.lane];
      const v1 = this.tube.vertices[(this.lane + 1) % this.tube.vertices.length];
      const o0 = this.projectVertex(v0.x, v0.y, 0);
      const o1 = this.projectVertex(v1.x, v1.y, 0);
      const f0 = this.projectVertex(v0.x, v0.y, 1);
      const f1 = this.projectVertex(v1.x, v1.y, 1);
      ctx.fillStyle = 'rgba(250, 204, 21, 0.14)';
      ctx.beginPath();
      ctx.moveTo(o0.x, o0.y);
      ctx.lineTo(o1.x, o1.y);
      ctx.lineTo(f1.x, f1.y);
      ctx.lineTo(f0.x, f0.y);
      ctx.closePath();
      ctx.fill();
    }

    // Depth rings (far rim, mid-depth rings for Tempest 2000/3000, outer rim)
    const rings = this.variant === 'tempest' ? [1.0, 0.0] : [1.0, 0.62, 0.3, 0.0];
    for (const rz of rings) {
      ctx.save();
      ctx.strokeStyle = rz === 0 ? webColor : `rgba(148, 197, 255, ${rz === 1 ? 0.5 : 0.22})`;
      ctx.lineWidth = rz === 0 ? 2.6 : 1.3;
      if (rz === 0) {
        ctx.shadowColor = webColor;
        ctx.shadowBlur = 10;
      }
      ctx.beginPath();
      this.tube.vertices.forEach((v, idx) => {
        const p = this.projectVertex(v.x, v.y, rz);
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      if (this.tube.closed) ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    // Longitudinal lane rails
    ctx.save();
    for (let i = 0; i < this.tube.vertices.length; i++) {
      const v = this.tube.vertices[i];
      const o = this.projectVertex(v.x, v.y, 0);
      const f = this.projectVertex(v.x, v.y, 1);
      const isPlayerEdge = i === this.lane || i === (this.lane + 1) % this.tube.vertices.length;
      ctx.strokeStyle = isPlayerEdge ? '#FACC15' : webColor;
      ctx.lineWidth = isPlayerEdge ? 2.6 : 1.5;
      ctx.beginPath();
      ctx.moveTo(f.x, f.y);
      ctx.lineTo(o.x, o.y);
      ctx.stroke();
    }
    ctx.restore();

    // Spikes left by Spikers
    for (let i = 0; i < this.laneCount; i++) {
      const sp = this.spikes[i];
      if (sp <= 0.02) continue;
      const far = this.laneCenter(i, 1.0);
      const tip = this.laneCenter(i, 1.0 - sp);
      ctx.save();
      ctx.strokeStyle = '#4ADE80';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#4ADE80';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(far.x, far.y);
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Power-Up Capsules
    for (const c of this.capsules) {
      const p = this.laneCenter(c.lane, c.z);
      const sc = 1 / (1 + c.z * 2.5);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.fillStyle =
        c.kind === 'laser' ? '#38BDF8' : c.kind === 'jump' ? '#4ADE80' : c.kind === 'droid' ? '#F472B6' : '#FDE047';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.roundRect(-11 * sc, -7 * sc, 22 * sc, 14 * sc, 6 * sc);
      ctx.fill();
      ctx.fillStyle = '#04060D';
      ctx.font = `800 ${Math.max(8, Math.round(10 * sc))}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(c.kind[0].toUpperCase(), 0, 0.5);
      ctx.restore();
    }

    // Enemies (drawn far-to-near)
    const sortedEnemies = [...this.enemies].sort((a, b) => b.z - a.z);
    for (const e of sortedEnemies) {
      const p = this.laneCenter(e.lane, e.z);
      const sc = Math.max(0.32, 1 / (1 + e.z * 2.6));
      this.drawEnemy(ctx, e, p.x, p.y, p.angle, sc);
    }

    // Shots
    for (const s of this.shots) {
      const p = this.laneCenter(s.lane, s.z);
      const sc = Math.max(0.35, 1 / (1 + s.z * 2.5));
      ctx.save();
      ctx.translate(p.x, p.y);
      if (s.fromPlayer) {
        ctx.fillStyle = this.hasParticleLaser ? '#38BDF8' : '#FDE047';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, 5.5 * sc, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(0, 0, 2.5 * sc, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = '#FB7185';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(0, 0, 5 * sc, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // AI Droid Wingmen
    for (let d = 0; d < this.droidCount; d++) {
      const a = this.droidAngle + d * Math.PI;
      const dx = CX + Math.cos(a) * 145;
      const dy = CY + Math.sin(a) * 145;
      ctx.save();
      ctx.translate(dx, dy);
      ctx.rotate(this.clock * 4);
      ctx.strokeStyle = '#F472B6';
      ctx.lineWidth = 2.4;
      ctx.shadowColor = '#F472B6';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(10, 0);
      ctx.lineTo(0, 10);
      ctx.lineTo(-10, 0);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    // Blaster Claw on Outer Rim
    if (this.phase !== 'GAME_OVER') {
      const blink = this.invulnTimer > 0 && Math.floor(this.clock * 16) % 2 === 0;
      if (!blink) {
        const c = this.laneCenter(this.lane, 0, this.jumpHeight);
        const inward = Math.atan2(CY - c.y, CX - c.x);
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(inward);
        ctx.fillStyle = this.variant === 'tempest3000' ? '#38BDF8' : '#FACC15';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(22, 0);
        ctx.lineTo(-6, -17);
        ctx.lineTo(-14, -9);
        ctx.lineTo(-4, 0);
        ctx.lineTo(-14, 9);
        ctx.lineTo(-6, 17);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.8;
        ctx.stroke();
        ctx.restore();
      }
    }

    // Superzapper lightning surge
    if (this.zapperFlash > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(56, 189, 248, ${this.zapperFlash * 0.7})`;
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
      ctx.restore();
    }

    renderParticlesAndPopups(ctx, this.particles, this.popups);

    // Minimal crisp top HUD inside canvas
    ctx.save();
    ctx.font = '700 14px "JetBrains Mono", monospace';
    ctx.fillStyle = '#FACC15';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${this.score.toLocaleString()}`, 22, 32);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#38BDF8';
    ctx.fillText(`LEVEL ${this.level} · ${this.tube.name.toUpperCase()}`, CX, 32);
    ctx.textAlign = 'right';
    ctx.fillStyle = this.zapperUses > 0 ? '#4ADE80' : '#64748B';
    ctx.fillText(
      this.zapperUses === 2 ? 'ZAPPER FULL' : this.zapperUses === 1 ? 'ZAPPER 1×' : 'ZAPPER EMPTY',
      LOGICAL_W - 22,
      32
    );
    ctx.restore();

    if (this.phase === 'READY' || this.phase === 'STAGE_CLEAR') {
      ctx.save();
      ctx.fillStyle = 'rgba(4, 6, 15, 0.76)';
      ctx.fillRect(CX - 180, CY - 34, 360, 68);
      ctx.strokeStyle = webColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(CX - 180, CY - 34, 360, 68);
      ctx.font = '800 22px "Outfit", sans-serif';
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

    if (visualMode === 'crt') {
      renderCrtOverlay(ctx, LOGICAL_W, LOGICAL_H);
    }
    ctx.restore();
  }

  private drawEnemy(
    ctx: CanvasRenderingContext2D,
    e: TempestEnemy,
    x: number,
    y: number,
    angle: number,
    sc: number
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(sc, sc);

    if (e.kind === 'flipper') {
      ctx.strokeStyle = '#F43F5E';
      ctx.fillStyle = 'rgba(244, 63, 94, 0.25)';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(-16, -10);
      ctx.lineTo(16, 10);
      ctx.lineTo(16, -10);
      ctx.lineTo(-16, 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (e.kind === 'tanker') {
      ctx.strokeStyle = '#C084FC';
      ctx.fillStyle = 'rgba(168, 85, 247, 0.35)';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(0, -15);
      ctx.lineTo(16, 0);
      ctx.lineTo(0, 15);
      ctx.lineTo(-16, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(-4, -4, 8, 8);
    } else if (e.kind === 'spiker') {
      ctx.rotate(this.clock * 7);
      ctx.strokeStyle = '#4ADE80';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * 14, Math.sin(a) * 14);
      }
      ctx.stroke();
    } else {
      // Fuseball crackling plasma orb
      ctx.rotate(this.clock * 9);
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const r = k % 2 === 0 ? 15 : 5;
        if (k === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }

  public getHudSnapshot(): ClassicGameHud {
    const upgrades: string[] = [];
    if (this.hasParticleLaser) upgrades.push('Laser');
    if (this.hasJump) upgrades.push('Jump');
    if (this.droidCount > 0) upgrades.push(`Droid×${this.droidCount}`);

    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: `${this.getTitleName()} · ${this.tube.name}`,
      primaryMetricLabel: 'Superzapper',
      primaryMetricValue: this.zapperUses === 2 ? 'Full' : this.zapperUses === 1 ? '1× Left' : 'Spent',
      secondaryMetricLabel: this.variant === 'tempest' ? 'Remaining' : 'Systems',
      secondaryMetricValue:
        this.variant === 'tempest'
          ? `${this.remainingToSpawn + this.enemies.length}`
          : upgrades.length > 0
          ? upgrades.join('+')
          : 'Standard',
      bannerText: '',
    };
  }
}

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

type Sh2Sector = 'HIGHWAY' | 'DESERT CANYON' | 'ALPINE SNOW' | 'TWILIGHT FOREST';
type Sh2Weapon = 'OIL SLICK' | 'SMOKESCREEN' | 'SEEKER MISSILES' | 'FLAME JETS';
type Sh2EnemyKind = 'switchblade_bike' | 'road_lord' | 'enforcer_truck' | 'molotov_maniac' | 'weapons_van';

interface Sh2Entity {
  id: number;
  kind: Sh2EnemyKind;
  z: number; // distance ahead 0..1000
  lane: number; // -1.1 .. 1.1 across road width
  speed: number;
  hp: number;
  spinTimer: number;
  shootCd: number;
}

interface Sh2Projectile {
  z: number;
  lane: number;
  vz: number;
  fromPlayer: boolean;
  isMissile: boolean;
  isMolotov: boolean;
}

interface Sh2PyroGyro {
  active: boolean;
  x: number;
  y: number;
  hp: number;
  fireCd: number;
  phase: number;
}

export class SpyHunter2ArcadeGame implements ArcadeGameInstance {
  public readonly logicalWidth = 840;
  public readonly logicalHeight = 640;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'TWIN GUNS';
  public readonly secondaryActionLabel = 'SPECIAL WEAPON';

  private readonly storageKey = 'retro_arcade_spyhunter2_3d_hs_v1';

  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();

  private score = 0;
  private highScore = 0;
  private sectorIdx = 0;
  private lives = 3;
  private nextExtraLife = 30000;

  // Player G-8155 White Interceptor (3D Behind-the-Car Chase!)
  private playerLane = 0; // -1..1
  private playerSteerVel = 0;
  private speed = 280; // road z-units per second
  private distance = 0;
  private roadCurve = 0;
  private targetCurve = 0;
  private curveTimer = 3;
  private invulnTimer = 0;
  private gunCd = 0;
  private specialCd = 0;
  private flameBurstTimer = 0;

  // Authentic 2P Split-Bezel Tribute: AI Yellow Wingman Interceptor!
  private wingmanLane = 0.55;
  private wingmanZ = 140;
  private wingmanFireCd = 0.8;

  // Spy Hunter II Weapon Loadout
  private activeWeapon: Sh2Weapon = 'SEEKER MISSILES';
  private specialAmmo = 6;
  private wheelSpikesTimer = 0;

  // 3D Road Entities
  private entities: Sh2Entity[] = [];
  private projectiles: Sh2Projectile[] = [];
  private gyro: Sh2PyroGyro = { active: false, x: 420, y: 120, hp: 5, fireCd: 1.5, phase: 0 };
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];
  private nextId = 1;
  private spawnCd = 0.7;
  private vanCd = 15;
  private gyroCd = 22;
  private screenShake = 0;
  private clock = 0;
  private readyTimer = 0;

  private readonly sectors: Sh2Sector[] = [
    'HIGHWAY',
    'DESERT CANYON',
    'ALPINE SNOW',
    'TWILIGHT FOREST',
  ];

  constructor() {
    this.highScore = readHighScore(this.storageKey);
  }

  public startNewGame(): void {
    arcadeAudio.unlock();
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.sectorIdx = 0;
    this.lives = 3;
    this.nextExtraLife = 30000;
    this.playerLane = -0.25;
    this.playerSteerVel = 0;
    this.speed = 290;
    this.distance = 0;
    this.roadCurve = 0;
    this.targetCurve = 0;
    this.invulnTimer = 2.0;
    this.activeWeapon = 'SEEKER MISSILES';
    this.specialAmmo = 6;
    this.wheelSpikesTimer = 0;
    this.flameBurstTimer = 0;
    this.entities = [];
    this.projectiles = [];
    this.particles = [];
    this.popups = [];
    this.gyro.active = false;
    this.vanCd = 14;
    this.gyroCd = 20;
    this.phase = 'READY';
    this.readyTimer = 1.05;
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  // Pseudo-3D behind-the-car projection helper
  private projectRoadPoint(z: number, lane: number): { x: number; y: number; scale: number } {
    const horizonY = 212;
    const roadBottomY = 620;
    const depth = Math.max(0.02, Math.min(1, z / 1000));
    const persp = 1 / (1 + depth * 9.5); // 1 near camera, ~0.095 at horizon
    const y = horizonY + (roadBottomY - horizonY) * persp;
    const curveShift = this.roadCurve * Math.pow(1 - persp, 2) * 340;
    const halfRoadW = 36 + persp * 330;
    const x = this.logicalWidth * 0.5 + curveShift + lane * halfRoadW;
    return { x, y, scale: persp };
  }

  private addScore(pts: number, x?: number, y?: number, color = '#fde047', label?: string): void {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(this.storageKey, this.highScore);
    }
    if (this.score >= this.nextExtraLife) {
      this.lives = Math.min(5, this.lives + 1);
      this.nextExtraLife += 35000;
      arcadeAudio.playExtraLife();
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

  private crashPlayer(reason: string): void {
    this.lives--;
    this.screenShake = 16;
    arcadeAudio.playExplosion(true);
    const p = this.projectRoadPoint(70, this.playerLane);
    spawnBurst(this.particles, p.x, p.y - 20, '#f97316', 32, 260, 4.4);
    this.popups.push({
      x: p.x,
      y: p.y - 45,
      text: reason,
      color: '#f87171',
      life: 1.2,
      maxLife: 1.2,
    });
    if (this.lives <= 0) {
      this.phase = 'GAME_OVER';
    } else {
      this.playerLane = 0;
      this.playerSteerVel = 0;
      this.speed = 240;
      this.invulnTimer = 2.2;
      this.entities = this.entities.filter((e) => e.z > 240);
    }
  }

  private fireSpecial(): void {
    if (this.specialCd > 0 || this.specialAmmo <= 0) return;
    this.specialAmmo--;
    this.specialCd = 0.42;

    if (this.activeWeapon === 'SEEKER MISSILES') {
      this.projectiles.push({
        z: 85,
        lane: this.playerLane,
        vz: 780,
        fromPlayer: true,
        isMissile: true,
        isMolotov: false,
      });
      arcadeAudio.playXWingQuadLaser(true);
    } else if (this.activeWeapon === 'FLAME JETS') {
      this.flameBurstTimer = 1.6;
      this.wheelSpikesTimer = 4.0;
      arcadeAudio.playFlame();
      // Blast any close-range pursuers!
      for (let i = this.entities.length - 1; i >= 0; i--) {
        const e = this.entities[i];
        if (e.kind !== 'weapons_van' && e.z < 240) {
          const pt = this.projectRoadPoint(e.z, e.lane);
          this.addScore(500, pt.x, pt.y - 20, '#fb923c', 'TORCHED +500!');
          spawnBurst(this.particles, pt.x, pt.y, '#fb923c', 22, 220, 3.8);
          this.entities.splice(i, 1);
        }
      }
    } else {
      // OIL SLICK / SMOKESCREEN spins out closest enemies!
      arcadeAudio.playSpray();
      const p = this.projectRoadPoint(70, this.playerLane);
      spawnBurst(this.particles, p.x, p.y, this.activeWeapon === 'OIL SLICK' ? '#334155' : '#e2e8f0', 22, 180, 4.2);
      for (const e of this.entities) {
        if (e.kind !== 'weapons_van' && e.z < 360 && Math.abs(e.lane - this.playerLane) < 0.55) {
          e.spinTimer = 1.4;
        }
      }
    }
  }

  public step(dt: number): void {
    this.clock += dt;
    if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - dt * 28);
    stepParticlesAndPopups(this.particles, this.popups, dt);

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

    if (this.invulnTimer > 0) this.invulnTimer -= dt;
    if (this.gunCd > 0) this.gunCd -= dt;
    if (this.specialCd > 0) this.specialCd -= dt;
    if (this.flameBurstTimer > 0) this.flameBurstTimer -= dt;
    if (this.wheelSpikesTimer > 0) this.wheelSpikesTimer -= dt;

    // Throttle & 3D Curve Centrifugal Feel!
    const accel = this.input.up ? 1 : this.input.down ? -1 : 0;
    const targetSpd = accel > 0 ? 540 : accel < 0 ? 185 : 340;
    this.speed += (targetSpd - this.speed) * Math.min(1, dt * 3.8);

    this.curveTimer -= dt;
    if (this.curveTimer <= 0) {
      this.curveTimer = 2.6 + Math.random() * 2.8;
      this.targetCurve = (Math.random() - 0.5) * 1.65;
    }
    this.roadCurve += (this.targetCurve - this.roadCurve) * Math.min(1, dt * 1.1);

    const steer =
      Math.abs(this.input.analogX ?? 0) > 0.08
        ? this.input.analogX!
        : (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    const grip = this.sectors[this.sectorIdx] === 'ALPINE SNOW' ? 4.2 : 9.5;
    this.playerSteerVel += (steer * 2.15 * (this.input.moveScale ?? 0.9) - this.playerSteerVel) * Math.min(1, dt * grip);
    // Centrifugal pull on sweeping curves!
    this.playerLane += (this.playerSteerVel - this.roadCurve * (this.speed / 540) * 0.42) * dt;
    this.playerLane = Math.max(-1.18, Math.min(1.18, this.playerLane));

    // Off-road shoulder rumble & slowdown
    if (Math.abs(this.playerLane) > 0.98) {
      this.speed = Math.max(150, this.speed - 280 * dt);
      this.screenShake = Math.max(this.screenShake, 2.5);
    }

    const dStep = this.speed * dt;
    this.distance += dStep;
    if (Math.floor(this.distance / 30) > Math.floor((this.distance - dStep) / 30)) {
      this.addScore(20);
    }
    // Advance sector every 4800 distance units
    const newSec = Math.floor(this.distance / 4800) % this.sectors.length;
    if (newSec !== this.sectorIdx) {
      this.sectorIdx = newSec;
      this.popups.push({
        x: this.logicalWidth * 0.5,
        y: 165,
        text: `SECTOR: ${this.sectors[this.sectorIdx]}`,
        color: '#38bdf8',
        life: 1.6,
        maxLife: 1.6,
      });
    }

    // Yellow Wingman AI Interceptor (2P Spy Hunter II homage!)
    const targetWingLane = this.playerLane > 0 ? -0.58 : 0.58;
    this.wingmanLane += (targetWingLane - this.wingmanLane) * dt * 2.2;
    this.wingmanZ = 155 + Math.sin(this.clock * 1.4) * 40;
    this.wingmanFireCd -= dt;
    if (this.wingmanFireCd <= 0 && this.entities.some((e) => e.kind !== 'weapons_van' && Math.abs(e.lane - this.wingmanLane) < 0.35)) {
      this.wingmanFireCd = 0.55;
      this.projectiles.push({
        z: this.wingmanZ + 20,
        lane: this.wingmanLane,
        vz: 760,
        fromPlayer: true,
        isMissile: false,
        isMolotov: false,
      });
    }

    // Fire Twin Machine Guns / Special Gadget
    if (this.input.fire && this.gunCd <= 0) {
      this.gunCd = 0.11;
      this.projectiles.push({
        z: 82,
        lane: this.playerLane - 0.06,
        vz: 840,
        fromPlayer: true,
        isMissile: false,
        isMolotov: false,
      });
      this.projectiles.push({
        z: 82,
        lane: this.playerLane + 0.06,
        vz: 840,
        fromPlayer: true,
        isMissile: false,
        isMolotov: false,
      });
      arcadeAudio.playLaser(980, 380, 0.05);
    }
    if (this.input.secondaryJustPressed) {
      this.fireSpecial();
    }

    // Spawn Weapons Van periodically
    this.vanCd -= dt;
    if (this.vanCd <= 0 && !this.entities.some((e) => e.kind === 'weapons_van')) {
      this.vanCd = 22;
      this.entities.push({
        id: this.nextId++,
        kind: 'weapons_van',
        z: 960,
        lane: 0,
        speed: 190,
        hp: 999,
        spinTimer: 0,
        shootCd: 99,
      });
      arcadeAudio.playSirenSweep();
    }

    // Spawn Pyro Gyro Chopper overhead!
    this.gyroCd -= dt;
    if (!this.gyro.active && this.gyroCd <= 0) {
      this.gyro = { active: true, x: 420, y: 120, hp: 5, fireCd: 1.5, phase: 0 };
      this.gyroCd = 25;
      arcadeAudio.playSirenSweep();
    }
    if (this.gyro.active) {
      this.gyro.phase += dt * 3;
      this.gyro.x = this.logicalWidth * 0.5 + Math.sin(this.gyro.phase * 0.8) * 220;
      this.gyro.y = 128 + Math.cos(this.gyro.phase * 1.4) * 26;
      this.gyro.fireCd -= dt;
      if (this.gyro.fireCd <= 0) {
        this.gyro.fireCd = 1.65;
        this.projectiles.push({
          z: 540,
          lane: this.playerLane + (Math.random() - 0.5) * 0.25,
          vz: -360,
          fromPlayer: false,
          isMissile: false,
          isMolotov: true,
        });
      }
    }

    // Spawn Spy Hunter II Enemies
    this.spawnCd -= dt;
    if (this.spawnCd <= 0 && this.entities.length < 7) {
      this.spawnCd = 0.95;
      const roll = Math.random();
      const kind: Sh2EnemyKind =
        roll < 0.32
          ? 'switchblade_bike'
          : roll < 0.58
            ? 'road_lord'
            : roll < 0.8
              ? 'enforcer_truck'
              : 'molotov_maniac';
      this.entities.push({
        id: this.nextId++,
        kind,
        z: 980,
        lane: (Math.random() - 0.5) * 1.5,
        speed: kind === 'switchblade_bike' ? 235 : 175,
        hp: kind === 'road_lord' ? 5 : kind === 'enforcer_truck' ? 4 : 2,
        spinTimer: 0,
        shootCd: 1.4,
      });
    }

    // Update 3D Entities
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      e.z -= (this.speed - e.speed) * dt;

      if (e.spinTimer > 0) {
        e.spinTimer -= dt;
        e.lane += (e.lane >= 0 ? 1 : -1) * 1.8 * dt;
        if (Math.abs(e.lane) > 1.3) {
          const pt = this.projectRoadPoint(Math.max(40, e.z), e.lane);
          this.addScore(450, pt.x, pt.y - 20, '#fde047', 'WIPEOUT +450!');
          arcadeAudio.playExplosion(false);
          spawnBurst(this.particles, pt.x, pt.y, '#f97316', 18, 200, 3.5);
          this.entities.splice(i, 1);
          continue;
        }
      } else if (e.kind !== 'weapons_van') {
        // Aggressive lane-weaving AI
        if (e.z < 460 && e.z > 80) {
          const dLane = this.playerLane - e.lane;
          e.lane += Math.sign(dLane) * Math.min(Math.abs(dLane), 0.52 * dt);
        }
        if (e.kind === 'molotov_maniac' || e.kind === 'enforcer_truck') {
          e.shootCd -= dt;
          if (e.shootCd <= 0 && e.z > 140 && e.z < 680) {
            e.shootCd = 1.7;
            this.projectiles.push({
              z: e.z - 15,
              lane: e.lane,
              vz: -390,
              fromPlayer: false,
              isMissile: false,
              isMolotov: e.kind === 'molotov_maniac',
            });
          }
        }
      }

      // Collision with Player Car (z ≈ 70)
      if (e.z < 115 && e.z > 30 && Math.abs(e.lane - this.playerLane) < 0.28) {
        if (e.kind === 'weapons_van') {
          const cycle: Sh2Weapon[] = ['SEEKER MISSILES', 'FLAME JETS', 'OIL SLICK', 'SMOKESCREEN'];
          this.activeWeapon = cycle[(cycle.indexOf(this.activeWeapon) + 1) % cycle.length];
          this.specialAmmo += 5;
          this.wheelSpikesTimer = 10;
          arcadeAudio.playPowerUp();
          const pt = this.projectRoadPoint(75, this.playerLane);
          this.popups.push({
            x: pt.x,
            y: pt.y - 50,
            text: `REARMED: ${this.activeWeapon} +5!`,
            color: '#4ade80',
            life: 1.5,
            maxLife: 1.5,
          });
          this.entities.splice(i, 1);
          continue;
        } else if (this.wheelSpikesTimer > 0) {
          // Spiked wheels shred enemies on side ram!
          const pt = this.projectRoadPoint(e.z, e.lane);
          this.addScore(500, pt.x, pt.y - 24, '#38bdf8', 'SPIKE SHRED +500!');
          arcadeAudio.playExplosion(false);
          spawnBurst(this.particles, pt.x, pt.y, '#38bdf8', 22, 220, 3.6);
          this.entities.splice(i, 1);
          continue;
        } else if (this.invulnTimer <= 0) {
          this.crashPlayer(`RAMMED BY ${e.kind.replace('_', ' ').toUpperCase()}!`);
          return;
        }
      }

      if (e.z < -40 || e.z > 1060) this.entities.splice(i, 1);
    }

    // Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.z += pr.vz * dt;
      if (pr.z < 0 || pr.z > 1000) {
        this.projectiles.splice(i, 1);
        continue;
      }
      if (pr.fromPlayer) {
        // Seeker Missile hits Pyro Gyro Helicopter!
        if (pr.isMissile && this.gyro.active && pr.z > 520) {
          this.gyro.hp -= 3;
          this.projectiles.splice(i, 1);
          if (this.gyro.hp <= 0) {
            this.gyro.active = false;
            this.addScore(2000, this.gyro.x, this.gyro.y, '#fde047', 'PYRO GYRO DOWN +2000!');
            arcadeAudio.playExplosion(true);
            spawnBurst(this.particles, this.gyro.x, this.gyro.y, '#f97316', 36, 260, 4.4);
          }
          continue;
        }
        // Hit road enemies
        let hit = false;
        for (let ei = this.entities.length - 1; ei >= 0; ei--) {
          const e = this.entities[ei];
          if (e.kind === 'weapons_van') continue;
          if (Math.abs(e.z - pr.z) < 55 && Math.abs(e.lane - pr.lane) < 0.25) {
            e.hp -= pr.isMissile ? 5 : 1;
            const pt = this.projectRoadPoint(e.z, e.lane);
            if (e.hp <= 0) {
              this.addScore(400, pt.x, pt.y - 20, '#fde047');
              arcadeAudio.playExplosion(false);
              spawnBurst(this.particles, pt.x, pt.y, '#f97316', 20, 210, 3.6);
              this.entities.splice(ei, 1);
            } else {
              spawnBurst(this.particles, pt.x, pt.y, '#fde047', 6, 130, 2.2);
            }
            hit = true;
            break;
          }
        }
        if (hit) this.projectiles.splice(i, 1);
      } else {
        if (this.invulnTimer <= 0 && pr.z < 105 && pr.z > 40 && Math.abs(pr.lane - this.playerLane) < 0.24) {
          this.projectiles.splice(i, 1);
          this.crashPlayer(pr.isMolotov ? 'MOLOTOV HIT!' : 'ENFORCER FIRE!');
          return;
        }
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

    const sec = this.sectors[this.sectorIdx];
    const horizonY = 212;

    // 1. Dramatic 3D Horizon Sky & Distant Mountain / Skyline Silhouettes!
    const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
    if (sec === 'DESERT CANYON') {
      sky.addColorStop(0, '#7c2d12');
      sky.addColorStop(1, '#fb923c');
    } else if (sec === 'ALPINE SNOW') {
      sky.addColorStop(0, '#0c4a6e');
      sky.addColorStop(1, '#bae6fd');
    } else if (sec === 'TWILIGHT FOREST') {
      sky.addColorStop(0, '#1e1b4b');
      sky.addColorStop(1, '#db2777');
    } else {
      sky.addColorStop(0, '#0f172a');
      sky.addColorStop(1, '#38bdf8');
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, this.logicalWidth, horizonY);

    // Distant parallax mountain range
    ctx.fillStyle = sec === 'DESERT CANYON' ? '#451a03' : sec === 'ALPINE SNOW' ? '#334155' : '#1e293b';
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    const shift = -this.roadCurve * 45;
    for (let x = -40; x <= this.logicalWidth + 60; x += 55) {
      const h = 28 + Math.abs(Math.sin((x + shift) * 0.014)) * 54;
      ctx.lineTo(x, horizonY - h);
    }
    ctx.lineTo(this.logicalWidth, horizonY);
    ctx.closePath();
    ctx.fill();

    // 2. Pseudo-3D Striated Ground & Sweeping Curved Highway!
    const bands = 42;
    const zPhase = (this.distance * 0.08) % 2;
    for (let i = bands - 1; i >= 0; i--) {
      const z0 = (i / bands) * 1000;
      const z1 = ((i + 1) / bands) * 1000;
      const p0L = this.projectRoadPoint(z0, -1);
      const p0R = this.projectRoadPoint(z0, 1);
      const p1L = this.projectRoadPoint(z1, -1);
      const p1R = this.projectRoadPoint(z1, 1);

      const stripe = Math.floor(i + zPhase) % 2 === 0;
      // Terrain shoulder strip
      ctx.fillStyle =
        sec === 'DESERT CANYON'
          ? stripe ? '#b45309' : '#92400e'
          : sec === 'ALPINE SNOW'
            ? stripe ? '#e2e8f0' : '#cbd5e1'
            : sec === 'TWILIGHT FOREST'
              ? stripe ? '#14532d' : '#0f3d21'
              : stripe ? '#166534' : '#14532d';
      ctx.fillRect(0, p1L.y, this.logicalWidth, Math.max(1.5, p0L.y - p1L.y + 1));

      // Asphalt highway quad
      ctx.fillStyle = stripe ? '#334155' : '#1e293b';
      ctx.beginPath();
      ctx.moveTo(p0L.x, p0L.y);
      ctx.lineTo(p0R.x, p0R.y);
      ctx.lineTo(p1R.x, p1R.y);
      ctx.lineTo(p1L.x, p1L.y);
      ctx.closePath();
      ctx.fill();

      // Red/white rumble curbs!
      const curbW0 = 14 * p0L.scale;
      const curbW1 = 14 * p1L.scale;
      ctx.fillStyle = stripe ? '#ef4444' : '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(p0L.x - curbW0, p0L.y);
      ctx.lineTo(p0L.x, p0L.y);
      ctx.lineTo(p1L.x, p1L.y);
      ctx.lineTo(p1L.x - curbW1, p1L.y);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(p0R.x, p0R.y);
      ctx.lineTo(p0R.x + curbW0, p0R.y);
      ctx.lineTo(p1R.x + curbW1, p1R.y);
      ctx.lineTo(p1R.x, p1R.y);
      ctx.closePath();
      ctx.fill();

      // Dashed yellow center highway lines
      if (stripe) {
        const c0 = (p0L.x + p0R.x) * 0.5;
        const c1 = (p1L.x + p1R.x) * 0.5;
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = Math.max(1, 5 * p0L.scale);
        ctx.beginPath();
        ctx.moveTo(c0, p0L.y);
        ctx.lineTo(c1, p1L.y);
        ctx.stroke();
      }
    }

    // 3. Draw Distant-to-Near 3D Entities (sorted back to front!)
    const sorted = [...this.entities].sort((a, b) => b.z - a.z);
    for (const e of sorted) {
      this.render3DEntity(ctx, e);
    }

    // 4. Draw Yellow Wingman Interceptor (2P Tribute!)
    const wingPt = this.projectRoadPoint(this.wingmanZ, this.wingmanLane);
    this.renderInterceptorCar(ctx, wingPt.x, wingPt.y, wingPt.scale * 0.95, '#facc15', '#ea580c', false, false);

    // 5. Draw 3D Projectiles
    for (const pr of this.projectiles) {
      const pt = this.projectRoadPoint(pr.z, pr.lane);
      const r = Math.max(2.5, (pr.isMissile || pr.isMolotov ? 9 : 5) * pt.scale);
      ctx.fillStyle = pr.isMolotov ? '#f97316' : pr.isMissile ? '#f43f5e' : '#fde047';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y - 12 * pt.scale, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6. Draw Player G-8155 White Interceptor (Foreground 3D Chase View!)
    if (this.invulnTimer <= 0 || Math.floor(this.clock * 18) % 2 === 0) {
      const pPt = this.projectRoadPoint(70, this.playerLane);
      this.renderInterceptorCar(
        ctx,
        pPt.x,
        pPt.y,
        pPt.scale * 1.15,
        '#f8fafc',
        '#38bdf8',
        this.wheelSpikesTimer > 0,
        this.flameBurstTimer > 0
      );
    }

    // 7. Hovering Pyro Gyro Chopper in Sky!
    if (this.gyro.active) {
      ctx.save();
      ctx.translate(this.gyro.x, this.gyro.y);
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, 34, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fde047';
      ctx.fillRect(-14, -6, 28, 8);
      // Spinning overhead rotor blur
      const rotorW = 52 + Math.sin(this.clock * 40) * 14;
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-rotorW, -18);
      ctx.lineTo(rotorW, -18);
      ctx.stroke();
      ctx.restore();
    }

    renderParticlesAndPopups(ctx, this.particles, this.popups);

    // Bottom Spy Hunter II Cockpit HUD Strip
    ctx.fillStyle = 'rgba(4, 8, 22, 0.92)';
    ctx.fillRect(0, this.logicalHeight - 36, this.logicalWidth, 36);
    ctx.font = '800 12px "JetBrains Mono", monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(
      `G-8155 SPECIAL: ${this.activeWeapon} (${this.specialAmmo})  ·  SPIKED WHEELS: ${this.wheelSpikesTimer > 0 ? 'ON' : 'OFF'}  ·  AI WINGMAN ACTIVE`,
      this.logicalWidth * 0.5,
      this.logicalHeight - 18
    );

    if (this.phase === 'TITLE') {
      this.renderTitleOverlay(ctx);
    } else if (this.phase === 'READY') {
      this.renderCenterBanner(ctx, 'SPY HUNTER II · G-8155 CHASE', '3D BEHIND-THE-CAR PURSUIT · BOARD THE WEAPONS VAN FOR MISSILES & FLAME JETS!', '#38bdf8');
    } else if (this.phase === 'GAME_OVER') {
      this.renderCenterBanner(ctx, 'INTERCEPTOR DESTROYED', `SCORE ${this.score.toLocaleString()} · PRESS SPACE TO LAUNCH AGAIN`, '#f87171');
    } else if (this.phase === 'PAUSED') {
      this.renderCenterBanner(ctx, 'PAUSED', 'PRESS P TO RESUME CHASE', '#38bdf8');
    }

    if (visualMode === 'crt') renderCrtOverlay(ctx, this.logicalWidth, this.logicalHeight);
    ctx.restore();
  }

  private render3DEntity(ctx: CanvasRenderingContext2D, e: Sh2Entity): void {
    const pt = this.projectRoadPoint(e.z, e.lane);
    const s = pt.scale;
    if (s < 0.08) return;
    ctx.save();
    ctx.translate(pt.x, pt.y);
    if (e.spinTimer > 0) ctx.rotate(Math.sin(this.clock * 22) * 0.45);

    if (e.kind === 'weapons_van') {
      const w = 108 * s;
      const h = 84 * s;
      ctx.fillStyle = '#dc2626';
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = Math.max(1.2, 3 * s);
      ctx.fillRect(-w * 0.5, -h, w, h);
      ctx.strokeRect(-w * 0.5, -h, w, h);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-w * 0.34, -h * 0.45, w * 0.68, h * 0.45);
      if (s > 0.25) {
        ctx.fillStyle = '#ffffff';
        ctx.font = `900 ${Math.max(8, Math.floor(14 * s))}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('WEAPONS VAN', 0, -h * 0.65);
      }
    } else if (e.kind === 'switchblade_bike') {
      const w = 34 * s;
      const h = 46 * s;
      ctx.fillStyle = '#0ea5e9';
      ctx.fillRect(-w * 0.5, -h, w, h);
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(0, -h * 0.8, 10 * s, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const w = (e.kind === 'enforcer_truck' ? 92 : 76) * s;
      const h = (e.kind === 'enforcer_truck' ? 68 : 48) * s;
      ctx.fillStyle =
        e.kind === 'road_lord'
          ? '#94a3b8'
          : e.kind === 'enforcer_truck'
            ? '#1e293b'
            : '#f97316';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = Math.max(1, 2.2 * s);
      ctx.beginPath();
      ctx.roundRect(-w * 0.5, -h, w, h, 6 * s);
      ctx.fill();
      ctx.stroke();
      // Rear taillights
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-w * 0.42, -h * 0.34, w * 0.2, h * 0.16);
      ctx.fillRect(w * 0.22, -h * 0.34, w * 0.2, h * 0.16);
    }
    ctx.restore();
  }

  private renderInterceptorCar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale: number,
    bodyCol: string,
    stripeCol: string,
    spikes: boolean,
    flames: boolean
  ): void {
    const w = 88 * scale;
    const h = 46 * scale;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.playerSteerVel * 0.04);

    // Shadow under chassis
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 4 * scale, w * 0.58, 10 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wide sports tires
    ctx.fillStyle = '#090d16';
    ctx.fillRect(-w * 0.54, -h * 0.45, w * 0.16, h * 0.52);
    ctx.fillRect(w * 0.38, -h * 0.45, w * 0.16, h * 0.52);

    // Spiked hubcap blades!
    if (spikes) {
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(-w * 0.54, -h * 0.24);
      ctx.lineTo(-w * 0.72, -h * 0.18);
      ctx.lineTo(-w * 0.54, -h * 0.12);
      ctx.moveTo(w * 0.54, -h * 0.24);
      ctx.lineTo(w * 0.72, -h * 0.18);
      ctx.lineTo(w * 0.54, -h * 0.12);
      ctx.fill();
    }

    // Low-slung wedge rear silhouette
    ctx.fillStyle = bodyCol;
    ctx.strokeStyle = stripeCol;
    ctx.lineWidth = Math.max(1.5, 2.5 * scale);
    ctx.beginPath();
    ctx.moveTo(-w * 0.48, -h * 0.12);
    ctx.lineTo(-w * 0.36, -h * 0.85);
    ctx.lineTo(w * 0.36, -h * 0.85);
    ctx.lineTo(w * 0.48, -h * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Rear tinted louvers
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-w * 0.28, -h * 0.78, w * 0.56, h * 0.28);

    // Glowing quad tail-lights
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-w * 0.4, -h * 0.34, w * 0.22, h * 0.14);
    ctx.fillRect(w * 0.18, -h * 0.34, w * 0.22, h * 0.14);

    // Afterburner / Flame Jet exhaust!
    if (flames || this.speed > 430) {
      ctx.fillStyle = flames ? '#fb923c' : '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(-w * 0.24, -h * 0.08);
      ctx.lineTo(-w * 0.14, (flames ? 36 : 16) * scale);
      ctx.lineTo(-w * 0.04, -h * 0.08);
      ctx.moveTo(w * 0.04, -h * 0.08);
      ctx.lineTo(w * 0.14, (flames ? 36 : 16) * scale);
      ctx.lineTo(w * 0.24, -h * 0.08);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderTitleOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(4, 8, 22, 0.78)';
    ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
    const cx = this.logicalWidth * 0.5;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fde047';
    ctx.font = '900 46px "JetBrains Mono", monospace';
    ctx.fillText('SPY HUNTER II', cx, 198);
    ctx.fillStyle = '#38bdf8';
    ctx.font = '800 15px "JetBrains Mono", monospace';
    ctx.fillText('1987 BALLY MIDWAY · 3D CHASE CAM · G-8155 INTERCEPTOR + AI WINGMAN', cx, 240);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 14px "JetBrains Mono", monospace';
    ctx.fillText('SWEPT 3D HIGHWAYS · DESERT CANYON · ALPINE SNOW · TWILIGHT FOREST', cx, 308);
    ctx.fillText('DRIVE INTO THE RED WEAPONS VAN FOR SEEKER MISSILES, FLAME JETS & SPIKES!', cx, 338);
    ctx.fillText('BLAST PYRO GYRO CHOPPERS, SWITCHBLADE BIKES & MOLOTOV MANIACS!', cx, 368);
    const pulse = 0.65 + 0.35 * Math.sin(this.clock * 6);
    ctx.fillStyle = `rgba(253, 224, 71, ${pulse})`;
    ctx.font = '900 20px "JetBrains Mono", monospace';
    ctx.fillText('PRESS SPACE TO ENGAGE 3D PURSUIT', cx, 456);
  }

  private renderCenterBanner(ctx: CanvasRenderingContext2D, title: string, sub: string, color: string): void {
    ctx.save();
    ctx.fillStyle = 'rgba(5, 8, 22, 0.85)';
    ctx.beginPath();
    ctx.roundRect(100, 250, this.logicalWidth - 200, 128, 14);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.font = '900 26px "JetBrains Mono", monospace';
    ctx.fillText(title, this.logicalWidth * 0.5, 298);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 13px "JetBrains Mono", monospace';
    ctx.fillText(sub, this.logicalWidth * 0.5, 342);
    ctx.restore();
  }

  public getHudSnapshot(): ClassicGameHud {
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.sectorIdx + 1,
      lives: this.lives,
      stageName: this.sectors[this.sectorIdx],
      primaryMetricLabel: 'SPEED',
      primaryMetricValue: `${Math.round(this.speed * 0.44)} MPH`,
      secondaryMetricLabel: 'AMMO',
      secondaryMetricValue: `${this.specialAmmo}`,
      bannerText: this.gyro.active
        ? 'PYRO GYRO OVERHEAD — LAUNCH SEEKER MISSILES!'
        : `3D CHASE · ${this.sectors[this.sectorIdx]}`,
    };
  }
}

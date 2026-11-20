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

export type DefenderVariant = 'defender' | 'defender2' | 'stargate';

interface Humanoid {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  state: 'walking' | 'abducted' | 'falling' | 'carried' | 'dead';
  abductorId: number | null;
  fallStartY: number;
}

type EnemyKind = 'lander' | 'mutant' | 'bomber' | 'pod' | 'swarmer' | 'baiter' | 'firebomber';

interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fireCd: number;
  targetHumanoidId: number | null;
  phase: number;
  hp: number;
}

interface LaserBeam {
  x: number;
  y: number;
  dir: 1 | -1;
  len: number;
  life: number;
  hue: number;
}

interface EnemyShot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  isMine: boolean;
  life: number;
}

const LOGICAL_W = 864;
const LOGICAL_H = 640;
const WORLD_W = 3456;
const SCANNER_H = 88;
const PLAY_TOP = SCANNER_H + 6;
const PLAY_BOTTOM = LOGICAL_H - 18;
const GROUND_BASE = LOGICAL_H - 56;

function wrapX(x: number): number {
  let r = x % WORLD_W;
  if (r < 0) r += WORLD_W;
  return r;
}

function deltaX(from: number, to: number): number {
  let d = to - from;
  if (d > WORLD_W * 0.5) d -= WORLD_W;
  if (d < -WORLD_W * 0.5) d += WORLD_W;
  return d;
}

export class DefenderGame implements ArcadeGameInstance {
  public readonly logicalWidth = LOGICAL_W;
  public readonly logicalHeight = LOGICAL_H;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'Laser';
  public readonly secondaryActionLabel = 'Smart Bomb';

  private variant: DefenderVariant;
  private storageKey: string;
  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();

  private score = 0;
  private highScore = 0;
  private nextExtraLife = 10000;
  private level = 1;
  private lives = 3;
  private smartBombs = 3;

  private clock = 0;
  private phaseTimer = 0;
  private screenFlash = 0;
  private planetDestroyed = false;
  private planetExplodeFlash = 0;

  // Player ship
  private shipX = WORLD_W * 0.5;
  private shipY = 320;
  private shipVx = 0;
  private shipVy = 0;
  private facing: 1 | -1 = 1;
  private fireCd = 0;
  private invulnTimer = 0;
  private cameraX = WORLD_W * 0.5 - LOGICAL_W * 0.35;
  private carriedHumanoidId: number | null = null;

  // Defender II / Stargate Inviso Cloak & Stargate Warp
  private invisoEnergy = 100;
  private invisoActive = false;
  private stargateX = WORLD_W * 0.25;
  private stargateY = 250;
  private warpCd = 0;
  private waveElapsed = 0;
  private baiterTimer = 28;

  private nextEntityId = 1;
  private terrainHeights: number[] = [];
  private stars: Array<{ x: number; y: number; r: number; c: string }> = [];
  private humanoids: Humanoid[] = [];
  private enemies: Enemy[] = [];
  private lasers: LaserBeam[] = [];
  private enemyShots: EnemyShot[] = [];
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  constructor(variant: DefenderVariant) {
    this.variant = variant;
    this.storageKey = `${variant}_hd_highscore_v1`;
    this.highScore = readHighScore(this.storageKey);
    this.buildTerrain();
    this.buildStars();
    this.setupAttract();
  }

  private getAccentColor(): string {
    if (this.variant === 'defender') return '#F59E0B';
    if (this.variant === 'defender2') return '#A855F7';
    return '#38BDF8';
  }

  private getTitleName(): string {
    if (this.variant === 'defender') return 'Defender';
    if (this.variant === 'defender2') return 'Defender II';
    return 'Stargate';
  }

  private buildTerrain(): void {
    const samples = 144;
    this.terrainHeights = [];
    for (let i = 0; i < samples; i++) {
      const t = (i / samples) * Math.PI * 2;
      const h =
        Math.sin(t * 3) * 24 +
        Math.sin(t * 7 + 1.1) * 18 +
        Math.cos(t * 13 + 2.4) * 11 +
        Math.sin(t * 23) * 6;
      this.terrainHeights.push(GROUND_BASE - Math.max(-18, h));
    }
  }

  private terrainYAt(worldX: number): number {
    if (this.planetDestroyed) return PLAY_BOTTOM - 10;
    const x = wrapX(worldX);
    const f = (x / WORLD_W) * this.terrainHeights.length;
    const i0 = Math.floor(f) % this.terrainHeights.length;
    const i1 = (i0 + 1) % this.terrainHeights.length;
    const frac = f - Math.floor(f);
    return this.terrainHeights[i0] * (1 - frac) + this.terrainHeights[i1] * frac;
  }

  private buildStars(): void {
    this.stars = [];
    const palette = ['#FFFFFF', '#93C5FD', '#FDE68A', '#F9A8D4', '#A5F3FC'];
    for (let i = 0; i < 110; i++) {
      this.stars.push({
        x: (i * 313 + 79) % WORLD_W,
        y: PLAY_TOP + 16 + ((i * 197 + 41) % (GROUND_BASE - PLAY_TOP - 80)),
        r: (i % 3 === 0 ? 1.7 : 1.1),
        c: palette[i % palette.length],
      });
    }
  }

  private setupAttract(): void {
    this.phase = 'TITLE';
    this.level = 1;
    this.planetDestroyed = false;
    this.spawnHumanoids();
    this.spawnWave(1);
    this.shipX = WORLD_W * 0.5;
    this.shipY = 300;
    this.cameraX = wrapX(this.shipX - LOGICAL_W * 0.32);
  }

  private spawnHumanoids(): void {
    this.humanoids = [];
    for (let i = 0; i < 10; i++) {
      const hx = wrapX((i + 0.5) * (WORLD_W / 10) + (Math.random() - 0.5) * 120);
      this.humanoids.push({
        id: this.nextEntityId++,
        x: hx,
        y: this.terrainYAt(hx) - 8,
        vx: (i % 2 === 0 ? 1 : -1) * (14 + Math.random() * 8),
        vy: 0,
        state: 'walking',
        abductorId: null,
        fallStartY: 0,
      });
    }
  }

  private spawnWave(wave: number): void {
    this.enemies = [];
    this.enemyShots = [];
    this.lasers = [];
    this.waveElapsed = 0;
    this.baiterTimer = Math.max(16, 30 - wave * 2);
    this.stargateX = wrapX(this.shipX + WORLD_W * 0.48);
    this.stargateY = 230 + (wave % 3) * 55;

    const landerCount = 7 + Math.min(10, wave * 2);
    const bomberCount = 2 + Math.min(5, Math.floor(wave * 0.9));
    const podCount = 1 + Math.min(4, Math.floor((wave + 1) * 0.6));

    for (let i = 0; i < landerCount; i++) {
      const ex = wrapX(this.shipX + 420 + (i / landerCount) * (WORLD_W - 840));
      this.enemies.push({
        id: this.nextEntityId++,
        kind: this.planetDestroyed ? 'mutant' : 'lander',
        x: ex,
        y: PLAY_TOP + 34 + Math.random() * 140,
        vx: (i % 2 === 0 ? 1 : -1) * (75 + wave * 8),
        vy: (Math.random() - 0.5) * 40,
        fireCd: 1.4 + Math.random() * 2.2,
        targetHumanoidId: null,
        phase: Math.random() * Math.PI * 2,
        hp: 1,
      });
    }

    for (let i = 0; i < bomberCount; i++) {
      const ex = wrapX(this.shipX + 520 + i * 440);
      const isFire = this.variant !== 'defender' && i % 2 === 1;
      this.enemies.push({
        id: this.nextEntityId++,
        kind: isFire ? 'firebomber' : 'bomber',
        x: ex,
        y: PLAY_TOP + 70 + Math.random() * 260,
        vx: (i % 2 === 0 ? 1 : -1) * (88 + wave * 6),
        vy: 50,
        fireCd: 1.0 + Math.random() * 1.4,
        targetHumanoidId: null,
        phase: Math.random() * Math.PI * 2,
        hp: 1,
      });
    }

    for (let i = 0; i < podCount; i++) {
      const ex = wrapX(this.shipX + 750 + i * 620);
      this.enemies.push({
        id: this.nextEntityId++,
        kind: 'pod',
        x: ex,
        y: PLAY_TOP + 80 + Math.random() * 220,
        vx: (i % 2 === 0 ? 1 : -1) * 58,
        vy: (Math.random() - 0.5) * 35,
        fireCd: 3.0,
        targetHumanoidId: null,
        phase: Math.random() * Math.PI * 2,
        hp: 1,
      });
    }
  }

  public startNewGame(): void {
    this.score = 0;
    this.nextExtraLife = 10000;
    this.level = 1;
    this.lives = 3;
    this.smartBombs = 3;
    this.planetDestroyed = false;
    this.invisoEnergy = 100;
    this.invisoActive = false;
    this.carriedHumanoidId = null;
    this.particles = [];
    this.popups = [];

    this.shipX = WORLD_W * 0.5;
    this.shipY = 300;
    this.shipVx = 0;
    this.shipVy = 0;
    this.facing = 1;
    this.invulnTimer = 2.0;
    this.cameraX = wrapX(this.shipX - LOGICAL_W * 0.3);

    this.spawnHumanoids();
    this.spawnWave(1);
    this.phase = 'READY';
    this.phaseTimer = 1.25;
    arcadeAudio.playArcadeStart();
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.setupAttract();
  }

  public restartStage(): void {
    // In Defender II / Stargate, R activates the rechargeable Inviso Cloak!
    if (this.variant !== 'defender' && this.phase === 'PLAYING') {
      if (this.invisoActive) {
        this.invisoActive = false;
      } else if (this.invisoEnergy >= 20) {
        this.invisoActive = true;
        arcadeAudio.playSuperTransform();
        this.addPopup(this.shipX, this.shipY - 26, 'INVISO CLOAK!', '#A855F7');
      }
    }
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  private addScore(pts: number, worldX?: number, worldY?: number, color = '#FDE047'): void {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(this.storageKey, this.highScore);
    }
    if (this.score >= this.nextExtraLife) {
      this.nextExtraLife += 10000;
      this.lives = Math.min(6, this.lives + 1);
      this.smartBombs = Math.min(6, this.smartBombs + 1);
      arcadeAudio.playExtraLife();
      this.addPopup(this.shipX, this.shipY - 30, '1UP + SMART BOMB', '#34D399');
    }
    if (worldX !== undefined && worldY !== undefined) {
      this.addPopup(worldX, worldY, `${pts}`, color);
    }
  }

  private addPopup(worldX: number, worldY: number, text: string, color: string): void {
    this.popups.push({
      x: worldX,
      y: worldY,
      text,
      color,
      life: 0.9,
      maxLife: 0.9,
    });
  }

  private worldToScreenX(wx: number): number {
    const center = wrapX(this.cameraX + LOGICAL_W * 0.5);
    return LOGICAL_W * 0.5 + deltaX(center, wx);
  }

  private triggerSmartBomb(): void {
    if (this.smartBombs <= 0) return;
    this.smartBombs -= 1;
    this.screenFlash = 0.42;
    arcadeAudio.playSmartBomb();

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const sx = this.worldToScreenX(e.x);
      if (sx >= -30 && sx <= LOGICAL_W + 30) {
        this.destroyEnemy(i, true);
      }
    }
    this.enemyShots = this.enemyShots.filter((s) => {
      const sx = this.worldToScreenX(s.x);
      return sx < -20 || sx > LOGICAL_W + 20;
    });
  }

  private destroyEnemy(index: number, fromSmartBomb = false): void {
    const e = this.enemies[index];
    this.enemies.splice(index, 1);

    // Release any abducted humanoid
    for (const h of this.humanoids) {
      if (h.abductorId === e.id && h.state === 'abducted') {
        h.abductorId = null;
        h.state = 'falling';
        h.vy = 20;
        h.fallStartY = h.y;
      }
    }

    const colorMap: Record<EnemyKind, string> = {
      lander: '#4ADE80',
      mutant: '#F43F5E',
      bomber: '#A855F7',
      firebomber: '#FB923C',
      pod: '#38BDF8',
      swarmer: '#FACC15',
      baiter: '#22D3EE',
    };
    const ptsMap: Record<EnemyKind, number> = {
      lander: 150,
      mutant: 150,
      bomber: 250,
      firebomber: 300,
      pod: 1000,
      swarmer: 150,
      baiter: 200,
    };

    spawnBurst(this.particles, e.x, e.y, colorMap[e.kind], fromSmartBomb ? 10 : 16, 210, 3.2);
    this.addScore(ptsMap[e.kind], e.x, e.y, colorMap[e.kind]);

    // Pods release 3 Swarmers (unless smart-bombed)
    if (e.kind === 'pod' && !fromSmartBomb) {
      for (let s = 0; s < 3; s++) {
        this.enemies.push({
          id: this.nextEntityId++,
          kind: 'swarmer',
          x: wrapX(e.x + (s - 1) * 18),
          y: e.y + (s - 1) * 12,
          vx: (Math.random() - 0.5) * 260,
          vy: (Math.random() - 0.5) * 160,
          fireCd: 1.5 + Math.random(),
          targetHumanoidId: null,
          phase: Math.random() * Math.PI * 2,
          hp: 1,
        });
      }
    }
  }

  private damagePlayer(): void {
    if (this.invulnTimer > 0 || this.invisoActive) return;
    arcadeAudio.playExplosion(true);
    spawnBurst(this.particles, this.shipX, this.shipY, '#FDE047', 28, 280, 4);
    spawnBurst(this.particles, this.shipX, this.shipY, '#FB7185', 18, 190, 3);

    // Drop carried humanoid if any
    if (this.carriedHumanoidId !== null) {
      const h = this.humanoids.find((hm) => hm.id === this.carriedHumanoidId);
      if (h && h.state === 'carried') {
        h.state = 'falling';
        h.vy = 20;
        h.fallStartY = h.y;
      }
      this.carriedHumanoidId = null;
    }

    this.lives -= 1;
    if (this.lives <= 0) {
      this.phase = 'GAME_OVER';
      arcadeAudio.playDeath();
      return;
    }

    this.shipVx = 0;
    this.shipVy = 0;
    this.shipY = 260;
    this.invulnTimer = 2.6;
    this.enemyShots = [];
  }

  public step(dt: number): void {
    this.clock += dt;
    if (this.screenFlash > 0) this.screenFlash = Math.max(0, this.screenFlash - dt);
    if (this.planetExplodeFlash > 0) this.planetExplodeFlash = Math.max(0, this.planetExplodeFlash - dt);

    stepParticlesAndPopups(this.particles, this.popups, dt);

    if (this.phase === 'TITLE') {
      this.shipX = wrapX(this.shipX + 160 * dt);
      this.shipY = 260 + Math.sin(this.clock * 1.4) * 70;
      this.facing = 1;
      this.cameraX = wrapX(this.shipX - LOGICAL_W * 0.28);
      for (const e of this.enemies) {
        e.phase += dt * 2;
        e.x = wrapX(e.x + e.vx * dt * 0.4);
        e.y = Math.max(PLAY_TOP + 24, Math.min(GROUND_BASE - 70, e.y + Math.sin(e.phase) * 28 * dt));
      }
      return;
    }

    if (this.phase === 'PAUSED' || this.phase === 'GAME_OVER') return;

    if (this.phase === 'READY') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.phase = 'PLAYING';
      }
      return;
    }

    if (this.phase === 'STAGE_CLEAR') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.level += 1;
        this.spawnWave(this.level);
        this.phase = 'READY';
        this.phaseTimer = 1.1;
      }
      return;
    }

    // PLAYING
    this.waveElapsed += dt;
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (this.fireCd > 0) this.fireCd = Math.max(0, this.fireCd - dt);
    if (this.warpCd > 0) this.warpCd = Math.max(0, this.warpCd - dt);

    // Inviso cloak energy management
    if (this.variant !== 'defender') {
      if (this.invisoActive) {
        this.invisoEnergy = Math.max(0, this.invisoEnergy - 28 * dt);
        if (this.invisoEnergy <= 0) {
          this.invisoActive = false;
        }
      } else {
        this.invisoEnergy = Math.min(100, this.invisoEnergy + 9 * dt);
      }
    }

    // Ship controls & inertia
    const accelX = 1280;
    const maxVx = 580;
    if (this.input.left && !this.input.right) {
      this.facing = -1;
      this.shipVx = Math.max(-maxVx, this.shipVx - accelX * dt);
    } else if (this.input.right && !this.input.left) {
      this.facing = 1;
      this.shipVx = Math.min(maxVx, this.shipVx + accelX * dt);
    } else {
      this.shipVx *= Math.pow(0.08, dt);
      if (Math.abs(this.shipVx) < 4) this.shipVx = 0;
    }

    const vertSpeed = 320;
    if (this.input.up && !this.input.down) {
      this.shipVy = -vertSpeed;
    } else if (this.input.down && !this.input.up) {
      this.shipVy = vertSpeed;
    } else {
      this.shipVy *= Math.pow(0.005, dt);
    }

    this.shipX = wrapX(this.shipX + this.shipVx * dt);
    this.shipY = Math.max(PLAY_TOP + 22, Math.min(PLAY_BOTTOM - 22, this.shipY + this.shipVy * dt));

    // Smooth lead-ahead camera
    const desiredCamX = wrapX(this.shipX - (this.facing === 1 ? LOGICAL_W * 0.28 : LOGICAL_W * 0.72));
    const camDiff = deltaX(this.cameraX, desiredCamX);
    this.cameraX = wrapX(this.cameraX + camDiff * Math.min(1, dt * 6.5));

    // Fire Williams streaking laser
    if ((this.input.fire || this.input.fireJustPressed) && this.fireCd <= 0) {
      this.fireCd = 0.13;
      this.lasers.push({
        x: wrapX(this.shipX + this.facing * 24),
        y: this.shipY,
        dir: this.facing,
        len: 110,
        life: 0.34,
        hue: (this.clock * 320) % 360,
      });
      arcadeAudio.playLaser(this.variant === 'stargate' ? 1120 : 880);
    }

    // Smart Bomb on secondary press
    if (this.input.secondaryJustPressed) {
      this.triggerSmartBomb();
    }

    // Stargate Warp Portal check (Defender II & Stargate)
    if (this.variant !== 'defender' && this.warpCd <= 0) {
      const gx = deltaX(this.shipX, this.stargateX);
      const gy = this.shipY - this.stargateY;
      if (Math.hypot(gx, gy) < 30) {
        this.warpCd = 3.0;
        arcadeAudio.playPotionBlast();
        // Warp directly to an abducted humanoid if any, else jump across the world!
        const endangered = this.humanoids.find((h) => h.state === 'abducted');
        if (endangered) {
          this.shipX = wrapX(endangered.x - 140);
          this.shipY = endangered.y;
          this.facing = 1;
          this.addPopup(this.shipX, this.shipY - 24, 'STARGATE RESCUE WARP!', '#38BDF8');
        } else {
          const aliveCount = this.humanoids.filter((h) => h.state !== 'dead').length;
          if (this.variant === 'stargate' && aliveCount >= 4 && this.level < 8 && this.enemies.length <= 5) {
            this.addScore(2000, this.shipX, this.shipY - 26, '#38BDF8');
            this.addPopup(this.shipX, this.shipY - 46, 'STARGATE WAVE WARP!', '#38BDF8');
            this.enemies = [];
          } else {
            this.shipX = wrapX(this.shipX + WORLD_W * 0.5);
            this.addPopup(this.shipX, this.shipY - 24, 'STARGATE WARP!', '#38BDF8');
          }
        }
        this.cameraX = wrapX(this.shipX - LOGICAL_W * 0.32);
        this.invulnTimer = Math.max(this.invulnTimer, 1.0);
        spawnBurst(this.particles, this.shipX, this.shipY, '#38BDF8', 24, 240, 3.5);
      }
    }

    // Update lasers & check hits
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const l = this.lasers[i];
      l.x = wrapX(l.x + l.dir * 1360 * dt);
      l.len = Math.min(240, l.len + 460 * dt);
      l.life -= dt;
      if (l.life <= 0) {
        this.lasers.splice(i, 1);
        continue;
      }

      let hit = false;
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (Math.abs(e.y - l.y) < 18) {
          const dx = deltaX(l.x, e.x);
          const behind = l.dir === 1 ? dx <= 16 && dx >= -l.len : dx >= -16 && dx <= l.len;
          if (behind) {
            arcadeAudio.playExplosion(e.kind === 'pod');
            this.destroyEnemy(j, false);
            hit = true;
            break;
          }
        }
      }
      if (hit) {
        this.lasers.splice(i, 1);
      }
    }

    // Baiter spawn if wave drags on
    this.baiterTimer -= dt;
    if (this.baiterTimer <= 0 && this.enemies.length > 0 && this.enemies.length < 18) {
      this.baiterTimer = 14;
      this.enemies.push({
        id: this.nextEntityId++,
        kind: 'baiter',
        x: wrapX(this.shipX + (Math.random() > 0.5 ? 520 : -520)),
        y: PLAY_TOP + 60 + Math.random() * 200,
        vx: 0,
        vy: 0,
        fireCd: 1.0,
        targetHumanoidId: null,
        phase: 0,
        hp: 1,
      });
    }

    // Update enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.phase += dt * 3.5;

      const dxToShip = deltaX(e.x, this.shipX);
      const dyToShip = this.shipY - e.y;

      if (e.kind === 'lander') {
        // Look for an unassigned walking humanoid to abduct
        let targetH = e.targetHumanoidId
          ? this.humanoids.find((h) => h.id === e.targetHumanoidId && (h.state === 'walking' || h.state === 'abducted'))
          : undefined;

        if (!targetH && !this.planetDestroyed && Math.random() < dt * 0.45) {
          const free = this.humanoids.filter((h) => h.state === 'walking' && h.abductorId === null);
          if (free.length > 0) {
            const pick = free[Math.floor(Math.random() * free.length)];
            e.targetHumanoidId = pick.id;
            targetH = pick;
          }
        }

        if (targetH) {
          if (targetH.state === 'abducted' && targetH.abductorId === e.id) {
            // Ascend to top of sky to mutate!
            e.vx *= 0.9;
            e.vy = -52 - this.level * 4;
            targetH.x = e.x;
            targetH.y = e.y + 18;
            if (e.y <= PLAY_TOP + 26) {
              // Humanoid lost -> Mutant born!
              targetH.state = 'dead';
              targetH.abductorId = null;
              e.kind = 'mutant';
              e.targetHumanoidId = null;
              arcadeAudio.playPlusWildcard();
              spawnBurst(this.particles, e.x, e.y, '#F43F5E', 18, 220, 3);
              this.checkPlanetStatus();
            }
          } else if (targetH.state === 'walking' && targetH.abductorId === null) {
            const dxh = deltaX(e.x, targetH.x);
            const dyh = targetH.y - 16 - e.y;
            e.vx = Math.sign(dxh) * Math.min(130, Math.abs(dxh) * 2.2);
            e.vy = Math.sign(dyh) * Math.min(95, Math.abs(dyh) * 2.2);
            if (Math.abs(dxh) < 12 && Math.abs(dyh) < 12) {
              targetH.state = 'abducted';
              targetH.abductorId = e.id;
              arcadeAudio.playUfoPing(true);
            }
          } else {
            e.targetHumanoidId = null;
          }
        } else {
          // Cruise over terrain
          const desiredY = this.terrainYAt(e.x) - 120 + Math.sin(e.phase) * 55;
          e.vy = (desiredY - e.y) * 1.6;
        }
      } else if (e.kind === 'mutant') {
        // Relentless jittery hunter chasing player
        const spd = 210 + this.level * 12;
        e.vx = Math.sign(dxToShip) * spd;
        e.vy = Math.sign(dyToShip) * 155 + Math.sin(e.phase * 5) * 95;
      } else if (e.kind === 'bomber' || e.kind === 'firebomber') {
        e.vy = Math.sin(e.phase * 0.8) * 110;
        e.fireCd -= dt;
        if (e.fireCd <= 0 && Math.abs(dxToShip) < 420) {
          e.fireCd = e.kind === 'firebomber' ? 1.1 : 1.7;
          this.enemyShots.push({
            x: e.x,
            y: e.y,
            vx: e.kind === 'firebomber' ? Math.sign(dxToShip) * 90 : 0,
            vy: e.kind === 'firebomber' ? Math.sign(dyToShip) * 55 : 0,
            isMine: true,
            life: 4.5,
          });
        }
      } else if (e.kind === 'swarmer') {
        e.vx += Math.sign(dxToShip) * 320 * dt;
        e.vx = Math.max(-290, Math.min(290, e.vx));
        e.vy = Math.sin(e.phase * 4) * 165 + Math.sign(dyToShip) * 65;
      } else if (e.kind === 'baiter') {
        e.vx += Math.sign(dxToShip) * 440 * dt;
        e.vx = Math.max(-440, Math.min(440, e.vx));
        e.vy += Math.sign(dyToShip) * 320 * dt;
        e.vy = Math.max(-260, Math.min(260, e.vy));
      }

      e.x = wrapX(e.x + e.vx * dt);
      e.y = Math.max(PLAY_TOP + 18, Math.min(PLAY_BOTTOM - 28, e.y + e.vy * dt));

      // Enemy plasma firing
      if (e.kind !== 'pod' && e.kind !== 'bomber' && e.kind !== 'firebomber') {
        e.fireCd -= dt;
        if (e.fireCd <= 0 && Math.abs(dxToShip) < 430) {
          e.fireCd = e.kind === 'mutant' || e.kind === 'baiter' ? 1.35 : 2.6;
          const dist = Math.hypot(dxToShip, dyToShip) || 1;
          const spd = e.kind === 'baiter' ? 320 : 225;
          this.enemyShots.push({
            x: e.x,
            y: e.y,
            vx: (dxToShip / dist) * spd,
            vy: (dyToShip / dist) * spd,
            isMine: false,
            life: 2.6,
          });
        }
      }

      // Ship-Enemy collision
      if (Math.abs(deltaX(e.x, this.shipX)) < 22 && Math.abs(e.y - this.shipY) < 18) {
        if (this.invisoActive) {
          // Cloak smashes through enemies safely!
          arcadeAudio.playExplosion(false);
          this.destroyEnemy(i, false);
        } else {
          this.damagePlayer();
          return;
        }
      }
    }

    // Update humanoids
    for (const h of this.humanoids) {
      if (h.state === 'dead') continue;
      if (h.state === 'walking') {
        h.x = wrapX(h.x + h.vx * dt);
        h.y = this.terrainYAt(h.x) - 8;
      } else if (h.state === 'falling') {
        h.vy = Math.min(240, h.vy + 165 * dt);
        h.y += h.vy * dt;

        // Check mid-air catch by player!
        if (
          this.carriedHumanoidId === null &&
          Math.abs(deltaX(h.x, this.shipX)) < 26 &&
          Math.abs(h.y - this.shipY) < 24
        ) {
          h.state = 'carried';
          this.carriedHumanoidId = h.id;
          this.addScore(500, h.x, h.y - 14, '#38BDF8');
          arcadeAudio.playEatFruit();
          continue;
        }

        const groundY = this.terrainYAt(h.x) - 8;
        if (h.y >= groundY) {
          const dropDist = groundY - h.fallStartY;
          if (dropDist > 165) {
            h.state = 'dead';
            spawnBurst(this.particles, h.x, groundY, '#FB7185', 14, 150, 2.5);
            arcadeAudio.playExplosion(false);
            this.checkPlanetStatus();
          } else {
            h.y = groundY;
            h.vy = 0;
            h.state = 'walking';
            this.addScore(250, h.x, h.y - 16, '#4ADE80');
          }
        }
      } else if (h.state === 'carried') {
        h.x = this.shipX;
        h.y = this.shipY + 18;
        const groundY = this.terrainYAt(h.x) - 8;
        if (h.y >= groundY - 6 && !this.planetDestroyed) {
          h.y = groundY;
          h.state = 'walking';
          this.carriedHumanoidId = null;
          this.addScore(500, h.x, h.y - 20, '#4ADE80');
          arcadeAudio.playKeyUnlock();
        }
      }
    }

    // Update enemy shots
    for (let i = this.enemyShots.length - 1; i >= 0; i--) {
      const s = this.enemyShots[i];
      s.x = wrapX(s.x + s.vx * dt);
      s.y += s.vy * dt;
      s.life -= dt;
      if (s.life <= 0 || s.y < PLAY_TOP || s.y > PLAY_BOTTOM) {
        this.enemyShots.splice(i, 1);
        continue;
      }
      if (Math.abs(deltaX(s.x, this.shipX)) < 18 && Math.abs(s.y - this.shipY) < 13) {
        this.enemyShots.splice(i, 1);
        this.damagePlayer();
        return;
      }
    }

    // Wave clear!
    if (this.enemies.length === 0) {
      const survivors = this.humanoids.filter((h) => h.state !== 'dead').length;
      const bonus = survivors * (100 * Math.min(5, this.level));
      if (bonus > 0) {
        this.addScore(bonus, this.shipX, this.shipY - 30, '#4ADE80');
      }
      arcadeAudio.playStageClear();
      this.phase = 'STAGE_CLEAR';
      this.phaseTimer = 1.9;
    }
  }

  private checkPlanetStatus(): void {
    if (this.planetDestroyed) return;
    const alive = this.humanoids.some((h) => h.state !== 'dead');
    if (!alive) {
      this.planetDestroyed = true;
      this.planetExplodeFlash = 1.1;
      arcadeAudio.playSmartBomb();
      for (const e of this.enemies) {
        if (e.kind === 'lander') {
          e.kind = 'mutant';
          e.targetHumanoidId = null;
        }
      }
      this.addPopup(this.shipX, 200, 'PLANET DESTROYED · MUTANT SPACE!', '#FB7185');
    }
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.save();
    ctx.scale(dpr, dpr);

    // Space backdrop
    ctx.fillStyle = this.planetDestroyed ? '#0D0414' : '#03060E';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // Subtle parallax stars
    for (const st of this.stars) {
      const sx = this.worldToScreenX(st.x);
      if (sx < -4 || sx > LOGICAL_W + 4) continue;
      ctx.fillStyle = st.c;
      ctx.globalAlpha = 0.55 + 0.35 * Math.sin(this.clock * 2.5 + st.x);
      ctx.beginPath();
      ctx.arc(sx, st.y, st.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Jagged glowing mountain terrain
    if (!this.planetDestroyed) {
      ctx.save();
      ctx.beginPath();
      const stepPx = 12;
      ctx.moveTo(0, LOGICAL_H);
      for (let sx = 0; sx <= LOGICAL_W + stepPx; sx += stepPx) {
        const wx = wrapX(this.cameraX + sx);
        const ty = this.terrainYAt(wx);
        ctx.lineTo(sx, ty);
      }
      ctx.lineTo(LOGICAL_W, LOGICAL_H);
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, GROUND_BASE - 55, 0, LOGICAL_H);
      if (this.variant === 'defender') {
        grad.addColorStop(0, 'rgba(180, 83, 9, 0.32)');
        grad.addColorStop(1, 'rgba(30, 14, 5, 0.92)');
      } else if (this.variant === 'defender2') {
        grad.addColorStop(0, 'rgba(126, 34, 206, 0.35)');
        grad.addColorStop(1, 'rgba(19, 8, 36, 0.94)');
      } else {
        grad.addColorStop(0, 'rgba(14, 116, 144, 0.36)');
        grad.addColorStop(1, 'rgba(5, 18, 34, 0.94)');
      }
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      for (let sx = 0; sx <= LOGICAL_W + stepPx; sx += stepPx) {
        const wx = wrapX(this.cameraX + sx);
        const ty = this.terrainYAt(wx);
        if (sx === 0) ctx.moveTo(sx, ty);
        else ctx.lineTo(sx, ty);
      }
      ctx.strokeStyle = this.getAccentColor();
      ctx.lineWidth = 2.2;
      ctx.shadowColor = this.getAccentColor();
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.restore();
    }

    // Stargate Warp Portal (Defender II & Stargate)
    if (this.variant !== 'defender') {
      const gx = this.worldToScreenX(this.stargateX);
      if (gx > -60 && gx < LOGICAL_W + 60) {
        ctx.save();
        ctx.translate(gx, this.stargateY);
        const pulse = 1 + Math.sin(this.clock * 6) * 0.12;
        ctx.strokeStyle = this.variant === 'stargate' ? '#38BDF8' : '#C084FC';
        ctx.lineWidth = 3;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.ellipse(0, 0, 22 * pulse, 34 * pulse, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = '#FDE047';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(0, 0, 12, 22, this.clock * 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Humanoids
    for (const h of this.humanoids) {
      if (h.state === 'dead') continue;
      const sx = this.worldToScreenX(h.x);
      if (sx < -20 || sx > LOGICAL_W + 20) continue;
      ctx.save();
      ctx.translate(sx, h.y);
      // Head
      ctx.fillStyle = '#FDE68A';
      ctx.fillRect(-2.5, -12, 5, 4.5);
      // Suit torso
      ctx.fillStyle = '#EC4899';
      ctx.fillRect(-3.5, -7.5, 7, 6);
      // Legs
      const stride = h.state === 'walking' ? Math.sin(this.clock * 8 + h.id) * 2 : 0;
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(-3, -1.5, 2.5, 5 + stride * 0.4);
      ctx.fillRect(0.5, -1.5, 2.5, 5 - stride * 0.4);
      ctx.restore();
    }

    // Enemies
    for (const e of this.enemies) {
      const sx = this.worldToScreenX(e.x);
      if (sx < -30 || sx > LOGICAL_W + 30) continue;
      this.drawEnemy(ctx, e, sx, e.y);
    }

    // Enemy shots & mines
    for (const s of this.enemyShots) {
      const sx = this.worldToScreenX(s.x);
      if (sx < -12 || sx > LOGICAL_W + 12) continue;
      ctx.save();
      ctx.translate(sx, s.y);
      if (s.isMine) {
        ctx.rotate(this.clock * 5);
        ctx.strokeStyle = '#FB923C';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-6, 0);
        ctx.lineTo(6, 0);
        ctx.moveTo(0, -6);
        ctx.lineTo(0, 6);
        ctx.stroke();
        ctx.fillStyle = '#FEF08A';
        ctx.fillRect(-2, -2, 4, 4);
      } else {
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = '#F43F5E';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Williams Rainbow Streaking Lasers
    for (const l of this.lasers) {
      const sx = this.worldToScreenX(l.x);
      const tailX = sx - l.dir * l.len;
      ctx.save();
      const grad = ctx.createLinearGradient(tailX, l.y, sx, l.y);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.35, `hsl(${(l.hue + 40) % 360}, 95%, 62%)`);
      grad.addColorStop(0.75, `hsl(${l.hue}, 100%, 65%)`);
      grad.addColorStop(1, '#FFFFFF');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(tailX, l.y);
      ctx.lineTo(sx, l.y);
      ctx.stroke();
      ctx.restore();
    }

    // Player Ship
    if (this.phase !== 'GAME_OVER') {
      const blink = this.invulnTimer > 0 && Math.floor(this.clock * 18) % 2 === 0;
      if (!blink) {
        const sx = this.worldToScreenX(this.shipX);
        this.drawShip(ctx, sx, this.shipY, this.facing);
      }
    }

    // Particles & Popups (transformed into screen coordinates)
    const screenParticles = this.particles.map((p) => ({
      ...p,
      x: this.worldToScreenX(p.x),
    }));
    const screenPopups = this.popups.map((p) => ({
      ...p,
      x: this.worldToScreenX(p.x),
    }));
    renderParticlesAndPopups(ctx, screenParticles, screenPopups);

    // Smart bomb / planet flash
    if (this.screenFlash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.85, this.screenFlash * 1.9)})`;
      ctx.fillRect(0, SCANNER_H, LOGICAL_W, LOGICAL_H - SCANNER_H);
    } else if (this.planetExplodeFlash > 0) {
      ctx.fillStyle = `rgba(244, 63, 94, ${Math.min(0.65, this.planetExplodeFlash * 0.65)})`;
      ctx.fillRect(0, SCANNER_H, LOGICAL_W, LOGICAL_H - SCANNER_H);
    }

    // Top-Bar Williams Scanner Radar
    this.drawScannerHud(ctx);

    // Ready / Stage Clear banner
    if (this.phase === 'READY' || this.phase === 'STAGE_CLEAR') {
      ctx.save();
      ctx.fillStyle = 'rgba(4, 7, 16, 0.72)';
      ctx.fillRect(LOGICAL_W * 0.5 - 190, LOGICAL_H * 0.5 - 38, 380, 76);
      ctx.strokeStyle = this.getAccentColor();
      ctx.lineWidth = 2;
      ctx.strokeRect(LOGICAL_W * 0.5 - 190, LOGICAL_H * 0.5 - 38, 380, 76);
      ctx.font = '800 22px "Outfit", sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        this.phase === 'READY'
          ? `ATTACK WAVE ${this.level}`
          : `WAVE ${this.level} DEFENDED!`,
        LOGICAL_W * 0.5,
        LOGICAL_H * 0.5
      );
      ctx.restore();
    }

    if (visualMode === 'crt') {
      renderCrtOverlay(ctx, LOGICAL_W, LOGICAL_H);
    }
    ctx.restore();
  }

  private drawShip(ctx: CanvasRenderingContext2D, x: number, y: number, dir: 1 | -1): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1);

    if (this.invisoActive) {
      ctx.globalAlpha = 0.55 + Math.sin(this.clock * 22) * 0.25;
      ctx.strokeStyle = '#C084FC';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#A855F7';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.ellipse(0, 0, 28, 14, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Thruster flame
    const thrust = Math.abs(this.shipVx) > 40 ? 14 + Math.random() * 14 : 6;
    ctx.fillStyle = '#FB923C';
    ctx.beginPath();
    ctx.moveTo(-16, -4);
    ctx.lineTo(-16 - thrust, 0);
    ctx.lineTo(-16, 4);
    ctx.closePath();
    ctx.fill();

    // Sleek Williams Defender fighter silhouette
    ctx.fillStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.moveTo(22, 2);
    ctx.lineTo(4, -5);
    ctx.lineTo(-14, -9);
    ctx.lineTo(-18, -3);
    ctx.lineTo(-15, 6);
    ctx.lineTo(14, 6);
    ctx.closePath();
    ctx.fill();

    // Cockpit canopy
    ctx.fillStyle = this.getAccentColor();
    ctx.beginPath();
    ctx.moveTo(10, -1);
    ctx.lineTo(0, -6);
    ctx.lineTo(-6, -2);
    ctx.closePath();
    ctx.fill();

    // Nose cannon highlight
    ctx.fillStyle = '#F43F5E';
    ctx.fillRect(14, 0, 9, 2.5);
    ctx.restore();
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, sx: number, sy: number): void {
    ctx.save();
    ctx.translate(sx, sy);

    if (e.kind === 'lander') {
      ctx.fillStyle = '#22C55E';
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.lineTo(13, -2);
      ctx.lineTo(9, 10);
      ctx.lineTo(4, 5);
      ctx.lineTo(0, 12);
      ctx.lineTo(-4, 5);
      ctx.lineTo(-9, 10);
      ctx.lineTo(-13, -2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(-5, -5, 10, 4);
    } else if (e.kind === 'mutant') {
      ctx.fillStyle = Math.floor(this.clock * 14) % 2 === 0 ? '#F43F5E' : '#EC4899';
      ctx.shadowColor = '#F43F5E';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(14, 0);
      ctx.lineTo(8, 12);
      ctx.lineTo(0, 5);
      ctx.lineTo(-8, 12);
      ctx.lineTo(-14, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(-5, -3, 10, 4);
    } else if (e.kind === 'bomber' || e.kind === 'firebomber') {
      ctx.rotate(this.clock * 2.5);
      ctx.strokeStyle = e.kind === 'firebomber' ? '#FB923C' : '#C084FC';
      ctx.lineWidth = 2.8;
      ctx.strokeRect(-10, -10, 20, 20);
      ctx.fillStyle = e.kind === 'firebomber' ? '#FDE047' : '#38BDF8';
      ctx.fillRect(-5, -5, 10, 10);
    } else if (e.kind === 'pod') {
      ctx.rotate(this.clock * 3);
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const r = k % 2 === 0 ? 14 : 6;
        if (k === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = '#EC4899';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'swarmer') {
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(10, 0);
      ctx.lineTo(0, 9);
      ctx.lineTo(-10, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(-3, -2, 6, 4);
    } else if (e.kind === 'baiter') {
      ctx.fillStyle = '#22D3EE';
      ctx.shadowColor = '#22D3EE';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(-16, 0);
      ctx.lineTo(0, -7);
      ctx.lineTo(16, 0);
      ctx.lineTo(0, 7);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FDE047';
      ctx.fillRect(-6, -2, 12, 4);
    }

    ctx.restore();
  }

  private drawScannerHud(ctx: CanvasRenderingContext2D): void {
    // Top bar dark frame
    ctx.fillStyle = '#070B16';
    ctx.fillRect(0, 0, LOGICAL_W, SCANNER_H);
    ctx.strokeStyle = this.getAccentColor();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, SCANNER_H);
    ctx.lineTo(LOGICAL_W, SCANNER_H);
    ctx.stroke();

    // Central Williams Scanner Box
    const scanW = 460;
    const scanH = 70;
    const scanX = (LOGICAL_W - scanW) * 0.5;
    const scanY = 9;

    ctx.fillStyle = '#02040A';
    ctx.fillRect(scanX, scanY, scanW, scanH);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(scanX, scanY, scanW, scanH);

    const mapX = (wx: number) => {
      const rel = deltaX(this.shipX, wx);
      return scanX + scanW * 0.5 + (rel / WORLD_W) * scanW;
    };
    const mapY = (wy: number) =>
      scanY + 4 + ((wy - PLAY_TOP) / (PLAY_BOTTOM - PLAY_TOP)) * (scanH - 8);

    // Scanner terrain silhouette
    if (!this.planetDestroyed) {
      ctx.beginPath();
      for (let i = 0; i <= 72; i++) {
        const rx = (i / 72 - 0.5) * WORLD_W;
        const wx = wrapX(this.shipX + rx);
        const sx = scanX + (i / 72) * scanW;
        const sy = mapY(this.terrainYAt(wx));
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // Current viewport bracket inside scanner
    const vpW = (LOGICAL_W / WORLD_W) * scanW;
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(scanX + scanW * 0.5 - vpW * 0.5, scanY + 2, vpW, scanH - 4);

    // Stargate blip
    if (this.variant !== 'defender') {
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(mapX(this.stargateX) - 2, mapY(this.stargateY) - 4, 4, 8);
    }

    // Humanoid blips
    ctx.fillStyle = '#EC4899';
    for (const h of this.humanoids) {
      if (h.state === 'dead') continue;
      ctx.fillRect(mapX(h.x) - 1, mapY(h.y) - 2, 2.5, 4);
    }

    // Enemy blips
    for (const e of this.enemies) {
      ctx.fillStyle =
        e.kind === 'mutant'
          ? '#F43F5E'
          : e.kind === 'lander'
          ? '#4ADE80'
          : e.kind === 'pod'
          ? '#38BDF8'
          : '#FACC15';
      ctx.fillRect(mapX(e.x) - 1.5, mapY(e.y) - 1.5, 3.2, 3.2);
    }

    // Player blip
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(mapX(this.shipX) - 2.5, mapY(this.shipY) - 2, 5, 4);

    // Left HUD: Smart Bombs & Score
    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('SMART BOMBS', 18, 26);
    for (let i = 0; i < this.smartBombs; i++) {
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(24 + i * 16, 44, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`SCORE ${this.score.toLocaleString()}`, 18, 70);

    // Right HUD: Wave & Inviso Cloak bar (for Defender II / Stargate)
    ctx.textAlign = 'right';
    ctx.fillStyle = this.getAccentColor();
    ctx.fillText(`WAVE ${this.level}`, LOGICAL_W - 18, 26);
    const aliveH = this.humanoids.filter((h) => h.state !== 'dead').length;
    ctx.fillStyle = '#EC4899';
    ctx.fillText(`HUMANOIDS ${aliveH}/10`, LOGICAL_W - 18, 48);

    if (this.variant !== 'defender') {
      const barW = 110;
      const bx = LOGICAL_W - 18 - barW;
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(bx, 60, barW, 8);
      ctx.fillStyle = this.invisoActive ? '#F0ABFC' : '#A855F7';
      ctx.fillRect(bx, 60, (this.invisoEnergy / 100) * barW, 8);
    } else {
      ctx.fillStyle = '#94A3B8';
      ctx.fillText(this.planetDestroyed ? 'MUTANT SPACE' : 'PLANET INTACT', LOGICAL_W - 18, 70);
    }
  }

  public getHudSnapshot(): ClassicGameHud {
    const aliveH = this.humanoids.filter((h) => h.state !== 'dead').length;
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: `${this.getTitleName()} · Wave ${this.level}`,
      primaryMetricLabel: 'Smart Bombs',
      primaryMetricValue: `${this.smartBombs}`,
      secondaryMetricLabel: this.variant === 'defender' ? 'Humanoids' : 'Inviso Cloak',
      secondaryMetricValue:
        this.variant === 'defender'
          ? `${aliveH}/10`
          : `${Math.round(this.invisoEnergy)}%`,
      bannerText: this.planetDestroyed ? 'Mutant Space!' : '',
      canRestartStage: this.variant !== 'defender',
    };
  }
}

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
import { arcadeAudio } from './audio';

export type ScrollingShooterVariant = 'scramble' | 'moonpatrol' | 'timepilot' | 'ww1942' | 'ww1943';

interface ShooterEnemy {
  id: number;
  kind:
    | 'rocket'
    | 'fuel'
    | 'ufo'
    | 'fireball'
    | 'base'
    | 'moonUfo'
    | 'moonTank'
    | 'plane'
    | 'redSquad'
    | 'eraBoss'
    | 'battleshipTurret';
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  fireCd: number;
  phase: number;
  squadId?: number;
  launched?: boolean;
  color: string;
}

interface ShooterShot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fromEnemy: boolean;
  isBomb?: boolean;
  isShotgun?: boolean;
  color: string;
}

interface MoonHazard {
  kind: 'crater' | 'rock' | 'mine';
  x: number;
  w: number;
  hp: number;
}

interface PickupItem {
  kind: 'pow' | 'parachute' | 'shotgun' | 'threeway' | 'laser' | 'wingman';
  x: number;
  y: number;
  vy: number;
  label: string;
}

const TIME_PILOT_ERAS = [
  { year: 1910, bgA: '#38BDF8', bgB: '#BAE6FD', bossName: 'ZEPPELIN', color: '#FACC15' },
  { year: 1940, bgA: '#0284C7', bgB: '#7DD3FC', bossName: 'B-25 BOMBER', color: '#4ADE80' },
  { year: 1970, bgA: '#1D4ED8', bgB: '#60A5FA', bossName: 'CHINOOK CHOPPER', color: '#F97316' },
  { year: 1982, bgA: '#312E81', bgB: '#6366F1', bossName: 'B-52 STRATOFORTRESS', color: '#A855F7' },
  { year: 2001, bgA: '#020617', bgB: '#1E1B4B', bossName: 'ALIEN MOTHERSHIP', color: '#F43F5E' },
];

export class ScrollingShooterGame implements ArcadeGameInstance {
  public readonly logicalWidth: number;
  public readonly logicalHeight: number;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel: string;
  public readonly secondaryActionLabel: string;

  private readonly variant: ScrollingShooterVariant;
  private readonly storageKey: string;
  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();

  private score = 0;
  private highScore = 0;
  private level = 1;
  private lives = 3;
  private clock = 0;
  private stateTimer = 0;
  private nextId = 1;
  private nextSquadId = 1;

  // Player state
  private px = 140;
  private py = 260;
  private vx = 0;
  private vy = 0;
  private angle = 0; // Time Pilot 360° heading
  private fireCd = 0;
  private bombCd = 0;
  private invulnTimer = 0;
  private fuel = 100; // Scramble & 1943 energy
  private loopsLeft = 3;
  private loopTimer = 0;

  // 1942 / 1943 upgrades
  private weaponMode: 'normal' | 'quad' | 'shotgun' | 'threeway' | 'laser' = 'normal';
  private weaponTimer = 0;
  private wingmen = 0;
  private battleshipActive = false;
  private battleshipY = -180;

  // Scramble authentic 5-sector progress
  private scrollX = 0;
  private scrambleSector = 0; // 0 Mountains, 1 Caverns, 2 Fireballs, 3 City Maze, 4 Base
  private scrambleBaseSpawned = false;

  // Moon Patrol authentic mechanics
  private moonSpeed = 235;
  private moonJumpY = 0;
  private moonJumpV = 0;
  private moonDist = 0;
  private moonCourseTimer = 0;
  private moonHazards: MoonHazard[] = [];
  private moonCheckpointIdx = 0;

  // Time Pilot authentic mechanics
  private eraKillsLeft = 20;
  private eraBossSpawned = false;
  private parachuteStreak = 0;
  private clouds: Array<{ x: number; y: number; r: number }> = [];

  private enemies: ShooterEnemy[] = [];
  private shots: ShooterShot[] = [];
  private pickups: PickupItem[] = [];
  private spawnCd = 0.6;
  private squadCounts = new Map<number, number>();
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  constructor(variant: ScrollingShooterVariant) {
    this.variant = variant;
    this.storageKey = `${variant}_hd_highscore_v2`;
    this.highScore = readHighScore(this.storageKey);
    const vertical = variant === 'ww1942' || variant === 'ww1943';
    this.logicalWidth = vertical ? 560 : 760;
    this.logicalHeight = vertical ? 680 : 540;
    this.primaryActionLabel =
      variant === 'moonpatrol'
        ? 'Dual Cannons'
        : variant === 'scramble'
          ? 'Laser + Bomb'
          : 'Fire Weapons';
    this.secondaryActionLabel =
      variant === 'scramble'
        ? 'Drop Bomb'
        : variant === 'moonpatrol'
          ? 'Jump Crater'
          : variant === 'ww1942' || variant === 'ww1943'
            ? 'Loop / Mega-Crash'
            : 'Boost Turn';
    for (let i = 0; i < 18; i++) {
      this.clouds.push({
        x: Math.random() * this.logicalWidth,
        y: Math.random() * this.logicalHeight,
        r: 22 + Math.random() * 44,
      });
    }
    this.setupStage(1);
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public startNewGame(): void {
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.level = 1;
    this.lives = this.variant === 'ww1943' ? 1 : 3;
    this.fuel = 100;
    this.loopsLeft = 3;
    this.weaponMode = 'normal';
    this.wingmen = 0;
    this.parachuteStreak = 0;
    this.phase = 'READY';
    this.stateTimer = 0.9;
    this.setupStage(1);
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.setupStage(1);
  }

  private addScore(pts: number, x?: number, y?: number, label?: string): void {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(this.storageKey, this.highScore);
    }
    if (x !== undefined && y !== undefined) {
      this.popups.push({
        x,
        y,
        text: label ? `${label} +${pts}` : `+${pts}`,
        color: '#FEF08A',
        life: 0.9,
        maxLife: 0.9,
      });
    }
  }

  private setupStage(lvl: number): void {
    this.enemies = [];
    this.shots = [];
    this.pickups = [];
    this.moonHazards = [];
    this.squadCounts.clear();
    this.scrollX = 0;
    this.fuel = 100;
    this.invulnTimer = 1.4;
    this.loopTimer = 0;
    this.spawnCd = 0.55;
    this.battleshipActive = false;
    this.battleshipY = -200;

    if (this.variant === 'scramble') {
      this.px = 130;
      this.py = 240;
      this.scrambleSector = 0;
      this.scrambleBaseSpawned = false;
    } else if (this.variant === 'moonpatrol') {
      this.px = 185;
      this.py = 420;
      this.moonJumpY = 0;
      this.moonJumpV = 0;
      this.moonDist = 0;
      this.moonCourseTimer = 0;
      this.moonCheckpointIdx = 0;
      this.moonSpeed = 235;
    } else if (this.variant === 'timepilot') {
      this.px = this.logicalWidth * 0.5;
      this.py = this.logicalHeight * 0.5;
      this.angle = 0;
      this.eraKillsLeft = 16 + lvl * 4;
      this.eraBossSpawned = false;
    } else {
      // 1942 / 1943
      this.px = this.logicalWidth * 0.5;
      this.py = this.logicalHeight - 92;
      this.loopsLeft = Math.max(this.loopsLeft, 3);
    }
  }

  // Authentic Scramble 5-Sector Terrain Generator (Floor & Ceiling!)
  private getScrambleTerrain(worldX: number): { ceil: number; floor: number; sector: number } {
    const sector = Math.min(4, Math.floor(worldX / 1550));
    const H = this.logicalHeight;
    if (sector === 0) {
      // 1. Mountains (Open sky + jagged mountain floor)
      const floor = H - 72 - Math.abs(Math.sin(worldX * 0.0042)) * 96 - Math.sin(worldX * 0.011) * 28;
      return { ceil: 24, floor, sector };
    }
    if (sector === 1) {
      // 2. Caverns (Stalactite ceiling + uneven floor!)
      const ceil = 72 + Math.abs(Math.sin(worldX * 0.0055)) * 88;
      const floor = H - 68 - Math.abs(Math.cos(worldX * 0.0048)) * 92;
      return { ceil, floor, sector };
    }
    if (sector === 2) {
      // 3. Fireball Zone (Open valley with flaming meteor barrage)
      const floor = H - 66 - Math.sin(worldX * 0.006) * 32;
      return { ceil: 34, floor, sector };
    }
    if (sector === 3) {
      // 4. Narrow City Maze (Tight stepped architectural ceiling & floor!)
      const step = Math.floor(worldX / 140);
      const mid = H * 0.5 + Math.sin(step * 1.15) * 92;
      const halfGap = 94;
      return { ceil: Math.max(40, mid - halfGap), floor: Math.min(H - 42, mid + halfGap), sector };
    }
    // 5. Final Base Compound!
    return { ceil: 46, floor: H - 68, sector: 4 };
  }

  private damagePlayer(amount = 22): void {
    if (this.invulnTimer > 0 || this.loopTimer > 0 || this.phase !== 'PLAYING') return;
    if (this.variant === 'ww1943') {
      this.fuel -= amount;
      this.invulnTimer = 0.9;
      arcadeAudio.playExplosion(false);
      spawnBurst(this.particles, this.px, this.py, '#F97316', 14, 190, 3);
      if (this.fuel <= 0) {
        arcadeAudio.playDeath();
        this.phase = 'GAME_OVER';
      }
      return;
    }
    this.lives -= 1;
    this.invulnTimer = 2.0;
    this.weaponMode = 'normal';
    this.wingmen = 0;
    arcadeAudio.playDeath();
    spawnBurst(this.particles, this.px, this.py, '#FACC15', 22, 230, 3.6);
    if (this.lives <= 0) {
      this.phase = 'GAME_OVER';
    } else if (this.variant === 'scramble') {
      const t = this.getScrambleTerrain(this.scrollX + this.px);
      this.py = (t.ceil + t.floor) * 0.5;
      this.fuel = 100;
    }
  }

  public step(dt: number): void {
    this.clock += dt;
    stepParticlesAndPopups(this.particles, this.popups, dt);
    if (this.phase === 'PAUSED' || this.phase === 'GAME_OVER') return;
    if (this.phase === 'READY') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) this.phase = 'PLAYING';
      return;
    }
    if (this.phase === 'STAGE_CLEAR') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.level += 1;
        this.phase = 'READY';
        this.stateTimer = 0.9;
        this.setupStage(this.level);
      }
      return;
    }

    const attract = this.phase === 'TITLE';
    this.fireCd = Math.max(0, this.fireCd - dt);
    this.bombCd = Math.max(0, this.bombCd - dt);
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    this.loopTimer = Math.max(0, this.loopTimer - dt);
    if (this.weaponTimer > 0) {
      this.weaponTimer -= dt;
      if (this.weaponTimer <= 0 && this.variant === 'ww1943') this.weaponMode = 'normal';
    }

    if (this.variant === 'scramble') this.stepScramble(dt, attract);
    else if (this.variant === 'moonpatrol') this.stepMoonPatrol(dt, attract);
    else if (this.variant === 'timepilot') this.stepTimePilot(dt, attract);
    else this.step194x(dt, attract);
  }

  // ============================================================================
  // 1. SCRAMBLE (1981 Konami — 5 Sequential Sectors, Fuel, Rockets, Caverns, Base!)
  // ============================================================================
  private stepScramble(dt: number, attract: boolean): void {
    const speed = 155 + this.level * 12;
    this.scrollX += speed * dt;
    const terrain = this.getScrambleTerrain(this.scrollX + this.px);
    this.scrambleSector = terrain.sector;

    if (!attract) {
      this.fuel = Math.max(0, this.fuel - dt * (3.1 + this.level * 0.25));
      if (this.fuel <= 0) {
        this.damagePlayer();
        return;
      }
    }

    if (attract) {
      this.py += ((terrain.ceil + terrain.floor) * 0.5 - this.py) * Math.min(1, dt * 4);
    } else {
      const mv = 250;
      if (this.input.left) this.px -= mv * dt;
      if (this.input.right) this.px += mv * dt;
      if (this.input.up) this.py -= mv * dt;
      if (this.input.down) this.py += mv * dt;
      this.px = Math.max(48, Math.min(this.logicalWidth * 0.68, this.px));
      this.py = Math.max(24, Math.min(this.logicalHeight - 24, this.py));
    }

    // Terrain collision (ceiling or floor!)
    if (!attract && (this.py - 12 < terrain.ceil || this.py + 12 > terrain.floor)) {
      this.damagePlayer();
      return;
    }

    // Fire Laser & Drop Parabolic Bomb
    const wantFire = attract ? Math.sin(this.clock * 5) > 0.72 : this.input.fire || this.input.fireJustPressed;
    if (wantFire && this.fireCd <= 0) {
      this.fireCd = 0.16;
      this.shots.push({ x: this.px + 22, y: this.py, vx: 560, vy: 0, fromEnemy: false, color: '#38BDF8' });
      if (!attract) arcadeAudio.playLaser();
    }
    const wantBomb = !attract && (this.input.secondary || this.input.secondaryJustPressed || (this.input.fireJustPressed && this.bombCd <= 0));
    if (wantBomb && this.bombCd <= 0) {
      this.bombCd = 0.36;
      this.shots.push({ x: this.px + 6, y: this.py + 10, vx: 115, vy: 55, fromEnemy: false, isBomb: true, color: '#FACC15' });
      arcadeAudio.playThrow();
    }

    // Sector-authentic spawns!
    this.spawnCd -= dt;
    if (this.scrambleSector === 4 && !this.scrambleBaseSpawned) {
      this.scrambleBaseSpawned = true;
      const t = this.getScrambleTerrain(this.scrollX + this.logicalWidth + 80);
      this.enemies.push({
        id: this.nextId++,
        kind: 'base',
        x: this.logicalWidth + 90,
        y: t.floor - 28,
        vx: -speed,
        vy: 0,
        hp: 4,
        maxHp: 4,
        fireCd: 1.5,
        phase: 0,
        color: '#FACC15',
      });
    } else if (this.spawnCd <= 0 && !this.scrambleBaseSpawned) {
      this.spawnCd = Math.max(0.45, 0.92 - this.level * 0.05);
      const tRight = this.getScrambleTerrain(this.scrollX + this.logicalWidth + 30);
      if (this.scrambleSector === 2) {
        // Fireball meteor shower!
        this.enemies.push({
          id: this.nextId++,
          kind: 'fireball',
          x: this.logicalWidth + 30,
          y: tRight.ceil + 26 + Math.random() * (tRight.floor - tRight.ceil - 52),
          vx: -(speed + 175),
          vy: 0,
          hp: 99,
          maxHp: 99,
          fireCd: 99,
          phase: 0,
          color: '#F97316',
        });
      } else if (this.scrambleSector === 1 && Math.random() < 0.48) {
        this.enemies.push({
          id: this.nextId++,
          kind: 'ufo',
          x: this.logicalWidth + 30,
          y: (tRight.ceil + tRight.floor) * 0.5,
          vx: -(speed + 70),
          vy: 0,
          hp: 1,
          maxHp: 1,
          fireCd: 1.6,
          phase: Math.random() * 6,
          color: '#A855F7',
        });
      } else {
        const isFuel = Math.random() < 0.36;
        this.enemies.push({
          id: this.nextId++,
          kind: isFuel ? 'fuel' : 'rocket',
          x: this.logicalWidth + 30,
          y: tRight.floor - 18,
          vx: -speed,
          vy: 0,
          hp: 1,
          maxHp: 1,
          fireCd: 99,
          phase: 0,
          launched: false,
          color: isFuel ? '#22C55E' : '#EF4444',
        });
      }
    }

    // Update shots (bombs curve downward under gravity!)
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      if (s.isBomb) s.vy += 420 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const st = this.getScrambleTerrain(this.scrollX + s.x);
      if (s.x > this.logicalWidth + 20 || s.y > st.floor || s.y < st.ceil) {
        if (s.isBomb) spawnBurst(this.particles, s.x, Math.min(s.y, st.floor), '#FACC15', 8, 120, 2.4);
        this.shots.splice(i, 1);
        continue;
      }
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (e.kind === 'fireball') continue; // Indestructible fireballs!
        if (Math.hypot(e.x - s.x, e.y - s.y) < (e.kind === 'base' ? 34 : 22)) {
          this.shots.splice(i, 1);
          e.hp -= 1;
          if (e.hp <= 0) {
            spawnBurst(this.particles, e.x, e.y, e.color, 18, 210, 3.2);
            if (!attract) {
              arcadeAudio.playExplosion(e.kind === 'base');
              if (e.kind === 'fuel') {
                this.fuel = Math.min(100, this.fuel + 24);
                this.addScore(150, e.x, e.y, 'FUEL+');
              } else if (e.kind === 'base') {
                this.addScore(1500, e.x, e.y, 'BASE DESTROYED!');
                arcadeAudio.playStageClear();
                this.phase = 'STAGE_CLEAR';
                this.stateTimer = 1.5;
              } else {
                this.addScore(e.kind === 'ufo' ? 200 : 100, e.x, e.y);
              }
            }
            this.enemies.splice(j, 1);
          }
          break;
        }
      }
    }

    // Update enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.phase += dt * 4;
      if (e.kind === 'rocket' && !e.launched && e.x < this.px + 250) {
        e.launched = true;
        e.vy = -(165 + this.level * 12);
      }
      if (e.kind === 'ufo') {
        e.y += Math.sin(e.phase) * 110 * dt;
      }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (!attract && Math.hypot(e.x - this.px, e.y - this.py) < 22) {
        this.damagePlayer();
        return;
      }
      if (e.x < -50 || e.y < -40) {
        if (e.kind === 'base') {
          // Missed the base — loop to final approach!
          this.scrollX = 4 * 1550;
          this.scrambleBaseSpawned = false;
        }
        this.enemies.splice(i, 1);
      }
    }
  }

  // ============================================================================
  // 2. MOON PATROL (1982 Irem — Speed Control, Jumping, UFO Bomb Craters, Checkpoints!)
  // ============================================================================
  private stepMoonPatrol(dt: number, attract: boolean): void {
    const groundY = 432;
    if (attract) {
      this.moonSpeed = 240;
      const nearHaz = this.moonHazards.find((h) => h.x > this.px + 10 && h.x < this.px + 105);
      if (nearHaz && this.moonJumpY <= 0) this.moonJumpV = 450;
    } else {
      // Authentic Moon Patrol speed-up (Right) & brake (Left)!
      if (this.input.right) {
        this.moonSpeed = Math.min(355, this.moonSpeed + 280 * dt);
        this.px = Math.min(265, this.px + 120 * dt);
      } else if (this.input.left) {
        this.moonSpeed = Math.max(145, this.moonSpeed - 310 * dt);
        this.px = Math.max(115, this.px - 120 * dt);
      } else {
        this.moonSpeed += (235 - this.moonSpeed) * Math.min(1, dt * 4);
      }
      if ((this.input.up || this.input.secondaryJustPressed) && this.moonJumpY <= 0) {
        // Faster buggy = higher/longer authentic arc!
        this.moonJumpV = 430 + (this.moonSpeed - 180) * 0.45;
        arcadeAudio.playJump();
      }
    }

    if (this.moonJumpY > 0 || this.moonJumpV > 0) {
      this.moonJumpY += this.moonJumpV * dt;
      this.moonJumpV -= 1080 * dt;
      if (this.moonJumpY <= 0) {
        this.moonJumpY = 0;
        this.moonJumpV = 0;
      }
    }
    this.py = groundY - this.moonJumpY;

    this.moonDist += this.moonSpeed * dt;
    this.scrollX = this.moonDist;
    this.moonCourseTimer += dt;

    // Authentic Checkpoints A -> E -> J -> O -> T -> Z
    const cpIdx = Math.floor(this.moonDist / 1600);
    if (!attract && cpIdx > this.moonCheckpointIdx) {
      this.moonCheckpointIdx = cpIdx;
      const letters = ['A', 'E', 'J', 'O', 'T', 'Z'];
      const label = letters[Math.min(letters.length - 1, cpIdx)];
      this.addScore(1000, this.px, this.py - 50, `POINT ${label}`);
      arcadeAudio.playPowerUp();
      if (cpIdx >= 5) {
        arcadeAudio.playStageClear();
        this.addScore(3000, this.logicalWidth * 0.5, 210, 'COURSE COMPLETE!');
        this.phase = 'STAGE_CLEAR';
        this.stateTimer = 1.6;
        return;
      }
    }

    // Authentic dual cannons: fire shoots BOTH forward laser AND upward anti-air turret!
    const wantFire = attract ? Math.sin(this.clock * 5) > 0.72 : this.input.fire || this.input.fireJustPressed;
    if (wantFire && this.fireCd <= 0) {
      this.fireCd = 0.2;
      this.shots.push({ x: this.px + 28, y: this.py - 8, vx: 520, vy: 0, fromEnemy: false, color: '#FACC15' });
      this.shots.push({ x: this.px, y: this.py - 24, vx: 0, vy: -520, fromEnemy: false, color: '#38BDF8' });
      if (!attract) arcadeAudio.playLaser();
    }

    // Spawn craters, rocks, mines, UFOs, and ground tanks!
    this.spawnCd -= dt;
    if (this.spawnCd <= 0) {
      this.spawnCd = Math.max(0.75, 1.45 - this.level * 0.08);
      const roll = Math.random();
      if (roll < 0.34) {
        this.moonHazards.push({ kind: 'crater', x: this.logicalWidth + 40, w: 54 + Math.random() * 24, hp: 99 });
      } else if (roll < 0.62) {
        this.moonHazards.push({ kind: 'rock', x: this.logicalWidth + 40, w: 30, hp: 1 });
      } else if (roll < 0.76) {
        this.moonHazards.push({ kind: 'mine', x: this.logicalWidth + 40, w: 22, hp: 99 });
      } else if (roll < 0.92) {
        this.enemies.push({
          id: this.nextId++,
          kind: 'moonUfo',
          x: this.logicalWidth + 30,
          y: 90 + Math.random() * 120,
          vx: -(130 + Math.random() * 60),
          vy: 0,
          hp: 1,
          maxHp: 1,
          fireCd: 1.0 + Math.random() * 0.9,
          phase: Math.random() * 6,
          color: '#F472B6',
        });
      } else {
        this.enemies.push({
          id: this.nextId++,
          kind: 'moonTank',
          x: this.logicalWidth + 40,
          y: groundY - 12,
          vx: -this.moonSpeed * 0.75,
          vy: 0,
          hp: 2,
          maxHp: 2,
          fireCd: 1.1,
          phase: 0,
          color: '#EF4444',
        });
      }
    }

    // Move hazards
    for (let i = this.moonHazards.length - 1; i >= 0; i--) {
      const h = this.moonHazards[i];
      h.x -= this.moonSpeed * dt;
      if (!attract && this.moonJumpY < 14 && Math.abs(h.x - this.px) < h.w * 0.45 + 14) {
        this.damagePlayer();
        this.moonHazards.splice(i, 1);
        return;
      }
      if (h.x < -80) this.moonHazards.splice(i, 1);
    }

    // Move UFOs & Tanks (UFO bombs blast NEW craters into the lunar surface!)
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.phase += dt * 3.5;
      e.x += e.vx * dt;
      if (e.kind === 'moonUfo') {
        e.y += Math.sin(e.phase) * 55 * dt;
        e.fireCd -= dt;
        if (e.fireCd <= 0 && e.x > this.px + 60 && e.x < this.logicalWidth - 40) {
          e.fireCd = 1.9;
          this.shots.push({ x: e.x, y: e.y + 14, vx: -40, vy: 220, fromEnemy: true, isBomb: true, color: '#F97316' });
        }
      } else if (e.kind === 'moonTank') {
        e.fireCd -= dt;
        if (e.fireCd <= 0) {
          e.fireCd = 1.5;
          this.shots.push({ x: e.x - 18, y: e.y - 6, vx: -360, vy: 0, fromEnemy: true, color: '#EF4444' });
        }
      }
      if (!attract && Math.hypot(e.x - this.px, e.y - this.py) < 26) {
        this.damagePlayer();
        return;
      }
      if (e.x < -60) this.enemies.splice(i, 1);
    }

    // Update shots
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.fromEnemy) {
        if (s.isBomb && s.y >= groundY) {
          // Authentic UFO crater bomb creates a real crater in the ground!
          this.moonHazards.push({ kind: 'crater', x: s.x, w: 50, hp: 99 });
          spawnBurst(this.particles, s.x, groundY, '#F97316', 14, 170, 3);
          this.shots.splice(i, 1);
          continue;
        }
        if (!attract && Math.hypot(s.x - this.px, s.y - this.py) < 22) {
          this.shots.splice(i, 1);
          this.damagePlayer();
          return;
        }
      } else {
        let hit = false;
        for (let j = this.moonHazards.length - 1; j >= 0; j--) {
          const h = this.moonHazards[j];
          if (h.kind === 'rock' && Math.abs(h.x - s.x) < 20 && Math.abs(groundY - 12 - s.y) < 24) {
            this.moonHazards.splice(j, 1);
            spawnBurst(this.particles, h.x, groundY - 10, '#F59E0B', 12, 160, 2.8);
            if (!attract) {
              arcadeAudio.playRockThud();
              this.addScore(200, h.x, groundY - 24);
            }
            hit = true;
            break;
          }
        }
        if (!hit) {
          for (let j = this.enemies.length - 1; j >= 0; j--) {
            const e = this.enemies[j];
            if (Math.hypot(e.x - s.x, e.y - s.y) < 24) {
              e.hp -= 1;
              hit = true;
              if (e.hp <= 0) {
                spawnBurst(this.particles, e.x, e.y, e.color, 16, 200, 3);
                if (!attract) {
                  arcadeAudio.playExplosion(false);
                  this.addScore(e.kind === 'moonTank' ? 500 : 300, e.x, e.y);
                }
                this.enemies.splice(j, 1);
              }
              break;
            }
          }
        }
        if (hit) {
          this.shots.splice(i, 1);
          continue;
        }
      }
      if (s.x < -30 || s.x > this.logicalWidth + 30 || s.y < -30 || s.y > this.logicalHeight + 30) {
        this.shots.splice(i, 1);
      }
    }
  }

  // ============================================================================
  // 3. TIME PILOT (1982 Konami — 360° Sky, Parachutists, V-Formations, Era Boss!)
  // ============================================================================
  private stepTimePilot(dt: number, attract: boolean): void {
    const cx = this.logicalWidth * 0.5;
    const cy = this.logicalHeight * 0.5;
    this.px = cx;
    this.py = cy;

    if (attract) {
      this.angle += 1.2 * dt;
    } else {
      let dx = 0;
      let dy = 0;
      if (this.input.left) dx -= 1;
      if (this.input.right) dx += 1;
      if (this.input.up) dy -= 1;
      if (this.input.down) dy += 1;
      if (dx !== 0 || dy !== 0) {
        const target = Math.atan2(dy, dx);
        let diff = target - this.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.angle += Math.sign(diff) * Math.min(Math.abs(diff), 7.5 * dt);
      }
    }

    const flySpeed = 195;
    const worldVx = -Math.cos(this.angle) * flySpeed;
    const worldVy = -Math.sin(this.angle) * flySpeed;

    for (const c of this.clouds) {
      c.x = (c.x + worldVx * dt + this.logicalWidth) % this.logicalWidth;
      c.y = (c.y + worldVy * dt + this.logicalHeight) % this.logicalHeight;
    }

    const wantFire = attract ? Math.sin(this.clock * 5) > 0.7 : this.input.fire || this.input.fireJustPressed;
    if (wantFire && this.fireCd <= 0) {
      this.fireCd = 0.14;
      this.shots.push({
        x: cx + Math.cos(this.angle) * 20,
        y: cy + Math.sin(this.angle) * 20,
        vx: Math.cos(this.angle) * 520,
        vy: Math.sin(this.angle) * 520,
        fromEnemy: false,
        color: '#FEF08A',
      });
      if (!attract) arcadeAudio.playLaser();
    }

    // Spawn Era Boss once kills reach 0!
    if (this.eraKillsLeft <= 0 && !this.eraBossSpawned) {
      this.eraBossSpawned = true;
      const era = TIME_PILOT_ERAS[(this.level - 1) % TIME_PILOT_ERAS.length];
      this.enemies.push({
        id: this.nextId++,
        kind: 'eraBoss',
        x: cx + 320,
        y: cy - 160,
        vx: -85,
        vy: 30,
        hp: 8 + this.level * 2,
        maxHp: 8 + this.level * 2,
        fireCd: 1.2,
        phase: 0,
        color: era.color,
      });
      if (!attract) {
        this.popups.push({ x: cx, y: 120, text: `${era.bossName} APPROACHING!`, color: '#FACC15', life: 1.5, maxLife: 1.5 });
      }
    }

    // Spawn planes, V-formations & Parachutists!
    this.spawnCd -= dt;
    if (this.spawnCd <= 0 && this.enemies.length < 11) {
      this.spawnCd = Math.max(0.85, 1.65 - this.level * 0.08);
      if (Math.random() < 0.25 && this.pickups.length < 2) {
        this.pickups.push({
          kind: 'parachute',
          x: Math.random() * this.logicalWidth,
          y: -18,
          vy: 42,
          label: 'PILOT',
        });
      }
      const edge = Math.random() * Math.PI * 2;
      const isSquad = Math.random() < 0.35;
      const count = isSquad ? 4 : 1;
      const sqId = isSquad ? this.nextSquadId++ : undefined;
      if (sqId !== undefined) this.squadCounts.set(sqId, count);
      for (let k = 0; k < count; k++) {
        const sx = cx + Math.cos(edge) * 390 + k * 24;
        const sy = cy + Math.sin(edge) * 310 + k * 18;
        this.enemies.push({
          id: this.nextId++,
          kind: isSquad ? 'redSquad' : 'plane',
          x: sx,
          y: sy,
          vx: -Math.cos(edge) * (120 + this.level * 12),
          vy: -Math.sin(edge) * (120 + this.level * 12),
          hp: 1,
          maxHp: 1,
          fireCd: 1.6 + Math.random(),
          phase: k,
          squadId: sqId,
          color: isSquad ? '#EF4444' : '#38BDF8',
        });
      }
    }

    // Parachutist pickups (1000, 2000, 3000, 4000, 5000 pts!)
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.x += worldVx * dt;
      p.y += (worldVy + p.vy) * dt;
      if (!attract && Math.hypot(p.x - cx, p.y - cy) < 28) {
        this.parachuteStreak = Math.min(5, this.parachuteStreak + 1);
        const pts = this.parachuteStreak * 1000;
        arcadeAudio.playPowerUp();
        this.addScore(pts, cx, cy - 30, 'PILOT RESCUED');
        this.pickups.splice(i, 1);
        continue;
      }
      if (p.x < -120 || p.x > this.logicalWidth + 120 || p.y < -120 || p.y > this.logicalHeight + 120) {
        this.pickups.splice(i, 1);
      }
    }

    // Update enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const toP = Math.atan2(cy - e.y, cx - e.x);
      const spd = e.kind === 'eraBoss' ? 95 : 135 + this.level * 10;
      e.vx += (Math.cos(toP) * spd - e.vx) * Math.min(1, dt * (e.kind === 'eraBoss' ? 0.9 : 1.5));
      e.vy += (Math.sin(toP) * spd - e.vy) * Math.min(1, dt * (e.kind === 'eraBoss' ? 0.9 : 1.5));
      e.x += (e.vx + worldVx) * dt;
      e.y += (e.vy + worldVy) * dt;
      e.fireCd -= dt;
      if (e.fireCd <= 0 && !attract) {
        e.fireCd = e.kind === 'eraBoss' ? 1.05 : 2.1;
        this.shots.push({
          x: e.x,
          y: e.y,
          vx: Math.cos(toP) * 240,
          vy: Math.sin(toP) * 240,
          fromEnemy: true,
          color: '#F43F5E',
        });
      }
      if (!attract && Math.hypot(e.x - cx, e.y - cy) < (e.kind === 'eraBoss' ? 36 : 20)) {
        this.damagePlayer();
        if (e.kind !== 'eraBoss') this.enemies.splice(i, 1);
        return;
      }
      if (e.kind !== 'eraBoss' && (e.x < -220 || e.x > this.logicalWidth + 220 || e.y < -220 || e.y > this.logicalHeight + 220)) {
        this.enemies.splice(i, 1);
      }
    }

    // Update shots
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.x += (s.vx + (s.fromEnemy ? worldVx * 0.45 : 0)) * dt;
      s.y += (s.vy + (s.fromEnemy ? worldVy * 0.45 : 0)) * dt;
      if (s.x < -30 || s.x > this.logicalWidth + 30 || s.y < -30 || s.y > this.logicalHeight + 30) {
        this.shots.splice(i, 1);
        continue;
      }
      if (s.fromEnemy) {
        if (!attract && Math.hypot(s.x - cx, s.y - cy) < 16) {
          this.shots.splice(i, 1);
          this.damagePlayer();
          return;
        }
        continue;
      }
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (Math.hypot(e.x - s.x, e.y - s.y) < (e.kind === 'eraBoss' ? 38 : 20)) {
          this.shots.splice(i, 1);
          e.hp -= 1;
          if (e.hp <= 0) {
            spawnBurst(this.particles, e.x, e.y, e.color, e.kind === 'eraBoss' ? 34 : 14, 220, 3.4);
            if (!attract) {
              arcadeAudio.playExplosion(e.kind === 'eraBoss');
              if (e.kind === 'eraBoss') {
                this.addScore(3000, e.x, e.y, 'TIME WARP!');
                arcadeAudio.playStageClear();
                this.phase = 'STAGE_CLEAR';
                this.stateTimer = 1.6;
              } else {
                this.eraKillsLeft = Math.max(0, this.eraKillsLeft - 1);
                this.addScore(100, e.x, e.y);
                if (e.squadId !== undefined) {
                  const rem = (this.squadCounts.get(e.squadId) ?? 1) - 1;
                  this.squadCounts.set(e.squadId, rem);
                  if (rem === 0) this.addScore(2000, e.x, e.y - 18, 'FORMATION BONUS');
                }
              }
            }
            this.enemies.splice(j, 1);
          }
          break;
        }
      }
    }
  }

  // ============================================================================
  // 4. 1942 & 1943 (Capcom — Red POW Formations, Loop Roll, Shotgun, Yamato Boss!)
  // ============================================================================
  private step194x(dt: number, attract: boolean): void {
    this.scrollX += 90 * dt;
    if (this.variant === 'ww1943' && !attract) {
      this.fuel = Math.max(0, this.fuel - dt * 1.9);
      if (this.fuel <= 0) {
        arcadeAudio.playDeath();
        this.phase = 'GAME_OVER';
        return;
      }
    }

    if (attract) {
      this.px = this.logicalWidth * 0.5 + Math.sin(this.clock * 1.4) * 165;
      this.py = this.logicalHeight - 110 + Math.cos(this.clock * 1.8) * 35;
    } else {
      const spd = 290;
      if (this.input.left) this.px -= spd * dt;
      if (this.input.right) this.px += spd * dt;
      if (this.input.up) this.py -= spd * dt;
      if (this.input.down) this.py += spd * dt;
      this.px = Math.max(36, Math.min(this.logicalWidth - 36, this.px));
      this.py = Math.max(90, Math.min(this.logicalHeight - 44, this.py));

      // Loop-the-Loop (1942) or Lightning Mega-Crash (1943)!
      if (this.input.secondaryJustPressed && this.loopTimer <= 0) {
        if (this.variant === 'ww1942' && this.loopsLeft > 0) {
          this.loopsLeft -= 1;
          this.loopTimer = 1.25;
          arcadeAudio.playJump();
        } else if (this.variant === 'ww1943' && this.fuel > 18) {
          this.fuel -= 14;
          this.loopTimer = 0.8;
          this.shots = this.shots.filter((s) => !s.fromEnemy);
          arcadeAudio.playExplosion(true);
          for (const e of this.enemies) e.hp -= 2;
          this.popups.push({ x: this.px, y: this.py - 36, text: 'LIGHTNING CRASH!', color: '#38BDF8', life: 0.9, maxLife: 0.9 });
        }
      }
    }

    // Weapons firing (Normal Twin, Quad, 1943 Bullet-Erasing Shotgun, 3-Way, Laser!)
    const wantFire = attract ? Math.sin(this.clock * 6) > 0.72 : this.input.fire || this.input.fireJustPressed;
    if (wantFire && this.fireCd <= 0 && this.loopTimer <= 0) {
      this.fireCd = this.weaponMode === 'laser' ? 0.14 : 0.16;
      const origins = [this.px];
      if (this.wingmen >= 1) origins.push(this.px - 32);
      if (this.wingmen >= 2) origins.push(this.px + 32);
      for (const ox of origins) {
        if (this.weaponMode === 'shotgun') {
          for (let k = -2; k <= 2; k++) {
            this.shots.push({
              x: ox + k * 7,
              y: this.py - 18,
              vx: k * 55,
              vy: -560,
              fromEnemy: false,
              isShotgun: true,
              color: '#FACC15',
            });
          }
        } else if (this.weaponMode === 'threeway') {
          for (const vx of [-145, 0, 145]) {
            this.shots.push({ x: ox, y: this.py - 18, vx, vy: -580, fromEnemy: false, color: '#38BDF8' });
          }
        } else if (this.weaponMode === 'quad' || this.weaponMode === 'laser') {
          this.shots.push({ x: ox - 11, y: this.py - 18, vx: 0, vy: -640, fromEnemy: false, color: '#4ADE80' });
          this.shots.push({ x: ox + 11, y: this.py - 18, vx: 0, vy: -640, fromEnemy: false, color: '#4ADE80' });
        } else {
          this.shots.push({ x: ox - 6, y: this.py - 18, vx: 0, vy: -600, fromEnemy: false, color: '#FEF08A' });
          this.shots.push({ x: ox + 6, y: this.py - 18, vx: 0, vy: -600, fromEnemy: false, color: '#FEF08A' });
        }
      }
      if (!attract) arcadeAudio.playLaser();
    }

    // Trigger 1943 Naval Battleship Boss (Yamato / Tone) at scrollX > 1700!
    if (this.scrollX > 1650 && !this.battleshipActive) {
      this.battleshipActive = true;
      this.battleshipY = -140;
      const turretOffsets = [
        [-42, -55],
        [42, -55],
        [0, -10],
        [-36, 48],
        [36, 48],
      ];
      for (const [ox, oy] of turretOffsets) {
        this.enemies.push({
          id: this.nextId++,
          kind: 'battleshipTurret',
          x: this.logicalWidth * 0.5 + ox,
          y: this.battleshipY + oy,
          vx: ox,
          vy: oy,
          hp: 4 + this.level,
          maxHp: 4 + this.level,
          fireCd: 1.0 + Math.random(),
          phase: 0,
          color: '#EF4444',
        });
      }
      if (!attract) {
        this.popups.push({
          x: this.logicalWidth * 0.5,
          y: 150,
          text: this.variant === 'ww1943' ? 'BATTLESHIP YAMATO SPOTTED!' : 'AYAKO SUPER BOMBER!',
          color: '#FACC15',
          life: 1.5,
          maxLife: 1.5,
        });
      }
    }

    if (this.battleshipActive) {
      this.battleshipY = Math.min(185, this.battleshipY + 55 * dt);
      const turretsLeft = this.enemies.filter((e) => e.kind === 'battleshipTurret');
      for (const t of turretsLeft) {
        t.x = this.logicalWidth * 0.5 + t.vx;
        t.y = this.battleshipY + t.vy;
      }
      if (!attract && turretsLeft.length === 0) {
        arcadeAudio.playStageClear();
        this.addScore(5000, this.logicalWidth * 0.5, this.battleshipY, 'BOSS SUNK!');
        this.phase = 'STAGE_CLEAR';
        this.stateTimer = 1.65;
        return;
      }
    }

    // Spawn Red POW Formations & Regular Fighters
    this.spawnCd -= dt;
    if (this.spawnCd <= 0 && !this.battleshipActive) {
      this.spawnCd = Math.max(0.65, 1.3 - this.level * 0.08);
      if (Math.random() < 0.35) {
        // Authentic 5-plane Red POW Formation!
        const sqId = this.nextSquadId++;
        this.squadCounts.set(sqId, 5);
        const startX = 90 + Math.random() * (this.logicalWidth - 180);
        for (let k = 0; k < 5; k++) {
          this.enemies.push({
            id: this.nextId++,
            kind: 'redSquad',
            x: startX,
            y: -25 - k * 36,
            vx: 0,
            vy: 155,
            hp: 1,
            maxHp: 1,
            fireCd: 1.6,
            phase: k * 0.35,
            squadId: sqId,
            color: '#EF4444',
          });
        }
      } else {
        this.enemies.push({
          id: this.nextId++,
          kind: 'plane',
          x: 60 + Math.random() * (this.logicalWidth - 120),
          y: -24,
          vx: (Math.random() - 0.5) * 85,
          vy: 150 + this.level * 12,
          hp: 1,
          maxHp: 1,
          fireCd: 1.2 + Math.random(),
          phase: Math.random() * 6,
          color: '#22C55E',
        });
      }
    }

    // Pickups (POW, Shotgun, 3-Way, Wingmen)
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.y += p.vy * dt;
      if (!attract && Math.hypot(p.x - this.px, p.y - this.py) < 28) {
        arcadeAudio.playPowerUp();
        if (p.kind === 'shotgun') {
          this.weaponMode = 'shotgun';
          this.weaponTimer = 14;
        } else if (p.kind === 'threeway') {
          this.weaponMode = 'threeway';
          this.weaponTimer = 14;
        } else if (p.kind === 'wingman') {
          this.wingmen = Math.min(2, this.wingmen + 1);
        } else {
          this.weaponMode = 'quad';
          this.fuel = Math.min(100, this.fuel + 35);
          this.loopsLeft = Math.min(5, this.loopsLeft + 1);
        }
        this.addScore(500, p.x, p.y, p.label);
        this.pickups.splice(i, 1);
        continue;
      }
      if (p.y > this.logicalHeight + 30) this.pickups.splice(i, 1);
    }

    // Update enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.phase += dt * 3.5;
      if (e.kind !== 'battleshipTurret') {
        e.x += (e.kind === 'redSquad' ? Math.sin(e.phase) * 145 : e.vx) * dt;
        e.y += e.vy * dt;
      }
      e.fireCd -= dt;
      if (e.fireCd <= 0 && !attract && e.y > 20 && e.y < this.logicalHeight - 140) {
        e.fireCd = e.kind === 'battleshipTurret' ? 1.25 : 1.85;
        const ang = Math.atan2(this.py - e.y, this.px - e.x);
        this.shots.push({
          x: e.x,
          y: e.y + 10,
          vx: Math.cos(ang) * 230,
          vy: Math.sin(ang) * 230,
          fromEnemy: true,
          color: '#F97316',
        });
      }
      if (!attract && Math.hypot(e.x - this.px, e.y - this.py) < 24) {
        this.damagePlayer();
        if (e.kind !== 'battleshipTurret') this.enemies.splice(i, 1);
        return;
      }
      if (e.y > this.logicalHeight + 40) this.enemies.splice(i, 1);
    }

    // Update shots (1943 Shotgun erases enemy bullets!)
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.x < -30 || s.x > this.logicalWidth + 30 || s.y < -30 || s.y > this.logicalHeight + 30) {
        this.shots.splice(i, 1);
        continue;
      }
      if (s.fromEnemy) {
        if (!attract && Math.hypot(s.x - this.px, s.y - this.py) < 16) {
          this.shots.splice(i, 1);
          this.damagePlayer();
          return;
        }
        continue;
      }

      if (s.isShotgun) {
        for (let k = this.shots.length - 1; k >= 0; k--) {
          if (this.shots[k].fromEnemy && Math.hypot(this.shots[k].x - s.x, this.shots[k].y - s.y) < 18) {
            this.shots.splice(k, 1);
            if (k < i) i--;
          }
        }
      }

      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (Math.hypot(e.x - s.x, e.y - s.y) < 22) {
          this.shots.splice(i, 1);
          e.hp -= 1;
          if (e.hp <= 0) {
            spawnBurst(this.particles, e.x, e.y, e.color, 16, 200, 3);
            if (!attract) {
              arcadeAudio.playExplosion(e.kind === 'battleshipTurret');
              this.addScore(e.kind === 'battleshipTurret' ? 600 : 150, e.x, e.y);
              if (e.squadId !== undefined) {
                const rem = (this.squadCounts.get(e.squadId) ?? 1) - 1;
                this.squadCounts.set(e.squadId, rem);
                if (rem === 0) {
                  // Drop authentic POW / 1943 Weapon Pickup!
                  const kinds: Array<{ kind: PickupItem['kind']; label: string }> =
                    this.variant === 'ww1943'
                      ? [
                          { kind: 'shotgun', label: 'SHOTGUN' },
                          { kind: 'threeway', label: '3-WAY' },
                          { kind: 'pow', label: 'POW FUEL' },
                        ]
                      : [
                          { kind: 'pow', label: 'POW QUAD' },
                          { kind: 'wingman', label: 'WINGMAN' },
                        ];
                  const pick = kinds[Math.floor(Math.random() * kinds.length)];
                  this.pickups.push({ kind: pick.kind, x: e.x, y: e.y, vy: 75, label: pick.label });
                }
              }
            }
            this.enemies.splice(j, 1);
          }
          break;
        }
      }
    }
  }

  public getHudSnapshot(): ClassicGameHud {
    const sectorNames = ['MOUNTAINS', 'CAVERNS', 'FIREBALLS', 'CITY MAZE', 'BASE'];
    const era = TIME_PILOT_ERAS[(this.level - 1) % TIME_PILOT_ERAS.length];
    const cpLetters = ['A', 'E', 'J', 'O', 'T', 'Z'];
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName:
        this.variant === 'scramble'
          ? `SCRAMBLE · ${sectorNames[this.scrambleSector]}`
          : this.variant === 'moonpatrol'
            ? `MOON PATROL · POINT ${cpLetters[Math.min(5, this.moonCheckpointIdx)]}`
            : this.variant === 'timepilot'
              ? `TIME PILOT · YEAR ${era.year}`
              : `${this.variant === 'ww1942' ? '1942' : '1943'} · MISSION ${this.level}`,
      primaryMetricLabel:
        this.variant === 'scramble' || this.variant === 'ww1943'
          ? 'FUEL / HP'
          : this.variant === 'moonpatrol'
            ? 'SPEED'
            : this.variant === 'timepilot'
              ? 'TO BOSS'
              : 'LOOPS',
      primaryMetricValue:
        this.variant === 'scramble' || this.variant === 'ww1943'
          ? `${Math.round(this.fuel)}%`
          : this.variant === 'moonpatrol'
            ? `${Math.round(this.moonSpeed)} KPH`
            : this.variant === 'timepilot'
              ? this.eraBossSpawned
                ? 'BOSS!'
                : String(this.eraKillsLeft)
              : String(this.loopsLeft),
      secondaryMetricLabel:
        this.variant === 'ww1942' || this.variant === 'ww1943'
          ? 'WEAPON'
          : this.variant === 'moonpatrol'
            ? 'TIME'
            : 'SECTOR',
      secondaryMetricValue:
        this.variant === 'ww1942' || this.variant === 'ww1943'
          ? this.weaponMode.toUpperCase()
          : this.variant === 'moonpatrol'
            ? `${Math.floor(this.moonCourseTimer)}s`
            : `LV ${this.level}`,
      bannerText: this.phase === 'STAGE_CLEAR' ? 'MISSION ACCOMPLISHED!' : this.phase === 'GAME_OVER' ? 'GAME OVER' : '',
    };
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = this.logicalWidth;
    const H = this.logicalHeight;

    if (this.variant === 'scramble') {
      this.renderScramble(ctx, W, H);
    } else if (this.variant === 'moonpatrol') {
      this.renderMoonPatrol(ctx, W, H);
    } else if (this.variant === 'timepilot') {
      this.renderTimePilot(ctx, W, H);
    } else {
      this.render194x(ctx, W, H);
    }

    renderParticlesAndPopups(ctx, this.particles, this.popups);
    if (this.phase === 'TITLE') {
      ctx.fillStyle = 'rgba(4, 10, 24, 0.72)';
      ctx.fillRect(0, H * 0.36, W, 114);
      ctx.textAlign = 'center';
      ctx.font = '900 34px "JetBrains Mono", monospace';
      ctx.fillStyle = '#FACC15';
      const titleLabel =
        this.variant === 'ww1942' ? '1942' : this.variant === 'ww1943' ? '1943: BATTLE OF MIDWAY' : this.variant.toUpperCase();
      ctx.fillText(titleLabel, W * 0.5, H * 0.36 + 46);
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillStyle = '#E2E8F0';
      const sub: Record<ScrollingShooterVariant, string> = {
        scramble: '5 SECTORS · MOUNTAINS → CAVERNS → FIREBALLS → CITY MAZE → BASE',
        moonpatrol: 'LEFT/RIGHT SPEED · UP/SHIFT JUMP CRATERS · DUAL ANTI-AIR & GROUND GUNS',
        timepilot: '360° AERIAL COMBAT · RESCUE PARACHUTISTS · DEFEAT ERA BOSS TO TIME WARP',
        ww1942: 'DESTROY RED SQUADRONS FOR POW · SHIFT TO LOOP-THE-LOOP · WINGMEN',
        ww1943: 'SHOTGUN ERASES BULLETS · LIGHTNING CRASH · SINK BATTLESHIP YAMATO',
      };
      ctx.fillText(sub[this.variant], W * 0.5, H * 0.36 + 80);
    }
    if (visualMode === 'crt') renderCrtOverlay(ctx, W, H);
  }

  private renderScramble(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    // Authentic 1981 Konami deep-space sky + blinking stars
    ctx.fillStyle = '#030510';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 48; i++) {
      const sx = ((i * 157 - this.scrollX * 0.18) % W + W) % W;
      const sy = (i * 89 + 19) % (H * 0.72);
      ctx.fillStyle = i % 3 === 0 ? '#FACC15' : i % 2 === 0 ? '#38BDF8' : '#E2E8F0';
      ctx.fillRect(sx, sy, 2, 2);
    }

    // Sector-distinct Konami cavern geology palettes (Mountains -> Caverns -> Fireballs -> City -> Base)
    const floorPal = ['#B45309', '#9A3412', '#991B1B', '#334155', '#4C1D95'][this.scrambleSector] ?? '#B45309';
    const crustPal = ['#F59E0B', '#F97316', '#EF4444', '#38BDF8', '#C084FC'][this.scrambleSector] ?? '#F59E0B';
    const ceilPal = ['#78350F', '#7C2D12', '#7F1D1D', '#1E293B', '#3B0764'][this.scrambleSector] ?? '#78350F';

    // Floor terrain + bright rim crust
    ctx.fillStyle = floorPal;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 12) {
      const t = this.getScrambleTerrain(this.scrollX + x);
      ctx.lineTo(x, t.floor);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = crustPal;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 12) {
      const t = this.getScrambleTerrain(this.scrollX + x);
      if (x === 0) ctx.moveTo(x, t.floor);
      else ctx.lineTo(x, t.floor);
    }
    ctx.stroke();

    // Ceiling terrain in Caverns / City Maze / Base
    ctx.fillStyle = ceilPal;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let x = 0; x <= W; x += 12) {
      const t = this.getScrambleTerrain(this.scrollX + x);
      ctx.lineTo(x, t.ceil);
    }
    ctx.lineTo(W, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = crustPal;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 12) {
      const t = this.getScrambleTerrain(this.scrollX + x);
      if (x === 0) ctx.moveTo(x, t.ceil);
      else ctx.lineTo(x, t.ceil);
    }
    ctx.stroke();

    // Enemies (Detailed Konami Fuel Tanks, Launch Rockets, Fireballs, UFOs & Base Core!)
    for (const e of this.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);
      if (e.kind === 'fuel') {
        // Iconic 1981 Konami cyan/green striped FUEL depot tank
        ctx.fillStyle = '#15803D';
        ctx.beginPath();
        ctx.roundRect(-14, -15, 28, 30, 4);
        ctx.fill();
        ctx.fillStyle = '#4ADE80';
        ctx.fillRect(-12, -13, 24, 5);
        ctx.strokeStyle = '#FEF08A';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('FUEL', 0, 4);
      } else if (e.kind === 'rocket') {
        // Authentic white/red Konami surface-to-air ICBM with ignition flame!
        if (Math.abs(e.vy) > 5) {
          ctx.fillStyle = Math.floor(this.clock * 24) % 2 === 0 ? '#FEF08A' : '#F97316';
          ctx.beginPath();
          ctx.moveTo(-5, 13);
          ctx.lineTo(5, 13);
          ctx.lineTo(0, 24 + Math.sin(this.clock * 40) * 4);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = '#F8FAFC';
        ctx.beginPath();
        ctx.moveTo(0, -20);
        ctx.lineTo(6, -6);
        ctx.lineTo(6, 12);
        ctx.lineTo(-6, 12);
        ctx.lineTo(-6, -6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.moveTo(0, -20);
        ctx.lineTo(5, -9);
        ctx.lineTo(-5, -9);
        ctx.closePath();
        ctx.fill();
        // Side rocket fins
        ctx.fillRect(-10, 5, 4, 8);
        ctx.fillRect(6, 5, 4, 8);
      } else if (e.kind === 'base') {
        // Armored Final Sector Super-Base Reactor!
        ctx.fillStyle = '#CA8A04';
        ctx.fillRect(-28, -24, 56, 48);
        ctx.strokeStyle = '#FEF08A';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(-28, -24, 56, 48);
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-18, -14, 36, 28);
        ctx.fillStyle = Math.floor(this.clock * 12) % 2 === 0 ? '#EF4444' : '#F97316';
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Spinning Meteor Fireball / Alien Saucer
        ctx.rotate(this.clock * 7);
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(-3, -3, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Shots & Arcing Bombs
    for (const s of this.shots) {
      ctx.fillStyle = s.color;
      if (s.isBomb) {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(Math.atan2(s.vy, s.vx));
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.ellipse(0, 0, 7, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(-8, -3, 3, 6);
        ctx.restore();
      } else {
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(s.x - 10, s.y - 2, 20, 4);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(s.x - 6, s.y - 1, 14, 2);
      }
    }

    // Iconic 1981 Konami Scramble Fighter Jet with Exhaust Flame!
    ctx.save();
    ctx.translate(this.px, this.py);
    const fl = 9 + Math.sin(this.clock * 32) * 3.5;
    ctx.fillStyle = '#F97316';
    ctx.beginPath();
    ctx.moveTo(-14, -4);
    ctx.lineTo(-14 - fl, 0);
    ctx.lineTo(-14, 4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.moveTo(24, 2);
    ctx.lineTo(6, -5);
    ctx.lineTo(-10, -13);
    ctx.lineTo(-15, -13);
    ctx.lineTo(-12, 0);
    ctx.lineTo(-16, 10);
    ctx.lineTo(14, 7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(-13, -12, 7, 4);
    ctx.fillStyle = '#38BDF8';
    ctx.beginPath();
    ctx.ellipse(6, -2, 7, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private renderMoonPatrol(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    const groundY = 432;
    const sky = ctx.createLinearGradient(0, 0, 0, groundY);
    sky.addColorStop(0, '#020412');
    sky.addColorStop(0.65, '#110E36');
    sky.addColorStop(1, '#1E1B4B');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, groundY);

    // Layer 1: Distant Twinkling Stars
    for (let i = 0; i < 42; i++) {
      const sx = ((i * 139 - this.scrollX * 0.04) % W + W) % W;
      const sy = (i * 61 + 16) % 210;
      ctx.fillStyle = i % 4 === 0 ? '#FDE68A' : '#CBD5E1';
      ctx.fillRect(sx, sy, 2, 2);
    }

    // Layer 2: Authentic Irem Far Blue Jagged Lunar Mountain Range (slow parallax)
    ctx.fillStyle = '#1D4ED8';
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    for (let x = 0; x <= W + 24; x += 24) {
      const m = Math.abs(Math.sin((x + this.scrollX * 0.14) * 0.006)) * 96 + Math.sin((x + this.scrollX * 0.14) * 0.019) * 22;
      ctx.lineTo(x, groundY - 68 - m);
    }
    ctx.lineTo(W, groundY);
    ctx.closePath();
    ctx.fill();

    // Layer 3: Authentic Irem Midground Emerald/Teal Moon City Skyline & Domes (medium parallax)
    ctx.fillStyle = '#0F766E';
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    for (let x = 0; x <= W + 20; x += 20) {
      const h = Math.abs(Math.sin((x + this.scrollX * 0.34) * 0.011)) * 56;
      ctx.lineTo(x, groundY - 22 - h);
    }
    ctx.lineTo(W, groundY);
    ctx.closePath();
    ctx.fill();

    // Futuristic Moon City Domes & Spires along the midground ridge
    for (let i = 0; i < 7; i++) {
      const bx = ((i * 165 - this.scrollX * 0.34) % (W + 180) + (W + 180)) % (W + 180) - 60;
      ctx.fillStyle = '#14B8A6';
      ctx.fillRect(bx, groundY - 48, 22, 48);
      ctx.fillStyle = '#5EEAD4';
      ctx.fillRect(bx + 5, groundY - 42, 4, 8);
      ctx.fillRect(bx + 13, groundY - 42, 4, 8);
      ctx.beginPath();
      ctx.arc(bx + 36, groundY - 18, 16, Math.PI, 0);
      ctx.fill();
    }

    // Textured Amber Lunar Surface & Scrolling Highway Ticks
    ctx.fillStyle = '#92400E';
    ctx.fillRect(0, groundY, W, H - groundY);
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(0, groundY, W, 7);
    ctx.fillStyle = '#B45309';
    const groundOff = this.scrollX % 48;
    for (let x = -48; x < W + 48; x += 48) {
      ctx.fillRect(x - groundOff, groundY + 18, 20, 6);
      ctx.fillRect(x + 24 - groundOff, groundY + 38, 14, 5);
    }

    // Craters, Jagged Boulders, Blinking Land Mines
    for (const h of this.moonHazards) {
      if (h.kind === 'crater') {
        ctx.fillStyle = '#020617';
        ctx.beginPath();
        ctx.ellipse(h.x, groundY + 3, h.w * 0.5, 24, 0, 0, Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#78350F';
        ctx.lineWidth = 3;
        ctx.stroke();
      } else if (h.kind === 'rock') {
        ctx.fillStyle = '#64748B';
        ctx.beginPath();
        ctx.moveTo(h.x - 16, groundY);
        ctx.lineTo(h.x - 11, groundY - 22);
        ctx.lineTo(h.x + 2, groundY - 27);
        ctx.lineTo(h.x + 15, groundY - 14);
        ctx.lineTo(h.x + 16, groundY);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#CBD5E1';
        ctx.fillRect(h.x - 6, groundY - 20, 8, 6);
      } else {
        ctx.fillStyle = Math.floor(this.clock * 14) % 2 === 0 ? '#EF4444' : '#FEF08A';
        ctx.beginPath();
        ctx.arc(h.x, groundY - 4, 10, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#991B1B';
        ctx.fillRect(h.x - 12, groundY - 4, 24, 4);
      }
    }

    // Detailed Alien Saucers & Armored Surface Tanks
    for (const e of this.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);
      if (e.kind === 'moonUfo') {
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.arc(0, -4, 10, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, 20, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FEF08A';
        for (let k = -10; k <= 10; k += 10) ctx.fillRect(k - 2, -2, 4, 4);
      } else {
        ctx.fillStyle = '#475569';
        ctx.fillRect(-20, -14, 40, 16);
        ctx.fillStyle = e.color;
        ctx.fillRect(-12, -22, 22, 10);
        ctx.fillStyle = '#FEF08A';
        ctx.fillRect(-26, -19, 14, 4); // Barrel
        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.roundRect(-20, -2, 40, 8, 4);
        ctx.fill();
      }
      ctx.restore();
    }

    // Shots
    for (const s of this.shots) {
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Iconic 1982 Irem 6-Wheel Articulated Pink Moon Buggy with Suspension Struts & Dual Turrets!
    ctx.save();
    ctx.translate(this.px, this.py);
    // Top anti-aircraft turret & front gun barrel
    ctx.fillStyle = '#FEF08A';
    ctx.fillRect(2, -37, 4, 10);
    ctx.fillRect(22, -18, 12, 4);
    // Pink chassis & glowing cyan dome canopy
    ctx.fillStyle = '#EC4899';
    ctx.beginPath();
    ctx.roundRect(-26, -24, 52, 15, 6);
    ctx.fill();
    ctx.fillStyle = '#F9A8D4';
    ctx.fillRect(-22, -22, 44, 4);
    ctx.fillStyle = '#38BDF8';
    ctx.beginPath();
    ctx.arc(2, -22, 12, Math.PI, 0);
    ctx.fill();
    // 3 articulating suspension struts & spoked wheels
    for (const wx of [-17, 0, 17]) {
      const bounce = this.moonJumpY > 0 ? 4 : Math.sin(this.clock * 22 + wx) * 2.2;
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(wx, -10);
      ctx.lineTo(wx, -3 + bounce);
      ctx.stroke();
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.arc(wx, -2 + bounce, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#F8FAFC';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(wx, -2 + bounce, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderTimePilot(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    const era = TIME_PILOT_ERAS[(this.level - 1) % TIME_PILOT_ERAS.length];
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, era.bgA);
    g.addColorStop(1, era.bgB);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Multi-puff Clouds (1910–1982) or Deep Space Stars (2001)!
    for (const c of this.clouds) {
      if (era.year === 2001) {
        ctx.fillStyle = '#E0F2FE';
        ctx.fillRect(c.x, c.y, 2.5, 2.5);
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx.arc(c.x + c.r * 0.7, c.y + 4, c.r * 0.72, 0, Math.PI * 2);
        ctx.arc(c.x - c.r * 0.65, c.y + 5, c.r * 0.68, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Parachutists with shroud lines
    for (const p of this.pickups) {
      const sway = Math.sin(this.clock * 5 + p.x) * 3;
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(p.x - 11, p.y - 10);
      ctx.lineTo(p.x + sway, p.y + 2);
      ctx.moveTo(p.x + 11, p.y - 10);
      ctx.lineTo(p.x + sway, p.y + 2);
      ctx.stroke();
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(p.x, p.y - 10, 13, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(p.x - 4 + sway, p.y, 8, 12);
    }

    // Era-Accurate Enemy Aircraft & Era Mothership Bosses (1910 / 1940 / 1970 / 1982 / 2001)!
    for (const e of this.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(Math.atan2(e.vy, e.vx));
      if (e.kind === 'eraBoss') {
        if (era.year === 1910) {
          // Giant 1910 Dirigible Blimp!
          ctx.fillStyle = '#E2E8F0';
          ctx.beginPath();
          ctx.ellipse(0, 0, 44, 20, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#EF4444';
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.fillStyle = '#EF4444';
          ctx.fillRect(-14, -4, 28, 8);
        } else if (era.year === 2001) {
          // 2001 Glowing Mother Saucer!
          ctx.fillStyle = '#C084FC';
          ctx.beginPath();
          ctx.arc(0, 0, 32, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 3.5;
          ctx.stroke();
          ctx.fillStyle = '#FEF08A';
          ctx.beginPath();
          ctx.arc(0, 0, 12, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Heavy Twin/Quad-Engine Era Bomber (B-25 / Chinook / B-52)!
          ctx.fillStyle = e.color;
          ctx.fillRect(-10, -38, 18, 76);
          ctx.fillRect(-34, -8, 68, 16);
          ctx.fillStyle = '#38BDF8';
          ctx.fillRect(14, -6, 12, 12);
        }
      } else if (era.year === 1910) {
        // 1910 Biplane with twin stacked wings!
        ctx.fillStyle = e.color;
        ctx.fillRect(-12, -3, 24, 6);
        ctx.fillRect(-2, -15, 6, 30);
        ctx.fillRect(4, -15, 4, 30);
      } else if (era.year === 1970) {
        // 1970 Attack Helicopter with spinning rotor blades!
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.ellipse(3, 0, 12, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-16, -2, 16, 4);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        const rot = this.clock * 28 + e.x;
        ctx.beginPath();
        ctx.moveTo(Math.cos(rot) * 16, Math.sin(rot) * 16);
        ctx.lineTo(-Math.cos(rot) * 16, -Math.sin(rot) * 16);
        ctx.stroke();
      } else if (era.year === 2001) {
        // 2001 Alien Flying Saucer!
        ctx.fillStyle = '#A855F7';
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // 1940 Monoplane / 1982 Swept-Wing Jet
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(-4, -14);
        ctx.lineTo(-10, -14);
        ctx.lineTo(-6, 0);
        ctx.lineTo(-10, 14);
        ctx.lineTo(-4, 14);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // Shots
    for (const s of this.shots) {
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sleek Time-Jumping Konami Jet centered in 360° open sky!
    ctx.save();
    ctx.translate(W * 0.5, H * 0.5);
    ctx.rotate(this.angle);
    ctx.fillStyle = '#F97316';
    ctx.beginPath();
    ctx.moveTo(-11, -3);
    ctx.lineTo(-20 - Math.sin(this.clock * 35) * 3, 0);
    ctx.lineTo(-11, 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(2, -5);
    ctx.lineTo(-12, -16);
    ctx.lineTo(-15, -12);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-15, 12);
    ctx.lineTo(-12, 16);
    ctx.lineTo(2, 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(-4, -3.5, 11, 7);
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(4, -2.5, 6, 5);
    ctx.restore();
  }

  private render194x(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    const is1943 = this.variant === 'ww1943';
    // Distinct Pacific Ocean styling: 1942 Royal Cobalt + Green Atolls vs 1943 Midway Deep Turquoise + Sun Swells!
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, H);
    oceanGrad.addColorStop(0, is1943 ? '#0C4A6E' : '#075985');
    oceanGrad.addColorStop(1, is1943 ? '#082F49' : '#0369A1');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, W, H);

    // Scrolling Ocean Swells & Whitecaps
    ctx.fillStyle = is1943 ? 'rgba(56, 189, 248, 0.22)' : 'rgba(125, 211, 252, 0.25)';
    const waveOff = this.scrollX % 64;
    for (let y = -64 + waveOff; y < H + 64; y += 64) {
      for (let x = 24; x < W; x += 110) {
        const shift = ((Math.floor(y / 64) % 2) * 55);
        ctx.fillRect((x + shift) % W, y, 42, 4);
      }
    }

    // Scrolling Tropical Pacific Atoll Islands!
    for (let i = 0; i < 3; i++) {
      const iy = ((this.scrollX * 0.45 + i * 280) % (H + 220)) - 110;
      const ix = i === 0 ? 96 : i === 1 ? W - 112 : W * 0.5 + 85;
      ctx.fillStyle = 'rgba(254, 240, 138, 0.42)';
      ctx.beginPath();
      ctx.ellipse(ix, iy, 54, 34, i * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = is1943 ? '#15803D' : '#16A34A';
      ctx.beginPath();
      ctx.ellipse(ix, iy, 42, 24, i * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Detailed Battleship Yamato Superstructure & Bow Wake (1943)!
    if (this.battleshipActive) {
      const bx = W * 0.5;
      const by = this.battleshipY;
      // White ocean bow foam wake
      ctx.strokeStyle = 'rgba(224, 242, 254, 0.65)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(bx, by + 115);
      ctx.lineTo(bx - 88, by - 90);
      ctx.moveTo(bx, by + 115);
      ctx.lineTo(bx + 88, by - 90);
      ctx.stroke();

      // Armored steel dreadnought hull
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(bx, by + 108);
      ctx.lineTo(bx + 68, by + 44);
      ctx.lineTo(bx + 64, by - 88);
      ctx.lineTo(bx, by - 112);
      ctx.lineTo(bx - 64, by - 88);
      ctx.lineTo(bx - 68, by + 44);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Wood teak deck planking & pagoda bridge tower
      ctx.fillStyle = '#78350F';
      ctx.fillRect(bx - 42, by - 72, 84, 144);
      ctx.fillStyle = '#475569';
      ctx.fillRect(bx - 22, by - 28, 44, 52);
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(bx - 12, by - 14, 24, 24);
    }

    // Pickups (Iconic Capcom POW / Weapon Badges!)
    for (const p of this.pickups) {
      ctx.fillStyle = p.kind === 'pow' ? '#EF4444' : '#FACC15';
      ctx.beginPath();
      ctx.roundRect(p.x - 20, p.y - 12, 40, 24, 5);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = p.kind === 'pow' ? '#FFFFFF' : '#0F172A';
      ctx.font = '900 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(p.kind === 'pow' ? 'POW' : p.label.slice(0, 4), p.x, p.y + 4);
    }

    // Authentic WWII Zero Fighters, Heavy Bombers & Rotating Battleship AA Turrets!
    for (const e of this.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);
      if (e.kind === 'battleshipTurret') {
        ctx.fillStyle = '#64748B';
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 2;
        ctx.stroke();
        const aim = Math.atan2(this.py - e.y, this.px - e.x);
        ctx.rotate(aim);
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(4, -5, 16, 3.5);
        ctx.fillRect(4, 1.5, 16, 3.5);
      } else if (e.maxHp > 2) {
        // Heavy Twin-Engine Ayako Bomber
        ctx.fillStyle = e.color;
        ctx.fillRect(-30, -5, 60, 10);
        ctx.fillRect(-6, -18, 12, 36);
        ctx.fillRect(-14, -18, 28, 5);
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(-18, 0, 4.5, 0, Math.PI * 2);
        ctx.arc(18, 0, 4.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // WWII Zero / Red Squadron Fighter with wing roundels!
        ctx.fillStyle = e.color;
        ctx.fillRect(-18, -3, 36, 6);
        ctx.fillRect(-3.5, -14, 7, 26);
        ctx.fillRect(-8, -14, 16, 3.5);
        ctx.fillStyle = '#DC2626';
        ctx.beginPath();
        ctx.arc(-10, 0, 3, 0, Math.PI * 2);
        ctx.arc(10, 0, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Shots
    for (const s of this.shots) {
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.isShotgun ? 5.8 : 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Iconic Twin-Boom P-38 Lightning (+ Wingmen!) with Drop Shadow & Spinning Props!
    const drawP38 = (x: number, y: number, scale: number) => {
      const loopScale = this.loopTimer > 0 ? 1 + Math.sin(this.loopTimer * Math.PI * 2) * 0.45 : 1;
      // Ocean aircraft shadow
      ctx.save();
      ctx.translate(x + 14 * loopScale, y + 18 * loopScale);
      ctx.scale(scale * 0.85, scale * 0.85);
      ctx.fillStyle = 'rgba(2, 6, 23, 0.35)';
      ctx.fillRect(-24, -4, 48, 8);
      ctx.fillRect(-13, -18, 6, 36);
      ctx.fillRect(7, -18, 6, 36);
      ctx.restore();

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale * loopScale, scale * loopScale);
      // Spinning twin propeller blurs
      const propW = Math.floor(this.clock * 30) % 2 === 0 ? 11 : 7;
      ctx.fillStyle = 'rgba(226, 232, 240, 0.7)';
      ctx.fillRect(-10 - propW * 0.5, -21, propW, 2.5);
      ctx.fillRect(10 - propW * 0.5, -21, propW, 2.5);
      // Twin-boom metallic silver P-38 airframe
      ctx.fillStyle = is1943 ? '#F1F5F9' : '#CBD5E1';
      ctx.fillRect(-26, -4, 52, 8);
      ctx.fillRect(-13, -18, 6, 36);
      ctx.fillRect(7, -18, 6, 36);
      ctx.fillRect(-13, 14, 26, 4);
      // Star wing insignia & cockpit canopy
      ctx.fillStyle = is1943 ? '#22C55E' : '#2563EB';
      ctx.fillRect(-22, -2, 6, 4);
      ctx.fillRect(16, -2, 6, 4);
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.roundRect(-4, -14, 8, 18, 3);
      ctx.fill();
      ctx.restore();
    };

    drawP38(this.px, this.py, 1);
    if (this.wingmen >= 1) drawP38(this.px - 36, this.py + 12, 0.65);
    if (this.wingmen >= 2) drawP38(this.px + 36, this.py + 12, 0.65);
  }
}

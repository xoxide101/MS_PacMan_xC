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

type BiomeId = 'asphalt' | 'snow' | 'forest' | 'river';
type GadgetId = 'oil' | 'smoke' | 'missiles';
type EnemyCarKind = 'civilian' | 'switchblade' | 'roadlord' | 'enforcer' | 'boat_torpedo' | 'boat_barrel';

interface RoadVehicle {
  id: number;
  kind: EnemyCarKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  color: string;
  spinTimer: number;
  shootCd: number;
  bladeOut: boolean;
}

interface WeaponsVan {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  boarding: boolean;
  boardTimer: number;
  gadgetOffer: GadgetId;
}

interface MadBomber {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  hp: number;
  bombCd: number;
  rotorPhase: number;
}

interface RoadHazard {
  kind: 'oil' | 'smoke' | 'crater' | 'barrel' | 'bomb_shadow';
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
}

interface SpyShot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fromPlayer: boolean;
  isMissile: boolean;
  life: number;
}

export class SpyHunterArcadeGame implements ArcadeGameInstance {
  public readonly logicalWidth = 840;
  public readonly logicalHeight = 640;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'MACHINE GUN';
  public readonly secondaryActionLabel = 'SPY GADGET';

  private readonly storageKey = 'retro_arcade_spyhunter_hd_hs_v2';

  private phase: ClassicGamePhase = 'TITLE';
  private input: ArcadeInputState = createEmptyInput();

  private score = 0;
  private highScore = 0;
  private sector = 1;
  private lives = 3;
  private nextExtraLife = 25000;

  // Player G-6155 Interceptor (transforms into Spy Boat on River!)
  private px = 420;
  private py = 470;
  private pvx = 0;
  private speed = 340;
  private isBoat = false;
  private invulnTimer = 0;
  private civilianPenaltyTimer = 0;
  private gunCd = 0;
  private gadgetCd = 0;

  // Authentic Gadget Inventory loaded from Red Weapons Van!
  private activeGadget: GadgetId = 'oil';
  private oilAmmo = 4;
  private smokeAmmo = 3;
  private missileAmmo = 2;

  // Road Curve & Biome State
  private distance = 0;
  private biome: BiomeId = 'asphalt';
  private biomeDist = 0;
  private boatHouseY = -200;
  private boatHousePending = false;
  private roadCenterX = 420;
  private roadHalfWidth = 175;
  private targetRoadCenter = 420;
  private curvePhase = 0;

  // Entities
  private vehicles: RoadVehicle[] = [];
  private hazards: RoadHazard[] = [];
  private shots: SpyShot[] = [];
  private van: WeaponsVan = {
    active: false,
    x: 420,
    y: -120,
    vy: 140,
    boarding: false,
    boardTimer: 0,
    gadgetOffer: 'oil',
  };
  private bomber: MadBomber = {
    active: false,
    x: -80,
    y: 120,
    vx: 110,
    hp: 3,
    bombCd: 1.5,
    rotorPhase: 0,
  };
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];
  private nextId = 1;
  private spawnCd = 0.8;
  private vanTimer = 14;
  private bomberTimer = 20;
  private screenShake = 0;
  private clock = 0;
  private readyTimer = 0;

  constructor() {
    this.highScore = readHighScore(this.storageKey);
  }

  public startNewGame(): void {
    arcadeAudio.unlock();
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.sector = 1;
    this.lives = 3;
    this.nextExtraLife = 25000;
    this.distance = 0;
    this.biome = 'asphalt';
    this.biomeDist = 0;
    this.isBoat = false;
    this.boatHousePending = false;
    this.boatHouseY = -260;
    this.oilAmmo = 4;
    this.smokeAmmo = 3;
    this.missileAmmo = 2;
    this.activeGadget = 'oil';
    this.resetPlayerPosition();
    this.vehicles = [];
    this.hazards = [];
    this.shots = [];
    this.particles = [];
    this.popups = [];
    this.van.active = false;
    this.bomber.active = false;
    this.vanTimer = 12;
    this.bomberTimer = 18;
    this.phase = 'READY';
    this.readyTimer = 1.05;
  }

  private resetPlayerPosition(): void {
    this.px = this.roadCenterX;
    this.py = 475;
    this.pvx = 0;
    this.speed = 320;
    this.invulnTimer = 2.0;
    this.civilianPenaltyTimer = 0;
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

  private getRoadCenterAtY(y: number): number {
    const worldY = this.distance + (this.logicalHeight - y);
    return 420 + Math.sin(worldY * 0.00145) * 115 + Math.cos(worldY * 0.00062) * 52;
  }

  private getRoadHalfWidthAtY(y: number): number {
    const worldY = this.distance + (this.logicalHeight - y);
    const narrow = this.biome === 'river' ? 190 : 162 + Math.sin(worldY * 0.0009) * 26;
    return narrow;
  }

  private addScore(pts: number, x?: number, y?: number, color = '#fde047', label?: string): void {
    if (this.civilianPenaltyTimer > 0 && pts < 500) return;
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(this.storageKey, this.highScore);
    }
    if (this.score >= this.nextExtraLife) {
      this.lives = Math.min(5, this.lives + 1);
      this.nextExtraLife += 30000;
      arcadeAudio.playExtraLife();
      this.popups.push({
        x: this.px,
        y: this.py - 32,
        text: '1UP! NEW G-6155!',
        color: '#4ade80',
        life: 1.3,
        maxLife: 1.3,
      });
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

  private destroyPlayer(reason: string): void {
    this.lives--;
    this.screenShake = 16;
    arcadeAudio.playExplosion(true);
    spawnBurst(this.particles, this.px, this.py, '#f97316', 32, 260, 4.4);
    spawnBurst(this.particles, this.px, this.py, '#fde047', 22, 190, 3.4);
    this.popups.push({
      x: this.px,
      y: this.py - 24,
      text: reason,
      color: '#f87171',
      life: 1.2,
      maxLife: 1.2,
    });
    if (this.lives <= 0) {
      this.phase = 'GAME_OVER';
    } else {
      this.roadCenterX = this.getRoadCenterAtY(475);
      this.resetPlayerPosition();
      this.vehicles = this.vehicles.filter((v) => Math.abs(v.y - this.py) > 160);
    }
  }

  private deployGadget(): void {
    if (this.gadgetCd > 0) return;
    // Automatically pick best available gadget (prioritize SAM Missiles when Mad Bomber is active!)
    if (this.bomber.active && this.missileAmmo > 0) {
      this.activeGadget = 'missiles';
    } else if (this.activeGadget === 'oil' && this.oilAmmo <= 0) {
      this.activeGadget = this.smokeAmmo > 0 ? 'smoke' : 'missiles';
    } else if (this.activeGadget === 'smoke' && this.smokeAmmo <= 0) {
      this.activeGadget = this.oilAmmo > 0 ? 'oil' : 'missiles';
    } else if (this.activeGadget === 'missiles' && this.missileAmmo <= 0) {
      this.activeGadget = this.oilAmmo > 0 ? 'oil' : 'smoke';
    }

    if (this.activeGadget === 'missiles' && this.missileAmmo > 0) {
      this.missileAmmo--;
      this.gadgetCd = 0.45;
      this.shots.push({
        x: this.px,
        y: this.py - 24,
        vx: 0,
        vy: -560,
        fromPlayer: true,
        isMissile: true,
        life: 1.6,
      });
      arcadeAudio.playXWingQuadLaser(true);
    } else if (this.activeGadget === 'oil' && this.oilAmmo > 0) {
      this.oilAmmo--;
      this.gadgetCd = 0.4;
      this.hazards.push({
        kind: 'oil',
        x: this.px,
        y: this.py + 30,
        radius: 26,
        life: 5,
        maxLife: 5,
      });
      arcadeAudio.playSplat();
    } else if (this.activeGadget === 'smoke' && this.smokeAmmo > 0) {
      this.smokeAmmo--;
      this.gadgetCd = 0.45;
      this.hazards.push({
        kind: 'smoke',
        x: this.px,
        y: this.py + 34,
        radius: 44,
        life: 4.5,
        maxLife: 4.5,
      });
      arcadeAudio.playSpray();
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
    if (this.civilianPenaltyTimer > 0) this.civilianPenaltyTimer -= dt;
    if (this.gunCd > 0) this.gunCd -= dt;
    if (this.gadgetCd > 0) this.gadgetCd -= dt;

    // Throttle & steering (icy snow adds authentic drift!)
    const accel = this.input.up ? 1 : this.input.down ? -1 : 0;
    const targetSpeed = accel > 0 ? 520 : accel < 0 ? 190 : 345;
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 4.2);

    const steerInput =
      Math.abs(this.input.analogX ?? 0) > 0.08
        ? this.input.analogX!
        : (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    const grip = this.biome === 'snow' ? 3.4 : this.biome === 'river' ? 5.2 : 11.5;
    const maxSteer = 310 * (this.input.moveScale ?? 0.9);
    this.pvx += (steerInput * maxSteer - this.pvx) * Math.min(1, dt * grip);
    this.px += this.pvx * dt;

    // Advance road distance & score
    const distStep = this.speed * dt;
    this.distance += distStep;
    this.biomeDist += distStep;
    this.curvePhase += dt;
    if (this.civilianPenaltyTimer <= 0 && Math.floor(this.distance / 32) > Math.floor((this.distance - distStep) / 32)) {
      this.addScore(15);
    }

    // Cycle Biomes (Asphalt -> Snow -> Forest -> River via BOAT HOUSE!)
    if (this.biomeDist > 5200 && !this.boatHousePending) {
      this.biomeDist = 0;
      const order: BiomeId[] = ['asphalt', 'snow', 'forest', 'river'];
      const nextBiome = order[(order.indexOf(this.biome) + 1) % order.length];
      if (nextBiome === 'river' || this.biome === 'river') {
        this.boatHousePending = true;
        this.boatHouseY = -90;
      } else {
        this.biome = nextBiome;
        this.sector++;
        this.popups.push({
          x: this.logicalWidth * 0.5,
          y: 160,
          text: `ENTERING ${nextBiome.toUpperCase()} HIGHWAY!`,
          color: '#38bdf8',
          life: 1.6,
          maxLife: 1.6,
        });
      }
    }

    // Animate BOAT HOUSE transformation archway!
    if (this.boatHousePending) {
      this.boatHouseY += this.speed * dt;
      if (this.boatHouseY >= this.py - 20 && this.boatHouseY <= this.py + 40) {
        this.boatHousePending = false;
        this.isBoat = !this.isBoat;
        this.biome = this.isBoat ? 'river' : 'asphalt';
        this.sector++;
        arcadeAudio.playSuperTransform();
        spawnBurst(this.particles, this.px, this.py, '#38bdf8', 26, 220, 3.8);
        this.popups.push({
          x: this.px,
          y: this.py - 36,
          text: this.isBoat ? 'SPY BOAT ENGAGED!' : 'G-6155 ROAD MODE!',
          color: '#38bdf8',
          life: 1.6,
          maxLife: 1.6,
        });
      }
    }

    // Keep within road / river banks (off-road crash check!)
    this.roadCenterX = this.getRoadCenterAtY(this.py);
    this.roadHalfWidth = this.getRoadHalfWidthAtY(this.py);
    const roadLeft = this.roadCenterX - this.roadHalfWidth;
    const roadRight = this.roadCenterX + this.roadHalfWidth;
    if (this.invulnTimer <= 0 && (this.px < roadLeft - 14 || this.px > roadRight + 14)) {
      this.destroyPlayer(this.isBoat ? 'RAN AGROUND!' : 'OFF-ROAD CRASH!');
      return;
    }

    // Weapons Firing!
    if (this.input.fire && this.gunCd <= 0) {
      this.gunCd = 0.115;
      this.shots.push({
        x: this.px - 9,
        y: this.py - 24,
        vx: 0,
        vy: -760,
        fromPlayer: true,
        isMissile: false,
        life: 0.9,
      });
      this.shots.push({
        x: this.px + 9,
        y: this.py - 24,
        vx: 0,
        vy: -760,
        fromPlayer: true,
        isMissile: false,
        life: 0.9,
      });
      arcadeAudio.playLaser(940, 360, 0.05);
    }
    if (this.input.secondaryJustPressed) {
      this.deployGadget();
    }

    // Periodic Red Weapons Van drop-in!
    this.vanTimer -= dt;
    if (!this.van.active && this.vanTimer <= 0 && !this.isBoat) {
      const gadgets: GadgetId[] = ['oil', 'smoke', 'missiles'];
      this.van = {
        active: true,
        x: this.getRoadCenterAtY(120),
        y: -110,
        vy: 145,
        boarding: false,
        boardTimer: 0,
        gadgetOffer: gadgets[Math.floor(Math.random() * gadgets.length)],
      };
      this.vanTimer = 24;
      arcadeAudio.playSirenSweep();
    }
    if (this.van.active) {
      const vc = this.getRoadCenterAtY(this.van.y);
      this.van.x += (vc - this.van.x) * Math.min(1, dt * 4);
      if (this.van.boarding) {
        this.van.boardTimer -= dt;
        this.px = this.van.x;
        this.py = this.van.y + 44;
        this.invulnTimer = 0.6;
        if (this.van.boardTimer <= 0) {
          this.van.boarding = false;
          this.van.vy = -240;
          if (this.van.gadgetOffer === 'oil') this.oilAmmo += 4;
          else if (this.van.gadgetOffer === 'smoke') this.smokeAmmo += 4;
          else this.missileAmmo += 4;
          this.activeGadget = this.van.gadgetOffer;
          arcadeAudio.playPowerUp();
          this.popups.push({
            x: this.px,
            y: this.py - 40,
            text: `LOADED ${this.van.gadgetOffer.toUpperCase()} +4!`,
            color: '#4ade80',
            life: 1.4,
            maxLife: 1.4,
          });
        }
      } else {
        this.van.y += (this.van.y < 180 ? 115 : this.van.vy) * dt;
        if (Math.abs(this.px - this.van.x) < 28 && this.py > this.van.y + 20 && this.py < this.van.y + 84 && this.van.vy > 0) {
          this.van.boarding = true;
          this.van.boardTimer = 0.9;
          arcadeAudio.playKeyUnlock();
        }
        if (this.van.y > this.logicalHeight + 140 || this.van.y < -180) {
          this.van.active = false;
        }
      }
    }

    // Mad Bomber Helicopter Overhead!
    this.bomberTimer -= dt;
    if (!this.bomber.active && this.bomberTimer <= 0) {
      this.bomber = {
        active: true,
        x: -70,
        y: 120,
        vx: 120,
        hp: 3,
        bombCd: 1.35,
        rotorPhase: 0,
      };
      this.bomberTimer = 26;
      arcadeAudio.playSirenSweep();
    }
    if (this.bomber.active) {
      this.bomber.rotorPhase += dt * 32;
      this.bomber.x += (this.px - this.bomber.x) * Math.min(1, dt * 1.4);
      this.bomber.y = 135 + Math.sin(this.clock * 2.1) * 38;
      this.bomber.bombCd -= dt;
      if (this.bomber.bombCd <= 0) {
        this.bomber.bombCd = 1.6;
        this.hazards.push({
          kind: 'bomb_shadow',
          x: this.bomber.x,
          y: this.bomber.y + 50,
          radius: 24,
          life: 0.9,
          maxLife: 0.9,
        });
      }
    }

    // Spawn authentic road/river vehicles
    this.spawnCd -= dt;
    if (this.spawnCd <= 0 && this.vehicles.length < 7) {
      this.spawnCd = Math.max(0.65, 1.45 - this.sector * 0.08);
      const sy = -50;
      const rc = this.getRoadCenterAtY(sy);
      const rhw = this.getRoadHalfWidthAtY(sy);
      const sx = rc + (Math.random() - 0.5) * (rhw * 1.35);

      let kind: EnemyCarKind = 'switchblade';
      let hp = 2;
      let color = '#2563eb';
      const roll = Math.random();
      if (this.isBoat) {
        kind = roll < 0.5 ? 'boat_torpedo' : 'boat_barrel';
        hp = 2;
        color = kind === 'boat_torpedo' ? '#ef4444' : '#f59e0b';
      } else if (roll < 0.28) {
        kind = 'civilian';
        hp = 1;
        color = Math.random() < 0.5 ? '#ef4444' : '#facc15';
      } else if (roll < 0.58) {
        kind = 'switchblade';
        hp = 2;
        color = '#38bdf8';
      } else if (roll < 0.8) {
        kind = 'roadlord';
        hp = 99; // Bulletproof! Must ram or spin out!
        color = '#94a3b8';
      } else {
        kind = 'enforcer';
        hp = 4;
        color = '#1e293b';
      }

      this.vehicles.push({
        id: this.nextId++,
        kind,
        x: sx,
        y: sy,
        vx: 0,
        vy: kind === 'civilian' ? 140 : 105 + Math.random() * 55,
        hp,
        color,
        spinTimer: 0,
        shootCd: 1.5,
        bladeOut: kind === 'switchblade',
      });
    }

    // Update Vehicles
    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i];
      const rc = this.getRoadCenterAtY(v.y);
      const rhw = this.getRoadHalfWidthAtY(v.y);

      if (v.spinTimer > 0) {
        v.spinTimer -= dt;
        v.x += v.vx * dt;
        v.y += (this.speed * 0.65) * dt;
        if (v.x < rc - rhw - 12 || v.x > rc + rhw + 12) {
          this.addScore(v.kind === 'roadlord' ? 500 : 300, v.x, v.y, '#fbbf24', 'SPINOUT!');
          arcadeAudio.playExplosion(false);
          spawnBurst(this.particles, v.x, v.y, '#f97316', 18, 200, 3.4);
          this.vehicles.splice(i, 1);
          continue;
        }
      } else {
        // Road-following & hostile ramming AI
        const relY = this.speed - (v.kind === 'civilian' ? 190 : 210);
        v.y += relY * dt;
        if (v.kind === 'switchblade' || v.kind === 'roadlord') {
          if (Math.abs(v.y - this.py) < 150) {
            const dx = this.px - v.x;
            v.x += Math.sign(dx) * Math.min(Math.abs(dx), 130 * dt);
          } else {
            v.x += (rc - v.x) * dt * 1.4;
          }
        } else {
          v.x += (rc - v.x) * dt * 1.2;
        }

        // Enforcer / Boat Torpedo shoots!
        if (v.kind === 'enforcer' || v.kind === 'boat_torpedo' || v.kind === 'boat_barrel') {
          v.shootCd -= dt;
          if (v.shootCd <= 0 && v.y > 40 && v.y < this.py - 20) {
            v.shootCd = 1.8;
            if (v.kind === 'boat_barrel') {
              this.hazards.push({
                kind: 'barrel',
                x: v.x,
                y: v.y + 24,
                radius: 16,
                life: 5,
                maxLife: 5,
              });
            } else {
              const ang = Math.atan2(this.py - v.y, this.px - v.x);
              this.shots.push({
                x: v.x,
                y: v.y + 12,
                vx: Math.cos(ang) * 290,
                vy: Math.sin(ang) * 290,
                fromPlayer: false,
                isMissile: false,
                life: 2.2,
              });
            }
          }
        }
      }

      // Check Oil / Smoke spinout hazards!
      for (const h of this.hazards) {
        if ((h.kind === 'oil' || h.kind === 'smoke') && Math.hypot(v.x - h.x, v.y - h.y) < h.radius + 16) {
          v.spinTimer = 1.3;
          v.vx = (v.x < rc ? -1 : 1) * 240;
          arcadeAudio.playScreech();
        }
      }

      // Check collision with Player Interceptor
      if (Math.abs(v.x - this.px) < 28 && Math.abs(v.y - this.py) < 38) {
        if (v.kind === 'switchblade' && v.bladeOut && this.invulnTimer <= 0) {
          this.destroyPlayer('TIRE SLASHED BY SWITCH BLADE!');
          return;
        } else {
          // Side-ramming shove! (classic Spy Hunter tactic to slam Road Lords off the road!)
          const dir = v.x >= this.px ? 1 : -1;
          v.vx = dir * 290;
          v.spinTimer = 0.65;
          this.pvx = -dir * 165;
          arcadeAudio.playLanceClash();
          spawnBurst(this.particles, (v.x + this.px) * 0.5, (v.y + this.py) * 0.5, '#fde047', 10, 140, 2.5);
        }
      }

      if (v.y > this.logicalHeight + 90 || v.y < -180) {
        this.vehicles.splice(i, 1);
      }
    }

    // Update Hazards
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.life -= dt;
      if (h.kind !== 'bomb_shadow') {
        h.y += this.speed * dt;
      } else if (h.life <= 0) {
        // Bomb impacts road -> turns into crater!
        arcadeAudio.playExplosion(false);
        spawnBurst(this.particles, h.x, h.y, '#f97316', 18, 200, 3.6);
        this.hazards.push({
          kind: 'crater',
          x: h.x,
          y: h.y,
          radius: 22,
          life: 4.5,
          maxLife: 4.5,
        });
        if (this.invulnTimer <= 0 && Math.hypot(h.x - this.px, h.y - this.py) < 34) {
          this.destroyPlayer('MAD BOMBER DIRECT HIT!');
          return;
        }
        this.hazards.splice(i, 1);
        continue;
      }
      if ((h.kind === 'crater' || h.kind === 'barrel') && this.invulnTimer <= 0 && Math.hypot(h.x - this.px, h.y - this.py) < h.radius + 14) {
        this.destroyPlayer(h.kind === 'barrel' ? 'HIT FLOATING BARREL!' : 'BOMB CRATER CRASH!');
        return;
      }
      if (h.life <= 0 || h.y > this.logicalHeight + 60) this.hazards.splice(i, 1);
    }

    // Update Shots & SAM Missiles
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      if (s.isMissile && this.bomber.active) {
        const dx = this.bomber.x - s.x;
        const dy = this.bomber.y - s.y;
        const d = Math.max(1, Math.hypot(dx, dy));
        s.vx += ((dx / d) * 620 - s.vx) * dt * 6;
        s.vy += ((dy / d) * 620 - s.vy) * dt * 6;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;

      if (s.fromPlayer) {
        // SAM Missile hitting Mad Bomber Chopper!
        if (s.isMissile && this.bomber.active && Math.hypot(s.x - this.bomber.x, s.y - this.bomber.y) < 34) {
          this.bomber.hp -= 2;
          this.shots.splice(i, 1);
          if (this.bomber.hp <= 0) {
            this.bomber.active = false;
            this.addScore(1500, this.bomber.x, this.bomber.y, '#fde047', 'MAD BOMBER +1500!');
            arcadeAudio.playExplosion(true);
            spawnBurst(this.particles, this.bomber.x, this.bomber.y, '#f97316', 32, 260, 4.4);
          }
          continue;
        }
        // Hit road vehicles
        let hit = false;
        for (let vi = this.vehicles.length - 1; vi >= 0; vi--) {
          const v = this.vehicles[vi];
          if (Math.abs(v.x - s.x) < 22 && Math.abs(v.y - s.y) < 28) {
            if (v.kind === 'roadlord' && !s.isMissile) {
              // Bulletproof ricochet spark!
              spawnBurst(this.particles, s.x, s.y, '#e2e8f0', 4, 120, 2);
              arcadeAudio.playLanceClash();
            } else {
              v.hp -= s.isMissile ? 5 : 1;
              if (v.hp <= 0) {
                if (v.kind === 'civilian') {
                  this.civilianPenaltyTimer = 4.0;
                  this.popups.push({
                    x: v.x,
                    y: v.y,
                    text: 'CIVILIAN! NO POINTS!',
                    color: '#f87171',
                    life: 1.2,
                    maxLife: 1.2,
                  });
                } else {
                  this.addScore(v.kind === 'enforcer' ? 500 : 300, v.x, v.y, '#fde047');
                }
                arcadeAudio.playExplosion(false);
                spawnBurst(this.particles, v.x, v.y, '#f97316', 18, 210, 3.4);
                this.vehicles.splice(vi, 1);
              }
            }
            hit = true;
            break;
          }
        }
        if (hit) {
          this.shots.splice(i, 1);
          continue;
        }
      } else {
        if (this.invulnTimer <= 0 && Math.hypot(s.x - this.px, s.y - this.py) < 18) {
          this.shots.splice(i, 1);
          this.destroyPlayer('SHOT BY ENFORCER!');
          return;
        }
      }
      if (s.life <= 0 || s.y < -40 || s.y > this.logicalHeight + 40) this.shots.splice(i, 1);
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

    // 1. Biome Terrain Backdrop (Grass / Alpine Snow / Autumn Forest / River Bank)
    const bankColor =
      this.biome === 'snow'
        ? '#cbd5e1'
        : this.biome === 'forest'
          ? '#1e3a1e'
          : this.biome === 'river'
            ? '#166534'
            : '#14532d';
    ctx.fillStyle = bankColor;
    ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);

    // 2. Winding Top-Down Highway or River!
    const step = 16;
    ctx.beginPath();
    for (let y = 0; y <= this.logicalHeight + step; y += step) {
      const c = this.getRoadCenterAtY(y);
      const hw = this.getRoadHalfWidthAtY(y);
      if (y === 0) ctx.moveTo(c - hw, y);
      else ctx.lineTo(c - hw, y);
    }
    for (let y = this.logicalHeight + step; y >= 0; y -= step) {
      const c = this.getRoadCenterAtY(y);
      const hw = this.getRoadHalfWidthAtY(y);
      ctx.lineTo(c + hw, y);
    }
    ctx.closePath();
    ctx.fillStyle =
      this.biome === 'river'
        ? '#0369a1'
        : this.biome === 'snow'
          ? '#64748b'
          : '#1e293b';
    ctx.fill();
    ctx.strokeStyle = this.biome === 'river' ? '#bae6fd' : '#facc15';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Dashed Center Lane Markings OR Shimmering River Wake Lines
    ctx.strokeStyle = this.biome === 'river' ? 'rgba(186, 230, 253, 0.35)' : '#fde047';
    ctx.lineWidth = 3;
    const dashOffset = this.distance % 56;
    for (let y = -56 + dashOffset; y < this.logicalHeight + 40; y += 56) {
      const c = this.getRoadCenterAtY(y);
      ctx.beginPath();
      ctx.moveTo(c, y);
      ctx.lineTo(c, y + 26);
      ctx.stroke();
    }

    // 3. BOAT HOUSE Transition Archway!
    if (this.boatHousePending) {
      const rc = this.getRoadCenterAtY(this.boatHouseY);
      ctx.fillStyle = '#991b1b';
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 3;
      ctx.fillRect(rc - 120, this.boatHouseY - 24, 240, 48);
      ctx.strokeRect(rc - 120, this.boatHouseY - 24, 240, 48);
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 18px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('BOAT HOUSE · TRANSFORM', rc, this.boatHouseY + 6);
    }

    // 4. Hazards (Oil Slick, Smoke Screen, Craters, Bomb Shadows, Barrels)
    for (const h of this.hazards) {
      ctx.save();
      if (h.kind === 'oil') {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.beginPath();
        ctx.ellipse(h.x, h.y, h.radius * 1.15, h.radius * 0.75, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (h.kind === 'smoke') {
        ctx.fillStyle = `rgba(226, 232, 240, ${0.65 * (h.life / h.maxLife)})`;
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
        ctx.fill();
      } else if (h.kind === 'crater') {
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (h.kind === 'bomb_shadow') {
        const s = 1 - h.life / h.maxLife;
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(h.x, h.y, 10 + s * 20, 0, Math.PI * 2);
        ctx.stroke();
      } else if (h.kind === 'barrel') {
        ctx.fillStyle = '#b45309';
        ctx.fillRect(h.x - 10, h.y - 12, 20, 24);
        ctx.strokeStyle = '#fde047';
        ctx.strokeRect(h.x - 10, h.y - 12, 20, 24);
      }
      ctx.restore();
    }

    // 5. Red Weapons Van!
    if (this.van.active) {
      ctx.save();
      ctx.translate(this.van.x, this.van.y);
      ctx.fillStyle = '#dc2626';
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(-24, -44, 48, 88, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f8fafc';
      ctx.font = '900 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('WEAPONS', 0, -8);
      ctx.fillText(this.van.gadgetOffer.toUpperCase(), 0, 8);
      // Lowered rear boarding ramp
      ctx.fillStyle = '#64748b';
      ctx.fillRect(-16, 44, 32, 16);
      ctx.restore();
    }

    // 6. Enemy & Civilian Vehicles
    for (const v of this.vehicles) {
      ctx.save();
      ctx.translate(v.x, v.y);
      if (v.spinTimer > 0) ctx.rotate(this.clock * 14);
      ctx.fillStyle = v.color;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-14, -24, 28, 48, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-10, -12, 20, 14);
      // Switch Blade lethal tire-slashers!
      if (v.kind === 'switchblade') {
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(-20, -14, 6, 4);
        ctx.fillRect(14, -14, 6, 4);
        ctx.fillRect(-20, 10, 6, 4);
        ctx.fillRect(14, 10, 6, 4);
      }
      ctx.restore();
    }

    // 7. Player G-6155 White Interceptor / Spy Hydrofoil Boat!
    if (this.invulnTimer <= 0 || Math.floor(this.clock * 18) % 2 === 0) {
      ctx.save();
      ctx.translate(this.px, this.py);
      ctx.rotate(this.pvx * 0.0005);
      if (this.isBoat) {
        // Sleek white-and-cyan Spy Hydrofoil Boat!
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, -30);
        ctx.lineTo(16, 8);
        ctx.lineTo(12, 26);
        ctx.lineTo(-12, 26);
        ctx.lineTo(-16, 8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(-7, -8, 14, 14);
      } else {
        // Iconic 1983 White G-6155 Interceptor!
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-15, -26, 30, 52, 7);
        ctx.fill();
        ctx.stroke();
        // Sleek dark windshield & twin hood vents
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-10, -11, 20, 14);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-12, 22, 8, 4);
        ctx.fillRect(4, 22, 8, 4);
      }
      ctx.restore();
    }

    // 8. Shots & SAM Missiles
    for (const s of this.shots) {
      ctx.fillStyle = s.isMissile ? '#f43f5e' : s.fromPlayer ? '#fde047' : '#fb923c';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.isMissile ? 5.5 : 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // 9. Mad Bomber Helicopter Overhead!
    if (this.bomber.active) {
      ctx.save();
      ctx.translate(this.bomber.x, this.bomber.y);
      ctx.fillStyle = '#475569';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 26, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillRect(-38, -4, 18, 8);
      // Spinning main rotor blades
      ctx.rotate(this.bomber.rotorPhase);
      ctx.strokeStyle = 'rgba(248, 250, 252, 0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-42, 0);
      ctx.lineTo(42, 0);
      ctx.moveTo(0, -42);
      ctx.lineTo(0, 42);
      ctx.stroke();
      ctx.restore();
    }

    renderParticlesAndPopups(ctx, this.particles, this.popups);

    // Bottom Spy Gadget Dashboard
    ctx.fillStyle = 'rgba(4, 8, 20, 0.9)';
    ctx.fillRect(0, this.logicalHeight - 36, this.logicalWidth, 36);
    ctx.font = '800 12px "JetBrains Mono", monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fde047';
    ctx.fillText(
      `OIL: ${this.oilAmmo}   ·   SMOKE: ${this.smokeAmmo}   ·   SAM MISSILES: ${this.missileAmmo}   ·   [SHIFT/X] DEPLOY ${this.activeGadget.toUpperCase()}`,
      this.logicalWidth * 0.5,
      this.logicalHeight - 18
    );

    if (this.phase === 'TITLE') {
      this.renderTitleOverlay(ctx);
    } else if (this.phase === 'READY') {
      this.renderCenterBanner(ctx, 'G-6155 INTERCEPTOR DEPLOYED', 'RAM ROAD LORDS · BOARD THE RED WEAPONS VAN · WATCH FOR BOAT HOUSE!', '#38bdf8');
    } else if (this.phase === 'GAME_OVER') {
      this.renderCenterBanner(ctx, 'MISSION TERMINATED', `SCORE ${this.score.toLocaleString()} · PRESS SPACE TO INTERCEPT AGAIN`, '#f87171');
    } else if (this.phase === 'PAUSED') {
      this.renderCenterBanner(ctx, 'PAUSED', 'PRESS P TO RESUME PURSUIT', '#38bdf8');
    }

    if (visualMode === 'crt') renderCrtOverlay(ctx, this.logicalWidth, this.logicalHeight);
    ctx.restore();
  }

  private renderTitleOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(4, 8, 20, 0.78)';
    ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
    const cx = this.logicalWidth * 0.5;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f8fafc';
    ctx.font = '900 46px "JetBrains Mono", monospace';
    ctx.fillText('SPY HUNTER', cx, 198);
    ctx.fillStyle = '#38bdf8';
    ctx.font = '800 15px "JetBrains Mono", monospace';
    ctx.fillText('1983 BALLY MIDWAY · G-6155 INTERCEPTOR & SPY BOAT EDITION', cx, 240);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 14px "JetBrains Mono", monospace';
    ctx.fillText('LEFT/RIGHT STEER · UP/DOWN THROTTLE · SPACE MACHINE GUNS · SHIFT/X GADGET', cx, 308);
    ctx.fillText('PULL INTO THE RED WEAPONS VAN FOR OIL SLICK, SMOKE & SAM MISSILES!', cx, 338);
    ctx.fillText('ENTER THE BOAT HOUSE TO TRANSFORM INTO THE HYDROFOIL SPY BOAT!', cx, 368);
    const pulse = 0.65 + 0.35 * Math.sin(this.clock * 6);
    ctx.fillStyle = `rgba(253, 224, 71, ${pulse})`;
    ctx.font = '900 20px "JetBrains Mono", monospace';
    ctx.fillText('PRESS SPACE TO START ENGINE', cx, 456);
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
      level: this.sector,
      lives: this.lives,
      stageName: this.isBoat ? 'RIVER PURSUIT' : `${this.biome.toUpperCase()} HIGHWAY`,
      primaryMetricLabel: 'SPEED',
      primaryMetricValue: `${Math.round(this.speed * 0.42)} MPH`,
      secondaryMetricLabel: 'GADGET',
      secondaryMetricValue: `${this.activeGadget.toUpperCase()}`,
      bannerText: this.bomber.active
        ? 'WARNING: MAD BOMBER OVERHEAD — FIRE SAM MISSILES!'
        : this.van.active
          ? 'RED WEAPONS VAN AHEAD — PULL BEHIND RAMP!'
          : `${this.biome.toUpperCase()} SECTOR ${this.sector}`,
    };
  }
}

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

const WIDTH = 864;
const HEIGHT = 640;

type SprintVariant = 'sprint' | 'supersprint' | 'champsprint';

interface Waypoint {
  x: number;
  y: number;
}

interface CircuitDef {
  name: string;
  roadWidth: number;
  bgColor: string;
  roadColor: string;
  wallColor: string;
  waypoints: Waypoint[];
  shortcutFrom?: number;
  shortcutTo?: number;
}

const CIRCUITS: CircuitDef[] = [
  {
    name: 'Speedway Oval',
    roadWidth: 108,
    bgColor: '#14532D',
    roadColor: '#334155',
    wallColor: '#F8FAFC',
    waypoints: [
      { x: 220, y: 145 },
      { x: 644, y: 145 },
      { x: 745, y: 260 },
      { x: 735, y: 455 },
      { x: 610, y: 520 },
      { x: 245, y: 520 },
      { x: 120, y: 445 },
      { x: 125, y: 245 },
    ],
  },
  {
    name: 'Hairpin Chicane',
    roadWidth: 98,
    bgColor: '#1E3A5F',
    roadColor: '#334155',
    wallColor: '#FACC15',
    waypoints: [
      { x: 180, y: 135 },
      { x: 690, y: 135 },
      { x: 745, y: 260 },
      { x: 540, y: 325 },
      { x: 720, y: 465 },
      { x: 580, y: 535 },
      { x: 170, y: 525 },
      { x: 120, y: 365 },
      { x: 295, y: 295 },
      { x: 125, y: 225 },
    ],
  },
  {
    name: 'Grand Switchback',
    roadWidth: 94,
    bgColor: '#451A03',
    roadColor: '#3F3F46',
    wallColor: '#FB923C',
    waypoints: [
      { x: 165, y: 135 },
      { x: 430, y: 130 },
      { x: 470, y: 265 },
      { x: 685, y: 165 },
      { x: 750, y: 335 },
      { x: 680, y: 525 },
      { x: 425, y: 430 },
      { x: 215, y: 530 },
      { x: 115, y: 360 },
    ],
  },
];

interface RacerCar {
  isPlayer: boolean;
  name: string;
  color: string;
  x: number;
  y: number;
  angle: number;
  speed: number;
  spinTimer: number;
  lap: number;
  nextWp: number;
  progress: number;
  aiSpeedBias: number;
}

interface Hazard {
  kind: 'oil' | 'water' | 'tornado';
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

export class SprintGame implements ArcadeGameInstance {
  public readonly logicalWidth = WIDTH;
  public readonly logicalHeight = HEIGHT;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'Gas';

  private readonly variant: SprintVariant;
  private readonly storageKey: string;

  private phase: ClassicGamePhase = 'TITLE';
  private score = 0;
  private highScore = 0;
  private level = 1;
  private wrenches = 0;
  private upgradeTier = 0;
  private phaseTimer = 0;
  private time = 0;
  private bannerText = '';

  private input: ArcadeInputState = createEmptyInput();
  private cars: RacerCar[] = [];
  private hazards: Hazard[] = [];
  private wrenchPickup: { active: boolean; x: number; y: number } = { active: false, x: 0, y: 0 };
  private shortcutOpen = false;
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  constructor(variant: SprintVariant) {
    this.variant = variant;
    this.storageKey =
      variant === 'sprint'
        ? 'sprint_hd_highscore_v1'
        : variant === 'supersprint'
          ? 'supersprint_hd_highscore_v1'
          : 'champsprint_hd_highscore_v1';
    this.highScore = readHighScore(this.storageKey);
    this.setupTrack(1);
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public startNewGame(): void {
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.level = 1;
    this.wrenches = 0;
    this.upgradeTier = 0;
    this.particles = [];
    this.popups = [];
    this.setupTrack(1);
    this.phase = 'READY';
    this.phaseTimer = 1.1;
    this.bannerText = `RACE 1 · ${this.getCircuit().name.toUpperCase()}`;
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.level = 1;
    this.setupTrack(1);
  }

  private getCircuit(): CircuitDef {
    return CIRCUITS[(this.level - 1) % CIRCUITS.length];
  }

  public getHudSnapshot(): ClassicGameHud {
    const player = this.cars[0];
    const sorted = [...this.cars].sort((a, b) => b.progress - a.progress);
    const place = sorted.findIndex((c) => c.isPlayer) + 1;
    const placeLabel = place === 1 ? '1st' : place === 2 ? '2nd' : place === 3 ? '3rd' : '4th';
    return {
      phase: this.phase,
      score: Math.floor(this.score),
      highScore: this.highScore,
      level: this.level,
      lives: Math.max(1, 4 - (player?.lap ?? 1)),
      stageName: `${this.getCircuit().name} · Lap ${Math.min(3, player?.lap ?? 1)}/3`,
      primaryMetricLabel: 'Position',
      primaryMetricValue: `${placeLabel} of 4`,
      secondaryMetricLabel: this.variant === 'sprint' ? 'Circuit' : 'Wrenches / Tier',
      secondaryMetricValue:
        this.variant === 'sprint'
          ? `Track ${this.level}`
          : `${this.wrenches}W · Lv ${this.upgradeTier + 1}`,
      bannerText: this.bannerText,
    };
  }

  private addScore(pts: number, x?: number, y?: number, color = '#FACC15'): void {
    if (this.phase === 'TITLE') return;
    this.score += pts;
    if (Math.floor(this.score) > this.highScore) {
      this.highScore = Math.floor(this.score);
      saveHighScore(this.storageKey, this.highScore);
    }
    if (x !== undefined && y !== undefined && pts >= 100) {
      this.popups.push({ x, y, text: `+${pts}`, color, life: 0.9, maxLife: 0.9 });
    }
  }

  private setupTrack(raceNum: number): void {
    this.level = raceNum;
    const circuit = this.getCircuit();
    const wp0 = circuit.waypoints[0];
    const wp1 = circuit.waypoints[1];
    const startAngle = Math.atan2(wp1.y - wp0.y, wp1.x - wp0.x);

    const colors =
      this.variant === 'sprint'
        ? ['#FFFFFF', '#94A3B8', '#CBD5E1', '#64748B']
        : ['#EF4444', '#38BDF8', '#FACC15', '#22C55E'];

    this.cars = [0, 1, 2, 3].map((idx) => ({
      isPlayer: idx === 0,
      name: idx === 0 ? 'Player' : `Rival ${idx}`,
      color: colors[idx],
      x: wp0.x + (idx % 2 === 0 ? -12 : 12),
      y: wp0.y + (idx - 1.5) * 20,
      angle: startAngle,
      speed: 0,
      spinTimer: 0,
      lap: 1,
      nextWp: 1,
      progress: 0,
      aiSpeedBias: 0.86 + idx * 0.055 + Math.min(0.18, (raceNum - 1) * 0.03),
    }));

    // Track hazards
    this.hazards = [];
    const wps = circuit.waypoints;
    this.hazards.push({
      kind: 'oil',
      x: (wps[2].x + wps[3].x) * 0.5,
      y: (wps[2].y + wps[3].y) * 0.5,
      vx: 0,
      vy: 0,
      radius: 19,
    });
    if (this.variant === 'champsprint') {
      this.hazards.push({
        kind: 'water',
        x: (wps[4].x + wps[5].x) * 0.5,
        y: (wps[4].y + wps[5].y) * 0.5,
        vx: 0,
        vy: 0,
        radius: 22,
      });
    }
    if (this.variant === 'supersprint') {
      this.hazards.push({
        kind: 'tornado',
        x: WIDTH * 0.5,
        y: HEIGHT * 0.5,
        vx: 78,
        vy: 56,
        radius: 20,
      });
    }

    // Golden wrench pickup for Super Sprint & Championship Sprint
    if (this.variant !== 'sprint') {
      const targetWp = wps[Math.floor(wps.length * 0.6)];
      this.wrenchPickup = { active: true, x: targetWp.x, y: targetWp.y };
    } else {
      this.wrenchPickup.active = false;
    }
  }

  private distToRoadCenter(x: number, y: number, wps: Waypoint[]): number {
    let minD = Infinity;
    for (let i = 0; i < wps.length; i++) {
      const a = wps[i];
      const b = wps[(i + 1) % wps.length];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const lenSq = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / lenSq));
      const px = a.x + t * dx;
      const py = a.y + t * dy;
      const d = Math.hypot(x - px, y - py);
      if (d < minD) minD = d;
    }
    return minD;
  }

  public step(dt: number): void {
    this.time += dt;
    stepParticlesAndPopups(this.particles, this.popups, dt);

    if (this.phase === 'PAUSED' || this.phase === 'GAME_OVER') return;

    if (this.phase === 'READY') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.phase = 'PLAYING';
        this.bannerText = '';
      }
      return;
    }

    if (this.phase === 'STAGE_CLEAR') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.level += 1;
        this.setupTrack(this.level);
        this.phase = 'READY';
        this.phaseTimer = 1.1;
        this.bannerText = `RACE ${this.level} · ${this.getCircuit().name.toUpperCase()}`;
      }
      return;
    }

    const isAttract = this.phase === 'TITLE';
    const circuit = this.getCircuit();
    const wps = circuit.waypoints;
    this.shortcutOpen = this.variant === 'champsprint' && Math.floor(this.time / 4.5) % 2 === 0;

    // Move tornado hazard
    for (const h of this.hazards) {
      if (h.kind === 'tornado') {
        h.x += h.vx * dt;
        h.y += h.vy * dt;
        if (h.x < 120 || h.x > WIDTH - 120) h.vx = -h.vx;
        if (h.y < 110 || h.y > HEIGHT - 110) h.vy = -h.vy;
      }
    }

    for (const car of this.cars) {
      if (car.spinTimer > 0) {
        car.spinTimer -= dt;
        car.angle += 10 * dt;
        car.speed *= 1 - Math.min(0.9, dt * 3.5);
        continue;
      }

      const maxSpd = car.isPlayer
        ? 248 + this.upgradeTier * 22
        : 226 * car.aiSpeedBias;
      const turnSpd = car.isPlayer ? 3.55 + this.upgradeTier * 0.25 : 3.9;

      if (car.isPlayer && !isAttract) {
        const steer = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
        car.angle += steer * turnSpd * dt;
        if (this.input.up || this.input.fire) {
          car.speed = Math.min(maxSpd, car.speed + (225 + this.upgradeTier * 20) * dt);
        } else if (this.input.down) {
          car.speed = Math.max(-60, car.speed - 280 * dt);
        } else {
          car.speed *= 1 - Math.min(0.9, dt * 1.4);
        }
      } else {
        // AI steers cleanly toward next waypoint
        const wp = wps[car.nextWp];
        const desired = Math.atan2(wp.y - car.y, wp.x - car.x);
        let diff = desired - car.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        car.angle += Math.sign(diff) * Math.min(Math.abs(diff), turnSpd * dt);
        const cornerSlow = Math.abs(diff) > 0.7 ? 0.72 : 1;
        car.speed = Math.min(maxSpd * cornerSlow, car.speed + 220 * dt);
      }

      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const distRoad = this.distToRoadCenter(nx, ny, wps);

      // Championship Sprint center shortcut bridge when gate is open
      const inShortcut =
        this.shortcutOpen &&
        Math.abs(nx - WIDTH * 0.5) < 38 &&
        ny > 140 &&
        ny < 520;

      if (distRoad <= circuit.roadWidth * 0.56 || inShortcut) {
        car.x = nx;
        car.y = ny;
      } else {
        // Bounce smoothly off track barrier
        car.speed *= 0.45;
        if (car.isPlayer && !isAttract) arcadeAudio.playScreech();
      }

      // Hazard checks
      for (const h of this.hazards) {
        if (Math.hypot(car.x - h.x, car.y - h.y) < h.radius + 10) {
          car.spinTimer = h.kind === 'water' ? 0.35 : 0.65;
          if (car.isPlayer && !isAttract) arcadeAudio.playScreech();
        }
      }

      // Wrench pickup
      if (car.isPlayer && this.wrenchPickup.active && Math.hypot(car.x - this.wrenchPickup.x, car.y - this.wrenchPickup.y) < 26) {
        this.wrenchPickup.active = false;
        this.wrenches += 1;
        if (!isAttract) arcadeAudio.playKeyUnlock();
        this.addScore(500, car.x, car.y, '#FACC15');
        if (this.wrenches % 2 === 0 && this.upgradeTier < 3) {
          this.upgradeTier += 1;
          this.popups.push({ x: car.x, y: car.y - 22, text: 'TURBO UPGRADE!', color: '#4ADE80', life: 1.2, maxLife: 1.2 });
        }
      }

      // Waypoint & Lap progression
      const wp = wps[car.nextWp];
      if (Math.hypot(car.x - wp.x, car.y - wp.y) < circuit.roadWidth * 0.72) {
        car.nextWp = (car.nextWp + 1) % wps.length;
        if (car.nextWp === 1) {
          car.lap += 1;
          if (car.isPlayer && !isAttract) {
            this.addScore(500, car.x, car.y, '#38BDF8');
            arcadeAudio.playKeyUnlock();
          }
          if (car.lap > 3) {
            if (isAttract) {
              this.setupTrack(1);
              return;
            }
            if (car.isPlayer) {
              arcadeAudio.playStageClear();
              this.addScore(1500, car.x, car.y, '#4ADE80');
              this.phase = 'STAGE_CLEAR';
              this.phaseTimer = 1.5;
              this.bannerText = '1ST PLACE! +1500';
              return;
            } else {
              // Rival finished first -> advance or finish race
              arcadeAudio.playDeath();
              this.phase = 'GAME_OVER';
              this.bannerText = `${car.name.toUpperCase()} WON!`;
              return;
            }
          }
        }
      }
      car.progress = car.lap * 1000 + ((car.nextWp + wps.length - 1) % wps.length) * 100 - Math.hypot(car.x - wp.x, car.y - wp.y) * 0.1;
    }
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const circuit = this.getCircuit();
    const wps = circuit.waypoints;
    const isMono = this.variant === 'sprint';

    // Track infield background
    ctx.fillStyle = isMono ? '#080A0E' : circuit.bgColor;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Draw closed track loop (wall outer border + asphalt inner surface)
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const traceTrack = () => {
      ctx.beginPath();
      ctx.moveTo(wps[0].x, wps[0].y);
      for (let i = 1; i < wps.length; i++) ctx.lineTo(wps[i].x, wps[i].y);
      ctx.closePath();
    };

    // Outer barrier
    traceTrack();
    ctx.strokeStyle = isMono ? '#E2E8F0' : circuit.wallColor;
    ctx.lineWidth = circuit.roadWidth + 12;
    ctx.stroke();

    // Asphalt road
    traceTrack();
    ctx.strokeStyle = isMono ? '#181C24' : circuit.roadColor;
    ctx.lineWidth = circuit.roadWidth;
    ctx.stroke();

    // Center dashed line
    traceTrack();
    ctx.strokeStyle = isMono ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.22)';
    ctx.setLineDash([12, 14]);
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.setLineDash([]);

    // Championship Sprint retractable shortcut lane
    if (this.variant === 'champsprint') {
      ctx.fillStyle = this.shortcutOpen ? '#475569' : '#1E293B';
      ctx.fillRect(WIDTH * 0.5 - 26, 145, 52, 375);
      ctx.strokeStyle = this.shortcutOpen ? '#4ADE80' : '#EF4444';
      ctx.lineWidth = 3;
      ctx.strokeRect(WIDTH * 0.5 - 26, 145, 52, 375);
    }

    // Checkered Start / Finish Line
    const sf = wps[0];
    for (let i = -4; i < 4; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#FFFFFF' : '#0F172A';
      ctx.fillRect(sf.x - 6, sf.y + i * 11, 12, 11);
    }
    ctx.restore();

    // Hazards
    for (const h of this.hazards) {
      ctx.save();
      ctx.translate(h.x, h.y);
      if (h.kind === 'oil') {
        ctx.fillStyle = '#09090B';
        ctx.beginPath();
        ctx.ellipse(0, 0, h.radius, h.radius * 0.72, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#6366F1';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (h.kind === 'water') {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.55)';
        ctx.beginPath();
        ctx.ellipse(0, 0, h.radius, h.radius * 0.7, -0.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Spinning mini-tornado
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 2.5;
        for (let r = 6; r <= 18; r += 6) {
          ctx.beginPath();
          ctx.arc(0, 0, r, this.time * 10 + r, this.time * 10 + r + Math.PI * 1.3);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // Golden Wrench Pickup
    if (this.wrenchPickup.active) {
      ctx.save();
      ctx.translate(this.wrenchPickup.x, this.wrenchPickup.y);
      ctx.rotate(Math.sin(this.time * 5) * 0.3);
      ctx.shadowColor = '#FACC15';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(-10, -3, 20, 6);
      ctx.beginPath();
      ctx.arc(-10, 0, 6, 0.5, Math.PI * 2 - 0.5);
      ctx.arc(10, 0, 6, Math.PI + 0.5, Math.PI - 0.5);
      ctx.fill();
      ctx.restore();
    }

    // Race Cars
    for (const car of this.cars) {
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(-12, -10, 8, 4);
      ctx.fillRect(-12, 6, 8, 4);
      ctx.fillRect(5, -10, 7, 4);
      ctx.fillRect(5, 6, 7, 4);
      ctx.fillStyle = car.color;
      ctx.beginPath();
      ctx.roundRect(-14, -7.5, 28, 15, 5);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(-4, -4, 7, 8);
      if (car.isPlayer) {
        ctx.fillStyle = '#FEF08A';
        ctx.fillRect(11, -3, 4, 6);
      }
      ctx.restore();
    }

    renderParticlesAndPopups(ctx, this.particles, this.popups);

    if (this.bannerText && (this.phase === 'READY' || this.phase === 'STAGE_CLEAR')) {
      ctx.save();
      ctx.font = '800 28px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(4, 6, 13, 0.85)';
      ctx.fillRect(WIDTH * 0.16, HEIGHT * 0.42, WIDTH * 0.68, 56);
      ctx.fillStyle = isMono ? '#F8FAFC' : '#FACC15';
      ctx.fillText(this.bannerText, WIDTH * 0.5, HEIGHT * 0.42 + 28);
      ctx.restore();
    }

    if (visualMode === 'crt') renderCrtOverlay(ctx, WIDTH, HEIGHT);
  }
}

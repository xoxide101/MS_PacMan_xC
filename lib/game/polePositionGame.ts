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

interface TrackDef {
  name: string;
  skyTop: string;
  skyBottom: string;
  grassA: string;
  grassB: string;
  mountainColor: string;
  seaside?: boolean;
  curves: Array<{ start: number; end: number; curve: number }>;
}

const TRACKS_PP1: TrackDef[] = [
  {
    name: 'Fuji Speedway',
    skyTop: '#0284C7',
    skyBottom: '#7DD3FC',
    grassA: '#15803D',
    grassB: '#166534',
    mountainColor: '#334155',
    curves: [
      { start: 60, end: 180, curve: 0.7 },
      { start: 230, end: 360, curve: -0.9 },
      { start: 420, end: 560, curve: 1.1 },
      { start: 640, end: 780, curve: -0.75 },
      { start: 840, end: 940, curve: 0.5 },
    ],
  },
];

const TRACKS_PP2: TrackDef[] = [
  {
    name: 'Seaside Grand Prix',
    skyTop: '#0369A1',
    skyBottom: '#FDBA74',
    grassA: '#D97706',
    grassB: '#B45309',
    mountainColor: '#0284C7',
    seaside: true,
    curves: [
      { start: 50, end: 190, curve: -0.85 },
      { start: 240, end: 380, curve: 1.05 },
      { start: 460, end: 620, curve: -1.1 },
      { start: 700, end: 880, curve: 0.9 },
    ],
  },
  {
    name: 'Suzuka Circuit',
    skyTop: '#1D4ED8',
    skyBottom: '#93C5FD',
    grassA: '#16A34A',
    grassB: '#15803D',
    mountainColor: '#475569',
    curves: [
      { start: 40, end: 160, curve: 1.15 },
      { start: 190, end: 310, curve: -1.15 },
      { start: 380, end: 540, curve: 0.95 },
      { start: 620, end: 820, curve: -1.0 },
    ],
  },
  {
    name: 'Test Speedway',
    skyTop: '#4338CA',
    skyBottom: '#A5B4FC',
    grassA: '#047857',
    grassB: '#065F46',
    mountainColor: '#1E293B',
    curves: [
      { start: 100, end: 360, curve: 0.65 },
      { start: 520, end: 820, curve: 0.65 },
    ],
  },
];

interface RivalCar {
  z: number; // track distance 0..LAP_LEN
  offset: number; // -0.75..0.75 across road
  speed: number;
  color: string;
}

const LAP_LEN = 1000;

export class PolePositionGame implements ArcadeGameInstance {
  public readonly logicalWidth = WIDTH;
  public readonly logicalHeight = HEIGHT;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'Gas';
  public readonly secondaryActionLabel = 'LO / HI Gear';

  private readonly isSequel: boolean;
  private readonly storageKey: string;

  private phase: ClassicGamePhase = 'TITLE';
  private score = 0;
  private highScore = 0;
  private level = 1;
  private lap = 1;
  private gearHigh = false;
  private timeLeft = 65;
  private phaseTimer = 0;
  private time = 0;
  private bannerText = '';

  private input: ArcadeInputState = createEmptyInput();
  private carZ = 0;
  private carX = 0; // -1.2..1.2 road normalized
  private speed = 0; // 0..335 km/h
  private steerAngle = 0;
  private crashTimer = 0;
  private skyOffset = 0;

  private rivals: RivalCar[] = [];
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  constructor(variant: 'polepos' | 'polepos2') {
    this.isSequel = variant === 'polepos2';
    this.storageKey = this.isSequel ? 'polepos2_hd_highscore_v1' : 'polepos_hd_highscore_v1';
    this.highScore = readHighScore(this.storageKey);
    this.setupRace(1);
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public startNewGame(): void {
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.level = 1;
    this.lap = 1;
    this.particles = [];
    this.popups = [];
    this.setupRace(1);
    this.phase = 'READY';
    this.phaseTimer = 1.4;
    this.bannerText = 'PREPARE TO QUALIFY!';
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.level = 1;
    this.setupRace(1);
  }

  private getTrack(): TrackDef {
    const list = this.isSequel ? TRACKS_PP2 : TRACKS_PP1;
    return list[(this.level - 1) % list.length];
  }

  public getHudSnapshot(): ClassicGameHud {
    return {
      phase: this.phase,
      score: Math.floor(this.score),
      highScore: this.highScore,
      level: this.level,
      lives: Math.max(0, 4 - Math.min(3, this.lap - 1)),
      stageName: `${this.getTrack().name} · Lap ${this.lap}`,
      primaryMetricLabel: 'Speed / Gear',
      primaryMetricValue: `${Math.round(this.speed)} km/h · ${this.gearHigh ? 'HI' : 'LO'}`,
      secondaryMetricLabel: 'Time Left',
      secondaryMetricValue: `${Math.max(0, Math.ceil(this.timeLeft))}s`,
      bannerText: this.bannerText,
    };
  }

  private addScore(pts: number): void {
    if (this.phase === 'TITLE') return;
    this.score += pts;
    if (Math.floor(this.score) > this.highScore) {
      this.highScore = Math.floor(this.score);
      saveHighScore(this.storageKey, this.highScore);
    }
  }

  private setupRace(trackLevel: number): void {
    this.level = trackLevel;
    this.carZ = 0;
    this.carX = 0;
    this.speed = 0;
    this.gearHigh = false;
    this.crashTimer = 0;
    this.timeLeft = 65;

    const rivalColors = ['#3B82F6', '#FACC15', '#22C55E', '#EC4899', '#F97316'];
    this.rivals = Array.from({ length: 12 }, (_, i) => ({
      z: (i + 1) * (LAP_LEN / 12),
      offset: i % 2 === 0 ? -0.42 : 0.42,
      speed: 145 + (i % 4) * 24 + (this.isSequel ? 18 : 0),
      color: rivalColors[i % rivalColors.length],
    }));
  }

  private getCurveAt(z: number): number {
    const wrapped = ((z % LAP_LEN) + LAP_LEN) % LAP_LEN;
    for (const seg of this.getTrack().curves) {
      if (wrapped >= seg.start && wrapped <= seg.end) return seg.curve;
    }
    return 0;
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
        this.lap = 1;
        this.setupRace(this.level);
        this.phase = 'READY';
        this.phaseTimer = 1.2;
        this.bannerText = this.getTrack().name.toUpperCase();
      }
      return;
    }

    const isAttract = this.phase === 'TITLE';

    if (!isAttract) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        arcadeAudio.playDeath();
        this.phase = 'GAME_OVER';
        this.bannerText = 'TIME UP!';
        return;
      }
    }

    if (this.crashTimer > 0) {
      this.crashTimer -= dt;
      this.speed = Math.max(0, this.speed - 280 * dt);
      return;
    }

    // Gear toggle
    if (!isAttract && this.input.secondaryJustPressed) {
      this.gearHigh = !this.gearHigh;
      arcadeAudio.playGearShift(this.gearHigh);
    }

    let steer = 0;
    let accel = false;
    let brake = false;

    if (isAttract) {
      accel = true;
      this.gearHigh = this.speed > 145;
      // Dodge closest rival ahead
      const ahead = this.rivals.find((r) => {
        const dz = (r.z - this.carZ + LAP_LEN) % LAP_LEN;
        return dz > 0 && dz < 48;
      });
      const desiredX = ahead ? (ahead.offset > 0 ? -0.45 : 0.45) : 0;
      steer = Math.max(-1, Math.min(1, (desiredX - this.carX) * 3));
    } else {
      steer = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
      accel = this.input.up || this.input.fire;
      brake = this.input.down;
      // Auto-upshift helper when accelerating past 170 km/h if still in LO? Keep manual shift authentic AND allow automatic shift at redline if player never shifted
      if (accel && !this.gearHigh && this.speed > 185) {
        this.gearHigh = true;
        arcadeAudio.playGearShift(true);
      } else if (this.gearHigh && this.speed < 95) {
        this.gearHigh = false;
      }
    }

    this.steerAngle += (steer - this.steerAngle) * Math.min(1, dt * 12);

    const maxSpeed = this.gearHigh ? (this.isSequel ? 345 : 325) : 195;
    const accelRate = this.gearHigh ? 82 : 135;
    if (accel) {
      this.speed = Math.min(maxSpeed, this.speed + accelRate * dt);
    } else if (brake) {
      this.speed = Math.max(0, this.speed - 240 * dt);
    } else {
      this.speed = Math.max(0, this.speed - 65 * dt);
    }

    // Off-road slowdown
    if (Math.abs(this.carX) > 1.0) {
      this.speed = Math.max(40, this.speed - 175 * dt);
    }

    const speedNorm = this.speed / 320;
    const curve = this.getCurveAt(this.carZ);
    this.carX += (steer * 1.65 * Math.max(0.25, speedNorm) - curve * speedNorm * speedNorm * 1.15) * dt;
    this.carX = Math.max(-1.55, Math.min(1.55, this.carX));
    this.skyOffset += curve * speedNorm * 160 * dt;

    const prevZ = this.carZ;
    const dz = this.speed * 0.22 * dt;
    this.carZ += dz;
    this.addScore(dz * 2.5);

    // Check lap completion
    if (this.carZ >= LAP_LEN) {
      this.carZ -= LAP_LEN;
      if (!isAttract) {
        this.lap += 1;
        this.timeLeft = Math.min(75, this.timeLeft + 32);
        this.addScore(1000);
        arcadeAudio.playKeyUnlock();
        this.popups.push({ x: WIDTH * 0.5, y: HEIGHT * 0.34, text: 'EXTENDED PLAY! +32s', color: '#4ADE80', life: 1.4, maxLife: 1.4 });
        if (this.lap > 3) {
          arcadeAudio.playStageClear();
          this.phase = 'STAGE_CLEAR';
          this.phaseTimer = 1.6;
          this.bannerText = 'CHECKERED FLAG! +5000';
          this.addScore(5000);
          return;
        }
      }
    }

    // Update rival F1 cars & check passing / collisions
    for (const r of this.rivals) {
      const oldRel = (r.z - prevZ + LAP_LEN) % LAP_LEN;
      r.z = (r.z + r.speed * 0.22 * dt) % LAP_LEN;
      const newRel = (r.z - this.carZ + LAP_LEN) % LAP_LEN;

      // Awarded overtake bonus!
      if (oldRel < 30 && newRel > LAP_LEN - 40) {
        this.addScore(150);
        this.popups.push({ x: WIDTH * 0.5, y: HEIGHT * 0.62, text: '+150 PASS', color: '#FDE047', life: 0.7, maxLife: 0.7 });
      }

      if (!isAttract && (newRel < 5.5 || newRel > LAP_LEN - 3.5) && Math.abs(r.offset - this.carX) < 0.34) {
        this.crashTimer = 1.15;
        this.speed = 0;
        this.carX = 0;
        arcadeAudio.playExplosion(true);
        spawnBurst(this.particles, WIDTH * 0.5, HEIGHT - 105, '#EF4444', 28, 250, 4.5);
        spawnBurst(this.particles, WIDTH * 0.5, HEIGHT - 105, '#FACC15', 16, 180, 3.5);
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const track = this.getTrack();
    const horizonY = Math.round(HEIGHT * 0.43);

    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
    sky.addColorStop(0, track.skyTop);
    sky.addColorStop(1, track.skyBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, horizonY);

    // Horizon Mountains / Mount Fuji / Coastal Skyline
    ctx.save();
    ctx.fillStyle = track.mountainColor;
    const shift = ((this.skyOffset % WIDTH) + WIDTH) % WIDTH;
    for (let repeat = -1; repeat <= 1; repeat++) {
      const bx = repeat * WIDTH - shift;
      ctx.beginPath();
      ctx.moveTo(bx, horizonY);
      ctx.lineTo(bx + 140, horizonY - 58);
      ctx.lineTo(bx + 290, horizonY - 22);
      ctx.lineTo(bx + 440, horizonY - 82); // Mount Fuji peak!
      ctx.lineTo(bx + 590, horizonY - 24);
      ctx.lineTo(bx + 730, horizonY - 52);
      ctx.lineTo(bx + WIDTH, horizonY);
      ctx.closePath();
      ctx.fill();

      // Fuji snow cap
      if (!track.seaside) {
        ctx.fillStyle = '#F8FAFC';
        ctx.beginPath();
        ctx.moveTo(bx + 440, horizonY - 82);
        ctx.lineTo(bx + 474, horizonY - 62);
        ctx.lineTo(bx + 406, horizonY - 62);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = track.mountainColor;
      }
    }
    ctx.restore();

    // Pseudo-3D scanline road projection
    const roadH = HEIGHT - horizonY;
    const curveNow = this.getCurveAt(this.carZ);

    for (let y = 0; y < roadH; y += 2) {
      const p = (y + 2) / roadH; // 0 at horizon -> 1 at bottom
      const depth = 1 / Math.max(0.03, p);
      const worldZ = this.carZ + depth * 5.2;
      const stripe = Math.floor(worldZ * 0.45) % 2 === 0;

      // Ground grass / beach strip
      ctx.fillStyle = stripe ? track.grassA : track.grassB;
      ctx.fillRect(0, horizonY + y, WIDTH, 2.5);

      // Perspective road center with curve sway
      const curveShift = curveNow * Math.pow(1 - p, 2) * 320;
      const roadCenterX = WIDTH * 0.5 + curveShift - this.carX * p * 310;
      const halfRoadW = 26 + p * 360;
      const curbW = Math.max(4, halfRoadW * 0.085);

      // Red-white rumble curbs
      ctx.fillStyle = stripe ? '#EF4444' : '#F8FAFC';
      ctx.fillRect(roadCenterX - halfRoadW - curbW, horizonY + y, halfRoadW * 2 + curbW * 2, 2.5);

      // Asphalt surface
      ctx.fillStyle = stripe ? '#334155' : '#293548';
      ctx.fillRect(roadCenterX - halfRoadW, horizonY + y, halfRoadW * 2, 2.5);

      // Dashed center lane lines
      if (stripe) {
        ctx.fillStyle = '#F8FAFC';
        const dashW = Math.max(2, p * 7);
        ctx.fillRect(roadCenterX - dashW * 0.5, horizonY + y, dashW, 2.5);
      }
    }

    // Roadside Billboards & Trees (depth-sorted far to near)
    for (let d = 55; d >= 4; d -= 8) {
      const worldZ = Math.floor((this.carZ + d) / 8) * 8;
      const relZ = worldZ - this.carZ;
      if (relZ <= 2 || relZ > 56) continue;
      const p = 5.2 / relZ;
      if (p > 1.05) continue;
      const sy = horizonY + p * roadH;
      const curveShift = curveNow * Math.pow(1 - p, 2) * 320;
      const roadCenterX = WIDTH * 0.5 + curveShift - this.carX * p * 310;
      const halfRoadW = 26 + p * 360;
      const side = (worldZ / 8) % 2 === 0 ? -1 : 1;
      const sx = roadCenterX + side * (halfRoadW + 45 * p + 12);
      const bw = 62 * p;
      const bh = 38 * p;

      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(sx - 2 * p, sy - bh * 0.4, 4 * p, bh * 0.6);
      ctx.fillStyle = side === 1 ? '#EF4444' : '#2563EB';
      ctx.fillRect(sx - bw * 0.5, sy - bh, bw, bh * 0.65);
      ctx.strokeStyle = '#F8FAFC';
      ctx.lineWidth = Math.max(1, 2 * p);
      ctx.strokeRect(sx - bw * 0.5, sy - bh, bw, bh * 0.65);
    }

    // Rival F1 Cars (sorted far to near)
    const visibleRivals = this.rivals
      .map((r) => ({ r, relZ: (r.z - this.carZ + LAP_LEN) % LAP_LEN }))
      .filter((item) => item.relZ > 3 && item.relZ < 68)
      .sort((a, b) => b.relZ - a.relZ);

    for (const { r, relZ } of visibleRivals) {
      const p = Math.min(1.05, 5.2 / relZ);
      const sy = horizonY + p * roadH;
      const curveShift = curveNow * Math.pow(1 - p, 2) * 320;
      const roadCenterX = WIDTH * 0.5 + curveShift - this.carX * p * 310;
      const halfRoadW = 26 + p * 360;
      const sx = roadCenterX + r.offset * halfRoadW;
      this.drawFormulaCar(ctx, sx, sy, p * 0.95, r.color, 0);
    }

    // Player Formula-1 Car
    if (this.crashTimer <= 0 || Math.floor(this.time * 16) % 2 === 0) {
      const bounce = this.speed > 10 ? Math.sin(this.time * 32) * 1.4 : 0;
      this.drawFormulaCar(
        ctx,
        WIDTH * 0.5,
        HEIGHT - 78 + bounce,
        1.15,
        this.isSequel ? '#38BDF8' : '#EF4444',
        this.steerAngle
      );
    }

    // Crisp Windshield Speed & Gear HUD strip
    ctx.save();
    ctx.fillStyle = 'rgba(4, 6, 13, 0.72)';
    ctx.fillRect(18, 16, 224, 34);
    ctx.font = '700 14px "JetBrains Mono", monospace';
    ctx.fillStyle = '#FACC15';
    ctx.fillText(`${Math.round(this.speed)} KM/H`, 30, 38);
    ctx.fillStyle = this.gearHigh ? '#4ADE80' : '#38BDF8';
    ctx.fillText(this.gearHigh ? 'GEAR: HI' : 'GEAR: LO', 142, 38);
    ctx.restore();

    renderParticlesAndPopups(ctx, this.particles, this.popups);

    if (this.bannerText && (this.phase === 'READY' || this.phase === 'STAGE_CLEAR')) {
      ctx.save();
      ctx.font = '800 30px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(4, 6, 13, 0.84)';
      ctx.fillRect(WIDTH * 0.16, HEIGHT * 0.38, WIDTH * 0.68, 58);
      ctx.fillStyle = '#FACC15';
      ctx.fillText(this.bannerText, WIDTH * 0.5, HEIGHT * 0.38 + 29);
      ctx.restore();
    }

    if (visualMode === 'crt') renderCrtOverlay(ctx, WIDTH, HEIGHT);
  }

  private drawFormulaCar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale: number,
    color: string,
    steer: number
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.rotate(steer * 0.08);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 12, 48, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wide rear racing slicks
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(-46, -12, 16, 26);
    ctx.fillRect(30, -12, 16, 26);

    // Rear spoiler wing
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(-38, -28, 76, 10);
    ctx.fillStyle = color;
    ctx.fillRect(-36, -26, 72, 6);

    // Sculpted F1 chassis
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-28, -16, 56, 26, 8);
    ctx.fill();

    // Driver helmet & rollbar
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(0, -17, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(-5, -18, 10, 3);

    // Twin exhaust tips
    ctx.fillStyle = '#94A3B8';
    ctx.fillRect(-12, 6, 7, 6);
    ctx.fillRect(5, 6, 7, 6);
    ctx.restore();
  }
}

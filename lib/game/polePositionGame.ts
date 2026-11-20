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

    // Multi-stop atmospheric sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
    sky.addColorStop(0, track.skyTop);
    sky.addColorStop(0.72, track.skyBottom);
    sky.addColorStop(1, track.seaside ? '#FEF3C7' : '#E0F2FE');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, horizonY);

    // Sun glow
    const sunX = track.seaside ? WIDTH * 0.78 : WIDTH * 0.18;
    const sunY = track.seaside ? horizonY - 56 : 58;
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 6, sunX, sunY, 78);
    sunGlow.addColorStop(0, 'rgba(255, 251, 235, 0.95)');
    sunGlow.addColorStop(0.35, track.seaside ? 'rgba(251, 146, 60, 0.45)' : 'rgba(254, 240, 138, 0.35)');
    sunGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 78, 0, Math.PI * 2);
    ctx.fill();

    // Drifting layered cumulus clouds (slow parallax)
    const cloudShift = ((this.skyOffset * 0.25 + this.time * 4) % WIDTH + WIDTH) % WIDTH;
    ctx.save();
    for (let repeat = -1; repeat <= 1; repeat++) {
      const cxBase = repeat * WIDTH - cloudShift;
      const clouds = [
        { x: 110, y: 66, w: 96, h: 22 },
        { x: 350, y: 48, w: 122, h: 26 },
        { x: 640, y: 74, w: 108, h: 22 },
      ];
      for (const c of clouds) {
        const cx = cxBase + c.x;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.beginPath();
        ctx.ellipse(cx, c.y, c.w * 0.48, c.h * 0.52, 0, 0, Math.PI * 2);
        ctx.ellipse(cx - c.w * 0.24, c.y + 4, c.w * 0.28, c.h * 0.42, 0, 0, Math.PI * 2);
        ctx.ellipse(cx + c.w * 0.24, c.y + 5, c.w * 0.3, c.h * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(148, 163, 184, 0.22)';
        ctx.beginPath();
        ctx.ellipse(cx, c.y + c.h * 0.35, c.w * 0.44, c.h * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // Far & Mid Horizon Mountains / Iconic Mount Fuji / Seaside Ocean Skyline
    ctx.save();
    const shift = ((this.skyOffset % WIDTH) + WIDTH) % WIDTH;
    for (let repeat = -1; repeat <= 1; repeat++) {
      const bx = repeat * WIDTH - shift;

      if (track.seaside) {
        // Distant coastal headlands
        ctx.fillStyle = '#0369A1';
        ctx.beginPath();
        ctx.moveTo(bx, horizonY);
        ctx.lineTo(bx + 140, horizonY - 36);
        ctx.lineTo(bx + 290, horizonY - 14);
        ctx.lineTo(bx + 490, horizonY - 46);
        ctx.lineTo(bx + 670, horizonY - 18);
        ctx.lineTo(bx + WIDTH, horizonY);
        ctx.closePath();
        ctx.fill();

        // Ocean shimmer band along horizon
        ctx.fillStyle = '#0284C7';
        ctx.fillRect(bx, horizonY - 14, WIDTH, 14);
        ctx.fillStyle = 'rgba(254, 240, 138, 0.5)';
        for (let sx = 0; sx < WIDTH; sx += 46) {
          ctx.fillRect(bx + sx + ((this.time * 18) % 24), horizonY - 10, 18, 2);
        }
        // Distant white sailboats
        for (const sb of [210, 560, 740]) {
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.moveTo(bx + sb, horizonY - 13);
          ctx.lineTo(bx + sb + 8, horizonY - 26);
          ctx.lineTo(bx + sb + 10, horizonY - 13);
          ctx.closePath();
          ctx.fill();
        }
      } else {
        // Far ridge silhouette
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.moveTo(bx, horizonY);
        ctx.lineTo(bx + 120, horizonY - 58);
        ctx.lineTo(bx + 245, horizonY - 24);
        ctx.lineTo(bx + 360, horizonY - 44);
        ctx.lineTo(bx + 540, horizonY - 38);
        ctx.lineTo(bx + 720, horizonY - 62);
        ctx.lineTo(bx + WIDTH, horizonY);
        ctx.closePath();
        ctx.fill();

        // Iconic Mount Fuji cone (shaded lit/shadow slopes)
        ctx.fillStyle = track.mountainColor;
        ctx.beginPath();
        ctx.moveTo(bx + 250, horizonY);
        ctx.quadraticCurveTo(bx + 375, horizonY - 36, bx + 426, horizonY - 96);
        ctx.lineTo(bx + 454, horizonY - 96);
        ctx.quadraticCurveTo(bx + 505, horizonY - 36, bx + 630, horizonY);
        ctx.closePath();
        ctx.fill();

        // Shadow side of Fuji
        ctx.fillStyle = 'rgba(15, 23, 42, 0.32)';
        ctx.beginPath();
        ctx.moveTo(bx + 440, horizonY - 96);
        ctx.lineTo(bx + 454, horizonY - 96);
        ctx.quadraticCurveTo(bx + 505, horizonY - 36, bx + 630, horizonY);
        ctx.lineTo(bx + 468, horizonY);
        ctx.closePath();
        ctx.fill();

        // Jagged classic Fuji snow cap
        ctx.fillStyle = '#F8FAFC';
        ctx.beginPath();
        ctx.moveTo(bx + 426, horizonY - 96);
        ctx.lineTo(bx + 454, horizonY - 96);
        ctx.lineTo(bx + 482, horizonY - 64);
        ctx.lineTo(bx + 464, horizonY - 72);
        ctx.lineTo(bx + 450, horizonY - 58);
        ctx.lineTo(bx + 436, horizonY - 70);
        ctx.lineTo(bx + 418, horizonY - 60);
        ctx.lineTo(bx + 398, horizonY - 66);
        ctx.closePath();
        ctx.fill();

        // Foreground treelines / grandstands silhouette
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(bx + 40, horizonY - 12, 160, 12);
        ctx.fillStyle = '#E2E8F0';
        ctx.fillRect(bx + 48, horizonY - 14, 144, 3);
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
      const startBand = worldZ % LAP_LEN < 5.5;

      // Ground grass / beach strip
      ctx.fillStyle = stripe ? track.grassA : track.grassB;
      ctx.fillRect(0, horizonY + y, WIDTH, 2.5);

      // Perspective road center with curve sway
      const curveShift = curveNow * Math.pow(1 - p, 2) * 320;
      const roadCenterX = WIDTH * 0.5 + curveShift - this.carX * p * 310;
      const halfRoadW = 26 + p * 360;
      const curbW = Math.max(4, halfRoadW * 0.09);

      // Outer gravel verge
      ctx.fillStyle = stripe ? 'rgba(15, 23, 42, 0.28)' : 'rgba(15, 23, 42, 0.16)';
      ctx.fillRect(roadCenterX - halfRoadW - curbW - 8 * p, horizonY + y, (halfRoadW + curbW + 8 * p) * 2, 2.5);

      // Beveled red-white rumble curbs
      ctx.fillStyle = stripe ? '#DC2626' : '#F8FAFC';
      ctx.fillRect(roadCenterX - halfRoadW - curbW, horizonY + y, halfRoadW * 2 + curbW * 2, 2.5);
      // Curb highlight inner lip
      ctx.fillStyle = stripe ? '#FCA5A5' : '#CBD5E1';
      ctx.fillRect(roadCenterX - halfRoadW - curbW * 0.35, horizonY + y, curbW * 0.35, 2.5);
      ctx.fillRect(roadCenterX + halfRoadW, horizonY + y, curbW * 0.35, 2.5);

      // Asphalt surface + subtle darkened racing groove
      ctx.fillStyle = stripe ? '#334155' : '#283446';
      ctx.fillRect(roadCenterX - halfRoadW, horizonY + y, halfRoadW * 2, 2.5);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
      ctx.fillRect(roadCenterX - halfRoadW * 0.55, horizonY + y, halfRoadW * 1.1, 2.5);

      // Crisp white outer road shoulder markings
      const shoulderW = Math.max(1.5, p * 4.5);
      ctx.fillStyle = 'rgba(248, 250, 252, 0.8)';
      ctx.fillRect(roadCenterX - halfRoadW + shoulderW, horizonY + y, shoulderW, 2.5);
      ctx.fillRect(roadCenterX + halfRoadW - shoulderW * 2, horizonY + y, shoulderW, 2.5);

      // Start / finish checkered strip across asphalt
      if (startBand) {
        const checks = 10;
        const cw = (halfRoadW * 2) / checks;
        const rowBit = Math.floor(worldZ * 2.2) % 2;
        for (let c = 0; c < checks; c++) {
          ctx.fillStyle = (c + rowBit) % 2 === 0 ? '#FFFFFF' : '#0F172A';
          ctx.fillRect(roadCenterX - halfRoadW + c * cw, horizonY + y, cw + 0.6, 2.5);
        }
      } else if (stripe) {
        // Dashed center lane lines
        ctx.fillStyle = '#F8FAFC';
        const dashW = Math.max(2, p * 7.5);
        ctx.fillRect(roadCenterX - dashW * 0.5, horizonY + y, dashW, 2.5);
      }
    }

    // Horizon atmospheric haze seam
    const haze = ctx.createLinearGradient(0, horizonY - 12, 0, horizonY + 26);
    haze.addColorStop(0, 'rgba(224, 242, 254, 0)');
    haze.addColorStop(0.5, 'rgba(224, 242, 254, 0.22)');
    haze.addColorStop(1, 'rgba(224, 242, 254, 0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, horizonY - 12, WIDTH, 38);

    // Approaching Start / Finish Gantry Arch
    const relStartZ = (LAP_LEN - this.carZ) % LAP_LEN;
    if (relStartZ > 2.8 && relStartZ < 58) {
      const p = Math.min(1.05, 5.2 / relStartZ);
      const sy = horizonY + p * roadH;
      const curveShift = curveNow * Math.pow(1 - p, 2) * 320;
      const roadCenterX = WIDTH * 0.5 + curveShift - this.carX * p * 310;
      const halfRoadW = 26 + p * 360;
      const postH = 128 * p;
      const postW = Math.max(3, 12 * p);

      ctx.save();
      ctx.fillStyle = '#CBD5E1';
      ctx.fillRect(roadCenterX - halfRoadW - postW * 1.4, sy - postH, postW, postH);
      ctx.fillRect(roadCenterX + halfRoadW + postW * 0.4, sy - postH, postW, postH);

      // Overhead gantry banner
      const bannerH = Math.max(6, 28 * p);
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(roadCenterX - halfRoadW - postW * 1.4, sy - postH, (halfRoadW + postW * 1.4) * 2, bannerH);
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = Math.max(1, 2.5 * p);
      ctx.strokeRect(roadCenterX - halfRoadW - postW * 1.4, sy - postH, (halfRoadW + postW * 1.4) * 2, bannerH);
      if (p > 0.22) {
        ctx.fillStyle = '#FEF08A';
        ctx.font = `900 ${Math.max(8, Math.round(16 * p))}px "Outfit", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.isSequel ? 'POLE POSITION II · GRAND PRIX' : 'POLE POSITION · FUJI SPEEDWAY', roadCenterX, sy - postH + bannerH * 0.52);
      }
      ctx.restore();
    }

    // Vintage Roadside Billboards & Cypress/Palm Trees (depth-sorted far to near)
    const billboardCatalog = [
      { bg: '#DC2626', accent: '#FEF08A', label: 'NAMCO' },
      { bg: '#1D4ED8', accent: '#FFFFFF', label: 'POLE POS' },
      { bg: '#15803D', accent: '#FDE047', label: 'DIG DUG' },
      { bg: '#B45309', accent: '#FEF08A', label: 'TURBO GP' },
      { bg: '#7E22CE', accent: '#38BDF8', label: 'GALAGA' },
    ];

    for (let d = 56; d >= 4; d -= 8) {
      const worldZ = Math.floor((this.carZ + d) / 8) * 8;
      const relZ = worldZ - this.carZ;
      if (relZ <= 2 || relZ > 56) continue;
      const p = 5.2 / relZ;
      if (p > 1.05) continue;
      const sy = horizonY + p * roadH;
      const curveShift = curveNow * Math.pow(1 - p, 2) * 320;
      const roadCenterX = WIDTH * 0.5 + curveShift - this.carX * p * 310;
      const halfRoadW = 26 + p * 360;
      const idx = Math.abs(Math.floor(worldZ / 8));
      const side = idx % 2 === 0 ? -1 : 1;
      const sx = roadCenterX + side * (halfRoadW + 48 * p + 14);
      const isBillboard = idx % 3 !== 2;

      if (isBillboard) {
        const bw = 78 * p;
        const bh = 46 * p;
        const style = billboardCatalog[idx % billboardCatalog.length];

        // Ground shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(sx, sy + 2 * p, bw * 0.45, Math.max(2, 4 * p), 0, 0, Math.PI * 2);
        ctx.fill();

        // Twin steel legs
        ctx.fillStyle = '#94A3B8';
        ctx.fillRect(sx - bw * 0.34, sy - bh * 0.45, Math.max(1.5, 4 * p), bh * 0.48);
        ctx.fillRect(sx + bw * 0.28, sy - bh * 0.45, Math.max(1.5, 4 * p), bh * 0.48);

        // Beveled signboard
        ctx.fillStyle = style.bg;
        ctx.fillRect(sx - bw * 0.5, sy - bh, bw, bh * 0.62);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
        ctx.fillRect(sx - bw * 0.5, sy - bh, bw, bh * 0.18);
        ctx.strokeStyle = '#F8FAFC';
        ctx.lineWidth = Math.max(1, 2.2 * p);
        ctx.strokeRect(sx - bw * 0.5, sy - bh, bw, bh * 0.62);

        if (p > 0.24) {
          ctx.fillStyle = style.accent;
          ctx.font = `900 ${Math.max(7, Math.round(13 * p))}px "Outfit", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(style.label, sx, sy - bh * 0.69);
        }
      } else {
        // Roadside cypress tree / palm tree
        const th = 72 * p;
        const tw = 26 * p;
        ctx.fillStyle = '#78350F';
        ctx.fillRect(sx - tw * 0.14, sy - th * 0.35, tw * 0.28, th * 0.36);
        if (track.seaside) {
          ctx.fillStyle = '#15803D';
          for (let f = -2; f <= 2; f++) {
            ctx.beginPath();
            ctx.ellipse(sx + f * tw * 0.35, sy - th * 0.72 + Math.abs(f) * 4 * p, tw * 0.42, tw * 0.14, f * 0.38, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          ctx.fillStyle = '#166534';
          ctx.beginPath();
          ctx.moveTo(sx, sy - th);
          ctx.lineTo(sx + tw * 0.55, sy - th * 0.24);
          ctx.lineTo(sx - tw * 0.55, sy - th * 0.24);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#22C55E';
          ctx.beginPath();
          ctx.moveTo(sx, sy - th);
          ctx.lineTo(sx + tw * 0.12, sy - th * 0.28);
          ctx.lineTo(sx - tw * 0.48, sy - th * 0.28);
          ctx.closePath();
          ctx.fill();
        }
      }
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
      this.drawFormulaCar(ctx, sx, sy, p * 0.96, r.color, 0, false);
    }

    // Player Formula-1 Car
    if (this.crashTimer <= 0 || Math.floor(this.time * 16) % 2 === 0) {
      const offRoadRumble = Math.abs(this.carX) > 1.0 && this.speed > 20 ? Math.sin(this.time * 55) * 3.2 : 0;
      const bounce = (this.speed > 10 ? Math.sin(this.time * 32) * 1.4 : 0) + offRoadRumble;
      this.drawFormulaCar(
        ctx,
        WIDTH * 0.5,
        HEIGHT - 78 + bounce,
        1.16,
        this.isSequel ? '#2563EB' : '#DC2626',
        this.steerAngle,
        true
      );
    }

    // Crisp F1 Telemetry Strip with Segmented RPM Tachometer
    ctx.save();
    ctx.fillStyle = 'rgba(4, 8, 18, 0.8)';
    ctx.beginPath();
    ctx.roundRect(18, 16, 268, 48, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = '800 15px "JetBrains Mono", monospace';
    ctx.fillStyle = '#FACC15';
    ctx.fillText(`${Math.round(this.speed).toString().padStart(3, '0')} KM/H`, 30, 36);
    ctx.fillStyle = this.gearHigh ? '#4ADE80' : '#38BDF8';
    ctx.fillText(this.gearHigh ? 'GEAR: HI' : 'GEAR: LO', 152, 36);

    // 14-segment LED RPM bar
    const rpmNorm = this.gearHigh
      ? Math.min(1, Math.max(0.15, (this.speed - 90) / 250))
      : Math.min(1, this.speed / 195);
    const activeSegs = Math.round(rpmNorm * 14);
    for (let s = 0; s < 14; s++) {
      const segColor = s >= 11 ? '#EF4444' : s >= 7 ? '#FACC15' : '#4ADE80';
      ctx.fillStyle = s < activeSegs ? segColor : 'rgba(148, 163, 184, 0.18)';
      ctx.fillRect(30 + s * 17.2, 46, 13, 8);
    }
    ctx.restore();

    renderParticlesAndPopups(ctx, this.particles, this.popups);

    if (this.bannerText && (this.phase === 'READY' || this.phase === 'STAGE_CLEAR')) {
      ctx.save();
      ctx.font = '800 30px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(4, 6, 13, 0.86)';
      ctx.beginPath();
      ctx.roundRect(WIDTH * 0.15, HEIGHT * 0.37, WIDTH * 0.7, 62, 10);
      ctx.fill();
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#FACC15';
      ctx.fillText(this.bannerText, WIDTH * 0.5, HEIGHT * 0.37 + 31);
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
    steer: number,
    isPlayer: boolean
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.rotate(steer * 0.085);

    const treadScroll = Math.floor(this.time * (isPlayer ? Math.max(4, this.speed * 0.18) : 22)) % 3;

    // Grounded underbody shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
    ctx.beginPath();
    ctx.ellipse(0, 14, 52, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Front peek wheels (visible when steering)
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(-35 + steer * 5, -24, 10, 12);
    ctx.fillRect(25 + steer * 5, -24, 10, 12);

    // Wide rear racing slicks with rolling tread ribs
    for (const wx of [-48, 30]) {
      const tireGrad = ctx.createLinearGradient(wx, -14, wx + 18, -14);
      tireGrad.addColorStop(0, '#090D16');
      tireGrad.addColorStop(0.5, '#1E293B');
      tireGrad.addColorStop(1, '#090D16');
      ctx.fillStyle = tireGrad;
      ctx.beginPath();
      ctx.roundRect(wx, -14, 18, 28, 4);
      ctx.fill();
      // Rolling rubber highlight bands
      ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
      for (let r = 0; r < 3; r++) {
        ctx.fillRect(wx + 2, -11 + ((r * 9 + treadScroll * 3) % 24), 14, 2);
      }
    }

    // Rear suspension wishbones
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-30, -4);
    ctx.lineTo(-20, -8);
    ctx.moveTo(30, -4);
    ctx.lineTo(20, -8);
    ctx.moveTo(-30, 6);
    ctx.lineTo(-18, 4);
    ctx.moveTo(30, 6);
    ctx.lineTo(18, 4);
    ctx.stroke();

    // Sculpted sidepods & tapered engine cover
    const bodyGrad = ctx.createLinearGradient(-30, -18, 30, 14);
    bodyGrad.addColorStop(0, color);
    bodyGrad.addColorStop(0.5, color);
    bodyGrad.addColorStop(1, '#0F172A');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(-16, -24);
    ctx.lineTo(16, -24);
    ctx.lineTo(31, -8);
    ctx.lineTo(28, 10);
    ctx.lineTo(-28, 10);
    ctx.lineTo(-31, -8);
    ctx.closePath();
    ctx.fill();

    // Crisp racing white center livery stripe
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.moveTo(-7, -23);
    ctx.lineTo(7, -23);
    ctx.lineTo(11, 8);
    ctx.lineTo(-11, 8);
    ctx.closePath();
    ctx.fill();

    // Sidepod air vents & chrome rollbar
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(-26, -6, 8, 12);
    ctx.fillRect(18, -6, 8, 12);
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, -18, 8.5, Math.PI, 0);
    ctx.stroke();

    // Leaning driver helmet + tinted visor
    const headShift = steer * 4.5;
    const helmGrad = ctx.createRadialGradient(headShift - 2, -23, 1, headShift, -20, 8);
    helmGrad.addColorStop(0, '#FFFFFF');
    helmGrad.addColorStop(0.45, '#FEF08A');
    helmGrad.addColorStop(1, '#CA8A04');
    ctx.fillStyle = helmGrad;
    ctx.beginPath();
    ctx.arc(headShift, -20, 7.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.roundRect(headShift - 5, -22, 10, 3.2, 1.5);
    ctx.fill();

    // Twin-plane rear airfoil spoiler wing & endplates
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(-40, -34, 4, 18);
    ctx.fillRect(36, -34, 4, 18);
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.roundRect(-38, -33, 76, 11, 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.fillRect(-36, -30, 72, 6);
    // Specular edge across top of wing
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.fillRect(-36, -33, 72, 2);

    // Rear gearbox diffuser + glowing red rain light
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(-14, 5, 28, 7);
    const brakeGlow = isPlayer && this.input.down;
    ctx.fillStyle = brakeGlow ? '#FF3B30' : '#991B1B';
    ctx.beginPath();
    ctx.arc(0, 7.5, brakeGlow ? 3.5 : 2.4, 0, Math.PI * 2);
    ctx.fill();

    // Twin chrome exhaust pipes + high-RPM blue/amber flame pops
    ctx.fillStyle = '#CBD5E1';
    ctx.fillRect(-13, 6, 5.5, 6);
    ctx.fillRect(7.5, 6, 5.5, 6);
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(-12, 8, 3.5, 3.5);
    ctx.fillRect(8.5, 8, 3.5, 3.5);

    if (isPlayer && this.speed > 210 && Math.floor(this.time * 24) % 2 === 0) {
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.ellipse(-10.2, 14, 3, 5.5, 0, 0, Math.PI * 2);
      ctx.ellipse(10.2, 14, 3, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.ellipse(-10.2, 13, 1.5, 3, 0, 0, Math.PI * 2);
      ctx.ellipse(10.2, 13, 1.5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

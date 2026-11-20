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
import { drawStarGlint } from './arcadeGfx';
import {
  CompiledTrack,
  SPRINT_H,
  SPRINT_W,
  SprintVariant,
  compileSprintTrack,
  getTracksForVariant,
  isPointInShortcut,
  projectOntoTrack,
  sampleAtT,
} from './sprintTracks';

// ============================================================================
// ATARI / KEE GAMES / LELAND OVERHEAD RACING — HIGH-RES (1280x960) ENGINE
// - Sprint 1 (1978, 8 tracks) & Sprint 2 (1976, 8 tracks): Monochrome 4-Speed Classics
// - Sprint 4 (1977, 6 tracks) & Sprint 8 (1977, 6 tracks, 8 cars!): First Color Editions
// - Super Sprint (1986, 8 tracks) & Championship Sprint (1986, 8 tracks): System 2 Icons
// - Badlands (1989, 6 tracks): Mounted Roof Cannons, Destructible Land Mines & Wasteland Buggies
// - Super Off Road (1989, 8 tracks): 3D Dirt Jumps, Deep Mud Pits, N2O Nitro & 4x4 Trucks
// - Indy Heat (1991, 6 tracks): Fuel & Engine Heat Management, Live Pit Lane & CART IndyCars
// ============================================================================

interface RacerCar {
  id: number;
  isPlayer: boolean;
  name: string;
  bodyColor: string;
  accentColor: string;
  helmetColor: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  steerVisual: number;
  spinTimer: number;
  spinDir: 1 | -1;
  waterTimer: number;
  hazardCooldown: number;
  crashTimer: number;
  heliX: number;
  heliY: number;
  onBridge: boolean;
  // Super Off Road 3D dirt jump physics
  jumpZ: number;
  jumpVz: number;
  jumpCooldown: number;
  sampleIdx: number;
  lap: number;
  checkpointsHit: number;
  progress: number;
  aiSpeedBias: number;
  aiLaneOffset: number;
}

interface ActiveHazard {
  kind: 'oil' | 'water' | 'tornado' | 'mine';
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  onBridge: boolean;
  active?: boolean;
}

interface TrackPickup {
  kind: 'wrench' | 'bonus' | 'nitro' | 'cash';
  x: number;
  y: number;
  active: boolean;
  points: number;
  onBridge: boolean;
}

interface CannonShot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ownerId: number;
  onBridge: boolean;
}

export class SprintGame implements ArcadeGameInstance {
  public readonly logicalWidth = SPRINT_W;
  public readonly logicalHeight = SPRINT_H;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel: string;
  public readonly secondaryActionLabel: string;

  private readonly variant: SprintVariant;
  private readonly storageKey: string;

  private phase: ClassicGamePhase = 'TITLE';
  private score = 0;
  private highScore = 0;
  private raceNum = 1;
  private time = 0;
  private phaseTimer = 0;
  private countdownStage = 3;
  private bannerText = '';

  // Pit Upgrade Shop stats (Super Sprint / Champ Sprint / Badlands / Off Road / Indy Heat)
  private wrenches = 0;
  private cash = 0;
  private speedStat = 0; // 0..5
  private accelStat = 0; // 0..5 (Cannon Power in Badlands, Shocks in Off Road, Turbo in Indy Heat)
  private tractionStat = 0; // 0..5 (Armor/Grip in Badlands, Tires in Off Road, Cooling in Indy Heat)
  private inPitShop = false;
  private pitShopCursor = 0;
  private pitShopTimer = 0;
  private pitNavCd = 0;

  // Boost / Nitro / Badlands Cannon / Indy Heat Fuel & Engine Heat
  private boostTimer = 0;
  private boostCooldown = 0;
  private nitros = 3;
  private cannonCooldown = 0;
  private shots: CannonShot[] = [];
  private indyFuel = 100;
  private indyHeat = 0;
  private indyOverheatTimer = 0;
  private pitPopupCooldown = 0;

  private input: ArcadeInputState = createEmptyInput();
  private compiledTrack!: CompiledTrack;
  private cars: RacerCar[] = [];
  private hazards: ActiveHazard[] = [];
  private pickups: TrackPickup[] = [];
  private shortcutState: 'open' | 'warning' | 'closed' = 'closed';
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  private trackCanvas: HTMLCanvasElement | null = null;
  private skidCanvas: HTMLCanvasElement | null = null;
  private skidCtx: CanvasRenderingContext2D | null = null;

  constructor(variant: SprintVariant) {
    this.variant = variant;
    this.primaryActionLabel =
      variant === 'badlands' ? 'Fire Cannon' : variant === 'superoffroad' ? 'Gas / Jump' : 'Gas';
    this.secondaryActionLabel =
      variant === 'superoffroad'
        ? 'N2O Nitro'
        : variant === 'indyheat'
          ? 'Indy Turbo'
          : variant === 'badlands'
            ? 'Thruster Boost'
            : 'Drift / Boost';

    const keyMap: Record<SprintVariant, string> = {
      sprint1: 'sprint1_hd_highscore_v2',
      sprint: 'sprint_hd_highscore_v2',
      sprint4: 'sprint4_hd_highscore_v1',
      sprint8: 'sprint8_hd_highscore_v1',
      supersprint: 'supersprint_hd_highscore_v2',
      champsprint: 'champsprint_hd_highscore_v2',
      badlands: 'badlands_hd_highscore_v1',
      superoffroad: 'superoffroad_hd_highscore_v1',
      indyheat: 'indyheat_hd_highscore_v1',
    };
    this.storageKey = keyMap[variant];
    this.highScore = readHighScore(this.storageKey);
    this.setupRace(1);
  }

  private isMonoVariant(): boolean {
    return this.variant === 'sprint1' || this.variant === 'sprint';
  }

  private isClassicGearVariant(): boolean {
    return (
      this.variant === 'sprint1' ||
      this.variant === 'sprint' ||
      this.variant === 'sprint4' ||
      this.variant === 'sprint8'
    );
  }

  private getTitleLabel(): string {
    switch (this.variant) {
      case 'sprint1':
        return 'SPRINT 1';
      case 'sprint':
        return 'SPRINT 2';
      case 'sprint4':
        return 'SPRINT 4';
      case 'sprint8':
        return 'SPRINT 8';
      case 'supersprint':
        return 'SUPER SPRINT';
      case 'champsprint':
        return 'CHAMPIONSHIP SPRINT';
      case 'badlands':
        return 'BADLANDS';
      case 'superoffroad':
        return 'SUPER OFF ROAD';
      case 'indyheat':
        return 'INDY HEAT';
    }
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public startNewGame(): void {
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.raceNum = 1;
    this.wrenches = 0;
    this.cash = 0;
    this.nitros = 4;
    this.speedStat = 0;
    this.accelStat = 0;
    this.tractionStat = 0;
    this.inPitShop = false;
    this.particles = [];
    this.popups = [];
    this.setupRace(1);
    this.phase = 'READY';
    this.phaseTimer = 1.65;
    this.countdownStage = 3;
    this.bannerText = `RACE 1 · ${this.compiledTrack.blueprint.name.toUpperCase()}`;
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.inPitShop = false;
    this.raceNum = 1;
    this.setupRace(1);
  }

  private setupRace(raceIndex: number): void {
    this.raceNum = raceIndex;
    const list = getTracksForVariant(this.variant);
    const bp = list[(raceIndex - 1) % list.length];
    this.compiledTrack = compileSprintTrack(bp);
    this.boostTimer = 0;
    this.boostCooldown = 0;
    this.cannonCooldown = 0;
    this.shots = [];
    this.indyFuel = 100;
    this.indyHeat = 0;
    this.indyOverheatTimer = 0;
    this.pitPopupCooldown = 0;
    if (this.variant === 'superoffroad') {
      this.nitros = Math.max(this.nitros, 3 + Math.floor(this.speedStat * 0.5));
    }

    const n = this.compiledTrack.samples.length;
    const gridDefs =
      this.variant === 'sprint1'
        ? [
            { name: 'Player 1', body: '#F8FAFC', accent: '#4ADE80', helmet: '#4ADE80' },
            { name: 'Drone A', body: '#94A3B8', accent: '#334155', helmet: '#CBD5E1' },
            { name: 'Drone B', body: '#CBD5E1', accent: '#1E293B', helmet: '#94A3B8' },
            { name: 'Drone C', body: '#64748B', accent: '#0F172A', helmet: '#E2E8F0' },
          ]
        : this.variant === 'sprint'
          ? [
              { name: 'White Car', body: '#FFFFFF', accent: '#38BDF8', helmet: '#38BDF8' },
              { name: 'Black Car', body: '#64748B', accent: '#E2E8F0', helmet: '#F8FAFC' },
              { name: 'Drone 1', body: '#94A3B8', accent: '#1E293B', helmet: '#CBD5E1' },
              { name: 'Drone 2', body: '#CBD5E1', accent: '#334155', helmet: '#94A3B8' },
            ]
          : this.variant === 'sprint8'
            ? [
                { name: 'White #1', body: '#FFFFFF', accent: '#FACC15', helmet: '#0F172A' },
                { name: 'Red #2', body: '#EF4444', accent: '#FFFFFF', helmet: '#FEF08A' },
                { name: 'Blue #3', body: '#38BDF8', accent: '#E0F2FE', helmet: '#FFFFFF' },
                { name: 'Yellow #4', body: '#FACC15', accent: '#FEF08A', helmet: '#0F172A' },
                { name: 'Green #5', body: '#22C55E', accent: '#DCFCE7', helmet: '#FFFFFF' },
                { name: 'Orange #6', body: '#F97316', accent: '#FFEDD5', helmet: '#0F172A' },
                { name: 'Violet #7', body: '#C084FC', accent: '#F3E8FF', helmet: '#FFFFFF' },
                { name: 'Cyan #8', body: '#2DD4BF', accent: '#CCFBF1', helmet: '#0F172A' },
              ]
            : this.variant === 'badlands'
              ? [
                  { name: 'Road Warrior', body: '#EF4444', accent: '#FACC15', helmet: '#F8FAFC' },
                  { name: 'Viper Buggy', body: '#38BDF8', accent: '#0F172A', helmet: '#FACC15' },
                  { name: 'Iron Jackal', body: '#F97316', accent: '#1C1917', helmet: '#FFFFFF' },
                  { name: 'Toxic Nomad', body: '#84CC16', accent: '#14532D', helmet: '#FACC15' },
                ]
              : this.variant === 'superoffroad'
                ? [
                    { name: 'Red 4x4', body: '#EF4444', accent: '#FFFFFF', helmet: '#FEF08A' },
                    { name: 'Blue 4x4', body: '#3B82F6', accent: '#DBEAFE', helmet: '#FFFFFF' },
                    { name: 'Yellow 4x4', body: '#FACC15', accent: '#1E293B', helmet: '#0F172A' },
                    { name: 'Ironman Ivan', body: '#CBD5E1', accent: '#EF4444', helmet: '#FACC15' },
                  ]
                : this.variant === 'indyheat'
                  ? [
                      { name: 'Player Indy', body: '#EF4444', accent: '#FFFFFF', helmet: '#FACC15' },
                      { name: 'Danny #1', body: '#F8FAFC', accent: '#2563EB', helmet: '#EF4444' },
                      { name: 'Yellow CART', body: '#FACC15', accent: '#0F172A', helmet: '#EF4444' },
                      { name: 'Emerald #7', body: '#10B981', accent: '#FFFFFF', helmet: '#FACC15' },
                    ]
                  : [
                      { name: 'Red Racer', body: '#EF4444', accent: '#FFFFFF', helmet: '#FEF08A' },
                      { name: 'Blue Rival', body: '#38BDF8', accent: '#E0F2FE', helmet: '#FFFFFF' },
                      { name: 'Yellow Rival', body: '#FACC15', accent: '#FEF08A', helmet: '#0F172A' },
                      { name: 'Green Rival', body: '#22C55E', accent: '#DCFCE7', helmet: '#FFFFFF' },
                    ];

    const is8Car = gridDefs.length > 4;
    this.cars = gridDefs.map((g, idx) => {
      const row = Math.floor(idx / 2);
      const gridBackIdx = (n - 4 - row * (is8Car ? 4 : 5) + n) % n;
      const sp = this.compiledTrack.samples[gridBackIdx];
      const lateral = (idx % 2 === 0 ? -1 : 1) * (bp.roadWidth * (is8Car ? 0.24 : 0.21));
      const startAngle = Math.atan2(sp.ty, sp.tx);
      return {
        id: idx,
        isPlayer: idx === 0,
        name: g.name,
        bodyColor: g.body,
        accentColor: g.accent,
        helmetColor: g.helmet,
        x: sp.x + sp.nx * lateral,
        y: sp.y + sp.ny * lateral,
        vx: 0,
        vy: 0,
        angle: startAngle,
        steerVisual: 0,
        spinTimer: 0,
        spinDir: 1,
        waterTimer: 0,
        hazardCooldown: 0,
        crashTimer: 0,
        heliX: sp.x,
        heliY: sp.y - 260,
        onBridge: sp.isBridge,
        jumpZ: 0,
        jumpVz: 0,
        jumpCooldown: 0,
        sampleIdx: gridBackIdx,
        lap: 1,
        checkpointsHit: 0,
        progress: 0,
        aiSpeedBias: (is8Car ? 0.78 + (idx % 7) * 0.036 : 0.85 + idx * 0.045) + Math.min(0.16, (raceIndex - 1) * 0.022),
        aiLaneOffset: ((idx % 4) - 1.5) * 15,
      };
    });

    // Populate authentic oil slicks, water/mud pits, wasteland mines, and mini-tornado!
    this.hazards = [];
    for (const o of bp.oilSpots) {
      const sp = sampleAtT(this.compiledTrack, o.t);
      this.hazards.push({
        kind: 'oil',
        x: sp.x + sp.nx * o.offset,
        y: sp.y + sp.ny * o.offset,
        vx: 0,
        vy: 0,
        radius: o.radius,
        onBridge: sp.isBridge,
        active: true,
      });
    }
    for (const w of bp.waterSpots) {
      const sp = sampleAtT(this.compiledTrack, w.t);
      this.hazards.push({
        kind: 'water',
        x: sp.x + sp.nx * w.offset,
        y: sp.y + sp.ny * w.offset,
        vx: 0,
        vy: 0,
        radius: w.radius,
        onBridge: sp.isBridge,
        active: true,
      });
    }
    if (bp.mineSpots) {
      for (const m of bp.mineSpots) {
        const sp = sampleAtT(this.compiledTrack, m.t);
        this.hazards.push({
          kind: 'mine',
          x: sp.x + sp.nx * m.offset,
          y: sp.y + sp.ny * m.offset,
          vx: 0,
          vy: 0,
          radius: 17,
          onBridge: sp.isBridge,
          active: true,
        });
      }
    }
    if (bp.hasTornado) {
      this.hazards.push({
        kind: 'tornado',
        x: SPRINT_W * 0.5,
        y: SPRINT_H * 0.5,
        vx: 95,
        vy: 68,
        radius: 26,
        onBridge: false,
        active: true,
      });
    }

    // Track Pickups: Golden Wrenches / Cash / N2O Nitro Bottles!
    this.pickups = [];
    if (this.variant === 'superoffroad') {
      const p1 = sampleAtT(this.compiledTrack, 0.34);
      const p2 = sampleAtT(this.compiledTrack, 0.68);
      const p3 = sampleAtT(this.compiledTrack, 0.85);
      this.pickups.push(
        { kind: 'nitro', x: p1.x + p1.nx * 14, y: p1.y + p1.ny * 14, active: true, points: 250, onBridge: p1.isBridge },
        { kind: 'cash', x: p2.x - p2.nx * 14, y: p2.y - p2.ny * 14, active: true, points: 1000, onBridge: p2.isBridge },
        { kind: 'nitro', x: p3.x + p3.nx * 10, y: p3.y + p3.ny * 10, active: true, points: 250, onBridge: p3.isBridge }
      );
    } else if (!this.isClassicGearVariant()) {
      const w1 = sampleAtT(this.compiledTrack, 0.38);
      const w2 = sampleAtT(this.compiledTrack, 0.78);
      this.pickups.push({
        kind: 'wrench',
        x: w1.x + w1.nx * 14,
        y: w1.y + w1.ny * 14,
        active: true,
        points: 500,
        onBridge: w1.isBridge,
      });
      this.pickups.push({
        kind: this.variant === 'indyheat' ? 'cash' : 'bonus',
        x: w2.x - w2.nx * 14,
        y: w2.y - w2.ny * 14,
        active: true,
        points: this.variant === 'indyheat' ? 1000 : 250,
        onBridge: w2.isBridge,
      });
    }

    this.bakeTrackAndSkidLayers();
  }

  private bakeTrackAndSkidLayers(): void {
    if (typeof document === 'undefined') return;
    if (!this.trackCanvas) {
      this.trackCanvas = document.createElement('canvas');
      this.trackCanvas.width = SPRINT_W;
      this.trackCanvas.height = SPRINT_H;
    }
    if (!this.skidCanvas) {
      this.skidCanvas = document.createElement('canvas');
      this.skidCanvas.width = SPRINT_W;
      this.skidCanvas.height = SPRINT_H;
      this.skidCtx = this.skidCanvas.getContext('2d');
    }
    if (this.skidCtx) {
      this.skidCtx.clearRect(0, 0, SPRINT_W, SPRINT_H);
    }

    const ctx = this.trackCanvas.getContext('2d');
    if (!ctx) return;

    const bp = this.compiledTrack.blueprint;
    const samples = this.compiledTrack.samples;
    const isMono = this.isMonoVariant();

    // 1. High-Res Textured Stadium Turf / Desert Dirt / Phosphor CRT Blueprint Infield
    ctx.fillStyle = bp.infieldColor;
    ctx.fillRect(0, 0, SPRINT_W, SPRINT_H);

    if (isMono) {
      ctx.strokeStyle = bp.infieldStripeColor;
      ctx.lineWidth = 1;
      for (let gx = 0; gx < SPRINT_W; gx += 32) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, SPRINT_H);
        ctx.stroke();
      }
      for (let gy = 0; gy < SPRINT_H; gy += 32) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(SPRINT_W, gy);
        ctx.stroke();
      }
    } else {
      // Mowed stadium stripes + subtle terrain grain
      ctx.fillStyle = bp.infieldStripeColor;
      for (let sx = 0; sx < SPRINT_W; sx += 56) {
        ctx.fillRect(sx, 0, 28, SPRINT_H);
      }
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      for (let i = 0; i < 420; i++) {
        const px = ((i * 197 + 53) % SPRINT_W);
        const py = ((i * 311 + 89) % SPRINT_H);
        ctx.fillRect(px, py, 3, 3);
      }
    }

    // 2. Scenery Props (Grandstands with colorful crowds, Pit Garages, Trees, Cacti, Tents)
    for (const p of bp.props) {
      if (p.kind === 'grandstand' && p.w && p.h) {
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(p.x + 5, p.y + 6, p.w, p.h);
        ctx.fillStyle = isMono ? '#1E293B' : '#334155';
        ctx.beginPath();
        ctx.roundRect(p.x, p.y, p.w, p.h, 5);
        ctx.fill();
        ctx.strokeStyle = isMono ? bp.wallOuterColor : '#94A3B8';
        ctx.lineWidth = 2;
        ctx.stroke();
        // Bleacher tiers + colorful spectator dots
        for (let r = 0; r < 3; r++) {
          ctx.fillStyle = isMono ? '#0F172A' : '#1E293B';
          ctx.fillRect(p.x + 6, p.y + 6 + r * 12, p.w - 12, 8);
          for (let cx = p.x + 12; cx < p.x + p.w - 12; cx += 11) {
            ctx.fillStyle = isMono
              ? (cx + r) % 2 === 0
                ? '#CBD5E1'
                : '#64748B'
              : (cx * 7 + r) % 4 === 0
                ? '#FACC15'
                : (cx * 5 + r) % 3 === 0
                  ? '#EF4444'
                  : (cx + r) % 2 === 0
                    ? '#38BDF8'
                    : '#4ADE80';
            ctx.fillRect(cx, p.y + 8 + r * 12, 5, 4);
          }
        }
      } else if (p.kind === 'pit' && p.w && p.h) {
        ctx.fillStyle = 'rgba(0,0,0,0.38)';
        ctx.fillRect(p.x + 6, p.y + 6, p.w, p.h);
        ctx.fillStyle = isMono ? '#111827' : '#1E293B';
        ctx.beginPath();
        ctx.roundRect(p.x, p.y, p.w, p.h, 6);
        ctx.fill();
        ctx.strokeStyle = isMono ? bp.kerbPrimary : '#FACC15';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        // Pit bay doors + painted arcade logo on roof!
        ctx.fillStyle = isMono ? '#94A3B8' : '#E2E8F0';
        ctx.font = '900 13px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.getTitleLabel(), p.x + p.w * 0.5, p.y + p.h * 0.44);
        ctx.fillStyle = isMono ? bp.kerbPrimary : '#FACC15';
        ctx.font = '700 10px "JetBrains Mono", monospace';
        ctx.fillText('PIT GARAGE · ATARI', p.x + p.w * 0.5, p.y + p.h * 0.72);
      } else if (p.kind === 'tree') {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.arc(p.x + 5, p.y + 6, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#15803D';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 21, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#22C55E';
        ctx.beginPath();
        ctx.arc(p.x - 5, p.y - 5, 13, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'cactus') {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(p.x + 4, p.y + 5, 14, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#16A34A';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
        ctx.arc(p.x - 10, p.y - 4, 6, 0, Math.PI * 2);
        ctx.arc(p.x + 10, p.y + 4, 6, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'tent') {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(p.x - 20, p.y - 16, 48, 40);
        ctx.fillStyle = p.color || '#EF4444';
        ctx.fillRect(p.x - 22, p.y - 20, 44, 36);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x - 22, p.y - 20);
        ctx.lineTo(p.x + 22, p.y + 16);
        ctx.moveTo(p.x + 22, p.y - 20);
        ctx.lineTo(p.x - 22, p.y + 16);
        ctx.stroke();
      } else if (p.kind === 'wreck') {
        // Rusted post-apocalyptic car hulk (Badlands!)
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(0.42);
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(-20, -10, 44, 24);
        ctx.fillStyle = '#7C2D12';
        ctx.beginPath();
        ctx.roundRect(-22, -12, 44, 24, 4);
        ctx.fill();
        ctx.strokeStyle = '#F97316';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#1C1917';
        ctx.fillRect(-8, -8, 16, 16);
        ctx.restore();
      } else if (p.kind === 'bale') {
        // Stadium dirt-track hay bale (Super Off Road!)
        ctx.fillStyle = 'rgba(0,0,0,0.38)';
        ctx.fillRect(p.x - 20, p.y - 10, 44, 24);
        ctx.fillStyle = '#D97706';
        ctx.beginPath();
        ctx.roundRect(p.x - 22, p.y - 12, 44, 24, 4);
        ctx.fill();
        ctx.strokeStyle = '#FDE047';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x - 16, p.y - 12, 10, 24);
        ctx.strokeRect(p.x + 6, p.y - 12, 10, 24);
      }
    }

    // 3. Draw Ground-Level Track Layers (extend 1 segment under bridge ramp entrances for seamless joins!)
    const traceNonBridge = () => {
      ctx.beginPath();
      let started = false;
      const len = samples.length;
      for (let i = 0; i <= len; i++) {
        const idx = i % len;
        const s = samples[idx];
        const prev = samples[(idx - 1 + len) % len];
        const next = samples[(idx + 1) % len];
        const isGroundOrRampEdge = !s.isBridge || !prev.isBridge || !next.isBridge;
        if (!isGroundOrRampEdge) {
          started = false;
          continue;
        }
        if (!started) {
          ctx.moveTo(s.x, s.y);
          started = true;
        } else {
          ctx.lineTo(s.x, s.y);
        }
      }
    };

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Outer barrier shadow
    traceNonBridge();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.48)';
    ctx.lineWidth = bp.roadWidth + 32;
    ctx.stroke();

    // Concrete barrier wall
    traceNonBridge();
    ctx.strokeStyle = bp.wallOuterColor;
    ctx.lineWidth = bp.roadWidth + 20;
    ctx.stroke();

    // Striped red/white apex kerb apron
    traceNonBridge();
    ctx.strokeStyle = bp.kerbPrimary;
    ctx.lineWidth = bp.roadWidth + 10;
    ctx.stroke();
    traceNonBridge();
    ctx.strokeStyle = bp.kerbSecondary;
    ctx.lineWidth = bp.roadWidth + 10;
    ctx.setLineDash([16, 16]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Main asphalt road
    traceNonBridge();
    ctx.strokeStyle = bp.asphaltColor;
    ctx.lineWidth = bp.roadWidth;
    ctx.stroke();

    // Dark rubber racing groove
    traceNonBridge();
    ctx.strokeStyle = isMono ? 'rgba(255,255,255,0.045)' : 'rgba(15, 23, 42, 0.36)';
    ctx.lineWidth = bp.roadWidth * 0.44;
    ctx.stroke();

    // Center dashed line
    traceNonBridge();
    ctx.strokeStyle = isMono ? 'rgba(255,255,255,0.34)' : 'rgba(248, 250, 252, 0.25)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([14, 18]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Classic Kee Games / Atari Pylon Barrier Dots for Sprint 1, 2, 4, 8!
    if (this.isClassicGearVariant()) {
      ctx.fillStyle = bp.wallOuterColor;
      for (let i = 0; i < samples.length; i += 3) {
        const s = samples[i];
        if (s.isBridge || s.isUnderpass) continue;
        const off = bp.roadWidth * 0.5 + 10;
        ctx.beginPath();
        ctx.arc(s.x + s.nx * off, s.y + s.ny * off, 3, 0, Math.PI * 2);
        ctx.arc(s.x - s.nx * off, s.y - s.ny * off, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Super Off Road 3D Shaded Dirt Tabletop Jump Mounds!
    if (bp.jumpSpots) {
      for (const j of bp.jumpSpots) {
        const sp = sampleAtT(this.compiledTrack, j.t);
        const halfW = bp.roadWidth * 0.46;
        ctx.save();
        ctx.translate(sp.x, sp.y);
        ctx.rotate(Math.atan2(sp.ty, sp.tx));
        const g = ctx.createLinearGradient(-28, 0, 28, 0);
        g.addColorStop(0, 'rgba(120, 53, 15, 0.25)');
        g.addColorStop(0.35, '#F59E0B');
        g.addColorStop(0.55, '#FDE68A');
        g.addColorStop(0.8, '#78350F');
        g.addColorStop(1, 'rgba(15, 10, 5, 0.55)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(-28, -halfW, 56, halfW * 2, 8);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(4, -halfW + 6);
        ctx.lineTo(4, halfW - 6);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Indy Heat Live Pit Lane Refuel & Engine Cooling Strip!
    if (bp.pitLane) {
      const startIdx = Math.floor(bp.pitLane.startT * samples.length);
      const endIdx = Math.floor(bp.pitLane.endT * samples.length);
      const laneOff = bp.pitLane.side * (bp.roadWidth * 0.34);
      ctx.save();
      ctx.beginPath();
      for (let i = startIdx; i <= endIdx; i++) {
        const s = samples[i % samples.length];
        const px = s.x + s.nx * laneOff;
        const py = s.y + s.ny * laneOff;
        if (i === startIdx) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.42)';
      ctx.lineWidth = 30;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.strokeStyle = '#4ADE80';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 10]);
      ctx.stroke();
      ctx.setLineDash([]);
      const midS = samples[Math.floor((startIdx + endIdx) * 0.5) % samples.length];
      ctx.translate(midS.x + midS.nx * laneOff, midS.y + midS.ny * laneOff);
      ctx.rotate(Math.atan2(midS.ty, midS.tx));
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PIT LANE · REFUEL & COOL', 0, 0);
      ctx.restore();
    }

    // Painted directional track chevrons on asphalt
    for (let i = 14; i < samples.length; i += 34) {
      const s = samples[i];
      if (s.isBridge || s.isUnderpass) continue;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(Math.atan2(s.ty, s.tx));
      ctx.fillStyle = isMono ? 'rgba(255,255,255,0.16)' : 'rgba(250, 204, 21, 0.24)';
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-8, -14);
      ctx.lineTo(-2, -14);
      ctx.lineTo(20, 0);
      ctx.lineTo(-2, 14);
      ctx.lineTo(-8, 14);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 4. Tire Wall Stacks along tight apexes!
    for (const ts of this.compiledTrack.tireStacks) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.arc(ts.x + 2, ts.y + 3, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ts.color;
      ctx.beginPath();
      ctx.arc(ts.x, ts.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(ts.x, ts.y, 3.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. Double-row Checkered Start/Finish Line & Overhead Steel Gantry
    const sf = this.compiledTrack.startSample;
    ctx.save();
    ctx.translate(sf.x, sf.y);
    ctx.rotate(Math.atan2(sf.ty, sf.tx));
    const halfW = bp.roadWidth * 0.49;
    const sq = 11;
    const rows = Math.floor((halfW * 2) / sq);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 2; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#FFFFFF' : '#0F172A';
        ctx.fillRect(-sq + c * sq, -halfW + r * sq, sq, sq);
      }
    }
    ctx.restore();
    ctx.restore();
  }

  private addScore(pts: number, x?: number, y?: number, color = '#FACC15'): void {
    if (this.phase === 'TITLE') return;
    this.score += pts;
    if (Math.floor(this.score) > this.highScore) {
      this.highScore = Math.floor(this.score);
      saveHighScore(this.storageKey, this.highScore);
    }
    if (x !== undefined && y !== undefined && pts >= 100) {
      this.popups.push({ x, y, text: `+${pts}`, color, life: 0.95, maxLife: 0.95 });
    }
  }

  private paintSkidmark(car: RacerCar, oily: boolean): void {
    if (!this.skidCtx || car.onBridge) return;
    const cos = Math.cos(car.angle);
    const sin = Math.sin(car.angle);
    // Rear left & right slick positions
    const rx = car.x - cos * 15;
    const ry = car.y - sin * 15;
    const nx = -sin * 9;
    const ny = cos * 9;

    this.skidCtx.fillStyle = oily ? 'rgba(15, 23, 42, 0.55)' : 'rgba(9, 13, 22, 0.34)';
    this.skidCtx.beginPath();
    this.skidCtx.arc(rx + nx, ry + ny, oily ? 3.5 : 2.6, 0, Math.PI * 2);
    this.skidCtx.arc(rx - nx, ry - ny, oily ? 3.5 : 2.6, 0, Math.PI * 2);
    this.skidCtx.fill();
  }

  private applyPitUpgrade(choice: number): void {
    if (choice === 0) this.speedStat = Math.min(5, this.speedStat + 1);
    else if (choice === 1) this.accelStat = Math.min(5, this.accelStat + 1);
    else this.tractionStat = Math.min(5, this.tractionStat + 1);

    if (this.variant === 'superoffroad' || this.variant === 'indyheat') {
      this.cash = Math.max(0, this.cash - 1500);
      if (this.variant === 'superoffroad') this.nitros += 2;
    } else {
      this.wrenches = Math.max(0, this.wrenches - 2);
    }
    arcadeAudio.playPowerUp();
    this.inPitShop = false;
    this.advanceToNextRace();
  }

  private advanceToNextRace(): void {
    this.raceNum += 1;
    this.setupRace(this.raceNum);
    this.phase = 'READY';
    this.phaseTimer = 1.65;
    this.countdownStage = 3;
    this.bannerText = `RACE ${this.raceNum} · ${this.compiledTrack.blueprint.name.toUpperCase()}`;
  }

  public step(dt: number): void {
    this.time += dt;
    stepParticlesAndPopups(this.particles, this.popups, dt);

    if (this.phase === 'PAUSED' || this.phase === 'GAME_OVER') return;

    // Interactive Super Sprint / Championship Sprint Pit Tune-Up Shop between races!
    if (this.inPitShop) {
      this.pitShopTimer -= dt;
      this.pitNavCd = Math.max(0, this.pitNavCd - dt);
      if (this.pitNavCd <= 0) {
        if (this.input.left) {
          this.pitShopCursor = (this.pitShopCursor + 2) % 3;
          this.pitNavCd = 0.18;
          arcadeAudio.playCoin();
        } else if (this.input.right) {
          this.pitShopCursor = (this.pitShopCursor + 1) % 3;
          this.pitNavCd = 0.18;
          arcadeAudio.playCoin();
        }
      }
      if (this.input.fireJustPressed || this.pitShopTimer <= 0) {
        this.applyPitUpgrade(this.pitShopCursor);
      }
      return;
    }

    if (this.phase === 'READY') {
      this.phaseTimer -= dt;
      const newStage = this.phaseTimer > 1.1 ? 3 : this.phaseTimer > 0.55 ? 2 : 1;
      if (newStage !== this.countdownStage) {
        this.countdownStage = newStage;
        arcadeAudio.playCoin();
      }
      if (this.phaseTimer <= 0) {
        this.phase = 'PLAYING';
        this.countdownStage = 0;
        this.bannerText = '';
        arcadeAudio.playPowerUp();
      }
      return;
    }

    if (this.phase === 'STAGE_CLEAR') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        const canShop =
          this.variant === 'superoffroad' || this.variant === 'indyheat'
            ? this.cash >= 1500
            : !this.isClassicGearVariant() && this.wrenches >= 2;
        if (canShop) {
          this.inPitShop = true;
          this.pitShopCursor = 0;
          this.pitShopTimer = 4.5;
          this.bannerText = '';
          return;
        }
        this.advanceToNextRace();
      }
      return;
    }

    const isAttract = this.phase === 'TITLE';
    const bp = this.compiledTrack.blueprint;
    const samples = this.compiledTrack.samples;
    const n = samples.length;

    if (bp.shortcut) {
      const cyc = (this.time % (bp.shortcut.cycleSeconds * 2)) / bp.shortcut.cycleSeconds;
      if (cyc < 0.72) this.shortcutState = 'open';
      else if (cyc < 1.0) this.shortcutState = 'warning';
      else this.shortcutState = 'closed';
    } else {
      this.shortcutState = 'closed';
    }

    if (this.boostTimer > 0) this.boostTimer = Math.max(0, this.boostTimer - dt);
    if (this.boostCooldown > 0) this.boostCooldown = Math.max(0, this.boostCooldown - dt);
    if (this.cannonCooldown > 0) this.cannonCooldown = Math.max(0, this.cannonCooldown - dt);
    if (this.indyOverheatTimer > 0) this.indyOverheatTimer = Math.max(0, this.indyOverheatTimer - dt);
    if (this.pitPopupCooldown > 0) this.pitPopupCooldown = Math.max(0, this.pitPopupCooldown - dt);

    // Move roaming Mini-Tornado smoothly
    for (const h of this.hazards) {
      if (h.kind === 'tornado') {
        h.x += h.vx * dt;
        h.y += h.vy * dt;
        if (h.x < 170 || h.x > SPRINT_W - 170) h.vx = -h.vx;
        if (h.y < 150 || h.y > SPRINT_H - 140) h.vy = -h.vy;
      }
    }

    // Step Badlands roof-cannon projectiles (detonate land mines & spin out rivals!)
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const sh = this.shots[i];
      sh.x += sh.vx * dt;
      sh.y += sh.vy * dt;
      sh.life -= dt;
      let hit = sh.life <= 0 || sh.x < 20 || sh.x > SPRINT_W - 20 || sh.y < 44 || sh.y > SPRINT_H - 20;

      if (!hit) {
        for (const h of this.hazards) {
          if (h.kind !== 'mine' || !h.active || h.onBridge !== sh.onBridge) continue;
          if (Math.hypot(sh.x - h.x, sh.y - h.y) < h.radius + 10) {
            h.active = false;
            hit = true;
            spawnBurst(this.particles, h.x, h.y, '#F97316', 20, 210, 3.8);
            spawnBurst(this.particles, h.x, h.y, '#FACC15', 12, 160, 2.8);
            if (!isAttract) {
              arcadeAudio.playExplosion(false);
              this.addScore(200, h.x, h.y, '#F97316');
            }
            break;
          }
        }
      }
      if (!hit) {
        for (const c of this.cars) {
          if (c.id === sh.ownerId || c.crashTimer > 0 || c.onBridge !== sh.onBridge) continue;
          if (Math.hypot(sh.x - c.x, sh.y - c.y) < 24) {
            hit = true;
            c.spinTimer = 0.65;
            c.spinDir = Math.random() > 0.5 ? 1 : -1;
            spawnBurst(this.particles, c.x, c.y, '#FACC15', 16, 190, 3.2);
            if (sh.ownerId === 0 && !isAttract) {
              arcadeAudio.playExplosion(false);
              this.addScore(300, c.x, c.y, '#FACC15');
              this.popups.push({ x: c.x, y: c.y - 24, text: 'BLASTED!', color: '#F97316', life: 0.8, maxLife: 0.8 });
            }
            break;
          }
        }
      }
      if (hit) this.shots.splice(i, 1);
    }

    // Update all racers (4 cars normally, 8 cars in Sprint 8!)
    for (const car of this.cars) {
      if (car.hazardCooldown > 0) car.hazardCooldown = Math.max(0, car.hazardCooldown - dt);
      if (car.waterTimer > 0) car.waterTimer = Math.max(0, car.waterTimer - dt);
      if (car.jumpCooldown > 0) car.jumpCooldown = Math.max(0, car.jumpCooldown - dt);

      // Super Off Road 3D dirt jump arc physics!
      if (car.jumpZ > 0 || car.jumpVz !== 0) {
        car.jumpZ += car.jumpVz * dt;
        car.jumpVz -= 420 * dt;
        if (car.jumpZ <= 0) {
          car.jumpZ = 0;
          car.jumpVz = 0;
          spawnBurst(this.particles, car.x, car.y, '#D97706', 10, 120, 3);
        }
      }

      // Rescue Helicopter drop-in after a heavy wall crash!
      if (car.crashTimer > 0) {
        car.crashTimer -= dt;
        const target = samples[car.sampleIdx];
        car.heliX += (target.x - car.heliX) * Math.min(1, dt * 6);
        car.heliY += (target.y - car.heliY) * Math.min(1, dt * 6);
        if (car.crashTimer <= 0) {
          car.x = target.x;
          car.y = target.y;
          car.vx = target.tx * 70;
          car.vy = target.ty * 70;
          car.angle = Math.atan2(target.ty, target.tx);
          car.onBridge = target.isBridge;
          car.hazardCooldown = 1.4;
        }
        continue;
      }

      const indyPenalty =
        this.variant === 'indyheat' && car.isPlayer
          ? this.indyOverheatTimer > 0
            ? 0.62
            : this.indyFuel <= 0
              ? 0.54
              : 1
          : 1;
      const boostMult =
        this.boostTimer > 0
          ? this.variant === 'superoffroad'
            ? 1.32
            : this.variant === 'indyheat'
              ? 1.24
              : 1.18
          : 1;

      const maxSpeed = car.isPlayer
        ? (335 + this.speedStat * 24) * boostMult * indyPenalty
        : 318 * car.aiSpeedBias;
      const accel = car.isPlayer ? 320 + this.accelStat * 34 : 310 * car.aiSpeedBias;
      const grip = car.isPlayer
        ? (this.variant === 'superoffroad' ? 4.8 : 5.6) + this.tractionStat * 0.95
        : 6.4;
      const turnRate = car.isPlayer ? 3.55 + this.tractionStat * 0.2 : 4.2;

      // FIXED OIL / MINE SPINOUT: car slides cleanly forward OFF the hazard while spinning!
      if (car.spinTimer > 0) {
        car.spinTimer -= dt;
        car.angle += car.spinDir * 12.2 * dt;
        const curSpd = Math.hypot(car.vx, car.vy);
        if (curSpd < 90) {
          const sp = samples[car.sampleIdx];
          car.vx += sp.tx * 120 * dt;
          car.vy += sp.ty * 120 * dt;
        }
        car.vx *= Math.pow(0.45, dt);
        car.vy *= Math.pow(0.45, dt);
        if (Math.random() < 0.75) this.paintSkidmark(car, true);
      } else if (car.isPlayer && !isAttract) {
        const steer = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
        car.steerVisual += (steer - car.steerVisual) * Math.min(1, dt * 14);
        const speedMag = Math.hypot(car.vx, car.vy);
        const steerFactor = Math.min(1, 0.42 + speedMag / 220);
        car.angle += steer * turnRate * steerFactor * dt;

        // Variant-specific Secondary Action (N2O Nitro / Indy Turbo / Thruster Boost)
        if (this.input.secondaryJustPressed) {
          if (this.variant === 'superoffroad') {
            if (this.nitros > 0 && this.boostTimer <= 0.1) {
              this.nitros -= 1;
              this.boostTimer = 0.85;
              arcadeAudio.playPowerUp();
              this.popups.push({ x: car.x, y: car.y - 24, text: 'N2O NITRO!', color: '#38BDF8', life: 0.7, maxLife: 0.7 });
            }
          } else if (this.variant === 'indyheat') {
            if (this.indyOverheatTimer <= 0 && this.indyFuel > 4 && this.boostCooldown <= 0) {
              this.boostTimer = 0.75;
              this.boostCooldown = 1.6;
              this.indyHeat = Math.min(100, this.indyHeat + Math.max(12, 26 - this.tractionStat * 3));
              arcadeAudio.playPowerUp();
              if (this.indyHeat >= 100) {
                this.indyOverheatTimer = 2.0;
                this.popups.push({ x: car.x, y: car.y - 26, text: 'ENGINE OVERHEAT!', color: '#EF4444', life: 1.0, maxLife: 1.0 });
              }
            }
          } else if (this.boostCooldown <= 0) {
            this.boostTimer = 0.65;
            this.boostCooldown = 3.2;
            arcadeAudio.playPowerUp();
          }
        }

        // Badlands Mounted Roof Cannon (Fire / Space)!
        if (this.variant === 'badlands' && this.input.fire && this.cannonCooldown <= 0) {
          const fx0 = Math.cos(car.angle);
          const fy0 = Math.sin(car.angle);
          const shotSpd = 680;
          const twinShot = this.accelStat >= 2;
          const offsets = twinShot ? [-6, 6] : [0];
          for (const latOff of offsets) {
            this.shots.push({
              x: car.x + fx0 * 24 - fy0 * latOff,
              y: car.y + fy0 * 24 + fx0 * latOff,
              vx: fx0 * shotSpd + car.vx * 0.25,
              vy: fy0 * shotSpd + car.vy * 0.25,
              life: 0.75,
              ownerId: car.id,
              onBridge: car.onBridge,
            });
          }
          this.cannonCooldown = Math.max(0.14, 0.32 - this.accelStat * 0.035);
          arcadeAudio.playLaser();
        }

        const fx = Math.cos(car.angle);
        const fy = Math.sin(car.angle);
        const gasPressed = this.input.up || this.input.fire;
        if (gasPressed && !this.input.down) {
          car.vx += fx * accel * dt;
          car.vy += fy * accel * dt;
          if (this.variant === 'indyheat') {
            this.indyFuel = Math.max(0, this.indyFuel - (2.4 - this.tractionStat * 0.2) * dt);
            this.indyHeat = Math.max(0, this.indyHeat - (4.5 + this.tractionStat * 1.2) * dt);
          }
        } else if (this.input.down) {
          car.vx -= fx * 360 * dt;
          car.vy -= fy * 360 * dt;
        } else {
          car.vx *= Math.pow(0.32, dt);
          car.vy *= Math.pow(0.32, dt);
          if (this.variant === 'indyheat') {
            this.indyHeat = Math.max(0, this.indyHeat - (14 + this.tractionStat * 2) * dt);
          }
        }

        const effGrip = car.waterTimer > 0 ? grip * 0.42 : grip;
        const forwardVel = car.vx * fx + car.vy * fy;
        const lateralVel = -car.vx * fy + car.vy * fx;
        const dampedLat = lateralVel * Math.exp(-effGrip * dt);
        const waterCap =
          this.variant === 'superoffroad' && this.boostTimer > 0
            ? maxSpeed * 0.92
            : maxSpeed * (this.variant === 'superoffroad' ? 0.56 + this.tractionStat * 0.04 : 0.66);
        const clampedFwd = Math.max(-95, Math.min(car.waterTimer > 0 ? waterCap : maxSpeed, forwardVel));

        car.vx = fx * clampedFwd - fy * dampedLat;
        car.vy = fy * clampedFwd + fx * dampedLat;

        // Drift skidmarks & dirt/smoke rooster tails
        if (car.jumpZ <= 0 && Math.abs(lateralVel) > 55 && speedMag > 140) {
          this.paintSkidmark(car, false);
          if (Math.random() < 0.35) {
            this.particles.push({
              x: car.x - fx * 16,
              y: car.y - fy * 16,
              vx: -fx * 20 + (Math.random() - 0.5) * 30,
              vy: -fy * 20 + (Math.random() - 0.5) * 30,
              color:
                this.variant === 'superoffroad'
                  ? '#D97706'
                  : car.waterTimer > 0
                    ? '#BAE6FD'
                    : '#CBD5E1',
              radius: 4.5,
              life: 0.35,
              maxLife: 0.35,
            });
          }
        }
      } else {
        // Competitive AI steering along lookahead + hazard dodging
        const lookIdx = (car.sampleIdx + 7) % n;
        const look = samples[lookIdx];
        let tx = look.x + look.nx * car.aiLaneOffset;
        let ty = look.y + look.ny * car.aiLaneOffset;

        for (const h of this.hazards) {
          if ((h.kind === 'oil' || (h.kind === 'mine' && h.active)) && Math.hypot(tx - h.x, ty - h.y) < h.radius + 26) {
            tx += look.nx * (car.aiLaneOffset >= 0 ? -36 : 36);
            ty += look.ny * (car.aiLaneOffset >= 0 ? -36 : 36);
          }
        }

        const desired = Math.atan2(ty - car.y, tx - car.x);
        let diff = desired - car.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        car.steerVisual = Math.max(-1, Math.min(1, diff * 1.5));
        car.angle += Math.sign(diff) * Math.min(Math.abs(diff), turnRate * dt);

        const fx = Math.cos(car.angle);
        const fy = Math.sin(car.angle);
        const cornerSlow = Math.abs(diff) > 0.58 ? 0.72 : 1.0;
        const cap = (car.waterTimer > 0 ? maxSpeed * 0.68 : maxSpeed) * cornerSlow;
        const curFwd = car.vx * fx + car.vy * fy;
        const nextFwd = Math.min(cap, curFwd + accel * dt);
        const lat = (-car.vx * fy + car.vy * fx) * Math.exp(-grip * dt);
        car.vx = fx * nextFwd - fy * lat;
        car.vy = fy * nextFwd + fx * lat;
      }

      // Integrate Position + Continuous Segment Wall Sliding (silky-smooth on curves, ramps & bridges!)
      const nx = car.x + car.vx * dt;
      const ny = car.y + car.vy * dt;
      const inShortcut = Boolean(
        bp.shortcut && this.shortcutState !== 'closed' && isPointInShortcut(bp.shortcut, nx, ny)
      );
      const wasInShortcut = Boolean(bp.shortcut && isPointInShortcut(bp.shortcut, car.x, car.y));
      const proj = projectOntoTrack(
        this.compiledTrack,
        nx,
        ny,
        car.onBridge,
        car.sampleIdx,
        inShortcut || wasInShortcut
      );
      const halfRoad = bp.roadWidth * 0.5 - 14;

      if (proj.dist <= halfRoad || inShortcut) {
        car.x = nx;
        car.y = ny;
        car.sampleIdx = proj.sampleIdx;
        car.onBridge = inShortcut ? false : proj.sample.isBridge;
      } else {
        const sign = proj.signedOffset >= 0 ? 1 : -1;
        const impactNormalSpd = Math.abs(car.vx * proj.nx + car.vy * proj.ny);
        car.x = proj.cx + proj.nx * sign * (halfRoad - 1);
        car.y = proj.cy + proj.ny * sign * (halfRoad - 1);
        car.sampleIdx = proj.sampleIdx;
        car.onBridge = proj.sample.isBridge;

        if (!this.isClassicGearVariant() && this.variant !== 'superoffroad' && !isAttract && impactNormalSpd > 265 && car.spinTimer <= 0) {
          spawnBurst(this.particles, car.x, car.y, '#F97316', 24, 240, 4);
          spawnBurst(this.particles, car.x, car.y, '#FACC15', 14, 180, 3);
          if (car.isPlayer) arcadeAudio.playExplosion(true);
          car.crashTimer = 0.85;
          car.vx = 0;
          car.vy = 0;
          car.heliX = car.x - 160;
          car.heliY = car.y - 220;
          continue;
        }

        const tangVel = (car.vx * proj.tx + car.vy * proj.ty) * 0.78;
        car.vx = proj.tx * tangVel - proj.nx * sign * 24;
        car.vy = proj.ty * tangVel - proj.ny * sign * 24;
        if (car.isPlayer && !isAttract && impactNormalSpd > 75) {
          arcadeAudio.playScreech();
          spawnBurst(this.particles, car.x, car.y, '#FACC15', 6, 120, 2.5);
        }
      }

      // Super Off Road Tabletop Dirt Jumps!
      if (bp.jumpSpots && car.jumpZ <= 0 && car.jumpCooldown <= 0) {
        const carT = samples[car.sampleIdx].t;
        const curSpd = Math.hypot(car.vx, car.vy);
        if (curSpd > 140) {
          for (const j of bp.jumpSpots) {
            let dtJ = Math.abs(carT - j.t);
            dtJ = Math.min(dtJ, 1 - dtJ);
            if (dtJ < 0.016) {
              car.jumpZ = 1;
              car.jumpVz = Math.min(230, 115 + curSpd * 0.28 + (car.isPlayer ? this.accelStat * 10 : 0));
              car.jumpCooldown = 0.9;
              spawnBurst(this.particles, car.x, car.y, '#F59E0B', 10, 140, 3);
              if (car.isPlayer && !isAttract) arcadeAudio.playJump();
              break;
            }
          }
        }
      }

      // Indy Heat Live Pit Lane Service (Refuel & Rapid Engine Cooling!)
      if (bp.pitLane && car.isPlayer && !isAttract) {
        const carT = samples[car.sampleIdx].t;
        const onSide = proj.signedOffset * bp.pitLane.side > bp.roadWidth * 0.14;
        if (carT >= bp.pitLane.startT && carT <= bp.pitLane.endT && onSide) {
          if (this.indyFuel < 99 || this.indyHeat > 5) {
            this.indyFuel = Math.min(100, this.indyFuel + 68 * dt);
            this.indyHeat = Math.max(0, this.indyHeat - 95 * dt);
            this.indyOverheatTimer = 0;
            if (Math.random() < 0.35) {
              spawnBurst(this.particles, car.x, car.y, '#4ADE80', 4, 90, 2.5);
            }
            if (this.pitPopupCooldown <= 0) {
              this.pitPopupCooldown = 1.4;
              arcadeAudio.playKeyUnlock();
              this.popups.push({ x: car.x, y: car.y - 26, text: 'PIT SERVICE · FUEL & COOL!', color: '#4ADE80', life: 0.9, maxLife: 0.9 });
            }
          }
        }
      }

      // Hazard Collisions (airborne Off-Road trucks fly cleanly OVER mud & hazards!)
      if (car.hazardCooldown <= 0 && car.jumpZ <= 2) {
        for (const h of this.hazards) {
          if (h.active === false) continue;
          if (h.kind !== 'tornado' && h.onBridge !== car.onBridge) continue;
          const d = Math.hypot(car.x - h.x, car.y - h.y);
          if (d < h.radius + 10) {
            if (h.kind === 'oil') {
              car.spinTimer = 0.6;
              car.spinDir = Math.random() > 0.5 ? 1 : -1;
              car.hazardCooldown = 1.65;
              const spd = Math.hypot(car.vx, car.vy);
              if (spd < 145) {
                const sp = samples[car.sampleIdx];
                car.vx = sp.tx * 165;
                car.vy = sp.ty * 165;
              }
              if (car.isPlayer && !isAttract) {
                arcadeAudio.playScreech();
                this.popups.push({ x: car.x, y: car.y - 24, text: 'OIL SLICK!', color: '#C084FC', life: 0.75, maxLife: 0.75 });
              }
            } else if (h.kind === 'water') {
              car.waterTimer = this.variant === 'superoffroad' ? 0.9 : 0.75;
              car.hazardCooldown = 1.15;
              car.angle += (Math.random() - 0.5) * 0.22;
              spawnBurst(
                this.particles,
                car.x,
                car.y,
                this.variant === 'superoffroad' ? '#78350F' : '#38BDF8',
                14,
                150,
                3.2
              );
              if (car.isPlayer && !isAttract) arcadeAudio.playScreech();
            } else if (h.kind === 'mine') {
              h.active = false;
              car.spinTimer = 0.7;
              car.spinDir = Math.random() > 0.5 ? 1 : -1;
              car.hazardCooldown = 1.65;
              spawnBurst(this.particles, h.x, h.y, '#EF4444', 24, 240, 4);
              spawnBurst(this.particles, h.x, h.y, '#FACC15', 14, 180, 3);
              if (car.isPlayer && !isAttract) {
                arcadeAudio.playExplosion(true);
                this.popups.push({ x: car.x, y: car.y - 24, text: 'MINE BLAST!', color: '#EF4444', life: 0.85, maxLife: 0.85 });
              }
            } else {
              car.spinTimer = 0.72;
              car.spinDir = 1;
              car.hazardCooldown = 1.85;
              const pushAng = Math.atan2(car.y - h.y, car.x - h.x);
              car.vx = Math.cos(pushAng) * 210;
              car.vy = Math.sin(pushAng) * 210;
              spawnBurst(this.particles, car.x, car.y, '#E2E8F0', 18, 200, 3);
              if (car.isPlayer && !isAttract) arcadeAudio.playScreech();
            }
            break;
          }
        }
      }

      // Golden Wrench / Cash / N2O Nitro Pickups
      if (car.isPlayer) {
        for (const p of this.pickups) {
          if (!p.active || p.onBridge !== car.onBridge) continue;
          if (Math.hypot(car.x - p.x, car.y - p.y) < 32) {
            p.active = false;
            if (!isAttract) arcadeAudio.playKeyUnlock();
            if (p.kind === 'wrench') {
              this.wrenches += 1;
              this.addScore(500, p.x, p.y, '#FACC15');
              this.popups.push({ x: p.x, y: p.y - 24, text: `WRENCH! (${this.wrenches})`, color: '#FACC15', life: 1.0, maxLife: 1.0 });
            } else if (p.kind === 'nitro') {
              this.nitros += 2;
              this.addScore(250, p.x, p.y, '#38BDF8');
              this.popups.push({ x: p.x, y: p.y - 24, text: '+2 N2O NITRO!', color: '#38BDF8', life: 0.9, maxLife: 0.9 });
            } else if (p.kind === 'cash') {
              this.cash += p.points;
              this.addScore(p.points, p.x, p.y, '#4ADE80');
              this.popups.push({ x: p.x, y: p.y - 24, text: `+$${p.points}`, color: '#4ADE80', life: 0.9, maxLife: 0.9 });
            } else {
              this.addScore(p.points, p.x, p.y, '#4ADE80');
            }
          }
        }
      }

      // Quarter-track checkpoint progression for rock-solid lap counting
      const t = samples[car.sampleIdx].t;
      if (car.checkpointsHit === 0 && t > 0.2 && t < 0.45) car.checkpointsHit = 1;
      else if (car.checkpointsHit <= 1 && t > 0.45 && t < 0.72) car.checkpointsHit = 2;
      else if (car.checkpointsHit === 2 && t > 0.72 && t < 0.94) car.checkpointsHit = 3;
      else if (car.checkpointsHit === 3 && t < 0.14) {
        car.checkpointsHit = 0;
        car.lap += 1;
        if (car.isPlayer && !isAttract) {
          this.addScore(500, car.x, car.y, '#38BDF8');
          arcadeAudio.playKeyUnlock();
          for (const p of this.pickups) {
            if (p.kind === 'bonus' || p.kind === 'nitro' || p.kind === 'cash') p.active = true;
          }
          // Re-arm Badlands mines on fresh lap
          for (const h of this.hazards) {
            if (h.kind === 'mine') h.active = true;
          }
        }
        if (car.lap > 3) {
          if (isAttract) {
            this.setupRace(1);
            return;
          }
          if (car.isPlayer) {
            arcadeAudio.playStageClear();
            const prize = 2000 + this.raceNum * 500;
            this.cash += 1500;
            this.addScore(prize, car.x, car.y, '#4ADE80');
            this.phase = 'STAGE_CLEAR';
            this.phaseTimer = 1.65;
            this.bannerText = 'CHECKERED FLAG · 1ST PLACE!';
            return;
          } else {
            arcadeAudio.playDeath();
            this.phase = 'GAME_OVER';
            this.bannerText = `${car.name.toUpperCase()} WINS!`;
            return;
          }
        }
      }

      car.progress = car.lap * 1000 + car.checkpointsHit * 200 + t * 200;
    }

    // Car-to-Car elastic fender bumping (only same elevation deck & not jumping over!)
    for (let i = 0; i < this.cars.length; i++) {
      for (let j = i + 1; j < this.cars.length; j++) {
        const a = this.cars[i];
        const b = this.cars[j];
        if (a.crashTimer > 0 || b.crashTimer > 0 || a.onBridge !== b.onBridge) continue;
        if (Math.abs(a.jumpZ - b.jumpZ) > 16) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minDist = this.variant === 'sprint8' ? 27 : 30;
        if (dist > 0.01 && dist < minDist) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = (minDist - dist) * 0.5;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;
          const rvx = b.vx - a.vx;
          const rvy = b.vy - a.vy;
          const sepVel = rvx * nx + rvy * ny;
          if (sepVel < 0) {
            const imp = -sepVel * 0.65;
            a.vx -= nx * imp;
            a.vy -= ny * imp;
            b.vx += nx * imp;
            b.vy += ny * imp;
            if ((a.isPlayer || b.isPlayer) && !isAttract && imp > 45) {
              arcadeAudio.playPaddleBounce();
              spawnBurst(this.particles, (a.x + b.x) * 0.5, (a.y + b.y) * 0.5, '#FACC15', 5, 110, 2);
            }
          }
        }
      }
    }
  }

  public getHudSnapshot(): ClassicGameHud {
    const player = this.cars[0];
    const sorted = [...this.cars].sort((a, b) => b.progress - a.progress);
    const place = sorted.findIndex((c) => c.isPlayer) + 1;
    const suffix = place === 1 ? 'st' : place === 2 ? 'nd' : place === 3 ? 'rd' : 'th';
    const placeLabel = `${place}${suffix}`;
    const totalCars = this.cars.length;
    const spd = player ? Math.hypot(player.vx, player.vy) : 0;
    const gear = spd < 95 ? 1 : spd < 185 ? 2 : spd < 275 ? 3 : 4;

    let secLabel = 'Wrenches / Tune';
    let secVal = `${this.wrenches}W · S${this.speedStat}/A${this.accelStat}/T${this.tractionStat}`;
    if (this.isClassicGearVariant()) {
      secLabel = 'Speed';
      secVal = `${Math.round(spd * 0.48)} MPH`;
    } else if (this.variant === 'superoffroad') {
      secLabel = 'Cash / N2O';
      secVal = `$${this.cash} · ${this.nitros} N2O`;
    } else if (this.variant === 'indyheat') {
      secLabel = 'Fuel / Heat';
      secVal = `F:${Math.round(this.indyFuel)}% · H:${Math.round(this.indyHeat)}%`;
    }

    return {
      phase: this.phase,
      score: Math.floor(this.score),
      highScore: this.highScore,
      level: this.raceNum,
      lives: Math.max(1, 4 - (player?.lap ?? 1)),
      stageName: `${this.compiledTrack.blueprint.name} · Lap ${Math.min(3, player?.lap ?? 1)}/3`,
      primaryMetricLabel: this.isClassicGearVariant() ? 'Pos / Gear' : 'Position',
      primaryMetricValue: this.isClassicGearVariant() ? `${placeLabel}/${totalCars} · G${gear}` : `${placeLabel} of ${totalCars}`,
      secondaryMetricLabel: secLabel,
      secondaryMetricValue: secVal,
      bannerText: this.bannerText,
    };
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bp = this.compiledTrack.blueprint;
    const isMono = this.isMonoVariant();

    if (this.trackCanvas) {
      ctx.drawImage(this.trackCanvas, 0, 0);
    } else {
      ctx.fillStyle = bp.infieldColor;
      ctx.fillRect(0, 0, SPRINT_W, SPRINT_H);
    }

    if (this.skidCanvas) {
      ctx.drawImage(this.skidCanvas, 0, 0);
    }

    if (bp.shortcut) {
      this.renderShortcutGate(ctx, bp.shortcut);
    }

    this.renderHazards(ctx, false);
    this.renderPickups(ctx, false);

    for (const car of this.cars) {
      if (!car.onBridge) this.renderCar(ctx, car, isMono);
    }

    if (bp.bridgeRanges && bp.bridgeRanges.length > 0) {
      this.renderOverpassDeck(ctx);
      this.renderHazards(ctx, true);
      this.renderPickups(ctx, true);
      for (const car of this.cars) {
        if (car.onBridge) this.renderCar(ctx, car, isMono);
      }
    }

    // Badlands plasma roof-cannon rounds
    if (this.shots.length > 0) {
      ctx.save();
      for (const sh of this.shots) {
        ctx.shadowColor = '#FACC15';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(sh.x, sh.y, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#F97316';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(sh.x, sh.y);
        ctx.lineTo(sh.x - sh.vx * 0.025, sh.y - sh.vy * 0.025);
        ctx.stroke();
      }
      ctx.restore();
    }

    for (const h of this.hazards) {
      if (h.kind === 'tornado') this.renderTornado(ctx, h);
    }

    for (const car of this.cars) {
      if (car.crashTimer > 0) this.renderRescueHelicopter(ctx, car);
    }

    this.renderStartingGantry(ctx);

    renderParticlesAndPopups(ctx, this.particles, this.popups);

    // 10. Crisp High-Res Arcade Top Telemetry Bar (4-Speed Tachometer / Lap / Wrenches!)
    this.renderTopTelemetryBar(ctx, isMono);

    // 11. Interactive Pit Tune-Up Shop Overlay (Super Sprint / Championship Sprint!)
    if (this.inPitShop) {
      this.renderPitShopOverlay(ctx);
    } else if (this.bannerText && (this.phase === 'READY' || this.phase === 'STAGE_CLEAR')) {
      ctx.save();
      ctx.font = '900 34px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(4, 6, 13, 0.88)';
      ctx.beginPath();
      ctx.roundRect(SPRINT_W * 0.16, SPRINT_H * 0.42, SPRINT_W * 0.68, 78, 12);
      ctx.fill();
      ctx.strokeStyle = isMono ? bp.wallOuterColor : '#FACC15';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = isMono ? bp.wallOuterColor : '#FACC15';
      ctx.fillText(this.bannerText, SPRINT_W * 0.5, SPRINT_H * 0.42 + 39);
      ctx.restore();
    }

    if (visualMode === 'crt') renderCrtOverlay(ctx, SPRINT_W, SPRINT_H);
  }

  private renderOverpassDeck(ctx: CanvasRenderingContext2D): void {
    const bp = this.compiledTrack.blueprint;
    const samples = this.compiledTrack.samples;
    const isMono = this.isMonoVariant();

    const traceBridge = () => {
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < samples.length; i++) {
        const s = samples[i];
        if (!s.isBridge) {
          started = false;
          continue;
        }
        if (!started) {
          ctx.moveTo(s.x, s.y);
          started = true;
        } else {
          ctx.lineTo(s.x, s.y);
        }
      }
    };

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'butt';

    // Elevated drop shadow cast down onto lower track!
    ctx.save();
    ctx.translate(14, 18);
    traceBridge();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.58)';
    ctx.lineWidth = bp.roadWidth + 24;
    ctx.stroke();
    ctx.restore();

    // Steel truss bridge guardrails
    traceBridge();
    ctx.strokeStyle = isMono ? '#F8FAFC' : '#FACC15';
    ctx.lineWidth = bp.roadWidth + 22;
    ctx.stroke();

    // Bridge road asphalt (slightly lighter sunlit deck!)
    traceBridge();
    ctx.strokeStyle = isMono ? '#1F2937' : '#475569';
    ctx.lineWidth = bp.roadWidth;
    ctx.stroke();

    // Steel expansion plank seams across overpass
    traceBridge();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = bp.roadWidth - 8;
    ctx.setLineDash([4, 22]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Bridge center line
    traceBridge();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([12, 16]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Sloped concrete/steel Ramp Thresholds at entry and exit of every Overpass Bridge!
    const len = samples.length;
    for (let i = 0; i < len; i++) {
      const s = samples[i];
      if (!s.isBridge) continue;
      const prev = samples[(i - 1 + len) % len];
      const next = samples[(i + 1) % len];
      if (!prev.isBridge || !next.isBridge) {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(Math.atan2(s.ty, s.tx));
        const halfW = bp.roadWidth * 0.49;
        // Steel expansion ramp joint + yellow/black warning stripes
        ctx.fillStyle = isMono ? '#CBD5E1' : '#FACC15';
        ctx.fillRect(-5, -halfW, 10, halfW * 2);
        ctx.fillStyle = '#0F172A';
        for (let y = -halfW + 6; y < halfW - 6; y += 16) {
          ctx.fillRect(-5, y, 10, 7);
        }
        ctx.restore();
      }
    }
    ctx.restore();
  }

  private renderShortcutGate(ctx: CanvasRenderingContext2D, sc: NonNullable<CompiledTrack['blueprint']['shortcut']>): void {
    const dx = sc.exit.x - sc.entry.x;
    const dy = sc.exit.y - sc.entry.y;
    const len = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);

    ctx.save();
    ctx.translate(sc.entry.x, sc.entry.y);
    ctx.rotate(ang);

    // Shortcut road deck
    ctx.fillStyle = this.shortcutState === 'closed' ? '#111827' : '#334155';
    ctx.fillRect(0, -sc.width * 0.5, len, sc.width);

    // Glowing chevron directional arrows when open / warning!
    const col =
      this.shortcutState === 'open'
        ? '#4ADE80'
        : this.shortcutState === 'warning'
          ? Math.floor(this.time * 12) % 2 === 0
            ? '#FACC15'
            : '#EF4444'
          : '#EF4444';

    if (this.shortcutState !== 'closed') {
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.52;
      for (let x = 50; x < len - 45; x += 58) {
        ctx.beginPath();
        ctx.moveTo(x + 16, 0);
        ctx.lineTo(x - 6, -18);
        ctx.lineTo(x, -18);
        ctx.lineTo(x + 22, 0);
        ctx.lineTo(x, 18);
        ctx.lineTo(x - 6, 18);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    ctx.strokeStyle = col;
    ctx.lineWidth = 4;
    ctx.strokeRect(0, -sc.width * 0.5, len, sc.width);

    // Animated pneumatic gate arms at entry & exit!
    ctx.fillStyle = col;
    for (const gx of [4, len - 14]) {
      if (this.shortcutState === 'closed') {
        ctx.fillRect(gx, -sc.width * 0.5, 10, sc.width);
      } else {
        ctx.fillRect(gx, -sc.width * 0.5 - 10, 12, 22);
        ctx.fillRect(gx, sc.width * 0.5 - 12, 12, 22);
      }
    }
    ctx.restore();
  }

  private renderHazards(ctx: CanvasRenderingContext2D, bridgePass: boolean): void {
    const isMono = this.isMonoVariant();
    const isOffRoad = this.variant === 'superoffroad';
    for (const h of this.hazards) {
      if (h.active === false || h.kind === 'tornado' || h.onBridge !== bridgePass) continue;
      ctx.save();
      ctx.translate(h.x, h.y);
      if (h.kind === 'oil') {
        const g = ctx.createRadialGradient(-5, -4, 3, 0, 0, h.radius);
        g.addColorStop(0, '#1E1B4B');
        g.addColorStop(0.55, '#05050A');
        g.addColorStop(0.84, '#312E81');
        g.addColorStop(1, '#0F172A');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(0, 0, h.radius * 1.15, h.radius * 0.78, 0.28, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = isMono ? '#94A3B8' : 'rgba(168, 85, 247, 0.75)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = isMono ? 'rgba(255,255,255,0.35)' : 'rgba(56, 189, 248, 0.5)';
        ctx.beginPath();
        ctx.ellipse(-h.radius * 0.34, -h.radius * 0.22, h.radius * 0.3, h.radius * 0.13, 0.3, 0, Math.PI * 2);
        ctx.fill();
      } else if (h.kind === 'water') {
        if (isOffRoad) {
          // Deep thick clay Mud Pit!
          ctx.fillStyle = 'rgba(69, 26, 3, 0.85)';
          ctx.beginPath();
          ctx.ellipse(0, 0, h.radius * 1.2, h.radius * 0.85, -0.15, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#92400E';
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.fillStyle = 'rgba(146, 64, 14, 0.65)';
          ctx.beginPath();
          ctx.ellipse(-h.radius * 0.25, -h.radius * 0.15, h.radius * 0.42, h.radius * 0.22, 0.2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = 'rgba(14, 165, 233, 0.55)';
          ctx.beginPath();
          ctx.ellipse(0, 0, h.radius * 1.15, h.radius * 0.78, -0.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(186, 230, 253, 0.85)';
          ctx.lineWidth = 2;
          ctx.stroke();
          const rip = ((this.time * 0.95) % 1) * h.radius;
          ctx.strokeStyle = `rgba(255,255,255,${0.75 - (rip / h.radius) * 0.75})`;
          ctx.beginPath();
          ctx.ellipse(0, 0, rip, rip * 0.68, -0.2, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (h.kind === 'mine') {
        // Badlands blinking armed land mine (shootable!)
        const blink = Math.floor(this.time * 8) % 2 === 0;
        ctx.fillStyle = '#1C1917';
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#78716C';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.fillStyle = blink ? '#EF4444' : '#7F1D1D';
        if (blink) {
          ctx.shadowColor = '#EF4444';
          ctx.shadowBlur = 14;
        }
        ctx.beginPath();
        ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    }
  }

  private renderTornado(ctx: CanvasRenderingContext2D, h: ActiveHazard): void {
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.fillStyle = 'rgba(148, 163, 184, 0.24)';
    ctx.beginPath();
    ctx.arc(0, 0, h.radius + 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#F8FAFC';
    ctx.lineWidth = 3;
    for (let r = 6; r <= h.radius; r += 5.5) {
      ctx.beginPath();
      ctx.arc(0, 0, r, this.time * 14 + r * 0.45, this.time * 14 + r * 0.45 + Math.PI * 1.3);
      ctx.stroke();
    }
    ctx.fillStyle = '#FACC15';
    for (let d = 0; d < 6; d++) {
      const a = this.time * 11 + (d / 6) * Math.PI * 2;
      ctx.fillRect(Math.cos(a) * (h.radius - 3) - 2, Math.sin(a) * (h.radius - 3) - 2, 4, 4);
    }
    ctx.restore();
  }

  private renderPickups(ctx: CanvasRenderingContext2D, bridgePass: boolean): void {
    for (const p of this.pickups) {
      if (!p.active || p.onBridge !== bridgePass) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.beginPath();
      ctx.ellipse(0, 10, 16, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      if (p.kind === 'wrench') {
        ctx.rotate(Math.sin(this.time * 4.5) * 0.35 - 0.3);
        ctx.shadowColor = '#FACC15';
        ctx.shadowBlur = 16;
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.roundRect(-13, -4, 26, 8, 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-14, 0, 8, 0.55, Math.PI * 2 - 0.55);
        ctx.lineTo(-11, 0);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.arc(14, 0, 8, Math.PI + 0.55, Math.PI - 0.55);
        ctx.lineTo(11, 0);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        drawStarGlint(ctx, -6, -5, 6, '#FFFFFF', 0.95);
      } else if (p.kind === 'nitro') {
        ctx.shadowColor = '#38BDF8';
        ctx.shadowBlur = 16;
        ctx.fillStyle = '#0284C7';
        ctx.beginPath();
        ctx.roundRect(-10, -14, 20, 28, 6);
        ctx.fill();
        ctx.strokeStyle = '#E0F2FE';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('N2O', 0, 1);
      } else if (p.kind === 'cash') {
        ctx.shadowColor = '#4ADE80';
        ctx.shadowBlur = 14;
        ctx.fillStyle = '#15803D';
        ctx.beginPath();
        ctx.roundRect(-16, -11, 32, 22, 4);
        ctx.fill();
        ctx.strokeStyle = '#86EFAC';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#FEF08A';
        ctx.font = '900 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$1K', 0, 1);
      } else {
        ctx.shadowColor = '#4ADE80';
        ctx.shadowBlur = 14;
        ctx.fillStyle = '#22C55E';
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+250', 0, 0.5);
      }
      ctx.restore();
    }
  }

  private renderCar(ctx: CanvasRenderingContext2D, car: RacerCar, isMono: boolean): void {
    if (car.crashTimer > 0) return;
    const rampH = this.compiledTrack.samples[car.sampleIdx]?.rampHeight ?? 0;
    const jumpFactor = Math.min(1.6, car.jumpZ / 36);
    const elevScale = 1 + rampH * 0.095 + jumpFactor * 0.22;
    ctx.save();
    ctx.translate(car.x, car.y - car.jumpZ * 0.45);
    ctx.scale(elevScale, elevScale);
    ctx.rotate(car.angle);

    const spd = Math.hypot(car.vx, car.vy);

    // High-res ground shadow (offsets dramatically during jumps & overpass ramps!)
    ctx.fillStyle = rampH > 0.1 || car.jumpZ > 1 ? 'rgba(0,0,0,0.48)' : 'rgba(0,0,0,0.42)';
    ctx.beginPath();
    ctx.ellipse(-2 - rampH * 3 - car.jumpZ * 0.25, 4 + rampH * 4 + car.jumpZ * 0.55, 24, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    if (this.variant === 'superoffroad') {
      // 4x4 STADIUM MONSTER PICKUP TRUCK SPRITE!
      ctx.fillStyle = '#090D16';
      ctx.beginPath();
      ctx.roundRect(-18, -17, 12, 7.5, 2);
      ctx.roundRect(-18, 9.5, 12, 7.5, 2);
      ctx.fill();
      for (const fy of [-13.5, 13.5]) {
        ctx.save();
        ctx.translate(10, fy);
        ctx.rotate(car.steerVisual * 0.45);
        ctx.fillStyle = '#090D16';
        ctx.beginPath();
        ctx.roundRect(-6, -3.6, 12, 7.2, 2);
        ctx.fill();
        ctx.restore();
      }
      // Truck body & pickup bed
      ctx.fillStyle = car.bodyColor;
      ctx.beginPath();
      ctx.roundRect(-21, -12, 42, 24, 5);
      ctx.fill();
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      // Rear bed recess
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(-19, -9, 13, 18);
      // Cab roof & windshield
      ctx.fillStyle = car.accentColor;
      ctx.fillRect(-4, -9.5, 13, 19);
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(6, -8, 5, 16);
      // Roll bar with 4 glowing yellow stadium KC floodlights!
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(-5, -10.5, 2.5, 21);
      ctx.fillStyle = '#FEF08A';
      for (const ly of [-7.5, -2.5, 2.5, 7.5]) {
        ctx.beginPath();
        ctx.arc(-2.5, ly, 1.9, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (this.variant === 'badlands') {
      // ARMORED MAD-MAX BATTLE BUGGY WITH TWIN ROOF CANNON!
      ctx.fillStyle = '#090D16';
      ctx.beginPath();
      ctx.roundRect(-19, -15.5, 11, 6.5, 2);
      ctx.roundRect(-19, 9, 11, 6.5, 2);
      ctx.fill();
      for (const fy of [-12.5, 12.5]) {
        ctx.save();
        ctx.translate(10, fy);
        ctx.rotate(car.steerVisual * 0.42);
        ctx.fillStyle = '#090D16';
        ctx.beginPath();
        ctx.roundRect(-5, -3, 10, 6, 1.5);
        ctx.fill();
        ctx.restore();
      }
      // Armored wedge chassis + spiked front ram
      ctx.fillStyle = car.bodyColor;
      ctx.beginPath();
      ctx.moveTo(-20, -11);
      ctx.lineTo(14, -10);
      ctx.lineTo(23, -5);
      ctx.lineTo(23, 5);
      ctx.lineTo(14, 10);
      ctx.lineTo(-20, 11);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#CBD5E1';
      ctx.fillRect(20, -9, 4, 18); // Front steel ram bumper
      // Armored cage & twin cannon barrels!
      ctx.fillStyle = '#1C1917';
      ctx.fillRect(-10, -7, 18, 14);
      ctx.fillStyle = car.accentColor;
      ctx.fillRect(-6, -5, 10, 10);
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(4, -3.5, 14, 2.4);
      ctx.fillRect(4, 1.1, 14, 2.4);
    } else {
      // SCULPTED OPEN-WHEEL INDY / F1 / SPRINT RACER!
      ctx.fillStyle = '#090D16';
      ctx.beginPath();
      ctx.roundRect(-19, -15, 11, 6, 2);
      ctx.roundRect(-19, 9, 11, 6, 2);
      ctx.fill();

      for (const fy of [-12.5, 12.5]) {
        ctx.save();
        ctx.translate(10, fy);
        ctx.rotate(car.steerVisual * 0.42);
        ctx.fillStyle = '#090D16';
        ctx.beginPath();
        ctx.roundRect(-5, -2.8, 10, 5.6, 1.5);
        ctx.fill();
        ctx.restore();
      }

      ctx.fillStyle = car.accentColor;
      ctx.fillRect(-22, -13.5, 5.5, 27);
      ctx.fillStyle = car.bodyColor;
      ctx.fillRect(-20.8, -11, 3.4, 22);

      ctx.fillStyle = car.bodyColor;
      ctx.beginPath();
      ctx.moveTo(-18, -9.5);
      ctx.lineTo(3, -10.5);
      ctx.lineTo(19, -4.2);
      ctx.lineTo(22.5, 0);
      ctx.lineTo(19, 4.2);
      ctx.lineTo(3, 10.5);
      ctx.lineTo(-18, 9.5);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#0F172A';
      ctx.fillRect(-6, -9.2, 6, 2.8);
      ctx.fillRect(-6, 6.4, 6, 2.8);

      ctx.fillStyle = car.accentColor;
      ctx.fillRect(18, -10.5, 4.2, 21);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fillRect(-13, -2, 30, 4);

      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.ellipse(-2.5, 0, 7, 5.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = car.helmetColor;
      ctx.beginPath();
      ctx.arc(-3, 0, 4.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(-0.5, -2.8, 2.8, 5.6);
    }

    if (car.spinTimer > 0) {
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 23, this.time * 20, this.time * 20 + Math.PI * 0.9);
      ctx.stroke();
    } else if (car.isPlayer && (spd > 245 || this.boostTimer > 0)) {
      ctx.fillStyle = this.boostTimer > 0 ? '#38BDF8' : isMono ? '#F8FAFC' : '#F97316';
      ctx.beginPath();
      ctx.ellipse(-25, 0, 5.5 + Math.random() * 3, 2.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderRescueHelicopter(ctx: CanvasRenderingContext2D, car: RacerCar): void {
    ctx.save();
    ctx.translate(car.heliX, car.heliY);
    // Helicopter body
    ctx.fillStyle = '#FACC15';
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 24, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(-42, -3, 22, 6);
    ctx.fillStyle = '#38BDF8';
    ctx.beginPath();
    ctx.ellipse(10, 0, 9, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // Spinning rotor blades!
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.85)';
    ctx.lineWidth = 3;
    for (let k = 0; k < 2; k++) {
      const a = this.time * 28 + k * Math.PI * 0.5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * -36, Math.sin(a) * -36);
      ctx.lineTo(Math.cos(a) * 36, Math.sin(a) * 36);
      ctx.stroke();
    }
    ctx.restore();
  }

  private renderStartingGantry(ctx: CanvasRenderingContext2D): void {
    const sf = this.compiledTrack.startSample;
    const halfW = this.compiledTrack.blueprint.roadWidth * 0.5 + 16;
    ctx.save();
    ctx.translate(sf.x, sf.y);
    ctx.rotate(Math.atan2(sf.ty, sf.tx));

    // Overhead steel starting truss
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(-10, -halfW, 20, halfW * 2);
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 2;
    ctx.strokeRect(-10, -halfW, 20, halfW * 2);

    // 3-Stage Starting Lights (Red -> Yellow -> Green!)
    const lights = [
      { y: -26, on: this.phase === 'READY' && this.countdownStage >= 2, color: '#EF4444' },
      { y: 0, on: this.phase === 'READY' && this.countdownStage === 1, color: '#FACC15' },
      { y: 26, on: this.phase === 'PLAYING', color: '#4ADE80' },
    ];
    for (const l of lights) {
      ctx.fillStyle = l.on ? l.color : '#0F172A';
      if (l.on) {
        ctx.shadowColor = l.color;
        ctx.shadowBlur = 14;
      }
      ctx.beginPath();
      ctx.arc(0, l.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  private renderTopTelemetryBar(ctx: CanvasRenderingContext2D, isMono: boolean): void {
    const player = this.cars[0];
    const spd = player ? Math.hypot(player.vx, player.vy) : 0;
    const gear = spd < 95 ? 1 : spd < 185 ? 2 : spd < 275 ? 3 : 4;
    const rpmFrac = Math.min(1, (spd % 95) / 95);

    ctx.save();
    ctx.fillStyle = 'rgba(4, 7, 15, 0.88)';
    ctx.fillRect(0, 0, SPRINT_W, 44);
    ctx.strokeStyle = isMono ? 'rgba(226,232,240,0.35)' : 'rgba(250, 204, 21, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 44);
    ctx.lineTo(SPRINT_W, 44);
    ctx.stroke();

    ctx.font = '800 15px "JetBrains Mono", monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = isMono ? '#F8FAFC' : '#FACC15';
    ctx.fillText(`${this.getTitleLabel()} · ${Math.floor(this.score).toLocaleString()}`, 22, 22);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#38BDF8';
    ctx.fillText(
      `RACE ${this.raceNum} · ${this.compiledTrack.blueprint.name.toUpperCase()} · LAP ${Math.min(3, player?.lap ?? 1)}/3`,
      SPRINT_W * 0.49,
      22
    );

    ctx.textAlign = 'right';
    if (this.isClassicGearVariant()) {
      ctx.fillStyle = '#4ADE80';
      ctx.fillText(`GEAR ${gear} · ${Math.round(spd * 0.48)} MPH`, SPRINT_W - 140, 22);
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(SPRINT_W - 122, 14, 100, 16);
      ctx.fillStyle = rpmFrac > 0.8 ? '#EF4444' : '#4ADE80';
      ctx.fillRect(SPRINT_W - 120, 16, Math.round(96 * rpmFrac), 12);
    } else if (this.variant === 'superoffroad') {
      ctx.fillStyle = '#4ADE80';
      ctx.fillText(`CASH $${this.cash} ·`, SPRINT_W - 165, 22);
      ctx.fillStyle = '#38BDF8';
      ctx.fillText(`N2O NITRO: ${this.nitros}`, SPRINT_W - 22, 22);
    } else if (this.variant === 'indyheat') {
      // Live Fuel & Engine Heat Bars!
      ctx.fillStyle = this.indyFuel < 22 ? '#EF4444' : '#4ADE80';
      ctx.fillText(`FUEL`, SPRINT_W - 255, 22);
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(SPRINT_W - 246, 14, 72, 16);
      ctx.fillStyle = this.indyFuel < 22 ? '#EF4444' : '#4ADE80';
      ctx.fillRect(SPRINT_W - 244, 16, Math.round(68 * (this.indyFuel / 100)), 12);

      ctx.fillStyle = this.indyHeat > 75 ? '#EF4444' : '#FACC15';
      ctx.fillText(`HEAT`, SPRINT_W - 110, 22);
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(SPRINT_W - 100, 14, 78, 16);
      ctx.fillStyle = this.indyHeat > 75 ? '#EF4444' : '#F97316';
      ctx.fillRect(SPRINT_W - 98, 16, Math.round(74 * (this.indyHeat / 100)), 12);
    } else if (this.variant === 'badlands') {
      ctx.fillStyle = '#F97316';
      ctx.fillText(
        `WRENCHES:${this.wrenches} · GUN:LV${this.accelStat + 1} SPD:${this.speedStat} ARMOR:${this.tractionStat}`,
        SPRINT_W - 22,
        22
      );
    } else {
      ctx.fillStyle = '#FACC15';
      ctx.fillText(
        `WRENCHES: ${this.wrenches} · SPD:${this.speedStat} ACC:${this.accelStat} GRIP:${this.tractionStat}`,
        SPRINT_W - 22,
        22
      );
    }
    ctx.restore();
  }

  private renderPitShopOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = 'rgba(2, 6, 20, 0.88)';
    ctx.fillRect(SPRINT_W * 0.16, SPRINT_H * 0.24, SPRINT_W * 0.68, SPRINT_H * 0.46);
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 3;
    ctx.strokeRect(SPRINT_W * 0.16, SPRINT_H * 0.24, SPRINT_W * 0.68, SPRINT_H * 0.46);

    const shopTitle =
      this.variant === 'superoffroad'
        ? 'LELAND SPEED SHOP · SPEND $1,500'
        : this.variant === 'indyheat'
          ? 'INDY GARAGE · SPEND $1,500'
          : this.variant === 'badlands'
            ? 'WASTELAND ARMORY · SPEND 2 WRENCHES'
            : 'PIT TUNE-UP SHOP · SPEND 2 WRENCHES';

    ctx.textAlign = 'center';
    ctx.font = '900 30px "Outfit", sans-serif';
    ctx.fillStyle = '#FACC15';
    ctx.fillText(shopTitle, SPRINT_W * 0.5, SPRINT_H * 0.31);

    ctx.font = '700 15px "JetBrains Mono", monospace';
    ctx.fillStyle = '#CBD5E1';
    ctx.fillText(`LEFT / RIGHT TO SELECT · SPACE TO INSTALL (${Math.ceil(this.pitShopTimer)}s)`, SPRINT_W * 0.5, SPRINT_H * 0.36);

    const opts =
      this.variant === 'badlands'
        ? [
            { label: 'TURBO ENGINE', stat: this.speedStat, desc: '+24 MPH Max Velocity', color: '#EF4444' },
            { label: 'TWIN CANNONS', stat: this.accelStat, desc: 'Rapid-Fire & Dual Guns', color: '#F97316' },
            { label: 'SPIKED TIRES', stat: this.tractionStat, desc: 'Tighter Wasteland Grip', color: '#84CC16' },
          ]
        : this.variant === 'superoffroad'
          ? [
              { label: 'V8 TOP SPEED', stat: this.speedStat, desc: '+24 MPH & +2 N2O', color: '#EF4444' },
              { label: 'HEAVY SHOCKS', stat: this.accelStat, desc: 'Bigger Air & Launch', color: '#38BDF8' },
              { label: 'MUD TIRES', stat: this.tractionStat, desc: 'Tear Through Mud Pits', color: '#4ADE80' },
            ]
          : this.variant === 'indyheat'
            ? [
                { label: 'CART V8 SPEED', stat: this.speedStat, desc: '+24 MPH Straightaway', color: '#EF4444' },
                { label: 'TURBO CHARGER', stat: this.accelStat, desc: 'Explosive Launch', color: '#38BDF8' },
                { label: 'COOLING & GRIP', stat: this.tractionStat, desc: 'Less Heat & Fuel Burn', color: '#4ADE80' },
              ]
            : [
                { label: 'TOP SPEED', stat: this.speedStat, desc: '+24 MPH Max Velocity', color: '#EF4444' },
                { label: 'TURBO ACCEL', stat: this.accelStat, desc: '+34 Launch Power', color: '#38BDF8' },
                { label: 'SUPER TRACTION', stat: this.tractionStat, desc: 'Tighter Corner Grip', color: '#4ADE80' },
              ];

    opts.forEach((o, i) => {
      const bx = SPRINT_W * 0.21 + i * 265;
      const by = SPRINT_H * 0.42;
      const selected = this.pitShopCursor === i;
      ctx.fillStyle = selected ? 'rgba(250, 204, 21, 0.2)' : 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = selected ? '#FACC15' : '#475569';
      ctx.lineWidth = selected ? 3.5 : 1.5;
      ctx.beginPath();
      ctx.roundRect(bx, by, 230, 175, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = o.color;
      ctx.font = '900 19px "JetBrains Mono", monospace';
      ctx.fillText(o.label, bx + 115, by + 42);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 14px "JetBrains Mono", monospace';
      ctx.fillText(o.desc, bx + 115, by + 76);

      for (let p = 0; p < 5; p++) {
        ctx.fillStyle = p < o.stat ? o.color : '#1E293B';
        ctx.fillRect(bx + 35 + p * 34, by + 112, 26, 18);
      }
    });
    ctx.restore();
  }
}

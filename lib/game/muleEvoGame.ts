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
  MULE_SPECIES,
  MuleResourceKind,
  MuleTerrainKind,
  RESOURCE_META,
  drawAlienSprite,
  drawIrataPlotTile,
  drawMechanicalMule,
  drawWampus,
} from './muleArtwork';

const LOGICAL_W = 860;
const LOGICAL_H = 640;
const MAP_COLS = 9;
const MAP_ROWS = 5;
const TILE_W = 86;
const TILE_H = 74;
const MAP_X = Math.floor((LOGICAL_W - MAP_COLS * TILE_W) / 2);
const MAP_Y = 122;

type EvoSubPhase = 'SPECIES' | 'GRANT' | 'DEVELOP' | 'PLAZA' | 'PRODUCTION' | 'AUCTION';

interface EvoPlot {
  col: number;
  row: number;
  terrain: MuleTerrainKind;
  owner: number;
  outfit: MuleResourceKind | null;
  tier: number;
  shielded: boolean;
  crystiteRichness: number;
  assayed: boolean;
}

interface EvoRival {
  id: number;
  speciesIdx: number;
  name: string;
  cash: number;
  stock: Record<MuleResourceKind, number>;
  score: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  facing: number;
  carrying: MuleResourceKind | null;
  muleX: number;
  muleY: number;
  aiCooldown: number;
}

interface SupplyPod {
  active: boolean;
  col: number;
  row: number;
  x: number;
  y: number;
  dropY: number;
  rewardKind: 'cash' | MuleResourceKind;
  amount: number;
}

interface CargoDrone {
  x: number;
  y: number;
  tx: number;
  ty: number;
  color: string;
  life: number;
  maxLife: number;
}

interface PlazaBay {
  id: 'food' | 'energy' | 'smithore' | 'crystite' | 'geoscan' | 'shield' | 'cantina' | 'exit';
  label: string;
  sub: string;
  x: number;
  w: number;
  color: string;
}

const PLAZA_BAYS: PlazaBay[] = [
  { id: 'food', label: 'FOOD', sub: 'M.U.L.E.', x: 42, w: 90, color: '#4ADE80' },
  { id: 'energy', label: 'ENERGY', sub: 'M.U.L.E.', x: 138, w: 90, color: '#FACC15' },
  { id: 'smithore', label: 'ORE', sub: 'M.U.L.E.', x: 234, w: 90, color: '#38BDF8' },
  { id: 'crystite', label: 'CRYST', sub: 'M.U.L.E.', x: 330, w: 90, color: '#E879F9' },
  { id: 'geoscan', label: 'GEOSCAN', sub: '$60 PULSE', x: 426, w: 94, color: '#22D3EE' },
  { id: 'shield', label: 'SHIELD', sub: '$110 KIT', x: 526, w: 94, color: '#60A5FA' },
  { id: 'cantina', label: 'CANTINA', sub: 'JACKPOT', x: 626, w: 94, color: '#FB923C' },
  { id: 'exit', label: 'EXIT', sub: 'TO MAP', x: 726, w: 92, color: '#94A3B8' },
];

const OUTFIT_ORDER: MuleResourceKind[] = ['food', 'energy', 'smithore', 'crystite'];

export class MuleEvoArcadeGame implements ArcadeGameInstance {
  public readonly logicalWidth = LOGICAL_W;
  public readonly logicalHeight = LOGICAL_H;
  public readonly supportsPointerAim = true;
  public readonly primaryActionLabel = 'Act / Upgrade';
  public readonly secondaryActionLabel = 'Jet-Dash / Scan';

  private readonly storageKey = 'mule_returns_evo_hs_v1';
  private phase: ClassicGamePhase = 'TITLE';
  private subPhase: EvoSubPhase = 'SPECIES';
  private score = 0;
  private highScore = 0;
  private month = 1;
  private input: ArcadeInputState = createEmptyInput();
  private prevDir = { up: false, down: false, left: false, right: false };

  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];
  private time = 0;

  private speciesIdx = 0;
  private plots: EvoPlot[] = [];
  private cursorC = 4;
  private cursorR = 1;

  private cash = 1000;
  private stock: Record<MuleResourceKind, number> = { food: 5, energy: 5, smithore: 1, crystite: 0 };
  private prices: Record<MuleResourceKind, number> = { food: 36, energy: 30, smithore: 58, crystite: 105 };
  private priceHistory: Record<MuleResourceKind, number[]> = {
    food: [34, 36],
    energy: [28, 30],
    smithore: [52, 58],
    crystite: [95, 105],
  };
  private shieldKits = 0;
  private rivals: EvoRival[] = [];

  private px = LOGICAL_W * 0.5;
  private py = MAP_Y + 2.5 * TILE_H;
  private facing = 1;
  private isMoving = false;
  private carryingQueue: MuleResourceKind[] = [];
  private muleCoords: Array<{ x: number; y: number }> = [
    { x: LOGICAL_W * 0.5, y: MAP_Y + 2.5 * TILE_H },
    { x: LOGICAL_W * 0.5, y: MAP_Y + 2.5 * TILE_H },
  ];
  private devTimer = 38;

  private dashEnergy = 1;
  private dashActive = 0;
  private scanWave = { active: false, x: LOGICAL_W * 0.5, y: MAP_Y + 185, radius: 0 };

  private plazaX = 180;
  private plazaFacing = 1;
  private cantinaWheelPhase = 0;

  private wampus = { active: false, golden: false, c: 1, r: 1 };
  private supplyPod: SupplyPod = { active: false, col: 0, row: 0, x: 0, y: 0, dropY: 0, rewardKind: 'cash', amount: 180 };
  private dustMotes: Array<{ x: number; y: number; spd: number; r: number }> = [];

  private eventHeadline = '';
  private eventKind: 'sun' | 'rain' | 'pirate' | 'meteor' | 'quake' | 'boom' = 'boom';
  private prodTimer = 0;
  private drones: CargoDrone[] = [];
  private freighterX = -120;
  private pirateX = -140;

  private auctionIdx = 0;
  private auctionTimer = 24;
  private auctionBids = [0.5, 0.35, 0.65, 0.45];
  private privateDeal: { active: boolean; rivalName: string; kind: MuleResourceKind; qty: number; totalPrice: number; isBuyingFromPlayer: boolean } | null = null;

  constructor() {
    this.highScore = readHighScore(this.storageKey);
    for (let i = 0; i < 28; i++) {
      this.dustMotes.push({
        x: Math.random() * LOGICAL_W,
        y: MAP_Y + Math.random() * (MAP_ROWS * TILE_H),
        spd: 14 + Math.random() * 22,
        r: 1 + Math.random() * 1.8,
      });
    }
    this.initPlanet();
    this.initRivals();
  }

  private initRivals(): void {
    const baseIds = [1, 4, 6].map((idx) => (idx === this.speciesIdx ? (idx + 1) % MULE_SPECIES.length : idx));
    const center = { x: MAP_X + 4.5 * TILE_W, y: MAP_Y + 2.5 * TILE_H };
    this.rivals = baseIds.map((spIdx, i) => ({
      id: i + 1,
      speciesIdx: spIdx,
      name: MULE_SPECIES[spIdx].name,
      cash: MULE_SPECIES[spIdx].startCash,
      stock: { food: 4, energy: 4, smithore: 1, crystite: 0 },
      score: 1250,
      x: center.x + (i - 1) * 28,
      y: center.y,
      targetX: center.x,
      targetY: center.y,
      facing: 1,
      carrying: null,
      muleX: center.x,
      muleY: center.y,
      aiCooldown: 1 + i * 0.6,
    }));
  }

  private initPlanet(): void {
    this.plots = [];
    for (let r = 0; r < MAP_ROWS; r++) {
      for (let c = 0; c < MAP_COLS; c++) {
        let terrain: MuleTerrainKind = 'plains';
        if (c === 4 && r === 2) terrain = 'town';
        else if (c === 4) terrain = 'river';
        else {
          const hash = (c * 17 + r * 11 + (c ^ r)) % 12;
          if (hash <= 1) terrain = 'mtn3';
          else if (hash <= 4) terrain = 'mtn2';
          else if (hash <= 6) terrain = 'mtn1';
        }
        const richness = terrain === 'mtn3' ? 2 + Math.floor(Math.random() * 2) : terrain.startsWith('mtn') ? 1 + Math.floor(Math.random() * 3) : Math.random() < 0.28 ? 1 : 0;
        this.plots.push({
          col: c,
          row: r,
          terrain,
          owner: -1,
          outfit: null,
          tier: 1,
          shielded: false,
          crystiteRichness: Math.min(3, richness),
          assayed: false,
        });
      }
    }
  }

  public startNewGame(): void {
    this.month = 1;
    this.speciesIdx = 0;
    this.subPhase = 'SPECIES';
    this.phase = 'PLAYING';
    this.particles = [];
    this.popups = [];
    this.drones = [];
    this.initPlanet();
    this.applySpeciesStart();
    arcadeAudio.playArcadeStart();
  }

  private applySpeciesStart(): void {
    const sp = MULE_SPECIES[this.speciesIdx];
    this.cash = sp.startCash;
    this.stock = { food: 5, energy: 5, smithore: 1, crystite: 0 };
    this.prices = { food: 36, energy: 30, smithore: 58, crystite: 105 };
    this.priceHistory = {
      food: [34, 36],
      energy: [28, 30],
      smithore: [52, 58],
      crystite: [95, 105],
    };
    this.shieldKits = this.speciesIdx === 1 ? 1 : 0;
    this.carryingQueue = [];
    this.initRivals();
    this.recomputeColonyScore();
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.subPhase = 'SPECIES';
    this.initPlanet();
  }

  public restartStage(): void {
    this.startNewGame();
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  private getPlot(c: number, r: number): EvoPlot | undefined {
    if (c < 0 || c >= MAP_COLS || r < 0 || r >= MAP_ROWS) return undefined;
    return this.plots[r * MAP_COLS + c];
  }

  private getDiscount(): number {
    return this.speciesIdx === 4 ? 0.75 : 1;
  }

  private getOutfitCost(kind: MuleResourceKind): number {
    return Math.round(RESOURCE_META[kind].baseCost * this.getDiscount());
  }

  private getUpgradeCost(currentTier: number): number {
    return Math.round((currentTier === 1 ? 160 : 260) * this.getDiscount());
  }

  private getMaxCarry(): number {
    return this.speciesIdx === 2 ? 2 : 1;
  }

  private countSynergyLinks(p: EvoPlot): number {
    if (!p.outfit || p.owner < 0) return 0;
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    let links = 0;
    for (const [dc, dr] of dirs) {
      const n = this.getPlot(p.col + dc, p.row + dr);
      if (n && n.owner === p.owner && n.outfit === p.outfit) links++;
    }
    return links;
  }

  private recomputeColonyScore(): void {
    const owned = this.plots.filter((p) => p.owner === 0);
    const landVal = owned.reduce(
      (sum, p) => sum + 500 + (p.outfit ? 250 * p.tier : 0) + (p.shielded ? 120 : 0),
      0
    );
    const goodsVal =
      this.stock.food * this.prices.food +
      this.stock.energy * this.prices.energy +
      this.stock.smithore * this.prices.smithore +
      this.stock.crystite * this.prices.crystite;
    const raw = Math.round(this.cash + landVal + goodsVal);
    this.score = this.speciesIdx === 1 ? Math.round(raw * 1.2) : raw;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(this.storageKey, this.highScore);
    }
  }

  private beginMonthGrant(): void {
    this.subPhase = 'GRANT';
    this.cursorC = 4;
    this.cursorR = 1;

    if (this.month > 1 && this.speciesIdx === 0 && this.cash > 0) {
      const div = Math.round(this.cash * 0.12);
      this.cash += div;
      this.popups.push({
        x: LOGICAL_W * 0.5,
        y: 165,
        text: `FLAPPER DIVIDEND +$${div}!`,
        color: '#FACC15',
        life: 1.5,
        maxLife: 1.5,
      });
    }

    const open = this.plots.filter((p) => p.owner === -1 && p.terrain !== 'town');
    for (const rv of this.rivals) {
      if (open.length === 0) break;
      const idx = Math.floor(Math.random() * open.length);
      const p = open.splice(idx, 1)[0];
      p.owner = rv.id;
    }
  }

  private beginDevelopment(): void {
    this.subPhase = 'DEVELOP';
    const sp = MULE_SPECIES[this.speciesIdx];
    this.devTimer = sp.devTime + 4;
    this.px = MAP_X + 4.5 * TILE_W;
    this.py = MAP_Y + 2.5 * TILE_H;
    this.carryingQueue = [];
    this.muleCoords = [
      { x: this.px, y: this.py },
      { x: this.px, y: this.py },
    ];
    this.dashEnergy = 1;
    this.dashActive = 0;

    const townX = MAP_X + 4.5 * TILE_W;
    const townY = MAP_Y + 2.5 * TILE_H;
    for (const rv of this.rivals) {
      rv.x = townX + (rv.id - 2) * 18;
      rv.y = townY;
      rv.muleX = rv.x;
      rv.muleY = rv.y;
      rv.carrying = null;
      rv.aiCooldown = 0.8 + rv.id * 0.5;
    }

    const mtns = this.plots.filter((p) => p.terrain.startsWith('mtn'));
    if (mtns.length > 0) {
      const pick = mtns[Math.floor(Math.random() * mtns.length)];
      this.wampus = { active: true, golden: Math.random() < 0.35, c: pick.col, r: pick.row };
    }

    const valid = this.plots.filter((p) => p.terrain !== 'town');
    const podPlot = valid[Math.floor(Math.random() * valid.length)];
    const podReward: 'cash' | MuleResourceKind =
      Math.random() < 0.45 ? 'cash' : OUTFIT_ORDER[Math.floor(Math.random() * OUTFIT_ORDER.length)];
    this.supplyPod = {
      active: true,
      col: podPlot.col,
      row: podPlot.row,
      x: MAP_X + (podPlot.col + 0.5) * TILE_W,
      y: MAP_Y + (podPlot.row + 0.5) * TILE_H,
      dropY: -180,
      rewardKind: podReward,
      amount: podReward === 'cash' ? 160 + this.month * 25 : 3,
    };
    arcadeAudio.playDropshipDeploy();

    if (this.speciesIdx === 5) {
      for (const p of this.plots) {
        if (p.owner === 0 && p.terrain.startsWith('mtn')) p.assayed = true;
      }
    }
  }

  private triggerGeoScan(originX: number, originY: number): void {
    this.scanWave = { active: true, x: originX, y: originY, radius: 10 };
    let revealed = 0;
    for (const p of this.plots) {
      if (p.terrain !== 'town' && !p.assayed) {
        p.assayed = true;
        revealed++;
      }
    }
    this.popups.push({
      x: originX,
      y: originY - 22,
      text: revealed > 0 ? `GEO-PULSE: ${revealed} VEINS MAPPED!` : 'PLANET VEINS MAPPED!',
      color: '#22D3EE',
      life: 1.4,
      maxLife: 1.4,
    });
    arcadeAudio.playHyperspace();
  }

  private stepRivalColonists(dt: number): void {
    const townX = MAP_X + 4.5 * TILE_W;
    const townY = MAP_Y + 2.5 * TILE_H;
    for (const rv of this.rivals) {
      rv.aiCooldown -= dt;
      if (rv.aiCooldown <= 0) {
        if (!rv.carrying) {
          const emptyOwn = this.plots.find((p) => p.owner === rv.id && !p.outfit);
          if (emptyOwn && rv.cash >= 140) {
            const pick: MuleResourceKind =
              emptyOwn.terrain === 'river'
                ? 'food'
                : emptyOwn.terrain.startsWith('mtn')
                ? Math.random() < 0.5 ? 'crystite' : 'smithore'
                : 'energy';
            if (Math.hypot(rv.x - townX, rv.y - townY) < 26) {
              rv.cash -= 130;
              rv.carrying = pick;
              rv.targetX = MAP_X + (emptyOwn.col + 0.5) * TILE_W;
              rv.targetY = MAP_Y + (emptyOwn.row + 0.5) * TILE_H;
              rv.aiCooldown = 1.2;
            } else {
              rv.targetX = townX;
              rv.targetY = townY;
              rv.aiCooldown = 0.8;
            }
          } else if (this.supplyPod.active) {
            rv.targetX = this.supplyPod.x;
            rv.targetY = this.supplyPod.y;
            rv.aiCooldown = 1.0;
          } else {
            rv.targetX = MAP_X + (1 + Math.random() * 7) * TILE_W;
            rv.targetY = MAP_Y + (0.6 + Math.random() * 3.8) * TILE_H;
            rv.aiCooldown = 2.4;
          }
        }
      }

      const dx = rv.targetX - rv.x;
      const dy = rv.targetY - rv.y;
      const d = Math.hypot(dx, dy);
      if (d > 4) {
        const spd = 108;
        rv.x += (dx / d) * spd * dt;
        rv.y += (dy / d) * spd * dt;
        rv.facing = dx >= 0 ? 1 : -1;
      } else if (rv.carrying) {
        const c = Math.floor((rv.x - MAP_X) / TILE_W);
        const r = Math.floor((rv.y - MAP_Y) / TILE_H);
        const plot = this.getPlot(c, r);
        if (plot && plot.owner === rv.id && !plot.outfit) {
          plot.outfit = rv.carrying;
          rv.carrying = null;
          spawnBurst(this.particles, rv.x, rv.y, RESOURCE_META[plot.outfit].color, 10, 95, 2.5);
          rv.aiCooldown = 1.6;
        }
      }

      const mdx = rv.x - rv.muleX;
      const mdy = rv.y - rv.muleY;
      const md = Math.hypot(mdx, mdy);
      if (md > 26) {
        rv.muleX += (mdx / md) * (md - 26) * Math.min(1, dt * 9);
        rv.muleY += (mdy / md) * (md - 26) * Math.min(1, dt * 9);
      }

      if (this.supplyPod.active && this.supplyPod.dropY >= 0 && Math.hypot(rv.x - this.supplyPod.x, rv.y - this.supplyPod.y) < 22) {
        this.supplyPod.active = false;
        rv.cash += 120;
        this.popups.push({
          x: this.supplyPod.x,
          y: this.supplyPod.y - 16,
          text: `${rv.name} GRABBED POD!`,
          color: '#F87171',
          life: 1.2,
          maxLife: 1.2,
        });
      }
    }
  }

  private runProductionPhase(): void {
    if (this.carryingQueue.length > 0) {
      this.popups.push({
        x: this.px,
        y: this.py - 20,
        text: `${this.carryingQueue.length} UNINSTALLED M.U.L.E. FLED!`,
        color: '#F87171',
        life: 1.4,
        maxLife: 1.4,
      });
      this.carryingQueue = [];
    }

    this.subPhase = 'PRODUCTION';
    this.prodTimer = 4.4;
    this.drones = [];
    this.freighterX = -110;
    this.pirateX = -140;

    const events: Array<{ msg: string; kind: 'sun' | 'rain' | 'pirate' | 'meteor' | 'quake' | 'boom' }> = [
      { msg: 'SOLAR FLARE! +2 ENERGY ON ALL POWER PLOTS!', kind: 'sun' },
      { msg: 'IRATA MONSOON! +2 FOOD ON ALL RIVER PLOTS!', kind: 'rain' },
      { msg: 'PIRATE DREADNOUGHT RAID! SHIELDS PROTECT CRYSTITE!', kind: 'pirate' },
      { msg: 'CRYSTITE METEOR STRIKE! NEW MOTHERLODE VEIN FORMED!', kind: 'meteor' },
      { msg: 'SEISMIC SURGE! +1 SMITHORE ON MOUNTAINS!', kind: 'quake' },
      { msg: 'ORBITAL TRADE BOOM! ALL COMMODITY PRICES +15%!', kind: 'boom' },
    ];
    const ev = events[Math.floor(Math.random() * events.length)];
    this.eventHeadline = ev.msg;
    this.eventKind = ev.kind;

    if (ev.kind === 'meteor') {
      const candidates = this.plots.filter((p) => p.terrain !== 'town');
      const hit = candidates[Math.floor(Math.random() * candidates.length)];
      if (hit) {
        hit.crystiteRichness = 3;
        hit.assayed = true;
        spawnBurst(this.particles, MAP_X + (hit.col + 0.5) * TILE_W, MAP_Y + (hit.row + 0.5) * TILE_H, '#E879F9', 28, 210, 4.5);
      }
      this.prices.crystite = Math.min(260, this.prices.crystite + 42);
    } else if (ev.kind === 'boom') {
      for (const k of OUTFIT_ORDER) this.prices[k] = Math.round(this.prices[k] * 1.15);
    } else if (ev.kind === 'pirate') {
      const shieldedCount = this.plots.filter((p) => p.owner === 0 && p.shielded).length;
      if (shieldedCount === 0 && this.stock.crystite > 0) {
        const stolen = Math.min(2, this.stock.crystite);
        this.stock.crystite -= stolen;
        this.popups.push({
          x: LOGICAL_W * 0.5,
          y: 230,
          text: `PIRATES STOLE ${stolen} CRYSTITE!`,
          color: '#EF4444',
          life: 1.8,
          maxLife: 1.8,
        });
      } else if (shieldedCount > 0) {
        this.popups.push({
          x: LOGICAL_W * 0.5,
          y: 230,
          text: 'COLONY SHIELDS DEFLECTED PIRATES!',
          color: '#38BDF8',
          life: 1.8,
          maxLife: 1.8,
        });
        arcadeAudio.playDxShieldRepair();
      }
      this.prices.smithore = Math.min(185, this.prices.smithore + 32);
    }

    const myPlots = this.plots.filter((p) => p.owner === 0 && p.outfit !== null);
    let energyAvail = this.stock.energy;

    for (const p of myPlots) {
      if (!p.outfit) continue;
      if (p.outfit !== 'energy') {
        if (energyAvail <= 0) continue;
        energyAvail -= 1;
      }

      const syn = this.countSynergyLinks(p);
      const tierBonus = p.tier - 1;
      let yieldAmt = 0;

      if (p.outfit === 'food') {
        const base = p.terrain === 'river' ? 4 : p.terrain === 'plains' ? 2 : 1;
        const spBonus = this.speciesIdx === 7 && p.terrain === 'river' ? 2 : 0;
        yieldAmt = base + tierBonus * 2 + syn + spBonus + (ev.kind === 'rain' && p.terrain === 'river' ? 2 : 0);
        this.stock.food += yieldAmt;
      } else if (p.outfit === 'energy') {
        const base = p.terrain === 'plains' ? 4 : p.terrain === 'river' ? 2 : 1;
        const spBonus = this.speciesIdx === 6 && syn > 0 ? 1 : 0;
        yieldAmt = base + tierBonus * 2 + syn + spBonus + (ev.kind === 'sun' ? 2 : 0);
        this.stock.energy += yieldAmt;
      } else if (p.outfit === 'smithore') {
        const base = p.terrain === 'mtn3' ? 4 : p.terrain === 'mtn2' ? 3 : p.terrain === 'mtn1' ? 2 : 1;
        const spBonus = this.speciesIdx === 6 ? 2 : 0;
        yieldAmt = base + tierBonus * 2 + syn + spBonus + (ev.kind === 'quake' ? 1 : 0);
        this.stock.smithore += yieldAmt;
      } else {
        const base = Math.max(1, p.crystiteRichness);
        const spBonus = this.speciesIdx === 5 && p.terrain.startsWith('mtn') ? 2 : 0;
        yieldAmt = base + tierBonus * 2 + syn + spBonus;
        this.stock.crystite += yieldAmt;
      }

      const cx = MAP_X + (p.col + 0.5) * TILE_W;
      const cy = MAP_Y + (p.row + 0.5) * TILE_H;
      const col = RESOURCE_META[p.outfit].color;

      for (let d = 0; d < Math.min(4, Math.ceil(yieldAmt / 2)); d++) {
        this.drones.push({
          x: cx + (Math.random() - 0.5) * 20,
          y: cy,
          tx: LOGICAL_W * 0.5 + (Math.random() - 0.5) * 180,
          ty: 30,
          color: col,
          life: 1.5 + d * 0.25,
          maxLife: 1.5 + d * 0.25,
        });
      }

      this.popups.push({
        x: cx,
        y: cy - 12,
        text: `+${yieldAmt}${syn > 0 ? ` (+${syn} SYN)` : ''}`,
        color: col,
        life: 2.0,
        maxLife: 2.0,
      });
    }

    this.stock.food = Math.max(0, this.stock.food - 2);
    this.stock.energy = Math.max(0, this.stock.energy - Math.min(2, myPlots.length));

    for (const rv of this.rivals) {
      const rvPlots = this.plots.filter((p) => p.owner === rv.id && p.outfit);
      for (const rp of rvPlots) {
        if (rp.outfit) rv.stock[rp.outfit] += 2 + Math.floor(Math.random() * 2);
      }
      rv.stock.food = Math.max(1, rv.stock.food - 1);
      rv.cash += 140 + Math.floor(Math.random() * 140);
      rv.score =
        rv.cash +
        this.plots.filter((p) => p.owner === rv.id).length * 600 +
        rv.stock.food * this.prices.food +
        rv.stock.energy * this.prices.energy +
        rv.stock.smithore * this.prices.smithore +
        rv.stock.crystite * this.prices.crystite;
    }

    const drifts: Record<MuleResourceKind, [number, number, number]> = {
      food: [20, 125, 18],
      energy: [18, 115, 18],
      smithore: [40, 185, 24],
      crystite: [65, 265, 36],
    };
    for (const k of OUTFIT_ORDER) {
      const [lo, hi, swing] = drifts[k];
      this.prices[k] = Math.max(lo, Math.min(hi, this.prices[k] + Math.round((Math.random() - 0.46) * swing)));
      this.priceHistory[k].push(this.prices[k]);
      if (this.priceHistory[k].length > 8) this.priceHistory[k].shift();
    }

    const offerRival = this.rivals[Math.floor(Math.random() * this.rivals.length)];
    const offerKind = OUTFIT_ORDER[Math.floor(Math.random() * OUTFIT_ORDER.length)];
    const playerHas = this.stock[offerKind];
    if (playerHas >= 2) {
      const qty = Math.min(3, playerHas);
      this.privateDeal = {
        active: true,
        rivalName: offerRival.name,
        kind: offerKind,
        qty,
        totalPrice: Math.round(qty * this.prices[offerKind] * 1.25),
        isBuyingFromPlayer: true,
      };
    } else {
      const qty = 2;
      this.privateDeal = {
        active: true,
        rivalName: offerRival.name,
        kind: offerKind,
        qty,
        totalPrice: Math.round(qty * this.prices[offerKind] * 0.8),
        isBuyingFromPlayer: false,
      };
    }

    this.recomputeColonyScore();
    arcadeAudio.playCoin();
  }

  private activatePlazaBay(bay: PlazaBay): void {
    if (bay.id === 'exit') {
      this.subPhase = 'DEVELOP';
      this.px = MAP_X + 4.5 * TILE_W;
      this.py = MAP_Y + 1.85 * TILE_H;
      this.muleCoords.forEach((m) => {
        m.x = this.px;
        m.y = this.py;
      });
      arcadeAudio.playMoveTick();
      return;
    }

    if (bay.id === 'geoscan') {
      const cost = 60;
      if (this.cash >= cost) {
        this.cash -= cost;
        this.recomputeColonyScore();
        this.subPhase = 'DEVELOP';
        this.px = MAP_X + 4.5 * TILE_W;
        this.py = MAP_Y + 2.5 * TILE_H;
        this.triggerGeoScan(this.px, this.py);
      } else {
        arcadeAudio.playRockThud();
      }
      return;
    }

    if (bay.id === 'shield') {
      const cost = Math.round(110 * this.getDiscount());
      if (this.cash >= cost) {
        this.cash -= cost;
        this.shieldKits += 1;
        this.recomputeColonyScore();
        this.popups.push({
          x: LOGICAL_W * 0.5,
          y: 260,
          text: `SHIELD KIT +1 (WALK TO PLOT + SPACE)`,
          color: '#60A5FA',
          life: 1.4,
          maxLife: 1.4,
        });
        arcadeAudio.playDxShieldRepair();
      } else {
        arcadeAudio.playRockThud();
      }
      return;
    }

    if (bay.id === 'cantina') {
      const wave = 0.5 + 0.5 * Math.sin(this.cantinaWheelPhase);
      const mult = wave > 0.82 ? 2.0 : wave > 0.5 ? 1.35 : 0.85;
      const bonus = Math.round((65 + this.devTimer * 6.5) * mult);
      this.cash += bonus;
      this.carryingQueue = [];
      this.recomputeColonyScore();
      this.popups.push({
        x: LOGICAL_W * 0.5,
        y: 260,
        text: mult >= 2 ? `CANTINA JACKPOT! +$${bonus}!` : `CANTINA PAYOUT +$${bonus}!`,
        color: mult >= 2 ? '#FDE047' : '#4ADE80',
        life: 1.6,
        maxLife: 1.6,
      });
      arcadeAudio.playRainbowBonus();
      this.runProductionPhase();
      return;
    }

    if (this.carryingQueue.length >= this.getMaxCarry()) {
      this.popups.push({
        x: LOGICAL_W * 0.5,
        y: 260,
        text: `TETHER FULL (${this.carryingQueue.length}/${this.getMaxCarry()}) — EXIT TO MAP!`,
        color: '#FACC15',
        life: 1.1,
        maxLife: 1.1,
      });
      arcadeAudio.playRockThud();
      return;
    }

    const kind = bay.id;
    const cost = this.getOutfitCost(kind);
    if (this.cash >= cost) {
      this.cash -= cost;
      this.carryingQueue.push(kind);
      this.recomputeColonyScore();
      this.popups.push({
        x: LOGICAL_W * 0.5,
        y: 260,
        text: `${RESOURCE_META[kind].label} M.U.L.E. TETHERED (${this.carryingQueue.length}/${this.getMaxCarry()})`,
        color: RESOURCE_META[kind].color,
        life: 1.2,
        maxLife: 1.2,
      });
      arcadeAudio.playPowerUp();
      if (this.carryingQueue.length >= this.getMaxCarry()) {
        this.subPhase = 'DEVELOP';
        this.px = MAP_X + 4.5 * TILE_W;
        this.py = MAP_Y + 1.85 * TILE_H;
        this.muleCoords.forEach((m) => {
          m.x = this.px;
          m.y = this.py;
        });
      }
    } else {
      this.popups.push({
        x: LOGICAL_W * 0.5,
        y: 260,
        text: `NEED $${cost} — TRY CANTINA OR UPGRADE LATER!`,
        color: '#F87171',
        life: 1.1,
        maxLife: 1.1,
      });
      arcadeAudio.playRockThud();
    }
  }

  public step(dt: number): void {
    this.time += dt;
    this.cantinaWheelPhase += dt * 5.2;
    stepParticlesAndPopups(this.particles, this.popups, dt);

    for (const m of this.dustMotes) {
      m.x += m.spd * dt;
      if (m.x > LOGICAL_W + 10) m.x = -10;
    }

    if (this.scanWave.active) {
      this.scanWave.radius += 380 * dt;
      if (this.scanWave.radius > 720) this.scanWave.active = false;
    }

    for (let i = this.drones.length - 1; i >= 0; i--) {
      const d = this.drones[i];
      d.life -= dt;
      const t = 1 - Math.max(0, d.life / d.maxLife);
      d.x += (d.tx - d.x) * Math.min(1, dt * 2.2);
      d.y += (d.ty - d.y) * Math.min(1, dt * (2.2 + t * 2));
      if (d.life <= 0) this.drones.splice(i, 1);
    }

    if (this.phase === 'PAUSED' || this.phase === 'GAME_OVER') return;

    const upJust = this.input.up && !this.prevDir.up;
    const downJust = this.input.down && !this.prevDir.down;
    const leftJust = this.input.left && !this.prevDir.left;
    const rightJust = this.input.right && !this.prevDir.right;
    this.prevDir = {
      up: this.input.up,
      down: this.input.down,
      left: this.input.left,
      right: this.input.right,
    };

    if (this.phase === 'TITLE') {
      const prevX = this.px;
      this.px = LOGICAL_W * 0.5 + Math.cos(this.time * 0.95) * 185;
      this.py = MAP_Y + 2.5 * TILE_H + Math.sin(this.time * 0.95) * 90;
      this.facing = this.px >= prevX ? 1 : -1;
      this.isMoving = true;
      const m0 = this.muleCoords[0];
      const dx = this.px - m0.x;
      const dy = this.py - m0.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 30) {
        m0.x += (dx / dist) * (dist - 30) * Math.min(1, dt * 9);
        m0.y += (dy / dist) * (dist - 30) * Math.min(1, dt * 9);
      }
      return;
    }

    const pointerPx = this.input.pointerX * LOGICAL_W;
    const pointerPy = this.input.pointerY * LOGICAL_H;

    if (this.subPhase === 'SPECIES') {
      if (leftJust) {
        this.speciesIdx = (this.speciesIdx + MULE_SPECIES.length - 1) % MULE_SPECIES.length;
        arcadeAudio.playMoveTick();
      } else if (rightJust) {
        this.speciesIdx = (this.speciesIdx + 1) % MULE_SPECIES.length;
        arcadeAudio.playMoveTick();
      } else if (upJust || downJust) {
        this.speciesIdx = (this.speciesIdx + 4) % MULE_SPECIES.length;
        arcadeAudio.playMoveTick();
      }
      if (this.input.fireJustPressed) {
        this.applySpeciesStart();
        this.beginMonthGrant();
        arcadeAudio.playKeyUnlock();
      }
      return;
    }

    if (this.subPhase === 'GRANT') {
      if (this.input.pointerActive) {
        const mc = Math.floor((pointerPx - MAP_X) / TILE_W);
        const mr = Math.floor((pointerPy - MAP_Y) / TILE_H);
        if (mc >= 0 && mc < MAP_COLS && mr >= 0 && mr < MAP_ROWS) {
          this.cursorC = mc;
          this.cursorR = mr;
        }
      }
      if (leftJust) this.cursorC = (this.cursorC + MAP_COLS - 1) % MAP_COLS;
      if (rightJust) this.cursorC = (this.cursorC + 1) % MAP_COLS;
      if (upJust) this.cursorR = (this.cursorR + MAP_ROWS - 1) % MAP_ROWS;
      if (downJust) this.cursorR = (this.cursorR + 1) % MAP_ROWS;

      if (this.input.fireJustPressed) {
        const plot = this.getPlot(this.cursorC, this.cursorR);
        if (plot && plot.owner === -1 && plot.terrain !== 'town') {
          plot.owner = 0;
          if (this.speciesIdx === 1 && this.month === 1) {
            plot.shielded = true;
            this.shieldKits = Math.max(0, this.shieldKits - 1);
          }
          const cx = MAP_X + (plot.col + 0.5) * TILE_W;
          const cy = MAP_Y + (plot.row + 0.5) * TILE_H;
          spawnBurst(this.particles, cx, cy, '#22D3EE', 22, 180, 4);
          this.popups.push({ x: cx, y: cy, text: 'SECTOR CLAIMED!', color: '#4ADE80', life: 1.0, maxLife: 1.0 });
          arcadeAudio.playCoin();
          this.recomputeColonyScore();
          this.beginDevelopment();
        } else {
          arcadeAudio.playRockThud();
        }
      }
      return;
    }

    if (this.subPhase === 'PLAZA') {
      this.devTimer -= dt;
      if (this.devTimer <= 0) {
        this.runProductionPhase();
        return;
      }
      const spd = 255 * (this.input.moveScale ?? 1);
      this.isMoving = false;
      if (this.input.left) {
        this.plazaX -= spd * dt;
        this.plazaFacing = -1;
        this.isMoving = true;
      }
      if (this.input.right) {
        this.plazaX += spd * dt;
        this.plazaFacing = 1;
        this.isMoving = true;
      }
      if (this.input.pointerActive && pointerPy > 170 && pointerPy < 460) {
        this.plazaX = Math.max(66, Math.min(LOGICAL_W - 66, pointerPx));
      }
      this.plazaX = Math.max(66, Math.min(LOGICAL_W - 66, this.plazaX));

      if (downJust) {
        this.activatePlazaBay(PLAZA_BAYS[PLAZA_BAYS.length - 1]);
        return;
      }
      if (this.input.fireJustPressed || upJust) {
        const bay =
          PLAZA_BAYS.find((b) => this.plazaX >= b.x && this.plazaX <= b.x + b.w) ?? PLAZA_BAYS[PLAZA_BAYS.length - 1];
        this.activatePlazaBay(bay);
      }
      return;
    }

    if (this.subPhase === 'DEVELOP') {
      this.devTimer -= dt;
      if (this.devTimer <= 0) {
        this.runProductionPhase();
        return;
      }

      if (this.supplyPod.active && this.supplyPod.dropY < 0) {
        this.supplyPod.dropY = Math.min(0, this.supplyPod.dropY + 260 * dt);
        if (this.supplyPod.dropY === 0) {
          spawnBurst(this.particles, this.supplyPod.x, this.supplyPod.y, '#38BDF8', 16, 130, 3);
        }
      }

      this.stepRivalColonists(dt);

      const recharge = this.speciesIdx === 7 ? 0.42 : 0.28;
      if (this.dashActive > 0) {
        this.dashActive -= dt;
        if (Math.random() < 0.7) {
          this.particles.push({
            x: this.px - this.facing * 6,
            y: this.py + 5,
            vx: -this.facing * (45 + Math.random() * 45),
            vy: (Math.random() - 0.5) * 35,
            life: 0.28,
            maxLife: 0.28,
            color: '#22D3EE',
            radius: 3.2,
          });
        }
      } else {
        this.dashEnergy = Math.min(1, this.dashEnergy + recharge * dt);
      }

      if (this.input.secondaryJustPressed) {
        if (this.dashEnergy >= 0.45) {
          this.dashEnergy = Math.max(0, this.dashEnergy - 0.55);
          this.dashActive = 0.65;
          arcadeAudio.playSpinDash(1);
        } else if (this.cash >= 60 && !this.scanWave.active) {
          this.cash -= 60;
          this.triggerGeoScan(this.px, this.py);
        }
      }

      const curCol = Math.max(0, Math.min(MAP_COLS - 1, Math.floor((this.px - MAP_X) / TILE_W)));
      const curRow = Math.max(0, Math.min(MAP_ROWS - 1, Math.floor((this.py - MAP_Y) / TILE_H)));
      const curPlot = this.getPlot(curCol, curRow);

      const mtnSlow = curPlot?.terrain.startsWith('mtn') && this.speciesIdx !== 3 ? 0.8 : 1;
      const spBoost = this.speciesIdx === 3 ? 1.28 : 1;
      const dashMult = this.dashActive > 0 ? 1.85 : 1;
      const walkSpd = 180 * mtnSlow * spBoost * dashMult * (this.input.moveScale ?? 1);

      let vx = 0;
      let vy = 0;
      if (this.input.left) vx -= 1;
      if (this.input.right) vx += 1;
      if (this.input.up) vy -= 1;
      if (this.input.down) vy += 1;

      if (vx !== 0 || vy !== 0) {
        const mag = Math.hypot(vx, vy);
        this.px += (vx / mag) * walkSpd * dt;
        this.py += (vy / mag) * walkSpd * dt;
        if (vx !== 0) this.facing = vx > 0 ? 1 : -1;
        this.isMoving = true;
      } else {
        this.isMoving = false;
      }

      this.px = Math.max(MAP_X + 16, Math.min(MAP_X + MAP_COLS * TILE_W - 16, this.px));
      this.py = Math.max(MAP_Y + 16, Math.min(MAP_Y + MAP_ROWS * TILE_H - 16, this.py));

      let leaderX = this.px;
      let leaderY = this.py;
      for (let i = 0; i < this.muleCoords.length; i++) {
        const m = this.muleCoords[i];
        const dx = leaderX - m.x;
        const dy = leaderY - m.y;
        const d = Math.hypot(dx, dy);
        if (d > 28) {
          m.x += (dx / d) * (d - 28) * Math.min(1, dt * 11);
          m.y += (dy / d) * (d - 28) * Math.min(1, dt * 11);
        }
        leaderX = m.x;
        leaderY = m.y;
      }

      if (this.wampus.active && this.wampus.c === curCol && this.wampus.r === curRow) {
        this.wampus.active = false;
        const prize = (this.wampus.golden ? 320 : 175) + this.month * 40;
        this.cash += prize;
        this.recomputeColonyScore();
        this.popups.push({
          x: this.px,
          y: this.py - 22,
          text: this.wampus.golden ? `GOLDEN WAMPUS! +$${prize}!` : `WAMPUS +$${prize}!`,
          color: '#FDE047',
          life: 1.5,
          maxLife: 1.5,
        });
        spawnBurst(this.particles, this.px, this.py, '#FDE047', 26, 200, 4.2);
        arcadeAudio.playExtraLife();
      }

      if (this.supplyPod.active && this.supplyPod.dropY >= 0 && Math.hypot(this.px - this.supplyPod.x, this.py - this.supplyPod.y) < 26) {
        this.supplyPod.active = false;
        if (this.supplyPod.rewardKind === 'cash') {
          this.cash += this.supplyPod.amount;
          this.popups.push({
            x: this.supplyPod.x,
            y: this.supplyPod.y - 18,
            text: `SUPPLY POD +$${this.supplyPod.amount}!`,
            color: '#4ADE80',
            life: 1.4,
            maxLife: 1.4,
          });
        } else {
          this.stock[this.supplyPod.rewardKind] += this.supplyPod.amount;
          this.popups.push({
            x: this.supplyPod.x,
            y: this.supplyPod.y - 18,
            text: `POD +${this.supplyPod.amount} ${RESOURCE_META[this.supplyPod.rewardKind].label}!`,
            color: RESOURCE_META[this.supplyPod.rewardKind].color,
            life: 1.4,
            maxLife: 1.4,
          });
        }
        this.recomputeColonyScore();
        spawnBurst(this.particles, this.supplyPod.x, this.supplyPod.y, '#22D3EE', 22, 180, 4);
        arcadeAudio.playGemChime(3);
      }

      if (this.input.fireJustPressed && curPlot) {
        if (curPlot.terrain === 'town') {
          this.subPhase = 'PLAZA';
          this.plazaX = this.carryingQueue.length > 0 ? 670 : 180;
          arcadeAudio.playKeyUnlock();
          return;
        }
        if (curPlot.owner === 0) {
          const cx = MAP_X + (curPlot.col + 0.5) * TILE_W;
          const cy = MAP_Y + (curPlot.row + 0.5) * TILE_H;

          if (this.carryingQueue.length > 0) {
            const nextOutfit = this.carryingQueue.shift()!;
            curPlot.outfit = nextOutfit;
            curPlot.tier = 1;
            const syn = this.countSynergyLinks(curPlot);
            this.recomputeColonyScore();
            spawnBurst(this.particles, cx, cy, RESOURCE_META[nextOutfit].color, 22, 180, 3.8);
            this.popups.push({
              x: cx,
              y: cy - 14,
              text: syn > 0 ? `${RESOURCE_META[nextOutfit].label} +${syn} SYNERGY!` : `${RESOURCE_META[nextOutfit].label} ONLINE!`,
              color: RESOURCE_META[nextOutfit].color,
              life: 1.3,
              maxLife: 1.3,
            });
            arcadeAudio.playKeyUnlock();
          } else if (this.shieldKits > 0 && !curPlot.shielded) {
            curPlot.shielded = true;
            this.shieldKits -= 1;
            this.recomputeColonyScore();
            spawnBurst(this.particles, cx, cy, '#60A5FA', 18, 150, 3.5);
            this.popups.push({ x: cx, y: cy - 14, text: 'PLOT SHIELD ACTIVE!', color: '#60A5FA', life: 1.2, maxLife: 1.2 });
            arcadeAudio.playDxShieldRepair();
          } else if (curPlot.outfit && curPlot.tier < 3) {
            const upCost = this.getUpgradeCost(curPlot.tier);
            if (this.cash >= upCost) {
              this.cash -= upCost;
              curPlot.tier += 1;
              this.recomputeColonyScore();
              spawnBurst(this.particles, cx, cy, '#FDE047', 24, 190, 4);
              this.popups.push({
                x: cx,
                y: cy - 16,
                text: `UPGRADED TO MK ${curPlot.tier}! (-$${upCost})`,
                color: '#FDE047',
                life: 1.3,
                maxLife: 1.3,
              });
              arcadeAudio.playPowerUp();
            } else {
              this.popups.push({
                x: cx,
                y: cy - 14,
                text: `MK ${curPlot.tier + 1} NEEDS $${upCost}`,
                color: '#F87171',
                life: 1.0,
                maxLife: 1.0,
              });
              arcadeAudio.playRockThud();
            }
          }
        }
      }
      return;
    }

    if (this.subPhase === 'PRODUCTION') {
      this.prodTimer -= dt;
      this.freighterX += 210 * dt;
      if (this.eventKind === 'pirate') this.pirateX += 260 * dt;
      if (this.prodTimer <= 0 || this.input.fireJustPressed) {
        this.subPhase = 'AUCTION';
        this.auctionIdx = 0;
        this.auctionTimer = 24;
      }
      return;
    }

    if (this.subPhase === 'AUCTION') {
      this.auctionTimer -= dt;
      for (let i = 1; i < 4; i++) {
        this.auctionBids[i] = 0.22 + 0.56 * (0.5 + 0.5 * Math.sin(this.time * (1.3 + i * 0.45) + i * 1.9));
      }

      const res = OUTFIT_ORDER[this.auctionIdx];
      const price = this.prices[res];

      if (leftJust && this.stock[res] > 0) {
        this.stock[res] -= 1;
        this.cash += price;
        this.auctionBids[0] = Math.max(0.14, this.auctionBids[0] - 0.14);
        this.recomputeColonyScore();
        arcadeAudio.playCoin();
      } else if (rightJust && this.cash >= price) {
        this.stock[res] += 1;
        this.cash -= price;
        this.auctionBids[0] = Math.min(0.86, this.auctionBids[0] + 0.14);
        this.recomputeColonyScore();
        arcadeAudio.playMoveTick();
      }

      if (upJust) {
        this.auctionIdx = (this.auctionIdx + 3) % 4;
        arcadeAudio.playMoveTick();
      }
      if (downJust) {
        this.auctionIdx = (this.auctionIdx + 1) % 4;
        arcadeAudio.playMoveTick();
      }

      if (this.input.secondaryJustPressed && this.privateDeal?.active) {
        const d = this.privateDeal;
        if (d.isBuyingFromPlayer && this.stock[d.kind] >= d.qty) {
          this.stock[d.kind] -= d.qty;
          this.cash += d.totalPrice;
          d.active = false;
          this.recomputeColonyScore();
          this.popups.push({
            x: LOGICAL_W * 0.5,
            y: 380,
            text: `PRIVATE DEAL CLOSED! +$${d.totalPrice}`,
            color: '#4ADE80',
            life: 1.4,
            maxLife: 1.4,
          });
          arcadeAudio.playExtraLife();
        } else if (!d.isBuyingFromPlayer && this.cash >= d.totalPrice) {
          this.cash -= d.totalPrice;
          this.stock[d.kind] += d.qty;
          d.active = false;
          this.recomputeColonyScore();
          this.popups.push({
            x: LOGICAL_W * 0.5,
            y: 380,
            text: `DEAL BOUGHT +${d.qty} ${d.kind.toUpperCase()}!`,
            color: '#22D3EE',
            life: 1.4,
            maxLife: 1.4,
          });
          arcadeAudio.playPowerUp();
        } else {
          arcadeAudio.playRockThud();
        }
      }

      if (this.input.fireJustPressed || this.auctionTimer <= 0) {
        this.month += 1;
        if (this.month > 12) {
          this.recomputeColonyScore();
          arcadeAudio.playStageClear();
          this.phase = 'GAME_OVER';
        } else {
          this.beginMonthGrant();
        }
      }
    }
  }

  private renderSkyAndSpyHud(ctx: CanvasRenderingContext2D): void {
    const sky = ctx.createLinearGradient(0, 0, 0, 112);
    sky.addColorStop(0, '#070B1A');
    sky.addColorStop(0.65, '#1B1124');
    sky.addColorStop(1, '#2D1411');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, LOGICAL_W, 112);

    ctx.fillStyle = 'rgba(253,224,71,0.22)';
    ctx.beginPath();
    ctx.arc(LOGICAL_W - 64, 24, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(56,189,248,0.25)';
    ctx.beginPath();
    ctx.arc(LOGICAL_W - 102, 34, 8, 0, Math.PI * 2);
    ctx.fill();

    if (this.subPhase === 'PRODUCTION') {
      const fx = Math.min(LOGICAL_W * 0.5, this.freighterX);
      ctx.fillStyle = '#CBD5E1';
      ctx.beginPath();
      ctx.roundRect(fx - 42, 16, 84, 16, 6);
      ctx.fill();
      ctx.fillStyle = '#22D3EE';
      ctx.fillRect(fx - 26, 20, 52, 5);
      ctx.fillStyle = 'rgba(34,211,238,0.16)';
      ctx.beginPath();
      ctx.moveTo(fx - 22, 32);
      ctx.lineTo(fx + 22, 32);
      ctx.lineTo(fx + 62, 112);
      ctx.lineTo(fx - 62, 112);
      ctx.closePath();
      ctx.fill();
    }

    const cards = [
      {
        spIdx: this.speciesIdx,
        name: `YOU · ${MULE_SPECIES[this.speciesIdx].name}`,
        cash: this.cash,
        score: this.score,
        stock: this.stock,
        isPlayer: true,
      },
      ...this.rivals.map((rv) => ({
        spIdx: rv.speciesIdx,
        name: rv.name,
        cash: rv.cash,
        score: rv.score,
        stock: rv.stock,
        isPlayer: false,
      })),
    ];

    cards.forEach((c, idx) => {
      const cx = 14 + idx * 210;
      const cy = 10;
      const cw = 202;
      const ch = 64;
      const sp = MULE_SPECIES[c.spIdx];
      ctx.fillStyle = c.isPlayer ? 'rgba(15,23,42,0.92)' : 'rgba(15,23,42,0.72)';
      ctx.beginPath();
      ctx.roundRect(cx, cy, cw, ch, 8);
      ctx.fill();
      ctx.strokeStyle = c.isPlayer ? sp.color : 'rgba(148,163,184,0.28)';
      ctx.lineWidth = c.isPlayer ? 2 : 1;
      ctx.stroke();

      const mood = c.stock.food <= 1 ? 'worried' : c.cash >= 700 ? 'happy' : 'neutral';
      drawAlienSprite(ctx, c.spIdx, cx + 22, cy + 34, 1.05, this.time, false, 1, mood);

      ctx.textAlign = 'left';
      ctx.fillStyle = sp.color;
      ctx.font = '900 10.5px "JetBrains Mono", monospace';
      ctx.fillText(c.name, cx + 44, cy + 18);
      ctx.fillStyle = '#4ADE80';
      ctx.font = '800 10.5px "JetBrains Mono", monospace';
      ctx.fillText(`$${c.cash}`, cx + 44, cy + 34);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#E2E8F0';
      ctx.font = '700 9.5px "JetBrains Mono", monospace';
      ctx.fillText(`VAL ${c.score}`, cx + cw - 8, cy + 34);

      ctx.textAlign = 'left';
      OUTFIT_ORDER.forEach((k, ri) => {
        const m = RESOURCE_META[k];
        ctx.fillStyle = m.color;
        ctx.font = '800 9px "JetBrains Mono", monospace';
        ctx.fillText(`${m.short}:${c.stock[k]}`, cx + 44 + ri * 38, cy + 53);
      });
    });

    ctx.fillStyle = 'rgba(7,10,22,0.9)';
    ctx.fillRect(0, 82, LOGICAL_W, 30);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FACC15';
    ctx.font = '900 11.5px "JetBrains Mono", monospace';
    ctx.fillText(`MONTH ${Math.min(12, this.month)}/12`, 16, 101);

    OUTFIT_ORDER.forEach((k, i) => {
      const m = RESOURCE_META[k];
      ctx.fillStyle = m.color;
      ctx.font = '800 11px "JetBrains Mono", monospace';
      ctx.fillText(`${m.label} $${this.prices[k]}`, 128 + i * 116, 101);
    });

    ctx.fillStyle = '#94A3B8';
    ctx.font = '800 10px "JetBrains Mono", monospace';
    ctx.fillText('JET-DASH', 606, 101);
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(674, 92, 86, 11);
    ctx.fillStyle = this.dashActive > 0 ? '#FDE047' : '#22D3EE';
    ctx.fillRect(674, 92, Math.round(86 * this.dashEnergy), 11);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.strokeRect(674, 92, 86, 11);

    ctx.fillStyle = '#60A5FA';
    ctx.textAlign = 'right';
    ctx.font = '800 10.5px "JetBrains Mono", monospace';
    ctx.fillText(`SHLD:${this.shieldKits}`, LOGICAL_W - 14, 101);
  }

  private renderSynergyConduits(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (const p of this.plots) {
      if (p.owner < 0 || !p.outfit) continue;
      const right = this.getPlot(p.col + 1, p.row);
      const down = this.getPlot(p.col, p.row + 1);
      const x1 = MAP_X + (p.col + 0.5) * TILE_W;
      const y1 = MAP_Y + (p.row + 0.5) * TILE_H;
      const col = RESOURCE_META[p.outfit].glow;

      const drawBeam = (x2: number, y2: number) => {
        ctx.strokeStyle = col;
        ctx.lineWidth = 3.2;
        ctx.globalAlpha = 0.45 + Math.sin(this.time * 7) * 0.25;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        const t = (this.time * 1.4) % 1;
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 2.8, 0, Math.PI * 2);
        ctx.fill();
      };

      if (right && right.owner === p.owner && right.outfit === p.outfit) {
        drawBeam(MAP_X + (right.col + 0.5) * TILE_W, MAP_Y + (right.row + 0.5) * TILE_H);
      }
      if (down && down.owner === p.owner && down.outfit === p.outfit) {
        drawBeam(MAP_X + (down.col + 0.5) * TILE_W, MAP_Y + (down.row + 0.5) * TILE_H);
      }
    }
    ctx.restore();
  }

  private renderPlazaInterior(ctx: CanvasRenderingContext2D): void {
    const py = 122;
    const ph = 370;
    const g = ctx.createLinearGradient(0, py, 0, py + ph);
    g.addColorStop(0, '#0F172A');
    g.addColorStop(0.55, '#1E1B4B');
    g.addColorStop(1, '#0F172A');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(24, py, LOGICAL_W - 48, ph, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(34,211,238,0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#67E8F9';
    ctx.font = '900 15px "JetBrains Mono", monospace';
    ctx.fillText(
      `IRATA MEGADOME PLAZA  ·  TETHER ${this.carryingQueue.length}/${this.getMaxCarry()}  ·  CLOCK ${Math.ceil(this.devTimer)}s`,
      LOGICAL_W * 0.5,
      py + 28
    );

    const activeBay = PLAZA_BAYS.find((b) => this.plazaX >= b.x && this.plazaX <= b.x + b.w);
    for (const bay of PLAZA_BAYS) {
      const isHot = activeBay?.id === bay.id;
      const by = py + 48;
      const bh = 186;
      ctx.fillStyle = isHot ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.78)';
      ctx.beginPath();
      ctx.roundRect(bay.x, by, bay.w, bh, 8);
      ctx.fill();
      ctx.strokeStyle = isHot ? bay.color : 'rgba(148,163,184,0.28)';
      ctx.lineWidth = isHot ? 3 : 1.2;
      ctx.stroke();

      ctx.fillStyle = bay.color;
      ctx.beginPath();
      ctx.roundRect(bay.x + 4, by + 4, bay.w - 8, 26, 5);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.font = '900 11px "JetBrains Mono", monospace';
      ctx.fillText(bay.label, bay.x + bay.w * 0.5, by + 21);

      const midX = bay.x + bay.w * 0.5;
      if (bay.id === 'food' || bay.id === 'energy' || bay.id === 'smithore' || bay.id === 'crystite') {
        drawMechanicalMule(ctx, midX, by + 88, bay.id, 1.35, this.time, isHot, 1);
        ctx.fillStyle = '#F8FAFC';
        ctx.font = '800 12px "JetBrains Mono", monospace';
        ctx.fillText(`$${this.getOutfitCost(bay.id)}`, midX, by + 138);
      } else if (bay.id === 'geoscan') {
        ctx.strokeStyle = '#22D3EE';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(midX, by + 86, 20, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(midX, by + 86, 6 + ((this.time * 22) % 14), 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#67E8F9';
        ctx.font = '800 11px "JetBrains Mono", monospace';
        ctx.fillText('$60 ALL', midX, by + 138);
      } else if (bay.id === 'shield') {
        ctx.strokeStyle = '#60A5FA';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(midX, by + 64);
        ctx.lineTo(midX + 18, by + 76);
        ctx.lineTo(midX + 13, by + 102);
        ctx.lineTo(midX, by + 112);
        ctx.lineTo(midX - 13, by + 102);
        ctx.lineTo(midX - 18, by + 76);
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = '#93C5FD';
        ctx.font = '800 11px "JetBrains Mono", monospace';
        ctx.fillText(`$${Math.round(110 * this.getDiscount())}`, midX, by + 138);
      } else if (bay.id === 'cantina') {
        const meter = 0.5 + 0.5 * Math.sin(this.cantinaWheelPhase);
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(midX - 28, by + 74, 56, 18);
        ctx.fillStyle = meter > 0.82 ? '#FDE047' : '#FB923C';
        ctx.fillRect(midX - 28, by + 74, Math.round(56 * meter), 18);
        ctx.strokeStyle = '#FEF08A';
        ctx.strokeRect(midX - 28, by + 74, 56, 18);
        ctx.fillStyle = meter > 0.82 ? '#FDE047' : '#FDBA74';
        ctx.font = '900 10.5px "JetBrains Mono", monospace';
        ctx.fillText(meter > 0.82 ? '2X HIT!' : 'TIME IT!', midX, by + 112);
        ctx.fillText(`+$${Math.round(65 + this.devTimer * 6.5)}`, midX, by + 138);
      } else {
        ctx.fillStyle = '#94A3B8';
        ctx.font = '900 20px "JetBrains Mono", monospace';
        ctx.fillText('▼', midX, by + 92);
        ctx.fillStyle = '#CBD5E1';
        ctx.font = '800 11px "JetBrains Mono", monospace';
        ctx.fillText('TO MAP', midX, by + 138);
      }

      if (isHot) {
        ctx.fillStyle = '#FEF08A';
        ctx.font = '800 9.5px "JetBrains Mono", monospace';
        ctx.fillText('[SPACE]', midX, by + 166);
      }
    }

    ctx.fillStyle = '#070C18';
    ctx.fillRect(42, py + 248, LOGICAL_W - 84, 98);
    ctx.strokeStyle = 'rgba(34,211,238,0.28)';
    ctx.strokeRect(42, py + 248, LOGICAL_W - 84, 98);
    drawAlienSprite(ctx, this.speciesIdx, this.plazaX, py + 298, 1.85, this.time, this.isMoving, this.plazaFacing, 'happy');
    this.carryingQueue.forEach((outfit, idx) => {
      drawMechanicalMule(
        ctx,
        this.plazaX - this.plazaFacing * (38 + idx * 32),
        py + 302,
        outfit,
        1.25,
        this.time,
        this.isMoving,
        this.plazaFacing
      );
    });
  }

  private renderAuctionExchange(ctx: CanvasRenderingContext2D): void {
    const py = 122;
    const ph = 376;
    ctx.fillStyle = '#091124';
    ctx.beginPath();
    ctx.roundRect(24, py, LOGICAL_W - 48, ph, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(34,211,238,0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const activeRes = OUTFIT_ORDER[this.auctionIdx];
    const meta = RESOURCE_META[activeRes];

    ctx.textAlign = 'center';
    ctx.fillStyle = '#67E8F9';
    ctx.font = '900 16px "JetBrains Mono", monospace';
    ctx.fillText(`IRATA EXCHANGE FLOOR  ·  MONTH ${this.month}  ·  ${Math.ceil(this.auctionTimer)}s`, LOGICAL_W * 0.5, py + 28);

    OUTFIT_ORDER.forEach((res, idx) => {
      const m = RESOURCE_META[res];
      const ry = py + 48 + idx * 74;
      const sel = idx === this.auctionIdx;
      ctx.fillStyle = sel ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.03)';
      ctx.beginPath();
      ctx.roundRect(42, ry, 270, 64, 8);
      ctx.fill();
      ctx.strokeStyle = sel ? m.color : 'rgba(148,163,184,0.22)';
      ctx.lineWidth = sel ? 2.4 : 1;
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.fillStyle = m.color;
      ctx.font = '900 13.5px "JetBrains Mono", monospace';
      ctx.fillText(m.label, 54, ry + 24);
      ctx.fillStyle = '#E2E8F0';
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.fillText(`STOCK: ${this.stock[res]}u`, 54, ry + 48);

      const hist = this.priceHistory[res];
      if (hist.length >= 2) {
        const minP = Math.min(...hist) - 5;
        const maxP = Math.max(...hist) + 5;
        ctx.strokeStyle = m.glow;
        ctx.lineWidth = 2;
        ctx.beginPath();
        hist.forEach((v, hi) => {
          const sx = 152 + (hi / (hist.length - 1)) * 78;
          const sy = ry + 48 - ((v - minP) / Math.max(1, maxP - minP)) * 30;
          if (hi === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        ctx.stroke();
      }

      ctx.textAlign = 'right';
      ctx.fillStyle = '#FEF08A';
      ctx.font = '900 15.5px "JetBrains Mono", monospace';
      ctx.fillText(`$${this.prices[res]}`, 300, ry + 37);
    });

    const chartX = 330;
    const chartY = py + 48;
    const chartW = 486;
    const chartH = 224;
    ctx.fillStyle = '#060A15';
    ctx.beginPath();
    ctx.roundRect(chartX, chartY, chartW, chartH, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(56,189,248,0.3)';
    ctx.stroke();

    const midY = chartY + chartH * 0.5;
    ctx.strokeStyle = meta.color;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(chartX + 12, midY);
    ctx.lineTo(chartX + chartW - 12, midY);
    ctx.stroke();
    ctx.setLineDash([]);

    const traders = [
      { spIdx: this.speciesIdx, name: 'YOU', bid: this.auctionBids[0], qty: this.stock[activeRes] },
      ...this.rivals.map((rv, i) => ({
        spIdx: rv.speciesIdx,
        name: rv.name.slice(0, 6),
        bid: this.auctionBids[i + 1],
        qty: rv.stock[activeRes],
      })),
    ];

    traders.forEach((tr, i) => {
      const lx = chartX + 68 + i * 116;
      const ly = chartY + 42 + tr.bid * (chartH - 86);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(lx, chartY + 26);
      ctx.lineTo(lx, chartY + chartH - 28);
      ctx.stroke();
      drawAlienSprite(ctx, tr.spIdx, lx, ly, 1.35, this.time, true, 1, i === 0 ? 'happy' : 'neutral');
      ctx.textAlign = 'center';
      ctx.fillStyle = i === 0 ? '#FACC15' : '#CBD5E1';
      ctx.font = '800 10px "JetBrains Mono", monospace';
      ctx.fillText(`${tr.name} (${tr.qty}u)`, lx, chartY + chartH - 10);
    });

    const dealY = chartY + chartH + 14;
    ctx.fillStyle = this.privateDeal?.active ? 'rgba(250,204,21,0.12)' : 'rgba(255,255,255,0.03)';
    ctx.beginPath();
    ctx.roundRect(chartX, dealY, chartW, 56, 8);
    ctx.fill();
    ctx.strokeStyle = this.privateDeal?.active ? '#FACC15' : 'rgba(148,163,184,0.2)';
    ctx.stroke();

    ctx.textAlign = 'center';
    if (this.privateDeal?.active) {
      const d = this.privateDeal;
      ctx.fillStyle = '#FEF08A';
      ctx.font = '900 12px "JetBrains Mono", monospace';
      ctx.fillText(
        d.isBuyingFromPlayer
          ? `PRIVATE OFFER (${d.rivalName}): SELL ${d.qty} ${d.kind.toUpperCase()} FOR +$${d.totalPrice} (+25%!)`
          : `PRIVATE OFFER (${d.rivalName}): BUY ${d.qty} ${d.kind.toUpperCase()} FOR $${d.totalPrice} (-20%!)`,
        chartX + chartW * 0.5,
        dealY + 24
      );
      ctx.fillStyle = '#4ADE80';
      ctx.font = '800 11px "JetBrains Mono", monospace';
      ctx.fillText('PRESS SHIFT / SECONDARY TO ACCEPT PRIVATE DEAL!', chartX + chartW * 0.5, dealY + 44);
    } else {
      ctx.fillStyle = '#94A3B8';
      ctx.font = '700 11.5px "JetBrains Mono", monospace';
      ctx.fillText('PRIVATE RIVAL TRADE COMPLETED FOR THIS MONTH', chartX + chartW * 0.5, dealY + 32);
    }
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.save();
    ctx.scale(dpr, dpr);

    const bg = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
    bg.addColorStop(0, '#090D1D');
    bg.addColorStop(0.5, '#26120F');
    bg.addColorStop(1, '#120A0E');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    this.renderSkyAndSpyHud(ctx);

    const sp = MULE_SPECIES[this.speciesIdx];
    const ownerColors = [
      sp.color,
      MULE_SPECIES[this.rivals[0]?.speciesIdx ?? 1].color,
      MULE_SPECIES[this.rivals[1]?.speciesIdx ?? 4].color,
      MULE_SPECIES[this.rivals[2]?.speciesIdx ?? 6].color,
    ];

    if (this.subPhase === 'PLAZA' && this.phase === 'PLAYING') {
      this.renderPlazaInterior(ctx);
    } else if (this.subPhase === 'AUCTION' && this.phase === 'PLAYING') {
      this.renderAuctionExchange(ctx);
    } else {
      for (const p of this.plots) {
        const x = MAP_X + p.col * TILE_W;
        const y = MAP_Y + p.row * TILE_H;
        drawIrataPlotTile(
          ctx,
          x,
          y,
          TILE_W,
          TILE_H,
          p.terrain,
          p.col,
          p.row,
          p.owner >= 0 ? ownerColors[p.owner] : null,
          p.outfit,
          p.tier,
          p.shielded,
          p.assayed ? p.crystiteRichness : null,
          this.time,
          true
        );
      }

      this.renderSynergyConduits(ctx);

      ctx.fillStyle = 'rgba(253,230,138,0.22)';
      for (const m of this.dustMotes) {
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (this.scanWave.active) {
        ctx.strokeStyle = 'rgba(34,211,238,0.85)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(this.scanWave.x, this.scanWave.y, this.scanWave.radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (this.subPhase === 'DEVELOP' && this.supplyPod.active) {
        const sx = this.supplyPod.x;
        const sy = this.supplyPod.y + this.supplyPod.dropY;
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 8);
        ctx.strokeStyle = `rgba(34,211,238,${0.4 + pulse * 0.5})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.supplyPod.x, this.supplyPod.y, 13 + pulse * 5, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#0EA5E9';
        ctx.strokeStyle = '#E0F2FE';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.roundRect(sx - 10, sy - 9, 20, 18, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FEF08A';
        ctx.font = '900 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('POD', sx, sy + 3);
      }

      if (this.subPhase === 'DEVELOP' && this.wampus.active) {
        const wx = MAP_X + (this.wampus.c + 0.5) * TILE_W;
        const wy = MAP_Y + (this.wampus.r + 0.5) * TILE_H;
        drawWampus(ctx, wx, wy, this.time, this.wampus.golden);
      }

      if (this.subPhase === 'DEVELOP' || this.phase === 'TITLE') {
        for (const rv of this.rivals) {
          if (rv.carrying) {
            ctx.strokeStyle = MULE_SPECIES[rv.speciesIdx].color;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(rv.x, rv.y);
            ctx.lineTo(rv.muleX, rv.muleY);
            ctx.stroke();
            drawMechanicalMule(ctx, rv.muleX, rv.muleY, rv.carrying, 0.95, this.time, true, rv.facing);
          }
          drawAlienSprite(ctx, rv.speciesIdx, rv.x, rv.y, 1.05, this.time, true, rv.facing, 'neutral');
        }
      }

      if (this.subPhase === 'PRODUCTION') {
        if (this.eventKind === 'rain') {
          ctx.strokeStyle = 'rgba(125,211,252,0.6)';
          ctx.lineWidth = 1.8;
          for (let i = 0; i < 42; i++) {
            const rx = ((i * 71 + this.time * 200) % (MAP_COLS * TILE_W)) + MAP_X;
            const ry = ((i * 37 + this.time * 340) % (MAP_ROWS * TILE_H)) + MAP_Y;
            ctx.beginPath();
            ctx.moveTo(rx, ry);
            ctx.lineTo(rx - 5, ry + 12);
            ctx.stroke();
          }
        } else if (this.eventKind === 'sun') {
          ctx.fillStyle = `rgba(250,204,21,${0.14 + Math.sin(this.time * 9) * 0.08})`;
          ctx.fillRect(MAP_X, MAP_Y, MAP_COLS * TILE_W, MAP_ROWS * TILE_H);
        } else if (this.eventKind === 'pirate') {
          ctx.fillStyle = '#991B1B';
          ctx.strokeStyle = '#FCA5A5';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(this.pirateX + 36, MAP_Y + 140);
          ctx.lineTo(this.pirateX - 28, MAP_Y + 114);
          ctx.lineTo(this.pirateX - 18, MAP_Y + 140);
          ctx.lineTo(this.pirateX - 28, MAP_Y + 166);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }

        for (const d of this.drones) {
          ctx.fillStyle = d.color;
          ctx.beginPath();
          ctx.roundRect(d.x - 5, d.y - 4, 10, 8, 2);
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }

      if (this.subPhase === 'GRANT' && this.phase === 'PLAYING') {
        const cx = MAP_X + this.cursorC * TILE_W;
        const cy = MAP_Y + this.cursorR * TILE_H;
        ctx.strokeStyle = '#22D3EE';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.roundRect(cx + 2, cy + 2, TILE_W - 4, TILE_H - 4, 6);
        ctx.stroke();
      }

      if (this.subPhase === 'DEVELOP' || this.phase === 'TITLE') {
        const list = this.phase === 'TITLE' ? (['crystite'] as MuleResourceKind[]) : this.carryingQueue;
        let lx = this.px;
        let ly = this.py;
        list.forEach((outfit, idx) => {
          const m = this.muleCoords[idx];
          ctx.strokeStyle = '#22D3EE';
          ctx.lineWidth = 2.2;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.lineTo(m.x, m.y);
          ctx.stroke();
          ctx.setLineDash([]);
          drawMechanicalMule(ctx, m.x, m.y, outfit, 1.15, this.time, this.isMoving, this.facing);
          lx = m.x;
          ly = m.y;
        });
        drawAlienSprite(ctx, this.speciesIdx, this.px, this.py, 1.38, this.time, this.isMoving, this.facing, 'happy');
      }

      if (this.subPhase === 'SPECIES' && this.phase === 'PLAYING') {
        ctx.fillStyle = 'rgba(7,10,22,0.92)';
        ctx.beginPath();
        ctx.roundRect(48, 128, LOGICAL_W - 96, 354, 14);
        ctx.fill();
        ctx.strokeStyle = 'rgba(34,211,238,0.55)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.fillStyle = '#67E8F9';
        ctx.font = '900 17px "JetBrains Mono", monospace';
        ctx.fillText('M.U.L.E. RETURNS: EVOLVED — CHOOSE YOUR ALIEN COMMANDER', LOGICAL_W * 0.5, 158);

        MULE_SPECIES.forEach((s, idx) => {
          const col = idx % 4;
          const row = Math.floor(idx / 4);
          const bx = 68 + col * 184;
          const by = 176 + row * 142;
          const active = idx === this.speciesIdx;

          ctx.fillStyle = active ? 'rgba(34,211,238,0.16)' : 'rgba(255,255,255,0.03)';
          ctx.beginPath();
          ctx.roundRect(bx, by, 172, 128, 10);
          ctx.fill();
          ctx.strokeStyle = active ? s.color : 'rgba(148,163,184,0.22)';
          ctx.lineWidth = active ? 2.6 : 1;
          ctx.stroke();

          drawAlienSprite(ctx, idx, bx + 86, by + 40, 1.55, this.time, active, 1, active ? 'happy' : 'neutral');

          ctx.fillStyle = s.color;
          ctx.font = '900 12px "JetBrains Mono", monospace';
          ctx.fillText(`${s.name} · $${s.startCash}`, bx + 86, by + 76);
          ctx.fillStyle = '#FDE047';
          ctx.font = '800 9.5px "JetBrains Mono", monospace';
          ctx.fillText(s.evoAbility.toUpperCase(), bx + 86, by + 95);
          ctx.fillStyle = '#CBD5E1';
          ctx.font = '700 8.5px "JetBrains Mono", monospace';
          ctx.fillText(s.evoPerk.slice(0, 26), bx + 86, by + 114);
        });
      }
    }

    const stripY = MAP_Y + MAP_ROWS * TILE_H + 14;
    ctx.fillStyle = 'rgba(7,11,24,0.95)';
    ctx.beginPath();
    ctx.roundRect(MAP_X, stripY, MAP_COLS * TILE_W, 118, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(34,211,238,0.42)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'center';
    if (this.subPhase === 'SPECIES' && this.phase === 'PLAYING') {
      ctx.fillStyle = sp.color;
      ctx.font = '900 16px "JetBrains Mono", monospace';
      ctx.fillText(`${sp.name} · ${sp.evoPerk}`, LOGICAL_W * 0.5, stripY + 42);
      ctx.fillStyle = '#CBD5E1';
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillText('ARROWS CHOOSE COMMANDER  ·  SPACE TO DEPLOY TO PLANET IRATA', LOGICAL_W * 0.5, stripY + 78);
    } else if (this.subPhase === 'GRANT' && this.phase === 'PLAYING') {
      const hover = this.getPlot(this.cursorC, this.cursorR);
      const hint =
        hover?.terrain === 'river'
          ? 'RIVER SECTOR — MAX FOOD YIELD + PAIR ADJACENT FOR SYNERGY!'
          : hover?.terrain.startsWith('mtn')
          ? 'MOUNTAIN SECTOR — HIGH SMITHORE & CRYSTITE VEINS!'
          : hover?.terrain === 'town'
          ? 'COLONY MEGADOME — CENTRAL HUB'
          : 'PLAINS SECTOR — MAX SOLAR ENERGY + EASY SYNERGY LINKS!';
      ctx.fillStyle = '#4ADE80';
      ctx.font = '900 15px "JetBrains Mono", monospace';
      ctx.fillText(`MONTH ${this.month} SECTOR GRANT — PICK A PLOT & PRESS SPACE`, LOGICAL_W * 0.5, stripY + 40);
      ctx.fillStyle = '#67E8F9';
      ctx.font = '800 12.5px "JetBrains Mono", monospace';
      ctx.fillText(hint, LOGICAL_W * 0.5, stripY + 76);
    } else if (this.subPhase === 'PLAZA' && this.phase === 'PLAYING') {
      ctx.fillStyle = '#67E8F9';
      ctx.font = '900 14.5px "JetBrains Mono", monospace';
      ctx.fillText('LEFT/RIGHT CHOOSE BAY  ·  SPACE = BUY M.U.L.E., GEO-SCAN, SHIELD OR CANTINA JACKPOT', LOGICAL_W * 0.5, stripY + 42);
      ctx.fillStyle = '#94A3B8';
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillText('PRESS DOWN OR ENTER EXIT BAY TO RETURN TO PLANET IRATA', LOGICAL_W * 0.5, stripY + 76);
    } else if (this.subPhase === 'DEVELOP' && this.phase === 'PLAYING') {
      const curCol = Math.max(0, Math.min(MAP_COLS - 1, Math.floor((this.px - MAP_X) / TILE_W)));
      const curRow = Math.max(0, Math.min(MAP_ROWS - 1, Math.floor((this.py - MAP_Y) / TILE_H)));
      const cp = this.getPlot(curCol, curRow);
      let line1 = 'ENTER COLONY HUB (CENTER) + SPACE FOR M.U.L.E.s, GEO-SCAN, SHIELDS & CANTINA';
      if (this.carryingQueue.length > 0) {
        line1 = `TETHERED ${this.carryingQueue.map((k) => k.toUpperCase()).join(' + ')} — WALK TO OWNED PLOT + SPACE TO INSTALL!`;
      } else if (cp && cp.owner === 0 && cp.outfit && cp.tier < 3) {
        line1 = `OWNED ${cp.outfit.toUpperCase()} MK ${cp.tier} — PRESS SPACE TO UPGRADE TO MK ${cp.tier + 1} ($${this.getUpgradeCost(cp.tier)})!`;
      } else if (cp && cp.owner === 0 && this.shieldKits > 0 && !cp.shielded) {
        line1 = 'PRESS SPACE TO DEPLOY PLOT DEFENSE SHIELD ON THIS SECTOR!';
      }
      ctx.fillStyle = '#67E8F9';
      ctx.font = '900 13.5px "JetBrains Mono", monospace';
      ctx.fillText(line1, LOGICAL_W * 0.5, stripY + 40);
      ctx.fillStyle = '#FACC15';
      ctx.font = '800 12.5px "JetBrains Mono", monospace';
      ctx.fillText(
        `CLOCK ${Math.ceil(this.devTimer)}s · SHIFT = JET-DASH · RACE RIVALS FOR SUPPLY PODS & GOLDEN WAMPUS!`,
        LOGICAL_W * 0.5,
        stripY + 76
      );
    } else if (this.subPhase === 'PRODUCTION' && this.phase === 'PLAYING') {
      ctx.fillStyle = '#FDE047';
      ctx.font = '900 15px "JetBrains Mono", monospace';
      ctx.fillText(this.eventHeadline, LOGICAL_W * 0.5, stripY + 42);
      ctx.fillStyle = '#67E8F9';
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillText('ORBITAL FREIGHTER HARVESTING DRONES · PRESS SPACE FOR EXCHANGE FLOOR', LOGICAL_W * 0.5, stripY + 76);
    } else if (this.subPhase === 'AUCTION' && this.phase === 'PLAYING') {
      const res = OUTFIT_ORDER[this.auctionIdx];
      ctx.fillStyle = '#FACC15';
      ctx.font = '900 14px "JetBrains Mono", monospace';
      ctx.fillText(
        `UP/DN COMMODITY · LEFT SELL (+$${this.prices[res]}) · RIGHT BUY (-$${this.prices[res]}) · SHIFT = PRIVATE DEAL`,
        LOGICAL_W * 0.5,
        stripY + 40
      );
      ctx.fillStyle = '#4ADE80';
      ctx.font = '800 12.5px "JetBrains Mono", monospace';
      ctx.fillText('PRESS SPACE TO FINISH AUCTION & BEGIN NEXT MONTH', LOGICAL_W * 0.5, stripY + 76);
    } else {
      ctx.fillStyle = '#67E8F9';
      ctx.font = '900 16px "JetBrains Mono", monospace';
      ctx.fillText('M.U.L.E. RETURNS: EVOLVED — SYNERGY CONDUITS · MK III RIGS · LIVE AI RIVALS', LOGICAL_W * 0.5, stripY + 42);
      ctx.fillStyle = '#CBD5E1';
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillText('SPY-HUD · JET-DASH · GEO-SCANNER · SUPPLY PODS · SHIELDS · PRIVATE RIVAL DEALS', LOGICAL_W * 0.5, stripY + 78);
    }

    renderParticlesAndPopups(ctx, this.particles, this.popups);
    if (visualMode === 'crt') renderCrtOverlay(ctx, LOGICAL_W, LOGICAL_H);
    ctx.restore();
  }

  public getHudSnapshot(): ClassicGameHud {
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.month,
      lives: Math.max(0, 13 - this.month),
      stageName: `M.U.L.E. EVO · MONTH ${Math.min(12, this.month)} (${this.subPhase})`,
      primaryMetricLabel: 'CASH',
      primaryMetricValue: `$${this.cash}`,
      secondaryMetricLabel: 'ABILITY',
      secondaryMetricValue: MULE_SPECIES[this.speciesIdx].evoAbility.toUpperCase(),
      bannerText:
        this.phase === 'TITLE'
          ? 'M.U.L.E. RETURNS: EVOLVED — PLANET IRATA 2.0'
          : this.phase === 'GAME_OVER'
          ? `COLONY COMPLETE! FINAL VALUE ${this.score.toLocaleString()}`
          : '',
      canRestartStage: true,
    };
  }
}

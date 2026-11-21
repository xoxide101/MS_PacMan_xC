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

const LOGICAL_W = 800;
const LOGICAL_H = 600;
const MAP_COLS = 9;
const MAP_ROWS = 5;
const TILE_W = 82;
const TILE_H = 74;
const MAP_X = Math.floor((LOGICAL_W - MAP_COLS * TILE_W) / 2); // 31
const MAP_Y = 86;

type TurnSubPhase = 'SPECIES' | 'GRANT' | 'DEVELOP' | 'TOWN' | 'PRODUCTION' | 'AUCTION';

interface IrataPlot {
  col: number;
  row: number;
  terrain: MuleTerrainKind;
  owner: number; // -1 unowned, 0 player, 1..3 AI rivals
  outfit: MuleResourceKind | null;
  crystiteRichness: number; // 0..3
  assayed: boolean;
}

interface RivalColony {
  speciesIdx: number;
  name: string;
  cash: number;
  stock: Record<MuleResourceKind, number>;
  score: number;
}

interface TownBay {
  id: 'food' | 'energy' | 'smithore' | 'crystite' | 'assay' | 'pub' | 'exit';
  label: string;
  sub: string;
  x: number;
  w: number;
  color: string;
}

const TOWN_BAYS: TownBay[] = [
  { id: 'food', label: 'FOOD', sub: '$125', x: 52, w: 92, color: '#4ADE80' },
  { id: 'energy', label: 'ENERGY', sub: '$150', x: 152, w: 92, color: '#FACC15' },
  { id: 'smithore', label: 'ORE', sub: '$175', x: 252, w: 92, color: '#38BDF8' },
  { id: 'crystite', label: 'CRYST', sub: '$200', x: 352, w: 92, color: '#E879F9' },
  { id: 'assay', label: 'ASSAY', sub: 'SCAN', x: 452, w: 92, color: '#A78BFA' },
  { id: 'pub', label: 'PUB', sub: 'GAMBLE', x: 552, w: 92, color: '#FB923C' },
  { id: 'exit', label: 'EXIT', sub: 'TO MAP', x: 652, w: 96, color: '#94A3B8' },
];

const OUTFIT_ORDER: MuleResourceKind[] = ['food', 'energy', 'smithore', 'crystite'];

export class MuleArcadeGame implements ArcadeGameInstance {
  public readonly logicalWidth = LOGICAL_W;
  public readonly logicalHeight = LOGICAL_H;
  public readonly supportsPointerAim = true;
  public readonly primaryActionLabel = 'Select / Act';
  public readonly secondaryActionLabel = 'Cycle / Quick Town';

  private readonly storageKey = 'mule_hd_highscore_v1';
  private phase: ClassicGamePhase = 'TITLE';
  private subPhase: TurnSubPhase = 'SPECIES';
  private score = 0;
  private highScore = 0;
  private month = 1; // 1..12
  private input: ArcadeInputState = createEmptyInput();
  private prevDir = { up: false, down: false, left: false, right: false };

  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];
  private time = 0;

  private speciesIdx = 0;
  private plots: IrataPlot[] = [];
  private cursorC = 4;
  private cursorR = 1;

  // Player Colony Inventory
  private cash = 1000;
  private stock: Record<MuleResourceKind, number> = { food: 4, energy: 4, smithore: 0, crystite: 0 };
  private prices: Record<MuleResourceKind, number> = { food: 35, energy: 28, smithore: 55, crystite: 95 };
  private rivals: RivalColony[] = [];

  // Real-Time Development Phase state
  private px = LOGICAL_W * 0.5;
  private py = MAP_Y + 2.5 * TILE_H;
  private facing = 1;
  private isMoving = false;
  private muleX = LOGICAL_W * 0.5;
  private muleY = MAP_Y + 2.5 * TILE_H;
  private carryingOutfit: MuleResourceKind | null = null;
  private selectedOutfitIdx = 0;
  private devTimer = 34;

  // Town Interior Corridor walker
  private townX = 198;
  private townFacing = 1;

  // Mountain Wampus
  private wampus = { active: false, c: 1, r: 1 };

  // Production / Weather Event state
  private eventHeadline = '';
  private eventKind: 'sun' | 'rain' | 'pirate' | 'meteor' | 'quake' | 'none' = 'none';
  private prodTimer = 0;
  private prodOrbs: Array<{ x: number; y: number; vy: number; color: string; life: number }> = [];

  // Visual Auction state
  private auctionIdx = 0;
  private auctionTimer = 20;
  private auctionBids: number[] = [0.5, 0.4, 0.6, 0.5]; // normalized vertical positions 0..1

  constructor() {
    this.highScore = readHighScore(this.storageKey);
    this.initPlanet();
    this.initRivals();
  }

  private initRivals(): void {
    const picks = [1, 4, 6].map((i) => (i === this.speciesIdx ? (i + 2) % MULE_SPECIES.length : i));
    this.rivals = picks.map((spIdx) => ({
      speciesIdx: spIdx,
      name: MULE_SPECIES[spIdx].name,
      cash: MULE_SPECIES[spIdx].startCash,
      stock: { food: 4, energy: 4, smithore: 0, crystite: 0 },
      score: 1200,
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
          const hash = (c * 13 + r * 7 + (c ^ r)) % 11;
          if (hash <= 1) terrain = 'mtn3';
          else if (hash <= 3) terrain = 'mtn2';
          else if (hash <= 5) terrain = 'mtn1';
        }
        this.plots.push({
          col: c,
          row: r,
          terrain,
          owner: -1,
          outfit: null,
          crystiteRichness: terrain.startsWith('mtn') ? 1 + Math.floor(Math.random() * 3) : Math.random() < 0.25 ? 1 : 0,
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
    this.prodOrbs = [];
    this.initPlanet();
    this.initRivals();
    this.applySpeciesStart();
    arcadeAudio.playArcadeStart();
  }

  private applySpeciesStart(): void {
    const sp = MULE_SPECIES[this.speciesIdx];
    this.cash = sp.startCash;
    this.stock = { food: 4, energy: 4, smithore: 0, crystite: 0 };
    this.prices = { food: 35, energy: 28, smithore: 55, crystite: 95 };
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

  private getPlot(c: number, r: number): IrataPlot | undefined {
    return this.plots[r * MAP_COLS + c];
  }

  private getOutfitCost(kind: MuleResourceKind): number {
    const base = RESOURCE_META[kind].baseCost;
    return Math.round(base * (this.speciesIdx === 4 ? 0.8 : 1));
  }

  private recomputeColonyScore(): void {
    const ownedPlots = this.plots.filter((p) => p.owner === 0);
    const landVal = ownedPlots.length * 500 + ownedPlots.filter((p) => p.outfit).length * 250;
    const goodsVal =
      this.stock.food * this.prices.food +
      this.stock.energy * this.prices.energy +
      this.stock.smithore * this.prices.smithore +
      this.stock.crystite * this.prices.crystite;
    const raw = Math.round(this.cash + landVal + goodsVal);
    this.score = this.speciesIdx === 1 ? Math.round(raw * 1.15) : raw;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(this.storageKey, this.highScore);
    }
  }

  private beginMonthGrant(): void {
    this.subPhase = 'GRANT';
    this.cursorC = 4;
    this.cursorR = 1;
    const open = this.plots.filter((p) => p.owner === -1 && p.terrain !== 'town');
    for (let ai = 1; ai <= 3 && open.length > 0; ai++) {
      const idx = Math.floor(Math.random() * open.length);
      const p = open.splice(idx, 1)[0];
      p.owner = ai;
      p.outfit = p.terrain === 'river' ? 'food' : p.terrain.startsWith('mtn') ? 'smithore' : 'energy';
    }
  }

  private beginDevelopment(): void {
    this.subPhase = 'DEVELOP';
    const sp = MULE_SPECIES[this.speciesIdx];
    this.devTimer = sp.devTime;
    this.px = MAP_X + 4.5 * TILE_W;
    this.py = MAP_Y + 2.5 * TILE_H;
    this.muleX = this.px;
    this.muleY = this.py;
    this.carryingOutfit = null;

    const mtns = this.plots.filter((p) => p.terrain.startsWith('mtn'));
    if (mtns.length > 0) {
      const pick = mtns[Math.floor(Math.random() * mtns.length)];
      this.wampus = { active: true, c: pick.col, r: pick.row };
    }
  }

  private runProductionPhase(): void {
    if (this.carryingOutfit) {
      this.popups.push({
        x: this.muleX,
        y: this.muleY - 12,
        text: 'M.U.L.E. RAN AWAY!',
        color: '#F87171',
        life: 1.4,
        maxLife: 1.4,
      });
      this.carryingOutfit = null;
    }
    this.subPhase = 'PRODUCTION';
    this.prodTimer = 3.8;
    this.prodOrbs = [];

    const events: Array<{ msg: string; kind: 'sun' | 'rain' | 'pirate' | 'meteor' | 'quake' }> = [
      { msg: 'SUNSPOT ACTIVITY! +2 ENERGY PER SOLAR PLOT!', kind: 'sun' },
      { msg: 'IRATA ACID RAIN! +2 FOOD ON RIVER PLOTS!', kind: 'rain' },
      { msg: 'SPACE PIRATE RAID! SMITHORE PRICES SURGE!', kind: 'pirate' },
      { msg: 'CRYSTITE METEOR SHOWER! BOOM MARKET!', kind: 'meteor' },
      { msg: 'PLANETQUAKE! MINERAL OUTPUT SPIKES!', kind: 'quake' },
    ];
    const ev = events[Math.floor(Math.random() * events.length)];
    this.eventHeadline = ev.msg;
    this.eventKind = ev.kind;

    if (ev.kind === 'pirate') this.prices.smithore = Math.min(165, this.prices.smithore + 35);
    if (ev.kind === 'meteor') this.prices.crystite = Math.min(240, this.prices.crystite + 45);

    const myPlots = this.plots.filter((p) => p.owner === 0 && p.outfit !== null);
    let energyAvail = this.stock.energy;

    for (const p of myPlots) {
      if (!p.outfit) continue;
      if (p.outfit !== 'energy') {
        if (energyAvail <= 0) continue;
        energyAvail -= 1;
      }
      let gained = 0;
      if (p.outfit === 'food') {
        const base = p.terrain === 'river' ? 4 : p.terrain === 'plains' ? 2 : 1;
        gained = base + (ev.kind === 'rain' && p.terrain === 'river' ? 2 : 0) + (this.speciesIdx === 7 ? 1 : 0);
        this.stock.food += gained;
      } else if (p.outfit === 'energy') {
        const base = p.terrain === 'plains' ? 4 : p.terrain === 'river' ? 2 : 1;
        gained = base + (ev.kind === 'sun' ? 2 : 0);
        this.stock.energy += gained;
      } else if (p.outfit === 'smithore') {
        const mtnBonus =
          p.terrain === 'mtn3' ? 4 : p.terrain === 'mtn2' ? 3 : p.terrain === 'mtn1' ? 2 : 1;
        gained = mtnBonus + (this.speciesIdx === 6 ? 1 : 0) + (ev.kind === 'quake' ? 1 : 0);
        this.stock.smithore += gained;
      } else if (p.outfit === 'crystite') {
        gained = Math.max(1, p.crystiteRichness) + (this.speciesIdx === 5 ? 1 : 0);
        this.stock.crystite += gained;
      }

      const cx = MAP_X + (p.col + 0.5) * TILE_W;
      const cy = MAP_Y + (p.row + 0.5) * TILE_H;
      const col = RESOURCE_META[p.outfit].color;
      for (let k = 0; k < Math.min(6, gained); k++) {
        this.prodOrbs.push({
          x: cx + (Math.random() - 0.5) * 26,
          y: cy + (Math.random() - 0.5) * 16,
          vy: -24 - Math.random() * 20,
          color: col,
          life: 2.2 + Math.random() * 0.8,
        });
      }
      this.popups.push({
        x: cx,
        y: cy - 10,
        text: `+${gained} ${RESOURCE_META[p.outfit].short}`,
        color: col,
        life: 1.8,
        maxLife: 1.8,
      });
    }

    this.stock.food = Math.max(0, this.stock.food - 2);
    this.stock.energy = Math.max(0, this.stock.energy - Math.min(2, myPlots.length));

    for (const rv of this.rivals) {
      rv.cash += 120 + Math.floor(Math.random() * 140);
      rv.stock.food = Math.max(1, rv.stock.food + Math.floor(Math.random() * 3) - 1);
      rv.stock.energy = Math.max(1, rv.stock.energy + Math.floor(Math.random() * 3) - 1);
      rv.stock.smithore += Math.floor(Math.random() * 2);
      rv.score += 240 + Math.floor(Math.random() * 240);
    }

    this.prices.food = Math.max(20, Math.min(115, this.prices.food + Math.round((Math.random() - 0.45) * 16)));
    this.prices.energy = Math.max(18, Math.min(105, this.prices.energy + Math.round((Math.random() - 0.45) * 16)));
    this.prices.smithore = Math.max(38, Math.min(170, this.prices.smithore + Math.round((Math.random() - 0.45) * 20)));
    this.prices.crystite = Math.max(60, Math.min(245, this.prices.crystite + Math.round((Math.random() - 0.45) * 30)));

    this.recomputeColonyScore();
    arcadeAudio.playCoin();
  }

  private activateTownBay(bay: TownBay): void {
    if (bay.id === 'exit') {
      this.subPhase = 'DEVELOP';
      this.px = MAP_X + 4.5 * TILE_W;
      this.py = MAP_Y + 1.85 * TILE_H;
      this.muleX = this.px;
      this.muleY = this.py;
      arcadeAudio.playMoveTick();
      return;
    }
    if (bay.id === 'assay') {
      let revealed = 0;
      for (const p of this.plots) {
        if (p.owner === 0 && !p.assayed) {
          p.assayed = true;
          revealed++;
        }
      }
      this.popups.push({
        x: LOGICAL_W * 0.5,
        y: 250,
        text: revealed > 0 ? `ASSAYED ${revealed} OWNED PLOTS!` : 'ALL OWNED PLOTS ASSAYED!',
        color: '#E879F9',
        life: 1.3,
        maxLife: 1.3,
      });
      arcadeAudio.playGemChime(2);
      return;
    }
    if (bay.id === 'pub') {
      const pubBonus = Math.round(55 + this.devTimer * 6.5);
      this.cash += pubBonus;
      this.carryingOutfit = null;
      this.recomputeColonyScore();
      this.popups.push({
        x: LOGICAL_W * 0.5,
        y: 245,
        text: `IRATA PUB WIN +$${pubBonus}!`,
        color: '#4ADE80',
        life: 1.4,
        maxLife: 1.4,
      });
      arcadeAudio.playExtraLife();
      this.runProductionPhase();
      return;
    }

    // Buy / Outfit M.U.L.E.
    const kind = bay.id;
    const cost = this.getOutfitCost(kind);
    if (this.cash >= cost) {
      this.cash -= cost;
      this.carryingOutfit = kind;
      this.selectedOutfitIdx = OUTFIT_ORDER.indexOf(kind);
      this.recomputeColonyScore();
      this.popups.push({
        x: LOGICAL_W * 0.5,
        y: 245,
        text: `${RESOURCE_META[kind].label} M.U.L.E. EQUIPPED (-$${cost})`,
        color: RESOURCE_META[kind].color,
        life: 1.2,
        maxLife: 1.2,
      });
      arcadeAudio.playPowerUp();
      // Exit straight to map so player can install right away!
      this.subPhase = 'DEVELOP';
      this.px = MAP_X + 4.5 * TILE_W;
      this.py = MAP_Y + 1.85 * TILE_H;
      this.muleX = this.px;
      this.muleY = this.py;
    } else {
      this.popups.push({
        x: LOGICAL_W * 0.5,
        y: 245,
        text: `NEED $${cost} — VISIT PUB TO EARN CASH!`,
        color: '#F87171',
        life: 1.1,
        maxLife: 1.1,
      });
      arcadeAudio.playRockThud();
    }
  }

  public step(dt: number): void {
    this.time += dt;
    stepParticlesAndPopups(this.particles, this.popups, dt);
    for (let i = this.prodOrbs.length - 1; i >= 0; i--) {
      const o = this.prodOrbs[i];
      o.y += o.vy * dt;
      o.life -= dt;
      if (o.life <= 0) this.prodOrbs.splice(i, 1);
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
      this.px = LOGICAL_W * 0.5 + Math.cos(this.time * 0.85) * 165;
      this.py = MAP_Y + 2.5 * TILE_H + Math.sin(this.time * 0.85) * 85;
      this.facing = this.px >= prevX ? 1 : -1;
      this.isMoving = true;
      const dx = this.px - this.muleX;
      const dy = this.py - this.muleY;
      const d = Math.hypot(dx, dy);
      if (d > 28) {
        this.muleX += (dx / d) * (d - 28) * Math.min(1, dt * 8);
        this.muleY += (dy / d) * (d - 28) * Math.min(1, dt * 8);
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
          const cx = MAP_X + (plot.col + 0.5) * TILE_W;
          const cy = MAP_Y + (plot.row + 0.5) * TILE_H;
          spawnBurst(this.particles, cx, cy, '#FACC15', 18, 165, 3.8);
          this.popups.push({ x: cx, y: cy, text: 'DEED CLAIMED!', color: '#4ADE80', life: 1.0, maxLife: 1.0 });
          arcadeAudio.playCoin();
          this.recomputeColonyScore();
          this.beginDevelopment();
        } else {
          arcadeAudio.playRockThud();
        }
      }
      return;
    }

    if (this.subPhase === 'TOWN') {
      this.devTimer -= dt;
      if (this.devTimer <= 0) {
        this.runProductionPhase();
        return;
      }
      const walkSpd = 240 * (this.input.moveScale ?? 1);
      this.isMoving = false;
      if (this.input.left) {
        this.townX -= walkSpd * dt;
        this.townFacing = -1;
        this.isMoving = true;
      }
      if (this.input.right) {
        this.townX += walkSpd * dt;
        this.townFacing = 1;
        this.isMoving = true;
      }
      if (this.input.pointerActive && pointerPy > 170 && pointerPy < 420) {
        this.townX = Math.max(80, Math.min(LOGICAL_W - 80, pointerPx));
      }
      this.townX = Math.max(80, Math.min(LOGICAL_W - 80, this.townX));

      if (this.input.down && downJust) {
        this.activateTownBay(TOWN_BAYS[TOWN_BAYS.length - 1]);
        return;
      }

      if (this.input.fireJustPressed || upJust) {
        const activeBay =
          TOWN_BAYS.find((b) => this.townX >= b.x && this.townX <= b.x + b.w) ?? TOWN_BAYS[TOWN_BAYS.length - 1];
        this.activateTownBay(activeBay);
      }
      return;
    }

    if (this.subPhase === 'DEVELOP') {
      this.devTimer -= dt;
      if (this.devTimer <= 0) {
        this.runProductionPhase();
        return;
      }

      if (this.input.secondaryJustPressed) {
        this.selectedOutfitIdx = (this.selectedOutfitIdx + 1) % OUTFIT_ORDER.length;
        arcadeAudio.playMoveTick();
      }

      const walkSpd = (this.speciesIdx === 3 ? 215 : 172) * (this.input.moveScale ?? 1);
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

      // Tethered M.U.L.E. smoothly follows colonist
      const dx = this.px - this.muleX;
      const dy = this.py - this.muleY;
      const dist = Math.hypot(dx, dy);
      if (dist > 28) {
        this.muleX += (dx / dist) * (dist - 28) * Math.min(1, dt * 11);
        this.muleY += (dy / dist) * (dist - 28) * Math.min(1, dt * 11);
      }

      const col = Math.max(0, Math.min(MAP_COLS - 1, Math.floor((this.px - MAP_X) / TILE_W)));
      const row = Math.max(0, Math.min(MAP_ROWS - 1, Math.floor((this.py - MAP_Y) / TILE_H)));
      const plot = this.getPlot(col, row);

      // Catch Mountain Wampus!
      if (this.wampus.active && this.wampus.c === col && this.wampus.r === row) {
        this.wampus.active = false;
        const prize = 150 + this.month * 35;
        this.cash += prize;
        this.recomputeColonyScore();
        this.popups.push({
          x: this.px,
          y: this.py - 20,
          text: `WAMPUS CAUGHT! +$${prize}`,
          color: '#FDE047',
          life: 1.3,
          maxLife: 1.3,
        });
        spawnBurst(this.particles, this.px, this.py, '#FDE047', 24, 190, 4);
        arcadeAudio.playExtraLife();
      }

      if (this.input.fireJustPressed && plot) {
        if (plot.terrain === 'town') {
          this.subPhase = 'TOWN';
          this.townX = this.carryingOutfit ? 595 : 100 + this.selectedOutfitIdx * 100;
          arcadeAudio.playKeyUnlock();
          return;
        }
        if (plot.owner === 0 && this.carryingOutfit) {
          plot.outfit = this.carryingOutfit;
          this.carryingOutfit = null;
          this.recomputeColonyScore();
          const cx = MAP_X + (plot.col + 0.5) * TILE_W;
          const cy = MAP_Y + (plot.row + 0.5) * TILE_H;
          spawnBurst(this.particles, cx, cy, RESOURCE_META[plot.outfit].color, 20, 170, 3.8);
          this.popups.push({
            x: cx,
            y: cy - 14,
            text: `${RESOURCE_META[plot.outfit].label} RIG ONLINE!`,
            color: RESOURCE_META[plot.outfit].color,
            life: 1.1,
            maxLife: 1.1,
          });
          arcadeAudio.playKeyUnlock();
        }
      }
      return;
    }

    if (this.subPhase === 'PRODUCTION') {
      this.prodTimer -= dt;
      if (this.prodTimer <= 0 || this.input.fireJustPressed) {
        this.subPhase = 'AUCTION';
        this.auctionIdx = 0;
        this.auctionTimer = 22;
      }
      return;
    }

    if (this.subPhase === 'AUCTION') {
      this.auctionTimer -= dt;
      // Animate rival bid positions smoothly
      for (let i = 1; i < 4; i++) {
        this.auctionBids[i] = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(this.time * (1.2 + i * 0.4) + i * 2));
      }

      const res = OUTFIT_ORDER[this.auctionIdx];
      const price = this.prices[res];

      if (leftJust && this.stock[res] > 0) {
        this.stock[res] -= 1;
        this.cash += price;
        this.auctionBids[0] = Math.max(0.15, this.auctionBids[0] - 0.14);
        this.recomputeColonyScore();
        spawnBurst(this.particles, 230, 320, '#4ADE80', 10, 110, 3);
        arcadeAudio.playCoin();
      } else if (rightJust && this.cash >= price) {
        this.stock[res] += 1;
        this.cash -= price;
        this.auctionBids[0] = Math.min(0.85, this.auctionBids[0] + 0.14);
        this.recomputeColonyScore();
        spawnBurst(this.particles, 230, 320, '#38BDF8', 10, 110, 3);
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

  private renderTopHud(ctx: CanvasRenderingContext2D): void {
    const sp = MULE_SPECIES[this.speciesIdx];
    ctx.fillStyle = '#0B1020';
    ctx.fillRect(0, 0, LOGICAL_W, 74);
    ctx.strokeStyle = 'rgba(245,158,11,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 74);
    ctx.lineTo(LOGICAL_W, 74);
    ctx.stroke();

    // Player mini portrait + identity
    drawAlienSprite(ctx, this.speciesIdx, 26, 26, 1.05, this.time, false, 1, this.stock.food > 1 ? 'happy' : 'worried');

    ctx.textAlign = 'left';
    ctx.font = '900 14px "JetBrains Mono", monospace';
    ctx.fillStyle = '#FACC15';
    ctx.fillText(`M.U.L.E. · MONTH ${Math.min(12, this.month)}/12`, 50, 24);
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.fillStyle = sp.color;
    ctx.fillText(`${sp.name} · ${sp.classicPerk}`, 50, 42);

    // Cash & Colony Net Worth
    ctx.textAlign = 'right';
    ctx.font = '900 15px "JetBrains Mono", monospace';
    ctx.fillStyle = '#4ADE80';
    ctx.fillText(`CASH $${this.cash.toLocaleString()}`, LOGICAL_W - 18, 24);
    ctx.font = '700 11.5px "JetBrains Mono", monospace';
    ctx.fillStyle = '#E2E8F0';
    ctx.fillText(`COLONY VALUE ${this.score.toLocaleString()}`, LOGICAL_W - 18, 42);

    // 4-Commodity Stock Strip
    ctx.textAlign = 'left';
    OUTFIT_ORDER.forEach((k, idx) => {
      const m = RESOURCE_META[k];
      const bx = 50 + idx * 184;
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath();
      ctx.roundRect(bx, 50, 174, 18, 4);
      ctx.fill();
      ctx.fillStyle = m.color;
      ctx.font = '800 10.5px "JetBrains Mono", monospace';
      ctx.fillText(`${m.label}: ${this.stock[k]}`, bx + 7, 62.5);
      ctx.fillStyle = '#CBD5E1';
      ctx.textAlign = 'right';
      ctx.fillText(`$${this.prices[k]}`, bx + 167, 62.5);
      ctx.textAlign = 'left';
    });
  }

  private renderTownInterior(ctx: CanvasRenderingContext2D): void {
    // Classic M.U.L.E. Town Corridor View with 7 Illustrated Bays
    const panelY = 98;
    const panelH = 352;
    const g = ctx.createLinearGradient(0, panelY, 0, panelY + panelH);
    g.addColorStop(0, '#1E1B4B');
    g.addColorStop(0.65, '#312E81');
    g.addColorStop(1, '#1E293B');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(24, panelY, LOGICAL_W - 48, panelH, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(250,204,21,0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Header
    ctx.fillStyle = '#FEF08A';
    ctx.font = '900 15px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`IRATA COLONY STORE & PLAZA  ·  TIMER: ${Math.ceil(this.devTimer)}s`, LOGICAL_W * 0.5, panelY + 28);

    // 7 Illustrated Storefront Bays
    const activeBay = TOWN_BAYS.find((b) => this.townX >= b.x && this.townX <= b.x + b.w);
    for (const bay of TOWN_BAYS) {
      const isHot = activeBay?.id === bay.id;
      const by = panelY + 52;
      const bh = 166;
      ctx.fillStyle = isHot ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.72)';
      ctx.beginPath();
      ctx.roundRect(bay.x, by, bay.w, bh, 8);
      ctx.fill();
      ctx.strokeStyle = isHot ? bay.color : 'rgba(148,163,184,0.3)';
      ctx.lineWidth = isHot ? 3 : 1.4;
      ctx.stroke();

      // Storefront Awning
      ctx.fillStyle = bay.color;
      ctx.beginPath();
      ctx.roundRect(bay.x + 4, by + 4, bay.w - 8, 28, 5);
      ctx.fill();

      ctx.fillStyle = '#0F172A';
      ctx.font = '900 12px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(bay.label, bay.x + bay.w * 0.5, by + 22);

      // Bay icon / display
      const midX = bay.x + bay.w * 0.5;
      if (bay.id === 'food' || bay.id === 'energy' || bay.id === 'smithore' || bay.id === 'crystite') {
        drawMechanicalMule(ctx, midX, by + 84, bay.id, 1.35, this.time, isHot, 1);
        ctx.fillStyle = '#F8FAFC';
        ctx.font = '800 12px "JetBrains Mono", monospace';
        ctx.fillText(`$${this.getOutfitCost(bay.id)}`, midX, by + 132);
      } else if (bay.id === 'assay') {
        ctx.strokeStyle = '#E879F9';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(midX, by + 82, 20, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(midX, by + 82, 8 + ((this.time * 18) % 12), 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#E879F9';
        ctx.font = '800 11px "JetBrains Mono", monospace';
        ctx.fillText('CRYSTITE', midX, by + 132);
      } else if (bay.id === 'pub') {
        ctx.fillStyle = '#FB923C';
        ctx.beginPath();
        ctx.roundRect(midX - 16, by + 64, 32, 32, 6);
        ctx.fill();
        ctx.fillStyle = '#FEF08A';
        ctx.font = '900 15px "JetBrains Mono", monospace';
        ctx.fillText('$$$', midX, by + 85);
        ctx.fillStyle = '#FDBA74';
        ctx.font = '800 11px "JetBrains Mono", monospace';
        ctx.fillText(`+$${Math.round(55 + this.devTimer * 6.5)}`, midX, by + 132);
      } else {
        ctx.fillStyle = '#94A3B8';
        ctx.font = '900 18px "JetBrains Mono", monospace';
        ctx.fillText('▼', midX, by + 88);
        ctx.fillStyle = '#CBD5E1';
        ctx.font = '800 11px "JetBrains Mono", monospace';
        ctx.fillText('EXIT', midX, by + 132);
      }

      if (isHot) {
        ctx.fillStyle = '#FEF08A';
        ctx.font = '800 10px "JetBrains Mono", monospace';
        ctx.fillText('[SPACE]', midX, by + 154);
      }
    }

    // Town Corridor Promenade Floor
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(40, panelY + 232, LOGICAL_W - 80, 96);
    ctx.strokeStyle = 'rgba(56,189,248,0.3)';
    ctx.strokeRect(40, panelY + 232, LOGICAL_W - 80, 96);

    // Colonist walking the corridor
    drawAlienSprite(ctx, this.speciesIdx, this.townX, panelY + 280, 1.8, this.time, this.isMoving, this.townFacing, 'happy');
    if (this.carryingOutfit) {
      drawMechanicalMule(ctx, this.townX - this.townFacing * 36, panelY + 284, this.carryingOutfit, 1.3, this.time, this.isMoving, this.townFacing);
    }
  }

  private renderAuctionFloor(ctx: CanvasRenderingContext2D): void {
    const panelY = 92;
    const panelH = 368;
    ctx.fillStyle = '#0B1325';
    ctx.beginPath();
    ctx.roundRect(26, panelY, LOGICAL_W - 52, panelH, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(250,204,21,0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const activeRes = OUTFIT_ORDER[this.auctionIdx];
    const meta = RESOURCE_META[activeRes];

    ctx.textAlign = 'center';
    ctx.fillStyle = '#FACC15';
    ctx.font = '900 16px "JetBrains Mono", monospace';
    ctx.fillText(`MONTH ${this.month} COMMODITY AUCTION  ·  ${Math.ceil(this.auctionTimer)}s`, LOGICAL_W * 0.5, panelY + 28);

    // Left Commodity Selector List
    OUTFIT_ORDER.forEach((res, idx) => {
      const m = RESOURCE_META[res];
      const ry = panelY + 52 + idx * 72;
      const sel = idx === this.auctionIdx;
      ctx.fillStyle = sel ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.03)';
      ctx.beginPath();
      ctx.roundRect(44, ry, 230, 62, 8);
      ctx.fill();
      ctx.strokeStyle = sel ? m.color : 'rgba(148,163,184,0.22)';
      ctx.lineWidth = sel ? 2.5 : 1;
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.fillStyle = m.color;
      ctx.font = '900 14px "JetBrains Mono", monospace';
      ctx.fillText(m.label, 58, ry + 24);
      ctx.fillStyle = '#E2E8F0';
      ctx.font = '700 11.5px "JetBrains Mono", monospace';
      ctx.fillText(`HOLDING: ${this.stock[res]} units`, 58, ry + 46);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#FEF08A';
      ctx.font = '900 16px "JetBrains Mono", monospace';
      ctx.fillText(`$${this.prices[res]}`, 262, ry + 36);
    });

    // Right Classic Vertical Price Bar & Animated Colonist Bidders
    const chartX = 296;
    const chartY = panelY + 52;
    const chartW = 456;
    const chartH = 280;
    ctx.fillStyle = '#070C18';
    ctx.beginPath();
    ctx.roundRect(chartX, chartY, chartW, chartH, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(56,189,248,0.28)';
    ctx.stroke();

    // Horizontal Clearing Price Line
    const clearY = chartY + chartH * 0.5;
    ctx.strokeStyle = meta.color;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(chartX + 12, clearY);
    ctx.lineTo(chartX + chartW - 12, clearY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#4ADE80';
    ctx.font = '800 10.5px "JetBrains Mono", monospace';
    ctx.fillText('▲ SELLERS (HOLDING SURPLUS)', chartX + 14, chartY + 18);
    ctx.fillStyle = '#38BDF8';
    ctx.fillText('▼ BUYERS (SEEKING STOCK)', chartX + 14, chartY + chartH - 10);
    ctx.textAlign = 'right';
    ctx.fillStyle = meta.color;
    ctx.fillText(`MARKET PRICE: $${this.prices[activeRes]}`, chartX + chartW - 14, clearY - 7);

    // 4 Colonist Lanes (Player + 3 Rivals)
    const allTraders = [
      { spIdx: this.speciesIdx, name: 'YOU', bid: this.auctionBids[0], stock: this.stock[activeRes] },
      ...this.rivals.map((rv, i) => ({
        spIdx: rv.speciesIdx,
        name: rv.name.slice(0, 6),
        bid: this.auctionBids[i + 1],
        stock: rv.stock[activeRes],
      })),
    ];

    allTraders.forEach((tr, idx) => {
      const lx = chartX + 64 + idx * 108;
      const ly = chartY + 46 + tr.bid * (chartH - 100);
      // Vertical track
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(lx, chartY + 34);
      ctx.lineTo(lx, chartY + chartH - 34);
      ctx.stroke();

      drawAlienSprite(ctx, tr.spIdx, lx, ly, 1.35, this.time, true, 1, idx === 0 ? 'happy' : 'neutral');

      ctx.textAlign = 'center';
      ctx.fillStyle = idx === 0 ? '#FACC15' : '#CBD5E1';
      ctx.font = '800 10.5px "JetBrains Mono", monospace';
      ctx.fillText(tr.name, lx, chartY + chartH - 22);
      ctx.fillStyle = '#94A3B8';
      ctx.font = '700 9.5px "JetBrains Mono", monospace';
      ctx.fillText(`${tr.stock}u`, lx, ly - 18);
    });
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.save();
    ctx.scale(dpr, dpr);

    // Warm Martian dusk space backdrop
    const bg = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
    bg.addColorStop(0, '#130A0B');
    bg.addColorStop(0.5, '#26120E');
    bg.addColorStop(1, '#140B0C');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    this.renderTopHud(ctx);

    const sp = MULE_SPECIES[this.speciesIdx];
    const ownerColors = [
      sp.color,
      MULE_SPECIES[this.rivals[0]?.speciesIdx ?? 1].color,
      MULE_SPECIES[this.rivals[1]?.speciesIdx ?? 4].color,
      MULE_SPECIES[this.rivals[2]?.speciesIdx ?? 6].color,
    ];

    if (this.subPhase === 'TOWN' && this.phase === 'PLAYING') {
      this.renderTownInterior(ctx);
    } else if (this.subPhase === 'AUCTION' && this.phase === 'PLAYING') {
      this.renderAuctionFloor(ctx);
    } else {
      // Draw Illustrated 9x5 Planet Irata Map
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
          1,
          false,
          p.assayed ? p.crystiteRichness : null,
          this.time,
          false
        );
      }

      // Weather FX during Production
      if (this.subPhase === 'PRODUCTION') {
        if (this.eventKind === 'rain') {
          ctx.strokeStyle = 'rgba(125,211,252,0.55)';
          ctx.lineWidth = 1.6;
          for (let i = 0; i < 36; i++) {
            const rx = ((i * 67 + this.time * 180) % (MAP_COLS * TILE_W)) + MAP_X;
            const ry = ((i * 41 + this.time * 320) % (MAP_ROWS * TILE_H)) + MAP_Y;
            ctx.beginPath();
            ctx.moveTo(rx, ry);
            ctx.lineTo(rx - 4, ry + 11);
            ctx.stroke();
          }
        } else if (this.eventKind === 'sun') {
          const pulse = 0.14 + Math.sin(this.time * 8) * 0.08;
          ctx.fillStyle = `rgba(250,204,21,${pulse})`;
          ctx.fillRect(MAP_X, MAP_Y, MAP_COLS * TILE_W, MAP_ROWS * TILE_H);
        }
        // Floating harvested resource orbs
        for (const o of this.prodOrbs) {
          ctx.fillStyle = o.color;
          ctx.beginPath();
          ctx.arc(o.x, o.y, 4.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Mountain Wampus
      if (this.subPhase === 'DEVELOP' && this.wampus.active) {
        const wx = MAP_X + (this.wampus.c + 0.5) * TILE_W;
        const wy = MAP_Y + (this.wampus.r + 0.5) * TILE_H;
        drawWampus(ctx, wx, wy, this.time, false);
      }

      // Grant Selection Cursor + Yield Hint
      if (this.subPhase === 'GRANT' && this.phase === 'PLAYING') {
        const cx = MAP_X + this.cursorC * TILE_W;
        const cy = MAP_Y + this.cursorR * TILE_H;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.roundRect(cx + 2, cy + 2, TILE_W - 4, TILE_H - 4, 6);
        ctx.stroke();
      }

      // Colonist + Tethered Articulated M.U.L.E.
      if (this.subPhase === 'DEVELOP' || this.phase === 'TITLE') {
        const showMule = this.carryingOutfit || (this.phase === 'TITLE' ? 'food' : null);
        if (showMule) {
          ctx.strokeStyle = '#FACC15';
          ctx.lineWidth = 2.2;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.moveTo(this.px, this.py);
          ctx.lineTo(this.muleX, this.muleY);
          ctx.stroke();
          ctx.setLineDash([]);
          drawMechanicalMule(ctx, this.muleX, this.muleY, showMule, 1.15, this.time, this.isMoving, this.facing);
        }
        drawAlienSprite(ctx, this.speciesIdx, this.px, this.py, 1.35, this.time, this.isMoving, this.facing, 'happy');
      }

      // Species Selection Overlay Gallery
      if (this.subPhase === 'SPECIES' && this.phase === 'PLAYING') {
        ctx.fillStyle = 'rgba(7,10,22,0.88)';
        ctx.beginPath();
        ctx.roundRect(56, 108, LOGICAL_W - 112, 326, 14);
        ctx.fill();
        ctx.strokeStyle = 'rgba(250,204,21,0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.fillStyle = '#FEF08A';
        ctx.font = '900 17px "JetBrains Mono", monospace';
        ctx.fillText('CHOOSE YOUR PLANET IRATA COLONIST SPECIES', LOGICAL_W * 0.5, 138);

        MULE_SPECIES.forEach((s, idx) => {
          const col = idx % 4;
          const row = Math.floor(idx / 4);
          const bx = 82 + col * 162;
          const by = 156 + row * 124;
          const active = idx === this.speciesIdx;

          ctx.fillStyle = active ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.03)';
          ctx.beginPath();
          ctx.roundRect(bx, by, 148, 112, 10);
          ctx.fill();
          ctx.strokeStyle = active ? s.color : 'rgba(148,163,184,0.2)';
          ctx.lineWidth = active ? 2.6 : 1;
          ctx.stroke();

          drawAlienSprite(ctx, idx, bx + 74, by + 42, 1.6, this.time, active, 1, active ? 'happy' : 'neutral');

          ctx.fillStyle = s.color;
          ctx.font = '900 12px "JetBrains Mono", monospace';
          ctx.fillText(s.name, bx + 74, by + 78);
          ctx.fillStyle = '#E2E8F0';
          ctx.font = '700 9.5px "JetBrains Mono", monospace';
          ctx.fillText(`$${s.startCash} · ${s.classicPerk}`, bx + 74, by + 98);
        });
      }
    }

    // Bottom Context Control Bar
    const stripY = MAP_Y + MAP_ROWS * TILE_H + 14;
    ctx.fillStyle = 'rgba(8,12,24,0.94)';
    ctx.beginPath();
    ctx.roundRect(MAP_X, stripY, MAP_COLS * TILE_W, 114, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(245,158,11,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'center';
    if (this.subPhase === 'SPECIES' && this.phase === 'PLAYING') {
      ctx.fillStyle = sp.color;
      ctx.font = '900 17px "JetBrains Mono", monospace';
      ctx.fillText(`${sp.name}  —  START $${sp.startCash}  ·  ${sp.classicPerk}`, LOGICAL_W * 0.5, stripY + 42);
      ctx.fillStyle = '#CBD5E1';
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillText('ARROWS CHOOSE SPECIES  ·  PRESS SPACE TO LAND ON PLANET IRATA', LOGICAL_W * 0.5, stripY + 78);
    } else if (this.subPhase === 'GRANT' && this.phase === 'PLAYING') {
      const hover = this.getPlot(this.cursorC, this.cursorR);
      const hint =
        hover?.terrain === 'river'
          ? 'RIVER PLOT — BEST FOR FOOD (4/MO)'
          : hover?.terrain === 'mtn3'
          ? '3-PEAK MOUNTAIN — BEST FOR SMITHORE & CRYSTITE!'
          : hover?.terrain.startsWith('mtn')
          ? 'MOUNTAIN PLOT — STRONG SMITHORE & CRYSTITE'
          : hover?.terrain === 'town'
          ? 'IRATA TOWN — CANNOT CLAIM'
          : 'PLAINS PLOT — BEST FOR ENERGY (4/MO)';
      ctx.fillStyle = '#4ADE80';
      ctx.font = '900 15px "JetBrains Mono", monospace';
      ctx.fillText(`MONTH ${this.month} LAND GRANT — SELECT AN UNCLAIMED PLOT & PRESS SPACE`, LOGICAL_W * 0.5, stripY + 40);
      ctx.fillStyle = '#FDE047';
      ctx.font = '800 12.5px "JetBrains Mono", monospace';
      ctx.fillText(hint, LOGICAL_W * 0.5, stripY + 76);
    } else if (this.subPhase === 'TOWN' && this.phase === 'PLAYING') {
      ctx.fillStyle = '#FACC15';
      ctx.font = '900 14.5px "JetBrains Mono", monospace';
      ctx.fillText('WALK LEFT/RIGHT TO STORE BAY · SPACE / UP TO BUY, ASSAY, OR GAMBLE AT PUB', LOGICAL_W * 0.5, stripY + 42);
      ctx.fillStyle = '#94A3B8';
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillText('PRESS DOWN OR ENTER EXIT BAY TO RETURN TO PLANET IRATA MAP', LOGICAL_W * 0.5, stripY + 76);
    } else if (this.subPhase === 'DEVELOP' && this.phase === 'PLAYING') {
      ctx.fillStyle = '#38BDF8';
      ctx.font = '900 14.5px "JetBrains Mono", monospace';
      ctx.fillText(
        this.carryingOutfit
          ? `LEAD ${RESOURCE_META[this.carryingOutfit].label} M.U.L.E. TO YOUR OWNED PLOT & PRESS SPACE TO INSTALL!`
          : `WALK INTO IRATA TOWN (CENTER) + PRESS SPACE TO ENTER STORE, ASSAY OR PUB!`,
        LOGICAL_W * 0.5,
        stripY + 40
      );
      ctx.fillStyle = '#FACC15';
      ctx.font = '800 13px "JetBrains Mono", monospace';
      ctx.fillText(
        `TURN CLOCK: ${Math.ceil(this.devTimer)}s   ·   CATCH THE MOUNTAIN WAMPUS FOR BONUS CASH!`,
        LOGICAL_W * 0.5,
        stripY + 76
      );
    } else if (this.subPhase === 'PRODUCTION' && this.phase === 'PLAYING') {
      ctx.fillStyle = '#FDE047';
      ctx.font = '900 15px "JetBrains Mono", monospace';
      ctx.fillText(this.eventHeadline, LOGICAL_W * 0.5, stripY + 42);
      ctx.fillStyle = '#CBD5E1';
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillText('PRESS SPACE TO OPEN MONTHLY COMMODITY AUCTION', LOGICAL_W * 0.5, stripY + 76);
    } else if (this.subPhase === 'AUCTION' && this.phase === 'PLAYING') {
      const res = OUTFIT_ORDER[this.auctionIdx];
      ctx.fillStyle = '#FACC15';
      ctx.font = '900 14.5px "JetBrains Mono", monospace';
      ctx.fillText(
        `UP/DOWN COMMODITY  ·  LEFT = SELL ${res.toUpperCase()} (+$${this.prices[res]})  ·  RIGHT = BUY (-$${this.prices[res]})`,
        LOGICAL_W * 0.5,
        stripY + 40
      );
      ctx.fillStyle = '#4ADE80';
      ctx.font = '800 12.5px "JetBrains Mono", monospace';
      ctx.fillText('PRESS SPACE WHEN DONE TRADING TO ADVANCE TO NEXT MONTH', LOGICAL_W * 0.5, stripY + 76);
    } else {
      ctx.fillStyle = '#FACC15';
      ctx.font = '900 16px "JetBrains Mono", monospace';
      ctx.fillText('M.U.L.E. (1983 HD REMASTER) — 8 ALIEN SPECIES · STORE · ASSAY · AUCTIONS', LOGICAL_W * 0.5, stripY + 44);
      ctx.fillStyle = '#CBD5E1';
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillText('CLAIM PLANET IRATA · OUTFIT MECHANICAL M.U.L.E.s · MASTER THE 12-MONTH ECONOMY', LOGICAL_W * 0.5, stripY + 78);
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
      stageName: `M.U.L.E. · MONTH ${Math.min(12, this.month)} (${this.subPhase})`,
      primaryMetricLabel: 'CASH',
      primaryMetricValue: `$${this.cash}`,
      secondaryMetricLabel: 'M.U.L.E.',
      secondaryMetricValue: this.carryingOutfit
        ? this.carryingOutfit.toUpperCase()
        : OUTFIT_ORDER[this.selectedOutfitIdx].toUpperCase(),
      bannerText:
        this.phase === 'TITLE'
          ? 'M.U.L.E. — 1983 HD REMASTER · PLANET IRATA'
          : this.phase === 'GAME_OVER'
          ? `COLONY COMPLETE! FINAL VALUE ${this.score.toLocaleString()}`
          : '',
      canRestartStage: true,
    };
  }
}

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

const LOGICAL_W = 640;
const LOGICAL_H = 540;
const MAP_COLS = 9;
const MAP_ROWS = 5;
const TILE_W = 64;
const TILE_H = 66;
const MAP_X = Math.floor((LOGICAL_W - MAP_COLS * TILE_W) / 2); // 32
const MAP_Y = 74;

type ResourceKind = 'food' | 'energy' | 'smithore' | 'crystite';
type TerrainKind = 'river' | 'plains' | 'mtn1' | 'mtn2' | 'mtn3' | 'town';
type TurnSubPhase = 'SPECIES' | 'GRANT' | 'DEVELOP' | 'PRODUCTION' | 'AUCTION';

interface AlienSpecies {
  name: string;
  color: string;
  startCash: number;
  devTime: number;
  perk: string;
}

const SPECIES_LIST: AlienSpecies[] = [
  { name: 'FLAPPER', color: '#FACC15', startCash: 1600, devTime: 36, perk: '+600 Start Cash' },
  { name: 'HUMANOID', color: '#38BDF8', startCash: 600, devTime: 30, perk: '+15% Colony Score' },
  { name: 'PACKER', color: '#F472B6', startCash: 1000, devTime: 34, perk: 'Balanced Pioneer' },
  { name: 'SPHEROID', color: '#A855F7', startCash: 1000, devTime: 34, perk: 'Fast Irata Walk' },
  { name: 'MECHTRON', color: '#94A3B8', startCash: 1000, devTime: 34, perk: 'Cheap M.U.L.E.s' },
  { name: 'GOLLUMER', color: '#4ADE80', startCash: 1000, devTime: 34, perk: 'Mountain Bonus' },
  { name: 'BONZOID', color: '#FB923C', startCash: 1000, devTime: 34, perk: 'Smithore Expert' },
  { name: 'LEGGITE', color: '#2DD4BF', startCash: 1000, devTime: 34, perk: 'River Food Bonus' },
];

interface IrataPlot {
  col: number;
  row: number;
  terrain: TerrainKind;
  owner: number; // -1 unowned, 0 player, 1..3 AI rivals
  outfit: ResourceKind | null;
  crystiteRichness: number;
}

const OUTFIT_ORDER: ResourceKind[] = ['food', 'energy', 'smithore', 'crystite'];
const OUTFIT_COST: Record<ResourceKind, number> = {
  food: 125,
  energy: 150,
  smithore: 175,
  crystite: 200,
};

export class MuleArcadeGame implements ArcadeGameInstance {
  public readonly logicalWidth = LOGICAL_W;
  public readonly logicalHeight = LOGICAL_H;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'Select / Buy / Act';
  public readonly secondaryActionLabel = 'Cycle Outfit';

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
  private cursorR = 2;

  // Player Colony Inventory
  private cash = 1000;
  private stock: Record<ResourceKind, number> = { food: 4, energy: 4, smithore: 0, crystite: 0 };
  private prices: Record<ResourceKind, number> = { food: 35, energy: 28, smithore: 55, crystite: 95 };
  private rivalScores = [1200, 1180, 1150];

  // Real-Time Development Phase state (Colonist + Tethered M.U.L.E.)
  private px = LOGICAL_W * 0.5;
  private py = MAP_Y + 2.5 * TILE_H;
  private muleX = LOGICAL_W * 0.5;
  private muleY = MAP_Y + 2.5 * TILE_H;
  private carryingOutfit: ResourceKind | null = null;
  private selectedOutfitIdx = 0;
  private devTimer = 34;

  // Mountain Wampus!
  private wampus = { active: false, c: 1, r: 1, timer: 4 };

  // Production / Auction state
  private eventHeadline = '';
  private prodTimer = 0;
  private auctionIdx = 0;
  private auctionTimer = 0;

  constructor() {
    this.highScore = readHighScore(this.storageKey);
    this.initPlanet();
  }

  private initPlanet(): void {
    this.plots = [];
    for (let r = 0; r < MAP_ROWS; r++) {
      for (let c = 0; c < MAP_COLS; c++) {
        let terrain: TerrainKind = 'plains';
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
          crystiteRichness: terrain.startsWith('mtn') ? 1 + Math.floor(Math.random() * 3) : 0,
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
    this.initPlanet();
    this.applySpeciesStart();
    arcadeAudio.playArcadeStart();
  }

  private applySpeciesStart(): void {
    const sp = SPECIES_LIST[this.speciesIdx];
    this.cash = sp.startCash;
    this.stock = { food: 4, energy: 4, smithore: 0, crystite: 0 };
    this.prices = { food: 35, energy: 28, smithore: 55, crystite: 95 };
    this.rivalScores = [1100, 1080, 1060];
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
    // Let 3 AI colonists claim plots each month too
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
    const sp = SPECIES_LIST[this.speciesIdx];
    this.devTimer = sp.devTime;
    this.px = MAP_X + 4.5 * TILE_W;
    this.py = MAP_Y + 2.5 * TILE_H;
    this.muleX = this.px;
    this.muleY = this.py;
    this.carryingOutfit = null;

    // Spawn elusive Mountain Wampus on a mountain plot
    const mtns = this.plots.filter((p) => p.terrain.startsWith('mtn'));
    if (mtns.length > 0) {
      const pick = mtns[Math.floor(Math.random() * mtns.length)];
      this.wampus = { active: true, c: pick.col, r: pick.row, timer: 5.5 };
    }
  }

  private runProductionPhase(): void {
    this.subPhase = 'PRODUCTION';
    this.prodTimer = 3.2;

    // Random Planet Irata Colony Event
    const events = [
      { msg: 'SUNSPOT ACTIVITY! +2 ENERGY PER PLOT!', kind: 'sun' },
      { msg: 'IRATA ACID RAIN! +2 FOOD ON RIVER PLOTS!', kind: 'rain' },
      { msg: 'PIRATE RAID! SMITHORE PRICES SURGE!', kind: 'pirate' },
      { msg: 'CRYSTITE METEOR SHOWER! BOOM MARKET!', kind: 'meteor' },
    ];
    const ev = events[Math.floor(Math.random() * events.length)];
    this.eventHeadline = ev.msg;

    if (ev.kind === 'pirate') this.prices.smithore = Math.min(160, this.prices.smithore + 35);
    if (ev.kind === 'meteor') this.prices.crystite = Math.min(220, this.prices.crystite + 45);

    const myPlots = this.plots.filter((p) => p.owner === 0 && p.outfit !== null);
    let energyAvail = this.stock.energy;

    for (const p of myPlots) {
      if (!p.outfit) continue;
      if (p.outfit !== 'energy') {
        if (energyAvail <= 0) continue;
        energyAvail -= 1;
      }
      if (p.outfit === 'food') {
        const base = p.terrain === 'river' ? 4 : p.terrain === 'plains' ? 2 : 1;
        const bonus = (ev.kind === 'rain' && p.terrain === 'river' ? 2 : 0) + (this.speciesIdx === 7 ? 1 : 0);
        this.stock.food += base + bonus;
      } else if (p.outfit === 'energy') {
        const base = p.terrain === 'plains' ? 4 : p.terrain === 'river' ? 2 : 1;
        this.stock.energy += base + (ev.kind === 'sun' ? 2 : 0);
      } else if (p.outfit === 'smithore') {
        const mtnBonus =
          p.terrain === 'mtn3' ? 4 : p.terrain === 'mtn2' ? 3 : p.terrain === 'mtn1' ? 2 : 1;
        this.stock.smithore += mtnBonus + (this.speciesIdx === 6 ? 1 : 0);
      } else if (p.outfit === 'crystite') {
        this.stock.crystite += Math.max(1, p.crystiteRichness) + (this.speciesIdx === 5 ? 1 : 0);
      }
    }

    // Monthly Food & Energy upkeep
    this.stock.food = Math.max(0, this.stock.food - 2);
    this.stock.energy = Math.max(0, this.stock.energy - Math.min(2, myPlots.length));

    // AI Rivals grow
    for (let i = 0; i < this.rivalScores.length; i++) {
      this.rivalScores[i] += 220 + Math.floor(Math.random() * 240);
    }

    // Dynamic market price drift
    this.prices.food = Math.max(20, Math.min(110, this.prices.food + Math.round((Math.random() - 0.45) * 16)));
    this.prices.energy = Math.max(18, Math.min(100, this.prices.energy + Math.round((Math.random() - 0.45) * 16)));
    this.prices.smithore = Math.max(38, Math.min(165, this.prices.smithore + Math.round((Math.random() - 0.45) * 20)));
    this.prices.crystite = Math.max(60, Math.min(240, this.prices.crystite + Math.round((Math.random() - 0.45) * 30)));

    this.recomputeColonyScore();
    arcadeAudio.playCoin();
  }

  public step(dt: number): void {
    this.time += dt;
    stepParticlesAndPopups(this.particles, this.popups, dt);
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
      // Gently animate colonist strolling around Irata Town
      this.px = LOGICAL_W * 0.5 + Math.cos(this.time * 0.9) * 110;
      this.py = MAP_Y + 2.5 * TILE_H + Math.sin(this.time * 0.9) * 60;
      return;
    }

    if (this.subPhase === 'SPECIES') {
      if (leftJust) {
        this.speciesIdx = (this.speciesIdx + SPECIES_LIST.length - 1) % SPECIES_LIST.length;
        arcadeAudio.playMoveTick();
      } else if (rightJust) {
        this.speciesIdx = (this.speciesIdx + 1) % SPECIES_LIST.length;
        arcadeAudio.playMoveTick();
      } else if (upJust) {
        this.speciesIdx = (this.speciesIdx + 4) % SPECIES_LIST.length;
        arcadeAudio.playMoveTick();
      } else if (downJust) {
        this.speciesIdx = (this.speciesIdx + 4) % SPECIES_LIST.length;
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
          spawnBurst(this.particles, cx, cy, '#FACC15', 16, 150, 3.6);
          this.popups.push({ x: cx, y: cy, text: 'PLOT CLAIMED!', color: '#4ADE80', life: 0.9, maxLife: 0.9 });
          arcadeAudio.playCoin();
          this.recomputeColonyScore();
          this.beginDevelopment();
        } else {
          arcadeAudio.playRockThud();
        }
      }
      return;
    }

    if (this.subPhase === 'DEVELOP') {
      this.devTimer -= dt;
      if (this.devTimer <= 0) {
        this.runProductionPhase();
        return;
      }

      // Cycle desired M.U.L.E. outfit via Shift/X
      if (this.input.secondaryJustPressed) {
        this.selectedOutfitIdx = (this.selectedOutfitIdx + 1) % OUTFIT_ORDER.length;
        arcadeAudio.playMoveTick();
      }

      // Walk Colonist around Planet Irata!
      const walkSpd = (this.speciesIdx === 3 ? 195 : 155) * (this.input.moveScale ?? 1);
      if (this.input.left) this.px -= walkSpd * dt;
      if (this.input.right) this.px += walkSpd * dt;
      if (this.input.up) this.py -= walkSpd * dt;
      if (this.input.down) this.py += walkSpd * dt;
      this.px = Math.max(MAP_X + 12, Math.min(MAP_X + MAP_COLS * TILE_W - 12, this.px));
      this.py = Math.max(MAP_Y + 12, Math.min(MAP_Y + MAP_ROWS * TILE_H - 12, this.py));

      // Tethered M.U.L.E. smoothly trails colonist
      const dx = this.px - this.muleX;
      const dy = this.py - this.muleY;
      const dist = Math.hypot(dx, dy);
      if (dist > 22) {
        this.muleX += (dx / dist) * (dist - 22) * Math.min(1, dt * 10);
        this.muleY += (dy / dist) * (dist - 22) * Math.min(1, dt * 10);
      }

      const col = Math.max(0, Math.min(MAP_COLS - 1, Math.floor((this.px - MAP_X) / TILE_W)));
      const row = Math.max(0, Math.min(MAP_ROWS - 1, Math.floor((this.py - MAP_Y) / TILE_H)));
      const plot = this.getPlot(col, row);

      // Catch Mountain Wampus!
      if (this.wampus.active && this.wampus.c === col && this.wampus.r === row) {
        this.wampus.active = false;
        const prize = 150 + this.month * 30;
        this.cash += prize;
        this.recomputeColonyScore();
        this.popups.push({
          x: this.px,
          y: this.py - 18,
          text: `WAMPUS +$${prize}!`,
          color: '#FDE047',
          life: 1.1,
          maxLife: 1.1,
        });
        spawnBurst(this.particles, this.px, this.py, '#FDE047', 22, 180, 4);
        arcadeAudio.playExtraLife();
      }

      if (this.input.fireJustPressed && plot) {
        if (plot.terrain === 'town') {
          if (this.carryingOutfit) {
            // Entered Town Pub early to gamble remaining time for cash!
            const pubBonus = Math.round(50 + this.devTimer * 6);
            this.cash += pubBonus;
            this.recomputeColonyScore();
            this.popups.push({
              x: this.px,
              y: this.py - 18,
              text: `PUB WIN +$${pubBonus}!`,
              color: '#4ADE80',
              life: 1.1,
              maxLife: 1.1,
            });
            arcadeAudio.playCoin();
            this.runProductionPhase();
            return;
          }
          // Buy & outfit a M.U.L.E. at the Store!
          const chosen = OUTFIT_ORDER[this.selectedOutfitIdx];
          const cost = Math.round(OUTFIT_COST[chosen] * (this.speciesIdx === 4 ? 0.8 : 1));
          if (this.cash >= cost) {
            this.cash -= cost;
            this.carryingOutfit = chosen;
            this.muleX = this.px;
            this.muleY = this.py;
            this.recomputeColonyScore();
            this.popups.push({
              x: this.px,
              y: this.py - 18,
              text: `${chosen.toUpperCase()} M.U.L.E. -$${cost}`,
              color: '#38BDF8',
              life: 1.0,
              maxLife: 1.0,
            });
            arcadeAudio.playPowerUp();
          } else {
            // Gamble at Pub if low on cash!
            const pubBonus = Math.round(60 + this.devTimer * 5);
            this.cash += pubBonus;
            this.recomputeColonyScore();
            this.runProductionPhase();
          }
        } else if (plot.owner === 0 && this.carryingOutfit) {
          // Install tethered M.U.L.E. on owned plot!
          plot.outfit = this.carryingOutfit;
          this.carryingOutfit = null;
          this.recomputeColonyScore();
          const cx = MAP_X + (plot.col + 0.5) * TILE_W;
          const cy = MAP_Y + (plot.row + 0.5) * TILE_H;
          spawnBurst(this.particles, cx, cy, '#4ADE80', 18, 160, 3.6);
          this.popups.push({
            x: cx,
            y: cy - 12,
            text: `INSTALLED ${plot.outfit.toUpperCase()}!`,
            color: '#4ADE80',
            life: 1.0,
            maxLife: 1.0,
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
        this.auctionTimer = 18;
      }
      return;
    }

    if (this.subPhase === 'AUCTION') {
      this.auctionTimer -= dt;
      const res = OUTFIT_ORDER[this.auctionIdx];
      const price = this.prices[res];

      if (leftJust && this.stock[res] > 0) {
        // SELL 1 unit
        this.stock[res] -= 1;
        this.cash += price;
        this.recomputeColonyScore();
        arcadeAudio.playCoin();
      } else if (rightJust && this.cash >= price) {
        // BUY 1 unit
        this.stock[res] += 1;
        this.cash -= price;
        this.recomputeColonyScore();
        arcadeAudio.playMoveTick();
      }

      if (upJust) this.auctionIdx = (this.auctionIdx + 3) % 4;
      if (downJust) this.auctionIdx = (this.auctionIdx + 1) % 4;

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

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.save();
    ctx.scale(dpr, dpr);

    // Planet Irata rust-dusk backdrop
    const bg = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
    bg.addColorStop(0, '#1A0B0A');
    bg.addColorStop(1, '#2D140E');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // Top HUD Header
    ctx.font = '800 13px "JetBrains Mono", monospace';
    ctx.fillStyle = '#F59E0B';
    ctx.textAlign = 'left';
    const sp = SPECIES_LIST[this.speciesIdx];
    ctx.fillText(`M.U.L.E. · MONTH ${Math.min(12, this.month)}/12 · ${sp.name}`, 18, 24);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#4ADE80';
    ctx.fillText(`CASH $${this.cash}  ·  COLONY ${this.score.toLocaleString()}`, LOGICAL_W - 18, 24);

    // Stock ticker bar
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#E2E8F0';
    ctx.fillText(
      `FOOD:${this.stock.food} ($${this.prices.food})   ENERGY:${this.stock.energy} ($${this.prices.energy})   ORE:${this.stock.smithore} ($${this.prices.smithore})   CRYS:${this.stock.crystite} ($${this.prices.crystite})`,
      18,
      46
    );

    // Draw 9x5 Planet Irata Map
    for (const p of this.plots) {
      const x = MAP_X + p.col * TILE_W;
      const y = MAP_Y + p.row * TILE_H;
      if (p.terrain === 'town') {
        ctx.fillStyle = '#312E81';
      } else if (p.terrain === 'river') {
        ctx.fillStyle = '#0284C7';
      } else if (p.terrain.startsWith('mtn')) {
        ctx.fillStyle = '#78350F';
      } else {
        ctx.fillStyle = '#B45309';
      }
      ctx.fillRect(x + 1, y + 1, TILE_W - 2, TILE_H - 2);

      // Mountain peaks (1, 2, or 3 tiers)
      if (p.terrain.startsWith('mtn')) {
        const peaks = p.terrain === 'mtn3' ? 3 : p.terrain === 'mtn2' ? 2 : 1;
        ctx.fillStyle = '#D97706';
        for (let k = 0; k < peaks; k++) {
          const px = x + 12 + k * 16;
          ctx.beginPath();
          ctx.moveTo(px, y + 48);
          ctx.lineTo(px + 9, y + 20);
          ctx.lineTo(px + 18, y + 48);
          ctx.closePath();
          ctx.fill();
        }
      } else if (p.terrain === 'town') {
        ctx.fillStyle = '#FACC15';
        ctx.font = '900 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('IRATA', x + TILE_W * 0.5, y + 26);
        ctx.fillText('TOWN', x + TILE_W * 0.5, y + 40);
      }

      // Owner border flag
      if (p.owner >= 0) {
        const ownerColors = [sp.color, '#EF4444', '#C084FC', '#38BDF8'];
        ctx.strokeStyle = ownerColors[p.owner];
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 3, y + 3, TILE_W - 6, TILE_H - 6);
      }

      // Installed M.U.L.E. badge
      if (p.outfit) {
        ctx.fillStyle = 'rgba(5, 8, 20, 0.8)';
        ctx.fillRect(x + 6, y + 42, TILE_W - 12, 18);
        ctx.fillStyle = '#FEF08A';
        ctx.font = '800 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(p.outfit.slice(0, 4).toUpperCase(), x + TILE_W * 0.5, y + 54);
      }
    }

    // Mountain Wampus sparkle!
    if (this.subPhase === 'DEVELOP' && this.wampus.active) {
      const wx = MAP_X + (this.wampus.c + 0.5) * TILE_W;
      const wy = MAP_Y + (this.wampus.r + 0.5) * TILE_H;
      ctx.fillStyle = Math.floor(this.time * 10) % 2 === 0 ? '#FDE047' : '#F472B6';
      ctx.beginPath();
      ctx.arc(wx, wy, 9, 0, Math.PI * 2);
      ctx.fill();
    }

    // Grant selection cursor
    if (this.subPhase === 'GRANT') {
      const cx = MAP_X + this.cursorC * TILE_W;
      const cy = MAP_Y + this.cursorR * TILE_H;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3.5;
      ctx.strokeRect(cx + 2, cy + 2, TILE_W - 4, TILE_H - 4);
    }

    // Colonist + Tethered M.U.L.E.
    if (this.subPhase === 'DEVELOP' || this.phase === 'TITLE') {
      if (this.carryingOutfit) {
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.px, this.py);
        ctx.lineTo(this.muleX, this.muleY);
        ctx.stroke();
        ctx.fillStyle = '#E2E8F0';
        ctx.fillRect(this.muleX - 8, this.muleY - 6, 16, 12);
      }
      ctx.fillStyle = sp.color;
      ctx.beginPath();
      ctx.arc(this.px, this.py, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Bottom Context Control Strip
    const stripY = MAP_Y + MAP_ROWS * TILE_H + 14;
    ctx.fillStyle = 'rgba(5, 8, 20, 0.88)';
    ctx.fillRect(MAP_X, stripY, MAP_COLS * TILE_W, 108);
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(MAP_X, stripY, MAP_COLS * TILE_W, 108);

    ctx.textAlign = 'center';
    if (this.subPhase === 'SPECIES' && this.phase === 'PLAYING') {
      ctx.fillStyle = '#FACC15';
      ctx.font = '900 14px "JetBrains Mono", monospace';
      ctx.fillText(`SELECT SPECIES (ARROWS) · SPACE TO LAND ON IRATA`, LOGICAL_W * 0.5, stripY + 24);
      ctx.fillStyle = sp.color;
      ctx.font = '900 20px "JetBrains Mono", monospace';
      ctx.fillText(`${sp.name} — $${sp.startCash} · ${sp.perk}`, LOGICAL_W * 0.5, stripY + 58);
      ctx.fillStyle = '#94A3B8';
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.fillText(
        SPECIES_LIST.map((s, idx) => (idx === this.speciesIdx ? `[${s.name}]` : s.name.slice(0, 4))).join('  '),
        LOGICAL_W * 0.5,
        stripY + 86
      );
    } else if (this.subPhase === 'GRANT') {
      ctx.fillStyle = '#4ADE80';
      ctx.font = '900 15px "JetBrains Mono", monospace';
      ctx.fillText(`MONTH ${this.month} LAND GRANT — PICK AN UNCLAIMED PLOT + SPACE`, LOGICAL_W * 0.5, stripY + 38);
      ctx.fillStyle = '#CBD5E1';
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillText('RIVER = FOOD · PLAINS = ENERGY · MOUNTAINS = SMITHORE & CRYSTITE', LOGICAL_W * 0.5, stripY + 68);
    } else if (this.subPhase === 'DEVELOP') {
      const chosen = OUTFIT_ORDER[this.selectedOutfitIdx];
      const cost = Math.round(OUTFIT_COST[chosen] * (this.speciesIdx === 4 ? 0.8 : 1));
      ctx.fillStyle = '#38BDF8';
      ctx.font = '900 14px "JetBrains Mono", monospace';
      ctx.fillText(
        this.carryingOutfit
          ? `WALK TO YOUR OWNED PLOT & PRESS SPACE TO INSTALL ${this.carryingOutfit.toUpperCase()} M.U.L.E.!`
          : `ENTER IRATA TOWN + SPACE TO BUY ${chosen.toUpperCase()} M.U.L.E. ($${cost}) · SHIFT CYCLES`,
        LOGICAL_W * 0.5,
        stripY + 38
      );
      ctx.fillStyle = '#FACC15';
      ctx.font = '800 13px "JetBrains Mono", monospace';
      ctx.fillText(
        `TURN TIMER: ${Math.ceil(this.devTimer)}s   ·   CATCH GLOWING MOUNTAIN WAMPUS FOR BONUS CASH!`,
        LOGICAL_W * 0.5,
        stripY + 72
      );
    } else if (this.subPhase === 'PRODUCTION') {
      ctx.fillStyle = '#FDE047';
      ctx.font = '900 14px "JetBrains Mono", monospace';
      ctx.fillText(`PRODUCTION COMPLETE! ${this.eventHeadline}`, LOGICAL_W * 0.5, stripY + 42);
      ctx.fillStyle = '#CBD5E1';
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillText('PRESS SPACE TO ENTER MONTHLY COMMODITY AUCTION', LOGICAL_W * 0.5, stripY + 74);
    } else if (this.subPhase === 'AUCTION') {
      const res = OUTFIT_ORDER[this.auctionIdx];
      ctx.fillStyle = '#FACC15';
      ctx.font = '900 14px "JetBrains Mono", monospace';
      ctx.fillText(
        `AUCTION: ${res.toUpperCase()} ($${this.prices[res]}) · LEFT=SELL  RIGHT=BUY  UP/DN=GOOD  SPACE=NEXT MONTH`,
        LOGICAL_W * 0.5,
        stripY + 40
      );
      ctx.fillStyle = '#4ADE80';
      ctx.font = '800 13px "JetBrains Mono", monospace';
      ctx.fillText(
        `HOLDING ${this.stock[res]} ${res.toUpperCase()} · CASH $${this.cash} · AUCTION TIMER ${Math.ceil(this.auctionTimer)}s`,
        LOGICAL_W * 0.5,
        stripY + 74
      );
    } else {
      ctx.fillStyle = '#F59E0B';
      ctx.font = '900 15px "JetBrains Mono", monospace';
      ctx.fillText('M.U.L.E. — 12-MONTH PLANET IRATA COLONY SIMULATION', LOGICAL_W * 0.5, stripY + 48);
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
          ? 'M.U.L.E. — 8 SPECIES · PLANET IRATA COLONY SIM'
          : this.phase === 'GAME_OVER'
          ? `COLONY COMPLETE! FINAL VALUE ${this.score.toLocaleString()}`
          : '',
      canRestartStage: true,
    };
  }
}

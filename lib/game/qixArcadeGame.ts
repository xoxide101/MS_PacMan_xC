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

export type QixVariant = 'qix' | 'superqix';

const LOGICAL_W = 540;
const LOGICAL_H = 600;
const GRID_W = 90;
const GRID_H = 90;
const CELL = 5;
const FIELD_X = Math.floor((LOGICAL_W - GRID_W * CELL) / 2); // 45
const FIELD_Y = 76;
const FIELD_W = GRID_W * CELL; // 450
const FIELD_H = GRID_H * CELL; // 450

// Cell values: 0 = unclaimed, 1 = border, 2 = fast claimed, 3 = slow claimed (2x), 4 = active stix trail
type CellVal = 0 | 1 | 2 | 3 | 4;

interface QixRibbon {
  x: number;
  y: number;
  vx: number;
  vy: number;
  x2: number;
  y2: number;
  vx2: number;
  vy2: number;
  history: Array<{ x1: number; y1: number; x2: number; y2: number; hue: number }>;
}

interface SparxBot {
  gx: number;
  gy: number;
  dir: number; // 0:R, 1:D, 2:L, 3:U
  superMode: boolean;
  stepAccum: number;
}

type SuperPowerKind = 'freeze' | 'shield' | 'speed' | 'bonus' | 'warp';

interface SuperPowerUp {
  gx: number;
  gy: number;
  kind: SuperPowerKind;
  alive: boolean;
}

const SUPER_ART_THEMES = [
  'GOLDEN DRAGON',
  'SAMURAI CITADEL',
  'CYBER PHOENIX',
  'EMERALD KRAKEN',
  'STAR TEMPLE',
];

export class QixArcadeGame implements ArcadeGameInstance {
  public readonly logicalWidth = LOGICAL_W;
  public readonly logicalHeight = LOGICAL_H;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'Fast Draw';
  public readonly secondaryActionLabel = '2× Slow Draw';

  private readonly variant: QixVariant;
  private readonly storageKey: string;

  private phase: ClassicGamePhase = 'TITLE';
  private score = 0;
  private highScore = 0;
  private level = 1;
  private lives = 3;
  private input: ArcadeInputState = createEmptyInput();
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  private grid: Uint8Array = new Uint8Array(GRID_W * GRID_H);
  private claimedPercent = 0;
  private qixMult = 1;

  // Player Marker
  private gx = Math.floor(GRID_W / 2);
  private gy = GRID_H - 1;
  private moveAccum = 0;
  private drawing = false;
  private slowDraw = false;
  private trail: Array<{ x: number; y: number }> = [];
  private fuseIndex = 0;
  private fuseActive = false;
  private stallTimer = 0;

  // Enemies
  private qixList: QixRibbon[] = [];
  private sparx: SparxBot[] = [];
  private sparxEscalateTimer = 26;

  // Super Qix Power-Ups & Offscreen 16-bit Reveal Art
  private powerUps: SuperPowerUp[] = [];
  private freezeTimer = 0;
  private shieldHits = 0;
  private speedTimer = 0;
  private artCanvas: HTMLCanvasElement | null = null;

  private time = 0;
  private readyTimer = 0;
  private clearTimer = 0;

  constructor(variant: QixVariant) {
    this.variant = variant;
    this.storageKey = variant === 'superqix' ? 'superqix_hd_highscore_v1' : 'qix_hd_highscore_v1';
    this.highScore = readHighScore(this.storageKey);
    this.buildBoard(1);
  }

  public startNewGame(): void {
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.qixMult = 1;
    this.particles = [];
    this.popups = [];
    this.buildBoard(1);
    this.phase = 'READY';
    this.readyTimer = 1.05;
    arcadeAudio.playArcadeStart();
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.qixMult = 1;
    this.buildBoard(1);
  }

  public restartStage(): void {
    if (this.phase === 'PLAYING' || this.phase === 'PAUSED') {
      this.buildBoard(this.level);
      this.phase = 'READY';
      this.readyTimer = 0.85;
    }
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  private idx(x: number, y: number): number {
    return y * GRID_W + x;
  }

  private getCell(x: number, y: number): CellVal {
    if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H) return 1;
    return this.grid[this.idx(x, y)] as CellVal;
  }

  private setCell(x: number, y: number, v: CellVal): void {
    if (x >= 0 && x < GRID_W && y >= 0 && y < GRID_H) {
      this.grid[this.idx(x, y)] = v;
    }
  }

  private addScore(pts: number, x: number, y: number, text?: string, color = '#FDE047'): void {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(this.storageKey, this.highScore);
    }
    this.popups.push({
      x,
      y,
      text: text ?? `+${pts}`,
      color,
      life: 1.0,
      maxLife: 1.0,
    });
  }

  private generateSuperQixArt(lvl: number): void {
    if (typeof document === 'undefined') return;
    if (!this.artCanvas) {
      this.artCanvas = document.createElement('canvas');
      this.artCanvas.width = FIELD_W;
      this.artCanvas.height = FIELD_H;
    }
    const c = this.artCanvas.getContext('2d');
    if (!c) return;

    const themeIdx = (lvl - 1) % SUPER_ART_THEMES.length;
    const bg = c.createLinearGradient(0, 0, FIELD_W, FIELD_H);
    if (themeIdx === 0) {
      bg.addColorStop(0, '#451A03');
      bg.addColorStop(0.5, '#9A3412');
      bg.addColorStop(1, '#F59E0B');
    } else if (themeIdx === 1) {
      bg.addColorStop(0, '#1E1B4B');
      bg.addColorStop(0.5, '#9D174D');
      bg.addColorStop(1, '#FB7185');
    } else if (themeIdx === 2) {
      bg.addColorStop(0, '#0F172A');
      bg.addColorStop(0.5, '#7C2D12');
      bg.addColorStop(1, '#F97316');
    } else if (themeIdx === 3) {
      bg.addColorStop(0, '#022C22');
      bg.addColorStop(0.5, '#065F46');
      bg.addColorStop(1, '#10B981');
    } else {
      bg.addColorStop(0, '#1E1B4B');
      bg.addColorStop(0.5, '#4C1D95');
      bg.addColorStop(1, '#38BDF8');
    }
    c.fillStyle = bg;
    c.fillRect(0, 0, FIELD_W, FIELD_H);

    // Rich 16-bit procedural emblem artwork inside the curtain
    c.save();
    c.translate(FIELD_W * 0.5, FIELD_H * 0.5);
    // Sunburst rays
    for (let i = 0; i < 16; i++) {
      c.rotate(Math.PI / 8);
      c.fillStyle = 'rgba(255,255,255,0.08)';
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(-18, -FIELD_W * 0.7);
      c.lineTo(18, -FIELD_W * 0.7);
      c.closePath();
      c.fill();
    }
    // Central radiant crest
    c.fillStyle = '#FACC15';
    c.beginPath();
    c.arc(0, 0, 96, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = themeIdx === 3 ? '#064E3B' : '#7C2D12';
    c.beginPath();
    c.arc(0, 0, 74, 0, Math.PI * 2);
    c.fill();
    // Geometric dragon / phoenix / temple silhouette
    c.strokeStyle = '#FEF08A';
    c.lineWidth = 6;
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = i % 2 === 0 ? 140 : 62;
      if (i === 0) c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath();
    c.stroke();
    c.fillStyle = '#FFFFFF';
    c.font = '900 26px "JetBrains Mono", monospace';
    c.textAlign = 'center';
    c.fillText(SUPER_ART_THEMES[themeIdx], 0, 8);
    c.restore();
  }

  private buildBoard(lvl: number): void {
    this.level = lvl;
    this.grid.fill(0);
    for (let x = 0; x < GRID_W; x++) {
      this.setCell(x, 0, 1);
      this.setCell(x, GRID_H - 1, 1);
    }
    for (let y = 0; y < GRID_H; y++) {
      this.setCell(0, y, 1);
      this.setCell(GRID_W - 1, y, 1);
    }

    this.gx = Math.floor(GRID_W / 2);
    this.gy = GRID_H - 1;
    this.drawing = false;
    this.slowDraw = false;
    this.trail = [];
    this.fuseActive = false;
    this.fuseIndex = 0;
    this.stallTimer = 0;
    this.claimedPercent = 0;
    this.freezeTimer = 0;
    this.speedTimer = 0;
    this.shieldHits = 0;
    this.sparxEscalateTimer = Math.max(16, 28 - lvl * 2);

    // Spawn Qix (Stage 3+ spawns Twin Qix!)
    const qixCount = lvl >= 3 ? 2 : 1;
    this.qixList = [];
    const baseSpd = 24 + lvl * 4;
    for (let i = 0; i < qixCount; i++) {
      const cx = 30 + i * 30;
      const cy = 35 + i * 16;
      this.qixList.push({
        x: cx,
        y: cy,
        vx: (i === 0 ? 1 : -1) * baseSpd,
        vy: baseSpd * 0.85,
        x2: cx + 10,
        y2: cy - 8,
        vx2: -baseSpd * 0.9,
        vy2: baseSpd * 1.1,
        history: [],
      });
    }

    // Perimeter Sparx
    this.sparx = [
      { gx: Math.floor(GRID_W / 2), gy: 0, dir: 0, superMode: false, stepAccum: 0 },
      { gx: Math.floor(GRID_W / 2), gy: 0, dir: 2, superMode: false, stepAccum: 0 },
    ];

    // Super Qix encloseable Power-Ups & Art canvas
    this.powerUps = [];
    if (this.variant === 'superqix') {
      this.generateSuperQixArt(lvl);
      const kinds: SuperPowerKind[] = ['freeze', 'shield', 'speed', 'bonus', 'warp'];
      for (let i = 0; i < 4; i++) {
        this.powerUps.push({
          gx: 18 + Math.floor(Math.random() * (GRID_W - 36)),
          gy: 18 + Math.floor(Math.random() * (GRID_H - 36)),
          kind: kinds[(lvl + i) % kinds.length],
          alive: true,
        });
      }
    }
  }

  private cancelTrailAndHurt(reason: string): void {
    if (this.shieldHits > 0) {
      this.shieldHits -= 1;
      for (const p of this.trail) this.setCell(p.x, p.y, 0);
      this.trail = [];
      this.drawing = false;
      this.fuseActive = false;
      this.popups.push({
        x: FIELD_X + this.gx * CELL,
        y: FIELD_Y + this.gy * CELL - 12,
        text: 'SHIELD SAVED!',
        color: '#38BDF8',
        life: 0.9,
        maxLife: 0.9,
      });
      arcadeAudio.playDxShieldRepair();
      return;
    }

    const start = this.trail[0] ?? { x: Math.floor(GRID_W / 2), y: GRID_H - 1 };
    for (const p of this.trail) this.setCell(p.x, p.y, 0);
    this.trail = [];
    this.drawing = false;
    this.fuseActive = false;
    this.gx = start.x;
    this.gy = start.y;
    this.lives -= 1;
    arcadeAudio.playDeath();
    spawnBurst(this.particles, FIELD_X + this.gx * CELL, FIELD_Y + this.gy * CELL, '#F43F5E', 20, 190, 4);
    this.popups.push({
      x: FIELD_X + this.gx * CELL,
      y: FIELD_Y + this.gy * CELL - 16,
      text: reason,
      color: '#F87171',
      life: 1.0,
      maxLife: 1.0,
    });
    if (this.lives <= 0) this.phase = 'GAME_OVER';
  }

  private completePolygonClaim(): void {
    // Turn active Stix trail into solid border
    for (const p of this.trail) {
      this.setCell(p.x, p.y, 1);
    }

    // BFS flood-fill from every Qix center to identify unclaimed regions
    const visited = new Int8Array(GRID_W * GRID_H);
    const regionIds: number[] = [];

    for (let qi = 0; qi < this.qixList.length; qi++) {
      const q = this.qixList[qi];
      const qx = Math.max(1, Math.min(GRID_W - 2, Math.round((q.x + q.x2) * 0.5)));
      const qy = Math.max(1, Math.min(GRID_H - 2, Math.round((q.y + q.y2) * 0.5)));
      const startIdx = this.idx(qx, qy);
      if (this.grid[startIdx] !== 0) continue;
      if (visited[startIdx] !== 0) {
        regionIds.push(visited[startIdx]);
        continue;
      }
      const rid = qi + 1;
      regionIds.push(rid);
      const queue: number[] = [startIdx];
      visited[startIdx] = rid;
      let head = 0;
      while (head < queue.length) {
        const cur = queue[head++];
        const cx = cur % GRID_W;
        const cy = Math.floor(cur / GRID_W);
        const neigh = [
          [cx + 1, cy],
          [cx - 1, cy],
          [cx, cy + 1],
          [cx, cy - 1],
        ];
        for (const [nx, ny] of neigh) {
          if (nx <= 0 || nx >= GRID_W - 1 || ny <= 0 || ny >= GRID_H - 1) continue;
          const ni = this.idx(nx, ny);
          if (this.grid[ni] === 0 && visited[ni] === 0) {
            visited[ni] = rid;
            queue.push(ni);
          }
        }
      }
    }

    // Check Twin Qix Split bonus!
    const uniqueRegions = new Set(regionIds);
    if (this.qixList.length >= 2 && uniqueRegions.size >= 2) {
      this.qixMult = Math.min(8, this.qixMult + 1);
      this.addScore(
        4000 * this.qixMult,
        LOGICAL_W * 0.5,
        LOGICAL_H * 0.45,
        `TWIN QIX SPLIT! ${this.qixMult}×`,
        '#FACC15'
      );
      arcadeAudio.playExtraLife();
    }

    // Fill every unclaimed cell NOT reached by any Qix!
    let newlyClaimed = 0;
    const fillVal: CellVal = this.slowDraw ? 3 : 2;
    for (let y = 1; y < GRID_H - 1; y++) {
      for (let x = 1; x < GRID_W - 1; x++) {
        const i = this.idx(x, y);
        if (this.grid[i] === 0 && visited[i] === 0) {
          this.grid[i] = fillVal;
          newlyClaimed++;
        }
      }
    }

    // Recompute claimed %
    let totalClaimed = 0;
    const interiorTotal = (GRID_W - 2) * (GRID_H - 2);
    for (let y = 1; y < GRID_H - 1; y++) {
      for (let x = 1; x < GRID_W - 1; x++) {
        if (this.grid[this.idx(x, y)] !== 0) totalClaimed++;
      }
    }
    this.claimedPercent = Math.min(100, Math.round((totalClaimed / interiorTotal) * 100));

    const pts = Math.max(50, newlyClaimed * (this.slowDraw ? 20 : 10) * this.qixMult);
    this.addScore(
      pts,
      FIELD_X + this.gx * CELL,
      FIELD_Y + this.gy * CELL - 12,
      this.slowDraw ? `2× SLOW +${pts}` : `+${pts}`,
      this.slowDraw ? '#FACC15' : '#38BDF8'
    );
    arcadeAudio.playCoin();

    // Super Qix: Trigger any Power-Up enclosed inside claimed territory!
    if (this.variant === 'superqix') {
      for (const pu of this.powerUps) {
        if (!pu.alive) continue;
        if (this.getCell(pu.gx, pu.gy) !== 0) {
          pu.alive = false;
          const px = FIELD_X + pu.gx * CELL;
          const py = FIELD_Y + pu.gy * CELL;
          spawnBurst(this.particles, px, py, '#4ADE80', 18, 180, 4);
          arcadeAudio.playPowerUp();
          if (pu.kind === 'freeze') {
            this.freezeTimer = 7.0;
            this.addScore(1000, px, py, 'FREEZE!', '#38BDF8');
          } else if (pu.kind === 'shield') {
            this.shieldHits += 1;
            this.addScore(1000, px, py, 'SHIELD +1!', '#4ADE80');
          } else if (pu.kind === 'speed') {
            this.speedTimer = 8.0;
            this.addScore(1000, px, py, 'TURBO SPEED!', '#F472B6');
          } else if (pu.kind === 'bonus') {
            this.addScore(5000, px, py, 'BONUS +5000!', '#FACC15');
          } else if (pu.kind === 'warp') {
            this.lives += 1;
            this.addScore(2500, px, py, 'WARP + 1UP!', '#C084FC');
            this.claimedPercent = Math.max(this.claimedPercent, 80);
          }
        }
      }
    }

    this.trail = [];
    this.drawing = false;
    this.fuseActive = false;
    this.stallTimer = 0;

    // 75%+ clears board!
    if (this.claimedPercent >= 75) {
      const overPct = Math.max(0, this.claimedPercent - 75);
      const overBonus = overPct * 1000;
      const masterBonus = this.variant === 'superqix' && this.claimedPercent >= 90 ? 10000 : 0;
      this.addScore(
        overBonus + masterBonus + 2000,
        LOGICAL_W * 0.5,
        LOGICAL_H * 0.44,
        masterBonus > 0 ? `MASTER REVEAL +${overBonus + masterBonus}!` : `${this.claimedPercent}% CLEAR!`,
        '#4ADE80'
      );
      arcadeAudio.playStageClear();
      this.phase = 'STAGE_CLEAR';
      this.clearTimer = 1.85;
    }
  }

  private stepQix(dt: number): void {
    const frozen = this.freezeTimer > 0;
    for (const q of this.qixList) {
      if (!frozen) {
        // Chaotic ribbon endpoints bounce off borders/claimed territory
        const stepEndpoint = (x: number, y: number, vx: number, vy: number) => {
          let nvx = vx + (Math.random() - 0.5) * 48 * dt;
          let nvy = vy + (Math.random() - 0.5) * 48 * dt;
          const mag = Math.hypot(nvx, nvy) || 1;
          const targetSpd = 26 + this.level * 4;
          nvx = (nvx / mag) * targetSpd;
          nvy = (nvy / mag) * targetSpd;

          let nx = x + nvx * dt;
          let ny = y + nvy * dt;
          const c = this.getCell(Math.round(nx), Math.round(ny));
          if (c === 4 && this.drawing) {
            this.cancelTrailAndHurt('QIX HIT STIX!');
            return { x, y, vx: -nvx, vy: -nvy };
          }
          if (c !== 0) {
            if (this.getCell(Math.round(x + nvx * dt), Math.round(y)) !== 0) nvx = -nvx;
            if (this.getCell(Math.round(x), Math.round(y + nvy * dt)) !== 0) nvy = -nvy;
            nx = x + nvx * dt;
            ny = y + nvy * dt;
            if (this.getCell(Math.round(nx), Math.round(ny)) !== 0) {
              nx = x;
              ny = y;
            }
          }
          return { x: nx, y: ny, vx: nvx, vy: nvy };
        };

        const p1 = stepEndpoint(q.x, q.y, q.vx, q.vy);
        q.x = p1.x;
        q.y = p1.y;
        q.vx = p1.vx;
        q.vy = p1.vy;

        const p2 = stepEndpoint(q.x2, q.y2, q.vx2, q.vy2);
        q.x2 = p2.x;
        q.y2 = p2.y;
        q.vx2 = p2.vx;
        q.vy2 = p2.vy;

        // Keep ribbon length cohesive
        const dist = Math.hypot(q.x2 - q.x, q.y2 - q.y);
        if (dist > 22) {
          q.vx2 += (q.x - q.x2) * 2.5 * dt;
          q.vy2 += (q.y - q.y2) * 2.5 * dt;
        }
      }

      q.history.unshift({
        x1: q.x,
        y1: q.y,
        x2: q.x2,
        y2: q.y2,
        hue: (this.time * 140) % 360,
      });
      if (q.history.length > 9) q.history.pop();
    }
  }

  private stepSparx(dt: number): void {
    if (this.freezeTimer > 0) return;
    this.sparxEscalateTimer -= dt;
    if (this.sparxEscalateTimer <= 0) {
      this.sparxEscalateTimer = 24;
      for (const s of this.sparx) s.superMode = true;
    }

    const dirs = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ];
    for (const s of this.sparx) {
      s.stepAccum += (s.superMode ? 32 : 22) * dt;
      while (s.stepAccum >= 1) {
        s.stepAccum -= 1;
        // Follow border cells (1)
        const order = [s.dir, (s.dir + 1) % 4, (s.dir + 3) % 4, (s.dir + 2) % 4];
        for (const d of order) {
          const nx = s.gx + dirs[d][0];
          const ny = s.gy + dirs[d][1];
          if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H && this.getCell(nx, ny) === 1) {
            s.gx = nx;
            s.gy = ny;
            s.dir = d;
            break;
          }
        }
        if (this.phase === 'PLAYING' && !this.drawing && Math.hypot(s.gx - this.gx, s.gy - this.gy) < 2) {
          this.cancelTrailAndHurt(s.superMode ? 'SUPER SPARX!' : 'SPARX!');
        }
      }
    }
  }

  public step(dt: number): void {
    this.time += dt;
    stepParticlesAndPopups(this.particles, this.popups, dt);
    if (this.phase === 'PAUSED') return;

    this.stepQix(dt);
    this.stepSparx(dt);

    if (this.phase === 'TITLE') return;

    if (this.phase === 'READY') {
      this.readyTimer -= dt;
      if (this.readyTimer <= 0) this.phase = 'PLAYING';
      return;
    }

    if (this.phase === 'STAGE_CLEAR') {
      this.clearTimer -= dt;
      if (this.clearTimer <= 0) {
        this.buildBoard(this.level + 1);
        this.phase = 'READY';
        this.readyTimer = 0.95;
      }
      return;
    }

    if (this.phase === 'GAME_OVER') return;

    if (this.freezeTimer > 0) this.freezeTimer = Math.max(0, this.freezeTimer - dt);
    if (this.speedTimer > 0) this.speedTimer = Math.max(0, this.speedTimer - dt);

    // Direction input
    let dx = 0;
    let dy = 0;
    if (this.input.left) dx = -1;
    else if (this.input.right) dx = 1;
    else if (this.input.up) dy = -1;
    else if (this.input.down) dy = 1;

    const wantFast = this.input.fire;
    const wantSlow = this.input.secondary;
    const drawPressed = wantFast || wantSlow;

    // Burning Fuse when stalled mid-draw!
    if (this.drawing && dx === 0 && dy === 0) {
      this.stallTimer += dt;
      if (this.stallTimer > 0.35) {
        this.fuseActive = true;
        this.fuseIndex += 24 * dt;
        if (this.fuseIndex >= this.trail.length - 1) {
          this.cancelTrailAndHurt('FUSE BURN!');
          return;
        }
      }
    } else {
      this.stallTimer = 0;
    }

    const baseRate = this.drawing && this.slowDraw ? 22 : 42;
    const speedBoost = this.speedTimer > 0 ? 1.45 : 1;
    this.moveAccum += baseRate * speedBoost * (this.input.moveScale ?? 1) * dt;

    while (this.moveAccum >= 1) {
      this.moveAccum -= 1;
      if (dx === 0 && dy === 0) break;
      const nx = this.gx + dx;
      const ny = this.gy + dy;
      if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) break;
      const nextVal = this.getCell(nx, ny);

      if (!this.drawing) {
        if (nextVal === 1) {
          this.gx = nx;
          this.gy = ny;
        } else if (nextVal === 0 && drawPressed) {
          this.drawing = true;
          this.slowDraw = wantSlow && !wantFast;
          this.trail = [{ x: this.gx, y: this.gy }];
          this.fuseIndex = 0;
          this.fuseActive = false;
          this.gx = nx;
          this.gy = ny;
          this.setCell(nx, ny, 4);
          this.trail.push({ x: nx, y: ny });
        }
      } else {
        if (nextVal === 0) {
          this.gx = nx;
          this.gy = ny;
          this.setCell(nx, ny, 4);
          this.trail.push({ x: nx, y: ny });
        } else if (nextVal === 1) {
          this.gx = nx;
          this.gy = ny;
          this.completePolygonClaim();
          break;
        }
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.save();
    ctx.scale(dpr, dpr);

    // Frame backdrop
    ctx.fillStyle = '#050814';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // Top HUD
    ctx.font = '800 13px "JetBrains Mono", monospace';
    ctx.fillStyle = this.variant === 'superqix' ? '#FACC15' : '#F472B6';
    ctx.textAlign = 'left';
    ctx.fillText(
      this.variant === 'superqix'
        ? `SUPER QIX · ${SUPER_ART_THEMES[(this.level - 1) % SUPER_ART_THEMES.length]}`
        : `QIX · FIELD ${this.level} (${this.qixMult}×)`,
      20,
      25
    );
    ctx.textAlign = 'right';
    ctx.fillStyle = '#FDE047';
    ctx.fillText(`SCORE ${this.score.toLocaleString()}`, LOGICAL_W - 20, 25);

    // Claimed progress bar
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(FIELD_X, 42, FIELD_W, 14);
    ctx.fillStyle = this.claimedPercent >= 75 ? '#4ADE80' : '#38BDF8';
    ctx.fillRect(FIELD_X, 42, FIELD_W * (this.claimedPercent / 100), 14);
    ctx.fillStyle = '#FACC15';
    ctx.fillRect(FIELD_X + FIELD_W * 0.75, 40, 2, 18);
    ctx.font = '800 11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(`CLAIMED ${this.claimedPercent}% / 75%`, LOGICAL_W * 0.5, 53);

    // Unclaimed arena void
    ctx.fillStyle = '#03060E';
    ctx.fillRect(FIELD_X, FIELD_Y, FIELD_W, FIELD_H);

    // Render claimed territory (or reveal Super Qix hidden 16-bit artwork!)
    if (this.variant === 'superqix' && this.artCanvas) {
      // Draw full hidden art then mask unclaimed cells with dark curtain!
      ctx.drawImage(this.artCanvas, FIELD_X, FIELD_Y);
      ctx.fillStyle = '#070B18';
      for (let y = 1; y < GRID_H - 1; y++) {
        let runStart = -1;
        for (let x = 1; x <= GRID_W - 1; x++) {
          const unclaimed = x < GRID_W - 1 && this.grid[this.idx(x, y)] === 0;
          if (unclaimed && runStart === -1) runStart = x;
          else if (!unclaimed && runStart !== -1) {
            ctx.fillRect(FIELD_X + runStart * CELL, FIELD_Y + y * CELL, (x - runStart) * CELL, CELL);
            runStart = -1;
          }
        }
      }
    } else {
      // Classic Qix Fast Cyan / Slow Gold scanline fill
      for (let y = 1; y < GRID_H - 1; y++) {
        for (let x = 1; x < GRID_W - 1; x++) {
          const v = this.grid[this.idx(x, y)];
          if (v === 2) {
            ctx.fillStyle = 'rgba(14, 165, 233, 0.58)';
            ctx.fillRect(FIELD_X + x * CELL, FIELD_Y + y * CELL, CELL, CELL);
          } else if (v === 3) {
            ctx.fillStyle = 'rgba(245, 158, 11, 0.68)';
            ctx.fillRect(FIELD_X + x * CELL, FIELD_Y + y * CELL, CELL, CELL);
          }
        }
      }
    }

    // Crisp border cells
    ctx.fillStyle = this.variant === 'superqix' ? '#FACC15' : '#38BDF8';
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        if (this.grid[this.idx(x, y)] === 1) {
          ctx.fillRect(FIELD_X + x * CELL, FIELD_Y + y * CELL, CELL, CELL);
        }
      }
    }

    // Active Stix trail + Fuse spark
    if (this.trail.length > 1) {
      ctx.strokeStyle = this.slowDraw ? '#FACC15' : '#38BDF8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < this.trail.length; i++) {
        const px = FIELD_X + this.trail[i].x * CELL + CELL * 0.5;
        const py = FIELD_Y + this.trail[i].y * CELL + CELL * 0.5;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      if (this.fuseActive) {
        const fi = Math.min(this.trail.length - 1, Math.floor(this.fuseIndex));
        const fp = this.trail[fi];
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(FIELD_X + fp.x * CELL + 2.5, FIELD_Y + fp.y * CELL + 2.5, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(FIELD_X + fp.x * CELL + 2.5, FIELD_Y + fp.y * CELL + 2.5, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Super Qix Floating Power-Ups
    if (this.variant === 'superqix') {
      const labels: Record<SuperPowerKind, { c: string; l: string }> = {
        freeze: { c: '#38BDF8', l: 'F' },
        shield: { c: '#4ADE80', l: 'S' },
        speed: { c: '#F472B6', l: 'T' },
        bonus: { c: '#FACC15', l: '$' },
        warp: { c: '#C084FC', l: 'W' },
      };
      for (const pu of this.powerUps) {
        if (!pu.alive) continue;
        const px = FIELD_X + pu.gx * CELL;
        const py = FIELD_Y + pu.gy * CELL + Math.sin(this.time * 5 + pu.gx) * 3;
        const info = labels[pu.kind];
        ctx.fillStyle = info.c;
        ctx.beginPath();
        ctx.arc(px, py, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#050814';
        ctx.font = '900 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(info.l, px, py + 4);
      }
    }

    // Neon Multi-Ribbon Qix
    for (const q of this.qixList) {
      for (let i = q.history.length - 1; i >= 0; i--) {
        const h = q.history[i];
        const alpha = 1 - i / q.history.length;
        ctx.strokeStyle =
          this.freezeTimer > 0
            ? `rgba(125,211,252,${alpha})`
            : `hsla(${(h.hue + i * 24) % 360}, 95%, 62%, ${alpha})`;
        ctx.lineWidth = i === 0 ? 3.2 : 2;
        ctx.beginPath();
        ctx.moveTo(FIELD_X + h.x1 * CELL, FIELD_Y + h.y1 * CELL);
        ctx.lineTo(FIELD_X + h.x2 * CELL, FIELD_Y + h.y2 * CELL);
        ctx.stroke();
      }
    }

    // Sparx / Super Sparx
    for (const s of this.sparx) {
      const sx = FIELD_X + s.gx * CELL + 2.5;
      const sy = FIELD_Y + s.gy * CELL + 2.5;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(this.time * (s.superMode ? 12 : 7));
      ctx.strokeStyle = s.superMode ? '#EF4444' : '#FACC15';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-7, 0);
      ctx.lineTo(7, 0);
      ctx.moveTo(0, -7);
      ctx.lineTo(0, 7);
      ctx.stroke();
      ctx.restore();
    }

    // Player Diamond Marker
    const mx = FIELD_X + this.gx * CELL + 2.5;
    const my = FIELD_Y + this.gy * CELL + 2.5;
    ctx.fillStyle = this.shieldHits > 0 ? '#4ADE80' : this.slowDraw ? '#FACC15' : '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(mx, my - 7);
    ctx.lineTo(mx + 7, my);
    ctx.lineTo(mx, my + 7);
    ctx.lineTo(mx - 7, my);
    ctx.closePath();
    ctx.fill();

    renderParticlesAndPopups(ctx, this.particles, this.popups);
    if (visualMode === 'crt') renderCrtOverlay(ctx, LOGICAL_W, LOGICAL_H);
    ctx.restore();
  }

  public getHudSnapshot(): ClassicGameHud {
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: Math.max(0, this.lives),
      stageName:
        this.variant === 'superqix'
          ? `SUPER QIX · ${SUPER_ART_THEMES[(this.level - 1) % SUPER_ART_THEMES.length]}`
          : `QIX · FIELD ${this.level}`,
      primaryMetricLabel: 'CLAIMED',
      primaryMetricValue: `${this.claimedPercent}% / 75%`,
      secondaryMetricLabel: this.variant === 'superqix' ? 'SHIELD' : 'MULT',
      secondaryMetricValue:
        this.variant === 'superqix'
          ? this.freezeTimer > 0
            ? `ICE ${this.freezeTimer.toFixed(0)}s`
            : `${this.shieldHits} SHD`
          : `${this.qixMult}×`,
      bannerText:
        this.phase === 'TITLE'
          ? this.variant === 'superqix'
            ? 'SUPER QIX — REVEAL 16-BIT ART & TRAP POWER-UPS'
            : 'QIX — HOLD SPACE/SHIFT + DIR TO CARVE 75%'
          : this.phase === 'GAME_OVER'
          ? 'GAME OVER'
          : '',
      canRestartStage: true,
    };
  }
}

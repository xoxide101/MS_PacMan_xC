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
const LOGICAL_H = 520;
const GROUND_Y = 456;

type KaijuId = 'george' | 'lizzie' | 'ralph';

const KAIJU_INFO: Record<KaijuId, { name: string; color: string; accent: string }> = {
  george: { name: 'GEORGE', color: '#78350F', accent: '#FDBA74' },
  lizzie: { name: 'LIZZIE', color: '#16A34A', accent: '#BEF264' },
  ralph: { name: 'RALPH', color: '#92400E', accent: '#FDE68A' },
};

const CITY_THEMES = [
  { name: 'PEORIA, IL', skyTop: '#0C1445', skyBot: '#312E81', brick: '#9A3412' },
  { name: 'CHICAGO, IL', skyTop: '#0F172A', skyBot: '#1E3A8A', brick: '#475569' },
  { name: 'NEW YORK, NY', skyTop: '#1E1B4B', skyBot: '#581C87', brick: '#64748B' },
  { name: 'SAN FRANCISCO, CA', skyTop: '#451A03', skyBot: '#9A3412', brick: '#B45309' },
  { name: 'TOKYO, JP', skyTop: '#170B2B', skyBot: '#831843', brick: '#334155' },
  { name: 'WASHINGTON, D.C.', skyTop: '#0A192F', skyBot: '#1E40AF', brick: '#94A3B8' },
];

type WindowItem = 'none' | 'turkey' | 'citizen' | 'money' | 'toaster' | 'poison' | 'dynamite';

interface BuildingWindow {
  damaged: boolean;
  item: WindowItem;
}

interface Building {
  x: number;
  w: number;
  cols: number;
  floors: number;
  cellW: number;
  cellH: number;
  windows: BuildingWindow[];
  collapsing: boolean;
  destroyed: boolean;
  collapseOffset: number;
  color: string;
}

interface MilitaryUnit {
  kind: 'heli' | 'tank' | 'car';
  x: number;
  y: number;
  vx: number;
  fireTimer: number;
  alive: boolean;
}

interface EnemyShot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alive: boolean;
}

export class RampageArcadeGame implements ArcadeGameInstance {
  public readonly logicalWidth = LOGICAL_W;
  public readonly logicalHeight = LOGICAL_H;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'Smash / Eat';
  public readonly secondaryActionLabel = 'Leap / Swap';

  private readonly storageKey = 'rampage_hd_highscore_v1';
  private phase: ClassicGamePhase = 'TITLE';
  private score = 0;
  private highScore = 0;
  private level = 1;
  private lives = 3;
  private input: ArcadeInputState = createEmptyInput();
  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  private kaiju: KaijuId = 'george';
  private mx = LOGICAL_W * 0.5;
  private my = GROUND_Y;
  private mvx = 0;
  private mvy = 0;
  private facing = 1;
  private climbing = false;
  private health = 100;
  private punchTimer = 0;
  private stunTimer = 0;

  private buildings: Building[] = [];
  private units: MilitaryUnit[] = [];
  private shots: EnemyShot[] = [];
  private unitSpawnTimer = 2.6;
  private screenShake = 0;
  private time = 0;
  private readyTimer = 0;
  private clearTimer = 0;

  constructor() {
    this.highScore = readHighScore(this.storageKey);
    this.buildCity(1);
  }

  public startNewGame(): void {
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.health = 100;
    this.particles = [];
    this.popups = [];
    this.buildCity(1);
    this.phase = 'READY';
    this.readyTimer = 1.1;
    arcadeAudio.playArcadeStart();
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.buildCity(1);
  }

  public restartStage(): void {
    this.cycleKaiju();
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  private cycleKaiju(): void {
    const order: KaijuId[] = ['george', 'lizzie', 'ralph'];
    this.kaiju = order[(order.indexOf(this.kaiju) + 1) % order.length];
    arcadeAudio.playKeyUnlock();
    this.popups.push({
      x: this.mx,
      y: this.my - 64,
      text: `${KAIJU_INFO[this.kaiju].name}!`,
      color: '#4ADE80',
      life: 0.9,
      maxLife: 0.9,
    });
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
      life: 0.95,
      maxLife: 0.95,
    });
  }

  private buildCity(lvl: number): void {
    this.level = lvl;
    this.buildings = [];
    this.units = [];
    this.shots = [];
    this.mx = LOGICAL_W * 0.5;
    this.my = GROUND_Y;
    this.mvx = 0;
    this.mvy = 0;
    this.climbing = false;
    this.stunTimer = 0;
    this.unitSpawnTimer = 2.2;

    const theme = CITY_THEMES[(lvl - 1) % CITY_THEMES.length];
    const count = Math.min(5, 3 + Math.floor(lvl / 2));
    const slotW = (LOGICAL_W - 60) / count;
    const itemPool: WindowItem[] = ['turkey', 'citizen', 'money', 'toaster', 'poison', 'dynamite'];
    const buildingColors = [theme.brick, '#475569', '#6D28D9', '#0F766E', '#7C2D12'];

    for (let i = 0; i < count; i++) {
      const cols = 3 + (i % 2);
      const floors = Math.min(7, 4 + ((i + lvl) % 3));
      const w = Math.min(114, slotW - 18);
      const x = 30 + i * slotW + (slotW - w) * 0.5;
      const cellW = w / cols;
      const cellH = 38;
      const windows: BuildingWindow[] = [];
      for (let k = 0; k < cols * floors; k++) {
        const roll = Math.random();
        const item: WindowItem =
          roll < 0.28 ? itemPool[Math.floor(Math.random() * itemPool.length)] : 'none';
        windows.push({ damaged: false, item });
      }
      this.buildings.push({
        x,
        w,
        cols,
        floors,
        cellW,
        cellH,
        windows,
        collapsing: false,
        destroyed: false,
        collapseOffset: 0,
        color: buildingColors[(i + lvl) % buildingColors.length],
      });
    }
  }

  private buildingTopY(b: Building): number {
    return GROUND_Y - b.floors * b.cellH + b.collapseOffset;
  }

  private findBuildingAt(x: number, y: number): Building | null {
    for (const b of this.buildings) {
      if (b.destroyed || b.collapsing) continue;
      const top = this.buildingTopY(b);
      if (x >= b.x - 10 && x <= b.x + b.w + 10 && y >= top - 8 && y <= GROUND_Y + 4) {
        return b;
      }
    }
    return null;
  }

  private damageMonster(amount: number, reason: string): void {
    this.health -= amount;
    this.stunTimer = 0.28;
    arcadeAudio.playExplosion(false);
    spawnBurst(this.particles, this.mx, this.my - 28, '#EF4444', 10, 140, 3.2);
    this.popups.push({
      x: this.mx,
      y: this.my - 54,
      text: reason,
      color: '#F87171',
      life: 0.85,
      maxLife: 0.85,
    });
    if (this.health <= 0) {
      this.lives -= 1;
      arcadeAudio.playDeath();
      if (this.lives <= 0) {
        this.phase = 'GAME_OVER';
      } else {
        this.health = 100;
        this.my = GROUND_Y;
        this.climbing = false;
      }
    }
  }

  private performSmash(): void {
    this.punchTimer = 0.2;
    arcadeAudio.playHammerSmash();
    const hitX = this.mx + this.facing * 24;
    const hitY = this.my - 26;

    // Swat Helicopters, Tanks & Patrol Cars!
    for (const u of this.units) {
      if (!u.alive) continue;
      if (Math.hypot(u.x - hitX, u.y - hitY) < 42) {
        u.alive = false;
        const pts = u.kind === 'heli' ? 1000 : u.kind === 'tank' ? 750 : 500;
        this.addScore(pts, u.x, u.y, `SWAT +${pts}!`, '#4ADE80');
        spawnBurst(this.particles, u.x, u.y, '#F97316', 20, 200, 4);
        arcadeAudio.playExplosion(true);
        this.screenShake = Math.max(this.screenShake, 0.22);
      }
    }

    // Smash nearest undamaged window on overlapping building
    const b = this.findBuildingAt(this.mx, this.my - 24);
    if (!b) return;
    const topY = this.buildingTopY(b);
    const col = Math.max(0, Math.min(b.cols - 1, Math.floor((hitX - b.x) / b.cellW)));
    const row = Math.max(0, Math.min(b.floors - 1, Math.floor((hitY - topY) / b.cellH)));
    const winIdx = row * b.cols + col;
    const w = b.windows[winIdx];
    if (!w) return;

    const wx = b.x + (col + 0.5) * b.cellW;
    const wy = topY + (row + 0.5) * b.cellH;
    if (!w.damaged) {
      w.damaged = true;
      this.addScore(150, wx, wy, '+150', '#FDE047');
      spawnBurst(this.particles, wx, wy, '#CBD5E1', 10, 140, 3);
      this.screenShake = Math.max(this.screenShake, 0.14);

      // Resolve window item loot / hazard!
      if (w.item === 'turkey') {
        this.health = Math.min(100, this.health + 22);
        this.addScore(500, wx, wy - 14, 'ROAST +HP!', '#4ADE80');
        arcadeAudio.playEatFruit();
      } else if (w.item === 'citizen') {
        this.health = Math.min(100, this.health + 15);
        this.addScore(400, wx, wy - 14, 'NOM! +400', '#4ADE80');
        arcadeAudio.playEatFruit();
      } else if (w.item === 'money') {
        this.addScore(1000, wx, wy - 14, 'CASH +1000!', '#FACC15');
        arcadeAudio.playCoin();
      } else if (w.item === 'toaster') {
        this.damageMonster(14, 'ZAP! TOASTER!');
        arcadeAudio.playElectricZap();
      } else if (w.item === 'poison') {
        this.damageMonster(18, 'YUCK! POISON!');
      } else if (w.item === 'dynamite') {
        this.damageMonster(22, 'BOOM! DYNAMITE!');
        spawnBurst(this.particles, wx, wy, '#F97316', 22, 220, 4.5);
      }
      w.item = 'none';

      // Trigger Structural Collapse at 58% damage!
      const damagedCount = b.windows.filter((win) => win.damaged).length;
      if (damagedCount / b.windows.length >= 0.58) {
        b.collapsing = true;
        this.addScore(2500, b.x + b.w * 0.5, topY + 20, 'COLLAPSE +2500!', '#FACC15');
        arcadeAudio.playExplosion(true);
      }
    }
  }

  public step(dt: number): void {
    this.time += dt;
    stepParticlesAndPopups(this.particles, this.popups, dt);
    if (this.phase === 'PAUSED') return;

    if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - dt);
    if (this.punchTimer > 0) this.punchTimer = Math.max(0, this.punchTimer - dt);
    if (this.stunTimer > 0) this.stunTimer = Math.max(0, this.stunTimer - dt);

    if (this.phase === 'TITLE') {
      this.mx = LOGICAL_W * 0.5 + Math.sin(this.time * 1.1) * 140;
      return;
    }

    if (this.phase === 'READY') {
      this.readyTimer -= dt;
      if (this.readyTimer <= 0) this.phase = 'PLAYING';
      return;
    }

    if (this.phase === 'STAGE_CLEAR') {
      this.clearTimer -= dt;
      if (this.clearTimer <= 0) {
        this.health = Math.min(100, this.health + 35);
        this.buildCity(this.level + 1);
        this.phase = 'READY';
        this.readyTimer = 1.05;
      }
      return;
    }

    if (this.phase === 'GAME_OVER') return;

    const spd = 165 * (this.input.moveScale ?? 1);
    const { left, right, up, down } = this.input;
    const overlapping = this.findBuildingAt(this.mx, this.my - 20);

    if (up && overlapping) {
      this.climbing = true;
      this.mvy = 0;
      const topY = this.buildingTopY(overlapping);
      this.my = Math.max(topY, this.my - spd * 0.85 * dt);
    } else if (down && this.climbing) {
      this.my = Math.min(GROUND_Y, this.my + spd * 0.9 * dt);
      if (this.my >= GROUND_Y) this.climbing = false;
    }

    if (left) {
      this.mx = Math.max(24, this.mx - spd * dt);
      this.facing = -1;
    } else if (right) {
      this.mx = Math.min(LOGICAL_W - 24, this.mx + spd * dt);
      this.facing = 1;
    }

    // Shift/X: leap across roofs OR swap kaiju when standing still on ground
    if (this.input.secondaryJustPressed) {
      if (this.my >= GROUND_Y - 2 && !left && !right) {
        this.cycleKaiju();
      } else {
        this.climbing = false;
        this.mvy = -315;
        this.mvx = this.facing * 155;
        arcadeAudio.playJump();
      }
    }

    if (!this.climbing) {
      this.mvy += 680 * dt;
      this.mx = Math.max(24, Math.min(LOGICAL_W - 24, this.mx + this.mvx * dt));
      this.my += this.mvy * dt;
      this.mvx *= 1 - Math.min(0.9, dt * 3);
      if (this.my >= GROUND_Y) {
        this.my = GROUND_Y;
        this.mvy = 0;
        this.mvx = 0;
      }
      if (up && this.findBuildingAt(this.mx, this.my - 20)) {
        this.climbing = true;
        this.mvy = 0;
      }
    } else if (!overlapping || overlapping.collapsing) {
      this.climbing = false;
    }

    if (this.input.fireJustPressed) {
      this.performSmash();
    }

    // Update Collapsing Skyscrapers
    for (const b of this.buildings) {
      if (b.collapsing && !b.destroyed) {
        b.collapseOffset += 160 * dt;
        this.screenShake = Math.max(this.screenShake, 0.2);
        if (Math.random() < 0.45) {
          spawnBurst(this.particles, b.x + Math.random() * b.w, GROUND_Y - 8, '#94A3B8', 4, 130, 3.2);
        }
        if (b.collapseOffset >= b.floors * b.cellH) {
          b.destroyed = true;
          b.collapsing = false;
        }
      }
    }

    // Check City Clear!
    if (this.buildings.every((b) => b.destroyed)) {
      this.addScore(5000, LOGICAL_W * 0.5, LOGICAL_H * 0.42, 'CITY DEMOLISHED +5000!', '#4ADE80');
      arcadeAudio.playStageClear();
      this.phase = 'STAGE_CLEAR';
      this.clearTimer = 1.9;
      return;
    }

    // Spawn Military Helicopters, Tanks & Patrol Cars
    this.unitSpawnTimer -= dt;
    if (this.unitSpawnTimer <= 0 && this.units.length < 4 + Math.floor(this.level / 2)) {
      this.unitSpawnTimer = Math.max(1.8, 3.2 - this.level * 0.18);
      const fromLeft = Math.random() < 0.5;
      const roll = Math.random();
      const kind: MilitaryUnit['kind'] = roll < 0.5 ? 'heli' : roll < 0.78 ? 'tank' : 'car';
      this.units.push({
        kind,
        x: fromLeft ? -26 : LOGICAL_W + 26,
        y: kind === 'heli' ? 115 + Math.random() * 190 : GROUND_Y - 12,
        vx: (fromLeft ? 1 : -1) * (kind === 'heli' ? 88 : kind === 'car' ? 102 : 64),
        fireTimer: 1.5,
        alive: true,
      });
    }

    for (const u of this.units) {
      if (!u.alive) continue;
      u.x += u.vx * dt;
      if (u.x < -50 || u.x > LOGICAL_W + 50) u.alive = false;
      u.fireTimer -= dt;
      if (u.fireTimer <= 0) {
        u.fireTimer = 1.9 + Math.random();
        const ang = Math.atan2(this.my - 24 - u.y, this.mx - u.x);
        this.shots.push({
          x: u.x,
          y: u.y,
          vx: Math.cos(ang) * 210,
          vy: Math.sin(ang) * 210,
          alive: true,
        });
      }
    }
    this.units = this.units.filter((u) => u.alive);

    for (const s of this.shots) {
      if (!s.alive) continue;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.x < 0 || s.x > LOGICAL_W || s.y < 0 || s.y > LOGICAL_H) s.alive = false;
      if (Math.hypot(s.x - this.mx, s.y - (this.my - 26)) < 22) {
        s.alive = false;
        this.damageMonster(8, 'HIT! -8');
      }
    }
    this.shots = this.shots.filter((s) => s.alive);
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    const theme = CITY_THEMES[(this.level - 1) % CITY_THEMES.length];
    ctx.save();
    ctx.scale(dpr, dpr);

    if (this.screenShake > 0) {
      ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
    }

    // Sky backdrop
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    sky.addColorStop(0, theme.skyTop);
    sky.addColorStop(1, theme.skyBot);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, LOGICAL_W, GROUND_Y);

    // City Street & Curb
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(0, GROUND_Y, LOGICAL_W, LOGICAL_H - GROUND_Y);
    ctx.fillStyle = '#FACC15';
    for (let x = 10; x < LOGICAL_W; x += 48) {
      ctx.fillRect(x, GROUND_Y + 26, 26, 4);
    }

    // Top HUD
    ctx.font = '800 13px "JetBrains Mono", monospace';
    ctx.fillStyle = '#4ADE80';
    ctx.textAlign = 'left';
    ctx.fillText(`RAMPAGE · DAY ${this.level} · ${theme.name}`, 16, 24);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#FDE047';
    ctx.fillText(`SCORE ${this.score.toLocaleString()}`, LOGICAL_W - 16, 24);

    // Health meter bar
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(16, 34, 180, 12);
    ctx.fillStyle = this.health > 35 ? '#22C55E' : '#EF4444';
    ctx.fillRect(16, 34, 180 * Math.max(0, this.health / 100), 12);
    ctx.font = '800 10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.fillText(`${KAIJU_INFO[this.kaiju].name} HP ${Math.max(0, Math.round(this.health))}%`, 204, 44);

    // Draw Destructible Skyscrapers
    for (const b of this.buildings) {
      if (b.destroyed) {
        // Rubble pile
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.ellipse(b.x + b.w * 0.5, GROUND_Y, b.w * 0.55, 11, 0, Math.PI, 0);
        ctx.fill();
        continue;
      }
      const topY = this.buildingTopY(b);
      const h = Math.max(0, GROUND_Y - topY);
      ctx.save();
      ctx.beginPath();
      ctx.rect(b.x - 2, 52, b.w + 4, GROUND_Y - 52);
      ctx.clip();

      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, topY, b.w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x, topY, b.w, h);

      // Windows & Loot/Hazards
      for (let r = 0; r < b.floors; r++) {
        for (let c = 0; c < b.cols; c++) {
          const win = b.windows[r * b.cols + c];
          const wx = b.x + c * b.cellW + 5;
          const wy = topY + r * b.cellH + 6;
          const ww = b.cellW - 10;
          const wh = b.cellH - 12;
          if (win.damaged) {
            ctx.fillStyle = '#090D16';
            ctx.fillRect(wx, wy, ww, wh);
          } else {
            ctx.fillStyle = '#FEF08A';
            ctx.fillRect(wx, wy, ww, wh);
            if (win.item === 'turkey') {
              ctx.fillStyle = '#B45309';
              ctx.beginPath();
              ctx.arc(wx + ww * 0.5, wy + wh * 0.5, 5, 0, Math.PI * 2);
              ctx.fill();
            } else if (win.item === 'money') {
              ctx.fillStyle = '#16A34A';
              ctx.fillRect(wx + 3, wy + 5, ww - 6, wh - 10);
            } else if (win.item === 'poison') {
              ctx.fillStyle = '#22C55E';
              ctx.beginPath();
              ctx.arc(wx + ww * 0.5, wy + wh * 0.5, 5, 0, Math.PI * 2);
              ctx.fill();
            } else if (win.item === 'dynamite' || win.item === 'toaster') {
              ctx.fillStyle = '#EF4444';
              ctx.fillRect(wx + 4, wy + 4, ww - 8, wh - 8);
            }
          }
        }
      }
      ctx.restore();
    }

    // Military Units
    for (const u of this.units) {
      if (u.kind === 'heli') {
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.ellipse(u.x, u.y, 18, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        // Spinning rotor
        const rW = Math.sin(this.time * 40) * 22;
        ctx.strokeStyle = '#F8FAFC';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(u.x - rW, u.y - 11);
        ctx.lineTo(u.x + rW, u.y - 11);
        ctx.stroke();
      } else if (u.kind === 'tank') {
        ctx.fillStyle = '#4D7C0F';
        ctx.fillRect(u.x - 16, u.y - 8, 32, 14);
        ctx.fillStyle = '#A3E635';
        ctx.fillRect(u.x - 6, u.y - 14, 12, 7);
      } else {
        ctx.fillStyle = '#E2E8F0';
        ctx.fillRect(u.x - 14, u.y - 7, 28, 12);
        ctx.fillStyle = Math.floor(this.time * 12) % 2 === 0 ? '#EF4444' : '#3B82F6';
        ctx.fillRect(u.x - 4, u.y - 11, 8, 4);
      }
    }

    // Enemy Shots
    ctx.fillStyle = '#FACC15';
    for (const s of this.shots) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Giant Playable Kaiju (George / Lizzie / Ralph)
    const kInfo = KAIJU_INFO[this.kaiju];
    ctx.save();
    ctx.translate(this.mx, this.my);
    // Legs & Torso
    ctx.fillStyle = this.stunTimer > 0 ? '#F87171' : kInfo.color;
    ctx.beginPath();
    ctx.roundRect(-18, -48, 36, 36, 9);
    ctx.fill();
    ctx.fillRect(-15, -14, 11, 14);
    ctx.fillRect(4, -14, 11, 14);
    // Belly / Crest
    ctx.fillStyle = kInfo.accent;
    ctx.beginPath();
    ctx.ellipse(0, -30, 10, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    // Head
    ctx.fillStyle = kInfo.color;
    ctx.beginPath();
    ctx.arc(0, -56, 13, 0, Math.PI * 2);
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.arc(-4 + this.facing * 3, -58, 2.6, 0, Math.PI * 2);
    ctx.arc(4 + this.facing * 3, -58, 2.6, 0, Math.PI * 2);
    ctx.fill();
    // Smashing Giant Fist!
    if (this.punchTimer > 0) {
      ctx.fillStyle = kInfo.accent;
      ctx.beginPath();
      ctx.arc(this.facing * 26, -34, 11, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    renderParticlesAndPopups(ctx, this.particles, this.popups);
    if (visualMode === 'crt') renderCrtOverlay(ctx, LOGICAL_W, LOGICAL_H);
    ctx.restore();
  }

  public getHudSnapshot(): ClassicGameHud {
    const remaining = this.buildings.filter((b) => !b.destroyed).length;
    const theme = CITY_THEMES[(this.level - 1) % CITY_THEMES.length];
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: Math.max(0, this.lives),
      stageName: `RAMPAGE · ${theme.name}`,
      primaryMetricLabel: 'BUILDINGS',
      primaryMetricValue: `${remaining} LEFT`,
      secondaryMetricLabel: KAIJU_INFO[this.kaiju].name,
      secondaryMetricValue: `${Math.max(0, Math.round(this.health))}% HP`,
      bannerText:
        this.phase === 'TITLE'
          ? 'RAMPAGE — SMASH CITIES AS GEORGE, LIZZIE & RALPH'
          : this.phase === 'GAME_OVER'
          ? 'GAME OVER'
          : '',
      canRestartStage: true,
    };
  }
}

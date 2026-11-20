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
const STORAGE_KEY = 'foodfight_hd_highscore_v1';

type FoodKind = 'watermelon' | 'pie' | 'tomato' | 'banana' | 'peas';

interface FoodPile {
  x: number;
  y: number;
  kind: FoodKind;
  count: number;
}

interface ThrownFood {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: FoodKind;
  fromPlayer: boolean;
  spin: number;
}

interface ChefHole {
  x: number;
  y: number;
}

interface Chef {
  name: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  state: 'active' | 'splatted' | 'respawning';
  timer: number;
  throwCooldown: number;
  anim: number;
}

const FOOD_SPECS: Record<FoodKind, { color: string; accent: string; points: number }> = {
  watermelon: { color: '#22C55E', accent: '#EF4444', points: 300 },
  pie: { color: '#FEF3C7', accent: '#F59E0B', points: 200 },
  tomato: { color: '#EF4444', accent: '#4ADE80', points: 150 },
  banana: { color: '#FACC15', accent: '#92400E', points: 150 },
  peas: { color: '#4ADE80', accent: '#166534', points: 100 },
};

const CHEF_ROSTER = [
  { name: 'Oscar', color: '#38BDF8' },
  { name: 'Angelo', color: '#F97316' },
  { name: 'Jacques', color: '#A855F7' },
  { name: 'Zorba', color: '#22C55E' },
];

export class FoodFightGame implements ArcadeGameInstance {
  public readonly logicalWidth = WIDTH;
  public readonly logicalHeight = HEIGHT;
  public readonly supportsPointerAim = false;
  public readonly primaryActionLabel = 'Throw';

  private phase: ClassicGamePhase = 'TITLE';
  private score = 0;
  private highScore = readHighScore(STORAGE_KEY);
  private nextExtraLife = 15000;
  private level = 1;
  private lives = 3;
  private phaseTimer = 0;
  private time = 0;
  private bannerText = '';

  private input: ArcadeInputState = createEmptyInput();
  private playerX = 86;
  private playerY = HEIGHT * 0.5;
  private facingX = 1;
  private facingY = 0;
  private playerAnim = 0;
  private throwCooldown = 0;
  private invulnTimer = 0;

  private coneX = WIDTH - 84;
  private coneY = HEIGHT * 0.5;
  private coneMelt = 0; // 0..1 (1 = melted!)
  private chefsSplattedThisStage = 0;

  private piles: FoodPile[] = [];
  private holes: ChefHole[] = [];
  private chefs: Chef[] = [];
  private projectiles: ThrownFood[] = [];
  private splatMarks: Array<{ x: number; y: number; color: string; r: number }> = [];

  private particles: SimpleParticle[] = [];
  private popups: ScorePopup[] = [];

  constructor() {
    this.setupStage(1);
  }

  public setInput(input: ArcadeInputState): void {
    this.input = input;
  }

  public startNewGame(): void {
    arcadeAudio.playArcadeStart();
    this.score = 0;
    this.nextExtraLife = 15000;
    this.level = 1;
    this.lives = 3;
    this.particles = [];
    this.popups = [];
    this.setupStage(1);
    this.phase = 'READY';
    this.phaseTimer = 1.1;
    this.bannerText = 'GET THE ICE CREAM!';
  }

  public togglePause(): void {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  public resetToTitle(): void {
    this.phase = 'TITLE';
    this.level = 1;
    this.setupStage(1);
  }

  public getHudSnapshot(): ClassicGameHud {
    const coneLeftPct = Math.max(0, Math.round((1 - this.coneMelt) * 100));
    return {
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: this.lives,
      stageName: `Town Square · Level ${this.level}`,
      primaryMetricLabel: 'Ice Cream',
      primaryMetricValue: `${coneLeftPct}%`,
      secondaryMetricLabel: 'Chefs Hit',
      secondaryMetricValue: String(this.chefsSplattedThisStage),
      bannerText: this.bannerText,
    };
  }

  private addScore(pts: number, x?: number, y?: number, color = '#FDE047'): void {
    if (this.phase === 'TITLE') return;
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(STORAGE_KEY, this.highScore);
    }
    if (this.score >= this.nextExtraLife) {
      this.lives = Math.min(6, this.lives + 1);
      this.nextExtraLife += 15000;
      arcadeAudio.playExtraLife();
      this.popups.push({ x: this.playerX, y: this.playerY - 26, text: '1UP!', color: '#4ADE80', life: 1.3, maxLife: 1.3 });
    }
    if (x !== undefined && y !== undefined && pts >= 50) {
      this.popups.push({ x, y, text: `+${pts}`, color, life: 0.95, maxLife: 0.95 });
    }
  }

  private setupStage(lvl: number): void {
    this.playerX = 86;
    this.playerY = HEIGHT * 0.5;
    this.facingX = 1;
    this.facingY = 0;
    this.invulnTimer = 1.2;
    this.coneX = WIDTH - 84;
    this.coneY = HEIGHT * 0.5;
    this.coneMelt = 0;
    this.chefsSplattedThisStage = 0;
    this.projectiles = [];
    this.splatMarks = [];

    // 7 Vibrant Food Piles arranged cleanly across the plaza
    const kinds: FoodKind[] = ['watermelon', 'pie', 'tomato', 'banana', 'peas', 'pie', 'watermelon'];
    const pileCoords: Array<[number, number]> = [
      [215, 155],
      [225, 470],
      [390, 290],
      [435, 130],
      [455, 515],
      [605, 200],
      [610, 445],
    ];
    this.piles = pileCoords.map(([x, y], i) => ({
      x,
      y,
      kind: kinds[(i + lvl) % kinds.length],
      count: 6 + (i % 3) * 2,
    }));

    // Black Chef Emergence Holes (scales with level)
    const holeCoords: Array<[number, number]> = [
      [310, 120],
      [315, 520],
      [530, 115],
      [535, 525],
      [685, 165],
      [685, 475],
    ];
    this.holes = holeCoords.slice(0, Math.min(holeCoords.length, 3 + lvl)).map(([x, y]) => ({ x, y }));

    // 4 Classic Chefs
    this.chefs = CHEF_ROSTER.map((spec, i) => {
      const hole = this.holes[i % this.holes.length];
      return {
        name: spec.name,
        color: spec.color,
        x: hole.x,
        y: hole.y,
        vx: 0,
        vy: 0,
        state: 'respawning',
        timer: 0.4 + i * 0.45,
        throwCooldown: 1.5 + i * 0.6,
        anim: i * 1.4,
      };
    });
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
        this.setupStage(this.level);
        this.phase = 'READY';
        this.phaseTimer = 1.05;
        this.bannerText = `LEVEL ${this.level} · HURRY!`;
      }
      return;
    }

    const isAttract = this.phase === 'TITLE';

    // Ice cream cone melts steadily!
    const meltSpeed = 1 / Math.max(15, 28 - (this.level - 1) * 1.8);
    this.coneMelt = Math.min(1, this.coneMelt + meltSpeed * dt);
    if (this.coneMelt >= 1) {
      if (isAttract) {
        this.setupStage(1);
      } else {
        this.handlePlayerHit('CONE MELTED!');
      }
      return;
    }

    this.updatePlayer(dt, isAttract);
    this.updateChefs(dt, isAttract);
    this.updateProjectiles(dt, isAttract);

    // Check reaching the Giant Ice Cream Cone!
    if (Math.hypot(this.playerX - this.coneX, this.playerY - this.coneY) < 44) {
      if (isAttract) {
        this.setupStage(1);
      } else {
        const coneBonus = 500 + Math.round((1 - this.coneMelt) * 1000) + this.level * 250;
        arcadeAudio.playStageClear();
        spawnBurst(this.particles, this.coneX, this.coneY, '#F472B6', 26, 220, 4);
        this.addScore(coneBonus, this.coneX - 30, this.coneY - 24, '#F472B6');
        this.phase = 'STAGE_CLEAR';
        this.phaseTimer = 1.5;
        this.bannerText = this.chefsSplattedThisStage >= 4 ? `INSTANT REPLAY! +${coneBonus}` : `YUM! +${coneBonus}`;
      }
    }
  }

  private getNearestPile(x: number, y: number, maxDist: number): FoodPile | null {
    let best: FoodPile | null = null;
    let bestD = maxDist;
    for (const p of this.piles) {
      if (p.count <= 0) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  private updatePlayer(dt: number, isAttract: boolean): void {
    if (this.throwCooldown > 0) this.throwCooldown = Math.max(0, this.throwCooldown - dt);
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);

    let mx = 0;
    let my = 0;

    if (isAttract) {
      // Attract AI dashes toward cone while dodging chefs and throwing food from nearby piles
      let tx = this.coneX;
      let ty = this.coneY;
      const nearbyPile = this.getNearestPile(this.playerX, this.playerY, 56);
      const closeChef = this.chefs.find(
        (c) => c.state === 'active' && Math.hypot(c.x - this.playerX, c.y - this.playerY) < 165
      );
      if (nearbyPile && closeChef && this.throwCooldown <= 0) {
        const dx = closeChef.x - this.playerX;
        const dy = closeChef.y - this.playerY;
        const d = Math.hypot(dx, dy) || 1;
        this.facingX = dx / d;
        this.facingY = dy / d;
        this.throwFoodFromPile(nearbyPile, true);
      } else if (closeChef) {
        tx = this.playerX - (closeChef.x - this.playerX) * 0.6 + 80;
        ty = this.playerY - (closeChef.y - this.playerY);
      }
      const dx = tx - this.playerX;
      const dy = ty - this.playerY;
      const dist = Math.hypot(dx, dy) || 1;
      mx = dx / dist;
      my = dy / dist;
    } else {
      mx = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
      my = (this.input.down ? 1 : 0) - (this.input.up ? 1 : 0);
      if (mx !== 0 && my !== 0) {
        mx *= 0.7071;
        my *= 0.7071;
      }
    }

    if (mx !== 0 || my !== 0) {
      this.facingX = mx;
      this.facingY = my;
      this.playerAnim += dt * 14;
      const speed = 250;
      this.playerX = Math.max(36, Math.min(WIDTH - 36, this.playerX + mx * speed * dt));
      this.playerY = Math.max(66, Math.min(HEIGHT - 44, this.playerY + my * speed * dt));
    }

    // Grab & hurl food when near a pile!
    if (!isAttract && (this.input.fire || this.input.fireJustPressed) && this.throwCooldown <= 0) {
      const pile = this.getNearestPile(this.playerX, this.playerY, 64);
      if (pile) {
        this.throwFoodFromPile(pile, false);
      }
    }
  }

  private throwFoodFromPile(pile: FoodPile, isAttract: boolean): void {
    pile.count -= 1;
    this.throwCooldown = 0.2;
    const speed = 520;
    this.projectiles.push({
      x: this.playerX + this.facingX * 16,
      y: this.playerY + this.facingY * 16,
      vx: this.facingX * speed,
      vy: this.facingY * speed,
      kind: pile.kind,
      fromPlayer: true,
      spin: 0,
    });
    if (!isAttract) arcadeAudio.playThrow();
  }

  private updateChefs(dt: number, isAttract: boolean): void {
    const baseSpeed = Math.min(225, 128 + (this.level - 1) * 14);

    for (const chef of this.chefs) {
      chef.anim += dt * 12;

      if (chef.state === 'splatted') {
        chef.timer -= dt;
        if (chef.timer <= 0) {
          const hole = this.holes[Math.floor(Math.random() * this.holes.length)];
          chef.x = hole.x;
          chef.y = hole.y;
          chef.state = 'respawning';
          chef.timer = 1.1;
        }
        continue;
      }

      if (chef.state === 'respawning') {
        chef.timer -= dt;
        if (chef.timer <= 0) {
          chef.state = 'active';
        }
        continue;
      }

      // Active pursuit toward Charley Chuck
      const dx = this.playerX - chef.x;
      const dy = this.playerY - chef.y;
      const dist = Math.hypot(dx, dy) || 1;
      chef.vx = (dx / dist) * baseSpeed;
      chef.vy = (dy / dist) * baseSpeed;
      chef.x = Math.max(36, Math.min(WIDTH - 36, chef.x + chef.vx * dt));
      chef.y = Math.max(66, Math.min(HEIGHT - 44, chef.y + chef.vy * dt));

      // Chefs grab food from piles they pass and throw it at Charley!
      chef.throwCooldown -= dt;
      if (chef.throwCooldown <= 0 && dist < 340) {
        const pile = this.getNearestPile(chef.x, chef.y, 46);
        if (pile) {
          pile.count = Math.max(1, pile.count - 1);
          chef.throwCooldown = Math.max(1.3, 2.7 - this.level * 0.2);
          const spd = 330 + this.level * 18;
          this.projectiles.push({
            x: chef.x,
            y: chef.y,
            vx: (dx / dist) * spd,
            vy: (dy / dist) * spd,
            kind: pile.kind,
            fromPlayer: false,
            spin: 0,
          });
        }
      }

      // Check catching Charley
      if (!isAttract && this.invulnTimer <= 0 && dist < 28) {
        this.handlePlayerHit(`${chef.name.toUpperCase()} CAUGHT YOU!`);
        return;
      }
    }
  }

  private updateProjectiles(dt: number, isAttract: boolean): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.spin += dt * 14;

      if (pr.x < 16 || pr.x > WIDTH - 16 || pr.y < 52 || pr.y > HEIGHT - 20) {
        this.projectiles.splice(i, 1);
        continue;
      }

      if (pr.fromPlayer) {
        let hit = false;
        for (const chef of this.chefs) {
          if (chef.state !== 'active') continue;
          if (Math.hypot(pr.x - chef.x, pr.y - chef.y) < 26) {
            chef.state = 'splatted';
            chef.timer = 1.8;
            this.chefsSplattedThisStage += 1;
            const spec = FOOD_SPECS[pr.kind];
            this.splatMarks.push({ x: chef.x, y: chef.y, color: spec.accent, r: 16 });
            if (this.splatMarks.length > 24) this.splatMarks.shift();
            if (!isAttract) arcadeAudio.playSplat();
            spawnBurst(this.particles, chef.x, chef.y, spec.accent, 18, 210, 4);
            this.addScore(spec.points, chef.x, chef.y, '#FDE047');
            hit = true;
            break;
          }
        }
        if (hit) {
          this.projectiles.splice(i, 1);
          continue;
        }
      } else {
        // Chef projectile hitting Charley
        if (!isAttract && this.invulnTimer <= 0 && Math.hypot(pr.x - this.playerX, pr.y - this.playerY) < 23) {
          this.projectiles.splice(i, 1);
          this.handlePlayerHit('SPLATTED!');
          return;
        }
      }
    }
  }

  private handlePlayerHit(reason: string): void {
    arcadeAudio.playDeath();
    spawnBurst(this.particles, this.playerX, this.playerY, '#FB7185', 26, 240, 4.5);
    this.lives -= 1;
    this.projectiles = [];
    if (this.lives <= 0) {
      this.phase = 'GAME_OVER';
      this.bannerText = 'GAME OVER';
      return;
    }
    this.setupStage(this.level);
    this.phase = 'READY';
    this.phaseTimer = 1.25;
    this.bannerText = reason;
  }

  public render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Classic vibrant checkered town plaza
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Checkered plaza tiles
    const tileS = 48;
    for (let r = 1; r < Math.ceil(HEIGHT / tileS); r++) {
      for (let c = 0; c < Math.ceil(WIDTH / tileS); c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#182234' : '#131B2A';
        ctx.fillRect(c * tileS, r * tileS, tileS, tileS);
      }
    }

    // Top plaza awning trim
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, WIDTH, 48);
    for (let x = 0; x < WIDTH; x += 36) {
      ctx.fillStyle = (x / 36) % 2 === 0 ? '#E11D48' : '#F8FAFC';
      ctx.fillRect(x, 40, 36, 10);
    }

    // Persistent food splat decals on plaza floor
    for (const sm of this.splatMarks) {
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = sm.color;
      ctx.beginPath();
      ctx.arc(sm.x, sm.y, sm.r, 0, Math.PI * 2);
      ctx.arc(sm.x + sm.r * 0.6, sm.y - sm.r * 0.3, sm.r * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Swirling Chef Holes
    for (const hole of this.holes) {
      ctx.save();
      ctx.translate(hole.x, hole.y);
      ctx.fillStyle = '#020617';
      ctx.beginPath();
      ctx.ellipse(0, 0, 24, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // Food Piles (with subtle grab highlight when Charley is in range)
    const grabPile = this.getNearestPile(this.playerX, this.playerY, 64);
    for (const p of this.piles) {
      if (p.count <= 0) continue;
      this.drawFoodPile(ctx, p, p === grabPile);
    }

    // Giant Melting Ice Cream Cone Goal
    this.drawIceCreamCone(ctx, this.coneX, this.coneY, this.coneMelt);

    // Chefs
    for (const chef of this.chefs) {
      if (chef.state === 'respawning' && chef.timer > 0.45) continue;
      this.drawChef(ctx, chef);
    }

    // Charley Chuck Hero
    if (this.phase !== 'GAME_OVER') {
      const blink = this.invulnTimer > 0 && Math.floor(this.time * 16) % 2 === 0;
      if (!blink) this.drawCharley(ctx, this.playerX, this.playerY);
    }

    // Flying Food Projectiles
    for (const pr of this.projectiles) {
      this.drawFoodItem(ctx, pr.x, pr.y, pr.kind, pr.spin, 1.05);
    }

    renderParticlesAndPopups(ctx, this.particles, this.popups);

    if (this.bannerText && (this.phase === 'READY' || this.phase === 'STAGE_CLEAR')) {
      ctx.save();
      ctx.font = '800 28px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(4, 6, 13, 0.85)';
      ctx.fillRect(WIDTH * 0.2, HEIGHT * 0.42, WIDTH * 0.6, 56);
      ctx.fillStyle = '#FB7185';
      ctx.fillText(this.bannerText, WIDTH * 0.5, HEIGHT * 0.42 + 28);
      ctx.restore();
    }

    if (visualMode === 'crt') renderCrtOverlay(ctx, WIDTH, HEIGHT);
  }

  private drawFoodPile(ctx: CanvasRenderingContext2D, pile: FoodPile, inRange: boolean): void {
    ctx.save();
    ctx.translate(pile.x, pile.y);

    if (inRange) {
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(0, 6, 30, 18, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Crate shadow
    ctx.fillStyle = 'rgba(2, 6, 23, 0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 10, 24, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Stack up to 3 items visually
    const shown = Math.min(3, pile.count);
    const offsets: Array<[number, number]> = [
      [-8, 3],
      [8, 3],
      [0, -7],
    ];
    for (let i = 0; i < shown; i++) {
      this.drawFoodItem(ctx, offsets[i][0], offsets[i][1], pile.kind, 0, 0.85);
    }
    ctx.restore();
  }

  private drawFoodItem(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    kind: FoodKind,
    rot: number,
    scale: number
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(scale, scale);

    if (kind === 'watermelon') {
      ctx.fillStyle = '#16A34A';
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(0, 0, 8.2, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
    } else if (kind === 'pie') {
      ctx.fillStyle = '#D97706';
      ctx.beginPath();
      ctx.ellipse(0, 4, 12, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FEF3C7';
      ctx.beginPath();
      ctx.arc(0, 2, 9.5, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(0, -7, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'tomato') {
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(0, 1, 9.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#22C55E';
      ctx.fillRect(-3, -10, 6, 4);
    } else if (kind === 'banana') {
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, -2, 9, 0.25 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#4ADE80';
      ctx.beginPath();
      ctx.arc(-5, 2, 4.5, 0, Math.PI * 2);
      ctx.arc(5, 2, 4.5, 0, Math.PI * 2);
      ctx.arc(0, -4, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawIceCreamCone(ctx: CanvasRenderingContext2D, x: number, y: number, melt: number): void {
    ctx.save();
    ctx.translate(x, y);

    // Growing strawberry melt puddle beneath the cone
    ctx.fillStyle = 'rgba(244, 114, 182, 0.55)';
    ctx.beginPath();
    ctx.ellipse(0, 32, 14 + melt * 28, 6 + melt * 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Waffle cone
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.moveTo(-16, 4);
    ctx.lineTo(16, 4);
    ctx.lineTo(0, 36);
    ctx.closePath();
    ctx.fill();

    // Shrinking ice cream scoops as cone melts!
    const scoopScale = Math.max(0.2, 1 - melt * 0.82);
    ctx.save();
    ctx.translate(0, 4 - scoopScale * 10);
    ctx.scale(scoopScale, scoopScale);
    ctx.shadowColor = '#F472B6';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#F472B6';
    ctx.beginPath();
    ctx.arc(0, 2, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FEF3C7';
    ctx.beginPath();
    ctx.arc(0, -14, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(0, -28, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  private drawCharley(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.translate(x, y);
    if (this.facingX < -0.1) ctx.scale(-1, 1);

    // Shadow
    ctx.fillStyle = 'rgba(2, 6, 23, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 16, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bright yellow shirt & blue jeans
    const bob = Math.sin(this.playerAnim) * 2.5;
    ctx.fillStyle = '#3B82F6';
    ctx.fillRect(-8, 6, 6, 10 + bob * 0.4);
    ctx.fillRect(2, 6, 6, 10 - bob * 0.4);
    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.roundRect(-11, -8, 22, 16, 6);
    ctx.fill();
    // Head & grin
    ctx.fillStyle = '#FDBA74';
    ctx.beginPath();
    ctx.arc(0, -14, 10, 0, Math.PI * 2);
    ctx.fill();
    // Red cap
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(0, -17, 10, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(2, -18, 10, 3);
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(3, -15, 2.5, 3);
    ctx.restore();
  }

  private drawChef(ctx: CanvasRenderingContext2D, chef: Chef): void {
    ctx.save();
    ctx.translate(chef.x, chef.y);
    if (chef.state === 'splatted') {
      ctx.globalAlpha = 0.72;
      ctx.rotate(0.4);
    } else if (chef.state === 'respawning') {
      ctx.scale(0.75, 0.75);
    }

    // Chef white apron & colored coat
    ctx.fillStyle = chef.color;
    ctx.beginPath();
    ctx.roundRect(-12, -6, 24, 20, 6);
    ctx.fill();
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(-7, -2, 14, 15);

    // Face & mustache
    ctx.fillStyle = '#FDBA74';
    ctx.beginPath();
    ctx.arc(0, -13, 9.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(-5, -10, 10, 2.5);

    // Tall puffy white toque chef hat!
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-9, -25, 18, 8);
    ctx.beginPath();
    ctx.arc(-5, -26, 6, 0, Math.PI * 2);
    ctx.arc(0, -29, 7, 0, Math.PI * 2);
    ctx.arc(5, -26, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

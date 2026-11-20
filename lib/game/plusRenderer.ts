import { PacManPlusEngine, PLUS_MAZE, PlusBonusType, PlusGhostState } from './plusEngine';
import {
  CANVAS_LOGICAL_HEIGHT,
  CANVAS_LOGICAL_WIDTH,
  Direction,
  GRID_COLS,
  GRID_ROWS,
  LOGICAL_TILE_SIZE as T,
  VisualStyle,
} from './types';

function dirAngle(dir: Direction): number {
  switch (dir) {
    case 'RIGHT':
      return 0;
    case 'DOWN':
      return Math.PI * 0.5;
    case 'LEFT':
      return Math.PI;
    case 'UP':
      return -Math.PI * 0.5;
    default:
      return 0;
  }
}

export class PacManPlusRenderer {
  private wallCache: HTMLCanvasElement | null = null;
  private cachedKey = '';

  public render(
    ctx: CanvasRenderingContext2D,
    engine: PacManPlusEngine,
    dpr: number,
    visualStyle: VisualStyle
  ): void {
    const theme = engine.maze.theme;
    const width = CANVAS_LOGICAL_WIDTH;
    const height = CANVAS_LOGICAL_HEIGHT;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Rich dark emerald floor
    ctx.fillStyle = theme.floorTint;
    ctx.fillRect(0, 0, width, height);

    if (engine.screenShake > 0.1) {
      ctx.translate(
        (Math.random() - 0.5) * engine.screenShake,
        (Math.random() - 0.5) * engine.screenShake
      );
    }

    // Authentic 1982 Pac-Man Plus Invisible Maze Wildcard!
    const mazeAlpha =
      engine.mazeInvisibleRemaining > 0
        ? engine.mazeInvisibleRemaining < 1.1
          ? 0.25 + 0.55 * (Math.floor(engine.elapsed * 12) % 2)
          : 0.04
        : 1;

    const flashWhite =
      engine.phase === 'STAGE_CLEAR' && Math.floor(engine.stageClearFlashPhase) % 2 === 1;
    this.ensureWallCache(dpr, flashWhite);
    if (this.wallCache && mazeAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = mazeAlpha;
      ctx.drawImage(this.wallCache, 0, 0, width, height);
      ctx.restore();
    }

    // Subtle floor aura around Pac-Man
    if (engine.phase !== 'DYING') {
      const px = engine.player.x * T;
      const py = engine.player.y * T;
      const g = ctx.createRadialGradient(px, py, 2, px, py, T * 2.4);
      g.addColorStop(0, engine.doubleGhostPtsActive ? 'rgba(74, 222, 128, 0.22)' : 'rgba(255, 220, 56, 0.15)');
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, T * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Pellets & Power Pellets
    const pulse = 0.5 + 0.5 * Math.sin(engine.elapsed * 7.5);
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const ch = engine.grid[r][c];
        if (ch === '.') {
          const cx = (c + 0.5) * T;
          const cy = (r + 0.5) * T;
          ctx.fillStyle = theme.pelletGlow;
          ctx.beginPath();
          ctx.arc(cx, cy, 4.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = theme.pelletColor;
          ctx.beginPath();
          ctx.arc(cx, cy, 3.0, 0, Math.PI * 2);
          ctx.fill();
        } else if (ch === 'o') {
          const cx = (c + 0.5) * T;
          const cy = (r + 0.5) * T;
          const haloR = 15 + pulse * 5;
          const grad = ctx.createRadialGradient(cx, cy, 1, cx, cy, haloR);
          grad.addColorStop(0, 'rgba(220, 252, 231, 0.95)');
          grad.addColorStop(0.5, 'rgba(74, 222, 128, 0.45)');
          grad.addColorStop(1, 'rgba(74, 222, 128, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ECFDF5';
          ctx.beginPath();
          ctx.arc(cx, cy, 7.6 + pulse * 1.7, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Center 1982 Pac-Man Plus Bonus Item (Soda Can, Cocktail, Pea Pod, etc.)
    if (engine.bonus.active) {
      const bx = engine.bonus.x * T;
      const by = engine.bonus.y * T + Math.sin(engine.elapsed * 5.2) * 2.5;
      this.drawPlusBonus(ctx, engine.bonus.type, bx, by, 1.05);
    }

    // Player
    if (engine.phase !== 'GHOST_EATEN_PAUSE') {
      this.drawPlayer(ctx, engine);
    }

    // Ghosts (including Invisible / Spectral Wildcard Rendering!)
    for (const g of engine.ghosts) {
      if (engine.phase === 'GHOST_EATEN_PAUSE' && engine.eatenGhostFreezeId === g.id) continue;
      this.drawGhost(ctx, g, engine);
    }

    this.drawParticles(ctx, engine);
    this.drawPopups(ctx, engine);

    if (engine.phase === 'READY') {
      this.drawBanner(ctx, 'READY!', '#4ADE80', 'rgba(74, 222, 128, 0.7)');
    } else if (engine.phase === 'STAGE_CLEAR') {
      this.drawBanner(ctx, 'STAGE CLEAR!', '#FDE047', 'rgba(253, 224, 71, 0.75)');
    }

    if (visualStyle === 'crt') {
      this.drawCrtOverlay(ctx, width, height);
    }

    ctx.restore();
  }

  private ensureWallCache(dpr: number, flashWhite: boolean): void {
    const key = `plus-${dpr.toFixed(2)}-${flashWhite ? 1 : 0}`;
    if (this.wallCache && this.cachedKey === key) return;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(CANVAS_LOGICAL_WIDTH * dpr);
    canvas.height = Math.round(CANVAS_LOGICAL_HEIGHT * dpr);
    const wctx = canvas.getContext('2d');
    if (!wctx) return;

    wctx.scale(dpr, dpr);
    const grid = PLUS_MAZE.grid;
    const theme = PLUS_MAZE.theme;
    const outerColor = flashWhite ? '#FFFFFF' : theme.wallOuter;
    const innerColor = flashWhite ? '#E2E8F0' : theme.wallInner;
    const highlightColor = flashWhite ? '#FFFFFF' : theme.wallHighlight;
    const glowColor = flashWhite ? 'rgba(255,255,255,0.6)' : theme.wallGlow;

    const isWall = (c: number, r: number): boolean => {
      if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS) return false;
      return grid[r][c] === '#';
    };

    const drawWallShapes = (inset: number, cornerR: number) => {
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          if (!isWall(c, r)) continue;
          const x = c * T;
          const y = r * T;
          const n = isWall(c, r - 1);
          const s = isWall(c, r + 1);
          const w = isWall(c - 1, r);
          const e = isWall(c + 1, r);
          const left = w ? x : x + inset;
          const right = e ? x + T : x + T - inset;
          const top = n ? y : y + inset;
          const bottom = s ? y + T : y + T - inset;
          const tl = !n && !w ? cornerR : 0;
          const tr = !n && !e ? cornerR : 0;
          const br = !s && !e ? cornerR : 0;
          const bl = !s && !w ? cornerR : 0;
          wctx.beginPath();
          wctx.roundRect(left, top, right - left, bottom - top, [tl, tr, br, bl]);
          wctx.fill();
        }
      }
    };

    wctx.save();
    wctx.shadowColor = glowColor;
    wctx.shadowBlur = 14;
    wctx.fillStyle = outerColor;
    drawWallShapes(2.5, 6.5);
    wctx.restore();

    wctx.fillStyle = innerColor;
    drawWallShapes(5.5, 4.5);

    wctx.save();
    wctx.strokeStyle = highlightColor;
    wctx.globalAlpha = flashWhite ? 0.9 : 0.45;
    wctx.lineWidth = 1.2;
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (!isWall(c, r)) continue;
        if (!isWall(c, r - 1)) {
          wctx.beginPath();
          wctx.moveTo(c * T + (isWall(c - 1, r) ? 0 : 6), r * T + 4);
          wctx.lineTo((c + 1) * T - (isWall(c + 1, r) ? 0 : 6), r * T + 4);
          wctx.stroke();
        }
      }
    }
    wctx.restore();

    // Ghost house gate
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (grid[r][c] === '-') {
          wctx.save();
          wctx.shadowColor = theme.gateColor;
          wctx.shadowBlur = 10;
          wctx.fillStyle = theme.gateColor;
          wctx.fillRect(c * T, r * T + T * 0.38, T, T * 0.24);
          wctx.restore();
        }
      }
    }

    this.wallCache = canvas;
    this.cachedKey = key;
  }

  public drawPlusBonus(
    ctx: CanvasRenderingContext2D,
    type: PlusBonusType,
    cx: number,
    cy: number,
    scale = 1
  ): void {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    switch (type) {
      case 'soda': {
        // Iconic 1982 Pac-Man Plus Red Soda Can!
        ctx.fillStyle = '#DC2626';
        ctx.beginPath();
        ctx.roundRect(-6.2, -8.5, 12.4, 17, 2.5);
        ctx.fill();
        ctx.fillStyle = '#E2E8F0';
        ctx.fillRect(-5.5, -9.2, 11, 2.2);
        ctx.fillRect(-5.5, 7.6, 11, 1.8);
        // White dynamic ribbon wave
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-5.5, 1);
        ctx.bezierCurveTo(-2, -3.5, 2, 4.5, 5.5, 0);
        ctx.stroke();
        break;
      }
      case 'cocktail': {
        // Classic Martini / Cocktail Glass with green olive
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.moveTo(-8.5, -6.5);
        ctx.lineTo(8.5, -6.5);
        ctx.lineTo(0, 2);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(0, 2);
        ctx.lineTo(0, 8);
        ctx.moveTo(-5, 8);
        ctx.lineTo(5, 8);
        ctx.stroke();
        // Green olive on toothpick
        ctx.fillStyle = '#4ADE80';
        ctx.beginPath();
        ctx.arc(2.5, -4, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(3.3, -4, 0.9, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'peas': {
        // Green Pea Pod with 3 peas
        ctx.fillStyle = '#15803D';
        ctx.beginPath();
        ctx.ellipse(0, 0.5, 9.5, 4.8, -0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4ADE80';
        ctx.beginPath();
        ctx.arc(-4.5, 2.2, 2.5, 0, Math.PI * 2);
        ctx.arc(0, 0.4, 2.6, 0, Math.PI * 2);
        ctx.arc(4.5, -1.4, 2.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'apple': {
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(-2.6, 1.5, 6.2, 0, Math.PI * 2);
        ctx.arc(2.6, 1.5, 6.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.ellipse(-3.6, -1, 1.8, 3, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#92400E';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(0, -4);
        ctx.lineTo(1.5, -8.5);
        ctx.stroke();
        ctx.fillStyle = '#4ADE80';
        ctx.beginPath();
        ctx.ellipse(4.5, -6.5, 3.4, 1.7, -0.35, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'pancakes': {
        // Stack of golden pancakes with butter pat!
        for (const yOff of [4.5, 1, -2.5]) {
          ctx.fillStyle = '#D97706';
          ctx.beginPath();
          ctx.ellipse(0, yOff + 1.2, 9, 3.2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#FBBF24';
          ctx.beginPath();
          ctx.ellipse(0, yOff, 8.6, 2.8, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#FEF08A';
        ctx.fillRect(-2.5, -6, 5, 3);
        break;
      }
      case 'icecream': {
        // Swirled Pink Ice Cream Cone
        ctx.fillStyle = '#D97706';
        ctx.beginPath();
        ctx.moveTo(-5.5, 0.5);
        ctx.lineTo(5.5, 0.5);
        ctx.lineTo(0, 9.5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#F472B6';
        ctx.beginPath();
        ctx.arc(0, -1.5, 6.2, 0, Math.PI * 2);
        ctx.arc(0, -6, 4.0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFF1F2';
        ctx.beginPath();
        ctx.arc(-2, -3, 1.6, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'galaxian': {
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.moveTo(0, -8.5);
        ctx.lineTo(8.5, 4);
        ctx.lineTo(3, 6.5);
        ctx.lineTo(0, 1);
        ctx.lineTo(-3, 6.5);
        ctx.lineTo(-8.5, 4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(-3.5, -3, 7, 3.2);
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(-7.5, -1, 3, 5);
        ctx.fillRect(4.5, -1, 3, 5);
        break;
      }
      case 'key': {
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.arc(0, -5, 4.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#FDE047';
        ctx.fillRect(-1.4, -0.8, 2.8, 9.5);
        ctx.fillRect(1.2, 3.8, 3.8, 2);
        ctx.fillRect(1.2, 7.0, 3, 1.8);
        break;
      }
    }

    ctx.restore();
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, engine: PacManPlusEngine): void {
    const p = engine.player;
    const cx = p.x * T;
    const cy = p.y * T;
    const r = T * 0.58;

    ctx.save();
    ctx.translate(cx, cy);

    if (engine.phase === 'DYING') {
      const prog = p.deathProgress;
      const openAngle = Math.min(Math.PI, 0.25 + prog * Math.PI * 1.08);
      if (prog < 0.88) {
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = '#FFD829';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, r * (1 - prog * 0.16), openAngle, Math.PI * 2 - openAngle);
        ctx.closePath();
        ctx.fill();
      } else {
        const starP = (prog - 0.88) / 0.12;
        ctx.strokeStyle = '#FFF5A8';
        ctx.lineWidth = 2.2;
        for (let i = 0; i < 8; i++) {
          const a = (Math.PI * 2 * i) / 8;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * (4 + starP * 4), Math.sin(a) * (4 + starP * 4));
          ctx.lineTo(Math.cos(a) * (10 + starP * 9), Math.sin(a) * (10 + starP * 9));
          ctx.stroke();
        }
      }
      ctx.restore();
      return;
    }

    const mouthOpen = p.moving ? 0.08 + Math.abs(Math.sin(p.mouthPhase)) * 0.72 : 0.34;
    ctx.rotate(dirAngle(p.facing));
    ctx.shadowColor = 'rgba(255, 216, 41, 0.45)';
    ctx.shadowBlur = 11;

    const grad = ctx.createRadialGradient(-r * 0.25, -r * 0.28, 1.5, 0, 0, r);
    grad.addColorStop(0, '#FFF8B8');
    grad.addColorStop(0.58, '#FFD829');
    grad.addColorStop(1, '#E09200');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, mouthOpen, Math.PI * 2 - mouthOpen);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawGhost(ctx: CanvasRenderingContext2D, g: PlusGhostState, engine: PacManPlusEngine): void {
    const cx = g.x * T;
    const cy = g.y * T;
    const r = T * 0.56;

    const isFrightened = g.mode === 'FRIGHTENED';
    const isEyes = g.mode === 'EATEN' || g.mode === 'ENTERING_HOUSE';
    const flash =
      isFrightened &&
      engine.frightenedRemaining < 2.1 &&
      Math.floor(engine.elapsed * 10) % 2 === 0;

    // Spectral / Invisible Ghost wildcard rendering!
    const isCloaked = isFrightened && g.invisible && !isEyes;

    ctx.save();
    ctx.translate(cx, cy);

    if (isCloaked) {
      // Faint ghostly shimmer + glowing scared eyes so skilled players can hunt invisible ghosts!
      ctx.globalAlpha = flash ? 0.52 : 0.16;
      ctx.strokeStyle = engine.doubleGhostPtsActive ? '#4ADE80' : '#38BDF8';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, -r * 0.08, r, Math.PI, 0, false);
      ctx.lineTo(r, r * 0.92);
      ctx.lineTo(-r, r * 0.92);
      ctx.closePath();
      ctx.stroke();

      ctx.globalAlpha = flash ? 0.9 : 0.45;
      ctx.fillStyle = engine.doubleGhostPtsActive ? '#FDE047' : '#7DD3FC';
      ctx.beginPath();
      ctx.arc(-r * 0.34, -r * 0.14, 2.3, 0, Math.PI * 2);
      ctx.arc(r * 0.34, -r * 0.14, 2.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    if (!isEyes) {
      ctx.shadowColor = isFrightened ? 'rgba(59, 130, 246, 0.5)' : `${g.color}80`;
      ctx.shadowBlur = 11;

      const bodyGrad = ctx.createRadialGradient(-r * 0.3, -r * 0.35, 1, 0, 0, r * 1.2);
      if (isFrightened) {
        bodyGrad.addColorStop(0, flash ? '#FFFFFF' : '#60A5FA');
        bodyGrad.addColorStop(1, flash ? '#CBD5E1' : '#1D4ED8');
      } else {
        bodyGrad.addColorStop(0, g.accentColor);
        bodyGrad.addColorStop(0.55, g.color);
        bodyGrad.addColorStop(1, g.color);
      }
      ctx.fillStyle = bodyGrad;

      const bottomY = r * 0.96;
      ctx.beginPath();
      ctx.arc(0, -r * 0.08, r, Math.PI, 0, false);
      ctx.lineTo(r, bottomY);
      const wave = Math.sin(g.animPhase) * 2.1;
      const segW = (r * 2) / 3;
      for (let i = 0; i < 3; i++) {
        const sx = r - i * segW;
        const ex = sx - segW;
        const midX = (sx + ex) * 0.5;
        const peakY = bottomY - 4.2 + (i % 2 === 0 ? wave : -wave);
        ctx.quadraticCurveTo(midX, peakY, ex, bottomY);
      }
      ctx.closePath();
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    if (isFrightened && !isEyes) {
      const faceColor = flash ? '#EF4444' : '#FEF08A';
      ctx.fillStyle = faceColor;
      ctx.beginPath();
      ctx.arc(-r * 0.34, -r * 0.14, 2.2, 0, Math.PI * 2);
      ctx.arc(r * 0.34, -r * 0.14, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = faceColor;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-r * 0.55, r * 0.34);
      for (let i = 0; i < 5; i++) {
        ctx.lineTo(-r * 0.55 + (i + 1) * (r * 0.22), r * 0.34 + (i % 2 === 0 ? -2.2 : 2.2));
      }
      ctx.stroke();
    } else {
      const lookX = g.dir === 'LEFT' ? -2.1 : g.dir === 'RIGHT' ? 2.1 : 0;
      const lookY = g.dir === 'UP' ? -2.1 : g.dir === 'DOWN' ? 2.1 : 0;
      for (const side of [-1, 1]) {
        const ex = side * r * 0.36;
        const ey = -r * 0.16;
        ctx.fillStyle = '#F8FAFC';
        ctx.beginPath();
        ctx.ellipse(ex, ey, 3.6, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1E3A8A';
        ctx.beginPath();
        ctx.arc(ex + lookX, ey + lookY, 2.0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D, engine: PacManPlusEngine): void {
    for (const pt of engine.particles) {
      const alpha = Math.max(0, pt.life / pt.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x * T, pt.y * T, pt.radius * (0.4 + alpha * 0.6), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawPopups(ctx: CanvasRenderingContext2D, engine: PacManPlusEngine): void {
    for (const pop of engine.popups) {
      const alpha = Math.min(1, (pop.life / pop.maxLife) * 1.6);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '700 13px var(--font-mono), monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#020617';
      ctx.fillText(pop.text, pop.x * T + 1, pop.y * T + 1);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x * T, pop.y * T);
      ctx.restore();
    }
  }

  private drawBanner(ctx: CanvasRenderingContext2D, text: string, color: string, glow: string): void {
    ctx.save();
    ctx.font = '800 22px var(--font-outfit), sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = glow;
    ctx.shadowBlur = 16;
    ctx.fillStyle = color;
    ctx.fillText(text, CANVAS_LOGICAL_WIDTH * 0.5, 17.5 * T);
    ctx.restore();
  }

  private drawCrtOverlay(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    for (let y = 0; y < height; y += 3) {
      ctx.fillRect(0, y, width, 1);
    }
    const vig = ctx.createRadialGradient(
      width * 0.5,
      height * 0.5,
      width * 0.34,
      width * 0.5,
      height * 0.5,
      width * 0.78
    );
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}

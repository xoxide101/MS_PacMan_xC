import { ClassicBonusType, ClassicGhostState, ClassicPacManEngine } from './classicEngine';
import { isWallTile } from './mazes';
import { MsPacManRenderer } from './renderer';
import {
  CANVAS_LOGICAL_HEIGHT,
  CANVAS_LOGICAL_WIDTH,
  Direction,
  GRID_COLS,
  GRID_ROWS,
  LOGICAL_TILE_SIZE,
  MazeDefinition,
  VisualStyle,
} from './types';

const T = LOGICAL_TILE_SIZE;
const fruitHelper = new MsPacManRenderer();

export class ClassicPacManRenderer {
  private mazeCacheCanvas: HTMLCanvasElement | null = null;
  private cachedFlashWhite = false;
  private cachedDpr = 0;

  private ensureMazeCache(maze: MazeDefinition, flashWhite: boolean, dpr: number): HTMLCanvasElement {
    if (
      this.mazeCacheCanvas &&
      this.cachedFlashWhite === flashWhite &&
      this.cachedDpr === dpr
    ) {
      return this.mazeCacheCanvas;
    }

    if (!this.mazeCacheCanvas) {
      this.mazeCacheCanvas = document.createElement('canvas');
    }

    const canvas = this.mazeCacheCanvas;
    canvas.width = Math.round(CANVAS_LOGICAL_WIDTH * dpr);
    canvas.height = Math.round(CANVAS_LOGICAL_HEIGHT * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.bakeMaze(ctx, maze, flashWhite);
    this.cachedFlashWhite = flashWhite;
    this.cachedDpr = dpr;
    return canvas;
  }

  private bakeMaze(ctx: CanvasRenderingContext2D, maze: MazeDefinition, flashWhite: boolean): void {
    const { theme, grid } = maze;

    const bgGrad = ctx.createRadialGradient(
      CANVAS_LOGICAL_WIDTH * 0.5,
      CANVAS_LOGICAL_HEIGHT * 0.45,
      40,
      CANVAS_LOGICAL_WIDTH * 0.5,
      CANVAS_LOGICAL_HEIGHT * 0.5,
      CANVAS_LOGICAL_HEIGHT * 0.72
    );
    bgGrad.addColorStop(0, theme.floorTint);
    bgGrad.addColorStop(1, '#03050C');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CANVAS_LOGICAL_WIDTH, CANVAS_LOGICAL_HEIGHT);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.026)';
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (grid[r][c] !== '#') {
          ctx.fillRect(c * T + T * 0.5 - 0.75, r * T + T * 0.5 - 0.75, 1.5, 1.5);
        }
      }
    }

    const fillColor = flashWhite ? '#E2E8F0' : theme.wallInner;
    const outerStroke = flashWhite ? '#FFFFFF' : theme.wallOuter;
    const highlightColor = flashWhite ? '#FFFFFF' : theme.wallHighlight;
    const glowColor = flashWhite ? 'rgba(255,255,255,0.65)' : theme.wallGlow;

    const inset = 3.5;
    const cornerR = 9;

    ctx.fillStyle = fillColor;
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (grid[r][c] !== '#') continue;
        const n = isWallTile(grid, c, r - 1);
        const s = isWallTile(grid, c, r + 1);
        const w = isWallTile(grid, c - 1, r);
        const e = isWallTile(grid, c + 1, r);
        const x0 = c * T + (w ? 0 : inset);
        const y0 = r * T + (n ? 0 : inset);
        const x1 = (c + 1) * T - (e ? 0 : inset);
        const y1 = (r + 1) * T - (s ? 0 : inset);
        const rTL = !n && !w ? cornerR : 0;
        const rTR = !n && !e ? cornerR : 0;
        const rBR = !s && !e ? cornerR : 0;
        const rBL = !s && !w ? cornerR : 0;
        this.roundedRectPath(ctx, x0, y0, x1 - x0, y1 - y0, rTL, rTR, rBR, rBL);
        ctx.fill();
      }
    }

    const strokePerimeter = (strokeStyle: string, lineWidth: number, blur: number, shadow: string) => {
      ctx.save();
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (blur > 0) {
        ctx.shadowColor = shadow;
        ctx.shadowBlur = blur;
      }
      ctx.beginPath();
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          if (grid[r][c] !== '#') continue;
          const n = isWallTile(grid, c, r - 1);
          const s = isWallTile(grid, c, r + 1);
          const w = isWallTile(grid, c - 1, r);
          const e = isWallTile(grid, c + 1, r);
          const nw = isWallTile(grid, c - 1, r - 1);
          const ne = isWallTile(grid, c + 1, r - 1);
          const sw = isWallTile(grid, c - 1, r + 1);
          const se = isWallTile(grid, c + 1, r + 1);

          const xL = c * T + inset;
          const xR = (c + 1) * T - inset;
          const yT = r * T + inset;
          const yB = (r + 1) * T - inset;
          const xTileL = c * T;
          const xTileR = (c + 1) * T;
          const yTileT = r * T;
          const yTileB = (r + 1) * T;

          if (!n) {
            ctx.moveTo(!w ? xL + cornerR : xTileL, yT);
            ctx.lineTo(!e ? xR - cornerR : xTileR, yT);
          }
          if (!s) {
            ctx.moveTo(!w ? xL + cornerR : xTileL, yB);
            ctx.lineTo(!e ? xR - cornerR : xTileR, yB);
          }
          if (!w) {
            ctx.moveTo(xL, !n ? yT + cornerR : yTileT);
            ctx.lineTo(xL, !s ? yB - cornerR : yTileB);
          }
          if (!e) {
            ctx.moveTo(xR, !n ? yT + cornerR : yTileT);
            ctx.lineTo(xR, !s ? yB - cornerR : yTileB);
          }

          if (!n && !w) {
            ctx.moveTo(xL, yT + cornerR);
            ctx.quadraticCurveTo(xL, yT, xL + cornerR, yT);
          }
          if (!n && !e) {
            ctx.moveTo(xR - cornerR, yT);
            ctx.quadraticCurveTo(xR, yT, xR, yT + cornerR);
          }
          if (!s && !e) {
            ctx.moveTo(xR, yB - cornerR);
            ctx.quadraticCurveTo(xR, yB, xR - cornerR, yB);
          }
          if (!s && !w) {
            ctx.moveTo(xL + cornerR, yB);
            ctx.quadraticCurveTo(xL, yB, xL, yB - cornerR);
          }

          if (n && w && !nw) {
            ctx.moveTo(xTileL, yTileT + inset);
            ctx.quadraticCurveTo(xTileL + inset, yTileT + inset, xTileL + inset, yTileT);
          }
          if (n && e && !ne) {
            ctx.moveTo(xTileR - inset, yTileT);
            ctx.quadraticCurveTo(xTileR - inset, yTileT + inset, xTileR, yTileT + inset);
          }
          if (s && e && !se) {
            ctx.moveTo(xTileR, yTileB - inset);
            ctx.quadraticCurveTo(xTileR - inset, yTileB - inset, xTileR - inset, yTileB);
          }
          if (s && w && !sw) {
            ctx.moveTo(xTileL + inset, yTileB);
            ctx.quadraticCurveTo(xTileL + inset, yTileB - inset, xTileL, yTileB - inset);
          }
        }
      }
      ctx.stroke();
      ctx.restore();
    };

    strokePerimeter(outerStroke, 4.4, 15, glowColor);
    strokePerimeter(outerStroke, 3.0, 0, 'transparent');
    strokePerimeter(highlightColor, 1.15, 0, 'transparent');

    // Ghost house laser gate
    ctx.save();
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (grid[r][c] === '-') {
          const gx = c * T;
          const gy = r * T + T * 0.5;
          ctx.shadowColor = theme.gateColor;
          ctx.shadowBlur = 12;
          ctx.fillStyle = theme.gateColor;
          ctx.fillRect(gx, gy - 3, T, 6);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(gx, gy - 1.2, T, 2.4);
        }
      }
    }
    ctx.restore();
  }

  private roundedRectPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    rTL: number,
    rTR: number,
    rBR: number,
    rBL: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + rTL, y);
    ctx.lineTo(x + w - rTR, y);
    if (rTR) ctx.quadraticCurveTo(x + w, y, x + w, y + rTR);
    ctx.lineTo(x + w, y + h - rBR);
    if (rBR) ctx.quadraticCurveTo(x + w, y + h, x + w - rBR, y + h);
    ctx.lineTo(x + rBL, y + h);
    if (rBL) ctx.quadraticCurveTo(x, y + h, x, y + h - rBL);
    ctx.lineTo(x, y + rTL);
    if (rTL) ctx.quadraticCurveTo(x, y, x + rTL, y);
    ctx.closePath();
  }

  public render(
    ctx: CanvasRenderingContext2D,
    engine: ClassicPacManEngine,
    dpr: number,
    visualStyle: VisualStyle
  ): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const flashWhite =
      engine.phase === 'STAGE_CLEAR' && Math.floor(engine.stageClearFlashPhase) % 2 === 1;
    const mazeLayer = this.ensureMazeCache(engine.maze, flashWhite, dpr);
    ctx.drawImage(mazeLayer, 0, 0, CANVAS_LOGICAL_WIDTH, CANVAS_LOGICAL_HEIGHT);

    // Ambient floor glow
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (engine.phase !== 'DYING') {
      const px = engine.player.x * T;
      const py = engine.player.y * T;
      const g = ctx.createRadialGradient(px, py, 2, px, py, T * 2.3);
      g.addColorStop(0, 'rgba(255, 220, 56, 0.14)');
      g.addColorStop(1, 'rgba(255, 220, 56, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, T * 2.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Pellets & Power Pellets
    const pulse = 0.5 + 0.5 * Math.sin(engine.elapsedTime * 7.2);
    ctx.save();
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const tile = engine.grid[r][c];
        if (tile === '.') {
          const cx = (c + 0.5) * T;
          const cy = (r + 0.5) * T;
          ctx.fillStyle = engine.maze.theme.pelletGlow;
          ctx.beginPath();
          ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = engine.maze.theme.pelletColor;
          ctx.beginPath();
          ctx.arc(cx, cy, 3.0, 0, Math.PI * 2);
          ctx.fill();
        } else if (tile === 'o') {
          const cx = (c + 0.5) * T;
          const cy = (r + 0.5) * T;
          const haloR = 14.5 + pulse * 5.2;
          const grad = ctx.createRadialGradient(cx, cy, 1, cx, cy, haloR);
          grad.addColorStop(0, 'rgba(255, 250, 224, 0.95)');
          grad.addColorStop(0.45, 'rgba(255, 212, 112, 0.45)');
          grad.addColorStop(1, 'rgba(255, 212, 112, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#FFFDF0';
          ctx.beginPath();
          ctx.arc(cx, cy, 7.5 + pulse * 1.7, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();

    // Classic Stationary Bonus Item
    if (engine.bonus.active) {
      const bx = engine.bonus.x * T;
      const by = engine.bonus.y * T;
      const bob = Math.sin(engine.elapsedTime * 5) * 2.5;
      this.drawBonusItem(ctx, engine.bonus.type, bx, by + bob, 1.05);
    }

    // Classic Pac-Man Hero
    if (engine.phase !== 'GHOST_EATEN_PAUSE') {
      this.renderClassicPacMan(ctx, engine);
    }

    // Ghosts
    if (engine.phase !== 'DYING' && engine.phase !== 'STAGE_CLEAR') {
      for (const ghost of engine.ghosts) {
        if (engine.phase === 'GHOST_EATEN_PAUSE' && ghost.id === engine.eatenGhostId) continue;
        this.renderGhost(ctx, ghost, engine.frightenedTimer, engine.elapsedTime);
      }
    }

    // Particles & Popups
    this.renderParticles(ctx, engine);
    this.renderPopups(ctx, engine);

    // READY / STAGE CLEAR banners
    if (engine.phase === 'READY' || engine.phase === 'STAGE_CLEAR') {
      const text = engine.phase === 'READY' ? 'READY!' : `STAGE ${engine.level} CLEAR!`;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '800 28px var(--font-outfit), sans-serif';
      ctx.lineWidth = 7;
      ctx.strokeStyle = '#060811';
      ctx.strokeText(text, 14 * T, 17.5 * T);
      ctx.fillStyle = engine.phase === 'READY' ? '#FFE45E' : '#60A5FA';
      ctx.fillText(text, 14 * T, 17.5 * T);
      ctx.restore();
    }

    if (visualStyle === 'crt') {
      this.renderCrtOverlay(ctx);
    }
  }

  private renderClassicPacMan(ctx: CanvasRenderingContext2D, engine: ClassicPacManEngine): void {
    const p = engine.player;
    const cx = p.x * T;
    const cy = p.y * T;
    const radius = T * 0.62;

    // Motion trail
    if (engine.phase === 'PLAYING') {
      ctx.save();
      for (let i = 0; i < p.trail.length; i++) {
        const pt = p.trail[i];
        ctx.fillStyle = `rgba(255, 224, 56, ${pt.alpha * 0.25})`;
        ctx.beginPath();
        ctx.arc(pt.x * T, pt.y * T, 8 + i * 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.translate(cx, cy);

    if (engine.phase === 'DYING') {
      // Authentic 1980 Pac-Man upward-unfolding vanish animation!
      const prog = p.deathProgress;
      ctx.rotate(-Math.PI / 2);
      const openAngle = 0.2 + prog * (Math.PI - 0.12);
      if (prog < 0.88) {
        const grad = ctx.createRadialGradient(-3, -3, 2, 0, 0, radius);
        grad.addColorStop(0, '#FFF8B0');
        grad.addColorStop(0.55, '#FFDC26');
        grad.addColorStop(1, '#E09200');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, openAngle, Math.PI * 2 - openAngle);
        ctx.closePath();
        ctx.fill();
      } else {
        // Final star pop burst
        const burst = (prog - 0.88) / 0.12;
        ctx.strokeStyle = `rgba(255, 232, 92, ${1 - burst})`;
        ctx.lineWidth = 2.5;
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * (4 + burst * 8), Math.sin(a) * (4 + burst * 8));
          ctx.lineTo(Math.cos(a) * (10 + burst * 14), Math.sin(a) * (10 + burst * 14));
          ctx.stroke();
        }
      }
      ctx.restore();
      return;
    }

    const dir = p.dir === 'NONE' ? 'LEFT' : p.dir;
    let rot = 0;
    if (dir === 'RIGHT') rot = 0;
    else if (dir === 'LEFT') rot = Math.PI;
    else if (dir === 'UP') rot = -Math.PI / 2;
    else if (dir === 'DOWN') rot = Math.PI / 2;

    ctx.rotate(rot);

    const chomp =
      engine.phase === 'READY' || engine.phase === 'STAGE_CLEAR'
        ? 0.24
        : 0.05 + (0.5 + 0.5 * Math.sin(p.mouthPhase)) * 0.6;

    const grad = ctx.createRadialGradient(-radius * 0.26, -radius * 0.3, 2, 0, 0, radius * 1.05);
    grad.addColorStop(0, '#FFF9B8');
    grad.addColorStop(0.45, '#FFDD24');
    grad.addColorStop(0.88, '#F5A600');
    grad.addColorStop(1, '#C97A00');

    ctx.shadowColor = 'rgba(255, 218, 48, 0.45)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, chomp, Math.PI * 2 - chomp);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // Gloss specular highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
    ctx.beginPath();
    ctx.ellipse(-radius * 0.2, -radius * 0.46, radius * 0.34, radius * 0.14, -0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private renderGhost(
    ctx: CanvasRenderingContext2D,
    ghost: ClassicGhostState,
    frightenedTimer: number,
    elapsedTime: number
  ): void {
    const cx = ghost.x * T;
    const cy = ghost.y * T;
    const r = T * 0.58;
    const isFrightened = ghost.mode === 'FRIGHTENED';
    const isEaten = ghost.mode === 'EATEN';
    const isFlashing =
      isFrightened && frightenedTimer < 2.3 && Math.floor(elapsedTime * 11) % 2 === 0;

    ctx.save();
    ctx.translate(cx, cy);

    if (!isEaten) {
      const topCol = isFrightened ? (isFlashing ? '#FFFFFF' : '#4F7CFF') : ghost.accentColor;
      const midCol = isFrightened ? (isFlashing ? '#F1F5F9' : '#2539D8') : ghost.color;
      const botCol = isFrightened ? (isFlashing ? '#CBD5E1' : '#141D8C') : ghost.color;
      const glowCol = isFrightened ? (isFlashing ? '#FFFFFF' : '#3B82F6') : ghost.color;

      const grad = ctx.createLinearGradient(0, -r, 0, r * 1.15);
      grad.addColorStop(0, topCol);
      grad.addColorStop(0.45, midCol);
      grad.addColorStop(1, botCol);

      ctx.shadowColor = `${glowCol}66`;
      ctx.shadowBlur = 12;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, -r * 0.14, r, Math.PI, 0, false);
      const skirtBaseY = r * 0.92;
      ctx.lineTo(r, skirtBaseY);
      const waves = 3;
      const stepW = (r * 2) / (waves * 2);
      const phaseShift = Math.sin(ghost.animPhase) * 2.6;
      for (let i = 0; i < waves * 2; i++) {
        const xEnd = r - (i + 1) * stepW;
        const xCtrl = r - (i + 0.5) * stepW;
        const off = (i % 2 === 0 ? 1 : -1) * (3.2 + (i % 2 === 0 ? phaseShift * 0.35 : -phaseShift * 0.35));
        ctx.quadraticCurveTo(xCtrl, skirtBaseY + off, xEnd, skirtBaseY);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.beginPath();
      ctx.ellipse(-r * 0.32, -r * 0.48, r * 0.26, r * 0.14, -0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (isFrightened) {
      const faceCol = isFlashing ? '#DC2626' : '#FFE4CC';
      ctx.fillStyle = faceCol;
      ctx.beginPath();
      ctx.arc(-r * 0.34, -r * 0.16, 2.7, 0, Math.PI * 2);
      ctx.arc(r * 0.34, -r * 0.16, 2.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = faceCol;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      const my = r * 0.26;
      const startX = -r * 0.56;
      const seg = (r * 1.12) / 6;
      ctx.moveTo(startX, my);
      for (let i = 1; i <= 6; i++) {
        ctx.lineTo(startX + i * seg, my + (i % 2 === 0 ? 2.4 : -2.4));
      }
      ctx.stroke();
    } else {
      const look = this.getEyeOffset(ghost.dir);
      for (const side of [-1, 1]) {
        const ex = side * r * 0.38 + look.x * 0.45;
        const ey = -r * 0.18 + look.y * 0.45;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.ellipse(ex, ey, 4.9, 6.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0B1D51';
        ctx.beginPath();
        ctx.arc(ex + look.x * 1.45, ey + look.y * 1.75, 2.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  private getEyeOffset(dir: Direction): { x: number; y: number } {
    switch (dir) {
      case 'LEFT': return { x: -1.6, y: 0 };
      case 'RIGHT': return { x: 1.6, y: 0 };
      case 'UP': return { x: 0, y: -1.6 };
      case 'DOWN': return { x: 0, y: 1.6 };
      default: return { x: 0, y: 0 };
    }
  }

  public drawBonusItem(
    ctx: CanvasRenderingContext2D,
    type: ClassicBonusType,
    cx: number,
    cy: number,
    scale = 1
  ): void {
    if (type === 'cherry' || type === 'strawberry' || type === 'orange' || type === 'apple') {
      fruitHelper.drawFruit(ctx, type, cx, cy, scale);
      return;
    }
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    if (type === 'melon') {
      const g = ctx.createRadialGradient(-3, -3, 2, 0, 1, 11);
      g.addColorStop(0, '#86EFAC');
      g.addColorStop(0.55, '#22C55E');
      g.addColorStop(1, '#14532D');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 1, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#DCFCE7';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 1, 10, -0.6, 0.6);
      ctx.stroke();
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(-1.5, -12, 3, 4);
    } else if (type === 'galaxian') {
      // Classic Namco Galaxian Flagship!
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(10, 3);
      ctx.lineTo(4, 3);
      ctx.lineTo(0, 10);
      ctx.lineTo(-4, 3);
      ctx.lineTo(-10, 3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(4, -3);
      ctx.lineTo(-4, -3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#3B82F6';
      ctx.fillRect(-7, -1, 14, 3.5);
    } else if (type === 'bell') {
      const g = ctx.createLinearGradient(-8, -10, 8, 8);
      g.addColorStop(0, '#FEF08A');
      g.addColorStop(0.5, '#FACC15');
      g.addColorStop(1, '#CA8A04');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.bezierCurveTo(9, -10, 10, 2, 11, 7);
      ctx.lineTo(-11, 7);
      ctx.bezierCurveTo(-10, 2, -9, -10, 0, -10);
      ctx.fill();
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(-8, 7, 16, 3);
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(0, 10.5, 2.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'key') {
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(0, -6.5, 5.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#060811';
      ctx.beginPath();
      ctx.arc(0, -6.5, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(-2, -1, 4, 12);
      ctx.fillRect(2, 4, 4.5, 2.5);
      ctx.fillRect(2, 8.5, 4.5, 2.5);
    }
    ctx.restore();
  }

  private renderParticles(ctx: CanvasRenderingContext2D, engine: ClassicPacManEngine): void {
    ctx.save();
    for (const p of engine.particles) {
      ctx.globalAlpha = p.alpha;
      if (p.ring) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3.2 * p.alpha;
        ctx.beginPath();
        ctx.arc(p.x * T, p.y * T, p.radius * T, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x * T, p.y * T, p.radius * T, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private renderPopups(ctx: CanvasRenderingContext2D, engine: ClassicPacManEngine): void {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const pop of engine.popups) {
      ctx.globalAlpha = Math.min(1, (pop.life / pop.maxLife) * 1.6);
      ctx.font = `700 ${Math.round(20 * pop.scale)}px var(--font-jetbrains), monospace`;
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(4, 6, 15, 0.92)';
      ctx.strokeText(pop.text, pop.x * T, pop.y * T);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x * T, pop.y * T);
    }
    ctx.restore();
  }

  private renderCrtOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
    for (let y = 0; y < CANVAS_LOGICAL_HEIGHT; y += 4) {
      ctx.fillRect(0, y, CANVAS_LOGICAL_WIDTH, 1.5);
    }
    ctx.restore();
  }
}

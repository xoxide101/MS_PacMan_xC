import { JrPacManEngine } from './jrEngine';
import { isJrWallTile } from './jrMazes';
import {
  Direction,
  JR_GRID_COLS,
  JR_GRID_ROWS,
  JR_TILE_SIZE,
  JR_VIEWPORT_COLS,
  JR_VIEWPORT_HEIGHT,
  JR_VIEWPORT_WIDTH,
  JR_WORLD_HEIGHT,
  JR_WORLD_WIDTH,
  JrGhostState,
  JrMazeDefinition,
  JrPrizeType,
  VisualStyle,
} from './jrTypes';

const T = JR_TILE_SIZE; // 32 logical px per tile

export class JrPacManRenderer {
  private mazeCacheCanvas: HTMLCanvasElement | null = null;
  private cachedMazeId = -1;
  private cachedFlashWhite = false;
  private cachedDpr = 0;

  private ensureMazeCache(
    maze: JrMazeDefinition,
    flashWhite: boolean,
    dpr: number
  ): HTMLCanvasElement {
    // Cap offscreen world cache DPR at 2x (3584x1984 px) for silky 60fps VRAM efficiency
    const cacheDpr = Math.min(dpr, 2);
    if (
      this.mazeCacheCanvas &&
      this.cachedMazeId === maze.id &&
      this.cachedFlashWhite === flashWhite &&
      this.cachedDpr === cacheDpr
    ) {
      return this.mazeCacheCanvas;
    }

    if (!this.mazeCacheCanvas) {
      this.mazeCacheCanvas = document.createElement('canvas');
    }

    const canvas = this.mazeCacheCanvas;
    canvas.width = Math.round(JR_WORLD_WIDTH * cacheDpr);
    canvas.height = Math.round(JR_WORLD_HEIGHT * cacheDpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    ctx.setTransform(cacheDpr, 0, 0, cacheDpr, 0, 0);
    this.bakeStaticWideMaze(ctx, maze, flashWhite);

    this.cachedMazeId = maze.id;
    this.cachedFlashWhite = flashWhite;
    this.cachedDpr = cacheDpr;
    return canvas;
  }

  private bakeStaticWideMaze(
    ctx: CanvasRenderingContext2D,
    maze: JrMazeDefinition,
    flashWhite: boolean
  ): void {
    const { theme, grid } = maze;

    // 1. Deep architectural arena floor across full 56-column expanse
    const bgGrad = ctx.createLinearGradient(0, 0, 0, JR_WORLD_HEIGHT);
    bgGrad.addColorStop(0, '#04060D');
    bgGrad.addColorStop(0.5, theme.floorTint);
    bgGrad.addColorStop(1, '#04060D');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, JR_WORLD_WIDTH, JR_WORLD_HEIGHT);

    // Subtle spatial tile register dots so horizontal scrolling feels super crisp
    ctx.fillStyle = 'rgba(255, 255, 255, 0.028)';
    for (let r = 0; r < JR_GRID_ROWS; r++) {
      for (let c = 0; c < JR_GRID_COLS; c++) {
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

    // 2. Sculpted wall bodies
    ctx.fillStyle = fillColor;
    for (let r = 0; r < JR_GRID_ROWS; r++) {
      for (let c = 0; c < JR_GRID_COLS; c++) {
        if (grid[r][c] !== '#') continue;

        const n = isJrWallTile(grid, c, r - 1);
        const s = isJrWallTile(grid, c, r + 1);
        const w = isJrWallTile(grid, c - 1, r);
        const e = isJrWallTile(grid, c + 1, r);

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

    // 3. Layered glowing neon wall borders + razor specular highlight
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
      for (let r = 0; r < JR_GRID_ROWS; r++) {
        for (let c = 0; c < JR_GRID_COLS; c++) {
          if (grid[r][c] !== '#') continue;

          const n = isJrWallTile(grid, c, r - 1);
          const s = isJrWallTile(grid, c, r + 1);
          const w = isJrWallTile(grid, c - 1, r);
          const e = isJrWallTile(grid, c + 1, r);
          const nw = isJrWallTile(grid, c - 1, r - 1);
          const ne = isJrWallTile(grid, c + 1, r - 1);
          const sw = isJrWallTile(grid, c - 1, r + 1);
          const se = isJrWallTile(grid, c + 1, r + 1);

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

    strokePerimeter(outerStroke, 4.4, 14, glowColor);
    strokePerimeter(outerStroke, 3.0, 0, 'transparent');
    strokePerimeter(highlightColor, 1.15, 0, 'transparent');

    // 4. Central Ghost House Laser Gate
    ctx.save();
    for (let r = 0; r < JR_GRID_ROWS; r++) {
      for (let c = 0; c < JR_GRID_COLS; c++) {
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
    engine: JrPacManEngine,
    dpr: number,
    visualStyle: VisualStyle
  ): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const flashWhite =
      engine.phase === 'STAGE_CLEAR' && Math.floor(engine.stageClearFlashPhase) % 2 === 1;
    const mazeLayer = this.ensureMazeCache(engine.maze, flashWhite, dpr);

    // Optional subtle screen shake when a roaming toy detonates a Power Energizer!
    let shakeX = 0;
    let shakeY = 0;
    if (engine.screenShakeTimer > 0) {
      const mag = (engine.screenShakeTimer / 0.36) * 8;
      shakeX = (Math.random() - 0.5) * mag;
      shakeY = (Math.random() - 0.5) * mag;
    }

    const camPx = engine.cameraX * T;
    const cacheScale = mazeLayer.width / JR_WORLD_WIDTH;

    // 1. Blit exact scrolled viewport slice from pre-baked 56-column HiDPI maze
    ctx.fillStyle = '#04060D';
    ctx.fillRect(0, 0, JR_VIEWPORT_WIDTH, JR_VIEWPORT_HEIGHT);

    ctx.save();
    ctx.translate(shakeX, shakeY);
    ctx.drawImage(
      mazeLayer,
      camPx * cacheScale,
      0,
      JR_VIEWPORT_WIDTH * cacheScale,
      JR_VIEWPORT_HEIGHT * cacheScale,
      0,
      0,
      JR_VIEWPORT_WIDTH,
      JR_VIEWPORT_HEIGHT
    );

    // Transform into world coordinates for all scrolling entities
    ctx.save();
    ctx.translate(-camPx, 0);

    const minCol = Math.max(0, Math.floor(engine.cameraX) - 1);
    const maxCol = Math.min(JR_GRID_COLS - 1, Math.ceil(engine.cameraX + JR_VIEWPORT_COLS) + 1);

    // 2. Dynamic floor light pools
    this.renderAmbientLights(ctx, engine);

    // 3. Pellets, Mutated 50-pt Super Dots, and 6 Power Energizers (viewport-culled!)
    this.renderPellets(ctx, engine, minCol, maxCol);

    // 4. Roaming Bouncing Toy Prize
    if (engine.prize.active) {
      const fx = engine.prize.x * T;
      const fy = engine.prize.y * T;
      const bounce = engine.prize.exitingHouse
        ? 0
        : Math.abs(Math.sin(engine.prize.bouncePhase)) * 7.5;

      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(fx, fy + 10, Math.max(5, 10 - bounce * 0.4), 3.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      this.drawPrize(ctx, engine.prize.type, fx, fy - bounce, 1.0);
    }

    // 5. Jr. Pac-Man motion trail + Propeller Beanie Hero
    if (engine.phase !== 'STAGE_CLEAR') {
      this.renderPlayerTrail(ctx, engine);
      if (engine.phase !== 'GHOST_EATEN_PAUSE') {
        this.renderJrPacMan(ctx, engine);
      }
    } else {
      this.renderJrPacMan(ctx, engine);
    }

    // 6. Ghosts (Blinky, Pinky, Inky, Tim)
    if (engine.phase !== 'DYING' && engine.phase !== 'STAGE_CLEAR') {
      for (const ghost of engine.ghosts) {
        if (engine.phase === 'GHOST_EATEN_PAUSE' && ghost.id === engine.eatenGhostId) {
          continue;
        }
        this.renderGhost(ctx, ghost, engine.frightenedTimer, engine.elapsedTime);
      }
    }

    // 7. Particles & Floating Popups
    this.renderParticles(ctx, engine);
    this.renderPopups(ctx, engine);

    ctx.restore(); // exit world camera transform

    // 8. Subtle edge scroll indicators showing remaining arena off-screen left/right
    this.renderScrollEdgeIndicators(ctx, engine);

    // 9. In-canvas Centered Banners ("READY!", "STAGE CLEAR!")
    this.renderInCanvasBanner(ctx, engine);

    ctx.restore(); // exit shake

    // 10. Optional PVM CRT Glow
    if (visualStyle === 'crt') {
      this.renderCrtOverlay(ctx);
    }
  }

  public renderMinimap(
    ctx: CanvasRenderingContext2D,
    engine: JrPacManEngine,
    width: number,
    height: number,
    dpr: number
  ): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#050711';
    ctx.fillRect(0, 0, width, height);

    const cellW = width / JR_GRID_COLS;
    const cellH = height / JR_GRID_ROWS;

    // 1. Maze walls & dots
    for (let r = 0; r < JR_GRID_ROWS; r++) {
      for (let c = 0; c < JR_GRID_COLS; c++) {
        const t = engine.grid[r][c];
        if (t === '#') {
          ctx.fillStyle = `${engine.maze.theme.wallOuter}44`;
          ctx.fillRect(c * cellW, r * cellH, Math.ceil(cellW), Math.ceil(cellH));
        } else if (t === '.') {
          ctx.fillStyle = 'rgba(255, 240, 200, 0.35)';
          ctx.fillRect(c * cellW + cellW * 0.35, r * cellH + cellH * 0.35, Math.max(1.2, cellW * 0.3), Math.max(1.2, cellH * 0.3));
        } else if (t === 'M') {
          ctx.fillStyle = '#FBBF24';
          ctx.fillRect(c * cellW + cellW * 0.15, r * cellH + cellH * 0.15, Math.max(2.2, cellW * 0.7), Math.max(2.2, cellH * 0.7));
        } else if (t === 'o') {
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc((c + 0.5) * cellW, (r + 0.5) * cellH, Math.max(2.5, cellW * 0.55), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 2. Roaming Toy marker
    if (engine.prize.active) {
      const pulse = 0.7 + 0.3 * Math.sin(engine.elapsedTime * 12);
      ctx.fillStyle = `rgba(244, 114, 182, ${pulse})`;
      ctx.beginPath();
      ctx.arc(engine.prize.x * cellW, engine.prize.y * cellH, 3.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Ghosts on minimap
    for (const g of engine.ghosts) {
      ctx.fillStyle = g.mode === 'FRIGHTENED' ? '#60A5FA' : g.mode === 'EATEN' ? '#CBD5E1' : g.color;
      ctx.beginPath();
      ctx.arc(g.x * cellW, g.y * cellH, 2.7, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Jr. Pac-Man golden beacon
    ctx.fillStyle = '#FFE44D';
    ctx.beginPath();
    ctx.arc(engine.player.x * cellW, engine.player.y * cellH, 3.4, 0, Math.PI * 2);
    ctx.fill();

    // 5. Crisp live camera viewport bracket
    const vx = engine.cameraX * cellW;
    const vw = JR_VIEWPORT_COLS * cellW;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vx + 0.75, 0.75, vw - 1.5, height - 1.5);
  }

  private renderScrollEdgeIndicators(ctx: CanvasRenderingContext2D, engine: JrPacManEngine): void {
    const maxCam = JR_GRID_COLS - JR_VIEWPORT_COLS;
    ctx.save();
    if (engine.cameraX > 0.4) {
      const leftAlpha = Math.min(0.45, engine.cameraX / 6);
      const grad = ctx.createLinearGradient(0, 0, 26, 0);
      grad.addColorStop(0, `rgba(4, 6, 15, ${leftAlpha})`);
      grad.addColorStop(1, 'rgba(4, 6, 15, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 26, JR_VIEWPORT_HEIGHT);
    }
    if (engine.cameraX < maxCam - 0.4) {
      const rightAlpha = Math.min(0.45, (maxCam - engine.cameraX) / 6);
      const grad = ctx.createLinearGradient(JR_VIEWPORT_WIDTH - 26, 0, JR_VIEWPORT_WIDTH, 0);
      grad.addColorStop(0, 'rgba(4, 6, 15, 0)');
      grad.addColorStop(1, `rgba(4, 6, 15, ${rightAlpha})`);
      ctx.fillStyle = grad;
      ctx.fillRect(JR_VIEWPORT_WIDTH - 26, 0, 26, JR_VIEWPORT_HEIGHT);
    }
    ctx.restore();
  }

  private renderAmbientLights(ctx: CanvasRenderingContext2D, engine: JrPacManEngine): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    if (engine.phase !== 'DYING') {
      const px = engine.player.x * T;
      const py = engine.player.y * T;
      const pGrad = ctx.createRadialGradient(px, py, 2, px, py, T * 2.4);
      pGrad.addColorStop(0, 'rgba(255, 218, 72, 0.15)');
      pGrad.addColorStop(1, 'rgba(255, 218, 72, 0)');
      ctx.fillStyle = pGrad;
      ctx.beginPath();
      ctx.arc(px, py, T * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    if (engine.phase !== 'DYING' && engine.phase !== 'STAGE_CLEAR') {
      for (const ghost of engine.ghosts) {
        if (ghost.mode === 'EATEN') continue;
        const gx = ghost.x * T;
        const gy = ghost.y * T;
        const glowHex = ghost.mode === 'FRIGHTENED' ? '#3B82F6' : ghost.color;
        const gGrad = ctx.createRadialGradient(gx, gy, 2, gx, gy, T * 1.9);
        gGrad.addColorStop(0, `${glowHex}22`);
        gGrad.addColorStop(1, `${glowHex}00`);
        ctx.fillStyle = gGrad;
        ctx.beginPath();
        ctx.arc(gx, gy, T * 1.9, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  private renderPellets(
    ctx: CanvasRenderingContext2D,
    engine: JrPacManEngine,
    minCol: number,
    maxCol: number
  ): void {
    const { grid, maze, elapsedTime } = engine;
    const pulse = 0.5 + 0.5 * Math.sin(elapsedTime * 7.5);

    ctx.save();
    for (let r = 0; r < JR_GRID_ROWS; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const tile = grid[r][c];
        if (tile === '.') {
          const cx = (c + 0.5) * T;
          const cy = (r + 0.5) * T;
          ctx.fillStyle = maze.theme.pelletGlow;
          ctx.beginPath();
          ctx.arc(cx, cy, 4.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = maze.theme.pelletColor;
          ctx.beginPath();
          ctx.arc(cx, cy, 2.9, 0, Math.PI * 2);
          ctx.fill();
        } else if (tile === 'M') {
          // Mutated 50-pt Large Super Dot!
          const cx = (c + 0.5) * T;
          const cy = (r + 0.5) * T;
          const rCore = 5.6 + pulse * 0.7;
          const grad = ctx.createRadialGradient(cx, cy, 1, cx, cy, 11.5);
          grad.addColorStop(0, 'rgba(254, 240, 138, 0.95)');
          grad.addColorStop(0.5, 'rgba(251, 191, 36, 0.5)');
          grad.addColorStop(1, 'rgba(251, 191, 36, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(cx, cy, 11.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#FCD34D';
          ctx.beginPath();
          ctx.arc(cx, cy, rCore, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#FFFBEB';
          ctx.beginPath();
          ctx.arc(cx - 1.7, cy - 1.7, 1.8, 0, Math.PI * 2);
          ctx.fill();
        } else if (tile === 'o') {
          const cx = (c + 0.5) * T;
          const cy = (r + 0.5) * T;
          const coreR = 7.8 + pulse * 1.9;
          const haloR = 15 + pulse * 5.5;

          const grad = ctx.createRadialGradient(cx, cy, 1, cx, cy, haloR);
          grad.addColorStop(0, 'rgba(255, 252, 232, 0.96)');
          grad.addColorStop(0.45, 'rgba(255, 210, 110, 0.48)');
          grad.addColorStop(1, 'rgba(255, 210, 110, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#FFFDF2';
          ctx.beginPath();
          ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(cx - 2.3, cy - 2.3, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  private renderPlayerTrail(ctx: CanvasRenderingContext2D, engine: JrPacManEngine): void {
    const { trail } = engine.player;
    if (trail.length === 0) return;
    ctx.save();
    for (let i = 0; i < trail.length; i++) {
      const pt = trail[i];
      ctx.fillStyle = `rgba(255, 214, 58, ${pt.alpha * 0.28})`;
      ctx.beginPath();
      ctx.arc(pt.x * T, pt.y * T, 8 + i * 1.05, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderJrPacMan(ctx: CanvasRenderingContext2D, engine: JrPacManEngine): void {
    const p = engine.player;
    const cx = p.x * T;
    const cy = p.y * T;
    const radius = T * 0.6;

    ctx.save();
    ctx.translate(cx, cy);

    if (engine.phase === 'DYING') {
      const prog = p.deathProgress;
      const spinAngle = prog * Math.PI * 5.5;
      const scale = Math.max(0.01, 1 - prog * 0.85);
      const mouthOpen = 0.22 + prog * (Math.PI - 0.25);

      ctx.rotate(spinAngle);
      ctx.scale(scale, scale);

      const grad = ctx.createRadialGradient(-4, -5, 2, 0, 0, radius);
      grad.addColorStop(0, '#FFF59D');
      grad.addColorStop(0.55, '#FFD426');
      grad.addColorStop(1, '#E09200');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, mouthOpen, Math.PI * 2 - mouthOpen);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      return;
    }

    const dir = p.dir === 'NONE' ? 'LEFT' : p.dir;
    let rot = 0;
    let flipY = false;

    if (dir === 'RIGHT') {
      rot = 0;
    } else if (dir === 'LEFT') {
      rot = Math.PI;
      flipY = true;
    } else if (dir === 'UP') {
      rot = -Math.PI / 2;
    } else if (dir === 'DOWN') {
      rot = Math.PI / 2;
      flipY = true;
    }

    ctx.rotate(rot);
    if (flipY) ctx.scale(1, -1);

    const chomp =
      engine.phase === 'READY' || engine.phase === 'STAGE_CLEAR'
        ? 0.26
        : 0.06 + (0.5 + 0.5 * Math.sin(p.mouthPhase)) * 0.58;

    // 1. Glossy golden body
    const bodyGrad = ctx.createRadialGradient(-radius * 0.25, -radius * 0.34, 2, 0, 0, radius * 1.05);
    bodyGrad.addColorStop(0, '#FFF7AD');
    bodyGrad.addColorStop(0.48, '#FFD829');
    bodyGrad.addColorStop(0.88, '#F5A600');
    bodyGrad.addColorStop(1, '#CC7A00');

    ctx.shadowColor = 'rgba(255, 214, 52, 0.45)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, chomp, Math.PI * 2 - chomp);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // Bright playful eye
    const eyeX = radius * 0.2;
    const eyeY = -radius * 0.34;
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.ellipse(eyeX, eyeY, 2.3, 3.0, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(eyeX + 0.7, eyeY - 1.0, 0.95, 0, Math.PI * 2);
    ctx.fill();

    // 2. Signature Jr. Pac-Man Striped Propeller Beanie Cap!
    ctx.save();
    ctx.translate(-radius * 0.26, -radius * 0.82);
    ctx.rotate(-0.24);

    // Beanie dome (Cobalt blue base)
    ctx.fillStyle = '#2563EB';
    ctx.beginPath();
    ctx.arc(0, 2.5, radius * 0.54, Math.PI, 0, false);
    ctx.closePath();
    ctx.fill();

    // Crimson red center beanie panel
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.ellipse(0, 2.5, radius * 0.22, radius * 0.52, 0, Math.PI, 0, false);
    ctx.closePath();
    ctx.fill();

    // Crisp beanie rim band
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(-radius * 0.55, 1.4, radius * 1.1, 2.4);

    // Metallic propeller stem
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(0, -radius * 0.44);
    ctx.lineTo(0, -radius * 0.76);
    ctx.stroke();

    // Smooth 60fps spinning 3D-foreshortened helicopter blades!
    const bladeSpan = Math.max(2.2, Math.abs(Math.cos(p.propellerPhase)) * (radius * 0.68));
    const bladeY = -radius * 0.76;

    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.ellipse(-bladeSpan * 0.55, bladeY, bladeSpan * 0.58, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#38BDF8';
    ctx.beginPath();
    ctx.ellipse(bladeSpan * 0.55, bladeY, bladeSpan * 0.58, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Golden propeller hub pin
    ctx.fillStyle = '#FDE047';
    ctx.beginPath();
    ctx.arc(0, bladeY, 2.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.restore();
  }

  private renderGhost(
    ctx: CanvasRenderingContext2D,
    ghost: JrGhostState,
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
      let topCol = ghost.accentColor;
      let midCol = ghost.color;
      let botCol = ghost.color;
      let glowCol = ghost.color;

      if (isFrightened) {
        if (isFlashing) {
          topCol = '#FFFFFF';
          midCol = '#F1F5F9';
          botCol = '#CBD5E1';
          glowCol = '#FFFFFF';
        } else {
          topCol = '#4F7CFF';
          midCol = '#2539D8';
          botCol = '#141D8C';
          glowCol = '#3B82F6';
        }
      }

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
        const waveOffset =
          (i % 2 === 0 ? 1 : -1) *
          (3.2 + (i % 2 === 0 ? phaseShift * 0.35 : -phaseShift * 0.35));
        ctx.quadraticCurveTo(xCtrl, skirtBaseY + waveOffset, xEnd, skirtBaseY);
      }

      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = isFlashing ? 'rgba(255,255,255,0.55)' : 'rgba(255, 255, 255, 0.22)';
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
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
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
      const eyeSpacing = r * 0.38;
      const eyeY = -r * 0.18 + look.y * 0.45;

      if (isEaten) {
        ctx.fillStyle = 'rgba(125, 211, 252, 0.22)';
        ctx.beginPath();
        ctx.arc(0, -r * 0.1, r * 0.72, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const side of [-1, 1]) {
        const ex = side * eyeSpacing + look.x * 0.45;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.ellipse(ex, eyeY, 4.9, 6.2, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#0B1D51';
        ctx.beginPath();
        ctx.arc(ex + look.x * 1.45, eyeY + look.y * 1.75, 2.7, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(ex + look.x * 1.45 - 0.8, eyeY + look.y * 1.75 - 0.9, 0.85, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  private getEyeOffset(dir: Direction): { x: number; y: number } {
    switch (dir) {
      case 'LEFT':
        return { x: -1.6, y: 0 };
      case 'RIGHT':
        return { x: 1.6, y: 0 };
      case 'UP':
        return { x: 0, y: -1.6 };
      case 'DOWN':
        return { x: 0, y: 1.6 };
      default:
        return { x: 0, y: 0 };
    }
  }

  // All 7 Iconic Jr. Pac-Man Roaming Toys in Ultra-Crisp Vector Art!
  public drawPrize(
    ctx: CanvasRenderingContext2D,
    type: JrPrizeType,
    cx: number,
    cy: number,
    scale = 1
  ): void {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    switch (type) {
      case 'tricycle': {
        // Rear & big front wheel
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(-8, 6.5, 4.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(7, 5, 6.2, 0, Math.PI * 2);
        ctx.stroke();

        // Red tricycle frame
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 3.0;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-8, 6.5);
        ctx.lineTo(-2, -2);
        ctx.lineTo(5, -4);
        ctx.lineTo(7, 5);
        ctx.moveTo(5, -4);
        ctx.lineTo(3, -10);
        ctx.lineTo(8, -10);
        ctx.stroke();

        // Yellow seat
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(-6, -4.5, 6, 3);
        break;
      }

      case 'kite': {
        // Flowing ribbon tail
        ctx.strokeStyle = '#FDE047';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(0, 7);
        ctx.quadraticCurveTo(5, 11, 2, 14);
        ctx.stroke();

        // Kite diamond body (4 colored quadrants)
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(9, -1);
        ctx.lineTo(0, 8);
        ctx.lineTo(-9, -1);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#F43F5E';
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(9, -1);
        ctx.lineTo(0, -1);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.moveTo(-9, -1);
        ctx.lineTo(0, -1);
        ctx.lineTo(0, 8);
        ctx.closePath();
        ctx.fill();

        // Cross spars
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(0, 8);
        ctx.moveTo(-9, -1);
        ctx.lineTo(9, -1);
        ctx.stroke();
        break;
      }

      case 'drum': {
        // Drum body
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(-10, -4, 20, 12);

        // Top & bottom rims
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.ellipse(0, -4, 10, 3.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFBEB';
        ctx.beginPath();
        ctx.ellipse(0, -4, 8.2, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.ellipse(0, 8, 10, 3.2, 0, 0, Math.PI);
        ctx.fill();

        // Zigzag lacing
        ctx.strokeStyle = '#FEF08A';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-8, -2);
        ctx.lineTo(-4, 7);
        ctx.lineTo(0, -2);
        ctx.lineTo(4, 7);
        ctx.lineTo(8, -2);
        ctx.stroke();

        // Drumsticks
        ctx.strokeStyle = '#FDE68A';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-9, -11);
        ctx.lineTo(-1, -4.5);
        ctx.moveTo(9, -11);
        ctx.lineTo(1, -4.5);
        ctx.stroke();
        break;
      }

      case 'balloon': {
        // String
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(0, 6);
        ctx.quadraticCurveTo(3, 10, -1, 14);
        ctx.stroke();

        // Glossy helium balloon
        const g = ctx.createRadialGradient(-3.5, -5, 1.5, 0, -2, 11);
        g.addColorStop(0, '#FBCFE8');
        g.addColorStop(0.45, '#EC4899');
        g.addColorStop(1, '#9D174D');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(0, -2.5, 8.5, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Knot
        ctx.fillStyle = '#BE185D';
        ctx.beginPath();
        ctx.moveTo(-2, 7.5);
        ctx.lineTo(2, 7.5);
        ctx.lineTo(0, 5.5);
        ctx.closePath();
        ctx.fill();

        // Specular arc
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.beginPath();
        ctx.ellipse(-3.5, -6, 2.2, 3.8, -0.35, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'train': {
        // Toy steam locomotive
        ctx.fillStyle = '#8B5CF6';
        ctx.fillRect(-10, -3, 16, 9);
        // Cab
        ctx.fillStyle = '#EC4899';
        ctx.fillRect(-10, -9, 7, 7);
        ctx.fillStyle = '#BAE6FD';
        ctx.fillRect(-8.5, -7.5, 4, 3.5);
        // Smokestack
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(2, -10, 3.5, 7);
        ctx.fillRect(1, -11, 5.5, 2.2);
        // Cowcatcher
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.moveTo(6, 0);
        ctx.lineTo(11, 6);
        ctx.lineTo(6, 6);
        ctx.closePath();
        ctx.fill();
        // Wheels
        ctx.fillStyle = '#EF4444';
        for (const wx of [-7, -1, 4.5]) {
          ctx.beginPath();
          ctx.arc(wx, 7.5, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case 'kitty': {
        // Pointed cat ears
        ctx.fillStyle = '#FB923C';
        ctx.beginPath();
        ctx.moveTo(-9, -3);
        ctx.lineTo(-8, -12);
        ctx.lineTo(-2, -6);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(9, -3);
        ctx.lineTo(8, -12);
        ctx.lineTo(2, -6);
        ctx.closePath();
        ctx.fill();

        // Head
        const g = ctx.createRadialGradient(-2, -2, 2, 0, 1, 11);
        g.addColorStop(0, '#FED7AA');
        g.addColorStop(0.55, '#FB923C');
        g.addColorStop(1, '#C2410C');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(0, 1, 9.5, 8.2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eyes & pink nose
        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.arc(-3.5, -0.5, 1.7, 0, Math.PI * 2);
        ctx.arc(3.5, -0.5, 1.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FDA4AF';
        ctx.beginPath();
        ctx.arc(0, 2.2, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Whiskers
        ctx.strokeStyle = '#FFF7ED';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-6, 2);
        ctx.lineTo(-11, 1);
        ctx.moveTo(-6, 4);
        ctx.lineTo(-11, 5);
        ctx.moveTo(6, 2);
        ctx.lineTo(11, 1);
        ctx.moveTo(6, 4);
        ctx.lineTo(11, 5);
        ctx.stroke();
        break;
      }

      case 'rootbeer': {
        // Mug handle
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.arc(6.5, 1.5, 4.5, -Math.PI * 0.45, Math.PI * 0.45);
        ctx.stroke();

        // Frosted glass mug body
        const g = ctx.createLinearGradient(-7, -5, 7, 10);
        g.addColorStop(0, '#D97706');
        g.addColorStop(0.5, '#92400E');
        g.addColorStop(1, '#451A03');
        ctx.fillStyle = g;
        ctx.fillRect(-7, -4, 13, 14);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1.4;
        ctx.strokeRect(-7, -4, 13, 14);

        // Creamy foam head
        ctx.fillStyle = '#FFFBEB';
        ctx.beginPath();
        ctx.arc(-4.5, -5.5, 3.6, 0, Math.PI * 2);
        ctx.arc(0, -7, 4.4, 0, Math.PI * 2);
        ctx.arc(4.2, -5.2, 3.4, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }

    ctx.restore();
  }

  private renderParticles(ctx: CanvasRenderingContext2D, engine: JrPacManEngine): void {
    if (engine.particles.length === 0) return;
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

  private renderPopups(ctx: CanvasRenderingContext2D, engine: JrPacManEngine): void {
    if (engine.popups.length === 0) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const pop of engine.popups) {
      const alpha = Math.min(1, (pop.life / pop.maxLife) * 1.6);
      ctx.globalAlpha = alpha;
      const fontSize = Math.round(20 * pop.scale);
      ctx.font = `700 ${fontSize}px var(--font-jetbrains), monospace`;
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(4, 6, 15, 0.92)';
      ctx.strokeText(pop.text, pop.x * T, pop.y * T);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x * T, pop.y * T);
    }
    ctx.restore();
  }

  private renderInCanvasBanner(ctx: CanvasRenderingContext2D, engine: JrPacManEngine): void {
    if (engine.phase !== 'READY' && engine.phase !== 'STAGE_CLEAR') return;

    const text =
      engine.phase === 'READY' ? 'READY!' : `STAGE ${engine.level} CLEAR!`;

    const y = 17.5 * T;
    const x = JR_VIEWPORT_WIDTH * 0.5;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 28px var(--font-outfit), sans-serif';

    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 14;
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#060811';
    ctx.strokeText(text, x, y);

    ctx.fillStyle = engine.phase === 'READY' ? '#FFE45E' : '#34F5A6';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  private renderCrtOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
    for (let y = 0; y < JR_VIEWPORT_HEIGHT; y += 4) {
      ctx.fillRect(0, y, JR_VIEWPORT_WIDTH, 1.5);
    }
    const vig = ctx.createRadialGradient(
      JR_VIEWPORT_WIDTH * 0.5,
      JR_VIEWPORT_HEIGHT * 0.5,
      JR_VIEWPORT_WIDTH * 0.34,
      JR_VIEWPORT_WIDTH * 0.5,
      JR_VIEWPORT_HEIGHT * 0.5,
      JR_VIEWPORT_HEIGHT * 0.65
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.34)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, JR_VIEWPORT_WIDTH, JR_VIEWPORT_HEIGHT);
    ctx.restore();
  }
}

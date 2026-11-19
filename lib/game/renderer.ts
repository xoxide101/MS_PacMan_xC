import { MsPacManEngine } from './engine';
import { isWallTile } from './mazes';
import {
  CANVAS_LOGICAL_HEIGHT,
  CANVAS_LOGICAL_WIDTH,
  Direction,
  FruitType,
  GhostState,
  GRID_COLS,
  GRID_ROWS,
  LOGICAL_TILE_SIZE,
  MazeDefinition,
  VisualStyle,
} from './types';

const T = LOGICAL_TILE_SIZE; // 32 logical px per tile

export class MsPacManRenderer {
  private mazeCacheCanvas: HTMLCanvasElement | null = null;
  private cachedMazeId = -1;
  private cachedFlashWhite = false;
  private cachedDpr = 0;

  private ensureMazeCache(maze: MazeDefinition, flashWhite: boolean, dpr: number): HTMLCanvasElement {
    if (
      this.mazeCacheCanvas &&
      this.cachedMazeId === maze.id &&
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
    this.bakeStaticMaze(ctx, maze, flashWhite);

    this.cachedMazeId = maze.id;
    this.cachedFlashWhite = flashWhite;
    this.cachedDpr = dpr;
    return canvas;
  }

  private bakeStaticMaze(ctx: CanvasRenderingContext2D, maze: MazeDefinition, flashWhite: boolean): void {
    const { theme, grid } = maze;

    // 1. Deep architectural arena floor
    const bgGrad = ctx.createRadialGradient(
      CANVAS_LOGICAL_WIDTH * 0.5,
      CANVAS_LOGICAL_HEIGHT * 0.45,
      40,
      CANVAS_LOGICAL_WIDTH * 0.5,
      CANVAS_LOGICAL_HEIGHT * 0.5,
      CANVAS_LOGICAL_HEIGHT * 0.72
    );
    bgGrad.addColorStop(0, theme.floorTint);
    bgGrad.addColorStop(1, '#04050B');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CANVAS_LOGICAL_WIDTH, CANVAS_LOGICAL_HEIGHT);

    // Subtle micro-grid dot register on walkable corridors for high-res spatial crispness
    ctx.fillStyle = 'rgba(255, 255, 255, 0.028)';
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (grid[r][c] !== '#') {
          ctx.fillRect(c * T + T * 0.5 - 0.75, r * T + T * 0.5 - 0.75, 1.5, 1.5);
        }
      }
    }

    // 2. Render sculpted rounded wall interiors
    const fillColor = flashWhite ? '#E2E8F0' : theme.wallInner;
    const outerStroke = flashWhite ? '#FFFFFF' : theme.wallOuter;
    const highlightColor = flashWhite ? '#FFFFFF' : theme.wallHighlight;
    const glowColor = flashWhite ? 'rgba(255,255,255,0.65)' : theme.wallGlow;

    const inset = 3.5;
    const cornerR = 9;

    // Wall interior body pass
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

    // 3. Crisp continuous neon perimeter border + specular inner bevel
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

          // Top exposed edge
          if (!n) {
            const startX = !w ? xL + cornerR : xTileL;
            const endX = !e ? xR - cornerR : xTileR;
            ctx.moveTo(startX, yT);
            ctx.lineTo(endX, yT);
          }
          // Bottom exposed edge
          if (!s) {
            const startX = !w ? xL + cornerR : xTileL;
            const endX = !e ? xR - cornerR : xTileR;
            ctx.moveTo(startX, yB);
            ctx.lineTo(endX, yB);
          }
          // Left exposed edge
          if (!w) {
            const startY = !n ? yT + cornerR : yTileT;
            const endY = !s ? yB - cornerR : yTileB;
            ctx.moveTo(xL, startY);
            ctx.lineTo(xL, endY);
          }
          // Right exposed edge
          if (!e) {
            const startY = !n ? yT + cornerR : yTileT;
            const endY = !s ? yB - cornerR : yTileB;
            ctx.moveTo(xR, startY);
            ctx.lineTo(xR, endY);
          }

          // Convex outer corners
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

          // Concave inner corner bridges (when two adjacent sides are walls but diagonal is open)
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

    // Layer 1: Atmospheric Neon Bloom
    strokePerimeter(outerStroke, 4.4, 14, glowColor);
    // Layer 2: Crisp Primary Wall Tube
    strokePerimeter(outerStroke, 3.0, 0, 'transparent');
    // Layer 3: Razor-thin Specular Inner Highlight
    strokePerimeter(highlightColor, 1.15, 0, 'transparent');

    // 4. Ghost House Glowing Laser Gate
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

    // 5. Subtle warp tunnel chevron indicators at left/right exits
    ctx.save();
    ctx.strokeStyle = theme.wallOuter;
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const tr of maze.tunnelRows) {
      const cy = (tr + 0.5) * T;
      // Left portal chevron
      ctx.beginPath();
      ctx.moveTo(14, cy - 6);
      ctx.lineTo(8, cy);
      ctx.lineTo(14, cy + 6);
      // Right portal chevron
      ctx.moveTo(CANVAS_LOGICAL_WIDTH - 14, cy - 6);
      ctx.lineTo(CANVAS_LOGICAL_WIDTH - 8, cy);
      ctx.lineTo(CANVAS_LOGICAL_WIDTH - 14, cy + 6);
      ctx.stroke();
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
    engine: MsPacManEngine,
    dpr: number,
    visualStyle: VisualStyle
  ): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 1. Blit pre-baked HiDPI Maze
    const flashWhite =
      engine.phase === 'STAGE_CLEAR' && Math.floor(engine.stageClearFlashPhase) % 2 === 1;
    const mazeLayer = this.ensureMazeCache(engine.maze, flashWhite, dpr);
    ctx.drawImage(mazeLayer, 0, 0, CANVAS_LOGICAL_WIDTH, CANVAS_LOGICAL_HEIGHT);

    // 2. Dynamic radial floor lighting pools
    this.renderAmbientLights(ctx, engine);

    // 3. Pellets & Pulsing Power Pellets
    this.renderPellets(ctx, engine);

    // 4. Roaming Bouncing Bonus Fruit
    if (engine.fruit.active) {
      const fx = engine.fruit.x * T;
      const fy = engine.fruit.y * T;
      const bounce = Math.abs(Math.sin(engine.fruit.bouncePhase)) * 7.5;
      // Floor shadow
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(fx, fy + 10, Math.max(5, 10 - bounce * 0.4), 3.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      this.drawFruit(ctx, engine.fruit.type, fx, fy - bounce, 1.0);
    }

    // 5. Ms. Pac-Man motion trail + hero vector render
    if (engine.phase !== 'STAGE_CLEAR') {
      this.renderPlayerTrail(ctx, engine);
      if (engine.phase !== 'GHOST_EATEN_PAUSE') {
        this.renderMsPacMan(ctx, engine);
      }
    } else {
      this.renderMsPacMan(ctx, engine);
    }

    // 6. Ghosts (hidden during death spin or stage clear)
    if (engine.phase !== 'DYING' && engine.phase !== 'STAGE_CLEAR') {
      for (const ghost of engine.ghosts) {
        if (engine.phase === 'GHOST_EATEN_PAUSE' && ghost.id === engine.eatenGhostId) {
          continue; // replaced cleanly by the floating score popup
        }
        this.renderGhost(ctx, ghost, engine.frightenedTimer, engine.elapsedTime);
      }
    }

    // 7. Crisp Particles & Floating Score Popups
    this.renderParticles(ctx, engine);
    this.renderPopups(ctx, engine);

    // 8. In-canvas Arcade Banners ("READY!", "STAGE CLEAR!")
    this.renderInCanvasBanner(ctx, engine);

    // 9. Optional PVM CRT Phosphor Scanline Polish
    if (visualStyle === 'crt') {
      this.renderCrtOverlay(ctx);
    }
  }

  private renderAmbientLights(ctx: CanvasRenderingContext2D, engine: MsPacManEngine): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Warm golden aura around Ms. Pac-Man
    if (engine.phase !== 'DYING') {
      const px = engine.player.x * T;
      const py = engine.player.y * T;
      const pGrad = ctx.createRadialGradient(px, py, 2, px, py, T * 2.3);
      pGrad.addColorStop(0, 'rgba(255, 214, 64, 0.14)');
      pGrad.addColorStop(1, 'rgba(255, 214, 64, 0)');
      ctx.fillStyle = pGrad;
      ctx.beginPath();
      ctx.arc(px, py, T * 2.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Subtle colored floor glow beneath active ghosts
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

  private renderPellets(ctx: CanvasRenderingContext2D, engine: MsPacManEngine): void {
    const { grid, maze, elapsedTime } = engine;
    const pulse = 0.5 + 0.5 * Math.sin(elapsedTime * 7.2);

    ctx.save();
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const tile = grid[r][c];
        if (tile === '.') {
          const cx = (c + 0.5) * T;
          const cy = (r + 0.5) * T;
          // Soft warm halo
          ctx.fillStyle = maze.theme.pelletGlow;
          ctx.beginPath();
          ctx.arc(cx, cy, 4.6, 0, Math.PI * 2);
          ctx.fill();
          // Crisp luminous orb core
          ctx.fillStyle = maze.theme.pelletColor;
          ctx.beginPath();
          ctx.arc(cx, cy, 3.0, 0, Math.PI * 2);
          ctx.fill();
        } else if (tile === 'o') {
          const cx = (c + 0.5) * T;
          const cy = (r + 0.5) * T;
          const coreR = 7.4 + pulse * 1.8;
          const haloR = 14.5 + pulse * 5.5;

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
          ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
          ctx.fill();

          // Subtle pearl specular dot
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(cx - 2.2, cy - 2.2, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  private renderPlayerTrail(ctx: CanvasRenderingContext2D, engine: MsPacManEngine): void {
    const { trail } = engine.player;
    if (trail.length === 0) return;
    ctx.save();
    for (let i = 0; i < trail.length; i++) {
      const pt = trail[i];
      ctx.fillStyle = `rgba(255, 212, 59, ${pt.alpha * 0.28})`;
      ctx.beginPath();
      ctx.arc(pt.x * T, pt.y * T, 8 + i * 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderMsPacMan(ctx: CanvasRenderingContext2D, engine: MsPacManEngine): void {
    const p = engine.player;
    const cx = p.x * T;
    const cy = p.y * T;
    const radius = T * 0.62;

    ctx.save();
    ctx.translate(cx, cy);

    if (engine.phase === 'DYING') {
      // Classic Ms. Pac-Man spin + vanish animation
      const prog = p.deathProgress;
      const spinAngle = prog * Math.PI * 5;
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

    // Orient facing direction cleanly so bow stays upright on Left/Right and natural on Up/Down
    const dir = p.dir === 'NONE' ? 'LEFT' : p.dir;
    const facingLeft = dir === 'LEFT';
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

    // 1. Glossy radial-shaded golden body
    const bodyGrad = ctx.createRadialGradient(-radius * 0.28, -radius * 0.34, 2, 0, 0, radius * 1.05);
    bodyGrad.addColorStop(0, '#FFF6A6');
    bodyGrad.addColorStop(0.48, '#FFD829');
    bodyGrad.addColorStop(0.88, '#F5A600');
    bodyGrad.addColorStop(1, '#CC7A00');

    ctx.shadowColor = 'rgba(255, 210, 48, 0.45)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, chomp, Math.PI * 2 - chomp);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // Subtle specular crescent on forehead
    ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
    ctx.beginPath();
    ctx.ellipse(-radius * 0.2, -radius * 0.48, radius * 0.36, radius * 0.16, -0.35, 0, Math.PI * 2);
    ctx.fill();

    // 2. Signature ruby crimson lips along upper & lower jaw tips
    const lipAngle = Math.max(0.14, chomp);
    const ux = Math.cos(-lipAngle) * radius;
    const uy = Math.sin(-lipAngle) * radius;
    const lx = Math.cos(lipAngle) * radius;
    const ly = Math.sin(lipAngle) * radius;

    ctx.fillStyle = '#EF233C';
    ctx.beginPath();
    ctx.arc(ux * 0.96, uy * 0.96, 3.1, 0, Math.PI * 2);
    ctx.arc(lx * 0.96, ly * 0.96, 3.1, 0, Math.PI * 2);
    ctx.fill();

    // 3. Expressive eye + delicate eyelashes
    const eyeX = radius * 0.16;
    const eyeY = -radius * 0.42;
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.ellipse(eyeX, eyeY, 2.5, 3.2, -0.1, 0, Math.PI * 2);
    ctx.fill();

    // Eye catchlight
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(eyeX + 0.8, eyeY - 1.1, 1.0, 0, Math.PI * 2);
    ctx.fill();

    // Curved eyelashes
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(eyeX - 1.2, eyeY - 2.8);
    ctx.lineTo(eyeX - 3.6, eyeY - 5.2);
    ctx.moveTo(eyeX + 0.6, eyeY - 3.1);
    ctx.lineTo(eyeX - 0.8, eyeY - 5.9);
    ctx.stroke();

    // 4. Classic beauty mark on cheek
    ctx.fillStyle = '#1E1B24';
    ctx.beginPath();
    ctx.arc(radius * 0.08, radius * 0.36, 1.55, 0, Math.PI * 2);
    ctx.fill();

    // 5. Iconic Ms. Pac-Man Crimson Hair Bow (sculpted twin loops + center knot + shine)
    ctx.save();
    ctx.translate(-radius * 0.44, -radius * 0.78);
    ctx.rotate(facingLeft ? -0.38 : -0.42);

    ctx.fillStyle = '#E11D48';
    ctx.strokeStyle = '#881337';
    ctx.lineWidth = 1.1;

    // Left ribbon loop
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-9, -7, -11, 5, -1, 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Right ribbon loop
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(9, -7, 11, 5, 1, 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Center bow knot + gloss highlight
    ctx.fillStyle = '#FB7185';
    ctx.beginPath();
    ctx.arc(0, 0.5, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFF1F2';
    ctx.beginPath();
    ctx.arc(-0.8, -0.4, 1.0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.restore();
  }

  private renderGhost(
    ctx: CanvasRenderingContext2D,
    ghost: GhostState,
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
      // Determine body color palette
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

      // Fluid 60fps domed body + animated undulating skirt
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
        const waveOffset = (i % 2 === 0 ? 1 : -1) * (3.2 + (i % 2 === 0 ? phaseShift * 0.35 : -phaseShift * 0.35));
        ctx.quadraticCurveTo(xCtrl, skirtBaseY + waveOffset, xEnd, skirtBaseY);
      }

      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      // Subtle glossy dome highlight for HD depth
      ctx.fillStyle = isFlashing ? 'rgba(255,255,255,0.55)' : 'rgba(255, 255, 255, 0.22)';
      ctx.beginPath();
      ctx.ellipse(-r * 0.32, -r * 0.48, r * 0.26, r * 0.14, -0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Face / Eyes
    if (isFrightened) {
      const faceCol = isFlashing ? '#DC2626' : '#FFE4CC';
      ctx.fillStyle = faceCol;
      ctx.beginPath();
      ctx.arc(-r * 0.34, -r * 0.16, 2.7, 0, Math.PI * 2);
      ctx.arc(r * 0.34, -r * 0.16, 2.7, 0, Math.PI * 2);
      ctx.fill();

      // Wavy frightened mouth
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
      // Expressive directional sclera + pupils
      const look = this.getEyeOffset(ghost.dir);
      const eyeSpacing = r * 0.38;
      const eyeY = -r * 0.18 + look.y * 0.45;

      // Glow trail if eaten eyes racing home
      if (isEaten) {
        ctx.fillStyle = 'rgba(125, 211, 252, 0.22)';
        ctx.beginPath();
        ctx.arc(0, -r * 0.1, r * 0.72, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const side of [-1, 1]) {
        const ex = side * eyeSpacing + look.x * 0.45;
        // White sclera
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.ellipse(ex, eyeY, 4.9, 6.2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Deep cobalt pupil looking toward travel direction
        ctx.fillStyle = '#0B1D51';
        ctx.beginPath();
        ctx.arc(ex + look.x * 1.45, eyeY + look.y * 1.75, 2.7, 0, Math.PI * 2);
        ctx.fill();

        // Tiny bright specular glint
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

  public drawFruit(
    ctx: CanvasRenderingContext2D,
    type: FruitType,
    cx: number,
    cy: number,
    scale = 1
  ): void {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    switch (type) {
      case 'cherry': {
        // Curved stems
        ctx.strokeStyle = '#84CC16';
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-6, 2);
        ctx.quadraticCurveTo(-4, -10, 4, -12);
        ctx.moveTo(6, 5);
        ctx.quadraticCurveTo(6, -7, 4, -12);
        ctx.stroke();

        // Twin glossy cherries
        for (const [bx, by] of [
          [-6.5, 4.5],
          [5.5, 7],
        ]) {
          const g = ctx.createRadialGradient(bx - 2, by - 2, 1, bx, by, 7);
          g.addColorStop(0, '#FF8FA3');
          g.addColorStop(0.4, '#E11D48');
          g.addColorStop(1, '#881337');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(bx, by, 6.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.75)';
          ctx.beginPath();
          ctx.arc(bx - 2.2, by - 2.2, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case 'strawberry': {
        const g = ctx.createRadialGradient(-3, -2, 2, 0, 2, 13);
        g.addColorStop(0, '#FF6B8A');
        g.addColorStop(0.55, '#E11D48');
        g.addColorStop(1, '#9F1239');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, 12);
        ctx.bezierCurveTo(11, 7, 11, -5, 6, -8);
        ctx.quadraticCurveTo(0, -10, -6, -8);
        ctx.bezierCurveTo(-11, -5, -11, 7, 0, 12);
        ctx.fill();

        // Seeds
        ctx.fillStyle = '#FEF08A';
        for (const [sx, sy] of [
          [-4, -2],
          [0, -1],
          [4, -2],
          [-3, 3],
          [2.5, 3],
          [0, 7],
        ]) {
          ctx.beginPath();
          ctx.ellipse(sx, sy, 1.1, 1.6, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        // Leafy crown
        ctx.fillStyle = '#4ADE80';
        ctx.beginPath();
        ctx.moveTo(-7, -7);
        ctx.lineTo(-2, -12);
        ctx.lineTo(0, -8);
        ctx.lineTo(2, -12);
        ctx.lineTo(7, -7);
        ctx.lineTo(0, -5);
        ctx.closePath();
        ctx.fill();
        break;
      }

      case 'orange': {
        const g = ctx.createRadialGradient(-4, -4, 2, 0, 0, 12);
        g.addColorStop(0, '#FFD166');
        g.addColorStop(0.5, '#F97316');
        g.addColorStop(1, '#C2410C');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 2, 10.5, 0, Math.PI * 2);
        ctx.fill();
        // Stem & leaf
        ctx.strokeStyle = '#78350F';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(0, -8.5);
        ctx.lineTo(1, -13);
        ctx.stroke();
        ctx.fillStyle = '#4ADE80';
        ctx.beginPath();
        ctx.ellipse(5.5, -10, 5, 2.5, -0.35, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'pretzel': {
        // Iconic Ms. Pac-Man golden twisted pretzel!
        ctx.strokeStyle = '#D97706';
        ctx.lineWidth = 4.6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-9, 7);
        ctx.bezierCurveTo(-14, -5, -4, -14, 0, -4);
        ctx.bezierCurveTo(4, -14, 14, -5, 9, 7);
        ctx.bezierCurveTo(4, 13, -4, 13, -9, 7);
        ctx.stroke();

        // Cross arms
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(-6, -3);
        ctx.lineTo(6, 6);
        ctx.moveTo(6, -3);
        ctx.lineTo(-6, 6);
        ctx.stroke();

        // Salt crystals
        ctx.fillStyle = '#FFFBEB';
        for (const [sx, sy] of [
          [-7, -5],
          [7, -5],
          [0, 1],
          [-6, 7],
          [6, 7],
        ]) {
          ctx.fillRect(sx - 1.1, sy - 1.1, 2.2, 2.2);
        }
        break;
      }

      case 'apple': {
        const g = ctx.createRadialGradient(-4, -3, 2, 0, 1, 12);
        g.addColorStop(0, '#FB7185');
        g.addColorStop(0.5, '#E11D48');
        g.addColorStop(1, '#881337');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.bezierCurveTo(8, -11, 13, -1, 8, 9);
        ctx.quadraticCurveTo(3, 12, 0, 9);
        ctx.quadraticCurveTo(-3, 12, -8, 9);
        ctx.bezierCurveTo(-13, -1, -8, -11, 0, -6);
        ctx.fill();
        ctx.strokeStyle = '#A16207';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.quadraticCurveTo(1, -11, 3, -13);
        ctx.stroke();
        ctx.fillStyle = '#4ADE80';
        ctx.beginPath();
        ctx.ellipse(-4.5, -10.5, 4.2, 2.2, 0.45, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'pear': {
        const g = ctx.createRadialGradient(-3, 2, 2, 0, 2, 13);
        g.addColorStop(0, '#D9F99D');
        g.addColorStop(0.55, '#84CC16');
        g.addColorStop(1, '#4D7C0F');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.bezierCurveTo(6, -10, 5, -2, 9, 4);
        ctx.bezierCurveTo(11, 11, 5, 13, 0, 13);
        ctx.bezierCurveTo(-5, 13, -11, 11, -9, 4);
        ctx.bezierCurveTo(-5, -2, -6, -10, 0, -10);
        ctx.fill();
        ctx.strokeStyle = '#78350F';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(1.5, -14);
        ctx.stroke();
        break;
      }

      case 'banana': {
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 6.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-8, 6);
        ctx.quadraticCurveTo(2, 10, 9, -8);
        ctx.stroke();

        ctx.strokeStyle = '#FEF08A';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(-6, 5);
        ctx.quadraticCurveTo(2, 7.5, 7.5, -6);
        ctx.stroke();

        // Brown banana tips
        ctx.fillStyle = '#78350F';
        ctx.beginPath();
        ctx.arc(-9, 6.5, 2.2, 0, Math.PI * 2);
        ctx.arc(9.5, -9, 2.2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }

    ctx.restore();
  }

  private renderParticles(ctx: CanvasRenderingContext2D, engine: MsPacManEngine): void {
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

  private renderPopups(ctx: CanvasRenderingContext2D, engine: MsPacManEngine): void {
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

  private renderInCanvasBanner(ctx: CanvasRenderingContext2D, engine: MsPacManEngine): void {
    if (engine.phase !== 'READY' && engine.phase !== 'STAGE_CLEAR') return;

    const text =
      engine.phase === 'READY'
        ? `READY!`
        : `STAGE ${engine.level} CLEAR!`;

    const y = 17.5 * T;
    const x = 14 * T;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 28px var(--font-outfit), sans-serif';

    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 14;
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#060811';
    ctx.strokeText(text, x, y);

    ctx.fillStyle = engine.phase === 'READY' ? '#FFE45E' : '#4ADE80';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  private renderCrtOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    // Ultra-fine broadcast PVM scanlines
    ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
    for (let y = 0; y < CANVAS_LOGICAL_HEIGHT; y += 4) {
      ctx.fillRect(0, y, CANVAS_LOGICAL_WIDTH, 1.5);
    }
    // Gentle phosphor vignette
    const vig = ctx.createRadialGradient(
      CANVAS_LOGICAL_WIDTH * 0.5,
      CANVAS_LOGICAL_HEIGHT * 0.5,
      CANVAS_LOGICAL_WIDTH * 0.34,
      CANVAS_LOGICAL_WIDTH * 0.5,
      CANVAS_LOGICAL_HEIGHT * 0.5,
      CANVAS_LOGICAL_HEIGHT * 0.65
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.34)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, CANVAS_LOGICAL_WIDTH, CANVAS_LOGICAL_HEIGHT);
    ctx.restore();
  }
}

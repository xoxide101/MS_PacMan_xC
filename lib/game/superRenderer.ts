import { SuperPacManEngine } from './superEngine';
import { SUPER_MAZE } from './superMazes';
import { SuperGhostState, SuperMazeTheme, SuperPrizeType } from './superTypes';
import {
  CANVAS_LOGICAL_HEIGHT,
  CANVAS_LOGICAL_WIDTH,
  Direction,
  GRID_COLS,
  GRID_ROWS,
  LOGICAL_TILE_SIZE as TILE_SIZE,
  VisualStyle,
} from './types';
import { drawStarGlint } from './arcadeGfx';
import { renderCrtOverlay } from './classicArcadeInterface';

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

export class SuperPacManRenderer {
  private wallCache: HTMLCanvasElement | null = null;
  private cachedKey = '';

  public render(
    ctx: CanvasRenderingContext2D,
    engine: SuperPacManEngine,
    dpr: number,
    visualStyle: VisualStyle
  ): void {
    const theme = engine.theme;
    const width = CANVAS_LOGICAL_WIDTH;
    const height = CANVAS_LOGICAL_HEIGHT;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Rich dark vault floor
    ctx.fillStyle = theme.floorTint;
    ctx.fillRect(0, 0, width, height);

    const floorGrad = ctx.createRadialGradient(
      width * 0.5,
      height * 0.45,
      40,
      width * 0.5,
      height * 0.5,
      width * 0.72
    );
    floorGrad.addColorStop(0, `${theme.accentHex}16`);
    floorGrad.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, 0, width, height);

    // Screen shake
    if (engine.screenShake > 0.1) {
      const sx = (Math.random() - 0.5) * engine.screenShake;
      const sy = (Math.random() - 0.5) * engine.screenShake;
      ctx.translate(sx, sy);
    }

    const flashWhite =
      engine.phase === 'STAGE_CLEAR' && Math.floor(engine.stageClearFlashPhase) % 2 === 1;
    this.ensureWallCache(theme, dpr, flashWhite);
    if (this.wallCache) {
      ctx.drawImage(this.wallCache, 0, 0, width, height);
    }

    this.drawWarpPortals(ctx, theme, engine.elapsed);
    this.drawBoardItems(ctx, engine);
    if (engine.bonusStarActive) {
      this.drawBonusStar(ctx, engine.elapsed);
    }

    // Ghosts (draw beneath Giant Super Pac-Man so Super Pac-Man towers over them!)
    for (const ghost of engine.ghosts) {
      if (engine.phase === 'GHOST_EATEN_PAUSE' && engine.eatenGhostFreezeId === ghost.id) {
        continue;
      }
      this.drawGhost(ctx, ghost, engine);
    }

    if (engine.phase !== 'GHOST_EATEN_PAUSE') {
      this.drawPlayer(ctx, engine);
    }

    this.drawParticles(ctx, engine);
    this.drawPopups(ctx, engine);

    if (engine.phase === 'READY') {
      this.drawBanner(ctx, 'READY!', '#4ADE80', 'rgba(74, 222, 128, 0.65)');
    } else if (engine.phase === 'STAGE_CLEAR') {
      this.drawBanner(ctx, 'VAULTS CLEARED!', '#FDE047', 'rgba(253, 224, 71, 0.7)');
    }

    if (visualStyle === 'crt') {
      this.drawCrtOverlay(ctx, width, height);
    }

    ctx.restore();
  }

  private ensureWallCache(theme: SuperMazeTheme, dpr: number, flashWhite: boolean): void {
    const key = `${theme.name}-${dpr.toFixed(2)}-${flashWhite ? 1 : 0}`;
    if (this.wallCache && this.cachedKey === key) return;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(CANVAS_LOGICAL_WIDTH * dpr);
    canvas.height = Math.round(CANVAS_LOGICAL_HEIGHT * dpr);
    const wctx = canvas.getContext('2d');
    if (!wctx) return;

    wctx.scale(dpr, dpr);
    const grid = SUPER_MAZE.grid;
    const ts = TILE_SIZE;
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
          const x = c * ts;
          const y = r * ts;
          const n = isWall(c, r - 1);
          const s = isWall(c, r + 1);
          const w = isWall(c - 1, r);
          const e = isWall(c + 1, r);

          const left = w ? x : x + inset;
          const right = e ? x + ts : x + ts - inset;
          const top = n ? y : y + inset;
          const bottom = s ? y + ts : y + ts - inset;

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
    wctx.globalAlpha = flashWhite ? 0.9 : 0.42;
    wctx.lineWidth = 1.15;
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (!isWall(c, r)) continue;
        const x = c * ts;
        const y = r * ts;
        if (!isWall(c, r - 1)) {
          wctx.beginPath();
          wctx.moveTo(x + (isWall(c - 1, r) ? 0 : 6), y + 4);
          wctx.lineTo(x + ts - (isWall(c + 1, r) ? 0 : 6), y + 4);
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
          wctx.fillRect(c * ts, r * ts + ts * 0.38, ts, ts * 0.24);
          wctx.restore();
        }
      }
    }

    this.wallCache = canvas;
    this.cachedKey = key;
  }

  private drawWarpPortals(ctx: CanvasRenderingContext2D, theme: SuperMazeTheme, elapsed: number): void {
    const pulse = 0.55 + Math.sin(elapsed * 4) * 0.25;
    const y = 14 * TILE_SIZE;
    const h = TILE_SIZE;

    const leftGrad = ctx.createLinearGradient(0, y, TILE_SIZE * 2.2, y);
    leftGrad.addColorStop(0, `${theme.accentHex}70`);
    leftGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = leftGrad;
    ctx.fillRect(0, y, TILE_SIZE * 2.2, h);

    const rightGrad = ctx.createLinearGradient(
      CANVAS_LOGICAL_WIDTH,
      y,
      CANVAS_LOGICAL_WIDTH - TILE_SIZE * 2.2,
      y
    );
    rightGrad.addColorStop(0, `${theme.accentHex}70`);
    rightGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rightGrad;
    ctx.fillRect(CANVAS_LOGICAL_WIDTH - TILE_SIZE * 2.2, y, TILE_SIZE * 2.2, h);
    ctx.restore();
  }

  private drawBoardItems(ctx: CanvasRenderingContext2D, engine: SuperPacManEngine): void {
    const ts = TILE_SIZE;
    const theme = engine.theme;
    const pulse = 0.5 + 0.5 * Math.sin(engine.elapsed * 6.5);
    const superPulse = 0.5 + 0.5 * Math.sin(engine.elapsed * 9.0);

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const ch = engine.grid[r][c];
        if (ch === ' ' || ch === '#' || ch === '-' || ch === 'G') continue;
        const cx = (c + 0.5) * ts;
        const cy = (r + 0.5) * ts;

        if (ch === 'V') {
          // Glowing metallic locked vault door
          ctx.save();
          ctx.shadowColor = theme.gateGlow;
          ctx.shadowBlur = engine.isSuperActive ? 14 : 8;
          ctx.fillStyle = engine.isSuperActive ? '#4ADE80' : theme.gateLocked;
          ctx.fillRect(cx - 4.5, r * ts + 2, 9, ts - 4);
          // Lock rivets / laser stripes
          ctx.fillStyle = '#0F172A';
          ctx.fillRect(cx - 2.5, r * ts + 5, 5, 3);
          ctx.fillRect(cx - 2.5, r * ts + ts - 8, 5, 3);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(cx - 1, r * ts + 3, 2, ts - 6);
          ctx.restore();
        } else if (ch === 'K') {
          this.drawGoldenKey(ctx, cx, cy, engine.elapsed);
        } else if (ch === 'o') {
          const rPellet = 6.8 + pulse * 1.4;
          ctx.save();
          ctx.shadowColor = 'rgba(255, 226, 150, 0.8)';
          ctx.shadowBlur = 14 + pulse * 6;
          ctx.fillStyle = '#FFF5CC';
          ctx.beginPath();
          ctx.arc(cx, cy, rPellet, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (ch === 'S') {
          // Iconic Green Super Pellet!
          const rSuper = 8.4 + superPulse * 1.8;
          ctx.save();
          ctx.shadowColor = 'rgba(74, 222, 128, 0.95)';
          ctx.shadowBlur = 18 + superPulse * 8;
          const grad = ctx.createRadialGradient(cx - 2.5, cy - 2.5, 1, cx, cy, rSuper);
          grad.addColorStop(0, '#ECFDF5');
          grad.addColorStop(0.45, '#4ADE80');
          grad.addColorStop(1, '#15803D');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(cx, cy, rSuper, 0, Math.PI * 2);
          ctx.fill();
          // Outer ring glint + sparkle star
          ctx.strokeStyle = 'rgba(220, 252, 231, 0.85)';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(cx, cy, rSuper + 2.2, 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;
          drawStarGlint(ctx, cx, cy, 5.5 + superPulse * 2.5, '#ECFDF5', 0.75);
          ctx.restore();
        } else if (ch === 'T') {
          this.drawPrize(ctx, engine.currentPrize, cx, cy, 0.92);
        }
      }
    }
  }

  private drawGoldenKey(ctx: CanvasRenderingContext2D, cx: number, cy: number, elapsed: number): void {
    const bob = Math.sin(elapsed * 5 + cx * 0.1) * 1.6;
    ctx.save();
    ctx.translate(cx, cy + bob);
    ctx.shadowColor = 'rgba(250, 204, 21, 0.65)';
    ctx.shadowBlur = 10;

    // Bow (top ring)
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(0, -4.5, 4.2, 0, Math.PI * 2);
    ctx.stroke();

    // Specular highlight
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(-1.2, -5.8, 1.3, 0, Math.PI * 2);
    ctx.fill();

    // Shaft & teeth
    ctx.fillStyle = '#EAB308';
    ctx.fillRect(-1.4, -0.5, 2.8, 9.5);
    ctx.fillRect(1.2, 3.8, 3.6, 2);
    ctx.fillRect(1.2, 7.0, 2.8, 1.8);
    ctx.restore();
  }

  private drawBonusStar(ctx: CanvasRenderingContext2D, elapsed: number): void {
    const cx = SUPER_MAZE.bonusStarPos.x * TILE_SIZE;
    const cy = SUPER_MAZE.bonusStarPos.y * TILE_SIZE;
    const rot = elapsed * 2.8;
    const scale = 1 + Math.sin(elapsed * 9) * 0.12;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.scale(scale, scale);
    ctx.shadowColor = 'rgba(253, 224, 71, 0.9)';
    ctx.shadowBlur = 18;

    ctx.fillStyle = '#FDE047';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 11.5 : 5;
      const a = (Math.PI * i) / 5 - Math.PI / 2;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  public drawPrize(
    ctx: CanvasRenderingContext2D,
    type: SuperPrizeType,
    cx: number,
    cy: number,
    scale = 1
  ): void {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    switch (type) {
      case 'apple': {
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(-2.6, 1.5, 6.2, 0, Math.PI * 2);
        ctx.arc(2.6, 1.5, 6.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.ellipse(-3.8, -0.8, 1.8, 3, -0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#92400E';
        ctx.lineWidth = 1.7;
        ctx.beginPath();
        ctx.moveTo(0, -4);
        ctx.lineTo(1.5, -8.5);
        ctx.stroke();
        ctx.fillStyle = '#4ADE80';
        ctx.beginPath();
        ctx.ellipse(4.5, -6.8, 3.4, 1.8, -0.35, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'banana': {
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 4.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(1, -1, 7.5, 0.35, Math.PI * 0.92);
        ctx.stroke();
        ctx.strokeStyle = '#FEF08A';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0.5, -1.6, 6.2, 0.45, Math.PI * 0.85);
        ctx.stroke();
        ctx.fillStyle = '#78350F';
        ctx.fillRect(6.5, 1.5, 2.5, 2.5);
        break;
      }
      case 'donut': {
        ctx.fillStyle = '#D97706';
        ctx.beginPath();
        ctx.arc(0, 0, 8.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#F472B6';
        ctx.beginPath();
        ctx.arc(0, -0.5, 7.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0B1120';
        ctx.beginPath();
        ctx.arc(0, 0, 2.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FEF08A';
        ctx.fillRect(-4.5, -3.5, 2, 1.3);
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(2.5, -4, 2, 1.3);
        ctx.fillStyle = '#4ADE80';
        ctx.fillRect(3, 2.2, 2, 1.3);
        break;
      }
      case 'burger': {
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(0, -1, 8.2, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#22C55E';
        ctx.fillRect(-8.5, -1, 17, 2.2);
        ctx.fillStyle = '#78350F';
        ctx.fillRect(-8.2, 1.2, 16.4, 3);
        ctx.fillStyle = '#FBBF24';
        ctx.beginPath();
        ctx.roundRect(-8, 4.2, 16, 3.2, [0, 0, 3, 3]);
        ctx.fill();
        break;
      }
      case 'egg': {
        ctx.fillStyle = '#F8FAFC';
        ctx.beginPath();
        ctx.ellipse(0, 0.5, 9, 7, -0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.arc(0.5, 0, 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FEF9C3';
        ctx.beginPath();
        ctx.arc(-0.8, -1.2, 1.4, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'corn': {
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.ellipse(0, -0.5, 4.8, 8.4, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#22C55E';
        ctx.beginPath();
        ctx.ellipse(-4.5, 4, 2.4, 5.2, -0.45, 0, Math.PI * 2);
        ctx.ellipse(4.5, 4, 2.4, 5.2, 0.45, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'cake': {
        ctx.fillStyle = '#FDA4AF';
        ctx.fillRect(-7.5, -1, 15, 8);
        ctx.fillStyle = '#FFF1F2';
        ctx.fillRect(-7.5, -4, 15, 3.5);
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(0, -6, 2.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'peach': {
        ctx.fillStyle = '#FB923C';
        ctx.beginPath();
        ctx.arc(0, 1, 7.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FDE68A';
        ctx.beginPath();
        ctx.arc(-2.6, -1.6, 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4ADE80';
        ctx.beginPath();
        ctx.ellipse(3.5, -6.5, 3.6, 1.8, -0.4, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'melon': {
        ctx.fillStyle = '#22C55E';
        ctx.beginPath();
        ctx.arc(0, 0.5, 7.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#14532D';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(0, 0.5, 5, -1.2, 1.2);
        ctx.arc(0, 0.5, 5, Math.PI - 1.2, Math.PI + 1.2);
        ctx.stroke();
        break;
      }
      case 'coffee': {
        ctx.fillStyle = '#F8FAFC';
        ctx.beginPath();
        ctx.roundRect(-6.5, -4, 11.5, 10.5, [1, 1, 4, 4]);
        ctx.fill();
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(5, 0.5, 3.2, -Math.PI * 0.5, Math.PI * 0.5);
        ctx.stroke();
        ctx.fillStyle = '#78350F';
        ctx.fillRect(-5, -2.5, 8.5, 2.6);
        break;
      }
      case 'mushroom': {
        ctx.fillStyle = '#FEF3C7';
        ctx.fillRect(-3.5, 1, 7, 6.8);
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(0, 1.2, 8.2, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(-3.5, -3.2, 1.8, 0, Math.PI * 2);
        ctx.arc(3.2, -2.2, 1.6, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'bell': {
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.arc(0, -1, 6.2, Math.PI, 0);
        ctx.lineTo(8, 5.5);
        ctx.lineTo(-8, 5.5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(-6.5, 5.2, 13, 2.4);
        break;
      }
      case 'clover': {
        ctx.fillStyle = '#22C55E';
        ctx.beginPath();
        ctx.arc(-3.5, -3, 3.8, 0, Math.PI * 2);
        ctx.arc(3.5, -3, 3.8, 0, Math.PI * 2);
        ctx.arc(-3.5, 3, 3.8, 0, Math.PI * 2);
        ctx.arc(3.5, 3, 3.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#86EFAC';
        ctx.beginPath();
        ctx.arc(0, 0, 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'galaxian': {
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(8, 4);
        ctx.lineTo(3, 6);
        ctx.lineTo(0, 1);
        ctx.lineTo(-3, 6);
        ctx.lineTo(-8, 4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(-3.5, -3, 7, 3.2);
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(-7.5, -1, 3, 5);
        ctx.fillRect(4.5, -1, 3, 5);
        break;
      }
      case 'gift': {
        ctx.fillStyle = '#EC4899';
        ctx.beginPath();
        ctx.roundRect(-7.2, -5.5, 14.4, 12.5, 2);
        ctx.fill();
        ctx.fillStyle = '#FDE047';
        ctx.fillRect(-1.8, -5.5, 3.6, 12.5);
        ctx.fillRect(-7.2, -0.5, 14.4, 3);
        ctx.beginPath();
        ctx.arc(-3, -7, 2.6, 0, Math.PI * 2);
        ctx.arc(3, -7, 2.6, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }

    ctx.restore();
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, engine: SuperPacManEngine): void {
    const p = engine.player;
    const cx = p.x * TILE_SIZE;
    const cy = p.y * TILE_SIZE;
    const isSuper = engine.isSuperActive;
    const warningFlash = isSuper && engine.superRemaining < 2.4 && Math.floor(engine.elapsed * 12) % 2 === 0;
    const superScale = isSuper ? (warningFlash ? 1.42 : 1.72) : 1.0;
    const r = TILE_SIZE * 0.58 * superScale;

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

    // Super Pac-Man glowing aura ring
    if (isSuper) {
      const auraGrad = ctx.createRadialGradient(0, 0, r * 0.65, 0, 0, r * 1.45);
      auraGrad.addColorStop(0, engine.isSuperBoostHeld ? 'rgba(74, 222, 128, 0.42)' : 'rgba(250, 204, 21, 0.36)');
      auraGrad.addColorStop(1, 'rgba(74, 222, 128, 0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.45, 0, Math.PI * 2);
      ctx.fill();
    }

    const mouthOpen = p.moving
      ? 0.08 + Math.abs(Math.sin(p.mouthPhase)) * 0.72
      : 0.34;
    const angle = dirAngle(p.facing);
    ctx.rotate(angle);

    ctx.shadowColor = isSuper ? 'rgba(74, 222, 128, 0.65)' : 'rgba(255, 216, 41, 0.42)';
    ctx.shadowBlur = isSuper ? 18 : 10;

    const grad = ctx.createRadialGradient(-r * 0.25, -r * 0.28, 1.5, 0, 0, r);
    if (isSuper && !warningFlash) {
      grad.addColorStop(0, '#FFFDE0');
      grad.addColorStop(0.55, '#FFE135');
      grad.addColorStop(1, '#F59E0B');
    } else {
      grad.addColorStop(0, '#FFF6A6');
      grad.addColorStop(0.58, '#FFD829');
      grad.addColorStop(1, '#E09200');
    }

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, mouthOpen, Math.PI * 2 - mouthOpen);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // Forehead gloss crescent
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.2, -r * 0.45, r * 0.34, r * 0.14, -0.35, 0, Math.PI * 2);
    ctx.fill();

    // Super Pac-Man bold eyes when Giant!
    if (isSuper) {
      const eyeY = p.facing === 'LEFT' ? r * 0.36 : -r * 0.36;
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(r * 0.12, eyeY, r * 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(r * 0.16, eyeY - r * 0.03, r * 0.045, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawGhost(ctx: CanvasRenderingContext2D, g: SuperGhostState, engine: SuperPacManEngine): void {
    const cx = g.x * TILE_SIZE;
    const cy = g.y * TILE_SIZE;
    const r = TILE_SIZE * 0.56;

    ctx.save();
    ctx.translate(cx, cy);

    const isFrightened = g.mode === 'FRIGHTENED';
    const isEyes = g.mode === 'EATEN' || g.mode === 'ENTERING_HOUSE';
    const flash =
      isFrightened &&
      engine.frightenedRemaining < 2.2 &&
      Math.floor(engine.elapsed * 9) % 2 === 0;

    if (!isEyes) {
      const bodyColor = isFrightened ? (flash ? '#F8FAFC' : '#2563EB') : g.color;
      ctx.shadowColor = isFrightened ? 'rgba(59, 130, 246, 0.5)' : `${g.color}75`;
      ctx.shadowBlur = 11;

      const bodyGrad = ctx.createRadialGradient(-r * 0.3, -r * 0.35, 1, 0, 0, r * 1.2);
      if (isFrightened) {
        bodyGrad.addColorStop(0, flash ? '#FFFFFF' : '#60A5FA');
        bodyGrad.addColorStop(1, flash ? '#CBD5E1' : '#1D4ED8');
      } else {
        bodyGrad.addColorStop(0, g.accentColor);
        bodyGrad.addColorStop(0.55, g.color);
        bodyGrad.addColorStop(1, bodyColor);
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

      // Glossy dome highlight
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.26)';
      ctx.beginPath();
      ctx.ellipse(-r * 0.32, -r * 0.45, r * 0.26, r * 0.14, -0.5, 0, Math.PI * 2);
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
        const mx = -r * 0.55 + (i + 1) * (r * 0.22);
        const my = r * 0.34 + (i % 2 === 0 ? -2.2 : 2.2);
        ctx.lineTo(mx, my);
      }
      ctx.stroke();
    } else {
      const lookX = g.dir === 'LEFT' ? -2.1 : g.dir === 'RIGHT' ? 2.1 : 0;
      const lookY = g.dir === 'UP' ? -2.1 : g.dir === 'DOWN' ? 2.1 : 0;
      if (isEyes) {
        ctx.fillStyle = 'rgba(125, 211, 252, 0.24)';
        ctx.beginPath();
        ctx.arc(0, -r * 0.1, r * 0.72, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const side of [-1, 1]) {
        const ex = side * r * 0.36;
        const ey = -r * 0.16;
        ctx.fillStyle = '#F8FAFC';
        ctx.beginPath();
        ctx.ellipse(ex, ey, 3.8, 4.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1E3A8A';
        ctx.beginPath();
        ctx.arc(ex + lookX, ey + lookY, 2.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(ex + lookX - 0.7, ey + lookY - 0.8, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D, engine: SuperPacManEngine): void {
    for (const pt of engine.particles) {
      const alpha = Math.max(0, pt.life / pt.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x * TILE_SIZE, pt.y * TILE_SIZE, pt.radius * (0.4 + alpha * 0.6), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawPopups(ctx: CanvasRenderingContext2D, engine: SuperPacManEngine): void {
    for (const pop of engine.popups) {
      const alpha = Math.min(1, (pop.life / pop.maxLife) * 1.6);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '700 13px var(--font-mono), monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#020617';
      ctx.fillText(pop.text, pop.x * TILE_SIZE + 1, pop.y * TILE_SIZE + 1);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x * TILE_SIZE, pop.y * TILE_SIZE);
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
    ctx.fillText(text, CANVAS_LOGICAL_WIDTH * 0.5, 17.5 * TILE_SIZE);
    ctx.restore();
  }

  private drawCrtOverlay(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    renderCrtOverlay(ctx, width, height);
  }
}

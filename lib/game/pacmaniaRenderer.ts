import { PacManiaEngine } from './pacmaniaEngine';
import {
  PacManiaGhostState,
  PacManiaWorldTheme,
  PM_GRID_COLS,
  PM_GRID_ROWS,
  PM_VIEWPORT_HEIGHT,
  PM_VIEWPORT_WIDTH,
} from './pacmaniaTypes';
import { VisualStyle } from './types';

// Oblique 2.5D Isometric Projection (authentic 1987 Namco Pac-Mania camera angle!)
const TILE_W = 54;
const TILE_H = 38;
const SKEW_X = -11; // Subtle 3D perspective skew per row
const WALL_H = 26; // Extruded 3D block height
const JUMP_PX = 42; // Visual jump elevation per Z unit

interface RenderableItem {
  sortY: number;
  draw: () => void;
}

export class PacManiaRenderer {
  private project(
    gx: number,
    gy: number,
    gz: number,
    camX: number,
    camY: number
  ): { sx: number; sy: number } {
    const dx = gx - camX;
    const dy = gy - camY;
    const sx = PM_VIEWPORT_WIDTH * 0.5 + dx * TILE_W + dy * SKEW_X;
    const sy = PM_VIEWPORT_HEIGHT * 0.52 + dy * TILE_H - gz * JUMP_PX;
    return { sx, sy };
  }

  public render(
    ctx: CanvasRenderingContext2D,
    engine: PacManiaEngine,
    dpr: number,
    visualStyle: VisualStyle
  ): void {
    const w = PM_VIEWPORT_WIDTH;
    const h = PM_VIEWPORT_HEIGHT;
    const theme = engine.world.theme;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Rich themed backdrop sky
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, theme.skyTop);
    bgGrad.addColorStop(1, theme.skyBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    if (engine.screenShake > 0.1) {
      ctx.translate(
        (Math.random() - 0.5) * engine.screenShake,
        (Math.random() - 0.5) * engine.screenShake
      );
    }

    const camX = engine.camX;
    const camY = engine.camY;
    const flashWhite =
      engine.phase === 'STAGE_CLEAR' && Math.floor(engine.stageClearFlashPhase) % 2 === 1;

    // 1. Draw Checkered 3D Floor Plane
    this.drawFloor(ctx, engine, camX, camY, theme);

    // 2. Collect all 3D objects (walls, pellets, special item, Pac-Man, ghosts) for painter's-algorithm depth sorting!
    const drawList: RenderableItem[] = [];
    const minRow = Math.max(0, Math.floor(camY - 11));
    const maxRow = Math.min(PM_GRID_ROWS - 1, Math.ceil(camY + 11));
    const minCol = Math.max(0, Math.floor(camX - 10));
    const maxCol = Math.min(PM_GRID_COLS - 1, Math.ceil(camX + 10));

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const ch = engine.grid[r][c];
        if (ch === '#') {
          drawList.push({
            sortY: r + 0.5,
            draw: () => this.draw3DBlock(ctx, c, r, camX, camY, theme, flashWhite),
          });
        } else if (ch === '-') {
          drawList.push({
            sortY: r + 0.5,
            draw: () => this.drawGhostGate(ctx, c, r, camX, camY, theme),
          });
        } else if (ch === '.') {
          drawList.push({
            sortY: r + 0.45,
            draw: () => this.draw3DPellet(ctx, c + 0.5, r + 0.5, camX, camY, theme, false, engine.elapsed),
          });
        } else if (ch === 'o') {
          drawList.push({
            sortY: r + 0.45,
            draw: () => this.draw3DPellet(ctx, c + 0.5, r + 0.5, camX, camY, theme, true, engine.elapsed),
          });
        }
      }
    }

    // Special Speed / 2X Pellet
    if (engine.specialItem.active) {
      const sp = engine.specialItem;
      drawList.push({
        sortY: sp.y,
        draw: () => this.drawSpecialPellet(ctx, sp.x, sp.y, sp.type, camX, camY, engine.elapsed),
      });
    }

    // Ghosts
    for (const g of engine.ghosts) {
      if (engine.phase === 'GHOST_EATEN_PAUSE' && engine.eatenGhostFreezeId === g.id) continue;
      drawList.push({
        sortY: g.y + 0.05,
        draw: () => this.draw3DGhost(ctx, g, engine, camX, camY),
      });
    }

    // Player (3D glossy sphere Pac-Man!)
    if (engine.phase !== 'GHOST_EATEN_PAUSE') {
      drawList.push({
        sortY: engine.player.y + 0.08,
        draw: () => this.draw3DPlayer(ctx, engine, camX, camY),
      });
    }

    // Sort back-to-front by world Y (and tie-break by Z so airborne jumps cleanly draw over ground ghosts!)
    drawList.sort((a, b) => a.sortY - b.sortY);
    for (const item of drawList) {
      item.draw();
    }

    // Particles & Floating Popups
    this.drawParticles(ctx, engine, camX, camY);
    this.drawPopups(ctx, engine, camX, camY);

    // Subtle Mini-Radar in top-right corner of 3D stage
    this.drawMiniRadar(ctx, engine);

    if (engine.phase === 'READY') {
      this.drawBanner(ctx, `${theme.name.toUpperCase()} — READY!`, '#FDE047', 'rgba(253, 224, 71, 0.75)');
    } else if (engine.phase === 'STAGE_CLEAR') {
      this.drawBanner(ctx, 'WORLD CLEARED!', '#4ADE80', 'rgba(74, 222, 128, 0.8)');
    }

    if (visualStyle === 'crt') {
      this.drawCrtOverlay(ctx, w, h);
    }

    ctx.restore();
  }

  private drawFloor(
    ctx: CanvasRenderingContext2D,
    engine: PacManiaEngine,
    camX: number,
    camY: number,
    theme: PacManiaWorldTheme
  ): void {
    const minRow = Math.max(0, Math.floor(camY - 11));
    const maxRow = Math.min(PM_GRID_ROWS - 1, Math.ceil(camY + 11));
    const minCol = Math.max(0, Math.floor(camX - 10));
    const maxCol = Math.min(PM_GRID_COLS - 1, Math.ceil(camX + 10));

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const p0 = this.project(c, r, 0, camX, camY);
        const p1 = this.project(c + 1, r, 0, camX, camY);
        const p2 = this.project(c + 1, r + 1, 0, camX, camY);
        const p3 = this.project(c, r + 1, 0, camX, camY);

        const isHouse = engine.grid[r][c] === 'G';
        const checker = (r + c) % 2 === 0;
        ctx.fillStyle = isHouse
          ? '#0F172A'
          : checker
            ? theme.floorA
            : theme.floorB;

        ctx.beginPath();
        ctx.moveTo(p0.sx, p0.sy);
        ctx.lineTo(p1.sx, p1.sy);
        ctx.lineTo(p2.sx, p2.sy);
        ctx.lineTo(p3.sx, p3.sy);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = isHouse ? 'rgba(255,255,255,0.08)' : `${theme.floorBorder}40`;
        ctx.lineWidth = 0.75;
        ctx.stroke();
      }
    }
  }

  private draw3DBlock(
    ctx: CanvasRenderingContext2D,
    c: number,
    r: number,
    camX: number,
    camY: number,
    theme: PacManiaWorldTheme,
    flashWhite: boolean
  ): void {
    const colorIdx = Math.abs(Math.floor(c / 2) + Math.floor(r / 2)) % theme.blockTopColors.length;
    const topColor = flashWhite ? '#FFFFFF' : theme.blockTopColors[colorIdx];
    const frontColor = flashWhite ? '#CBD5E1' : theme.blockFrontColors[colorIdx];
    const sideColor = flashWhite ? '#94A3B8' : theme.blockSideColors[colorIdx];

    const pad = 0.04;
    // Base footprint corners
    const bTL = this.project(c + pad, r + pad, 0, camX, camY);
    const bTR = this.project(c + 1 - pad, r + pad, 0, camX, camY);
    const bBR = this.project(c + 1 - pad, r + 1 - pad, 0, camX, camY);
    const bBL = this.project(c + pad, r + 1 - pad, 0, camX, camY);

    // Top extruded face corners
    const tTL = { sx: bTL.sx, sy: bTL.sy - WALL_H };
    const tTR = { sx: bTR.sx, sy: bTR.sy - WALL_H };
    const tBR = { sx: bBR.sx, sy: bBR.sy - WALL_H };
    const tBL = { sx: bBL.sx, sy: bBL.sy - WALL_H };

    // Soft cast shadow on floor
    ctx.fillStyle = 'rgba(2, 6, 23, 0.24)';
    ctx.beginPath();
    ctx.moveTo(bBL.sx + 7, bBL.sy + 5);
    ctx.lineTo(bBR.sx + 7, bBR.sy + 5);
    ctx.lineTo(bTR.sx + 7, bTR.sy + 5);
    ctx.lineTo(bTL.sx + 7, bTL.sy + 5);
    ctx.closePath();
    ctx.fill();

    // Right side face (visible because SKEW_X is negative!)
    ctx.fillStyle = sideColor;
    ctx.beginPath();
    ctx.moveTo(tTR.sx, tTR.sy);
    ctx.lineTo(tBR.sx, tBR.sy);
    ctx.lineTo(bBR.sx, bBR.sy);
    ctx.lineTo(bTR.sx, bTR.sy);
    ctx.closePath();
    ctx.fill();

    // Front face
    ctx.fillStyle = frontColor;
    ctx.beginPath();
    ctx.moveTo(tBL.sx, tBL.sy);
    ctx.lineTo(tBR.sx, tBR.sy);
    ctx.lineTo(bBR.sx, bBR.sy);
    ctx.lineTo(bBL.sx, bBL.sy);
    ctx.closePath();
    ctx.fill();

    // Top face
    ctx.fillStyle = topColor;
    ctx.beginPath();
    ctx.moveTo(tTL.sx, tTL.sy);
    ctx.lineTo(tTR.sx, tTR.sy);
    ctx.lineTo(tBR.sx, tBR.sy);
    ctx.lineTo(tBL.sx, tBL.sy);
    ctx.closePath();
    ctx.fill();

    // Crisp specular edge highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tBL.sx, tBL.sy);
    ctx.lineTo(tTL.sx, tTL.sy);
    ctx.lineTo(tTR.sx, tTR.sy);
    ctx.stroke();

    // World-specific 3D surface detailing!
    if (theme.style === 'lego' && !flashWhite) {
      // Iconic 1987 Block Town Lego Studs (2x2 glossy cylinders on top of each brick!)
      const offsets = [
        [0.32, 0.32],
        [0.68, 0.32],
        [0.32, 0.68],
        [0.68, 0.68],
      ];
      for (const [ox, oy] of offsets) {
        const sp = this.project(c + ox, r + oy, 0, camX, camY);
        const studY = sp.sy - WALL_H;
        // Stud side cylinder
        ctx.fillStyle = frontColor;
        ctx.beginPath();
        ctx.ellipse(sp.sx, studY, 6.2, 3.8, 0, 0, Math.PI * 2);
        ctx.fill();
        // Stud top cap
        ctx.fillStyle = topColor;
        ctx.beginPath();
        ctx.ellipse(sp.sx, studY - 3.5, 6.2, 3.6, 0, 0, Math.PI * 2);
        ctx.fill();
        // Specular glint
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.beginPath();
        ctx.ellipse(sp.sx - 1.6, studY - 4.4, 2.2, 1.1, -0.2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (theme.style === 'jungle' && !flashWhite) {
      // Stepped inner temple cap
      const mid = this.project(c + 0.5, r + 0.5, 0, camX, camY);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.beginPath();
      ctx.ellipse(mid.sx, mid.sy - WALL_H, 12, 7.5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (theme.style === 'sandbox' && !flashWhite) {
      // Beveled sandstone capstone
      const mid = this.project(c + 0.5, r + 0.5, 0, camX, camY);
      ctx.strokeStyle = 'rgba(255, 248, 220, 0.35)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(mid.sx - 10, mid.sy - WALL_H);
      ctx.lineTo(mid.sx, mid.sy - WALL_H - 6);
      ctx.lineTo(mid.sx + 10, mid.sy - WALL_H);
      ctx.lineTo(mid.sx, mid.sy - WALL_H + 6);
      ctx.closePath();
      ctx.stroke();
    }
  }

  private drawGhostGate(
    ctx: CanvasRenderingContext2D,
    c: number,
    r: number,
    camX: number,
    camY: number,
    theme: PacManiaWorldTheme
  ): void {
    const pL = this.project(c, r + 0.5, 0, camX, camY);
    const pR = this.project(c + 1, r + 0.5, 0, camX, camY);
    ctx.save();
    ctx.strokeStyle = theme.gateColor;
    ctx.lineWidth = 5;
    ctx.shadowColor = theme.gateColor;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(pL.sx, pL.sy - 8);
    ctx.lineTo(pR.sx, pR.sy - 8);
    ctx.stroke();
    ctx.restore();
  }

  private draw3DPellet(
    ctx: CanvasRenderingContext2D,
    gx: number,
    gy: number,
    camX: number,
    camY: number,
    theme: PacManiaWorldTheme,
    isPower: boolean,
    elapsed: number
  ): void {
    const ground = this.project(gx, gy, 0, camX, camY);
    const hover = isPower ? 7 + Math.sin(elapsed * 7) * 2.5 : 4;
    const r = isPower ? 10.5 + Math.sin(elapsed * 7) * 1.6 : 5.2;

    // Ground shadow
    ctx.fillStyle = 'rgba(2, 6, 23, 0.28)';
    ctx.beginPath();
    ctx.ellipse(ground.sx, ground.sy + 1, r * 0.9, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3D glossy sphere
    ctx.save();
    if (isPower) {
      ctx.shadowColor = 'rgba(255, 240, 160, 0.9)';
      ctx.shadowBlur = 16;
    }
    const cy = ground.sy - hover;
    const grad = ctx.createRadialGradient(ground.sx - r * 0.3, cy - r * 0.35, 1, ground.sx, cy, r);
    grad.addColorStop(0, '#FFFFFF');
    grad.addColorStop(0.45, theme.pelletColor);
    grad.addColorStop(1, '#D97706');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ground.sx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawSpecialPellet(
    ctx: CanvasRenderingContext2D,
    gx: number,
    gy: number,
    type: 'green_speed' | 'red_double',
    camX: number,
    camY: number,
    elapsed: number
  ): void {
    const ground = this.project(gx, gy, 0, camX, camY);
    const hover = 10 + Math.sin(elapsed * 8) * 3.5;
    const r = 12;
    const isGreen = type === 'green_speed';

    ctx.fillStyle = 'rgba(2, 6, 23, 0.35)';
    ctx.beginPath();
    ctx.ellipse(ground.sx, ground.sy + 1, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    const cy = ground.sy - hover;
    ctx.shadowColor = isGreen ? 'rgba(74, 222, 128, 0.95)' : 'rgba(251, 113, 133, 0.95)';
    ctx.shadowBlur = 18;
    const grad = ctx.createRadialGradient(ground.sx - 3, cy - 4, 1, ground.sx, cy, r);
    grad.addColorStop(0, '#FFFFFF');
    grad.addColorStop(0.45, isGreen ? '#4ADE80' : '#FB7185');
    grad.addColorStop(1, isGreen ? '#15803D' : '#BE123C');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ground.sx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private draw3DPlayer(
    ctx: CanvasRenderingContext2D,
    engine: PacManiaEngine,
    camX: number,
    camY: number
  ): void {
    const p = engine.player;
    const ground = this.project(p.x, p.y, 0, camX, camY);
    const air = this.project(p.x, p.y, p.z, camX, camY);
    const r = 18.5;

    // Ground drop shadow (shrinks & fades gracefully with jump height!)
    const shadowScale = Math.max(0.45, 1 - p.z * 0.32);
    ctx.fillStyle = `rgba(2, 6, 23, ${Math.max(0.16, 0.42 - p.z * 0.14)})`;
    ctx.beginPath();
    ctx.ellipse(ground.sx, ground.sy + 3, r * 0.95 * shadowScale, r * 0.48 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(air.sx, air.sy - r * 0.72);

    if (engine.phase === 'DYING') {
      const prog = p.deathProgress;
      const openAngle = Math.min(Math.PI, 0.25 + prog * Math.PI * 1.1);
      if (prog < 0.88) {
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = '#FFD829';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, r * (1 - prog * 0.2), openAngle, Math.PI * 2 - openAngle);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      return;
    }

    // Speed Boost aura ring
    if (engine.speedBoostRemaining > 0) {
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.75)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Glossy 3D spherical Pac-Man body
    const grad = ctx.createRadialGradient(-r * 0.32, -r * 0.36, 2, 0, 0, r * 1.05);
    grad.addColorStop(0, '#FFFAC2');
    grad.addColorStop(0.5, '#FFD829');
    grad.addColorStop(1, '#D97706');

    const mouthOpen = p.moving ? 0.1 + Math.abs(Math.sin(p.mouthPhase)) * 0.65 : 0.3;
    const faceAngle =
      p.facing === 'RIGHT'
        ? 0.08
        : p.facing === 'LEFT'
          ? Math.PI - 0.08
          : p.facing === 'DOWN'
            ? Math.PI * 0.5
            : -Math.PI * 0.5;

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, faceAngle + mouthOpen, faceAngle + Math.PI * 2 - mouthOpen);
    ctx.closePath();
    ctx.fill();

    // Inner dark mouth cavity for 3D depth
    if (mouthOpen > 0.14) {
      ctx.fillStyle = '#7C2D12';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r * 0.72, faceAngle - mouthOpen * 0.65, faceAngle + mouthOpen * 0.65);
      ctx.closePath();
      ctx.fill();
    }

    // Expressive Pac-Mania 3D eyes!
    if (p.facing !== 'UP') {
      const eyeOffsetX = p.facing === 'LEFT' ? -4 : p.facing === 'RIGHT' ? 4 : 0;
      const eyeY = -r * 0.35;
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.ellipse(eyeOffsetX - 3.5, eyeY, 2.3, 3.2, 0, 0, Math.PI * 2);
      ctx.ellipse(eyeOffsetX + 3.5, eyeY, 2.3, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(eyeOffsetX - 4.1, eyeY - 1.1, 0.9, 0, Math.PI * 2);
      ctx.arc(eyeOffsetX + 2.9, eyeY - 1.1, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private draw3DGhost(
    ctx: CanvasRenderingContext2D,
    g: PacManiaGhostState,
    engine: PacManiaEngine,
    camX: number,
    camY: number
  ): void {
    const ground = this.project(g.x, g.y, 0, camX, camY);
    const air = this.project(g.x, g.y, g.z, camX, camY);
    const r = 17.5;

    const isFrightened = g.mode === 'FRIGHTENED';
    const isEyes = g.mode === 'EATEN' || g.mode === 'ENTERING_HOUSE';
    const flash =
      isFrightened &&
      engine.frightenedRemaining < 2.2 &&
      Math.floor(engine.elapsed * 9) % 2 === 0;

    // Ground shadow
    const shadowScale = Math.max(0.45, 1 - g.z * 0.32);
    ctx.fillStyle = `rgba(2, 6, 23, ${Math.max(0.14, 0.38 - g.z * 0.14)})`;
    ctx.beginPath();
    ctx.ellipse(ground.sx, ground.sy + 3, r * 0.95 * shadowScale, r * 0.45 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(air.sx, air.sy - r * 0.78);

    if (!isEyes) {
      const grad = ctx.createRadialGradient(-r * 0.32, -r * 0.38, 2, 0, 0, r * 1.25);
      if (isFrightened) {
        grad.addColorStop(0, flash ? '#FFFFFF' : '#60A5FA');
        grad.addColorStop(1, flash ? '#CBD5E1' : '#1E3A8A');
      } else {
        grad.addColorStop(0, g.accentColor);
        grad.addColorStop(0.55, g.color);
        grad.addColorStop(1, '#0F172A');
      }

      ctx.fillStyle = grad;
      const bottomY = r * 0.96;
      ctx.beginPath();
      ctx.arc(0, -r * 0.1, r, Math.PI, 0, false);
      ctx.lineTo(r, bottomY);
      const wave = Math.sin(g.animPhase) * 2.5;
      const segW = (r * 2) / 3;
      for (let i = 0; i < 3; i++) {
        const sx = r - i * segW;
        const ex = sx - segW;
        const midX = (sx + ex) * 0.5;
        const peakY = bottomY - 5 + (i % 2 === 0 ? wave : -wave);
        ctx.quadraticCurveTo(midX, peakY, ex, bottomY);
      }
      ctx.closePath();
      ctx.fill();
    }

    // Eyes
    if (isFrightened && !isEyes) {
      const faceColor = flash ? '#EF4444' : '#FEF08A';
      ctx.fillStyle = faceColor;
      ctx.beginPath();
      ctx.arc(-5.5, -2.5, 2.5, 0, Math.PI * 2);
      ctx.arc(5.5, -2.5, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = faceColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-8, 5);
      ctx.lineTo(-4, 2.5);
      ctx.lineTo(0, 5);
      ctx.lineTo(4, 2.5);
      ctx.lineTo(8, 5);
      ctx.stroke();
    } else {
      const lookX = g.dir === 'LEFT' ? -2.4 : g.dir === 'RIGHT' ? 2.4 : 0;
      const lookY = g.dir === 'UP' ? -2.2 : g.dir === 'DOWN' ? 2.2 : 0;
      for (const side of [-1, 1]) {
        const ex = side * 6;
        const ey = -3;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.ellipse(ex, ey, 4.4, 5.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1E3A8A';
        ctx.beginPath();
        ctx.arc(ex + lookX, ey + lookY, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  private drawParticles(
    ctx: CanvasRenderingContext2D,
    engine: PacManiaEngine,
    camX: number,
    camY: number
  ): void {
    for (const pt of engine.particles) {
      const alpha = Math.max(0, pt.life / pt.maxLife);
      const pos = this.project(pt.x, pt.y, 0.3, camX, camY);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pos.sx, pos.sy, pt.radius * (0.4 + alpha * 0.7), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawPopups(
    ctx: CanvasRenderingContext2D,
    engine: PacManiaEngine,
    camX: number,
    camY: number
  ): void {
    for (const pop of engine.popups) {
      const alpha = Math.min(1, (pop.life / pop.maxLife) * 1.6);
      const pos = this.project(pop.x, pop.y, 1.1, camX, camY);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '800 14px var(--font-mono), monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#020617';
      ctx.fillText(pop.text, pos.sx + 1.5, pos.sy + 1.5);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pos.sx, pos.sy);
      ctx.restore();
    }
  }

  private drawMiniRadar(ctx: CanvasRenderingContext2D, engine: PacManiaEngine): void {
    const cell = 4.2;
    const mapW = PM_GRID_COLS * cell;
    const mapH = PM_GRID_ROWS * cell;
    const ox = PM_VIEWPORT_WIDTH - mapW - 14;
    const oy = 14;

    ctx.save();
    ctx.fillStyle = 'rgba(6, 9, 20, 0.76)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(ox - 5, oy - 5, mapW + 10, mapH + 10, 8);
    ctx.fill();
    ctx.stroke();

    for (let r = 0; r < PM_GRID_ROWS; r++) {
      for (let c = 0; c < PM_GRID_COLS; c++) {
        const ch = engine.grid[r][c];
        if (ch === '#') {
          ctx.fillStyle = `${engine.world.theme.accentHex}70`;
          ctx.fillRect(ox + c * cell, oy + r * cell, cell - 0.4, cell - 0.4);
        } else if (ch === 'o') {
          ctx.fillStyle = '#FEF08A';
          ctx.fillRect(ox + c * cell + 0.8, oy + r * cell + 0.8, 2.6, 2.6);
        } else if (ch === '.') {
          ctx.fillStyle = 'rgba(255,255,255,0.45)';
          ctx.fillRect(ox + c * cell + 1.5, oy + r * cell + 1.5, 1.2, 1.2);
        }
      }
    }

    // Ghosts on radar
    for (const g of engine.ghosts) {
      if (g.mode === 'IN_HOUSE') continue;
      ctx.fillStyle = g.mode === 'FRIGHTENED' ? '#38BDF8' : g.color;
      ctx.beginPath();
      ctx.arc(ox + g.x * cell, oy + g.y * cell, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player on radar
    ctx.fillStyle = '#FFD829';
    ctx.beginPath();
    ctx.arc(ox + engine.player.x * cell, oy + engine.player.y * cell, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawBanner(ctx: CanvasRenderingContext2D, text: string, color: string, glow: string): void {
    ctx.save();
    ctx.font = '800 24px var(--font-outfit), sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = glow;
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#020617';
    ctx.fillText(text, PM_VIEWPORT_WIDTH * 0.5 + 2, PM_VIEWPORT_HEIGHT * 0.5 + 2);
    ctx.fillStyle = color;
    ctx.fillText(text, PM_VIEWPORT_WIDTH * 0.5, PM_VIEWPORT_HEIGHT * 0.5);
    ctx.restore();
  }

  private drawCrtOverlay(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
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
    vig.addColorStop(1, 'rgba(0, 0, 0, 0.42)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}

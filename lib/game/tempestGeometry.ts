// Shared 3D Tube Web Geometry, Cell-Space Kinematics & Melt-O-Vision Feedback Engine
// Used independently by Tempest (1981), Tempest 2000 (1994), and Tempest 3000 (2000).

export interface TubeVertex {
  x: number;
  y: number;
}

export interface TubeWebDef {
  name: string;
  closed: boolean;
  vertices: TubeVertex[];
  classicColor: string;
  accentHue: number;
}

export interface Camera3DState {
  cx: number;
  cy: number;
  rimRadius: number;
  fovDepth: number; // Higher = deeper tunnel foreshortening
  yaw: number; // Subtle horizontal 3D perspective shift (-1..1)
  pitch: number; // Subtle vertical 3D perspective shift (-1..1)
  roll: number; // 3D tube roll rotation in radians
  twistPerZ: number; // Subtle 3D corkscrew twist along depth (T3K)
  breatheAmp: number; // Subtle 3D web pulse amplitude (T3K)
  breathePhase: number;
  warpZoom: number; // Forward fly-through zoom during stage warp
}

export interface ProjectedPoint {
  x: number;
  y: number;
  scale: number;
  effZ: number;
}

export interface CellFrame {
  x: number;
  y: number;
  leftX: number;
  leftY: number;
  rightX: number;
  rightY: number;
  tangentAngle: number; // Angle along the cell rim from left rail to right rail
  inwardAngle: number; // Angle pointing inward toward the pit
  width: number;
  scale: number;
}

export function createDefaultCamera(cx: number, cy: number, rimRadius = 294, fovDepth = 3.75): Camera3DState {
  return {
    cx,
    cy,
    rimRadius,
    fovDepth,
    yaw: 0,
    pitch: 0,
    roll: 0,
    twistPerZ: 0,
    breatheAmp: 0,
    breathePhase: 0,
    warpZoom: 0,
  };
}

export function projectTubePoint(
  vx: number,
  vy: number,
  z: number,
  cam: Camera3DState,
  radialLift = 0
): ProjectedPoint {
  const effZ = Math.max(-0.62, z - cam.warpZoom);
  const scale = 1 / (1 + effZ * cam.fovDepth);

  // Apply 3D roll + optional depth twist (for Tempest 3000 morphing prism tubes)
  const rot = cam.roll + effZ * cam.twistPerZ;
  const cosR = Math.cos(rot);
  const sinR = Math.sin(rot);
  let rx = vx * cosR - vy * sinR;
  let ry = vx * sinR + vy * cosR;

  // Optional breathing radial undulation in Tempest 3000
  if (cam.breatheAmp > 0) {
    const wave = 1 + Math.sin(cam.breathePhase + effZ * 4.2 + Math.atan2(ry, rx) * 2) * cam.breatheAmp * (0.25 + effZ * 0.75);
    rx *= wave;
    ry *= wave;
  }

  // Lift off the rim (Jump Thruster in T2K/T3K moves outward toward viewer)
  const liftScale = 1 + radialLift * 0.22;

  // 3D Camera parallax: rim shifts slightly opposite to pit so web tilts genuinely in 3D!
  const parallaxNear = 1 - scale;
  const panX = cam.yaw * 78 * parallaxNear - cam.yaw * 22 * scale;
  const panY = cam.pitch * 68 * parallaxNear - cam.pitch * 18 * scale;

  return {
    x: cam.cx + rx * cam.rimRadius * scale * liftScale + panX,
    y: cam.cy + ry * cam.rimRadius * scale * liftScale + panY - effZ * 10,
    scale,
    effZ,
  };
}

export function getLaneCount(tube: TubeWebDef): number {
  return tube.closed ? tube.vertices.length : tube.vertices.length - 1;
}

export function wrapLaneIndex(tube: TubeWebDef, lane: number): number {
  const count = getLaneCount(tube);
  if (tube.closed) {
    let r = lane % count;
    if (r < 0) r += count;
    return r;
  }
  return Math.max(0, Math.min(count - 1, lane));
}

export function wrapContinuousLanePos(tube: TubeWebDef, pos: number): number {
  const count = getLaneCount(tube);
  if (tube.closed) {
    let r = pos % count;
    if (r < 0) r += count;
    return r;
  }
  return Math.max(0.06, Math.min(count - 0.06, pos));
}

export function shortestLaneStep(tube: TubeWebDef, fromLane: number, toLane: number): 1 | -1 {
  const count = getLaneCount(tube);
  if (!tube.closed) return toLane >= fromLane ? 1 : -1;
  const cw = (toLane - fromLane + count) % count;
  const ccw = (fromLane - toLane + count) % count;
  return cw <= ccw ? 1 : -1;
}

/**
 * Projects an exact 3D point inside a specific cell:
 * - laneIdx: 0..laneCount-1
 * - u: 0.0 = left rail vertex, 0.5 = cell center, 1.0 = right rail vertex
 * - z: 0.0 = outer rim, 1.0 = deep pit
 */
export function projectCellFrame(
  tube: TubeWebDef,
  laneIdx: number,
  u: number,
  z: number,
  cam: Camera3DState,
  radialLift = 0
): CellFrame {
  const count = getLaneCount(tube);
  const safeLane = wrapLaneIndex(tube, laneIdx);
  const v0 = tube.vertices[safeLane];
  const v1 = tube.vertices[(safeLane + 1) % tube.vertices.length];

  const p0 = projectTubePoint(v0.x, v0.y, z, cam, radialLift);
  const p1 = projectTubePoint(v1.x, v1.y, z, cam, radialLift);

  // Also sample slightly deeper in the same cell along the exact same u-line so inwardAngle points true 3D down-lane!
  const vx = v0.x + (v1.x - v0.x) * u;
  const vy = v0.y + (v1.y - v0.y) * u;
  const pHere = projectTubePoint(vx, vy, z, cam, radialLift);
  const pDeep = projectTubePoint(vx, vy, Math.min(1.15, z + 0.14), cam, radialLift * 0.65);

  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const width = Math.max(4, Math.hypot(dx, dy));
  const tangentAngle = Math.atan2(dy, dx);
  const inwardAngle = Math.atan2(pDeep.y - pHere.y, pDeep.x - pHere.x);

  return {
    x: pHere.x,
    y: pHere.y,
    leftX: p0.x,
    leftY: p0.y,
    rightX: p1.x,
    rightY: p1.y,
    tangentAngle,
    inwardAngle,
    width,
    scale: pHere.scale,
  };
}

/**
 * Maps a screen-space mouse/pointer position onto a continuous floating-point lanePos
 * by projecting onto the closest rim segment across all cells (authentic arcade spinner feel!).
 */
export function mapPointerToLanePos(
  tube: TubeWebDef,
  px: number,
  py: number,
  cam: Camera3DState,
  fallbackPos: number
): number {
  const count = getLaneCount(tube);
  let bestDistSq = Infinity;
  let bestPos = fallbackPos;

  for (let i = 0; i < count; i++) {
    const v0 = tube.vertices[i];
    const v1 = tube.vertices[(i + 1) % tube.vertices.length];
    const p0 = projectTubePoint(v0.x, v0.y, 0, cam);
    const p1 = projectTubePoint(v1.x, v1.y, 0, cam);
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const lenSq = dx * dx + dy * dy;
    let t = 0.5;
    if (lenSq > 0.001) {
      t = Math.max(0.05, Math.min(0.95, ((px - p0.x) * dx + (py - p0.y) * dy) / lenSq));
    }
    const cx = p0.x + dx * t;
    const cy = p0.y + dy * t;
    const distSq = (px - cx) * (px - cx) + (py - cy) * (py - cy);
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestPos = i + t;
    }
  }
  return wrapContinuousLanePos(tube, bestPos);
}

/**
 * Checks whether a shot at (shotLane, shotU) hits an enemy at (enemyLane, enemyU),
 * handling BOTH center-cell targets AND side-rail targets shared between adjacent cells!
 */
export function matchesCellFiringSolution(
  tube: TubeWebDef,
  shotLane: number,
  shotU: number,
  enemyLane: number,
  enemyU: number,
  toleranceU = 0.34
): boolean {
  const count = getLaneCount(tube);
  if (shotLane === enemyLane && Math.abs(shotU - enemyU) <= toleranceU) {
    return true;
  }
  // Check shared side-rail wrap (e.g., shot near right rail of lane L hits enemy on left rail of lane L+1)
  const nextLane = tube.closed ? (shotLane + 1) % count : shotLane + 1;
  if (nextLane === enemyLane) {
    const distAcrossRightRail = (1 - shotU) + enemyU;
    if (distAcrossRightRail <= toleranceU) return true;
  }
  const prevLane = tube.closed ? (shotLane - 1 + count) % count : shotLane - 1;
  if (prevLane === enemyLane) {
    const distAcrossLeftRail = shotU + (1 - enemyU);
    if (distAcrossLeftRail <= toleranceU) return true;
  }
  return false;
}

/**
 * Returns the 16 authentic 1981 Atari Tempest web topologies!
 */
export function buildClassic1981Webs(): TubeWebDef[] {
  const circle = (n: number, rx = 1, ry = 1): TubeVertex[] => {
    const pts: TubeVertex[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.PI * 0.5;
      pts.push({ x: Math.cos(a) * rx, y: Math.sin(a) * ry });
    }
    return pts;
  };

  const square: TubeVertex[] = [];
  for (let i = 0; i < 4; i++) square.push({ x: -1 + i * 0.5, y: 1 });
  for (let i = 0; i < 4; i++) square.push({ x: 1, y: 1 - i * 0.5 });
  for (let i = 0; i < 4; i++) square.push({ x: 1 - i * 0.5, y: -1 });
  for (let i = 0; i < 4; i++) square.push({ x: -1, y: -1 + i * 0.5 });

  const plus: TubeVertex[] = [
    { x: -0.38, y: 1.0 },
    { x: 0.0, y: 1.0 },
    { x: 0.38, y: 1.0 },
    { x: 0.38, y: 0.38 },
    { x: 1.0, y: 0.38 },
    { x: 1.0, y: 0.0 },
    { x: 1.0, y: -0.38 },
    { x: 0.38, y: -0.38 },
    { x: 0.38, y: -1.0 },
    { x: 0.0, y: -1.0 },
    { x: -0.38, y: -1.0 },
    { x: -0.38, y: -0.38 },
    { x: -1.0, y: -0.38 },
    { x: -1.0, y: 0.0 },
    { x: -1.0, y: 0.38 },
    { x: -0.38, y: 0.38 },
  ];

  const bowtie: TubeVertex[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = 0.68 + 0.38 * Math.abs(Math.cos(a));
    bowtie.push({ x: Math.cos(a) * r * 1.08, y: Math.sin(a) * r * 0.85 });
  }

  const cross: TubeVertex[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + Math.PI * 0.25;
    const r = i % 4 === 0 ? 1.08 : i % 2 === 0 ? 0.56 : 0.84;
    cross.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }

  const triVerts = [
    { x: 0, y: -1.06 },
    { x: 1.06, y: 0.84 },
    { x: -1.06, y: 0.84 },
  ];
  const triangle: TubeVertex[] = [];
  for (let s = 0; s < 3; s++) {
    const a = triVerts[s];
    const b = triVerts[(s + 1) % 3];
    for (let k = 0; k < 5; k++) {
      const f = k / 5;
      triangle.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
    }
  }

  const clover: TubeVertex[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + Math.PI * 0.5;
    const r = 0.78 + 0.28 * Math.cos(a * 4);
    clover.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }

  const vOpen: TubeVertex[] = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    vOpen.push({ x: -1.16 + t * 2.32, y: -0.35 + (1 - Math.abs(t - 0.5) * 2) * 1.18 });
  }

  const steps: TubeVertex[] = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const x = -1.14 + t * 2.28;
    const step = Math.floor(Math.abs(t - 0.5) * 6) * 0.22;
    steps.push({ x, y: 0.78 - step });
  }

  const uOpen: TubeVertex[] = [];
  for (let i = 0; i <= 14; i++) {
    const a = Math.PI - (i / 14) * Math.PI;
    uOpen.push({ x: Math.cos(a) * 1.08, y: Math.sin(a) * 0.96 - 0.15 });
  }

  const flatOpen: TubeVertex[] = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    flatOpen.push({ x: -1.18 + t * 2.36, y: 0.74 });
  }

  const heart: TubeVertex[] = [];
  for (let i = 0; i < 16; i++) {
    const t = (i / 16) * Math.PI * 2;
    const hx = 16 * Math.pow(Math.sin(t), 3);
    const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    heart.push({ x: hx / 16, y: hy / 16 });
  }

  const star: TubeVertex[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + Math.PI * 0.5;
    const r = i % 2 === 0 ? 1.08 : 0.6;
    star.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }

  const wOpen: TubeVertex[] = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const x = -1.16 + t * 2.32;
    const y = 0.25 + Math.cos(t * Math.PI * 3) * 0.55;
    wOpen.push({ x, y });
  }

  const fig8: TubeVertex[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = 0.65 + 0.42 * Math.abs(Math.sin(a));
    fig8.push({ x: Math.cos(a) * r * 0.85, y: Math.sin(a) * r * 1.06 });
  }

  const infinity: TubeVertex[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = 0.58 + 0.48 * Math.pow(Math.cos(a), 2);
    infinity.push({ x: Math.cos(a) * r * 1.12, y: Math.sin(a) * r * 0.78 });
  }

  return [
    { name: 'Circle Web', closed: true, vertices: circle(16, 1.0, 1.0), classicColor: '#3B82F6', accentHue: 220 },
    { name: 'Square Shaft', closed: true, vertices: square, classicColor: '#3B82F6', accentHue: 205 },
    { name: 'Plus Grid', closed: true, vertices: plus, classicColor: '#3B82F6', accentHue: 255 },
    { name: 'Bowtie', closed: true, vertices: bowtie, classicColor: '#3B82F6', accentHue: 310 },
    { name: 'Cross Vortex', closed: true, vertices: cross, classicColor: '#3B82F6', accentHue: 185 },
    { name: 'Triangle', closed: true, vertices: triangle, classicColor: '#3B82F6', accentHue: 280 },
    { name: 'Clover', closed: true, vertices: clover, classicColor: '#3B82F6', accentHue: 330 },
    { name: 'V-Canyon', closed: false, vertices: vOpen, classicColor: '#3B82F6', accentHue: 145 },
    { name: 'Stairwell', closed: false, vertices: steps, classicColor: '#3B82F6', accentHue: 45 },
    { name: 'U-Trough', closed: false, vertices: uOpen, classicColor: '#3B82F6', accentHue: 195 },
    { name: 'Flat Horizon', closed: false, vertices: flatOpen, classicColor: '#3B82F6', accentHue: 16 },
    { name: 'Heart Matrix', closed: true, vertices: heart, classicColor: '#3B82F6', accentHue: 345 },
    { name: 'Star Burst', closed: true, vertices: star, classicColor: '#3B82F6', accentHue: 52 },
    { name: 'W-Ridge', closed: false, vertices: wOpen, classicColor: '#3B82F6', accentHue: 120 },
    { name: 'Figure-8', closed: true, vertices: fig8, classicColor: '#3B82F6', accentHue: 268 },
    { name: 'Infinity Loop', closed: true, vertices: infinity, classicColor: '#3B82F6', accentHue: 174 },
  ];
}

/**
 * Extended surreal organic & faceted webs for Tempest 2000 & Tempest 3000!
 */
export function buildNuonPrismWebs(): TubeWebDef[] {
  const base = buildClassic1981Webs();

  const lotus: TubeVertex[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + Math.PI * 0.5;
    const r = 0.78 + 0.3 * Math.sin(a * 5);
    lotus.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }

  const butterfly: TubeVertex[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = 0.66 + 0.38 * Math.abs(Math.sin(a * 2)) + 0.12 * Math.cos(a * 4);
    butterfly.push({ x: Math.cos(a) * r * 1.05, y: Math.sin(a) * r * 0.94 });
  }

  const sineValley: TubeVertex[] = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    sineValley.push({ x: -1.16 + t * 2.32, y: 0.34 + Math.sin(t * Math.PI * 2.5 - 0.8) * 0.56 });
  }

  const prismOcta: TubeVertex[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + Math.PI / 16;
    const r = i % 2 === 0 ? 1.04 : 0.86;
    prismOcta.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }

  return [
    { name: 'Prism Octahedron', closed: true, vertices: prismOcta, classicColor: '#22D3EE', accentHue: 192 },
    { name: 'Lotus Vortex', closed: true, vertices: lotus, classicColor: '#F472B6', accentHue: 318 },
    { name: 'Butterfly Wing', closed: true, vertices: butterfly, classicColor: '#A855F7', accentHue: 274 },
    { name: 'Harmonic Valley', closed: false, vertices: sineValley, classicColor: '#34D399', accentHue: 156 },
    ...base.slice(0, 12),
  ];
}

/**
 * Offscreen Melt-O-Vision Feedback Buffer Engine (Llamasoft Jaguar T2K & Nuon VLM-2 T3K).
 * Safely manages two tiny offscreen canvases to produce real liquid-neon zoom/melt/prism trails!
 */
export class MeltOVisionBuffer {
  private bufA: HTMLCanvasElement | null = null;
  private ctxA: CanvasRenderingContext2D | null = null;
  private bufB: HTMLCanvasElement | null = null;
  private ctxB: CanvasRenderingContext2D | null = null;
  public readonly width: number;
  public readonly height: number;

  constructor(width = 380, height = 380) {
    this.width = width;
    this.height = height;
  }

  private ensureBuffers(): boolean {
    if (typeof document === 'undefined') return false;
    if (!this.bufA) {
      this.bufA = document.createElement('canvas');
      this.bufA.width = this.width;
      this.bufA.height = this.height;
      this.ctxA = this.bufA.getContext('2d');
      this.bufB = document.createElement('canvas');
      this.bufB.width = this.width;
      this.bufB.height = this.height;
      this.ctxB = this.bufB.getContext('2d');
    }
    return Boolean(this.ctxA && this.ctxB);
  }

  public clear(): void {
    if (!this.ensureBuffers() || !this.ctxA || !this.ctxB) return;
    this.ctxA.clearRect(0, 0, this.width, this.height);
    this.ctxB.clearRect(0, 0, this.width, this.height);
  }

  /**
   * Advances the Melt-O-Vision feedback smear one frame:
   * - Jaguar T2K mode: outward zoom smear + gentle gravity drip + warm/cool melt trails
   * - Nuon T3K VLM-2 mode: kaleidoscopic radial zoom + spiral prism rotation + vibrant glow feedback
   */
  public stepFeedback(opts: {
    zoom: number;
    rotateRad: number;
    driftX: number;
    driftY: number;
    decay: number;
    tintColor: string;
    tintAlpha: number;
  }): CanvasRenderingContext2D | null {
    if (!this.ensureBuffers() || !this.ctxA || !this.ctxB || !this.bufA || !this.bufB) return null;

    // Copy A -> B with zoom/rotation/melt transform
    this.ctxB.save();
    this.ctxB.globalCompositeOperation = 'source-over';
    this.ctxB.fillStyle = `rgba(2, 3, 12, ${1 - opts.decay})`;
    this.ctxB.fillRect(0, 0, this.width, this.height);

    this.ctxB.globalAlpha = opts.decay;
    this.ctxB.translate(this.width * 0.5 + opts.driftX, this.height * 0.5 + opts.driftY);
    this.ctxB.rotate(opts.rotateRad);
    this.ctxB.scale(opts.zoom, opts.zoom);
    this.ctxB.drawImage(this.bufA, -this.width * 0.5, -this.height * 0.5);
    this.ctxB.restore();

    if (opts.tintAlpha > 0) {
      this.ctxB.save();
      this.ctxB.globalCompositeOperation = 'screen';
      this.ctxB.fillStyle = opts.tintColor;
      this.ctxB.globalAlpha = opts.tintAlpha;
      this.ctxB.fillRect(0, 0, this.width, this.height);
      this.ctxB.restore();
    }

    // Swap buffers so bufA is the active draw surface for new glowing impulses
    const tmpCanvas = this.bufA;
    const tmpCtx = this.ctxA;
    this.bufA = this.bufB;
    this.ctxA = this.ctxB;
    this.bufB = tmpCanvas;
    this.ctxB = tmpCtx;

    return this.ctxA;
  }

  public compositeTo(
    target: CanvasRenderingContext2D,
    logicalW: number,
    logicalH: number,
    alpha = 0.85,
    blendMode: GlobalCompositeOperation = 'lighter'
  ): void {
    if (!this.bufA) return;
    target.save();
    target.globalCompositeOperation = blendMode;
    target.globalAlpha = alpha;
    target.drawImage(this.bufA, 0, 0, logicalW, logicalH);
    target.restore();
  }
}

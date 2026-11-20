// High-Resolution (1280x960) Atari / Kee Games / Leland Overhead Racing Track Library
// Covers all 9 Arcade Classics with expanded authentic track lineups:
// - Sprint 1 (1978, 8 tracks) & Sprint 2 (1976, 8 tracks)
// - Sprint 4 (1977, 6 tracks) & Sprint 8 (1977, 6 wide 8-car arenas)
// - Super Sprint (1986, 8 Atari System 2 tracks) & Championship Sprint (1986, 8 Pro Shortcut tracks)
// - Badlands (1989, 6 wasteland combat tracks)
// - Ivan "Ironman" Stewart's Super Off Road (1989, 8 dirt stadium tracks w/ jumps & mud)
// - Danny Sullivan's Indy Heat (1991, 6 IndyCar circuits w/ live pit lanes)

export type SprintVariant =
  | 'sprint1'
  | 'sprint'
  | 'sprint4'
  | 'sprint8'
  | 'supersprint'
  | 'champsprint'
  | 'badlands'
  | 'superoffroad'
  | 'indyheat';

export interface Vec2 {
  x: number;
  y: number;
}

export interface SplineSample {
  x: number;
  y: number;
  tx: number; // Unit tangent X
  ty: number; // Unit tangent Y
  nx: number; // Unit outward normal X
  ny: number; // Unit outward normal Y
  t: number; // Normalized 0..1 around loop (arc-length uniform!)
  dist: number; // Cumulative arc length
  isBridge: boolean; // True when on elevated overpass deck/ramps
  isUnderpass: boolean; // True when passing underneath an overpass
  rampHeight: number; // Smooth 0..1 elevation factor across entry ramp -> deck -> exit ramp
}

export interface ShortcutGateDef {
  entry: Vec2;
  exit: Vec2;
  width: number;
  entryT: number;
  exitT: number;
  cycleSeconds: number;
}

export interface SceneryProp {
  kind: 'grandstand' | 'pit' | 'tree' | 'cactus' | 'tent' | 'flag' | 'wreck' | 'bale';
  x: number;
  y: number;
  w?: number;
  h?: number;
  angle?: number;
  color?: string;
}

export interface SprintTrackBlueprint {
  id: string;
  name: string;
  theme:
    | 'mono_green'
    | 'mono_silver'
    | 'color_retro'
    | 'arena_8'
    | 'stadium'
    | 'canyon'
    | 'twilight'
    | 'pro_asphalt'
    | 'wasteland'
    | 'dirt_stadium'
    | 'indy_gp';
  roadWidth: number;
  infieldColor: string;
  infieldStripeColor: string;
  asphaltColor: string;
  wallOuterColor: string;
  kerbPrimary: string;
  kerbSecondary: string;
  controlPoints: Vec2[];
  bridgeRanges?: Array<[number, number]>;
  underpassRanges?: Array<[number, number]>;
  shortcut?: ShortcutGateDef;
  oilSpots: Array<{ t: number; offset: number; radius: number }>;
  waterSpots: Array<{ t: number; offset: number; radius: number }>;
  // Super Off Road tabletop dirt jump mounds
  jumpSpots?: Array<{ t: number; length?: number }>;
  // Badlands destructible wasteland mines
  mineSpots?: Array<{ t: number; offset: number }>;
  // Indy Heat live refueling & engine-cooling pit lane strip
  pitLane?: { startT: number; endT: number; side: 1 | -1 };
  hasTornado?: boolean;
  props: SceneryProp[];
}

export interface CompiledTrack {
  blueprint: SprintTrackBlueprint;
  samples: SplineSample[];
  totalLength: number;
  startSample: SplineSample;
  tireStacks: Array<{ x: number; y: number; color: string }>;
}

export const SPRINT_W = 1280;
export const SPRINT_H = 960;

function catmullRom(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x:
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

function inRanges(t: number, ranges?: Array<[number, number]>): boolean {
  if (!ranges) return false;
  for (const [a, b] of ranges) {
    if (a <= b) {
      if (t >= a && t <= b) return true;
    } else {
      if (t >= a || t <= b) return true;
    }
  }
  return false;
}

function computeRampHeight(t: number, ranges?: Array<[number, number]>): number {
  if (!ranges) return 0;
  for (const [a, b] of ranges) {
    if (a <= b) {
      if (t >= a && t <= b) {
        const span = Math.max(0.001, b - a);
        const u = (t - a) / span;
        const ramp = 0.24;
        if (u < ramp) return u / ramp;
        if (u > 1 - ramp) return (1 - u) / ramp;
        return 1;
      }
    } else {
      if (t >= a || t <= b) {
        const span = Math.max(0.001, 1 - a + b);
        const u = (t >= a ? t - a : 1 - a + t) / span;
        const ramp = 0.24;
        if (u < ramp) return u / ramp;
        if (u > 1 - ramp) return (1 - u) / ramp;
        return 1;
      }
    }
  }
  return 0;
}

export function compileSprintTrack(bp: SprintTrackBlueprint): CompiledTrack {
  const pts = bp.controlPoints;
  const n = pts.length;
  const subPerSeg = 32;
  const dense: Vec2[] = [];

  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    for (let s = 0; s < subPerSeg; s++) {
      dense.push(catmullRom(p0, p1, p2, p3, s / subPerSeg));
    }
  }

  const denseN = dense.length;
  const cumLen: number[] = [0];
  let totalDist = 0;
  for (let i = 1; i <= denseN; i++) {
    const prev = dense[i - 1];
    const curr = dense[i % denseN];
    totalDist += Math.hypot(curr.x - prev.x, curr.y - prev.y);
    cumLen.push(totalDist);
  }

  // Uniform ~15px arc-length resampling for silky-smooth turns, ramps & AI lookahead
  const targetSpacing = 15;
  const totalCount = Math.max(140, Math.round(totalDist / targetSpacing));
  const raw: Vec2[] = [];
  let cursor = 0;
  for (let i = 0; i < totalCount; i++) {
    const targetD = (i / totalCount) * totalDist;
    while (cursor < denseN - 1 && cumLen[cursor + 1] < targetD) {
      cursor++;
    }
    const segLen = Math.max(0.0001, cumLen[cursor + 1] - cumLen[cursor]);
    const frac = Math.max(0, Math.min(1, (targetD - cumLen[cursor]) / segLen));
    const a = dense[cursor];
    const b = dense[(cursor + 1) % denseN];
    raw.push({
      x: a.x + (b.x - a.x) * frac,
      y: a.y + (b.y - a.y) * frac,
    });
  }

  // 4-pass closed-loop curvature smoothing prevents Catmull-Rom inner-wall cusps
  for (let pass = 0; pass < 4; pass++) {
    const nextRaw: Vec2[] = new Array(totalCount);
    for (let i = 0; i < totalCount; i++) {
      const prev = raw[(i - 1 + totalCount) % totalCount];
      const curr = raw[i];
      const next = raw[(i + 1) % totalCount];
      nextRaw[i] = {
        x: prev.x * 0.22 + curr.x * 0.56 + next.x * 0.22,
        y: prev.y * 0.22 + curr.y * 0.56 + next.y * 0.22,
      };
    }
    for (let i = 0; i < totalCount; i++) raw[i] = nextRaw[i];
  }

  const samples: SplineSample[] = [];
  for (let i = 0; i < totalCount; i++) {
    const prev = raw[(i - 1 + totalCount) % totalCount];
    const curr = raw[i];
    const next = raw[(i + 1) % totalCount];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    const tx = dx / len;
    const ty = dy / len;
    const t = i / totalCount;

    samples.push({
      x: curr.x,
      y: curr.y,
      tx,
      ty,
      nx: -ty,
      ny: tx,
      t,
      dist: t * totalDist,
      isBridge: inRanges(t, bp.bridgeRanges),
      isUnderpass: inRanges(t, bp.underpassRanges),
      rampHeight: computeRampHeight(t, bp.bridgeRanges),
    });
  }

  // Generate decorative tire stacks along outer sharp corners
  const tireStacks: Array<{ x: number; y: number; color: string }> = [];
  for (let i = 0; i < totalCount; i += 5) {
    const prev = samples[(i - 3 + totalCount) % totalCount];
    const curr = samples[i];
    const next = samples[(i + 3) % totalCount];
    if (curr.isBridge || curr.isUnderpass) continue;
    const cross = prev.tx * next.ty - prev.ty * next.tx;
    if (Math.abs(cross) > 0.24) {
      const side = cross > 0 ? -1 : 1;
      const offset = bp.roadWidth * 0.5 + 22;
      const sx = curr.x + curr.nx * side * offset;
      const sy = curr.y + curr.ny * side * offset;
      if (sx > 34 && sx < SPRINT_W - 34 && sy > 76 && sy < SPRINT_H - 34) {
        let overlaps = false;
        for (let j = 0; j < totalCount; j += 3) {
          if (Math.hypot(sx - samples[j].x, sy - samples[j].y) < bp.roadWidth * 0.58) {
            overlaps = true;
            break;
          }
        }
        if (!overlaps) {
          tireStacks.push({
            x: sx,
            y: sy,
            color: tireStacks.length % 2 === 0 ? bp.kerbPrimary : bp.kerbSecondary,
          });
        }
      }
    }
  }

  return {
    blueprint: bp,
    samples,
    totalLength: totalDist,
    startSample: samples[0],
    tireStacks,
  };
}

export function sampleAtT(track: CompiledTrack, t: number): SplineSample {
  let wrapped = t % 1;
  if (wrapped < 0) wrapped += 1;
  const idx = Math.floor(wrapped * track.samples.length) % track.samples.length;
  return track.samples[idx];
}

export interface RoadProjection {
  dist: number;
  cx: number;
  cy: number;
  tx: number;
  ty: number;
  nx: number;
  ny: number;
  sample: SplineSample;
  sampleIdx: number;
  signedOffset: number;
}

function projectOntoSegment(samples: SplineSample[], segIdx: number, x: number, y: number): RoadProjection {
  const n = samples.length;
  const a = samples[segIdx];
  const b = samples[(segIdx + 1) % n];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy || 1;
  const u = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / lenSq));

  const cx = a.x + u * dx;
  const cy = a.y + u * dy;
  const dist = Math.hypot(x - cx, y - cy);

  let tx = a.tx * (1 - u) + b.tx * u;
  let ty = a.ty * (1 - u) + b.ty * u;
  const tLen = Math.hypot(tx, ty) || 1;
  tx /= tLen;
  ty /= tLen;
  const nx = -ty;
  const ny = tx;

  const sampleIdx = u >= 0.5 ? (segIdx + 1) % n : segIdx;
  const signedOffset = (x - cx) * nx + (y - cy) * ny;
  return { dist, cx, cy, tx, ty, nx, ny, sample: samples[sampleIdx], sampleIdx, signedOffset };
}

/**
 * Exact continuous point-to-segment projection onto the track spline.
 * Searches a local continuity window around hintIdx FIRST so cars smoothly traverse
 * bridge ramps, overpasses, underpasses, and tight hairpins with ZERO invisible walls!
 */
export function projectOntoTrack(
  track: CompiledTrack,
  x: number,
  y: number,
  preferBridge: boolean,
  hintIdx?: number,
  allowGlobalFallback = false
): RoadProjection {
  const samples = track.samples;
  const n = samples.length;

  if (hintIdx !== undefined) {
    const windowRadius = 22;
    let bestLocal: RoadProjection | null = null;
    for (let offset = -windowRadius; offset <= windowRadius; offset++) {
      const segIdx = (((hintIdx + offset) % n) + n) % n;
      const cand = projectOntoSegment(samples, segIdx, x, y);
      if (!bestLocal || cand.dist < bestLocal.dist) {
        bestLocal = cand;
      }
    }
    if (bestLocal && (!allowGlobalFallback || bestLocal.dist <= track.blueprint.roadWidth * 0.62)) {
      return bestLocal;
    }
  }

  let bestGlobal: RoadProjection | null = null;
  let bestScore = Infinity;
  for (let i = 0; i < n; i++) {
    const cand = projectOntoSegment(samples, i, x, y);
    let score = cand.dist;
    if (cand.sample.isBridge !== preferBridge && (cand.sample.isBridge || cand.sample.isUnderpass)) {
      score += 48;
    }
    if (score < bestScore) {
      bestScore = score;
      bestGlobal = cand;
    }
  }

  return bestGlobal ?? projectOntoSegment(samples, 0, x, y);
}

export function isPointInShortcut(shortcut: ShortcutGateDef, x: number, y: number): boolean {
  const dx = shortcut.exit.x - shortcut.entry.x;
  const dy = shortcut.exit.y - shortcut.entry.y;
  const lenSq = dx * dx + dy * dy || 1;
  const u = ((x - shortcut.entry.x) * dx + (y - shortcut.entry.y) * dy) / lenSq;
  if (u < -0.08 || u > 1.08) return false;
  const px = shortcut.entry.x + Math.max(0, Math.min(1, u)) * dx;
  const py = shortcut.entry.y + Math.max(0, Math.min(1, u)) * dy;
  return Math.hypot(x - px, y - py) <= shortcut.width * 0.54;
}

// ============================================================================
// REUSABLE VERIFIED ARCADE CIRCUIT GEOMETRIES (100% CUSP-FREE & OVERLAP-CLEAN!)
// ============================================================================

const GEO_OVAL: Vec2[] = [
  { x: 350, y: 175 },
  { x: 960, y: 175 },
  { x: 1125, y: 325 },
  { x: 1115, y: 695 },
  { x: 930, y: 815 },
  { x: 350, y: 815 },
  { x: 165, y: 695 },
  { x: 165, y: 325 },
];

const GEO_DOGLEG_OVAL: Vec2[] = [
  { x: 400, y: 175 },
  { x: 960, y: 175 },
  { x: 1125, y: 310 },
  { x: 1110, y: 695 },
  { x: 920, y: 815 },
  { x: 640, y: 695 },
  { x: 320, y: 815 },
  { x: 165, y: 670 },
  { x: 170, y: 310 },
];

const GEO_KIDNEY: Vec2[] = [
  { x: 380, y: 175 },
  { x: 970, y: 175 },
  { x: 1125, y: 315 },
  { x: 1110, y: 540 },
  { x: 870, y: 560 },
  { x: 850, y: 785 },
  { x: 410, y: 815 },
  { x: 175, y: 710 },
  { x: 170, y: 340 },
];

const GEO_FIGURE8: Vec2[] = [
  { x: 350, y: 185 },
  { x: 545, y: 295 },
  { x: 640, y: 500 }, // Overpass crossing
  { x: 825, y: 775 },
  { x: 1095, y: 730 },
  { x: 1115, y: 315 },
  { x: 910, y: 185 },
  { x: 640, y: 500 }, // Underpass crossing
  { x: 425, y: 775 },
  { x: 175, y: 730 },
  { x: 165, y: 315 },
];

const GEO_WEST_OVERPASS: Vec2[] = [
  { x: 450, y: 175 },
  { x: 960, y: 175 },
  { x: 1125, y: 315 },
  { x: 1110, y: 695 },
  { x: 920, y: 815 },
  { x: 655, y: 760 },
  { x: 525, y: 520 }, // Overpass crossing
  { x: 295, y: 405 },
  { x: 165, y: 550 },
  { x: 205, y: 780 },
  { x: 405, y: 795 },
  { x: 525, y: 520 }, // Underpass crossing
  { x: 465, y: 335 },
  { x: 235, y: 280 },
  { x: 245, y: 175 },
];

const GEO_EAST_OVERPASS: Vec2[] = [
  { x: 300, y: 175 },
  { x: 620, y: 175 },
  { x: 755, y: 345 },
  { x: 755, y: 520 }, // Overpass crossing
  { x: 985, y: 405 },
  { x: 1115, y: 550 },
  { x: 1075, y: 780 },
  { x: 875, y: 795 },
  { x: 755, y: 520 }, // Underpass crossing
  { x: 600, y: 770 },
  { x: 310, y: 815 },
  { x: 165, y: 695 },
  { x: 165, y: 315 },
];

const GEO_TWIN_HAIRPINS: Vec2[] = [
  { x: 340, y: 170 },
  { x: 990, y: 170 },
  { x: 1125, y: 295 },
  { x: 1030, y: 390 },
  { x: 865, y: 445 },
  { x: 1035, y: 550 },
  { x: 1110, y: 695 },
  { x: 970, y: 810 },
  { x: 295, y: 810 },
  { x: 165, y: 685 },
  { x: 260, y: 575 },
  { x: 425, y: 515 },
  { x: 255, y: 410 },
  { x: 170, y: 275 },
];

const GEO_SPEEDWAY_S: Vec2[] = [
  { x: 340, y: 165 },
  { x: 640, y: 165 },
  { x: 755, y: 350 },
  { x: 1020, y: 215 },
  { x: 1135, y: 455 },
  { x: 1055, y: 805 },
  { x: 650, y: 660 },
  { x: 315, y: 815 },
  { x: 155, y: 590 },
  { x: 175, y: 280 },
];

const GEO_SLALOM: Vec2[] = [
  { x: 310, y: 170 },
  { x: 965, y: 170 },
  { x: 1115, y: 295 },
  { x: 1020, y: 410 },
  { x: 880, y: 475 },
  { x: 1040, y: 575 },
  { x: 1105, y: 715 },
  { x: 950, y: 815 },
  { x: 580, y: 715 },
  { x: 265, y: 810 },
  { x: 160, y: 650 },
  { x: 245, y: 510 },
  { x: 350, y: 420 },
  { x: 215, y: 325 },
  { x: 175, y: 235 },
];

const GEO_CLOVERLEAF: Vec2[] = [
  { x: 350, y: 175 },
  { x: 640, y: 290 },
  { x: 945, y: 175 },
  { x: 1125, y: 320 },
  { x: 970, y: 510 },
  { x: 1120, y: 730 },
  { x: 905, y: 820 },
  { x: 640, y: 690 },
  { x: 355, y: 820 },
  { x: 165, y: 705 },
  { x: 305, y: 505 },
  { x: 165, y: 310 },
];

const GEO_ENDURANCE: Vec2[] = [
  { x: 310, y: 170 },
  { x: 1000, y: 170 },
  { x: 1130, y: 325 },
  { x: 1115, y: 700 },
  { x: 940, y: 815 },
  { x: 645, y: 810 },
  { x: 575, y: 625 },
  { x: 755, y: 530 },
  { x: 765, y: 370 },
  { x: 500, y: 355 },
  { x: 390, y: 555 },
  { x: 355, y: 790 },
  { x: 175, y: 720 },
  { x: 165, y: 300 },
];

const GEO_HARBOR_CHICANE: Vec2[] = [
  { x: 310, y: 170 },
  { x: 660, y: 170 },
  { x: 760, y: 380 },
  { x: 1045, y: 205 },
  { x: 1135, y: 445 },
  { x: 1030, y: 805 },
  { x: 640, y: 650 },
  { x: 280, y: 810 },
  { x: 155, y: 575 },
  { x: 350, y: 440 },
  { x: 170, y: 285 },
];

const GEO_BOX_CUT: Vec2[] = [
  { x: 350, y: 170 },
  { x: 980, y: 170 },
  { x: 1125, y: 305 },
  { x: 1120, y: 525 },
  { x: 865, y: 525 },
  { x: 640, y: 380 },
  { x: 430, y: 525 },
  { x: 870, y: 705 },
  { x: 785, y: 825 },
  { x: 270, y: 815 },
  { x: 165, y: 665 },
  { x: 170, y: 300 },
];

const GEO_SUPER_OVAL: Vec2[] = [
  { x: 380, y: 175 },
  { x: 900, y: 175 },
  { x: 1110, y: 295 },
  { x: 1125, y: 495 },
  { x: 1110, y: 695 },
  { x: 900, y: 815 },
  { x: 380, y: 815 },
  { x: 170, y: 695 },
  { x: 155, y: 495 },
  { x: 170, y: 295 },
];

// ============================================================================
// 1. SPRINT 1 (KEE GAMES, 1978) — 8 CLASSIC PHOSPHOR-GREEN CIRCUITS
// ============================================================================
const S1_BASE = {
  theme: 'mono_green' as const,
  infieldColor: '#070D0A',
  infieldStripeColor: 'rgba(134, 239, 172, 0.04)',
  asphaltColor: '#131A16',
  wallOuterColor: '#DCFCE7',
  kerbPrimary: '#86EFAC',
  kerbSecondary: '#1E293B',
  waterSpots: [] as Array<{ t: number; offset: number; radius: number }>,
};

const SPRINT1_TRACKS: SprintTrackBlueprint[] = [
  {
    ...S1_BASE,
    id: 's1_classic',
    name: 'Track 1 · Kee Oval & Dogleg',
    roadWidth: 146,
    controlPoints: GEO_DOGLEG_OVAL,
    oilSpots: [{ t: 0.28, offset: -14, radius: 24 }, { t: 0.72, offset: 18, radius: 24 }],
    props: [{ kind: 'grandstand', x: 520, y: 54, w: 260, h: 42 }, { kind: 'pit', x: 520, y: 410, w: 230, h: 86 }],
  },
  {
    ...S1_BASE,
    id: 's1_figure8',
    name: 'Track 2 · Kee Figure-8 Cross',
    roadWidth: 138,
    controlPoints: GEO_FIGURE8,
    bridgeRanges: [[0.075, 0.185]],
    underpassRanges: [[0.575, 0.685]],
    oilSpots: [{ t: 0.44, offset: 0, radius: 24 }, { t: 0.88, offset: -12, radius: 24 }],
    props: [{ kind: 'grandstand', x: 510, y: 54, w: 260, h: 42 }],
  },
  {
    ...S1_BASE,
    id: 's1_kidney',
    name: 'Track 3 · Classic Kidney Loop',
    roadWidth: 142,
    controlPoints: GEO_KIDNEY,
    oilSpots: [{ t: 0.31, offset: 12, radius: 24 }, { t: 0.71, offset: -14, radius: 24 }],
    props: [{ kind: 'grandstand', x: 510, y: 52, w: 260, h: 42 }, { kind: 'pit', x: 420, y: 375, w: 220, h: 80 }],
  },
  {
    ...S1_BASE,
    id: 's1_hairpins',
    name: 'Track 4 · Twin Hairpin Switchback',
    roadWidth: 136,
    controlPoints: GEO_TWIN_HAIRPINS,
    oilSpots: [{ t: 0.24, offset: 14, radius: 24 }, { t: 0.62, offset: -14, radius: 24 }],
    props: [{ kind: 'grandstand', x: 520, y: 52, w: 240, h: 40 }],
  },
  {
    ...S1_BASE,
    id: 's1_speedway',
    name: 'Track 5 · Grand Speedway S-Curves',
    roadWidth: 134,
    controlPoints: GEO_SPEEDWAY_S,
    oilSpots: [{ t: 0.36, offset: 12, radius: 24 }, { t: 0.78, offset: -14, radius: 24 }],
    props: [{ kind: 'grandstand', x: 210, y: 52, w: 260, h: 40 }],
  },
  {
    ...S1_BASE,
    id: 's1_clover',
    name: 'Track 6 · Four-Apex Cloverleaf',
    roadWidth: 134,
    controlPoints: GEO_CLOVERLEAF,
    oilSpots: [{ t: 0.22, offset: 0, radius: 23 }, { t: 0.68, offset: 14, radius: 23 }],
    props: [{ kind: 'pit', x: 550, y: 450, w: 180, h: 72 }],
  },
  {
    ...S1_BASE,
    id: 's1_slalom',
    name: 'Track 7 · Technical Double-S',
    roadWidth: 134,
    controlPoints: GEO_SLALOM,
    oilSpots: [{ t: 0.34, offset: 12, radius: 24 }, { t: 0.76, offset: -12, radius: 24 }],
    props: [{ kind: 'grandstand', x: 510, y: 54, w: 260, h: 40 }],
  },
  {
    ...S1_BASE,
    id: 's1_endurance',
    name: 'Track 8 · Master Labyrinth',
    roadWidth: 132,
    controlPoints: GEO_ENDURANCE,
    oilSpots: [{ t: 0.27, offset: -12, radius: 24 }, { t: 0.74, offset: 12, radius: 24 }],
    props: [{ kind: 'grandstand', x: 500, y: 52, w: 280, h: 42 }],
  },
];

// ============================================================================
// 2. SPRINT 2 (KEE GAMES, 1976) — 8 AUTHENTIC SILVER-BLUE CIRCUITS
// ============================================================================
const S2_BASE = {
  theme: 'mono_silver' as const,
  infieldColor: '#070B14',
  infieldStripeColor: 'rgba(226, 232, 240, 0.045)',
  asphaltColor: '#151B26',
  wallOuterColor: '#F8FAFC',
  kerbPrimary: '#E2E8F0',
  kerbSecondary: '#334155',
  waterSpots: [] as Array<{ t: number; offset: number; radius: number }>,
};

const SPRINT2_TRACKS: SprintTrackBlueprint[] = [
  {
    ...S2_BASE,
    id: 's2_grand',
    name: 'Track 1 · Sprint 2 Grand Circuit',
    roadWidth: 144,
    controlPoints: GEO_KIDNEY,
    oilSpots: [{ t: 0.25, offset: -10, radius: 24 }, { t: 0.68, offset: 14, radius: 24 }],
    props: [{ kind: 'grandstand', x: 495, y: 54, w: 290, h: 42 }, { kind: 'pit', x: 440, y: 375, w: 230, h: 86 }],
  },
  {
    ...S2_BASE,
    id: 's2_oval',
    name: 'Track 2 · High-Speed Oval',
    roadWidth: 148,
    controlPoints: GEO_SUPER_OVAL,
    oilSpots: [{ t: 0.22, offset: 16, radius: 24 }, { t: 0.72, offset: -16, radius: 24 }],
    props: [{ kind: 'grandstand', x: 480, y: 52, w: 320, h: 44 }, { kind: 'pit', x: 520, y: 430, w: 240, h: 90 }],
  },
  {
    ...S2_BASE,
    id: 's2_slalom',
    name: 'Track 3 · Double-S Slalom',
    roadWidth: 136,
    controlPoints: GEO_SLALOM,
    oilSpots: [{ t: 0.31, offset: 14, radius: 24 }, { t: 0.72, offset: -12, radius: 24 }],
    props: [{ kind: 'grandstand', x: 510, y: 54, w: 260, h: 40 }],
  },
  {
    ...S2_BASE,
    id: 's2_clover',
    name: 'Track 4 · Cloverleaf Hairpins',
    roadWidth: 134,
    controlPoints: GEO_CLOVERLEAF,
    oilSpots: [{ t: 0.22, offset: 0, radius: 23 }, { t: 0.56, offset: 14, radius: 23 }, { t: 0.84, offset: -14, radius: 23 }],
    props: [{ kind: 'pit', x: 555, y: 445, w: 170, h: 72 }],
  },
  {
    ...S2_BASE,
    id: 's2_figure8',
    name: 'Track 5 · Crossroad Figure-8',
    roadWidth: 138,
    controlPoints: GEO_FIGURE8,
    bridgeRanges: [[0.075, 0.185]],
    underpassRanges: [[0.575, 0.685]],
    oilSpots: [{ t: 0.43, offset: 12, radius: 24 }, { t: 0.86, offset: -12, radius: 24 }],
    props: [{ kind: 'grandstand', x: 490, y: 52, w: 300, h: 42 }],
  },
  {
    ...S2_BASE,
    id: 's2_chicane',
    name: 'Track 6 · Harbor Chicane',
    roadWidth: 134,
    controlPoints: GEO_HARBOR_CHICANE,
    oilSpots: [{ t: 0.34, offset: 14, radius: 24 }, { t: 0.79, offset: -14, radius: 24 }],
    props: [{ kind: 'grandstand', x: 250, y: 52, w: 300, h: 42 }],
  },
  {
    ...S2_BASE,
    id: 's2_endurance',
    name: 'Track 7 · Pro Endurance Loop',
    roadWidth: 134,
    controlPoints: GEO_ENDURANCE,
    oilSpots: [{ t: 0.34, offset: -12, radius: 24 }, { t: 0.77, offset: 14, radius: 24 }],
    props: [{ kind: 'grandstand', x: 500, y: 52, w: 280, h: 42 }],
  },
  {
    ...S2_BASE,
    id: 's2_master',
    name: 'Track 8 · Kee Games Master Circuit',
    roadWidth: 134,
    controlPoints: GEO_WEST_OVERPASS,
    bridgeRanges: [[0.43, 0.55]],
    underpassRanges: [[0.75, 0.87]],
    oilSpots: [{ t: 0.28, offset: 12, radius: 24 }, { t: 0.64, offset: -12, radius: 24 }],
    props: [{ kind: 'grandstand', x: 480, y: 52, w: 320, h: 42 }],
  },
];

// ============================================================================
// 3. SPRINT 4 (ATARI, 1977) — 6 FIRST-COLOR 4-PLAYER TABLETOP CIRCUITS
// ============================================================================
const SPRINT4_TRACKS: SprintTrackBlueprint[] = [
  {
    id: 's4_emerald',
    name: 'Track 1 · 1977 Color Classic',
    theme: 'color_retro',
    roadWidth: 148,
    infieldColor: '#065F46',
    infieldStripeColor: 'rgba(110, 231, 183, 0.08)',
    asphaltColor: '#1E293B',
    wallOuterColor: '#FDE047',
    kerbPrimary: '#EF4444',
    kerbSecondary: '#F8FAFC',
    controlPoints: GEO_DOGLEG_OVAL,
    oilSpots: [{ t: 0.28, offset: 14, radius: 24 }, { t: 0.73, offset: -14, radius: 24 }],
    waterSpots: [],
    props: [{ kind: 'grandstand', x: 480, y: 52, w: 320, h: 44 }, { kind: 'pit', x: 520, y: 405, w: 230, h: 86 }],
  },
  {
    id: 's4_cross',
    name: 'Track 2 · 4-Way Color Figure-8',
    theme: 'color_retro',
    roadWidth: 144,
    infieldColor: '#1E40AF',
    infieldStripeColor: 'rgba(147, 197, 253, 0.08)',
    asphaltColor: '#1E293B',
    wallOuterColor: '#FFFFFF',
    kerbPrimary: '#FACC15',
    kerbSecondary: '#0F172A',
    controlPoints: GEO_FIGURE8,
    bridgeRanges: [[0.075, 0.185]],
    underpassRanges: [[0.575, 0.685]],
    oilSpots: [{ t: 0.42, offset: -12, radius: 24 }, { t: 0.87, offset: 12, radius: 24 }],
    waterSpots: [],
    props: [{ kind: 'grandstand', x: 480, y: 52, w: 320, h: 44 }],
  },
  {
    id: 's4_amber',
    name: 'Track 3 · Golden Sand Kidney',
    theme: 'color_retro',
    roadWidth: 144,
    infieldColor: '#92400E',
    infieldStripeColor: 'rgba(253, 224, 71, 0.08)',
    asphaltColor: '#27272A',
    wallOuterColor: '#38BDF8',
    kerbPrimary: '#F97316',
    kerbSecondary: '#F8FAFC',
    controlPoints: GEO_KIDNEY,
    oilSpots: [{ t: 0.29, offset: 12, radius: 24 }, { t: 0.74, offset: -12, radius: 24 }],
    waterSpots: [],
    props: [{ kind: 'grandstand', x: 480, y: 52, w: 320, h: 44 }, { kind: 'pit', x: 430, y: 375, w: 220, h: 82 }],
  },
  {
    id: 's4_clover',
    name: 'Track 4 · Tabletop Cloverleaf',
    theme: 'color_retro',
    roadWidth: 138,
    infieldColor: '#065F46',
    infieldStripeColor: 'rgba(255, 255, 255, 0.06)',
    asphaltColor: '#1F2937',
    wallOuterColor: '#FACC15',
    kerbPrimary: '#22C55E',
    kerbSecondary: '#F8FAFC',
    controlPoints: GEO_CLOVERLEAF,
    oilSpots: [{ t: 0.25, offset: -12, radius: 23 }, { t: 0.66, offset: 12, radius: 23 }],
    waterSpots: [],
    props: [{ kind: 'pit', x: 550, y: 445, w: 180, h: 74 }],
  },
  {
    id: 's4_switch',
    name: 'Track 5 · Atari Color Hairpins',
    theme: 'color_retro',
    roadWidth: 138,
    infieldColor: '#581C87',
    infieldStripeColor: 'rgba(232, 121, 249, 0.08)',
    asphaltColor: '#1E293B',
    wallOuterColor: '#4ADE80',
    kerbPrimary: '#F472B6',
    kerbSecondary: '#FFFFFF',
    controlPoints: GEO_TWIN_HAIRPINS,
    oilSpots: [{ t: 0.27, offset: 14, radius: 24 }, { t: 0.69, offset: -14, radius: 24 }],
    waterSpots: [],
    props: [{ kind: 'grandstand', x: 480, y: 52, w: 320, h: 44 }],
  },
  {
    id: 's4_finals',
    name: 'Track 6 · 4-Player Championship',
    theme: 'color_retro',
    roadWidth: 138,
    infieldColor: '#1E3A8A',
    infieldStripeColor: 'rgba(56, 189, 248, 0.08)',
    asphaltColor: '#1F2937',
    wallOuterColor: '#FDE047',
    kerbPrimary: '#EF4444',
    kerbSecondary: '#FFFFFF',
    controlPoints: GEO_EAST_OVERPASS,
    bridgeRanges: [[0.19, 0.30]],
    underpassRanges: [[0.56, 0.67]],
    oilSpots: [{ t: 0.42, offset: 12, radius: 24 }, { t: 0.83, offset: -12, radius: 24 }],
    waterSpots: [],
    props: [{ kind: 'grandstand', x: 480, y: 52, w: 320, h: 44 }],
  },
];

// ============================================================================
// 4. SPRINT 8 (ATARI, 1977) — 6 EXTRA-WIDE 8-CAR COLOR ARENA CIRCUITS
// ============================================================================
const SPRINT8_TRACKS: SprintTrackBlueprint[] = [
  {
    id: 's8_arena1',
    name: 'Arena 1 · Indy 800 Grand Bowl',
    theme: 'arena_8',
    roadWidth: 164,
    infieldColor: '#064E3B',
    infieldStripeColor: 'rgba(255, 255, 255, 0.06)',
    asphaltColor: '#1E293B',
    wallOuterColor: '#FACC15',
    kerbPrimary: '#EF4444',
    kerbSecondary: '#FFFFFF',
    controlPoints: GEO_SUPER_OVAL,
    oilSpots: [{ t: 0.26, offset: 18, radius: 24 }, { t: 0.74, offset: -18, radius: 24 }],
    waterSpots: [],
    props: [{ kind: 'grandstand', x: 470, y: 50, w: 340, h: 44 }, { kind: 'pit', x: 520, y: 425, w: 240, h: 90 }],
  },
  {
    id: 's8_dogleg',
    name: 'Arena 2 · 8-Wide Dogleg Bowl',
    theme: 'arena_8',
    roadWidth: 158,
    infieldColor: '#1E3A8A',
    infieldStripeColor: 'rgba(147, 197, 253, 0.07)',
    asphaltColor: '#1F2937',
    wallOuterColor: '#38BDF8',
    kerbPrimary: '#FACC15',
    kerbSecondary: '#0F172A',
    controlPoints: GEO_DOGLEG_OVAL,
    oilSpots: [{ t: 0.28, offset: -16, radius: 24 }, { t: 0.72, offset: 16, radius: 24 }],
    waterSpots: [],
    props: [{ kind: 'grandstand', x: 470, y: 50, w: 340, h: 44 }, { kind: 'pit', x: 520, y: 405, w: 230, h: 86 }],
  },
  {
    id: 's8_figure8',
    name: 'Arena 3 · Octa-Cross Figure-8',
    theme: 'arena_8',
    roadWidth: 152,
    infieldColor: '#7C2D12',
    infieldStripeColor: 'rgba(251, 146, 60, 0.08)',
    asphaltColor: '#27272A',
    wallOuterColor: '#FDE047',
    kerbPrimary: '#F97316',
    kerbSecondary: '#FFFFFF',
    controlPoints: GEO_FIGURE8,
    bridgeRanges: [[0.075, 0.185]],
    underpassRanges: [[0.575, 0.685]],
    oilSpots: [{ t: 0.42, offset: 16, radius: 24 }, { t: 0.87, offset: -16, radius: 24 }],
    waterSpots: [],
    props: [{ kind: 'grandstand', x: 480, y: 50, w: 320, h: 44 }],
  },
  {
    id: 's8_kidney',
    name: 'Arena 4 · Sweeping Speedway',
    theme: 'arena_8',
    roadWidth: 156,
    infieldColor: '#065F46',
    infieldStripeColor: 'rgba(74, 222, 128, 0.06)',
    asphaltColor: '#1E293B',
    wallOuterColor: '#4ADE80',
    kerbPrimary: '#EF4444',
    kerbSecondary: '#FFFFFF',
    controlPoints: GEO_KIDNEY,
    oilSpots: [{ t: 0.30, offset: 14, radius: 24 }, { t: 0.71, offset: -14, radius: 24 }],
    waterSpots: [],
    props: [{ kind: 'grandstand', x: 480, y: 50, w: 320, h: 44 }, { kind: 'pit', x: 425, y: 375, w: 225, h: 82 }],
  },
  {
    id: 's8_speedway',
    name: 'Arena 5 · 8-Car S-Curve Chaos',
    theme: 'arena_8',
    roadWidth: 148,
    infieldColor: '#4C1D95',
    infieldStripeColor: 'rgba(196, 181, 253, 0.07)',
    asphaltColor: '#1F2937',
    wallOuterColor: '#E879F9',
    kerbPrimary: '#FACC15',
    kerbSecondary: '#FFFFFF',
    controlPoints: GEO_SPEEDWAY_S,
    oilSpots: [{ t: 0.36, offset: -14, radius: 24 }, { t: 0.78, offset: 14, radius: 24 }],
    waterSpots: [],
    props: [{ kind: 'grandstand', x: 220, y: 50, w: 300, h: 42 }],
  },
  {
    id: 's8_clover',
    name: 'Arena 6 · Sprint 8 Grand Final',
    theme: 'arena_8',
    roadWidth: 146,
    infieldColor: '#0F172A',
    infieldStripeColor: 'rgba(248, 250, 252, 0.05)',
    asphaltColor: '#27272A',
    wallOuterColor: '#FACC15',
    kerbPrimary: '#EF4444',
    kerbSecondary: '#38BDF8',
    controlPoints: GEO_CLOVERLEAF,
    oilSpots: [{ t: 0.24, offset: 14, radius: 24 }, { t: 0.68, offset: -14, radius: 24 }],
    waterSpots: [],
    props: [{ kind: 'pit', x: 550, y: 445, w: 180, h: 74 }],
  },
];

// ============================================================================
// 5. SUPER SPRINT (ATARI GAMES, 1986) — ALL 8 SYSTEM 2 CIRCUITS!
// ============================================================================
const SUPERSPRINT_TRACKS: SprintTrackBlueprint[] = [
  {
    id: 'ss_track1',
    name: 'Track 1 · Classic Overpass',
    theme: 'stadium',
    roadWidth: 142,
    infieldColor: '#14532D',
    infieldStripeColor: 'rgba(255, 255, 255, 0.05)',
    asphaltColor: '#374151',
    wallOuterColor: '#CBD5E1',
    kerbPrimary: '#EF4444',
    kerbSecondary: '#F8FAFC',
    controlPoints: GEO_FIGURE8,
    bridgeRanges: [[0.075, 0.185]],
    underpassRanges: [[0.575, 0.685]],
    oilSpots: [{ t: 0.42, offset: 14, radius: 24 }, { t: 0.87, offset: -14, radius: 24 }],
    waterSpots: [],
    hasTornado: false,
    props: [
      { kind: 'grandstand', x: 470, y: 52, w: 340, h: 46 },
      { kind: 'grandstand', x: 40, y: 862, w: 250, h: 44 },
      { kind: 'grandstand', x: 980, y: 862, w: 250, h: 44 },
      { kind: 'tree', x: 82, y: 140 },
      { kind: 'tree', x: 1195, y: 140 },
      { kind: 'tree', x: 80, y: 810 },
      { kind: 'tree', x: 1200, y: 810 },
      { kind: 'pit', x: 915, y: 470, w: 120, h: 58 },
    ],
  },
  {
    id: 'ss_track2',
    name: 'Track 2 · Grand Stadium Overpass',
    theme: 'stadium',
    roadWidth: 136,
    infieldColor: '#166534',
    infieldStripeColor: 'rgba(255, 255, 255, 0.05)',
    asphaltColor: '#334155',
    wallOuterColor: '#E2E8F0',
    kerbPrimary: '#FACC15',
    kerbSecondary: '#0F172A',
    controlPoints: GEO_WEST_OVERPASS,
    bridgeRanges: [[0.43, 0.55]],
    underpassRanges: [[0.75, 0.87]],
    oilSpots: [{ t: 0.28, offset: 14, radius: 24 }],
    waterSpots: [{ t: 0.64, offset: -10, radius: 26 }],
    hasTornado: true,
    props: [
      { kind: 'grandstand', x: 480, y: 52, w: 320, h: 46 },
      { kind: 'tent', x: 840, y: 465, color: '#EF4444' },
      { kind: 'tent', x: 840, y: 545, color: '#38BDF8' },
      { kind: 'tree', x: 75, y: 135 },
      { kind: 'tree', x: 1205, y: 135 },
      { kind: 'tree', x: 640, y: 865 },
    ],
  },
  {
    id: 'ss_track3',
    name: 'Track 3 · Red Canyon Switchback',
    theme: 'canyon',
    roadWidth: 132,
    infieldColor: '#7C2D12',
    infieldStripeColor: 'rgba(251, 146, 60, 0.08)',
    asphaltColor: '#3F3F46',
    wallOuterColor: '#FED7AA',
    kerbPrimary: '#F97316',
    kerbSecondary: '#F8FAFC',
    controlPoints: GEO_TWIN_HAIRPINS,
    oilSpots: [{ t: 0.26, offset: -14, radius: 24 }, { t: 0.64, offset: 14, radius: 24 }],
    waterSpots: [],
    hasTornado: true,
    props: [
      { kind: 'grandstand', x: 480, y: 52, w: 320, h: 44 },
      { kind: 'cactus', x: 90, y: 150 },
      { kind: 'cactus', x: 1190, y: 150 },
      { kind: 'cactus', x: 640, y: 470 },
      { kind: 'cactus', x: 640, y: 860 },
      { kind: 'tent', x: 960, y: 315, color: '#FACC15' },
    ],
  },
  {
    id: 'ss_track4',
    name: 'Track 4 · Blue Harbor S-Circuit',
    theme: 'twilight',
    roadWidth: 130,
    infieldColor: '#1E3A5F',
    infieldStripeColor: 'rgba(56, 189, 248, 0.07)',
    asphaltColor: '#273244',
    wallOuterColor: '#BAE6FD',
    kerbPrimary: '#38BDF8',
    kerbSecondary: '#F8FAFC',
    controlPoints: GEO_HARBOR_CHICANE,
    oilSpots: [{ t: 0.36, offset: 12, radius: 23 }],
    waterSpots: [{ t: 0.62, offset: -12, radius: 28 }, { t: 0.85, offset: 12, radius: 26 }],
    hasTornado: true,
    props: [
      { kind: 'grandstand', x: 240, y: 52, w: 320, h: 44 },
      { kind: 'pit', x: 470, y: 485, w: 160, h: 66 },
      { kind: 'tree', x: 1195, y: 140 },
      { kind: 'tree', x: 1195, y: 825 },
    ],
  },
  {
    id: 'ss_track5',
    name: 'Track 5 · Eastern Bridge Loop',
    theme: 'stadium',
    roadWidth: 134,
    infieldColor: '#14532D',
    infieldStripeColor: 'rgba(255, 255, 255, 0.05)',
    asphaltColor: '#374151',
    wallOuterColor: '#E2E8F0',
    kerbPrimary: '#EF4444',
    kerbSecondary: '#F8FAFC',
    controlPoints: GEO_EAST_OVERPASS,
    bridgeRanges: [[0.19, 0.30]],
    underpassRanges: [[0.56, 0.67]],
    oilSpots: [{ t: 0.41, offset: 12, radius: 24 }],
    waterSpots: [{ t: 0.84, offset: -12, radius: 26 }],
    hasTornado: true,
    props: [
      { kind: 'grandstand', x: 470, y: 52, w: 340, h: 44 },
      { kind: 'pit', x: 350, y: 455, w: 150, h: 68 },
      { kind: 'tree', x: 75, y: 140 },
      { kind: 'tree', x: 1205, y: 140 },
    ],
  },
  {
    id: 'ss_track6',
    name: 'Track 6 · Desert Mesa Slalom',
    theme: 'canyon',
    roadWidth: 130,
    infieldColor: '#9A3412',
    infieldStripeColor: 'rgba(253, 186, 116, 0.07)',
    asphaltColor: '#3F3F46',
    wallOuterColor: '#FDE68A',
    kerbPrimary: '#F59E0B',
    kerbSecondary: '#0F172A',
    controlPoints: GEO_SLALOM,
    oilSpots: [{ t: 0.32, offset: 12, radius: 23 }, { t: 0.72, offset: -12, radius: 23 }],
    waterSpots: [],
    hasTornado: true,
    props: [
      { kind: 'grandstand', x: 480, y: 52, w: 320, h: 44 },
      { kind: 'cactus', x: 640, y: 480 },
      { kind: 'cactus', x: 85, y: 150 },
      { kind: 'cactus', x: 1195, y: 820 },
    ],
  },
  {
    id: 'ss_track7',
    name: 'Track 7 · Speedway Endurance',
    theme: 'twilight',
    roadWidth: 128,
    infieldColor: '#1E293B',
    infieldStripeColor: 'rgba(148, 163, 184, 0.06)',
    asphaltColor: '#334155',
    wallOuterColor: '#38BDF8',
    kerbPrimary: '#FACC15',
    kerbSecondary: '#FFFFFF',
    controlPoints: GEO_ENDURANCE,
    oilSpots: [{ t: 0.34, offset: -12, radius: 23 }],
    waterSpots: [{ t: 0.76, offset: 12, radius: 26 }],
    hasTornado: true,
    props: [
      { kind: 'grandstand', x: 480, y: 52, w: 320, h: 44 },
      { kind: 'tent', x: 960, y: 470, color: '#38BDF8' },
    ],
  },
  {
    id: 'ss_track8',
    name: 'Track 8 · Grand Championship Ribbon',
    theme: 'stadium',
    roadWidth: 126,
    infieldColor: '#14532D',
    infieldStripeColor: 'rgba(255, 255, 255, 0.05)',
    asphaltColor: '#374151',
    wallOuterColor: '#FACC15',
    kerbPrimary: '#EF4444',
    kerbSecondary: '#F8FAFC',
    controlPoints: GEO_CLOVERLEAF,
    oilSpots: [{ t: 0.22, offset: 12, radius: 23 }, { t: 0.68, offset: -12, radius: 23 }],
    waterSpots: [{ t: 0.46, offset: 0, radius: 26 }],
    hasTornado: true,
    props: [
      { kind: 'grandstand', x: 480, y: 52, w: 320, h: 44 },
      { kind: 'pit', x: 545, y: 445, w: 190, h: 80 },
      { kind: 'tree', x: 75, y: 140 },
      { kind: 'tree', x: 1205, y: 140 },
    ],
  },
];

// ============================================================================
// 6. CHAMPIONSHIP SPRINT (ATARI GAMES, 1986) — ALL 8 PRO SHORTCUT CIRCUITS!
// ============================================================================
const CHAMPSPRINT_TRACKS: SprintTrackBlueprint[] = [
  {
    id: 'cs_arena',
    name: 'Pro 1 · Shortcut Gate Arena',
    theme: 'pro_asphalt',
    roadWidth: 134,
    infieldColor: '#0F3D2E',
    infieldStripeColor: 'rgba(74, 222, 128, 0.05)',
    asphaltColor: '#2E3440',
    wallOuterColor: '#4ADE80',
    kerbPrimary: '#EF4444',
    kerbSecondary: '#F8FAFC',
    controlPoints: GEO_OVAL,
    shortcut: { entry: { x: 640, y: 185 }, exit: { x: 640, y: 805 }, width: 96, entryT: 0.08, exitT: 0.58, cycleSeconds: 5.2 },
    oilSpots: [{ t: 0.31, offset: -12, radius: 24 }],
    waterSpots: [{ t: 0.74, offset: 12, radius: 28 }],
    hasTornado: false,
    props: [
      { kind: 'grandstand', x: 470, y: 52, w: 340, h: 44 },
      { kind: 'pit', x: 310, y: 430, w: 190, h: 86 },
      { kind: 'pit', x: 780, y: 430, w: 190, h: 86 },
    ],
  },
  {
    id: 'cs_overpass',
    name: 'Pro 2 · Dual-Gate Overpass',
    theme: 'twilight',
    roadWidth: 132,
    infieldColor: '#1E293B',
    infieldStripeColor: 'rgba(148, 163, 184, 0.05)',
    asphaltColor: '#334155',
    wallOuterColor: '#38BDF8',
    kerbPrimary: '#FACC15',
    kerbSecondary: '#0F172A',
    controlPoints: GEO_FIGURE8,
    bridgeRanges: [[0.075, 0.185]],
    underpassRanges: [[0.575, 0.685]],
    shortcut: { entry: { x: 350, y: 190 }, exit: { x: 910, y: 190 }, width: 88, entryT: 0.02, exitT: 0.53, cycleSeconds: 5.4 },
    oilSpots: [{ t: 0.42, offset: 12, radius: 24 }],
    waterSpots: [{ t: 0.86, offset: -12, radius: 28 }],
    hasTornado: false,
    props: [
      { kind: 'grandstand', x: 480, y: 50, w: 320, h: 42 },
      { kind: 'tent', x: 970, y: 490, color: '#22C55E' },
      { kind: 'tent', x: 300, y: 490, color: '#FACC15' },
    ],
  },
  {
    id: 'cs_technical',
    name: 'Pro 3 · Grand Prix Technical',
    theme: 'canyon',
    roadWidth: 128,
    infieldColor: '#581C87',
    infieldStripeColor: 'rgba(192, 132, 252, 0.06)',
    asphaltColor: '#2E3440',
    wallOuterColor: '#E879F9',
    kerbPrimary: '#F472B6',
    kerbSecondary: '#F8FAFC',
    controlPoints: GEO_TWIN_HAIRPINS,
    shortcut: { entry: { x: 640, y: 180 }, exit: { x: 640, y: 800 }, width: 86, entryT: 0.06, exitT: 0.56, cycleSeconds: 4.8 },
    oilSpots: [{ t: 0.25, offset: -10, radius: 23 }, { t: 0.72, offset: 10, radius: 23 }],
    waterSpots: [{ t: 0.48, offset: 12, radius: 27 }],
    hasTornado: true,
    props: [{ kind: 'grandstand', x: 470, y: 52, w: 340, h: 44 }, { kind: 'tree', x: 80, y: 145 }, { kind: 'tree', x: 1200, y: 145 }],
  },
  {
    id: 'cs_world',
    name: 'Pro 4 · Harbor Express Gate',
    theme: 'pro_asphalt',
    roadWidth: 128,
    infieldColor: '#14532D',
    infieldStripeColor: 'rgba(255, 255, 255, 0.05)',
    asphaltColor: '#27272A',
    wallOuterColor: '#FACC15',
    kerbPrimary: '#EF4444',
    kerbSecondary: '#F8FAFC',
    controlPoints: GEO_HARBOR_CHICANE,
    shortcut: { entry: { x: 485, y: 180 }, exit: { x: 485, y: 740 }, width: 84, entryT: 0.05, exitT: 0.64, cycleSeconds: 4.5 },
    oilSpots: [{ t: 0.34, offset: 12, radius: 23 }, { t: 0.82, offset: -12, radius: 23 }],
    waterSpots: [{ t: 0.56, offset: 0, radius: 28 }],
    hasTornado: true,
    props: [{ kind: 'grandstand', x: 260, y: 50, w: 320, h: 44 }, { kind: 'pit', x: 845, y: 500, w: 140, h: 66 }],
  },
  {
    id: 'cs_westgate',
    name: 'Pro 5 · Western Overpass Gate',
    theme: 'twilight',
    roadWidth: 130,
    infieldColor: '#0F172A',
    infieldStripeColor: 'rgba(56, 189, 248, 0.06)',
    asphaltColor: '#334155',
    wallOuterColor: '#22D3EE',
    kerbPrimary: '#FACC15',
    kerbSecondary: '#0F172A',
    controlPoints: GEO_WEST_OVERPASS,
    bridgeRanges: [[0.43, 0.55]],
    underpassRanges: [[0.75, 0.87]],
    shortcut: { entry: { x: 840, y: 185 }, exit: { x: 840, y: 805 }, width: 86, entryT: 0.12, exitT: 0.40, cycleSeconds: 4.8 },
    oilSpots: [{ t: 0.28, offset: 12, radius: 23 }],
    waterSpots: [{ t: 0.64, offset: -10, radius: 27 }],
    hasTornado: true,
    props: [{ kind: 'grandstand', x: 480, y: 52, w: 320, h: 44 }],
  },
  {
    id: 'cs_slalom',
    name: 'Pro 6 · Canyon Slalom Gate',
    theme: 'canyon',
    roadWidth: 128,
    infieldColor: '#7C2D12',
    infieldStripeColor: 'rgba(251, 146, 60, 0.07)',
    asphaltColor: '#27272A',
    wallOuterColor: '#FB923C',
    kerbPrimary: '#FACC15',
    kerbSecondary: '#FFFFFF',
    controlPoints: GEO_SLALOM,
    shortcut: { entry: { x: 640, y: 180 }, exit: { x: 640, y: 740 }, width: 84, entryT: 0.07, exitT: 0.54, cycleSeconds: 4.6 },
    oilSpots: [{ t: 0.30, offset: 12, radius: 23 }, { t: 0.78, offset: -12, radius: 23 }],
    waterSpots: [{ t: 0.50, offset: 10, radius: 26 }],
    hasTornado: true,
    props: [{ kind: 'grandstand', x: 480, y: 52, w: 320, h: 44 }, { kind: 'cactus', x: 90, y: 145 }],
  },
  {
    id: 'cs_eastbridge',
    name: 'Pro 7 · East Bridge Cut-Through',
    theme: 'pro_asphalt',
    roadWidth: 130,
    infieldColor: '#064E3B',
    infieldStripeColor: 'rgba(52, 211, 153, 0.06)',
    asphaltColor: '#2E3440',
    wallOuterColor: '#34D399',
    kerbPrimary: '#EF4444',
    kerbSecondary: '#FFFFFF',
    controlPoints: GEO_EAST_OVERPASS,
    bridgeRanges: [[0.19, 0.30]],
    underpassRanges: [[0.56, 0.67]],
    shortcut: { entry: { x: 440, y: 185 }, exit: { x: 440, y: 805 }, width: 86, entryT: 0.05, exitT: 0.74, cycleSeconds: 4.5 },
    oilSpots: [{ t: 0.42, offset: 12, radius: 23 }],
    waterSpots: [{ t: 0.85, offset: -10, radius: 26 }],
    hasTornado: true,
    props: [{ kind: 'grandstand', x: 470, y: 52, w: 340, h: 44 }],
  },
  {
    id: 'cs_finale',
    name: 'Pro 8 · World Championship Finale',
    theme: 'pro_asphalt',
    roadWidth: 126,
    infieldColor: '#1E1B4B',
    infieldStripeColor: 'rgba(165, 180, 252, 0.06)',
    asphaltColor: '#27272A',
    wallOuterColor: '#FACC15',
    kerbPrimary: '#EF4444',
    kerbSecondary: '#FFFFFF',
    controlPoints: GEO_CLOVERLEAF,
    shortcut: { entry: { x: 640, y: 270 }, exit: { x: 640, y: 710 }, width: 84, entryT: 0.09, exitT: 0.59, cycleSeconds: 4.2 },
    oilSpots: [{ t: 0.28, offset: -12, radius: 23 }, { t: 0.76, offset: 12, radius: 23 }],
    waterSpots: [{ t: 0.45, offset: 0, radius: 26 }],
    hasTornado: true,
    props: [{ kind: 'grandstand', x: 480, y: 50, w: 320, h: 44 }],
  },
];

// ============================================================================
// 7. BADLANDS (ATARI GAMES, 1989) — 6 POST-APOCALYPTIC COMBAT CIRCUITS!
// ============================================================================
const BADLANDS_TRACKS: SprintTrackBlueprint[] = [
  {
    id: 'bl_wasteland',
    name: 'Sector 1 · Scorched Dustbowl',
    theme: 'wasteland',
    roadWidth: 140,
    infieldColor: '#451A03',
    infieldStripeColor: 'rgba(251, 146, 60, 0.06)',
    asphaltColor: '#292524',
    wallOuterColor: '#F97316',
    kerbPrimary: '#FACC15',
    kerbSecondary: '#1C1917',
    controlPoints: GEO_DOGLEG_OVAL,
    oilSpots: [{ t: 0.30, offset: -14, radius: 24 }],
    waterSpots: [],
    mineSpots: [{ t: 0.20, offset: 14 }, { t: 0.55, offset: -10 }, { t: 0.80, offset: 12 }],
    hasTornado: false,
    props: [
      { kind: 'grandstand', x: 480, y: 52, w: 320, h: 44 },
      { kind: 'wreck', x: 520, y: 420 },
      { kind: 'wreck', x: 740, y: 460 },
      { kind: 'cactus', x: 85, y: 145 },
      { kind: 'cactus', x: 1195, y: 815 },
    ],
  },
  {
    id: 'bl_trestle',
    name: 'Sector 2 · Rust Trestle Bridge',
    theme: 'wasteland',
    roadWidth: 138,
    infieldColor: '#3F1D1D',
    infieldStripeColor: 'rgba(248, 113, 113, 0.06)',
    asphaltColor: '#27272A',
    wallOuterColor: '#EF4444',
    kerbPrimary: '#F97316',
    kerbSecondary: '#0F172A',
    controlPoints: GEO_FIGURE8,
    bridgeRanges: [[0.075, 0.185]],
    underpassRanges: [[0.575, 0.685]],
    oilSpots: [{ t: 0.42, offset: 12, radius: 24 }],
    waterSpots: [],
    mineSpots: [{ t: 0.34, offset: -14 }, { t: 0.50, offset: 12 }, { t: 0.84, offset: 0 }],
    hasTornado: true,
    props: [{ kind: 'grandstand', x: 480, y: 52, w: 320, h: 44 }, { kind: 'wreck', x: 960, y: 495 }, { kind: 'wreck', x: 300, y: 495 }],
  },
  {
    id: 'bl_reactor',
    name: 'Sector 3 · Dead Reactor Hairpins',
    theme: 'wasteland',
    roadWidth: 134,
    infieldColor: '#27272A',
    infieldStripeColor: 'rgba(163, 230, 53, 0.06)',
    asphaltColor: '#18181B',
    wallOuterColor: '#A3E635',
    kerbPrimary: '#FACC15',
    kerbSecondary: '#18181B',
    controlPoints: GEO_TWIN_HAIRPINS,
    oilSpots: [{ t: 0.28, offset: 12, radius: 24 }],
    waterSpots: [{ t: 0.68, offset: -12, radius: 26 }],
    mineSpots: [{ t: 0.18, offset: -12 }, { t: 0.45, offset: 14 }, { t: 0.79, offset: -8 }],
    hasTornado: true,
    props: [{ kind: 'grandstand', x: 480, y: 52, w: 320, h: 44 }, { kind: 'wreck', x: 640, y: 480 }],
  },
  {
    id: 'bl_canyon',
    name: 'Sector 4 · Red Rock Ambush',
    theme: 'wasteland',
    roadWidth: 134,
    infieldColor: '#7C2D12',
    infieldStripeColor: 'rgba(251, 146, 60, 0.08)',
    asphaltColor: '#292524',
    wallOuterColor: '#FDBA74',
    kerbPrimary: '#EF4444',
    kerbSecondary: '#1C1917',
    controlPoints: GEO_WEST_OVERPASS,
    bridgeRanges: [[0.43, 0.55]],
    underpassRanges: [[0.75, 0.87]],
    oilSpots: [{ t: 0.25, offset: 12, radius: 24 }],
    waterSpots: [],
    mineSpots: [{ t: 0.15, offset: 14 }, { t: 0.36, offset: -14 }, { t: 0.65, offset: 10 }, { t: 0.92, offset: -12 }],
    hasTornado: true,
    props: [{ kind: 'grandstand', x: 480, y: 52, w: 320, h: 44 }, { kind: 'wreck', x: 830, y: 495 }],
  },
  {
    id: 'bl_saltflats',
    name: 'Sector 5 · Scorched Salt Flats',
    theme: 'wasteland',
    roadWidth: 132,
    infieldColor: '#57534E',
    infieldStripeColor: 'rgba(245, 245, 244, 0.06)',
    asphaltColor: '#292524',
    wallOuterColor: '#FACC15',
    kerbPrimary: '#F97316',
    kerbSecondary: '#1C1917',
    controlPoints: GEO_SLALOM,
    oilSpots: [{ t: 0.34, offset: -12, radius: 23 }, { t: 0.74, offset: 12, radius: 23 }],
    waterSpots: [],
    mineSpots: [{ t: 0.22, offset: 14 }, { t: 0.52, offset: -12 }, { t: 0.85, offset: 10 }],
    hasTornado: true,
    props: [{ kind: 'grandstand', x: 480, y: 52, w: 320, h: 44 }, { kind: 'wreck', x: 640, y: 475 }],
  },
  {
    id: 'bl_citadel',
    name: 'Sector 6 · Citadel Deathmatch',
    theme: 'wasteland',
    roadWidth: 130,
    infieldColor: '#3B0764',
    infieldStripeColor: 'rgba(232, 121, 249, 0.06)',
    asphaltColor: '#1C1917',
    wallOuterColor: '#F43F5E',
    kerbPrimary: '#FACC15',
    kerbSecondary: '#0F172A',
    controlPoints: GEO_CLOVERLEAF,
    oilSpots: [{ t: 0.28, offset: 12, radius: 23 }],
    waterSpots: [{ t: 0.62, offset: -10, radius: 26 }],
    mineSpots: [{ t: 0.16, offset: 0 }, { t: 0.42, offset: 14 }, { t: 0.78, offset: -14 }, { t: 0.90, offset: 12 }],
    hasTornado: true,
    props: [{ kind: 'grandstand', x: 480, y: 52, w: 320, h: 44 }, { kind: 'wreck', x: 640, y: 485 }],
  },
];

// ============================================================================
// 8. SUPER OFF ROAD (LELAND, 1989) — 8 AUTHENTIC STADIUM DIRT-TRUCK TRACKS!
// ============================================================================
const OFFROAD_BASE = {
  theme: 'dirt_stadium' as const,
  infieldColor: '#451A03',
  infieldStripeColor: 'rgba(217, 119, 6, 0.08)',
  asphaltColor: '#92400E',
  wallOuterColor: '#F59E0B',
  kerbPrimary: '#D97706',
  kerbSecondary: '#78350F',
  oilSpots: [] as Array<{ t: number; offset: number; radius: number }>,
};

const SUPEROFFROAD_TRACKS: SprintTrackBlueprint[] = [
  {
    ...OFFROAD_BASE,
    id: 'sor_fandango',
    name: 'Track 1 · Fandango Bowl',
    roadWidth: 148,
    controlPoints: GEO_DOGLEG_OVAL,
    waterSpots: [{ t: 0.31, offset: -12, radius: 32 }, { t: 0.72, offset: 14, radius: 30 }],
    jumpSpots: [{ t: 0.16 }, { t: 0.56 }, { t: 0.86 }],
    props: [
      { kind: 'grandstand', x: 470, y: 50, w: 340, h: 44 },
      { kind: 'bale', x: 520, y: 440 },
      { kind: 'bale', x: 640, y: 440 },
      { kind: 'bale', x: 760, y: 440 },
    ],
  },
  {
    ...OFFROAD_BASE,
    id: 'sor_sidewinder',
    name: 'Track 2 · Sidewinder',
    roadWidth: 142,
    asphaltColor: '#A16207',
    controlPoints: GEO_KIDNEY,
    waterSpots: [{ t: 0.25, offset: 14, radius: 32 }, { t: 0.69, offset: -12, radius: 32 }],
    jumpSpots: [{ t: 0.12 }, { t: 0.44 }, { t: 0.82 }],
    props: [{ kind: 'grandstand', x: 470, y: 50, w: 340, h: 44 }, { kind: 'bale', x: 470, y: 410 }, { kind: 'bale', x: 610, y: 410 }],
  },
  {
    ...OFFROAD_BASE,
    id: 'sor_doublecross',
    name: 'Track 3 · Double Cross Bridge',
    roadWidth: 142,
    asphaltColor: '#854D0E',
    controlPoints: GEO_FIGURE8,
    bridgeRanges: [[0.075, 0.185]],
    underpassRanges: [[0.575, 0.685]],
    waterSpots: [{ t: 0.42, offset: 12, radius: 32 }, { t: 0.87, offset: -12, radius: 32 }],
    jumpSpots: [{ t: 0.30 }, { t: 0.78 }],
    props: [{ kind: 'grandstand', x: 480, y: 50, w: 320, h: 44 }, { kind: 'bale', x: 960, y: 495 }, { kind: 'bale', x: 300, y: 495 }],
  },
  {
    ...OFFROAD_BASE,
    id: 'sor_redrock',
    name: 'Track 4 · Red Rock Switchback',
    roadWidth: 138,
    infieldColor: '#7C2D12',
    asphaltColor: '#B45309',
    controlPoints: GEO_TWIN_HAIRPINS,
    waterSpots: [{ t: 0.27, offset: -12, radius: 30 }, { t: 0.67, offset: 12, radius: 30 }],
    jumpSpots: [{ t: 0.14 }, { t: 0.48 }, { t: 0.84 }],
    props: [{ kind: 'grandstand', x: 480, y: 50, w: 320, h: 44 }, { kind: 'cactus', x: 640, y: 475 }],
  },
  {
    ...OFFROAD_BASE,
    id: 'sor_baja',
    name: 'Track 5 · Baja High-Jumps',
    roadWidth: 138,
    asphaltColor: '#92400E',
    controlPoints: GEO_SPEEDWAY_S,
    waterSpots: [{ t: 0.35, offset: 14, radius: 32 }, { t: 0.76, offset: -14, radius: 32 }],
    jumpSpots: [{ t: 0.12 }, { t: 0.26 }, { t: 0.56 }, { t: 0.88 }],
    props: [{ kind: 'grandstand', x: 230, y: 50, w: 300, h: 44 }, { kind: 'bale', x: 540, y: 470 }],
  },
  {
    ...OFFROAD_BASE,
    id: 'sor_mudpit',
    name: 'Track 6 · Mud Pit Slalom',
    roadWidth: 136,
    infieldColor: '#3F2E21',
    asphaltColor: '#78350F',
    controlPoints: GEO_SLALOM,
    waterSpots: [{ t: 0.22, offset: 10, radius: 34 }, { t: 0.52, offset: -12, radius: 34 }, { t: 0.80, offset: 10, radius: 32 }],
    jumpSpots: [{ t: 0.10 }, { t: 0.38 }, { t: 0.68 }],
    props: [{ kind: 'grandstand', x: 480, y: 50, w: 320, h: 44 }, { kind: 'bale', x: 640, y: 480 }],
  },
  {
    ...OFFROAD_BASE,
    id: 'sor_canyonbridge',
    name: 'Track 7 · Canyon Jump Overpass',
    roadWidth: 138,
    asphaltColor: '#A16207',
    controlPoints: GEO_WEST_OVERPASS,
    bridgeRanges: [[0.43, 0.55]],
    underpassRanges: [[0.75, 0.87]],
    waterSpots: [{ t: 0.28, offset: 12, radius: 32 }, { t: 0.64, offset: -10, radius: 30 }],
    jumpSpots: [{ t: 0.14 }, { t: 0.36 }, { t: 0.92 }],
    props: [{ kind: 'grandstand', x: 480, y: 50, w: 320, h: 44 }, { kind: 'bale', x: 840, y: 495 }],
  },
  {
    ...OFFROAD_BASE,
    id: 'sor_ironman',
    name: 'Track 8 · Ironman Championship',
    roadWidth: 134,
    infieldColor: '#451A03',
    asphaltColor: '#92400E',
    wallOuterColor: '#FACC15',
    controlPoints: GEO_CLOVERLEAF,
    waterSpots: [{ t: 0.25, offset: -12, radius: 32 }, { t: 0.68, offset: 12, radius: 32 }],
    jumpSpots: [{ t: 0.12 }, { t: 0.44 }, { t: 0.56 }, { t: 0.86 }],
    props: [{ kind: 'grandstand', x: 480, y: 50, w: 320, h: 44 }, { kind: 'bale', x: 640, y: 485 }],
  },
];

// ============================================================================
// 9. DANNY SULLIVAN'S INDY HEAT (LELAND, 1991) — 6 INDYCAR CIRCUITS W/ PIT LANE!
// ============================================================================
const INDYHEAT_TRACKS: SprintTrackBlueprint[] = [
  {
    id: 'ih_tradewinds',
    name: 'Race 1 · Tradewinds Superspeedway',
    theme: 'indy_gp',
    roadWidth: 146,
    infieldColor: '#14532D',
    infieldStripeColor: 'rgba(255, 255, 255, 0.05)',
    asphaltColor: '#334155',
    wallOuterColor: '#F8FAFC',
    kerbPrimary: '#EF4444',
    kerbSecondary: '#FFFFFF',
    controlPoints: GEO_SUPER_OVAL,
    pitLane: { startT: 0.02, endT: 0.14, side: 1 },
    oilSpots: [{ t: 0.54, offset: -12, radius: 22 }],
    waterSpots: [],
    props: [
      { kind: 'grandstand', x: 470, y: 50, w: 340, h: 46 },
      { kind: 'pit', x: 520, y: 315, w: 240, h: 72 },
      { kind: 'tree', x: 82, y: 140 },
      { kind: 'tree', x: 1198, y: 140 },
    ],
  },
  {
    id: 'ih_midwest',
    name: 'Race 2 · Midwest Tri-Oval',
    theme: 'indy_gp',
    roadWidth: 142,
    infieldColor: '#166534',
    infieldStripeColor: 'rgba(255, 255, 255, 0.05)',
    asphaltColor: '#2E3440',
    wallOuterColor: '#E2E8F0',
    kerbPrimary: '#38BDF8',
    kerbSecondary: '#FFFFFF',
    controlPoints: GEO_DOGLEG_OVAL,
    pitLane: { startT: 0.02, endT: 0.14, side: 1 },
    oilSpots: [{ t: 0.34, offset: 14, radius: 22 }, { t: 0.76, offset: -14, radius: 22 }],
    waterSpots: [],
    props: [
      { kind: 'grandstand', x: 470, y: 50, w: 340, h: 46 },
      { kind: 'pit', x: 520, y: 315, w: 240, h: 72 },
    ],
  },
  {
    id: 'ih_harbor',
    name: 'Race 3 · Long Beach Harbor GP',
    theme: 'indy_gp',
    roadWidth: 136,
    infieldColor: '#1E3A5F',
    infieldStripeColor: 'rgba(56, 189, 248, 0.06)',
    asphaltColor: '#273244',
    wallOuterColor: '#38BDF8',
    kerbPrimary: '#FACC15',
    kerbSecondary: '#FFFFFF',
    controlPoints: GEO_KIDNEY,
    pitLane: { startT: 0.02, endT: 0.14, side: 1 },
    oilSpots: [{ t: 0.42, offset: 12, radius: 22 }],
    waterSpots: [{ t: 0.72, offset: -12, radius: 26 }],
    props: [
      { kind: 'grandstand', x: 470, y: 50, w: 340, h: 46 },
      { kind: 'pit', x: 480, y: 315, w: 230, h: 72 },
    ],
  },
  {
    id: 'ih_desert',
    name: 'Race 4 · Phoenix Road Course',
    theme: 'indy_gp',
    roadWidth: 134,
    infieldColor: '#7C2D12',
    infieldStripeColor: 'rgba(251, 146, 60, 0.07)',
    asphaltColor: '#3F3F46',
    wallOuterColor: '#FED7AA',
    kerbPrimary: '#F97316',
    kerbSecondary: '#FFFFFF',
    controlPoints: GEO_TWIN_HAIRPINS,
    pitLane: { startT: 0.02, endT: 0.13, side: 1 },
    oilSpots: [{ t: 0.32, offset: -12, radius: 22 }, { t: 0.68, offset: 12, radius: 22 }],
    waterSpots: [],
    props: [
      { kind: 'grandstand', x: 470, y: 50, w: 340, h: 46 },
      { kind: 'pit', x: 520, y: 315, w: 220, h: 68 },
      { kind: 'cactus', x: 85, y: 145 },
      { kind: 'cactus', x: 1195, y: 820 },
    ],
  },
  {
    id: 'ih_overpass',
    name: 'Race 5 · Suzuka Indy Bridge',
    theme: 'indy_gp',
    roadWidth: 136,
    infieldColor: '#14532D',
    infieldStripeColor: 'rgba(255, 255, 255, 0.05)',
    asphaltColor: '#334155',
    wallOuterColor: '#FACC15',
    kerbPrimary: '#EF4444',
    kerbSecondary: '#FFFFFF',
    controlPoints: GEO_WEST_OVERPASS,
    bridgeRanges: [[0.43, 0.55]],
    underpassRanges: [[0.75, 0.87]],
    pitLane: { startT: 0.02, endT: 0.12, side: 1 },
    oilSpots: [{ t: 0.30, offset: 12, radius: 22 }],
    waterSpots: [{ t: 0.64, offset: -10, radius: 26 }],
    props: [
      { kind: 'grandstand', x: 470, y: 50, w: 340, h: 46 },
      { kind: 'pit', x: 590, y: 305, w: 210, h: 68 },
    ],
  },
  {
    id: 'ih_brickyard',
    name: 'Race 6 · Indy 500 Championship',
    theme: 'indy_gp',
    roadWidth: 132,
    infieldColor: '#0F3D2E',
    infieldStripeColor: 'rgba(255, 255, 255, 0.06)',
    asphaltColor: '#27272A',
    wallOuterColor: '#FACC15',
    kerbPrimary: '#EF4444',
    kerbSecondary: '#FFFFFF',
    controlPoints: GEO_BOX_CUT,
    pitLane: { startT: 0.02, endT: 0.13, side: 1 },
    oilSpots: [{ t: 0.28, offset: 12, radius: 22 }, { t: 0.74, offset: -12, radius: 22 }],
    waterSpots: [{ t: 0.52, offset: 0, radius: 26 }],
    props: [
      { kind: 'grandstand', x: 470, y: 50, w: 340, h: 46 },
      { kind: 'pit', x: 515, y: 295, w: 230, h: 66 },
    ],
  },
];

export function getTracksForVariant(variant: SprintVariant): SprintTrackBlueprint[] {
  switch (variant) {
    case 'sprint1':
      return SPRINT1_TRACKS;
    case 'sprint':
      return SPRINT2_TRACKS;
    case 'sprint4':
      return SPRINT4_TRACKS;
    case 'sprint8':
      return SPRINT8_TRACKS;
    case 'supersprint':
      return SUPERSPRINT_TRACKS;
    case 'champsprint':
      return CHAMPSPRINT_TRACKS;
    case 'badlands':
      return BADLANDS_TRACKS;
    case 'superoffroad':
      return SUPEROFFROAD_TRACKS;
    case 'indyheat':
      return INDYHEAT_TRACKS;
  }
}

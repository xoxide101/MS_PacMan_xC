// ============================================================================
// HD-2D MODERN-COLOR PIXEL ART SPRITE & TILE ATLAS (Ys I & II Chronicles+ 2.5D)
// Procedural high-detail pixel art rendered onto offscreen pixel buffers with
// crisp nearest-neighbor scaling (imageSmoothingEnabled = false), modern 24-bit
// realistic color ramps, metallic specular glints, dithered natural textures,
// and directional sunlit shadows for a rich front-angled 2.5D presentation!
// ============================================================================

import type { ZoneDef } from './ysWorldBuilder';

export type Dir4 = 'down' | 'up' | 'left' | 'right';

export interface YsPixelAtlas {
  ground: Record<string, HTMLCanvasElement[]>;
  waterFrames: Record<'ocean' | 'sky' | 'lava', HTMLCanvasElement[]>;
  bridge: Record<'wood' | 'ice', HTMLCanvasElement>;
  wall: Record<'cliff' | 'town' | 'mine' | 'tower' | 'ice', HTMLCanvasElement[]>;
  tree: Record<'oak' | 'blossom' | 'roda' | 'marble' | 'ice' | 'obsidian', HTMLCanvasElement>;
  shrub: Record<'berry' | 'fern' | 'blossom' | 'frost_bush' | 'ember_fern', HTMLCanvasElement>;
  chestClosed: HTMLCanvasElement;
  chestOpen: HTMLCanvasElement;
  adol: Record<Dir4, HTMLCanvasElement[]>;
  enemy: Record<'slime' | 'goblin' | 'knight' | 'mage' | 'wyvern' | 'boss', HTMLCanvasElement[]>;
  npcCache: Map<string, HTMLCanvasElement>;
  getNpcSprite: (hair: string, tunic: string, cloak: string, dir: Dir4) => HTMLCanvasElement;
}

// Deterministic fast pixel hash for organic pixel texture grain
function hash2(x: number, y: number, seed: number): number {
  let n = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967296;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, w = 1, h = 1): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
}

function drawPixelEllipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: string,
  ditherEdge = false
): void {
  ctx.fillStyle = color;
  const x0 = Math.floor(cx - rx - 1);
  const x1 = Math.ceil(cx + rx + 1);
  const y0 = Math.floor(cy - ry - 1);
  const y1 = Math.ceil(cy + ry + 1);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      const d = nx * nx + ny * ny;
      if (d <= 1.0) {
        if (ditherEdge && d > 0.72 && ((x + y) & 1) === 0) continue;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

// ----------------------------------------------------------------------------
// 1. FORESHORTENED 2.5D PIXEL GROUND TILES (22 x 16 px -> drawn 44 x 32 px)
// ----------------------------------------------------------------------------
function buildGroundTile(
  kind: 'meadow' | 'plains_earth' | 'plains_grass' | 'cobble' | 'carpet' | 'mine' | 'tower' | 'ice' | 'village',
  variant: number
): HTMLCanvasElement {
  const W = 22;
  const H = 16;
  const [c, ctx] = makeCanvas(W, H);

  if (kind === 'meadow' || kind === 'village') {
    const base = kind === 'village'
      ? ['#2f6f3e', '#3b8349', '#499855', '#5eb266', '#81cc7c']
      : ['#35692b', '#417d33', '#4f913c', '#64aa48', '#87c55e'];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const n = hash2(x, y, variant * 17 + 3);
        const shade = n < 0.14 ? base[0] : n < 0.5 ? base[1] : n < 0.84 ? base[2] : base[3];
        px(ctx, x, y, shade);
      }
    }
    // Crisp sunlit pixel grass blades & clover tufts
    for (let i = 0; i < 6; i++) {
      const gx = Math.floor(hash2(i, 1, variant + 9) * (W - 3)) + 1;
      const gy = Math.floor(hash2(i, 2, variant + 9) * (H - 3)) + 1;
      px(ctx, gx, gy + 1, base[0]);
      px(ctx, gx, gy, base[3]);
      px(ctx, gx + 1, gy - 1, base[4]);
      px(ctx, gx + 2, gy, base[3]);
    }
    if (variant === 3) {
      // Tiny sunlit wildflower speckles
      px(ctx, 5, 6, '#fef08a');
      px(ctx, 16, 11, kind === 'village' ? '#f9a8d4' : '#ffffff');
    }
    return c;
  }

  if (kind === 'plains_earth') {
    // Authentic Ys Chronicles+ cracked warm olive-ochre rocky soil
    const ramp = ['#5a5339', '#756c4b', '#8b825b', '#9d946b', '#b3aa7f'];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const n = hash2(x, y, variant * 31 + 11);
        px(ctx, x, y, n < 0.1 ? ramp[0] : n < 0.35 ? ramp[1] : n < 0.72 ? ramp[2] : n < 0.92 ? ramp[3] : ramp[4]);
      }
    }
    // Organic dark soil crack line
    if (variant % 2 === 0) {
      const cy = 5 + (variant % 3) * 3;
      px(ctx, 4, cy, '#47412b', 3, 1);
      px(ctx, 7, cy + 1, '#47412b', 4, 1);
      px(ctx, 11, cy, '#47412b', 3, 1);
      px(ctx, 5, cy + 1, '#afa67c', 2, 1);
    } else {
      // Small weathered stone pebble with sunlit rim & drop shadow
      px(ctx, 12, 9, '#3e3826', 4, 2);
      px(ctx, 12, 8, '#6e6a59', 3, 2);
      px(ctx, 12, 8, '#a5a28e', 2, 1);
    }
    return c;
  }

  if (kind === 'plains_grass') {
    // Rich clustered pixel grass over ochre rocky earth (Screenshot 1 & 4 look!)
    const baseEarth = buildGroundTile('plains_earth', variant);
    ctx.drawImage(baseEarth, 0, 0);
    const grass = ['#1f4614', '#2e641c', '#438426', '#5ea334', '#85c749'];
    // Organic dense overlapping grass tufts
    drawPixelEllipse(ctx, 11, 9, 10, 7, grass[0], true);
    drawPixelEllipse(ctx, 10, 8, 9, 6, grass[1], true);
    drawPixelEllipse(ctx, 11, 7, 7.5, 5, grass[2], false);
    for (let i = 0; i < 14; i++) {
      const gx = Math.floor(hash2(i, 4, variant * 13) * 18) + 2;
      const gy = Math.floor(hash2(i, 7, variant * 13) * 12) + 2;
      px(ctx, gx, gy, grass[3]);
      if (i % 2 === 0) px(ctx, gx, gy - 1, grass[4]);
    }
    if (variant === 2) {
      px(ctx, 9, 6, '#fde047');
      px(ctx, 10, 7, '#f59e0b');
    }
    return c;
  }

  if (kind === 'cobble') {
    // Modern-palette warm European limestone cobblestone mosaic with deep mortar & sunlit top rims!
    px(ctx, 0, 0, '#5a4a38', W, H);
    const stones: Array<[number, number, number, number, string, string]> = [
      [1, 1, 9, 6, '#cbb58f', '#e5d4b2'],
      [11, 1, 10, 6, '#bfa780', '#dac6a2'],
      [0, 8, 5, 7, '#b9a17a', '#d4bf9b'],
      [6, 8, 9, 7, '#d1bc96', '#ebdbb9'],
      [16, 8, 6, 7, '#c2aa83', '#dcc8a3'],
    ];
    for (let i = 0; i < stones.length; i++) {
      const [sx, sy, sw, sh, mid, hi] = stones[i];
      px(ctx, sx, sy, mid, sw, sh);
      px(ctx, sx, sy, hi, sw - 1, 1);
      px(ctx, sx, sy + 1, hi, 1, sh - 2);
      px(ctx, sx + 1, sy + sh - 1, '#98815e', sw - 1, 1);
      // Realistic subtle pixel stone pitting
      if ((i + variant) % 2 === 0) {
        px(ctx, sx + 3, sy + 3, '#a68e6a');
      }
    }
    return c;
  }

  if (kind === 'carpet') {
    // Royal crimson-velvet temple runner with woven gold filigree
    px(ctx, 0, 0, '#58111c', W, H);
    px(ctx, 2, 0, '#881827', W - 4, H);
    px(ctx, 3, 0, '#a31f30', W - 6, H);
    px(ctx, 2, 0, '#e5a93c', 1, H);
    px(ctx, W - 3, 0, '#e5a93c', 1, H);
    // Woven diamond gold motif
    px(ctx, 10, 3, '#f5c962', 2, 1);
    px(ctx, 9, 4, '#f5c962', 1, 1);
    px(ctx, 12, 4, '#f5c962', 1, 1);
    px(ctx, 8, 5, '#c98827', 1, 2);
    px(ctx, 13, 5, '#c98827', 1, 2);
    px(ctx, 9, 7, '#f5c962', 1, 1);
    px(ctx, 12, 7, '#f5c962', 1, 1);
    px(ctx, 10, 8, '#f5c962', 2, 1);
    // Subtle velvet weave
    for (let y = 0; y < H; y += 2) {
      px(ctx, 4, y, 'rgba(0,0,0,0.12)', W - 8, 1);
    }
    return c;
  }

  if (kind === 'mine' || kind === 'tower') {
    // Rough-hewn carved dungeon / Abandoned Mine 1F stone pavers with deep realistic shadows!
    const mortar = kind === 'tower' ? '#170a12' : '#1c1812';
    const lo = kind === 'tower' ? '#2c1522' : '#352f25';
    const mid = kind === 'tower' ? '#3d1f30' : '#4a4234';
    const hi = kind === 'tower' ? '#582f46' : '#665c49';
    px(ctx, 0, 0, mortar, W, H);
    const slabs: Array<[number, number, number, number]> = [
      [1, 1, 9, 6], [11, 1, 10, 6],
      [1, 8, 6, 7], [8, 8, 8, 7], [17, 8, 4, 7],
    ];
    for (let i = 0; i < slabs.length; i++) {
      const [sx, sy, sw, sh] = slabs[i];
      const baseCol = (i + variant) % 3 === 0 ? lo : mid;
      px(ctx, sx, sy, baseCol, sw, sh);
      px(ctx, sx, sy, hi, sw - 1, 1);
      px(ctx, sx, sy + sh - 1, '#231e18', sw, 1);
      for (let py = sy + 1; py < sy + sh - 1; py++) {
        for (let px0 = sx; px0 < sx + sw; px0++) {
          const n = hash2(px0, py, variant * 19 + i);
          if (n < 0.16) px(ctx, px0, py, lo);
          else if (n > 0.88) px(ctx, px0, py, hi);
        }
      }
    }
    if (kind === 'tower' && variant === 2) {
      // Glowing hairline magma fissure
      px(ctx, 5, 7, '#f97316', 4, 1);
      px(ctx, 9, 8, '#fde047', 3, 1);
    }
    return c;
  }

  // Glacial faceted crystal ice floor
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = hash2(x, y, variant * 23);
      px(ctx, x, y, n < 0.25 ? '#5bc4f5' : n < 0.72 ? '#8adbfa' : '#c4eeff');
    }
  }
  px(ctx, 3, 4, '#ffffff', 5, 1);
  px(ctx, 7, 3, '#ffffff', 3, 1);
  px(ctx, 14, 11, '#38bdf8', 6, 1);
  return c;
}

function buildWaterFrame(kind: 'ocean' | 'sky' | 'lava', frame: number): HTMLCanvasElement {
  const W = 22;
  const H = 16;
  const [c, ctx] = makeCanvas(W, H);
  const pal =
    kind === 'lava'
      ? ['#7c2d12', '#b43c12', '#ea580c', '#fb923c', '#fef08a']
      : kind === 'sky'
        ? ['#0284c7', '#0ea5e9', '#38bdf8', '#bae6fd', '#ffffff']
        : ['#074d75', '#0a6594', '#0e7eb4', '#38a7d6', '#bae6fd'];

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const wx = (x + frame * 3 + Math.floor(Math.sin((y + frame) * 0.7) * 2) + W) % W;
      const wave = Math.sin(wx * 0.58 + y * 0.45);
      const col = wave < -0.5 ? pal[0] : wave < 0.1 ? pal[1] : wave < 0.62 ? pal[2] : wave < 0.86 ? pal[3] : pal[4];
      px(ctx, x, y, col);
    }
  }
  // Crisp sparkling caustic glint
  const sx = (4 + frame * 5) % (W - 4);
  const sy = (3 + frame * 3) % (H - 3);
  px(ctx, sx, sy, pal[4], 3, 1);
  px(ctx, (sx + 10) % (W - 3), (sy + 7) % (H - 2), pal[4], 2, 1);
  return c;
}

function buildBridgeTile(kind: 'wood' | 'ice'): HTMLCanvasElement {
  const W = 22;
  const H = 16;
  const [c, ctx] = makeCanvas(W, H);
  if (kind === 'ice') {
    px(ctx, 0, 0, '#38bdf8', W, H);
    px(ctx, 1, 1, '#bae6fd', W - 2, H - 2);
    px(ctx, 2, 2, '#e0f2fe', W - 4, 2);
    px(ctx, 2, H - 3, '#0284c7', W - 4, 2);
    return c;
  }
  px(ctx, 0, 0, '#3d1e0a', W, H);
  for (let py = 0; py < H; py += 4) {
    px(ctx, 1, py, '#8a4c1d', W - 2, 3);
    px(ctx, 1, py, '#b87032', W - 2, 1);
    px(ctx, 2, py + 1, '#451a03', 1, 1);
    px(ctx, W - 3, py + 1, '#451a03', 1, 1);
  }
  return c;
}

// ----------------------------------------------------------------------------
// 2. FRONT-ANGLED 2.5D TALL CLIFF & STONE WALL BLOCKS (22 x 30 px -> 44 x 60 px!)
// Shows deep vertical front rock/masonry face + shadowed top ledge!
// ----------------------------------------------------------------------------
function buildWallBlock(kind: 'cliff' | 'town' | 'mine' | 'tower' | 'ice', variant: number): HTMLCanvasElement {
  const W = 22;
  const H = 30;
  const [c, ctx] = makeCanvas(W, H);

  if (kind === 'cliff') {
    // Stratified ochre/umber rock-ridge cliff with overhanging lush emerald grass crown!
    // Front vertical rock face (y: 9..29)
    px(ctx, 0, 9, '#3d3321', W, H - 9);
    const rocks: Array<[number, number, number, number, string, string]> = [
      [0, 10, 10, 7, '#7d6e4c', '#9c8c64'],
      [11, 10, 11, 7, '#706243', '#8f7f59'],
      [0, 18, 7, 6, '#65573b', '#837351'],
      [8, 18, 9, 6, '#756647', '#94845f'],
      [18, 18, 4, 6, '#5c4f35', '#786948'],
      [1, 25, 11, 5, '#544830', '#706243'],
      [13, 25, 9, 5, '#4b402a', '#685a3d'],
    ];
    for (const [rx, ry, rw, rh, mid, hi] of rocks) {
      px(ctx, rx, ry, mid, rw, rh);
      px(ctx, rx, ry, hi, rw - 1, 1);
      px(ctx, rx, ry + rh - 1, '#332a1b', rw, 1);
    }
    // Deep cast overhang shadow under grass lip!
    px(ctx, 0, 9, 'rgba(18, 14, 8, 0.65)', W, 2);
    // Lush overhanging pixel grass ledge on top (y: 0..9)
    px(ctx, 0, 0, '#3d7d23', W, 8);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < W; x++) {
        const n = hash2(x, y, variant * 41);
        px(ctx, x, y, n < 0.2 ? '#295817' : n < 0.65 ? '#438826' : n < 0.9 ? '#63ad38' : '#8fd154');
      }
    }
    // Sunlit top rim + scalloped grassy overhang fringe
    px(ctx, 0, 0, '#96d85b', W, 1);
    for (let x = 0; x < W; x += 2) {
      const drop = (x + variant * 3) % 4 === 0 ? 2 : 1;
      px(ctx, x, 8, '#295817', 2, drop);
    }
    // Dark AO contact line at very foot of cliff
    px(ctx, 0, H - 1, '#1d170f', W, 1);
    return c;
  }

  if (kind === 'town') {
    // Weathered limestone medieval rampart wall with battlements & hanging ivy!
    px(ctx, 0, 8, '#384152', W, H - 8);
    // Ashlar stone blocks with warm sunlit top edges
    const rows = [9, 15, 21, 26];
    rows.forEach((ry, ri) => {
      const rh = ri === 3 ? 4 : 5;
      const off = (ri % 2) * 5;
      for (let bx = -off; bx < W; bx += 11) {
        const x0 = Math.max(0, bx);
        const bw = Math.min(W - x0, bx + 10 - x0);
        if (bw <= 0) continue;
        px(ctx, x0, ry, (ri + variant) % 2 === 0 ? '#6b778c' : '#5e6a7e', bw, rh);
        px(ctx, x0, ry, '#9ba8bc', bw, 1);
        px(ctx, x0, ry + rh - 1, '#3e4859', bw, 1);
      }
    });
    // Top parapet stone walk + battlements
    px(ctx, 0, 2, '#9aa7bc', W, 6);
    px(ctx, 0, 2, '#d5dfed', W, 2);
    px(ctx, 0, 7, '#475569', W, 1);
    if (variant % 2 === 0) {
      px(ctx, 2, 0, '#cbd5e1', 7, 3);
      px(ctx, 2, 0, '#f1f5f9', 7, 1);
      px(ctx, 13, 0, '#cbd5e1', 7, 3);
      px(ctx, 13, 0, '#f1f5f9', 7, 1);
    }
    // Hanging emerald pixel ivy on select wall tiles
    if (variant === 1 || variant === 3) {
      px(ctx, 5, 7, '#166534', 5, 4);
      px(ctx, 6, 11, '#166534', 4, 4);
      px(ctx, 7, 15, '#14532d', 2, 3);
      px(ctx, 6, 8, '#4ade80', 2, 2);
      px(ctx, 7, 12, '#22c55e', 2, 2);
    }
    px(ctx, 0, H - 1, '#1e293b', W, 1);
    return c;
  }

  if (kind === 'mine' || kind === 'tower') {
    // Deep carved chiseled rock / obsidian citadel vertical wall (Screenshot 2 Mine look!)
    const topHi = kind === 'tower' ? '#702749' : '#756a57';
    const topMid = kind === 'tower' ? '#4f1933' : '#574e3f';
    const faceMid = kind === 'tower' ? '#361023' : '#3a3429';
    const faceLo = kind === 'tower' ? '#200814' : '#242019';
    const groove = kind === 'tower' ? '#14040c' : '#17140f';

    px(ctx, 0, 0, topMid, W, 8);
    px(ctx, 0, 0, topHi, W, 2);
    px(ctx, 0, 8, faceMid, W, H - 8);
    for (let x = 0; x < W; x += 5) {
      px(ctx, x, 8, groove, 1, H - 8);
      px(ctx, x + 1, 8, topMid, 1, H - 9);
      px(ctx, x + 3, 10, faceLo, 2, H - 10);
    }
    px(ctx, 0, 8, groove, W, 2);
    px(ctx, 0, H - 1, groove, W, 1);
    return c;
  }

  // Ice wall cliff
  px(ctx, 0, 0, '#bae6fd', W, 8);
  px(ctx, 0, 0, '#f0f9ff', W, 2);
  px(ctx, 0, 8, '#0284c7', W, H - 8);
  px(ctx, 2, 9, '#38bdf8', 7, H - 11);
  px(ctx, 12, 11, '#7dd3fc', 6, H - 13);
  px(ctx, 0, H - 1, '#075985', W, 1);
  return c;
}

// ----------------------------------------------------------------------------
// 3. TALL 2.5D FRONT-ANGLED PIXEL TREES & PILLARS (34 x 46 px -> 68 x 92 px!)
// Layered foliage boughs, sunlit upper-left pixels, deep under-canopy shadows!
// ----------------------------------------------------------------------------
function buildTreeSprite(kind: 'oak' | 'blossom' | 'roda' | 'marble' | 'ice' | 'obsidian'): HTMLCanvasElement {
  const W = 34;
  const H = 46;
  const [c, ctx] = makeCanvas(W, H);
  const cx = 17;

  if (kind === 'marble') {
    // Tall fluted Greek/Ys temple marble column with gold capital
    px(ctx, cx - 7, H - 7, '#475569', 14, 6);
    px(ctx, cx - 6, H - 8, '#cbd5e1', 12, 2);
    // Fluted column shaft
    px(ctx, cx - 5, 11, '#94a3b8', 10, H - 18);
    px(ctx, cx - 4, 11, '#f8fafc', 3, H - 18);
    px(ctx, cx, 11, '#e2e8f0', 2, H - 18);
    px(ctx, cx + 3, 11, '#64748b', 2, H - 18);
    // Ornate Corinthian capital
    px(ctx, cx - 8, 5, '#e2e8f0', 16, 6);
    px(ctx, cx - 8, 5, '#ffffff', 16, 2);
    px(ctx, cx - 7, 10, '#f59e0b', 14, 1);
    px(ctx, cx - 7, 11, '#334155', 14, 1);
    return c;
  }

  if (kind === 'ice') {
    // Tall gleaming crystal spire
    for (let y = 4; y < H - 3; y++) {
      const half = Math.max(1, Math.floor(((y - 4) / (H - 7)) * 11));
      px(ctx, cx - half, y, '#0284c7', half * 2, 1);
      px(ctx, cx - half + 1, y, '#38bdf8', Math.max(1, half), 1);
      px(ctx, cx - Math.floor(half * 0.5), y, '#e0f2fe', Math.max(1, Math.floor(half * 0.45)), 1);
    }
    return c;
  }

  if (kind === 'obsidian') {
    // Gothic dark obsidian spire with glowing crimson cleria crystal band
    px(ctx, cx - 6, 8, '#240b36', 12, H - 11);
    px(ctx, cx - 5, 8, '#4c1d6e', 4, H - 11);
    px(ctx, cx - 8, 4, '#3b1254', 16, 5);
    px(ctx, cx - 7, 4, '#7e22ce', 14, 1);
    px(ctx, cx - 6, 18, '#f43f5e', 12, 3);
    px(ctx, cx - 4, 19, '#fda4af', 8, 1);
    return c;
  }

  // Tall 2.5D Gnarled Oak / Blossom / Roda Tree!
  const pal =
    kind === 'roda'
      ? ['#063b2d', '#0b664b', '#10996d', '#34d399', '#fef08a']
      : kind === 'blossom'
        ? ['#134424', '#1d6e35', '#2f9c4a', '#5cd66c', '#fbcfe8']
        : ['#10331b', '#1b5428', '#2f7b34', '#50a63f', '#8dd156'];

  // Gnarled trunk with flared roots & sunlit left bark edge
  px(ctx, cx - 4, 24, '#3b1c0a', 8, 19);
  px(ctx, cx - 3, 24, '#6e3916', 5, 18);
  px(ctx, cx - 3, 25, '#965425', 2, 16);
  // Flared roots gripping ground
  px(ctx, cx - 7, 41, '#3b1c0a', 14, 3);
  px(ctx, cx - 6, 40, '#6e3916', 4, 3);
  px(ctx, cx + 2, 41, '#4f270e', 4, 2);

  // Layered 3D Pixel-Art Foliage Crown (deep shadow underside -> rich emerald mid -> sunlit top-left crown!)
  drawPixelEllipse(ctx, cx, 22, 15, 11, pal[0], true);
  drawPixelEllipse(ctx, cx - 7, 19, 9, 8, pal[0], false);
  drawPixelEllipse(ctx, cx + 7, 19, 9, 8, pal[0], false);

  drawPixelEllipse(ctx, cx, 18, 14, 10, pal[1], false);
  drawPixelEllipse(ctx, cx - 6, 15, 9, 7, pal[2], false);
  drawPixelEllipse(ctx, cx + 5, 16, 8, 7, pal[1], false);
  drawPixelEllipse(ctx, cx, 11, 11, 8, pal[2], false);

  // Sunlit upper-left leaf clusters (gives bold 2.5D volume!)
  drawPixelEllipse(ctx, cx - 5, 11, 6, 5, pal[3], true);
  drawPixelEllipse(ctx, cx + 2, 9, 6, 4.5, pal[3], true);
  drawPixelEllipse(ctx, cx - 3, 8, 4, 3, pal[4], false);

  // Crisp pixel leaf texture flecks & blossoms
  for (let i = 0; i < 24; i++) {
    const lx = Math.floor(cx - 12 + hash2(i, 1, 77) * 24);
    const ly = Math.floor(6 + hash2(i, 2, 77) * 20);
    if (lx < cx + 2 && ly < 17) px(ctx, lx, ly, i % 3 === 0 ? pal[4] : pal[3]);
    else if (ly > 20) px(ctx, lx, ly, pal[0]);
  }
  if (kind === 'blossom' || kind === 'roda') {
    const spots: Array<[number, number]> = [[11, 10], [21, 13], [15, 17], [9, 19], [23, 19], [17, 8]];
    for (const [bx, by] of spots) {
      px(ctx, bx, by, pal[4], 2, 2);
      px(ctx, bx, by, '#ffffff', 1, 1);
    }
  }
  return c;
}

// ----------------------------------------------------------------------------
// 4. PIXEL-ART SHRUBS & TREASURE CHESTS
// ----------------------------------------------------------------------------
function buildShrubSprite(variant: 'berry' | 'fern' | 'blossom' | 'frost_bush' | 'ember_fern'): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(20, 18);
  const pal: Record<typeof variant, [string, string, string, string]> = {
    berry: ['#113d20', '#1c6b32', '#3aa347', '#ef4444'],
    fern: ['#0a3a2c', '#0f7354', '#34c78d', '#a7f3d0'],
    blossom: ['#154726', '#23823d', '#58c966', '#f472b6'],
    frost_bush: ['#0b3c5d', '#0284c7', '#7dd3fc', '#f0f9ff'],
    ember_fern: ['#450a0a', '#b91c1c', '#f97316', '#fde047'],
  };
  const [lo, mid, hi, dot] = pal[variant];
  drawPixelEllipse(ctx, 10, 11, 8.5, 5.5, lo, true);
  drawPixelEllipse(ctx, 10, 9, 7.5, 5, mid, false);
  drawPixelEllipse(ctx, 8, 7, 4.5, 3, hi, true);
  drawPixelEllipse(ctx, 13, 8, 3.5, 2.5, hi, true);
  // Crisp berries / blossoms
  px(ctx, 6, 10, dot, 2, 2);
  px(ctx, 12, 7, dot, 2, 2);
  px(ctx, 11, 12, dot, 2, 1);
  return c;
}

function buildChestSprite(opened: boolean): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(18, 18);
  // Dark outline & warm oak body
  px(ctx, 2, 5, '#1e130a', 14, 11);
  px(ctx, 3, 6, opened ? '#422006' : '#92400e', 12, 9);
  if (!opened) {
    // Rounded sunlit top lid
    px(ctx, 3, 6, '#c2651a', 12, 4);
    px(ctx, 4, 6, '#e58e35', 10, 1);
    // Gleaming brass/gold bands & lock clasp
    px(ctx, 5, 6, '#fbbf24', 2, 9);
    px(ctx, 11, 6, '#fbbf24', 2, 9);
    px(ctx, 3, 10, '#451a03', 12, 1);
    px(ctx, 8, 9, '#fef08a', 2, 3);
  } else {
    // Open interior dark recess
    px(ctx, 3, 5, '#291005', 12, 4);
    px(ctx, 5, 10, '#d97706', 2, 5);
    px(ctx, 11, 10, '#d97706', 2, 5);
  }
  return c;
}

// ----------------------------------------------------------------------------
// 5. HIGH-DETAIL MODERN-COLOR PIXEL-ART ADOL CHRISTIN (20 x 26 px -> 40 x 52 px!)
// Realistic hammered silver plate, crimson-crossed kite shield, crimson hair!
// ----------------------------------------------------------------------------
function buildAdolFrame(dir: Dir4, frame: number): HTMLCanvasElement {
  const W = 20;
  const H = 26;
  const [c, ctx] = makeCanvas(W, H);
  const step = frame === 0 ? 0 : 1;
  const bob = step;

  // Outline ink
  const ink = '#12151f';
  const steelHi = '#f8fafc';
  const steelMid = '#cbd5e1';
  const steelLo = '#64748b';
  const hairHi = '#f87171';
  const hairMid = '#dc2626';
  const hairLo = '#7f1d1d';
  const skinHi = '#ffedd5';
  const skinLo = '#f4b584';
  const gold = '#fbbf24';

  // Boots (animated walk stride!)
  const lBootY = 21 - (step === 1 ? 1 : 0);
  const rBootY = 21 - (step === 0 ? 1 : 0);
  px(ctx, 6, lBootY, ink, 4, 4);
  px(ctx, 7, lBootY + 1, steelMid, 2, 2);
  px(ctx, 7, lBootY + 1, steelHi, 1, 1);
  px(ctx, 11, rBootY, ink, 4, 4);
  px(ctx, 12, rBootY + 1, steelMid, 2, 2);

  // Flowing Crimson Cloak behind torso when facing down/side
  if (dir !== 'up') {
    px(ctx, 5, 13 + bob, '#7f1d1d', 10, 8);
    px(ctx, 6, 14 + bob, '#b91c1c', 8, 6);
  }

  // Silver Plate Cuirass & Pauldrons (modern metallic ramp!)
  px(ctx, 5, 11 + bob, ink, 10, 10);
  px(ctx, 6, 12 + bob, steelLo, 8, 8);
  px(ctx, 6, 12 + bob, steelMid, 6, 6);
  px(ctx, 7, 12 + bob, steelHi, 3, 4);
  // Crimson waist sash + gold buckle
  px(ctx, 6, 17 + bob, '#991b1b', 8, 2);
  px(ctx, 9, 17 + bob, gold, 2, 2);

  // Rounded Silver Shoulder Pauldrons
  px(ctx, 4, 12 + bob, ink, 3, 4);
  px(ctx, 5, 12 + bob, steelHi, 2, 2);
  px(ctx, 13, 12 + bob, ink, 3, 4);
  px(ctx, 14, 12 + bob, steelMid, 2, 2);

  // Facing UP: Flowing Crimson Cloak drapes prominently over back!
  if (dir === 'up') {
    px(ctx, 5, 12 + bob, ink, 10, 10);
    px(ctx, 6, 13 + bob, '#991b1b', 8, 8);
    px(ctx, 7, 13 + bob, '#ef4444', 5, 6);
    px(ctx, 8, 13 + bob, '#f87171', 2, 4);
  }

  // Sword & Iconic Crimson-Cross Silver Kite Shield positioned by facing direction!
  if (dir === 'down' || dir === 'right') {
    // Gleaming Silver Sword on right side
    const sx = dir === 'right' ? 15 : 14;
    px(ctx, sx, 13 + bob, gold, 3, 1);
    px(ctx, sx + 1, 7 + bob, ink, 3, 7);
    px(ctx, sx + 2, 8 + bob, steelHi, 1, 5);
  }
  if (dir === 'down' || dir === 'left') {
    // Silver Kite Shield with Bold Crimson Cross (Screenshot 2 signature!)
    const shx = dir === 'left' ? 3 : 2;
    px(ctx, shx, 12 + bob, ink, 6, 8);
    px(ctx, shx + 1, 13 + bob, steelHi, 4, 6);
    px(ctx, shx + 2, 13 + bob, '#dc2626', 2, 6);
    px(ctx, shx + 1, 15 + bob, '#dc2626', 4, 2);
  } else if (dir === 'right') {
    // Shield tucked slightly on back-left
    px(ctx, 3, 13 + bob, ink, 4, 7);
    px(ctx, 4, 14 + bob, steelMid, 2, 5);
    px(ctx, 4, 15 + bob, '#dc2626', 2, 2);
  }
  if (dir === 'left') {
    // Sword pointing left
    px(ctx, 1, 14 + bob, ink, 5, 3);
    px(ctx, 2, 15 + bob, steelHi, 4, 1);
    px(ctx, 5, 13 + bob, gold, 1, 4);
  }

  // Head & Expressive Pixel Face
  px(ctx, 5, 3 + bob, ink, 10, 9);
  px(ctx, 6, 4 + bob, skinLo, 8, 7);
  px(ctx, 6, 4 + bob, skinHi, 6, 6);

  if (dir === 'down') {
    px(ctx, 7, 8 + bob, '#1e293b', 2, 2);
    px(ctx, 11, 8 + bob, '#1e293b', 2, 2);
    px(ctx, 7, 8 + bob, '#ffffff', 1, 1);
    px(ctx, 11, 8 + bob, '#ffffff', 1, 1);
  } else if (dir === 'right') {
    px(ctx, 11, 8 + bob, '#1e293b', 2, 2);
    px(ctx, 11, 8 + bob, '#ffffff', 1, 1);
  } else if (dir === 'left') {
    px(ctx, 7, 8 + bob, '#1e293b', 2, 2);
    px(ctx, 7, 8 + bob, '#ffffff', 1, 1);
  }

  // Sculpted Layered Spiky Crimson Hair!
  px(ctx, 4, 2 + bob, ink, 12, 6);
  px(ctx, 5, 2 + bob, hairLo, 10, 5);
  px(ctx, 5, 2 + bob, hairMid, 9, 4);
  px(ctx, 6, 2 + bob, hairHi, 5, 2);
  // Iconic spiky crimson hair tufts along crown
  px(ctx, 6, 1 + bob, hairMid, 3, 2);
  px(ctx, 10, 0 + bob, hairHi, 3, 2);
  px(ctx, 13, 1 + bob, hairMid, 2, 2);
  if (dir === 'up') {
    // Full back of crimson hair covering head
    px(ctx, 5, 4 + bob, hairLo, 10, 7);
    px(ctx, 6, 4 + bob, hairMid, 8, 5);
    px(ctx, 7, 3 + bob, hairHi, 4, 2);
  } else {
    // Side locks framing face
    px(ctx, 5, 6 + bob, hairMid, 2, 4);
    px(ctx, 13, 6 + bob, hairLo, 2, 4);
  }

  return c;
}

// ----------------------------------------------------------------------------
// 6. HIGH-DETAIL PIXEL-ART MONSTERS & NPCs
// ----------------------------------------------------------------------------
function buildEnemyFrame(kind: 'slime' | 'goblin' | 'knight' | 'mage' | 'wyvern' | 'boss', frame: number): HTMLCanvasElement {
  const W = kind === 'boss' ? 30 : 22;
  const H = kind === 'boss' ? 32 : 24;
  const [c, ctx] = makeCanvas(W, H);
  const cx = Math.floor(W / 2);
  const bob = frame === 1 ? -1 : 0;
  const ink = '#0d1018';

  if (kind === 'slime') {
    const sy = frame === 1 ? 1 : 0;
    drawPixelEllipse(ctx, cx, 15 + sy, 8, 6 - sy, ink);
    drawPixelEllipse(ctx, cx, 15 + sy, 7, 5 - sy, '#15803d');
    drawPixelEllipse(ctx, cx - 1, 14 + sy, 5.5, 4 - sy, '#22c55e');
    px(ctx, cx - 4, 11 + sy, '#bbf7d0', 3, 2);
    px(ctx, cx - 3, 14 + sy, '#0f172a', 2, 2);
    px(ctx, cx + 2, 14 + sy, '#0f172a', 2, 2);
    px(ctx, cx - 3, 14 + sy, '#ffffff', 1, 1);
    px(ctx, cx + 2, 14 + sy, '#ffffff', 1, 1);
    return c;
  }

  if (kind === 'goblin') {
    // Armored red-ochre Esteria Goblin marauder with spiked buckler & axe
    px(ctx, cx - 5, 19, ink, 4, 4);
    px(ctx, cx + 1, 19, ink, 4, 4);
    px(ctx, cx - 4, 20, '#78350f', 2, 2);
    px(ctx, cx + 2, 20, '#78350f', 2, 2);
    px(ctx, cx - 6, 10 + bob, ink, 12, 10);
    px(ctx, cx - 5, 11 + bob, '#c2410c', 10, 8);
    px(ctx, cx - 4, 11 + bob, '#f97316', 5, 5);
    // Pointed goblin ears & helm
    px(ctx, cx - 8, 6 + bob, '#65a30d', 3, 2);
    px(ctx, cx + 5, 6 + bob, '#65a30d', 3, 2);
    px(ctx, cx - 5, 4 + bob, ink, 10, 7);
    px(ctx, cx - 4, 5 + bob, '#84cc16', 8, 5);
    px(ctx, cx - 3, 7 + bob, '#fde047', 2, 2);
    px(ctx, cx + 1, 7 + bob, '#fde047', 2, 2);
    // Steel hatchet
    px(ctx, cx + 6, 8 + bob, '#cbd5e1', 3, 6);
    px(ctx, cx + 7, 8 + bob, '#ffffff', 2, 3);
    return c;
  }

  if (kind === 'knight') {
    // Dark Cobalt / Crimson Armored Knight (Screenshot 1 & 2!)
    px(ctx, cx - 6, 19, ink, 5, 4);
    px(ctx, cx + 1, 19, ink, 5, 4);
    px(ctx, cx - 5, 20, '#3b82f6', 3, 2);
    px(ctx, cx + 2, 20, '#1d4ed8', 3, 2);
    // Heavy cobalt plate breastplate & red cape
    px(ctx, cx - 7, 9 + bob, ink, 14, 11);
    px(ctx, cx - 6, 10 + bob, '#1e3a8a', 12, 9);
    px(ctx, cx - 5, 10 + bob, '#3b82f6', 7, 6);
    px(ctx, cx - 4, 10 + bob, '#93c5fd', 3, 3);
    // Horned Visor Helm
    px(ctx, cx - 5, 3 + bob, ink, 10, 7);
    px(ctx, cx - 4, 4 + bob, '#475569', 8, 5);
    px(ctx, cx - 3, 4 + bob, '#cbd5e1', 4, 2);
    px(ctx, cx - 7, 1 + bob, '#e2e8f0', 2, 4);
    px(ctx, cx + 5, 1 + bob, '#e2e8f0', 2, 4);
    // Glowing crimson visor eyes
    px(ctx, cx - 3, 7 + bob, '#ef4444', 2, 1);
    px(ctx, cx + 1, 7 + bob, '#ef4444', 2, 1);
    return c;
  }

  if (kind === 'mage') {
    // Hooded Darm Warlock with violet mantle & arcane staff
    px(ctx, cx - 6, 10 + bob, ink, 12, 13);
    px(ctx, cx - 5, 11 + bob, '#581c87', 10, 11);
    px(ctx, cx - 4, 11 + bob, '#9333ea', 5, 9);
    px(ctx, cx - 2, 12 + bob, '#fbbf24', 4, 9);
    px(ctx, cx - 5, 3 + bob, ink, 10, 8);
    px(ctx, cx - 4, 4 + bob, '#6b21a8', 8, 6);
    px(ctx, cx - 3, 6 + bob, '#090d16', 6, 4);
    px(ctx, cx - 2, 7 + bob, '#f472b6', 1, 1);
    px(ctx, cx + 1, 7 + bob, '#f472b6', 1, 1);
    // Arcane sapphire orb staff
    px(ctx, cx + 6, 7 + bob, '#78350f', 2, 14);
    px(ctx, cx + 5, 4 + bob, '#38bdf8', 4, 4);
    px(ctx, cx + 6, 5 + bob, '#ffffff', 2, 2);
    return c;
  }

  if (kind === 'wyvern') {
    const flap = frame === 1 ? -3 : 2;
    px(ctx, 1, 7 + flap, ink, 8, 8);
    px(ctx, 2, 8 + flap, '#991b1b', 6, 6);
    px(ctx, 3, 8 + flap, '#ef4444', 4, 3);
    px(ctx, W - 9, 7 + flap, ink, 8, 8);
    px(ctx, W - 8, 8 + flap, '#991b1b', 6, 6);
    px(ctx, cx - 4, 6 + bob, ink, 8, 12);
    px(ctx, cx - 3, 7 + bob, '#dc2626', 6, 10);
    px(ctx, cx - 2, 8 + bob, '#fbbf24', 4, 4);
    px(ctx, cx - 2, 9 + bob, '#fde047', 1, 1);
    px(ctx, cx + 1, 9 + bob, '#fde047', 1, 1);
    return c;
  }

  // Colossal Boss Sprite (Dark Fact / Jenocres / Darm!)
  px(ctx, cx - 10, 10 + bob, ink, 20, 19);
  px(ctx, cx - 9, 11 + bob, '#3b0764', 18, 17);
  px(ctx, cx - 7, 11 + bob, '#7e22ce', 10, 15);
  px(ctx, cx - 4, 12 + bob, '#f59e0b', 8, 14);
  px(ctx, cx - 3, 13 + bob, '#991b1b', 6, 12);
  // Crowned Demon Horns & Cape Shoulders
  px(ctx, cx - 13, 9 + bob, '#581c87', 5, 9);
  px(ctx, cx + 8, 9 + bob, '#581c87', 5, 9);
  px(ctx, cx - 7, 3 + bob, ink, 14, 9);
  px(ctx, cx - 6, 4 + bob, '#4c1d95', 12, 7);
  px(ctx, cx - 9, 0 + bob, '#fbbf24', 3, 6);
  px(ctx, cx + 6, 0 + bob, '#fbbf24', 3, 6);
  px(ctx, cx - 4, 7 + bob, '#ef4444', 3, 2);
  px(ctx, cx + 1, 7 + bob, '#ef4444', 3, 2);
  return c;
}

function buildNpcSprite(hair: string, tunic: string, cloak: string, dir: Dir4): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(18, 24);
  const ink = '#141722';
  // Boots
  px(ctx, 5, 20, ink, 3, 3);
  px(ctx, 10, 20, ink, 3, 3);
  // Layered Cloak & Tunic
  px(ctx, 3, 10, ink, 12, 11);
  px(ctx, 4, 11, cloak, 10, 9);
  px(ctx, 6, 11, tunic, 6, 8);
  px(ctx, 6, 11, 'rgba(255,255,255,0.22)', 3, 4);
  // Head & Face
  px(ctx, 4, 3, ink, 10, 8);
  px(ctx, 5, 4, '#fed7aa', 8, 6);
  px(ctx, 5, 4, '#ffedd5', 5, 4);
  if (dir !== 'up') {
    const exOff = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
    px(ctx, 6 + exOff, 7, '#0f172a', 2, 2);
    px(ctx, 10 + exOff, 7, '#0f172a', 2, 2);
  }
  // Hair crown
  px(ctx, 4, 2, hair, 10, 4);
  if (dir === 'up') {
    px(ctx, 4, 3, hair, 10, 7);
  } else {
    px(ctx, 4, 5, hair, 2, 4);
    px(ctx, 12, 5, hair, 2, 4);
  }
  return c;
}

let cachedAtlas: YsPixelAtlas | null = null;

export function getYsPixelAtlas(): YsPixelAtlas | null {
  if (typeof document === 'undefined') return null;
  if (cachedAtlas) return cachedAtlas;

  const ground: Record<string, HTMLCanvasElement[]> = {};
  const gKinds: Array<'meadow' | 'plains_earth' | 'plains_grass' | 'cobble' | 'carpet' | 'mine' | 'tower' | 'ice' | 'village'> = [
    'meadow', 'plains_earth', 'plains_grass', 'cobble', 'carpet', 'mine', 'tower', 'ice', 'village',
  ];
  for (const k of gKinds) {
    ground[k] = [0, 1, 2, 3].map((v) => buildGroundTile(k, v));
  }

  const waterFrames: Record<'ocean' | 'sky' | 'lava', HTMLCanvasElement[]> = {
    ocean: [0, 1, 2, 3].map((f) => buildWaterFrame('ocean', f)),
    sky: [0, 1, 2, 3].map((f) => buildWaterFrame('sky', f)),
    lava: [0, 1, 2, 3].map((f) => buildWaterFrame('lava', f)),
  };

  const bridge = {
    wood: buildBridgeTile('wood'),
    ice: buildBridgeTile('ice'),
  };

  const wall: Record<'cliff' | 'town' | 'mine' | 'tower' | 'ice', HTMLCanvasElement[]> = {
    cliff: [0, 1, 2, 3].map((v) => buildWallBlock('cliff', v)),
    town: [0, 1, 2, 3].map((v) => buildWallBlock('town', v)),
    mine: [0, 1, 2, 3].map((v) => buildWallBlock('mine', v)),
    tower: [0, 1, 2, 3].map((v) => buildWallBlock('tower', v)),
    ice: [0, 1, 2, 3].map((v) => buildWallBlock('ice', v)),
  };

  const tree: Record<'oak' | 'blossom' | 'roda' | 'marble' | 'ice' | 'obsidian', HTMLCanvasElement> = {
    oak: buildTreeSprite('oak'),
    blossom: buildTreeSprite('blossom'),
    roda: buildTreeSprite('roda'),
    marble: buildTreeSprite('marble'),
    ice: buildTreeSprite('ice'),
    obsidian: buildTreeSprite('obsidian'),
  };

  const shrub: Record<'berry' | 'fern' | 'blossom' | 'frost_bush' | 'ember_fern', HTMLCanvasElement> = {
    berry: buildShrubSprite('berry'),
    fern: buildShrubSprite('fern'),
    blossom: buildShrubSprite('blossom'),
    frost_bush: buildShrubSprite('frost_bush'),
    ember_fern: buildShrubSprite('ember_fern'),
  };

  const adol: Record<Dir4, HTMLCanvasElement[]> = {
    down: [buildAdolFrame('down', 0), buildAdolFrame('down', 1)],
    up: [buildAdolFrame('up', 0), buildAdolFrame('up', 1)],
    left: [buildAdolFrame('left', 0), buildAdolFrame('left', 1)],
    right: [buildAdolFrame('right', 0), buildAdolFrame('right', 1)],
  };

  const enemy: Record<'slime' | 'goblin' | 'knight' | 'mage' | 'wyvern' | 'boss', HTMLCanvasElement[]> = {
    slime: [buildEnemyFrame('slime', 0), buildEnemyFrame('slime', 1)],
    goblin: [buildEnemyFrame('goblin', 0), buildEnemyFrame('goblin', 1)],
    knight: [buildEnemyFrame('knight', 0), buildEnemyFrame('knight', 1)],
    mage: [buildEnemyFrame('mage', 0), buildEnemyFrame('mage', 1)],
    wyvern: [buildEnemyFrame('wyvern', 0), buildEnemyFrame('wyvern', 1)],
    boss: [buildEnemyFrame('boss', 0), buildEnemyFrame('boss', 1)],
  };

  const npcCache = new Map<string, HTMLCanvasElement>();
  const getNpcSprite = (hair: string, tunic: string, cloak: string, dir: Dir4): HTMLCanvasElement => {
    const key = `${hair}|${tunic}|${cloak}|${dir}`;
    let sp = npcCache.get(key);
    if (!sp) {
      sp = buildNpcSprite(hair, tunic, cloak, dir);
      npcCache.set(key, sp);
    }
    return sp;
  };

  cachedAtlas = {
    ground,
    waterFrames,
    bridge,
    wall,
    tree,
    shrub,
    chestClosed: buildChestSprite(false),
    chestOpen: buildChestSprite(true),
    adol,
    enemy,
    npcCache,
    getNpcSprite,
  };
  return cachedAtlas;
}

export function themeToWallKind(theme: ZoneDef['theme']): 'cliff' | 'town' | 'mine' | 'tower' | 'ice' {
  if (theme === 'plains' || theme === 'ruins') return 'cliff';
  if (theme === 'shrine') return 'mine';
  if (theme === 'tower' || theme === 'lava') return 'tower';
  if (theme === 'ice') return 'ice';
  return 'town';
}

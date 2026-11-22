import * as THREE from 'three';
import type { WorldNpc, ZoneDef } from './ysWorldBuilder';

// ============================================================================
// REUSABLE RPG-JS (RSamaium/RPG-JS + PIPOYA) HD-2D ENGINE ATLAS & TERRAIN SUITE
// Designed for Real Three.js WebGL 3D Evo Worlds:
// - Seamless 8-neighbor Autotiled Pipoya/RPG-JS Zone Terrain Canvas Generator
// - High-Craft 4-Direction Animated HD-2D JRPG Character & Monster Sprite Sheets
// - Illustrated Pipoya Half-Timbered Cottage Facades, Scalloped Roofs, Cliffs &
//   Cel-Shaded Lush Botanical Leaf Canopies (100% Procedural, Zero External 404s)
// ============================================================================

function hash2d(x: number, y: number, seed = 1): number {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function configureSpriteTexture(canvas: HTMLCanvasElement, maxAniso: number, crispPixel = true): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  if (crispPixel) {
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.NearestFilter;
  } else {
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
  }
  tex.anisotropy = Math.min(8, maxAniso);
  tex.needsUpdate = true;
  return tex;
}

function configureTiledTexture(canvas: HTMLCanvasElement, maxAniso: number): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = Math.min(8, maxAniso);
  tex.needsUpdate = true;
  return tex;
}

// ============================================================================
// 1. SEAMLESS PIPOYA / RPG-JS AUTOTILED ZONE TERRAIN TEXTURE GENERATOR
// Produces a rich, vibrant, high-res 2D illustrated terrain map per zone with:
// - Smooth rounded footpaths & bordered cobblestone town plazas (zero blocky edges!)
// - Sandy/pebbled coastal & riverbank transitions around water basins
// - Sunlit emerald clover meadows, flower patches & soft forest shade under trees
// - Soft baked ambient occlusion around cottages, cliffs, and bridges
// ============================================================================
export function buildRpgJsZoneTerrainTexture(zone: ZoneDef, maxAniso: number): THREE.CanvasTexture {
  const W = zone.width;
  const H = zone.height;
  // Crisp 32px per tile (clamped to <= 2048 so WebGL stays super fast & razor sharp)
  const tilePx = Math.max(20, Math.min(32, Math.floor(2048 / Math.max(W, H))));
  const canvas = document.createElement('canvas');
  canvas.width = W * tilePx;
  canvas.height = H * tilePx;
  const ctx = canvas.getContext('2d')!;

  const theme = zone.theme;
  const isDungeon = theme === 'shrine' || theme === 'tower' || theme === 'lava';
  const isIce = theme === 'ice';
  const isTown = theme === 'town' || theme === 'village';

  // 1. Base Vibrant Lush Emerald RPG-JS / Pipoya Biome Ground Layer
  const basePalette: Record<ZoneDef['theme'], [string, string, string, string]> = {
    town: ['#2ec445', '#1fa336', '#56e266', '#167c28'],
    village: ['#32cc52', '#22ab40', '#5fe876', '#188230'],
    plains: ['#36c23e', '#26a02e', '#62e05b', '#1b7a22'],
    ruins: ['#41b544', '#2e9432', '#68d462', '#217024'],
    shrine: ['#4b4d5a', '#3d404c', '#5b5e6d', '#31333e'],
    tower: ['#44273e', '#361d31', '#56334f', '#281424'],
    lava: ['#3c2128', '#2f181f', '#4f2c34', '#221015'],
    ice: ['#cde9f9', '#b5dcf4', '#e3f4fe', '#94c5e4'],
  };
  const [cBase, cDark, cLight, cDeep] = basePalette[theme] ?? basePalette.town;
  ctx.fillStyle = cBase;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Organic Pipoya-style sunlit grass mottling & stone flagstone base
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const x = c * tilePx;
      const y = r * tilePx;
      const n = hash2d(c, r, 101);

      if (isDungeon) {
        // Crisp beveled dungeon temple flagstones
        const pad = Math.max(1, Math.round(tilePx * 0.06));
        ctx.fillStyle = n < 0.33 ? cBase : n < 0.68 ? cLight : cDark;
        ctx.fillRect(x + pad, y + pad, tilePx - pad * 2, tilePx - pad * 2);
        // Top-left stone bevel highlight & bottom-right shadow
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(x + pad, y + pad, tilePx - pad * 2, 2);
        ctx.fillRect(x + pad, y + pad, 2, tilePx - pad * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.fillRect(x + pad, y + tilePx - pad - 2, tilePx - pad * 2, 2);
        // Subtle moss cracks in ancient shrine
        if (theme === 'shrine' && hash2d(c, r, 107) > 0.72) {
          ctx.fillStyle = 'rgba(74, 155, 88, 0.45)';
          ctx.fillRect(x + pad, y + pad, 5, 3);
        }
      } else if (isIce) {
        ctx.fillStyle = n < 0.4 ? cLight : n < 0.75 ? cBase : cDark;
        ctx.fillRect(x, y, tilePx, tilePx);
        if (n > 0.55) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(x + 4, y + tilePx - 6);
          ctx.lineTo(x + tilePx - 6, y + 6);
          ctx.stroke();
        }
      } else {
        // Vibrant sunlit Pipoya meadow mottling (soft rounded clover patches + blades!)
        if (n > 0.58) {
          ctx.fillStyle = cLight;
          ctx.beginPath();
          ctx.arc(x + tilePx * 0.5, y + tilePx * 0.5, tilePx * 0.55, 0, Math.PI * 2);
          ctx.fill();
        } else if (n < 0.24) {
          ctx.fillStyle = cDark;
          ctx.beginPath();
          ctx.arc(x + tilePx * 0.5, y + tilePx * 0.5, tilePx * 0.52, 0, Math.PI * 2);
          ctx.fill();
        }
        // Crisp RPG-JS 3-blade emerald grass & clover tuft marks
        for (let t = 0; t < 4; t++) {
          const tx = x + 3 + hash2d(c * 7 + t, r, 121) * (tilePx - 7);
          const ty = y + 4 + hash2d(c, r * 7 + t, 127) * (tilePx - 7);
          ctx.fillStyle = t === 0 ? cDeep : t === 1 ? '#7ef078' : cLight;
          ctx.fillRect(tx, ty, 2, 3.5);
          ctx.fillRect(tx + 2, ty - 1.5, 1.8, 4.5);
          ctx.fillRect(tx + 4, ty, 1.8, 3.5);
        }
      }
    }
  }

  const tileAt = (c: number, r: number): number => {
    if (c < 0 || r < 0 || c >= W || r >= H) return 1;
    return zone.tiles[r][c];
  };

  // 2. Crisp 3-Band Organic Shoreline (Dry Golden Sand -> Wet Shoreline -> Sunlit Pebble Seabed!)
  // Includes water under wooden piers/bridges (tile === 4) so water flows cleanly beneath bridges!
  const isWaterBasin = (c: number, r: number): boolean => {
    const t = tileAt(c, r);
    return t === 3 || t === 4;
  };
  if (!isDungeon) {
    // Pass 2A: Warm dry coastal/riverbank sand rim hugging land adjacent to water
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        if (!isWaterBasin(c, r)) continue;
        const cx = (c + 0.5) * tilePx;
        const cy = (r + 0.5) * tilePx;
        const dryGrad = ctx.createRadialGradient(cx, cy, tilePx * 0.42, cx, cy, tilePx * 0.96);
        dryGrad.addColorStop(0, isIce ? '#8dc9ea' : '#e6cf98');
        dryGrad.addColorStop(0.65, isIce ? 'rgba(141, 201, 234, 0.82)' : 'rgba(230, 207, 152, 0.88)');
        dryGrad.addColorStop(1, isIce ? 'rgba(141, 201, 234, 0)' : 'rgba(230, 207, 152, 0)');
        ctx.fillStyle = dryGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, tilePx * 0.96, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Pass 2B: Damp wet-sand shelf & pebbled littoral edge
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        if (!isWaterBasin(c, r)) continue;
        const cx = (c + 0.5) * tilePx;
        const cy = (r + 0.5) * tilePx;
        const wetGrad = ctx.createRadialGradient(cx, cy, tilePx * 0.3, cx, cy, tilePx * 0.68);
        wetGrad.addColorStop(0, isIce ? '#5aa3cc' : '#a9854f');
        wetGrad.addColorStop(0.75, isIce ? 'rgba(90, 163, 204, 0.78)' : 'rgba(169, 133, 79, 0.8)');
        wetGrad.addColorStop(1, 'rgba(169, 133, 79, 0)');
        ctx.fillStyle = wetGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, tilePx * 0.68, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Pass 2C: Sunlit carved underwater sand & pebble seabed (visible through translucent 3D water!)
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        if (!isWaterBasin(c, r)) continue;
        const x = c * tilePx;
        const y = r * tilePx;
        const nearLand =
          !isWaterBasin(c - 1, r) ||
          !isWaterBasin(c + 1, r) ||
          !isWaterBasin(c, r - 1) ||
          !isWaterBasin(c, r + 1);
        const bedCol =
          theme === 'village'
            ? '#3896d4'
            : isIce
              ? '#2e88bd'
              : nearLand
                ? theme === 'town'
                  ? '#7d8c6e'
                  : '#7a8a62'
                : theme === 'town'
                  ? '#1a607a'
                  : '#24665c';
        ctx.fillStyle = bedCol;
        ctx.fillRect(x, y, tilePx, tilePx);
        // Subtle submerged river/harbor pebbles & sandy ripple ridges
        for (let p = 0; p < 5; p++) {
          const px = x + 3 + hash2d(c * 7 + p, r, 181) * (tilePx - 6);
          const py = y + 3 + hash2d(c, r * 7 + p, 183) * (tilePx - 6);
          ctx.fillStyle = p % 2 === 0 ? 'rgba(235, 224, 188, 0.28)' : 'rgba(16, 48, 56, 0.25)';
          ctx.beginPath();
          ctx.ellipse(px, py, 2.6, 1.8, hash2d(c + p, r, 185) * Math.PI, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // 3. Seamless Pipoya / RPG-JS Autotiled Rounded Footpaths, Cobblestone Plazas & Royal Carpets!
  const isRoad = (c: number, r: number) => {
    const t = tileAt(c, r);
    return t === 6 || t === 4;
  };

  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      if (zone.tiles[r][c] !== 6) continue;
      const x = c * tilePx;
      const y = r * tilePx;
      const up = isRoad(c, r - 1);
      const dn = isRoad(c, r + 1);
      const lf = isRoad(c - 1, r);
      const rt = isRoad(c + 1, r);

      const radTL = !up && !lf ? tilePx * 0.36 : 0;
      const radTR = !up && !rt ? tilePx * 0.36 : 0;
      const radBR = !dn && !rt ? tilePx * 0.36 : 0;
      const radBL = !dn && !lf ? tilePx * 0.36 : 0;

      if (isDungeon) {
        // Royal Crimson & Gold Woven Temple Carpet
        ctx.fillStyle = '#991b1b';
        ctx.beginPath();
        ctx.roundRect(x + (lf ? 0 : 2), y + (up ? 0 : 2), tilePx - (lf ? 0 : 2) - (rt ? 0 : 2), tilePx - (up ? 0 : 2) - (dn ? 0 : 2), [
          radTL,
          radTR,
          radBR,
          radBL,
        ]);
        ctx.fill();
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 2;
        if (!lf) {
          ctx.beginPath();
          ctx.moveTo(x + 4, y);
          ctx.lineTo(x + 4, y + tilePx);
          ctx.stroke();
        }
        if (!rt) {
          ctx.beginPath();
          ctx.moveTo(x + tilePx - 4, y);
          ctx.lineTo(x + tilePx - 4, y + tilePx);
          ctx.stroke();
        }
      } else if (isTown) {
        // Warm Sunlit Pipoya Sandstone Cobblestone Plaza with Crisp Curb Rim!
        const insetL = lf ? 0 : 2;
        const insetR = rt ? 0 : 2;
        const insetT = up ? 0 : 2;
        const insetB = dn ? 0 : 2;
        const rx = x + insetL;
        const ry = y + insetT;
        const rw = tilePx - insetL - insetR;
        const rh = tilePx - insetT - insetB;

        // Soft curb shadow & stone mortar base
        ctx.fillStyle = '#7c6a51';
        ctx.beginPath();
        ctx.roundRect(rx, ry, rw, rh, [radTL, radTR, radBR, radBL]);
        ctx.fill();

        // Warm sandstone fill
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(rx + 1, ry + 1, rw - 2, rh - 2, [radTL, radTR, radBR, radBL]);
        ctx.clip();
        ctx.fillStyle = '#d6c19e';
        ctx.fillRect(x, y, tilePx, tilePx);

        // Crisp Pipoya paving brick courses
        const rows = 3;
        const rowH = tilePx / rows;
        for (let br = 0; br < rows; br++) {
          const off = (br % 2) * (tilePx * 0.25);
          for (let bc = -1; bc <= 2; bc++) {
            const bx = x + bc * (tilePx * 0.5) + off;
            const by = y + br * rowH;
            const v = hash2d(c * 3 + bc, r * 3 + br, 211);
            ctx.fillStyle = v < 0.33 ? '#e4d3b3' : v < 0.66 ? '#d6c29f' : '#cab38c';
            ctx.fillRect(bx + 1, by + 1, tilePx * 0.5 - 2, rowH - 2);
            ctx.fillStyle = 'rgba(255, 252, 240, 0.35)';
            ctx.fillRect(bx + 1, by + 1, tilePx * 0.5 - 2, 1.5);
          }
        }
        ctx.restore();
      } else {
        // Smooth Organic Golden-Ochre Pipoya Dirt Road with Soft Grass Fringe!
        const rx = x + (lf ? 0 : 2);
        const ry = y + (up ? 0 : 2);
        const rw = tilePx - (lf ? 0 : 2) - (rt ? 0 : 2);
        const rh = tilePx - (up ? 0 : 2) - (dn ? 0 : 2);

        // Warm earthen border
        ctx.fillStyle = '#9c7d4f';
        ctx.beginPath();
        ctx.roundRect(rx, ry, rw, rh, [radTL, radTR, radBR, radBL]);
        ctx.fill();

        // Sunlit warm tan path center
        ctx.fillStyle = '#d4b47c';
        ctx.beginPath();
        ctx.roundRect(rx + 2, ry + 2, rw - 4, rh - 4, [
          Math.max(0, radTL - 2),
          Math.max(0, radTR - 2),
          Math.max(0, radBR - 2),
          Math.max(0, radBL - 2),
        ]);
        ctx.fill();

        // Subtle warm wheel-track pebbles & speckles
        for (let p = 0; p < 4; p++) {
          const px = x + 4 + hash2d(c * 5 + p, r, 239) * (tilePx - 8);
          const py = y + 4 + hash2d(c, r * 5 + p, 241) * (tilePx - 8);
          ctx.fillStyle = p % 2 === 0 ? '#e7cfa1' : '#b28f58';
          ctx.fillRect(px, py, 2.5, 2);
        }
      }
    }
  }

  // 4. Vibrant Pipoya Wildflower Beds (tile === 8) & Soft Forest Canopy Shade (tile === 2, 9)
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const t = zone.tiles[r][c];
      const cx = (c + 0.5) * tilePx;
      const cy = (r + 0.5) * tilePx;

      if (t === 8 && !isDungeon && !isIce) {
        // Lush flower meadow patch with crisp daisies, buttercups & blossoms
        for (let f = 0; f < 6; f++) {
          const fx = c * tilePx + 4 + hash2d(c * 9 + f, r, 311) * (tilePx - 8);
          const fy = r * tilePx + 4 + hash2d(c, r * 9 + f, 313) * (tilePx - 8);
          ctx.fillStyle = '#2d6a2d';
          ctx.fillRect(fx - 1, fy + 1, 3, 2);
          ctx.fillStyle = f % 3 === 0 ? '#fef08a' : f % 3 === 1 ? '#ffffff' : '#f9a8d4';
          ctx.beginPath();
          ctx.arc(fx, fy, 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#f59e0b';
          ctx.fillRect(fx - 0.7, fy - 0.7, 1.4, 1.4);
        }
      } else if ((t === 2 || t === 9) && !isDungeon && !isIce) {
        // Soft dappled shadow pool & dark forest soil right under tree trunks
        const shRad = t === 9 ? tilePx * 1.15 : tilePx * 0.72;
        const shGrad = ctx.createRadialGradient(cx, cy + tilePx * 0.14, tilePx * 0.1, cx, cy + tilePx * 0.14, shRad);
        shGrad.addColorStop(0, 'rgba(20, 44, 18, 0.52)');
        shGrad.addColorStop(0.65, 'rgba(22, 52, 20, 0.24)');
        shGrad.addColorStop(1, 'rgba(22, 52, 20, 0)');
        ctx.fillStyle = shGrad;
        ctx.beginPath();
        ctx.arc(cx, cy + tilePx * 0.14, shRad, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // 5. Soft Grounded Ambient Occlusion Under Buildings & Cliff Footprints
  if (zone.buildings) {
    for (const b of zone.buildings) {
      const bx = b.tx * tilePx;
      const by = b.ty * tilePx;
      const bw = b.w * tilePx;
      const bh = b.h * tilePx;
      ctx.fillStyle = 'rgba(15, 25, 18, 0.34)';
      ctx.beginPath();
      ctx.roundRect(bx - 4, by + 2, bw + 10, bh + 8, 8);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = Math.min(8, maxAniso);
  tex.needsUpdate = true;
  return tex;
}

// ============================================================================
// 2. ILLUSTRATED PIPOYA / RPG-JS ARCHITECTURAL & BOTANICAL TEXTURE LIBRARY
// ============================================================================
export interface RpgJsArchTextures {
  houseFront: THREE.CanvasTexture;
  houseSide: THREE.CanvasTexture;
  roofCrimson: THREE.CanvasTexture;
  roofCobalt: THREE.CanvasTexture;
  roofEmerald: THREE.CanvasTexture;
  roofTerracotta: THREE.CanvasTexture;
  cliffTerrace: THREE.CanvasTexture;
  leafPipoya: THREE.CanvasTexture;
  leafCypress: THREE.CanvasTexture;
  leafShrub: THREE.CanvasTexture;
  plankWood: THREE.CanvasTexture;
  bark: THREE.CanvasTexture;
}

function createScallopedRoofTexture(
  baseHex: string,
  hiHex: string,
  loHex: string,
  maxAniso: number
): THREE.CanvasTexture {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = loHex;
  ctx.fillRect(0, 0, size, size);

  const rows = 10;
  const cols = 8;
  const rowH = size / rows;
  const colW = size / cols;

  for (let r = 0; r < rows + 1; r++) {
    const off = (r % 2) * (colW * 0.5);
    for (let col = -1; col <= cols; col++) {
      const sx = col * colW + off;
      const sy = r * rowH;
      const n = hash2d(col + 10, r, 701);

      // Shingle drop shadow
      ctx.fillStyle = 'rgba(10, 12, 22, 0.38)';
      ctx.beginPath();
      ctx.roundRect(sx + 1, sy + 3, colW - 2, rowH + 2, [0, 0, 10, 10]);
      ctx.fill();

      // Scalloped curved Pipoya roof shingle
      const g = ctx.createLinearGradient(sx, sy, sx, sy + rowH);
      g.addColorStop(0, n > 0.65 ? hiHex : baseHex);
      g.addColorStop(0.7, baseHex);
      g.addColorStop(1, loHex);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(sx + 1, sy, colW - 2, rowH + 1, [0, 0, 9, 9]);
      ctx.fill();

      // Sunlit ceramic edge sheen
      ctx.strokeStyle = 'rgba(255, 255, 240, 0.28)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(sx + 4, sy + 2);
      ctx.lineTo(sx + colW - 5, sy + 2);
      ctx.stroke();
    }
  }
  return configureTiledTexture(c, maxAniso);
}

function createHouseFacadeTexture(isFront: boolean, maxAniso: number): THREE.CanvasTexture {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;

  // Warm sunlit Pipoya cream-ivory stucco plaster wall
  const wallGrad = ctx.createLinearGradient(0, 0, 0, size);
  wallGrad.addColorStop(0, '#f6ebd4');
  wallGrad.addColorStop(0.72, '#ead9b7');
  wallGrad.addColorStop(1, '#d8c29a');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(0, 0, size, size);

  // Subtle hand-painted stucco plaster stipple
  for (let i = 0; i < 320; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.22)' : 'rgba(130, 98, 60, 0.09)';
    ctx.fillRect(hash2d(i, 1, 711) * size, hash2d(i, 2, 711) * size, 4, 3);
  }

  // Lower stone plinth masonry foundation
  ctx.fillStyle = '#6c7480';
  ctx.fillRect(0, size - 44, size, 44);
  for (let r = 0; r < 2; r++) {
    const off = r * 18;
    for (let col = -1; col < 8; col++) {
      const sx = col * 36 + off;
      const sy = size - 42 + r * 20;
      ctx.fillStyle = hash2d(col + 3, r, 719) > 0.5 ? '#8b95a3' : '#7b8594';
      ctx.fillRect(sx + 2, sy + 2, 32, 16);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(sx + 2, sy + 2, 32, 2);
    }
  }

  // Dark Oak Half-Timber Framing Beams (RPG-JS / Pipoya medieval look!)
  const drawBeam = (x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = '#5a361d';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#784a2a';
    ctx.fillRect(x + 2, y + 2, Math.max(1, w - 4), Math.max(1, h - 4));
    ctx.strokeStyle = '#361e0e';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
  };
  drawBeam(0, 0, size, 16);
  drawBeam(0, size - 56, size, 14);
  drawBeam(0, 0, 14, size - 44);
  drawBeam(size - 14, 0, 14, size - 44);
  drawBeam(size * 0.5 - 7, 0, 14, isFront ? 72 : size - 44);

  // Diagonal timber braces in upper corners
  ctx.strokeStyle = '#5a361d';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(12, 54);
  ctx.lineTo(54, 14);
  ctx.moveTo(size - 12, 54);
  ctx.lineTo(size - 54, 14);
  ctx.stroke();

  // Warm Glowing Paned Windows with Wooden Shutters & Blooming Flower Boxes!
  const drawWindow = (wx: number, wy: number, ww: number, wh: number) => {
    // Shutters
    ctx.fillStyle = '#3b6a48';
    ctx.strokeStyle = '#24422c';
    ctx.lineWidth = 2;
    ctx.fillRect(wx - 14, wy, 12, wh);
    ctx.strokeRect(wx - 14, wy, 12, wh);
    ctx.fillRect(wx + ww + 2, wy, 12, wh);
    ctx.strokeRect(wx + ww + 2, wy, 12, wh);

    // Outer frame
    ctx.fillStyle = '#4a2b16';
    ctx.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);

    // Warm sunlit golden interior window glow
    const wg = ctx.createLinearGradient(wx, wy, wx, wy + wh);
    wg.addColorStop(0, '#fff7cc');
    wg.addColorStop(0.55, '#fde047');
    wg.addColorStop(1, '#f59e0b');
    ctx.fillStyle = wg;
    ctx.fillRect(wx, wy, ww, wh);

    // Leaded mullions
    ctx.fillStyle = '#4a2b16';
    ctx.fillRect(wx + ww * 0.5 - 2, wy, 4, wh);
    ctx.fillRect(wx, wy + wh * 0.5 - 2, ww, 4);

    // Wooden flower box with vibrant Pipoya blooms!
    ctx.fillStyle = '#6c3e1e';
    ctx.fillRect(wx - 6, wy + wh + 2, ww + 12, 12);
    ctx.strokeStyle = '#361e0e';
    ctx.strokeRect(wx - 6, wy + wh + 2, ww + 12, 12);
    for (let f = 0; f < 5; f++) {
      const fx = wx + 4 + f * ((ww - 8) / 4);
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(fx, wy + wh + 1, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = f % 2 === 0 ? '#f43f5e' : '#fef08a';
      ctx.beginPath();
      ctx.arc(fx, wy + wh - 1, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  if (isFront) {
    drawWindow(34, 88, 42, 48);
    drawWindow(size - 76, 88, 42, 48);

    // Arched Paneled Oak Cottage Door in center!
    const dx = size * 0.5 - 26;
    const dy = 96;
    const dw = 52;
    const dh = size - 96 - 10;
    // Stone arch surround
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.roundRect(dx - 6, dy - 6, dw + 12, dh + 6, [28, 28, 0, 0]);
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Oak door planks
    ctx.fillStyle = '#784421';
    ctx.beginPath();
    ctx.roundRect(dx, dy, dw, dh, [24, 24, 0, 0]);
    ctx.fill();
    ctx.strokeStyle = '#3f220e';
    ctx.lineWidth = 2;
    for (let px = dx + 12; px < dx + dw; px += 12) {
      ctx.beginPath();
      ctx.moveTo(px, dy + 6);
      ctx.lineTo(px, dy + dh);
      ctx.stroke();
    }
    // Iron hinge straps & brass door ring handle
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(dx + 2, dy + 34, 20, 5);
    ctx.fillRect(dx + 2, dy + 88, 20, 5);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(dx + dw - 11, dy + 64, 5, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    drawWindow(56, 86, 44, 50);
    drawWindow(size - 100, 86, 44, 50);
  }

  return configureTiledTexture(c, maxAniso);
}

function createPipoyaCliffTexture(maxAniso: number): THREE.CanvasTexture {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;

  // Warm illustrated JRPG rock cliff strata (like RPG-JS / Pipoya highlands)
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, '#8e7c64');
  g.addColorStop(0.35, '#7a6852');
  g.addColorStop(0.78, '#615241');
  g.addColorStop(1, '#43382c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // Carved vertical cliff rock pillars & beveled stone ledges
  for (let i = 0; i < 9; i++) {
    const x = i * 30 + (hash2d(i, 1, 741) - 0.5) * 10;
    const w = 26 + hash2d(i, 2, 741) * 14;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(218, 198, 168, 0.22)' : 'rgba(42, 32, 24, 0.28)';
    ctx.fillRect(x, 38, w, size - 44);
    ctx.strokeStyle = 'rgba(36, 28, 20, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 36);
    ctx.lineTo(x + (hash2d(i, 3, 741) - 0.5) * 8, size);
    ctx.stroke();
  }

  // Horizontal stratified rock crack seams
  for (let row = 1; row <= 3; row++) {
    const ry = 46 + row * 52;
    ctx.strokeStyle = 'rgba(32, 24, 18, 0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, ry);
    for (let px = 0; px <= size; px += 32) {
      ctx.lineTo(px, ry + (hash2d(px, row, 751) - 0.5) * 10);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(235, 218, 190, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, ry + 3);
    for (let px = 0; px <= size; px += 32) {
      ctx.lineTo(px, ry + 3 + (hash2d(px, row, 751) - 0.5) * 10);
    }
    ctx.stroke();
  }

  // Lush Overhanging Pipoya Emerald Grass Lip + Hanging Vines at Top!
  ctx.fillStyle = '#186b24';
  ctx.fillRect(0, 0, size, 44);
  ctx.fillStyle = '#2ec445';
  ctx.fillRect(0, 0, size, 32);
  ctx.fillStyle = '#62e86e';
  ctx.fillRect(0, 0, size, 14);

  // Scalloped emerald turf tufts draping over the cliff edge
  for (let i = 0; i < 16; i++) {
    const tx = i * 16 + 8;
    const drop = 28 + hash2d(i, 7, 761) * 22;
    ctx.fillStyle = '#186b24';
    ctx.beginPath();
    ctx.arc(tx, drop + 3, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#32c749';
    ctx.beginPath();
    ctx.arc(tx, drop, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#75ef7c';
    ctx.beginPath();
    ctx.arc(tx - 2, drop - 3, 5.5, 0, Math.PI * 2);
    ctx.fill();
  }

  return configureTiledTexture(c, maxAniso);
}

function createPipoyaLeafClusterTexture(
  kind: 'broad' | 'cypress' | 'shrub',
  maxAniso: number
): THREE.CanvasTexture {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  if (kind === 'broad') {
    // Rich hand-illustrated Pipoya / RPG-JS multi-layered botanical oak bough cluster!
    // 1. Interior gnarled dark wood twigs peeking through gaps in the foliage
    ctx.strokeStyle = '#4a2b14';
    ctx.lineWidth = 4.5;
    for (let b = 0; b < 5; b++) {
      const ba = (b / 5) * Math.PI * 2 + 0.3;
      ctx.beginPath();
      ctx.moveTo(size * 0.5, size * 0.56);
      ctx.quadraticCurveTo(
        size * 0.5 + Math.cos(ba + 0.25) * 42,
        size * 0.52 + Math.sin(ba + 0.25) * 38,
        size * 0.5 + Math.cos(ba) * 78,
        size * 0.52 + Math.sin(ba) * 72
      );
      ctx.stroke();
    }

    const drawLeaf = (lx: number, ly: number, rx: number, ry: number, rot: number, fill: string, stroke?: string) => {
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(rot);
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
      ctx.restore();
    };

    // 2. Deep shadow forest-emerald back leaves for strong volumetric canopy depth
    for (let i = 0; i < 64; i++) {
      const a = hash2d(i, 1, 811) * Math.PI * 2;
      const dist = Math.sqrt(hash2d(i, 2, 811)) * 96;
      const lx = size * 0.5 + Math.cos(a) * dist;
      const ly = size * 0.54 + Math.sin(a) * dist * 0.88;
      const rx = 14 + hash2d(i, 3, 811) * 12;
      const ry = rx * 0.68;
      drawLeaf(lx, ly, rx, ry, a + 0.4, '#144d1e');
    }

    // 3. Dense mid-tone vibrant emerald & jade pointed foliage leaves with dark outline
    for (let i = 0; i < 96; i++) {
      const a = hash2d(i, 1, 821) * Math.PI * 2;
      const dist = Math.sqrt(hash2d(i, 2, 821)) * 90;
      const lx = size * 0.5 + Math.cos(a) * dist;
      const ly = size * 0.48 + Math.sin(a) * dist * 0.84;
      const rx = 11 + hash2d(i, 3, 821) * 10;
      const ry = rx * 0.64;
      const upper = 1 - ly / size;
      const fill = upper > 0.6 ? '#46d852' : upper > 0.38 ? '#28ad3c' : '#1c7c2c';
      drawLeaf(lx, ly, rx, ry, a + hash2d(i, 4, 821), fill, 'rgba(10, 40, 16, 0.52)');
    }

    // 4. Sun-kissed top-left spring-lime Pipoya leaf crown highlights + crisp specular tips!
    for (let i = 0; i < 62; i++) {
      const a = hash2d(i, 1, 831) * Math.PI * 2;
      const dist = Math.sqrt(hash2d(i, 2, 831)) * 74;
      const lx = size * 0.45 + Math.cos(a) * dist;
      const ly = size * 0.36 + Math.sin(a) * dist * 0.66;
      const rx = 7.5 + hash2d(i, 3, 831) * 7.5;
      const ry = rx * 0.6;
      drawLeaf(lx, ly, rx, ry, a - 0.3, i % 4 === 0 ? '#a8f97c' : '#7ef068');
    }
  } else if (kind === 'cypress') {
    // Tall vibrant Mediterranean cypress spire with lush layered boughs
    for (let i = 0; i < 190; i++) {
      const t = hash2d(i, 1, 841);
      const y = 16 + t * (size - 26);
      const halfSpan = Math.sin(Math.pow(t, 0.72) * Math.PI * 0.9) * 58 + 5;
      const side = (hash2d(i, 2, 841) - 0.5) * 2;
      const x = size * 0.5 + side * halfSpan;
      const rad = 8 + (1 - Math.abs(side) * 0.35) * 9 * (0.45 + t * 0.55);
      ctx.fillStyle = side < -0.1 ? '#7be662' : side < 0.25 ? '#34b542' : '#1b6327';
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(12, 38, 16, 0.38)';
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }
  } else {
    // Charming plump Pipoya emerald berry/flower woodland shrub!
    for (let i = 0; i < 58; i++) {
      const a = -Math.PI * 0.95 + hash2d(i, 1, 851) * Math.PI * 0.9;
      const dist = 12 + Math.sqrt(hash2d(i, 2, 851)) * 84;
      const lx = size * 0.5 + Math.cos(a) * dist;
      const ly = size * 0.84 + Math.sin(a) * dist * 0.82;
      if (ly < 24 || ly > size - 8) continue;
      const rad = 14 + hash2d(i, 3, 851) * 10;
      const hi = 1 - ly / size;
      ctx.fillStyle = hi > 0.5 ? '#6ce660' : hi > 0.25 ? '#2fb03e' : '#186324';
      ctx.beginPath();
      ctx.arc(lx, ly, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(14, 42, 16, 0.45)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
  }

  return configureSpriteTexture(c, maxAniso, false);
}

export function createRpgJsArchTextures(maxAniso: number): RpgJsArchTextures {
  // Warm wooden planks
  const woodC = document.createElement('canvas');
  woodC.width = 128;
  woodC.height = 128;
  const wCtx = woodC.getContext('2d')!;
  wCtx.fillStyle = '#8a552a';
  wCtx.fillRect(0, 0, 128, 128);
  for (let r = 0; r < 6; r++) {
    const py = r * (128 / 6);
    wCtx.fillStyle = r % 2 === 0 ? '#a16635' : '#8e572b';
    wCtx.fillRect(0, py + 2, 128, 128 / 6 - 3);
    wCtx.fillStyle = '#522f14';
    wCtx.fillRect(0, py, 128, 2);
    wCtx.fillStyle = 'rgba(255, 226, 180, 0.16)';
    wCtx.fillRect(0, py + 3, 128, 2);
  }

  // Warm tree bark
  const barkC = document.createElement('canvas');
  barkC.width = 128;
  barkC.height = 128;
  const bCtx = barkC.getContext('2d')!;
  bCtx.fillStyle = '#6b4628';
  bCtx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 24; i++) {
    bCtx.fillStyle = i % 2 === 0 ? '#52341c' : '#855a36';
    bCtx.fillRect(i * 6, 0, 3, 128);
  }

  return {
    houseFront: createHouseFacadeTexture(true, maxAniso),
    houseSide: createHouseFacadeTexture(false, maxAniso),
    roofCrimson: createScallopedRoofTexture('#c0392b', '#e74c3c', '#7b1d14', maxAniso),
    roofCobalt: createScallopedRoofTexture('#2563eb', '#60a5fa', '#1e3a8a', maxAniso),
    roofEmerald: createScallopedRoofTexture('#16a34a', '#4ade80', '#14532d', maxAniso),
    roofTerracotta: createScallopedRoofTexture('#d97706', '#fbbf24', '#92400e', maxAniso),
    cliffTerrace: createPipoyaCliffTexture(maxAniso),
    leafPipoya: createPipoyaLeafClusterTexture('broad', maxAniso),
    leafCypress: createPipoyaLeafClusterTexture('cypress', maxAniso),
    leafShrub: createPipoyaLeafClusterTexture('shrub', maxAniso),
    plankWood: configureTiledTexture(woodC, maxAniso),
    bark: configureTiledTexture(barkC, maxAniso),
  };
}

// ============================================================================
// 3. CRISP 4-DIRECTION ANIMATED HD-2D RPG-JS CHARACTER & MONSTER SPRITESHEETS!
// Layout for Characters (Adol & NPCs): 4 cols (walk frames) x 4 rows (down, left, right, up)
// Each cell = 64x64 high-craft cel-shaded JRPG Pipoya sprite with crisp 1.5px dark outlines!
// ============================================================================
interface HumanoidSpriteConfig {
  hairColor: string;
  hairHi: string;
  tunicColor: string;
  cloakColor: string;
  trimColor: string;
  skinColor?: string;
  isHero?: boolean;
  isLongHair?: boolean;
  hasStaff?: boolean;
  weaponColor?: string;
  shieldColor?: string;
}

function drawHumanoidFrame(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  dir: 0 | 1 | 2 | 3, // 0=down, 1=left, 2=right, 3=up
  frame: 0 | 1 | 2 | 3,
  cfg: HumanoidSpriteConfig
): void {
  ctx.save();
  ctx.translate(ox + 32, oy + 58);

  const stride = frame === 1 ? 1 : frame === 3 ? -1 : 0;
  const bob = Math.abs(stride) * 2.2;
  const skin = cfg.skinColor ?? '#ffd9b3';
  const outline = '#17111c';

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Soft ground shadow oval
  ctx.fillStyle = 'rgba(10, 16, 28, 0.32)';
  ctx.beginPath();
  ctx.ellipse(0, 1, 13, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(0, -bob);

  // Back Cape (visible behind torso when facing down/side, covers back when facing up!)
  const drawCape = () => {
    ctx.fillStyle = cfg.cloakColor;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (dir === 1) {
      ctx.moveTo(2, -30);
      ctx.quadraticCurveTo(14 + stride * 2, -16, 12 + stride * 2.5, -5);
      ctx.lineTo(-4, -8);
      ctx.closePath();
    } else if (dir === 2) {
      ctx.moveTo(-2, -30);
      ctx.quadraticCurveTo(-14 - stride * 2, -16, -12 - stride * 2.5, -5);
      ctx.lineTo(4, -8);
      ctx.closePath();
    } else {
      ctx.moveTo(-12, -30);
      ctx.lineTo(12, -30);
      ctx.quadraticCurveTo(16, -16, 14 + stride, -5);
      ctx.lineTo(-14 + stride, -5);
      ctx.quadraticCurveTo(-16, -16, -12, -30);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
  };

  if (dir !== 3) drawCape();

  // Legs & Boots (animated RPG-JS walking stride!)
  const leftLegY = dir === 0 || dir === 3 ? stride * 2.5 : 0;
  const rightLegY = dir === 0 || dir === 3 ? -stride * 2.5 : 0;
  const sideLegOff = dir === 1 || dir === 2 ? stride * 4.5 : 0;

  ctx.fillStyle = '#3b2f38';
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;
  // Left boot
  ctx.beginPath();
  ctx.roundRect(-8 + sideLegOff, -12 + leftLegY, 7, 11, 3);
  ctx.fill();
  ctx.stroke();
  // Right boot
  ctx.beginPath();
  ctx.roundRect(1 - sideLegOff, -12 + rightLegY, 7, 11, 3);
  ctx.fill();
  ctx.stroke();

  // Armor / Tunic Torso
  const torsoW = dir === 1 || dir === 2 ? 16 : 22;
  ctx.fillStyle = cfg.tunicColor;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-torsoW * 0.5, -31, torsoW, 21, 6);
  ctx.fill();
  ctx.stroke();

  // Chest specular / belt trim
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.fillRect(-torsoW * 0.38, -29, torsoW * 0.76, 5);
  ctx.fillStyle = '#5c3114';
  ctx.fillRect(-torsoW * 0.5 + 1, -16, torsoW - 2, 4);
  ctx.fillStyle = cfg.trimColor;
  ctx.fillRect(-3, -16.5, 6, 5);

  // Hero Sword & Kite Shield or Elder Staff!
  if (cfg.isHero) {
    // Sword blade & gold crossguard
    const swX = dir === 1 ? -13 : dir === 2 ? 11 : 12;
    const swTilt = stride * 0.14;
    ctx.save();
    ctx.translate(swX, -22);
    ctx.rotate(swTilt + (dir === 1 ? -0.35 : 0.35));
    ctx.fillStyle = cfg.weaponColor ?? '#f1f5f9';
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-2.5, 4);
    ctx.lineTo(-2.5, -18);
    ctx.lineTo(0, -23);
    ctx.lineTo(2.5, -18);
    ctx.lineTo(2.5, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#facc15';
    ctx.fillRect(-6, 1, 12, 3.5);
    ctx.strokeRect(-6, 1, 12, 3.5);
    ctx.restore();

    // Kite shield on opposite arm
    if (dir !== 2) {
      const shX = dir === 1 ? 4 : -13;
      ctx.fillStyle = cfg.shieldColor ?? '#e2e8f0';
      ctx.strokeStyle = outline;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(shX - 5, -26);
      ctx.lineTo(shX + 5, -26);
      ctx.lineTo(shX + 5, -16);
      ctx.lineTo(shX, -11);
      ctx.lineTo(shX - 5, -16);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(shX - 1.5, -24, 3, 10);
      ctx.fillRect(shX - 3.5, -21, 7, 3);
    }
  } else if (cfg.hasStaff) {
    ctx.strokeStyle = '#6c3e1e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(13, -4);
    ctx.lineTo(13, -42);
    ctx.stroke();
    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(13, -44, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // If facing UP, draw cape over torso back!
  if (dir === 3) drawCape();

  // Flowing back hair for Feena / Lilia / Sara / Reah
  if (cfg.isLongHair && dir !== 3) {
    ctx.fillStyle = cfg.hairColor;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-14, -44, 28, 25, 10);
    ctx.fill();
    ctx.stroke();
  }

  // Expressive Chibi-Proportioned RPG-JS / Pipoya Head!
  ctx.fillStyle = skin;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -40, 12.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Expressive Anime JRPG Eyes & Rosy Cheeks (when facing down/left/right)
  if (dir !== 3) {
    const eyeOffX = dir === 1 ? -4 : dir === 2 ? 4 : 0;
    const eyeSpan = dir === 0 ? 4.8 : 3.4;
    for (const side of dir === 0 ? [-1, 1] : [dir === 1 ? -1 : 1]) {
      const ex = eyeOffX + side * eyeSpan;
      const ey = -38.5;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.ellipse(ex, ey, 2.2, 3.1, 0, 0, Math.PI * 2);
      ctx.fill();
      // Glossy JRPG eye highlight
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ex - 1, ey - 2, 1.8, 1.8);
    }
    // Subtle warm cheek blush
    ctx.fillStyle = 'rgba(244, 114, 182, 0.34)';
    if (dir === 0) {
      ctx.fillRect(-8.5, -35.5, 3, 2);
      ctx.fillRect(5.5, -35.5, 3, 2);
    } else {
      ctx.fillRect(eyeOffX + (dir === 1 ? -5 : 2), -35.5, 3, 2);
    }
  }

  // Layered Anime Hair Crown + Spikes + Specular Highlight Band!
  ctx.fillStyle = cfg.hairColor;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (dir === 3) {
    // Full back hair dome
    ctx.arc(0, -42, 13.8, 0, Math.PI * 2);
  } else {
    ctx.arc(0, -43, 13.8, Math.PI * 0.92, Math.PI * 0.08);
    ctx.lineTo(13, -36);
    ctx.lineTo(7, -43);
    ctx.lineTo(2, -37);
    ctx.lineTo(-3, -43);
    ctx.lineTo(-8, -37);
    ctx.lineTo(-13, -36);
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();

  if (cfg.isLongHair && dir === 3) {
    ctx.fillStyle = cfg.hairColor;
    ctx.beginPath();
    ctx.roundRect(-13, -42, 26, 26, 8);
    ctx.fill();
    ctx.stroke();
  }

  // Adol iconic spiky red crest!
  if (cfg.isHero) {
    ctx.fillStyle = cfg.hairColor;
    ctx.beginPath();
    ctx.moveTo(-8, -53);
    ctx.lineTo(-3, -61);
    ctx.lineTo(2, -55);
    ctx.lineTo(8, -60);
    ctx.lineTo(10, -52);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Glossy hair highlight arc
  ctx.strokeStyle = cfg.hairHi;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(0, -45, 9, Math.PI * 1.18, Math.PI * 1.82);
  ctx.stroke();

  ctx.restore();
}

export function buildRpgJsHeroSpriteSheet(
  weaponTier: number,
  armorTier: number,
  maxAniso: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256; // 4 frames x 64px
  canvas.height = 256; // 4 dirs x 64px
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 256);

  const armorTints = ['#94a3b8', '#cbd5e1', '#7dd3fc', '#f1f5f9', '#fef08a'];
  const weaponTints = ['#e2e8f0', '#f1f5f9', '#bae6fd', '#e0f2fe', '#fb923c'];

  const cfg: HumanoidSpriteConfig = {
    hairColor: '#dc2626',
    hairHi: '#fca5a5',
    tunicColor: armorTints[Math.min(4, armorTier)],
    cloakColor: '#dc2626',
    trimColor: '#facc15',
    isHero: true,
    weaponColor: weaponTints[Math.min(4, weaponTier)],
    shieldColor: armorTints[Math.min(4, armorTier)],
  };

  for (let dir = 0; dir < 4; dir++) {
    for (let frame = 0; frame < 4; frame++) {
      drawHumanoidFrame(ctx, frame * 64, dir * 64, dir as 0 | 1 | 2 | 3, frame as 0 | 1 | 2 | 3, cfg);
    }
  }
  return configureSpriteTexture(canvas, maxAniso, true);
}

export function buildRpgJsNpcSpriteSheet(npc: WorldNpc, maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 256);

  const isLongHair = npc.portrait === 'feena' || npc.portrait === 'lilia' || npc.portrait === 'sara';
  const cfg: HumanoidSpriteConfig = {
    hairColor: npc.hairColor,
    hairHi: 'rgba(255,255,255,0.55)',
    tunicColor: npc.tunicColor,
    cloakColor: npc.cloakColor,
    trimColor: '#fde047',
    isLongHair,
    hasStaff: npc.portrait === 'elder',
  };

  for (let dir = 0; dir < 4; dir++) {
    for (let frame = 0; frame < 4; frame++) {
      drawHumanoidFrame(ctx, frame * 64, dir * 64, dir as 0 | 1 | 2 | 3, frame as 0 | 1 | 2 | 3, cfg);
    }
  }
  return configureSpriteTexture(canvas, maxAniso, true);
}

// ============================================================================
// 4. HD-2D RPG-JS ANIMATED MONSTER & BOSS SPRITESHEET GENERATOR (2 frames x 1 row)
// ============================================================================
export function buildRpgJsEnemySpriteSheet(
  kind: 'slime' | 'goblin' | 'knight' | 'mage' | 'wyvern' | 'boss',
  color: string,
  accent: string,
  maxAniso: number
): THREE.CanvasTexture {
  const cell = kind === 'boss' ? 128 : 64;
  const canvas = document.createElement('canvas');
  canvas.width = cell * 2;
  canvas.height = cell;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const outline = '#120d1a';

  for (let f = 0; f < 2; f++) {
    ctx.save();
    ctx.translate(f * cell + cell * 0.5, cell * 0.9);
    const sc = kind === 'boss' ? 1.85 : 1.0;
    ctx.scale(sc, sc);
    const bounce = f === 0 ? 0 : -3;

    // Ground shadow
    ctx.fillStyle = 'rgba(8, 12, 24, 0.36)';
    ctx.beginPath();
    ctx.ellipse(0, 1, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = outline;
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';

    if (kind === 'slime') {
      const sqX = f === 0 ? 1.06 : 0.92;
      const sqY = f === 0 ? 0.92 : 1.1;
      ctx.scale(sqX, sqY);
      const g = ctx.createRadialGradient(-5, -18, 2, 0, -14, 20);
      g.addColorStop(0, '#ecfccb');
      g.addColorStop(0.45, color);
      g.addColorStop(1, '#14532d');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-17, 0);
      ctx.bezierCurveTo(-20, -18, -10, -28, 0, -28);
      ctx.bezierCurveTo(10, -28, 20, -18, 17, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Glossy jelly highlight
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.beginPath();
      ctx.ellipse(-6, -19, 4.5, 2.5, -0.4, 0, Math.PI * 2);
      ctx.fill();

      // Cute expressive RPG slime eyes
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(-5, -12, 2.5, 0, Math.PI * 2);
      ctx.arc(5, -12, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-6, -13.5, 1.5, 1.5);
      ctx.fillRect(4, -13.5, 1.5, 1.5);
    } else if (kind === 'wyvern') {
      ctx.translate(0, -10 + bounce * 1.4);
      const wingY = f === 0 ? -18 : -4;
      // Flapping bat/dragon wings
      ctx.fillStyle = accent;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * 6, -14);
        ctx.lineTo(side * 25, wingY - 12);
        ctx.lineTo(side * 20, wingY + 4);
        ctx.lineTo(side * 8, -6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, -12, 10, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Horned dragon head
      ctx.beginPath();
      ctx.arc(0, -27, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fde047';
      ctx.fillRect(-4, -28, 2.5, 2.5);
      ctx.fillRect(1.5, -28, 2.5, 2.5);
    } else if (kind === 'mage') {
      ctx.translate(0, bounce);
      // Floating dark arcane robes
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-14, -2);
      ctx.lineTo(-10, -32);
      ctx.lineTo(10, -32);
      ctx.lineTo(14, -2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Gold rune trim
      ctx.fillStyle = accent;
      ctx.fillRect(-3, -30, 6, 26);
      // Hooded face with glowing eyes
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-12, -30);
      ctx.lineTo(0, -52);
      ctx.lineTo(12, -30);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#090d1a';
      ctx.beginPath();
      ctx.arc(0, -36, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fde047';
      ctx.fillRect(-4, -37, 2.5, 2.5);
      ctx.fillRect(1.5, -37, 2.5, 2.5);
      // Floating orb staff
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(15, -2);
      ctx.lineTo(15, -42);
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(15, -45, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      // Goblin / Armored Dark Knight / Towering Demon Boss!
      ctx.translate(0, bounce);
      // Flowing battle cloak
      ctx.fillStyle = kind === 'boss' ? '#7f1d1d' : '#1e293b';
      ctx.beginPath();
      ctx.moveTo(-16, -34);
      ctx.lineTo(16, -34);
      ctx.lineTo(20, -2);
      ctx.lineTo(-20, -2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Armored torso & broad pauldrons
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(-13, -34, 26, 26, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(-14, -30, 7, 0, Math.PI * 2);
      ctx.arc(14, -30, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Horned Greathelm
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, -42, 10.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = accent;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * 8, -46);
        ctx.lineTo(side * 16, -57);
        ctx.lineTo(side * 4, -50);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      // Glowing visor eyes
      ctx.fillStyle = '#090d1a';
      ctx.fillRect(-7, -44, 14, 4);
      ctx.fillStyle = kind === 'boss' ? '#fb7185' : '#fde047';
      ctx.fillRect(-5, -43, 3.5, 2.5);
      ctx.fillRect(1.5, -43, 3.5, 2.5);

      // Glowing Broadsword / Halberd
      ctx.save();
      ctx.translate(16, -24);
      ctx.rotate(f === 0 ? 0.2 : -0.15);
      ctx.fillStyle = kind === 'boss' ? '#f43f5e' : '#bae6fd';
      ctx.beginPath();
      ctx.moveTo(-3, 6);
      ctx.lineTo(-3, -24);
      ctx.lineTo(0, -30);
      ctx.lineTo(3, -24);
      ctx.lineTo(3, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  return configureSpriteTexture(canvas, maxAniso, true);
}

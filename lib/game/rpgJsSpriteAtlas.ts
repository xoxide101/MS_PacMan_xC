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
  const isInterior = theme === 'interior';
  const isTown = theme === 'town' || theme === 'village';

  // 1. Base Vibrant Deep-Emerald RPG-JS / Pipoya Biome Ground Layer (Rich, Saturated Lush Green!)
  const basePalette: Record<ZoneDef['theme'], [string, string, string, string]> = {
    town: ['#109c28', '#09701c', '#24c43d', '#054a11'],
    village: ['#13a630', '#0a7820', '#2bcc48', '#065214'],
    plains: ['#139422', '#0b6b17', '#27bd36', '#06470e'],
    ruins: ['#178c27', '#0e631a', '#2db03d', '#084211'],
    shrine: ['#4b4d5a', '#3d404c', '#5b5e6d', '#31333e'],
    tower: ['#44273e', '#361d31', '#56334f', '#281424'],
    lava: ['#3c2128', '#2f181f', '#4f2c34', '#221015'],
    ice: ['#cde9f9', '#b5dcf4', '#e3f4fe', '#94c5e4'],
    interior: ['#8e5a32', '#754624', '#a86e3e', '#593318'],
  };
  const [cBase, cDark, cLight, cDeep] = basePalette[theme] ?? basePalette.town;
  ctx.fillStyle = cBase;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Organic Pipoya-style sunlit grass mottling, oak planks, or stone flagstone base
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const x = c * tilePx;
      const y = r * tilePx;
      const n = hash2d(c, r, 101);

      if (isInterior) {
        // Warm polished European oak floorboards with horizontal plank seams, grain & brass nails
        const planks = 3;
        const plankH = tilePx / planks;
        for (let p = 0; p < planks; p++) {
          const py = y + p * plankH;
          const v = hash2d(c * 5 + p, r * 3 + p, 151);
          ctx.fillStyle = v < 0.28 ? cDark : v < 0.68 ? cBase : cLight;
          ctx.fillRect(x, py, tilePx, plankH);
          // Subtle wood grain streak
          ctx.fillStyle = 'rgba(72, 38, 16, 0.14)';
          ctx.fillRect(x + 2, py + plankH * 0.45, tilePx - 4, 1.4);
          // Top sheen highlight & bottom plank groove
          ctx.fillStyle = 'rgba(255, 232, 198, 0.14)';
          ctx.fillRect(x, py, tilePx, 1);
          ctx.fillStyle = cDeep;
          ctx.fillRect(x, py + plankH - 1.2, tilePx, 1.2);
          // Staggered vertical plank butt-joint + brass nail dots
          const jointX = x + (((r + p) % 2 === 0 ? 0.35 : 0.72) * tilePx);
          ctx.fillStyle = cDeep;
          ctx.fillRect(jointX, py, 1.2, plankH);
          ctx.fillStyle = '#3b210e';
          ctx.fillRect(jointX - 2.4, py + 2.2, 1.4, 1.4);
          ctx.fillRect(jointX + 2.0, py + plankH - 3.6, 1.4, 1.4);
        }
      } else if (isDungeon) {
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
        // Vibrant lush sunlit emerald meadow mottling + deep woodland humus under forest tiles!
        const tileCode = zone.tiles[r][c];
        const isWoodlandFloor = tileCode === 2 || tileCode === 9;
        if (isWoodlandFloor) {
          // Deep shaded mossy forest floor & fern bed so transitional forest borders look rich & impassable
          ctx.fillStyle = n > 0.5 ? '#106b21' : '#0c571a';
          ctx.fillRect(x, y, tilePx, tilePx);
          ctx.fillStyle = 'rgba(7, 46, 14, 0.36)';
          ctx.beginPath();
          ctx.arc(x + tilePx * 0.5, y + tilePx * 0.5, tilePx * 0.52, 0, Math.PI * 2);
          ctx.fill();
          // Mossy highlights & tiny fallen leaves
          for (let m = 0; m < 3; m++) {
            const mx = x + 3 + hash2d(c * 5 + m, r, 131) * (tilePx - 6);
            const my = y + 3 + hash2d(c, r * 5 + m, 137) * (tilePx - 6);
            ctx.fillStyle = m === 0 ? '#1d8c31' : '#2ea642';
            ctx.beginPath();
            ctx.ellipse(mx, my, 3.2, 2.0, hash2d(c + m, r, 139) * Math.PI, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          if (n > 0.54) {
            ctx.fillStyle = cLight;
            ctx.beginPath();
            ctx.arc(x + tilePx * 0.5, y + tilePx * 0.5, tilePx * 0.58, 0, Math.PI * 2);
            ctx.fill();
          } else if (n < 0.28) {
            ctx.fillStyle = cDark;
            ctx.beginPath();
            ctx.arc(x + tilePx * 0.5, y + tilePx * 0.5, tilePx * 0.56, 0, Math.PI * 2);
            ctx.fill();
          }
          // Subtle soft clover cluster rings for close-up zoom richness
          if (hash2d(c, r, 117) > 0.45) {
            const clx = x + 4 + hash2d(c, r, 118) * (tilePx - 8);
            const cly = y + 4 + hash2d(c, r, 119) * (tilePx - 8);
            ctx.fillStyle = 'rgba(13, 98, 28, 0.32)';
            ctx.beginPath();
            ctx.arc(clx, cly, 3.4, 0, Math.PI * 2);
            ctx.fill();
          }
          // Crisp RPG-JS 4-blade deep emerald grass & sunlit clover tuft marks
          for (let t = 0; t < 6; t++) {
            const tx = x + 2 + hash2d(c * 7 + t, r, 121) * (tilePx - 6);
            const ty = y + 3 + hash2d(c, r * 7 + t, 127) * (tilePx - 6);
            ctx.fillStyle = t === 0 ? cDeep : t === 1 ? '#3de056' : t === 2 ? '#0b7820' : cLight;
            ctx.fillRect(tx, ty, 1.8, 3.8);
            ctx.fillRect(tx + 1.8, ty - 1.6, 1.7, 4.8);
            ctx.fillRect(tx + 3.6, ty - 0.3, 1.7, 3.6);
          }
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
  if (!isDungeon && !isInterior) {
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

  // Plush woven interior carpet palette keyed to room specialty
  const interiorCarpetColor =
    zone.interiorKind === 'fortune'
      ? '#6b21a8'
      : zone.interiorKind === 'weapon' || zone.interiorKind === 'tavern'
        ? '#991b1b'
        : zone.interiorKind === 'armor' || zone.interiorKind === 'guild' || zone.interiorKind === 'library'
          ? '#1e40af'
          : zone.interiorKind === 'inn' || zone.interiorKind === 'clinic'
            ? '#065f46'
            : '#7f1d1d';

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

      if (isInterior) {
        // Plush Woven Gold-Fringed Interior Carpet with Decorative Trim & Medallions!
        const insetL = lf ? 0 : 2;
        const insetR = rt ? 0 : 2;
        const insetT = up ? 0 : 2;
        const insetB = dn ? 0 : 2;
        const rx = x + insetL;
        const ry = y + insetT;
        const rw = tilePx - insetL - insetR;
        const rh = tilePx - insetT - insetB;

        // Soft carpet shadow on oak floorboards
        ctx.fillStyle = 'rgba(24, 12, 4, 0.34)';
        ctx.fillRect(rx - 1, ry + 1, rw + 2, rh + 1);

        // Rich velvet carpet body
        ctx.fillStyle = interiorCarpetColor;
        ctx.beginPath();
        ctx.roundRect(rx, ry, rw, rh, [radTL * 0.5, radTR * 0.5, radBR * 0.5, radBL * 0.5]);
        ctx.fill();

        // Woven textile micro-texture
        ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
        for (let wy = 2; wy < tilePx - 2; wy += 4) {
          ctx.fillRect(rx + 2, y + wy, Math.max(0, rw - 4), 1);
        }

        // Gold woven inner border on outer edges of rug
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2;
        if (!lf) {
          ctx.beginPath();
          ctx.moveTo(x + 5, ry + 2);
          ctx.lineTo(x + 5, ry + rh - 2);
          ctx.stroke();
        }
        if (!rt) {
          ctx.beginPath();
          ctx.moveTo(x + tilePx - 5, ry + 2);
          ctx.lineTo(x + tilePx - 5, ry + rh - 2);
          ctx.stroke();
        }
        if (!up) {
          ctx.beginPath();
          ctx.moveTo(rx + 2, y + 5);
          ctx.lineTo(rx + rw - 2, y + 5);
          ctx.stroke();
        }
        if (!dn) {
          ctx.beginPath();
          ctx.moveTo(rx + 2, y + tilePx - 5);
          ctx.lineTo(rx + rw - 2, y + tilePx - 5);
          ctx.stroke();
        }

        // Woven golden center diamond medallion on alternating interior tiles
        if ((c + r) % 2 === 0 && up && dn && lf && rt) {
          ctx.fillStyle = 'rgba(250, 204, 21, 0.32)';
          ctx.beginPath();
          ctx.moveTo(x + tilePx * 0.5, y + tilePx * 0.24);
          ctx.lineTo(x + tilePx * 0.74, y + tilePx * 0.5);
          ctx.lineTo(x + tilePx * 0.5, y + tilePx * 0.76);
          ctx.lineTo(x + tilePx * 0.26, y + tilePx * 0.5);
          ctx.closePath();
          ctx.fill();
        }
      } else if (isDungeon) {
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
        // Darker, Hand-Laid Broken-Up Medieval Cobblestone with Organic Wavy Shoulders & Mossy Grass Incursions!
        // Use deterministic smooth wave offsets along grass-facing borders so paths never look ruler-straight!
        const waveL = lf ? 0 : 2.2 + Math.sin(r * 1.15 + c * 0.4) * 2.1 + (hash2d(c, r, 201) - 0.5) * 2.2;
        const waveR = rt ? 0 : 2.2 + Math.sin(r * 1.25 + c * 0.5 + 1.4) * 2.1 + (hash2d(c, r, 202) - 0.5) * 2.2;
        const waveT = up ? 0 : 2.2 + Math.sin(c * 1.15 + r * 0.4 + 0.7) * 2.1 + (hash2d(c, r, 203) - 0.5) * 2.2;
        const waveB = dn ? 0 : 2.2 + Math.sin(c * 1.25 + r * 0.5 + 2.1) * 2.1 + (hash2d(c, r, 204) - 0.5) * 2.2;

        const rx = x + Math.max(0, waveL);
        const ry = y + Math.max(0, waveT);
        const rw = Math.max(6, tilePx - Math.max(0, waveL) - Math.max(0, waveR));
        const rh = Math.max(6, tilePx - Math.max(0, waveT) - Math.max(0, waveB));

        // Organic dark-loam & mossy shoulder blending unevenly into the deep emerald grass
        ctx.fillStyle = 'rgba(26, 44, 24, 0.72)';
        ctx.beginPath();
        ctx.roundRect(rx - 1.2, ry - 1.2, rw + 2.4, rh + 2.4, [
          !up && !lf ? tilePx * 0.44 : 2,
          !up && !rt ? tilePx * 0.44 : 2,
          !dn && !rt ? tilePx * 0.44 : 2,
          !dn && !lf ? tilePx * 0.44 : 2,
        ]);
        ctx.fill();

        // Deep dark weathered mortar bed (much darker slate-earth contrast!)
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(rx, ry, rw, rh, [
          !up && !lf ? tilePx * 0.42 : 0,
          !up && !rt ? tilePx * 0.42 : 0,
          !dn && !rt ? tilePx * 0.42 : 0,
          !dn && !lf ? tilePx * 0.42 : 0,
        ]);
        ctx.clip();
        ctx.fillStyle = '#252823';
        ctx.fillRect(x, y, tilePx, tilePx);

        // Rich damp moss & earth pockets inside crevices
        for (let m = 0; m < 2; m++) {
          if (hash2d(c * 3 + m, r, 205) > 0.25) {
            ctx.fillStyle = m === 0 ? 'rgba(18, 96, 30, 0.52)' : 'rgba(22, 32, 24, 0.48)';
            ctx.beginPath();
            ctx.arc(
              x + hash2d(c + m, r, 206) * tilePx,
              y + hash2d(c, r + m, 207) * tilePx,
              tilePx * (0.22 + hash2d(c, r, 208 + m) * 0.2),
              0,
              Math.PI * 2
            );
            ctx.fill();
          }
        }

        // Darker weathered charcoal-slate, damp basalt & aged granite cobblestones (broken up organically!)
        const cobblePalette = ['#565b57', '#67665e', '#454a47', '#736f63', '#3c413e', '#5d5b52', '#4c514d', '#62655f'];
        const rows = 3;
        const rowH = tilePx / rows;
        const isEdgeTile = !lf || !rt || !up || !dn;
        for (let br = 0; br < rows; br++) {
          const rowShift = ((br + r) % 2) * (tilePx * 0.21) + (hash2d(c, r * 3 + br, 209) - 0.5) * 3.0;
          let curX = x - tilePx * 0.16 + rowShift;
          let bc = 0;
          while (curX < x + tilePx + 2 && bc < 6) {
            const h1 = hash2d(c * 7 + bc, r * 5 + br, 211);
            const h2 = hash2d(c * 11 + bc, r * 13 + br, 213);
            const h3 = hash2d(c * 17 + bc, r * 3 + br, 217);
            const stoneW = tilePx * (0.25 + h1 * 0.23);
            const stoneH = rowH * (0.7 + h2 * 0.24);

            // Deliberately break up ~16% of edge stones / ~7% of inner stones so emerald moss & grass peek through!
            const brokenGap = (isEdgeTile && h3 < 0.17) || (!isEdgeTile && h3 < 0.06);
            if (!brokenGap) {
              const sx = curX + 1.2 + (h2 - 0.5) * 1.1;
              const sy = y + br * rowH + (rowH - stoneH) * 0.5 + (h3 - 0.5) * 1.6;
              const sw = Math.max(3.2, stoneW - 2.2);
              const sh = Math.max(2.8, stoneH - 1.4);
              const cornerR = Math.min(sw, sh) * (0.34 + h2 * 0.18);

              // Deep crevice drop shadow
              ctx.fillStyle = 'rgba(10, 12, 10, 0.72)';
              ctx.beginPath();
              ctx.roundRect(sx + 0.8, sy + 1.1, sw, sh, cornerR);
              ctx.fill();

              // Main dark weathered stone body
              const colIdx = Math.floor(h1 * cobblePalette.length) % cobblePalette.length;
              ctx.fillStyle = cobblePalette[colIdx];
              ctx.beginPath();
              ctx.roundRect(sx, sy, sw, sh, cornerR);
              ctx.fill();

              // Subtle worn mineral sheen on center-top of cobble
              ctx.fillStyle = 'rgba(218, 222, 210, 0.17)';
              ctx.beginPath();
              ctx.ellipse(sx + sw * 0.42, sy + sh * 0.34, sw * 0.28, sh * 0.2, (h3 - 0.5) * 0.4, 0, Math.PI * 2);
              ctx.fill();

              // Weather fractures & dark chipped edge lines
              if (h3 > 0.62 && sw > 4.8) {
                ctx.strokeStyle = 'rgba(18, 20, 18, 0.62)';
                ctx.lineWidth = 0.85;
                ctx.beginPath();
                ctx.moveTo(sx + sw * 0.2, sy + sh * 0.22);
                ctx.lineTo(sx + sw * 0.54, sy + sh * 0.56);
                ctx.lineTo(sx + sw * 0.76, sy + sh * 0.8);
                ctx.stroke();
              }

              // Emerald moss & tiny grass blades growing up between stone joints
              if (h2 > 0.58) {
                ctx.fillStyle = h1 > 0.5 ? '#128526' : '#1fa836';
                ctx.fillRect(sx - 1.0, sy + sh * 0.45, 2.2, 2.2);
                ctx.fillRect(sx + 0.4, sy + sh * 0.45 - 1.4, 1.5, 2.5);
              }
            } else {
              // Mossy emerald grass patch poking up where a cobble cracked away!
              const gx = curX + stoneW * 0.42;
              const gy = y + br * rowH + rowH * 0.5;
              ctx.fillStyle = '#0f8224';
              ctx.beginPath();
              ctx.ellipse(gx, gy, stoneW * 0.32, rowH * 0.3, h1 * 1.4, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = '#24bd3e';
              ctx.fillRect(gx - 1.5, gy - 1.8, 1.5, 3.0);
              ctx.fillRect(gx + 0.6, gy - 2.2, 1.4, 3.2);
            }

            curX += stoneW;
            bc++;
          }
        }
        ctx.restore();

        // Loose stray stepping-stones & lush grass tongues breaking up straight road boundaries!
        if (isEdgeTile) {
          for (let s = 0; s < 3; s++) {
            const hs = hash2d(c * 5 + s, r * 7 + s, 231);
            if (hs < 0.38) continue;
            let px = x + tilePx * 0.5;
            let py = y + tilePx * 0.5;
            if (!lf && s === 0) {
              px = rx - 1.2 - hs * 2.2;
              py = y + 3 + hash2d(c, r * 3 + s, 232) * (tilePx - 6);
            } else if (!rt && s === 1) {
              px = rx + rw + 0.5 + hs * 2.0;
              py = y + 3 + hash2d(c, r * 5 + s, 233) * (tilePx - 6);
            } else if (!up && s === 2) {
              px = x + 3 + hash2d(c * 3 + s, r, 234) * (tilePx - 6);
              py = ry - 1.2 - hs * 2.2;
            } else if (!dn) {
              px = x + 3 + hash2d(c * 5 + s, r, 235) * (tilePx - 6);
              py = ry + rh + 0.5 + hs * 2.0;
            } else {
              continue;
            }
            // Stray weathered edge cobble sitting slightly into the emerald grass
            ctx.fillStyle = 'rgba(12, 18, 12, 0.55)';
            ctx.beginPath();
            ctx.ellipse(px + 0.6, py + 0.8, 2.8, 2.1, hs * Math.PI, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = hs > 0.68 ? '#585d58' : '#464b47';
            ctx.beginPath();
            ctx.ellipse(px, py, 2.6, 1.9, hs * Math.PI, 0, Math.PI * 2);
            ctx.fill();
          }

          // Lush green grass tufts encroaching irregularly over road shoulders
          ctx.fillStyle = '#119126';
          for (let g = 0; g < 4; g++) {
            const hg = hash2d(c * 9 + g, r * 5 + g, 237);
            if (!lf && g % 2 === 0) {
              ctx.beginPath();
              ctx.arc(rx + hg * 2.4, y + 3 + hg * (tilePx - 6), 2.4, 0, Math.PI * 2);
              ctx.fill();
            }
            if (!rt && g % 2 === 1) {
              ctx.beginPath();
              ctx.arc(rx + rw - hg * 2.4, y + 3 + hg * (tilePx - 6), 2.4, 0, Math.PI * 2);
              ctx.fill();
            }
            if (!up && g % 2 === 0) {
              ctx.beginPath();
              ctx.arc(x + 3 + hg * (tilePx - 6), ry + hg * 2.4, 2.4, 0, Math.PI * 2);
              ctx.fill();
            }
            if (!dn && g % 2 === 1) {
              ctx.beginPath();
              ctx.arc(x + 3 + hg * (tilePx - 6), ry + rh - hg * 2.4, 2.4, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
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

  // 4. Dressed Hearth Flagstones (interior) OR Vibrant Pipoya Wildflower Beds (tile === 8) & Forest Shade
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const t = zone.tiles[r][c];
      const cx = (c + 0.5) * tilePx;
      const cy = (r + 0.5) * tilePx;

      if (t === 8 && isInterior) {
        // Warm dressed stone hearth & forge apron tiles
        const x = c * tilePx;
        const y = r * tilePx;
        ctx.fillStyle = '#47433e';
        ctx.fillRect(x, y, tilePx, tilePx);
        const pad = 2;
        const half = tilePx * 0.5;
        for (let sr = 0; sr < 2; sr++) {
          for (let sc = 0; sc < 2; sc++) {
            const v = hash2d(c * 2 + sc, r * 2 + sr, 307);
            ctx.fillStyle = v < 0.35 ? '#7c756c' : v < 0.7 ? '#8e867c' : '#6c655c';
            ctx.fillRect(x + sc * half + pad * 0.5, y + sr * half + pad * 0.5, half - pad, half - pad);
            ctx.fillStyle = 'rgba(255, 246, 224, 0.22)';
            ctx.fillRect(x + sc * half + pad * 0.5, y + sr * half + pad * 0.5, half - pad, 1.5);
          }
        }
      } else if (t === 8 && !isDungeon && !isIce && !isInterior) {
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
      } else if ((t === 2 || t === 9) && !isDungeon && !isIce && !isInterior) {
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
// 3. HIGH-RES 128x128 4-DIRECTION HD-2D CHRONICLES+ CHARACTER SPRITESHEETS!
// Layout: 4 cols (walk frames) x 4 rows (down, left, right, up) = 512x512 crisp canvas!
// Rich cel-shaded fabrics, armor highlights, pauldrons, belts, expressive eyes,
// layered hair textures, and role-specific accessories (hammer, apron, ribbon, shawl, staff)!
// ============================================================================
type NpcCostumeVariant =
  | 'hero'
  | 'fortune'
  | 'smith'
  | 'armorer'
  | 'maiden'
  | 'elder'
  | 'innkeep'
  | 'herbalist'
  | 'baker'
  | 'craft'
  | 'villager';

interface HumanoidSpriteConfig {
  hairColor: string;
  hairHi: string;
  hairShadow: string;
  eyeColor: string;
  tunicColor: string;
  tunicDark: string;
  cloakColor: string;
  trimColor: string;
  skinColor?: string;
  costume: NpcCostumeVariant;
  ageGroup?: 'adult' | 'child' | 'elder';
  isLongHair?: boolean;
  hasBeard?: boolean;
  weaponColor?: string;
  shieldColor?: string;
}

function drawHumanoidFrame(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  dir: 0 | 1 | 2 | 3, // 0=down, 1=left, 2=right, 3=up
  frame: 0 | 1 | 2 | 3,
  cfg: HumanoidSpriteConfig,
  cellW = 256,
  cellH = 256
): void {
  // Crisp HD-2D logical space: 64 wide x (64 child or 80 tall adult!)
  const scale = cellW / 64;
  const isChild = cfg.ageGroup === 'child';
  const legLift = isChild ? 0 : cfg.ageGroup === 'elder' ? 7.5 : 10.5;
  ctx.save();
  ctx.translate(ox + cellW * 0.5, oy + cellH * (isChild ? 116 / 128 : 298 / 320));
  ctx.scale(scale, scale);

  const stride = frame === 1 ? 1 : frame === 3 ? -1 : 0;
  const bob = Math.abs(stride) * (isChild ? 2.4 : 2.0);
  const skin = cfg.skinColor ?? '#ffd9b3';
  const skinShade = '#e8b387';
  const outline = '#16101c';
  const isHero = cfg.costume === 'hero';
  const isSide = dir === 1 || dir === 2;

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Soft contact ground shadow
  ctx.fillStyle = 'rgba(10, 16, 28, 0.34)';
  ctx.beginPath();
  ctx.ellipse(0, 1.5, 13.5, 4.4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(0, -bob);

  // Flowing Textured Cloak / Cape with Drapery Folds & Embroidered Gold Hem!
  const drawCape = () => {
    ctx.save();
    ctx.translate(0, -legLift);
    ctx.fillStyle = cfg.cloakColor;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    const capeBottom = -4.5 + legLift * 0.55;
    if (dir === 1) {
      ctx.moveTo(2, -31);
      ctx.quadraticCurveTo(15.5 + stride * 2.4, -17 + legLift * 0.25, 13.5 + stride * 3.0, capeBottom);
      ctx.lineTo(-4, capeBottom - 3.0);
      ctx.closePath();
    } else if (dir === 2) {
      ctx.moveTo(-2, -31);
      ctx.quadraticCurveTo(-15.5 - stride * 2.4, -17 + legLift * 0.25, -13.5 - stride * 3.0, capeBottom);
      ctx.lineTo(4, capeBottom - 3.0);
      ctx.closePath();
    } else {
      ctx.moveTo(-12.8, -31);
      ctx.lineTo(12.8, -31);
      ctx.quadraticCurveTo(17.2, -17 + legLift * 0.25, 14.8 + stride * 1.1, capeBottom);
      ctx.quadraticCurveTo(0, capeBottom + 2.2, -14.8 + stride * 1.1, capeBottom);
      ctx.quadraticCurveTo(-17.2, -17 + legLift * 0.25, -12.8, -31);
      ctx.closePath();
    }
    ctx.fill();

    // Vertical fabric drapery shadow folds + subtle specular rim
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
    if (isSide) {
      ctx.fillRect(dir === 1 ? 5 : -13, -31, 4.5, 36);
    } else {
      ctx.fillRect(-9, -31, 3.2, 36);
      ctx.fillRect(4.5, -31, 3.2, 36);
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.fillRect(isSide ? (dir === 1 ? 2 : -7) : -2.5, -31, 3.5, 34);
    // Gold embroidered cloak border near bottom hem
    ctx.strokeStyle = cfg.trimColor;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-16, capeBottom - 2.2);
    ctx.lineTo(16, capeBottom - 2.2);
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
  };

  if (dir !== 3) drawCape();

  // Articulated Tall Adult Legs / Armored Greaves & Cuffed Leather Boots (vs compact child legs!)
  const leftLegY = dir === 0 || dir === 3 ? stride * (isChild ? 2.4 : 3.2) : 0;
  const rightLegY = dir === 0 || dir === 3 ? -stride * (isChild ? 2.4 : 3.2) : 0;
  const sideLegOff = isSide ? stride * (isChild ? 4.2 : 5.6) : 0;

  const drawBoot = (bx: number, by: number) => {
    // Extended upper thigh / trouser leg for tall adults!
    if (legLift > 0) {
      ctx.fillStyle = cfg.costume === 'baker' ? '#f8fafc' : cfg.costume === 'maiden' ? '#475569' : '#2e2538';
      ctx.strokeStyle = outline;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.roundRect(bx + 0.4, by - legLift - 2.0, 6.2, legLift + 4.0, 2.0);
      ctx.fill();
      ctx.stroke();
      // Subtle knee seam & trouser specular highlight
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(bx + 1.4, by - legLift - 0.5, 2.0, legLift * 0.7);
      ctx.strokeStyle = 'rgba(0,0,0,0.28)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(bx + 1.0, by - legLift * 0.35);
      ctx.lineTo(bx + 6.0, by - legLift * 0.35);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#33293a';
      ctx.fillRect(bx + 0.6, by - 3.5, 5.8, 5);
    }
    // Tall leather riding boot / steel sabaton body
    const bootH = isChild ? 10.5 : 12.2;
    const bootTop = by - (isChild ? 0 : 1.7);
    ctx.fillStyle = isHero ? '#592e1a' : cfg.costume === 'armorer' ? '#64748b' : '#4a3226';
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.45;
    ctx.beginPath();
    ctx.roundRect(bx, bootTop, 7.0, bootH, 2.6);
    ctx.fill();
    ctx.stroke();
    // Folded boot cuff + steel knee-cap for hero/armorer
    ctx.fillStyle = isHero || cfg.costume === 'armorer' ? '#e2e8f0' : '#7c4d34';
    ctx.fillRect(bx + 0.6, bootTop + 0.5, 5.8, 2.8);
    // Brass boot strap buckle
    ctx.fillStyle = '#eab308';
    ctx.fillRect(bx + 4.4, bootTop + 4.4, 1.8, 1.4);
    // Specular leather gleam & dark sole
    ctx.fillStyle = 'rgba(255, 240, 220, 0.28)';
    ctx.fillRect(bx + 1.2, bootTop + 4.2, 2.2, 4.4);
    ctx.fillStyle = '#1b141a';
    ctx.fillRect(bx + 0.5, bootTop + bootH - 1.9, 6.0, 1.9);
  };
  drawBoot(-8 + sideLegOff, -11.5 + leftLegY);
  drawBoot(1 - sideLegOff, -11.5 + rightLegY);

  // Lift torso, arms, cape-back & head smoothly onto tall adult legs!
  ctx.translate(0, -legLift);

  // Pleated Skirt / Long Tunic Hem / Armored Chainmail Tassets over Waist
  const torsoW = isSide ? 16.5 : 22.5;
  if (cfg.costume === 'maiden' || cfg.costume === 'fortune' || cfg.costume === 'elder') {
    ctx.fillStyle = cfg.tunicColor;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-torsoW * 0.48, -16);
    ctx.lineTo(torsoW * 0.48, -16);
    ctx.lineTo(torsoW * 0.62, -6.5);
    ctx.lineTo(-torsoW * 0.62, -6.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Skirt pleats + embroidered trim hem
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.lineWidth = 1;
    for (const px of [-4.5, 0, 4.5]) {
      ctx.beginPath();
      ctx.moveTo(px * 0.8, -15);
      ctx.lineTo(px * 1.15, -7);
      ctx.stroke();
    }
    ctx.strokeStyle = cfg.trimColor;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(-torsoW * 0.58, -8);
    ctx.lineTo(torsoW * 0.58, -8);
    ctx.stroke();
  } else if (isHero) {
    // Hero navy-and-gold tasset tunic skirt peeking beneath breastplate
    ctx.fillStyle = '#1e3a8a';
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.35;
    ctx.beginPath();
    ctx.roundRect(-torsoW * 0.48, -15.5, torsoW * 0.96, 6.2, 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = cfg.trimColor;
    ctx.fillRect(-torsoW * 0.44, -10.8, torsoW * 0.88, 1.3);
  }

  // Sculpted Layered Torso (Breastplate / Tunic / Leather Apron / Embroidered Robe!)
  const bodyGrad = ctx.createLinearGradient(0, -32, 0, -11);
  bodyGrad.addColorStop(0, cfg.tunicColor);
  bodyGrad.addColorStop(1, cfg.tunicDark);
  ctx.fillStyle = bodyGrad;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.55;
  ctx.beginPath();
  ctx.roundRect(-torsoW * 0.5, -31.5, torsoW, 19.5, 5.5);
  ctx.fill();
  ctx.stroke();

  // Fabric / Armor Surface Details & Costume-Specific Layers!
  if (isHero) {
    // Polished Silver/Steel Breastplate Center Ridge + Specular Metallic Band + Cross-Chest Leather Baldric!
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.roundRect(-torsoW * 0.36, -29.8, torsoW * 0.72, 4.8, 2);
    ctx.fill();
    // Armor center ridge & rivets
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.42)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.lineTo(0, -17);
    ctx.stroke();
    // Diagonal brown leather sword baldric strap
    ctx.strokeStyle = '#6b3416';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-torsoW * 0.42, -30);
    ctx.lineTo(torsoW * 0.4, -16.5);
    ctx.stroke();
    // Layered armored shoulder pauldrons with golden trim!
    for (const sideSgn of isSide ? [dir === 1 ? -1 : 1] : [-1, 1]) {
      const px = sideSgn * (torsoW * 0.48);
      ctx.fillStyle = cfg.tunicColor;
      ctx.strokeStyle = outline;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(px, -28.2, 4.6, 3.6, sideSgn * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = cfg.trimColor;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(px, -28.2, 3.2, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }
    // Red adventurer neck scarf
    ctx.fillStyle = '#dc2626';
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.roundRect(-7, -32.2, 14, 3.8, 2);
    ctx.fill();
    ctx.stroke();
  } else if (cfg.costume === 'smith') {
    // Heavy Blacksmith Leather Apron + Brass Rivets + Soot-Textured Front!
    ctx.fillStyle = '#4a2915';
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.roundRect(-torsoW * 0.36, -28.5, torsoW * 0.72, 17, 2.5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#eab308';
    ctx.fillRect(-torsoW * 0.28, -27.2, 1.8, 1.8);
    ctx.fillRect(torsoW * 0.28 - 1.8, -27.2, 1.8, 1.8);
  } else if (cfg.costume === 'innkeep') {
    // Crisp White Linen Apron & Neck Kerchief
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.fillRect(-torsoW * 0.34, -22, torsoW * 0.68, 11);
    ctx.strokeRect(-torsoW * 0.34, -22, torsoW * 0.68, 11);
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(-5, -31.5);
    ctx.lineTo(5, -31.5);
    ctx.lineTo(0, -25.5);
    ctx.closePath();
    ctx.fill();
  } else if (cfg.costume === 'fortune') {
    // Mystic Star-Embroidered Shawl & Glowing Amethyst Brooch
    ctx.fillStyle = '#581c87';
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-torsoW * 0.5, -31);
    ctx.lineTo(torsoW * 0.5, -31);
    ctx.lineTo(0, -20.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e879f9';
    ctx.beginPath();
    ctx.arc(0, -26, 2.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (cfg.costume === 'herbalist') {
    // Cross-body Herb Satchel Strap + Emerald Potion Vial
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-torsoW * 0.4, -30);
    ctx.lineTo(torsoW * 0.38, -16);
    ctx.stroke();
    ctx.fillStyle = '#4ade80';
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(torsoW * 0.3, -15, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (cfg.costume === 'maiden') {
    // Ruffled White Collar + Laced Corset Bodice
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, -30, 7.2, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-3.2, -27);
    ctx.lineTo(3.2, -24);
    ctx.moveTo(3.2, -27);
    ctx.lineTo(-3.2, -24);
    ctx.stroke();
  } else if (cfg.costume === 'elder') {
    // Vertical Golden-Embroidered Sage Stole
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(-3.4, -31, 6.8, 19);
    ctx.fillStyle = '#b45309';
    ctx.fillRect(-1.4, -31, 2.8, 19);
  } else {
    // Textured Jacket Lapels & Shirt Highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.fillRect(-torsoW * 0.34, -29.5, torsoW * 0.68, 4.2);
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(-4, -31.5);
    ctx.lineTo(4, -31.5);
    ctx.lineTo(0, -24.5);
    ctx.closePath();
    ctx.fill();
  }

  // Stitched Leather Belt + Brass Buckle on All Characters
  ctx.fillStyle = '#5c3114';
  ctx.fillRect(-torsoW * 0.5 + 0.8, -16.2, torsoW - 1.6, 3.6);
  ctx.fillStyle = cfg.trimColor;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 0.9;
  ctx.fillRect(-2.8, -16.8, 5.6, 4.6);
  ctx.strokeRect(-2.8, -16.8, 5.6, 4.6);

  // Articulated Swinging Sleeves & Gloved Hands
  const armSwing = stride * 2.2;
  for (const sgn of isSide ? [dir === 1 ? -1 : 1] : [-1, 1]) {
    const ax = sgn * (torsoW * 0.5 + 1.2);
    const ay = -24 + (sgn === -1 ? armSwing : -armSwing);
    ctx.fillStyle = cfg.tunicColor;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.roundRect(ax - 2.4, ay - 3, 4.8, 9.5, 2.2);
    ctx.fill();
    ctx.stroke();
    // Gloved / skin hand
    ctx.fillStyle = isHero ? '#4a2512' : skin;
    ctx.beginPath();
    ctx.arc(ax, ay + 6.8, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Detailed Hero Broadsword + Crested Shield OR Role Tools (Forge Hammer, Elder Staff)!
  if (isHero) {
    const swX = dir === 1 ? -13.5 : dir === 2 ? 12 : 13;
    const swTilt = stride * 0.14;
    ctx.save();
    ctx.translate(swX, -21);
    ctx.rotate(swTilt + (dir === 1 ? -0.34 : 0.34));
    // Metallic bevelled blade with bright fuller shine
    const bladeGrad = ctx.createLinearGradient(-3, -24, 3, 4);
    bladeGrad.addColorStop(0, '#ffffff');
    bladeGrad.addColorStop(0.5, cfg.weaponColor ?? '#e2e8f0');
    bladeGrad.addColorStop(1, '#94a3b8');
    ctx.fillStyle = bladeGrad;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.35;
    ctx.beginPath();
    ctx.moveTo(-2.6, 4);
    ctx.lineTo(-2.4, -19.5);
    ctx.lineTo(0, -25.5);
    ctx.lineTo(2.4, -19.5);
    ctx.lineTo(2.6, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Center fuller groove highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(0, -21);
    ctx.lineTo(0, 1);
    ctx.stroke();
    // Ornate golden crossguard + ruby pommel
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(-6.5, 0.8, 13, 3.6, 1.2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(0, 2.6, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Crested Esterian Kite Shield on Opposite Arm
    if (dir !== 2) {
      const shX = dir === 1 ? 4.5 : -13.5;
      const shGrad = ctx.createLinearGradient(shX - 6, -27, shX + 6, -11);
      shGrad.addColorStop(0, '#f8fafc');
      shGrad.addColorStop(0.5, cfg.shieldColor ?? '#cbd5e1');
      shGrad.addColorStop(1, '#64748b');
      ctx.fillStyle = shGrad;
      ctx.strokeStyle = outline;
      ctx.lineWidth = 1.45;
      ctx.beginPath();
      ctx.moveTo(shX - 5.6, -26.5);
      ctx.lineTo(shX + 5.6, -26.5);
      ctx.lineTo(shX + 5.6, -15.5);
      ctx.lineTo(shX, -9.8);
      ctx.lineTo(shX - 5.6, -15.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Gold inner trim & crimson Esterian cross emblem
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 1;
      ctx.strokeRect(shX - 4, -24.8, 8, 9.2);
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(shX - 1.4, -24.5, 2.8, 11);
      ctx.fillRect(shX - 3.8, -21.2, 7.6, 2.8);
    }
  } else if (cfg.costume === 'elder') {
    // Carved Sage Oak Staff + Glowing Azure Crystal Orb!
    ctx.strokeStyle = '#6c3e1e';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(13.5, -3);
    ctx.lineTo(13.5, -43);
    ctx.stroke();
    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(13.5, -45.5, 4.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(12.2, -47, 1.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (cfg.costume === 'smith') {
    // Forged Iron Blacksmith Hammer held at side
    ctx.strokeStyle = '#5c3114';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(12.5, -14);
    ctx.lineTo(14.5, -28);
    ctx.stroke();
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.2;
    ctx.fillRect(10.5, -31.5, 8, 4.6);
    ctx.strokeRect(10.5, -31.5, 8, 4.6);
  }

  // If facing UP, draw cape cleanly over back
  if (dir === 3) drawCape();

  if (isHero) {
    // =========================================================================
    // ADOL CHRISTIN — BESPOKE 256x256 HERO HEAD, ANIME FACE, LAYERED SPIKY HAIR & SCARF
    // =========================================================================
    const flutter = stride * 1.65;

    // 1. Golden Esteria Winged Crest on Breastplate + Flowing Crimson Adventurer Scarf
    if (dir !== 3) {
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      ctx.moveTo(0, -25.2);
      ctx.lineTo(2.9, -22.2);
      ctx.lineTo(0, -19.2);
      ctx.lineTo(-2.9, -22.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // Layered crimson scarf collar + fluttering trailing tail
    ctx.fillStyle = '#b91c1c';
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    if (dir === 1) {
      ctx.moveTo(4.5, -31.8);
      ctx.quadraticCurveTo(13 + flutter, -28.5, 16.5 + flutter * 1.4, -22.2);
      ctx.lineTo(11.8 + flutter * 1.1, -20.5);
      ctx.quadraticCurveTo(9.2 + flutter * 0.6, -26.2, 2.5, -28.6);
      ctx.closePath();
    } else if (dir === 2) {
      ctx.moveTo(-4.5, -31.8);
      ctx.quadraticCurveTo(-13 - flutter, -28.5, -16.5 - flutter * 1.4, -22.2);
      ctx.lineTo(-11.8 - flutter * 1.1, -20.5);
      ctx.quadraticCurveTo(-9.2 - flutter * 0.6, -26.2, -2.5, -28.6);
      ctx.closePath();
    } else {
      ctx.moveTo(3.5, -30.5);
      ctx.quadraticCurveTo(11.5 + flutter, -27.2, 13.8 + flutter * 1.2, -19.4);
      ctx.lineTo(9.4 + flutter * 0.9, -18.5);
      ctx.quadraticCurveTo(7.4 + flutter * 0.5, -25.0, 1.4, -28.0);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.roundRect(-8.8, -32.8, 17.6, 4.4, 2.2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#fca5a5';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(-6.2, -31.0);
    ctx.lineTo(5.8, -31.0);
    ctx.stroke();

    // 2. Stride-Fluttering Crimson Back Hair Spikes behind Neck & Jaw
    const backHairGrad = ctx.createLinearGradient(0, -56, 0, -28);
    backHairGrad.addColorStop(0, '#b91c1c');
    backHairGrad.addColorStop(1, '#5c1111');
    ctx.fillStyle = backHairGrad;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.35;
    ctx.beginPath();
    ctx.moveTo(-13.8, -44);
    ctx.lineTo(-17.4 - flutter * 0.5, -35.8);
    ctx.lineTo(-13.4, -34.2);
    ctx.lineTo(-14.8 - flutter * 0.4, -29.2);
    ctx.lineTo(-8.6, -31.2);
    ctx.lineTo(8.6, -31.2);
    ctx.lineTo(14.8 + flutter * 0.4, -29.2);
    ctx.lineTo(13.4, -34.2);
    ctx.lineTo(17.4 + flutter * 0.5, -35.8);
    ctx.lineTo(13.8, -44);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 3. Sculpted Hero Neck, Tapered Anime Jawline, Chin & Shaded Ears
    ctx.fillStyle = skinShade;
    ctx.fillRect(-3.4, -34.2, 6.8, 4.4);
    const faceGrad = ctx.createRadialGradient(-2.6, -42.6, 2.0, 0, -39.2, 13.8);
    faceGrad.addColorStop(0, '#ffeed9');
    faceGrad.addColorStop(0.62, skin);
    faceGrad.addColorStop(1, '#dfa476');
    ctx.fillStyle = faceGrad;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.4;

    // Ears
    if (dir === 0 || dir === 3) {
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(s * 12.1, -39.2, 2.1, 3.1, s * 0.14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#c88b62';
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.arc(s * 11.9, -39.2, 1.1, -0.8, 1.2);
        ctx.stroke();
        ctx.strokeStyle = outline;
        ctx.lineWidth = 1.4;
      }
    } else {
      const earX = dir === 1 ? 4.4 : -4.4;
      ctx.beginPath();
      ctx.ellipse(earX, -38.8, 2.0, 3.0, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Tapered anime face silhouette (slight cheek & chin definition)
    ctx.beginPath();
    if (dir === 1) {
      ctx.moveTo(-11.2, -45.5);
      ctx.quadraticCurveTo(-12.6, -40.2, -11.4, -36.8);
      ctx.lineTo(-12.4, -35.6); // crisp side-profile nose tip
      ctx.lineTo(-10.4, -34.6);
      ctx.quadraticCurveTo(-7.6, -28.6, 0.5, -28.2);
      ctx.quadraticCurveTo(10.8, -29.2, 11.8, -39.5);
      ctx.arc(0, -41.2, 12.0, 0.12, Math.PI * 1.12, true);
      ctx.closePath();
    } else if (dir === 2) {
      ctx.moveTo(11.2, -45.5);
      ctx.quadraticCurveTo(12.6, -40.2, 11.4, -36.8);
      ctx.lineTo(12.4, -35.6);
      ctx.lineTo(10.4, -34.6);
      ctx.quadraticCurveTo(7.6, -28.6, -0.5, -28.2);
      ctx.quadraticCurveTo(-10.8, -29.2, -11.8, -39.5);
      ctx.arc(0, -41.2, 12.0, Math.PI - 0.12, -Math.PI * 0.12, false);
      ctx.closePath();
    } else {
      ctx.moveTo(-12.2, -42.5);
      ctx.quadraticCurveTo(-12.4, -34.0, -6.2, -30.2);
      ctx.quadraticCurveTo(0, -27.4, 6.2, -30.2);
      ctx.quadraticCurveTo(12.4, -34.0, 12.2, -42.5);
      ctx.arc(0, -42.2, 12.2, 0, Math.PI, true);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();

    // Subtle under-chin & forehead bangs cast shadow
    if (dir !== 3) {
      ctx.fillStyle = 'rgba(180, 105, 68, 0.22)';
      ctx.beginPath();
      ctx.ellipse(0, -44.2, 10.2, 2.8, 0, 0, Math.PI * 2);
      ctx.fill();

      // 4. Luminous Amber-Gold Hero Anime Eyes (3-stop iris, upper/lower lashes, pupil, dual catchlights!)
      const eyeOffX = dir === 1 ? -4.8 : dir === 2 ? 4.8 : 0;
      const eyeSpan = dir === 0 ? 5.1 : 2.8;
      const sides = dir === 0 ? [-1, 1] : [dir === 1 ? -1 : 1];
      for (const side of sides) {
        const ex = eyeOffX + side * eyeSpan;
        const ey = -38.6;
        const ew = dir === 0 ? 2.85 : 2.35;
        const eh = 3.55;

        // Sclera with soft upper lid shadow
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(ex, ey, ew, eh, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(148, 163, 184, 0.28)';
        ctx.beginPath();
        ctx.ellipse(ex, ey - 1.3, ew * 0.92, eh * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();

        // 3-stop luminous amber-gold iris gradient
        const irisGrad = ctx.createLinearGradient(ex, ey - 2.4, ex, ey + 2.8);
        irisGrad.addColorStop(0, '#451a03');
        irisGrad.addColorStop(0.45, '#b45309');
        irisGrad.addColorStop(0.85, '#f59e0b');
        irisGrad.addColorStop(1, '#fde047');
        ctx.fillStyle = irisGrad;
        ctx.beginPath();
        ctx.ellipse(ex, ey + 0.35, ew * 0.78, eh * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Crisp dark pupil & outer iris rim
        ctx.strokeStyle = '#3b1506';
        ctx.lineWidth = 0.55;
        ctx.stroke();
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.ellipse(ex, ey + 0.4, ew * 0.4, eh * 0.44, 0, 0, Math.PI * 2);
        ctx.fill();

        // Bold winged upper eyelash + delicate lower lash line
        ctx.strokeStyle = '#120d1a';
        ctx.lineWidth = 1.65;
        ctx.beginPath();
        ctx.arc(ex, ey - 0.1, ew + 0.25, Math.PI * 1.08, Math.PI * 1.92);
        ctx.stroke();
        ctx.strokeStyle = '#3f242c';
        ctx.lineWidth = 0.65;
        ctx.beginPath();
        ctx.arc(ex, ey + 0.35, ew * 0.85, Math.PI * 0.18, Math.PI * 0.82);
        ctx.stroke();

        // Dual bright anime catchlight sparkles
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex - ew * 0.34, ey - 1.25, 1.05, 0, Math.PI * 2);
        ctx.arc(ex + ew * 0.32, ey + 1.45, 0.54, 0, Math.PI * 2);
        ctx.fill();

        // Confident arched crimson hero eyebrow
        ctx.strokeStyle = '#7f1d1d';
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        if (dir === 0) {
          ctx.moveTo(ex - side * 2.4, ey - 4.3);
          ctx.quadraticCurveTo(ex, ey - 5.2, ex + side * 2.5, ey - 4.7);
        } else {
          ctx.moveTo(ex - 2.0, ey - 4.7);
          ctx.lineTo(ex + 2.1, ey - 4.4);
        }
        ctx.stroke();
      }

      // Soft warm cheek blush & refined anime nose + determined adventurous smile
      ctx.fillStyle = 'rgba(244, 114, 182, 0.24)';
      if (dir === 0) {
        ctx.beginPath();
        ctx.ellipse(-7.8, -35.0, 2.2, 1.05, 0, 0, Math.PI * 2);
        ctx.ellipse(7.8, -35.0, 2.2, 1.05, 0, 0, Math.PI * 2);
        ctx.fill();
        // Delicate nose bridge highlight & shadow dot
        ctx.strokeStyle = '#c4815a';
        ctx.lineWidth = 0.85;
        ctx.beginPath();
        ctx.moveTo(0.2, -37.2);
        ctx.lineTo(-0.3, -35.4);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.ellipse(eyeOffX + (dir === 1 ? -2.2 : 2.2), -35.0, 2.0, 1.0, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // Confident half-smile
      ctx.strokeStyle = '#8b4534';
      ctx.lineWidth = 1.05;
      ctx.beginPath();
      const mouthX = dir === 1 ? -7.2 : dir === 2 ? 7.2 : 0;
      ctx.moveTo(mouthX - 2.3, -32.6);
      ctx.quadraticCurveTo(mouthX + 0.4, -31.2, mouthX + 2.5, -32.9);
      ctx.stroke();
    }

    // 5. Multi-Layered Fiery-Red Hero Hair Crown, 9 Sculpted Forehead Bangs, Side-Locks & Sweeping Spikes!
    const adolHairGrad = ctx.createLinearGradient(-4, -63, 4, -32);
    adolHairGrad.addColorStop(0, '#fb923c');
    adolHairGrad.addColorStop(0.24, '#ef4444');
    adolHairGrad.addColorStop(0.62, '#dc2626');
    adolHairGrad.addColorStop(1, '#7f1d1d');
    ctx.fillStyle = adolHairGrad;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.45;

    ctx.beginPath();
    if (dir === 3) {
      // Rich layered back-of-head crimson hair with windswept nape spikes
      ctx.arc(0, -43.0, 14.3, Math.PI * 0.92, Math.PI * 0.08);
      ctx.lineTo(14.8, -32.5);
      ctx.lineTo(10.2, -35.8);
      ctx.lineTo(7.4, -29.6);
      ctx.lineTo(3.2, -33.8);
      ctx.lineTo(0, -28.8);
      ctx.lineTo(-3.2, -33.8);
      ctx.lineTo(-7.4, -29.6);
      ctx.lineTo(-10.2, -35.8);
      ctx.lineTo(-14.8, -32.5);
      ctx.closePath();
    } else {
      // Sculpted crown + 9 layered cheek-framing side-locks & swept forehead bangs!
      ctx.arc(0, -44.0, 14.3, Math.PI * 0.94, Math.PI * 0.06);
      ctx.lineTo(14.4, -33.2); // right outer side-lock
      ctx.lineTo(11.4, -37.2);
      ctx.lineTo(10.6, -32.4); // right cheek-framing lock
      ctx.lineTo(8.2, -41.4);
      ctx.lineTo(6.4, -35.6); // right mid bang
      ctx.lineTo(3.5, -42.6);
      ctx.lineTo(1.2, -35.0); // center hero bang
      ctx.lineTo(-1.8, -42.8);
      ctx.lineTo(-4.6, -35.8); // left mid bang
      ctx.lineTo(-7.6, -41.6);
      ctx.lineTo(-10.6, -32.4); // left cheek-framing lock
      ctx.lineTo(-11.4, -37.2);
      ctx.lineTo(-14.4, -33.2); // left outer side-lock
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();

    // Sweeping iconic fiery-red crown hero spikes (left, center-tall, right windswept!)
    ctx.fillStyle = adolHairGrad;
    ctx.beginPath();
    ctx.moveTo(-13.2, -49.5);
    ctx.lineTo(-16.2 - flutter * 0.3, -55.8);
    ctx.lineTo(-10.0, -53.2);
    ctx.lineTo(-6.2, -62.5);
    ctx.lineTo(-1.2, -55.8);
    ctx.lineTo(3.8, -63.4);
    ctx.lineTo(8.2, -55.2);
    ctx.lineTo(14.5 + flutter * 0.3, -59.2);
    ctx.lineTo(12.2, -50.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Fine internal crimson hair-strand ink lines for sculpted anime depth
    ctx.strokeStyle = '#7f1d1d';
    ctx.lineWidth = 0.85;
    for (const [x1, y1, x2, y2] of [
      [-8.5, -53.0, -10.0, -37.5],
      [-4.2, -56.0, -4.4, -39.0],
      [1.4, -57.5, 1.0, -38.5],
      [6.2, -54.0, 6.6, -39.2],
      [10.2, -51.5, 10.6, -37.0],
    ]) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo((x1 + x2) * 0.5 + 0.6, (y1 + y2) * 0.5, x2, y2);
      ctx.stroke();
    }

    // Luminous anime angel-ring crown highlight sheen (warm amber-coral + crisp white glint)
    ctx.strokeStyle = '#fdba74';
    ctx.lineWidth = 2.3;
    ctx.beginPath();
    ctx.arc(0, -46.2, 9.6, Math.PI * 1.14, Math.PI * 1.86);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(-2.4, -47.4, 6.8, Math.PI * 1.18, Math.PI * 1.56);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(3.8, -46.8, 5.2, Math.PI * 1.62, Math.PI * 1.84);
    ctx.stroke();
  } else {
    // Flowing Textured Back Hair (for Lilia / Feena / Sara / Long-haired Villagers)
    if (cfg.isLongHair && dir !== 3) {
      ctx.fillStyle = cfg.hairShadow;
      ctx.strokeStyle = outline;
      ctx.lineWidth = 1.45;
      ctx.beginPath();
      ctx.roundRect(-14.2, -44, 28.4, 26, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = cfg.hairColor;
      ctx.beginPath();
      ctx.roundRect(-12.2, -43, 24.4, 22, 8);
      ctx.fill();
    }

    // Crisp Baker's Apron / Craftworker Tool Apron Accent on Torso Front!
    if ((cfg.costume === 'baker' || cfg.costume === 'craft') && dir !== 3) {
      ctx.fillStyle = cfg.costume === 'baker' ? '#fffbeb' : '#92400e';
      ctx.strokeStyle = outline;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.roundRect(isSide ? -5.5 : -7.5, -26.5, isSide ? 11 : 15, 16, 2.2);
      ctx.fill();
      ctx.stroke();
      if (cfg.costume === 'craft') {
        // Leather pocket & brass rivet
        ctx.fillStyle = '#78350f';
        ctx.fillRect(-4.5, -18, 9, 4.5);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(-1, -17, 2, 1.5);
      } else {
        // Red necker-scarf for Master Baker!
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(-5.5, -31.5, 11, 3.2);
      }
    }

    // Sculpted Anime Neck, Ears & Tapered Jawline / Side-Profile Nose!
    ctx.fillStyle = skinShade;
    ctx.fillRect(-3.4, -34.0, 6.8, 4.5);
    const headGrad = ctx.createRadialGradient(-2.8, -42.5, 2, 0, -39.5, 13.6);
    headGrad.addColorStop(0, '#ffeed9');
    headGrad.addColorStop(0.62, skin);
    headGrad.addColorStop(1, '#dfa476');
    ctx.fillStyle = headGrad;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.45;

    // Shaded Ears for ALL angles
    if (dir === 0 || dir === 3) {
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(s * 11.8, -39.2, 2.0, 2.9, s * 0.14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.ellipse(dir === 1 ? 4.2 : -4.2, -38.8, 1.9, 2.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Tapered Adult Face / Rounded Child Face with Side-Profile Nose!
    ctx.beginPath();
    if (isChild) {
      ctx.arc(0, -40.2, 12.8, 0, Math.PI * 2);
    } else if (dir === 1) {
      ctx.moveTo(-11.0, -45.2);
      ctx.quadraticCurveTo(-12.2, -40.0, -11.0, -36.8);
      ctx.lineTo(-12.2, -35.6);
      ctx.lineTo(-10.2, -34.6);
      ctx.quadraticCurveTo(-7.4, -28.8, 0.4, -28.4);
      ctx.quadraticCurveTo(10.5, -29.4, 11.5, -39.6);
      ctx.arc(0, -41.0, 11.8, 0.12, Math.PI * 1.12, true);
      ctx.closePath();
    } else if (dir === 2) {
      ctx.moveTo(11.0, -45.2);
      ctx.quadraticCurveTo(12.2, -40.0, 11.0, -36.8);
      ctx.lineTo(12.2, -35.6);
      ctx.lineTo(10.2, -34.6);
      ctx.quadraticCurveTo(7.4, -28.8, -0.4, -28.4);
      ctx.quadraticCurveTo(-10.5, -29.4, -11.5, -39.6);
      ctx.arc(0, -41.0, 11.8, Math.PI - 0.12, -Math.PI * 0.12, false);
      ctx.closePath();
    } else {
      ctx.moveTo(-11.8, -42.2);
      ctx.quadraticCurveTo(-12.0, -34.0, -6.0, -30.2);
      ctx.quadraticCurveTo(0, -27.8, 6.0, -30.2);
      ctx.quadraticCurveTo(12.0, -34.0, 11.8, -42.2);
      ctx.arc(0, -42.0, 11.8, 0, Math.PI, true);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();

    // High-Resolution Expressive Anime Eyes (3-Stop Iris, Lashes, Dual Glints, Eyebrows, Nose & Smile!)
    if (dir !== 3) {
      const eyeOffX = dir === 1 ? -4.5 : dir === 2 ? 4.5 : 0;
      const eyeSpan = dir === 0 ? 4.9 : 2.9;
      const sides = dir === 0 ? [-1, 1] : [dir === 1 ? -1 : 1];
      const eh = isChild ? 3.5 : 3.25;
      for (const side of sides) {
        const ex = eyeOffX + side * eyeSpan;
        const ey = -38.8;
        const ew = dir === 0 ? 2.65 : 2.25;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(ex, ey, ew, eh, 0, 0, Math.PI * 2);
        ctx.fill();
        const irisG = ctx.createLinearGradient(ex, ey - 2.2, ex, ey + 2.6);
        irisG.addColorStop(0, '#0f172a');
        irisG.addColorStop(0.45, cfg.eyeColor);
        irisG.addColorStop(1, '#e0f2fe');
        ctx.fillStyle = irisG;
        ctx.beginPath();
        ctx.ellipse(ex, ey + 0.3, ew * 0.78, eh * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.ellipse(ex, ey + 0.4, ew * 0.42, eh * 0.44, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#120d1a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(ex, ey - 0.15, ew + 0.15, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex - ew * 0.34, ey - 1.15, 0.98, 0, Math.PI * 2);
        ctx.arc(ex + ew * 0.3, ey + 1.25, 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = cfg.hairShadow;
        ctx.lineWidth = 1.15;
        ctx.beginPath();
        ctx.moveTo(ex - 2.2, ey - 4.3);
        ctx.quadraticCurveTo(ex, ey - 4.9, ex + 2.2, ey - 4.2);
        ctx.stroke();
      }

      // Rosy Cheek Blush & Nose Bridge
      ctx.fillStyle = isChild ? 'rgba(244, 114, 182, 0.42)' : 'rgba(244, 114, 182, 0.25)';
      if (dir === 0) {
        ctx.beginPath();
        ctx.ellipse(-7.4, -35.3, 2.2, 1.1, 0, 0, Math.PI * 2);
        ctx.ellipse(7.4, -35.3, 2.2, 1.1, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#c4815a';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(0.2, -37.0);
        ctx.lineTo(-0.3, -35.4);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.ellipse(eyeOffX + (dir === 1 ? -2.2 : 2.2), -35.3, 2.0, 1.05, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      if (cfg.hasBeard) {
        ctx.fillStyle = '#f1f5f9';
        ctx.strokeStyle = outline;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(eyeOffX - 6.5, -34.8);
        ctx.quadraticCurveTo(eyeOffX, -25.2, eyeOffX + 6.5, -34.8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.strokeStyle = '#9a5844';
        ctx.lineWidth = 1.08;
        ctx.beginPath();
        const mx = dir === 1 ? -6.8 : dir === 2 ? 6.8 : 0;
        ctx.arc(mx, -33.8, isChild ? 2.3 : 2.0, 0.14 * Math.PI, 0.86 * Math.PI);
        ctx.stroke();
      }
    }

    // Multi-Layered Textured Anime Hair Crown, Swept Bangs, Strand Lines & Glossy Specular Arc!
    const hairGrad = ctx.createLinearGradient(0, -58, 0, -34);
    hairGrad.addColorStop(0, cfg.hairHi);
    hairGrad.addColorStop(0.35, cfg.hairColor);
    hairGrad.addColorStop(1, cfg.hairShadow);
    ctx.fillStyle = hairGrad;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (dir === 3) {
      ctx.arc(0, -42.5, 13.8, 0, Math.PI * 2);
    } else {
      ctx.arc(0, -43.5, 13.8, Math.PI * 0.92, Math.PI * 0.08);
      ctx.lineTo(13.6, -34.8);
      ctx.lineTo(9.4, -42.4);
      ctx.lineTo(6.2, -36.2);
      ctx.lineTo(2.4, -42.8);
      ctx.lineTo(-1.2, -35.8);
      ctx.lineTo(-5.5, -42.6);
      ctx.lineTo(-9.2, -36.2);
      ctx.lineTo(-13.6, -34.8);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();

    if (cfg.isLongHair && dir === 3) {
      ctx.fillStyle = hairGrad;
      ctx.beginPath();
      ctx.roundRect(-13.2, -42, 26.4, 28, 8);
      ctx.fill();
      ctx.stroke();
    }

    // Bespoke Role & Child Headgear (Ribbons, Chef Toque, Smith Bandana, Herbalist Wreath!)
    if (cfg.costume === 'maiden' || isChild) {
      ctx.fillStyle = isChild ? '#38bdf8' : '#f43f5e';
      ctx.strokeStyle = outline;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.ellipse(-5.8, -54.2, 4.0, 2.3, -0.35, 0, Math.PI * 2);
      ctx.ellipse(5.8, -54.2, 4.0, 2.3, 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(0, -54.2, 2.1, 0, Math.PI * 2);
      ctx.fill();
    } else if (cfg.costume === 'baker') {
      // Puffy Pleated White Master Baker Toque Hat!
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = outline;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.roundRect(-10.5, -56, 21, 6, 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-6, -59, 6.2, 0, Math.PI * 2);
      ctx.arc(0, -61.5, 7.2, 0, Math.PI * 2);
      ctx.arc(6, -59, 6.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (cfg.costume === 'smith' || cfg.costume === 'craft') {
      ctx.fillStyle = cfg.costume === 'smith' ? '#b91c1c' : '#d97706';
      ctx.strokeStyle = outline;
      ctx.lineWidth = 1.1;
      ctx.fillRect(-13, -48.5, 26, 3.6);
      ctx.strokeRect(-13, -48.5, 26, 3.6);
    } else if (cfg.costume === 'herbalist') {
      ctx.fillStyle = '#22c55e';
      ctx.strokeStyle = outline;
      ctx.lineWidth = 1;
      for (const lx of [-7, 0, 7]) {
        ctx.beginPath();
        ctx.ellipse(lx, -51.5, 3.4, 1.8, lx * 0.05, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    ctx.strokeStyle = cfg.hairHi;
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    ctx.arc(0, -45.5, 9.0, Math.PI * 1.16, Math.PI * 1.84);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.48)';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.arc(-2, -46.5, 6.0, Math.PI * 1.24, Math.PI * 1.62);
    ctx.stroke();
  }

  ctx.restore();
}

export function buildRpgJsHeroSpriteSheet(
  weaponTier: number,
  armorTier: number,
  maxAniso: number
): THREE.CanvasTexture {
  const cellW = 256;
  const cellH = 320; // Tall adult 1024x1280 ultra-HD hero sprite sheet!
  const canvas = document.createElement('canvas');
  canvas.width = cellW * 4;
  canvas.height = cellH * 4;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const armorTints = ['#94a3b8', '#cbd5e1', '#7dd3fc', '#f1f5f9', '#fef08a'];
  const armorDarks = ['#475569', '#64748b', '#0284c7', '#94a3b8', '#ca8a04'];
  const weaponTints = ['#e2e8f0', '#f1f5f9', '#bae6fd', '#e0f2fe', '#fb923c'];
  const aIdx = Math.min(4, armorTier);

  const cfg: HumanoidSpriteConfig = {
    hairColor: '#dc2626',
    hairHi: '#fca5a5',
    hairShadow: '#7f1d1d',
    eyeColor: '#b45309',
    tunicColor: armorTints[aIdx],
    tunicDark: armorDarks[aIdx],
    cloakColor: '#dc2626',
    trimColor: '#facc15',
    costume: 'hero',
    ageGroup: 'adult',
    weaponColor: weaponTints[Math.min(4, weaponTier)],
    shieldColor: armorTints[aIdx],
  };

  for (let dir = 0; dir < 4; dir++) {
    for (let frame = 0; frame < 4; frame++) {
      drawHumanoidFrame(ctx, frame * cellW, dir * cellH, dir as 0 | 1 | 2 | 3, frame as 0 | 1 | 2 | 3, cfg, cellW, cellH);
    }
  }
  return configureSpriteTexture(canvas, maxAniso, false);
}

export function resolveNpcAgeGroup(npc: WorldNpc): 'adult' | 'child' | 'elder' {
  if (npc.ageGroup) return npc.ageGroup;
  const n = npc.name.toLowerCase();
  if (npc.task === 'play' || n.includes('kid') || n.includes('child') || n.includes('helper') || n.includes('chaser')) {
    return 'child';
  }
  if (npc.portrait === 'elder' || n.includes('elder')) return 'elder';
  return 'adult';
}

export function buildRpgJsNpcSpriteSheet(npc: WorldNpc, maxAniso: number): THREE.CanvasTexture {
  const ageGroup = resolveNpcAgeGroup(npc);
  const cellW = 256;
  const cellH = ageGroup === 'child' ? 256 : 320; // Full 256px HD resolution for EVERY adult & child!
  const canvas = document.createElement('canvas');
  canvas.width = cellW * 4;
  canvas.height = cellH * 4;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const nameLower = `${npc.name} ${npc.role}`.toLowerCase();
  const isLongHair =
    npc.portrait === 'feena' ||
    npc.portrait === 'lilia' ||
    npc.portrait === 'sara' ||
    nameLower.includes('lilia') ||
    nameLower.includes('sara') ||
    nameLower.includes('feena') ||
    nameLower.includes('mina') ||
    nameLower.includes('ella') ||
    nameLower.includes('lina');

  let costume: NpcCostumeVariant = 'villager';
  if (npc.portrait === 'sara' || nameLower.includes('fortune')) costume = 'fortune';
  else if (npc.role === 'bakery' || npc.task === 'baker' || nameLower.includes('baker') || nameLower.includes('pastry'))
    costume = 'baker';
  else if (npc.task === 'craft' || nameLower.includes('foreman') || nameLower.includes('millwright') || nameLower.includes('craft'))
    costume = 'craft';
  else if (
    npc.task === 'hammer' ||
    nameLower.includes('weapon') ||
    nameLower.includes('smith') ||
    nameLower.includes('forge') ||
    nameLower.includes('pim')
  )
    costume = 'smith';
  else if (npc.task === 'patrol' || nameLower.includes('armor') || nameLower.includes('guard') || nameLower.includes('watch'))
    costume = 'armorer';
  else if (npc.task === 'serve' || nameLower.includes('inn') || nameLower.includes('tavern') || nameLower.includes('barkeep') || nameLower.includes('maid'))
    costume = 'innkeep';
  else if (npc.task === 'garden' || nameLower.includes('herb') || nameLower.includes('clinic') || nameLower.includes('flair') || nameLower.includes('doctor'))
    costume = 'herbalist';
  else if (npc.portrait === 'lilia' || npc.portrait === 'feena') costume = 'maiden';
  else if (
    npc.task === 'read' ||
    npc.portrait === 'elder' ||
    nameLower.includes('elder') ||
    nameLower.includes('librar') ||
    nameLower.includes('scholar')
  )
    costume = 'elder';

  const eyePalette: Record<NpcCostumeVariant, string> = {
    hero: '#b45309',
    fortune: '#7e22ce',
    smith: '#334155',
    armorer: '#1d4ed8',
    maiden: '#2563eb',
    elder: '#0f766e',
    innkeep: '#9a3412',
    herbalist: '#15803d',
    baker: '#b45309',
    craft: '#475569',
    villager: '#1e3a8a',
  };

  const cfg: HumanoidSpriteConfig = {
    hairColor: npc.hairColor,
    hairHi: 'rgba(255, 255, 255, 0.58)',
    hairShadow: '#1e1b2e',
    eyeColor: eyePalette[costume],
    tunicColor: npc.tunicColor,
    tunicDark: '#1e293b',
    cloakColor: npc.cloakColor,
    trimColor: '#fde047',
    costume,
    ageGroup,
    isLongHair,
    hasBeard: npc.portrait === 'elder' && !nameLower.includes('jeva') && !nameLower.includes('bera'),
  };

  for (let dir = 0; dir < 4; dir++) {
    for (let frame = 0; frame < 4; frame++) {
      drawHumanoidFrame(ctx, frame * cellW, dir * cellH, dir as 0 | 1 | 2 | 3, frame as 0 | 1 | 2 | 3, cfg, cellW, cellH);
    }
  }
  return configureSpriteTexture(canvas, maxAniso, false);
}

// ============================================================================
// 4. HD-2D 256px 4-FRAME ANIMATED MONSTER & BOSS SPRITESHEET (Short vs. Tall!)
// ============================================================================
export function buildRpgJsEnemySpriteSheet(
  kind: 'slime' | 'goblin' | 'knight' | 'mage' | 'wyvern' | 'boss',
  color: string,
  accent: string,
  maxAniso: number
): THREE.CanvasTexture {
  const cell = 256;
  const frames = 4;
  const canvas = document.createElement('canvas');
  canvas.width = cell * frames; // 1024x256 ultra-crisp 4-frame enemy sprite sheet!
  canvas.height = cell;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const outline = '#120d1a';

  for (let f = 0; f < frames; f++) {
    const phase = (f / frames) * Math.PI * 2;
    const bounce = Math.sin(phase) * 3.0;
    const stride = Math.cos(phase);

    ctx.save();
    ctx.translate(f * cell + cell * 0.5, cell * 0.91);
    const sc = 3.2; // Crisp 64x64 logical space scaled cleanly into 256x256!
    ctx.scale(sc, sc);

    // Soft contact ground shadow
    ctx.fillStyle = 'rgba(8, 12, 24, 0.36)';
    ctx.beginPath();
    ctx.ellipse(0, 1.5, kind === 'boss' ? 22 : kind === 'slime' ? 18 : 15, 4.6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.65;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (kind === 'slime') {
      // Short Translucent Gelatinous Slime with Internal Bubbles, Nucleus & Glossy Crescent!
      const sqX = 1.0 + Math.sin(phase) * 0.1;
      const sqY = 1.0 - Math.sin(phase) * 0.11;
      ctx.scale(sqX, sqY);
      const g = ctx.createRadialGradient(-5, -20, 2, 0, -14, 21);
      g.addColorStop(0, '#ecfccb');
      g.addColorStop(0.42, color);
      g.addColorStop(1, '#14532d');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-18, 0);
      ctx.bezierCurveTo(-22, -18, -11, -29, 0, -29);
      ctx.bezierCurveTo(11, -29, 22, -18, 18, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Inner glowing mana nucleus & drifting jelly bubbles
      ctx.fillStyle = 'rgba(254, 240, 138, 0.38)';
      ctx.beginPath();
      ctx.arc(2, -12, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.arc(-8, -9 + Math.sin(phase) * 1.2, 2.2, 0, Math.PI * 2);
      ctx.arc(9, -15 - Math.sin(phase) * 1.2, 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Glossy top crescent highlight
      ctx.fillStyle = 'rgba(255,255,255,0.74)';
      ctx.beginPath();
      ctx.ellipse(-6.5, -20, 5.2, 2.6, -0.45, 0, Math.PI * 2);
      ctx.fill();

      // Expressive fierce-cute eyes & cheeky grin
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.ellipse(-5.5, -12.5, 2.4, 2.8, 0, 0, Math.PI * 2);
      ctx.ellipse(5.5, -12.5, 2.4, 2.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-6.3, -13.6, 1.0, 0, Math.PI * 2);
      ctx.arc(4.7, -13.6, 1.0, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'goblin') {
      // Short Hunched Goblin Raider with Pointed Ears, Leather Helm, Cleaver & Buckler!
      ctx.translate(0, -Math.abs(bounce) * 0.6);
      // Stalking crouched legs
      ctx.fillStyle = '#3f6212';
      ctx.beginPath();
      ctx.roundRect(-9, -11 + stride * 2.2, 6, 11, 2);
      ctx.roundRect(3, -11 - stride * 2.2, 6, 11, 2);
      ctx.fill();
      ctx.stroke();

      // Rugged leather tunic
      const tunG = ctx.createLinearGradient(0, -30, 0, -9);
      tunG.addColorStop(0, color);
      tunG.addColorStop(1, '#365314');
      ctx.fillStyle = tunG;
      ctx.beginPath();
      ctx.roundRect(-11, -30, 22, 20, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-11, -17, 22, 4);

      // Pointed Goblin Ears & Snarling Head
      ctx.fillStyle = '#65a30d';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * 9, -39);
        ctx.lineTo(s * 18, -43);
        ctx.lineTo(s * 10, -34);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, -38, 10.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Spiked Iron Cap
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(0, -40, 10.8, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Fierce glowing amber eyes & white fangs
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.ellipse(-4, -37.5, 2.3, 1.8, 0.25, 0, Math.PI * 2);
      ctx.ellipse(4, -37.5, 2.3, 1.8, -0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-4, -32);
      ctx.lineTo(-2.5, -34.5);
      ctx.lineTo(-1, -32);
      ctx.moveTo(1, -32);
      ctx.lineTo(2.5, -34.5);
      ctx.lineTo(4, -32);
      ctx.fill();

      // Round wooden buckler & jagged cleaver
      ctx.fillStyle = '#92400e';
      ctx.beginPath();
      ctx.arc(-14, -22, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.arc(-14, -22, 2.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(14, -24);
      ctx.rotate(0.25 + stride * 0.22);
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(-2, 4);
      ctx.lineTo(-3, -15);
      ctx.lineTo(4, -18);
      ctx.lineTo(4, -6);
      ctx.lineTo(2, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else if (kind === 'wyvern') {
      // Tall Majestic Winged Wyvern with Ribbed Sweeping Wings & Armored Scales!
      ctx.translate(0, -14 + bounce * 1.4);
      const wingLift = Math.sin(phase) * 14;
      for (const side of [-1, 1]) {
        const wGrad = ctx.createLinearGradient(0, -28, side * 30, -6);
        wGrad.addColorStop(0, accent);
        wGrad.addColorStop(1, color);
        ctx.fillStyle = wGrad;
        ctx.beginPath();
        ctx.moveTo(side * 6, -18);
        ctx.quadraticCurveTo(side * 18, -32 + wingLift, side * 30, -26 + wingLift);
        ctx.lineTo(side * 24, -6 + wingLift * 0.6);
        ctx.lineTo(side * 16, -12 + wingLift * 0.4);
        ctx.lineTo(side * 8, -8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      // Scaled wyvern torso & serpentine tail
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, -16, 11, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fef3c7';
      for (let sy = -24; sy <= -6; sy += 5) {
        ctx.beginPath();
        ctx.ellipse(0, sy, 6.2, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // Horned dragon head & fiery eyes
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, -35, 9.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fde047';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * 6, -42);
        ctx.lineTo(s * 14, -52);
        ctx.lineTo(s * 3, -44);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(-5, -37, 3, 2.6);
      ctx.fillRect(2, -37, 3, 2.6);
    } else if (kind === 'mage') {
      // Tall Floating Archmage in Layered Velvet Robes + Orbiting Arcane Crystal Staff!
      ctx.translate(0, -4 + bounce * 1.1);
      const robeG = ctx.createLinearGradient(0, -42, 0, -2);
      robeG.addColorStop(0, color);
      robeG.addColorStop(1, '#0f172a');
      ctx.fillStyle = robeG;
      ctx.beginPath();
      ctx.moveTo(-15, -2);
      ctx.lineTo(-10, -40);
      ctx.lineTo(10, -40);
      ctx.lineTo(15, -2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Embroidered gold rune stole
      ctx.fillStyle = accent;
      ctx.fillRect(-3.5, -39, 7, 35);
      // Tall pointed arcane hood & shadow cowl
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-13, -38);
      ctx.quadraticCurveTo(0, -64, 13, -38);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#090d1a';
      ctx.beginPath();
      ctx.ellipse(0, -44, 7.2, 8.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fde047';
      ctx.fillRect(-4.5, -45, 2.8, 2.6);
      ctx.fillRect(1.8, -45, 2.8, 2.6);
      // Floating glowing staff
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(16, -2);
      ctx.lineTo(16, -48);
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.strokeStyle = outline;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(16, -52 + Math.sin(phase) * 1.5, 5.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      // Tall Armored Dark Knight OR Towering Demon Boss!
      const isBoss = kind === 'boss';
      ctx.translate(0, -Math.abs(bounce) * 0.55);
      // Sweeping Battle Cloak
      ctx.fillStyle = isBoss ? '#7f1d1d' : '#1e293b';
      ctx.beginPath();
      ctx.moveTo(-16, -42);
      ctx.lineTo(16, -42);
      ctx.lineTo(22 + stride * 1.6, -3);
      ctx.lineTo(-22 + stride * 1.6, -3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Tall Armored Plate Greaves
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.roundRect(-10, -16 + stride * 2.5, 7.5, 16, 2.5);
      ctx.roundRect(2.5, -16 - stride * 2.5, 7.5, 16, 2.5);
      ctx.fill();
      ctx.stroke();

      // Sculpted Plate Cuirass with Specular Steel Gradient & Riveted Pauldrons!
      const plateG = ctx.createLinearGradient(-12, -44, 12, -16);
      plateG.addColorStop(0, '#f8fafc');
      plateG.addColorStop(0.32, color);
      plateG.addColorStop(1, '#1e293b');
      ctx.fillStyle = plateG;
      ctx.beginPath();
      ctx.roundRect(-13.5, -44, 27, 29, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = accent;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(s * 15, -39, 7.2, 6.2, s * 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Tall Crested Horned Greathelm + Glowing Visor
      ctx.fillStyle = plateG;
      ctx.beginPath();
      ctx.arc(0, -52, 10.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = accent;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * 8, -56);
        ctx.lineTo(side * (isBoss ? 20 : 16), isBoss ? -70 : -66);
        ctx.lineTo(side * 4, -60);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = '#090d1a';
      ctx.fillRect(-7, -54, 14, 4.2);
      ctx.fillStyle = isBoss ? '#fb7185' : '#fde047';
      ctx.fillRect(-5, -53, 3.6, 2.6);
      ctx.fillRect(1.5, -53, 3.6, 2.6);

      // Gleaming Greatsword / Blazing Runeblade
      ctx.save();
      ctx.translate(17, -30);
      ctx.rotate(0.18 + stride * 0.18);
      ctx.fillStyle = isBoss ? '#fb7185' : '#e0f2fe';
      ctx.beginPath();
      ctx.moveTo(-3.2, 7);
      ctx.lineTo(-3.4, -28);
      ctx.lineTo(0, -36);
      ctx.lineTo(3.4, -28);
      ctx.lineTo(3.2, 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#eab308';
      ctx.fillRect(-7, 2, 14, 3.4);
      ctx.restore();
    }

    ctx.restore();
  }

  return configureSpriteTexture(canvas, maxAniso, true);
}

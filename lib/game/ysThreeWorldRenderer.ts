import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { WorldNpc, ZoneDef } from './ysWorldBuilder';
import {
  buildRpgJsEnemySpriteSheet,
  buildRpgJsHeroSpriteSheet,
  buildRpgJsNpcSpriteSheet,
  buildRpgJsZoneTerrainTexture,
  createRpgJsArchTextures,
  type RpgJsArchTextures,
} from './rpgJsSpriteAtlas';

// ============================================================================
// REAL 3D THREE.JS WEBGL + RPG-JS (PIPOYA HD-2D) EVO WORLD ENGINE
// - Seamless 8-neighbor Autotiled Pipoya/RPG-JS 3D Height-Contoured Terrain
// - 4-Direction Animated HD-2D Sprite Actors with Pixel-Accurate 3D Shadows
// - Illustrated Half-Timbered Cottages, Scalloped Roofs & Terraced Cliffs
// - GPU Wind/Push Foliage, GPU Gerstner Water, GPU Cloth & Ballistic Sparks
// ============================================================================
// - GPU cloth pennant wave physics + 650+ GPU atmospheric weather/pollen particles
// - GPU ballistic combat spark particle physics with gravity & ground bounce
// - Rich 3-14 part composite 3D characters, monsters, bosses, cottages, market
//   stalls, merchant wagons, street lanterns, heraldic banners, fountains & ruins!
// ============================================================================

export const YS_WORLD_TILE = 44;

export interface YsThreeEnemyView {
  id: number;
  x: number;
  y: number;
  angle: number;
  kind: 'slime' | 'goblin' | 'knight' | 'mage' | 'wyvern' | 'boss';
  hp: number;
  maxHp: number;
  hitFlash: number;
  color: string;
  accent: string;
}

export interface YsThreeProjectileView {
  x: number;
  y: number;
  color: string;
  radius: number;
  fromPlayer: boolean;
}

export interface YsThreeArmorGibView {
  x: number;
  y: number;
  z: number;
  rot: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface YsThreeCombatBoltView {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  life: number;
  maxLife: number;
}

export type YsCameraZoomMode = 'evo45' | 'wide45' | 'fullmap45';

export interface YsThreeRenderState {
  zone: ZoneDef;
  time: number;
  camX: number;
  camY: number;
  screenShake: number;
  cameraYaw?: number;
  cameraZoomMode?: YsCameraZoomMode;
  px: number;
  py: number;
  bodyAngle: number;
  moveSpeedFrac: number;
  walkAnim: number;
  lungeTimer: number;
  slashArcTimer: number;
  invulnTimer: number;
  autoHealPulse: number;
  shieldAuraTimer: number;
  weaponTier: number;
  armorTier: number;
  shieldTier: number;
  openedChests: Set<string>;
  flags: Set<string>;
  npcAngles: Map<string, number>;
  enemies: YsThreeEnemyView[];
  projectiles: YsThreeProjectileView[];
  armorGibs: YsThreeArmorGibView[];
  combatBolts: YsThreeCombatBoltView[];
}

interface SharedShaderUniforms {
  uTime: { value: number };
  uPlayerPos: { value: THREE.Vector3 };
}

interface AdolRig {
  root: THREE.Group;
  body: THREE.Group;
  spriteMesh: THREE.Mesh;
  spriteMat: THREE.MeshStandardMaterial;
  depthMat: THREE.MeshDepthMaterial;
  spriteTex: THREE.CanvasTexture;
  weaponTier: number;
  armorTier: number;
  slashArc: THREE.Mesh;
  healRing: THREE.Mesh;
  shieldDome: THREE.Mesh;
}

interface EnemyRig {
  root: THREE.Group;
  body: THREE.Group;
  kind: YsThreeEnemyView['kind'];
  spriteMesh: THREE.Mesh;
  spriteMat: THREE.MeshStandardMaterial;
  spriteTex: THREE.CanvasTexture;
  bossCircle?: THREE.Mesh;
}

interface FloatingBoatRig {
  group: THREE.Group;
  baseY: number;
  phase: number;
}

interface WildlifeRig {
  group: THREE.Group;
  wingL: THREE.Mesh;
  wingR: THREE.Mesh;
  anchorX: number;
  anchorZ: number;
  radius: number;
  speed: number;
  phase: number;
}

interface NpcRig {
  root: THREE.Group;
  body: THREE.Group;
  spriteMesh: THREE.Mesh;
  spriteTex: THREE.CanvasTexture;
  baseY: number;
}

interface ChestRig {
  id: string;
  lidPivot: THREE.Group;
  glowLight: THREE.Mesh;
}

interface ShrubRig {
  id: string;
  group: THREE.Group;
  sparkle: THREE.Mesh;
  tx: number;
  ty: number;
}

interface PortalRig {
  ring: THREE.Mesh;
  pillarGlows: THREE.Mesh[];
  requiredFlag?: string;
}

interface FallingLeafItem {
  ox: number;
  oy: number;
  oz: number;
  groundY: number;
  speed: number;
  driftAmp: number;
  freq: number;
  phase: number;
  spinSpeed: number;
  scale: number;
}

interface ChimneySmokeItem {
  mesh: THREE.Mesh;
  ox: number;
  oy: number;
  oz: number;
  phase: number;
  speed: number;
}

interface SpinnerRig {
  obj: THREE.Object3D;
  axis: 'x' | 'y' | 'z';
  speed: number;
}

function smoothstep01(v: number): number {
  const t = Math.max(0, Math.min(1, v));
  return t * t * (3 - 2 * t);
}

// Zero-GC reusable math helpers
const _dummy = new THREE.Object3D();
const _vec3 = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _color = new THREE.Color();

function angleToRpgJsDir(angle: number): 0 | 1 | 2 | 3 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  if (Math.abs(cos) > Math.abs(sin)) {
    return cos >= 0 ? 2 : 1; // 2=right, 1=left
  }
  return sin >= 0 ? 0 : 3; // 0=down, 3=up
}

function detectSoftwareGl(): boolean {
  if (typeof document === 'undefined') return true;
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function hash2d(x: number, y: number, seed = 1): number {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

// ----------------------------------------------------------------------------
// Procedural High-Detail Modern-Evo PBR & Botanical Alpha-Cutout Textures
// ----------------------------------------------------------------------------
function createBotanicalAlphaTexture(
  kind: 'leaf_broad' | 'leaf_cypress' | 'leaf_shrub',
  maxAnisotropy: number
): THREE.CanvasTexture {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  if (kind === 'leaf_broad') {
    // Handcrafted dense oak/broadleaf botanical bough with twigs + 90 shaded leaves
    ctx.strokeStyle = '#3b2412';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(size * 0.5, size * 0.94);
    ctx.quadraticCurveTo(size * 0.48, size * 0.55, size * 0.52, size * 0.18);
    ctx.moveTo(size * 0.5, size * 0.65);
    ctx.lineTo(size * 0.22, size * 0.42);
    ctx.moveTo(size * 0.5, size * 0.58);
    ctx.lineTo(size * 0.78, size * 0.38);
    ctx.stroke();

    for (let i = 0; i < 115; i++) {
      const ang = hash2d(i, 1, 901) * Math.PI * 2;
      const dist = Math.sqrt(hash2d(i, 2, 901)) * 92;
      const lx = size * 0.5 + Math.cos(ang) * dist;
      const ly = size * 0.49 + Math.sin(ang) * dist * 0.88;
      const rot = ang + (hash2d(i, 3, 901) - 0.5) * 1.1;
      const len = 13 + hash2d(i, 4, 901) * 14;
      const wid = len * (0.45 + hash2d(i, 5, 901) * 0.22);
      const shade = 0.48 + (1 - ly / size) * 0.42 + hash2d(i, 6, 901) * 0.16;
      const r = Math.min(255, Math.round(168 * shade));
      const g = Math.min(255, Math.round(224 * shade));
      const b = Math.min(255, Math.round(135 * shade));

      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(rot);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.beginPath();
      ctx.moveTo(-len * 0.5, 0);
      ctx.quadraticCurveTo(0, -wid, len * 0.55, 0);
      ctx.quadraticCurveTo(0, wid, -len * 0.5, 0);
      ctx.fill();
      ctx.strokeStyle = 'rgba(18, 36, 14, 0.34)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // Leaf midrib highlight
      ctx.strokeStyle = 'rgba(255, 255, 225, 0.28)';
      ctx.beginPath();
      ctx.moveTo(-len * 0.35, 0);
      ctx.lineTo(len * 0.38, 0);
      ctx.stroke();
      ctx.restore();
    }
  } else if (kind === 'leaf_cypress') {
    // Tall feathery Mediterranean cypress / conifer spire silhouette (Screenshot 1!)
    ctx.strokeStyle = '#3d2817';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(size * 0.5, size * 0.98);
    ctx.lineTo(size * 0.5, size * 0.08);
    ctx.stroke();

    for (let i = 0; i < 240; i++) {
      const t = hash2d(i, 1, 911); // 0 = top tip, 1 = bottom base
      const y = 14 + t * (size - 24);
      const halfSpan = Math.sin(Math.pow(t, 0.72) * Math.PI * 0.88) * 56 + 4;
      const side = (hash2d(i, 2, 911) - 0.5) * 2;
      const x = size * 0.5 + side * halfSpan;
      const len = 10 + (1 - Math.abs(side) * 0.3) * 13 * (0.4 + t * 0.6);
      const wid = len * 0.38;
      const tilt = -Math.PI * 0.5 + side * (0.35 + hash2d(i, 3, 911) * 0.45);
      const shade = 0.42 + (1 - t) * 0.36 + (side < 0 ? 0.16 : 0.0) + hash2d(i, 4, 911) * 0.14;
      const r = Math.min(255, Math.round(182 * shade));
      const g = Math.min(255, Math.round(230 * shade));
      const b = Math.min(255, Math.round(145 * shade));

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(tilt);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.beginPath();
      ctx.moveTo(-len * 0.4, 0);
      ctx.quadraticCurveTo(0, -wid, len * 0.6, 0);
      ctx.quadraticCurveTo(0, wid, -len * 0.4, 0);
      ctx.fill();
      ctx.strokeStyle = 'rgba(12, 28, 12, 0.3)';
      ctx.lineWidth = 0.9;
      ctx.stroke();
      ctx.restore();
    }
  } else {
    // Lush multi-stemmed woodland bush sprig with crisp individual leaves (Screenshots 1 & 2!)
    ctx.strokeStyle = '#422814';
    ctx.lineWidth = 3.2;
    for (let s = 0; s < 5; s++) {
      const a = -Math.PI * 0.5 + (s - 2) * 0.38;
      ctx.beginPath();
      ctx.moveTo(size * 0.5, size * 0.95);
      ctx.quadraticCurveTo(
        size * 0.5 + Math.cos(a) * 55,
        size * 0.62,
        size * 0.5 + Math.cos(a) * 95,
        size * 0.25 + Math.abs(s - 2) * 16
      );
      ctx.stroke();
    }

    for (let i = 0; i < 125; i++) {
      const ang = -Math.PI * 0.92 + hash2d(i, 1, 929) * Math.PI * 0.84;
      const dist = 16 + Math.sqrt(hash2d(i, 2, 929)) * 96;
      const lx = size * 0.5 + Math.cos(ang) * dist;
      const ly = size * 0.86 + Math.sin(ang) * dist * 0.86;
      if (ly < 16 || ly > size - 8 || lx < 12 || lx > size - 12) continue;
      const len = 13 + hash2d(i, 3, 929) * 14;
      const wid = len * 0.46;
      const shade = 0.45 + (1 - ly / size) * 0.45 + hash2d(i, 4, 929) * 0.16;
      const r = Math.min(255, Math.round(170 * shade));
      const g = Math.min(255, Math.round(230 * shade));
      const b = Math.min(255, Math.round(140 * shade));

      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(ang + (hash2d(i, 5, 929) - 0.5) * 0.8);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.beginPath();
      ctx.moveTo(-len * 0.45, 0);
      ctx.quadraticCurveTo(0, -wid, len * 0.55, 0);
      ctx.quadraticCurveTo(0, wid, -len * 0.45, 0);
      ctx.fill();
      ctx.strokeStyle = 'rgba(14, 30, 12, 0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  return tex;
}

function createProceduralTexture(
  kind:
    | 'meadow'
    | 'plains'
    | 'cobble'
    | 'carpet'
    | 'mine'
    | 'tower'
    | 'ice'
    | 'village'
    | 'plaster'
    | 'roof_red'
    | 'roof_blue'
    | 'roof_emerald'
    | 'roof_terracotta'
    | 'cliff'
    | 'bark'
    | 'wood',
  maxAnisotropy: number
): THREE.CanvasTexture {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;

  if (kind === 'meadow' || kind === 'village') {
    ctx.fillStyle = kind === 'village' ? '#3f8f4e' : '#4a8c3c';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 420; i++) {
      const x = Math.floor(hash2d(i, 1, 11) * size);
      const y = Math.floor(hash2d(i, 2, 11) * size);
      const r = hash2d(i, 3, 11);
      ctx.fillStyle =
        r < 0.35
          ? kind === 'village'
            ? '#2f723c'
            : '#376f2c'
          : r < 0.72
            ? kind === 'village'
              ? '#58ad63'
              : '#65ad49'
            : '#86cc65';
      ctx.fillRect(x, y, 3, 5);
    }
    for (let i = 0; i < 24; i++) {
      const fx = Math.floor(hash2d(i, 7, 19) * size);
      const fy = Math.floor(hash2d(i, 8, 19) * size);
      ctx.fillStyle = i % 3 === 0 ? '#fef08a' : i % 3 === 1 ? '#f9a8d4' : '#ffffff';
      ctx.fillRect(fx, fy, 3, 3);
    }
  } else if (kind === 'plains') {
    ctx.fillStyle = '#8b815b';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 500; i++) {
      const x = Math.floor(hash2d(i, 1, 23) * size);
      const y = Math.floor(hash2d(i, 2, 23) * size);
      const r = hash2d(i, 3, 23);
      ctx.fillStyle = r < 0.3 ? '#6d6445' : r < 0.65 ? '#9f956c' : '#51873a';
      ctx.fillRect(x, y, 4, 4);
    }
    ctx.strokeStyle = 'rgba(65, 56, 36, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(14, 22);
    ctx.lineTo(44, 48);
    ctx.lineTo(78, 38);
    ctx.moveTo(60, 88);
    ctx.lineTo(104, 112);
    ctx.stroke();
  } else if (kind === 'cobble') {
    ctx.fillStyle = '#8d7b60';
    ctx.fillRect(0, 0, size, size);
    for (let row = 0; row < 8; row++) {
      const off = (row % 2) * 16;
      for (let col = -1; col < 5; col++) {
        const sx = col * 32 + off;
        const sy = row * 16;
        const n = hash2d(col + 10, row, 31);
        ctx.fillStyle = n < 0.33 ? '#bda786' : n < 0.66 ? '#ceb898' : '#b29b79';
        ctx.fillRect(sx + 2, sy + 2, 28, 12);
        ctx.fillStyle = 'rgba(255, 248, 230, 0.28)';
        ctx.fillRect(sx + 2, sy + 2, 28, 3);
        ctx.fillStyle = 'rgba(58, 45, 28, 0.32)';
        ctx.fillRect(sx + 2, sy + 12, 28, 2);
      }
    }
  } else if (kind === 'carpet') {
    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(8, 0, size - 16, size);
    ctx.fillStyle = '#eab308';
    ctx.fillRect(10, 0, 4, size);
    ctx.fillRect(size - 14, 0, 4, size);
    ctx.fillStyle = 'rgba(254, 240, 138, 0.25)';
    for (let y = 8; y < size; y += 24) {
      ctx.fillRect(size * 0.5 - 8, y, 16, 8);
    }
  } else if (kind === 'mine' || kind === 'tower') {
    ctx.fillStyle = kind === 'tower' ? '#2c1828' : '#3a342c';
    ctx.fillRect(0, 0, size, size);
    for (let row = 0; row < 4; row++) {
      const off = (row % 2) * 32;
      for (let col = -1; col < 3; col++) {
        const sx = col * 64 + off;
        const sy = row * 32;
        const n = hash2d(col + 5, row, 47);
        ctx.fillStyle =
          kind === 'tower'
            ? n < 0.5
              ? '#3f2238'
              : '#4f2b45'
            : n < 0.5
              ? '#52493d'
              : '#615648';
        ctx.fillRect(sx + 2, sy + 2, 60, 28);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(sx + 2, sy + 2, 60, 3);
      }
    }
  } else if (kind === 'ice') {
    const g = ctx.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, '#bae6fd');
    g.addColorStop(0.5, '#7dd3fc');
    g.addColorStop(1, '#38bdf8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      const x = hash2d(i, 1, 61) * size;
      const y = hash2d(i, 2, 61) * size;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 24, y - 14);
      ctx.stroke();
    }
  } else if (kind === 'plaster') {
    ctx.fillStyle = '#efe0c4';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(180, 150, 110, 0.16)' : 'rgba(255, 250, 240, 0.18)';
      ctx.fillRect(hash2d(i, 1, 71) * size, hash2d(i, 2, 71) * size, 6, 4);
    }
    // Half-timber oak crossbeams
    ctx.fillStyle = '#5c2e12';
    ctx.fillRect(0, 0, 12, size);
    ctx.fillRect(size - 12, 0, 12, size);
    ctx.fillRect(0, 0, size, 12);
    ctx.fillRect(0, size * 0.5 - 5, size, 10);
    ctx.fillRect(0, size - 16, size, 16);
  } else if (kind === 'roof_red' || kind === 'roof_blue' || kind === 'roof_emerald' || kind === 'roof_terracotta') {
    const pal: Record<string, [string, string, string]> = {
      roof_blue: ['#1d4ed8', '#2563eb', '#3b82f6'],
      roof_red: ['#991b1b', '#b91c1c', '#dc2626'],
      roof_emerald: ['#065f46', '#047857', '#059669'],
      roof_terracotta: ['#9a3412', '#c2410c', '#ea580c'],
    };
    const [baseC, darkC, lightC] = pal[kind];
    ctx.fillStyle = baseC;
    ctx.fillRect(0, 0, size, size);
    for (let row = 0; row < 8; row++) {
      const off = (row % 2) * 16;
      for (let col = -1; col < 5; col++) {
        const sx = col * 32 + off;
        const sy = row * 16;
        const n = hash2d(col + 3, row, 83);
        ctx.fillStyle = n < 0.5 ? darkC : lightC;
        ctx.fillRect(sx + 1, sy + 1, 30, 13);
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.fillRect(sx + 1, sy + 13, 30, 3);
      }
    }
  } else if (kind === 'cliff') {
    // Diorama-grade weathered dark-umber & slate stone cliff with draped roots, moss ledges & shelf fungi!
    ctx.fillStyle = '#4c3e32';
    ctx.fillRect(0, 0, size, size);
    for (let row = 0; row < 6; row++) {
      const y = row * 22;
      ctx.fillStyle = row % 2 === 0 ? '#5c4b3c' : '#3f342a';
      ctx.fillRect(0, y, size, 20);
      for (let col = 0; col < 5; col++) {
        const n = hash2d(col, row, 97);
        ctx.fillStyle = n > 0.5 ? '#6e5c4a' : '#352b23';
        ctx.fillRect(col * 28 + (row % 2) * 10, y + 3, 22, 12);
      }
    }
    // Thick emerald moss pillows hanging over top cliff lip
    for (let i = 0; i < 42; i++) {
      const mx = hash2d(i, 1, 98) * size;
      const my = hash2d(i, 2, 98) * 26;
      ctx.fillStyle = i % 2 === 0 ? '#3f7d32' : '#589c42';
      ctx.beginPath();
      ctx.arc(mx, my, 4 + hash2d(i, 3, 98) * 6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Pale gnarled roots clinging down the cliff rock face + small russet shelf mushrooms
    ctx.strokeStyle = '#9c8f7d';
    ctx.lineWidth = 3;
    for (let r = 0; r < 3; r++) {
      const rx = 24 + r * 42;
      ctx.beginPath();
      ctx.moveTo(rx, 8);
      ctx.bezierCurveTo(rx - 14, 42, rx + 16, 78, rx - 4, 118);
      ctx.stroke();
    }
    ctx.fillStyle = '#b45309';
    ctx.fillRect(18, 56, 11, 5);
    ctx.fillRect(82, 42, 12, 5);
    ctx.fillRect(54, 88, 10, 4);
  } else if (kind === 'bark' || kind === 'wood') {
    ctx.fillStyle = kind === 'bark' ? '#5c361a' : '#854d1e';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 90; i++) {
      const x = Math.floor(hash2d(i, 1, 103) * size);
      const y = Math.floor(hash2d(i, 2, 103) * size);
      ctx.fillStyle = i % 2 === 0 ? '#3f220e' : '#a16228';
      ctx.fillRect(x, y, 4, 24);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  return tex;
}

// ----------------------------------------------------------------------------
// GPU Physics Shader Modifiers (onBeforeCompile on real PBR Materials!)
// ----------------------------------------------------------------------------
function attachGpuFoliagePhysics(
  mat: THREE.MeshStandardMaterial,
  shared: SharedShaderUniforms,
  windStrength: number,
  pushStrength: number
): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shared.uTime;
    shader.uniforms.uPlayerPos = shared.uPlayerPos;
    shader.uniforms.uWindStr = { value: windStrength };
    shader.uniforms.uPushStr = { value: pushStrength };

    shader.vertexShader =
      `uniform float uTime;
uniform vec3 uPlayerPos;
uniform float uWindStr;
uniform float uPushStr;
` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vec4 ysWorldPos = modelMatrix * vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        ysWorldPos = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
      #endif
      float heightFactor = clamp(position.y, 0.0, 2.8);
      float gust = 0.72 + 0.45 * sin(uTime * 0.9 + ysWorldPos.x * 0.18 + ysWorldPos.z * 0.14);
      float swayX = (sin(uTime * 2.4 + ysWorldPos.x * 0.7 + ysWorldPos.z * 0.5) + 0.35 * sin(uTime * 4.8 + ysWorldPos.x * 1.9)) * uWindStr * gust * heightFactor;
      float swayZ = (cos(uTime * 2.0 + ysWorldPos.z * 0.6 - ysWorldPos.x * 0.4) + 0.3 * cos(uTime * 4.2 + ysWorldPos.z * 1.7)) * uWindStr * 0.78 * gust * heightFactor;
      transformed.x += swayX;
      transformed.z += swayZ;

      // GPU Real-Time Player Proximity Physics Bending!
      vec2 toVert = ysWorldPos.xz - uPlayerPos.xz;
      float pDist = length(toVert);
      if (pDist < 1.35 && pDist > 0.001 && uPushStr > 0.001) {
        float push = (1.0 - pDist / 1.35);
        push = push * push * uPushStr * heightFactor;
        vec2 dir = toVert / pDist;
        transformed.x += dir.x * push;
        transformed.z += dir.y * push;
        transformed.y -= push * 0.25;
      }
      `
    );
  };
  mat.customProgramCacheKey = () => `ys_foliage_${windStrength}_${pushStrength}`;
}

function attachGpuWaterPhysics(
  mat: THREE.MeshPhysicalMaterial,
  shared: SharedShaderUniforms,
  waveAmp: number,
  shallowHex: string,
  deepHex: string,
  mode: 'water' | 'lava' | 'sky'
): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shared.uTime;
    shader.uniforms.uWaveAmp = { value: waveAmp };
    shader.uniforms.uShallowCol = { value: new THREE.Color(shallowHex) };
    shader.uniforms.uDeepCol = { value: new THREE.Color(deepHex) };

    shader.vertexShader =
      `uniform float uTime;
uniform float uWaveAmp;
attribute float aShore;
varying vec3 vYsWavePos;
varying float vShore;
` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vec4 wPos = modelMatrix * vec4(transformed, 1.0);
      float damp = 1.0 - aShore * 0.62;
      float w1 = sin(wPos.x * 1.15 + uTime * 2.4) * cos(wPos.z * 0.95 + uTime * 1.7);
      float w2 = sin((wPos.x * 0.85 - wPos.z * 1.1) * 1.75 - uTime * 2.9) * 0.55;
      float w3 = cos((wPos.x + wPos.z) * 2.6 + uTime * 3.4) * 0.22;
      transformed.y += (w1 + w2 + w3) * uWaveAmp * damp;
      vYsWavePos = wPos.xyz;
      vShore = aShore;
      `
    );

    shader.fragmentShader =
      `uniform float uTime;
uniform vec3 uShallowCol;
uniform vec3 uDeepCol;
varying vec3 vYsWavePos;
varying float vShore;
` + shader.fragmentShader;

    const fragLogic =
      mode === 'lava'
        ? `
      float crust = sin(vYsWavePos.x * 1.9 + uTime * 1.2) * cos(vYsWavePos.z * 1.8 - uTime * 1.1);
      float vein = smoothstep(0.25, 0.88, crust + vShore * 0.45);
      diffuseColor.rgb = mix(uDeepCol, uShallowCol, vein);
      `
        : mode === 'sky'
          ? `
      float cloud = sin(vYsWavePos.x * 0.6 + uTime * 0.55) * cos(vYsWavePos.z * 0.55 - uTime * 0.4);
      diffuseColor.rgb = mix(uDeepCol, uShallowCol, smoothstep(-0.3, 0.75, cloud + vShore * 0.5));
      `
          : `
      float depthBlend = clamp(vShore * 1.15, 0.0, 1.0);
      vec3 baseWater = mix(uDeepCol, uShallowCol, depthBlend);
      float c1 = sin(vYsWavePos.x * 2.4 + uTime * 2.3) * cos(vYsWavePos.z * 2.2 - uTime * 1.8);
      float c2 = sin((vYsWavePos.x - vYsWavePos.z) * 3.4 - uTime * 2.7);
      float caustic = smoothstep(0.38, 0.92, c1 * 0.65 + c2 * 0.45);
      baseWater += vec3(0.16, 0.24, 0.26) * caustic;
      // Animated rolling white shoreline surf & lapping coastal foam!
      float surfWave = sin(vShore * 13.5 - uTime * 3.4 + sin(vYsWavePos.x * 1.4 + vYsWavePos.z * 1.4) * 1.5);
      float shoreLine = smoothstep(0.56, 0.94, vShore);
      float surfBand = smoothstep(0.22, 0.72, vShore) * smoothstep(0.25, 0.82, surfWave) * 0.72;
      float foam = clamp(shoreLine * 0.88 + surfBand, 0.0, 1.0);
      diffuseColor.rgb = mix(baseWater, vec3(0.94, 0.98, 1.0), foam);
      diffuseColor.a = clamp(mix(0.86, 0.58, depthBlend) + foam * 0.36, 0.52, 0.96);
      `;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      ${fragLogic}
      `
    );
  };
  mat.customProgramCacheKey = () => `ys_water_v2_${mode}_${waveAmp}`;
}

function attachGpuClothWave(mat: THREE.MeshStandardMaterial, shared: SharedShaderUniforms): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shared.uTime;
    shader.vertexShader = `uniform float uTime;\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      float pin = clamp(uv.x, 0.0, 1.0);
      transformed.z += sin(uTime * 5.2 + position.x * 4.5 + position.y * 2.0) * 0.14 * pin;
      transformed.y += cos(uTime * 3.8 + position.x * 3.2) * 0.04 * pin;
      `
    );
  };
  mat.customProgramCacheKey = () => 'ys_cloth_banner';
}

// ----------------------------------------------------------------------------
// GPU Particle Physics Systems (Atmospheric Motes + Ballistic Combat Sparks!)
// ----------------------------------------------------------------------------
function createGpuAtmospherePoints(
  theme: ZoneDef['theme'],
  worldW: number,
  worldH: number,
  shared: SharedShaderUniforms
): THREE.Points {
  const count = 560;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = hash2d(i, 1, 301) * worldW;
    positions[i * 3 + 1] = 0.4 + hash2d(i, 2, 301) * 5.2;
    positions[i * 3 + 2] = hash2d(i, 3, 301) * worldH;
    seeds[i * 3] = hash2d(i, 4, 301);
    seeds[i * 3 + 1] = hash2d(i, 5, 301);
    seeds[i * 3 + 2] = hash2d(i, 6, 301);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));

  const isSnow = theme === 'ice';
  const isEmber = theme === 'tower' || theme === 'lava';
  const isShrine = theme === 'shrine';
  const colA = isSnow
    ? new THREE.Color('#e0f2fe')
    : isEmber
      ? new THREE.Color('#fb923c')
      : isShrine
        ? new THREE.Color('#38bdf8')
        : new THREE.Color('#fef08a');
  const colB = isSnow
    ? new THREE.Color('#ffffff')
    : isEmber
      ? new THREE.Color('#fde047')
      : isShrine
        ? new THREE.Color('#a5f3fc')
        : theme === 'village'
          ? new THREE.Color('#f9a8d4')
          : new THREE.Color('#bbf7d0');

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: shared.uTime,
      uColorA: { value: colA },
      uColorB: { value: colB },
      uRise: { value: isEmber ? 1.0 : isSnow ? -1.0 : 0.25 },
      uPointSize: { value: isSnow ? 5.2 : 6.0 },
    },
    vertexShader: `
      attribute vec3 aSeed;
      uniform float uTime;
      uniform float uRise;
      uniform float uPointSize;
      varying float vMix;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        float t = uTime * (0.45 + aSeed.x * 0.65) + aSeed.y * 12.0;
        p.x += sin(t * 1.1 + aSeed.z * 6.28) * 1.15;
        p.z += cos(t * 0.85 + aSeed.x * 6.28) * 1.15;
        if (abs(uRise) > 0.5) {
          p.y = mod(p.y + uTime * uRise * (0.7 + aSeed.z * 0.8), 5.6) + 0.2;
        } else {
          p.y += sin(t * 1.5) * 0.55;
        }
        vMix = aSeed.x;
        vAlpha = 0.45 + 0.45 * sin(t * 2.2);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = clamp(uPointSize * (16.0 / max(2.0, -mv.z)), 2.0, 12.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      varying float vMix;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float soft = smoothstep(0.5, 0.08, d);
        vec3 col = mix(uColorA, uColorB, vMix);
        gl_FragColor = vec4(col, soft * vAlpha * 0.88);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

class GpuBallisticSparkPool {
  public readonly points: THREE.Points;
  private readonly maxSparks = 240;
  private cursor = 0;
  private readonly origins: Float32Array;
  private readonly vels: Float32Array;
  private readonly colors: Float32Array;
  private readonly birthAndLife: Float32Array;
  private readonly geo: THREE.BufferGeometry;
  private readonly mat: THREE.ShaderMaterial;

  constructor(shared: SharedShaderUniforms) {
    this.origins = new Float32Array(this.maxSparks * 3);
    this.vels = new Float32Array(this.maxSparks * 3);
    this.colors = new Float32Array(this.maxSparks * 3);
    this.birthAndLife = new Float32Array(this.maxSparks * 2);
    for (let i = 0; i < this.maxSparks; i++) {
      this.birthAndLife[i * 2] = -999;
      this.birthAndLife[i * 2 + 1] = 0.01;
    }

    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.origins, 3));
    this.geo.setAttribute('aVel', new THREE.BufferAttribute(this.vels, 3));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3));
    this.geo.setAttribute('aTiming', new THREE.BufferAttribute(this.birthAndLife, 2));

    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTime: shared.uTime },
      vertexShader: `
        attribute vec3 aVel;
        attribute vec3 aColor;
        attribute vec2 aTiming;
        uniform float uTime;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float age = uTime - aTiming.x;
          float life = max(0.01, aTiming.y);
          if (age < 0.0 || age > life) {
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            gl_PointSize = 0.0;
            vAlpha = 0.0;
            vColor = aColor;
            return;
          }
          // GPU Ballistic Gravity + Ground Bounce Physics!
          vec3 p = position + aVel * age;
          float g = 11.5;
          p.y = position.y + aVel.y * age - 0.5 * g * age * age;
          if (p.y < 0.06) {
            float bounceT = max(0.0, age - (aVel.y + sqrt(max(0.0, aVel.y * aVel.y + 2.0 * g * position.y))) / g);
            p.y = 0.06 + abs(sin(bounceT * 9.0)) * 0.22 * (1.0 - age / life);
          }
          vColor = aColor;
          vAlpha = 1.0 - smoothstep(0.45, 1.0, age / life);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = clamp((10.5 * (1.0 - 0.45 * age / life)) * (14.0 / max(2.0, -mv.z)), 2.0, 18.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          if (vAlpha <= 0.01) discard;
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float core = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(mix(vColor, vec3(1.0), core * 0.55), core * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
  }

  public spawnBurst(wx: number, wy: number, wz: number, hexColor: string, count: number, now: number, speed = 3.8): void {
    _color.set(hexColor);
    for (let i = 0; i < count; i++) {
      const idx = this.cursor;
      this.cursor = (this.cursor + 1) % this.maxSparks;
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.45 + Math.random() * 0.95);
      this.origins[idx * 3] = wx + (Math.random() - 0.5) * 0.22;
      this.origins[idx * 3 + 1] = wy + Math.random() * 0.25;
      this.origins[idx * 3 + 2] = wz + (Math.random() - 0.5) * 0.22;
      this.vels[idx * 3] = Math.cos(a) * sp;
      this.vels[idx * 3 + 1] = 2.6 + Math.random() * 3.8;
      this.vels[idx * 3 + 2] = Math.sin(a) * sp;
      this.colors[idx * 3] = _color.r;
      this.colors[idx * 3 + 1] = _color.g;
      this.colors[idx * 3 + 2] = _color.b;
      this.birthAndLife[idx * 2] = now;
      this.birthAndLife[idx * 2 + 1] = 0.45 + Math.random() * 0.45;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aVel.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
    this.geo.attributes.aTiming.needsUpdate = true;
  }

  public dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}

// ============================================================================
// MAIN THREE.JS EVO WORLD RENDERER CLASS
// ============================================================================
export class YsThreeWorldRenderer {
  public readonly domElement: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly isSoftwareGl: boolean;
  private readonly sharedUniforms: SharedShaderUniforms = {
    uTime: { value: 0 },
    uPlayerPos: { value: new THREE.Vector3() },
  };
  private readonly envTexture: THREE.Texture;

  // Lighting rig
  private readonly hemiLight: THREE.HemisphereLight;
  private readonly sunLight: THREE.DirectionalLight;
  private readonly rimLight: THREE.DirectionalLight;
  private readonly heroTorchLight: THREE.PointLight;
  private readonly brazierLights: THREE.PointLight[] = [];

  // Shared procedural textures & RPG-JS HD-2D Atlas suite
  private readonly textures: Record<string, THREE.CanvasTexture> = {};
  private readonly archTextures: RpgJsArchTextures;
  private readonly maxAniso: number;
  private readonly enemySpriteCache = new Map<string, THREE.CanvasTexture>();
  private zoneOwnedTextures: THREE.CanvasTexture[] = [];

  // Dynamic Scene Groups
  private zoneGroup: THREE.Group | null = null;
  private activeZone: ZoneDef | null = null;
  private currentZoneId = '';
  private currentZoneTheme: ZoneDef['theme'] = 'town';
  private atmospherePoints: THREE.Points | null = null;
  private readonly gpuSparks: GpuBallisticSparkPool;

  // Dynamic Actors & Interactive Rigs
  private readonly adolRig: AdolRig;
  private npcRigs = new Map<string, NpcRig>();
  private enemyRigs = new Map<number, EnemyRig>();
  private chestRigs: ChestRig[] = [];
  private shrubRigs: ShrubRig[] = [];
  private portalRigs: PortalRig[] = [];
  private fountainJets: THREE.Mesh[] = [];
  private statueRings: THREE.Mesh[] = [];
  private fireFlames: THREE.Mesh[] = [];
  private floatingBoats: FloatingBoatRig[] = [];
  private wildlifeRigs: WildlifeRig[] = [];
  private fallingLeavesInst: THREE.InstancedMesh | null = null;
  private fallingLeaves: FallingLeafItem[] = [];
  private chimneySmokes: ChimneySmokeItem[] = [];
  private spinners: SpinnerRig[] = [];

  // Dynamic VFX Meshes (Projectiles, Armor Gibs, Lightning Bolts)
  private readonly dynamicVfxGroup = new THREE.Group();
  private readonly projPool: THREE.Mesh[] = [];
  private readonly gibPool: THREE.Mesh[] = [];
  private readonly boltLines: THREE.Line[] = [];

  private width: number;
  private height: number;
  private disposed = false;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.isSoftwareGl = detectSoftwareGl();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.16;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.domElement = this.renderer.domElement;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#6dbcf2');
    this.scene.fog = new THREE.FogExp2('#83cbf8', 0.0022);

    // True 45° Isometric 2.5D Evo Diorama Perspective Camera (crisp 32° FOV, 280-unit far plane for full-map vistas!)
    this.camera = new THREE.PerspectiveCamera(32, width / height, 0.4, 280);

    // Mandatory Studio IBL Reflections (RoomEnvironment via PMREMGenerator)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTexture;
    pmrem.dispose();

    // Vibrant Sunlit RPG-JS 3-Point Lighting Rig + Wide 45° 2048px Shadows + Hero Dungeon Torch!
    this.hemiLight = new THREE.HemisphereLight('#d6efff', '#4e8a45', 1.1);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight('#fff7e2', 2.35);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.set(this.isSoftwareGl ? 1024 : 2048, this.isSoftwareGl ? 1024 : 2048);
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 140;
    const d = 38;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.00045;
    this.sunLight.shadow.normalBias = 0.03;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.rimLight = new THREE.DirectionalLight('#93c5fd', 0.55);
    this.rimLight.position.set(-14, 12, -12);
    this.scene.add(this.rimLight);

    this.heroTorchLight = new THREE.PointLight('#ffbd73', 0, 12, 1.8);
    this.scene.add(this.heroTorchLight);

    // Pre-generate crisp modern procedural PBR + RPG-JS Pipoya Architectural & Botanical textures
    this.maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.archTextures = createRpgJsArchTextures(this.maxAniso);
    const texKinds = [
      'meadow',
      'plains',
      'cobble',
      'carpet',
      'mine',
      'tower',
      'ice',
      'village',
      'plaster',
      'roof_red',
      'roof_blue',
      'roof_emerald',
      'roof_terracotta',
      'cliff',
      'bark',
      'wood',
    ] as const;
    for (const k of texKinds) {
      this.textures[k] = createProceduralTexture(k, this.maxAniso);
    }
    this.textures.leaf_broad = createBotanicalAlphaTexture('leaf_broad', this.maxAniso);
    this.textures.leaf_cypress = createBotanicalAlphaTexture('leaf_cypress', this.maxAniso);
    this.textures.leaf_shrub = createBotanicalAlphaTexture('leaf_shrub', this.maxAniso);

    // Build HD-2D RPG-JS 4-Direction Shadow-Casting Hero — Adol Christin!
    this.adolRig = this.buildAdolRig();
    this.scene.add(this.adolRig.root);

    // GPU Ballistic Spark Pool + Dynamic 3D VFX Pools
    this.gpuSparks = new GpuBallisticSparkPool(this.sharedUniforms);
    this.scene.add(this.gpuSparks.points);
    this.scene.add(this.dynamicVfxGroup);
    this.initDynamicVfxPools();
  }

  private getTownTerraceSteps(zone: ZoneDef): [number, number] {
    return [Math.round(zone.height * 0.67), Math.round(zone.height * 0.36)];
  }

  private isWaterBasinTile(zone: ZoneDef, c: number, r: number): boolean {
    if (c < 0 || r < 0 || c >= zone.width || r >= zone.height) return false;
    const t = zone.tiles[r][c];
    // Both open water (3) AND wooden piers/bridges spanning over water (4) sit above the carved water basin!
    return t === 3 || t === 4;
  }

  private sampleLandElevation(zone: ZoneDef, x: number, z: number, tile: number): number {
    const H = zone.height;
    const theme = zone.theme;
    const isDungeon = theme === 'shrine' || theme === 'tower' || theme === 'lava';
    if (isDungeon) return 0;

    if (theme === 'town' || theme === 'village') {
      const [lowStepZ, highStepZ] = this.getTownTerraceSteps(zone);
      // Smooth 3-tier town elevation: Lower Waterfront (0) -> Middle Plaza (0.62) -> Upper Terrace (1.24)!
      const tier1 = smoothstep01((lowStepZ + 0.58 - z) / 1.16) * 0.62;
      const tier2 = smoothstep01((highStepZ + 0.58 - z) / 1.16) * 0.62;
      const roadBoost = tile === 6 ? 0.04 : 0;
      return tier1 + tier2 + roadBoost;
    }

    if (theme === 'plains' || theme === 'ruins') {
      const W = zone.width;
      const tc = Math.max(0, Math.min(W - 1, Math.floor(x)));
      const tr = Math.max(0, Math.min(H - 1, Math.floor(z)));
      const nearWater =
        this.isWaterBasinTile(zone, tc - 1, tr) ||
        this.isWaterBasinTile(zone, tc + 1, tr) ||
        this.isWaterBasinTile(zone, tc, tr - 1) ||
        this.isWaterBasinTile(zone, tc, tr + 1);
      if (nearWater) return tile === 4 ? 0.16 : 0.04;
      const northSlope = smoothstep01((H * 0.72 - z) / (H * 0.56)) * 0.68;
      const roll = Math.max(0, Math.sin(x * 0.22) * Math.cos(z * 0.2)) * 0.26;
      return northSlope + roll + (tile === 6 ? 0.04 : 0);
    }

    if (theme === 'ice') {
      return Math.max(0, Math.sin(x * 0.24) * Math.cos(z * 0.24)) * 0.18;
    }

    return 0;
  }

  private sampleGroundY(x: number, z: number, forTerrainVertex = false): number {
    const zone = this.activeZone;
    if (!zone) return 0;
    const W = zone.width;
    const H = zone.height;
    const tc = Math.max(0, Math.min(W - 1, Math.floor(x)));
    const tr = Math.max(0, Math.min(H - 1, Math.floor(z)));
    const tile = zone.tiles[tr][tc];

    if (forTerrainVertex) {
      // Symmetric 4-corner micro-sampling eliminates asymmetric shoreline collapse & water clipping!
      const eps = 0.14;
      let basinHits = 0;
      const samplePts: Array<[number, number]> = [
        [x - eps, z - eps],
        [x + eps, z - eps],
        [x - eps, z + eps],
        [x + eps, z + eps],
      ];
      for (const [sx, sz] of samplePts) {
        const sc = Math.max(0, Math.min(W - 1, Math.floor(sx)));
        const sr = Math.max(0, Math.min(H - 1, Math.floor(sz)));
        if (this.isWaterBasinTile(zone, sc, sr)) basinHits++;
      }
      if (basinHits === 4) {
        // Sculpted underwater pebble seabed cleanly beneath the water plane (y = -0.05)!
        return -0.64 + Math.sin(x * 0.85) * Math.cos(z * 0.85) * 0.05;
      }
      const landY = this.sampleLandElevation(zone, x, z, tile);
      if (basinHits > 0) {
        // Clean sloped shoreline bank transitioning smoothly down into the waterline!
        const frac = basinHits / 4;
        return landY * (1 - frac) - 0.14 * frac;
      }
      return landY;
    }

    if (tile === 4) {
      // Wooden piers & bridges sit cleanly above the water surface!
      return 0.16;
    }
    if (tile === 3) {
      return -0.05;
    }
    return this.sampleLandElevation(zone, x, z, tile);
  }

  public spawnGpuBurst(wx: number, wy: number, color: string, count = 16, speed = 3.8): void {
    const gx = wx / YS_WORLD_TILE;
    const gz = wy / YS_WORLD_TILE;
    this.gpuSparks.spawnBurst(gx, this.sampleGroundY(gx, gz) + 0.55, gz, color, count, this.sharedUniforms.uTime.value, speed);
  }

  public projectWorldToScreen(wx: number, wy: number, heightY = 0.9): { x: number; y: number; visible: boolean } {
    const gx = wx / YS_WORLD_TILE;
    const gz = wy / YS_WORLD_TILE;
    _vec3.set(gx, this.sampleGroundY(gx, gz) + heightY, gz);
    _vec3.project(this.camera);
    const visible = _vec3.z >= -1 && _vec3.z <= 1;
    return {
      x: (_vec3.x * 0.5 + 0.5) * this.width,
      y: (-_vec3.y * 0.5 + 0.5) * this.height,
      visible,
    };
  }

  private initDynamicVfxPools(): void {
    const projGeo = new THREE.SphereGeometry(0.18, 10, 10);
    for (let i = 0; i < 28; i++) {
      const m = new THREE.Mesh(
        projGeo,
        new THREE.MeshStandardMaterial({
          color: '#ffffff',
          emissive: '#f97316',
          emissiveIntensity: 2.2,
          roughness: 0.15,
        })
      );
      m.visible = false;
      this.dynamicVfxGroup.add(m);
      this.projPool.push(m);
    }

    const gibGeo = new THREE.BoxGeometry(0.16, 0.12, 0.16);
    for (let i = 0; i < 36; i++) {
      const m = new THREE.Mesh(
        gibGeo,
        new THREE.MeshStandardMaterial({
          color: '#64748b',
          metalness: 0.85,
          roughness: 0.25,
        })
      );
      m.castShadow = !this.isSoftwareGl;
      m.visible = false;
      this.dynamicVfxGroup.add(m);
      this.gibPool.push(m);
    }

    for (let i = 0; i < 12; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(5 * 3), 3));
      const line = new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({ color: '#fef08a', transparent: true, opacity: 0.95 })
      );
      line.visible = false;
      line.frustumCulled = false;
      this.dynamicVfxGroup.add(line);
      this.boltLines.push(line);
    }
  }

  // --------------------------------------------------------------------------
  // HD-2D RPG-JS 4-Direction Animated Hero — Adol Christin (Real 3D Shadow!)
  // --------------------------------------------------------------------------
  private buildAdolRig(): AdolRig {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);

    const spriteTex = buildRpgJsHeroSpriteSheet(0, 0, this.maxAniso);
    spriteTex.repeat.set(0.25, 0.25);
    spriteTex.offset.set(0, 0.75);

    const spriteMat = new THREE.MeshStandardMaterial({
      map: spriteTex,
      alphaTest: 0.45,
      side: THREE.DoubleSide,
      roughness: 0.78,
      metalness: 0.05,
    });
    const depthMat = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      map: spriteTex,
      alphaTest: 0.45,
    });

    const spriteMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.62, 1.62), spriteMat);
    spriteMesh.position.y = 0.78;
    spriteMesh.rotation.order = 'YXZ';
    spriteMesh.rotation.y = Math.PI * 0.25;
    spriteMesh.rotation.x = -0.22; // Crisp HD-2D tilt toward 45° 2.5D camera!
    spriteMesh.castShadow = !this.isSoftwareGl;
    spriteMesh.receiveShadow = true;
    spriteMesh.customDepthMaterial = depthMat;
    body.add(spriteMesh);

    // Soft grounding contact shadow under boots
    const shadowDisc = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 16),
      new THREE.MeshBasicMaterial({ color: '#09111f', transparent: true, opacity: 0.28, depthWrite: false })
    );
    shadowDisc.rotation.x = -Math.PI * 0.5;
    shadowDisc.position.y = 0.025;
    root.add(shadowDisc);

    // Dynamic Sword Slash Crescent Arc Mesh
    const slashArc = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 1.08, 18, 1, -0.88, 1.76),
      new THREE.MeshBasicMaterial({
        color: '#e0f2fe',
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    slashArc.rotation.x = -Math.PI * 0.5;
    slashArc.position.y = 0.62;
    root.add(slashArc);

    // Emerald Standing Auto-Heal Shimmer Ring & Ys II Sapphire Shield Dome
    const healRing = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.58, 24),
      new THREE.MeshBasicMaterial({
        color: '#4ade80',
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    healRing.rotation.x = -Math.PI * 0.5;
    healRing.position.y = 0.08;
    root.add(healRing);

    const shieldDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.75, 18, 14),
      new THREE.MeshBasicMaterial({
        color: '#38bdf8',
        transparent: true,
        opacity: 0,
        wireframe: true,
        depthWrite: false,
      })
    );
    shieldDome.position.y = 0.68;
    root.add(shieldDome);

    return {
      root,
      body,
      spriteMesh,
      spriteMat,
      depthMat,
      spriteTex,
      weaponTier: 0,
      armorTier: 0,
      slashArc,
      healRing,
      shieldDome,
    };
  }

  // --------------------------------------------------------------------------
  // HD-2D RPG-JS 4-Direction Animated NPCs & Monsters/Bosses
  // --------------------------------------------------------------------------
  private buildNpcRig(npc: WorldNpc): NpcRig {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);

    const spriteTex = buildRpgJsNpcSpriteSheet(npc, this.maxAniso);
    spriteTex.repeat.set(0.25, 0.25);
    spriteTex.offset.set(0, 0.75);
    this.zoneOwnedTextures.push(spriteTex);

    const spriteMat = new THREE.MeshStandardMaterial({
      map: spriteTex,
      alphaTest: 0.45,
      side: THREE.DoubleSide,
      roughness: 0.8,
      metalness: 0.04,
    });
    const spriteMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.56, 1.56), spriteMat);
    spriteMesh.position.y = 0.74;
    spriteMesh.rotation.order = 'YXZ';
    spriteMesh.rotation.y = Math.PI * 0.25;
    spriteMesh.rotation.x = -0.22;
    spriteMesh.castShadow = !this.isSoftwareGl;
    spriteMesh.receiveShadow = true;
    spriteMesh.customDepthMaterial = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      map: spriteTex,
      alphaTest: 0.45,
    });
    body.add(spriteMesh);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.38, 14),
      new THREE.MeshBasicMaterial({ color: '#09111f', transparent: true, opacity: 0.26, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI * 0.5;
    shadow.position.y = 0.025;
    root.add(shadow);

    const nx = npc.tx + 0.5;
    const nz = npc.ty + 0.5;
    const baseY = this.sampleGroundY(nx, nz);
    root.position.set(nx, baseY, nz);
    return { root, body, spriteMesh, spriteTex, baseY };
  }

  private getEnemyBaseSprite(e: YsThreeEnemyView): THREE.CanvasTexture {
    const key = `${e.kind}|${e.color}|${e.accent}`;
    let base = this.enemySpriteCache.get(key);
    if (!base) {
      base = buildRpgJsEnemySpriteSheet(e.kind, e.color, e.accent, this.maxAniso);
      this.enemySpriteCache.set(key, base);
    }
    return base;
  }

  private buildEnemyRig(e: YsThreeEnemyView): EnemyRig {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);

    const baseTex = this.getEnemyBaseSprite(e);
    const spriteTex = baseTex.clone();
    spriteTex.needsUpdate = true;
    spriteTex.repeat.set(0.5, 1);
    spriteTex.offset.set(0, 0);

    const spriteMat = new THREE.MeshStandardMaterial({
      map: spriteTex,
      alphaTest: 0.45,
      side: THREE.DoubleSide,
      roughness: 0.74,
      metalness: 0.08,
    });

    const size = e.kind === 'boss' ? 3.25 : e.kind === 'slime' ? 1.32 : 1.62;
    const spriteMesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), spriteMat);
    spriteMesh.position.y = size * 0.48;
    spriteMesh.rotation.order = 'YXZ';
    spriteMesh.rotation.y = Math.PI * 0.25;
    spriteMesh.rotation.x = -0.22;
    spriteMesh.castShadow = !this.isSoftwareGl;
    spriteMesh.receiveShadow = true;
    spriteMesh.customDepthMaterial = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      map: spriteTex,
      alphaTest: 0.45,
    });
    body.add(spriteMesh);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(e.kind === 'boss' ? 0.96 : 0.42, 16),
      new THREE.MeshBasicMaterial({ color: '#09111f', transparent: true, opacity: 0.3, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI * 0.5;
    shadow.position.y = 0.025;
    root.add(shadow);

    let bossCircle: THREE.Mesh | undefined;
    if (e.kind === 'boss') {
      bossCircle = new THREE.Mesh(
        new THREE.RingGeometry(1.05, 1.38, 24),
        new THREE.MeshBasicMaterial({
          color: e.accent,
          transparent: true,
          opacity: 0.58,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      bossCircle.rotation.x = -Math.PI * 0.5;
      bossCircle.position.y = 0.05;
      root.add(bossCircle);
    }

    root.position.set(e.x / YS_WORLD_TILE, 0, e.y / YS_WORLD_TILE);
    return { root, body, kind: e.kind, spriteMesh, spriteMat, spriteTex, bossCircle };
  }

  // --------------------------------------------------------------------------
  // Rebuild Full 3D Modern Evo World When Entering a New Zone!
  // --------------------------------------------------------------------------
  private rebuildZoneScene(zone: ZoneDef): void {
    this.clearZoneScene();
    this.activeZone = zone;
    this.currentZoneId = zone.id;
    this.currentZoneTheme = zone.theme;
    const g = new THREE.Group();
    this.zoneGroup = g;
    this.scene.add(g);

    const W = zone.width;
    const H = zone.height;
    const isDungeon = zone.theme === 'shrine' || zone.theme === 'tower' || zone.theme === 'lava';

    // Theme-Matched Vibrant RPG-JS / Pipoya Lighting, Sky & Ultra-Clear Full-Map Horizon!
    if (zone.theme === 'shrine') {
      this.scene.background = new THREE.Color('#0c142c');
      this.scene.fog = new THREE.FogExp2('#0c142c', 0.011);
      this.hemiLight.color.set('#60a5fa');
      this.hemiLight.groundColor.set('#1e293b');
      this.hemiLight.intensity = 0.72;
      this.sunLight.color.set('#bfdbfe');
      this.sunLight.intensity = 1.15;
    } else if (zone.theme === 'tower' || zone.theme === 'lava') {
      this.scene.background = new THREE.Color('#1c0b16');
      this.scene.fog = new THREE.FogExp2('#1c0b16', 0.01);
      this.hemiLight.color.set('#fb923c');
      this.hemiLight.groundColor.set('#2b111d');
      this.hemiLight.intensity = 0.76;
      this.sunLight.color.set('#fed7aa');
      this.sunLight.intensity = 1.22;
    } else if (zone.theme === 'ice') {
      this.scene.background = new THREE.Color('#a4d6f7');
      this.scene.fog = new THREE.FogExp2('#b8e2fc', 0.0024);
      this.hemiLight.color.set('#e0f2fe');
      this.hemiLight.groundColor.set('#64748b');
      this.hemiLight.intensity = 1.14;
      this.sunLight.color.set('#ffffff');
      this.sunLight.intensity = 2.25;
    } else if (zone.theme === 'village') {
      this.scene.background = new THREE.Color('#70c2f7');
      this.scene.fog = new THREE.FogExp2('#89d1fb', 0.0022);
      this.hemiLight.color.set('#dcf2ff');
      this.hemiLight.groundColor.set('#26943d');
      this.hemiLight.intensity = 1.16;
      this.sunLight.color.set('#fff9e6');
      this.sunLight.intensity = 2.38;
    } else {
      // Sunlit Pipoya / RPG-JS Lush Emerald Overworld!
      this.scene.background = new THREE.Color('#6dbcf2');
      this.scene.fog = new THREE.FogExp2('#83cbf8', 0.0022);
      this.hemiLight.color.set('#d6efff');
      this.hemiLight.groundColor.set('#26963a');
      this.hemiLight.intensity = 1.14;
      this.sunLight.color.set('#fff7e2');
      this.sunLight.intensity = 2.35;
    }

    // 1. REAL 3D SCULPTED TABLETOP DIORAMA PLINTH + MULTI-LEVEL TERRACED AUTOTILED TERRAIN MESH!
    const apronColor =
      zone.theme === 'shrine'
        ? '#141a2e'
        : zone.theme === 'tower' || zone.theme === 'lava'
          ? '#1e0c18'
          : zone.theme === 'ice'
            ? '#7cb5da'
            : zone.theme === 'town'
              ? '#1e6e94'
              : '#1f8a34';
    const apronMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(W + 120, H + 120),
      new THREE.MeshStandardMaterial({ color: apronColor, roughness: 0.88 })
    );
    apronMesh.rotation.x = -Math.PI * 0.5;
    apronMesh.position.set(W * 0.5, -2.35, H * 0.5);
    apronMesh.receiveShadow = true;
    g.add(apronMesh);

    // Sculpted 3D Diorama Earth & Bedrock Side Slab (top safely at y = -0.755, cleanly below the -0.64 seabed!)
    const slabMat = new THREE.MeshStandardMaterial({
      map: isDungeon ? this.textures.mine : this.archTextures.cliffTerrace,
      color: isDungeon ? '#3b3f52' : '#8a735b',
      roughness: 0.92,
    });
    const slabMesh = new THREE.Mesh(new THREE.BoxGeometry(W + 0.4, 1.65, H + 0.4), slabMat);
    slabMesh.position.set(W * 0.5, -1.58, H * 0.5);
    slabMesh.receiveShadow = true;
    g.add(slabMesh);

    const zoneTerrainTex = buildRpgJsZoneTerrainTexture(zone, this.maxAniso);
    this.zoneOwnedTextures.push(zoneTerrainTex);

    // 2x Subdivided Terrain Grid for crisp, symmetric terraced slopes & smooth carved shorelines!
    const terrainGeo = new THREE.PlaneGeometry(W, H, W * 2, H * 2);
    terrainGeo.rotateX(-Math.PI * 0.5);
    const posAttr = terrainGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i) + W * 0.5;
      const vz = posAttr.getZ(i) + H * 0.5;
      posAttr.setY(i, this.sampleGroundY(vx, vz, true));
    }
    terrainGeo.computeVertexNormals();

    const terrainMesh = new THREE.Mesh(
      terrainGeo,
      new THREE.MeshStandardMaterial({
        map: zoneTerrainTex,
        roughness: zone.theme === 'ice' ? 0.28 : 0.85,
        metalness: zone.theme === 'ice' ? 0.14 : 0.02,
      })
    );
    terrainMesh.position.set(W * 0.5, 0, H * 0.5);
    terrainMesh.receiveShadow = true;
    g.add(terrainMesh);

    // 2. Categorize Tiles for High-Performance InstancedMesh & Composite 3D Structures
    const roadTiles: Array<[number, number]> = [];
    const bridgeTiles: Array<[number, number]> = [];
    const waterTiles: Array<[number, number]> = [];
    const cliffTiles: Array<[number, number]> = [];
    const cottageWallTiles: Array<[number, number]> = [];
    const roofTiles: Array<[number, number]> = [];
    const treeTiles: Array<[number, number, boolean]> = [];
    const brazierTiles: Array<[number, number]> = [];
    const flowerTiles: Array<[number, number]> = [];
    const openGrassTiles: Array<[number, number]> = [];

    const buildingCells = new Set<string>();
    if (zone.buildings) {
      for (const b of zone.buildings) {
        for (let by = b.ty; by < b.ty + b.h; by++) {
          for (let bx = b.tx; bx < b.tx + b.w; bx++) {
            buildingCells.add(`${bx},${by}`);
          }
        }
      }
    }

    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        const t = zone.tiles[r][c];
        if (t === 6) roadTiles.push([c, r]);
        else if (t === 4) bridgeTiles.push([c, r]);
        else if (t === 3) waterTiles.push([c, r]);
        else if (t === 1) {
          if (buildingCells.has(`${c},${r}`)) continue;
          const hasRoofAbove = r > 0 && zone.tiles[r - 1][c] === 5;
          if ((zone.theme === 'town' || zone.theme === 'village') && hasRoofAbove) {
            cottageWallTiles.push([c, r]);
          } else {
            cliffTiles.push([c, r]);
          }
        } else if (t === 5) {
          if (!buildingCells.has(`${c},${r}`)) roofTiles.push([c, r]);
        } else if (t === 2) treeTiles.push([c, r, false]);
        else if (t === 9) treeTiles.push([c, r, true]);
        else if (t === 7) brazierTiles.push([c, r]);
        else if (t === 8) {
          flowerTiles.push([c, r]);
          openGrassTiles.push([c, r]);
        } else if (t === 0) {
          openGrassTiles.push([c, r]);
        }
      }
    }

    // 2B. Sculpted 3D Timber Piers & River Bridges with Driven Seabed Pilings & 4-Way Railings!
    if (bridgeTiles.length > 0) {
      const bMat = new THREE.MeshStandardMaterial({
        map: zone.theme === 'ice' ? this.textures.ice : this.archTextures.plankWood,
        roughness: zone.theme === 'ice' ? 0.2 : 0.74,
      });
      const bInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1.04, 0.18, 1.04), bMat, bridgeTiles.length);
      bInst.receiveShadow = true;
      bInst.castShadow = !this.isSoftwareGl;
      const postMat = new THREE.MeshStandardMaterial({ color: '#5a361d', roughness: 0.84 });
      const pilingMat = new THREE.MeshStandardMaterial({ map: this.archTextures.bark, color: '#6b4728', roughness: 0.9 });
      const postGeo = new THREE.BoxGeometry(0.13, 0.68, 0.13);
      const pilingGeo = new THREE.CylinderGeometry(0.085, 0.105, 0.92, 6);
      const railZGeo = new THREE.BoxGeometry(0.08, 0.1, 1.04);
      const railXGeo = new THREE.BoxGeometry(1.04, 0.1, 0.08);
      bridgeTiles.forEach(([c, r], i) => {
        _dummy.position.set(c + 0.5, 0.16, r + 0.5);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        bInst.setMatrixAt(i, _dummy.matrix);

        const waterLeft = c > 0 && zone.tiles[r][c - 1] === 3;
        const waterRight = c < W - 1 && zone.tiles[r][c + 1] === 3;
        const waterNorth = r > 0 && zone.tiles[r - 1][c] === 3;
        const waterSouth = r < H - 1 && zone.tiles[r + 1][c] === 3;
        if (waterLeft) {
          const p = new THREE.Mesh(postGeo, postMat);
          p.position.set(c + 0.08, 0.48, r + 0.5);
          p.castShadow = !this.isSoftwareGl;
          const rail = new THREE.Mesh(railZGeo, postMat);
          rail.position.set(c + 0.08, 0.72, r + 0.5);
          const pile = new THREE.Mesh(pilingGeo, pilingMat);
          pile.position.set(c + 0.1, -0.26, r + 0.5);
          g.add(p, rail, pile);
        }
        if (waterRight) {
          const p = new THREE.Mesh(postGeo, postMat);
          p.position.set(c + 0.92, 0.48, r + 0.5);
          p.castShadow = !this.isSoftwareGl;
          const rail = new THREE.Mesh(railZGeo, postMat);
          rail.position.set(c + 0.92, 0.72, r + 0.5);
          const pile = new THREE.Mesh(pilingGeo, pilingMat);
          pile.position.set(c + 0.9, -0.26, r + 0.5);
          g.add(p, rail, pile);
        }
        if (waterNorth) {
          const p = new THREE.Mesh(postGeo, postMat);
          p.position.set(c + 0.5, 0.48, r + 0.08);
          p.castShadow = !this.isSoftwareGl;
          const rail = new THREE.Mesh(railXGeo, postMat);
          rail.position.set(c + 0.5, 0.72, r + 0.08);
          const pile = new THREE.Mesh(pilingGeo, pilingMat);
          pile.position.set(c + 0.5, -0.26, r + 0.1);
          g.add(p, rail, pile);
        }
        if (waterSouth) {
          const p = new THREE.Mesh(postGeo, postMat);
          p.position.set(c + 0.5, 0.48, r + 0.92);
          p.castShadow = !this.isSoftwareGl;
          const rail = new THREE.Mesh(railXGeo, postMat);
          rail.position.set(c + 0.5, 0.72, r + 0.92);
          const pile = new THREE.Mesh(pilingGeo, pilingMat);
          pile.position.set(c + 0.5, -0.26, r + 0.9);
          g.add(p, rail, pile);
        }
      });
      bInst.computeBoundingSphere();
      g.add(bInst);
    }

    // 2C. Unified Seamless PBR Water Surface (World-Space Waves + Shallow Turquoise/Deep Sapphire + Animated Shoreline Surf Foam!)
    if (waterTiles.length > 0) {
      const isLava = zone.theme === 'tower' || zone.theme === 'lava';
      const isSky = zone.theme === 'village';
      const isRiver = zone.theme === 'plains' || zone.theme === 'ruins';

      // Build ONE contiguous half-tile subdivided BufferGeometry across all water + under-bridge basin tiles!
      const positions: number[] = [];
      const normals: number[] = [];
      const uvs: number[] = [];
      const shoreAttr: number[] = [];
      const indices: number[] = [];
      let vIdx = 0;

      const sampleShoreFactor = (wx: number, wz: number): number => {
        let landScore = 0;
        const offsets: Array<[number, number, number]> = [
          [-0.22, 0, 0.25],
          [0.22, 0, 0.25],
          [0, -0.22, 0.25],
          [0, 0.22, 0.25],
          [-0.68, 0, 0.12],
          [0.68, 0, 0.12],
          [0, -0.68, 0.12],
          [0, 0.68, 0.12],
          [-0.45, -0.45, 0.08],
          [0.45, -0.45, 0.08],
          [-0.45, 0.45, 0.08],
          [0.45, 0.45, 0.08],
        ];
        for (const [ox, oz, w] of offsets) {
          const sc = Math.floor(wx + ox);
          const sr = Math.floor(wz + oz);
          if (sc < 0 || sr < 0 || sc >= W || sr >= H) continue;
          const t = zone.tiles[sr][sc];
          if (t !== 3 && t !== 4) landScore += w;
        }
        return Math.min(1, landScore * 1.45);
      };

      const basinTiles: Array<[number, number]> = [...waterTiles, ...bridgeTiles];
      const waterY = isLava ? -0.1 : -0.05;
      for (const [c, r] of basinTiles) {
        // 2x2 sub-quads per tile for silky smooth shoreline foam & Gerstner wave curvature
        for (let sr = 0; sr < 2; sr++) {
          for (let sc = 0; sc < 2; sc++) {
            const x0 = c + sc * 0.5;
            const x1 = x0 + 0.5;
            const z0 = r + sr * 0.5;
            const z1 = z0 + 0.5;
            const corners: Array<[number, number]> = [
              [x0, z0],
              [x0, z1],
              [x1, z1],
              [x1, z0],
            ];
            for (const [cx, cz] of corners) {
              positions.push(cx, waterY, cz);
              normals.push(0, 1, 0);
              uvs.push(cx / W, cz / H);
              shoreAttr.push(sampleShoreFactor(cx, cz));
            }
            indices.push(vIdx, vIdx + 1, vIdx + 2, vIdx, vIdx + 2, vIdx + 3);
            vIdx += 4;
          }
        }
      }

      const waterGeo = new THREE.BufferGeometry();
      waterGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      waterGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      waterGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      waterGeo.setAttribute('aShore', new THREE.Float32BufferAttribute(shoreAttr, 1));
      waterGeo.setIndex(indices);
      waterGeo.computeBoundingSphere();

      const shallowHex = isLava ? '#fb923c' : isSky ? '#bae6fd' : isRiver ? '#48c9a8' : '#3cd8e8';
      const deepHex = isLava ? '#7c2d12' : isSky ? '#38bdf8' : isRiver ? '#136b6e' : '#0b5c91';
      const waterMat = new THREE.MeshPhysicalMaterial({
        color: '#ffffff',
        emissive: isLava ? '#b45309' : isRiver ? '#0b3838' : '#042a44',
        emissiveIntensity: isLava ? 1.35 : 0.22,
        roughness: isLava ? 0.32 : 0.08,
        metalness: isLava ? 0.08 : 0.16,
        clearcoat: isLava ? 0.2 : 1.0,
        clearcoatRoughness: 0.06,
        transparent: !isLava && !isSky,
        opacity: isLava || isSky ? 1.0 : 0.82,
        depthWrite: isLava || isSky,
      });
      attachGpuWaterPhysics(
        waterMat,
        this.sharedUniforms,
        isLava ? 0.045 : 0.055,
        shallowHex,
        deepHex,
        isLava ? 'lava' : isSky ? 'sky' : 'water'
      );
      const waterMesh = new THREE.Mesh(waterGeo, waterMat);
      waterMesh.receiveShadow = true;
      waterMesh.renderOrder = 2;
      g.add(waterMesh);

      // Clean Shoreline Details: Natural Riverbank Reeds, Smooth Shoreline Stones & Blooming Water Lilies!
      if (!isLava && !isSky && !isDungeon) {
        const bankEdges: Array<[number, number]> = [];
        const lilySpots: Array<[number, number]> = [];
        for (const [c, r] of waterTiles) {
          const touchesNorth = r > 0 && zone.tiles[r - 1][c] !== 3 && zone.tiles[r - 1][c] !== 4;
          const touchesSouth = r < H - 1 && zone.tiles[r + 1][c] !== 3 && zone.tiles[r + 1][c] !== 4;
          const touchesSide =
            (c > 0 && zone.tiles[r][c - 1] !== 3 && zone.tiles[r][c - 1] !== 4) ||
            (c < W - 1 && zone.tiles[r][c + 1] !== 3 && zone.tiles[r][c + 1] !== 4);
          if ((touchesNorth || touchesSouth || touchesSide) && (c + r) % 2 === 0) {
            // In Town harbor keep straight pier-side quay clean; place coastal rocks along natural flanks & rivers!
            if (zone.theme !== 'town' || c < 10 || c > W - 11) {
              bankEdges.push([c, r]);
            }
          } else if (!touchesNorth && !touchesSouth && (c * 13 + r * 7) % 13 === 0) {
            lilySpots.push([c, r]);
          }
        }

        if (bankEdges.length > 0) {
          const stoneMat = new THREE.MeshStandardMaterial({ color: '#788072', roughness: 0.88 });
          const mossCapMat = new THREE.MeshStandardMaterial({ color: '#2ea843', roughness: 0.82 });
          const stoneInst = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.32, 1), stoneMat, bankEdges.length);
          const mossInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.26, 0.3, 0.08, 7), mossCapMat, bankEdges.length);
          stoneInst.receiveShadow = true;
          stoneInst.castShadow = !this.isSoftwareGl;

          const reedMat = new THREE.MeshStandardMaterial({ color: '#2eb846', roughness: 0.72 });
          attachGpuFoliagePhysics(reedMat, this.sharedUniforms, 0.1, 0.35);
          const reedHeadMat = new THREE.MeshStandardMaterial({ color: '#6b3e1f', roughness: 0.85 });
          attachGpuFoliagePhysics(reedHeadMat, this.sharedUniforms, 0.1, 0.35);
          const reedCount = Math.min(90, bankEdges.length * 3);
          const reedStemGeo = new THREE.CylinderGeometry(0.022, 0.032, 0.72, 5);
          reedStemGeo.translate(0, 0.36, 0);
          const reedTopGeo = new THREE.CapsuleGeometry(0.035, 0.14, 4, 6);
          reedTopGeo.translate(0, 0.68, 0);
          const reedStemInst = new THREE.InstancedMesh(reedStemGeo, reedMat, reedCount);
          const reedTopInst = new THREE.InstancedMesh(reedTopGeo, reedHeadMat, reedCount);

          bankEdges.forEach(([c, r], i) => {
            const jx = (hash2d(c, r, 411) - 0.5) * 0.42;
            const jz = (hash2d(c, r, 412) - 0.5) * 0.32;
            _dummy.position.set(c + 0.5 + jx, -0.06, r + 0.5 + jz);
            _dummy.rotation.set(0, hash2d(c, r, 413) * Math.PI, 0);
            _dummy.scale.set(1.22, 0.46, 0.92);
            _dummy.updateMatrix();
            stoneInst.setMatrixAt(i, _dummy.matrix);

            _dummy.position.set(c + 0.5 + jx, 0.07, r + 0.5 + jz);
            _dummy.scale.set(0.95, 1, 0.78);
            _dummy.updateMatrix();
            mossInst.setMatrixAt(i, _dummy.matrix);
          });

          for (let i = 0; i < reedCount; i++) {
            const [c, r] = bankEdges[i % bankEdges.length];
            const ox = c + 0.18 + hash2d(i, 1, 451) * 0.64;
            const oz = r + 0.18 + hash2d(i, 2, 451) * 0.64;
            const sc = 0.78 + hash2d(i, 3, 451) * 0.52;
            _dummy.position.set(ox, -0.08, oz);
            _dummy.rotation.set((hash2d(i, 4, 451) - 0.5) * 0.22, hash2d(i, 5, 451) * Math.PI, (hash2d(i, 6, 451) - 0.5) * 0.22);
            _dummy.scale.setScalar(sc);
            _dummy.updateMatrix();
            reedStemInst.setMatrixAt(i, _dummy.matrix);
            reedTopInst.setMatrixAt(i, _dummy.matrix);
          }

          stoneInst.computeBoundingSphere();
          mossInst.computeBoundingSphere();
          reedStemInst.computeBoundingSphere();
          reedTopInst.computeBoundingSphere();
          g.add(stoneInst, mossInst, reedStemInst, reedTopInst);
        }

        if (lilySpots.length > 0 && zone.theme !== 'town') {
          const lilyMat = new THREE.MeshStandardMaterial({ color: '#2ea843', roughness: 0.58 });
          const lotusMat = new THREE.MeshStandardMaterial({ color: '#f9a8d4', roughness: 0.42 });
          const lilyInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.26, 0.26, 0.025, 12), lilyMat, lilySpots.length);
          const lotusInst = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.085, 0), lotusMat, lilySpots.length);
          lilySpots.forEach(([c, r], i) => {
            const lx = c + 0.5 + (hash2d(c, r, 441) - 0.5) * 0.3;
            const lz = r + 0.5 + (hash2d(c, r, 442) - 0.5) * 0.3;
            _dummy.position.set(lx, -0.02, lz);
            _dummy.rotation.set(0, hash2d(c, r, 444) * Math.PI, 0);
            _dummy.scale.setScalar(0.75 + hash2d(c, r, 445) * 0.5);
            _dummy.updateMatrix();
            lilyInst.setMatrixAt(i, _dummy.matrix);
            _dummy.position.set(lx, 0.04, lz);
            _dummy.scale.setScalar(0.9);
            _dummy.updateMatrix();
            lotusInst.setMatrixAt(i, _dummy.matrix);
          });
          lilyInst.computeBoundingSphere();
          lotusInst.computeBoundingSphere();
          g.add(lilyInst, lotusInst);
        }
      }
    }

    // 2D. Multi-Tiered 3D Sculpted Rock Cliffs, Base Buttresses & Crenellated Town Walls!
    if (cliffTiles.length > 0) {
      const isTownWall = zone.theme === 'town' || zone.theme === 'village';
      const wallH = isTownWall ? 1.85 : isDungeon ? 2.45 : 2.15;
      const wallMat = new THREE.MeshStandardMaterial({
        map:
          zone.theme === 'ice'
            ? this.textures.ice
            : isDungeon
              ? this.textures.mine
              : this.archTextures.cliffTerrace,
        color: zone.theme === 'tower' || zone.theme === 'lava' ? '#7a3359' : isTownWall ? '#d8cfc4' : '#ffffff',
        roughness: zone.theme === 'ice' ? 0.22 : 0.86,
      });
      const baseLedgeMat = new THREE.MeshStandardMaterial({
        color: zone.theme === 'ice' ? '#7ab8dc' : isDungeon ? '#383c4c' : isTownWall ? '#7c8594' : '#6c5a46',
        roughness: 0.9,
      });
      const capMat = new THREE.MeshStandardMaterial({
        color:
          zone.theme === 'ice'
            ? '#cde9f9'
            : zone.theme === 'tower' || zone.theme === 'lava'
              ? '#4a1d35'
              : zone.theme === 'shrine'
                ? '#4b4d5a'
                : isTownWall
                  ? '#aeb8c6'
                  : '#2ec445',
        roughness: 0.85,
      });
      const baseInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1.16, 0.58, 1.16), baseLedgeMat, cliffTiles.length);
      const wallInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1.02, wallH, 1.02), wallMat, cliffTiles.length);
      const capInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1.12, 0.26, 1.12), capMat, cliffTiles.length);
      baseInst.receiveShadow = true;
      baseInst.castShadow = !this.isSoftwareGl;
      wallInst.castShadow = !this.isSoftwareGl;
      wallInst.receiveShadow = true;
      capInst.castShadow = !this.isSoftwareGl;
      capInst.receiveShadow = true;

      const merlonTiles: Array<[number, number, number]> = [];
      cliffTiles.forEach(([c, r], i) => {
        const gy = this.sampleGroundY(c + 0.5, r + 0.5);
        const hJitter = isTownWall || isDungeon ? 1.0 : 0.92 + hash2d(c, r, 401) * 0.24;
        const hCur = wallH * hJitter;
        _dummy.position.set(c + 0.5, gy + 0.18, r + 0.5);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        baseInst.setMatrixAt(i, _dummy.matrix);

        _dummy.position.set(c + 0.5, gy + hCur * 0.5, r + 0.5);
        _dummy.scale.set(1, hJitter, 1);
        _dummy.updateMatrix();
        wallInst.setMatrixAt(i, _dummy.matrix);

        _dummy.position.set(c + 0.5, gy + hCur + 0.1, r + 0.5);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        capInst.setMatrixAt(i, _dummy.matrix);

        if ((isTownWall || isDungeon) && (c + r) % 2 === 0) {
          merlonTiles.push([c, r, gy + hCur + 0.34]);
        }
      });
      baseInst.computeBoundingSphere();
      wallInst.computeBoundingSphere();
      capInst.computeBoundingSphere();
      g.add(baseInst, wallInst, capInst);

      if (merlonTiles.length > 0) {
        const merlonInst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.56, 0.34, 0.56), capMat, merlonTiles.length);
        merlonInst.castShadow = !this.isSoftwareGl;
        merlonInst.receiveShadow = true;
        merlonTiles.forEach(([c, r, my], i) => {
          _dummy.position.set(c + 0.5, my, r + 0.5);
          _dummy.rotation.set(0, 0, 0);
          _dummy.scale.set(1, 1, 1);
          _dummy.updateMatrix();
          merlonInst.setMatrixAt(i, _dummy.matrix);
        });
        merlonInst.computeBoundingSphere();
        g.add(merlonInst);
      }
    }

    // 2E. Handcrafted Multi-Detail 3D RPG-JS / Pipoya Medieval Cottages, Guild Halls & Shopfronts!
    if (zone.buildings && zone.buildings.length > 0) {
      const frontMat = new THREE.MeshStandardMaterial({ map: this.archTextures.houseFront, roughness: 0.78 });
      const sideMat = new THREE.MeshStandardMaterial({ map: this.archTextures.houseSide, roughness: 0.8 });
      const wallMats = [sideMat, sideMat, sideMat, sideMat, frontMat, sideMat];
      const plasterMat = new THREE.MeshStandardMaterial({ color: '#f0e1c6', roughness: 0.84 });
      const timberMat = new THREE.MeshStandardMaterial({ map: this.archTextures.plankWood, color: '#6b3e20', roughness: 0.82 });
      const darkOakMat = new THREE.MeshStandardMaterial({ color: '#452512', roughness: 0.85 });
      const stoneMat = new THREE.MeshStandardMaterial({ color: '#7b8594', roughness: 0.86 });
      const quoinMat = new THREE.MeshStandardMaterial({ color: '#9ca6b4', roughness: 0.78 });
      const ironMat = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.86, roughness: 0.3 });
      const brassMat = new THREE.MeshStandardMaterial({ color: '#eab308', metalness: 0.88, roughness: 0.24 });
      const windowGlowMat = new THREE.MeshStandardMaterial({
        color: '#fef3c7',
        emissive: '#f59e0b',
        emissiveIntensity: 0.82,
        roughness: 0.22,
      });
      const shutterMat = new THREE.MeshStandardMaterial({ color: '#3b5d7a', roughness: 0.72 });
      const boxMat = new THREE.MeshStandardMaterial({ color: '#9a4320', roughness: 0.82 });
      const bloomRedMat = new THREE.MeshStandardMaterial({ color: '#f43f5e', roughness: 0.62 });
      const bloomGoldMat = new THREE.MeshStandardMaterial({ color: '#fde047', roughness: 0.6 });
      const emberMat = new THREE.MeshStandardMaterial({
        color: '#fb923c',
        emissive: '#ea580c',
        emissiveIntensity: 1.9,
      });
      const lanternMat = new THREE.MeshStandardMaterial({
        color: '#fef08a',
        emissive: '#fbbf24',
        emissiveIntensity: 1.65,
      });
      const roofMats: Record<string, THREE.MeshStandardMaterial> = {
        crimson: new THREE.MeshStandardMaterial({ map: this.archTextures.roofCrimson, roughness: 0.58 }),
        cobalt: new THREE.MeshStandardMaterial({ map: this.archTextures.roofCobalt, roughness: 0.58 }),
        emerald: new THREE.MeshStandardMaterial({ map: this.archTextures.roofEmerald, roughness: 0.58 }),
        terracotta: new THREE.MeshStandardMaterial({ map: this.archTextures.roofTerracotta, roughness: 0.58 }),
      };

      for (const b of zone.buildings) {
        const bGrp = new THREE.Group();
        const cx = b.tx + b.w * 0.5;
        const cz = b.ty + b.h * 0.5;
        const groundY = this.sampleGroundY(cx, cz);
        const wallW = b.w - 0.14;
        const wallD = b.h - 0.16;
        const wallH = b.signKind === 'guild' || b.signKind === 'library' ? 2.28 : 2.02;
        const roofPeakH = Math.min(1.62, wallD * 0.48);
        const rMat = roofMats[b.roofStyle] ?? roofMats.crimson;

        // 1. Deep reinforced cut-stone terrace foundation plinth + molded stone water-table ledge
        const plinth = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.28, 1.24, b.h + 0.28), stoneMat);
        plinth.position.y = -0.32;
        plinth.receiveShadow = true;
        plinth.castShadow = !this.isSoftwareGl;
        const plinthCap = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.34, 0.12, b.h + 0.34), quoinMat);
        plinthCap.position.y = 0.28;
        plinthCap.receiveShadow = true;
        bGrp.add(plinth, plinthCap);

        // 2. Main Half-Timbered Cottage Body
        const walls = new THREE.Mesh(new THREE.BoxGeometry(wallW, wallH, wallD), wallMats);
        walls.position.y = 0.32 + wallH * 0.5;
        walls.castShadow = !this.isSoftwareGl;
        walls.receiveShadow = true;
        bGrp.add(walls);

        // 3. Stepped Corner Stone Quoins, Protruding Oak Posts, Second-Story Jetty Belt & Eave Corbels!
        const postGeo = new THREE.BoxGeometry(0.18, wallH + 0.08, 0.18);
        const quoinGeo = new THREE.BoxGeometry(0.24, 0.22, 0.24);
        const corbelGeo = new THREE.BoxGeometry(0.14, 0.24, 0.28);
        for (const sx of [-1, 1]) {
          for (const sz of [-1, 1]) {
            const p = new THREE.Mesh(postGeo, timberMat);
            p.position.set(sx * (wallW * 0.5), 0.32 + wallH * 0.5, sz * (wallD * 0.5));
            p.castShadow = !this.isSoftwareGl;
            bGrp.add(p);
            // Lower stone corner quoins
            for (let q = 0; q < 2; q++) {
              const quoin = new THREE.Mesh(quoinGeo, quoinMat);
              quoin.position.set(sx * (wallW * 0.5), 0.44 + q * 0.34, sz * (wallD * 0.5));
              bGrp.add(quoin);
            }
          }
        }
        const belt = new THREE.Mesh(new THREE.BoxGeometry(wallW + 0.22, 0.16, wallD + 0.22), timberMat);
        belt.position.y = 0.32 + wallH * 0.54;
        const eaveTrim = new THREE.Mesh(new THREE.BoxGeometry(wallW + 0.28, 0.14, wallD + 0.28), darkOakMat);
        eaveTrim.position.y = 0.32 + wallH - 0.04;
        bGrp.add(belt, eaveTrim);

        // Timber brackets (corbels) under the front & back roof eaves!
        const corbelCount = Math.max(3, Math.floor(wallW));
        for (let ci = 0; ci < corbelCount; ci++) {
          const t = corbelCount === 1 ? 0 : ci / (corbelCount - 1) - 0.5;
          const kx = t * (wallW - 0.6);
          const corbF = new THREE.Mesh(corbelGeo, darkOakMat);
          corbF.position.set(kx, 0.32 + wallH - 0.18, wallD * 0.5 + 0.08);
          bGrp.add(corbF);
        }

        // 4. Solid 3D Triangular Gable End Walls + Exposed Half-Timber Gable Truss Beams!
        const gableShape = new THREE.Shape();
        gableShape.moveTo(-wallD * 0.5, 0);
        gableShape.lineTo(wallD * 0.5, 0);
        gableShape.lineTo(0, roofPeakH);
        gableShape.closePath();
        const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: wallW - 0.04, bevelEnabled: false });
        gableGeo.rotateY(Math.PI * 0.5);
        gableGeo.translate(-(wallW - 0.04) * 0.5, 0.32 + wallH, 0);
        const gableMesh = new THREE.Mesh(gableGeo, plasterMat);
        gableMesh.castShadow = !this.isSoftwareGl;
        gableMesh.receiveShadow = true;
        bGrp.add(gableMesh);

        // Exposed king-post & collar beam on BOTH gable end faces + carved ridge finials!
        for (const sideSign of [-1, 1]) {
          const gx = sideSign * (wallW * 0.5 + 0.01);
          const kingPost = new THREE.Mesh(new THREE.BoxGeometry(0.1, roofPeakH * 0.92, 0.14), timberMat);
          kingPost.position.set(gx, 0.32 + wallH + roofPeakH * 0.46, 0);
          const collar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, wallD * 0.58), timberMat);
          collar.position.set(gx, 0.32 + wallH + roofPeakH * 0.42, 0);
          const atticWin = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 10), windowGlowMat);
          atticWin.rotation.z = Math.PI * 0.5;
          atticWin.position.set(gx + sideSign * 0.02, 0.32 + wallH + roofPeakH * 0.56, 0);
          const finial = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.42, 6), brassMat);
          finial.position.set(sideSign * (wallW * 0.5 + 0.32), 0.32 + wallH + roofPeakH + 0.26, 0);
          bGrp.add(kingPost, collar, atticWin, finial);
        }

        // 5. Overhanging Pitched Scalloped Shingle Roof + Timber Bargeboards + Ridge Beam
        const halfSpan = wallD * 0.5 + 0.4;
        const slopeLen = Math.hypot(halfSpan, roofPeakH + 0.16);
        const slopeAngle = Math.atan2(roofPeakH + 0.16, halfSpan);
        const slopeFront = new THREE.Mesh(new THREE.BoxGeometry(wallW + 0.7, 0.18, slopeLen), rMat);
        slopeFront.position.set(0, 0.32 + wallH + roofPeakH * 0.52, halfSpan * 0.48);
        slopeFront.rotation.x = slopeAngle;
        slopeFront.castShadow = !this.isSoftwareGl;
        slopeFront.receiveShadow = true;
        const slopeBack = new THREE.Mesh(new THREE.BoxGeometry(wallW + 0.7, 0.18, slopeLen), rMat);
        slopeBack.position.set(0, 0.32 + wallH + roofPeakH * 0.52, -halfSpan * 0.48);
        slopeBack.rotation.x = -slopeAngle;
        slopeBack.castShadow = !this.isSoftwareGl;
        slopeBack.receiveShadow = true;
        const ridge = new THREE.Mesh(new THREE.BoxGeometry(wallW + 0.78, 0.24, 0.28), darkOakMat);
        ridge.position.set(0, 0.32 + wallH + roofPeakH + 0.08, 0);
        ridge.castShadow = !this.isSoftwareGl;
        bGrp.add(slopeFront, slopeBack, ridge);

        // 5B. 3D Pitched Roof Dormer Windows jutting from the front roof slope!
        const dormerXs = b.w >= 7 ? [-1.35, 1.35] : [0];
        for (const dx of dormerXs) {
          const dorm = new THREE.Group();
          const dBox = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.72, 0.76), plasterMat);
          dBox.castShadow = !this.isSoftwareGl;
          const dFrame = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.52, 0.08), darkOakMat);
          dFrame.position.set(0, 0.02, 0.38);
          const dGlass = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.38, 0.1), windowGlowMat);
          dGlass.position.set(0, 0.02, 0.38);
          const dRoofL = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.1, 0.96), rMat);
          dRoofL.position.set(-0.26, 0.46, 0.04);
          dRoofL.rotation.z = 0.52;
          const dRoofR = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.1, 0.96), rMat);
          dRoofR.position.set(0.26, 0.46, 0.04);
          dRoofR.rotation.z = -0.52;
          dorm.add(dBox, dFrame, dGlass, dRoofL, dRoofR);
          dorm.position.set(dx, 0.32 + wallH + roofPeakH * 0.48, halfSpan * 0.44);
          bGrp.add(dorm);
        }

        // 6. 3D Framed Glowing Side Windows + Louvered Shutters + Blooming Terracotta Flower Boxes!
        for (const sideSign of [-1, 1]) {
          const sx = sideSign * (wallW * 0.5 + 0.04);
          const wy = 0.32 + wallH * 0.58;
          const winFrame = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.68, 0.78), darkOakMat);
          winFrame.position.set(sx, wy, 0);
          const winGlass = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.52, 0.62), windowGlowMat);
          winGlass.position.set(sx, wy, 0);
          const muntinV = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.52, 0.05), darkOakMat);
          muntinV.position.set(sx, wy, 0);
          const muntinH = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.62), darkOakMat);
          muntinH.position.set(sx, wy, 0);
          const shutA = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.62, 0.24), shutterMat);
          shutA.position.set(sx, wy, -0.5);
          const shutB = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.62, 0.24), shutterMat);
          shutB.position.set(sx, wy, 0.5);
          const fBox = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.84), boxMat);
          fBox.position.set(sx + sideSign * 0.08, wy - 0.4, 0);
          const fBloomA = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), bloomRedMat);
          fBloomA.position.set(sx + sideSign * 0.1, wy - 0.24, -0.22);
          const fBloomB = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 6), bloomGoldMat);
          fBloomB.position.set(sx + sideSign * 0.1, wy - 0.22, 0);
          const fBloomC = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), bloomRedMat);
          fBloomC.position.set(sx + sideSign * 0.1, wy - 0.24, 0.22);
          bGrp.add(winFrame, winGlass, muntinV, muntinH, shutA, shutB, fBox, fBloomA, fBloomB, fBloomC);
        }

        // 7. Recessed 3D Oak Front Doorway + Gabled Porch Canopy + Lantern + Stepped Stone Stoop!
        const frontZ = wallD * 0.5 + 0.04;
        const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.12, 1.48, 0.16), darkOakMat);
        doorFrame.position.set(0, 1.04, frontZ);
        const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(0.86, 1.32, 0.12), timberMat);
        doorPanel.position.set(0, 0.98, frontZ + 0.04);
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), brassMat);
        knob.position.set(0.26, 0.94, frontZ + 0.12);
        const awning = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.14, 0.8), rMat);
        awning.position.set(0, 1.76, frontZ + 0.34);
        awning.rotation.x = 0.34;
        awning.castShadow = !this.isSoftwareGl;
        for (const px of [-0.68, 0.68]) {
          const col = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 1.54, 6), timberMat);
          col.position.set(px, 0.94, frontZ + 0.62);
          col.castShadow = !this.isSoftwareGl;
          bGrp.add(col);
        }
        const lantern = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), lanternMat);
        lantern.position.set(0.56, 1.44, frontZ + 0.24);
        const step1 = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.2, 0.72), stoneMat);
        step1.position.set(0, 0.16, frontZ + 0.32);
        step1.receiveShadow = true;
        const step2 = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.12, 0.38), quoinMat);
        step2.position.set(0, 0.06, frontZ + 0.72);
        step2.receiveShadow = true;
        bGrp.add(doorFrame, doorPanel, knob, awning, lantern, step1, step2);

        // 8. Hanging Wrought-Iron Guild Signboard Bracket on Front-Left Corner!
        const signArm = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.05, 0.05), ironMat);
        signArm.position.set(-wallW * 0.5 - 0.32, 1.78, frontZ - 0.06);
        const signPlaque = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.44, 0.06), darkOakMat);
        signPlaque.position.set(-wallW * 0.5 - 0.36, 1.5, frontZ - 0.06);
        const signEmblem = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), brassMat);
        signEmblem.position.set(-wallW * 0.5 - 0.36, 1.5, frontZ - 0.01);
        bGrp.add(signArm, signPlaque, signEmblem);

        // 9. Bespoke Exterior 3D Architectural Features Tailored to Each Building's Role (signKind)!
        if (b.signKind === 'weapon') {
          // Outdoor Stone Blacksmith Forge Hearth + Glowing Coals + Weapon Display Rack!
          const forgeBase = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.85, 0.85), stoneMat);
          forgeBase.position.set(wallW * 0.5 + 0.52, 0.42, 0.15);
          forgeBase.castShadow = !this.isSoftwareGl;
          const coals = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.18, 0.62), emberMat);
          coals.position.set(wallW * 0.5 + 0.52, 0.88, 0.15);
          const hood = new THREE.Mesh(new THREE.ConeGeometry(0.58, 0.8, 4), ironMat);
          hood.rotation.y = Math.PI * 0.25;
          hood.position.set(wallW * 0.5 + 0.52, 1.65, 0.15);
          const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.95, 0.04), quoinMat);
          blade.position.set(-wallW * 0.32, 0.72, frontZ + 0.24);
          blade.rotation.z = 0.24;
          bGrp.add(forgeBase, coals, hood, blade);
        } else if (b.signKind === 'armor') {
          // Outdoor Knight Armor & Heater Shield Display Stand!
          const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.14, 1.2, 6), timberMat);
          stand.position.set(wallW * 0.5 + 0.42, 0.6, 0.25);
          const cuirass = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.48, 8), quoinMat);
          cuirass.position.set(wallW * 0.5 + 0.42, 0.96, 0.25);
          const shield = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.56, 0.08), new THREE.MeshStandardMaterial({ color: '#1d4ed8', metalness: 0.6, roughness: 0.32 }));
          shield.position.set(wallW * 0.5 + 0.42, 0.78, 0.44);
          bGrp.add(stand, cuirass, shield);
        } else if (b.signKind === 'inn' || b.signKind === 'tavern') {
          // Stacked Oak Ale Kegs + Cozy Outdoor Patio Table & Tankards!
          for (let k = 0; k < 2; k++) {
            const keg = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.56, 10), timberMat);
            keg.rotation.z = Math.PI * 0.5;
            keg.position.set(wallW * 0.5 + 0.36, 0.26 + k * 0.44, 0.15);
            keg.castShadow = !this.isSoftwareGl;
            bGrp.add(keg);
          }
          const tbl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 10), timberMat);
          tbl.position.set(-wallW * 0.36, 0.62, frontZ + 0.52);
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 0.6, 6), darkOakMat);
          leg.position.set(-wallW * 0.36, 0.3, frontZ + 0.52);
          const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.14, 6), brassMat);
          mug.position.set(-wallW * 0.3, 0.73, frontZ + 0.48);
          bGrp.add(tbl, leg, mug);
        } else if (b.signKind === 'guild' || b.signKind === 'library') {
          // Roof Clock / Bell Cupola Spire crowning the Library & Guildhall!
          const cupBase = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.88, 0.95), stoneMat);
          cupBase.position.set(0, 0.32 + wallH + roofPeakH + 0.42, 0);
          cupBase.castShadow = !this.isSoftwareGl;
          const clockFace = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 12), windowGlowMat);
          clockFace.rotation.x = Math.PI * 0.5;
          clockFace.position.set(0, 0.32 + wallH + roofPeakH + 0.52, 0.48);
          const spire = new THREE.Mesh(new THREE.ConeGeometry(0.66, 1.15, 6), rMat);
          spire.position.set(0, 0.32 + wallH + roofPeakH + 1.42, 0);
          spire.castShadow = !this.isSoftwareGl;
          bGrp.add(cupBase, clockFace, spire);
        } else if (b.signKind === 'fortune') {
          // Ornate Mystic Crystal Orb Stand beside Sara's Parlor!
          const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.84, 8), new THREE.MeshStandardMaterial({ color: '#581c87', roughness: 0.5 }));
          ped.position.set(wallW * 0.5 + 0.36, 0.42, 0.22);
          const orb = new THREE.Mesh(
            new THREE.SphereGeometry(0.22, 12, 10),
            new THREE.MeshStandardMaterial({ color: '#c084fc', emissive: '#9333ea', emissiveIntensity: 1.35, roughness: 0.1 })
          );
          orb.position.set(wallW * 0.5 + 0.36, 0.98, 0.22);
          bGrp.add(ped, orb);
        } else if (b.signKind === 'clinic') {
          // Herbalist Potted Medicinal Planters & Vine Trellis!
          const leafMat = new THREE.MeshStandardMaterial({ color: '#2ec445', roughness: 0.72 });
          for (let h = 0; h < 2; h++) {
            const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.13, 0.26, 8), boxMat);
            pot.position.set(wallW * 0.5 + 0.34, 0.13, -0.2 + h * 0.55);
            const herb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1), leafMat);
            herb.position.set(wallW * 0.5 + 0.34, 0.36, -0.2 + h * 0.55);
            bGrp.add(pot, herb);
          }
        } else {
          // Stacked Timber Cargo Barrels & Chopped Firewood Shelter for Warehouses & Homes!
          const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.52, 8), timberMat);
          barrel.position.set(wallW * 0.5 + 0.3, 0.26, 0.22);
          barrel.castShadow = !this.isSoftwareGl;
          const crate = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.48), timberMat);
          crate.position.set(wallW * 0.5 + 0.32, 0.24, -0.32);
          crate.castShadow = !this.isSoftwareGl;
          bGrp.add(barrel, crate);
        }

        if (b.hasChimney) {
          const chX = wallW * 0.28;
          const chY = 0.32 + wallH + roofPeakH * 0.72;
          const chZ = -wallD * 0.14;
          const chim = new THREE.Mesh(new THREE.BoxGeometry(0.54, 1.54, 0.54), stoneMat);
          chim.position.set(chX, chY, chZ);
          chim.castShadow = !this.isSoftwareGl;
          const chimCap = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.16, 0.68), quoinMat);
          chimCap.position.set(chX, chY + 0.8, chZ);
          const pot1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.24, 8), boxMat);
          pot1.position.set(chX - 0.12, chY + 0.96, chZ);
          const pot2 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.24, 8), boxMat);
          pot2.position.set(chX + 0.12, chY + 0.96, chZ);
          bGrp.add(chim, chimCap, pot1, pot2);

          // Animated rising 3D chimney smoke puffs curling upward into the sunlit sky!
          const smokeGeo = new THREE.IcosahedronGeometry(0.22, 1);
          for (let s = 0; s < 3; s++) {
            const sMat = new THREE.MeshStandardMaterial({
              color: '#f1f5f9',
              roughness: 0.95,
              transparent: true,
              opacity: 0.48,
              depthWrite: false,
            });
            const puff = new THREE.Mesh(smokeGeo, sMat);
            const sx = cx + chX;
            const sy = groundY + chY + 1.12;
            const sz = cz + chZ;
            puff.position.set(sx, sy, sz);
            g.add(puff);
            this.chimneySmokes.push({
              mesh: puff,
              ox: sx,
              oy: sy,
              oz: sz,
              phase: s * 0.333 + hash2d(b.tx, b.ty, 911) * 0.4,
              speed: 0.26 + hash2d(b.tx, b.ty + s, 912) * 0.08,
            });
          }
        }

        bGrp.position.set(cx, groundY, cz);
        g.add(bGrp);
      }
    } else if (cottageWallTiles.length > 0 || roofTiles.length > 0) {
      const wallMat = new THREE.MeshStandardMaterial({ map: this.archTextures.houseFront, roughness: 0.78 });
      const wallInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1.02, 1.55, 1.02), wallMat, Math.max(1, cottageWallTiles.length));
      cottageWallTiles.forEach(([c, r], i) => {
        _dummy.position.set(c + 0.5, 0.78, r + 0.5);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        wallInst.setMatrixAt(i, _dummy.matrix);
      });
      if (cottageWallTiles.length > 0) {
        wallInst.computeBoundingSphere();
        g.add(wallInst);
      }
      if (roofTiles.length > 0) {
        const roofMat = new THREE.MeshStandardMaterial({ map: this.archTextures.roofCrimson, roughness: 0.65 });
        const roofInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1.14, 0.92, 1.14), roofMat, roofTiles.length);
        roofTiles.forEach(([c, r], i) => {
          _dummy.position.set(c + 0.5, 1.92, r + 0.5);
          _dummy.rotation.set(0.18, 0, 0);
          _dummy.scale.set(1, 1, 1);
          _dummy.updateMatrix();
          roofInst.setMatrixAt(i, _dummy.matrix);
        });
        roofInst.computeBoundingSphere();
        g.add(roofInst);
      }
    }

    // 2E-B. Full 3D Harbor Sailboats with Billowing GPU-Cloth Sails (zone.boats!)
    if (zone.boats && zone.boats.length > 0) {
      const woodMat = new THREE.MeshStandardMaterial({ map: this.textures.wood, roughness: 0.8 });
      for (let i = 0; i < zone.boats.length; i++) {
        const b = zone.boats[i];
        const ship = new THREE.Group();
        const hull = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.48, 0.92), new THREE.MeshStandardMaterial({ color: b.hullColor, roughness: 0.82 }));
        hull.castShadow = !this.isSoftwareGl;
        const bow = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.85, 4), new THREE.MeshStandardMaterial({ color: b.hullColor, roughness: 0.82 }));
        bow.rotation.z = -Math.PI * 0.5;
        bow.rotation.x = Math.PI * 0.25;
        bow.position.set(1.55, 0.04, 0);
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.55, 7), woodMat);
        mast.position.set(0.1, 1.35, 0);
        mast.castShadow = !this.isSoftwareGl;
        const sailMat = new THREE.MeshStandardMaterial({ color: b.sailColor, roughness: 0.72, side: THREE.DoubleSide });
        attachGpuClothWave(sailMat, this.sharedUniforms);
        const sailGeo = new THREE.PlaneGeometry(1.35, 1.75, 6, 4);
        sailGeo.translate(0.65, 0, 0);
        const sail = new THREE.Mesh(sailGeo, sailMat);
        sail.position.set(0.12, 1.55, 0.05);
        sail.castShadow = !this.isSoftwareGl;
        ship.add(hull, bow, mast, sail);
        ship.position.set(b.tx + 0.5, 0.02, b.ty + 0.5);
        ship.rotation.y = b.facing === 'left' ? Math.PI : 0;
        g.add(ship);
        this.floatingBoats.push({ group: ship, baseY: 0.02, phase: i * 1.9 });
      }
    }

    // 2E-C. Multi-Level Town Terraces, Carved 3D Stone Staircases & Reinforced Anti-Slide Banks!
    this.buildTownTerracesAndReinforcedBanks(g, zone, buildingCells);

    // 2F. Monumental Multi-Tile Trees (2x1..4x4) + Cypress Spires + Marble Columns & Falling Leaves!
    this.buildTreesAndColumns(g, zone, treeTiles);

    // 2G. 1100+ Instanced Vibrant Emerald GPU-Bending Grass Blades & Wildflower Clusters!
    if (!isDungeon && zone.theme !== 'ice' && openGrassTiles.length > 0) {
      this.buildGpuBendingMeadowGrass(g, zone.theme, openGrassTiles, flowerTiles);
    }

    // 2H. Rich Modern-Evo Environment Props: Market Stalls, Wagons, Windmills, Waterwheels, Multi-Tile Hedgerows & Streetlamps!
    this.populateRichEvoEnvironmentProps(g, zone, roadTiles, openGrassTiles);

    // 2I. Glowing Torch Braziers (with flickering PointLights & animated flames!)
    this.buildBraziers(g, brazierTiles);

    // 2J. Interactive Spring-Physics Rustling Shrubs
    this.buildShrubs(g, zone);

    // 2K. Sculpted 3D Inspectable Landmarks (Fountains, Statues, Wells, Signs, Crates, Tablets, Campfires)
    this.buildInspectables(g, zone);

    // 2L. Hinged 3D Treasure Chests
    this.buildChests(g, zone);

    // 2M. Glowing 3D Zone Gateway Archways
    this.buildPortals(g, zone);

    // 2N. Articulated 3D NPCs
    for (const npc of zone.npcs) {
      const rig = this.buildNpcRig(npc);
      g.add(rig.root);
      this.npcRigs.set(npc.id, rig);
    }

    // 2O. 560+ GPU Atmospheric Weather / Pollen / Snow / Ember Particles!
    this.atmospherePoints = createGpuAtmospherePoints(zone.theme, W, H, this.sharedUniforms);
    g.add(this.atmospherePoints);
  }

  // --------------------------------------------------------------------------
  // Multi-Level Town Terraces, Carved 3D Stone Staircases & Reinforced Anti-Slide Banks!
  // --------------------------------------------------------------------------
  private buildTownTerracesAndReinforcedBanks(
    g: THREE.Group,
    zone: ZoneDef,
    buildingCells: Set<string>
  ): void {
    const W = zone.width;
    const H = zone.height;
    const isTown = zone.theme === 'town' || zone.theme === 'village';
    const isOutdoor = isTown || zone.theme === 'plains' || zone.theme === 'ruins';
    if (!isOutdoor) return;

    const masonryMat = new THREE.MeshStandardMaterial({
      map: this.archTextures.cliffTerrace,
      color: '#cbd5e1',
      roughness: 0.84,
    });
    const stoneTrimMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.78 });
    const stairTreadMat = new THREE.MeshStandardMaterial({ color: '#d6d3cd', roughness: 0.72 });
    const timberMat = new THREE.MeshStandardMaterial({
      map: this.archTextures.plankWood,
      color: '#6b3e20',
      roughness: 0.86,
    });
    const lanternMat = new THREE.MeshStandardMaterial({
      color: '#fef08a',
      emissive: '#fbbf24',
      emissiveIntensity: 1.5,
    });

    // 1. Town Terrace Retaining Walls, Anti-Slide Buttresses, Timber Cribbing & Carved Stone Staircases!
    if (isTown) {
      const [lowStepZ, highStepZ] = this.getTownTerraceSteps(zone);
      const stepRows: Array<[number, number, number]> = [
        [lowStepZ, 0.0, 0.62],
        [highStepZ, 0.62, 1.24],
      ];

      const treadGeo = new THREE.BoxGeometry(1.04, 0.14, 0.24);
      const wallGeo = new THREE.BoxGeometry(1.04, 0.72, 0.34);
      const capGeo = new THREE.BoxGeometry(1.06, 0.12, 0.44);
      const buttressGeo = new THREE.BoxGeometry(0.32, 0.68, 0.48);
      const stakeGeo = new THREE.CylinderGeometry(0.065, 0.08, 0.84, 6);
      const logRailGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.04, 6);
      logRailGeo.rotateZ(Math.PI * 0.5);

      for (const [stepZ, lowY, highY] of stepRows) {
        if (stepZ < 3 || stepZ > H - 4) continue;
        const deltaH = highY - lowY;
        const isStairCol = (c: number) =>
          c >= 1 &&
          c < W - 1 &&
          !buildingCells.has(`${c},${stepZ}`) &&
          (zone.tiles[stepZ][c] === 6 ||
            zone.tiles[stepZ - 1]?.[c] === 6 ||
            zone.tiles[stepZ + 1]?.[c] === 6);

        for (let c = 1; c < W - 1; c++) {
          if (zone.tiles[stepZ][c] === 3 || buildingCells.has(`${c},${stepZ}`)) continue;

          if (isStairCol(c)) {
            // Carved 6-Step 3D Stone Staircase climbing cleanly from lowY to highY!
            const steps = 6;
            for (let s = 0; s < steps; s++) {
              const frac = (s + 0.5) / steps;
              const sy = lowY + frac * deltaH;
              const sz = stepZ + 0.56 - frac * 1.12;
              const tread = new THREE.Mesh(treadGeo, stairTreadMat);
              tread.position.set(c + 0.5, sy - 0.03, sz);
              tread.receiveShadow = true;
              tread.castShadow = !this.isSoftwareGl;
              g.add(tread);
            }
            // Stepped Stone Balustrades + Glowing Post Lanterns on Outer Stair Edges!
            if (!isStairCol(c - 1)) {
              const bal = new THREE.Mesh(new THREE.BoxGeometry(0.22, deltaH + 0.34, 1.24), stoneTrimMat);
              bal.position.set(c + 0.08, lowY + deltaH * 0.5 + 0.1, stepZ);
              bal.castShadow = !this.isSoftwareGl;
              const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.62, 0.28), stoneTrimMat);
              post.position.set(c + 0.08, highY + 0.28, stepZ - 0.56);
              const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), lanternMat);
              lamp.position.set(c + 0.08, highY + 0.68, stepZ - 0.56);
              g.add(bal, post, lamp);
            }
            if (!isStairCol(c + 1)) {
              const bal = new THREE.Mesh(new THREE.BoxGeometry(0.22, deltaH + 0.34, 1.24), stoneTrimMat);
              bal.position.set(c + 0.92, lowY + deltaH * 0.5 + 0.1, stepZ);
              bal.castShadow = !this.isSoftwareGl;
              const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.62, 0.28), stoneTrimMat);
              post.position.set(c + 0.92, highY + 0.28, stepZ - 0.56);
              const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), lanternMat);
              lamp.position.set(c + 0.92, highY + 0.68, stepZ - 0.56);
              g.add(bal, post, lamp);
            }
          } else {
            // Reinforced Cut-Stone Retaining Wall + Anti-Slide Buttresses + Timber Piling Cribbing!
            const wall = new THREE.Mesh(wallGeo, masonryMat);
            wall.position.set(c + 0.5, lowY + deltaH * 0.5, stepZ + 0.12);
            wall.castShadow = !this.isSoftwareGl;
            wall.receiveShadow = true;
            const cap = new THREE.Mesh(capGeo, stoneTrimMat);
            cap.position.set(c + 0.5, highY + 0.03, stepZ + 0.1);
            cap.receiveShadow = true;
            g.add(wall, cap);

            if (c % 2 === 0) {
              // Sloped Stone Anti-Slide Buttress Pier
              const pier = new THREE.Mesh(buttressGeo, stoneTrimMat);
              pier.position.set(c + 0.5, lowY + deltaH * 0.42, stepZ + 0.38);
              pier.rotation.x = 0.26;
              pier.castShadow = !this.isSoftwareGl;
              pier.receiveShadow = true;
              g.add(pier);
            } else {
              // Driven Timber Retaining Stakes + Horizontal Log Cribbing preventing soil slides!
              const stL = new THREE.Mesh(stakeGeo, timberMat);
              stL.position.set(c + 0.24, lowY + 0.34, stepZ + 0.38);
              stL.rotation.x = -0.14;
              const stR = new THREE.Mesh(stakeGeo, timberMat);
              stR.position.set(c + 0.76, lowY + 0.34, stepZ + 0.38);
              stR.rotation.x = -0.14;
              const log1 = new THREE.Mesh(logRailGeo, timberMat);
              log1.position.set(c + 0.5, lowY + 0.24, stepZ + 0.31);
              const log2 = new THREE.Mesh(logRailGeo, timberMat);
              log2.position.set(c + 0.5, lowY + 0.48, stepZ + 0.27);
              g.add(stL, stR, log1, log2);
            }
          }
        }
      }
    }

    // 2. Clean Reinforced Waterfront Quay Seawalls & Riverbank Cribbing (Flush with Waterline + Iron Mooring Bollards!)
    const bankPilings: Array<[number, number, number]> = [];
    const bankWalls: Array<[number, number, number, number]> = [];
    const bankCaps: Array<[number, number, number, number]> = [];
    const bollards: Array<[number, number, number]> = [];
    for (let r = 1; r < H - 1; r++) {
      for (let c = 1; c < W - 1; c++) {
        const t = zone.tiles[r][c];
        if (t === 3 || t === 4) continue;
        const gy = this.sampleGroundY(c + 0.5, r + 0.5);
        // Only build dressed quay seawalls on walkable land (not outer cliff walls!) bordering open water
        if (t === 1) continue;
        if (zone.tiles[r + 1]?.[c] === 3) {
          bankWalls.push([c + 0.5, gy - 0.28, r + 0.96, 0]);
          bankCaps.push([c + 0.5, gy + 0.04, r + 0.96, 0]);
          if (c % 2 === 0) bankPilings.push([c + 0.5, -0.22, r + 1.12]);
          if (isTown && c % 5 === 0) bollards.push([c + 0.5, gy + 0.16, r + 0.88]);
        }
        if (zone.tiles[r - 1]?.[c] === 3) {
          bankWalls.push([c + 0.5, gy - 0.28, r + 0.04, 0]);
          bankCaps.push([c + 0.5, gy + 0.04, r + 0.04, 0]);
          if (c % 2 === 0) bankPilings.push([c + 0.5, -0.22, r - 0.12]);
        }
        if (zone.tiles[r]?.[c + 1] === 3) {
          bankWalls.push([c + 0.96, gy - 0.28, r + 0.5, Math.PI * 0.5]);
          bankCaps.push([c + 0.96, gy + 0.04, r + 0.5, Math.PI * 0.5]);
          if (r % 2 === 0) bankPilings.push([c + 1.12, -0.22, r + 0.5]);
        }
        if (zone.tiles[r]?.[c - 1] === 3) {
          bankWalls.push([c + 0.04, gy - 0.28, r + 0.5, Math.PI * 0.5]);
          bankCaps.push([c + 0.04, gy + 0.04, r + 0.5, Math.PI * 0.5]);
          if (r % 2 === 0) bankPilings.push([c - 0.12, -0.22, r + 0.5]);
        }
      }
    }

    if (bankWalls.length > 0) {
      const bwInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1.04, 0.66, 0.24), masonryMat, bankWalls.length);
      bwInst.castShadow = !this.isSoftwareGl;
      bwInst.receiveShadow = true;
      const capInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1.06, 0.11, 0.32), stoneTrimMat, bankCaps.length);
      capInst.receiveShadow = true;
      bankWalls.forEach(([x, y, z, ry], i) => {
        _dummy.position.set(x, y, z);
        _dummy.rotation.set(0, ry, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        bwInst.setMatrixAt(i, _dummy.matrix);
      });
      bankCaps.forEach(([x, y, z, ry], i) => {
        _dummy.position.set(x, y, z);
        _dummy.rotation.set(0, ry, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        capInst.setMatrixAt(i, _dummy.matrix);
      });
      bwInst.computeBoundingSphere();
      capInst.computeBoundingSphere();
      g.add(bwInst, capInst);
    }

    if (bankPilings.length > 0) {
      const pInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.095, 0.92, 6), timberMat, bankPilings.length);
      pInst.castShadow = !this.isSoftwareGl;
      pInst.receiveShadow = true;
      bankPilings.forEach(([x, y, z], i) => {
        _dummy.position.set(x, y, z);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        pInst.setMatrixAt(i, _dummy.matrix);
      });
      pInst.computeBoundingSphere();
      g.add(pInst);
    }

    if (bollards.length > 0) {
      const ironMat = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.82, roughness: 0.34 });
      const bolInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.11, 0.13, 0.34, 8), ironMat, bollards.length);
      bolInst.castShadow = !this.isSoftwareGl;
      bollards.forEach(([x, y, z], i) => {
        _dummy.position.set(x, y, z);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        bolInst.setMatrixAt(i, _dummy.matrix);
      });
      bolInst.computeBoundingSphere();
      g.add(bolInst);
    }
  }

  private buildTreesAndColumns(g: THREE.Group, zone: ZoneDef, treeTiles: Array<[number, number, boolean]>): void {
    const theme = zone.theme;
    if (treeTiles.length === 0) return;

    if (theme === 'shrine' || theme === 'ruins') {
      const colMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.52, metalness: 0.08 });
      const capMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.42, metalness: 0.12 });
      const shaftInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.24, 0.28, 2.5, 10), colMat, treeTiles.length);
      const baseInst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.72, 0.28, 0.72), capMat, treeTiles.length);
      const topInst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.76, 0.24, 0.76), capMat, treeTiles.length);
      shaftInst.castShadow = !this.isSoftwareGl;
      shaftInst.receiveShadow = true;
      treeTiles.forEach(([c, r], i) => {
        const gy = this.sampleGroundY(c + 0.5, r + 0.72);
        _dummy.position.set(c + 0.5, gy + 1.25, r + 0.72);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        shaftInst.setMatrixAt(i, _dummy.matrix);
        _dummy.position.set(c + 0.5, gy + 0.14, r + 0.72);
        _dummy.updateMatrix();
        baseInst.setMatrixAt(i, _dummy.matrix);
        _dummy.position.set(c + 0.5, gy + 2.55, r + 0.72);
        _dummy.updateMatrix();
        topInst.setMatrixAt(i, _dummy.matrix);
      });
      shaftInst.computeBoundingSphere();
      baseInst.computeBoundingSphere();
      topInst.computeBoundingSphere();
      g.add(shaftInst, baseInst, topInst);
      return;
    }

    if (theme === 'ice') {
      const crystalMat = new THREE.MeshPhysicalMaterial({
        color: '#38bdf8',
        emissive: '#0284c7',
        emissiveIntensity: 0.28,
        roughness: 0.1,
        metalness: 0.15,
        clearcoat: 1.0,
        transparent: true,
        opacity: 0.86,
      });
      const spireInst = new THREE.InstancedMesh(new THREE.ConeGeometry(0.42, 2.75, 6), crystalMat, treeTiles.length);
      spireInst.castShadow = !this.isSoftwareGl;
      treeTiles.forEach(([c, r], i) => {
        const gy = this.sampleGroundY(c + 0.5, r + 0.72);
        const sc = 0.85 + hash2d(c, r, 511) * 0.35;
        _dummy.position.set(c + 0.5, gy + 1.35 * sc, r + 0.72);
        _dummy.rotation.set(0, hash2d(c, r, 512) * Math.PI, 0);
        _dummy.scale.set(sc, sc, sc);
        _dummy.updateMatrix();
        spireInst.setMatrixAt(i, _dummy.matrix);
      });
      spireInst.computeBoundingSphere();
      g.add(spireInst);
      return;
    }

    if (theme === 'tower' || theme === 'lava') {
      const obMat = new THREE.MeshStandardMaterial({ color: '#3b0764', metalness: 0.65, roughness: 0.28 });
      const bandMat = new THREE.MeshStandardMaterial({
        color: '#f43f5e',
        emissive: '#e11d48',
        emissiveIntensity: 1.6,
      });
      const obInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.24, 0.34, 2.7, 6), obMat, treeTiles.length);
      const bandInst = new THREE.InstancedMesh(new THREE.TorusGeometry(0.3, 0.06, 6, 12), bandMat, treeTiles.length);
      obInst.castShadow = !this.isSoftwareGl;
      treeTiles.forEach(([c, r], i) => {
        _dummy.position.set(c + 0.5, 1.35, r + 0.72);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        obInst.setMatrixAt(i, _dummy.matrix);
        _dummy.position.set(c + 0.5, 2.0, r + 0.72);
        _dummy.rotation.set(Math.PI * 0.5, 0, 0);
        _dummy.updateMatrix();
        bandInst.setMatrixAt(i, _dummy.matrix);
      });
      obInst.computeBoundingSphere();
      bandInst.computeBoundingSphere();
      g.add(obInst, bandInst);
      return;
    }

    // LUSH PIPOYA / RPG-JS MONUMENTAL MULTI-TILE TREES (4x4, 4x2, 2x4, 3x3, 3x2, 2x3, 2x2, 2x1, 1x2) + CYPRESS!
    const barkMat = new THREE.MeshStandardMaterial({ map: this.archTextures.bark, color: '#b58d63', roughness: 0.9 });
    const plinthMat = new THREE.MeshStandardMaterial({ color: '#248c36', roughness: 0.9 });

    const broadLeafMat = new THREE.MeshStandardMaterial({
      map: this.archTextures.leafPipoya,
      alphaTest: 0.42,
      side: THREE.DoubleSide,
      roughness: 0.7,
    });
    attachGpuFoliagePhysics(broadLeafMat, this.sharedUniforms, 0.09, 0.0);

    const cypressMat = new THREE.MeshStandardMaterial({
      map: this.archTextures.leafCypress,
      alphaTest: 0.42,
      side: THREE.DoubleSide,
      roughness: 0.72,
    });
    attachGpuFoliagePhysics(cypressMat, this.sharedUniforms, 0.075, 0.0);

    const volCoreMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 });
    attachGpuFoliagePhysics(volCoreMat, this.sharedUniforms, 0.065, 0.0);

    // Greedy 2D Multi-Tile Footprint Partitioner (groups contiguous tree tiles into 4x4..2x1 monumental groves!)
    const W = zone.width;
    const H = zone.height;
    const avail = new Uint8Array(W * H);
    const rodaTrees: Array<[number, number]> = [];
    for (const [c, r, isRoda] of treeTiles) {
      if (isRoda) rodaTrees.push([c, r]);
      else avail[r * W + c] = 1;
    }

    interface TreeGrove {
      c: number;
      r: number;
      w: number;
      h: number;
      isRoda: boolean;
    }
    const multiGroves: TreeGrove[] = [];
    const singleBroad: Array<[number, number, boolean]> = [];
    const cypressTrees: Array<[number, number]> = [];

    const shapes: Array<[number, number]> = [
      [4, 4],
      [4, 2],
      [2, 4],
      [3, 3],
      [3, 2],
      [2, 3],
      [2, 2],
      [2, 1],
      [1, 2],
    ];

    for (const [sw, sh] of shapes) {
      for (let r = 0; r <= H - sh; r++) {
        for (let c = 0; c <= W - sw; c++) {
          let fits = true;
          for (let dr = 0; dr < sh && fits; dr++) {
            for (let dc = 0; dc < sw; dc++) {
              if (!avail[(r + dr) * W + (c + dc)]) {
                fits = false;
                break;
              }
            }
          }
          if (!fits) continue;
          // Mark claimed & record monumental multi-tile tree grove!
          for (let dr = 0; dr < sh; dr++) {
            for (let dc = 0; dc < sw; dc++) {
              avail[(r + dr) * W + (c + dc)] = 0;
            }
          }
          multiGroves.push({ c, r, w: sw, h: sh, isRoda: false });
        }
      }
    }

    for (const [c, r] of rodaTrees) {
      multiGroves.push({ c: c - 1, r: r - 1, w: 3, h: 3, isRoda: true });
    }

    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        if (!avail[r * W + c]) continue;
        if ((c * 13 + r * 7) % 3 === 0) cypressTrees.push([c, r]);
        else singleBroad.push([c, r, false]);
      }
    }

    // Track canopy spawn anchors for tumbling 3D Falling Leaves!
    const leafSpawnSpots: Array<{ x: number; y: number; z: number; radX: number; radZ: number; color: string }> = [];

    // Vibrant sunlit emerald / jade / lime / autumn-gold botanical canopy palette!
    const grovePalette = ['#2ec445', '#1fa63a', '#4ad954', '#38b848', '#22943b', '#62d952'];

    // 1. MONUMENTAL MULTI-TILE ANCIENT TREES & GROVES (2x1, 1x2, 2x2, 3x2, 2x3, 3x3, 4x2, 2x4, 4x4!)
    const trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(-0.08, 0.52, 0.06),
      new THREE.Vector3(0.09, 1.08, -0.05),
      new THREE.Vector3(0.14, 1.62, 0.06),
    ]);
    const trunkGeo = new THREE.TubeGeometry(trunkCurve, 8, 0.18, 7, false);
    const branchCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.04, 1.0, 0),
      new THREE.Vector3(0.52, 1.38, 0.14),
      new THREE.Vector3(0.95, 1.56, 0.24),
    ]);
    const branchGeo = new THREE.TubeGeometry(branchCurve, 6, 0.08, 5, false);
    const rootCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.42, 0),
      new THREE.Vector3(0.36, 0.22, 0.14),
      new THREE.Vector3(0.68, -0.06, 0.22),
    ]);
    const rootGeo = new THREE.TubeGeometry(rootCurve, 5, 0.065, 5, false);
    const leafCardGeo = new THREE.PlaneGeometry(1.32, 1.32);
    const domeGeo = new THREE.IcosahedronGeometry(0.68, 1);

    for (const gr of multiGroves) {
      const cx = gr.c + gr.w * 0.5;
      const cz = gr.r + gr.h * 0.5;
      const gy = this.sampleGroundY(cx, cz);
      const avgSpan = (gr.w + gr.h) * 0.5;
      const scH = gr.isRoda ? 2.15 : 1.05 + avgSpan * 0.42;
      const rot = hash2d(gr.c, gr.r, 522) * Math.PI * 2;
      const isBlossom = theme === 'village' && (gr.c + gr.r) % 3 === 0;
      const baseHex = gr.isRoda
        ? '#eab308'
        : isBlossom
          ? '#f472b6'
          : grovePalette[Math.floor(hash2d(gr.c, gr.r, 523) * grovePalette.length)];

      const treeGrp = new THREE.Group();

      // Wide mossy boulder-and-root mound gripping the multi-tile earth footprint!
      const mound = new THREE.Mesh(new THREE.DodecahedronGeometry(0.56, 0), plinthMat);
      mound.position.y = 0.08;
      mound.scale.set(gr.w * 0.82, 0.34 * scH, gr.h * 0.82);
      mound.receiveShadow = true;
      treeGrp.add(mound);

      // Intertwined Multi-Trunk Architecture (1 massive grandfather trunk for square groves, 2-3 trunks for elongated 3x2 / 4x2 groves!)
      const trunkCount = gr.w >= 3 || gr.h >= 3 ? (gr.isRoda ? 1 : 2) : 1;
      for (let ti = 0; ti < trunkCount; ti++) {
        const offFrac = trunkCount === 1 ? 0 : ti === 0 ? -0.24 : 0.24;
        const ox = gr.w >= gr.h ? offFrac * gr.w : 0;
        const oz = gr.h > gr.w ? offFrac * gr.h : 0;
        const trk = new THREE.Mesh(trunkGeo, barkMat);
        trk.position.set(ox, 0, oz);
        trk.rotation.y = rot + ti * 1.8;
        const thick = (gr.isRoda ? 1.9 : 0.92 + avgSpan * 0.28) * (trunkCount > 1 ? 0.85 : 1);
        trk.scale.set(thick, scH, thick);
        trk.castShadow = !this.isSoftwareGl;
        trk.receiveShadow = true;
        treeGrp.add(trk);

        // 4 Flared Buttress Roots + 4 Spreading Cathedral Boughs per Trunk!
        for (let b = 0; b < 4; b++) {
          const ba = rot + b * (Math.PI * 0.5) + ti * 0.45;
          const bough = new THREE.Mesh(branchGeo, barkMat);
          bough.position.set(ox, 0, oz);
          bough.rotation.y = ba;
          bough.scale.set(gr.w * 0.56, scH * 0.95, gr.h * 0.56);
          bough.castShadow = !this.isSoftwareGl;
          treeGrp.add(bough);

          const rt = new THREE.Mesh(rootGeo, barkMat);
          rt.position.set(ox, 0, oz);
          rt.rotation.y = ba + 0.38;
          rt.scale.set(gr.w * 0.54, scH * 0.68, gr.h * 0.54);
          treeGrp.add(rt);
        }
      }

      // Lush Multi-Lobe Volumetric 3D Emerald Canopy Domes spanning the ENTIRE w x h footprint!
      const lobeCount = Math.min(9, Math.max(4, Math.round(gr.w * gr.h * 0.9) + 2));
      for (let l = 0; l < lobeCount; l++) {
        const isCrown = l === 0;
        const a = (l / Math.max(1, lobeCount - 1)) * Math.PI * 2 + rot;
        const rx = isCrown ? 0 : Math.cos(a) * gr.w * 0.36;
        const rz = isCrown ? 0 : Math.sin(a) * gr.h * 0.36;
        const ly = (isCrown ? 2.15 : 1.55 + (l % 2) * 0.36) * scH;
        const col = new THREE.Color(baseHex).offsetHSL(0, 0.05, isCrown ? 0.09 : (l % 3 - 1) * 0.06);
        if (gr.isRoda && !isCrown) col.set('#22c55e');
        const lobeMat = volCoreMat.clone();
        lobeMat.color.copy(col);
        const lobe = new THREE.Mesh(domeGeo, lobeMat);
        lobe.position.set(rx, ly, rz);
        const sx = (isCrown ? gr.w * 0.48 : 0.72 + avgSpan * 0.2) * (0.9 + hash2d(gr.c + l, gr.r, 561) * 0.25);
        const sz = (isCrown ? gr.h * 0.48 : 0.72 + avgSpan * 0.2) * (0.9 + hash2d(gr.c, gr.r + l, 562) * 0.25);
        lobe.scale.set(sx, (isCrown ? 0.85 : 0.66) * scH, sz);
        lobe.castShadow = !this.isSoftwareGl;
        lobe.receiveShadow = true;
        treeGrp.add(lobe);
      }

      // Dense Outward-Tilted GPU-Wind-Animated Botanical Leaf-Cluster Fronds around Canopy Crown!
      const cardCount = Math.min(18, Math.max(8, Math.round(avgSpan * 5)));
      const cardColMat = broadLeafMat.clone();
      cardColMat.color.set(baseHex);
      for (let k = 0; k < cardCount; k++) {
        const a = (k / cardCount) * Math.PI * 2 + rot;
        const layer = k % 2;
        const px = Math.cos(a) * gr.w * (layer === 0 ? 0.44 : 0.24);
        const pz = Math.sin(a) * gr.h * (layer === 0 ? 0.44 : 0.24);
        const py = (layer === 0 ? 1.68 : 2.25) * scH;
        const card = new THREE.Mesh(leafCardGeo, cardColMat);
        card.position.set(px, py, pz);
        card.rotation.set(layer === 0 ? 0.44 : 0.24, a + Math.PI * 0.5, (hash2d(k, gr.c, 533) - 0.5) * 0.35);
        const csc = (layer === 0 ? 1.05 : 0.92) * (0.8 + avgSpan * 0.22);
        card.scale.setScalar(csc);
        card.castShadow = !this.isSoftwareGl;
        card.receiveShadow = true;
        treeGrp.add(card);
      }

      treeGrp.position.set(cx, gy, cz);
      g.add(treeGrp);

      leafSpawnSpots.push({
        x: cx,
        y: gy + 1.9 * scH,
        z: cz,
        radX: gr.w * 0.52,
        radZ: gr.h * 0.52,
        color: isBlossom ? '#f9a8d4' : gr.isRoda ? '#fde047' : baseHex,
      });
    }

    // 2. INDIVIDUAL 1x1 BROADLEAF OAKS (for standalone park & border trees!)
    if (singleBroad.length > 0) {
      const trunkInst = new THREE.InstancedMesh(trunkGeo, barkMat, singleBroad.length);
      const boughInst = new THREE.InstancedMesh(branchGeo, barkMat, singleBroad.length * 3);
      const rootInst = new THREE.InstancedMesh(rootGeo, barkMat, singleBroad.length * 3);
      const moundInst = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.46, 0), plinthMat, singleBroad.length);
      const volCoreInst = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.56, 1), volCoreMat, singleBroad.length * 3);
      volCoreInst.castShadow = !this.isSoftwareGl;
      volCoreInst.receiveShadow = true;
      const cardsPerTree = 8;
      const cardInst = new THREE.InstancedMesh(leafCardGeo, broadLeafMat, singleBroad.length * cardsPerTree);
      trunkInst.castShadow = !this.isSoftwareGl;
      boughInst.castShadow = !this.isSoftwareGl;
      cardInst.castShadow = !this.isSoftwareGl;
      cardInst.receiveShadow = true;

      let boughIdx = 0;
      let rootIdx = 0;
      let coreIdx = 0;
      let cardIdx = 0;

      singleBroad.forEach(([c, r], i) => {
        const sc = 0.96 + hash2d(c, r, 521) * 0.34;
        const rot = hash2d(c, r, 522) * Math.PI * 2;
        const bx = c + 0.5;
        const bz = r + 0.65;
        const gy = this.sampleGroundY(bx, bz);

        _dummy.position.set(bx, gy + 0.06, bz);
        _dummy.rotation.set(0, rot, 0);
        _dummy.scale.set(sc * 1.1, 0.35 * sc, sc);
        _dummy.updateMatrix();
        moundInst.setMatrixAt(i, _dummy.matrix);

        _dummy.position.set(bx, gy, bz);
        _dummy.scale.set(sc, sc, sc);
        _dummy.updateMatrix();
        trunkInst.setMatrixAt(i, _dummy.matrix);

        for (let b = 0; b < 3; b++) {
          _dummy.position.set(bx, gy, bz);
          _dummy.rotation.set(0, rot + b * 2.094, 0);
          _dummy.scale.set(sc, sc, sc);
          _dummy.updateMatrix();
          boughInst.setMatrixAt(boughIdx++, _dummy.matrix);
          _dummy.rotation.set(0, rot + b * 2.094 + 0.55, 0);
          _dummy.updateMatrix();
          rootInst.setMatrixAt(rootIdx++, _dummy.matrix);
        }

        const isBlossom = theme === 'village' && (c + r) % 3 === 0;
        const baseHex = isBlossom
          ? '#f472b6'
          : grovePalette[Math.floor(hash2d(c, r, 523) * grovePalette.length)];

        const lobeOffsets: Array<[number, number, number, number]> = [
          [0, 1.98, 0, 1.15],
          [0.36, 1.62, 0.22, 0.92],
          [-0.34, 1.68, -0.2, 0.88],
        ];
        for (let l = 0; l < 3; l++) {
          const [lx, ly, lz, lsc] = lobeOffsets[l];
          const rx = lx * Math.cos(rot) - lz * Math.sin(rot);
          const rz = lx * Math.sin(rot) + lz * Math.cos(rot);
          _dummy.position.set(bx + rx * sc, gy + ly * sc, bz + rz * sc);
          _dummy.rotation.set(0, rot + l * 1.1, 0);
          _dummy.scale.set(lsc * sc, lsc * 0.78 * sc, lsc * sc);
          _dummy.updateMatrix();
          volCoreInst.setMatrixAt(coreIdx, _dummy.matrix);
          _color.set(baseHex).offsetHSL(0, 0.04, l === 0 ? 0.06 : -0.05);
          volCoreInst.setColorAt(coreIdx, _color);
          coreIdx++;
        }

        for (let k = 0; k < cardsPerTree; k++) {
          const ringA = (k / cardsPerTree) * Math.PI * 2 + rot;
          const layer = k < 5 ? 0 : 1;
          const rad = (layer === 0 ? 0.56 : 0.3) * sc;
          const cy = gy + (layer === 0 ? 1.56 : 2.08) * sc;
          _dummy.position.set(bx + Math.cos(ringA) * rad, cy, bz + Math.sin(ringA) * rad);
          _dummy.rotation.set(layer === 0 ? 0.42 : 0.24, ringA + Math.PI * 0.5, 0);
          const cardSc = (layer === 0 ? 1.0 : 0.84) * sc;
          _dummy.scale.set(cardSc, cardSc, cardSc);
          _dummy.updateMatrix();
          cardInst.setMatrixAt(cardIdx, _dummy.matrix);
          _color.set(baseHex).offsetHSL(0, 0.03, layer === 1 ? 0.08 : 0);
          cardInst.setColorAt(cardIdx, _color);
          cardIdx++;
        }

        leafSpawnSpots.push({
          x: bx,
          y: gy + 2.0 * sc,
          z: bz,
          radX: 0.75 * sc,
          radZ: 0.75 * sc,
          color: isBlossom ? '#f9a8d4' : baseHex,
        });
      });

      if (volCoreInst.instanceColor) volCoreInst.instanceColor.needsUpdate = true;
      if (cardInst.instanceColor) cardInst.instanceColor.needsUpdate = true;
      trunkInst.computeBoundingSphere();
      boughInst.computeBoundingSphere();
      rootInst.computeBoundingSphere();
      moundInst.computeBoundingSphere();
      volCoreInst.computeBoundingSphere();
      cardInst.computeBoundingSphere();
      g.add(moundInst, trunkInst, boughInst, rootInst, volCoreInst, cardInst);
    }

    // 3. TALL MEDITERRANEAN CYPRESS SPIRES (Vibrant Emerald/Pine/Gold Spires!)
    if (cypressTrees.length > 0) {
      const spireGeo = new THREE.PlaneGeometry(1.18, 3.25);
      spireGeo.translate(0, 1.62, 0);
      const coreGeo = new THREE.ConeGeometry(0.42, 2.95, 7);
      coreGeo.translate(0, 1.62, 0);
      const coreMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.82 });
      attachGpuFoliagePhysics(coreMat, this.sharedUniforms, 0.06, 0.0);
      const coreInst = new THREE.InstancedMesh(coreGeo, coreMat, cypressTrees.length);
      coreInst.castShadow = !this.isSoftwareGl;
      coreInst.receiveShadow = true;

      const planesPerCypress = 3;
      const cypInst = new THREE.InstancedMesh(spireGeo, cypressMat, cypressTrees.length * planesPerCypress);
      cypInst.castShadow = !this.isSoftwareGl;
      cypInst.receiveShadow = true;

      const cypressPalette = ['#2ec445', '#1d7a32', '#52db58', '#d4a024', '#3ab54a', '#268f3c'];
      let cIdx = 0;
      cypressTrees.forEach(([c, r], ci) => {
        const gy = this.sampleGroundY(c + 0.5, r + 0.65);
        const scH = 0.96 + hash2d(c, r, 551) * 0.44;
        const scW = 0.86 + hash2d(c, r, 552) * 0.28;
        const baseRot = hash2d(c, r, 553) * Math.PI;
        const hex = cypressPalette[Math.floor(hash2d(c, r, 554) * cypressPalette.length)];
        _dummy.position.set(c + 0.5, gy, r + 0.65);
        _dummy.rotation.set(0, baseRot, 0);
        _dummy.scale.set(scW, scH, scW);
        _dummy.updateMatrix();
        coreInst.setMatrixAt(ci, _dummy.matrix);
        coreInst.setColorAt(ci, _color.set(hex).offsetHSL(0, 0, -0.06));
        for (let p = 0; p < planesPerCypress; p++) {
          _dummy.position.set(c + 0.5, gy, r + 0.65);
          _dummy.rotation.set(0, baseRot + (p * Math.PI) / planesPerCypress, 0);
          _dummy.scale.set(scW, scH, scW);
          _dummy.updateMatrix();
          cypInst.setMatrixAt(cIdx, _dummy.matrix);
          _color.set(hex).offsetHSL(0, 0, (p - 1) * 0.04);
          cypInst.setColorAt(cIdx, _color);
          cIdx++;
        }
      });
      if (coreInst.instanceColor) coreInst.instanceColor.needsUpdate = true;
      if (cypInst.instanceColor) cypInst.instanceColor.needsUpdate = true;
      coreInst.computeBoundingSphere();
      cypInst.computeBoundingSphere();
      g.add(coreInst, cypInst);
    }

    // 4. ANIMATED 3D TUMBLING FALLING LEAVES & BLOSSOM PETALS DRIFTING FROM CANOPIES!
    if (leafSpawnSpots.length > 0) {
      const leafCount = this.isSoftwareGl ? 140 : 280;
      const leafGeo = new THREE.PlaneGeometry(0.18, 0.12);
      const leafMat = new THREE.MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.6,
        side: THREE.DoubleSide,
      });
      const leafInst = new THREE.InstancedMesh(leafGeo, leafMat, leafCount);
      this.fallingLeavesInst = leafInst;
      this.fallingLeaves = [];

      for (let i = 0; i < leafCount; i++) {
        const spot = leafSpawnSpots[Math.floor(hash2d(i, 1, 977) * leafSpawnSpots.length)];
        const ox = spot.x + (hash2d(i, 2, 977) - 0.5) * 2 * spot.radX;
        const oz = spot.z + (hash2d(i, 3, 977) - 0.5) * 2 * spot.radZ;
        const gy = this.sampleGroundY(ox, oz);
        this.fallingLeaves.push({
          ox,
          oy: spot.y + hash2d(i, 4, 977) * 0.8,
          oz,
          groundY: gy + 0.06,
          speed: 0.36 + hash2d(i, 5, 977) * 0.34,
          driftAmp: 0.42 + hash2d(i, 6, 977) * 0.55,
          freq: 1.4 + hash2d(i, 7, 977) * 1.4,
          phase: hash2d(i, 8, 977) * 20,
          spinSpeed: 2.2 + hash2d(i, 9, 977) * 3.0,
          scale: 0.8 + hash2d(i, 10, 977) * 0.65,
        });
        const cPick = hash2d(i, 11, 977);
        const leafHex =
          theme === 'village' && cPick > 0.45
            ? '#fbcfe8'
            : cPick > 0.82
              ? '#fde047'
              : cPick > 0.4
                ? '#4ade80'
                : spot.color;
        leafInst.setColorAt(i, _color.set(leafHex));
      }
      if (leafInst.instanceColor) leafInst.instanceColor.needsUpdate = true;
      g.add(leafInst);
    }
  }

  // --------------------------------------------------------------------------
  // 1100+ Lush Emerald GPU-Bending Grass Blades & Wildflower Tufts (Bends Around Adol!)
  // --------------------------------------------------------------------------
  private buildGpuBendingMeadowGrass(
    g: THREE.Group,
    theme: ZoneDef['theme'],
    openTiles: Array<[number, number]>,
    flowerTiles: Array<[number, number]>
  ): void {
    const grassCount = Math.min(1150, openTiles.length * 3);
    const bladeGeo = new THREE.ConeGeometry(0.072, 0.38, 3);
    bladeGeo.translate(0, 0.19, 0);
    const bladeMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.74 });
    attachGpuFoliagePhysics(bladeMat, this.sharedUniforms, 0.11, 0.46);

    const grassInst = new THREE.InstancedMesh(bladeGeo, bladeMat, grassCount);
    grassInst.receiveShadow = true;
    for (let i = 0; i < grassCount; i++) {
      const [c, r] = openTiles[Math.floor(hash2d(i, 1, 601) * openTiles.length)];
      const ox = hash2d(i, 2, 601) * 0.86 + 0.07;
      const oz = hash2d(i, 3, 601) * 0.86 + 0.07;
      const gy = this.sampleGroundY(c + ox, r + oz);
      const sc = 0.78 + hash2d(i, 4, 601) * 0.72;
      _dummy.position.set(c + ox, gy, r + oz);
      _dummy.rotation.set(0, hash2d(i, 5, 601) * Math.PI * 2, 0);
      _dummy.scale.set(sc, sc, sc);
      _dummy.updateMatrix();
      grassInst.setMatrixAt(i, _dummy.matrix);
      const t = hash2d(i, 6, 601);
      grassInst.setColorAt(
        i,
        _color.set(
          theme === 'plains'
            ? t < 0.33
              ? '#24b83c'
              : t < 0.68
                ? '#3ed64c'
                : '#64eb68'
            : t < 0.33
              ? '#1fb038'
              : t < 0.68
                ? '#36cf4a'
                : '#60e86a'
        )
      );
    }
    if (grassInst.instanceColor) grassInst.instanceColor.needsUpdate = true;
    grassInst.computeBoundingSphere();
    g.add(grassInst);

    if (flowerTiles.length > 0) {
      const flCount = Math.min(280, flowerTiles.length * 4);
      const flGeo = new THREE.OctahedronGeometry(0.082, 0);
      flGeo.translate(0, 0.25, 0);
      const flMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 });
      attachGpuFoliagePhysics(flMat, this.sharedUniforms, 0.1, 0.38);
      const flInst = new THREE.InstancedMesh(flGeo, flMat, flCount);
      for (let i = 0; i < flCount; i++) {
        const [c, r] = flowerTiles[i % flowerTiles.length];
        const fx = c + 0.15 + hash2d(i, 1, 619) * 0.7;
        const fz = r + 0.15 + hash2d(i, 2, 619) * 0.7;
        _dummy.position.set(fx, this.sampleGroundY(fx, fz), fz);
        _dummy.rotation.set(0, hash2d(i, 3, 619) * Math.PI, 0);
        _dummy.scale.setScalar(0.85 + hash2d(i, 4, 619) * 0.5);
        _dummy.updateMatrix();
        flInst.setMatrixAt(i, _dummy.matrix);
        flInst.setColorAt(i, _color.set(i % 3 === 0 ? '#fde047' : i % 3 === 1 ? '#f472b6' : '#ffffff'));
      }
      if (flInst.instanceColor) flInst.instanceColor.needsUpdate = true;
      flInst.computeBoundingSphere();
      g.add(flInst);
    }
  }

  // --------------------------------------------------------------------------
  // NEW Modern-Evo Environment Props: Market Stalls, Merchant Wagons, Street
  // Lanterns, GPU-Rippling Heraldic Banners, Mossy Boulders & Wooden Fences!
  // --------------------------------------------------------------------------
  private populateRichEvoEnvironmentProps(
    g: THREE.Group,
    zone: ZoneDef,
    roadTiles: Array<[number, number]>,
    openTiles: Array<[number, number]>
  ): void {
    const occupied = new Set<string>();
    const mark = (tx: number, ty: number) => occupied.add(`${tx},${ty}`);
    for (const n of zone.npcs) mark(n.tx, n.ty);
    for (const o of zone.inspectables) mark(o.tx, o.ty);
    for (const ch of zone.chests) mark(ch.tx, ch.ty);
    for (const sh of zone.shrubs) mark(sh.tx, sh.ty);
    for (const p of zone.portals) {
      for (let dy = -1; dy <= p.heightTiles; dy++) {
        for (let dx = -1; dx <= p.widthTiles; dx++) mark(p.tx + dx, p.ty + dy);
      }
    }

    // 1. GPU-Rippling Heraldic Pennant Banners flanking every Zone Portal!
    const bannerMat = new THREE.MeshStandardMaterial({
      color: zone.theme === 'tower' || zone.theme === 'lava' ? '#991b1b' : '#2563eb',
      roughness: 0.65,
      side: THREE.DoubleSide,
    });
    attachGpuClothWave(bannerMat, this.sharedUniforms);
    const poleMat = new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.78 });
    const finialMat = new THREE.MeshStandardMaterial({ color: '#facc15', metalness: 0.9, roughness: 0.2 });

    for (const p of zone.portals) {
      for (const side of [0, p.widthTiles]) {
        const bx = p.tx + side + (side === 0 ? -0.35 : 0.35);
        const bz = p.ty + p.heightTiles * 0.5;
        const bannerGroup = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.35, 6), poleMat);
        pole.position.y = 1.18;
        pole.castShadow = !this.isSoftwareGl;
        const finial = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), finialMat);
        finial.position.y = 2.4;
        const flagGeo = new THREE.PlaneGeometry(0.92, 0.44, 6, 2);
        flagGeo.translate(0.46, 0, 0);
        const flag = new THREE.Mesh(flagGeo, bannerMat);
        flag.position.set(0.02, 2.05, 0);
        flag.castShadow = !this.isSoftwareGl;
        bannerGroup.add(pole, finial, flag);
        bannerGroup.position.set(bx, this.sampleGroundY(bx, bz), bz);
        g.add(bannerGroup);
      }
    }

    // 2. Wrought-Iron Street Lantern Posts along Cobblestone Roads (Towns & Villages!)
    if (zone.theme === 'town' || zone.theme === 'village') {
      const ironMat = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.85, roughness: 0.32 });
      const glassMat = new THREE.MeshStandardMaterial({
        color: '#fef9c3',
        emissive: '#fbbf24',
        emissiveIntensity: 1.9,
        roughness: 0.12,
      });
      let lanternCount = 0;
      for (const [c, r] of roadTiles) {
        if (lanternCount >= 16) break;
        if ((c * 13 + r * 29) % 19 !== 0) continue;
        // Place neatly beside the road edge on adjacent grass tile
        const sideC = c + 1 < zone.width && zone.tiles[r][c + 1] === 0 ? c + 1 : c - 1;
        if (sideC < 2 || sideC >= zone.width - 2 || zone.tiles[r][sideC] !== 0 || occupied.has(`${sideC},${r}`)) continue;
        mark(sideC, r);
        lanternCount++;

        const post = new THREE.Group();
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 1.95, 6), ironMat);
        stem.position.y = 0.98;
        stem.castShadow = !this.isSoftwareGl;
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.05), ironMat);
        arm.position.set(sideC > c ? -0.14 : 0.14, 1.88, 0);
        const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), glassMat);
        lamp.position.set(sideC > c ? -0.28 : 0.28, 1.72, 0);
        post.add(stem, arm, lamp);
        post.position.set(sideC + 0.5, this.sampleGroundY(sideC + 0.5, r + 0.5), r + 0.5);
        g.add(post);
      }

      // 3. Covered Market Stalls & Spoked Wooden Merchant Wagons in Minea Town & Lance Village!
      const stallCountMax = 5;
      let stallsBuilt = 0;
      for (const [c, r] of openTiles) {
        if (stallsBuilt >= stallCountMax) break;
        if (c < 5 || c > zone.width - 6 || r < 5 || r > zone.height - 6) continue;
        if (occupied.has(`${c},${r}`) || occupied.has(`${c + 1},${r}`)) continue;
        // Prefer scenic open spots near a road!
        const nearRoad =
          zone.tiles[r + 1]?.[c] === 6 ||
          zone.tiles[r - 1]?.[c] === 6 ||
          zone.tiles[r]?.[c + 1] === 6 ||
          zone.tiles[r]?.[c - 1] === 6;
        if (!nearRoad || (c * 17 + r * 11) % 7 !== 0) continue;
        mark(c, r);
        mark(c + 1, r);

        if (stallsBuilt % 2 === 0) {
          this.addMarketStall(g, c + 0.5, r + 0.5, zone.theme === 'village' ? '#2563eb' : '#dc2626');
        } else {
          this.addMerchantWagon(g, c + 0.5, r + 0.5);
        }
        stallsBuilt++;
      }

      // 3B. Spinning 3D Town Windmill Landmark on the Upper Town Terrace!
      const millX = Math.max(4, Math.min(zone.width - 5, Math.round(zone.width * 0.84)));
      const millZ = Math.max(4, Math.min(zone.height - 8, Math.round(zone.height * 0.2)));
      const millGy = this.sampleGroundY(millX, millZ);
      const millGrp = new THREE.Group();
      const millStoneMat = new THREE.MeshStandardMaterial({ color: '#e2dcd0', roughness: 0.82 });
      const millWoodMat = new THREE.MeshStandardMaterial({ map: this.archTextures.plankWood, roughness: 0.8 });
      const millRoofMat = new THREE.MeshStandardMaterial({ map: this.archTextures.roofCobalt, roughness: 0.6 });
      const sailClothMat = new THREE.MeshStandardMaterial({ color: '#fef9c3', roughness: 0.72, side: THREE.DoubleSide });

      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1.38, 4.1, 10), millStoneMat);
      tower.position.y = 2.05;
      tower.castShadow = !this.isSoftwareGl;
      tower.receiveShadow = true;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(1.18, 1.35, 10), millRoofMat);
      cap.position.y = 4.65;
      cap.castShadow = !this.isSoftwareGl;
      const gallery = new THREE.Mesh(new THREE.CylinderGeometry(1.42, 1.38, 0.16, 10), millWoodMat);
      gallery.position.y = 1.45;
      millGrp.add(tower, cap, gallery);

      const hub = new THREE.Group();
      hub.position.set(0, 3.65, 1.05);
      const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.4, 8), millWoodMat);
      axle.rotation.x = Math.PI * 0.5;
      hub.add(axle);
      for (let i = 0; i < 4; i++) {
        const arm = new THREE.Group();
        arm.rotation.z = (i * Math.PI) / 2;
        const spar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.35, 0.1), millWoodMat);
        spar.position.y = 1.18;
        const sail = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.82), sailClothMat);
        sail.position.set(0.32, 1.34, 0.04);
        sail.rotation.y = 0.14;
        sail.castShadow = !this.isSoftwareGl;
        arm.add(spar, sail);
        hub.add(arm);
      }
      millGrp.add(hub);
      millGrp.position.set(millX, millGy, millZ);
      millGrp.rotation.y = Math.PI * 0.18;
      g.add(millGrp);
      this.spinners.push({ obj: hub, axis: 'z', speed: -0.92 });
    }

    // 3C. Multi-Tile Sprawling Flowering Hedgerows (2x1, 1x2, 2x2, 3x1) across Gardens & Clearings!
    if (zone.theme === 'town' || zone.theme === 'village' || zone.theme === 'plains' || zone.theme === 'ruins') {
      const hedgeLeafMat = new THREE.MeshStandardMaterial({
        map: this.archTextures.leafShrub,
        color: '#2ec947',
        alphaTest: 0.42,
        side: THREE.DoubleSide,
        roughness: 0.72,
      });
      attachGpuFoliagePhysics(hedgeLeafMat, this.sharedUniforms, 0.08, 0.32);
      const hedgeCoreMat = new THREE.MeshStandardMaterial({ color: '#24ad3c', roughness: 0.82 });
      attachGpuFoliagePhysics(hedgeCoreMat, this.sharedUniforms, 0.055, 0.22);
      const bloomCols = ['#f43f5e', '#fde047', '#f472b6', '#38bdf8', '#fb923c'];
      const hedgeShapes: Array<[number, number]> = [
        [3, 1],
        [2, 2],
        [2, 1],
        [1, 2],
      ];
      let hedgeBuilt = 0;
      for (let i = 0; i < openTiles.length && hedgeBuilt < 14; i += 19) {
        const [c, r] = openTiles[i];
        const [hw, hh] = hedgeShapes[hedgeBuilt % hedgeShapes.length];
        if (c < 3 || r < 3 || c + hw >= zone.width - 3 || r + hh >= zone.height - 3) continue;
        let clear = true;
        for (let dr = 0; dr < hh && clear; dr++) {
          for (let dc = 0; dc < hw; dc++) {
            const tx = c + dc;
            const ty = r + dr;
            if (zone.tiles[ty][tx] !== 0 || occupied.has(`${tx},${ty}`)) clear = false;
          }
        }
        if (!clear) continue;
        for (let dr = 0; dr < hh; dr++) {
          for (let dc = 0; dc < hw; dc++) mark(c + dc, r + dr);
        }
        hedgeBuilt++;

        const cx = c + hw * 0.5;
        const cz = r + hh * 0.5;
        const gy = this.sampleGroundY(cx, cz);
        const hGrp = new THREE.Group();
        const lobes = hw * hh + 2;
        const bloomMat = new THREE.MeshStandardMaterial({
          color: bloomCols[hedgeBuilt % bloomCols.length],
          roughness: 0.4,
        });
        for (let l = 0; l < lobes; l++) {
          const lx = (hash2d(c + l, r, 771) - 0.5) * (hw - 0.35);
          const lz = (hash2d(c, r + l, 772) - 0.5) * (hh - 0.35);
          const rad = 0.38 + hash2d(l, c + r, 773) * 0.18;
          const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(rad, 1), hedgeCoreMat);
          bush.position.set(lx, rad * 0.72, lz);
          bush.scale.set(1.2, 0.82, 1.15);
          bush.castShadow = !this.isSoftwareGl;
          bush.receiveShadow = true;
          hGrp.add(bush);

          const sprig = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.75), hedgeLeafMat);
          sprig.position.set(lx, 0.42, lz);
          sprig.rotation.y = hash2d(l, c, 774) * Math.PI;
          hGrp.add(sprig);

          const flower = new THREE.Mesh(new THREE.SphereGeometry(0.065, 6, 6), bloomMat);
          flower.position.set(lx + 0.14, rad * 1.15, lz + 0.1);
          hGrp.add(flower);
        }
        hGrp.position.set(cx, gy, cz);
        g.add(hGrp);
      }
    }

    // 4. Natural Mossy Boulders, Rocky Outcrops & Fallen Logs across Plains / Ruins / Ice!
    if (zone.theme === 'plains' || zone.theme === 'ruins' || zone.theme === 'ice' || zone.theme === 'town') {
      const rockPositions: Array<[number, number]> = [];
      for (let i = 0; i < openTiles.length && rockPositions.length < 28; i += 17) {
        const [c, r] = openTiles[i];
        if (occupied.has(`${c},${r}`)) continue;
        if (c < 3 || c > zone.width - 4 || r < 3 || r > zone.height - 4) continue;
        mark(c, r);
        rockPositions.push([c, r]);
      }
      if (rockPositions.length > 0) {
        const rockMat = new THREE.MeshStandardMaterial({
          color: zone.theme === 'ice' ? '#7dd3fc' : '#7a7568',
          roughness: zone.theme === 'ice' ? 0.25 : 0.9,
        });
        const rockInst = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.28, 0), rockMat, rockPositions.length);
        rockInst.castShadow = !this.isSoftwareGl;
        rockInst.receiveShadow = true;
        rockPositions.forEach(([c, r], i) => {
          const sx = 0.75 + hash2d(c, r, 701) * 0.85;
          const sy = 0.5 + hash2d(c, r, 702) * 0.5;
          const gy = this.sampleGroundY(c + 0.5, r + 0.5);
          _dummy.position.set(c + 0.5, gy + 0.14 * sy, r + 0.5);
          _dummy.rotation.set(hash2d(c, r, 703), hash2d(c, r, 704), 0);
          _dummy.scale.set(sx, sy, sx * 0.9);
          _dummy.updateMatrix();
          rockInst.setMatrixAt(i, _dummy.matrix);
        });
        rockInst.computeBoundingSphere();
        g.add(rockInst);
      }
    }

    // 5. Wooden Picket Fences & Stone Garden Edging in Towns & Villages!
    if (zone.theme === 'town' || zone.theme === 'village') {
      const fenceWoodMat = new THREE.MeshStandardMaterial({ map: this.textures.wood, roughness: 0.86 });
      let fenceCount = 0;
      for (let i = 0; i < openTiles.length && fenceCount < 10; i += 23) {
        const [c, r] = openTiles[i];
        if (c < 4 || c > zone.width - 5 || r < 4 || r > zone.height - 5) continue;
        if (occupied.has(`${c},${r}`)) continue;
        // Place neatly beside a cottage wall (tile 1) or roof (tile 5) without blocking roads
        const nearBuilding =
          zone.tiles[r - 1]?.[c] === 1 ||
          zone.tiles[r + 1]?.[c] === 1 ||
          zone.tiles[r]?.[c - 1] === 1 ||
          zone.tiles[r]?.[c + 1] === 1;
        if (!nearBuilding) continue;
        mark(c, r);
        fenceCount++;
        const fence = new THREE.Group();
        const railTop = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.06, 0.05), fenceWoodMat);
        railTop.position.set(0, 0.42, 0);
        const railBot = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.06, 0.05), fenceWoodMat);
        railBot.position.set(0, 0.18, 0);
        fence.add(railTop, railBot);
        for (const px of [-0.36, -0.12, 0.12, 0.36]) {
          const picket = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.56, 0.06), fenceWoodMat);
          picket.position.set(px, 0.28, 0);
          picket.castShadow = !this.isSoftwareGl;
          fence.add(picket);
        }
        fence.position.set(c + 0.5, this.sampleGroundY(c + 0.5, r + 0.5), r + 0.5);
        g.add(fence);
      }

      // 6. Moored 3D Wooden Rowboats & Timber Dock Pilings bobbing along Water Shorelines!
      const boatWoodMat = new THREE.MeshStandardMaterial({ map: this.textures.wood, roughness: 0.8 });
      const pilingMat = new THREE.MeshStandardMaterial({ map: this.textures.bark, roughness: 0.9 });
      let boatsBuilt = 0;
      for (let r = 2; r < zone.height - 2 && boatsBuilt < 4; r += 3) {
        for (let c = 2; c < zone.width - 2 && boatsBuilt < 4; c += 4) {
          if (zone.tiles[r][c] !== 3) continue;
          const touchesLand =
            zone.tiles[r - 1]?.[c] === 0 ||
            zone.tiles[r + 1]?.[c] === 0 ||
            zone.tiles[r]?.[c - 1] === 0 ||
            zone.tiles[r]?.[c + 1] === 0;
          if (!touchesLand) continue;

          // Timber mooring piling beside shoreline
          const piling = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.92, 7), pilingMat);
          piling.position.set(c + 0.15, 0.18, r + 0.2);
          piling.castShadow = !this.isSoftwareGl;
          g.add(piling);

          // Composite 3D wooden skiff hull + bench + oars
          const boat = new THREE.Group();
          const hull = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.52), boatWoodMat);
          hull.castShadow = !this.isSoftwareGl;
          const bow = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.38, 4), boatWoodMat);
          bow.rotation.z = -Math.PI * 0.5;
          bow.rotation.x = Math.PI * 0.25;
          bow.position.set(0.68, 0.02, 0);
          const bench = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.48), boatWoodMat);
          bench.position.set(0, 0.12, 0);
          boat.add(hull, bow, bench);
          boat.position.set(c + 0.55, -0.05, r + 0.55);
          boat.rotation.y = (boatsBuilt % 2 === 0 ? 0.35 : -0.45);
          g.add(boat);
          this.floatingBoats.push({ group: boat, baseY: -0.05, phase: boatsBuilt * 1.7 });

          // Add a spinning 3D wooden riverside waterwheel beside the first waterfront landing!
          if (boatsBuilt === 0) {
            const wwGrp = new THREE.Group();
            const wwStand = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.9, 0.55), pilingMat);
            wwStand.position.set(-0.32, 0.28, 0);
            wwStand.castShadow = !this.isSoftwareGl;
            const wheelHub = new THREE.Group();
            wheelHub.position.set(0.08, 0.52, 0);
            const rim = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.06, 7, 16), boatWoodMat);
            rim.rotation.y = Math.PI * 0.5;
            wheelHub.add(rim);
            for (let p = 0; p < 8; p++) {
              const pa = (p / 8) * Math.PI * 2;
              const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.12, 0.06), boatWoodMat);
              spoke.rotation.x = pa;
              const paddle = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.05), boatWoodMat);
              paddle.position.set(0, Math.cos(pa) * 0.58, Math.sin(pa) * 0.58);
              paddle.rotation.x = pa;
              wheelHub.add(spoke, paddle);
            }
            wwGrp.add(wwStand, wheelHub);
            wwGrp.position.set(c + 0.2, -0.04, r + 0.8);
            g.add(wwGrp);
            this.spinners.push({ obj: wheelHub, axis: 'x', speed: 1.65 });
          }

          boatsBuilt++;
        }
      }
    }

    // 7. Fluttering 3D Luminous Butterflies (Meadows/Towns) & Arcane Wisps (Shrines/Ruins)!
    const wildCount = Math.min(12, Math.floor(openTiles.length / 25));
    const wingGeo = new THREE.PlaneGeometry(0.16, 0.12);
    for (let i = 0; i < wildCount; i++) {
      const [c, r] = openTiles[Math.floor(hash2d(i, 9, 809) * openTiles.length)];
      const col =
        zone.theme === 'shrine' || zone.theme === 'tower'
          ? '#38bdf8'
          : zone.theme === 'lava'
            ? '#fb923c'
            : i % 3 === 0
              ? '#fde047'
              : i % 3 === 1
                ? '#f472b6'
                : '#7dd3fc';
      const wMat = new THREE.MeshBasicMaterial({
        color: col,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
      });
      const grp = new THREE.Group();
      const wL = new THREE.Mesh(wingGeo, wMat);
      wL.position.x = -0.08;
      const wR = new THREE.Mesh(wingGeo, wMat);
      wR.position.x = 0.08;
      grp.add(wL, wR);
      const wgy = this.sampleGroundY(c + 0.5, r + 0.5);
      grp.position.set(c + 0.5, wgy + 0.95, r + 0.5);
      g.add(grp);
      this.wildlifeRigs.push({
        group: grp,
        wingL: wL,
        wingR: wR,
        anchorX: c + 0.5,
        anchorZ: r + 0.5,
        radius: 0.8 + hash2d(i, 2, 811) * 1.1,
        speed: 0.7 + hash2d(i, 3, 811) * 0.75,
        phase: hash2d(i, 4, 811) * Math.PI * 2,
      });
    }
  }

  private addMarketStall(g: THREE.Group, x: number, z: number, awningColor: string): void {
    const stall = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ map: this.textures.wood, roughness: 0.82 });
    const awningMat = new THREE.MeshStandardMaterial({ color: awningColor, roughness: 0.65 });
    const creamMat = new THREE.MeshStandardMaterial({ color: '#fef3c7', roughness: 0.7 });

    // Counter base
    const counter = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.52, 0.55), woodMat);
    counter.position.set(0, 0.26, 0);
    counter.castShadow = !this.isSoftwareGl;
    counter.receiveShadow = true;
    stall.add(counter);

    // 4 Support Posts
    const postGeo = new THREE.CylinderGeometry(0.035, 0.04, 1.35, 6);
    for (const px of [-0.52, 0.52]) {
      for (const pz of [-0.22, 0.22]) {
        const post = new THREE.Mesh(postGeo, woodMat);
        post.position.set(px, 0.68, pz);
        stall.add(post);
      }
    }

    // Sloped Striped Canvas Awning
    const awning = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 0.78), awningMat);
    awning.position.set(0, 1.36, 0);
    awning.rotation.x = 0.22;
    awning.castShadow = !this.isSoftwareGl;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.09, 0.79), creamMat);
    stripe.position.set(0, 1.36, 0);
    stripe.rotation.x = 0.22;
    stall.add(awning, stripe);

    // Fruit & Potion Goods on Counter
    const appleMat = new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.35 });
    const potionMat = new THREE.MeshStandardMaterial({ color: '#38bdf8', emissive: '#0284c7', emissiveIntensity: 0.6 });
    for (let i = 0; i < 3; i++) {
      const item = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), i === 2 ? potionMat : appleMat);
      item.position.set(-0.3 + i * 0.28, 0.58, 0);
      stall.add(item);
    }

    stall.position.set(x, this.sampleGroundY(x, z), z);
    g.add(stall);
  }

  private addMerchantWagon(g: THREE.Group, x: number, z: number): void {
    const wagon = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ map: this.textures.wood, roughness: 0.85 });
    const canvasMat = new THREE.MeshStandardMaterial({ color: '#f5ecd9', roughness: 0.75 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.8 });

    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.36, 0.66), woodMat);
    bed.position.y = 0.46;
    bed.castShadow = !this.isSoftwareGl;
    const canopy = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 1.15, 10, 1, false, 0, Math.PI),
      canvasMat
    );
    canopy.rotation.z = Math.PI * 0.5;
    canopy.rotation.y = Math.PI * 0.5;
    canopy.position.y = 0.64;
    canopy.castShadow = !this.isSoftwareGl;
    wagon.add(bed, canopy);

    const wheelGeo = new THREE.TorusGeometry(0.22, 0.045, 6, 12);
    for (const wx of [-0.38, 0.38]) {
      for (const wz of [-0.36, 0.36]) {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.position.set(wx, 0.24, wz);
        wagon.add(w);
      }
    }

    wagon.position.set(x, this.sampleGroundY(x, z), z);
    wagon.rotation.y = 0.25;
    g.add(wagon);
  }

  private buildBraziers(g: THREE.Group, brazierTiles: Array<[number, number]>): void {
    const ironMat = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.82, roughness: 0.34 });
    const flameMat = new THREE.MeshBasicMaterial({ color: '#facc15' });
    const emberMat = new THREE.MeshBasicMaterial({ color: '#f97316' });

    brazierTiles.forEach(([c, r], idx) => {
      const gy = this.sampleGroundY(c + 0.5, r + 0.5);
      const b = new THREE.Group();
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 0.68, 8), ironMat);
      stand.position.y = 0.34;
      stand.castShadow = !this.isSoftwareGl;
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.14, 0.2, 8), ironMat);
      bowl.position.y = 0.72;
      const flame = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), idx % 2 === 0 ? flameMat : emberMat);
      flame.position.y = 0.94;
      b.add(stand, bowl, flame);
      b.position.set(c + 0.5, gy, r + 0.5);
      g.add(b);
      this.fireFlames.push(flame);

      // Add up to 4 real flickering PointLights for rich dungeon/plaza lighting!
      if (this.brazierLights.length < 4) {
        const pl = new THREE.PointLight('#fb923c', 3.2, 8.5, 1.8);
        pl.position.set(c + 0.5, gy + 1.35, r + 0.5);
        g.add(pl);
        this.brazierLights.push(pl);
      }
    });
  }

  private buildShrubs(g: THREE.Group, zone: ZoneDef): void {
    const colorMap: Record<string, [string, string]> = {
      berry: ['#2ec445', '#ef4444'],
      fern: ['#22b548', '#86efac'],
      blossom: ['#38d14f', '#f472b6'],
      frost_bush: ['#38bdf8', '#e0f2fe'],
      ember_fern: ['#b45309', '#fb923c'],
    };

    const sprigGeo = new THREE.PlaneGeometry(0.98, 0.84);
    sprigGeo.translate(0, 0.38, 0);
    const coreGeo = new THREE.IcosahedronGeometry(0.32, 1);
    const moundGeo = new THREE.CylinderGeometry(0.34, 0.45, 0.14, 7);
    const moundMat = new THREE.MeshStandardMaterial({ color: '#3b572c', roughness: 0.92 });

    for (const sh of zone.shrubs) {
      const [leafCol, dotCol] = colorMap[sh.variant] ?? ['#2ec445', '#fde047'];
      const grp = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({
        map: this.archTextures.leafShrub,
        color: leafCol,
        alphaTest: 0.42,
        side: THREE.DoubleSide,
        roughness: 0.72,
      });
      attachGpuFoliagePhysics(mat, this.sharedUniforms, 0.085, 0.32);

      const coreMat = new THREE.MeshStandardMaterial({
        color: leafCol,
        roughness: 0.84,
      });
      attachGpuFoliagePhysics(coreMat, this.sharedUniforms, 0.055, 0.22);

      // Mossy earth root cushion
      const mound = new THREE.Mesh(moundGeo, moundMat);
      mound.position.y = 0.05;
      mound.receiveShadow = true;
      grp.add(mound);

      // Volumetric 3D bush heart for lush depth from 45° isometric view
      const bushHeart = new THREE.Mesh(coreGeo, coreMat);
      bushHeart.position.y = 0.28;
      bushHeart.scale.set(1.25, 0.86, 1.25);
      bushHeart.castShadow = !this.isSoftwareGl;
      bushHeart.receiveShadow = true;
      grp.add(bushHeart);

      // 6 Radial Crossed & Tilted Alpha-Tested Botanical Bush Sprig Cards!
      for (let i = 0; i < 6; i++) {
        const card = new THREE.Mesh(sprigGeo, mat);
        const a = (i / 6) * Math.PI * 2 + hash2d(sh.tx, sh.ty + i, 641) * 0.4;
        card.rotation.y = a;
        card.rotation.x = i < 3 ? 0.16 : -0.22;
        card.position.set(Math.cos(a) * 0.12, 0.04, Math.sin(a) * 0.12);
        card.scale.setScalar(0.88 + hash2d(sh.tx + i, sh.ty, 642) * 0.3);
        card.castShadow = !this.isSoftwareGl;
        card.receiveShadow = true;
        grp.add(card);
      }

      // Decorative berries/blossoms perched inside the leaf fronds
      const berryMat = new THREE.MeshStandardMaterial({ color: dotCol, roughness: 0.35 });
      for (let i = 0; i < 5; i++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), berryMat);
        b.position.set(Math.cos(i * 1.35) * 0.28, 0.34 + (i % 2) * 0.15, Math.sin(i * 1.35) * 0.28);
        grp.add(b);
      }

      const sparkle = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.08, 0),
        new THREE.MeshBasicMaterial({ color: '#fef08a' })
      );
      sparkle.position.y = 0.86;
      sparkle.visible = !sh.searched && sh.hiddenKind !== 'nothing';
      grp.add(sparkle);

      const gy = this.sampleGroundY(sh.tx + 0.5, sh.ty + 0.5);
      grp.position.set(sh.tx + 0.5, gy, sh.ty + 0.5);
      g.add(grp);
      this.shrubRigs.push({ id: sh.id, group: grp, sparkle, tx: sh.tx, ty: sh.ty });
    }
  }

  private buildInspectables(g: THREE.Group, zone: ZoneDef): void {
    const stoneMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.55 });
    const darkStoneMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.72 });
    const woodMat = new THREE.MeshStandardMaterial({ map: this.textures.wood, roughness: 0.8 });

    for (const obj of zone.inspectables) {
      const grp = new THREE.Group();
      if (obj.kind === 'fountain') {
        const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1.0, 0.36, 16), stoneMat);
        basin.position.y = 0.18;
        basin.castShadow = !this.isSoftwareGl;
        basin.receiveShadow = true;
        const pool = new THREE.Mesh(
          new THREE.CylinderGeometry(0.8, 0.8, 0.08, 16),
          new THREE.MeshPhysicalMaterial({ color: '#0ea5e9', roughness: 0.08, clearcoat: 1 })
        );
        pool.position.y = 0.34;
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 1.05, 10), stoneMat);
        pillar.position.y = 0.72;
        const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.16, 0.2, 12), stoneMat);
        bowl.position.y = 1.15;
        const jet = new THREE.Mesh(
          new THREE.ConeGeometry(0.18, 0.58, 10),
          new THREE.MeshBasicMaterial({ color: '#bae6fd', transparent: true, opacity: 0.82 })
        );
        jet.position.y = 1.48;
        this.fountainJets.push(jet);
        grp.add(basin, pool, pillar, bowl, jet);
      } else if (obj.kind === 'statue' || obj.kind === 'pedestal') {
        const ped = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.36, 0.68), darkStoneMat);
        ped.position.y = 0.18;
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 0.95, 10), stoneMat);
        body.position.y = 0.82;
        body.castShadow = !this.isSoftwareGl;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), stoneMat);
        head.position.y = 1.42;
        const wings = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.42, 0.08), stoneMat);
        wings.position.set(0, 1.05, -0.14);
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.48, 0.03, 8, 24),
          new THREE.MeshBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.75 })
        );
        ring.position.y = 0.95;
        this.statueRings.push(ring);
        grp.add(ped, body, head, wings, ring);
      } else if (obj.kind === 'well') {
        const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.52, 0.54, 12), darkStoneMat);
        rim.position.y = 0.27;
        rim.castShadow = !this.isSoftwareGl;
        const water = new THREE.Mesh(
          new THREE.CylinderGeometry(0.36, 0.36, 0.05, 12),
          new THREE.MeshStandardMaterial({ color: '#0284c7', roughness: 0.12 })
        );
        water.position.y = 0.48;
        const pL = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 6), woodMat);
        pL.position.set(-0.38, 0.95, 0);
        const pR = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 6), woodMat);
        pR.position.set(0.38, 0.95, 0);
        const roof = new THREE.Mesh(
          new THREE.ConeGeometry(0.68, 0.48, 4),
          new THREE.MeshStandardMaterial({ map: this.textures.roof_red, roughness: 0.7 })
        );
        roof.rotation.y = Math.PI * 0.25;
        roof.position.y = 1.62;
        roof.castShadow = !this.isSoftwareGl;
        grp.add(rim, water, pL, pR, roof);
      } else if (obj.kind === 'sign') {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.85, 6), woodMat);
        post.position.y = 0.42;
        const board = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.42, 0.09), woodMat);
        board.position.y = 0.92;
        board.castShadow = !this.isSoftwareGl;
        grp.add(post, board);
      } else if (obj.kind === 'crates') {
        const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.52, 0.52), woodMat);
        c1.position.set(-0.18, 0.26, -0.06);
        c1.castShadow = !this.isSoftwareGl;
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.56, 10), woodMat);
        barrel.position.set(0.24, 0.28, 0.14);
        barrel.castShadow = !this.isSoftwareGl;
        grp.add(c1, barrel);
      } else if (obj.kind === 'campfire') {
        for (let i = 0; i < 3; i++) {
          const log = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.56, 6), woodMat);
          log.rotation.z = Math.PI * 0.5;
          log.rotation.y = (i * Math.PI) / 3;
          log.position.y = 0.08;
          grp.add(log);
        }
        const flame = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.22, 0),
          new THREE.MeshBasicMaterial({ color: '#f97316' })
        );
        flame.position.y = 0.34;
        this.fireFlames.push(flame);
        grp.add(flame);
      } else {
        // Glowing Ancient Rune Tablet / Roda Altar / Cell Door
        const slab = new THREE.Mesh(new THREE.BoxGeometry(0.68, 1.15, 0.22), darkStoneMat);
        slab.position.y = 0.58;
        slab.castShadow = !this.isSoftwareGl;
        const rune = new THREE.Mesh(
          new THREE.BoxGeometry(0.42, 0.62, 0.24),
          new THREE.MeshStandardMaterial({ color: '#38bdf8', emissive: '#0284c7', emissiveIntensity: 1.5 })
        );
        rune.position.y = 0.64;
        grp.add(slab, rune);
      }

      grp.position.set(obj.tx + 0.5, this.sampleGroundY(obj.tx + 0.5, obj.ty + 0.5), obj.ty + 0.5);
      g.add(grp);
    }
  }

  private buildChests(g: THREE.Group, zone: ZoneDef): void {
    const woodMat = new THREE.MeshStandardMaterial({ map: this.textures.wood, roughness: 0.72 });
    const goldMat = new THREE.MeshStandardMaterial({ color: '#facc15', metalness: 0.92, roughness: 0.18 });

    for (const ch of zone.chests) {
      const grp = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.34, 0.46), woodMat);
      base.position.y = 0.17;
      base.castShadow = !this.isSoftwareGl;
      const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.08), goldMat);
      clasp.position.set(0, 0.28, 0.24);
      grp.add(base, clasp);

      const lidPivot = new THREE.Group();
      lidPivot.position.set(0, 0.34, -0.23);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.2, 0.48), woodMat);
      lid.position.set(0, 0.1, 0.23);
      lid.castShadow = !this.isSoftwareGl;
      const trim = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.5), goldMat);
      trim.position.set(0, 0.02, 0.23);
      lidPivot.add(lid, trim);
      grp.add(lidPivot);

      const glowLight = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.12, 0),
        new THREE.MeshBasicMaterial({ color: '#fde047', transparent: true, opacity: 0.85 })
      );
      glowLight.position.y = 0.72;
      grp.add(glowLight);

      grp.position.set(ch.tx + 0.5, this.sampleGroundY(ch.tx + 0.5, ch.ty + 0.5), ch.ty + 0.5);
      g.add(grp);
      this.chestRigs.push({ id: ch.id, lidPivot, glowLight });
    }
  }

  private buildPortals(g: THREE.Group, zone: ZoneDef): void {
    const pillarMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.3, roughness: 0.45 });
    for (const p of zone.portals) {
      const cx = p.tx + p.widthTiles * 0.5;
      const cz = p.ty + p.heightTiles * 0.5;
      const gy = this.sampleGroundY(cx, cz);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.88, 24),
        new THREE.MeshBasicMaterial({
          color: '#38bdf8',
          transparent: true,
          opacity: 0.65,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      ring.rotation.x = -Math.PI * 0.5;
      ring.position.set(cx, gy + 0.08, cz);
      g.add(ring);

      const pillarGlows: THREE.Mesh[] = [];
      for (const side of [-1, 1]) {
        const px = cx + side * (p.widthTiles * 0.5 + 0.15);
        const pgy = this.sampleGroundY(px, cz);
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 1.55, 8), pillarMat);
        col.position.set(px, pgy + 0.78, cz);
        col.castShadow = !this.isSoftwareGl;
        const orb = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.18, 0),
          new THREE.MeshBasicMaterial({ color: '#38bdf8' })
        );
        orb.position.set(px, pgy + 1.72, cz);
        g.add(col, orb);
        pillarGlows.push(orb);
      }
      this.portalRigs.push({ ring, pillarGlows, requiredFlag: p.requiredFlag });
    }
  }

  private clearZoneScene(): void {
    if (this.zoneGroup) {
      this.zoneGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material?.dispose();
        }
      });
      this.scene.remove(this.zoneGroup);
      this.zoneGroup = null;
    }
    this.activeZone = null;
    this.atmospherePoints = null;
    this.fallingLeavesInst = null;
    this.fallingLeaves = [];
    this.chimneySmokes = [];
    this.spinners = [];
    this.brazierLights.length = 0;
    this.npcRigs.clear();
    this.chestRigs = [];
    this.shrubRigs = [];
    this.portalRigs = [];
    this.fountainJets = [];
    this.statueRings = [];
    this.fireFlames = [];
    this.floatingBoats = [];
    this.wildlifeRigs = [];
    for (const tex of this.zoneOwnedTextures) tex.dispose();
    this.zoneOwnedTextures = [];
    for (const rig of this.enemyRigs.values()) {
      rig.spriteTex.dispose();
      rig.spriteMat.dispose();
      this.scene.remove(rig.root);
    }
    this.enemyRigs.clear();
  }

  // --------------------------------------------------------------------------
  // Frame Render: Sync Physics State, GPU Uniforms, Camera & WebGL Draw!
  // --------------------------------------------------------------------------
  public renderFrame(state: YsThreeRenderState): void {
    if (this.disposed) return;
    const { zone, time } = state;
    if (this.currentZoneId !== zone.id) {
      this.rebuildZoneScene(zone);
    }

    const px3 = state.px / YS_WORLD_TILE;
    const pz3 = state.py / YS_WORLD_TILE;
    const camX3 = state.camX / YS_WORLD_TILE;
    const camZ3 = state.camY / YS_WORLD_TILE;
    const isDungeon = zone.theme === 'shrine' || zone.theme === 'tower' || zone.theme === 'lava';
    const yaw = state.cameraYaw ?? Math.PI * 0.25;
    const zoomMode = state.cameraZoomMode ?? 'evo45';

    // Update GPU Shader Physics Uniforms!
    const adolGroundY = this.sampleGroundY(px3, pz3);
    this.sharedUniforms.uTime.value = time;
    this.sharedUniforms.uPlayerPos.value.set(px3, adolGroundY, pz3);

    // True 45° Rotated 2.5D Isometric Evo Diorama Camera (Evo 45° / Wide 45° / Full-Map 45° Vista!)
    let targetX = camX3;
    let targetZ = camZ3;
    let dist = 26.5;
    let elev = 0.64; // ~36.7° classic isometric 2.5D tilt showing walls + roofs + terrain depth!
    if (zoomMode === 'wide45') {
      dist = 40.0;
      elev = 0.69;
    } else if (zoomMode === 'fullmap45') {
      const span = Math.max(zone.width, zone.height);
      dist = span * 1.18 + 10;
      elev = 0.74;
      targetX = THREE.MathUtils.lerp(zone.width * 0.5, px3, 0.22);
      targetZ = THREE.MathUtils.lerp(zone.height * 0.5, pz3, 0.22);
    }

    const targetY = this.sampleGroundY(targetX, targetZ);
    const shakeX = state.screenShake > 0 ? (Math.random() - 0.5) * 0.28 * state.screenShake : 0;
    const shakeY = state.screenShake > 0 ? (Math.random() - 0.5) * 0.18 * state.screenShake : 0;
    const horiz = dist * Math.cos(elev);
    this.camera.position.set(
      targetX + Math.sin(yaw) * horiz + shakeX,
      targetY + dist * Math.sin(elev) + shakeY,
      targetZ + Math.cos(yaw) * horiz
    );
    this.camera.lookAt(targetX, targetY + 0.35, targetZ);

    // Move Shadow-Casting Sun Light diagonally with target so 45° shadows stay crisp across the whole vista!
    this.sunLight.position.set(targetX - 18, targetY + 32, targetZ - 14);
    this.sunLight.target.position.set(targetX, targetY, targetZ);

    // Real-time Flickering Hero Dungeon Lantern PointLight
    if (isDungeon) {
      this.heroTorchLight.position.set(px3, adolGroundY + 1.85, pz3 + 0.35);
      this.heroTorchLight.intensity = 6.2 + Math.sin(time * 13) * 0.55;
      this.heroTorchLight.distance = 12.5;
    } else {
      this.heroTorchLight.intensity = 0;
    }

    // Flicker torch flames & brazier lights
    for (let i = 0; i < this.fireFlames.length; i++) {
      const f = this.fireFlames[i];
      const s = 0.85 + Math.sin(time * 15 + i * 2.1) * 0.25;
      f.scale.set(s, 0.9 + s * 0.35, s);
      f.rotation.y = time * 4 + i;
    }
    for (let i = 0; i < this.brazierLights.length; i++) {
      this.brazierLights[i].intensity = 3.0 + Math.sin(time * 12 + i * 1.7) * 0.55;
    }

    // Animate Fountain Jets, Shrine Statue Halos, Bobbing Moored Rowboats, Windmill/Waterwheel, Chimney Smoke, Falling Leaves & 3D Butterflies!
    for (const j of this.fountainJets) {
      j.scale.y = 0.85 + Math.sin(time * 9) * 0.22;
      j.rotation.y = time * 2.5;
    }
    for (const r of this.statueRings) {
      r.rotation.y = time * 1.4;
    }
    for (const sp of this.spinners) {
      sp.obj.rotation[sp.axis] = time * sp.speed;
    }
    for (const sm of this.chimneySmokes) {
      const t = (time * sm.speed + sm.phase) % 1;
      sm.mesh.position.set(
        sm.ox + t * 0.92 + Math.sin(time * 1.6 + sm.phase * 6.2) * 0.18 * t,
        sm.oy + t * 2.55,
        sm.oz + t * 0.52 + Math.cos(time * 1.3 + sm.phase * 5.1) * 0.14 * t
      );
      const sc = 0.52 + t * 1.38;
      sm.mesh.scale.set(sc, sc * 0.8, sc);
      (sm.mesh.material as THREE.MeshStandardMaterial).opacity = Math.sin(t * Math.PI) * 0.5;
    }
    if (this.fallingLeavesInst && this.fallingLeaves.length > 0) {
      this.fallingLeavesInst.frustumCulled = false;
      for (let i = 0; i < this.fallingLeaves.length; i++) {
        const L = this.fallingLeaves[i];
        const cycleH = Math.max(1.2, L.oy - L.groundY);
        const restDur = 0.85;
        const total = cycleH + restDur;
        const raw = (time * L.speed + L.phase * 2.1) % total;
        if (raw < cycleH) {
          const lx = L.ox + Math.sin(time * L.freq + L.phase) * L.driftAmp + raw * 0.18;
          const lz = L.oz + Math.cos(time * L.freq * 0.82 + L.phase * 1.3) * L.driftAmp * 0.85 + raw * 0.12;
          const ly = L.oy - raw;
          _dummy.position.set(lx, ly, lz);
          _dummy.rotation.set(
            time * L.spinSpeed + L.phase,
            time * L.spinSpeed * 0.72,
            Math.sin(time * 3.1 + L.phase) * 0.95
          );
          _dummy.scale.setScalar(L.scale);
        } else {
          const restT = (raw - cycleH) / restDur;
          const landTime = time - (raw - cycleH) / Math.max(0.05, L.speed);
          const lx = L.ox + Math.sin(landTime * L.freq + L.phase) * L.driftAmp + cycleH * 0.18;
          const lz = L.oz + Math.cos(landTime * L.freq * 0.82 + L.phase * 1.3) * L.driftAmp * 0.85 + cycleH * 0.12;
          _dummy.position.set(lx, this.sampleGroundY(lx, lz) + 0.03, lz);
          _dummy.rotation.set(Math.PI * 0.48, L.phase, 0);
          _dummy.scale.setScalar(L.scale * Math.max(0.001, 1 - restT));
        }
        _dummy.updateMatrix();
        this.fallingLeavesInst.setMatrixAt(i, _dummy.matrix);
      }
      this.fallingLeavesInst.instanceMatrix.needsUpdate = true;
    }
    for (const b of this.floatingBoats) {
      b.group.position.y = b.baseY + Math.sin(time * 2.1 + b.phase) * 0.045;
      b.group.rotation.z = Math.sin(time * 1.6 + b.phase) * 0.07;
      b.group.rotation.x = Math.cos(time * 1.3 + b.phase) * 0.04;
    }
    for (const w of this.wildlifeRigs) {
      const a = time * w.speed + w.phase;
      const wx = w.anchorX + Math.cos(a) * w.radius;
      const wz = w.anchorZ + Math.sin(a * 1.3) * w.radius;
      w.group.position.set(
        wx,
        this.sampleGroundY(wx, wz) + 0.95 + Math.sin(time * 3.4 + w.phase) * 0.28,
        wz
      );
      w.group.rotation.y = -a;
      const flap = Math.sin(time * 20 + w.phase) * 0.85;
      w.wingL.rotation.y = flap;
      w.wingR.rotation.y = -flap;
    }

    // Update Adol HD-2D 4-Direction Sprite & Equipment Materials (aligned cleanly to 45° cameraYaw!)
    this.syncAdolRig(state, px3, pz3, yaw);

    // Update Interactive Rustling Shrubs
    for (const shRig of this.shrubRigs) {
      const sh = zone.shrubs.find((s) => s.id === shRig.id);
      if (!sh) continue;
      const wiggle = Math.sin(sh.shakePhase) * sh.shakeAmp * 0.24;
      const squash = 1 + Math.abs(Math.sin(sh.shakePhase)) * sh.shakeAmp * 0.16;
      shRig.group.rotation.z = wiggle;
      shRig.group.scale.set(squash, 1 / Math.sqrt(squash), squash);
      shRig.sparkle.visible = !sh.searched && sh.hiddenKind !== 'nothing';
      if (shRig.sparkle.visible) {
        shRig.sparkle.rotation.y = time * 3.5;
        shRig.sparkle.position.y = 0.68 + Math.sin(time * 5 + shRig.tx) * 0.08;
      }
    }

    // Update Hinged 3D Treasure Chests
    for (const cRig of this.chestRigs) {
      const opened = state.openedChests.has(cRig.id);
      const targetRot = opened ? -1.9 : 0;
      cRig.lidPivot.rotation.x += (targetRot - cRig.lidPivot.rotation.x) * 0.2;
      cRig.glowLight.visible = !opened;
      if (!opened) {
        cRig.glowLight.rotation.y = time * 3;
        cRig.glowLight.position.y = 0.72 + Math.sin(time * 4.5) * 0.08;
      }
    }

    // Update Glowing 3D Zone Portals
    for (const pRig of this.portalRigs) {
      const locked = Boolean(pRig.requiredFlag && !state.flags.has(pRig.requiredFlag));
      const col = locked ? '#f43f5e' : '#38bdf8';
      (pRig.ring.material as THREE.MeshBasicMaterial).color.set(col);
      pRig.ring.scale.setScalar(0.92 + Math.sin(time * 4.2) * 0.1);
      for (const orb of pRig.pillarGlows) {
        (orb.material as THREE.MeshBasicMaterial).color.set(col);
        orb.rotation.y = time * 2.5;
      }
    }

    // Update HD-2D RPG-JS 4-Direction NPCs facing Adol & cleanly billboarded to 45° cameraYaw!
    for (const npc of zone.npcs) {
      const rig = this.npcRigs.get(npc.id);
      if (!rig) continue;
      rig.spriteMesh.rotation.y = yaw;
      const a = state.npcAngles.get(npc.id) ?? Math.PI * 0.5;
      const dir = angleToRpgJsDir(a + yaw);
      const idleCol = Math.floor(time * 1.4 + npc.tx) % 2 === 0 ? 0 : 2;
      rig.spriteTex.offset.set(idleCol * 0.25, (3 - dir) * 0.25);
      rig.body.position.y = Math.sin(time * 2.6 + npc.tx) * 0.025;
    }

    // Sync HD-2D RPG-JS Animated Enemies & Colossal Bosses (billboarded to 45° cameraYaw!)
    const aliveIds = new Set<number>();
    for (const e of state.enemies) {
      aliveIds.add(e.id);
      let rig = this.enemyRigs.get(e.id);
      if (!rig) {
        rig = this.buildEnemyRig(e);
        this.scene.add(rig.root);
        this.enemyRigs.set(e.id, rig);
      }
      const ex = e.x / YS_WORLD_TILE;
      const ez = e.y / YS_WORLD_TILE;
      rig.root.position.set(ex, this.sampleGroundY(ex, ez), ez);
      rig.spriteMesh.rotation.y = yaw;
      const animFrame = Math.floor(time * (e.kind === 'wyvern' ? 7 : 4.2) + e.id) % 2;
      const facingLeft = Math.cos(e.angle + yaw) < 0;
      if (facingLeft) {
        rig.spriteTex.repeat.set(-0.5, 1);
        rig.spriteTex.offset.set(animFrame * 0.5 + 0.5, 0);
      } else {
        rig.spriteTex.repeat.set(0.5, 1);
        rig.spriteTex.offset.set(animFrame * 0.5, 0);
      }
      rig.body.position.y = e.kind === 'wyvern' ? 0.22 + Math.sin(time * 6 + e.id) * 0.12 : Math.abs(Math.sin(time * 6 + e.id)) * 0.06;

      if (rig.bossCircle) {
        rig.bossCircle.rotation.z = -time * 1.6;
        rig.bossCircle.scale.setScalar(0.95 + Math.sin(time * 4.5) * 0.08);
      }
      const flash = e.hitFlash > 0 && Math.floor(time * 32) % 2 === 0;
      if (flash) {
        rig.spriteMat.emissive.set('#ffffff');
        rig.spriteMat.emissiveIntensity = 1.5;
      } else {
        rig.spriteMat.emissive.set('#000000');
        rig.spriteMat.emissiveIntensity = 0;
      }
    }
    for (const [id, rig] of this.enemyRigs.entries()) {
      if (!aliveIds.has(id)) {
        rig.spriteTex.dispose();
        rig.spriteMat.dispose();
        this.scene.remove(rig.root);
        this.enemyRigs.delete(id);
      }
    }

    // Sync Magic Projectiles, Bouncing 3D Armor Gibs, & Jagged Combat Lightning Bolts!
    for (let i = 0; i < this.projPool.length; i++) {
      const m = this.projPool[i];
      if (i < state.projectiles.length) {
        const p = state.projectiles[i];
        const prx = p.x / YS_WORLD_TILE;
        const prz = p.y / YS_WORLD_TILE;
        m.visible = true;
        m.position.set(prx, this.sampleGroundY(prx, prz) + 0.65, prz);
        const sc = Math.max(0.6, p.radius / 8);
        m.scale.setScalar(sc);
        (m.material as THREE.MeshStandardMaterial).emissive.set(p.color);
      } else {
        m.visible = false;
      }
    }

    for (let i = 0; i < this.gibPool.length; i++) {
      const m = this.gibPool[i];
      if (i < state.armorGibs.length) {
        const gItem = state.armorGibs[i];
        const gx = gItem.x / YS_WORLD_TILE;
        const gz = gItem.y / YS_WORLD_TILE;
        m.visible = true;
        m.position.set(gx, this.sampleGroundY(gx, gz) + 0.08 + gItem.z / YS_WORLD_TILE, gz);
        m.rotation.set(gItem.rot, gItem.rot * 0.7, gItem.rot * 0.5);
        (m.material as THREE.MeshStandardMaterial).color.set(gItem.color);
      } else {
        m.visible = false;
      }
    }

    for (let i = 0; i < this.boltLines.length; i++) {
      const line = this.boltLines[i];
      if (i < state.combatBolts.length) {
        const b = state.combatBolts[i];
        line.visible = true;
        const posAttr = line.geometry.attributes.position as THREE.BufferAttribute;
        const bx1 = b.x1 / YS_WORLD_TILE;
        const bz1 = b.y1 / YS_WORLD_TILE;
        const bx2 = b.x2 / YS_WORLD_TILE;
        const bz2 = b.y2 / YS_WORLD_TILE;
        const by1 = this.sampleGroundY(bx1, bz1) + 0.75;
        const by2 = this.sampleGroundY(bx2, bz2) + 0.75;
        _vec3.set(bx1, by1, bz1);
        _vec3B.set(bx2, by2, bz2);
        for (let s = 0; s < 5; s++) {
          const t = s / 4;
          const j = s === 0 || s === 4 ? 0 : 0.24;
          posAttr.setXYZ(
            s,
            THREE.MathUtils.lerp(_vec3.x, _vec3B.x, t) + (Math.random() - 0.5) * j,
            THREE.MathUtils.lerp(_vec3.y, _vec3B.y, t) + (Math.random() - 0.5) * j,
            THREE.MathUtils.lerp(_vec3.z, _vec3B.z, t) + (Math.random() - 0.5) * j
          );
        }
        posAttr.needsUpdate = true;
        const mat = line.material as THREE.LineBasicMaterial;
        mat.color.set(b.color);
        mat.opacity = Math.max(0, b.life / b.maxLife);
      } else {
        line.visible = false;
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  private syncAdolRig(state: YsThreeRenderState, px3: number, pz3: number, yaw: number): void {
    const r = this.adolRig;
    const blinkHide = state.invulnTimer > 0 && Math.floor(state.time * 18) % 2 === 0;
    r.root.visible = !blinkHide;
    r.root.position.set(px3, this.sampleGroundY(px3, pz3), pz3);
    r.spriteMesh.rotation.y = yaw;

    // Live equipment sprite refresh when Adol upgrades Sword or Armor!
    if (r.weaponTier !== state.weaponTier || r.armorTier !== state.armorTier) {
      r.weaponTier = state.weaponTier;
      r.armorTier = state.armorTier;
      const nextTex = buildRpgJsHeroSpriteSheet(state.weaponTier, state.armorTier, this.maxAniso);
      nextTex.repeat.set(0.25, 0.25);
      r.spriteTex.dispose();
      r.spriteTex = nextTex;
      r.spriteMat.map = nextTex;
      r.spriteMat.needsUpdate = true;
      r.depthMat.map = nextTex;
      r.depthMat.needsUpdate = true;
    }

    // Smooth 4-direction RPG-JS spritesheet row & walk cycle column (camera-relative for 45° view!)
    const dir = angleToRpgJsDir(state.bodyAngle + yaw);
    const frame = state.moveSpeedFrac > 0.08 ? Math.floor(state.walkAnim * 1.45) % 4 : 0;
    r.spriteTex.offset.set(frame * 0.25, (3 - dir) * 0.25);

    // Subtle combat lunge lean & walking hop
    const bob = Math.abs(Math.cos(state.walkAnim)) * 0.06 * state.moveSpeedFrac;
    const lunge = state.lungeTimer > 0 ? 0.14 : 0;
    r.body.position.set(Math.cos(state.bodyAngle) * lunge, bob, Math.sin(state.bodyAngle) * lunge);

    // Sword slash crescent arc aligned to Adol's facing angle!
    r.slashArc.rotation.z = -state.bodyAngle;
    const arcMat = r.slashArc.material as THREE.MeshBasicMaterial;
    arcMat.opacity = state.slashArcTimer > 0 ? Math.min(0.88, state.slashArcTimer * 4.8) : 0;

    // Auto-heal emerald shimmer & Shield Magic dome
    const healMat = r.healRing.material as THREE.MeshBasicMaterial;
    healMat.opacity = state.autoHealPulse * 0.72;
    r.healRing.scale.setScalar(1 + Math.sin(state.time * 7) * 0.16);

    const domeMat = r.shieldDome.material as THREE.MeshBasicMaterial;
    domeMat.opacity = state.shieldAuraTimer > 0 ? 0.38 : 0;
    r.shieldDome.rotation.y = state.time * 1.6;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearZoneScene();
    this.adolRig.spriteTex.dispose();
    this.adolRig.spriteMat.dispose();
    this.adolRig.depthMat.dispose();
    for (const tex of this.enemySpriteCache.values()) tex.dispose();
    this.enemySpriteCache.clear();
    for (const tex of Object.values(this.archTextures)) tex.dispose();
    this.gpuSparks.dispose();
    this.envTexture.dispose();
    for (const tex of Object.values(this.textures)) tex.dispose();
    this.renderer.dispose();
  }
}

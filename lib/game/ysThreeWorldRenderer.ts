import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { BuildingArchStyle, WorldBuilding, WorldCraftStation, WorldForageNode, WorldNpc, ZoneDef } from './ysWorldBuilder';
import {
  buildRpgJsZoneTerrainTexture,
  createRpgJsArchTextures,
  resolveNpcAgeGroup,
  type RpgJsArchTextures,
} from './rpgJsSpriteAtlas';
import {
  applyHeroEquipmentTier3D,
  buildAdolXrayProxy3D,
  buildSculptedEnemy3D,
  buildSculptedHumanoid3D,
  resolveNpcCostume,
  type Enemy3DParts,
  type Humanoid3DParts,
} from './ysThreeCharacterRig';

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

export type YsCameraZoomMode = 'close45' | 'evo45' | 'wide45' | 'fullmap45';
export type YsWeatherKind = 'clear' | 'breezy' | 'rain' | 'storm' | 'snow';
export type YsNpcBehaviorMode = 'routine' | 'wave' | 'chat_pair' | 'stretch' | 'look_around' | 'hop' | 'shelter';

export interface YsThreeNpcRuntimeView {
  x: number;
  y: number;
  angle: number;
  speedFrac: number;
  walkAnim: number;
  working: boolean;
  workPhase: number;
  taskLabel: string;
  behaviorMode?: YsNpcBehaviorMode;
  headLookYaw?: number;
  springOffsetY?: number;
  talking?: boolean;
}

export interface YsThreeRenderState {
  zone: ZoneDef;
  time: number;
  camX: number;
  camY: number;
  screenShake: number;
  cameraYaw?: number;
  cameraZoomMode?: YsCameraZoomMode;
  cameraZoomScale?: number;
  timeOfDayHours?: number;
  weather?: YsWeatherKind;
  windDirX?: number;
  windDirZ?: number;
  windSpeed?: number;
  lightningFlash?: number;
  dialogueFocus?: { active: boolean; x: number; y: number; npcId?: string } | null;
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
  npcStates?: Map<string, YsThreeNpcRuntimeView>;
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
  parts: Humanoid3DParts;
  xrayGroup: THREE.Group;
  xrayMat: THREE.MeshBasicMaterial;
  xrayFootRing: THREE.Mesh;
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
  parts: Enemy3DParts;
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

interface FountainAnimRig {
  centerJet: THREE.Mesh;
  topFoam: THREE.Mesh;
  ripples: THREE.Mesh[];
  streams: THREE.Mesh[];
  droplets: Array<{
    mesh: THREE.Mesh;
    angle: number;
    speed: number;
    phase: number;
    startR: number;
    endR: number;
    peakY: number;
    baseY: number;
    endY: number;
  }>;
}

interface FountainAnchor {
  x: number;
  y: number;
  z: number;
  rimR: number;
  rimY: number;
}

interface TreePerchSpot {
  x: number;
  y: number;
  z: number;
}

interface BirdRig {
  group: THREE.Group;
  bodyPivot: THREE.Group;
  headPivot: THREE.Group;
  wingL: THREE.Group;
  wingR: THREE.Group;
  state: 'perch_fountain' | 'fly_to_tree' | 'perch_tree' | 'fly_to_fountain';
  timer: number;
  duration: number;
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  arcHeight: number;
  fountainIdx: number;
  rimAngle: number;
  treeIdx: number;
  phase: number;
  drinkSpeed: number;
}

interface NpcRig {
  root: THREE.Group;
  body: THREE.Group;
  parts: Humanoid3DParts;
  baseY: number;
  ageGroup: 'adult' | 'child' | 'elder';
  propAnchor?: THREE.Group;
  propPivot?: THREE.Group;
  extraProp?: THREE.Mesh;
  task?: WorldNpc['task'];
}

interface ChestRig {
  id: string;
  lidPivot: THREE.Group;
  glowLight: THREE.Mesh;
  xrayGlint: THREE.Mesh;
  tx: number;
  ty: number;
}

interface ShrubRig {
  id: string;
  group: THREE.Group;
  sparkle: THREE.Mesh;
  xrayGlint: THREE.Mesh;
  tx: number;
  ty: number;
}

interface InspectableRig {
  id: string;
  glint: THREE.Mesh;
  xrayGlint: THREE.Mesh;
  baseY: number;
  tx: number;
  ty: number;
}

interface PortalRig {
  ring: THREE.Mesh;
  pillarGlows: THREE.Mesh[];
  requiredFlag?: string;
  isDoorway?: boolean;
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
      float heightFactor = clamp(position.y, 0.0, 3.2);
      float rollingGust = 0.68 + 0.48 * sin(uTime * 0.85 + ysWorldPos.x * 0.16 + ysWorldPos.z * 0.12)
        + 0.22 * cos(uTime * 1.65 - ysWorldPos.x * 0.24 + ysWorldPos.z * 0.19);
      float swayX = (sin(uTime * 2.3 + ysWorldPos.x * 0.65 + ysWorldPos.z * 0.45) + 0.42 * sin(uTime * 4.9 + ysWorldPos.x * 1.9 + ysWorldPos.z * 1.1)) * uWindStr * rollingGust * heightFactor;
      float swayZ = (cos(uTime * 1.95 + ysWorldPos.z * 0.58 - ysWorldPos.x * 0.42) + 0.36 * cos(uTime * 4.3 + ysWorldPos.z * 1.75)) * uWindStr * 0.82 * rollingGust * heightFactor;
      float liftY = sin(uTime * 3.1 + ysWorldPos.x * 0.9 + ysWorldPos.z * 0.8) * uWindStr * 0.22 * rollingGust * clamp(heightFactor - 0.3, 0.0, 2.2);
      transformed.x += swayX;
      transformed.z += swayZ;
      transformed.y += liftY;

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
  mat.customProgramCacheKey = () => `ys_foliage_v2_${windStrength}_${pushStrength}`;
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
  const isInterior = theme === 'interior';
  const count = isInterior ? 160 : 560;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = hash2d(i, 1, 301) * worldW;
    positions[i * 3 + 1] = 0.4 + hash2d(i, 2, 301) * (isInterior ? 2.8 : 5.2);
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
  const colA = isInterior
    ? new THREE.Color('#fde68a')
    : isSnow
      ? new THREE.Color('#e0f2fe')
      : isEmber
        ? new THREE.Color('#fb923c')
        : isShrine
          ? new THREE.Color('#38bdf8')
          : new THREE.Color('#fef08a');
  const colB = isInterior
    ? new THREE.Color('#fb923c')
    : isSnow
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
      uRise: { value: isEmber ? 1.0 : isSnow ? -1.0 : isInterior ? 0.15 : 0.25 },
      uPointSize: { value: isInterior ? 4.4 : isSnow ? 5.2 : 6.0 },
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
  private readonly maxSparks = 480;
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
  private inspectableRigs: InspectableRig[] = [];
  private portalRigs: PortalRig[] = [];
  private fountainJets: THREE.Mesh[] = [];
  private fountainAnims: FountainAnimRig[] = [];
  private fountainAnchors: FountainAnchor[] = [];
  private treePerchSpots: TreePerchSpot[] = [];
  private birdRigs: BirdRig[] = [];
  private statueRings: THREE.Mesh[] = [];
  private fireFlames: THREE.Mesh[] = [];
  private floatingBoats: FloatingBoatRig[] = [];
  private wildlifeRigs: WildlifeRig[] = [];
  private fallingLeavesInst: THREE.InstancedMesh | null = null;
  private fallingLeaves: FallingLeafItem[] = [];
  private chimneySmokes: ChimneySmokeItem[] = [];
  private spinners: SpinnerRig[] = [];
  private swayingLanterns: Array<{ pivot: THREE.Object3D; phase: number; amp: number; speed: number; axis: 'xz' | 'z' }> = [];
  private treeMovingParts: Array<{ obj: THREE.Object3D; baseRx: number; baseRy: number; baseRz: number; ampX: number; ampZ: number; speed: number; phase: number; wx: number; wz: number }> = [];
  private grazingAnimals: Array<{
    kind: 'horse' | 'sheep' | 'cow' | 'chicken';
    root: THREE.Group;
    headPivot: THREE.Group;
    tailPivot?: THREE.Group;
    legs: THREE.Object3D[];
    homeX: number;
    homeZ: number;
    roamRx: number;
    roamRz: number;
    phase: number;
    speed: number;
    curX: number;
    curZ: number;
    targetX: number;
    targetZ: number;
    timer: number;
    grazeMode: boolean;
  }> = [];
  private seatedPeople: Array<{
    head: THREE.Object3D;
    armR: THREE.Object3D;
    armL: THREE.Object3D;
    torso: THREE.Object3D;
    mode: 'game' | 'eat';
    phase: number;
  }> = [];
  private factoryMachines: Array<{
    kind: 'hammer' | 'belt_item' | 'bellows';
    obj: THREE.Object3D;
    ox: number;
    oy: number;
    oz: number;
    span: number;
    phase: number;
    speed: number;
  }> = [];
  private dynamicObstacles: Array<{ x: number; y: number; r: number }> = [];
  private butterflyRigs: Array<{
    grp: THREE.Group;
    wingL: THREE.Object3D;
    wingR: THREE.Object3D;
    cx: number;
    cz: number;
    baseY: number;
    rx: number;
    rz: number;
    speed: number;
    phase: number;
    flapSpeed: number;
  }> = [];
  private fountainKoi: Array<{
    grp: THREE.Group;
    tail: THREE.Object3D;
    cx: number;
    cz: number;
    y: number;
    r: number;
    speed: number;
    phase: number;
  }> = [];
  private cauldronBubbles: Array<{
    mesh: THREE.Mesh;
    baseY: number;
    ox: number;
    oz: number;
    phase: number;
    speed: number;
  }> = [];
  private forageRigs = new Map<string, { group: THREE.Group; glint: THREE.Mesh; baseY: number; gathered: boolean }>();

  public isPointInDynamicObstacle(wx: number, wy: number): boolean {
    for (let i = 0; i < this.dynamicObstacles.length; i++) {
      const ob = this.dynamicObstacles[i];
      if (Math.hypot(wx - ob.x, wy - ob.y) < ob.r) return true;
    }
    return false;
  }

  public syncForageNodeState(nodeId: string, gathered: boolean): void {
    const rig = this.forageRigs.get(nodeId);
    if (!rig) return;
    rig.gathered = gathered;
    rig.glint.visible = !gathered;
  }

  private registerDynamicObstacle(tileX: number, tileZ: number, radiusPx: number): void {
    this.dynamicObstacles.push({ x: tileX * YS_WORLD_TILE, y: tileZ * YS_WORLD_TILE, r: radiusPx });
  }

  // Smooth 60 FPS Exponentially-Damped Camera Tracking State
  private smoothCamX = 0;
  private smoothCamY = 0;
  private smoothCamZ = 0;
  private smoothCamDist = 26.5;
  private smoothCamElev = 0.64;
  private smoothCamLookYOffset = 0.35;
  private smoothCamInit = false;
  private lastRenderTime = 0;

  // Dynamic VFX Meshes (Projectiles, Armor Gibs, Lightning Bolts, 3D Weather Engine!)
  private readonly dynamicVfxGroup = new THREE.Group();
  private readonly projPool: THREE.Mesh[] = [];
  private readonly gibPool: THREE.Mesh[] = [];
  private readonly boltLines: THREE.Line[] = [];
  private weatherRainLines: THREE.LineSegments | null = null;
  private weatherRainData: Array<{ ox: number; oy: number; oz: number; speed: number; len: number }> = [];
  private weatherSnowPoints: THREE.Points | null = null;
  private weatherSnowData: Array<{ ox: number; oy: number; oz: number; speed: number; drift: number; phase: number }> = [];
  private rainRipples: Array<{ mesh: THREE.Mesh; life: number; maxLife: number; x: number; z: number }> = [];
  private skyCloudGroup: THREE.Group | null = null;
  private skyClouds: Array<{
    group: THREE.Group;
    ox: number;
    oz: number;
    baseY: number;
    bobPhase: number;
    speedMult: number;
    band: 'canopy' | 'horizon';
    radiusWrap: number;
  }> = [];
  private cloudCoreMat: THREE.MeshStandardMaterial | null = null;
  private cloudShadeMat: THREE.MeshStandardMaterial | null = null;
  private cloudGeos: THREE.BufferGeometry[] = [];
  private cloudShadowGroup: THREE.Group | null = null;
  private cloudShadows: Array<{
    mesh: THREE.Mesh;
    ox: number;
    oz: number;
    sx: number;
    sz: number;
    phase: number;
    speedMult: number;
  }> = [];
  private cloudShadowTex: THREE.CanvasTexture | null = null;
  private cloudShadowMat: THREE.MeshBasicMaterial | null = null;
  private cloudShadowGeo: THREE.PlaneGeometry | null = null;
  private readonly tmpSkyColor = new THREE.Color();
  private readonly tmpFogColor = new THREE.Color();
  private readonly tmpSunColor = new THREE.Color();
  private readonly tmpHemiSky = new THREE.Color();
  private readonly tmpHemiGnd = new THREE.Color();
  private readonly tmpCloudCol = new THREE.Color();
  private readonly tmpCloudEmissive = new THREE.Color();

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
    this.scene.fog = new THREE.FogExp2('#83cbf8', 0.0026);

    // True 45° Isometric 2.5D Evo Diorama Perspective Camera (crisp 32° FOV, 680-unit far plane for deep endless ocean & horizon vistas!)
    this.camera = new THREE.PerspectiveCamera(32, width / height, 0.4, 680);

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
    if (isDungeon || theme === 'interior') return 0;

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
        // Sculpted underwater seabed: slopes progressively deeper past Minea's coastal quay into deep ocean sapphire!
        const seaDepthDrop = zone.theme === 'town' ? smoothstep01((z - 65.5) / 9.5) * 1.32 : 0;
        return -0.64 - seaDepthDrop + Math.sin(x * 0.85) * Math.cos(z * 0.85) * 0.05;
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
    // Pre-allocate 3D Volumetric Rain Streaks, Expanding Ground Ripples & Drifting Snowflakes!
    const rainCount = this.isSoftwareGl ? 220 : 400;
    const rainPos = new Float32Array(rainCount * 2 * 3);
    this.weatherRainData = [];
    for (let i = 0; i < rainCount; i++) {
      this.weatherRainData.push({
        ox: (Math.random() - 0.5) * 34,
        oy: Math.random() * 18,
        oz: (Math.random() - 0.5) * 34,
        speed: 17 + Math.random() * 7,
        len: 0.72 + Math.random() * 0.45,
      });
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    const rainMat = new THREE.LineBasicMaterial({
      color: '#cfe9ff',
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
    });
    this.weatherRainLines = new THREE.LineSegments(rainGeo, rainMat);
    this.weatherRainLines.frustumCulled = false;
    this.weatherRainLines.visible = false;
    this.dynamicVfxGroup.add(this.weatherRainLines);

    const snowCount = this.isSoftwareGl ? 180 : 340;
    const snowPos = new Float32Array(snowCount * 3);
    this.weatherSnowData = [];
    for (let i = 0; i < snowCount; i++) {
      this.weatherSnowData.push({
        ox: (Math.random() - 0.5) * 34,
        oy: Math.random() * 17,
        oz: (Math.random() - 0.5) * 34,
        speed: 1.65 + Math.random() * 1.15,
        drift: 0.7 + Math.random() * 0.9,
        phase: Math.random() * Math.PI * 2,
      });
    }
    const snowGeo = new THREE.BufferGeometry();
    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
    const snowMat = new THREE.PointsMaterial({
      color: '#f8fafc',
      size: 0.24,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });
    this.weatherSnowPoints = new THREE.Points(snowGeo, snowMat);
    this.weatherSnowPoints.frustumCulled = false;
    this.weatherSnowPoints.visible = false;
    this.dynamicVfxGroup.add(this.weatherSnowPoints);

    const rippleGeo = new THREE.RingGeometry(0.14, 0.21, 14);
    rippleGeo.rotateX(-Math.PI * 0.5);
    this.rainRipples = [];
    const rippleCount = this.isSoftwareGl ? 14 : 26;
    for (let i = 0; i < rippleCount; i++) {
      const rMat = new THREE.MeshBasicMaterial({
        color: '#dbeafe',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const rMesh = new THREE.Mesh(rippleGeo, rMat);
      rMesh.visible = false;
      this.dynamicVfxGroup.add(rMesh);
      this.rainRipples.push({
        mesh: rMesh,
        life: Math.random() * 0.65,
        maxLife: 0.45 + Math.random() * 0.35,
        x: 0,
        z: 0,
      });
    }

    // Initialize 3D Volumetric Sky Clouds (high canopy + eye-level dialogue horizon bands) & Drifting Ground Cloud Shadows!
    this.initSkyCloudsAndShadows();

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

  private createCloudShadowTexture(): THREE.CanvasTexture {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, size, size);
      // Multi-lobe organic cumulus silhouette shadow with buttery radial feathering
      const lobes: Array<[number, number, number, number]> = [
        [64, 64, 54, 0.72],
        [44, 60, 38, 0.56],
        [84, 62, 36, 0.52],
        [60, 46, 36, 0.52],
        [70, 78, 34, 0.48],
      ];
      for (const [cx, cy, r, peak] of lobes) {
        const grad = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
        grad.addColorStop(0, `rgba(255, 255, 255, ${peak})`);
        grad.addColorStop(0.55, `rgba(255, 255, 255, ${peak * 0.45})`);
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  private initSkyCloudsAndShadows(): void {
    this.skyCloudGroup = new THREE.Group();
    this.skyClouds = [];
    this.cloudGeos = [];

    const puffGeoMain = new THREE.IcosahedronGeometry(1.0, 2);
    const puffGeoSoft = new THREE.SphereGeometry(0.95, 10, 8);
    this.cloudGeos.push(puffGeoMain, puffGeoSoft);

    this.cloudCoreMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      emissive: '#c7e4ff',
      emissiveIntensity: 0.26,
      roughness: 0.94,
      metalness: 0.0,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });
    this.cloudShadeMat = new THREE.MeshStandardMaterial({
      color: '#dbeafe',
      emissive: '#93c5fd',
      emissiveIntensity: 0.14,
      roughness: 0.96,
      metalness: 0.0,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });

    const buildCloudCluster = (seed: number, scale: number): THREE.Group => {
      const cl = new THREE.Group();
      const sRand = (k: number) => {
        const v = Math.sin(seed * 19.7 + k * 43.13) * 43758.5453;
        return v - Math.floor(v);
      };
      // Sculpted puffy cumulus top puffs
      const topPuffs: Array<[number, number, number, number, number, number]> = [
        [0, 0.24, 0, 1.45, 0.88, 1.15],
        [-1.08, 0.08, 0.22, 1.08, 0.72, 0.96],
        [1.12, 0.12, -0.18, 1.16, 0.76, 0.94],
        [-0.45, 0.42, -0.42, 0.96, 0.74, 0.88],
        [0.52, 0.38, 0.36, 0.92, 0.68, 0.86],
      ];
      for (let pi = 0; pi < topPuffs.length; pi++) {
        const [px, py, pz, sx, sy, sz] = topPuffs[pi];
        const m = new THREE.Mesh(pi % 2 === 0 ? puffGeoMain : puffGeoSoft, this.cloudCoreMat!);
        m.position.set(px + (sRand(pi) - 0.5) * 0.24, py, pz + (sRand(pi + 9) - 0.5) * 0.24);
        m.scale.set(sx * (0.9 + sRand(pi + 3) * 0.22), sy, sz * (0.9 + sRand(pi + 7) * 0.22));
        cl.add(m);
      }
      // Flattened slightly shaded cumulus base for 3D volumetric depth
      const base = new THREE.Mesh(puffGeoSoft, this.cloudShadeMat!);
      base.position.set(0, -0.22, 0);
      base.scale.set(1.95, 0.36, 1.25);
      cl.add(base);

      cl.scale.setScalar(scale);
      cl.rotation.y = sRand(21) * Math.PI * 2;
      return cl;
    };

    // 1) Horizon Ambiance Band (14 clouds distributed 360° around distance 88..175 at y = 10.5..22)
    // Guarantees lush drifting sky clouds visible behind characters during eye-level dialogue close-ups from EVERY angle!
    const horizonCount = this.isSoftwareGl ? 10 : 14;
    for (let i = 0; i < horizonCount; i++) {
      const ang = (i / horizonCount) * Math.PI * 2 + (i % 2) * 0.18;
      const dist = 94 + ((i * 29) % 78);
      const ox = Math.cos(ang) * dist;
      const oz = Math.sin(ang) * dist;
      const sc = 4.6 + ((i * 13) % 52) * 0.1;
      const baseY = 10.5 + ((i * 7) % 11);
      const grp = buildCloudCluster(100 + i * 7, sc);
      this.skyCloudGroup.add(grp);
      this.skyClouds.push({
        group: grp,
        ox,
        oz,
        baseY,
        bobPhase: i * 0.9,
        speedMult: 0.8 + (i % 4) * 0.16,
        band: 'horizon',
        radiusWrap: 185,
      });
    }

    // 2) High Sky Canopy Band (12 big cumulus clouds at y = 29..43 for wide/rotated vistas)
    const canopyCount = this.isSoftwareGl ? 8 : 12;
    for (let i = 0; i < canopyCount; i++) {
      const ox = (((i * 67) % 240) - 120) + (i % 2 === 0 ? 12 : -12);
      const oz = (((i * 97) % 240) - 120) + (i % 3 === 0 ? 14 : -14);
      const sc = 6.2 + ((i * 11) % 45) * 0.1;
      const baseY = 29 + (i % 5) * 3.2;
      const grp = buildCloudCluster(300 + i * 11, sc);
      this.skyCloudGroup.add(grp);
      this.skyClouds.push({
        group: grp,
        ox,
        oz,
        baseY,
        bobPhase: i * 1.3 + 2.1,
        speedMult: 1.0 + (i % 3) * 0.2,
        band: 'canopy',
        radiusWrap: 155,
      });
    }
    this.dynamicVfxGroup.add(this.skyCloudGroup);

    // 3) Soft Drifting Ground Cloud Shadows gliding across terrain, piers & sea in lockstep with the wind!
    this.cloudShadowGroup = new THREE.Group();
    this.cloudShadows = [];
    this.cloudShadowTex = this.createCloudShadowTexture();
    this.cloudShadowGeo = new THREE.PlaneGeometry(1, 1);
    this.cloudShadowGeo.rotateX(-Math.PI * 0.5);
    this.cloudShadowMat = new THREE.MeshBasicMaterial({
      map: this.cloudShadowTex,
      color: '#0b223d',
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });

    const shadowCount = this.isSoftwareGl ? 10 : 16;
    for (let i = 0; i < shadowCount; i++) {
      const mesh = new THREE.Mesh(this.cloudShadowGeo, this.cloudShadowMat);
      mesh.renderOrder = 3;
      mesh.rotation.y = (i * 0.73) % (Math.PI * 2);
      this.cloudShadowGroup.add(mesh);
      const ox = ((i * 37) % 116) - 58;
      const oz = ((i * 53) % 116) - 58;
      const sx = 12 + (i % 5) * 2.6;
      const sz = 9.5 + ((i + 2) % 4) * 2.4;
      this.cloudShadows.push({
        mesh,
        ox,
        oz,
        sx,
        sz,
        phase: i * 1.15,
        speedMult: 0.9 + (i % 3) * 0.12,
      });
    }
    this.dynamicVfxGroup.add(this.cloudShadowGroup);
  }

  // --------------------------------------------------------------------------
  // SCULPTED ARTICULATED 3D PBR HERO — Adol Christin (Full 360° 3D Volume!)
  // --------------------------------------------------------------------------
  private buildAdolRig(): AdolRig {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);

    const parts = buildSculptedHumanoid3D({
      isHero: true,
      costume: 'hero',
      ageGroup: 'adult',
      hairColor: '#dc2626',
      eyeColor: '#b45309',
      tunicColor: '#1d4ed8',
      cloakColor: '#dc2626',
      isLongHair: false,
      castShadow: !this.isSoftwareGl,
      maxAniso: this.maxAniso,
    });
    applyHeroEquipmentTier3D(parts, 0, 0);
    body.add(parts.rigGroup);

    // Real 3D Occluded-Only X-Ray Silhouette (draws ONLY when Adol is hidden behind trees, roofs, or walls!)
    const xray = buildAdolXrayProxy3D();
    body.add(xray.group);

    // Occluded-Only Golden Foot Locator Ring (pinpoints Adol's exact footing behind foliage/buildings!)
    const xrayFootRing = new THREE.Mesh(
      new THREE.RingGeometry(0.46, 0.64, 24),
      new THREE.MeshBasicMaterial({
        color: '#fde047',
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide,
        depthTest: true,
        depthFunc: THREE.GreaterDepth,
        depthWrite: false,
      })
    );
    xrayFootRing.rotation.x = -Math.PI * 0.5;
    xrayFootRing.position.y = 0.06;
    xrayFootRing.renderOrder = 99;
    root.add(xrayFootRing);

    // Soft grounding contact shadow under boots
    const shadowDisc = new THREE.Mesh(
      new THREE.CircleGeometry(0.54, 16),
      new THREE.MeshBasicMaterial({ color: '#09111f', transparent: true, opacity: 0.30, depthWrite: false })
    );
    shadowDisc.rotation.x = -Math.PI * 0.5;
    shadowDisc.position.y = 0.025;
    root.add(shadowDisc);

    // Dynamic Sword Slash Crescent Arc Mesh
    const slashArc = new THREE.Mesh(
      new THREE.RingGeometry(0.68, 1.36, 18, 1, -0.88, 1.76),
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
    slashArc.position.y = 1.12;
    root.add(slashArc);

    // Emerald Standing Auto-Heal Shimmer Ring & Ys II Sapphire Shield Dome
    const healRing = new THREE.Mesh(
      new THREE.RingGeometry(0.54, 0.76, 24),
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
      new THREE.SphereGeometry(1.16, 18, 14),
      new THREE.MeshBasicMaterial({
        color: '#38bdf8',
        transparent: true,
        opacity: 0,
        wireframe: true,
        depthWrite: false,
      })
    );
    shieldDome.position.y = 1.24;
    root.add(shieldDome);

    return {
      root,
      body,
      parts,
      xrayGroup: xray.group,
      xrayMat: xray.mat,
      xrayFootRing,
      weaponTier: 0,
      armorTier: 0,
      slashArc,
      healRing,
      shieldDome,
    };
  }

  // --------------------------------------------------------------------------
  // SCULPTED ARTICULATED 3D PBR NPCs (Adults, Elders & Children!) & MONSTERS
  // --------------------------------------------------------------------------
  private buildNpcRig(npc: WorldNpc): NpcRig {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);

    const ageGroup = resolveNpcAgeGroup(npc);
    const isChild = ageGroup === 'child';
    const traits = resolveNpcCostume(npc);

    const parts = buildSculptedHumanoid3D({
      isHero: false,
      costume: traits.costume,
      ageGroup,
      hairColor: npc.hairColor,
      eyeColor: traits.eyeColor,
      tunicColor: npc.tunicColor,
      cloakColor: npc.cloakColor,
      isLongHair: traits.isLongHair,
      hasBeard: traits.hasBeard,
      castShadow: !this.isSoftwareGl,
      maxAniso: this.maxAniso,
    });
    body.add(parts.rigGroup);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(isChild ? 0.34 : 0.50, 14),
      new THREE.MeshBasicMaterial({ color: '#09111f', transparent: true, opacity: 0.28, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI * 0.5;
    shadow.position.y = 0.025;
    root.add(shadow);

    // Bespoke 3D Sculpted Task Props Mounted Cleanly to the 3D Character's Hand Anchor!
    let propAnchor: THREE.Group | undefined;
    let propPivot: THREE.Group | undefined;
    let extraProp: THREE.Mesh | undefined;
    if (npc.task && npc.task !== 'play' && npc.task !== 'stroll') {
      propAnchor = new THREE.Group();
      if (!isChild) propAnchor.scale.setScalar(1.22);
      propPivot = new THREE.Group();
      propAnchor.add(propPivot);
      parts.handAnchor.add(propAnchor);

      const woodMat = new THREE.MeshStandardMaterial({ color: '#92400e', roughness: 0.8 });
      const metalMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.82, roughness: 0.28 });
      const brassMat = new THREE.MeshStandardMaterial({ color: '#eab308', metalness: 0.8, roughness: 0.25 });

      if (npc.task === 'sweep') {
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 1.08, 6), woodMat);
        handle.position.set(0.24, 0.08, 0.14);
        handle.rotation.z = -0.32;
        const bristles = new THREE.Mesh(
          new THREE.ConeGeometry(0.16, 0.3, 7),
          new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.9 })
        );
        bristles.position.set(0.38, -0.4, 0.14);
        bristles.rotation.z = -0.32;
        propPivot.add(handle, bristles);
      } else if (npc.task === 'water_carry') {
        const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.28, 8), woodMat);
        bucket.position.set(0.30, -0.18, 0.12);
        const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.014, 5, 12), metalMat);
        hoop.rotation.x = Math.PI * 0.5;
        hoop.position.set(0.30, -0.14, 0.12);
        const water = new THREE.Mesh(
          new THREE.CylinderGeometry(0.14, 0.14, 0.03, 8),
          new THREE.MeshBasicMaterial({ color: '#38bdf8' })
        );
        water.position.set(0.30, -0.06, 0.12);
        propPivot.add(bucket, hoop, water);
      } else if (npc.task === 'garden') {
        const can = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.24, 8), brassMat);
        can.position.set(0.28, -0.1, 0.18);
        const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.036, 0.28, 6), brassMat);
        spout.position.set(0.40, -0.04, 0.24);
        spout.rotation.z = -0.92;
        const spray = new THREE.Mesh(
          new THREE.ConeGeometry(0.14, 0.44, 7),
          new THREE.MeshBasicMaterial({ color: '#7dd3fc', transparent: true, opacity: 0.68, depthWrite: false })
        );
        spray.position.set(0.54, -0.26, 0.26);
        spray.rotation.z = -0.35;
        spray.visible = false;
        extraProp = spray;
        propPivot.add(can, spout, spray);
      } else if (npc.task === 'hammer') {
        const haft = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.028, 0.56, 6), woodMat);
        haft.position.set(0.26, 0.16, 0.16);
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.13, 0.13), metalMat);
        head.position.set(0.26, 0.44, 0.16);
        propPivot.add(haft, head);
      } else if (npc.task === 'carry_crate') {
        const crate = new THREE.Mesh(
          new THREE.BoxGeometry(0.46, 0.36, 0.38),
          new THREE.MeshStandardMaterial({ map: this.textures.wood, color: '#d99a56', roughness: 0.78 })
        );
        crate.position.set(0, 0.04, 0.26);
        crate.castShadow = !this.isSoftwareGl;
        const band = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.05, 0.4), metalMat);
        band.position.set(0, 0.04, 0.26);
        propPivot.add(crate, band);
      } else if (npc.task === 'patrol') {
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.028, 1.65, 6), woodMat);
        shaft.position.set(0.32, 0.34, 0.06);
        const blade = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.34, 4), metalMat);
        blade.position.set(0.32, 1.24, 0.06);
        const tassel = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.18, 0.04),
          new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.7 })
        );
        tassel.position.set(0.32, 1.0, 0.06);
        propPivot.add(shaft, blade, tassel);
      } else if (npc.task === 'fish') {
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.03, 1.95, 6), woodMat);
        rod.position.set(0.22, 0.32, 0.68);
        rod.rotation.x = 1.05;
        const bobber = new THREE.Mesh(
          new THREE.SphereGeometry(0.068, 7, 6),
          new THREE.MeshBasicMaterial({ color: '#ef4444' })
        );
        bobber.position.set(0.22, -0.66, 1.62);
        extraProp = bobber;
        propPivot.add(rod, bobber);
      } else if (npc.task === 'serve') {
        const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.036, 12), woodMat);
        tray.position.set(0.16, 0.04, 0.28);
        const mug1 = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.062, 0.14, 8), brassMat);
        mug1.position.set(0.09, 0.12, 0.25);
        const mug2 = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.062, 0.14, 8), brassMat);
        mug2.position.set(0.23, 0.12, 0.32);
        const foam1 = new THREE.Mesh(new THREE.SphereGeometry(0.052, 6, 5), new THREE.MeshBasicMaterial({ color: '#fef9c3' }));
        foam1.position.set(0.09, 0.19, 0.25);
        const foam2 = new THREE.Mesh(new THREE.SphereGeometry(0.052, 6, 5), new THREE.MeshBasicMaterial({ color: '#fef9c3' }));
        foam2.position.set(0.23, 0.19, 0.32);
        propPivot.add(tray, mug1, mug2, foam1, foam2);
      } else if (npc.task === 'read') {
        const coverL = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 0.24, 0.025),
          new THREE.MeshStandardMaterial({ color: '#7c2d12', roughness: 0.7 })
        );
        coverL.position.set(-0.08, 0.04, 0.26);
        coverL.rotation.y = 0.42;
        const coverR = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 0.24, 0.025),
          new THREE.MeshStandardMaterial({ color: '#7c2d12', roughness: 0.7 })
        );
        coverR.position.set(0.08, 0.04, 0.26);
        coverR.rotation.y = -0.42;
        const pages = new THREE.Mesh(
          new THREE.BoxGeometry(0.28, 0.21, 0.025),
          new THREE.MeshBasicMaterial({ color: '#fef3c7' })
        );
        pages.position.set(0, 0.04, 0.24);
        propPivot.add(coverL, coverR, pages);
      } else if (npc.task === 'baker') {
        const tray = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.04, 0.32), woodMat);
        tray.position.set(0.12, 0.04, 0.26);
        const loafMat = new THREE.MeshStandardMaterial({ color: '#d97706', roughness: 0.72 });
        const loaf1 = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), loafMat);
        loaf1.scale.set(1.3, 0.68, 0.9);
        loaf1.position.set(0.02, 0.11, 0.26);
        const loaf2 = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), loafMat);
        loaf2.scale.set(1.25, 0.65, 0.9);
        loaf2.position.set(0.22, 0.11, 0.26);
        propPivot.add(tray, loaf1, loaf2);
      } else if (npc.task === 'craft') {
        const plank = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.06, 0.16), woodMat);
        plank.position.set(0.08, 0.05, 0.26);
        const mallet = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.09), metalMat);
        mallet.position.set(0.24, 0.14, 0.26);
        propPivot.add(plank, mallet);
      }
    }

    const nx = npc.tx + 0.5;
    const nz = npc.ty + 0.5;
    const baseY = this.sampleGroundY(nx, nz);
    root.position.set(nx, baseY, nz);
    return { root, body, parts, baseY, ageGroup, propAnchor, propPivot, extraProp, task: npc.task };
  }

  private buildEnemyRig(e: YsThreeEnemyView): EnemyRig {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);

    const parts = buildSculptedEnemy3D(e.kind, e.color, e.accent, !this.isSoftwareGl);
    body.add(parts.rigGroup);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(e.kind === 'boss' ? 1.32 : e.kind === 'slime' || e.kind === 'goblin' ? 0.48 : 0.68, 16),
      new THREE.MeshBasicMaterial({ color: '#09111f', transparent: true, opacity: 0.32, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI * 0.5;
    shadow.position.y = 0.025;
    root.add(shadow);

    let bossCircle: THREE.Mesh | undefined;
    if (e.kind === 'boss') {
      bossCircle = new THREE.Mesh(
        new THREE.RingGeometry(1.15, 1.52, 24),
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
    return { root, body, kind: e.kind, parts, bossCircle };
  }

  // --------------------------------------------------------------------------
  // Rebuild Full 3D Modern Evo World When Entering a New Zone!
  // --------------------------------------------------------------------------
  private rebuildZoneScene(zone: ZoneDef): void {
    this.clearZoneScene();
    this.smoothCamInit = false;
    this.activeZone = zone;
    this.currentZoneId = zone.id;
    this.currentZoneTheme = zone.theme;
    const g = new THREE.Group();
    this.zoneGroup = g;
    this.scene.add(g);

    const W = zone.width;
    const H = zone.height;
    const isDungeon = zone.theme === 'shrine' || zone.theme === 'tower' || zone.theme === 'lava';
    const isInterior = zone.theme === 'interior';

    // Theme-Matched Vibrant RPG-JS / Pipoya Lighting, Sky & Cozy Candlelit Building Interiors!
    if (isInterior) {
      this.scene.background = new THREE.Color('#140e19');
      this.scene.fog = new THREE.FogExp2('#140e19', 0.008);
      this.hemiLight.color.set('#ffe7c2');
      this.hemiLight.groundColor.set('#4a2c18');
      this.hemiLight.intensity = 1.08;
      this.sunLight.color.set('#ffd9a0');
      this.sunLight.intensity = 1.65;
    } else if (zone.theme === 'shrine') {
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
    const apronColor = isInterior
      ? '#120b14'
      : zone.theme === 'shrine'
        ? '#141a2e'
        : zone.theme === 'tower' || zone.theme === 'lava'
          ? '#1e0c18'
          : zone.theme === 'ice'
            ? '#7cb5da'
            : zone.theme === 'town'
              ? '#1e6e94'
              : '#1f8a34';
    const apronMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(W + 680, H + 680),
      new THREE.MeshStandardMaterial({ color: apronColor, roughness: 0.88 })
    );
    apronMesh.rotation.x = -Math.PI * 0.5;
    apronMesh.position.set(W * 0.5, -2.55, H * 0.5);
    apronMesh.receiveShadow = true;
    g.add(apronMesh);

    // Sculpted 3D Diorama Earth & Bedrock Side Slab only for interior rooms & enclosed dungeons (never cuts off outdoor ocean/horizons!)
    if (isInterior || isDungeon) {
      const slabMat = new THREE.MeshStandardMaterial({
        map: isInterior ? this.archTextures.plankWood : this.textures.mine,
        color: isInterior ? '#4a2e1b' : '#3b3f52',
        roughness: 0.9,
      });
      const slabMesh = new THREE.Mesh(new THREE.BoxGeometry(W + 0.4, 1.65, H + 0.4), slabMat);
      slabMesh.position.set(W * 0.5, isInterior ? -0.84 : -1.58, H * 0.5);
      slabMesh.receiveShadow = true;
      g.add(slabMesh);
    }

    const zoneTerrainTex = buildRpgJsZoneTerrainTexture(zone, this.maxAniso);
    this.zoneOwnedTextures.push(zoneTerrainTex);

    // 2x Subdivided Terrain Grid on GPU for crisp, symmetric terraced slopes & smooth carved shorelines!
    const seg = this.isSoftwareGl || isInterior ? 1 : 2;
    const terrainGeo = new THREE.PlaneGeometry(W, H, W * seg, H * seg);
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
        roughness: isInterior ? 0.62 : zone.theme === 'ice' ? 0.28 : 0.85,
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
      const pilingGeo = new THREE.CylinderGeometry(0.085, 0.11, 2.15, 6);
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
          pile.position.set(c + 0.1, -0.88, r + 0.5);
          g.add(p, rail, pile);
        }
        if (waterRight) {
          const p = new THREE.Mesh(postGeo, postMat);
          p.position.set(c + 0.92, 0.48, r + 0.5);
          p.castShadow = !this.isSoftwareGl;
          const rail = new THREE.Mesh(railZGeo, postMat);
          rail.position.set(c + 0.92, 0.72, r + 0.5);
          const pile = new THREE.Mesh(pilingGeo, pilingMat);
          pile.position.set(c + 0.9, -0.88, r + 0.5);
          g.add(p, rail, pile);
        }
        if (waterNorth) {
          const p = new THREE.Mesh(postGeo, postMat);
          p.position.set(c + 0.5, 0.48, r + 0.08);
          p.castShadow = !this.isSoftwareGl;
          const rail = new THREE.Mesh(railXGeo, postMat);
          rail.position.set(c + 0.5, 0.72, r + 0.08);
          const pile = new THREE.Mesh(pilingGeo, pilingMat);
          pile.position.set(c + 0.5, -0.88, r + 0.1);
          g.add(p, rail, pile);
        }
        if (waterSouth) {
          const p = new THREE.Mesh(postGeo, postMat);
          p.position.set(c + 0.5, 0.48, r + 0.92);
          p.castShadow = !this.isSoftwareGl;
          const rail = new THREE.Mesh(railXGeo, postMat);
          rail.position.set(c + 0.5, 0.72, r + 0.92);
          const pile = new THREE.Mesh(pilingGeo, pilingMat);
          pile.position.set(c + 0.5, -0.88, r + 0.9);
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

      // Seamless Endless 3D Outer Ocean Horizon for Coastal Towns (exact same GPU Gerstner wave waterMat at waterY = -0.05!)
      // Stretches 320 units south, west, and east past Minea's piers over a deep ocean floor so piers look out onto pure endless sea!
      if (zone.theme === 'town' && !isLava && !isSky) {
        const seaReach = 320;
        const coastLineZ = 70;
        const deepFloorMat = new THREE.MeshStandardMaterial({ color: '#04243e', roughness: 0.95 });
        const deepFloorMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(W + seaReach * 2 + 12, seaReach + (H - coastLineZ) + 12),
          deepFloorMat
        );
        deepFloorMesh.rotation.x = -Math.PI * 0.5;
        deepFloorMesh.position.set(W * 0.5, -2.2, coastLineZ + (seaReach + (H - coastLineZ)) * 0.5);
        g.add(deepFloorMesh);

        const sPos: number[] = [];
        const sNorm: number[] = [];
        const sUv: number[] = [];
        const sShore: number[] = [];
        const sIdx: number[] = [];
        let sv = 0;

        const addOceanPatch = (
          xMin: number,
          xMax: number,
          zMin: number,
          zMax: number,
          segX: number,
          segZ: number,
          stretchSouth: boolean,
          northShoreFoam: boolean
        ) => {
          const base = sv;
          const cols = segX + 1;
          const rows = segZ + 1;
          for (let iz = 0; iz <= segZ; iz++) {
            const tz = iz / segZ;
            // Denser wave mesh resolution right near the harbor & piers, stretching smoothly out to 320 units!
            const tzDist = stretchSouth ? tz * tz * 0.78 + tz * 0.22 : tz;
            const wz = zMin + (zMax - zMin) * tzDist;
            const shoreVal = northShoreFoam ? Math.max(0, 1 - (wz - zMin) / 2.2) * 0.55 : 0;
            for (let ix = 0; ix <= segX; ix++) {
              const tx = ix / segX;
              const wx = xMin + (xMax - xMin) * tx;
              sPos.push(wx, waterY, wz);
              sNorm.push(0, 1, 0);
              sUv.push(wx / W, wz / H);
              sShore.push(shoreVal);
              sv++;
            }
          }
          for (let iz = 0; iz < segZ; iz++) {
            for (let ix = 0; ix < segX; ix++) {
              const a = base + iz * cols + ix;
              const b = a + cols;
              const c = b + 1;
              const d = a + 1;
              sIdx.push(a, b, c, a, c, d);
            }
          }
          void rows;
        };

        // 1) Vast South Endless Ocean beyond z = H (seamless with harbor south edge!)
        addOceanPatch(-seaReach, W + seaReach, H, H + seaReach, 48, 28, true, false);
        // 2) West Open Sea flanking the western harbor & coastline (z = 70..H)
        addOceanPatch(-seaReach, 0, coastLineZ, H, 22, 8, false, true);
        // 3) East Open Sea flanking the eastern harbor & coastline (z = 70..H)
        addOceanPatch(W, W + seaReach, coastLineZ, H, 22, 8, false, true);

        const outerSeaGeo = new THREE.BufferGeometry();
        outerSeaGeo.setAttribute('position', new THREE.Float32BufferAttribute(sPos, 3));
        outerSeaGeo.setAttribute('normal', new THREE.Float32BufferAttribute(sNorm, 3));
        outerSeaGeo.setAttribute('uv', new THREE.Float32BufferAttribute(sUv, 2));
        outerSeaGeo.setAttribute('aShore', new THREE.Float32BufferAttribute(sShore, 1));
        outerSeaGeo.setIndex(sIdx);
        outerSeaGeo.computeBoundingSphere();

        const outerSeaMesh = new THREE.Mesh(outerSeaGeo, waterMat);
        outerSeaMesh.receiveShadow = true;
        outerSeaMesh.renderOrder = 2;
        g.add(outerSeaMesh);
      }

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

    // 2D. Non-Brick Impassable Mossy Forest Embankments (Outdoors) OR Cutaway Interior / Dungeon / Ice Walls!
    if (cliffTiles.length > 0) {
      const isNaturalOutdoor = !isInterior && !isDungeon && zone.theme !== 'ice';
      if (isNaturalOutdoor) {
        // Natural Impassable Transitional Mossy Earth Embankments, Weathered Boulders & Dense Underbrush (ZERO brick!)
        const moundMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.92 });
        const boulderMat = new THREE.MeshStandardMaterial({ color: '#788078', roughness: 0.88 });
        const brushMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.78 });
        attachGpuFoliagePhysics(brushMat, this.sharedUniforms, 0.06, 0.0);

        const moundGeo = new THREE.DodecahedronGeometry(0.76, 1);
        const boulderGeo = new THREE.DodecahedronGeometry(0.46, 0);
        const brushGeo = new THREE.IcosahedronGeometry(0.58, 1);

        const moundInst = new THREE.InstancedMesh(moundGeo, moundMat, cliffTiles.length);
        const boulderInst = new THREE.InstancedMesh(boulderGeo, boulderMat, cliffTiles.length);
        const brushInst = new THREE.InstancedMesh(brushGeo, brushMat, cliffTiles.length);
        moundInst.receiveShadow = true;
        moundInst.castShadow = !this.isSoftwareGl;
        boulderInst.castShadow = !this.isSoftwareGl;
        boulderInst.receiveShadow = true;
        brushInst.castShadow = !this.isSoftwareGl;
        brushInst.receiveShadow = true;

        cliffTiles.forEach(([c, r], i) => {
          const gy = this.sampleGroundY(c + 0.5, r + 0.5);
          const h1 = hash2d(c, r, 401);
          const h2 = hash2d(c, r, 407);
          const h3 = hash2d(c, r, 413);

          // Mossy overgrown earth mound
          _dummy.position.set(c + 0.5 + (h1 - 0.5) * 0.16, gy + 0.34, r + 0.5 + (h2 - 0.5) * 0.16);
          _dummy.rotation.set(h1 * 0.4, h2 * Math.PI * 2, h3 * 0.4);
          _dummy.scale.set(1.08 + h1 * 0.25, 0.72 + h2 * 0.48, 1.08 + h3 * 0.25);
          _dummy.updateMatrix();
          moundInst.setMatrixAt(i, _dummy.matrix);
          moundInst.setColorAt(
            i,
            _color.set(zone.theme === 'ruins' ? (h1 > 0.5 ? '#2d6e35' : '#4a6b48') : h1 > 0.5 ? '#167a29' : '#1f8f34')
          );

          // Embedded mossy crag rock / weathered stone
          _dummy.position.set(c + 0.5 + (h2 - 0.5) * 0.42, gy + 0.42 + h1 * 0.22, r + 0.5 + (h3 - 0.5) * 0.42);
          _dummy.rotation.set(h3 * Math.PI, h1 * Math.PI, h2 * Math.PI);
          _dummy.scale.set(0.85 + h1 * 0.55, 0.75 + h3 * 0.55, 0.85 + h2 * 0.55);
          _dummy.updateMatrix();
          boulderInst.setMatrixAt(i, _dummy.matrix);

          // Dense impassable emerald bramble / fern thicket crowning the embankment
          _dummy.position.set(c + 0.5 + (h3 - 0.5) * 0.24, gy + 0.92 + h2 * 0.34, r + 0.5 + (h1 - 0.5) * 0.24);
          _dummy.rotation.set(0, h1 * Math.PI * 2, 0);
          _dummy.scale.set(1.05 + h2 * 0.4, 0.82 + h3 * 0.45, 1.05 + h1 * 0.4);
          _dummy.updateMatrix();
          brushInst.setMatrixAt(i, _dummy.matrix);
          brushInst.setColorAt(i, _color.set(h3 < 0.33 ? '#147d2a' : h3 < 0.68 ? '#1fa138' : '#2eb848'));
        });
        if (moundInst.instanceColor) moundInst.instanceColor.needsUpdate = true;
        if (brushInst.instanceColor) brushInst.instanceColor.needsUpdate = true;
        moundInst.computeBoundingSphere();
        boulderInst.computeBoundingSphere();
        brushInst.computeBoundingSphere();
        g.add(moundInst, boulderInst, brushInst);
      } else {
        // Crisp Cutaway Interior Wainscoting, Dungeon Stone Masonry, or Crystalline Ice Cliffs
        const wallH = isInterior ? 2.55 : isDungeon ? 2.45 : 2.15;
        const wallMat = new THREE.MeshStandardMaterial({
          map: isInterior
            ? this.textures.plaster
            : zone.theme === 'ice'
              ? this.textures.ice
              : this.textures.mine,
          color: isInterior
            ? '#efe2cb'
            : zone.theme === 'tower' || zone.theme === 'lava'
              ? '#7a3359'
              : '#ffffff',
          roughness: zone.theme === 'ice' ? 0.22 : 0.84,
        });
        const baseLedgeMat = new THREE.MeshStandardMaterial({
          map: isInterior ? this.archTextures.plankWood : undefined,
          color: isInterior
            ? '#6b3e1f'
            : zone.theme === 'ice'
              ? '#7ab8dc'
              : '#383c4c',
          roughness: 0.86,
        });
        const capMat = new THREE.MeshStandardMaterial({
          color: isInterior
            ? '#4a2b14'
            : zone.theme === 'ice'
              ? '#cde9f9'
              : zone.theme === 'tower' || zone.theme === 'lava'
                ? '#4a1d35'
                : '#4b4d5a',
          roughness: 0.82,
        });
        const baseInst = new THREE.InstancedMesh(
          new THREE.BoxGeometry(isInterior ? 1.06 : 1.16, isInterior ? 0.92 : 0.58, isInterior ? 1.06 : 1.16),
          baseLedgeMat,
          cliffTiles.length
        );
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
          const isCutawayFront = isInterior && (r >= H - 2 || c >= W - 2);
          const hJitter = isCutawayFront ? 0.26 : isInterior || isDungeon ? 1.0 : 0.92 + hash2d(c, r, 401) * 0.24;
          const hCur = wallH * hJitter;
          _dummy.position.set(c + 0.5, gy + (isInterior ? Math.min(0.46, hCur * 0.5) : 0.18), r + 0.5);
          _dummy.rotation.set(0, 0, 0);
          _dummy.scale.set(1, isCutawayFront ? 0.55 : 1, 1);
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

          if (!isInterior && isDungeon && (c + r) % 2 === 0) {
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
    }

    // 2E. Architecturally Diverse 3D Medieval Buildings (1-Story Verandas, 2-Story Jetty Timber, Turret Observatories,
    //     Cross-Gabled Guildhalls, L-Wing Courtyard Inns, Open Smithy Foundries, Glass Conservatories & Gambrel Taverns!)
    if (zone.buildings && zone.buildings.length > 0) {
      const frontMat = new THREE.MeshStandardMaterial({ map: this.archTextures.houseFront, roughness: 0.78 });
      const sideMat = new THREE.MeshStandardMaterial({ map: this.archTextures.houseSide, roughness: 0.8 });
      const wallMats = [sideMat, sideMat, sideMat, sideMat, frontMat, sideMat];
      const plasterMat = new THREE.MeshStandardMaterial({ color: '#f0e1c6', roughness: 0.84 });
      const warmStoneWallMat = new THREE.MeshStandardMaterial({ color: '#8f969e', roughness: 0.88 });
      const timberMat = new THREE.MeshStandardMaterial({ map: this.archTextures.plankWood, color: '#6b3e20', roughness: 0.82 });
      const darkOakMat = new THREE.MeshStandardMaterial({ color: '#452512', roughness: 0.85 });
      const stoneMat = new THREE.MeshStandardMaterial({ color: '#7b8594', roughness: 0.86 });
      const quoinMat = new THREE.MeshStandardMaterial({ color: '#9ca6b4', roughness: 0.78 });
      const ironMat = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.86, roughness: 0.3 });
      const brassMat = new THREE.MeshStandardMaterial({ color: '#eab308', metalness: 0.88, roughness: 0.24 });
      const glassPaneMat = new THREE.MeshStandardMaterial({
        color: '#bae6fd',
        emissive: '#38bdf8',
        emissiveIntensity: 0.22,
        roughness: 0.14,
        metalness: 0.18,
        transparent: true,
        opacity: 0.44,
        side: THREE.DoubleSide,
      });
      const whiteTrimMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.65 });
      const windowGlowMat = new THREE.MeshStandardMaterial({
        color: '#fef3c7',
        emissive: '#f59e0b',
        emissiveIntensity: 0.86,
        roughness: 0.22,
      });
      const mysticWinMat = new THREE.MeshStandardMaterial({
        color: '#e9d5ff',
        emissive: '#a855f7',
        emissiveIntensity: 1.05,
        roughness: 0.18,
      });
      const shutterMat = new THREE.MeshStandardMaterial({ color: '#3b5d7a', roughness: 0.72 });
      const boxMat = new THREE.MeshStandardMaterial({ color: '#9a4320', roughness: 0.82 });
      const vineLeafMat = new THREE.MeshStandardMaterial({ color: '#22a838', roughness: 0.72 });
      const bloomRedMat = new THREE.MeshStandardMaterial({ color: '#f43f5e', roughness: 0.62 });
      const bloomGoldMat = new THREE.MeshStandardMaterial({ color: '#fde047', roughness: 0.6 });
      const bannerBlueMat = new THREE.MeshStandardMaterial({ color: '#1d4ed8', roughness: 0.7, side: THREE.DoubleSide });
      const emberMat = new THREE.MeshStandardMaterial({
        color: '#fb923c',
        emissive: '#ea580c',
        emissiveIntensity: 2.0,
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

      const defaultArchStyle = (signKind: WorldBuilding['signKind']): BuildingArchStyle => {
        switch (signKind) {
          case 'weapon':
            return 'smithery_foundry';
          case 'fortune':
            return 'observatory_parlor';
          case 'guild':
          case 'library':
            return 'grand_guildhall';
          case 'inn':
            return 'l_wing_inn';
          case 'tavern':
            return 'longhouse_tavern';
          case 'clinic':
            return 'apothecary_conservatory';
          case 'armor':
          case 'elder':
            return 'two_story_timber';
          default:
            return 'one_story_cottage';
        }
      };

      // Helper to add a pitched gable roof + solid gable ends + ridge beam to any wing
      const addPitchedRoof = (
        parent: THREE.Group,
        rx: number,
        baseY: number,
        rz: number,
        w: number,
        d: number,
        peakH: number,
        rMat: THREE.MeshStandardMaterial,
        rotate90 = false,
        withFinials = true
      ): void => {
        const rg = new THREE.Group();
        rg.position.set(rx, baseY, rz);
        if (rotate90) rg.rotation.y = Math.PI * 0.5;
        const spanW = rotate90 ? d : w;
        const spanD = rotate90 ? w : d;

        const gShape = new THREE.Shape();
        gShape.moveTo(-spanD * 0.5, 0);
        gShape.lineTo(spanD * 0.5, 0);
        gShape.lineTo(0, peakH);
        gShape.closePath();
        const gGeo = new THREE.ExtrudeGeometry(gShape, { depth: spanW - 0.04, bevelEnabled: false });
        gGeo.rotateY(Math.PI * 0.5);
        gGeo.translate(-(spanW - 0.04) * 0.5, 0, 0);
        const gMesh = new THREE.Mesh(gGeo, plasterMat);
        gMesh.castShadow = !this.isSoftwareGl;
        gMesh.receiveShadow = true;
        rg.add(gMesh);

        // Exposed king-post & collar truss on both gable ends
        for (const sgn of [-1, 1]) {
          const gx = sgn * (spanW * 0.5 + 0.01);
          const kp = new THREE.Mesh(new THREE.BoxGeometry(0.1, peakH * 0.9, 0.14), timberMat);
          kp.position.set(gx, peakH * 0.45, 0);
          const col = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, spanD * 0.56), timberMat);
          col.position.set(gx, peakH * 0.4, 0);
          rg.add(kp, col);
          if (withFinials) {
            const fin = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.38, 6), brassMat);
            fin.position.set(sgn * (spanW * 0.5 + 0.28), peakH + 0.24, 0);
            rg.add(fin);
          }
        }

        const halfSpan = spanD * 0.5 + 0.38;
        const slopeLen = Math.hypot(halfSpan, peakH + 0.14);
        const slopeAngle = Math.atan2(peakH + 0.14, halfSpan);
        const sFront = new THREE.Mesh(new THREE.BoxGeometry(spanW + 0.66, 0.18, slopeLen), rMat);
        sFront.position.set(0, peakH * 0.52, halfSpan * 0.48);
        sFront.rotation.x = slopeAngle;
        sFront.castShadow = !this.isSoftwareGl;
        sFront.receiveShadow = true;
        const sBack = new THREE.Mesh(new THREE.BoxGeometry(spanW + 0.66, 0.18, slopeLen), rMat);
        sBack.position.set(0, peakH * 0.52, -halfSpan * 0.48);
        sBack.rotation.x = -slopeAngle;
        sBack.castShadow = !this.isSoftwareGl;
        sBack.receiveShadow = true;
        const ridge = new THREE.Mesh(new THREE.BoxGeometry(spanW + 0.74, 0.22, 0.26), darkOakMat);
        ridge.position.set(0, peakH + 0.08, 0);
        ridge.castShadow = !this.isSoftwareGl;
        rg.add(sFront, sBack, ridge);
        parent.add(rg);
      };

      // Helper to add a 3D framed glowing window + shutters + optional flower box on front/side wall
      const addFramedWindow = (
        parent: THREE.Group,
        wx: number,
        wy: number,
        wz: number,
        facing: 'front' | 'left' | 'right',
        glowMat: THREE.MeshStandardMaterial = windowGlowMat,
        withFlowers = true
      ): void => {
        const wg = new THREE.Group();
        wg.position.set(wx, wy, wz);
        if (facing === 'left') wg.rotation.y = -Math.PI * 0.5;
        else if (facing === 'right') wg.rotation.y = Math.PI * 0.5;
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.12), darkOakMat);
        const glass = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.54, 0.14), glowMat);
        const mv = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.54, 0.16), darkOakMat);
        const mh = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.05, 0.16), darkOakMat);
        const shL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.64, 0.08), shutterMat);
        shL.position.set(-0.5, 0, 0);
        const shR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.64, 0.08), shutterMat);
        shR.position.set(0.5, 0, 0);
        wg.add(frame, glass, mv, mh, shL, shR);
        if (withFlowers) {
          // Real sculpted hanging timber window flower box + iron brackets + dark soil + wind-swaying plants & blossoms!
          const fb = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.22, 0.3), boxMat);
          fb.position.set(0, -0.42, 0.14);
          fb.castShadow = !this.isSoftwareGl;
          const rim = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.05, 0.34), darkOakMat);
          rim.position.set(0, -0.31, 0.14);
          const soil = new THREE.Mesh(
            new THREE.BoxGeometry(0.86, 0.05, 0.24),
            new THREE.MeshStandardMaterial({ color: '#3b2414', roughness: 0.95 })
          );
          soil.position.set(0, -0.3, 0.14);
          const brkL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.22), ironMat);
          brkL.position.set(-0.34, -0.54, 0.08);
          const brkR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.22), ironMat);
          brkR.position.set(0.34, -0.54, 0.08);
          wg.add(fb, rim, soil, brkL, brkR);

          // Swaying foliage & colorful blossoms pivoted at soil surface!
          const plantPivot = new THREE.Group();
          plantPivot.position.set(0, -0.29, 0.15);
          const leafCols = [vineLeafMat, new THREE.MeshStandardMaterial({ color: '#22c55e', roughness: 0.72 })];
          for (let fi = -2; fi <= 2; fi++) {
            const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.115, 1), leafCols[Math.abs(fi) % 2]);
            bush.scale.set(1.15, 0.85, 0.95);
            bush.position.set(fi * 0.17, 0.07 + (fi % 2 === 0 ? 0.03 : 0), (fi % 2) * 0.03);
            plantPivot.add(bush);
            const flMat = fi % 3 === 0 ? bloomGoldMat : bloomRedMat;
            const fl = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 5), flMat);
            fl.position.set(fi * 0.17 + 0.02, 0.17 + (fi % 2 === 0 ? 0.04 : 0), 0.04);
            plantPivot.add(fl);
          }
          // Cascading ivy tendrils hanging gracefully over the front of the planter box
          for (const tx of [-0.3, 0.02, 0.31]) {
            const ivy = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.012, 0.34, 5), vineLeafMat);
            ivy.position.set(tx, -0.14, 0.14);
            ivy.rotation.x = 0.22;
            plantPivot.add(ivy);
          }
          wg.add(plantPivot);
          this.treeMovingParts.push({
            obj: plantPivot,
            baseRx: 0,
            baseRy: 0,
            baseRz: 0,
            ampX: 0.1,
            ampZ: 0.13,
            speed: 2.3 + Math.abs(wx) * 0.15,
            phase: wx * 1.7 + wz * 2.1,
            wx,
            wz,
          });
        }
        parent.add(wg);
      };

      // Helper to add a pitched dormer window
      const addDormer = (parent: THREE.Group, dx: number, dy: number, dz: number, rMat: THREE.MeshStandardMaterial): void => {
        const dorm = new THREE.Group();
        const dBox = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.76, 0.78), plasterMat);
        dBox.castShadow = !this.isSoftwareGl;
        const dFrame = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.54, 0.08), darkOakMat);
        dFrame.position.set(0, 0.02, 0.39);
        const dGlass = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.4, 0.1), windowGlowMat);
        dGlass.position.set(0, 0.02, 0.39);
        const dRoofL = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.1, 0.98), rMat);
        dRoofL.position.set(-0.26, 0.48, 0.04);
        dRoofL.rotation.z = 0.52;
        const dRoofR = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.1, 0.98), rMat);
        dRoofR.position.set(0.26, 0.48, 0.04);
        dRoofR.rotation.z = -0.52;
        dorm.add(dBox, dFrame, dGlass, dRoofL, dRoofR);
        dorm.position.set(dx, dy, dz);
        parent.add(dorm);
      };

      // Helper to add chimney + curling animated 3D smoke puffs
      const addChimneyWithSmoke = (
        parent: THREE.Group,
        cxWorld: number,
        groundY: number,
        czWorld: number,
        chX: number,
        chY: number,
        chZ: number,
        width = 0.56,
        height = 1.6,
        seedOffset = 0
      ): void => {
        const chim = new THREE.Mesh(new THREE.BoxGeometry(width, height, width), stoneMat);
        chim.position.set(chX, chY, chZ);
        chim.castShadow = !this.isSoftwareGl;
        const chimCap = new THREE.Mesh(new THREE.BoxGeometry(width + 0.14, 0.16, width + 0.14), quoinMat);
        chimCap.position.set(chX, chY + height * 0.5 + 0.04, chZ);
        const pot1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.24, 8), boxMat);
        pot1.position.set(chX - width * 0.22, chY + height * 0.5 + 0.2, chZ);
        const pot2 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.24, 8), boxMat);
        pot2.position.set(chX + width * 0.22, chY + height * 0.5 + 0.2, chZ);
        parent.add(chim, chimCap, pot1, pot2);

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
          const sx = cxWorld + chX;
          const sy = groundY + chY + height * 0.5 + 0.36;
          const sz = czWorld + chZ;
          puff.position.set(sx, sy, sz);
          g.add(puff);
          this.chimneySmokes.push({
            mesh: puff,
            ox: sx,
            oy: sy,
            oz: sz,
            phase: s * 0.333 + hash2d(Math.round(cxWorld) + seedOffset, Math.round(czWorld), 911) * 0.4,
            speed: 0.26 + hash2d(Math.round(cxWorld), Math.round(czWorld) + s + seedOffset, 912) * 0.08,
          });
        }
      };

      for (const b of zone.buildings) {
        const bGrp = new THREE.Group();
        const cx = b.tx + b.w * 0.5;
        const cz = b.ty + b.h * 0.5;
        const groundY = this.sampleGroundY(cx, cz);
        const wallW = b.w - 0.14;
        const wallD = b.h - 0.16;
        const rMat = roofMats[b.roofStyle] ?? roofMats.crimson;
        const style: BuildingArchStyle = b.archStyle ?? defaultArchStyle(b.signKind);

        // 1. Reinforced Cut-Stone Foundation Plinth + Water-Table Ledge
        const plinth = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.24, 1.24, b.h + 0.24), stoneMat);
        plinth.position.y = -0.32;
        plinth.receiveShadow = true;
        plinth.castShadow = !this.isSoftwareGl;
        const plinthCap = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.3, 0.12, b.h + 0.3), quoinMat);
        plinthCap.position.y = 0.28;
        plinthCap.receiveShadow = true;
        bGrp.add(plinth, plinthCap);

        const frontZ = wallD * 0.5 + 0.04;
        let doorX = 0;
        let doorZ = frontZ;
        let skipDefaultAwning = false;
        let chimneyPos: [number, number, number] = [wallW * 0.28, 3.6, -wallD * 0.14];

        // 2. Build One of 8 Truly Distinct 3D Architectural Layouts!
        if (style === 'one_story_cottage') {
          // LOW 1-STORY VERANDA COTTAGE: Cozy height + wide timber front veranda porch + sloping side storage shed!
          const mainW = wallW * 0.78;
          const mainD = wallD * 0.78;
          const mainX = -wallW * 0.08;
          const mainZ = -wallD * 0.1;
          const wallH = 1.62;
          const peakH = 1.32;

          const body = new THREE.Mesh(new THREE.BoxGeometry(mainW, wallH, mainD), wallMats);
          body.position.set(mainX, 0.32 + wallH * 0.5, mainZ);
          body.castShadow = !this.isSoftwareGl;
          body.receiveShadow = true;
          bGrp.add(body);

          addPitchedRoof(bGrp, mainX, 0.32 + wallH, mainZ, mainW, mainD, peakH, rMat, false, true);

          // Full-front covered wooden veranda porch with 4 timber posts & balustrade rail!
          const porchD = 1.15;
          const porchZ = mainZ + mainD * 0.5 + porchD * 0.5;
          const porchDeck = new THREE.Mesh(new THREE.BoxGeometry(mainW + 0.16, 0.16, porchD + 0.1), timberMat);
          porchDeck.position.set(mainX, 0.36, porchZ);
          porchDeck.receiveShadow = true;
          const porchRoof = new THREE.Mesh(new THREE.BoxGeometry(mainW + 0.4, 0.14, porchD + 0.38), rMat);
          porchRoof.position.set(mainX, 0.32 + wallH - 0.08, porchZ + 0.06);
          porchRoof.rotation.x = 0.26;
          porchRoof.castShadow = !this.isSoftwareGl;
          bGrp.add(porchDeck, porchRoof);

          const postXs = [-mainW * 0.46, -mainW * 0.16, mainW * 0.16, mainW * 0.46];
          for (const px of postXs) {
            const p = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, wallH - 0.14, 6), timberMat);
            p.position.set(mainX + px, 0.32 + (wallH - 0.14) * 0.5, porchZ + porchD * 0.42);
            p.castShadow = !this.isSoftwareGl;
            bGrp.add(p);
          }
          // Left & right porch rails leaving center stairs open
          for (const sideSgn of [-1, 1]) {
            const rail = new THREE.Mesh(new THREE.BoxGeometry(mainW * 0.3, 0.08, 0.08), darkOakMat);
            rail.position.set(mainX + sideSgn * (mainW * 0.31), 0.92, porchZ + porchD * 0.42);
            bGrp.add(rail);
          }

          // Side timber storage shed annex on right with sloping lean-to roof!
          const shedW = wallW * 0.22;
          const shedX = mainX + mainW * 0.5 + shedW * 0.5 - 0.05;
          const shedH = 1.24;
          const shedBody = new THREE.Mesh(new THREE.BoxGeometry(shedW, shedH, mainD * 0.78), timberMat);
          shedBody.position.set(shedX, 0.32 + shedH * 0.5, mainZ);
          shedBody.castShadow = !this.isSoftwareGl;
          const shedRoof = new THREE.Mesh(new THREE.BoxGeometry(shedW + 0.32, 0.12, mainD * 0.88), rMat);
          shedRoof.position.set(shedX + 0.06, 0.32 + shedH + 0.08, mainZ);
          shedRoof.rotation.z = -0.34;
          shedRoof.castShadow = !this.isSoftwareGl;
          bGrp.add(shedBody, shedRoof);

          addFramedWindow(bGrp, mainX - mainW * 0.28, 1.22, mainZ + mainD * 0.5 + 0.04, 'front');
          addFramedWindow(bGrp, mainX + mainW * 0.28, 1.22, mainZ + mainD * 0.5 + 0.04, 'front');
          addFramedWindow(bGrp, mainX - mainW * 0.5 - 0.04, 1.22, mainZ, 'left');

          doorX = mainX;
          doorZ = mainZ + mainD * 0.5 + 0.04;
          skipDefaultAwning = true;
          chimneyPos = [mainX - mainW * 0.24, 0.32 + wallH + peakH * 0.7, mainZ - mainD * 0.14];
        } else if (style === 'two_story_timber') {
          // TALL 2-STORY OVERHANGING JETTY HALF-TIMBERED HOUSE + 2ND-FLOOR JULIET BALCONY + TWIN DORMERS!
          const groundH = 1.48;
          const upperH = 1.48;
          const totalH = groundH + upperH;
          const peakH = 1.65;

          // Cut-stone ground floor story
          const lowerWalls = new THREE.Mesh(new THREE.BoxGeometry(wallW - 0.24, groundH, wallD - 0.24), warmStoneWallMat);
          lowerWalls.position.y = 0.32 + groundH * 0.5;
          lowerWalls.castShadow = !this.isSoftwareGl;
          lowerWalls.receiveShadow = true;

          // Cantilevered overhanging upper half-timbered 2nd story (wider by +0.42!)
          const upperW = wallW + 0.26;
          const upperD = wallD + 0.22;
          const upperWalls = new THREE.Mesh(new THREE.BoxGeometry(upperW, upperH, upperD), wallMats);
          upperWalls.position.y = 0.32 + groundH + upperH * 0.5;
          upperWalls.castShadow = !this.isSoftwareGl;
          upperWalls.receiveShadow = true;

          // Heavy oak jetty belt & protruding timber brackets supporting the 2nd floor overhang!
          const jettyBelt = new THREE.Mesh(new THREE.BoxGeometry(upperW + 0.16, 0.18, upperD + 0.16), darkOakMat);
          jettyBelt.position.y = 0.32 + groundH;
          bGrp.add(lowerWalls, upperWalls, jettyBelt);

          const bracketGeo = new THREE.BoxGeometry(0.16, 0.32, 0.38);
          for (let i = 0; i < 6; i++) {
            const bx = -wallW * 0.42 + (i / 5) * (wallW * 0.84);
            const brk = new THREE.Mesh(bracketGeo, darkOakMat);
            brk.position.set(bx, 0.32 + groundH - 0.16, wallD * 0.5);
            bGrp.add(brk);
          }

          // 2nd-Floor Timber Juliet Balcony jutting above front doorway!
          const balW = 2.8;
          const balZ = upperD * 0.5 + 0.36;
          const balFloor = new THREE.Mesh(new THREE.BoxGeometry(balW, 0.14, 0.72), timberMat);
          balFloor.position.set(0, 0.32 + groundH + 0.08, balZ);
          const balRailTop = new THREE.Mesh(new THREE.BoxGeometry(balW, 0.08, 0.08), darkOakMat);
          balRailTop.position.set(0, 0.32 + groundH + 0.66, balZ + 0.32);
          bGrp.add(balFloor, balRailTop);
          for (let bi = -3; bi <= 3; bi++) {
            const balust = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.54, 0.07), timberMat);
            balust.position.set(bi * 0.42, 0.32 + groundH + 0.38, balZ + 0.32);
            bGrp.add(balust);
          }

          addPitchedRoof(bGrp, 0, 0.32 + totalH, 0, upperW, upperD, peakH, rMat, false, true);
          addDormer(bGrp, -upperW * 0.24, 0.32 + totalH + peakH * 0.46, upperD * 0.26, rMat);
          addDormer(bGrp, upperW * 0.24, 0.32 + totalH + peakH * 0.46, upperD * 0.26, rMat);

          // Upper & lower windows
          addFramedWindow(bGrp, -upperW * 0.32, 0.32 + groundH + upperH * 0.52, upperD * 0.5 + 0.04, 'front');
          addFramedWindow(bGrp, 0, 0.32 + groundH + upperH * 0.52, upperD * 0.5 + 0.04, 'front', windowGlowMat, false);
          addFramedWindow(bGrp, upperW * 0.32, 0.32 + groundH + upperH * 0.52, upperD * 0.5 + 0.04, 'front');
          addFramedWindow(bGrp, -wallW * 0.3, 0.32 + groundH * 0.54, (wallD - 0.24) * 0.5 + 0.04, 'front', windowGlowMat, false);
          addFramedWindow(bGrp, wallW * 0.3, 0.32 + groundH * 0.54, (wallD - 0.24) * 0.5 + 0.04, 'front', windowGlowMat, false);
          addFramedWindow(bGrp, -upperW * 0.5 - 0.04, 0.32 + groundH + upperH * 0.52, 0, 'left');
          addFramedWindow(bGrp, upperW * 0.5 + 0.04, 0.32 + groundH + upperH * 0.52, 0, 'right');

          doorZ = (wallD - 0.24) * 0.5 + 0.04;
          chimneyPos = [upperW * 0.3, 0.32 + totalH + peakH * 0.72, -upperD * 0.14];
        } else if (style === 'smithery_foundry') {
          // ASYMMETRIC BLACKSMITH FOUNDRY: Stone Workshop + Open-Sided Timber Forge Lean-To + Giant Tapered Furnace Stack!
          const shopW = wallW * 0.62;
          const shopX = -wallW * 0.19;
          const shopH = 2.02;
          const peakH = 1.48;

          const shopBody = new THREE.Mesh(new THREE.BoxGeometry(shopW, shopH, wallD), wallMats);
          shopBody.position.set(shopX, 0.32 + shopH * 0.5, 0);
          shopBody.castShadow = !this.isSoftwareGl;
          shopBody.receiveShadow = true;
          bGrp.add(shopBody);
          addPitchedRoof(bGrp, shopX, 0.32 + shopH, 0, shopW, wallD, peakH, rMat, false, false);

          // Open-sided timber forge lean-to foundry wing on the right!
          const forgeW = wallW * 0.38;
          const forgeX = shopX + shopW * 0.5 + forgeW * 0.5;
          const leanRoof = new THREE.Mesh(new THREE.BoxGeometry(forgeW + 0.5, 0.16, wallD + 0.5), rMat);
          leanRoof.position.set(forgeX, 0.32 + shopH * 0.84, 0);
          leanRoof.rotation.z = -0.26;
          leanRoof.castShadow = !this.isSoftwareGl;
          bGrp.add(leanRoof);

          // 4 heavy charred-oak foundry roof pillars
          for (const sz of [-1, 1]) {
            const p = new THREE.Mesh(new THREE.BoxGeometry(0.22, shopH * 0.86, 0.22), darkOakMat);
            p.position.set(forgeX + forgeW * 0.42, 0.32 + shopH * 0.42, sz * (wallD * 0.42));
            p.castShadow = !this.isSoftwareGl;
            bGrp.add(p);
          }

          // Massive Tapered Stone Blast-Furnace Chimney + Glowing Coal Hearth right inside the open foundry!
          const hearth = new THREE.Mesh(new THREE.BoxGeometry(1.55, 1.02, 1.45), stoneMat);
          hearth.position.set(forgeX - 0.1, 0.82, -0.35);
          hearth.castShadow = !this.isSoftwareGl;
          const coalBed = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.24, 1.05), emberMat);
          coalBed.position.set(forgeX - 0.1, 1.38, -0.35);
          const stackLower = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.92, 2.2, 6), stoneMat);
          stackLower.position.set(forgeX - 0.1, 2.35, -0.55);
          stackLower.castShadow = !this.isSoftwareGl;
          const stackUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.62, 1.75, 6), quoinMat);
          stackUpper.position.set(forgeX - 0.1, 4.15, -0.55);
          stackUpper.castShadow = !this.isSoftwareGl;
          const ironBand = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.16, 6), ironMat);
          ironBand.position.set(forgeX - 0.1, 3.65, -0.55);
          // Heavy iron anvil + water quench barrel under the open foundry roof
          const anvilBase = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.46, 0.42), darkOakMat);
          anvilBase.position.set(forgeX + 0.5, 0.55, 1.1);
          const anvilTop = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.24, 0.34), ironMat);
          anvilTop.position.set(forgeX + 0.5, 0.9, 1.1);
          const quenchTub = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.32, 0.58, 10), timberMat);
          quenchTub.position.set(forgeX - 0.7, 0.6, 1.3);
          bGrp.add(hearth, coalBed, stackLower, stackUpper, ironBand, anvilBase, anvilTop, quenchTub);

          addFramedWindow(bGrp, shopX - shopW * 0.28, 1.36, frontZ, 'front', windowGlowMat, false);
          addFramedWindow(bGrp, shopX - shopW * 0.5 - 0.04, 1.36, 0, 'left', windowGlowMat, false);

          doorX = shopX + 0.35;
          // Emit roaring furnace smoke straight from the giant tapered blast-furnace stack!
          chimneyPos = [forgeX - 0.1, 4.35, -0.55];
        } else if (style === 'observatory_parlor') {
          // 2-STORY HALL + TALL OCTAGONAL CORNER TURRET TOWER + CONICAL SPIRE + BRASS ASTROLABE FINIAL!
          const mainW = wallW * 0.72;
          const mainX = -wallW * 0.14;
          const wallH = 2.28;
          const peakH = 1.48;

          const body = new THREE.Mesh(new THREE.BoxGeometry(mainW, wallH, wallD), wallMats);
          body.position.set(mainX, 0.32 + wallH * 0.5, 0);
          body.castShadow = !this.isSoftwareGl;
          body.receiveShadow = true;
          bGrp.add(body);
          addPitchedRoof(bGrp, mainX, 0.32 + wallH, 0, mainW, wallD, peakH, rMat, false, true);

          // Tall Octagonal Stone & Plaster Turret Tower on front-right corner!
          const turX = wallW * 0.32;
          const turZ = wallD * 0.14;
          const turH = 4.35;
          const turR = 1.42;
          const turLower = new THREE.Mesh(new THREE.CylinderGeometry(turR * 0.98, turR * 1.06, 1.65, 8), warmStoneWallMat);
          turLower.position.set(turX, 0.32 + 0.82, turZ);
          turLower.castShadow = !this.isSoftwareGl;
          const turUpper = new THREE.Mesh(new THREE.CylinderGeometry(turR, turR * 0.98, turH - 1.65, 8), plasterMat);
          turUpper.position.set(turX, 0.32 + 1.65 + (turH - 1.65) * 0.5, turZ);
          turUpper.castShadow = !this.isSoftwareGl;
          // Star-gazing circular wooden gallery ring wrapping the turret top
          const obsDeck = new THREE.Mesh(new THREE.CylinderGeometry(turR + 0.32, turR + 0.24, 0.18, 8), darkOakMat);
          obsDeck.position.set(turX, 0.32 + turH - 0.92, turZ);
          const obsRail = new THREE.Mesh(new THREE.TorusGeometry(turR + 0.26, 0.06, 6, 8), timberMat);
          obsRail.rotation.x = Math.PI * 0.5;
          obsRail.position.set(turX, 0.32 + turH - 0.42, turZ);
          // Tall conical spire roof + rotating-style brass armillary sphere finial!
          const spire = new THREE.Mesh(new THREE.ConeGeometry(turR + 0.42, 2.25, 8), rMat);
          spire.position.set(turX, 0.32 + turH + 1.05, turZ);
          spire.castShadow = !this.isSoftwareGl;
          const astrolabeRing1 = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.045, 6, 14), brassMat);
          astrolabeRing1.position.set(turX, 0.32 + turH + 2.52, turZ);
          const astrolabeRing2 = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.045, 6, 14), brassMat);
          astrolabeRing2.rotation.y = Math.PI * 0.5;
          astrolabeRing2.position.set(turX, 0.32 + turH + 2.52, turZ);
          const astroRod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.95, 6), brassMat);
          astroRod.position.set(turX, 0.32 + turH + 2.38, turZ);
          bGrp.add(turLower, turUpper, obsDeck, obsRail, spire, astrolabeRing1, astrolabeRing2, astroRod);

          // Glowing arched mystic windows around the turret drum
          const winMat = b.signKind === 'fortune' ? mysticWinMat : windowGlowMat;
          for (let a = 0; a < 4; a++) {
            const ang = (a / 4) * Math.PI * 2 + Math.PI * 0.25;
            const tw = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.88, 0.16), winMat);
            tw.position.set(turX + Math.sin(ang) * (turR - 0.02), 0.32 + turH - 0.4, turZ + Math.cos(ang) * (turR - 0.02));
            tw.rotation.y = ang;
            bGrp.add(tw);
          }

          addFramedWindow(bGrp, mainX - mainW * 0.28, 1.56, frontZ, 'front', winMat);
          addFramedWindow(bGrp, mainX - mainW * 0.5 - 0.04, 1.56, 0, 'left', winMat);

          doorX = mainX;
          chimneyPos = [mainX - mainW * 0.22, 0.32 + wallH + peakH * 0.72, -wallD * 0.16];
        } else if (style === 'grand_guildhall') {
          // MONUMENTAL T-SHAPED / CROSS-GABLED 2-STORY CIVIC HALL + COLUMNED PORTICO + CLOCK-BELL CUPOLA + BANNERS!
          const wallH = 2.68;
          const peakH = 1.66;

          const body = new THREE.Mesh(new THREE.BoxGeometry(wallW, wallH, wallD), wallMats);
          body.position.y = 0.32 + wallH * 0.5;
          body.castShadow = !this.isSoftwareGl;
          body.receiveShadow = true;
          const belt = new THREE.Mesh(new THREE.BoxGeometry(wallW + 0.24, 0.2, wallD + 0.24), quoinMat);
          belt.position.y = 0.32 + wallH * 0.52;
          bGrp.add(body, belt);

          addPitchedRoof(bGrp, 0, 0.32 + wallH, 0, wallW, wallD, peakH, rMat, false, true);

          // Projecting Cross-Gabled Front Portico with 4 Cut-Stone Columns & Pediment!
          const portW = Math.min(4.2, wallW * 0.42);
          const portD = 1.65;
          const portZ = wallD * 0.5 + portD * 0.5 - 0.08;
          const portDeck = new THREE.Mesh(new THREE.BoxGeometry(portW + 0.36, 0.34, portD + 0.26), quoinMat);
          portDeck.position.set(0, 0.22, portZ);
          portDeck.receiveShadow = true;
          bGrp.add(portDeck);

          for (const px of [-portW * 0.44, -portW * 0.18, portW * 0.18, portW * 0.44]) {
            const col = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, wallH - 0.12, 8), quoinMat);
            col.position.set(px, 0.32 + (wallH - 0.12) * 0.5, portZ + portD * 0.42);
            col.castShadow = !this.isSoftwareGl;
            bGrp.add(col);
          }
          addPitchedRoof(bGrp, 0, 0.32 + wallH - 0.04, portZ - 0.18, portW + 0.2, portD + 1.1, 1.32, rMat, true, false);

          // Draped Royal Heraldic Guild Banners flanking the portico
          for (const sideSgn of [-1, 1]) {
            const banner = new THREE.Mesh(new THREE.BoxGeometry(0.46, 1.56, 0.06), bannerBlueMat);
            banner.position.set(sideSgn * (portW * 0.5 + 0.55), 0.32 + wallH * 0.58, frontZ + 0.08);
            const trim = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.08), brassMat);
            trim.position.set(sideSgn * (portW * 0.5 + 0.55), 0.32 + wallH * 0.58 + 0.78, frontZ + 0.08);
            bGrp.add(banner, trim);
          }

          // Towering Central Rooftop Clock & Bell Cupola Spire!
          const cupBaseY = 0.32 + wallH + peakH + 0.05;
          const cupBase = new THREE.Mesh(new THREE.BoxGeometry(1.24, 1.18, 1.24), quoinMat);
          cupBase.position.set(0, cupBaseY + 0.52, 0);
          cupBase.castShadow = !this.isSoftwareGl;
          const clockFace = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 14), windowGlowMat);
          clockFace.rotation.x = Math.PI * 0.5;
          clockFace.position.set(0, cupBaseY + 0.62, 0.64);
          const cupSpire = new THREE.Mesh(new THREE.ConeGeometry(0.84, 1.52, 8), rMat);
          cupSpire.position.set(0, cupBaseY + 1.85, 0);
          cupSpire.castShadow = !this.isSoftwareGl;
          bGrp.add(cupBase, clockFace, cupSpire);

          addFramedWindow(bGrp, -wallW * 0.34, 0.32 + wallH * 0.74, frontZ, 'front');
          addFramedWindow(bGrp, wallW * 0.34, 0.32 + wallH * 0.74, frontZ, 'front');
          addFramedWindow(bGrp, -wallW * 0.34, 0.32 + wallH * 0.28, frontZ, 'front', windowGlowMat, false);
          addFramedWindow(bGrp, wallW * 0.34, 0.32 + wallH * 0.28, frontZ, 'front', windowGlowMat, false);
          addFramedWindow(bGrp, -wallW * 0.5 - 0.04, 0.32 + wallH * 0.62, 0, 'left');
          addFramedWindow(bGrp, wallW * 0.5 + 0.04, 0.32 + wallH * 0.62, 0, 'right');

          skipDefaultAwning = true;
          chimneyPos = [wallW * 0.34, 0.32 + wallH + peakH * 0.72, -wallD * 0.16];
        } else if (style === 'l_wing_inn') {
          // L-SHAPED 2-STORY COURTYARD INN: Tall 2-Story Main Wing + Perpendicular Cross-Gabled Guest Wing + Wrap Balcony!
          const mainW = wallW * 0.62;
          const mainX = -wallW * 0.19;
          const mainH = 2.72;
          const mainPeak = 1.52;

          // Tall 2-story left/rear main inn wing
          const mainBody = new THREE.Mesh(new THREE.BoxGeometry(mainW, mainH, wallD), wallMats);
          mainBody.position.set(mainX, 0.32 + mainH * 0.5, 0);
          mainBody.castShadow = !this.isSoftwareGl;
          mainBody.receiveShadow = true;
          bGrp.add(mainBody);
          addPitchedRoof(bGrp, mainX, 0.32 + mainH, 0, mainW, wallD, mainPeak, rMat, false, true);
          addDormer(bGrp, mainX, 0.32 + mainH + mainPeak * 0.45, wallD * 0.26, rMat);

          // Perpendicular projecting front-right guest wing (forms an unmistakable 3D L-shape!)
          const wingW = wallW * 0.44;
          const wingD = wallD * 0.92;
          const wingX = wallW * 0.28;
          const wingZ = wallD * 0.16;
          const wingH = 1.92;
          const wingPeak = 1.32;
          const wingBody = new THREE.Mesh(new THREE.BoxGeometry(wingW, wingH, wingD), wallMats);
          wingBody.position.set(wingX, 0.32 + wingH * 0.5, wingZ);
          wingBody.castShadow = !this.isSoftwareGl;
          wingBody.receiveShadow = true;
          bGrp.add(wingBody);
          addPitchedRoof(bGrp, wingX, 0.32 + wingH, wingZ, wingW, wingD, wingPeak, rMat, true, true);

          // Elevated 2nd-floor timber gallery balcony wrapping the front of the main wing!
          const galY = 0.32 + 1.48;
          const galFloor = new THREE.Mesh(new THREE.BoxGeometry(mainW - 0.1, 0.14, 0.88), timberMat);
          galFloor.position.set(mainX, galY, frontZ + 0.38);
          const galRail = new THREE.Mesh(new THREE.BoxGeometry(mainW - 0.1, 0.08, 0.08), darkOakMat);
          galRail.position.set(mainX, galY + 0.58, frontZ + 0.78);
          bGrp.add(galFloor, galRail);
          for (let i = 0; i < 6; i++) {
            const gx = mainX - mainW * 0.44 + (i / 5) * (mainW * 0.88);
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 1.48, 6), timberMat);
            post.position.set(gx, 0.32 + 0.74, frontZ + 0.76);
            bGrp.add(post);
            if (i % 2 === 0) {
              const hangLamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), lanternMat);
              hangLamp.position.set(gx, galY - 0.2, frontZ + 0.76);
              bGrp.add(hangLamp);
            }
          }

          // Cozy courtyard ale kegs + patio table nestled in the L-courtyard!
          for (let k = 0; k < 2; k++) {
            const keg = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.56, 10), timberMat);
            keg.rotation.z = Math.PI * 0.5;
            keg.position.set(wingX - wingW * 0.5 - 0.36, 0.46 + k * 0.42, frontZ + 0.5);
            bGrp.add(keg);
          }

          addFramedWindow(bGrp, mainX - mainW * 0.26, 0.32 + 2.04, frontZ, 'front');
          addFramedWindow(bGrp, mainX + mainW * 0.22, 0.32 + 2.04, frontZ, 'front');
          addFramedWindow(bGrp, wingX, 0.32 + wingH * 0.54, wingZ + wingD * 0.5 + 0.04, 'front');
          addFramedWindow(bGrp, wingX + wingW * 0.5 + 0.04, 0.32 + wingH * 0.54, wingZ, 'right');

          doorX = mainX;
          skipDefaultAwning = true;
          chimneyPos = [mainX - mainW * 0.24, 0.32 + mainH + mainPeak * 0.72, -wallD * 0.14];
        } else if (style === 'apothecary_conservatory') {
          // 1-STORY COTTAGE + SUNLIT PANED-GLASS GREENHOUSE CONSERVATORY WING WITH VISIBLE HERBS & BLOSSOMS!
          const cotW = wallW * 0.58;
          const cotX = -wallW * 0.21;
          const cotH = 1.88;
          const peakH = 1.38;

          const body = new THREE.Mesh(new THREE.BoxGeometry(cotW, cotH, wallD), wallMats);
          body.position.set(cotX, 0.32 + cotH * 0.5, 0);
          body.castShadow = !this.isSoftwareGl;
          body.receiveShadow = true;
          bGrp.add(body);
          addPitchedRoof(bGrp, cotX, 0.32 + cotH, 0, cotW, wallD, peakH, rMat, false, true);

          // Sunlit Glass-and-Timber Greenhouse Conservatory Wing on the right!
          const ghW = wallW * 0.42;
          const ghD = wallD * 0.88;
          const ghX = cotX + cotW * 0.5 + ghW * 0.5 - 0.04;
          const ghH = 1.66;

          // Low brick/stone knee-wall base + translucent glass panes + crisp white conservatory mullions
          const kneeWall = new THREE.Mesh(new THREE.BoxGeometry(ghW, 0.46, ghD), warmStoneWallMat);
          kneeWall.position.set(ghX, 0.32 + 0.23, 0);
          const glassWalls = new THREE.Mesh(new THREE.BoxGeometry(ghW - 0.08, ghH - 0.44, ghD - 0.08), glassPaneMat);
          glassWalls.position.set(ghX, 0.32 + 0.46 + (ghH - 0.44) * 0.5, 0);
          // Pitched glass skylight roof
          const ghSlopeLen = Math.hypot(ghD * 0.5 + 0.12, 0.86);
          const ghAngle = Math.atan2(0.86, ghD * 0.5 + 0.12);
          const glRoofF = new THREE.Mesh(new THREE.BoxGeometry(ghW + 0.14, 0.06, ghSlopeLen), glassPaneMat);
          glRoofF.position.set(ghX, 0.32 + ghH + 0.4, ghD * 0.26);
          glRoofF.rotation.x = ghAngle;
          const glRoofB = new THREE.Mesh(new THREE.BoxGeometry(ghW + 0.14, 0.06, ghSlopeLen), glassPaneMat);
          glRoofB.position.set(ghX, 0.32 + ghH + 0.4, -ghD * 0.26);
          glRoofB.rotation.x = -ghAngle;
          const ghRidge = new THREE.Mesh(new THREE.BoxGeometry(ghW + 0.22, 0.1, 0.12), whiteTrimMat);
          ghRidge.position.set(ghX, 0.32 + ghH + 0.84, 0);
          bGrp.add(kneeWall, glassWalls, glRoofF, glRoofB, ghRidge);

          // Crisp white vertical conservatory framing ribs
          for (const sz of [-1, 1]) {
            for (let m = 0; m < 4; m++) {
              const mx = ghX - ghW * 0.46 + (m / 3) * (ghW * 0.92);
              const rib = new THREE.Mesh(new THREE.BoxGeometry(0.07, ghH - 0.36, 0.07), whiteTrimMat);
              rib.position.set(mx, 0.32 + 0.42 + (ghH - 0.36) * 0.5, sz * (ghD * 0.48));
              bGrp.add(rib);
            }
          }

          // Lush glowing Celceta medicinal herbs & blossoms visibly thriving INSIDE the glass conservatory!
          for (let h = 0; h < 6; h++) {
            const hx = ghX - ghW * 0.32 + (h % 3) * (ghW * 0.32);
            const hz = h < 3 ? -ghD * 0.2 : ghD * 0.2;
            const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.32, 8), boxMat);
            pot.position.set(hx, 0.5, hz);
            const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), vineLeafMat);
            bush.position.set(hx, 0.88, hz);
            const blossom = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 6), h % 2 === 0 ? bloomRedMat : bloomGoldMat);
            blossom.position.set(hx, 1.18, hz);
            bGrp.add(pot, bush, blossom);
          }

          addFramedWindow(bGrp, cotX - cotW * 0.28, 1.32, frontZ, 'front');
          addFramedWindow(bGrp, cotX - cotW * 0.5 - 0.04, 1.32, 0, 'left');

          doorX = cotX;
          chimneyPos = [cotX - cotW * 0.26, 0.32 + cotH + peakH * 0.72, -wallD * 0.16];
        } else {
          // LONGHOUSE TAVERN: Steep Double-Slope Gambrel Roof + Vine-Draped Beer-Garden Pergola + Twin Chimneys!
          const mainW = wallW * 0.74;
          const mainX = -wallW * 0.13;
          const wallH = 2.12;
          const gambrelLowH = 0.96;
          const gambrelTopH = 0.66;

          const body = new THREE.Mesh(new THREE.BoxGeometry(mainW, wallH, wallD), wallMats);
          body.position.set(mainX, 0.32 + wallH * 0.5, 0);
          body.castShadow = !this.isSoftwareGl;
          body.receiveShadow = true;
          bGrp.add(body);

          // Authentic 2-slope medieval Gambrel roof profile!
          const halfD = wallD * 0.5;
          const kneeD = halfD * 0.58;
          const gShape = new THREE.Shape();
          gShape.moveTo(-halfD, 0);
          gShape.lineTo(halfD, 0);
          gShape.lineTo(kneeD, gambrelLowH);
          gShape.lineTo(0, gambrelLowH + gambrelTopH);
          gShape.lineTo(-kneeD, gambrelLowH);
          gShape.closePath();
          const gGeo = new THREE.ExtrudeGeometry(gShape, { depth: mainW - 0.04, bevelEnabled: false });
          gGeo.rotateY(Math.PI * 0.5);
          gGeo.translate(mainX - (mainW - 0.04) * 0.5, 0.32 + wallH, 0);
          const gMesh = new THREE.Mesh(gGeo, plasterMat);
          gMesh.castShadow = !this.isSoftwareGl;
          bGrp.add(gMesh);

          // Lower steep slopes + upper gentle gambrel roof slopes
          const lowLen = Math.hypot(halfD + 0.34 - kneeD, gambrelLowH + 0.08);
          const lowAng = Math.atan2(gambrelLowH + 0.08, halfD + 0.34 - kneeD);
          const upLen = Math.hypot(kneeD + 0.12, gambrelTopH + 0.08);
          const upAng = Math.atan2(gambrelTopH + 0.08, kneeD + 0.12);
          for (const sgn of [-1, 1]) {
            const lowSlope = new THREE.Mesh(new THREE.BoxGeometry(mainW + 0.62, 0.16, lowLen), rMat);
            lowSlope.position.set(mainX, 0.32 + wallH + gambrelLowH * 0.5, sgn * ((halfD + 0.24 + kneeD) * 0.5));
            lowSlope.rotation.x = sgn * lowAng;
            lowSlope.castShadow = !this.isSoftwareGl;
            const upSlope = new THREE.Mesh(new THREE.BoxGeometry(mainW + 0.64, 0.16, upLen), rMat);
            upSlope.position.set(mainX, 0.32 + wallH + gambrelLowH + gambrelTopH * 0.5, sgn * (kneeD * 0.5));
            upSlope.rotation.x = sgn * upAng;
            upSlope.castShadow = !this.isSoftwareGl;
            bGrp.add(lowSlope, upSlope);
          }
          const gRidge = new THREE.Mesh(new THREE.BoxGeometry(mainW + 0.72, 0.22, 0.26), darkOakMat);
          gRidge.position.set(mainX, 0.32 + wallH + gambrelLowH + gambrelTopH + 0.08, 0);
          bGrp.add(gRidge);

          // Side Timber Beer-Garden Pergola with Climbing Emerald Vines, Ale Casks & Outdoor Tables!
          const pergW = wallW * 0.28;
          const pergX = mainX + mainW * 0.5 + pergW * 0.5;
          const pergH = 1.96;
          for (const sz of [-1, 1]) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, pergH, 0.16), darkOakMat);
            post.position.set(pergX + pergW * 0.42, 0.32 + pergH * 0.5, sz * (wallD * 0.42));
            post.castShadow = !this.isSoftwareGl;
            bGrp.add(post);
          }
          for (let bIdx = 0; bIdx < 5; bIdx++) {
            const bz = -wallD * 0.42 + (bIdx / 4) * (wallD * 0.84);
            const beam = new THREE.Mesh(new THREE.BoxGeometry(pergW + 0.36, 0.12, 0.12), timberMat);
            beam.position.set(pergX, 0.32 + pergH, bz);
            bGrp.add(beam);
            const vine = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 1), vineLeafMat);
            vine.scale.set(1.4, 0.48, 0.9);
            vine.position.set(pergX + (bIdx % 2 === 0 ? 0.15 : -0.15), 0.32 + pergH + 0.14, bz);
            bGrp.add(vine);
          }
          // Stacked ale barrels & outdoor tavern pub table + brass tankard under the pergola!
          for (let k = 0; k < 2; k++) {
            const keg = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.24, 0.62, 10), timberMat);
            keg.rotation.z = Math.PI * 0.5;
            keg.position.set(pergX - 0.18, 0.56 + k * 0.46, -0.95);
            bGrp.add(keg);
          }
          const pubTbl = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.09, 10), timberMat);
          pubTbl.position.set(pergX + 0.08, 0.96, 0.85);
          const pubLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 0.66, 6), darkOakMat);
          pubLeg.position.set(pergX + 0.08, 0.64, 0.85);
          const pubMug = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 6), brassMat);
          pubMug.position.set(pergX + 0.18, 1.09, 0.78);
          bGrp.add(pubTbl, pubLeg, pubMug);

          addFramedWindow(bGrp, mainX - mainW * 0.3, 1.44, frontZ, 'front');
          addFramedWindow(bGrp, mainX + mainW * 0.3, 1.44, frontZ, 'front');
          addFramedWindow(bGrp, mainX - mainW * 0.5 - 0.04, 1.44, 0, 'left');

          doorX = mainX;
          chimneyPos = [mainX - mainW * 0.3, 0.32 + wallH + gambrelLowH + gambrelTopH * 0.6, -wallD * 0.12];
          // Twin stone chimney on the opposite roof end!
          if (b.hasChimney) {
            addChimneyWithSmoke(
              bGrp,
              cx,
              groundY,
              cz,
              mainX + mainW * 0.3,
              0.32 + wallH + gambrelLowH + gambrelTopH * 0.6,
              -wallD * 0.12,
              0.52,
              1.48,
              77
            );
          }
        }

        // 3. Recessed 3D Oak Front Doorway + Lantern + Stepped Stone Stoop + Hanging Guild Signboard!
        const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.16, 1.5, 0.16), darkOakMat);
        doorFrame.position.set(doorX, 1.05, doorZ);
        const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(0.88, 1.34, 0.12), timberMat);
        doorPanel.position.set(doorX, 0.99, doorZ + 0.04);
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), brassMat);
        knob.position.set(doorX + 0.26, 0.95, doorZ + 0.12);
        const lantern = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), lanternMat);
        lantern.position.set(doorX + 0.58, 1.46, doorZ + 0.24);
        const step1 = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.2, 0.72), stoneMat);
        step1.position.set(doorX, 0.16, doorZ + 0.34);
        step1.receiveShadow = true;
        const step2 = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.12, 0.4), quoinMat);
        step2.position.set(doorX, 0.06, doorZ + 0.74);
        step2.receiveShadow = true;
        bGrp.add(doorFrame, doorPanel, knob, lantern, step1, step2);

        if (!skipDefaultAwning) {
          const awning = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.14, 0.82), rMat);
          awning.position.set(doorX, 1.78, doorZ + 0.35);
          awning.rotation.x = 0.34;
          awning.castShadow = !this.isSoftwareGl;
          for (const px of [-0.68, 0.68]) {
            const col = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 1.54, 6), timberMat);
            col.position.set(doorX + px, 0.95, doorZ + 0.62);
            col.castShadow = !this.isSoftwareGl;
            bGrp.add(col);
          }
          bGrp.add(awning);
        }

        // Swaying Wrought-Iron Shop Signboard Bracket (hanging & gently swinging in the sea breeze!)
        const signArm = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.055, 0.055), ironMat);
        signArm.position.set(-wallW * 0.5 - 0.36, 1.82, frontZ - 0.06);
        const signScroll = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.022, 6, 10, Math.PI), ironMat);
        signScroll.position.set(-wallW * 0.5 - 0.16, 1.72, frontZ - 0.06);
        const signPivot = new THREE.Group();
        signPivot.position.set(-wallW * 0.5 - 0.42, 1.78, frontZ - 0.06);
        for (const chx of [-0.16, 0.16]) {
          const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.14, 5), ironMat);
          chain.position.set(chx, -0.07, 0);
          signPivot.add(chain);
        }
        const signPlaque = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.46, 0.06), darkOakMat);
        signPlaque.position.set(0, -0.34, 0);
        signPlaque.castShadow = !this.isSoftwareGl;
        const signEmblem = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), brassMat);
        signEmblem.position.set(0, -0.34, 0.05);
        signPivot.add(signPlaque, signEmblem);
        bGrp.add(signArm, signScroll, signPivot);
        this.swayingLanterns.push({ pivot: signPivot, phase: cx * 0.9 + cz * 0.7, amp: 0.12, speed: 1.65, axis: 'z' });

        // Roof Moss Patches, Swaying Roof Grass Tufts, Fallen Colorful Leaves, Bird Nests & Spinning Weathervane!
        const roofBaseY = style === 'two_story_timber' || style === 'grand_guildhall' ? 3.55 : style === 'l_wing_inn' ? 3.25 : 2.92;
        const mossMat = new THREE.MeshStandardMaterial({ color: '#1fa338', roughness: 0.9 });
        const roofGrassMat = new THREE.MeshStandardMaterial({ color: '#38d64f', roughness: 0.75 });
        const twigMat = new THREE.MeshStandardMaterial({ color: '#6b4423', roughness: 0.95 });
        const eggMat = new THREE.MeshStandardMaterial({ color: '#bae6fd', roughness: 0.35 });
        const leafCols = ['#f59e0b', '#ef4444', '#84cc16', '#f472b6'];

        // 4-6 organic emerald moss cushions & swaying grass sprouts on roof slopes & eaves
        for (let mi = 0; mi < 5; mi++) {
          const mx = (hash2d(b.tx + mi, b.ty, 611) - 0.5) * (wallW * 0.76);
          const mz = (hash2d(b.tx, b.ty + mi, 612) - 0.5) * (wallD * 0.56);
          const moss = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), mossMat);
          moss.scale.set(1.5, 0.22, 1.25);
          moss.position.set(mx, roofBaseY - Math.abs(mz) * 0.32, mz);
          bGrp.add(moss);

          if (mi < 3) {
            const tuft = new THREE.Group();
            tuft.position.set(mx, roofBaseY - Math.abs(mz) * 0.32 + 0.05, mz);
            for (let tb = -1; tb <= 1; tb++) {
              const blade = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.24, 4), roofGrassMat);
              blade.position.set(tb * 0.05, 0.11, (tb === 0 ? 0.03 : -0.02));
              blade.rotation.z = tb * 0.28;
              tuft.add(blade);
            }
            bGrp.add(tuft);
            this.treeMovingParts.push({
              obj: tuft,
              baseRx: 0,
              baseRy: mi * 0.9,
              baseRz: 0,
              ampX: 0.12,
              ampZ: 0.15,
              speed: 2.6,
              phase: cx + mi * 1.4,
              wx: cx + mx,
              wz: cz + mz,
            });
          }
        }
        // Scattered fallen autumn/blossom leaves resting on roof shingles
        for (let li = 0; li < 6; li++) {
          const lx = (hash2d(b.tx + li, b.ty, 621) - 0.5) * (wallW * 0.8);
          const lz = (hash2d(b.tx, b.ty + li, 622) - 0.5) * (wallD * 0.62);
          const leaf = new THREE.Mesh(
            new THREE.BoxGeometry(0.14, 0.02, 0.1),
            new THREE.MeshStandardMaterial({ color: leafCols[(b.tx + li) % leafCols.length], roughness: 0.7 })
          );
          leaf.position.set(lx, roofBaseY - Math.abs(lz) * 0.3 + 0.06, lz);
          leaf.rotation.set(lz > 0 ? 0.38 : -0.38, li * 1.1, 0);
          bGrp.add(leaf);
        }

        // Woven Bird Nest with 3 Pale-Blue Eggs tucked under front roof eave or chimney ledge!
        const nestGrp = new THREE.Group();
        const nestBowl = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.055, 6, 10), twigMat);
        nestBowl.rotation.x = Math.PI * 0.5;
        const nestBase = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.09, 0.09, 8), twigMat);
        nestBase.position.y = -0.04;
        nestGrp.add(nestBowl, nestBase);
        for (const [ex, ez] of [[-0.045, -0.02], [0.045, -0.02], [0, 0.045]]) {
          const egg = new THREE.Mesh(new THREE.SphereGeometry(0.036, 6, 5), eggMat);
          egg.scale.set(0.85, 1.18, 0.85);
          egg.position.set(ex, 0.025, ez);
          nestGrp.add(egg);
        }
        nestGrp.position.set(wallW * 0.34, 2.28, frontZ + 0.18);
        bGrp.add(nestGrp);

        // Spinning Brass Rooftop Weathervane / Wind-Spinner on Ridge!
        const vanePole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.78, 6), ironMat);
        vanePole.position.set(wallW * 0.24, roofBaseY + 0.95, 0);
        const vaneSpin = new THREE.Group();
        vaneSpin.position.set(wallW * 0.24, roofBaseY + 1.32, 0);
        const vaneBar = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.04, 0.04), brassMat);
        const vaneArrow = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 4), brassMat);
        vaneArrow.rotation.z = -Math.PI * 0.5;
        vaneArrow.position.x = 0.32;
        const vaneTail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.03), brassMat);
        vaneTail.position.x = -0.28;
        vaneSpin.add(vaneBar, vaneArrow, vaneTail);
        bGrp.add(vanePole, vaneSpin);
        this.spinners.push({ obj: vaneSpin, axis: 'y', speed: 0.75 + hash2d(b.tx, b.ty, 631) * 0.7 });

        // Cozy Around-House Living Props: Rain Barrel with Shimmering Water, Stacked Firewood & Fluttering Laundry Line!
        const rainBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.21, 0.56, 10), timberMat);
        rainBarrel.position.set(-wallW * 0.5 - 0.32, 0.28, frontZ - 0.55);
        rainBarrel.castShadow = !this.isSoftwareGl;
        const rainWater = new THREE.Mesh(
          new THREE.CircleGeometry(0.2, 10),
          new THREE.MeshStandardMaterial({ color: '#38bdf8', roughness: 0.15, metalness: 0.25 })
        );
        rainWater.rotation.x = -Math.PI * 0.5;
        rainWater.position.set(-wallW * 0.5 - 0.32, 0.57, frontZ - 0.55);
        bGrp.add(rainBarrel, rainWater);
        // Stacked split firewood logs tucked neatly by the side wall
        for (let fw = 0; fw < 5; fw++) {
          const log = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.48, 6), darkOakMat);
          log.rotation.x = Math.PI * 0.5;
          log.position.set(wallW * 0.5 + 0.26 + (fw % 3) * 0.14, 0.12 + Math.floor(fw / 3) * 0.13, -wallD * 0.25);
          bGrp.add(log);
        }
        // Breezy Outdoor Laundry / Dried Herb Line strung beside alternating cottages!
        if ((b.tx + b.ty) % 2 === 0) {
          const linePost = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.65, 6), timberMat);
          linePost.position.set(wallW * 0.5 + 1.35, 0.82, -0.35);
          const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.4, 5), boxMat);
          rope.rotation.z = Math.PI * 0.5;
          rope.position.set(wallW * 0.5 + 0.68, 1.52, -0.35);
          bGrp.add(linePost, rope);
          const clothCols = ['#fef3c7', '#93c5fd', '#fca5a5'];
          for (let ci = 0; ci < 3; ci++) {
            const clothPivot = new THREE.Group();
            clothPivot.position.set(wallW * 0.5 + 0.3 + ci * 0.38, 1.51, -0.35);
            const cloth = new THREE.Mesh(
              new THREE.BoxGeometry(0.26, 0.38, 0.025),
              new THREE.MeshStandardMaterial({ color: clothCols[ci], roughness: 0.85 })
            );
            cloth.position.y = -0.2;
            clothPivot.add(cloth);
            bGrp.add(clothPivot);
            this.treeMovingParts.push({
              obj: clothPivot,
              baseRx: 0,
              baseRy: 0,
              baseRz: 0,
              ampX: 0.26,
              ampZ: 0.08,
              speed: 2.9 + ci * 0.35,
              phase: cx + ci * 1.2,
              wx: cx + wallW * 0.5,
              wz: cz,
            });
          }
        }

        // Role-specific exterior curb accent (knight armor stand / mystic crystal orb / cargo crates)
        if (b.signKind === 'armor') {
          const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.14, 1.2, 6), timberMat);
          stand.position.set(wallW * 0.5 + 0.42, 0.6, 0.25);
          const cuirass = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.48, 8), quoinMat);
          cuirass.position.set(wallW * 0.5 + 0.42, 0.96, 0.25);
          const shield = new THREE.Mesh(
            new THREE.BoxGeometry(0.42, 0.56, 0.08),
            new THREE.MeshStandardMaterial({ color: '#1d4ed8', metalness: 0.6, roughness: 0.32 })
          );
          shield.position.set(wallW * 0.5 + 0.42, 0.78, 0.44);
          bGrp.add(stand, cuirass, shield);
        } else if (b.signKind === 'fortune') {
          const ped = new THREE.Mesh(
            new THREE.CylinderGeometry(0.18, 0.24, 0.84, 8),
            new THREE.MeshStandardMaterial({ color: '#581c87', roughness: 0.5 })
          );
          ped.position.set(-wallW * 0.48, 0.42, frontZ + 0.48);
          const orb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), mysticWinMat);
          orb.position.set(-wallW * 0.48, 0.98, frontZ + 0.48);
          bGrp.add(ped, orb);
        } else if (b.signKind === 'house') {
          const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.52, 8), timberMat);
          barrel.position.set(wallW * 0.5 + 0.3, 0.26, 0.22);
          barrel.castShadow = !this.isSoftwareGl;
          const crate = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.48), timberMat);
          crate.position.set(wallW * 0.5 + 0.32, 0.24, -0.32);
          crate.castShadow = !this.isSoftwareGl;
          bGrp.add(barrel, crate);
        }

        if (b.hasChimney) {
          addChimneyWithSmoke(
            bGrp,
            cx,
            groundY,
            cz,
            chimneyPos[0],
            chimneyPos[1],
            chimneyPos[2],
            style === 'smithery_foundry' ? 0.68 : 0.54,
            style === 'smithery_foundry' ? 1.4 : 1.54,
            0
          );
        }

        // Harmonize building vertical stature with tall 2x adult characters!
        bGrp.scale.set(1.0, 1.28, 1.0);
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

    // 2E-C. Custom Role-Tailored Building Interior Rooms OR Multi-Level Outdoor Town Terraces & Foliage!
    if (isInterior) {
      this.buildInteriorRoomDetails(g, zone);
    } else {
      this.buildTownTerracesAndReinforcedBanks(g, zone, buildingCells);

      // 2F. Monumental Multi-Tile Trees (2x1..4x4) + Sculpted Alpine Conifers + Marble Columns & Falling Leaves!
      this.buildTreesAndColumns(g, zone, treeTiles);

      // 2G. 1650+ Instanced Vibrant Emerald GPU-Bending Grass Blades & Wildflower Clusters!
      if (!isDungeon && zone.theme !== 'ice' && openGrassTiles.length > 0) {
        this.buildGpuBendingMeadowGrass(g, zone.theme, openGrassTiles, flowerTiles);
      }

      // 2H. Rich Modern-Evo Environment Props: Market Stalls, Wagons, Windmills, Waterwheels, Multi-Tile Hedgerows & Ornate Streetlamps!
      this.populateRichEvoEnvironmentProps(g, zone, roadTiles, openGrassTiles);

      // 2H-B. Living Community Courtyards (Seated Villagers Eating & Playing Board Games), Grazing Pastures (Horses/Livestock), Hearth Bakery & Craftworks Mini-Factory!
      if (!isDungeon && zone.theme !== 'ice') {
        this.buildLivingCommunityAndEconomy(g, zone);
      }

      // 2H-C. Seamless Neighbor-Map Horizon Vistas beyond Map Borders (as if one continuous world!)
      if (!isDungeon) {
        this.buildSeamlessNeighborHorizon(g, zone);
      }
    }

    // 2I. Ornate Outdoor Streetlamps OR Sculpted Tripod Dungeon/Interior Braziers!
    this.buildBraziers(g, brazierTiles, zone.theme);

    // 2J. Interactive Spring-Physics Rustling Shrubs
    this.buildShrubs(g, zone);

    // 2K. Sculpted 3D Inspectable Landmarks & Shop Furnishings (with Uninspected Golden Glints!)
    this.buildInspectables(g, zone);

    // 2K-B. Living Flock of 3D Birds Drinking at the Fountain & Flying Between Tree Canopies!
    if (!isInterior && !isDungeon && zone.theme !== 'ice') {
      this.buildLivingBirds(g, zone);
    }

    // 2K-C. Interactive 3D Crafting Stations (Grand Forge, Alchemy Cauldron, Hearth Kettle) & Scavengeable Forage Nodes!
    this.buildCraftStationsAndForageNodes(g, zone);

    // 2L. Hinged 3D Treasure Chests
    this.buildChests(g, zone);

    // 2M. Glowing 3D Zone Gateways & Warm Golden Doorway Thresholds
    this.buildPortals(g, zone);

    // 2N. Articulated 3D NPCs
    for (const npc of zone.npcs) {
      const rig = this.buildNpcRig(npc);
      g.add(rig.root);
      this.npcRigs.set(npc.id, rig);
    }

    // 2O. GPU Atmospheric Weather / Pollen / Candlelight Motes / Snow / Ember Particles!
    this.atmospherePoints = createGpuAtmospherePoints(zone.theme, W, H, this.sharedUniforms);
    g.add(this.atmospherePoints);
  }

  // --------------------------------------------------------------------------
  // Bespoke 3D Building Interior Rooms — Furnished & Decorated to Each Shopkeeper!
  // --------------------------------------------------------------------------
  private buildInteriorRoomDetails(g: THREE.Group, zone: ZoneDef): void {
    const W = zone.width;
    const H = zone.height;
    const kind = zone.interiorKind ?? 'house';

    const oakMat = new THREE.MeshStandardMaterial({ map: this.archTextures.plankWood, color: '#9c6334', roughness: 0.72 });
    const darkOakMat = new THREE.MeshStandardMaterial({ map: this.archTextures.plankWood, color: '#5c3418', roughness: 0.78 });
    const stoneMat = new THREE.MeshStandardMaterial({ color: '#78716c', roughness: 0.85 });
    const steelMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.86, roughness: 0.24 });
    const goldMat = new THREE.MeshStandardMaterial({ color: '#facc15', metalness: 0.88, roughness: 0.22 });
    const ironMat = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.8, roughness: 0.36 });
    const glassGlowMat = new THREE.MeshStandardMaterial({
      color: '#fef3c7',
      emissive: '#f59e0b',
      emissiveIntensity: 0.9,
      roughness: 0.2,
    });
    const flameMat = new THREE.MeshBasicMaterial({ color: '#fb923c' });

    // 1. Timber Wall Beams & Sunlit Leaded Glass Windows along North & West Walls
    for (let x = 3; x < W - 2; x += 4) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.55, 0.28), darkOakMat);
      post.position.set(x, 1.28, 1.56);
      g.add(post);
    }
    for (const wx of [5.5, W - 5.5]) {
      const winFrame = new THREE.Mesh(new THREE.BoxGeometry(1.75, 1.15, 0.14), darkOakMat);
      winFrame.position.set(wx, 1.62, 1.56);
      const winPane = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.88, 0.16), glassGlowMat);
      winPane.position.set(wx, 1.62, 1.57);
      const mullV = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.19), darkOakMat);
      mullV.position.set(wx, 1.62, 1.58);
      const mullH = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.08, 0.19), darkOakMat);
      mullH.position.set(wx, 1.62, 1.58);
      g.add(winFrame, winPane, mullV, mullH);
    }

    // Overhead Ambient Warm Chandelier PointLight
    const centerLight = new THREE.PointLight('#ffcf87', 3.4, 22, 1.4);
    centerLight.position.set(W * 0.5, 4.6, H * 0.48);
    g.add(centerLight);
    this.brazierLights.push(centerLight);

    // Helper: Oak Merchant Shop Counter
    const addCounter = (cx: number, cz: number, lenX: number, clothHex?: string) => {
      const body = new THREE.Mesh(new THREE.BoxGeometry(lenX, 0.88, 0.82), oakMat);
      body.position.set(cx, 0.44, cz);
      body.castShadow = !this.isSoftwareGl;
      body.receiveShadow = true;
      const top = new THREE.Mesh(new THREE.BoxGeometry(lenX + 0.18, 0.12, 0.96), darkOakMat);
      top.position.set(cx, 0.92, cz);
      top.castShadow = !this.isSoftwareGl;
      g.add(body, top);
      if (clothHex) {
        const cloth = new THREE.Mesh(
          new THREE.BoxGeometry(lenX * 0.42, 0.56, 0.99),
          new THREE.MeshStandardMaterial({ color: clothHex, roughness: 0.85 })
        );
        cloth.position.set(cx, 0.68, cz);
        g.add(cloth);
      }
      // Small brass ledger & candle on counter
      const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.24, 6), new THREE.MeshStandardMaterial({ color: '#fef3c7' }));
      candle.position.set(cx - lenX * 0.35, 1.08, cz);
      const fl = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), flameMat);
      fl.position.set(cx - lenX * 0.35, 1.26, cz);
      this.fireFlames.push(fl);
      g.add(candle, fl);
    };

    // Helper: Stone Fireplace Hearth with Crackling Fire
    const addHearth = (hx: number, hz: number) => {
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.65, 1.15), stoneMat);
      base.position.set(hx, 0.82, hz);
      base.castShadow = !this.isSoftwareGl;
      const mantle = new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.22, 1.28), darkOakMat);
      mantle.position.set(hx, 1.72, hz);
      const chimney = new THREE.Mesh(new THREE.BoxGeometry(1.55, 1.5, 0.95), stoneMat);
      chimney.position.set(hx, 2.52, hz);
      const pit = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.72, 0.36), new THREE.MeshStandardMaterial({ color: '#1c1917', roughness: 0.95 }));
      pit.position.set(hx, 0.42, hz + 0.48);
      const fire = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), flameMat);
      fire.position.set(hx, 0.46, hz + 0.62);
      this.fireFlames.push(fire);
      const glow = new THREE.PointLight('#fb923c', 3.6, 12, 1.7);
      glow.position.set(hx, 0.95, hz + 1.1);
      this.brazierLights.push(glow);
      g.add(base, mantle, chimney, pit, fire, glow);
    };

    // Helper: Packed Oak Bookshelf
    const addBookshelf = (bx: number, bz: number, rotY = 0) => {
      const grp = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.15, 0.56), darkOakMat);
      frame.position.y = 1.08;
      frame.castShadow = !this.isSoftwareGl;
      grp.add(frame);
      const bookCols = ['#dc2626', '#2563eb', '#16a34a', '#ca8a04', '#7c3aed', '#b45309'];
      for (let shelf = 0; shelf < 3; shelf++) {
        for (let bi = 0; bi < 6; bi++) {
          const bk = new THREE.Mesh(
            new THREE.BoxGeometry(0.22, 0.36 + ((shelf + bi) % 2) * 0.08, 0.44),
            new THREE.MeshStandardMaterial({ color: bookCols[(shelf * 5 + bi) % bookCols.length], roughness: 0.7 })
          );
          bk.position.set(-0.66 + bi * 0.26, 0.45 + shelf * 0.62, 0.1);
          grp.add(bk);
        }
      }
      grp.position.set(bx, 0, bz);
      grp.rotation.y = rotY;
      g.add(grp);
    };

    // Helper: Guest Bed with Quilt & Pillow
    const addBed = (bx: number, bz: number, quiltHex: string) => {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.36, 2.25), darkOakMat);
      frame.position.set(bx, 0.24, bz);
      frame.castShadow = !this.isSoftwareGl;
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.95, 0.16), darkOakMat);
      head.position.set(bx, 0.56, bz - 1.08);
      const quilt = new THREE.Mesh(
        new THREE.BoxGeometry(1.34, 0.26, 1.65),
        new THREE.MeshStandardMaterial({ color: quiltHex, roughness: 0.85 })
      );
      quilt.position.set(bx, 0.48, bz + 0.22);
      const pillow = new THREE.Mesh(
        new THREE.BoxGeometry(1.02, 0.18, 0.42),
        new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.9 })
      );
      pillow.position.set(bx, 0.5, bz - 0.72);
      g.add(frame, head, quilt, pillow);
    };

    // Helper: Round Wooden Table + Stools + Props
    const addRoundTable = (tx: number, tz: number, clothHex?: string, withTankards = false) => {
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, 0.76, 8), darkOakMat);
      ped.position.set(tx, 0.38, tz);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.12, 14), oakMat);
      top.position.set(tx, 0.8, tz);
      top.castShadow = !this.isSoftwareGl;
      g.add(ped, top);
      if (clothHex) {
        const cloth = new THREE.Mesh(
          new THREE.CylinderGeometry(0.95, 1.04, 0.34, 14),
          new THREE.MeshStandardMaterial({ color: clothHex, roughness: 0.8 })
        );
        cloth.position.set(tx, 0.72, tz);
        g.add(cloth);
      }
      for (const [sx, sz] of [[-1.18, 0], [1.18, 0], [0, 1.18]]) {
        const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.48, 8), oakMat);
        stool.position.set(tx + sx, 0.24, tz + sz);
        g.add(stool);
      }
      if (withTankards) {
        for (const [mx, mz] of [[-0.28, -0.14], [0.24, 0.18]]) {
          const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.22, 8), goldMat);
          mug.position.set(tx + mx, 0.96, tz + mz);
          g.add(mug);
        }
      }
    };

    // 2. Role-Tailored Bespoke Room Architecture!
    if (kind === 'weapon') {
      // SMITHERY: Blazing Stone Forge + Coal Bed + Chimney Hood + Quench Tub + 3 Sword Racks + Merchant Counter!
      addCounter(W * 0.5, 6.2, 4.6, '#b91c1c');
      const forgeBase = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.15, 1.8), stoneMat);
      forgeBase.position.set(W * 0.5, 0.58, 2.55);
      forgeBase.castShadow = !this.isSoftwareGl;
      const coals = new THREE.Mesh(
        new THREE.BoxGeometry(1.9, 0.24, 1.0),
        new THREE.MeshStandardMaterial({ color: '#f97316', emissive: '#ea580c', emissiveIntensity: 2.2 })
      );
      coals.position.set(W * 0.5, 1.18, 2.6);
      const hood = new THREE.Mesh(new THREE.ConeGeometry(1.65, 1.65, 4), ironMat);
      hood.rotation.y = Math.PI * 0.25;
      hood.position.set(W * 0.5, 2.58, 2.45);
      const forgeFl = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), flameMat);
      forgeFl.position.set(W * 0.5, 1.52, 2.6);
      this.fireFlames.push(forgeFl);
      const forgeGlow = new THREE.PointLight('#fb923c', 4.5, 14, 1.6);
      forgeGlow.position.set(W * 0.5, 1.75, 3.2);
      this.brazierLights.push(forgeGlow);
      // Water quench barrel
      const tub = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.48, 0.72, 12), darkOakMat);
      tub.position.set(W * 0.5 + 2.5, 0.36, 2.8);
      const water = new THREE.Mesh(
        new THREE.CylinderGeometry(0.46, 0.46, 0.08, 12),
        new THREE.MeshStandardMaterial({ color: '#0ea5e9', roughness: 0.15 })
      );
      water.position.set(W * 0.5 + 2.5, 0.68, 2.8);
      g.add(forgeBase, coals, hood, forgeFl, forgeGlow, tub, water);

      // 3 Gleaming 3D Sword & Polearm Weapon Racks!
      for (const [rx, rz, rRot] of [[3.2, 5.2, Math.PI * 0.5], [3.2, 8.8, Math.PI * 0.5], [W - 3.2, 5.2, -Math.PI * 0.5]]) {
        const rack = new THREE.Group();
        const stand = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.22, 0.42), darkOakMat);
        stand.position.y = 0.11;
        const bar = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 0.14), darkOakMat);
        bar.position.y = 1.05;
        rack.add(stand, bar);
        for (let si = 0; si < 4; si++) {
          const sx = -0.72 + si * 0.48;
          const blade = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.25, 0.04), si === 3 ? goldMat : steelMat);
          blade.position.set(sx, 0.96, 0);
          const guard = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.08), goldMat);
          guard.position.set(sx, 0.42, 0);
          const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.28, 6), darkOakMat);
          hilt.position.set(sx, 0.25, 0);
          rack.add(blade, guard, hilt);
        }
        rack.position.set(rx, 0, rz);
        rack.rotation.y = rRot;
        g.add(rack);
      }
    } else if (kind === 'armor') {
      // ARMORY: Polished Steel Cuirass Mannequins + Painted Heater Shield Racks + Counter!
      addCounter(W * 0.5, 6.2, 4.6, '#1d4ed8');
      addHearth(W * 0.5, 2.2);
      const shieldCols = ['#2563eb', '#dc2626', '#eab308', '#16a34a'];
      for (const [ax, az, idx] of [[3.5, 4.2, 0], [3.5, 7.6, 1], [W - 3.5, 4.2, 2], [W - 3.5, 7.6, 3]]) {
        const stand = new THREE.Group();
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 1.45, 8), darkOakMat);
        post.position.y = 0.72;
        const cuirass = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.26, 0.68, 10), idx === 3 ? goldMat : steelMat);
        cuirass.position.y = 1.05;
        cuirass.castShadow = !this.isSoftwareGl;
        const helm = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), idx === 3 ? goldMat : steelMat);
        helm.position.y = 1.56;
        const shield = new THREE.Mesh(
          new THREE.BoxGeometry(0.54, 0.68, 0.1),
          new THREE.MeshStandardMaterial({ color: shieldCols[idx], metalness: 0.4, roughness: 0.4 })
        );
        shield.position.set(idx < 2 ? 0.34 : -0.34, 0.96, 0.18);
        stand.add(post, cuirass, helm, shield);
        stand.position.set(ax, 0, az);
        g.add(stand);
      }
    } else if (kind === 'fortune') {
      // FORTUNE PARLOR (Sara's Shop): Velvet Crystal Ball Table + Spinning Brass Astrolabe + Bookshelves + Candelabras!
      addRoundTable(W * 0.5, 6.8, '#6b21a8');
      const orbPed = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.18, 10), goldMat);
      orbPed.position.set(W * 0.5, 0.96, 6.8);
      const crystalBall = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 16, 14),
        new THREE.MeshStandardMaterial({
          color: '#d8b4fe',
          emissive: '#9333ea',
          emissiveIntensity: 1.45,
          roughness: 0.08,
          metalness: 0.2,
        })
      );
      crystalBall.position.set(W * 0.5, 1.32, 6.8);
      const astroRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.46, 0.032, 8, 24),
        goldMat
      );
      astroRing.position.set(W * 0.5, 1.32, 6.8);
      this.spinners.push({ obj: astroRing, axis: 'y', speed: 1.4 });
      const orbGlow = new THREE.PointLight('#c084fc', 3.4, 11, 1.6);
      orbGlow.position.set(W * 0.5, 1.75, 6.8);
      this.brazierLights.push(orbGlow);
      g.add(orbPed, crystalBall, astroRing, orbGlow);
      addBookshelf(3.4, 2.3);
      addBookshelf(W - 3.4, 2.3);
      addBookshelf(2.5, 7.2, Math.PI * 0.5);
      addBookshelf(W - 2.5, 7.2, -Math.PI * 0.5);
    } else if (kind === 'inn') {
      // HARBOR INN: Reception Desk + Stone Fireplace + 4 Cozy Guest Beds with Colorful Quilts!
      addCounter(W * 0.5, 5.4, 4.4, '#047857');
      addHearth(W * 0.5, 2.2);
      addBed(3.6, 4.4, '#dc2626');
      addBed(3.6, 8.6, '#2563eb');
      addBed(W - 3.6, 4.4, '#059669');
      addBed(W - 3.6, 8.6, '#ca8a04');
    } else if (kind === 'tavern') {
      // TAVERN: Long Oak Bar Counter + Stacked Ale Casks + 4 Tables with Golden Tankards & Stools!
      addCounter(W * 0.5, 4.6, 7.4, '#991b1b');
      for (let i = 0; i < 5; i++) {
        const cask = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.96, 12), darkOakMat);
        cask.rotation.x = Math.PI * 0.5;
        cask.position.set(W * 0.5 - 2.6 + i * 1.3, 0.55, 2.45);
        const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 6, 14), ironMat);
        hoop.position.set(W * 0.5 - 2.6 + i * 1.3, 0.55, 2.72);
        g.add(cask, hoop);
      }
      addRoundTable(4.6, 8.5, undefined, true);
      addRoundTable(W - 4.6, 8.5, undefined, true);
      addRoundTable(5.2, 11.4, undefined, true);
      addRoundTable(W - 5.2, 11.4, undefined, true);
    } else if (kind === 'library' || kind === 'guild') {
      // LIBRARY / ADVENTURERS GUILDHALL: Towering Bookshelves + Central Esteria Map Table + Reading Desks!
      addHearth(W * 0.5, 2.2);
      addBookshelf(3.4, 2.3);
      addBookshelf(W - 3.4, 2.3);
      addBookshelf(2.5, 5.6, Math.PI * 0.5);
      addBookshelf(2.5, 9.0, Math.PI * 0.5);
      addBookshelf(W - 2.5, 5.6, -Math.PI * 0.5);
      addBookshelf(W - 2.5, 9.0, -Math.PI * 0.5);
      // Central Grand Oak Map Table with Parchment Scroll Map
      const mapTbl = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.84, 1.9), oakMat);
      mapTbl.position.set(W * 0.5, 0.42, 7.2);
      mapTbl.castShadow = !this.isSoftwareGl;
      const parchment = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 0.05, 1.35),
        new THREE.MeshStandardMaterial({ color: '#fef3c7', roughness: 0.9 })
      );
      parchment.position.set(W * 0.5, 0.87, 7.2);
      g.add(mapTbl, parchment);
    } else if (kind === 'clinic') {
      // APOTHECARY / HERBALIST CLINIC: Potion Bottle Shelves + Alchemy Counter + Potted Celceta Herbs!
      addCounter(W * 0.5, 6.0, 4.8, '#059669');
      const potionCols = ['#22c55e', '#ef4444', '#38bdf8', '#a855f7', '#facc15'];
      for (const sx of [3.8, W - 3.8]) {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.95, 0.52), darkOakMat);
        shelf.position.set(sx, 0.98, 2.35);
        g.add(shelf);
        for (let row = 0; row < 2; row++) {
          for (let pi = 0; pi < 5; pi++) {
            const vial = new THREE.Mesh(
              new THREE.CylinderGeometry(0.09, 0.11, 0.28, 8),
              new THREE.MeshStandardMaterial({
                color: potionCols[(row * 2 + pi) % potionCols.length],
                emissive: potionCols[(row * 2 + pi) % potionCols.length],
                emissiveIntensity: 0.6,
                roughness: 0.15,
              })
            );
            vial.position.set(sx - 0.8 + pi * 0.4, 0.72 + row * 0.62, 2.6);
            g.add(vial);
          }
        }
      }
      // Potted Celceta Herb Planters
      for (const [px, pz] of [[3.2, 8.2], [W - 3.2, 8.2]]) {
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.26, 0.48, 10), new THREE.MeshStandardMaterial({ color: '#b45309', roughness: 0.8 }));
        pot.position.set(px, 0.24, pz);
        const herb = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 0), new THREE.MeshStandardMaterial({ color: '#22c55e', roughness: 0.75 }));
        herb.position.set(px, 0.68, pz);
        g.add(pot, herb);
      }
    } else {
      // ELDER HOUSE / COTTAGE (Jeva, Lilia, Lance Elder): Cozy Hearth + Dining Table + Bookshelves + Storage Chest!
      addHearth(W * 0.5, 2.2);
      addBookshelf(3.5, 2.3);
      addBookshelf(W - 3.5, 2.3);
      addRoundTable(4.6, 8.2, '#b91c1c');
      addBed(W - 3.6, 6.2, '#1d4ed8');
    }
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

    // Dense impassable transitional woodland underbrush mounds beneath perimeter forest tiles!
    const borderUnderbrush: Array<[number, number]> = [];
    for (const [c, r, isRoda] of treeTiles) {
      if (!isRoda && (c <= 3 || c >= W - 4 || r <= 3 || r >= H - 4)) {
        borderUnderbrush.push([c, r]);
      }
    }
    if (borderUnderbrush.length > 0) {
      const underGeo = new THREE.IcosahedronGeometry(0.62, 1);
      const underMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.84 });
      attachGpuFoliagePhysics(underMat, this.sharedUniforms, 0.04, 0.0);
      const underInst = new THREE.InstancedMesh(underGeo, underMat, borderUnderbrush.length);
      underInst.receiveShadow = true;
      borderUnderbrush.forEach(([c, r], i) => {
        const gy = this.sampleGroundY(c + 0.5, r + 0.5);
        const h1 = hash2d(c, r, 511);
        const h2 = hash2d(c, r, 517);
        _dummy.position.set(c + 0.5 + (h1 - 0.5) * 0.28, gy + 0.32, r + 0.5 + (h2 - 0.5) * 0.28);
        _dummy.rotation.set(0, h1 * Math.PI * 2, 0);
        _dummy.scale.set(1.12 + h1 * 0.42, 0.58 + h2 * 0.42, 1.12 + h2 * 0.42);
        _dummy.updateMatrix();
        underInst.setMatrixAt(i, _dummy.matrix);
        underInst.setColorAt(i, _color.set(h1 < 0.34 ? '#0f6620' : h1 < 0.68 ? '#17822b' : '#229c38'));
      });
      if (underInst.instanceColor) underInst.instanceColor.needsUpdate = true;
      underInst.computeBoundingSphere();
      g.add(underInst);
    }

    // Track canopy spawn anchors for tumbling 3D Falling Leaves!
    const leafSpawnSpots: Array<{ x: number; y: number; z: number; radX: number; radZ: number; color: string }> = [];

    // Vibrant sunlit emerald / deep forest jade botanical canopy palette!
    const grovePalette = ['#1fb83a', '#16942e', '#38d44a', '#24a83b', '#147d28', '#4ee058'];

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
    // Organically Sculpted Cloud-Bough Canopy Geometry (perturbed subdivision-2 icosahedron for lush silhouette!)
    const domeGeo = new THREE.IcosahedronGeometry(0.68, 2);
    {
      const dp = domeGeo.attributes.position as THREE.BufferAttribute;
      for (let vi = 0; vi < dp.count; vi++) {
        const vx = dp.getX(vi);
        const vy = dp.getY(vi);
        const vz = dp.getZ(vi);
        const ripple = 1 + 0.14 * Math.sin(vx * 7.2 + vz * 5.8) * Math.cos(vy * 6.4);
        dp.setXYZ(vi, vx * ripple, vy * (vy < 0 ? 0.86 : 1.04) * ripple, vz * ripple);
      }
      domeGeo.computeVertexNormals();
    }
    const vineGeo = new THREE.CylinderGeometry(0.022, 0.012, 1.15, 4);
    vineGeo.translate(0, -0.575, 0); // Pivot from TOP attachment point for natural pendulum swing!
    const vineMat = new THREE.MeshStandardMaterial({ color: '#1b8532', roughness: 0.78 });
    attachGpuFoliagePhysics(vineMat, this.sharedUniforms, 0.14, 0.0);

    for (const gr of multiGroves) {
      const cx = gr.c + gr.w * 0.5;
      const cz = gr.r + gr.h * 0.5;
      const gy = this.sampleGroundY(cx, cz);
      const avgSpan = (gr.w + gr.h) * 0.5;
      const scH = gr.isRoda ? 2.15 : 1.08 + avgSpan * 0.44;
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

      // Intertwined Multi-Trunk Architecture
      const trunkCount = gr.w >= 3 || gr.h >= 3 ? (gr.isRoda ? 1 : 2) : 1;
      for (let ti = 0; ti < trunkCount; ti++) {
        const offFrac = trunkCount === 1 ? 0 : ti === 0 ? -0.24 : 0.24;
        const ox = gr.w >= gr.h ? offFrac * gr.w : 0;
        const oz = gr.h > gr.w ? offFrac * gr.h : 0;
        const trk = new THREE.Mesh(trunkGeo, barkMat);
        trk.position.set(ox, 0, oz);
        trk.rotation.y = rot + ti * 1.8;
        const thick = (gr.isRoda ? 1.9 : 0.94 + avgSpan * 0.28) * (trunkCount > 1 ? 0.85 : 1);
        trk.scale.set(thick, scH, thick);
        trk.castShadow = !this.isSoftwareGl;
        trk.receiveShadow = true;
        treeGrp.add(trk);

        for (let b = 0; b < 4; b++) {
          const ba = rot + b * (Math.PI * 0.5) + ti * 0.45;
          const bough = new THREE.Mesh(branchGeo, barkMat);
          bough.position.set(ox, 0, oz);
          bough.rotation.y = ba;
          bough.scale.set(gr.w * 0.58, scH * 0.96, gr.h * 0.58);
          bough.castShadow = !this.isSoftwareGl;
          treeGrp.add(bough);

          const rt = new THREE.Mesh(rootGeo, barkMat);
          rt.position.set(ox, 0, oz);
          rt.rotation.y = ba + 0.38;
          rt.scale.set(gr.w * 0.54, scH * 0.68, gr.h * 0.54);
          treeGrp.add(rt);
        }
      }

      // 3-Tier Elaborate Sculpted 3D Canopy with Independently Articulated Swaying Limb Groups!
      const skirtMat = volCoreMat.clone();
      skirtMat.color.set(gr.isRoda ? '#15803d' : baseHex).offsetHSL(0, 0.06, -0.14);
      const midMat = volCoreMat.clone();
      midMat.color.set(gr.isRoda ? '#22c55e' : baseHex).offsetHSL(0, 0.04, 0.0);
      const crownMat = volCoreMat.clone();
      crownMat.color.set(baseHex).offsetHSL(-0.02, 0.08, 0.12);
      const cardColMat = broadLeafMat.clone();
      cardColMat.color.set(baseHex);

      // Tier 1: Deep Interior Shadow Skirt
      const skirt = new THREE.Mesh(domeGeo, skirtMat);
      skirt.position.set(0, 1.38 * scH, 0);
      skirt.scale.set(gr.w * 0.62, 0.56 * scH, gr.h * 0.62);
      skirt.castShadow = !this.isSoftwareGl;
      skirt.receiveShadow = true;
      treeGrp.add(skirt);

      // Tier 2: Independently Articulated Swaying Branch-Tip Bough Groups (each lobe + outward leaf fronds move out of phase in wind!)
      const lobeCount = Math.min(10, Math.max(5, Math.round(gr.w * gr.h * 0.95) + 2));
      for (let l = 0; l < lobeCount; l++) {
        const a = (l / lobeCount) * Math.PI * 2 + rot;
        const rx = Math.cos(a) * gr.w * 0.38;
        const rz = Math.sin(a) * gr.h * 0.38;
        const ly = (1.62 + (l % 2) * 0.32) * scH;

        const limbPivot = new THREE.Group();
        limbPivot.position.set(rx * 0.42, ly - 0.16 * scH, rz * 0.42);
        const lobe = new THREE.Mesh(domeGeo, l % 3 === 0 ? crownMat : midMat);
        lobe.position.set(rx * 0.58, 0.16 * scH, rz * 0.58);
        const sx = (0.76 + avgSpan * 0.2) * (0.9 + hash2d(gr.c + l, gr.r, 561) * 0.26);
        const sz = (0.76 + avgSpan * 0.2) * (0.9 + hash2d(gr.c, gr.r + l, 562) * 0.26);
        lobe.scale.set(sx, 0.68 * scH, sz);
        lobe.castShadow = !this.isSoftwareGl;
        lobe.receiveShadow = true;
        limbPivot.add(lobe);

        // Attach 2 outward botanical leaf-frond cards directly onto the articulated swaying limb!
        for (let cf = 0; cf < 2; cf++) {
          const fa = a + (cf === 0 ? -0.26 : 0.26);
          const card = new THREE.Mesh(leafCardGeo, cardColMat);
          card.position.set(rx * 0.72 + Math.cos(fa) * 0.28, (0.14 + cf * 0.34) * scH, rz * 0.72 + Math.sin(fa) * 0.28);
          card.rotation.set(cf === 0 ? 0.44 : 0.24, fa + Math.PI * 0.5, (hash2d(l * 2 + cf, gr.c, 533) - 0.5) * 0.35);
          card.scale.setScalar((cf === 0 ? 1.08 : 0.94) * (0.82 + avgSpan * 0.22));
          card.castShadow = !this.isSoftwareGl;
          card.receiveShadow = true;
          limbPivot.add(card);
        }

        treeGrp.add(limbPivot);
        this.treeMovingParts.push({
          obj: limbPivot,
          baseRx: 0,
          baseRy: 0,
          baseRz: 0,
          ampX: 0.055 + hash2d(l, gr.c, 591) * 0.035,
          ampZ: 0.065 + hash2d(l, gr.r, 592) * 0.04,
          speed: 1.45 + hash2d(gr.c, l, 593) * 0.65,
          phase: l * 1.15 + gr.c * 0.4 + gr.r * 0.3,
          wx: cx + rx,
          wz: cz + rz,
        });
      }

      // Tier 3: Articulated Sunlit Spring-Lime Upper Crown Puffs (independently nodding in higher wind!)
      for (let cr = 0; cr < 3; cr++) {
        const ca = rot + cr * 2.094;
        const crx = cr === 0 ? 0 : Math.cos(ca) * gr.w * 0.18;
        const crz = cr === 0 ? 0 : Math.sin(ca) * gr.h * 0.18;
        const crownPivot = new THREE.Group();
        crownPivot.position.set(crx, (cr === 0 ? 2.1 : 1.92) * scH, crz);
        const puff = new THREE.Mesh(domeGeo, crownMat);
        puff.position.y = 0.22 * scH;
        puff.scale.set(gr.w * (cr === 0 ? 0.44 : 0.32), (cr === 0 ? 0.82 : 0.66) * scH, gr.h * (cr === 0 ? 0.44 : 0.32));
        puff.castShadow = !this.isSoftwareGl;
        puff.receiveShadow = true;
        crownPivot.add(puff);
        treeGrp.add(crownPivot);
        this.treeMovingParts.push({
          obj: crownPivot,
          baseRx: 0,
          baseRy: 0,
          baseRz: 0,
          ampX: 0.072,
          ampZ: 0.082,
          speed: 1.85 + cr * 0.25,
          phase: cr * 2.1 + gr.c * 0.5,
          wx: cx + crx,
          wz: cz + crz,
        });
      }

      // Top-Pivoted Pendulum-Swinging Hanging Vines & Blossom Garlands under Multi-Tile Groves!
      if (avgSpan >= 2.0 || gr.isRoda) {
        const vineCount = Math.min(8, Math.round(avgSpan * 2.2));
        for (let vi = 0; vi < vineCount; vi++) {
          const va = rot + (vi / vineCount) * Math.PI * 2 + 0.35;
          const vx = Math.cos(va) * gr.w * 0.42;
          const vz = Math.sin(va) * gr.h * 0.42;
          const vine = new THREE.Mesh(vineGeo, vineMat);
          vine.position.set(vx, 1.56 * scH, vz);
          vine.scale.set(1, 0.72 + hash2d(gr.c + vi, gr.r, 577) * 0.55, 1);
          treeGrp.add(vine);
          this.treeMovingParts.push({
            obj: vine,
            baseRx: 0,
            baseRy: 0,
            baseRz: 0,
            ampX: 0.17,
            ampZ: 0.21,
            speed: 2.1 + (vi % 3) * 0.35,
            phase: vi * 1.45 + gr.r * 0.5,
            wx: cx + vx,
            wz: cz + vz,
          });
        }
      }

      treeGrp.position.set(cx, gy, cz);
      g.add(treeGrp);

      leafSpawnSpots.push({
        x: cx,
        y: gy + 1.95 * scH,
        z: cz,
        radX: gr.w * 0.54,
        radZ: gr.h * 0.54,
        color: isBlossom ? '#f9a8d4' : gr.isRoda ? '#fde047' : baseHex,
      });

      // Register outer canopy bough perches for living 3D birds flying to/from fountains!
      const perchR = Math.max(0.55, avgSpan * 0.28);
      for (let p = 0; p < 2; p++) {
        const pa = hash2d(gr.c + p, gr.r, 811) * Math.PI * 2;
        this.treePerchSpots.push({
          x: cx + Math.cos(pa) * perchR,
          y: gy + (2.42 + p * 0.24) * scH,
          z: cz + Math.sin(pa) * perchR,
        });
      }
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
        if (i % 2 === 0) {
          this.treePerchSpots.push({
            x: bx + (hash2d(c, r, 819) - 0.5) * 0.45,
            y: gy + 2.38 * sc,
            z: bz + (hash2d(r, c, 821) - 0.5) * 0.45,
          });
        }
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

    // 3. 4-TIER SCULPTED EMERALD ALPINE CONIFERS & CYPRESS SPIRES!
    if (cypressTrees.length > 0) {
      const spireGeo = new THREE.PlaneGeometry(1.22, 3.35);
      spireGeo.translate(0, 1.68, 0);
      const coniferTrunkGeo = new THREE.CylinderGeometry(0.11, 0.18, 0.85, 6);
      coniferTrunkGeo.translate(0, 0.42, 0);
      const tierGeo = new THREE.ConeGeometry(0.68, 1.12, 8);
      const coreMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.78 });
      attachGpuFoliagePhysics(coreMat, this.sharedUniforms, 0.065, 0.0);

      const cTrunkInst = new THREE.InstancedMesh(coniferTrunkGeo, barkMat, cypressTrees.length);
      cTrunkInst.castShadow = !this.isSoftwareGl;
      const tiersPerTree = 4;
      const tierInst = new THREE.InstancedMesh(tierGeo, coreMat, cypressTrees.length * tiersPerTree);
      tierInst.castShadow = !this.isSoftwareGl;
      tierInst.receiveShadow = true;

      const planesPerCypress = 3;
      const cypInst = new THREE.InstancedMesh(spireGeo, cypressMat, cypressTrees.length * planesPerCypress);
      cypInst.castShadow = !this.isSoftwareGl;
      cypInst.receiveShadow = true;

      const cypressPalette = ['#2ec445', '#1d7a32', '#4bd954', '#2c9e3e', '#3ab54a', '#268f3c'];
      let tIdx = 0;
      let cIdx = 0;
      cypressTrees.forEach(([c, r], ci) => {
        const gy = this.sampleGroundY(c + 0.5, r + 0.65);
        const scH = 0.96 + hash2d(c, r, 551) * 0.46;
        const scW = 0.86 + hash2d(c, r, 552) * 0.3;
        const baseRot = hash2d(c, r, 553) * Math.PI;
        const hex = cypressPalette[Math.floor(hash2d(c, r, 554) * cypressPalette.length)];
        _dummy.position.set(c + 0.5, gy, r + 0.65);
        _dummy.rotation.set(0, baseRot, 0);
        _dummy.scale.set(scW, scH, scW);
        _dummy.updateMatrix();
        cTrunkInst.setMatrixAt(ci, _dummy.matrix);

        // 4 Stacked Sculpted Conifer Bough Tiers (dark underside to sunlit emerald spire apex!)
        for (let ti = 0; ti < tiersPerTree; ti++) {
          const frac = ti / (tiersPerTree - 1);
          const tRad = (1.12 - frac * 0.56) * scW;
          const tY = gy + (0.95 + ti * 0.64) * scH;
          _dummy.position.set(c + 0.5, tY, r + 0.65);
          _dummy.rotation.set(0, baseRot + ti * 0.62, 0);
          _dummy.scale.set(tRad, (0.92 - frac * 0.14) * scH, tRad);
          _dummy.updateMatrix();
          tierInst.setMatrixAt(tIdx, _dummy.matrix);
          tierInst.setColorAt(tIdx, _color.set(hex).offsetHSL(0, 0.04, (frac - 0.45) * 0.14));
          tIdx++;
        }

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
      if (tierInst.instanceColor) tierInst.instanceColor.needsUpdate = true;
      if (cypInst.instanceColor) cypInst.instanceColor.needsUpdate = true;
      cTrunkInst.computeBoundingSphere();
      tierInst.computeBoundingSphere();
      cypInst.computeBoundingSphere();
      g.add(cTrunkInst, tierInst, cypInst);
    }

    // 4. ANIMATED 3D TUMBLING FALLING LEAVES & BLOSSOM PETALS DRIFTING FROM CANOPIES!
    if (leafSpawnSpots.length > 0) {
      const leafCount = this.isSoftwareGl ? 140 : 300;
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
  // Lush Painterly Ghibli-Style Living Meadow Grass, Wildflowers, Mushrooms & Butterflies!
  // --------------------------------------------------------------------------
  private createMeadowGrassTuftTexture(): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, 128, 128);

    // Paint 9 gracefully curved overlapping meadow blades (deep shaded roots -> sunlit golden-emerald tips!)
    const blades: Array<[number, number, number, number, number]> = [
      [18, 126, 6, 48, 10],
      [30, 126, 16, 26, 11],
      [44, 126, 36, 14, 12],
      [56, 126, 56, 10, 12],
      [68, 126, 74, 14, 12],
      [82, 126, 94, 24, 11],
      [96, 126, 112, 42, 10],
      [40, 126, 26, 52, 9],
      [88, 126, 104, 56, 9],
    ];
    for (const [bx, by, tx, ty, w] of blades) {
      const grad = ctx.createLinearGradient(bx, by, tx, ty);
      grad.addColorStop(0, '#0b5c1c');
      grad.addColorStop(0.45, '#1ea837');
      grad.addColorStop(0.82, '#5ee052');
      grad.addColorStop(1, '#d9f99d');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(bx - w * 0.5, by);
      ctx.quadraticCurveTo((bx + tx) * 0.5 - w * 0.35, (by + ty) * 0.5, tx, ty);
      ctx.quadraticCurveTo((bx + tx) * 0.5 + w * 0.35, (by + ty) * 0.5, bx + w * 0.5, by);
      ctx.closePath();
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.maxAniso;
    this.zoneOwnedTextures.push(tex);
    return tex;
  }

  private buildGpuBendingMeadowGrass(
    g: THREE.Group,
    theme: ZoneDef['theme'],
    openTiles: Array<[number, number]>,
    flowerTiles: Array<[number, number]>
  ): void {
    // 1. Crossed-Card Botanical 3D Grass Tufts (Sun-Kissed Rolling Wind Waves!)
    const tuftTex = this.createMeadowGrassTuftTexture();
    const tuftMat = new THREE.MeshStandardMaterial({
      map: tuftTex,
      color: '#ffffff',
      alphaTest: 0.38,
      side: THREE.DoubleSide,
      roughness: 0.72,
    });
    attachGpuFoliagePhysics(tuftMat, this.sharedUniforms, 0.14, 0.52);

    const tuftCount = Math.min(this.isSoftwareGl ? 1350 : 2800, openTiles.length * 3);
    const tuftGeo = new THREE.PlaneGeometry(0.66, 0.56);
    tuftGeo.translate(0, 0.26, 0);
    const grassCardA = new THREE.InstancedMesh(tuftGeo, tuftMat, tuftCount);
    const grassCardB = new THREE.InstancedMesh(tuftGeo, tuftMat, tuftCount);
    grassCardA.receiveShadow = true;
    grassCardB.receiveShadow = true;

    for (let i = 0; i < tuftCount; i++) {
      const [c, r] = openTiles[Math.floor(hash2d(i, 1, 601) * openTiles.length)];
      const ox = hash2d(i, 2, 601) * 0.86 + 0.07;
      const oz = hash2d(i, 3, 601) * 0.86 + 0.07;
      const gy = this.sampleGroundY(c + ox, r + oz);
      const scW = 0.78 + hash2d(i, 4, 601) * 0.68;
      const scH = 0.72 + hash2d(i, 7, 601) * 0.82;
      const rot = hash2d(i, 5, 601) * Math.PI;
      const t = hash2d(i, 6, 601);
      const colHex =
        theme === 'plains'
          ? t < 0.3
            ? '#74e364'
            : t < 0.68
              ? '#b4f88c'
              : '#eefc96'
          : t < 0.3
            ? '#5ed95b'
            : t < 0.68
              ? '#a5f380'
              : '#d9f99d';

      _dummy.position.set(c + ox, gy, r + oz);
      _dummy.rotation.set(0, rot, 0);
      _dummy.scale.set(scW, scH, scW);
      _dummy.updateMatrix();
      grassCardA.setMatrixAt(i, _dummy.matrix);
      grassCardA.setColorAt(i, _color.set(colHex));

      _dummy.rotation.set(0, rot + Math.PI * 0.5, 0);
      _dummy.updateMatrix();
      grassCardB.setMatrixAt(i, _dummy.matrix);
      grassCardB.setColorAt(i, _color.set(colHex));
    }
    if (grassCardA.instanceColor) grassCardA.instanceColor.needsUpdate = true;
    if (grassCardB.instanceColor) grassCardB.instanceColor.needsUpdate = true;
    grassCardA.computeBoundingSphere();
    grassCardB.computeBoundingSphere();
    g.add(grassCardA, grassCardB);

    // 2. Lush Clover Cushions, Mossy Stepping Pebbles & Storybook Red-Cap Woodland Toadstools!
    const microCount = Math.min(this.isSoftwareGl ? 260 : 540, Math.floor(openTiles.length * 0.5));
    if (microCount > 0) {
      const cloverGeo = new THREE.DodecahedronGeometry(0.15, 0);
      const cloverMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.74 });
      attachGpuFoliagePhysics(cloverMat, this.sharedUniforms, 0.06, 0.25);
      const cloverInst = new THREE.InstancedMesh(cloverGeo, cloverMat, microCount);
      cloverInst.receiveShadow = true;
      for (let i = 0; i < microCount; i++) {
        const [c, r] = openTiles[Math.floor(hash2d(i, 9, 631) * openTiles.length)];
        const ox = 0.14 + hash2d(i, 10, 631) * 0.72;
        const oz = 0.14 + hash2d(i, 11, 631) * 0.72;
        const gy = this.sampleGroundY(c + ox, r + oz);
        const isStone = i % 6 === 0;
        const isShroom = i % 11 === 0;
        _dummy.position.set(c + ox, gy + (isStone ? 0.04 : isShroom ? 0.12 : 0.07), r + oz);
        _dummy.rotation.set(0, hash2d(i, 12, 631) * Math.PI * 2, 0);
        _dummy.scale.set(
          isStone ? 1.15 : isShroom ? 0.85 : 1.4,
          isStone ? 0.42 : isShroom ? 0.72 : 0.56,
          isStone ? 0.95 : isShroom ? 0.85 : 1.4
        );
        _dummy.updateMatrix();
        cloverInst.setMatrixAt(i, _dummy.matrix);
        cloverInst.setColorAt(
          i,
          _color.set(isStone ? '#788074' : isShroom ? '#ef4444' : i % 2 === 0 ? '#15803d' : '#22c55e')
        );
      }
      if (cloverInst.instanceColor) cloverInst.instanceColor.needsUpdate = true;
      cloverInst.computeBoundingSphere();
      g.add(cloverInst);
    }

    // 3. Stemmed Wildflowers (Daisies, Buttercups, Poppies, Forget-Me-Nots & Dandelion Puffs) across Grass & Meadows!
    const bloomSource = flowerTiles.length > 0 ? flowerTiles : openTiles;
    const flCount = Math.min(this.isSoftwareGl ? 320 : 620, Math.max(120, bloomSource.length * 4));
    const stemGeo = new THREE.CylinderGeometry(0.014, 0.018, 0.34, 4);
    stemGeo.translate(0, 0.17, 0);
    const stemMat = new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.75 });
    attachGpuFoliagePhysics(stemMat, this.sharedUniforms, 0.12, 0.42);
    const flGeo = new THREE.DodecahedronGeometry(0.095, 0);
    flGeo.translate(0, 0.36, 0);
    const flMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.42 });
    attachGpuFoliagePhysics(flMat, this.sharedUniforms, 0.12, 0.42);

    const stemInst = new THREE.InstancedMesh(stemGeo, stemMat, flCount);
    const flInst = new THREE.InstancedMesh(flGeo, flMat, flCount);
    const bloomPalette = ['#fde047', '#ffffff', '#f472b6', '#fb7185', '#38bdf8', '#c084fc', '#fb923c'];
    for (let i = 0; i < flCount; i++) {
      const [c, r] =
        i % 3 === 0 && openTiles.length > 0
          ? openTiles[Math.floor(hash2d(i, 8, 619) * openTiles.length)]
          : bloomSource[i % bloomSource.length];
      const fx = c + 0.14 + hash2d(i, 1, 619) * 0.72;
      const fz = r + 0.14 + hash2d(i, 2, 619) * 0.72;
      const sc = 0.8 + hash2d(i, 4, 619) * 0.62;
      _dummy.position.set(fx, this.sampleGroundY(fx, fz), fz);
      _dummy.rotation.set(0, hash2d(i, 3, 619) * Math.PI, 0);
      _dummy.scale.set(sc, sc, sc);
      _dummy.updateMatrix();
      stemInst.setMatrixAt(i, _dummy.matrix);
      flInst.setMatrixAt(i, _dummy.matrix);
      flInst.setColorAt(i, _color.set(bloomPalette[i % bloomPalette.length]));
    }
    if (flInst.instanceColor) flInst.instanceColor.needsUpdate = true;
    stemInst.computeBoundingSphere();
    flInst.computeBoundingSphere();
    g.add(stemInst, flInst);

    // 4. Living Fluttering 3D Butterflies & Iridescent Dragonflies Dancing Over Meadows & Flowers!
    const bfCount = this.isSoftwareGl ? 10 : 18;
    const bfColors = ['#fde047', '#fb923c', '#38bdf8', '#f472b6', '#a7f3d0', '#ffffff'];
    const wingGeo = new THREE.PlaneGeometry(0.16, 0.13);
    wingGeo.translate(0.08, 0, 0);
    const bfBodyMat = new THREE.MeshBasicMaterial({ color: '#1e293b' });
    for (let i = 0; i < bfCount; i++) {
      const [c, r] = bloomSource[Math.floor(hash2d(i, 17, 757) * bloomSource.length)];
      const cx = c + 0.5;
      const cz = r + 0.5;
      const baseY = this.sampleGroundY(cx, cz) + 0.85 + hash2d(i, 18, 757) * 0.9;
      const grp = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.012, 0.16, 5), bfBodyMat);
      body.rotation.x = Math.PI * 0.5;
      const wMat = new THREE.MeshBasicMaterial({
        color: bfColors[i % bfColors.length],
        side: THREE.DoubleSide,
      });
      const wingL = new THREE.Mesh(wingGeo, wMat);
      wingL.rotation.x = -Math.PI * 0.5;
      wingL.rotation.y = Math.PI;
      const wingR = new THREE.Mesh(wingGeo, wMat);
      wingR.rotation.x = -Math.PI * 0.5;
      grp.add(body, wingL, wingR);
      grp.position.set(cx, baseY, cz);
      g.add(grp);
      this.butterflyRigs.push({
        grp,
        wingL,
        wingR,
        cx,
        cz,
        baseY,
        rx: 1.4 + hash2d(i, 19, 757) * 2.4,
        rz: 1.4 + hash2d(i, 20, 757) * 2.4,
        speed: 0.45 + hash2d(i, 21, 757) * 0.45,
        phase: hash2d(i, 22, 757) * Math.PI * 2,
        flapSpeed: 16 + hash2d(i, 23, 757) * 10,
      });
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
      if (p.isDoorway) continue;
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

    // 2. Taller Ornate Wrought-Iron Streetlamp Posts with Sculpted Plinths & Swaying Hanging Glass Lanterns!
    if (zone.theme === 'town' || zone.theme === 'village') {
      let lanternCount = 0;
      for (const [c, r] of roadTiles) {
        if (lanternCount >= 16) break;
        if ((c * 13 + r * 29) % 19 !== 0) continue;
        const sideC = c + 1 < zone.width && zone.tiles[r][c + 1] === 0 ? c + 1 : c - 1;
        if (sideC < 2 || sideC >= zone.width - 2 || zone.tiles[r][sideC] !== 0 || occupied.has(`${sideC},${r}`)) continue;
        mark(sideC, r);
        lanternCount++;
        this.buildOrnateStreetLamp(g, sideC + 0.5, r + 0.5, sideC > c ? -1 : 1, lanternCount);
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
      this.registerDynamicObstacle(millX, millZ, 40);
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
        this.registerDynamicObstacle(cx, cz, Math.max(18, Math.min(hw, hh) * 14));
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
            this.registerDynamicObstacle(c + 0.2, r + 0.8, 34);
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
    this.registerDynamicObstacle(x, z, 26);
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
    this.registerDynamicObstacle(x, z, 28);
  }

  private buildOrnateStreetLamp(g: THREE.Group, x: number, z: number, armDir: number, seedIdx: number): void {
    const gy = this.sampleGroundY(x, z);
    const post = new THREE.Group();

    const plinthStoneMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.82 });
    const ironMat = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.84, roughness: 0.32 });
    const brassMat = new THREE.MeshStandardMaterial({ color: '#d97706', metalness: 0.88, roughness: 0.24 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: '#fef3c7',
      emissive: '#f59e0b',
      emissiveIntensity: 0.55,
      transparent: true,
      opacity: 0.42,
      roughness: 0.14,
      depthWrite: false,
    });
    const waxMat = new THREE.MeshStandardMaterial({ color: '#fffbeb', roughness: 0.65 });
    const flameCoreMat = new THREE.MeshBasicMaterial({ color: '#fef08a' });
    const haloMat = new THREE.MeshBasicMaterial({
      color: '#fbbf24',
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    // 1. Multi-Tiered Sculpted Pedestal Base (stepped octagonal stone plinth + chamfered iron pedestal + brass collar + 4 wrought-iron buttress fins!)
    const stoneStep1 = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.14, 8), plinthStoneMat);
    stoneStep1.position.y = 0.07;
    stoneStep1.receiveShadow = true;
    const stoneStep2 = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.29, 0.14, 8), plinthStoneMat);
    stoneStep2.position.y = 0.21;
    const ironPed = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.21, 0.34, 8), ironMat);
    ironPed.position.y = 0.45;
    ironPed.castShadow = !this.isSoftwareGl;
    const baseCollar = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.028, 6, 12), brassMat);
    baseCollar.rotation.x = Math.PI * 0.5;
    baseCollar.position.y = 0.62;
    post.add(stoneStep1, stoneStep2, ironPed, baseCollar);

    for (let f = 0; f < 4; f++) {
      const fa = (f * Math.PI) / 2 + Math.PI * 0.25;
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.38, 0.14), ironMat);
      fin.position.set(Math.cos(fa) * 0.14, 0.42, Math.sin(fa) * 0.14);
      fin.rotation.y = -fa + Math.PI * 0.5;
      fin.rotation.x = 0.26;
      post.add(fin);
    }

    // 2. Taller Fluted Dark-Iron Shaft (~2.85 units tall!) + Mid-Shaft Brass Rings + Gothic Spire Finial
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.072, 2.18, 8), ironMat);
    shaft.position.y = 1.66;
    shaft.castShadow = !this.isSoftwareGl;
    const midCollar1 = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.02, 6, 10), brassMat);
    midCollar1.rotation.x = Math.PI * 0.5;
    midCollar1.position.y = 1.38;
    const midCollar2 = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.02, 6, 10), brassMat);
    midCollar2.rotation.x = Math.PI * 0.5;
    midCollar2.position.y = 2.38;
    const finialBall = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), brassMat);
    finialBall.position.y = 2.78;
    const finialSpire = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.24, 6), ironMat);
    finialSpire.position.y = 2.94;
    post.add(shaft, midCollar1, midCollar2, finialBall, finialSpire);

    // 3. Sweeping Curved Wrought-Iron Scroll Arm + S-Scroll Brace
    const dir = armDir >= 0 ? 1 : -1;
    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 2.52, 0),
      new THREE.Vector3(dir * 0.22, 2.74, 0),
      new THREE.Vector3(dir * 0.48, 2.76, 0),
      new THREE.Vector3(dir * 0.56, 2.64, 0),
    ]);
    const scrollArm = new THREE.Mesh(new THREE.TubeGeometry(armCurve, 10, 0.026, 6, false), ironMat);
    const brace = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.018, 6, 10, Math.PI), brassMat);
    brace.position.set(dir * 0.16, 2.38, 0);
    brace.rotation.z = dir > 0 ? -Math.PI * 0.25 : Math.PI * 0.25;
    post.add(scrollArm, brace);

    // 4. Hanging Swaying Hexagonal Glass Lantern with Visible Candle & Flickering Bright Flame Inside!
    const lanternPivot = new THREE.Group();
    lanternPivot.position.set(dir * 0.56, 2.63, 0);

    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.18, 5), ironMat);
    chain.position.y = -0.09;
    const pagodaCap = new THREE.Mesh(new THREE.ConeGeometry(0.21, 0.18, 6), ironMat);
    pagodaCap.position.y = -0.25;
    const capRing = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 6, 8), brassMat);
    capRing.position.y = -0.17;
    const glassBody = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.125, 0.34, 6), glassMat);
    glassBody.position.y = -0.5;
    const lanternBase = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.07, 0.09, 6), ironMat);
    lanternBase.position.y = -0.7;

    // 4 Thin Iron Cage Bars framing the translucent glass panes
    for (let r = 0; r < 4; r++) {
      const ra = (r * Math.PI) / 2;
      const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.35, 4), ironMat);
      rib.position.set(Math.cos(ra) * 0.145, -0.5, Math.sin(ra) * 0.145);
      lanternPivot.add(rib);
    }

    // Visible Wax Candle & Flickering Inner Flame Core inside the Glass Lantern!
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.04, 0.13, 6), waxMat);
    candle.position.y = -0.59;
    const flame = new THREE.Mesh(new THREE.OctahedronGeometry(0.072, 0), flameCoreMat);
    flame.scale.set(0.72, 1.35, 0.72);
    flame.position.y = -0.47;
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), haloMat);
    halo.position.y = -0.48;

    lanternPivot.add(chain, capRing, pagodaCap, glassBody, lanternBase, candle, flame, halo);
    post.add(lanternPivot);

    // Soft Warm Ground Light Pool beneath the lantern
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(1.18, 16),
      new THREE.MeshBasicMaterial({
        color: '#fbbf24',
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    pool.rotation.x = -Math.PI * 0.5;
    pool.position.set(dir * 0.54, 0.04, 0);
    post.add(pool);

    post.scale.setScalar(1.18);
    post.position.set(x, gy, z);
    g.add(post);

    this.fireFlames.push(flame);
    this.swayingLanterns.push({
      pivot: lanternPivot,
      phase: seedIdx * 1.35 + x * 0.4,
      amp: 0.095,
      speed: 1.55 + (seedIdx % 3) * 0.22,
      axis: 'xz',
    });
    this.registerDynamicObstacle(x, z, 13);

    // Real flickering warm PointLight on key streetlamps (capped at 6 for crisp 60fps performance)
    if (this.brazierLights.length < 6) {
      const pl = new THREE.PointLight('#fbbf24', 2.8, 9.0, 1.7);
      pl.position.set(x + dir * 0.56, gy + 2.15, z);
      g.add(pl);
      this.brazierLights.push(pl);
    }
  }

  private buildBraziers(g: THREE.Group, brazierTiles: Array<[number, number]>, theme?: ZoneDef['theme']): void {
    const isOutdoorTown = theme === 'town' || theme === 'village' || theme === 'plains';
    const stoneMat = new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.85 });
    const ironMat = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.84, roughness: 0.32 });
    const brassMat = new THREE.MeshStandardMaterial({ color: '#d97706', metalness: 0.88, roughness: 0.24 });
    const flameMat = new THREE.MeshBasicMaterial({ color: '#facc15' });
    const emberMat = new THREE.MeshBasicMaterial({ color: '#f97316' });

    brazierTiles.forEach(([c, r], idx) => {
      if (isOutdoorTown) {
        // Outdoor towns/villages get tall ornate wrought-iron hanging-lantern streetlamps!
        this.buildOrnateStreetLamp(g, c + 0.5, r + 0.5, idx % 2 === 0 ? 1 : -1, idx + 20);
        return;
      }

      const gy = this.sampleGroundY(c + 0.5, r + 0.5);
      const b = new THREE.Group();
      // Sculpted octagonal stone plinth + 4 curved iron tripod legs + brass-rimmed fire bowl!
      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.16, 8), stoneMat);
      plinth.position.y = 0.08;
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.17, 0.62, 8), ironMat);
      core.position.y = 0.44;
      core.castShadow = !this.isSoftwareGl;
      for (let lg = 0; lg < 4; lg++) {
        const a = (lg * Math.PI) / 2;
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.66, 0.08), ironMat);
        leg.position.set(Math.cos(a) * 0.16, 0.42, Math.sin(a) * 0.16);
        leg.rotation.y = -a + Math.PI * 0.5;
        leg.rotation.x = 0.24;
        b.add(leg);
      }
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.15, 0.22, 8), ironMat);
      bowl.position.y = 0.82;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.028, 6, 12), brassMat);
      rim.rotation.x = Math.PI * 0.5;
      rim.position.y = 0.92;
      const flame = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), idx % 2 === 0 ? flameMat : emberMat);
      flame.position.y = 1.06;
      b.add(plinth, core, bowl, rim, flame);
      b.position.set(c + 0.5, gy, r + 0.5);
      g.add(b);
      this.fireFlames.push(flame);
      this.registerDynamicObstacle(c + 0.5, r + 0.5, 14);

      if (this.brazierLights.length < 5) {
        const pl = new THREE.PointLight('#fb923c', 3.2, 8.5, 1.8);
        pl.position.set(c + 0.5, gy + 1.45, r + 0.5);
        g.add(pl);
        this.brazierLights.push(pl);
      }
    });
  }

  // ============================================================================
  // SEAMLESS EDGE-OF-MAP HORIZON CONTINUITY (SHOW WHAT IS ON THE OTHER SIDE!)
  // ============================================================================
  private buildSeamlessNeighborHorizon(g: THREE.Group, zone: ZoneDef): void {
    const W = zone.width;
    const H = zone.height;
    const horizon = new THREE.Group();
    const isIce = zone.theme === 'ice';
    const grassMat = new THREE.MeshStandardMaterial({ color: isIce ? '#cfe8f8' : '#2ba63f', roughness: isIce ? 0.55 : 0.92 });
    const hillMat = new THREE.MeshStandardMaterial({ color: isIce ? '#b4d8f0' : '#1f8c33', roughness: isIce ? 0.62 : 0.94 });
    const roadMat = new THREE.MeshStandardMaterial({ map: this.textures.road, roughness: 0.88 });
    const riverMat = new THREE.MeshStandardMaterial({ color: '#1e90d6', roughness: 0.22, metalness: 0.2 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#5c3b20', roughness: 0.9 });
    const canopyMat = new THREE.MeshStandardMaterial({ color: isIce ? '#93c5fd' : '#1c9c38', roughness: 0.84 });
    const marbleMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.55 });
    const obsidianMat = new THREE.MeshStandardMaterial({ color: '#1e1b2e', roughness: 0.45, metalness: 0.3 });
    const crimsonGlow = new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#dc2626', emissiveIntensity: 1.3 });

    const addDistantTree = (tx: number, tz: number, sc = 1.0) => {
      const t = new THREE.Group();
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * sc, 0.28 * sc, 1.5 * sc, 6), trunkMat);
      tr.position.y = 0.75 * sc;
      const cn = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15 * sc, 1), canopyMat);
      cn.position.y = 2.0 * sc;
      cn.scale.set(1.2, 0.85, 1.2);
      t.add(tr, cn);
      t.position.set(tx, this.sampleGroundY(THREE.MathUtils.clamp(tx, 1, W - 2), THREE.MathUtils.clamp(tz, 1, H - 2)) - 0.1, tz);
      horizon.add(t);
    };

    // Extended 300-unit outer terrain aprons so NO hard map cutoff or void ever appears from any camera angle!
    const apronW = 300;
    const isCoastalTown = zone.id === 'minea';
    // For coastal Minea, clip West & East green land aprons strictly north of the headland coastline (z = -300..70)
    // so looking off the piers sees pure endless ocean water to the South, SW, and SE!
    const sideMinZ = -apronW;
    const sideMaxZ = isCoastalTown ? 70 : H + apronW;
    const sideLenZ = sideMaxZ - sideMinZ;
    const sideCenterZ = (sideMinZ + sideMaxZ) * 0.5;

    const westApron = new THREE.Mesh(new THREE.PlaneGeometry(apronW, sideLenZ), grassMat);
    westApron.rotation.x = -Math.PI * 0.5;
    westApron.position.set(-apronW * 0.5, -0.06, sideCenterZ);
    const eastApron = new THREE.Mesh(new THREE.PlaneGeometry(apronW, sideLenZ), grassMat);
    eastApron.rotation.x = -Math.PI * 0.5;
    eastApron.position.set(W + apronW * 0.5, -0.06, sideCenterZ);
    horizon.add(westApron, eastApron);

    // Rolling woodland hills & distant trees flanking West & East borders (kept strictly inland north of Minea's harbor!)
    const hillMaxZ = isCoastalTown ? 62 : H + 18;
    for (let r = -18; r <= hillMaxZ; r += 9) {
      for (const sideX of [-5, -14, -28, W + 5, W + 14, W + 28]) {
        const mound = new THREE.Mesh(new THREE.SphereGeometry(6.2, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), hillMat);
        mound.scale.set(1.35, 0.38, 1.45);
        mound.position.set(sideX, -0.2, r);
        horizon.add(mound);
        if (Math.abs(sideX) < W + 20 && sideX > -20) {
          addDistantTree(sideX + (r % 2 === 0 ? 1.5 : -1.5), r + 1.5, 1.25);
        }
      }
    }

    if (zone.id === 'minea') {
      // NORTH OF MINEA: Vast seamless continuation into Esteria Plains (300 units deep, Esteria River, Roda Tree & distant Darm Tower!)
      const northMeadow = new THREE.Mesh(new THREE.PlaneGeometry(W + apronW * 2, apronW), grassMat);
      northMeadow.rotation.x = -Math.PI * 0.5;
      northMeadow.position.set(W * 0.5, -0.04, -apronW * 0.5);
      const contRoad = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 120), roadMat);
      contRoad.rotation.x = -Math.PI * 0.5;
      contRoad.position.set(52, 0.02, -60);
      const distantRiver = new THREE.Mesh(new THREE.PlaneGeometry(W + apronW * 1.4, 4.5), riverMat);
      distantRiver.rotation.x = -Math.PI * 0.5;
      distantRiver.position.set(W * 0.5, 0.01, -14);
      const distantBridge = new THREE.Mesh(
        new THREE.BoxGeometry(6.2, 0.24, 5.2),
        new THREE.MeshStandardMaterial({ map: this.textures.wood, roughness: 0.82 })
      );
      distantBridge.position.set(52, 0.14, -14);
      horizon.add(northMeadow, contRoad, distantRiver, distantBridge);

      // Rolling Esteria Plains hills, trees, golden Ancient Roda Tree & distant Darm Tower spire on NE horizon!
      for (let x = -28; x < W + 28; x += 11) {
        if (Math.abs(x - 52) < 6) continue;
        addDistantTree(x, -6 - (Math.abs(x) % 7), 1.3);
        addDistantTree(x + 4, -22 - (Math.abs(x) % 6), 1.45);
      }
      // Distant Ancient Roda Tree golden silhouette
      const rodaTrk = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.4, 5.2, 8), trunkMat);
      rodaTrk.position.set(52, 2.5, -26);
      const rodaCrown = new THREE.Mesh(new THREE.IcosahedronGeometry(3.8, 1), new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.7 }));
      rodaCrown.position.set(52, 6.2, -26);
      horizon.add(rodaTrk, rodaCrown);
      // Distant Darm Tower spire rising in the far northeast
      const spire = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.6, 24, 10), obsidianMat);
      spire.position.set(W - 14, 11.5, -34);
      const spireRing = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.35, 8, 16), crimsonGlow);
      spireRing.rotation.x = Math.PI * 0.5;
      spireRing.position.set(W - 14, 16.5, -34);
      horizon.add(spire, spireRing);
      // Note: Minea's southern & flanking endless ocean is rendered seamlessly by the GPU Gerstner wave Outer Ocean Skirt!
    } else if (zone.id === 'plains') {
      // SOUTH OF ESTERIA PLAINS: Continuing Royal Road into Minea Town's rooftops & distant endless Harbor Sea!
      const southMeadow = new THREE.Mesh(new THREE.PlaneGeometry(W + apronW * 2, 42), grassMat);
      southMeadow.rotation.x = -Math.PI * 0.5;
      southMeadow.position.set(W * 0.5, -0.04, H + 21);
      const southRoad = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 32), roadMat);
      southRoad.rotation.x = -Math.PI * 0.5;
      southRoad.position.set(58, 0.02, H + 16);
      const distantSea = new THREE.Mesh(new THREE.PlaneGeometry(W + apronW * 2, apronW), riverMat);
      distantSea.rotation.x = -Math.PI * 0.5;
      distantSea.position.set(W * 0.5, -0.1, H + 42 + apronW * 0.5);
      horizon.add(southMeadow, southRoad, distantSea);

      const roofColors = ['#b91c1c', '#1d4ed8', '#15803d', '#c2410c'];
      for (let hi = 0; hi < 8; hi++) {
        const hx = 22 + hi * 10 + (hi >= 4 ? 10 : 0);
        const hz = H + 9 + (hi % 2) * 6;
        const hBox = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.2, 3.6), marbleMat);
        hBox.position.set(hx, 1.1, hz);
        const hRoof = new THREE.Mesh(
          new THREE.ConeGeometry(3.8, 1.9, 4),
          new THREE.MeshStandardMaterial({ color: roofColors[hi % roofColors.length], roughness: 0.7 })
        );
        hRoof.rotation.y = Math.PI * 0.25;
        hRoof.position.set(hx, 3.1, hz);
        horizon.add(hBox, hRoof);
      }

      // NORTH OF ESTERIA PLAINS: Vast 300-unit frontier, Shrine of Solomon columns (NW) & Darm Tower spire (NE)!
      const northMeadow = new THREE.Mesh(new THREE.PlaneGeometry(W + apronW * 2, apronW), grassMat);
      northMeadow.rotation.x = -Math.PI * 0.5;
      northMeadow.position.set(W * 0.5, -0.04, -apronW * 0.5);
      horizon.add(northMeadow);
      for (let c = 0; c < 5; c++) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 5.4, 8), marbleMat);
        col.position.set(16 + c * 3.4, 2.7, -14);
        horizon.add(col);
      }
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(16, 0.9, 1.8), marbleMat);
      lintel.position.set(22.8, 5.6, -14);
      horizon.add(lintel);
      const darmSpire = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 4.4, 24, 10), obsidianMat);
      darmSpire.position.set(93, 12, -18);
      const darmRing = new THREE.Mesh(new THREE.TorusGeometry(3.5, 0.4, 8, 16), crimsonGlow);
      darmRing.rotation.x = Math.PI * 0.5;
      darmRing.position.set(93, 17, -18);
      horizon.add(darmSpire, darmRing);
    } else if (zone.id === 'lance' || zone.theme === 'village' || zone.theme === 'ruins' || zone.theme === 'ice') {
      // Extended 300-unit North & South horizon plains / glacial snowfields
      const northLand = new THREE.Mesh(new THREE.PlaneGeometry(W + apronW * 2, apronW), grassMat);
      northLand.rotation.x = -Math.PI * 0.5;
      northLand.position.set(W * 0.5, -0.04, -apronW * 0.5);
      horizon.add(northLand);
      if (!isIce) {
        const roadN = new THREE.Mesh(new THREE.PlaneGeometry(6, 90), roadMat);
        roadN.rotation.x = -Math.PI * 0.5;
        roadN.position.set(W * 0.5, 0.02, -45);
        horizon.add(roadN);
        for (let c = 0; c < 4; c++) {
          const col = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 5.0, 8), marbleMat);
          col.position.set(W * 0.5 - 6 + c * 4, 2.5, -16);
          horizon.add(col);
        }
      }
      const southLand = new THREE.Mesh(new THREE.PlaneGeometry(W + apronW * 2, apronW), grassMat);
      southLand.rotation.x = -Math.PI * 0.5;
      southLand.position.set(W * 0.5, -0.04, H + apronW * 0.5);
      horizon.add(southLand);
    }

    g.add(horizon);
  }

  // ============================================================================
  // LIVING COMMUNITY COURTYARDS (GAME & DINING TABLES), GRAZING PASTURES
  // (HORSES, SHEEP, COWS, CHICKENS), HEARTH BAKERY & CRAFTWORKS MINI-FACTORY!
  // ============================================================================
  private buildLivingCommunityAndEconomy(g: THREE.Group, zone: ZoneDef): void {
    const woodMat = new THREE.MeshStandardMaterial({ map: this.archTextures.plankWood, roughness: 0.82 });
    const darkWoodMat = new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.86 });
    const stoneMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.85 });
    const brickMat = new THREE.MeshStandardMaterial({ color: '#b45309', roughness: 0.84 });
    const ironMat = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.78, roughness: 0.36 });
    const brassMat = new THREE.MeshStandardMaterial({ color: '#f59e0b', metalness: 0.84, roughness: 0.25 });
    const breadMat = new THREE.MeshStandardMaterial({ color: '#d97706', roughness: 0.7 });
    const clothMat = new THREE.MeshStandardMaterial({ color: '#fef3c7', roughness: 0.8 });
    const skinMat = new THREE.MeshStandardMaterial({ color: '#ffd9b3', roughness: 0.68 });

    // Helper: Build a Community Game or Dining Table with Benches, Chess/Food Props & Animated Seated Villagers!
    const addCommunityTable = (tx: number, tz: number, mode: 'game' | 'eat', seed: number) => {
      const gy = this.sampleGroundY(tx, tz);
      const grp = new THREE.Group();

      // Timber picnic table + 2 benches
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.1, 1.05), woodMat);
      top.position.y = 0.66;
      top.castShadow = !this.isSoftwareGl;
      top.receiveShadow = true;
      grp.add(top);
      for (const lx of [-0.65, 0.65]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.64, 0.86), darkWoodMat);
        leg.position.set(lx, 0.32, 0);
        grp.add(leg);
      }
      for (const bz of [-0.82, 0.82]) {
        const bench = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.08, 0.34), woodMat);
        bench.position.set(0, 0.36, bz);
        bench.castShadow = !this.isSoftwareGl;
        grp.add(bench);
        for (const blx of [-0.58, 0.58]) {
          const bLeg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.36, 0.26), darkWoodMat);
          bLeg.position.set(blx, 0.18, bz);
          grp.add(bLeg);
        }
      }

      if (mode === 'game') {
        // Checkered Board Game + Carved Pieces + Dice + Cider Mugs!
        const board = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.04, 0.68), darkWoodMat);
        board.position.set(0, 0.73, 0);
        const grid = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.045, 0.58), clothMat);
        grid.position.set(0, 0.735, 0);
        grp.add(board, grid);
        const pieceCols = ['#1e293b', '#f8fafc'];
        for (let p = 0; p < 8; p++) {
          const pc = new THREE.Mesh(
            new THREE.CylinderGeometry(0.028, 0.04, 0.12, 6),
            new THREE.MeshStandardMaterial({ color: pieceCols[p % 2], roughness: 0.4 })
          );
          pc.position.set(-0.2 + (p % 4) * 0.13, 0.81, p < 4 ? -0.14 : 0.14);
          grp.add(pc);
        }
        // Brass cider tankards beside the board
        for (const mx of [-0.58, 0.58]) {
          const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.15, 7), brassMat);
          mug.position.set(mx, 0.78, mx > 0 ? 0.22 : -0.22);
          grp.add(mug);
        }
      } else {
        // Community Feast Table: Plates, Golden Bread Loaves, Steaming Soup Bowls & Cider Tankards!
        const platter = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.04, 10), clothMat);
        platter.position.set(0, 0.73, 0);
        const loaf = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), breadMat);
        loaf.scale.set(1.3, 0.62, 0.85);
        loaf.position.set(0, 0.81, 0);
        grp.add(platter, loaf);
        for (const [px, pz] of [[-0.5, -0.25], [0.48, -0.25], [-0.48, 0.25], [0.5, 0.25]]) {
          const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.03, 8), stoneMat);
          plate.position.set(px, 0.73, pz);
          const stew = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), new THREE.MeshStandardMaterial({ color: '#ea580c', roughness: 0.5 }));
          stew.scale.set(1, 0.45, 1);
          stew.position.set(px, 0.76, pz);
          const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.13, 6), brassMat);
          cup.position.set(px + 0.16, 0.77, pz);
          grp.add(plate, stew, cup);
        }
      }

      // 2-3 Seated Animated 3D Villagers Playing Games or Eating!
      const tunicPalette = ['#2563eb', '#dc2626', '#15803d', '#9333ea', '#d97706'];
      const hairPalette = ['#451a03', '#f59e0b', '#1e293b', '#92400e', '#cbd5e1'];
      const seats: Array<[number, number, number]> = [
        [-0.36, -0.82, 0],
        [0.36, 0.82, Math.PI],
        [0.38, -0.82, 0],
      ];
      seats.forEach(([sx, sz, rotY], si) => {
        if (mode === 'game' && si === 2) return;
        const person = new THREE.Group();
        person.position.set(sx, 0.38, sz);
        person.scale.setScalar(1.32);
        person.rotation.y = rotY;
        const tunicMat = new THREE.MeshStandardMaterial({ color: tunicPalette[(seed + si) % tunicPalette.length], roughness: 0.75 });
        const hairMat = new THREE.MeshStandardMaterial({ color: hairPalette[(seed + si * 2) % hairPalette.length], roughness: 0.8 });

        const seatLegs = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.34), darkWoodMat);
        seatLegs.position.set(0, 0.04, 0.12);
        const torso = new THREE.Group();
        torso.position.set(0, 0.14, 0);
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.42, 8), tunicMat);
        body.position.y = 0.21;
        body.castShadow = !this.isSoftwareGl;
        const head = new THREE.Group();
        head.position.set(0, 0.5, 0);
        const skull = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), skinMat);
        const hair = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.62), hairMat);
        hair.position.y = 0.02;
        head.add(skull, hair);

        const armL = new THREE.Group();
        armL.position.set(-0.16, 0.36, 0.04);
        const armLMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.036, 0.28, 6), tunicMat);
        armLMesh.position.set(0, -0.1, 0.12);
        armLMesh.rotation.x = Math.PI * 0.35;
        armL.add(armLMesh);

        const armR = new THREE.Group();
        armR.position.set(0.16, 0.36, 0.04);
        const armRMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.036, 0.28, 6), tunicMat);
        armRMesh.position.set(0, -0.1, 0.12);
        armRMesh.rotation.x = Math.PI * 0.35;
        armR.add(armRMesh);

        torso.add(body, head, armL, armR);
        person.add(seatLegs, torso);
        grp.add(person);
        this.seatedPeople.push({ head, armR, armL, torso, mode, phase: seed * 1.7 + si * 2.1 });
      });

      grp.position.set(tx, gy, tz);
      g.add(grp);
      this.registerDynamicObstacle(tx, tz, 34);
    };

    // Helper: Build a Fenced Grazing Pasture with Animated 3D Horses, Sheep, Dairy Cows & Pecking Chickens!
    const addGrazingPasture = (cx: number, cz: number, pw: number, pd: number, seed: number) => {
      const gy = this.sampleGroundY(cx, cz);
      const pGrp = new THREE.Group();

      // Split-rail wooden pasture fence with an open welcoming north/south viewing edge
      const halfW = pw * 0.5;
      const halfD = pd * 0.5;
      const addFenceSegment = (x1: number, z1: number, x2: number, z2: number) => {
        const len = Math.hypot(x2 - x1, z2 - z1);
        const mx = (x1 + x2) * 0.5;
        const mz = (z1 + z2) * 0.5;
        const ang = Math.atan2(x2 - x1, z2 - z1);
        const seg = new THREE.Group();
        for (const ry of [0.28, 0.56]) {
          const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, len), woodMat);
          rail.position.y = ry;
          seg.add(rail);
        }
        const postCount = Math.max(2, Math.round(len / 1.4) + 1);
        for (let pi = 0; pi < postCount; pi++) {
          const t = pi / (postCount - 1) - 0.5;
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.74, 0.11), darkWoodMat);
          post.position.set(0, 0.37, t * len);
          post.castShadow = !this.isSoftwareGl;
          seg.add(post);
        }
        seg.position.set(mx, 0, mz);
        seg.rotation.y = ang;
        pGrp.add(seg);
      };
      addFenceSegment(-halfW, -halfD, halfW, -halfD);
      addFenceSegment(-halfW, halfD, halfW, halfD);
      addFenceSegment(-halfW, -halfD, -halfW, halfD);
      addFenceSegment(halfW, -halfD, halfW, halfD);

      // Wooden hay trough + fresh water tub inside pasture
      const hayMat = new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.92 });
      const trough = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.34, 0.48), darkWoodMat);
      trough.position.set(-halfW + 1.0, 0.17, -halfD + 0.75);
      const hay = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.18, 0.38), hayMat);
      hay.position.set(-halfW + 1.0, 0.36, -halfD + 0.75);
      const tub = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.3, 0.3, 10), woodMat);
      tub.position.set(halfW - 0.9, 0.15, -halfD + 0.8);
      const tubWater = new THREE.Mesh(
        new THREE.CircleGeometry(0.32, 10),
        new THREE.MeshStandardMaterial({ color: '#38bdf8', roughness: 0.15 })
      );
      tubWater.rotation.x = -Math.PI * 0.5;
      tubWater.position.set(halfW - 0.9, 0.31, -halfD + 0.8);
      pGrp.add(trough, hay, tub, tubWater);

      pGrp.position.set(cx, gy, cz);
      g.add(pGrp);
      this.registerDynamicObstacle(cx, cz, Math.max(pw, pd) * 15);

      // Composite 3D Animated Animals inside Pasture!
      const spawnAnimal = (kind: 'horse' | 'sheep' | 'cow' | 'chicken', ox: number, oz: number, coatHex: string, idx: number) => {
        const root = new THREE.Group();
        const coatMat = new THREE.MeshStandardMaterial({ color: coatHex, roughness: kind === 'sheep' ? 0.96 : 0.78 });
        const maneMat = new THREE.MeshStandardMaterial({ color: '#29170b', roughness: 0.85 });
        const legs: THREE.Object3D[] = [];
        const headPivot = new THREE.Group();
        let tailPivot: THREE.Group | undefined;

        if (kind === 'horse') {
          const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.62, 6, 10), coatMat);
          torso.rotation.x = Math.PI * 0.5;
          torso.position.y = 0.76;
          torso.castShadow = !this.isSoftwareGl;
          root.add(torso);
          for (const [lx, lz] of [[-0.14, 0.28], [0.14, 0.28], [-0.14, -0.28], [0.14, -0.28]]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.036, 0.66, 6), coatMat);
            leg.position.set(lx, 0.33, lz);
            leg.castShadow = !this.isSoftwareGl;
            root.add(leg);
            legs.push(leg);
          }
          headPivot.position.set(0, 0.86, 0.36);
          const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.48, 7), coatMat);
          neck.position.set(0, 0.2, 0.12);
          neck.rotation.x = 0.48;
          const snout = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.36), coatMat);
          snout.position.set(0, 0.4, 0.32);
          snout.rotation.x = 0.35;
          const mane = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.44, 0.1), maneMat);
          mane.position.set(0, 0.25, 0.02);
          mane.rotation.x = 0.48;
          const earL = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.11, 4), coatMat);
          earL.position.set(-0.06, 0.52, 0.22);
          const earR = earL.clone();
          earR.position.x = 0.06;
          headPivot.add(neck, snout, mane, earL, earR);

          tailPivot = new THREE.Group();
          tailPivot.position.set(0, 0.8, -0.44);
          const tail = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.46, 6), maneMat);
          tail.position.set(0, -0.2, -0.06);
          tail.rotation.x = -0.28;
          tailPivot.add(tail);
          root.add(headPivot, tailPivot);
        } else if (kind === 'cow') {
          const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.42, 0.88), coatMat);
          torso.position.y = 0.62;
          torso.castShadow = !this.isSoftwareGl;
          const spot = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.22, 0.34), maneMat);
          spot.position.set(0, 0.66, 0.05);
          root.add(torso, spot);
          for (const [lx, lz] of [[-0.15, 0.28], [0.15, 0.28], [-0.15, -0.28], [0.15, -0.28]]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.46, 6), coatMat);
            leg.position.set(lx, 0.23, lz);
            root.add(leg);
            legs.push(leg);
          }
          headPivot.position.set(0, 0.66, 0.44);
          const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.28), coatMat);
          head.position.set(0, 0.02, 0.14);
          const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.12, 4), clothMat);
          hornL.position.set(-0.12, 0.14, 0.1);
          hornL.rotation.z = 0.45;
          const hornR = hornL.clone();
          hornR.position.x = 0.12;
          hornR.rotation.z = -0.45;
          headPivot.add(head, hornL, hornR);
          root.add(headPivot);
        } else if (kind === 'sheep') {
          const wool = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), coatMat);
          wool.scale.set(0.92, 0.86, 1.32);
          wool.position.y = 0.44;
          wool.castShadow = !this.isSoftwareGl;
          root.add(wool);
          for (const [lx, lz] of [[-0.1, 0.18], [0.1, 0.18], [-0.1, -0.18], [0.1, -0.18]]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.028, 0.3, 5), maneMat);
            leg.position.set(lx, 0.15, lz);
            root.add(leg);
            legs.push(leg);
          }
          headPivot.position.set(0, 0.46, 0.32);
          const face = new THREE.Mesh(new THREE.SphereGeometry(0.12, 7, 6), maneMat);
          face.scale.set(0.85, 0.85, 1.25);
          face.position.set(0, 0, 0.08);
          headPivot.add(face);
          root.add(headPivot);
        } else {
          // Pecking Farm Chicken!
          const body = new THREE.Mesh(new THREE.SphereGeometry(0.13, 7, 6), coatMat);
          body.scale.set(0.85, 0.9, 1.25);
          body.position.y = 0.2;
          headPivot.position.set(0, 0.26, 0.12);
          const head = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), coatMat);
          head.position.set(0, 0.05, 0.03);
          const beak = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.07, 4), brassMat);
          beak.rotation.x = Math.PI * 0.5;
          beak.position.set(0, 0.04, 0.1);
          const comb = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.05, 0.07), new THREE.MeshStandardMaterial({ color: '#dc2626' }));
          comb.position.set(0, 0.11, 0.02);
          headPivot.add(head, beak, comb);
          root.add(body, headPivot);
        }

        const ax = cx + ox;
        const az = cz + oz;
        root.position.set(ax, this.sampleGroundY(ax, az), az);
        g.add(root);
        this.grazingAnimals.push({
          kind,
          root,
          headPivot,
          tailPivot,
          legs,
          homeX: cx,
          homeZ: cz,
          roamRx: Math.max(0.7, halfW - 0.85),
          roamRz: Math.max(0.7, halfD - 0.85),
          phase: seed * 1.9 + idx * 1.45,
          speed: kind === 'horse' ? 0.65 : kind === 'chicken' ? 0.85 : 0.42,
          curX: ax,
          curZ: az,
          targetX: ax,
          targetZ: az,
          timer: 1.5 + idx * 0.8,
          grazeMode: idx % 2 === 0,
        });
      };

      spawnAnimal('horse', -halfW * 0.35, 0.2, '#92400e', 0);
      spawnAnimal('horse', halfW * 0.32, 0.4, '#e7dcc8', 1);
      spawnAnimal('cow', 0.0, -0.35, '#f8fafc', 2);
      spawnAnimal('sheep', -halfW * 0.2, 0.75, '#f1f5f9', 3);
      spawnAnimal('chicken', halfW * 0.22, 0.78, '#fef3c7', 4);
    };

    if (zone.id === 'minea') {
      // 1. COMMUNITY GAME & DINING COURTYARDS flanking Minea's Grand Fountain Plaza & Tavern Patio!
      addCommunityTable(44.5, 44.2, 'game', 1);
      addCommunityTable(59.5, 44.2, 'eat', 2);
      addCommunityTable(39.2, 52.2, 'eat', 3);

      // 2. FENCED GRAZING PASTURES WITH HORSES, COWS, SHEEP & CHICKENS!
      addGrazingPasture(24.5, 22.8, 5.2, 3.8, 10);
      addGrazingPasture(74.8, 22.8, 5.2, 3.8, 20);

      // 3. FUNCTIONAL MINEA HEARTH BAKERY (Domed Brick Bread Oven + Rotating Flour Quern + Warm Loaf Display Counter!)
      const bx = 36.2;
      const bz = 46.2;
      const bgy = this.sampleGroundY(bx, bz);
      const bakery = new THREE.Group();
      // Stone hearth base + domed brick bread oven + glowing ember firebox mouth + chimney!
      const hearth = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.92, 1.5), stoneMat);
      hearth.position.set(-0.6, 0.46, 0);
      hearth.castShadow = !this.isSoftwareGl;
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.76, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), brickMat);
      dome.position.set(-0.6, 0.88, 0);
      dome.castShadow = !this.isSoftwareGl;
      const fireMouth = new THREE.Mesh(
        new THREE.BoxGeometry(0.56, 0.42, 0.14),
        new THREE.MeshBasicMaterial({ color: '#fb923c' })
      );
      fireMouth.position.set(-0.6, 1.12, 0.68);
      const ovenChim = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 1.45, 8), brickMat);
      ovenChim.position.set(-0.6, 1.98, -0.2);
      bakery.add(hearth, dome, fireMouth, ovenChim);

      // Rising warm bakery smoke puffs
      for (let s = 0; s < 3; s++) {
        const puff = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.2, 1),
          new THREE.MeshStandardMaterial({ color: '#fef9c3', transparent: true, opacity: 0.45, depthWrite: false })
        );
        puff.position.set(bx - 0.6, bgy + 2.8, bz - 0.2);
        g.add(puff);
        this.chimneySmokes.push({ mesh: puff, ox: bx - 0.6, oy: bgy + 2.8, oz: bz - 0.2, phase: s * 0.33, speed: 0.32 });
      }

      // Rotating stone flour-grinding millstone + flour sacks
      const quernBase = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.42, 10), stoneMat);
      quernBase.position.set(0.95, 0.21, -0.35);
      const quernWheel = new THREE.Group();
      quernWheel.position.set(0.95, 0.48, -0.35);
      const qStone = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.14, 10), stoneMat);
      const qHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.34, 6), woodMat);
      qHandle.position.set(0.26, 0.18, 0);
      quernWheel.add(qStone, qHandle);
      this.spinners.push({ obj: quernWheel, axis: 'y', speed: 1.45 });
      bakery.add(quernBase, quernWheel);

      // Bakery display table loaded with golden loaves, pies & red striped canopy
      const bCounter = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.64, 0.72), woodMat);
      bCounter.position.set(1.05, 0.32, 0.62);
      bCounter.castShadow = !this.isSoftwareGl;
      for (let li = 0; li < 4; li++) {
        const loaf = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), breadMat);
        loaf.scale.set(1.3, 0.62, 0.85);
        loaf.position.set(0.45 + li * 0.38, 0.71, 0.62);
        bakery.add(loaf);
      }
      const flourSack = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), clothMat);
      flourSack.scale.set(0.9, 1.25, 0.85);
      flourSack.position.set(-1.55, 0.28, 0.45);
      bakery.add(bCounter, flourSack);
      bakery.position.set(bx, bgy, bz);
      g.add(bakery);
      this.registerDynamicObstacle(bx, bz, 36);

      // 4. FUNCTIONAL ESTERIA LOOM & TIMBER CRAFTWORKS MINI-FACTORY (Spinning Gearwheel, Pounding Trip-Hammer & Moving Product Crates!)
      const fx = 76.2;
      const fz = 47.4;
      const fgy = this.sampleGroundY(fx, fz);
      const factory = new THREE.Group();

      // Open-air timber factory pavilion frame & workbench
      for (const [px, pz] of [[-1.5, -1.0], [1.5, -1.0], [-1.5, 1.0], [1.5, 1.0]]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.2, 0.16), darkWoodMat);
        post.position.set(px, 1.1, pz);
        post.castShadow = !this.isSoftwareGl;
        factory.add(post);
      }
      const roofBeam = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.16, 2.4), woodMat);
      roofBeam.position.set(0, 2.24, 0);
      roofBeam.castShadow = !this.isSoftwareGl;
      factory.add(roofBeam);

      // Large Spinning Brass-Tooth Drive Gearwheel!
      const gearHub = new THREE.Group();
      gearHub.position.set(-1.45, 1.12, 0);
      const gearRim = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.08, 7, 16), ironMat);
      gearRim.rotation.y = Math.PI * 0.5;
      gearHub.add(gearRim);
      for (let t = 0; t < 8; t++) {
        const ta = (t / 8) * Math.PI * 2;
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.32, 0.08), darkWoodMat);
        spoke.rotation.x = ta;
        const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.14), brassMat);
        tooth.position.set(0, Math.cos(ta) * 0.78, Math.sin(ta) * 0.78);
        tooth.rotation.x = ta;
        gearHub.add(spoke, tooth);
      }
      this.spinners.push({ obj: gearHub, axis: 'x', speed: 1.55 });
      factory.add(gearHub);

      // Animated Reciprocating Wooden Trip-Hammer stamping iron/timber blanks!
      const hammerPivot = new THREE.Group();
      hammerPivot.position.set(-0.85, 0.95, -0.35);
      const hArm = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.12, 0.12), darkWoodMat);
      hArm.position.set(0.55, 0, 0);
      const hHead = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.42, 0.28), ironMat);
      hHead.position.set(1.08, -0.14, 0);
      hammerPivot.add(hArm, hHead);
      const anvilBlk = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.55, 0.52), stoneMat);
      anvilBlk.position.set(0.24, 0.28, -0.35);
      factory.add(hammerPivot, anvilBlk);
      this.factoryMachines.push({ kind: 'hammer', obj: hammerPivot, ox: -0.85, oy: 0.95, oz: -0.35, span: 0.42, phase: 0, speed: 3.6 });

      // Moving Roller Table Carrying Manufactured Crates & Woven Cloth Bolts!
      const belt = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.48, 0.62), darkWoodMat);
      belt.position.set(0.2, 0.24, 0.48);
      factory.add(belt);
      const prodCols = ['#d97706', '#2563eb', '#dc2626'];
      for (let pi = 0; pi < 3; pi++) {
        const item = new THREE.Mesh(
          pi % 2 === 0 ? new THREE.BoxGeometry(0.36, 0.34, 0.36) : new THREE.CylinderGeometry(0.14, 0.14, 0.42, 8),
          new THREE.MeshStandardMaterial({ color: prodCols[pi], roughness: 0.65 })
        );
        if (pi % 2 !== 0) item.rotation.x = Math.PI * 0.5;
        item.position.set(-0.9, 0.66, 0.48);
        factory.add(item);
        this.factoryMachines.push({ kind: 'belt_item', obj: item, ox: -0.95, oy: 0.66, oz: 0.48, span: 2.05, phase: pi / 3, speed: 0.28 });
      }

      factory.position.set(fx, fgy, fz);
      g.add(factory);
      this.registerDynamicObstacle(fx, fz, 40);
    } else if (zone.id === 'plains') {
      // Esteria Plains Open Grazing Horse & Sheep Pastures near Zepik Outpost!
      addGrazingPasture(38, 56, 6.4, 4.4, 30);
      addGrazingPasture(76, 56, 6.4, 4.4, 40);
    } else if (zone.id === 'lance' || zone.theme === 'village') {
      // Lance Village Community Dining Table & Grazing Pasture!
      addCommunityTable(zone.width * 0.5 - 6, zone.height * 0.5 + 5, 'game', 50);
      addCommunityTable(zone.width * 0.5 + 6, zone.height * 0.5 + 5, 'eat', 51);
      addGrazingPasture(zone.width * 0.24, zone.height * 0.32, 5.2, 3.8, 55);
    }
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

      const xrayGlint = this.createOccludedDiscoveryGlint(0.82, 0.92, '#fde047');
      xrayGlint.visible = false;
      grp.add(xrayGlint);

      const gy = this.sampleGroundY(sh.tx + 0.5, sh.ty + 0.5);
      grp.position.set(sh.tx + 0.5, gy, sh.ty + 0.5);
      g.add(grp);
      this.shrubRigs.push({ id: sh.id, group: grp, sparkle, xrayGlint, tx: sh.tx, ty: sh.ty });
    }
  }

  private createOccludedDiscoveryGlint(y: number, scale = 1, color = '#fde047'): THREE.Mesh {
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.78,
      depthTest: true,
      depthFunc: THREE.GreaterDepth,
      depthWrite: false,
    });
    const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.17 * scale, 0), mat);
    diamond.position.y = y;
    diamond.renderOrder = 98;

    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.22 * scale, 0.33 * scale, 18),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthTest: true,
        depthFunc: THREE.GreaterDepth,
        depthWrite: false,
      })
    );
    halo.rotation.x = -Math.PI * 0.5;
    halo.position.y = -0.35 * scale;
    halo.renderOrder = 98;
    diamond.add(halo);
    return diamond;
  }

  private buildInspectables(g: THREE.Group, zone: ZoneDef): void {
    const stoneMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.55 });
    const darkStoneMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.72 });
    const woodMat = new THREE.MeshStandardMaterial({ map: this.textures.wood, roughness: 0.8 });
    const darkWoodMat = new THREE.MeshStandardMaterial({ map: this.archTextures.plankWood, color: '#5c3418', roughness: 0.82 });
    const ironMat = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.84, roughness: 0.3 });
    const brassMat = new THREE.MeshStandardMaterial({ color: '#eab308', metalness: 0.88, roughness: 0.22 });

    for (const obj of zone.inspectables) {
      const grp = new THREE.Group();
      let glintH = 1.45;
      const objGy = this.sampleGroundY(obj.tx + 0.5, obj.ty + 0.5);

      if (obj.kind === 'fountain') {
        glintH = 3.42;
        const carvedStoneMat = new THREE.MeshStandardMaterial({
          map: this.textures.plaster,
          color: '#d6dde6',
          roughness: 0.56,
        });
        const copingStoneMat = new THREE.MeshStandardMaterial({
          color: '#e2e8f0',
          roughness: 0.48,
        });
        const poolMat = new THREE.MeshPhysicalMaterial({
          color: '#0284c7',
          emissive: '#075985',
          emissiveIntensity: 0.28,
          roughness: 0.06,
          clearcoat: 1,
        });

        // Monumental ~2.2x Grand Plaza Fountain with Stepped Octagonal Curb & Perch Rim
        const apron = new THREE.Mesh(new THREE.CylinderGeometry(2.38, 2.52, 0.14, 8), darkStoneMat);
        apron.position.y = 0.07;
        apron.receiveShadow = true;

        const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.2, 0.52, 16), carvedStoneMat);
        basin.position.y = 0.36;
        basin.castShadow = !this.isSoftwareGl;
        basin.receiveShadow = true;

        // Molded circular stone coping rim where living birds perch & drink!
        const copingRim = new THREE.Mesh(new THREE.TorusGeometry(1.98, 0.14, 10, 28), copingStoneMat);
        copingRim.rotation.x = Math.PI * 0.5;
        copingRim.position.y = 0.62;
        copingRim.castShadow = !this.isSoftwareGl;
        copingRim.receiveShadow = true;
        grp.add(apron, basin, copingRim);

        // 8 Carved Corner Buttress Posts along the outer octagonal rim
        for (let b = 0; b < 8; b++) {
          const ba = (b / 8) * Math.PI * 2 + Math.PI * 0.125;
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.58, 0.24), copingStoneMat);
          post.position.set(Math.cos(ba) * 2.08, 0.36, Math.sin(ba) * 2.08);
          post.rotation.y = -ba;
          post.castShadow = !this.isSoftwareGl;
          grp.add(post);
        }

        // Shimmering Clearcoat Lower Azure Pool
        const pool = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.08, 28), poolMat);
        pool.position.y = 0.54;
        grp.add(pool);

        // 3 Animated Expanding Concentric Water Ripple Rings
        const ripples: THREE.Mesh[] = [];
        for (let ri = 0; ri < 3; ri++) {
          const rip = new THREE.Mesh(
            new THREE.RingGeometry(0.26, 0.35, 28),
            new THREE.MeshBasicMaterial({
              color: '#e0f2fe',
              transparent: true,
              opacity: 0.68,
              side: THREE.DoubleSide,
              depthWrite: false,
            })
          );
          rip.rotation.x = -Math.PI * 0.5;
          rip.position.y = 0.595;
          grp.add(rip);
          ripples.push(rip);
        }

        // Tall Fluted Stone Column + Sculpted Middle Scalloped Basin + Upper Chalice Finial
        const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.72, 0.38, 12), carvedStoneMat);
        pedestal.position.y = 0.72;
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 1.56, 12), carvedStoneMat);
        pillar.position.y = 1.42;
        pillar.castShadow = !this.isSoftwareGl;

        const midBowl = new THREE.Mesh(new THREE.CylinderGeometry(1.06, 0.42, 0.28, 16), copingStoneMat);
        midBowl.position.y = 1.46;
        midBowl.castShadow = !this.isSoftwareGl;
        const midRim = new THREE.Mesh(new THREE.TorusGeometry(1.04, 0.075, 8, 24), copingStoneMat);
        midRim.rotation.x = Math.PI * 0.5;
        midRim.position.y = 1.59;
        const midPool = new THREE.Mesh(new THREE.CylinderGeometry(0.96, 0.96, 0.06, 20), poolMat);
        midPool.position.y = 1.56;

        const upperBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.2, 0.24, 14), copingStoneMat);
        upperBowl.position.y = 2.18;
        const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 0.32, 10), brassMat);
        spout.position.y = 2.38;

        // Pulsing Crystal Central Geyser Plume & Frothy Foam Crown
        const centerJet = new THREE.Mesh(
          new THREE.ConeGeometry(0.24, 0.9, 12),
          new THREE.MeshBasicMaterial({ color: '#bae6fd', transparent: true, opacity: 0.84, depthWrite: false })
        );
        centerJet.position.y = 2.74;
        const topFoam = new THREE.Mesh(
          new THREE.SphereGeometry(0.22, 10, 8),
          new THREE.MeshBasicMaterial({ color: '#f0f9ff', transparent: true, opacity: 0.92, depthWrite: false })
        );
        topFoam.position.y = 3.08;
        this.fountainJets.push(centerJet);
        grp.add(pedestal, pillar, midBowl, midRim, midPool, upperBowl, spout, centerJet, topFoam);

        // 8 Parabolic Curved 3D Arcing Water Streams (4 Upper→Mid + 4 Mid→Lower Pool!)
        const streams: THREE.Mesh[] = [];
        for (let si = 0; si < 8; si++) {
          const isUpper = si < 4;
          const a = ((si % 4) / 4) * Math.PI * 2 + (isUpper ? 0 : Math.PI * 0.25);
          const r0 = isUpper ? 0.34 : 0.96;
          const rMid = isUpper ? 0.62 : 1.38;
          const r1 = isUpper ? 0.8 : 1.62;
          const y0 = isUpper ? 2.26 : 1.58;
          const yPeak = isUpper ? 2.48 : 1.74;
          const y1 = isUpper ? 1.58 : 0.58;
          const curve = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(Math.cos(a) * r0, y0, Math.sin(a) * r0),
            new THREE.Vector3(Math.cos(a) * rMid, yPeak, Math.sin(a) * rMid),
            new THREE.Vector3(Math.cos(a) * r1, y1, Math.sin(a) * r1)
          );
          const streamMesh = new THREE.Mesh(
            new THREE.TubeGeometry(curve, 12, isUpper ? 0.032 : 0.044, 6, false),
            new THREE.MeshBasicMaterial({
              color: '#bae6fd',
              transparent: true,
              opacity: 0.72,
              depthWrite: false,
            })
          );
          grp.add(streamMesh);
          streams.push(streamMesh);
        }

        // 24 Animated Sparkling Leaping 3D Water Droplets & Mist Beads!
        const droplets: FountainAnimRig['droplets'] = [];
        const dropGeo = new THREE.SphereGeometry(0.055, 6, 5);
        const dropMat = new THREE.MeshBasicMaterial({ color: '#e0f2fe', transparent: true, opacity: 0.9 });
        const dropCount = this.isSoftwareGl ? 14 : 24;
        for (let di = 0; di < dropCount; di++) {
          const tier = di % 3; // 0: top geyser spray, 1: upper->mid arc, 2: mid->lower arc
          const dm = new THREE.Mesh(dropGeo, dropMat);
          grp.add(dm);
          const angle = (di / dropCount) * Math.PI * 2 + hash2d(di, 1, 881) * 0.5;
          droplets.push({
            mesh: dm,
            angle,
            speed: 1.05 + hash2d(di, 2, 881) * 0.65,
            phase: hash2d(di, 3, 881),
            startR: tier === 0 ? 0.08 : tier === 1 ? 0.34 : 0.94,
            endR: tier === 0 ? 0.44 : tier === 1 ? 0.84 : 1.66,
            baseY: tier === 0 ? 2.48 : tier === 1 ? 2.24 : 1.58,
            peakY: tier === 0 ? 3.28 : tier === 1 ? 2.58 : 1.82,
            endY: tier === 0 ? 2.18 : tier === 1 ? 1.56 : 0.58,
          });
        }

        // Floating Emerald Lily Pads, Pink Water Lilies & 3 Animated Koi Fish Swimming in the Basin!
        const lilyPadMat = new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.55 });
        const lotusMat = new THREE.MeshStandardMaterial({ color: '#f9a8d4', roughness: 0.4 });
        for (let li = 0; li < 4; li++) {
          const la = (li / 4) * Math.PI * 2 + 0.45;
          const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.025, 10), lilyPadMat);
          pad.position.set(Math.cos(la) * 1.42, 0.585, Math.sin(la) * 1.42);
          grp.add(pad);
          if (li % 2 === 0) {
            const lotus = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), lotusMat);
            lotus.position.set(Math.cos(la) * 1.42, 0.64, Math.sin(la) * 1.42);
            grp.add(lotus);
          }
        }
        const koiColors = ['#f97316', '#fde047', '#ef4444'];
        for (let ki = 0; ki < 3; ki++) {
          const koiGrp = new THREE.Group();
          const kMat = new THREE.MeshStandardMaterial({ color: koiColors[ki], roughness: 0.32 });
          const kBody = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), kMat);
          kBody.scale.set(0.65, 0.55, 1.85);
          const kTail = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.14, 4), kMat);
          kTail.rotation.x = Math.PI * 0.5;
          kTail.position.set(0, 0, -0.17);
          koiGrp.add(kBody, kTail);
          g.add(koiGrp);
          this.fountainKoi.push({
            grp: koiGrp,
            tail: kTail,
            cx: obj.tx + 0.5,
            cz: obj.ty + 0.5,
            y: objGy + 0.57,
            r: 0.88 + ki * 0.34,
            speed: (ki % 2 === 0 ? 0.62 : -0.52) + ki * 0.08,
            phase: ki * 2.1,
          });
        }

        this.fountainAnims.push({ centerJet, topFoam, ripples, streams, droplets });
        this.fountainAnchors.push({
          x: obj.tx + 0.5,
          y: objGy,
          z: obj.ty + 0.5,
          rimR: 1.98,
          rimY: objGy + 0.74,
        });
      } else if (obj.kind === 'statue' || obj.kind === 'pedestal') {
        glintH = 1.9;
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
        glintH = 2.05;
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
      } else if (obj.kind === 'anvil') {
        // Forged Blacksmith Horn Anvil on Oak Stump + Hammer + Glowing Ember Bucket!
        glintH = 1.35;
        const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.46, 10), darkWoodMat);
        stump.position.y = 0.23;
        stump.castShadow = !this.isSoftwareGl;
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.26, 0.28), ironMat);
        body.position.y = 0.59;
        body.castShadow = !this.isSoftwareGl;
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.36, 8), ironMat);
        horn.rotation.z = -Math.PI * 0.5;
        horn.position.set(0.46, 0.62, 0);
        const hammerHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.42, 6), woodMat);
        hammerHandle.rotation.z = 0.6;
        hammerHandle.position.set(-0.1, 0.78, 0.08);
        const hammerHead = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.11, 0.11), ironMat);
        hammerHead.position.set(0.04, 0.88, 0.08);
        const emberBucket = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.24, 8), ironMat);
        emberBucket.position.set(-0.42, 0.12, 0.24);
        const coals = new THREE.Mesh(
          new THREE.SphereGeometry(0.12, 8, 6),
          new THREE.MeshStandardMaterial({ color: '#f97316', emissive: '#ea580c', emissiveIntensity: 1.8 })
        );
        coals.position.set(-0.42, 0.24, 0.24);
        grp.add(stump, body, horn, hammerHandle, hammerHead, emberBucket, coals);
      } else if (obj.kind === 'telescope') {
        // Brass Harbor Spyglass + Azure Lens + Wooden Tripod!
        glintH = 1.58;
        for (let i = 0; i < 3; i++) {
          const a = (i * Math.PI * 2) / 3;
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.026, 0.96, 6), darkWoodMat);
          leg.position.set(Math.cos(a) * 0.18, 0.44, Math.sin(a) * 0.18);
          leg.rotation.z = Math.cos(a) * 0.28;
          leg.rotation.x = -Math.sin(a) * 0.28;
          grp.add(leg);
        }
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.055, 0.88, 12), brassMat);
        tube.rotation.z = Math.PI * 0.38;
        tube.position.set(0.06, 1.02, 0);
        tube.castShadow = !this.isSoftwareGl;
        const lens = new THREE.Mesh(
          new THREE.CylinderGeometry(0.082, 0.082, 0.04, 12),
          new THREE.MeshStandardMaterial({ color: '#38bdf8', emissive: '#0284c7', emissiveIntensity: 0.7, roughness: 0.1 })
        );
        lens.rotation.z = Math.PI * 0.38;
        lens.position.set(0.45, 1.18, 0);
        grp.add(tube, lens);
      } else if (obj.kind === 'bookshelf') {
        // Tall Oak Bookcase Packed with Colorful Leather-Bound Volumes!
        glintH = 1.85;
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.48, 0.42), darkWoodMat);
        frame.position.y = 0.74;
        frame.castShadow = !this.isSoftwareGl;
        grp.add(frame);
        const bCols = ['#dc2626', '#2563eb', '#16a34a', '#ca8a04', '#7c3aed'];
        for (let row = 0; row < 3; row++) {
          for (let bi = 0; bi < 4; bi++) {
            const bk = new THREE.Mesh(
              new THREE.BoxGeometry(0.16, 0.28, 0.32),
              new THREE.MeshStandardMaterial({ color: bCols[(row * 3 + bi) % bCols.length], roughness: 0.65 })
            );
            bk.position.set(-0.28 + bi * 0.19, 0.3 + row * 0.42, 0.08);
            grp.add(bk);
          }
        }
      } else if (obj.kind === 'noticeboard') {
        // Roofed Town Noticeboard with Pinned Parchment Flyers & Wax Seals!
        glintH = 1.75;
        for (const sx of [-0.42, 0.42]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 1.32, 6), darkWoodMat);
          post.position.set(sx, 0.66, 0);
          post.castShadow = !this.isSoftwareGl;
          grp.add(post);
        }
        const board = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.66, 0.09), woodMat);
        board.position.y = 0.94;
        board.castShadow = !this.isSoftwareGl;
        const canopy = new THREE.Mesh(
          new THREE.BoxGeometry(1.12, 0.14, 0.34),
          new THREE.MeshStandardMaterial({ map: this.textures.roof_red, roughness: 0.75 })
        );
        canopy.position.set(0, 1.34, 0.04);
        canopy.rotation.x = 0.18;
        grp.add(board, canopy);
        for (const [fx, fy, fw, fh] of [[-0.24, 1.02, 0.24, 0.26], [0.06, 0.98, 0.22, 0.3], [0.3, 0.86, 0.18, 0.22]]) {
          const flyer = new THREE.Mesh(
            new THREE.BoxGeometry(fw, fh, 0.02),
            new THREE.MeshStandardMaterial({ color: '#fef3c7', roughness: 0.9 })
          );
          flyer.position.set(fx, fy, 0.055);
          grp.add(flyer);
        }
      } else if (obj.kind === 'bell') {
        // Timber Harbor Belfry Frame + Polished Bronze Bell + Clapper!
        glintH = 2.02;
        for (const sx of [-0.36, 0.36]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 1.55, 6), darkWoodMat);
          post.position.set(sx, 0.78, 0);
          post.castShadow = !this.isSoftwareGl;
          grp.add(post);
        }
        const beam = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.14, 0.18), darkWoodMat);
        beam.position.y = 1.56;
        const roof = new THREE.Mesh(
          new THREE.ConeGeometry(0.68, 0.36, 4),
          new THREE.MeshStandardMaterial({ map: this.textures.roof_blue, roughness: 0.7 })
        );
        roof.rotation.y = Math.PI * 0.25;
        roof.position.y = 1.82;
        const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.28, 0.44, 12), brassMat);
        bell.position.y = 1.18;
        bell.castShadow = !this.isSoftwareGl;
        const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), ironMat);
        clapper.position.y = 0.92;
        grp.add(beam, roof, bell, clapper);
      } else if (obj.kind === 'dock_cargo') {
        // Banded Harbor Cargo Barrels + Iron Anchor + Coiled Mooring Rope!
        glintH = 1.25;
        const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.58, 10), darkWoodMat);
        b1.position.set(-0.22, 0.29, -0.08);
        b1.castShadow = !this.isSoftwareGl;
        const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.02, 6, 12), ironMat);
        hoop.rotation.x = Math.PI * 0.5;
        hoop.position.set(-0.22, 0.42, -0.08);
        const crate = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.42, 0.46), woodMat);
        crate.position.set(0.24, 0.21, 0.14);
        crate.castShadow = !this.isSoftwareGl;
        const anchorStem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.72, 6), ironMat);
        anchorStem.rotation.z = -0.35;
        anchorStem.position.set(0.12, 0.42, -0.24);
        const anchorFluke = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.032, 6, 10, Math.PI), ironMat);
        anchorFluke.rotation.z = Math.PI - 0.35;
        anchorFluke.position.set(0.02, 0.18, -0.24);
        const rope = new THREE.Mesh(
          new THREE.TorusGeometry(0.16, 0.055, 6, 12),
          new THREE.MeshStandardMaterial({ color: '#d6b478', roughness: 0.92 })
        );
        rope.rotation.x = Math.PI * 0.5;
        rope.position.set(-0.22, 0.62, -0.08);
        grp.add(b1, hoop, crate, anchorStem, anchorFluke, rope);
      } else if (obj.kind === 'sign') {
        glintH = 1.48;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.85, 6), woodMat);
        post.position.y = 0.42;
        const board = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.42, 0.09), woodMat);
        board.position.y = 0.92;
        board.castShadow = !this.isSoftwareGl;
        grp.add(post, board);
      } else if (obj.kind === 'crates') {
        glintH = 1.15;
        const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.52, 0.52), woodMat);
        c1.position.set(-0.18, 0.26, -0.06);
        c1.castShadow = !this.isSoftwareGl;
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.56, 10), woodMat);
        barrel.position.set(0.24, 0.28, 0.14);
        barrel.castShadow = !this.isSoftwareGl;
        grp.add(c1, barrel);
      } else if (obj.kind === 'campfire') {
        glintH = 1.18;
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
        glintH = 1.65;
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

      // Subtle Floating Golden Discovery Diamond above Uninspected Objects!
      const glint = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.11, 0),
        new THREE.MeshBasicMaterial({ color: '#fde047', transparent: true, opacity: 0.9 })
      );
      glint.position.y = glintH;
      grp.add(glint);

      const xrayGlint = this.createOccludedDiscoveryGlint(Math.min(1.6, glintH), 0.95, '#fde047');
      xrayGlint.visible = false;
      grp.add(xrayGlint);
      this.inspectableRigs.push({ id: obj.id, glint, xrayGlint, baseY: glintH, tx: obj.tx, ty: obj.ty });

      grp.position.set(obj.tx + 0.5, objGy, obj.ty + 0.5);
      g.add(grp);
    }
  }

  // --------------------------------------------------------------------------
  // Living 3D Flock of Articulated Birds Drinking at the Fountain & Flying to Trees!
  // --------------------------------------------------------------------------
  private buildLivingBirds(g: THREE.Group, zone: ZoneDef): void {
    const hasFountain = this.fountainAnchors.length > 0;
    const hasTrees = this.treePerchSpots.length > 0;
    if (!hasFountain && this.treePerchSpots.length < 2) return;

    const species: Array<{ body: string; wing: string; head: string; beak: string }> = [
      { body: '#f8fafc', wing: '#e2e8f0', head: '#ffffff', beak: '#f59e0b' }, // Snow Dove
      { body: '#0284c7', wing: '#38bdf8', head: '#0369a1', beak: '#fde047' }, // Esterian Bluebird
      { body: '#eab308', wing: '#fef08a', head: '#ca8a04', beak: '#f97316' }, // Golden Finch
      { body: '#475569', wing: '#334155', head: '#ea580c', beak: '#fbbf24' }, // Meadow Robin
    ];

    const bodyGeo = new THREE.SphereGeometry(0.125, 8, 6);
    const headGeo = new THREE.SphereGeometry(0.08, 8, 6);
    const beakGeo = new THREE.ConeGeometry(0.032, 0.12, 5);
    beakGeo.rotateX(Math.PI * 0.5);
    const tailGeo = new THREE.ConeGeometry(0.072, 0.2, 5);
    tailGeo.rotateX(-Math.PI * 0.58);
    const wingGeo = new THREE.BoxGeometry(0.24, 0.024, 0.12);
    wingGeo.translate(0.12, 0, 0);
    const eyeGeo = new THREE.SphereGeometry(0.014, 5, 4);
    const eyeMat = new THREE.MeshBasicMaterial({ color: '#0f172a' });

    const birdCount = this.isSoftwareGl ? 10 : 16;
    for (let i = 0; i < birdCount; i++) {
      const sp = species[i % species.length];
      const bodyMat = new THREE.MeshStandardMaterial({ color: sp.body, roughness: 0.58 });
      const wingMat = new THREE.MeshStandardMaterial({ color: sp.wing, roughness: 0.52 });
      const headMat = new THREE.MeshStandardMaterial({ color: sp.head, roughness: 0.54 });
      const beakMat = new THREE.MeshStandardMaterial({ color: sp.beak, roughness: 0.42 });

      const birdGrp = new THREE.Group();
      const bodyPivot = new THREE.Group();
      birdGrp.add(bodyPivot);

      const torso = new THREE.Mesh(bodyGeo, bodyMat);
      torso.scale.set(0.84, 0.78, 1.32);
      torso.castShadow = !this.isSoftwareGl;
      bodyPivot.add(torso);

      const tail = new THREE.Mesh(tailGeo, wingMat);
      tail.position.set(0, 0.02, -0.17);
      bodyPivot.add(tail);

      const headPivot = new THREE.Group();
      headPivot.position.set(0, 0.08, 0.13);
      const head = new THREE.Mesh(headGeo, headMat);
      const beak = new THREE.Mesh(beakGeo, beakMat);
      beak.position.set(0, -0.01, 0.11);
      const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
      eyeL.position.set(0.055, 0.02, 0.04);
      const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
      eyeR.position.set(-0.055, 0.02, 0.04);
      headPivot.add(head, beak, eyeL, eyeR);
      bodyPivot.add(headPivot);

      const wingL = new THREE.Group();
      wingL.position.set(0.06, 0.03, 0.01);
      const wingLMesh = new THREE.Mesh(wingGeo, wingMat);
      wingL.add(wingLMesh);
      bodyPivot.add(wingL);

      const wingR = new THREE.Group();
      wingR.position.set(-0.06, 0.03, 0.01);
      const wingRMesh = new THREE.Mesh(wingGeo, wingMat);
      wingRMesh.scale.x = -1;
      wingR.add(wingRMesh);
      bodyPivot.add(wingR);

      const sc = 0.88 + hash2d(i, 7, zone.width) * 0.34;
      birdGrp.scale.setScalar(sc);

      const fountainIdx = hasFountain ? i % this.fountainAnchors.length : -1;
      const rimAngle = (i / birdCount) * Math.PI * 2 + hash2d(i, 3, 919) * 0.6;
      const treeIdx = hasTrees ? Math.floor(hash2d(i, 5, 919) * this.treePerchSpots.length) : -1;

      const startAtFountain = hasFountain && (i % 2 === 0 || !hasTrees);
      const startPos = new THREE.Vector3();
      const endPos = new THREE.Vector3();
      let initialState: BirdRig['state'] = 'perch_tree';

      if (startAtFountain && fountainIdx >= 0) {
        const f = this.fountainAnchors[fountainIdx];
        startPos.set(f.x + Math.cos(rimAngle) * f.rimR, f.rimY, f.z + Math.sin(rimAngle) * f.rimR);
        endPos.copy(startPos);
        initialState = 'perch_fountain';
        birdGrp.position.copy(startPos);
        birdGrp.rotation.y = Math.atan2(f.x - startPos.x, f.z - startPos.z);
      } else if (treeIdx >= 0) {
        const tp = this.treePerchSpots[treeIdx];
        startPos.set(tp.x, tp.y, tp.z);
        endPos.copy(startPos);
        initialState = 'perch_tree';
        birdGrp.position.copy(startPos);
        birdGrp.rotation.y = hash2d(i, 9, 919) * Math.PI * 2;
      }

      g.add(birdGrp);
      this.birdRigs.push({
        group: birdGrp,
        bodyPivot,
        headPivot,
        wingL,
        wingR,
        state: initialState,
        timer: hash2d(i, 11, 919) * 3.5,
        duration: 2.8 + hash2d(i, 13, 919) * 4.2,
        startPos,
        endPos,
        arcHeight: 2.6 + hash2d(i, 17, 919) * 2.2,
        fountainIdx,
        rimAngle,
        treeIdx,
        phase: hash2d(i, 19, 919) * Math.PI * 2,
        drinkSpeed: 2.4 + hash2d(i, 23, 919) * 1.4,
      });
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

      const xrayGlint = this.createOccludedDiscoveryGlint(0.76, 1.08, '#fde047');
      xrayGlint.visible = false;
      grp.add(xrayGlint);

      grp.position.set(ch.tx + 0.5, this.sampleGroundY(ch.tx + 0.5, ch.ty + 0.5), ch.ty + 0.5);
      g.add(grp);
      this.chestRigs.push({ id: ch.id, lidPivot, glowLight, xrayGlint, tx: ch.tx, ty: ch.ty });
    }
  }

  private buildPortals(g: THREE.Group, zone: ZoneDef): void {
    const pillarMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.3, roughness: 0.45 });
    const sconceMat = new THREE.MeshStandardMaterial({ color: '#451a03', metalness: 0.65, roughness: 0.38 });
    for (const p of zone.portals) {
      const cx = p.tx + p.widthTiles * 0.5;
      const cz = p.ty + p.heightTiles * 0.5;
      const gy = this.sampleGroundY(cx, cz);

      if (p.isDoorway) {
        // Warm Golden Welcome Threshold Mat + Subtle Doorway Lantern Orbs (no giant stone pillars!)
        const matMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(Math.max(1.15, p.widthTiles * 0.88), 0.78),
          new THREE.MeshBasicMaterial({
            color: '#fde047',
            transparent: true,
            opacity: 0.52,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        );
        matMesh.rotation.x = -Math.PI * 0.5;
        matMesh.position.set(cx, gy + 0.06, cz);
        g.add(matMesh);

        const pillarGlows: THREE.Mesh[] = [];
        for (const side of [-1, 1]) {
          const px = cx + side * (p.widthTiles * 0.44 + 0.12);
          const pgy = this.sampleGroundY(px, cz);
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 0.62, 6), sconceMat);
          post.position.set(px, pgy + 0.31, cz);
          const orb = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.11, 0),
            new THREE.MeshBasicMaterial({ color: '#fde047' })
          );
          orb.position.set(px, pgy + 0.72, cz);
          g.add(post, orb);
          pillarGlows.push(orb);
        }
        this.portalRigs.push({ ring: matMesh, pillarGlows, requiredFlag: p.requiredFlag, isDoorway: true });
      } else {
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
        this.portalRigs.push({ ring, pillarGlows, requiredFlag: p.requiredFlag, isDoorway: false });
      }
    }
  }

  private clearZoneScene(): void {
    if (this.zoneGroup) {
      this.zoneGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
          if (obj.geometry && !obj.geometry.userData?.shared) obj.geometry.dispose();
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
    this.swayingLanterns = [];
    this.treeMovingParts = [];
    this.grazingAnimals = [];
    this.seatedPeople = [];
    this.factoryMachines = [];
    this.dynamicObstacles = [];
    this.butterflyRigs = [];
    this.fountainKoi = [];
    this.cauldronBubbles = [];
    this.forageRigs.clear();
    this.brazierLights.length = 0;
    this.npcRigs.clear();
    this.chestRigs = [];
    this.shrubRigs = [];
    this.inspectableRigs = [];
    this.portalRigs = [];
    this.fountainJets = [];
    this.fountainAnims = [];
    this.fountainAnchors = [];
    this.treePerchSpots = [];
    this.birdRigs = [];
    this.statueRings = [];
    this.fireFlames = [];
    this.floatingBoats = [];
    this.wildlifeRigs = [];
    for (const tex of this.zoneOwnedTextures) tex.dispose();
    this.zoneOwnedTextures = [];
    for (const rig of this.enemyRigs.values()) {
      for (const m of rig.parts.ownedMaterials) m.dispose();
      this.scene.remove(rig.root);
    }
    this.enemyRigs.clear();
  }

  // --------------------------------------------------------------------------
  // 3D COMPOSITE CRAFTING STATIONS (GRAND FORGE, ALCHEMY CAULDRON, HEARTH KETTLE)
  // & 10 INTERACTIVE SCAVENGEABLE FORAGE NODES (HERBS, FOOD, ORE, TIMBER, RELICS)!
  // --------------------------------------------------------------------------
  private buildCraftStationsAndForageNodes(g: THREE.Group, zone: ZoneDef): void {
    const stoneMat = new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.86 });
    const brickMat = new THREE.MeshStandardMaterial({ color: '#9a3412', roughness: 0.84 });
    const woodMat = new THREE.MeshStandardMaterial({ map: this.archTextures.plankWood, roughness: 0.82 });
    const darkWoodMat = new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.86 });
    const ironMat = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.86, roughness: 0.28 });
    const copperMat = new THREE.MeshStandardMaterial({ color: '#c2410c', metalness: 0.82, roughness: 0.3 });
    const brassMat = new THREE.MeshStandardMaterial({ color: '#eab308', metalness: 0.88, roughness: 0.22 });
    const emberMat = new THREE.MeshBasicMaterial({ color: '#fb923c' });
    const flameMat = new THREE.MeshBasicMaterial({ color: '#fef08a' });

    const stations: WorldCraftStation[] = zone.craftStations ?? [];
    stations.forEach((st, idx) => {
      const sx = st.tx + 0.5;
      const sz = st.ty + 0.5;
      const gy = this.sampleGroundY(sx, sz);
      const grp = new THREE.Group();

      if (st.stationKind === 'forge') {
        // GRAND BLACKSMITH FORGE: Stone Furnace + Brick Chimney + Glowing Coal Bed + Animated Bellows + Horn Anvil + Quench Barrel!
        const hearth = new THREE.Mesh(new THREE.BoxGeometry(1.75, 1.05, 1.25), stoneMat);
        hearth.position.set(-0.25, 0.52, -0.2);
        hearth.castShadow = !this.isSoftwareGl;
        hearth.receiveShadow = true;
        const hood = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.35, 4), brickMat);
        hood.rotation.y = Math.PI * 0.25;
        hood.position.set(-0.25, 1.92, -0.35);
        hood.castShadow = !this.isSoftwareGl;
        const stack = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.65, 0.62), brickMat);
        stack.position.set(-0.25, 3.05, -0.45);
        const coals = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.16, 0.72), emberMat);
        coals.position.set(-0.25, 1.08, -0.05);
        const flame = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), flameMat);
        flame.position.set(-0.25, 1.35, -0.05);
        this.fireFlames.push(flame);

        // Animated Pumping Leather Bellows beside the Furnace!
        const bellows = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.72, 6), darkWoodMat);
        bellows.rotation.z = Math.PI * 0.45;
        bellows.position.set(-1.32, 1.02, -0.05);
        this.factoryMachines.push({
          kind: 'bellows',
          obj: bellows,
          ox: -1.32,
          oy: 1.02,
          oz: -0.05,
          span: 0.18,
          phase: idx * 1.4,
          speed: 3.1,
        });

        // Horn Anvil on Oak Block + Glowing Red-Hot Ingot!
        const block = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.58, 10), darkWoodMat);
        block.position.set(0.98, 0.29, 0.35);
        const anvil = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.26, 0.34), ironMat);
        anvil.position.set(0.98, 0.7, 0.35);
        anvil.castShadow = !this.isSoftwareGl;
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.38, 7), ironMat);
        horn.rotation.z = -Math.PI * 0.5;
        horn.position.set(1.48, 0.72, 0.35);
        const ingot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.12), emberMat);
        ingot.position.set(0.96, 0.87, 0.35);

        // Steaming Water Quench Barrel
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.62, 10), woodMat);
        barrel.position.set(-1.02, 0.31, 0.68);
        const qWater = new THREE.Mesh(
          new THREE.CircleGeometry(0.28, 10),
          new THREE.MeshBasicMaterial({ color: '#38bdf8' })
        );
        qWater.rotation.x = -Math.PI * 0.5;
        qWater.position.set(-1.02, 0.63, 0.68);

        grp.add(hearth, hood, stack, coals, flame, bellows, block, anvil, horn, ingot, barrel, qWater);

        if (this.brazierLights.length < 7) {
          const fl = new THREE.PointLight('#fb923c', 3.4, 10.5, 1.6);
          fl.position.set(sx - 0.2, gy + 1.85, sz + 0.2);
          g.add(fl);
          this.brazierLights.push(fl);
        }
        this.registerDynamicObstacle(sx, sz, 36);
      } else if (st.stationKind === 'alchemy') {
        // HERBALIST ALCHEMY CAULDRON: Stone Fire Ring + Copper Cauldron + Bubbling Emerald Elixir + Potion Rack!
        for (let r = 0; r < 8; r++) {
          const ra = (r / 8) * Math.PI * 2;
          const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), stoneMat);
          rk.position.set(Math.cos(ra) * 0.62, 0.12, Math.sin(ra) * 0.62);
          grp.add(rk);
        }
        const underFire = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), emberMat);
        underFire.position.y = 0.2;
        this.fireFlames.push(underFire);

        const cauldron = new THREE.Mesh(new THREE.SphereGeometry(0.56, 12, 10), copperMat);
        cauldron.position.y = 0.66;
        cauldron.scale.set(1, 0.82, 1);
        cauldron.castShadow = !this.isSoftwareGl;
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.06, 8, 18), brassMat);
        rim.rotation.x = Math.PI * 0.5;
        rim.position.y = 1.02;
        const brewMat = new THREE.MeshBasicMaterial({ color: '#34d399' });
        const brew = new THREE.Mesh(new THREE.CircleGeometry(0.44, 14), brewMat);
        brew.rotation.x = -Math.PI * 0.5;
        brew.position.y = 1.0;

        // Animated Rising Emerald Alchemy Bubbles!
        for (let bi = 0; bi < 4; bi++) {
          const bub = new THREE.Mesh(
            new THREE.SphereGeometry(0.065, 6, 5),
            new THREE.MeshBasicMaterial({ color: '#a7f3d0', transparent: true, opacity: 0.85 })
          );
          const ox = (hash2d(bi, idx, 611) - 0.5) * 0.45;
          const oz = (hash2d(bi, idx, 612) - 0.5) * 0.45;
          bub.position.set(ox, 1.05, oz);
          grp.add(bub);
          this.cauldronBubbles.push({
            mesh: bub,
            baseY: 1.02,
            ox,
            oz,
            phase: bi * 1.5 + idx,
            speed: 1.2 + bi * 0.22,
          });
        }

        // Apothecary Side Table with Glowing Colored Potion Flasks!
        const tbl = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.68, 0.5), woodMat);
        tbl.position.set(1.05, 0.34, 0);
        const flaskCols = ['#38bdf8', '#f43f5e', '#fde047'];
        flaskCols.forEach((fc, fi) => {
          const fl = new THREE.Mesh(
            new THREE.SphereGeometry(0.11, 8, 6),
            new THREE.MeshStandardMaterial({ color: fc, emissive: fc, emissiveIntensity: 0.55, roughness: 0.15 })
          );
          fl.position.set(0.76 + fi * 0.28, 0.78, 0);
          grp.add(fl);
        });
        grp.add(underFire, cauldron, rim, brew, tbl);
        this.registerDynamicObstacle(sx, sz, 32);
      } else {
        // COMMUNITY HEARTH COOKING KETTLE: Campfire Stones + Tripod + Hanging Stew Kettle + Cutting Block!
        for (let r = 0; r < 8; r++) {
          const ra = (r / 8) * Math.PI * 2;
          const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), stoneMat);
          rk.position.set(Math.cos(ra) * 0.58, 0.1, Math.sin(ra) * 0.58);
          grp.add(rk);
        }
        const fire = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.52, 7), flameMat);
        fire.position.y = 0.28;
        this.fireFlames.push(fire);

        // 3 Iron Tripod Legs meeting at the apex
        for (let t = 0; t < 3; t++) {
          const ta = (t / 3) * Math.PI * 2;
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.04, 1.9, 6), ironMat);
          leg.position.set(Math.cos(ta) * 0.42, 0.86, Math.sin(ta) * 0.42);
          leg.rotation.z = Math.cos(ta) * 0.42;
          leg.rotation.x = -Math.sin(ta) * 0.42;
          grp.add(leg);
        }
        const kettle = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), ironMat);
        kettle.position.y = 0.92;
        kettle.scale.set(1, 0.85, 1);
        const stew = new THREE.Mesh(
          new THREE.CircleGeometry(0.32, 12),
          new THREE.MeshStandardMaterial({ color: '#ea580c', roughness: 0.45 })
        );
        stew.rotation.x = -Math.PI * 0.5;
        stew.position.y = 1.18;

        // Rising Warm Aroma Steam Puffs
        for (let bi = 0; bi < 3; bi++) {
          const stm = new THREE.Mesh(
            new THREE.SphereGeometry(0.09, 6, 5),
            new THREE.MeshBasicMaterial({ color: '#fef9c3', transparent: true, opacity: 0.52 })
          );
          grp.add(stm);
          this.cauldronBubbles.push({
            mesh: stm,
            baseY: 1.24,
            ox: (bi - 1) * 0.12,
            oz: 0,
            phase: bi * 2.1 + idx,
            speed: 0.85 + bi * 0.15,
          });
        }
        grp.add(fire, kettle, stew);
        this.registerDynamicObstacle(sx, sz, 30);
      }

      grp.position.set(sx, gy, sz);
      g.add(grp);
    });

    // 10 DISTINCT COMPOSITE 3D FORAGEABLE WORLD NODES (Herbs, Berries, Mushrooms, Apples, Honey, Iron/Silver/Obsidian Ore, Oak Timber, Relics!)
    const nodes: WorldForageNode[] = zone.forageNodes ?? [];
    const leafMat = new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.72 });
    const rockDarkMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.88 });
    const silverMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.92, roughness: 0.18 });
    const obsidianMat = new THREE.MeshStandardMaterial({
      color: '#6b21a8',
      emissive: '#9333ea',
      emissiveIntensity: 0.65,
      roughness: 0.2,
    });

    nodes.forEach((node, idx) => {
      const nx = node.tx + 0.5;
      const nz = node.ty + 0.5;
      const gy = this.sampleGroundY(nx, nz);
      const grp = new THREE.Group();
      let glintColor = '#4ade80';

      if (node.nodeKind === 'herb_patch') {
        glintColor = node.itemId === 'moonblossom' ? '#c084fc' : node.itemId === 'celceta_mint' ? '#38bdf8' : '#4ade80';
        const bloomMat = new THREE.MeshStandardMaterial({ color: glintColor, emissive: glintColor, emissiveIntensity: 0.35, roughness: 0.4 });
        for (let k = 0; k < 5; k++) {
          const ka = (k / 5) * Math.PI * 2;
          const lf = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.44, 5), leafMat);
          lf.position.set(Math.cos(ka) * 0.18, 0.2, Math.sin(ka) * 0.18);
          lf.rotation.z = Math.cos(ka) * 0.35;
          lf.rotation.x = -Math.sin(ka) * 0.35;
          const fl = new THREE.Mesh(new THREE.OctahedronGeometry(0.095, 0), bloomMat);
          fl.position.set(Math.cos(ka) * 0.24, 0.44, Math.sin(ka) * 0.24);
          grp.add(lf, fl);
        }
      } else if (node.nodeKind === 'berry_bush') {
        glintColor = '#fb7185';
        const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.46, 1), leafMat);
        bush.position.y = 0.36;
        bush.scale.set(1.15, 0.85, 1.15);
        grp.add(bush);
        const berryMat = new THREE.MeshStandardMaterial({ color: '#e11d48', roughness: 0.25 });
        for (let b = 0; b < 7; b++) {
          const ba = (b / 7) * Math.PI * 2;
          const berry = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 5), berryMat);
          berry.position.set(Math.cos(ba) * 0.36, 0.38 + (b % 2) * 0.18, Math.sin(ba) * 0.36);
          grp.add(berry);
        }
      } else if (node.nodeKind === 'mushroom_ring') {
        glintColor = '#f59e0b';
        const stemMat = new THREE.MeshStandardMaterial({ color: '#fef3c7', roughness: 0.8 });
        const capMat = new THREE.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.55 });
        for (let m = 0; m < 5; m++) {
          const ma = (m / 5) * Math.PI * 2;
          const sc = 0.72 + (m % 3) * 0.2;
          const st = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * sc, 0.07 * sc, 0.24 * sc, 6), stemMat);
          st.position.set(Math.cos(ma) * 0.28, 0.12 * sc, Math.sin(ma) * 0.28);
          const cap = new THREE.Mesh(new THREE.ConeGeometry(0.18 * sc, 0.14 * sc, 8), capMat);
          cap.position.set(Math.cos(ma) * 0.28, 0.26 * sc, Math.sin(ma) * 0.28);
          grp.add(st, cap);
        }
      } else if (node.nodeKind === 'fruit_tree') {
        glintColor = '#ef4444';
        const trk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, 0.9, 6), darkWoodMat);
        trk.position.y = 0.45;
        const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.56, 1), leafMat);
        crown.position.y = 1.05;
        grp.add(trk, crown);
        const appleMat = new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.28 });
        for (let a = 0; a < 5; a++) {
          const aa = (a / 5) * Math.PI * 2;
          const ap = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), appleMat);
          ap.position.set(Math.cos(aa) * 0.44, 0.96 + (a % 2) * 0.24, Math.sin(aa) * 0.44);
          grp.add(ap);
        }
      } else if (node.nodeKind === 'beehive_log') {
        glintColor = '#fde047';
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.98, 8), darkWoodMat);
        log.rotation.z = Math.PI * 0.5;
        log.position.y = 0.22;
        const comb = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.16, 0.34, 6),
          new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.4 })
        );
        comb.position.set(0.18, 0.44, 0);
        grp.add(log, comb);
      } else if (node.nodeKind === 'iron_vein' || node.nodeKind === 'silver_vein' || node.nodeKind === 'obsidian_vein') {
        glintColor = node.nodeKind === 'silver_vein' ? '#e2e8f0' : node.nodeKind === 'obsidian_vein' ? '#c084fc' : '#fb923c';
        const oreMat = node.nodeKind === 'silver_vein' ? silverMat : node.nodeKind === 'obsidian_vein' ? obsidianMat : ironMat;
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.48, 0), rockDarkMat);
        rock.position.y = 0.32;
        rock.scale.set(1.2, 0.85, 1.05);
        grp.add(rock);
        for (let c = 0; c < 4; c++) {
          const ca = (c / 4) * Math.PI * 2 + idx;
          const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), oreMat);
          shard.position.set(Math.cos(ca) * 0.26, 0.45 + (c % 2) * 0.16, Math.sin(ca) * 0.26);
          shard.rotation.set(c * 0.4, ca, 0.3);
          grp.add(shard);
        }
      } else if (node.nodeKind === 'timber_pile') {
        glintColor = '#d97706';
        for (let l = 0; l < 4; l++) {
          const log = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.92, 7), woodMat);
          log.rotation.z = Math.PI * 0.5;
          log.position.set(0, l < 3 ? 0.14 : 0.34, l < 3 ? (l - 1) * 0.24 : 0);
          grp.add(log);
        }
      } else {
        // Ancient Relic Gear Scrap
        glintColor = '#fde047';
        const gear = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.08, 6, 12), brassMat);
        gear.rotation.x = 0.55;
        gear.position.y = 0.32;
        const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), silverMat);
        core.position.y = 0.34;
        grp.add(gear, core);
      }

      const glint = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.13, 0),
        new THREE.MeshBasicMaterial({ color: glintColor, transparent: true, opacity: 0.88 })
      );
      glint.position.y = 1.25;
      grp.add(glint);

      grp.position.set(nx, gy, nz);
      g.add(grp);
      this.forageRigs.set(node.id, { group: grp, glint, baseY: gy, gathered: node.gathered });
    });
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
    const isInterior = zone.theme === 'interior';
    const yaw = state.cameraYaw ?? Math.PI * 0.25;
    const zoomMode = state.cameraZoomMode ?? 'evo45';
    const dt = Math.min(0.05, Math.max(0.001, this.lastRenderTime > 0 ? time - this.lastRenderTime : 0.016));
    this.lastRenderTime = time;

    // Update GPU Shader Physics Uniforms!
    const adolGroundY = this.sampleGroundY(px3, pz3);
    this.sharedUniforms.uTime.value = time;
    this.sharedUniforms.uPlayerPos.value.set(px3, adolGroundY, pz3);

    // True 45° / 90°-Stepped 2.5D Isometric Camera + Cinematic Speaker Conversation Close-Up!
    const dlgFocus = state.dialogueFocus;
    const inDialogueZoom = Boolean(dlgFocus?.active);
    let targetX = camX3;
    let targetZ = camZ3;
    let dist = isInterior ? 17.5 : 26.5;
    let elev = isInterior ? 0.68 : 0.64; // ~37° classic isometric 2.5D tilt showing walls + roofs + terrain depth!
    let desiredLookYOffset = 0.35;

    if (inDialogueZoom && dlgFocus) {
      const focusX = dlgFocus.x / YS_WORLD_TILE;
      const focusZ = dlgFocus.y / YS_WORLD_TILE;
      targetX = THREE.MathUtils.lerp(px3, focusX, 0.56);
      targetZ = THREE.MathUtils.lerp(pz3, focusZ, 0.56);
      dist = isInterior ? 6.1 : 6.9;
      elev = 0.28; // Intimate lower eye-level 3D close-up framing both speakers!
      desiredLookYOffset = 1.24; // Keeps both 3D characters centered cleanly above the dialogue window!
    } else {
      if (zoomMode === 'close45') {
        dist = isInterior ? 11.2 : 14.2;
        elev = isInterior ? 0.58 : 0.54;
      } else if (zoomMode === 'wide45') {
        dist = isInterior ? 22.5 : 42.0;
        elev = 0.69;
      } else if (zoomMode === 'fullmap45') {
        const span = Math.max(zone.width, zone.height);
        dist = isInterior ? 28.0 : span * 1.18 + 10;
        elev = 0.74;
        targetX = THREE.MathUtils.lerp(zone.width * 0.5, px3, isInterior ? 0.15 : 0.22);
        targetZ = THREE.MathUtils.lerp(zone.height * 0.5, pz3, isInterior ? 0.15 : 0.22);
      }
      const zoomScale = THREE.MathUtils.clamp(state.cameraZoomScale ?? 1.0, 0.45, 1.85);
      dist *= zoomScale;
    }

    const rawTargetY = this.sampleGroundY(targetX, targetZ);
    if (!this.smoothCamInit) {
      this.smoothCamX = targetX;
      this.smoothCamY = rawTargetY;
      this.smoothCamZ = targetZ;
      this.smoothCamDist = dist;
      this.smoothCamElev = elev;
      this.smoothCamLookYOffset = desiredLookYOffset;
      this.smoothCamInit = true;
    } else {
      const camFollowRate = inDialogueZoom ? 7.2 : 9.5;
      this.smoothCamX = THREE.MathUtils.damp(this.smoothCamX, targetX, camFollowRate, dt);
      this.smoothCamY = THREE.MathUtils.damp(this.smoothCamY, rawTargetY, 8.5, dt);
      this.smoothCamZ = THREE.MathUtils.damp(this.smoothCamZ, targetZ, camFollowRate, dt);
      this.smoothCamDist = THREE.MathUtils.damp(this.smoothCamDist, dist, 6.8, dt);
      this.smoothCamElev = THREE.MathUtils.damp(this.smoothCamElev, elev, 6.8, dt);
      this.smoothCamLookYOffset = THREE.MathUtils.damp(this.smoothCamLookYOffset, desiredLookYOffset, 7.2, dt);
    }

    const shakeX = state.screenShake > 0 ? (Math.random() - 0.5) * 0.28 * state.screenShake : 0;
    const shakeY = state.screenShake > 0 ? (Math.random() - 0.5) * 0.18 * state.screenShake : 0;
    const horiz = this.smoothCamDist * Math.cos(this.smoothCamElev);
    this.camera.position.set(
      this.smoothCamX + Math.sin(yaw) * horiz + shakeX,
      this.smoothCamY + this.smoothCamDist * Math.sin(this.smoothCamElev) + shakeY,
      this.smoothCamZ + Math.cos(yaw) * horiz
    );
    this.camera.lookAt(this.smoothCamX, this.smoothCamY + this.smoothCamLookYOffset, this.smoothCamZ);

    // Dynamic Time-of-Day Circadian Sun Arc, Weather Sky Palette & Night Lantern Glow!
    const weather: YsWeatherKind = state.weather ?? 'clear';
    const windMult =
      weather === 'storm' ? 2.85 : weather === 'breezy' ? 2.15 : weather === 'rain' ? 1.65 : weather === 'snow' ? 1.3 : 1.0;
    const hours = ((state.timeOfDayHours ?? 10.5) % 24 + 24) % 24;
    const lightning = state.lightningFlash ?? 0;
    let nightFactor = 0;

    if (!isInterior && !isDungeon) {
      // Smooth 4-stage circadian interpolation: Night -> Dawn -> Day -> Sunset -> Night
      const isIce = zone.theme === 'ice';
      const daySky = isIce ? '#a4d6f7' : zone.theme === 'village' ? '#70c2f7' : '#6dbcf2';
      const dayFog = isIce ? '#b8e2fc' : zone.theme === 'village' ? '#89d1fb' : '#83cbf8';
      const dayGnd = isIce ? '#64748b' : '#26963a';

      let sunInt = 2.35;
      let hemiInt = 1.14;
      let fogDensity = 0.0026;

      if (hours >= 5.0 && hours < 7.5) {
        const t = smoothstep01((hours - 5.0) / 2.5);
        nightFactor = 1 - t;
        this.tmpSkyColor.set('#142042').lerp(new THREE.Color('#f09c7e'), Math.sin(t * Math.PI * 0.72)).lerp(new THREE.Color(daySky), t * t);
        this.tmpFogColor.set('#18264c').lerp(new THREE.Color('#f5b496'), Math.sin(t * Math.PI * 0.72)).lerp(new THREE.Color(dayFog), t * t);
        this.tmpSunColor.set('#9cbdff').lerp(new THREE.Color('#ffb570'), Math.sin(t * Math.PI * 0.7)).lerp(new THREE.Color('#fff7e2'), t * t);
        this.tmpHemiSky.set('#385287').lerp(new THREE.Color('#ffdcc4'), t);
        this.tmpHemiGnd.set('#162638').lerp(new THREE.Color(dayGnd), t);
        sunInt = THREE.MathUtils.lerp(0.85, 2.25, t);
        hemiInt = THREE.MathUtils.lerp(0.62, 1.12, t);
        fogDensity = THREE.MathUtils.lerp(0.0044, 0.0026, t);
      } else if (hours >= 7.5 && hours < 16.5) {
        nightFactor = 0;
        this.tmpSkyColor.set(daySky);
        this.tmpFogColor.set(dayFog);
        this.tmpSunColor.set(isIce ? '#ffffff' : '#fff8e6');
        this.tmpHemiSky.set(isIce ? '#e0f2fe' : '#d6efff');
        this.tmpHemiGnd.set(dayGnd);
        sunInt = isIce ? 2.28 : 2.38;
        hemiInt = 1.15;
        fogDensity = 0.0026;
      } else if (hours >= 16.5 && hours < 20.0) {
        const t = smoothstep01((hours - 16.5) / 3.5);
        nightFactor = t;
        const sunsetPeak = Math.sin(t * Math.PI);
        this.tmpSkyColor.set(daySky).lerp(new THREE.Color('#131d3b'), t).lerp(new THREE.Color('#eb8352'), sunsetPeak * 0.82);
        this.tmpFogColor.set(dayFog).lerp(new THREE.Color('#182346'), t).lerp(new THREE.Color('#f59e68'), sunsetPeak * 0.85);
        this.tmpSunColor.set('#fff7e2').lerp(new THREE.Color('#8cb4ff'), t).lerp(new THREE.Color('#ff8c42'), sunsetPeak * 0.9);
        this.tmpHemiSky.set('#d6efff').lerp(new THREE.Color('#344a7a'), t).lerp(new THREE.Color('#ffc08c'), sunsetPeak * 0.65);
        this.tmpHemiGnd.set(dayGnd).lerp(new THREE.Color('#172536'), t);
        sunInt = THREE.MathUtils.lerp(2.35, 0.85, t);
        hemiInt = THREE.MathUtils.lerp(1.14, 0.62, t);
        fogDensity = THREE.MathUtils.lerp(0.0026, 0.0046, t);
      } else {
        nightFactor = 1.0;
        this.tmpSkyColor.set('#101a36');
        this.tmpFogColor.set('#162344');
        this.tmpSunColor.set('#93b8ff');
        this.tmpHemiSky.set('#354f85');
        this.tmpHemiGnd.set('#152236');
        sunInt = 0.82;
        hemiInt = 0.64;
        fogDensity = 0.0048;
      }

      // Apply Weather Overcast, Storm Darkness & Lightning Flash!
      if (weather === 'rain') {
        this.tmpSkyColor.lerp(new THREE.Color('#475c78'), 0.56);
        this.tmpFogColor.lerp(new THREE.Color('#516885'), 0.62);
        sunInt *= 0.64;
        hemiInt *= 0.92;
        fogDensity = Math.max(fogDensity, 0.0044);
      } else if (weather === 'storm') {
        this.tmpSkyColor.lerp(new THREE.Color('#1f2c42'), 0.76);
        this.tmpFogColor.lerp(new THREE.Color('#273752'), 0.78);
        sunInt *= 0.45;
        hemiInt *= 0.78;
        fogDensity = Math.max(fogDensity, 0.006);
      } else if (weather === 'snow') {
        this.tmpSkyColor.lerp(new THREE.Color('#c7ddf0'), 0.55);
        this.tmpFogColor.lerp(new THREE.Color('#d6e8f7'), 0.62);
        this.tmpHemiSky.lerp(new THREE.Color('#e2f1ff'), 0.5);
        sunInt *= 0.82;
        fogDensity = Math.max(fogDensity, 0.0042);
      }

      if (lightning > 0.01) {
        this.tmpSkyColor.lerp(new THREE.Color('#e0f2fe'), lightning * 0.72);
        this.tmpFogColor.lerp(new THREE.Color('#bae6fd'), lightning * 0.58);
        sunInt += lightning * 2.8;
        hemiInt += lightning * 1.1;
      }

      (this.scene.background as THREE.Color).copy(this.tmpSkyColor);
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.copy(this.tmpFogColor);
        this.scene.fog.density = fogDensity;
      }
      this.sunLight.color.copy(this.tmpSunColor);
      this.sunLight.intensity = sunInt;
      this.hemiLight.color.copy(this.tmpHemiSky);
      this.hemiLight.groundColor.copy(this.tmpHemiGnd);
      this.hemiLight.intensity = hemiInt;

      // Dynamic Sun / Moon Orbital Arc across the sky!
      const isNightArc = hours < 5.5 || hours >= 19.5;
      const arcFrac = isNightArc
        ? (((hours + 4.5) % 24) / 10.0) * Math.PI
        : Math.max(0.08, Math.min(0.92, (hours - 5.5) / 14.0)) * Math.PI;
      const sunOffX = Math.cos(arcFrac) * -28;
      const sunOffY = 14 + Math.sin(arcFrac) * 24;
      const sunOffZ = -14 + Math.cos(arcFrac) * 8;
      this.sunLight.position.set(this.smoothCamX + sunOffX, this.smoothCamY + sunOffY, this.smoothCamZ + sunOffZ);
      this.sunLight.target.position.set(this.smoothCamX, this.smoothCamY, this.smoothCamZ);
    } else {
      // Interior / Dungeon fixed crisp directional shadow follow
      this.sunLight.position.set(this.smoothCamX - 18, this.smoothCamY + 32, this.smoothCamZ - 14);
      this.sunLight.target.position.set(this.smoothCamX, this.smoothCamY, this.smoothCamZ);
    }

    // Real-time Flickering Hero Dungeon Lantern / Cozy Indoor Fill / Night Outdoor Warm Lantern!
    if (isDungeon) {
      this.heroTorchLight.position.set(px3, adolGroundY + 1.85, pz3 + 0.35);
      this.heroTorchLight.intensity = 6.2 + Math.sin(time * 13) * 0.55;
      this.heroTorchLight.distance = 12.5;
    } else if (isInterior) {
      this.heroTorchLight.position.set(px3, adolGroundY + 1.75, pz3 + 0.35);
      this.heroTorchLight.intensity = 2.4 + Math.sin(time * 9) * 0.2;
      this.heroTorchLight.distance = 9.5;
    } else if (nightFactor > 0.32 || weather === 'storm') {
      const glow = Math.max(nightFactor, weather === 'storm' ? 0.55 : 0);
      this.heroTorchLight.position.set(px3, adolGroundY + 1.9, pz3 + 0.35);
      this.heroTorchLight.intensity = glow * (3.1 + Math.sin(time * 11) * 0.25);
      this.heroTorchLight.distance = 11.5;
    } else {
      this.heroTorchLight.intensity = 0;
    }

    // Live Directional Wind Vector (aligned to 45° normal view N/S/E/W compass!)
    const windDirX = state.windDirX ?? -0.7071;
    const windDirZ = state.windDirZ ?? -0.7071;
    const windSpeed = state.windSpeed ?? windMult * 1.45;
    const outdoorWeather = !isInterior && !isDungeon;

    // Animate 3D Volumetric Sky Clouds (visible across horizon vistas & behind speakers during dialogue close-ups!)
    if (this.skyCloudGroup && this.cloudCoreMat && this.cloudShadeMat) {
      this.skyCloudGroup.visible = outdoorWeather;
      if (outdoorWeather) {
        // Circadian & weather cloud palette tinting (warm rose-gold dawn/sunset, crisp white day, silver moonlit night, slate storm)
        const isDawn = hours >= 5.0 && hours < 7.8;
        const isSunset = hours >= 16.5 && hours < 20.0;
        this.tmpCloudCol.set('#ffffff');
        this.tmpCloudEmissive.set('#c7e4ff');
        let cloudEmissiveInt = 0.26;
        let cloudOpacity = 0.92;

        if (isDawn) {
          const w = Math.sin(smoothstep01((hours - 5.0) / 2.8) * Math.PI);
          this.tmpCloudCol.lerp(new THREE.Color('#ffd3b6'), w * 0.72);
          this.tmpCloudEmissive.set('#ffad84');
          cloudEmissiveInt = 0.32;
        } else if (isSunset) {
          const w = Math.sin(smoothstep01((hours - 16.5) / 3.5) * Math.PI);
          this.tmpCloudCol.lerp(new THREE.Color('#ffaf7b'), w * 0.8);
          this.tmpCloudEmissive.set('#f97316');
          cloudEmissiveInt = 0.28;
        }
        if (nightFactor > 0.05) {
          this.tmpCloudCol.lerp(new THREE.Color('#647fa8'), nightFactor * 0.78);
          this.tmpCloudEmissive.lerp(new THREE.Color('#3b5582'), nightFactor * 0.85);
          cloudEmissiveInt = THREE.MathUtils.lerp(cloudEmissiveInt, 0.22, nightFactor);
          cloudOpacity = THREE.MathUtils.lerp(0.92, 0.74, nightFactor);
        }
        if (weather === 'rain') {
          this.tmpCloudCol.lerp(new THREE.Color('#788ca6'), 0.65);
          this.tmpCloudEmissive.lerp(new THREE.Color('#475569'), 0.7);
          cloudOpacity = 0.95;
        } else if (weather === 'storm') {
          this.tmpCloudCol.lerp(new THREE.Color('#475569'), 0.82);
          this.tmpCloudEmissive.lerp(new THREE.Color('#1e293b'), 0.8);
          cloudOpacity = 0.97;
        } else if (weather === 'snow') {
          this.tmpCloudCol.lerp(new THREE.Color('#e2eef8'), 0.55);
          this.tmpCloudEmissive.set('#cbd5e1');
          cloudOpacity = 0.94;
        }
        if (lightning > 0.02) {
          this.tmpCloudCol.lerp(new THREE.Color('#f0f9ff'), lightning * 0.75);
          cloudEmissiveInt += lightning * 0.9;
        }

        this.cloudCoreMat.color.copy(this.tmpCloudCol);
        this.cloudCoreMat.emissive.copy(this.tmpCloudEmissive);
        this.cloudCoreMat.emissiveIntensity = cloudEmissiveInt;
        this.cloudCoreMat.opacity = cloudOpacity;

        this.cloudShadeMat.color.copy(this.tmpCloudCol).multiplyScalar(0.84);
        this.cloudShadeMat.emissive.copy(this.tmpCloudEmissive);
        this.cloudShadeMat.emissiveIntensity = cloudEmissiveInt * 0.55;
        this.cloudShadeMat.opacity = cloudOpacity * 0.92;

        const driftVel = windSpeed * 1.65;
        for (let i = 0; i < this.skyClouds.length; i++) {
          const cl = this.skyClouds[i];
          const step = driftVel * cl.speedMult * dt;
          cl.ox += windDirX * step;
          cl.oz += windDirZ * step;
          const wrap = cl.radiusWrap;
          if (cl.ox > wrap) cl.ox -= wrap * 2;
          else if (cl.ox < -wrap) cl.ox += wrap * 2;
          if (cl.oz > wrap) cl.oz -= wrap * 2;
          else if (cl.oz < -wrap) cl.oz += wrap * 2;

          // Keep horizon clouds gracefully outside the immediate gameplay foreground so they frame dialogue skies cleanly!
          let wx = this.smoothCamX + cl.ox;
          let wz = this.smoothCamZ + cl.oz;
          let wy = this.smoothCamY + cl.baseY + Math.sin(time * 0.42 + cl.bobPhase) * 0.55;
          if (cl.band === 'horizon') {
            const distFromCam = Math.hypot(cl.ox, cl.oz);
            if (distFromCam < 72) {
              const push = (72 - distFromCam) / 72;
              wy += push * 18;
            }
          }
          cl.group.position.set(wx, wy, wz);
        }
      }
    }

    // Animate Soft Drifting Ground Cloud Shadows gliding across town, plains, piers & ocean with the wind!
    if (this.cloudShadowGroup && this.cloudShadowMat) {
      this.cloudShadowGroup.visible = outdoorWeather;
      if (outdoorWeather) {
        const dayVis = 1 - nightFactor * 0.78;
        const weatherVis =
          weather === 'storm' ? 0.42 : weather === 'rain' ? 0.52 : weather === 'snow' ? 0.46 : weather === 'breezy' ? 1.12 : 1.0;
        const targetOpacity = THREE.MathUtils.clamp(0.19 * dayVis * weatherVis, 0.03, 0.24);
        this.cloudShadowMat.opacity = targetOpacity;
        this.cloudShadowMat.color.set(nightFactor > 0.55 ? '#071124' : '#0b223d');

        const shadowWrap = 62;
        const shadowVel = windSpeed * 1.45;
        for (let i = 0; i < this.cloudShadows.length; i++) {
          const sh = this.cloudShadows[i];
          const step = shadowVel * sh.speedMult * dt;
          sh.ox += windDirX * step;
          sh.oz += windDirZ * step;
          if (sh.ox > shadowWrap) sh.ox -= shadowWrap * 2;
          else if (sh.ox < -shadowWrap) sh.ox += shadowWrap * 2;
          if (sh.oz > shadowWrap) sh.oz -= shadowWrap * 2;
          else if (sh.oz < -shadowWrap) sh.oz += shadowWrap * 2;

          const wx = this.smoothCamX + sh.ox;
          const wz = this.smoothCamZ + sh.oz;
          const wy = this.sampleGroundY(wx, wz) + 0.085;
          const breathe = 1 + Math.sin(time * 0.35 + sh.phase) * 0.05;
          sh.mesh.position.set(wx, wy, wz);
          sh.mesh.scale.set(sh.sx * breathe, 1, sh.sz * (2 - breathe));
        }
      }
    }

    // Update 3D Volumetric Rain, Expanding Ground Splash Ripples & Drifting Snowflakes driven by live Wind Vector!
    const isRainy = outdoorWeather && (weather === 'rain' || weather === 'storm');
    const isSnowy = outdoorWeather && weather === 'snow';
    if (this.weatherRainLines) {
      this.weatherRainLines.visible = isRainy;
      if (isRainy) {
        const pos = this.weatherRainLines.geometry.attributes.position as THREE.BufferAttribute;
        const speedMult = weather === 'storm' ? 1.45 : 1.0;
        const slantStrength = weather === 'storm' ? 0.44 : 0.2;
        const slantX = windDirX * slantStrength;
        const slantZ = windDirZ * slantStrength;
        const mat = this.weatherRainLines.material as THREE.LineBasicMaterial;
        mat.opacity = weather === 'storm' ? 0.64 : 0.46;
        for (let i = 0; i < this.weatherRainData.length; i++) {
          const r = this.weatherRainData[i];
          r.oy -= r.speed * speedMult * dt;
          r.ox += slantX * r.speed * dt;
          r.oz += slantZ * r.speed * dt;
          if (r.oy < 0) {
            r.oy = 16 + Math.random() * 4;
            r.ox = (Math.random() - 0.5) * 34;
            r.oz = (Math.random() - 0.5) * 34;
          }
          const wx = this.smoothCamX + r.ox;
          const wz = this.smoothCamZ + r.oz;
          const wy = this.smoothCamY + r.oy;
          const idx = i * 2;
          pos.setXYZ(idx, wx, wy, wz);
          pos.setXYZ(idx + 1, wx - slantX * r.len * 2.2, wy + r.len, wz - slantZ * r.len * 2.2);
        }
        pos.needsUpdate = true;
      }
    }
    for (let i = 0; i < this.rainRipples.length; i++) {
      const rp = this.rainRipples[i];
      if (!isRainy) {
        rp.mesh.visible = false;
        continue;
      }
      rp.mesh.visible = true;
      rp.life += dt;
      if (rp.life >= rp.maxLife) {
        rp.life = 0;
        rp.maxLife = 0.36 + Math.random() * 0.34;
        rp.x = this.smoothCamX + (Math.random() - 0.5) * 24;
        rp.z = this.smoothCamZ + (Math.random() - 0.5) * 24;
        rp.mesh.position.set(rp.x, this.sampleGroundY(rp.x, rp.z) + 0.045, rp.z);
      }
      const prog = rp.life / rp.maxLife;
      rp.mesh.scale.setScalar(0.55 + prog * 2.35);
      (rp.mesh.material as THREE.MeshBasicMaterial).opacity = Math.sin(prog * Math.PI) * (weather === 'storm' ? 0.52 : 0.38);
    }
    if (this.weatherSnowPoints) {
      this.weatherSnowPoints.visible = isSnowy;
      if (isSnowy) {
        const pos = this.weatherSnowPoints.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < this.weatherSnowData.length; i++) {
          const s = this.weatherSnowData[i];
          s.oy -= s.speed * dt;
          s.ox += (windDirX * windSpeed * 0.72 + Math.sin(time * 1.4 + s.phase) * s.drift) * dt;
          s.oz += (windDirZ * windSpeed * 0.72 + Math.cos(time * 1.1 + s.phase) * s.drift * 0.7) * dt;
          if (s.oy < 0) {
            s.oy = 15 + Math.random() * 4;
            s.ox = (Math.random() - 0.5) * 34;
            s.oz = (Math.random() - 0.5) * 34;
          }
          pos.setXYZ(i, this.smoothCamX + s.ox, this.smoothCamY + s.oy, this.smoothCamZ + s.oz);
        }
        pos.needsUpdate = true;
      }
    }

    // Flicker torch flames & boost streetlamp / brazier warm glow automatically at dusk & night!
    for (let i = 0; i < this.fireFlames.length; i++) {
      const f = this.fireFlames[i];
      const s = (0.85 + nightFactor * 0.25) + Math.sin(time * 15 + i * 2.1) * 0.25;
      f.scale.set(s, 0.9 + s * 0.35, s);
      f.rotation.y = time * 4 + i;
    }
    const lampBoost = 1 + nightFactor * 0.95 + (weather === 'storm' ? 0.35 : 0);
    for (let i = 0; i < this.brazierLights.length; i++) {
      this.brazierLights[i].intensity = (3.0 + Math.sin(time * 12 + i * 1.7) * 0.55) * lampBoost;
    }

    // Animate Fountain Jets, Expanding Water Ripples, Arcing Streams, Sparkling Droplets, Living Birds, Shrine Halos & Wildlife!
    for (const j of this.fountainJets) {
      j.scale.y = 0.86 + Math.sin(time * 9.5) * 0.22;
      j.rotation.y = time * 2.8;
    }
    for (let fi = 0; fi < this.fountainAnims.length; fi++) {
      const fa = this.fountainAnims[fi];
      const foamPulse = 0.88 + Math.sin(time * 11 + fi) * 0.18;
      fa.topFoam.scale.set(foamPulse, foamPulse * 1.15, foamPulse);
      fa.topFoam.position.y = 3.04 + Math.sin(time * 9.5 + fi) * 0.08;
      for (let ri = 0; ri < fa.ripples.length; ri++) {
        const rt = (time * 0.58 + ri / fa.ripples.length) % 1;
        const sc = 0.75 + rt * 5.2;
        fa.ripples[ri].scale.setScalar(sc);
        (fa.ripples[ri].material as THREE.MeshBasicMaterial).opacity = Math.sin(rt * Math.PI) * 0.65;
      }
      for (let si = 0; si < fa.streams.length; si++) {
        const sm = fa.streams[si];
        (sm.material as THREE.MeshBasicMaterial).opacity = 0.58 + Math.sin(time * 8.5 + si * 1.1) * 0.22;
      }
      for (let di = 0; di < fa.droplets.length; di++) {
        const d = fa.droplets[di];
        const t = (time * d.speed + d.phase) % 1;
        const r = THREE.MathUtils.lerp(d.startR, d.endR, t);
        const y = (1 - t) * (1 - t) * d.baseY + 2 * (1 - t) * t * d.peakY + t * t * d.endY;
        d.mesh.position.set(Math.cos(d.angle) * r, y, Math.sin(d.angle) * r);
        const dsc = Math.sin(t * Math.PI) * 1.18;
        d.mesh.scale.setScalar(Math.max(0.05, dsc));
      }
    }

    // Living 3D Flock of Birds Drinking at the Fountain & Flying Between Tree Canopies!
    for (let bi = 0; bi < this.birdRigs.length; bi++) {
      const b = this.birdRigs[bi];
      b.timer += dt;

      if (b.state === 'perch_fountain') {
        const f = this.fountainAnchors[b.fountainIdx];
        if (f) {
          // Gentle perched hop + rhythmic head dipping down to sip fountain water!
          const sipCycle = Math.sin(time * b.drinkSpeed + b.phase);
          const isSipping = sipCycle > 0.25;
          const dip = isSipping ? (sipCycle - 0.25) / 0.75 : 0;
          b.bodyPivot.position.y = Math.abs(Math.sin(time * 2.2 + b.phase)) * 0.018;
          b.bodyPivot.rotation.x = dip * 0.42;
          b.headPivot.rotation.x = dip * 0.78;
          b.headPivot.rotation.y = isSipping ? 0 : Math.sin(time * 1.9 + b.phase) * 0.42;
          b.wingL.rotation.z = -0.18 + Math.sin(time * 3 + b.phase) * 0.05;
          b.wingR.rotation.z = 0.18 - Math.sin(time * 3 + b.phase) * 0.05;
        }
        if (b.timer >= b.duration && this.treePerchSpots.length > 0) {
          b.timer = 0;
          b.state = 'fly_to_tree';
          b.startPos.copy(b.group.position);
          const nextTree = Math.floor(hash2d(bi, Math.floor(time * 10), 941) * this.treePerchSpots.length);
          b.treeIdx = nextTree;
          const tp = this.treePerchSpots[nextTree];
          b.endPos.set(tp.x, tp.y, tp.z);
          const dist = b.startPos.distanceTo(b.endPos);
          b.duration = THREE.MathUtils.clamp(dist / 6.2, 1.4, 4.4);
          b.arcHeight = 1.8 + Math.min(3.8, dist * 0.22);
        }
      } else if (b.state === 'perch_tree') {
        // Resting on tree canopy bough, gently bobbing & looking around
        b.bodyPivot.position.y = Math.sin(time * 2.8 + b.phase) * 0.025;
        b.bodyPivot.rotation.x = 0;
        b.headPivot.rotation.x = Math.sin(time * 1.7 + b.phase) * 0.12;
        b.headPivot.rotation.y = Math.sin(time * 2.4 + b.phase * 1.3) * 0.58;
        b.wingL.rotation.z = -0.22;
        b.wingR.rotation.z = 0.22;

        if (b.timer >= b.duration) {
          b.timer = 0;
          b.startPos.copy(b.group.position);
          if (this.fountainAnchors.length > 0 && (bi % 3 !== 2 || this.treePerchSpots.length < 2)) {
            b.state = 'fly_to_fountain';
            b.fountainIdx = Math.floor(hash2d(bi, Math.floor(time * 7), 953) * this.fountainAnchors.length);
            const f = this.fountainAnchors[b.fountainIdx];
            b.rimAngle = hash2d(bi, Math.floor(time * 13), 967) * Math.PI * 2;
            b.endPos.set(f.x + Math.cos(b.rimAngle) * f.rimR, f.rimY, f.z + Math.sin(b.rimAngle) * f.rimR);
          } else if (this.treePerchSpots.length > 1) {
            b.state = 'fly_to_tree';
            const nextTree = (b.treeIdx + 1 + Math.floor(hash2d(bi, Math.floor(time * 11), 971) * (this.treePerchSpots.length - 1))) % this.treePerchSpots.length;
            b.treeIdx = nextTree;
            const tp = this.treePerchSpots[nextTree];
            b.endPos.set(tp.x, tp.y, tp.z);
          }
          const dist = b.startPos.distanceTo(b.endPos);
          b.duration = THREE.MathUtils.clamp(dist / 6.4, 1.4, 4.5);
          b.arcHeight = 1.9 + Math.min(3.8, dist * 0.22);
        }
      } else {
        // Sweeping 3D curved flight arc with energetic wingbeats!
        const rawT = Math.min(1, b.timer / Math.max(0.2, b.duration));
        const smoothT = rawT * rawT * (3 - 2 * rawT);
        const cx = THREE.MathUtils.lerp(b.startPos.x, b.endPos.x, smoothT);
        const cz = THREE.MathUtils.lerp(b.startPos.z, b.endPos.z, smoothT);
        const curveSway = Math.sin(rawT * Math.PI) * Math.sin(b.phase) * 1.4;
        const dxDir = b.endPos.x - b.startPos.x;
        const dzDir = b.endPos.z - b.startPos.z;
        const len = Math.max(0.01, Math.hypot(dxDir, dzDir));
        const nx = cx + (-dzDir / len) * curveSway;
        const nz = cz + (dxDir / len) * curveSway;
        const ny = THREE.MathUtils.lerp(b.startPos.y, b.endPos.y, smoothT) + Math.sin(rawT * Math.PI) * b.arcHeight;

        const prevX = b.group.position.x;
        const prevZ = b.group.position.z;
        b.group.position.set(nx, ny, nz);
        if (Math.hypot(nx - prevX, nz - prevZ) > 0.002) {
          b.group.rotation.y = Math.atan2(nx - prevX, nz - prevZ);
        }
        const flap = Math.sin(time * 26 + b.phase) * 0.92;
        b.wingL.rotation.z = flap;
        b.wingR.rotation.z = -flap;
        b.bodyPivot.position.y = Math.sin(time * 26 + b.phase) * 0.03;
        b.bodyPivot.rotation.x = Math.cos(rawT * Math.PI) * -0.26;
        b.headPivot.rotation.set(0, 0, 0);

        if (rawT >= 1) {
          b.timer = 0;
          b.duration = 2.8 + hash2d(bi, Math.floor(time * 5), 983) * 4.5;
          b.group.position.copy(b.endPos);
          if (b.state === 'fly_to_fountain') {
            b.state = 'perch_fountain';
            const f = this.fountainAnchors[b.fountainIdx];
            if (f) b.group.rotation.y = Math.atan2(f.x - b.endPos.x, f.z - b.endPos.z);
          } else {
            b.state = 'perch_tree';
          }
        }
      }
    }

    for (const r of this.statueRings) {
      r.rotation.y = time * 1.4;
    }
    for (const sp of this.spinners) {
      sp.obj.rotation[sp.axis] = time * sp.speed;
    }
    // Gently Sway Hanging Glass Street Lanterns & Shop Signs with Weather Wind Physics!
    for (let i = 0; i < this.swayingLanterns.length; i++) {
      const sl = this.swayingLanterns[i];
      const sw = Math.sin(time * sl.speed * Math.sqrt(windMult) + sl.phase) * sl.amp * windMult;
      if (sl.axis === 'xz') {
        sl.pivot.rotation.z = sw;
        sl.pivot.rotation.x = Math.cos(time * sl.speed * 0.78 * Math.sqrt(windMult) + sl.phase * 1.3) * sl.amp * 0.72 * windMult;
      } else {
        sl.pivot.rotation.z = sw;
      }
    }
    // Animate Articulated Tree Canopy Limbs, Crown Puffs, Hanging Vines, Window Flower-Box Plants, Roof Grass & Laundry!
    for (let i = 0; i < this.treeMovingParts.length; i++) {
      const tm = this.treeMovingParts[i];
      const gust = (0.72 + 0.42 * Math.sin(time * 0.85 * Math.sqrt(windMult) + tm.wx * 0.14 + tm.wz * 0.11)) * windMult;
      tm.obj.rotation.x = tm.baseRx + Math.sin(time * tm.speed * Math.sqrt(windMult) + tm.phase) * tm.ampX * gust;
      tm.obj.rotation.z = tm.baseRz + Math.cos(time * tm.speed * 0.86 * Math.sqrt(windMult) + tm.phase * 1.2) * tm.ampZ * gust;
    }
    // Animate Fluttering 3D Butterflies & Dragonflies Over Meadows!
    for (let i = 0; i < this.butterflyRigs.length; i++) {
      const bf = this.butterflyRigs[i];
      const a = time * bf.speed + bf.phase;
      const nx = bf.cx + Math.cos(a) * bf.rx;
      const nz = bf.cz + Math.sin(a * 1.35) * bf.rz;
      const ny = bf.baseY + Math.sin(time * 2.8 + bf.phase) * 0.34;
      const dx = nx - bf.grp.position.x;
      const dz = nz - bf.grp.position.z;
      bf.grp.position.set(nx, ny, nz);
      if (Math.hypot(dx, dz) > 0.001) bf.grp.rotation.y = Math.atan2(dx, dz);
      const flap = Math.sin(time * bf.flapSpeed + bf.phase) * 0.95;
      bf.wingL.rotation.z = flap;
      bf.wingR.rotation.z = -flap;
    }
    // Animate Golden & Vermilion Koi Fish Swimming Inside Fountains!
    for (let i = 0; i < this.fountainKoi.length; i++) {
      const k = this.fountainKoi[i];
      const ka = time * k.speed + k.phase;
      const kx = k.cx + Math.cos(ka) * k.r;
      const kz = k.cz + Math.sin(ka) * k.r;
      k.grp.position.set(kx, k.y, kz);
      k.grp.rotation.y = -ka + (k.speed >= 0 ? 0 : Math.PI);
      k.tail.rotation.y = Math.sin(time * 9.5 + k.phase) * 0.42;
    }
    // Animate Alchemy Cauldron Bubbles & Cooking Stew Steam Puffs!
    for (let i = 0; i < this.cauldronBubbles.length; i++) {
      const cb = this.cauldronBubbles[i];
      const prog = (time * cb.speed + cb.phase) % 1;
      cb.mesh.position.set(cb.ox + Math.sin(time * 3 + cb.phase) * 0.05, cb.baseY + prog * 0.65, cb.oz);
      cb.mesh.scale.setScalar(Math.max(0.05, Math.sin(prog * Math.PI) * 1.25));
    }
    // Animate Forageable World Nodes (gentle glint bob & smooth harvest/regrow scale!)
    for (const rig of this.forageRigs.values()) {
      const targetScale = rig.gathered ? 0.22 : 1.0;
      const cur = rig.group.scale.y;
      const next = THREE.MathUtils.damp(cur, targetScale, 8, dt);
      rig.group.scale.set(next, next, next);
      if (!rig.gathered) {
        rig.glint.rotation.y = time * 2.4;
        rig.glint.position.y = 1.18 + Math.sin(time * 3.4 + rig.baseY) * 0.14;
      }
    }
    // Animate Grazing Horses, Cows, Sheep & Pecking Chickens in Pastures!
    for (let i = 0; i < this.grazingAnimals.length; i++) {
      const a = this.grazingAnimals[i];
      a.timer -= dt;
      if (a.timer <= 0) {
        a.grazeMode = !a.grazeMode;
        if (a.grazeMode) {
          a.timer = 3.2 + hash2d(i, Math.floor(time * 3), 711) * 3.6;
        } else {
          a.targetX = a.homeX + (hash2d(i, Math.floor(time * 5), 712) * 2 - 1) * a.roamRx;
          a.targetZ = a.homeZ + (hash2d(i, Math.floor(time * 7), 713) * 2 - 1) * a.roamRz;
          a.timer = 2.6 + hash2d(i, Math.floor(time * 9), 714) * 2.5;
        }
      }
      if (!a.grazeMode) {
        const dx = a.targetX - a.curX;
        const dz = a.targetZ - a.curZ;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.08) {
          const step = Math.min(dist, a.speed * dt);
          a.curX += (dx / dist) * step;
          a.curZ += (dz / dist) * step;
          a.root.position.set(a.curX, this.sampleGroundY(a.curX, a.curZ), a.curZ);
          a.root.rotation.y = Math.atan2(dx, dz);
          const gait = Math.sin(time * (a.kind === 'horse' ? 6.5 : 8.0) + a.phase);
          for (let li = 0; li < a.legs.length; li++) {
            a.legs[li].rotation.x = (li % 2 === 0 ? gait : -gait) * 0.35;
          }
          a.headPivot.rotation.x = Math.sin(time * 4 + a.phase) * 0.1;
        } else {
          a.grazeMode = true;
        }
      } else {
        // Grazing / Eating grass animation (head dipping down to chew + horse tail swishing!)
        const chew = Math.sin(time * (a.kind === 'chicken' ? 7.5 : 2.6) + a.phase);
        a.headPivot.rotation.x = (a.kind === 'horse' ? 0.85 : a.kind === 'chicken' ? 0.65 : 0.58) + chew * 0.22;
        for (let li = 0; li < a.legs.length; li++) a.legs[li].rotation.x *= 0.88;
      }
      if (a.tailPivot) {
        a.tailPivot.rotation.z = Math.sin(time * 3.8 + a.phase) * 0.36;
      }
    }
    // Animate Seated Community Villagers Playing Board Games & Eating Warm Bread!
    for (let i = 0; i < this.seatedPeople.length; i++) {
      const sp = this.seatedPeople[i];
      const cyc = Math.sin(time * 2.1 + sp.phase);
      if (sp.mode === 'game') {
        sp.head.rotation.x = 0.22 + Math.sin(time * 1.4 + sp.phase) * 0.12;
        sp.head.rotation.y = Math.sin(time * 0.9 + sp.phase) * 0.25;
        sp.armR.rotation.x = Math.max(0, cyc) * -0.52;
        sp.armL.rotation.x = Math.sin(time * 1.3 + sp.phase) * 0.12;
      } else {
        // Eating & chatting cheerfully!
        sp.head.rotation.x = Math.sin(time * 3.2 + sp.phase) * 0.14;
        sp.armR.rotation.x = -0.35 - Math.max(0, cyc) * 0.48;
        sp.torso.rotation.x = 0.08 + Math.sin(time * 1.7 + sp.phase) * 0.05;
      }
    }
    // Animate Craftworks Mini-Factory Machinery & Forge Bellows (Trip-Hammer, Moving Product Crates, & Pumping Bellows!)
    for (let i = 0; i < this.factoryMachines.length; i++) {
      const fm = this.factoryMachines[i];
      if (fm.kind === 'hammer') {
        const beat = Math.pow(Math.abs(Math.sin(time * fm.speed + fm.phase)), 0.45);
        fm.obj.rotation.z = 0.42 - beat * fm.span;
      } else if (fm.kind === 'belt_item') {
        const t = (time * fm.speed + fm.phase) % 1;
        fm.obj.position.x = fm.ox + t * fm.span;
      } else if (fm.kind === 'bellows') {
        const pump = Math.sin(time * fm.speed + fm.phase) * 0.5 + 0.5;
        fm.obj.scale.set(1 + pump * 0.14, 0.72 + pump * 0.48, 1 + pump * 0.1);
        fm.obj.rotation.z = 0.08 + pump * fm.span;
      }
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

    // Update Sculpted Articulated 3D Hero Adol & Equipment Materials!
    this.syncAdolRig(state, px3, pz3);

    // Update Interactive Rustling Shrubs + Occluded Hidden-Item X-Ray Glints!
    const revealRadius = 10.5;
    for (const shRig of this.shrubRigs) {
      const sh = zone.shrubs.find((s) => s.id === shRig.id);
      if (!sh) continue;
      const wiggle = Math.sin(sh.shakePhase) * sh.shakeAmp * 0.24;
      const squash = 1 + Math.abs(Math.sin(sh.shakePhase)) * sh.shakeAmp * 0.16;
      shRig.group.rotation.z = wiggle;
      shRig.group.scale.set(squash, 1 / Math.sqrt(squash), squash);
      const hasSecret = !sh.searched && sh.hiddenKind !== 'nothing';
      shRig.sparkle.visible = hasSecret;
      if (hasSecret) {
        shRig.sparkle.rotation.y = time * 3.5;
        shRig.sparkle.position.y = 0.68 + Math.sin(time * 5 + shRig.tx) * 0.08;
      }
      const dist = Math.hypot(shRig.tx + 0.5 - px3, shRig.ty + 0.5 - pz3);
      const showXray = hasSecret && dist < revealRadius;
      shRig.xrayGlint.visible = showXray;
      if (showXray) {
        const fade = Math.max(0.18, 1 - dist / revealRadius);
        shRig.xrayGlint.rotation.y = time * 3.6;
        shRig.xrayGlint.position.y = 0.82 + Math.sin(time * 5 + shRig.tx) * 0.08;
        (shRig.xrayGlint.material as THREE.MeshBasicMaterial).opacity = fade * (0.62 + Math.sin(time * 5.2 + shRig.tx) * 0.22);
      }
    }

    // Update Hinged 3D Treasure Chests + Occluded X-Ray Glints!
    for (const cRig of this.chestRigs) {
      const opened = state.openedChests.has(cRig.id);
      const targetRot = opened ? -1.9 : 0;
      cRig.lidPivot.rotation.x += (targetRot - cRig.lidPivot.rotation.x) * 0.2;
      cRig.glowLight.visible = !opened;
      if (!opened) {
        cRig.glowLight.rotation.y = time * 3;
        cRig.glowLight.position.y = 0.72 + Math.sin(time * 4.5) * 0.08;
      }
      const dist = Math.hypot(cRig.tx + 0.5 - px3, cRig.ty + 0.5 - pz3);
      const showXray = !opened && dist < revealRadius;
      cRig.xrayGlint.visible = showXray;
      if (showXray) {
        const fade = Math.max(0.2, 1 - dist / revealRadius);
        cRig.xrayGlint.rotation.y = time * 3.2;
        cRig.xrayGlint.position.y = 0.78 + Math.sin(time * 4.5 + cRig.tx) * 0.09;
        (cRig.xrayGlint.material as THREE.MeshBasicMaterial).opacity = fade * (0.66 + Math.sin(time * 4.8 + cRig.tx) * 0.22);
      }
    }

    // Update Floating Golden Discovery Glints on Uninspected Landmarks & Shop Props!
    for (let i = 0; i < this.inspectableRigs.length; i++) {
      const iRig = this.inspectableRigs[i];
      const obj = zone.inspectables.find((o) => o.id === iRig.id);
      if (!obj) continue;
      iRig.glint.visible = !obj.inspected;
      if (iRig.glint.visible) {
        iRig.glint.rotation.y = time * 3.1 + i;
        iRig.glint.position.y = iRig.baseY + Math.sin(time * 4.2 + i * 1.3) * 0.09;
      }
      const dist = Math.hypot(iRig.tx + 0.5 - px3, iRig.ty + 0.5 - pz3);
      const showXray = !obj.inspected && dist < revealRadius;
      iRig.xrayGlint.visible = showXray;
      if (showXray) {
        const fade = Math.max(0.18, 1 - dist / revealRadius);
        iRig.xrayGlint.rotation.y = time * 3.1 + i;
        (iRig.xrayGlint.material as THREE.MeshBasicMaterial).opacity = fade * (0.6 + Math.sin(time * 4.5 + i) * 0.2);
      }
    }

    // Update Glowing 3D Zone Portals & Warm Golden Building Doorways!
    for (const pRig of this.portalRigs) {
      const locked = Boolean(pRig.requiredFlag && !state.flags.has(pRig.requiredFlag));
      const col = locked ? '#f43f5e' : pRig.isDoorway ? '#fde047' : '#38bdf8';
      (pRig.ring.material as THREE.MeshBasicMaterial).color.set(col);
      if (pRig.isDoorway) {
        (pRig.ring.material as THREE.MeshBasicMaterial).opacity = 0.38 + Math.sin(time * 3.6) * 0.16;
      } else {
        pRig.ring.scale.setScalar(0.92 + Math.sin(time * 4.2) * 0.1);
      }
      for (const orb of pRig.pillarGlows) {
        (orb.material as THREE.MeshBasicMaterial).color.set(col);
        orb.rotation.y = time * 2.5;
      }
    }

    // Update Sculpted Articulated 3D Living NPCs (Full 360° Facing, Striding Limbs, Swaying Hair/Capes & 3D Tasks!)
    for (const npc of zone.npcs) {
      const rig = this.npcRigs.get(npc.id);
      if (!rig) continue;

      const st = state.npcStates?.get(npc.id);
      const a = st ? st.angle : (state.npcAngles.get(npc.id) ?? Math.PI * 0.5);
      if (st) {
        const nx = st.x / YS_WORLD_TILE;
        const nz = st.y / YS_WORLD_TILE;
        rig.root.position.set(nx, this.sampleGroundY(nx, nz), nz);
      }

      // True 360° 3D facing matching world (cos(a), sin(a)) direction!
      rig.body.rotation.y = Math.atan2(Math.cos(a), Math.sin(a));

      const isWalking = Boolean(st && st.speedFrac > 0.08);
      const walkPhase = st?.walkAnim ?? 0;
      const spdF = st?.speedFrac ?? 0;
      const working = Boolean(st?.working);
      const wp = st?.workPhase ?? time * 3.2;
      const bMode = st?.behaviorMode ?? 'routine';
      const isTalking = Boolean(st?.talking) || bMode === 'chat_pair';
      const springY = st?.springOffsetY ?? 0;
      const headLook = st?.headLookYaw ?? 0;
      const p = rig.parts;

      // Articulated 3D legs, spring-damper physics bounce & walking stride!
      const legSwing = isWalking ? Math.sin(walkPhase) * 0.62 * spdF : 0;
      p.legLPivot.rotation.x = legSwing;
      p.legRPivot.rotation.x = -legSwing;

      const walkHop = isWalking
        ? Math.abs(Math.cos(walkPhase)) * (npc.task === 'play' ? 0.14 : 0.065) * spdF
        : 0;
      rig.body.position.y = Math.max(0, walkHop + springY);

      if (bMode === 'stretch') {
        p.torsoPivot.rotation.x = -0.14 + Math.sin(time * 2.2 + npc.tx) * 0.06;
      } else if (bMode === 'shelter') {
        p.torsoPivot.rotation.x = 0.22;
      } else {
        p.torsoPivot.rotation.x = isWalking ? 0.06 * spdF : Math.sin(time * 2.1 + npc.tx) * 0.025;
      }

      if (bMode === 'look_around') {
        p.headPivot.rotation.y = Math.sin(time * 2.2 + npc.tx) * 0.62;
        p.headPivot.rotation.x = Math.sin(time * 1.5 + npc.ty) * 0.08;
      } else if (isTalking) {
        p.headPivot.rotation.y = headLook + Math.sin(time * 2.8 + npc.tx) * 0.14;
        p.headPivot.rotation.x = Math.sin(time * 5.2 + npc.ty) * 0.12;
      } else {
        p.headPivot.rotation.y = isWalking ? headLook * 0.7 : headLook + Math.sin(time * 1.15 + npc.tx * 2.3) * 0.16;
        p.headPivot.rotation.x = working && (rig.task === 'read' || rig.task === 'garden' || rig.task === 'craft') ? 0.18 : 0;
      }

      // Articulated 3D arms (natural counter-swing while walking, expressive social behaviors & work poses!)
      if (bMode === 'wave') {
        p.armRPivot.rotation.set(-2.45, 0, -0.28 + Math.sin(time * 9.5 + npc.tx) * 0.34);
        p.armLPivot.rotation.set(-0.12, 0, 0.1);
      } else if (bMode === 'stretch') {
        p.armLPivot.rotation.set(-2.65, 0, 0.26);
        p.armRPivot.rotation.set(-2.65, 0, -0.26);
      } else if (bMode === 'hop') {
        p.armLPivot.rotation.set(-1.65, 0, 0.38);
        p.armRPivot.rotation.set(-1.65, 0, -0.38);
      } else if (bMode === 'shelter') {
        p.armLPivot.rotation.set(-2.1, 0.35, 0.24);
        p.armRPivot.rotation.set(legSwing * 0.6 - 0.25, 0, -0.1);
      } else if (isTalking) {
        const talkGest = Math.sin(time * 4.8 + npc.tx * 1.7);
        p.armRPivot.rotation.set(-0.78 + talkGest * 0.32, -0.22, -0.18);
        p.armLPivot.rotation.set(-0.56 - talkGest * 0.24, 0.22, 0.16);
      } else if (working && rig.task === 'hammer') {
        const strike = Math.pow(Math.abs(Math.sin(wp * 1.35)), 0.5);
        p.armRPivot.rotation.set(-1.35 + strike * 1.55, 0, -0.12);
        p.armLPivot.rotation.set(-0.45, 0, 0.15);
      } else if (working && rig.task === 'craft') {
        const strike = Math.pow(Math.abs(Math.sin(wp * 1.4)), 0.5);
        p.armRPivot.rotation.set(-1.1 + strike * 1.15, 0, -0.1);
        p.armLPivot.rotation.set(-0.55, 0, 0.15);
      } else if (rig.task === 'carry_crate' || rig.task === 'serve' || rig.task === 'baker' || rig.task === 'read') {
        p.armLPivot.rotation.set(-0.68, 0.18, 0.12);
        p.armRPivot.rotation.set(-0.68, -0.18, -0.12);
      } else if (working && rig.task === 'sweep') {
        p.armRPivot.rotation.set(-0.55 + Math.sin(wp * 1.4) * 0.35, Math.sin(wp * 1.4) * 0.25, -0.15);
        p.armLPivot.rotation.set(-0.42 - Math.sin(wp * 1.4) * 0.22, 0, 0.15);
      } else if (working && rig.task === 'garden') {
        p.armRPivot.rotation.set(-0.72 + Math.sin(wp * 1.3) * 0.14, 0, -0.1);
        p.armLPivot.rotation.set(-0.22, 0, 0.12);
      } else if (npc.task === 'play') {
        p.armLPivot.rotation.set(-legSwing * 1.15 - 0.15, 0, 0.28);
        p.armRPivot.rotation.set(legSwing * 1.15 - 0.15, 0, -0.28);
      } else {
        p.armLPivot.rotation.set(-legSwing * 0.85, 0, 0.08);
        p.armRPivot.rotation.set(legSwing * 0.85, 0, -0.08);
      }

      if (p.capePivot) {
        p.capePivot.rotation.x = 0.08 + spdF * 0.26 + Math.sin(time * 3.4 * Math.sqrt(windMult) + npc.tx) * 0.055 * windMult;
      }
      if (p.hairBackPivot) {
        p.hairBackPivot.rotation.x = 0.06 + spdF * 0.18 + Math.sin(time * 2.8 * Math.sqrt(windMult) + npc.ty) * 0.045 * windMult;
      }

      // Animate 3D Sculpted Task Props in Sync with NPC Activity!
      if (rig.propAnchor && rig.propPivot) {
        if (rig.task === 'sweep') {
          rig.propPivot.rotation.set(0, working ? Math.sin(wp * 1.4) * 0.72 : 0, working ? Math.sin(wp * 1.4) * 0.18 : 0);
        } else if (rig.task === 'water_carry') {
          rig.propPivot.rotation.set(working ? 0.55 + Math.sin(wp * 1.1) * 0.45 : Math.sin(walkPhase) * 0.16, 0, 0);
        } else if (rig.task === 'garden') {
          rig.propPivot.rotation.set(0, 0, working ? -0.42 + Math.sin(wp * 1.3) * 0.14 : 0);
          if (rig.extraProp) {
            rig.extraProp.visible = working;
            if (working) {
              const sc = 0.85 + Math.sin(wp * 3.5) * 0.2;
              rig.extraProp.scale.set(sc, 1 + Math.sin(wp * 4) * 0.16, sc);
            }
          }
        } else if (rig.task === 'hammer') {
          const strike = working ? Math.pow(Math.abs(Math.sin(wp * 1.35)), 0.5) : 0;
          rig.propPivot.rotation.set(working ? -0.95 + strike * 1.65 : 0, 0, 0);
        } else if (rig.task === 'carry_crate') {
          rig.propPivot.position.y = isWalking ? Math.abs(Math.sin(walkPhase * 2)) * 0.04 : working ? -0.14 : 0;
        } else if (rig.task === 'patrol') {
          rig.propPivot.rotation.set(isWalking ? Math.sin(walkPhase) * 0.12 : 0, working ? Math.sin(wp * 0.6) * 0.25 : 0, 0);
        } else if (rig.task === 'fish') {
          rig.propPivot.rotation.set(working ? Math.sin(wp * 0.7) * 0.08 : -0.35, 0, 0);
          if (rig.extraProp) {
            rig.extraProp.visible = working;
            rig.extraProp.position.y = -0.66 + Math.sin(time * 4.5 + npc.tx) * 0.06;
          }
        } else if (rig.task === 'serve') {
          rig.propPivot.position.y = Math.sin(time * 4 + npc.tx) * 0.025;
          rig.propPivot.rotation.set(working ? 0.16 : 0, 0, 0);
        } else if (rig.task === 'read') {
          rig.propPivot.rotation.set(working ? -0.14 + Math.sin(wp * 0.8) * 0.06 : 0, 0, 0);
        } else if (rig.task === 'baker') {
          rig.propPivot.position.y = Math.sin(time * 4.2 + npc.tx) * 0.025;
          rig.propPivot.rotation.set(working ? 0.18 : 0, 0, 0);
        } else if (rig.task === 'craft') {
          const strike = working ? Math.pow(Math.abs(Math.sin(wp * 1.4)), 0.5) : 0;
          rig.propPivot.rotation.set(working ? -0.75 + strike * 1.3 : 0, 0, 0);
        }
      }
    }

    // Sync Sculpted Articulated 3D Enemies & Colossal 3D Bosses (Full 360° 3D Orientation & Species Animations!)
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
      rig.body.rotation.y = Math.atan2(Math.cos(e.angle), Math.sin(e.angle));

      const ep = rig.parts;
      const ph = time * (e.kind === 'wyvern' ? 7.8 : e.kind === 'goblin' ? 8.2 : 5.4) + e.id * 1.7;

      if (e.kind === 'slime') {
        const bounce = Math.abs(Math.sin(ph));
        rig.body.position.y = bounce * 0.24;
        const squash = 1 + (0.5 - bounce) * 0.24;
        const stretch = 1 + (bounce - 0.5) * 0.30;
        ep.bodyPivot.scale.set(squash, stretch, squash);
        if (ep.coreMesh) ep.coreMesh.rotation.y = time * 2.8 + e.id;
      } else if (e.kind === 'wyvern') {
        rig.body.position.y = 0.28 + Math.sin(ph) * 0.22;
        const flap = Math.sin(ph) * 0.62;
        if (ep.wingLPivot) ep.wingLPivot.rotation.z = flap;
        if (ep.wingRPivot) ep.wingRPivot.rotation.z = -flap;
        if (ep.tailPivot) ep.tailPivot.rotation.y = Math.sin(ph * 0.7) * 0.34;
        if (ep.headPivot) ep.headPivot.rotation.x = Math.sin(ph) * 0.12;
      } else if (e.kind === 'mage') {
        rig.body.position.y = 0.14 + Math.sin(ph * 0.7) * 0.16;
        if (ep.orbitRing) ep.orbitRing.rotation.y = time * 2.4 + e.id;
        if (ep.coreMesh) ep.coreMesh.rotation.y = -time * 3.6;
        if (ep.armRPivot) ep.armRPivot.rotation.x = Math.sin(ph * 0.6) * 0.24;
      } else {
        // Articulated 3D Stride for Goblin, Dark Knight & Colossal Boss!
        const stride = Math.sin(ph) * (e.kind === 'boss' ? 0.42 : 0.62);
        rig.body.position.y = Math.abs(Math.cos(ph)) * (e.kind === 'boss' ? 0.10 : 0.07);
        if (ep.legLPivot) ep.legLPivot.rotation.x = stride;
        if (ep.legRPivot) ep.legRPivot.rotation.x = -stride;
        if (ep.armLPivot) ep.armLPivot.rotation.x = -stride * 0.7;
        if (ep.armRPivot) ep.armRPivot.rotation.x = stride * 0.85 - 0.25;
        if (ep.capePivot) ep.capePivot.rotation.x = 0.18 + Math.sin(ph) * 0.10;
        if (ep.orbitRing) ep.orbitRing.rotation.y = time * 1.8;
        if (ep.coreMesh) ep.coreMesh.rotation.y = time * 2.5;
      }

      if (rig.bossCircle) {
        rig.bossCircle.rotation.z = -time * 1.6;
        rig.bossCircle.scale.setScalar(0.95 + Math.sin(time * 4.5) * 0.08);
      }
      const flash = e.hitFlash > 0 && Math.floor(time * 32) % 2 === 0;
      for (const fm of ep.flashMaterials) {
        if (flash) {
          fm.emissive.set('#ffffff');
          fm.emissiveIntensity = 1.25;
        } else {
          fm.emissive.set('#000000');
          fm.emissiveIntensity = 0;
        }
      }
    }
    for (const [id, rig] of this.enemyRigs.entries()) {
      if (!aliveIds.has(id)) {
        for (const m of rig.parts.ownedMaterials) m.dispose();
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

  private syncAdolRig(state: YsThreeRenderState, px3: number, pz3: number): void {
    const r = this.adolRig;
    const blinkHide = state.invulnTimer > 0 && Math.floor(state.time * 18) % 2 === 0;
    r.root.visible = !blinkHide;
    r.root.position.set(px3, this.sampleGroundY(px3, pz3), pz3);

    // True continuous 360° 3D facing!
    r.body.rotation.y = Math.atan2(Math.cos(state.bodyAngle), Math.sin(state.bodyAngle));

    // Live 3D Sword & Armor PBR material upgrade when Adol equips stronger gear!
    if (r.weaponTier !== state.weaponTier || r.armorTier !== state.armorTier) {
      r.weaponTier = state.weaponTier;
      r.armorTier = state.armorTier;
      applyHeroEquipmentTier3D(r.parts, state.weaponTier, state.armorTier);
    }

    const p = r.parts;
    const moving = state.moveSpeedFrac > 0.06;
    const stride = moving ? Math.sin(state.walkAnim) * 0.72 * state.moveSpeedFrac : 0;

    // Articulated 3D Legs, Torso Lean, Breathing, Billowing Cape & Sweeping Sword Slash!
    p.legLPivot.rotation.x = stride;
    p.legRPivot.rotation.x = -stride;

    const bob = moving ? Math.abs(Math.cos(state.walkAnim)) * 0.08 * state.moveSpeedFrac : 0;
    const lunge = state.lungeTimer > 0 ? 0.16 : 0;
    r.body.position.set(Math.cos(state.bodyAngle) * lunge, bob, Math.sin(state.bodyAngle) * lunge);

    const wKind = state.weather ?? 'clear';
    const windMult = wKind === 'storm' ? 2.6 : wKind === 'breezy' ? 2.0 : wKind === 'rain' ? 1.55 : wKind === 'snow' ? 1.25 : 1.0;
    const isConversing = Boolean(state.dialogueFocus?.active);

    p.torsoPivot.rotation.x = state.lungeTimer > 0 ? 0.24 : moving ? 0.09 * state.moveSpeedFrac : Math.sin(state.time * 2.4) * 0.025;
    p.headPivot.rotation.x = state.lungeTimer > 0 ? -0.14 : isConversing ? Math.sin(state.time * 3.2) * 0.09 : 0;
    p.headPivot.rotation.y = isConversing ? Math.sin(state.time * 1.9) * 0.11 : 0;

    if (state.slashArcTimer > 0) {
      // Dynamic 3D sweeping sword slash arc!
      const prog = 1 - Math.min(1, state.slashArcTimer / 0.20);
      p.armRPivot.rotation.set(-1.35 + prog * 1.15, -1.1 + prog * 2.35, -0.35);
      p.armLPivot.rotation.set(-0.55, 0.35, 0.22);
      p.torsoPivot.rotation.y = -0.35 + prog * 0.75;
    } else if (isConversing) {
      p.torsoPivot.rotation.y = Math.sin(state.time * 1.8) * 0.06;
      p.armLPivot.rotation.set(-0.46 + Math.sin(state.time * 3.4) * 0.14, 0.18, 0.14);
      p.armRPivot.rotation.set(-0.34 - Math.sin(state.time * 3.4) * 0.12, -0.1, -0.12);
    } else {
      p.torsoPivot.rotation.y = moving ? Math.sin(state.walkAnim) * 0.08 * state.moveSpeedFrac : 0;
      p.armLPivot.rotation.set(-stride * 0.75 - 0.18, 0.12, 0.12);
      p.armRPivot.rotation.set(stride * 0.75 - 0.12, 0, -0.12);
    }

    if (p.capePivot) {
      p.capePivot.rotation.x =
        0.12 + state.moveSpeedFrac * 0.48 + (state.lungeTimer > 0 ? 0.34 : 0) + Math.sin(state.time * 5.2 * Math.sqrt(windMult)) * 0.065 * windMult;
    }
    if (p.hairBackPivot) {
      p.hairBackPivot.rotation.x =
        0.08 + state.moveSpeedFrac * 0.24 + Math.sin(state.time * 4.4 * Math.sqrt(windMult)) * 0.045 * windMult;
    }

    r.xrayFootRing.scale.setScalar(1 + Math.sin(state.time * 4.2) * 0.1);

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
    if (this.weatherRainLines) {
      this.weatherRainLines.geometry.dispose();
      (this.weatherRainLines.material as THREE.Material).dispose();
    }
    if (this.weatherSnowPoints) {
      this.weatherSnowPoints.geometry.dispose();
      (this.weatherSnowPoints.material as THREE.Material).dispose();
    }
    for (const rp of this.rainRipples) {
      (rp.mesh.material as THREE.Material).dispose();
    }
    for (const cg of this.cloudGeos) cg.dispose();
    this.cloudGeos = [];
    this.cloudCoreMat?.dispose();
    this.cloudShadeMat?.dispose();
    this.cloudShadowGeo?.dispose();
    this.cloudShadowMat?.dispose();
    this.cloudShadowTex?.dispose();
    for (const m of this.adolRig.parts.ownedMaterials) m.dispose();
    for (const t of this.adolRig.parts.ownedTextures) t.dispose();
    this.adolRig.xrayMat.dispose();
    (this.adolRig.xrayFootRing.material as THREE.Material).dispose();
    for (const tex of Object.values(this.archTextures)) tex.dispose();
    this.gpuSparks.dispose();
    this.envTexture.dispose();
    for (const tex of Object.values(this.textures)) tex.dispose();
    this.renderer.dispose();
  }
}

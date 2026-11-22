import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { WorldNpc, ZoneDef } from './ysWorldBuilder';

// ============================================================================
// MODERN EVO THREE.JS WEBGL + GPU PHYSICS ENGINE FOR YS BOOK I & II
// - Real PBR Metallic/Roughness materials + RoomEnvironment IBL reflections
// - Real-time PCFSoftShadowMap dynamic sunlight & flickering dungeon torchlight
// - GPU Vertex-Shader foliage/grass wind + live radial player-push bending
// - GPU Gerstner wave water / molten lava / cloud-sea surface displacement
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

export interface YsThreeRenderState {
  zone: ZoneDef;
  time: number;
  camX: number;
  camY: number;
  screenShake: number;
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
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  torso: THREE.Mesh;
  leftPauldron: THREE.Mesh;
  rightPauldron: THREE.Mesh;
  capeSegs: THREE.Mesh[];
  swordArm: THREE.Group;
  swordBlade: THREE.Mesh;
  shieldArm: THREE.Group;
  shieldBody: THREE.Mesh;
  slashArc: THREE.Mesh;
  healRing: THREE.Mesh;
  shieldDome: THREE.Mesh;
}

interface EnemyRig {
  root: THREE.Group;
  body: THREE.Group;
  kind: YsThreeEnemyView['kind'];
  wingL?: THREE.Mesh;
  wingR?: THREE.Mesh;
  halo?: THREE.Mesh;
  bossCircle?: THREE.Mesh;
  weaponGlow?: THREE.Mesh;
  materials: THREE.MeshStandardMaterial[];
  baseEmissives: THREE.Color[];
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
// Procedural High-Detail Modern-Evo PBR Canvas Textures (Zero External Assets!)
// ----------------------------------------------------------------------------
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
  } else if (kind === 'roof_red' || kind === 'roof_blue') {
    const isBlue = kind === 'roof_blue';
    ctx.fillStyle = isBlue ? '#1d4ed8' : '#991b1b';
    ctx.fillRect(0, 0, size, size);
    for (let row = 0; row < 8; row++) {
      const off = (row % 2) * 16;
      for (let col = -1; col < 5; col++) {
        const sx = col * 32 + off;
        const sy = row * 16;
        const n = hash2d(col + 3, row, 83);
        ctx.fillStyle = isBlue
          ? n < 0.5
            ? '#2563eb'
            : '#3b82f6'
          : n < 0.5
            ? '#b91c1c'
            : '#dc2626';
        ctx.fillRect(sx + 1, sy + 1, 30, 13);
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.fillRect(sx + 1, sy + 13, 30, 3);
      }
    }
  } else if (kind === 'cliff') {
    ctx.fillStyle = '#5b5346';
    ctx.fillRect(0, 0, size, size);
    for (let row = 0; row < 6; row++) {
      const y = row * 22;
      ctx.fillStyle = row % 2 === 0 ? '#6e6454' : '#4a4338';
      ctx.fillRect(0, y, size, 20);
      for (let col = 0; col < 5; col++) {
        const n = hash2d(col, row, 97);
        ctx.fillStyle = n > 0.5 ? '#847864' : '#3d372e';
        ctx.fillRect(col * 28 + (row % 2) * 10, y + 3, 22, 12);
      }
    }
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
      float heightFactor = clamp(position.y, 0.0, 2.5);
      float swayX = sin(uTime * 2.2 + ysWorldPos.x * 0.7 + ysWorldPos.z * 0.5) * uWindStr * heightFactor;
      float swayZ = cos(uTime * 1.8 + ysWorldPos.z * 0.6 - ysWorldPos.x * 0.4) * uWindStr * 0.7 * heightFactor;
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
  waveAmp: number
): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shared.uTime;
    shader.uniforms.uWaveAmp = { value: waveAmp };

    shader.vertexShader =
      `uniform float uTime;
uniform float uWaveAmp;
varying vec3 vYsWavePos;
` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vec4 wPos = modelMatrix * vec4(transformed, 1.0);
      float w1 = sin(wPos.x * 1.4 + uTime * 2.6) * cos(wPos.z * 1.1 + uTime * 1.9);
      float w2 = sin((wPos.x - wPos.z) * 2.1 - uTime * 3.1) * 0.5;
      transformed.y += (w1 + w2) * uWaveAmp;
      vYsWavePos = wPos.xyz;
      `
    );

    shader.fragmentShader =
      `uniform float uTime;
varying vec3 vYsWavePos;
` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      float caustic = sin(vYsWavePos.x * 3.1 + uTime * 2.8) * cos(vYsWavePos.z * 2.9 - uTime * 2.3);
      diffuseColor.rgb += vec3(0.14, 0.20, 0.24) * smoothstep(0.45, 0.95, caustic);
      `
    );
  };
  mat.customProgramCacheKey = () => `ys_water_${waveAmp}`;
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

  // Shared procedural textures
  private readonly textures: Record<string, THREE.CanvasTexture> = {};

  // Dynamic Scene Groups
  private zoneGroup: THREE.Group | null = null;
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
      preserveDrawingBuffer: false,
    });
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.domElement = this.renderer.domElement;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#132238');
    this.scene.fog = new THREE.FogExp2('#132238', 0.018);

    // Slight Front-Angled Modern Evo 3D Perspective Camera (~42° pitch)
    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.2, 160);

    // Mandatory Studio IBL Reflections (RoomEnvironment via PMREMGenerator)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTexture;
    pmrem.dispose();

    // 3-Point Warm/Cool Lighting Rig + Real-time Shadows + Hero Dungeon Torch!
    this.hemiLight = new THREE.HemisphereLight('#bae6fd', '#3a4a2c', 0.85);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight('#fff3d6', 2.0);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 52;
    const d = 14.5;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.025;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.rimLight = new THREE.DirectionalLight('#7dd3fc', 0.55);
    this.rimLight.position.set(-14, 10, -12);
    this.scene.add(this.rimLight);

    this.heroTorchLight = new THREE.PointLight('#ffbd73', 0, 12, 1.8);
    this.scene.add(this.heroTorchLight);

    // Pre-generate crisp modern procedural PBR textures
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
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
      'cliff',
      'bark',
      'wood',
    ] as const;
    for (const k of texKinds) {
      this.textures[k] = createProceduralTexture(k, maxAniso);
    }

    // Build Composite 14-part 3D Hero Adol Christin
    this.adolRig = this.buildAdolRig();
    this.scene.add(this.adolRig.root);

    // GPU Ballistic Spark Pool + Dynamic 3D VFX Pools
    this.gpuSparks = new GpuBallisticSparkPool(this.sharedUniforms);
    this.scene.add(this.gpuSparks.points);
    this.scene.add(this.dynamicVfxGroup);
    this.initDynamicVfxPools();
  }

  public spawnGpuBurst(wx: number, wy: number, color: string, count = 16, speed = 3.8): void {
    this.gpuSparks.spawnBurst(wx / YS_WORLD_TILE, 0.55, wy / YS_WORLD_TILE, color, count, this.sharedUniforms.uTime.value, speed);
  }

  public projectWorldToScreen(wx: number, wy: number, heightY = 0.9): { x: number; y: number; visible: boolean } {
    _vec3.set(wx / YS_WORLD_TILE, heightY, wy / YS_WORLD_TILE);
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
  // Composite 14-Part 3D Articulated Hero — Adol Christin!
  // --------------------------------------------------------------------------
  private buildAdolRig(): AdolRig {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);

    // Contact grounding shadow disc under boots
    const shadowDisc = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 16),
      new THREE.MeshBasicMaterial({ color: '#020617', transparent: true, opacity: 0.36, depthWrite: false })
    );
    shadowDisc.rotation.x = -Math.PI * 0.5;
    shadowDisc.position.y = 0.02;
    root.add(shadowDisc);

    // Articulated Armored Boots & Greaves
    const bootMat = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.55, roughness: 0.42 });
    const legGeo = new THREE.CapsuleGeometry(0.1, 0.24, 4, 8);
    const leftLeg = new THREE.Mesh(legGeo, bootMat);
    leftLeg.position.set(-0.13, 0.22, 0);
    leftLeg.castShadow = !this.isSoftwareGl;
    const rightLeg = new THREE.Mesh(legGeo, bootMat);
    rightLeg.position.set(0.13, 0.22, 0);
    rightLeg.castShadow = !this.isSoftwareGl;
    body.add(leftLeg, rightLeg);

    // Metallic Plate Cuirass Torso (upgrades material live with armorTier!)
    const torsoMat = new THREE.MeshStandardMaterial({
      color: '#cbd5e1',
      metalness: 0.82,
      roughness: 0.22,
    });
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.5, 10), torsoMat);
    torso.position.y = 0.62;
    torso.castShadow = !this.isSoftwareGl;
    body.add(torso);

    // Leather Belt + Golden Buckle
    const belt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.265, 0.265, 0.09, 10),
      new THREE.MeshStandardMaterial({ color: '#5c2d10', roughness: 0.78 })
    );
    belt.position.y = 0.43;
    body.add(belt);
    const buckle = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.09, 0.06),
      new THREE.MeshStandardMaterial({ color: '#facc15', metalness: 0.9, roughness: 0.18 })
    );
    buckle.position.set(0, 0.43, 0.25);
    body.add(buckle);

    // Sculpted Shoulder Pauldrons
    const pauldronGeo = new THREE.SphereGeometry(0.13, 10, 8);
    const pauldronMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.88, roughness: 0.18 });
    const leftPauldron = new THREE.Mesh(pauldronGeo, pauldronMat);
    leftPauldron.position.set(-0.29, 0.8, 0);
    leftPauldron.castShadow = !this.isSoftwareGl;
    const rightPauldron = new THREE.Mesh(pauldronGeo, pauldronMat);
    rightPauldron.position.set(0.29, 0.8, 0);
    rightPauldron.castShadow = !this.isSoftwareGl;
    body.add(leftPauldron, rightPauldron);

    // 3-Segment Billowing Crimson Adventurer Cloak (animated spring flutter!)
    const capeMat = new THREE.MeshStandardMaterial({
      color: '#dc2626',
      roughness: 0.75,
      side: THREE.DoubleSide,
    });
    const capeSegs: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.46 + i * 0.06, 0.24, 0.04), capeMat);
      seg.position.set(0, 0.72 - i * 0.2, -0.22 - i * 0.06);
      seg.castShadow = !this.isSoftwareGl;
      body.add(seg);
      capeSegs.push(seg);
    }

    // Sculpted Head + Expressive Eyes + 7-Lock Spiky Crimson Hair Crown!
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.21, 14, 12),
      new THREE.MeshStandardMaterial({ color: '#ffdbb8', roughness: 0.65 })
    );
    head.position.y = 1.07;
    head.castShadow = !this.isSoftwareGl;
    body.add(head);

    const eyeMat = new THREE.MeshBasicMaterial({ color: '#0f172a' });
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.06, 0.02), eyeMat);
    eyeL.position.set(-0.07, 1.07, 0.195);
    const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.06, 0.02), eyeMat);
    eyeR.position.set(0.07, 1.07, 0.195);
    body.add(eyeL, eyeR);

    const hairMat = new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.42, metalness: 0.08 });
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), hairMat);
    hairCap.position.set(0, 1.1, -0.02);
    body.add(hairCap);
    const spikeGeo = new THREE.ConeGeometry(0.085, 0.28, 5);
    const spikeSpecs: Array<[number, number, number, number, number]> = [
      [0, 1.29, 0.06, 0.25, 0],
      [-0.14, 1.24, 0.02, 0.1, 0.55],
      [0.14, 1.24, 0.02, 0.1, -0.55],
      [-0.16, 1.15, -0.1, -0.45, 0.72],
      [0.16, 1.15, -0.1, -0.45, -0.72],
      [0, 1.18, -0.18, -0.78, 0],
      [0, 1.21, 0.16, 0.72, 0],
    ];
    for (const [sx, sy, sz, rx, rz] of spikeSpecs) {
      const sp = new THREE.Mesh(spikeGeo, hairMat);
      sp.position.set(sx, sy, sz);
      sp.rotation.set(rx, 0, rz);
      body.add(sp);
    }

    // Articulated Right Sword Arm + Upgrading Broadsword / Silver Sword / Flameblade!
    const swordArm = new THREE.Group();
    swordArm.position.set(0.32, 0.72, 0.06);
    const hilt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.032, 0.22, 6),
      new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.75 })
    );
    hilt.rotation.x = Math.PI * 0.5;
    hilt.position.z = 0.08;
    const guard = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.055, 0.055),
      new THREE.MeshStandardMaterial({ color: '#facc15', metalness: 0.9, roughness: 0.18 })
    );
    guard.position.z = 0.2;
    const swordBlade = new THREE.Mesh(
      new THREE.BoxGeometry(0.075, 0.026, 0.76),
      new THREE.MeshStandardMaterial({ color: '#f1f5f9', metalness: 0.95, roughness: 0.12 })
    );
    swordBlade.position.z = 0.58;
    swordBlade.castShadow = !this.isSoftwareGl;
    swordArm.add(hilt, guard, swordBlade);
    body.add(swordArm);

    // Articulated Left Shield Arm + Crimson-Crossed Metallic Kite Shield!
    const shieldArm = new THREE.Group();
    shieldArm.position.set(-0.34, 0.64, 0.12);
    const shieldBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.42, 0.07),
      new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.85, roughness: 0.2 })
    );
    const crossV = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.34, 0.085),
      new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.4 })
    );
    const crossH = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.08, 0.085),
      new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.4 })
    );
    crossH.position.y = 0.05;
    shieldBody.castShadow = !this.isSoftwareGl;
    shieldArm.add(shieldBody, crossV, crossH);
    body.add(shieldArm);

    // Dynamic Sword Slash Crescent Arc Mesh
    const slashArc = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 1.05, 16, 1, -0.85, 1.7),
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
    slashArc.rotation.z = -Math.PI * 0.5;
    slashArc.position.y = 0.68;
    body.add(slashArc);

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
      leftLeg,
      rightLeg,
      torso,
      leftPauldron,
      rightPauldron,
      capeSegs,
      swordArm,
      swordBlade,
      shieldArm,
      shieldBody,
      slashArc,
      healRing,
      shieldDome,
    };
  }

  // --------------------------------------------------------------------------
  // Composite 3D Articulated NPCs & Monsters/Bosses
  // --------------------------------------------------------------------------
  private buildNpcRig(npc: WorldNpc): NpcRig {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.38, 14),
      new THREE.MeshBasicMaterial({ color: '#020617', transparent: true, opacity: 0.32, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI * 0.5;
    shadow.position.y = 0.02;
    root.add(shadow);

    const cloak = new THREE.Mesh(
      new THREE.ConeGeometry(0.32, 0.72, 10),
      new THREE.MeshStandardMaterial({ color: npc.cloakColor, roughness: 0.72 })
    );
    cloak.position.y = 0.36;
    cloak.castShadow = !this.isSoftwareGl;
    body.add(cloak);

    const tunic = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.24, 0.44, 10),
      new THREE.MeshStandardMaterial({ color: npc.tunicColor, roughness: 0.65 })
    );
    tunic.position.y = 0.62;
    tunic.castShadow = !this.isSoftwareGl;
    body.add(tunic);

    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.045, 6, 12),
      new THREE.MeshStandardMaterial({ color: '#fde68a', metalness: 0.5, roughness: 0.35 })
    );
    collar.rotation.x = Math.PI * 0.5;
    collar.position.y = 0.84;
    body.add(collar);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.19, 12, 10),
      new THREE.MeshStandardMaterial({ color: '#fed7aa', roughness: 0.65 })
    );
    head.position.y = 1.03;
    head.castShadow = !this.isSoftwareGl;
    body.add(head);

    const eyeMat = new THREE.MeshBasicMaterial({ color: '#0f172a' });
    const eL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.02), eyeMat);
    eL.position.set(-0.06, 1.03, 0.175);
    const eR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.02), eyeMat);
    eR.position.set(0.06, 1.03, 0.175);
    body.add(eL, eR);

    const hairMat = new THREE.MeshStandardMaterial({ color: npc.hairColor, roughness: 0.45 });
    const hairTop = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.68), hairMat);
    hairTop.position.set(0, 1.05, -0.02);
    body.add(hairTop);

    // Flowing long hair for Feena / Lilia / Sara, or Elder wooden staff!
    if (npc.portrait === 'feena' || npc.portrait === 'lilia' || npc.portrait === 'sara') {
      const longHair = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.52, 0.16), hairMat);
      longHair.position.set(0, 0.82, -0.14);
      body.add(longHair);
    } else if (npc.portrait === 'elder') {
      const staff = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.035, 1.25, 6),
        new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.8 })
      );
      staff.position.set(0.3, 0.62, 0.1);
      const orb = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.09),
        new THREE.MeshStandardMaterial({ color: '#38bdf8', emissive: '#38bdf8', emissiveIntensity: 1.5 })
      );
      orb.position.set(0.3, 1.28, 0.1);
      body.add(staff, orb);
    }

    root.position.set(npc.tx + 0.5, 0, npc.ty + 0.5);
    return { root, body, baseY: 0 };
  }

  private buildEnemyRig(e: YsThreeEnemyView, isDungeon: boolean): EnemyRig {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    const scale = e.kind === 'boss' ? 2.15 : 1.0;
    body.scale.setScalar(scale);

    const materials: THREE.MeshStandardMaterial[] = [];
    const baseEmissives: THREE.Color[] = [];
    const trackMat = (m: THREE.MeshStandardMaterial) => {
      materials.push(m);
      baseEmissives.push(m.emissive.clone());
      return m;
    };

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(e.kind === 'boss' ? 0.95 : 0.42, 16),
      new THREE.MeshBasicMaterial({ color: '#020617', transparent: true, opacity: 0.36, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI * 0.5;
    shadow.position.y = 0.02;
    root.add(shadow);

    let wingL: THREE.Mesh | undefined;
    let wingR: THREE.Mesh | undefined;
    let halo: THREE.Mesh | undefined;
    let bossCircle: THREE.Mesh | undefined;
    let weaponGlow: THREE.Mesh | undefined;

    if (e.kind === 'slime') {
      const slimeMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: e.color,
          emissive: '#064e3b',
          emissiveIntensity: 0.25,
          roughness: 0.14,
          metalness: 0.1,
          transparent: true,
          opacity: 0.88,
        })
      );
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.65), slimeMat);
      dome.position.y = 0.12;
      dome.castShadow = !this.isSoftwareGl;
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 10, 8),
        new THREE.MeshStandardMaterial({ color: '#bef264', emissive: '#84cc16', emissiveIntensity: 0.9 })
      );
      core.position.y = 0.24;
      const eyeMat = new THREE.MeshBasicMaterial({ color: '#0f172a' });
      const eL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), eyeMat);
      eL.position.set(-0.12, 0.32, 0.28);
      const eR = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), eyeMat);
      eR.position.set(0.12, 0.32, 0.28);
      body.add(dome, core, eL, eR);
    } else if (e.kind === 'wyvern') {
      const hideMat = trackMat(new THREE.MeshStandardMaterial({ color: e.color, roughness: 0.45, metalness: 0.2 }));
      const bellyMat = trackMat(new THREE.MeshStandardMaterial({ color: e.accent, roughness: 0.55 }));
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.4, 6, 10), hideMat);
      torso.position.y = 0.85;
      torso.rotation.x = 0.35;
      torso.castShadow = !this.isSoftwareGl;
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.42, 6), hideMat);
      head.position.set(0, 1.15, 0.32);
      head.rotation.x = Math.PI * 0.5;
      const wingGeo = new THREE.BoxGeometry(0.75, 0.04, 0.42);
      wingL = new THREE.Mesh(wingGeo, bellyMat);
      wingL.position.set(-0.48, 0.95, 0);
      wingL.castShadow = !this.isSoftwareGl;
      wingR = new THREE.Mesh(wingGeo, bellyMat);
      wingR.position.set(0.48, 0.95, 0);
      wingR.castShadow = !this.isSoftwareGl;
      body.add(torso, head, wingL, wingR);
    } else {
      // Composite Armored Goblin / Dark Knight / Warlock / Towering Multi-Part Boss!
      const armorMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: e.color,
          metalness: e.kind === 'knight' || e.kind === 'boss' ? 0.82 : 0.35,
          roughness: e.kind === 'knight' || e.kind === 'boss' ? 0.26 : 0.62,
        })
      );
      const trimMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: e.accent,
          metalness: 0.72,
          roughness: 0.28,
        })
      );

      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 0.62, 8), armorMat);
      torso.position.y = 0.48;
      torso.castShadow = !this.isSoftwareGl;
      const helm = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), armorMat);
      helm.position.y = 0.96;
      helm.castShadow = !this.isSoftwareGl;
      const hornGeo = new THREE.ConeGeometry(0.065, 0.32, 5);
      const hL = new THREE.Mesh(hornGeo, trimMat);
      hL.position.set(-0.2, 1.16, 0);
      hL.rotation.z = 0.45;
      const hR = new THREE.Mesh(hornGeo, trimMat);
      hR.position.set(0.2, 1.16, 0);
      hR.rotation.z = -0.45;
      const pL = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), trimMat);
      pL.position.set(-0.32, 0.74, 0);
      const pR = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), trimMat);
      pR.position.set(0.32, 0.74, 0);

      // Glowing yellow/crimson eyes
      const eyeMat = new THREE.MeshBasicMaterial({ color: e.kind === 'boss' ? '#f43f5e' : '#fde047' });
      const eL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.045, 0.04), eyeMat);
      eL.position.set(-0.08, 0.96, 0.21);
      const eR = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.045, 0.04), eyeMat);
      eR.position.set(0.08, 0.96, 0.21);

      // Weapon (Glowing Sapphire Magic Blade in Dungeons!)
      const bladeMat = new THREE.MeshStandardMaterial({
        color: isDungeon ? '#bae6fd' : '#e2e8f0',
        emissive: isDungeon ? '#38bdf8' : '#000000',
        emissiveIntensity: isDungeon ? 1.85 : 0,
        metalness: 0.9,
        roughness: 0.15,
      });
      weaponGlow = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.85), bladeMat);
      weaponGlow.position.set(0.36, 0.56, 0.42);
      weaponGlow.castShadow = !this.isSoftwareGl;

      body.add(torso, helm, hL, hR, pL, pR, eL, eR, weaponGlow);

      if (e.kind === 'mage' || e.kind === 'boss') {
        halo = new THREE.Mesh(
          new THREE.TorusGeometry(e.kind === 'boss' ? 0.52 : 0.4, 0.035, 8, 24),
          new THREE.MeshBasicMaterial({ color: e.accent, transparent: true, opacity: 0.82 })
        );
        halo.rotation.x = Math.PI * 0.5;
        halo.position.y = e.kind === 'boss' ? 1.38 : 0.85;
        body.add(halo);
      }

      if (e.kind === 'boss') {
        bossCircle = new THREE.Mesh(
          new THREE.RingGeometry(1.05, 1.38, 24),
          new THREE.MeshBasicMaterial({
            color: e.accent,
            transparent: true,
            opacity: 0.55,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        );
        bossCircle.rotation.x = -Math.PI * 0.5;
        bossCircle.position.y = 0.05;
        root.add(bossCircle);
      }
    }

    root.position.set(e.x / YS_WORLD_TILE, 0, e.y / YS_WORLD_TILE);
    return { root, body, kind: e.kind, wingL, wingR, halo, bossCircle, weaponGlow, materials, baseEmissives };
  }

  // --------------------------------------------------------------------------
  // Rebuild Full 3D Modern Evo World When Entering a New Zone!
  // --------------------------------------------------------------------------
  private rebuildZoneScene(zone: ZoneDef): void {
    this.clearZoneScene();
    this.currentZoneId = zone.id;
    this.currentZoneTheme = zone.theme;
    const g = new THREE.Group();
    this.zoneGroup = g;
    this.scene.add(g);

    const W = zone.width;
    const H = zone.height;
    const isDungeon = zone.theme === 'shrine' || zone.theme === 'tower' || zone.theme === 'lava';

    // Theme-Matched Atmospheric Lighting, Sky & Horizon Fog
    if (zone.theme === 'shrine') {
      this.scene.background = new THREE.Color('#050814');
      this.scene.fog = new THREE.FogExp2('#050814', 0.052);
      this.hemiLight.color.set('#38bdf8');
      this.hemiLight.groundColor.set('#0f172a');
      this.hemiLight.intensity = 0.42;
      this.sunLight.color.set('#93c5fd');
      this.sunLight.intensity = 0.65;
    } else if (zone.theme === 'tower' || zone.theme === 'lava') {
      this.scene.background = new THREE.Color('#12060c');
      this.scene.fog = new THREE.FogExp2('#12060c', 0.048);
      this.hemiLight.color.set('#fb923c');
      this.hemiLight.groundColor.set('#1f0a12');
      this.hemiLight.intensity = 0.48;
      this.sunLight.color.set('#fdba74');
      this.sunLight.intensity = 0.72;
    } else if (zone.theme === 'ice') {
      this.scene.background = new THREE.Color('#9ecce8');
      this.scene.fog = new THREE.FogExp2('#9ecce8', 0.017);
      this.hemiLight.color.set('#e0f2fe');
      this.hemiLight.groundColor.set('#475569');
      this.hemiLight.intensity = 1.05;
      this.sunLight.color.set('#ffffff');
      this.sunLight.intensity = 2.05;
    } else if (zone.theme === 'village') {
      this.scene.background = new THREE.Color('#6dbbf2');
      this.scene.fog = new THREE.FogExp2('#6dbbf2', 0.014);
      this.hemiLight.color.set('#bae6fd');
      this.hemiLight.groundColor.set('#3a6e43');
      this.hemiLight.intensity = 0.98;
      this.sunLight.color.set('#fff7de');
      this.sunLight.intensity = 2.15;
    } else {
      // Minea Town / Esteria Plains / Ruins of Moondoria — warm golden Mediterranean afternoon!
      this.scene.background = new THREE.Color('#5a98c8');
      this.scene.fog = new THREE.FogExp2('#6fa5ce', 0.014);
      this.hemiLight.color.set('#c7e7ff');
      this.hemiLight.groundColor.set('#3f5b2e');
      this.hemiLight.intensity = 0.92;
      this.sunLight.color.set('#fff2d1');
      this.sunLight.intensity = 2.1;
    }

    // 1. Extended Surrounding Terrain Apron (so outdoor worlds extend naturally into horizon fog!)
    const groundTexKey =
      zone.theme === 'town'
        ? 'meadow'
        : zone.theme === 'village'
          ? 'village'
          : zone.theme === 'plains' || zone.theme === 'ruins'
            ? 'plains'
            : zone.theme === 'shrine'
              ? 'mine'
              : zone.theme === 'tower' || zone.theme === 'lava'
                ? 'tower'
                : 'ice';

    const baseGroundTex = this.textures[groundTexKey].clone();
    baseGroundTex.needsUpdate = true;
    baseGroundTex.repeat.set((W + 40) * 0.45, (H + 40) * 0.45);
    const groundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(W + 40, H + 40),
      new THREE.MeshStandardMaterial({
        map: baseGroundTex,
        roughness: zone.theme === 'ice' ? 0.28 : 0.88,
        metalness: zone.theme === 'ice' ? 0.15 : 0.02,
      })
    );
    groundMesh.rotation.x = -Math.PI * 0.5;
    groundMesh.position.set(W * 0.5, 0, H * 0.5);
    groundMesh.receiveShadow = true;
    g.add(groundMesh);

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

    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        const t = zone.tiles[r][c];
        if (t === 6) roadTiles.push([c, r]);
        else if (t === 4) bridgeTiles.push([c, r]);
        else if (t === 3) waterTiles.push([c, r]);
        else if (t === 1) {
          const hasRoofAbove = r > 0 && zone.tiles[r - 1][c] === 5;
          if ((zone.theme === 'town' || zone.theme === 'village') && hasRoofAbove) {
            cottageWallTiles.push([c, r]);
          } else {
            cliffTiles.push([c, r]);
          }
        } else if (t === 5) roofTiles.push([c, r]);
        else if (t === 2) treeTiles.push([c, r, false]);
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

    // 2A. Raised Cobblestone Roads / Royal Temple Carpets (offset +0.025Y to avoid Z-fighting!)
    if (roadTiles.length > 0) {
      const roadTex = isDungeon ? this.textures.carpet : this.textures.cobble;
      const roadMat = new THREE.MeshStandardMaterial({
        map: roadTex,
        roughness: isDungeon ? 0.85 : 0.78,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      });
      const roadGeo = new THREE.BoxGeometry(1.02, 0.05, 1.02);
      const roadInst = new THREE.InstancedMesh(roadGeo, roadMat, roadTiles.length);
      roadInst.receiveShadow = true;
      roadTiles.forEach(([c, r], i) => {
        _dummy.position.set(c + 0.5, 0.015, r + 0.5);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        roadInst.setMatrixAt(i, _dummy.matrix);
      });
      roadInst.computeBoundingSphere();
      g.add(roadInst);
    }

    // 2B. Wooden Plank Bridges / Ice Walkways with Side Rails!
    if (bridgeTiles.length > 0) {
      const bMat = new THREE.MeshStandardMaterial({
        map: zone.theme === 'ice' ? this.textures.ice : this.textures.wood,
        roughness: zone.theme === 'ice' ? 0.2 : 0.75,
      });
      const bInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1.04, 0.16, 1.04), bMat, bridgeTiles.length);
      bInst.receiveShadow = true;
      bInst.castShadow = !this.isSoftwareGl;
      bridgeTiles.forEach(([c, r], i) => {
        _dummy.position.set(c + 0.5, 0.06, r + 0.5);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        bInst.setMatrixAt(i, _dummy.matrix);
      });
      bInst.computeBoundingSphere();
      g.add(bInst);
    }

    // 2C. GPU Gerstner-Wave Animated Water / Molten Lava / Floating Sky Sea!
    if (waterTiles.length > 0) {
      const isLava = zone.theme === 'tower' || zone.theme === 'lava';
      const isSky = zone.theme === 'village';
      const waterMat = new THREE.MeshPhysicalMaterial({
        color: isLava ? '#ea580c' : isSky ? '#38bdf8' : '#0284c7',
        emissive: isLava ? '#9a3412' : '#042f4b',
        emissiveIntensity: isLava ? 1.35 : 0.28,
        roughness: isLava ? 0.35 : 0.1,
        metalness: isLava ? 0.1 : 0.25,
        clearcoat: 1.0,
        clearcoatRoughness: 0.12,
      });
      attachGpuWaterPhysics(waterMat, this.sharedUniforms, isLava ? 0.06 : 0.08);
      const waterGeo = new THREE.PlaneGeometry(1.04, 1.04, 2, 2);
      waterGeo.rotateX(-Math.PI * 0.5);
      const waterInst = new THREE.InstancedMesh(waterGeo, waterMat, waterTiles.length);
      waterInst.receiveShadow = true;
      waterTiles.forEach(([c, r], i) => {
        _dummy.position.set(c + 0.5, -0.1, r + 0.5);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        waterInst.setMatrixAt(i, _dummy.matrix);
      });
      waterInst.computeBoundingSphere();
      g.add(waterInst);
    }

    // 2D. Stratified 3D Cliffs / Castle Ramparts / Dungeon Ashlar Walls (Instanced Multi-Layer!)
    if (cliffTiles.length > 0) {
      const isTownWall = zone.theme === 'town' || zone.theme === 'village';
      const wallH = isTownWall ? 1.65 : isDungeon ? 2.15 : 1.9;
      const wallMat = new THREE.MeshStandardMaterial({
        map: zone.theme === 'ice' ? this.textures.ice : isDungeon ? this.textures.mine : this.textures.cliff,
        color: zone.theme === 'tower' || zone.theme === 'lava' ? '#6b2c4e' : isTownWall ? '#b6aba0' : '#ffffff',
        roughness: zone.theme === 'ice' ? 0.22 : 0.84,
      });
      const capMat = new THREE.MeshStandardMaterial({
        map:
          zone.theme === 'ice'
            ? this.textures.ice
            : isDungeon
              ? this.textures.mine
              : isTownWall
                ? this.textures.cobble
                : this.textures.meadow,
        color: zone.theme === 'tower' || zone.theme === 'lava' ? '#581c36' : '#ffffff',
        roughness: 0.85,
      });
      const wallInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1.02, wallH, 1.02), wallMat, cliffTiles.length);
      const capInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1.08, 0.24, 1.08), capMat, cliffTiles.length);
      wallInst.castShadow = !this.isSoftwareGl;
      wallInst.receiveShadow = true;
      capInst.castShadow = !this.isSoftwareGl;
      capInst.receiveShadow = true;

      cliffTiles.forEach(([c, r], i) => {
        const hJitter = 0.92 + hash2d(c, r, 401) * 0.24;
        _dummy.position.set(c + 0.5, (wallH * hJitter) * 0.5, r + 0.5);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(1, hJitter, 1);
        _dummy.updateMatrix();
        wallInst.setMatrixAt(i, _dummy.matrix);

        _dummy.position.set(c + 0.5, wallH * hJitter + 0.08, r + 0.5);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        capInst.setMatrixAt(i, _dummy.matrix);
      });
      wallInst.computeBoundingSphere();
      capInst.computeBoundingSphere();
      g.add(wallInst, capInst);
    }

    // 2E. Half-Timbered Medieval Town Cottages (Walls + Glowing Windows + Sloped Shingle Roofs + Chimneys!)
    if (cottageWallTiles.length > 0) {
      const wallMat = new THREE.MeshStandardMaterial({ map: this.textures.plaster, roughness: 0.78 });
      const winMat = new THREE.MeshStandardMaterial({
        color: '#fef08a',
        emissive: '#f59e0b',
        emissiveIntensity: 1.25,
        roughness: 0.2,
      });
      const wallInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1.02, 1.48, 1.02), wallMat, cottageWallTiles.length);
      const winInst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.42, 0.06), winMat, cottageWallTiles.length);
      wallInst.castShadow = !this.isSoftwareGl;
      wallInst.receiveShadow = true;
      cottageWallTiles.forEach(([c, r], i) => {
        _dummy.position.set(c + 0.5, 0.74, r + 0.5);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        wallInst.setMatrixAt(i, _dummy.matrix);

        _dummy.position.set(c + 0.5, 0.86, r + 1.02);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        winInst.setMatrixAt(i, _dummy.matrix);
      });
      wallInst.computeBoundingSphere();
      winInst.computeBoundingSphere();
      g.add(wallInst, winInst);
    }

    if (roofTiles.length > 0) {
      const roofTex = zone.theme === 'village' ? this.textures.roof_blue : this.textures.roof_red;
      const roofMat = new THREE.MeshStandardMaterial({ map: roofTex, roughness: 0.68 });
      const roofGeo = new THREE.BoxGeometry(1.12, 0.92, 1.12);
      const roofInst = new THREE.InstancedMesh(roofGeo, roofMat, roofTiles.length);
      roofInst.castShadow = !this.isSoftwareGl;
      roofInst.receiveShadow = true;

      const chimMat = new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.85 });
      const chimPositions: Array<[number, number]> = [];

      roofTiles.forEach(([c, r], i) => {
        _dummy.position.set(c + 0.5, 1.88, r + 0.5);
        _dummy.rotation.set(0.18, 0, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        roofInst.setMatrixAt(i, _dummy.matrix);
        if ((c * 7 + r * 11) % 9 === 0) chimPositions.push([c, r]);
      });
      roofInst.computeBoundingSphere();
      g.add(roofInst);

      if (chimPositions.length > 0) {
        const chimInst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.32, 0.72, 0.32), chimMat, chimPositions.length);
        chimInst.castShadow = !this.isSoftwareGl;
        chimPositions.forEach(([c, r], i) => {
          _dummy.position.set(c + 0.72, 2.48, r + 0.4);
          _dummy.rotation.set(0, 0, 0);
          _dummy.scale.set(1, 1, 1);
          _dummy.updateMatrix();
          chimInst.setMatrixAt(i, _dummy.matrix);
        });
        chimInst.computeBoundingSphere();
        g.add(chimInst);
      }
    }

    // 2F. Tall 3D Multi-Tiered Trees (with GPU Wind Sway!), Marble Columns, Glacial Spires & Obsidian Pillars!
    this.buildTreesAndColumns(g, zone.theme, treeTiles);

    // 2G. 900+ Instanced GPU-Bending Grass Blades & Wildflower Clusters across Open Terrain!
    if (!isDungeon && zone.theme !== 'ice' && openGrassTiles.length > 0) {
      this.buildGpuBendingMeadowGrass(g, zone.theme, openGrassTiles, flowerTiles);
    }

    // 2H. NEW Rich Modern-Evo Environment Objects: Market Stalls, Wagons, Street Lanterns, Banners, Boulders & Fences!
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

  private buildTreesAndColumns(g: THREE.Group, theme: ZoneDef['theme'], treeTiles: Array<[number, number, boolean]>): void {
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
        _dummy.position.set(c + 0.5, 1.25, r + 0.72);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        shaftInst.setMatrixAt(i, _dummy.matrix);
        _dummy.position.set(c + 0.5, 0.14, r + 0.72);
        _dummy.updateMatrix();
        baseInst.setMatrixAt(i, _dummy.matrix);
        _dummy.position.set(c + 0.5, 2.55, r + 0.72);
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
        const sc = 0.85 + hash2d(c, r, 511) * 0.35;
        _dummy.position.set(c + 0.5, 1.35 * sc, r + 0.72);
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

    // Lush Multi-Tiered 3D Oak / Cherry Blossom / Monumental Golden Roda Trees with GPU Wind Sway!
    const barkMat = new THREE.MeshStandardMaterial({ map: this.textures.bark, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.76 });
    attachGpuFoliagePhysics(leafMat, this.sharedUniforms, 0.055, 0.0);

    const trunkInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14, 0.24, 1.35, 7), barkMat, treeTiles.length);
    const crownLo = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.76, 1), leafMat, treeTiles.length);
    const crownHi = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.56, 1), leafMat, treeTiles.length);
    trunkInst.castShadow = !this.isSoftwareGl;
    crownLo.castShadow = !this.isSoftwareGl;
    crownLo.receiveShadow = true;
    crownHi.castShadow = !this.isSoftwareGl;

    treeTiles.forEach(([c, r, isRoda], i) => {
      const sc = isRoda ? 1.72 : 0.88 + hash2d(c, r, 521) * 0.28;
      const rot = hash2d(c, r, 522) * Math.PI * 2;
      _dummy.position.set(c + 0.5, 0.65 * sc, r + 0.72);
      _dummy.rotation.set(0, rot, 0);
      _dummy.scale.set(sc, sc, sc);
      _dummy.updateMatrix();
      trunkInst.setMatrixAt(i, _dummy.matrix);

      _dummy.position.set(c + 0.5, 1.55 * sc, r + 0.72);
      _dummy.scale.set(sc * 1.08, sc * 0.88, sc * 1.08);
      _dummy.updateMatrix();
      crownLo.setMatrixAt(i, _dummy.matrix);

      _dummy.position.set(c + 0.44, 2.08 * sc, r + 0.66);
      _dummy.scale.set(sc * 0.96, sc * 0.82, sc * 0.96);
      _dummy.updateMatrix();
      crownHi.setMatrixAt(i, _dummy.matrix);

      const isBlossom = theme === 'village' && (c + r) % 3 === 0;
      if (isRoda) {
        crownLo.setColorAt(i, _color.set('#10b981'));
        crownHi.setColorAt(i, _color.set('#facc15'));
      } else if (isBlossom) {
        crownLo.setColorAt(i, _color.set('#f472b6'));
        crownHi.setColorAt(i, _color.set('#fbcfe8'));
      } else {
        const tint = hash2d(c, r, 523);
        crownLo.setColorAt(i, _color.set(tint < 0.5 ? '#1b6d2c' : '#257d34'));
        crownHi.setColorAt(i, _color.set(tint < 0.5 ? '#3da345' : '#52b84e'));
      }
    });
    if (crownLo.instanceColor) crownLo.instanceColor.needsUpdate = true;
    if (crownHi.instanceColor) crownHi.instanceColor.needsUpdate = true;
    trunkInst.computeBoundingSphere();
    crownLo.computeBoundingSphere();
    crownHi.computeBoundingSphere();
    g.add(trunkInst, crownLo, crownHi);
  }

  // --------------------------------------------------------------------------
  // 900+ GPU-Bending Grass Blades & Wildflower Tufts (Bends Around Adol!)
  // --------------------------------------------------------------------------
  private buildGpuBendingMeadowGrass(
    g: THREE.Group,
    theme: ZoneDef['theme'],
    openTiles: Array<[number, number]>,
    flowerTiles: Array<[number, number]>
  ): void {
    const grassCount = Math.min(820, openTiles.length * 2);
    const bladeGeo = new THREE.ConeGeometry(0.065, 0.34, 3);
    bladeGeo.translate(0, 0.17, 0);
    const bladeMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.78 });
    attachGpuFoliagePhysics(bladeMat, this.sharedUniforms, 0.08, 0.42);

    const grassInst = new THREE.InstancedMesh(bladeGeo, bladeMat, grassCount);
    grassInst.receiveShadow = true;
    for (let i = 0; i < grassCount; i++) {
      const [c, r] = openTiles[Math.floor(hash2d(i, 1, 601) * openTiles.length)];
      const ox = hash2d(i, 2, 601) * 0.84 + 0.08;
      const oz = hash2d(i, 3, 601) * 0.84 + 0.08;
      const sc = 0.75 + hash2d(i, 4, 601) * 0.65;
      _dummy.position.set(c + ox, 0.0, r + oz);
      _dummy.rotation.set(0, hash2d(i, 5, 601) * Math.PI * 2, 0);
      _dummy.scale.set(sc, sc, sc);
      _dummy.updateMatrix();
      grassInst.setMatrixAt(i, _dummy.matrix);
      const t = hash2d(i, 6, 601);
      grassInst.setColorAt(
        i,
        _color.set(
          theme === 'plains'
            ? t < 0.5
              ? '#5b963d'
              : '#7ab54d'
            : t < 0.5
              ? '#3c8e3c'
              : '#67bd52'
        )
      );
    }
    if (grassInst.instanceColor) grassInst.instanceColor.needsUpdate = true;
    grassInst.computeBoundingSphere();
    g.add(grassInst);

    if (flowerTiles.length > 0) {
      const flCount = Math.min(220, flowerTiles.length * 3);
      const flGeo = new THREE.OctahedronGeometry(0.075, 0);
      flGeo.translate(0, 0.24, 0);
      const flMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.55 });
      attachGpuFoliagePhysics(flMat, this.sharedUniforms, 0.08, 0.35);
      const flInst = new THREE.InstancedMesh(flGeo, flMat, flCount);
      for (let i = 0; i < flCount; i++) {
        const [c, r] = flowerTiles[i % flowerTiles.length];
        _dummy.position.set(c + 0.15 + hash2d(i, 1, 619) * 0.7, 0, r + 0.15 + hash2d(i, 2, 619) * 0.7);
        _dummy.rotation.set(0, hash2d(i, 3, 619) * Math.PI, 0);
        _dummy.scale.setScalar(0.85 + hash2d(i, 4, 619) * 0.45);
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
        bannerGroup.position.set(bx, 0, bz);
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
        post.position.set(sideC + 0.5, 0, r + 0.5);
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
          _dummy.position.set(c + 0.5, 0.14 * sy, r + 0.5);
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
        fence.position.set(c + 0.5, 0, r + 0.5);
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
      grp.position.set(c + 0.5, 0.95, r + 0.5);
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

    stall.position.set(x, 0, z);
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

    wagon.position.set(x, 0, z);
    wagon.rotation.y = 0.25;
    g.add(wagon);
  }

  private buildBraziers(g: THREE.Group, brazierTiles: Array<[number, number]>): void {
    const ironMat = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.82, roughness: 0.34 });
    const flameMat = new THREE.MeshBasicMaterial({ color: '#facc15' });
    const emberMat = new THREE.MeshBasicMaterial({ color: '#f97316' });

    brazierTiles.forEach(([c, r], idx) => {
      const b = new THREE.Group();
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 0.68, 8), ironMat);
      stand.position.y = 0.34;
      stand.castShadow = !this.isSoftwareGl;
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.14, 0.2, 8), ironMat);
      bowl.position.y = 0.72;
      const flame = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), idx % 2 === 0 ? flameMat : emberMat);
      flame.position.y = 0.94;
      b.add(stand, bowl, flame);
      b.position.set(c + 0.5, 0, r + 0.5);
      g.add(b);
      this.fireFlames.push(flame);

      // Add up to 4 real flickering PointLights for rich dungeon/plaza lighting!
      if (this.brazierLights.length < 4) {
        const pl = new THREE.PointLight('#fb923c', 3.2, 8.5, 1.8);
        pl.position.set(c + 0.5, 1.35, r + 0.5);
        g.add(pl);
        this.brazierLights.push(pl);
      }
    });
  }

  private buildShrubs(g: THREE.Group, zone: ZoneDef): void {
    const colorMap: Record<string, [string, string]> = {
      berry: ['#15803d', '#ef4444'],
      fern: ['#047857', '#6ee7b7'],
      blossom: ['#16a34a', '#f472b6'],
      frost_bush: ['#0284c7', '#e0f2fe'],
      ember_fern: ['#991b1b', '#fb923c'],
    };

    for (const sh of zone.shrubs) {
      const [leafCol, dotCol] = colorMap[sh.variant] ?? ['#16a34a', '#fde047'];
      const grp = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: leafCol, roughness: 0.78 });
      attachGpuFoliagePhysics(mat, this.sharedUniforms, 0.04, 0.25);

      const core = new THREE.Mesh(new THREE.DodecahedronGeometry(0.36, 1), mat);
      core.position.y = 0.26;
      core.scale.set(1.15, 0.85, 1.15);
      core.castShadow = !this.isSoftwareGl;
      core.receiveShadow = true;
      const sideA = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), mat);
      sideA.position.set(-0.22, 0.2, 0.14);
      const sideB = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), mat);
      sideB.position.set(0.22, 0.2, -0.1);
      grp.add(core, sideA, sideB);

      // Decorative berries/blossoms
      const berryMat = new THREE.MeshStandardMaterial({ color: dotCol, roughness: 0.35 });
      for (let i = 0; i < 3; i++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), berryMat);
        b.position.set(Math.cos(i * 2.1) * 0.25, 0.34, Math.sin(i * 2.1) * 0.25);
        grp.add(b);
      }

      const sparkle = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.08, 0),
        new THREE.MeshBasicMaterial({ color: '#fef08a' })
      );
      sparkle.position.y = 0.68;
      sparkle.visible = !sh.searched && sh.hiddenKind !== 'nothing';
      grp.add(sparkle);

      grp.position.set(sh.tx + 0.5, 0, sh.ty + 0.5);
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

      grp.position.set(obj.tx + 0.5, 0, obj.ty + 0.5);
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

      grp.position.set(ch.tx + 0.5, 0, ch.ty + 0.5);
      g.add(grp);
      this.chestRigs.push({ id: ch.id, lidPivot, glowLight });
    }
  }

  private buildPortals(g: THREE.Group, zone: ZoneDef): void {
    const pillarMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.3, roughness: 0.45 });
    for (const p of zone.portals) {
      const cx = p.tx + p.widthTiles * 0.5;
      const cz = p.ty + p.heightTiles * 0.5;
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
      ring.position.set(cx, 0.08, cz);
      g.add(ring);

      const pillarGlows: THREE.Mesh[] = [];
      for (const side of [-1, 1]) {
        const px = cx + side * (p.widthTiles * 0.5 + 0.15);
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 1.55, 8), pillarMat);
        col.position.set(px, 0.78, cz);
        col.castShadow = !this.isSoftwareGl;
        const orb = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.18, 0),
          new THREE.MeshBasicMaterial({ color: '#38bdf8' })
        );
        orb.position.set(px, 1.72, cz);
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
    this.atmospherePoints = null;
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
    for (const rig of this.enemyRigs.values()) {
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

    // Update GPU Shader Physics Uniforms!
    this.sharedUniforms.uTime.value = time;
    this.sharedUniforms.uPlayerPos.value.set(px3, 0, pz3);

    // Slight Front-Angled Modern Evo 3D Camera Tracking + Screen Shake!
    const shakeX = state.screenShake > 0 ? (Math.random() - 0.5) * 0.28 * state.screenShake : 0;
    const shakeY = state.screenShake > 0 ? (Math.random() - 0.5) * 0.2 * state.screenShake : 0;
    this.camera.position.set(camX3 + shakeX, 11.4 + shakeY, camZ3 + 10.6);
    this.camera.lookAt(camX3, 0.45, camZ3 - 0.55);

    // Move Shadow-Casting Sun Light smoothly with camera so real-time shadows stay razor-sharp!
    this.sunLight.position.set(camX3 - 10, 18, camZ3 - 7);
    this.sunLight.target.position.set(camX3, 0, camZ3);

    // Real-time Flickering Hero Dungeon Lantern PointLight
    if (isDungeon) {
      this.heroTorchLight.position.set(px3, 1.85, pz3 + 0.35);
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

    // Animate Fountain Jets, Shrine Statue Halos, Bobbing Moored Rowboats & 3D Butterflies!
    for (const j of this.fountainJets) {
      j.scale.y = 0.85 + Math.sin(time * 9) * 0.22;
      j.rotation.y = time * 2.5;
    }
    for (const r of this.statueRings) {
      r.rotation.y = time * 1.4;
    }
    for (const b of this.floatingBoats) {
      b.group.position.y = b.baseY + Math.sin(time * 2.1 + b.phase) * 0.045;
      b.group.rotation.z = Math.sin(time * 1.6 + b.phase) * 0.07;
      b.group.rotation.x = Math.cos(time * 1.3 + b.phase) * 0.04;
    }
    for (const w of this.wildlifeRigs) {
      const a = time * w.speed + w.phase;
      w.group.position.set(
        w.anchorX + Math.cos(a) * w.radius,
        0.95 + Math.sin(time * 3.4 + w.phase) * 0.28,
        w.anchorZ + Math.sin(a * 1.3) * w.radius
      );
      w.group.rotation.y = -a;
      const flap = Math.sin(time * 20 + w.phase) * 0.85;
      w.wingL.rotation.y = flap;
      w.wingR.rotation.y = -flap;
    }

    // Update Adol 14-part 3D Articulated Kinematics & Equipment Materials!
    this.syncAdolRig(state, px3, pz3);

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

    // Update Articulated NPCs facing Adol
    for (const npc of zone.npcs) {
      const rig = this.npcRigs.get(npc.id);
      if (!rig) continue;
      const a = state.npcAngles.get(npc.id) ?? Math.PI * 0.5;
      rig.root.rotation.y = Math.PI * 0.5 - a;
      rig.body.position.y = Math.sin(time * 2.8 + npc.tx) * 0.03;
    }

    // Sync Enemies & Colossal Bosses
    const aliveIds = new Set<number>();
    for (const e of state.enemies) {
      aliveIds.add(e.id);
      let rig = this.enemyRigs.get(e.id);
      if (!rig) {
        rig = this.buildEnemyRig(e, isDungeon);
        this.scene.add(rig.root);
        this.enemyRigs.set(e.id, rig);
      }
      rig.root.position.set(e.x / YS_WORLD_TILE, 0, e.y / YS_WORLD_TILE);
      rig.root.rotation.y = Math.PI * 0.5 - e.angle;
      const bob = Math.sin(time * 7 + e.id) * 0.07;
      if (e.kind === 'slime') {
        const sq = 1 + Math.sin(time * 9 + e.id) * 0.14;
        rig.body.scale.set(sq, 1 / sq, sq);
      } else {
        rig.body.position.y = Math.max(0, bob);
      }
      if (rig.wingL && rig.wingR) {
        const flap = Math.sin(time * 14 + e.id) * 0.55;
        rig.wingL.rotation.z = flap;
        rig.wingR.rotation.z = -flap;
      }
      if (rig.halo) {
        rig.halo.rotation.z = time * 2.2;
      }
      if (rig.bossCircle) {
        rig.bossCircle.rotation.z = -time * 1.6;
        rig.bossCircle.scale.setScalar(0.95 + Math.sin(time * 4.5) * 0.08);
      }
      const flash = e.hitFlash > 0 && Math.floor(time * 32) % 2 === 0;
      for (let i = 0; i < rig.materials.length; i++) {
        const mat = rig.materials[i];
        if (flash) {
          mat.emissive.set('#ffffff');
          mat.emissiveIntensity = 1.6;
        } else {
          mat.emissive.copy(rig.baseEmissives[i]);
          mat.emissiveIntensity = e.kind === 'slime' ? 0.25 : 0.05;
        }
      }
    }
    for (const [id, rig] of this.enemyRigs.entries()) {
      if (!aliveIds.has(id)) {
        this.scene.remove(rig.root);
        this.enemyRigs.delete(id);
      }
    }

    // Sync Magic Projectiles, Bouncing 3D Armor Gibs, & Jagged Combat Lightning Bolts!
    for (let i = 0; i < this.projPool.length; i++) {
      const m = this.projPool[i];
      if (i < state.projectiles.length) {
        const p = state.projectiles[i];
        m.visible = true;
        m.position.set(p.x / YS_WORLD_TILE, 0.65, p.y / YS_WORLD_TILE);
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
        m.visible = true;
        m.position.set(gItem.x / YS_WORLD_TILE, 0.08 + gItem.z / YS_WORLD_TILE, gItem.y / YS_WORLD_TILE);
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
        _vec3.set(b.x1 / YS_WORLD_TILE, 0.75, b.y1 / YS_WORLD_TILE);
        _vec3B.set(b.x2 / YS_WORLD_TILE, 0.75, b.y2 / YS_WORLD_TILE);
        for (let s = 0; s < 5; s++) {
          const t = s / 4;
          const j = s === 0 || s === 4 ? 0 : 0.24;
          posAttr.setXYZ(
            s,
            THREE.MathUtils.lerp(_vec3.x, _vec3B.x, t) + (Math.random() - 0.5) * j,
            0.75 + (Math.random() - 0.5) * j,
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
    r.root.position.set(px3, 0, pz3);
    r.body.rotation.y = Math.PI * 0.5 - state.bodyAngle;

    const stride = Math.sin(state.walkAnim) * state.moveSpeedFrac;
    const bob = Math.abs(Math.cos(state.walkAnim)) * 0.08 * state.moveSpeedFrac;
    r.body.position.y = bob;
    r.leftLeg.rotation.x = stride * 0.72;
    r.rightLeg.rotation.x = -stride * 0.72;

    // Billowing crimson cape segments reacting to speed & wind!
    for (let i = 0; i < r.capeSegs.length; i++) {
      const seg = r.capeSegs[i];
      const wave = Math.sin(state.time * 9.5 + i * 1.1) * (0.08 + state.moveSpeedFrac * 0.16);
      seg.rotation.x = 0.22 + state.moveSpeedFrac * 0.35 + wave + i * 0.08;
    }

    // Sword thrust / swing kinematics & equipment visual upgrades
    const thrust = state.lungeTimer > 0 ? 0.26 : 0;
    r.swordArm.position.z = 0.06 + thrust;
    r.swordArm.rotation.y = state.slashArcTimer > 0 ? Math.sin(state.slashArcTimer * 18) * 1.15 : 0;

    const torsoMat = r.torso.material as THREE.MeshStandardMaterial;
    const armorColors = ['#475569', '#64748b', '#38bdf8', '#e2e8f0', '#fef08a'];
    torsoMat.color.set(armorColors[Math.min(4, state.armorTier)]);
    const bladeMat = r.swordBlade.material as THREE.MeshStandardMaterial;
    if (state.weaponTier >= 4) {
      bladeMat.color.set('#fb923c');
      bladeMat.emissive.set('#ea580c');
      bladeMat.emissiveIntensity = 1.4;
    } else if (state.weaponTier >= 3) {
      bladeMat.color.set('#e0f2fe');
      bladeMat.emissive.set('#38bdf8');
      bladeMat.emissiveIntensity = 0.55;
    } else {
      bladeMat.color.set('#f1f5f9');
      bladeMat.emissive.set('#000000');
      bladeMat.emissiveIntensity = 0;
    }

    // Sword slash arc visibility
    const arcMat = r.slashArc.material as THREE.MeshBasicMaterial;
    arcMat.opacity = state.slashArcTimer > 0 ? Math.min(0.85, state.slashArcTimer * 4.5) : 0;

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
    this.gpuSparks.dispose();
    this.envTexture.dispose();
    for (const tex of Object.values(this.textures)) tex.dispose();
    this.renderer.dispose();
  }
}

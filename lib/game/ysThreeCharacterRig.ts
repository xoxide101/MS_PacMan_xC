import * as THREE from 'three';
import type { WorldNpc } from './ysWorldBuilder';
import { resolveNpcAgeGroup } from './rpgJsSpriteAtlas';

// ============================================================================
// SCULPTED ARTICULATED 3D PBR CHARACTER & MONSTER RIG SYSTEM
// Full volumetric 3D multi-part models for Adol, all Adult/Elder/Child NPCs,
// and Short/Tall/Colossal 3D Enemies with:
// - Contoured 3D heads with painted expressive anime JRPG face textures,
//   3D noses, 3D ears, and volumetric layered 3D sculpted hair & headgear
// - PBR material contrast (matte cloth vs. brushed steel/gold armor & leather)
// - Articulated shoulders, legs, head, billowing capes, flowing hair & weapons
// - Real 3D X-Ray silhouette proxy for Adol when occluded behind trees/roofs
// ============================================================================

export type CharacterCostume =
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

export interface Humanoid3DParts {
  rigGroup: THREE.Group;
  torsoPivot: THREE.Group;
  headPivot: THREE.Group;
  armLPivot: THREE.Group;
  armRPivot: THREE.Group;
  legLPivot: THREE.Group;
  legRPivot: THREE.Group;
  capePivot?: THREE.Group;
  hairBackPivot?: THREE.Group;
  handAnchor: THREE.Group;
  // Live-upgradable Hero equipment refs
  swordBladeMat?: THREE.MeshStandardMaterial;
  swordGuardMat?: THREE.MeshStandardMaterial;
  swordBladeMesh?: THREE.Mesh;
  armorPlateMat?: THREE.MeshStandardMaterial;
  shieldFaceMat?: THREE.MeshStandardMaterial;
  shieldRimMat?: THREE.MeshStandardMaterial;
  // Owned textures/materials for clean disposal
  ownedTextures: THREE.Texture[];
  ownedMaterials: THREE.Material[];
}

export interface Enemy3DParts {
  rigGroup: THREE.Group;
  bodyPivot: THREE.Group;
  headPivot?: THREE.Group;
  armLPivot?: THREE.Group;
  armRPivot?: THREE.Group;
  legLPivot?: THREE.Group;
  legRPivot?: THREE.Group;
  wingLPivot?: THREE.Group;
  wingRPivot?: THREE.Group;
  tailPivot?: THREE.Group;
  capePivot?: THREE.Group;
  orbitRing?: THREE.Group;
  coreMesh?: THREE.Mesh;
  flashMaterials: THREE.MeshStandardMaterial[];
  ownedMaterials: THREE.Material[];
}

// Shared lightweight geometry cache (built once, reused across all characters for high FPS!)
let sharedGeos: {
  unitSphere16: THREE.SphereGeometry;
  unitSphere12: THREE.SphereGeometry;
  unitSphere8: THREE.SphereGeometry;
  unitBox: THREE.BoxGeometry;
  unitCyl12: THREE.CylinderGeometry;
  unitCyl8: THREE.CylinderGeometry;
  unitCone8: THREE.ConeGeometry;
  unitOcta: THREE.OctahedronGeometry;
  robeBell: THREE.LatheGeometry;
  capeSheet: THREE.BufferGeometry;
} | null = null;

function getSharedGeos() {
  if (sharedGeos) return sharedGeos;

  // Flowing flared RPG robe/skirt lathe profile
  const robePts = [
    new THREE.Vector2(0.01, 0),
    new THREE.Vector2(0.36, 0.0),
    new THREE.Vector2(0.32, 0.28),
    new THREE.Vector2(0.24, 0.62),
    new THREE.Vector2(0.21, 0.96),
    new THREE.Vector2(0.01, 1.0),
  ];
  const robeBell = new THREE.LatheGeometry(robePts, 14);

  // Gently curved sculpted 3D cape geometry (not a flat cardboard rect!)
  const capeGeo = new THREE.PlaneGeometry(0.56, 0.92, 4, 5);
  capeGeo.translate(0, -0.46, 0);
  const pos = capeGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i); // 0 at shoulders down to -0.92 at hem
    const t = Math.min(1, Math.max(0, -y / 0.92));
    // Flare wider at bottom & arch smoothly around the back
    const flare = 1 + t * 0.42;
    const nx = x * flare;
    const nz = -t * 0.16 - (nx * nx) * 0.34;
    pos.setXYZ(i, nx, y, nz);
  }
  capeGeo.computeVertexNormals();

  sharedGeos = {
    unitSphere16: new THREE.SphereGeometry(1, 18, 14),
    unitSphere12: new THREE.SphereGeometry(1, 12, 10),
    unitSphere8: new THREE.SphereGeometry(1, 8, 7),
    unitBox: new THREE.BoxGeometry(1, 1, 1),
    unitCyl12: new THREE.CylinderGeometry(1, 1, 1, 12),
    unitCyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
    unitCone8: new THREE.ConeGeometry(1, 1, 8),
    unitOcta: new THREE.OctahedronGeometry(1, 0),
    robeBell,
    capeSheet: capeGeo,
  };
  for (const geo of Object.values(sharedGeos)) {
    geo.userData.shared = true;
  }
  return sharedGeos;
}

// ============================================================================
// PROCEDURAL EXPRESSIVE 3D HEAD FACE TEXTURE (Mapped cleanly to front of 3D head!)
// Three.js SphereGeometry puts phi = Math.PI * 0.5 at +Z (uv.x = 0.25) when unrotated,
// OR if we rotate the head mesh by -Math.PI/2 around Y, uv.x = 0.5 faces directly +Z!
// We rotate the head sphere by -Math.PI/2 so uv.x = 0.5 is dead-center front (+Z)!
// ============================================================================
const faceTexCache = new Map<string, THREE.CanvasTexture>();

function getSculptedFaceTexture(
  skinHex: string,
  eyeHex: string,
  browHex: string,
  opts: { isHero?: boolean; isChild?: boolean; isElder?: boolean; isFemale?: boolean; maxAniso: number }
): THREE.CanvasTexture {
  const key = `${skinHex}|${eyeHex}|${browHex}|${opts.isHero ? 1 : 0}|${opts.isChild ? 1 : 0}|${opts.isElder ? 1 : 0}|${opts.isFemale ? 1 : 0}`;
  const cached = faceTexCache.get(key);
  if (cached) return cached;

  const W = 512;
  const H = 256;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Warm sculpted skin base gradient (subtle temple & chin shading for true 3D warmth)
  const skinGrad = ctx.createLinearGradient(0, 0, 0, H);
  skinGrad.addColorStop(0, skinHex);
  skinGrad.addColorStop(0.65, skinHex);
  skinGrad.addColorStop(1, '#e8b392');
  ctx.fillStyle = skinGrad;
  ctx.fillRect(0, 0, W, H);

  // Center of front face sits at u = 0.5 (x = 256), eye line at v ~ 0.50 (y = 128)
  const cx = W * 0.5;
  const eyeY = opts.isChild ? 132 : 124;
  const eyeSpacing = opts.isChild ? 30 : 27;
  const eyeW = opts.isChild ? 18 : opts.isFemale ? 17 : 15.5;
  const eyeH = opts.isChild ? 20 : opts.isFemale ? 19 : 16.5;

  // Soft warm rosy cheek blush
  for (const side of [-1, 1]) {
    const bx = cx + side * (eyeSpacing + 9);
    const by = eyeY + 20;
    const blush = ctx.createRadialGradient(bx, by, 2, bx, by, 18);
    blush.addColorStop(0, opts.isChild || opts.isFemale ? 'rgba(244, 114, 140, 0.34)' : 'rgba(232, 128, 120, 0.22)');
    blush.addColorStop(1, 'rgba(244, 114, 140, 0)');
    ctx.fillStyle = blush;
    ctx.beginPath();
    ctx.arc(bx, by, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sculpted Expressive Anime-JRPG Eyes (Multi-stop iris, upper lash, twin catchlights!)
  for (const side of [-1, 1]) {
    const ex = cx + side * eyeSpacing;
    // Sclera white
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, eyeW, eyeH * 0.88, 0, 0, Math.PI * 2);
    ctx.fill();

    // Rich 3-stop Iris gradient
    const irisGrad = ctx.createLinearGradient(ex, eyeY - eyeH * 0.7, ex, eyeY + eyeH * 0.7);
    irisGrad.addColorStop(0, '#0f172a');
    irisGrad.addColorStop(0.42, eyeHex);
    irisGrad.addColorStop(1, '#fef08a');
    ctx.fillStyle = irisGrad;
    ctx.beginPath();
    ctx.ellipse(ex - side * 1.5, eyeY + 1, eyeW * 0.68, eyeH * 0.76, 0, 0, Math.PI * 2);
    ctx.fill();

    // Deep pupil
    ctx.fillStyle = '#090d1a';
    ctx.beginPath();
    ctx.ellipse(ex - side * 1.5, eyeY + 1.5, eyeW * 0.34, eyeH * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();

    // Crisp specular catchlights (brings 3D eyes vividly to life!)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex - side * 4.5, eyeY - 5, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ex + side * 3.5, eyeY + 6, 2.1, 0, Math.PI * 2);
    ctx.fill();

    // Bold sculpted upper lash curve
    ctx.strokeStyle = '#1e1b2e';
    ctx.lineWidth = opts.isFemale ? 4.4 : 3.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(ex, eyeY + 2, eyeW + 1, Math.PI * 1.12, Math.PI * 1.88);
    ctx.stroke();

    // Subtle lower lash hint
    ctx.strokeStyle = 'rgba(30, 27, 46, 0.38)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(ex, eyeY - 2, eyeW * 0.85, Math.PI * 0.18, Math.PI * 0.82);
    ctx.stroke();

    // Sculpted Eyebrows (determined for hero, gentle arc for townsfolk)
    ctx.strokeStyle = browHex;
    ctx.lineWidth = opts.isHero ? 4.0 : 3.2;
    ctx.beginPath();
    if (opts.isHero) {
      ctx.moveTo(ex - side * 14, eyeY - 24);
      ctx.quadraticCurveTo(ex, eyeY - 29, ex + side * 14, eyeY - 21);
    } else {
      ctx.moveTo(ex - 13, eyeY - 24);
      ctx.quadraticCurveTo(ex, eyeY - 29, ex + 13, eyeY - 24);
    }
    ctx.stroke();
  }

  // Subtle nose bridge shadow (pairs with real 3D nose mesh!)
  ctx.fillStyle = 'rgba(166, 98, 70, 0.25)';
  ctx.beginPath();
  ctx.ellipse(cx, eyeY + 22, 4.5, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Warm expressive mouth / smile
  ctx.strokeStyle = '#9a4f46';
  ctx.lineWidth = 2.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (opts.isHero) {
    ctx.moveTo(cx - 10, eyeY + 37);
    ctx.quadraticCurveTo(cx, eyeY + 42, cx + 11, eyeY + 36);
  } else if (opts.isChild) {
    ctx.moveTo(cx - 11, eyeY + 35);
    ctx.quadraticCurveTo(cx, eyeY + 45, cx + 11, eyeY + 35);
  } else {
    ctx.moveTo(cx - 10, eyeY + 36);
    ctx.quadraticCurveTo(cx, eyeY + 43, cx + 10, eyeY + 36);
  }
  ctx.stroke();

  // Subtle elder laugh lines
  if (opts.isElder) {
    ctx.strokeStyle = 'rgba(130, 82, 60, 0.35)';
    ctx.lineWidth = 1.6;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + side * 24, eyeY + 28, 12, side > 0 ? -0.4 : Math.PI - 0.8, side > 0 ? 0.8 : Math.PI + 0.4);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, opts.maxAniso);
  tex.needsUpdate = true;
  faceTexCache.set(key, tex);
  return tex;
}

export function resolveNpcCostume(npc: WorldNpc): {
  costume: CharacterCostume;
  isLongHair: boolean;
  hasBeard: boolean;
  eyeColor: string;
} {
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

  let costume: CharacterCostume = 'villager';
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
  else if (
    npc.task === 'serve' ||
    nameLower.includes('inn') ||
    nameLower.includes('tavern') ||
    nameLower.includes('barkeep') ||
    nameLower.includes('maid')
  )
    costume = 'innkeep';
  else if (
    npc.task === 'garden' ||
    nameLower.includes('herb') ||
    nameLower.includes('clinic') ||
    nameLower.includes('flair') ||
    nameLower.includes('doctor')
  )
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

  const eyePalette: Record<CharacterCostume, string> = {
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

  return {
    costume,
    isLongHair,
    hasBeard: npc.portrait === 'elder' && !nameLower.includes('jeva') && !nameLower.includes('bera'),
    eyeColor: eyePalette[costume],
  };
}

// ============================================================================
// SCULPTED 3D HUMANOID BUILDER (Adol + Adult/Elder/Child NPCs)
// Grounded at y = 0 (boot soles flush with terrain!). Front faces +Z!
// ============================================================================
export function buildSculptedHumanoid3D(opts: {
  isHero?: boolean;
  costume: CharacterCostume;
  ageGroup: 'adult' | 'child' | 'elder';
  hairColor: string;
  eyeColor: string;
  tunicColor: string;
  cloakColor: string;
  isLongHair: boolean;
  hasBeard?: boolean;
  castShadow: boolean;
  maxAniso: number;
}): Humanoid3DParts {
  const g = getSharedGeos();
  const ownedTextures: THREE.Texture[] = [];
  const ownedMaterials: THREE.Material[] = [];

  const mkMat = (params: THREE.MeshStandardMaterialParameters) => {
    const m = new THREE.MeshStandardMaterial(params);
    ownedMaterials.push(m);
    return m;
  };

  const isChild = opts.ageGroup === 'child';
  const isElder = opts.ageGroup === 'elder';
  const isHero = Boolean(opts.isHero);

  // Stature Scaling: Adults stand ~2.28-2.36 units tall (~1.9x Child height of ~1.22 units!)
  const legLen = isChild ? 0.38 : isElder ? 0.80 : 0.90;
  const torsoH = isChild ? 0.40 : isElder ? 0.68 : 0.74;
  const torsoW = isChild ? 0.34 : isElder ? 0.44 : isHero ? 0.48 : 0.45;
  const torsoD = isChild ? 0.24 : 0.30;
  const headR = isChild ? 0.26 : 0.295;
  const hipY = legLen;
  const shoulderY = torsoH - 0.08;

  const skinHex = isHero ? '#ffe1c6' : isElder ? '#f6d2b6' : '#fddcc0';
  const skinMat = mkMat({ color: skinHex, roughness: 0.72, metalness: 0.02 });
  const faceTex = getSculptedFaceTexture(skinHex, opts.eyeColor, opts.hairColor, {
    isHero,
    isChild,
    isElder,
    isFemale: opts.isLongHair,
    maxAniso: opts.maxAniso,
  });
  const headFaceMat = mkMat({ map: faceTex, roughness: 0.68, metalness: 0.02 });
  const hairMat = mkMat({ color: opts.hairColor, roughness: 0.46, metalness: 0.1 });
  const tunicMat = mkMat({ color: opts.tunicColor, roughness: 0.82, metalness: 0.03 });
  const cloakMat = mkMat({ color: opts.cloakColor, roughness: 0.78, metalness: 0.04, side: THREE.DoubleSide });
  const pantsMat = mkMat({ color: isHero ? '#1e293b' : '#334155', roughness: 0.85, metalness: 0.02 });
  const bootMat = mkMat({ color: isHero ? '#5c3317' : '#4a2b17', roughness: 0.52, metalness: 0.12 });
  const leatherMat = mkMat({ color: '#6b3a1e', roughness: 0.62, metalness: 0.1 });
  const goldMat = mkMat({ color: '#eab308', roughness: 0.26, metalness: 0.86 });
  const whiteClothMat = mkMat({ color: '#f8fafc', roughness: 0.86, metalness: 0.02 });
  const armorPlateMat = mkMat({
    color: isHero ? '#e2e8f0' : '#94a3b8',
    roughness: 0.22,
    metalness: 0.88,
  });

  const rigGroup = new THREE.Group();
  const torsoPivot = new THREE.Group();
  torsoPivot.position.y = hipY;
  rigGroup.add(torsoPivot);

  const addMesh = (
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    sx: number,
    sy: number,
    sz: number,
    px = 0,
    py = 0,
    pz = 0,
    rx = 0,
    ry = 0,
    rz = 0,
    shadow = true
  ) => {
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(sx, sy, sz);
    m.position.set(px, py, pz);
    m.rotation.set(rx, ry, rz);
    if (shadow && opts.castShadow) m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // --- 1. ARTICULATED 3D LEGS & CUFFED RIDING BOOTS ---
  const hipOffsetX = torsoW * 0.28;
  const legLPivot = new THREE.Group();
  legLPivot.position.set(-hipOffsetX, hipY, 0);
  const legRPivot = new THREE.Group();
  legRPivot.position.set(hipOffsetX, hipY, 0);
  rigGroup.add(legLPivot, legRPivot);

  const legR = isChild ? 0.072 : 0.095;
  for (const legP of [legLPivot, legRPivot]) {
    // Upper thigh trouser
    addMesh(legP, g.unitCyl12, pantsMat, legR, legLen * 0.56, legR, 0, -legLen * 0.28, 0);
    // Knee round joint
    addMesh(legP, g.unitSphere8, pantsMat, legR * 0.96, legR * 0.96, legR * 0.96, 0, -legLen * 0.54, 0.01, 0, 0, 0, false);
    // Sculpted cuffed riding boot shaft
    addMesh(legP, g.unitCyl12, bootMat, legR * 1.08, legLen * 0.44, legR * 1.12, 0, -legLen * 0.76, 0.01);
    // Folded boot top cuff & brass buckle
    addMesh(legP, g.unitCyl12, leatherMat, legR * 1.24, 0.075, legR * 1.26, 0, -legLen * 0.56, 0.01, 0, 0, 0, false);
    // Sculpted rounded boot toe extending forward (+Z)
    addMesh(legP, g.unitSphere12, bootMat, legR * 1.14, 0.078, legR * 1.56, 0, -legLen + 0.072, 0.075);
  }

  // --- 2. SCULPTED 3D TORSO, WAIST BELT & COSTUME SILHOUETTE ---
  const usesRobe =
    !isHero &&
    (opts.costume === 'fortune' || opts.costume === 'maiden' || opts.costume === 'elder' || (opts.isLongHair && !isChild && opts.costume === 'villager'));

  // Pelvis / hip anchor
  addMesh(torsoPivot, g.unitSphere12, pantsMat, torsoW * 0.46, 0.15, torsoD * 0.48, 0, 0.02, 0, 0, 0, 0, false);

  // Main Sculpted Chest & Waist
  addMesh(torsoPivot, g.unitCyl12, tunicMat, torsoW * 0.5, torsoH * 0.88, torsoD * 0.54, 0, torsoH * 0.46, 0);
  // Rounded upper chest & shoulder shelf
  addMesh(torsoPivot, g.unitSphere12, tunicMat, torsoW * 0.54, torsoH * 0.28, torsoD * 0.56, 0, torsoH * 0.78, 0.02);

  // Leather Waist Belt + Polished Brass Buckle
  addMesh(torsoPivot, g.unitCyl12, leatherMat, torsoW * 0.54, 0.095, torsoD * 0.58, 0, 0.14, 0, 0, 0, 0, false);
  addMesh(torsoPivot, g.unitBox, goldMat, 0.11, 0.085, 0.055, 0, 0.14, torsoD * 0.56, 0, 0, 0, false);

  // Flowing 3D Lathe Skirt / Robe for Maidens, Fortune Teller, & Elders
  if (usesRobe) {
    const robeLen = legLen * 0.84;
    addMesh(torsoPivot, g.robeBell, tunicMat, torsoW * 2.55, robeLen, torsoD * 3.1, 0, -robeLen + 0.16, 0);
    // Gold trim band near robe hem
    addMesh(torsoPivot, g.unitCyl12, goldMat, torsoW * 0.84, 0.04, torsoD * 0.94, 0, -robeLen + 0.22, 0, 0, 0, 0, false);
  } else {
    // Tailored tunic lower coat-tails / waist tassets
    addMesh(torsoPivot, g.robeBell, tunicMat, torsoW * 1.52, 0.24, torsoD * 1.85, 0, -0.10, 0);
  }

  // Hero / Armored Guard Sculpted 3D Metallic Breastplate & Pauldrons!
  if (isHero || opts.costume === 'armorer') {
    // Contoured front & back metallic cuirass
    addMesh(torsoPivot, g.unitSphere12, armorPlateMat, torsoW * 0.56, torsoH * 0.46, torsoD * 0.58, 0, torsoH * 0.58, 0.045);
    // Gilded chest emblem / cross-strap
    addMesh(torsoPivot, g.unitBox, goldMat, torsoW * 0.62, 0.055, torsoD * 1.18, 0, torsoH * 0.58, 0.01, 0, 0, 0.56, false);
    // Sculpted metallic shoulder pauldrons
    for (const side of [-1, 1]) {
      addMesh(
        torsoPivot,
        g.unitSphere12,
        armorPlateMat,
        0.16,
        0.13,
        0.17,
        side * (torsoW * 0.60),
        shoulderY + 0.03,
        0,
        0,
        0,
        side * -0.25
      );
      addMesh(
        torsoPivot,
        g.unitBox,
        goldMat,
        0.17,
        0.025,
        0.18,
        side * (torsoW * 0.61),
        shoulderY - 0.02,
        0,
        0,
        0,
        side * -0.25,
        false
      );
    }
  } else if (opts.costume === 'baker' || opts.costume === 'innkeep') {
    // Crisp White Front Apron
    addMesh(torsoPivot, g.unitBox, whiteClothMat, torsoW * 0.72, torsoH * 0.85, 0.055, 0, torsoH * 0.28, torsoD * 0.55);
  } else if (opts.costume === 'smith' || opts.costume === 'craft') {
    // Heavy Leather Work Apron + Steel Tool Buckle
    addMesh(torsoPivot, g.unitBox, leatherMat, torsoW * 0.76, torsoH * 0.88, 0.06, 0, torsoH * 0.26, torsoD * 0.55);
    addMesh(torsoPivot, g.unitBox, armorPlateMat, 0.14, 0.08, 0.05, 0.1, 0.14, torsoD * 0.59, 0, 0, 0, false);
  } else {
    // Warm woven scarf / collar mantle around neck
    addMesh(torsoPivot, g.unitCyl12, cloakMat, torsoW * 0.44, 0.11, torsoD * 0.52, 0, torsoH * 0.90, 0.01, 0.12, 0, 0, false);
  }

  // --- 3. ARTICULATED 3D BILLOWING CAPE (Hero, Fortune Teller, Elder, Maiden, Guard) ---
  let capePivot: THREE.Group | undefined;
  if (isHero || opts.costume === 'fortune' || opts.costume === 'elder' || opts.costume === 'armorer' || opts.costume === 'herbalist') {
    capePivot = new THREE.Group();
    capePivot.position.set(0, shoulderY + 0.05, -torsoD * 0.48);
    const capeScaleY = isChild ? 0.55 : isHero ? 1.12 : 1.02;
    const capeScaleX = isChild ? 0.72 : 1.04;
    const capeMesh = new THREE.Mesh(g.capeSheet, cloakMat);
    capeMesh.scale.set(capeScaleX, capeScaleY, 1.0);
    if (opts.castShadow) capeMesh.castShadow = true;
    capePivot.add(capeMesh);
    // Clasp medallion at nape
    addMesh(capePivot, g.unitSphere8, goldMat, 0.055, 0.055, 0.04, 0, 0.0, -0.02, 0, 0, 0, false);
    torsoPivot.add(capePivot);
  }

  // --- 4. ARTICULATED 3D ARMS, SLEEVES, HANDS & HERO WEAPONRY ---
  const armLen = isChild ? 0.34 : isElder ? 0.56 : 0.62;
  const armR = isChild ? 0.058 : 0.075;
  const armX = torsoW * 0.56 + armR * 0.65;

  const armLPivot = new THREE.Group();
  armLPivot.position.set(-armX, shoulderY, 0);
  const armRPivot = new THREE.Group();
  armRPivot.position.set(armX, shoulderY, 0);
  torsoPivot.add(armLPivot, armRPivot);

  const sleeveMat = opts.costume === 'baker' ? whiteClothMat : tunicMat;
  for (const armP of [armLPivot, armRPivot]) {
    // Upper sleeve
    addMesh(armP, g.unitSphere12, sleeveMat, armR * 1.25, armR * 1.25, armR * 1.25, 0, 0, 0, 0, 0, 0, false);
    addMesh(armP, g.unitCyl12, sleeveMat, armR * 1.02, armLen * 0.52, armR * 1.02, 0, -armLen * 0.25, 0);
    // Forearm / gauntlet
    const foreMat = isHero || opts.costume === 'armorer' ? armorPlateMat : opts.costume === 'smith' || opts.costume === 'baker' ? skinMat : sleeveMat;
    addMesh(armP, g.unitCyl12, foreMat, armR * 0.88, armLen * 0.42, armR * 0.88, 0, -armLen * 0.66, 0.02, -0.14, 0, 0);
    // Sculpted 3D Hand
    addMesh(armP, g.unitSphere12, skinMat, armR * 0.92, armR * 0.95, armR * 0.98, 0, -armLen * 0.92, 0.04);
  }

  // Hand anchor attached to torso so NPC task props follow full 3D body facing cleanly!
  const handAnchor = new THREE.Group();
  handAnchor.position.set(0, shoulderY - armLen * 0.52, torsoD * 0.45);
  torsoPivot.add(handAnchor);

  // Live-Upgradable 3D Sword & Shield for Adol Christin!
  let swordBladeMat: THREE.MeshStandardMaterial | undefined;
  let swordGuardMat: THREE.MeshStandardMaterial | undefined;
  let swordBladeMesh: THREE.Mesh | undefined;
  let shieldFaceMat: THREE.MeshStandardMaterial | undefined;
  let shieldRimMat: THREE.MeshStandardMaterial | undefined;

  if (isHero) {
    const swordGrp = new THREE.Group();
    swordGrp.position.set(0, -armLen * 0.88, 0.08);
    swordGrp.rotation.x = 1.18; // Held cleanly forward-angled in Hero ready stance!
    armRPivot.add(swordGrp);

    swordGuardMat = mkMat({ color: '#eab308', metalness: 0.9, roughness: 0.22 });
    swordBladeMat = mkMat({ color: '#e2e8f0', metalness: 0.94, roughness: 0.16 });
    // Wrapped Leather Grip & Pommel
    addMesh(swordGrp, g.unitCyl8, leatherMat, 0.028, 0.22, 0.028, 0, -0.06, 0, 0, 0, 0, false);
    addMesh(swordGrp, g.unitSphere8, swordGuardMat, 0.048, 0.048, 0.048, 0, -0.18, 0, 0, 0, 0, false);
    // Sculpted Crossguard
    addMesh(swordGrp, g.unitBox, swordGuardMat, 0.26, 0.048, 0.065, 0, 0.06, 0, 0, 0, 0, false);
    // Beveled Metallic Sword Blade + Tapered Tip
    swordBladeMesh = addMesh(swordGrp, g.unitBox, swordBladeMat, 0.075, 0.88, 0.024, 0, 0.52, 0);
    addMesh(swordGrp, g.unitCone8, swordBladeMat, 0.044, 0.20, 0.018, 0, 1.04, 0, 0, 0, 0, false);

    // Sculpted 3D Kite Shield on Adol's Left Forearm!
    const shieldGrp = new THREE.Group();
    shieldGrp.position.set(-0.11, -armLen * 0.66, 0.12);
    shieldGrp.rotation.set(0.08, -0.58, 0.08);
    armLPivot.add(shieldGrp);

    shieldFaceMat = mkMat({ color: '#1d4ed8', metalness: 0.42, roughness: 0.36 });
    shieldRimMat = mkMat({ color: '#e2e8f0', metalness: 0.88, roughness: 0.2 });
    addMesh(shieldGrp, g.unitBox, shieldRimMat, 0.36, 0.50, 0.055, 0, 0, 0);
    addMesh(shieldGrp, g.unitBox, shieldFaceMat, 0.29, 0.42, 0.068, 0, 0, 0.008, 0, 0, 0, false);
    addMesh(shieldGrp, g.unitOcta, goldMat, 0.072, 0.11, 0.045, 0, 0.02, 0.05, 0, 0, 0, false);
  }

  // --- 5. SCULPTED 3D HEAD, NECK, 3D EARS, 3D NOSE & VOLUMETRIC LAYERED HAIR ---
  const headPivot = new THREE.Group();
  headPivot.position.set(0, torsoH + 0.02, 0.02);
  torsoPivot.add(headPivot);

  // Neck
  addMesh(headPivot, g.unitCyl12, skinMat, 0.095, 0.13, 0.095, 0, 0.04, 0, 0, 0, 0, false);

  const headCenterY = headR * 0.96 + 0.06;
  // Smooth contoured 3D Head Sphere rotated -PI/2 around Y so UV x=0.5 (painted anime eyes/mouth) faces +Z!
  const headMesh = addMesh(
    headPivot,
    g.unitSphere16,
    headFaceMat,
    headR * 0.96,
    headR * 1.04,
    headR * 0.98,
    0,
    headCenterY,
    0,
    0,
    -Math.PI * 0.5,
    0
  );
  headMesh.receiveShadow = true;

  // Real 3D Ears & Subtle 3D Nose Ridge!
  for (const side of [-1, 1]) {
    addMesh(headPivot, g.unitSphere8, skinMat, 0.052, 0.072, 0.038, side * headR * 0.94, headCenterY - 0.01, -0.01, 0, 0, 0, false);
  }
  addMesh(headPivot, g.unitCone8, skinMat, 0.032, 0.062, 0.042, 0, headCenterY - 0.032, headR * 0.96, Math.PI * 0.35, 0, 0, false);

  // Volumetric 3D Hair Crown + Layered Forehead Bangs + Sideburns + Articulated Back Hair!
  // Main Hair Cap Dome (slightly larger than skull, wrapping top & back cleanly without blocking eyes)
  addMesh(
    headPivot,
    g.unitSphere16,
    hairMat,
    headR * 1.06,
    headR * 1.06,
    headR * 1.06,
    0,
    headCenterY + 0.038,
    -0.028
  );

  // Layered Swept 3D Forehead Bangs (gives unmistakable 3D silhouette from every angle!)
  const bangCount = isHero ? 5 : 4;
  for (let bi = 0; bi < bangCount; bi++) {
    const u = (bi / (bangCount - 1)) * 2 - 1; // -1..1
    const bx = u * headR * 0.72;
    const bz = Math.cos(u * 1.05) * headR * 0.95 + 0.02;
    const by = headCenterY + headR * 0.55 - Math.abs(u) * 0.035;
    const spikeLen = isHero ? 0.22 + (bi % 2) * 0.05 : 0.17;
    addMesh(
      headPivot,
      g.unitCone8,
      hairMat,
      0.068,
      spikeLen,
      0.055,
      bx,
      by,
      bz,
      Math.PI + 0.32,
      0,
      u * (isHero ? 0.38 : 0.22),
      false
    );
  }

  // Sideburn / Cheek-Framing Hair Locks
  for (const side of [-1, 1]) {
    addMesh(
      headPivot,
      g.unitCone8,
      hairMat,
      0.065,
      opts.isLongHair ? 0.34 : 0.19,
      0.065,
      side * headR * 0.88,
      headCenterY - (opts.isLongHair ? 0.08 : 0.01),
      0.08,
      Math.PI + 0.06,
      0,
      side * 0.14,
      false
    );
  }

  let hairBackPivot: THREE.Group | undefined;
  if (opts.isLongHair) {
    // Flowing 3D Back Hair Drape that sways smoothly as character walks!
    hairBackPivot = new THREE.Group();
    hairBackPivot.position.set(0, headCenterY + 0.02, -headR * 0.72);
    addMesh(hairBackPivot, g.unitCyl12, hairMat, headR * 0.86, 0.52, headR * 0.42, 0, -0.24, -0.04, 0.14, 0, 0);
    addMesh(hairBackPivot, g.unitSphere12, hairMat, headR * 0.88, 0.16, headR * 0.44, 0, -0.48, -0.07, 0, 0, 0, false);
    headPivot.add(hairBackPivot);
  } else if (isHero) {
    // Adol's Signature Swept Spiky Red Hair Crest & Nape Flairs!
    hairBackPivot = new THREE.Group();
    hairBackPivot.position.set(0, headCenterY + 0.04, -headR * 0.74);
    for (let si = -2; si <= 2; si++) {
      addMesh(
        hairBackPivot,
        g.unitCone8,
        hairMat,
        0.075,
        0.26 + (si === 0 ? 0.06 : 0),
        0.07,
        si * 0.085,
        -0.06 + Math.abs(si) * 0.02,
        -0.05,
        -2.25,
        0,
        si * 0.24,
        false
      );
    }
    // Dynamic fiery top ahoge tuft
    addMesh(headPivot, g.unitCone8, hairMat, 0.055, 0.22, 0.055, 0.04, headCenterY + headR * 1.12, -0.04, -0.55, 0, -0.35, false);
    headPivot.add(hairBackPivot);
  }

  // Sculpted 3D Beard for Elders
  if (opts.hasBeard) {
    addMesh(headPivot, g.unitCone8, hairMat, 0.15, 0.28, 0.12, 0, headCenterY - headR * 0.92, headR * 0.62, Math.PI - 0.15, 0, 0, false);
  }

  // Bespoke 3D Headgear by Role / Costume!
  if (opts.costume === 'baker') {
    // Iconic Pleated 3D Baker's Chef Toque!
    addMesh(headPivot, g.unitCyl12, whiteClothMat, headR * 0.98, 0.16, headR * 0.98, 0, headCenterY + headR * 0.92, -0.01);
    addMesh(headPivot, g.unitSphere12, whiteClothMat, headR * 1.18, 0.22, headR * 1.14, 0, headCenterY + headR * 1.24, -0.01);
  } else if (opts.costume === 'armorer') {
    // Steel Guard Helm & Crimson Plume
    addMesh(headPivot, g.unitSphere12, armorPlateMat, headR * 1.12, headR * 0.72, headR * 1.12, 0, headCenterY + headR * 0.42, -0.01);
    const plumeMat = mkMat({ color: '#dc2626', roughness: 0.65 });
    addMesh(headPivot, g.unitCone8, plumeMat, 0.07, 0.34, 0.14, 0, headCenterY + headR * 1.22, -0.06, -0.55, 0, 0);
  } else if (opts.costume === 'fortune') {
    // Golden Fortune Teller Circlet & Gem
    const gemMat = mkMat({ color: '#c084fc', emissive: '#9333ea', emissiveIntensity: 0.6, roughness: 0.15 });
    addMesh(headPivot, g.unitCyl12, goldMat, headR * 1.04, 0.045, headR * 1.04, 0, headCenterY + headR * 0.48, 0, 0, 0, 0, false);
    addMesh(headPivot, g.unitOcta, gemMat, 0.05, 0.065, 0.04, 0, headCenterY + headR * 0.48, headR * 1.04, 0, 0, 0, false);
  } else if (opts.costume === 'maiden' || opts.costume === 'herbalist') {
    // Charming Hair Ribbon Bow
    const bowMat = mkMat({ color: opts.costume === 'herbalist' ? '#4ade80' : '#f43f5e', roughness: 0.6 });
    addMesh(headPivot, g.unitBox, bowMat, 0.24, 0.09, 0.06, 0, headCenterY + headR * 0.96, -0.08, 0.2, 0, 0, false);
  }

  return {
    rigGroup,
    torsoPivot,
    headPivot,
    armLPivot,
    armRPivot,
    legLPivot,
    legRPivot,
    capePivot,
    hairBackPivot,
    handAnchor,
    swordBladeMat,
    swordGuardMat,
    swordBladeMesh,
    armorPlateMat,
    shieldFaceMat,
    shieldRimMat,
    ownedTextures,
    ownedMaterials,
  };
}

// Live-sync Hero 3D Sword & Armor Materials when player upgrades Weapon or Armor Tier!
export function applyHeroEquipmentTier3D(parts: Humanoid3DParts, weaponTier: number, armorTier: number): void {
  const bladeColors = ['#cbd5e1', '#e2e8f0', '#bae6fd', '#f8fafc', '#fb923c'];
  const bladeEmissive = ['#000000', '#000000', '#0284c7', '#38bdf8', '#ea580c'];
  const bladeScaleY = [0.78, 0.90, 0.98, 1.08, 1.18];
  const armorColors = ['#94a3b8', '#cbd5e1', '#60a5fa', '#f1f5f9', '#facc15'];
  const shieldColors = ['#2563eb', '#1d4ed8', '#0284c7', '#e2e8f0', '#dc2626'];

  const wt = Math.max(0, Math.min(4, weaponTier));
  const at = Math.max(0, Math.min(4, armorTier));

  if (parts.swordBladeMat) {
    parts.swordBladeMat.color.set(bladeColors[wt]);
    parts.swordBladeMat.emissive.set(bladeEmissive[wt]);
    parts.swordBladeMat.emissiveIntensity = wt >= 4 ? 0.85 : wt >= 3 ? 0.35 : wt >= 2 ? 0.18 : 0;
  }
  if (parts.swordBladeMesh) {
    parts.swordBladeMesh.scale.y = bladeScaleY[wt];
    parts.swordBladeMesh.position.y = 0.08 + bladeScaleY[wt] * 0.5;
  }
  if (parts.armorPlateMat) {
    parts.armorPlateMat.color.set(armorColors[at]);
    parts.armorPlateMat.metalness = at >= 3 ? 0.94 : 0.84;
  }
  if (parts.shieldFaceMat) {
    parts.shieldFaceMat.color.set(shieldColors[at]);
  }
}

// ============================================================================
// SCULPTED 3D X-RAY SILHOUETTE PROXY (Shows Adol's real 3D form behind trees/roofs!)
// ============================================================================
export function buildAdolXrayProxy3D(): { group: THREE.Group; mat: THREE.MeshBasicMaterial } {
  const g = getSharedGeos();
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color: '#7dd3fc',
    transparent: true,
    opacity: 0.46,
    depthTest: true,
    depthFunc: THREE.GreaterDepth,
    depthWrite: false,
  });

  const add = (geo: THREE.BufferGeometry, sx: number, sy: number, sz: number, px: number, py: number, pz: number) => {
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(sx, sy, sz);
    m.position.set(px, py, pz);
    m.renderOrder = 99;
    group.add(m);
  };
  // Clean 3D volumetric silhouette matching Adult Adol's proportions
  add(g.unitCyl12, 0.23, 0.78, 0.16, 0, 1.24, 0); // Torso
  add(g.unitSphere12, 0.30, 0.32, 0.30, 0, 1.98, 0); // Head
  add(g.unitCyl8, 0.095, 0.88, 0.095, -0.14, 0.44, 0); // Left leg
  add(g.unitCyl8, 0.095, 0.88, 0.095, 0.14, 0.44, 0); // Right leg
  add(g.unitCyl8, 0.075, 0.62, 0.075, -0.32, 1.28, 0); // Left arm
  add(g.unitCyl8, 0.075, 0.62, 0.075, 0.32, 1.28, 0); // Right arm
  return { group, mat };
}

// ============================================================================
// SCULPTED 3D VOLUMETRIC ENEMIES & COLOSSAL 3D BOSSES (Short vs. Tall!)
// Grounded flush at y = 0, facing +Z!
// ============================================================================
export function buildSculptedEnemy3D(
  kind: 'slime' | 'goblin' | 'knight' | 'mage' | 'wyvern' | 'boss',
  colorHex: string,
  accentHex: string,
  castShadow: boolean
): Enemy3DParts {
  const g = getSharedGeos();
  const ownedMaterials: THREE.Material[] = [];
  const flashMaterials: THREE.MeshStandardMaterial[] = [];

  const mkMat = (params: THREE.MeshStandardMaterialParameters, flashable = true) => {
    const m = new THREE.MeshStandardMaterial(params);
    ownedMaterials.push(m);
    if (flashable) flashMaterials.push(m);
    return m;
  };

  const rigGroup = new THREE.Group();
  const bodyPivot = new THREE.Group();
  rigGroup.add(bodyPivot);

  const add = (
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    sx: number,
    sy: number,
    sz: number,
    px = 0,
    py = 0,
    pz = 0,
    rx = 0,
    ry = 0,
    rz = 0,
    shadow = true
  ) => {
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(sx, sy, sz);
    m.position.set(px, py, pz);
    m.rotation.set(rx, ry, rz);
    if (shadow && castShadow) m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  const whiteMat = mkMat({ color: '#ffffff', roughness: 0.25 }, false);
  const darkEyeMat = mkMat({ color: '#090d1a', roughness: 0.2 }, false);
  const glowEyeMat = mkMat({ color: accentHex, emissive: accentHex, emissiveIntensity: 1.2, roughness: 0.15 }, false);

  if (kind === 'slime') {
    // SHORT BOUNCING GLOSSY 3D GEL SLIME (~1.05 units tall)
    const gelMat = mkMat({
      color: colorHex,
      roughness: 0.14,
      metalness: 0.08,
      transparent: true,
      opacity: 0.86,
    });
    const coreMat = mkMat({
      color: accentHex,
      emissive: accentHex,
      emissiveIntensity: 0.55,
      roughness: 0.2,
    });
    // Outer translucent dome + flared base skirt
    add(bodyPivot, g.unitSphere16, gelMat, 0.62, 0.54, 0.62, 0, 0.44, 0);
    add(bodyPivot, g.unitCyl12, gelMat, 0.66, 0.16, 0.66, 0, 0.10, 0, 0, 0, 0, false);
    // Glowing inner nucleus
    const coreMesh = add(bodyPivot, g.unitOcta, coreMat, 0.24, 0.26, 0.24, 0, 0.42, -0.02, 0, 0, 0, false);
    // Cute fierce 3D Eyes + highlight crest
    for (const s of [-1, 1]) {
      add(bodyPivot, g.unitSphere8, whiteMat, 0.11, 0.13, 0.06, s * 0.20, 0.52, 0.52, 0, 0, 0, false);
      add(bodyPivot, g.unitSphere8, darkEyeMat, 0.06, 0.08, 0.04, s * 0.20, 0.52, 0.56, 0, 0, 0, false);
    }
    // Side mini droplets
    add(bodyPivot, g.unitSphere8, gelMat, 0.16, 0.14, 0.16, -0.58, 0.14, 0.15, 0, 0, 0, false);
    add(bodyPivot, g.unitSphere8, gelMat, 0.13, 0.11, 0.13, 0.54, 0.12, -0.18, 0, 0, 0, false);

    return { rigGroup, bodyPivot, coreMesh, flashMaterials, ownedMaterials };
  }

  if (kind === 'goblin') {
    // SHORT HUNCHED 3D ESTERIA GOBLIN (~1.58 units tall)
    const skinMat = mkMat({ color: '#4d7c0f', roughness: 0.72 });
    const armorMat = mkMat({ color: colorHex, roughness: 0.78 });
    const woodMat = mkMat({ color: '#78350f', roughness: 0.84 });
    const ironMat = mkMat({ color: '#94a3b8', metalness: 0.82, roughness: 0.3 });

    const legLPivot = new THREE.Group();
    legLPivot.position.set(-0.16, 0.46, 0);
    const legRPivot = new THREE.Group();
    legRPivot.position.set(0.16, 0.46, 0);
    bodyPivot.add(legLPivot, legRPivot);
    for (const lp of [legLPivot, legRPivot]) {
      add(lp, g.unitCyl8, skinMat, 0.085, 0.42, 0.085, 0, -0.21, 0);
      add(lp, g.unitSphere8, woodMat, 0.10, 0.07, 0.14, 0, -0.42, 0.05);
    }

    // Hunched Torso
    add(bodyPivot, g.unitSphere12, armorMat, 0.34, 0.38, 0.28, 0, 0.76, 0.04, 0.22, 0, 0);
    // Fierce Goblin Head with huge pointed 3D ears & snout!
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 1.14, 0.14);
    bodyPivot.add(headPivot);
    add(headPivot, g.unitSphere12, skinMat, 0.26, 0.24, 0.26, 0, 0.10, 0);
    add(headPivot, g.unitCone8, skinMat, 0.09, 0.18, 0.09, 0, 0.05, 0.26, Math.PI * 0.45, 0, 0, false);
    for (const s of [-1, 1]) {
      add(headPivot, g.unitCone8, skinMat, 0.075, 0.34, 0.055, s * 0.30, 0.14, -0.02, 0, 0, s * -1.25, false);
      add(headPivot, g.unitSphere8, glowEyeMat, 0.055, 0.05, 0.04, s * 0.10, 0.14, 0.22, 0, 0, 0, false);
    }
    // Iron pot-helmet cap
    add(headPivot, g.unitSphere12, ironMat, 0.27, 0.15, 0.27, 0, 0.22, -0.02);

    // Articulated Arms + Spiked Wooden Club & Crude Buckler
    const armLPivot = new THREE.Group();
    armLPivot.position.set(-0.34, 0.96, 0.06);
    const armRPivot = new THREE.Group();
    armRPivot.position.set(0.34, 0.96, 0.06);
    bodyPivot.add(armLPivot, armRPivot);
    add(armLPivot, g.unitCyl8, skinMat, 0.068, 0.44, 0.068, 0, -0.20, 0.04);
    add(armLPivot, g.unitCyl12, ironMat, 0.22, 0.05, 0.22, -0.08, -0.34, 0.14, Math.PI * 0.5, 0, 0);
    add(armRPivot, g.unitCyl8, skinMat, 0.068, 0.44, 0.068, 0, -0.20, 0.04);
    add(armRPivot, g.unitCone8, woodMat, 0.10, 0.62, 0.10, 0, -0.42, 0.26, 1.35, 0, 0);

    return { rigGroup, bodyPivot, headPivot, armLPivot, armRPivot, legLPivot, legRPivot, flashMaterials, ownedMaterials };
  }

  if (kind === 'knight') {
    // TALL TOWERING 3D DARK KNIGHT (~2.65 units tall!)
    const steelMat = mkMat({ color: colorHex, metalness: 0.88, roughness: 0.24 });
    const trimMat = mkMat({ color: accentHex, metalness: 0.9, roughness: 0.2 });
    const capeMat = mkMat({ color: '#312e81', roughness: 0.78, side: THREE.DoubleSide });

    const legLPivot = new THREE.Group();
    legLPivot.position.set(-0.20, 1.02, 0);
    const legRPivot = new THREE.Group();
    legRPivot.position.set(0.20, 1.02, 0);
    bodyPivot.add(legLPivot, legRPivot);
    for (const lp of [legLPivot, legRPivot]) {
      add(lp, g.unitCyl12, steelMat, 0.13, 0.98, 0.14, 0, -0.49, 0);
      add(lp, g.unitSphere8, trimMat, 0.14, 0.14, 0.15, 0, -0.48, 0.04, 0, 0, 0, false);
      add(lp, g.unitBox, steelMat, 0.24, 0.16, 0.34, 0, -0.94, 0.08);
    }

    // Broad Heavy Armored Cuirass + Spiked Pauldrons
    add(bodyPivot, g.unitCyl12, steelMat, 0.42, 0.92, 0.32, 0, 1.48, 0);
    add(bodyPivot, g.unitBox, trimMat, 0.56, 0.12, 0.40, 0, 1.06, 0, 0, 0, 0, false);
    for (const s of [-1, 1]) {
      add(bodyPivot, g.unitSphere12, steelMat, 0.24, 0.20, 0.24, s * 0.46, 1.88, 0);
      add(bodyPivot, g.unitCone8, trimMat, 0.06, 0.26, 0.06, s * 0.54, 2.08, 0, 0, 0, s * -0.45, false);
    }

    // Horned Greathelm with Blazing Visor Slit
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 2.02, 0);
    bodyPivot.add(headPivot);
    add(headPivot, g.unitCyl12, steelMat, 0.24, 0.42, 0.26, 0, 0.22, 0);
    add(headPivot, g.unitSphere12, steelMat, 0.25, 0.18, 0.26, 0, 0.40, 0);
    add(headPivot, g.unitBox, glowEyeMat, 0.28, 0.055, 0.05, 0, 0.24, 0.24, 0, 0, 0, false);
    for (const s of [-1, 1]) {
      add(headPivot, g.unitCone8, trimMat, 0.055, 0.34, 0.055, s * 0.22, 0.44, 0.04, 0.25, 0, s * -0.68, false);
    }

    // Billowing Dark Cape
    const capePivot = new THREE.Group();
    capePivot.position.set(0, 1.92, -0.24);
    const capeMesh = new THREE.Mesh(g.capeSheet, capeMat);
    capeMesh.scale.set(1.38, 1.48, 1.1);
    if (castShadow) capeMesh.castShadow = true;
    capePivot.add(capeMesh);
    bodyPivot.add(capePivot);

    // Arms + Heavy Greatsword & Tower Shield
    const armLPivot = new THREE.Group();
    armLPivot.position.set(-0.48, 1.80, 0);
    const armRPivot = new THREE.Group();
    armRPivot.position.set(0.48, 1.80, 0);
    bodyPivot.add(armLPivot, armRPivot);
    add(armLPivot, g.unitCyl12, steelMat, 0.11, 0.72, 0.11, 0, -0.34, 0);
    add(armLPivot, g.unitBox, steelMat, 0.44, 0.78, 0.08, -0.14, -0.46, 0.20, 0, -0.45, 0);
    add(armLPivot, g.unitOcta, trimMat, 0.10, 0.16, 0.06, -0.18, -0.46, 0.26, 0, -0.45, 0, false);

    add(armRPivot, g.unitCyl12, steelMat, 0.11, 0.72, 0.11, 0, -0.34, 0);
    add(armRPivot, g.unitBox, trimMat, 0.36, 0.07, 0.08, 0, -0.68, 0.22, 1.25, 0, 0, false);
    add(armRPivot, g.unitBox, trimMat, 0.11, 1.32, 0.036, 0, -0.52, 0.86, 1.25, 0, 0);

    return { rigGroup, bodyPivot, headPivot, armLPivot, armRPivot, legLPivot, legRPivot, capePivot, flashMaterials, ownedMaterials };
  }

  if (kind === 'mage') {
    // TALL FLOATING 3D DARM WARLOCK (~2.55 units tall!)
    const robeMat = mkMat({ color: colorHex, roughness: 0.76, metalness: 0.12 });
    const crystalMat = mkMat({ color: accentHex, emissive: accentHex, emissiveIntensity: 0.85, roughness: 0.18 });
    const darkVoidMat = mkMat({ color: '#090d1a', roughness: 0.9 }, false);

    // Tall Flowing Arcane Robe hovering smoothly above ground!
    add(bodyPivot, g.robeBell, robeMat, 1.48, 1.72, 1.48, 0, 0.18, 0);
    add(bodyPivot, g.unitCyl12, crystalMat, 0.54, 0.06, 0.54, 0, 0.26, 0, 0, 0, 0, false);

    // Pointed Hood & Glowing Arcane Eyes in Shadow
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 1.92, 0);
    bodyPivot.add(headPivot);
    add(headPivot, g.unitSphere12, darkVoidMat, 0.22, 0.24, 0.22, 0, 0.16, 0.02, 0, 0, 0, false);
    add(headPivot, g.unitCone8, robeMat, 0.34, 0.68, 0.34, 0, 0.42, -0.04, -0.18, 0, 0);
    for (const s of [-1, 1]) {
      add(headPivot, g.unitSphere8, glowEyeMat, 0.048, 0.042, 0.04, s * 0.085, 0.18, 0.22, 0, 0, 0, false);
    }

    // Wide Sleeved Arms + Gnarled Staff with Glowing Crystal Orb
    const armLPivot = new THREE.Group();
    armLPivot.position.set(-0.38, 1.72, 0.04);
    const armRPivot = new THREE.Group();
    armRPivot.position.set(0.38, 1.72, 0.04);
    bodyPivot.add(armLPivot, armRPivot);
    add(armLPivot, g.unitCone8, robeMat, 0.16, 0.64, 0.16, 0, -0.28, 0.08, -0.35, 0, 0.15);
    add(armRPivot, g.unitCone8, robeMat, 0.16, 0.64, 0.16, 0, -0.28, 0.08, -0.35, 0, -0.15);
    const staffMat = mkMat({ color: '#451a03', roughness: 0.8 });
    add(armRPivot, g.unitCyl8, staffMat, 0.042, 2.05, 0.042, 0.06, -0.15, 0.26, 0.18, 0, 0);
    const coreMesh = add(armRPivot, g.unitOcta, crystalMat, 0.16, 0.22, 0.16, 0.06, 0.92, 0.44, 0, 0, 0, false);

    // Orbiting Arcane Shards Ring
    const orbitRing = new THREE.Group();
    orbitRing.position.y = 1.38;
    for (let k = 0; k < 4; k++) {
      const ka = (k / 4) * Math.PI * 2;
      add(orbitRing, g.unitOcta, crystalMat, 0.08, 0.15, 0.08, Math.cos(ka) * 0.72, 0, Math.sin(ka) * 0.72, 0, 0, 0, false);
    }
    bodyPivot.add(orbitRing);

    return { rigGroup, bodyPivot, headPivot, armLPivot, armRPivot, orbitRing, coreMesh, flashMaterials, ownedMaterials };
  }

  if (kind === 'wyvern') {
    // TALL SWEEPING 3D CRIMSON WYVERN (~2.6 units high, 3.0 wingspan!)
    const scaleMat = mkMat({ color: colorHex, roughness: 0.42, metalness: 0.22 });
    const bellyMat = mkMat({ color: accentHex, roughness: 0.56 });
    const wingMemMat = mkMat({ color: '#7f1d1d', roughness: 0.55, side: THREE.DoubleSide });

    // Sinuous Drake Body hovering aloft
    add(bodyPivot, g.unitSphere16, scaleMat, 0.42, 0.38, 0.72, 0, 1.55, 0, -0.25, 0, 0);
    add(bodyPivot, g.unitSphere12, bellyMat, 0.34, 0.26, 0.56, 0, 1.44, 0.08, -0.25, 0, 0, false);

    // Horned Dragon Head & Long Neck
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 1.82, 0.52);
    bodyPivot.add(headPivot);
    add(headPivot, g.unitCyl12, scaleMat, 0.16, 0.52, 0.16, 0, 0.14, 0.12, 0.55, 0, 0);
    add(headPivot, g.unitBox, scaleMat, 0.32, 0.26, 0.48, 0, 0.36, 0.38);
    add(headPivot, g.unitCone8, scaleMat, 0.14, 0.34, 0.14, 0, 0.32, 0.72, Math.PI * 0.5, 0, 0);
    for (const s of [-1, 1]) {
      add(headPivot, g.unitCone8, bellyMat, 0.05, 0.38, 0.05, s * 0.14, 0.56, 0.18, -0.75, 0, s * -0.32, false);
      add(headPivot, g.unitSphere8, glowEyeMat, 0.055, 0.05, 0.05, s * 0.15, 0.40, 0.52, 0, 0, 0, false);
    }

    // Sweeping Articulated Left & Right Bat-Dragon Wings!
    const wingLPivot = new THREE.Group();
    wingLPivot.position.set(-0.34, 1.72, 0.06);
    const wingRPivot = new THREE.Group();
    wingRPivot.position.set(0.34, 1.72, 0.06);
    bodyPivot.add(wingLPivot, wingRPivot);
    for (const [wp, s] of [
      [wingLPivot, -1],
      [wingRPivot, 1],
    ] as const) {
      add(wp, g.unitCyl8, scaleMat, 0.055, 1.38, 0.055, s * 0.65, 0.18, 0.08, 0, 0, s * -1.32);
      add(wp, g.unitBox, wingMemMat, 1.32, 0.04, 0.78, s * 0.68, 0.08, -0.22, 0.14, 0, s * 0.18);
      add(wp, g.unitCone8, bellyMat, 0.05, 0.24, 0.05, s * 1.30, 0.34, 0.14, 0, 0, s * -0.45, false);
    }

    // Swaying Barbed Tail
    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, 1.38, -0.58);
    add(tailPivot, g.unitCone8, scaleMat, 0.16, 1.25, 0.16, 0, -0.18, -0.56, -Math.PI * 0.42, 0, 0);
    add(tailPivot, g.unitOcta, bellyMat, 0.14, 0.18, 0.14, 0, -0.34, -1.16, 0, 0, 0, false);
    bodyPivot.add(tailPivot);

    return { rigGroup, bodyPivot, headPivot, wingLPivot, wingRPivot, tailPivot, flashMaterials, ownedMaterials };
  }

  // COLOSSAL 3D BOSS OVERLORD (~4.15 units tall!)
  const obsidianMat = mkMat({ color: colorHex, metalness: 0.84, roughness: 0.24 });
  const goldTrimMat = mkMat({ color: accentHex, metalness: 0.92, roughness: 0.18 });
  const coreGlowMat = mkMat({ color: accentHex, emissive: accentHex, emissiveIntensity: 1.1, roughness: 0.15 });
  const capeMat = mkMat({ color: '#450a0a', roughness: 0.75, side: THREE.DoubleSide });

  const legLPivot = new THREE.Group();
  legLPivot.position.set(-0.38, 1.55, 0);
  const legRPivot = new THREE.Group();
  legRPivot.position.set(0.38, 1.55, 0);
  bodyPivot.add(legLPivot, legRPivot);
  for (const lp of [legLPivot, legRPivot]) {
    add(lp, g.unitCyl12, obsidianMat, 0.24, 1.50, 0.26, 0, -0.75, 0);
    add(lp, g.unitBox, goldTrimMat, 0.38, 0.22, 0.48, 0, -1.42, 0.12);
  }

  // Monumental Chest + Blazing Runic Core + Massive Horned Pauldrons
  add(bodyPivot, g.unitCyl12, obsidianMat, 0.72, 1.48, 0.52, 0, 2.26, 0);
  const coreMesh = add(bodyPivot, g.unitOcta, coreGlowMat, 0.28, 0.38, 0.22, 0, 2.38, 0.48, 0, 0, 0, false);
  for (const s of [-1, 1]) {
    add(bodyPivot, g.unitSphere12, obsidianMat, 0.44, 0.36, 0.42, s * 0.84, 2.86, 0);
    add(bodyPivot, g.unitCone8, goldTrimMat, 0.11, 0.56, 0.11, s * 0.98, 3.24, 0, 0, 0, s * -0.48, false);
  }

  // Crowned Demon-Lord Head + Sweeping Curved Horns
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 3.06, 0.05);
  bodyPivot.add(headPivot);
  add(headPivot, g.unitSphere12, obsidianMat, 0.36, 0.42, 0.38, 0, 0.34, 0);
  add(headPivot, g.unitBox, glowEyeMat, 0.40, 0.09, 0.08, 0, 0.36, 0.34, 0, 0, 0, false);
  for (const s of [-1, 1]) {
    add(headPivot, g.unitCone8, goldTrimMat, 0.10, 0.78, 0.10, s * 0.38, 0.68, 0.06, 0.28, 0, s * -0.62);
  }

  // Colossal Billowing Cape
  const capePivot = new THREE.Group();
  capePivot.position.set(0, 2.92, -0.42);
  const capeMesh = new THREE.Mesh(g.capeSheet, capeMat);
  capeMesh.scale.set(2.35, 2.45, 1.4);
  if (castShadow) capeMesh.castShadow = true;
  capePivot.add(capeMesh);
  bodyPivot.add(capePivot);

  // Articulated Titan Arms + Colossal Runic Greatsword
  const armLPivot = new THREE.Group();
  armLPivot.position.set(-0.88, 2.74, 0);
  const armRPivot = new THREE.Group();
  armRPivot.position.set(0.88, 2.74, 0);
  bodyPivot.add(armLPivot, armRPivot);
  add(armLPivot, g.unitCyl12, obsidianMat, 0.20, 1.18, 0.20, 0, -0.56, 0);
  add(armRPivot, g.unitCyl12, obsidianMat, 0.20, 1.18, 0.20, 0, -0.56, 0);
  add(armRPivot, g.unitBox, goldTrimMat, 0.58, 0.12, 0.14, 0, -1.06, 0.34, 1.18, 0, 0, false);
  add(armRPivot, g.unitBox, coreGlowMat, 0.19, 2.15, 0.065, 0, -0.78, 1.38, 1.18, 0, 0);

  // Orbiting Floating Boss Rune Ring
  const orbitRing = new THREE.Group();
  orbitRing.position.y = 2.45;
  for (let k = 0; k < 6; k++) {
    const ka = (k / 6) * Math.PI * 2;
    add(orbitRing, g.unitOcta, coreGlowMat, 0.12, 0.24, 0.12, Math.cos(ka) * 1.45, 0, Math.sin(ka) * 1.45, 0, 0, 0, false);
  }
  bodyPivot.add(orbitRing);

  return { rigGroup, bodyPivot, headPivot, armLPivot, armRPivot, legLPivot, legRPivot, capePivot, orbitRing, coreMesh, flashMaterials, ownedMaterials };
}

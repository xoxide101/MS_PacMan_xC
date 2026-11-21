// Procedural PBR CanvasTextures & Articulated 3-12 Part Composite 3D Models for Gauntlet: Dark Legacy
import * as THREE from 'three';
import {
  ELEMENT_COLORS,
  ElementColorId,
  HERO_MAP,
  HeroClassId,
  RealmDef,
  RealmId,
} from './typesAndData';

// ---------------------------------------------------------------------------
// Procedural CanvasTexture Factory (SRGBColorSpace + max anisotropy)
// ---------------------------------------------------------------------------
export interface RealmTextureSet {
  floor: THREE.CanvasTexture;
  wall: THREE.CanvasTexture;
  pillar: THREE.CanvasTexture;
  hazard: THREE.CanvasTexture;
  crackedWall: THREE.CanvasTexture;
}

function makeCanvasTexture(
  size: number,
  draw: (ctx: CanvasRenderingContext2D, s: number) => void,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createRealmTextures(
  realmId: RealmId,
  realm: RealmDef | null,
  maxAniso: number
): RealmTextureSet {
  // Authentic 2000 Midway Gauntlet: Dark Legacy earthy medieval gothic stone palettes
  const floorBase = realm ? realm.floorHex : '#5a4a3a';
  const floorAcc = realm ? realm.floorAccentHex : '#46382b';
  const wallBase = realm ? realm.wallHex : '#4e4238';
  const wallAcc = realm ? realm.wallAccentHex : '#6b5b4b';
  const hazHex = realm ? realm.hazardHex : '#f97316';

  const floor = makeCanvasTexture(
    256,
    (ctx, s) => {
      ctx.fillStyle = floorBase;
      ctx.fillRect(0, 0, s, s);
      // Hand-hewn irregular medieval cobblestones & worn flagstones (NOT neon checkerboard!)
      const rows = 4;
      const rowH = s / rows;
      for (let r = 0; r < rows; r++) {
        const shift = (r % 2) * 34;
        for (let bx = -48; bx < s + 48; bx += 64) {
          const x = bx + shift;
          const y = r * rowH;
          const v = ((r * 13 + Math.abs(bx) * 7) % 5) / 5;
          ctx.fillStyle = v > 0.55 ? floorAcc : floorBase;
          ctx.fillRect(x + 2, y + 2, 60, rowH - 4);
          // Warm worn stone top highlight
          ctx.fillStyle = 'rgba(255, 232, 195, 0.1)';
          ctx.fillRect(x + 4, y + 4, 56, 5);
          // Deep shadowed mortar seam
          ctx.strokeStyle = 'rgba(12, 8, 5, 0.62)';
          ctx.lineWidth = 3;
          ctx.strokeRect(x + 1, y + 1, 62, rowH - 2);
          // Subtle weathered stone fissure
          if (v > 0.65) {
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.34)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(x + 14, y + 10);
            ctx.lineTo(x + 28, y + 26);
            ctx.lineTo(x + 42, y + 22);
            ctx.stroke();
          }
        }
      }
      // Organic stone grit, dirt & subtle moss speckles
      for (let i = 0; i < 650; i++) {
        const px = (i * 73 + 11) % s;
        const py = (i * 137 + 29) % s;
        ctx.fillStyle =
          i % 11 === 0 && realmId !== 'ice' && realmId !== 'desert'
            ? 'rgba(72, 102, 56, 0.22)'
            : i % 2 === 0
              ? 'rgba(255, 240, 210, 0.06)'
              : 'rgba(10, 6, 4, 0.18)';
        ctx.fillRect(px, py, 2 + (i % 2), 2);
      }
      if (realmId === 'hub') {
        // Sumner's Tower authentic warm carved sandstone & antique bronze compass inlay
        ctx.strokeStyle = 'rgba(217, 165, 68, 0.38)';
        ctx.lineWidth = 3;
        ctx.strokeRect(10, 10, s - 20, s - 20);
        ctx.beginPath();
        ctx.arc(s / 2, s / 2, s * 0.26, 0, Math.PI * 2);
        ctx.stroke();
      }
    },
    maxAniso
  );

  const wall = makeCanvasTexture(
    256,
    (ctx, s) => {
      ctx.fillStyle = wallBase;
      ctx.fillRect(0, 0, s, s);
      // Heavy chiseled medieval castle ashlar masonry courses
      const rows = 5;
      const rowH = s / rows;
      for (let r = 0; r < rows; r++) {
        const offset = (r % 2) * 42;
        for (let bx = -64; bx < s + 64; bx += 84) {
          const x = bx + offset;
          const y = r * rowH;
          const alt = ((r * 7 + Math.abs(bx)) % 3) === 0;
          ctx.fillStyle = alt ? wallAcc : wallBase;
          ctx.fillRect(x + 2, y + 2, 80, rowH - 4);
          // Chiseled upper bevel catching torchlight
          ctx.fillStyle = 'rgba(255, 232, 195, 0.14)';
          ctx.fillRect(x + 3, y + 3, 78, 4);
          // Deep recessed underside shadow
          ctx.fillStyle = 'rgba(10, 6, 4, 0.38)';
          ctx.fillRect(x + 3, y + rowH - 6, 78, 4);
          // Thick medieval mortar joint
          ctx.strokeStyle = 'rgba(10, 6, 4, 0.68)';
          ctx.lineWidth = 3.5;
          ctx.strokeRect(x + 1, y + 1, 82, rowH - 2);
        }
      }
      // Weathered stone grain & bottom grime gradient
      const grime = ctx.createLinearGradient(0, s * 0.62, 0, s);
      grime.addColorStop(0, 'rgba(0,0,0,0)');
      grime.addColorStop(1, 'rgba(15, 10, 6, 0.45)');
      ctx.fillStyle = grime;
      ctx.fillRect(0, s * 0.62, s, s * 0.38);

      // Carved stone cornice molding along top edge
      ctx.fillStyle = 'rgba(225, 200, 160, 0.2)';
      ctx.fillRect(0, 0, s, 12);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(0, 12, s, 4);
    },
    maxAniso
  );

  const pillar = makeCanvasTexture(
    128,
    (ctx, s) => {
      ctx.fillStyle = wallAcc;
      ctx.fillRect(0, 0, s, s);
      // Fluted gothic limestone column channels
      for (let x = 0; x < s; x += 16) {
        ctx.fillStyle = 'rgba(12, 8, 5, 0.32)';
        ctx.fillRect(x, 0, 5, s);
        ctx.fillStyle = 'rgba(255, 238, 210, 0.16)';
        ctx.fillRect(x + 6, 0, 3, s);
      }
      // Hammered antique bronze column collars
      ctx.fillStyle = '#9a7132';
      ctx.fillRect(0, 10, s, 10);
      ctx.fillRect(0, s - 20, s, 10);
      ctx.strokeStyle = 'rgba(20, 12, 5, 0.65)';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 10, s, 10);
      ctx.strokeRect(0, s - 20, s, 10);
    },
    maxAniso
  );

  const hazard = makeCanvasTexture(
    128,
    (ctx, s) => {
      ctx.fillStyle = '#140808';
      ctx.fillRect(0, 0, s, s);
      const grad = ctx.createRadialGradient(s / 2, s / 2, 8, s / 2, s / 2, s * 0.65);
      grad.addColorStop(0, '#fef08a');
      grad.addColorStop(0.45, hazHex);
      grad.addColorStop(1, '#1a0a0a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, s, s);
      // Crusty cooled magma / swamp bubble veins
      ctx.strokeStyle = 'rgba(255, 224, 150, 0.55)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(0, (i * 22 + 8) % s);
        ctx.quadraticCurveTo(s * 0.5, (i * 35 + 24) % s, s, (i * 19 + 14) % s);
        ctx.stroke();
      }
    },
    maxAniso
  );

  const crackedWall = makeCanvasTexture(
    256,
    (ctx, s) => {
      ctx.fillStyle = wallBase;
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = 'rgba(10, 6, 4, 0.6)';
      ctx.lineWidth = 3;
      for (let y = 0; y < s; y += 52) {
        ctx.strokeRect(2, y + 2, s - 4, 48);
      }
      // Deep jagged dark fracture lines with subtle golden treasure glint inside!
      ctx.strokeStyle = '#0c0805';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(s * 0.25, 0);
      ctx.lineTo(s * 0.48, s * 0.34);
      ctx.lineTo(s * 0.36, s * 0.62);
      ctx.lineTo(s * 0.68, s);
      ctx.moveTo(s * 0.48, s * 0.34);
      ctx.lineTo(s * 0.78, s * 0.48);
      ctx.stroke();
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2;
      ctx.stroke();
    },
    maxAniso
  );

  return { floor, wall, pillar, hazard, crackedWall };
}

export function disposeRealmTextures(set: RealmTextureSet): void {
  set.floor.dispose();
  set.wall.dispose();
  set.pillar.dispose();
  set.hazard.dispose();
  set.crackedWall.dispose();
}

// ---------------------------------------------------------------------------
// Articulated Composite 3D Hero Builder (8 Core + 4 Secret Classes × 4 Colors)
// ---------------------------------------------------------------------------
export interface HeroRig {
  root: THREE.Group;
  body: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  rightArm: THREE.Group;
  leftArm: THREE.Group;
  cape: THREE.Mesh;
  auraRing: THREE.Mesh;
  haloRing: THREE.Mesh;
  shieldDome: THREE.Mesh;
  phoenixGroup: THREE.Group;
}

export function buildHeroModel(
  heroId: HeroClassId,
  colorId: ElementColorId,
  level: number
): HeroRig {
  const el = ELEMENT_COLORS[colorId];
  const hero = HERO_MAP[heroId];
  const primary = new THREE.Color(el.primaryHex);
  const glow = new THREE.Color(el.glowHex);
  const accent = new THREE.Color(hero.accentHex);

  const isHeavy = heroId === 'knight' || heroId === 'dwarf' || heroId === 'minotaur' || heroId === 'ogre';
  const isTall = heroId === 'minotaur' || heroId === 'ogre';
  const isShort = heroId === 'dwarf';

  const scaleY = isTall ? 1.18 : isShort ? 0.84 : 1.0;
  const scaleW = isHeavy ? 1.14 : 0.96;

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const armorMat = new THREE.MeshStandardMaterial({
    color: primary,
    roughness: isHeavy ? 0.34 : 0.55,
    metalness: isHeavy ? 0.62 : 0.22,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: level >= 5 ? 0xfbbf24 : accent,
    roughness: 0.28,
    metalness: 0.78,
    emissive: level >= 10 ? glow : new THREE.Color(0x000000),
    emissiveIntensity: level >= 10 ? 0.35 : 0,
  });
  const skinColor =
    heroId === 'minotaur'
      ? 0x7c4a2b
      : heroId === 'ogre'
        ? 0x5f7d3a
        : heroId === 'medusa'
          ? 0x6ba878
          : heroId === 'jackal'
            ? 0x262630
            : 0xf1c29b;
  const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.68, metalness: 0.05 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.75, metalness: 0.2 });
  const weaponMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.22,
    metalness: 0.88,
    emissive: glow,
    emissiveIntensity: 0.25,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: glow,
    emissive: glow,
    emissiveIntensity: 1.5,
    roughness: 0.2,
  });

  // Legs
  const legGeo = new THREE.CylinderGeometry(0.13 * scaleW, 0.11 * scaleW, 0.56 * scaleY, 8);
  const leftLeg = new THREE.Mesh(legGeo, darkMat);
  leftLeg.position.set(-0.18 * scaleW, 0.28 * scaleY, 0);
  leftLeg.castShadow = true;
  const rightLeg = new THREE.Mesh(legGeo, darkMat);
  rightLeg.position.set(0.18 * scaleW, 0.28 * scaleY, 0);
  rightLeg.castShadow = true;
  body.add(leftLeg, rightLeg);

  // Torso (Tapered breastplate / robe)
  const torsoH = 0.68 * scaleY;
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32 * scaleW, 0.25 * scaleW, torsoH, 8),
    armorMat
  );
  torso.position.y = 0.56 * scaleY + torsoH * 0.5;
  torso.castShadow = true;
  body.add(torso);

  // Belt & Chest Crest
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.56 * scaleW, 0.12, 0.44 * scaleW), trimMat);
  belt.position.y = 0.62 * scaleY;
  body.add(belt);

  // Shoulder Pauldrons
  const pauldronGeo = new THREE.SphereGeometry(0.17 * scaleW, 10, 8);
  const leftPauldron = new THREE.Mesh(pauldronGeo, trimMat);
  leftPauldron.position.set(-0.38 * scaleW, 1.12 * scaleY, 0);
  const rightPauldron = new THREE.Mesh(pauldronGeo, trimMat);
  rightPauldron.position.set(0.38 * scaleW, 1.12 * scaleY, 0);
  body.add(leftPauldron, rightPauldron);

  // Flowing Cape
  const cape = new THREE.Mesh(
    new THREE.BoxGeometry(0.58 * scaleW, 0.85 * scaleY, 0.06),
    new THREE.MeshStandardMaterial({ color: el.darkHex, roughness: 0.8, side: THREE.DoubleSide })
  );
  cape.position.set(0, 0.86 * scaleY, -0.24 * scaleW);
  cape.rotation.x = 0.2;
  body.add(cape);

  // Head + Class-Specific Helmet / Hat / Horns
  const headY = 1.44 * scaleY;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), skinMat);
  head.position.y = headY;
  head.castShadow = true;
  body.add(head);

  if (heroId === 'knight') {
    const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.27, 0.3, 10), trimMat);
    helm.position.y = headY + 0.04;
    const plume = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.24, 0.42), armorMat);
    plume.position.set(0, headY + 0.24, -0.04);
    body.add(helm, plume);
  } else if (heroId === 'valkyrie') {
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), trimMat);
    helm.position.y = headY + 0.03;
    const wingGeo = new THREE.BoxGeometry(0.05, 0.28, 0.16);
    const wingL = new THREE.Mesh(wingGeo, weaponMat);
    wingL.position.set(-0.27, headY + 0.14, -0.02);
    wingL.rotation.z = 0.42;
    const wingR = new THREE.Mesh(wingGeo, weaponMat);
    wingR.position.set(0.27, headY + 0.14, -0.02);
    wingR.rotation.z = -0.42;
    body.add(helm, wingL, wingR);
  } else if (heroId === 'wizard' || heroId === 'sumner') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 14), armorMat);
    brim.position.y = headY + 0.16;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.58, 12), armorMat);
    cone.position.set(0, headY + 0.44, -0.04);
    cone.rotation.x = -0.18;
    const beard = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.34, 8), weaponMat);
    beard.position.set(0, headY - 0.18, 0.16);
    beard.rotation.x = Math.PI;
    body.add(brim, cone, beard);
  } else if (heroId === 'archer') {
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.34, 10), armorMat);
    hood.position.set(0, headY + 0.18, -0.05);
    hood.rotation.x = -0.25;
    body.add(hood);
  } else if (heroId === 'jester') {
    const hornGeo = new THREE.ConeGeometry(0.11, 0.4, 8);
    const hL = new THREE.Mesh(hornGeo, armorMat);
    hL.position.set(-0.2, headY + 0.25, 0);
    hL.rotation.z = 0.65;
    const hR = new THREE.Mesh(hornGeo, trimMat);
    hR.position.set(0.2, headY + 0.25, 0);
    hR.rotation.z = -0.65;
    body.add(hL, hR);
  } else if (heroId === 'dwarf') {
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), trimMat);
    helm.position.y = headY + 0.04;
    const beard = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.18), new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.8 }));
    beard.position.set(0, headY - 0.16, 0.15);
    const hornGeo = new THREE.ConeGeometry(0.06, 0.24, 6);
    const hL = new THREE.Mesh(hornGeo, weaponMat);
    hL.position.set(-0.26, headY + 0.16, 0);
    hL.rotation.z = 0.85;
    const hR = new THREE.Mesh(hornGeo, weaponMat);
    hR.position.set(0.26, headY + 0.16, 0);
    hR.rotation.z = -0.85;
    body.add(helm, beard, hL, hR);
  } else if (heroId === 'sorceress' || heroId === 'medusa') {
    const crown = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 6, 12), trimMat);
    crown.position.y = headY + 0.18;
    crown.rotation.x = Math.PI / 2;
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), glowMat);
    gem.position.set(0, headY + 0.26, 0.18);
    body.add(crown, gem);
  } else if (heroId === 'minotaur' || heroId === 'jackal' || heroId === 'ogre') {
    const hornGeo = new THREE.ConeGeometry(0.08, 0.44, 7);
    const hL = new THREE.Mesh(hornGeo, weaponMat);
    hL.position.set(-0.26, headY + 0.2, 0.05);
    hL.rotation.z = 0.72;
    const hR = new THREE.Mesh(hornGeo, weaponMat);
    hR.position.set(0.26, headY + 0.2, 0.05);
    hR.rotation.z = -0.72;
    body.add(hL, hR);
  }

  // Right Arm + Class Signature Weapon
  const rightArm = new THREE.Group();
  rightArm.position.set(0.42 * scaleW, 1.05 * scaleY, 0.05);
  body.add(rightArm);

  const armMeshR = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.48, 8), armorMat);
  armMeshR.position.y = -0.18;
  rightArm.add(armMeshR);

  if (heroId === 'wizard' || heroId === 'sumner') {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 1.55, 8), trimMat);
    shaft.position.set(0, 0.1, 0.35);
    shaft.rotation.x = Math.PI * 0.35;
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.17), glowMat);
    orb.position.set(0, 0.52, 0.85);
    rightArm.add(shaft, orb);
  } else if (heroId === 'archer' || heroId === 'medusa') {
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 6, 14, Math.PI * 1.1), trimMat);
    bow.position.set(0, -0.05, 0.32);
    bow.rotation.y = Math.PI / 2;
    bow.rotation.z = -Math.PI * 0.55;
    rightArm.add(bow);
  } else if (heroId === 'dwarf' || heroId === 'ogre') {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 1.1, 8), darkMat);
    handle.position.set(0, -0.02, 0.45);
    handle.rotation.x = Math.PI * 0.44;
    const headHammer = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.26, 0.26), weaponMat);
    headHammer.position.set(0, 0.08, 0.92);
    rightArm.add(handle, headHammer);
  } else if (heroId === 'minotaur' || heroId === 'valkyrie') {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.45, 8), darkMat);
    pole.position.set(0, 0.04, 0.48);
    pole.rotation.x = Math.PI * 0.42;
    const axeBlade = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.34), weaponMat);
    axeBlade.position.set(0, 0.18, 1.05);
    rightArm.add(pole, axeBlade);
  } else if (heroId === 'sorceress' || heroId === 'jester') {
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 0), glowMat);
    orb.position.set(0, -0.08, 0.52);
    rightArm.add(orb);
  } else {
    // Knight / Jackal Broadsword
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 1.05), weaponMat);
    blade.position.set(0, -0.1, 0.62);
    const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.08), trimMat);
    hilt.position.set(0, -0.1, 0.14);
    rightArm.add(blade, hilt);
  }

  // Left Arm + Shield / Offhand Orb
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.42 * scaleW, 1.05 * scaleY, 0.05);
  body.add(leftArm);
  const armMeshL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.46, 8), armorMat);
  armMeshL.position.y = -0.18;
  leftArm.add(armMeshL);

  if (heroId === 'knight' || heroId === 'valkyrie' || heroId === 'dwarf') {
    const shield = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.58, 0.08), armorMat);
    shield.position.set(-0.08, -0.1, 0.28);
    const boss = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), trimMat);
    boss.position.set(-0.08, -0.1, 0.33);
    leftArm.add(shield, boss);
  } else if (heroId === 'sorceress' || heroId === 'wizard') {
    const offOrb = new THREE.Mesh(new THREE.OctahedronGeometry(0.14), glowMat);
    offOrb.position.set(-0.06, -0.06, 0.34);
    leftArm.add(offOrb);
  }

  // Classic Gauntlet P1–P4 Ground Medallion Ring (subtle metallic team indicator, no neon glare)
  const auraRing = new THREE.Mesh(
    new THREE.RingGeometry(0.56, 0.68, 24),
    new THREE.MeshBasicMaterial({
      color: primary,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
    })
  );
  auraRing.rotation.x = -Math.PI / 2;
  auraRing.position.y = 0.04;
  root.add(auraRing);

  // Anti-Death Golden Halo (hidden until Relic active)
  const haloRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.055, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xfde047 })
  );
  haloRing.rotation.x = Math.PI / 2;
  haloRing.position.y = headY + 0.56;
  haloRing.visible = false;
  root.add(haloRing);

  // Reflect Shield Dome (hidden until Relic active)
  const shieldDome = new THREE.Mesh(
    new THREE.SphereGeometry(1.15, 16, 12),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.28,
      roughness: 0.1,
    })
  );
  shieldDome.position.y = 0.9;
  shieldDome.visible = false;
  root.add(shieldDome);

  // Orbiting Phoenix Familiar (hidden until Relic active)
  const phoenixGroup = new THREE.Group();
  const pBody = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 0.45, 7),
    new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xfb923c, emissiveIntensity: 1.4 })
  );
  pBody.rotation.x = Math.PI / 2;
  const pWingGeo = new THREE.BoxGeometry(0.55, 0.04, 0.22);
  const pWings = new THREE.Mesh(
    pWingGeo,
    new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xf59e0b, emissiveIntensity: 1.3 })
  );
  phoenixGroup.add(pBody, pWings);
  phoenixGroup.visible = false;
  root.add(phoenixGroup);

  return {
    root,
    body,
    leftLeg,
    rightLeg,
    rightArm,
    leftArm,
    cape,
    auraRing,
    haloRing,
    shieldDome,
    phoenixGroup,
  };
}

// ---------------------------------------------------------------------------
// Composite 3D Enemy Models (Grunt, Skeleton, Golem, Gargoyle, Imp, General, Red Death)
// ---------------------------------------------------------------------------
export type EnemyKind = 'grunt' | 'skeleton' | 'golem' | 'gargoyle' | 'imp' | 'general' | 'death';

export function buildEnemyModel(kind: EnemyKind): THREE.Group {
  const g = new THREE.Group();

  if (kind === 'death') {
    // Iconic Gauntlet Red Death Reaper!
    const cloakMat = new THREE.MeshStandardMaterial({
      color: 0x450a0a,
      emissive: 0x7f1d1d,
      emissiveIntensity: 0.45,
      roughness: 0.7,
    });
    const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.58, 1.9, 10), cloakMat);
    cloak.position.y = 1.05;
    cloak.castShadow = true;
    const cowl = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), cloakMat);
    cowl.position.y = 1.95;
    const skull = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xfef2f2, roughness: 0.4 })
    );
    skull.position.set(0, 1.92, 0.14);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff1e1e });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), eyeMat);
    eyeL.position.set(-0.08, 1.95, 0.33);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), eyeMat);
    eyeR.position.set(0.08, 1.95, 0.33);
    // Scythe
    const staff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6),
      new THREE.MeshStandardMaterial({ color: 0x1e1b2e, metalness: 0.6 })
    );
    staff.position.set(0.48, 1.2, 0.28);
    staff.rotation.x = 0.25;
    const blade = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.055, 6, 12, Math.PI * 0.72),
      new THREE.MeshStandardMaterial({
        color: 0xfca5a5,
        emissive: 0xef4444,
        emissiveIntensity: 0.85,
        metalness: 0.9,
        roughness: 0.2,
      })
    );
    blade.position.set(0.45, 2.02, 0.52);
    blade.rotation.y = Math.PI / 2;
    g.add(cloak, cowl, skull, eyeL, eyeR, staff, blade);
    return g;
  }

  if (kind === 'golem') {
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.88, metalness: 0.15 });
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xf97316,
      emissiveIntensity: 1.5,
    });
    const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(0.68, 0), rockMat);
    torso.position.y = 1.22;
    torso.castShadow = true;
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.24), coreMat);
    core.position.set(0, 1.22, 0.52);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.36, 0.42), rockMat);
    head.position.y = 1.92;
    const armGeo = new THREE.BoxGeometry(0.32, 0.92, 0.34);
    const armL = new THREE.Mesh(armGeo, rockMat);
    armL.position.set(-0.78, 1.02, 0.1);
    const armR = new THREE.Mesh(armGeo, rockMat);
    armR.position.set(0.78, 1.02, 0.1);
    const legGeo = new THREE.BoxGeometry(0.34, 0.65, 0.36);
    const legL = new THREE.Mesh(legGeo, rockMat);
    legL.position.set(-0.32, 0.35, 0);
    const legR = new THREE.Mesh(legGeo, rockMat);
    legR.position.set(0.32, 0.35, 0);
    g.add(torso, core, head, armL, armR, legL, legR);
    return g;
  }

  if (kind === 'gargoyle') {
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x4c1d95, roughness: 0.55, metalness: 0.32 });
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x6d28d9, roughness: 0.6, side: THREE.DoubleSide });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.82, 8), stoneMat);
    body.position.y = 1.15;
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), stoneMat);
    head.position.set(0, 1.68, 0.08);
    const wingGeo = new THREE.BoxGeometry(0.88, 0.45, 0.05);
    const wingL = new THREE.Mesh(wingGeo, wingMat);
    wingL.position.set(-0.56, 1.38, -0.18);
    wingL.rotation.z = 0.25;
    wingL.name = 'wingL';
    const wingR = new THREE.Mesh(wingGeo, wingMat);
    wingR.position.set(0.56, 1.38, -0.18);
    wingR.rotation.z = -0.25;
    wingR.name = 'wingR';
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.05), eyeMat);
    eyeL.position.set(-0.08, 1.72, 0.28);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.05), eyeMat);
    eyeR.position.set(0.08, 1.72, 0.28);
    g.add(body, head, wingL, wingR, eyeL, eyeR);
    return g;
  }

  if (kind === 'skeleton') {
    const boneMat = new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.55 });
    const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.16, 0.62, 7), boneMat);
    rib.position.y = 0.94;
    rib.castShadow = true;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.22, 9, 8), boneMat);
    skull.position.y = 1.44;
    const legGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.6, 6);
    const legL = new THREE.Mesh(legGeo, boneMat);
    legL.position.set(-0.14, 0.32, 0);
    const legR = new THREE.Mesh(legGeo, boneMat);
    legR.position.set(0.14, 0.32, 0);
    const sword = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.05, 0.85),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.25 })
    );
    sword.position.set(0.32, 0.92, 0.45);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const eL = new THREE.Mesh(new THREE.SphereGeometry(0.045), eyeMat);
    eL.position.set(-0.07, 1.46, 0.19);
    const eR = new THREE.Mesh(new THREE.SphereGeometry(0.045), eyeMat);
    eR.position.set(0.07, 1.46, 0.19);
    g.add(rib, skull, legL, legR, sword, eL, eR);
    return g;
  }

  if (kind === 'imp') {
    const impMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.72, 8), impMat);
    body.position.y = 0.64;
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), impMat);
    head.position.y = 1.1;
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xf97316, emissiveIntensity: 1.4 })
    );
    orb.position.set(0.3, 0.9, 0.3);
    g.add(body, head, orb);
    return g;
  }

  if (kind === 'general') {
    // Armored Mini-Boss General
    const plateMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, metalness: 0.72, roughness: 0.3 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.85, roughness: 0.25 });
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.36, 1.05, 8), plateMat);
    torso.position.y = 1.08;
    torso.castShadow = true;
    const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.42, 8), goldMat);
    helm.position.y = 1.82;
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.52), plateMat);
    crest.position.y = 2.08;
    const pL = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), goldMat);
    pL.position.set(-0.54, 1.48, 0);
    const pR = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), goldMat);
    pR.position.set(0.54, 1.48, 0);
    const halberd = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.08, 1.55),
      new THREE.MeshStandardMaterial({ color: 0xf87171, emissive: 0xdc2626, emissiveIntensity: 0.6, metalness: 0.8 })
    );
    halberd.position.set(0.58, 1.15, 0.62);
    g.add(torso, helm, crest, pL, pR, halberd);
    return g;
  }

  // Default: Orc Grunt
  const skinMat = new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.7 });
  const armorMat = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.65, metalness: 0.3 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.26, 0.76, 8), armorMat);
  body.position.y = 0.82;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), skinMat);
  head.position.y = 1.38;
  const cleaver = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.24, 0.68),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.75, roughness: 0.3 })
  );
  cleaver.position.set(0.38, 0.92, 0.38);
  const legGeo = new THREE.CylinderGeometry(0.1, 0.09, 0.44, 6);
  const legL = new THREE.Mesh(legGeo, skinMat);
  legL.position.set(-0.15, 0.22, 0);
  const legR = new THREE.Mesh(legGeo, skinMat);
  legR.position.set(0.15, 0.22, 0);
  g.add(body, head, cleaver, legL, legR);
  return g;
}

// ---------------------------------------------------------------------------
// Towering Composite 3D Boss Models (All 9 Authentic Gauntlet: Dark Legacy Bosses!)
// ---------------------------------------------------------------------------
export function buildBossModel(bossType: RealmDef['bossType'], trueSkorne = false): THREE.Group {
  const g = new THREE.Group();

  if (bossType === 'dragon') {
    const scaleMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.38, metalness: 0.32 });
    const bellyMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5 });
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.55, side: THREE.DoubleSide });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.15, 2.2, 10), scaleMat);
    body.position.y = 1.5;
    body.castShadow = true;
    const belly = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.7, 0.7), bellyMat);
    belly.position.set(0, 1.45, 0.65);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.65, 1.4, 8), scaleMat);
    neck.position.set(0, 2.95, 0.55);
    neck.rotation.x = 0.35;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.72, 1.45), scaleMat);
    head.position.set(0, 3.55, 1.15);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const eL = new THREE.Mesh(new THREE.SphereGeometry(0.12), eyeMat);
    eL.position.set(-0.34, 3.72, 1.65);
    const eR = new THREE.Mesh(new THREE.SphereGeometry(0.12), eyeMat);
    eR.position.set(0.34, 3.72, 1.65);
    const wingGeo = new THREE.BoxGeometry(2.6, 1.4, 0.08);
    const wingL = new THREE.Mesh(wingGeo, wingMat);
    wingL.position.set(-1.85, 2.4, -0.3);
    wingL.rotation.z = 0.25;
    wingL.name = 'wingL';
    const wingR = new THREE.Mesh(wingGeo, wingMat);
    wingR.position.set(1.85, 2.4, -0.3);
    wingR.rotation.z = -0.25;
    wingR.name = 'wingR';
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.4, 8), scaleMat);
    tail.position.set(0, 0.8, -1.6);
    tail.rotation.x = -Math.PI * 0.42;
    g.add(body, belly, neck, head, eL, eR, wingL, wingR, tail);
    return g;
  }

  if (bossType === 'spider_queen') {
    const chMat = new THREE.MeshStandardMaterial({ color: 0x3f2e4f, roughness: 0.32, metalness: 0.45 });
    const sacMat = new THREE.MeshStandardMaterial({
      color: 0x65a30d,
      emissive: 0x4d7c0f,
      emissiveIntensity: 0.7,
      roughness: 0.35,
    });
    const abdomen = new THREE.Mesh(new THREE.SphereGeometry(1.35, 12, 10), sacMat);
    abdomen.position.set(0, 1.45, -1.0);
    abdomen.castShadow = true;
    const thorax = new THREE.Mesh(new THREE.SphereGeometry(0.85, 10, 8), chMat);
    thorax.position.set(0, 1.3, 0.6);
    const crown = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.08, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.9, roughness: 0.2 })
    );
    crown.position.set(0, 2.15, 0.65);
    crown.rotation.x = Math.PI / 2;
    g.add(abdomen, thorax, crown);
    // 8 Articulated Spider Legs
    for (let i = 0; i < 4; i++) {
      const zOff = -0.6 + i * 0.48;
      for (const side of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.07, 2.2, 6), chMat);
        leg.position.set(side * 1.45, 0.95, zOff);
        leg.rotation.z = side * 0.72;
        g.add(leg);
      }
    }
    return g;
  }

  if (bossType === 'skorne') {
    // Final Boss: Skorne -> True Skorne (Colossal Horned Underworld Demon Lord!)
    const bodyCol = trueSkorne ? 0xff2a00 : 0x7f1d1d;
    const glowCol = trueSkorne ? 0xfef08a : 0xff4500;
    const skinMat = new THREE.MeshStandardMaterial({
      color: bodyCol,
      roughness: 0.34,
      metalness: 0.35,
      emissive: trueSkorne ? 0x991b1b : 0x3b0a0a,
      emissiveIntensity: trueSkorne ? 0.7 : 0.35,
    });
    const obsidianMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.22 });
    const runeMat = new THREE.MeshStandardMaterial({
      color: glowCol,
      emissive: glowCol,
      emissiveIntensity: 1.8,
    });

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 0.85, 2.2, 10), skinMat);
    torso.position.y = 2.1;
    torso.castShadow = true;
    const chestRune = new THREE.Mesh(new THREE.OctahedronGeometry(0.45), runeMat);
    chestRune.position.set(0, 2.25, 0.95);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.62, 10, 10), skinMat);
    head.position.set(0, 3.55, 0.15);
    const hornGeo = new THREE.ConeGeometry(0.2, 1.35, 8);
    const hL = new THREE.Mesh(hornGeo, obsidianMat);
    hL.position.set(-0.62, 4.15, 0.05);
    hL.rotation.z = 0.6;
    const hR = new THREE.Mesh(hornGeo, obsidianMat);
    hR.position.set(0.62, 4.15, 0.05);
    hR.rotation.z = -0.6;
    const wingGeo = new THREE.BoxGeometry(2.8, 1.8, 0.1);
    const wingL = new THREE.Mesh(wingGeo, obsidianMat);
    wingL.position.set(-2.0, 2.8, -0.5);
    wingL.rotation.z = 0.3;
    wingL.name = 'wingL';
    const wingR = new THREE.Mesh(wingGeo, obsidianMat);
    wingR.position.set(2.0, 2.8, -0.5);
    wingR.rotation.z = -0.3;
    wingR.name = 'wingR';
    const sword = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 3.2), runeMat);
    sword.position.set(1.35, 2.1, 1.3);
    const legGeo = new THREE.CylinderGeometry(0.36, 0.28, 1.25, 8);
    const legL = new THREE.Mesh(legGeo, obsidianMat);
    legL.position.set(-0.52, 0.62, 0);
    const legR = new THREE.Mesh(legGeo, obsidianMat);
    legR.position.set(0.52, 0.62, 0);
    g.add(torso, chestRune, head, hL, hR, wingL, wingR, sword, legL, legR);
    return g;
  }

  // Generalized distinct silhouettes for Plague Fiend, Lich, Chimera, Yeti, Genie, Shadow Wraith
  const palette: Record<string, { main: number; accent: number; glow: number; wings: boolean }> = {
    plague_fiend: { main: 0x3f6212, accent: 0x84cc16, glow: 0xbef264, wings: false },
    lich: { main: 0x1e1b4b, accent: 0x6366f1, glow: 0xa78bfa, wings: false },
    chimera: { main: 0x92400e, accent: 0xd97706, glow: 0xfde047, wings: true },
    yeti: { main: 0xe0f2fe, accent: 0x38bdf8, glow: 0x7dd3fc, wings: false },
    genie: { main: 0x1d4ed8, accent: 0xfbbf24, glow: 0x60a5fa, wings: false },
    shadow_wraith: { main: 0x3b0764, accent: 0xc026d3, glow: 0xf0abfc, wings: true },
  };
  const pal = palette[bossType] || palette.plague_fiend;
  const mainMat = new THREE.MeshStandardMaterial({ color: pal.main, roughness: 0.45, metalness: 0.25 });
  const accMat = new THREE.MeshStandardMaterial({ color: pal.accent, roughness: 0.32, metalness: 0.6 });
  const glowMat = new THREE.MeshStandardMaterial({ color: pal.glow, emissive: pal.glow, emissiveIntensity: 1.5 });

  const body = new THREE.Mesh(
    bossType === 'genie' || bossType === 'lich' || bossType === 'shadow_wraith'
      ? new THREE.ConeGeometry(1.1, 2.7, 10)
      : new THREE.CylinderGeometry(1.05, 0.85, 2.1, 10),
    mainMat
  );
  body.position.y = 1.65;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.58, 10, 10), accMat);
  head.position.set(0, 3.05, 0.1);
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.38), glowMat);
  core.position.set(0, 1.9, 0.85);
  const armGeo = new THREE.BoxGeometry(0.45, 1.45, 0.45);
  const armL = new THREE.Mesh(armGeo, mainMat);
  armL.position.set(-1.25, 1.9, 0.25);
  const armR = new THREE.Mesh(armGeo, mainMat);
  armR.position.set(1.25, 1.9, 0.25);
  g.add(body, head, core, armL, armR);

  if (bossType === 'chimera') {
    // 3 Heads (Lion, Goat, Serpent)!
    const hLeft = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), mainMat);
    hLeft.position.set(-0.78, 2.95, 0.28);
    const hRight = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.9, 8), glowMat);
    hRight.position.set(0.78, 2.95, 0.28);
    g.add(hLeft, hRight);
  }
  if (pal.wings) {
    const wingGeo = new THREE.BoxGeometry(2.2, 1.2, 0.08);
    const wingL = new THREE.Mesh(wingGeo, accMat);
    wingL.position.set(-1.7, 2.3, -0.35);
    wingL.name = 'wingL';
    const wingR = new THREE.Mesh(wingGeo, accMat);
    wingR.position.set(1.7, 2.3, -0.35);
    wingR.name = 'wingR';
    g.add(wingL, wingR);
  }
  return g;
}

// ---------------------------------------------------------------------------
// 3D Dungeon Props (3-Tier Generators, Chests, Barrels, Portals, Food, Runestones, Weapons)
// ---------------------------------------------------------------------------
export function buildGeneratorModel(tier: 1 | 2 | 3): THREE.Group {
  // Authentic Gauntlet: Dark Legacy Medieval Monster Spawners (Wood Totem / Stone Mausoleum / Iron Demon Forge!)
  const g = new THREE.Group();
  const bodyCol = tier === 1 ? 0x6b3e1f : tier === 2 ? 0x6b645c : 0x3b3332;
  const trimCol = tier === 1 ? 0x45220e : tier === 2 ? 0x8c8276 : 0x9a7132;
  const emberCol = tier === 1 ? 0xf59e0b : tier === 2 ? 0x84cc16 : 0xef4444;

  const mat = new THREE.MeshStandardMaterial({
    color: bodyCol,
    roughness: tier === 3 ? 0.42 : 0.85,
    metalness: tier === 3 ? 0.68 : 0.1,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: trimCol,
    roughness: 0.55,
    metalness: tier === 3 ? 0.75 : 0.2,
  });
  const fireMat = new THREE.MeshStandardMaterial({
    color: emberCol,
    emissive: emberCol,
    emissiveIntensity: 1.15,
    roughness: 0.3,
  });

  // Stepped stone/timber plinth
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.34, 1.45), trimMat);
  plinth.position.y = 0.17;
  plinth.castShadow = true;
  plinth.receiveShadow = true;

  // Crypt / Forge chamber walls
  const h = 1.15 + tier * 0.25;
  const chamber = new THREE.Mesh(new THREE.BoxGeometry(1.18, h, 1.18), mat);
  chamber.position.y = 0.34 + h * 0.5;
  chamber.castShadow = true;

  // Pitched gothic crypt roof / iron crown
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.96, 0.68, 4), trimMat);
  roof.position.y = 0.34 + h + 0.34;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;

  // Recessed glowing monster doorway / bone skull emblem (named 'crystal' for spin/pulse compatibility)
  const doorway = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.72, 0.22), fireMat);
  doorway.position.set(0, 0.72, 0.56);
  doorway.name = 'crystal';

  // Carved skull ornament above doorway
  const skull = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xe7dfd1, roughness: 0.6 })
  );
  skull.position.set(0, 0.34 + h - 0.1, 0.62);

  g.add(plinth, chamber, roof, doorway, skull);
  return g;
}

export function buildPortalModel(colorHex: string, scale = 1): THREE.Group {
  // Authentic Sumner's Tower Carved Gothic Stone Archway Portal with Hanging Realm Banner!
  const g = new THREE.Group();
  const col = new THREE.Color(colorHex);
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x6e6254,
    roughness: 0.84,
    metalness: 0.12,
  });
  const bronzeMat = new THREE.MeshStandardMaterial({
    color: 0xa67c37,
    roughness: 0.38,
    metalness: 0.72,
  });

  // Left & Right carved stone pilasters
  const colGeo = new THREE.BoxGeometry(0.36 * scale, 2.35 * scale, 0.44 * scale);
  const colL = new THREE.Mesh(colGeo, stoneMat);
  colL.position.set(-1.12 * scale, 1.18 * scale, 0);
  colL.castShadow = true;
  const colR = new THREE.Mesh(colGeo, stoneMat);
  colR.position.set(1.12 * scale, 1.18 * scale, 0);
  colR.castShadow = true;

  // Gothic keystone arch & lintel
  const lintel = new THREE.Mesh(
    new THREE.BoxGeometry(2.75 * scale, 0.38 * scale, 0.56 * scale),
    stoneMat
  );
  lintel.position.set(0, 2.48 * scale, 0);
  lintel.castShadow = true;

  const archTrim = new THREE.Mesh(
    new THREE.TorusGeometry(1.06 * scale, 0.14 * scale, 7, 18, Math.PI),
    bronzeMat
  );
  archTrim.position.set(0, 1.35 * scale, 0.04);

  // Hanging embroidered medieval realm banner crest above the arch!
  const banner = new THREE.Mesh(
    new THREE.BoxGeometry(0.75 * scale, 0.82 * scale, 0.08 * scale),
    new THREE.MeshStandardMaterial({ color: col, roughness: 0.72, metalness: 0.1 })
  );
  banner.position.set(0, 2.95 * scale, 0.18 * scale);

  // Shimmering stained-glass / arcane doorway membrane inside the stone arch
  const vortex = new THREE.Mesh(
    new THREE.PlaneGeometry(1.92 * scale, 2.28 * scale),
    new THREE.MeshStandardMaterial({
      color: col,
      emissive: col,
      emissiveIntensity: 0.72,
      transparent: true,
      opacity: 0.74,
      roughness: 0.25,
      side: THREE.DoubleSide,
    })
  );
  vortex.position.set(0, 1.18 * scale, 0);
  vortex.name = 'vortex';

  // Stone threshold step
  const step = new THREE.Mesh(
    new THREE.BoxGeometry(2.65 * scale, 0.14 * scale, 0.9 * scale),
    stoneMat
  );
  step.position.set(0, 0.07 * scale, 0.12 * scale);

  g.add(colL, colR, lintel, archTrim, banner, vortex, step);
  return g;
}

export function buildBarrelModel(): THREE.Group {
  const g = new THREE.Group();
  const wood = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.4, 0.96, 10),
    new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.78 })
  );
  wood.position.y = 0.48;
  wood.castShadow = true;
  const bandMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });
  const band1 = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 6, 14), bandMat);
  band1.rotation.x = Math.PI / 2;
  band1.position.y = 0.24;
  const band2 = band1.clone();
  band2.position.y = 0.72;
  const spark = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xff4500 })
  );
  spark.position.y = 1.05;
  spark.name = 'spark';
  g.add(wood, band1, band2, spark);
  return g;
}

export function buildChestModel(): THREE.Group {
  const g = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    metalness: 0.85,
    roughness: 0.22,
    emissive: 0x92400e,
    emissiveIntensity: 0.25,
  });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.52, 0.65), woodMat);
  base.position.y = 0.26;
  base.castShadow = true;
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.95, 8, 1, false, 0, Math.PI), woodMat);
  lid.rotation.z = Math.PI / 2;
  lid.position.y = 0.52;
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.1), goldMat);
  lock.position.set(0, 0.46, 0.34);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.08, 0.68), goldMat);
  trim.position.y = 0.5;
  g.add(base, lid, lock, trim);
  return g;
}

export function buildPickupModel(
  kind:
    | 'food_turkey'
    | 'food_ham'
    | 'food_apple'
    | 'poison_cider'
    | 'key'
    | 'potion'
    | 'gold_pile'
    | 'runestone'
    | 'legendary_weapon'
    | 'relic',
  accentHex = '#fbbf24'
): THREE.Group {
  const g = new THREE.Group();
  const col = new THREE.Color(accentHex);

  if (kind === 'runestone') {
    const stone = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.52, 0),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0ea5e9,
        emissiveIntensity: 1.7,
        roughness: 0.12,
        metalness: 0.4,
      })
    );
    stone.position.y = 1.05;
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.68, 0.05, 8, 22),
      new THREE.MeshBasicMaterial({ color: 0xfde047 })
    );
    halo.position.y = 1.05;
    halo.rotation.x = Math.PI / 3;
    g.add(stone, halo);
    return g;
  }

  if (kind === 'legendary_weapon') {
    const ped = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.72, 0.55, 8),
      new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5, roughness: 0.4 })
    );
    ped.position.y = 0.28;
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 1.35, 0.12),
      new THREE.MeshStandardMaterial({
        color: col,
        emissive: col,
        emissiveIntensity: 1.5,
        metalness: 0.85,
        roughness: 0.15,
      })
    );
    blade.position.y = 1.45;
    const guard = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.14, 0.18),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.9, roughness: 0.2 })
    );
    guard.position.y = 1.05;
    g.add(ped, blade, guard);
    return g;
  }

  if (kind === 'gold_pile') {
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0x854d0e,
      emissiveIntensity: 0.35,
      metalness: 0.9,
      roughness: 0.2,
    });
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.1, 10), coinMat);
      c.position.set((i - 1.5) * 0.18, 0.1 + (i % 2) * 0.12, (i % 2 === 0 ? -1 : 1) * 0.14);
      g.add(c);
    }
    return g;
  }

  if (kind === 'key') {
    const keyMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xca8a04,
      emissiveIntensity: 0.55,
      metalness: 0.9,
      roughness: 0.2,
    });
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.055, 6, 12), keyMat);
    bow.position.y = 0.8;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.56, 6), keyMat);
    shaft.position.set(0.32, 0.8, 0);
    shaft.rotation.z = Math.PI / 2;
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.06), keyMat);
    tooth.position.set(0.5, 0.68, 0);
    g.add(bow, shaft, tooth);
    return g;
  }

  if (kind === 'potion') {
    const flask = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 8),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 1.2,
        roughness: 0.15,
      })
    );
    flask.position.y = 0.58;
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.12, 0.24, 8),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2 })
    );
    neck.position.y = 0.88;
    g.add(flask, neck);
    return g;
  }

  if (kind === 'poison_cider') {
    const jug = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.28, 0.52, 10),
      new THREE.MeshStandardMaterial({
        color: 0xa855f7,
        emissive: 0x7e22ce,
        emissiveIntensity: 1.1,
        roughness: 0.3,
      })
    );
    jug.position.y = 0.4;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshBasicMaterial({ color: 0x86efac }));
    skull.position.y = 0.78;
    g.add(jug, skull);
    return g;
  }

  if (kind === 'relic') {
    const orb = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.34, 0),
      new THREE.MeshStandardMaterial({
        color: col,
        emissive: col,
        emissiveIntensity: 1.25,
        metalness: 0.5,
        roughness: 0.2,
      })
    );
    orb.position.y = 0.85;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.45, 0.04, 6, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    ring.position.y = 0.85;
    g.add(orb, ring);
    return g;
  }

  // Roast Turkey / Ham / Apple Food!
  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.44, 0.36, 0.08, 12),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.7, roughness: 0.25 })
  );
  plate.position.y = 0.24;
  const meatCol = kind === 'food_apple' ? 0xef4444 : kind === 'food_ham' ? 0xfb7185 : 0xb45309;
  const food = new THREE.Mesh(
    new THREE.SphereGeometry(kind === 'food_apple' ? 0.24 : 0.34, 10, 8),
    new THREE.MeshStandardMaterial({ color: meatCol, roughness: 0.45 })
  );
  food.scale.set(1.2, 0.85, 0.95);
  food.position.y = 0.48;
  g.add(plate, food);
  return g;
}

export function buildBrazierModel(): THREE.Group {
  // Authentic wrought-iron medieval dungeon tripod fire brazier with blazing coals
  const g = new THREE.Group();
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x2b2623, metalness: 0.78, roughness: 0.42 });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.36, 0.66, 8), ironMat);
  stem.position.y = 0.33;
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.24, 0.34, 8), ironMat);
  bowl.position.y = 0.78;
  const coals = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.35, 0.12, 8),
    new THREE.MeshStandardMaterial({ color: 0xdc2626, emissive: 0xea580c, emissiveIntensity: 1.4 })
  );
  coals.position.y = 0.92;
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 0.74, 7),
    new THREE.MeshBasicMaterial({ color: 0xf97316 })
  );
  flame.position.y = 1.25;
  flame.name = 'flame';
  const innerFlame = new THREE.Mesh(
    new THREE.ConeGeometry(0.15, 0.48, 6),
    new THREE.MeshBasicMaterial({ color: 0xfef08a })
  );
  innerFlame.position.y = 1.16;
  g.add(stem, bowl, coals, flame, innerFlame);
  return g;
}

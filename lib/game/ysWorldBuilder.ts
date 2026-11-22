// ============================================================================
// YS BOOK I & II — 4x-Scale Interconnected 2.5D Exploration & Investigation Worlds
// Sprawling 56x40 – 64x46 maps with walk-behind trees, searchable rustling shrubs,
// inspectable shrines/statues/signs/crates/wells, multi-step quests, & safe portals.
// ============================================================================

export type YsBookVariant = 'ys1' | 'ys2';

// Tile codes:
// 0 = walkable biome ground (meadow/stone/cobble/ice/obsidian)
// 1 = 2.5D extruded masonry wall / cliff / timber house front
// 2 = tall 2.5D tree / marble temple pillar / crystal spire (small trunk collision, walk-behind canopy!)
// 3 = animated water / molten lava / sky abyss (impassable)
// 4 = wooden plank bridge / glowing walkway (walkable)
// 5 = sloped 2.5D cottage roof (walk-behind overhang!)
// 6 = sandstone cobble road / grand temple carpet (walkable)
// 7 = glowing torch brazier / street lantern (light emitter)
// 8 = shallow meadow flowers / mossy stone paving (walkable decorative)
// 9 = monumental Ancient Roda Tree / Sacred Archway Landmark (massive walk-behind canopy!)
export type WorldTile = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type PortraitId = 'adol' | 'sara' | 'feena' | 'lilia' | 'merchant' | 'darkfact' | 'dalles' | 'elder';

export interface ZonePortal {
  id: string;
  tx: number;
  ty: number;
  widthTiles: number;
  heightTiles: number;
  targetZone: string;
  destTx: number;
  destTy: number;
  label: string;
  direction: 'north' | 'south' | 'east' | 'west';
  requiredFlag?: string;
  lockedMessage?: string;
}

export interface WorldNpc {
  id: string;
  name: string;
  role: 'quest' | 'weapon' | 'armor' | 'inn' | 'villager';
  tx: number;
  ty: number;
  portrait: PortraitId;
  cloakColor: string;
  hairColor: string;
  tunicColor: string;
  greeting: string;
  followUpFlag?: string;
  followUpGreeting?: string;
  grantFlag?: string;
  rewardGold?: number;
}

export interface WorldChest {
  id: string;
  tx: number;
  ty: number;
  opened: boolean;
  rewardKind:
    | 'gold'
    | 'book'
    | 'silver_sword'
    | 'silver_armor'
    | 'fire_ring'
    | 'shield_ring'
    | 'time_ring'
    | 'herb'
    | 'quest_item';
  rewardName: string;
  amount?: number;
  grantFlag?: string;
}

export interface WorldShrub {
  id: string;
  tx: number;
  ty: number;
  variant: 'berry' | 'fern' | 'blossom' | 'frost_bush' | 'ember_fern';
  searched: boolean;
  shakeAmp: number;
  shakePhase: number;
  rustleCooldown: number;
  hiddenKind: 'nothing' | 'gold' | 'herb' | 'clue' | 'seed' | 'slime' | 'quest_item';
  hiddenAmount?: number;
  clueText?: string;
  grantFlag?: string;
  rewardName?: string;
}

export interface WorldInspectable {
  id: string;
  tx: number;
  ty: number;
  kind:
    | 'sign'
    | 'statue'
    | 'well'
    | 'crates'
    | 'fountain'
    | 'tablet'
    | 'campfire'
    | 'roda_altar'
    | 'cell_door'
    | 'pedestal'
    | 'anvil'
    | 'telescope'
    | 'bookshelf'
    | 'noticeboard'
    | 'bell'
    | 'dock_cargo';
  title: string;
  lines: string[];
  inspected: boolean;
  grantFlag?: string;
  requiredFlag?: string;
  lockedLines?: string[];
  rewardGold?: number;
  healMp?: boolean;
  rewardBook?: string;
}

export interface WorldEnemySpawn {
  tx: number;
  ty: number;
  kind: 'slime' | 'goblin' | 'knight' | 'mage' | 'wyvern';
}

export type BuildingSignKind =
  | 'fortune'
  | 'weapon'
  | 'armor'
  | 'inn'
  | 'tavern'
  | 'library'
  | 'guild'
  | 'elder'
  | 'clinic'
  | 'house';

export interface WorldBuilding {
  id: string;
  tx: number;
  ty: number;
  w: number;
  h: number;
  name: string;
  signKind: BuildingSignKind;
  roofStyle: 'crimson' | 'cobalt' | 'terracotta' | 'emerald';
  hasChimney?: boolean;
}

export interface WorldBoat {
  id: string;
  tx: number;
  ty: number;
  facing: 'left' | 'right';
  sailColor: string;
  hullColor: string;
}

export interface ZoneDef {
  id: string;
  name: string;
  subtitle: string;
  theme: 'town' | 'plains' | 'shrine' | 'tower' | 'village' | 'ruins' | 'ice' | 'lava';
  safeZone: boolean;
  canAutoHeal: boolean;
  width: number;
  height: number;
  tiles: WorldTile[][];
  buildings?: WorldBuilding[];
  boats?: WorldBoat[];
  portals: ZonePortal[];
  npcs: WorldNpc[];
  chests: WorldChest[];
  shrubs: WorldShrub[];
  inspectables: WorldInspectable[];
  bossSpawn?: {
    bossId: string;
    name: string;
    portrait: PortraitId;
    tx: number;
    ty: number;
    hp: number;
    atk: number;
    def: number;
    exp: number;
    gold: number;
    color: string;
    accent: string;
    introLine: string;
    defeatFlag: string;
    finalBoss?: boolean;
  };
  enemySpawns: WorldEnemySpawn[];
}

// ============================================================================
// Grid & Procedural Landmark Helpers
// ============================================================================
function makeGrid(w: number, h: number, fill: WorldTile = 0): WorldTile[][] {
  return Array.from({ length: h }, () => Array<WorldTile>(w).fill(fill));
}

function fillRect(g: WorldTile[][], x0: number, y0: number, w: number, h: number, code: WorldTile): void {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = code;
    }
  }
}

function setTile(g: WorldTile[][], x: number, y: number, code: WorldTile): void {
  if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = code;
}

function placeCottage(
  g: WorldTile[][],
  x0: number,
  y0: number,
  w: number,
  h: number,
  buildings?: WorldBuilding[],
  meta?: {
    id: string;
    name: string;
    signKind: BuildingSignKind;
    roofStyle: WorldBuilding['roofStyle'];
    hasChimney?: boolean;
  }
): void {
  const roofH = Math.max(2, Math.floor(h * 0.55));
  fillRect(g, x0, y0, w, roofH, 5);
  fillRect(g, x0, y0 + roofH, w, h - roofH, 1);
  // Warm entry cobblestone pad in front of cottage door
  const doorX = x0 + Math.floor(w / 2);
  setTile(g, doorX, y0 + h, 6);
  setTile(g, doorX - 1, y0 + h, 6);
  if (buildings && meta) {
    buildings.push({
      id: meta.id,
      tx: x0,
      ty: y0,
      w,
      h,
      name: meta.name,
      signKind: meta.signKind,
      roofStyle: meta.roofStyle,
      hasChimney: meta.hasChimney ?? true,
    });
  }
}

function borderWall(g: WorldTile[][], code: WorldTile): void {
  const h = g.length;
  const w = g[0].length;
  for (let x = 0; x < w; x++) {
    g[0][x] = code;
    g[1][x] = code;
    g[h - 1][x] = code;
  }
  for (let y = 0; y < h; y++) {
    g[y][0] = code;
    g[y][w - 1] = code;
  }
}

function scatterShrubs(
  zoneId: string,
  g: WorldTile[][],
  coords: Array<{
    tx: number;
    ty: number;
    variant?: WorldShrub['variant'];
    hiddenKind?: WorldShrub['hiddenKind'];
    hiddenAmount?: number;
    clueText?: string;
    grantFlag?: string;
    rewardName?: string;
  }>,
  defaultVariant: WorldShrub['variant']
): WorldShrub[] {
  const list: WorldShrub[] = [];
  coords.forEach((c, idx) => {
    if (c.ty <= 1 || c.ty >= g.length - 1 || c.tx <= 1 || c.tx >= g[0].length - 1) return;
    const t = g[c.ty][c.tx];
    if (t !== 0 && t !== 8) return;
    list.push({
      id: `${zoneId}_shrub_${idx}`,
      tx: c.tx,
      ty: c.ty,
      variant: c.variant ?? defaultVariant,
      searched: false,
      shakeAmp: 0,
      shakePhase: idx * 1.1,
      rustleCooldown: 0,
      hiddenKind: c.hiddenKind ?? (idx % 5 === 0 ? 'gold' : idx % 7 === 0 ? 'herb' : 'nothing'),
      hiddenAmount: c.hiddenAmount ?? (idx % 5 === 0 ? 35 + (idx % 4) * 15 : undefined),
      clueText: c.clueText,
      grantFlag: c.grantFlag,
      rewardName: c.rewardName,
    });
  });
  return list;
}

// ============================================================================
// YS BOOK I — ESTERIA (4 Massive Interconnected 2.5D Worlds, 4x Area!)
// ============================================================================
export function createYs1World(): Record<string, ZoneDef> {
  // --------------------------------------------------------------------------
  // 1. MINEA TOWN & HARBOR (56x40 — 4x larger coastal port town!)
  // --------------------------------------------------------------------------
  const mW = 56;
  const mH = 40;
  const mTiles = makeGrid(mW, mH, 0);
  borderWall(mTiles, 1);

  // Decorative meadow grass patches
  fillRect(mTiles, 3, 4, 18, 10, 8);
  fillRect(mTiles, 35, 4, 17, 10, 8);
  fillRect(mTiles, 3, 21, 16, 10, 8);
  fillRect(mTiles, 37, 21, 15, 10, 8);

  // Southern Harbor Sea + 3 Wooden Piers + Breakwater
  fillRect(mTiles, 1, 33, mW - 2, 6, 3);
  fillRect(mTiles, 12, 33, 4, 5, 4); // West cargo pier
  fillRect(mTiles, 26, 33, 5, 6, 4); // Grand central harbor pier
  fillRect(mTiles, 41, 33, 4, 5, 4); // East fishing pier

  // Main cobblestone avenues & grand town plaza
  fillRect(mTiles, 26, 0, 5, 33, 6); // Grand North-South avenue (open through north wall!)
  fillRect(mTiles, 4, 18, 48, 3, 6); // East-West Grand Boulevard
  fillRect(mTiles, 22, 14, 13, 10, 6); // Central Fountain Plaza
  fillRect(mTiles, 12, 20, 3, 13, 6); // West Dock Road
  fillRect(mTiles, 42, 20, 3, 13, 6); // East Dock Road
  fillRect(mTiles, 8, 8, 14, 2, 6); // NW Sara lane
  fillRect(mTiles, 34, 8, 15, 2, 6); // NE Weapon Forge lane

  // 2.5D Town Buildings (cohesive medieval half-timbered cottages with gabled roofs & guild signs!)
  const mineaBuildings: WorldBuilding[] = [];
  placeCottage(mTiles, 6, 3, 7, 4, mineaBuildings, { id: 'm_sara', name: "SARA'S PARLOR", signKind: 'fortune', roofStyle: 'cobalt', hasChimney: true });
  placeCottage(mTiles, 15, 3, 6, 4, mineaBuildings, { id: 'm_lib', name: 'LIBRARY', signKind: 'library', roofStyle: 'terracotta', hasChimney: true });
  placeCottage(mTiles, 35, 3, 7, 4, mineaBuildings, { id: 'm_wep', name: "PIM'S WEAPONS", signKind: 'weapon', roofStyle: 'crimson', hasChimney: true });
  placeCottage(mTiles, 44, 3, 6, 4, mineaBuildings, { id: 'm_guild', name: 'GUILDHALL', signKind: 'guild', roofStyle: 'cobalt', hasChimney: false });
  placeCottage(mTiles, 5, 12, 6, 4, mineaBuildings, { id: 'm_arm', name: 'ARMORY', signKind: 'armor', roofStyle: 'crimson', hasChimney: true });
  placeCottage(mTiles, 44, 12, 7, 4, mineaBuildings, { id: 'm_inn', name: 'HARBOR INN', signKind: 'inn', roofStyle: 'emerald', hasChimney: true });
  placeCottage(mTiles, 5, 23, 6, 4, mineaBuildings, { id: 'm_ware', name: 'PORT WAREHOUSE', signKind: 'house', roofStyle: 'terracotta', hasChimney: false });
  placeCottage(mTiles, 16, 25, 6, 4, mineaBuildings, { id: 'm_tavern', name: 'BARBADO TAVERN', signKind: 'tavern', roofStyle: 'crimson', hasChimney: true });
  placeCottage(mTiles, 34, 25, 6, 4, mineaBuildings, { id: 'm_herb', name: 'HERBALIST', signKind: 'clinic', roofStyle: 'emerald', hasChimney: true });
  placeCottage(mTiles, 46, 23, 6, 4, mineaBuildings, { id: 'm_light', name: 'HARBORMASTER', signKind: 'house', roofStyle: 'cobalt', hasChimney: true });

  // Walk-behind shade trees & glowing street lanterns across Minea
  const mineaTrees: Array<[number, number]> = [
    [3, 5], [4, 9], [13, 5], [22, 5], [33, 5], [52, 5], [52, 10],
    [3, 15], [13, 14], [41, 14], [52, 16], [19, 12], [37, 12],
    [3, 28], [10, 29], [23, 29], [32, 29], [48, 29], [52, 28],
    [22, 9], [34, 9], [16, 21], [38, 21],
  ];
  for (const [tx, ty] of mineaTrees) setTile(mTiles, tx, ty, 2);
  for (const [lx, ly] of [
    [25, 4], [31, 4], [25, 13], [31, 13], [25, 23], [31, 23],
    [11, 17], [45, 17], [25, 32], [31, 32],
  ]) {
    setTile(mTiles, lx, ly, 7);
  }

  // Open North Gateway (5 tiles wide at rows 0 & 1)
  fillRect(mTiles, 26, 0, 5, 3, 6);

  const mineaShrubs = scatterShrubs(
    'minea',
    mTiles,
    [
      { tx: 4, ty: 7, variant: 'blossom', hiddenKind: 'gold', hiddenAmount: 50 },
      { tx: 5, ty: 8, variant: 'berry', hiddenKind: 'clue', clueText: 'A crumpled sailor note: "Sara hides a blue Crystal near the eastern fountain shrubs!"' },
      { tx: 14, ty: 8, variant: 'fern' },
      { tx: 20, ty: 8, variant: 'blossom', hiddenKind: 'herb' },
      { tx: 23, ty: 11, variant: 'blossom' },
      { tx: 33, ty: 11, variant: 'blossom', hiddenKind: 'quest_item', grantFlag: 'sara_crystal', rewardName: "Sara's Sapphire Crystal!" },
      { tx: 37, ty: 10, variant: 'berry', hiddenKind: 'gold', hiddenAmount: 45 },
      { tx: 42, ty: 10, variant: 'fern' },
      { tx: 50, ty: 11, variant: 'blossom' },
      { tx: 8, ty: 16, variant: 'berry' },
      { tx: 16, ty: 15, variant: 'fern', hiddenKind: 'gold', hiddenAmount: 35 },
      { tx: 40, ty: 16, variant: 'blossom' },
      { tx: 49, ty: 17, variant: 'berry', hiddenKind: 'herb' },
      { tx: 4, ty: 22, variant: 'fern' },
      { tx: 9, ty: 28, variant: 'berry', hiddenKind: 'clue', clueText: 'Hidden beneath the bush: "Whisper to the Ancient Roda Tree in Esteria Plains to reveal hidden lore!"' },
      { tx: 18, ty: 23, variant: 'blossom' },
      { tx: 24, ty: 27, variant: 'berry', hiddenKind: 'gold', hiddenAmount: 60 },
      { tx: 33, ty: 27, variant: 'fern' },
      { tx: 40, ty: 27, variant: 'blossom' },
      { tx: 49, ty: 28, variant: 'berry', hiddenKind: 'seed', rewardName: 'Roda Seed (+10 Max HP!)' },
      { tx: 15, ty: 31, variant: 'fern' },
      { tx: 38, ty: 31, variant: 'blossom', hiddenKind: 'gold', hiddenAmount: 40 },
      { tx: 21, ty: 31, variant: 'berry' },
      { tx: 35, ty: 31, variant: 'fern' },
    ],
    'blossom'
  );

  const minea: ZoneDef = {
    id: 'minea',
    name: 'MINEA TOWN & HARBOR',
    subtitle: 'Coastal Port of Esteria · Investigate Shops, Shrubs & Citizens',
    theme: 'town',
    safeZone: true,
    canAutoHeal: true,
    width: mW,
    height: mH,
    tiles: mTiles,
    buildings: mineaBuildings,
    boats: [
      { id: 'minea_boat_west', tx: 8, ty: 36, facing: 'right', sailColor: '#fef9c3', hullColor: '#7c2d12' },
      { id: 'minea_boat_mid', tx: 22, ty: 37, facing: 'left', sailColor: '#e0f2fe', hullColor: '#92400e' },
      { id: 'minea_boat_east', tx: 47, ty: 36, facing: 'left', sailColor: '#fee2e2', hullColor: '#78350f' },
    ],
    portals: [
      {
        id: 'minea_to_plains',
        tx: 26,
        ty: 0,
        widthTiles: 5,
        heightTiles: 2,
        targetZone: 'plains',
        destTx: 31,
        destTy: 42, // Safely 4 tiles north of Plains south border!
        label: 'NORTH GATE → ESTERIA PLAINS',
        direction: 'north',
      },
    ],
    npcs: [
      {
        id: 'sara',
        name: 'SARA',
        role: 'quest',
        tx: 9,
        ty: 9,
        portrait: 'sara',
        cloakColor: '#9333ea',
        hairColor: '#fde047',
        tunicColor: '#c084fc',
        greeting: 'Adol! Search the shrubs east of the Plaza for my lost Sapphire Crystal, then head north to Esteria Plains & the Shrine of Solomon!',
        followUpFlag: 'sara_crystal',
        followUpGreeting: 'You found my Sapphire Crystal! Take 200 Gold & my blessing—seek Feena and the 6 Books of Ys in the Shrine of Solomon!',
        grantFlag: 'sara_blessing',
        rewardGold: 200,
      },
      {
        id: 'minea_weapons',
        name: 'PIM WEAPONS',
        role: 'weapon',
        tx: 38,
        ty: 9,
        portrait: 'merchant',
        cloakColor: '#b91c1c',
        hairColor: '#92400e',
        tunicColor: '#f59e0b',
        greeting: 'Welcome to Pim’s Pawn & Forge! Upgrade your blade before venturing into the Shrine of Solomon.',
      },
      {
        id: 'minea_armor',
        name: 'ARMOR SMITH',
        role: 'armor',
        tx: 8,
        ty: 17,
        portrait: 'merchant',
        cloakColor: '#1d4ed8',
        hairColor: '#cbd5e1',
        tunicColor: '#60a5fa',
        greeting: 'Heavy Plate & Silver Shields turn lethal head-on blows into scratches!',
      },
      {
        id: 'minea_inn',
        name: 'HARBOR INN',
        role: 'inn',
        tx: 47,
        ty: 17,
        portrait: 'feena',
        cloakColor: '#0284c7',
        hairColor: '#7dd3fc',
        tunicColor: '#e0f2fe',
        greeting: 'Rest at Minea Harbor Inn to restore full HP/MP or stock up on Heal Herbs.',
      },
      {
        id: 'minea_sailor',
        name: 'SLAGH THE SAILOR',
        role: 'villager',
        tx: 28,
        ty: 35,
        portrait: 'elder',
        cloakColor: '#0f766e',
        hairColor: '#e2e8f0',
        tunicColor: '#38bdf8',
        greeting: 'Stormwalls surround Esteria! Check the cargo crates on the west pier—we left supplies for brave adventurers.',
      },
      {
        id: 'minea_scholar',
        name: 'SCHOLAR JEBAN',
        role: 'villager',
        tx: 18,
        ty: 9,
        portrait: 'elder',
        cloakColor: '#4338ca',
        hairColor: '#e2e8f0',
        tunicColor: '#a5b4fc',
        greeting: 'Walk behind tall trees & cottages to scout hidden paths, and jump right into rustling shrubs to uncover secrets!',
      },
      {
        id: 'minea_reah',
        name: 'REAH THE POET',
        role: 'quest',
        tx: 25,
        ty: 17,
        portrait: 'feena',
        cloakColor: '#dc2626',
        hairColor: '#60a5fa',
        tunicColor: '#fef2f2',
        greeting: 'I am Reah, a poet and troubadour. My precious Silver Harmonica was stolen near the Shrine of Solomon—please help me recover it!',
        followUpFlag: 'silver_harmonica',
        followUpGreeting: 'My Silver Harmonica! Listen to its gentle melody, Adol... May the Twin Goddesses watch over your climb up Darm Tower! (+250 Gold!)',
        grantFlag: 'reah_melody',
        rewardGold: 250,
      },
    ],
    chests: [
      { id: 'minea_starter', tx: 3, ty: 2, opened: false, rewardKind: 'gold', rewardName: '150 Gold', amount: 150 },
      { id: 'minea_alley_herb', tx: 53, ty: 2, opened: false, rewardKind: 'herb', rewardName: 'Heal Herb' },
      { id: 'minea_pier_gold', tx: 43, ty: 36, opened: false, rewardKind: 'gold', rewardName: '180 Gold', amount: 180 },
    ],
    shrubs: mineaShrubs,
    inspectables: [
      {
        id: 'minea_fountain',
        tx: 28,
        ty: 18,
        kind: 'fountain',
        title: 'FOUNTAIN OF MINEA',
        lines: [
          'Crystal-clear spring water sparkles beneath the Esterian sun.',
          'You toss a small wish into the basin—your spirit feels refreshed! (MP & HP restored!)',
        ],
        inspected: false,
        healMp: true,
      },
      {
        id: 'minea_sign_north',
        tx: 24,
        ty: 3,
        kind: 'sign',
        title: 'NORTH GATE SIGNPOST',
        lines: [
          'NORTH: Esteria Plains, Zepik Village Outpost, & The Ancient Roda Tree.',
          'NORTHWEST: Shrine of Solomon · NORTHEAST: Darm Tower.',
        ],
        inspected: false,
      },
      {
        id: 'minea_pier_crates',
        tx: 13,
        ty: 36,
        kind: 'crates',
        title: 'SHIPWRECK CARGO CRATES',
        lines: [
          'You pry open the salt-crusted merchant crates from your wrecked ship...',
          'Inside you salvage 120 Gold coins & a weathered Esteria travel chart!',
        ],
        inspected: false,
        rewardGold: 120,
      },
      {
        id: 'minea_well',
        tx: 37,
        ty: 29,
        kind: 'well',
        title: 'OLD TOWN WELL',
        lines: [
          'Echoes rise from the deep limestone shaft...',
          'Carved on the rim: "Only Silver steel forged of Cleria can pierce Dark Fact’s shadow."',
        ],
        inspected: false,
      },
      {
        id: 'minea_tavern_board',
        tx: 19,
        ty: 29,
        kind: 'noticeboard',
        title: 'BARBADO TAVERN NOTICEBOARD',
        lines: [
          'RUMOR #1: A mysterious blue-haired girl named Feena was spotted near Zepik & the Shrine!',
          'RUMOR #2: Inspect ancient statues inside the Shrine of Solomon to reveal secret blessings.',
        ],
        inspected: false,
      },
      {
        id: 'minea_forge_anvil',
        tx: 42,
        ty: 8,
        kind: 'anvil',
        title: "PIM'S CLERIA ANVIL",
        lines: [
          'A heavy iron anvil warmed by glowing charcoal embers from Pim’s outdoor forge.',
          'Engraved on the hammer: "Strike enemies slightly off-center for clean half-bump victories!"',
        ],
        inspected: false,
      },
      {
        id: 'minea_library_lectern',
        tx: 14,
        ty: 8,
        kind: 'bookshelf',
        title: 'ARCHIVE SCROLL LECTERN',
        lines: [
          'An open chronicle of Ancient Ys lies pinned beneath a brass reading lamp.',
          '"Seven hundred years ago, the Six Priests sealed the Black Pearl and raised Ys into the heavens."',
        ],
        inspected: false,
        rewardGold: 45,
      },
      {
        id: 'minea_harbor_spyglass',
        tx: 28,
        ty: 37,
        kind: 'telescope',
        title: 'HARBOR PIER SPYGLASS',
        lines: [
          'You peer through the salt-polished brass spyglass across the turquoise waves of Esteria...',
          'Dark stormclouds swirl far beyond the horizon, trapping every vessel in Minea Harbor.',
        ],
        inspected: false,
      },
      {
        id: 'minea_harbor_bell',
        tx: 24,
        ty: 31,
        kind: 'bell',
        title: 'MINEA HARBOR WARNING BELL',
        lines: [
          'A gleaming bronze maritime bell mounted beneath a timber belfry overlooking the quay.',
          'You strike it gently—a clear chime rings out across the terraces and lifts your spirits! (HP & MP restored!)',
        ],
        inspected: false,
        healMp: true,
      },
      {
        id: 'minea_east_anchor',
        tx: 42,
        ty: 35,
        kind: 'dock_cargo',
        title: 'FISHERMAN ANCHOR & NETS',
        lines: [
          'A weathered iron ship anchor rests beside drying kelp nets and banded spice casks.',
          'Tucked inside a rope coil you discover 65 Gold left behind by a hurried merchant!',
        ],
        inspected: false,
        rewardGold: 65,
      },
      {
        id: 'minea_plaza_board',
        tx: 22,
        ty: 16,
        kind: 'noticeboard',
        title: 'MINEA GUILD BOUNTY BOARD',
        lines: [
          'NOTICE: Press V to switch 45° camera views (Evo / Wide / Full Map) and Q / E to orbit around terraces!',
          'BOUNTY: Clear monsters in Esteria Plains & search every rustling shrub for hidden Roda Seeds.',
        ],
        inspected: false,
      },
      {
        id: 'minea_goddess_shrine',
        tx: 34,
        ty: 16,
        kind: 'statue',
        title: 'TWIN GODDESS MEMORIAL',
        lines: [
          'A finely carved marble monument honoring Feena and Reah overlooking the central plaza.',
          'Fresh wildflowers sit at its plinth, placed by Minea’s townsfolk each sunrise.',
        ],
        inspected: false,
      },
      {
        id: 'minea_clinic_books',
        tx: 39,
        ty: 29,
        kind: 'bookshelf',
        title: 'HERBALIST APOTHECARY LEDGER',
        lines: [
          'Pressed emerald leaves and hand-drawn diagrams of Celceta medicinal blossoms fill the pages.',
          'Tip: Standing completely still in town or Esteria Plains rapidly restores your HP!',
        ],
        inspected: false,
      },
    ],
    enemySpawns: [],
  };

  // --------------------------------------------------------------------------
  // 2. ESTERIA PLAINS & ZEPIK OUTSKIRTS (64x46 — Huge 4-way exploring overworld!)
  // --------------------------------------------------------------------------
  const pW = 64;
  const pH = 46;
  const pTiles = makeGrid(pW, pH, 0);
  borderWall(pTiles, 2);

  // Wildflower meadows
  fillRect(pTiles, 4, 28, 22, 13, 8);
  fillRect(pTiles, 38, 28, 22, 13, 8);
  fillRect(pTiles, 22, 10, 20, 10, 8);

  // Winding Sapphire River across Esteria + 3 Wooden Plank Bridges!
  fillRect(pTiles, 1, 22, pW - 2, 3, 3);
  fillRect(pTiles, 11, 22, 4, 3, 4); // West Bridge -> Shrine Road
  fillRect(pTiles, 30, 22, 4, 3, 4); // Central Bridge -> Ancient Roda Tree
  fillRect(pTiles, 49, 22, 4, 3, 4); // East Bridge -> Darm Tower Road

  // Scenic cobblestone & dirt trail network
  fillRect(pTiles, 30, 25, 4, 21, 6); // South road from Minea Town
  fillRect(pTiles, 12, 26, 40, 2, 6); // Southern Cross-Road
  fillRect(pTiles, 12, 0, 3, 22, 6); // NW Shrine of Solomon Highway
  fillRect(pTiles, 50, 0, 3, 22, 6); // NE Darm Tower Highway
  fillRect(pTiles, 14, 15, 37, 2, 6); // Northern Highland Trail
  fillRect(pTiles, 30, 11, 4, 11, 6); // Road to Ancient Roda Tree

  // Zepik Village Outpost (SE clearing with 2 cottages + Elder)
  const plainsBuildings: WorldBuilding[] = [];
  placeCottage(pTiles, 44, 31, 6, 4, plainsBuildings, { id: 'z_elder', name: "JEVA'S HOUSE", signKind: 'elder', roofStyle: 'terracotta', hasChimney: true });
  placeCottage(pTiles, 53, 31, 6, 4, plainsBuildings, { id: 'z_watch', name: 'ZEPIK OUTPOST', signKind: 'guild', roofStyle: 'crimson', hasChimney: true });
  fillRect(pTiles, 42, 36, 18, 2, 6);

  // Ancient Roda Tree Sanctuary (Monumental landmark at center-north!)
  setTile(pTiles, 31, 9, 9);
  setTile(pTiles, 32, 9, 9);
  setTile(pTiles, 28, 10, 7);
  setTile(pTiles, 35, 10, 7);

  // Open Gateways (South -> Minea, NW -> Shrine, NE -> Darm Tower)
  fillRect(pTiles, 30, pH - 2, 4, 2, 6);
  fillRect(pTiles, 12, 0, 3, 3, 6);
  fillRect(pTiles, 50, 0, 3, 3, 6);
  setTile(pTiles, 11, 3, 7);
  setTile(pTiles, 15, 3, 7);
  setTile(pTiles, 49, 3, 7);
  setTile(pTiles, 53, 3, 7);

  // Rich forest groves with walk-behind canopy depth!
  const plainsTrees: Array<[number, number]> = [
    [5, 6], [8, 6], [6, 9], [18, 6], [21, 7], [24, 5], [27, 8],
    [37, 6], [40, 8], [43, 6], [46, 9], [56, 6], [59, 8], [57, 12],
    [5, 14], [8, 17], [19, 12], [23, 19], [39, 12], [44, 18], [58, 18],
    [6, 29], [9, 32], [5, 36], [14, 31], [19, 34], [24, 31], [21, 39],
    [10, 40], [37, 30], [40, 39], [48, 41], [56, 40], [60, 37], [38, 35],
    [16, 18], [26, 13], [36, 19], [46, 13],
  ];
  for (const [tx, ty] of plainsTrees) setTile(pTiles, tx, ty, 2);

  const plainsShrubs = scatterShrubs(
    'plains',
    pTiles,
    [
      { tx: 27, ty: 38, variant: 'berry', hiddenKind: 'gold', hiddenAmount: 55 },
      { tx: 24, ty: 36, variant: 'fern', hiddenKind: 'herb' },
      { tx: 16, ty: 35, variant: 'blossom', hiddenKind: 'clue', clueText: 'Beneath the petals lies a stone carving: "Cross the West Bridge to find the Shrine of Solomon."' },
      { tx: 8, ty: 35, variant: 'berry', hiddenKind: 'slime' },
      { tx: 12, ty: 38, variant: 'fern', hiddenKind: 'gold', hiddenAmount: 70 },
      { tx: 22, ty: 29, variant: 'blossom' },
      { tx: 36, ty: 32, variant: 'berry', hiddenKind: 'seed', rewardName: 'Roda Seed (+10 Max HP!)' },
      { tx: 42, ty: 40, variant: 'blossom', hiddenKind: 'gold', hiddenAmount: 65 },
      { tx: 55, ty: 39, variant: 'berry', hiddenKind: 'herb' },
      { tx: 7, ty: 19, variant: 'fern', hiddenKind: 'gold', hiddenAmount: 80 },
      { tx: 17, ty: 19, variant: 'berry', hiddenKind: 'slime' },
      { tx: 25, ty: 17, variant: 'blossom' },
      { tx: 37, ty: 17, variant: 'blossom', hiddenKind: 'gold', hiddenAmount: 75 },
      { tx: 45, ty: 19, variant: 'fern' },
      { tx: 56, ty: 19, variant: 'berry', hiddenKind: 'herb' },
      { tx: 29, ty: 12, variant: 'blossom', hiddenKind: 'clue', clueText: 'Roda Leaves shimmer: "Speak to the Roda Tree trunk to awaken your inner vitality!"' },
      { tx: 34, ty: 12, variant: 'blossom' },
      { tx: 20, ty: 9, variant: 'fern', hiddenKind: 'gold', hiddenAmount: 90 },
      { tx: 42, ty: 10, variant: 'berry', hiddenKind: 'slime' },
      { tx: 6, ty: 11, variant: 'fern' },
      { tx: 58, ty: 14, variant: 'berry', hiddenKind: 'gold', hiddenAmount: 85 },
      { tx: 18, ty: 40, variant: 'blossom' },
      { tx: 35, ty: 41, variant: 'fern' },
      { tx: 49, ty: 29, variant: 'blossom' },
      { tx: 58, ty: 29, variant: 'berry', hiddenKind: 'herb' },
      { tx: 26, ty: 6, variant: 'fern', hiddenKind: 'seed', rewardName: 'Roda Seed (+10 Max HP!)' },
    ],
    'berry'
  );

  const plains: ZoneDef = {
    id: 'plains',
    name: 'ESTERIA PLAINS & ZEPIK',
    subtitle: '4-Way Overworld · Stand Still to Auto-Heal · Search Shrubs & Roda Grove',
    theme: 'plains',
    safeZone: false,
    canAutoHeal: true,
    width: pW,
    height: pH,
    tiles: pTiles,
    buildings: plainsBuildings,
    portals: [
      {
        id: 'plains_to_minea',
        tx: 30,
        ty: pH - 2,
        widthTiles: 4,
        heightTiles: 2,
        targetZone: 'minea',
        destTx: 28,
        destTy: 4, // Safely 4 tiles south of Minea's north gate!
        label: 'SOUTH → MINEA TOWN',
        direction: 'south',
      },
      {
        id: 'plains_to_shrine',
        tx: 12,
        ty: 0,
        widthTiles: 3,
        heightTiles: 2,
        targetZone: 'shrine',
        destTx: 28,
        destTy: 37, // Safely inside Shrine south hall!
        label: 'SHRINE OF SOLOMON',
        direction: 'north',
      },
      {
        id: 'plains_to_tower',
        tx: 50,
        ty: 0,
        widthTiles: 3,
        heightTiles: 2,
        targetZone: 'tower',
        destTx: 28,
        destTy: 37,
        label: 'DARM TOWER',
        direction: 'north',
        requiredFlag: 'shrine_boss',
        lockedMessage: 'A crimson barrier seals Darm Tower! Defeat Jenocres in the Shrine of Solomon (Northwest) to break it!',
      },
    ],
    npcs: [
      {
        id: 'plains_feena',
        name: 'FEENA',
        role: 'quest',
        tx: 34,
        ty: 36,
        portrait: 'feena',
        cloakColor: '#3b82f6',
        hairColor: '#93c5fd',
        tunicColor: '#dbeafe',
        greeting: 'Adol! Please investigate the Ancient Roda Tree across the central bridge, then explore the Shrine of Solomon to the northwest!',
        followUpFlag: 'shrine_boss',
        followUpGreeting: 'You vanquished Jenocres and opened Darm Tower! Seek the Silver Sword inside before facing Dark Fact!',
      },
      {
        id: 'zepik_elder',
        name: 'ZEPIK MAYOR',
        role: 'villager',
        tx: 47,
        ty: 37,
        portrait: 'elder',
        cloakColor: '#7c2d12',
        hairColor: '#e2e8f0',
        tunicColor: '#fbbf24',
        greeting: 'Welcome to Zepik Outpost! Our thieves’ Silver Bell was hidden in the far western forest chest—feel free to claim it if you survive the Knights!',
      },
      {
        id: 'zepik_healer',
        name: 'ZEPIK HERBALIST',
        role: 'inn',
        tx: 56,
        ty: 37,
        portrait: 'lilia',
        cloakColor: '#15803d',
        hairColor: '#fde047',
        tunicColor: '#bbf7d0',
        greeting: 'Need rest on the frontier? Rest here or grab extra Heal Herbs before crossing the river!',
      },
    ],
    chests: [
      { id: 'plains_book1', tx: 39, ty: 8, opened: false, rewardKind: 'book', rewardName: 'Book of Hadal (1/6)' },
      { id: 'plains_herb', tx: 59, ty: 27, opened: false, rewardKind: 'herb', rewardName: 'Heal Herb' },
      { id: 'plains_west_gold', tx: 4, ty: 38, opened: false, rewardKind: 'gold', rewardName: '240 Gold (Silver Bell Bounty!)', amount: 240 },
      { id: 'plains_nw_gold', tx: 4, ty: 5, opened: false, rewardKind: 'gold', rewardName: '200 Gold', amount: 200 },
    ],
    shrubs: plainsShrubs,
    inspectables: [
      {
        id: 'plains_sign_cross',
        tx: 29,
        ty: 27,
        kind: 'sign',
        title: 'ESTERIA CROSSROADS SIGN',
        lines: [
          'WEST BRIDGE → Shrine of Solomon · CENTER BRIDGE → Ancient Roda Tree.',
          'EAST → Zepik Outpost & Darm Tower · SOUTH → Minea Town.',
        ],
        inspected: false,
      },
      {
        id: 'plains_roda_tree',
        tx: 31,
        ty: 11,
        kind: 'roda_altar',
        title: 'THE ANCIENT RODA TREE',
        lines: [
          'A gentle silver melody hums from the ancient golden bark...',
          '"Adol of the red hair—my roots remember the twin Goddesses of Ys. Take my blessing!" (+150 Gold & Full Restore!)',
        ],
        inspected: false,
        grantFlag: 'roda_blessing',
        rewardGold: 150,
        healMp: true,
      },
      {
        id: 'plains_campfire',
        tx: 43,
        ty: 38,
        kind: 'campfire',
        title: 'ZEPIK WATCHFIRE',
        lines: [
          'Warm embers crackle beside traveler packs.',
          'A journal reads: "Stand still anywhere in Esteria Plains to rapidly recover HP!"',
        ],
        inspected: false,
        healMp: true,
      },
      {
        id: 'plains_ruin_statue',
        tx: 57,
        ty: 10,
        kind: 'statue',
        title: 'WEATHERED GODDESS STATUE',
        lines: [
          'Moss clings to an ancient marble Goddess gazing toward Darm Tower.',
          'Inscription: "Six Books of Ys hold the true history of Esteria."',
        ],
        inspected: false,
      },
      {
        id: 'plains_bridge_bell',
        tx: 34,
        ty: 25,
        kind: 'bell',
        title: 'RIVER CROSSING WAYFARER BELL',
        lines: [
          'Travelers ring this bronze roadside bell before crossing the Esteria River.',
          'Its resonant note echoes across the emerald meadow! (HP & MP restored!)',
        ],
        inspected: false,
        healMp: true,
      },
      {
        id: 'plains_zepik_board',
        tx: 47,
        ty: 36,
        kind: 'noticeboard',
        title: 'ZEPIK VILLAGE DISPATCH',
        lines: [
          'MAYOR ROBES: "The Silver Bell was stolen by bandits near the western plains—reward awaits!"',
          'SCOUT NOTE: "Watch for shimmering shrubs along the riverbanks; ancient coins wash ashore."',
        ],
        inspected: false,
      },
      {
        id: 'plains_river_cargo',
        tx: 15,
        ty: 25,
        kind: 'dock_cargo',
        title: 'RIVER FERRYMAN SUPPLIES',
        lines: [
          'Waterproofed cargo barrels and an iron grappling anchor sit neatly stacked by the west bridge.',
          'You salvage 90 Gold and spare flint from an abandoned supply crate!',
        ],
        inspected: false,
        rewardGold: 90,
      },
      {
        id: 'plains_hill_spyglass',
        tx: 52,
        ty: 20,
        kind: 'telescope',
        title: 'DARM LOOKOUT SPYGLASS',
        lines: [
          'A scout’s brass telescope points straight toward the ominous silhouette of Darm Tower to the northeast.',
          'Its bronze bezel bears the crest of the Esterian Knights.',
        ],
        inspected: false,
      },
    ],
    enemySpawns: [
      { tx: 16, ty: 33, kind: 'slime' },
      { tx: 22, ty: 37, kind: 'slime' },
      { tx: 10, ty: 31, kind: 'slime' },
      { tx: 38, ty: 29, kind: 'goblin' },
      { tx: 46, ty: 28, kind: 'goblin' },
      { tx: 18, ty: 19, kind: 'goblin' },
      { tx: 25, ty: 15, kind: 'goblin' },
      { tx: 40, ty: 16, kind: 'knight' },
      { tx: 54, ty: 15, kind: 'knight' },
      { tx: 8, ty: 12, kind: 'goblin' },
      { tx: 19, ty: 8, kind: 'knight' },
      { tx: 46, ty: 8, kind: 'mage' },
      { tx: 56, ty: 8, kind: 'knight' },
    ],
  };

  // --------------------------------------------------------------------------
  // 3. SHRINE OF SOLOMON (56x42 — Sprawling Multi-Wing Marble Temple!)
  // --------------------------------------------------------------------------
  const sW = 56;
  const sH = 42;
  const sTiles = makeGrid(sW, sH, 1);
  // Entry Hall (South)
  fillRect(sTiles, 22, 31, 13, 10, 0);
  fillRect(sTiles, 26, 30, 5, 12, 6);
  // Grand Nave (Center)
  fillRect(sTiles, 16, 17, 25, 14, 0);
  fillRect(sTiles, 26, 16, 5, 15, 6);
  // West Relic Wing + Secret Alcove
  fillRect(sTiles, 3, 15, 13, 14, 0);
  fillRect(sTiles, 14, 21, 4, 4, 6);
  // East Prison & Silver Vault Wing
  fillRect(sTiles, 41, 15, 12, 14, 0);
  fillRect(sTiles, 39, 21, 4, 4, 6);
  // North Boss Sanctum of Jenocres
  fillRect(sTiles, 18, 3, 21, 11, 0);
  fillRect(sTiles, 26, 13, 5, 5, 6);

  // Ornamental sunken temple reflection pools
  fillRect(sTiles, 18, 25, 5, 3, 3);
  fillRect(sTiles, 34, 25, 5, 3, 3);

  // Tall walk-behind Greek/Ys Marble Pillars!
  for (const [px, py] of [
    [20, 19], [20, 23], [24, 19], [24, 23], [32, 19], [32, 23], [36, 19], [36, 23],
    [6, 18], [6, 24], [11, 18], [11, 24], [44, 18], [44, 24], [49, 18], [49, 24],
    [21, 6], [21, 10], [35, 6], [35, 10],
  ]) {
    setTile(sTiles, px, py, 2);
  }
  for (const [lx, ly] of [
    [25, 34], [31, 34], [25, 15], [31, 15], [20, 4], [36, 4], [4, 16], [51, 16],
  ]) {
    setTile(sTiles, lx, ly, 7);
  }

  const shrineShrubs = scatterShrubs(
    'shrine',
    sTiles,
    [
      { tx: 18, ty: 18, variant: 'fern', hiddenKind: 'gold', hiddenAmount: 75 },
      { tx: 38, ty: 18, variant: 'fern', hiddenKind: 'herb' },
      { tx: 4, ty: 26, variant: 'fern', hiddenKind: 'clue', clueText: 'Ancient scroll scrap: "Inspect the West & East Goddess Statues to uncover hidden gold & blessings!"' },
      { tx: 13, ty: 16, variant: 'fern', hiddenKind: 'gold', hiddenAmount: 90 },
      { tx: 43, ty: 27, variant: 'fern', hiddenKind: 'herb' },
      { tx: 51, ty: 26, variant: 'fern', hiddenKind: 'gold', hiddenAmount: 85 },
      { tx: 23, ty: 35, variant: 'fern' },
      { tx: 33, ty: 35, variant: 'fern', hiddenKind: 'gold', hiddenAmount: 60 },
    ],
    'fern'
  );

  const shrine: ZoneDef = {
    id: 'shrine',
    name: 'SHRINE OF SOLOMON',
    subtitle: 'Ancient Marble Temple · Investigate Statues & Defeat Jenocres',
    theme: 'shrine',
    safeZone: false,
    canAutoHeal: false,
    width: sW,
    height: sH,
    tiles: sTiles,
    portals: [
      {
        id: 'shrine_to_plains',
        tx: 26,
        ty: sH - 2,
        widthTiles: 5,
        heightTiles: 2,
        targetZone: 'plains',
        destTx: 13,
        destTy: 4, // Safely 4 tiles south of Plains NW gate!
        label: 'EXIT → ESTERIA PLAINS',
        direction: 'south',
      },
    ],
    npcs: [],
    chests: [
      { id: 'shrine_book2', tx: 5, ty: 21, opened: false, rewardKind: 'book', rewardName: 'Book of Tovah (2/6)' },
      { id: 'shrine_book3', tx: 50, ty: 21, opened: false, rewardKind: 'book', rewardName: 'Book of Dabbie (3/6)' },
      { id: 'shrine_silver_armor', tx: 50, ty: 17, opened: false, rewardKind: 'silver_armor', rewardName: 'Silver Armor!' },
      { id: 'shrine_west_herb', tx: 5, ty: 17, opened: false, rewardKind: 'herb', rewardName: 'Heal Herb' },
      { id: 'shrine_harmonica', tx: 13, ty: 26, opened: false, rewardKind: 'quest_item', rewardName: 'Silver Harmonica!', grantFlag: 'silver_harmonica' },
      { id: 'shrine_timer_ring', tx: 43, ty: 17, opened: false, rewardKind: 'time_ring', rewardName: 'Timer Ring! (Slows Foes)' },
    ],
    shrubs: shrineShrubs,
    inspectables: [
      {
        id: 'shrine_tablet_entry',
        tx: 24,
        ty: 33,
        kind: 'tablet',
        title: 'SOLOMON ENTRY TABLET',
        lines: [
          '"Within these marble halls rest the Books of Tovah & Dabbie, and the legendary Silver Armor."',
          '"Guard your flanks—the flame statue Jenocres rules the North Sanctum!"',
        ],
        inspected: false,
      },
      {
        id: 'shrine_statue_west',
        tx: 8,
        ty: 16,
        kind: 'statue',
        title: 'STATUE OF PRIEST TOVAH',
        lines: [
          'As you inspect the pedestal, a hidden compartment clicks open!',
          'You uncover 180 ancient gold pieces & a warm healing radiance!',
        ],
        inspected: false,
        rewardGold: 180,
        healMp: true,
      },
      {
        id: 'shrine_cell_door',
        tx: 47,
        ty: 16,
        kind: 'cell_door',
        title: 'SEALED PRISON ALCOVE',
        lines: [
          'Scratched into the iron bars: "Feena escaped toward Esteria Plains—protect the Books of Ys!"',
          'You find a dropped Heal Pouch tucked beside the lock! (HP & MP Restored!)',
        ],
        inspected: false,
        healMp: true,
      },
    ],
    bossSpawn: {
      bossId: 'jenocres',
      name: 'JENOCRES · FLAME STATUE',
      portrait: 'darkfact',
      tx: 28,
      ty: 7,
      hp: 240,
      atk: 24,
      def: 10,
      exp: 180,
      gold: 550,
      color: '#f97316',
      accent: '#fde047',
      introLine: 'Mortal intruder! Face the burning flames of Jenocres!',
      defeatFlag: 'shrine_boss',
    },
    enemySpawns: [
      { tx: 22, ty: 28, kind: 'goblin' },
      { tx: 34, ty: 28, kind: 'goblin' },
      { tx: 28, ty: 22, kind: 'knight' },
      { tx: 10, ty: 21, kind: 'mage' },
      { tx: 8, ty: 25, kind: 'knight' },
      { tx: 46, ty: 21, kind: 'mage' },
      { tx: 48, ty: 25, kind: 'knight' },
      { tx: 22, ty: 18, kind: 'knight' },
      { tx: 34, ty: 18, kind: 'mage' },
    ],
  };

  // --------------------------------------------------------------------------
  // 4. DARM TOWER (56x42 — Sprawling Crimson Obsidian Citadel!)
  // --------------------------------------------------------------------------
  const tW = 56;
  const tH = 42;
  const tTiles = makeGrid(tW, tH, 1);
  // Lower Entry Courtyard
  fillRect(tTiles, 21, 32, 15, 9, 0);
  fillRect(tTiles, 26, 31, 5, 11, 6);
  // Mid Citadel Grand Hall + Side Vaults
  fillRect(tTiles, 4, 18, 48, 13, 0);
  fillRect(tTiles, 26, 17, 5, 15, 6);
  // Lava Moat with Twin Obsidian Bridges!
  fillRect(tTiles, 4, 14, 48, 4, 3);
  fillRect(tTiles, 15, 14, 4, 4, 4);
  fillRect(tTiles, 37, 14, 4, 4, 4);
  fillRect(tTiles, 26, 14, 5, 4, 4);
  // High Summit Sanctum of Dark Fact
  fillRect(tTiles, 12, 3, 32, 11, 0);
  fillRect(tTiles, 26, 4, 5, 10, 6);

  // Obsidian columns & blazing braziers
  for (const [px, py] of [
    [10, 20], [10, 27], [18, 20], [18, 27], [38, 20], [38, 27], [46, 20], [46, 27],
    [17, 6], [17, 10], [39, 6], [39, 10],
  ]) {
    setTile(tTiles, px, py, 2);
  }
  for (const [lx, ly] of [
    [25, 34], [31, 34], [14, 19], [41, 19], [14, 4], [42, 4], [24, 12], [32, 12],
  ]) {
    setTile(tTiles, lx, ly, 7);
  }

  const towerShrubs = scatterShrubs(
    'tower',
    tTiles,
    [
      { tx: 7, ty: 22, variant: 'ember_fern', hiddenKind: 'herb' },
      { tx: 49, ty: 22, variant: 'ember_fern', hiddenKind: 'gold', hiddenAmount: 140 },
      { tx: 14, ty: 29, variant: 'ember_fern', hiddenKind: 'gold', hiddenAmount: 110 },
      { tx: 42, ty: 29, variant: 'ember_fern', hiddenKind: 'herb' },
      { tx: 22, ty: 35, variant: 'ember_fern' },
      { tx: 34, ty: 35, variant: 'ember_fern', hiddenKind: 'seed', rewardName: 'Cleria Ember (+10 Max HP!)' },
    ],
    'ember_fern'
  );

  const tower: ZoneDef = {
    id: 'tower',
    name: 'DARM TOWER · SUMMIT',
    subtitle: 'Obsidian Citadel of Cleria · Final Boss: Dark Fact',
    theme: 'tower',
    safeZone: false,
    canAutoHeal: false,
    width: tW,
    height: tH,
    tiles: tTiles,
    portals: [
      {
        id: 'tower_to_plains',
        tx: 26,
        ty: tH - 2,
        widthTiles: 5,
        heightTiles: 2,
        targetZone: 'plains',
        destTx: 51,
        destTy: 4, // Safely 4 tiles south of Plains NE gate!
        label: 'EXIT → ESTERIA PLAINS',
        direction: 'south',
      },
    ],
    npcs: [
      {
        id: 'tower_dogi',
        name: 'DOGI THE WALL CRUSHER',
        role: 'villager',
        tx: 23,
        ty: 33,
        portrait: 'merchant',
        cloakColor: '#1e3a8a',
        hairColor: '#3b82f6',
        tunicColor: '#93c5fd',
        greeting: 'Adol! I smashed through the western vault wall for ya—grab the Silver Sword in the west wing & the remaining Books in the east wing before facing Dark Fact!',
      },
    ],
    chests: [
      { id: 'tower_silver_sword', tx: 6, ty: 24, opened: false, rewardKind: 'silver_sword', rewardName: 'Silver Sword!' },
      { id: 'tower_book4', tx: 49, ty: 20, opened: false, rewardKind: 'book', rewardName: 'Book of Mesa (4/6)' },
      { id: 'tower_book5', tx: 49, ty: 27, opened: false, rewardKind: 'book', rewardName: 'Book of Gemma (5/6)' },
      { id: 'tower_shield_ring', tx: 14, ty: 20, opened: false, rewardKind: 'shield_ring', rewardName: 'Armor Ring! (+25% DEF)' },
      { id: 'tower_herb', tx: 6, ty: 29, opened: false, rewardKind: 'herb', rewardName: 'Heal Herb' },
    ],
    shrubs: towerShrubs,
    inspectables: [
      {
        id: 'tower_tablet_1',
        tx: 32,
        ty: 33,
        kind: 'tablet',
        title: 'CLERIA OBELISK',
        lines: [
          '"Darm Tower pierces the clouds toward the ancient Floating Land of Ys."',
          '"Wield the Silver Sword & Silver Armor to shatter Dark Fact’s arcane barrage!"',
        ],
        inspected: false,
      },
      {
        id: 'tower_pedestal_heal',
        tx: 28,
        ty: 24,
        kind: 'pedestal',
        title: 'MIRROR OF Ys SANCTUARY',
        lines: [
          'A silvery reflection of the twin Goddesses bathes you in warm light!',
          'Your wounds mend completely before the final summit clash! (HP & MP Full!)',
        ],
        inspected: false,
        healMp: true,
      },
    ],
    bossSpawn: {
      bossId: 'darkfact',
      name: 'DARK FACT · CLERIA WARLOCK',
      portrait: 'darkfact',
      tx: 28,
      ty: 7,
      hp: 360,
      atk: 34,
      def: 16,
      exp: 450,
      gold: 1400,
      color: '#a855f7',
      accent: '#f43f5e',
      introLine: 'So, Adol Christin arrives at the summit! Only Silver steel can pierce my cloak!',
      defeatFlag: 'ys1_clear',
      finalBoss: true,
    },
    enemySpawns: [
      { tx: 12, ty: 24, kind: 'knight' },
      { tx: 22, ty: 22, kind: 'mage' },
      { tx: 34, ty: 22, kind: 'wyvern' },
      { tx: 43, ty: 24, kind: 'knight' },
      { tx: 16, ty: 28, kind: 'wyvern' },
      { tx: 40, ty: 28, kind: 'mage' },
      { tx: 20, ty: 10, kind: 'knight' },
      { tx: 36, ty: 10, kind: 'mage' },
    ],
  };

  return { minea, plains, shrine, tower };
}

// ============================================================================
// YS BOOK II — FLOATING LAND OF YS (4 Massive Interconnected 2.5D Worlds!)
// ============================================================================
export function createYs2World(): Record<string, ZoneDef> {
  // --------------------------------------------------------------------------
  // 1. LANCE VILLAGE & GODDESS MEADOW (56x40 — Sprawling Floating-Island Village!)
  // --------------------------------------------------------------------------
  const vW = 56;
  const vH = 40;
  const vTiles = makeGrid(vW, vH, 0);
  borderWall(vTiles, 2);

  // Floating sky-cliff abyss along southern edge!
  fillRect(vTiles, 1, 35, vW - 2, 4, 3);
  fillRect(vTiles, 25, 35, 6, 3, 4); // Scenic Sky Overlook Deck

  // Lush flower meadows
  fillRect(vTiles, 4, 4, 18, 12, 8);
  fillRect(vTiles, 34, 4, 18, 12, 8);
  fillRect(vTiles, 4, 21, 18, 12, 8);
  fillRect(vTiles, 34, 21, 18, 12, 8);

  // Cobblestone lanes & central plaza
  fillRect(vTiles, 26, 0, 5, 35, 6);
  fillRect(vTiles, 5, 18, 46, 3, 6);
  fillRect(vTiles, 22, 14, 13, 10, 6);
  fillRect(vTiles, 8, 9, 14, 2, 6);
  fillRect(vTiles, 34, 9, 14, 2, 6);

  // Cottages (Lilia's House, Dr. Flair's Clinic, Ys Forge, Cleria Armory, Elder's Hall)
  const lanceBuildings: WorldBuilding[] = [];
  placeCottage(vTiles, 6, 4, 7, 4, lanceBuildings, { id: 'l_lilia', name: "LILIA'S COTTAGE", signKind: 'house', roofStyle: 'cobalt', hasChimney: true });
  placeCottage(vTiles, 15, 4, 6, 4, lanceBuildings, { id: 'l_elder', name: "ELDER'S HALL", signKind: 'elder', roofStyle: 'emerald', hasChimney: true });
  placeCottage(vTiles, 35, 4, 7, 4, lanceBuildings, { id: 'l_forge', name: 'YS FORGE', signKind: 'weapon', roofStyle: 'cobalt', hasChimney: true });
  placeCottage(vTiles, 44, 4, 6, 4, lanceBuildings, { id: 'l_herb', name: 'CONSERVATORY', signKind: 'clinic', roofStyle: 'emerald', hasChimney: false });
  placeCottage(vTiles, 6, 24, 7, 4, lanceBuildings, { id: 'l_arm', name: 'CLERIA ARMORY', signKind: 'armor', roofStyle: 'cobalt', hasChimney: true });
  placeCottage(vTiles, 43, 24, 7, 4, lanceBuildings, { id: 'l_clinic', name: "DR. FLAIR'S CLINIC", signKind: 'clinic', roofStyle: 'emerald', hasChimney: true });
  placeCottage(vTiles, 16, 26, 6, 4, lanceBuildings, { id: 'l_mill', name: 'WINDMILL HOUSE', signKind: 'house', roofStyle: 'terracotta', hasChimney: true });
  placeCottage(vTiles, 34, 26, 6, 4, lanceBuildings, { id: 'l_obs', name: 'OBSERVATORY', signKind: 'library', roofStyle: 'cobalt', hasChimney: false });

  // Open North Gateway -> Ruins of Moondoria
  fillRect(vTiles, 26, 0, 5, 3, 6);

  // Walk-behind flowering & emerald trees
  for (const [tx, ty] of [
    [3, 6], [13, 6], [22, 6], [33, 6], [52, 6], [52, 12],
    [4, 14], [15, 14], [40, 14], [51, 16], [4, 22], [14, 23],
    [40, 23], [52, 22], [4, 31], [12, 32], [22, 32], [33, 32], [44, 32], [52, 31],
  ]) {
    setTile(vTiles, tx, ty, 2);
  }
  for (const [lx, ly] of [
    [25, 4], [31, 4], [25, 13], [31, 13], [25, 24], [31, 24], [25, 34], [31, 34],
  ]) {
    setTile(vTiles, lx, ly, 7);
  }

  const lanceShrubs = scatterShrubs(
    'lance',
    vTiles,
    [
      { tx: 4, ty: 9, variant: 'blossom', hiddenKind: 'quest_item', grantFlag: 'celceta_blossom', rewardName: 'Celceta Blossom!' },
      { tx: 11, ty: 12, variant: 'blossom', hiddenKind: 'gold', hiddenAmount: 55 },
      { tx: 19, ty: 12, variant: 'berry', hiddenKind: 'herb' },
      { tx: 23, ty: 11, variant: 'blossom' },
      { tx: 33, ty: 11, variant: 'blossom', hiddenKind: 'clue', clueText: 'A ribbon tied to the shrub: "Give the rare Celceta Blossom from Lilia’s western garden to Dr. Flair!"' },
      { tx: 38, ty: 12, variant: 'berry', hiddenKind: 'gold', hiddenAmount: 65 },
      { tx: 48, ty: 12, variant: 'blossom' },
      { tx: 8, ty: 16, variant: 'fern', hiddenKind: 'seed', rewardName: 'Goddess Berry (+10 Max HP!)' },
      { tx: 18, ty: 16, variant: 'blossom' },
      { tx: 46, ty: 16, variant: 'berry', hiddenKind: 'gold', hiddenAmount: 50 },
      { tx: 5, ty: 29, variant: 'blossom' },
      { tx: 14, ty: 31, variant: 'berry', hiddenKind: 'herb' },
      { tx: 20, ty: 24, variant: 'fern' },
      { tx: 36, ty: 24, variant: 'blossom', hiddenKind: 'gold', hiddenAmount: 60 },
      { tx: 41, ty: 31, variant: 'berry' },
      { tx: 50, ty: 29, variant: 'blossom', hiddenKind: 'clue', clueText: 'Note under the petals: "Press [SHIFT / X] to cast Fire Magic while exploring Moondoria!"' },
      { tx: 23, ty: 29, variant: 'fern' },
      { tx: 32, ty: 29, variant: 'blossom', hiddenKind: 'gold', hiddenAmount: 45 },
    ],
    'blossom'
  );

  const lance: ZoneDef = {
    id: 'lance',
    name: 'LANCE VILLAGE',
    subtitle: 'Floating Land of Ys · Search Gardens, Talk to Lilia & Dr. Flair',
    theme: 'village',
    safeZone: true,
    canAutoHeal: true,
    width: vW,
    height: vH,
    tiles: vTiles,
    buildings: lanceBuildings,
    portals: [
      {
        id: 'lance_to_moondoria',
        tx: 26,
        ty: 0,
        widthTiles: 5,
        heightTiles: 2,
        targetZone: 'moondoria',
        destTx: 31,
        destTy: 41, // Safely 4 tiles inside Moondoria!
        label: 'NORTH → RUINS OF MOONDORIA',
        direction: 'north',
      },
    ],
    npcs: [
      {
        id: 'lilia',
        name: 'LILIA',
        role: 'quest',
        tx: 9,
        ty: 10,
        portrait: 'lilia',
        cloakColor: '#ec4899',
        hairColor: '#fb7185',
        tunicColor: '#fce7f3',
        greeting: 'Adol, welcome to Lance Village! Search the western garden shrubs for a Celceta Blossom for Dr. Flair, then venture north into Moondoria!',
        followUpFlag: 'celceta_blossom',
        followUpGreeting: 'Oh! You found the Celceta Blossom! Take 220 Gold & my lucky charm—press Shift/X to cast Fire Magic in Moondoria!',
        grantFlag: 'lilia_charm',
        rewardGold: 220,
      },
      {
        id: 'lance_weapons',
        name: 'YS FORGE',
        role: 'weapon',
        tx: 38,
        ty: 10,
        portrait: 'merchant',
        cloakColor: '#dc2626',
        hairColor: '#f59e0b',
        tunicColor: '#fed7aa',
        greeting: 'Ancient Cleria-forged swords crafted atop the Floating Land of Ys!',
      },
      {
        id: 'lance_armor',
        name: 'CLERIA ARMORY',
        role: 'armor',
        tx: 9,
        ty: 30,
        portrait: 'merchant',
        cloakColor: '#2563eb',
        hairColor: '#e2e8f0',
        tunicColor: '#bfdbfe',
        greeting: 'Reinforce your armor & shield before braving the Ice Ridge of Noltia!',
      },
      {
        id: 'lance_inn',
        name: 'DR. FLAIR CLINIC',
        role: 'inn',
        tx: 46,
        ty: 30,
        portrait: 'elder',
        cloakColor: '#059669',
        hairColor: '#e2e8f0',
        tunicColor: '#a7f3d0',
        greeting: 'Rest cleanly at the Clinic to recover HP & MP, or stock up on Celceta Herbs!',
      },
      {
        id: 'lance_elder',
        name: 'ELDER OF LANCE',
        role: 'villager',
        tx: 18,
        ty: 10,
        portrait: 'elder',
        cloakColor: '#6d28d9',
        hairColor: '#f1f5f9',
        tunicColor: '#ddd6fe',
        greeting: 'The Goddess Statues in Moondoria still hold ancient magic. Inspect every statue & shrine you discover!',
      },
    ],
    chests: [
      { id: 'lance_gold', tx: 3, ty: 3, opened: false, rewardKind: 'gold', rewardName: '200 Gold', amount: 200 },
      { id: 'lance_herb', tx: 52, ty: 3, opened: false, rewardKind: 'herb', rewardName: 'Heal Herb' },
      { id: 'lance_overlook', tx: 28, ty: 36, opened: false, rewardKind: 'gold', rewardName: '160 Gold', amount: 160 },
    ],
    shrubs: lanceShrubs,
    inspectables: [
      {
        id: 'lance_fountain',
        tx: 28,
        ty: 18,
        kind: 'fountain',
        title: 'SPRING OF THE GODDESSES',
        lines: [
          'Pure sky-spring water cascades over carved silver wings.',
          'Your MP & HP surge back to full strength!',
        ],
        inspected: false,
        healMp: true,
      },
      {
        id: 'lance_sign_north',
        tx: 24,
        ty: 3,
        kind: 'sign',
        title: 'LANCE VILLAGE GATEPOST',
        lines: [
          'NORTH: Ruins of Moondoria → Ice Ridge of Noltia → Moat of Burnedbless.',
          'Tip: Walk behind trees to scout secret trails, & jump into shrubs to search them!',
        ],
        inspected: false,
      },
      {
        id: 'lance_overlook_sign',
        tx: 26,
        ty: 35,
        kind: 'telescope',
        title: 'SKY CLIFF OBSERVATORY SPYGLASS',
        lines: [
          'Far below the swirling sunlit clouds lies the distant emerald island of Esteria.',
          'A gentle wind carries the melody of the twin Goddesses Feena & Reah.',
        ],
        inspected: false,
      },
      {
        id: 'lance_forge_anvil',
        tx: 42,
        ty: 10,
        kind: 'anvil',
        title: 'ANCIENT CLERIA ANVIL',
        lines: [
          'A silver-inlaid forge anvil that hums faintly with residual Ys magic.',
          'Forging notes: "Press Shift or X to unleash Fireball Magic once you claim the Fire Ring!"',
        ],
        inspected: false,
      },
      {
        id: 'lance_village_board',
        tx: 22,
        ty: 17,
        kind: 'noticeboard',
        title: 'LANCE VILLAGE SQUARE BOARD',
        lines: [
          'DR. FLAIR: "Seeking fresh Celceta Blossoms from the western garden shrubs for Lilia’s remedy."',
          'ELDER: "Every marble Goddess Statue in Moondoria responds to a brave traveler’s touch."',
        ],
        inspected: false,
      },
      {
        id: 'lance_sky_bell',
        tx: 34,
        ty: 17,
        kind: 'bell',
        title: 'WINDCHIME SKY BELFRY',
        lines: [
          'A silver-bronze bell tuned to the drifting sky currents of Floating Ys.',
          'Its pure chime refreshes your strength! (HP & MP restored!)',
        ],
        inspected: false,
        healMp: true,
      },
      {
        id: 'lance_elder_tome',
        tx: 15,
        ty: 10,
        kind: 'bookshelf',
        title: 'CHRONICLE OF FLOATING YS',
        lines: [
          'A bound parchment volume describing the six winged sanctuaries suspended above Esteria.',
          'Tucked inside the bookmark you find 80 Gold in antique Cleria coinage!',
        ],
        inspected: false,
        rewardGold: 80,
      },
    ],
    enemySpawns: [],
  };

  // --------------------------------------------------------------------------
  // 2. RUINS OF MOONDORIA (62x46 — Sprawling Overgrown Goddess Ruins!)
  // --------------------------------------------------------------------------
  const rW = 62;
  const rH = 46;
  const rTiles = makeGrid(rW, rH, 0);
  borderWall(rTiles, 1);

  // Sunken canal water bisecting the ruins + 3 stone bridges
  fillRect(rTiles, 1, 21, rW - 2, 3, 3);
  fillRect(rTiles, 12, 21, 4, 3, 4);
  fillRect(rTiles, 29, 21, 4, 3, 4);
  fillRect(rTiles, 46, 21, 4, 3, 4);

  // Overgrown ruined sanctuary walls creating chambers & investigation wings
  fillRect(rTiles, 18, 28, 3, 10, 1);
  fillRect(rTiles, 41, 28, 3, 10, 1);
  fillRect(rTiles, 18, 9, 3, 9, 1);
  fillRect(rTiles, 41, 9, 3, 9, 1);

  // Paved ancient walkways
  fillRect(rTiles, 29, 24, 4, 22, 6);
  fillRect(rTiles, 12, 26, 38, 2, 6);
  fillRect(rTiles, 29, 0, 4, 21, 6);
  fillRect(rTiles, 12, 16, 38, 2, 6);

  // Open South Gate (to Lance) & North-East Gate (to Noltia Ice Ridge)
  fillRect(rTiles, 29, rH - 2, 4, 2, 6);
  fillRect(rTiles, 47, 0, 4, 3, 6);
  fillRect(rTiles, 47, 3, 3, 15, 6);

  // Walk-behind ruined marble pillars & overgrown shrine trees
  for (const [px, py] of [
    [6, 6], [12, 6], [24, 7], [36, 7], [55, 7], [8, 14], [24, 13], [36, 13], [54, 14],
    [6, 29], [12, 33], [24, 32], [36, 32], [49, 30], [55, 34], [8, 39], [52, 39],
  ]) {
    setTile(rTiles, px, py, 2);
  }
  for (const [lx, ly] of [
    [28, 40], [33, 40], [46, 3], [51, 3], [25, 10], [36, 10],
  ]) {
    setTile(rTiles, lx, ly, 7);
  }

  const moonShrubs = scatterShrubs(
    'moondoria',
    rTiles,
    [
      { tx: 7, ty: 36, variant: 'berry', hiddenKind: 'gold', hiddenAmount: 85 },
      { tx: 14, ty: 37, variant: 'fern', hiddenKind: 'herb' },
      { tx: 25, ty: 36, variant: 'blossom', hiddenKind: 'clue', clueText: 'Ancient Roo scribble: "Find the Fire Magic Boost chest in the SW Ruin Courtyard!"' },
      { tx: 36, ty: 36, variant: 'fern', hiddenKind: 'gold', hiddenAmount: 75 },
      { tx: 48, ty: 35, variant: 'berry', hiddenKind: 'slime' },
      { tx: 54, ty: 30, variant: 'blossom', hiddenKind: 'seed', rewardName: 'Roda Fruit (+10 Max HP!)' },
      { tx: 9, ty: 18, variant: 'fern', hiddenKind: 'gold', hiddenAmount: 95 },
      { tx: 23, ty: 18, variant: 'berry', hiddenKind: 'herb' },
      { tx: 38, ty: 18, variant: 'blossom' },
      { tx: 54, ty: 18, variant: 'fern', hiddenKind: 'gold', hiddenAmount: 90 },
      { tx: 7, ty: 10, variant: 'berry', hiddenKind: 'slime' },
      { tx: 15, ty: 10, variant: 'blossom' },
      { tx: 55, ty: 11, variant: 'fern', hiddenKind: 'herb' },
    ],
    'fern'
  );

  const moondoria: ZoneDef = {
    id: 'moondoria',
    name: 'RUINS OF MOONDORIA',
    subtitle: 'Sunken Goddess Ruins · Investigate Statues & Defeat Velagunder',
    theme: 'ruins',
    safeZone: false,
    canAutoHeal: true,
    width: rW,
    height: rH,
    tiles: rTiles,
    portals: [
      {
        id: 'moondoria_to_lance',
        tx: 29,
        ty: rH - 2,
        widthTiles: 4,
        heightTiles: 2,
        targetZone: 'lance',
        destTx: 28,
        destTy: 4,
        label: 'SOUTH → LANCE VILLAGE',
        direction: 'south',
      },
      {
        id: 'moondoria_to_noltia',
        tx: 47,
        ty: 0,
        widthTiles: 4,
        heightTiles: 2,
        targetZone: 'noltia',
        destTx: 28,
        destTy: 37,
        label: 'NORTH → ICE RIDGE OF NOLTIA',
        direction: 'north',
        requiredFlag: 'velagunder',
        lockedMessage: 'Velagunder’s frost seal blocks the Ice Ridge! Defeat Velagunder in the North-Center Sanctum!',
      },
    ],
    npcs: [
      {
        id: 'moon_roo',
        name: 'FRIENDLY ROO',
        role: 'villager',
        tx: 26,
        ty: 39,
        portrait: 'lilia',
        cloakColor: '#a16207',
        hairColor: '#fde047',
        tunicColor: '#fef08a',
        greeting: 'Kyu-kyu! The Ruin Demon Velagunder lurks north of the center bridge! Blast it with Fire Magic [SHIFT/X] while dodging!',
      },
    ],
    chests: [
      { id: 'moon_fire', tx: 6, ty: 33, opened: false, rewardKind: 'fire_ring', rewardName: 'Fire Magic Boost (+15 MP)!' },
      { id: 'moon_book1', tx: 6, ty: 8, opened: false, rewardKind: 'book', rewardName: 'Goddess Crest (1/6)' },
      { id: 'moon_book2', tx: 55, ty: 36, opened: false, rewardKind: 'book', rewardName: 'Goddess Crest (2/6)' },
      { id: 'moon_herb', tx: 55, ty: 26, opened: false, rewardKind: 'herb', rewardName: 'Heal Herb' },
    ],
    shrubs: moonShrubs,
    inspectables: [
      {
        id: 'moon_statue_1',
        tx: 10,
        ty: 29,
        kind: 'statue',
        title: 'STATUE OF GODDESS FEENA',
        lines: [
          'A serene glow washes over Adol from the winged Goddess sculpture.',
          'Your Fire Magic resonates—MP & HP fully restored!',
        ],
        inspected: false,
        healMp: true,
      },
      {
        id: 'moon_tablet_north',
        tx: 26,
        ty: 17,
        kind: 'tablet',
        title: 'MOONDORIA INSCRIPTION',
        lines: [
          '"Beyond the Ice Ridge of Noltia lies the molten Moat of Burnedbless and the Black Pearl."',
          '"Seek the Shield Ring in Noltia & the Time Ring in Burnedbless!"',
        ],
        inspected: false,
      },
    ],
    bossSpawn: {
      bossId: 'velagunder',
      name: 'VELAGUNDER · RUIN DEMON',
      portrait: 'dalles',
      tx: 31,
      ty: 7,
      hp: 225,
      atk: 23,
      def: 10,
      exp: 170,
      gold: 520,
      color: '#22d3ee',
      accent: '#f472b6',
      introLine: 'Fire Magic alone will not save you, Adol! Taste my icy talons!',
      defeatFlag: 'velagunder',
    },
    enemySpawns: [
      { tx: 14, ty: 32, kind: 'slime' },
      { tx: 24, ty: 30, kind: 'goblin' },
      { tx: 46, ty: 32, kind: 'goblin' },
      { tx: 52, ty: 28, kind: 'knight' },
      { tx: 14, ty: 14, kind: 'mage' },
      { tx: 25, ty: 14, kind: 'goblin' },
      { tx: 37, ty: 14, kind: 'knight' },
      { tx: 52, ty: 14, kind: 'mage' },
      { tx: 10, ty: 9, kind: 'knight' },
    ],
  };

  // --------------------------------------------------------------------------
  // 3. ICE RIDGE OF NOLTIA (56x42 — Sparkling Crystal Glacier Canyons!)
  // --------------------------------------------------------------------------
  const iW = 56;
  const iH = 42;
  const iTiles = makeGrid(iW, iH, 0);
  borderWall(iTiles, 1);

  // Twin frozen chasms with shimmering ice bridges
  fillRect(iTiles, 1, 20, iW - 2, 3, 3);
  fillRect(iTiles, 10, 20, 4, 3, 4);
  fillRect(iTiles, 26, 20, 4, 3, 4);
  fillRect(iTiles, 42, 20, 4, 3, 4);

  fillRect(iTiles, 26, 0, 4, 42, 6);
  fillRect(iTiles, 10, 26, 36, 2, 6);
  fillRect(iTiles, 10, 14, 36, 2, 6);

  // Open South (Moondoria) & North (Burnedbless)
  fillRect(iTiles, 26, iH - 2, 4, 2, 6);
  fillRect(iTiles, 26, 0, 4, 3, 6);

  // Walk-behind tall crystal glacier spires!
  for (const [px, py] of [
    [6, 7], [14, 8], [20, 6], [35, 6], [42, 8], [49, 7],
    [7, 16], [19, 17], [37, 17], [48, 16],
    [6, 28], [16, 31], [22, 35], [34, 35], [40, 31], [49, 28], [10, 37], [46, 37],
  ]) {
    setTile(iTiles, px, py, 2);
  }
  for (const [lx, ly] of [
    [25, 36], [30, 36], [25, 4], [30, 4], [11, 24], [44, 24],
  ]) {
    setTile(iTiles, lx, ly, 7);
  }

  const noltiaShrubs = scatterShrubs(
    'noltia',
    iTiles,
    [
      { tx: 8, ty: 33, variant: 'frost_bush', hiddenKind: 'gold', hiddenAmount: 110 },
      { tx: 18, ty: 33, variant: 'frost_bush', hiddenKind: 'herb' },
      { tx: 37, ty: 33, variant: 'frost_bush', hiddenKind: 'clue', clueText: 'Frozen explorer note: "The Shield Magic Ring rests in the southwest glacier alcove!"' },
      { tx: 47, ty: 33, variant: 'frost_bush', hiddenKind: 'gold', hiddenAmount: 120 },
      { tx: 13, ty: 17, variant: 'frost_bush', hiddenKind: 'seed', rewardName: 'Frost Crystal (+10 Max HP!)' },
      { tx: 43, ty: 17, variant: 'frost_bush', hiddenKind: 'herb' },
      { tx: 9, ty: 10, variant: 'frost_bush', hiddenKind: 'gold', hiddenAmount: 130 },
      { tx: 47, ty: 10, variant: 'frost_bush', hiddenKind: 'herb' },
    ],
    'frost_bush'
  );

  const noltia: ZoneDef = {
    id: 'noltia',
    name: 'ICE RIDGE OF NOLTIA',
    subtitle: 'Crystal Glacier Canyons · Find Shield Ring & Defeat Tyalmath',
    theme: 'ice',
    safeZone: false,
    canAutoHeal: false,
    width: iW,
    height: iH,
    tiles: iTiles,
    portals: [
      {
        id: 'noltia_to_moondoria',
        tx: 26,
        ty: iH - 2,
        widthTiles: 4,
        heightTiles: 2,
        targetZone: 'moondoria',
        destTx: 49,
        destTy: 4,
        label: 'SOUTH → RUINS OF MOONDORIA',
        direction: 'south',
      },
      {
        id: 'noltia_to_burnedbless',
        tx: 26,
        ty: 0,
        widthTiles: 4,
        heightTiles: 2,
        targetZone: 'burnedbless',
        destTx: 28,
        destTy: 37,
        label: 'NORTH → MOAT OF BURNEDBLESS',
        direction: 'north',
        requiredFlag: 'tyalmath',
        lockedMessage: 'Tyalmath guards the descent to Burnedbless! Vanquish the Glacier Guardian first!',
      },
    ],
    npcs: [],
    chests: [
      { id: 'noltia_shield_ring', tx: 5, ty: 35, opened: false, rewardKind: 'shield_ring', rewardName: 'Shield Magic Ring!' },
      { id: 'noltia_book3', tx: 50, ty: 35, opened: false, rewardKind: 'book', rewardName: 'Goddess Crest (3/6)' },
      { id: 'noltia_silver_armor', tx: 50, ty: 8, opened: false, rewardKind: 'silver_armor', rewardName: 'Battle Armor!' },
      { id: 'noltia_book4', tx: 5, ty: 8, opened: false, rewardKind: 'book', rewardName: 'Goddess Crest (4/6)' },
    ],
    shrubs: noltiaShrubs,
    inspectables: [
      {
        id: 'noltia_statue',
        tx: 23,
        ty: 29,
        kind: 'statue',
        title: 'CRYSTAL SHRINE OF REAH',
        lines: [
          'Soft harp notes chime inside the translucent ice.',
          'Warmth surrounds Adol—HP & MP completely restored!',
        ],
        inspected: false,
        healMp: true,
      },
      {
        id: 'noltia_campfire',
        tx: 32,
        ty: 29,
        kind: 'campfire',
        title: 'EVERFLAME BRAZIER',
        lines: [
          'An ancient fire pit burns even through Noltia’s blizzards.',
          'Carved message: "Once you find the Shield Ring, casting Magic also raises a protective Barrier!"',
        ],
        inspected: false,
      },
    ],
    bossSpawn: {
      bossId: 'tyalmath',
      name: 'TYALMATH · GLACIER GUARDIAN',
      portrait: 'dalles',
      tx: 28,
      ty: 8,
      hp: 300,
      atk: 28,
      def: 14,
      exp: 260,
      gold: 800,
      color: '#38bdf8',
      accent: '#e0f2fe',
      introLine: 'None pass the Ice Ridge of Noltia alive! Freeze in eternal frost!',
      defeatFlag: 'tyalmath',
    },
    enemySpawns: [
      { tx: 14, ty: 30, kind: 'knight' },
      { tx: 38, ty: 30, kind: 'mage' },
      { tx: 28, ty: 27, kind: 'wyvern' },
      { tx: 12, ty: 16, kind: 'knight' },
      { tx: 42, ty: 16, kind: 'wyvern' },
      { tx: 16, ty: 10, kind: 'mage' },
      { tx: 40, ty: 10, kind: 'knight' },
    ],
  };

  // --------------------------------------------------------------------------
  // 4. MOAT OF BURNEDBLESS & SOLOMON CORE (56x42 — Volcanic Fortress!)
  // --------------------------------------------------------------------------
  const bW = 56;
  const bH = 42;
  const bTiles = makeGrid(bW, bH, 0);
  borderWall(bTiles, 1);

  // Twin molten lava channels with obsidian walkways
  fillRect(bTiles, 1, 18, bW - 2, 4, 3);
  fillRect(bTiles, 11, 18, 4, 4, 4);
  fillRect(bTiles, 26, 18, 5, 4, 4);
  fillRect(bTiles, 41, 18, 4, 4, 4);

  fillRect(bTiles, 26, 4, 5, 38, 6);
  fillRect(bTiles, 8, 28, 40, 2, 6);

  // Open South Gate -> Ice Ridge of Noltia
  fillRect(bTiles, 26, bH - 2, 5, 2, 6);

  // Obsidian spires & demon braziers
  for (const [px, py] of [
    [9, 8], [18, 7], [38, 7], [47, 8], [12, 13], [44, 13],
    [8, 25], [18, 25], [38, 25], [48, 25], [12, 34], [44, 34],
  ]) {
    setTile(bTiles, px, py, 2);
  }
  for (const [lx, ly] of [
    [25, 36], [31, 36], [25, 16], [31, 16], [16, 4], [40, 4],
  ]) {
    setTile(bTiles, lx, ly, 7);
  }

  const burnShrubs = scatterShrubs(
    'burnedbless',
    bTiles,
    [
      { tx: 7, ty: 34, variant: 'ember_fern', hiddenKind: 'herb' },
      { tx: 49, ty: 34, variant: 'ember_fern', hiddenKind: 'gold', hiddenAmount: 180 },
      { tx: 16, ty: 31, variant: 'ember_fern', hiddenKind: 'seed', rewardName: 'Cleria Heart (+10 Max HP!)' },
      { tx: 40, ty: 31, variant: 'ember_fern', hiddenKind: 'herb' },
    ],
    'ember_fern'
  );

  const burnedbless: ZoneDef = {
    id: 'burnedbless',
    name: 'SOLOMON CORE · BURNEDBLESS',
    subtitle: 'Sanctum of the Black Pearl · Final Boss: Darm',
    theme: 'lava',
    safeZone: false,
    canAutoHeal: false,
    width: bW,
    height: bH,
    tiles: bTiles,
    portals: [
      {
        id: 'burnedbless_to_noltia',
        tx: 26,
        ty: bH - 2,
        widthTiles: 5,
        heightTiles: 2,
        targetZone: 'noltia',
        destTx: 28,
        destTy: 4,
        label: 'SOUTH → ICE RIDGE OF NOLTIA',
        direction: 'south',
      },
    ],
    npcs: [
      {
        id: 'burn_feena',
        name: 'GODDESS FEENA',
        role: 'villager',
        tx: 23,
        ty: 34,
        portrait: 'feena',
        cloakColor: '#38bdf8',
        hairColor: '#93c5fd',
        tunicColor: '#e0f2fe',
        greeting: 'Adol! Claim the Time Magic Ring in the west vault & the Cleria Flameblade in the east vault before challenging Darm!',
      },
    ],
    chests: [
      { id: 'burn_time_ring', tx: 5, ty: 29, opened: false, rewardKind: 'time_ring', rewardName: 'Time Magic Ring (3-Way Fire)!' },
      { id: 'burn_sword', tx: 50, ty: 29, opened: false, rewardKind: 'silver_sword', rewardName: 'Cleria Flameblade!' },
      { id: 'burn_book5', tx: 5, ty: 10, opened: false, rewardKind: 'book', rewardName: 'Goddess Crest (5/6)' },
      { id: 'burn_herb', tx: 50, ty: 10, opened: false, rewardKind: 'herb', rewardName: 'Heal Herb' },
    ],
    shrubs: burnShrubs,
    inspectables: [
      {
        id: 'burn_sanctuary',
        tx: 32,
        ty: 34,
        kind: 'pedestal',
        title: 'ALTAR OF THE TWIN GODDESSES',
        lines: [
          'Feena & Reah’s light shines even inside Burnedbless!',
          'Your HP & MP are completely restored for the final battle!',
        ],
        inspected: false,
        healMp: true,
      },
    ],
    bossSpawn: {
      bossId: 'darm',
      name: 'DARM · LORD OF THE BLACK PEARL',
      portrait: 'dalles',
      tx: 28,
      ty: 8,
      hp: 460,
      atk: 38,
      def: 19,
      exp: 650,
      gold: 2200,
      color: '#ef4444',
      accent: '#fde047',
      introLine: 'Dalles has fallen—now behold the true power of DARM! Strike with Steel & Fire!',
      defeatFlag: 'ys2_clear',
      finalBoss: true,
    },
    enemySpawns: [
      { tx: 14, ty: 30, kind: 'knight' },
      { tx: 42, ty: 30, kind: 'wyvern' },
      { tx: 28, ty: 25, kind: 'mage' },
      { tx: 16, ty: 14, kind: 'wyvern' },
      { tx: 40, ty: 14, kind: 'knight' },
      { tx: 22, ty: 12, kind: 'mage' },
      { tx: 34, ty: 12, kind: 'wyvern' },
    ],
  };

  return { lance, moondoria, noltia, burnedbless };
}

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
  isDoorway?: boolean;
  requiredFlag?: string;
  lockedMessage?: string;
}

export type NpcTaskKind =
  | 'sweep'
  | 'water_carry'
  | 'garden'
  | 'hammer'
  | 'carry_crate'
  | 'patrol'
  | 'fish'
  | 'play'
  | 'serve'
  | 'read'
  | 'stroll'
  | 'baker'
  | 'craft';

export interface NpcWaypoint {
  tx: number;
  ty: number;
  waitSec?: number;
  faceAngle?: number;
  performTask?: boolean;
  activityLabel?: string;
}

export interface WorldNpc {
  id: string;
  name: string;
  role: 'quest' | 'weapon' | 'armor' | 'inn' | 'bakery' | 'villager';
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
  rewardPoints?: number;
  secondary?: boolean;
  ageGroup?: 'adult' | 'child' | 'elder';
  task?: NpcTaskKind;
  walkSpeed?: number;
  waypoints?: NpcWaypoint[];
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
  rewardPoints?: number;
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

export type BuildingArchStyle =
  | 'one_story_cottage'
  | 'two_story_timber'
  | 'smithery_foundry'
  | 'observatory_parlor'
  | 'grand_guildhall'
  | 'l_wing_inn'
  | 'apothecary_conservatory'
  | 'longhouse_tavern';

export interface WorldBuilding {
  id: string;
  tx: number;
  ty: number;
  w: number;
  h: number;
  name: string;
  signKind: BuildingSignKind;
  roofStyle: 'crimson' | 'cobalt' | 'terracotta' | 'emerald';
  archStyle?: BuildingArchStyle;
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

export type ForageItemId =
  | 'sunleaf_herb'
  | 'moonblossom'
  | 'celceta_mint'
  | 'wild_berries'
  | 'chanterelle'
  | 'orchard_apple'
  | 'honeycomb'
  | 'iron_ore'
  | 'silver_ore'
  | 'obsidian_shard'
  | 'oak_timber'
  | 'ancient_gear';

export type ForageNodeKind =
  | 'herb_patch'
  | 'berry_bush'
  | 'mushroom_ring'
  | 'fruit_tree'
  | 'beehive_log'
  | 'iron_vein'
  | 'silver_vein'
  | 'obsidian_vein'
  | 'timber_pile'
  | 'relic_scrap';

export interface WorldForageNode {
  id: string;
  tx: number;
  ty: number;
  nodeKind: ForageNodeKind;
  itemId: ForageItemId;
  itemName: string;
  amount: number;
  gathered: boolean;
  respawnTimer?: number;
}

export type CraftStationKind = 'forge' | 'alchemy' | 'cooking';

export interface WorldCraftStation {
  id: string;
  tx: number;
  ty: number;
  stationKind: CraftStationKind;
  title: string;
  subtitle: string;
}

export interface ZoneDef {
  id: string;
  name: string;
  subtitle: string;
  theme: 'town' | 'plains' | 'shrine' | 'tower' | 'village' | 'ruins' | 'ice' | 'lava' | 'interior';
  interiorKind?: BuildingSignKind;
  parentZoneId?: string;
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
  forageNodes?: WorldForageNode[];
  craftStations?: WorldCraftStation[];
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

interface ForageTemplate {
  nodeKind: ForageNodeKind;
  itemId: ForageItemId;
  itemName: string;
  amount: number;
}

const FORAGE_CATALOG: Record<ForageNodeKind, ForageTemplate> = {
  herb_patch: { nodeKind: 'herb_patch', itemId: 'sunleaf_herb', itemName: 'Sunleaf Herb', amount: 2 },
  berry_bush: { nodeKind: 'berry_bush', itemId: 'wild_berries', itemName: 'Wild Esteria Berries', amount: 2 },
  mushroom_ring: { nodeKind: 'mushroom_ring', itemId: 'chanterelle', itemName: 'Forest Chanterelle', amount: 2 },
  fruit_tree: { nodeKind: 'fruit_tree', itemId: 'orchard_apple', itemName: 'Sweet Orchard Apple', amount: 2 },
  beehive_log: { nodeKind: 'beehive_log', itemId: 'honeycomb', itemName: 'Golden Honeycomb', amount: 1 },
  iron_vein: { nodeKind: 'iron_vein', itemId: 'iron_ore', itemName: 'Iron Ore', amount: 2 },
  silver_vein: { nodeKind: 'silver_vein', itemId: 'silver_ore', itemName: 'Cleria Silver Ore', amount: 2 },
  obsidian_vein: { nodeKind: 'obsidian_vein', itemId: 'obsidian_shard', itemName: 'Obsidian Shard', amount: 1 },
  timber_pile: { nodeKind: 'timber_pile', itemId: 'oak_timber', itemName: 'Seasoned Oak Timber', amount: 2 },
  relic_scrap: { nodeKind: 'relic_scrap', itemId: 'ancient_gear', itemName: 'Ancient Relic Gear', amount: 1 },
};

function enrichZonesWithForageAndCrafting(zones: Record<string, ZoneDef>): Record<string, ZoneDef> {
  const isTileClear = (z: ZoneDef, tx: number, ty: number, used: Set<string>): boolean => {
    if (tx < 3 || ty < 3 || tx >= z.width - 3 || ty >= z.height - 3) return false;
    const t = z.tiles[ty]?.[tx];
    if (t !== 0 && t !== 8) return false;
    if (used.has(`${tx},${ty}`)) return false;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (used.has(`${tx + dx},${ty + dy}`)) return false;
      }
    }
    return true;
  };

  const findNearestClear = (z: ZoneDef, startTx: number, startTy: number, used: Set<string>): [number, number] | null => {
    for (let rad = 0; rad <= 10; rad++) {
      for (let dy = -rad; dy <= rad; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          if (Math.abs(dx) !== rad && Math.abs(dy) !== rad) continue;
          const tx = startTx + dx;
          const ty = startTy + dy;
          if (isTileClear(z, tx, ty, used)) return [tx, ty];
        }
      }
    }
    return null;
  };

  for (const z of Object.values(zones)) {
    const used = new Set<string>();
    const markArea = (tx: number, ty: number, pad = 1) => {
      for (let dy = -pad; dy <= pad; dy++) {
        for (let dx = -pad; dx <= pad; dx++) used.add(`${tx + dx},${ty + dy}`);
      }
    };
    for (const p of z.portals) {
      for (let dy = -2; dy <= p.heightTiles + 1; dy++) {
        for (let dx = -2; dx <= p.widthTiles + 1; dx++) used.add(`${p.tx + dx},${p.ty + dy}`);
      }
    }
    for (const n of z.npcs) markArea(n.tx, n.ty, 1);
    for (const ch of z.chests) markArea(ch.tx, ch.ty, 1);
    for (const o of z.inspectables) markArea(o.tx, o.ty, 1);
    for (const sh of z.shrubs) used.add(`${sh.tx},${sh.ty}`);
    if (z.buildings) {
      for (const b of z.buildings) {
        for (let dy = -1; dy <= b.h + 1; dy++) {
          for (let dx = -1; dx <= b.w + 1; dx++) used.add(`${b.tx + dx},${b.ty + dy}`);
        }
      }
    }
    if (z.bossSpawn) markArea(z.bossSpawn.tx, z.bossSpawn.ty, 3);

    const stations: WorldCraftStation[] = [...(z.craftStations ?? [])];
    const addStation = (id: string, tx: number, ty: number, stationKind: CraftStationKind, title: string, subtitle: string) => {
      const spot = z.theme === 'interior' ? ([tx, ty] as [number, number]) : findNearestClear(z, tx, ty, used);
      if (!spot) return;
      stations.push({ id, tx: spot[0], ty: spot[1], stationKind, title, subtitle });
      markArea(spot[0], spot[1], 2);
    };

    if (z.id === 'minea') {
      // Reserve Minea Bakery, Community Tables, Craftworks & Pastures
      for (const [rx, ry] of [[36, 46], [44, 44], [59, 44], [39, 52], [76, 47], [24, 23], [75, 23]]) markArea(rx, ry, 3);
      addStation('minea_grand_forge', 71, 20, 'forge', 'MINEA GRAND FORGE & ANVIL', 'Smelt Iron, Silver & Obsidian into Masterwork Blades, Shields & Charms!');
      addStation('minea_alchemy_cauldron', 64, 52, 'alchemy', 'HERBALIST ALCHEMY CAULDRON', 'Brew Sunleaf Herbs, Moonblossoms & Celceta Mint into Potent Tonics!');
      addStation('minea_hearth_kettle', 55, 44, 'cooking', 'COMMUNITY HEARTH COOKING KETTLE', 'Cook Wild Berries, Chanterelles, Apples & Honey into Hearty Meals!');
    } else if (z.id === 'minea_weapons' || z.id === 'lance_forge_room') {
      addStation(`${z.id}_forge`, Math.min(z.width - 4, 11), 5, 'forge', 'MASTER BLACKSMITH FORGE', 'Forge custom blades, bucklers & relics from scavenged ore!');
    } else if (z.id === 'minea_herbalist' || z.id === 'lance_clinic_room') {
      addStation(`${z.id}_alchemy`, Math.min(z.width - 4, 11), 5, 'alchemy', 'APOTHECARY BREWING CAULDRON', 'Distill wild herbs & blossoms into healing salves & elixirs!');
    } else if (z.id === 'plains') {
      addStation('plains_camp_kettle', 56, 56, 'cooking', 'WAYFARER CAMPFIRE KETTLE', 'Cook scavenged Esteria berries, mushrooms & apples on the trail!');
      addStation('plains_field_forge', 46, 25, 'forge', 'ZEPIK TRAIL FIELD FORGE', 'Temper scavenged Iron & Silver Ore right beside the Royal Road!');
    } else if (z.id === 'lance') {
      addStation('lance_village_forge', 68, 28, 'forge', 'LANCE VILLAGE FORGE', 'Shape Cleria Silver & Iron Ore into radiant Ys gear!');
      addStation('lance_alchemy_cauldron', 28, 30, 'alchemy', 'CELCETA HERB CAULDRON', 'Brew floating-isle herbs & Moonblossoms into elixirs!');
      addStation('lance_hearth_kettle', 48, 42, 'cooking', 'VILLAGE HEARTH KETTLE', 'Simmer fresh woodland mushrooms, apples & berries!');
    }
    z.craftStations = stations;

    // Populate lush Forageable Nodes across all outdoor & dungeon zones!
    if (z.theme === 'interior') {
      z.forageNodes = [];
      continue;
    }

    const poolByTheme: Record<ZoneDef['theme'], ForageTemplate[]> = {
      town: [
        FORAGE_CATALOG.herb_patch,
        FORAGE_CATALOG.berry_bush,
        FORAGE_CATALOG.mushroom_ring,
        FORAGE_CATALOG.fruit_tree,
        FORAGE_CATALOG.beehive_log,
        FORAGE_CATALOG.timber_pile,
        FORAGE_CATALOG.iron_vein,
        { nodeKind: 'herb_patch', itemId: 'celceta_mint', itemName: 'Celceta Mint', amount: 2 },
        FORAGE_CATALOG.relic_scrap,
      ],
      village: [
        FORAGE_CATALOG.herb_patch,
        { nodeKind: 'herb_patch', itemId: 'moonblossom', itemName: 'Moonblossom', amount: 2 },
        { nodeKind: 'herb_patch', itemId: 'celceta_mint', itemName: 'Celceta Mint', amount: 2 },
        FORAGE_CATALOG.berry_bush,
        FORAGE_CATALOG.mushroom_ring,
        FORAGE_CATALOG.fruit_tree,
        FORAGE_CATALOG.beehive_log,
        FORAGE_CATALOG.iron_vein,
        FORAGE_CATALOG.silver_vein,
        FORAGE_CATALOG.timber_pile,
      ],
      plains: [
        FORAGE_CATALOG.herb_patch,
        { nodeKind: 'herb_patch', itemId: 'moonblossom', itemName: 'Moonblossom', amount: 2 },
        { nodeKind: 'herb_patch', itemId: 'celceta_mint', itemName: 'Celceta Mint', amount: 2 },
        FORAGE_CATALOG.berry_bush,
        FORAGE_CATALOG.mushroom_ring,
        FORAGE_CATALOG.fruit_tree,
        FORAGE_CATALOG.beehive_log,
        FORAGE_CATALOG.iron_vein,
        FORAGE_CATALOG.silver_vein,
        FORAGE_CATALOG.timber_pile,
        FORAGE_CATALOG.relic_scrap,
      ],
      ruins: [
        { nodeKind: 'herb_patch', itemId: 'moonblossom', itemName: 'Moonblossom', amount: 2 },
        FORAGE_CATALOG.silver_vein,
        FORAGE_CATALOG.iron_vein,
        FORAGE_CATALOG.relic_scrap,
        FORAGE_CATALOG.mushroom_ring,
      ],
      shrine: [
        FORAGE_CATALOG.silver_vein,
        FORAGE_CATALOG.obsidian_vein,
        FORAGE_CATALOG.relic_scrap,
        { nodeKind: 'herb_patch', itemId: 'moonblossom', itemName: 'Moonblossom', amount: 2 },
      ],
      tower: [
        FORAGE_CATALOG.obsidian_vein,
        FORAGE_CATALOG.silver_vein,
        FORAGE_CATALOG.relic_scrap,
      ],
      ice: [
        { nodeKind: 'herb_patch', itemId: 'celceta_mint', itemName: 'Celceta Mint', amount: 2 },
        FORAGE_CATALOG.silver_vein,
        FORAGE_CATALOG.obsidian_vein,
        FORAGE_CATALOG.relic_scrap,
      ],
      lava: [
        FORAGE_CATALOG.obsidian_vein,
        FORAGE_CATALOG.silver_vein,
        FORAGE_CATALOG.relic_scrap,
      ],
      interior: [],
    };

    const pool = poolByTheme[z.theme] ?? [];
    const targetCount = z.id === 'plains' ? 28 : z.id === 'minea' ? 22 : z.id === 'lance' ? 20 : 12;
    const nodes: WorldForageNode[] = [];
    const stepX = Math.max(4, Math.floor((z.width - 10) / 7));
    const stepY = Math.max(4, Math.floor((z.height - 10) / 6));

    // Seed guaranteed immediate starter forage nodes right near Minea Town's plaza/meadows so players can gather & forge quickly!
    const pinnedSpots: Array<[number, number, ForageTemplate]> =
      z.id === 'minea'
        ? [
            [42, 30, FORAGE_CATALOG.herb_patch],
            [62, 30, FORAGE_CATALOG.berry_bush],
            [69, 24, FORAGE_CATALOG.iron_vein],
            [73, 25, FORAGE_CATALOG.timber_pile],
            [33, 38, FORAGE_CATALOG.fruit_tree],
            [40, 41, FORAGE_CATALOG.mushroom_ring],
            [65, 46, FORAGE_CATALOG.beehive_log],
            [68, 41, { nodeKind: 'herb_patch', itemId: 'moonblossom', itemName: 'Moonblossom', amount: 2 }],
            [29, 32, { nodeKind: 'herb_patch', itemId: 'celceta_mint', itemName: 'Celceta Mint', amount: 2 }],
            [79, 22, FORAGE_CATALOG.silver_vein],
            [18, 44, FORAGE_CATALOG.relic_scrap],
          ]
        : [];

    for (let pi = 0; pi < pinnedSpots.length; pi++) {
      const [px, py, tpl] = pinnedSpots[pi];
      const spot = findNearestClear(z, px, py, used);
      if (!spot) continue;
      nodes.push({
        id: `${z.id}_forage_pin_${pi}`,
        tx: spot[0],
        ty: spot[1],
        nodeKind: tpl.nodeKind,
        itemId: tpl.itemId,
        itemName: tpl.itemName,
        amount: tpl.amount,
        gathered: false,
      });
      markArea(spot[0], spot[1], 1);
    }

    let seedIdx = 0;
    for (let ty = 6; ty < z.height - 6 && nodes.length < targetCount; ty += stepY) {
      for (let tx = 6; tx < z.width - 6 && nodes.length < targetCount; tx += stepX) {
        const jx = ((seedIdx * 7 + ty * 3) % 5) - 2;
        const jy = ((seedIdx * 11 + tx * 5) % 5) - 2;
        const spot = findNearestClear(z, tx + jx, ty + jy, used);
        seedIdx++;
        if (!spot || pool.length === 0) continue;
        const tpl = pool[nodes.length % pool.length];
        nodes.push({
          id: `${z.id}_forage_${nodes.length}`,
          tx: spot[0],
          ty: spot[1],
          nodeKind: tpl.nodeKind,
          itemId: tpl.itemId,
          itemName: tpl.itemName,
          amount: tpl.amount,
          gathered: false,
        });
        markArea(spot[0], spot[1], 1);
      }
    }

    z.forageNodes = nodes;
  }

  return zones;
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
    archStyle?: BuildingArchStyle;
    hasChimney?: boolean;
  }
): void {
  const roofH = Math.max(2, Math.floor(h * 0.52));
  fillRect(g, x0, y0, w, roofH, 5);
  fillRect(g, x0, y0 + roofH, w, h - roofH, 1);
  // Wide welcoming cobblestone entryway in front of larger building door
  const doorX = x0 + Math.floor(w / 2);
  fillRect(g, doorX - 1, y0 + h, 3, 2, 6);
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
      archStyle: meta.archStyle,
      hasChimney: meta.hasChimney ?? true,
    });
  }
}

function placeTreeBlock(g: WorldTile[][], x0: number, y0: number, w: number, h: number): void {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (y >= 1 && y < g.length - 1 && x >= 1 && x < g[0].length - 1 && (g[y][x] === 0 || g[y][x] === 8)) {
        g[y][x] = 2;
      }
    }
  }
}

interface InteriorRoomSpec {
  id: string;
  name: string;
  subtitle: string;
  interiorKind: BuildingSignKind;
  parentZoneId: string;
  parentLabel: string;
  exitDestTx: number;
  exitDestTy: number;
  npcs: WorldNpc[];
  inspectables: WorldInspectable[];
  chests?: WorldChest[];
}

function createBuildingInteriorZone(spec: InteriorRoomSpec): ZoneDef {
  const iW = 22;
  const iH = 16;
  const tiles = makeGrid(iW, iH, 0);
  // Warm perimeter timber walls
  for (let x = 0; x < iW; x++) {
    tiles[0][x] = 1;
    tiles[1][x] = 1;
    tiles[iH - 1][x] = 1;
  }
  for (let y = 0; y < iH; y++) {
    tiles[y][0] = 1;
    tiles[y][1] = 1;
    tiles[y][iW - 2] = 1;
    tiles[y][iW - 1] = 1;
  }
  // Plush central carpet & entrance runner leading down to the front doorway
  fillRect(tiles, 9, 4, 4, 12, 6);
  fillRect(tiles, 5, 5, 12, 6, 6);
  // Warm hearth stone area near north back wall
  fillRect(tiles, 9, 2, 4, 2, 8);
  // Open south exit doorway gap
  fillRect(tiles, 9, iH - 2, 4, 2, 6);
  // Cozy corner glowing hearth braziers / brass floor lamps
  setTile(tiles, 3, 3, 7);
  setTile(tiles, iW - 4, 3, 7);
  setTile(tiles, 3, iH - 3, 7);
  setTile(tiles, iW - 4, iH - 3, 7);

  return {
    id: spec.id,
    name: spec.name,
    subtitle: spec.subtitle,
    theme: 'interior',
    interiorKind: spec.interiorKind,
    parentZoneId: spec.parentZoneId,
    safeZone: true,
    canAutoHeal: true,
    width: iW,
    height: iH,
    tiles,
    portals: [
      {
        id: `${spec.id}_exit`,
        tx: 9,
        ty: iH - 2,
        widthTiles: 4,
        heightTiles: 2,
        targetZone: spec.parentZoneId,
        destTx: spec.exitDestTx,
        destTy: spec.exitDestTy,
        label: `EXIT → ${spec.parentLabel}`,
        direction: 'south',
        isDoorway: true,
      },
    ],
    npcs: spec.npcs,
    chests: spec.chests ?? [],
    shrubs: [],
    inspectables: spec.inspectables,
    enemySpawns: [],
  };
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

/**
 * Natural impassable transitional woodland perimeter (ZERO brick walls!):
 * Builds an organic 2-to-4-tile-deep dense forest margin with scalloped woodland coves
 * around outdoor overworld maps. If `southWaterRow` is provided, rows >= southWaterRow
 * open smoothly onto coastal sea or floating-island sky abyss instead of trees.
 */
function naturalForestBorder(g: WorldTile[][], southWaterRow?: number): void {
  const h = g.length;
  const w = g[0].length;
  const maxLandY = southWaterRow !== undefined ? Math.min(h, southWaterRow) : h;
  for (let x = 0; x < w; x++) {
    const northDepth = 2 + (((x * 7 + 3) >> 2) % 3); // 2..4 tiles deep organic forest edge
    for (let y = 0; y < Math.min(northDepth, maxLandY); y++) {
      g[y][x] = 2;
    }
    if (southWaterRow === undefined) {
      const southDepth = 2 + (((x * 11 + 5) >> 2) % 3);
      for (let y = h - southDepth; y < h; y++) {
        if (y >= 0) g[y][x] = 2;
      }
    }
  }
  for (let y = 0; y < maxLandY; y++) {
    const westDepth = 2 + (((y * 9 + 1) >> 2) % 3);
    const eastDepth = 2 + (((y * 13 + 4) >> 2) % 3);
    for (let x = 0; x < westDepth; x++) g[y][x] = 2;
    for (let x = w - eastDepth; x < w; x++) g[y][x] = 2;
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
  // 1. MINEA TOWN & HARBOR (104x76 — Massive ~4x Coastal Port City with Enterable Shops!)
  // --------------------------------------------------------------------------
  const mW = 104;
  const mH = 76;
  const mTiles = makeGrid(mW, mH, 0);
  // Natural impassable transitional woodland border along north, west & east (ZERO brick perimeter walls!)
  naturalForestBorder(mTiles, 65);

  // Decorative sunlit wildflower gardens & parks across all three terraces
  fillRect(mTiles, 5, 5, 35, 17, 8);
  fillRect(mTiles, 64, 5, 35, 17, 8);
  fillRect(mTiles, 5, 29, 31, 18, 8);
  fillRect(mTiles, 68, 29, 31, 18, 8);
  fillRect(mTiles, 8, 52, 24, 10, 8);
  fillRect(mTiles, 72, 52, 24, 10, 8);

  // Sweeping Southern Harbor Sea (y = 65..75 open horizon!) + Wooded Headland Flanks + 3 Grand Timber Piers
  fillRect(mTiles, 0, 65, mW, mH - 65, 3);
  fillRect(mTiles, 0, 65, 3, 5, 2); // West wooded headland bluff framing harbor cove
  fillRect(mTiles, mW - 3, 65, 3, 5, 2); // East wooded headland bluff framing harbor cove
  fillRect(mTiles, 20, 65, 5, 8, 4); // West cargo pier
  fillRect(mTiles, 49, 65, 6, 9, 4); // Grand central harbor pier
  fillRect(mTiles, 78, 65, 5, 8, 4); // East fishing pier

  // Grand Cobblestone Boulevards, Terraced Promenade & Central Fountain Square
  fillRect(mTiles, 49, 0, 6, 65, 6); // Grand North-South Royal Avenue (open through north forest pass!)
  fillRect(mTiles, 8, 36, 88, 4, 6); // Middle East-West Grand Boulevard
  fillRect(mTiles, 42, 31, 20, 14, 6); // Grand Central Fountain Plaza
  fillRect(mTiles, 21, 38, 4, 27, 6); // West Harbor Avenue
  fillRect(mTiles, 79, 38, 4, 27, 6); // East Harbor Avenue
  fillRect(mTiles, 10, 18, 84, 3, 6); // Upper Terrace Promenade
  fillRect(mTiles, 10, 58, 84, 3, 6); // Waterfront Quay Promenade

  // Architecturally Diverse 1-Story, 2-Story, Turret, L-Wing, Foundry & Conservatory Enterable Buildings!
  const mineaBuildings: WorldBuilding[] = [];
  placeCottage(mTiles, 10, 8, 11, 6, mineaBuildings, { id: 'm_sara', name: "SARA'S FORTUNE PARLOR", signKind: 'fortune', roofStyle: 'cobalt', archStyle: 'observatory_parlor', hasChimney: true });
  placeCottage(mTiles, 27, 8, 11, 6, mineaBuildings, { id: 'm_lib', name: 'MINEA GREAT LIBRARY', signKind: 'library', roofStyle: 'terracotta', archStyle: 'grand_guildhall', hasChimney: true });
  placeCottage(mTiles, 64, 8, 12, 6, mineaBuildings, { id: 'm_wep', name: "PIM'S WEAPON SMITHERY", signKind: 'weapon', roofStyle: 'crimson', archStyle: 'smithery_foundry', hasChimney: true });
  placeCottage(mTiles, 82, 8, 11, 6, mineaBuildings, { id: 'm_guild', name: 'ESTERIA GUILDHALL', signKind: 'guild', roofStyle: 'cobalt', archStyle: 'grand_guildhall', hasChimney: true });

  placeCottage(mTiles, 10, 26, 11, 6, mineaBuildings, { id: 'm_arm', name: 'ROYAL ARMORY', signKind: 'armor', roofStyle: 'crimson', archStyle: 'two_story_timber', hasChimney: true });
  placeCottage(mTiles, 82, 26, 12, 6, mineaBuildings, { id: 'm_inn', name: 'MINEA HARBOR INN', signKind: 'inn', roofStyle: 'emerald', archStyle: 'l_wing_inn', hasChimney: true });

  placeCottage(mTiles, 8, 48, 10, 6, mineaBuildings, { id: 'm_ware', name: 'PORT WAREHOUSE', signKind: 'house', roofStyle: 'terracotta', archStyle: 'one_story_cottage', hasChimney: false });
  placeCottage(mTiles, 28, 48, 11, 6, mineaBuildings, { id: 'm_tavern', name: 'BARBADO TAVERN', signKind: 'tavern', roofStyle: 'crimson', archStyle: 'longhouse_tavern', hasChimney: true });
  placeCottage(mTiles, 64, 48, 11, 6, mineaBuildings, { id: 'm_herb', name: 'CELCETA HERBALIST', signKind: 'clinic', roofStyle: 'emerald', archStyle: 'apothecary_conservatory', hasChimney: true });
  placeCottage(mTiles, 85, 48, 10, 6, mineaBuildings, { id: 'm_light', name: 'HARBORMASTER HALL', signKind: 'house', roofStyle: 'cobalt', archStyle: 'observatory_parlor', hasChimney: true });

  // Connect every building's front doorway cleanly to its terrace avenue
  fillRect(mTiles, 14, 14, 3, 5, 6);
  fillRect(mTiles, 31, 14, 3, 5, 6);
  fillRect(mTiles, 69, 14, 3, 5, 6);
  fillRect(mTiles, 86, 14, 3, 5, 6);
  fillRect(mTiles, 14, 32, 3, 5, 6);
  fillRect(mTiles, 87, 32, 3, 5, 6);
  fillRect(mTiles, 12, 54, 3, 5, 6);
  fillRect(mTiles, 32, 54, 3, 5, 6);
  fillRect(mTiles, 68, 54, 3, 5, 6);
  fillRect(mTiles, 89, 54, 3, 5, 6);

  // Abundant Monumental Multi-Tile Tree Groves (4x4, 4x2, 2x4, 3x3, 3x2, 2x3, 2x2) framing Minea!
  placeTreeBlock(mTiles, 3, 4, 4, 4);   // NW ancient oak grove (4x4)
  placeTreeBlock(mTiles, 96, 4, 4, 4);  // NE ancient oak grove (4x4)
  placeTreeBlock(mTiles, 41, 5, 4, 3);  // North gate west canopy (4x3)
  placeTreeBlock(mTiles, 59, 5, 4, 3);  // North gate east canopy (4x3)
  placeTreeBlock(mTiles, 22, 8, 3, 3);  // Upper park west grove (3x3)
  placeTreeBlock(mTiles, 77, 8, 3, 3);  // Upper park east grove (3x3)
  placeTreeBlock(mTiles, 3, 14, 4, 4);  // West upper hillside oaks (4x4)
  placeTreeBlock(mTiles, 96, 14, 4, 4); // East upper hillside oaks (4x4)
  placeTreeBlock(mTiles, 3, 25, 4, 4);  // Mid-west ancient grove (4x4)
  placeTreeBlock(mTiles, 24, 25, 3, 3); // Armory garden grove (3x3)
  placeTreeBlock(mTiles, 32, 25, 3, 3); // Plaza NW ancient oaks (3x3)
  placeTreeBlock(mTiles, 68, 25, 3, 3); // Inn garden grove (3x3)
  placeTreeBlock(mTiles, 75, 25, 4, 3); // East meadow canopy (4x3)
  placeTreeBlock(mTiles, 96, 26, 4, 4); // East terrace grove (4x4)
  placeTreeBlock(mTiles, 3, 41, 4, 4);  // SW woodland border grove (4x4)
  placeTreeBlock(mTiles, 11, 41, 4, 3); // Warehouse north grove (4x3)
  placeTreeBlock(mTiles, 28, 41, 4, 3); // Tavern shade grove (4x3)
  placeTreeBlock(mTiles, 68, 41, 4, 3); // Herbalist shade grove (4x3)
  placeTreeBlock(mTiles, 87, 41, 4, 3); // Harbormaster north grove (4x3)
  placeTreeBlock(mTiles, 96, 43, 4, 4); // SE coastal forest grove (4x4)
  placeTreeBlock(mTiles, 42, 48, 3, 3); // Central avenue west grove (3x3)
  placeTreeBlock(mTiles, 58, 48, 3, 3); // Central avenue east grove (3x3)
  placeTreeBlock(mTiles, 3, 52, 4, 4);  // Far SW harbor pines (4x4)
  placeTreeBlock(mTiles, 96, 52, 4, 4); // Far SE harbor pines (4x4)
  placeTreeBlock(mTiles, 4, 61, 4, 3);  // West coastal bluff trees (4x3)
  placeTreeBlock(mTiles, 30, 61, 4, 2); // Harbor quay west oaks (4x2)
  placeTreeBlock(mTiles, 68, 61, 4, 2); // Harbor quay east oaks (4x2)
  placeTreeBlock(mTiles, 95, 61, 4, 3); // East coastal bluff trees (4x3)
  placeTreeBlock(mTiles, 40, 22, 3, 3); // North fountain terrace west oak (3x3)
  placeTreeBlock(mTiles, 60, 22, 3, 3); // North fountain terrace east oak (3x3)
  for (const [tx, ty] of [
    [40, 14], [63, 14], [6, 18], [97, 18],
    [16, 42], [88, 42], [26, 62], [75, 62],
  ]) {
    setTile(mTiles, tx, ty, 2);
  }

  // Glowing Street Braziers & Harbor Lanterns
  for (const [lx, ly] of [
    [48, 4], [55, 4], [48, 17], [55, 17], [41, 30], [62, 30],
    [41, 45], [62, 45], [48, 57], [55, 57], [48, 64], [55, 64],
    [19, 64], [25, 64], [77, 64], [83, 64], [20, 35], [83, 35],
  ]) {
    setTile(mTiles, lx, ly, 7);
  }

  // Open North Forest Pass (6 tiles wide at rows 0..4)
  fillRect(mTiles, 49, 0, 6, 5, 6);

  const mineaShrubs = scatterShrubs(
    'minea',
    mTiles,
    [
      { tx: 8, ty: 15, variant: 'blossom', hiddenKind: 'gold', hiddenAmount: 55 },
      { tx: 22, ty: 16, variant: 'berry', hiddenKind: 'clue', clueText: 'A crumpled note: "Sara inside her Fortune Parlor lost a blue Sapphire Crystal in the shrubs east of the Grand Fountain!"' },
      { tx: 25, ty: 15, variant: 'fern' },
      { tx: 40, ty: 16, variant: 'blossom', hiddenKind: 'herb' },
      { tx: 45, ty: 24, variant: 'blossom' },
      { tx: 64, ty: 34, variant: 'blossom', hiddenKind: 'quest_item', grantFlag: 'sara_crystal', rewardName: "Sara's Sapphire Crystal!" },
      { tx: 66, ty: 23, variant: 'berry', hiddenKind: 'gold', hiddenAmount: 50 },
      { tx: 76, ty: 16, variant: 'fern' },
      { tx: 94, ty: 16, variant: 'blossom', hiddenKind: 'gold', hiddenAmount: 65 },
      { tx: 8, ty: 33, variant: 'berry' },
      { tx: 28, ty: 32, variant: 'fern', hiddenKind: 'gold', hiddenAmount: 45 },
      { tx: 37, ty: 31, variant: 'blossom' },
      { tx: 76, ty: 33, variant: 'berry', hiddenKind: 'herb' },
      { tx: 95, ty: 33, variant: 'blossom' },
      { tx: 8, ty: 44, variant: 'fern' },
      { tx: 18, ty: 55, variant: 'berry', hiddenKind: 'clue', clueText: 'Hidden beneath the petals: "Enter Pim’s Weapon Smithery & the Royal Armory on the upper terraces to forge Silver gear!"' },
      { tx: 38, ty: 44, variant: 'blossom' },
      { tx: 46, ty: 54, variant: 'berry', hiddenKind: 'gold', hiddenAmount: 70 },
      { tx: 57, ty: 54, variant: 'fern' },
      { tx: 76, ty: 55, variant: 'blossom' },
      { tx: 95, ty: 55, variant: 'berry', hiddenKind: 'seed', rewardName: 'Roda Seed (+10 Max HP!)' },
      { tx: 29, ty: 62, variant: 'fern' },
      { tx: 42, ty: 62, variant: 'blossom', hiddenKind: 'gold', hiddenAmount: 55 },
      { tx: 61, ty: 62, variant: 'berry' },
      { tx: 71, ty: 62, variant: 'fern', hiddenKind: 'herb' },
      { tx: 14, ty: 22, variant: 'blossom', hiddenKind: 'gold', hiddenAmount: 40 },
      { tx: 36, ty: 22, variant: 'berry' },
      { tx: 68, ty: 22, variant: 'blossom' },
      { tx: 89, ty: 22, variant: 'fern', hiddenKind: 'gold', hiddenAmount: 50 },
      { tx: 12, ty: 62, variant: 'blossom' },
      { tx: 92, ty: 62, variant: 'berry', hiddenKind: 'gold', hiddenAmount: 60 },
      // Extra hidden investigation relics & mini-quest items tucked behind large oak groves!
      { tx: 9, ty: 24, variant: 'berry', hiddenKind: 'quest_item', grantFlag: 'silver_calf_bell', rewardName: 'Lost Silver Calf Bell!' },
      { tx: 75, ty: 44, variant: 'fern', hiddenKind: 'clue', clueText: 'Grease-stained craftsman note: "The bronze drive cog rolled right past the west quay crates near the waterwheel!"' },
      { tx: 39, ty: 27, variant: 'blossom', hiddenKind: 'quest_item', grantFlag: 'golden_wheat_sack', rewardName: 'Golden Esteria Wheat Flour!' },
      { tx: 65, ty: 44, variant: 'berry', hiddenKind: 'gold', hiddenAmount: 85 },
      { tx: 46, ty: 61, variant: 'fern', hiddenKind: 'quest_item', grantFlag: 'dice_lucky_token', rewardName: 'Ivory Esteria Crown Die!' },
      { tx: 86, ty: 23, variant: 'blossom', hiddenKind: 'gold', hiddenAmount: 75 },
    ],
    'blossom'
  );

  // Build Bespoke Enterable Interior Room Zones for Minea Town's Shops & Guilds!
  const mineaSaraRoom = createBuildingInteriorZone({
    id: 'minea_sara',
    name: "SARA'S FORTUNE PARLOR",
    subtitle: 'Velvet Divination Sanctuary · Speak with Sara & Inspect Mystic Relics',
    interiorKind: 'fortune',
    parentZoneId: 'minea',
    parentLabel: 'MINEA TOWN',
    exitDestTx: 15,
    exitDestTy: 16,
    npcs: [
      {
        id: 'sara',
        name: 'SARA',
        role: 'quest',
        tx: 10,
        ty: 5,
        portrait: 'sara',
        cloakColor: '#9333ea',
        hairColor: '#fde047',
        tunicColor: '#c084fc',
        greeting: 'Adol! Welcome inside my Parlor. Search the flowering shrubs just east of Minea’s Grand Fountain for my Sapphire Crystal, then journey north to Esteria Plains & the Shrine of Solomon!',
        followUpFlag: 'sara_crystal',
        followUpGreeting: 'You recovered my Sapphire Crystal! Take 200 Gold & my blessing—seek Feena and the 6 Books of Ys in the Shrine of Solomon!',
        grantFlag: 'sara_blessing',
        rewardGold: 200,
      },
    ],
    inspectables: [
      {
        id: 'sara_crystal_orb',
        tx: 6,
        ty: 5,
        kind: 'pedestal',
        title: 'MYSTIC DIVINATION CRYSTAL',
        lines: [
          'Swirling indigo starlight illuminates a vision of six golden Books of Ys floating above Esteria.',
          'Sara’s serene aura restores your vigor! (HP & MP restored!)',
        ],
        inspected: false,
        healMp: true,
      },
      {
        id: 'sara_prophecy_shelf',
        tx: 15,
        ty: 4,
        kind: 'bookshelf',
        title: 'BOOK OF PROPHECIES',
        lines: [
          'Hand-inked star charts reveal secret caches buried in Esteria Plains’ northern groves.',
          'You find a lucky fortune coin tucked in the ribbon (+60 Gold)!',
        ],
        inspected: false,
        rewardGold: 60,
      },
    ],
  });

  const mineaWeaponsRoom = createBuildingInteriorZone({
    id: 'minea_weapons',
    name: "PIM'S WEAPON SMITHERY",
    subtitle: 'Blazing Cleria Forge & Blade Showroom · Upgrade Swords & Stock Herbs',
    interiorKind: 'weapon',
    parentZoneId: 'minea',
    parentLabel: 'MINEA TOWN',
    exitDestTx: 70,
    exitDestTy: 16,
    npcs: [
      {
        id: 'minea_weapons',
        name: 'PIM THE SMITH',
        role: 'weapon',
        tx: 10,
        ty: 5,
        portrait: 'merchant',
        cloakColor: '#b91c1c',
        hairColor: '#92400e',
        tunicColor: '#f59e0b',
        greeting: 'Step up to the forge, Adol! Feel the heat of Esterian steel—upgrade your blade right here before crossing into the Shrine of Solomon!',
      },
      {
        id: 'minea_smith_apprentice_in',
        name: 'APPRENTICE DARO',
        role: 'villager',
        secondary: true,
        task: 'hammer',
        walkSpeed: 1.35,
        tx: 7,
        ty: 8,
        portrait: 'merchant',
        cloakColor: '#7c2d12',
        hairColor: '#78350f',
        tunicColor: '#ea580c',
        greeting: 'Clang! Clang! Master Pim has me tempering steel sword-guards all afternoon—watch out for flying sparks!',
        waypoints: [
          { tx: 6, ty: 8, waitSec: 4.8, faceAngle: -Math.PI * 0.75, performTask: true, activityLabel: 'Hammering Steel' },
          { tx: 13, ty: 9, waitSec: 2.4, faceAngle: -Math.PI * 0.5, performTask: false, activityLabel: 'Checking Blades' },
        ],
      },
    ],
    inspectables: [
      {
        id: 'pim_inner_anvil',
        tx: 5,
        ty: 6,
        kind: 'anvil',
        title: 'MASTERWORK CLERIA ANVIL',
        lines: [
          'Pim’s prized forging anvil rings like a bell when tapped with a steel hammer.',
          'Engraved tip: "Bump monsters slightly off-center or lunge with [SPACE] for clean zero-damage crits!"',
        ],
        inspected: false,
      },
      {
        id: 'pim_forge_ledger',
        tx: 16,
        ty: 5,
        kind: 'bookshelf',
        title: 'BLADESMITH ALLOY LEDGER',
        lines: [
          'Sketches of Talwar Blades and legendary Silver Swords crafted from ancient Cleria ore.',
          'You spot 50 Gold in loose smithy rebate coins beside the inkwell!',
        ],
        inspected: false,
        rewardGold: 50,
      },
    ],
  });

  const mineaArmorRoom = createBuildingInteriorZone({
    id: 'minea_armor',
    name: 'MINEA ROYAL ARMORY',
    subtitle: 'Steel Cuirasses, Knight Plate & Kite Shields · Fortify Your Defense',
    interiorKind: 'armor',
    parentZoneId: 'minea',
    parentLabel: 'MINEA TOWN',
    exitDestTx: 15,
    exitDestTy: 34,
    npcs: [
      {
        id: 'minea_armor',
        name: 'ARMOR SMITH',
        role: 'armor',
        tx: 10,
        ty: 5,
        portrait: 'merchant',
        cloakColor: '#1d4ed8',
        hairColor: '#cbd5e1',
        tunicColor: '#60a5fa',
        greeting: 'Welcome to Minea’s Royal Armory! Inspect our plate displays—Heavy Plate & Silver Shields turn lethal head-on blows into mere scratches!',
      },
    ],
    inspectables: [
      {
        id: 'armor_knight_stand',
        tx: 5,
        ty: 5,
        kind: 'statue',
        title: 'SILVER KNIGHT PLATE DISPLAY',
        lines: [
          'Polished chainmail and fluted breastplates gleam beneath the warm armory sconces.',
          'Tag reads: "Legend says an intact suit of true Silver Armor sleeps deep inside the Shrine of Solomon."',
        ],
        inspected: false,
      },
      {
        id: 'armor_workbench',
        tx: 16,
        ty: 6,
        kind: 'anvil',
        title: 'SHIELD RIVETING BENCH',
        lines: [
          'Brass rivets, oak shield cores, and leather straps lie ready for mastercraft repair.',
          'You pocket 45 Gold in guild scrap bounty!',
        ],
        inspected: false,
        rewardGold: 45,
      },
    ],
  });

  const mineaInnRoom = createBuildingInteriorZone({
    id: 'minea_inn',
    name: 'MINEA HARBOR INN',
    subtitle: 'Warm Hearth, Cozy Guest Beds & Traveler Provisions',
    interiorKind: 'inn',
    parentZoneId: 'minea',
    parentLabel: 'MINEA TOWN',
    exitDestTx: 88,
    exitDestTy: 34,
    npcs: [
      {
        id: 'minea_inn',
        name: 'HARBOR INNKEEPER',
        role: 'inn',
        tx: 10,
        ty: 5,
        portrait: 'feena',
        cloakColor: '#0284c7',
        hairColor: '#7dd3fc',
        tunicColor: '#e0f2fe',
        greeting: 'Welcome to Minea Harbor Inn! Warm up by our stone hearth, rest for full HP & MP, or stock up on Heal Herbs for your journey!',
      },
      {
        id: 'minea_inn_maid',
        name: 'MAID HANA',
        role: 'villager',
        secondary: true,
        task: 'sweep',
        walkSpeed: 1.4,
        tx: 7,
        ty: 9,
        portrait: 'lilia',
        cloakColor: '#0369a1',
        hairColor: '#92400e',
        tunicColor: '#f0f9ff',
        greeting: 'Keeping the oak floorboards spotless for travelers! Nothing beats fresh linen and a crackling hearth after Esteria Plains.',
        waypoints: [
          { tx: 7, ty: 9, waitSec: 4.2, faceAngle: 0, performTask: true, activityLabel: 'Sweeping Hall' },
          { tx: 14, ty: 9, waitSec: 4.2, faceAngle: Math.PI, performTask: true, activityLabel: 'Sweeping Hearth' },
          { tx: 12, ty: 8, waitSec: 2.4, faceAngle: -Math.PI * 0.5, performTask: false, activityLabel: 'Tidying Rooms' },
        ],
      },
    ],
    inspectables: [
      {
        id: 'inn_hearth',
        tx: 10,
        ty: 3,
        kind: 'campfire',
        title: 'CRACKLING INN HEARTH',
        lines: [
          'A cheerful oak fire warms the entire timber parlor, smelling of cedar and spiced cider.',
          'Its comforting warmth restores your spirit! (HP & MP restored!)',
        ],
        inspected: false,
        healMp: true,
      },
      {
        id: 'inn_guestbook',
        tx: 15,
        ty: 6,
        kind: 'bookshelf',
        title: 'HARBOR INN GUEST REGISTER',
        lines: [
          'Recent entry by Dogi: "Heading north past Zepik toward Darm Tower—leave a mug warm for me!"',
          'You notice a friendly traveler left 50 Gold for the next red-haired adventurer!',
        ],
        inspected: false,
        rewardGold: 50,
      },
    ],
  });

  const mineaTavernRoom = createBuildingInteriorZone({
    id: 'minea_tavern',
    name: 'BARBADO TAVERN',
    subtitle: 'Sailor Songs, Vintage Ale Casks & Reah the Poet',
    interiorKind: 'tavern',
    parentZoneId: 'minea',
    parentLabel: 'MINEA TOWN',
    exitDestTx: 33,
    exitDestTy: 56,
    npcs: [
      {
        id: 'minea_reah',
        name: 'REAH THE POET',
        role: 'quest',
        tx: 10,
        ty: 5,
        portrait: 'feena',
        cloakColor: '#dc2626',
        hairColor: '#60a5fa',
        tunicColor: '#fef2f2',
        greeting: 'I am Reah, a poet resting here at Barbado Tavern. My precious Silver Harmonica was stolen near the Shrine of Solomon—please help me recover it!',
        followUpFlag: 'silver_harmonica',
        followUpGreeting: 'My Silver Harmonica! Listen to its gentle melody filling the tavern, Adol... May the Twin Goddesses watch over your climb up Darm Tower! (+250 Gold!)',
        grantFlag: 'reah_melody',
        rewardGold: 250,
      },
      {
        id: 'minea_tavern_server',
        name: 'SERVER MILLA',
        role: 'villager',
        secondary: true,
        task: 'serve',
        walkSpeed: 1.65,
        tx: 8,
        ty: 9,
        portrait: 'lilia',
        cloakColor: '#991b1b',
        hairColor: '#d97706',
        tunicColor: '#fef3c7',
        greeting: 'Hot spiced cider coming through! The sailors love listening to Reah’s poems while waiting for the stormwalls to clear.',
        waypoints: [
          { tx: 7, ty: 8, waitSec: 2.8, faceAngle: -Math.PI * 0.5, performTask: true, activityLabel: 'Pouring Cider' },
          { tx: 14, ty: 9, waitSec: 3.2, faceAngle: 0, performTask: true, activityLabel: 'Serving Tables' },
          { tx: 11, ty: 10, waitSec: 2.2, faceAngle: Math.PI * 0.5, performTask: false, activityLabel: 'Checking Guests' },
        ],
      },
    ],
    inspectables: [
      {
        id: 'tavern_rumor_board',
        tx: 5,
        ty: 4,
        kind: 'noticeboard',
        title: 'BARBADO SAILOR RUMORS',
        lines: [
          'BARTENDER NOTE: "A mysterious girl in blue named Feena was spotted near the Esteria Plains bridge!"',
          'SAILOR TIP: "Press [V] anytime outdoors to switch 45° camera views and [Q / E] to orbit around buildings!"',
        ],
        inspected: false,
      },
      {
        id: 'tavern_ale_casks',
        tx: 16,
        ty: 5,
        kind: 'crates',
        title: 'VINTAGE ESTERIAN CASK RACK',
        lines: [
          'Oak barrels stamped with the golden crest of Minea Harbor line the back wall.',
          'Behind a loose stave you spot a tucked sailor purse (+75 Gold)!',
        ],
        inspected: false,
        rewardGold: 75,
      },
    ],
  });

  const mineaLibraryRoom = createBuildingInteriorZone({
    id: 'minea_library',
    name: 'MINEA GREAT LIBRARY',
    subtitle: 'Floor-to-Ceiling Chronicles of Ancient Ys & Scholar Jeban',
    interiorKind: 'library',
    parentZoneId: 'minea',
    parentLabel: 'MINEA TOWN',
    exitDestTx: 32,
    exitDestTy: 16,
    npcs: [
      {
        id: 'minea_scholar',
        name: 'SCHOLAR JEBAN',
        role: 'villager',
        tx: 10,
        ty: 5,
        portrait: 'elder',
        cloakColor: '#4338ca',
        hairColor: '#e2e8f0',
        tunicColor: '#a5b4fc',
        greeting: 'Welcome to the Great Library of Minea! Read our ancient shelves to study the Six Priests of Ys, and search every rustling shrub in the countryside!',
      },
      {
        id: 'minea_archivist_teo',
        name: 'ARCHIVIST TEO',
        role: 'villager',
        secondary: true,
        task: 'read',
        walkSpeed: 1.15,
        tx: 7,
        ty: 8,
        portrait: 'merchant',
        cloakColor: '#3730a3',
        hairColor: '#475569',
        tunicColor: '#e0e7ff',
        greeting: 'Hmm... according to these ancient sea charts, the floating land of Ys once rested right above Esteria’s northern peak!',
        waypoints: [
          { tx: 7, ty: 8, waitSec: 4.5, faceAngle: -Math.PI * 0.5, performTask: true, activityLabel: 'Studying Scrolls' },
          { tx: 14, ty: 8, waitSec: 4.5, faceAngle: -Math.PI * 0.5, performTask: true, activityLabel: 'Cataloging Tomes' },
          { tx: 11, ty: 10, waitSec: 3.0, faceAngle: 0, performTask: true, activityLabel: 'Reading Chronicle' },
        ],
      },
    ],
    inspectables: [
      {
        id: 'lib_ys_chronicle',
        tx: 5,
        ty: 4,
        kind: 'bookshelf',
        title: 'CHRONICLES OF THE SIX PRIESTS',
        lines: [
          '"Seven hundred years ago, the Six Priests of Ys—Hadal, Tovah, Dabbie, Mesa, Gemma, and Fact—recorded the truth in six silver-bound tomes."',
          '"Gather their Books across Esteria Plains, the Shrine of Solomon, and Darm Tower!"',
        ],
        inspected: false,
      },
      {
        id: 'lib_map_table',
        tx: 16,
        ty: 6,
        kind: 'telescope',
        title: 'CARTOGRAPHER ASTROLABE',
        lines: [
          'A brass surveyor’s scope maps the winding Esteria River and the monumental Ancient Roda Tree to the north.',
          'Research stipend tucked beside the compass (+65 Gold)!',
        ],
        inspected: false,
        rewardGold: 65,
      },
    ],
  });

  const mineaHerbalistRoom = createBuildingInteriorZone({
    id: 'minea_herbalist',
    name: 'CELCETA HERBALIST',
    subtitle: 'Glowing Apothecary Vials, Dried Herbs & Remedies',
    interiorKind: 'clinic',
    parentZoneId: 'minea',
    parentLabel: 'MINEA TOWN',
    exitDestTx: 69,
    exitDestTy: 56,
    npcs: [
      {
        id: 'minea_herbalist_npc',
        name: 'APOTHECARY MIRA',
        role: 'inn',
        tx: 10,
        ty: 5,
        portrait: 'lilia',
        cloakColor: '#15803d',
        hairColor: '#fde047',
        tunicColor: '#bbf7d0',
        greeting: 'Welcome to my Apothecary! Every vial is brewed from Esterian wildflowers—rest here to mend your wounds or buy emergency Heal Herbs!',
      },
    ],
    inspectables: [
      {
        id: 'herb_potion_shelf',
        tx: 5,
        ty: 5,
        kind: 'bookshelf',
        title: 'BOTANICAL POTION CABINET',
        lines: [
          'Rows of emerald, sapphire, and amber flasks shimmer softly in the candlelight.',
          'You sample a fragrant Celceta tonic—your HP & MP surge to full!',
        ],
        inspected: false,
        healMp: true,
      },
      {
        id: 'herb_planter',
        tx: 16,
        ty: 5,
        kind: 'crates',
        title: 'DRIED HERB MORTAR & SPICES',
        lines: [
          'Fresh crushed Roda leaves fill the parlor with a crisp woodland scent.',
          'Note: Standing still anywhere in town or Esteria Plains rapidly regenerates your HP!',
        ],
        inspected: false,
      },
    ],
  });

  const mineaGuildRoom = createBuildingInteriorZone({
    id: 'minea_guild',
    name: 'ESTERIA ADVENTURER GUILD',
    subtitle: 'Bounty Ledgers, Exploration Charts & Guild Master',
    interiorKind: 'guild',
    parentZoneId: 'minea',
    parentLabel: 'MINEA TOWN',
    exitDestTx: 87,
    exitDestTy: 16,
    npcs: [
      {
        id: 'minea_guildmaster',
        name: 'GUILD MASTER VANE',
        role: 'villager',
        tx: 10,
        ty: 5,
        portrait: 'elder',
        cloakColor: '#1e40af',
        hairColor: '#cbd5e1',
        tunicColor: '#93c5fd',
        greeting: 'Hail, Adol! Check our Guild Bounty Board—defeat Jenocres in the Shrine of Solomon to shatter the seal on Darm Tower!',
      },
    ],
    inspectables: [
      {
        id: 'guild_charter_board',
        tx: 5,
        ty: 4,
        kind: 'noticeboard',
        title: 'ESTERIA EXPEDITION CHARTER',
        lines: [
          'RANK I: Speak with Sara inside her Parlor & recover her Sapphire Crystal.',
          'RANK II: Cross Esteria Plains, visit Elder Jeva inside Zepik Village, and clear the Shrine of Solomon!',
        ],
        inspected: false,
        rewardGold: 80,
      },
      {
        id: 'guild_bell',
        tx: 16,
        ty: 5,
        kind: 'bell',
        title: 'GUILD VICTORY BELL',
        lines: [
          'Rung whenever a brave adventurer returns from Darm Tower or the Shrine.',
          'Its clear bronze chime fills you with resolve! (HP & MP restored!)',
        ],
        inspected: false,
        healMp: true,
      },
    ],
    chests: [
      { id: 'guild_supply_chest', tx: 16, ty: 10, opened: false, rewardKind: 'herb', rewardName: 'Guild Heal Herb!' },
    ],
  });

  const minea: ZoneDef = {
    id: 'minea',
    name: 'MINEA TOWN & HARBOR',
    subtitle: 'Expansive Coastal Port · Enter Shops, Parlor & Guilds to Meet Citizens',
    theme: 'town',
    safeZone: true,
    canAutoHeal: true,
    width: mW,
    height: mH,
    tiles: mTiles,
    buildings: mineaBuildings,
    boats: [
      { id: 'minea_boat_west', tx: 12, ty: 70, facing: 'right', sailColor: '#fef9c3', hullColor: '#7c2d12' },
      { id: 'minea_boat_midw', tx: 36, ty: 71, facing: 'left', sailColor: '#e0f2fe', hullColor: '#92400e' },
      { id: 'minea_boat_mide', tx: 65, ty: 71, facing: 'right', sailColor: '#fef3c7', hullColor: '#78350f' },
      { id: 'minea_boat_east', tx: 90, ty: 70, facing: 'left', sailColor: '#fee2e2', hullColor: '#7c2d12' },
    ],
    portals: [
      {
        id: 'minea_to_plains',
        tx: 49,
        ty: 0,
        widthTiles: 6,
        heightTiles: 2,
        targetZone: 'plains',
        destTx: 57,
        destTy: 78,
        label: 'NORTH GATE → ESTERIA PLAINS',
        direction: 'north',
      },
      // Welcoming Enterable Building Doorways!
      { id: 'door_sara', tx: 14, ty: 14, widthTiles: 3, heightTiles: 1, targetZone: 'minea_sara', destTx: 10, destTy: 12, label: "ENTER · SARA'S PARLOR", direction: 'north', isDoorway: true },
      { id: 'door_lib', tx: 31, ty: 14, widthTiles: 3, heightTiles: 1, targetZone: 'minea_library', destTx: 10, destTy: 12, label: 'ENTER · GREAT LIBRARY', direction: 'north', isDoorway: true },
      { id: 'door_wep', tx: 69, ty: 14, widthTiles: 3, heightTiles: 1, targetZone: 'minea_weapons', destTx: 10, destTy: 12, label: "ENTER · PIM'S SMITHERY", direction: 'north', isDoorway: true },
      { id: 'door_guild', tx: 86, ty: 14, widthTiles: 3, heightTiles: 1, targetZone: 'minea_guild', destTx: 10, destTy: 12, label: 'ENTER · GUILDHALL', direction: 'north', isDoorway: true },
      { id: 'door_arm', tx: 14, ty: 32, widthTiles: 3, heightTiles: 1, targetZone: 'minea_armor', destTx: 10, destTy: 12, label: 'ENTER · ROYAL ARMORY', direction: 'north', isDoorway: true },
      { id: 'door_inn', tx: 87, ty: 32, widthTiles: 3, heightTiles: 1, targetZone: 'minea_inn', destTx: 10, destTy: 12, label: 'ENTER · HARBOR INN', direction: 'north', isDoorway: true },
      { id: 'door_tavern', tx: 32, ty: 54, widthTiles: 3, heightTiles: 1, targetZone: 'minea_tavern', destTx: 10, destTy: 12, label: 'ENTER · BARBADO TAVERN', direction: 'north', isDoorway: true },
      { id: 'door_herb', tx: 68, ty: 54, widthTiles: 3, heightTiles: 1, targetZone: 'minea_herbalist', destTx: 10, destTy: 12, label: 'ENTER · HERBALIST', direction: 'north', isDoorway: true },
    ],
    npcs: [
      {
        id: 'minea_guide',
        name: 'TOWN HERALD',
        role: 'villager',
        tx: 47,
        ty: 40,
        portrait: 'elder',
        cloakColor: '#1d4ed8',
        hairColor: '#e2e8f0',
        tunicColor: '#93c5fd',
        greeting: 'Welcome to Minea! Step right through the glowing doorways of Sara’s Parlor (NW), Pim’s Smithery (NE), the Armory, Inn & Tavern to meet everyone inside!',
      },
      {
        id: 'minea_sailor',
        name: 'SLAGH THE SAILOR',
        role: 'villager',
        tx: 51,
        ty: 69,
        portrait: 'elder',
        cloakColor: '#0f766e',
        hairColor: '#e2e8f0',
        tunicColor: '#38bdf8',
        greeting: 'Stormwalls surround Esteria! Check the cargo crates on the west pier—and visit Reah the Poet inside Barbado Tavern!',
      },
      // Living Secondary Citizens Performing Daily Tasks Across Minea Town & Harbor!
      {
        id: 'minea_water_mara',
        name: 'MARA · WATER CARRIER',
        role: 'villager',
        secondary: true,
        task: 'water_carry',
        walkSpeed: 1.5,
        tx: 49,
        ty: 40,
        portrait: 'lilia',
        cloakColor: '#0284c7',
        hairColor: '#92400e',
        tunicColor: '#e0f2fe',
        greeting: 'The Grand Fountain’s spring water is so crisp today! I’m hauling fresh buckets back to the Harbor Inn kitchen—watch the birds splash!',
        waypoints: [
          { tx: 49, ty: 40, waitSec: 4.6, faceAngle: -Math.PI * 0.25, performTask: true, activityLabel: 'Drawing Water' },
          { tx: 57, ty: 41, waitSec: 0.3, performTask: false, activityLabel: 'Carrying Bucket' },
          { tx: 63, ty: 38, waitSec: 0.3, performTask: false, activityLabel: 'Carrying Bucket' },
          { tx: 87, ty: 38, waitSec: 0.4, performTask: false, activityLabel: 'Carrying Bucket' },
          { tx: 88, ty: 34, waitSec: 3.2, faceAngle: -Math.PI * 0.5, performTask: true, activityLabel: 'Delivering Water' },
          { tx: 87, ty: 38, waitSec: 0.3, performTask: false, activityLabel: 'Returning to Plaza' },
          { tx: 63, ty: 38, waitSec: 0.3, performTask: false, activityLabel: 'Returning to Plaza' },
          { tx: 57, ty: 41, waitSec: 0.3, performTask: false, activityLabel: 'Returning to Plaza' },
        ],
      },
      {
        id: 'minea_sweeper_tomas',
        name: 'TOMAS · SWEEPER',
        role: 'villager',
        secondary: true,
        task: 'sweep',
        walkSpeed: 1.35,
        tx: 45,
        ty: 34,
        portrait: 'merchant',
        cloakColor: '#65a30d',
        hairColor: '#57534e',
        tunicColor: '#fef3c7',
        greeting: 'Sweep, sweep, sweep! Autumn petals drift down from those giant oaks all day, so somebody has to keep Minea’s cobblestones tidy!',
        waypoints: [
          { tx: 45, ty: 34, waitSec: 5.0, faceAngle: 0.4, performTask: true, activityLabel: 'Sweeping Plaza' },
          { tx: 46, ty: 42, waitSec: 4.8, faceAngle: -0.3, performTask: true, activityLabel: 'Sweeping Cobbles' },
          { tx: 58, ty: 42, waitSec: 5.0, faceAngle: Math.PI, performTask: true, activityLabel: 'Sweeping Square' },
          { tx: 58, ty: 34, waitSec: 4.6, faceAngle: Math.PI * 0.65, performTask: true, activityLabel: 'Tidying Steps' },
        ],
      },
      {
        id: 'minea_kid_pip',
        name: 'PIP · VILLAGE KID',
        role: 'villager',
        secondary: true,
        task: 'play',
        walkSpeed: 2.55,
        tx: 47,
        ty: 33,
        portrait: 'adol',
        cloakColor: '#f59e0b',
        hairColor: '#d97706',
        tunicColor: '#fef08a',
        greeting: 'Whoa, cool red hair, mister! Did you see the bluebirds drinking from the fountain? Bet I can run around the square faster than you!',
        waypoints: [
          { tx: 47, ty: 33, waitSec: 1.4, faceAngle: Math.PI * 0.25, performTask: true, activityLabel: 'Watching Birds' },
          { tx: 57, ty: 33, waitSec: 1.2, faceAngle: Math.PI * 0.75, performTask: true, activityLabel: 'Playing Tag' },
          { tx: 57, ty: 42, waitSec: 1.6, faceAngle: -Math.PI * 0.75, performTask: true, activityLabel: 'Chasing Petals' },
          { tx: 47, ty: 42, waitSec: 1.4, faceAngle: -Math.PI * 0.25, performTask: true, activityLabel: 'Skipping Around' },
        ],
      },
      {
        id: 'minea_guard_garr',
        name: 'WATCHMAN GARR',
        role: 'villager',
        secondary: true,
        task: 'patrol',
        walkSpeed: 1.45,
        tx: 51,
        ty: 24,
        portrait: 'merchant',
        cloakColor: '#1d4ed8',
        hairColor: '#334155',
        tunicColor: '#60a5fa',
        greeting: 'All quiet along the Upper Terrace, adventurer! Monsters have been creeping closer to the North Gate—keep your sword sharp!',
        waypoints: [
          { tx: 51, ty: 10, waitSec: 3.4, faceAngle: -Math.PI * 0.5, performTask: true, activityLabel: 'Guarding Gate' },
          { tx: 51, ty: 19, waitSec: 1.0, performTask: false, activityLabel: 'Patrolling Terrace' },
          { tx: 32, ty: 19, waitSec: 3.0, faceAngle: Math.PI * 0.5, performTask: true, activityLabel: 'Standing Watch' },
          { tx: 69, ty: 19, waitSec: 3.0, faceAngle: Math.PI * 0.5, performTask: true, activityLabel: 'Patrol Check' },
          { tx: 51, ty: 19, waitSec: 0.8, performTask: false, activityLabel: 'On Patrol' },
          { tx: 51, ty: 29, waitSec: 2.8, faceAngle: Math.PI * 0.5, performTask: true, activityLabel: 'Overlooking Plaza' },
        ],
      },
      {
        id: 'minea_guard_cora',
        name: 'HARBOR GUARD CORA',
        role: 'villager',
        secondary: true,
        task: 'patrol',
        walkSpeed: 1.5,
        tx: 51,
        ty: 59,
        portrait: 'feena',
        cloakColor: '#1e40af',
        hairColor: '#1e293b',
        tunicColor: '#93c5fd',
        greeting: 'Evening tide’s rolling in smooth! I patrol the Waterfront Quay from the cargo pier to the fishing docks.',
        waypoints: [
          { tx: 23, ty: 59, waitSec: 3.2, faceAngle: Math.PI * 0.5, performTask: true, activityLabel: 'Guarding West Pier' },
          { tx: 51, ty: 59, waitSec: 2.8, faceAngle: Math.PI * 0.5, performTask: true, activityLabel: 'Scanning Harbor' },
          { tx: 80, ty: 59, waitSec: 3.2, faceAngle: Math.PI * 0.5, performTask: true, activityLabel: 'Guarding East Dock' },
          { tx: 51, ty: 59, waitSec: 1.2, performTask: false, activityLabel: 'Quay Patrol' },
        ],
      },
      {
        id: 'minea_porter_bram',
        name: 'BRAM · DOCK PORTER',
        role: 'villager',
        secondary: true,
        task: 'carry_crate',
        walkSpeed: 1.28,
        tx: 22,
        ty: 68,
        portrait: 'merchant',
        cloakColor: '#92400e',
        hairColor: '#451a03',
        tunicColor: '#d97706',
        greeting: 'Oof—heavy Esterian spice crates! Hauling cargo straight off the west pier up to the central market stalls!',
        waypoints: [
          { tx: 22, ty: 69, waitSec: 3.4, faceAngle: Math.PI * 0.5, performTask: true, activityLabel: 'Loading Crates' },
          { tx: 22, ty: 59, waitSec: 0.4, performTask: false, activityLabel: 'Hauling Cargo' },
          { tx: 22, ty: 38, waitSec: 0.4, performTask: false, activityLabel: 'Hauling Cargo' },
          { tx: 43, ty: 38, waitSec: 3.8, faceAngle: 0, performTask: true, activityLabel: 'Stacking Wares' },
          { tx: 22, ty: 38, waitSec: 0.4, performTask: false, activityLabel: 'Heading to Dock' },
          { tx: 22, ty: 59, waitSec: 0.4, performTask: false, activityLabel: 'Heading to Dock' },
        ],
      },
      {
        id: 'minea_fisher_finn',
        name: 'OLD FINN · FISHER',
        role: 'villager',
        secondary: true,
        task: 'fish',
        walkSpeed: 1.1,
        tx: 80,
        ty: 71,
        portrait: 'elder',
        cloakColor: '#0f766e',
        hairColor: '#e2e8f0',
        tunicColor: '#5eead4',
        greeting: 'Shh! Easy now, lad—the silver harbor bass are biting right off the east pier! Nothing more peaceful than the sea breeze.',
        waypoints: [
          { tx: 80, ty: 71, waitSec: 8.5, faceAngle: Math.PI * 0.5, performTask: true, activityLabel: 'Fishing Harbor' },
          { tx: 81, ty: 68, waitSec: 6.5, faceAngle: 0, performTask: true, activityLabel: 'Casting Line' },
        ],
      },
      {
        id: 'minea_gardener_clara',
        name: 'CLARA · GARDENER',
        role: 'villager',
        secondary: true,
        task: 'garden',
        walkSpeed: 1.38,
        tx: 38,
        ty: 20,
        portrait: 'lilia',
        cloakColor: '#15803d',
        hairColor: '#b45309',
        tunicColor: '#bbf7d0',
        greeting: 'A little morning water keeps Minea’s wildflower beds glowing emerald bright! Have you tried rustling the blooming shrubs for hidden herbs?',
        waypoints: [
          { tx: 38, ty: 20, waitSec: 4.8, faceAngle: Math.PI * 0.5, performTask: true, activityLabel: 'Watering Blooms' },
          { tx: 51, ty: 20, waitSec: 0.5, performTask: false, activityLabel: 'Tending Gardens' },
          { tx: 65, ty: 20, waitSec: 4.8, faceAngle: Math.PI * 0.5, performTask: true, activityLabel: 'Watering Flowers' },
          { tx: 51, ty: 20, waitSec: 0.5, performTask: false, activityLabel: 'Tending Gardens' },
          { tx: 46, ty: 31, waitSec: 4.2, faceAngle: -Math.PI * 0.5, performTask: true, activityLabel: 'Trimming Borders' },
        ],
      },
      {
        id: 'minea_apprentice_kip',
        name: 'KIP · SMITH HAND',
        role: 'villager',
        secondary: true,
        task: 'hammer',
        walkSpeed: 1.4,
        tx: 70,
        ty: 17,
        portrait: 'merchant',
        cloakColor: '#9a3412',
        hairColor: '#451a03',
        tunicColor: '#fdba74',
        greeting: 'Step inside Pim’s Smithery right behind me if you need a sharper blade! I’m out here hammering iron wagon hoops.',
        waypoints: [
          { tx: 70, ty: 17, waitSec: 5.5, faceAngle: -Math.PI * 0.5, performTask: true, activityLabel: 'Forging Iron' },
          { tx: 75, ty: 19, waitSec: 2.8, faceAngle: Math.PI * 0.5, performTask: false, activityLabel: 'Cooling Steel' },
        ],
      },
      {
        id: 'minea_trader_oro',
        name: 'MERCHANT ORO',
        role: 'villager',
        secondary: true,
        task: 'stroll',
        walkSpeed: 1.32,
        tx: 33,
        ty: 37,
        portrait: 'merchant',
        cloakColor: '#7e22ce',
        hairColor: '#1e293b',
        tunicColor: '#e9d5ff',
        greeting: 'Fine silks, spices, and maps of Esteria! The central square is busier than ever—stop by the Royal Armory and Guildhall while you’re in town!',
        waypoints: [
          { tx: 29, ty: 37, waitSec: 3.4, faceAngle: -Math.PI * 0.5, performTask: true, activityLabel: 'Inspecting Goods' },
          { tx: 45, ty: 38, waitSec: 2.8, faceAngle: 0, performTask: true, activityLabel: 'Chatting at Plaza' },
          { tx: 48, ty: 42, waitSec: 0.4, performTask: false, activityLabel: 'Strolling Square' },
          { tx: 58, ty: 42, waitSec: 0.4, performTask: false, activityLabel: 'Strolling Square' },
          { tx: 63, ty: 37, waitSec: 3.4, faceAngle: -Math.PI * 0.5, performTask: true, activityLabel: 'Browsing Stalls' },
          { tx: 74, ty: 37, waitSec: 3.2, faceAngle: Math.PI, performTask: true, activityLabel: 'Checking Ledgers' },
          { tx: 63, ty: 37, waitSec: 0.4, performTask: false, activityLabel: 'Crossing Plaza' },
          { tx: 58, ty: 42, waitSec: 0.4, performTask: false, activityLabel: 'Crossing Plaza' },
          { tx: 48, ty: 42, waitSec: 0.4, performTask: false, activityLabel: 'Crossing Plaza' },
        ],
      },
      {
        id: 'minea_scribe_elen',
        name: 'SCRIBE ELEN',
        role: 'villager',
        secondary: true,
        task: 'read',
        walkSpeed: 1.2,
        tx: 32,
        ty: 17,
        portrait: 'sara',
        cloakColor: '#4338ca',
        hairColor: '#7c3aed',
        tunicColor: '#e0e7ff',
        greeting: 'Reading in the open sea breeze beats a dusty desk! Scholar Jeban inside the Great Library has fascinating tales of the Six Priests of Ys.',
        waypoints: [
          { tx: 32, ty: 17, waitSec: 4.2, faceAngle: Math.PI * 0.5, performTask: true, activityLabel: 'Reading Tome' },
          { tx: 51, ty: 19, waitSec: 0.6, performTask: false, activityLabel: 'Strolling with Book' },
          { tx: 51, ty: 32, waitSec: 5.0, faceAngle: Math.PI * 0.5, performTask: true, activityLabel: 'Sketching Fountain' },
          { tx: 51, ty: 19, waitSec: 0.6, performTask: false, activityLabel: 'Returning to Library' },
        ],
      },
      {
        id: 'minea_runner_nina',
        name: 'NINA · TAVERN RUNNER',
        role: 'villager',
        secondary: true,
        task: 'serve',
        walkSpeed: 1.62,
        tx: 33,
        ty: 57,
        portrait: 'lilia',
        cloakColor: '#be123c',
        hairColor: '#b45309',
        tunicColor: '#ffe4e6',
        greeting: 'Delivering warm mugs from Barbado Tavern straight down to the harbor watch! Don’t miss Reah singing inside!',
        waypoints: [
          { tx: 33, ty: 57, waitSec: 2.8, faceAngle: -Math.PI * 0.5, performTask: true, activityLabel: 'Picking Up Tray' },
          { tx: 33, ty: 59, waitSec: 0.4, performTask: false, activityLabel: 'Delivering Cider' },
          { tx: 52, ty: 59, waitSec: 0.4, performTask: false, activityLabel: 'Delivering Cider' },
          { tx: 52, ty: 67, waitSec: 3.6, faceAngle: Math.PI * 0.5, performTask: true, activityLabel: 'Serving Sailors' },
          { tx: 52, ty: 59, waitSec: 0.4, performTask: false, activityLabel: 'Heading to Tavern' },
          { tx: 33, ty: 59, waitSec: 0.4, performTask: false, activityLabel: 'Heading to Tavern' },
        ],
      },
      // Functional Bakery, Craftworks Mini-Factory, Community Game Tables & Pasture Herder Mini-Quests!
      {
        id: 'minea_baker_orin',
        name: 'MASTER BAKER ORIN',
        role: 'bakery',
        tx: 37,
        ty: 45,
        portrait: 'merchant',
        cloakColor: '#b45309',
        hairColor: '#78350f',
        tunicColor: '#fef3c7',
        greeting: 'Fresh honey loaves straight from Minea’s Hearth Oven! Say, Adol—if you find my missing sack of Golden Wheat Flour near the north fountain oak grove, I’ll pay 220 Gold & 600 Quest Points! Meanwhile, grab warm bread or tarts right here!',
        followUpFlag: 'golden_wheat_sack',
        followUpGreeting: 'My Golden Esteria Wheat Flour! Now the whole town can feast on honey loaves! Take 220 Gold & +600 Quest Points, and enjoy fresh pastries anytime!',
        grantFlag: 'bakery_flour_done',
        rewardGold: 220,
        rewardPoints: 600,
      },
      {
        id: 'minea_dice_kale',
        name: 'DICE MASTER KALE',
        role: 'quest',
        tx: 43,
        ty: 43,
        portrait: 'merchant',
        cloakColor: '#7c2d12',
        hairColor: '#1e293b',
        tunicColor: '#fde68a',
        greeting: 'Pull up a bench at our Community Game Table! Folks gather here for chess, dice & warm bread. Someone dropped our lucky Ivory Crown Die in the bushes down near the central waterfront quay—find it for 180 Gold & 500 Quest Points!',
        followUpFlag: 'dice_lucky_token',
        followUpGreeting: 'Ha! You found the Ivory Crown Die! The game table is roaring again! Here’s your 180 Gold winner’s purse and +500 Quest Points—spend it well at Pim’s Smithery!',
        grantFlag: 'dice_quest_done',
        rewardGold: 180,
        rewardPoints: 500,
      },
      {
        id: 'minea_foreman_brick',
        name: 'FOREMAN BRICK · CRAFTWORKS',
        role: 'quest',
        tx: 74,
        ty: 46,
        portrait: 'elder',
        cloakColor: '#334155',
        hairColor: '#64748b',
        tunicColor: '#f97316',
        greeting: 'Welcome to Minea’s Loom & Timber Craftworks! We mill planks, weave sails & forge crate iron for the whole harbor—except a Brass Drive Cog bounced off our wheel! Inspect the harbor cargo crates by the west pier or the craftworks yard to find it for 260 Gold & 700 Quest Points!',
        followUpFlag: 'missing_brass_cog',
        followUpGreeting: 'By the Goddesses, that’s the exact Brass Drive Cog! Hear our trip-hammer and looms humming again! Take 260 Gold & +700 Quest Points for saving production!',
        grantFlag: 'factory_cog_done',
        rewardGold: 260,
        rewardPoints: 700,
      },
      {
        id: 'minea_herder_toby',
        name: 'HERDER TOBY · PASTURES',
        role: 'quest',
        tx: 25,
        ty: 23,
        portrait: 'merchant',
        cloakColor: '#15803d',
        hairColor: '#b45309',
        tunicColor: '#dcfce7',
        greeting: 'Easy there, chestnuts! Our horses, sheep & dairy cows love Minea’s lush grazing pastures. One playful pony kicked my Silver Calf Bell into the berry bush behind the mid-west oak grove—bring it back for 190 Gold & 550 Quest Points!',
        followUpFlag: 'silver_calf_bell',
        followUpGreeting: 'There’s my Silver Calf Bell! The herd settles right down when it chimes! Take 190 Gold & +550 Quest Points—you’ve got a sharp eye, Adol!',
        grantFlag: 'pasture_bell_done',
        rewardGold: 190,
        rewardPoints: 550,
      },
      {
        id: 'minea_baker_helper',
        name: 'LINA · PASTRY RUNNER',
        role: 'villager',
        secondary: true,
        task: 'baker',
        walkSpeed: 1.55,
        tx: 39,
        ty: 45,
        portrait: 'lilia',
        cloakColor: '#d97706',
        hairColor: '#92400e',
        tunicColor: '#fffbeb',
        greeting: 'Hot loaves from Master Orin’s brick oven straight to the community picnic tables! Smells like honey and toasted barley!',
        waypoints: [
          { tx: 38, ty: 45, waitSec: 3.2, faceAngle: Math.PI, performTask: true, activityLabel: 'Packing Warm Loaves' },
          { tx: 43, ty: 44, waitSec: 3.8, faceAngle: -Math.PI * 0.5, performTask: true, activityLabel: 'Serving Bread' },
          { tx: 60, ty: 44, waitSec: 3.8, faceAngle: -Math.PI * 0.5, performTask: true, activityLabel: 'Serving Diners' },
          { tx: 48, ty: 45, waitSec: 0.4, performTask: false, activityLabel: 'Returning to Bakery' },
        ],
      },
      {
        id: 'minea_craft_worker',
        name: 'MILLWRIGHT ODO',
        role: 'villager',
        secondary: true,
        task: 'craft',
        walkSpeed: 1.38,
        tx: 76,
        ty: 47,
        portrait: 'merchant',
        cloakColor: '#475569',
        hairColor: '#334155',
        tunicColor: '#fdba74',
        greeting: 'Timber planks, woven cloth bolts, and banded crates—everything Minea’s merchants sell starts right here at our craftworks!',
        waypoints: [
          { tx: 76, ty: 47, waitSec: 4.5, faceAngle: 0, performTask: true, activityLabel: 'Operating Press' },
          { tx: 79, ty: 50, waitSec: 3.2, faceAngle: Math.PI * 0.5, performTask: true, activityLabel: 'Stacking Goods' },
          { tx: 79, ty: 38, waitSec: 2.8, faceAngle: Math.PI, performTask: true, activityLabel: 'Delivering Wares' },
          { tx: 79, ty: 47, waitSec: 0.4, performTask: false, activityLabel: 'Back to Workshop' },
        ],
      },
      // Playful Village Children (compact child height contrasting with 2x tall detailed adults!)
      {
        id: 'minea_child_pip',
        name: 'PIP · BUTTERFLY CHASER',
        role: 'villager',
        secondary: true,
        ageGroup: 'child',
        task: 'play',
        walkSpeed: 1.95,
        tx: 46,
        ty: 31,
        portrait: 'lilia',
        cloakColor: '#38bdf8',
        hairColor: '#f59e0b',
        tunicColor: '#fef08a',
        greeting: 'Look, look! Yellow butterflies love the clover meadow! Grown-ups are so tall they walk right past all the wild berries and mushrooms down here!',
        waypoints: [
          { tx: 46, ty: 31, waitSec: 1.8, performTask: true, activityLabel: 'Chasing Butterflies' },
          { tx: 57, ty: 31, waitSec: 2.0, performTask: true, activityLabel: 'Skipping by Fountain' },
          { tx: 58, ty: 40, waitSec: 1.6, performTask: true, activityLabel: 'Spotting Koi Fish' },
          { tx: 46, ty: 40, waitSec: 1.8, performTask: true, activityLabel: 'Picking Daisies' },
        ],
      },
      {
        id: 'minea_child_mina',
        name: 'MINA · BAKER’S LITTLE HELPER',
        role: 'villager',
        secondary: true,
        ageGroup: 'child',
        task: 'play',
        walkSpeed: 1.75,
        tx: 41,
        ty: 46,
        portrait: 'feena',
        cloakColor: '#f43f5e',
        hairColor: '#7c2d12',
        tunicColor: '#ffe4e6',
        greeting: 'Master Orin lets me ring the bread bell when honey tarts finish baking! You can cook your own berry stew at the Hearth Kettle too!',
        waypoints: [
          { tx: 41, ty: 46, waitSec: 2.4, performTask: true, activityLabel: 'Smelling Fresh Bread' },
          { tx: 51, ty: 46, waitSec: 2.0, performTask: true, activityLabel: 'Skipping Along Square' },
          { tx: 44, ty: 49, waitSec: 2.2, performTask: true, activityLabel: 'Watching Board Games' },
        ],
      },
      {
        id: 'minea_child_ella',
        name: 'ELLA · PASTURE KID',
        role: 'villager',
        secondary: true,
        ageGroup: 'child',
        task: 'play',
        walkSpeed: 1.82,
        tx: 29,
        ty: 25,
        portrait: 'lilia',
        cloakColor: '#22c55e',
        hairColor: '#d97706',
        tunicColor: '#dcfce7',
        greeting: 'Hi Mr. Swordsman! My big brother Toby lets me feed orchard apples to the brown horse! Look for red apple saplings near the grass!',
        waypoints: [
          { tx: 29, ty: 25, waitSec: 2.5, performTask: true, activityLabel: 'Waving at Horses' },
          { tx: 34, ty: 29, waitSec: 2.0, performTask: true, activityLabel: 'Picking Clovers' },
          { tx: 25, ty: 29, waitSec: 2.2, performTask: true, activityLabel: 'Counting Sheep' },
        ],
      },
    ],
    chests: [
      { id: 'minea_starter', tx: 6, ty: 11, opened: false, rewardKind: 'gold', rewardName: '150 Gold', amount: 150 },
      { id: 'minea_alley_herb', tx: 95, ty: 12, opened: false, rewardKind: 'herb', rewardName: 'Heal Herb' },
      { id: 'minea_pier_gold', tx: 80, ty: 71, opened: false, rewardKind: 'gold', rewardName: '180 Gold', amount: 180 },
      { id: 'minea_park_gold', tx: 6, ty: 61, opened: false, rewardKind: 'gold', rewardName: '125 Gold', amount: 125 },
      // Extra hidden treasures tucked behind trees, cottages, pastures & craftworks!
      { id: 'minea_hidden_orchard', tx: 25, ty: 10, opened: false, rewardKind: 'gold', rewardName: '210 Gold · Orchard Stash', amount: 210 },
      { id: 'minea_hidden_bakery', tx: 34, ty: 46, opened: false, rewardKind: 'gold', rewardName: '140 Gold · Baker Cache', amount: 140 },
      { id: 'minea_hidden_factory', tx: 83, ty: 45, opened: false, rewardKind: 'gold', rewardName: '230 Gold · Guild Paychest', amount: 230 },
      { id: 'minea_hidden_pasture', tx: 71, ty: 22, opened: false, rewardKind: 'herb', rewardName: 'Pasture Elixir Herb' },
      { id: 'minea_hidden_harbor_nw', tx: 14, ty: 62, opened: false, rewardKind: 'gold', rewardName: '165 Gold · Smuggler Chest', amount: 165 },
    ],
    shrubs: mineaShrubs,
    inspectables: [
      {
        id: 'minea_fountain',
        tx: 52,
        ty: 37,
        kind: 'fountain',
        title: 'GRAND FOUNTAIN OF MINEA',
        lines: [
          'Crystal-clear spring water sparkles at the heart of Minea’s grand terraced square.',
          'You toss a small wish into the basin—your spirit feels refreshed! (MP & HP restored!)',
        ],
        inspected: false,
        healMp: true,
      },
      {
        id: 'minea_sign_north',
        tx: 47,
        ty: 5,
        kind: 'sign',
        title: 'NORTH GATE SIGNPOST',
        lines: [
          'NORTH: Vast Esteria Plains, Zepik Village Outpost, & The Ancient Roda Tree.',
          'NORTHWEST: Shrine of Solomon · NORTHEAST: Darm Tower.',
        ],
        inspected: false,
      },
      {
        id: 'minea_pier_crates',
        tx: 22,
        ty: 70,
        kind: 'crates',
        title: 'SHIPWRECK CARGO CRATES',
        lines: [
          'You pry open the salt-crusted merchant crates from your wrecked ship...',
          'Inside you salvage 120 Gold coins & a gleaming Missing Brass Drive Cog for Foreman Brick’s Craftworks!',
        ],
        inspected: false,
        grantFlag: 'missing_brass_cog',
        rewardGold: 120,
        rewardPoints: 250,
      },
      {
        id: 'minea_well',
        tx: 61,
        ty: 56,
        kind: 'well',
        title: 'OLD TOWN WELL',
        lines: [
          'Echoes rise from the deep limestone shaft... a silver coin pouch glints on the inner stone ledge!',
          'Carved on the rim: "Only Silver steel forged of Cleria can pierce Dark Fact’s shadow." (+90 Gold!)',
        ],
        inspected: false,
        rewardGold: 90,
        rewardPoints: 200,
      },
      {
        id: 'minea_tavern_board',
        tx: 40,
        ty: 55,
        kind: 'noticeboard',
        title: 'BARBADO TAVERN NOTICEBOARD',
        lines: [
          'INSIDE: Reah the Poet is seeking help recovering her stolen Silver Harmonica!',
          'TOWN BOUNTIES: Help Baker Orin (Golden Flour), Dice Master Kale (Crown Die), Foreman Brick (Brass Cog) & Herder Toby (Calf Bell) for big Gold & Points!',
        ],
        inspected: false,
      },
      {
        id: 'minea_forge_anvil',
        tx: 77,
        ty: 15,
        kind: 'anvil',
        title: "PIM'S OUTDOOR FORGE ANVIL",
        lines: [
          'A heavy iron anvil warmed by glowing charcoal embers outside Pim’s Weapon Smithery.',
          'Step through Pim’s doorway to browse Masterwork Blades & Forged Steel!',
        ],
        inspected: false,
      },
      {
        id: 'minea_library_lectern',
        tx: 26,
        ty: 15,
        kind: 'bookshelf',
        title: 'OUTDOOR ARCHIVE LECTERN',
        lines: [
          'An open chronicle of Ancient Ys welcomes visitors outside the Minea Great Library.',
          'Step inside to speak with Scholar Jeban and read the full Chronicles! (+45 Gold bookmark!)',
        ],
        inspected: false,
        rewardGold: 45,
      },
      {
        id: 'minea_harbor_spyglass',
        tx: 52,
        ty: 72,
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
        tx: 47,
        ty: 62,
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
        tx: 79,
        ty: 69,
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
        tx: 43,
        ty: 33,
        kind: 'noticeboard',
        title: 'MINEA TOWN DIRECTORY',
        lines: [
          'UPPER TERRACE: Sara’s Fortune Parlor · Great Library · Pim’s Smithery · Guildhall · Grazing Pastures.',
          'SOUTH COURTYARD: Community Game Tables · Hearth Bakery · Loom & Timber Craftworks · Harbor Piers!',
        ],
        inspected: false,
      },
      {
        id: 'minea_goddess_shrine',
        tx: 60,
        ty: 33,
        kind: 'statue',
        title: 'TWIN GODDESS MEMORIAL',
        lines: [
          'A finely carved marble monument honoring Feena and Reah overlooking Minea’s Grand Plaza.',
          'Fresh wildflowers sit at its plinth, placed by Minea’s townsfolk each sunrise.',
        ],
        inspected: false,
      },
      // Interactive Community Game Table, Bakery Ledger & Craftworks Inspection Clues!
      {
        id: 'minea_chess_table_clue',
        tx: 45,
        ty: 44,
        kind: 'tablet',
        title: 'COMMUNITY CHESS & DICE TABLE',
        lines: [
          'Townsfolk cheer over carved wooden knights, painted dice, and steaming mugs of cider!',
          'You spot a clever winning knight-fork on the board—the delighted players toss you a 95 Gold prize & +300 Quest Points!',
        ],
        inspected: false,
        rewardGold: 95,
        rewardPoints: 300,
      },
      {
        id: 'minea_bakery_oven_clue',
        tx: 36,
        ty: 46,
        kind: 'campfire',
        title: 'MINEA HEARTH BREAD OVEN',
        lines: [
          'Golden sourdough loaves and honey berry tarts bake inside the roaring brick dome.',
          'CLUE: Baker Orin’s lost Golden Wheat Flour fell by the blossom shrub northeast of the Plaza oaks! (+300 Points & warm aroma restores HP!)',
        ],
        inspected: false,
        rewardPoints: 300,
        healMp: true,
      },
      {
        id: 'minea_factory_ledger',
        tx: 75,
        ty: 45,
        kind: 'bookshelf',
        title: 'CRAFTWORKS PRODUCTION LEDGER',
        lines: [
          'DAILY OUTPUT: 40 Pine Planks, 18 Sailcloth Bolts, 24 Iron Hoops — shipped straight to Minea’s Armory & Harbor Piers.',
          'LOG NOTE: "Replacement Brass Drive Cog shipped on the wrecked west pier vessel—check the crates!" (+80 Gold finder’s advance & +250 Points!)',
        ],
        inspected: false,
        rewardGold: 80,
        rewardPoints: 250,
      },
      {
        id: 'minea_pasture_sign',
        tx: 27,
        ty: 22,
        kind: 'sign',
        title: 'ESTERIA GRAZING PASTURE POST',
        lines: [
          'Fresh clover meadows nourish Minea’s carriage horses, wool sheep, and dairy cows.',
          'TIP: Herder Toby’s Silver Calf Bell jingled near the west oak grove berry bush at the edge of town!',
        ],
        inspected: false,
      },
    ],
    enemySpawns: [],
  };

  // --------------------------------------------------------------------------
  // 2. ESTERIA PLAINS & ZEPIK OUTSKIRTS (116x84 — Sprawling ~4x Exploration Overworld!)
  // --------------------------------------------------------------------------
  const pW = 116;
  const pH = 84;
  const pTiles = makeGrid(pW, pH, 0);
  // Thick natural transitional woodland borders surrounding Esteria Plains
  naturalForestBorder(pTiles);

  // Sweeping Wildflower Meadows
  fillRect(pTiles, 6, 50, 40, 26, 8);
  fillRect(pTiles, 70, 50, 38, 26, 8);
  fillRect(pTiles, 38, 16, 40, 20, 8);

  // Winding Sapphire River across Esteria (y = 40..44) + 3 Grand Timber Bridges!
  fillRect(pTiles, 0, 40, pW, 4, 3);
  fillRect(pTiles, 20, 40, 5, 4, 4); // West Bridge -> Shrine Highway
  fillRect(pTiles, 55, 40, 6, 4, 4); // Central Bridge -> Ancient Roda Sanctuary
  fillRect(pTiles, 91, 40, 5, 4, 4); // East Bridge -> Darm Tower Highway

  // Scenic Interconnected Road Network
  fillRect(pTiles, 55, 44, 6, 40, 6); // South Royal Road from Minea Town
  fillRect(pTiles, 21, 47, 74, 3, 6); // Southern Cross-Road
  fillRect(pTiles, 21, 0, 4, 40, 6);  // NW Shrine of Solomon Highway
  fillRect(pTiles, 92, 0, 4, 40, 6);  // NE Darm Tower Highway
  fillRect(pTiles, 23, 27, 71, 3, 6); // Northern Highland Trail
  fillRect(pTiles, 55, 19, 6, 21, 6); // Sanctuary Road to Ancient Roda Tree

  // Larger Enterable Zepik Village Outpost (SE Clearing with Distinct 2-Story House & Conservatory!)
  const plainsBuildings: WorldBuilding[] = [];
  placeCottage(pTiles, 76, 56, 11, 6, plainsBuildings, { id: 'z_elder', name: "JEVA'S ELDER HOUSE", signKind: 'elder', roofStyle: 'terracotta', archStyle: 'two_story_timber', hasChimney: true });
  placeCottage(pTiles, 93, 56, 11, 6, plainsBuildings, { id: 'z_watch', name: 'ZEPIK HERBAL OUTPOST', signKind: 'clinic', roofStyle: 'emerald', archStyle: 'apothecary_conservatory', hasChimney: true });
  fillRect(pTiles, 72, 64, 34, 3, 6);
  fillRect(pTiles, 80, 62, 3, 3, 6);
  fillRect(pTiles, 97, 62, 3, 3, 6);

  // Ancient Roda Tree Sanctuary (Monumental landmark at center-north!)
  setTile(pTiles, 57, 15, 9);
  setTile(pTiles, 58, 15, 9);
  setTile(pTiles, 52, 17, 7);
  setTile(pTiles, 63, 17, 7);

  // Open Gateways through transitional forest borders (South -> Minea, NW -> Shrine, NE -> Darm Tower)
  fillRect(pTiles, 55, pH - 5, 6, 5, 6);
  fillRect(pTiles, 21, 0, 4, 5, 6);
  fillRect(pTiles, 92, 0, 4, 5, 6);
  setTile(pTiles, 20, 4, 7);
  setTile(pTiles, 25, 4, 7);
  setTile(pTiles, 91, 4, 7);
  setTile(pTiles, 96, 4, 7);

  // Vast Multi-Tile Ancient Forest Groves (4x4, 4x2, 3x3, 3x2, 2x2) across Esteria Plains!
  placeTreeBlock(pTiles, 5, 5, 4, 4);
  placeTreeBlock(pTiles, 12, 8, 4, 4);
  placeTreeBlock(pTiles, 28, 6, 4, 3);
  placeTreeBlock(pTiles, 38, 7, 4, 4);
  placeTreeBlock(pTiles, 46, 6, 4, 3);
  placeTreeBlock(pTiles, 66, 6, 4, 4);
  placeTreeBlock(pTiles, 76, 8, 4, 3);
  placeTreeBlock(pTiles, 83, 6, 4, 4);
  placeTreeBlock(pTiles, 100, 6, 4, 4);
  placeTreeBlock(pTiles, 105, 14, 4, 4);
  placeTreeBlock(pTiles, 5, 18, 4, 4);
  placeTreeBlock(pTiles, 12, 21, 4, 3);
  placeTreeBlock(pTiles, 30, 18, 4, 3);
  placeTreeBlock(pTiles, 43, 32, 4, 3);
  placeTreeBlock(pTiles, 68, 32, 4, 3);
  placeTreeBlock(pTiles, 79, 18, 4, 3);
  placeTreeBlock(pTiles, 103, 28, 4, 4);
  placeTreeBlock(pTiles, 6, 30, 4, 4);
  placeTreeBlock(pTiles, 6, 50, 4, 4);
  placeTreeBlock(pTiles, 16, 56, 4, 4);
  placeTreeBlock(pTiles, 30, 52, 4, 3);
  placeTreeBlock(pTiles, 42, 62, 4, 4);
  placeTreeBlock(pTiles, 8, 68, 4, 4);
  placeTreeBlock(pTiles, 18, 70, 4, 4);
  placeTreeBlock(pTiles, 30, 71, 4, 3);
  placeTreeBlock(pTiles, 44, 72, 4, 4);
  placeTreeBlock(pTiles, 65, 51, 4, 3);
  placeTreeBlock(pTiles, 65, 69, 4, 4);
  placeTreeBlock(pTiles, 82, 71, 4, 4);
  placeTreeBlock(pTiles, 94, 70, 4, 4);
  placeTreeBlock(pTiles, 104, 68, 4, 4);
  placeTreeBlock(pTiles, 106, 52, 4, 4);
  for (const [tx, ty] of [
    [15, 32], [28, 34], [48, 22], [67, 22], [87, 34], [99, 25],
    [26, 54], [49, 54], [72, 58], [108, 56], [48, 74], [65, 62],
  ]) {
    setTile(pTiles, tx, ty, 2);
  }

  const plainsShrubs = scatterShrubs(
    'plains',
    pTiles,
    [
      { tx: 49, ty: 70, variant: 'berry', hiddenKind: 'gold', hiddenAmount: 55 },
      { tx: 42, ty: 60, variant: 'fern', hiddenKind: 'herb' },
      { tx: 28, ty: 58, variant: 'blossom', hiddenKind: 'clue', clueText: 'Beneath the petals lies a stone carving: "Cross the West Bridge to find the Shrine of Solomon."' },
      { tx: 14, ty: 64, variant: 'berry', hiddenKind: 'slime' },
      { tx: 24, ty: 74, variant: 'fern', hiddenKind: 'gold', hiddenAmount: 75 },
      { tx: 38, ty: 51, variant: 'blossom' },
      { tx: 65, ty: 57, variant: 'berry', hiddenKind: 'seed', rewardName: 'Roda Seed (+10 Max HP!)' },
      { tx: 76, ty: 73, variant: 'blossom', hiddenKind: 'gold', hiddenAmount: 70 },
      { tx: 96, ty: 71, variant: 'berry', hiddenKind: 'herb' },
      { tx: 12, ty: 35, variant: 'fern', hiddenKind: 'gold', hiddenAmount: 85 },
      { tx: 31, ty: 35, variant: 'berry', hiddenKind: 'slime' },
      { tx: 46, ty: 30, variant: 'blossom' },
      { tx: 68, ty: 30, variant: 'blossom', hiddenKind: 'gold', hiddenAmount: 80 },
      { tx: 83, ty: 35, variant: 'fern' },
      { tx: 101, ty: 35, variant: 'berry', hiddenKind: 'herb' },
      { tx: 52, ty: 20, variant: 'blossom', hiddenKind: 'clue', clueText: 'Roda Leaves shimmer: "Speak to the Ancient Roda Tree altar to awaken your inner vitality!"' },
      { tx: 63, ty: 20, variant: 'blossom' },
      { tx: 36, ty: 15, variant: 'fern', hiddenKind: 'gold', hiddenAmount: 95 },
      { tx: 75, ty: 17, variant: 'berry', hiddenKind: 'slime' },
      { tx: 11, ty: 18, variant: 'fern' },
      { tx: 102, ty: 23, variant: 'berry', hiddenKind: 'gold', hiddenAmount: 90 },
      { tx: 35, ty: 75, variant: 'blossom' },
      { tx: 63, ty: 76, variant: 'fern' },
      { tx: 88, ty: 52, variant: 'blossom' },
      { tx: 106, ty: 52, variant: 'berry', hiddenKind: 'herb' },
      { tx: 48, ty: 10, variant: 'fern', hiddenKind: 'seed', rewardName: 'Roda Seed (+10 Max HP!)' },
    ],
    'berry'
  );

  // Enterable Zepik Village Interior Rooms!
  const zepikElderRoom = createBuildingInteriorZone({
    id: 'zepik_elder_house',
    name: "JEVA'S ELDER HOUSE",
    subtitle: 'Zepik Village Council Room · Speak with Elder Jeva',
    interiorKind: 'elder',
    parentZoneId: 'plains',
    parentLabel: 'ESTERIA PLAINS',
    exitDestTx: 81,
    exitDestTy: 65,
    npcs: [
      {
        id: 'zepik_elder',
        name: 'ELDER JEVA',
        role: 'villager',
        tx: 10,
        ty: 5,
        portrait: 'elder',
        cloakColor: '#7c2d12',
        hairColor: '#e2e8f0',
        tunicColor: '#fbbf24',
        greeting: 'Welcome inside Zepik Elder House! Bandits hid our Silver Bell in a far-west forest chest—and seek the Ancient Roda Tree across the central bridge!',
      },
    ],
    inspectables: [
      {
        id: 'zepik_elder_hearth',
        tx: 10,
        ty: 3,
        kind: 'campfire',
        title: "JEVA'S WARM HEARTH",
        lines: [
          'A quiet timber hearth warms the frontier sanctuary.',
          'Resting briefly by the embers restores your vigor! (HP & MP restored!)',
        ],
        inspected: false,
        healMp: true,
      },
      {
        id: 'zepik_elder_books',
        tx: 16,
        ty: 5,
        kind: 'bookshelf',
        title: 'ZEPIK FRONTIER ARCHIVES',
        lines: [
          'Records of the Shrine of Solomon reveal that Priest Tovah’s statue conceals an ancient gold cache.',
          'You find 75 Gold sealed in an expedition pouch!',
        ],
        inspected: false,
        rewardGold: 75,
      },
    ],
  });

  const zepikOutpostRoom = createBuildingInteriorZone({
    id: 'zepik_outpost_room',
    name: 'ZEPIK HERBAL OUTPOST',
    subtitle: 'Frontier Apothecary & Rest Stop · Stock Herbs & Heal',
    interiorKind: 'clinic',
    parentZoneId: 'plains',
    parentLabel: 'ESTERIA PLAINS',
    exitDestTx: 98,
    exitDestTy: 65,
    npcs: [
      {
        id: 'zepik_healer',
        name: 'ZEPIK HERBALIST',
        role: 'inn',
        tx: 10,
        ty: 5,
        portrait: 'lilia',
        cloakColor: '#15803d',
        hairColor: '#fde047',
        tunicColor: '#bbf7d0',
        greeting: 'Need rest on the frontier? Rest cleanly here or stock up on Heal Herbs before braving the Shrine of Solomon or Darm Tower!',
      },
    ],
    inspectables: [
      {
        id: 'zepik_apothecary',
        tx: 5,
        ty: 5,
        kind: 'bookshelf',
        title: 'FRONTIER REMEDY SHELF',
        lines: [
          'Fresh medicinal roots gathered from the Esteria riverbanks line the wooden rack.',
          'A soothing tea restores your HP & MP completely!',
        ],
        inspected: false,
        healMp: true,
      },
    ],
  });

  const plains: ZoneDef = {
    id: 'plains',
    name: 'ESTERIA PLAINS & ZEPIK',
    subtitle: 'Vast 4x Overworld · Auto-Heal Standing Still · Enter Zepik Cottages & Explore',
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
        tx: 55,
        ty: pH - 2,
        widthTiles: 6,
        heightTiles: 2,
        targetZone: 'minea',
        destTx: 52,
        destTy: 5,
        label: 'SOUTH → MINEA TOWN',
        direction: 'south',
      },
      {
        id: 'plains_to_shrine',
        tx: 21,
        ty: 0,
        widthTiles: 4,
        heightTiles: 2,
        targetZone: 'shrine',
        destTx: 28,
        destTy: 37,
        label: 'SHRINE OF SOLOMON',
        direction: 'north',
      },
      {
        id: 'plains_to_tower',
        tx: 92,
        ty: 0,
        widthTiles: 4,
        heightTiles: 2,
        targetZone: 'tower',
        destTx: 28,
        destTy: 37,
        label: 'DARM TOWER',
        direction: 'north',
        requiredFlag: 'shrine_boss',
        lockedMessage: 'A crimson barrier seals Darm Tower! Defeat Jenocres in the Shrine of Solomon (Northwest) to break it!',
      },
      { id: 'door_zepik_elder', tx: 80, ty: 62, widthTiles: 3, heightTiles: 1, targetZone: 'zepik_elder_house', destTx: 10, destTy: 12, label: "ENTER · JEVA'S HOUSE", direction: 'north', isDoorway: true },
      { id: 'door_zepik_outpost', tx: 97, ty: 62, widthTiles: 3, heightTiles: 1, targetZone: 'zepik_outpost_room', destTx: 10, destTy: 12, label: 'ENTER · ZEPIK OUTPOST', direction: 'north', isDoorway: true },
    ],
    npcs: [
      {
        id: 'plains_feena',
        name: 'FEENA',
        role: 'quest',
        tx: 62,
        ty: 68,
        portrait: 'feena',
        cloakColor: '#3b82f6',
        hairColor: '#93c5fd',
        tunicColor: '#dbeafe',
        greeting: 'Adol! Please investigate the Ancient Roda Tree across the central bridge, visit Elder Jeva inside Zepik Village, and explore the Shrine of Solomon to the northwest!',
        followUpFlag: 'shrine_boss',
        followUpGreeting: 'You vanquished Jenocres and opened Darm Tower! Seek the Silver Sword inside before facing Dark Fact!',
      },
      {
        id: 'zepik_scout_rex',
        name: 'ZEPIK SCOUT REX',
        role: 'villager',
        secondary: true,
        task: 'patrol',
        walkSpeed: 1.55,
        tx: 76,
        ty: 65,
        portrait: 'merchant',
        cloakColor: '#166534',
        hairColor: '#451a03',
        tunicColor: '#86efac',
        greeting: 'I keep the wild slimes away from Zepik Outpost! Step inside Elder Jeva’s House or the Herbal Outpost right behind me to rest up.',
        waypoints: [
          { tx: 74, ty: 65, waitSec: 3.2, faceAngle: Math.PI, performTask: true, activityLabel: 'Scouting Plains' },
          { tx: 88, ty: 65, waitSec: 2.4, faceAngle: Math.PI * 0.5, performTask: true, activityLabel: 'Watching Trail' },
          { tx: 102, ty: 65, waitSec: 3.2, faceAngle: 0, performTask: true, activityLabel: 'Guarding Outpost' },
        ],
      },
      {
        id: 'zepik_herb_mira',
        name: 'HERBALIST MIRA',
        role: 'villager',
        secondary: true,
        task: 'garden',
        walkSpeed: 1.32,
        tx: 98,
        ty: 64,
        portrait: 'lilia',
        cloakColor: '#047857',
        hairColor: '#92400e',
        tunicColor: '#d1fae5',
        greeting: 'Gathering fresh Celceta dew-leaves outside the Zepik Herbal Outpost! The river breeze makes the meadow herbs extra potent.',
        waypoints: [
          { tx: 98, ty: 64, waitSec: 4.5, faceAngle: -Math.PI * 0.5, performTask: true, activityLabel: 'Watering Herbs' },
          { tx: 81, ty: 64, waitSec: 4.5, faceAngle: -Math.PI * 0.5, performTask: true, activityLabel: 'Tending Planters' },
        ],
      },
    ],
    chests: [
      { id: 'plains_book1', tx: 72, ty: 15, opened: false, rewardKind: 'book', rewardName: 'Book of Hadal (1/6)' },
      { id: 'plains_herb', tx: 108, ty: 49, opened: false, rewardKind: 'herb', rewardName: 'Heal Herb' },
      { id: 'plains_west_gold', tx: 8, ty: 70, opened: false, rewardKind: 'gold', rewardName: '240 Gold (Silver Bell Bounty!)', amount: 240 },
      { id: 'plains_nw_gold', tx: 8, ty: 16, opened: false, rewardKind: 'gold', rewardName: '200 Gold', amount: 200 },
    ],
    shrubs: plainsShrubs,
    inspectables: [
      {
        id: 'plains_sign_cross',
        tx: 53,
        ty: 49,
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
        tx: 57,
        ty: 18,
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
        tx: 74,
        ty: 68,
        kind: 'campfire',
        title: 'ZEPIK WATCHFIRE',
        lines: [
          'Warm embers crackle beside traveler packs outside Zepik Village.',
          'A journal reads: "Stand still anywhere in Esteria Plains to rapidly recover HP!"',
        ],
        inspected: false,
        healMp: true,
      },
      {
        id: 'plains_ruin_statue',
        tx: 104,
        ty: 14,
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
        tx: 62,
        ty: 45,
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
        tx: 88,
        ty: 64,
        kind: 'noticeboard',
        title: 'ZEPIK VILLAGE DISPATCH',
        lines: [
          'ELDER JEVA (Inside House): "The Silver Bell was stolen by bandits in the far western forest!"',
          'HERBALIST (Inside Outpost): "Stop in anytime for Heal Herbs and warm rest."',
        ],
        inspected: false,
      },
      {
        id: 'plains_river_cargo',
        tx: 26,
        ty: 45,
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
        tx: 97,
        ty: 37,
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
      { tx: 30, ty: 62, kind: 'slime' },
      { tx: 40, ty: 68, kind: 'slime' },
      { tx: 18, ty: 56, kind: 'slime' },
      { tx: 68, ty: 52, kind: 'goblin' },
      { tx: 84, ty: 51, kind: 'goblin' },
      { tx: 34, ty: 35, kind: 'goblin' },
      { tx: 46, ty: 28, kind: 'goblin' },
      { tx: 74, ty: 30, kind: 'knight' },
      { tx: 99, ty: 28, kind: 'knight' },
      { tx: 15, ty: 22, kind: 'goblin' },
      { tx: 34, ty: 15, kind: 'knight' },
      { tx: 84, ty: 15, kind: 'mage' },
      { tx: 102, ty: 15, kind: 'knight' },
      { tx: 22, ty: 68, kind: 'goblin' },
      { tx: 48, ty: 56, kind: 'slime' },
      { tx: 62, ty: 26, kind: 'knight' },
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
        destTx: 23,
        destTy: 5, // Safely south of expanded Plains NW gate!
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
        destTx: 94,
        destTy: 5, // Safely south of expanded Plains NE gate!
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

  return enrichZonesWithForageAndCrafting({
    minea,
    minea_sara: mineaSaraRoom,
    minea_weapons: mineaWeaponsRoom,
    minea_armor: mineaArmorRoom,
    minea_inn: mineaInnRoom,
    minea_tavern: mineaTavernRoom,
    minea_library: mineaLibraryRoom,
    minea_herbalist: mineaHerbalistRoom,
    minea_guild: mineaGuildRoom,
    plains,
    zepik_elder_house: zepikElderRoom,
    zepik_outpost_room: zepikOutpostRoom,
    shrine,
    tower,
  });
}

// ============================================================================
// YS BOOK II — FLOATING LAND OF YS (4 Massive Interconnected 2.5D Worlds!)
// ============================================================================
export function createYs2World(): Record<string, ZoneDef> {
  // --------------------------------------------------------------------------
  // 1. LANCE VILLAGE & GODDESS MEADOW (96x68 — Expansive ~3.5x Floating Island Village with Enterable Interiors!)
  // --------------------------------------------------------------------------
  const vW = 96;
  const vH = 68;
  const vTiles = makeGrid(vW, vH, 0);
  // Natural transitional blossom-emerald woodland framing Floating Lance Village
  naturalForestBorder(vTiles, 60);

  // Floating sky-cliff abyss along southern edge (open sky horizon!)
  fillRect(vTiles, 0, 60, vW, vH - 60, 3);
  fillRect(vTiles, 0, 60, 3, 4, 2);
  fillRect(vTiles, vW - 3, 60, 3, 4, 2);
  fillRect(vTiles, 44, 60, 8, 5, 4); // Grand Sky Overlook Deck

  // Lush flower meadows
  fillRect(vTiles, 6, 6, 32, 20, 8);
  fillRect(vTiles, 58, 6, 32, 20, 8);
  fillRect(vTiles, 6, 36, 32, 20, 8);
  fillRect(vTiles, 58, 36, 32, 20, 8);

  // Grand Cobblestone Boulevards & Central Goddess Spring Plaza
  fillRect(vTiles, 45, 0, 6, 60, 6);
  fillRect(vTiles, 8, 32, 80, 4, 6);
  fillRect(vTiles, 38, 27, 20, 14, 6);
  fillRect(vTiles, 10, 18, 76, 3, 6);
  fillRect(vTiles, 10, 52, 76, 3, 6);

  // Architecturally Diverse Floating-Island Cottages, Observatories, Forges & Conservatories!
  const lanceBuildings: WorldBuilding[] = [];
  placeCottage(vTiles, 10, 8, 11, 6, lanceBuildings, { id: 'l_lilia', name: "LILIA'S COTTAGE", signKind: 'house', roofStyle: 'cobalt', archStyle: 'one_story_cottage', hasChimney: true });
  placeCottage(vTiles, 27, 8, 10, 6, lanceBuildings, { id: 'l_elder', name: "ELDER'S HALL", signKind: 'elder', roofStyle: 'emerald', archStyle: 'grand_guildhall', hasChimney: true });
  placeCottage(vTiles, 58, 8, 11, 6, lanceBuildings, { id: 'l_forge', name: 'YS CLERIA FORGE', signKind: 'weapon', roofStyle: 'cobalt', archStyle: 'smithery_foundry', hasChimney: true });
  placeCottage(vTiles, 75, 8, 10, 6, lanceBuildings, { id: 'l_herb', name: 'SKY CONSERVATORY', signKind: 'clinic', roofStyle: 'emerald', archStyle: 'apothecary_conservatory', hasChimney: false });
  placeCottage(vTiles, 10, 42, 11, 6, lanceBuildings, { id: 'l_arm', name: 'CLERIA ARMORY', signKind: 'armor', roofStyle: 'cobalt', archStyle: 'two_story_timber', hasChimney: true });
  placeCottage(vTiles, 27, 42, 10, 6, lanceBuildings, { id: 'l_mill', name: 'WINDMILL HOUSE', signKind: 'house', roofStyle: 'terracotta', archStyle: 'l_wing_inn', hasChimney: true });
  placeCottage(vTiles, 58, 42, 10, 6, lanceBuildings, { id: 'l_obs', name: 'SKY OBSERVATORY', signKind: 'library', roofStyle: 'cobalt', archStyle: 'observatory_parlor', hasChimney: false });
  placeCottage(vTiles, 75, 42, 11, 6, lanceBuildings, { id: 'l_clinic', name: "DR. FLAIR'S CLINIC", signKind: 'clinic', roofStyle: 'emerald', archStyle: 'apothecary_conservatory', hasChimney: true });

  // Doorstep connecting lanes
  fillRect(vTiles, 14, 14, 3, 5, 6);
  fillRect(vTiles, 31, 14, 3, 5, 6);
  fillRect(vTiles, 62, 14, 3, 5, 6);
  fillRect(vTiles, 79, 14, 3, 5, 6);
  fillRect(vTiles, 14, 48, 3, 5, 6);
  fillRect(vTiles, 31, 48, 3, 5, 6);
  fillRect(vTiles, 62, 48, 3, 5, 6);
  fillRect(vTiles, 79, 48, 3, 5, 6);

  // Open North Forest Pass -> Ruins of Moondoria
  fillRect(vTiles, 45, 0, 6, 5, 6);

  // Abundant Multi-Tile Blossom & Emerald Groves across Floating Lance Village!
  placeTreeBlock(vTiles, 3, 5, 4, 4);
  placeTreeBlock(vTiles, 88, 5, 4, 4);
  placeTreeBlock(vTiles, 39, 6, 4, 3);
  placeTreeBlock(vTiles, 53, 6, 4, 3);
  placeTreeBlock(vTiles, 22, 8, 3, 3);
  placeTreeBlock(vTiles, 70, 8, 3, 3);
  placeTreeBlock(vTiles, 4, 22, 4, 4);
  placeTreeBlock(vTiles, 22, 23, 3, 3);
  placeTreeBlock(vTiles, 68, 23, 3, 3);
  placeTreeBlock(vTiles, 87, 22, 4, 4);
  placeTreeBlock(vTiles, 4, 38, 4, 4);
  placeTreeBlock(vTiles, 22, 37, 3, 3);
  placeTreeBlock(vTiles, 69, 37, 3, 3);
  placeTreeBlock(vTiles, 88, 38, 4, 4);
  placeTreeBlock(vTiles, 4, 52, 4, 4);
  placeTreeBlock(vTiles, 24, 56, 4, 3);
  placeTreeBlock(vTiles, 66, 56, 4, 3);
  placeTreeBlock(vTiles, 88, 52, 4, 4);
  placeTreeBlock(vTiles, 38, 46, 3, 3);
  placeTreeBlock(vTiles, 53, 46, 3, 3);
  for (const [lx, ly] of [
    [44, 4], [51, 4], [44, 25], [51, 25], [44, 41], [51, 41], [44, 59], [51, 59],
  ]) {
    setTile(vTiles, lx, ly, 7);
  }

  const lanceShrubs = scatterShrubs(
    'lance',
    vTiles,
    [
      { tx: 7, ty: 16, variant: 'blossom', hiddenKind: 'quest_item', grantFlag: 'celceta_blossom', rewardName: 'Celceta Blossom!' },
      { tx: 19, ty: 22, variant: 'blossom', hiddenKind: 'gold', hiddenAmount: 55 },
      { tx: 33, ty: 22, variant: 'berry', hiddenKind: 'herb' },
      { tx: 40, ty: 22, variant: 'blossom' },
      { tx: 55, ty: 22, variant: 'blossom', hiddenKind: 'clue', clueText: 'A ribbon tied to the shrub: "Bring the Celceta Blossom from Lilia’s western garden to Lilia inside her cottage!"' },
      { tx: 65, ty: 22, variant: 'berry', hiddenKind: 'gold', hiddenAmount: 65 },
      { tx: 81, ty: 22, variant: 'blossom' },
      { tx: 14, ty: 30, variant: 'fern', hiddenKind: 'seed', rewardName: 'Goddess Berry (+10 Max HP!)' },
      { tx: 31, ty: 30, variant: 'blossom' },
      { tx: 77, ty: 30, variant: 'berry', hiddenKind: 'gold', hiddenAmount: 50 },
      { tx: 8, ty: 50, variant: 'blossom' },
      { tx: 22, ty: 55, variant: 'berry', hiddenKind: 'herb' },
      { tx: 36, ty: 44, variant: 'fern' },
      { tx: 57, ty: 44, variant: 'blossom', hiddenKind: 'gold', hiddenAmount: 60 },
      { tx: 71, ty: 55, variant: 'berry' },
      { tx: 88, ty: 50, variant: 'blossom', hiddenKind: 'clue', clueText: 'Note under the petals: "Press [SHIFT / X] to cast Fire Magic while exploring Moondoria!"' },
      { tx: 39, ty: 56, variant: 'fern' },
      { tx: 56, ty: 56, variant: 'blossom', hiddenKind: 'gold', hiddenAmount: 45 },
    ],
    'blossom'
  );

  // Enterable Interior Rooms for Lance Village!
  const lanceLiliaRoom = createBuildingInteriorZone({
    id: 'lance_lilia',
    name: "LILIA'S COTTAGE",
    subtitle: 'Sunlit Flower Cottage · Speak with Lilia',
    interiorKind: 'house',
    parentZoneId: 'lance',
    parentLabel: 'LANCE VILLAGE',
    exitDestTx: 15,
    exitDestTy: 16,
    npcs: [
      {
        id: 'lilia',
        name: 'LILIA',
        role: 'quest',
        tx: 10,
        ty: 5,
        portrait: 'lilia',
        cloakColor: '#ec4899',
        hairColor: '#fb7185',
        tunicColor: '#fce7f3',
        greeting: 'Adol, welcome inside our cottage! Search the western garden shrubs for a Celceta Blossom for Dr. Flair, then venture north into Moondoria!',
        followUpFlag: 'celceta_blossom',
        followUpGreeting: 'Oh! You found the Celceta Blossom! Take 220 Gold & my lucky charm—press Shift/X to cast Fire Magic in Moondoria!',
        grantFlag: 'lilia_charm',
        rewardGold: 220,
      },
    ],
    inspectables: [
      {
        id: 'lilia_hearth',
        tx: 10,
        ty: 3,
        kind: 'campfire',
        title: "LILIA'S FLOWER HEARTH",
        lines: [
          'Fresh blossoms and warm tea fill the cottage with gentle fragrance.',
          'Your HP & MP are refreshed!',
        ],
        inspected: false,
        healMp: true,
      },
    ],
  });

  const lanceElderRoom = createBuildingInteriorZone({
    id: 'lance_elder_room',
    name: "ELDER'S HALL OF LANCE",
    subtitle: 'Ancient Chronicles of Floating Ys · Speak with Elder',
    interiorKind: 'elder',
    parentZoneId: 'lance',
    parentLabel: 'LANCE VILLAGE',
    exitDestTx: 32,
    exitDestTy: 16,
    npcs: [
      {
        id: 'lance_elder',
        name: 'ELDER OF LANCE',
        role: 'villager',
        tx: 10,
        ty: 5,
        portrait: 'elder',
        cloakColor: '#6d28d9',
        hairColor: '#f1f5f9',
        tunicColor: '#ddd6fe',
        greeting: 'The Goddess Statues in Moondoria still hold ancient magic. Inspect every statue & shrine you discover!',
      },
    ],
    inspectables: [
      {
        id: 'lance_elder_tome',
        tx: 16,
        ty: 5,
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
  });

  const lanceForgeRoom = createBuildingInteriorZone({
    id: 'lance_forge_room',
    name: 'YS CLERIA FORGE',
    subtitle: 'Floating-Island Smithery · Upgrade Blades',
    interiorKind: 'weapon',
    parentZoneId: 'lance',
    parentLabel: 'LANCE VILLAGE',
    exitDestTx: 63,
    exitDestTy: 16,
    npcs: [
      {
        id: 'lance_weapons',
        name: 'YS FORGEMASTER',
        role: 'weapon',
        tx: 10,
        ty: 5,
        portrait: 'merchant',
        cloakColor: '#dc2626',
        hairColor: '#f59e0b',
        tunicColor: '#fed7aa',
        greeting: 'Ancient Cleria-forged swords crafted atop the Floating Land of Ys! Browse our finest blades!',
      },
    ],
    inspectables: [
      {
        id: 'lance_forge_anvil',
        tx: 5,
        ty: 6,
        kind: 'anvil',
        title: 'ANCIENT CLERIA ANVIL',
        lines: [
          'A silver-inlaid forge anvil that hums faintly with residual Ys magic.',
          'Forging notes: "Press Shift or X to unleash Fireball Magic!"',
        ],
        inspected: false,
      },
    ],
  });

  const lanceArmoryRoom = createBuildingInteriorZone({
    id: 'lance_armory_room',
    name: 'CLERIA ARMORY',
    subtitle: 'Battle Armor & Silver Shields · Fortify Against Noltia',
    interiorKind: 'armor',
    parentZoneId: 'lance',
    parentLabel: 'LANCE VILLAGE',
    exitDestTx: 15,
    exitDestTy: 50,
    npcs: [
      {
        id: 'lance_armor',
        name: 'CLERIA ARMORER',
        role: 'armor',
        tx: 10,
        ty: 5,
        portrait: 'merchant',
        cloakColor: '#2563eb',
        hairColor: '#e2e8f0',
        tunicColor: '#bfdbfe',
        greeting: 'Reinforce your armor & shield before braving the Ice Ridge of Noltia!',
      },
    ],
    inspectables: [
      {
        id: 'lance_armor_stand',
        tx: 5,
        ty: 5,
        kind: 'statue',
        title: 'WINGED KNIGHT ARMOR',
        lines: [
          'Crafted by the sky-smiths of Ys to resist Noltia’s freezing winds.',
        ],
        inspected: false,
      },
    ],
  });

  const lanceClinicRoom = createBuildingInteriorZone({
    id: 'lance_clinic_room',
    name: "DR. FLAIR'S CLINIC",
    subtitle: 'Apothecary & Healing Ward · Rest & Stock Celceta Herbs',
    interiorKind: 'clinic',
    parentZoneId: 'lance',
    parentLabel: 'LANCE VILLAGE',
    exitDestTx: 80,
    exitDestTy: 50,
    npcs: [
      {
        id: 'lance_inn',
        name: 'DR. FLAIR',
        role: 'inn',
        tx: 10,
        ty: 5,
        portrait: 'elder',
        cloakColor: '#059669',
        hairColor: '#e2e8f0',
        tunicColor: '#a7f3d0',
        greeting: 'Welcome to my Clinic! Rest cleanly to recover HP & MP, or stock up on Celceta Herbs!',
      },
    ],
    inspectables: [
      {
        id: 'flair_remedy_shelf',
        tx: 16,
        ty: 5,
        kind: 'bookshelf',
        title: "DR. FLAIR'S ELIXIR RACK",
        lines: [
          'Rows of crystal vials glow with distilled Celceta nectar.',
          'A sip restores your HP & MP to full!',
        ],
        inspected: false,
        healMp: true,
      },
    ],
  });

  const lance: ZoneDef = {
    id: 'lance',
    name: 'LANCE VILLAGE',
    subtitle: 'Floating Land of Ys · Enter Cottages, Clinic & Forges to Meet Citizens',
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
        tx: 45,
        ty: 0,
        widthTiles: 6,
        heightTiles: 2,
        targetZone: 'moondoria',
        destTx: 31,
        destTy: 41,
        label: 'NORTH → RUINS OF MOONDORIA',
        direction: 'north',
      },
      { id: 'door_lilia', tx: 14, ty: 14, widthTiles: 3, heightTiles: 1, targetZone: 'lance_lilia', destTx: 10, destTy: 12, label: "ENTER · LILIA'S COTTAGE", direction: 'north', isDoorway: true },
      { id: 'door_lance_elder', tx: 31, ty: 14, widthTiles: 3, heightTiles: 1, targetZone: 'lance_elder_room', destTx: 10, destTy: 12, label: "ENTER · ELDER'S HALL", direction: 'north', isDoorway: true },
      { id: 'door_lance_forge', tx: 62, ty: 14, widthTiles: 3, heightTiles: 1, targetZone: 'lance_forge_room', destTx: 10, destTy: 12, label: 'ENTER · YS FORGE', direction: 'north', isDoorway: true },
      { id: 'door_lance_arm', tx: 14, ty: 48, widthTiles: 3, heightTiles: 1, targetZone: 'lance_armory_room', destTx: 10, destTy: 12, label: 'ENTER · CLERIA ARMORY', direction: 'north', isDoorway: true },
      { id: 'door_lance_clinic', tx: 79, ty: 48, widthTiles: 3, heightTiles: 1, targetZone: 'lance_clinic_room', destTx: 10, destTy: 12, label: "ENTER · DR. FLAIR'S CLINIC", direction: 'north', isDoorway: true },
    ],
    npcs: [
      {
        id: 'lance_guide',
        name: 'SKY WATCHER',
        role: 'villager',
        tx: 44,
        ty: 36,
        portrait: 'elder',
        cloakColor: '#0284c7',
        hairColor: '#e2e8f0',
        tunicColor: '#bae6fd',
        greeting: 'Welcome to Lance Village! Enter Lilia’s Cottage (NW), Ys Forge (NE), Cleria Armory (SW) & Dr. Flair’s Clinic (SE) to prepare for Moondoria!',
      },
      // Living Sky-Village Citizens Performing Daily Tasks in Lance Village!
      {
        id: 'lance_water_sora',
        name: 'SORA · WATER MAID',
        role: 'villager',
        secondary: true,
        task: 'water_carry',
        walkSpeed: 1.48,
        tx: 45,
        ty: 36,
        portrait: 'lilia',
        cloakColor: '#0284c7',
        hairColor: '#0369a1',
        tunicColor: '#e0f2fe',
        greeting: 'The Spring of the Goddesses never runs dry—even high above the clouds! I’m bringing fresh spring water over to Lilia’s cottage.',
        waypoints: [
          { tx: 45, ty: 36, waitSec: 4.5, faceAngle: -Math.PI * 0.25, performTask: true, activityLabel: 'Drawing Spring Water' },
          { tx: 43, ty: 33, waitSec: 0.3, performTask: false, activityLabel: 'Carrying Bucket' },
          { tx: 44, ty: 28, waitSec: 0.3, performTask: false, activityLabel: 'Carrying Bucket' },
          { tx: 47, ty: 19, waitSec: 0.4, performTask: false, activityLabel: 'Carrying Bucket' },
          { tx: 16, ty: 19, waitSec: 3.4, faceAngle: -Math.PI * 0.5, performTask: true, activityLabel: 'Delivering Water' },
          { tx: 47, ty: 19, waitSec: 0.4, performTask: false, activityLabel: 'Returning to Spring' },
          { tx: 44, ty: 28, waitSec: 0.3, performTask: false, activityLabel: 'Returning to Spring' },
          { tx: 43, ty: 33, waitSec: 0.3, performTask: false, activityLabel: 'Returning to Spring' },
        ],
      },
      {
        id: 'lance_gardener_luna',
        name: 'LUNA · SKY GARDENER',
        role: 'villager',
        secondary: true,
        task: 'garden',
        walkSpeed: 1.35,
        tx: 36,
        ty: 19,
        portrait: 'feena',
        cloakColor: '#16a34a',
        hairColor: '#f472b6',
        tunicColor: '#dcfce7',
        greeting: 'Pink cherry blossoms love the sky-island mist! Keep your eyes peeled for rare Celceta Blossoms blooming near the western gardens.',
        waypoints: [
          { tx: 36, ty: 19, waitSec: 4.6, faceAngle: Math.PI * 0.5, performTask: true, activityLabel: 'Watering Blossoms' },
          { tx: 58, ty: 19, waitSec: 4.6, faceAngle: Math.PI * 0.5, performTask: true, activityLabel: 'Tending Flowers' },
          { tx: 54, ty: 29, waitSec: 4.2, faceAngle: Math.PI * 0.5, performTask: true, activityLabel: 'Nurturing Blooms' },
        ],
      },
      {
        id: 'lance_kid_kai',
        name: 'KAI · VILLAGE KID',
        role: 'villager',
        secondary: true,
        task: 'play',
        walkSpeed: 2.5,
        tx: 42,
        ty: 29,
        portrait: 'adol',
        cloakColor: '#0ea5e9',
        hairColor: '#f59e0b',
        tunicColor: '#fef9c3',
        greeting: 'Are you really the swordsman who fell from the sky?! Watch the birds swoop between the blossom trees and the Goddess Spring!',
        waypoints: [
          { tx: 42, ty: 29, waitSec: 1.4, faceAngle: Math.PI * 0.25, performTask: true, activityLabel: 'Watching Birds' },
          { tx: 54, ty: 29, waitSec: 1.2, faceAngle: Math.PI * 0.75, performTask: true, activityLabel: 'Chasing Petals' },
          { tx: 54, ty: 38, waitSec: 1.5, faceAngle: -Math.PI * 0.75, performTask: true, activityLabel: 'Playing by Spring' },
          { tx: 42, ty: 38, waitSec: 1.3, faceAngle: -Math.PI * 0.25, performTask: true, activityLabel: 'Running Loops' },
        ],
      },
      {
        id: 'lance_guard_val',
        name: 'WATCHMAN VAL',
        role: 'villager',
        secondary: true,
        task: 'patrol',
        walkSpeed: 1.42,
        tx: 47,
        ty: 22,
        portrait: 'merchant',
        cloakColor: '#1d4ed8',
        hairColor: '#e2e8f0',
        tunicColor: '#93c5fd',
        greeting: 'The northern road leads straight into the Ruins of Moondoria. Visit the Ys Cleria Forge and Dr. Flair’s Clinic before heading out!',
        waypoints: [
          { tx: 47, ty: 10, waitSec: 3.4, faceAngle: -Math.PI * 0.5, performTask: true, activityLabel: 'Guarding North Pass' },
          { tx: 47, ty: 27, waitSec: 0.4, performTask: false, activityLabel: 'Patrolling Village' },
          { tx: 53, ty: 29, waitSec: 0.4, performTask: false, activityLabel: 'Patrolling Spring' },
          { tx: 53, ty: 38, waitSec: 0.4, performTask: false, activityLabel: 'Patrolling Spring' },
          { tx: 47, ty: 44, waitSec: 2.8, faceAngle: Math.PI * 0.5, performTask: true, activityLabel: 'Patrolling Village' },
          { tx: 47, ty: 58, waitSec: 3.4, faceAngle: Math.PI * 0.5, performTask: true, activityLabel: 'Watching Sky Cliff' },
          { tx: 47, ty: 44, waitSec: 0.4, performTask: false, activityLabel: 'Returning North' },
          { tx: 43, ty: 38, waitSec: 0.4, performTask: false, activityLabel: 'Patrolling Spring' },
          { tx: 43, ty: 29, waitSec: 0.4, performTask: false, activityLabel: 'Patrolling Spring' },
          { tx: 47, ty: 27, waitSec: 0.4, performTask: false, activityLabel: 'Returning North' },
        ],
      },
      {
        id: 'lance_smith_ren',
        name: 'APPRENTICE REN',
        role: 'villager',
        secondary: true,
        task: 'hammer',
        walkSpeed: 1.35,
        tx: 63,
        ty: 17,
        portrait: 'merchant',
        cloakColor: '#1e3a8a',
        hairColor: '#334155',
        tunicColor: '#93c5fd',
        greeting: 'Cleria silver rings pure when hammered cool! Step inside Ys Cleria Forge to equip yourself for the Ice Ridge of Noltia.',
        waypoints: [
          { tx: 63, ty: 17, waitSec: 5.2, faceAngle: -Math.PI * 0.5, performTask: true, activityLabel: 'Shaping Cleria' },
          { tx: 68, ty: 19, waitSec: 2.6, faceAngle: Math.PI * 0.5, performTask: false, activityLabel: 'Inspecting Ingots' },
        ],
      },
      {
        id: 'lance_sweeper_bera',
        name: 'BERA · CARETAKER',
        role: 'villager',
        secondary: true,
        task: 'sweep',
        walkSpeed: 1.3,
        tx: 41,
        ty: 30,
        portrait: 'elder',
        cloakColor: '#0f766e',
        hairColor: '#cbd5e1',
        tunicColor: '#ccfbf1',
        greeting: 'Blossom petals blanket the square every breeze! Sweeping them keeps the Goddess Spring stones gleaming bright.',
        waypoints: [
          { tx: 41, ty: 30, waitSec: 4.8, faceAngle: 0, performTask: true, activityLabel: 'Sweeping Petals' },
          { tx: 41, ty: 38, waitSec: 4.5, faceAngle: 0.2, performTask: true, activityLabel: 'Tidying Square' },
          { tx: 55, ty: 38, waitSec: 4.8, faceAngle: Math.PI, performTask: true, activityLabel: 'Sweeping Plaza' },
          { tx: 55, ty: 30, waitSec: 4.5, faceAngle: Math.PI, performTask: true, activityLabel: 'Brushing Stones' },
        ],
      },
    ],
    chests: [
      { id: 'lance_gold', tx: 8, ty: 11, opened: false, rewardKind: 'gold', rewardName: '200 Gold', amount: 200 },
      { id: 'lance_herb', tx: 88, ty: 11, opened: false, rewardKind: 'herb', rewardName: 'Heal Herb' },
      { id: 'lance_overlook', tx: 48, ty: 63, opened: false, rewardKind: 'gold', rewardName: '160 Gold', amount: 160 },
    ],
    shrubs: lanceShrubs,
    inspectables: [
      {
        id: 'lance_fountain',
        tx: 48,
        ty: 33,
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
        tx: 43,
        ty: 5,
        kind: 'sign',
        title: 'LANCE VILLAGE GATEPOST',
        lines: [
          'NORTH: Ruins of Moondoria → Ice Ridge of Noltia → Moat of Burnedbless.',
          'Enter village cottages & shops to visit Lilia, Dr. Flair, & the Ys Forgemaster!',
        ],
        inspected: false,
      },
      {
        id: 'lance_overlook_sign',
        tx: 46,
        ty: 62,
        kind: 'telescope',
        title: 'SKY CLIFF OBSERVATORY SPYGLASS',
        lines: [
          'Far below the swirling sunlit clouds lies the distant emerald island of Esteria.',
          'A gentle wind carries the melody of the twin Goddesses Feena & Reah.',
        ],
        inspected: false,
      },
      {
        id: 'lance_village_board',
        tx: 40,
        ty: 31,
        kind: 'noticeboard',
        title: 'LANCE VILLAGE SQUARE BOARD',
        lines: [
          'DR. FLAIR (Inside SE Clinic): "Seeking fresh Celceta Blossoms from the western garden shrubs."',
          'ELDER (Inside Hall): "Every marble Goddess Statue in Moondoria responds to a brave traveler’s touch."',
        ],
        inspected: false,
      },
      {
        id: 'lance_sky_bell',
        tx: 55,
        ty: 31,
        kind: 'bell',
        title: 'WINDCHIME SKY BELFRY',
        lines: [
          'A silver-bronze bell tuned to the drifting sky currents of Floating Ys.',
          'Its pure chime refreshes your strength! (HP & MP restored!)',
        ],
        inspected: false,
        healMp: true,
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
  // Natural overgrown transitional forest border around Moondoria (no brick walls!)
  naturalForestBorder(rTiles);

  // Sunken canal water bisecting the ruins + 3 stone bridges
  fillRect(rTiles, 0, 21, rW, 3, 3);
  fillRect(rTiles, 12, 21, 4, 3, 4);
  fillRect(rTiles, 29, 21, 4, 3, 4);
  fillRect(rTiles, 46, 21, 4, 3, 4);

  // Overgrown ruined sanctuary embankments creating chambers & investigation wings
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
  fillRect(rTiles, 29, rH - 5, 4, 5, 6);
  fillRect(rTiles, 47, 0, 4, 5, 6);
  fillRect(rTiles, 47, 3, 3, 15, 6);

  // Multi-tile ancient sanctuary groves + overgrown trees
  placeTreeBlock(rTiles, 5, 5, 4, 3);
  placeTreeBlock(rTiles, 53, 5, 4, 3);
  placeTreeBlock(rTiles, 5, 30, 4, 3);
  placeTreeBlock(rTiles, 53, 30, 4, 3);
  placeTreeBlock(rTiles, 23, 5, 3, 3);
  placeTreeBlock(rTiles, 35, 5, 3, 3);
  for (const [px, py] of [
    [12, 6], [24, 13], [36, 13], [54, 14],
    [12, 33], [24, 32], [36, 32], [49, 30], [8, 39], [52, 39],
  ]) {
    setTile(rTiles, px, py, 2);
  }
  for (const [lx, ly] of [
    [28, 40], [33, 40], [46, 4], [51, 4], [25, 10], [36, 10],
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
        destTx: 48,
        destTy: 5,
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

  return enrichZonesWithForageAndCrafting({
    lance,
    lance_lilia: lanceLiliaRoom,
    lance_elder_room: lanceElderRoom,
    lance_forge_room: lanceForgeRoom,
    lance_armory_room: lanceArmoryRoom,
    lance_clinic_room: lanceClinicRoom,
    moondoria,
    noltia,
    burnedbless,
  });
}

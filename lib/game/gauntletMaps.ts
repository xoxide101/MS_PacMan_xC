// Authentic Atari Gauntlet (1985) & Gauntlet II (1986) Detailed Dungeon Blueprints
// 16 handcrafted multi-chamber dungeons (8 for Gauntlet I, 8 for Gauntlet II)
// Tile dimensions: 32 cols x 24 rows (44px per tile = 1408 x 1056 world space)

export const GAUNTLET_COLS = 32;
export const GAUNTLET_ROWS = 24;

export const G_FLOOR = 0;
export const G_WALL = 1;
export const G_DOOR = 2;
export const G_EXIT = 3;
export const G_ACID = 4; // Gauntlet II bubbling acid pool
export const G_SECRET_WALL = 5; // Shootable cracked wall leading to treasure/shortcuts
export const G_TELEPORT = 6; // Glowing cyan teleporter pad
export const G_FORCEFIELD = 7; // Gauntlet II cycling energy barrier
export const G_STUN = 8; // Gauntlet II purple stun floor rune
export const G_CARPET = 9; // Royal woven dungeon floor runner
export const G_TORCH_WALL = 10; // Stone masonry wall with flickering iron sconce brazier
export const G_PILLAR = 11; // Carved stone dungeon column (solid)

export type DungeonThemeId =
  | 'slate_crypt'
  | 'sandstone_keep'
  | 'crimson_hell'
  | 'obsidian_vault'
  | 'emerald_sewer'
  | 'violet_sanctum';

export interface DungeonTheme {
  id: DungeonThemeId;
  name: string;
  floorA: string;
  floorB: string;
  floorGrout: string;
  wallTop: string;
  wallFace: string;
  wallDark: string;
  wallHighlight: string;
  carpetMain: string;
  carpetTrim: string;
  ambientTint: string;
}

export const DUNGEON_THEMES: Record<DungeonThemeId, DungeonTheme> = {
  slate_crypt: {
    id: 'slate_crypt',
    name: 'Stone Crypt',
    floorA: '#1B2233',
    floorB: '#161C2B',
    floorGrout: 'rgba(10, 14, 24, 0.72)',
    wallTop: '#64748B',
    wallFace: '#334155',
    wallDark: '#1E293B',
    wallHighlight: '#94A3B8',
    carpetMain: '#7F1D1D',
    carpetTrim: '#FACC15',
    ambientTint: 'rgba(56, 189, 248, 0.04)',
  },
  sandstone_keep: {
    id: 'sandstone_keep',
    name: 'Sandstone Fortress',
    floorA: '#2B231A',
    floorB: '#231C14',
    floorGrout: 'rgba(16, 11, 6, 0.72)',
    wallTop: '#B4884E',
    wallFace: '#7C582B',
    wallDark: '#473015',
    wallHighlight: '#E2C088',
    carpetMain: '#1E3A8A',
    carpetTrim: '#FDE047',
    ambientTint: 'rgba(251, 191, 36, 0.05)',
  },
  crimson_hell: {
    id: 'crimson_hell',
    name: 'Crimson Catacombs',
    floorA: '#241419',
    floorB: '#1D1014',
    floorGrout: 'rgba(12, 4, 8, 0.78)',
    wallTop: '#9F1239',
    wallFace: '#681229',
    wallDark: '#3B0816',
    wallHighlight: '#F43F5E',
    carpetMain: '#581C87',
    carpetTrim: '#F59E0B',
    ambientTint: 'rgba(239, 68, 68, 0.06)',
  },
  obsidian_vault: {
    id: 'obsidian_vault',
    name: 'Obsidian Vault',
    floorA: '#161B26',
    floorB: '#111620',
    floorGrout: 'rgba(5, 8, 14, 0.8)',
    wallTop: '#4F5D75',
    wallFace: '#2D3748',
    wallDark: '#171C26',
    wallHighlight: '#718096',
    carpetMain: '#065F46',
    carpetTrim: '#FACC15',
    ambientTint: 'rgba(99, 102, 241, 0.05)',
  },
  emerald_sewer: {
    id: 'emerald_sewer',
    name: 'Venom Cistern',
    floorA: '#13241E',
    floorB: '#0E1C17',
    floorGrout: 'rgba(4, 14, 10, 0.78)',
    wallTop: '#2E6F5E',
    wallFace: '#1C4A3E',
    wallDark: '#0F2B24',
    wallHighlight: '#5EEAD4',
    carpetMain: '#92400E',
    carpetTrim: '#FDE047',
    ambientTint: 'rgba(34, 197, 94, 0.05)',
  },
  violet_sanctum: {
    id: 'violet_sanctum',
    name: 'Sorcerer Sanctum',
    floorA: '#1E162B',
    floorB: '#171122',
    floorGrout: 'rgba(9, 5, 16, 0.78)',
    wallTop: '#6D28D9',
    wallFace: '#4C1D95',
    wallDark: '#2E1065',
    wallHighlight: '#A78BFA',
    carpetMain: '#991B1B',
    carpetTrim: '#FACC15',
    ambientTint: 'rgba(168, 85, 247, 0.06)',
  },
};

export type GauntletGenKind = 'ghost' | 'grunt' | 'demon' | 'lobber' | 'sorcerer';
export type GauntletMonsterKind =
  | 'ghost'
  | 'grunt'
  | 'demon'
  | 'lobber'
  | 'sorcerer'
  | 'thief'
  | 'death'
  | 'it'
  | 'dragon';

export type GauntletPickupKind =
  | 'food_ham'
  | 'food_cider'
  | 'poison_cider'
  | 'key'
  | 'potion'
  | 'treasure'
  | 'amulet_power'
  | 'amulet_speed'
  | 'amulet_armor'
  | 'amulet_magic'
  | 'amulet_ricochet'
  | 'amulet_invis';

export interface GauntletMapBlueprint {
  floorNumber: number;
  name: string;
  theme: DungeonThemeId;
  grid: number[][];
  spawnTile: [number, number]; // [col, row]
  exits: Array<{ col: number; row: number; skipFloors: number }>;
  teleporters: Array<[number, number]>; // [col, row] pairs/ring
  generators: Array<{ col: number; row: number; kind: GauntletGenKind; tier: 1 | 2 | 3 }>;
  monsters: Array<{ col: number; row: number; kind: GauntletMonsterKind; tier?: 1 | 2 | 3 }>;
  pickups: Array<{ col: number; row: number; kind: GauntletPickupKind }>;
  introTip: string;
}

// Helper to build structured, architecturally interesting Atari-spirit maps cleanly
function createBlankGrid(): number[][] {
  return Array.from({ length: GAUNTLET_ROWS }, (_, r) =>
    Array.from({ length: GAUNTLET_COLS }, (_, c) =>
      r === 0 || r === GAUNTLET_ROWS - 1 || c === 0 || c === GAUNTLET_COLS - 1 ? G_WALL : G_FLOOR
    )
  );
}

function drawWallH(grid: number[][], row: number, c1: number, c2: number, tile = G_WALL): void {
  for (let c = Math.max(1, c1); c <= Math.min(GAUNTLET_COLS - 2, c2); c++) {
    grid[row][c] = tile;
  }
}

function drawWallV(grid: number[][], col: number, r1: number, r2: number, tile = G_WALL): void {
  for (let r = Math.max(1, r1); r <= Math.min(GAUNTLET_ROWS - 2, r2); r++) {
    grid[r][col] = tile;
  }
}

function fillRect(grid: number[][], c1: number, r1: number, c2: number, r2: number, tile: number): void {
  for (let r = Math.max(1, r1); r <= Math.min(GAUNTLET_ROWS - 2, r2); r++) {
    for (let c = Math.max(1, c1); c <= Math.min(GAUNTLET_COLS - 2, c2); c++) {
      grid[r][c] = tile;
    }
  }
}

function sprinkleTorches(grid: number[][]): void {
  for (let r = 1; r < GAUNTLET_ROWS - 1; r++) {
    for (let c = 1; c < GAUNTLET_COLS - 1; c++) {
      if (
        grid[r][c] === G_WALL &&
        grid[r + 1]?.[c] === G_FLOOR &&
        (c + r * 3) % 6 === 0
      ) {
        grid[r][c] = G_TORCH_WALL;
      }
    }
  }
  // Also sprinkle along top perimeter wall
  for (let c = 3; c < GAUNTLET_COLS - 3; c += 5) {
    if (grid[0][c] === G_WALL && grid[1][c] !== G_WALL) {
      grid[0][c] = G_TORCH_WALL;
    }
  }
}

function buildGauntlet1Map(index: number): GauntletMapBlueprint {
  const g = createBlankGrid();
  const floorNumber = index + 1;

  if (index === 0) {
    // LEVEL 1: Classic Atari Opening Crypt (Food hallway, Key chamber, Locked Treasure Vault, Ghost & Grunt wings)
    drawWallV(g, 8, 1, 14);
    g[5][8] = G_DOOR;
    g[6][8] = G_DOOR;
    g[12][8] = G_FLOOR;

    drawWallH(g, 9, 1, 18);
    g[9][4] = G_FLOOR;
    g[9][5] = G_FLOOR;
    g[9][13] = G_DOOR;
    g[9][14] = G_DOOR;

    drawWallV(g, 18, 1, 17);
    g[4][18] = G_FLOOR;
    g[5][18] = G_FLOOR;
    g[14][18] = G_DOOR;
    g[15][18] = G_DOOR;

    drawWallH(g, 16, 6, 25);
    g[16][11] = G_FLOOR;
    g[16][12] = G_FLOOR;
    g[16][21] = G_DOOR;
    g[16][22] = G_DOOR;

    // Secret treasure alcove top-right (shootable cracked wall!)
    drawWallV(g, 25, 1, 9);
    drawWallH(g, 9, 25, 30);
    g[5][25] = G_SECRET_WALL;
    g[6][25] = G_SECRET_WALL;

    // Royal runner carpet down the entrance hall & central corridor
    fillRect(g, 2, 2, 6, 3, G_CARPET);
    fillRect(g, 10, 4, 16, 5, G_CARPET);
    fillRect(g, 20, 19, 28, 20, G_CARPET);

    // Decorative stone pillars in the great hall
    g[12][12] = G_PILLAR;
    g[12][15] = G_PILLAR;
    g[19][14] = G_PILLAR;
    g[19][18] = G_PILLAR;

    // Exits
    g[20][29] = G_EXIT;
    g[3][29] = G_EXIT; // Hidden bonus exit inside secret room (skips to Floor 3!)

    sprinkleTorches(g);

    return {
      floorNumber,
      name: 'Level 1 · The Entrance Crypt',
      theme: 'slate_crypt',
      grid: g,
      spawnTile: [3, 3],
      exits: [
        { col: 29, row: 20, skipFloors: 1 },
        { col: 29, row: 3, skipFloors: 2 },
      ],
      teleporters: [],
      generators: [
        { col: 5, row: 13, kind: 'ghost', tier: 1 },
        { col: 13, row: 3, kind: 'ghost', tier: 1 },
        { col: 15, row: 7, kind: 'grunt', tier: 1 },
        { col: 22, row: 6, kind: 'grunt', tier: 1 },
        { col: 12, row: 20, kind: 'ghost', tier: 2 },
        { col: 23, row: 13, kind: 'demon', tier: 1 },
        { col: 27, row: 17, kind: 'grunt', tier: 2 },
      ],
      monsters: [
        { col: 6, row: 12, kind: 'ghost', tier: 1 },
        { col: 12, row: 6, kind: 'ghost', tier: 1 },
        { col: 15, row: 12, kind: 'grunt', tier: 1 },
        { col: 21, row: 8, kind: 'grunt', tier: 1 },
        { col: 24, row: 12, kind: 'demon', tier: 1 },
        { col: 26, row: 19, kind: 'grunt', tier: 1 },
      ],
      pickups: [
        { col: 5, row: 6, kind: 'key' },
        { col: 3, row: 15, kind: 'food_ham' },
        { col: 11, row: 3, kind: 'potion' },
        { col: 16, row: 2, kind: 'treasure' },
        { col: 16, row: 3, kind: 'treasure' },
        { col: 22, row: 3, kind: 'key' },
        { col: 21, row: 12, kind: 'food_cider' },
        { col: 10, row: 19, kind: 'key' },
        { col: 8, row: 21, kind: 'amulet_power' },
        { col: 27, row: 3, kind: 'treasure' },
        { col: 28, row: 5, kind: 'treasure' },
        { col: 27, row: 7, kind: 'potion' },
        { col: 23, row: 21, kind: 'food_ham' },
        { col: 28, row: 12, kind: 'treasure' },
      ],
      introTip: 'Destroy Ghost Bone Piles & Grunt Spawners — don’t shoot the Food!',
    };
  }

  if (index === 1) {
    // LEVEL 2: Symmetrical 4-Quadrant Sandstone Keep with Demon Courtyard & Teleporters
    drawWallV(g, 15, 1, 22);
    drawWallV(g, 16, 1, 22);
    drawWallH(g, 11, 1, 30);
    drawWallH(g, 12, 1, 30);

    // Open center courtyard
    fillRect(g, 11, 7, 20, 16, G_FLOOR);
    fillRect(g, 13, 9, 18, 14, G_CARPET);

    // Doors into the central courtyard
    g[11][11] = G_WALL;
    g[11][20] = G_WALL;
    drawWallH(g, 7, 11, 20);
    drawWallH(g, 16, 11, 20);
    drawWallV(g, 11, 7, 16);
    drawWallV(g, 20, 7, 16);
    g[7][15] = G_DOOR;
    g[7][16] = G_DOOR;
    g[16][15] = G_DOOR;
    g[16][16] = G_DOOR;
    g[11][11] = G_DOOR;
    g[12][11] = G_DOOR;
    g[11][20] = G_DOOR;
    g[12][20] = G_DOOR;

    // Quadrant passages
    g[4][15] = G_FLOOR;
    g[4][16] = G_FLOOR;
    g[19][15] = G_FLOOR;
    g[19][16] = G_FLOOR;
    g[11][5] = G_FLOOR;
    g[12][5] = G_FLOOR;
    g[11][26] = G_FLOOR;
    g[12][26] = G_FLOOR;

    // Inner pillars & teleporters
    g[4][5] = G_PILLAR;
    g[4][26] = G_PILLAR;
    g[19][5] = G_PILLAR;
    g[19][26] = G_PILLAR;

    g[3][28] = G_TELEPORT;
    g[20][3] = G_TELEPORT;
    g[11][15] = G_TELEPORT;

    g[20][28] = G_EXIT;
    sprinkleTorches(g);

    return {
      floorNumber,
      name: 'Level 2 · Chambers of the Demon',
      theme: 'sandstone_keep',
      grid: g,
      spawnTile: [3, 3],
      exits: [{ col: 28, row: 20, skipFloors: 1 }],
      teleporters: [
        [28, 3],
        [3, 20],
        [15, 11],
      ],
      generators: [
        { col: 8, row: 4, kind: 'ghost', tier: 2 },
        { col: 23, row: 4, kind: 'demon', tier: 1 },
        { col: 8, row: 19, kind: 'grunt', tier: 2 },
        { col: 23, row: 19, kind: 'demon', tier: 2 },
        { col: 14, row: 10, kind: 'demon', tier: 2 },
        { col: 17, row: 13, kind: 'ghost', tier: 2 },
        { col: 28, row: 8, kind: 'lobber', tier: 1 },
      ],
      monsters: [
        { col: 9, row: 6, kind: 'grunt', tier: 1 },
        { col: 22, row: 6, kind: 'demon', tier: 1 },
        { col: 15, row: 12, kind: 'demon', tier: 2 },
        { col: 26, row: 15, kind: 'lobber', tier: 1 },
        { col: 6, row: 17, kind: 'ghost', tier: 2 },
        { col: 25, row: 21, kind: 'grunt', tier: 2 },
      ],
      pickups: [
        { col: 6, row: 8, kind: 'key' },
        { col: 25, row: 2, kind: 'key' },
        { col: 27, row: 6, kind: 'food_ham' },
        { col: 4, row: 15, kind: 'potion' },
        { col: 13, row: 13, kind: 'amulet_armor' },
        { col: 18, row: 10, kind: 'treasure' },
        { col: 18, row: 13, kind: 'treasure' },
        { col: 13, row: 10, kind: 'potion' },
        { col: 7, row: 21, kind: 'food_cider' },
        { col: 22, row: 15, kind: 'key' },
        { col: 29, row: 14, kind: 'treasure' },
      ],
      introTip: 'Step on Cyan Teleporter Pads to warp across sealed vaults!',
    };
  }

  if (index === 2) {
    // LEVEL 3: The Lobber's Ramparts (Parallel stone parapets — Lobbers hurl rocks OVER walls!)
    for (let r = 4; r <= 19; r += 5) {
      drawWallH(g, r, 3, 28);
      if (r === 4 || r === 14) {
        g[r][24] = G_FLOOR;
        g[r][25] = G_FLOOR;
        g[r][10] = G_DOOR;
      } else {
        g[r][6] = G_FLOOR;
        g[r][7] = G_FLOOR;
        g[r][20] = G_DOOR;
      }
    }
    // Vertical ambush bastions
    drawWallV(g, 14, 5, 8);
    drawWallV(g, 18, 10, 13);
    drawWallV(g, 12, 15, 18);
    g[14][15] = G_SECRET_WALL;
    g[14][16] = G_SECRET_WALL;

    fillRect(g, 2, 1, 29, 2, G_CARPET);
    g[21][28] = G_EXIT;
    g[21][3] = G_EXIT; // Exit 5 shortcut!
    sprinkleTorches(g);

    return {
      floorNumber,
      name: 'Level 3 · The Lobber’s Ramparts',
      theme: 'crimson_hell',
      grid: g,
      spawnTile: [3, 2],
      exits: [
        { col: 28, row: 21, skipFloors: 1 },
        { col: 3, row: 21, skipFloors: 2 },
      ],
      teleporters: [],
      generators: [
        { col: 18, row: 6, kind: 'lobber', tier: 1 },
        { col: 8, row: 11, kind: 'lobber', tier: 2 },
        { col: 24, row: 11, kind: 'grunt', tier: 2 },
        { col: 16, row: 16, kind: 'demon', tier: 2 },
        { col: 6, row: 16, kind: 'ghost', tier: 2 },
        { col: 22, row: 21, kind: 'lobber', tier: 2 },
      ],
      monsters: [
        { col: 12, row: 6, kind: 'lobber', tier: 1 },
        { col: 22, row: 7, kind: 'lobber', tier: 1 },
        { col: 15, row: 11, kind: 'grunt', tier: 2 },
        { col: 26, row: 16, kind: 'demon', tier: 2 },
        { col: 10, row: 21, kind: 'thief' },
        { col: 25, row: 21, kind: 'death' },
      ],
      pickups: [
        { col: 28, row: 2, kind: 'key' },
        { col: 6, row: 7, kind: 'food_ham' },
        { col: 27, row: 7, kind: 'potion' },
        { col: 12, row: 12, kind: 'key' },
        { col: 28, row: 12, kind: 'amulet_speed' },
        { col: 4, row: 17, kind: 'treasure' },
        { col: 20, row: 17, kind: 'food_ham' },
        { col: 15, row: 21, kind: 'potion' },
        { col: 17, row: 21, kind: 'treasure' },
        { col: 8, row: 21, kind: 'poison_cider' },
      ],
      introTip: 'Lobbers hurl rocks OVER stone walls — beware the Thief & Death!',
    };
  }

  if (index === 3) {
    // LEVEL 4: Hall of Mirrors & Sorcerers (Connected teleporter vaults + phasing Sorcerers)
    drawWallV(g, 10, 1, 22);
    drawWallV(g, 21, 1, 22);
    drawWallH(g, 8, 1, 30);
    drawWallH(g, 15, 1, 30);

    // Doors between rooms
    g[8][5] = G_DOOR;
    g[8][15] = G_DOOR;
    g[8][26] = G_DOOR;
    g[15][5] = G_DOOR;
    g[15][16] = G_DOOR;
    g[15][26] = G_DOOR;
    g[4][10] = G_FLOOR;
    g[11][10] = G_DOOR;
    g[19][10] = G_FLOOR;
    g[4][21] = G_DOOR;
    g[11][21] = G_FLOOR;
    g[19][21] = G_DOOR;

    // 4-Corner Teleporter Ring
    g[3][28] = G_TELEPORT;
    g[20][28] = G_TELEPORT;
    g[20][3] = G_TELEPORT;
    g[11][15] = G_TELEPORT;

    fillRect(g, 12, 10, 19, 13, G_CARPET);
    g[20][15] = G_EXIT;
    sprinkleTorches(g);

    return {
      floorNumber,
      name: 'Level 4 · Hall of Sorcerers',
      theme: 'violet_sanctum',
      grid: g,
      spawnTile: [4, 4],
      exits: [{ col: 15, row: 20, skipFloors: 1 }],
      teleporters: [
        [28, 3],
        [28, 20],
        [3, 20],
        [15, 11],
      ],
      generators: [
        { col: 15, row: 4, kind: 'sorcerer', tier: 1 },
        { col: 26, row: 5, kind: 'sorcerer', tier: 2 },
        { col: 5, row: 11, kind: 'ghost', tier: 3 },
        { col: 26, row: 11, kind: 'demon', tier: 2 },
        { col: 6, row: 19, kind: 'grunt', tier: 3 },
        { col: 25, row: 19, kind: 'sorcerer', tier: 2 },
      ],
      monsters: [
        { col: 14, row: 5, kind: 'sorcerer', tier: 1 },
        { col: 24, row: 4, kind: 'sorcerer', tier: 2 },
        { col: 16, row: 12, kind: 'death' },
        { col: 7, row: 12, kind: 'ghost', tier: 2 },
        { col: 24, row: 18, kind: 'demon', tier: 2 },
        { col: 13, row: 19, kind: 'thief' },
      ],
      pickups: [
        { col: 7, row: 3, kind: 'key' },
        { col: 18, row: 3, kind: 'potion' },
        { col: 24, row: 6, kind: 'food_ham' },
        { col: 3, row: 12, kind: 'key' },
        { col: 13, row: 11, kind: 'amulet_magic' },
        { col: 28, row: 13, kind: 'key' },
        { col: 8, row: 17, kind: 'food_cider' },
        { col: 18, row: 20, kind: 'treasure' },
        { col: 12, row: 20, kind: 'treasure' },
        { col: 23, row: 21, kind: 'potion' },
      ],
      introTip: 'Sorcerers blink invisible — listen and watch for shimmer trails!',
    };
  }

  // LEVELS 5–8: Distinct handcrafted architectural layouts using modular wing patterns
  const themes: DungeonThemeId[] = ['obsidian_vault', 'sandstone_keep', 'crimson_hell', 'violet_sanctum'];
  const names = [
    'Level 5 · Death’s Labyrinth',
    'Level 6 · The Grand Treasure Vault',
    'Level 7 · Catacombs of the Dark Lord',
    'Level 8 · Citadel of the Gauntlet',
  ];
  const idx = (index - 4) % 4;

  // Build concentric fortified ring + cross hallways + secret treasure corners
  drawWallH(g, 5, 4, 27);
  drawWallH(g, 18, 4, 27);
  drawWallV(g, 5, 5, 18);
  drawWallV(g, 26, 5, 18);

  // Inner keep
  drawWallH(g, 9, 10, 21);
  drawWallH(g, 14, 10, 21);
  drawWallV(g, 10, 9, 14);
  drawWallV(g, 21, 9, 14);

  // Openings & locked vault doors
  g[5][15] = G_FLOOR;
  g[5][16] = G_FLOOR;
  g[18][15] = G_DOOR;
  g[18][16] = G_DOOR;
  g[11][5] = G_DOOR;
  g[12][5] = G_DOOR;
  g[11][26] = G_FLOOR;
  g[12][26] = G_FLOOR;

  // Inner keep doors & secret wall
  g[9][15] = G_DOOR;
  g[9][16] = G_DOOR;
  g[14][15] = G_SECRET_WALL;
  g[14][16] = G_SECRET_WALL;

  // Extra radial dividers varied by floor
  if (idx % 2 === 0) {
    drawWallV(g, 15, 1, 4);
    drawWallH(g, 11, 1, 4);
    drawWallH(g, 12, 27, 30);
    g[2][15] = G_DOOR;
  } else {
    drawWallV(g, 12, 19, 22);
    drawWallV(g, 20, 19, 22);
    g[20][12] = G_DOOR;
    g[20][20] = G_DOOR;
  }

  fillRect(g, 12, 10, 19, 13, G_CARPET);
  g[7][8] = G_PILLAR;
  g[7][23] = G_PILLAR;
  g[16][8] = G_PILLAR;
  g[16][23] = G_PILLAR;

  g[2][29] = G_TELEPORT;
  g[21][2] = G_TELEPORT;
  g[11][15] = G_EXIT;
  g[21][29] = G_EXIT;
  sprinkleTorches(g);

  const tier: 1 | 2 | 3 = floorNumber >= 7 ? 3 : 2;
  return {
    floorNumber,
    name: names[idx],
    theme: themes[idx],
    grid: g,
    spawnTile: [3, 3],
    exits: [
      { col: 15, row: 11, skipFloors: 2 },
      { col: 29, row: 21, skipFloors: 1 },
    ],
    teleporters: [
      [29, 2],
      [2, 21],
    ],
    generators: [
      { col: 8, row: 2, kind: 'ghost', tier },
      { col: 22, row: 2, kind: 'lobber', tier },
      { col: 8, row: 11, kind: 'grunt', tier },
      { col: 23, row: 11, kind: 'demon', tier },
      { col: 13, row: 7, kind: 'sorcerer', tier },
      { col: 18, row: 16, kind: 'demon', tier },
      { col: 8, row: 21, kind: 'grunt', tier },
      { col: 24, row: 21, kind: 'ghost', tier },
    ],
    monsters: [
      { col: 18, row: 3, kind: 'death' },
      { col: 14, row: 11, kind: 'death' },
      { col: 24, row: 8, kind: 'sorcerer', tier },
      { col: 7, row: 15, kind: 'lobber', tier },
      { col: 28, row: 15, kind: 'thief' },
      { col: 16, row: 20, kind: 'demon', tier },
      { col: 22, row: 16, kind: 'grunt', tier },
    ],
    pickups: [
      { col: 6, row: 2, kind: 'key' },
      { col: 25, row: 3, kind: 'food_ham' },
      { col: 2, row: 8, kind: 'potion' },
      { col: 29, row: 8, kind: 'key' },
      { col: 12, row: 11, kind: 'treasure' },
      { col: 18, row: 11, kind: 'treasure' },
      { col: 13, row: 12, kind: 'amulet_power' },
      { col: 18, row: 12, kind: 'amulet_armor' },
      { col: 3, row: 16, kind: 'food_ham' },
      { col: 16, row: 21, kind: 'potion' },
      { col: 27, row: 18, kind: 'key' },
      { col: 10, row: 16, kind: 'poison_cider' },
    ],
    introTip: 'Save Magic Potions for Death — blast cracked walls for secret treasure vaults!',
  };
}

function buildGauntlet2Map(index: number): GauntletMapBlueprint {
  const g = createBlankGrid();
  const floorNumber = index + 1;

  if (index === 0) {
    // GAUNTLET II LEVEL 1: Acidic Antechamber (Acid Pools, Reflective Shots, Forcefield Gate, Secret Wall)
    drawWallV(g, 9, 1, 15);
    g[7][9] = G_FORCEFIELD;
    g[8][9] = G_FORCEFIELD;
    g[13][9] = G_FLOOR;

    drawWallH(g, 11, 9, 23);
    g[11][15] = G_DOOR;
    g[11][16] = G_DOOR;

    drawWallV(g, 23, 1, 18);
    g[5][23] = G_DOOR;
    g[6][23] = G_DOOR;
    g[14][23] = G_SECRET_WALL;
    g[15][23] = G_SECRET_WALL;

    drawWallH(g, 17, 1, 17);
    g[17][5] = G_FLOOR;
    g[17][6] = G_FLOOR;

    // Signature Gauntlet II Acid Puddles & Stun Tiles
    g[5][13] = G_ACID;
    g[6][14] = G_ACID;
    g[8][18] = G_ACID;
    g[14][14] = G_ACID;
    g[15][15] = G_ACID;
    g[19][19] = G_ACID;
    g[20][20] = G_ACID;
    g[13][4] = G_STUN;
    g[9][27] = G_STUN;

    fillRect(g, 2, 2, 7, 3, G_CARPET);
    g[20][28] = G_EXIT;
    g[3][28] = G_TELEPORT;
    g[20][3] = G_TELEPORT;
    sprinkleTorches(g);

    return {
      floorNumber,
      name: 'G2 Level 1 · Acidic Antechamber',
      theme: 'emerald_sewer',
      grid: g,
      spawnTile: [3, 3],
      exits: [{ col: 28, row: 20, skipFloors: 1 }],
      teleporters: [
        [28, 3],
        [3, 20],
      ],
      generators: [
        { col: 5, row: 11, kind: 'ghost', tier: 1 },
        { col: 16, row: 4, kind: 'grunt', tier: 1 },
        { col: 20, row: 8, kind: 'demon', tier: 1 },
        { col: 12, row: 15, kind: 'lobber', tier: 1 },
        { col: 27, row: 12, kind: 'sorcerer', tier: 1 },
        { col: 21, row: 20, kind: 'grunt', tier: 2 },
      ],
      monsters: [
        { col: 14, row: 6, kind: 'grunt', tier: 1 },
        { col: 19, row: 5, kind: 'ghost', tier: 1 },
        { col: 27, row: 7, kind: 'demon', tier: 1 },
        { col: 16, row: 15, kind: 'lobber', tier: 1 },
        { col: 26, row: 17, kind: 'it' },
      ],
      pickups: [
        { col: 6, row: 6, kind: 'amulet_ricochet' },
        { col: 4, row: 8, kind: 'key' },
        { col: 12, row: 3, kind: 'food_ham' },
        { col: 21, row: 3, kind: 'potion' },
        { col: 27, row: 5, kind: 'key' },
        { col: 28, row: 15, kind: 'treasure' },
        { col: 29, row: 16, kind: 'treasure' },
        { col: 6, row: 20, kind: 'food_cider' },
        { col: 14, row: 20, kind: 'potion' },
        { col: 18, row: 14, kind: 'poison_cider' },
      ],
      introTip: 'Gauntlet II: Grab Reflective Shots to bounce off walls & beware Acid & “It”!',
    };
  }

  if (index === 1) {
    // GAUNTLET II LEVEL 2: Dragon's Lair Vault (Iconic Fire-Breathing Dragon Guardian!)
    drawWallH(g, 6, 6, 25);
    drawWallH(g, 17, 6, 25);
    drawWallV(g, 6, 6, 17);
    drawWallV(g, 25, 6, 17);

    // Wide grand doors into the Dragon Arena
    g[6][15] = G_DOOR;
    g[6][16] = G_DOOR;
    g[17][15] = G_DOOR;
    g[17][16] = G_DOOR;
    g[11][6] = G_FORCEFIELD;
    g[12][6] = G_FORCEFIELD;
    g[11][25] = G_FLOOR;
    g[12][25] = G_FLOOR;

    // Dragon hoard carpet & pillars
    fillRect(g, 10, 9, 21, 14, G_CARPET);
    g[8][9] = G_PILLAR;
    g[8][22] = G_PILLAR;
    g[15][9] = G_PILLAR;
    g[15][22] = G_PILLAR;

    // Acid moat corners
    g[3][14] = G_ACID;
    g[3][17] = G_ACID;
    g[20][14] = G_ACID;
    g[20][17] = G_ACID;
    g[11][3] = G_ACID;
    g[12][28] = G_ACID;

    g[20][28] = G_EXIT;
    g[2][28] = G_TELEPORT;
    g[21][3] = G_TELEPORT;
    sprinkleTorches(g);

    return {
      floorNumber,
      name: 'G2 Level 2 · Dragon’s Lair Vault',
      theme: 'crimson_hell',
      grid: g,
      spawnTile: [3, 3],
      exits: [{ col: 28, row: 20, skipFloors: 1 }],
      teleporters: [
        [28, 2],
        [3, 21],
      ],
      generators: [
        { col: 10, row: 3, kind: 'grunt', tier: 2 },
        { col: 22, row: 3, kind: 'demon', tier: 2 },
        { col: 3, row: 16, kind: 'ghost', tier: 2 },
        { col: 28, row: 15, kind: 'lobber', tier: 2 },
        { col: 10, row: 20, kind: 'sorcerer', tier: 1 },
      ],
      monsters: [
        { col: 16, row: 11, kind: 'dragon' },
        { col: 12, row: 11, kind: 'demon', tier: 2 },
        { col: 20, row: 12, kind: 'demon', tier: 2 },
        { col: 27, row: 7, kind: 'thief' },
        { col: 6, row: 20, kind: 'death' },
      ],
      pickups: [
        { col: 6, row: 3, kind: 'key' },
        { col: 25, row: 3, kind: 'potion' },
        { col: 14, row: 10, kind: 'treasure' },
        { col: 17, row: 10, kind: 'treasure' },
        { col: 14, row: 13, kind: 'treasure' },
        { col: 17, row: 13, kind: 'amulet_power' },
        { col: 3, row: 8, kind: 'food_ham' },
        { col: 28, row: 8, kind: 'food_ham' },
        { col: 16, row: 21, kind: 'potion' },
        { col: 23, row: 20, kind: 'key' },
      ],
      introTip: 'Fire-Breathing Dragon guards the central hoard — bank ricochet shots behind pillars!',
    };
  }

  // GAUNTLET II LEVELS 3–8: Richly varied Ricochet Foundries, Secret Rooms, & Twin Dragon Sanctums
  const themes: DungeonThemeId[] = [
    'obsidian_vault',
    'sandstone_keep',
    'violet_sanctum',
    'crimson_hell',
    'emerald_sewer',
    'violet_sanctum',
  ];
  const names = [
    'G2 Level 3 · Tag of “It” Arena',
    'G2 Level 4 · The Ricochet Foundry',
    'G2 Level 5 · Poison & Gold Crypt',
    'G2 Level 6 · Twin Dragon Sanctum',
    'G2 Level 7 · Secret Vault Gauntlet',
    'G2 Level 8 · Grand Gauntlet II Spire',
  ];
  const idx = (index - 2) % 6;
  const tier: 1 | 2 | 3 = floorNumber >= 6 ? 3 : 2;

  // Zig-zag angled chambers perfect for bank-shotting ricochet projectiles!
  for (let c = 7; c <= 25; c += 6) {
    drawWallV(g, c, 2, 21);
    const gap1 = (c % 12 === 7) ? 5 : 17;
    const gap2 = (c % 12 === 7) ? 16 : 6;
    g[gap1][c] = G_FLOOR;
    g[gap1 + 1][c] = G_FLOOR;
    g[gap2][c] = G_DOOR;
    g[gap2 + 1][c] = G_DOOR;
    if (c === 19) {
      g[11][c] = G_SECRET_WALL;
      g[12][c] = G_SECRET_WALL;
    } else if (c === 13) {
      g[11][c] = G_FORCEFIELD;
      g[12][c] = G_FORCEFIELD;
    }
  }
  drawWallH(g, 11, 2, 6);
  drawWallH(g, 12, 26, 30);
  g[11][4] = G_FLOOR;
  g[12][28] = G_FLOOR;

  // Acid & Stun traps
  for (let i = 0; i < 6; i++) {
    const ac = 4 + ((i * 5 + idx * 3) % 24);
    const ar = 4 + ((i * 3 + idx * 4) % 16);
    if (g[ar][ac] === G_FLOOR) g[ar][ac] = i % 3 === 0 ? G_STUN : G_ACID;
  }

  fillRect(g, 14, 9, 18, 14, G_CARPET);
  g[3][29] = G_TELEPORT;
  g[20][3] = G_TELEPORT;
  g[20][29] = G_EXIT;
  g[3][16] = G_EXIT;
  sprinkleTorches(g);

  const monsters: GauntletMapBlueprint['monsters'] = [
    { col: 10, row: 7, kind: 'sorcerer', tier },
    { col: 16, row: 11, kind: 'dragon' },
    { col: 22, row: 16, kind: 'death' },
    { col: 10, row: 18, kind: 'it' },
    { col: 28, row: 8, kind: 'thief' },
    { col: 22, row: 5, kind: 'lobber', tier },
  ];
  if (floorNumber >= 6) {
    monsters.push({ col: 28, row: 17, kind: 'dragon' });
  }

  return {
    floorNumber,
    name: names[idx],
    theme: themes[idx],
    grid: g,
    spawnTile: [3, 3],
    exits: [
      { col: 29, row: 20, skipFloors: 1 },
      { col: 16, row: 3, skipFloors: 2 },
    ],
    teleporters: [
      [29, 3],
      [3, 20],
    ],
    generators: [
      { col: 4, row: 16, kind: 'ghost', tier },
      { col: 10, row: 4, kind: 'grunt', tier },
      { col: 16, row: 18, kind: 'demon', tier },
      { col: 22, row: 10, kind: 'lobber', tier },
      { col: 28, row: 5, kind: 'sorcerer', tier },
      { col: 28, row: 14, kind: 'demon', tier },
    ],
    monsters,
    pickups: [
      { col: 5, row: 6, kind: 'key' },
      { col: 10, row: 12, kind: 'food_ham' },
      { col: 16, row: 12, kind: 'treasure' },
      { col: 17, row: 12, kind: 'amulet_ricochet' },
      { col: 15, row: 10, kind: 'amulet_armor' },
      { col: 22, row: 18, kind: 'potion' },
      { col: 28, row: 10, kind: 'key' },
      { col: 4, row: 21, kind: 'potion' },
      { col: 10, row: 21, kind: 'food_ham' },
      { col: 22, row: 3, kind: 'poison_cider' },
      { col: 27, row: 21, kind: 'treasure' },
    ],
    introTip:
      floorNumber >= 6
        ? 'Twin Dragons & Death patrol this sanctum — use Magic Potions & Reflective Shots!'
        : 'Shoot cracked walls to uncover secret hoards & avoid Purple Poison Cider!',
  };
}

export function getGauntletMap(isSequel: boolean, floor: number): GauntletMapBlueprint {
  const idx = (Math.max(1, floor) - 1) % 8;
  const map = isSequel ? buildGauntlet2Map(idx) : buildGauntlet1Map(idx);
  return {
    ...map,
    floorNumber: floor,
    name: floor > 8 ? `${map.name} (Loop ${Math.floor((floor - 1) / 8) + 1})` : map.name,
  };
}

import { GRID_COLS, GRID_ROWS } from './types';
import { SuperDoorLink, SuperMazeDefinition, SuperMazeTheme, SuperTileType } from './superTypes';

export const SUPER_THEMES: SuperMazeTheme[] = [
  {
    name: 'Emerald Vault',
    wallOuter: '#22C55E',
    wallInner: '#0A2E1A',
    wallHighlight: '#BBF7D0',
    wallGlow: 'rgba(34, 197, 94, 0.45)',
    floorTint: '#040B08',
    gateLocked: '#38BDF8',
    gateGlow: 'rgba(56, 189, 248, 0.65)',
    gateColor: '#FFA6D6',
    accentHex: '#22C55E',
  },
  {
    name: 'Cobalt Treasury',
    wallOuter: '#3B82F6',
    wallInner: '#0E1F4F',
    wallHighlight: '#BFDBFE',
    wallGlow: 'rgba(59, 130, 246, 0.46)',
    floorTint: '#050814',
    gateLocked: '#FACC15',
    gateGlow: 'rgba(250, 204, 21, 0.65)',
    gateColor: '#FFA6D6',
    accentHex: '#3B82F6',
  },
  {
    name: 'Crimson Citadel',
    wallOuter: '#F43F5E',
    wallInner: '#3E0D1B',
    wallHighlight: '#FECDD3',
    wallGlow: 'rgba(244, 63, 94, 0.46)',
    floorTint: '#0F0509',
    gateLocked: '#38BDF8',
    gateGlow: 'rgba(56, 189, 248, 0.65)',
    gateColor: '#FDE047',
    accentHex: '#F43F5E',
  },
  {
    name: 'Amethyst Hall',
    wallOuter: '#A855F7',
    wallInner: '#2B1147',
    wallHighlight: '#E9D5FF',
    wallGlow: 'rgba(168, 85, 247, 0.46)',
    floorTint: '#090512',
    gateLocked: '#4ADE80',
    gateGlow: 'rgba(74, 222, 128, 0.65)',
    gateColor: '#FDA4AF',
    accentHex: '#A855F7',
  },
];

// Symmetric 14-char left half (mirrored to 28x31).
// Legend:
// '#' wall | ' ' corridor | 'K' golden key | 'V' locked vault gate | 'T' treasure item
// 'o' power pellet | 'S' Green Super Pellet | '-' ghost house gate | 'G' ghost house interior
const SUPER_LEFT_HALF: string[] = [
  '##############', // 00
  '#o    K      #', // 01: 1(o), 6(K)
  '# #### ##### #', // 02: open 1, 6, 12
  '# VTTV VT TV #', // 03: Room A (2..5), Room B (7..11)
  '# #### ##### #', // 04: open 1, 6, 12
  '#        K    ', // 05: open 1..13, 9(K)
  '# #### ## ####', // 06: open 1, 6, 9
  '# VTTV ## VTT ', // 07: Room C (2..5), Top Center Vault (10..17: VTT  TTV)
  '# #### ## ####', // 08: open 1, 6, 9
  '#     S       ', // 09: open 1..13, 6(S) Green Super Pellet!
  '###### ## ####', // 10: open 6, 9
  '###### ##     ', // 11: open 6, 9..13 (Ghost House top walkway)
  '###### ## ###-', // 12: open 6, 9, ghost gate 13
  '###### ## #GGG', // 13: open 6, 9, ghost interior
  '      K   #GGG', // 14: Warp tunnel 0..9, 6(K), ghost interior
  '###### ## #GGG', // 15
  '###### ## ####', // 16
  '###### ##     ', // 17: Ghost House bottom walkway & Bonus Star at center
  '###### ## ####', // 18: open 6, 9
  '#            #', // 19: open 1..12
  '# #### ##### #', // 20: open 1, 6, 12
  '# VTTV VT TV #', // 21: Room D (2..5), Room E (7..11)
  '# #### ##### #', // 22: open 1, 6, 12
  '#o    K       ', // 23: open 1..13, 1(o), 6(K), Pac-Man spawns at (14, 23.5)
  '# #### ## ####', // 24: open 1, 6, 9
  '# VTTV ## VTT ', // 25: Room F (2..5), Bottom Center Vault (10..17: VTT  TTV)
  '# #### ## ####', // 26: open 1, 6, 9
  '#        K    ', // 27: open 1..13, 9(K)
  '# #### ##### #', // 28: open 1, 6, 12
  '#             ', // 29: open 1..13
  '##############', // 30
];

function mirrorRows(leftHalf: string[]): SuperTileType[][] {
  return leftHalf.map((left) => {
    const right = left.split('').reverse().join('');
    return (left + right).split('') as SuperTileType[];
  });
}

// Each key unlocks specific nearby vault doors (left-side keys unlock left-side/center doors; mirrored for right)
function buildDoorLinks(): SuperDoorLink[] {
  const leftLinks: SuperDoorLink[] = [
    // Row 1 Col 6 Key -> unlocks Top-Left Room A (row 3 cols 2,5) and Top-Inner Room B (row 3 cols 7,11)
    {
      keyCol: 6,
      keyRow: 1,
      doors: [
        { col: 2, row: 3 },
        { col: 5, row: 3 },
        { col: 7, row: 3 },
        { col: 11, row: 3 },
      ],
    },
    // Row 5 Col 9 Key -> unlocks Mid-Upper Room C (row 7 cols 2,5) and Top Center Vault left door (row 7 col 10)
    {
      keyCol: 9,
      keyRow: 5,
      doors: [
        { col: 2, row: 7 },
        { col: 5, row: 7 },
        { col: 10, row: 7 },
      ],
    },
    // Row 14 Col 6 Key -> unlocks Mid-Lower Room D (row 21 cols 2,5) and Top Center Vault right-side backup
    {
      keyCol: 6,
      keyRow: 14,
      doors: [
        { col: 2, row: 21 },
        { col: 5, row: 21 },
      ],
    },
    // Row 23 Col 6 Key -> unlocks Lower-Inner Room E (row 21 cols 7,11)
    {
      keyCol: 6,
      keyRow: 23,
      doors: [
        { col: 7, row: 21 },
        { col: 11, row: 21 },
      ],
    },
    // Row 27 Col 9 Key -> unlocks Bottom Room F (row 25 cols 2,5) and Bottom Center Vault left door (row 25 col 10)
    {
      keyCol: 9,
      keyRow: 27,
      doors: [
        { col: 2, row: 25 },
        { col: 5, row: 25 },
        { col: 10, row: 25 },
      ],
    },
  ];

  const allLinks: SuperDoorLink[] = [];
  for (const link of leftLinks) {
    allLinks.push(link);
    allLinks.push({
      keyCol: GRID_COLS - 1 - link.keyCol,
      keyRow: link.keyRow,
      doors: link.doors.map((d) => ({ col: GRID_COLS - 1 - d.col, row: d.row })),
    });
  }
  return allLinks;
}

function buildSuperMaze(): SuperMazeDefinition {
  const grid = mirrorRows(SUPER_LEFT_HALF);
  let totalTreasures = 0;
  let totalKeys = 0;
  let totalDoors = 0;
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const ch = grid[r][c];
      if (ch === 'T') totalTreasures++;
      else if (ch === 'K') totalKeys++;
      else if (ch === 'V') totalDoors++;
    }
  }
  return {
    grid,
    tunnelRows: [14],
    totalTreasures,
    totalKeys,
    totalDoors,
    playerSpawn: { x: 14, y: 23.5 },
    ghostHouseDoor: { x: 14, y: 11.5 },
    ghostHouseCenter: { x: 14, y: 14.5 },
    bonusStarPos: { x: 14, y: 17.5 },
    doorLinks: buildDoorLinks(),
  };
}

export const SUPER_MAZE: SuperMazeDefinition = buildSuperMaze();

export function cloneSuperGrid(grid: SuperTileType[][]): SuperTileType[][] {
  return grid.map((row) => [...row]);
}

export function isSuperWalkableForPlayer(
  grid: SuperTileType[][],
  col: number,
  row: number,
  isSuperMode: boolean
): boolean {
  if (row < 0 || row >= GRID_ROWS) return false;
  if (col < 0 || col >= GRID_COLS) {
    return SUPER_MAZE.tunnelRows.includes(row);
  }
  const tile = grid[row][col];
  if (tile === '#' || tile === '-' || tile === 'G') return false;
  if (tile === 'V') return isSuperMode; // Giant Super Pac-Man smashes locked doors!
  return true;
}

export function isSuperWalkableForGhost(
  grid: SuperTileType[][],
  col: number,
  row: number,
  allowHouseGate: boolean
): boolean {
  if (row < 0 || row >= GRID_ROWS) return false;
  if (col < 0 || col >= GRID_COLS) {
    return SUPER_MAZE.tunnelRows.includes(row);
  }
  const tile = grid[row][col];
  if (tile === '#') return false;
  // Ghosts phase right through locked vault gates in Super Pac-Man (just like the 1982 arcade!)
  if (tile === '-' || tile === 'G') return allowHouseGate;
  return true;
}

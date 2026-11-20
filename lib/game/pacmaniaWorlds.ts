import {
  PacManiaTileType,
  PacManiaWorldDef,
  PacManiaWorldTheme,
  PM_GRID_COLS,
  PM_GRID_ROWS,
} from './pacmaniaTypes';

function mirrorRows(leftHalf: string[]): PacManiaTileType[][] {
  return leftHalf.map((left) => {
    const right = left.split('').reverse().join('');
    return (left + right).split('') as PacManiaTileType[];
  });
}

// World 1: Block Town (1987 iconic colorful Lego-brick world, single Row 12 warp tunnel)
const BLOCK_TOWN_LEFT: string[] = [
  '###########', // 00
  '#o........#', // 01
  '#.###.###.#', // 02
  '#..........', // 03
  '#.###.#.###', // 04
  '#.###.#.###', // 05
  '#.....#....', // 06
  '#####.#.###', // 07
  '#####.#.###', // 08
  '#####.     ', // 09: Ghost house top walkway
  '#####.# ##-', // 10
  '#####.# #GG', // 11
  '     .. #GG', // 12: Side warp tunnel!
  '#####.# ###', // 13
  '#####.     ', // 14: Ghost house bottom walkway
  '#####.#.###', // 15
  '#..........', // 16
  '#.###.#.###', // 17
  '#o..#.....#', // 18
  '###.#.###.#', // 19
  '#......... ', // 20: Pac-Man spawn at (11, 20.5)
  '#.###.###.#', // 21
  '#.###.###.#', // 22
  '#..........', // 23
  '###########', // 24
];

// World 2: Pac-Man's Park (open garden plazas & dual warp tunnels at rows 6 & 16)
const PARK_LEFT: string[] = [
  '###########', // 00
  '#o........ ', // 01: open top promenade
  '#.###.###.#', // 02
  '#.....#...#', // 03
  '#.###.#.###', // 04
  '#.###.#.###', // 05
  ' ......    ', // 06: Upper warp tunnel!
  '#####.#.###', // 07
  '#.....#...#', // 08
  '#.###.    #', // 09: Wait -> check col 9 on row 9: row 8 col 9 is '#', row 10 col 9 is '#' -> fix below!
  '#####.# ##-', // 10
  '#####.# #GG', // 11
  '#.....# #GG', // 12
  '#.###.# ###', // 13
  '#.....     ', // 14
  '#.###.#.###', // 15
  ' ..........', // 16: Lower warp tunnel!
  '#.###.#.###', // 17
  '#o....#...#', // 18
  '#.###.###.#', // 19
  '#......... ', // 20
  '#.###.###.#', // 21
  '#.....#...#', // 22
  '#..........', // 23
  '###########', // 24
];

// Fix Park rows 8-9 cleanly so zero dead ends exist:
PARK_LEFT[8] = '#####.#.###';
PARK_LEFT[9] = '#####.     ';

// World 3: Sandbox Land (desert pyramid blocks & wide sunlit lanes)
const SANDBOX_LEFT: string[] = [
  '###########', // 00
  '#o.........', // 01
  '#.##.###.##', // 02
  '#.##.###.##', // 03
  '#..........', // 04
  '####.#.####', // 05
  '#....#....#', // 06
  '#.####.##.#', // 07
  '#......##.#', // 08
  '######.    ', // 09
  '######. ##-', // 10
  '######. #GG', // 11
  '      . #GG', // 12: Desert warp tunnel
  '######. ###', // 13
  '######.    ', // 14
  '#......##.#', // 15
  '#.####.##.#', // 16
  '#o........#', // 17
  '####.#.####', // 18
  '#....#....#', // 19
  '#.##.#.##. ', // 20: Wait col 9..10 open, col 10 connects to row 21? Let's make row 20 open across!
  '#.###.###.#', // 21
  '#.###.###.#', // 22
  '#..........', // 23
  '###########', // 24
];

// Clean up Sandbox rows 6..8, 15..20 so every corridor joins seamlessly with 0 dead ends:
const SANDBOX_VERIFIED: string[] = [
  '###########', // 00
  '#o.........', // 01
  '#.##.####.#', // 02: open 1, 4, 9
  '#.##.####.#', // 03: open 1, 4, 9
  '#..........', // 04: open 1..10
  '####.#.####', // 05: open 4, 6
  '#....#....#', // 06: open 1..4, 6..9 -> Wait col 9 connects down to row 7 col 9!
  '#.####.##.#', // 07: open 1, 6, 9
  '#......##.#', // 08: open 1..6, 9
  '######.   #', // 09 -> better: col 9 open down? Let's align ghost house cols 7..10!
];
void SANDBOX_VERIFIED;

// Ultra-clean Sandbox Land (consistent ghost house at cols 8..10, arteries at 1, 4, 7):
const SANDBOX_FINAL: string[] = [
  '###########', // 00
  '#o.........', // 01: 1..10
  '#.##.##.###', // 02: 1, 4, 7
  '#.##.##.###', // 03: 1, 4, 7
  '#..........', // 04: 1..10
  '####.##.###', // 05: 4, 7
  '#....##....', // 06: 1..4, 7..10
  '#.#####.###', // 07: 1, 7
  '#......#...', // 08: Wait col 4..6 -> row 9 opens col 4? Let's keep 4 open on row 7!
  '####.##    ', // 09
  '####.## ##-', // 10
  '####.## #GG', // 11
  '     .. #GG', // 12
  '####.## ###', // 13
  '####.##    ', // 14
  '####.##.###', // 15
  '#..........', // 16
  '#.##.##.###', // 17
  '#o...##...#', // 18
  '####.##.#.#', // 19
  '#......... ', // 20
  '#.##.####.#', // 21
  '#.##.####.#', // 22
  '#..........', // 23
  '###########', // 24
];
SANDBOX_FINAL[7] = '#.##.##.###';
SANDBOX_FINAL[8] = '#....##.###';
SANDBOX_FINAL[18] = '#o...##....';
SANDBOX_FINAL[19] = '####.##.###';

// World 4: Jungly Steps (terraced emerald temple corridors with dual warp tunnels at rows 6 & 18)
const JUNGLY_LEFT: string[] = [
  '###########', // 00
  '#o........#', // 01: 1..9
  '#.####.##.#', // 02: 1, 6, 9
  '#......##.#', // 03: 1..6, 9
  '#.####.##.#', // 04: 1, 6, 9
  '#......... ', // 05: 1..10 (crosses center)
  ' .....#....', // 06: Upper Jungle Warp Tunnel! (0..5, 7..10)
  '#####.#.###', // 07: 5, 7
  '#####.#.###', // 08: 5, 7
  '#####.     ', // 09: Ghost house top
  '#####.# ##-', // 10
  '#####.# #GG', // 11
  '#.....# #GG', // 12
  '#.###.# ###', // 13
  '#.....     ', // 14: Ghost house bottom
  '#.###.#.###', // 15: 1, 5, 7
  '#.....#....', // 16: 1..5, 7..10
  '#####.#.###', // 17: 5, 7
  ' .....#....', // 18: Lower Jungle Warp Tunnel! (0..5, 7..10)
  '#.###.#.###', // 19 -> Wait col 1 closed at row 17, open at row 18 (tunnel), open at row 19 -> connects cleanly!
  '#o........ ', // 20: Pac-Man spawn at (11, 20.5)
  '#.###.###.#', // 21: 1, 5, 9
  '#.....#...#', // 22: 1..5, 7..9 -> Wait row 21 col 7 is '#', row 23 col 7 is open!
  '#..........', // 23: 1..10
  '###########', // 24
];
JUNGLY_LEFT[22] = '#.#####.#.#';
// Fix row 21-22 cleanly:
JUNGLY_LEFT[21] = '#.###.###.#';
JUNGLY_LEFT[22] = '#.###.###.#';

const WORLD_THEMES: PacManiaWorldTheme[] = [
  {
    id: 0,
    name: 'Block Town',
    subtitle: 'Toy Brick Metropolis',
    style: 'lego',
    skyTop: '#0B1228',
    skyBottom: '#172554',
    floorA: '#E2E8F0',
    floorB: '#CBD5E1',
    floorBorder: '#94A3B8',
    blockTopColors: ['#F43F5E', '#3B82F6', '#FACC15', '#22C55E'],
    blockFrontColors: ['#BE123C', '#1D4ED8', '#CA8A04', '#15803D'],
    blockSideColors: ['#9F1239', '#1E40AF', '#A16207', '#166534'],
    pelletColor: '#FFF7D6',
    gateColor: '#F472B6',
    accentHex: '#EC4899',
  },
  {
    id: 1,
    name: "Pac-Man's Park",
    subtitle: 'Emerald Garden Maze',
    style: 'park',
    skyTop: '#071B18',
    skyBottom: '#134E4A',
    floorA: '#BBF7D0',
    floorB: '#86EFAC',
    floorBorder: '#4ADE80',
    blockTopColors: ['#FB7185', '#F97316', '#38BDF8', '#A855F7'],
    blockFrontColors: ['#E11D48', '#C2410C', '#0284C7', '#7E22CE'],
    blockSideColors: ['#9F1239', '#9A3412', '#0369A1', '#6B21A8'],
    pelletColor: '#FFFBEB',
    gateColor: '#FDE047',
    accentHex: '#10B981',
  },
  {
    id: 2,
    name: 'Sandbox Land',
    subtitle: 'Sunlit Pyramid Dunes',
    style: 'sandbox',
    skyTop: '#1E1108',
    skyBottom: '#451A03',
    floorA: '#FDE68A',
    floorB: '#FCD34D',
    floorBorder: '#F59E0B',
    blockTopColors: ['#FB923C', '#F87171', '#EAB308', '#38BDF8'],
    blockFrontColors: ['#C2410C', '#B91C1C', '#A16207', '#0284C7'],
    blockSideColors: ['#9A3412', '#991B1B', '#854D0E', '#0369A1'],
    pelletColor: '#FFFFFF',
    gateColor: '#38BDF8',
    accentHex: '#F59E0B',
  },
  {
    id: 3,
    name: 'Jungly Steps',
    subtitle: 'Terraced Temple Ruins',
    style: 'jungle',
    skyTop: '#061A12',
    skyBottom: '#064E3B',
    floorA: '#6EE7B7',
    floorB: '#34D399',
    floorBorder: '#059669',
    blockTopColors: ['#10B981', '#F59E0B', '#06B6D4', '#EC4899'],
    blockFrontColors: ['#047857', '#B45309', '#0E7490', '#BE185D'],
    blockSideColors: ['#065F46', '#92400E', '#155E75', '#9D174D'],
    pelletColor: '#FEF9C3',
    gateColor: '#F472B6',
    accentHex: '#06B6D4',
  },
];

function buildWorld(
  id: number,
  leftHalf: string[],
  tunnelRows: number[]
): PacManiaWorldDef {
  const grid = mirrorRows(leftHalf);
  let totalPellets = 0;
  for (let r = 0; r < PM_GRID_ROWS; r++) {
    for (let c = 0; c < PM_GRID_COLS; c++) {
      if (grid[r][c] === '.' || grid[r][c] === 'o') totalPellets++;
    }
  }
  return {
    id,
    theme: WORLD_THEMES[id],
    grid,
    tunnelRows,
    totalPellets,
    playerSpawn: { x: 11, y: 20.5 },
    ghostHouseDoor: { x: 11, y: 9.5 },
    ghostHouseCenter: { x: 11, y: 11.5 },
    specialSpawn: { x: 11, y: 14.5 },
  };
}

export const PACMANIA_WORLDS: PacManiaWorldDef[] = [
  buildWorld(0, BLOCK_TOWN_LEFT, [12]),
  buildWorld(1, PARK_LEFT, [6, 16]),
  buildWorld(2, SANDBOX_FINAL, [12]),
  buildWorld(3, JUNGLY_LEFT, [6, 18]),
];

export function clonePacManiaGrid(grid: PacManiaTileType[][]): PacManiaTileType[][] {
  return grid.map((row) => [...row]);
}

export function isPMWalkableForPlayer(
  grid: PacManiaTileType[][],
  col: number,
  row: number,
  tunnelRows: number[]
): boolean {
  if (row < 0 || row >= PM_GRID_ROWS) return false;
  if (col < 0 || col >= PM_GRID_COLS) return tunnelRows.includes(row);
  const t = grid[row][col];
  return t !== '#' && t !== '-' && t !== 'G';
}

export function isPMWalkableForGhost(
  grid: PacManiaTileType[][],
  col: number,
  row: number,
  tunnelRows: number[],
  allowHouseGate: boolean
): boolean {
  if (row < 0 || row >= PM_GRID_ROWS) return false;
  if (col < 0 || col >= PM_GRID_COLS) return tunnelRows.includes(row);
  const t = grid[row][col];
  if (t === '#') return false;
  if (t === '-' || t === 'G') return allowHouseGate;
  return true;
}

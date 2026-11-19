import { GRID_COLS, GRID_ROWS, MazeDefinition, MazeTheme, TileType } from './types';

function mirrorHalfRows(leftHalfRows: string[]): TileType[][] {
  if (leftHalfRows.length !== GRID_ROWS) {
    throw new Error(`Expected ${GRID_ROWS} rows, got ${leftHalfRows.length}`);
  }
  return leftHalfRows.map((left, rIdx) => {
    if (left.length !== GRID_COLS / 2) {
      throw new Error(`Row ${rIdx} expected length 14, got ${left.length}: "${left}"`);
    }
    const right = left.split('').reverse().join('');
    return (left + right).split('') as TileType[];
  });
}

function buildMaze(id: number, theme: MazeTheme, leftHalfRows: string[], tunnelRows: number[]): MazeDefinition {
  const grid = mirrorHalfRows(leftHalfRows);
  let totalPellets = 0;
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (grid[r][c] === '.' || grid[r][c] === 'o') {
        totalPellets++;
      }
    }
  }
  return {
    id,
    theme,
    grid,
    tunnelRows,
    totalPellets,
    playerSpawn: { x: 14, y: 23.5 },
    ghostHouseDoor: { x: 14, y: 11.5 },
    ghostHouseCenter: { x: 14, y: 14.5 },
  };
}

// Maze 1: Classic Rose / Pink Ms. Pac-Man — Dual Tunnels (Rows 9 & 18)
const MAZE_1_LEFT: string[] = [
  '##############', // 00
  '#.....#......#', // 01
  '#.###.#.####.#', // 02
  '#o###.#.####.#', // 03
  '#.............', // 04
  '#.###.#.####.#', // 05
  '#...#.#......#', // 06
  '###.#.###.####', // 07
  '###.#.###.####', // 08
  '   ...###.####', // 09 - Upper warp tunnel
  '#####.###.####', // 10
  '#####....     ', // 11
  '#####.### ###-', // 12 - Ghost house door
  '#####.### #GGG', // 13
  '#####.### #GGG', // 14
  '#####.### #GGG', // 15
  '#####.### ####', // 16
  '#####....     ', // 17
  '   ...###.####', // 18 - Lower warp tunnel
  '###.#.###.####', // 19
  '#...#........#', // 20
  '#.###.###.##.#', // 21
  '#o..#.###.##.#', // 22
  '###.#.#.....  ', // 23 - Ms. Pac-Man spawn
  '#...#.#.####.#', // 24
  '#.###.#.####.#', // 25
  '#.....#......#', // 26
  '#.#######.##.#', // 27
  '#.#######.##.#', // 28
  '#.............', // 29
  '##############', // 30
];

// Maze 2: Electric Cyan Ms. Pac-Man — High & Low Dual Tunnels (Rows 5 & 22)
const MAZE_2_LEFT: string[] = [
  '##############', // 00
  '#.............', // 01
  '#.###.#####.##', // 02
  '#o###.#####.##', // 03
  '#.....#......#', // 04
  '   ...#.####.#', // 05 - High warp tunnel
  '###.#.#......#', // 06
  '#...#.#.###.##', // 07
  '#.###.#.###.##', // 08
  '#.....#.....##', // 09
  '#.###.###.####', // 10
  '#...#....     ', // 11
  '###.#.### ###-', // 12 - Ghost house door
  '###.#.### #GGG', // 13
  '#...#.... #GGG', // 14
  '#.###.### #GGG', // 15
  '#.###.### ####', // 16
  '#........     ', // 17
  '#.###.###.##.#', // 18
  '#...#.#...##.#', // 19
  '###.#.#.####.#', // 20
  '###...#......#', // 21
  '   ...###.##.#', // 22 - Low warp tunnel
  '#####.#.....  ', // 23 - Ms. Pac-Man spawn
  '#.....#.####.#', // 24
  '#o###.#.####.#', // 25
  '#...#.#......#', // 26
  '###.#.###.####', // 27
  '#...#.....####', // 28
  '#.............', // 29
  '##############', // 30
];

// Maze 3: Warm Amber / Terracotta Ms. Pac-Man — Classic Single Central Tunnel (Row 14)
const MAZE_3_LEFT: string[] = [
  '##############', // 00
  '#............#', // 01
  '#.####.#####.#', // 02
  '#o####.#####.#', // 03
  '#....#.......#', // 04
  '####.#.#####.#', // 05
  '#....#........', // 06
  '#.####.##.####', // 07
  '#......##.####', // 08
  '#.####.##.####', // 09
  '#....#.##.####', // 10
  '####.#...     ', // 11
  '####.#.## ###-', // 12 - Ghost house door
  '####.#.## #GGG', // 13
  '    ..... #GGG', // 14 - Center warp tunnel
  '####.#.## #GGG', // 15
  '####.#.## ####', // 16
  '####.#...     ', // 17
  '#....#.##.####', // 18
  '#.####.##.####', // 19
  '#............#', // 20
  '#.####.#####.#', // 21
  '#o..##.#####.#', // 22
  '###.#.......  ', // 23 - Ms. Pac-Man spawn
  '#...#.#.####.#', // 24
  '#.###.#.####.#', // 25
  '#.....#......#', // 26
  '#.###.###.##.#', // 27
  '#.###.###.##.#', // 28
  '#.............', // 29
  '##############', // 30
];

// Maze 4: Royal Cobalt Ms. Pac-Man — Twin Express Lanes (Rows 11 & 17)
const MAZE_4_LEFT: string[] = [
  '##############', // 00
  '#.....#.......', // 01
  '#.###.#.####.#', // 02
  '#o###.#.####.#', // 03
  '#.....#......#', // 04
  '#.###.######.#', // 05
  '#...#........#', // 06
  '###.#.###.##.#', // 07
  '#...#.#...##.#', // 08
  '#.###.#.####.#', // 09
  '#.....#......#', // 10
  '   ......     ', // 11 - Upper express tunnel
  '###.#.### ###-', // 12 - Ghost house door
  '###.#.### #GGG', // 13
  '###.#.... #GGG', // 14
  '###.#.### #GGG', // 15
  '###.#.### ####', // 16
  '   ......     ', // 17 - Lower express tunnel
  '###.#.###.####', // 18
  '#...#........#', // 19
  '#.###.###.##.#', // 20
  '#.....###.##.#', // 21
  '#.###.###.##.#', // 22
  '#o..#.......  ', // 23 - Ms. Pac-Man spawn
  '###.#.##.###.#', // 24
  '#...#.##.###.#', // 25
  '#.###.##.###.#', // 26
  '#............#', // 27
  '#.#######.##.#', // 28
  '#.............', // 29
  '##############', // 30
];

export const MAZES: MazeDefinition[] = [
  buildMaze(
    0,
    {
      name: 'Rose Arcade',
      subtitle: 'Maze 1 · Dual Tunnels',
      wallOuter: '#FF8BA7',
      wallInner: '#4F1228',
      wallHighlight: '#FFD6E0',
      wallGlow: 'rgba(255, 110, 150, 0.42)',
      floorTint: '#09060E',
      pelletColor: '#FFF0D4',
      pelletGlow: 'rgba(255, 224, 178, 0.55)',
      gateColor: '#FFCAE0',
      accentHex: '#FF8BA7',
    },
    MAZE_1_LEFT,
    [9, 18]
  ),
  buildMaze(
    1,
    {
      name: 'Azure Drift',
      subtitle: 'Maze 2 · High & Low Warps',
      wallOuter: '#4CE0FF',
      wallInner: '#0C2D54',
      wallHighlight: '#CCF6FF',
      wallGlow: 'rgba(56, 214, 255, 0.42)',
      floorTint: '#060A13',
      pelletColor: '#FFF4CC',
      pelletGlow: 'rgba(255, 232, 160, 0.55)',
      gateColor: '#FFA8D6',
      accentHex: '#4CE0FF',
    },
    MAZE_2_LEFT,
    [5, 22]
  ),
  buildMaze(
    2,
    {
      name: 'Amber Hearth',
      subtitle: 'Maze 3 · Central Crossing',
      wallOuter: '#FF9E44',
      wallInner: '#4D1F0B',
      wallHighlight: '#FFE0BA',
      wallGlow: 'rgba(255, 148, 56, 0.42)',
      floorTint: '#0C0806',
      pelletColor: '#FFF3DA',
      pelletGlow: 'rgba(255, 224, 170, 0.55)',
      gateColor: '#FFD0EC',
      accentHex: '#FF9E44',
    },
    MAZE_3_LEFT,
    [14]
  ),
  buildMaze(
    3,
    {
      name: 'Cobalt Express',
      subtitle: 'Maze 4 · Twin Express Lanes',
      wallOuter: '#6D96FF',
      wallInner: '#12215B',
      wallHighlight: '#D4E1FF',
      wallGlow: 'rgba(96, 142, 255, 0.45)',
      floorTint: '#060814',
      pelletColor: '#FFF1D0',
      pelletGlow: 'rgba(255, 226, 165, 0.55)',
      gateColor: '#FFAED8',
      accentHex: '#6D96FF',
    },
    MAZE_4_LEFT,
    [11, 17]
  ),
];

/**
 * Authentic Ms. Pac-Man maze rotation schedule:
 * Levels 1–2: Maze 1
 * Levels 3–5: Maze 2
 * Levels 6–9: Maze 3
 * Levels 10–13: Maze 4
 * Levels 14+: Alternates Maze 3 and Maze 4 every 4 levels (with Maze 1/2 cycling cleanly on marathon runs)
 */
export function getMazeIndexForLevel(level: number): number {
  if (level <= 2) return 0;
  if (level <= 5) return 1;
  if (level <= 9) return 2;
  if (level <= 13) return 3;
  return ((Math.floor((level - 14) / 4)) % 4);
}

export function cloneMazeGrid(maze: MazeDefinition): TileType[][] {
  return maze.grid.map((row) => [...row]);
}

export function isWallTile(grid: TileType[][], col: number, row: number): boolean {
  if (row < 0 || row >= GRID_ROWS) return true;
  if (col < 0 || col >= GRID_COLS) return false; // tunnel wrap void is walkable
  return grid[row][col] === '#';
}

export function isWalkableForPlayer(grid: TileType[][], col: number, row: number): boolean {
  if (row < 0 || row >= GRID_ROWS) return false;
  if (col < 0 || col >= GRID_COLS) return true; // tunnel wrap
  const t = grid[row][col];
  return t !== '#' && t !== '-' && t !== 'G';
}

export function isWalkableForGhost(
  grid: TileType[][],
  col: number,
  row: number,
  canUseGate: boolean
): boolean {
  if (row < 0 || row >= GRID_ROWS) return false;
  if (col < 0 || col >= GRID_COLS) return true; // tunnel wrap
  const t = grid[row][col];
  if (t === '#') return false;
  if (t === '-' || t === 'G') return canUseGate;
  return true;
}

import {
  JR_GRID_COLS,
  JR_GRID_ROWS,
  JrMazeDefinition,
  JrTileType,
} from './jrTypes';
import { MazeTheme } from './types';

function mirrorHalfRows56(leftHalfRows: string[]): JrTileType[][] {
  if (leftHalfRows.length !== JR_GRID_ROWS) {
    throw new Error(`Expected ${JR_GRID_ROWS} rows, got ${leftHalfRows.length}`);
  }
  return leftHalfRows.map((left, rIdx) => {
    if (left.length !== JR_GRID_COLS / 2) {
      throw new Error(`Row ${rIdx} expected length 28, got ${left.length}: "${left}"`);
    }
    const right = left.split('').reverse().join('');
    return (left + right).split('') as JrTileType[];
  });
}

function buildJrMaze(
  id: number,
  theme: MazeTheme,
  leftHalfRows: string[]
): JrMazeDefinition {
  const grid = mirrorHalfRows56(leftHalfRows);
  let totalPellets = 0;
  let totalEnergizers = 0;
  for (let r = 0; r < JR_GRID_ROWS; r++) {
    for (let c = 0; c < JR_GRID_COLS; c++) {
      if (grid[r][c] === '.' || grid[r][c] === 'o' || grid[r][c] === 'M') {
        totalPellets++;
      }
      if (grid[r][c] === 'o') {
        totalEnergizers++;
      }
    }
  }
  return {
    id,
    theme,
    grid,
    totalPellets,
    totalEnergizers,
    playerSpawn: { x: 28, y: 23.5 },
    ghostHouseDoor: { x: 28, y: 11.5 },
    ghostHouseCenter: { x: 28, y: 14.5 },
  };
}

const VERIFIED_JR_MAZES: Array<{ theme: MazeTheme; leftHalf: string[] }> = [
  {
    theme: {
      name: 'Neon Jade',
      subtitle: 'Maze 1 · Wide Emerald Labyrinth',
      wallOuter: '#34F5A6',
      wallInner: '#0A3B2B',
      wallHighlight: '#C9FFE7',
      wallGlow: 'rgba(52, 245, 166, 0.42)',
      floorTint: '#050C0A',
      pelletColor: '#FFF2D6',
      pelletGlow: 'rgba(255, 228, 174, 0.55)',
      gateColor: '#FFAED8',
      accentHex: '#34F5A6',
    },
    leftHalf: [
      '############################', // 00
      '#.......#..........#.......#', // 01
      '#.#####.#.########.#.#####.#', // 02
      '#o#####.#.########.#.#####.#', // 03 (E1)
      '#...........................', // 04
      '#.###.###.##.###.##.###.##.#', // 05
      '#...#.#...##.###.##...#.##.#', // 06
      '###.#.#.####.###.####.#.##.#', // 07
      '#...#.#......###......#....#', // 08
      '#.###.######.###.######.####', // 09
      '#.....#......###......#.####', // 10
      '#.###.#.####.###.####..     ', // 11
      '#.###.#.####.###.####.# ###-', // 12
      '#.....#......###......# #GGG', // 13
      '#.###.######.###.####.# #GGG', // 14
      '#o###.######.###.####.# #GGG', // 15 (E2)
      '#.....#......###......# ####', // 16
      '#.###.#.####.###.####..     ', // 17
      '#.###.#.####.###.####.#.####', // 18
      '#.....#......###......#....#', // 19
      '###.###.####.###.####.#.##.#', // 20
      '#...#...#....###...##.#.##.#', // 21
      '#.###.###.########.##.#.##.#', // 22
      '#.....#...########.##.....  ', // 23
      '#.###.#.###......#.##.####.#', // 24
      '#o###.#.###.####.#.##.####.#', // 25 (E3)
      '#.....#.....####.#.........#', // 26
      '#.#########.##...#.#######.#', // 27
      '#.#########.##.###.#######.#', // 28
      '#...........................', // 29
      '############################', // 30
    ],
  },
  {
    theme: {
      name: 'Crimson Arcade',
      subtitle: 'Maze 2 · Scarlet Corridors',
      wallOuter: '#FF5C7C',
      wallInner: '#4A0F20',
      wallHighlight: '#FFD1DC',
      wallGlow: 'rgba(255, 92, 124, 0.44)',
      floorTint: '#0D0508',
      pelletColor: '#FFF3DA',
      pelletGlow: 'rgba(255, 226, 170, 0.55)',
      gateColor: '#93F5FF',
      accentHex: '#FF5C7C',
    },
    leftHalf: [
      '############################', // 00
      '#...........................', // 01
      '#.####.#####.###.#####.###.#', // 02
      '#o####.#####.###.#####.###.#', // 03 (E1)
      '#......#.....###.....#.....#', // 04
      '#.####.#.###.###.###.#.###.#', // 05
      '#.#....#.#...###...#.#.....#', // 06
      '#.#.####.#.#######.#.###.###', // 07
      '#...#....#.........#...#.###', // 08
      '###.#.####.#######.###.#.###', // 09
      '#...#......#.....#.....#.###', // 10
      '#.########.#.###.#.####     ', // 11
      '#........#.#.###.#.#### ###-', // 12
      '#.######.#.#.###.#.#### #GGG', // 13
      '#........#.......#..... #GGG', // 14
      '#.######.#.#####.#.#### #GGG', // 15
      '#........#.#o..#.#.#### ####', // 16 (E2)
      '#.########.#.#.#.#.####     ', // 17
      '#..........#.#.#.#.....#.###', // 18
      '#.####.#####.#.#.#####.#.###', // 19
      '#.#....#.....#.#.....#.#...#', // 20
      '#.#.####.#####.#####.#.###.#', // 21
      '#...#....#.........#...###.#', // 22
      '###.#.####.#######.###....  ', // 23
      '#...#......#.....#...#.###.#', // 24
      '#o########.#.###.#.#.#.###.#', // 25 (E3)
      '#..........#.###.#.#.#.....#', // 26
      '#.##########.###.#.#.#####.#', // 27
      '#.##########.###.#.#.#####.#', // 28
      '#...........................', // 29
      '############################', // 30
    ],
  },
  {
    theme: {
      name: 'Electric Violet',
      subtitle: 'Maze 3 · Orchid Speedway',
      wallOuter: '#BE82FF',
      wallInner: '#2B1154',
      wallHighlight: '#EDD9FF',
      wallGlow: 'rgba(190, 130, 255, 0.45)',
      floorTint: '#080512',
      pelletColor: '#FFF5CC',
      pelletGlow: 'rgba(255, 232, 160, 0.55)',
      gateColor: '#7EF5FF',
      accentHex: '#BE82FF',
    },
    leftHalf: [
      '############################', // 00
      '#.....#........#...........#', // 01
      '#.###.#.######.#.#########.#', // 02
      '#o###.#.######.#.#########.#', // 03 (E1)
      '#.....#........#...........#', // 04
      '#.###.########.#.#####.###.#', // 05
      '#.#...#......#.#.#.....#...#', // 06
      '#.#.###.####.#.#.#.#####.###', // 07
      '#.#.....####.#...#.#.....###', // 08
      '#.##########.#####.#.###.###', // 09
      '#............#.....#.#...###', // 10
      '#.###.######.#.###.#.#.     ', // 11
      '#.###.#......#...#.#.#. ###-', // 12
      '#.....#.####.#.#.#.#.#. #GGG', // 13
      '#.###.#..o...#.#.#...#. #GGG', // 14 (E2)
      '#.###.#.####.#.#.#####. #GGG', // 15
      '#.....#......#.#....... ####', // 16
      '#.###.########.#.#####.     ', // 17
      '#.#...#........#.....#.#.###', // 18
      '#.#.###.############.#.#.###', // 19
      '#.#.....#..........#.#.#...#', // 20
      '#.#####.#.#.######.#.#.###.#', // 21
      '#.....#.#.#......#.#...###.#', // 22
      '#.###.#.#.#.####.#.###....  ', // 23
      '#.#...#...#.####.#...#.###.#', // 24
      '#o#.#####.#......#.#.#.###.#', // 25 (E3)
      '#.#.......########.#.#.....#', // 26
      '#.#######..........#.#####.#', // 27
      '#.#######.##########.#####.#', // 28
      '#...........................', // 29
      '############################', // 30
    ],
  },
  {
    theme: {
      name: 'Solar Gold',
      subtitle: 'Maze 4 · Grand Championship',
      wallOuter: '#FFC44D',
      wallInner: '#4A2906',
      wallHighlight: '#FFF0C2',
      wallGlow: 'rgba(255, 196, 77, 0.45)',
      floorTint: '#0C0803',
      pelletColor: '#FFF6E0',
      pelletGlow: 'rgba(255, 232, 180, 0.55)',
      gateColor: '#FF8FD4',
      accentHex: '#FFC44D',
    },
    leftHalf: [
      '############################', // 00
      '#..........#...............#', // 01
      '#.########.#.#############.#', // 02
      '#o########.#.#############.#', // 03 (E1)
      '#...........................', // 04
      '#.###.####.###.####.######.#', // 05
      '#...#.#....#...#....#......#', // 06
      '###.#.#.##.#.###.##.#.####.#', // 07
      '#...#.#.##.#.....##.#....#.#', // 08
      '#.###.#.##.########.####.#.#', // 09
      '#.....#...........#......#.#', // 10
      '#.########.#.####.#.###     ', // 11
      '#.########.#.####.#.### ###-', // 12
      '#..........#........... #GGG', // 13
      '#.########.########.##. #GGG', // 14
      '#.###o.....#......#.#.. #GGG', // 15 (E2)
      '#.....####.#.####.#.#.# ####', // 16
      '#.###.####.#.####.#.#..     ', // 17
      '#.###.............#.####.###', // 18
      '#.....####.########.###....#', // 19
      '#.###.####..........###.##.#', // 20
      '#.#...#....########.....##.#', // 21
      '#.#.###.##.########.###.##.#', // 22
      '#...#...##..........###...  ', // 23
      '###.#.####.########.###.##.#', // 24
      '#o..#......#......#.....##.#', // 25 (E3)
      '#.########.#.####.#.######.#', // 26
      '#..........#.####.#........#', // 27
      '#.##########.####.########.#', // 28
      '#...........................', // 29
      '############################', // 30
    ],
  },
];

export const JR_MAZES: JrMazeDefinition[] = VERIFIED_JR_MAZES.map((m, idx) =>
  buildJrMaze(idx, m.theme, m.leftHalf)
);

export function getJrMazeIndexForLevel(level: number): number {
  if (level <= 2) return 0;
  if (level <= 4) return 1;
  if (level <= 6) return 2;
  return (Math.floor((level - 7) / 2) + 3) % JR_MAZES.length;
}

export function cloneJrMazeGrid(maze: JrMazeDefinition): JrTileType[][] {
  return maze.grid.map((row) => [...row]);
}

export function isJrWallTile(grid: JrTileType[][], col: number, row: number): boolean {
  if (row < 0 || row >= JR_GRID_ROWS || col < 0 || col >= JR_GRID_COLS) return true;
  return grid[row][col] === '#';
}

export function isJrWalkableForPlayer(grid: JrTileType[][], col: number, row: number): boolean {
  if (row < 0 || row >= JR_GRID_ROWS || col < 0 || col >= JR_GRID_COLS) return false;
  const t = grid[row][col];
  return t !== '#' && t !== '-' && t !== 'G';
}

export function isJrWalkableForGhost(
  grid: JrTileType[][],
  col: number,
  row: number,
  canUseGate: boolean
): boolean {
  if (row < 0 || row >= JR_GRID_ROWS || col < 0 || col >= JR_GRID_COLS) return false;
  const t = grid[row][col];
  if (t === '#') return false;
  if (t === '-' || t === 'G') return canUseGate;
  return true;
}

import { GRID_COLS, GRID_ROWS, MazeDefinition, TileType } from './types';

function mirrorHalfRows(leftHalfRows: string[]): TileType[][] {
  return leftHalfRows.map((left) => {
    const right = left.split('').reverse().join('');
    return (left + right).split('') as TileType[];
  });
}

// Authentic 1980 Classic Pac-Man 28x31 Maze (cobalt blue neon double walls, single Row 14 warp tunnel)
const CLASSIC_LEFT_VERIFIED: string[] = [
  '##############', // 00
  '#............#', // 01: 1..12
  '#.####.#####.#', // 02: 1, 6, 12
  '#o####.#####.#', // 03: 1(o), 6, 12
  '#.####.#####.#', // 04: 1, 6, 12
  '#.............', // 05: 1..13 (crosses center)
  '#.####.##.####', // 06: 1, 6, 9
  '#.####.##.####', // 07: 1, 6, 9
  '#......##....#', // 08: 1..6, 9..12
  '######.##.##.#', // 09: 6, 9, 12
  '######.##.##.#', // 10: 6, 9, 12
  '######.       ', // 11: 6 '.', 7..13 ' '
  '######.## ###-', // 12: 6 '.', 9 ' ', 10..12 '#', 13 '-'
  '######.## #GGG', // 13: 6 '.', 9 ' ', 10 '#', 11..13 'G'
  '      ... #GGG', // 14: Classic Row 14 single warp tunnel! (0..5 ' ', 6..8 '.', 9 ' ', 10 '#', 11..13 'G')
  '######.## #GGG', // 15
  '######.## ####', // 16
  '######.       ', // 17: 6 '.', 7..13 ' '
  '######.##.####', // 18: 6, 9
  '######.##.####', // 19: 6, 9
  '#............#', // 20: 1..12
  '#.####.#####.#', // 21: 1, 6, 12
  '#.####.#####.#', // 22: 1, 6, 12
  '#o..##......  ', // 23: 1(o)..3, 6..11 '.', 12..13 ' ' (Pac-Man spawn!)
  '###.##.##.####', // 24: 3, 6, 9
  '###.##.##.####', // 25: 3, 6, 9
  '#......##....#', // 26: 1..6, 9..12
  '#.##########.#', // 27: 1, 12
  '#.##########.#', // 28: 1, 12
  '#.............', // 29: 1..13 (classic long bottom straightaway!)
  '##############', // 30
];

function buildClassicMaze(): MazeDefinition {
  const grid = mirrorHalfRows(CLASSIC_LEFT_VERIFIED);
  let totalPellets = 0;
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (grid[r][c] === '.' || grid[r][c] === 'o') totalPellets++;
    }
  }
  return {
    id: 100,
    theme: {
      name: 'Classic 1980',
      subtitle: 'Original Cobalt Maze',
      wallOuter: '#3B82F6',
      wallInner: '#0C1B4D',
      wallHighlight: '#BFDBFE',
      wallGlow: 'rgba(59, 130, 246, 0.48)',
      floorTint: '#050816',
      pelletColor: '#FFE8C2',
      pelletGlow: 'rgba(255, 224, 168, 0.55)',
      gateColor: '#FFA6D6',
      accentHex: '#3B82F6',
    },
    grid,
    tunnelRows: [14],
    totalPellets,
    playerSpawn: { x: 14, y: 23.5 },
    ghostHouseDoor: { x: 14, y: 11.5 },
    ghostHouseCenter: { x: 14, y: 14.5 },
  };
}

export const CLASSIC_MAZE: MazeDefinition = buildClassicMaze();

export type GameId = 'classic' | 'plus' | 'ms' | 'super' | 'jr' | 'pacmania';

export interface CabinetMeta {
  id: GameId;
  title: string;
  year: number;
  tagline: string;
  accentHex: string;
  storageKey: string;
}

export const CABINET_LIST: CabinetMeta[] = [
  {
    id: 'classic',
    title: 'Pac-Man',
    year: 1980,
    tagline: 'Original Cobalt Maze · Classic 4 Ghosts · Center Bonuses',
    accentHex: '#3B82F6',
    storageKey: 'classic_pacman_hd_highscore_v1',
  },
  {
    id: 'plus',
    title: 'Pac-Man Plus',
    year: 1982,
    tagline: 'Green Neon Maze · Invisible Wildcards · Bonus Power-Ups',
    accentHex: '#10B981',
    storageKey: 'pacman_plus_hd_highscore_v1',
  },
  {
    id: 'ms',
    title: 'Ms. Pac-Man',
    year: 1982,
    tagline: '4 Classic Mazes · Dual Warp Tunnels · Roaming Fruits',
    accentHex: '#FBBF24',
    storageKey: 'ms_pacman_hd_highscore_v1',
  },
  {
    id: 'super',
    title: 'Super Pac-Man',
    year: 1982,
    tagline: 'Keys & Locked Vaults · Giant Super Mode · Turbo Dash',
    accentHex: '#22C55E',
    storageKey: 'super_pacman_hd_highscore_v1',
  },
  {
    id: 'jr',
    title: 'Jr. Pac-Man',
    year: 1983,
    tagline: '2× Wide Scrolling Mazes · Mutating Dots · 6 Energizers',
    accentHex: '#14B8A6',
    storageKey: 'jr_pacman_hd_highscore_v1',
  },
  {
    id: 'pacmania',
    title: 'Pac-Mania',
    year: 1987,
    tagline: 'Isometric 3D Worlds · Jump Over Ghosts · Funky & Spunky',
    accentHex: '#EC4899',
    storageKey: 'pacmania_hd_highscore_v1',
  },
];

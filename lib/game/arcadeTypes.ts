export type PacManGameId = 'classic' | 'plus' | 'ms' | 'super' | 'jr' | 'pacmania';

export type ClassicArcadeGameId =
  | 'centipede'
  | 'millipede'
  | 'digdug'
  | 'boulderdash'
  | 'invaders'
  | 'invaders2'
  | 'foodfight';

export type GameId = PacManGameId | ClassicArcadeGameId;

export type CabinetCategory = 'pacman' | 'classic-arcade';

export interface CabinetMeta {
  id: GameId;
  title: string;
  year: number;
  category: CabinetCategory;
  tagline: string;
  accentHex: string;
  storageKey: string;
}

export const CABINET_LIST: CabinetMeta[] = [
  {
    id: 'classic',
    title: 'Pac-Man',
    year: 1980,
    category: 'pacman',
    tagline: 'Original Cobalt Maze · Classic 4 Ghosts · Center Bonuses',
    accentHex: '#3B82F6',
    storageKey: 'classic_pacman_hd_highscore_v1',
  },
  {
    id: 'plus',
    title: 'Pac-Man Plus',
    year: 1982,
    category: 'pacman',
    tagline: 'Emerald Maze · Invisible Wildcards · 2× Bonus Power-Ups',
    accentHex: '#10B981',
    storageKey: 'pacman_plus_hd_highscore_v1',
  },
  {
    id: 'ms',
    title: 'Ms. Pac-Man',
    year: 1982,
    category: 'pacman',
    tagline: '4 Classic Mazes · Dual Warp Tunnels · Roaming Fruits',
    accentHex: '#FBBF24',
    storageKey: 'ms_pacman_hd_highscore_v1',
  },
  {
    id: 'super',
    title: 'Super Pac-Man',
    year: 1982,
    category: 'pacman',
    tagline: 'Keys & Locked Vaults · Giant Super Mode · Turbo Dash',
    accentHex: '#22C55E',
    storageKey: 'super_pacman_hd_highscore_v1',
  },
  {
    id: 'jr',
    title: 'Jr. Pac-Man',
    year: 1983,
    category: 'pacman',
    tagline: '2× Wide Scrolling Mazes · Mutating Dots · 6 Energizers',
    accentHex: '#14B8A6',
    storageKey: 'jr_pacman_hd_highscore_v1',
  },
  {
    id: 'pacmania',
    title: 'Pac-Mania',
    year: 1987,
    category: 'pacman',
    tagline: 'Isometric 3D Worlds · Jump Over Ghosts · Funky & Spunky',
    accentHex: '#EC4899',
    storageKey: 'pacmania_hd_highscore_v1',
  },
  {
    id: 'centipede',
    title: 'Centipede',
    year: 1981,
    category: 'classic-arcade',
    tagline: 'Splitting Segments · Mushroom Field · Spiders, Fleas & Scorpions',
    accentHex: '#84CC16',
    storageKey: 'centipede_hd_highscore_v1',
  },
  {
    id: 'millipede',
    title: 'Millipede',
    year: 1982,
    category: 'classic-arcade',
    tagline: 'DDT Bomb Blasts · Inchworm Slow-Mo · Beetles & Swarm Waves',
    accentHex: '#F97316',
    storageKey: 'millipede_hd_highscore_v1',
  },
  {
    id: 'digdug',
    title: 'Dig Dug',
    year: 1982,
    category: 'classic-arcade',
    tagline: 'Carve Earth Tunnels · Pump Pooka & Fygar · Crush With Boulders',
    accentHex: '#38BDF8',
    storageKey: 'digdug_hd_highscore_v1',
  },
  {
    id: 'boulderdash',
    title: 'Boulder Dash',
    year: 1984,
    category: 'classic-arcade',
    tagline: '5 Underground Caves · Falling Rock Physics · Butterflies & Diamonds',
    accentHex: '#A855F7',
    storageKey: 'boulderdash_hd_highscore_v1',
  },
  {
    id: 'invaders',
    title: 'Space Invaders',
    year: 1978,
    category: 'classic-arcade',
    tagline: '55-Alien March · Destructible Bunkers · Mystery Red UFO',
    accentHex: '#4ADE80',
    storageKey: 'space_invaders_hd_highscore_v1',
  },
  {
    id: 'invaders2',
    title: 'Space Invaders II',
    year: 1979,
    category: 'classic-arcade',
    tagline: 'Splitting Invaders · Dropship Reinforcements · Rainbow Bonus',
    accentHex: '#06B6D4',
    storageKey: 'space_invaders2_hd_highscore_v1',
  },
  {
    id: 'foodfight',
    title: 'Food Fight',
    year: 1983,
    category: 'classic-arcade',
    tagline: 'Race For The Ice Cream Cone · Hurl Pies & Melons · 4 Pursuing Chefs',
    accentHex: '#FB7185',
    storageKey: 'foodfight_hd_highscore_v1',
  },
];

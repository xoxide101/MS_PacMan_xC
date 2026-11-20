export type PacManGameId = 'classic' | 'plus' | 'ms' | 'super' | 'jr' | 'pacmania';

export type ClassicArcadeGameId =
  | 'centipede'
  | 'millipede'
  | 'digdug'
  | 'boulderdash'
  | 'invaders'
  | 'invaders2'
  | 'foodfight'
  | 'gauntlet'
  | 'gauntlet2'
  | 'polepos'
  | 'polepos2'
  | 'sprint'
  | 'supersprint'
  | 'champsprint'
  | 'defender'
  | 'defender2'
  | 'stargate'
  | 'tempest'
  | 'tempest2000'
  | 'tempest3000'
  | 'mappy'
  | 'mariobros'
  | 'dkong'
  | 'dkongjr'
  | 'dkong3'
  | 'smb1'
  | 'smb2'
  | 'smb3'
  | 'sonic1'
  | 'sonic2'
  | 'sonic3';

export type GameId = PacManGameId | ClassicArcadeGameId;

export type CabinetCategory = 'platformers' | 'pacman' | 'shooters' | 'action' | 'racing';

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
  // Pac-Man Series (6)
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

  // Shooters & Vector Classics (10)
  {
    id: 'tempest',
    title: 'Tempest',
    year: 1981,
    category: 'shooters',
    tagline: '3D Vector Tube Webs · Superzapper · Flippers & Spikers',
    accentHex: '#3B82F6',
    storageKey: 'tempest_hd_highscore_v1',
  },
  {
    id: 'tempest2000',
    title: 'Tempest 2000',
    year: 1994,
    category: 'shooters',
    tagline: 'Psychedelic Webs · Jump Thruster · Particle Laser & AI Droid',
    accentHex: '#EC4899',
    storageKey: 'tempest2000_hd_highscore_v1',
  },
  {
    id: 'tempest3000',
    title: 'Tempest 3000',
    year: 2000,
    category: 'shooters',
    tagline: 'Prism Glass Tubes · Triple Laser · Dual Droids & Surge',
    accentHex: '#22D3EE',
    storageKey: 'tempest3000_hd_highscore_v1',
  },
  {
    id: 'defender',
    title: 'Defender',
    year: 1981,
    category: 'shooters',
    tagline: 'Wrap-Around Scanner · Rescue Humanoids · Smart Bombs',
    accentHex: '#F59E0B',
    storageKey: 'defender_hd_highscore_v1',
  },
  {
    id: 'defender2',
    title: 'Defender II',
    year: 1981,
    category: 'shooters',
    tagline: 'Inviso Cloak · Rescue Warp Gate · Firebombers & Mutants',
    accentHex: '#A855F7',
    storageKey: 'defender2_hd_highscore_v1',
  },
  {
    id: 'stargate',
    title: 'Stargate',
    year: 1981,
    category: 'shooters',
    tagline: 'Stargate Hyperspace Warp · Inviso Cloak · Elite Swarmers',
    accentHex: '#38BDF8',
    storageKey: 'stargate_hd_highscore_v1',
  },
  {
    id: 'centipede',
    title: 'Centipede',
    year: 1981,
    category: 'shooters',
    tagline: 'Splitting Segments · Mushroom Field · Spiders & Scorpions',
    accentHex: '#84CC16',
    storageKey: 'centipede_hd_highscore_v1',
  },
  {
    id: 'millipede',
    title: 'Millipede',
    year: 1982,
    category: 'shooters',
    tagline: 'DDT Bomb Blasts · Inchworm Slow-Mo · Beetles & Swarms',
    accentHex: '#F97316',
    storageKey: 'millipede_hd_highscore_v1',
  },
  {
    id: 'invaders',
    title: 'Space Invaders',
    year: 1978,
    category: 'shooters',
    tagline: '55-Alien March · Destructible Bunkers · Mystery Red UFO',
    accentHex: '#4ADE80',
    storageKey: 'space_invaders_hd_highscore_v1',
  },
  {
    id: 'invaders2',
    title: 'Space Invaders II',
    year: 1979,
    category: 'shooters',
    tagline: 'Splitting Invaders · Dropship Reinforcements · Rainbow Bonus',
    accentHex: '#06B6D4',
    storageKey: 'space_invaders2_hd_highscore_v1',
  },

  // Action & Dungeon Classics (6)
  {
    id: 'gauntlet',
    title: 'Gauntlet',
    year: 1985,
    category: 'action',
    tagline: '4 Hero Classes · Monster Generators · Potions & Death',
    accentHex: '#F59E0B',
    storageKey: 'gauntlet_hd_highscore_v1',
  },
  {
    id: 'gauntlet2',
    title: 'Gauntlet II',
    year: 1986,
    category: 'action',
    tagline: 'Fire Dragons · Acid Puddles · Ricochet Shots & Secret Rooms',
    accentHex: '#EF4444',
    storageKey: 'gauntlet2_hd_highscore_v1',
  },
  {
    id: 'mappy',
    title: 'Mappy',
    year: 1983,
    category: 'action',
    tagline: '6-Floor Mansion · Trampoline Bounces · Microwave Doors',
    accentHex: '#60A5FA',
    storageKey: 'mappy_hd_highscore_v1',
  },
  {
    id: 'digdug',
    title: 'Dig Dug',
    year: 1982,
    category: 'action',
    tagline: 'Carve Earth Tunnels · Pump Pooka & Fygar · Crush With Rocks',
    accentHex: '#38BDF8',
    storageKey: 'digdug_hd_highscore_v1',
  },
  {
    id: 'boulderdash',
    title: 'Boulder Dash',
    year: 1984,
    category: 'action',
    tagline: '5 Underground Caves · Falling Rock Physics · Butterflies',
    accentHex: '#A855F7',
    storageKey: 'boulderdash_hd_highscore_v1',
  },
  {
    id: 'foodfight',
    title: 'Food Fight',
    year: 1983,
    category: 'action',
    tagline: 'Race For The Ice Cream Cone · Hurl Pies & Melons · 4 Chefs',
    accentHex: '#FB7185',
    storageKey: 'foodfight_hd_highscore_v1',
  },

  // Arcade Racing Classics (5)
  {
    id: 'polepos',
    title: 'Pole Position',
    year: 1982,
    category: 'racing',
    tagline: '3D Fuji Speedway · Qualifying & Grand Prix · LO/HI Gears',
    accentHex: '#EF4444',
    storageKey: 'polepos_hd_highscore_v1',
  },
  {
    id: 'polepos2',
    title: 'Pole Position II',
    year: 1983,
    category: 'racing',
    tagline: '4 Grand Prix Circuits · Seaside & Suzuka · Turbo Slipstream',
    accentHex: '#38BDF8',
    storageKey: 'polepos2_hd_highscore_v1',
  },
  {
    id: 'sprint',
    title: 'Sprint 2',
    year: 1976,
    category: 'racing',
    tagline: 'Classic Overhead Drift Racer · Oil Slicks · Pure Circuits',
    accentHex: '#E2E8F0',
    storageKey: 'sprint_hd_highscore_v1',
  },
  {
    id: 'supersprint',
    title: 'Super Sprint',
    year: 1986,
    category: 'racing',
    tagline: 'Collectible Wrenches · Upgrades · Bridges & Mini-Tornadoes',
    accentHex: '#FACC15',
    storageKey: 'supersprint_hd_highscore_v1',
  },
  {
    id: 'champsprint',
    title: 'Championship Sprint',
    year: 1986,
    category: 'racing',
    tagline: 'Timed Shortcut Gates · Pro Circuits · Water & Oil Hazards',
    accentHex: '#4ADE80',
    storageKey: 'champsprint_hd_highscore_v1',
  },

  // Classic Platformers (10)
  {
    id: 'mariobros',
    title: 'Mario Bros.',
    year: 1983,
    category: 'platformers',
    tagline: 'Arcade Sewer Arena · Bump & Kick · POW Block & Coins',
    accentHex: '#EF4444',
    storageKey: 'mariobros_hd_highscore_v1',
  },
  {
    id: 'dkong',
    title: 'Donkey Kong',
    year: 1981,
    category: 'platformers',
    tagline: '4 Classic Stages · Barrels, Hammer, Elevators & Rivets',
    accentHex: '#F97316',
    storageKey: 'dkong_hd_highscore_v1',
  },
  {
    id: 'dkongjr',
    title: 'Donkey Kong Jr.',
    year: 1982,
    category: 'platformers',
    tagline: 'Dual-Vine Climbing · Fruit Drops · Free Papa Kong',
    accentHex: '#4ADE80',
    storageKey: 'dkongjr_hd_highscore_v1',
  },
  {
    id: 'dkong3',
    title: 'Donkey Kong 3',
    year: 1983,
    category: 'platformers',
    tagline: 'Greenhouse Bug Spray · Super Spray · Defend The Flowers',
    accentHex: '#A3E635',
    storageKey: 'dkong3_hd_highscore_v1',
  },
  {
    id: 'smb1',
    title: 'Super Mario Bros.',
    year: 1985,
    category: 'platformers',
    tagline: 'Mushroom Kingdom · Super Mushroom · Fire Flower & Bowser',
    accentHex: '#EF4444',
    storageKey: 'smb1_hd_highscore_v1',
  },
  {
    id: 'smb2',
    title: 'Super Mario Bros. 2',
    year: 1988,
    category: 'platformers',
    tagline: 'Subcon Dreamland · Pluck & Throw Veggies · 4 Heroes & Birdo',
    accentHex: '#EC4899',
    storageKey: 'smb2_hd_highscore_v1',
  },
  {
    id: 'smb3',
    title: 'Super Mario Bros. 3',
    year: 1988,
    category: 'platformers',
    tagline: 'Super Leaf Flight · P-Speed Meter · Tail Spin & Airships',
    accentHex: '#FACC15',
    storageKey: 'smb3_hd_highscore_v1',
  },
  {
    id: 'sonic1',
    title: 'Sonic the Hedgehog',
    year: 1991,
    category: 'platformers',
    tagline: 'Green Hill Loops · Golden Rings · Springs & Dr. Robotnik',
    accentHex: '#3B82F6',
    storageKey: 'sonic1_hd_highscore_v1',
  },
  {
    id: 'sonic2',
    title: 'Sonic the Hedgehog 2',
    year: 1992,
    category: 'platformers',
    tagline: 'Spin Dash · Tails Sidekick · Chemical Plant & Super Sonic',
    accentHex: '#38BDF8',
    storageKey: 'sonic2_hd_highscore_v1',
  },
  {
    id: 'sonic3',
    title: 'Sonic the Hedgehog 3',
    year: 1994,
    category: 'platformers',
    tagline: 'Elemental Shields · Sonic/Tails/Knuckles · Insta-Shield',
    accentHex: '#6366F1',
    storageKey: 'sonic3_hd_highscore_v1',
  },
];

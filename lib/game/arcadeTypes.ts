export type PacManGameId = 'classic' | 'plus' | 'ms' | 'super' | 'jr' | 'pacmania';

export type ClassicArcadeGameId =
  | 'centipede'
  | 'millipede'
  | 'digdug'
  | 'boulderdash'
  | 'invaders'
  | 'invaders2'
  | 'invadersdx'
  | 'foodfight'
  | 'gauntlet'
  | 'gauntlet2'
  | 'gauntletdl'
  | 'polepos'
  | 'polepos2'
  | 'sprint1'
  | 'sprint'
  | 'sprint4'
  | 'sprint8'
  | 'supersprint'
  | 'champsprint'
  | 'badlands'
  | 'superoffroad'
  | 'indyheat'
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
  | 'sonic3'
  | 'superbreakout'
  | 'arkanoid'
  | 'arkanoid2'
  | 'breakout2016evo'
  | 'asteroidsdeluxe'
  | 'spaceduel'
  | 'starcastle'
  | 'missilecommand'
  | 'qix'
  | 'superqix'
  | 'galaxian'
  | 'galaga'
  | 'phoenix'
  | 'gyruss'
  | 'scramble'
  | 'moonpatrol'
  | 'timepilot'
  | 'timepilot84'
  | 'timepilot2016evo'
  | 'ww1942'
  | 'ww1943'
  | 'starwars'
  | 'starwarsesb'
  | 'starwarsrotj'
  | 'berzerk'
  | 'robotron'
  | 'robotron2016evo'
  | 'frogger'
  | 'frogger2'
  | 'joust'
  | 'pengo'
  | 'popeye'
  | 'mrdo'
  | 'spyhunter'
  | 'spyhunter2'
  | 'tapper'
  | 'roottapper'
  | 'puzzlebobble'
  | 'puzzlebobble2'
  | 'puzzlebobble3'
  | 'crystalcastles'
  | 'rampage'
  | 'dragonslair'
  | 'smw1'
  | 'smw2'
  | 'ys1'
  | 'ys2'
  | 'mule';

export type GameId = PacManGameId | ClassicArcadeGameId;

export type CabinetCategory =
  | 'platformers'
  | 'shooters'
  | 'action'
  | 'puzzle'
  | 'racing'
  | 'rpg'
  | 'pacman';

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
    tagline: 'Lunar Cabinet HD · Ripple March · Molten Bunkers · 300pt Mystery UFO',
    accentHex: '#4ADE80',
    storageKey: 'space_invaders_hd_highscore_v1',
  },
  {
    id: 'invaders2',
    title: 'Space Invaders II',
    year: 1979,
    category: 'shooters',
    tagline: 'Lunar Colony HD · Fission Splitters · Drop-Pod UFO · S.O.S. & Rainbow Arc',
    accentHex: '#06B6D4',
    storageKey: 'space_invaders2_hd_highscore_v1',
  },
  {
    id: 'invadersdx',
    title: 'Space Invaders DX',
    year: 1994,
    category: 'shooters',
    tagline: '16-Bit Taito F2 HD · 5 Parody Worlds · Power Capsules & DX Hyper Beam',
    accentHex: '#FACC15',
    storageKey: 'space_invaders_dx_hd_highscore_v1',
  },

  // Action & Dungeon Classics (7)
  {
    id: 'gauntlet',
    title: 'Gauntlet',
    year: 1985,
    category: 'action',
    tagline: 'Red Warrior · Blue Valkyrie · Yellow Wizard · Green Elf · 8 Dungeons',
    accentHex: '#F59E0B',
    storageKey: 'gauntlet_hd_highscore_v2',
  },
  {
    id: 'gauntlet2',
    title: 'Gauntlet II',
    year: 1986,
    category: 'action',
    tagline: 'Pick Any Color & Hero · Dragons, “It”, Acid, Ricochet & Secret Rooms',
    accentHex: '#EF4444',
    storageKey: 'gauntlet2_hd_highscore_v2',
  },
  {
    id: 'gauntletdl',
    title: 'Gauntlet: Dark Legacy',
    year: 2000,
    category: 'action',
    tagline: 'Authentic 2000 Midway 3D · Torchlit Stonework · Sumner’s Tower · 9 Bosses & 10 Relics',
    accentHex: '#D97706',
    storageKey: 'gauntlet_dark_legacy_hd_highscore_v1',
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
    tagline: '2.5D Subterranean Engine · Smooth Tunnel Carving · 4 Worlds & Fossils',
    accentHex: '#38BDF8',
    storageKey: 'digdug_hd_highscore_v1',
  },
  {
    id: 'boulderdash',
    title: 'Boulder Dash',
    year: 1984,
    category: 'action',
    tagline: '2.5D Cavern Engine · 8 Biomes · Magic Walls, Amoeba & Smooth Physics',
    accentHex: '#A855F7',
    storageKey: 'boulderdash_hd_highscore_v1',
  },
  {
    id: 'foodfight',
    title: 'Food Fight',
    year: 1983,
    category: 'action',
    tagline: '2.5D Patio Bistro Engine · 6 Tactical Foods · Dive-Roll & Recorded Instant Replay',
    accentHex: '#FB7185',
    storageKey: 'foodfight_hd_highscore_v1',
  },

  // Arcade Racing Classics (11)
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
    id: 'sprint1',
    title: 'Sprint 1',
    year: 1978,
    category: 'racing',
    tagline: '1978 Kee Games · 8 Classic Circuits · 4-Speed Phosphor-Green Racer',
    accentHex: '#86EFAC',
    storageKey: 'sprint1_hd_highscore_v2',
  },
  {
    id: 'sprint',
    title: 'Sprint 2',
    year: 1976,
    category: 'racing',
    tagline: '1976 Overhead Pioneer · 8 Classic Circuits · 4-Speed & Skidmarks',
    accentHex: '#E2E8F0',
    storageKey: 'sprint_hd_highscore_v2',
  },
  {
    id: 'sprint4',
    title: 'Sprint 4',
    year: 1977,
    category: 'racing',
    tagline: '1977 First-Color Atari · 6 Arcade Tracks · 4-Color Pack & Oil',
    accentHex: '#F97316',
    storageKey: 'sprint4_hd_highscore_v1',
  },
  {
    id: 'sprint8',
    title: 'Sprint 8',
    year: 1977,
    category: 'racing',
    tagline: '1977 8-Car Wide Arena · 6 Super-Wide Tracks · 8-Pack Traffic',
    accentHex: '#38BDF8',
    storageKey: 'sprint8_hd_highscore_v1',
  },
  {
    id: 'supersprint',
    title: 'Super Sprint',
    year: 1986,
    category: 'racing',
    tagline: '8 System 2 Circuits · Overpass Bridges · Pit Tune-Up · Helicopter',
    accentHex: '#FACC15',
    storageKey: 'supersprint_hd_highscore_v2',
  },
  {
    id: 'champsprint',
    title: 'Championship Sprint',
    year: 1986,
    category: 'racing',
    tagline: '8 Pro Circuits · Pneumatic Shortcut Gates · Water & Oil · Tune-Up',
    accentHex: '#4ADE80',
    storageKey: 'champsprint_hd_highscore_v2',
  },
  {
    id: 'badlands',
    title: 'Badlands',
    year: 1989,
    category: 'racing',
    tagline: '6 Wasteland Tracks · Roof Plasma Cannon · Land Mines & Armory',
    accentHex: '#EF4444',
    storageKey: 'badlands_hd_highscore_v1',
  },
  {
    id: 'superoffroad',
    title: 'Super Off Road',
    year: 1989,
    category: 'racing',
    tagline: '8 Dirt Stadium Tracks · 3D Jump Ramps · Mud Pits & N2O Nitro',
    accentHex: '#F59E0B',
    storageKey: 'superoffroad_hd_highscore_v1',
  },
  {
    id: 'indyheat',
    title: 'Indy Heat',
    year: 1991,
    category: 'racing',
    tagline: '6 IndyCar Circuits · Live Fuel & Engine Heat · Pit Lane Refuel',
    accentHex: '#60A5FA',
    storageKey: 'indyheat_hd_highscore_v1',
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
  {
    id: 'smw1',
    title: 'Super Mario World',
    year: 1990,
    category: 'platformers',
    tagline: 'Dinosaur Land · Ride Yoshi · Cape Feather & Spin Jump',
    accentHex: '#FACC15',
    storageKey: 'smw1_hd_highscore_v1',
  },
  {
    id: 'smw2',
    title: 'Yoshi’s Island (SMW 2)',
    year: 1995,
    category: 'platformers',
    tagline: 'Flutter Jump · Aim & Throw Eggs · Protect Baby Mario',
    accentHex: '#4ADE80',
    storageKey: 'smw2_hd_highscore_v1',
  },

  // Puzzle & Brick Breakers (6)
  {
    id: 'superbreakout',
    title: 'Super Breakout',
    year: 1978,
    category: 'puzzle',
    tagline: 'Progressive, Double & Cavity Multiball · Classic Atari Paddle',
    accentHex: '#38BDF8',
    storageKey: 'superbreakout_hd_highscore_v1',
  },
  {
    id: 'arkanoid',
    title: 'Arkanoid',
    year: 1986,
    category: 'puzzle',
    tagline: 'Vaus Craft · 7 Power Capsules · Lasers, Catch & DOH',
    accentHex: '#60A5FA',
    storageKey: 'arkanoid_hd_highscore_v1',
  },
  {
    id: 'arkanoid2',
    title: 'Arkanoid II: Revenge of DOH',
    year: 1987,
    category: 'puzzle',
    tagline: 'Twin Vaus · Mega-Ball · Regenerating Bricks & DOH Core',
    accentHex: '#C084FC',
    storageKey: 'arkanoid2_hd_highscore_v1',
  },
  {
    id: 'breakout2016evo',
    title: 'Breakout 2016 Evo',
    year: 2016,
    category: 'puzzle',
    tagline: 'Melt-O-Vision Webs · Warlords Citadels · Superzapper · Evo Capsules & DOH-Pulsar',
    accentHex: '#EC4899',
    storageKey: 'breakout2016evo_hd_highscore_v1',
  },
  {
    id: 'puzzlebobble',
    title: 'Puzzle Bobble',
    year: 1994,
    category: 'puzzle',
    tagline: '2.5D Shimmer Orbs · Cute Bub & Bob · Bank Shots & Avalanche Drops',
    accentHex: '#34D399',
    storageKey: 'puzzlebobble_hd_highscore_v2',
  },
  {
    id: 'puzzlebobble2',
    title: 'Puzzle Bobble 2',
    year: 1995,
    category: 'puzzle',
    tagline: '2.5D Bust-A-Move Again · Star Orbs · Fairy Rescue · Iron Balls & Swap',
    accentHex: '#F472B6',
    storageKey: 'puzzlebobble2_hd_highscore_v1',
  },
  {
    id: 'puzzlebobble3',
    title: 'Puzzle Bobble Evo',
    year: 1998,
    category: 'puzzle',
    tagline: '2.5D Prism Evolution · Pulley Scales · Rainbow, Bomb, Lightning & Boss',
    accentHex: '#FACC15',
    storageKey: 'puzzlebobble3_hd_highscore_v1',
  },
  {
    id: 'qix',
    title: 'Qix',
    year: 1981,
    category: 'puzzle',
    tagline: 'Stix Territory Carving · Fast vs 2× Slow Draw · Twin Qix Split & Super Sparx',
    accentHex: '#F472B6',
    storageKey: 'qix_hd_highscore_v1',
  },
  {
    id: 'superqix',
    title: 'Super Qix',
    year: 1987,
    category: 'puzzle',
    tagline: '1987 Taito Sequel · Reveal Hidden 16-Bit Art · Enclose Power-Ups & Warp',
    accentHex: '#FACC15',
    storageKey: 'superqix_hd_highscore_v1',
  },

  // Vector, Galactic & Scrolling Shooters (+16)
  {
    id: 'asteroidsdeluxe',
    title: 'Asteroids Deluxe',
    year: 1981,
    category: 'shooters',
    tagline: 'Vector Shields · Splitting Killer Satellites & Saucers',
    accentHex: '#38BDF8',
    storageKey: 'asteroidsdeluxe_hd_highscore_v1',
  },
  {
    id: 'spaceduel',
    title: 'Space Duel',
    year: 1982,
    category: 'shooters',
    tagline: 'Color Vector Shapes · Tethered Wingman · Geometric Swarms',
    accentHex: '#A855F7',
    storageKey: 'spaceduel_hd_highscore_v1',
  },
  {
    id: 'starcastle',
    title: 'Star Castle',
    year: 1980,
    category: 'shooters',
    tagline: '3 Rotating Energy Rings · Core Cannon · Homing Mines',
    accentHex: '#FACC15',
    storageKey: 'starcastle_hd_highscore_v1',
  },
  {
    id: 'missilecommand',
    title: 'Missile Command',
    year: 1980,
    category: 'shooters',
    tagline: '3 ABM Batteries · Chain Blast Intercepts · Defend 6 Cities',
    accentHex: '#F97316',
    storageKey: 'missilecommand_hd_highscore_v1',
  },
  {
    id: 'galaxian',
    title: 'Galaxian',
    year: 1979,
    category: 'shooters',
    tagline: 'Swooping Flagship Escorts · Starfield Formation Combat',
    accentHex: '#FACC15',
    storageKey: 'galaxian_hd_highscore_v1',
  },
  {
    id: 'galaga',
    title: 'Galaga',
    year: 1981,
    category: 'shooters',
    tagline: 'Tractor Beam Rescue · Dual Fighter · Challenging Stages',
    accentHex: '#38BDF8',
    storageKey: 'galaga_hd_highscore_v1',
  },
  {
    id: 'phoenix',
    title: 'Phoenix',
    year: 1980,
    category: 'shooters',
    tagline: '5-Wave Cycle · Shield Barrier · Giant Mothership Boss',
    accentHex: '#FB923C',
    storageKey: 'phoenix_hd_highscore_v1',
  },
  {
    id: 'gyruss',
    title: 'Gyruss',
    year: 1983,
    category: 'shooters',
    tagline: '360° Orbital Tube · Baroque Synth Rock · Warp To Earth',
    accentHex: '#22D3EE',
    storageKey: 'gyruss_hd_highscore_v1',
  },
  {
    id: 'scramble',
    title: 'Scramble',
    year: 1981,
    category: 'shooters',
    tagline: '6-Sector Konami Cavern Run · Dual Laser & Bombs · FUEL Silos · ? Mystery & Base Core',
    accentHex: '#4ADE80',
    storageKey: 'scramble_hd_highscore_v1',
  },
  {
    id: 'moonpatrol',
    title: 'Moon Patrol',
    year: 1982,
    category: 'shooters',
    tagline: 'Lunar Buggy · Jump Craters · Dual Forward & Overhead Guns',
    accentHex: '#F472B6',
    storageKey: 'moonpatrol_hd_highscore_v1',
  },
  {
    id: 'timepilot',
    title: 'Time Pilot',
    year: 1982,
    category: 'shooters',
    tagline: '360° Free-Flight Dogfights · 1910–2001 Era Motherships · Parachutist Rescues',
    accentHex: '#60A5FA',
    storageKey: 'timepilot_hd_highscore_v1',
  },
  {
    id: 'timepilot84',
    title: 'Time Pilot ’84',
    year: 1984,
    category: 'shooters',
    tagline: '1984 Konami Sequel · Metallic Overworld · Vulcan + Lock-On Homing Missiles & Turrets',
    accentHex: '#38BDF8',
    storageKey: 'timepilot84_hd_highscore_v1',
  },
  {
    id: 'timepilot2016evo',
    title: 'Time Pilot: 2016 Evo',
    year: 2016,
    category: 'shooters',
    tagline: 'Melt-O-Vision Warp Trails · 4-Target Homing Salvos · Chain Lightning & Chrono Shift',
    accentHex: '#F472B6',
    storageKey: 'timepilot2016evo_hd_highscore_v1',
  },
  {
    id: 'ww1942',
    title: '1942',
    year: 1984,
    category: 'shooters',
    tagline: 'P-38 Lightning · Barrel Roll Loop · Wingmen & Super Ace',
    accentHex: '#94A3B8',
    storageKey: 'ww1942_hd_highscore_v1',
  },
  {
    id: 'ww1943',
    title: '1943: The Battle of Midway',
    year: 1987,
    category: 'shooters',
    tagline: 'Shotgun & 3-Way · Lightning Mega-Crash · Naval Carrier Bosses',
    accentHex: '#38BDF8',
    storageKey: 'ww1943_hd_highscore_v1',
  },
  {
    id: 'starwars',
    title: 'Star Wars',
    year: 1983,
    category: 'shooters',
    tagline: '3D Color Vector X-Wing · Vader TIE · Death Star Trench Run',
    accentHex: '#FACC15',
    storageKey: 'starwars_hd_highscore_v1',
  },
  {
    id: 'starwarsesb',
    title: 'Star Wars: Empire Strikes Back',
    year: 1985,
    category: 'shooters',
    tagline: 'Hoth 3D Vector · Tow-Cable AT-ATs · TIE Bombers & Asteroids',
    accentHex: '#38BDF8',
    storageKey: 'starwarsesb_hd_highscore_v1',
  },
  {
    id: 'starwarsrotj',
    title: 'Star Wars: Return of the Jedi',
    year: 1984,
    category: 'shooters',
    tagline: '2.5D Isometric Raster · Speeder Bike · AT-ST & Falcon Escape',
    accentHex: '#4ADE80',
    storageKey: 'starwarsrotj_hd_highscore_v1',
  },

  // Classic Arcade Action (+12)
  {
    id: 'berzerk',
    title: 'Berzerk',
    year: 1980,
    category: 'action',
    tagline: 'Electrified Robot Mazes · Evil Otto · 8-Way Laser Combat',
    accentHex: '#4ADE80',
    storageKey: 'berzerk_hd_highscore_v1',
  },
  {
    id: 'robotron',
    title: 'Robotron: 2084',
    year: 1982,
    category: 'action',
    tagline: 'Twin-Stick Frenzy · Grunts, Hulks, Spheroids, Quarks, Brains & Progs',
    accentHex: '#EC4899',
    storageKey: 'robotron_hd_highscore_v1',
  },
  {
    id: 'robotron2016evo',
    title: 'Robotron: 2016 Evo',
    year: 2016,
    category: 'action',
    tagline: 'Full Melt-O-Vision Feedback · Chromatic RGB · Overdrive Tiers & Melt-Nova Pulse',
    accentHex: '#F43F5E',
    storageKey: 'robotron2016evo_hd_highscore_v1',
  },
  {
    id: 'frogger',
    title: 'Frogger',
    year: 1981,
    category: 'action',
    tagline: '5-Lane Highway · Diving Turtles, Snapping Gators, Lady Frog & 5 Berths',
    accentHex: '#22C55E',
    storageKey: 'frogger_hd_highscore_v1',
  },
  {
    id: 'frogger2',
    title: 'Frogger II: ThreeeDeep!',
    year: 1984,
    category: 'action',
    tagline: '3-Zone Adventure · Underwater Reef → Surface Lagoon → Sky Kingdom',
    accentHex: '#38BDF8',
    storageKey: 'frogger2_hd_highscore_v1',
  },
  {
    id: 'joust',
    title: 'Joust',
    year: 1982,
    category: 'action',
    tagline: 'Ostrich Wing-Flap Physics · Lance Duels · Hatching Eggs',
    accentHex: '#F59E0B',
    storageKey: 'joust_hd_highscore_v1',
  },
  {
    id: 'pengo',
    title: 'Pengo',
    year: 1982,
    category: 'action',
    tagline: '13×15 Polar Ice Maze · Multi-Squash Combos · Wall Shake & 3 Diamonds',
    accentHex: '#38BDF8',
    storageKey: 'pengo_hd_highscore_v1',
  },
  {
    id: 'popeye',
    title: 'Popeye',
    year: 1982,
    category: 'action',
    tagline: 'All 3 Nintendo Stages · Docks, Seesaw Village & Ship · Spinach KO Brutus',
    accentHex: '#60A5FA',
    storageKey: 'popeye_hd_highscore_v1',
  },
  {
    id: 'mrdo',
    title: 'Mr. Do!',
    year: 1982,
    category: 'action',
    tagline: 'Dig Cherry Orchards · Powerball · Falling Apples & EXTRA',
    accentHex: '#EF4444',
    storageKey: 'mrdo_hd_highscore_v1',
  },
  {
    id: 'tapper',
    title: 'Tapper',
    year: 1983,
    category: 'action',
    tagline: '1983 Budweiser Evo · 4 Classic Saloons · Can-Can Tip Show & Shaken Can Bonus',
    accentHex: '#EF4444',
    storageKey: 'tapper_hd_highscore_v1',
  },
  {
    id: 'roottapper',
    title: 'Root Beer Tapper',
    year: 1984,
    category: 'action',
    tagline: '1984 Soda Fountain Evo · Frothy Root Beer Kegs · 4 Saloons & Shaken Can Bonus',
    accentHex: '#FB923C',
    storageKey: 'roottapper_hd_highscore_v1',
  },
  {
    id: 'crystalcastles',
    title: 'Crystal Castles',
    year: 1983,
    category: 'action',
    tagline: 'Isometric 3D Gem Castles · Bentley Bear · Magic Hat & Witch',
    accentHex: '#C084FC',
    storageKey: 'crystalcastles_hd_highscore_v1',
  },
  {
    id: 'rampage',
    title: 'Rampage',
    year: 1986,
    category: 'action',
    tagline: '6 Destructible Cities · George, Lizzie & Ralph · Structural Collapses',
    accentHex: '#22C55E',
    storageKey: 'rampage_hd_highscore_v1',
  },
  {
    id: 'dragonslair',
    title: 'Dragon’s Lair',
    year: 1983,
    category: 'action',
    tagline: 'Dirk the Daring · Animated Reflex Gauntlet · Slay Singe',
    accentHex: '#FACC15',
    storageKey: 'dragonslair_hd_highscore_v1',
  },

  // Arcade Racing (+2)
  {
    id: 'spyhunter',
    title: 'Spy Hunter',
    year: 1983,
    category: 'racing',
    tagline: '1983 G-6155 Interceptor · Boat House River Transform · Weapons Van & Mad Bomber',
    accentHex: '#E2E8F0',
    storageKey: 'spyhunter_hd_highscore_v1',
  },
  {
    id: 'spyhunter2',
    title: 'Spy Hunter II',
    year: 1987,
    category: 'racing',
    tagline: '1987 3D Chase View · G-8155 + Yellow Wingman · Seeker Missiles, Flames & Pyro Gyro',
    accentHex: '#FACC15',
    storageKey: 'spyhunter2_hd_highscore_v1',
  },

  // Action RPG & Classic Strategy (3)
  {
    id: 'ys1',
    title: 'Ys Book I: Ancient Ys Vanished',
    year: 1987,
    category: 'rpg',
    tagline: 'Adol’s Bump-Combat Action RPG · Esteria Fields & Darm Tower',
    accentHex: '#EF4444',
    storageKey: 'ys1_hd_highscore_v1',
  },
  {
    id: 'ys2',
    title: 'Ys Book II: The Final Chapter',
    year: 1988,
    category: 'rpg',
    tagline: 'Floating Island of Ys · Fireball Magic · Bump Combat & Bosses',
    accentHex: '#38BDF8',
    storageKey: 'ys2_hd_highscore_v1',
  },
  {
    id: 'mule',
    title: 'M.U.L.E.',
    year: 1983,
    category: 'rpg',
    tagline: '8 Alien Species · 12-Month Irata Colony Sim · Tethered M.U.L.E.s & Auctions',
    accentHex: '#F59E0B',
    storageKey: 'mule_hd_highscore_v1',
  },
];

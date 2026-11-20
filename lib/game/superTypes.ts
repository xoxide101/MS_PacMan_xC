import { Direction, GamePhase, GhostMode, Vec2 } from './types';

export type SuperTileType =
  | '#' // Wall
  | ' ' // Empty corridor
  | 'K' // Golden key
  | 'V' // Locked vertical chamber door
  | 'T' // Treasure item inside chamber
  | 'o' // Standard power pellet (frightens ghosts)
  | 'S' // Green Super Pellet (Giant Super Pac-Man!)
  | '-' // Ghost house gate
  | 'G'; // Ghost house interior

export type SuperPrizeType =
  | 'apple'
  | 'banana'
  | 'donut'
  | 'burger'
  | 'egg'
  | 'corn'
  | 'cake'
  | 'peach'
  | 'melon'
  | 'coffee'
  | 'mushroom'
  | 'bell'
  | 'clover'
  | 'galaxian'
  | 'gift';

export interface SuperPrizeSpec {
  type: SuperPrizeType;
  label: string;
  points: number;
  color: string;
}

export const SUPER_PRIZE_SPECS: Record<SuperPrizeType, SuperPrizeSpec> = {
  apple: { type: 'apple', label: 'Apple', points: 100, color: '#EF4444' },
  banana: { type: 'banana', label: 'Banana', points: 200, color: '#FACC15' },
  donut: { type: 'donut', label: 'Donut', points: 300, color: '#F472B6' },
  burger: { type: 'burger', label: 'Burger', points: 400, color: '#FB923C' },
  egg: { type: 'egg', label: 'Fried Egg', points: 500, color: '#FDE047' },
  corn: { type: 'corn', label: 'Corn', points: 600, color: '#EAB308' },
  cake: { type: 'cake', label: 'Cake', points: 700, color: '#FB7185' },
  peach: { type: 'peach', label: 'Peach', points: 800, color: '#FDBA74' },
  melon: { type: 'melon', label: 'Melon', points: 900, color: '#4ADE80' },
  coffee: { type: 'coffee', label: 'Coffee', points: 1000, color: '#A8A29E' },
  mushroom: { type: 'mushroom', label: 'Mushroom', points: 1100, color: '#F87171' },
  bell: { type: 'bell', label: 'Bell', points: 1200, color: '#FDE047' },
  clover: { type: 'clover', label: 'Clover', points: 1300, color: '#22C55E' },
  galaxian: { type: 'galaxian', label: 'Galaxian', points: 1400, color: '#38BDF8' },
  gift: { type: 'gift', label: 'Gift Box', points: 1600, color: '#E879F9' },
};

export const SUPER_PRIZE_ORDER: SuperPrizeType[] = [
  'apple',
  'banana',
  'donut',
  'burger',
  'egg',
  'corn',
  'cake',
  'peach',
  'melon',
  'coffee',
  'mushroom',
  'bell',
  'clover',
  'galaxian',
  'gift',
];

export type SuperGhostId = 'blinky' | 'pinky' | 'inky' | 'clyde';

export interface SuperPlayerState {
  x: number;
  y: number;
  dir: Direction;
  desiredDir: Direction;
  facing: Direction;
  mouthPhase: number;
  moving: boolean;
  deathProgress: number;
}

export interface SuperGhostState {
  id: SuperGhostId;
  name: string;
  nickname: string;
  color: string;
  accentColor: string;
  x: number;
  y: number;
  dir: Direction;
  mode: GhostMode | 'ENTERING_HOUSE';
  previousMode: 'SCATTER' | 'CHASE';
  scatterTarget: Vec2;
  releaseDelay: number;
  eatenThisPower: boolean;
  animPhase: number;
  lastDecisionTileKey: string;
}

export interface SuperMazeTheme {
  name: string;
  wallOuter: string;
  wallInner: string;
  wallHighlight: string;
  wallGlow: string;
  floorTint: string;
  gateLocked: string;
  gateGlow: string;
  gateColor: string;
  accentHex: string;
}

export interface SuperDoorLink {
  keyCol: number;
  keyRow: number;
  doors: Array<{ col: number; row: number }>;
}

export interface SuperMazeDefinition {
  grid: SuperTileType[][];
  tunnelRows: number[];
  totalTreasures: number;
  totalKeys: number;
  totalDoors: number;
  playerSpawn: Vec2;
  ghostHouseDoor: Vec2;
  ghostHouseCenter: Vec2;
  bonusStarPos: Vec2;
  doorLinks: SuperDoorLink[];
}

export interface SuperHudSnapshot {
  phase: GamePhase;
  score: number;
  highScore: number;
  isNewHighScore: boolean;
  lives: number;
  level: number;
  themeName: string;
  themeAccent: string;
  treasuresLeft: number;
  totalTreasures: number;
  keysLeft: number;
  doorsLocked: number;
  ghostsEatenTotal: number;
  doorsSmashedTotal: number;
  currentPrize: SuperPrizeType;
  prizesCleared: SuperPrizeType[];
  superRemaining: number;
  isSuperBoosting: boolean;
  frightenedRemaining: number;
  bonusStarActive: boolean;
  extraLifeAwarded: boolean;
}

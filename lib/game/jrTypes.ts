import {
  Direction,
  FloatingPopup,
  GamePhase,
  GhostMode,
  MazeTheme,
  Particle,
  SpeedMode,
  Vec2,
  VisualStyle,
} from './types';

export type JrGhostId = 'blinky' | 'pinky' | 'inky' | 'tim';

// '#' wall, '.' standard 10pt dot, 'M' mutated 50pt large dot, 'o' power energizer,
// ' ' empty corridor, '-' ghost house gate, 'G' ghost house interior
export type JrTileType = '#' | '.' | 'M' | 'o' | ' ' | '-' | 'G';

export type JrPrizeType =
  | 'tricycle'
  | 'kite'
  | 'drum'
  | 'balloon'
  | 'train'
  | 'kitty'
  | 'rootbeer';

export interface JrPrizeSpec {
  type: JrPrizeType;
  label: string;
  points: number;
  color: string;
}

export const JR_PRIZE_SPECS: Record<JrPrizeType, JrPrizeSpec> = {
  tricycle: { type: 'tricycle', label: 'Tricycle', points: 100, color: '#EF4444' },
  kite: { type: 'kite', label: 'Kite', points: 200, color: '#38BDF8' },
  drum: { type: 'drum', label: 'Drum', points: 500, color: '#F59E0B' },
  balloon: { type: 'balloon', label: 'Balloon', points: 700, color: '#F472B6' },
  train: { type: 'train', label: 'Train', points: 1000, color: '#A78BFA' },
  kitty: { type: 'kitty', label: 'Kitty', points: 2000, color: '#FB923C' },
  rootbeer: { type: 'rootbeer', label: 'Root Beer', points: 5000, color: '#FACC15' },
};

export const JR_LEVEL_PRIZE_ORDER: JrPrizeType[] = [
  'tricycle',
  'kite',
  'drum',
  'balloon',
  'train',
  'kitty',
  'rootbeer',
];

export interface JrMazeDefinition {
  id: number;
  theme: MazeTheme;
  grid: JrTileType[][];
  totalPellets: number;
  totalEnergizers: number;
  playerSpawn: Vec2;
  ghostHouseDoor: Vec2;
  ghostHouseCenter: Vec2;
}

export interface JrPlayerState {
  x: number;
  y: number;
  dir: Direction;
  nextDir: Direction;
  mouthPhase: number;
  propellerPhase: number;
  moving: boolean;
  speed: number;
  slowdownTimer: number; // brief authentic drag when chomping mutated large dots
  deathProgress: number;
  trail: Array<{ x: number; y: number; alpha: number }>;
}

export interface JrGhostState {
  id: JrGhostId;
  name: string;
  nickname: string;
  color: string;
  accentColor: string;
  x: number;
  y: number;
  dir: Direction;
  mode: GhostMode;
  previousMode: 'SCATTER' | 'CHASE';
  scatterTarget: Vec2;
  houseTarget: Vec2;
  releaseDelay: number;
  eatenThisPower: boolean;
  animPhase: number;
  lastDecisionTileKey: string;
}

export interface JrRoamingPrize {
  active: boolean;
  exitingHouse: boolean;
  type: JrPrizeType;
  points: number;
  x: number;
  y: number;
  dir: Direction;
  bouncePhase: number;
  targetEnergizer: Vec2 | null;
  lastDecisionTileKey: string;
  lifetime: number;
}

export interface JrHudSnapshot {
  phase: GamePhase;
  score: number;
  highScore: number;
  isNewHighScore: boolean;
  lives: number;
  level: number;
  mazeIndex: number;
  mazeName: string;
  mazeAccent: string;
  pelletsLeft: number;
  totalPellets: number;
  mutatedDotsCount: number;
  energizersLeft: number;
  energizersDestroyed: number;
  ghostsEatenTotal: number;
  prizesCollected: JrPrizeType[];
  currentPrize: JrPrizeType;
  prizeActive: boolean;
  frightenedRemaining: number;
  extraLifeAwarded: boolean;
}

export const JR_GRID_COLS = 56;
export const JR_GRID_ROWS = 31;
export const JR_VIEWPORT_COLS = 28;
export const JR_TILE_SIZE = 32;
export const JR_WORLD_WIDTH = JR_GRID_COLS * JR_TILE_SIZE; // 1792 logical px
export const JR_WORLD_HEIGHT = JR_GRID_ROWS * JR_TILE_SIZE; // 992 logical px
export const JR_VIEWPORT_WIDTH = JR_VIEWPORT_COLS * JR_TILE_SIZE; // 896 logical px
export const JR_VIEWPORT_HEIGHT = JR_GRID_ROWS * JR_TILE_SIZE; // 992 logical px

export type { Direction, FloatingPopup, GamePhase, Particle, SpeedMode, Vec2, VisualStyle };

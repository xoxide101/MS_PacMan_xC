export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'NONE';

export type GamePhase =
  | 'TITLE_MENU'
  | 'READY'
  | 'PLAYING'
  | 'GHOST_EATEN_PAUSE'
  | 'DYING'
  | 'STAGE_CLEAR'
  | 'PAUSED'
  | 'GAME_OVER';

export type GhostId = 'blinky' | 'pinky' | 'inky' | 'sue';

export type GhostMode =
  | 'IN_HOUSE'
  | 'EXITING_HOUSE'
  | 'SCATTER'
  | 'CHASE'
  | 'FRIGHTENED'
  | 'EATEN';

export type FruitType =
  | 'cherry'
  | 'strawberry'
  | 'orange'
  | 'pretzel'
  | 'apple'
  | 'pear'
  | 'banana';

export type VisualStyle = 'hd' | 'crt';
export type SpeedMode = 'arcade' | 'turbo';

export type TileType = '#' | '.' | 'o' | ' ' | '-' | 'G';

export interface Vec2 {
  x: number;
  y: number;
}

export interface MazeTheme {
  name: string;
  subtitle: string;
  wallOuter: string;
  wallInner: string;
  wallHighlight: string;
  wallGlow: string;
  floorTint: string;
  pelletColor: string;
  pelletGlow: string;
  gateColor: string;
  accentHex: string;
}

export interface MazeDefinition {
  id: number;
  theme: MazeTheme;
  grid: TileType[][];
  tunnelRows: number[];
  totalPellets: number;
  playerSpawn: Vec2;
  ghostHouseDoor: Vec2;
  ghostHouseCenter: Vec2;
}

export interface PlayerState {
  x: number; // tile coordinates (center of tile is col + 0.5)
  y: number;
  dir: Direction;
  nextDir: Direction;
  mouthPhase: number;
  moving: boolean;
  speed: number;
  deathProgress: number; // 0..1 during DYING phase
  trail: Array<{ x: number; y: number; alpha: number }>;
}

export interface GhostState {
  id: GhostId;
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
  releaseDelay: number; // seconds before leaving ghost house
  eatenThisPower: boolean;
  animPhase: number;
  lastDecisionTileKey: string;
}

export interface RoamingFruit {
  active: boolean;
  type: FruitType;
  points: number;
  x: number;
  y: number;
  dir: Direction;
  bouncePhase: number;
  stage: 'TO_CENTER' | 'TO_EXIT';
  exitRow: number;
  exitSide: 'LEFT' | 'RIGHT';
  lastDecisionTileKey: string;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  ring?: boolean;
}

export interface FloatingPopup {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

export interface FruitSpec {
  type: FruitType;
  label: string;
  points: number;
  color: string;
}

export const FRUIT_SPECS: Record<FruitType, FruitSpec> = {
  cherry: { type: 'cherry', label: 'Cherry', points: 100, color: '#FF3B5C' },
  strawberry: { type: 'strawberry', label: 'Strawberry', points: 200, color: '#FF4D79' },
  orange: { type: 'orange', label: 'Orange', points: 500, color: '#FF9829' },
  pretzel: { type: 'pretzel', label: 'Pretzel', points: 700, color: '#E09F52' },
  apple: { type: 'apple', label: 'Apple', points: 1000, color: '#F43F5E' },
  pear: { type: 'pear', label: 'Pear', points: 2000, color: '#A3E635' },
  banana: { type: 'banana', label: 'Banana', points: 5000, color: '#FACC15' },
};

export const LEVEL_FRUIT_ORDER: FruitType[] = [
  'cherry',
  'strawberry',
  'orange',
  'pretzel',
  'apple',
  'pear',
  'banana',
];

export interface HudSnapshot {
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
  ghostsEatenTotal: number;
  fruitsCollected: FruitType[];
  currentFruit: FruitType;
  frightenedRemaining: number;
  extraLifeAwarded: boolean;
}

export const GRID_COLS = 28;
export const GRID_ROWS = 31;
export const LOGICAL_TILE_SIZE = 32; // 896 x 992 logical px -> 4x-8x arcade CRT resolution
export const CANVAS_LOGICAL_WIDTH = GRID_COLS * LOGICAL_TILE_SIZE; // 896
export const CANVAS_LOGICAL_HEIGHT = GRID_ROWS * LOGICAL_TILE_SIZE; // 992

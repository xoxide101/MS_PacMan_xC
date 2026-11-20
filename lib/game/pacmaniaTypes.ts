import { Direction, GamePhase, GhostMode, Vec2 } from './types';

export const PM_GRID_COLS = 22;
export const PM_GRID_ROWS = 25;

// Logical HiDPI viewport for isometric/oblique 3D scrolling camera
export const PM_VIEWPORT_WIDTH = 720;
export const PM_VIEWPORT_HEIGHT = 600;

export type PacManiaTileType =
  | '#' // 3D wall block
  | '.' // Standard 3D pellet
  | 'o' // Power pellet
  | ' ' // Empty floor
  | '-' // Ghost house gate
  | 'G'; // Ghost house interior

export type PacManiaGhostId =
  | 'blinky'
  | 'pinky'
  | 'inky'
  | 'clyde'
  | 'sue'
  | 'funky'
  | 'spunky';

export interface PacManiaGhostState {
  id: PacManiaGhostId;
  name: string;
  nickname: string;
  color: string;
  accentColor: string;
  x: number;
  y: number;
  z: number; // Height above floor (for Funky & Spunky jumping!)
  vz: number;
  canJump: 'none' | 'low' | 'high';
  dir: Direction;
  mode: GhostMode | 'ENTERING_HOUSE';
  previousMode: 'SCATTER' | 'CHASE';
  scatterTarget: Vec2;
  releaseDelay: number;
  eatenThisPower: boolean;
  animPhase: number;
  lastDecisionTileKey: string;
}

export interface PacManiaPlayerState {
  x: number;
  y: number;
  z: number; // 0 = grounded, >0 = airborne jump!
  vz: number;
  dir: Direction;
  desiredDir: Direction;
  facing: Direction;
  mouthPhase: number;
  moving: boolean;
  deathProgress: number;
  jumpCount: number;
}

export type PacManiaSpecialType = 'green_speed' | 'red_double';

export interface PacManiaSpecialItem {
  active: boolean;
  type: PacManiaSpecialType;
  x: number;
  y: number;
  timer: number;
}

export interface PacManiaWorldTheme {
  id: number;
  name: string;
  subtitle: string;
  style: 'lego' | 'park' | 'sandbox' | 'jungle';
  skyTop: string;
  skyBottom: string;
  floorA: string;
  floorB: string;
  floorBorder: string;
  blockTopColors: string[];
  blockFrontColors: string[];
  blockSideColors: string[];
  pelletColor: string;
  gateColor: string;
  accentHex: string;
}

export interface PacManiaWorldDef {
  id: number;
  theme: PacManiaWorldTheme;
  grid: PacManiaTileType[][];
  tunnelRows: number[];
  totalPellets: number;
  playerSpawn: Vec2;
  ghostHouseDoor: Vec2;
  ghostHouseCenter: Vec2;
  specialSpawn: Vec2;
}

export interface PacManiaHudSnapshot {
  phase: GamePhase;
  score: number;
  highScore: number;
  isNewHighScore: boolean;
  lives: number;
  level: number;
  worldIndex: number;
  worldName: string;
  worldSubtitle: string;
  worldAccent: string;
  pelletsLeft: number;
  totalPellets: number;
  ghostsEatenTotal: number;
  jumpsClearedTotal: number;
  frightenedRemaining: number;
  speedBoostRemaining: number;
  doubleScoreRemaining: number;
  isAirborne: boolean;
  spunkyActive: boolean;
  extraLifeAwarded: boolean;
}

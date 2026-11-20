// Independent Tempest Trilogy Engine Barrel
// - Tempest (1981 Atari): Pure Quadrascan Color Vector CRT engine
// - Tempest 2000 (1994 Atari Jaguar / Llamasoft): Jaguar Melt-O-Vision & Gouraud 3D Webs
// - Tempest 3000 (2000 Nuon / Llamasoft): VLM-2 Kaleidoscopic Prism Melt-O-Vision & Morphing Glass Webs

import { ArcadeGameInstance } from './classicArcadeInterface';
import { Tempest1981Game } from './tempest1981Game';
import { Tempest2000Game } from './tempest2000Game';
import { Tempest3000Game } from './tempest3000Game';

export type TempestVariant = 'tempest' | 'tempest2000' | 'tempest3000';

export { Tempest1981Game } from './tempest1981Game';
export { Tempest2000Game } from './tempest2000Game';
export { Tempest3000Game } from './tempest3000Game';

export function createTempestEngine(variant: TempestVariant): ArcadeGameInstance {
  if (variant === 'tempest') return new Tempest1981Game();
  if (variant === 'tempest2000') return new Tempest2000Game();
  return new Tempest3000Game();
}

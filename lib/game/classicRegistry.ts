import { ClassicArcadeGameId } from './arcadeTypes';
import { BoulderDashGame } from './boulderdashGame';
import { CentipedeGame } from './centipedeGame';
import { ArcadeGameInstance } from './classicArcadeInterface';
import { DigDugGame } from './digdugGame';
import { FoodFightGame } from './foodfightGame';
import { SpaceInvaders2Game } from './invaders2Game';
import { SpaceInvadersGame } from './invadersGame';
import { MillipedeGame } from './millipedeGame';

export interface ClassicCabinetSpec {
  id: ClassicArcadeGameId;
  title: string;
  year: number;
  publisher: string;
  accentTextClass: string;
  accentButtonClass: string;
  borderHoverClass: string;
  subtitle: string;
  controls: Array<{ key: string; desc: string }>;
  tips: string[];
}

export const CLASSIC_CABINET_SPECS: Record<ClassicArcadeGameId, ClassicCabinetSpec> = {
  centipede: {
    id: 'centipede',
    title: 'Centipede',
    year: 1981,
    publisher: 'Atari',
    accentTextClass: 'text-lime-400',
    accentButtonClass: 'bg-lime-400 hover:bg-lime-300 text-slate-950 focus-visible:ring-lime-200',
    borderHoverClass: 'hover:border-lime-400/50',
    subtitle: '1981 · Splitting Chains · Spiders, Fleas & Poisoning Scorpions',
    controls: [
      { key: 'Arrows / WASD / Mouse', desc: 'Move blaster in lower zone' },
      { key: 'Space / Click', desc: 'Rapid-fire plasma shots' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Shoot a middle segment to split the centipede and turn it into a mushroom.',
      'Poisoned magenta mushrooms make centipedes dive straight down—clear them fast.',
      'Hit the bouncing spider up close for 900 points.',
    ],
  },
  millipede: {
    id: 'millipede',
    title: 'Millipede',
    year: 1982,
    publisher: 'Atari',
    accentTextClass: 'text-orange-400',
    accentButtonClass: 'bg-orange-500 hover:bg-orange-400 text-slate-950 focus-visible:ring-orange-200',
    borderHoverClass: 'hover:border-orange-400/50',
    subtitle: '1982 · DDT Bomb Blasts · Inchworm Slow-Mo · Beetles & Mosquitoes',
    controls: [
      { key: 'Arrows / WASD / Mouse', desc: 'Move blaster freely' },
      { key: 'Space / Click', desc: 'Fire plasma bolts' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Shoot red DDT canisters when bugs cluster nearby for massive 3× blast points.',
      'Blast the green Inchworm to trigger temporary slow-motion across all bugs.',
      'Watch out for Beetles—they turn mushrooms into diving-trigger flowers.',
    ],
  },
  digdug: {
    id: 'digdug',
    title: 'Dig Dug',
    year: 1982,
    publisher: 'Namco',
    accentTextClass: 'text-sky-400',
    accentButtonClass: 'bg-sky-400 hover:bg-sky-300 text-slate-950 focus-visible:ring-sky-200',
    borderHoverClass: 'hover:border-sky-400/50',
    subtitle: '1982 · Tunnel Digging · Air Pump Harpoon · Falling Boulders',
    controls: [
      { key: 'Arrows / WASD', desc: 'Dig & navigate underground tunnels' },
      { key: 'Space / Z', desc: 'Fire harpoon & tap rapidly to inflate' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Tap Space 4 times while tethered to pop Pooka or Fygar (2× for side-pumping Fygar).',
      'Dig beneath rocks and lure chasing monsters into the shaft for 1,000–4,000 pt crushes.',
      'Drop two boulders in a round to spawn a bonus center vegetable.',
    ],
  },
  boulderdash: {
    id: 'boulderdash',
    title: 'Boulder Dash',
    year: 1984,
    publisher: 'First Star',
    accentTextClass: 'text-purple-400',
    accentButtonClass: 'bg-purple-500 hover:bg-purple-400 text-white focus-visible:ring-purple-300',
    borderHoverClass: 'hover:border-purple-400/50',
    subtitle: '1984 · 5 Underground Caves · Rolling Rock Physics · Butterflies',
    controls: [
      { key: 'Arrows / WASD', desc: 'Dig earth, collect gems & push rocks' },
      { key: 'Hold Space + Dir', desc: 'Snap-dig adjacent tile without moving' },
      { key: 'R', desc: 'Restart cave if trapped' },
    ],
    tips: [
      'Collect the required diamonds to unlock the glowing green exit door.',
      'Drop boulders onto blue Butterflies to turn them into a 3×3 burst of 9 diamonds.',
      'Boulders roll off rounded rocks and brick walls—plan escape lanes first.',
    ],
  },
  invaders: {
    id: 'invaders',
    title: 'Space Invaders',
    year: 1978,
    publisher: 'Taito',
    accentTextClass: 'text-green-400',
    accentButtonClass: 'bg-green-500 hover:bg-green-400 text-slate-950 focus-visible:ring-green-200',
    borderHoverClass: 'hover:border-green-400/50',
    subtitle: '1978 · 55-Alien Formation · Destructible Bunkers · Mystery Red UFO',
    controls: [
      { key: 'Left / Right (A / D)', desc: 'Slide laser cannon' },
      { key: 'Space / Up', desc: 'Fire laser bolt' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'The fewer invaders remain, the faster their march and bass heartbeat become.',
      'Carve thin sniping slots through your green bunkers for safer cover.',
      'Track your shots to nail the Red Mystery UFO for the 300-point jackpot.',
    ],
  },
  invaders2: {
    id: 'invaders2',
    title: 'Space Invaders II',
    year: 1979,
    publisher: 'Taito',
    accentTextClass: 'text-cyan-400',
    accentButtonClass: 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 focus-visible:ring-cyan-200',
    borderHoverClass: 'hover:border-cyan-400/50',
    subtitle: '1979 · Splitting Command Invaders · Dropship UFO · Rainbow Bonus',
    controls: [
      { key: 'Left / Right (A / D)', desc: 'Slide plasma cannon' },
      { key: 'Space / Up', desc: 'Fire laser bolt' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Top-row crimson Command Invaders split into two fast mini-divers when hit.',
      'Destroy the golden Dropship UFO quickly before it drops reinforcement invaders.',
      'Leave a bottom-row Octopus for last to score the 500-point Rainbow Bonus.',
    ],
  },
  foodfight: {
    id: 'foodfight',
    title: 'Food Fight',
    year: 1983,
    publisher: 'Atari',
    accentTextClass: 'text-rose-400',
    accentButtonClass: 'bg-rose-500 hover:bg-rose-400 text-white focus-visible:ring-rose-300',
    borderHoverClass: 'hover:border-rose-400/50',
    subtitle: '1983 · Race For The Melting Cone · 4 Chefs · 7 Food Piles',
    controls: [
      { key: 'Arrows / WASD', desc: 'Run Charley Chuck across the plaza' },
      { key: 'Space / Z', desc: 'Grab & hurl food from nearby piles' },
      { key: 'P', desc: 'Pause / resume cabinet' },
    ],
    tips: [
      'Step near any glowing food pile and tap Space to hurl pies, melons, and tomatoes.',
      'Watch the black chef holes—Oscar, Angelo, Jacques, and Zorba emerge fast.',
      'Reach the Giant Ice Cream Cone on the right before it melts completely.',
    ],
  },
};

export function createClassicArcadeGame(id: ClassicArcadeGameId): ArcadeGameInstance {
  switch (id) {
    case 'centipede':
      return new CentipedeGame();
    case 'millipede':
      return new MillipedeGame();
    case 'digdug':
      return new DigDugGame();
    case 'boulderdash':
      return new BoulderDashGame();
    case 'invaders':
      return new SpaceInvadersGame();
    case 'invaders2':
      return new SpaceInvaders2Game();
    case 'foodfight':
      return new FoodFightGame();
  }
}

export function isClassicArcadeGameId(id: string): id is ClassicArcadeGameId {
  return id in CLASSIC_CABINET_SPECS;
}

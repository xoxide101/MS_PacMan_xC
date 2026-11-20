'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Download, Play } from 'lucide-react';
import { CABINET_LIST, CabinetCategory, GameId } from '@/lib/game/arcadeTypes';
import { arcadeAudio } from '@/lib/game/audio';
import { CLASSIC_BONUS_ORDER } from '@/lib/game/classicEngine';
import { isClassicArcadeGameId } from '@/lib/game/classicRegistry';
import { JR_LEVEL_PRIZE_ORDER } from '@/lib/game/jrTypes';
import { PLUS_BONUS_ORDER } from '@/lib/game/plusEngine';
import { SUPER_PRIZE_ORDER } from '@/lib/game/superTypes';
import { LEVEL_FRUIT_ORDER } from '@/lib/game/types';
import CabinetPreviewCanvas from './CabinetPreviewCanvas';
import ClassicArcadeShell from './ClassicArcadeShell';
import ClassicPacManArcade from './ClassicPacManArcade';
import JrPacManArcade from './JrPacManArcade';
import {
  ClassicBonusEmblem,
  FruitEmblem,
  GameEmblem,
  JrPrizeEmblem,
  PlusBonusEmblem,
  SuperPrizeEmblem,
} from './MiniEmblemCanvas';
import MsPacManArcade from './MsPacManArcade';
import PacManiaArcade from './PacManiaArcade';
import PacManPlusArcade from './PacManPlusArcade';
import SuperPacManArcade from './SuperPacManArcade';

type ActiveScreen = 'select' | GameId;
type FilterCategory = 'all' | CabinetCategory;
type ScoreMap = Record<GameId, number>;

function readStoredScore(key: string): number {
  if (typeof window === 'undefined') return 0;
  try {
    const val = window.localStorage.getItem(key);
    const num = val ? parseInt(val, 10) : 0;
    return Number.isFinite(num) && num > 0 ? num : 0;
  } catch {
    return 0;
  }
}

const VALID_GAME_IDS = new Set<GameId>(CABINET_LIST.map((c) => c.id));

function parseHashToScreen(hash: string): ActiveScreen {
  const cleaned = hash.replace(/^#\/?/, '').trim().toLowerCase() as GameId;
  return VALID_GAME_IDS.has(cleaned) ? cleaned : 'select';
}

function createZeroScores(): ScoreMap {
  const map = {} as ScoreMap;
  for (const cab of CABINET_LIST) {
    map[cab.id] = 0;
  }
  return map;
}

function loadAllHighScores(): ScoreMap {
  const map = createZeroScores();
  for (const cab of CABINET_LIST) {
    map[cab.id] = readStoredScore(cab.storageKey);
  }
  return map;
}

interface CabinetCardConfig {
  id: GameId;
  title: string;
  year: number;
  category: CabinetCategory;
  meta: string;
  description: string;
  footerLabel: string;
  footerSummary?: string;
  titleColorClass: string;
  scoreColorClass: string;
  borderHoverClass: string;
  buttonClass: string;
}

const CABINET_CARDS: CabinetCardConfig[] = [
  // --- Classic Platformers (10) ---
  {
    id: 'mariobros',
    title: 'Mario Bros.',
    year: 1983,
    category: 'platformers',
    meta: '1983 · Nintendo · Arcade Sewer · POW Block & Bonus Coins',
    description:
      'Bump brick platforms from below to flip Shellcreepers, 2-hit angry Sidesteppers, and Fighter Flies—then kick them off for chain combos and trigger the 3-hit POW block.',
    footerLabel: 'Sewer Arena',
    footerSummary: 'Brick Bump Waves · 3-Hit POW · Wrap Pipes',
    titleColorClass: 'text-red-400',
    scoreColorClass: 'text-red-200',
    borderHoverClass: 'hover:border-red-400/50',
    buttonClass: 'bg-red-500 hover:bg-red-400 text-white focus-visible:ring-red-300',
  },
  {
    id: 'dkong',
    title: 'Donkey Kong',
    year: 1981,
    category: 'platformers',
    meta: '1981 · Nintendo · Slanted Girders · Barrels, Hammer & Rivets',
    description:
      'Climb steel ladders and leap over rolling barrels on 25m Girders, grab the golden Hammer to smash hazards, or pull all 8 rivets on 100m to rescue Pauline!',
    footerLabel: 'Classic Stages',
    footerSummary: '25m Girders · 100m Rivets · Golden Hammer',
    titleColorClass: 'text-orange-400',
    scoreColorClass: 'text-orange-200',
    borderHoverClass: 'hover:border-orange-400/50',
    buttonClass: 'bg-orange-500 hover:bg-orange-400 text-slate-950 focus-visible:ring-orange-200',
  },
  {
    id: 'dkongjr',
    title: 'Donkey Kong Jr.',
    year: 1982,
    category: 'platformers',
    meta: '1982 · Nintendo · Dual-Vine Climbing · Fruit Drops & Keys',
    description:
      'Grab two jungle vines to climb fast, slide down single vines, drop tropical fruits onto Snapjaws below, and unlock all 3 golden keys to free Papa Kong!',
    footerLabel: 'Jungle Climb',
    footerSummary: '2-Vine Turbo Climb · Fruit Crush · Cage Keys',
    titleColorClass: 'text-green-400',
    scoreColorClass: 'text-green-200',
    borderHoverClass: 'hover:border-green-400/50',
    buttonClass: 'bg-green-500 hover:bg-green-400 text-slate-950 focus-visible:ring-green-200',
  },
  {
    id: 'dkong3',
    title: 'Donkey Kong 3',
    year: 1983,
    category: 'platformers',
    meta: '1983 · Nintendo · Greenhouse Bug Spray · Super Spray',
    description:
      'Play as Stanley the Bugman—blast upward bug spray to drive Donkey Kong into the beehive while defending your 5 flowers from Buzzbees and grabbing Super Spray.',
    footerLabel: 'Greenhouse',
    footerSummary: 'Bug Spray Shooter · Super Can · 5 Flowers',
    titleColorClass: 'text-lime-400',
    scoreColorClass: 'text-lime-200',
    borderHoverClass: 'hover:border-lime-400/50',
    buttonClass: 'bg-lime-400 hover:bg-lime-300 text-slate-950 focus-visible:ring-lime-200',
  },
  {
    id: 'smb1',
    title: 'Super Mario Bros.',
    year: 1985,
    category: 'platformers',
    meta: '1985 · Nintendo · Mushroom Kingdom · Fire Flower & Bowser',
    description:
      'Sprint and leap across Overworld, Underground, Sky, and Castle stages—bump ? blocks for Super Mushrooms & Fire Flowers, kick Koopa shells, and reach the Flagpole.',
    footerLabel: 'Power-Ups',
    footerSummary: 'Super Mushroom · Fire Flower · Flagpole',
    titleColorClass: 'text-red-400',
    scoreColorClass: 'text-red-200',
    borderHoverClass: 'hover:border-red-400/50',
    buttonClass: 'bg-red-500 hover:bg-red-400 text-white focus-visible:ring-red-300',
  },
  {
    id: 'smb2',
    title: 'Super Mario Bros. 2',
    year: 1988,
    category: 'platformers',
    meta: '1988 · Nintendo · Subcon · Pluck Veggies · 4 Heroes & Birdo',
    description:
      'Switch live between Mario, Luigi, floating Princess Peach, and Toad—pluck turnips, POW blocks, Shy Guys, and Birdo’s flying eggs to hurl them across Subcon!',
    footerLabel: 'Subcon Mechanics',
    footerSummary: '4 Playable Heroes · Pluck & Throw · Birdo',
    titleColorClass: 'text-pink-400',
    scoreColorClass: 'text-pink-200',
    borderHoverClass: 'hover:border-pink-400/50',
    buttonClass: 'bg-pink-500 hover:bg-pink-400 text-white focus-visible:ring-pink-300',
  },
  {
    id: 'smb3',
    title: 'Super Mario Bros. 3',
    year: 1988,
    category: 'platformers',
    meta: '1988 · Nintendo · Super Leaf Flight · P-Speed & Tail Spin',
    description:
      'Build P-Speed to 100% and soar into the clouds with the Super Leaf Raccoon Tail, whip foes with Tail Spins, bounce off Note Blocks, and conquer sky courses.',
    footerLabel: 'Raccoon Kit',
    footerSummary: 'P-Speed Flight · Tail Spin · ♪ Note Blocks',
    titleColorClass: 'text-yellow-400',
    scoreColorClass: 'text-yellow-200',
    borderHoverClass: 'hover:border-yellow-400/50',
    buttonClass: 'bg-yellow-400 hover:bg-yellow-300 text-slate-950 focus-visible:ring-yellow-200',
  },
  {
    id: 'sonic1',
    title: 'Sonic the Hedgehog',
    year: 1991,
    category: 'platformers',
    meta: '1991 · SEGA · Green Hill 360° Loops · Rings & Dr. Robotnik',
    description:
      'Blaze at 60fps through checkered Green Hill, Marble, and Star Light Zones—rocket through 360° Loop-de-Loops, scoop scattered Golden Rings, and smash Robotnik!',
    footerLabel: '16-Bit Speed',
    footerSummary: '360° Loops · Ring Scatter · Springs & Boss',
    titleColorClass: 'text-blue-400',
    scoreColorClass: 'text-blue-200',
    borderHoverClass: 'hover:border-blue-400/50',
    buttonClass: 'bg-blue-500 hover:bg-blue-400 text-white focus-visible:ring-blue-300',
  },
  {
    id: 'sonic2',
    title: 'Sonic the Hedgehog 2',
    year: 1992,
    category: 'platformers',
    meta: '1992 · SEGA · Spin Dash · Tails Sidekick & Super Sonic',
    description:
      'Rev and blast off with the iconic Spin Dash alongside AI sidekick Tails across Emerald Hill and Chemical Plant—then transform into golden Super Sonic at 50+ Rings!',
    footerLabel: 'Sequel Power',
    footerSummary: 'Spin Dash · AI Tails · 50-Ring Super Sonic',
    titleColorClass: 'text-sky-400',
    scoreColorClass: 'text-sky-200',
    borderHoverClass: 'hover:border-sky-400/50',
    buttonClass: 'bg-sky-400 hover:bg-sky-300 text-slate-950 focus-visible:ring-sky-200',
  },
  {
    id: 'sonic3',
    title: 'Sonic the Hedgehog 3',
    year: 1994,
    category: 'platformers',
    meta: '1994 · SEGA · Elemental Shields · Sonic / Tails / Knuckles',
    description:
      'Master Fire Dash, Electric Ring-Magnet Double-Jump, Bubble Bounce, and Insta-Shield across Angel Island & Hydrocity—switching freely between Sonic, Tails, and Knuckles!',
    footerLabel: 'Sonic 3 Tech',
    footerSummary: '3 Elemental Shields · Insta-Shield · 3 Heroes',
    titleColorClass: 'text-indigo-400',
    scoreColorClass: 'text-indigo-200',
    borderHoverClass: 'hover:border-indigo-400/50',
    buttonClass: 'bg-indigo-500 hover:bg-indigo-400 text-white focus-visible:ring-indigo-300',
  },

  // --- Action & Dungeon (6) ---
  {
    id: 'gauntlet',
    title: 'Gauntlet',
    year: 1985,
    category: 'action',
    meta: '1985 · Atari Games · 4 Heroes · Monster Generators & Death',
    description:
      'Battle endless dungeon swarms as Warrior, Valkyrie, Wizard, or Elf—collect keys, devour roast food before health drains, and unleash Magic Potions on Death.',
    footerLabel: 'Dungeon Arsenal',
    footerSummary: '4 Hero Classes · Monster Spawners · Potions',
    titleColorClass: 'text-amber-400',
    scoreColorClass: 'text-amber-200',
    borderHoverClass: 'hover:border-amber-400/50',
    buttonClass: 'bg-amber-400 hover:bg-amber-300 text-slate-950 focus-visible:ring-amber-200',
  },
  {
    id: 'gauntlet2',
    title: 'Gauntlet II',
    year: 1986,
    category: 'action',
    meta: '1986 · Atari Games · Dragons · Acid Puddles & Ricochet Shots',
    description:
      'Bank reflective shots off stone dungeon corridors, dodge glowing acid hazards, and vanquish fire-breathing Dragons guarding multi-floor treasure vaults.',
    footerLabel: 'Sequel Features',
    footerSummary: 'Ricochet Shots · Acid Traps · Fire Dragon Boss',
    titleColorClass: 'text-red-400',
    scoreColorClass: 'text-red-200',
    borderHoverClass: 'hover:border-red-400/50',
    buttonClass: 'bg-red-500 hover:bg-red-400 text-white focus-visible:ring-red-300',
  },
  {
    id: 'mappy',
    title: 'Mappy',
    year: 1983,
    category: 'action',
    meta: '1983 · Namco · 6-Story Mansion · Trampolines & Power Doors',
    description:
      'Bounce as police mouse Mappy through four color-cycling trampoline shafts, recover paired stolen treasures for 2×–6× bonuses, and sweep Goro & Meowkies with Microwave Doors.',
    footerLabel: 'Mansion Tactics',
    footerSummary: '4-Bounce Trampolines · Paired Loot · Sonic Doors',
    titleColorClass: 'text-sky-400',
    scoreColorClass: 'text-sky-200',
    borderHoverClass: 'hover:border-sky-400/50',
    buttonClass: 'bg-sky-400 hover:bg-sky-300 text-slate-950 focus-visible:ring-sky-200',
  },

  // --- Shooters & Vector Classics (10) ---
  {
    id: 'tempest',
    title: 'Tempest',
    year: 1981,
    category: 'shooters',
    meta: '1981 · Atari · 8 3D Vector Tubes · Superzapper & Spikers',
    description:
      'Spin your Blaster Claw around 3D perspective vector webs, vaporize climbing Flippers and splitting Tankers, fire your Superzapper, and survive Hyper-Tube Warp flights.',
    footerLabel: 'Vector Systems',
    footerSummary: '8 3D Webs · Spinner Mouse Aim · Superzapper',
    titleColorClass: 'text-blue-400',
    scoreColorClass: 'text-blue-200',
    borderHoverClass: 'hover:border-blue-400/50',
    buttonClass: 'bg-blue-500 hover:bg-blue-400 text-white focus-visible:ring-blue-300',
  },
  {
    id: 'tempest2000',
    title: 'Tempest 2000',
    year: 1994,
    category: 'shooters',
    meta: '1994 · Llamasoft · Psychedelic Webs · Jump Thruster & Droid',
    description:
      'Catch glowing Power-Up capsules to unlock the rapid Particle Laser, Jump Thruster to leap over rim Flippers, and an automated orbiting AI Droid wingman.',
    footerLabel: '2000 Upgrades',
    footerSummary: 'Particle Laser · Rim Jump · Orbiting AI Droid',
    titleColorClass: 'text-pink-400',
    scoreColorClass: 'text-pink-200',
    borderHoverClass: 'hover:border-pink-400/50',
    buttonClass: 'bg-pink-500 hover:bg-pink-400 text-white focus-visible:ring-pink-300',
  },
  {
    id: 'tempest3000',
    title: 'Tempest 3000',
    year: 2000,
    category: 'shooters',
    meta: '2000 · Llamasoft · Prism Glass Webs · Triple Laser & Dual Droids',
    description:
      'Dive into translucent prism-glass 3D tubes armed with Triple-Stream Prism Lasers, Jump Thrusters, and Dual AI Droids in explosive 60fps vector splendor.',
    footerLabel: '3000 Systems',
    footerSummary: 'Prism Glass Tubes · Triple Laser · Dual Droids',
    titleColorClass: 'text-cyan-400',
    scoreColorClass: 'text-cyan-200',
    borderHoverClass: 'hover:border-cyan-400/50',
    buttonClass: 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 focus-visible:ring-cyan-200',
  },
  {
    id: 'defender',
    title: 'Defender',
    year: 1981,
    category: 'shooters',
    meta: '1981 · Williams · Wrap-Around Scanner · Smart Bombs',
    description:
      'Patrol a seamless wrap-around alien world with the iconic top Scanner Radar—intercept abducting Landers, catch falling Humanoids mid-air, and detonate Smart Bombs.',
    footerLabel: 'Defender Kit',
    footerSummary: 'Full-World Radar · Mid-Air Rescues · Smart Bombs',
    titleColorClass: 'text-amber-400',
    scoreColorClass: 'text-amber-200',
    borderHoverClass: 'hover:border-amber-400/50',
    buttonClass: 'bg-amber-400 hover:bg-amber-300 text-slate-950 focus-visible:ring-amber-200',
  },
  {
    id: 'defender2',
    title: 'Defender II',
    year: 1981,
    category: 'shooters',
    meta: '1981 · Williams · Inviso Cloak · Warp Gate & Firebombers',
    description:
      'Williams’ turbocharged sequel adds a rechargeable Inviso Cloak that lets you ram enemies unscathed, a central Warp Gate for instant rescues, and tracking Firebombers.',
    footerLabel: 'Sequel Tech',
    footerSummary: 'Inviso Cloak (R) · Rescue Warp Gate · Firebombers',
    titleColorClass: 'text-purple-400',
    scoreColorClass: 'text-purple-200',
    borderHoverClass: 'hover:border-purple-400/50',
    buttonClass: 'bg-purple-500 hover:bg-purple-400 text-white focus-visible:ring-purple-300',
  },
  {
    id: 'stargate',
    title: 'Stargate',
    year: 1981,
    category: 'shooters',
    meta: '1981 · Williams · Stargate Hyperspace · Inviso Cloak & Pods',
    description:
      'Dive into the shimmering cyan Stargate portal to warp straight to kidnapped Humanoids—or trigger a 2,000-point Wave Warp while battling Swarmers and Baiters.',
    footerLabel: 'Stargate Systems',
    footerSummary: 'Hyperspace Warp · Inviso Cloak · Smart Bombs',
    titleColorClass: 'text-sky-400',
    scoreColorClass: 'text-sky-200',
    borderHoverClass: 'hover:border-sky-400/50',
    buttonClass: 'bg-sky-400 hover:bg-sky-300 text-slate-950 focus-visible:ring-sky-200',
  },

  // --- Arcade Racing (5) ---
  {
    id: 'polepos',
    title: 'Pole Position',
    year: 1982,
    category: 'racing',
    meta: '1982 · Namco · 3D Fuji Speedway · LO/HI 2-Speed Gearbox',
    description:
      'Blaze around Mount Fuji Speedway in smooth pseudo-3D scanline road projection—shift from LO to HI gear at 170 km/h, thread F1 traffic, and beat the lap clock.',
    footerLabel: 'Grand Prix',
    footerSummary: 'Fuji Circuit · LO/HI Shifting · Time Extensions',
    titleColorClass: 'text-red-400',
    scoreColorClass: 'text-red-200',
    borderHoverClass: 'hover:border-red-400/50',
    buttonClass: 'bg-red-500 hover:bg-red-400 text-white focus-visible:ring-red-300',
  },
  {
    id: 'polepos2',
    title: 'Pole Position II',
    year: 1983,
    category: 'racing',
    meta: '1983 · Namco · 4 Grand Prix Tracks · Seaside & Suzuka',
    description:
      'Conquer four distinct 3D championship tracks—Seaside, Fuji, Test Speedway, and technical Suzuka—with crisp corner signage, vibrant skies, and high-speed overtakes.',
    footerLabel: '4 Circuits',
    footerSummary: 'Seaside · Fuji · Test Speedway · Suzuka',
    titleColorClass: 'text-sky-400',
    scoreColorClass: 'text-sky-200',
    borderHoverClass: 'hover:border-sky-400/50',
    buttonClass: 'bg-sky-400 hover:bg-sky-300 text-slate-950 focus-visible:ring-sky-200',
  },
  {
    id: 'sprint',
    title: 'Sprint 2',
    year: 1976,
    category: 'racing',
    meta: '1976 · Atari / Kee Games · Monochrome Overhead Drift Racer',
    description:
      'Experience the 1976 overhead arcade pioneer in razor-sharp phosphor monochrome—master smooth drift cornering, dodge slick oil spills, and outpace three rival cars.',
    footerLabel: 'Classic Spec',
    footerSummary: 'Phosphor Visuals · 3 Circuits · Drift Physics',
    titleColorClass: 'text-slate-200',
    scoreColorClass: 'text-slate-200',
    borderHoverClass: 'hover:border-slate-300/50',
    buttonClass: 'bg-slate-200 hover:bg-white text-slate-950 focus-visible:ring-slate-300',
  },
  {
    id: 'supersprint',
    title: 'Super Sprint',
    year: 1986,
    category: 'racing',
    meta: '1986 · Atari Games · Golden Wrenches · Upgrades & Tornadoes',
    description:
      'Snatch gleaming golden Wrenches mid-race to upgrade Top Speed, Turbo Acceleration, and Traction while weaving past mini-tornadoes and three fierce Indy rivals.',
    footerLabel: 'Pit Upgrades',
    footerSummary: 'Wrench Upgrades · Mini-Tornadoes · 3 AI Rivals',
    titleColorClass: 'text-yellow-400',
    scoreColorClass: 'text-yellow-200',
    borderHoverClass: 'hover:border-yellow-400/50',
    buttonClass: 'bg-yellow-400 hover:bg-yellow-300 text-slate-950 focus-visible:ring-yellow-200',
  },
  {
    id: 'champsprint',
    title: 'Championship Sprint',
    year: 1986,
    category: 'racing',
    meta: '1986 · Atari Games · Timed Shortcut Gates · Water & Oil',
    description:
      'Time your entry through opening inner shortcut gates on pro circuits packed with water puddles, oil slicks, and tighter apexes to claim the championship cup.',
    footerLabel: 'Pro Circuits',
    footerSummary: 'Timed Shortcut Gate · Water & Oil · Upgrades',
    titleColorClass: 'text-green-400',
    scoreColorClass: 'text-green-200',
    borderHoverClass: 'hover:border-green-400/50',
    buttonClass: 'bg-green-400 hover:bg-green-300 text-slate-950 focus-visible:ring-green-200',
  },

  // --- Earlier Shooters & Action Classics (7) ---
  {
    id: 'centipede',
    title: 'Centipede',
    year: 1981,
    category: 'shooters',
    meta: '1981 · Atari · Splitting Chains · Spiders & Scorpions',
    description:
      'Blast winding centipede chains through a destructible mushroom garden while fending off bouncing spiders, mushroom-dropping fleas, and poisoning scorpions.',
    footerLabel: 'Arcade Features',
    footerSummary: 'Mouse + Keys · Splitting Chains · 4 Color Waves',
    titleColorClass: 'text-lime-400',
    scoreColorClass: 'text-lime-200',
    borderHoverClass: 'hover:border-lime-400/50',
    buttonClass: 'bg-lime-400 hover:bg-lime-300 text-slate-950 focus-visible:ring-lime-200',
  },
  {
    id: 'millipede',
    title: 'Millipede',
    year: 1982,
    category: 'shooters',
    meta: '1982 · Atari · DDT Bombs · Inchworm Slow-Mo',
    description:
      'Detonate volatile DDT canisters for massive 3× blast clouds, freeze time by shooting inchworms, and survive beetles, mosquitoes, and earwigs.',
    footerLabel: 'Sequel Upgrades',
    footerSummary: 'Chain DDT Blasts · Slow-Mo · Swarm Scroll',
    titleColorClass: 'text-orange-400',
    scoreColorClass: 'text-orange-200',
    borderHoverClass: 'hover:border-orange-400/50',
    buttonClass: 'bg-orange-500 hover:bg-orange-400 text-slate-950 focus-visible:ring-orange-200',
  },
  {
    id: 'digdug',
    title: 'Dig Dug',
    year: 1982,
    category: 'action',
    meta: '1982 · Namco · Air Pump Harpoon · Falling Rocks',
    description:
      'Carve tunnels through four stratified soil layers, inflate Pookas and fire-breathing Fygars until they pop, or drop boulders to crush monsters for huge bonuses.',
    footerLabel: 'Underground Tactics',
    footerSummary: '4-Stage Pump · Ghost Phasing · Rock Crush',
    titleColorClass: 'text-sky-400',
    scoreColorClass: 'text-sky-200',
    borderHoverClass: 'hover:border-sky-400/50',
    buttonClass: 'bg-sky-400 hover:bg-sky-300 text-slate-950 focus-visible:ring-sky-200',
  },
  {
    id: 'boulderdash',
    title: 'Boulder Dash',
    year: 1984,
    category: 'action',
    meta: '1984 · First Star · 5 Caves · Cellular Rock Physics',
    description:
      'Guide Rockford through five scrolling underground caves with authentic falling and rolling rock physics, fireflies, diamond-bursting butterflies, and snap-digging.',
    footerLabel: 'Mine Mechanics',
    footerSummary: '5 Solvable Caves · Snap-Dig · Butterfly Gems',
    titleColorClass: 'text-purple-400',
    scoreColorClass: 'text-purple-200',
    borderHoverClass: 'hover:border-purple-400/50',
    buttonClass: 'bg-purple-500 hover:bg-purple-400 text-white focus-visible:ring-purple-300',
  },
  {
    id: 'invaders',
    title: 'Space Invaders',
    year: 1978,
    category: 'shooters',
    meta: '1978 · Taito · 55-Alien March · Destructible Bunkers',
    description:
      'Defend Earth against an accelerating 5×11 alien armada with a throbbing 4-note bass march, pixel-eroding shield bunkers, and the 300-point Red Mystery UFO.',
    footerLabel: 'Classic Arsenal',
    footerSummary: '4 Erosive Bunkers · Shot Intercept · 300pt UFO',
    titleColorClass: 'text-green-400',
    scoreColorClass: 'text-green-200',
    borderHoverClass: 'hover:border-green-400/50',
    buttonClass: 'bg-green-500 hover:bg-green-400 text-slate-950 focus-visible:ring-green-200',
  },
  {
    id: 'invaders2',
    title: 'Space Invaders II',
    year: 1979,
    category: 'shooters',
    meta: '1979 · Taito · Splitting Invaders · Dropship UFO',
    description:
      'Face full-color splitting Command Invaders that cleave into twin divers, intercept golden reinforcement dropships, and earn the 500-point Rainbow Bonus.',
    footerLabel: 'Part II Features',
    footerSummary: 'Split Divers · Cloak & Dropship UFO · Rainbow Bonus',
    titleColorClass: 'text-cyan-400',
    scoreColorClass: 'text-cyan-200',
    borderHoverClass: 'hover:border-cyan-400/50',
    buttonClass: 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 focus-visible:ring-cyan-200',
  },
  {
    id: 'foodfight',
    title: 'Food Fight',
    year: 1983,
    category: 'action',
    meta: '1983 · Atari · 4 Pursuing Chefs · Melting Cone',
    description:
      'Sprint as Charley Chuck across the town square to eat the giant melting ice cream cone before Oscar, Angelo, Jacques, and Zorba catch you—hurling pies and melons back!',
    footerLabel: 'Plaza Chaos',
    footerSummary: '7 Food Piles · Chef Holes · Instant Replay Bonus',
    titleColorClass: 'text-rose-400',
    scoreColorClass: 'text-rose-200',
    borderHoverClass: 'hover:border-rose-400/50',
    buttonClass: 'bg-rose-500 hover:bg-rose-400 text-white focus-visible:ring-rose-300',
  },

  // --- Pac-Man Series (6) ---
  {
    id: 'classic',
    title: 'Pac-Man',
    year: 1980,
    category: 'pacman',
    meta: '1980 · Namco · Original Cobalt Maze · Classic 4 Ghosts',
    description:
      'The iconic 1980 arcade original remastered in crisp 60fps vector HD with Blinky, Pinky, Inky, and Clyde plus escalating center bonus items.',
    footerLabel: 'Bonus Items',
    titleColorClass: 'text-blue-400',
    scoreColorClass: 'text-blue-200',
    borderHoverClass: 'hover:border-blue-400/50',
    buttonClass: 'bg-blue-500 hover:bg-blue-400 text-white focus-visible:ring-blue-300',
  },
  {
    id: 'plus',
    title: 'Pac-Man Plus',
    year: 1982,
    category: 'pacman',
    meta: '1982 · Midway · Emerald Maze · Wildcard Energizers',
    description:
      'Midway’s faster, trickier sequel: chomp Soda Cans and Pea Pods to turn ghosts invisible for 2× points, and survive vanishing mazes and stubborn hunters.',
    footerLabel: '2× Power Treats',
    titleColorClass: 'text-emerald-400',
    scoreColorClass: 'text-emerald-200',
    borderHoverClass: 'hover:border-emerald-400/50',
    buttonClass: 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 focus-visible:ring-emerald-200',
  },
  {
    id: 'ms',
    title: 'Ms. Pac-Man',
    year: 1982,
    category: 'pacman',
    meta: '1982 · Midway · 4 Classic Mazes · Roaming Fruits',
    description:
      'Outsmart Blinky, Pinky, Inky, and Sue across four vibrant neon mazes with dual warp tunnels and bouncing fruits that sweep through the corridors.',
    footerLabel: 'Bonus Fruits',
    titleColorClass: 'text-amber-300',
    scoreColorClass: 'text-amber-200',
    borderHoverClass: 'hover:border-amber-400/50',
    buttonClass: 'bg-amber-400 hover:bg-amber-300 text-slate-950 focus-visible:ring-amber-200',
  },
  {
    id: 'super',
    title: 'Super Pac-Man',
    year: 1982,
    category: 'pacman',
    meta: '1982 · Namco · Keys & Locked Vaults · Giant Super Mode',
    description:
      'Collect golden keys to unlock sealed treasure chambers—or chomp a Green Super Pellet to grow giant, smash straight through locked gates, and turbo dash.',
    footerLabel: 'Vault Treasures',
    titleColorClass: 'text-green-400',
    scoreColorClass: 'text-green-200',
    borderHoverClass: 'hover:border-green-400/50',
    buttonClass: 'bg-green-500 hover:bg-green-400 text-slate-950 focus-visible:ring-green-200',
  },
  {
    id: 'jr',
    title: 'Jr. Pac-Man',
    year: 1983,
    category: 'pacman',
    meta: '1983 · Midway · 2× Wide Scrolling Mazes · Mutating Dots',
    description:
      'Navigate double-wide scrolling labyrinths with zero warp tunnels, 50-point mutating super dots, roaming toys, and a live tactical minimap radar.',
    footerLabel: 'Roaming Toys',
    titleColorClass: 'text-teal-300',
    scoreColorClass: 'text-teal-200',
    borderHoverClass: 'hover:border-teal-400/50',
    buttonClass: 'bg-teal-400 hover:bg-teal-300 text-slate-950 focus-visible:ring-teal-200',
  },
  {
    id: 'pacmania',
    title: 'Pac-Mania',
    year: 1987,
    category: 'pacman',
    meta: '1987 · Namco · Isometric 3D Worlds · Jump Over Ghosts',
    description:
      'Explore four extruded 3D worlds from Block Town to Jungly Steps and leap right over pursuing ghosts—while watching out for synced jumpers Funky and Spunky.',
    footerLabel: '3D Worlds',
    footerSummary: 'Block Town · Park · Sandbox Land · Jungly Steps',
    titleColorClass: 'text-pink-400',
    scoreColorClass: 'text-pink-200',
    borderHoverClass: 'hover:border-pink-400/50',
    buttonClass: 'bg-pink-500 hover:bg-pink-400 text-white focus-visible:ring-pink-300',
  },
];

const QUICK_NAV_IDS: GameId[] = ['mariobros', 'dkong', 'smb1', 'smb3', 'sonic1', 'sonic2'];

const FILTER_TABS: Array<{ id: FilterCategory; label: string }> = [
  { id: 'all', label: 'All 37' },
  { id: 'platformers', label: 'Platformers (10)' },
  { id: 'shooters', label: 'Shooters (10)' },
  { id: 'action', label: 'Action (6)' },
  { id: 'racing', label: 'Racing (5)' },
  { id: 'pacman', label: 'Pac-Man (6)' },
];

export default function ArcadeHub() {
  const [screen, setScreen] = useState<ActiveScreen>('select');
  const [filter, setFilter] = useState<FilterCategory>('all');
  const [isStandaloneFile, setIsStandaloneFile] = useState(false);
  const [highScores, setHighScores] = useState<ScoreMap>(createZeroScores);

  const handleSelectGame = useCallback((next: ActiveScreen) => {
    arcadeAudio.stopAmbient();
    if (next !== 'select') {
      arcadeAudio.unlock();
      if (typeof window !== 'undefined' && window.location.hash !== `#${next}`) {
        window.location.hash = next;
      }
    } else {
      setHighScores(loadAllHighScores());
      if (typeof window !== 'undefined' && window.location.hash) {
        if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
          window.history.pushState(null, '', window.location.pathname + window.location.search);
        } else {
          window.location.hash = '';
        }
      }
    }
    setScreen(next);
  }, []);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      setIsStandaloneFile(window.location.protocol === 'file:');
      setHighScores(loadAllHighScores());
      const initialScreen = parseHashToScreen(window.location.hash);
      if (initialScreen !== 'select') {
        setScreen(initialScreen);
      }
    });

    const syncFromUrl = () => {
      arcadeAudio.stopAmbient();
      const target = parseHashToScreen(window.location.hash);
      if (target === 'select') {
        setHighScores(loadAllHighScores());
      }
      setScreen(target);
    };

    window.addEventListener('hashchange', syncFromUrl);
    window.addEventListener('popstate', syncFromUrl);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('hashchange', syncFromUrl);
      window.removeEventListener('popstate', syncFromUrl);
    };
  }, []);

  useEffect(() => {
    if (screen !== 'select') return;
    const rafId = window.requestAnimationFrame(() => {
      setHighScores(loadAllHighScores());
    });
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [screen]);

  if (screen !== 'select' && isClassicArcadeGameId(screen)) {
    return (
      <ClassicArcadeShell
        gameId={screen}
        onSwitchGame={(g) => handleSelectGame(g)}
        onOpenLobby={() => handleSelectGame('select')}
      />
    );
  }
  if (screen === 'classic') {
    return (
      <ClassicPacManArcade
        onSwitchGame={(g) => handleSelectGame(g)}
        onOpenLobby={() => handleSelectGame('select')}
      />
    );
  }
  if (screen === 'plus') {
    return (
      <PacManPlusArcade
        onSwitchGame={(g) => handleSelectGame(g)}
        onOpenLobby={() => handleSelectGame('select')}
      />
    );
  }
  if (screen === 'ms') {
    return (
      <MsPacManArcade
        onSwitchGame={(g) => handleSelectGame(g)}
        onOpenLobby={() => handleSelectGame('select')}
      />
    );
  }
  if (screen === 'super') {
    return (
      <SuperPacManArcade
        onSwitchGame={(g) => handleSelectGame(g)}
        onOpenLobby={() => handleSelectGame('select')}
      />
    );
  }
  if (screen === 'jr') {
    return (
      <JrPacManArcade
        onSwitchGame={(g) => handleSelectGame(g)}
        onOpenLobby={() => handleSelectGame('select')}
      />
    );
  }
  if (screen === 'pacmania') {
    return (
      <PacManiaArcade
        onSwitchGame={(g) => handleSelectGame(g)}
        onOpenLobby={() => handleSelectGame('select')}
      />
    );
  }

  const visibleCards =
    filter === 'all' ? CABINET_CARDS : CABINET_CARDS.filter((c) => c.category === filter);

  const renderFooterRoster = (card: CabinetCardConfig) => {
    if (card.id === 'classic') {
      return (
        <div className="flex items-center justify-between pt-3 border-t border-white/[0.07]">
          <span className="text-xs text-slate-400">{card.footerLabel}</span>
          <div className="flex items-center gap-1.5">
            {CLASSIC_BONUS_ORDER.slice(0, 6).map((bt) => (
              <ClassicBonusEmblem key={bt} type={bt} size={20} />
            ))}
          </div>
        </div>
      );
    }
    if (card.id === 'plus') {
      return (
        <div className="flex items-center justify-between pt-3 border-t border-white/[0.07]">
          <span className="text-xs text-slate-400">{card.footerLabel}</span>
          <div className="flex items-center gap-1.5">
            {PLUS_BONUS_ORDER.slice(0, 6).map((bt) => (
              <PlusBonusEmblem key={bt} type={bt} size={20} />
            ))}
          </div>
        </div>
      );
    }
    if (card.id === 'ms') {
      return (
        <div className="flex items-center justify-between pt-3 border-t border-white/[0.07]">
          <span className="text-xs text-slate-400">{card.footerLabel}</span>
          <div className="flex items-center gap-1.5">
            {LEVEL_FRUIT_ORDER.map((ft) => (
              <FruitEmblem key={ft} type={ft} size={20} />
            ))}
          </div>
        </div>
      );
    }
    if (card.id === 'super') {
      return (
        <div className="flex items-center justify-between pt-3 border-t border-white/[0.07]">
          <span className="text-xs text-slate-400">{card.footerLabel}</span>
          <div className="flex items-center gap-1.5">
            {SUPER_PRIZE_ORDER.slice(0, 6).map((pt) => (
              <SuperPrizeEmblem key={pt} type={pt} size={20} />
            ))}
          </div>
        </div>
      );
    }
    if (card.id === 'jr') {
      return (
        <div className="flex items-center justify-between pt-3 border-t border-white/[0.07]">
          <span className="text-xs text-slate-400">{card.footerLabel}</span>
          <div className="flex items-center gap-1.5">
            {JR_LEVEL_PRIZE_ORDER.map((pt) => (
              <JrPrizeEmblem key={pt} type={pt} size={20} />
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-between gap-2 pt-3 border-t border-white/[0.07]">
        <span className="text-xs text-slate-400 shrink-0">{card.footerLabel}</span>
        <span className="text-xs text-slate-300 font-medium truncate">
          {card.footerSummary}
        </span>
      </div>
    );
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[#060811] text-slate-100 flex flex-col">
      {/* Clean 3-Zone Top Bar */}
      <header className="w-full border-b border-white/[0.07] bg-[#080B16]/90 backdrop-blur-md">
        <div className="mx-auto max-w-[1360px] px-5 sm:px-8 h-16 flex items-center justify-between gap-8">
          <span
            className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
            style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
          >
            Retro Arcade Collection
          </span>

          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-400">
            {QUICK_NAV_IDS.map((id) => {
              const cab = CABINET_CARDS.find((c) => c.id === id)!;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleSelectGame(id)}
                  className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {cab.title}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center shrink-0">
            {!isStandaloneFile ? (
              <a
                href="/arcade-index.html"
                download="index.html"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-white/12 bg-white/[0.05] hover:bg-white/[0.1] text-xs font-medium text-slate-100 transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download index.html</span>
              </a>
            ) : (
              <span className="text-xs text-slate-400 whitespace-nowrap shrink-0">
                37 Cabinets · 60fps HiDPI
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Selection Floor */}
      <main className="flex-1 w-full mx-auto max-w-[1360px] px-5 sm:px-8 py-8 sm:py-10">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-7 sm:mb-9">
          <div className="max-w-2xl space-y-2">
            <h1
              className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white text-balance"
              style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
            >
              Choose Your Cabinet
            </h1>
            <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
              Thirty-seven Golden Age arcade &amp; console classics remastered at high resolution and locked 60fps—featuring Mario Bros., Donkey Kong 1/Jr./3, Super Mario Bros. 1/2/3, Sonic 1/2/3, Gauntlet, Pole Position, Sprint, Defender, Stargate, Tempest, Mappy, Centipede, Dig Dug, Space Invaders, and the full Pac-Man series.
            </p>
          </div>

          {/* Interactive Category Filter Control */}
          <div
            role="tablist"
            aria-label="Filter arcade cabinets"
            className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#0B0F1D] border border-white/[0.08] self-start lg:self-auto shrink-0"
          >
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={filter === tab.id}
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  filter === tab.id
                    ? 'bg-white text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Live 60fps Preview Cabinet Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 xl:gap-6 items-stretch">
          {visibleCards.map((card, idx) => (
            <motion.article
              key={card.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: Math.min(idx, 6) * 0.03, ease: [0.16, 1, 0.3, 1] }}
              className={`group flex flex-col rounded-2xl bg-[#0B0F1D] border border-white/[0.08] ${card.borderHoverClass} transition-colors overflow-hidden`}
            >
              {/* Live 60fps HiDPI Preview */}
              <div
                onClick={() => handleSelectGame(card.id)}
                role="button"
                tabIndex={-1}
                className="relative w-full h-48 sm:h-52 overflow-hidden bg-[#04060D] border-b border-white/[0.07] cursor-pointer"
              >
                <CabinetPreviewCanvas game={card.id} />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0B0F1D] via-transparent to-black/20" />
              </div>

              {/* Card Body */}
              <div className="flex-1 p-5 sm:p-6 flex flex-col justify-between gap-5">
                <div className="space-y-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <GameEmblem gameId={card.id} size={38} />
                      <div className="min-w-0">
                        <h2
                          className={`text-xl sm:text-2xl font-bold tracking-tight truncate ${card.titleColorClass}`}
                          style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                        >
                          {card.title}
                        </h2>
                        <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                          {card.meta}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-[11px] text-slate-500">High Score</div>
                      <div
                        className={`font-mono tabular-nums text-sm sm:text-base font-semibold ${card.scoreColorClass}`}
                      >
                        {highScores[card.id].toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-slate-300 leading-relaxed">
                    {card.description}
                  </p>

                  {renderFooterRoster(card)}
                </div>

                <button
                  type="button"
                  onClick={() => handleSelectGame(card.id)}
                  className={`w-full py-3 px-5 rounded-xl active:scale-[0.99] font-bold text-sm flex items-center justify-center gap-2 transition-all focus-visible:outline-none focus-visible:ring-2 whitespace-nowrap cursor-pointer ${card.buttonClass}`}
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Play {card.title}</span>
                </button>
              </div>
            </motion.article>
          ))}
        </div>

        <p className="mt-8 text-xs text-slate-500 text-center">
          Switch between all 37 cabinets anytime from the left rail or return here via the top bar
        </p>
      </main>
    </div>
  );
}

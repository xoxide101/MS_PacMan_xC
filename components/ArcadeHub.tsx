'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowDownAZ,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  LayoutGrid,
  Play,
  Search,
  Shuffle,
  X,
} from 'lucide-react';
import { CABINET_LIST, CabinetCategory, GameId } from '@/lib/game/arcadeTypes';
import { arcadeAudio } from '@/lib/game/audio';
import { CLASSIC_BONUS_ORDER } from '@/lib/game/classicEngine';
import { isClassicArcadeGameId } from '@/lib/game/classicRegistry';
import { arcadeMusic } from '@/lib/game/musicEngine';
import { JR_LEVEL_PRIZE_ORDER } from '@/lib/game/jrTypes';
import { PLUS_BONUS_ORDER } from '@/lib/game/plusEngine';
import { SUPER_PRIZE_ORDER } from '@/lib/game/superTypes';
import { LEVEL_FRUIT_ORDER } from '@/lib/game/types';
import CabinetPreviewCanvas from './CabinetPreviewCanvas';
import ClassicArcadeShell from './ClassicArcadeShell';
import ClassicPacManArcade from './ClassicPacManArcade';
import GauntletDarkLegacy3D from './GauntletDarkLegacy3D';
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
  // --- Featured Modern Evolution & Iconic Classics ---
  {
    id: 'breakout2016evo',
    title: 'Breakout 2016 Evo',
    year: 2016,
    category: 'puzzle',
    meta: '2016 · Llamasoft / Evo · Melt-O-Vision · Warlords Citadels & Tempest Webs',
    description:
      'A blazing modern breakout fusing Tempest 2000 Melt-O-Vision feedback trails, Warlords 4-corner AI Citadels with hold-to-charge Fireball slinging, Superzapper lightning, A.I. Droid wingmen, 9 Evo Capsules, and an evolved DOH-Pulsar boss.',
    footerLabel: '4-Way Fusion',
    footerSummary: 'Melt-O-Vision · Warlords Siege · Superzapper · Evo Capsules',
    titleColorClass: 'text-pink-400',
    scoreColorClass: 'text-pink-200',
    borderHoverClass: 'hover:border-pink-400/50',
    buttonClass: 'bg-pink-500 hover:bg-pink-400 text-white focus-visible:ring-pink-300',
  },
  {
    id: 'puzzlebobble3',
    title: 'Puzzle Bobble Evo',
    year: 1998,
    category: 'puzzle',
    meta: '2.5D Prism Evolution · Pulley Scales · Rainbow, Bomb, Lightning & Crystal Boss',
    description:
      'A sparkling 2.5D evolution of Taito’s beloved bubble puzzler featuring animated Bub & Bob dragons, Rainbow Prism wildcards, Bomb & Lightning orbs, Twin Pulley Balance Scales, Rainbow Fever ×2, and a Stage 6 Crystal Boss Core!',
    footerLabel: '2.5D Evolution',
    footerSummary: 'Pulley Scales · Prism Fever · Rainbow/Bomb/Bolt · Boss',
    titleColorClass: 'text-yellow-400',
    scoreColorClass: 'text-yellow-200',
    borderHoverClass: 'hover:border-yellow-400/50',
    buttonClass: 'bg-yellow-400 hover:bg-yellow-300 text-slate-950 focus-visible:ring-yellow-200',
  },
  {
    id: 'puzzlebobble2',
    title: 'Puzzle Bobble 2',
    year: 1995,
    category: 'puzzle',
    meta: '1995 · Taito · Bust-A-Move Again 2.5D · Star Bubbles · Fairy Rescue & Iron Balls',
    description:
      'Classic Bust-A-Move Again rebuilt in luminous 2.5D! Detonate Star Bubbles to clear whole colors, rescue trapped winged Chack’n Fairies, drop riveted Iron Balls via avalanches, and swap active orbs on the fly.',
    footerLabel: 'Star & Fairy 2.5D',
    footerSummary: 'Star Color-Clear · Fairy Hubs · Iron Balls · Orb Swap',
    titleColorClass: 'text-pink-400',
    scoreColorClass: 'text-pink-200',
    borderHoverClass: 'hover:border-pink-400/50',
    buttonClass: 'bg-pink-500 hover:bg-pink-400 text-white focus-visible:ring-pink-300',
  },
  {
    id: 'puzzlebobble',
    title: 'Puzzle Bobble',
    year: 1994,
    category: 'puzzle',
    meta: '1994 · Taito · 2.5D Shimmer Edition · Animated Bub & Bob · Bank Shots & Avalanches',
    description:
      'The 1994 Taito bubble-popping icon lovingly elevated to 2.5D with shimmering glass orbs, cute inner color icons, animated Bub & Bob cranking the geared launcher, and bouncing gravity avalanches!',
    footerLabel: '2.5D Classic',
    footerSummary: 'Shimmer Orbs · Bub & Bob · Bank Shots · Avalanches',
    titleColorClass: 'text-emerald-400',
    scoreColorClass: 'text-emerald-200',
    borderHoverClass: 'hover:border-emerald-400/50',
    buttonClass: 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 focus-visible:ring-emerald-200',
  },
  {
    id: 'starwars',
    title: 'Star Wars',
    year: 1983,
    category: 'shooters',
    meta: '1983 · Atari · Quadrascan 3D Color Vector · X-Wing Red Five',
    description:
      'Authentic glowing 3D color-vector X-Wing cockpit—dogfight TIEs & Darth Vader, decapitate Death Star surface towers, and fire proton torpedoes down the Exhaust Port.',
    footerLabel: '1983 Color Vector',
    footerSummary: 'TIE & Vader · Surface Towers · Vector Supernova',
    titleColorClass: 'text-yellow-400',
    scoreColorClass: 'text-yellow-200',
    borderHoverClass: 'hover:border-yellow-400/50',
    buttonClass: 'bg-yellow-400 hover:bg-yellow-300 text-slate-950 focus-visible:ring-yellow-200',
  },
  {
    id: 'starwarsesb',
    title: 'Star Wars: Empire Strikes Back',
    year: 1985,
    category: 'shooters',
    meta: '1985 · Atari Games · Hoth 3D Color Vector · AT-AT Walkers',
    description:
      'Distinct icy-vector Battle of Hoth—snipe Viper Probe Droids, wrap AT-AT Walker legs with your Harpoon Tow-Cable, dodge TIE Bomber mines, and spell J-E-D-I in the Asteroid Field.',
    footerLabel: '1985 Hoth Vector',
    footerSummary: 'Tow-Cable AT-AT · TIE Bombers · Star Destroyer',
    titleColorClass: 'text-sky-400',
    scoreColorClass: 'text-sky-200',
    borderHoverClass: 'hover:border-sky-400/50',
    buttonClass: 'bg-sky-400 hover:bg-sky-300 text-slate-950 focus-visible:ring-sky-200',
  },
  {
    id: 'starwarsrotj',
    title: 'Star Wars: Return of the Jedi',
    year: 1984,
    category: 'shooters',
    meta: '1984 · Atari Games · 2.5D Isometric Raster · 3 Playable Vehicles',
    description:
      'Vibrant 2.5D diagonal-isometric shaded raster graphics—race Endor on Leia’s Speeder Bike, stomp Imperial bunkers in Chewbacca’s hijacked AT-ST, and outrun the Death Star II fireball in the Falcon!',
    footerLabel: '1984 2.5D Raster',
    footerSummary: 'Speeder Bike · Hijacked AT-ST · Falcon Escape',
    titleColorClass: 'text-green-400',
    scoreColorClass: 'text-green-200',
    borderHoverClass: 'hover:border-green-400/50',
    buttonClass: 'bg-green-500 hover:bg-green-400 text-slate-950 focus-visible:ring-green-200',
  },
  {
    id: 'galaga',
    title: 'Galaga',
    year: 1981,
    category: 'shooters',
    meta: '1981 · Namco · Tractor Beam Capture · Dual Fighter',
    description:
      'Blast sweeping alien formations, rescue a captured fighter from Boss Galaga’s Tractor Beam to fly Dual Fighter, and chase perfection on Challenging Stages.',
    footerLabel: 'Starfighter Tech',
    footerSummary: 'Dual Fighter Rescue · Boss Galaga · Bonus Waves',
    titleColorClass: 'text-sky-400',
    scoreColorClass: 'text-sky-200',
    borderHoverClass: 'hover:border-sky-400/50',
    buttonClass: 'bg-sky-400 hover:bg-sky-300 text-slate-950 focus-visible:ring-sky-200',
  },
  {
    id: 'galaxian',
    title: 'Galaxian',
    year: 1979,
    category: 'shooters',
    meta: '1979 · Namco · Swooping Flagships · Red Escorts',
    description:
      'Namco’s vibrant RGB starfield pioneer—time single precision shots to down diving Golden Flagships with their Red Escorts for the iconic 800-point bonus.',
    footerLabel: 'Formation Combat',
    footerSummary: 'Diving Escorts · 800pt Flagship · Deep Space',
    titleColorClass: 'text-yellow-400',
    scoreColorClass: 'text-yellow-200',
    borderHoverClass: 'hover:border-yellow-400/50',
    buttonClass: 'bg-yellow-400 hover:bg-yellow-300 text-slate-950 focus-visible:ring-yellow-200',
  },
  {
    id: 'gyruss',
    title: 'Gyruss',
    year: 1983,
    category: 'shooters',
    meta: '1983 · Konami · 360° Orbital Tube · Baroque Synth Rock',
    description:
      'Orbit 360 degrees around a deep-space tunnel accompanied by synthesized Baroque D-minor synth-rock, upgrading to twin lasers as you warp from Neptune to Earth.',
    footerLabel: 'Orbital Warp',
    footerSummary: '360° Rim Flight · Twin Laser · Solar Planets',
    titleColorClass: 'text-cyan-400',
    scoreColorClass: 'text-cyan-200',
    borderHoverClass: 'hover:border-cyan-400/50',
    buttonClass: 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 focus-visible:ring-cyan-200',
  },
  {
    id: 'phoenix',
    title: 'Phoenix',
    year: 1980,
    category: 'shooters',
    meta: '1980 · Amstar · Force Shield · Giant Mothership Boss',
    description:
      'Battle five distinct alien bird waves with an invulnerable Force Shield before carving through the armored rotating belt of arcade history’s first giant Mothership.',
    footerLabel: '5-Wave Cycle',
    footerSummary: 'Force Shield · Regenerating Birds · Mothership',
    titleColorClass: 'text-orange-400',
    scoreColorClass: 'text-orange-200',
    borderHoverClass: 'hover:border-orange-400/50',
    buttonClass: 'bg-orange-500 hover:bg-orange-400 text-slate-950 focus-visible:ring-orange-200',
  },
  {
    id: 'smw1',
    title: 'Super Mario World',
    year: 1990,
    category: 'platformers',
    meta: '1990 · Nintendo · Dinosaur Land · Yoshi & Cape Feather',
    description:
      'Ride Yoshi across Dinosaur Land, gulp Koopas with Yoshi’s tongue, glide through the skies with the golden Cape Feather, and hunt all 5 Dragon Coins.',
    footerLabel: '16-Bit Classic',
    footerSummary: 'Ride Yoshi · Cape Glide · 5 Dragon Coins',
    titleColorClass: 'text-yellow-400',
    scoreColorClass: 'text-yellow-200',
    borderHoverClass: 'hover:border-yellow-400/50',
    buttonClass: 'bg-yellow-400 hover:bg-yellow-300 text-slate-950 focus-visible:ring-yellow-200',
  },
  {
    id: 'smw2',
    title: 'Yoshi’s Island (SMW 2)',
    year: 1995,
    category: 'platformers',
    meta: '1995 · Nintendo · Flutter Jump · Aimed Eggs & Baby Mario',
    description:
      'Bound across storybook pastel hills with Yoshi’s signature Flutter Jump, swallow Shy Guys to build trailing Eggs, aim ricochets at winged clouds, and protect Baby Mario.',
    footerLabel: 'Storybook Kit',
    footerSummary: 'Flutter Jump · 6-Egg Chain · Baby Mario Rescue',
    titleColorClass: 'text-green-400',
    scoreColorClass: 'text-green-200',
    borderHoverClass: 'hover:border-green-400/50',
    buttonClass: 'bg-green-500 hover:bg-green-400 text-slate-950 focus-visible:ring-green-200',
  },
  {
    id: 'ys1',
    title: 'Ys Book I: Ancient Ys Vanished',
    year: 1987,
    category: 'rpg',
    meta: '1987 · Nihon Falcom · Bump-Combat Action RPG · Esteria',
    description:
      'Guide crimson-haired Adol Christin across Esteria and Darm Tower with blistering off-center Bump Combat, rapid field HP recovery, and driving 80s synth-rock BGM.',
    footerLabel: 'Falcom Action RPG',
    footerSummary: 'Bump Combat · Level & Gear · Books of Ys',
    titleColorClass: 'text-red-400',
    scoreColorClass: 'text-red-200',
    borderHoverClass: 'hover:border-red-400/50',
    buttonClass: 'bg-red-500 hover:bg-red-400 text-white focus-visible:ring-red-300',
  },
  {
    id: 'ys2',
    title: 'Ys Book II: The Final Chapter',
    year: 1988,
    category: 'rpg',
    meta: '1988 · Nihon Falcom · Floating Land of Ys · Fireball Magic',
    description:
      'Ascend to the floating land of Ys armed with blazing Fireball and Shield magic alongside classic high-speed Bump Combat across Moondoria, Ice Ridge, and Solomon Shrine.',
    footerLabel: 'Arcane Action RPG',
    footerSummary: 'Fireball Magic · MP Regen · Demon Bosses',
    titleColorClass: 'text-sky-400',
    scoreColorClass: 'text-sky-200',
    borderHoverClass: 'hover:border-sky-400/50',
    buttonClass: 'bg-sky-400 hover:bg-sky-300 text-slate-950 focus-visible:ring-sky-200',
  },
  {
    id: 'mule',
    title: 'M.U.L.E.',
    year: 1983,
    category: 'rpg',
    meta: '1983 · Ozark / EA · 8 Alien Species · 12-Month Irata Colony Sim',
    description:
      'Pick from 8 classic species and conquer Planet Irata over 12 months—claim River, Plains & 3-Tier Mountain plots, walk tethered M.U.L.E.s from Town, hunt the Mountain Wampus, gamble at the Pub, and dominate live Auctions!',
    footerLabel: 'Full Colony Sim',
    footerSummary: '8 Species · Tethered M.U.L.E.s · Pub & Wampus · Live Market',
    titleColorClass: 'text-amber-400',
    scoreColorClass: 'text-amber-200',
    borderHoverClass: 'hover:border-amber-400/50',
    buttonClass: 'bg-amber-400 hover:bg-amber-300 text-slate-950 focus-visible:ring-amber-200',
  },
  {
    id: 'arkanoid',
    title: 'Arkanoid',
    year: 1986,
    category: 'puzzle',
    meta: '1986 · Taito · Vaus Craft · 7 Power Capsules & DOH',
    description:
      'Pilot the Vaus craft through gleaming neon brick walls—catch Expand, Laser, Catch, Slow, Multi-Ball, and Break Warp capsules on your journey to battle DOH.',
    footerLabel: '7 Capsules',
    footerSummary: 'Vaus Lasers · Multi-Ball · Silver/Gold Bricks',
    titleColorClass: 'text-blue-400',
    scoreColorClass: 'text-blue-200',
    borderHoverClass: 'hover:border-blue-400/50',
    buttonClass: 'bg-blue-500 hover:bg-blue-400 text-white focus-visible:ring-blue-300',
  },
  {
    id: 'arkanoid2',
    title: 'Arkanoid II: Revenge of DOH',
    year: 1987,
    category: 'puzzle',
    meta: '1987 · Taito · Twin Vaus · Mega-Ball & Regenerating Bricks',
    description:
      'Taito’s supercharged sequel introduces Twin Shadow Vaus paddles, brick-piercing Mega-Balls, regenerating barriers, and intense dimensional boss showdowns.',
    footerLabel: 'Sequel Power',
    footerSummary: 'Twin Vaus · Piercing Mega-Ball · DOH Core',
    titleColorClass: 'text-purple-400',
    scoreColorClass: 'text-purple-200',
    borderHoverClass: 'hover:border-purple-400/50',
    buttonClass: 'bg-purple-500 hover:bg-purple-400 text-white focus-visible:ring-purple-300',
  },
  {
    id: 'superbreakout',
    title: 'Super Breakout',
    year: 1978,
    category: 'puzzle',
    meta: '1978 · Atari · Cavity Multiball · Double & Progressive Modes',
    description:
      'Master Atari’s legendary paddle classic across three switchable modes: Cavity 3-ball multiball, Dual-tier Double paddles, and descending Progressive walls.',
    footerLabel: '3 Arcade Modes',
    footerSummary: 'Cavity Multiball · Double · Progressive Wall',
    titleColorClass: 'text-sky-400',
    scoreColorClass: 'text-sky-200',
    borderHoverClass: 'hover:border-sky-400/50',
    buttonClass: 'bg-sky-400 hover:bg-sky-300 text-slate-950 focus-visible:ring-sky-200',
  },
  {
    id: 'qix',
    title: 'Qix',
    year: 1981,
    category: 'puzzle',
    meta: '1981 · Taito · Neon Ribbon Qix · Twin Split & Super Sparx',
    description:
      'Claim 75%+ of the geometric arena by carving Fast cyan or 2× Slow gold Stix polygons around the erratic neon Qix—outrun the burning Fuse, dodge evolving Super Sparx, and split Twin Qix on Stage 3+ for multiplier chains!',
    footerLabel: 'Territory Strategy',
    footerSummary: 'Fast vs 2× Slow Draw · Twin Qix Split · Super Sparx',
    titleColorClass: 'text-pink-400',
    scoreColorClass: 'text-pink-200',
    borderHoverClass: 'hover:border-pink-400/50',
    buttonClass: 'bg-pink-500 hover:bg-pink-400 text-white focus-visible:ring-pink-300',
  },
  {
    id: 'superqix',
    title: 'Super Qix',
    year: 1987,
    category: 'puzzle',
    meta: '1987 · Taito · Official Qix Sequel · 16-Bit Art Reveals & Power-Ups',
    description:
      'Taito’s celebrated 1987 arcade sequel unveils lush 16-bit hidden artwork—Golden Dragon, Samurai Citadel, Cyber Phoenix, Kraken & Star Temple—as you trap floating Freeze, Shield, Speed, +5,000 Bonus & Warp capsules!',
    footerLabel: '1987 Sequel',
    footerSummary: 'Hidden 16-Bit Art · 5 Enclose Power-Ups · 90% Master Bonus',
    titleColorClass: 'text-yellow-400',
    scoreColorClass: 'text-yellow-200',
    borderHoverClass: 'hover:border-yellow-400/50',
    buttonClass: 'bg-yellow-400 hover:bg-yellow-300 text-slate-950 focus-visible:ring-yellow-200',
  },
  {
    id: 'asteroidsdeluxe',
    title: 'Asteroids Deluxe',
    year: 1981,
    category: 'shooters',
    meta: '1981 · Atari · Energy Shield · Killer Satellites & Saucers',
    description:
      'Command a razor-sharp vector starfighter with a rechargeable Energy Shield against crystalline asteroids, splitting Killer Satellites, and deadeye UFO saucers.',
    footerLabel: 'Vector Defense',
    footerSummary: 'Energy Shield · Splitting Satellites · Saucers',
    titleColorClass: 'text-sky-400',
    scoreColorClass: 'text-sky-200',
    borderHoverClass: 'hover:border-sky-400/50',
    buttonClass: 'bg-sky-400 hover:bg-sky-300 text-slate-950 focus-visible:ring-sky-200',
  },
  {
    id: 'spaceduel',
    title: 'Space Duel',
    year: 1982,
    category: 'shooters',
    meta: '1982 · Atari · Color Vector Shapes · Tethered Wingman',
    description:
      'Atari’s first color vector space shooter—shatter spinning geometric Pinwheels, Diamonds, and Fuzzballs solo or linked with a tethered Wingman starship.',
    footerLabel: 'Color Vector',
    footerSummary: 'Tethered Wingman · Geometric Swarms · Shields',
    titleColorClass: 'text-purple-400',
    scoreColorClass: 'text-purple-200',
    borderHoverClass: 'hover:border-purple-400/50',
    buttonClass: 'bg-purple-500 hover:bg-purple-400 text-white focus-visible:ring-purple-300',
  },
  {
    id: 'starcastle',
    title: 'Star Castle',
    year: 1980,
    category: 'shooters',
    meta: '1980 · Cinematronics · 3 Rotating Rings · Core Cannon',
    description:
      'Carve a firing corridor through three counter-rotating glowing shield rings to destroy the lethal Star Castle Core while outflying homing Spark Mines.',
    footerLabel: 'Ring Siege',
    footerSummary: '3 Shield Rings · Homing Mines · Core Blast',
    titleColorClass: 'text-yellow-400',
    scoreColorClass: 'text-yellow-200',
    borderHoverClass: 'hover:border-yellow-400/50',
    buttonClass: 'bg-yellow-400 hover:bg-yellow-300 text-slate-950 focus-visible:ring-yellow-200',
  },
  {
    id: 'missilecommand',
    title: 'Missile Command',
    year: 1980,
    category: 'shooters',
    meta: '1980 · Atari · 3 ABM Batteries · Chain Intercepts · 6 Cities',
    description:
      'Protect six illuminated cities from raining MIRVs, smart bombs, and bombers—aim overlapping ABM explosions from Alpha, Delta, and Omega bases for chain clears.',
    footerLabel: 'Defense Grid',
    footerSummary: 'Mouse + Keys · 3 ABM Bases · Chain Blasts',
    titleColorClass: 'text-orange-400',
    scoreColorClass: 'text-orange-200',
    borderHoverClass: 'hover:border-orange-400/50',
    buttonClass: 'bg-orange-500 hover:bg-orange-400 text-slate-950 focus-visible:ring-orange-200',
  },
  {
    id: 'scramble',
    title: 'Scramble',
    year: 1981,
    category: 'shooters',
    meta: '1981 · Konami · 6 Cavern Zones · Lasers, Bombs & Fuel',
    description:
      'Skim through hostile caverns firing forward lasers and arcing bombs—shatter glowing FUEL tanks to keep flying past launching rockets, fireballs, and the Super-Base.',
    footerLabel: '6-Stage Raid',
    footerSummary: 'Dual Laser + Bomb · Fuel Raids · Caverns',
    titleColorClass: 'text-green-400',
    scoreColorClass: 'text-green-200',
    borderHoverClass: 'hover:border-green-400/50',
    buttonClass: 'bg-green-500 hover:bg-green-400 text-slate-950 focus-visible:ring-green-200',
  },
  {
    id: 'moonpatrol',
    title: 'Moon Patrol',
    year: 1982,
    category: 'shooters',
    meta: '1982 · Irem / Williams · 6-Wheel Lunar Buggy · Parallax Hills',
    description:
      'Race across parallax lunar plains leaping craters and landmines while firing simultaneous forward and anti-UFO vertical cannons to beat Sector E–Z checkpoint clocks.',
    footerLabel: 'Lunar Action',
    footerSummary: 'Jump + Dual Guns · Parallax Terrain · UFOs',
    titleColorClass: 'text-pink-400',
    scoreColorClass: 'text-pink-200',
    borderHoverClass: 'hover:border-pink-400/50',
    buttonClass: 'bg-pink-500 hover:bg-pink-400 text-white focus-visible:ring-pink-300',
  },
  {
    id: 'timepilot',
    title: 'Time Pilot',
    year: 1982,
    category: 'shooters',
    meta: '1982 · Konami · 360° Free-Flight · 1910 to 2001 Eras',
    description:
      'Bank 360 degrees through endless open skies across 1910 Biplanes, 1940 Monoplanes, 1970 Choppers, 1982 Jets, and 2001 UFOs to defeat each era’s Mothership!',
    footerLabel: '5 Time Eras',
    footerSummary: '360° Dogfights · Pilot Rescues · Motherships',
    titleColorClass: 'text-blue-400',
    scoreColorClass: 'text-blue-200',
    borderHoverClass: 'hover:border-blue-400/50',
    buttonClass: 'bg-blue-500 hover:bg-blue-400 text-white focus-visible:ring-blue-300',
  },
  {
    id: 'ww1942',
    title: '1942',
    year: 1984,
    category: 'shooters',
    meta: '1984 · Capcom · USS Hornet Carrier · 3D Loop-the-Loop & Wingmen',
    description:
      'Launch off the USS Hornet in Capcom’s Pacific classic—wipe out Red Formations for 6 iconic POW drops, fly Twin Wingmen, dodge with 3D Loop-the-Loops, and down the giant Ayako Super-Bomber en route TO TOKYO!',
    footerLabel: 'Pacific Ace',
    footerSummary: 'Carrier Launch & Landing · 6 POW Drops · Ayako Boss',
    titleColorClass: 'text-slate-100',
    scoreColorClass: 'text-slate-200',
    borderHoverClass: 'hover:border-slate-300/50',
    buttonClass: 'bg-slate-200 hover:bg-white text-slate-950 focus-visible:ring-slate-300',
  },
  {
    id: 'ww1943',
    title: '1943: The Battle of Midway',
    year: 1987,
    category: 'shooters',
    meta: '1987 · Capcom · Shoot-to-Cycle POW · Lightning Crash · Yamato',
    description:
      'Assault the Midway armada with Shoot-to-Cycle POW weapons (bullet-erasing Shotgun, 3-Way, Shell, Laser), an Energy/Fuel gauge, Lightning Mega-Crashes, and multi-turret battleships including Cruiser Tone, Carrier Kaga & Battleship Yamato!',
    footerLabel: 'Midway Armada',
    footerSummary: 'Shoot-to-Cycle POW · Multi-Turret Warships · Lightning Crash',
    titleColorClass: 'text-emerald-400',
    scoreColorClass: 'text-emerald-200',
    borderHoverClass: 'hover:border-emerald-400/50',
    buttonClass: 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 focus-visible:ring-emerald-200',
  },
  {
    id: 'berzerk',
    title: 'Berzerk',
    year: 1980,
    category: 'action',
    meta: '1980 · Stern · High-Voltage Neon Maze · 6 Robot Tiers & Evil Otto',
    description:
      'Independent Stern maze engine with crackling high-voltage corridors, 6 escalating Cyclops robot tiers, robot-on-robot crossfire, Hold-to-Aim precision fire, Stern voice callouts, and invincible wall-phasing Evil Otto!',
    footerLabel: 'High-Voltage Maze',
    footerSummary: 'Electric Walls · 6 Robot Tiers · Evil Otto · Hold-Aim',
    titleColorClass: 'text-green-400',
    scoreColorClass: 'text-green-200',
    borderHoverClass: 'hover:border-green-400/50',
    buttonClass: 'bg-green-500 hover:bg-green-400 text-slate-950 focus-visible:ring-green-200',
  },
  {
    id: 'robotron',
    title: 'Robotron: 2084',
    year: 1982,
    category: 'action',
    meta: '1982 · Williams · Full Jarvis Cast · Grunts, Hulks, Quarks & Brains',
    description:
      'Pure electric twin-stick adrenaline featuring the full Williams roster—Grunts, indestructible knockback Hulks, Spheroids spawning Enforcers, Quarks deploying ricochet Tanks, and Wave 5+ Brains mutating humans into Progs!',
    footerLabel: 'Twin-Stick Action',
    footerSummary: '360° Aim + Panic Burst · 1K–5K Family Chain · Full Roster',
    titleColorClass: 'text-pink-400',
    scoreColorClass: 'text-pink-200',
    borderHoverClass: 'hover:border-pink-400/50',
    buttonClass: 'bg-pink-500 hover:bg-pink-400 text-white focus-visible:ring-pink-300',
  },
  {
    id: 'frogger',
    title: 'Frogger',
    year: 1981,
    category: 'action',
    meta: '1981 · Konami / Sega · 5-Lane Highway · Diving Turtles & Gators',
    description:
      'Leap across five gleaming rush-hour highway lanes with headlight beams, sidestep median snakes, ride river logs, diving turtle pods, and snapping alligators, rescue pink Lady Frogs, and claim all 5 lily pad berths!',
    footerLabel: 'Arcade Classic',
    footerSummary: '5-Lane Highway · Diving Turtles · Gators & Lady Frog',
    titleColorClass: 'text-green-400',
    scoreColorClass: 'text-green-200',
    borderHoverClass: 'hover:border-green-400/50',
    buttonClass: 'bg-green-500 hover:bg-green-400 text-slate-950 focus-visible:ring-green-200',
  },
  {
    id: 'frogger2',
    title: 'Frogger II: ThreeeDeep!',
    year: 1984,
    category: 'action',
    meta: '1984 · Parker Bros / Sega · Underwater Reef · Lagoon · Sky Kingdom',
    description:
      'Climb through all three iconic vertical ecosystems per stage—dodge killer whales, sharks & subs underwater, hop diving hippos & speedboats on the surface, then ride clouds & biplanes to the rainbow Sky Island nests!',
    footerLabel: '3-Zone Sequel',
    footerSummary: 'Underwater Reef · Surface Lagoon · Sky Kingdom Nests',
    titleColorClass: 'text-sky-400',
    scoreColorClass: 'text-sky-200',
    borderHoverClass: 'hover:border-sky-400/50',
    buttonClass: 'bg-sky-400 hover:bg-sky-300 text-slate-950 focus-visible:ring-sky-200',
  },
  {
    id: 'joust',
    title: 'Joust',
    year: 1982,
    category: 'action',
    meta: '1982 · Williams · Volcanic Colosseum · Bounders, Hunters & Shadow Lords',
    description:
      'Independent Williams aerial jousting engine with articulated Ostrich flap & skid-brake physics, metallic Lance Clash bounces, mid-air Egg catches, crumbling magma bridges, Lava Troll grabs, and mouth-kill Pterodactyls!',
    footerLabel: 'Volcanic Colosseum',
    footerSummary: '3 Buzzard Tiers · Egg Waves · Lava Troll · Pterodactyl',
    titleColorClass: 'text-amber-400',
    scoreColorClass: 'text-amber-200',
    borderHoverClass: 'hover:border-amber-400/50',
    buttonClass: 'bg-amber-400 hover:bg-amber-300 text-slate-950 focus-visible:ring-amber-200',
  },
  {
    id: 'pengo',
    title: 'Pengo',
    year: 1982,
    category: 'action',
    meta: '1982 · Coreland / Sega · 13×15 Polar Maze · Multi-Squash & Diamonds',
    description:
      'Slide crystalline ice blocks across 5 color-coded Polar Acts to trigger 400–6,400 multi-squash Sno-Bee combos, electrify outer walls to stun & stomp edge foes, and align all 3 glowing Diamond Blocks for 10,000 points!',
    footerLabel: 'Ice Labyrinth',
    footerSummary: 'Multi-Squash Combos · Wall Shockwave · 3 Diamond Freeze',
    titleColorClass: 'text-sky-400',
    scoreColorClass: 'text-sky-200',
    borderHoverClass: 'hover:border-sky-400/50',
    buttonClass: 'bg-sky-400 hover:bg-sky-300 text-slate-950 focus-visible:ring-sky-200',
  },
  {
    id: 'popeye',
    title: 'Popeye',
    year: 1982,
    category: 'action',
    meta: '1982 · Nintendo · All 3 Stages · Docks, Seesaw Village & Pirate Ship',
    description:
      'Battle across all three authentic Nintendo stages—drop the Docks punching barrel onto Brutus, launch off Wimpy’s Sweet Haven Seesaw to rescue Swee’Pea, ride the Pirate Ship elevator, and eat Spinach for a 3,000-pt KO!',
    footerLabel: '3 Nintendo Stages',
    footerSummary: 'Docks Barrel · Wimpy Seesaw · Pirate Ship · Spinach KO',
    titleColorClass: 'text-blue-400',
    scoreColorClass: 'text-blue-200',
    borderHoverClass: 'hover:border-blue-400/50',
    buttonClass: 'bg-blue-500 hover:bg-blue-400 text-white focus-visible:ring-blue-300',
  },
  {
    id: 'mrdo',
    title: 'Mr. Do!',
    year: 1982,
    category: 'action',
    meta: '1982 · Universal · Cherry Tunnels · Powerball & Apples',
    description:
      'Carve cherry-filled orchards, whip your bouncing Powerball down tunnels, topple giant red Apples onto pursuing monsters, and spell E-X-T-R-A for bonus lives.',
    footerLabel: 'Orchard Tactics',
    footerSummary: '8-Cherry Combos · Powerball · Apple Crush',
    titleColorClass: 'text-red-400',
    scoreColorClass: 'text-red-200',
    borderHoverClass: 'hover:border-red-400/50',
    buttonClass: 'bg-red-500 hover:bg-red-400 text-white focus-visible:ring-red-300',
  },
  {
    id: 'spyhunter',
    title: 'Spy Hunter',
    year: 1983,
    category: 'racing',
    meta: '1983 · Bally Midway · G-6155 Interceptor · Weapons Van',
    description:
      'Tear down winding highways to a driving noir chase groove—board the red Weapons Van for Oil Slicks, Smoke Screens, and Missiles while battling Switch Blades & Choppers.',
    footerLabel: 'Secret Agent Kit',
    footerSummary: 'Weapons Van · Oil & Smoke · Surface Missiles',
    titleColorClass: 'text-slate-200',
    scoreColorClass: 'text-slate-200',
    borderHoverClass: 'hover:border-slate-300/50',
    buttonClass: 'bg-slate-200 hover:bg-white text-slate-950 focus-visible:ring-slate-300',
  },
  {
    id: 'tapper',
    title: 'Tapper',
    year: 1983,
    category: 'action',
    meta: '1983 · Bally Midway · 4 Bustling Bar Lanes · Catch Empties',
    description:
      'Dash between four crowded saloon counters pouring and sliding frosty mugs to thirsty patrons, snagging returning empty glasses and tips before anyone reaches the tap!',
    footerLabel: 'Saloon Rush',
    footerSummary: '4 Bar Counters · Empty Mug Catch · Tip Show',
    titleColorClass: 'text-amber-400',
    scoreColorClass: 'text-amber-200',
    borderHoverClass: 'hover:border-amber-400/50',
    buttonClass: 'bg-amber-400 hover:bg-amber-300 text-slate-950 focus-visible:ring-amber-200',
  },
  {
    id: 'roottapper',
    title: 'Root Beer Tapper',
    year: 1984,
    category: 'action',
    meta: '1984 · Bally Midway · Root Beer Saloon · 4 Themed Bars',
    description:
      'Serve frosty mugs of Root Beer across Wild West, Sports, Punk Rock, and Outer Space soda bars to upbeat ragtime polka—catching every sliding mug without a spill!',
    footerLabel: '4 Soda Arcades',
    footerSummary: 'Wild West · Sports · Punk · Alien Space Bar',
    titleColorClass: 'text-orange-400',
    scoreColorClass: 'text-orange-200',
    borderHoverClass: 'hover:border-orange-400/50',
    buttonClass: 'bg-orange-500 hover:bg-orange-400 text-slate-950 focus-visible:ring-orange-200',
  },
  {
    id: 'crystalcastles',
    title: 'Crystal Castles',
    year: 1983,
    category: 'action',
    meta: '1983 · Atari · 8 Isometric 3D Castles · Stairs, Elevators & Bentley Bear',
    description:
      'True depth-interleaved 3D isometric engine across 8 handcrafted castles—guide animated Bentley Bear up sculpted staircases and moving crystal elevators, Dash past Gem Eaters, don the starry Magic Hat to defeat Berthilda, and unlock Secret Warps!',
    footerLabel: '8 Isometric Castles',
    footerSummary: 'Stairs & Elevators · Animated Bentley · Magic Hat Dash · Berthilda',
    titleColorClass: 'text-purple-400',
    scoreColorClass: 'text-purple-200',
    borderHoverClass: 'hover:border-purple-400/50',
    buttonClass: 'bg-purple-500 hover:bg-purple-400 text-white focus-visible:ring-purple-300',
  },
  {
    id: 'rampage',
    title: 'Rampage',
    year: 1986,
    category: 'action',
    meta: '1986 · Bally Midway · 6 Destructible Cities · George, Lizzie & Ralph',
    description:
      'Scale skyscrapers across Peoria, Chicago, NYC, San Francisco, Tokyo & DC as George, Lizzie, or Ralph—smash windows for turkey roasts & cash, avoid toasters & poison, swat choppers, and trigger massive structural collapses!',
    footerLabel: '6-City Siege',
    footerSummary: 'George · Lizzie · Ralph · Skyscraper Collapse · Choppers',
    titleColorClass: 'text-green-400',
    scoreColorClass: 'text-green-200',
    borderHoverClass: 'hover:border-green-400/50',
    buttonClass: 'bg-green-500 hover:bg-green-400 text-slate-950 focus-visible:ring-green-200',
  },
  {
    id: 'dragonslair',
    title: 'Dragon’s Lair',
    year: 1983,
    category: 'action',
    meta: '1983 · Cinematronics · Dirk the Daring · Animated Reflexes',
    description:
      'Step into Don Bluth-inspired animated castle chambers as Dirk the Daring—nail split-second directional dodges and golden Sword strikes to defeat Singe and save Daphne!',
    footerLabel: 'Castle Gauntlet',
    footerSummary: 'Animated Chambers · Reflex Cues · Dragon Boss',
    titleColorClass: 'text-yellow-400',
    scoreColorClass: 'text-yellow-200',
    borderHoverClass: 'hover:border-yellow-400/50',
    buttonClass: 'bg-yellow-400 hover:bg-yellow-300 text-slate-950 focus-visible:ring-yellow-200',
  },

  // --- Classic Platformers (10 Earlier) ---
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
    meta: '1981 · Nintendo · All 4 Stages · 25m / 50m Pies / 75m Elevators / 100m Rivets',
    description:
      'Complete 4-stage 1981 arcade evolution: leap Blue Fire-Barrels & climbing Fireballs on 25m, ride Conveyor Belts on 50m Pie Factory, dodge Jack Springs on 75m Elevators, and pull all 8 rivets on 100m!',
    footerLabel: 'All 4 Classic Stages',
    footerSummary: '25m Girders · 50m Pies · 75m Elevators · 100m Rivets',
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
    meta: '1982 · Nintendo · 3 Stages · Jungle Vines · Springboard & Electric Hideout',
    description:
      'Swing across 3 authentic stages—Waterfall Jungle Vines, Springboard & Moving Islands with Nitpicker Birds, and Mario’s Electric Hideout with 6 Golden Keys & crackling Sparks!',
    footerLabel: '3 Jungle Stages',
    footerSummary: '2-Vine Turbo Climb · Springboard · Electric Hideout',
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
    meta: '1983 · Nintendo · 3 Conservatory Themes · Super Spray & 5 Flowers',
    description:
      'Defend Stanley’s sunlit glasshouse across 3 botanical halls—hop over Creepy caterpillars & DK’s falling Coconuts, blast Buzzbees & Beespies, grab Super Spray, and push DK into the beehive!',
    footerLabel: 'Botanical Greenhouse',
    footerSummary: '3 Glasshouse Halls · Stanley Hop · Super Spray',
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

  // --- Action & Dungeon (7) ---
  {
    id: 'gauntlet',
    title: 'Gauntlet',
    year: 1985,
    category: 'action',
    meta: '1985 · Atari Games · Red/Blue/Yellow/Green Heroes · 8 Detailed Dungeons',
    description:
      'Pick Red Thor (Warrior), Blue Thyra (Valkyrie), Yellow Merlin (Wizard), or Green Questor (Elf) across 8 richly detailed Atari dungeons packed with Ghosts, Grunts, Demons, Lobbers, Sorcerers, Thieves, and Death.',
    footerLabel: 'Authentic Atari Roster',
    footerSummary: '4 Color-Coded Heroes · 7 Classic Foes · Secret Walls',
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
    meta: '1986 · Atari Games · Free Color Pick · Dragons, “It” & Ricochet Shots',
    description:
      'Mix any of the 4 hero classes with Red, Blue, Yellow, or Green cabinet colors! Bank reflective shots around corridors, dodge Acid Puddles & Stun Traps, outrun “It”, and slay Fire-Breathing Dragons across 8 dungeons.',
    footerLabel: 'Sequel Arsenal',
    footerSummary: '4×4 Hero Colors · Dragons · “It” · Teleport Pads',
    titleColorClass: 'text-red-400',
    scoreColorClass: 'text-red-200',
    borderHoverClass: 'hover:border-red-400/50',
    buttonClass: 'bg-red-500 hover:bg-red-400 text-white focus-visible:ring-red-300',
  },
  {
    id: 'gauntletdl',
    title: 'Gauntlet: Dark Legacy',
    year: 2000,
    category: 'action',
    meta: '2000 · Midway · Genuine 3D WebGL Engine · 12 Heroes × 4 Elements · 9 Realms & Bosses',
    description:
      'Genuine real-time Three.js 3D engine copying Arcade & Console mechanics! Explore Sumner’s Tower 3D Hub, play 8 core + 4 secret heroes in 4 elemental colors, hunt 13 Runestones & 9 Boss-Weakening Legendary Weapons, use 10 Console Inventory Relics (Anti-Death Halo, Phoenix, Growth, X-Ray), and defeat 2-phase True Skorne!',
    footerLabel: 'Genuine 3D Engine',
    footerSummary: 'Three.js 3D · Sumner’s Tower · 9 Bosses · 10 Relics · 13 Runestones',
    titleColorClass: 'text-purple-400',
    scoreColorClass: 'text-purple-200',
    borderHoverClass: 'hover:border-purple-400/50',
    buttonClass: 'bg-purple-500 hover:bg-purple-400 text-white focus-visible:ring-purple-300',
  },
  {
    id: 'mappy',
    title: 'Mappy',
    year: 1983,
    category: 'action',
    meta: '1983 · Namco · 4 Victorian Mansions · Attic Bells · Balloon Bonus Round',
    description:
      'Bounce as Officer Mappy across 4 themed Victorian mansions! Pair flashing stolen loot up to 6×, drop Brass Attic Bells on pursuing cats, evade the golden Gosenzo Coin, and pop the Giant Goro Balloon in Bonus Stages!',
    footerLabel: 'Mansion Edition',
    footerSummary: '4 Room Themes · Attic Bells · Balloon Bonus · Gosenzo',
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
    meta: '1981 · Atari · Pure Quadrascan Vector · 16 Classic Webs',
    description:
      'Authentic 1981 Atari vector arcade engine with 16 classic webs, 3D cell-space aiming down centers and side rails, cartwheeling Flippers, rail-riding Fuseballs, and lane-electrifying Pulsars.',
    footerLabel: 'Quadrascan Vector',
    footerSummary: '16 Atari Webs · Cell-Space Aim · Pulsars',
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
    meta: '1994 · Atari Jaguar · Melt-O-Vision · Gouraud 3D Webs',
    description:
      'Independent Jaguar Melt-O-Vision engine with dripping liquid-neon pixel fountains, Gouraud-shaded 3D webs, Particle Laser, 3D Jump Thruster, Demon Heads, and the psychedelic Bonus Ring Warp Tunnel.',
    footerLabel: 'Jaguar Melt-O-Vision',
    footerSummary: 'Gouraud 3D · Jump & Droid · Warp Tunnel',
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
    meta: '2000 · Nuon · VLM-2 Prism Melt-O-Vision · Morphing Glass',
    description:
      'Independent Nuon VLM-2 kaleidoscopic prism engine with breathing stained-glass 3D webs, Hover-Glide Jump, rail-flankable Mirror Reflectors, Triple Harmonic Spread, Dual Crystal Droids, and Prism Bonus Tunnel.',
    footerLabel: 'Nuon VLM-2 Engine',
    footerSummary: 'VLM-2 Prism · Mirror Flank · Dual Droids',
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
    meta: '1981 · Williams · Crimson Mountain Frontier · Scanner & Hyperspace (R)',
    description:
      'Patrol the glowing crimson-amber frontier with Williams’ iconic overhead Scanner—intercept abducting Landers, catch falling Humanoids mid-air (+500), trigger Smart Bombs, and warp via Hyperspace (R)!',
    footerLabel: '1981 Frontier',
    footerSummary: 'Scanner Radar · Mid-Air Rescues · Hyperspace (R)',
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
    meta: '1981 · Williams · Violet Nebula · Inviso Ram · Warp Gate & Space Mines',
    description:
      'Pilot the violet Delta-Wing across crystalline amethyst peaks! Engage Inviso Cloak (R) to ram enemies for +250 shockwaves, dive into the Rescue Warp Gate, and outgun Firebombers & chasing Space Mines.',
    footerLabel: 'Violet Nebula',
    footerSummary: 'Inviso Ram (R) · Rescue Warp Gate · Space Mines',
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
    meta: '1981 · Williams · 3D Stargate Warp Tunnel · Yllabian Hums & Munchies',
    description:
      'Fly the cyan Twin-Prong Starfighter across holographic grids! Enter the swirling Stargate Vortex with 4+ Humanoids for a 3D Hyperspace Warp skip (+2,000) while battling splitting Yllabian Hums, Dynamos & Munchies.',
    footerLabel: 'Stargate Vortex',
    footerSummary: '3D Warp Tunnel · Yllabian Splits · Prismatic Bomb',
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
    id: 'sprint1',
    title: 'Sprint 1',
    year: 1978,
    category: 'racing',
    meta: '1978 · Atari / Kee Games · HD 1280×960 · 8 Classic Circuits · 4-Speed',
    description:
      'Authentic 1978 Kee Games single-player arcade classic in high-res phosphor-green clarity—conquer 8 classic circuits from Easy Oval & Figure-8 Bridge to Super Serpent.',
    footerLabel: '8 Circuits',
    footerSummary: '1280×960 HD · 4-Speed · Figure-8 Bridge',
    titleColorClass: 'text-emerald-300',
    scoreColorClass: 'text-emerald-200',
    borderHoverClass: 'hover:border-emerald-300/50',
    buttonClass: 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 focus-visible:ring-emerald-200',
  },
  {
    id: 'sprint',
    title: 'Sprint 2',
    year: 1976,
    category: 'racing',
    meta: '1976 · Atari / Kee Games · HD 1280×960 · 8 Expanded Arcade Circuits',
    description:
      'Experience the 1976 overhead arcade pioneer at crisp 1280×960 resolution—paint persistent twin skidmarks across all 8 classic Kee Games tracks with 4-speed gearbox telemetry.',
    footerLabel: '8 Circuits',
    footerSummary: '1280×960 HD · 4-Speed · Skidmarks',
    titleColorClass: 'text-slate-200',
    scoreColorClass: 'text-slate-200',
    borderHoverClass: 'hover:border-slate-300/50',
    buttonClass: 'bg-slate-200 hover:bg-white text-slate-950 focus-visible:ring-slate-300',
  },
  {
    id: 'sprint4',
    title: 'Sprint 4',
    year: 1977,
    category: 'racing',
    meta: '1977 · Atari · HD 1280×960 · First Color Sprint · 6 Circuits',
    description:
      'Atari’s first full-color overhead Sprint cabinet—battle a vivid 4-color pack across 6 classic pylon-lined circuits including Cloverleaf, Figure-8 Speedway, and Twin Hairpins.',
    footerLabel: '6 Circuits',
    footerSummary: 'First-Color Atari · 4-Speed · Oil Slicks',
    titleColorClass: 'text-orange-400',
    scoreColorClass: 'text-orange-200',
    borderHoverClass: 'hover:border-orange-400/50',
    buttonClass: 'bg-orange-400 hover:bg-orange-300 text-slate-950 focus-visible:ring-orange-200',
  },
  {
    id: 'sprint8',
    title: 'Sprint 8',
    year: 1977,
    category: 'racing',
    meta: '1977 · Atari · HD 1280×960 · 8-Car Pack · 6 Super-Wide Arenas',
    description:
      'Launch from a staggered 4×2 8-car starting grid against 7 simultaneous color rivals across 6 extra-wide stadium arenas from Grand Bowl to the 8-Car Gauntlet.',
    footerLabel: '8-Car Pack',
    footerSummary: '6 Wide Arenas · 8 Simultaneous Cars',
    titleColorClass: 'text-sky-400',
    scoreColorClass: 'text-sky-200',
    borderHoverClass: 'hover:border-sky-400/50',
    buttonClass: 'bg-sky-400 hover:bg-sky-300 text-slate-950 focus-visible:ring-sky-200',
  },
  {
    id: 'supersprint',
    title: 'Super Sprint',
    year: 1986,
    category: 'racing',
    meta: '1986 · Atari System 2 · HD 1280×960 · All 8 Arcade Circuits',
    description:
      'High-resolution Atari System 2 legend featuring all 8 authentic circuits with elevated Overpass Bridges, Rescue Helicopter drops, roaming Mini-Tornadoes, Wrenches, and the Pit Shop.',
    footerLabel: '8 System 2 Tracks',
    footerSummary: '1280×960 · Bridges · Pit Shop · Heli',
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
    meta: '1986 · Atari System 2 · HD 1280×960 · All 8 Pro Circuits · Shortcut Gates',
    description:
      'Time your entry through animated Pneumatic Shortcut Gates with amber warning beacons across all 8 pro 1280×960 circuits packed with water puddles, oil slicks, bridges, and Pit Upgrades.',
    footerLabel: '8 Pro Tracks',
    footerSummary: '1280×960 · Shortcut Gates · Pit Shop',
    titleColorClass: 'text-green-400',
    scoreColorClass: 'text-green-200',
    borderHoverClass: 'hover:border-green-400/50',
    buttonClass: 'bg-green-400 hover:bg-green-300 text-slate-950 focus-visible:ring-green-200',
  },
  {
    id: 'badlands',
    title: 'Badlands',
    year: 1989,
    category: 'racing',
    meta: '1989 · Atari Games · HD 1280×960 · 6 Wasteland Combat Circuits',
    description:
      'Atari’s post-apocalyptic Super Sprint combat evolution—spin rival buggies with your roof plasma cannon, detonate land mines across 6 scorched tracks, and upgrade in the Armory.',
    footerLabel: '6 Combat Tracks',
    footerSummary: 'Roof Cannon · Land Mines · Armory Shop',
    titleColorClass: 'text-red-400',
    scoreColorClass: 'text-red-200',
    borderHoverClass: 'hover:border-red-400/50',
    buttonClass: 'bg-red-500 hover:bg-red-400 text-white focus-visible:ring-red-300',
  },
  {
    id: 'superoffroad',
    title: 'Super Off Road',
    year: 1989,
    category: 'racing',
    meta: '1989 · Leland Corp · HD 1280×960 · 8 Ironman Dirt Stadium Tracks',
    description:
      'Ivan “Ironman” Stewart’s classic 4×4 dirt stadium racer—launch off 3D tabletop jumps over deep mud pits, grab $1,000 cash & N2O Nitro bottles, and upgrade in the Speed Shop.',
    footerLabel: '8 Dirt Tracks',
    footerSummary: '3D Jump Ramps · Mud Pits · N2O Nitro',
    titleColorClass: 'text-amber-400',
    scoreColorClass: 'text-amber-200',
    borderHoverClass: 'hover:border-amber-400/50',
    buttonClass: 'bg-amber-400 hover:bg-amber-300 text-slate-950 focus-visible:ring-amber-200',
  },
  {
    id: 'indyheat',
    title: 'Indy Heat',
    year: 1991,
    category: 'racing',
    meta: '1991 · Leland Corp · HD 1280×960 · 6 IndyCar Circuits · Pit Lane',
    description:
      'Danny Sullivan’s overhead IndyCar championship—manage live Fuel & Engine Heat gauges while firing Turbo Boost, and dart into the green Pit Lane strip to refuel and cool down.',
    footerLabel: '6 Indy Circuits',
    footerSummary: 'Fuel & Heat · Live Pit Lane · Turbo',
    titleColorClass: 'text-blue-400',
    scoreColorClass: 'text-blue-200',
    borderHoverClass: 'hover:border-blue-400/50',
    buttonClass: 'bg-blue-500 hover:bg-blue-400 text-white focus-visible:ring-blue-300',
  },

  // --- Earlier Shooters & Action Classics (7) ---
  {
    id: 'centipede',
    title: 'Centipede',
    year: 1981,
    category: 'shooters',
    meta: '1981 · Atari · Neon Mushroom Garden · Precision Aim & Tilt',
    description:
      'Evolved nocturnal mushroom-garden shooter with tunable Precision Speed & Tilt steering, laser targeting sightline, bioluminescent poison spores, 900-pt close-range Spider duels, Fleas, and Scorpions.',
    footerLabel: 'Neon Garden',
    footerSummary: 'Precision + Tilt · Laser Sight · 900pt Close Spider · 4 Palettes',
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
    meta: '1982 · Atari · Sunset Swarm Overdrive · 3× DDT Chains & Dragonflies',
    description:
      'Distinct Sunset Botanical Overdrive sequel featuring screen-shaking 3× DDT chain explosions, Inchworm Icy Slow-Mo, zig-zagging Dragonflies, Beetles, Mosquitoes, Earwigs, and Precision/Tilt steering.',
    footerLabel: 'Swarm Overdrive',
    footerSummary: '3× DDT Chains · Icy Slow-Mo · Dragonflies · Precision + Tilt',
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
    meta: '1982 · Namco · Modern 2.5D Engine · Organic Burrows & 4 Worlds',
    description:
      'Rebuilt as a lush 2.5D subterranean diorama with smooth sub-tile tunnel carving, buried fossils, volumetric Fygar plasma breath, squash-and-stretch inflation, custom marching BGM, and falling boulder crush chains.',
    footerLabel: '2.5D Underground',
    footerSummary: 'Smooth Carving · 4 Worlds · 4-Stage Pump · Fossils',
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
    meta: '1984 · First Star · Modern 2.5D Cavern Engine · 8 Biomes',
    description:
      'Rebuilt from the ground up with extruded 2.5D blocks, buttery-smooth rolling boulders, dynamic headlamp & crystal glow, Magic Walls, Growing Amoeba, pickaxe Snap-Dig, Butterfly gem bursts, and custom cavern BGM.',
    footerLabel: '2.5D Cavern Engine',
    footerSummary: '8 Biomes · Magic Walls · Amoeba · Smooth Physics',
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
    meta: '1978 · Taito · Lunar Cabinet HD · Authentic Ripple March',
    description:
      'True-to-original 1978 Taito arcade action evolved in HD—featuring the lunar mountain cabinet backdrop, bottom-up ripple march, 3 authentic enemy bolt types, molten-rim voxel bunkers, starburst shockwave explosions, and the exact 300-point Mystery UFO shot table.',
    footerLabel: 'Evolved 1978 Original',
    footerSummary: 'Molten Bunkers · 3 ROM Bolt Types · Starburst Shockwaves · 300pt UFO',
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
    meta: '1979 · Taito · Lunar Colony Deluxe · Splitters & Dropship',
    description:
      'Authentic full-color 1979 sequel rebuilt with a glowing lunar metropolis skyline, electric fission-splitting Commanders, descending Dropship Warp Pods, phase-cloaking UFOs, fleeing S.O.S. escape saucers, and the sweeping 500-point Rainbow Bonus arc.',
    footerLabel: 'Part II Deluxe Engine',
    footerSummary: 'Fission Splitters · Warp Pods · Cloak UFO · S.O.S. & Rainbow Arc',
    titleColorClass: 'text-cyan-400',
    scoreColorClass: 'text-cyan-200',
    borderHoverClass: 'hover:border-cyan-400/50',
    buttonClass: 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 focus-visible:ring-cyan-200',
  },
  {
    id: 'invadersdx',
    title: 'Space Invaders DX',
    year: 1994,
    category: 'shooters',
    meta: '1994 · Taito F2 16-Bit · 5 Parody Worlds · Hyper Beam',
    description:
      '16-bit Taito F2 celebration cycling through 5 Parody Worlds (Invaders 94 DX, Arkanoid, Darius, Bubble Bobble, Neo-Tokyo Citadel) with shaded sprites, Power-Up Capsules, 2-HP Armored Commanders, and a column-vaporizing DX Hyper Beam.',
    footerLabel: '16-Bit DX Engine',
    footerSummary: '5 Parody Worlds · Twin/Spread/Rail Capsules · DX Hyper Beam',
    titleColorClass: 'text-amber-300',
    scoreColorClass: 'text-amber-200',
    borderHoverClass: 'hover:border-amber-400/50',
    buttonClass: 'bg-amber-400 hover:bg-amber-300 text-slate-950 focus-visible:ring-amber-200',
  },
  {
    id: 'foodfight',
    title: 'Food Fight',
    year: 1983,
    category: 'action',
    meta: '1983 · Atari · 2.5D Patio Bistro Engine · 4 Venues',
    description:
      'Rebuilt in a vibrant 2.5D patio bistro engine! Sprint and dive-roll as Charley Chuck past Oscar, Angelo, Jacques, and Zorba—hurling piercing watermelons, cream pies, curved bananas, and pea bursts to devour the melting triple-scoop cone, complete with recorded slow-mo Instant Replays.',
    footerLabel: '2.5D Bistro Engine',
    footerSummary: '6 Tactical Foods · Dive-Roll · Mid-Air Blocks · Recorded Instant Replay',
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

const FILTER_TABS: Array<{ id: FilterCategory; label: string; shortLabel: string }> = [
  { id: 'all', label: 'All 89', shortLabel: 'All' },
  { id: 'shooters', label: 'Shooters', shortLabel: 'Shooters' },
  { id: 'action', label: 'Action', shortLabel: 'Action' },
  { id: 'platformers', label: 'Platformers', shortLabel: 'Platform' },
  { id: 'puzzle', label: 'Puzzle', shortLabel: 'Puzzle' },
  { id: 'racing', label: 'Racing', shortLabel: 'Racing' },
  { id: 'rpg', label: 'RPG & Sim', shortLabel: 'RPG' },
  { id: 'pacman', label: 'Pac-Man', shortLabel: 'Pac-Man' },
];

const CATEGORY_LABELS: Record<CabinetCategory, string> = {
  shooters: 'Shooters',
  action: 'Action',
  platformers: 'Platformers',
  puzzle: 'Puzzle',
  racing: 'Racing',
  rpg: 'RPG & Sim',
  pacman: 'Pac-Man',
};

const ALPHABET_KEYS: string[] = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];

function getLetterKey(title: string): string {
  const ch = title.trim().charAt(0).toUpperCase();
  if (ch >= 'A' && ch <= 'Z') return ch;
  return '#';
}

function getAccentHex(titleColorClass: string): string {
  if (titleColorClass.includes('pink')) return '#F472B6';
  if (titleColorClass.includes('yellow')) return '#FACC15';
  if (titleColorClass.includes('emerald')) return '#34D399';
  if (titleColorClass.includes('green')) return '#4ADE80';
  if (titleColorClass.includes('sky')) return '#38BDF8';
  if (titleColorClass.includes('cyan')) return '#22D3EE';
  if (titleColorClass.includes('orange')) return '#FB923C';
  if (titleColorClass.includes('red')) return '#F87171';
  if (titleColorClass.includes('amber')) return '#FBBF24';
  if (titleColorClass.includes('blue')) return '#60A5FA';
  if (titleColorClass.includes('purple')) return '#C084FC';
  if (titleColorClass.includes('lime')) return '#A3E635';
  if (titleColorClass.includes('indigo')) return '#818CF8';
  if (titleColorClass.includes('teal')) return '#2DD4BF';
  return '#E2E8F0';
}

const DEFAULT_FIRST_AZ_ID: GameId = [...CABINET_CARDS].sort((a, b) =>
  a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' })
)[0].id;

export default function ArcadeHub() {
  const [screen, setScreen] = useState<ActiveScreen>('select');
  const [filter, setFilter] = useState<FilterCategory>('all');
  const [sortMode, setSortMode] = useState<'az' | 'featured'>('az');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<GameId>(DEFAULT_FIRST_AZ_ID);
  const [navDir, setNavDir] = useState<1 | -1>(1);
  const [isStandaloneFile, setIsStandaloneFile] = useState(false);
  const [highScores, setHighScores] = useState<ScoreMap>(createZeroScores);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const wheelStripRef = useRef<HTMLDivElement | null>(null);
  const wheelItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const lastWheelNavRef = useRef<number>(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const visibleCards = useMemo(() => {
    const filtered = CABINET_CARDS.filter((c) => {
      if (filter !== 'all' && c.category !== filter) return false;
      if (!normalizedSearch) return true;
      return (
        c.title.toLowerCase().includes(normalizedSearch) ||
        c.meta.toLowerCase().includes(normalizedSearch) ||
        c.description.toLowerCase().includes(normalizedSearch) ||
        String(c.year).includes(normalizedSearch)
      );
    });
    if (sortMode === 'az') {
      return [...filtered].sort((a, b) =>
        a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' })
      );
    }
    return filtered;
  }, [filter, normalizedSearch, sortMode]);

  const activeIndex = useMemo(() => {
    if (visibleCards.length === 0) return -1;
    const idx = visibleCards.findIndex((c) => c.id === selectedId);
    return idx >= 0 ? idx : 0;
  }, [visibleCards, selectedId]);

  const activeCard = activeIndex >= 0 ? visibleCards[activeIndex] : null;
  const activeAccent = activeCard ? getAccentHex(activeCard.titleColorClass) : '#FACC15';
  const activeLetter = activeCard ? getLetterKey(activeCard.title) : '';

  const letterBuckets = useMemo(() => {
    const buckets: Record<string, number[]> = {};
    for (let i = 0; i < visibleCards.length; i++) {
      const key = getLetterKey(visibleCards[i].title);
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(i);
    }
    return buckets;
  }, [visibleCards]);

  const positionPercent =
    visibleCards.length > 1 && activeIndex >= 0
      ? (activeIndex / (visibleCards.length - 1)) * 100
      : 0;

  const handleSelectGame = useCallback((next: ActiveScreen) => {
    arcadeAudio.stopAmbient();
    arcadeMusic.stop();
    if (next !== 'select') {
      arcadeAudio.unlock();
      setSelectedId(next);
      setCatalogOpen(false);
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

  const stepSelection = useCallback(
    (delta: number) => {
      if (visibleCards.length <= 1) return;
      const curIdx = activeIndex >= 0 ? activeIndex : 0;
      const nextIdx = (curIdx + delta + visibleCards.length) % visibleCards.length;
      setNavDir(delta >= 0 ? 1 : -1);
      setSelectedId(visibleCards[nextIdx].id);
    },
    [visibleCards, activeIndex]
  );

  const selectCardById = useCallback(
    (id: GameId) => {
      const targetIdx = visibleCards.findIndex((c) => c.id === id);
      if (targetIdx < 0) return;
      if (activeCard && activeCard.id === id) {
        handleSelectGame(id);
        return;
      }
      setNavDir(targetIdx >= activeIndex ? 1 : -1);
      setSelectedId(id);
    },
    [visibleCards, activeCard, activeIndex, handleSelectGame]
  );

  const jumpToIndex = useCallback(
    (targetIdx: number) => {
      if (visibleCards.length === 0) return;
      const clamped = Math.max(0, Math.min(visibleCards.length - 1, targetIdx));
      setNavDir(clamped >= activeIndex ? 1 : -1);
      setSelectedId(visibleCards[clamped].id);
    },
    [visibleCards, activeIndex]
  );

  const jumpToLetter = useCallback(
    (letter: string) => {
      const indices = letterBuckets[letter];
      if (!indices || indices.length === 0) return;
      // If already on a game starting with this letter, cycle to the next game under the same letter
      const posInBucket = indices.indexOf(activeIndex);
      const nextIdx = posInBucket >= 0 ? indices[(posInBucket + 1) % indices.length] : indices[0];
      jumpToIndex(nextIdx);
    },
    [letterBuckets, activeIndex, jumpToIndex]
  );

  const handleRandomPick = useCallback(() => {
    if (visibleCards.length <= 1) return;
    let pick = Math.floor(Math.random() * visibleCards.length);
    if (pick === activeIndex) {
      pick = (pick + 1) % visibleCards.length;
    }
    setNavDir(pick >= activeIndex ? 1 : -1);
    setSelectedId(visibleCards[pick].id);
  }, [visibleCards, activeIndex]);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      setIsStandaloneFile(window.location.protocol === 'file:');
      setHighScores(loadAllHighScores());
      const initialScreen = parseHashToScreen(window.location.hash);
      if (initialScreen !== 'select') {
        setSelectedId(initialScreen);
        setScreen(initialScreen);
      }
    });

    const syncFromUrl = () => {
      arcadeAudio.stopAmbient();
      arcadeMusic.stop();
      const target = parseHashToScreen(window.location.hash);
      if (target === 'select') {
        setHighScores(loadAllHighScores());
      } else {
        setSelectedId(target);
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

  // Smoothly center the active tile in the RetroBat bottom wheel carousel
  useEffect(() => {
    if (screen !== 'select' || !activeCard) return;
    const btn = wheelItemRefs.current[activeCard.id];
    if (btn && typeof btn.scrollIntoView === 'function') {
      btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [screen, activeCard]);

  // RetroBat keyboard navigation: Left/Right browse, PageUp/Down jump 5, Enter/Space launch, / search
  useEffect(() => {
    if (screen !== 'select') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if (e.key === 'Escape') {
        if (catalogOpen) {
          setCatalogOpen(false);
          return;
        }
        if (searchQuery) {
          setSearchQuery('');
          return;
        }
        if (searchOpen) {
          setSearchOpen(false);
          return;
        }
      }

      if (isTyping) {
        if (e.key === 'Enter' && activeCard) {
          e.preventDefault();
          handleSelectGame(activeCard.id);
        }
        return;
      }

      if (catalogOpen) return;

      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        stepSelection(1);
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        stepSelection(-1);
      } else if (e.key === 'PageDown') {
        e.preventDefault();
        stepSelection(5);
      } else if (e.key === 'PageUp') {
        e.preventDefault();
        stepSelection(-5);
      } else if (e.key === 'Home' && visibleCards.length > 0) {
        e.preventDefault();
        setNavDir(-1);
        setSelectedId(visibleCards[0].id);
      } else if (e.key === 'End' && visibleCards.length > 0) {
        e.preventDefault();
        setNavDir(1);
        setSelectedId(visibleCards[visibleCards.length - 1].id);
      } else if ((e.key === 'Enter' || e.key === ' ') && activeCard) {
        e.preventDefault();
        handleSelectGame(activeCard.id);
      } else if (e.key === '/') {
        e.preventDefault();
        setSearchOpen(true);
        window.requestAnimationFrame(() => searchInputRef.current?.focus());
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    screen,
    catalogOpen,
    searchOpen,
    searchQuery,
    activeCard,
    visibleCards,
    stepSelection,
    handleSelectGame,
  ]);

  const handleStageWheel = useCallback(
    (e: React.WheelEvent) => {
      if (catalogOpen) return;
      const dominant = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(dominant) < 12) return;
      const now = performance.now();
      if (now - lastWheelNavRef.current < 110) return;
      lastWheelNavRef.current = now;
      stepSelection(dominant > 0 ? 1 : -1);
    },
    [catalogOpen, stepSelection]
  );

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = touchStartRef.current;
      touchStartRef.current = null;
      const t = e.changedTouches[0];
      if (!start || !t) return;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        stepSelection(dx < 0 ? 1 : -1);
      }
    },
    [stepSelection]
  );

  if (screen === 'gauntletdl') {
    return (
      <GauntletDarkLegacy3D
        onSwitchGame={(g) => handleSelectGame(g)}
        onOpenLobby={() => handleSelectGame('select')}
      />
    );
  }
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

  const renderRosterStrip = (card: CabinetCardConfig) => {
    if (card.id === 'classic') {
      return (
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/[0.08]">
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
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/[0.08]">
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
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/[0.08]">
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
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/[0.08]">
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
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/[0.08]">
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
      <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/[0.08]">
        <span className="text-xs text-slate-400 shrink-0">{card.footerLabel}</span>
        <span className="text-xs text-slate-300 font-medium truncate">
          {card.footerSummary}
        </span>
      </div>
    );
  };

  return (
    <div
      className="relative h-[100dvh] w-full bg-[#060811] text-slate-100 flex flex-col overflow-hidden select-none"
      onWheel={handleStageWheel}
    >
      {/* Subtle Ambient Cross-Fading Backdrop Wash matched to Active Game */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-all duration-500 ease-out"
        style={{
          background: `radial-gradient(ellipse 68% 52% at 32% 38%, ${activeAccent}22 0%, ${activeAccent}09 42%, rgba(6,8,17,0) 76%)`,
        }}
      />

      {/* Clean 3-Zone Top Bar */}
      <header className="relative z-20 w-full shrink-0 border-b border-white/[0.07] bg-[#080B16]/90 backdrop-blur-md safe-top-pad">
        <div className="mx-auto max-w-[1440px] px-3.5 sm:px-7 h-13 sm:h-14 flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Single-line Brand Title */}
          <span
            className="text-sm sm:text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0"
            style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
          >
            Retro Arcade Collection
          </span>

          {/* Zone 2: Clean Collection Category Links */}
          <nav
            role="tablist"
            aria-label="Game collections"
            className="hidden md:flex items-center gap-1 lg:gap-1.5 overflow-x-auto no-scrollbar"
          >
            {FILTER_TABS.map((tab) => {
              const isSelected = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => {
                    setFilter(tab.id);
                    setNavDir(1);
                  }}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-white text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center shrink-0">
            {!isStandaloneFile ? (
              <a
                href="/arcade-index.html"
                download="index.html"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/12 bg-white/[0.05] hover:bg-white/[0.1] text-xs font-medium text-slate-100 transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download Offline</span>
                <span className="sm:hidden">Offline</span>
              </a>
            ) : (
              <span className="text-xs font-mono tabular-nums text-slate-400 whitespace-nowrap shrink-0">
                89 Cabinets
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Collection Bar (visible only below md) */}
      <div
        role="tablist"
        aria-label="Filter collections"
        className="relative z-10 md:hidden shrink-0 flex items-center gap-1 px-3 py-1.5 border-b border-white/[0.06] bg-[#070A14]/85 overflow-x-auto no-scrollbar"
      >
        {FILTER_TABS.map((tab) => {
          const isSelected = filter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => {
                setFilter(tab.id);
                setNavDir(1);
              }}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isSelected
                  ? 'bg-white text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.shortLabel}
            </button>
          );
        })}
      </div>

      {/* Center RetroBat Hero Showcase Stage */}
      <main
        className="relative z-10 flex-1 min-h-0 w-full mx-auto max-w-[1440px] px-3 sm:px-6 py-2.5 sm:py-4 flex items-center justify-center"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {activeCard ? (
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Left Arrow Control */}
            <button
              type="button"
              onClick={() => stepSelection(-1)}
              disabled={visibleCards.length <= 1}
              aria-label="Previous game"
              className="hidden sm:flex items-center justify-center w-11 h-11 lg:w-12 lg:h-12 rounded-xl border border-white/10 bg-[#0B0F1D]/85 hover:bg-white/10 hover:border-white/25 text-slate-200 hover:text-white transition-all shrink-0 mr-3 lg:mr-5 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            {/* Cross-Fading Showcase Content */}
            <div className="flex-1 min-w-0 h-full max-w-[1220px] flex items-center justify-center overflow-hidden">
              <AnimatePresence mode="wait" initial={false}>
                <motion.section
                  key={activeCard.id}
                  initial={{ opacity: 0, x: navDir * 32, scale: 0.988 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -navDir * 32, scale: 0.988 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="w-full h-full flex flex-col lg:grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)] gap-3 sm:gap-5 lg:gap-8 items-center justify-center"
                >
                  {/* Focal Anchor: Full Top-to-Bottom Uncropped 60fps Cabinet Display */}
                  <div
                    onClick={() => handleSelectGame(activeCard.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectGame(activeCard.id);
                      }
                    }}
                    aria-label={`Launch ${activeCard.title}`}
                    className="group relative flex-1 lg:flex-none w-full min-h-[200px] max-h-[46dvh] sm:max-h-[50dvh] lg:h-full lg:max-h-[68dvh] p-1.5 sm:p-2.5 rounded-2xl overflow-hidden bg-[#04060D] border border-white/[0.1] hover:border-white/20 flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 transition-colors duration-200"
                    style={{
                      boxShadow: `0 22px 54px -24px ${activeAccent}45, 0 0 0 1px rgba(255,255,255,0.04)`,
                    }}
                  >
                    <CabinetPreviewCanvas game={activeCard.id} />
                  </div>

                  {/* Cabinet Dossier & Primary Action */}
                  <div className="w-full shrink-0 flex flex-col justify-center gap-2.5 sm:gap-4 min-w-0">
                    {/* Unboxed Index & Category Metadata */}
                    <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
                      <div className="flex items-center gap-2 min-w-0 truncate">
                        <span className="font-mono tabular-nums text-slate-200 font-semibold">
                          {String(activeIndex + 1).padStart(2, '0')} / {String(visibleCards.length).padStart(2, '0')}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{CATEGORY_LABELS[activeCard.category]}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{activeCard.year}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-slate-500">High Score</span>
                        <span
                          className={`font-mono tabular-nums font-semibold ${activeCard.scoreColorClass}`}
                        >
                          {highScores[activeCard.id].toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Emblem + Display Title */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="shrink-0 rounded-xl bg-[#0B0F1D] border border-white/[0.08] p-1.5">
                        <GameEmblem gameId={activeCard.id} size={42} />
                      </div>
                      <div className="min-w-0">
                        <h1
                          className={`text-2xl sm:text-3xl lg:text-[2.35rem] font-extrabold tracking-tight leading-[1.1] text-balance ${activeCard.titleColorClass}`}
                          style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                        >
                          {activeCard.title}
                        </h1>
                        <p className="text-xs text-slate-400 mt-1 truncate">
                          {activeCard.meta}
                        </p>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs sm:text-sm lg:text-[15px] text-slate-300 leading-relaxed line-clamp-3 sm:line-clamp-4">
                      {activeCard.description}
                    </p>

                    {/* Bonus Roster / Feature Strip */}
                    <div className="hidden sm:block">{renderRosterStrip(activeCard)}</div>

                    {/* Primary Launch CTA + Mobile Prev/Next Row */}
                    <div className="flex items-center gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => stepSelection(-1)}
                        disabled={visibleCards.length <= 1}
                        aria-label="Previous game"
                        className="sm:hidden flex items-center justify-center w-11 h-11 rounded-xl border border-white/12 bg-[#0B0F1D] text-slate-200 active:scale-95 transition-transform shrink-0 cursor-pointer disabled:opacity-30"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectGame(activeCard.id)}
                        className={`flex-1 sm:flex-none sm:min-w-[230px] py-3 px-6 rounded-xl active:scale-[0.985] font-bold text-sm flex items-center justify-center gap-2 transition-all focus-visible:outline-none focus-visible:ring-2 whitespace-nowrap cursor-pointer ${activeCard.buttonClass}`}
                      >
                        <Play className="w-4 h-4 fill-current shrink-0" />
                        <span className="truncate">Play {activeCard.title}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => stepSelection(1)}
                        disabled={visibleCards.length <= 1}
                        aria-label="Next game"
                        className="sm:hidden flex items-center justify-center w-11 h-11 rounded-xl border border-white/12 bg-[#0B0F1D] text-slate-200 active:scale-95 transition-transform shrink-0 cursor-pointer disabled:opacity-30"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </motion.section>
              </AnimatePresence>
            </div>

            {/* Right Arrow Control */}
            <button
              type="button"
              onClick={() => stepSelection(1)}
              disabled={visibleCards.length <= 1}
              aria-label="Next game"
              className="hidden sm:flex items-center justify-center w-11 h-11 lg:w-12 lg:h-12 rounded-xl border border-white/10 bg-[#0B0F1D]/85 hover:bg-white/10 hover:border-white/25 text-slate-200 hover:text-white transition-all shrink-0 ml-3 lg:ml-5 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        ) : (
          <div className="max-w-md w-full py-10 px-6 text-center rounded-2xl bg-[#0B0F1D] border border-white/[0.08]">
            <p className="text-sm text-slate-300">
              No cabinets match{' '}
              <span className="text-white font-semibold">&ldquo;{searchQuery}&rdquo;</span>.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setFilter('all');
              }}
              className="mt-4 px-4 py-2 rounded-lg bg-white text-slate-950 text-xs font-semibold cursor-pointer hover:bg-slate-200 transition-colors"
            >
              Reset Filter &amp; Show All 89
            </button>
          </div>
        )}
      </main>

      {/* Bottom RetroBat Horizontal Game Wheel Dock */}
      <footer className="relative z-20 w-full shrink-0 border-t border-white/[0.08] bg-[#070A15]/95 backdrop-blur-md safe-bottom-pad">
        {/* Dock Utility Strip: Search, Sort A-Z, Random, All Games & Position Indicator */}
        <div className="mx-auto max-w-[1440px] px-3 sm:px-6 pt-2 pb-1 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            {searchOpen || searchQuery ? (
              <div className="relative w-44 sm:w-60">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter games, year, studio..."
                  aria-label="Filter arcade games"
                  className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-[#0D1224] border border-white/15 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-white/35 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchOpen(false);
                  }}
                  aria-label="Close search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSearchOpen(true);
                  window.requestAnimationFrame(() => searchInputRef.current?.focus());
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] text-xs font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Search</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setSortMode((m) => (m === 'az' ? 'featured' : 'az'))}
              title={sortMode === 'az' ? 'Sorted A-Z (click for Featured order)' : 'Featured order (click for A-Z)'}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                sortMode === 'az'
                  ? 'bg-white/12 border-white/25 text-white'
                  : 'bg-white/[0.04] hover:bg-white/[0.09] border-white/[0.08] text-slate-300 hover:text-white'
              }`}
            >
              <ArrowDownAZ className="w-3.5 h-3.5" />
              <span>{sortMode === 'az' ? 'A–Z' : 'Featured'}</span>
            </button>

            <button
              type="button"
              onClick={handleRandomPick}
              disabled={visibleCards.length <= 1}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] text-xs font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-30"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Random</span>
            </button>

            <button
              type="button"
              onClick={() => setCatalogOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] text-xs font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">All Games</span>
            </button>
          </div>

          {/* Live Position & Alphabet Readout */}
          <div className="flex items-center gap-2.5 text-xs whitespace-nowrap shrink-0">
            {activeCard && (
              <div className="flex items-center gap-2 font-mono tabular-nums text-slate-300">
                <span
                  className="font-bold text-sm"
                  style={{ color: activeAccent }}
                >
                  {activeLetter}
                </span>
                <span className="text-slate-600" aria-hidden="true">·</span>
                <span>
                  {activeIndex + 1} / {visibleCards.length}
                </span>
              </div>
            )}
            <span className="hidden lg:inline text-[11px] text-slate-500">
              Home / End · Left / Right · Enter to Play
            </span>
          </div>
        </div>

        {/* Alphabet Quick-Jump Strip (# A-Z) showing exactly where you are */}
        {visibleCards.length > 0 && (
          <div className="mx-auto max-w-[1440px] px-3 sm:px-6 pb-1">
            <div
              role="navigation"
              aria-label="Alphabetical quick jump"
              className="flex items-center sm:justify-center gap-0.5 overflow-x-auto no-scrollbar py-0.5"
            >
              {ALPHABET_KEYS.map((letter) => {
                const count = letterBuckets[letter]?.length ?? 0;
                const isCurrent = activeLetter === letter;
                const isAvailable = count > 0;
                return (
                  <button
                    key={letter}
                    type="button"
                    disabled={!isAvailable}
                    onClick={() => jumpToLetter(letter)}
                    title={
                      isAvailable
                        ? `Jump to ${letter} (${count} ${count === 1 ? 'game' : 'games'})`
                        : `No games under ${letter}`
                    }
                    className={`min-w-[24px] sm:min-w-[26px] h-6 px-1 rounded-md font-mono text-[11px] transition-all shrink-0 flex items-center justify-center ${
                      isCurrent
                        ? 'font-extrabold text-slate-950 scale-105 cursor-pointer'
                        : isAvailable
                          ? 'text-slate-300 hover:text-white hover:bg-white/10 font-medium cursor-pointer'
                          : 'text-slate-600/45 cursor-default'
                    }`}
                    style={
                      isCurrent
                        ? {
                            backgroundColor: activeAccent,
                            boxShadow: `0 0 12px -2px ${activeAccent}90`,
                          }
                        : undefined
                    }
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Carousel Row with Beginning / Left & Right / End Scroll Buttons */}
        <div className="mx-auto max-w-[1440px] px-2 sm:px-4 flex items-center gap-1.5 sm:gap-2">
          {/* Beginning + Scroll Left Buttons */}
          <div className="flex items-center gap-1 shrink-0 z-20">
            <button
              type="button"
              onClick={() => jumpToIndex(0)}
              disabled={visibleCards.length <= 1 || activeIndex <= 0}
              aria-label="Jump to beginning"
              title="Jump to beginning (Home)"
              className="flex items-center justify-center w-8 h-10 sm:w-9 sm:h-12 rounded-lg border border-white/10 bg-[#0B0F1D] hover:bg-white/10 hover:border-white/25 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => stepSelection(-1)}
              disabled={visibleCards.length <= 1}
              aria-label="Scroll carousel left"
              title="Previous game (Left Arrow)"
              className="flex items-center justify-center w-8 h-10 sm:w-9 sm:h-12 rounded-lg border border-white/10 bg-[#0B0F1D] hover:bg-white/10 hover:border-white/25 text-slate-200 hover:text-white transition-colors cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Edge-Faded Horizontal Game Wheel */}
          <div className="relative flex-1 min-w-0">
            {/* Left & Right Soft Edge Fade Scrims */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-0 bottom-0 w-7 sm:w-14 z-10 bg-gradient-to-r from-[#070A15] via-[#070A15]/75 to-transparent"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-0 top-0 bottom-0 w-7 sm:w-14 z-10 bg-gradient-to-l from-[#070A15] via-[#070A15]/75 to-transparent"
            />

            <div
              ref={wheelStripRef}
              role="listbox"
              aria-label="Cabinet selector carousel"
              className="flex items-center gap-2 sm:gap-2.5 overflow-x-auto no-scrollbar px-6 sm:px-12 py-2"
            >
              {visibleCards.map((card) => {
                const isSelected = activeCard?.id === card.id;
                const accent = getAccentHex(card.titleColorClass);
                return (
                  <button
                    key={card.id}
                    ref={(el) => {
                      wheelItemRefs.current[card.id] = el;
                    }}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => selectCardById(card.id)}
                    className={`relative group flex flex-col items-center justify-center gap-1 w-[108px] sm:w-[132px] h-[72px] sm:h-[82px] px-2 rounded-xl border shrink-0 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                      isSelected
                        ? 'bg-[#10162B] border-white/30 opacity-100 scale-[1.05]'
                        : 'bg-[#0A0E1B]/80 border-white/[0.06] opacity-55 hover:opacity-90 hover:border-white/15'
                    }`}
                    style={
                      isSelected
                        ? {
                            boxShadow: `0 8px 24px -10px ${accent}70`,
                          }
                        : undefined
                    }
                  >
                    {/* Crisp Top Accent Bar for Selected Cabinet */}
                    {isSelected && (
                      <span
                        aria-hidden="true"
                        className="absolute top-0 left-3 right-3 h-[2px] rounded-full"
                        style={{ backgroundColor: accent }}
                      />
                    )}

                    <GameEmblem gameId={card.id} size={26} />

                    <div className="w-full text-center min-w-0">
                      <div
                        className={`text-[11px] sm:text-xs font-semibold truncate ${
                          isSelected ? card.titleColorClass : 'text-slate-200'
                        }`}
                      >
                        {card.title}
                      </div>
                      <div className="text-[10px] font-mono tabular-nums text-slate-500">
                        {card.year}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scroll Right + End Buttons */}
          <div className="flex items-center gap-1 shrink-0 z-20">
            <button
              type="button"
              onClick={() => stepSelection(1)}
              disabled={visibleCards.length <= 1}
              aria-label="Scroll carousel right"
              title="Next game (Right Arrow)"
              className="flex items-center justify-center w-8 h-10 sm:w-9 sm:h-12 rounded-lg border border-white/10 bg-[#0B0F1D] hover:bg-white/10 hover:border-white/25 text-slate-200 hover:text-white transition-colors cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => jumpToIndex(visibleCards.length - 1)}
              disabled={visibleCards.length <= 1 || activeIndex >= visibleCards.length - 1}
              aria-label="Jump to end"
              title="Jump to end (End)"
              className="flex items-center justify-center w-8 h-10 sm:w-9 sm:h-12 rounded-lg border border-white/10 bg-[#0B0F1D] hover:bg-white/10 hover:border-white/25 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Clickable Position Scrubber Track (Beginning -> End indicator) */}
        {visibleCards.length > 1 && (
          <div className="mx-auto max-w-[1440px] px-3 sm:px-6 pt-0.5 pb-1.5">
            <div
              role="slider"
              aria-label="Carousel position"
              aria-valuemin={1}
              aria-valuemax={visibleCards.length}
              aria-valuenow={activeIndex + 1}
              tabIndex={0}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                jumpToIndex(Math.round(ratio * (visibleCards.length - 1)));
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') {
                  e.preventDefault();
                  stepSelection(-1);
                } else if (e.key === 'ArrowRight') {
                  e.preventDefault();
                  stepSelection(1);
                } else if (e.key === 'Home') {
                  e.preventDefault();
                  jumpToIndex(0);
                } else if (e.key === 'End') {
                  e.preventDefault();
                  jumpToIndex(visibleCards.length - 1);
                }
              }}
              className="relative w-full h-2.5 flex items-center cursor-pointer group focus-visible:outline-none"
            >
              <div className="w-full h-1 rounded-full bg-white/[0.08] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-200"
                  style={{
                    width: `${Math.max(2, positionPercent)}%`,
                    backgroundColor: activeAccent,
                  }}
                />
              </div>
              <span
                aria-hidden="true"
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border border-slate-950 transition-all duration-200 group-hover:scale-125"
                style={{
                  left: `${positionPercent}%`,
                  backgroundColor: activeAccent,
                  boxShadow: `0 0 8px ${activeAccent}`,
                }}
              />
            </div>
          </div>
        )}
      </footer>

      {/* Optional Quick Jump Catalog Overlay (for instant 1-tap lookup across all 87 games) */}
      <AnimatePresence>
        {catalogOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
            onClick={() => setCatalogOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-5xl max-h-[84dvh] rounded-2xl bg-[#0A0E1C] border border-white/12 flex flex-col overflow-hidden"
            >
              <div className="px-4 sm:px-6 py-3.5 border-b border-white/[0.08] flex items-center justify-between gap-3 shrink-0">
                <div>
                  <h2
                    className="text-base sm:text-lg font-bold text-white"
                    style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                  >
                    Quick Cabinet Jump ({visibleCards.length})
                  </h2>
                  <p className="text-xs text-slate-400">
                    Select any game to preview on the wheel or launch directly
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCatalogOpen(false)}
                  aria-label="Close quick jump catalog"
                  className="w-9 h-9 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3.5 sm:p-5 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {visibleCards.map((card) => {
                  const isCurrent = activeCard?.id === card.id;
                  return (
                    <div
                      key={card.id}
                      className={`flex items-center justify-between gap-2.5 p-2.5 rounded-xl border transition-colors ${
                        isCurrent
                          ? 'bg-[#121933] border-white/25'
                          : 'bg-[#070A15] border-white/[0.06] hover:border-white/15'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(card.id);
                          setCatalogOpen(false);
                        }}
                        className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <GameEmblem gameId={card.id} size={28} />
                        <div className="min-w-0">
                          <div className={`text-xs font-bold truncate ${card.titleColorClass}`}>
                            {card.title}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {card.year} · {CATEGORY_LABELS[card.category]}
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectGame(card.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Play
                      </button>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

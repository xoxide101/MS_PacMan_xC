'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Download, Play, Search, X } from 'lucide-react';
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
    meta: '1983 · Ozark / EA · Planet Irata Colony Sim · Wampus Hunt',
    description:
      'Claim River, Plains, and Mountain plots on Planet Irata, outfit robotic M.U.L.E.s for Food, Energy, and Smithore, hunt the elusive Wampus, and out-earn 3 rival colonists.',
    footerLabel: 'Frontier Strategy',
    footerSummary: 'Land Grants · M.U.L.E. Outfitting · Live Market',
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
    meta: '1981 · Taito · Stix Territory Carving · 2× Slow Draw',
    description:
      'Claim 75% of the playfield by drawing Stix polygons around the erratic neon Qix—risk Slow Draw for 2× points while dodging perimeter Sparx and burning Fuses.',
    footerLabel: 'Territory Strategy',
    footerSummary: 'Fast vs 2× Slow Draw · Sparx · Fuse Timer',
    titleColorClass: 'text-pink-400',
    scoreColorClass: 'text-pink-200',
    borderHoverClass: 'hover:border-pink-400/50',
    buttonClass: 'bg-pink-500 hover:bg-pink-400 text-white focus-visible:ring-pink-300',
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
    meta: '1984 · Capcom · P-38 Lightning · Barrel Roll & Wingmen',
    description:
      'Soar over Pacific carriers in Capcom’s vertical-scrolling classic—execute invulnerable Barrel Roll Loops, earn POW quad-guns and wingmen, and down giant Ayako bombers.',
    footerLabel: 'Pacific Ace',
    footerSummary: 'Barrel Roll Loop · POW Upgrades · Wingmen',
    titleColorClass: 'text-slate-200',
    scoreColorClass: 'text-slate-200',
    borderHoverClass: 'hover:border-slate-300/50',
    buttonClass: 'bg-slate-200 hover:bg-white text-slate-950 focus-visible:ring-slate-300',
  },
  {
    id: 'ww1943',
    title: '1943: The Battle of Midway',
    year: 1987,
    category: 'shooters',
    meta: '1987 · Capcom · Shotgun & 3-Way · Lightning Mega-Crash',
    description:
      'Unleash bullet-clearing Shotguns, 3-Way spreads, and screen-shaking Lightning Mega-Crashes against towering naval battleships and aircraft carriers at Midway!',
    footerLabel: 'Midway Arsenal',
    footerSummary: 'Shotgun & 3-Way · Mega-Crash · Battleship Boss',
    titleColorClass: 'text-sky-400',
    scoreColorClass: 'text-sky-200',
    borderHoverClass: 'hover:border-sky-400/50',
    buttonClass: 'bg-sky-400 hover:bg-sky-300 text-slate-950 focus-visible:ring-sky-200',
  },
  {
    id: 'berzerk',
    title: 'Berzerk',
    year: 1980,
    category: 'action',
    meta: '1980 · Stern · Electrified Mazes · Smart Robots & Evil Otto',
    description:
      'Blast through procedurally generated electrified robot corridors—trick laser-firing automatons into walking into walls and escape before invincible Evil Otto arrives!',
    footerLabel: 'Maze Combat',
    footerSummary: '8-Way Laser · Electrified Walls · Evil Otto',
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
    meta: '1982 · Williams · Twin-Stick Frenzy · Save Last Humans',
    description:
      'Pure electric twin-stick adrenaline—dodge swarming Grunts, indestructible Hulks, Brains, and Electrodes while rescuing the last surviving human family!',
    footerLabel: 'Twin-Stick Action',
    footerSummary: 'WASD + Mouse Aim · Human Rescues · Swarms',
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
    meta: '1981 · Konami / Sega · 5-Lane Highway · Logs & Turtles',
    description:
      'Leap across five lanes of roaring rush-hour traffic, ride river logs and diving turtles, hitch a lift with Lady Frog, and claim all five lily pad homes.',
    footerLabel: 'Arcade Classic',
    footerSummary: '5-Lane Highway · Diving Turtles · 5 Berths',
    titleColorClass: 'text-green-400',
    scoreColorClass: 'text-green-200',
    borderHoverClass: 'hover:border-green-400/50',
    buttonClass: 'bg-green-500 hover:bg-green-400 text-slate-950 focus-visible:ring-green-200',
  },
  {
    id: 'joust',
    title: 'Joust',
    year: 1982,
    category: 'action',
    meta: '1982 · Williams · Ostrich Wing-Flap · Lance Height Duels',
    description:
      'Flap your armored Ostrich above rival Buzzard Knights to unseat them in mid-air lance duels, scoop up falling Eggs before they hatch, and stay clear of the Lava Troll!',
    footerLabel: 'Aerial Duels',
    footerSummary: 'Flap Physics · Mid-Air Eggs · Lava Bridge',
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
    meta: '1982 · Sega · Sliding Ice Maze · Crush Sno-Bees & Diamonds',
    description:
      'Waddle through an icy labyrinth shoving frost cubes to flatten Sno-Bees, rattle outer walls to stun foes, and align all three sparkling Diamond Blocks for 10,000 points!',
    footerLabel: 'Ice Labyrinth',
    footerSummary: 'Sliding Ice Crush · Wall Stun · 3 Diamonds',
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
    meta: '1982 · Nintendo · Catch Olive’s Hearts · Spinach & Bluto',
    description:
      'Catch every Heart, Musical Note, and HELP letter dropped by Olive Oyl across multi-deck ships while punching bottles and downing Spinach to send Bluto flying!',
    footerLabel: 'Sailor Action',
    footerSummary: 'Heart Catching · Spinach Power · Punch Bluto',
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
    meta: '1983 · Atari · Isometric 3D Castles · Bentley Bear & Gems',
    description:
      'Guide Bentley Bear across elevated isometric 3D stairways and towers—scoop shimmering gems, leap over Gem Eaters, ride crystal lifts, and outfox Berthilda the Witch.',
    footerLabel: 'Isometric 3D',
    footerSummary: 'Bentley Bear · Magic Hat · Multi-Tier Castles',
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
    meta: '1986 · Bally Midway · George, Lizzie & Ralph · City Siege',
    description:
      'Scale towering skyscrapers as giant ape George, lizard Lizzie, or werewolf Ralph—smash windows for snacks, swat military choppers, and bring every city block crashing down!',
    footerLabel: 'Monster Mayhem',
    footerSummary: '3 Playable Kaiju · Skyscraper Collapse · Snacks',
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
    meta: '2000 · Midway · Custom 2.5D Engine · 8 Heroes × 4 Colors · 5 Realms',
    description:
      'Built on its own extruded 2.5D engine! Pick from 8 heroes in 4 colors at Sumner’s Tower, unleash 3-hit melee combos & elemental Turbo attacks, level up with XP, hunt Runestones, upgrade at Sumner’s Armory, and defeat Skorne.',
    footerLabel: 'Dark Legacy Engine',
    footerSummary: '8 Classes × 4 Colors · Melee + Turbo · 5 Realm Bosses',
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

const QUICK_NAV_IDS: GameId[] = ['puzzlebobble3', 'breakout2016evo', 'starwars', 'galaga', 'smw1', 'arkanoid'];

const FILTER_TABS: Array<{ id: FilterCategory; label: string }> = [
  { id: 'all', label: 'All 87' },
  { id: 'platformers', label: 'Platformers (12)' },
  { id: 'shooters', label: 'Shooters (27)' },
  { id: 'action', label: 'Action (19)' },
  { id: 'puzzle', label: 'Puzzle (8)' },
  { id: 'racing', label: 'Racing (12)' },
  { id: 'rpg', label: 'RPG & Sim (3)' },
  { id: 'pacman', label: 'Pac-Man (6)' },
];

export default function ArcadeHub() {
  const [screen, setScreen] = useState<ActiveScreen>('select');
  const [filter, setFilter] = useState<FilterCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isStandaloneFile, setIsStandaloneFile] = useState(false);
  const [highScores, setHighScores] = useState<ScoreMap>(createZeroScores);

  const handleSelectGame = useCallback((next: ActiveScreen) => {
    arcadeAudio.stopAmbient();
    arcadeMusic.stop();
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
      arcadeMusic.stop();
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

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const visibleCards = CABINET_CARDS.filter((c) => {
    if (filter !== 'all' && c.category !== filter) return false;
    if (!normalizedSearch) return true;
    return (
      c.title.toLowerCase().includes(normalizedSearch) ||
      c.meta.toLowerCase().includes(normalizedSearch) ||
      c.description.toLowerCase().includes(normalizedSearch) ||
      String(c.year).includes(normalizedSearch)
    );
  });

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
    <div className="min-h-[100dvh] w-full bg-[#060811] text-slate-100 flex flex-col overflow-x-clip">
      {/* Clean 3-Zone Top Bar */}
      <header className="w-full border-b border-white/[0.07] bg-[#080B16]/90 backdrop-blur-md safe-top-pad">
        <div className="mx-auto max-w-[1360px] px-3.5 sm:px-8 h-14 sm:h-16 flex items-center justify-between gap-3 sm:gap-8">
          <span
            className="text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap truncate"
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
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-lg border border-white/12 bg-white/[0.05] hover:bg-white/[0.1] text-xs font-medium text-slate-100 transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download index.html</span>
                <span className="sm:hidden">Offline</span>
              </a>
            ) : (
              <span className="text-xs text-slate-400 whitespace-nowrap shrink-0">
                87 Cabinets · 60fps
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Selection Floor */}
      <main className="flex-1 w-full mx-auto max-w-[1360px] px-3.5 sm:px-8 py-5 sm:py-10 safe-bottom-pad">
        <div className="flex flex-col gap-5 mb-7 sm:mb-9">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="max-w-3xl space-y-2">
              <h1
                className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white text-balance"
                style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
              >
                Choose Your Cabinet
              </h1>
              <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
                Eighty-seven Golden Age &amp; modern evolved arcade classics remastered at high resolution and locked 60fps with synthesized background music—featuring the 2.5D Puzzle Bobble Series (1, 2 &amp; Evo), Breakout 2016 Evo, Space Invaders 1/II/DX, Gauntlet I &amp; II + Dark Legacy, the complete Sprint lineage, Tempest 1/2K/3K, Star Wars Trilogy, Galaga, Super Mario World 1 &amp; 2, Ys Book I &amp; II, Sonic 1–3, and the full Pac-Man collection.
              </p>
            </div>

            {/* Compact Instant Search */}
            <div className="relative w-full lg:w-72 shrink-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search 87 games, years, studios..."
                aria-label="Search 87 arcade games"
                className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-[#0B0F1D] border border-white/10 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-white/25 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Interactive Category Filter Control */}
          <div
            role="tablist"
            aria-label="Filter arcade cabinets"
            className="flex items-center gap-1 p-1 rounded-xl bg-[#0B0F1D] border border-white/[0.08] max-w-full overflow-x-auto sm:inline-flex sm:flex-wrap sm:self-start"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 xl:gap-6 items-stretch">
          {visibleCards.map((card, idx) => (
            <motion.article
              key={card.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: Math.min(idx, 6) * 0.03, ease: [0.16, 1, 0.3, 1] }}
              className={`group flex flex-col rounded-2xl bg-[#0B0F1D] border border-white/[0.08] ${card.borderHoverClass} transition-colors overflow-clip`}
            >
              {/* Live 60fps HiDPI Preview */}
              <div
                onClick={() => handleSelectGame(card.id)}
                role="button"
                tabIndex={-1}
                className="relative w-full h-48 sm:h-52 overflow-clip bg-[#04060D] border-b border-white/[0.07] cursor-pointer"
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

        {visibleCards.length === 0 && (
          <div className="py-16 text-center rounded-2xl bg-[#0B0F1D] border border-white/[0.08]">
            <p className="text-sm text-slate-400">
              No cabinets match <span className="text-white font-medium">&ldquo;{searchQuery}&rdquo;</span>.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setFilter('all');
              }}
              className="mt-3 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-white cursor-pointer"
            >
              Show All 87 Cabinets
            </button>
          </div>
        )}

        <p className="mt-8 text-xs text-slate-500 text-center">
          Switch between all 87 cabinets anytime from the left rail or return here via the top bar · Toggle simulated arcade music in any cabinet
        </p>
      </main>
    </div>
  );
}

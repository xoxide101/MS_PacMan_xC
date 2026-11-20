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
  return {
    classic: 0,
    plus: 0,
    ms: 0,
    super: 0,
    jr: 0,
    pacmania: 0,
    centipede: 0,
    millipede: 0,
    digdug: 0,
    boulderdash: 0,
    invaders: 0,
    invaders2: 0,
    foodfight: 0,
  };
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
  // Golden Age Classics (7)
  {
    id: 'centipede',
    title: 'Centipede',
    year: 1981,
    category: 'classic-arcade',
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
    category: 'classic-arcade',
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
    category: 'classic-arcade',
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
    category: 'classic-arcade',
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
    category: 'classic-arcade',
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
    category: 'classic-arcade',
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
    category: 'classic-arcade',
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

  // Pac-Man Series (6)
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

const QUICK_NAV_IDS: GameId[] = ['centipede', 'digdug', 'boulderdash', 'invaders', 'foodfight'];

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
                13 Cabinets · 60fps HiDPI
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Selection Floor */}
      <main className="flex-1 w-full mx-auto max-w-[1360px] px-5 sm:px-8 py-8 sm:py-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 mb-7 sm:mb-9">
          <div className="max-w-2xl space-y-2">
            <h1
              className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white text-balance"
              style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
            >
              Choose Your Cabinet
            </h1>
            <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
              Thirteen Golden Age arcade classics remastered at high resolution and locked 60fps—spanning Centipede, Millipede, Dig Dug, Boulder Dash, Space Invaders I & II, Food Fight, and the full six-game Pac-Man collection.
            </p>
          </div>

          {/* Interactive Category Filter Control */}
          <div
            role="tablist"
            aria-label="Filter arcade cabinets"
            className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#0B0F1D] border border-white/[0.08] self-start md:self-auto shrink-0"
          >
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'all'}
              onClick={() => setFilter('all')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filter === 'all'
                  ? 'bg-white text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All 13 Cabinets
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'classic-arcade'}
              onClick={() => setFilter('classic-arcade')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filter === 'classic-arcade'
                  ? 'bg-white text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Golden Age Classics (7)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'pacman'}
              onClick={() => setFilter('pacman')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filter === 'pacman'
                  ? 'bg-white text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Pac-Man Series (6)
            </button>
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
          Switch between all 13 cabinets anytime from the left rail or return here via the top bar
        </p>
      </main>
    </div>
  );
}

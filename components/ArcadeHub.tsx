'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Download, Play } from 'lucide-react';
import { CABINET_LIST, GameId } from '@/lib/game/arcadeTypes';
import { arcadeAudio } from '@/lib/game/audio';
import { CLASSIC_BONUS_ORDER } from '@/lib/game/classicEngine';
import { JR_LEVEL_PRIZE_ORDER } from '@/lib/game/jrTypes';
import { PLUS_BONUS_ORDER } from '@/lib/game/plusEngine';
import { SUPER_PRIZE_ORDER } from '@/lib/game/superTypes';
import { LEVEL_FRUIT_ORDER } from '@/lib/game/types';
import CabinetPreviewCanvas from './CabinetPreviewCanvas';
import ClassicPacManArcade from './ClassicPacManArcade';
import JrPacManArcade from './JrPacManArcade';
import {
  ClassicBonusEmblem,
  ClassicPacManEmblem,
  FruitEmblem,
  JrPacManEmblem,
  JrPrizeEmblem,
  MsPacManEmblem,
  PacManiaEmblem,
  PacManPlusEmblem,
  PlusBonusEmblem,
  SuperPacManEmblem,
  SuperPrizeEmblem,
} from './MiniEmblemCanvas';
import MsPacManArcade from './MsPacManArcade';
import PacManiaArcade from './PacManiaArcade';
import PacManPlusArcade from './PacManPlusArcade';
import SuperPacManArcade from './SuperPacManArcade';

type ActiveScreen = 'select' | GameId;

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

const VALID_GAME_IDS = new Set<GameId>(['classic', 'plus', 'ms', 'super', 'jr', 'pacmania']);

function parseHashToScreen(hash: string): ActiveScreen {
  const cleaned = hash.replace(/^#\/?/, '').trim().toLowerCase() as GameId;
  return VALID_GAME_IDS.has(cleaned) ? cleaned : 'select';
}

function loadAllHighScores(): ScoreMap {
  return {
    classic: readStoredScore('classic_pacman_hd_highscore_v1'),
    plus: readStoredScore('pacman_plus_hd_highscore_v1'),
    ms: readStoredScore('ms_pacman_hd_highscore_v1'),
    super: readStoredScore('super_pacman_hd_highscore_v1'),
    jr: readStoredScore('jr_pacman_hd_highscore_v1'),
    pacmania: readStoredScore('pacmania_hd_highscore_v1'),
  };
}

interface CabinetCardConfig {
  id: GameId;
  title: string;
  year: number;
  meta: string;
  description: string;
  titleColorClass: string;
  scoreColorClass: string;
  borderHoverClass: string;
  buttonClass: string;
  shortcut: string;
}

const CABINET_CARDS: CabinetCardConfig[] = [
  {
    id: 'classic',
    title: 'Pac-Man',
    year: 1980,
    meta: '1980 · Original Cobalt Maze · Classic 4 Ghosts',
    description:
      'The iconic 1980 arcade original remastered in crisp 60fps vector HD with Blinky, Pinky, Inky, and Clyde plus escalating center bonus items.',
    titleColorClass: 'text-blue-400',
    scoreColorClass: 'text-blue-200',
    borderHoverClass: 'hover:border-blue-400/50',
    buttonClass: 'bg-blue-500 hover:bg-blue-400 text-white focus-visible:ring-blue-300',
    shortcut: '1',
  },
  {
    id: 'plus',
    title: 'Pac-Man Plus',
    year: 1982,
    meta: '1982 · Emerald Maze · Wildcard Energizers · 2× Bonus Power',
    description:
      'Midway’s faster, trickier sequel: chomp Soda Cans and Pea Pods to turn ghosts invisible for 2× points, and survive vanishing mazes and stubborn hunters.',
    titleColorClass: 'text-emerald-400',
    scoreColorClass: 'text-emerald-200',
    borderHoverClass: 'hover:border-emerald-400/50',
    buttonClass: 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 focus-visible:ring-emerald-200',
    shortcut: '2',
  },
  {
    id: 'ms',
    title: 'Ms. Pac-Man',
    year: 1982,
    meta: '1982 · 4 Classic Mazes · Dual Warp Tunnels · Roaming Fruits',
    description:
      'Outsmart Blinky, Pinky, Inky, and Sue across four vibrant neon mazes with dual warp tunnels and bouncing fruits that sweep through the corridors.',
    titleColorClass: 'text-amber-300',
    scoreColorClass: 'text-amber-200',
    borderHoverClass: 'hover:border-amber-400/50',
    buttonClass: 'bg-amber-400 hover:bg-amber-300 text-slate-950 focus-visible:ring-amber-200',
    shortcut: '3',
  },
  {
    id: 'super',
    title: 'Super Pac-Man',
    year: 1982,
    meta: '1982 · Keys & Locked Vaults · Giant Super Mode · Turbo Dash',
    description:
      'Collect golden keys to unlock sealed treasure chambers—or chomp a Green Super Pellet to grow giant, smash straight through locked gates, and turbo dash.',
    titleColorClass: 'text-green-400',
    scoreColorClass: 'text-green-200',
    borderHoverClass: 'hover:border-green-400/50',
    buttonClass: 'bg-green-500 hover:bg-green-400 text-slate-950 focus-visible:ring-green-200',
    shortcut: '4',
  },
  {
    id: 'jr',
    title: 'Jr. Pac-Man',
    year: 1983,
    meta: '1983 · 2× Wide Scrolling Mazes · Mutating Dots · 6 Energizers',
    description:
      'Navigate double-wide scrolling labyrinths with zero warp tunnels, 50-point mutating super dots, roaming toys, and a live tactical minimap radar.',
    titleColorClass: 'text-teal-300',
    scoreColorClass: 'text-teal-200',
    borderHoverClass: 'hover:border-teal-400/50',
    buttonClass: 'bg-teal-400 hover:bg-teal-300 text-slate-950 focus-visible:ring-teal-200',
    shortcut: '5',
  },
  {
    id: 'pacmania',
    title: 'Pac-Mania',
    year: 1987,
    meta: '1987 · Isometric 3D Worlds · Jump Over Ghosts · Funky & Spunky',
    description:
      'Explore four extruded 3D worlds from Block Town to Jungly Steps and leap right over pursuing ghosts—while watching out for synced jumpers Funky and Spunky.',
    titleColorClass: 'text-pink-400',
    scoreColorClass: 'text-pink-200',
    borderHoverClass: 'hover:border-pink-400/50',
    buttonClass: 'bg-pink-500 hover:bg-pink-400 text-white focus-visible:ring-pink-300',
    shortcut: '6',
  },
];

export default function ArcadeHub() {
  const [screen, setScreen] = useState<ActiveScreen>('select');
  const [isStandaloneFile, setIsStandaloneFile] = useState(false);
  const [highScores, setHighScores] = useState<ScoreMap>({
    classic: 0,
    plus: 0,
    ms: 0,
    super: 0,
    jr: 0,
    pacmania: 0,
  });

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

  // Sync URL hash navigation (index.html#classic, #plus, #ms, #super, #jr, #pacmania)
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

    const onKeyDown = (e: KeyboardEvent) => {
      const idx = parseInt(e.key, 10) - 1;
      if (idx >= 0 && idx < CABINET_LIST.length) {
        handleSelectGame(CABINET_LIST[idx].id);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [screen, handleSelectGame]);

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

  const renderEmblem = (id: GameId) => {
    switch (id) {
      case 'classic':
        return <ClassicPacManEmblem size={38} />;
      case 'plus':
        return <PacManPlusEmblem size={38} />;
      case 'ms':
        return <MsPacManEmblem size={38} />;
      case 'super':
        return <SuperPacManEmblem size={40} />;
      case 'jr':
        return <JrPacManEmblem size={38} />;
      case 'pacmania':
        return <PacManiaEmblem size={40} />;
    }
  };

  const renderFooterRoster = (id: GameId) => {
    if (id === 'classic') {
      return (
        <div className="flex items-center justify-between pt-3 border-t border-white/[0.07]">
          <span className="text-xs text-slate-400">Bonus Items</span>
          <div className="flex items-center gap-1.5">
            {CLASSIC_BONUS_ORDER.slice(0, 6).map((bt) => (
              <ClassicBonusEmblem key={bt} type={bt} size={20} />
            ))}
          </div>
        </div>
      );
    }
    if (id === 'plus') {
      return (
        <div className="flex items-center justify-between pt-3 border-t border-white/[0.07]">
          <span className="text-xs text-slate-400">2× Power Treats</span>
          <div className="flex items-center gap-1.5">
            {PLUS_BONUS_ORDER.slice(0, 6).map((bt) => (
              <PlusBonusEmblem key={bt} type={bt} size={20} />
            ))}
          </div>
        </div>
      );
    }
    if (id === 'ms') {
      return (
        <div className="flex items-center justify-between pt-3 border-t border-white/[0.07]">
          <span className="text-xs text-slate-400">Bonus Fruits</span>
          <div className="flex items-center gap-1.5">
            {LEVEL_FRUIT_ORDER.map((ft) => (
              <FruitEmblem key={ft} type={ft} size={20} />
            ))}
          </div>
        </div>
      );
    }
    if (id === 'super') {
      return (
        <div className="flex items-center justify-between pt-3 border-t border-white/[0.07]">
          <span className="text-xs text-slate-400">Vault Treasures</span>
          <div className="flex items-center gap-1.5">
            {SUPER_PRIZE_ORDER.slice(0, 6).map((pt) => (
              <SuperPrizeEmblem key={pt} type={pt} size={20} />
            ))}
          </div>
        </div>
      );
    }
    if (id === 'jr') {
      return (
        <div className="flex items-center justify-between pt-3 border-t border-white/[0.07]">
          <span className="text-xs text-slate-400">Roaming Toys</span>
          <div className="flex items-center gap-1.5">
            {JR_LEVEL_PRIZE_ORDER.map((pt) => (
              <JrPrizeEmblem key={pt} type={pt} size={20} />
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-between pt-3 border-t border-white/[0.07]">
        <span className="text-xs text-slate-400">3D Worlds</span>
        <span className="text-xs text-slate-300 font-medium">
          Block Town · Park · Sandbox Land · Jungly Steps
        </span>
      </div>
    );
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[#060811] text-slate-100 flex flex-col">
      {/* Clean Single-Row Top Bar */}
      <header className="w-full border-b border-white/[0.07] bg-[#080B16]/90 backdrop-blur-md">
        <div className="mx-auto max-w-[1360px] px-5 sm:px-8 h-16 flex items-center justify-between gap-6">
          <span
            className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
            style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
          >
            Pac-Man Arcade Collection
          </span>

          <nav className="hidden xl:flex items-center gap-5 text-sm font-medium text-slate-400">
            {CABINET_CARDS.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => handleSelectGame(card.id)}
                className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {card.title}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-4 shrink-0">
            <span className="text-xs text-slate-400 whitespace-nowrap hidden sm:inline">
              6 Cabinets · 60fps HiDPI
            </span>
            {!isStandaloneFile && (
              <a
                href="/arcade-index.html"
                download="index.html"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/12 bg-white/[0.04] hover:bg-white/[0.09] text-xs font-medium text-slate-200 hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download index.html</span>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Main Selection Arena */}
      <main className="flex-1 w-full mx-auto max-w-[1360px] px-5 sm:px-8 py-8 sm:py-10 flex flex-col justify-center">
        <div className="max-w-2xl mb-7 sm:mb-9 space-y-2">
          <h1
            className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white text-balance"
            style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
          >
            Choose Your Cabinet
          </h1>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
            Six classic arcade cabinets rebuilt at high resolution and locked 60fps—all running in one self-contained web page from the 1980 original and Pac-Man Plus to Super Pac-Man and 3D Pac-Mania.
          </p>
        </div>

        {/* 6 Live Preview Cabinets Grid (Balanced 3 × 2 on desktop) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 xl:gap-6 items-stretch">
          {CABINET_CARDS.map((card, idx) => (
            <motion.article
              key={card.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.26, delay: idx * 0.04, ease: [0.16, 1, 0.3, 1] }}
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
                      {renderEmblem(card.id)}
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

                  {renderFooterRoster(card.id)}
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

        <p className="mt-7 text-xs text-slate-500 text-center">
          Quick launch with keys <span className="font-mono text-slate-300">1</span>–
          <span className="font-mono text-slate-300">6</span> · Switch cabinets anytime from the left rail or top bar
        </p>
      </main>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpFromLine,
  LayoutGrid,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { CABINET_LIST, GameId } from '@/lib/game/arcadeTypes';
import { arcadeAudio } from '@/lib/game/audio';
import { PacManiaEngine } from '@/lib/game/pacmaniaEngine';
import { PacManiaRenderer } from '@/lib/game/pacmaniaRenderer';
import {
  PacManiaHudSnapshot,
  PM_VIEWPORT_HEIGHT,
  PM_VIEWPORT_WIDTH,
} from '@/lib/game/pacmaniaTypes';
import { PACMANIA_WORLDS } from '@/lib/game/pacmaniaWorlds';
import { Direction, SpeedMode, VisualStyle } from '@/lib/game/types';
import { PacManiaEmblem } from './MiniEmblemCanvas';

const FIXED_STEP = 1 / 60;

const PM_GHOST_ROSTER = [
  { name: 'Blinky', role: 'Chaser', color: '#FF2A42' },
  { name: 'Pinky', role: 'Ambusher', color: '#FF80C8' },
  { name: 'Inky', role: 'Flanker', color: '#1CE4FF' },
  { name: 'Clyde', role: 'Roamer', color: '#FF9B26' },
  { name: 'Sue', role: 'Tailer', color: '#A855F7' },
  { name: 'Funky', role: 'Low Jumper', color: '#22C55E' },
  { name: 'Spunky', role: 'High Jumper (W2+)', color: '#CBD5E1' },
];

interface PacManiaArcadeProps {
  onSwitchGame?: (game: GameId) => void;
  onOpenLobby?: () => void;
}

export default function PacManiaArcade({
  onSwitchGame,
  onOpenLobby,
}: PacManiaArcadeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<PacManiaEngine | null>(null);
  const rendererRef = useRef<PacManiaRenderer | null>(null);
  const visualStyleRef = useRef<VisualStyle>('hd');
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const [visualStyle, setVisualStyle] = useState<VisualStyle>('hd');
  const [speedMode, setSpeedMode] = useState<SpeedMode>('arcade');
  const [muted, setMuted] = useState(false);

  const [hud, setHud] = useState<PacManiaHudSnapshot>({
    phase: 'TITLE_MENU',
    score: 0,
    highScore: 0,
    isNewHighScore: false,
    lives: 3,
    level: 1,
    worldIndex: 0,
    worldName: PACMANIA_WORLDS[0].theme.name,
    worldSubtitle: PACMANIA_WORLDS[0].theme.subtitle,
    worldAccent: PACMANIA_WORLDS[0].theme.accentHex,
    pelletsLeft: PACMANIA_WORLDS[0].totalPellets,
    totalPellets: PACMANIA_WORLDS[0].totalPellets,
    ghostsEatenTotal: 0,
    jumpsClearedTotal: 0,
    frightenedRemaining: 0,
    speedBoostRemaining: 0,
    doubleScoreRemaining: 0,
    isAirborne: false,
    spunkyActive: false,
    extraLifeAwarded: false,
  });

  useEffect(() => {
    visualStyleRef.current = visualStyle;
  }, [visualStyle]);

  const syncHudNow = useCallback(() => {
    if (engineRef.current) setHud(engineRef.current.getHudSnapshot());
  }, []);

  const handleStartGame = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.startNewGame();
    setHud(engine.getHudSnapshot());
  }, []);

  const handleTogglePause = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.togglePause();
    setHud(engine.getHudSnapshot());
  }, []);

  const handleReturnTitle = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.returnToTitle();
    setHud(engine.getHudSnapshot());
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      arcadeAudio.setMuted(next);
      return next;
    });
  }, []);

  const handleSpeedChange = useCallback((mode: SpeedMode) => {
    setSpeedMode(mode);
    engineRef.current?.setSpeedMode(mode);
  }, []);

  const handlePreviewWorld = useCallback((idx: number) => {
    const engine = engineRef.current;
    if (!engine || engine.phase !== 'TITLE_MENU') return;
    engine.previewWorld(idx);
    setHud(engine.getHudSnapshot());
  }, []);

  const handleDirectionInput = useCallback((dir: Direction) => {
    arcadeAudio.unlock();
    engineRef.current?.setDesiredDirection(dir);
  }, []);

  const handleJump = useCallback(() => {
    arcadeAudio.unlock();
    engineRef.current?.triggerJump();
  }, []);

  useEffect(() => {
    const engine = new PacManiaEngine();
    const renderer = new PacManiaRenderer();
    engineRef.current = engine;
    rendererRef.current = renderer;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let dpr = Math.min(window.devicePixelRatio || 1, 3);
    const updateCanvasResolution = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = Math.round(PM_VIEWPORT_WIDTH * dpr);
      canvas.height = Math.round(PM_VIEWPORT_HEIGHT * dpr);
    };
    updateCanvasResolution();
    window.addEventListener('resize', updateCanvasResolution);

    let rafId = 0;
    let lastTime = performance.now();
    let accumulator = 0;
    let hudSyncTimer = 0.15;
    let lastPhase = engine.phase;
    let lastScore = -1;
    let lastLives = engine.lives;
    let lastPellets = engine.pelletsLeft;

    const frame = (now: number) => {
      const frameDelta = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;
      accumulator += frameDelta;
      while (accumulator >= FIXED_STEP) {
        engine.step(FIXED_STEP);
        accumulator -= FIXED_STEP;
      }
      renderer.render(ctx, engine, dpr, visualStyleRef.current);

      hudSyncTimer += frameDelta;
      const changed =
        engine.phase !== lastPhase ||
        engine.score !== lastScore ||
        engine.lives !== lastLives ||
        engine.pelletsLeft !== lastPellets;

      if (changed || hudSyncTimer >= 0.1) {
        lastPhase = engine.phase;
        lastScore = engine.score;
        lastLives = engine.lives;
        lastPellets = engine.pelletsLeft;
        hudSyncTimer = 0;
        setHud(engine.getHudSnapshot());
      }
      rafId = window.requestAnimationFrame(frame);
    };

    rafId = window.requestAnimationFrame(frame);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updateCanvasResolution);
      arcadeAudio.stopAmbient();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;
      const key = e.key;
      if (
        key === 'ArrowUp' ||
        key === 'ArrowDown' ||
        key === 'ArrowLeft' ||
        key === 'ArrowRight' ||
        key === ' '
      ) {
        e.preventDefault();
      }
      if (key === 'ArrowUp' || key === 'w' || key === 'W') {
        arcadeAudio.unlock();
        engine.setDesiredDirection('UP');
      } else if (key === 'ArrowDown' || key === 's' || key === 'S') {
        arcadeAudio.unlock();
        engine.setDesiredDirection('DOWN');
      } else if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
        arcadeAudio.unlock();
        engine.setDesiredDirection('LEFT');
      } else if (key === 'ArrowRight' || key === 'd' || key === 'D') {
        arcadeAudio.unlock();
        engine.setDesiredDirection('RIGHT');
      } else if (key === ' ' || key === 'j' || key === 'J') {
        if (engine.phase === 'TITLE_MENU' || engine.phase === 'GAME_OVER') {
          if (key === ' ') {
            engine.startNewGame();
            syncHudNow();
          }
        } else if (engine.phase === 'PLAYING') {
          engine.triggerJump();
        }
      } else if (key === 'Enter') {
        if (engine.phase === 'TITLE_MENU' || engine.phase === 'GAME_OVER') {
          engine.startNewGame();
          syncHudNow();
        } else if (engine.phase === 'PLAYING' || engine.phase === 'PAUSED') {
          engine.togglePause();
          syncHudNow();
        }
      } else if (key === 'p' || key === 'P' || key === 'Escape') {
        if (engine.phase === 'PLAYING' || engine.phase === 'PAUSED') {
          engine.togglePause();
          syncHudNow();
        }
      } else if (key === 'm' || key === 'M') {
        handleToggleMute();
      } else if (key === 'r' || key === 'R') {
        if (engine.phase !== 'TITLE_MENU') {
          engine.startNewGame();
          syncHudNow();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleToggleMute, syncHudNow]);

  const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 0) return;
    arcadeAudio.unlock();
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!touchStartRef.current || e.touches.length === 0) return;
    const dx = e.touches[0].clientX - touchStartRef.current.x;
    const dy = e.touches[0].clientY - touchStartRef.current.y;
    if (Math.abs(dx) < 22 && Math.abs(dy) < 22) return;
    if (Math.abs(dx) > Math.abs(dy)) handleDirectionInput(dx > 0 ? 'RIGHT' : 'LEFT');
    else handleDirectionInput(dy > 0 ? 'DOWN' : 'UP');
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const clearedRatio =
    hud.totalPellets > 0 ? (hud.totalPellets - hud.pelletsLeft) / hud.totalPellets : 0;
  const isActiveRun =
    hud.phase === 'PLAYING' ||
    hud.phase === 'READY' ||
    hud.phase === 'PAUSED' ||
    hud.phase === 'GHOST_EATEN_PAUSE' ||
    hud.phase === 'DYING' ||
    hud.phase === 'STAGE_CLEAR';

  return (
    <div className="min-h-[100dvh] w-full bg-[#060811] text-slate-100 flex flex-col justify-between selection:bg-pink-400/25">
      <header className="w-full border-b border-white/[0.07] bg-[#080B16]/90 backdrop-blur-md">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 h-14 flex items-center justify-between gap-6">
          <button
            type="button"
            onClick={onOpenLobby ?? handleReturnTitle}
            title="Back to Cabinet Selection"
            className="flex items-center gap-2.5 text-left rounded-md whitespace-nowrap shrink-0 cursor-pointer"
          >
            <PacManiaEmblem size={26} />
            <span
              className="text-lg font-bold tracking-tight text-pink-400"
              style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
            >
              Pac-Mania
            </span>
          </button>

          <div className="flex items-center gap-4 sm:gap-7 text-xs sm:text-sm whitespace-nowrap shrink-0">
            <div className="flex items-baseline gap-2">
              <span className="text-slate-400 font-medium">Score</span>
              <span className="font-mono tabular-nums font-semibold text-white text-sm sm:text-base">
                {hud.score.toLocaleString()}
              </span>
            </div>
            <span className="text-white/15 hidden sm:inline" aria-hidden="true">/</span>
            <div className="hidden sm:flex items-baseline gap-2">
              <span className="text-slate-400 font-medium">High Score</span>
              <span className="font-mono tabular-nums font-semibold text-pink-300 text-base">
                {hud.highScore.toLocaleString()}
              </span>
            </div>
            <span className="text-white/15 hidden md:inline" aria-hidden="true">/</span>
            <div className="hidden md:flex items-baseline gap-2">
              <span className="text-slate-400 font-medium">World</span>
              <span className="font-mono tabular-nums font-semibold text-slate-100 text-base">
                {hud.level}
              </span>
              <span className="text-slate-500 text-xs">·</span>
              <span className="text-slate-300 font-medium">{hud.worldName}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {onOpenLobby && (
              <button
                type="button"
                onClick={onOpenLobby}
                className="hidden sm:flex h-9 px-3 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-slate-300 hover:text-white text-xs font-medium items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Cabinets</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleToggleMute}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              className="h-9 w-9 flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-300 hover:text-white hover:bg-white/[0.08] cursor-pointer"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            {isActiveRun ? (
              <button
                type="button"
                onClick={handleTogglePause}
                className="h-9 px-3.5 rounded-lg border border-white/10 bg-white/[0.06] hover:bg-white/[0.12] text-slate-100 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {hud.phase === 'PAUSED' ? (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Resume</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pause</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartGame}
                className="h-9 px-4 rounded-lg bg-pink-500 hover:bg-pink-400 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start Game</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 w-full mx-auto max-w-[1440px] px-3 sm:px-6 py-3 sm:py-4 flex flex-col lg:flex-row items-center lg:items-stretch justify-center gap-5 xl:gap-8">
        {/* Left Architectural Rail */}
        <aside className="hidden lg:flex flex-col justify-between w-[240px] xl:w-[272px] shrink-0 py-1">
          <div className="space-y-5">
            {onSwitchGame && (
              <section className="pb-5 border-b border-white/[0.07]">
                <div className="text-xs font-medium text-slate-400 mb-2">Arcade Cabinets</div>
                <div className="grid grid-cols-1 gap-1 max-h-[248px] overflow-y-auto pr-1">
                  {CABINET_LIST.map((cab) => (
                    <button
                      key={cab.id}
                      type="button"
                      onClick={() => onSwitchGame(cab.id)}
                      className={`py-1.5 px-2.5 text-left text-xs rounded-md flex items-center justify-between transition-colors whitespace-nowrap cursor-pointer ${
                        cab.id === 'pacmania'
                          ? 'bg-pink-500 text-white font-semibold'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
                      }`}
                    >
                      <span>{cab.title}</span>
                      <span className="font-mono text-[10px] opacity-75">{cab.year}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-4 pb-5 border-b border-white/[0.07]">
              <div>
                <h2 className="text-xs font-medium text-slate-400 mb-2">Lives Remaining</h2>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-h-[26px]">
                    {Array.from({ length: Math.max(0, hud.lives) }).map((_, i) => (
                      <PacManiaEmblem key={i} size={24} />
                    ))}
                  </div>
                  <span className="font-mono tabular-nums text-sm font-semibold text-slate-200">
                    {hud.lives}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-baseline justify-between text-xs mb-2">
                  <span className="text-slate-400 font-medium">World Cleared</span>
                  <span className="font-mono tabular-nums text-slate-200 font-medium">
                    {hud.totalPellets - hud.pelletsLeft} / {hud.totalPellets}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/[0.07] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-150"
                    style={{
                      width: `${Math.round(clearedRatio * 100)}%`,
                      backgroundColor: hud.worldAccent,
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="text-slate-400">Ghost Vaults</span>
                <span className="font-mono tabular-nums font-semibold text-sky-300">
                  {hud.jumpsClearedTotal}
                </span>
              </div>

              {hud.speedBoostRemaining > 0 && (
                <div className="text-xs flex items-center justify-between text-green-400 font-semibold">
                  <span>Green Speed Boost</span>
                  <span className="font-mono tabular-nums">{hud.speedBoostRemaining.toFixed(1)}s</span>
                </div>
              )}

              {hud.doubleScoreRemaining > 0 && (
                <div className="text-xs flex items-center justify-between text-rose-400 font-semibold">
                  <span>Red 2× Score Bonus</span>
                  <span className="font-mono tabular-nums">{hud.doubleScoreRemaining.toFixed(1)}s</span>
                </div>
              )}

              {hud.frightenedRemaining > 0 && (
                <div>
                  <div className="flex items-baseline justify-between text-xs mb-1.5">
                    <span className="text-sky-300 font-semibold">Power Mode</span>
                    <span className="font-mono tabular-nums text-sky-200 font-semibold">
                      {hud.frightenedRemaining.toFixed(1)}s
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-sky-950 overflow-hidden">
                    <div
                      className="h-full bg-sky-400 rounded-full transition-all duration-75"
                      style={{ width: `${Math.min(100, (hud.frightenedRemaining / 7.6) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </section>

            <section className="space-y-3.5">
              <div>
                <div className="text-xs font-medium text-slate-400 mb-1.5">Display Optics</div>
                <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setVisualStyle('hd')}
                    className={`py-1.5 px-2 text-xs rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      visualStyle === 'hd'
                        ? 'bg-slate-100 text-slate-950 font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Crisp HD
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisualStyle('crt')}
                    className={`py-1.5 px-2 text-xs rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      visualStyle === 'crt'
                        ? 'bg-slate-100 text-slate-950 font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    CRT Glow
                  </button>
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-slate-400 mb-1.5">Cabinet Speed</div>
                <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => handleSpeedChange('arcade')}
                    className={`py-1.5 px-2 text-xs rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      speedMode === 'arcade'
                        ? 'bg-slate-100 text-slate-950 font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Arcade
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSpeedChange('turbo')}
                    className={`py-1.5 px-2 text-xs rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      speedMode === 'turbo'
                        ? 'bg-slate-100 text-slate-950 font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Turbo
                  </button>
                </div>
              </div>
            </section>
          </div>

          {isActiveRun && (
            <button
              type="button"
              onClick={handleStartGame}
              className="w-full py-2 px-4 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-xs font-medium text-slate-300 hover:text-white flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restart Game</span>
            </button>
          )}
        </aside>

        {/* Center Isometric 3D Stage */}
        <section className="relative flex flex-col items-center justify-center flex-1 min-w-0">
          <div className="w-full max-w-[680px] flex lg:hidden items-center justify-between text-xs text-slate-300 mb-2 px-1">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: Math.max(0, hud.lives) }).map((_, i) => (
                <PacManiaEmblem key={i} size={18} />
              ))}
            </div>
            <div className="flex items-center gap-2 font-mono tabular-nums">
              <span>{hud.worldName}</span>
              <span className="text-slate-600">·</span>
              <span className="text-pink-300">Best {hud.highScore.toLocaleString()}</span>
            </div>
          </div>

          <div
            className="relative rounded-2xl p-2 sm:p-2.5 bg-[#0A0E1C] border border-white/[0.09] transition-shadow duration-500"
            style={{
              boxShadow: `0 0 65px -18px ${hud.worldAccent}50, 0 24px 64px -20px rgba(0, 0, 0, 0.85)`,
            }}
          >
            <div
              className="relative overflow-hidden rounded-xl bg-[#0B1228]"
              style={{
                aspectRatio: `${PM_VIEWPORT_WIDTH} / ${PM_VIEWPORT_HEIGHT}`,
                width: 'min(calc(100vw - 32px), 780px)',
                maxHeight: 'calc(100dvh - 116px)',
              }}
            >
              <canvas
                ref={canvasRef}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                className="block w-full h-full touch-none select-none"
                aria-label="Pac-Mania 3D isometric game board"
              />

              <AnimatePresence>
                {hud.phase === 'TITLE_MENU' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.22 }}
                    className="absolute inset-0 bg-[#080C1C]/80 backdrop-blur-[4px] flex flex-col items-center justify-center p-6 sm:p-8 text-center"
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="w-full max-w-md space-y-5"
                    >
                      <div className="flex flex-col items-center space-y-2.5">
                        <PacManiaEmblem size={60} />
                        <h1
                          className="text-4xl sm:text-5xl font-extrabold tracking-tight text-pink-400 text-balance"
                          style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                        >
                          Pac-Mania
                        </h1>
                        <p className="text-sm text-slate-200 max-w-sm leading-relaxed">
                          Explore four isometric 3D worlds and press Space to vault right over ghosts—watch out for jumping Funky and Spunky!
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-left py-3.5 border-y border-white/10 text-xs">
                        {PACMANIA_WORLDS.map((w, idx) => (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => handlePreviewWorld(idx)}
                            className={`flex items-center gap-2 py-1 px-2 rounded-md transition-colors cursor-pointer ${
                              hud.worldIndex === idx
                                ? 'bg-white/12 text-white font-semibold'
                                : 'text-slate-300 hover:bg-white/[0.06]'
                            }`}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-xs shrink-0"
                              style={{ backgroundColor: w.theme.accentHex }}
                            />
                            <span className="truncate">{w.theme.name}</span>
                          </button>
                        ))}
                      </div>

                      <div className="pt-1 space-y-3">
                        <button
                          type="button"
                          onClick={handleStartGame}
                          className="w-full py-3.5 px-6 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-bold text-base flex items-center justify-center gap-2 transition-colors shadow-lg shadow-pink-500/25 cursor-pointer"
                        >
                          <Play className="w-4 h-4 fill-current" />
                          <span>Start Game</span>
                        </button>
                        {onOpenLobby && (
                          <button
                            type="button"
                            onClick={onOpenLobby}
                            className="lg:hidden w-full py-2 px-4 rounded-lg border border-white/10 bg-white/[0.04] text-xs font-medium text-slate-200 cursor-pointer"
                          >
                            All 13 Cabinets
                          </button>
                        )}
                        <p className="text-xs text-slate-300">
                          Arrows / WASD to steer · Press <span className="font-mono text-white">Space</span> to Jump · P to pause
                        </p>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {hud.phase === 'PAUSED' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-[#050711]/78 backdrop-blur-sm flex items-center justify-center p-6"
                  >
                    <div className="w-full max-w-xs rounded-2xl bg-[#0D1224] border border-white/10 p-6 text-center space-y-5 shadow-2xl">
                      <div className="space-y-1">
                        <h2
                          className="text-2xl font-bold text-white"
                          style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                        >
                          Paused
                        </h2>
                        <p className="text-xs text-slate-400">
                          World {hud.level} · {hud.worldName}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2.5">
                        <button
                          type="button"
                          onClick={handleTogglePause}
                          className="w-full py-2.5 px-4 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Play className="w-4 h-4 fill-current" />
                          <span>Resume</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleStartGame}
                          className="w-full py-2.5 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.11] text-slate-100 font-medium text-sm flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>Restart</span>
                        </button>
                        <button
                          type="button"
                          onClick={onOpenLobby ?? handleReturnTitle}
                          className="w-full py-2 px-4 rounded-xl text-slate-400 hover:text-white text-xs font-medium cursor-pointer"
                        >
                          {onOpenLobby ? 'Choose Another Game' : 'Return to Title'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {hud.phase === 'GAME_OVER' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-[#050711]/86 backdrop-blur-sm flex items-center justify-center p-6"
                  >
                    <div className="w-full max-w-sm rounded-2xl bg-[#0D1224] border border-white/10 p-6 sm:p-7 text-center space-y-6 shadow-2xl">
                      <div className="space-y-1.5">
                        <h2
                          className="text-3xl font-extrabold text-rose-400 tracking-tight"
                          style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                        >
                          Game Over
                        </h2>
                        {hud.isNewHighScore && hud.score > 0 && (
                          <p className="text-xs font-semibold text-pink-300">New Personal High Score</p>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-y-4 gap-x-6 py-4 border-y border-white/10 text-left">
                        <div>
                          <div className="text-xs text-slate-400">Final Score</div>
                          <div className="font-mono tabular-nums text-xl font-bold text-white mt-0.5">
                            {hud.score.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">High Score</div>
                          <div className="font-mono tabular-nums text-xl font-bold text-pink-300 mt-0.5">
                            {hud.highScore.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">Ghost Vaults</div>
                          <div className="font-mono tabular-nums text-base font-semibold text-sky-300 mt-0.5">
                            {hud.jumpsClearedTotal}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">Ghosts Eaten</div>
                          <div className="font-mono tabular-nums text-base font-semibold text-amber-300 mt-0.5">
                            {hud.ghostsEatenTotal}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2.5">
                        <button
                          type="button"
                          onClick={handleStartGame}
                          className="w-full py-3 px-6 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>Play Again</span>
                        </button>
                        <button
                          type="button"
                          onClick={onOpenLobby ?? handleReturnTitle}
                          className="w-full py-2 px-4 rounded-xl text-slate-400 hover:text-white text-xs font-medium cursor-pointer"
                        >
                          {onOpenLobby ? 'Choose Another Game' : 'Return to Title'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Mobile Touch D-Pad + Dedicated JUMP Button */}
          <div className="mt-3 flex items-center gap-4 lg:hidden select-none">
            <div className="grid grid-cols-3 gap-2 w-44">
              <div />
              <button
                type="button"
                aria-label="Move Up"
                onPointerDown={() => handleDirectionInput('UP')}
                className="h-12 rounded-xl bg-white/[0.07] active:bg-pink-500 flex items-center justify-center border border-white/10"
              >
                <ArrowUp className="w-5 h-5" />
              </button>
              <div />
              <button
                type="button"
                aria-label="Move Left"
                onPointerDown={() => handleDirectionInput('LEFT')}
                className="h-12 rounded-xl bg-white/[0.07] active:bg-pink-500 flex items-center justify-center border border-white/10"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                aria-label="Move Down"
                onPointerDown={() => handleDirectionInput('DOWN')}
                className="h-12 rounded-xl bg-white/[0.07] active:bg-pink-500 flex items-center justify-center border border-white/10"
              >
                <ArrowDown className="w-5 h-5" />
              </button>
              <button
                type="button"
                aria-label="Move Right"
                onPointerDown={() => handleDirectionInput('RIGHT')}
                className="h-12 rounded-xl bg-white/[0.07] active:bg-pink-500 flex items-center justify-center border border-white/10"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            <button
              type="button"
              onPointerDown={handleJump}
              className="h-16 px-5 rounded-xl bg-pink-500/25 border border-pink-400 text-pink-200 active:bg-pink-500 active:text-white font-bold text-xs flex flex-col items-center justify-center gap-1"
            >
              <ArrowUpFromLine className="w-4 h-4" />
              <span>JUMP</span>
            </button>
          </div>
        </section>

        {/* Right Architectural Rail */}
        <aside className="hidden xl:flex flex-col justify-between w-[272px] shrink-0 py-1">
          <div className="space-y-6">
            <section className="space-y-3 pb-6 border-b border-white/[0.07]">
              <h2 className="text-xs font-medium text-slate-400">7-Ghost 3D Roster</h2>
              <ul className="space-y-2">
                {PM_GHOST_ROSTER.map((g) => (
                  <li key={g.name} className="flex items-baseline justify-between text-xs">
                    <span className="font-semibold" style={{ color: g.color }}>{g.name}</span>
                    <span className="text-slate-400">{g.role}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="space-y-2.5 pb-6 border-b border-white/[0.07]">
              <h2 className="text-xs font-medium text-slate-400">Four 3D Worlds</h2>
              <ul className="space-y-1.5">
                {PACMANIA_WORLDS.map((w, idx) => {
                  const isCurrent = hud.worldIndex === idx;
                  const canPreview = hud.phase === 'TITLE_MENU';
                  return (
                    <li key={w.id}>
                      <button
                        type="button"
                        disabled={!canPreview}
                        onClick={() => handlePreviewWorld(idx)}
                        className={`w-full flex items-center justify-between text-xs py-1.5 px-2 -mx-2 rounded-md transition-colors ${
                          isCurrent ? 'text-white font-semibold bg-white/[0.05]' : 'text-slate-400'
                        } ${canPreview ? 'hover:text-white hover:bg-white/[0.06] cursor-pointer' : 'cursor-default'}`}
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-xs shrink-0"
                            style={{ backgroundColor: w.theme.accentHex }}
                          />
                          <span>{w.theme.name}</span>
                        </span>
                        <span className="font-mono text-[11px]">W{idx + 1}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="space-y-2.5">
              <h2 className="text-xs font-medium text-slate-400">Controls</h2>
              <dl className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <dt className="text-slate-400">Steer</dt>
                  <dd className="font-mono text-slate-200">Arrows / WASD</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-400">Jump Over Ghosts</dt>
                  <dd className="font-mono text-pink-300">Space / J</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-400">Pause</dt>
                  <dd className="font-mono text-slate-200">P / Esc</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-400">Mute Audio</dt>
                  <dd className="font-mono text-slate-200">M</dd>
                </div>
              </dl>
            </section>
          </div>
        </aside>
      </main>
    </div>
  );
}

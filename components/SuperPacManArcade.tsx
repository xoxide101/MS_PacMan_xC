'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  KeyRound,
  LayoutGrid,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { CABINET_LIST, GameId } from '@/lib/game/arcadeTypes';
import { arcadeAudio } from '@/lib/game/audio';
import { SuperPacManEngine } from '@/lib/game/superEngine';
import { SUPER_MAZE, SUPER_THEMES } from '@/lib/game/superMazes';
import { SuperPacManRenderer } from '@/lib/game/superRenderer';
import {
  SUPER_PRIZE_ORDER,
  SUPER_PRIZE_SPECS,
  SuperHudSnapshot,
} from '@/lib/game/superTypes';
import {
  CANVAS_LOGICAL_HEIGHT,
  CANVAS_LOGICAL_WIDTH,
  Direction,
  SpeedMode,
  VisualStyle,
} from '@/lib/game/types';
import { SuperPacManEmblem, SuperPrizeEmblem } from './MiniEmblemCanvas';

const FIXED_STEP = 1 / 60;

interface SuperPacManArcadeProps {
  onSwitchGame?: (game: GameId) => void;
  onOpenLobby?: () => void;
}

export default function SuperPacManArcade({
  onSwitchGame,
  onOpenLobby,
}: SuperPacManArcadeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<SuperPacManEngine | null>(null);
  const rendererRef = useRef<SuperPacManRenderer | null>(null);
  const visualStyleRef = useRef<VisualStyle>('hd');
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const [visualStyle, setVisualStyle] = useState<VisualStyle>('hd');
  const [speedMode, setSpeedMode] = useState<SpeedMode>('arcade');
  const [muted, setMuted] = useState(false);

  const [hud, setHud] = useState<SuperHudSnapshot>({
    phase: 'TITLE_MENU',
    score: 0,
    highScore: 0,
    isNewHighScore: false,
    lives: 3,
    level: 1,
    themeName: SUPER_THEMES[0].name,
    themeAccent: SUPER_THEMES[0].accentHex,
    treasuresLeft: SUPER_MAZE.totalTreasures,
    totalTreasures: SUPER_MAZE.totalTreasures,
    keysLeft: SUPER_MAZE.totalKeys,
    doorsLocked: SUPER_MAZE.totalDoors,
    ghostsEatenTotal: 0,
    doorsSmashedTotal: 0,
    currentPrize: 'apple',
    prizesCleared: [],
    superRemaining: 0,
    isSuperBoosting: false,
    frightenedRemaining: 0,
    bonusStarActive: false,
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

  const handleDirectionInput = useCallback((dir: Direction) => {
    arcadeAudio.unlock();
    engineRef.current?.setDesiredDirection(dir);
  }, []);

  const handleBoostHold = useCallback((held: boolean) => {
    engineRef.current?.setSuperBoost(held);
  }, []);

  useEffect(() => {
    const engine = new SuperPacManEngine();
    const renderer = new SuperPacManRenderer();
    engineRef.current = engine;
    rendererRef.current = renderer;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let dpr = Math.min(window.devicePixelRatio || 1, 3);
    const updateCanvasResolution = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = Math.round(CANVAS_LOGICAL_WIDTH * dpr);
      canvas.height = Math.round(CANVAS_LOGICAL_HEIGHT * dpr);
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
    let lastTreasures = engine.treasuresLeft;

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
        engine.treasuresLeft !== lastTreasures;

      if (changed || hudSyncTimer >= 0.1) {
        lastPhase = engine.phase;
        lastScore = engine.score;
        lastLives = engine.lives;
        lastTreasures = engine.treasuresLeft;
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
      } else if (key === ' ' || key === 'Shift') {
        if (engine.phase === 'TITLE_MENU' || engine.phase === 'GAME_OVER') {
          if (key === ' ') {
            engine.startNewGame();
            syncHudNow();
          }
        } else {
          // Hold Space / Shift for Giant Super Speed Dash!
          engine.setSuperBoost(true);
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

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Shift') {
        engineRef.current?.setSuperBoost(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
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
    hud.totalTreasures > 0 ? (hud.totalTreasures - hud.treasuresLeft) / hud.totalTreasures : 0;
  const isActiveRun =
    hud.phase === 'PLAYING' ||
    hud.phase === 'READY' ||
    hud.phase === 'PAUSED' ||
    hud.phase === 'GHOST_EATEN_PAUSE' ||
    hud.phase === 'DYING' ||
    hud.phase === 'STAGE_CLEAR';

  return (
    <div className="min-h-[100dvh] w-full bg-[#060811] text-slate-100 flex flex-col justify-between selection:bg-green-400/25">
      <header className="w-full border-b border-white/[0.07] bg-[#080B16]/90 backdrop-blur-md">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 h-14 flex items-center justify-between gap-6">
          <button
            type="button"
            onClick={onOpenLobby ?? handleReturnTitle}
            title="Back to Cabinet Selection"
            className="flex items-center gap-2.5 text-left rounded-md whitespace-nowrap shrink-0 cursor-pointer"
          >
            <SuperPacManEmblem size={26} />
            <span
              className="text-lg font-bold tracking-tight text-green-400"
              style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
            >
              Super Pac-Man
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
              <span className="font-mono tabular-nums font-semibold text-green-300 text-base">
                {hud.highScore.toLocaleString()}
              </span>
            </div>
            <span className="text-white/15 hidden md:inline" aria-hidden="true">/</span>
            <div className="hidden md:flex items-baseline gap-2">
              <span className="text-slate-400 font-medium">Stage</span>
              <span className="font-mono tabular-nums font-semibold text-slate-100 text-base">
                {hud.level}
              </span>
              <span className="text-slate-500 text-xs">·</span>
              <span className="text-slate-300 font-medium">{hud.themeName}</span>
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
                className="h-9 px-4 rounded-lg bg-green-500 hover:bg-green-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
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
                        cab.id === 'super'
                          ? 'bg-green-500 text-slate-950 font-semibold'
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
                      <SuperPacManEmblem key={i} size={24} />
                    ))}
                  </div>
                  <span className="font-mono tabular-nums text-sm font-semibold text-slate-200">
                    {hud.lives}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-baseline justify-between text-xs mb-2">
                  <span className="text-slate-400 font-medium">Vault Prizes</span>
                  <span className="font-mono tabular-nums text-slate-200 font-medium">
                    {hud.totalTreasures - hud.treasuresLeft} / {hud.totalTreasures}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/[0.07] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-150"
                    style={{
                      width: `${Math.round(clearedRatio * 100)}%`,
                      backgroundColor: hud.themeAccent,
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-300 pt-1">
                <span className="flex items-center gap-1.5 text-amber-300 font-medium">
                  <KeyRound className="w-3.5 h-3.5" />
                  Keys Left
                </span>
                <span className="font-mono tabular-nums font-semibold">{hud.keysLeft}</span>
              </div>

              {/* Giant Super Mode Gauge */}
              {hud.superRemaining > 0 && (
                <div className="pt-1">
                  <div className="flex items-baseline justify-between text-xs mb-1.5">
                    <span className="text-green-400 font-bold flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      {hud.isSuperBoosting ? 'SUPER TURBO!' : 'GIANT SUPER'}
                    </span>
                    <span className="font-mono tabular-nums text-green-300 font-semibold">
                      {hud.superRemaining.toFixed(1)}s
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-green-950 overflow-hidden">
                    <div
                      className="h-full bg-green-400 rounded-full transition-all duration-75"
                      style={{ width: `${Math.min(100, (hud.superRemaining / 11) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {hud.frightenedRemaining > 0 && (
                <div className="pt-1">
                  <div className="flex items-baseline justify-between text-xs mb-1.5">
                    <span className="text-sky-300 font-semibold">Power Mode</span>
                    <span className="font-mono tabular-nums text-sky-200 font-semibold">
                      {hud.frightenedRemaining.toFixed(1)}s
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-sky-950 overflow-hidden">
                    <div
                      className="h-full bg-sky-400 rounded-full transition-all duration-75"
                      style={{ width: `${Math.min(100, (hud.frightenedRemaining / 7.2) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </section>

            <section className="space-y-3 pb-5 border-b border-white/[0.07]">
              <h2 className="text-xs font-medium text-slate-400">Stage Vault Treasure</h2>
              <div className="flex items-center gap-3">
                <SuperPrizeEmblem type={hud.currentPrize} size={32} />
                <div>
                  <div className="text-sm font-semibold text-slate-100">
                    {SUPER_PRIZE_SPECS[hud.currentPrize].label}
                  </div>
                  <div className="text-xs font-mono tabular-nums text-green-300">
                    {SUPER_PRIZE_SPECS[hud.currentPrize].points} pts · 2× while Super
                  </div>
                </div>
              </div>
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

        {/* Center Stage */}
        <section className="relative flex flex-col items-center justify-center flex-1 min-w-0">
          <div className="w-full max-w-[520px] flex lg:hidden items-center justify-between text-xs text-slate-300 mb-2 px-1">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: Math.max(0, hud.lives) }).map((_, i) => (
                <SuperPacManEmblem key={i} size={18} />
              ))}
            </div>
            <div className="flex items-center gap-2 font-mono tabular-nums">
              <span>Keys {hud.keysLeft}</span>
              <span className="text-slate-600">·</span>
              <span className="text-green-300">Best {hud.highScore.toLocaleString()}</span>
            </div>
            <SuperPrizeEmblem type={hud.currentPrize} size={20} />
          </div>

          <div
            className="relative rounded-2xl p-2 sm:p-2.5 bg-[#0A0E1C] border border-white/[0.09] transition-shadow duration-500"
            style={{
              boxShadow: `0 0 60px -18px ${hud.themeAccent}45, 0 24px 64px -20px rgba(0, 0, 0, 0.85)`,
            }}
          >
            <div
              className="relative overflow-hidden rounded-xl bg-[#040B08]"
              style={{
                aspectRatio: `${CANVAS_LOGICAL_WIDTH} / ${CANVAS_LOGICAL_HEIGHT}`,
                height: 'min(calc(100dvh - 104px), 860px)',
                maxWidth: 'calc(100vw - 32px)',
              }}
            >
              <canvas
                ref={canvasRef}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                className="block w-full h-full touch-none select-none"
                aria-label="Super Pac-Man high-resolution game board"
              />

              <AnimatePresence>
                {hud.phase === 'TITLE_MENU' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.22 }}
                    className="absolute inset-0 bg-[#050A08]/84 backdrop-blur-[4px] flex flex-col items-center justify-center p-6 sm:p-8 text-center"
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="w-full max-w-md space-y-5"
                    >
                      <div className="flex flex-col items-center space-y-2.5">
                        <SuperPacManEmblem size={60} />
                        <h1
                          className="text-4xl sm:text-5xl font-extrabold tracking-tight text-green-400 text-balance"
                          style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                        >
                          Super Pac-Man
                        </h1>
                        <p className="text-sm text-slate-300 max-w-sm leading-relaxed">
                          Grab golden keys to unlock treasure vaults, or eat a Green Super Pellet to grow giant, smash locked gates, and turbo dash!
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-2 text-left text-xs py-3.5 border-y border-white/10 text-slate-300">
                        <div className="flex justify-between gap-2">
                          <span className="text-amber-300 font-semibold">Golden Keys</span>
                          <span className="text-slate-400">Unlock linked vault chambers</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-green-400 font-semibold">Green Super Pellets</span>
                          <span className="text-slate-400">Giant size · Invincible · Smash doors</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-sky-300 font-semibold">Hold Space / Shift</span>
                          <span className="text-slate-400">Super Speed Dash while giant</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-1 px-1">
                        {SUPER_PRIZE_ORDER.slice(0, 7).map((pt) => (
                          <SuperPrizeEmblem key={pt} type={pt} size={24} />
                        ))}
                      </div>

                      <div className="pt-1 space-y-3">
                        <button
                          type="button"
                          onClick={handleStartGame}
                          className="w-full py-3.5 px-6 rounded-xl bg-green-500 hover:bg-green-400 text-slate-950 font-bold text-base flex items-center justify-center gap-2 transition-colors shadow-lg shadow-green-500/25 cursor-pointer"
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
                            All 37 Cabinets
                          </button>
                        )}
                        <p className="text-xs text-slate-400">
                          Arrows / WASD to steer · Hold Space for Super Dash · P to pause
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
                          Stage {hud.level} · {hud.themeName}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2.5">
                        <button
                          type="button"
                          onClick={handleTogglePause}
                          className="w-full py-2.5 px-4 rounded-xl bg-green-500 hover:bg-green-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
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
                          <p className="text-xs font-semibold text-green-300">New Personal High Score</p>
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
                          <div className="font-mono tabular-nums text-xl font-bold text-green-300 mt-0.5">
                            {hud.highScore.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">Doors Smashed</div>
                          <div className="font-mono tabular-nums text-base font-semibold text-amber-300 mt-0.5">
                            {hud.doorsSmashedTotal}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">Ghosts Eaten</div>
                          <div className="font-mono tabular-nums text-base font-semibold text-sky-300 mt-0.5">
                            {hud.ghostsEatenTotal}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2.5">
                        <button
                          type="button"
                          onClick={handleStartGame}
                          className="w-full py-3 px-6 rounded-xl bg-green-500 hover:bg-green-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
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

          {/* Mobile Touch Controls + Super Dash */}
          <div className="mt-3 flex items-center gap-4 lg:hidden select-none">
            <div className="grid grid-cols-3 gap-2 w-44">
              <div />
              <button
                type="button"
                aria-label="Move Up"
                onPointerDown={() => handleDirectionInput('UP')}
                className="h-12 rounded-xl bg-white/[0.07] active:bg-green-500 active:text-slate-950 flex items-center justify-center border border-white/10"
              >
                <ArrowUp className="w-5 h-5" />
              </button>
              <div />
              <button
                type="button"
                aria-label="Move Left"
                onPointerDown={() => handleDirectionInput('LEFT')}
                className="h-12 rounded-xl bg-white/[0.07] active:bg-green-500 active:text-slate-950 flex items-center justify-center border border-white/10"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                aria-label="Move Down"
                onPointerDown={() => handleDirectionInput('DOWN')}
                className="h-12 rounded-xl bg-white/[0.07] active:bg-green-500 active:text-slate-950 flex items-center justify-center border border-white/10"
              >
                <ArrowDown className="w-5 h-5" />
              </button>
              <button
                type="button"
                aria-label="Move Right"
                onPointerDown={() => handleDirectionInput('RIGHT')}
                className="h-12 rounded-xl bg-white/[0.07] active:bg-green-500 active:text-slate-950 flex items-center justify-center border border-white/10"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            <button
              type="button"
              onPointerDown={() => handleBoostHold(true)}
              onPointerUp={() => handleBoostHold(false)}
              onPointerLeave={() => handleBoostHold(false)}
              className={`h-16 px-4 rounded-xl border font-bold text-xs flex flex-col items-center justify-center gap-1 transition-colors ${
                hud.superRemaining > 0
                  ? 'bg-green-500/25 border-green-400 text-green-300 active:bg-green-400 active:text-slate-950'
                  : 'bg-white/[0.04] border-white/10 text-slate-500'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>DASH</span>
            </button>
          </div>
        </section>

        {/* Right Architectural Rail */}
        <aside className="hidden xl:flex flex-col justify-between w-[272px] shrink-0 py-1">
          <div className="space-y-6">
            <section className="space-y-3 pb-6 border-b border-white/[0.07]">
              <h2 className="text-xs font-medium text-slate-400">Super Powers</h2>
              <ul className="space-y-3 text-xs">
                <li className="space-y-0.5">
                  <div className="font-semibold text-amber-300">Golden Keys</div>
                  <p className="text-slate-400 leading-relaxed">
                    Unlock sealed vault gates to collect the fruit prizes inside.
                  </p>
                </li>
                <li className="space-y-0.5">
                  <div className="font-semibold text-green-400">Giant Super Mode</div>
                  <p className="text-slate-400 leading-relaxed">
                    Eat either Green Super Pellet to grow giant, glide safely past normal ghosts, and smash locked doors straight open.
                  </p>
                </li>
                <li className="space-y-0.5">
                  <div className="font-semibold text-sky-300">Super Speed Dash</div>
                  <p className="text-slate-400 leading-relaxed">
                    Hold <span className="font-mono text-slate-200">Space</span> or{' '}
                    <span className="font-mono text-slate-200">Shift</span> while Giant for turbo velocity and 2× treasure scoring.
                  </p>
                </li>
              </ul>
            </section>

            <section className="space-y-2.5 pb-6 border-b border-white/[0.07]">
              <h2 className="text-xs font-medium text-slate-400">Vault Stats</h2>
              <dl className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <dt className="text-slate-400">Doors Locked</dt>
                  <dd className="font-mono tabular-nums text-sky-300 font-semibold">{hud.doorsLocked}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-400">Doors Smashed</dt>
                  <dd className="font-mono tabular-nums text-green-300 font-semibold">{hud.doorsSmashedTotal}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-400">Ghosts Eaten</dt>
                  <dd className="font-mono tabular-nums text-slate-200 font-semibold">{hud.ghostsEatenTotal}</dd>
                </div>
              </dl>
            </section>

            <section className="space-y-2.5">
              <h2 className="text-xs font-medium text-slate-400">Controls</h2>
              <dl className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <dt className="text-slate-400">Steer</dt>
                  <dd className="font-mono text-slate-200">Arrows / WASD</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-400">Super Dash</dt>
                  <dd className="font-mono text-green-300">Hold Space / Shift</dd>
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

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  LayoutGrid,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { CABINET_LIST, GameId } from '@/lib/game/arcadeTypes';
import { arcadeAudio } from '@/lib/game/audio';
import { JrPacManEngine } from '@/lib/game/jrEngine';
import { JR_MAZES } from '@/lib/game/jrMazes';
import { JrPacManRenderer } from '@/lib/game/jrRenderer';
import {
  Direction,
  JR_LEVEL_PRIZE_ORDER,
  JR_PRIZE_SPECS,
  JR_VIEWPORT_HEIGHT,
  JR_VIEWPORT_WIDTH,
  JrHudSnapshot,
  SpeedMode,
  VisualStyle,
} from '@/lib/game/jrTypes';
import { JrPacManEmblem, JrPrizeEmblem } from './MiniEmblemCanvas';

const FIXED_STEP = 1 / 60;
const MINIMAP_W = 248;
const MINIMAP_H = 112;

const JR_GHOST_ROSTER = [
  { name: 'Blinky', role: 'Shadow', trait: 'Relentless direct pursuer', color: '#FF2A42' },
  { name: 'Pinky', role: 'Speedy', trait: 'Ambushes four tiles ahead', color: '#FF80C8' },
  { name: 'Inky', role: 'Bashful', trait: 'Flanks via Blinky vector', color: '#1CE4FF' },
  { name: 'Tim', role: 'Pokey', trait: 'Chases far, peels away close', color: '#FF9B26' },
];

interface JrPacManArcadeProps {
  onSwitchGame?: (game: GameId) => void;
  onOpenLobby?: () => void;
}

export default function JrPacManArcade({ onSwitchGame, onOpenLobby }: JrPacManArcadeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const minimapRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<JrPacManEngine | null>(null);
  const rendererRef = useRef<JrPacManRenderer | null>(null);
  const visualStyleRef = useRef<VisualStyle>('hd');
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const [visualStyle, setVisualStyle] = useState<VisualStyle>('hd');
  const [speedMode, setSpeedMode] = useState<SpeedMode>('arcade');
  const [muted, setMuted] = useState(false);

  const [hud, setHud] = useState<JrHudSnapshot>({
    phase: 'TITLE_MENU',
    score: 0,
    highScore: 0,
    isNewHighScore: false,
    lives: 3,
    level: 1,
    mazeIndex: 0,
    mazeName: JR_MAZES[0].theme.name,
    mazeAccent: JR_MAZES[0].theme.accentHex,
    pelletsLeft: JR_MAZES[0].totalPellets,
    totalPellets: JR_MAZES[0].totalPellets,
    mutatedDotsCount: 0,
    energizersLeft: JR_MAZES[0].totalEnergizers,
    energizersDestroyed: 0,
    ghostsEatenTotal: 0,
    prizesCollected: [],
    currentPrize: 'tricycle',
    prizeActive: false,
    frightenedRemaining: 0,
    extraLifeAwarded: false,
  });

  useEffect(() => {
    visualStyleRef.current = visualStyle;
  }, [visualStyle]);

  const syncHudNow = useCallback(() => {
    if (engineRef.current) {
      setHud(engineRef.current.getHudSnapshot());
    }
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

  const handlePreviewMaze = useCallback((idx: number) => {
    const engine = engineRef.current;
    if (!engine || engine.phase !== 'TITLE_MENU') return;
    engine.previewMaze(idx);
    setHud(engine.getHudSnapshot());
  }, []);

  const handleDirectionInput = useCallback((dir: Direction) => {
    arcadeAudio.unlock();
    engineRef.current?.setDesiredDirection(dir);
  }, []);

  // Main 60fps fixed-timestep scrolling simulation + HiDPI render loop + Live Minimap
  useEffect(() => {
    const engine = new JrPacManEngine();
    const renderer = new JrPacManRenderer();
    engineRef.current = engine;
    rendererRef.current = renderer;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const minimapCanvas = minimapRef.current;
    const minimapCtx = minimapCanvas?.getContext('2d', { alpha: false }) ?? null;

    let dpr = Math.min(window.devicePixelRatio || 1, 3);
    const updateCanvasResolution = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = Math.round(JR_VIEWPORT_WIDTH * dpr);
      canvas.height = Math.round(JR_VIEWPORT_HEIGHT * dpr);
      if (minimapCanvas) {
        minimapCanvas.width = Math.round(MINIMAP_W * Math.min(dpr, 2));
        minimapCanvas.height = Math.round(MINIMAP_H * Math.min(dpr, 2));
      }
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

      if (minimapCtx) {
        renderer.renderMinimap(minimapCtx, engine, MINIMAP_W, MINIMAP_H, Math.min(dpr, 2));
      }

      hudSyncTimer += frameDelta;
      const stateChanged =
        engine.phase !== lastPhase ||
        engine.score !== lastScore ||
        engine.lives !== lastLives ||
        engine.pelletsLeft !== lastPellets;

      if (stateChanged || hudSyncTimer >= 0.12) {
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

  // Keyboard controls
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
      } else if (key === 'Enter' || key === ' ') {
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
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!touchStartRef.current || e.touches.length === 0) return;
    const dx = e.touches[0].clientX - touchStartRef.current.x;
    const dy = e.touches[0].clientY - touchStartRef.current.y;
    const threshold = 22;
    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;

    if (Math.abs(dx) > Math.abs(dy)) {
      handleDirectionInput(dx > 0 ? 'RIGHT' : 'LEFT');
    } else {
      handleDirectionInput(dy > 0 ? 'DOWN' : 'UP');
    }
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
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
    <div className="min-h-[100dvh] w-full bg-[#060811] text-slate-100 flex flex-col justify-between selection:bg-emerald-400/25">
      {/* Clean Single-Row Arcade Header */}
      <header className="w-full border-b border-white/[0.07] bg-[#080B16]/90 backdrop-blur-md">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 h-14 flex items-center justify-between gap-6">
          {/* Zone 1: Brand Wordmark (returns to Game Selection Lobby) */}
          <button
            type="button"
            onClick={onOpenLobby ?? handleReturnTitle}
            title={onOpenLobby ? 'Back to Cabinet Selection' : 'Return to Title'}
            className="flex items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
          >
            <JrPacManEmblem size={25} />
            <span
              className="text-lg font-bold tracking-tight text-emerald-300"
              style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
            >
              Jr. Pac-Man
            </span>
          </button>

          {/* Zone 2: Unboxed Tabular Score & Stage Readout */}
          <div className="flex items-center gap-4 sm:gap-7 text-xs sm:text-sm whitespace-nowrap shrink-0">
            <div className="flex items-baseline gap-2">
              <span className="text-slate-400 font-medium">Score</span>
              <span className="font-mono tabular-nums font-semibold text-white text-sm sm:text-base">
                {hud.score.toLocaleString()}
              </span>
            </div>
            <span className="text-white/15 hidden sm:inline" aria-hidden="true">
              /
            </span>
            <div className="hidden sm:flex items-baseline gap-2">
              <span className="text-slate-400 font-medium">High Score</span>
              <span className="font-mono tabular-nums font-semibold text-amber-300 text-base">
                {hud.highScore.toLocaleString()}
              </span>
            </div>
            <span className="text-white/15 hidden md:inline" aria-hidden="true">
              /
            </span>
            <div className="hidden md:flex items-baseline gap-2">
              <span className="text-slate-400 font-medium">Stage</span>
              <span className="font-mono tabular-nums font-semibold text-slate-100 text-base">
                {hud.level}
              </span>
              <span className="text-slate-500 text-xs">·</span>
              <span className="text-slate-300 font-medium">{hud.mazeName}</span>
            </div>
          </div>

          {/* Zone 3: Sound & Primary Action */}
          <div className="flex items-center gap-2.5 shrink-0">
            {onOpenLobby && (
              <button
                type="button"
                onClick={onOpenLobby}
                className="hidden sm:flex h-9 px-3 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-slate-300 hover:text-white text-xs font-medium items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Cabinets</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleToggleMute}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              title={muted ? 'Unmute (M)' : 'Mute (M)'}
              className="h-9 w-9 flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-300 hover:text-white hover:bg-white/[0.08] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {isActiveRun ? (
              <button
                type="button"
                onClick={handleTogglePause}
                className="h-9 px-3.5 rounded-lg border border-white/10 bg-white/[0.06] hover:bg-white/[0.12] text-slate-100 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer"
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
                className="h-9 px-4 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start Game</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Arcade Arena */}
      <main className="flex-1 w-full mx-auto max-w-[1440px] px-3 sm:px-6 py-3 sm:py-4 flex flex-col lg:flex-row items-center lg:items-stretch justify-center gap-5 xl:gap-8">
        {/* Left Architectural Rail (Desktop) */}
        <aside className="hidden lg:flex flex-col justify-between w-[252px] xl:w-[276px] shrink-0 py-1">
          <div className="space-y-5">
            {/* Cabinet Switcher */}
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
                        cab.id === 'jr'
                          ? 'bg-emerald-400 text-slate-950 font-semibold'
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

            {/* Live Full-Maze 56x31 Tactical Minimap */}
            <section className="space-y-2.5 pb-5 border-b border-white/[0.07]">
              <div className="flex items-baseline justify-between text-xs">
                <h2 className="font-medium text-slate-400">Wide Maze Radar</h2>
                <span className="font-mono tabular-nums text-[11px] text-slate-500">
                  2× Width
                </span>
              </div>
              <div className="rounded-lg overflow-hidden border border-white/10 bg-[#050711] p-1">
                <canvas
                  ref={minimapRef}
                  style={{ width: '100%', height: 'auto', aspectRatio: `${MINIMAP_W} / ${MINIMAP_H}` }}
                  className="block rounded-sm"
                  aria-label="Full 56-column wide maze tactical radar"
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  Energizers:{' '}
                  <strong className="font-mono tabular-nums text-white">
                    {hud.energizersLeft}
                  </strong>
                </span>
                <span>
                  Big Dots:{' '}
                  <strong className="font-mono tabular-nums text-amber-300">
                    {hud.mutatedDotsCount}
                  </strong>
                </span>
              </div>
            </section>

            {/* Lives & Stage Progress */}
            <section className="space-y-3.5 pb-5 border-b border-white/[0.07]">
              <div>
                <h2 className="text-xs font-medium text-slate-400 mb-2">Lives Remaining</h2>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-h-[28px]">
                    {Array.from({ length: Math.max(0, hud.lives) }).map((_, i) => (
                      <JrPacManEmblem key={i} size={26} />
                    ))}
                    {hud.lives === 0 && (
                      <span className="text-xs text-slate-500">None left</span>
                    )}
                  </div>
                  <span className="font-mono tabular-nums text-sm font-semibold text-slate-200">
                    {hud.lives}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-baseline justify-between text-xs mb-1.5">
                  <span className="text-slate-400 font-medium">Maze Cleared</span>
                  <span className="font-mono tabular-nums text-slate-200 font-medium">
                    {hud.totalPellets - hud.pelletsLeft} / {hud.totalPellets}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/[0.07] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-150"
                    style={{
                      width: `${Math.round(clearedRatio * 100)}%`,
                      backgroundColor: hud.mazeAccent,
                    }}
                  />
                </div>
              </div>

              {hud.frightenedRemaining > 0 && (
                <div className="pt-1">
                  <div className="flex items-baseline justify-between text-xs mb-1.5">
                    <span className="text-sky-300 font-semibold">Power Mode Active</span>
                    <span className="font-mono tabular-nums text-sky-200 font-semibold">
                      {hud.frightenedRemaining.toFixed(1)}s
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-sky-950 overflow-hidden">
                    <div
                      className="h-full bg-sky-400 rounded-full transition-all duration-75"
                      style={{
                        width: `${Math.min(100, (hud.frightenedRemaining / 7.2) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </section>

            {/* Display & Speed Preferences */}
            <section className="space-y-3.5">
              <div>
                <div className="text-xs font-medium text-slate-400 mb-1.5">Display Optics</div>
                <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setVisualStyle('hd')}
                    className={`py-1.5 px-2.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
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
                    className={`py-1.5 px-2.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
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
                    className={`py-1.5 px-2.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
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
                    className={`py-1.5 px-2.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
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
              className="mt-4 w-full py-2 px-4 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-xs font-medium text-slate-300 hover:text-white flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restart Game</span>
            </button>
          )}
        </aside>

        {/* Center Focal Anchor: High-Resolution 60fps Scrolling Viewport */}
        <section className="relative flex flex-col items-center justify-center flex-1 min-w-0">
          {/* Mobile Compact Status Row */}
          <div className="w-full max-w-[520px] flex lg:hidden items-center justify-between text-xs text-slate-300 mb-2 px-1">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: Math.max(0, hud.lives) }).map((_, i) => (
                <JrPacManEmblem key={i} size={18} />
              ))}
            </div>
            <div className="flex items-center gap-2 font-mono tabular-nums">
              <span>Stage {hud.level}</span>
              <span className="text-slate-600">·</span>
              <span className="text-amber-300">Best {hud.highScore.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <JrPrizeEmblem type={hud.currentPrize} size={20} />
            </div>
          </div>

          {/* Bezeled HiDPI Scrolling Canvas Frame */}
          <div
            className="relative rounded-2xl p-2 sm:p-2.5 bg-[#0A0E1C] border border-white/[0.09] transition-shadow duration-500"
            style={{
              boxShadow: `0 0 60px -18px ${hud.mazeAccent}45, 0 24px 64px -20px rgba(0, 0, 0, 0.85)`,
            }}
          >
            <div
              className="relative overflow-hidden rounded-xl bg-[#04060D]"
              style={{
                aspectRatio: `${JR_VIEWPORT_WIDTH} / ${JR_VIEWPORT_HEIGHT}`,
                height: 'min(calc(100dvh - 104px), 860px)',
                maxWidth: 'calc(100vw - 32px)',
              }}
            >
              <canvas
                ref={canvasRef}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                className="block w-full h-full touch-none select-none"
                aria-label="Jr. Pac-Man high-resolution scrolling game board"
              />

              {/* Title Menu Overlay */}
              <AnimatePresence>
                {hud.phase === 'TITLE_MENU' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.22 }}
                    className="absolute inset-0 bg-[#050711]/84 backdrop-blur-[4px] flex flex-col items-center justify-center p-6 sm:p-8 text-center"
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      className="w-full max-w-md space-y-5"
                    >
                      <div className="flex flex-col items-center space-y-2.5">
                        <JrPacManEmblem size={62} />
                        <h1
                          className="text-4xl sm:text-5xl font-extrabold tracking-tight text-emerald-300 text-balance"
                          style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                        >
                          Jr. Pac-Man
                        </h1>
                        <p className="text-sm text-slate-300 max-w-sm leading-relaxed">
                          Double-wide scrolling mazes at 60fps. Catch roaming toys before they detonate your power energizers—and feast on their 50-point super dots.
                        </p>
                      </div>

                      {/* Ghost Cast Row (Blinky, Pinky, Inky, Tim) */}
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-left py-3.5 border-y border-white/10">
                        {JR_GHOST_ROSTER.map((g) => (
                          <div key={g.name} className="flex items-baseline justify-between gap-2 text-xs">
                            <span className="font-semibold" style={{ color: g.color }}>
                              {g.name}
                            </span>
                            <span className="text-slate-400 truncate">{g.role}</span>
                          </div>
                        ))}
                      </div>

                      {/* All 7 Jr. Pac-Man Toys Strip */}
                      <div className="flex items-center justify-between gap-1 px-1">
                        {JR_LEVEL_PRIZE_ORDER.map((pt) => (
                          <div key={pt} className="flex flex-col items-center gap-1">
                            <JrPrizeEmblem type={pt} size={24} />
                            <span className="text-[11px] font-mono tabular-nums text-slate-300">
                              {JR_PRIZE_SPECS[pt].points}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Primary CTA */}
                      <div className="pt-1 space-y-3">
                        <button
                          type="button"
                          onClick={handleStartGame}
                          className="w-full py-3.5 px-6 rounded-xl bg-emerald-400 hover:bg-emerald-300 active:scale-[0.99] text-slate-950 font-bold text-base flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 cursor-pointer"
                        >
                          <Play className="w-4 h-4 fill-current" />
                          <span>Start Game</span>
                        </button>

                        {onOpenLobby && (
                          <button
                            type="button"
                            onClick={onOpenLobby}
                            className="lg:hidden w-full py-2 px-4 rounded-lg border border-white/10 bg-white/[0.04] text-xs font-medium text-slate-200 hover:text-white cursor-pointer"
                          >
                            All 13 Cabinets
                          </button>
                        )}

                        <p className="text-xs text-slate-400">
                          Arrow keys or WASD to steer · Space to pause · Press Enter to start
                        </p>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Pause Overlay */}
              <AnimatePresence>
                {hud.phase === 'PAUSED' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.16 }}
                    className="absolute inset-0 bg-[#050711]/78 backdrop-blur-sm flex items-center justify-center p-6"
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.18 }}
                      className="w-full max-w-xs rounded-2xl bg-[#0D1224] border border-white/10 p-6 text-center space-y-5 shadow-2xl"
                    >
                      <div className="space-y-1">
                        <h2
                          className="text-2xl font-bold text-white"
                          style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                        >
                          Paused
                        </h2>
                        <p className="text-xs text-slate-400">
                          Stage {hud.level} · {hud.mazeName}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 lg:hidden">
                        <button
                          type="button"
                          onClick={() => setVisualStyle((v) => (v === 'hd' ? 'crt' : 'hd'))}
                          className="py-2 px-3 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-xs font-medium text-slate-200 whitespace-nowrap cursor-pointer"
                        >
                          {visualStyle === 'hd' ? 'Optics: Crisp HD' : 'Optics: CRT Glow'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleSpeedChange(speedMode === 'arcade' ? 'turbo' : 'arcade')
                          }
                          className="py-2 px-3 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-xs font-medium text-slate-200 whitespace-nowrap cursor-pointer"
                        >
                          {speedMode === 'arcade' ? 'Speed: Arcade' : 'Speed: Turbo'}
                        </button>
                      </div>

                      <div className="flex flex-col gap-2.5">
                        <button
                          type="button"
                          onClick={handleTogglePause}
                          className="w-full py-2.5 px-4 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                          <Play className="w-4 h-4 fill-current" />
                          <span>Resume</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleStartGame}
                          className="w-full py-2.5 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.11] text-slate-100 font-medium text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>Restart</span>
                        </button>
                        <button
                          type="button"
                          onClick={onOpenLobby ?? handleReturnTitle}
                          className="w-full py-2 px-4 rounded-xl text-slate-400 hover:text-white text-xs font-medium transition-colors cursor-pointer"
                        >
                          {onOpenLobby ? 'Choose Another Game' : 'Return to Title'}
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Game Over Summary Overlay */}
              <AnimatePresence>
                {hud.phase === 'GAME_OVER' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.22 }}
                    className="absolute inset-0 bg-[#050711]/86 backdrop-blur-sm flex items-center justify-center p-6"
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.22 }}
                      className="w-full max-w-sm rounded-2xl bg-[#0D1224] border border-white/10 p-6 sm:p-7 text-center space-y-6 shadow-2xl"
                    >
                      <div className="space-y-1.5">
                        <h2
                          className="text-3xl font-extrabold text-rose-400 tracking-tight"
                          style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                        >
                          Game Over
                        </h2>
                        {hud.isNewHighScore && hud.score > 0 && (
                          <p className="text-xs font-semibold text-amber-300">
                            New Personal High Score
                          </p>
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
                          <div className="font-mono tabular-nums text-xl font-bold text-amber-300 mt-0.5">
                            {hud.highScore.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">Stage Reached</div>
                          <div className="font-mono tabular-nums text-base font-semibold text-slate-100 mt-0.5">
                            Stage {hud.level}
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
                          className="w-full py-3 px-6 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>Play Again</span>
                        </button>
                        <button
                          type="button"
                          onClick={onOpenLobby ?? handleReturnTitle}
                          className="w-full py-2 px-4 rounded-xl text-slate-400 hover:text-white text-xs font-medium transition-colors cursor-pointer"
                        >
                          {onOpenLobby ? 'Choose Another Game' : 'Return to Title'}
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Mobile / Tablet Touch D-Pad */}
          <div className="mt-3 grid grid-cols-3 gap-2 w-48 lg:hidden select-none">
            <div />
            <button
              type="button"
              aria-label="Move Up"
              onPointerDown={() => handleDirectionInput('UP')}
              className="h-12 rounded-xl bg-white/[0.07] active:bg-emerald-400 active:text-slate-950 flex items-center justify-center border border-white/10"
            >
              <ArrowUp className="w-5 h-5" />
            </button>
            <div />
            <button
              type="button"
              aria-label="Move Left"
              onPointerDown={() => handleDirectionInput('LEFT')}
              className="h-12 rounded-xl bg-white/[0.07] active:bg-emerald-400 active:text-slate-950 flex items-center justify-center border border-white/10"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              aria-label="Move Down"
              onPointerDown={() => handleDirectionInput('DOWN')}
              className="h-12 rounded-xl bg-white/[0.07] active:bg-emerald-400 active:text-slate-950 flex items-center justify-center border border-white/10"
            >
              <ArrowDown className="w-5 h-5" />
            </button>
            <button
              type="button"
              aria-label="Move Right"
              onPointerDown={() => handleDirectionInput('RIGHT')}
              className="h-12 rounded-xl bg-white/[0.07] active:bg-emerald-400 active:text-slate-950 flex items-center justify-center border border-white/10"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </section>

        {/* Right Architectural Rail (Desktop XL) */}
        <aside className="hidden xl:flex flex-col justify-between w-[276px] shrink-0 py-1">
          <div className="space-y-5">
            {/* Roaming Toy Bonus & Mutation Guide */}
            <section className="space-y-3 pb-5 border-b border-white/[0.07]">
              <div className="flex items-baseline justify-between">
                <h2 className="text-xs font-medium text-slate-400">Stage Bonus Toy</h2>
                {hud.prizeActive && (
                  <span className="text-[11px] font-semibold text-rose-300">
                    Roaming Now
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <JrPrizeEmblem type={hud.currentPrize} size={34} />
                <div>
                  <div className="text-sm font-semibold text-slate-100">
                    {JR_PRIZE_SPECS[hud.currentPrize].label}
                  </div>
                  <div className="text-xs font-mono tabular-nums text-amber-300">
                    {JR_PRIZE_SPECS[hud.currentPrize].points.toLocaleString()} pts
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Exits the Ghost House, mutates regular dots into 50-point super dots, and detonates any power energizer it touches.
              </p>

              {hud.prizesCollected.length > 0 && (
                <div className="pt-1.5">
                  <div className="text-xs text-slate-500 mb-1.5">Collected This Run</div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {hud.prizesCollected.slice(-8).map((pt, idx) => (
                      <JrPrizeEmblem key={`${pt}-${idx}`} type={pt} size={22} />
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Ghost Cast */}
            <section className="space-y-2.5 pb-5 border-b border-white/[0.07]">
              <h2 className="text-xs font-medium text-slate-400">Ghost Personalities</h2>
              <ul className="space-y-2.5">
                {JR_GHOST_ROSTER.map((g) => (
                  <li key={g.name} className="space-y-0.5">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-semibold" style={{ color: g.color }}>
                        {g.name}
                      </span>
                      <span className="text-xs text-slate-400">{g.role}</span>
                    </div>
                    <p className="text-xs text-slate-500">{g.trait}</p>
                  </li>
                ))}
              </ul>
            </section>

            {/* 4 Wide Scrolling Mazes */}
            <section className="space-y-2.5 pb-5 border-b border-white/[0.07]">
              <h2 className="text-xs font-medium text-slate-400">Wide Maze Rotation</h2>
              <ul className="space-y-1">
                {JR_MAZES.map((m, idx) => {
                  const isCurrent = hud.mazeIndex === idx;
                  const canPreview = hud.phase === 'TITLE_MENU';
                  const stageRange =
                    idx === 0
                      ? 'Stages 1–2'
                      : idx === 1
                        ? 'Stages 3–4'
                        : idx === 2
                          ? 'Stages 5–6'
                          : 'Stages 7+';
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        disabled={!canPreview}
                        onClick={() => handlePreviewMaze(idx)}
                        className={`w-full flex items-baseline justify-between text-xs py-1.5 px-2 -mx-2 rounded-md transition-colors ${
                          isCurrent ? 'text-white font-semibold bg-white/[0.04]' : 'text-slate-400'
                        } ${canPreview ? 'hover:text-white hover:bg-white/[0.06] cursor-pointer' : 'cursor-default'}`}
                      >
                        <span className="flex items-center gap-2.5">
                          <span
                            className="inline-block w-3 h-1.5 rounded-[2px] shrink-0"
                            style={{
                              backgroundColor: m.theme.wallOuter,
                              opacity: isCurrent ? 1 : 0.5,
                            }}
                          />
                          <span>{m.theme.name}</span>
                        </span>
                        <span className="font-mono tabular-nums text-[11px]">{stageRange}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Controls Reference */}
            <section className="space-y-2">
              <h2 className="text-xs font-medium text-slate-400">Controls</h2>
              <dl className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <dt className="text-slate-400">Steer</dt>
                  <dd className="font-mono text-slate-200">Arrows / WASD</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-400">Pause / Resume</dt>
                  <dd className="font-mono text-slate-200">Space / P</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-400">Restart Run</dt>
                  <dd className="font-mono text-slate-200">R</dd>
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

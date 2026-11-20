'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Heart,
  LayoutGrid,
  Monitor,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { CABINET_LIST, ClassicArcadeGameId, GameId } from '@/lib/game/arcadeTypes';
import { arcadeAudio } from '@/lib/game/audio';
import {
  ArcadeGameInstance,
  ArcadeInputState,
  ClassicGameHud,
  createEmptyInput,
} from '@/lib/game/classicArcadeInterface';
import { CLASSIC_CABINET_SPECS, createClassicArcadeGame } from '@/lib/game/classicRegistry';
import { GameEmblem } from './MiniEmblemCanvas';

const FIXED_STEP = 1 / 60;

interface ClassicArcadeShellProps {
  gameId: ClassicArcadeGameId;
  onSwitchGame: (game: GameId) => void;
  onOpenLobby: () => void;
}

export default function ClassicArcadeShell({
  gameId,
  onSwitchGame,
  onOpenLobby,
}: ClassicArcadeShellProps) {
  const spec = CLASSIC_CABINET_SPECS[gameId];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<ArcadeGameInstance | null>(null);
  const inputRef = useRef<ArcadeInputState>(createEmptyInput());
  const visualModeRef = useRef<'hd' | 'crt'>('hd');

  const [visualMode, setVisualMode] = useState<'hd' | 'crt'>('hd');
  const [muted, setMuted] = useState(false);
  const [canvasDims, setCanvasDims] = useState<{ w: number; h: number }>({ w: 720, h: 816 });
  const [actionLabel, setActionLabel] = useState('Fire');
  const [hud, setHud] = useState<ClassicGameHud>({
    phase: 'TITLE',
    score: 0,
    highScore: 0,
    level: 1,
    lives: 3,
    stageName: `${spec.title}`,
    primaryMetricLabel: 'Stage',
    primaryMetricValue: '1',
    secondaryMetricLabel: 'Status',
    secondaryMetricValue: 'Ready',
    bannerText: '',
  });

  useEffect(() => {
    visualModeRef.current = visualMode;
  }, [visualMode]);

  useEffect(() => {
    arcadeAudio.stopAmbient();
    const instance = createClassicArcadeGame(gameId);
    gameRef.current = instance;
    inputRef.current = createEmptyInput();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(instance.logicalWidth * dpr);
    canvas.height = Math.round(instance.logicalHeight * dpr);

    let rafId = 0;
    let lastTime = performance.now();
    let accumulator = 0;
    let hudTimer = 0;

    // Initial HUD & dimension sync inside RAF (avoids sync setState in effect)
    const syncInitial = () => {
      setCanvasDims({ w: instance.logicalWidth, h: instance.logicalHeight });
      setActionLabel(instance.primaryActionLabel);
      setHud(instance.getHudSnapshot());
    };

    let firstFrame = true;
    const tick = (now: number) => {
      if (firstFrame) {
        firstFrame = false;
        syncInitial();
      }
      const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;
      accumulator += dt;

      while (accumulator >= FIXED_STEP) {
        instance.setInput({ ...inputRef.current });
        inputRef.current.fireJustPressed = false;
        instance.step(FIXED_STEP);
        accumulator -= FIXED_STEP;
      }

      instance.render(ctx, dpr, visualModeRef.current);

      hudTimer += dt;
      if (hudTimer >= 0.08) {
        hudTimer = 0;
        setHud(instance.getHudSnapshot());
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
      arcadeAudio.stopAmbient();
    };
  }, [gameId]);

  // Keyboard controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      if (
        code === 'ArrowUp' ||
        code === 'ArrowDown' ||
        code === 'ArrowLeft' ||
        code === 'ArrowRight' ||
        code === 'Space'
      ) {
        e.preventDefault();
      }

      const inst = gameRef.current;
      if (!inst) return;

      if (code === 'KeyP') {
        inst.togglePause();
        setHud(inst.getHudSnapshot());
        return;
      }

      if (code === 'KeyR' && inst.restartStage) {
        inst.restartStage();
        setHud(inst.getHudSnapshot());
        return;
      }

      if (code === 'Enter') {
        const snap = inst.getHudSnapshot();
        if (snap.phase === 'TITLE' || snap.phase === 'GAME_OVER') {
          arcadeAudio.unlock();
          inst.startNewGame();
          setHud(inst.getHudSnapshot());
          return;
        }
      }

      if (code === 'ArrowLeft' || code === 'KeyA') {
        inputRef.current.left = true;
        inputRef.current.pointerActive = false;
      }
      if (code === 'ArrowRight' || code === 'KeyD') {
        inputRef.current.right = true;
        inputRef.current.pointerActive = false;
      }
      if (code === 'ArrowUp' || code === 'KeyW') {
        inputRef.current.up = true;
        inputRef.current.pointerActive = false;
        // Space Invaders 1 & 2 allow Up arrow as convenient fire button too
        if (gameId === 'invaders' || gameId === 'invaders2') {
          if (!inputRef.current.fire) inputRef.current.fireJustPressed = true;
          inputRef.current.fire = true;
        }
      }
      if (code === 'ArrowDown' || code === 'KeyS') {
        inputRef.current.down = true;
        inputRef.current.pointerActive = false;
      }
      if (code === 'Space' || code === 'KeyZ' || code === 'KeyJ') {
        const snap = inst.getHudSnapshot();
        if (snap.phase === 'TITLE' || snap.phase === 'GAME_OVER') {
          arcadeAudio.unlock();
          inst.startNewGame();
          setHud(inst.getHudSnapshot());
          return;
        }
        if (!inputRef.current.fire) {
          inputRef.current.fireJustPressed = true;
        }
        inputRef.current.fire = true;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === 'ArrowLeft' || code === 'KeyA') inputRef.current.left = false;
      if (code === 'ArrowRight' || code === 'KeyD') inputRef.current.right = false;
      if (code === 'ArrowUp' || code === 'KeyW') {
        inputRef.current.up = false;
        if (gameId === 'invaders' || gameId === 'invaders2') {
          inputRef.current.fire = false;
        }
      }
      if (code === 'ArrowDown' || code === 'KeyS') inputRef.current.down = false;
      if (code === 'Space' || code === 'KeyZ' || code === 'KeyJ') inputRef.current.fire = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [gameId]);

  const handleStart = useCallback(() => {
    arcadeAudio.unlock();
    const inst = gameRef.current;
    if (!inst) return;
    inst.startNewGame();
    setHud(inst.getHudSnapshot());
  }, []);

  const handleTogglePause = useCallback(() => {
    const inst = gameRef.current;
    if (!inst) return;
    inst.togglePause();
    setHud(inst.getHudSnapshot());
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      arcadeAudio.setMuted(next);
      return next;
    });
  }, []);

  const handleCanvasPointer = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>, isDown: boolean | null) => {
      const inst = gameRef.current;
      const canvas = canvasRef.current;
      if (!inst || !canvas) return;
      if (inst.supportsPointerAim) {
        const rect = canvas.getBoundingClientRect();
        const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        inputRef.current.pointerActive = true;
        inputRef.current.pointerX = nx;
        inputRef.current.pointerY = ny;
      }
      if (isDown === true) {
        if (!inputRef.current.fire) inputRef.current.fireJustPressed = true;
        inputRef.current.fire = true;
      } else if (isDown === false) {
        inputRef.current.fire = false;
      }
    },
    []
  );

  const setTouchDir = (dir: 'up' | 'down' | 'left' | 'right', active: boolean) => {
    inputRef.current.pointerActive = false;
    inputRef.current[dir] = active;
  };

  const setTouchFire = (active: boolean) => {
    if (active && !inputRef.current.fire) {
      inputRef.current.fireJustPressed = true;
    }
    inputRef.current.fire = active;
  };

  const pacCabinets = CABINET_LIST.filter((c) => c.category === 'pacman');
  const classicCabinets = CABINET_LIST.filter((c) => c.category === 'classic-arcade');
  const isWide = canvasDims.w > canvasDims.h;

  return (
    <div className="min-h-[100dvh] w-full bg-[#060811] text-slate-100 flex flex-col">
      {/* Compact Top Bar */}
      <header className="w-full border-b border-white/[0.07] bg-[#080B16]/90 backdrop-blur-md">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onOpenLobby}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.09] text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>All 13 Cabinets</span>
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <GameEmblem gameId={gameId} size={24} />
              <span
                className={`text-base font-bold tracking-tight truncate ${spec.accentTextClass}`}
                style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
              >
                {spec.title}
              </span>
              <span className="hidden sm:inline text-xs text-slate-500 whitespace-nowrap">
                {spec.year} · {spec.publisher}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setVisualMode((v) => (v === 'hd' ? 'crt' : 'hd'))}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.09] text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Toggle HD Vector or CRT Scanlines"
            >
              {visualMode === 'hd' ? <Sparkles className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{visualMode === 'hd' ? 'Vector HD' : 'CRT Mode'}</span>
            </button>

            <button
              type="button"
              onClick={handleToggleMute}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.09] text-slate-200 transition-colors cursor-pointer"
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            >
              {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {(hud.phase === 'PLAYING' || hud.phase === 'PAUSED') && (
              <button
                type="button"
                onClick={handleTogglePause}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.09] text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {hud.phase === 'PAUSED' ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{hud.phase === 'PAUSED' ? 'Resume' : 'Pause'}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main 3-Column Arcade Workspace */}
      <main className="flex-1 w-full mx-auto max-w-[1440px] px-3 sm:px-6 py-4 sm:py-6 flex flex-col lg:flex-row items-center lg:items-start justify-center gap-5">
        {/* Desktop Left Rail: Full 13-Cabinet Switcher */}
        <aside className="hidden lg:flex flex-col w-[228px] shrink-0 rounded-2xl bg-[#0B0F1D] border border-white/[0.08] p-3 max-h-[calc(100dvh-108px)] overflow-y-auto">
          <div className="text-[11px] font-semibold text-slate-400 px-2 pt-1 pb-2">
            Golden Age Classics
          </div>
          <div className="space-y-1 mb-3">
            {classicCabinets.map((cab) => {
              const active = cab.id === gameId;
              return (
                <button
                  key={cab.id}
                  type="button"
                  onClick={() => onSwitchGame(cab.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left text-xs font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-white/[0.11] text-white'
                      : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-100'
                  }`}
                >
                  <GameEmblem gameId={cab.id} size={20} />
                  <span className="truncate flex-1">{cab.title}</span>
                  <span className="text-[10px] font-mono text-slate-500">{cab.year}</span>
                </button>
              );
            })}
          </div>

          <div className="text-[11px] font-semibold text-slate-400 px-2 pt-2 pb-2 border-t border-white/[0.07]">
            Pac-Man Series
          </div>
          <div className="space-y-1">
            {pacCabinets.map((cab) => (
              <button
                key={cab.id}
                type="button"
                onClick={() => onSwitchGame(cab.id)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left text-xs font-medium text-slate-400 hover:bg-white/[0.05] hover:text-slate-100 transition-colors cursor-pointer"
              >
                <GameEmblem gameId={cab.id} size={20} />
                <span className="truncate flex-1">{cab.title}</span>
                <span className="text-[10px] font-mono text-slate-500">{cab.year}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Center Arcade Monitor Stage */}
        <section className="flex-1 flex flex-col items-center justify-center w-full min-w-0">
          {/* Compact Mobile Score Strip */}
          <div className="flex lg:hidden w-full max-w-[640px] items-center justify-between px-3 py-2 mb-2 rounded-xl bg-[#0B0F1D] border border-white/[0.08] text-xs">
            <div>
              <span className="text-slate-400 mr-1.5">Score</span>
              <span className="font-mono tabular-nums font-bold text-white">
                {hud.score.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-slate-400 mr-1.5">{hud.primaryMetricLabel}</span>
              <span className={`font-mono tabular-nums font-semibold ${spec.accentTextClass}`}>
                {hud.primaryMetricValue}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.max(0, hud.lives) }).map((_, i) => (
                <Heart key={i} className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
              ))}
            </div>
          </div>

          {/* HiDPI Game Canvas Container */}
          <div
            className="relative w-full rounded-2xl overflow-hidden bg-[#04060B] border border-white/[0.1] shadow-2xl select-none touch-none"
            style={{
              maxWidth: isWide ? '840px' : '640px',
              maxHeight: 'calc(100dvh - 124px)',
              aspectRatio: `${canvasDims.w} / ${canvasDims.h}`,
            }}
          >
            <canvas
              ref={canvasRef}
              onPointerMove={(e) => handleCanvasPointer(e, null)}
              onPointerDown={(e) => handleCanvasPointer(e, true)}
              onPointerUp={(e) => handleCanvasPointer(e, false)}
              onPointerLeave={(e) => handleCanvasPointer(e, false)}
              className="w-full h-full block"
            />

            {/* Title Overlay */}
            {hud.phase === 'TITLE' && (
              <div className="absolute inset-0 bg-[#050812]/72 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-center">
                <div className="max-w-sm w-full space-y-5">
                  <div className="flex flex-col items-center gap-3">
                    <GameEmblem gameId={gameId} size={58} />
                    <h1
                      className={`text-4xl sm:text-5xl font-extrabold tracking-tight ${spec.accentTextClass}`}
                      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                    >
                      {spec.title}
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      {spec.subtitle}
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <button
                      type="button"
                      onClick={handleStart}
                      className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer ${spec.accentButtonClass}`}
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Start {spec.title}</span>
                    </button>
                    <p className="text-xs text-slate-400">
                      Press <span className="font-mono text-slate-200">Space</span> or{' '}
                      <span className="font-mono text-slate-200">Enter</span> to begin
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Pause Overlay */}
            {hud.phase === 'PAUSED' && (
              <div className="absolute inset-0 bg-[#050812]/78 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center">
                <div className="max-w-xs w-full space-y-4">
                  <h2
                    className="text-3xl font-extrabold text-white"
                    style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                  >
                    Paused
                  </h2>
                  <button
                    type="button"
                    onClick={handleTogglePause}
                    className={`w-full py-3 px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer ${spec.accentButtonClass}`}
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Resume Game</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleStart}
                    className="w-full py-2.5 px-5 rounded-xl border border-white/12 bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-slate-200 cursor-pointer"
                  >
                    Restart From Wave 1
                  </button>
                </div>
              </div>
            )}

            {/* Game Over Overlay */}
            {hud.phase === 'GAME_OVER' && (
              <div className="absolute inset-0 bg-[#050812]/82 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center">
                <div className="max-w-xs w-full space-y-5">
                  <div className="space-y-1">
                    <h2
                      className="text-4xl font-extrabold text-rose-400"
                      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                    >
                      Game Over
                    </h2>
                    <p className="text-xs text-slate-400">{hud.stageName}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 py-3 border-y border-white/[0.08]">
                    <div>
                      <div className="text-[11px] text-slate-400">Final Score</div>
                      <div className="font-mono tabular-nums text-xl font-bold text-white">
                        {hud.score.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400">High Score</div>
                      <div className={`font-mono tabular-nums text-xl font-bold ${spec.accentTextClass}`}>
                        {hud.highScore.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleStart}
                    className={`w-full py-3.5 px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer ${spec.accentButtonClass}`}
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Play Again</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile / Tablet Touch Arcade Pad */}
          <div className="flex lg:hidden w-full max-w-[440px] items-center justify-between gap-4 mt-4 px-2 select-none">
            <div className="grid grid-cols-3 gap-1.5 w-36">
              <div />
              <button
                type="button"
                onPointerDown={() => setTouchDir('up', true)}
                onPointerUp={() => setTouchDir('up', false)}
                onPointerLeave={() => setTouchDir('up', false)}
                className="h-11 rounded-xl bg-white/[0.07] active:bg-white/[0.18] border border-white/10 flex items-center justify-center"
                aria-label="Up"
              >
                <ArrowUp className="w-5 h-5" />
              </button>
              <div />
              <button
                type="button"
                onPointerDown={() => setTouchDir('left', true)}
                onPointerUp={() => setTouchDir('left', false)}
                onPointerLeave={() => setTouchDir('left', false)}
                className="h-11 rounded-xl bg-white/[0.07] active:bg-white/[0.18] border border-white/10 flex items-center justify-center"
                aria-label="Left"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onPointerDown={() => setTouchDir('down', true)}
                onPointerUp={() => setTouchDir('down', false)}
                onPointerLeave={() => setTouchDir('down', false)}
                className="h-11 rounded-xl bg-white/[0.07] active:bg-white/[0.18] border border-white/10 flex items-center justify-center"
                aria-label="Down"
              >
                <ArrowDown className="w-5 h-5" />
              </button>
              <button
                type="button"
                onPointerDown={() => setTouchDir('right', true)}
                onPointerUp={() => setTouchDir('right', false)}
                onPointerLeave={() => setTouchDir('right', false)}
                className="h-11 rounded-xl bg-white/[0.07] active:bg-white/[0.18] border border-white/10 flex items-center justify-center"
                aria-label="Right"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            <button
              type="button"
              onPointerDown={() => setTouchFire(true)}
              onPointerUp={() => setTouchFire(false)}
              onPointerLeave={() => setTouchFire(false)}
              className={`h-16 px-8 rounded-2xl font-bold text-sm active:scale-95 transition-transform ${spec.accentButtonClass}`}
            >
              {actionLabel}
            </button>
          </div>
        </section>

        {/* Desktop Right Rail: Live Telemetry & Controls */}
        <aside className="w-full lg:w-[272px] shrink-0 rounded-2xl bg-[#0B0F1D] border border-white/[0.08] p-5 space-y-5">
          {/* Scoreboard */}
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-400">Score</span>
              <span className="font-mono tabular-nums text-2xl font-bold text-white">
                {hud.score.toLocaleString()}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-400">High Score</span>
              <span className={`font-mono tabular-nums text-base font-semibold ${spec.accentTextClass}`}>
                {hud.highScore.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-white/[0.07]">
              <span className="text-xs text-slate-400">Lives</span>
              <div className="flex items-center gap-1.5">
                {Array.from({ length: Math.max(0, hud.lives) }).map((_, i) => (
                  <Heart key={i} className="w-4 h-4 fill-rose-500 text-rose-500" />
                ))}
                {hud.lives === 0 && <span className="text-xs font-mono text-slate-500">0</span>}
              </div>
            </div>
          </div>

          {/* Stage Telemetry */}
          <div className="space-y-2.5 pt-4 border-t border-white/[0.07] text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Stage</span>
              <span className="font-medium text-slate-100 truncate max-w-[160px]">
                {hud.stageName}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">{hud.primaryMetricLabel}</span>
              <span className={`font-mono tabular-nums font-semibold ${spec.accentTextClass}`}>
                {hud.primaryMetricValue}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">{hud.secondaryMetricLabel}</span>
              <span className="font-mono tabular-nums font-medium text-slate-200">
                {hud.secondaryMetricValue}
              </span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-col gap-2 pt-4 border-t border-white/[0.07]">
            {hud.canRestartStage && (hud.phase === 'PLAYING' || hud.phase === 'PAUSED') && (
              <button
                type="button"
                onClick={() => {
                  gameRef.current?.restartStage?.();
                  if (gameRef.current) setHud(gameRef.current.getHudSnapshot());
                }}
                className="w-full py-2 px-3 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.09] text-xs font-medium text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry Current Cave (R)</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleStart}
              className="w-full py-2 px-3 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.09] text-xs font-medium text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>New Game</span>
            </button>
          </div>

          {/* Controls */}
          <div className="space-y-2 pt-4 border-t border-white/[0.07]">
            <h3 className="text-xs font-semibold text-slate-300">Controls</h3>
            <ul className="space-y-1.5 text-xs">
              {spec.controls.map((c) => (
                <li key={c.key} className="flex items-start justify-between gap-2">
                  <span className="font-mono text-[11px] text-slate-200 shrink-0">{c.key}</span>
                  <span className="text-slate-400 text-right">{c.desc}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Arcade Notes */}
          <div className="space-y-2 pt-4 border-t border-white/[0.07]">
            <h3 className="text-xs font-semibold text-slate-300">Arcade Guide</h3>
            <ul className="space-y-1.5 text-xs text-slate-400 leading-relaxed">
              {spec.tips.map((tip, i) => (
                <li key={i}>• {tip}</li>
              ))}
            </ul>
          </div>
        </aside>
      </main>
    </div>
  );
}

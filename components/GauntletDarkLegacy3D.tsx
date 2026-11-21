'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  ChevronDown,
  ChevronUp,
  Coins,
  Compass,
  Crown,
  Flame,
  Heart,
  KeyRound,
  Map as MapIcon,
  Shield,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Sword,
  Users,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { GameId } from '@/lib/game/arcadeTypes';
import { arcadeMusic } from '@/lib/game/musicEngine';
import { Gauntlet3DEngine, HudSnapshot } from '@/lib/game/gauntlet3d/Gauntlet3DEngine';
import { gauntletSfx } from '@/lib/game/gauntlet3d/soundFx';
import {
  ELEMENT_COLORS,
  ElementColorId,
  HERO_CLASSES,
  HeroClassId,
  REALM_LIST,
  RELIC_DEFS,
  RELIC_LIST,
} from '@/lib/game/gauntlet3d/typesAndData';

interface Props {
  onSwitchGame: (game: GameId) => void;
  onOpenLobby: () => void;
}

type ModalTab = null | 'portals' | 'hero' | 'armory';
type SpeedPreset = 'precision' | 'balanced' | 'arcade';

const SPEED_MULT: Record<SpeedPreset, number> = {
  precision: 0.58,
  balanced: 0.78,
  arcade: 1.0,
};

export default function GauntletDarkLegacy3D({ onOpenLobby }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<Gauntlet3DEngine | null>(null);

  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [modal, setModal] = useState<ModalTab>(null);
  const [dockExpanded, setDockExpanded] = useState(true);
  const [muted, setMuted] = useState(() => gauntletSfx.isMuted());
  const [musicOn, setMusicOn] = useState(() => arcadeMusic.isMusicEnabled());
  const [speedPreset, setSpeedPreset] = useState<SpeedPreset>('balanced');
  const [tiltEnabled, setTiltEnabled] = useState(false);
  const [secretCodeInput, setSecretCodeInput] = useState('');
  const [secretCodeFeedback, setSecretCodeFeedback] = useState<string | null>(null);
  const [selectedColorDraft, setSelectedColorDraft] = useState<ElementColorId>('red');

  // Touch Virtual Thumbstick state
  const stickRef = useRef<{ active: boolean; id: number; cx: number; cy: number }>({
    active: false,
    id: -1,
    cx: 0,
    cy: 0,
  });
  const [stickKnob, setStickKnob] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Single stable WebGL lifecycle
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const engine = new Gauntlet3DEngine(
      el,
      (snap) => setHud(snap),
      (which) => setModal(which)
    );
    engineRef.current = engine;
    engine.setSpeedMultiplier(SPEED_MULT['balanced']);

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.code === 'Escape') {
        setModal(null);
        return;
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      gauntletSfx.unlock();
      engine.handleKeyDown(e.code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      engine.handleKeyUp(e.code);
    };

    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      arcadeMusic.stop();
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Pause 3D combat cleanly while modal drawer is open
  useEffect(() => {
    engineRef.current?.setPaused(modal !== null);
  }, [modal]);

  // Speed preset sync
  useEffect(() => {
    engineRef.current?.setSpeedMultiplier(SPEED_MULT[speedPreset]);
  }, [speedPreset]);

  // Music sync
  useEffect(() => {
    if (musicOn && !muted) {
      arcadeMusic.startTrackForGame('gauntletdl');
    } else {
      arcadeMusic.stop();
    }
  }, [musicOn, muted]);

  // Accelerometer tilt steering
  useEffect(() => {
    if (!tiltEnabled) {
      engineRef.current?.setTiltMove(0, 0);
      return;
    }
    const onOrient = (e: DeviceOrientationEvent) => {
      const gamma = e.gamma ?? 0; // left/right tilt
      const beta = (e.beta ?? 35) - 35; // forward/back tilt around comfortable 35deg hold
      const dead = 5;
      const nx = Math.abs(gamma) < dead ? 0 : Math.max(-1, Math.min(1, gamma / 22));
      const nz = Math.abs(beta) < dead ? 0 : Math.max(-1, Math.min(1, beta / 22));
      engineRef.current?.setTiltMove(nx, nz);
    };
    window.addEventListener('deviceorientation', onOrient);
    return () => {
      window.removeEventListener('deviceorientation', onOrient);
      engineRef.current?.setTiltMove(0, 0);
    };
  }, [tiltEnabled]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      gauntletSfx.setMuted(next);
      return next;
    });
  }, []);

  const toggleTilt = useCallback(async () => {
    if (tiltEnabled) {
      setTiltEnabled(false);
      return;
    }
    const devOrient = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    if (typeof devOrient?.requestPermission === 'function') {
      try {
        const res = await devOrient.requestPermission();
        if (res === 'granted') setTiltEnabled(true);
      } catch {
        setTiltEnabled(false);
      }
    } else {
      setTiltEnabled(true);
    }
  }, [tiltEnabled]);

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (modal !== null) return;
    if (musicOn && !muted) arcadeMusic.startTrackForGame('gauntletdl');
    engineRef.current?.handlePointerDown(e.clientX, e.clientY, e.button);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (modal !== null) return;
    engineRef.current?.handlePointerMove(e.clientX, e.clientY);
  };

  const handleCanvasPointerUp = () => {
    engineRef.current?.handlePointerUp();
  };

  const handleStickStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    stickRef.current = {
      active: true,
      id: e.pointerId,
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleStickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!stickRef.current.active || stickRef.current.id !== e.pointerId) return;
    e.stopPropagation();
    const maxR = 34;
    const dx = e.clientX - stickRef.current.cx;
    const dy = e.clientY - stickRef.current.cy;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(maxR, dist);
    const angle = Math.atan2(dy, dx);
    const kx = Math.cos(angle) * clamped;
    const ky = Math.sin(angle) * clamped;
    setStickKnob({ x: kx, y: ky });
    engineRef.current?.setVirtualMove(kx / maxR, ky / maxR);
  };

  const handleStickEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickRef.current.id !== e.pointerId) return;
    e.stopPropagation();
    stickRef.current.active = false;
    setStickKnob({ x: 0, y: 0 });
    engineRef.current?.setVirtualMove(0, 0);
  };

  const hpPct = hud ? Math.max(0, Math.min(100, (hud.hp / Math.max(1, hud.maxHp)) * 100)) : 100;
  const xpPct = hud ? Math.max(0, Math.min(100, (hud.xp / Math.max(1, hud.xpNext)) * 100)) : 0;
  const turboPct = hud ? hud.turbo : 0;
  const elColor = hud ? ELEMENT_COLORS[hud.colorId] : ELEMENT_COLORS.red;

  return (
    <div className="relative h-dvh w-screen overflow-hidden bg-[#0c0918] text-slate-100 select-none">
      {/* Full-Viewport Genuine Three.js WebGL Stage (Zero backdrop-filter over canvas!) */}
      <div
        ref={mountRef}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        onPointerCancel={handleCanvasPointerUp}
        onContextMenu={(e) => e.preventDefault()}
        className="absolute inset-0 h-full w-full cursor-crosshair"
      />

      {/* TOP HUD STRIP (Compact, crisp opaque-dark bar, zero backdrop-blur) */}
      <header className="pointer-events-none absolute top-0 right-0 left-0 z-20 flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        {/* Left: Back + Hero Vital Cluster */}
        <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-amber-500/35 bg-slate-950/92 px-2.5 py-1.5 shadow-lg">
          <button
            type="button"
            onClick={onOpenLobby}
            className="flex items-center gap-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-semibold text-slate-200 hover:border-amber-400 hover:text-amber-200"
            title="Return to Retro Arcade Hub"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Hub</span>
          </button>

          <div className="flex flex-col gap-0.5 min-w-[148px] sm:min-w-[190px]">
            <div className="flex items-center justify-between gap-2 text-xs font-bold">
              <span style={{ color: elColor.glowHex }} className="truncate">
                {hud ? hud.heroTitle : 'Red Knight'}
              </span>
              <span className="font-mono text-[11px] text-amber-300">LVL {hud?.level ?? 1}</span>
            </div>
            {/* Health Bar */}
            <div className="relative h-2.5 w-full overflow-hidden rounded-sm bg-slate-800 border border-slate-700">
              <div
                className="h-full transition-all duration-100"
                style={{
                  width: `${hpPct}%`,
                  backgroundColor: hpPct < 25 ? '#ef4444' : hpPct < 55 ? '#f59e0b' : '#22c55e',
                }}
              />
              <span className="absolute inset-0 flex items-center justify-center font-mono text-[9px] font-bold text-white drop-shadow">
                HP {hud?.hp ?? 950} / {hud?.maxHp ?? 950}
              </span>
            </div>
            {/* Turbo & XP Slim Dual Bar */}
            <div className="flex gap-1">
              <div className="relative h-2 flex-1 overflow-hidden rounded-sm bg-slate-800 border border-slate-700">
                <div
                  className="h-full"
                  style={{
                    width: `${turboPct}%`,
                    backgroundColor: turboPct >= 50 ? '#fbbf24' : '#78350f',
                  }}
                />
                <span className="absolute inset-0 flex items-center justify-center font-mono text-[8px] font-bold text-white">
                  TURBO {turboPct}%
                </span>
              </div>
              <div className="relative h-2 w-16 overflow-hidden rounded-sm bg-slate-800 border border-slate-700">
                <div className="h-full bg-purple-500" style={{ width: `${xpPct}%` }} />
                <span className="absolute inset-0 flex items-center justify-center font-mono text-[8px] font-bold text-purple-100">
                  XP
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Realm, Runestones, Resources */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-lg border border-purple-500/35 bg-slate-950/92 px-3 py-1.5 shadow-lg text-xs">
          <div className="flex items-center gap-1.5 font-bold text-purple-200">
            <Compass className="h-3.5 w-3.5 text-purple-400" />
            <span>{hud?.realmName ?? 'Sumner’s Tower'}</span>
            {hud?.isBossArena && (
              <span className="rounded bg-red-600/80 px-1.5 py-0.5 text-[10px] font-bold text-white">
                BOSS ARENA
              </span>
            )}
          </div>
          <span className="text-slate-600">|</span>
          <div className="flex items-center gap-1 font-mono text-sky-300" title="Runestones Collected">
            <Sparkles className="h-3.5 w-3.5" />
            <span>
              {hud?.runestonesCollected ?? 0}/{hud?.totalRunestones ?? 13}
            </span>
          </div>
          <div className="flex items-center gap-1 font-mono text-amber-300" title="Gold Coins">
            <Coins className="h-3.5 w-3.5" />
            <span>{(hud?.gold ?? 0).toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1 font-mono text-yellow-200" title="Golden Keys">
            <KeyRound className="h-3.5 w-3.5" />
            <span>{hud?.keys ?? 1}</span>
          </div>
          <div className="flex items-center gap-1 font-mono text-cyan-300" title="Elemental Magic Potions">
            <Flame className="h-3.5 w-3.5" />
            <span>{hud?.potions ?? 2}</span>
          </div>
          <div className="hidden md:flex items-center gap-1 font-mono text-slate-300" title="Score">
            <span>SCR {(hud?.score ?? 0).toLocaleString()}</span>
          </div>
          {hud?.activeRealmLegendaryName && (
            <span
              className={`hidden lg:inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold border ${
                hud.hasMatchingLegendary
                  ? 'border-amber-400/70 bg-amber-500/20 text-amber-200'
                  : 'border-slate-700 bg-slate-900 text-slate-400'
              }`}
              title="Realm Boss-Weakening Legendary Weapon"
            >
              <Crown className="h-3 w-3" />
              {hud.hasMatchingLegendary
                ? `${hud.activeRealmLegendaryName} Ready`
                : `Seek ${hud.activeRealmLegendaryName}`}
            </span>
          )}
        </div>

        {/* Right: Quick Action Buttons (Portals, Armory, Heroes, Camera, Audio) */}
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-950/92 px-2 py-1.5 shadow-lg">
          <button
            type="button"
            onClick={() => setModal(modal === 'portals' ? null : 'portals')}
            className="flex items-center gap-1 rounded bg-purple-600 hover:bg-purple-500 px-2 py-1 text-xs font-bold text-white"
          >
            <MapIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Realms</span>
          </button>
          <button
            type="button"
            onClick={() => setModal(modal === 'armory' ? null : 'armory')}
            className="flex items-center gap-1 rounded bg-amber-600 hover:bg-amber-500 px-2 py-1 text-xs font-bold text-white"
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Armory</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (hud) setSelectedColorDraft(hud.colorId);
              setModal(modal === 'hero' ? null : 'hero');
            }}
            className="flex items-center gap-1 rounded border border-slate-600 bg-slate-800 hover:bg-slate-700 px-2 py-1 text-xs font-semibold text-slate-100"
          >
            <Users className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Heroes</span>
          </button>
          {!hud?.isHub && (
            <button
              type="button"
              onClick={() => engineRef.current?.enterRealm('hub', false)}
              className="rounded border border-purple-500/50 bg-purple-950 hover:bg-purple-900 px-2 py-1 text-xs font-semibold text-purple-200"
              title="Return to Sumner's Tower (H)"
            >
              Tower
            </button>
          )}
          <button
            type="button"
            onClick={() => engineRef.current?.cycleCameraMode()}
            className="flex items-center gap-1 rounded border border-slate-700 bg-slate-900 hover:border-sky-400 px-2 py-1 text-xs text-slate-200"
            title="Cycle 3D Camera Angle (V)"
          >
            <Camera className="h-3.5 w-3.5" />
            <span className="hidden xl:inline uppercase text-[10px]">{hud?.cameraMode ?? 'arcade'}</span>
          </button>
          <button
            type="button"
            onClick={toggleMute}
            className="rounded border border-slate-700 bg-slate-900 hover:border-amber-400 p-1 text-slate-200"
            title={muted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {muted ? <VolumeX className="h-3.5 w-3.5 text-red-400" /> : <Volume2 className="h-3.5 w-3.5 text-emerald-400" />}
          </button>
          <button
            type="button"
            onClick={() => setMusicOn((v) => !v)}
            className={`hidden md:inline rounded border px-1.5 py-1 text-[10px] font-bold ${
              musicOn && !muted
                ? 'border-emerald-500/60 bg-emerald-950 text-emerald-300'
                : 'border-slate-700 bg-slate-900 text-slate-400'
            }`}
          >
            BGM
          </button>
        </div>
      </header>

      {/* BOSS HEALTH BAR (Only visible during towering 3D Boss Fights!) */}
      {hud?.boss && (
        <div className="pointer-events-none absolute top-16 left-1/2 z-20 w-[min(92vw,460px)] -translate-x-1/2 rounded-lg border border-red-500/60 bg-slate-950/92 px-3 py-2 shadow-xl">
          <div className="flex items-center justify-between text-xs font-extrabold">
            <span className="text-red-300 tracking-wide uppercase">
              {hud.boss.name} {hud.boss.phase === 2 ? '· PHASE II' : ''}
            </span>
            {hud.boss.weakened ? (
              <span className="rounded bg-amber-500/25 border border-amber-400/60 px-1.5 py-0.5 text-[10px] text-amber-200">
                WEAKENED 2.5× DMG
              </span>
            ) : (
              <span className="font-mono text-red-200">
                {hud.boss.hp} / {hud.boss.maxHp}
              </span>
            )}
          </div>
          <div className="mt-1 h-3 w-full overflow-hidden rounded-sm bg-slate-900 border border-red-900">
            <div
              className="h-full bg-gradient-to-r from-red-700 via-red-500 to-amber-400 transition-all duration-100"
              style={{ width: `${Math.max(0, Math.min(100, (hud.boss.hp / Math.max(1, hud.boss.maxHp)) * 100))}%` }}
            />
          </div>
        </div>
      )}

      {/* CLASSIC GAUNTLET NARRATOR TOAST + HUB PROXIMITY PROMPT */}
      <div className="pointer-events-none absolute top-[4.4rem] left-1/2 z-10 flex w-[min(92vw,540px)] -translate-x-1/2 flex-col items-center gap-1.5">
        {!hud?.boss && hud?.narratorLine && (
          <div className="rounded border border-amber-500/40 bg-slate-950/88 px-3 py-1 text-center text-xs font-semibold text-amber-100 shadow">
            {hud.narratorLine}
          </div>
        )}
        {hud?.proximityPrompt && (
          <button
            type="button"
            onClick={() => engineRef.current?.triggerPrimaryAttack()}
            className="pointer-events-auto rounded-md border border-purple-400 bg-purple-900/95 hover:bg-purple-800 px-3.5 py-1.5 text-xs font-bold text-white shadow-lg"
          >
            {hud.proximityPrompt.label}
          </button>
        )}
      </div>

      {/* ACTIVE RELIC TIMERS (Top-left below header, minimal & unobtrusive) */}
      {hud && hud.activeRelics.length > 0 && (
        <div className="pointer-events-none absolute top-20 left-3 z-10 flex flex-col gap-1">
          {hud.activeRelics.map((ar) => {
            const def = RELIC_DEFS[ar.id];
            return (
              <div
                key={ar.id}
                className="flex items-center gap-2 rounded border border-slate-700 bg-slate-950/90 px-2 py-1 text-[11px] font-bold"
              >
                <span style={{ color: def.colorHex }}>{def.shortName}</span>
                <span className="font-mono text-slate-300">{Math.ceil(ar.remaining)}s</span>
              </div>
            );
          })}
        </div>
      )}

      {/* GAME OVER / FINAL SKORNE VICTORY OVERLAY */}
      {(hud?.gameOver || hud?.victory) && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="w-full max-w-md rounded-xl border border-amber-400/50 bg-slate-950 p-6 text-center shadow-2xl">
            <h2 className="text-2xl font-extrabold tracking-wide text-amber-300">
              {hud.victory ? 'DARK LEGACY CONQUERED!' : 'HERO HAS FALLEN'}
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              {hud.victory
                ? 'True Skorne has been vanquished and all realms are restored to Sumner’s Tower!'
                : 'Insert Coin to revive at Sumner’s Tower with all your XP, Gold, Runestones & Legendary Weapons intact.'}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg border border-slate-800 bg-slate-900 p-3 font-mono text-xs">
              <div>
                <div className="text-slate-400">SCORE</div>
                <div className="text-amber-300 font-bold">{hud.score.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-slate-400">RUNESTONES</div>
                <div className="text-sky-300 font-bold">{hud.runestonesCollected}/13</div>
              </div>
              <div>
                <div className="text-slate-400">LEVEL</div>
                <div className="text-purple-300 font-bold">{hud.level}</div>
              </div>
            </div>
            <div className="mt-5 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => engineRef.current?.restartRun()}
                className="rounded-lg bg-amber-500 hover:bg-amber-400 px-5 py-2.5 text-sm font-extrabold text-slate-950"
              >
                {hud.victory ? 'Return to Sumner’s Tower' : 'Revive at Sumner’s Tower'}
              </button>
              <button
                type="button"
                onClick={onOpenLobby}
                className="rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 px-4 py-2.5 text-sm font-bold text-slate-100"
              >
                Arcade Hub
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIRTUAL THUMBSTICK (Bottom-left for touch / mouse-free steering) */}
      <div
        onPointerDown={handleStickStart}
        onPointerMove={handleStickMove}
        onPointerUp={handleStickEnd}
        onPointerCancel={handleStickEnd}
        className="absolute bottom-16 left-3 z-20 flex h-24 w-24 items-center justify-center rounded-full border-2 border-slate-600/70 bg-slate-950/75 touch-none sm:h-24 sm:w-24 md:opacity-80 hover:opacity-100"
        title="Drag to steer 360° (or use WASD / Arrow keys)"
      >
        <div
          className="h-10 w-10 rounded-full border border-amber-300/80 bg-amber-500/85 shadow"
          style={{ transform: `translate(${stickKnob.x}px, ${stickKnob.y}px)` }}
        />
      </div>

      {/* COLLAPSIBLE BOTTOM CONTROL & CONSOLE RELIC DOCK */}
      <div className="pointer-events-none absolute right-0 bottom-2 left-0 z-20 flex flex-col items-center px-3">
        <button
          type="button"
          onClick={() => setDockExpanded((v) => !v)}
          className="pointer-events-auto mb-1 flex items-center gap-1 rounded-t-md border border-b-0 border-slate-700 bg-slate-950/92 px-3 py-0.5 text-[10px] font-bold text-slate-300 hover:text-amber-300"
        >
          {dockExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          <span>{dockExpanded ? 'Hide Relic & Action Dock' : 'Show Relic & Action Dock'}</span>
        </button>

        {dockExpanded && (
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-lg border border-slate-700/85 bg-slate-950/92 px-3 py-2 shadow-2xl">
            {/* 5-Slot Authentic Console Inventory Relic Bar */}
            <div className="flex items-center gap-1">
              {[0, 1, 2, 3, 4].map((idx) => {
                const relicId = hud?.inventoryRelics[idx];
                const def = relicId ? RELIC_DEFS[relicId] : null;
                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={!def}
                    onClick={() => engineRef.current?.activateInventorySlot(idx)}
                    className={`flex h-9 min-w-[58px] flex-col items-center justify-center rounded border px-1.5 text-[10px] font-bold ${
                      def
                        ? 'border-amber-400/70 bg-slate-900 hover:bg-slate-800 text-white'
                        : 'border-slate-800 bg-slate-900/50 text-slate-600 cursor-default'
                    }`}
                    title={def ? `[${idx + 1}] ${def.name}: ${def.desc}` : `Empty Relic Slot ${idx + 1}`}
                  >
                    <span className="font-mono text-[8px] text-slate-400">[{idx + 1}]</span>
                    <span style={{ color: def ? def.colorHex : undefined }} className="truncate max-w-[62px]">
                      {def ? def.shortName : 'Empty'}
                    </span>
                  </button>
                );
              })}
            </div>

            <span className="hidden sm:inline text-slate-700">|</span>

            {/* 3-Button Arcade + Console Combat Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => engineRef.current?.triggerPrimaryAttack()}
                className="flex items-center gap-1 rounded bg-red-600 hover:bg-red-500 px-2.5 py-1.5 text-xs font-extrabold text-white"
                title="Quick Melee Combo / Ranged Shot (Space / Click)"
              >
                <Sword className="h-3.5 w-3.5" />
                <span>Attack</span>
              </button>
              <button
                type="button"
                onClick={() => engineRef.current?.triggerHeavyAttack()}
                className="flex items-center gap-1 rounded bg-orange-600 hover:bg-orange-500 px-2.5 py-1.5 text-xs font-extrabold text-white"
                title="Heavy 360° Fighting Attack (Shift / X / Right-Click)"
              >
                <Zap className="h-3.5 w-3.5" />
                <span>Heavy</span>
              </button>
              <button
                type="button"
                onClick={() => engineRef.current?.triggerTurboAttack()}
                disabled={(hud?.turbo ?? 0) < 50}
                className={`flex items-center gap-1 rounded px-2.5 py-1.5 text-xs font-extrabold ${
                  (hud?.turbo ?? 0) >= 50
                    ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
                title="Elemental Turbo Special (T / F — requires 50%+ Turbo)"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Turbo</span>
              </button>
              <button
                type="button"
                onClick={() => engineRef.current?.triggerPotionBlast()}
                disabled={(hud?.potions ?? 0) <= 0}
                className={`flex items-center gap-1 rounded px-2.5 py-1.5 text-xs font-extrabold ${
                  (hud?.potions ?? 0) > 0
                    ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
                title="Elemental Magic Potion Screen Blast (Q)"
              >
                <Flame className="h-3.5 w-3.5" />
                <span>Potion ({hud?.potions ?? 0})</span>
              </button>
              <button
                type="button"
                onPointerDown={() => engineRef.current?.setBlocking(true)}
                onPointerUp={() => engineRef.current?.setBlocking(false)}
                onPointerLeave={() => engineRef.current?.setBlocking(false)}
                className="flex items-center gap-1 rounded border border-sky-500/60 bg-sky-950 hover:bg-sky-900 px-2 py-1.5 text-xs font-bold text-sky-200"
                title="Hold to Block (Ctrl / C)"
              >
                <Shield className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Block</span>
              </button>
            </div>

            <span className="hidden lg:inline text-slate-700">|</span>

            {/* Precision Speed + Accelerometer Tilt + Arcade Drain Toggle */}
            <div className="flex items-center gap-1">
              {(['precision', 'balanced', 'arcade'] as SpeedPreset[]).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setSpeedPreset(preset)}
                  className={`rounded px-1.5 py-1 text-[10px] font-bold border ${
                    speedPreset === preset
                      ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                      : 'border-slate-700 bg-slate-900 text-slate-400'
                  }`}
                >
                  {preset === 'precision' ? '58%' : preset === 'balanced' ? '78%' : '100%'}
                </button>
              ))}
              <button
                type="button"
                onClick={toggleTilt}
                className={`flex items-center gap-1 rounded border px-1.5 py-1 text-[10px] font-bold ${
                  tiltEnabled
                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                    : 'border-slate-700 bg-slate-900 text-slate-400'
                }`}
                title="Toggle Accelerometer Tilt Steering"
              >
                <Smartphone className="h-3 w-3" />
                <span className="hidden sm:inline">Tilt</span>
              </button>
              <button
                type="button"
                onClick={() => engineRef.current?.toggleArcadeDrain()}
                className={`flex items-center gap-1 rounded border px-1.5 py-1 text-[10px] font-bold ${
                  hud?.arcadeDrain
                    ? 'border-red-400/70 bg-red-950 text-red-200'
                    : 'border-emerald-400/70 bg-emerald-950 text-emerald-200'
                }`}
                title="Toggle Arcade Health-as-Timer vs Console Explore Mode"
              >
                <Heart className="h-3 w-3" />
                <span>{hud?.arcadeDrain ? 'Arcade Drain' : 'Explore'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: SUMNER'S TOWER 9-REALM PORTAL MAP */}
      {modal === 'portals' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/82 p-4">
          <div className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded-xl border border-purple-500/50 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
              <div>
                <h2 className="text-lg font-extrabold text-purple-300">
                  Sumner’s Tower · 9 Realms & Boss Sanctums
                </h2>
                <p className="text-xs text-slate-400">
                  Collect 13 Runestones across 8 Realms to unseal the Desecrated Temple & battle Skorne!
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => engineRef.current?.toggleFreeWarp()}
                  className={`rounded border px-2.5 py-1 text-xs font-bold ${
                    hud?.freeWarp
                      ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                      : 'border-slate-700 bg-slate-900 text-slate-300'
                  }`}
                >
                  {hud?.freeWarp ? 'Free-Warp: ON' : 'Unlock All (Free-Warp)'}
                </button>
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="rounded border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-bold text-slate-200 hover:bg-slate-700"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 overflow-y-auto p-4 sm:grid-cols-2 lg:grid-cols-3">
              {REALM_LIST.map((realm) => {
                const unlocked =
                  Boolean(hud?.freeWarp) || (hud?.runestonesCollected ?? 0) >= realm.requiredRunestones;
                const cleared = hud?.clearedRealms.includes(realm.id) ?? false;
                const hasLeg = hud?.legendaryWeapons.includes(realm.legendaryWeapon.id) ?? false;
                return (
                  <div
                    key={realm.id}
                    className={`flex flex-col justify-between rounded-lg border p-3 ${
                      unlocked
                        ? 'border-slate-700 bg-slate-900'
                        : 'border-slate-800 bg-slate-950 opacity-65'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm" style={{ color: realm.portalHex }}>
                          {realm.order}. {realm.name}
                        </span>
                        {cleared && (
                          <span className="rounded bg-emerald-600/30 border border-emerald-400/50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-200">
                            CLEARED
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">{realm.subtitle}</p>
                      <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
                        <span
                          className={`rounded px-1.5 py-0.5 font-semibold border ${
                            hasLeg
                              ? 'border-amber-400/60 bg-amber-500/20 text-amber-200'
                              : 'border-slate-700 bg-slate-950 text-slate-400'
                          }`}
                        >
                          {hasLeg ? 'Owned: ' : 'Weapon: '}
                          {realm.legendaryWeapon.name}
                        </span>
                        {!unlocked && (
                          <span className="rounded border border-sky-700 bg-sky-950 px-1.5 py-0.5 text-sky-300">
                            Needs {realm.requiredRunestones} Runestones
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex gap-1.5">
                      <button
                        type="button"
                        disabled={!unlocked}
                        onClick={() => {
                          engineRef.current?.enterRealm(realm.id, false);
                          setModal(null);
                        }}
                        className={`flex-1 rounded py-1.5 text-xs font-bold ${
                          unlocked
                            ? 'bg-purple-600 hover:bg-purple-500 text-white'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        Enter Realm
                      </button>
                      <button
                        type="button"
                        disabled={!unlocked}
                        onClick={() => {
                          engineRef.current?.enterRealm(realm.id, true);
                          setModal(null);
                        }}
                        className={`rounded px-2.5 py-1.5 text-xs font-bold ${
                          unlocked
                            ? 'bg-red-700 hover:bg-red-600 text-white'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                        title={`Warp directly to ${realm.bossName}'s Boss Sanctum`}
                      >
                        Boss
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: HERO CLASS, ELEMENTAL COLOR & CONSOLE SECRET CODES */}
      {modal === 'hero' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/82 p-4">
          <div className="flex max-h-[88vh] w-full max-w-4xl flex-col rounded-xl border border-amber-500/50 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
              <div>
                <h2 className="text-lg font-extrabold text-amber-300">
                  Sumner’s Hero Pedestal · 8 Core + 4 Secret Heroes × 4 Elements
                </h2>
                <p className="text-xs text-slate-400">
                  Pick any elemental color (Fire, Ice, Lightning, Acid) and hero class!
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-bold text-slate-200 hover:bg-slate-700"
              >
                Close
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/60 px-5 py-2.5">
              {/* 4 Authentic Elemental Colors */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-300">Elemental Color:</span>
                {(['red', 'blue', 'yellow', 'green'] as ElementColorId[]).map((cid) => {
                  const el = ELEMENT_COLORS[cid];
                  return (
                    <button
                      key={cid}
                      type="button"
                      onClick={() => setSelectedColorDraft(cid)}
                      className={`rounded border px-2.5 py-1 text-xs font-bold ${
                        selectedColorDraft === cid
                          ? 'border-white text-white shadow'
                          : 'border-slate-700 bg-slate-900 text-slate-300'
                      }`}
                      style={{
                        backgroundColor: selectedColorDraft === cid ? el.primaryHex : undefined,
                      }}
                    >
                      {el.name} ({el.element})
                    </button>
                  );
                })}
              </div>

              {/* Authentic Console Secret Name Code Entry */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const msg = engineRef.current?.redeemSecretCode(secretCodeInput) ?? '';
                  setSecretCodeFeedback(msg);
                  setSecretCodeInput('');
                }}
                className="flex items-center gap-1.5"
              >
                <input
                  type="text"
                  value={secretCodeInput}
                  onChange={(e) => setSecretCodeInput(e.target.value)}
                  placeholder="Code: SUMNER, MEDUSA, LEGEND..."
                  className="w-48 rounded border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-amber-200 placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded bg-amber-600 hover:bg-amber-500 px-2.5 py-1 text-xs font-bold text-white"
                >
                  Enter Code
                </button>
              </form>
            </div>
            {secretCodeFeedback && (
              <div className="bg-amber-500/15 px-5 py-1.5 text-xs font-semibold text-amber-200">
                {secretCodeFeedback}
              </div>
            )}

            <div className="grid grid-cols-1 gap-2.5 overflow-y-auto p-4 sm:grid-cols-2 lg:grid-cols-3">
              {HERO_CLASSES.map((hero) => {
                const isSecretLocked =
                  Boolean(hero.secret) &&
                  !(hud?.unlockedSecretHeroes.includes(hero.id) ?? false) &&
                  (hud?.runestonesCollected ?? 0) < (hero.unlockRunestones ?? 99);
                const active = hud?.heroId === hero.id && hud?.colorId === selectedColorDraft;
                return (
                  <div
                    key={hero.id}
                    className={`flex flex-col justify-between rounded-lg border p-3 ${
                      active
                        ? 'border-amber-400 bg-slate-900'
                        : isSecretLocked
                          ? 'border-slate-800 bg-slate-950 opacity-65'
                          : 'border-slate-700 bg-slate-900/80'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-sm text-white">
                          {hero.name}{' '}
                          {hero.secret && (
                            <span className="ml-1 rounded bg-purple-600/40 px-1 py-0.5 text-[9px] text-purple-200">
                              SECRET
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] font-semibold text-amber-300">
                          {hero.weaponName}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">{hero.desc}</p>
                      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[10px]">
                        <div className="text-red-300">STR {hero.strength}</div>
                        <div className="text-emerald-300">SPD {hero.speed}</div>
                        <div className="text-sky-300">ARM {hero.armor}</div>
                        <div className="text-purple-300">MAG {hero.magic}</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isSecretLocked}
                      onClick={() => {
                        engineRef.current?.setHeroSelection(hero.id as HeroClassId, selectedColorDraft);
                        setModal(null);
                      }}
                      className={`mt-3 w-full rounded py-1.5 text-xs font-bold ${
                        isSecretLocked
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                      }`}
                    >
                      {isSecretLocked
                        ? `Unlock at ${hero.unlockRunestones} Runestones or Code "${hero.secretCode}"`
                        : `Play as ${ELEMENT_COLORS[selectedColorDraft].name} ${hero.name}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: SUMNER'S ARMORY SHOP (Stats, Supplies & All 10 Console Relics) */}
      {modal === 'armory' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/82 p-4">
          <div className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded-xl border border-amber-500/50 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
              <div>
                <h2 className="text-lg font-extrabold text-amber-300">Sumner’s Armory & Relic Shop</h2>
                <p className="text-xs text-slate-400">
                  Gold Available:{' '}
                  <span className="font-mono font-bold text-amber-300">
                    {(hud?.gold ?? 0).toLocaleString()} G
                  </span>{' '}
                  · Permanent Stat Upgrades + Console Inventory Relics
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-bold text-slate-200 hover:bg-slate-700"
              >
                Close
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto p-4">
              {/* Permanent Stat Forging + Instant Supplies */}
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  Permanent Upgrades & Dungeon Supplies
                </h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(
                    [
                      { id: 'strength', label: '+8 Strength', sub: `Now ${hud?.stats.strength ?? 80}`, cost: 350 },
                      { id: 'speed', label: '+8 Speed', sub: `Now ${hud?.stats.speed ?? 70}`, cost: 350 },
                      { id: 'armor', label: '+8 Armor & HP', sub: `Now ${hud?.stats.armor ?? 80}`, cost: 350 },
                      { id: 'magic', label: '+8 Magic', sub: `Now ${hud?.stats.magic ?? 60}`, cost: 350 },
                      { id: 'turkey', label: 'Roast Turkey', sub: '+400 Health', cost: 180 },
                      { id: 'potion', label: 'Magic Potion', sub: `Carry ${hud?.potions ?? 0}/9`, cost: 240 },
                      { id: 'key', label: 'Golden Key', sub: `Carry ${hud?.keys ?? 0}/9`, cost: 160 },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => engineRef.current?.buyArmoryItem(item.id)}
                      className="flex flex-col items-start rounded-lg border border-slate-700 bg-slate-900 hover:border-amber-400 p-2.5 text-left"
                    >
                      <span className="text-xs font-bold text-white">{item.label}</span>
                      <span className="text-[10px] text-slate-400">{item.sub}</span>
                      <span className="mt-1.5 font-mono text-xs font-bold text-amber-300">
                        {item.cost} G
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* All 10 Authentic Console Relics */}
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  Console Inventory Relics (Stored in Slots [1]–[5])
                </h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {RELIC_LIST.map((relic) => (
                    <button
                      key={relic.id}
                      type="button"
                      onClick={() => engineRef.current?.buyArmoryItem(relic.id)}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-700 bg-slate-900 hover:border-amber-400 p-2.5 text-left"
                    >
                      <div>
                        <div className="text-xs font-bold" style={{ color: relic.colorHex }}>
                          {relic.name}
                        </div>
                        <div className="text-[11px] text-slate-400">{relic.desc}</div>
                      </div>
                      <span className="shrink-0 rounded bg-amber-500/20 border border-amber-400/50 px-2 py-1 font-mono text-xs font-bold text-amber-200">
                        {relic.cost} G
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

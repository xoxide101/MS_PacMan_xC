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
    <div className="relative h-dvh w-screen overflow-hidden bg-[#140e09] text-[#f3e6cc] select-none">
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

      {/* TOP BAR: Compact Carved Stone Realm Banner + Antique Bronze Utilities */}
      <header className="pointer-events-none absolute top-0 right-0 left-0 z-20 flex flex-wrap items-start justify-between gap-2 px-3 py-2">
        {/* Top-Left: Hub Return + Carved Stone Realm Crest */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-sm border-2 border-[#8c6834] bg-[#1c150f]/95 px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,220,150,0.3),0_4px_14px_rgba(0,0,0,0.85)]">
          <button
            type="button"
            onClick={onOpenLobby}
            className="flex items-center gap-1 rounded-sm border border-[#9d773e] bg-[#2f2216] px-2 py-1 text-xs font-bold tracking-wide text-[#f2d699] hover:border-[#e6b963] hover:bg-[#3d2d1d]"
            title="Return to Retro Arcade Hub"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">HUB</span>
          </button>

          <div className="flex items-center gap-2 text-xs">
            <Compass className="h-4 w-4 text-[#d8a950]" />
            <span className="font-serif font-extrabold tracking-wider text-[#f5dba0] uppercase">
              {hud?.realmName ?? 'Sumner’s Tower'}
            </span>
            {hud?.isBossArena && (
              <span className="rounded-sm border border-[#e0523c] bg-[#6e1510] px-1.5 py-0.5 text-[10px] font-black tracking-widest text-[#ffd4c7]">
                BOSS SANCTUM
              </span>
            )}
          </div>

          {hud?.activeRealmLegendaryName && (
            <span
              className={`hidden lg:inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[10px] font-bold border ${
                hud.hasMatchingLegendary
                  ? 'border-[#e6b963] bg-[#543a13] text-[#ffeaad]'
                  : 'border-[#5a452b] bg-[#241b13] text-[#b49c79]'
              }`}
              title="Realm Boss-Weakening Legendary Weapon"
            >
              <Crown className="h-3 w-3 text-[#eab95b]" />
              {hud.hasMatchingLegendary
                ? `${hud.activeRealmLegendaryName} Ready`
                : `Seek ${hud.activeRealmLegendaryName}`}
            </span>
          )}
        </div>

        {/* Top-Right: Antique Bronze Tower & Utility Controls */}
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-sm border-2 border-[#8c6834] bg-[#1c150f]/95 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,220,150,0.3),0_4px_14px_rgba(0,0,0,0.85)]">
          <button
            type="button"
            onClick={() => setModal(modal === 'portals' ? null : 'portals')}
            className="flex items-center gap-1 rounded-sm border border-[#c49448] bg-[#4c3214] hover:bg-[#61401a] px-2 py-1 text-xs font-extrabold tracking-wide text-[#ffdf99]"
          >
            <MapIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">REALMS</span>
          </button>
          <button
            type="button"
            onClick={() => setModal(modal === 'armory' ? null : 'armory')}
            className="flex items-center gap-1 rounded-sm border border-[#d69f42] bg-[#6b4213] hover:bg-[#825118] px-2 py-1 text-xs font-extrabold tracking-wide text-[#ffebbd]"
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">ARMORY</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (hud) setSelectedColorDraft(hud.colorId);
              setModal(modal === 'hero' ? null : 'hero');
            }}
            className="flex items-center gap-1 rounded-sm border border-[#8e6d3d] bg-[#2d2116] hover:bg-[#3d2d1e] px-2 py-1 text-xs font-bold tracking-wide text-[#ecd5a7]"
          >
            <Users className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">HEROES</span>
          </button>
          {!hud?.isHub && (
            <button
              type="button"
              onClick={() => engineRef.current?.enterRealm('hub', false)}
              className="rounded-sm border border-[#7ea3cc] bg-[#1d2d40] hover:bg-[#273c54] px-2 py-1 text-xs font-bold text-[#cfe4ff]"
              title="Return to Sumner's Tower (H)"
            >
              TOWER
            </button>
          )}
          <button
            type="button"
            onClick={() => engineRef.current?.cycleCameraMode()}
            className="flex items-center gap-1 rounded-sm border border-[#735834] bg-[#261c13] hover:border-[#d6a34c] px-2 py-1 text-xs text-[#e5cfa4]"
            title="Cycle 3D Camera Angle (V)"
          >
            <Camera className="h-3.5 w-3.5" />
            <span className="hidden xl:inline uppercase text-[10px] font-bold">{hud?.cameraMode ?? 'arcade'}</span>
          </button>
          <button
            type="button"
            onClick={toggleMute}
            className="rounded-sm border border-[#735834] bg-[#261c13] hover:border-[#d6a34c] p-1 text-[#e5cfa4]"
            title={muted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {muted ? <VolumeX className="h-3.5 w-3.5 text-[#e05b49]" /> : <Volume2 className="h-3.5 w-3.5 text-[#88c76b]" />}
          </button>
          <button
            type="button"
            onClick={() => setMusicOn((v) => !v)}
            className={`hidden md:inline rounded-sm border px-1.5 py-1 text-[10px] font-extrabold ${
              musicOn && !muted
                ? 'border-[#88b35e] bg-[#223316] text-[#c7eb9d]'
                : 'border-[#5a452b] bg-[#211912] text-[#9c8769]'
            }`}
          >
            BGM
          </button>
        </div>
      </header>

      {/* TOWERING BOSS HEALTH BAR (Ornate Iron & Crimson Medieval Bar) */}
      {hud?.boss && (
        <div className="pointer-events-none absolute top-14 left-1/2 z-20 w-[min(92vw,480px)] -translate-x-1/2 rounded-sm border-2 border-[#b57d36] bg-[#1b120e]/95 px-3.5 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.9)]">
          <div className="flex items-center justify-between text-xs font-extrabold">
            <span className="font-serif text-[#ffbf8a] tracking-widest uppercase">
              {hud.boss.name} {hud.boss.phase === 2 ? '· PHASE II' : ''}
            </span>
            {hud.boss.weakened ? (
              <span className="rounded-sm bg-[#634112] border border-[#f2c15a] px-1.5 py-0.5 text-[10px] text-[#ffe9a8]">
                WEAKENED 2.5× DMG
              </span>
            ) : (
              <span className="font-mono text-[#f7c8b8]">
                {hud.boss.hp} / {hud.boss.maxHp}
              </span>
            )}
          </div>
          <div className="mt-1.5 h-3.5 w-full overflow-hidden rounded-sm bg-[#2b1410] border border-[#8f4c32]">
            <div
              className="h-full bg-gradient-to-r from-[#8f1812] via-[#d9381e] to-[#f0a534] transition-all duration-100"
              style={{ width: `${Math.max(0, Math.min(100, (hud.boss.hp / Math.max(1, hud.boss.maxHp)) * 100))}%` }}
            />
          </div>
        </div>
      )}

      {/* CLASSIC GAUNTLET NARRATOR BANNER + HUB PROXIMITY PROMPT */}
      <div className="pointer-events-none absolute top-14 left-1/2 z-10 flex w-[min(92vw,560px)] -translate-x-1/2 flex-col items-center gap-1.5">
        {!hud?.boss && hud?.narratorLine && (
          <div className="rounded-sm border border-[#b0833d] bg-[#1a130d]/92 px-4 py-1 text-center font-serif text-xs font-bold tracking-wide text-[#f7dc9c] shadow-lg">
            {hud.narratorLine}
          </div>
        )}
        {hud?.proximityPrompt && (
          <button
            type="button"
            onClick={() => engineRef.current?.triggerPrimaryAttack()}
            className="pointer-events-auto rounded-sm border-2 border-[#e3b354] bg-[#4a2f12]/95 hover:bg-[#613e18] px-4 py-1.5 text-xs font-extrabold tracking-wider text-[#ffeaad] shadow-xl uppercase"
          >
            {hud.proximityPrompt.label}
          </button>
        )}
      </div>

      {/* ACTIVE RELIC TIMERS (Top-left below Realm banner) */}
      {hud && hud.activeRelics.length > 0 && (
        <div className="pointer-events-none absolute top-16 left-3 z-10 flex flex-col gap-1">
          {hud.activeRelics.map((ar) => {
            const def = RELIC_DEFS[ar.id];
            return (
              <div
                key={ar.id}
                className="flex items-center gap-2 rounded-sm border border-[#8c6834] bg-[#1c150f]/92 px-2.5 py-1 text-[11px] font-bold shadow"
              >
                <span style={{ color: def.colorHex }}>{def.shortName}</span>
                <span className="font-mono text-[#e8d2a7]">{Math.ceil(ar.remaining)}s</span>
              </div>
            );
          })}
        </div>
      )}

      {/* GAME OVER / FINAL SKORNE VICTORY OVERLAY */}
      {(hud?.gameOver || hud?.victory) && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0d0805]/85 p-4">
          <div className="w-full max-w-md rounded-sm border-2 border-[#c29140] bg-[#1c150f] p-6 text-center shadow-[0_16px_48px_rgba(0,0,0,0.95)]">
            <h2 className="font-serif text-2xl font-black tracking-widest text-[#f5cc74] uppercase">
              {hud.victory ? 'DARK LEGACY CONQUERED!' : 'HERO HAS FALLEN'}
            </h2>
            <p className="mt-2 text-sm text-[#d6c29f]">
              {hud.victory
                ? 'True Skorne has been vanquished and all realms are restored to Sumner’s Tower!'
                : 'Insert Coin to revive at Sumner’s Tower with all your XP, Gold, Runestones & Legendary Weapons intact.'}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 rounded-sm border border-[#73552a] bg-[#130e0a] p-3 font-mono text-xs">
              <div>
                <div className="text-[#9e8765]">SCORE</div>
                <div className="text-[#f5c869] font-bold">{hud.score.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[#9e8765]">RUNESTONES</div>
                <div className="text-[#8ac8f5] font-bold">{hud.runestonesCollected}/13</div>
              </div>
              <div>
                <div className="text-[#9e8765]">LEVEL</div>
                <div className="text-[#e3b0ff] font-bold">{hud.level}</div>
              </div>
            </div>
            <div className="mt-5 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => engineRef.current?.restartRun()}
                className="rounded-sm border border-[#f5d27a] bg-[#9c631c] hover:bg-[#b87622] px-5 py-2.5 text-sm font-extrabold text-[#fff4d4]"
              >
                {hud.victory ? 'Return to Sumner’s Tower' : 'Revive at Sumner’s Tower'}
              </button>
              <button
                type="button"
                onClick={onOpenLobby}
                className="rounded-sm border border-[#7d6037] bg-[#2a1f15] hover:bg-[#3b2c1d] px-4 py-2.5 text-sm font-bold text-[#e6d0a6]"
              >
                Arcade Hub
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIRTUAL THUMBSTICK (Bottom-left bronze ring for touch / mouse-free steering) */}
      <div
        onPointerDown={handleStickStart}
        onPointerMove={handleStickMove}
        onPointerUp={handleStickEnd}
        onPointerCancel={handleStickEnd}
        className="absolute bottom-28 left-3 z-20 flex h-24 w-24 items-center justify-center rounded-full border-2 border-[#a87c3b] bg-[#1a130d]/85 touch-none shadow-lg md:opacity-80 hover:opacity-100"
        title="Drag to steer 360° (or use WASD / Arrow keys)"
      >
        <div
          className="h-10 w-10 rounded-full border-2 border-[#f2c86b] bg-[#8f5b1e] shadow"
          style={{ transform: `translate(${stickKnob.x}px, ${stickKnob.y}px)` }}
        />
      </div>

      {/* AUTHENTIC 2000 MIDWAY GAUNTLET: DARK LEGACY BOTTOM BRONZE-AND-STONE PLAYER PLAQUE */}
      <div className="pointer-events-none absolute right-0 bottom-1.5 left-0 z-20 flex flex-col items-center px-2.5">
        <button
          type="button"
          onClick={() => setDockExpanded((v) => !v)}
          className="pointer-events-auto mb-0.5 flex items-center gap-1 rounded-t-sm border border-b-0 border-[#9c7438] bg-[#231911]/95 px-3 py-0.5 text-[10px] font-extrabold tracking-wider text-[#e2c286] hover:text-[#ffe4a8] uppercase"
        >
          {dockExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          <span>{dockExpanded ? 'Hide Arcade Plaque' : 'Show Arcade Plaque'}</span>
        </button>

        {dockExpanded && (
          <div className="pointer-events-auto relative flex w-full max-w-[1160px] flex-wrap items-center justify-between gap-2.5 rounded-sm border-2 border-[#a87c3b] bg-[#1b140e]/96 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,222,150,0.38),0_10px_28px_rgba(0,0,0,0.92)]">
            {/* Corner Antique Brass Rivets */}
            <span className="pointer-events-none absolute top-1 left-1 h-1.5 w-1.5 rounded-full bg-[#d6a34c]" />
            <span className="pointer-events-none absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-[#d6a34c]" />
            <span className="pointer-events-none absolute bottom-1 left-1 h-1.5 w-1.5 rounded-full bg-[#d6a34c]" />
            <span className="pointer-events-none absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-[#d6a34c]" />

            {/* BLOCK 1: HERO CREST, CHUNKY HEALTH READOUT & TURBO FLAME GAUGE */}
            <div className="flex items-center gap-2.5 min-w-[235px]">
              {/* Elemental Hero Crest Shield */}
              <div
                className="flex h-12 w-11 shrink-0 flex-col items-center justify-center rounded-sm border-2 border-[#c99744] shadow-inner"
                style={{ backgroundColor: elColor.primaryHex }}
              >
                <span className="font-serif text-[10px] font-black text-white drop-shadow">P1</span>
                <span className="font-mono text-[10px] font-extrabold text-[#fff2c2] drop-shadow">
                  L{hud?.level ?? 1}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-serif text-xs font-black tracking-wider text-[#f7db9e] uppercase truncate">
                    {hud ? hud.heroTitle : 'Red Knight'}
                  </span>
                  <span
                    className={`font-mono text-sm font-black leading-none ${
                      hpPct < 25 ? 'text-[#ff5947]' : 'text-[#ffe082]'
                    }`}
                  >
                    {hud?.hp ?? 950}
                  </span>
                </div>

                {/* Classic Crimson-to-Gold Health Meter */}
                <div className="relative h-2.5 w-full overflow-hidden rounded-sm border border-[#8f6a34] bg-[#2a1510]">
                  <div
                    className="h-full transition-all duration-100"
                    style={{
                      width: `${hpPct}%`,
                      background:
                        hpPct < 25
                          ? 'linear-gradient(90deg,#7a110d,#e63926)'
                          : 'linear-gradient(90deg,#8c1d14,#d4471c,#e8a631)',
                    }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center font-mono text-[8px] font-extrabold text-[#fff4d6] drop-shadow">
                    HEALTH {hud?.hp ?? 950} / {hud?.maxHp ?? 950}
                  </span>
                </div>

                {/* Iconic Dark Legacy Horizontal TURBO Bar + Slim XP */}
                <div className="flex items-center gap-1.5">
                  <div className="relative h-2.5 flex-1 overflow-hidden rounded-sm border border-[#8f6a34] bg-[#21170d]">
                    <div
                      className="h-full transition-all duration-100"
                      style={{
                        width: `${turboPct}%`,
                        background:
                          turboPct >= 50
                            ? 'linear-gradient(90deg,#c96412,#f5b82e,#fff099)'
                            : 'linear-gradient(90deg,#592e0d,#945418)',
                      }}
                    />
                    <span className="absolute inset-0 flex items-center justify-center font-mono text-[8px] font-black text-white drop-shadow">
                      TURBO {turboPct}%
                    </span>
                  </div>
                  <div className="relative h-2.5 w-14 overflow-hidden rounded-sm border border-[#6e532b] bg-[#1a130c]">
                    <div className="h-full bg-[#8f67c9]" style={{ width: `${xpPct}%` }} />
                    <span className="absolute inset-0 flex items-center justify-center font-mono text-[8px] font-bold text-[#f3e6ff]">
                      XP
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* BLOCK 2: MIDWAY ARCADE COUNTERS (SCORE, GOLD, KEYS, POTIONS, RUNESTONES) */}
            <div className="grid grid-cols-5 gap-1.5 rounded-sm border border-[#694d26] bg-[#130e09] px-2.5 py-1.5 font-mono text-[11px]">
              <div className="flex flex-col items-center">
                <span className="text-[8px] font-bold text-[#a38b66]">SCORE</span>
                <span className="font-black text-[#f5e3ba]">{(hud?.score ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex flex-col items-center" title="Gold Coins">
                <span className="flex items-center gap-0.5 text-[8px] font-bold text-[#d4a54a]">
                  <Coins className="h-2.5 w-2.5" /> GOLD
                </span>
                <span className="font-black text-[#ffda75]">{(hud?.gold ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex flex-col items-center" title="Golden Keys">
                <span className="flex items-center gap-0.5 text-[8px] font-bold text-[#d9bd68]">
                  <KeyRound className="h-2.5 w-2.5" /> KEYS
                </span>
                <span className="font-black text-[#fff0a8]">{hud?.keys ?? 1}</span>
              </div>
              <div className="flex flex-col items-center" title="Elemental Magic Potions">
                <span className="flex items-center gap-0.5 text-[8px] font-bold text-[#7cc2de]">
                  <Flame className="h-2.5 w-2.5" /> POTION
                </span>
                <span className="font-black text-[#a6e6ff]">{hud?.potions ?? 2}</span>
              </div>
              <div className="flex flex-col items-center" title="Runestones Collected">
                <span className="flex items-center gap-0.5 text-[8px] font-bold text-[#9bc4e8]">
                  <Sparkles className="h-2.5 w-2.5" /> RUNES
                </span>
                <span className="font-black text-[#b5e0ff]">
                  {hud?.runestonesCollected ?? 0}/{hud?.totalRunestones ?? 13}
                </span>
              </div>
            </div>

            {/* BLOCK 3: 5 CARVED STONE CONSOLE RELIC SLOTS */}
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
                    className={`flex h-10 min-w-[54px] flex-col items-center justify-center rounded-sm border px-1.5 text-[10px] font-bold ${
                      def
                        ? 'border-[#d6a34c] bg-[#2e2216] hover:bg-[#3f2f1e] text-[#fff2d2]'
                        : 'border-[#4a3822] bg-[#16100b] text-[#6b583f] cursor-default'
                    }`}
                    title={def ? `[${idx + 1}] ${def.name}: ${def.desc}` : `Empty Relic Slot ${idx + 1}`}
                  >
                    <span className="font-mono text-[8px] text-[#a38b66]">[{idx + 1}]</span>
                    <span style={{ color: def ? def.colorHex : undefined }} className="truncate max-w-[58px]">
                      {def ? def.shortName : '—'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* BLOCK 4: BRONZE ARCADE COMBAT BUTTONS + PRECISION CONTROLS */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => engineRef.current?.triggerPrimaryAttack()}
                className="flex items-center gap-1 rounded-sm border border-[#e06a4a] bg-[#8f2418] hover:bg-[#ad2d1f] px-2.5 py-1.5 text-xs font-extrabold text-[#ffebe0]"
                title="Quick Melee Combo / Ranged Shot (Space / Click)"
              >
                <Sword className="h-3.5 w-3.5" />
                <span>Attack</span>
              </button>
              <button
                type="button"
                onClick={() => engineRef.current?.triggerHeavyAttack()}
                className="flex items-center gap-1 rounded-sm border border-[#e89c46] bg-[#9c4c14] hover:bg-[#ba5c19] px-2.5 py-1.5 text-xs font-extrabold text-[#fff2db]"
                title="Heavy 360° Fighting Attack (Shift / X / Right-Click)"
              >
                <Zap className="h-3.5 w-3.5" />
                <span>Heavy</span>
              </button>
              <button
                type="button"
                onClick={() => engineRef.current?.triggerTurboAttack()}
                disabled={(hud?.turbo ?? 0) < 50}
                className={`flex items-center gap-1 rounded-sm border px-2.5 py-1.5 text-xs font-extrabold ${
                  (hud?.turbo ?? 0) >= 50
                    ? 'border-[#ffe28a] bg-[#c98b1e] hover:bg-[#de9c26] text-[#1c1207]'
                    : 'border-[#4a3822] bg-[#241b13] text-[#7a674d] cursor-not-allowed'
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
                className={`flex items-center gap-1 rounded-sm border px-2 py-1.5 text-xs font-extrabold ${
                  (hud?.potions ?? 0) > 0
                    ? 'border-[#7ec4e8] bg-[#1e5273] hover:bg-[#276891] text-[#e0f5ff]'
                    : 'border-[#4a3822] bg-[#241b13] text-[#7a674d] cursor-not-allowed'
                }`}
                title="Elemental Magic Potion Screen Blast (Q)"
              >
                <Flame className="h-3.5 w-3.5" />
                <span>Magic</span>
              </button>
              <button
                type="button"
                onPointerDown={() => engineRef.current?.setBlocking(true)}
                onPointerUp={() => engineRef.current?.setBlocking(false)}
                onPointerLeave={() => engineRef.current?.setBlocking(false)}
                className="flex items-center gap-1 rounded-sm border border-[#a8864c] bg-[#2f2317] hover:bg-[#403020] px-2 py-1.5 text-xs font-bold text-[#f0dab0]"
                title="Hold to Block (Ctrl / C)"
              >
                <Shield className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Block</span>
              </button>

              {/* Speed, Tilt, Drain compact toggles */}
              <div className="flex items-center gap-1 pl-1">
                {(['precision', 'balanced', 'arcade'] as SpeedPreset[]).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setSpeedPreset(preset)}
                    className={`rounded-sm px-1.5 py-1 text-[10px] font-bold border ${
                      speedPreset === preset
                        ? 'border-[#e6b963] bg-[#523815] text-[#ffe9b3]'
                        : 'border-[#544027] bg-[#211811] text-[#9e8969]'
                    }`}
                  >
                    {preset === 'precision' ? '58%' : preset === 'balanced' ? '78%' : '100%'}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={toggleTilt}
                  className={`flex items-center gap-1 rounded-sm border px-1.5 py-1 text-[10px] font-bold ${
                    tiltEnabled
                      ? 'border-[#88c76b] bg-[#243819] text-[#d4f7be]'
                      : 'border-[#544027] bg-[#211811] text-[#9e8969]'
                  }`}
                  title="Toggle Accelerometer Tilt Steering"
                >
                  <Smartphone className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => engineRef.current?.toggleArcadeDrain()}
                  className={`flex items-center gap-1 rounded-sm border px-1.5 py-1 text-[10px] font-bold ${
                    hud?.arcadeDrain
                      ? 'border-[#d65c45] bg-[#4a1812] text-[#ffc4b8]'
                      : 'border-[#7bb05a] bg-[#203316] text-[#cef2b8]'
                  }`}
                  title="Toggle Arcade Health-as-Timer vs Console Explore Mode"
                >
                  <Heart className="h-3 w-3" />
                  <span className="hidden sm:inline">{hud?.arcadeDrain ? 'Drain' : 'Explore'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: SUMNER'S TOWER 9-REALM PORTAL MAP */}
      {modal === 'portals' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0d0805]/86 p-4">
          <div className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded-sm border-2 border-[#b8893d] bg-[#1a130d] shadow-[0_20px_54px_rgba(0,0,0,0.95)]">
            <div className="flex items-center justify-between border-b border-[#6e522b] bg-[#241a11] px-5 py-3">
              <div>
                <h2 className="font-serif text-lg font-black tracking-wider text-[#f5d07a] uppercase">
                  Sumner’s Tower · 9 Realms & Boss Sanctums
                </h2>
                <p className="text-xs text-[#bfa986]">
                  Collect 13 Runestones across 8 Realms to unseal the Desecrated Temple & battle Skorne!
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => engineRef.current?.toggleFreeWarp()}
                  className={`rounded-sm border px-2.5 py-1 text-xs font-bold ${
                    hud?.freeWarp
                      ? 'border-[#e6b963] bg-[#593c14] text-[#ffebb5]'
                      : 'border-[#6e522b] bg-[#291e14] text-[#d6be96]'
                  }`}
                >
                  {hud?.freeWarp ? 'Free-Warp: ON' : 'Unlock All (Free-Warp)'}
                </button>
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="rounded-sm border border-[#7d5e33] bg-[#302317] px-3 py-1 text-xs font-bold text-[#f2dfb9] hover:bg-[#402f1f]"
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
                    className={`flex flex-col justify-between rounded-sm border p-3 ${
                      unlocked
                        ? 'border-[#7a5b30] bg-[#241b13]'
                        : 'border-[#4a3720] bg-[#16100b] opacity-65'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-serif font-extrabold text-sm" style={{ color: realm.portalHex }}>
                          {realm.order}. {realm.name}
                        </span>
                        {cleared && (
                          <span className="rounded-sm bg-[#233d1b] border border-[#77ba59] px-1.5 py-0.5 text-[10px] font-bold text-[#c9f5b3]">
                            CLEARED
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-[#bba582]">{realm.subtitle}</p>
                      <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
                        <span
                          className={`rounded-sm px-1.5 py-0.5 font-semibold border ${
                            hasLeg
                              ? 'border-[#e6b963] bg-[#523712] text-[#ffebb5]'
                              : 'border-[#594327] bg-[#1a130d] text-[#a89271]'
                          }`}
                        >
                          {hasLeg ? 'Owned: ' : 'Weapon: '}
                          {realm.legendaryWeapon.name}
                        </span>
                        {!unlocked && (
                          <span className="rounded-sm border border-[#4a6f91] bg-[#162330] px-1.5 py-0.5 text-[#a3d0f7]">
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
                        className={`flex-1 rounded-sm border py-1.5 text-xs font-extrabold ${
                          unlocked
                            ? 'border-[#d6a34c] bg-[#6e4616] hover:bg-[#87561c] text-[#fff1cc]'
                            : 'border-[#4a3720] bg-[#211811] text-[#735f45] cursor-not-allowed'
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
                        className={`rounded-sm border px-2.5 py-1.5 text-xs font-extrabold ${
                          unlocked
                            ? 'border-[#db5e46] bg-[#7a1e14] hover:bg-[#96261a] text-[#ffe5de]'
                            : 'border-[#4a3720] bg-[#211811] text-[#735f45] cursor-not-allowed'
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
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0d0805]/86 p-4">
          <div className="flex max-h-[88vh] w-full max-w-4xl flex-col rounded-sm border-2 border-[#b8893d] bg-[#1a130d] shadow-[0_20px_54px_rgba(0,0,0,0.95)]">
            <div className="flex items-center justify-between border-b border-[#6e522b] bg-[#241a11] px-5 py-3">
              <div>
                <h2 className="font-serif text-lg font-black tracking-wider text-[#f5d07a] uppercase">
                  Sumner’s Hero Pedestal · 8 Core + 4 Secret Heroes × 4 Elements
                </h2>
                <p className="text-xs text-[#bfa986]">
                  Choose your Elemental Color (Fire, Ice, Lightning, Acid) and Hero Class!
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-sm border border-[#7d5e33] bg-[#302317] px-3 py-1 text-xs font-bold text-[#f2dfb9] hover:bg-[#402f1f]"
              >
                Close
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#5e4626] bg-[#201710] px-5 py-2.5">
              {/* 4 Authentic Elemental Colors */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-[#dfc8a0]">Elemental Color:</span>
                {(['red', 'blue', 'yellow', 'green'] as ElementColorId[]).map((cid) => {
                  const el = ELEMENT_COLORS[cid];
                  return (
                    <button
                      key={cid}
                      type="button"
                      onClick={() => setSelectedColorDraft(cid)}
                      className={`rounded-sm border px-2.5 py-1 text-xs font-bold ${
                        selectedColorDraft === cid
                          ? 'border-[#ffe7a3] text-white shadow'
                          : 'border-[#634a29] bg-[#1a130d] text-[#c7b18d]'
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
                  className="w-48 rounded-sm border border-[#73562d] bg-[#140e09] px-2.5 py-1 text-xs text-[#ffdf94] placeholder:text-[#826d4e] focus:border-[#e6b963] focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-sm border border-[#e3b354] bg-[#7a4b15] hover:bg-[#945c1b] px-2.5 py-1 text-xs font-bold text-[#fff1cc]"
                >
                  Enter Code
                </button>
              </form>
            </div>
            {secretCodeFeedback && (
              <div className="bg-[#4a3212] px-5 py-1.5 text-xs font-semibold text-[#ffe8ad]">
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
                    className={`flex flex-col justify-between rounded-sm border p-3 ${
                      active
                        ? 'border-[#f0c05a] bg-[#2e2216]'
                        : isSecretLocked
                          ? 'border-[#4a3720] bg-[#16100b] opacity-65'
                          : 'border-[#6e522b] bg-[#221912]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-serif font-extrabold text-sm text-[#fff0cc]">
                          {hero.name}{' '}
                          {hero.secret && (
                            <span className="ml-1 rounded-sm border border-[#b587e0] bg-[#3b2152] px-1 py-0.5 text-[9px] text-[#e7ceff]">
                              SECRET
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] font-semibold text-[#e6b963]">
                          {hero.weaponName}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-[#baa482]">{hero.desc}</p>
                      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[10px]">
                        <div className="text-[#f08c7d]">STR {hero.strength}</div>
                        <div className="text-[#96db88]">SPD {hero.speed}</div>
                        <div className="text-[#8cc8f5]">ARM {hero.armor}</div>
                        <div className="text-[#d6a3ff]">MAG {hero.magic}</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isSecretLocked}
                      onClick={() => {
                        engineRef.current?.setHeroSelection(hero.id as HeroClassId, selectedColorDraft);
                        setModal(null);
                      }}
                      className={`mt-3 w-full rounded-sm border py-1.5 text-xs font-extrabold ${
                        isSecretLocked
                          ? 'border-[#4a3720] bg-[#211811] text-[#735f45] cursor-not-allowed'
                          : 'border-[#f0c567] bg-[#8c5819] hover:bg-[#a6691e] text-[#fff4d6]'
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
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0d0805]/86 p-4">
          <div className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded-sm border-2 border-[#b8893d] bg-[#1a130d] shadow-[0_20px_54px_rgba(0,0,0,0.95)]">
            <div className="flex items-center justify-between border-b border-[#6e522b] bg-[#241a11] px-5 py-3">
              <div>
                <h2 className="font-serif text-lg font-black tracking-wider text-[#f5d07a] uppercase">
                  Sumner’s Armory & Relic Shop
                </h2>
                <p className="text-xs text-[#bfa986]">
                  Gold Available:{' '}
                  <span className="font-mono font-bold text-[#ffda75]">
                    {(hud?.gold ?? 0).toLocaleString()} G
                  </span>{' '}
                  · Permanent Stat Forging + Console Inventory Relics
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-sm border border-[#7d5e33] bg-[#302317] px-3 py-1 text-xs font-bold text-[#f2dfb9] hover:bg-[#402f1f]"
              >
                Close
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto p-4">
              {/* Permanent Stat Forging + Instant Supplies */}
              <div>
                <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-[#cfa968]">
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
                      className="flex flex-col items-start rounded-sm border border-[#6e522b] bg-[#241b13] hover:border-[#e6b963] hover:bg-[#302418] p-2.5 text-left"
                    >
                      <span className="text-xs font-bold text-[#fff1d0]">{item.label}</span>
                      <span className="text-[10px] text-[#b8a280]">{item.sub}</span>
                      <span className="mt-1.5 font-mono text-xs font-bold text-[#ffda75]">
                        {item.cost} G
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* All 10 Authentic Console Relics */}
              <div>
                <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-[#cfa968]">
                  Console Inventory Relics (Stored in Slots [1]–[5])
                </h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {RELIC_LIST.map((relic) => (
                    <button
                      key={relic.id}
                      type="button"
                      onClick={() => engineRef.current?.buyArmoryItem(relic.id)}
                      className="flex items-center justify-between gap-2 rounded-sm border border-[#6e522b] bg-[#241b13] hover:border-[#e6b963] hover:bg-[#302418] p-2.5 text-left"
                    >
                      <div>
                        <div className="text-xs font-bold" style={{ color: relic.colorHex }}>
                          {relic.name}
                        </div>
                        <div className="text-[11px] text-[#b8a280]">{relic.desc}</div>
                      </div>
                      <span className="shrink-0 rounded-sm bg-[#4a3212] border border-[#d6a34c] px-2 py-1 font-mono text-xs font-bold text-[#ffe8ad]">
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

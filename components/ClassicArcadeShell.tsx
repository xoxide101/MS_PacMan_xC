'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Compass,
  Gamepad2,
  Gauge,
  Heart,
  LayoutGrid,
  Monitor,
  Mouse,
  Music,
  Pause,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  Volume2,
  VolumeX,
  X,
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
import { arcadeMusic } from '@/lib/game/musicEngine';
import { useDeviceProfile } from '@/hooks/useDeviceProfile';
import { GameEmblem } from './MiniEmblemCanvas';
import {
  JoystickVectorState,
  VirtualActionCluster,
  VirtualJoystick,
} from './VirtualArcadePad';

const FIXED_STEP = 1 / 60;

interface ClassicArcadeShellProps {
  gameId: ClassicArcadeGameId;
  onSwitchGame: (game: GameId) => void;
  onOpenLobby: () => void;
}

interface MouseSteerTracker {
  lastX: number;
  lastY: number;
  hasLast: boolean;
  vx: number;
  vy: number;
  activeTimer: number;
  owningDir: boolean;
}

interface TiltCalibState {
  active: boolean;
  zeroBeta: number | null;
  zeroGamma: number | null;
  smoothX: number;
  smoothY: number;
}

type SpeedPreset = 'precision' | 'smooth' | 'arcade';
const SPEED_PRESET_SCALE: Record<SpeedPreset, number> = {
  precision: 0.55,
  smooth: 0.78,
  arcade: 1.0,
};
const SPEED_PRESET_LABEL: Record<SpeedPreset, string> = {
  precision: '55% Fine',
  smooth: '78% Smooth',
  arcade: '100% Fast',
};
const SPEED_STORAGE_KEY = 'arcade_move_precision_v1';

function readSpeedPreset(): SpeedPreset {
  if (typeof window === 'undefined') return 'smooth';
  try {
    const raw = window.localStorage.getItem(SPEED_STORAGE_KEY);
    if (raw === 'precision' || raw === 'smooth' || raw === 'arcade') return raw;
  } catch {
    // ignore
  }
  return 'smooth';
}

export default function ClassicArcadeShell({
  gameId,
  onSwitchGame,
  onOpenLobby,
}: ClassicArcadeShellProps) {
  const spec = CLASSIC_CABINET_SPECS[gameId];
  const cabinetMeta = CABINET_LIST.find((c) => c.id === gameId);
  const accentHex = cabinetMeta?.accentHex ?? '#38BDF8';
  const device = useDeviceProfile();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<ArcadeGameInstance | null>(null);
  const inputRef = useRef<ArcadeInputState>(createEmptyInput());
  const visualModeRef = useRef<'hd' | 'crt'>('hd');
  const mouseSteerEnabledRef = useRef<boolean>(true);
  const speedScaleRef = useRef<number>(SPEED_PRESET_SCALE.smooth);
  const rawPointerTargetRef = useRef<{ x: number; y: number; active: boolean }>({
    x: 0.5,
    y: 0.82,
    active: false,
  });
  const tiltRef = useRef<TiltCalibState>({
    active: false,
    zeroBeta: null,
    zeroGamma: null,
    smoothX: 0,
    smoothY: 0,
  });
  const mouseTrackerRef = useRef<MouseSteerTracker>({
    lastX: 0,
    lastY: 0,
    hasLast: false,
    vx: 0,
    vy: 0,
    activeTimer: 0,
    owningDir: false,
  });

  const [visualMode, setVisualMode] = useState<'hd' | 'crt'>('hd');
  const [muted, setMuted] = useState(false);
  const [musicOn, setMusicOn] = useState(() => arcadeMusic.isMusicEnabled());
  const [mouseSteerEnabled, setMouseSteerEnabled] = useState(true);
  const [speedPreset, setSpeedPreset] = useState<SpeedPreset>(() => readSpeedPreset());
  const [tiltEnabled, setTiltEnabled] = useState(false);
  const [padOverride, setPadOverride] = useState<'auto' | 'show' | 'hide'>('auto');
  const [railQuery, setRailQuery] = useState('');
  const [canvasDims, setCanvasDims] = useState<{ w: number; h: number }>({ w: 720, h: 816 });
  const [actionLabel, setActionLabel] = useState('Fire');
  const [secondaryLabel, setSecondaryLabel] = useState<string | undefined>(undefined);
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
    const scale = SPEED_PRESET_SCALE[speedPreset];
    speedScaleRef.current = scale;
    inputRef.current.moveScale = scale;
    try {
      window.localStorage.setItem(SPEED_STORAGE_KEY, speedPreset);
    } catch {
      // ignore
    }
  }, [speedPreset]);

  useEffect(() => {
    mouseSteerEnabledRef.current = mouseSteerEnabled;
    if (!mouseSteerEnabled && mouseTrackerRef.current.owningDir) {
      mouseTrackerRef.current.activeTimer = 0;
      mouseTrackerRef.current.owningDir = false;
      inputRef.current.left = false;
      inputRef.current.right = false;
      inputRef.current.up = false;
      inputRef.current.down = false;
      inputRef.current.analogX = 0;
      inputRef.current.analogY = 0;
    }
  }, [mouseSteerEnabled]);

  // Device Accelerometer / Orientation Tilt Steering for on-screen precision!
  useEffect(() => {
    tiltRef.current.active = tiltEnabled;
    inputRef.current.tiltActive = tiltEnabled;
    if (!tiltEnabled) {
      tiltRef.current.zeroBeta = null;
      tiltRef.current.zeroGamma = null;
      tiltRef.current.smoothX = 0;
      tiltRef.current.smoothY = 0;
      inputRef.current.analogX = 0;
      inputRef.current.analogY = 0;
      inputRef.current.left = false;
      inputRef.current.right = false;
      inputRef.current.up = false;
      inputRef.current.down = false;
      return;
    }

    const onOrientation = (ev: DeviceOrientationEvent) => {
      if (ev.beta === null || ev.gamma === null) return;
      const t = tiltRef.current;
      // Map tilt axes cleanly for portrait and landscape orientations
      const angle =
        typeof window.screen !== 'undefined' && window.screen.orientation
          ? window.screen.orientation.angle
          : 0;
      let rawX = ev.gamma;
      let rawY = ev.beta;
      if (angle === 90) {
        rawX = ev.beta;
        rawY = -ev.gamma;
      } else if (angle === -90 || angle === 270) {
        rawX = -ev.beta;
        rawY = ev.gamma;
      }

      if (t.zeroBeta === null || t.zeroGamma === null) {
        t.zeroGamma = rawX;
        t.zeroBeta = rawY;
      }

      const dX = rawX - t.zeroGamma;
      const dY = rawY - t.zeroBeta;
      const deadDeg = 3.8;
      const maxDeg = 24;

      const shapeAxis = (deg: number): number => {
        const abs = Math.abs(deg);
        if (abs <= deadDeg) return 0;
        const norm = Math.min(1, (abs - deadDeg) / (maxDeg - deadDeg));
        return Math.sign(deg) * Math.pow(norm, 1.35);
      };

      const targetX = shapeAxis(dX);
      const targetY = shapeAxis(dY);
      // Smooth low-pass filter to eliminate hand jitter
      t.smoothX += (targetX - t.smoothX) * 0.22;
      t.smoothY += (targetY - t.smoothY) * 0.22;

      const scale = speedScaleRef.current;
      inputRef.current.analogX = t.smoothX;
      inputRef.current.analogY = t.smoothY;
      inputRef.current.tiltActive = true;

      // Also drive directional keys cleanly for non-analog games
      inputRef.current.left = t.smoothX < -0.18;
      inputRef.current.right = t.smoothX > 0.18;
      inputRef.current.up = t.smoothY < -0.18;
      inputRef.current.down = t.smoothY > 0.18;

      // For pointer-aim games, smoothly glide the virtual on-screen pointer via tilt!
      const inst = gameRef.current;
      if (inst?.supportsPointerAim) {
        const step = 0.022 * scale;
        rawPointerTargetRef.current.active = true;
        rawPointerTargetRef.current.x = Math.max(0.03, Math.min(0.97, rawPointerTargetRef.current.x + t.smoothX * step));
        rawPointerTargetRef.current.y = Math.max(0.05, Math.min(0.96, rawPointerTargetRef.current.y + t.smoothY * step));
        inputRef.current.pointerActive = true;
      }
    };

    window.addEventListener('deviceorientation', onOrientation, true);
    return () => {
      window.removeEventListener('deviceorientation', onOrientation, true);
    };
  }, [tiltEnabled]);

  useEffect(() => {
    arcadeAudio.stopAmbient();
    const instance = createClassicArcadeGame(gameId);
    gameRef.current = instance;
    inputRef.current = createEmptyInput();
    mouseTrackerRef.current = {
      lastX: 0,
      lastY: 0,
      hasLast: false,
      vx: 0,
      vy: 0,
      activeTimer: 0,
      owningDir: false,
    };

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

    const syncInitial = () => {
      setCanvasDims({ w: instance.logicalWidth, h: instance.logicalHeight });
      setActionLabel(instance.primaryActionLabel);
      setSecondaryLabel(instance.secondaryActionLabel);
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
        // Decay universal mouse-move steering vector cleanly when mouse stops
        const mt = mouseTrackerRef.current;
        if (mt.activeTimer > 0) {
          mt.activeTimer = Math.max(0, mt.activeTimer - FIXED_STEP);
          mt.vx *= 0.8;
          mt.vy *= 0.8;
          if (mt.owningDir) {
            inputRef.current.analogX = mt.vx;
            inputRef.current.analogY = mt.vy;
          }
          if (mt.activeTimer <= 0 && mt.owningDir) {
            mt.owningDir = false;
            mt.vx = 0;
            mt.vy = 0;
            inputRef.current.left = false;
            inputRef.current.right = false;
            inputRef.current.up = false;
            inputRef.current.down = false;
            inputRef.current.analogX = 0;
            inputRef.current.analogY = 0;
          }
        }

        // Velocity-damped pointer smoothing for silky on-screen accuracy!
        const scale = speedScaleRef.current;
        inputRef.current.moveScale = scale;
        if (rawPointerTargetRef.current.active && inputRef.current.pointerActive) {
          const smoothAlpha = Math.min(0.68, 0.16 + scale * 0.34);
          inputRef.current.pointerX += (rawPointerTargetRef.current.x - inputRef.current.pointerX) * smoothAlpha;
          inputRef.current.pointerY += (rawPointerTargetRef.current.y - inputRef.current.pointerY) * smoothAlpha;
        }

        instance.setInput({ ...inputRef.current });
        inputRef.current.fireJustPressed = false;
        inputRef.current.secondaryJustPressed = false;
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
      arcadeMusic.stop();
    };
  }, [gameId]);

  // Synchronize simulated arcade BGM with active play state
  useEffect(() => {
    if (hud.phase === 'PLAYING' || hud.phase === 'READY') {
      arcadeMusic.startTrackForGame(gameId);
    } else {
      arcadeMusic.pause();
    }
  }, [gameId, hud.phase]);

  // Keyboard controls
  useEffect(() => {
    const clearMouseSteerOwnership = () => {
      mouseTrackerRef.current.activeTimer = 0;
      mouseTrackerRef.current.owningDir = false;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
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
          arcadeMusic.startTrackForGame(gameId);
          inst.startNewGame();
          setHud(inst.getHudSnapshot());
          return;
        }
      }

      if (code === 'ArrowLeft' || code === 'KeyA') {
        clearMouseSteerOwnership();
        inputRef.current.left = true;
        inputRef.current.pointerActive = false;
      }
      if (code === 'ArrowRight' || code === 'KeyD') {
        clearMouseSteerOwnership();
        inputRef.current.right = true;
        inputRef.current.pointerActive = false;
      }
      if (code === 'ArrowUp' || code === 'KeyW') {
        clearMouseSteerOwnership();
        inputRef.current.up = true;
        inputRef.current.pointerActive = false;
        if (gameId === 'invaders' || gameId === 'invaders2' || gameId === 'invadersdx') {
          if (!inputRef.current.fire) inputRef.current.fireJustPressed = true;
          inputRef.current.fire = true;
        }
      }
      if (code === 'ArrowDown' || code === 'KeyS') {
        clearMouseSteerOwnership();
        inputRef.current.down = true;
        inputRef.current.pointerActive = false;
      }
      if (code === 'Space' || code === 'KeyZ' || code === 'KeyJ') {
        const snap = inst.getHudSnapshot();
        if (snap.phase === 'TITLE' || snap.phase === 'GAME_OVER') {
          arcadeAudio.unlock();
          arcadeMusic.startTrackForGame(gameId);
          inst.startNewGame();
          setHud(inst.getHudSnapshot());
          return;
        }
        if (!inputRef.current.fire) {
          inputRef.current.fireJustPressed = true;
        }
        inputRef.current.fire = true;
      }
      if (
        code === 'ShiftLeft' ||
        code === 'ShiftRight' ||
        code === 'KeyX' ||
        code === 'KeyK' ||
        code === 'KeyC'
      ) {
        if (!inputRef.current.secondary) {
          inputRef.current.secondaryJustPressed = true;
        }
        inputRef.current.secondary = true;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === 'ArrowLeft' || code === 'KeyA') inputRef.current.left = false;
      if (code === 'ArrowRight' || code === 'KeyD') inputRef.current.right = false;
      if (code === 'ArrowUp' || code === 'KeyW') {
        inputRef.current.up = false;
        if (gameId === 'invaders' || gameId === 'invaders2' || gameId === 'invadersdx') {
          inputRef.current.fire = false;
        }
      }
      if (code === 'ArrowDown' || code === 'KeyS') inputRef.current.down = false;
      if (code === 'Space' || code === 'KeyZ' || code === 'KeyJ') inputRef.current.fire = false;
      if (
        code === 'ShiftLeft' ||
        code === 'ShiftRight' ||
        code === 'KeyX' ||
        code === 'KeyK' ||
        code === 'KeyC'
      ) {
        inputRef.current.secondary = false;
      }
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
    arcadeMusic.startTrackForGame(gameId);
    const inst = gameRef.current;
    if (!inst) return;
    inst.startNewGame();
    setHud(inst.getHudSnapshot());
  }, [gameId]);

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
      arcadeMusic.setMuted(next);
      return next;
    });
  }, []);

  const handleToggleMusic = useCallback(() => {
    setMusicOn((prev) => {
      const next = !prev;
      arcadeMusic.setMusicEnabled(next);
      if (next && (hud.phase === 'PLAYING' || hud.phase === 'READY')) {
        arcadeMusic.startTrackForGame(gameId);
      }
      return next;
    });
  }, [gameId, hud.phase]);

  // Universal Mouse & Direct Touch Pointer Handler on Canvas
  const handleCanvasPointer = useCallback(
    (
      e: React.PointerEvent<HTMLCanvasElement>,
      kind: 'move' | 'down' | 'up' | 'leave'
    ) => {
      const inst = gameRef.current;
      const canvas = canvasRef.current;
      if (!inst || !canvas) return;

      const isMouse = e.pointerType === 'mouse' || e.pointerType === 'pen';
      const rect = canvas.getBoundingClientRect();
      const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
      const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / Math.max(1, rect.height)));

      // 1. Direct pointer-aim games with velocity-damped smoothing for crisp on-screen accuracy
      if (inst.supportsPointerAim) {
        if (kind === 'move' || kind === 'down') {
          rawPointerTargetRef.current.active = true;
          rawPointerTargetRef.current.x = nx;
          rawPointerTargetRef.current.y = ny;
          if (!inputRef.current.pointerActive || kind === 'down') {
            inputRef.current.pointerX = nx;
            inputRef.current.pointerY = ny;
          }
          inputRef.current.pointerActive = true;
        }
      } else if (mouseSteerEnabledRef.current && (isMouse || kind === 'move' || kind === 'down')) {
        // 2. Refined Universal Mouse Movement Steering with precision scaling & clean deadzone
        const mt = mouseTrackerRef.current;
        if (kind === 'leave') {
          mt.hasLast = false;
          mt.activeTimer = 0;
          if (mt.owningDir) {
            mt.owningDir = false;
            inputRef.current.left = false;
            inputRef.current.right = false;
            inputRef.current.up = false;
            inputRef.current.down = false;
            inputRef.current.analogX = 0;
            inputRef.current.analogY = 0;
          }
        } else if (kind === 'move' && (isMouse || e.buttons > 0)) {
          if (mt.hasLast) {
            const dx = e.clientX - mt.lastX;
            const dy = e.clientY - mt.lastY;
            const dist = Math.hypot(dx, dy);
            if (dist >= 2.0) {
              const sens = 0.095 * speedScaleRef.current;
              mt.vx = Math.max(-1, Math.min(1, mt.vx * 0.45 + dx * sens));
              mt.vy = Math.max(-1, Math.min(1, mt.vy * 0.45 + dy * sens));
              mt.activeTimer = 0.12;
              mt.owningDir = true;

              const mag = Math.hypot(mt.vx, mt.vy);
              inputRef.current.analogX = mt.vx;
              inputRef.current.analogY = mt.vy;
              if (mag >= 0.22) {
                const deg = (Math.atan2(mt.vy, mt.vx) * 180) / Math.PI;
                inputRef.current.up = deg >= -157.5 && deg <= -22.5;
                inputRef.current.down = deg >= 22.5 && deg <= 157.5;
                inputRef.current.right = deg >= -67.5 && deg <= 67.5;
                inputRef.current.left = deg >= 112.5 || deg <= -112.5;
              }
            }
          }
          mt.lastX = e.clientX;
          mt.lastY = e.clientY;
          mt.hasLast = true;
        } else if (kind === 'down') {
          mt.lastX = e.clientX;
          mt.lastY = e.clientY;
          mt.hasLast = true;
        }
      }

      // 3. Mouse & Touch Button Actions (Left = Fire/Action, Right = Secondary/Superzapper/Bomb, Middle = Up/Parry)
      if (kind === 'down') {
        arcadeAudio.unlock();
        if (isMouse && e.button === 2) {
          if (!inputRef.current.secondary) inputRef.current.secondaryJustPressed = true;
          inputRef.current.secondary = true;
        } else if (isMouse && e.button === 1) {
          inputRef.current.up = true;
        } else if (isMouse || inst.supportsPointerAim) {
          if (!inputRef.current.fire) inputRef.current.fireJustPressed = true;
          inputRef.current.fire = true;
        }
      } else if (kind === 'up' || kind === 'leave') {
        if (isMouse && e.button === 2) {
          inputRef.current.secondary = false;
        } else if (isMouse && e.button === 1) {
          inputRef.current.up = false;
        } else {
          inputRef.current.fire = false;
          if (kind === 'leave') {
            inputRef.current.secondary = false;
          }
        }
      }
    },
    []
  );

  // Virtual Joystick 8-way + smooth proportional analog handler
  const handleJoystickVector = useCallback((vec: JoystickVectorState) => {
    arcadeAudio.unlock();
    mouseTrackerRef.current.activeTimer = 0;
    mouseTrackerRef.current.owningDir = false;
    inputRef.current.pointerActive = false;
    inputRef.current.up = vec.up;
    inputRef.current.down = vec.down;
    inputRef.current.left = vec.left;
    inputRef.current.right = vec.right;
    inputRef.current.analogX = vec.dx;
    inputRef.current.analogY = vec.dy;
  }, []);

  const handleCycleSpeedPreset = useCallback(() => {
    setSpeedPreset((prev) =>
      prev === 'precision' ? 'smooth' : prev === 'smooth' ? 'arcade' : 'precision'
    );
  }, []);

  const handleToggleTilt = useCallback(async () => {
    if (tiltEnabled) {
      setTiltEnabled(false);
      return;
    }
    try {
      const DevOrient = window.DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<'granted' | 'denied'>;
      };
      if (DevOrient && typeof DevOrient.requestPermission === 'function') {
        const res = await DevOrient.requestPermission();
        if (res !== 'granted') return;
      }
    } catch {
      // Proceed on browsers that do not require permission prompt
    }
    tiltRef.current.zeroBeta = null;
    tiltRef.current.zeroGamma = null;
    setTiltEnabled(true);
  }, [tiltEnabled]);

  const handleRecenterTilt = useCallback(() => {
    tiltRef.current.zeroBeta = null;
    tiltRef.current.zeroGamma = null;
    tiltRef.current.smoothX = 0;
    tiltRef.current.smoothY = 0;
  }, []);

  const setTouchFire = useCallback((active: boolean) => {
    arcadeAudio.unlock();
    if (active && !inputRef.current.fire) {
      inputRef.current.fireJustPressed = true;
    }
    inputRef.current.fire = active;
  }, []);

  const setTouchSecondary = useCallback((active: boolean) => {
    arcadeAudio.unlock();
    if (active && !inputRef.current.secondary) {
      inputRef.current.secondaryJustPressed = true;
    }
    inputRef.current.secondary = active;
  }, []);

  // Determine effective On-Screen Pad Layout across standard phones, flip phones, Pixel Fold, Samsung tablets, iPads, Windows PCs
  const effectivePadLayout =
    padOverride === 'hide'
      ? 'hidden'
      : padOverride === 'show'
      ? device.isLandscape && device.width >= 600
        ? 'side-flanks'
        : 'bottom-deck'
      : device.recommendedPadLayout;

  const padVisible = effectivePadLayout !== 'hidden';
  const showDesktopRails = !padVisible && device.width >= 1024;
  const isSideFlanks = effectivePadLayout === 'side-flanks';
  const isFlipCover = device.formFactor === 'flip-cover';
  const isFlexFold = device.formFactor === 'fold-flex';

  const joystickSize = isFlipCover
    ? 86
    : device.formFactor === 'phone-landscape'
    ? 104
    : device.formFactor === 'phone-portrait'
    ? 114
    : 130;

  const canvasMaxHeight = isSideFlanks
    ? device.compactUi
      ? 'calc(100dvh - 64px)'
      : 'calc(100dvh - 88px)'
    : padVisible
    ? isFlipCover
      ? 'calc(100dvh - 168px)'
      : isFlexFold
      ? '44dvh'
      : device.formFactor === 'phone-portrait'
      ? 'calc(100dvh - 216px)'
      : 'calc(100dvh - 238px)'
    : 'calc(100dvh - 118px)';

  const handleTogglePad = useCallback(() => {
    setPadOverride((prev) => {
      if (prev === 'auto') return padVisible ? 'hide' : 'show';
      return prev === 'show' ? 'hide' : 'show';
    });
  }, [padVisible]);

  const normQuery = railQuery.trim().toLowerCase();
  const filteredRail = normQuery
    ? CABINET_LIST.filter(
        (c) =>
          c.title.toLowerCase().includes(normQuery) ||
          String(c.year).includes(normQuery) ||
          c.tagline.toLowerCase().includes(normQuery)
      )
    : CABINET_LIST;

  const platformerCabinets = filteredRail.filter((c) => c.category === 'platformers');
  const shooterCabinets = filteredRail.filter((c) => c.category === 'shooters');
  const actionCabinets = filteredRail.filter((c) => c.category === 'action');
  const puzzleCabinets = filteredRail.filter((c) => c.category === 'puzzle');
  const racingCabinets = filteredRail.filter((c) => c.category === 'racing');
  const rpgCabinets = filteredRail.filter((c) => c.category === 'rpg');
  const pacCabinets = filteredRail.filter((c) => c.category === 'pacman');
  const isWide = canvasDims.w > canvasDims.h;
  const trackTitle = arcadeMusic.getTrackTitle(gameId);

  const restartStageLabel =
    gameId === 'boulderdash'
      ? 'Retry Cave (R)'
      : gameId === 'gauntlet' || gameId === 'gauntlet2' || gameId === 'gauntletdl'
      ? 'Swap Hero (R)'
      : gameId === 'smb2'
      ? 'Switch Hero (R)'
      : gameId === 'sonic3'
      ? 'Switch Hero (R)'
      : gameId === 'superbreakout'
      ? 'Cycle Mode (R)'
      : gameId === 'spaceduel'
      ? 'Toggle Wingman (R)'
      : gameId === 'rampage'
      ? 'Switch Monster (R)'
      : 'Mode (R)';

  const handleRestartStageAction = useCallback(() => {
    gameRef.current?.restartStage?.();
    if (gameRef.current) setHud(gameRef.current.getHudSnapshot());
  }, []);

  return (
    <div className="min-h-[100dvh] w-full bg-[#060811] text-slate-100 flex flex-col overflow-x-clip">
      {/* Adaptive Compact Top Bar */}
      <header className="w-full border-b border-white/[0.07] bg-[#080B16]/90 backdrop-blur-md safe-top-pad shrink-0">
        <div
          className={`mx-auto max-w-[1440px] px-2.5 sm:px-6 flex items-center justify-between gap-2 sm:gap-4 ${
            device.compactUi ? 'h-11' : 'h-13 sm:h-14'
          }`}
        >
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={onOpenLobby}
              className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.09] text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              aria-label="All 94 Cabinets"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden xs:inline sm:inline">All 94</span>
              <span className="hidden md:inline">Cabinets</span>
            </button>
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <GameEmblem gameId={gameId} size={device.compactUi ? 20 : 24} />
              <span
                className={`text-sm sm:text-base font-bold tracking-tight truncate ${spec.accentTextClass}`}
                style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
              >
                {spec.title}
              </span>
              <span className="hidden md:inline text-xs text-slate-500 whitespace-nowrap">
                {spec.year} · {spec.publisher}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Precision Speed Control (Fine 55% / Smooth 78% / Fast 100%) */}
            <button
              type="button"
              onClick={handleCycleSpeedPreset}
              className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                speedPreset === 'precision'
                  ? 'border-amber-400/45 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25'
                  : speedPreset === 'smooth'
                  ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25'
                  : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.09]'
              }`}
              title="Cycle Control Speed & Pointer Precision (55% Fine / 78% Smooth / 100% Arcade)"
              aria-label={`Control speed: ${SPEED_PRESET_LABEL[speedPreset]}`}
            >
              <Gauge className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{SPEED_PRESET_LABEL[speedPreset]}</span>
            </button>

            {/* Accelerometer / Device Tilt Steering */}
            <button
              type="button"
              onClick={handleToggleTilt}
              className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                tiltEnabled
                  ? 'border-violet-400/50 bg-violet-500/20 text-violet-200 hover:bg-violet-500/30'
                  : 'border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.09]'
              }`}
              title="Toggle Accelerometer / Device Tilt Steering"
              aria-label={tiltEnabled ? 'Disable tilt steering' : 'Enable tilt steering'}
            >
              <Compass className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">{tiltEnabled ? 'Tilt On' : 'Tilt'}</span>
            </button>
            {tiltEnabled && (
              <button
                type="button"
                onClick={handleRecenterTilt}
                className="inline-flex items-center gap-1 px-1.5 py-1.5 rounded-lg border border-violet-400/35 bg-violet-500/10 text-[11px] font-medium text-violet-200 hover:bg-violet-500/20 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Recenter Tilt Neutral Angle"
                aria-label="Recenter tilt angle"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}

            {/* Mouse Steering Toggle (Desktop, iPad/Tab with Mouse) */}
            <button
              type="button"
              onClick={() => setMouseSteerEnabled((v) => !v)}
              className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mouseSteerEnabled
                  ? 'border-sky-400/40 bg-sky-500/15 text-sky-200 hover:bg-sky-500/25'
                  : 'border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.09]'
              }`}
              title="Toggle Mouse Movement Steering & Click Actions"
              aria-label={mouseSteerEnabled ? 'Disable mouse movement' : 'Enable mouse movement'}
            >
              <Mouse className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">{mouseSteerEnabled ? 'Mouse On' : 'Mouse Off'}</span>
            </button>

            {/* On-Screen Virtual Joystick Toggle */}
            <button
              type="button"
              onClick={handleTogglePad}
              className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                padVisible
                  ? 'border-pink-400/40 bg-pink-500/15 text-pink-200 hover:bg-pink-500/25'
                  : 'border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.09]'
              }`}
              title="Toggle On-Screen Virtual Joystick & Arcade Buttons"
              aria-label={padVisible ? 'Hide on-screen joystick' : 'Show on-screen joystick'}
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">{padVisible ? 'Joystick On' : 'Joystick'}</span>
            </button>

            <button
              type="button"
              onClick={() => setVisualMode((v) => (v === 'hd' ? 'crt' : 'hd'))}
              className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.09] text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Toggle HD Vector or CRT Scanlines"
            >
              {visualMode === 'hd' ? <Sparkles className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />}
              <span className="hidden xl:inline">{visualMode === 'hd' ? 'Vector HD' : 'CRT Mode'}</span>
            </button>

            <button
              type="button"
              onClick={handleToggleMusic}
              className={`inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                musicOn && !muted
                  ? 'border-emerald-400/35 bg-emerald-500/12 text-emerald-200 hover:bg-emerald-500/20'
                  : 'border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.09]'
              }`}
              title={`Simulated BGM: ${trackTitle}`}
              aria-label={musicOn ? 'Disable background music' : 'Enable background music'}
            >
              <Music className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">{musicOn ? 'Music On' : 'Music Off'}</span>
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
                className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.09] text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {hud.phase === 'PAUSED' ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{hud.phase === 'PAUSED' ? 'Resume' : 'Pause'}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Adaptive Workspace */}
      <main
        className={`flex-1 w-full mx-auto max-w-[1440px] flex ${
          showDesktopRails
            ? 'px-4 sm:px-6 py-4 sm:py-6 flex-row items-start justify-center gap-5'
            : isSideFlanks
            ? 'px-2 sm:px-4 py-1.5 sm:py-3 flex-row items-center justify-between gap-2 sm:gap-4'
            : 'px-2.5 sm:px-5 py-2 sm:py-4 flex-col items-center justify-between gap-2 sm:gap-4 safe-bottom-pad'
        }`}
      >
        {/* Desktop Left Rail: Full 87-Cabinet Switcher */}
        {showDesktopRails && (
          <aside className="flex flex-col w-[236px] shrink-0 rounded-2xl bg-[#0B0F1D] border border-white/[0.08] p-3 max-h-[calc(100dvh-108px)] overflow-y-auto">
            <div className="relative mb-2.5">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={railQuery}
                onChange={(e) => setRailQuery(e.target.value)}
                placeholder="Filter 94 games..."
                aria-label="Filter cabinets"
                className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-white/25"
              />
              {railQuery && (
                <button
                  type="button"
                  onClick={() => setRailQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  aria-label="Clear filter"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {[
              { label: 'Platformers', items: platformerCabinets },
              { label: 'Shooters & Vector', items: shooterCabinets },
              { label: 'Action & Arcade', items: actionCabinets },
              { label: 'Puzzle & Breakers', items: puzzleCabinets },
              { label: 'Arcade Racing', items: racingCabinets },
              { label: 'RPG & Strategy', items: rpgCabinets },
              { label: 'Pac-Man Series', items: pacCabinets },
            ]
              .filter((g) => g.items.length > 0)
              .map((group, gIdx) => (
                <div key={group.label} className={gIdx > 0 ? 'pt-2 border-t border-white/[0.07]' : ''}>
                  <div className="text-[11px] font-semibold text-slate-400 px-2 pt-1 pb-1.5">
                    {group.label}
                  </div>
                  <div className="space-y-0.5 mb-2.5">
                    {group.items.map((cab) => {
                      const active = cab.id === gameId;
                      return (
                        <button
                          key={cab.id}
                          type="button"
                          onClick={() => onSwitchGame(cab.id)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-left text-xs font-medium transition-colors cursor-pointer ${
                            active
                              ? 'bg-white/[0.11] text-white'
                              : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-100'
                          }`}
                        >
                          <GameEmblem gameId={cab.id} size={18} />
                          <span className="truncate flex-1">{cab.title}</span>
                          <span className="text-[10px] font-mono text-slate-500">{cab.year}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
          </aside>
        )}

        {/* Handheld / Tablet / Unfolded Landscape LEFT FLANK: Virtual Joystick */}
        {isSideFlanks && (
          <div className="flex flex-col items-center justify-center shrink-0 pl-1 sm:pl-2">
            <div className="mb-2 text-center">
              <div className="text-[10px] text-slate-400">SCORE</div>
              <div className="font-mono tabular-nums text-xs sm:text-sm font-bold text-white">
                {hud.score.toLocaleString()}
              </div>
            </div>
            <VirtualJoystick
              mode="8way"
              size={joystickSize}
              accentColor={accentHex}
              onVectorChange={handleJoystickVector}
            />
          </div>
        )}

        {/* Center Arcade Monitor Stage */}
        <section
          className={`flex-1 flex flex-col items-center justify-center w-full min-w-0 ${
            isFlexFold ? 'fold-flex-stage' : ''
          }`}
        >
          {/* Compact Score Strip on Portrait / Fold / Non-Desktop */}
          {!showDesktopRails && !isSideFlanks && (
            <div className="flex w-full max-w-[640px] items-center justify-between px-3 py-1.5 mb-1.5 rounded-xl bg-[#0B0F1D] border border-white/[0.08] text-xs">
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
                {Array.from({ length: Math.min(5, Math.max(0, hud.lives)) }).map((_, i) => (
                  <Heart key={i} className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                ))}
              </div>
            </div>
          )}

          {/* HiDPI Game Canvas Container */}
          <div
            className="relative rounded-2xl overflow-hidden bg-[#04060B] border border-white/[0.1] shadow-2xl select-none touch-none"
            style={{
              width: isSideFlanks ? 'auto' : '100%',
              height: isSideFlanks ? canvasMaxHeight : 'auto',
              maxWidth: isSideFlanks ? '100%' : isWide ? '840px' : '640px',
              maxHeight: canvasMaxHeight,
              aspectRatio: `${canvasDims.w} / ${canvasDims.h}`,
            }}
          >
            <canvas
              ref={canvasRef}
              onPointerMove={(e) => handleCanvasPointer(e, 'move')}
              onPointerDown={(e) => handleCanvasPointer(e, 'down')}
              onPointerUp={(e) => handleCanvasPointer(e, 'up')}
              onPointerCancel={(e) => handleCanvasPointer(e, 'up')}
              onPointerLeave={(e) => handleCanvasPointer(e, 'leave')}
              onContextMenu={(e) => e.preventDefault()}
              className="w-full h-full block cursor-crosshair"
            />

            {/* Title Overlay */}
            {hud.phase === 'TITLE' && (
              <div className="absolute inset-0 bg-[#050812]/74 backdrop-blur-[2px] flex flex-col items-center justify-center p-4 sm:p-6 text-center overflow-y-auto">
                <div className="max-w-sm w-full space-y-3 sm:space-y-5">
                  <div className="flex flex-col items-center gap-2 sm:gap-3">
                    <GameEmblem gameId={gameId} size={isFlipCover ? 36 : 54} />
                    <h1
                      className={`font-extrabold tracking-tight ${spec.accentTextClass} ${
                        isFlipCover ? 'text-2xl' : 'text-3xl sm:text-5xl'
                      }`}
                      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                    >
                      {spec.title}
                    </h1>
                    {!isFlipCover && (
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed line-clamp-3">
                        {spec.subtitle}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={handleStart}
                      className={`w-full py-3 sm:py-3.5 px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer ${spec.accentButtonClass}`}
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Start {spec.title}</span>
                    </button>
                    <p className="text-[11px] sm:text-xs text-slate-400">
                      {padVisible
                        ? 'Use On-Screen Joystick + Action Buttons or tap screen'
                        : 'Move Mouse & Click · or Arrows / WASD + Space / Shift'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Pause Overlay */}
            {hud.phase === 'PAUSED' && (
              <div className="absolute inset-0 bg-[#050812]/78 backdrop-blur-xs flex flex-col items-center justify-center p-4 sm:p-6 text-center">
                <div className="max-w-xs w-full space-y-3 sm:space-y-4">
                  <h2
                    className="text-2xl sm:text-3xl font-extrabold text-white"
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
              <div className="absolute inset-0 bg-[#050812]/82 backdrop-blur-xs flex flex-col items-center justify-center p-4 sm:p-6 text-center">
                <div className="max-w-xs w-full space-y-4">
                  <div className="space-y-1">
                    <h2
                      className="text-3xl sm:text-4xl font-extrabold text-rose-400"
                      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                    >
                      Game Over
                    </h2>
                    <p className="text-xs text-slate-400">{hud.stageName}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 py-2.5 border-y border-white/[0.08]">
                    <div>
                      <div className="text-[11px] text-slate-400">Final Score</div>
                      <div className="font-mono tabular-nums text-lg sm:text-xl font-bold text-white">
                        {hud.score.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400">High Score</div>
                      <div className={`font-mono tabular-nums text-lg sm:text-xl font-bold ${spec.accentTextClass}`}>
                        {hud.highScore.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleStart}
                    className={`w-full py-3 px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer ${spec.accentButtonClass}`}
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Play Again</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Portrait / Flip / Unfolded Square / Flex Mode BOTTOM DECK: Virtual Joystick + Action Buttons */}
          {effectivePadLayout === 'bottom-deck' && (
            <div
              className={`w-full max-w-[540px] flex items-center justify-between gap-3 px-2 pt-2 pb-1 select-none touch-none ${
                isFlexFold ? 'fold-flex-deck' : ''
              }`}
            >
              <VirtualJoystick
                mode="8way"
                size={joystickSize}
                accentColor={accentHex}
                onVectorChange={handleJoystickVector}
              />

              <VirtualActionCluster
                compact={isFlipCover}
                primaryLabel={actionLabel}
                secondaryLabel={secondaryLabel}
                accentButtonClass={spec.accentButtonClass}
                onPrimaryChange={setTouchFire}
                onSecondaryChange={secondaryLabel ? setTouchSecondary : undefined}
                onModeTap={hud.canRestartStage ? handleRestartStageAction : undefined}
                modeTapLabel={hud.canRestartStage ? restartStageLabel : undefined}
              />
            </div>
          )}
        </section>

        {/* Handheld / Tablet / Unfolded Landscape RIGHT FLANK: Action Buttons */}
        {isSideFlanks && (
          <div className="flex flex-col items-center justify-center shrink-0 pr-1 sm:pr-2 gap-2.5">
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, Math.max(0, hud.lives)) }).map((_, i) => (
                <Heart key={i} className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
              ))}
            </div>
            <VirtualActionCluster
              compact={device.compactUi}
              primaryLabel={actionLabel}
              secondaryLabel={secondaryLabel}
              accentButtonClass={spec.accentButtonClass}
              onPrimaryChange={setTouchFire}
              onSecondaryChange={secondaryLabel ? setTouchSecondary : undefined}
              onModeTap={hud.canRestartStage ? handleRestartStageAction : undefined}
              modeTapLabel={hud.canRestartStage ? restartStageLabel : undefined}
            />
          </div>
        )}

        {/* Desktop Right Rail: Live Telemetry & Controls */}
        {showDesktopRails && (
          <aside className="w-[272px] shrink-0 rounded-2xl bg-[#0B0F1D] border border-white/[0.08] p-5 space-y-5">
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
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400 shrink-0">Soundtrack</span>
                <span className="font-medium text-emerald-300/90 truncate text-right">
                  {trackTitle}
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-col gap-2 pt-4 border-t border-white/[0.07]">
              {hud.canRestartStage && (hud.phase === 'PLAYING' || hud.phase === 'PAUSED') && (
                <button
                  type="button"
                  onClick={handleRestartStageAction}
                  className="w-full py-2 px-3 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.09] text-xs font-medium text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{restartStageLabel}</span>
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
                <li className="flex items-start justify-between gap-2">
                  <span className="font-mono text-[11px] text-sky-300 shrink-0">Mouse Move</span>
                  <span className="text-slate-400 text-right">Steer / Aim + L/R Click</span>
                </li>
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
        )}
      </main>
    </div>
  );
}

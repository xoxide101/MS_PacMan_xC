'use client';

import { useCallback, useRef, useState } from 'react';
import { Gamepad2, Mouse } from 'lucide-react';
import { Direction } from '@/lib/game/types';
import { useDeviceProfile } from '@/hooks/useDeviceProfile';
import {
  JoystickVectorState,
  VirtualActionCluster,
  VirtualJoystick,
} from './VirtualArcadePad';

export interface PacManAdaptiveControls {
  mouseSteerEnabled: boolean;
  toggleMouseSteer: () => void;
  padVisible: boolean;
  isSideFlanks: boolean;
  isFlexFold: boolean;
  isFlipCover: boolean;
  joystickSize: number;
  canvasHeightCss: string;
  togglePad: () => void;
  handleJoystickVector: (vec: JoystickVectorState) => void;
  canvasMouseHandlers: {
    onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
    onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
    onPointerUp: (e: React.PointerEvent<HTMLCanvasElement>) => void;
    onPointerLeave: () => void;
    onContextMenu: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  };
}

interface UsePacManAdaptiveOptions {
  onDirection: (dir: Direction) => void;
  onPrimaryActionDown?: () => void;
  onPrimaryActionUp?: () => void;
}

export function usePacManAdaptiveControls({
  onDirection,
  onPrimaryActionDown,
  onPrimaryActionUp,
}: UsePacManAdaptiveOptions): PacManAdaptiveControls {
  const device = useDeviceProfile();
  const [mouseSteerEnabled, setMouseSteerEnabled] = useState(true);
  const [padOverride, setPadOverride] = useState<'auto' | 'show' | 'hide'>('auto');
  const mouseAnchorRef = useRef<{ x: number; y: number } | null>(null);
  const lastStickDirRef = useRef<Direction | null>(null);

  const effectivePadLayout =
    padOverride === 'hide'
      ? 'hidden'
      : padOverride === 'show'
      ? device.isLandscape && device.width >= 600
        ? 'side-flanks'
        : 'bottom-deck'
      : device.recommendedPadLayout;

  const padVisible = effectivePadLayout !== 'hidden';
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

  const canvasHeightCss = isSideFlanks
    ? device.compactUi
      ? 'calc(100dvh - 68px)'
      : 'calc(100dvh - 96px)'
    : padVisible
    ? isFlipCover
      ? 'calc(100dvh - 176px)'
      : isFlexFold
      ? '44dvh'
      : device.formFactor === 'phone-portrait'
      ? 'calc(100dvh - 224px)'
      : 'calc(100dvh - 246px)'
    : 'min(calc(100dvh - 104px), 860px)';

  const toggleMouseSteer = useCallback(() => {
    setMouseSteerEnabled((v) => !v);
    mouseAnchorRef.current = null;
  }, []);

  const togglePad = useCallback(() => {
    setPadOverride((prev) => {
      if (prev === 'auto') return padVisible ? 'hide' : 'show';
      return prev === 'show' ? 'hide' : 'show';
    });
  }, [padVisible]);

  const handleJoystickVector = useCallback(
    (vec: JoystickVectorState) => {
      let nextDir: Direction | null = null;
      if (vec.up) nextDir = 'UP';
      else if (vec.down) nextDir = 'DOWN';
      else if (vec.left) nextDir = 'LEFT';
      else if (vec.right) nextDir = 'RIGHT';

      if (nextDir && nextDir !== lastStickDirRef.current) {
        onDirection(nextDir);
      }
      lastStickDirRef.current = nextDir;
    },
    [onDirection]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!mouseSteerEnabled) return;
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;

      const anchor = mouseAnchorRef.current;
      if (!anchor) {
        mouseAnchorRef.current = { x: e.clientX, y: e.clientY };
        return;
      }

      const dx = e.clientX - anchor.x;
      const dy = e.clientY - anchor.y;
      if (Math.hypot(dx, dy) < 16) return;

      if (Math.abs(dx) >= Math.abs(dy)) {
        onDirection(dx > 0 ? 'RIGHT' : 'LEFT');
      } else {
        onDirection(dy > 0 ? 'DOWN' : 'UP');
      }
      mouseAnchorRef.current = { x: e.clientX, y: e.clientY };
    },
    [mouseSteerEnabled, onDirection]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
        mouseAnchorRef.current = { x: e.clientX, y: e.clientY };
        if (e.button === 0 && onPrimaryActionDown) {
          onPrimaryActionDown();
        }
      }
    },
    [onPrimaryActionDown]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if ((e.pointerType === 'mouse' || e.pointerType === 'pen') && e.button === 0 && onPrimaryActionUp) {
        onPrimaryActionUp();
      }
    },
    [onPrimaryActionUp]
  );

  const onPointerLeave = useCallback(() => {
    mouseAnchorRef.current = null;
    onPrimaryActionUp?.();
  }, [onPrimaryActionUp]);

  const onContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
  }, []);

  return {
    mouseSteerEnabled,
    toggleMouseSteer,
    padVisible,
    isSideFlanks,
    isFlexFold,
    isFlipCover,
    joystickSize,
    canvasHeightCss,
    togglePad,
    handleJoystickVector,
    canvasMouseHandlers: {
      onPointerMove,
      onPointerDown,
      onPointerUp,
      onPointerLeave,
      onContextMenu,
    },
  };
}

export function PacManHeaderToggles({
  controls,
}: {
  controls: PacManAdaptiveControls;
}) {
  return (
    <>
      <button
        type="button"
        onClick={controls.toggleMouseSteer}
        className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
          controls.mouseSteerEnabled
            ? 'border-sky-400/40 bg-sky-500/15 text-sky-200 hover:bg-sky-500/25'
            : 'border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.09]'
        }`}
        title="Toggle Mouse Movement Steering"
        aria-label={controls.mouseSteerEnabled ? 'Disable mouse movement' : 'Enable mouse movement'}
      >
        <Mouse className="w-3.5 h-3.5" />
        <span className="hidden lg:inline">{controls.mouseSteerEnabled ? 'Mouse' : 'Mouse Off'}</span>
      </button>

      <button
        type="button"
        onClick={controls.togglePad}
        className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
          controls.padVisible
            ? 'border-pink-400/40 bg-pink-500/15 text-pink-200 hover:bg-pink-500/25'
            : 'border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.09]'
        }`}
        title="Toggle On-Screen Virtual Joystick"
        aria-label={controls.padVisible ? 'Hide on-screen joystick' : 'Show on-screen joystick'}
      >
        <Gamepad2 className="w-3.5 h-3.5" />
        <span className="hidden lg:inline">{controls.padVisible ? 'Joystick' : 'Pad'}</span>
      </button>
    </>
  );
}

interface PacManTouchDeckProps {
  controls: PacManAdaptiveControls;
  accentColor: string;
  accentButtonClass: string;
  actionLabel?: string;
  onActionChange?: (active: boolean) => void;
  onActionTap?: () => void;
}

export function PacManTouchDeck({
  controls,
  accentColor,
  accentButtonClass,
  actionLabel,
  onActionChange,
  onActionTap,
}: PacManTouchDeckProps) {
  if (!controls.padVisible || controls.isSideFlanks) return null;

  return (
    <div
      className={`mt-2 w-full max-w-[460px] flex items-center ${
        actionLabel ? 'justify-between px-3' : 'justify-center'
      } gap-4 select-none touch-none safe-bottom-pad ${
        controls.isFlexFold ? 'fold-flex-deck' : ''
      }`}
    >
      <VirtualJoystick
        mode="4way"
        size={controls.joystickSize}
        accentColor={accentColor}
        onVectorChange={controls.handleJoystickVector}
      />

      {actionLabel && (onActionChange || onActionTap) && (
        <VirtualActionCluster
          compact={controls.isFlipCover}
          primaryLabel={actionLabel}
          accentButtonClass={accentButtonClass}
          onPrimaryChange={onActionChange}
          onPrimaryTap={onActionTap}
        />
      )}
    </div>
  );
}

export function PacManFlankJoystick({
  controls,
  accentColor,
}: {
  controls: PacManAdaptiveControls;
  accentColor: string;
}) {
  if (!controls.padVisible || !controls.isSideFlanks) return null;
  return (
    <div className="flex items-center justify-center shrink-0 pl-1 sm:pl-3 select-none touch-none">
      <VirtualJoystick
        mode="4way"
        size={controls.joystickSize}
        accentColor={accentColor}
        onVectorChange={controls.handleJoystickVector}
      />
    </div>
  );
}

export function PacManFlankAction({
  controls,
  accentButtonClass,
  actionLabel,
  onActionChange,
  onActionTap,
}: {
  controls: PacManAdaptiveControls;
  accentButtonClass: string;
  actionLabel?: string;
  onActionChange?: (active: boolean) => void;
  onActionTap?: () => void;
}) {
  if (!controls.padVisible || !controls.isSideFlanks) return null;
  if (!actionLabel) {
    // Keep visual balance on landscape flanks even for pure-direction Pac-Man cabinets
    return <div className="w-[76px] sm:w-[96px] shrink-0" aria-hidden="true" />;
  }
  return (
    <div className="flex items-center justify-center shrink-0 pr-1 sm:pr-3 select-none touch-none">
      <VirtualActionCluster
        compact={controls.isFlipCover}
        primaryLabel={actionLabel}
        accentButtonClass={accentButtonClass}
        onPrimaryChange={onActionChange}
        onPrimaryTap={onActionTap}
      />
    </div>
  );
}

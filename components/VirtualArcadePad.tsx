'use client';

import { useCallback, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, RotateCcw } from 'lucide-react';

export interface JoystickVectorState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  dx: number;
  dy: number;
}

interface VirtualJoystickProps {
  mode: '4way' | '8way';
  size?: number;
  accentColor?: string;
  onVectorChange: (vec: JoystickVectorState) => void;
  label?: string;
}

function vibratePulse(ms = 6): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(ms);
    } catch {
      // Ignore browsers that block vibrate
    }
  }
}

export function VirtualJoystick({
  mode,
  size = 116,
  accentColor = '#38BDF8',
  onVectorChange,
  label = 'Move',
}: VirtualJoystickProps) {
  const baseRef = useRef<HTMLDivElement | null>(null);
  const activePointerId = useRef<number | null>(null);
  const lastDirKey = useRef<string>('neutral');
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [engaged, setEngaged] = useState(false);

  const maxRadius = size * 0.34;
  const deadzone = mode === '4way' ? 0.18 : 0.2;

  const emitFromOffsets = useCallback(
    (rawDx: number, rawDy: number) => {
      const dist = Math.hypot(rawDx, rawDy);
      const clampedDist = Math.min(maxRadius, dist);
      const angle = Math.atan2(rawDy, rawDx);
      const kx = dist > 0.001 ? Math.cos(angle) * clampedDist : 0;
      const ky = dist > 0.001 ? Math.sin(angle) * clampedDist : 0;
      setKnobOffset({ x: kx, y: ky });

      const nx = maxRadius > 0 ? kx / maxRadius : 0;
      const ny = maxRadius > 0 ? ky / maxRadius : 0;
      const mag = Math.hypot(nx, ny);
      // Progressive micro-precision curve: small thumb movements give fine control, rim gives full speed
      const curvedMag = mag > 0.001 ? Math.pow(Math.min(1, mag), 1.55) : 0;
      const curvedX = mag > 0.001 ? (nx / mag) * curvedMag : 0;
      const curvedY = mag > 0.001 ? (ny / mag) * curvedMag : 0;

      let up = false;
      let down = false;
      let left = false;
      let right = false;

      if (mag >= deadzone) {
        if (mode === '4way') {
          if (Math.abs(nx) >= Math.abs(ny)) {
            if (nx < 0) left = true;
            else right = true;
          } else {
            if (ny < 0) up = true;
            else down = true;
          }
        } else {
          // Smooth 8-way arcade gate with 22.5-degree directional cones
          const deg = (Math.atan2(ny, nx) * 180) / Math.PI;
          if (deg >= -157.5 && deg <= -22.5) up = true;
          if (deg >= 22.5 && deg <= 157.5) down = true;
          if (deg >= -67.5 && deg <= 67.5) right = true;
          if (deg >= 112.5 || deg <= -112.5) left = true;
        }
      }

      const dirKey = `${up ? 'U' : ''}${down ? 'D' : ''}${left ? 'L' : ''}${right ? 'R' : ''}` || 'neutral';
      if (dirKey !== lastDirKey.current && dirKey !== 'neutral') {
        vibratePulse(5);
      }
      lastDirKey.current = dirKey;

      onVectorChange({ up, down, left, right, dx: curvedX, dy: curvedY });
    },
    [deadzone, maxRadius, mode, onVectorChange]
  );

  const resetStick = useCallback(() => {
    activePointerId.current = null;
    lastDirKey.current = 'neutral';
    setEngaged(false);
    setKnobOffset({ x: 0, y: 0 });
    onVectorChange({ up: false, down: false, left: false, right: false, dx: 0, dy: 0 });
  }, [onVectorChange]);

  const updateFromEvent = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const el = baseRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width * 0.5;
      const cy = rect.top + rect.height * 0.5;
      emitFromOffsets(e.clientX - cx, e.clientY - cy);
    },
    [emitFromOffsets]
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== null) return;
    e.preventDefault();
    e.stopPropagation();
    activePointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setEngaged(true);
    updateFromEvent(e);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    e.preventDefault();
    updateFromEvent(e);
  };

  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    e.preventDefault();
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    resetStick();
  };

  const knobSize = Math.round(size * 0.44);

  return (
    <div className="flex flex-col items-center gap-1 select-none touch-none">
      <div
        ref={baseRef}
        role="application"
        aria-label={`${label} virtual arcade joystick`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onContextMenu={(e) => e.preventDefault()}
        className="relative rounded-full touch-none select-none flex items-center justify-center cursor-pointer"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          background: engaged
            ? `radial-gradient(circle at 50% 50%, ${accentColor}26 0%, rgba(15, 23, 42, 0.92) 72%)`
            : 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.06) 0%, rgba(11, 15, 29, 0.92) 74%)',
          border: `1.5px solid ${engaged ? `${accentColor}AA` : 'rgba(255,255,255,0.16)'}`,
          boxShadow: engaged
            ? `0 0 24px -4px ${accentColor}66, inset 0 0 18px rgba(0,0,0,0.65)`
            : 'inset 0 2px 14px rgba(0,0,0,0.65), 0 8px 20px rgba(0,0,0,0.45)',
        }}
      >
        {/* Outer arcade gate ring */}
        <div
          className="pointer-events-none absolute rounded-full border border-white/[0.08]"
          style={{
            width: `${Math.round(size * 0.68)}px`,
            height: `${Math.round(size * 0.68)}px`,
          }}
        />
        {/* Inner micro-precision dotted ring */}
        <div
          className="pointer-events-none absolute rounded-full border border-dashed border-white/[0.14]"
          style={{
            width: `${Math.round(size * 0.36)}px`,
            height: `${Math.round(size * 0.36)}px`,
          }}
        />

        {/* Subtle directional gate chevrons */}
        <ChevronUp className="pointer-events-none absolute top-1.5 w-3.5 h-3.5 text-slate-400/75" />
        <ChevronDown className="pointer-events-none absolute bottom-1.5 w-3.5 h-3.5 text-slate-400/75" />
        <ChevronLeft className="pointer-events-none absolute left-1.5 w-3.5 h-3.5 text-slate-400/75" />
        <ChevronRight className="pointer-events-none absolute right-1.5 w-3.5 h-3.5 text-slate-400/75" />

        {/* Thumbstick ball top */}
        <div
          className="pointer-events-none rounded-full flex items-center justify-center transition-transform duration-75 ease-out"
          style={{
            width: `${knobSize}px`,
            height: `${knobSize}px`,
            transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0) scale(${engaged ? 1.05 : 1})`,
            background: engaged
              ? `radial-gradient(circle at 35% 30%, #FFFFFF 0%, ${accentColor} 45%, #0F172A 100%)`
              : 'radial-gradient(circle at 35% 30%, #E2E8F0 0%, #64748B 50%, #1E293B 100%)',
            border: `1.5px solid ${engaged ? '#FFFFFFCC' : 'rgba(255,255,255,0.35)'}`,
            boxShadow: engaged
              ? `0 0 18px ${accentColor}99, 0 6px 14px rgba(0,0,0,0.6)`
              : '0 6px 14px rgba(0,0,0,0.6)',
          }}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-white/55 blur-[0.5px]" />
        </div>
      </div>
    </div>
  );
}

interface ActionButtonProps {
  label: string;
  sublabel?: string;
  size: number;
  variant: 'primary' | 'secondary' | 'utility';
  accentButtonClass?: string;
  onPressChange: (active: boolean) => void;
  onTap?: () => void;
}

function ArcadeTouchButton({
  label,
  sublabel,
  size,
  variant,
  accentButtonClass,
  onPressChange,
  onTap,
}: ActionButtonProps) {
  const pointerIdRef = useRef<number | null>(null);
  const [pressed, setPressed] = useState(false);

  const handleDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    pointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setPressed(true);
    vibratePulse(7);
    onPressChange(true);
    onTap?.();
  };

  const handleUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (pointerIdRef.current !== null && pointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    pointerIdRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    setPressed(false);
    onPressChange(false);
  };

  const baseStyle =
    variant === 'primary'
      ? `${accentButtonClass || 'bg-sky-400 text-slate-950'} border-2 border-white/35 shadow-lg`
      : variant === 'secondary'
      ? 'bg-white/[0.11] text-white border border-white/25 shadow-md'
      : 'bg-white/[0.06] text-slate-200 border border-white/15';

  return (
    <button
      type="button"
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      onContextMenu={(e) => e.preventDefault()}
      className={`rounded-full font-bold flex flex-col items-center justify-center text-center leading-tight touch-none select-none transition-transform cursor-pointer ${baseStyle} ${
        pressed ? 'scale-92 brightness-110' : 'scale-100'
      }`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
      }}
    >
      <span className={size < 64 ? 'text-[11px] px-1' : 'text-xs px-1.5'}>{label}</span>
      {sublabel && <span className="text-[9px] opacity-75 font-mono">{sublabel}</span>}
    </button>
  );
}

export interface VirtualActionClusterProps {
  compact?: boolean;
  primaryLabel?: string;
  secondaryLabel?: string;
  accentButtonClass?: string;
  onPrimaryChange?: (active: boolean) => void;
  onSecondaryChange?: (active: boolean) => void;
  onPrimaryTap?: () => void;
  onModeTap?: () => void;
  modeTapLabel?: string;
}

export function VirtualActionCluster({
  compact = false,
  primaryLabel,
  secondaryLabel,
  accentButtonClass,
  onPrimaryChange,
  onSecondaryChange,
  onPrimaryTap,
  onModeTap,
  modeTapLabel,
}: VirtualActionClusterProps) {
  const primarySize = compact ? 64 : 78;
  const secondarySize = compact ? 52 : 62;

  return (
    <div className="flex flex-col items-end justify-center gap-2.5 select-none touch-none">
      <div className="flex items-end gap-2.5">
        {secondaryLabel && onSecondaryChange && (
          <div className="-mb-1">
            <ArcadeTouchButton
              label={secondaryLabel}
              size={secondarySize}
              variant="secondary"
              onPressChange={onSecondaryChange}
            />
          </div>
        )}
        {primaryLabel && (onPrimaryChange || onPrimaryTap) && (
          <ArcadeTouchButton
            label={primaryLabel}
            size={primarySize}
            variant="primary"
            accentButtonClass={accentButtonClass}
            onPressChange={onPrimaryChange ?? (() => {})}
            onTap={onPrimaryTap}
          />
        )}
      </div>
      {onModeTap && modeTapLabel && (
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            vibratePulse(6);
            onModeTap();
          }}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.08] active:bg-white/[0.2] border border-white/15 text-[10px] font-semibold text-slate-200 touch-none select-none cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />
          <span>{modeTapLabel}</span>
        </button>
      )}
    </div>
  );
}

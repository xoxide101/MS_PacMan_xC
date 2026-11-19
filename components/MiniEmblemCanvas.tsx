'use client';

import { useEffect, useRef } from 'react';
import { MsPacManRenderer } from '@/lib/game/renderer';
import { FruitType } from '@/lib/game/types';

const sharedRenderer = new MsPacManRenderer();

interface FruitEmblemProps {
  type: FruitType;
  size?: number;
  className?: string;
}

export function FruitEmblem({ type, size = 28, className = '' }: FruitEmblemProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const scale = size / 30;
    sharedRenderer.drawFruit(ctx, type, size * 0.5, size * 0.52, scale);
  }, [type, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    />
  );
}

interface MsPacManEmblemProps {
  size?: number;
  className?: string;
}

export function MsPacManEmblem({ size = 24, className = '' }: MsPacManEmblemProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const cx = size * 0.5;
    const cy = size * 0.54;
    const r = size * 0.38;

    ctx.save();
    ctx.translate(cx, cy);

    // Golden radial body
    const grad = ctx.createRadialGradient(-r * 0.25, -r * 0.3, 1, 0, 0, r);
    grad.addColorStop(0, '#FFF6A6');
    grad.addColorStop(0.55, '#FFD829');
    grad.addColorStop(1, '#E09200');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, 0.38, Math.PI * 2 - 0.38);
    ctx.closePath();
    ctx.fill();

    // Lips
    ctx.fillStyle = '#EF233C';
    ctx.beginPath();
    ctx.arc(Math.cos(-0.38) * r * 0.94, Math.sin(-0.38) * r * 0.94, r * 0.16, 0, Math.PI * 2);
    ctx.arc(Math.cos(0.38) * r * 0.94, Math.sin(0.38) * r * 0.94, r * 0.16, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(r * 0.14, -r * 0.42, r * 0.14, 0, Math.PI * 2);
    ctx.fill();

    // Crimson bow
    ctx.save();
    ctx.translate(-r * 0.42, -r * 0.78);
    ctx.rotate(-0.4);
    ctx.fillStyle = '#E11D48';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-r * 0.48, -r * 0.38, -r * 0.54, r * 0.28, -r * 0.05, r * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(r * 0.48, -r * 0.38, r * 0.54, r * 0.28, r * 0.05, r * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#FB7185';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    />
  );
}

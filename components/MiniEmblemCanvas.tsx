'use client';

import { useEffect, useRef } from 'react';
import { ClassicBonusType } from '@/lib/game/classicEngine';
import { ClassicPacManRenderer } from '@/lib/game/classicRenderer';
import { JrPacManRenderer } from '@/lib/game/jrRenderer';
import { JrPrizeType } from '@/lib/game/jrTypes';
import { PlusBonusType } from '@/lib/game/plusEngine';
import { PacManPlusRenderer } from '@/lib/game/plusRenderer';
import { MsPacManRenderer } from '@/lib/game/renderer';
import { SuperPacManRenderer } from '@/lib/game/superRenderer';
import { SuperPrizeType } from '@/lib/game/superTypes';
import { FruitType } from '@/lib/game/types';

const sharedRenderer = new MsPacManRenderer();
const sharedJrRenderer = new JrPacManRenderer();
const sharedClassicRenderer = new ClassicPacManRenderer();
const sharedSuperRenderer = new SuperPacManRenderer();
const sharedPlusRenderer = new PacManPlusRenderer();

interface EmblemSizeProps {
  size?: number;
  className?: string;
}

interface FruitEmblemProps extends EmblemSizeProps {
  type: FruitType;
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

interface ClassicBonusEmblemProps extends EmblemSizeProps {
  type: ClassicBonusType;
}

export function ClassicBonusEmblem({
  type,
  size = 28,
  className = '',
}: ClassicBonusEmblemProps) {
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
    const scale = size / 28;
    sharedClassicRenderer.drawBonusItem(ctx, type, size * 0.5, size * 0.52, scale);
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

interface PlusBonusEmblemProps extends EmblemSizeProps {
  type: PlusBonusType;
}

export function PlusBonusEmblem({ type, size = 28, className = '' }: PlusBonusEmblemProps) {
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
    const scale = size / 28;
    sharedPlusRenderer.drawPlusBonus(ctx, type, size * 0.5, size * 0.52, scale);
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

export function PacManPlusEmblem({ size = 24, className = '' }: EmblemSizeProps) {
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

    const cx = size * 0.44;
    const cy = size * 0.52;
    const r = size * 0.36;

    ctx.save();
    ctx.translate(cx, cy);
    const grad = ctx.createRadialGradient(-r * 0.25, -r * 0.28, 1, 0, 0, r);
    grad.addColorStop(0, '#FFF8B8');
    grad.addColorStop(0.58, '#FFD829');
    grad.addColorStop(1, '#E09200');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, 0.42, Math.PI * 2 - 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Crisp Emerald "+" Badge mark
    const px = size * 0.78;
    const py = size * 0.28;
    const arm = size * 0.16;
    const thick = Math.max(2, size * 0.085);
    ctx.fillStyle = '#4ADE80';
    ctx.fillRect(px - arm, py - thick * 0.5, arm * 2, thick);
    ctx.fillRect(px - thick * 0.5, py - arm, thick, arm * 2);
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

interface SuperPrizeEmblemProps extends EmblemSizeProps {
  type: SuperPrizeType;
}

export function SuperPrizeEmblem({
  type,
  size = 28,
  className = '',
}: SuperPrizeEmblemProps) {
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
    const scale = size / 28;
    sharedSuperRenderer.drawPrize(ctx, type, size * 0.5, size * 0.52, scale);
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

interface JrPrizeEmblemProps extends EmblemSizeProps {
  type: JrPrizeType;
}

export function JrPrizeEmblem({ type, size = 28, className = '' }: JrPrizeEmblemProps) {
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
    sharedJrRenderer.drawPrize(ctx, type, size * 0.5, size * 0.52, scale);
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

export function ClassicPacManEmblem({ size = 24, className = '' }: EmblemSizeProps) {
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
    const cy = size * 0.5;
    const r = size * 0.42;

    ctx.save();
    ctx.translate(cx, cy);
    const grad = ctx.createRadialGradient(-r * 0.25, -r * 0.28, 1, 0, 0, r);
    grad.addColorStop(0, '#FFF8B8');
    grad.addColorStop(0.58, '#FFD829');
    grad.addColorStop(1, '#E09200');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, 0.42, Math.PI * 2 - 0.42);
    ctx.closePath();
    ctx.fill();
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

export function SuperPacManEmblem({ size = 24, className = '' }: EmblemSizeProps) {
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
    const cy = size * 0.5;
    const r = size * 0.36;

    ctx.save();
    ctx.translate(cx, cy);

    // Emerald Super Power Halo
    const aura = ctx.createRadialGradient(0, 0, r * 0.7, 0, 0, size * 0.49);
    aura.addColorStop(0, 'rgba(74, 222, 128, 0.55)');
    aura.addColorStop(1, 'rgba(74, 222, 128, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.49, 0, Math.PI * 2);
    ctx.fill();

    const grad = ctx.createRadialGradient(-r * 0.25, -r * 0.3, 1, 0, 0, r);
    grad.addColorStop(0, '#FFFDE0');
    grad.addColorStop(0.55, '#FFE135');
    grad.addColorStop(1, '#F59E0B');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, 0.38, Math.PI * 2 - 0.38);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(r * 0.14, -r * 0.38, r * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(r * 0.19, -r * 0.42, r * 0.055, 0, Math.PI * 2);
    ctx.fill();

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

export function PacManiaEmblem({ size = 24, className = '' }: EmblemSizeProps) {
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
    const cy = size * 0.44;
    const r = size * 0.36;

    ctx.save();
    // Floating jump drop shadow
    ctx.fillStyle = 'rgba(236, 72, 153, 0.35)';
    ctx.beginPath();
    ctx.ellipse(cx, size * 0.86, r * 0.72, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(cx, cy);
    const grad = ctx.createRadialGradient(-r * 0.32, -r * 0.36, 1, 0, 0, r * 1.05);
    grad.addColorStop(0, '#FFFAC2');
    grad.addColorStop(0.52, '#FFD829');
    grad.addColorStop(1, '#D97706');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, 0.42, Math.PI * 2 - 0.32);
    ctx.closePath();
    ctx.fill();

    // Inner mouth shadow
    ctx.fillStyle = '#7C2D12';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r * 0.65, -0.22, 0.3);
    ctx.closePath();
    ctx.fill();

    // Expressive 3D eyes
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.ellipse(r * 0.04, -r * 0.34, r * 0.13, r * 0.18, 0, 0, Math.PI * 2);
    ctx.ellipse(r * 0.36, -r * 0.34, r * 0.13, r * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(r * 0.01, -r * 0.4, r * 0.05, 0, Math.PI * 2);
    ctx.arc(r * 0.33, -r * 0.4, r * 0.05, 0, Math.PI * 2);
    ctx.fill();

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

export function MsPacManEmblem({ size = 24, className = '' }: EmblemSizeProps) {
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

    ctx.fillStyle = '#EF233C';
    ctx.beginPath();
    ctx.arc(Math.cos(-0.38) * r * 0.94, Math.sin(-0.38) * r * 0.94, r * 0.16, 0, Math.PI * 2);
    ctx.arc(Math.cos(0.38) * r * 0.94, Math.sin(0.38) * r * 0.94, r * 0.16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(r * 0.14, -r * 0.42, r * 0.14, 0, Math.PI * 2);
    ctx.fill();

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

export function JrPacManEmblem({ size = 24, className = '' }: EmblemSizeProps) {
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
    const cy = size * 0.58;
    const r = size * 0.36;

    ctx.save();
    ctx.translate(cx, cy);

    const grad = ctx.createRadialGradient(-r * 0.25, -r * 0.3, 1, 0, 0, r);
    grad.addColorStop(0, '#FFF7AD');
    grad.addColorStop(0.55, '#FFD829');
    grad.addColorStop(1, '#E09200');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, 0.38, Math.PI * 2 - 0.38);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(r * 0.18, -r * 0.36, r * 0.14, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(-r * 0.22, -r * 0.82);
    ctx.rotate(-0.22);

    ctx.fillStyle = '#2563EB';
    ctx.beginPath();
    ctx.arc(0, r * 0.14, r * 0.54, Math.PI, 0, false);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.14, r * 0.22, r * 0.52, 0, Math.PI, 0, false);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(-r * 0.55, r * 0.08, r * 1.1, Math.max(1.4, r * 0.13));

    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = Math.max(1.2, r * 0.12);
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.38);
    ctx.lineTo(0, -r * 0.68);
    ctx.stroke();

    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.ellipse(-r * 0.34, -r * 0.68, r * 0.36, Math.max(1.2, r * 0.13), 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#38BDF8';
    ctx.beginPath();
    ctx.ellipse(r * 0.34, -r * 0.68, r * 0.36, Math.max(1.2, r * 0.13), 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FDE047';
    ctx.beginPath();
    ctx.arc(0, -r * 0.68, Math.max(1.3, r * 0.14), 0, Math.PI * 2);
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

type ClassicIconKind =
  | 'centipede'
  | 'millipede'
  | 'digdug'
  | 'boulderdash'
  | 'invaders'
  | 'invaders2'
  | 'foodfight';

function ClassicIconCanvas({
  kind,
  size = 28,
  className = '',
}: EmblemSizeProps & { kind: ClassicIconKind }) {
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
    const s = size / 32;
    ctx.save();
    ctx.scale(s, s);

    if (kind === 'centipede') {
      // Three-segment neon lime & red centipede head
      ctx.fillStyle = '#84CC16';
      ctx.beginPath();
      ctx.arc(8, 20, 6.5, 0, Math.PI * 2);
      ctx.arc(16, 15, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(23, 12, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(25.5, 9.5, 2, 0, Math.PI * 2);
      ctx.arc(25.5, 14.5, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'millipede') {
      // Fiery orange millipede + DDT badge accent
      ctx.fillStyle = '#DC2626';
      ctx.fillRect(4, 15, 13, 13);
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(4, 15, 13, 13);
      ctx.fillStyle = '#F97316';
      ctx.beginPath();
      ctx.arc(17, 11, 6.5, 0, Math.PI * 2);
      ctx.arc(24, 9, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(26.5, 7, 1.8, 0, Math.PI * 2);
      ctx.arc(26.5, 11, 1.8, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'digdug') {
      // Iconic red Pooka with yellow goggles
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(16, 17, 11.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.roundRect(6, 11, 20, 8, 4);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(12, 15, 2.8, 0, Math.PI * 2);
      ctx.arc(20, 15, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(12.5, 15, 1.4, 0, Math.PI * 2);
      ctx.arc(20.5, 15, 1.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'boulderdash') {
      // Sparkling cyan-purple diamond gem
      ctx.fillStyle = '#A855F7';
      ctx.beginPath();
      ctx.moveTo(16, 3);
      ctx.lineTo(28, 16);
      ctx.lineTo(16, 29);
      ctx.lineTo(4, 16);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.moveTo(16, 8);
      ctx.lineTo(23, 16);
      ctx.lineTo(16, 24);
      ctx.lineTo(9, 16);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(16, 11);
      ctx.lineTo(20, 16);
      ctx.lineTo(16, 21);
      ctx.lineTo(12, 16);
      ctx.closePath();
      ctx.fill();
    } else if (kind === 'invaders') {
      // Classic green Crab Invader
      ctx.fillStyle = '#4ADE80';
      ctx.fillRect(6, 10, 20, 10);
      ctx.fillRect(9, 6, 3, 4);
      ctx.fillRect(20, 6, 3, 4);
      ctx.fillRect(3, 8, 3, 9);
      ctx.fillRect(26, 8, 3, 9);
      ctx.fillRect(8, 20, 4, 5);
      ctx.fillRect(20, 20, 4, 5);
      ctx.fillStyle = '#04060B';
      ctx.fillRect(10, 13, 3.5, 3.5);
      ctx.fillRect(18.5, 13, 3.5, 3.5);
    } else if (kind === 'invaders2') {
      // Neon Cyan & Crimson Splitter Command Invader
      ctx.fillStyle = '#F43F5E';
      ctx.beginPath();
      ctx.moveTo(16, 4);
      ctx.lineTo(28, 14);
      ctx.lineTo(25, 24);
      ctx.lineTo(7, 24);
      ctx.lineTo(4, 14);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#22D3EE';
      ctx.fillRect(14.5, 7, 3, 16);
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(9, 13, 3.5, 3.5);
      ctx.fillRect(19.5, 13, 3.5, 3.5);
    } else {
      // Food Fight Giant Ice Cream Cone
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.moveTo(9, 17);
      ctx.lineTo(23, 17);
      ctx.lineTo(16, 30);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#F472B6';
      ctx.beginPath();
      ctx.arc(16, 14, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FEF3C7';
      ctx.beginPath();
      ctx.arc(16, 8, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(16, 3, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }, [kind, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    />
  );
}

export function GameEmblem({
  gameId,
  size = 28,
  className = '',
}: EmblemSizeProps & { gameId: string }) {
  switch (gameId) {
    case 'classic':
      return <ClassicPacManEmblem size={size} className={className} />;
    case 'plus':
      return <PacManPlusEmblem size={size} className={className} />;
    case 'ms':
      return <MsPacManEmblem size={size} className={className} />;
    case 'super':
      return <SuperPacManEmblem size={size} className={className} />;
    case 'jr':
      return <JrPacManEmblem size={size} className={className} />;
    case 'pacmania':
      return <PacManiaEmblem size={size} className={className} />;
    case 'centipede':
    case 'millipede':
    case 'digdug':
    case 'boulderdash':
    case 'invaders':
    case 'invaders2':
    case 'foodfight':
      return <ClassicIconCanvas kind={gameId} size={size} className={className} />;
    default:
      return <ClassicPacManEmblem size={size} className={className} />;
  }
}

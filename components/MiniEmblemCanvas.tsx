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
  | 'foodfight'
  | 'gauntlet'
  | 'gauntlet2'
  | 'polepos'
  | 'polepos2'
  | 'sprint'
  | 'supersprint'
  | 'champsprint'
  | 'defender'
  | 'defender2'
  | 'stargate'
  | 'tempest'
  | 'tempest2000'
  | 'tempest3000'
  | 'mappy'
  | 'mariobros'
  | 'dkong'
  | 'dkongjr'
  | 'dkong3'
  | 'smb1'
  | 'smb2'
  | 'smb3'
  | 'sonic1'
  | 'sonic2'
  | 'sonic3';

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
    } else if (kind === 'foodfight') {
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
    } else if (kind === 'gauntlet' || kind === 'gauntlet2') {
      // Battle shield + crossed golden axe / dragon flame for Gauntlet II
      ctx.fillStyle = kind === 'gauntlet' ? '#B45309' : '#B91C1C';
      ctx.beginPath();
      ctx.moveTo(16, 3);
      ctx.lineTo(27, 8);
      ctx.lineTo(25, 20);
      ctx.lineTo(16, 29);
      ctx.lineTo(7, 20);
      ctx.lineTo(5, 8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = kind === 'gauntlet' ? '#FACC15' : '#FB923C';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = kind === 'gauntlet' ? '#FDE047' : '#38BDF8';
      ctx.beginPath();
      ctx.moveTo(16, 8);
      ctx.lineTo(20, 16);
      ctx.lineTo(16, 23);
      ctx.lineTo(12, 16);
      ctx.closePath();
      ctx.fill();
    } else if (kind === 'polepos' || kind === 'polepos2') {
      // Rear-view F1 Grand Prix car
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(4, 17, 6, 9);
      ctx.fillRect(22, 17, 6, 9);
      ctx.fillStyle = kind === 'polepos' ? '#EF4444' : '#38BDF8';
      ctx.beginPath();
      ctx.moveTo(12, 6);
      ctx.lineTo(20, 6);
      ctx.lineTo(23, 24);
      ctx.lineTo(9, 24);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(7, 12, 18, 4);
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(16, 10, 3.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'sprint' || kind === 'supersprint' || kind === 'champsprint') {
      // Top-down Sprint racer + wrench / gate accent
      const bodyColor =
        kind === 'sprint' ? '#E2E8F0' : kind === 'supersprint' ? '#FACC15' : '#4ADE80';
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(6, 7, 5, 7);
      ctx.fillRect(21, 7, 5, 7);
      ctx.fillRect(6, 19, 5, 7);
      ctx.fillRect(21, 19, 5, 7);
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.roundRect(10, 4, 12, 24, 5);
      ctx.fill();
      ctx.fillStyle = kind === 'sprint' ? '#334155' : '#EF4444';
      ctx.fillRect(14, 6, 4, 20);
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(16, 15, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'defender' || kind === 'defender2' || kind === 'stargate') {
      // Sleek Williams Defender / Stargate fighter + laser streak
      const accent =
        kind === 'defender' ? '#F59E0B' : kind === 'defender2' ? '#A855F7' : '#38BDF8';
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(21, 16);
      ctx.lineTo(31, 16);
      ctx.stroke();
      ctx.fillStyle = '#E2E8F0';
      ctx.beginPath();
      ctx.moveTo(26, 17);
      ctx.lineTo(12, 11);
      ctx.lineTo(5, 8);
      ctx.lineTo(3, 14);
      ctx.lineTo(6, 21);
      ctx.lineTo(20, 21);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.moveTo(17, 15);
      ctx.lineTo(11, 11);
      ctx.lineTo(8, 15);
      ctx.closePath();
      ctx.fill();
    } else if (kind === 'tempest' || kind === 'tempest2000' || kind === 'tempest3000') {
      // 3D Vector Tube + Yellow Blaster Claw
      const webCol =
        kind === 'tempest' ? '#3B82F6' : kind === 'tempest2000' ? '#EC4899' : '#22D3EE';
      ctx.strokeStyle = webCol;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(16, 16, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(16, 16, 5, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(16 + Math.cos(a) * 5, 16 + Math.sin(a) * 5);
        ctx.lineTo(16 + Math.cos(a) * 12, 16 + Math.sin(a) * 12);
        ctx.stroke();
      }
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.moveTo(16, 21);
      ctx.lineTo(10, 29);
      ctx.lineTo(16, 26);
      ctx.lineTo(22, 29);
      ctx.closePath();
      ctx.fill();
    } else if (kind === 'mappy') {
      // Mappy Police Mouse face + blue cap & gold badge
      ctx.fillStyle = '#93C5FD';
      ctx.beginPath();
      ctx.arc(9, 11, 6, 0, Math.PI * 2);
      ctx.arc(23, 11, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FDE68A';
      ctx.beginPath();
      ctx.arc(16, 19, 9.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2563EB';
      ctx.fillRect(8, 6, 16, 6);
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(14, 7, 4, 4);
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(13, 18, 1.8, 0, Math.PI * 2);
      ctx.arc(19, 18, 1.8, 0, Math.PI * 2);
      ctx.arc(16, 22, 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'mariobros') {
      // Iconic POW Block + Red Cap
      ctx.fillStyle = '#2563EB';
      ctx.fillRect(5, 11, 22, 16);
      ctx.strokeStyle = '#93C5FD';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(5, 11, 22, 16);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 8px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('POW', 16, 19.5);
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(9, 4, 14, 5);
    } else if (kind === 'dkong' || kind === 'dkongjr' || kind === 'dkong3') {
      // Donkey Kong Barrel / Jungle Vine / Bug Spray emblem
      if (kind === 'dkong') {
        ctx.fillStyle = '#B45309';
        ctx.beginPath();
        ctx.arc(16, 16, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 2.2;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(6, 16);
        ctx.lineTo(26, 16);
        ctx.stroke();
      } else if (kind === 'dkongjr') {
        ctx.strokeStyle = '#22C55E';
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(10, 3);
        ctx.lineTo(10, 29);
        ctx.moveTo(22, 3);
        ctx.lineTo(22, 29);
        ctx.stroke();
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.arc(16, 14, 6.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#A3E635';
        ctx.fillRect(10, 12, 12, 16);
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(13, 7, 6, 5);
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.arc(16, 4, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (kind === 'smb1' || kind === 'smb2' || kind === 'smb3') {
      if (kind === 'smb1') {
        // Super Mushroom
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(16, 14, 11.5, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#FEF3C7';
        ctx.fillRect(9, 14, 14, 12);
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(12, 9, 3, 0, Math.PI * 2);
        ctx.arc(20, 9, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (kind === 'smb2') {
        // Subcon Turnip
        ctx.fillStyle = '#22C55E';
        ctx.fillRect(11, 4, 10, 8);
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(16, 18, 9.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#EC4899';
        ctx.fillRect(11, 15, 10, 3);
      } else {
        // SMB3 Golden Super Leaf
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.ellipse(16, 16, 11, 8, -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FEF08A';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    } else if (kind === 'sonic1' || kind === 'sonic2' || kind === 'sonic3') {
      // Golden Sonic Ring + Blue/Gold/Indigo Spinball core
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(16, 16, 11.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle =
        kind === 'sonic1' ? '#2563EB' : kind === 'sonic2' ? '#38BDF8' : '#6366F1';
      ctx.beginPath();
      ctx.arc(16, 16, 6.5, 0, Math.PI * 2);
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
    case 'gauntlet':
    case 'gauntlet2':
    case 'polepos':
    case 'polepos2':
    case 'sprint':
    case 'supersprint':
    case 'champsprint':
    case 'defender':
    case 'defender2':
    case 'stargate':
    case 'tempest':
    case 'tempest2000':
    case 'tempest3000':
    case 'mappy':
    case 'mariobros':
    case 'dkong':
    case 'dkongjr':
    case 'dkong3':
    case 'smb1':
    case 'smb2':
    case 'smb3':
    case 'sonic1':
    case 'sonic2':
    case 'sonic3':
      return <ClassicIconCanvas kind={gameId} size={size} className={className} />;
    default:
      return <ClassicPacManEmblem size={size} className={className} />;
  }
}

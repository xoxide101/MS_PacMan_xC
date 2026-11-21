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
  | 'invadersdx'
  | 'foodfight'
  | 'gauntlet'
  | 'gauntlet2'
  | 'gauntletdl'
  | 'polepos'
  | 'polepos2'
  | 'sprint1'
  | 'sprint'
  | 'sprint4'
  | 'sprint8'
  | 'supersprint'
  | 'champsprint'
  | 'badlands'
  | 'superoffroad'
  | 'indyheat'
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
  | 'sonic3'
  | 'superbreakout'
  | 'arkanoid'
  | 'arkanoid2'
  | 'breakout2016evo'
  | 'asteroidsdeluxe'
  | 'spaceduel'
  | 'starcastle'
  | 'missilecommand'
  | 'qix'
  | 'superqix'
  | 'galaxian'
  | 'galaga'
  | 'phoenix'
  | 'gyruss'
  | 'scramble'
  | 'moonpatrol'
  | 'timepilot'
  | 'timepilot84'
  | 'timepilot2016evo'
  | 'ww1942'
  | 'ww1943'
  | 'starwars'
  | 'starwarsesb'
  | 'starwarsrotj'
  | 'berzerk'
  | 'robotron'
  | 'robotron2016evo'
  | 'frogger'
  | 'frogger2'
  | 'joust'
  | 'pengo'
  | 'popeye'
  | 'mrdo'
  | 'spyhunter'
  | 'spyhunter2'
  | 'tapper'
  | 'roottapper'
  | 'puzzlebobble'
  | 'puzzlebobble2'
  | 'puzzlebobble3'
  | 'crystalcastles'
  | 'rampage'
  | 'dragonslair'
  | 'smw1'
  | 'smw2'
  | 'ys1'
  | 'ys2'
  | 'mule'
  | 'muleevo';

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
      // Bioluminescent garden mushroom + segmented emerald/ruby centipede
      ctx.fillStyle = '#050E16';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#FDE047';
      ctx.fillRect(6, 22, 4, 6);
      ctx.fillStyle = '#EC4899';
      ctx.beginPath();
      ctx.arc(8, 22, 5.5, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#84CC16';
      ctx.beginPath();
      ctx.arc(10, 14, 5.5, 0, Math.PI * 2);
      ctx.arc(17, 11.5, 5.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(24, 13, 6.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(26.5, 10.5, 1.9, 0, Math.PI * 2);
      ctx.arc(26.5, 15.2, 1.9, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'millipede') {
      // Sunset Overdrive DDT canister + glowing orange/cyan millipede
      ctx.fillStyle = '#180818';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#DC2626';
      ctx.fillRect(3.5, 15, 13.5, 13.5);
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(3.5, 15, 13.5, 2.5);
      ctx.fillRect(3.5, 26, 13.5, 2.5);
      ctx.fillStyle = '#FEF08A';
      ctx.font = '900 6px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('DDT', 10.2, 22);
      ctx.fillStyle = '#F97316';
      ctx.beginPath();
      ctx.arc(17.5, 10.5, 5.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(24.5, 9.5, 6.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(27, 7.5, 1.9, 0, Math.PI * 2);
      ctx.arc(27, 11.5, 1.9, 0, Math.PI * 2);
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
    } else if (kind === 'invadersdx') {
      const grad = ctx.createLinearGradient(4, 4, 28, 28);
      grad.addColorStop(0, '#FEF08A');
      grad.addColorStop(0.5, '#F59E0B');
      grad.addColorStop(1, '#EC4899');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(16, 3);
      ctx.lineTo(28, 12);
      ctx.lineTo(25, 22);
      ctx.lineTo(19, 27);
      ctx.lineTo(16, 22);
      ctx.lineTo(13, 27);
      ctx.lineTo(7, 22);
      ctx.lineTo(4, 12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(9.5, 12, 4, 4);
      ctx.fillRect(18.5, 12, 4, 4);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(14.5, 6, 3, 4);
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
      // Iconic 4-Color Hero Crest Shield (Red / Blue / Yellow / Green quarters) + Golden Battle Axe
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(16, 3);
      ctx.lineTo(27, 7);
      ctx.lineTo(25, 20);
      ctx.lineTo(16, 29);
      ctx.lineTo(7, 20);
      ctx.lineTo(5, 7);
      ctx.closePath();
      ctx.clip();
      // 4 Hero Class Quadrants
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(4, 3, 12, 13);
      ctx.fillStyle = '#3B82F6';
      ctx.fillRect(16, 3, 12, 13);
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(4, 16, 12, 14);
      ctx.fillStyle = '#22C55E';
      ctx.fillRect(16, 16, 12, 14);
      ctx.restore();
      ctx.strokeStyle = kind === 'gauntlet' ? '#FDE047' : '#FB923C';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(16, 3);
      ctx.lineTo(27, 7);
      ctx.lineTo(25, 20);
      ctx.lineTo(16, 29);
      ctx.lineTo(7, 20);
      ctx.lineTo(5, 7);
      ctx.closePath();
      ctx.stroke();
      // Center golden emblem / dragon spark
      ctx.fillStyle = kind === 'gauntlet' ? '#FEF08A' : '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(16, 8);
      ctx.lineTo(20, 16);
      ctx.lineTo(16, 24);
      ctx.lineTo(12, 16);
      ctx.closePath();
      ctx.fill();
    } else if (kind === 'gauntletdl') {
      // Authentic 2000 Midway Gauntlet: Dark Legacy — Carved Stone & Riveted Antique Bronze Shield + Ember Runestone
      ctx.fillStyle = '#29221A';
      ctx.beginPath();
      ctx.moveTo(16, 2);
      ctx.lineTo(28, 8.5);
      ctx.lineTo(24.5, 24);
      ctx.lineTo(16, 30);
      ctx.lineTo(7.5, 24);
      ctx.lineTo(4, 8.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#D9A043';
      ctx.lineWidth = 2.2;
      ctx.stroke();
      // Broadsword hilt & steel blade
      ctx.strokeStyle = '#E7D5B0';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(16, 5.5);
      ctx.lineTo(16, 26);
      ctx.moveTo(9.5, 11.5);
      ctx.lineTo(22.5, 11.5);
      ctx.stroke();
      // Torchlit crimson-gold Runestone core
      ctx.fillStyle = '#DC2626';
      ctx.beginPath();
      ctx.moveTo(16, 10.5);
      ctx.lineTo(20.5, 16);
      ctx.lineTo(16, 21.5);
      ctx.lineTo(11.5, 16);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FDE047';
      ctx.beginPath();
      ctx.arc(16, 16, 2.2, 0, Math.PI * 2);
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
    } else if (
      kind === 'sprint1' ||
      kind === 'sprint' ||
      kind === 'sprint4' ||
      kind === 'sprint8' ||
      kind === 'supersprint' ||
      kind === 'champsprint'
    ) {
      // Top-down Sprint racer (with 4-color / 8-pack accents)
      const bodyColor =
        kind === 'sprint1'
          ? '#86EFAC'
          : kind === 'sprint'
            ? '#E2E8F0'
            : kind === 'sprint4'
              ? '#F97316'
              : kind === 'sprint8'
                ? '#38BDF8'
                : kind === 'supersprint'
                  ? '#FACC15'
                  : '#4ADE80';
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(6, 7, 5, 7);
      ctx.fillRect(21, 7, 5, 7);
      ctx.fillRect(6, 19, 5, 7);
      ctx.fillRect(21, 19, 5, 7);
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.roundRect(10, 4, 12, 24, 5);
      ctx.fill();
      ctx.fillStyle =
        kind === 'sprint1' || kind === 'sprint'
          ? '#334155'
          : kind === 'sprint8'
            ? '#FACC15'
            : '#EF4444';
      ctx.fillRect(14, 6, 4, 20);
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(16, 15, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'badlands') {
      // Wasteland armored buggy with roof plasma cannon
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(4, 7, 6, 8);
      ctx.fillRect(22, 7, 6, 8);
      ctx.fillRect(4, 18, 6, 8);
      ctx.fillRect(22, 18, 6, 8);
      ctx.fillStyle = '#B91C1C';
      ctx.beginPath();
      ctx.roundRect(9, 6, 14, 21, 3);
      ctx.fill();
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(11, 20, 10, 3);
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(14.5, 2, 3, 12);
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(16, 2.5, 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'superoffroad') {
      // 4x4 Monster Pickup Truck with KC rollbar lights
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(3, 6, 6, 9);
      ctx.fillRect(23, 6, 6, 9);
      ctx.fillRect(3, 18, 6, 9);
      ctx.fillRect(23, 18, 6, 9);
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.roundRect(8, 5, 16, 22, 3.5);
      ctx.fill();
      ctx.fillStyle = '#0EA5E9';
      ctx.fillRect(10.5, 11, 11, 5.5);
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(11, 17.5, 3, 2);
      ctx.fillRect(14.5, 17.5, 3, 2);
      ctx.fillRect(18, 17.5, 3, 2);
    } else if (kind === 'indyheat') {
      // IndyCar open-wheel formula racer with front/rear aero wings
      ctx.fillStyle = '#2563EB';
      ctx.fillRect(7, 4, 18, 3.5);
      ctx.fillRect(7, 24.5, 18, 4);
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(5, 8.5, 4.5, 6);
      ctx.fillRect(22.5, 8.5, 4.5, 6);
      ctx.fillRect(5, 17.5, 5, 6.5);
      ctx.fillRect(22, 17.5, 5, 6.5);
      ctx.fillStyle = '#60A5FA';
      ctx.beginPath();
      ctx.moveTo(16, 5);
      ctx.lineTo(21, 14);
      ctx.lineTo(20, 25);
      ctx.lineTo(12, 25);
      ctx.lineTo(11, 14);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(16, 15, 2.8, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'defender') {
      // 1981 Defender: Crimson-amber jagged frontier mountains + Williams interceptor + laser
      ctx.strokeStyle = '#F97316';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(2, 27);
      ctx.lineTo(8, 22);
      ctx.lineTo(14, 26);
      ctx.lineTo(22, 20);
      ctx.lineTo(30, 27);
      ctx.stroke();
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(21, 13);
      ctx.lineTo(31, 13);
      ctx.stroke();
      ctx.fillStyle = '#E2E8F0';
      ctx.beginPath();
      ctx.moveTo(25, 13);
      ctx.lineTo(11, 8);
      ctx.lineTo(5, 7);
      ctx.lineTo(4, 16);
      ctx.lineTo(19, 17);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(8, 12, 10, 2.5);
    } else if (kind === 'defender2') {
      // Defender II: Violet Nebula + Delta Wing + shimmering Inviso Shield ring
      ctx.strokeStyle = '#E879F9';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(15, 16, 13, 9, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#F3E8FF';
      ctx.beginPath();
      ctx.moveTo(26, 16);
      ctx.lineTo(7, 9);
      ctx.lineTo(11, 16);
      ctx.lineTo(7, 23);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#A855F7';
      ctx.beginPath();
      ctx.moveTo(20, 16);
      ctx.lineTo(10, 12);
      ctx.lineTo(10, 20);
      ctx.closePath();
      ctx.fill();
    } else if (kind === 'stargate') {
      // Stargate: Concentric Cyan Hyperspace Vortex Portal + Twin-Prong Starfighter
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(11, 16, 7, 11, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#34D399';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(11, 16, 3.5, 6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#BAE6FD';
      ctx.beginPath();
      ctx.moveTo(30, 14);
      ctx.lineTo(17, 11);
      ctx.lineTo(20, 16);
      ctx.lineTo(17, 21);
      ctx.lineTo(30, 18);
      ctx.lineTo(24, 16);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(19, 14.5, 5, 3);
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
      // Mappy Police Mouse face + pink ears + blue cap & gold badge + green trampoline
      ctx.fillStyle = '#60A5FA';
      ctx.beginPath();
      ctx.arc(8.5, 11, 6, 0, Math.PI * 2);
      ctx.arc(23.5, 11, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FCA5A5';
      ctx.beginPath();
      ctx.arc(8.5, 11, 3, 0, Math.PI * 2);
      ctx.arc(23.5, 11, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FDE68A';
      ctx.beginPath();
      ctx.arc(16, 18, 8.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1D4ED8';
      ctx.fillRect(8, 5, 16, 6);
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(14, 6, 4, 4);
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(13, 17, 1.7, 0, Math.PI * 2);
      ctx.arc(19, 17, 1.7, 0, Math.PI * 2);
      ctx.arc(16, 21, 2.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#22C55E';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(5, 28);
      ctx.quadraticCurveTo(16, 31, 27, 28);
      ctx.stroke();
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
    } else if (kind === 'dkong') {
      // 1981 Donkey Kong: Crimson Steel Girder + Wooden Barrel + Golden Hammer
      ctx.fillStyle = '#E11D48';
      ctx.fillRect(2, 23, 28, 5);
      ctx.fillStyle = '#B45309';
      ctx.beginPath();
      ctx.arc(14, 15, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(6, 15);
      ctx.lineTo(22, 15);
      ctx.stroke();
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(21, 4, 8, 5);
      ctx.fillStyle = '#D97706';
      ctx.fillRect(24, 9, 2.5, 9);
    } else if (kind === 'dkongjr') {
      // 1982 Donkey Kong Jr.: Twin Jungle Vines + White "J" Singlet Emblem + Golden Key
      ctx.strokeStyle = '#22C55E';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(7, 3);
      ctx.lineTo(7, 29);
      ctx.moveTo(25, 3);
      ctx.lineTo(25, 29);
      ctx.stroke();
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(10, 11, 12, 13);
      ctx.fillStyle = '#EF4444';
      ctx.font = '900 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('J', 16, 18);
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(16, 6, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'dkong3') {
      // 1983 Donkey Kong 3: Super Spray Can + Blooming Potted Flower
      ctx.fillStyle = '#A3E635';
      ctx.fillRect(6, 12, 10, 15);
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(8.5, 8, 5, 4);
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(11, 4.5, 2.8, 0, Math.PI * 2);
      ctx.fill();
      // Potted flower
      ctx.fillStyle = '#C2410C';
      ctx.fillRect(19, 21, 9, 6);
      ctx.strokeStyle = '#22C55E';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(23.5, 21);
      ctx.lineTo(23.5, 13);
      ctx.stroke();
      ctx.fillStyle = '#F43F5E';
      ctx.beginPath();
      ctx.arc(23.5, 11, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(23.5, 11, 2, 0, Math.PI * 2);
      ctx.fill();
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
    } else if (kind === 'superbreakout' || kind === 'arkanoid' || kind === 'arkanoid2') {
      // Rainbow bricks + Vaus paddle + gleaming ball
      const colors =
        kind === 'arkanoid2'
          ? ['#C084FC', '#38BDF8', '#FACC15']
          : ['#EF4444', '#F59E0B', '#38BDF8'];
      colors.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(4, 4 + i * 5, 11, 3.8);
        ctx.fillRect(17, 4 + i * 5, 11, 3.8);
      });
      ctx.fillStyle = kind === 'superbreakout' ? '#38BDF8' : '#E2E8F0';
      ctx.beginPath();
      ctx.roundRect(6, 24, 20, 4.5, 2.2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(16, 19.5, 2.6, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'breakout2016evo') {
      // Melt-O-Vision neon web diamond + Warlords prism bricks + Cyber-Vaus + blazing fireball
      ctx.strokeStyle = 'rgba(236, 72, 153, 0.72)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(16, 2.5);
      ctx.lineTo(29.5, 16);
      ctx.lineTo(16, 29.5);
      ctx.lineTo(2.5, 16);
      ctx.closePath();
      ctx.stroke();

      ctx.strokeStyle = 'rgba(34, 211, 238, 0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(16, 7);
      ctx.lineTo(25, 16);
      ctx.lineTo(16, 25);
      ctx.lineTo(7, 16);
      ctx.closePath();
      ctx.stroke();

      // Prism bricks arc
      const evoCols = ['#F43F5E', '#FACC15', '#22D3EE', '#E879F9'];
      evoCols.forEach((col, i) => {
        ctx.fillStyle = col;
        ctx.fillRect(5.5 + i * 5.6, 7.5 + (i === 1 || i === 2 ? -1.5 : 1), 4.6, 3.2);
      });

      // Blazing Warlords Fireball + Melt-O-Vision trail
      ctx.fillStyle = 'rgba(251, 146, 60, 0.55)';
      ctx.beginPath();
      ctx.arc(13.5, 18.2, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FDE047';
      ctx.beginPath();
      ctx.arc(16.8, 16.4, 2.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(17.3, 16.0, 1.3, 0, Math.PI * 2);
      ctx.fill();

      // Curved Cyber-Vaus neon paddle
      ctx.strokeStyle = '#22D3EE';
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(16, 31.5, 11.5, Math.PI * 1.24, Math.PI * 1.76);
      ctx.stroke();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(16, 31.5, 11.5, Math.PI * 1.34, Math.PI * 1.66);
      ctx.stroke();
    } else if (kind === 'asteroidsdeluxe' || kind === 'spaceduel') {
      // Glowing vector ship + geometric rock/crystal
      ctx.strokeStyle = kind === 'asteroidsdeluxe' ? '#38BDF8' : '#C084FC';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(16, 4);
      ctx.lineTo(25, 25);
      ctx.lineTo(16, 20);
      ctx.lineTo(7, 25);
      ctx.closePath();
      ctx.stroke();
      ctx.strokeStyle = kind === 'asteroidsdeluxe' ? '#E2E8F0' : '#FACC15';
      ctx.beginPath();
      ctx.arc(16, 16, 13.5, 0, Math.PI * 2);
      ctx.stroke();
    } else if (kind === 'starcastle') {
      // 3 concentric rotating energy rings + core cannon
      const ringCols = ['#38BDF8', '#FACC15', '#EF4444'];
      ringCols.forEach((c, i) => {
        ctx.strokeStyle = c;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(16, 16, 12.5 - i * 3.5, i * 0.7, Math.PI * 1.85 + i * 0.7);
        ctx.stroke();
      });
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(16, 16, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'missilecommand') {
      // Incoming trails + ABM blast bloom + city skyline
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(6, 3);
      ctx.lineTo(15, 13);
      ctx.moveTo(26, 3);
      ctx.lineTo(18, 12);
      ctx.stroke();
      ctx.fillStyle = '#F97316';
      ctx.beginPath();
      ctx.arc(16, 13, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(16, 13, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(5, 23, 5, 6);
      ctx.fillRect(13, 21, 6, 8);
      ctx.fillRect(22, 23, 5, 6);
    } else if (kind === 'qix') {
      // Claimed polygon + chaotic neon Qix ribbons
      ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.fillRect(4, 16, 14, 12);
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.8;
      ctx.strokeRect(4, 4, 24, 24);
      ctx.strokeStyle = '#F472B6';
      ctx.beginPath();
      ctx.moveTo(12, 8);
      ctx.lineTo(24, 14);
      ctx.moveTo(15, 22);
      ctx.lineTo(25, 9);
      ctx.stroke();
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.moveTo(18, 13);
      ctx.lineTo(21, 16);
      ctx.lineTo(18, 19);
      ctx.lineTo(15, 16);
      ctx.closePath();
      ctx.fill();
    } else if (kind === 'superqix') {
      // Super Qix: Revealed 16-bit sunset mosaic + golden dragon glow + power-up orb
      const sg = ctx.createLinearGradient(4, 4, 28, 28);
      sg.addColorStop(0, '#4C1D95');
      sg.addColorStop(0.5, '#DB2777');
      sg.addColorStop(1, '#F59E0B');
      ctx.fillStyle = sg;
      ctx.fillRect(4, 14, 15, 14);
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2;
      ctx.strokeRect(4, 4, 24, 24);
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(14, 7);
      ctx.lineTo(25, 13);
      ctx.moveTo(16, 20);
      ctx.lineTo(26, 8);
      ctx.stroke();
      ctx.fillStyle = '#4ADE80';
      ctx.beginPath();
      ctx.arc(10, 10, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(10, 10, 1.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'galaxian' || kind === 'galaga' || kind === 'phoenix' || kind === 'gyruss') {
      // Iconic galactic flagship / Galaga fighter / Phoenix bird / Gyruss ring
      if (kind === 'gyruss') {
        ctx.strokeStyle = '#22D3EE';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(16, 16, 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.arc(16, 16, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.moveTo(16, 22);
        ctx.lineTo(11, 29);
        ctx.lineTo(21, 29);
        ctx.closePath();
        ctx.fill();
      } else if (kind === 'phoenix') {
        ctx.fillStyle = '#FB923C';
        ctx.beginPath();
        ctx.moveTo(16, 6);
        ctx.lineTo(29, 13);
        ctx.lineTo(22, 23);
        ctx.lineTo(16, 18);
        ctx.lineTo(10, 23);
        ctx.lineTo(3, 13);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(16, 14, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = kind === 'galaxian' ? '#FACC15' : '#F8FAFC';
        ctx.beginPath();
        ctx.moveTo(16, 3);
        ctx.lineTo(26, 24);
        ctx.lineTo(16, 19);
        ctx.lineTo(6, 24);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = kind === 'galaxian' ? '#EF4444' : '#38BDF8';
        ctx.fillRect(13, 11, 6, 10);
      }
    } else if (
      kind === 'scramble' ||
      kind === 'moonpatrol' ||
      kind === 'timepilot' ||
      kind === 'timepilot84' ||
      kind === 'timepilot2016evo' ||
      kind === 'ww1942' ||
      kind === 'ww1943'
    ) {
      if (kind === 'moonpatrol') {
        // Pink lunar buggy + wheels
        ctx.fillStyle = '#F472B6';
        ctx.beginPath();
        ctx.roundRect(5, 13, 22, 8, 3);
        ctx.fill();
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(14, 9, 7, 5);
        ctx.fillStyle = '#FACC15';
        [9, 16, 23].forEach((wx) => {
          ctx.beginPath();
          ctx.arc(wx, 23, 3.2, 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (kind === 'ww1942') {
        // 1942: Cobalt Pacific carrier deck + Silver P-38 Lightning with red-white-blue roundels
        ctx.fillStyle = '#0C4A6E';
        ctx.fillRect(0, 0, 32, 32);
        // Carrier deck stripe underneath
        ctx.fillStyle = '#334155';
        ctx.fillRect(9, 17, 14, 15);
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(15.3, 18, 1.4, 4);
        ctx.fillRect(15.3, 25, 1.4, 4);
        // Grounded shadow
        ctx.fillStyle = 'rgba(2,6,23,0.45)';
        ctx.fillRect(11, 14, 14, 3);
        // Twin-boom Silver P-38 Lightning
        ctx.fillStyle = '#E2E8F0';
        ctx.fillRect(14, 4, 4, 14);
        ctx.fillRect(3, 11.5, 26, 4.2);
        ctx.fillRect(8, 8.5, 2.8, 14.5);
        ctx.fillRect(21.2, 8.5, 2.8, 14.5);
        ctx.fillRect(8, 20.5, 16, 2.6);
        // Red nose & wing roundels
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(14.5, 3, 3, 2);
        ctx.fillStyle = '#1D4ED8';
        ctx.fillRect(5, 12.4, 2.4, 2.4);
        ctx.fillRect(24.6, 12.4, 2.4, 2.4);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(5.7, 13.1, 1, 1);
        ctx.fillRect(25.3, 13.1, 1, 1);
        // Canopy glint
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(15, 8.5, 2, 4);
      } else if (kind === 'ww1943') {
        // 1943 Midway: Golden sunset sea + Yamato gun deck + Emerald-trim P-38 + Lightning Mega-Crash
        const grad = ctx.createLinearGradient(0, 0, 0, 32);
        grad.addColorStop(0, '#0F172A');
        grad.addColorStop(0.55, '#9A3412');
        grad.addColorStop(1, '#1E3A5F');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 32, 32);
        // Battleship silhouette hull & dual turret below
        ctx.fillStyle = '#475569';
        ctx.fillRect(10, 19, 12, 13);
        ctx.fillStyle = '#94A3B8';
        ctx.beginPath();
        ctx.arc(16, 25, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#F97316';
        ctx.fillRect(14.6, 20.5, 1, 3.5);
        ctx.fillRect(16.4, 20.5, 1, 3.5);
        // Crackling Cyan Lightning Mega-Crash arcs
        ctx.strokeStyle = '#67E8F9';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(4, 2);
        ctx.lineTo(8, 8);
        ctx.lineTo(5, 13);
        ctx.lineTo(9, 20);
        ctx.moveTo(28, 3);
        ctx.lineTo(24, 9);
        ctx.lineTo(27, 15);
        ctx.lineTo(23, 22);
        ctx.stroke();
        // Emerald-trimmed silver P-38
        ctx.fillStyle = '#F1F5F9';
        ctx.fillRect(14.2, 4, 3.6, 12.5);
        ctx.fillRect(4.5, 10.5, 23, 3.8);
        ctx.fillRect(8.8, 8, 2.6, 12.5);
        ctx.fillRect(20.6, 8, 2.6, 12.5);
        ctx.fillRect(8.8, 18.5, 14.4, 2.4);
        ctx.fillStyle = '#10B981';
        ctx.fillRect(4.5, 10.5, 4.5, 3.8);
        ctx.fillRect(23, 10.5, 4.5, 3.8);
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(15, 7.5, 2, 3.5);
      } else if (kind === 'scramble') {
        // Scramble: Cavern ridge + glowing FUEL tank + Konami silver/emerald starfighter + bomb
        ctx.fillStyle = '#070D1A';
        ctx.fillRect(0, 0, 32, 32);
        ctx.fillStyle = '#92400E';
        ctx.beginPath();
        ctx.moveTo(0, 32);
        ctx.lineTo(0, 24);
        ctx.lineTo(10, 22);
        ctx.lineTo(18, 25);
        ctx.lineTo(26, 20);
        ctx.lineTo(32, 23);
        ctx.lineTo(32, 32);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(21, 16, 5, 6);
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(22, 17, 3, 2);
        ctx.fillStyle = '#4ADE80';
        ctx.beginPath();
        ctx.moveTo(23, 11);
        ctx.lineTo(8, 6);
        ctx.lineTo(5, 11);
        ctx.lineTo(8, 16);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(11, 9.5, 5, 3);
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.arc(14, 19, 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (kind === 'timepilot84') {
        // Time Pilot '84: Metallic space grid + silver-cyan interceptor + red missile lock reticle
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(0, 0, 32, 32);
        ctx.strokeStyle = 'rgba(56,189,248,0.28)';
        ctx.lineWidth = 1;
        ctx.strokeRect(4, 4, 24, 24);
        ctx.beginPath();
        ctx.moveTo(16, 2);
        ctx.lineTo(16, 30);
        ctx.moveTo(2, 16);
        ctx.lineTo(30, 16);
        ctx.stroke();
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(23, 9, 4.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#E2E8F0';
        ctx.beginPath();
        ctx.moveTo(26, 17);
        ctx.lineTo(10, 10);
        ctx.lineTo(7, 17);
        ctx.lineTo(10, 24);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(14, 15, 6, 4);
      } else if (kind === 'timepilot2016evo') {
        // Time Pilot: 2016 Evo — Neon prism chrono vortex + magenta/cyan starfighter
        const g = ctx.createRadialGradient(16, 16, 2, 16, 16, 16);
        g.addColorStop(0, '#701A75');
        g.addColorStop(0.6, '#1E1B4B');
        g.addColorStop(1, '#090D16');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 32, 32);
        ctx.strokeStyle = '#22D3EE';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(16, 16, 12.5, 0, Math.PI * 1.4);
        ctx.stroke();
        ctx.strokeStyle = '#F472B6';
        ctx.beginPath();
        ctx.arc(16, 16, 9, Math.PI * 0.6, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#F8FAFC';
        ctx.beginPath();
        ctx.moveTo(27, 16);
        ctx.lineTo(10, 9);
        ctx.lineTo(13, 16);
        ctx.lineTo(10, 23);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#F472B6';
        ctx.fillRect(14, 14.5, 6, 3);
      } else {
        // Time Pilot (1982): Sky clouds + classic 360° blue/silver fighter
        const sky = ctx.createLinearGradient(0, 0, 0, 32);
        sky.addColorStop(0, '#0284C7');
        sky.addColorStop(1, '#1E3A8A');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, 32, 32);
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.beginPath();
        ctx.arc(8, 8, 4, 0, Math.PI * 2);
        ctx.arc(12, 8, 3.2, 0, Math.PI * 2);
        ctx.arc(24, 24, 3.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#F8FAFC';
        ctx.beginPath();
        ctx.moveTo(28, 16);
        ctx.lineTo(11, 8);
        ctx.lineTo(5, 12);
        ctx.lineTo(9, 16);
        ctx.lineTo(5, 20);
        ctx.lineTo(11, 24);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(15, 14, 7, 4);
      }
    } else if (kind === 'starwars') {
      // 1983 Atari Color Vector: Glowing Gold/Cyan Wireframe Death Star + X-Wing Crosshair
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(16, 16, 11.5, 0, Math.PI * 2);
      ctx.stroke();
      // Equatorial trench + superlaser dish
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(4.5, 16);
      ctx.lineTo(27.5, 16);
      ctx.stroke();
      ctx.strokeStyle = '#4ADE80';
      ctx.beginPath();
      ctx.arc(20.5, 11, 3.2, 0, Math.PI * 2);
      ctx.stroke();
      // Red Five quad X-Wing laser convergence
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(4, 5);
      ctx.lineTo(13, 13);
      ctx.moveTo(28, 5);
      ctx.lineTo(19, 13);
      ctx.moveTo(4, 27);
      ctx.lineTo(13, 19);
      ctx.moveTo(28, 27);
      ctx.lineTo(19, 19);
      ctx.stroke();
    } else if (kind === 'starwarsesb') {
      // 1985 Atari Hoth Vector: Icy Cyan/White Wireframe AT-AT Imperial Walker + Golden Tow-Cable!
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.8;
      // AT-AT Armored Body
      ctx.strokeRect(11, 8, 13, 8);
      // AT-AT Head + Red Neck Weakpoint
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(8, 11);
      ctx.lineTo(11, 11);
      ctx.stroke();
      ctx.strokeStyle = '#E0F2FE';
      ctx.lineWidth = 1.7;
      ctx.strokeRect(4, 9, 4.5, 5);
      // 4 Articulated Legs
      ctx.beginPath();
      ctx.moveTo(13, 16);
      ctx.lineTo(11, 27);
      ctx.moveTo(16, 16);
      ctx.lineTo(17, 27);
      ctx.moveTo(20, 16);
      ctx.lineTo(19, 27);
      ctx.moveTo(23, 16);
      ctx.lineTo(25, 27);
      ctx.stroke();
      // Golden Harpoon Tow-Cable wrapped around legs
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(18, 22, 9, 2.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (kind === 'starwarsrotj') {
      // 1984 Atari 2.5D Raster: Sunlit Endor Green Backdrop + Shaded Millennium Falcon & Fireball!
      ctx.fillStyle = '#14532D';
      ctx.beginPath();
      ctx.arc(16, 16, 13, 0, Math.PI * 2);
      ctx.fill();
      // Roaring Raster Fireball glow behind Falcon
      ctx.fillStyle = '#F97316';
      ctx.beginPath();
      ctx.arc(9, 22, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(10, 21, 3.2, 0, Math.PI * 2);
      ctx.fill();
      // Shaded Millennium Falcon angled diagonally up-right
      ctx.save();
      ctx.translate(18, 14);
      ctx.rotate(-0.6);
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(-10, -4, 3, 8);
      ctx.fillStyle = '#E2E8F0';
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#CBD5E1';
      ctx.fillRect(3, -5, 8, 3.2);
      ctx.fillRect(3, 1.8, 8, 3.2);
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (kind === 'berzerk' || kind === 'robotron' || kind === 'robotron2016evo') {
      // Evil Otto smiley / Robotron neon humanoid / Robotron 2016 Evo Melt-o-Vision
      if (kind === 'berzerk') {
        // High-Voltage Neon Maze Walls + Glowing Evil Otto Smiley
        ctx.fillStyle = '#040814';
        ctx.fillRect(0, 0, 32, 32);
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2.2;
        ctx.strokeRect(2.5, 2.5, 27, 27);
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(16, 16.5, 9.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(12.5, 13.5, 1.9, 0, Math.PI * 2);
        ctx.arc(19.5, 13.5, 1.9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#4ADE80';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(16, 16.5, 5.5, 0.2, Math.PI - 0.2);
        ctx.stroke();
      } else if (kind === 'robotron2016evo') {
        // Psychedelic Melt-o-Vision RGB Chromatic Humanoid + Prism Aura
        const mg = ctx.createRadialGradient(16, 16, 2, 16, 16, 16);
        mg.addColorStop(0, '#EC4899');
        mg.addColorStop(0.55, '#4C1D95');
        mg.addColorStop(1, '#09061A');
        ctx.fillStyle = mg;
        ctx.fillRect(0, 0, 32, 32);
        ctx.strokeStyle = '#22D3EE';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(16, 16, 12.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(16, 16, 9.5, 0, Math.PI * 2);
        ctx.stroke();
        // Chromatic RGB split humanoid silhouette
        ctx.fillStyle = 'rgba(244,63,94,0.85)';
        ctx.fillRect(9.5, 13, 10, 9);
        ctx.fillStyle = 'rgba(34,211,238,0.85)';
        ctx.fillRect(12.5, 13, 10, 9);
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(16, 8.5, 3.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(11, 13, 10, 8.5);
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(5, 14, 6, 3);
        ctx.fillRect(21, 14, 6, 3);
        ctx.fillRect(11.5, 21.5, 3.2, 6);
        ctx.fillRect(17.3, 21.5, 3.2, 6);
      } else {
        ctx.fillStyle = '#EC4899';
        ctx.beginPath();
        ctx.arc(16, 8, 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(11, 13, 10, 9);
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(5, 14, 6, 3);
        ctx.fillRect(21, 14, 6, 3);
        ctx.fillRect(11, 22, 3.5, 6);
        ctx.fillRect(17.5, 22, 3.5, 6);
      }
    } else if (kind === 'frogger') {
      // Bright green frog silhouette
      ctx.fillStyle = '#22C55E';
      ctx.beginPath();
      ctx.ellipse(16, 17, 8, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(5, 11, 5, 4);
      ctx.fillRect(22, 11, 5, 4);
      ctx.fillRect(5, 21, 5, 5);
      ctx.fillRect(22, 21, 5, 5);
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(12.5, 11, 2.5, 0, Math.PI * 2);
      ctx.arc(19.5, 11, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'frogger2') {
      // ThreeeDeep: 3-tier Sky / Surface / Reef backdrop + leaping cyan-green frog
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(2, 2, 28, 9);
      ctx.fillStyle = '#0284C7';
      ctx.fillRect(2, 11, 28, 9);
      ctx.fillStyle = '#1E3A8A';
      ctx.fillRect(2, 20, 28, 10);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(4, 4, 8, 3);
      ctx.fillRect(20, 5, 7, 3);
      ctx.fillStyle = '#4ADE80';
      ctx.beginPath();
      ctx.ellipse(16, 17, 6.5, 7.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(7, 13, 4, 3);
      ctx.fillRect(21, 13, 4, 3);
      ctx.fillRect(7, 20, 4, 4);
      ctx.fillRect(21, 20, 4, 4);
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(13.2, 12.2, 2.1, 0, Math.PI * 2);
      ctx.arc(18.8, 12.2, 2.1, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'joust') {
      // Volcanic Colosseum Ostrich Knight + Gleaming Lance + Magma Glow
      const jg = ctx.createLinearGradient(0, 0, 0, 32);
      jg.addColorStop(0, '#0C0818');
      jg.addColorStop(0.75, '#451A03');
      jg.addColorStop(1, '#EA580C');
      ctx.fillStyle = jg;
      ctx.fillRect(0, 0, 32, 32);
      // Gleaming steel lance
      ctx.fillStyle = '#F8FAFC';
      ctx.beginPath();
      ctx.moveTo(4, 15.5);
      ctx.lineTo(29.5, 13.5);
      ctx.lineTo(29.5, 16.5);
      ctx.lineTo(4, 18.5);
      ctx.closePath();
      ctx.fill();
      // Golden Ostrich Mount & Wing
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.ellipse(13.5, 18.5, 6.5, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.moveTo(7, 17);
      ctx.lineTo(13, 12);
      ctx.lineTo(17, 18);
      ctx.closePath();
      ctx.fill();
      // Knight helmet + crimson plume
      ctx.fillStyle = '#E2E8F0';
      ctx.beginPath();
      ctx.arc(14.5, 11, 3.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(10.5, 6.5, 6, 3.2);
    } else if (kind === 'pengo') {
      // Red penguin + ice crystal cube
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(4, 4, 24, 24);
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(16, 17, 8.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(16, 19, 5, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.moveTo(13, 14);
      ctx.lineTo(19, 14);
      ctx.lineTo(16, 18);
      ctx.closePath();
      ctx.fill();
    } else if (kind === 'popeye') {
      // Green Spinach Can + golden heart
      ctx.fillStyle = '#16A34A';
      ctx.fillRect(8, 7, 16, 20);
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(7, 5, 18, 3);
      ctx.fillRect(7, 25, 18, 3);
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(16, 16, 4.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'mrdo') {
      // Red cherry pair + clown hat
      ctx.strokeStyle = '#4ADE80';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(11, 18);
      ctx.quadraticCurveTo(16, 5, 21, 18);
      ctx.stroke();
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(11, 21, 5.5, 0, Math.PI * 2);
      ctx.arc(21, 21, 5.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'spyhunter') {
      // White G-6155 Interceptor top-down
      ctx.fillStyle = '#F8FAFC';
      ctx.beginPath();
      ctx.roundRect(10, 4, 12, 24, 4);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(12, 10, 8, 9);
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(11, 24, 3, 3);
      ctx.fillRect(18, 24, 3, 3);
    } else if (kind === 'spyhunter2') {
      // Spy Hunter II: 3D behind-the-car highway + twin-turret G-8155 + nitro jet flames
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(12, 5);
      ctx.lineTo(20, 5);
      ctx.lineTo(30, 32);
      ctx.lineTo(2, 32);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(15.2, 8, 1.6, 5);
      // Rear-chase G-8155 coupe
      ctx.fillStyle = '#F8FAFC';
      ctx.beginPath();
      ctx.roundRect(8, 14, 16, 11, 3);
      ctx.fill();
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(10.5, 15.5, 11, 4);
      ctx.fillStyle = '#F97316';
      ctx.fillRect(10, 25, 4, 5);
      ctx.fillRect(18, 25, 4, 5);
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(8.5, 21, 3, 2.5);
      ctx.fillRect(20.5, 21, 3, 2.5);
    } else if (kind === 'tapper' || kind === 'roottapper') {
      // Tapper (1983 Budweiser Crimson/Gold Bowtie + Draft Mug) vs Root Beer Tapper (1984 Mahogany Soda Mug)
      if (kind === 'tapper') {
        ctx.fillStyle = '#7F1D1D';
        ctx.fillRect(0, 0, 32, 32);
        // Classic crimson-gold bowtie crest ribbon
        ctx.fillStyle = '#DC2626';
        ctx.beginPath();
        ctx.moveTo(2, 16);
        ctx.lineTo(16, 7);
        ctx.lineTo(30, 16);
        ctx.lineTo(16, 25);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 1.4;
        ctx.stroke();
        // Golden frothy draft mug
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(9, 12, 11, 14);
        ctx.strokeStyle = '#FEF08A';
        ctx.lineWidth = 2;
        ctx.strokeRect(20, 14.5, 4, 7.5);
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(12, 11, 3.6, 0, Math.PI * 2);
        ctx.arc(17, 11, 3.6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#431407';
        ctx.fillRect(0, 0, 32, 32);
        ctx.fillStyle = '#9A3412';
        ctx.fillRect(7, 11, 14, 17);
        ctx.fillStyle = '#C2410C';
        ctx.fillRect(9, 13, 4, 13);
        ctx.strokeStyle = '#FDBA74';
        ctx.lineWidth = 2.4;
        ctx.strokeRect(21, 14, 5, 9);
        ctx.fillStyle = '#FFFBEB';
        ctx.beginPath();
        ctx.arc(11, 10, 4.5, 0, Math.PI * 2);
        ctx.arc(17, 10, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (kind === 'puzzlebobble' || kind === 'puzzlebobble2' || kind === 'puzzlebobble3') {
      // Shimmering 2.5D jewel bubble cluster (classic trio, PB2 star-fairy pink, PB3 rainbow prism)
      const bbs: Array<[number, number, string, string]> =
        kind === 'puzzlebobble3'
          ? [
              [16, 9, '#FEF08A', '#F59E0B'],
              [9.5, 20.5, '#F472B6', '#9333EA'],
              [22.5, 20.5, '#67E8F9', '#2563EB'],
            ]
          : kind === 'puzzlebobble2'
          ? [
              [16, 9, '#FEF08A', '#D97706'],
              [9.5, 20.5, '#F9A8D4', '#DB2777'],
              [22.5, 20.5, '#7DD3FC', '#0284C7'],
            ]
          : [
              [16, 9, '#FCA5A5', '#DC2626'],
              [9.5, 20.5, '#7DD3FC', '#2563EB'],
              [22.5, 20.5, '#86EFAC', '#16A34A'],
            ];
      bbs.forEach(([bx, by, light, dark]) => {
        const g = ctx.createRadialGradient(bx - 2.2, by - 2.2, 0.8, bx, by, 6.8);
        g.addColorStop(0, '#FFFFFF');
        g.addColorStop(0.35, light);
        g.addColorStop(1, dark);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(bx, by, 6.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.arc(bx - 2.1, by - 2.3, 1.8, 0, Math.PI * 2);
        ctx.fill();
      });
      if (kind !== 'puzzlebobble') {
        // Sparkle star glint on PB2 & PB3 Evo
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(16, 4.5);
        ctx.lineTo(17.4, 7.6);
        ctx.lineTo(20.5, 9);
        ctx.lineTo(17.4, 10.4);
        ctx.lineTo(16, 13.5);
        ctx.lineTo(14.6, 10.4);
        ctx.lineTo(11.5, 9);
        ctx.lineTo(14.6, 7.6);
        ctx.closePath();
        ctx.fill();
      }
    } else if (kind === 'crystalcastles') {
      // 3D Isometric Crystal Castle Tower + Sparkling Prism Gem + Bentley Bear Ears
      ctx.fillStyle = '#0D0821';
      ctx.fillRect(0, 0, 32, 32);
      // Left & Right 3D crystal cube faces
      ctx.fillStyle = '#7E22CE';
      ctx.beginPath();
      ctx.moveTo(5, 14);
      ctx.lineTo(16, 20);
      ctx.lineTo(16, 29);
      ctx.lineTo(5, 23);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#A855F7';
      ctx.beginPath();
      ctx.moveTo(27, 14);
      ctx.lineTo(16, 20);
      ctx.lineTo(16, 29);
      ctx.lineTo(27, 23);
      ctx.closePath();
      ctx.fill();
      // Top crystal deck
      ctx.fillStyle = '#E9D5FF';
      ctx.beginPath();
      ctx.moveTo(16, 8);
      ctx.lineTo(27, 14);
      ctx.lineTo(16, 20);
      ctx.lineTo(5, 14);
      ctx.closePath();
      ctx.fill();
      // Sparkling cyan gem on summit
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.moveTo(16, 2.5);
      ctx.lineTo(20.5, 8.5);
      ctx.lineTo(16, 14.5);
      ctx.lineTo(11.5, 8.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(15.2, 7.2, 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'rampage') {
      // Giant monster fist smashing skyscraper
      ctx.fillStyle = '#475569';
      ctx.fillRect(7, 8, 18, 21);
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(10, 11, 4, 4);
      ctx.fillRect(18, 11, 4, 4);
      ctx.fillRect(10, 18, 4, 4);
      ctx.fillStyle = '#22C55E';
      ctx.beginPath();
      ctx.arc(22, 20, 7, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'dragonslair') {
      // Golden Dirk sword + dragon eye
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(7, 25);
      ctx.lineTo(25, 7);
      ctx.moveTo(11, 15);
      ctx.lineTo(18, 22);
      ctx.stroke();
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(23, 23, 4.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'smw1' || kind === 'smw2') {
      // Yoshi spotted egg (SMW1 gold/green, SMW2 emerald spots)
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(16, 16.5, 10, 12.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = kind === 'smw1' ? '#FACC15' : '#22C55E';
      ctx.beginPath();
      ctx.arc(12, 13, 3.2, 0, Math.PI * 2);
      ctx.arc(20, 17, 3.6, 0, Math.PI * 2);
      ctx.arc(13, 22, 2.6, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'ys1' || kind === 'ys2') {
      // Crimson / Sapphire Ys Crest Blade
      ctx.fillStyle = kind === 'ys1' ? '#EF4444' : '#38BDF8';
      ctx.beginPath();
      ctx.moveTo(16, 3);
      ctx.lineTo(26, 16);
      ctx.lineTo(16, 29);
      ctx.lineTo(6, 16);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(14.5, 7, 3, 18);
      ctx.fillRect(10, 18, 12, 3);
    } else if (kind === 'mule') {
      // M.U.L.E. (1983 HD): Planet Irata ochre horizon + articulated mechanical M.U.L.E.
      const mg = ctx.createLinearGradient(0, 0, 0, 32);
      mg.addColorStop(0, '#2A120E');
      mg.addColorStop(0.65, '#B45309');
      mg.addColorStop(1, '#78350F');
      ctx.fillStyle = mg;
      ctx.fillRect(0, 0, 32, 32);
      // River stripe
      ctx.fillStyle = '#0284C7';
      ctx.fillRect(2, 22, 28, 4);
      // Articulated white/amber M.U.L.E.
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(6, 13, 15, 7);
      ctx.fillRect(19, 8, 6.5, 6);
      ctx.fillStyle = '#4ADE80';
      ctx.fillRect(8, 9, 9, 4.5);
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(7, 20, 2.5, 7);
      ctx.fillRect(11.5, 20, 2.5, 7);
      ctx.fillRect(16, 20, 2.5, 7);
      ctx.fillRect(19.5, 20, 2.5, 7);
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(22.5, 10, 2, 2);
    } else if (kind === 'muleevo') {
      // M.U.L.E. Returns: Evolved — Orbital twilight + cyan Synergy Conduit M.U.L.E. + Crystite Spire
      const eg = ctx.createLinearGradient(0, 0, 0, 32);
      eg.addColorStop(0, '#070B1A');
      eg.addColorStop(0.6, '#1E1B4B');
      eg.addColorStop(1, '#431407');
      ctx.fillStyle = eg;
      ctx.fillRect(0, 0, 32, 32);
      // Glowing cyan radar ring
      ctx.strokeStyle = '#22D3EE';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(16, 16, 12.5, 0, Math.PI * 2);
      ctx.stroke();
      // Mechanical Evolved M.U.L.E. with Crystite plasma core
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(6, 14, 15, 6.5);
      ctx.fillRect(19.5, 9, 6, 5.5);
      ctx.fillStyle = '#E879F9';
      ctx.fillRect(8, 9.5, 9, 4.5);
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(7.5, 20.5, 2.4, 6.5);
      ctx.fillRect(12, 20.5, 2.4, 6.5);
      ctx.fillRect(16.5, 20.5, 2.4, 6.5);
      ctx.fillRect(20, 20.5, 2.4, 6.5);
      ctx.fillStyle = '#22D3EE';
      ctx.fillRect(22.8, 10.6, 2.2, 2.2);
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
    case 'invadersdx':
    case 'foodfight':
    case 'gauntlet':
    case 'gauntlet2':
    case 'gauntletdl':
    case 'polepos':
    case 'polepos2':
    case 'sprint1':
    case 'sprint':
    case 'sprint4':
    case 'sprint8':
    case 'supersprint':
    case 'champsprint':
    case 'badlands':
    case 'superoffroad':
    case 'indyheat':
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
    case 'superbreakout':
    case 'arkanoid':
    case 'arkanoid2':
    case 'breakout2016evo':
    case 'asteroidsdeluxe':
    case 'spaceduel':
    case 'starcastle':
    case 'missilecommand':
    case 'qix':
    case 'superqix':
    case 'galaxian':
    case 'galaga':
    case 'phoenix':
    case 'gyruss':
    case 'scramble':
    case 'moonpatrol':
    case 'timepilot':
    case 'timepilot84':
    case 'timepilot2016evo':
    case 'ww1942':
    case 'ww1943':
    case 'starwars':
    case 'starwarsesb':
    case 'starwarsrotj':
    case 'berzerk':
    case 'robotron':
    case 'robotron2016evo':
    case 'frogger':
    case 'frogger2':
    case 'joust':
    case 'pengo':
    case 'popeye':
    case 'mrdo':
    case 'spyhunter':
    case 'spyhunter2':
    case 'tapper':
    case 'roottapper':
    case 'puzzlebobble':
    case 'puzzlebobble2':
    case 'puzzlebobble3':
    case 'crystalcastles':
    case 'rampage':
    case 'dragonslair':
    case 'smw1':
    case 'smw2':
    case 'ys1':
    case 'ys2':
    case 'mule':
    case 'muleevo':
      return <ClassicIconCanvas kind={gameId} size={size} className={className} />;
    default:
      return <ClassicPacManEmblem size={size} className={className} />;
  }
}

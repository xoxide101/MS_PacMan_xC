'use client';

import { useEffect, useRef } from 'react';
import { GameId } from '@/lib/game/arcadeTypes';
import { ClassicPacManEngine } from '@/lib/game/classicEngine';
import { ClassicPacManRenderer } from '@/lib/game/classicRenderer';
import { createClassicArcadeGame, isClassicArcadeGameId } from '@/lib/game/classicRegistry';
import { MsPacManEngine } from '@/lib/game/engine';
import { JrPacManEngine } from '@/lib/game/jrEngine';
import { JrPacManRenderer } from '@/lib/game/jrRenderer';
import { JR_VIEWPORT_HEIGHT, JR_VIEWPORT_WIDTH } from '@/lib/game/jrTypes';
import { PacManiaEngine } from '@/lib/game/pacmaniaEngine';
import { PacManiaRenderer } from '@/lib/game/pacmaniaRenderer';
import { PM_VIEWPORT_HEIGHT, PM_VIEWPORT_WIDTH } from '@/lib/game/pacmaniaTypes';
import { PacManPlusEngine } from '@/lib/game/plusEngine';
import { PacManPlusRenderer } from '@/lib/game/plusRenderer';
import { MsPacManRenderer } from '@/lib/game/renderer';
import { SuperPacManEngine } from '@/lib/game/superEngine';
import { SuperPacManRenderer } from '@/lib/game/superRenderer';
import { CANVAS_LOGICAL_HEIGHT, CANVAS_LOGICAL_WIDTH } from '@/lib/game/types';

const FIXED_STEP = 1 / 60;

interface CabinetPreviewCanvasProps {
  game: GameId;
}

export default function CabinetPreviewCanvas({ game }: CabinetPreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let rafId = 0;
    let lastTime = performance.now();
    let accumulator = 0;

    const runLoop = (
      logicalW: number,
      logicalH: number,
      stepFn: (dt: number) => void,
      renderFn: () => void
    ) => {
      canvas.width = Math.round(logicalW * dpr);
      canvas.height = Math.round(logicalH * dpr);

      const tick = (now: number) => {
        const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
        lastTime = now;
        accumulator += dt;
        while (accumulator >= FIXED_STEP) {
          stepFn(FIXED_STEP);
          accumulator -= FIXED_STEP;
        }
        renderFn();
        rafId = window.requestAnimationFrame(tick);
      };
      rafId = window.requestAnimationFrame(tick);
    };

    if (isClassicArcadeGameId(game)) {
      const instance = createClassicArcadeGame(game);
      runLoop(
        instance.logicalWidth,
        instance.logicalHeight,
        (dt) => instance.step(dt),
        () => instance.render(ctx, dpr, 'hd')
      );
    } else if (game === 'classic') {
      const engine = new ClassicPacManEngine();
      const renderer = new ClassicPacManRenderer();
      runLoop(
        CANVAS_LOGICAL_WIDTH,
        CANVAS_LOGICAL_HEIGHT,
        (dt) => engine.step(dt),
        () => renderer.render(ctx, engine, dpr, 'hd')
      );
    } else if (game === 'plus') {
      const engine = new PacManPlusEngine();
      const renderer = new PacManPlusRenderer();
      runLoop(
        CANVAS_LOGICAL_WIDTH,
        CANVAS_LOGICAL_HEIGHT,
        (dt) => engine.step(dt),
        () => renderer.render(ctx, engine, dpr, 'hd')
      );
    } else if (game === 'ms') {
      const engine = new MsPacManEngine();
      const renderer = new MsPacManRenderer();
      runLoop(
        CANVAS_LOGICAL_WIDTH,
        CANVAS_LOGICAL_HEIGHT,
        (dt) => engine.step(dt),
        () => renderer.render(ctx, engine, dpr, 'hd')
      );
    } else if (game === 'super') {
      const engine = new SuperPacManEngine();
      const renderer = new SuperPacManRenderer();
      runLoop(
        CANVAS_LOGICAL_WIDTH,
        CANVAS_LOGICAL_HEIGHT,
        (dt) => engine.step(dt),
        () => renderer.render(ctx, engine, dpr, 'hd')
      );
    } else if (game === 'jr') {
      const engine = new JrPacManEngine();
      const renderer = new JrPacManRenderer();
      runLoop(
        JR_VIEWPORT_WIDTH,
        JR_VIEWPORT_HEIGHT,
        (dt) => engine.step(dt),
        () => renderer.render(ctx, engine, dpr, 'hd')
      );
    } else {
      const engine = new PacManiaEngine();
      const renderer = new PacManiaRenderer();
      runLoop(
        PM_VIEWPORT_WIDTH,
        PM_VIEWPORT_HEIGHT,
        (dt) => engine.step(dt),
        () => renderer.render(ctx, engine, dpr, 'hd')
      );
    }

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [game]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full object-cover object-center block"
      aria-hidden="true"
    />
  );
}

export type ClassicGamePhase = 'TITLE' | 'READY' | 'PLAYING' | 'PAUSED' | 'STAGE_CLEAR' | 'GAME_OVER';

export interface ArcadeInputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  fire: boolean;
  fireJustPressed: boolean;
  secondary: boolean;
  secondaryJustPressed: boolean;
  pointerActive: boolean;
  pointerX: number; // normalized 0..1 across canvas logical width
  pointerY: number; // normalized 0..1 across canvas logical height
}

export interface ClassicGameHud {
  phase: ClassicGamePhase;
  score: number;
  highScore: number;
  level: number;
  lives: number;
  stageName: string;
  primaryMetricLabel: string;
  primaryMetricValue: string;
  secondaryMetricLabel: string;
  secondaryMetricValue: string;
  bannerText: string;
  canRestartStage?: boolean;
}

export interface ArcadeGameInstance {
  readonly logicalWidth: number;
  readonly logicalHeight: number;
  readonly supportsPointerAim: boolean;
  readonly primaryActionLabel: string;
  readonly secondaryActionLabel?: string;
  step(dt: number): void;
  render(ctx: CanvasRenderingContext2D, dpr: number, visualMode: 'hd' | 'crt'): void;
  startNewGame(): void;
  togglePause(): void;
  resetToTitle(): void;
  restartStage?(): void;
  setInput(input: ArcadeInputState): void;
  getHudSnapshot(): ClassicGameHud;
}

export interface SimpleParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  radius: number;
}

export interface ScorePopup {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export function readHighScore(key: string): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export function saveHighScore(key: string, value: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, String(Math.floor(value)));
  } catch {
    // ignore storage quota errors
  }
}

export function spawnBurst(
  particles: SimpleParticle[],
  x: number,
  y: number,
  color: string,
  count = 14,
  speed = 180,
  radius = 3.2
): void {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.45;
    const spd = speed * (0.4 + Math.random() * 0.85);
    const maxLife = 0.28 + Math.random() * 0.34;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      life: maxLife,
      maxLife,
      color,
      radius: radius * (0.65 + Math.random() * 0.65),
    });
  }
}

export function stepParticlesAndPopups(
  particles: SimpleParticle[],
  popups: ScorePopup[],
  dt: number
): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - Math.min(0.95, dt * 3.5);
    p.vy *= 1 - Math.min(0.95, dt * 3.5);
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = popups.length - 1; i >= 0; i--) {
    const pop = popups[i];
    pop.y -= 28 * dt;
    pop.life -= dt;
    if (pop.life <= 0) popups.splice(i, 1);
  }
}

export function renderParticlesAndPopups(
  ctx: CanvasRenderingContext2D,
  particles: SimpleParticle[],
  popups: ScorePopup[]
): void {
  for (const p of particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * (0.4 + 0.6 * alpha), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (const pop of popups) {
    const alpha = Math.min(1, (pop.life / pop.maxLife) * 1.6);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '700 15px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#04060D';
    ctx.fillText(pop.text, pop.x + 1.5, pop.y + 1.5);
    ctx.fillStyle = pop.color;
    ctx.fillText(pop.text, pop.x, pop.y);
    ctx.restore();
  }
}

export function renderCrtOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  for (let y = 0; y < height; y += 4) {
    ctx.fillRect(0, y, width, 1.5);
  }
  const vig = ctx.createRadialGradient(
    width * 0.5,
    height * 0.5,
    Math.min(width, height) * 0.36,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.72
  );
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

export function createEmptyInput(): ArcadeInputState {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    fire: false,
    fireJustPressed: false,
    secondary: false,
    secondaryJustPressed: false,
    pointerActive: false,
    pointerX: 0.5,
    pointerY: 0.85,
  };
}

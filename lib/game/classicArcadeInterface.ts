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
  /** Optional precision movement multiplier (0.45..1.0) from cabinet speed control */
  moveScale?: number;
  /** Optional smooth proportional axes (-1..1) from virtual thumbstick or device accelerometer tilt */
  analogX?: number;
  analogY?: number;
  /** True when device accelerometer/orientation tilt steering is active */
  tiltActive?: boolean;
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
    const rad = p.radius * (0.35 + 0.65 * alpha);
    ctx.save();
    ctx.globalAlpha = alpha * 0.4;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, rad * 2.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
    ctx.fill();

    // Hot specular core for crisp arcade impact punch
    ctx.globalAlpha = alpha * 0.85;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(p.x, p.y, rad * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (const pop of popups) {
    const t = Math.max(0, pop.life / pop.maxLife);
    const alpha = Math.min(1, t * 1.8);
    const popScale = t > 0.85 ? 1 + (1 - t) * 1.4 : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(pop.x, pop.y);
    ctx.scale(popScale, popScale);
    ctx.font = '800 15px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(4, 6, 15, 0.92)';
    ctx.strokeText(pop.text, 0, 0);
    ctx.fillStyle = pop.color;
    ctx.fillText(pop.text, 0, 0);
    ctx.restore();
  }
}

export function renderCrtOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  ctx.save();
  // Authentic fine arcade scanlines
  ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
  for (let y = 0; y < height; y += 3) {
    ctx.fillRect(0, y, width, 1.2);
  }
  // Subtle aperture-grille phosphor columns
  ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
  for (let x = 0; x < width; x += 6) {
    ctx.fillRect(x, 0, 1, height);
  }
  // Curved CRT glass tube vignette & subtle top reflection sheen
  const sheen = ctx.createLinearGradient(0, 0, 0, height * 0.16);
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
  sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, width, height * 0.16);

  const vig = ctx.createRadialGradient(
    width * 0.5,
    height * 0.5,
    Math.min(width, height) * 0.34,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.72
  );
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(0.75, 'rgba(0,0,0,0.14)');
  vig.addColorStop(1, 'rgba(0,0,0,0.48)');
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
    moveScale: 0.8,
    analogX: 0,
    analogY: 0,
    tiltActive: false,
  };
}

/**
 * Returns normalized movement vector (-1..1) blending smooth analog/tilt axes with digital keys
 * and applying the user's precision moveScale multiplier.
 */
export function getPrecisionMoveVector(input: ArcadeInputState): { vx: number; vy: number; scale: number } {
  const scale = input.moveScale !== undefined ? Math.max(0.35, Math.min(1.15, input.moveScale)) : 1;
  const ax = input.analogX ?? 0;
  const ay = input.analogY ?? 0;
  if (Math.hypot(ax, ay) > 0.04) {
    const mag = Math.hypot(ax, ay);
    const clampedMag = Math.min(1, mag);
    return {
      vx: (ax / mag) * clampedMag * scale,
      vy: (ay / mag) * clampedMag * scale,
      scale,
    };
  }
  let dx = 0;
  let dy = 0;
  if (input.left) dx -= 1;
  if (input.right) dx += 1;
  if (input.up) dy -= 1;
  if (input.down) dy += 1;
  const mag = Math.hypot(dx, dy);
  if (mag > 0) {
    return { vx: (dx / mag) * scale, vy: (dy / mag) * scale, scale };
  }
  return { vx: 0, vy: 0, scale };
}

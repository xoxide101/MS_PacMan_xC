// ============================================================================
// HD Retro-Evolved Graphics & Animation Primitives
// Faithful to iconic original arcade / 8-bit / 16-bit silhouettes while
// elevating shading, cel-highlights, articulation, and 60fps animation detail.
// ============================================================================

export function drawPixelMatrixHD(
  ctx: CanvasRenderingContext2D,
  rows: readonly string[],
  cx: number,
  cy: number,
  cell: number,
  palette: Record<string, string>,
  glowColor?: string
): void {
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  const ox = cx - (w * cell) * 0.5;
  const oy = cy - (h * cell) * 0.5;

  ctx.save();
  if (glowColor) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = cell * 2.2;
  }

  for (let r = 0; r < h; r++) {
    const row = rows[r];
    for (let c = 0; c < w; c++) {
      const ch = row[c];
      if (ch === '.' || ch === ' ') continue;
      const col = palette[ch];
      if (!col) continue;
      const px = ox + c * cell;
      const py = oy + r * cell;

      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.roundRect(px + 0.25, py + 0.25, cell - 0.5, cell - 0.5, Math.max(0.8, cell * 0.24));
      ctx.fill();
    }
  }

  // Subtle top specular micro-bevel for evolved HD crispness (no shadow overhead)
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
  for (let r = 0; r < h; r++) {
    const row = rows[r];
    for (let c = 0; c < w; c++) {
      const ch = row[c];
      if (ch === '.' || ch === ' ' || !palette[ch]) continue;
      // Only add top rim highlight if pixel above is empty or different
      const above = r > 0 ? rows[r - 1][c] : '.';
      if (above === '.' || above === ' ') {
        const px = ox + c * cell;
        const py = oy + r * cell;
        ctx.fillRect(px + 0.6, py + 0.4, cell - 1.2, Math.max(1, cell * 0.28));
      }
    }
  }
  ctx.restore();
}

export function drawSoftShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  alpha = 0.36
): void {
  ctx.save();
  ctx.fillStyle = `rgba(2, 6, 18, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawStarGlint(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color = '#FFFFFF',
  rot = 0
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rad = i % 2 === 0 ? r : r * 0.24;
    if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
    else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ============================================================================
// Authentic Evolved Mario / Luigi / Peach / Toad / Jumpman Character Renderer
// ============================================================================
export interface HDMarioOptions {
  x: number;
  y: number;
  facing: 1 | -1;
  scale?: number;
  walkPhase?: number;
  isMoving?: boolean;
  isJumping?: boolean;
  isClimbing?: boolean;
  shirtColor?: string;
  overallColor?: string;
  capLetter?: 'M' | 'L' | '';
  character?: 'mario' | 'luigi' | 'peach' | 'toad' | 'jumpman';
  isRaccoon?: boolean;
  tailSpin?: boolean;
  hammerSwing?: number | null;
  carryingVeggie?: boolean;
  clock?: number;
}

export function drawHDMarioHero(ctx: CanvasRenderingContext2D, opts: HDMarioOptions): void {
  const {
    x,
    y,
    facing,
    scale = 1,
    walkPhase = 0,
    isMoving = false,
    isJumping = false,
    isClimbing = false,
    character = 'mario',
    isRaccoon = false,
    tailSpin = false,
    hammerSwing = null,
    carryingVeggie = false,
    clock = 0,
  } = opts;

  const shirt =
    opts.shirtColor ??
    (character === 'luigi'
      ? '#16A34A'
      : character === 'peach'
      ? '#F472B6'
      : character === 'toad'
      ? '#2563EB'
      : character === 'jumpman'
      ? '#2563EB'
      : '#EF4444');

  const overalls =
    opts.overallColor ??
    (character === 'jumpman'
      ? '#DC2626'
      : character === 'peach'
      ? '#EC4899'
      : character === 'toad'
      ? '#F8FAFC'
      : '#1D4ED8');

  const stride = isJumping ? 1 : isMoving ? Math.sin(walkPhase) : 0;
  const bob = isMoving && !isJumping ? Math.abs(Math.cos(walkPhase)) * -2.2 : 0;

  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(facing * scale, scale);

  // Ground contact shadow when standing/running
  if (!isJumping && !isClimbing) {
    drawSoftShadow(ctx, 0, 22, 11, 3.5, 0.34);
  }

  // Raccoon Tail (SMB3) behind body
  if (isRaccoon) {
    ctx.save();
    const wag = tailSpin ? Math.sin(clock * 46) * 0.9 : Math.sin(clock * 14) * 0.25;
    ctx.translate(-8, 10);
    ctx.rotate(-0.35 + wag);
    const tailLen = tailSpin ? 22 : 16;
    ctx.fillStyle = '#B45309';
    ctx.strokeStyle = '#451A03';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(-tailLen * 0.5, 0, tailLen * 0.62, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Iconic dark brown raccoon tail stripes
    ctx.fillStyle = '#451A03';
    ctx.fillRect(-tailLen * 0.38, -4.5, 3.5, 9);
    ctx.fillRect(-tailLen * 0.72, -4, 3.5, 8);
    ctx.restore();
  }

  // Back arm
  ctx.save();
  const backArmAngle = isJumping ? -2.3 : carryingVeggie ? -2.7 : -stride * 0.7;
  ctx.translate(-3, 0);
  ctx.rotate(backArmAngle);
  ctx.fillStyle = shirt;
  ctx.strokeStyle = '#1E1B24';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(-3.5, -1, 7, 11, 3.5);
  ctx.fill();
  ctx.stroke();
  // White glove
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(0, 10, 3.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Legs & work boots (animated stride!)
  if (character === 'peach') {
    // Flowing cel-shaded pink gown + flutter hem
    const hemWave = Math.sin(clock * 14) * (isJumping ? 3.5 : 1.2);
    const dressGrad = ctx.createLinearGradient(-12, -2, 12, 20);
    dressGrad.addColorStop(0, '#F9A8D4');
    dressGrad.addColorStop(0.55, '#EC4899');
    dressGrad.addColorStop(1, '#BE185D');
    ctx.fillStyle = dressGrad;
    ctx.strokeStyle = '#500724';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-7, -2);
    ctx.lineTo(7, -2);
    ctx.lineTo(13 + hemWave * 0.5, 19);
    ctx.quadraticCurveTo(0, 23 - hemWave * 0.4, -13 - hemWave * 0.5, 19);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Peplum ruffle
    ctx.fillStyle = '#FBCFE8';
    ctx.beginPath();
    ctx.ellipse(0, 5, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Back leg
    ctx.save();
    ctx.translate(-3, 11);
    ctx.rotate(-stride * 0.65);
    ctx.fillStyle = overalls;
    ctx.fillRect(-3.5, 0, 7, 8);
    ctx.fillStyle = '#78350F';
    ctx.strokeStyle = '#291002';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(-4, 6, 10, 6.5, 3);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Front leg
    ctx.save();
    ctx.translate(3, 11);
    ctx.rotate(stride * 0.65);
    ctx.fillStyle = overalls;
    ctx.fillRect(-3.5, 0, 7, 8);
    ctx.fillStyle = '#92400E';
    ctx.strokeStyle = '#291002';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(-4, 6, 10.5, 6.5, 3);
    ctx.fill();
    ctx.stroke();
    // Boot highlight
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(-1, 7.2, 5, 2);
    ctx.restore();

    // Torso shirt & overalls with brass buttons
    ctx.fillStyle = shirt;
    ctx.strokeStyle = '#1E1B24';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.roundRect(-9.5, -4, 19, 15, 6);
    ctx.fill();
    ctx.stroke();

    // Overalls bib + straps
    const ovGrad = ctx.createLinearGradient(-8, 1, 8, 14);
    ovGrad.addColorStop(0, overalls);
    ovGrad.addColorStop(1, '#0F172A');
    ctx.fillStyle = overalls;
    ctx.beginPath();
    ctx.roundRect(-8, 2, 16, 12, 4);
    ctx.fill();
    ctx.stroke();
    // Straps
    ctx.fillRect(-6, -3, 3.5, 7);
    ctx.fillRect(2.5, -3, 3.5, 7);
    // Brass buttons
    ctx.fillStyle = '#FDE047';
    ctx.strokeStyle = '#92400E';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.arc(-4.2, 4.2, 2.1, 0, Math.PI * 2);
    ctx.arc(4.2, 4.2, 2.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Head
  const headGrad = ctx.createRadialGradient(-2, -14, 2, 1, -11, 11);
  headGrad.addColorStop(0, '#FED7AA');
  headGrad.addColorStop(0.75, '#FDBA74');
  headGrad.addColorStop(1, '#EA9A54');
  ctx.fillStyle = headGrad;
  ctx.strokeStyle = '#431407';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(0.5, -11, 9.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (character === 'peach') {
    // Flowing golden hair & royal crown
    ctx.fillStyle = '#FACC15';
    ctx.strokeStyle = '#854D0E';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(-3, -13, 9, Math.PI * 0.55, Math.PI * 1.9);
    ctx.lineTo(-10, 4);
    ctx.lineTo(-4, 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Crown
    ctx.fillStyle = '#FDE047';
    ctx.beginPath();
    ctx.moveTo(-5, -20);
    ctx.lineTo(-6, -27);
    ctx.lineTo(-1, -23);
    ctx.lineTo(2, -28);
    ctx.lineTo(5, -23);
    ctx.lineTo(7, -27);
    ctx.lineTo(6, -20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Eyes
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(4.5, -12, 2.4, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2563EB';
    ctx.beginPath();
    ctx.arc(5.2, -12, 1.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (character === 'toad') {
    // Iconic bulbous white mushroom cap with red spots!
    ctx.fillStyle = '#F8FAFC';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(0, -19, 13.5, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(-6, -19, 4.2, 0, Math.PI * 2);
    ctx.arc(5, -21, 4.4, 0, Math.PI * 2);
    ctx.arc(7, -14, 3, 0, Math.PI * 2);
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.ellipse(3.5, -10.5, 1.7, 2.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(3.2, -12.2, 1.1, 1.3);
  } else {
    // Classic Mario / Luigi / Jumpman face!
    // Sideburn & back hair
    ctx.fillStyle = '#451A03';
    ctx.beginPath();
    ctx.roundRect(-9, -15, 5, 9, 2);
    ctx.fill();

    // Rounded bulbous nose
    ctx.fillStyle = '#FDBA74';
    ctx.strokeStyle = '#9A3412';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.ellipse(8.8, -10.2, 4.2, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Expressive eye with white sclera + blue iris + catchlight
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(4.5, -13.5, 2.3, 3.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.ellipse(5.2, -13.4, 1.3, 2.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(4.8, -14.8, 1.1, 1.2);

    // Iconic scalloped dark mustache
    ctx.fillStyle = '#291002';
    ctx.beginPath();
    ctx.moveTo(1, -8.5);
    ctx.quadraticCurveTo(6.5, -9.8, 11.8, -7.2);
    ctx.quadraticCurveTo(9, -4.2, 6, -5.6);
    ctx.quadraticCurveTo(3.2, -4.4, 1, -6.2);
    ctx.closePath();
    ctx.fill();

    // Peaked Cap with white emblem badge
    const capCol = character === 'jumpman' ? '#EF4444' : shirt;
    ctx.fillStyle = capCol;
    ctx.strokeStyle = '#1E1B24';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(0, -16, 10.2, Math.PI, 0);
    ctx.lineTo(13, -15.5);
    ctx.quadraticCurveTo(13, -18.8, 7.5, -18.5);
    ctx.lineTo(-10, -16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cap specular & emblem circle
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(3.2, -20.5, 3.3, 0, Math.PI * 2);
    ctx.fill();
    if (opts.capLetter !== '') {
      ctx.fillStyle = capCol;
      ctx.font = '900 5.5px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(opts.capLetter ?? (character === 'luigi' ? 'L' : 'M'), 3.2, -20.2);
    }
  }

  // Raccoon Ears on Cap (SMB3)
  if (isRaccoon) {
    ctx.fillStyle = '#B45309';
    ctx.strokeStyle = '#451A03';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-6, -22);
    ctx.lineTo(-9, -32);
    ctx.lineTo(-1, -24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(2, -23);
    ctx.lineTo(6, -32);
    ctx.lineTo(8, -22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FDE68A';
    ctx.beginPath();
    ctx.moveTo(-5.2, -23.5);
    ctx.lineTo(-7.2, -29);
    ctx.lineTo(-2.5, -24.5);
    ctx.fill();
  }

  // Front arm (Classic Mario fist-up jump pose or swinging run or Hammer!)
  ctx.save();
  const frontArmAngle =
    hammerSwing !== null
      ? hammerSwing
      : isJumping
      ? -2.5
      : carryingVeggie
      ? -2.8
      : stride * 0.75;
  ctx.translate(3, 0);
  ctx.rotate(frontArmAngle);
  ctx.fillStyle = shirt;
  ctx.strokeStyle = '#1E1B24';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(-3.5, -1, 7, 11, 3.5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(0, 10, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (hammerSwing !== null) {
    // Classic Golden Arcade Hammer
    ctx.fillStyle = '#D97706';
    ctx.strokeStyle = '#451A03';
    ctx.lineWidth = 1.3;
    ctx.fillRect(-2.5, 10, 5, 18);
    ctx.strokeRect(-2.5, 10, 5, 18);
    const headG = ctx.createLinearGradient(-10, 24, 10, 34);
    headG.addColorStop(0, '#FEF08A');
    headG.addColorStop(0.5, '#F59E0B');
    headG.addColorStop(1, '#B45309');
    ctx.fillStyle = headG;
    ctx.beginPath();
    ctx.roundRect(-10, 24, 20, 11, 3);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  // Carried Turnip overhead (SMB2)
  if (carryingVeggie) {
    ctx.save();
    ctx.translate(0, -32);
    ctx.fillStyle = '#22C55E';
    ctx.strokeStyle = '#14532D';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(-4, -10, 6, 3.5, -0.5, 0, Math.PI * 2);
    ctx.ellipse(4, -10, 6, 3.5, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const tg = ctx.createRadialGradient(-3, -2, 1, 0, 1, 11);
    tg.addColorStop(0, '#FFFFFF');
    tg.addColorStop(0.7, '#F1F5F9');
    tg.addColorStop(1, '#CBD5E1');
    ctx.fillStyle = tg;
    ctx.strokeStyle = '#475569';
    ctx.beginPath();
    ctx.arc(0, 1, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Cute SMB2 turnip face
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(-3.5, -1, 2, 3);
    ctx.fillRect(1.5, -1, 2, 3);
    ctx.restore();
  }

  ctx.restore();
}

// ============================================================================
// Authentic Evolved Donkey Kong Gorilla Renderer
// ============================================================================
export function drawHDDonkeyKong(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  clock: number,
  beating = true
): void {
  const beat = beating ? Math.sin(clock * 6.5) : 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  drawSoftShadow(ctx, 0, 29, 30, 6, 0.4);

  // Muscular feet
  ctx.fillStyle = '#FDBA74';
  ctx.strokeStyle = '#451A03';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(-15, 25, 11, 5.5, -0.1, 0, Math.PI * 2);
  ctx.ellipse(15, 25, 11, 5.5, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Arched gorilla torso with shaded brown fur
  const furGrad = ctx.createRadialGradient(-8, -4, 4, 0, 6, 32);
  furGrad.addColorStop(0, '#9A3412');
  furGrad.addColorStop(0.55, '#7C2D12');
  furGrad.addColorStop(1, '#431407');
  ctx.fillStyle = furGrad;
  ctx.strokeStyle = '#291002';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.ellipse(0, 6, 26, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Broad tan chest & pec contour
  const chestGrad = ctx.createLinearGradient(0, -6, 0, 18);
  chestGrad.addColorStop(0, '#FDBA74');
  chestGrad.addColorStop(1, '#D97706');
  ctx.fillStyle = chestGrad;
  ctx.beginPath();
  ctx.ellipse(0, 7, 17, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#92400E';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-10, 4);
  ctx.quadraticCurveTo(-4, 8, 0, 5);
  ctx.quadraticCurveTo(4, 8, 10, 4);
  ctx.stroke();

  // Articulated muscular arms + beating fists
  for (const side of [-1, 1] as const) {
    ctx.save();
    ctx.translate(side * 24, -3);
    ctx.rotate(side * (0.18 + beat * 0.28 * side));
    ctx.fillStyle = furGrad;
    ctx.strokeStyle = '#291002';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(-7, -2, 14, 24, 7);
    ctx.fill();
    ctx.stroke();
    // Tan fist
    ctx.fillStyle = '#FDBA74';
    ctx.beginPath();
    ctx.arc(0, 22, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Head with iconic pointed hair tuft & ears
  ctx.fillStyle = '#FDBA74';
  ctx.strokeStyle = '#431407';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(-15, -14, 5.5, 0, Math.PI * 2);
  ctx.arc(15, -14, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = furGrad;
  ctx.strokeStyle = '#291002';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, -14, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Pointed ape crest tuft
  ctx.beginPath();
  ctx.moveTo(-6, -26);
  ctx.lineTo(0, -34);
  ctx.lineTo(7, -26);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Muzzle + grinning teeth
  ctx.fillStyle = '#FDBA74';
  ctx.beginPath();
  ctx.ellipse(0, -10, 12, 8.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7C2D12';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Wide arcade grin
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#431407';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.roundRect(-8, -9.5, 16, 4.5, 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-4, -9.5);
  ctx.lineTo(-4, -5);
  ctx.moveTo(0, -9.5);
  ctx.lineTo(0, -5);
  ctx.moveTo(4, -9.5);
  ctx.lineTo(4, -5);
  ctx.stroke();

  // Expressive eyes & heavy furrowed brow
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(-4.5, -16.5, 3.6, 0, Math.PI * 2);
  ctx.arc(4.5, -16.5, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.arc(-4, -16.2, 1.9, 0, Math.PI * 2);
  ctx.arc(4, -16.2, 1.9, 0, Math.PI * 2);
  ctx.fill();

  // Heavy angry brow ridge
  ctx.strokeStyle = '#291002';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-10, -21);
  ctx.lineTo(0, -18.5);
  ctx.lineTo(10, -21);
  ctx.stroke();

  ctx.restore();
}

// ============================================================================
// Authentic 16-Bit Evolved Sonic / Super Sonic / Tails / Knuckles Renderer
// ============================================================================
export interface HDSonicOptions {
  x: number;
  y: number;
  facing: 1 | -1;
  who: 'sonic' | 'tails' | 'knuckles';
  isSuper?: boolean;
  isSpinning?: boolean;
  speed?: number;
  clock: number;
  shield?: 'none' | 'classic' | 'fire' | 'electric' | 'bubble';
  instaShield?: boolean;
}

export function drawHDSonicHero(ctx: CanvasRenderingContext2D, opts: HDSonicOptions): void {
  const {
    x,
    y,
    facing,
    who,
    isSuper = false,
    isSpinning = false,
    speed = 0,
    clock,
    shield = 'none',
    instaShield = false,
  } = opts;

  const baseCol = isSuper
    ? '#FACC15'
    : who === 'tails'
    ? '#F59E0B'
    : who === 'knuckles'
    ? '#DC2626'
    : '#2563EB';
  const darkCol = isSuper
    ? '#CA8A04'
    : who === 'tails'
    ? '#B45309'
    : who === 'knuckles'
    ? '#7F1D1D'
    : '#1E3A8A';
  const lightCol = isSuper
    ? '#FEF08A'
    : who === 'tails'
    ? '#FDE047'
    : who === 'knuckles'
    ? '#F87171'
    : '#60A5FA';

  ctx.save();
  ctx.translate(x, y);

  // Super Sonic golden pulsing aura + orbiting sparkles
  if (isSuper) {
    const auraR = 26 + Math.sin(clock * 16) * 3;
    const ag = ctx.createRadialGradient(0, 0, 6, 0, 0, auraR);
    ag.addColorStop(0, 'rgba(254, 240, 138, 0.55)');
    ag.addColorStop(0.6, 'rgba(250, 204, 21, 0.22)');
    ag.addColorStop(1, 'rgba(250, 204, 21, 0)');
    ctx.fillStyle = ag;
    ctx.beginPath();
    ctx.arc(0, 0, auraR, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 3; i++) {
      const a = clock * 5 + (i * Math.PI * 2) / 3;
      drawStarGlint(ctx, Math.cos(a) * 24, Math.sin(a) * 20, 4.5, '#FEF9C3', clock * 4);
    }
  }

  // Elemental / Insta Shield
  if (shield !== 'none' || instaShield) {
    const sc = instaShield
      ? '#FFFFFF'
      : shield === 'fire'
      ? '#FB923C'
      : shield === 'electric'
      ? '#FACC15'
      : shield === 'bubble'
      ? '#38BDF8'
      : '#60A5FA';
    const r = instaShield ? 31 : 24 + Math.sin(clock * 10) * 1.5;
    ctx.save();
    ctx.strokeStyle = sc;
    ctx.lineWidth = instaShield ? 3.5 : 2.4;
    ctx.shadowColor = sc;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    // Inner elemental detail
    if (shield === 'bubble') {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.beginPath();
      ctx.ellipse(-8, -9, 6, 3, -0.6, 0, Math.PI * 2);
      ctx.fill();
    } else if (shield === 'fire') {
      ctx.fillStyle = 'rgba(251, 146, 60, 0.16)';
      ctx.fill();
      for (let i = 0; i < 4; i++) {
        const a = clock * 8 + (i * Math.PI) / 2;
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (shield === 'electric') {
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = clock * 14 + k * 1.1;
        const px = Math.cos(a) * (r - 2);
        const py = Math.sin(a) * (r - 2);
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px + (k % 2 ? 3 : -3), py + (k % 2 ? -3 : 3));
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  if (isSpinning) {
    // High-speed serrated Spinball with glowing quill arcs!
    const spinRot = clock * 34 * facing;
    ctx.save();
    ctx.rotate(spinRot);
    const ballGrad = ctx.createRadialGradient(-4, -4, 2, 0, 0, 17);
    ballGrad.addColorStop(0, lightCol);
    ballGrad.addColorStop(0.65, baseCol);
    ballGrad.addColorStop(1, darkCol);
    ctx.fillStyle = ballGrad;
    ctx.shadowColor = lightCol;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const rad = i % 2 === 0 ? 18 : 13.5;
      if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
      else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fill();

    // Inner bright speed-swirl rings
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 1.15);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 6, Math.PI, Math.PI * 1.9);
    ctx.stroke();
    ctx.restore();
    ctx.restore();
    return;
  }

  ctx.scale(facing, 1);

  const absSpeed = Math.abs(speed);
  const runPhase = clock * (10 + Math.min(22, absSpeed * 0.045));
  const lean = Math.min(0.24, absSpeed * 0.0005);
  ctx.rotate(lean);

  // Tails' twin spinning propeller tails behind him!
  if (who === 'tails') {
    ctx.save();
    ctx.translate(-12, 6);
    const tailBlur = absSpeed > 40 ? 0.35 : 0.9;
    for (const offset of [-0.35, 0.35]) {
      ctx.save();
      ctx.rotate(offset + Math.sin(clock * 28) * 0.45);
      ctx.globalAlpha = tailBlur;
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.ellipse(-10, 0, 12, 4.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(-18, 0, 5, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // Iconic Sneakers (classic Sonic Figure-8 peel-out blur at high speed!)
  if (absSpeed > 260) {
    // High-speed Sonic figure-8 wheel blur!
    ctx.save();
    ctx.translate(0, 15);
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(-4, 0, 12, 6, Math.sin(clock * 35) * 0.3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(2, 0, 9, 4.5, -Math.sin(clock * 35) * 0.3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else {
    const stride = absSpeed > 15 ? Math.sin(runPhase) : 0;
    for (const s of [-1, 1] as const) {
      ctx.save();
      ctx.translate(s * 3.5, 11);
      ctx.rotate(s * stride * 0.7);
      // Leg
      ctx.strokeStyle = baseCol;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(0, -2);
      ctx.lineTo(0, 6);
      ctx.stroke();
      // White sock cuff
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-3.5, 3, 7, 3);
      // Red sneaker with white strap & gold buckle
      ctx.fillStyle = who === 'knuckles' ? '#16A34A' : '#EF4444';
      ctx.strokeStyle = '#1E1B24';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-4, 6);
      ctx.lineTo(9, 6);
      ctx.quadraticCurveTo(11, 11, 7, 11.5);
      ctx.lineTo(-5, 11.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Iconic white shoe stripe + gold buckle
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 6.2, 3.2, 5);
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(3.2, 7.6, 2.2, 2.2);
      ctx.restore();
    }
  }

  // Sleek torso + tan belly
  ctx.fillStyle = baseCol;
  ctx.strokeStyle = darkCol;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.ellipse(-1, 5, 8.5, 9.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = who === 'tails' ? '#FFFFFF' : '#FDE68A';
  ctx.beginPath();
  ctx.ellipse(2, 5.5, 5.2, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Knuckles crescent chest mark
  if (who === 'knuckles') {
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(2.5, 2.5, 4.5, 0.25, Math.PI - 0.25);
    ctx.stroke();
  }

  // Iconic Swept Quills / Hair!
  const quillFlex = Math.sin(clock * 14) * (absSpeed > 60 ? 2 : 0.5);
  const headGrad = ctx.createRadialGradient(2, -10, 2, -2, -7, 16);
  headGrad.addColorStop(0, lightCol);
  headGrad.addColorStop(0.55, baseCol);
  headGrad.addColorStop(1, darkCol);
  ctx.fillStyle = headGrad;
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 1.3;

  if (who === 'knuckles') {
    // Cascading crimson dreadlock quills
    ctx.beginPath();
    ctx.moveTo(-2, -16);
    ctx.quadraticCurveTo(-18, -14, -20, 4);
    ctx.lineTo(-13, 3);
    ctx.lineTo(-15, 7);
    ctx.lineTo(-7, 4);
    ctx.lineTo(-2, -4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (who === 'tails') {
    // Pointed twin fox ears with white inner tufts
    ctx.beginPath();
    ctx.moveTo(-6, -15);
    ctx.lineTo(-10, -27);
    ctx.lineTo(0, -18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(1, -16);
    ctx.lineTo(5, -27);
    ctx.lineTo(8, -15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(-5, -17);
    ctx.lineTo(-8, -23.5);
    ctx.lineTo(-2, -18.5);
    ctx.fill();
  } else {
    // Sonic's 3 iconic swept-back layered quills (upturned for Super Sonic!)
    const up = isSuper ? -8 : 0;
    ctx.beginPath();
    ctx.moveTo(-1, -18);
    ctx.quadraticCurveTo(-14, -22 + up, -24, -14 + up + quillFlex);
    ctx.lineTo(-11, -10);
    ctx.quadraticCurveTo(-18, -8 + up * 0.5, -23, -3 + up * 0.5 - quillFlex);
    ctx.lineTo(-10, -2);
    ctx.lineTo(-18, 5 + quillFlex * 0.5);
    ctx.lineTo(-6, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Pointed Hedgehog Ear
    ctx.beginPath();
    ctx.moveTo(-1, -17);
    ctx.lineTo(2, -24);
    ctx.lineTo(6, -16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Head dome
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.arc(0, -8.5, 11.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Connected Sonic white eyes with emerald irises (red for Super Sonic)
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(5.5, -9.5, 4.6, 6.2, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Iris & pupil
  ctx.fillStyle = isSuper ? '#EF4444' : who === 'tails' ? '#38BDF8' : who === 'knuckles' ? '#A855F7' : '#16A34A';
  ctx.beginPath();
  ctx.ellipse(7.2, -9.2, 2.2, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.ellipse(7.5, -9.2, 1.2, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(6.5, -11.4, 1.4, 1.6);

  // Expressive muzzle + black button nose
  ctx.fillStyle = who === 'tails' ? '#FFFFFF' : '#FDE68A';
  ctx.beginPath();
  ctx.ellipse(5.8, -3.5, 6.8, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();
  // Nose
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.ellipse(12.2, -5.2, 2.4, 1.5, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // White cuffed glove (spiked for Knuckles!)
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(5, 6.5, who === 'knuckles' ? 5.2 : 4.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (who === 'knuckles') {
    ctx.beginPath();
    ctx.moveTo(9, 4.5);
    ctx.lineTo(13, 3.5);
    ctx.lineTo(9.5, 7);
    ctx.lineTo(13, 8.5);
    ctx.lineTo(8.5, 9.5);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

// ============================================================================
// Reusable Evolved World Tiles (Pipes, Bricks, ? Blocks, Steel Girders)
// ============================================================================
export function drawHDWarpPipe(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  orientation: 'vertical' | 'left' | 'right' = 'vertical'
): void {
  ctx.save();
  if (orientation === 'vertical') {
    const bodyG = ctx.createLinearGradient(x, y, x + w, y);
    bodyG.addColorStop(0, '#14532D');
    bodyG.addColorStop(0.18, '#22C55E');
    bodyG.addColorStop(0.32, '#86EFAC');
    bodyG.addColorStop(0.45, '#22C55E');
    bodyG.addColorStop(0.82, '#15803D');
    bodyG.addColorStop(1, '#052E16');

    ctx.fillStyle = bodyG;
    ctx.fillRect(x + 4, y + 20, w - 8, h - 20);
    ctx.strokeStyle = '#052E16';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 4, y + 20, w - 8, h - 20);

    // Lip collar with shadow underneath
    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    ctx.fillRect(x + 4, y + 21, w - 8, 5);

    ctx.fillStyle = bodyG;
    ctx.beginPath();
    ctx.roundRect(x, y, w, 21, 3);
    ctx.fill();
    ctx.stroke();

    // Specular rim gleam
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillRect(x + w * 0.24, y + 2, w * 0.12, 16);
    ctx.fillRect(x + w * 0.26, y + 23, w * 0.1, Math.max(0, h - 26));
  } else {
    const bodyG = ctx.createLinearGradient(x, y, x, y + h);
    bodyG.addColorStop(0, '#14532D');
    bodyG.addColorStop(0.2, '#22C55E');
    bodyG.addColorStop(0.35, '#86EFAC');
    bodyG.addColorStop(0.55, '#16A34A');
    bodyG.addColorStop(1, '#052E16');
    ctx.fillStyle = bodyG;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#052E16';
    ctx.lineWidth = 1.8;
    ctx.strokeRect(x, y, w, h);

    const lipW = 14;
    const lipX = orientation === 'right' ? x + w - lipW : x;
    ctx.fillStyle = bodyG;
    ctx.beginPath();
    ctx.roundRect(lipX, y - 5, lipW, h + 10, 3);
    ctx.fill();
    ctx.stroke();

    // Dark hollow pipe opening rim
    ctx.fillStyle = '#020617';
    const openX = orientation === 'right' ? lipX + lipW - 4 : lipX;
    ctx.fillRect(openX, y - 2, 4, h + 4);
  }
  ctx.restore();
}

export function drawHDQuestionBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  clock: number
): void {
  const pulse = 0.5 + 0.5 * Math.sin(clock * 6);
  ctx.save();
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, pulse > 0.5 ? '#FEF08A' : '#FDE047');
  grad.addColorStop(0.5, '#F59E0B');
  grad.addColorStop(1, '#B45309');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(x + 1, y + 1, w - 2, h - 2, 4);
  ctx.fill();

  // Inner bevel highlight & shadow
  ctx.strokeStyle = '#FEF9C3';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 3, y + h - 3);
  ctx.lineTo(x + 3, y + 3);
  ctx.lineTo(x + w - 3, y + 3);
  ctx.stroke();

  ctx.strokeStyle = '#78350F';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

  // 4 Iconic NES/SNES Corner Rivets
  ctx.fillStyle = '#78350F';
  const rOff = 5;
  ctx.fillRect(x + rOff, y + rOff, 3, 3);
  ctx.fillRect(x + w - rOff - 3, y + rOff, 3, 3);
  ctx.fillRect(x + rOff, y + h - rOff - 3, 3, 3);
  ctx.fillRect(x + w - rOff - 3, y + h - rOff - 3, 3, 3);

  // Shimmering embossed '?' glyph
  ctx.font = `900 ${Math.round(h * 0.62)}px "Outfit", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#78350F';
  ctx.fillText('?', x + w * 0.5 + 1.5, y + h * 0.5 + 2);
  ctx.fillStyle = '#FFFBEB';
  ctx.fillText('?', x + w * 0.5, y + h * 0.5 + 0.5);
  ctx.restore();
}

export function drawHDBrickTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  base = '#B45309',
  light = '#EA580C',
  mortar = '#291002'
): void {
  ctx.save();
  ctx.fillStyle = mortar;
  ctx.fillRect(x, y, w, h);

  const halfH = Math.floor(h * 0.5);
  const drawSub = (bx: number, by: number, bw: number, bh: number) => {
    if (bw <= 2 || bh <= 2) return;
    ctx.fillStyle = base;
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = light;
    ctx.fillRect(bx, by, bw, 2.5);
    ctx.fillRect(bx, by, 2, bh);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(bx, by + bh - 2, bw, 2);
  };

  drawSub(x + 1, y + 1, w * 0.5 - 2, halfH - 2);
  drawSub(x + w * 0.5 + 1, y + 1, w * 0.5 - 2, halfH - 2);
  drawSub(x + 1, y + halfH + 1, w * 0.25 - 1, h - halfH - 2);
  drawSub(x + w * 0.25 + 1, y + halfH + 1, w * 0.5 - 2, h - halfH - 2);
  drawSub(x + w * 0.75 + 1, y + halfH + 1, w * 0.25 - 2, h - halfH - 2);
  ctx.restore();
}

// ============================================================================
// Authentic Taito Space Invaders Pixel Matrices (Evolved via drawPixelMatrixHD)
// ============================================================================
export const TAITO_SQUID_F0 = [
  '...##...',
  '..####..',
  '.######.',
  '##.##.##',
  '########',
  '..#..#..',
  '.#.##.#.',
  '#.#..#.#',
] as const;

export const TAITO_SQUID_F1 = [
  '...##...',
  '..####..',
  '.######.',
  '##.##.##',
  '########',
  '.#.##.#.',
  '#......#',
  '.#....#.',
] as const;

export const TAITO_CRAB_F0 = [
  '..#.....#..',
  '...#...#...',
  '..#######..',
  '.##.###.##.',
  '###########',
  '#.#######.#',
  '#.#.....#.#',
  '...##.##...',
] as const;

export const TAITO_CRAB_F1 = [
  '..#.....#..',
  '#..#...#..#',
  '#.#######.#',
  '###.###.###',
  '###########',
  '.#########.',
  '..#.....#..',
  '.#.......#.',
] as const;

export const TAITO_OCTO_F0 = [
  '....####....',
  '.##########.',
  '############',
  '###..##..###',
  '############',
  '...##..##...',
  '..##.##.##..',
  '##........##',
] as const;

export const TAITO_OCTO_F1 = [
  '....####....',
  '.##########.',
  '############',
  '###..##..###',
  '############',
  '..###..###..',
  '.##..##..##.',
  '..##....##..',
] as const;

export const TAITO_UFO_MATRIX = [
  '.....######.....',
  '...##########...',
  '..############..',
  '.##.##.##.##.##.',
  '################',
  '..###..##..###..',
  '...#........#...',
] as const;

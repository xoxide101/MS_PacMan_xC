export type MuleResourceKind = 'food' | 'energy' | 'smithore' | 'crystite';
export type MuleTerrainKind = 'river' | 'plains' | 'mtn1' | 'mtn2' | 'mtn3' | 'town';

export interface MuleSpeciesDef {
  id: string;
  name: string;
  color: string;
  accent: string;
  startCash: number;
  devTime: number;
  classicPerk: string;
  evoPerk: string;
  evoAbility: string;
}

export const MULE_SPECIES: MuleSpeciesDef[] = [
  {
    id: 'flapper',
    name: 'FLAPPER',
    color: '#FACC15',
    accent: '#FEF08A',
    startCash: 1600,
    devTime: 36,
    classicPerk: '+$600 Start Cash',
    evoPerk: '+$600 Cash · +12% Monthly Dividend',
    evoAbility: 'Venture Interest',
  },
  {
    id: 'humanoid',
    name: 'HUMANOID',
    color: '#38BDF8',
    accent: '#BAE6FD',
    startCash: 600,
    devTime: 30,
    classicPerk: '+15% Colony Score',
    evoPerk: '+20% Colony Score · Free Starter Shield',
    evoAbility: 'Colony Charter',
  },
  {
    id: 'packer',
    name: 'PACKER',
    color: '#F472B6',
    accent: '#FBCFE8',
    startCash: 1000,
    devTime: 34,
    classicPerk: 'Balanced Pioneer',
    evoPerk: 'Dual-Tether (Carry 2 M.U.L.E.s!)',
    evoAbility: 'Double Cargo',
  },
  {
    id: 'spheroid',
    name: 'SPHEROID',
    color: '#A855F7',
    accent: '#E9D5FF',
    startCash: 1000,
    devTime: 34,
    classicPerk: 'Fast Irata Glide',
    evoPerk: '+30% Hover Speed · Zero Mtn Slowdown',
    evoAbility: 'Phase Glide',
  },
  {
    id: 'mechtron',
    name: 'MECHTRON',
    color: '#94A3B8',
    accent: '#E2E8F0',
    startCash: 1000,
    devTime: 34,
    classicPerk: '20% Cheaper M.U.L.E.s',
    evoPerk: '25% Off M.U.L.E.s & Mk Upgrades',
    evoAbility: 'Nano-Fab',
  },
  {
    id: 'gollumer',
    name: 'GOLLUMER',
    color: '#4ADE80',
    accent: '#BBF7D0',
    startCash: 1000,
    devTime: 34,
    classicPerk: '+1 Crystite Mountain Yield',
    evoPerk: '+2 Mountain Crystite & Auto-Survey',
    evoAbility: 'Deep Vein',
  },
  {
    id: 'bonzoid',
    name: 'BONZOID',
    color: '#FB923C',
    accent: '#FED7AA',
    startCash: 1000,
    devTime: 34,
    classicPerk: '+1 Smithore Yield',
    evoPerk: '+2 Smithore & +1 Energy Synergy',
    evoAbility: 'Overclock',
  },
  {
    id: 'leggite',
    name: 'LEGGITE',
    color: '#2DD4BF',
    accent: '#99F6E4',
    startCash: 1000,
    devTime: 34,
    classicPerk: '+1 River Food Yield',
    evoPerk: '+2 River Food · Fast Sprint Recharge',
    evoAbility: 'Hydro-Surge',
  },
];

export const RESOURCE_META: Record<
  MuleResourceKind,
  { label: string; short: string; color: string; glow: string; dark: string; baseCost: number }
> = {
  food: {
    label: 'FOOD',
    short: 'FD',
    color: '#4ADE80',
    glow: '#86EFAC',
    dark: '#14532D',
    baseCost: 125,
  },
  energy: {
    label: 'ENERGY',
    short: 'EN',
    color: '#FACC15',
    glow: '#FEF08A',
    dark: '#713F12',
    baseCost: 150,
  },
  smithore: {
    label: 'SMITHORE',
    short: 'OR',
    color: '#38BDF8',
    glow: '#7DD3FC',
    dark: '#0C4A6E',
    baseCost: 175,
  },
  crystite: {
    label: 'CRYSTITE',
    short: 'CR',
    color: '#E879F9',
    glow: '#F5D0FE',
    dark: '#581C87',
    baseCost: 200,
  },
};

export function drawAlienSprite(
  ctx: CanvasRenderingContext2D,
  speciesIdx: number,
  x: number,
  y: number,
  scale: number,
  time: number,
  moving: boolean,
  facing = 1,
  mood: 'neutral' | 'happy' | 'worried' = 'neutral'
): void {
  const sp = MULE_SPECIES[speciesIdx % MULE_SPECIES.length];
  const bob = moving ? Math.abs(Math.sin(time * 13)) * 3.2 : Math.sin(time * 3.5) * 1.1;
  const stride = moving ? Math.sin(time * 13) * 4.5 : 0;

  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.beginPath();
  ctx.ellipse(0, 10 * scale, 9.5 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(0, -bob * scale);
  ctx.scale(facing * scale, scale);

  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  if (speciesIdx === 3) {
    ctx.strokeStyle = sp.accent;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(0, 8.5, 7, 2.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (speciesIdx === 7) {
    for (let i = -1; i <= 1; i += 2) {
      ctx.beginPath();
      ctx.moveTo(i * 3, 4);
      ctx.lineTo(i * 6 + stride * 0.5 * i, 10.5);
      ctx.moveTo(i * 1.5, 4);
      ctx.lineTo(i * 3 - stride * 0.5 * i, 10.5);
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    ctx.moveTo(-3.5, 4);
    ctx.lineTo(-4 - stride * 0.55, 10.5);
    ctx.moveTo(3.5, 4);
    ctx.lineTo(4 + stride * 0.55, 10.5);
    ctx.stroke();
  }

  ctx.fillStyle = sp.color;
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 1.8;

  if (speciesIdx === 0) {
    const wingY = Math.sin(time * (moving ? 18 : 7)) * 4;
    ctx.fillStyle = sp.accent;
    ctx.beginPath();
    ctx.moveTo(-6, -1);
    ctx.lineTo(-14, -5 + wingY);
    ctx.lineTo(-9, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(6, -1);
    ctx.lineTo(14, -5 + wingY);
    ctx.lineTo(9, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = sp.color;
    ctx.beginPath();
    ctx.ellipse(0, -1, 7.5, 8.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#F97316';
    ctx.beginPath();
    ctx.moveTo(5.5, -3);
    ctx.lineTo(12, -1);
    ctx.lineTo(5.5, 1.5);
    ctx.closePath();
    ctx.fill();
  } else if (speciesIdx === 1) {
    ctx.beginPath();
    ctx.roundRect(-6.5, -2, 13, 9, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.arc(0, -7, 6.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#0284C7';
    ctx.beginPath();
    ctx.roundRect(-3.8, -9.5, 8.5, 4.6, 2);
    ctx.fill();
    ctx.fillStyle = '#E0F2FE';
    ctx.fillRect(-2, -8.8, 3, 1.4);
  } else if (speciesIdx === 2) {
    ctx.fillStyle = '#BE185D';
    ctx.fillRect(-9.5, -4, 5, 8);
    ctx.fillStyle = sp.color;
    ctx.beginPath();
    ctx.roundRect(-6, -7, 13, 13, 5);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-4, -7);
    ctx.lineTo(-6, -12);
    ctx.lineTo(-1, -7);
    ctx.moveTo(2, -7);
    ctx.lineTo(5, -12);
    ctx.lineTo(6, -7);
    ctx.fill();
    ctx.stroke();
  } else if (speciesIdx === 3) {
    const grad = ctx.createRadialGradient(-2, -4, 1, 0, -2, 9);
    grad.addColorStop(0, '#F5D0FE');
    grad.addColorStop(0.55, sp.color);
    grad.addColorStop(1, '#581C87');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, -2, 8.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#FDE047';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(0, -2, 11, 3.2, Math.sin(time * 2) * 0.25, 0, Math.PI * 2);
    ctx.stroke();
  } else if (speciesIdx === 4) {
    ctx.fillStyle = '#CBD5E1';
    ctx.beginPath();
    ctx.roundRect(-7, -3, 14, 9, 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#94A3B8';
    ctx.beginPath();
    ctx.roundRect(-6, -11, 12, 8, 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(0, -15);
    ctx.stroke();
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(-3.5 + Math.sin(time * 6) * 1.6, -8.5, 4, 2.5);
  } else if (speciesIdx === 5) {
    ctx.beginPath();
    ctx.ellipse(0, -1, 8, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = sp.accent;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-3, -8);
    ctx.quadraticCurveTo(-8, -14, -4, -14);
    ctx.moveTo(3, -8);
    ctx.quadraticCurveTo(8, -14, 4, -14);
    ctx.stroke();
  } else if (speciesIdx === 6) {
    ctx.beginPath();
    ctx.moveTo(-7, 5);
    ctx.lineTo(-8, -5);
    ctx.lineTo(0, -11);
    ctx.lineTo(8, -5);
    ctx.lineTo(7, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FEF08A';
    ctx.fillRect(-2, -11, 4, 5);
  } else {
    ctx.beginPath();
    ctx.ellipse(0, -2, 8.5, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(0, -9, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  if (speciesIdx !== 1 && speciesIdx !== 4) {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-2.5, -3.5, 2.2, 0, Math.PI * 2);
    ctx.arc(3, -3.5, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(-1.8, -3.5, 1.1, 0, Math.PI * 2);
    ctx.arc(3.7, -3.5, 1.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    if (mood === 'happy') {
      ctx.arc(0.5, -0.5, 2.6, 0.15, Math.PI - 0.15);
    } else if (mood === 'worried') {
      ctx.arc(0.5, 2.5, 2.4, Math.PI + 0.3, -0.3);
    } else {
      ctx.moveTo(-1.5, 0.8);
      ctx.lineTo(2.5, 0.8);
    }
    ctx.stroke();
  }

  ctx.restore();
}

export function drawMechanicalMule(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  outfit: MuleResourceKind | null,
  scale: number,
  time: number,
  moving: boolean,
  facing = 1
): void {
  const step = moving ? Math.sin(time * 16) * 4 : Math.sin(time * 3) * 0.6;
  const col = outfit ? RESOURCE_META[outfit].color : '#E2E8F0';
  const dark = outfit ? RESOURCE_META[outfit].dark : '#475569';

  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = 'rgba(0,0,0,0.36)';
  ctx.beginPath();
  ctx.ellipse(0, 9 * scale, 12 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.scale(facing * scale, scale);

  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-7, 2);
  ctx.lineTo(-9 - step, 9);
  ctx.moveTo(-4, 2);
  ctx.lineTo(-4 + step, 9);
  ctx.moveTo(4, 2);
  ctx.lineTo(3 - step, 9);
  ctx.moveTo(7, 2);
  ctx.lineTo(9 + step, 9);
  ctx.stroke();

  ctx.fillStyle = '#E2E8F0';
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.roundRect(-10, -5, 19, 8.5, 3);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.roundRect(-7, -10.5, 11, 6.5, 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = dark;
  ctx.fillRect(-5, -8.8, 7, 2.2);

  ctx.fillStyle = '#F8FAFC';
  ctx.beginPath();
  ctx.roundRect(6, -10, 7.5, 6.5, 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(8, -10);
  ctx.lineTo(6.5, -14.5);
  ctx.moveTo(11, -10);
  ctx.lineTo(12.5, -14.5);
  ctx.stroke();
  ctx.fillStyle = Math.floor(time * 5) % 2 === 0 ? '#22D3EE' : '#FACC15';
  ctx.fillRect(10.5, -8.2, 2.4, 2.2);

  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-10, -2);
  ctx.lineTo(-13.5, -5.5 + Math.sin(time * 10) * 1.5);
  ctx.stroke();

  ctx.restore();
}

export function drawWampus(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
  golden = false
): void {
  const hop = Math.abs(Math.sin(time * 9)) * 4;
  ctx.save();
  ctx.translate(x, y - hop);

  const aura = ctx.createRadialGradient(0, 0, 2, 0, 0, 17);
  aura.addColorStop(0, golden ? 'rgba(253,224,71,0.85)' : 'rgba(244,114,182,0.75)');
  aura.addColorStop(1, 'rgba(244,114,182,0)');
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(0, 0, 17, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = golden ? '#FACC15' : '#F472B6';
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(0, 1, 9, 7.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-6, -4);
  ctx.lineTo(-9, -11);
  ctx.lineTo(-2, -6);
  ctx.moveTo(6, -4);
  ctx.lineTo(9, -11);
  ctx.lineTo(2, -6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(-3, -1, 2.4, 0, Math.PI * 2);
  ctx.arc(3, -1, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.arc(-2.6, -1, 1.2, 0, Math.PI * 2);
  ctx.arc(3.4, -1, 1.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function drawIrataPlotTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  terrain: MuleTerrainKind,
  col: number,
  row: number,
  ownerColor: string | null,
  outfit: MuleResourceKind | null,
  tier: number,
  shielded: boolean,
  assayedRichness: number | null,
  time: number,
  evolvedStyle: boolean
): void {
  const pad = 1.5;
  const rx = x + pad;
  const ry = y + pad;
  const rw = w - pad * 2;
  const rh = h - pad * 2;

  if (terrain === 'town') {
    const g = ctx.createLinearGradient(rx, ry, rx, ry + rh);
    g.addColorStop(0, evolvedStyle ? '#1E293B' : '#312E81');
    g.addColorStop(1, evolvedStyle ? '#0F172A' : '#1E1B4B');
    ctx.fillStyle = g;
  } else if (terrain === 'river') {
    const g = ctx.createLinearGradient(rx, ry, rx + rw, ry);
    g.addColorStop(0, '#C27834');
    g.addColorStop(0.18, '#0284C7');
    g.addColorStop(0.5, '#0EA5E9');
    g.addColorStop(0.82, '#0284C7');
    g.addColorStop(1, '#C27834');
    ctx.fillStyle = g;
  } else if (terrain.startsWith('mtn')) {
    const g = ctx.createLinearGradient(rx, ry, rx, ry + rh);
    g.addColorStop(0, evolvedStyle ? '#9A4A1A' : '#8C3F14');
    g.addColorStop(1, evolvedStyle ? '#6B2F0E' : '#652B0C');
    ctx.fillStyle = g;
  } else {
    const g = ctx.createLinearGradient(rx, ry, rx, ry + rh);
    const tint = (col + row) % 2 === 0;
    g.addColorStop(0, tint ? '#D48232' : '#CC792C');
    g.addColorStop(1, tint ? '#AE5E1E' : '#A4561A');
    ctx.fillStyle = g;
  }

  ctx.beginPath();
  ctx.roundRect(rx, ry, rw, rh, 5);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);

  if (terrain === 'river') {
    ctx.strokeStyle = 'rgba(224,242,254,0.52)';
    ctx.lineWidth = 1.6;
    for (let k = 0; k < 3; k++) {
      const flowY = ((time * 22 + k * 24 + row * 11) % (rh - 10)) + ry + 5;
      const waveX = rx + rw * 0.32 + Math.sin(time * 2.5 + k + row) * 5;
      ctx.beginPath();
      ctx.moveTo(waveX, flowY);
      ctx.quadraticCurveTo(waveX + rw * 0.18, flowY - 3, waveX + rw * 0.34, flowY);
      ctx.stroke();
    }
  } else if (terrain.startsWith('mtn')) {
    const peaks = terrain === 'mtn3' ? 3 : terrain === 'mtn2' ? 2 : 1;
    const baseY = ry + rh - 10;
    for (let k = 0; k < peaks; k++) {
      const spacing = peaks === 1 ? 0 : peaks === 2 ? 22 : 16;
      const cx = rx + rw * 0.5 + (k - (peaks - 1) * 0.5) * spacing;
      const peakH = peaks === 3 && k === 1 ? 30 : 23 + (k % 2) * 3;
      const halfW = peaks === 3 ? 13 : 16;

      ctx.fillStyle = 'rgba(24,8,4,0.34)';
      ctx.beginPath();
      ctx.moveTo(cx, baseY - peakH);
      ctx.lineTo(cx + halfW + 4, baseY + 2);
      ctx.lineTo(cx + 2, baseY + 2);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#E08E3E';
      ctx.beginPath();
      ctx.moveTo(cx, baseY - peakH);
      ctx.lineTo(cx - halfW, baseY);
      ctx.lineTo(cx + 1, baseY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#7C2D12';
      ctx.beginPath();
      ctx.moveTo(cx, baseY - peakH);
      ctx.lineTo(cx + halfW, baseY);
      ctx.lineTo(cx + 1, baseY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#FDE68A';
      ctx.beginPath();
      ctx.moveTo(cx, baseY - peakH);
      ctx.lineTo(cx - 4.5, baseY - peakH + 7);
      ctx.lineTo(cx + 3.5, baseY - peakH + 6);
      ctx.closePath();
      ctx.fill();
    }
  } else if (terrain === 'plains') {
    ctx.fillStyle = 'rgba(92,40,12,0.22)';
    const seed = (col * 17 + row * 31) % 7;
    ctx.beginPath();
    ctx.ellipse(rx + 14 + seed * 3, ry + 16, 7, 2.2, 0, 0, Math.PI * 2);
    ctx.ellipse(rx + rw - 16 - seed * 2, ry + rh - 16, 9, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (terrain === 'town') {
    const cx = rx + rw * 0.5;
    const cy = ry + rh * 0.45;
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.roundRect(rx + 7, ry + 12, rw - 14, rh - 24, 6);
    ctx.fill();
    const dg = ctx.createRadialGradient(cx - 4, cy - 4, 2, cx, cy, 18);
    dg.addColorStop(0, '#7DD3FC');
    dg.addColorStop(0.6, '#2563EB');
    dg.addColorStop(1, '#1E1B4B');
    ctx.fillStyle = dg;
    ctx.beginPath();
    ctx.arc(cx, cy, 14, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    const pulse = 0.55 + Math.sin(time * 5) * 0.45;
    ctx.fillStyle = `rgba(250,204,21,${pulse})`;
    ctx.beginPath();
    ctx.arc(cx, cy - 15, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FEF08A';
    ctx.font = '900 9.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(evolvedStyle ? 'COLONY HUB' : 'IRATA TOWN', cx, ry + rh - 6);
  }

  if (assayedRichness !== null && terrain !== 'town') {
    const label = assayedRichness === 0 ? 'NONE' : assayedRichness === 1 ? 'LOW' : assayedRichness === 2 ? 'MED' : 'HIGH!';
    ctx.fillStyle = assayedRichness >= 2 ? 'rgba(168,85,247,0.85)' : 'rgba(15,23,42,0.75)';
    ctx.beginPath();
    ctx.roundRect(rx + 4, ry + 4, 34, 13, 3);
    ctx.fill();
    ctx.fillStyle = assayedRichness >= 3 ? '#FDE047' : assayedRichness >= 1 ? '#F5D0FE' : '#94A3B8';
    ctx.font = '800 8.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`♦${label}`, rx + 6, ry + 13);
  }

  if (outfit) {
    const meta = RESOURCE_META[outfit];
    const cx = rx + rw * 0.5;
    const cy = ry + rh * 0.48;

    if (outfit === 'food') {
      if (tier >= 2) {
        ctx.fillStyle = 'rgba(74,222,128,0.22)';
        ctx.strokeStyle = '#86EFAC';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(cx, cy + 4, 18, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.strokeStyle = '#4ADE80';
      ctx.lineWidth = 2;
      for (let i = -2; i <= 2; i++) {
        const sway = Math.sin(time * 4 + i + col) * 2.5;
        ctx.beginPath();
        ctx.moveTo(cx + i * 7, cy + 8);
        ctx.quadraticCurveTo(cx + i * 7 + sway, cy - 2, cx + i * 7 + sway * 1.3, cy - 8 - (tier - 1) * 3);
        ctx.stroke();
      }
    } else if (outfit === 'energy') {
      ctx.fillStyle = '#1E3A8A';
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 1.4;
      ctx.fillRect(cx - 14, cy - 4, 28, 11);
      ctx.strokeRect(cx - 14, cy - 4, 28, 11);
      const angle = time * (3.5 + tier * 1.5);
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 2;
      for (let b = 0; b < 3; b++) {
        const a = angle + (b * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 8);
        ctx.lineTo(cx + Math.cos(a) * (7 + tier * 1.5), cy - 8 + Math.sin(a) * (7 + tier * 1.5));
        ctx.stroke();
      }
    } else if (outfit === 'smithore') {
      const pump = Math.sin(time * (6 + tier * 2)) * 3.5;
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy + 9);
      ctx.lineTo(cx, cy - 11 - (tier - 1) * 2);
      ctx.lineTo(cx + 10, cy + 9);
      ctx.stroke();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 7 + pump);
      ctx.lineTo(cx, cy + 9);
      ctx.stroke();
    } else {
      const glow = 0.65 + Math.sin(time * 6 + col) * 0.35;
      ctx.fillStyle = `rgba(232,121,249,${glow})`;
      ctx.strokeStyle = '#F5D0FE';
      ctx.lineWidth = 1.3;
      for (let i = -1; i <= 1; i++) {
        const ch = i === 0 ? 15 + tier * 2 : 10 + tier;
        ctx.beginPath();
        ctx.moveTo(cx + i * 8, cy - ch + 5);
        ctx.lineTo(cx + i * 8 + 4.5, cy + 6);
        ctx.lineTo(cx + i * 8 - 4.5, cy + 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    ctx.fillStyle = 'rgba(7,10,22,0.86)';
    ctx.beginPath();
    ctx.roundRect(rx + 5, ry + rh - 18, rw - 10, 14, 3);
    ctx.fill();
    ctx.fillStyle = meta.color;
    ctx.font = '800 8.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    const tierTag = tier > 1 ? ` M${tier}` : '';
    ctx.fillText(`${meta.label.slice(0, 4)}${tierTag}`, rx + rw * 0.5, ry + rh - 8);
  }

  if (ownerColor) {
    ctx.strokeStyle = ownerColor;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.roundRect(rx + 1.5, ry + 1.5, rw - 3, rh - 3, 4.5);
    ctx.stroke();
    ctx.fillStyle = ownerColor;
    ctx.beginPath();
    ctx.moveTo(rx + rw - 2, ry + 2);
    ctx.lineTo(rx + rw - 14, ry + 2);
    ctx.lineTo(rx + rw - 2, ry + 14);
    ctx.closePath();
    ctx.fill();
  }

  if (shielded) {
    ctx.strokeStyle = `rgba(56,189,248,${0.55 + Math.sin(time * 5) * 0.3})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.roundRect(rx + 4, ry + 4, rw - 8, rh - 8, 6);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

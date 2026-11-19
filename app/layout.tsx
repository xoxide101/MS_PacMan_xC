import type { Metadata } from 'next';
import { Outfit, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-outfit',
  display: 'swap',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jakarta',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Ms. Pac-Man HD — 60fps Arcade Remaster',
  description:
    'High-resolution 60fps arcade remaster of Ms. Pac-Man featuring all four classic mazes, authentic ghost AI, roaming bonus fruits, crisp vector lighting, and synthesized arcade audio.',
  openGraph: {
    title: 'Ms. Pac-Man HD — 60fps Arcade Remaster',
    description:
      'High-resolution 60fps arcade remaster of Ms. Pac-Man featuring all four classic mazes, authentic ghost AI, roaming bonus fruits, crisp vector lighting, and synthesized arcade audio.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ms. Pac-Man HD — 60fps Arcade Remaster',
    description:
      'High-resolution 60fps arcade remaster of Ms. Pac-Man featuring all four classic mazes, authentic ghost AI, roaming bonus fruits, crisp vector lighting, and synthesized arcade audio.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${plusJakarta.variable} ${jetbrainsMono.variable} dark`}
    >
      <body
        suppressHydrationWarning
        className="bg-[#060811] text-slate-100 antialiased selection:bg-amber-400/30 selection:text-amber-100 overflow-x-hidden"
        style={{ fontFamily: 'var(--font-jakarta), system-ui, sans-serif' }}
      >
        {children}
      </body>
    </html>
  );
}

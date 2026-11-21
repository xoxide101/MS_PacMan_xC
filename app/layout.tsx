import type { Metadata, Viewport } from 'next';
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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#060811',
};

export const metadata: Metadata = {
  title: 'Retro Arcade Collection — 94 Classic & Evo Cabinets in 60fps HD',
  description:
    'Play 94 Golden Age and modern evolved arcade classics in high-resolution 60fps with mouse steering, multi-touch virtual joystick, foldable/tablet adaptive layouts, and synthesized music.',
  openGraph: {
    title: 'Retro Arcade Collection — 94 Classic & Evo Cabinets in 60fps HD',
    description:
      'Play 94 Golden Age and modern evolved arcade classics in high-resolution 60fps with mouse steering, multi-touch virtual joystick, foldable/tablet adaptive layouts, and synthesized music.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Retro Arcade Collection — 94 Classic & Evo Cabinets in 60fps HD',
    description:
      'Play 94 Golden Age and modern evolved arcade classics in high-resolution 60fps with mouse steering, multi-touch virtual joystick, foldable/tablet adaptive layouts, and synthesized music.',
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
        className="bg-[#060811] text-slate-100 antialiased selection:bg-amber-400/30 selection:text-amber-100"
        style={{ fontFamily: 'var(--font-jakarta), system-ui, sans-serif' }}
      >
        {children}
      </body>
    </html>
  );
}

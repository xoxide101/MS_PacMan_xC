import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#060811',
};

export const metadata: Metadata = {
  title: 'Retro Arcade Collection — 95 Classic & Evo Cabinets in 60fps HD',
  description:
    'Play 95 Golden Age and modern evolved arcade classics in high-resolution 60fps with mouse steering, multi-touch virtual joystick, foldable/tablet adaptive layouts, and synthesized music.',
  openGraph: {
    title: 'Retro Arcade Collection — 95 Classic & Evo Cabinets in 60fps HD',
    description:
      'Play 95 Golden Age and modern evolved arcade classics in high-resolution 60fps with mouse steering, multi-touch virtual joystick, foldable/tablet adaptive layouts, and synthesized music.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Retro Arcade Collection — 95 Classic & Evo Cabinets in 60fps HD',
    description:
      'Play 95 Golden Age and modern evolved arcade classics in high-resolution 60fps with mouse steering, multi-touch virtual joystick, foldable/tablet adaptive layouts, and synthesized music.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        suppressHydrationWarning
        className="bg-[#060811] text-slate-100 antialiased selection:bg-amber-400/30 selection:text-amber-100"
        style={{
          fontFamily:
            "'Plus Jakarta Sans', 'Outfit', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        {children}
      </body>
    </html>
  );
}

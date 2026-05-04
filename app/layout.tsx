'use client';

import { usePathname } from 'next/navigation';
import { Barlow_Condensed, Barlow, Geist, Instrument_Serif } from 'next/font/google';
import WeatherTopBar from '@/components/spotdetail/WeatherTopBar';
import './globals.css';

// Display font: condensed, athletic — used for verdict words and hero headlines
const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});

// Body font: clean, warm geometric — used for all UI text
const barlow = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
});

// Geist: primary UI font on the SpotDetailBoard v2 view.
const geist = Geist({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-geist',
  display: 'swap',
});

// Editorial font: Instrument Serif — used only for the italic verdict word
// (GO. / MAYBE. / SKIP.) on the SpotDetailBoard v2 view.
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-editorial',
  display: 'swap',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Routes that mount their OWN top bar (or have no chrome at all in the
  // case of /account) — the layout shouldn't render a duplicate:
  //   /          → WeatherTopBar inside app/page.tsx
  //   /pins/[id] → WeatherTopBar inside SpotDetailBoard
  //   /account   → no top bar; dark self-contained UI with its own back link
  const isHomePage = pathname === '/';
  const isPinDetailPage =
    !!pathname && pathname.startsWith('/pins/') && !pathname.endsWith('/edit');
  const isAccountPage = pathname === '/account';
  const hideLayoutBar = isHomePage || isPinDetailPage || isAccountPage;

  return (
    <html lang="en">
      <body
        className={`${barlowCondensed.variable} ${barlow.variable} ${geist.variable} ${instrumentSerif.variable} no-navbar-padding`}
      >
        {!hideLayoutBar && <WeatherTopBar state="clear" />}
        {children}
      </body>
    </html>
  );
}

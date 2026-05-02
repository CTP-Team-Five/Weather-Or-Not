'use client';

import { usePathname } from 'next/navigation';
import { Barlow_Condensed, Barlow, Geist, Instrument_Serif } from 'next/font/google';
import Navbar from '@/components/Navbar';
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
  const isHomePage = pathname === '/';
  const isMapPage = pathname === '/map';
  const isRatingPage = pathname === '/rating';
  // Pin detail (/pins/[id]) owns its own chrome via WeatherTopBar — hide the
  // global Navbar on that route. The /pins/[id]/edit form is unaffected.
  const isPinDetailPage =
    !!pathname && pathname.startsWith('/pins/') && !pathname.endsWith('/edit');
  const hideNavbar = isHomePage || isPinDetailPage;

  return (
    <html lang="en">
      <body
        className={`${barlowCondensed.variable} ${barlow.variable} ${geist.variable} ${instrumentSerif.variable} ${
          isMapPage || isHomePage || isRatingPage || isPinDetailPage ? 'no-navbar-padding' : ''
        }`}
      >
        {!hideNavbar && <Navbar />}
        {children}
      </body>
    </html>
  );
}

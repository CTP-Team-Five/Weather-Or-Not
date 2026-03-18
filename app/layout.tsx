'use client';

import { usePathname } from 'next/navigation';
import { Barlow_Condensed, Barlow } from 'next/font/google';
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMapPage = pathname === '/map';

  return (
    <html lang="en">
      <body
        className={`${barlowCondensed.variable} ${barlow.variable} ${
          isMapPage ? 'no-navbar-padding' : ''
        }`}
      >
        <Navbar />
        {children}
      </body>
    </html>
  );
}

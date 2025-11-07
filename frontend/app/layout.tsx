'use client';

import { usePathname } from 'next/navigation';
import { Geist, Geist_Mono } from 'next/font/google';
import Navbar from '@/components/Navbar';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMapPage = pathname === '/map';

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${
          isMapPage ? 'no-navbar-padding' : ''
        }`}
      >
        <Navbar />
        {children}
      </body>
    </html>
  );
}

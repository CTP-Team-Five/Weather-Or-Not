import type { Metadata, Viewport } from 'next';
import { Manrope, Inter } from 'next/font/google';
import NavShell from '@/components/NavShell';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'WeatherOrNot — Should you go?',
    template: '%s · WeatherOrNot',
  },
  description:
    'Weather scores for hiking, surfing, and snow. Pin your spots. Get a straight answer.',
  keywords: [
    'weather',
    'hiking',
    'surfing',
    'snowboarding',
    'outdoor',
    'forecast',
    'conditions',
  ],
  applicationName: 'WeatherOrNot',
  authors: [{ name: 'Tommy Kimmeth' }],
  openGraph: {
    type: 'website',
    siteName: 'WeatherOrNot',
    title: 'WeatherOrNot — Should you go?',
    description:
      'Surf, hike, snow. Pin a spot. Get a straight answer.',
    url: siteUrl,
    images: [{ url: '/og.svg', width: 1200, height: 630, alt: 'WeatherOrNot' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WeatherOrNot — Should you go?',
    description:
      'Surf, hike, snow. Pin a spot. Get a straight answer.',
    images: ['/og.svg'],
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.svg',
  },
  manifest: '/site.webmanifest',
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f9ff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a1628' },
  ],
  colorScheme: 'light dark',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${inter.variable}`}>
      <body>
        <NavShell>{children}</NavShell>
      </body>
    </html>
  );
}

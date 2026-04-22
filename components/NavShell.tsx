'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Navbar, { type NavVariant } from '@/components/Navbar';

function variantForPath(pathname: string): NavVariant {
  if (pathname === '/') return 'transparent';
  if (pathname === '/map' || pathname === '/rating') return 'transparent';
  return 'solid';
}

function noPaddingFor(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname === '/map' ||
    pathname === '/rating'
  );
}

export default function NavShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const variant = variantForPath(pathname);

  useEffect(() => {
    const cls = 'no-navbar-padding';
    if (noPaddingFor(pathname)) {
      document.body.classList.add(cls);
    } else {
      document.body.classList.remove(cls);
    }
    return () => {
      document.body.classList.remove(cls);
    };
  }, [pathname]);

  return (
    <>
      <Navbar variant={variant} />
      {children}
    </>
  );
}

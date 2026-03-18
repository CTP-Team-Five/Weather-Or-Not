'use client';

import Link from 'next/link';
import React from 'react';
import { WiDaySunny } from 'react-icons/wi';
import styles from './Navbar.module.css';

const navLinks = [
  { name: 'Home', href: '/' },
  { name: 'Map', href: '/map' },
];

const Navbar: React.FC = () => {
  return (
    <nav className="fixed left-0 top-0 z-[1000] flex w-full items-center justify-between border-b border-border-subtle bg-surface/90 px-8 py-4 shadow-card backdrop-blur-md">
      <div className="z-[2001] flex items-center text-xl font-bold">
        <Link href="/" className="flex items-center gap-2 text-foreground hover:text-accent transition-colors">
          <WiDaySunny className={`${styles.logoIcon} text-[2rem]`} />
          <span>WeatherOrNot</span>
        </Link>
      </div>

      <ul className="flex list-none gap-6 p-0 m-0">
        {navLinks.map((link) => (
          <li key={link.name}>
            <Link
              href={link.href}
              className="text-muted-foreground font-medium transition-colors hover:text-foreground"
            >
              {link.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default Navbar;

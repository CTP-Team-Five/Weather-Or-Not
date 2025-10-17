'use client'; 

import Link from 'next/link';
import React from 'react';
import styles from './Navbar.module.css'; 

const navLinks = [
  { name: 'Home', href: '/' },
  { name: 'Map', href: '/about' },
  { name: 'Contact', href: '/contact' },
];

const Navbar: React.FC = () => {
  return (
    <nav className={styles.navbar}>
      <div className={styles.logo}>
        <Link href="/">
          WeatherOrNot Logo
        </Link>
      </div>

      <ul className={styles.navLinks}>
        {navLinks.map((link) => (
          <li key={link.name}>
            <Link href={link.href}>
              {link.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default Navbar;
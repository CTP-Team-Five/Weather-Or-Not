'use client'; 

import Link from 'next/link';
import React from 'react';
import { WiDaySunny } from 'react-icons/wi';
import styles from './Navbar.module.css'; 

const navLinks = [
  { name: 'Home', href: '/' },
  { name: 'Map', href: '/map' },
  { name: 'Contact', href: '/contact' },
];

const Navbar: React.FC = () => {
  return (
    <nav className={styles.navbar}>
      <div className={styles.logo}>
        <Link href="/" className={styles.logoLink}>
          <WiDaySunny className={styles.logoIcon} /> 
                         <span>WeatherOrNot</span>
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
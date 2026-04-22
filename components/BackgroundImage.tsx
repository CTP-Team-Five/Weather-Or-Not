'use client';

import React from 'react';
import Image from 'next/image';
import {
  getBackgroundImage,
  toActivitySlot,
  type ActivitySlot,
  type BackgroundImage as BgImage,
} from '@/lib/activityMedia';
import styles from './BackgroundImage.module.css';

type ScrimMode = 'light' | 'medium' | 'heavy' | 'haze';
type ForegroundMode = 'dark' | 'light';

interface Props {
  /** Activity slot — picks the curated default image */
  slot?: ActivitySlot | string;
  /** Override with an explicit image (takes precedence over slot) */
  image?: BgImage;
  /** Overlay style. Default: 'medium' */
  scrim?: ScrimMode;
  /** Foreground token mode. Default: 'dark' */
  foreground?: ForegroundMode;
  /** Preload this image (use on the above-the-fold LCP hero) */
  priority?: boolean;
  /** Additional CSS class for the wrapper */
  className?: string;
  /** Content rendered on top of the background */
  children: React.ReactNode;
}

export default function BackgroundImage({
  slot,
  image,
  scrim = 'medium',
  foreground = 'dark',
  priority = false,
  className,
  children,
}: Props) {
  const bg =
    image ??
    getBackgroundImage(
      slot
        ? slot === 'hike' ||
          slot === 'surf' ||
          slot === 'snowboard' ||
          slot === 'default'
          ? slot
          : toActivitySlot(slot)
        : 'default',
    );

  const fgClass = foreground === 'light' ? styles.fgLight : styles.fgDark;

  return (
    <div
      className={`${styles.wrapper} ${fgClass} ${className ?? ''}`}
      role="img"
      aria-label={bg.alt}
      data-on={foreground === 'light' ? 'dark' : undefined}
    >
      <Image
        src={bg.src}
        alt=""
        fill
        priority={priority}
        sizes="100vw"
        className={styles.imageLayer}
        style={{
          objectFit: 'cover',
          objectPosition: bg.position ?? 'center',
        }}
        aria-hidden="true"
      />

      <div className={`${styles.scrim} ${styles[scrim]}`} aria-hidden="true" />

      <div className={styles.content}>{children}</div>
    </div>
  );
}

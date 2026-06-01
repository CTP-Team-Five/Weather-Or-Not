// components/plans/EmptyState.tsx
// Centered empty-state card with title + body + optional CTA. Used by
// /plans when there are zero saved plans, and reusable for the other tab
// variants once they wire up real data.

'use client';

import Link from 'next/link';
import styles from './EmptyState.module.css';

interface Cta {
  label: string;
  href:  string;
}

interface Props {
  title: string;
  body:  string;
  cta?:  Cta;
}

export default function EmptyState({ title, body, cta }: Props) {
  return (
    <div className={styles.empty}>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.body}>{body}</p>
      {cta && (
        <Link href={cta.href} className={styles.cta}>
          {cta.label}
        </Link>
      )}
    </div>
  );
}

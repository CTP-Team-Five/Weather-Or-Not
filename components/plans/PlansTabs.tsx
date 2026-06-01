// components/plans/PlansTabs.tsx
// Segmented pill tabs for /plans. URL-driven via ?view= so the back button
// works and tabs are deep-linkable. The active tab is computed by the
// caller (app/plans/page.tsx) from useSearchParams and passed in — this
// component is presentation-only.
//
// `next/link` with `replace` prevents tab switches from polluting history.

'use client';

import Link from 'next/link';
import styles from './PlansTabs.module.css';

export type PlansView = 'upcoming' | 'calendar' | 'tentative' | 'past';

export function isPlansView(v: string): v is PlansView {
  return v === 'upcoming' || v === 'calendar' || v === 'tentative' || v === 'past';
}

const TABS: { view: PlansView; label: string }[] = [
  { view: 'upcoming',  label: 'Upcoming'  },
  { view: 'calendar',  label: 'Calendar'  },
  { view: 'tentative', label: 'Tentative' },
  { view: 'past',      label: 'Past'      },
];

interface Props {
  active: PlansView;
}

export default function PlansTabs({ active }: Props) {
  return (
    <div className={styles.tabs} role="tablist" aria-label="Plans view">
      {TABS.map(({ view, label }) => {
        // /plans is the canonical Upcoming URL — no ?view=upcoming spam.
        const href = view === 'upcoming' ? '/plans' : `/plans?view=${view}`;
        const isActive = view === active;
        return (
          <Link
            key={view}
            href={href}
            replace
            role="tab"
            aria-selected={isActive}
            className={styles.tab}
            data-active={isActive ? 'true' : undefined}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}

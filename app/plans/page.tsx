// app/plans/page.tsx
// /plans — saved-decisions page. Phase 1 ships the shell + Upcoming tab's
// EmptyState. The other tabs (Calendar / Tentative / Past) render their
// chrome but show a "Coming in Phase 2." stub so the IA is visible without
// faking content. PlanCard + bucketed Upcoming list land in slice 3.
//
// useSearchParams forces a client-render bailout, so the page sits behind
// a Suspense boundary — same pattern as app/forecast/page.tsx.

'use client';

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePlans } from '@/lib/plans/usePlans';
import { bucketOf, type Plan, type PlanBucket } from '@/lib/plans/types';
import PlansTabs, { type PlansView, isPlansView } from '@/components/plans/PlansTabs';
import EmptyState from '@/components/plans/EmptyState';
import PlanCard from '@/components/plans/PlanCard';
import styles from './page.module.css';

export default function PlansPage() {
  return (
    <Suspense fallback={<PlansShellLoading />}>
      <PlansPageContent />
    </Suspense>
  );
}

function PlansShellLoading() {
  return (
    <div className={`font-geist ${styles.shell}`}>
      <div className={styles.inner}>
        <div className={styles.dimMessage}>Loading plans…</div>
      </div>
    </div>
  );
}

function PlansPageContent() {
  const searchParams = useSearchParams();
  const raw = searchParams?.get('view') ?? '';
  const view: PlansView = isPlansView(raw) ? raw : 'upcoming';

  const { plans, hydrated, removePlan } = usePlans();
  const count = hydrated ? plans.length : null;

  return (
    <div className={`font-geist ${styles.shell}`}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <div className={styles.eyebrow}>YOUR PLANS</div>
            <p className={styles.subtitle}>Outdoor windows you&apos;ve held</p>
            <p className={styles.count} aria-live="polite">
              {count == null
                ? ' '
                : count === 0
                  ? 'No saved decisions yet.'
                  : `${count} saved decision${count === 1 ? '' : 's'}.`}
            </p>
          </div>

          <PlansTabs active={view} />
        </header>

        <section className={styles.body}>
          {view === 'upcoming' && (
            count === 0 || count == null ? (
              <EmptyState
                title="No plans yet."
                body="Find a good forecast window and save it."
                cta={{ label: 'Open Forecast', href: '/forecast' }}
              />
            ) : (
              <UpcomingBuckets plans={plans} onRemove={removePlan} />
            )
          )}

          {view === 'calendar' && (
            <ComingSoon tab="Calendar view" />
          )}
          {view === 'tentative' && (
            <ComingSoon tab="Tentative plans" />
          )}
          {view === 'past' && (
            <ComingSoon tab="Past plans" />
          )}
        </section>
      </div>
    </div>
  );
}

function ComingSoon({ tab }: { tab: string }) {
  return (
    <div className={styles.comingSoon}>
      <div className={styles.comingSoonTitle}>{tab}</div>
      <p className={styles.comingSoonBody}>Coming in Phase 2.</p>
    </div>
  );
}

const BUCKET_ORDER: { key: PlanBucket; label: string }[] = [
  { key: 'today',    label: 'Today'     },
  { key: 'tomorrow', label: 'Tomorrow'  },
  { key: 'thisWeek', label: 'This week' },
  { key: 'later',    label: 'Later'     },
];

function UpcomingBuckets({
  plans,
  onRemove,
}: {
  plans:    Plan[];
  onRemove: (id: string) => void;
}) {
  // Bucket once per plans change. Past plans live on the Past tab (Phase 2),
  // so we exclude them here even though they have a valid bucket.
  const buckets = useMemo(() => {
    const acc: Record<PlanBucket, Plan[]> = {
      today:    [],
      tomorrow: [],
      thisWeek: [],
      later:    [],
      past:     [],
    };
    for (const p of plans) {
      acc[bucketOf(p)].push(p);
    }
    return acc;
  }, [plans]);

  const sections = BUCKET_ORDER.filter(({ key }) => buckets[key].length > 0);

  if (sections.length === 0) {
    // All plans bucketed as 'past' — Upcoming tab is effectively empty.
    return (
      <EmptyState
        title="Nothing upcoming."
        body="Past plans live on the Past tab when it ships in Phase 2."
        cta={{ label: 'Open Forecast', href: '/forecast' }}
      />
    );
  }

  return (
    <div className={styles.buckets}>
      {sections.map(({ key, label }) => {
        const items = buckets[key];
        return (
          <section key={key} className={styles.bucket}>
            <header className={styles.bucketHeader}>
              <span className={styles.bucketLabel}>{label}</span>
              <span className={styles.bucketCount}>· {items.length}</span>
            </header>
            <div className={styles.bucketGrid}>
              {items.map((p) => (
                <PlanCard key={p.id} plan={p} onRemove={onRemove} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// app/plans/page.tsx
// /plans — saved-decisions page. Phase 1 ships the shell + Upcoming tab's
// EmptyState. The other tabs (Calendar / Tentative / Past) render their
// chrome but show a "Coming in Phase 2." stub so the IA is visible without
// faking content. PlanCard + bucketed Upcoming list land in slice 3.
//
// useSearchParams forces a client-render bailout, so the page sits behind
// a Suspense boundary — same pattern as app/forecast/page.tsx.

'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePlans } from '@/lib/plans/usePlans';
import PlansTabs, { type PlansView, isPlansView } from '@/components/plans/PlansTabs';
import EmptyState from '@/components/plans/EmptyState';
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

  const { plans, hydrated } = usePlans();
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
              // Slice 3 replaces this with the PlanCard grid bucketed by
              // Today / Tomorrow / This week / Later. For slice 2 we just
              // confirm the data is reachable.
              <div className={styles.placeholder}>
                {count} upcoming plan{count === 1 ? '' : 's'} — PlanCard
                layout lands in slice 3.
              </div>
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

'use client';

import { useMemo } from 'react';
import { usePlans } from '@/lib/plans/usePlans';
import { bucketOf, type Plan, type PlanBucket } from '@/lib/plans/types';
import EmptyState from '@/components/plans/EmptyState';
import PlanCard from '@/components/plans/PlanCard';
import CalendarAgendaView from '@/components/plans/CalendarAgendaView';
import styles from './page.module.css';

export default function PlansPage() {
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
                ? ' '
                : count === 0
                  ? 'No saved decisions yet.'
                  : `${count} saved decision${count === 1 ? '' : 's'}.`}
            </p>
          </div>
        </header>

        <section className={styles.body}>
          {count === 0 || count == null ? (
            <EmptyState
              title="No plans yet."
              body="Find a good forecast window and save it."
              cta={{ label: 'Open Forecast', href: '/forecast' }}
            />
          ) : (
            <>
              <CalendarAgendaView plans={plans} onRemove={removePlan} />
              <UpcomingBuckets plans={plans} onRemove={removePlan} />
            </>
          )}
        </section>
      </div>
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

  if (sections.length === 0) return null;

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

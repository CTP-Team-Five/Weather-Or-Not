'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { Plan } from '@/lib/plans/types';
import EmptyState from './EmptyState';
import styles from './CalendarAgendaView.module.css';

interface Props {
  plans:    Plan[];
  onRemove: (id: string) => void;
}

function formatHour(iso: string): string {
  const h = parseInt(iso.slice(11, 13), 10);
  if (h === 0)  return '12AM';
  if (h === 12) return '12PM';
  return h < 12 ? `${h}AM` : `${h - 12}PM`;
}

function toDateIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

export default function CalendarAgendaView({ plans }: Props) {
  const plansByDate = useMemo(() => {
    const map = new Map<string, Plan[]>();
    for (const p of plans) {
      const bucket = map.get(p.dateIso) ?? [];
      bucket.push(p);
      map.set(p.dateIso, bucket);
    }
    for (const [, arr] of map) {
      arr.sort((a, b) => a.startIso.localeCompare(b.startIso));
    }
    return map;
  }, [plans]);

  const monthDays = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const todayIso = toDateIso(now);

    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    const startDow = start.getDay();
    start.setDate(start.getDate() - startDow);

    const days: { dateIso: string; dayNum: number; isPast: boolean; isToday: boolean; plans: Plan[] }[] = [];
    const cursor = new Date(start);
    for (let i = 0; i < 35; i++) {
      const iso = toDateIso(cursor);
      days.push({
        dateIso: iso,
        dayNum:  cursor.getDate(),
        isPast:  iso < todayIso,
        isToday: iso === todayIso,
        plans:   plansByDate.get(iso) ?? [],
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }, [plansByDate]);

  if (plans.length === 0) {
    return (
      <EmptyState
        title="No saved outdoor plans yet."
        body="Once you save a forecast window, it'll appear here on the date you held it for."
        cta={{ label: 'Find a forecast window', href: '/forecast' }}
      />
    );
  }

  return (
    <div className={styles.month}>
      <div className={styles.monthGrid}>
        {DOW.map((d) => (
          <div key={d} className={styles.monthDow}>{d}</div>
        ))}
        {monthDays.map((day) => (
          <div
            key={day.dateIso}
            className={`${styles.monthCell} ${day.isPast ? styles.monthCellPast : ''} ${day.isToday ? styles.monthCellToday : ''}`}
          >
            <div className={styles.monthCellNum}>{day.dayNum}</div>
            {day.plans.map((plan) => (
              <Link
                key={plan.id}
                href={`/pins/${plan.pinId}`}
                className={styles.monthChip}
                data-verdict={plan.snapshot.verdict}
              >
                <span>{formatHour(plan.startIso)}</span>
                <span className={styles.monthChipName}>{plan.pinName}</span>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// lib/plans/usePlans.ts
// SSR-safe React hook around PlanStore. Empty first render avoids the
// hydration mismatch that would otherwise bite us when the server (where
// localStorage doesn't exist) renders a different list than the client.
// Same pattern as loadStoredAvailability() in app/forecast/page.tsx —
// start with [], hydrate in a post-mount useEffect.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { PlanStore } from './planStore';
import type { Plan, PlanDraft } from './types';
import { finalisePlan } from './buildPlan';

export interface UsePlansResult {
  plans:      Plan[];
  hydrated:   boolean;
  addPlan:    (draft: PlanDraft, note?: string) => Plan;
  removePlan: (id: string) => void;
  clear:      () => void;
}

export function usePlans(): UsePlansResult {
  const [plans,    setPlans]    = useState<Plan[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPlans(PlanStore.all());
    setHydrated(true);
  }, []);

  const addPlan = useCallback((draft: PlanDraft, note?: string): Plan => {
    const plan = finalisePlan(draft, note);
    PlanStore.add(plan);
    setPlans(PlanStore.all());
    return plan;
  }, []);

  const removePlan = useCallback((id: string): void => {
    PlanStore.remove(id);
    setPlans(PlanStore.all());
  }, []);

  const clear = useCallback((): void => {
    PlanStore.clear();
    setPlans([]);
  }, []);

  return { plans, hydrated, addPlan, removePlan, clear };
}

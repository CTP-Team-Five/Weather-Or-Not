// lib/displayName.ts
// Single source of truth for "what should we call this pin in the UI?"
//
// Priority:
//   1. pin.name           — explicit short label set at creation (rare but
//                           wins when present)
//   2. pin.area           — user-editable display name. The rename form
//                           writes here, so a renamed pin's new label
//                           lives in this field.
//   3. pin.canonical_name — full OSM-derived metadata name. Used as
//                           fallback when neither of the above is set.
//   4. 'Unnamed Spot'     — last-resort string so we never render
//                           undefined / empty.
//
// Previous priority (canonical_name before area) caused user renames to
// be ignored everywhere except the area chip — the rename "didn't take"
// from the user's perspective. Putting area ahead of canonical_name
// makes user edits the source of truth for the displayed name.

import type { SavedPin } from '@/components/data/pinStore';

type PinNameFields = Pick<SavedPin, 'name' | 'area' | 'canonical_name'>;

export function displayName(pin: PinNameFields): string {
  return pin.name || pin.area || pin.canonical_name || 'Unnamed Spot';
}

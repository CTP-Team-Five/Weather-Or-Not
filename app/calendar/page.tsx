// app/calendar/page.tsx
// Deep-link redirect. Notification links / shared URLs / old bookmarks that
// point at /calendar bounce to the Calendar tab inside /plans. No UI of its
// own — the Calendar view lives at /plans?view=calendar (per the handoff:
// "Calendar is NOT a top-level nav item. Ever.").
//
// router.replace (not router.push) so the bare /calendar URL never sits in
// browser history — back button takes the user where they came from, not
// to a bounce-and-rebounce loop.

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CalendarRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/plans?view=calendar');
  }, [router]);

  // Tiny placeholder so there's no flash of blank page before the redirect
  // fires on first paint. Uses neutral chrome tokens to blend with the rest
  // of the app while routing happens.
  return (
    <main
      style={{
        minHeight:       'calc(100vh - var(--navbar-height))',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        background:      'hsl(var(--background))',
        color:           'hsl(var(--muted-foreground))',
        fontFamily:      'var(--font-display)',
        fontSize:        12,
        letterSpacing:   '0.18em',
        textTransform:   'uppercase',
      }}
    >
      Opening plans · calendar view…
    </main>
  );
}

'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App error boundary:', error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <p
        style={{
          fontSize: 'var(--text-caption, 0.75rem)',
          fontWeight: 600,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'hsl(var(--status-skip-bg, 4 70% 44%))',
        }}
      >
        Something broke
      </p>
      <h1
        style={{
          fontFamily: 'var(--font-display, "Manrope", system-ui, sans-serif)',
          fontSize: 'clamp(2rem, 5vw, 3rem)',
          fontWeight: 800,
          letterSpacing: '-0.02em',
        }}
      >
        Conditions unknown.
      </h1>
      <p style={{ maxWidth: '40ch', color: 'hsl(var(--muted-foreground))', lineHeight: 1.6 }}>
        We couldn&rsquo;t render this page. Give it another shot in a moment.
      </p>
      <button
        onClick={reset}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          minHeight: '48px',
          padding: '0.85rem 1.75rem',
          borderRadius: '9999px',
          border: 'none',
          background: 'hsl(var(--accent))',
          color: 'hsl(var(--accent-foreground))',
          fontWeight: 600,
          cursor: 'pointer',
          marginTop: '0.5rem',
        }}
      >
        Try again
      </button>
    </main>
  );
}

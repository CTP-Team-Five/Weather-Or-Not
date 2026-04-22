import Link from 'next/link';

export default function NotFound() {
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
          color: 'hsl(var(--muted-foreground, 215 17% 38%))',
        }}
      >
        Off the map
      </p>
      <h1
        style={{
          fontFamily: 'var(--font-display, "Manrope", system-ui, sans-serif)',
          fontSize: 'clamp(2.5rem, 6vw, 4rem)',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          color: 'hsl(var(--foreground))',
        }}
      >
        No pin here.
      </h1>
      <p
        style={{
          maxWidth: '40ch',
          color: 'hsl(var(--muted-foreground))',
          lineHeight: 1.6,
        }}
      >
        The page you&rsquo;re looking for got washed out or never existed. Head
        back to your spots and try again.
      </p>
      <Link
        href="/"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          minHeight: '48px',
          padding: '0.85rem 1.75rem',
          borderRadius: '9999px',
          background: 'hsl(var(--accent))',
          color: 'hsl(var(--accent-foreground))',
          fontWeight: 600,
          marginTop: '0.5rem',
        }}
      >
        Back to your spots
      </Link>
    </main>
  );
}

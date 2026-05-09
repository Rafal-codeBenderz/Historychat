/** Dekoracyjna oś (uproszczona) — bez geokodowania; etykiety eurocentryczne. */
export function TimeTravelEraTimeline() {
  const ticks = [
    { x: 6, label: 'Staroż.' },
    { x: 22, label: 'Średn.' },
    { x: 38, label: 'Ren.' },
    { x: 54, label: 'Ośw.' },
    { x: 70, label: 'XIX' },
    { x: 86, label: 'XX' },
  ];
  return (
    <div
      style={{ marginTop: '20px', marginBottom: '8px' }}
      role="img"
      aria-label="Oś epok w tradycji europejskiej, schemat poglądowy bez skali chronologicznej"
    >
      <p
        style={{
          fontSize: '10px',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.28)',
          marginBottom: '8px',
          fontFamily: "'Outfit', sans-serif",
        }}
      >
        Oś epok (tradycja europejska, poglądowo)
      </p>
      <svg width="100%" height="36" viewBox="0 0 100 36" preserveAspectRatio="none" style={{ display: 'block' }} aria-hidden>
        <line x1="4" y1="18" x2="96" y2="18" stroke="rgba(255,255,255,0.12)" strokeWidth="0.4" />
        {ticks.map((t) => (
          <g key={t.label}>
            <line x1={t.x} y1="12" x2={t.x} y2="24" stroke="rgba(200,175,120,0.35)" strokeWidth="0.5" />
            <text
              x={t.x}
              y="32"
              textAnchor="middle"
              fill="rgba(255,255,255,0.32)"
              fontSize="3.2"
              fontFamily="system-ui, sans-serif"
            >
              {t.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function Logo() {
  return (
    <div>
      <div
        style={{
          fontFamily: "'EB Garamond', serif",
          fontSize: '22px',
          fontWeight: 500,
          color: 'rgba(255,255,255,0.9)',
          letterSpacing: '-0.02em',
          lineHeight: 1.2,
        }}
      >
        Historia<span style={{ color: 'rgba(255,200,100,0.7)' }}>Chat</span>
      </div>
      <div
        style={{
          fontSize: '11px',
          color: 'rgba(255,255,255,0.28)',
          fontFamily: "'EB Garamond', serif",
          fontStyle: 'italic',
          marginTop: '2px',
        }}
      >
        RAG · Rozmowy z historią
      </div>
    </div>
  );
}

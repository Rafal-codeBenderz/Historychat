export function SourceBadge({ source, score }: { source: string; score: number }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '6px',
        padding: '3px 8px',
        fontSize: '11px',
        color: 'rgba(255,255,255,0.55)',
        fontFamily: "'EB Garamond', Georgia, serif",
        fontStyle: 'italic',
      }}
    >
      <span style={{ opacity: 0.4 }}>📜</span>
      {source}
      <span
        style={{
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '4px',
          padding: '1px 4px',
          fontSize: '10px',
          fontStyle: 'normal',
          fontFamily: 'monospace',
          color: 'rgba(255,255,255,0.35)',
        }}
      >
        {Math.round(score * 100)}%
      </span>
    </div>
  );
}

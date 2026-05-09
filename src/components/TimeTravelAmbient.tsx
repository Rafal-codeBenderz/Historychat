import { useEffect, useMemo, useRef, useState } from 'react';
import { resolveAmbientAudioUrl } from '../utils/timeTravelAmbientConfig';

const MUTE_KEY = 'historychat_tt_ambient_muted_v1';

/** Opcjonalny loop audio z URL (np. CC0); bez URL komponent nic nie robi. */
export function TimeTravelAmbient({ active, year }: { active: boolean; year: number }) {
  const url = useMemo(() => resolveAmbientAudioUrl(year), [year]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(() => {
    try {
      const v = localStorage.getItem(MUTE_KEY);
      if (v === null) return true;
      return v === '1';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (!url || !active) {
      audioRef.current?.pause();
      return;
    }
    if (muted) {
      audioRef.current?.pause();
      return;
    }
    const a = new Audio(url);
    a.loop = true;
    a.volume = 0.22;
    audioRef.current = a;
    void a.play().catch(() => {});
    return () => {
      a.pause();
      audioRef.current = null;
    };
  }, [url, active, muted]);

  if (!url) return null;

  return (
    <button
      type="button"
      onClick={() => {
        setMuted((m) => {
          const next = !m;
          try {
            localStorage.setItem(MUTE_KEY, next ? '1' : '0');
          } catch {
            /* ignore */
          }
          return next;
        });
      }}
      style={{
        position: 'fixed',
        bottom: '18px',
        right: '18px',
        zIndex: 50,
        padding: '8px 12px',
        borderRadius: '10px',
        border: '1px solid rgba(255,255,255,0.15)',
        background: 'rgba(0,0,0,0.45)',
        color: 'rgba(255,255,255,0.75)',
        fontSize: '12px',
        cursor: 'pointer',
        fontFamily: "'Outfit', sans-serif",
      }}
      aria-pressed={!muted}
    >
      {muted ? 'Ambient: wył.' : 'Ambient: wł.'}
    </button>
  );
}

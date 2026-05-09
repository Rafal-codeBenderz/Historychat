import { useCallback, useState } from 'react';
import { suggestTimeTravelPlaces } from '@utils';

type RegionDef = {
  /** Wartość `region_zone` w analityce (bez PII). */
  id: string;
  label: string;
  regionToken: string;
  /** Drugi substring lokalizacji z meta, gdy pierwszy nie daje wyników. */
  altToken?: string;
  /** Gdy API zwróci pustą listę dla roku. */
  fallbackPlace: string;
  path: string;
};

/** Uproszczona mapa świata: klik ustawia miejsce wg `/api/time-travel/suggest-scene` (substring w lokalizacjach meta). */
const REGIONS: RegionDef[] = [
  {
    id: 'americas',
    label: 'Ameryki',
    regionToken: 'usa',
    altToken: 'meksyk',
    fallbackPlace: 'USA',
    path: 'M 4 16 L 24 12 L 30 48 L 8 54 Z',
  },
  {
    id: 'poland_central',
    label: 'Środkowa Europa',
    regionToken: 'polska',
    fallbackPlace: 'Polska',
    path: 'M 48 18 L 58 16 L 61 30 L 52 34 L 45 28 Z',
  },
  {
    id: 'uk_isles',
    label: 'Wyspy Brytyjskie',
    regionToken: 'londyn',
    fallbackPlace: 'Londyn',
    path: 'M 38 14 L 46 12 L 45 24 L 37 22 Z',
  },
  {
    id: 'western_europe',
    label: 'Europa Zachodnia',
    regionToken: 'francja',
    fallbackPlace: 'Francja',
    path: 'M 42 22 L 54 18 L 56 36 L 44 38 Z',
  },
  {
    id: 'mediterranean',
    label: 'Morze Śródziemne',
    regionToken: 'italia',
    fallbackPlace: 'Rzym',
    path: 'M 52 30 L 60 26 L 64 44 L 54 46 Z',
  },
  {
    id: 'eastern_slavic',
    label: 'Europa Wschodnia',
    regionToken: 'moskwa',
    altToken: 'wieden',
    fallbackPlace: 'Moskwa',
    path: 'M 58 10 L 82 8 L 86 36 L 62 34 Z',
  },
  {
    id: 'mena',
    label: 'Bliski Wschód i Afryka Płn.',
    regionToken: 'egipt',
    fallbackPlace: 'Egipt',
    path: 'M 54 36 L 74 32 L 78 52 L 52 54 Z',
  },
  {
    id: 'east_asia',
    label: 'Azja Wschodnia',
    regionToken: 'chiny',
    fallbackPlace: 'Chiny',
    path: 'M 78 14 L 116 12 L 118 42 L 80 44 Z',
  },
  {
    id: 'south_asia',
    label: 'Azja Południowa',
    regionToken: 'indie',
    fallbackPlace: 'Indie',
    path: 'M 82 38 L 98 34 L 100 52 L 84 54 Z',
  },
];

type TimeTravelRegionMapProps = {
  year: number;
  disabled?: boolean;
  accentColor?: string;
  onPick: (place: string, regionZone: string) => void;
};

export function TimeTravelRegionMap({ year, disabled, accentColor, onPick }: TimeTravelRegionMapProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const stroke = accentColor ?? 'rgba(200,170,120,0.45)';

  const activate = useCallback(
    async (r: RegionDef) => {
      if (disabled || busyId) return;
      setBusyId(r.id);
      try {
        let places = await suggestTimeTravelPlaces(year, r.regionToken);
        if (places.length === 0 && r.altToken) {
          places = await suggestTimeTravelPlaces(year, r.altToken);
        }
        const place = places[0] ?? r.fallbackPlace;
        onPick(place, r.id);
      } finally {
        setBusyId(null);
      }
    },
    [busyId, disabled, onPick, year],
  );

  return (
    <div
      role="group"
      aria-label="Uproszczona mapa regionów — wybór miejsca z bazy metadanych"
      style={{ marginTop: '12px', marginBottom: '16px' }}
    >
      <p
        style={{
          fontSize: '11px',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.28)',
          marginBottom: '10px',
          fontFamily: "'Outfit', sans-serif",
        }}
      >
        Region na mapie (schemat) — ustawia pole miejsca
      </p>
      <svg
        viewBox="0 0 120 58"
        width="100%"
        height="min(220px, 42vw)"
        style={{ display: 'block', maxWidth: '440px', touchAction: 'manipulation' }}
        aria-hidden
      >
        {REGIONS.map((r) => {
          const active = busyId === r.id;
          return (
            <path
              key={r.id}
              d={r.path}
              fill={active ? 'rgba(200,170,120,0.28)' : 'rgba(200,170,120,0.1)'}
              stroke={stroke}
              strokeWidth={0.6}
              vectorEffect="non-scaling-stroke"
              style={{
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
              onClick={() => void activate(r)}
            />
          );
        })}
      </svg>
      <ul
        style={{
          margin: '10px 0 0',
          padding: 0,
          listStyle: 'none',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        {REGIONS.map((r) => (
          <li key={`btn-${r.id}`}>
            <button
              type="button"
              disabled={disabled || !!busyId}
              onClick={() => void activate(r)}
              style={{
                minHeight: '44px',
                padding: '8px 12px',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.12)',
                background: busyId === r.id ? 'rgba(200,170,120,0.2)' : 'rgba(0,0,0,0.22)',
                color: 'rgba(255,235,210,0.88)',
                fontSize: '12px',
                fontFamily: "'Outfit', sans-serif",
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >
              {r.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

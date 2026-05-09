import { getEraTheme } from './timeTravelEraTheme';

/**
 * Opcjonalne audio per bucket epoki (Vite wymaga statycznych kluczy env).
 * Fallback: `VITE_TT_AMBIENT_URL` gdy brak URL dla danego bucketu.
 */
export function resolveAmbientAudioUrl(year: number): string {
  const id = getEraTheme(year).id;
  const e = import.meta.env;
  const byBucket: Record<string, string | undefined> = {
    ancient: e.VITE_TT_AMBIENT_ANCIENT_URL,
    medieval: e.VITE_TT_AMBIENT_MEDIEVAL_URL,
    early_modern: e.VITE_TT_AMBIENT_EARLY_MODERN_URL,
    modern: e.VITE_TT_AMBIENT_MODERN_URL,
    contemporary: e.VITE_TT_AMBIENT_CONTEMPORARY_URL,
    unknown: e.VITE_TT_AMBIENT_UNKNOWN_URL,
  };
  const specific = (byBucket[id] ?? '').trim();
  if (specific) return specific;
  return (e.VITE_TT_AMBIENT_URL ?? '').trim();
}

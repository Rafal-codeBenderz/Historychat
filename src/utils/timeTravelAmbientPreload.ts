import { resolveAmbientAudioUrl } from './timeTravelAmbientConfig';

/**
 * Reprezentatywne lata per bucket epoki — jeden URL na bucket zwykle wystarczy do preloadu.
 */
const PRELOAD_SAMPLE_YEARS = [-200, 1100, 1520, 1750, 1850, 1925, 1965];

let ambientPreloaded = false;

/** Ładuje w tle unikalne pliki ambientu (gdy skonfigurowano VITE_TT_AMBIENT_*). Wywołaj raz po wejściu w TT. */
export function preloadTimeTravelAmbientOnce(): void {
  if (ambientPreloaded) return;
  ambientPreloaded = true;
  const urls = new Set<string>();
  for (const y of PRELOAD_SAMPLE_YEARS) {
    const u = resolveAmbientAudioUrl(y).trim();
    if (u) urls.add(u);
  }
  for (const url of urls) {
    try {
      const a = new Audio(url);
      a.preload = 'auto';
    } catch {
      /* ignore */
    }
  }
}

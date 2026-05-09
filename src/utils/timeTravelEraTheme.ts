import { eraBucketForYear } from './timeTravelAnalytics';

export type EraTheme = {
  id: string;
  label: string;
  headingFont: string;
  bodyAccent: string;
  cssVars: Record<string, string>;
};

/** Visual era signature (palette + heading font). Aligns with PODROZ plan Faza A — not museum-grade, one clear signal per bucket. */
export function getEraTheme(year: number): EraTheme {
  const bucket = eraBucketForYear(year);
  const themes: Record<string, EraTheme> = {
    ancient: {
      id: 'ancient',
      label: 'Starożytność',
      headingFont: "'Libre Baskerville', Georgia, serif",
      bodyAccent: 'rgba(220, 200, 160, 0.95)',
      cssVars: {
        '--tt-era-bg0': 'rgba(40, 32, 24, 0.55)',
        '--tt-era-bg1': 'rgba(25, 45, 38, 0.35)',
        '--tt-era-accent': 'rgba(200, 175, 120, 0.85)',
        '--tt-era-border': 'rgba(200, 175, 120, 0.25)',
      },
    },
    medieval: {
      id: 'medieval',
      label: 'Średniowiecze / wczesny nowożytny',
      headingFont: "'EB Garamond', Georgia, serif",
      bodyAccent: 'rgba(230, 210, 170, 0.92)',
      cssVars: {
        '--tt-era-bg0': 'rgba(35, 28, 48, 0.5)',
        '--tt-era-bg1': 'rgba(55, 30, 22, 0.35)',
        '--tt-era-accent': 'rgba(210, 160, 90, 0.9)',
        '--tt-era-border': 'rgba(210, 160, 90, 0.28)',
      },
    },
    early_modern: {
      id: 'early_modern',
      label: 'Renesans i oświecenie',
      headingFont: "'Playfair Display', Georgia, serif",
      bodyAccent: 'rgba(245, 230, 200, 0.95)',
      cssVars: {
        '--tt-era-bg0': 'rgba(28, 32, 52, 0.45)',
        '--tt-era-bg1': 'rgba(48, 36, 24, 0.4)',
        '--tt-era-accent': 'rgba(220, 185, 110, 0.9)',
        '--tt-era-border': 'rgba(220, 185, 110, 0.3)',
      },
    },
    modern: {
      id: 'modern',
      label: 'XIX i pierwsza połowa XX w.',
      headingFont: "'Playfair Display', Georgia, serif",
      bodyAccent: 'rgba(235, 225, 210, 0.95)',
      cssVars: {
        '--tt-era-bg0': 'rgba(22, 28, 42, 0.55)',
        '--tt-era-bg1': 'rgba(38, 28, 22, 0.4)',
        '--tt-era-accent': 'rgba(200, 165, 120, 0.88)',
        '--tt-era-border': 'rgba(200, 165, 120, 0.28)',
      },
    },
    contemporary: {
      id: 'contemporary',
      label: 'Współczesność',
      headingFont: "'Space Mono', 'Outfit', monospace",
      bodyAccent: 'rgba(200, 220, 235, 0.9)',
      cssVars: {
        '--tt-era-bg0': 'rgba(18, 32, 44, 0.55)',
        '--tt-era-bg1': 'rgba(28, 36, 40, 0.45)',
        '--tt-era-accent': 'rgba(140, 190, 220, 0.85)',
        '--tt-era-border': 'rgba(140, 190, 220, 0.3)',
      },
    },
    unknown: {
      id: 'unknown',
      label: 'Epoka',
      headingFont: "'EB Garamond', Georgia, serif",
      bodyAccent: 'rgba(255, 255, 255, 0.75)',
      cssVars: {
        '--tt-era-bg0': 'rgba(20, 22, 30, 0.4)',
        '--tt-era-bg1': 'rgba(20, 22, 30, 0.3)',
        '--tt-era-accent': 'rgba(200, 170, 120, 0.8)',
        '--tt-era-border': 'rgba(255, 255, 255, 0.12)',
      },
    },
  };
  return themes[bucket] ?? themes.unknown;
}

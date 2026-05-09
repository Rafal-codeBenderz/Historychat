/** A/B i rollout landingu TT — zob. docs/TT_METRICS_BASELINE.md */

export const TT_LANDING_SESSION_KEY = 'historychat_tt_land_v1';

/**
 * - VITE_TT_LANDING_AB=off → zawsze compact (legacy).
 * - VITE_TT_LANDING_VARIANT=compact|immersive → wymuszony wariant (po decyzji z eksperymentu).
 * - W przeciwnym razie: losowanie 20% immersive / 80% compact, utrwalone w sessionStorage.
 */
export function getInitialTTLandingVariant(): 'compact' | 'immersive' {
  if (import.meta.env.VITE_TT_LANDING_AB === 'off') return 'compact';
  const forced = import.meta.env.VITE_TT_LANDING_VARIANT;
  if (forced === 'compact' || forced === 'immersive') return forced;
  try {
    const e = sessionStorage.getItem(TT_LANDING_SESSION_KEY);
    if (e === 'immersive' || e === 'compact') return e;
    const immersive = Math.random() < 0.2;
    const v = immersive ? 'immersive' : 'compact';
    sessionStorage.setItem(TT_LANDING_SESSION_KEY, v);
    return v;
  } catch {
    return 'compact';
  }
}

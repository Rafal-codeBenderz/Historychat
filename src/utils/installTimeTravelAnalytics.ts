/**
 * Installs window.__historychatTrackTT so production analytics (GTM dataLayer, PostHog, etc.)
 * receive TT events with the allowlisted payload only. See timeTravelAnalytics.ts and TRUST_PRIVACY_BASELINE.md.
 */
import type { TimeTravelAnalyticsEvent, TimeTravelAnalyticsPayload } from './timeTravelAnalytics';

export function installTimeTravelAnalyticsBridge(): void {
  if (typeof window === 'undefined') return;
  const w = window as Window & { dataLayer?: unknown[] };
  if (!Array.isArray(w.dataLayer)) {
    w.dataLayer = [];
  }
  if (window.__historychatTrackTT) return;

  window.__historychatTrackTT = (name: TimeTravelAnalyticsEvent, payload: TimeTravelAnalyticsPayload) => {
    if (!Array.isArray(w.dataLayer)) return;
    const row: Record<string, string | number | boolean | undefined> = {
      event: `historychat_${name}`,
      historychat_tt_event: name,
    };
    if (payload.schema_version !== undefined) row.historychat_tt_schema_version = payload.schema_version;
    if (payload.place_input_type !== undefined) row.historychat_tt_place_input_type = payload.place_input_type;
    if (payload.era_bucket !== undefined) row.historychat_tt_era_bucket = payload.era_bucket;
    if (payload.app_shell !== undefined) row.historychat_tt_app_shell = payload.app_shell;
    if (payload.landing_variant !== undefined) {
      row.historychat_tt_landing_variant = payload.landing_variant;
    }
    if (payload.mission_slot !== undefined) {
      row.historychat_tt_mission_slot = payload.mission_slot;
    }
    if (payload.region_zone !== undefined) {
      row.historychat_tt_region_zone = payload.region_zone;
    }
    w.dataLayer.push(row);
  };
}

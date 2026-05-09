/**
 * Analityka TT — wyłącznie zdarzenia i dozwolone pola (bez treści czatu, roku, nazwy miejsca).
 * Zob. docs/TRUST_PRIVACY_BASELINE.md
 */

export type TimeTravelAnalyticsEvent =
  | 'tt_session_start'
  | 'tt_chat_entered'
  | 'tt_place_suggested'
  | 'tt_place_freetext'
  | 'tt_place_chip'
  | 'tt_region_map_pick'
  | 'tt_mission_strip_shown'
  | 'tt_mission_pick';

const ALLOWED_PAYLOAD_KEYS = new Set([
  'schema_version',
  'place_input_type',
  'era_bucket',
  'app_shell',
  'landing_variant',
  'mission_slot',
  'region_zone',
]);

export type TimeTravelAnalyticsPayload = {
  event: TimeTravelAnalyticsEvent;
} & Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    __historychatTrackTT?: (
      name: TimeTravelAnalyticsEvent,
      payload: TimeTravelAnalyticsPayload,
    ) => void;
  }
}

/** Safe coarse era label for analytics (no exact year leaked to third parties beyond bucket). */
export function eraBucketForYear(year: number): string {
  if (!Number.isFinite(year)) return 'unknown';
  if (year < 500) return 'ancient';
  if (year < 1500) return 'medieval';
  if (year < 1800) return 'early_modern';
  if (year < 1946) return 'modern';
  return 'contemporary';
}

export function trackTimeTravelEvent(
  name: TimeTravelAnalyticsEvent,
  data?: Record<string, string | number | boolean | undefined>,
): void {
  const payload: TimeTravelAnalyticsPayload = { event: name, schema_version: 1 };
  if (data) {
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined || k === 'event') continue;
      if (!ALLOWED_PAYLOAD_KEYS.has(k)) continue;
      payload[k] = v;
    }
  }
  if (import.meta.env.DEV) {
    console.debug('[historychat-tt-analytics]', payload);
  }
  if (typeof window !== 'undefined' && window.__historychatTrackTT) {
    window.__historychatTrackTT(name, payload);
  }
}

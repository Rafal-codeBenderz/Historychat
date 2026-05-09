const JOURNEY_KEY = 'historychat_tt_journey_v1';
const MAX_BEATS = 12;

export type JourneyBeat = {
  year: string;
  place: string;
  charName?: string;
  at: string;
};

function readBeats(): JourneyBeat[] {
  try {
    const raw = sessionStorage.getItem(JOURNEY_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return [];
    return p.filter(
      (b): b is JourneyBeat =>
        typeof b === 'object' &&
        b !== null &&
        typeof (b as JourneyBeat).year === 'string' &&
        typeof (b as JourneyBeat).place === 'string',
    );
  } catch {
    return [];
  }
}

function writeBeats(beats: JourneyBeat[]) {
  try {
    sessionStorage.setItem(JOURNEY_KEY, JSON.stringify(beats.slice(0, MAX_BEATS)));
  } catch {
    /* quota */
  }
}

export function loadJourneyBeats(): JourneyBeat[] {
  return readBeats();
}

export function recordJourneyBeat(beat: Omit<JourneyBeat, 'at'>): void {
  const at = new Date().toISOString();
  const prev = readBeats();
  const key = `${beat.year}|${beat.place.trim().toLowerCase()}`;
  const filtered = prev.filter((b) => `${b.year}|${b.place.trim().toLowerCase()}` !== key);
  writeBeats([{ ...beat, at }, ...filtered]);
}

export function clearJourneyBeats(): void {
  try {
    sessionStorage.removeItem(JOURNEY_KEY);
  } catch {
    /* ignore */
  }
}

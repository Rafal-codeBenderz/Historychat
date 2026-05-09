import { Character, Message, Fragment, DebateTurnRequest, DebateVerdictRequest, DebateTurn, TimeTravelMeta } from '@types';

export const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function fetchCharacters(): Promise<Character[]> {
  const res = await fetch(`${API}/api/characters`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function sendMessage(
  characterId: string,
  message: string,
  history: Message[],
  options?: { sourceStem?: string },
): Promise<{ answer: string; fragments: Fragment[] }> {
  const body: Record<string, unknown> = {
    characterId,
    message,
    history: history.map((m) => ({ role: m.role, content: m.content })),
  };
  if (options?.sourceStem) {
    body.sourceStem = options.sourceStem;
  }
  const res = await fetch(`${API}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Debate API
// ---------------------------------------------------------------------------
export async function sendDebateTurn(payload: DebateTurnRequest): Promise<DebateTurn> {
  const res = await fetch(`${API}/api/debate/turn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export async function sendDebateVerdict(payload: DebateVerdictRequest): Promise<DebateTurn> {
  const res = await fetch(`${API}/api/debate/verdict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Time-travel API (zgodne z docs/api_contract.md sekcja "Tryb Podroz w czasie")
// ---------------------------------------------------------------------------

/** Mapa char_id -> meta TT (start_year/end_year/locations + opcjonalne pola). */
export type TimeTravelMetaMap = Record<string, TimeTravelMeta>;

export class SceneNotAllowedError extends Error {
  readonly code = 'scene_not_allowed';
  constructor(message: string) {
    super(message);
    this.name = 'SceneNotAllowedError';
  }
}

export async function fetchTimeTravelMeta(): Promise<TimeTravelMetaMap> {
  const res = await fetch(`${API}/api/characters/time-travel-meta`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as TimeTravelMetaMap;
  if (!data || typeof data !== 'object') return {};
  return data;
}

/**
 * Filtruje char_id po (year, location) zgodnie z heurystyka backendu (`is_scene_allowed`):
 * - rok w oknie meta.start_year..end_year,
 * - location dopasowane substring case-insensitive (obie strony) do meta.locations.
 */
export function filterCharacterIdsForTimeTravel(
  meta: TimeTravelMetaMap,
  allIds: string[],
  year: number,
  location: string,
): Set<string> {
  const out = new Set<string>();
  if (!Number.isFinite(year)) return out;
  const search = location.trim().toLowerCase();
  if (!search) return out;
  for (const id of allIds) {
    const m = meta[id];
    if (!m) continue;
    if (year < m.start_year || year > m.end_year) continue;
    let matched = false;
    for (const loc of m.locations ?? []) {
      const lo = String(loc).toLowerCase();
      if (search.includes(lo) || lo.includes(search)) {
        matched = true;
        break;
      }
    }
    if (matched) out.add(id);
  }
  return out;
}

export async function suggestTimeTravelPlaces(year: number, regionToken: string = ''): Promise<string[]> {
  const body: Record<string, unknown> = { year };
  if (regionToken) body.regionToken = regionToken;
  const res = await fetch(`${API}/api/time-travel/suggest-scene`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { places?: unknown };
  if (!Array.isArray(data?.places)) return [];
  return data.places.filter((p): p is string => typeof p === 'string');
}

export async function sendTimeTravelMessage(
  characterId: string,
  message: string,
  year: number,
  location: string,
  history: Message[],
  options?: { sourceStem?: string; returningVisitor?: boolean },
): Promise<{ answer: string; fragments: Fragment[] }> {
  const body: Record<string, unknown> = {
    characterId,
    message,
    history: history.map((m) => ({ role: m.role, content: m.content })),
    year,
    location,
  };
  if (options?.sourceStem) body.sourceStem = options.sourceStem;
  if (options?.returningVisitor) body.returningVisitor = true;

  const res = await fetch(`${API}/api/chat/time-travel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 422) {
    const err = await res.json().catch(() => ({}));
    if ((err as { error_code?: string }).error_code === 'scene_not_allowed') {
      const userMsg =
        (err as { user_message?: string }).user_message ??
        'Ta postac nie jest dostepna dla podanego roku lub miejsca.';
      throw new SceneNotAllowedError(userMsg);
    }
    throw new Error((err as { error?: string }).error ?? `HTTP 422`);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
export async function generateTTS(text: string, voice_id?: string | null): Promise<string | null> {
  try {
    const res = await fetch(`${API}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice_id }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    // Konwertuj base64 na blob URL
    const b64 = (data.audio_base64 || data.audio) as string | undefined;
    if (!b64) return null;
    const audioBytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const blob = new Blob([audioBytes], { type: 'audio/mpeg' });
    return URL.createObjectURL(blob);
  } catch (e) {
    console.error('TTS error:', e);
    return null;
  }
}

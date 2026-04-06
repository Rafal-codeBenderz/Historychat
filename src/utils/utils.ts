import { Character, Message, Fragment } from '@types';

const raw = (import.meta.env.VITE_API_URL as string | undefined)?.trim() ?? '';
const API_OVERRIDE = raw.replace(/\/$/, '');

/** Pure helper (łatwe testy); produkcja używa `apiAuthHeaders()`. */
export function buildApiAuthHeaders(viteApiKey: string | undefined | null): Record<string, string> {
  const key = (viteApiKey ?? '').trim();
  if (!key) return {};
  return { Authorization: `Bearer ${key}` };
}

/** Nagłówki dla endpointów wymagających `API_AUTH_ENABLED` na backendzie. */
export function apiAuthHeaders(): Record<string, string> {
  return buildApiAuthHeaders(import.meta.env.VITE_API_KEY as string | undefined);
}

/**
 * Pełny URL do backendu (np. http://host:8000). Pusty string = ten sam host co strona
 * (Vite proxy: /api, /avatars → port 8000). Ustaw VITE_API_URL tylko gdy API jest na innym originie.
 */
export function backendUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return API_OVERRIDE ? `${API_OVERRIDE}${p}` : p;
}

export async function fetchCharacters(): Promise<Character[]> {
  const res = await fetch(backendUrl('/api/characters'));
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
  const res = await fetch(backendUrl('/api/chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...apiAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export async function generateTTS(text: string, voice_id?: string | null): Promise<string | null> {
  try {
    const res = await fetch(backendUrl('/api/tts'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...apiAuthHeaders() },
      body: JSON.stringify({ text, voice_id }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('[TTS]', res.status, (err as { error?: string }).error ?? res.statusText);
      return null;
    }

    const data = await res.json();
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

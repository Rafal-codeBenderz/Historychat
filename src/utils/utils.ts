import { Character, Message, Fragment, DebateTurnRequest, DebateVerdictRequest, DebateTurn } from '@types';

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

import { Character, Message, Fragment } from '@types';

export const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const VOICE_MAP: Record<string, 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'> = {
  Charon: 'echo',
  Kore: 'nova',
  Fenrir: 'fable',
  Zephyr: 'shimmer',
  Puck: 'alloy',
};

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

export async function generateTTS(text: string, voiceName?: string): Promise<string | null> {
  try {
    const voice = voiceName ? VOICE_MAP[voiceName] || 'nova' : 'nova';
    const res = await fetch(`${API}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    // Konwertuj base64 na blob URL
    const audioBytes = Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0));
    const blob = new Blob([audioBytes], { type: 'audio/mpeg' });
    return URL.createObjectURL(blob);
  } catch (e) {
    console.error('TTS error:', e);
    return null;
  }
}

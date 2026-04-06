import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Character } from '@types';
import { useChat } from './useChat';

const playAudio = vi.fn();

describe('useChat', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('selectChar sets assistant welcome for character', async () => {
    const { result } = renderHook(() =>
      useChat({ playAudio, avatarImageGenerationEnabled: false }),
    );

    const char: Character = {
      id: 'copernicus',
      name: 'Mikołaj Kopernik',
      era: 'x',
      bio: 'b',
      icon: '🌍',
      avatar_color: '#000',
      voice_id: 'nova',
      suggestedTopics: [],
    };

    await act(async () => {
      result.current.selectChar(char);
    });

    expect(result.current.selectedChar?.id).toBe('copernicus');
    expect(result.current.messages.length).toBeGreaterThanOrEqual(1);
    expect(result.current.messages[0].role).toBe('assistant');
    expect(result.current.messages[0].content).toContain('Mikołaj Kopernik');
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import { backendUrl, buildApiAuthHeaders, sendMessage } from './utils';
import type { Message } from '@types';

describe('backendUrl', () => {
  it('keeps leading slash for relative mode', () => {
    expect(backendUrl('/api/health')).toBe('/api/health');
  });
});

describe('buildApiAuthHeaders', () => {
  it('returns empty object when key missing', () => {
    expect(buildApiAuthHeaders(undefined)).toEqual({});
    expect(buildApiAuthHeaders('')).toEqual({});
    expect(buildApiAuthHeaders('   ')).toEqual({});
  });

  it('returns Bearer header when key present', () => {
    expect(buildApiAuthHeaders('my-secret')).toEqual({ Authorization: 'Bearer my-secret' });
  });
});

describe('sendMessage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends JSON body and merges auth headers when VITE_API_KEY set', async () => {
    vi.stubEnv('VITE_API_KEY', 'token-xyz');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ answer: 'ok', fragments: [] }), { status: 200 }),
    );

    const history: Message[] = [];
    const out = await sendMessage('copernicus', 'hello', history);

    expect(out.answer).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-xyz',
    });
    const body = JSON.parse(init.body as string);
    expect(body.characterId).toBe('copernicus');
    expect(body.message).toBe('hello');
  });
});

import { useEffect, useState } from 'react';
import { Character } from '@types';
import { backendUrl, fetchCharacters } from '@utils';

export function useCharactersLoader() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [backendError, setBackendError] = useState(false);
  const [avatarImageGenerationEnabled, setAvatarImageGenerationEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const delayMs = 2500;
    const maxAttempts = 150;

    const load = (attempt: number) => {
      Promise.all([
        fetchCharacters(),
        fetch(backendUrl('/api/health'))
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ])
        .then(([data, health]) => {
          if (cancelled) return;
          setCharacters(Array.isArray(data) ? data : []);
          setBackendError(false);
          if (health && typeof health.avatar_image_generation_enabled === 'boolean') {
            setAvatarImageGenerationEnabled(health.avatar_image_generation_enabled);
          } else {
            setAvatarImageGenerationEnabled(null);
          }
        })
        .catch(() => {
          if (cancelled) return;
          if (attempt + 1 >= maxAttempts) {
            setBackendError(true);
            return;
          }
          window.setTimeout(() => load(attempt + 1), delayMs);
        });
    };

    load(0);
    return () => {
      cancelled = true;
    };
  }, []);

  return { characters, backendError, avatarImageGenerationEnabled };
}


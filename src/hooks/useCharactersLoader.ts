import { useEffect, useState } from 'react';
import { Character } from '@types';
import { fetchCharacters } from '@utils';

export function useCharactersLoader() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [backendError, setBackendError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const delayMs = 2500;
    const maxAttempts = 150;

    const load = (attempt: number) => {
      fetchCharacters()
        .then((data) => {
          if (cancelled) return;
          setCharacters(Array.isArray(data) ? data : []);
          setBackendError(false);
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

  return { characters, backendError };
}


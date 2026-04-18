import { useState, useCallback } from 'react';
import type { DebateRoles, DebateRole, DebateTurn, DebateState } from '@types';
import { sendDebateTurn, sendDebateVerdict } from '../utils/utils';

// Sztywna sekwencja 7 tur sądowych:
// 0,2 = oskarżyciel, 1,3 = obrońca (wymiany), 4 = sędzia (pytania), 5-6 = odpowiedzi na pytania
const TURN_SEQUENCE: DebateRole[] = [
  'prosecutor', // 0: oskarżenie otwierające
  'defender',   // 1: obrona — ODPOWIADA na oskarżenie
  'prosecutor', // 2: replika
  'defender',   // 3: replika obrony
  'judge',      // 4: sędzia ZADAJE PYTANIA (nie werdykt)
  'prosecutor', // 5: oskarżyciel odpowiada na pytania sędziego
  'defender',   // 6: obrońca odpowiada na pytania sędziego
];

export const DEBATE_TURN_SEQUENCE = TURN_SEQUENCE;

const INITIAL_STATE: DebateState = {
  theme: '',
  roles: { prosecutor: '', defender: '', judge: '' },
  transcript: [],
  isLoading: false,
  error: null,
  verdictDone: false,
};

export function useDebate() {
  const [state, setState] = useState<DebateState>(INITIAL_STATE);

  const setTheme = useCallback((theme: string) => {
    setState((s) => ({ ...s, theme }));
  }, []);

  const setRoles = useCallback((roles: DebateRoles) => {
    setState((s) => ({ ...s, roles }));
  }, []);

  /** Wyslij kolejna ture — automatycznie ustala next_role na podstawie transkryptu */
  const nextTurn = useCallback(async () => {
    setState((s) => {
      if (s.isLoading || s.verdictDone) return s;
      return { ...s, isLoading: true, error: null };
    });

    setState((prev) => {
      const turnIndex = prev.transcript.length;
      if (turnIndex >= TURN_SEQUENCE.length) {
        return { ...prev, isLoading: false, error: 'Sekwencja debaty zakończona — wydaj werdykt' };
      }
      const next_role: DebateRole = TURN_SEQUENCE[turnIndex];

      sendDebateTurn({
        theme: prev.theme,
        roles: prev.roles,
        next_role,
        transcript: prev.transcript,
      })
        .then((turn: DebateTurn) => {
          setState((s) => ({
            ...s,
            transcript: [...s.transcript, turn],
            isLoading: false,
          }));
        })
        .catch((err: unknown) => {
          setState((s) => ({
            ...s,
            isLoading: false,
            error: err instanceof Error ? err.message : 'Blad serwera',
          }));
        });

      return prev;
    });
  }, []);

  /** Wyslij werdykt (sedzia, verdict_mode=True) */
  const requestVerdict = useCallback(async () => {
    setState((s) => {
      if (s.isLoading || s.verdictDone) return s;
      return { ...s, isLoading: true, error: null };
    });

    setState((prev) => {
      sendDebateVerdict({
        theme: prev.theme,
        roles: prev.roles,
        transcript: prev.transcript,
      })
        .then((turn: DebateTurn) => {
          setState((s) => ({
            ...s,
            transcript: [...s.transcript, turn],
            isLoading: false,
            verdictDone: true,
          }));
        })
        .catch((err: unknown) => {
          setState((s) => ({
            ...s,
            isLoading: false,
            error: err instanceof Error ? err.message : 'Blad serwera',
          }));
        });

      return prev;
    });
  }, []);

  /** Reset do poczatkowego stanu */
  const resetDebate = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const isReady =
    state.theme.trim().length > 0 &&
    state.roles.prosecutor !== '' &&
    state.roles.defender !== '' &&
    state.roles.judge !== '' &&
    new Set([state.roles.prosecutor, state.roles.defender, state.roles.judge]).size === 3;

  return {
    ...state,
    isReady,
    setTheme,
    setRoles,
    nextTurn,
    requestVerdict,
    resetDebate,
  };
}

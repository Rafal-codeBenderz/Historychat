import { useState, useCallback } from 'react';
import type { DebateRoles, DebateRole, DebateTurn, DebateState } from '@types';
import { sendDebateTurn, sendDebateVerdict } from '../utils/utils';

const ROLE_ORDER: DebateRole[] = ['prosecutor', 'defender', 'judge'];

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
      const next_role: DebateRole = ROLE_ORDER[turnIndex % ROLE_ORDER.length];

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

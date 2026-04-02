import { useCallback, useEffect, useRef, useState } from 'react';

function makeAudioContext(): AudioContext {
  return new (window.AudioContext || (window as any).webkitAudioContext)();
}

export function useAudioPlayer() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const currentUrlRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);

  const cleanupRaf = () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const stopAudio = useCallback(() => {
    const a = audioElRef.current;
    if (!a) return;

    cleanupRaf();
    a.pause();
    try {
      a.currentTime = 0;
    } catch {
      // ignore
    }
    setIsSpeaking(false);
    setVolume(0);
  }, []);

  const ensureGraph = useCallback(() => {
    if (!audioElRef.current) {
      audioElRef.current = new Audio();
      audioElRef.current.preload = 'auto';
    }

    if (!audioCtxRef.current) {
      audioCtxRef.current = makeAudioContext();
      analyserRef.current = audioCtxRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
    }

    const ctx = audioCtxRef.current!;
    const analyser = analyserRef.current!;

    // Guard: Chrome throws InvalidStateError if media element already has a source node
    if (!sourceRef.current) {
      sourceRef.current = ctx.createMediaElementSource(audioElRef.current);
      sourceRef.current.connect(analyser);
      analyser.connect(ctx.destination);
    }
  }, []);

  const playAudio = useCallback(
    async (audioUrl: string) => {
      try {
        ensureGraph();
        const ctx = audioCtxRef.current!;
        const analyser = analyserRef.current!;
        const audio = audioElRef.current!;

        if (ctx.state === 'suspended') {
          await ctx.resume();
        }

        // Cleanup sequence:
        // 1) stop current playback
        stopAudio();

        // 2) revoke old blob URL (only if switching to a different one)
        // Note: message.audioUrl is reused by "Odtwórz ponownie", so revoking it would break replay.
        if (currentUrlRef.current && currentUrlRef.current !== audioUrl) {
          URL.revokeObjectURL(currentUrlRef.current);
          currentUrlRef.current = null;
        }

        // 3) set new src
        audio.src = audioUrl;
        currentUrlRef.current = audioUrl;

        const updateVolume = () => {
          if (!analyserRef.current || !audioElRef.current) return;
          if (audioElRef.current.paused) return;
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          setVolume(average / 128);
          rafRef.current = requestAnimationFrame(updateVolume);
        };

        audio.onplay = () => {
          setIsSpeaking(true);
          updateVolume();
        };

        audio.onended = () => {
          cleanupRaf();
          setIsSpeaking(false);
          setVolume(0);
          // Keep src/url to allow replay of the same message.
        };

        audio.onerror = () => {
          cleanupRaf();
          setIsSpeaking(false);
          setVolume(0);
        };

        await audio.play();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Audio error:', err);
        setIsSpeaking(false);
        setVolume(0);
      }
    },
    [ensureGraph, stopAudio],
  );

  useEffect(() => {
    return () => {
      cleanupRaf();

      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect();
        } catch {
          // ignore
        }
        sourceRef.current = null;
      }

      if (currentUrlRef.current) {
        URL.revokeObjectURL(currentUrlRef.current);
        currentUrlRef.current = null;
      }

      if (audioElRef.current) {
        audioElRef.current.pause();
        audioElRef.current.src = '';
        audioElRef.current = null;
      }

      if (audioCtxRef.current) {
        void audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    };
  }, []);

  return { playAudio, stopAudio, isSpeaking, volume };
}


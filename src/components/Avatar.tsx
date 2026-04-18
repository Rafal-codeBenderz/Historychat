import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Character } from '../types';
import { Loader2 } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { RealTimeVoiceVisualizer } from './RealTimeVoiceVisualizer';

interface AvatarProps {
  character: Character;
  isSpeaking: boolean;
  volume: number;
}

export const Avatar: React.FC<AvatarProps> = ({ character, isSpeaking, volume }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('Inicjalizacja...');
  const skippedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | null = null;

    skippedRef.current = false;
    setImageUrl(null);
    setLoading(true);
    setStatus('Tworzenie wizerunku...');

    const baseUrl = `/avatars/${character.id}.jpg`;
    const maxAttempts = 10;
    const retryDelayMs = 2000;

    const tryLoad = (attempt: number) => {
      if (cancelled) return;
      if (skippedRef.current) {
        setLoading(false);
        setStatus('Tryb emoji');
        return;
      }

      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        // Cache-bust, żeby nie utkwić na zcache'owanym 404
        setImageUrl(`${baseUrl}?v=${Date.now()}`);
        setLoading(false);
        setStatus('');
      };
      img.onerror = () => {
        if (cancelled) return;
        if (attempt + 1 >= maxAttempts) {
          setImageUrl(null);
          setLoading(false);
          setStatus('');
          return;
        }
        setStatus('Oczekiwanie na wizerunek...');
        timeoutId = window.setTimeout(() => tryLoad(attempt + 1), retryDelayMs);
      };

      img.src = `${baseUrl}?try=${attempt}&ts=${Date.now()}`;
    };

    tryLoad(0);

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [character]);

  const accentColor = character.accentColor || character.avatar_color || '#6b9ec4';

  return (
    <div className="relative w-72 h-72 mx-auto">
      {/* Speaking Glow - Driven by Volume */}
      <AnimatePresence>
        {isSpeaking && (
          <motion.div
            animate={{
              scale: [1, 1.2 + volume * 0.5, 1],
              opacity: [0.2, 0.4 + volume * 0.3, 0.2],
            }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute inset-0 rounded-full blur-3xl"
            style={{ backgroundColor: accentColor }}
          />
        )}
      </AnimatePresence>

      <div
        className="relative w-full h-full rounded-full overflow-hidden border-4 shadow-2xl transition-all duration-500"
        style={{
          borderColor: accentColor,
          transform: `scale(${1 + volume * 0.05})`,
        }}
      >
        {loading ? (
          <div className="w-full h-full bg-zinc-900 flex flex-col items-center justify-center p-8 text-center">
            <Loader2 className="w-12 h-12 text-white animate-spin mb-4 opacity-50" />
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold leading-relaxed mb-4">
              {status}
            </p>
            <button
              onClick={() => {
                skippedRef.current = true;
                setLoading(false);
                setStatus('Tryb emoji');
              }}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] uppercase tracking-widest text-zinc-400 transition-all mb-4"
            >
              Pomiń generowanie
            </button>
          </div>
        ) : imageUrl ? (
          <motion.div
            animate={
              isSpeaking
                ? {
                    y: [0, -2, 0, 2, 0],
                    rotate: [0, -0.5, 0, 0.5, 0],
                  }
                : {}
            }
            transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
            className="w-full h-full relative"
          >
            <img
              src={imageUrl}
              alt={character.name}
              className="w-full h-full object-cover"
              style={{
                filter: isSpeaking ? `brightness(${1 + volume * 0.3}) contrast(1.1)` : 'brightness(1)',
              }}
            />

            {/* Simulated Lip-Sync / Mouth Pulse */}
            {isSpeaking && (
              <motion.div
                animate={{
                  scaleY: [1, 1 + volume * 2, 1],
                  opacity: [0.3, 0.6, 0.3],
                }}
                transition={{ duration: 0.1, repeat: Infinity }}
                className="absolute top-[60%] left-1/2 -translate-x-1/2 w-12 h-6 blur-xl rounded-full"
                style={{ backgroundColor: accentColor }}
              />
            )}
          </motion.div>
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-8xl"
            style={{ backgroundColor: `${accentColor}20` }}
          >
            {character.icon}
          </div>
        )}

        {/* HUD Elements */}
        <div className="absolute top-4 left-4 flex flex-col gap-1 pointer-events-none">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
            <span className="text-[8px] font-mono text-white/70 uppercase tracking-tighter">LIVE</span>
          </div>
        </div>

        {/* Real-time Voice Visualizer Overlay */}
        {isSpeaking && <RealTimeVoiceVisualizer volume={volume} accentColor={accentColor} />}
      </div>

      <StatusBadge loading={loading} isSpeaking={isSpeaking} />
    </div>
  );
};

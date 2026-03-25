import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Character } from '../types';
import { Loader2, Volume2 } from 'lucide-react';

interface AvatarProps {
  character: Character;
  isSpeaking: boolean;
  volume: number;
  onPermissionError?: () => void;
}

export const Avatar: React.FC<AvatarProps> = ({ character, isSpeaking, volume, onPermissionError }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('Inicjalizacja...');

  useEffect(() => {
    // Avatar używa emoji jako głównego wyświetlania
    // W przyszłości można dodać endpoint backendu do generowania obrazów DALL-E
    setLoading(false);
    setStatus('');
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
              opacity: [0.2, 0.4 + volume * 0.3, 0.2]
            }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute inset-0 rounded-full blur-3xl"
            style={{ backgroundColor: accentColor }}
          />
        )}
      </AnimatePresence>

      <div 
        className="relative w-full h-full rounded-full overflow-hidden border-4 shadow-2xl transition-all duration-500"
        style={{ 
          borderColor: accentColor,
          transform: `scale(${1 + volume * 0.05})`
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
            animate={isSpeaking ? {
              y: [0, -2, 0, 2, 0],
              rotate: [0, -0.5, 0, 0.5, 0],
            } : {}}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            className="w-full h-full relative"
          >
            <img 
              src={imageUrl} 
              alt={character.name} 
              className="w-full h-full object-cover"
              style={{ 
                filter: isSpeaking ? `brightness(${1 + volume * 0.3}) contrast(1.1)` : 'brightness(1)'
              }}
            />
            
            {/* Simulated Lip-Sync / Mouth Pulse */}
            {isSpeaking && (
              <motion.div 
                animate={{ 
                  scaleY: [1, 1 + volume * 2, 1],
                  opacity: [0.3, 0.6, 0.3]
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
        {isSpeaking && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-end gap-1.5 h-16">
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={i}
                animate={{ 
                  height: [8, (Math.random() * 40 + 10) * (volume + 0.5), 8],
                  opacity: [0.4, 1, 0.4]
                }}
                transition={{ 
                  repeat: Infinity, 
                  duration: 0.2 + Math.random() * 0.2, 
                  ease: "easeInOut" 
                }}
                className="w-1.5 rounded-full shadow-lg"
                style={{ backgroundColor: accentColor }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Status Badge */}
      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full bg-black/80 backdrop-blur-xl border border-white/10 text-[10px] uppercase tracking-[0.3em] font-black text-white whitespace-nowrap shadow-2xl">
        {loading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" /> Generowanie...
          </span>
        ) : isSpeaking ? (
          <span className="text-emerald-500 flex items-center gap-2">
            <Volume2 className="w-3 h-3" /> Mówi
          </span>
        ) : (
          'Gotowy'
        )}
      </div>
    </div>
  );
};

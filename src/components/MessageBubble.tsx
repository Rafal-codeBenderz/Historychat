import { Message, Character } from '@types';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CharacterAvatar, SourceBadge } from '@components';

export function MessageBubble({
  message,
  char,
  onPlayAudio,
  onStopAudio,
}: {
  message: Message;
  char: Character;
  onPlayAudio?: (audioUrl: string) => void;
  onStopAudio?: () => void;
}) {
  const isUser = message.role === 'user';
  const [showSources, setShowSources] = useState(false);
  const hasSources = message.fragments && message.fragments.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        gap: '12px',
        alignItems: 'flex-start',
      }}
    >
      {!isUser && <CharacterAvatar char={char} size={42} />}

      <div style={{ maxWidth: '74%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {!isUser && (
          <div
            style={{
              fontSize: '11px',
              color: 'rgba(255,255,255,0.35)',
              fontFamily: "'EB Garamond', serif",
              fontStyle: 'italic',
              marginLeft: '4px',
            }}
          >
            {char.name} · {char.era}
          </div>
        )}

        <div
          style={{
            background: isUser ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.04)',
            border: isUser ? '1px solid rgba(255,255,255,0.15)' : `1px solid ${char.avatar_color}44`,
            borderRadius: isUser ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
            padding: '14px 18px',
            color: 'rgba(255,255,255,0.88)',
            fontSize: '15px',
            lineHeight: '1.7',
            fontFamily: isUser ? "'Outfit', sans-serif" : "'EB Garamond', serif",
            boxShadow: isUser ? 'none' : `0 2px 20px ${char.avatar_color}15`,
          }}
        >
          {message.content}
        </div>

        {!isUser && hasSources && (
          <div style={{ marginLeft: '4px' }}>
            <button
              onClick={() => setShowSources(!showSources)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'rgba(255,255,255,0.3)',
                fontSize: '11px',
                fontFamily: "'Outfit', sans-serif",
                padding: '2px 0',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span
                style={{
                  transform: showSources ? 'rotate(180deg)' : 'none',
                  display: 'inline-block',
                  transition: '0.2s',
                }}
              >
                ▾
              </span>
              {showSources ? 'Ukryj źródła' : `Pokaż źródła (${message.fragments!.length})`}
            </button>

            <AnimatePresence>
              {showSources && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '6px',
                      marginTop: '8px',
                      padding: '10px',
                      background: 'rgba(0,0,0,0.2)',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    {message.fragments!.map((frag, i) => (
                      <SourceBadge key={i} source={frag.source} score={frag.score} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {!isUser && !hasSources && (
          <div
            style={{
              marginLeft: '4px',
              fontSize: '11px',
              color: 'rgba(255,200,100,0.4)',
              fontStyle: 'italic',
              fontFamily: "'EB Garamond', serif",
            }}
          >
            ⚠ Odpowiedź bez odniesień źródłowych
          </div>
        )}

        {!isUser && message.audioUrl && onPlayAudio && (
          <div style={{ marginLeft: '4px', marginTop: '6px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => onPlayAudio(message.audioUrl!)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '11px',
                color: 'rgba(255,255,255,0.6)',
                fontFamily: "'Outfit', sans-serif",
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              🔊 Odtwórz ponownie
            </button>

            <button
              type="button"
              onClick={() => onStopAudio?.()}
              disabled={!onStopAudio}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '11px',
                color: 'rgba(255,255,255,0.6)',
                fontFamily: "'Outfit', sans-serif",
                cursor: onStopAudio ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                opacity: onStopAudio ? 1 : 0.55,
              }}
            >
              ⏹ Zatrzymaj rozmowę
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

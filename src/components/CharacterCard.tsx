import { Character } from '@types';
import { motion } from 'framer-motion';
import { CharacterAvatar } from '@components';

export function CharacterCard({
  char,
  selected,
  onClick,
}: {
  char: Character;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      style={{
        width: '100%',
        background: selected
          ? `linear-gradient(135deg, ${char.avatar_color}33, ${char.avatar_color}11)`
          : 'rgba(255,255,255,0.03)',
        border: selected ? `1px solid ${char.avatar_color}66` : '1px solid rgba(255,255,255,0.08)',
        borderRadius: '12px',
        padding: '14px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        textAlign: 'left',
        transition: 'background 0.2s, border 0.2s',
        boxShadow: selected ? `0 0 24px ${char.avatar_color}22` : 'none',
      }}
    >
      <CharacterAvatar char={char} size={44} />
      <div>
        <div
          style={{
            color: selected ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.75)',
            fontSize: '14px',
            fontWeight: 600,
            fontFamily: "'Outfit', sans-serif",
            marginBottom: '2px',
          }}
        >
          {char.name}
        </div>
        <div
          style={{
            color: 'rgba(255,255,255,0.35)',
            fontSize: '11px',
            fontFamily: "'EB Garamond', serif",
            fontStyle: 'italic',
          }}
        >
          {char.era}
        </div>
      </div>
    </motion.button>
  );
}

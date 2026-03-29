import { Character } from '@types';
import { motion } from 'framer-motion';
import { CharacterAvatar } from '@components';

export function TypingIndicator({ char }: { char: Character }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}
    >
      <CharacterAvatar char={char} size={42} />
      <div
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${char.avatar_color}44`,
          borderRadius: '4px 16px 16px 16px',
          padding: '14px 20px',
          display: 'flex',
          gap: '5px',
          alignItems: 'center',
        }}
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: `${char.avatar_color}cc`,
            }}
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
    </motion.div>
  );
}

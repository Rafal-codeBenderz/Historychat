import { motion } from 'framer-motion';

type Mode = 'chat' | 'debate';

interface ModeSwitchProps {
  mode: Mode;
  onChange: (mode: Mode) => void;
}

const MODES: { value: Mode; label: string; icon: string }[] = [
  { value: 'chat', label: 'Rozmowa', icon: '💬' },
  { value: 'debate', label: 'Sąd historyczny', icon: '⚖️' },
];

export function ModeSwitch({ mode, onChange }: ModeSwitchProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '6px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '10px',
        padding: '4px',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {MODES.map((m) => {
        const isActive = mode === m.value;
        return (
          <motion.button
            key={m.value}
            onClick={() => onChange(m.value)}
            whileTap={{ scale: 0.96 }}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '8px 10px',
              borderRadius: '7px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontFamily: "'Outfit', sans-serif",
              fontWeight: isActive ? 600 : 400,
              background: isActive
                ? 'rgba(255,255,255,0.1)'
                : 'transparent',
              color: isActive
                ? 'rgba(255,255,255,0.92)'
                : 'rgba(255,255,255,0.38)',
              transition: 'background 0.2s, color 0.2s',
              boxShadow: isActive
                ? '0 1px 6px rgba(0,0,0,0.25)'
                : 'none',
            }}
          >
            <span style={{ fontSize: '14px' }}>{m.icon}</span>
            {m.label}
          </motion.button>
        );
      })}
    </div>
  );
}

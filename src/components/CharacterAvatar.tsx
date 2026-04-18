import { Character } from '@types';

export function CharacterAvatar({ char, size = 80 }: { char: Character; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.2,
        background: `linear-gradient(135deg, ${char.avatar_color}cc, ${char.avatar_color}55)`,
        border: `2px solid ${char.avatar_color}88`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.45,
        flexShrink: 0,
        boxShadow: `0 0 20px ${char.avatar_color}33, inset 0 1px 0 rgba(255,255,255,0.1)`,
      }}
    >
      {char.icon}
    </div>
  );
}

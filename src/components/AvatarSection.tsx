import { Character } from '@types';
import { Avatar } from './Avatar';

type AvatarSectionProps = {
  selectedChar: Character;
  isSpeaking: boolean;
  volume: number;
};

/* Avatar Section - Hidden on mobile, visible on larger screens */

export function AvatarSection({ selectedChar, isSpeaking, volume }: AvatarSectionProps) {
  return (
    <div className="hidden lg:flex w-1/3 flex-col items-center justify-center border-r border-white/5 bg-[#050505] p-8">
      {selectedChar && <Avatar character={selectedChar} isSpeaking={isSpeaking} volume={volume} />}
      <div className="mt-12 text-center max-w-xs">
        <h3 className="text-xl font-serif italic mb-2 text-white/80">"{selectedChar.bio}"</h3>
        <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-6">System RAG Aktywny</p>
      </div>
    </div>
  );
}

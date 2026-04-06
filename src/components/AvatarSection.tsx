import { Character } from '@types';
import { Avatar } from './Avatar';

type AvatarSectionProps = {
  selectedChar: Character;
  isSpeaking: boolean;
  volume: number;
  avatarImageGenerationEnabled?: boolean | null;
  avatarRefreshKey?: number;
};

/* Avatar Section - Hidden on mobile, visible on larger screens */

export function AvatarSection({
  selectedChar,
  isSpeaking,
  volume,
  avatarImageGenerationEnabled,
  avatarRefreshKey,
}: AvatarSectionProps) {
  return (
    <div className="flex w-full flex-shrink-0 flex-col items-center justify-center border-b border-white/5 bg-[#050505] px-4 py-6 lg:w-1/3 lg:border-b-0 lg:border-r lg:px-8 lg:py-8">
      {selectedChar && (
        <Avatar
          character={selectedChar}
          isSpeaking={isSpeaking}
          volume={volume}
          avatarImageGenerationEnabled={avatarImageGenerationEnabled}
          avatarRefreshKey={avatarRefreshKey}
        />
      )}
      <div className="mt-6 max-w-xs text-center lg:mt-12">
        <h3 className="mb-2 font-serif text-base italic text-white/80 lg:text-xl">"{selectedChar.bio}"</h3>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500 lg:mb-6 lg:text-xs">
          System RAG Aktywny
        </p>
      </div>
    </div>
  );
}

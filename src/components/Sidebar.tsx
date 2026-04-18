import { Info } from './Info';
import { Logo } from './Logo';
import { CharacterList } from './CharacterList';
import { ModeSwitch } from './ModeSwitch';
import { Character } from '@types';

type AppMode = 'chat' | 'debate';

type SidebarProps = {
  backendError: boolean;
  characters: Character[];
  selectedChar: Character | null;
  selectChar: (char: Character) => void;
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
};

export function Sidebar({ backendError, characters, selectedChar, selectChar, mode, onModeChange }: SidebarProps) {
  return (
    <aside
      style={{
        width: '280px',
        flexShrink: 0,
        height: '100vh',
        minHeight: 0,
        borderRight: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 16px',
        gap: '24px',
        background: 'rgba(0,0,0,0.15)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <Logo />

      <ModeSwitch mode={mode} onChange={onModeChange} />

      <CharacterList
        backendError={backendError}
        characters={characters}
        selectedChar={selectedChar}
        selectChar={selectChar}
      />

      <Info />
    </aside>
  );
}

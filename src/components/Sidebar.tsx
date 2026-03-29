import { Info } from './Info';
import { Logo } from './Logo';
import { CharacterList } from './CharacterList';
import { Character } from '@types';

type SidebarProps = {
  backendError: boolean;
  characters: Character[];
  selectedChar: Character | null;
  selectChar: (char: Character) => void;
};

export function Sidebar({ backendError, characters, selectedChar, selectChar }: SidebarProps) {
  return (
    <aside
      style={{
        width: '280px',
        flexShrink: 0,
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

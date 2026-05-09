import { Info } from './Info';
import { Logo } from './Logo';
import { CharacterList } from './CharacterList';
import { ModeSwitch } from './ModeSwitch';
import { Character } from '@types';

type AppMode = 'chat' | 'debate';
type AppSurface = 'classic' | 'timeTravel';

type SidebarProps = {
  backendError: boolean;
  characters: Character[];
  selectedChar: Character | null;
  selectChar: (char: Character) => void;
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  surface: AppSurface;
  onSurfaceChange: (surface: AppSurface) => void;
};

export function Sidebar({
  backendError,
  characters,
  selectedChar,
  selectChar,
  mode,
  onModeChange,
  surface,
  onSurfaceChange,
}: SidebarProps) {
  const isTimeTravel = surface === 'timeTravel';

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

      {/* Toggle: Tryb klasyczny <-> Podroz w czasie */}
      <button
        type="button"
        onClick={() => onSurfaceChange(isTimeTravel ? 'classic' : 'timeTravel')}
        style={{
          padding: '10px 14px',
          borderRadius: '12px',
          border: '1px solid rgba(200,170,120,0.35)',
          background: isTimeTravel
            ? 'linear-gradient(135deg, rgba(200,160,80,0.25), rgba(200,140,60,0.15))'
            : 'rgba(255,255,255,0.05)',
          color: 'rgba(255,235,210,0.95)',
          fontSize: '13px',
          fontWeight: 600,
          fontFamily: "'Outfit', sans-serif",
          cursor: 'pointer',
          textAlign: 'left',
        }}
        aria-pressed={isTimeTravel}
        aria-label={isTimeTravel ? 'Wroc do trybu klasycznego' : 'Wlacz tryb Podroz w czasie'}
      >
        {isTimeTravel ? '← Wroc do trybu klasycznego' : '🕰  Podroz w czasie'}
      </button>

      {/* ModeSwitch (Rozmowa / Sad historyczny) widoczny tylko w trybie klasycznym. */}
      {!isTimeTravel && <ModeSwitch mode={mode} onChange={onModeChange} />}

      {/* Lista postaci ukryta w TT (jak w prototypie). */}
      {!isTimeTravel && (
        <CharacterList
          backendError={backendError}
          characters={characters}
          selectedChar={selectedChar}
          selectChar={selectChar}
        />
      )}

      <Info />
    </aside>
  );
}

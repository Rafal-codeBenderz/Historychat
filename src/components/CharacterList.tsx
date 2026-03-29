import { Character } from '@types';
import { CharacterCard } from '@components';

type CharacterListProps = {
  backendError: boolean;
  characters: Character[];
  selectedChar: Character | null;
  selectChar: (char: Character) => void;
};

export function CharacterList({
  backendError,
  characters,
  selectedChar,
  selectChar,
}: CharacterListProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div
        style={{
          fontSize: '10px',
          fontWeight: 600,
          color: 'rgba(255,255,255,0.25)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          marginBottom: '4px',
          paddingLeft: '4px',
        }}
      >
        Wybierz postać
      </div>

      {backendError && (
        <div
          style={{
            background: 'rgba(255,100,100,0.1)',
            border: '1px solid rgba(255,100,100,0.2)',
            borderRadius: '8px',
            padding: '10px 12px',
            fontSize: '12px',
            color: 'rgba(255,150,150,0.8)',
            fontFamily: "'EB Garamond', serif",
            fontStyle: 'italic',
          }}
        >
          ⚠ Brak połączenia z serwerem. Uruchom{' '}
          <code style={{ fontStyle: 'normal', fontSize: '11px' }}>npm run start</code> lub{' '}
          <code style={{ fontStyle: 'normal', fontSize: '11px' }}>python backend/server.py</code>. Przy pierwszym
          uruchomieniu backend ładuje model — może to potrwać kilka minut; wcześniej zobaczysz „Ładowanie postaci…”.
        </div>
      )}

      {characters.length === 0 && !backendError && (
        <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '13px', padding: '8px 4px' }}>Ładowanie postaci...</div>
      )}

      {characters.map((char) => (
        <CharacterCard
          key={char.id}
          char={char}
          selected={selectedChar?.id === char.id}
          onClick={() => selectChar(char)}
        />
      ))}
    </div>
  );
}

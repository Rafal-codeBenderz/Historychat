import { AnimatePresence, motion } from 'framer-motion';
import { Character, DebateTurn, DebateRoles, DebateRole } from '@types';
import { useDebate } from '../hooks/useDebate';
import { SourceBadge } from './SourceBadge';

// Kolory rol wg spec (PLAN_DEBATA_v1.md)
const ROLE_COLORS: Record<DebateRole, string> = {
  prosecutor: '#e57373',
  defender: '#64b5f6',
  judge: '#ffd54f',
};

const ROLE_LABELS: Record<DebateRole, string> = {
  prosecutor: 'Oskarżyciel',
  defender: 'Obrońca',
  judge: 'Sędzia',
};

const OPTION_STYLE = { background: '#1a1a1a', color: 'rgba(255,255,255,0.9)' } as const;

interface DebateSectionProps {
  characters: Character[];
}

function RoleSelect({
  role, value, onChange, characters, usedIds,
}: {
  role: DebateRole;
  value: string;
  onChange: (id: string) => void;
  characters: Character[];
  usedIds: string[];
}) {
  const color = ROLE_COLORS[role];
  return (
    <div style={{ flex: 1 }}>
      <label style={{ display: 'block', fontSize: '11px', color, marginBottom: '4px', fontFamily: "'Outfit', sans-serif" }}>
        {ROLE_LABELS[role]}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%', padding: '8px', borderRadius: '7px',
          background: 'rgba(255,255,255,0.05)', border: `1px solid ${color}44`,
          color: 'rgba(255,255,255,0.85)', fontSize: '13px',
          fontFamily: "'Outfit', sans-serif", cursor: 'pointer',
        }}
      >
        <option value="" style={OPTION_STYLE}>-- wybierz --</option>
        {characters.map((c) => (
          <option key={c.id} value={c.id} disabled={usedIds.includes(c.id) && c.id !== value} style={OPTION_STYLE}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function TurnCard({ turn }: { turn: DebateTurn }) {
  const color = ROLE_COLORS[turn.role] ?? '#aaa';
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{
        borderLeft: `3px solid ${color}`, paddingLeft: '14px',
        marginBottom: '18px',
      }}
    >
      <div style={{ fontSize: '11px', color, fontFamily: "'Outfit', sans-serif", marginBottom: '4px' }}>
        {turn.speakerName} · {ROLE_LABELS[turn.role]}
      </div>
      <div style={{
        fontSize: '15px', lineHeight: '1.7', color: 'rgba(255,255,255,0.87)',
        fontFamily: "'EB Garamond', serif",
      }}>
        {turn.content}
      </div>
      {turn.fragments?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '8px' }}>
          {turn.fragments.map((f, i) => <SourceBadge key={i} source={f.source} score={f.score} />)}
        </div>
      )}
    </motion.div>
  );
}

export function DebateSection({ characters }: DebateSectionProps) {
  const {
    theme, roles, transcript, isLoading, error, verdictDone, isReady,
    setTheme, setRoles, nextTurn, requestVerdict, resetDebate,
  } = useDebate();

  const usedIds = Object.values(roles).filter(Boolean);

  const updateRole = (role: keyof DebateRoles, id: string) =>
    setRoles({ ...roles, [role]: id });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '14px', padding: '0 2px' }}>
      {/* Setup */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <textarea
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          placeholder="Teza debaty, np. Nauka niszczy wartości moralne..."
          rows={2}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: '8px', resize: 'vertical',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.85)', fontSize: '14px',
            fontFamily: "'EB Garamond', serif", boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['prosecutor', 'defender', 'judge'] as DebateRole[]).map((r) => (
            <RoleSelect key={r} role={r} value={roles[r]} onChange={(id) => updateRole(r, id)}
              characters={characters} usedIds={usedIds.filter((id) => id !== roles[r])} />
          ))}
        </div>
      </div>

      {/* Transcript */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
        <AnimatePresence>
          {transcript.map((turn, i) => <TurnCard key={i} turn={turn} />)}
        </AnimatePresence>
        {isLoading && (
          <div style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', fontSize: '13px' }}>
            Trwa generowanie odpowiedzi…
          </div>
        )}
        {error && (
          <div style={{ color: '#e57373', fontSize: '13px', padding: '8px', borderRadius: '6px', background: 'rgba(229,115,115,0.1)' }}>
            Błąd: {error}
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={nextTurn} disabled={!isReady || isLoading || verdictDone}
          style={{
            flex: 2, padding: '10px', borderRadius: '8px', border: 'none', cursor: isReady && !isLoading && !verdictDone ? 'pointer' : 'not-allowed',
            background: isReady && !verdictDone ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
            color: isReady && !verdictDone ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.25)',
            fontFamily: "'Outfit', sans-serif", fontSize: '13px', fontWeight: 500,
          }}>
          Następna tura
        </button>
        <button onClick={requestVerdict} disabled={!isReady || isLoading || verdictDone || transcript.length < 3}
          style={{
            flex: 2, padding: '10px', borderRadius: '8px', border: `1px solid ${ROLE_COLORS.judge}44`, cursor: 'pointer',
            background: verdictDone ? 'rgba(255,213,79,0.08)' : 'rgba(255,213,79,0.06)',
            color: ROLE_COLORS.judge, fontFamily: "'Outfit', sans-serif", fontSize: '13px', fontWeight: 500,
          }}>
          {verdictDone ? 'Werdykt wydany' : 'Wydaj werdykt'}
        </button>
        <button onClick={resetDebate}
          style={{
            flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)',
            background: 'transparent', color: 'rgba(255,255,255,0.3)', cursor: 'pointer',
            fontFamily: "'Outfit', sans-serif", fontSize: '13px',
          }}>
          Reset
        </button>
      </div>
    </div>
  );
}

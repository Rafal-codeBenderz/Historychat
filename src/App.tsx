import { useCallback, useEffect, useState } from 'react';
import { Sidebar, AvatarSection, ChatSection, WelcomeSection, DebateSection, TimeTravelSection } from '@components';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { useCharactersLoader } from './hooks/useCharactersLoader';
import { useChat } from './hooks/useChat';

type AppMode = 'chat' | 'debate';
type AppSurface = 'classic' | 'timeTravel';

/** Synchronizacja `?mode=tt` <-> surface === 'timeTravel'. */
function readSurfaceFromUrl(): AppSurface {
  if (typeof window === 'undefined') return 'classic';
  try {
    const url = new URL(window.location.href);
    return url.searchParams.get('mode') === 'tt' ? 'timeTravel' : 'classic';
  } catch {
    return 'classic';
  }
}

function writeSurfaceToUrl(surface: AppSurface): void {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    if (surface === 'timeTravel') {
      url.searchParams.set('mode', 'tt');
    } else {
      url.searchParams.delete('mode');
    }
    const next = url.pathname + (url.search ? url.search : '') + url.hash;
    window.history.replaceState(null, '', next);
  } catch {
    /* ignore */
  }
}

export default function App() {
  const [surface, setSurface] = useState<AppSurface>(() => readSurfaceFromUrl());
  const [mode, setMode] = useState<AppMode>('chat');
  const { playAudio, stopAudio, isSpeaking, volume } = useAudioPlayer();
  const { characters, backendError } = useCharactersLoader();
  const {
    selectedChar,
    messages,
    input,
    loading,
    messagesEndRef,
    inputRef,
    suggestedQuestions,
    setInput,
    selectChar,
    sendMsg,
    sendSuggestedTopic,
    handleKeyDown,
  } = useChat({ playAudio });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    writeSurfaceToUrl(surface);
  }, [surface]);

  // Reaguj na nawigacje przegladarki (back/forward) zmieniajaca ?mode=tt.
  useEffect(() => {
    const onPop = () => setSurface(readSurfaceFromUrl());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const handleSurfaceChange = useCallback((next: AppSurface) => {
    setSurface(next);
  }, []);

  const goClassic = useCallback(() => setSurface('classic'), []);

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: `
            radial-gradient(ellipse 60% 50% at 20% 20%, rgba(30,45,80,0.4) 0%, transparent 70%),
            radial-gradient(ellipse 40% 60% at 80% 80%, rgba(20,40,30,0.3) 0%, transparent 70%),
            #0a0b0e
          `,
          zIndex: 0,
        }}
      />

      {/* Grain texture */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.035'/%3E%3C/svg%3E")`,
          zIndex: 0,
          pointerEvents: 'none',
          opacity: 0.6,
        }}
      />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', height: '100vh' }}>
        <Sidebar
          backendError={backendError}
          characters={characters}
          selectedChar={selectedChar}
          selectChar={selectChar}
          mode={mode}
          onModeChange={setMode}
          surface={surface}
          onSurfaceChange={handleSurfaceChange}
        />

        {/* ── Main Area ── */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {surface === 'timeTravel' ? (
            <TimeTravelSection
              characters={characters}
              onBackToClassic={goClassic}
              playAudio={playAudio}
              stopAudio={stopAudio}
            />
          ) : mode === 'debate' ? (
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
              <DebateSection characters={characters} />
            </div>
          ) : !selectedChar ? (
            <WelcomeSection />
          ) : (
            <>
              <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                <AvatarSection selectedChar={selectedChar} isSpeaking={isSpeaking} volume={volume} />
                <ChatSection
                  selectedChar={selectedChar}
                  messages={messages}
                  suggestedQuestions={suggestedQuestions}
                  sendSuggestedTopic={sendSuggestedTopic}
                  sendMsg={sendMsg}
                  handleKeyDown={handleKeyDown}
                  loading={loading}
                  messagesEndRef={messagesEndRef}
                  inputRef={inputRef}
                  input={input}
                  setInput={setInput}
                  playAudio={playAudio}
                  stopAudio={stopAudio}
                />
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}

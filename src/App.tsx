import { useEffect } from 'react';
import { Sidebar, AvatarSection, ChatSection, WelcomeSection } from '@components';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { useCharactersLoader } from './hooks/useCharactersLoader';
import { useChat } from './hooks/useChat';

export default function App() {
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
        />

        {/* ── Chat Area ── */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {!selectedChar ? (
            <WelcomeSection />
          ) : (
            <>
              {/* Main Content Area with Avatar and Chat */}
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

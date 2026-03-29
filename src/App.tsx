import { useState, useEffect, useRef } from 'react';
import { Character, Message, SuggestedTopic } from '@types';
import { Sidebar, AvatarSection, ChatSection, WelcomeSection } from '@components';
import { fetchCharacters, sendMessage, generateTTS } from '@utils';

export default function App() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedChar, setSelectedChar] = useState<Character | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [backendError, setBackendError] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    let cancelled = false;
    const delayMs = 2500;
    const maxAttempts = 150;

    const load = (attempt: number) => {
      fetchCharacters()
        .then((data) => {
          if (cancelled) return;
          setCharacters(Array.isArray(data) ? data : []);
          setBackendError(false);
        })
        .catch(() => {
          if (cancelled) return;
          if (attempt + 1 >= maxAttempts) {
            setBackendError(true);
            return;
          }
          window.setTimeout(() => load(attempt + 1), delayMs);
        });
    };

    load(0);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const selectChar = (char: Character) => {
    setSelectedChar(char);
    setMessages([]);
    setInput('');
    // Add welcome message
    setMessages([
      {
        role: 'assistant',
        content: `Witajcie. Jestem ${char.name}. Gotów odpowiedzieć na Wasze pytania, bazując na moich pismach i wspomnieniach. O co chcecie zapytać?`,
        timestamp: new Date(),
        fragments: [],
      },
    ]);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const submitChat = async (content: string, options?: { sourceStem?: string }) => {
    if (!selectedChar || loading) return;

    const userMsg: Message = {
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const { answer, fragments: rawFragments } = await sendMessage(selectedChar.id, content, messages, options);
      const fragments = Array.isArray(rawFragments) ? rawFragments : [];

      const assistantMessage: Message = {
        role: 'assistant',
        content: answer,
        fragments,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (selectedChar.voiceName) {
        const audioUrl = await generateTTS(answer, selectedChar.voiceName);
        if (audioUrl) {
          assistantMessage.audioUrl = audioUrl;
          setMessages((prev) => prev.map((m) => (m === assistantMessage ? { ...m, audioUrl } : m)));
          playAudio(audioUrl);
        }
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Przepraszam, wystąpił błąd połączenia z serwerem.',
          timestamp: new Date(),
          fragments: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const sendMsg = async () => {
    if (!input.trim() || !selectedChar || loading) return;
    await submitChat(input.trim());
  };

  const sendSuggestedTopic = (topic: SuggestedTopic) => {
    if (!selectedChar || loading) return;
    void submitChat(topic.question, { sourceStem: topic.sourceStem });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMsg();
    }
  };

  const playAudio = async (audioUrl: string) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
      }

      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      if (audioRef.current) {
        audioRef.current.pause();
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      const source = audioContextRef.current.createMediaElementSource(audio);
      source.connect(analyserRef.current!);
      analyserRef.current!.connect(audioContextRef.current.destination);

      const updateVolume = () => {
        if (audio.paused) return;
        const dataArray = new Uint8Array(analyserRef.current!.frequencyBinCount);
        analyserRef.current!.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setVolume(average / 128);
        requestAnimationFrame(updateVolume);
      };

      audio.onplay = () => {
        setIsSpeaking(true);
        updateVolume();
      };

      audio.onended = () => {
        setIsSpeaking(false);
        setVolume(0);
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        setIsSpeaking(false);
        setVolume(0);
      };

      await audio.play();
    } catch (err) {
      console.error('Audio error:', err);
      setIsSpeaking(false);
      setVolume(0);
    }
  };

  const suggestedQuestions = selectedChar?.suggestedTopics || [];

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
                />
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}

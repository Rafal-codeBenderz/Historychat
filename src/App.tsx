import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Character, Message, Fragment, SuggestedTopic } from "./types";
import { Avatar } from "./components/Avatar";

// ─── API ─────────────────────────────────────────────────────────────────────
const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Voice mapping for TTS
const VOICE_MAP: Record<string, 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'> = {
  'Charon': 'echo',
  'Kore': 'nova',
  'Fenrir': 'fable',
  'Zephyr': 'shimmer',
  'Puck': 'alloy',
};

async function fetchCharacters(): Promise<Character[]> {
  const res = await fetch(`${API}/api/characters`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function sendMessage(
  characterId: string,
  message: string,
  history: Message[],
  options?: { sourceStem?: string }
): Promise<{ answer: string; fragments: Fragment[] }> {
  const body: Record<string, unknown> = {
    characterId,
    message,
    history: history.map((m) => ({ role: m.role, content: m.content })),
  };
  if (options?.sourceStem) {
    body.sourceStem = options.sourceStem;
  }
  const res = await fetch(`${API}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function generateTTS(text: string, voiceName?: string): Promise<string | null> {
  try {
    const voice = voiceName ? (VOICE_MAP[voiceName] || 'nova') : 'nova';
    const res = await fetch(`${API}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice }),
    });
    
    if (!res.ok) return null;
    
    const data = await res.json();
    // Konwertuj base64 na blob URL
    const audioBytes = Uint8Array.from(atob(data.audio), c => c.charCodeAt(0));
    const blob = new Blob([audioBytes], { type: 'audio/mpeg' });
    return URL.createObjectURL(blob);
  } catch (e) {
    console.error("TTS error:", e);
    return null;
  }
}

// ─── Avatar Component ────────────────────────────────────────────────────────
function CharacterAvatar({ char, size = 80 }: { char: Character; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.2,
        background: `linear-gradient(135deg, ${char.avatar_color}cc, ${char.avatar_color}55)`,
        border: `2px solid ${char.avatar_color}88`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.45,
        flexShrink: 0,
        boxShadow: `0 0 20px ${char.avatar_color}33, inset 0 1px 0 rgba(255,255,255,0.1)`,
      }}
    >
      {char.icon}
    </div>
  );
}

// ─── Source Badge ─────────────────────────────────────────────────────────────
function SourceBadge({ source, score }: { source: string; score: number }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "6px",
        padding: "3px 8px",
        fontSize: "11px",
        color: "rgba(255,255,255,0.55)",
        fontFamily: "'EB Garamond', Georgia, serif",
        fontStyle: "italic",
      }}
    >
      <span style={{ opacity: 0.4 }}>📜</span>
      {source}
      <span
        style={{
          background: "rgba(255,255,255,0.1)",
          borderRadius: "4px",
          padding: "1px 4px",
          fontSize: "10px",
          fontStyle: "normal",
          fontFamily: "monospace",
          color: "rgba(255,255,255,0.35)",
        }}
      >
        {Math.round(score * 100)}%
      </span>
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
function MessageBubble({
  message,
  char,
  onPlayAudio,
}: {
  message: Message;
  char: Character;
  onPlayAudio?: (audioUrl: string) => void;
}) {
  const isUser = message.role === "user";
  const [showSources, setShowSources] = useState(false);
  const hasSources = message.fragments && message.fragments.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: "flex",
        flexDirection: isUser ? "row-reverse" : "row",
        gap: "12px",
        alignItems: "flex-start",
      }}
    >
      {!isUser && <CharacterAvatar char={char} size={42} />}

      <div style={{ maxWidth: "74%", display: "flex", flexDirection: "column", gap: "6px" }}>
        {!isUser && (
          <div
            style={{
              fontSize: "11px",
              color: "rgba(255,255,255,0.35)",
              fontFamily: "'EB Garamond', serif",
              fontStyle: "italic",
              marginLeft: "4px",
            }}
          >
            {char.name} · {char.era}
          </div>
        )}

        <div
          style={{
            background: isUser
              ? "rgba(255,255,255,0.09)"
              : "rgba(255,255,255,0.04)",
            border: isUser
              ? "1px solid rgba(255,255,255,0.15)"
              : `1px solid ${char.avatar_color}44`,
            borderRadius: isUser ? "16px 16px 4px 16px" : "4px 16px 16px 16px",
            padding: "14px 18px",
            color: "rgba(255,255,255,0.88)",
            fontSize: "15px",
            lineHeight: "1.7",
            fontFamily: isUser ? "'Outfit', sans-serif" : "'EB Garamond', serif",
            boxShadow: isUser
              ? "none"
              : `0 2px 20px ${char.avatar_color}15`,
          }}
        >
          {message.content}
        </div>

        {!isUser && hasSources && (
          <div style={{ marginLeft: "4px" }}>
            <button
              onClick={() => setShowSources(!showSources)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "rgba(255,255,255,0.3)",
                fontSize: "11px",
                fontFamily: "'Outfit', sans-serif",
                padding: "2px 0",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <span style={{ transform: showSources ? "rotate(180deg)" : "none", display: "inline-block", transition: "0.2s" }}>▾</span>
              {showSources ? "Ukryj źródła" : `Pokaż źródła (${message.fragments!.length})`}
            </button>

            <AnimatePresence>
              {showSources && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: "hidden" }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "6px",
                      marginTop: "8px",
                      padding: "10px",
                      background: "rgba(0,0,0,0.2)",
                      borderRadius: "8px",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    {message.fragments!.map((frag, i) => (
                      <SourceBadge key={i} source={frag.source} score={frag.score} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {!isUser && !hasSources && (
          <div
            style={{
              marginLeft: "4px",
              fontSize: "11px",
              color: "rgba(255,200,100,0.4)",
              fontStyle: "italic",
              fontFamily: "'EB Garamond', serif",
            }}
          >
            ⚠ Odpowiedź bez odniesień źródłowych
          </div>
        )}

        {!isUser && message.audioUrl && onPlayAudio && (
          <div style={{ marginLeft: "4px", marginTop: "6px" }}>
            <button
              onClick={() => onPlayAudio(message.audioUrl!)}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "6px",
                padding: "4px 10px",
                fontSize: "11px",
                color: "rgba(255,255,255,0.6)",
                fontFamily: "'Outfit', sans-serif",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              🔊 Odtwórz ponownie
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Character Card ───────────────────────────────────────────────────────────
function CharacterCard({
  char,
  selected,
  onClick,
}: {
  char: Character;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      style={{
        width: "100%",
        background: selected
          ? `linear-gradient(135deg, ${char.avatar_color}33, ${char.avatar_color}11)`
          : "rgba(255,255,255,0.03)",
        border: selected
          ? `1px solid ${char.avatar_color}66`
          : "1px solid rgba(255,255,255,0.08)",
        borderRadius: "12px",
        padding: "14px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        textAlign: "left",
        transition: "background 0.2s, border 0.2s",
        boxShadow: selected ? `0 0 24px ${char.avatar_color}22` : "none",
      }}
    >
      <CharacterAvatar char={char} size={44} />
      <div>
        <div
          style={{
            color: selected ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.75)",
            fontSize: "14px",
            fontWeight: 600,
            fontFamily: "'Outfit', sans-serif",
            marginBottom: "2px",
          }}
        >
          {char.name}
        </div>
        <div
          style={{
            color: "rgba(255,255,255,0.35)",
            fontSize: "11px",
            fontFamily: "'EB Garamond', serif",
            fontStyle: "italic",
          }}
        >
          {char.era}
        </div>
      </div>
    </motion.button>
  );
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────
function TypingIndicator({ char }: { char: Character }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}
    >
      <CharacterAvatar char={char} size={42} />
      <div
        style={{
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${char.avatar_color}44`,
          borderRadius: "4px 16px 16px 16px",
          padding: "14px 20px",
          display: "flex",
          gap: "5px",
          alignItems: "center",
        }}
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: `${char.avatar_color}cc`,
            }}
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedChar, setSelectedChar] = useState<Character | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const selectChar = (char: Character) => {
    setSelectedChar(char);
    setMessages([]);
    setInput("");
    // Add welcome message
    setMessages([
      {
        role: "assistant",
        content: `Witajcie. Jestem ${char.name}. Gotów odpowiedzieć na Wasze pytania, bazując na moich pismach i wspomnieniach. O co chcecie zapytać?`,
        timestamp: new Date(),
        fragments: [],
      },
    ]);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const submitChat = async (
    content: string,
    options?: { sourceStem?: string }
  ) => {
    if (!selectedChar || loading) return;

    const userMsg: Message = {
      role: "user",
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const { answer, fragments: rawFragments } = await sendMessage(
        selectedChar.id,
        content,
        messages,
        options
      );
      const fragments = Array.isArray(rawFragments) ? rawFragments : [];

      const assistantMessage: Message = {
        role: "assistant",
        content: answer,
        fragments,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (selectedChar.voiceName) {
        const audioUrl = await generateTTS(answer, selectedChar.voiceName);
        if (audioUrl) {
          assistantMessage.audioUrl = audioUrl;
          setMessages((prev) =>
            prev.map((m) =>
              m === assistantMessage ? { ...m, audioUrl } : m
            )
          );
          playAudio(audioUrl);
        }
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Przepraszam, wystąpił błąd połączenia z serwerem.",
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
    if (e.key === "Enter" && !e.shiftKey) {
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
        if (!isSpeaking && audio.paused) return;
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
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Outfit:wght@300;400;500;600;700&display=swap');
        
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
          background: #0a0b0e; 
          color: white; 
          font-family: 'Outfit', sans-serif;
          overflow: hidden;
          height: 100vh;
        }
        
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        
        textarea { resize: none; }
        button { cursor: pointer; }
      `}</style>

      {/* Background */}
      <div
        style={{
          position: "fixed",
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
          position: "fixed",
          inset: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.035'/%3E%3C/svg%3E")`,
          zIndex: 0,
          pointerEvents: "none",
          opacity: 0.6,
        }}
      />

      <div style={{ position: "relative", zIndex: 1, display: "flex", height: "100vh" }}>
        {/* ── Sidebar ── */}
        <aside
          style={{
            width: "280px",
            flexShrink: 0,
            borderRight: "1px solid rgba(255,255,255,0.07)",
            display: "flex",
            flexDirection: "column",
            padding: "24px 16px",
            gap: "24px",
            background: "rgba(0,0,0,0.15)",
            backdropFilter: "blur(20px)",
          }}
        >
          {/* Logo */}
          <div>
            <div
              style={{
                fontFamily: "'EB Garamond', serif",
                fontSize: "22px",
                fontWeight: 500,
                color: "rgba(255,255,255,0.9)",
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
              }}
            >
              Historia<span style={{ color: "rgba(255,200,100,0.7)" }}>Chat</span>
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "rgba(255,255,255,0.28)",
                fontFamily: "'EB Garamond', serif",
                fontStyle: "italic",
                marginTop: "2px",
              }}
            >
              RAG · Rozmowy z historią
            </div>
          </div>

          {/* Characters list */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div
              style={{
                fontSize: "10px",
                fontWeight: 600,
                color: "rgba(255,255,255,0.25)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginBottom: "4px",
                paddingLeft: "4px",
              }}
            >
              Wybierz postać
            </div>

            {backendError && (
              <div
                style={{
                  background: "rgba(255,100,100,0.1)",
                  border: "1px solid rgba(255,100,100,0.2)",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  fontSize: "12px",
                  color: "rgba(255,150,150,0.8)",
                  fontFamily: "'EB Garamond', serif",
                  fontStyle: "italic",
                }}
              >
                ⚠ Brak połączenia z serwerem. Uruchom{" "}
                <code style={{ fontStyle: "normal", fontSize: "11px" }}>npm run start</code> lub{" "}
                <code style={{ fontStyle: "normal", fontSize: "11px" }}>python backend/server.py</code>.
                Przy pierwszym uruchomieniu backend ładuje model — może to potrwać kilka minut; wcześniej zobaczysz „Ładowanie postaci…”.
              </div>
            )}

            {characters.length === 0 && !backendError && (
              <div style={{ color: "rgba(255,255,255,0.2)", fontSize: "13px", padding: "8px 4px" }}>
                Ładowanie postaci...
              </div>
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

          {/* Info */}
          <div style={{ marginTop: "auto" }}>
            <div
              style={{
                fontSize: "10px",
                color: "rgba(255,255,255,0.2)",
                lineHeight: "1.6",
                fontFamily: "'EB Garamond', serif",
                fontStyle: "italic",
                borderTop: "1px solid rgba(255,255,255,0.06)",
                paddingTop: "14px",
              }}
            >
              Odpowiedzi oparte wyłącznie na autentycznych źródłach historycznych (RAG).
            </div>
          </div>
        </aside>

        {/* ── Chat Area ── */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {!selectedChar ? (
            // Welcome screen
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "40px",
                textAlign: "center",
              }}
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              >
                <div
                  style={{
                    fontSize: "52px",
                    marginBottom: "20px",
                    filter: "grayscale(0.3)",
                  }}
                >
                  📜
                </div>
                <h1
                  style={{
                    fontFamily: "'EB Garamond', serif",
                    fontSize: "36px",
                    fontWeight: 400,
                    color: "rgba(255,255,255,0.85)",
                    marginBottom: "12px",
                    letterSpacing: "-0.02em",
                  }}
                >
                  Rozmowy z Historią
                </h1>
                <p
                  style={{
                    color: "rgba(255,255,255,0.35)",
                    fontSize: "16px",
                    maxWidth: "440px",
                    lineHeight: "1.7",
                    fontFamily: "'EB Garamond', serif",
                    fontStyle: "italic",
                  }}
                >
                  Wybierz postać historyczną z panelu po lewej, by rozpocząć rozmowę opartą na autentycznych źródłach.
                </p>
              </motion.div>
            </div>
          ) : (
            <>
              {/* Main Content Area with Avatar and Chat */}
              <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                {/* Avatar Section - Hidden on mobile, visible on larger screens */}
                <div 
                  className="hidden lg:flex w-1/3 flex-col items-center justify-center border-r border-white/5 bg-[#050505] p-8"
                >
                  {selectedChar && (
                    <Avatar 
                      character={selectedChar} 
                      isSpeaking={isSpeaking} 
                      volume={volume}
                    />
                  )}
                  <div className="mt-12 text-center max-w-xs">
                    <h3 className="text-xl font-serif italic mb-2 text-white/80">
                      "{selectedChar.bio}"
                    </h3>
                    <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-6">
                      System RAG Aktywny
                    </p>
                  </div>
                </div>

                {/* Chat Section */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
              {/* Header */}
              <div
                style={{
                  padding: "16px 24px",
                  borderBottom: "1px solid rgba(255,255,255,0.07)",
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  background: "rgba(0,0,0,0.1)",
                  backdropFilter: "blur(10px)",
                }}
              >
                <CharacterAvatar char={selectedChar} size={40} />
                <div>
                  <div
                    style={{
                      fontSize: "16px",
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.9)",
                      fontFamily: "'Outfit', sans-serif",
                    }}
                  >
                    {selectedChar.name}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "rgba(255,255,255,0.35)",
                      fontFamily: "'EB Garamond', serif",
                      fontStyle: "italic",
                    }}
                  >
                    {selectedChar.era} · {selectedChar.bio.substring(0, 70)}...
                  </div>
                </div>

                <div
                  style={{
                    marginLeft: "auto",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "rgba(0,200,100,0.1)",
                    border: "1px solid rgba(0,200,100,0.2)",
                    borderRadius: "20px",
                    padding: "4px 10px",
                    fontSize: "11px",
                    color: "rgba(0,200,100,0.7)",
                    fontWeight: 500,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "rgba(0,200,100,0.8)",
                      display: "inline-block",
                    }}
                  />
                  RAG aktywny
                </div>
              </div>

              {/* Messages */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                }}
              >
                {/* Suggested questions (shown only at start) */}
                {messages.length === 1 && suggestedQuestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "8px" }}
                  >
                    {suggestedQuestions.map((topic, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => sendSuggestedTopic(topic)}
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: "20px",
                          padding: "6px 14px",
                          fontSize: "12px",
                          color: "rgba(255,255,255,0.5)",
                          fontFamily: "'EB Garamond', serif",
                          fontStyle: "italic",
                          transition: "all 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          (e.target as HTMLElement).style.background = "rgba(255,255,255,0.08)";
                          (e.target as HTMLElement).style.color = "rgba(255,255,255,0.8)";
                        }}
                        onMouseLeave={(e) => {
                          (e.target as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                          (e.target as HTMLElement).style.color = "rgba(255,255,255,0.5)";
                        }}
                      >
                        {topic.question}
                      </button>
                    ))}
                  </motion.div>
                )}

                {messages.map((msg, i) => (
                  <MessageBubble 
                    key={i} 
                    message={msg} 
                    char={selectedChar}
                    onPlayAudio={playAudio}
                  />
                ))}

                <AnimatePresence>
                  {loading && <TypingIndicator char={selectedChar} />}
                </AnimatePresence>

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div
                style={{
                  padding: "16px 24px",
                  borderTop: "1px solid rgba(255,255,255,0.07)",
                  background: "rgba(0,0,0,0.15)",
                  backdropFilter: "blur(20px)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "14px",
                    padding: "10px 16px",
                    alignItems: "flex-end",
                  }}
                >
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Zadaj pytanie ${selectedChar.name}...`}
                    rows={1}
                    style={{
                      flex: 1,
                      background: "none",
                      border: "none",
                      outline: "none",
                      color: "rgba(255,255,255,0.85)",
                      fontSize: "15px",
                      fontFamily: "'Outfit', sans-serif",
                      lineHeight: "1.5",
                      maxHeight: "120px",
                      overflowY: "auto",
                    }}
                    onInput={(e) => {
                      const el = e.target as HTMLTextAreaElement;
                      el.style.height = "auto";
                      el.style.height = Math.min(el.scrollHeight, 120) + "px";
                    }}
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={sendMsg}
                    disabled={!input.trim() || loading}
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "10px",
                      border: "none",
                      background: input.trim() && !loading
                        ? `linear-gradient(135deg, ${selectedChar.avatar_color}cc, ${selectedChar.avatar_color}88)`
                        : "rgba(255,255,255,0.1)",
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "16px",
                      flexShrink: 0,
                      transition: "background 0.2s",
                      opacity: input.trim() && !loading ? 1 : 0.4,
                    }}
                  >
                    ↑
                  </motion.button>
                </div>
                <div
                  style={{
                    fontSize: "10px",
                    color: "rgba(255,255,255,0.2)",
                    marginTop: "8px",
                    textAlign: "center",
                    fontFamily: "'EB Garamond', serif",
                    fontStyle: "italic",
                  }}
                >
                  Enter aby wysłać · Shift+Enter nowa linia · Odpowiedzi oparte na autentycznych źródłach RAG
                </div>
              </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}

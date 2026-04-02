import { AnimatePresence, motion } from 'framer-motion';
import { CharacterAvatar } from './CharacterAvatar';
import { Character, Message, SuggestedTopic } from '@types';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';

type ChatSectionProps = {
  selectedChar: Character;
  messages: Message[];
  suggestedQuestions: SuggestedTopic[];
  sendSuggestedTopic: (topic: SuggestedTopic) => void;
  sendMsg: () => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  loading: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  input: string;
  setInput: (input: string) => void;
  playAudio: (audioUrl: string) => void;
  stopAudio: () => void;
};

export function ChatSection({
  selectedChar,
  messages,
  suggestedQuestions,
  sendSuggestedTopic,
  sendMsg,
  handleKeyDown,
  loading,
  messagesEndRef,
  inputRef,
  input,
  setInput,
  playAudio,
  stopAudio,
}: ChatSectionProps) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {/* Header */}
      <div
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          background: 'rgba(0,0,0,0.1)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <CharacterAvatar char={selectedChar} size={40} />
        <div>
          <div
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.9)',
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            {selectedChar.name}
          </div>
          <div
            style={{
              fontSize: '12px',
              color: 'rgba(255,255,255,0.35)',
              fontFamily: "'EB Garamond', serif",
              fontStyle: 'italic',
            }}
          >
            {selectedChar.era} · {selectedChar.bio.substring(0, 70)}...
          </div>
        </div>

        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(0,200,100,0.1)',
            border: '1px solid rgba(0,200,100,0.2)',
            borderRadius: '20px',
            padding: '4px 10px',
            fontSize: '11px',
            color: 'rgba(0,200,100,0.7)',
            fontWeight: 500,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'rgba(0,200,100,0.8)',
              display: 'inline-block',
            }}
          />
          RAG aktywny
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        {/* Suggested questions (shown only at start) */}
        {messages.length === 1 && suggestedQuestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}
          >
            {suggestedQuestions.map((topic, i) => (
              <button
                key={i}
                type="button"
                onClick={() => sendSuggestedTopic(topic)}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '20px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  color: 'rgba(255,255,255,0.5)',
                  fontFamily: "'EB Garamond', serif",
                  fontStyle: 'italic',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
                  (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.8)';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                  (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.5)';
                }}
              >
                {topic.question}
              </button>
            ))}
          </motion.div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} char={selectedChar} onPlayAudio={playAudio} onStopAudio={stopAudio} />
        ))}

        <AnimatePresence>{loading && <TypingIndicator char={selectedChar} />}</AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        style={{
          padding: '16px 24px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(0,0,0,0.15)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '12px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '14px',
            padding: '10px 16px',
            alignItems: 'flex-end',
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
              background: 'none',
              border: 'none',
              outline: 'none',
              color: 'rgba(255,255,255,0.85)',
              fontSize: '15px',
              fontFamily: "'Outfit', sans-serif",
              lineHeight: '1.5',
              maxHeight: '120px',
              overflowY: 'auto',
            }}
            onInput={(e) => {
              const el = e.target as HTMLTextAreaElement;
              el.style.height = 'auto';
              el.style.height = Math.min(el.scrollHeight, 120) + 'px';
            }}
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={sendMsg}
            disabled={!input.trim() || loading}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              border: 'none',
              background:
                input.trim() && !loading
                  ? `linear-gradient(135deg, ${selectedChar.avatar_color}cc, ${selectedChar.avatar_color}88)`
                  : 'rgba(255,255,255,0.1)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              flexShrink: 0,
              transition: 'background 0.2s',
              opacity: input.trim() && !loading ? 1 : 0.4,
            }}
          >
            ↑
          </motion.button>
        </div>
        <div
          style={{
            fontSize: '10px',
            color: 'rgba(255,255,255,0.2)',
            marginTop: '8px',
            textAlign: 'center',
            fontFamily: "'EB Garamond', serif",
            fontStyle: 'italic',
          }}
        >
          Enter aby wysłać · Shift+Enter nowa linia · Odpowiedzi oparte na autentycznych źródłach RAG
        </div>
      </div>
    </div>
  );
}

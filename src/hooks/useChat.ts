import { useCallback, useMemo, useRef, useState } from 'react';
import { Character, Message, SuggestedTopic } from '@types';
import { apiAuthHeaders, backendUrl, generateTTS, sendMessage } from '@utils';

export function useChat(options: {
  playAudio: (audioUrl: string) => void;
  avatarImageGenerationEnabled?: boolean | null;
}) {
  const { playAudio, avatarImageGenerationEnabled } = options;

  const [selectedChar, setSelectedChar] = useState<Character | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [avatarRefreshKey, setAvatarRefreshKey] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const suggestedQuestions = useMemo(() => selectedChar?.suggestedTopics || [], [selectedChar]);

  const selectChar = useCallback((char: Character) => {
    setSelectedChar(char);
    setMessages([]);
    setInput('');

    setMessages([
      {
        role: 'assistant',
        content: `Witajcie. Jestem ${char.name}. Gotów odpowiedzieć na Wasze pytania, bazując na moich pismach i wspomnieniach. O co chcecie zapytać?`,
        timestamp: new Date(),
        fragments: [],
      },
    ]);

    if (char.id && avatarImageGenerationEnabled !== false) {
      void fetch(backendUrl('/api/generate-avatar'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...apiAuthHeaders() },
        body: JSON.stringify({ character_id: char.id }),
      })
        .then(async (res) => {
          const data = (await res.json().catch(() => null)) as { success?: boolean } | null;
          if (res.ok && data?.success) {
            setAvatarRefreshKey((k) => k + 1);
          }
        })
        .catch(() => null);
    }

    setTimeout(() => inputRef.current?.focus(), 100);
  }, [avatarImageGenerationEnabled]);

  const submitChat = useCallback(
    async (content: string, opts?: { sourceStem?: string }) => {
      if (!selectedChar || loading) return;

      const userMsg: Message = { role: 'user', content, timestamp: new Date() };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setLoading(true);

      try {
        const { answer, fragments: rawFragments } = await sendMessage(selectedChar.id, content, messages, opts);
        const fragments = Array.isArray(rawFragments) ? rawFragments : [];

        const assistantMessage: Message = { role: 'assistant', content: answer, fragments, timestamp: new Date() };
        setMessages((prev) => [...prev, assistantMessage]);

        const audioUrl = await generateTTS(answer, selectedChar.voice_id ?? undefined);
        if (audioUrl) {
          setMessages((prev) => prev.map((m) => (m === assistantMessage ? { ...m, audioUrl } : m)));
          playAudio(audioUrl);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Przepraszam, wystąpił błąd połączenia z serwerem.', timestamp: new Date(), fragments: [] },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, playAudio, selectedChar],
  );

  const sendMsg = useCallback(async () => {
    if (!input.trim() || !selectedChar || loading) return;
    await submitChat(input.trim());
  }, [input, loading, selectedChar, submitChat]);

  const sendSuggestedTopic = useCallback(
    (topic: SuggestedTopic) => {
      if (!selectedChar || loading) return;
      void submitChat(topic.question, { sourceStem: topic.sourceStem });
    },
    [loading, selectedChar, submitChat],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void sendMsg();
      }
    },
    [sendMsg],
  );

  return {
    selectedChar,
    messages,
    input,
    loading,
    messagesEndRef,
    inputRef,
    suggestedQuestions,
    setInput,
    selectChar,
    submitChat,
    sendMsg,
    sendSuggestedTopic,
    handleKeyDown,
    avatarRefreshKey,
  };
}


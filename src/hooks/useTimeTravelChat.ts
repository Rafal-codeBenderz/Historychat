import { useCallback, useRef, useState } from 'react';
import { Character, Fragment, Message } from '@types';
import {
  TIME_TRAVEL_LOCATION_MAX,
  TIME_TRAVEL_MESSAGE_MAX,
  TIME_TRAVEL_YEAR_MAX,
  TIME_TRAVEL_YEAR_MIN,
} from '../constants/timeTravel';
import { generateTTS, SceneNotAllowedError, sendTimeTravelMessage } from '@utils';

type UseTimeTravelChatOptions = {
  playAudio: (audioUrl: string) => void;
  characters: Character[];
};

export type TimeTravelPersistedChat = {
  selectedCharId: string | null;
  year: string;
  location: string;
  sourceStem: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    fragments?: Fragment[];
    timestamp: string;
    audioUrl?: string;
  }>;
};

const defaultChat = (): TimeTravelPersistedChat => ({
  selectedCharId: null,
  year: '',
  location: '',
  sourceStem: '',
  messages: [],
});

export function useTimeTravelChat({ playAudio, characters }: UseTimeTravelChatOptions) {
  const [selectedChar, setSelectedChar] = useState<Character | null>(null);
  const [year, setYear] = useState('');
  const [location, setLocation] = useState('');
  const [sourceStem, setSourceStem] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInputRaw] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [errorIsRetryable, setErrorIsRetryable] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const returningVisitorRef = useRef(false);

  const setInput = useCallback((value: string) => {
    setSendError(null);
    setErrorIsRetryable(false);
    setInputRaw(value);
  }, []);

  const serializeChat = useCallback((): TimeTravelPersistedChat => {
    return {
      selectedCharId: selectedChar?.id ?? null,
      year,
      location,
      sourceStem,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        fragments: m.fragments,
        timestamp: m.timestamp.toISOString(),
        audioUrl: m.audioUrl,
      })),
    };
  }, [selectedChar, year, location, sourceStem, messages]);

  const hydrateChat = useCallback(
    (data: TimeTravelPersistedChat | null | undefined) => {
      if (!data?.selectedCharId) {
        setSelectedChar(null);
        setYear('');
        setLocation('');
        setSourceStem('');
        setMessages([]);
        setInputRaw('');
        setSendError(null);
        setErrorIsRetryable(false);
        setLoading(false);
        return;
      }
      const ch = characters.find((c) => c.id === data.selectedCharId);
      if (!ch) {
        setSelectedChar(null);
        setYear('');
        setLocation('');
        setSourceStem('');
        setMessages([]);
        setSendError(null);
        setErrorIsRetryable(false);
        return;
      }
      setSelectedChar(ch);
      setYear(data.year);
      setLocation(data.location);
      setSourceStem(data.sourceStem ?? '');
      setMessages(
        (data.messages ?? []).map((m) => ({
          role: m.role,
          content: m.content,
          fragments: m.fragments ?? [],
          timestamp: new Date(m.timestamp),
          audioUrl: m.audioUrl,
        })),
      );
      setInputRaw('');
      setSendError(null);
      setErrorIsRetryable(false);
      setLoading(false);
    },
    [characters],
  );

  const resetSession = useCallback(() => {
    setSelectedChar(null);
    setYear('');
    setLocation('');
    setSourceStem('');
    setMessages([]);
    setInputRaw('');
    setSendError(null);
    setErrorIsRetryable(false);
    setLoading(false);
  }, []);

  const startChatWithCharacter = useCallback(
    (char: Character, y: string, loc: string, opts?: { returningVisitor?: boolean }) => {
      returningVisitorRef.current = opts?.returningVisitor === true;
      setSelectedChar(char);
      setYear(y);
      setLocation(loc);
      setSourceStem('');
      setSendError(null);
      setErrorIsRetryable(false);
      setMessages([
        {
          role: 'assistant',
          content: `Witaj. Jestem ${char.name}. W naszej rozmowie przyjmujemy rok ${y} i miejsce: ${loc}. O czym chcesz porozmawiać? Nie znam wydarzeń po tym roku.`,
          timestamp: new Date(),
          fragments: [],
        },
      ]);
      setInputRaw('');
      setTimeout(() => inputRef.current?.focus(), 100);
    },
    [],
  );

  const sendMsg = useCallback(async () => {
    if (!input.trim() || !selectedChar || loading) return;

    const y = parseInt(year, 10);
    if (Number.isNaN(y)) {
      setSendError('Rok sceny musi być liczbą całkowitą.');
      setErrorIsRetryable(false);
      return;
    }
    if (y < TIME_TRAVEL_YEAR_MIN || y > TIME_TRAVEL_YEAR_MAX) {
      setSendError(`Rok musi być w zakresie ${TIME_TRAVEL_YEAR_MIN}–${TIME_TRAVEL_YEAR_MAX}.`);
      setErrorIsRetryable(false);
      return;
    }

    const locTrim = location.trim();
    if (!locTrim) {
      setSendError('Brak miejsca sceny — wróć do wyników i ustaw rok oraz miejsce.');
      setErrorIsRetryable(false);
      return;
    }
    if (locTrim.length > TIME_TRAVEL_LOCATION_MAX) {
      setSendError(`Miejsce może mieć co najwyżej ${TIME_TRAVEL_LOCATION_MAX} znaków.`);
      setErrorIsRetryable(false);
      return;
    }

    const content = input.trim();
    if (content.length > TIME_TRAVEL_MESSAGE_MAX) {
      setSendError(`Wiadomość może mieć co najwyżej ${TIME_TRAVEL_MESSAGE_MAX} znaków.`);
      setErrorIsRetryable(false);
      return;
    }

    setSendError(null);
    setErrorIsRetryable(false);

    const userMsg: Message = { role: 'user', content, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInputRaw('');
    setLoading(true);

    try {
      const stem = sourceStem.trim() || undefined;
      const { answer, fragments: rawFragments } = await sendTimeTravelMessage(
        selectedChar.id,
        content,
        y,
        location,
        messages,
        {
          ...(stem ? { sourceStem: stem } : {}),
          ...(returningVisitorRef.current ? { returningVisitor: true } : {}),
        },
      );
      const fragments = Array.isArray(rawFragments) ? rawFragments : [];
      const assistantMessage: Message = {
        role: 'assistant',
        content: answer,
        fragments,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      if (selectedChar.voice_id) {
        const audioUrl = await generateTTS(answer, selectedChar.voice_id);
        if (audioUrl) {
          setMessages((prev) =>
            prev.map((m) => (m === assistantMessage ? { ...m, audioUrl } : m)),
          );
          playAudio(audioUrl);
        }
      }
    } catch (e) {
      setMessages((prev) => prev.slice(0, -1));
      setInputRaw(content);
      if (e instanceof SceneNotAllowedError) {
        setSendError(e.message);
        setErrorIsRetryable(false);
      } else {
        setSendError(
          'Nie udało się połączyć z serwerem. Sprawdź połączenie lub spróbuj ponownie za chwilę.',
        );
        setErrorIsRetryable(true);
      }
    } finally {
      setLoading(false);
    }
  }, [input, loading, location, messages, playAudio, selectedChar, sourceStem, year]);

  const retrySend = useCallback(() => {
    if (!errorIsRetryable || loading || !input.trim()) return;
    setSendError(null);
    setErrorIsRetryable(false);
    void sendMsg();
  }, [errorIsRetryable, loading, input, sendMsg]);

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
    year,
    location,
    sourceStem,
    setSourceStem,
    messages,
    input,
    loading,
    messagesEndRef,
    inputRef,
    setInput,
    resetSession,
    startChatWithCharacter,
    sendMsg,
    retrySend,
    handleKeyDown,
    sendError,
    errorIsRetryable,
    serializeChat,
    hydrateChat,
    defaultChatSnapshot: defaultChat,
  };
}

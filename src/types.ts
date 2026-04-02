export interface SuggestedTopic {
  question: string;
  sourceStem: string;
}

export interface Fragment {
  text: string;
  source: string;
  score: number;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  fragments?: Fragment[];
  timestamp: Date;
  audioUrl?: string;
}

export interface Character {
  id: string;
  name: string;
  era: string;
  bio: string;
  avatar_color: string;
  icon: string;
  // Nowe pola
  accentColor?: string;
  imagePrompt?: string;
  /** New API contract: voice_id is ready for OpenAI TTS. */
  voice_id?: string | null;
  /** Legacy field (kept for backward compatibility). */
  voiceName?: string;
  suggestedTopics?: SuggestedTopic[];
}

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

// ---------------------------------------------------------------------------
// Debate types
// ---------------------------------------------------------------------------
export type DebateRole = 'prosecutor' | 'defender' | 'judge';

export interface DebateRoles {
  prosecutor: string;   // char_id
  defender: string;
  judge: string;
}

export interface DebateTurn {
  speaker: string;        // char_id
  speakerName: string;
  role: DebateRole;
  content: string;
  fragments: Fragment[];
}

export interface DebateState {
  theme: string;
  roles: DebateRoles;
  transcript: DebateTurn[];
  isLoading: boolean;
  error: string | null;
  verdictDone: boolean;
}

export interface DebateTurnRequest {
  theme: string;
  roles: DebateRoles;
  next_role: DebateRole;
  transcript: DebateTurn[];
}

export interface DebateVerdictRequest {
  theme: string;
  roles: DebateRoles;
  transcript: DebateTurn[];
}

// ---------------------------------------------------------------------------
// Existing types
// ---------------------------------------------------------------------------
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

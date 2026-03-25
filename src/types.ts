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
  voiceName?: string;
  suggestedTopics?: SuggestedTopic[];
}

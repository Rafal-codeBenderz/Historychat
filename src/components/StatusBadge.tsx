import { Loader2, Volume2 } from 'lucide-react';

type StatusBadgeProps = {
  loading: boolean;
  isSpeaking: boolean;
};

export function StatusBadge({ loading, isSpeaking }: StatusBadgeProps) {
  return (
    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full bg-black/80 backdrop-blur-xl border border-white/10 text-[10px] uppercase tracking-[0.3em] font-black text-white whitespace-nowrap shadow-2xl">
      {loading ? (
        <span className="flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" /> Generowanie...
        </span>
      ) : isSpeaking ? (
        <span className="text-emerald-500 flex items-center gap-2">
          <Volume2 className="w-3 h-3" /> Mówi
        </span>
      ) : (
        'Gotowy'
      )}
    </div>
  );
}

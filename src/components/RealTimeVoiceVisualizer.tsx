import { motion } from 'framer-motion';

type RealTimeVoiceVisualizerProps = {
  volume: number;
  accentColor: string;
};

export function RealTimeVoiceVisualizer({ volume, accentColor }: RealTimeVoiceVisualizerProps) {
  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-end gap-1.5 h-16">
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          animate={{
            height: [8, (Math.random() * 40 + 10) * (volume + 0.5), 8],
            opacity: [0.4, 1, 0.4],
          }}
          transition={{
            repeat: Infinity,
            duration: 0.2 + Math.random() * 0.2,
            ease: 'easeInOut',
          }}
          className="w-1.5 rounded-full shadow-lg"
          style={{ backgroundColor: accentColor }}
        />
      ))}
    </div>
  );
}

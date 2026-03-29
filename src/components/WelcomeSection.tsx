import { motion } from 'framer-motion';

export function WelcomeSection() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        textAlign: 'center',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <div
          style={{
            fontSize: '52px',
            marginBottom: '20px',
            filter: 'grayscale(0.3)',
          }}
        >
          📜
        </div>
        <h1
          style={{
            fontFamily: "'EB Garamond', serif",
            fontSize: '36px',
            fontWeight: 400,
            color: 'rgba(255,255,255,0.85)',
            marginBottom: '12px',
            letterSpacing: '-0.02em',
          }}
        >
          Rozmowy z Historią
        </h1>
        <p
          style={{
            color: 'rgba(255,255,255,0.35)',
            fontSize: '16px',
            maxWidth: '440px',
            lineHeight: '1.7',
            fontFamily: "'EB Garamond', serif",
            fontStyle: 'italic',
          }}
        >
          Wybierz postać historyczną z panelu po lewej, by rozpocząć rozmowę opartą na autentycznych źródłach.
        </p>
      </motion.div>
    </div>
  );
}

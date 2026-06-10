// src/components/SourceBadge/index.tsx
// Small pill badge showing music source name.
// Bottom-right corner. Fades in on source change.

import { AnimatePresence, motion } from "motion/react";

interface SourceBadgeProps {
  sourceName: string;
}

export function SourceBadge({ sourceName }: SourceBadgeProps) {
  if (!sourceName) return null;

  return (
    <AnimatePresence>
      <motion.div
        key={sourceName}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 0.55, y: 0 }}
        exit={{ opacity: 0, y: 4 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        whileHover={{ opacity: 0.9 }}
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "5px 10px",
          borderRadius: "20px",
          background: "var(--ui-bg)",
          border: "1px solid var(--ui-border)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          pointerEvents: "none",
        }}
        aria-label={`Now playing from ${sourceName}`}
      >
        {/* Live indicator dot */}
        <div
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: "var(--ui-accent)",
            opacity: 0.8,
          }}
        />
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "11px",
            letterSpacing: "0.08em",
            color: "var(--ui-text-secondary)",
            textTransform: "uppercase",
          }}
        >
          {sourceName}
        </span>
      </motion.div>
    </AnimatePresence>
  );
}

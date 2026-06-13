// src/components/Controls/index.tsx
// Three playback buttons: Prev / Play-Pause / Next.
// Phase 4:
//   - All styling via Controls.css (no more inline style objects)
//   - Glassmorphism pill wrapper (.controls-pill)
//   - Play/Pause icon morph via AnimatePresence + motion.div cross-fade
//   - Spring tap + hover states via whileHover/whileTap
//   - Proper disabled state (cursor: not-allowed, opacity 0.28)
//   - Secondary btn hover: lifts to --ui-text-primary + bg

import { motion, AnimatePresence } from "motion/react";
import "./Controls.css";

interface ControlsProps {
  isPlaying: boolean;
  canControl?: boolean;
  canSkip?: boolean;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
}

// ── SVG icons — stroke-based, currentColor ────────────────────
const IconPrev = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="19 20 9 12 19 4 19 20" />
    <line x1="5" y1="19" x2="5" y2="5" />
  </svg>
);

const IconNext = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="5 4 15 12 5 20 5 4" />
    <line x1="19" y1="5" x2="19" y2="19" />
  </svg>
);

const IconPlay = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="none"
  >
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const IconPause = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="none"
  >
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </svg>
);

// ── Icon morph animation variants ────────────────────────────
const iconVariants = {
  enter: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.18, ease: "backOut" as const },
  },
  exit: {
    opacity: 0,
    scale: 0.55,
    transition: { duration: 0.14, ease: "easeIn" as const },
  },
};

export function Controls({
  isPlaying,
  canControl = true,
  canSkip = true,
  onPlay,
  onPause,
  onNext,
  onPrevious,
}: ControlsProps) {
  const canUseSkip = canControl && canSkip;

  return (
    <div className="controls-pill" role="group" aria-label="Playback controls">
      {/* ── Previous ── */}
      <motion.button
        className="controls-btn-secondary"
        disabled={!canUseSkip}
        onClick={onPrevious}
        aria-label="Previous track"
        style={{ opacity: canUseSkip ? 0.65 : 0.35 }}
        whileHover={canUseSkip ? { scale: 1.1 } : {}}
        whileTap={canUseSkip ? { scale: 0.86 } : {}}
        transition={{ type: "spring", stiffness: 350, damping: 22 }}
      >
        <IconPrev />
      </motion.button>

      {/* ── Play / Pause — primary CTA ── */}
      <motion.button
        className={`controls-btn-primary ${isPlaying ? "playing" : "paused"}`}
        disabled={!canControl}
        onClick={isPlaying ? onPause : onPlay}
        aria-label={isPlaying ? "Pause" : "Play"}
        whileHover={canControl ? { scale: 1.06 } : {}}
        whileTap={canControl ? { scale: 0.88 } : {}}
        transition={{ type: "spring", stiffness: 350, damping: 22 }}
      >
        {/* Phase 4.4: AnimatePresence icon morph — exits old, enters new */}
        <AnimatePresence mode="popLayout" initial={false}>
          {isPlaying ? (
            <motion.span
              key="pause"
              className="controls-icon"
              variants={iconVariants}
              initial="exit"
              animate="enter"
              exit="exit"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconPause />
            </motion.span>
          ) : (
            <motion.span
              key="play"
              className="controls-icon"
              variants={iconVariants}
              initial="exit"
              animate="enter"
              exit="exit"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconPlay />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* ── Next ── */}
      <motion.button
        className="controls-btn-secondary"
        disabled={!canUseSkip}
        onClick={onNext}
        aria-label="Next track"
        style={{ opacity: canUseSkip ? 0.65 : 0.35 }}
        whileHover={canUseSkip ? { scale: 1.1 } : {}}
        whileTap={canUseSkip ? { scale: 0.86 } : {}}
        transition={{ type: "spring", stiffness: 350, damping: 22 }}
      >
        <IconNext />
      </motion.button>
    </div>
  );
}

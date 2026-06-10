// src/components/TrackInfo/index.tsx
// Title + artist + album block.
// Phase 5:
//   - All styling via TrackInfo.css (--font-display/body/mono vars)
//   - AnimatePresence: exit slides LEFT (x: -24px), enter from RIGHT (x: 24px)
//   - Empty state: "— / —" placeholder in mono
//   - Title hover: text-shadow bloom via CSS :hover
//   - Single-line ellipsis on all text rows

import { AnimatePresence, motion } from "motion/react";
import "./TrackInfo.css";

interface TrackInfoProps {
  track: string;
  artist: string;
  album?: string;
}

// Slide direction variants — record-flip feel
// Exit goes LEFT, enter comes from RIGHT (next track)
// This is the dominant direction; prev track could reverse
// but we don't have that signal yet — using uniform direction
const slideVariants = {
  enter: {
    x: 24,
    opacity: 0,
  },
  center: {
    x: 0,
    opacity: 1,
  },
  exit: {
    x: -24,
    opacity: 0,
  },
};

const slideTransition = {
  duration: 0.30,
  ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
};

export function TrackInfo({ track, artist, album }: TrackInfoProps) {
  const trackKey = `${track}::${artist}`;
  const isEmpty = !track || track === "Nothing Playing";

  return (
    <div className="track-info">
      <AnimatePresence mode="wait" initial={false}>
        {isEmpty ? (
          // Phase 5.2: Empty state placeholder
          <motion.p
            key="empty"
            className="track-info__empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            — / —
          </motion.p>
        ) : (
          // Phase 5.3: Slide transition on track change
          <motion.div
            key={trackKey}
            className="track-info__motion"
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={slideTransition}
          >
            {/* Phase 5.1: --font-display, hover bloom via CSS */}
            <h2 className="track-info__title" title={track}>
              {track}
            </h2>

            {/* Phase 5.1: --font-body, uppercase tracking */}
            {artist && (
              <p className="track-info__artist" title={artist}>
                {artist}
              </p>
            )}

            {/* Phase 5.1: --font-mono, muted stamp */}
            {album && (
              <p className="track-info__album" title={album}>
                {album}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

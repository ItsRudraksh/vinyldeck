import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Languages, Sparkles } from "lucide-react";
import { SCRIPT_SAMPLES } from "../data/site";

type ClipMode = "split" | "strip" | "multilingual";

const CLIPS: Record<
  ClipMode,
  { label: string; src: string; poster: string }
> = {
  split: {
    label: "Split View",
    src: "/media/karaoke-noir.mp4",
    poster: "/media/noir-split.webp",
  },
  strip: {
    label: "Compact Strip",
    src: "/media/compact-strip.mp4",
    poster: "/media/compact-strip.webp",
  },
  multilingual: {
    label: "Multilingual",
    src: "/media/multilingual-jp.mp4",
    poster: "/media/japanese-split.webp",
  },
};

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export function LyricsStudio() {
  const [clipMode, setClipMode] = useState<ClipMode>("split");
  const [sampleId, setSampleId] = useState(SCRIPT_SAMPLES[0].id);
  const [romanize, setRomanize] = useState(true);
  const [showTranslation, setShowTranslation] = useState(false);

  const activeSample =
    SCRIPT_SAMPLES.find((s) => s.id === sampleId) ?? SCRIPT_SAMPLES[0];
  const activeClip = CLIPS[clipMode];

  return (
    <section id="lyrics" className="vd-section" aria-labelledby="lyrics-heading">
      <div className="vd-container">
        <div className="vd-section-head vd-section-head--split">
          <div>
            <h2 id="lyrics-heading" className="vd-h2">
              Realtime lyrics,
              <br />
              choreographed at 60fps.
            </h2>
          </div>

          <div className="vd-segmented" role="tablist" aria-label="Lyrics layout views">
            {(Object.keys(CLIPS) as ClipMode[]).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={clipMode === key}
                className="vd-segmented-btn"
                data-active={clipMode === key}
                onClick={() => setClipMode(key)}
              >
                {clipMode === key && (
                  <motion.span
                    layoutId="lyrics-clip-tab"
                    className="vd-segmented-bg"
                    transition={{ type: "spring", duration: 0.45, bounce: 0.16 }}
                  />
                )}
                {CLIPS[key].label}
              </button>
            ))}
          </div>
        </div>

        <div className="vd-studio-grid">
          {/* Real Extracted App Clip Stage (No Caption Under Media) */}
          <div className="vd-video-stage vd-media-zoom">
            <AnimatePresence mode="wait">
              <motion.video
                key={clipMode}
                src={activeClip.src}
                poster={activeClip.poster}
                autoPlay
                loop
                muted
                playsInline
                initial={{ opacity: 0, scale: 0.985 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.99 }}
                transition={{ duration: 0.28, ease: EASE_OUT }}
              />
            </AnimatePresence>
          </div>

          {/* Interactive Auto-Romanize & Manual Translation Sandbox */}
          <div className="vd-romanize-card">
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Languages size={17} strokeWidth={1.75} color="#e5a96d" />
                  <span style={{ fontWeight: 600, fontSize: "0.98rem" }}>
                    Auto-Romanize Engine
                  </span>
                </div>
                <span className="vd-mono" style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>
                  {activeSample.langTag}
                </span>
              </div>

              <div className="vd-lang-row" role="group" aria-label="Select lyric script">
                {SCRIPT_SAMPLES.map((sample) => (
                  <button
                    key={sample.id}
                    type="button"
                    className="vd-lang-btn"
                    data-active={sample.id === sampleId}
                    onClick={() => setSampleId(sample.id)}
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={`${sampleId}-${romanize}-${showTranslation}`}
                className="vd-script-preview"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
              >
                <div
                  className="vd-mono"
                  style={{
                    fontSize: "0.72rem",
                    color: activeSample.accent,
                    letterSpacing: "0.02em",
                  }}
                >
                  {activeSample.track.toUpperCase()} — {activeSample.artist.toUpperCase()}
                </div>

                {activeSample.lines.map((line, idx) => (
                  <div
                    key={idx}
                    style={{
                      opacity: idx === 1 ? 1 : 0.48,
                      filter: idx === 1 ? "none" : "blur(0.45px)",
                    }}
                  >
                    <div className="vd-script-line-main">
                      {romanize ? line.romanized : line.native}
                    </div>
                    {showTranslation && (
                      <div className="vd-script-line-sub">{line.translated}</div>
                    )}
                  </div>
                ))}
              </motion.div>
            </AnimatePresence>

            <div className="vd-toggle-bar">
              <button
                type="button"
                className="vd-key-pill"
                data-on={romanize}
                onClick={() => setRomanize((r) => !r)}
                aria-pressed={romanize}
              >
                <Sparkles size={14} />
                <span>Romanize</span>
                <kbd className="vd-kbd">R</kbd>
              </button>

              <button
                type="button"
                className="vd-key-pill"
                data-on={showTranslation}
                onClick={() => setShowTranslation((t) => !t)}
                aria-pressed={showTranslation}
              >
                <span>Translate (Manual)</span>
                <kbd className="vd-kbd">Shift+T</kbd>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

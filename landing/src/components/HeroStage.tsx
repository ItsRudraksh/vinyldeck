import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowUpRight, Download, Pause, Play } from "lucide-react";
import { HERO_LYRICS, SITE } from "../data/site";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export function HeroStage() {
  const [shell, setShell] = useState<"noir" | "glass">("noir");
  const [playing, setPlaying] = useState(true);
  const [lineIdx, setLineIdx] = useState(1);
  const [wordIdx, setWordIdx] = useState(0);

  useEffect(() => {
    if (!playing) return;
    const currentLine = HERO_LYRICS[lineIdx];
    const timer = window.setInterval(() => {
      setWordIdx((prev) => {
        if (prev + 1 < currentLine.words.length) {
          return prev + 1;
        }
        setLineIdx((l) => (l + 1) % HERO_LYRICS.length);
        return 0;
      });
    }, 360);
    return () => window.clearInterval(timer);
  }, [playing, lineIdx]);

  return (
    <section id="top" className="vd-hero">
      <div className="vd-container vd-hero-grid">
        {/* Left: Orchestrated Editorial Copy */}
        <motion.div
          className="vd-hero-copy"
          initial={{ opacity: 0, y: 14, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: EASE_OUT }}
        >
          <div className="vd-hero-pill">
            <span className="vd-hero-dot" aria-hidden="true" />
            <span>{SITE.version} · Windows 10 &amp; 11</span>
          </div>

          <h1 className="vd-display vd-hero-title">
            Your music,
            <br />
            pressed in glass
            <br />
            and velvet.
          </h1>

          <p className="vd-lead">
            A native Rust desktop turntable with 60fps word-by-word karaoke
            lyrics, automatic romanization, and zero-login Windows SMTC sync.
          </p>

          <div className="vd-hero-actions">
            <a href={SITE.downloadExeUrl} className="vd-btn vd-btn--primary">
              <Download size={17} strokeWidth={2} />
              <span>Download Setup (.exe)</span>
            </a>

            <a href={SITE.downloadMsiUrl} className="vd-btn vd-btn--ghost">
              <span>MSI Installer</span>
              <ArrowUpRight size={16} strokeWidth={1.75} />
            </a>
          </div>

          <div className="vd-hero-meta">
            <span>WinRT SMTC</span>
            <span>·</span>
            <span>0ms Disk Lyrics Cache</span>
            <span>·</span>
            <span>Spotify · YouTube · Apple Music · VLC</span>
          </div>
        </motion.div>

        {/* Right: Live Interactive VinylDeck Mini-Stage */}
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.65, delay: 0.08, ease: EASE_OUT }}
          className={`vd-live-stage ${
            shell === "noir" ? "vd-live-stage--noir" : "vd-live-stage--glass"
          }`}
          aria-label="Interactive VinylDeck live preview"
        >
          <div className="vd-stage-topbar">
            <div
              className="vd-stage-shell-toggle"
              role="group"
              aria-label="Preview material shell"
            >
              {(["noir", "glass"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className="vd-stage-shell-btn"
                  onClick={() => setShell(mode)}
                  aria-pressed={shell === mode}
                >
                  {shell === mode && (
                    <motion.span
                      layoutId="hero-shell-pill"
                      className="vd-stage-shell-pill"
                      transition={{
                        type: "spring",
                        duration: 0.45,
                        bounce: 0.16,
                      }}
                    />
                  )}
                  {mode === "noir" ? "Noir" : "Glass"}
                </button>
              ))}
            </div>

            <span className="vd-mono" style={{ fontSize: "0.72rem", opacity: 0.65 }}>
              ART AMBIENT · 60 FPS
            </span>
          </div>

          <div className="vd-stage-body">
            <div className="vd-turntable-wrap">
              <div
                className={`vd-vinyl-disc ${
                  !playing ? "vd-vinyl-disc--paused" : ""
                }`}
              >
                <div className="vd-vinyl-label">
                  <div className="vd-vinyl-spindle" />
                </div>
              </div>

              {/* Machined Tonearm SVG */}
              <svg
                viewBox="0 0 110 180"
                className={`vd-tonearm ${
                  playing ? "vd-tonearm--playing" : "vd-tonearm--rested"
                }`}
                aria-hidden="true"
              >
                <circle
                  cx="79"
                  cy="26"
                  r="16"
                  fill={shell === "noir" ? "#262830" : "#cbd5e1"}
                  stroke={shell === "noir" ? "rgba(255,255,255,0.22)" : "rgba(15,23,42,0.2)"}
                  strokeWidth="1.5"
                />
                <circle
                  cx="79"
                  cy="26"
                  r="7"
                  fill={shell === "noir" ? "#0d0e12" : "#64748b"}
                />
                <path
                  d="M79 26 L68 122 L46 154"
                  fill="none"
                  stroke={shell === "noir" ? "#d4d7e0" : "#475569"}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <rect
                  x="36"
                  y="148"
                  width="13"
                  height="22"
                  rx="3"
                  transform="rotate(28 42 159)"
                  fill={shell === "noir" ? "#16181f" : "#1e293b"}
                  stroke={shell === "noir" ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.4)"}
                  strokeWidth="1"
                />
              </svg>
            </div>

            <div className="vd-hero-lyrics" aria-live="off">
              {HERO_LYRICS.map((line, i) => {
                const dist = i - lineIdx;
                const isActive = dist === 0;
                const stateClass = isActive
                  ? "vd-hero-line--active"
                  : dist < 0
                    ? "vd-hero-line--past"
                    : Math.abs(dist) === 1
                      ? "vd-hero-line--near"
                      : "vd-hero-line--far";

                return (
                  <div key={line.id} className={`vd-hero-line ${stateClass}`}>
                    {line.words.map((word, w) => {
                      const lit = isActive && w <= wordIdx;
                      return (
                        <span
                          key={`${line.id}-${w}`}
                          className="vd-hero-word"
                          style={{
                            opacity: isActive ? (lit ? 1 : 0.36) : 1,
                            transform:
                              isActive && w === wordIdx
                                ? "translateY(-1px)"
                                : "translateY(0)",
                          }}
                        >
                          {word}
                        </span>
                      );
                    })}
                    {line.bgVocal && isActive && (
                      <span className="vd-hero-bg-vocal">{line.bgVocal}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="vd-stage-footer">
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.9rem", lineHeight: 1.2 }}>
                That&apos;s What I Like
              </div>
              <div className="vd-mono" style={{ fontSize: "0.72rem", opacity: 0.62 }}>
                BRUNO MARS · SPLIT VIEW
              </div>
            </div>

            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="vd-btn vd-btn--sm"
              style={{
                background:
                  shell === "noir"
                    ? "rgba(255,255,255,0.12)"
                    : "rgba(12,16,24,0.1)",
                color: "inherit",
              }}
              aria-label={playing ? "Pause preview turntable" : "Play preview turntable"}
            >
              {playing ? <Pause size={14} /> : <Play size={14} />}
              <span>{playing ? "Spinning" : "Paused"}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

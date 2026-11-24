import { useState } from "react";
import { motion } from "motion/react";
import { Maximize2, Minimize2 } from "lucide-react";

const SPRING_SOFT = { type: "spring", duration: 0.55, bounce: 0.18 } as const;

export function ModesChoreography() {
  const [miniMode, setMiniMode] = useState(false);

  return (
    <section id="modes" className="vd-section" aria-labelledby="modes-heading">
      <div className="vd-container">
        <div className="vd-section-head vd-section-head--split">
          <h2 id="modes-heading" className="vd-h2">
            Full-room presence.
            <br />
            Or a corner disc.
          </h2>
          <p className="vd-lead">
            Adaptive Art Ambient pressings shift seamlessly with every album
            cover, while Preferences and Resizable Mini Mode stay out of your
            way until you call them.
          </p>
        </div>

        <div className="vd-modes-grid">
          {/* Left: Real Art Ambient Pressings Loop (No Caption Under Media) */}
          <div className="vd-mode-frame vd-media-zoom">
            <video
              src="/media/ambient-pressings.mp4"
              poster="/media/noir-split.webp"
              autoPlay
              loop
              muted
              playsInline
              style={{ aspectRatio: "16 / 9.2" }}
            />
          </div>

          {/* Right Column: Interactive Mini-Mode Morph + Preferences Frame */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="vd-mini-morph-card">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: "1rem" }}>
                    Resizable Mini Mode
                  </div>
                  <div className="vd-mono" style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>
                    ALWAYS ON TOP · CORNER DOCK
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMiniMode((m) => !m)}
                  className="vd-btn vd-btn--ghost vd-btn--sm"
                >
                  {miniMode ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
                  <span>{miniMode ? "Expand" : "Shrink"}</span>
                </button>
              </div>

              <div className="vd-mini-canvas" aria-label="Interactive Mini Mode preview">
                <motion.div
                  layout
                  transition={SPRING_SOFT}
                  style={{
                    position: "absolute",
                    bottom: 14,
                    right: 14,
                    left: miniMode ? "auto" : 14,
                    top: miniMode ? "auto" : 14,
                    width: miniMode ? 88 : "auto",
                    height: miniMode ? 88 : "auto",
                    borderRadius: miniMode ? 999 : 16,
                    border: "1px solid rgba(255,255,255,0.16)",
                    background:
                      "radial-gradient(circle at 35% 35%, rgba(229,169,109,0.22), rgba(12,13,18,0.92))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: miniMode ? "center" : "space-between",
                    padding: miniMode ? 10 : "16px 20px",
                    boxShadow: "0 14px 36px rgba(0,0,0,0.55)",
                  }}
                >
                  <motion.div
                    layout
                    transition={SPRING_SOFT}
                    className="vd-vinyl-disc"
                    style={{
                      width: miniMode ? 64 : 84,
                      height: miniMode ? 64 : 84,
                      flexShrink: 0,
                    }}
                  >
                    <div className="vd-vinyl-label">
                      <div className="vd-vinyl-spindle" />
                    </div>
                  </motion.div>

                  {!miniMode && (
                    <motion.div
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.22 }}
                      style={{ flex: 1, marginLeft: 18 }}
                    >
                      <div style={{ fontWeight: 600, fontSize: "0.94rem" }}>
                        From The Start
                      </div>
                      <div
                        className="vd-mono"
                        style={{ fontSize: "0.7rem", color: "var(--ink-secondary)", marginTop: 2 }}
                      >
                        LAUFEY · MAIN STAGE
                      </div>
                      <div
                        style={{
                          marginTop: 10,
                          height: 3,
                          borderRadius: 99,
                          background: "rgba(255,255,255,0.12)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: "58%",
                            height: "100%",
                            background: "var(--accent-amber)",
                          }}
                        />
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              </div>
            </div>

            <div className="vd-mode-frame vd-media-zoom">
              <img
                src="/media/settings-studio.webp"
                alt="VinylDeck Preferences Studio"
                loading="lazy"
                decoding="async"
                style={{ aspectRatio: "16 / 9" }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

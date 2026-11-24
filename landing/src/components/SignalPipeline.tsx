import { motion } from "motion/react";
import { Cpu, Disc3, Radio } from "lucide-react";

const SOURCES = ["Spotify", "YouTube", "Apple Music", "Chrome / Edge", "Tidal", "VLC"];
const OUTPUTS = ["Spinning Vinyl", "60fps Lyrics", "Art Ambient", "Mini Mode"];

function SignalConnector() {
  return (
    <div className="vd-pipe-connector" aria-hidden="true">
      <svg viewBox="0 0 64 24" width="64" height="24" fill="none">
        <line
          x1="2"
          y1="12"
          x2="62"
          y2="12"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth="1.5"
          strokeDasharray="3 4"
        />
        <motion.circle
          cy="12"
          r="3"
          fill="#e5a96d"
          initial={{ cx: 6, opacity: 0.2 }}
          animate={{ cx: 58, opacity: [0.2, 1, 0.2] }}
          transition={{
            duration: 1.8,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      </svg>
    </div>
  );
}

export function SignalPipeline() {
  return (
    <section className="vd-section" aria-labelledby="pipeline-heading">
      <div className="vd-container">
        <div className="vd-section-head vd-section-head--split">
          <h2 id="pipeline-heading" className="vd-h2">
            Zero accounts.
            <br />
            Instant Windows sync.
          </h2>
          <p className="vd-lead">
            VinylDeck listens directly to Windows System Media Transport
            Controls. Press play anywhere on your PC and the tonearm drops
            automatically.
          </p>
        </div>

        <div className="vd-pipeline-shell">
          <div className="vd-pipeline-grid">
            <div className="vd-pipe-node">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Radio size={18} strokeWidth={1.6} color="#a1a4b0" />
                <span style={{ fontWeight: 600, fontSize: "0.98rem" }}>
                  Any Audio Source
                </span>
              </div>
              <div className="vd-pipe-chips">
                {SOURCES.map((src) => (
                  <span key={src} className="vd-pipe-chip">
                    {src}
                  </span>
                ))}
              </div>
            </div>

            <SignalConnector />

            <div className="vd-pipe-node vd-pipe-node--core">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Cpu size={18} strokeWidth={1.6} color="#e5a96d" />
                <span style={{ fontWeight: 600, fontSize: "0.98rem" }}>
                  WinRT SMTC → Rust Core
                </span>
              </div>
              <p style={{ fontSize: "0.86rem", color: "var(--ink-secondary)" }}>
                Native OS telemetry for title, artist, artwork, timeline
                position, and unified System Tray playback commands.
              </p>
              <span className="vd-mono" style={{ fontSize: "0.72rem", color: "var(--accent-amber)" }}>
                0 API KEYS · 0 AUDIO CAPTURE
              </span>
            </div>

            <SignalConnector />

            <div className="vd-pipe-node">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Disc3 size={18} strokeWidth={1.6} color="#a1a4b0" />
                <span style={{ fontWeight: 600, fontSize: "0.98rem" }}>
                  VinylDeck Stage
                </span>
              </div>
              <div className="vd-pipe-chips">
                {OUTPUTS.map((out) => (
                  <span key={out} className="vd-pipe-chip">
                    {out}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

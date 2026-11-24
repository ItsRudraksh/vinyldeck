import { ARCHITECTURE_BENTO } from "../data/site";

export function ArchitectureBento() {
  return (
    <section
      id="architecture"
      className="vd-section"
      aria-labelledby="architecture-heading"
    >
      <div className="vd-container">
        <div className="vd-section-head vd-section-head--split">
          <h2 id="architecture-heading" className="vd-h2">
            Engineered in Rust.
            <br />
            Built to stay silent.
          </h2>
          <p className="vd-lead">
            No Electron bloat, no background browser tabs, and zero flicker
            across track changes—every control speaks straight to native Windows
            APIs.
          </p>
        </div>

        <div className="vd-bento">
          {ARCHITECTURE_BENTO.map((item) => (
            <article
              key={item.id}
              className={`vd-bento-card vd-card-interactive ${
                item.span === "wide"
                  ? "vd-bento-card--wide"
                  : "vd-bento-card--standard"
              }`}
            >
              <div>
                <div className="vd-bento-metric vd-mono">{item.metric}</div>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: "1.05rem",
                    marginTop: 10,
                    color: "var(--ink-primary)",
                  }}
                >
                  {item.label}
                </div>
              </div>

              <p
                style={{
                  fontSize: "0.94rem",
                  color: "var(--ink-secondary)",
                  lineHeight: 1.6,
                }}
              >
                {item.detail}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

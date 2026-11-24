import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, ChevronDown, Download, Github } from "lucide-react";
import { FAQ_ITEMS, SITE } from "../data/site";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export function DownloadFooter() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section id="download" className="vd-section" style={{ paddingBottom: 0 }}>
      <div className="vd-container">
        <div className="vd-download-box">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <span
              className="vd-mono"
              style={{ fontSize: "0.78rem", color: "var(--accent-amber)" }}
            >
              RELEASE {SITE.version.toUpperCase()} · FREE &amp; OPEN SOURCE
            </span>
            <h2 className="vd-h2">
              Drop the needle
              <br />
              on your desktop.
            </h2>
            <p className="vd-lead">
              {SITE.platformNote}. Installs in seconds with zero accounts,
              telemetry, or subscription tiers.
            </p>
          </div>

          <div className="vd-installer-stack">
            <a
              href={SITE.downloadExeUrl}
              className="vd-installer-card vd-installer-card--primary"
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: "1rem" }}>
                  Windows Setup (.exe)
                </div>
                <div
                  className="vd-mono"
                  style={{ fontSize: "0.74rem", opacity: 0.72, marginTop: 2 }}
                >
                  VinylDeck_2.3.2_x64-setup.exe · Recommended
                </div>
              </div>
              <Download size={20} strokeWidth={2.2} />
            </a>

            <a
              href={SITE.downloadMsiUrl}
              className="vd-installer-card vd-card-interactive"
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.96rem" }}>
                  Windows MSI Installer (.msi)
                </div>
                <div
                  className="vd-mono"
                  style={{
                    fontSize: "0.74rem",
                    color: "var(--ink-muted)",
                    marginTop: 2,
                  }}
                >
                  VinylDeck_2.3.2_x64_en-US.msi · Enterprise / Clean Deploy
                </div>
              </div>
              <ArrowUpRight size={19} strokeWidth={1.8} />
            </a>

            <a
              href={SITE.releasesUrl}
              target="_blank"
              rel="noreferrer"
              className="vd-link-underline"
              style={{ alignSelf: "flex-start", marginTop: 4 }}
            >
              <Github size={15} />
              <span>View v2.3.2 release notes &amp; source on GitHub</span>
            </a>
          </div>
        </div>

        {/* Compact Accordion FAQ */}
        <div className="vd-faq-list" aria-label="Frequently asked questions">
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div key={item.q} className="vd-faq-item">
                <button
                  type="button"
                  className="vd-faq-trigger"
                  aria-expanded={isOpen}
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                >
                  <span>{item.q}</span>
                  <ChevronDown
                    size={18}
                    strokeWidth={1.75}
                    style={{
                      flexShrink: 0,
                      color: "var(--ink-muted)",
                      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 200ms var(--ease-out)",
                    }}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      className="vd-faq-answer"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.24, ease: EASE_OUT }}
                    >
                      <p style={{ paddingBottom: 22 }}>{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        <footer className="vd-footer">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="vd-brand-disc" aria-hidden="true" />
            <span className="vd-mono">
              {SITE.name} {SITE.version}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <a
              href={SITE.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="vd-link-underline"
            >
              GitHub
            </a>
            <a
              href={SITE.releasesUrl}
              target="_blank"
              rel="noreferrer"
              className="vd-link-underline"
            >
              Releases
            </a>
            <a href={SITE.downloadExeUrl} className="vd-link-underline">
              Setup .exe
            </a>
          </div>
        </footer>
      </div>
    </section>
  );
}

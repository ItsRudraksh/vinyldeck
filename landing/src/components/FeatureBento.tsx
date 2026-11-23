import { img } from "../content/assets";
import { SectionEyebrow } from "./SectionEyebrow";

const items = [
  {
    eyebrow: "Physical vinyl",
    title: "Grooves, sheen, wobble, and album-art labels.",
    text: "The record is treated like a real object, not a circular thumbnail.",
    src: img.vinylMacro,
    tone: "dark",
  },
  {
    eyebrow: "Tonearm behavior",
    title: "The needle breathes with playback state.",
    text: "Playback, pause, skip, and idle states are visible through arm posture and deck motion.",
    src: img.tonearmMacro,
    tone: "light",
  },
  {
    eyebrow: "Lyrics & settings",
    title:
      "Synced lyrics, Romanized & Translated subtitles, and persisted preferences.",
    text: "Switch Split View or Compact Strip, toggle Romanized (R) or Translated (Shift+T) lines across 12 languages, and keep every preference Rust-owned across windows.",
    src: img.settingsGlass,
    tone: "light",
  },
  {
    eyebrow: "System source",
    title: "Built around Windows media sessions.",
    text: "VinylDeck identifies the active source, exposes only the actions that source supports, and auto-hides lyrics cleanly on instrumental tracks.",
    src: img.spotifySource,
    tone: "dark",
  },
];

export function FeatureBento() {
  return (
    <section
      className="feature-bento page-section"
      aria-labelledby="features-title"
    >
      <div className="section-heading reveal-up">
        <SectionEyebrow>Product details</SectionEyebrow>
        <h2 id="features-title">
          Every visual choice comes from the desktop app.
        </h2>
      </div>
      <div className="bento-grid">
        {items.map((item, index) => (
          <article
            key={item.title}
            className={`bento-card bento-card--${item.tone} reveal-up bento-${index + 1}`}
          >
            <img src={item.src} alt="" loading="lazy" />
            <div className="bento-content">
              <p className="mono">{item.eyebrow}</p>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

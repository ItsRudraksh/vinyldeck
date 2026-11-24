import { useEffect, useState } from "react";
import { Download, Github } from "lucide-react";
import { SITE } from "../data/site";

interface NavbarProps {
  onNavigate?: (hash: string) => void;
}

const NAV_ITEMS = [
  { label: "Materials", href: "#materials" },
  { label: "Lyrics", href: "#lyrics" },
  { label: "Modes", href: "#modes" },
  { label: "Architecture", href: "#architecture" },
];

export function Navbar({ onNavigate }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleAnchor = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    if (!onNavigate) return;
    e.preventDefault();
    onNavigate(href);
  };

  return (
    <header className="vd-nav-wrap">
      <nav
        className={`vd-nav ${scrolled ? "vd-nav--scrolled" : ""}`}
        aria-label="Primary navigation"
      >
        <a
          href="#top"
          className="vd-brand"
          onClick={(e) => handleAnchor(e, "#top")}
        >
          <span className="vd-brand-disc" aria-hidden="true" />
          <span>{SITE.name}</span>
          <span className="vd-brand-ver">{SITE.version}</span>
        </a>

        <div className="vd-nav-links">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="vd-link-underline"
              onClick={(e) => handleAnchor(e, item.href)}
            >
              {item.label}
            </a>
          ))}
        </div>

        <div className="vd-nav-actions">
          <a
            href={SITE.repoUrl}
            target="_blank"
            rel="noreferrer"
            className="vd-btn vd-btn--ghost vd-btn--sm"
            aria-label="VinylDeck on GitHub"
          >
            <Github size={15} strokeWidth={1.75} />
            <span className="vd-nav-dl-full">GitHub</span>
          </a>

          <a
            href={SITE.downloadExeUrl}
            className="vd-btn vd-btn--primary vd-btn--sm"
          >
            <Download size={15} strokeWidth={2} />
            <span className="vd-nav-dl-full">Download {SITE.version}</span>
            <span className="vd-nav-dl-short">Download</span>
          </a>
        </div>
      </nav>
    </header>
  );
}

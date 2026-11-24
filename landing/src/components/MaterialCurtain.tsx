import { useCallback, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { MoveHorizontal } from "lucide-react";

const PRESETS = [
  { label: "Noir", value: 92 },
  { label: "50 / 50", value: 50 },
  { label: "Glass", value: 8 },
] as const;

export function MaterialCurtain() {
  const frameRef = useRef<HTMLDivElement>(null);
  const [activePreset, setActivePreset] = useState<number | null>(50);

  const rawPercent = useMotionValue(50);
  const smoothPercent = useSpring(rawPercent, {
    stiffness: 340,
    damping: 34,
    mass: 0.6,
  });

  const clipPath = useTransform(
    smoothPercent,
    (v) => `inset(0 ${100 - v}% 0 0)`
  );
  const dividerLeft = useTransform(smoothPercent, (v) => `${v}%`);

  const updateFromClientX = useCallback(
    (clientX: number) => {
      const rect = frameRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0) return;
      const pct = Math.max(4, Math.min(96, ((clientX - rect.left) / rect.width) * 100));
      rawPercent.set(pct);
      setActivePreset(null);
    },
    [rawPercent]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromClientX(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    updateFromClientX(e.clientX);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const current = rawPercent.get();
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      rawPercent.set(Math.max(4, current - 6));
      setActivePreset(null);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      rawPercent.set(Math.min(96, current + 6));
      setActivePreset(null);
    }
  };

  const snapTo = (val: number) => {
    rawPercent.set(val);
    setActivePreset(val);
  };

  return (
    <section id="materials" className="vd-section" aria-labelledby="materials-heading">
      <div className="vd-container">
        <div className="vd-section-head vd-section-head--split">
          <div>
            <h2 id="materials-heading" className="vd-h2">
              Two physical rooms.
              <br />
              One turntable.
            </h2>
          </div>

          <div
            className="vd-segmented"
            role="group"
            aria-label="Material split presets"
          >
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className="vd-segmented-btn"
                data-active={activePreset === preset.value}
                onClick={() => snapTo(preset.value)}
              >
                {activePreset === preset.value && (
                  <motion.span
                    layoutId="curtain-preset-bg"
                    className="vd-segmented-bg"
                    transition={{ type: "spring", duration: 0.45, bounce: 0.16 }}
                  />
                )}
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div
          ref={frameRef}
          className="vd-curtain-frame"
          role="slider"
          tabIndex={0}
          aria-label="Compare Noir OLED Velvet and Refractive Glass shells"
          aria-valuemin={4}
          aria-valuemax={96}
          aria-valuenow={Math.round(rawPercent.get())}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onKeyDown={handleKeyDown}
        >
          {/* Base Layer: Refractive Glass (Right) */}
          <img
            src="/media/glass-split.webp"
            alt="VinylDeck Refractive Glass shell with Split View synced lyrics"
            className="vd-curtain-layer"
            loading="lazy"
            decoding="async"
          />

          {/* Top Clipped Layer: Noir OLED Velvet (Left) */}
          <motion.img
            src="/media/noir-split.webp"
            alt="VinylDeck Noir OLED Velvet shell with Split View synced lyrics"
            className="vd-curtain-layer"
            style={{ clipPath }}
            loading="lazy"
            decoding="async"
          />

          <span className="vd-curtain-badge vd-curtain-badge--noir">
            NOIR · OLED VELVET
          </span>
          <span className="vd-curtain-badge vd-curtain-badge--glass">
            GLASS · REFRACTIVE CASE
          </span>

          <motion.div
            className="vd-curtain-divider"
            style={{ left: dividerLeft }}
            aria-hidden="true"
          >
            <div className="vd-curtain-handle">
              <MoveHorizontal size={18} strokeWidth={1.8} />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

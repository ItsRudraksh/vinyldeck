import { useCallback, useEffect, useRef } from "react";
import Lenis from "lenis";
import { MotionConfig, motion, useScroll, useSpring } from "motion/react";
import { Navbar } from "./components/Navbar";
import { HeroStage } from "./components/HeroStage";
import { SignalPipeline } from "./components/SignalPipeline";
import { MaterialCurtain } from "./components/MaterialCurtain";
import { LyricsStudio } from "./components/LyricsStudio";
import { ModesChoreography } from "./components/ModesChoreography";
import { ArchitectureBento } from "./components/ArchitectureBento";
import { DownloadFooter } from "./components/DownloadFooter";

export function App() {
  const lenisRef = useRef<Lenis | null>(null);
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 260,
    damping: 32,
    restDelta: 0.001,
  });

  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
    if (prefersReduced || isCoarsePointer) return;

    const lenis = new Lenis({
      duration: 1.05,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    lenisRef.current = lenis;

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = window.requestAnimationFrame(raf);
    };
    rafId = window.requestAnimationFrame(raf);

    return () => {
      window.cancelAnimationFrame(rafId);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  const handleNavigate = useCallback((hash: string) => {
    const target = document.querySelector<HTMLElement>(hash);
    if (!target) return;
    if (lenisRef.current) {
      lenisRef.current.scrollTo(target, { offset: -20 });
    } else {
      target.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <motion.div className="vd-scroll-bar" style={{ scaleX }} aria-hidden="true" />
      <Navbar onNavigate={handleNavigate} />
      <main>
        <HeroStage />
        <SignalPipeline />
        <MaterialCurtain />
        <LyricsStudio />
        <ModesChoreography />
        <ArchitectureBento />
        <DownloadFooter />
      </main>
    </MotionConfig>
  );
}

export default App;

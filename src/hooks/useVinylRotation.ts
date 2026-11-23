// src/hooks/useVinylRotation.ts
// RAF-based rotation with inertia on pause.
// Direct DOM mutation (no React state) = zero re-renders.
// Caches #vinyl-disc ref and pauses automatically when window is hidden/minimized.

import { useEffect, useRef } from "react";
import type { TrackChangeDirection } from "../lib/trackTransition/types";

export interface VinylRotationFrame {
  rotation: number;
  velocity: number;
  deltaMs: number;
}

interface UseVinylRotationOptions {
  isPlaying: boolean;
  rpm?: number; // default 33.33
  skipDirection?: TrackChangeDirection;
  skipNonce?: number;
  onFrame?: (frame: VinylRotationFrame) => void;
}

export function useVinylRotation({
  isPlaying,
  rpm = 33.33,
  skipDirection = "unknown",
  skipNonce = 0,
  onFrame,
}: UseVinylRotationOptions): void {
  const rafRef = useRef<number | null>(null);
  const discElRef = useRef<HTMLElement | null>(null);
  const rotationRef = useRef<number>(0);
  const velocityRef = useRef<number>(0);
  const lastTimestampRef = useRef<number | null>(null);
  const targetVelocityRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(isPlaying);
  const skipImpulseRef = useRef<number>(0);
  const lastSkipNonceRef = useRef<number>(skipNonce);
  const onFrameRef = useRef<typeof onFrame>(onFrame);

  // degreesPerMs at 33.33 RPM: (33.33 / 60) * (360 / 1000) ~= 0.19998 deg/ms
  const degreesPerMs = (rpm / 60) * (360 / 1000);

  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  function getDiscElement(): HTMLElement | null {
    const cached = discElRef.current;
    if (cached && cached.isConnected) return cached;
    const found = document.getElementById("vinyl-disc");
    discElRef.current = found;
    return found;
  }

  function applyFrame(delta: number) {
    const target = targetVelocityRef.current;
    const current = velocityRef.current;
    const lerpFactor = target > current ? 0.06 : 0.018;
    velocityRef.current = current + (target - current) * lerpFactor;
    skipImpulseRef.current *= 0.88;
    if (Math.abs(skipImpulseRef.current) < 0.0005) {
      skipImpulseRef.current = 0;
    }
    rotationRef.current =
      (rotationRef.current +
        (velocityRef.current + skipImpulseRef.current) * delta) %
      360;

    const disc = getDiscElement();
    if (disc) {
      disc.style.transform = `rotate3d(0, 0, 1, ${rotationRef.current.toFixed(3)}deg)`;
    }

    onFrameRef.current?.({
      rotation: rotationRef.current,
      velocity: velocityRef.current + skipImpulseRef.current,
      deltaMs: delta,
    });
  }

  function stopLoop() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTimestampRef.current = null;
    }
  }

  function wakeLoop() {
    if (typeof document !== "undefined" && document.hidden) return;
    if (rafRef.current === null) {
      lastTimestampRef.current = null;
      rafRef.current = requestAnimationFrame(tick);
    }
  }

  function tick(timestamp: number) {
    if (typeof document !== "undefined" && document.hidden) {
      stopLoop();
      return;
    }

    if (lastTimestampRef.current === null) {
      lastTimestampRef.current = timestamp;
    }

    const delta = Math.min(timestamp - lastTimestampRef.current, 50);
    lastTimestampRef.current = timestamp;
    applyFrame(delta);

    if (
      Math.abs(velocityRef.current) < 0.0001 &&
      Math.abs(skipImpulseRef.current) < 0.0001 &&
      !isPlayingRef.current
    ) {
      stopLoop();
      return;
    }

    rafRef.current = requestAnimationFrame(tick);
  }

  // Pause 60fps rotation loop completely when window is hidden/minimized to tray
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden) {
        stopLoop();
      } else if (
        isPlayingRef.current ||
        Math.abs(velocityRef.current) > 0.0001 ||
        Math.abs(skipImpulseRef.current) > 0.0001
      ) {
        wakeLoop();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    targetVelocityRef.current = isPlaying ? degreesPerMs : 0;
    if (isPlaying || Math.abs(velocityRef.current) > 0.0001) wakeLoop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, degreesPerMs]);

  useEffect(() => {
    if (skipNonce === lastSkipNonceRef.current) return;
    lastSkipNonceRef.current = skipNonce;
    if (skipDirection === "next") {
      skipImpulseRef.current += degreesPerMs * 1.65;
    } else if (skipDirection === "previous") {
      skipImpulseRef.current -= degreesPerMs * 2.15;
    }
    if (Math.abs(skipImpulseRef.current) > 0) wakeLoop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipDirection, skipNonce, degreesPerMs]);

  useEffect(() => {
    return () => {
      stopLoop();
      discElRef.current = null;
    };
  }, []);
}

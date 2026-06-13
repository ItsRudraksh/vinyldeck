// src/hooks/useVinylRotation.ts
// RAF-based rotation with inertia on pause.
// Direct DOM mutation for the CSS fallback, plus optional per-frame callback for
// the WebGL vinyl shader. No React state = zero re-renders.

import { useEffect, useRef } from "react";

export interface VinylRotationFrame {
  rotation: number;
  velocity: number;
  deltaMs: number;
}

interface UseVinylRotationOptions {
  isPlaying: boolean;
  rpm?: number; // default 33.33
  /** CSS fallback element id. Pass null to disable DOM rotation. */
  elementId?: string | null;
  /** Called from the same RAF that drives rotation; used by WebGL uniforms. */
  onFrame?: (frame: VinylRotationFrame) => void;
}

export function useVinylRotation({
  isPlaying,
  rpm = 33.33,
  elementId = "vinyl-disc",
  onFrame,
}: UseVinylRotationOptions): void {
  const rafRef = useRef<number | null>(null);
  const rotationRef = useRef<number>(0);
  const velocityRef = useRef<number>(0);
  const lastTimestampRef = useRef<number | null>(null);
  const targetVelocityRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(isPlaying);
  const elementIdRef = useRef<string | null | undefined>(elementId);
  const onFrameRef = useRef<typeof onFrame>(onFrame);

  const degreesPerMs = (rpm / 60) * (360 / 1000);

  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  useEffect(() => {
    elementIdRef.current = elementId;
  }, [elementId]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    targetVelocityRef.current = isPlaying ? degreesPerMs : 0;

    if (isPlaying && rafRef.current === null) {
      lastTimestampRef.current = null;
      rafRef.current = requestAnimationFrame(tick);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, degreesPerMs]);

  useEffect(() => {
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(tick);
    }

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastTimestampRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function tick(timestamp: number) {
    if (lastTimestampRef.current === null) {
      lastTimestampRef.current = timestamp;
    }

    const delta = Math.min(timestamp - lastTimestampRef.current, 50);
    lastTimestampRef.current = timestamp;

    const target = targetVelocityRef.current;
    const current = velocityRef.current;
    const lerpFactor = target > current ? 0.06 : 0.018;
    velocityRef.current = current + (target - current) * lerpFactor;
    rotationRef.current =
      (rotationRef.current + velocityRef.current * delta) % 360;

    const nextRotation = rotationRef.current;
    const nextVelocity = velocityRef.current;
    const targetElementId = elementIdRef.current;

    if (targetElementId) {
      const disc = document.getElementById(targetElementId);
      if (disc) {
        disc.style.transform = `rotate(${nextRotation}deg)`;
      }
    }

    onFrameRef.current?.({
      rotation: nextRotation,
      velocity: nextVelocity,
      deltaMs: delta,
    });

    if (Math.abs(nextVelocity) < 0.0001 && !isPlayingRef.current) {
      rafRef.current = null;
      lastTimestampRef.current = null;
      return;
    }

    rafRef.current = requestAnimationFrame(tick);
  }
}

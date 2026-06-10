// src/hooks/useVinylRotation.ts
// RAF-based rotation with inertia on pause.
// Direct DOM mutation (no React state) = zero re-renders.
// Element must have id="vinyl-disc".

import { useEffect, useRef } from "react";

interface UseVinylRotationOptions {
  isPlaying: boolean;
  rpm?: number; // default 33.33
}

export function useVinylRotation({
  isPlaying,
  rpm = 33.33,
}: UseVinylRotationOptions): void {
  const rafRef = useRef<number | null>(null);
  const rotationRef = useRef<number>(0);
  const velocityRef = useRef<number>(0);
  const lastTimestampRef = useRef<number | null>(null);
  const targetVelocityRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(isPlaying);

  // degreesPerMs at 33.33 RPM:  (33.33 / 60) * (360 / 1000) ≈ 0.19998 deg/ms
  const degreesPerMs = (rpm / 60) * (360 / 1000);

  // Sync target velocity whenever isPlaying changes.
  // Also restart the RAF loop if it self-terminated during pause coast-down.
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    targetVelocityRef.current = isPlaying ? degreesPerMs : 0;

    // Loop exits when velocity → ~0 AND !isPlaying (efficiency optimization).
    // When play resumes, we must kick it back off — nothing else will.
    if (isPlaying && rafRef.current === null) {
      lastTimestampRef.current = null; // reset timestamp so delta starts fresh
      rafRef.current = requestAnimationFrame(function tick(timestamp: number) {
        if (lastTimestampRef.current === null) {
          lastTimestampRef.current = timestamp;
        }
        const delta = Math.min(timestamp - lastTimestampRef.current, 50);
        lastTimestampRef.current = timestamp;

        const target = targetVelocityRef.current;
        const current = velocityRef.current;
        const lerpFactor = target > current ? 0.06 : 0.018;
        velocityRef.current = current + (target - current) * lerpFactor;
        rotationRef.current = (rotationRef.current + velocityRef.current * delta) % 360;

        const disc = document.getElementById("vinyl-disc");
        if (disc) {
          disc.style.transform = `rotate(${rotationRef.current}deg)`;
        }

        if (Math.abs(velocityRef.current) < 0.0001 && !isPlayingRef.current) {
          rafRef.current = null;
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      });
    }
  }, [isPlaying, degreesPerMs]);

  useEffect(() => {
    function tick(timestamp: number) {
      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = timestamp;
      }

      const delta = Math.min(timestamp - lastTimestampRef.current, 50); // cap at 50ms to prevent jump on tab restore
      lastTimestampRef.current = timestamp;

      const target = targetVelocityRef.current;
      const current = velocityRef.current;

      // Spin-up: fast lerp (~150ms to reach full speed)
      // Spin-down: slow lerp (~800ms inertia coast)
      const lerpFactor = target > current ? 0.06 : 0.018;
      velocityRef.current = current + (target - current) * lerpFactor;

      // Advance rotation angle
      rotationRef.current = (rotationRef.current + velocityRef.current * delta) % 360;

      // Apply directly to DOM — skip React reconciler entirely
      const disc = document.getElementById("vinyl-disc");
      if (disc) {
        disc.style.transform = `rotate(${rotationRef.current}deg)`;
      }

      // Stop RAF loop only when fully stopped and not playing
      if (Math.abs(velocityRef.current) < 0.0001 && !isPlayingRef.current) {
        rafRef.current = null;
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    // Kick off the loop (idempotent — guard against double-start)
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(tick);
    }

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        lastTimestampRef.current = null;
      }
    };
  // Only re-initialize the RAF loop when component mounts/unmounts
  // isPlaying changes are handled via the ref above
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

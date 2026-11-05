// src/lib/audio/vinylNoise.ts
// Synthesized vinyl surface noise: a soft hiss bed plus sparse ticks and pops.
// Generated in code, so it ships no audio files. It plays over the system's music
// and cannot process it: VinylDeck only reads media metadata, never the audio.

const HISS_SECONDS = 13;
const CRACKLE_SECONDS = 17; // Coprime with the hiss: the mix repeats only every 221s.
const LOOP_CROSSFADE_SECONDS = 0.25;

const TICKS_PER_SECOND = 7;
const POPS_PER_SECOND = 0.45;

const HISS_LEVEL = 0.1;
const CRACKLE_LEVEL = 0.42;
/** Master gain at 100% volume. Surface noise sits behind the music, never over it. */
const MAX_MASTER_GAIN = 0.5;

const FADE_IN_SECONDS = 0.5; // Needle settling into the groove.
const FADE_OUT_SECONDS = 0.12;
const SUSPEND_DELAY_MS = 800;

/** Small seeded PRNG (mulberry32), so generated noise is reproducible in tests. */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pink-leaning noise that loops without a click, peak-normalized to 1. */
export function generateHiss(
  length: number,
  sampleRate: number,
  random: () => number,
): Float32Array {
  const fade = Math.min(
    Math.floor(LOOP_CROSSFADE_SECONDS * sampleRate),
    Math.floor(length / 2),
  );
  const raw = new Float32Array(length + fade);

  // Paul Kellet's economy pink filter.
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let index = 0; index < raw.length; index += 1) {
    const white = random() * 2 - 1;
    b0 = 0.99765 * b0 + white * 0.099046;
    b1 = 0.963 * b1 + white * 0.2965164;
    b2 = 0.57 * b2 + white * 1.0526913;
    raw[index] = b0 + b1 + b2 + white * 0.1848;
  }

  // Blend the extra tail into the start, so the end flows back into the beginning.
  const samples = raw.slice(0, length);
  for (let index = 0; index < fade; index += 1) {
    const position = index / fade;
    samples[index] =
      samples[index] * position + raw[length + index] * (1 - position);
  }
  return normalize(samples);
}

/** Silence with scattered clicks. Clicks wrap around the end, so the loop is seamless. */
export function generateCrackle(
  length: number,
  sampleRate: number,
  random: () => number,
): Float32Array {
  const samples = new Float32Array(length);
  const seconds = length / sampleRate;

  const addClicks = (
    count: number,
    minDecayMs: number,
    maxDecayMs: number,
    minLevel: number,
    maxLevel: number,
  ) => {
    for (let click = 0; click < count; click += 1) {
      const start = Math.floor(random() * length);
      const decay =
        ((minDecayMs + random() * (maxDecayMs - minDecayMs)) / 1000) *
        sampleRate;
      // Squaring favors quiet clicks; a loud one stays an occasional event.
      const level = minLevel + random() ** 2 * (maxLevel - minLevel);
      const duration = Math.ceil(decay * 5);

      for (let offset = 0; offset < duration; offset += 1) {
        const envelope = Math.exp(-offset / decay);
        const noise = random() * 2 - 1;
        const index = (start + offset) % length;
        samples[index] += noise * envelope * level;
      }
    }
  };

  addClicks(Math.round(seconds * TICKS_PER_SECOND), 0.15, 0.7, 0.05, 0.3);
  addClicks(Math.round(seconds * POPS_PER_SECOND), 0.8, 3, 0.4, 1);
  return normalize(samples);
}

function normalize(samples: Float32Array): Float32Array {
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  if (peak > 0) {
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] /= peak;
    }
  }
  return samples;
}

/** Hearing is roughly logarithmic: squaring makes the slider feel even. */
export function volumeToGain(volumePercent: number): number {
  const clamped = Math.min(100, Math.max(0, volumePercent)) / 100;
  return clamped * clamped * MAX_MASTER_GAIN;
}

function createLoopBuffer(
  context: AudioContext,
  samples: Float32Array,
): AudioBuffer {
  const buffer = context.createBuffer(1, samples.length, context.sampleRate);
  buffer.getChannelData(0).set(samples);
  return buffer;
}

export interface VinylNoisePlayer {
  setActive(active: boolean): void;
  setVolume(volumePercent: number): void;
  dispose(): void;
}

/**
 * Nothing is allocated until the first activation, so users who leave the setting
 * off pay nothing. While inactive the context is suspended, which stops the audio
 * thread entirely.
 */
export function createVinylNoisePlayer(): VinylNoisePlayer {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let active = false;
  let volume = 0;
  let suspendTimer: ReturnType<typeof setTimeout> | undefined;

  function ensureGraph(): { context: AudioContext; master: GainNode } {
    if (context && master) return { context, master };

    const created = new AudioContext();
    const random = createRandom(0x51ea7);
    const rate = created.sampleRate;

    const output = created.createGain();
    output.gain.value = 0;
    output.connect(created.destination);

    // Worn-groove tone: no rumble, and the top end rolled off.
    const hiss = created.createBufferSource();
    hiss.buffer = createLoopBuffer(
      created,
      generateHiss(Math.round(HISS_SECONDS * rate), rate, random),
    );
    hiss.loop = true;
    const hissHighpass = created.createBiquadFilter();
    hissHighpass.type = "highpass";
    hissHighpass.frequency.value = 350;
    const hissLowpass = created.createBiquadFilter();
    hissLowpass.type = "lowpass";
    hissLowpass.frequency.value = 7000;
    const hissGain = created.createGain();
    hissGain.gain.value = HISS_LEVEL;
    hiss.connect(hissHighpass);
    hissHighpass.connect(hissLowpass);
    hissLowpass.connect(hissGain);
    hissGain.connect(output);

    const crackle = created.createBufferSource();
    crackle.buffer = createLoopBuffer(
      created,
      generateCrackle(Math.round(CRACKLE_SECONDS * rate), rate, random),
    );
    crackle.loop = true;
    const crackleHighpass = created.createBiquadFilter();
    crackleHighpass.type = "highpass";
    crackleHighpass.frequency.value = 900;
    const crackleGain = created.createGain();
    crackleGain.gain.value = CRACKLE_LEVEL;
    crackle.connect(crackleHighpass);
    crackleHighpass.connect(crackleGain);
    crackleGain.connect(output);

    hiss.start();
    crackle.start();

    context = created;
    master = output;
    return { context: created, master: output };
  }

  function rampTo(target: number, seconds: number) {
    if (!context || !master) return;
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(target, now + seconds);
  }

  function clearSuspendTimer() {
    if (suspendTimer !== undefined) clearTimeout(suspendTimer);
    suspendTimer = undefined;
  }

  return {
    setActive(next) {
      if (next === active) return;
      active = next;
      clearSuspendTimer();

      if (active) {
        const graph = ensureGraph();
        void graph.context.resume().catch((error) => {
          console.warn("[VinylNoise] Audio could not start:", error);
        });
        rampTo(volumeToGain(volume), FADE_IN_SECONDS);
        return;
      }

      rampTo(0, FADE_OUT_SECONDS);
      suspendTimer = setTimeout(() => {
        void context?.suspend().catch(() => {});
      }, SUSPEND_DELAY_MS);
    },

    setVolume(volumePercent) {
      volume = volumePercent;
      if (active) rampTo(volumeToGain(volume), 0.08);
    },

    dispose() {
      clearSuspendTimer();
      active = false;
      void context?.close().catch(() => {});
      context = null;
      master = null;
    },
  };
}

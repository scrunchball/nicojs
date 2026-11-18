/** The film clock and weave. All film motion steps at 24 fps, whatever the display refresh rate. */
export const FPS = 24;

export const frameAt = (ms: number) => Math.floor((ms / 1000) * FPS);

/** Deterministic hash of two ints to [0, 1). */
export function hash01(a: number, b: number): number {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export type WeaveSpec = {
  /** Slow drift amplitude (fraction of picture height for pictures, px for text). */
  drift: number;
  /** Drift period in seconds. */
  period: number;
  /** Per-frame jitter amplitude (same unit as drift). */
  jitter: number;
  /** Max rotation in degrees (pictures only). */
  rot?: number;
  /** Each layer gets its own seed so layers drift apart and back together. */
  seed: number;
};

export type WeaveOffset = { x: number; y: number; rot: number };

/** Gate weave for one layer at a given film frame. */
export function weave(s: WeaveSpec, frame: number): WeaveOffset {
  const t = frame / FPS;
  const w = (Math.PI * 2) / s.period;
  const k = s.seed;
  // two incommensurate sines per axis => smooth, non-repeating-looking drift, |sum| <= 1
  const dx = Math.sin(w * t + k * 1.7) * 0.65 + Math.sin(w * t * 2.63 + k * 4.1) * 0.35;
  const dy = Math.sin(w * t * 0.83 + k * 2.9) * 0.65 + Math.sin(w * t * 2.11 + k * 0.7) * 0.35;
  const jx = (hash01(frame, k * 7 + 1) - 0.5) * 2;
  const jy = (hash01(frame, k * 7 + 2) - 0.5) * 2;
  const jr = (hash01(frame, k * 7 + 3) - 0.5) * 2;
  const r = s.rot ?? 0;
  return {
    x: dx * s.drift + jx * s.jitter,
    y: dy * s.drift + jy * s.jitter,
    rot: (Math.sin(w * t * 0.61 + k) * 0.7 + jr * 0.3) * r,
  };
}

/** Defaults from the brief (Film engine > Weave). Tunable in /lab, later in the Projector global. */
export const WEAVE = {
  picture: { drift: 0.0025, period: 1.7, jitter: 0.0006, rot: 0.03, seed: 11 } as WeaveSpec,
  title: { drift: 0.8, period: 1.3, jitter: 0.3, seed: 23 } as WeaveSpec,
  subtitle: { drift: 0.5, period: 2.1, jitter: 0.2, seed: 37 } as WeaveSpec,
};

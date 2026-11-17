/**
 * Background motifs: one very quiet, slow ambient layer per section, so each scene has its own air.
 * Drawn on the picture canvas behind the pictures (no extra WebGL context), under the grain.
 * Kept below "noticed only when you look": a few % of luminance over Gate black, cycles of 10-60 s,
 * no flicker, no light leaks, no frames. Stops with PROYECTOR (time freezes) and under reduced motion.
 */
export type Motif = { mode: number; color: [number, number, number]; intensity: number };

export const MOTIFS: Record<string, Motif> = {
  // 1 safelight breath from below · 2 drifting haze · 3 rising embers · 4 slow upward bands · 5 tungsten pool
  opening: { mode: 2, color: [0.93, 0.9, 0.85], intensity: 0.05 }, // cool silver haze, as the portrait leaves
  statement: { mode: 1, color: [0.77, 0.16, 0.1], intensity: 0.16 }, // the darkroom: safelight breathing
  "what-else-is-there": { mode: 2, color: [0.9, 0.72, 0.48], intensity: 0.07 }, // a summer day's warm haze
  "by-the-fire": { mode: 3, color: [0.85, 0.36, 0.14], intensity: 0.09 }, // embers rising
  circuit: { mode: 4, color: [0.75, 0.72, 0.66], intensity: 0.06 }, // film passing upward, like the roll
  about: { mode: 5, color: [0.92, 0.66, 0.4], intensity: 0.08 }, // a pool of tungsten light
};

/**
 * Projector flicker (Adam's request, D-68): ambient, random shifts of the whole screen's lightness, like a
 * projector lamp and shutter that never quite settle. Three random parts, summed per film frame:
 *  - shimmer: a faint new value every frame
 *  - wander: a slow random walk that drifts lighter and darker
 *  - events: now and then (every ~1.5-8 s, irregular) a brief lift or dip over 2-7 frames
 * Output is a soft-light grey offset for the grain canvas. Kept far below flash thresholds (WCAG 2.3.1):
 * the largest frame-to-frame change is a few percent of luminance. Stops with PROYECTOR / reduced motion.
 */
export const FLICKER = {
  shimmer: 0.012, // +- per frame
  wanderStep: 0.004,
  wanderLimit: 0.03,
  eventMin: 0.025,
  eventMax: 0.06,
  limit: 0.08, // never more than this offset in total
};

export class Flicker {
  private wander = 0;
  private event = { amp: 0, len: 0, at: 0 };
  private nextEvent = 0;
  private last = -1;
  value = 0;

  /** Advance to film frame f (24 fps). Returns the offset for this frame. */
  step(f: number): number {
    if (f === this.last) return this.value;
    const frames = this.last < 0 ? 1 : Math.min(48, f - this.last);
    this.last = f;
    for (let i = 0; i < frames; i++) {
      this.wander += (Math.random() - 0.5) * 2 * FLICKER.wanderStep;
      this.wander *= 0.97; // drifts, but always comes home
      this.wander = Math.max(-FLICKER.wanderLimit, Math.min(FLICKER.wanderLimit, this.wander));
    }
    if (this.nextEvent === 0) this.nextEvent = f + Math.round(24 * (1.5 + Math.random() * 6.5));
    if (f >= this.nextEvent) {
      const amp = (FLICKER.eventMin + Math.random() * (FLICKER.eventMax - FLICKER.eventMin)) * (Math.random() < 0.55 ? -1 : 1);
      this.event = { amp, len: 2 + Math.floor(Math.random() * 6), at: f };
      // irregular gaps; sometimes a quick second one, like a splice going through the gate
      this.nextEvent = f + (Math.random() < 0.2 ? 3 + Math.floor(Math.random() * 6) : Math.round(24 * (1.5 + Math.random() * 6.5)));
    }
    let ev = 0;
    const into = f - this.event.at;
    if (into >= 0 && into < this.event.len) {
      const t = (into + 0.5) / this.event.len;
      ev = this.event.amp * Math.sin(Math.PI * t); // in and out, never a hard step
    }
    const shimmer = (Math.random() - 0.5) * 2 * FLICKER.shimmer;
    this.value = Math.max(-FLICKER.limit, Math.min(FLICKER.limit, shimmer + this.wander + ev));
    return this.value;
  }

  reset() { this.wander = 0; this.value = 0; this.last = -1; this.nextEvent = 0; this.event = { amp: 0, len: 0, at: 0 }; }
}

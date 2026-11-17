/**
 * The timeline (Stage 5). Compiles the screening's beats ([.frame-slot] in DOM order) into scroll ranges,
 * and evaluates what is on screen at any scroll position. Pure layout + maths: no rendering here.
 *
 * Holds (brief: Motion and the edit): pictures Short 40vh / Normal 60vh / Long 90vh; text 30-60vh; credit rolls
 * as long as their content (they move 1:1 with scroll);
 * rests of black between scenes 20-40vh. 1 film frame = 8 px of scroll; every change lands on a frame.
 */
export const PX_PER_FRAME = 8;
const ARRIVE_FRAMES = 6;
const LEAVE_FRAMES = 4;
const DEVELOP_SHARE = 0.45; // develop over the first 45% of the hold
const PUSH_IN = 0.04; // stills scale 1.00 -> 1.04 over the hold
const FADE_SHARE = 0.6; // a scene fades to black over the first 60% of its rest

const HOLD_VH: Record<string, number> = {
  short: 40, normal: 60, long: 90,
  "t-short": 30, "t-normal": 45, "t-long": 60, "t-triple": 135,
};

export type Beat = {
  index: number;
  slot: HTMLElement;
  frame: HTMLElement; // the pinned screen
  kind: "picture" | "text";
  shot: HTMLImageElement | HTMLVideoElement | null;
  /** Credit roll (Festival circuit): the track that moves up 1:1 with scroll, and its title's height. */
  roll: HTMLElement | null;
  rollTitle: number;
  /** Scene name (section data-scene) and where the scene starts, for its background motif. */
  scene: string;
  sceneStart: number;
  start: number; // px
  end: number; // px
  /** End of the black rest that follows (equals end when the next beat follows directly). */
  restEnd: number;
  /** Picture develops: first picture of a scene, or arriving after text/black. Cuts don't re-develop. */
  develops: boolean;
  lastInScene: boolean;
  red: boolean;
  /** A red screen followed by black: the whole screen goes down through black at the end of its hold. */
  fadeOut: boolean;
};

export type BeatState = {
  beat: Beat;
  /** 0..1 through the hold, quantised to film frames. */
  q: number;
  /** Text opacity (stepped arrive/leave), and the scene's fade to black during a rest. */
  opacity: number;
  /** Opacity of the whole screen, background included (1 except red screens fading to black). */
  screen: number;
  /** Picture: development progress (1 = developed), push-in zoom, fade. */
  develop: number;
  zoom: number;
  fade: number;
};

/** Scroll lengths scale down on smaller screens (brief: Responsive): tablet 85%, phone 70%. */
export function lengthScale(width: number) {
  return width < 810 ? 0.7 : width < 1200 ? 0.85 : 1;
}

export function compile(root: HTMLElement, vh: number, width: number): { beats: Beat[]; total: number } {
  const scale = lengthScale(width);
  const sections = Array.from(root.querySelectorAll<HTMLElement>("section.scene"));
  const beats: Beat[] = [];

  // 1. size every beat and every scene's rest
  for (const sec of sections) {
    const slots = Array.from(sec.querySelectorAll<HTMLElement>(".frame-slot"));
    slots.forEach((slot) => {
      let len = Math.round(((HOLD_VH[slot.dataset.hold ?? "normal"] ?? 60) * vh * scale) / 100 / PX_PER_FRAME) * PX_PER_FRAME;
      const roll = slot.querySelector<HTMLElement>("[data-roll]");
      if (roll) {
        // the title starts centred and the whole roll travels up and out of the top: 1:1 with scroll
        const title = roll.firstElementChild as HTMLElement | null;
        len = Math.round((roll.offsetHeight + vh * 0.5 + (title?.offsetHeight ?? 0) / 2) / PX_PER_FRAME) * PX_PER_FRAME;
      }
      slot.style.height = `${len}px`;
    });
    const rest = Number(sec.dataset.rest ?? 30);
    sec.style.paddingBottom = `${Math.round((rest * vh * scale) / 100 / PX_PER_FRAME) * PX_PER_FRAME}px`;
  }
  // the last screen needs one viewport of runway so its beat can play out at the bottom of the page
  root.style.paddingBottom = `${vh}px`;

  // 2. read the ranges back from layout
  const y0 = window.scrollY;
  for (const sec of sections) {
    const slots = Array.from(sec.querySelectorAll<HTMLElement>(".frame-slot"));
    const secRect = sec.getBoundingClientRect();
    const secEnd = Math.round(secRect.bottom + y0);
    const sceneStart = Math.round(secRect.top + y0);
    const scene = sec.dataset.scene ?? "";
    slots.forEach((slot, i) => {
      const r = slot.getBoundingClientRect();
      const kind = slot.dataset.beat === "picture" ? "picture" : "text";
      const roll = slot.querySelector<HTMLElement>("[data-roll]");
      const prev = beats[beats.length - 1];
      const firstInScene = i === 0;
      const last = i === slots.length - 1;
      const start = Math.round(r.top + y0);
      const end = Math.round(r.bottom + y0);
      beats.push({
        index: beats.length,
        slot,
        frame: slot.querySelector<HTMLElement>(":scope > .frame")!,
        kind,
        shot: slot.querySelector<HTMLImageElement | HTMLVideoElement>("[data-shot]"),
        roll,
        rollTitle: (roll?.firstElementChild as HTMLElement | null)?.offsetHeight ?? 0,
        scene,
        sceneStart,
        start,
        end,
        restEnd: last ? secEnd : end,
        develops: kind === "picture" && (firstInScene || !prev || prev.kind !== "picture"),
        lastInScene: last,
        red: slot.querySelector(".frame--red") !== null,
        fadeOut: false,
      });
    });
  }
  beats.forEach((b, i) => { b.fadeOut = b.red && !beats[i + 1]?.red; });
  return { beats, total: document.documentElement.scrollHeight };
}

/** Which beat is on screen at scroll y (quantised to film frames), and how far through it we are. */
export function evaluate(beats: Beat[], scrollY: number, reduced: boolean): BeatState | null {
  const y = Math.floor(Math.max(0, scrollY) / PX_PER_FRAME) * PX_PER_FRAME;
  // binary search for the last beat starting at or before y
  let lo = 0, hi = beats.length - 1, idx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (beats[mid].start <= y) { idx = mid; lo = mid + 1; } else hi = mid - 1;
  }
  if (idx < 0) return null;
  const b = beats[idx];
  if (y >= b.restEnd) return null; // past this scene's rest: black
  const len = Math.max(1, b.end - b.start);

  if (y >= b.end) {
    // in the black rest after the scene: the last beat goes down through black in stepped frames
    const restLen = Math.max(1, b.restEnd - b.end);
    const fadeLen = restLen * FADE_SHARE;
    const fade = reduced ? 0 : Math.max(0, 1 - Math.floor((y - b.end) / PX_PER_FRAME) * PX_PER_FRAME / fadeLen);
    if (fade <= 0) return null;
    return { beat: b, q: 1, opacity: fade, screen: 1, develop: 1, zoom: 1 + PUSH_IN, fade };
  }

  const q = (y - b.start) / len;
  const framesIn = Math.floor((y - b.start) / PX_PER_FRAME);
  const framesLeft = Math.floor((b.end - y) / PX_PER_FRAME);
  let opacity = 1;
  if (!reduced && b.index > 0) {
    opacity = Math.min(1, framesIn / ARRIVE_FRAMES);
    // text leaves in 4 frames when a beat follows directly; the scene's last beat fades through the rest instead
    if (b.kind === "text" && !b.lastInScene) opacity = Math.min(opacity, framesLeft / LEAVE_FRAMES);
  }
  const develop = b.develops && !reduced ? Math.min(1, q / DEVELOP_SHARE) : 1;
  // red -> black: the screen goes down through black in stepped frames over the last 35% of the hold
  let screen = 1;
  if (b.fadeOut && !reduced && q > 0.65) screen = Math.max(0, 1 - Math.floor((q - 0.65) * len / PX_PER_FRAME) * PX_PER_FRAME / (0.35 * len));
  const zoom = b.shot instanceof HTMLImageElement && !reduced ? 1 + PUSH_IN * q : 1;
  return { beat: b, q, opacity, screen, develop, zoom, fade: 1 };
}

/** HH:MM:SS:FF at 24 fps for a scroll position. */
export function timecode(scrollY: number) {
  const f = Math.floor(Math.max(0, scrollY) / PX_PER_FRAME);
  const ff = f % 24, s = Math.floor(f / 24), ss = s % 60, m = Math.floor(s / 60), mm = m % 60, hh = Math.floor(m / 60);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(hh)}:${p(mm)}:${p(ss)}:${p(ff)}`;
}

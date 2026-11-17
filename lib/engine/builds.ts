/**
 * Title builds (Stage 6). Applied only in film mode; the server markup stays plain text, and teardown
 * restores it exactly. Screen readers get the whole text from aria-label; the letter spans are aria-hidden.
 *
 * - print: letters expose one by one in an uneven order over N film frames, as if each letter were printed
 *   separately on the optical printer: each lands in two stepped frames with a tiny registration offset
 *   that settles. (Nico's name: 18 frames on the opening's clock; titles: on scroll.)
 * - late: the italic word arrives last and holds longest (the rest of the phrase leaves before it).
 * - words: groups set one per beat (the end title, word by word over 3 beats).
 */
import { hash01 } from "./film";

export type BuildKind = "print" | "late" | "words";

export type Build = {
  el: HTMLElement;
  kind: BuildKind;
  units: HTMLElement[];
  /** print: the film frame (0..frames) at which each letter exposes. */
  at: number[];
  frames: number;
  restore: () => void;
};

const NBSP = /\s/;

function seededOrder(n: number, frames: number, seed: number): number[] {
  // uneven exposure order: shuffle the letters, then give them irregular gaps that fill `frames`
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(hash01(i, seed) * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const gaps = idx.map((_, k) => 0.35 + hash01(k, seed + 7) * 1.3);
  const total = gaps.reduce((a, b) => a + b, 0);
  const at = new Array<number>(n);
  let t = 0;
  idx.forEach((letter, k) => { at[letter] = Math.min(frames - 2, Math.floor((t / total) * (frames - 2))); t += gaps[k]; });
  return at;
}

/** Wrap every non-space character in a span, keeping inline structure such as <em>. */
function splitLetters(root: HTMLElement): HTMLElement[] {
  const units: HTMLElement[] = [];
  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        for (const ch of child.textContent ?? "") {
          if (NBSP.test(ch)) { frag.appendChild(document.createTextNode(ch)); continue; }
          const s = document.createElement("span");
          s.className = "ltr";
          s.textContent = ch;
          frag.appendChild(s);
          units.push(s);
        }
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child);
      }
    }
  };
  walk(root);
  return units;
}

export function prepareBuilds(root: HTMLElement): Build[] {
  const builds: Build[] = [];
  root.querySelectorAll<HTMLElement>("[data-build]").forEach((el, n) => {
    const kind = el.dataset.build as BuildKind;
    const html = el.innerHTML;
    const label = el.textContent?.replace(/\s+/g, " ").trim() ?? "";
    const restore = () => {
      el.innerHTML = html;
      el.removeAttribute("aria-label");
      el.style.removeProperty("--late-rest");
    };
    el.setAttribute("aria-label", label);
    if (kind === "print") {
      const frames = Number(el.dataset.frames ?? 14);
      const units = splitLetters(el);
      units.forEach((u) => u.setAttribute("aria-hidden", "true"));
      builds.push({ el, kind, units, at: seededOrder(units.length, frames, 101 + n * 13), frames, restore });
    } else if (kind === "late") {
      // everything outside the <em> becomes the "rest" of the phrase
      const units: HTMLElement[] = [];
      for (const child of Array.from(el.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE && child.textContent) {
          const s = document.createElement("span");
          s.className = "late-rest";
          s.textContent = child.textContent;
          s.setAttribute("aria-hidden", "true");
          child.replaceWith(s);
        }
      }
      const word = el.querySelector<HTMLElement>("em");
      word?.setAttribute("aria-hidden", "true");
      el.querySelectorAll<HTMLElement>(".late-rest").forEach((s) => units.push(s));
      if (word) units.push(word);
      builds.push({ el, kind, units, at: [], frames: 0, restore });
    } else if (kind === "words") {
      const units = Array.from(el.querySelectorAll<HTMLElement>("[data-word]"));
      units.forEach((u) => u.setAttribute("aria-hidden", "true"));
      builds.push({ el, kind, units, at: [], frames: 0, restore });
    }
  });
  return builds;
}

const step = (frames: number, over: number) => Math.max(0, Math.min(1, Math.floor(frames) / over));

/**
 * Show a build at `f` film frames into its clock (Infinity = complete). `q` is the beat's progress (0..1) and
 * `beatFrames` its length in film frames, so thresholds inside the beat still step on whole film frames.
 */
export function applyBuild(b: Build, f: number, q: number, beatFrames: number) {
  if (b.kind === "print") {
    b.units.forEach((u, i) => {
      const d = f - b.at[i];
      const o = d < 0 ? 0 : d < 1 ? 0.55 : 1;
      u.style.opacity = o === 1 ? "" : String(o);
      // registration: each letter lands slightly off and settles over 3 frames
      if (d >= 0 && d < 3) {
        const k = (3 - d) / 3;
        u.style.transform = `translate(${((hash01(i, 77) - 0.5) * 1.4 * k).toFixed(2)}px, ${((hash01(i, 78) - 0.5) * 1.4 * k).toFixed(2)}px)`;
      } else if (u.style.transform) {
        u.style.transform = "";
      }
    });
  } else if (b.kind === "late") {
    // rest: arrives with the beat, leaves from 72% over 4 frames. Italic word: arrives at 30% over 6 frames.
    const restOut = q >= 0.72 ? 1 - step((q - 0.72) * beatFrames, 4) : 1;
    const wordIn = q >= 0.3 ? step((q - 0.3) * beatFrames, 6) : 0;
    b.units.forEach((u) => {
      const o = u.tagName === "EM" ? wordIn : restOut;
      u.style.opacity = f === Infinity ? "" : String(o);
    });
  } else if (b.kind === "words") {
    // group k sets at k/n of the hold, over 6 frames
    const n = b.units.length;
    b.units.forEach((u, k) => {
      const start = k / n;
      const o = f === Infinity ? 1 : q >= start ? step((q - start) * beatFrames, 6) : 0;
      u.style.opacity = o === 1 ? "" : String(o);
    });
  }
}

export function completeBuild(b: Build) {
  for (const u of b.units) { u.style.opacity = ""; u.style.transform = ""; }
}

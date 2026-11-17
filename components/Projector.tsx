"use client";

/**
 * The Projector (Stage 4): runs the film engine on the real page.
 *
 * - Two WebGL contexts for the whole site: the picture canvas (behind the text) and the grain canvas
 *   (over everything, interface included).
 * - Every picture slot is a real server-rendered <img>/<video> ([data-shot]). The Projector streams each
 *   slot's texture in as it approaches the viewport, draws it at the slot's on-screen rect, and only then
 *   fades the DOM element out, so a slot is never blank: until the canvas has it, the DOM shows it.
 * - Text groups ([data-weave]) weave on their own seeds with CSS transforms; the chrome never weaves.
 * - Context loss: the DOM pictures come back instantly, and the engine rebuilds on restore.
 * - No WebGL2, or an engine error: nothing changes, the DOM page (fallback levels 3 and 5) stays.
 */
import { useEffect, useRef } from "react";
import type * as T from "three";
import { FPS, WEAVE, frameAt, weave } from "@/lib/engine/film";
import type { PictureEngine, Slot as DrawSlot } from "@/lib/engine/picture";
import type { GrainEngine } from "@/lib/engine/grain";

const CONFIG = {
  grain: { strength: 0.06, density: 2, scale: 1 },
  dye: 0.03,
  openingBlackMs: 1000, // black and grain for 1 s on load
  openingDevelopMs: 2500, // then the portrait develops on a 2.5 s timer
  nearMargin: "150% 0px", // start streaming a texture 1.5 viewports ahead
  farMargin: "400% 0px", // free it beyond 4 viewports
};

type SlotState = {
  el: HTMLImageElement | HTMLVideoElement;
  id: string;
  full: boolean;
  kind: "image" | "clip";
  timer: boolean;
  near: boolean;
  visible: boolean;
  loading: boolean;
  tex: T.Texture | null;
  aspect: number;
  drawn: boolean;
  developStart: number; // ms, opening portrait only
};

export function Projector() {
  const picRef = useRef<HTMLCanvasElement>(null);
  const grainRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const done = () => root.classList.remove("projector-pending");
    if (!("WebGL2RenderingContext" in window) || !picRef.current || !grainRef.current) { done(); return; }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const phone = window.matchMedia("(max-width: 809px)").matches;
    const maxDpr = phone ? 1.5 : 2;
    const grainFps = phone ? 12 : FPS;
    const pageStart = performance.now();

    let pic: PictureEngine | null = null;
    let grain: GrainEngine | null = null;
    let THREE: typeof import("three") | null = null;
    let raf = 0;
    let disposed = false;
    let lost = false;
    let lastFilm = -1;
    let lastScroll = -1;
    let lastW = 0, lastH = 0;

    const slots: SlotState[] = Array.from(document.querySelectorAll<HTMLImageElement | HTMLVideoElement>("[data-shot]")).map((el) => ({
      el,
      id: el.dataset.shot!,
      full: el.dataset.mode === "full",
      kind: el instanceof HTMLVideoElement ? "clip" : "image",
      timer: el.dataset.develop === "timer" && !reduced,
      near: false, visible: false, loading: false, tex: null,
      aspect: (Number(el.getAttribute("width")) || 16) / (Number(el.getAttribute("height")) || 9),
      drawn: false, developStart: -1,
    }));
    const byEl = new Map<Element, SlotState>(slots.map((s) => [s.el, s]));
    const weavers = Array.from(document.querySelectorAll<HTMLElement>("[data-weave]"));

    const release = (s: SlotState) => {
      s.tex?.dispose();
      s.tex = null;
      s.drawn = false;
      s.loading = false;
      delete s.el.dataset.ready;
      if (s.el instanceof HTMLVideoElement) s.el.pause();
    };

    const prepare = async (s: SlotState) => {
      if (s.tex || s.loading || !pic || lost) return;
      s.loading = true;
      try {
        if (s.el instanceof HTMLVideoElement) {
          if (reduced) { s.loading = false; return; } // the poster stays in the DOM
          const v = s.el;
          v.preload = "auto";
          if (v.readyState < 2) {
            v.load();
            await new Promise<void>((res, rej) => {
              v.addEventListener("loadeddata", () => res(), { once: true });
              v.addEventListener("error", () => rej(new Error(`clip failed: ${v.currentSrc}`)), { once: true });
            });
          }
          if (!s.near || !pic) { s.loading = false; return; }
          s.aspect = v.videoWidth / v.videoHeight || s.aspect;
          s.tex = pic.createTexture(v);
          if (s.visible) v.play().catch(() => {});
        } else {
          const img = s.el;
          img.loading = "eager";
          if (!img.complete || !img.naturalWidth) await img.decode();
          else await img.decode().catch(() => {});
          if (!s.near || !pic) { s.loading = false; return; }
          s.aspect = img.naturalWidth / img.naturalHeight || s.aspect;
          s.tex = pic.createTexture(img);
          pic.upload(s.tex);
        }
      } catch (e) {
        console.warn("[projector]", e); // the DOM element keeps showing this shot
      }
      s.loading = false;
    };

    const near = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const s = byEl.get(e.target)!;
        if (e.isIntersecting) { s.near = true; prepare(s); }
      }
    }, { rootMargin: CONFIG.nearMargin });
    const far = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const s = byEl.get(e.target)!;
        if (!e.isIntersecting) { s.near = false; release(s); }
      }
    }, { rootMargin: CONFIG.farMargin });
    const vis = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const s = byEl.get(e.target)!;
        s.visible = e.isIntersecting;
        if (s.el instanceof HTMLVideoElement && s.tex) {
          if (s.visible) s.el.play().catch(() => {}); else s.el.pause();
        }
      }
    }, { rootMargin: "10% 0px" });

    const progressOf = (s: SlotState, now: number) => {
      if (!s.timer) return 1;
      if (s.developStart < 0) s.developStart = Math.max(now, pageStart + CONFIG.openingBlackMs);
      return Math.min(1, Math.max(0, (now - s.developStart) / CONFIG.openingDevelopMs));
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!pic || !grain || lost) return;
      const film = frameAt(now);
      const filmTick = film !== lastFilm;
      const scrolled = window.scrollY !== lastScroll;
      const w = window.innerWidth, h = window.innerHeight;
      if (w !== lastW || h !== lastH) { pic.resize(); grain.resize(); lastW = w; lastH = h; }

      const draw: DrawSlot[] = [];
      let moving = false;
      for (const s of slots) {
        if (!s.visible || !s.tex) continue;
        const r = s.el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > h || r.width === 0) continue;
        const progress = progressOf(s, now);
        if (progress < 1 || s.kind === "clip") moving = true;
        if (s.timer && now < s.developStart) continue; // opening: black and grain first
        draw.push({
          tex: s.tex, aspect: s.aspect, rect: { x: r.left, y: r.top, w: r.width, h: r.height }, full: s.full,
          weave: reduced ? { x: 0, y: 0, rot: 0 } : weave(WEAVE.picture, film),
          progress, develop: progress < 1, dye: CONFIG.dye,
        });
      }

      // The picture canvas follows scroll every display frame; weave and grain step on film frames.
      if (scrolled || filmTick || moving) {
        pic.frame(draw);
        for (const s of slots) {
          if (s.tex && s.visible && !s.drawn && draw.some((d) => d.tex === s.tex)) {
            s.drawn = true;
            s.el.dataset.ready = "1"; // the canvas has it now: fade the DOM picture out
            if (s.timer) done();
          }
        }
      }
      if (filmTick && (film % (FPS / grainFps) === 0 || grainFps === FPS)) {
        grain.render(film, { ...CONFIG.grain, still: reduced });
      }
      if (filmTick && !reduced) {
        const tw = weave(WEAVE.title, film), sw = weave(WEAVE.subtitle, film);
        for (const el of weavers) {
          const o = el.dataset.weave === "title" ? tw : sw;
          el.style.transform = `translate3d(${o.x.toFixed(2)}px, ${o.y.toFixed(2)}px, 0)`;
        }
      }
      lastFilm = film;
      lastScroll = window.scrollY;
    };

    const init = async () => {
      try {
        THREE = THREE ?? (await import("three"));
        const { PictureEngine } = await import("@/lib/engine/picture");
        const { GrainEngine } = await import("@/lib/engine/grain");
        if (disposed || !picRef.current || !grainRef.current) return;
        pic = new PictureEngine(THREE, picRef.current, maxDpr);
        grain = new GrainEngine(THREE, grainRef.current, maxDpr);
        await grain.load(CONFIG.grain.density);
        if (disposed) return;
        lost = false;
        lastFilm = -1; lastScroll = -1; lastW = 0;
        root.classList.add("projector-on");
        for (const s of slots) { near.observe(s.el); far.observe(s.el); vis.observe(s.el); }
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(loop);
        (window as unknown as { __projector?: object }).__projector = { slots, contexts: 2 };
      } catch (e) {
        console.warn("[projector] engine unavailable, keeping the DOM page", e);
        teardown();
      }
    };

    const teardown = () => {
      cancelAnimationFrame(raf);
      near.disconnect(); far.disconnect(); vis.disconnect();
      for (const s of slots) release(s);
      for (const el of weavers) el.style.transform = "";
      pic?.dispose(); grain?.dispose();
      pic = null; grain = null;
      root.classList.remove("projector-on");
      done();
    };

    // Context loss: show the DOM pictures again right away, rebuild when the browser restores the context.
    const onLost = (e: Event) => {
      e.preventDefault();
      lost = true;
      for (const s of slots) release(s);
      root.classList.remove("projector-on");
      done();
    };
    const onRestored = () => { teardown(); init(); };
    const canvases = [picRef.current, grainRef.current];
    for (const c of canvases) {
      c.addEventListener("webglcontextlost", onLost);
      c.addEventListener("webglcontextrestored", onRestored);
    }

    init();
    return () => {
      disposed = true;
      for (const c of canvases) {
        c.removeEventListener("webglcontextlost", onLost);
        c.removeEventListener("webglcontextrestored", onRestored);
      }
      teardown();
    };
  }, []);

  return (
    <>
      <canvas ref={picRef} className="projector-canvas projector-picture" aria-hidden="true" />
      <canvas ref={grainRef} className="projector-canvas projector-grain" aria-hidden="true" />
    </>
  );
}

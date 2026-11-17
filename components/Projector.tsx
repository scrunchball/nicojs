"use client";

/**
 * The Projector: runs the film on the real page (Stages 4 and 5).
 *
 * - Two WebGL contexts for the whole site: the picture canvas (behind the text) and the grain canvas
 *   (over everything, interface included).
 * - Film mode (html.film): every beat ([.frame-slot]) becomes a spacer as tall as its scroll length and
 *   its screen (.frame) is pinned. The timeline (lib/engine/timeline.ts) says which beat is on screen;
 *   pictures cut, develop, push in and fade to black; clips scrub; text arrives and leaves in stepped
 *   film frames. Scrolling back runs the film in reverse. 1 film frame = 8 px of scroll.
 * - Lenis gives inertia scrolling (off under reduced motion). The canvases are fixed and read the timeline.
 * - Every picture is a real <img>/<video> in the DOM. Textures stream in for beats near the playhead and
 *   the DOM picture fades out only once the canvas has drawn it, so a shot is never blank.
 * - PROYECTOR in the projector line stops all automatic motion (weave, grain, timers) for anyone.
 * - No WebGL2 or an engine error: nothing changes, the plain DOM page stays (fallback levels 3 and 5).
 */
import { useEffect, useRef } from "react";
import type * as T from "three";
import { FPS, WEAVE, frameAt, weave } from "@/lib/engine/film";
import type { PictureEngine } from "@/lib/engine/picture";
import type { GrainEngine } from "@/lib/engine/grain";
import { PX_PER_FRAME, compile, evaluate, timecode, type Beat } from "@/lib/engine/timeline";

const CONFIG = {
  grain: { strength: 0.06, density: 2, scale: 1 },
  dye: 0.03,
  openingBlackMs: 1000, // black and grain for 1 s on load
  openingDevelopMs: 2500, // then the portrait develops on a 2.5 s timer
  nearAhead: 3, // viewports ahead of the playhead to stream textures
  nearBehind: 1.5,
  farAhead: 6, // free textures beyond these
  farBehind: 4,
  lerp: 0.09,
};

type ShotState = {
  el: HTMLImageElement | HTMLVideoElement;
  beat: Beat;
  timer: boolean;
  loading: boolean;
  tex: T.Texture | null;
  aspect: number;
  duration: number;
  drawn: boolean;
  developStart: number;
};

export function Projector() {
  const picRef = useRef<HTMLCanvasElement>(null);
  const grainRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const main = document.querySelector<HTMLElement>("main");
    const pending = () => root.classList.remove("projector-pending");
    if (!("WebGL2RenderingContext" in window) || !picRef.current || !grainRef.current || !main) { pending(); return; }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const phone = window.matchMedia("(max-width: 809px)").matches;
    const maxDpr = phone ? 1.5 : 2;
    const grainFps = phone ? 12 : FPS;
    const pageStart = performance.now();

    let motion = !reduced;
    try { if (sessionStorage.getItem("projector") === "off") motion = false; } catch {}

    let pic: PictureEngine | null = null;
    let grain: GrainEngine | null = null;
    let THREE: typeof import("three") | null = null;
    let lenis: import("lenis").default | null = null;
    let raf = 0;
    let disposed = false;
    let lost = false;
    let beats: Beat[] = [];
    let shots: ShotState[] = [];
    let active: Beat | null = null;
    let lastFilm = -1, lastY = -1, lastW = 0, lastH = 0, lastTc = -1;
    let dirty = true;
    let resizeTimer = 0;

    const tcEl = document.querySelector<HTMLElement>("[data-timecode]");
    const toggle = document.querySelector<HTMLButtonElement>("[data-projector-toggle]");
    const dot = document.querySelector<HTMLElement>("[data-projector-dot]");
    const syncToggle = () => {
      toggle?.setAttribute("aria-pressed", String(motion));
      if (dot) dot.textContent = motion ? "●" : "○";
    };

    /* ---------- textures ---------- */

    const release = (s: ShotState) => {
      if (s.el instanceof HTMLVideoElement && s.el.src.startsWith("blob:")) {
        URL.revokeObjectURL(s.el.src);
        s.el.removeAttribute("src"); // back to the poster until it's near again
        s.el.load();
      }
      s.tex?.dispose();
      s.tex = null;
      s.drawn = false;
      s.loading = false;
      delete s.el.dataset.ready;
    };

    const prepare = async (s: ShotState) => {
      if (s.tex || s.loading || !pic || lost) return;
      s.loading = true;
      try {
        if (s.el instanceof HTMLVideoElement) {
          if (reduced) { s.loading = false; return; } // no scrubbing: the poster stays in the DOM
          const v = s.el;
          const scrub = v.dataset.scrub;
          if (scrub && !v.src.startsWith("blob:")) {
            // All-intra encode for frame-accurate seeking, held in memory as a blob: seeking then never depends on
            // the server honouring range requests (Cloudflare Pages may answer 200 with the whole file).
            const res = await fetch(scrub);
            if (!res.ok) throw new Error(`scrub clip ${res.status}: ${scrub}`);
            const url = URL.createObjectURL(await res.blob());
            if (!s.beat.slot.dataset.near) { URL.revokeObjectURL(url); s.loading = false; return; }
            v.src = url;
          }
          v.preload = "auto";
          v.pause();
          if (v.readyState < 2) {
            v.load();
            await new Promise<void>((res, rej) => {
              v.addEventListener("loadeddata", () => res(), { once: true });
              v.addEventListener("error", () => rej(new Error(`clip failed: ${v.currentSrc}`)), { once: true });
            });
          }
          if (!pic || !s.beat.slot.dataset.near) { s.loading = false; return; }
          s.aspect = v.videoWidth / v.videoHeight || s.aspect;
          s.duration = v.duration || 0;
          const tex = pic.createTexture(v);
          v.addEventListener("seeked", () => { tex.needsUpdate = true; dirty = true; });
          s.tex = tex;
        } else {
          const img = s.el;
          img.loading = "eager";
          if (!img.complete || !img.naturalWidth) await img.decode();
          else await img.decode().catch(() => {});
          if (!pic || !s.beat.slot.dataset.near) { s.loading = false; return; }
          s.aspect = img.naturalWidth / img.naturalHeight || s.aspect;
          s.tex = pic.createTexture(img);
          pic.upload(s.tex);
        }
        dirty = true;
      } catch (e) {
        console.warn("[projector]", e); // the DOM element keeps showing this shot
      }
      s.loading = false;
    };

    /** Stream textures for beats near the playhead; free the far ones. */
    const stream = (y: number, vh: number) => {
      for (const s of shots) {
        const b = s.beat;
        const near = b.end > y - CONFIG.nearBehind * vh && b.start < y + CONFIG.nearAhead * vh;
        const far = b.end < y - CONFIG.farBehind * vh || b.start > y + CONFIG.farAhead * vh;
        if (near) {
          if (!b.slot.dataset.near) b.slot.dataset.near = "1";
          prepare(s);
        } else if (far && (s.tex || b.slot.dataset.near)) {
          delete b.slot.dataset.near;
          release(s);
        }
      }
    };

    /* ---------- the film ---------- */

    const build = () => {
      const vh = window.innerHeight;
      // keep the playhead on the same beat through a resize
      const prev = active ? { i: active.index, q: (window.scrollY - active.start) / Math.max(1, active.end - active.start) } : null;
      const out = compile(main, vh, window.innerWidth);
      beats = out.beats;
      const old = new Map(shots.map((s) => [s.el, s]));
      shots = beats.filter((b) => b.shot).map((b) => {
        const s = old.get(b.shot!);
        if (s) { s.beat = b; return s; }
        return {
          el: b.shot!, beat: b, timer: b.shot!.dataset.develop === "timer", loading: false, tex: null,
          aspect: (Number(b.shot!.getAttribute("width")) || 16) / (Number(b.shot!.getAttribute("height")) || 9),
          duration: 0, drawn: false, developStart: -1,
        };
      });
      if (prev && beats[prev.i]) {
        const b = beats[prev.i];
        const y = b.start + prev.q * (b.end - b.start);
        lenis ? lenis.scrollTo(y, { immediate: true }) : window.scrollTo(0, y);
      }
      dirty = true;
    };

    const setActive = (b: Beat | null) => {
      if (b === active) return;
      if (active) { delete active.slot.dataset.active; active.frame.style.opacity = ""; }
      active = b;
      if (b) b.slot.dataset.active = "1";
      root.classList.toggle("on-red", !!b?.red);
    };

    const timerProgress = (s: ShotState, now: number) => {
      if (!motion) return 1;
      if (s.developStart < 0) s.developStart = Math.max(now, pageStart + CONFIG.openingBlackMs);
      return Math.min(1, Math.max(0, (now - s.developStart) / CONFIG.openingDevelopMs));
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!pic || !grain || lost) return;
      lenis?.raf(now);
      const y = window.scrollY;
      const vw = window.innerWidth, vh = window.innerHeight;
      if (vw !== lastW || vh !== lastH) {
        pic.resize(); grain.resize();
        const big = vw !== lastW || Math.abs(vh - lastH) > 120; // ignore mobile browser bars
        lastW = vw; lastH = vh;
        if (big) { clearTimeout(resizeTimer); resizeTimer = window.setTimeout(build, 150); }
      }
      const film = frameAt(now);
      const filmTick = film !== lastFilm;
      const yFrame = Math.floor(y / PX_PER_FRAME);
      const moved = yFrame !== Math.floor(lastY / PX_PER_FRAME) || lastY < 0;
      if (moved) stream(y, vh);

      const st = evaluate(beats, y, !motion || reduced);
      setActive(st?.beat ?? null);
      if (st) st.beat.frame.style.opacity = String(st.opacity);

      if (tcEl && yFrame !== lastTc) { tcEl.textContent = timecode(y); lastTc = yFrame; }

      // picture
      const shot = st?.beat.shot ? shots.find((s) => s.el === st.beat.shot) : undefined;
      const timerRunning = !!shot?.timer && shot.tex !== null && timerProgress(shot, now) < 1;
      if (moved || filmTick || dirty || timerRunning) {
        const draw = [];
        if (st && shot?.tex) {
          let develop = st.develop;
          let hold = false;
          if (shot.timer) { develop = timerProgress(shot, now); hold = now < shot.developStart; }
          if (shot.el instanceof HTMLVideoElement && shot.duration) {
            const t = Math.min(shot.duration - 1 / FPS, st.q * shot.duration); // holds the last frame
            if (Math.abs(shot.el.currentTime - t) > 0.5 / FPS) shot.el.currentTime = t;
          }
          const r = shot.el.getBoundingClientRect();
          if (!hold && r.width > 0) {
            draw.push({
              tex: shot.tex, aspect: shot.aspect, rect: { x: r.left, y: r.top, w: r.width, h: r.height },
              full: shot.el.dataset.mode === "full",
              weave: motion ? weave(WEAVE.picture, film) : { x: 0, y: 0, rot: 0 },
              progress: develop, develop: develop < 1, dye: CONFIG.dye, zoom: st.zoom, fade: st.fade,
            });
          }
        }
        pic.frame(draw);
        if (draw.length && shot && !shot.drawn) {
          shot.drawn = true;
          shot.el.dataset.ready = "1"; // the canvas has it now: fade the DOM picture out
        }
        if (shot?.timer && shot.drawn) pending();
        dirty = false;
      }

      if (filmTick) {
        if (film % Math.round(FPS / grainFps) === 0) grain.render(film, { ...CONFIG.grain, still: !motion });
        if (active) {
          const tw = motion ? weave(WEAVE.title, film) : { x: 0, y: 0 }, sw = motion ? weave(WEAVE.subtitle, film) : { x: 0, y: 0 };
          for (const el of active.frame.querySelectorAll<HTMLElement>("[data-weave]")) {
            const o = el.dataset.weave === "title" ? tw : sw;
            el.style.transform = motion ? `translate3d(${o.x.toFixed(2)}px, ${o.y.toFixed(2)}px, 0)` : "";
          }
        }
      }
      lastFilm = film;
      lastY = y;
    };

    /* ---------- interaction ---------- */

    const onToggle = () => {
      motion = !motion && !reduced ? true : false;
      try { sessionStorage.setItem("projector", motion ? "on" : "off"); } catch {}
      syncToggle();
      dirty = true;
    };
    // Keyboard: focusing a link in a beat that isn't playing moves the film to that beat.
    const onFocus = (e: FocusEvent) => {
      const slot = (e.target as HTMLElement).closest<HTMLElement>(".frame-slot");
      const b = slot && beats.find((x) => x.slot === slot);
      if (b && b !== active) {
        const y = b.start + PX_PER_FRAME * 8;
        lenis ? lenis.scrollTo(y, { immediate: true }) : window.scrollTo(0, y);
      }
    };

    /* ---------- lifecycle ---------- */

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
        if (!reduced && !lenis) {
          const { default: Lenis } = await import("lenis");
          lenis = new Lenis({ lerp: CONFIG.lerp, anchors: true, autoRaf: false });
        }
        lost = false;
        root.classList.add("projector-on", "film");
        build();
        lastFilm = -1; lastY = -1; lastW = window.innerWidth; lastH = window.innerHeight; dirty = true;
        syncToggle();
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(loop);
        (window as unknown as { __projector?: object }).__projector = {
          get beats() { return beats; }, get shots() { return shots; }, get active() { return active; }, contexts: 2,
        };
      } catch (e) {
        console.warn("[projector] engine unavailable, keeping the DOM page", e);
        teardown();
      }
    };

    const teardown = () => {
      cancelAnimationFrame(raf);
      clearTimeout(resizeTimer);
      for (const s of shots) release(s);
      setActive(null);
      for (const b of beats) { b.slot.style.height = ""; b.frame.style.opacity = ""; delete b.slot.dataset.near; }
      for (const sec of main.querySelectorAll<HTMLElement>("section.scene")) sec.style.paddingBottom = "";
      main.style.paddingBottom = "";
      for (const el of main.querySelectorAll<HTMLElement>("[data-weave]")) el.style.transform = "";
      pic?.dispose(); grain?.dispose();
      pic = null; grain = null;
      lenis?.destroy(); lenis = null;
      root.classList.remove("projector-on", "film", "on-red");
      pending();
    };

    // Context loss: the plain page comes back at once; the engine rebuilds when the context is restored.
    const onLost = (e: Event) => { e.preventDefault(); lost = true; teardown(); };
    const onRestored = () => { teardown(); init(); };
    const canvases = [picRef.current, grainRef.current];
    for (const c of canvases) {
      c.addEventListener("webglcontextlost", onLost);
      c.addEventListener("webglcontextrestored", onRestored);
    }
    toggle?.addEventListener("click", onToggle);
    document.addEventListener("focusin", onFocus);

    init();
    return () => {
      disposed = true;
      for (const c of canvases) {
        c.removeEventListener("webglcontextlost", onLost);
        c.removeEventListener("webglcontextrestored", onRestored);
      }
      toggle?.removeEventListener("click", onToggle);
      document.removeEventListener("focusin", onFocus);
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

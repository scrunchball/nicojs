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
import { FPS, WEAVE, frameAt, weave } from "@/lib/engine/film";
import type { PictureEngine } from "@/lib/engine/picture";
import type { Tex } from "@/lib/engine/gl";
import type { GrainEngine } from "@/lib/engine/grain";
import { PX_PER_FRAME, compile, evaluate, timecode, type Beat } from "@/lib/engine/timeline";
import { MOTIFS } from "@/lib/engine/motifs";
import { Flicker } from "@/lib/engine/flicker";
import { applyBuild, completeBuild, prepareBuilds, type Build } from "@/lib/engine/builds";

const CONFIG = {
  grain: { strength: 0.06, density: 2, scale: 1 },
  dye: 0.03,
  leaderFrames: 48, // the film leader on load: "3" then "2", one sweep per second (24 film frames each)
  openingDevelopMs: 2500, // then the portrait develops on a 2.5 s timer
  nearAhead: 3, // viewports ahead of the playhead to stream textures
  nearBehind: 1.5,
  farAhead: 6, // free textures beyond these
  farBehind: 4,
  lerp: 0.09,
};

/** The reel container's rect; mirrors --box-x / --box-y / --box-r in globals.css. */
function boxFor(vw: number, vh: number) {
  const phone = vw < 810;
  const x = vw * (phone ? 0.03 : 0.035), y = vh * (phone ? 0.085 : 0.09);
  return { x, y, w: vw - 2 * x, h: vh - 2 * y, r: phone ? 20 : 28, jag: 2.5, t: 0 };
}

type ShotState = {
  el: HTMLImageElement | HTMLVideoElement;
  beat: Beat;
  timer: boolean;
  loading: boolean;
  tex: Tex | null;
  aspect: number;
  duration: number;
  drawn: boolean;
  developStart: number;
};

export function Projector() {
  const picRef = useRef<HTMLCanvasElement>(null);
  const grainRef = useRef<HTMLCanvasElement>(null);
  const leaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const main = document.querySelector<HTMLElement>("main");
    const pending = () => root.classList.remove("projector-pending");
    if (!("WebGL2RenderingContext" in window) || !picRef.current || !grainRef.current || !main) { pending(); return; }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const phone = window.matchMedia("(max-width: 809px)").matches;
    // Light mode: data saver / reduced data. Background loops stay as posters, grain is renewed at 12 fps.
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const lite = !!conn?.saveData || window.matchMedia("(prefers-reduced-data: reduce)").matches;
    let maxDpr = phone ? 1.5 : 2;
    let grainFps = phone || lite ? 12 : FPS;
    let motifsOn = true;
    // Adaptive quality: if frames run slow while the film is moving, step down (never back up in a visit).
    // level 1: pixel ratio 1.25; level 2: pixel ratio 1, grain at 12 fps, no background motifs.
    let quality = 0;
    let slowSince = -1;
    let lastNow = -1;
    const force = new URLSearchParams(location.search).get("engine") === "force"; // tests on software GPUs
    const pageStart = performance.now();

    let motion = !reduced;
    try { if (sessionStorage.getItem("projector") === "off") motion = false; } catch {}

    let pic: PictureEngine | null = null;
    let grain: GrainEngine | null = null;
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
    let motifTime = 0; // advances only while motion is on
    const flicker = new Flicker();
    let builds: (Build & { beat?: Beat })[] = [];
    const NAME_PRINT_AFTER = 3; // film frames of scroll before the name starts printing
    let watching = false; // the film player is open: the screening rests
    let lastSfxY = 0, lastReelHalf = "", lastSeqSfx = 0;
    const sfx = () => window.dispatchEvent(new CustomEvent("sfx", { detail: "shutter" }));
    // mouse parallax: everything but the menu leans a few px toward the pointer (fine pointers only)
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const par = { x: 0, y: 0, tx: 0, ty: 0 };
    const PAR = { picture: 5, text: 3, box: 2 };
    let lastVf = -1;
    // Play the film: scrolls at film speed (1 s of timecode per second). Any scroll of the visitor's own pauses it.
    const autoBtn = document.querySelector<HTMLButtonElement>("[data-autoplay]");
    const progEl = document.querySelector<HTMLElement>("[data-progress]");
    let auto = false, autoY = 0, lastAutoNow = -1;
    let lightNow = "";
    // how light the hero is behind the top and bottom bars, for the crop actually on screen (cached per size)
    type Bands = { tl: number; tr: number; bl: number; br: number; bc: number };
    let bandCache: (Bands & { key: string }) | null = null;
    const heroBands = (img: HTMLImageElement, vw: number, vh: number) => {
      const key = `${img.currentSrc}|${vw}x${vh}`;
      if (bandCache?.key === key) return bandCache;
      if (!img.naturalWidth) return null;
      const [fx, fy] = (img.dataset.focal ?? "0.5,0.5").split(",").map(Number);
      // draw the whole picture small first (drawImage crops in the file's real pixels, which for srcset images differ
      // from naturalWidth), then work out the on-screen cover crop in this canvas's own pixels
      const ia = img.naturalWidth / img.naturalHeight, va = vw / vh;
      const W0 = 160, H0 = Math.max(8, Math.round(W0 / ia));
      const c = document.createElement("canvas");
      c.width = W0; c.height = H0;
      const g = c.getContext("2d", { willReadFrequently: true });
      if (!g) return null;
      g.drawImage(img, 0, 0, W0, H0);
      let cw = W0, ch = H0, cx = 0, cy = 0;
      if (va > ia) { ch = W0 / va; cy = Math.max(0, Math.min(H0 - ch, fy * H0 - ch / 2)); }
      else { cw = H0 * va; cx = Math.max(0, Math.min(W0 - cw, fx * W0 - cw / 2)); }
      // brightness of a region given in fractions of the screen
      const region = (x0: number, x1: number, y0: number, y1: number) => {
        const X = Math.floor(cx + x0 * cw), W = Math.max(1, Math.floor((x1 - x0) * cw));
        const Y = Math.floor(cy + y0 * ch), H = Math.max(1, Math.floor((y1 - y0) * ch));
        const d = g.getImageData(X, Y, W, H).data;
        let t = 0;
        for (let i = 0; i < d.length; i += 4) t += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
        return t / (d.length / 4);
      };
      // where the pieces of the bars actually sit: name top-left, nav top-right, timecode bottom-left,
      // PROJECTOR/SOUND bottom-right, the scroll cue bottom-centre
      bandCache = {
        key,
        tl: region(0, 0.42, 0, 0.09), tr: region(0.5, 1, 0, 0.09),
        bl: region(0, 0.38, 0.9, 1), br: region(0.62, 1, 0.9, 1), bc: region(0.44, 0.56, 0.7, 1),
      };
      return bandCache;
    };
    const setAuto = (on: boolean) => {
      auto = on;
      autoY = window.scrollY;
      lastAutoNow = -1;
      autoBtn?.setAttribute("aria-pressed", String(on));
      root.classList.toggle("autoplay", on);
    };

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
          if (reduced || (lite && s.el.dataset.loop !== undefined)) { s.loading = false; return; } // the poster stays in the DOM
          const v = s.el;
          // remember a loop's own URL once: releasing a far-away loop clears its src, and it must come back rolling
          if (v.dataset.loop !== undefined && !v.dataset.loopUrl && v.getAttribute("src") && !v.src.startsWith("blob:")) v.dataset.loopUrl = v.getAttribute("src")!;
          const scrub = v.dataset.scrub ?? (v.dataset.loop !== undefined ? v.dataset.loopUrl : undefined);
          if (scrub && !v.src.startsWith("blob:")) {
            // Scrub clips (all-intra) and background loops are held in memory as blobs: seeking and looping then
            // never depend on the server honouring range requests (Cloudflare Pages may answer 200 with the whole file).
            const res = await fetch(scrub);
            if (!res.ok) throw new Error(`clip ${res.status}: ${scrub}`);
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
      for (const bd of builds) bd.beat = beats.find((b) => b.frame.contains(bd.el));
      const old = new Map(shots.map((s) => [s.el, s]));
      shots = beats.flatMap((b) => (b.seq ? b.seq.shots : b.shots).map((el) => {
        const s = old.get(el);
        if (s) { s.beat = b; return s; }
        return {
          el, beat: b, timer: el.dataset.develop === "timer", loading: false, tex: null,
          aspect: (Number(el.getAttribute("width")) || 16) / (Number(el.getAttribute("height")) || 9),
          duration: 0, drawn: false, developStart: -1,
        };
      }));
      if (prev && beats[prev.i]) {
        const b = beats[prev.i];
        const y = b.start + prev.q * (b.end - b.start);
        lenis ? lenis.scrollTo(y, { immediate: true }) : window.scrollTo(0, y);
      }
      dirty = true;
    };

    const setActive = (b: Beat | null) => {
      if (b === active) return;
      if (active) {
        delete active.slot.dataset.active;
        active.frame.style.removeProperty("--o");
        active.frame.style.removeProperty("--screen");
        active.frame.style.clipPath = "";
        active.frame.querySelectorAll<HTMLElement>(".corner-text").forEach((e) => { e.style.color = ""; e.style.opacity = ""; });
        // background loops rest when their beat isn't playing
        const v = active.shot;
        if (v instanceof HTMLVideoElement && v.dataset.loop !== undefined) v.pause();
      }
      active = b;
      if (b) b.slot.dataset.active = "1";
      root.classList.toggle("on-red", !!b?.red);
    };

    // The film leader on load: a countdown with a sweep hand on black, then the portrait develops.
    // Scrolling, PROYECTOR off or reduced motion skip it.
    let leaderStart = -1;
    // very slow load: if the safety timer already revealed the plain hero, skip the leader and the develop
    let heroShown = false;
    let leaderDone = reduced || !motion;
    const leaderEl = leaderRef.current;
    const endLeader = (now: number) => {
      if (leaderDone) return;
      leaderDone = true;
      root.classList.remove("countdown-on");
      const portrait = shots.find((x) => x.timer);
      if (portrait && portrait.developStart < 0) portrait.developStart = now + 80; // a couple of frames of black
    };
    const runLeader = (now: number, film: number, y: number) => {
      if (leaderDone) return;
      if (!motion || y > 8) { endLeader(now); return; }
      if (leaderStart < 0) {
        if (!root.classList.contains("projector-pending")) { heroShown = true; leaderDone = true; return; }
        leaderStart = film;
        root.classList.add("countdown-on");
      }
      const f = film - leaderStart;
      if (f >= CONFIG.leaderFrames) { endLeader(now); return; }
      if (leaderEl) {
        const inSecond = f % FPS;
        leaderEl.style.setProperty("--a", `${((inSecond + 1) / FPS) * 360}deg`); // the sweep, stepped per film frame
        const n = leaderEl.querySelector<HTMLElement>(".countdown-n");
        const num = String(3 - Math.floor(f / FPS));
        if (n && n.textContent !== num) n.textContent = num;
        // a projected leader: it weaves in the gate (drift + per-frame jitter + a hair of rotation) and the lamp breathes
        const w = weave({ drift: 2.2, period: 1.4, jitter: 0.9, rot: 0.35, seed: 71 }, film);
        leaderEl.style.setProperty("--wx", `${w.x.toFixed(2)}px`);
        leaderEl.style.setProperty("--wy", `${w.y.toFixed(2)}px`);
        leaderEl.style.setProperty("--wr", `${w.rot.toFixed(3)}deg`);
        leaderEl.style.setProperty("--wo", (0.84 + Math.random() * 0.16).toFixed(3));
      }
    };

    const timerProgress = (s: ShotState, now: number) => {
      if (!motion || heroShown) return 1;
      if (s.developStart < 0) return 0; // still behind the leader
      return Math.min(1, Math.max(0, (now - s.developStart) / CONFIG.openingDevelopMs));
    };

    const stepDown = () => {
      quality++;
      if (quality === 1) maxDpr = Math.min(maxDpr, 1.25);
      if (quality >= 2) { maxDpr = 1; grainFps = 12; motifsOn = false; }
      pic?.setMaxDpr(maxDpr);
      grain?.setMaxDpr(maxDpr);
      dirty = true;
      console.info(`[projector] quality step ${quality}`);
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      // frame pacing: ~40 fps or worse for 2 s while the film is moving => step quality down
      if (lastNow > 0 && quality < 2 && !force && document.visibilityState === "visible") {
        const dt = now - lastNow;
        const busy = window.scrollY !== lastY || (motion && !watching);
        if (busy && dt > 25 && dt < 250) { if (slowSince < 0) slowSince = now; else if (now - slowSince > 2000) { stepDown(); slowSince = -1; } }
        else if (dt <= 20) slowSince = -1;
      }
      lastNow = now;
      if (!pic || !grain || lost || watching) return;
      lenis?.raf(now);
      if (auto && !watching) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        if (lastAutoNow > 0) autoY += (Math.min(250, now - lastAutoNow) / 1000) * PX_PER_FRAME * FPS; // 192 px/s, real time
        lastAutoNow = now;
        if (autoY >= max) { autoY = max; setAuto(false); }
        lenis ? lenis.scrollTo(autoY, { immediate: true, force: true }) : window.scrollTo(0, autoY);
      }
      // parallax eases toward the pointer; the playing screen's text leans via CSS, pictures on the canvas
      if (finePointer && motion) {
        const nx = par.x + (par.tx - par.x) * 0.06, ny = par.y + (par.ty - par.y) * 0.06;
        if (Math.abs(nx - par.x) + Math.abs(ny - par.y) > 0.0005) {
          par.x = nx; par.y = ny; dirty = true;
          root.style.setProperty("--par-x", `${(par.x * PAR.text).toFixed(2)}px`);
          root.style.setProperty("--par-y", `${(par.y * PAR.text).toFixed(2)}px`);
        }
      } else if (par.x || par.y) {
        par.x = par.y = 0; dirty = true;
        root.style.removeProperty("--par-x"); root.style.removeProperty("--par-y");
      }
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

      runLeader(now, film, y);
      const st = evaluate(beats, y, !motion || reduced);
      setActive(st?.beat ?? null);
      if (st) {
        st.beat.frame.style.setProperty("--o", String(st.opacity));
        st.beat.frame.style.setProperty("--screen", String(st.screen));
      }
      // credit roll: the title holds at the top; after a moment the awards travel up through their box 1:1 with
      // scroll, stepped per film frame, out of darkness and into it
      if (st?.beat.roll && (moved || dirty)) {
        const yq = yFrame * PX_PER_FRAME;
        const travelled = Math.max(0, yq - st.beat.start - st.beat.rollLead);
        st.beat.roll.style.transform = `translate3d(0, ${Math.round(st.beat.rollBox - travelled)}px, 0)`;
      }

      // reels: entering one, a rolling shutter sweeps down the screen and reveals the reel container
      const b0 = st?.beat;
      let reveal = 1;
      if (b0?.reel && motion) {
        const into = Math.floor((y - b0.sceneStart) / PX_PER_FRAME) * PX_PER_FRAME;
        reveal = Math.min(1, Math.max(0, into / (vh * 0.22)));
      }
      const fwd = y > lastSfxY; lastSfxY = y;
      // a quiet shutter sound as a reel's shutter starts to roll (entering the reel going forward; if SOUND is on)
      const reelKey = b0?.reel ? b0.scene : "";
      if (reelKey !== lastReelHalf) {
        if (reelKey && reveal < 1 && fwd) sfx();
        lastReelHalf = reelKey;
      }
      if (b0) b0.frame.style.clipPath = reveal < 1 ? `inset(0 0 ${((1 - reveal) * 100).toFixed(2)}% 0)` : "";

      // viewfinder: thin marks draw in at the start of each beat and out at its end (not in reels or on red)
      if (moved || filmTick) {
        let vf = 0;
        if (b0 && !b0.reel && !b0.red && motion && st && st.fade >= 1) {
          const fin = (y - b0.start) / PX_PER_FRAME, fout = (b0.end - y) / PX_PER_FRAME;
          vf = Math.max(0, Math.min(1, Math.floor(fin) / 10, Math.floor(fout) / 8));
        }
        if (vf !== lastVf) { root.style.setProperty("--vf", vf.toFixed(2)); lastVf = vf; }
      }

      if (tcEl && yFrame !== lastTc) {
        tcEl.textContent = timecode(y);
        lastTc = yFrame;
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        if (progEl) progEl.style.transform = `scaleX(${Math.min(1, y / max).toFixed(4)})`;
      }
      // the scroll cue: at the very top of the page (first 4 px) once the film has started; it hides as soon as the
      // visitor scrolls or plays, and comes back whenever they return to the top
      root.classList.toggle("cue-on", y <= 4 && !auto && leaderDone && !!st && st.beat.index === 0);
      // each bar reads in dark ink where the developed hero behind it is light (sampled), Bone everywhere else
      const hero = shots.find((x) => x.timer);
      const heroUp = !!st && st.beat.index === 0 && !!hero?.drawn && (heroShown || !motion || timerProgress(hero, now) > 0.72) && st.fade > 0.5;
      const b = heroUp && hero ? heroBands(hero.el as HTMLImageElement, vw, vh) : null;
      const lightKey = b ? (["tl", "tr", "bl", "br", "bc"] as const).filter((k) => b[k] > 0.55).join(" ") : "";
      if (lightKey !== lightNow) {
        for (const k of ["tl", "tr", "bl", "br", "bc"]) root.classList.toggle(`light-${k}`, lightKey.split(" ").includes(k));
        lightNow = lightKey;
      }

      // picture
      const shot = st?.beat.shot ? shots.find((s) => s.el === st.beat.shot) : undefined;
      const timerRunning = !!shot?.timer && shot.tex !== null && timerProgress(shot, now) < 1;
      if (moved || filmTick || dirty || timerRunning) {
        const draw: Parameters<PictureEngine["frame"]>[0] = [];
        const rb = st?.beat.reel ? boxFor(vw, vh) : null;
        const reelBox = rb ? { ...rb, x: rb.x + par.x * PAR.box, y: rb.y + par.y * PAR.box, t: motifTime } : null;
        const wv = motion ? weave(WEAVE.picture, film) : { x: 0, y: 0, rot: 0 };
        const cb = boxFor(vw, vh);
        const cornerR = { r: cb.r, w: cb.w };
        const push = (s: ShotState, progress: number, extra: { wipe?: number; zoom?: number } = {}) => {
          if (!s.tex || !st) return;
          const r = s.el.getBoundingClientRect();
          if (r.width <= 0) return;
          const full = s.el.dataset.mode === "full";
          // parallax: windows move whole; full-frame pictures shift inside their overscan
          const px = par.x * PAR.picture, py = par.y * PAR.picture;
          draw.push({
            tex: s.tex, aspect: s.aspect,
            rect: full ? { x: r.left, y: r.top, w: r.width, h: r.height } : { x: r.left + px, y: r.top + py, w: r.width, h: r.height },
            full, weave: full ? { ...wv, x: wv.x + px / r.height, y: wv.y - py / r.height } : wv,
            focal: s.el.dataset.focal ? (s.el.dataset.focal.split(",").map(Number) as [number, number]) : undefined,
            // rounded corners scaled to the picture: the reel container's radius x (picture width / container width)
            radius: full ? 0 : Math.max(4, cornerR.r * (r.width / Math.max(1, cornerR.w))),
            progress, develop: progress < 1, dye: CONFIG.dye, zoom: extra.zoom ?? st.zoom, fade: st.fade * st.beat.dim,
            box: reelBox, reveal, wipe: extra.wipe,
          });
          if (!s.drawn) { s.drawn = true; s.el.dataset.ready = "1"; } // the canvas has it now: fade the DOM picture out
        };
        const seq = st?.beat.seq;
        if (st && seq) {
          // Behind the camera: the lines share the pictures in order (4 lines, 2 pictures => 2 lines each). When a
          // line brings a new picture, a rolling shutter brings it in as blank paper and it develops; otherwise the
          // picture holds while the line beside it changes.
          const n = seq.lines.length, np = Math.max(1, seq.shots.length);
          const k = Math.min(n - 1, Math.floor(st.q * n));
          const local = st.q * n - k;
          const sub = (st.beat.end - st.beat.start) / n / PX_PER_FRAME;
          const imgOf = (line: number) => Math.min(np - 1, Math.floor((line * np) / n));
          const ki = imgOf(k);
          const fresh = k === 0 || imgOf(k - 1) !== ki; // this line brings a new picture
          const cur = shots.find((x) => x.el === seq.shots[ki]);
          const prev = fresh && k > 0 ? shots.find((x) => x.el === seq.shots[imgOf(k - 1)]) : undefined;
          const wipeT = 0.22;
          const dev = !motion || !fresh ? 1 : k === 0 ? Math.min(1, local / 0.45) : Math.min(1, Math.max(0, (local - 0.06) / 0.5));
          if (prev && motion && local >= wipeT * 0.4 && local < wipeT && k > lastSeqSfx && fwd) { lastSeqSfx = k; sfx(); }
          if (k < lastSeqSfx) lastSeqSfx = k - 1;
          if (prev && local < wipeT && motion) {
            push(prev, 1, { zoom: 1 });
            if (cur) push(cur, dev, { wipe: local / wipeT, zoom: 1 });
          } else if (cur) push(cur, dev, { zoom: 1 });
          seq.pics.forEach((p, i) => { if (i === ki) p.dataset.current = "1"; else delete p.dataset.current; });
          seq.lines.forEach((l, i) => {
            let o = 0;
            if (i === k) {
              const fi = Math.floor(local * sub), fo = Math.floor((1 - local) * sub);
              o = !motion ? 1 : Math.min(1, fi / 6, i === n - 1 ? 1 : fo / 4);
            }
            l.style.opacity = String(o);
          });
        } else if (st) {
          // the closing pair develops one card at a time: image 1, then the sentence up out of the safelight red,
          // then image 2. Each picture only appears when its turn comes, as paper rising out of black.
          const corner = st.beat.frame.classList.contains("frame--corner");
          const CORNER = { img2At: 0.42, devLen: 0.32, textAt: 0.26, textLen: 0.16 };
          if (corner) {
            const txt = st.beat.frame.querySelector<HTMLElement>(".corner-text");
            if (txt) {
              if (!motion) { txt.style.color = ""; txt.style.opacity = ""; }
              else {
                const tq = Math.max(0, Math.min(1, (st.q - CORNER.textAt) / CORNER.textLen));
                const c = [77, 19, 13].map((v, i) => Math.round(v + ([236, 230, 218][i] - v) * tq)); // safelight paper -> Bone
                txt.style.color = `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
                txt.style.opacity = String(st.q < CORNER.textAt ? 0 : Math.min(1, 0.35 + tq));
              }
            }
          }
          st.beat.shots.forEach((el, idx) => {
            const sh = shots.find((x) => x.el === el);
            if (!sh?.tex) return;
            let develop = st.develop;
            let hold = false;
            if (corner && motion) {
              const p = (st.q - (idx === 0 ? 0 : CORNER.img2At)) / CORNER.devLen;
              if (p <= 0) return; // not its turn yet
              develop = Math.min(1, p);
            }
            if (sh.timer) { develop = timerProgress(sh, now); hold = motion && !heroShown && (sh.developStart < 0 || now < sh.developStart); }
            const v = sh.el;
            if (v instanceof HTMLVideoElement) {
              if (v.dataset.loop !== undefined) {
                if (v.paused && motion && !lite) v.play().catch(() => {}); // a quiet loop behind the watch button
                if (!motion && !v.paused) v.pause();
              } else if (sh.duration) {
                const t = Math.min(sh.duration - 1 / FPS, st.q * sh.duration); // scrub; holds the last frame
                if (Math.abs(v.currentTime - t) > 0.5 / FPS) v.currentTime = t;
              }
            }
            if (!hold) push(sh, develop);
          });
        }
        // the scene's background motif: fades in over the scene's first 30vh, out with the scene through its rest
        let bg: Parameters<PictureEngine["frame"]>[1] = null;
        const motif = st && motifsOn ? MOTIFS[st.beat.scene] : undefined;
        if (st && (motif || reelBox)) {
          const env = Math.min(1, Math.max(0, (y - st.beat.sceneStart) / (vh * 0.3))) * st.fade;
          const m = motif ?? { mode: 0, color: [0, 0, 0] as [number, number, number], intensity: 0 };
          bg = { ...m, intensity: m.intensity * (reelBox ? 1 : env), time: motifTime, box: reelBox, reveal, fade: st.fade };
        }
        pic.frame(draw, bg);
        if (shot?.timer && shot.drawn) pending();
        dirty = false;
      }

      // title builds in the playing beat: on the opening's clock (the name) or on scroll (everything else)
      if (st && (filmTick || moved)) {
        const b = st.beat;
        const beatFrames = Math.max(1, (b.end - b.start) / PX_PER_FRAME);
        const framesIn = Math.floor((Math.min(y, b.end) - b.start) / PX_PER_FRAME);
        for (const bd of builds) {
          if (bd.beat !== b) continue;
          if (!motion) { completeBuild(bd); bd.el.style.opacity = ""; continue; }
          if (bd.el.dataset.clock === "opening") {
            // the name isn't there at first: it prints in as the visitor starts to scroll, holds, then fades
            applyBuild(bd, framesIn - NAME_PRINT_AFTER, st.q, beatFrames);
            const out = st.q > 0.62 ? Math.max(0, 1 - Math.floor((st.q - 0.62) * beatFrames) / 6) : 1;
            bd.el.style.opacity = out === 1 ? "" : String(out);
          } else {
            applyBuild(bd, framesIn, st.q, beatFrames);
          }
        }
      }

      if (filmTick) {
        if (motion && lastFilm >= 0) motifTime += (film - lastFilm) / FPS;
        if (film % Math.round(FPS / grainFps) === 0) {
          // projector flicker rides on the grain canvas: random lifts and dips of the whole screen (off with PROYECTOR)
          const fl = motion ? flicker.step(film) : 0;
          if (!motion) flicker.reset();
          grain.render(film, { ...CONFIG.grain, still: !motion, flicker: fl });
        }
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

    const onPointer = (e: PointerEvent) => {
      par.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      par.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };

    // Menu: land where the important thing is already on screen, and cut there through black
    // (fast-forwarding through the film would flash every cut on the way).
    const landing = (hash: string): number | null => {
      const vh = window.innerHeight;
      if (hash === "#top") return 0;
      if (hash === "#films") {
        const b = beats.find((x) => x.reel);
        return b ? b.start + Math.round(vh * 0.22) + 24 * PX_PER_FRAME : null; // container revealed, title printed
      }
      if (hash === "#about") {
        const b = beats.find((x) => x.seq);
        return b && b.seq ? b.start + Math.round((b.end - b.start) / b.seq.lines.length * 0.55) : null; // first portrait developed, its line in
      }
      if (hash === "#contact") {
        const b = beats.find((x) => x.red && x.frame.querySelector("a[href^='mailto:']"));
        return b ? b.start + Math.round((b.end - b.start) * 0.35) : null; // the email, before the red goes down
      }
      return null;
    };
    const onNav = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[href^='#']");
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
      const hash = a.getAttribute("href")!;
      a.closest<HTMLDetailsElement>("details.index")?.removeAttribute("open"); // phones: close INDEX
      const y = landing(hash);
      if (y === null) return;
      e.preventDefault();
      stopAuto();
      const jump = () => {
        lenis ? lenis.scrollTo(y, { immediate: true, force: true }) : window.scrollTo(0, y);
        history.replaceState(null, "", hash);
        dirty = true;
      };
      if (!motion) { jump(); return; }
      root.classList.add("jumping");
      window.setTimeout(() => {
        jump();
        requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("jumping")));
      }, 190);
    };

    // the visitor's own scrolling pauses "play the film" for good (until play is pressed again)
    const SCROLL_KEYS = new Set(["ArrowDown", "ArrowUp", "PageDown", "PageUp", " ", "Home", "End"]);
    const stopAuto = () => { if (auto) setAuto(false); };
    const onWheel = () => stopAuto();
    const onTouch = () => stopAuto();
    const onKeyScroll = (e: KeyboardEvent) => { if (SCROLL_KEYS.has(e.key) && !(e.target as HTMLElement).closest("button, input, a")) stopAuto(); };
    const onScrollbar = (e: PointerEvent) => { if (e.clientX >= document.documentElement.clientWidth) stopAuto(); };
    const onAutoBtn = () => {
      if (auto) { setAuto(false); return; }
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (window.scrollY >= max - 2) { lenis ? lenis.scrollTo(0, { immediate: true, force: true }) : window.scrollTo(0, 0); }
      setAuto(true);
    };

    const onPlayer = (e: Event) => {
      watching = !!(e as CustomEvent<{ open: boolean }>).detail?.open;
      if (watching) {
        stopAuto();
        lenis?.stop();
        if (active?.shot instanceof HTMLVideoElement) active.shot.pause();
      } else {
        lenis?.start();
        dirty = true;
      }
    };

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
        const { PictureEngine } = await import("@/lib/engine/picture");
        const { GrainEngine } = await import("@/lib/engine/grain");
        if (disposed || !picRef.current || !grainRef.current) return;
        pic = new PictureEngine(picRef.current, maxDpr);
        // A software-rendered GPU can't run the film smoothly: keep the plain page (fallback level 3).
        const dbg = pic.gl.getExtension("WEBGL_debug_renderer_info");
        const rendererName = dbg ? String(pic.gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : "";
        if (/swiftshader|llvmpipe|software|basic render/i.test(rendererName) && !force) {
          throw new Error(`software renderer (${rendererName})`);
        }
        grain = new GrainEngine(grainRef.current, maxDpr);
        await grain.load(CONFIG.grain.density);
        if (disposed) return;
        if (!reduced && !lenis) {
          const { default: Lenis } = await import("lenis");
          lenis = new Lenis({ lerp: CONFIG.lerp, anchors: false, autoRaf: false }); // menu landings are ours (onNav)
        }
        lost = false;
        root.classList.add("projector-on", "film");
        builds = prepareBuilds(main);
        build();
        lastFilm = -1; lastY = -1; lastW = window.innerWidth; lastH = window.innerHeight; dirty = true;
        syncToggle();
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(loop);
        (window as unknown as { __projector?: object }).__projector = {
          get beats() { return beats; }, get shots() { return shots; }, get active() { return active; }, get flicker() { return flicker.value; }, get bands() { return bandCache; }, contexts: 2,
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
      for (const bd of builds) { bd.restore(); bd.el.style.opacity = ""; }
      builds = [];
      for (const b of beats) {
        b.slot.style.height = "";
        b.frame.style.removeProperty("--o");
        b.frame.style.removeProperty("--screen");
        delete b.slot.dataset.near;
      }
      for (const sec of main.querySelectorAll<HTMLElement>("section.scene")) sec.style.paddingBottom = "";
      main.style.paddingBottom = "";
      for (const el of main.querySelectorAll<HTMLElement>("[data-weave]")) el.style.transform = "";
      pic?.dispose(); grain?.dispose();
      pic = null; grain = null;
      lenis?.destroy(); lenis = null;
      root.classList.remove("projector-on", "film", "on-red", "countdown-on", "autoplay", "cue-on", "light-tl", "light-tr", "light-bl", "light-br", "light-bc");
      root.style.removeProperty("--vf");
      root.style.removeProperty("--par-x");
      root.style.removeProperty("--par-y");
      root.classList.remove("jumping");
      for (const b of beats) {
        b.frame.style.clipPath = "";
        b.seq?.lines.forEach((l) => { l.style.opacity = ""; });
        b.seq?.pics.forEach((p) => { delete p.dataset.current; });
      }
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
    window.addEventListener("player", onPlayer);
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouch, { passive: true });
    window.addEventListener("keydown", onKeyScroll);
    window.addEventListener("pointerdown", onScrollbar);
    autoBtn?.addEventListener("click", onAutoBtn);
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("click", onNav);
    document.addEventListener("focusin", onFocus);

    init();
    return () => {
      disposed = true;
      for (const c of canvases) {
        c.removeEventListener("webglcontextlost", onLost);
        c.removeEventListener("webglcontextrestored", onRestored);
      }
      toggle?.removeEventListener("click", onToggle);
      window.removeEventListener("player", onPlayer);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouch);
      window.removeEventListener("keydown", onKeyScroll);
      window.removeEventListener("pointerdown", onScrollbar);
      autoBtn?.removeEventListener("click", onAutoBtn);
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("click", onNav);
      document.removeEventListener("focusin", onFocus);
      teardown();
    };
  }, []);

  return (
    <>
      <canvas ref={picRef} className="projector-canvas projector-picture" aria-hidden="true" />
      {/* the film leader on load: rings, a cross, a sweep hand and the count */}
      <div ref={leaderRef} className="countdown" aria-hidden="true">
        <div className="countdown-sweep" />
        <div className="countdown-ring countdown-ring--outer" />
        <div className="countdown-ring countdown-ring--inner" />
        <div className="countdown-cross" />
        <span className="countdown-n">3</span>
      </div>
      <canvas ref={grainRef} className="projector-canvas projector-grain" aria-hidden="true" />
    </>
  );
}

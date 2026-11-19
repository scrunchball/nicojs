"use client";

import { useEffect } from "react";

/**
 * The projector sound (brief: Sound). Off by default; SOUND ○ in the projector line turns it on (a click, so the
 * browser allows audio). A close-miked 16mm projector loop, quiet: it idles softly at rest, runs at full (still
 * quiet) level and speed while the film moves, and winds down when scrolling stops. It fades away while a film
 * plays in the player, mutes when the tab is hidden, and the choice is remembered for the visit.
 */
const SRC = "/media/sound/projector.m4a";
const LEVEL = 0.6; // running level: the loop is mastered at -26 LUFS, so the site sits around -30 LUFS
const IDLE = 0.38; // share of the level at rest
const FILM_SPEED = 192; // px of scroll per second at 24 fps (8 px per frame)
const KEY = "nicojs-sound";

export function Sound() {
  useEffect(() => {
    const btn = document.querySelector<HTMLButtonElement>("[data-sound-toggle]");
    const dot = document.querySelector<HTMLElement>("[data-sound-dot]");
    if (!btn) return;
    const root = document.documentElement;
    root.classList.add("sound-ready");

    let ctx: AudioContext | null = null;
    let gain: GainNode | null = null;
    let src: AudioBufferSourceNode | null = null;
    let buffer: Promise<AudioBuffer> | null = null;
    let on = false;
    let watching = false;
    let raf = 0;
    let lastY = window.scrollY, lastT = performance.now(), run = 0, offAt = 0;

    const sync = () => {
      btn.setAttribute("aria-pressed", String(on));
      if (dot) dot.textContent = on ? "●" : "○";
    };

    const load = (c: AudioContext) =>
      (buffer ??= fetch(SRC).then((r) => r.arrayBuffer()).then((b) => c.decodeAudioData(b)));

    const target = () => (!on || watching || document.hidden ? 0 : LEVEL * (IDLE + (1 - IDLE) * run));

    const tick = (now: number) => {
      raf = 0;
      if (!ctx || !gain || !src) return;
      const dt = Math.max(1, now - lastT) / 1000;
      const y = window.scrollY;
      const v = Math.min(1, Math.abs(y - lastY) / dt / FILM_SPEED);
      lastY = y; lastT = now;
      // quick to run up, slow to wind down
      run += (v - run) * (v > run ? Math.min(1, dt * 6) : Math.min(1, dt * 1.1));
      const t = ctx.currentTime;
      gain.gain.setTargetAtTime(target(), t, watching ? 0.35 : 0.12);
      src.playbackRate.setTargetAtTime(0.9 + 0.1 * run, t, 0.2);
      if (on || now - offAt < 1500) raf = requestAnimationFrame(tick);
      else stop();
    };
    const kick = () => { if (!raf) { lastT = performance.now(); lastY = window.scrollY; raf = requestAnimationFrame(tick); } };

    const stop = () => {
      try { src?.stop(); } catch { /* already stopped */ }
      src?.disconnect();
      src = null;
      void ctx?.suspend();
    };

    const start = async () => {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx ??= new AC();
      if (!gain) { gain = ctx.createGain(); gain.gain.value = 0; gain.connect(ctx.destination); }
      await ctx.resume();
      const buf = await load(ctx);
      if (!on) return;
      if (!src) {
        src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        src.playbackRate.value = 0.9;
        src.connect(gain);
        src.start();
      }
      kick();
    };

    const set = (v: boolean, remember = true) => {
      on = v;
      sync();
      if (remember) { try { sessionStorage.setItem(KEY, v ? "1" : "0"); } catch { /* storage off */ } }
      if (on) void start().catch(() => { on = false; sync(); });
      else { offAt = performance.now(); kick(); } // fades down, then stops
    };

    const onClick = () => set(!on);
    btn.addEventListener("click", onClick);

    // remembered for the visit: it resumes with the first click or key on the next page (browsers need a gesture)
    let wanted = false;
    try { wanted = sessionStorage.getItem(KEY) === "1"; } catch { /* storage off */ }
    const resume = (e: Event) => {
      if (e.target instanceof Node && btn.contains(e.target)) return;
      window.removeEventListener("pointerdown", resume, true);
      window.removeEventListener("keydown", resume, true);
      if (!on) set(true);
    };
    if (wanted) {
      window.addEventListener("pointerdown", resume, true);
      window.addEventListener("keydown", resume, true);
    }
    sync();
    (window as unknown as { __sound: object }).__sound = { get on() { return on; }, get run() { return run; }, get target() { return target(); }, get state() { return ctx?.state; }, get playing() { return !!src; } };

    const onScroll = () => { if (on) kick(); };
    const onPlayer = (e: Event) => { watching = !!(e as CustomEvent<{ open: boolean }>).detail?.open; if (on) kick(); };
    const onVis = () => {
      if (!ctx || !on) return;
      if (document.hidden) void ctx.suspend();
      else { void ctx.resume(); kick(); }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("player", onPlayer);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      btn.removeEventListener("click", onClick);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("player", onPlayer);
      window.removeEventListener("pointerdown", resume, true);
      window.removeEventListener("keydown", resume, true);
      document.removeEventListener("visibilitychange", onVis);
      if (raf) cancelAnimationFrame(raf);
      stop();
      void ctx?.close();
      root.classList.remove("sound-ready");
    };
  }, []);
  return null;
}

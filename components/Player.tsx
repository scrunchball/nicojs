"use client";

/**
 * Play the film (Adam's direction, D-74).
 * - Over the film (the watch beat), a small Safelight-red "PLAY FILM" tag follows the cursor; it scales into view on
 *   hover and away on leave. Touch screens and keyboard users get the same tag, centred, as a normal button.
 * - Click: the tag animates away, a rounded frame grows out of the reel container and resizes to the film's own
 *   shape, the grain fades out, then the film slowly fades in and plays; the controls follow. Esc / CLOSE reverses it.
 * Source: a plain MP4 URL (the clips for now; the full films from R2, D-73).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Shot } from "@/content/site";

const FPS = 24;
const tc = (s: number) => {
  if (!isFinite(s)) s = 0;
  const f = Math.floor(s * FPS), ff = f % FPS, ss = Math.floor(f / FPS) % 60, mm = Math.floor(f / FPS / 60) % 60, hh = Math.floor(f / FPS / 3600);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(hh)}:${p(mm)}:${p(ss)}:${p(ff)}`;
};

type Rect = { left: number; top: number; width: number; height: number };

export function WatchFilm({ film, title, label }: { film: Shot; title: string; label: string }) {
  const [from, setFrom] = useState<Rect | null>(null);
  const [fine, setFine] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const leaving = useRef(false);

  const close = useCallback(() => { setFrom(null); leaving.current = false; btn.current?.classList.remove("is-gone"); btn.current?.focus({ preventScroll: true }); }, []);

  const start = useCallback(() => {
    const b = btn.current;
    if (!b || leaving.current) return;
    leaving.current = true;
    b.classList.add("is-gone"); // the tag animates away first
    // the frame grows out of the reel container (the film's picture fills it)
    const frame = b.closest<HTMLElement>(".frame--watch");
    const pic = frame?.querySelector<HTMLElement>(".pic");
    const r = (pic ?? frame)?.getBoundingClientRect();
    const rect = r ? { left: r.left, top: r.top, width: r.width, height: r.height } : { left: 0, top: 0, width: innerWidth, height: innerHeight };
    window.setTimeout(() => setFrom(rect), 200);
  }, []);

  // the cursor tag: follows the pointer over the film, eased, on fine pointers only
  useEffect(() => {
    const b = btn.current;
    const frame = b?.closest<HTMLElement>(".frame--watch");
    if (!b || !frame) return;
    const isFine = window.matchMedia("(pointer: fine)").matches;
    setFine(isFine);
    if (!isFine) return;
    frame.classList.add("has-play-cursor");
    let x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y, raf = 0, on = false;
    const tick = () => {
      x += (tx - x) * 0.22; y += (ty - y) * 0.22;
      b.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
      if (on || Math.abs(tx - x) + Math.abs(ty - y) > 0.5) raf = requestAnimationFrame(tick); else raf = 0;
    };
    const move = (e: PointerEvent) => {
      tx = e.clientX; ty = e.clientY;
      if (!on) { on = true; x = tx; y = ty; b.classList.add("is-on"); }
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const leave = () => { on = false; b.classList.remove("is-on"); };
    const click = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest("a")) return; // the festival link keeps working
      start();
    };
    frame.addEventListener("pointermove", move);
    frame.addEventListener("pointerleave", leave);
    frame.addEventListener("click", click);
    return () => {
      cancelAnimationFrame(raf);
      frame.classList.remove("has-play-cursor");
      frame.removeEventListener("pointermove", move);
      frame.removeEventListener("pointerleave", leave);
      frame.removeEventListener("click", click);
    };
  }, [start]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={`play-tag label ${fine ? "is-cursor" : "is-static"}`}
        onClick={(e) => { e.stopPropagation(); start(); }}
        aria-haspopup="dialog"
      >
        {label}
      </button>
      <noscript>
        <a className="label link" href={film.loop}>{label} ↗</a>
      </noscript>
      {from && createPortal(<PlayerRoom film={film} title={title} from={from} onClose={close} />, document.body)}
    </>
  );
}

type Phase = "grow" | "open" | "play" | "closing";

function PlayerRoom({ film, title, from, onClose }: { film: Shot; title: string; from: Rect; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const [phase, setPhase] = useState<Phase>("grow");
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [d, setD] = useState(0);
  const [muted, setMuted] = useState(false);
  const [ar, setAr] = useState(film.width / film.height);
  const [vp, setVp] = useState({ w: typeof window !== "undefined" ? innerWidth : 1280, h: typeof window !== "undefined" ? innerHeight : 800 });

  // the film's own shape, as large as fits with room for the controls
  const w = Math.min(vp.w * 0.9, (vp.h * 0.84 - 88) * ar);
  const h = w / ar;
  const target: Rect = { left: (vp.w - w) / 2, top: (vp.h - h - 72) / 2, width: w, height: h };
  const rect = phase === "grow" || phase === "closing" ? from : target;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("watching"); // the grain fades away, the screening rests
    window.dispatchEvent(new CustomEvent("player", { detail: { open: true } }));
    const onResize = () => setVp({ w: innerWidth, h: innerHeight });
    window.addEventListener("resize", onResize);
    const a = requestAnimationFrame(() => requestAnimationFrame(() => setPhase("open")));
    const b = window.setTimeout(() => { setPhase("play"); video.current?.play().catch(() => {}); }, 760);
    // focus moves into the dialog for keyboard and screen-reader users, without a ring after a mouse click
    closeBtn.current?.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
    return () => {
      cancelAnimationFrame(a); clearTimeout(b);
      window.removeEventListener("resize", onResize);
      root.classList.remove("watching");
      window.dispatchEvent(new CustomEvent("player", { detail: { open: false } }));
    };
  }, []);

  const close = useCallback(() => {
    video.current?.pause();
    setPhase("closing");
    window.setTimeout(onClose, 720);
  }, [onClose]);

  const toggle = useCallback(() => {
    const v = video.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {}); else v.pause();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const v = video.current;
      if (!v) return;
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === " " || e.key === "k") { if ((e.target as HTMLElement).tagName !== "BUTTON") { e.preventDefault(); toggle(); } }
      else if (e.key === "ArrowRight") { v.currentTime = Math.min(v.duration || 0, v.currentTime + 5); }
      else if (e.key === "ArrowLeft") { v.currentTime = Math.max(0, v.currentTime - 5); }
      else if (e.key === "Tab") {
        const els = Array.from(document.querySelectorAll<HTMLElement>(".player-room button, .player-room input"));
        const i = els.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); els[els.length - 1]?.focus(); }
        else if (!e.shiftKey && i === els.length - 1) { e.preventDefault(); els[0]?.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, toggle]);

  const shown = phase === "open" || phase === "play";
  return (
    <div className={`player-room phase-${phase}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="player-backdrop" style={{ opacity: shown ? 1 : 0 }} onClick={close} />
      <button ref={closeBtn} type="button" className="player-close label" style={{ opacity: shown ? 1 : 0 }} onClick={close}>
        CLOSE <span aria-hidden="true">×</span>
      </button>
      <div className="player-frame" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}>
        <video
          ref={video}
          src={film.loop}
          poster={film.src}
          playsInline
          preload="auto"
          muted={muted}
          onClick={toggle}
          style={{ opacity: phase === "play" ? 1 : 0 }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            setD(v.duration);
            if (v.videoWidth && v.videoHeight) setAr(v.videoWidth / v.videoHeight); // the frame takes the film's shape
          }}
          onEnded={() => setPlaying(false)}
        />
      </div>
      <div className="player-bar label" style={{ top: target.top + target.height + 16, opacity: phase === "play" ? 1 : 0 }}>
        <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="player-btn">
          <span className={playing ? "icon-pause" : "icon-play"} aria-hidden="true" />
        </button>
        <span className="player-tc">{tc(t)}</span>
        <input
          className="player-scrub"
          type="range"
          min={0}
          max={d || 0}
          step={1 / FPS}
          value={t}
          aria-label="Position"
          aria-valuetext={tc(t)}
          style={{ ["--p" as string]: d ? `${(t / d) * 100}%` : "0%" }}
          onChange={(e) => { const v = video.current; if (v) v.currentTime = Number(e.target.value); setT(Number(e.target.value)); }}
        />
        <span className="player-tc silver">{tc(d)}</span>
        <button type="button" className="player-btn" onClick={() => setMuted((m) => !m)} aria-pressed={!muted}>
          SOUND <span aria-hidden="true">{muted ? "○" : "●"}</span>
        </button>
        <button type="button" className="player-btn" onClick={() => video.current?.requestFullscreen?.()}>FULL</button>
      </div>
    </div>
  );
}

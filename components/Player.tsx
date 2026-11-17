"use client";

/**
 * The film player (Stage 6 corrections). "Watch the film" opens a quiet room: the screening pauses, the grain
 * fades away, and the film plays in a rounded container with custom controls in the site's own type.
 * Source: a plain MP4 URL (placeholder now; R2 or Stream for the 5-10 min films, see DECISIONS D-46).
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

export function WatchFilm({ film, title, label }: { film: Shot; title: string; label: string }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => { setOpen(false); btn.current?.focus(); }, []);
  return (
    <>
      <button ref={btn} type="button" className="watch-btn label" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span className="watch-icon" aria-hidden="true" /> {label}
      </button>
      <noscript>
        <a className="label link" href={film.loop}>{label} ↗</a>
      </noscript>
      {open && createPortal(<PlayerRoom film={film} title={title} onClose={close} />, document.body)}
    </>
  );
}

function PlayerRoom({ film, title, onClose }: { film: Shot; title: string; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [d, setD] = useState(0);
  const [muted, setMuted] = useState(false);
  const [shown, setShown] = useState(false);
  const [ar, setAr] = useState(film.width / film.height);

  // enter the room: pause the screening, fade the grain, lock scroll
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("watching");
    window.dispatchEvent(new CustomEvent("player", { detail: { open: true } }));
    const id = requestAnimationFrame(() => setShown(true));
    closeBtn.current?.focus();
    video.current?.play().catch(() => {});
    return () => {
      cancelAnimationFrame(id);
      root.classList.remove("watching");
      window.dispatchEvent(new CustomEvent("player", { detail: { open: false } }));
    };
  }, []);

  const toggle = useCallback(() => {
    const v = video.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {}); else v.pause();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const v = video.current;
      if (!v) return;
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      else if (e.key === " " || e.key === "k") { if ((e.target as HTMLElement).tagName !== "BUTTON") { e.preventDefault(); toggle(); } }
      else if (e.key === "ArrowRight") { v.currentTime = Math.min(v.duration || 0, v.currentTime + 5); }
      else if (e.key === "ArrowLeft") { v.currentTime = Math.max(0, v.currentTime - 5); }
      else if (e.key === "Tab") {
        // keep focus inside the room
        const els = Array.from(document.querySelectorAll<HTMLElement>(".player-room button, .player-room input"));
        const i = els.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); els[els.length - 1]?.focus(); }
        else if (!e.shiftKey && i === els.length - 1) { e.preventDefault(); els[0]?.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, toggle]);


  return (
    <div className={`player-room ${shown ? "is-shown" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
      <button ref={closeBtn} type="button" className="player-close label" onClick={onClose}>CLOSE <span aria-hidden="true">×</span></button>
      <div className="player" style={{ ["--ar" as string]: String(ar) }}>
        <div className="player-screen">
          <video
            ref={video}
            src={film.loop}
            poster={film.src}
            playsInline
            preload="auto"
            muted={muted}
            onClick={toggle}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              setD(v.duration);
              if (v.videoWidth && v.videoHeight) setAr(v.videoWidth / v.videoHeight); // the container takes the film's own shape
            }}
            onEnded={() => setPlaying(false)}
          />
        </div>
        <div className="player-bar label">
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
    </div>
  );
}

"use client";

/**
 * Play the film (Adam's direction, D-74, D-79).
 * - On the watch beat a small Safelight-red "PLAY FILM" tag (outline play icon) is there from the moment the beat is
 *   on screen: it starts where the pointer is (or centred) and follows the cursor. Touch and keyboard get it centred.
 * - Click: a camera shutter rolls down over the whole screen; behind it the player room is set up (nothing of the
 *   page shows through); the shutter rolls on and reveals the film in its rounded frame, which then fades in and
 *   plays. Esc / CLOSE: the shutter rolls over again and reveals the page. Reduced motion: no shutter.
 * Source: the full films on R2 (1080p; 720p on phones / data saver), D-78.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Shot } from "@/content/site";

const FPS = 24;
const ROLL_MS = 420;
const tc = (s: number) => {
  if (!isFinite(s)) s = 0;
  const f = Math.floor(s * FPS), ff = f % FPS, ss = Math.floor(f / FPS) % 60, mm = Math.floor(f / FPS / 60) % 60, hh = Math.floor(f / FPS / 3600);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(hh)}:${p(mm)}:${p(ss)}:${p(ff)}`;
};

/** Outline play triangle with softly rounded corners. */
function PlayIcon({ size = 12 }: { size?: number }) {
  return (
    <svg className="icon-play-line" width={size} height={size * 1.15} viewBox="0 0 12 14" aria-hidden="true">
      <path d="M2.2 1.9 L10.4 7 L2.2 12.1 Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}
function PauseIcon({ size = 12 }: { size?: number }) {
  return (
    <svg className="icon-play-line" width={size} height={size * 1.15} viewBox="0 0 12 14" aria-hidden="true">
      <rect x="2.2" y="2" width="2.6" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <rect x="7.2" y="2" width="2.6" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function VolumeIcon({ level }: { level: number }) {
  return (
    <svg width="14" height="12" viewBox="0 0 16 14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round">
      <path d="M1.5 5h2.8L8 2v10L4.3 9H1.5z" />
      {level > 0 && <path d="M10.5 4.6a3.4 3.4 0 0 1 0 4.8" />}
      {level > 0.5 && <path d="M12.6 2.6a6.2 6.2 0 0 1 0 8.8" />}
      {level === 0 && <path d="M11 5l3.4 4M14.4 5L11 9" />}
    </svg>
  );
}
function FullIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 5V1.5H5M9 1.5h3.5V5M12.5 9v3.5H9M5 12.5H1.5V9" />
    </svg>
  );
}

// the pointer's last position on the page, so the tag can start right under it
const pointer = { x: -1, y: -1 };
if (typeof window !== "undefined") {
  window.addEventListener("pointermove", (e) => { pointer.x = e.clientX; pointer.y = e.clientY; }, { passive: true });
}

/** The camera shutter: one dark panel with a skewed, lit leading edge, rolling down across the whole screen. */
function useShutter() {
  const el = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const d = document.createElement("div");
    d.className = "shutter";
    d.setAttribute("aria-hidden", "true");
    d.innerHTML = '<div class="shutter-panel"><i class="shutter-edge shutter-edge--lead"></i><i class="shutter-edge shutter-edge--tail"></i></div>';
    document.body.appendChild(d);
    el.current = d;
    return () => { d.remove(); };
  }, []);
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  /** Roll from above the screen to covering it. */
  const cover = useCallback(async () => {
    const p = el.current?.firstElementChild as HTMLElement | null;
    if (!p || reduced) return;
    window.dispatchEvent(new CustomEvent("sfx", { detail: "shutter" })); // a quiet camera shutter (if SOUND is on)
    el.current!.classList.add("is-on");
    await p.animate([{ transform: "translateY(-115%) rotate(-2.2deg)" }, { transform: "translateY(0%) rotate(-2.2deg)" }],
      { duration: ROLL_MS, easing: "cubic-bezier(0.55, 0, 0.35, 1)", fill: "forwards" }).finished;
  }, [reduced]);
  /** Roll on, off the bottom of the screen, revealing what's behind. */
  const reveal = useCallback(async () => {
    const p = el.current?.firstElementChild as HTMLElement | null;
    if (!p || reduced) return;
    await p.animate([{ transform: "translateY(0%) rotate(-2.2deg)" }, { transform: "translateY(115%) rotate(-2.2deg)" }],
      { duration: ROLL_MS, easing: "cubic-bezier(0.55, 0, 0.35, 1)", fill: "forwards" }).finished;
    el.current!.classList.remove("is-on");
  }, [reduced]);
  return { cover, reveal };
}

export function WatchFilm({ film, title, label }: { film: Shot; title: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [fine, setFine] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  const shutter = useShutter();

  const start = useCallback(async () => {
    if (busy.current || open) return;
    busy.current = true;
    btn.current?.classList.add("is-gone"); // the tag animates away
    await new Promise((r) => setTimeout(r, 160));
    await shutter.cover(); // the page is fully covered
    setRevealed(false);
    setOpen(true); // the room is set up behind the shutter
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await shutter.reveal(); // the shutter rolls on and reveals the film's frame
    setRevealed(true); // ...which then fades in and plays
    busy.current = false;
  }, [open, shutter]);

  const close = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    await shutter.cover(); // roll over the player
    setOpen(false); // back to the page, behind the shutter
    setRevealed(false);
    btn.current?.classList.remove("is-gone");
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await shutter.reveal();
    busy.current = false;
    btn.current?.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
  }, [shutter]);

  // the cursor tag: present as soon as the beat is on screen, then follows the pointer (fine pointers only)
  useEffect(() => {
    const b = btn.current;
    const frame = b?.closest<HTMLElement>(".frame--watch");
    if (!b || !frame) return;
    const isFine = window.matchMedia("(pointer: fine)").matches;
    setFine(isFine);
    if (!isFine) return;
    frame.classList.add("has-play-cursor");
    let x = -1, y = -1, raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      // without the film engine the tag simply sits in its place as a normal button
      const film = document.documentElement.classList.contains("film");
      b.classList.toggle("nofilm", !film);
      frame.classList.toggle("has-play-cursor", film);
      if (!film) return;
      const active = !!frame.closest(".frame-slot[data-active]");
      b.classList.toggle("is-on", active);
      if (!active) { x = -1; return; }
      const tx = pointer.x >= 0 ? pointer.x : innerWidth / 2, ty = pointer.y >= 0 ? pointer.y : innerHeight / 2;
      if (x < 0) { x = tx; y = ty; } // appear right under the pointer, not sliding in from a corner
      x += (tx - x) * 0.22; y += (ty - y) * 0.22;
      b.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
    };
    raf = requestAnimationFrame(tick);
    const click = () => { start(); };
    frame.addEventListener("click", click);
    return () => {
      cancelAnimationFrame(raf);
      frame.classList.remove("has-play-cursor");
      frame.removeEventListener("click", click);
    };
  }, [start]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={`play-tag ${fine ? "is-cursor" : "is-static"}`}
        onClick={(e) => { e.stopPropagation(); start(); }}
        aria-haspopup="dialog"
      >
        {/* the play symbol sits behind the words, both centred on the same point */}
        <svg className="play-tag-icon" viewBox="0.3 0 12 14" aria-hidden="true">
          <path d="M2.2 1.9 L10.4 7 L2.2 12.1 Z" fill="none" stroke="currentColor" strokeWidth="0.55" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="play-tag-text">{label}</span>
      </button>
      <noscript>
        <a className="label link" href={film.loop}>{label} ↗</a>
      </noscript>
      {open && createPortal(<PlayerRoom film={film} title={title} revealed={revealed} onClose={close} />, document.body)}
    </>
  );
}

function PlayerRoom({ film, title, revealed, onClose }: { film: Shot; title: string; revealed: boolean; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [d, setD] = useState(0);
  const [volume, setVolume] = useState(1);
  const lastVolume = useRef(1);
  const room = useRef<HTMLDivElement>(null);
  const [ar, setAr] = useState(film.width / film.height);
  // phones and data saver get the lighter stream; everyone else the full-quality one
  const [src] = useState(() => {
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    return (innerWidth < 810 || !!conn?.saveData) && film.sd ? film.sd : film.loop;
  });
  const [vp, setVp] = useState({ w: innerWidth, h: innerHeight });

  // the film's own shape, as large as fits with room for the controls
  const w = Math.min(vp.w * 0.9, (vp.h * 0.84 - 96) * ar);
  const h = w / ar;
  const frame = { left: (vp.w - w) / 2, top: (vp.h - h - 80) / 2, width: w, height: h };

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("watching"); // the grain fades away, the screening rests
    window.dispatchEvent(new CustomEvent("player", { detail: { open: true } }));
    const onResize = () => setVp({ w: innerWidth, h: innerHeight });
    window.addEventListener("resize", onResize);
    closeBtn.current?.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
    return () => {
      window.removeEventListener("resize", onResize);
      root.classList.remove("watching");
      window.dispatchEvent(new CustomEvent("player", { detail: { open: false } }));
    };
  }, []);

  // once the shutter has rolled away, the film fades in and plays
  useEffect(() => { if (revealed) video.current?.play().catch(() => {}); }, [revealed]);

  const toggle = useCallback(() => {
    const v = video.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {}); else v.pause();
  }, []);
  const close = useCallback(() => {
    video.current?.pause();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    onClose();
  }, [onClose]);
  const setVol = useCallback((v: number) => {
    const el = video.current;
    setVolume(v);
    if (v > 0) lastVolume.current = v;
    if (el) { el.volume = v; el.muted = v === 0; }
  }, []);
  // full screen: the whole room, so the film sits side to side with black bars (never cropped) and keeps our controls
  const fullscreen = useCallback(() => {
    const r = room.current, v = video.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
    if (r?.requestFullscreen) r.requestFullscreen().catch(() => v?.webkitEnterFullscreen?.());
    else v?.webkitEnterFullscreen?.(); // iPhone: the system player, which letterboxes too
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

  return (
    <div ref={room} className={`player-room ${revealed ? "is-revealed" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
      <button ref={closeBtn} type="button" className="player-close player-pill label" onClick={close}>
        CLOSE <span aria-hidden="true">×</span>
      </button>
      <div className="player-frame" style={frame}>
        <video
          ref={video}
          src={src}
          poster={film.src}
          playsInline
          preload="auto"

          onClick={toggle}
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
      <div className="player-bar label" style={{ top: frame.top + frame.height + 22 }}>
        <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="player-round">
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <span className="player-tc">{tc(t)}</span>
        <span className="player-scrub-wrap" style={{ ["--pf" as string]: d ? (t / d).toFixed(4) : "0" }}>
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
          {/* the playhead: a small red dot whose edges ripple slowly (an animated displacement), with a soft glow */}
          <svg className="scrub-knob" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <defs>
              <filter id="knob-warp" x="-30%" y="-30%" width="160%" height="160%">
                <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="2" seed="4" result="n">
                  {!window.matchMedia("(prefers-reduced-motion: reduce)").matches && <animate attributeName="baseFrequency" dur="5.2s" values="0.45;0.75;0.55;0.85;0.45" repeatCount="indefinite" />}
                </feTurbulence>
                <feDisplacementMap in="SourceGraphic" in2="n" scale="3.2" xChannelSelector="R" yChannelSelector="G" />
              </filter>
            </defs>
            <circle cx="9" cy="9" r="5.2" fill="currentColor" filter="url(#knob-warp)" />
          </svg>
        </span>
        <span className="player-tc player-tc--total">{tc(d)}</span>
        <span className="player-vol">
          <button type="button" className="player-vol-btn" aria-label={volume > 0 ? "Mute" : "Unmute"}
            onClick={() => setVol(volume > 0 ? 0 : lastVolume.current || 1)}>
            <VolumeIcon level={volume} />
          </button>
          <input className="player-volume" type="range" min={0} max={1} step={0.01} value={volume} aria-label="Volume"
            style={{ ["--v" as string]: `${volume * 100}%` }} onChange={(e) => setVol(Number(e.target.value))} />
        </span>
        <button type="button" className="player-vol-btn" aria-label="Full screen" onClick={fullscreen}>
          <FullIcon />
        </button>
      </div>
    </div>
  );
}

import type { Shot } from "@/content/site";

/**
 * A clean, borderless picture slot. Server-rendered as a real <img> (or <video> for clips) so the page
 * works with no JavaScript and no WebGL. When the Projector is running it draws the shot on the picture
 * canvas at this element's position and fades the DOM element out (data-ready).
 */
export function Picture({ shot, priority = false }: { shot: Shot; priority?: boolean }) {
  const data = {
    "data-shot": shot.id,
    "data-mode": shot.composition === "full-bleed" ? "full" : "window",
    "data-develop": priority ? "timer" : undefined,
  };
  if (shot.kind === "loop" || shot.kind === "film") {
    // a quiet background loop: the Projector plays it on the picture canvas while its beat is on screen
    return (
      <video
        className="pic"
        {...data}
        data-loop
        poster={shot.src}
        src={shot.loop}
        width={shot.width}
        height={shot.height}
        muted
        loop
        playsInline
        preload="none"
        aria-label={shot.alt}
      />
    );
  }
  if (shot.kind === "clip") {
    return (
      <video
        className="pic"
        {...data}
        data-scrub={shot.scrub}
        poster={shot.src}
        src={shot.loop}
        width={shot.width}
        height={shot.height}
        muted
        loop
        playsInline
        preload="none"
        aria-label={shot.alt}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="pic"
      {...data}
      src={shot.src}
      alt={shot.alt}
      width={shot.width}
      height={shot.height}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
    />
  );
}

export function Window({ shot }: { shot: Shot }) {
  const size = shot.composition === "small-window" ? "small" : "large";
  return (
    <div className={`window window--${size} window--${shot.side ?? "center"}`}>
      <Picture shot={shot} />
    </div>
  );
}

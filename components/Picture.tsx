import type { Shot } from "@/content/site";

/**
 * A clean, borderless picture slot. Server-rendered as a real <img> (or <video> for clips) so the page
 * works with no JavaScript and no WebGL. When the Projector is running it draws the shot on the picture
 * canvas at this element's position and fades the DOM element out (data-ready).
 */
/** How wide each composition is drawn, so the browser fetches the right variant (and the canvas gets it). */
const SIZES: Record<Shot["composition"], string> = {
  "full-bleed": "100vw",
  "large-window": "(max-width: 809px) 86vw, 52vw",
  "small-window": "(max-width: 809px) 64vw, 30vw",
};

export function Picture({ shot, priority = false, sizes }: { shot: Shot; priority?: boolean; sizes?: string }) {
  const data = {
    "data-shot": shot.id,
    "data-mode": shot.composition === "full-bleed" ? "full" : "window",
    "data-develop": priority ? "timer" : undefined,
    "data-focal": shot.focal ? shot.focal.join(",") : undefined,
  };
  const focalPos = shot.focal ? `${shot.focal[0] * 100}% ${shot.focal[1] * 100}%` : undefined;
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
      srcSet={shot.srcSet}
      sizes={shot.srcSet ? sizes ?? SIZES[shot.composition] : undefined}
      alt={shot.alt}
      width={shot.width}
      height={shot.height}
      style={{
        ...(shot.lqip ? { backgroundImage: `url(${shot.lqip})`, backgroundSize: "cover", backgroundPosition: focalPos ?? "center" } : {}),
        ...(focalPos ? { objectPosition: focalPos } : {}),
      }}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
    />
  );
}

export function Window({ shot, sizes }: { shot: Shot; sizes?: string }) {
  const size = shot.composition === "small-window" ? "small" : "large";
  return (
    <div className={`window window--${size} window--${shot.side ?? "center"}`} style={{ ["--ar" as string]: (shot.width / shot.height).toFixed(4) }}>
      <Picture shot={shot} sizes={sizes} />
    </div>
  );
}

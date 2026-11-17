import type { Shot } from "@/content/site";

/** A clean, borderless picture. Renders a flat placeholder until Nico's real frame exists. */
export function Picture({ shot, priority = false }: { shot: Shot; priority?: boolean }) {
  if (shot.src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="pic" src={shot.src} alt={shot.alt} loading={priority ? "eager" : "lazy"} decoding="async" />;
  }
  return (
    <div
      className="pic pic--ph"
      role="img"
      aria-label={shot.alt}
      style={{ aspectRatio: String(shot.aspect ?? 1.66) }}
    />
  );
}

export function Window({ shot }: { shot: Shot }) {
  const size = shot.composition === "small-window" ? "small" : "large";
  const side = shot.side ?? "center";
  return (
    <div className={`window window--${size} window--${side}`}>
      <Picture shot={shot} />
    </div>
  );
}

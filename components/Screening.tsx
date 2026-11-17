import { useTranslations } from "next-intl";
import { site, films, portraits, openingShots } from "@/content/site";
import { Picture, Window } from "./Picture";

/** Italicise the final word of a phrase (one italic word per card at most). */
function WithItalicEnd({ text }: { text: string }) {
  const m = text.match(/^(.*\s)(\S+?)([.!?’”]*)$/);
  if (!m) return <>{text}</>;
  return (<>{m[1]}<em>{m[2]}</em>{m[3]}</>);
}

type Hold = "short" | "normal" | "long" | "t-short" | "t-normal" | "t-long";

/**
 * One beat of the film. Without JavaScript it is a plain screen-height frame (fallback level 5).
 * With the Projector running (html.film), the slot becomes a spacer as tall as the beat's scroll length
 * and the inner .frame is pinned to the screen, shown only while its beat plays.
 */
function Frame({ beat, hold, className = "", children, style }: {
  beat: "picture" | "text"; hold: Hold; className?: string; children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <div className="frame-slot" data-beat={beat} data-hold={hold}>
      <div className={`frame ${className}`} style={style}>{children}</div>
    </div>
  );
}

export function Screening() {
  const t = useTranslations();
  return (
    <main id="content">
      {/* 1. Opening */}
      <section id="top" className="scene" aria-labelledby="h1">
        <Frame beat="picture" hold="long" className="frame--bleed">
          <Picture shot={portraits.opening} priority />
          <div className="frame frame--center" style={{ position: "relative", background: "transparent" }}>
            <h1 id="h1" className="name" data-weave="title">{site.name}</h1>
          </div>
        </Frame>
        <Frame beat="text" hold="t-long" className="frame--center frame--rest">
          <p className="intertitle" data-weave="title" style={{ maxWidth: "20ch" }}>{site.tagline}</p>
        </Frame>
        {openingShots.map((s) => (
          <Frame beat="picture" hold="normal" key={s.id}><Window shot={s} /></Frame>
        ))}
      </section>

      {/* 2. Intertitle */}
      <section className="scene" aria-label="Statement">
        {site.statement.map((line, i) => (
          <Frame beat="text" hold={i === site.statement.length - 1 ? "t-long" : "t-normal"} className="frame--rest frame--center" key={line}>
            <p className="intertitle" data-weave="title" style={{ maxWidth: "16ch" }}>
              {i === site.statement.length - 1 ? <WithItalicEnd text={line} /> : line}
            </p>
          </Frame>
        ))}
      </section>

      {/* 3 & 4. Reels */}
      <div id="films">
        {films.map((film, i) => (
          <section className="scene" key={film.slug} aria-labelledby={`film-${film.slug}`}>
            <Frame beat="text" hold="t-long" className="frame--center">
              <div className="marker-row" data-weave="title">
                <p className="label silver">{t("markers.reel")} {i + 1}</p>
                <h2 id={`film-${film.slug}`} className="title">{film.title}</h2>
              </div>
            </Frame>
            <Frame beat="text" hold="t-short" className="frame--center frame--rest">
              <p className="label">{film.year} · {film.formats.join(" + ").toUpperCase()}</p>
            </Frame>
            <Frame beat="picture" hold="long" className="frame--bleed">
              <Picture shot={film.keyShot} />
              <div className="caption" data-weave="subtitle"><p className="subtitle">{film.synopsis[0]}</p></div>
            </Frame>
            {film.shots.map((s) => (
              <Frame beat="picture" hold={s.kind === "clip" ? "long" : "normal"} key={s.id}><Window shot={s} /></Frame>
            ))}
            <Frame beat="text" hold="t-long" className="frame--text frame--center">
              <p className="subtitle block" data-weave="subtitle" style={{ maxWidth: "44ch" }}>{film.synopsis[1]}</p>
            </Frame>
            <Frame beat="picture" hold="normal"><Window shot={film.lastShot} /></Frame>
            <Frame beat="text" hold="t-long" className="frame--center frame--rest">
              <div className="stack" style={{ justifyItems: "center" }}>
                <a className="label link" href={film.link.href} rel="noopener" target="_blank">
                  {t("labels.viewFilm")} ↗
                </a>
                <p className="label silver">{t("labels.berlinCommercial")}</p>
              </div>
            </Frame>
          </section>
        ))}
      </div>

      {/* 5. Festival circuit */}
      <section className="scene" aria-labelledby="circuit">
        <Frame beat="text" hold="t-long" className="frame--rest frame--center">
          <h2 id="circuit" className="intertitle" data-weave="title">Festival <em>circuit</em></h2>
        </Frame>
        {films.map((film) => (
          <div key={film.slug}>
            <Frame beat="text" hold="t-normal" className="frame--rest frame--center">
              <p className="title" data-weave="title" style={{ fontSize: "var(--t-intertitle)" }}>{film.title}</p>
            </Frame>
            {film.recognition.map((r) => (
              <Frame beat="text" hold="t-short" className="frame--rest frame--text" key={`${film.slug}-${r.kind}-${r.festival}`}>
                <div className="recognition" data-weave="subtitle">
                  <p className="label silver">{r.kind.toUpperCase()}</p>
                  <p className="festival">{r.festival}</p>
                  {(r.year || r.note) && (
                    <p className="body silver">{[r.year, r.note].filter(Boolean).join(" · ")}</p>
                  )}
                </div>
              </Frame>
            ))}
          </div>
        ))}
      </section>

      {/* 6. Behind the camera */}
      <section id="about" className="scene" aria-label="About" data-rest="40">
        <Frame beat="picture" hold="normal"><Window shot={portraits.behind} /></Frame>
        {site.bio.map((line) => (
          <Frame beat="text" hold="t-normal" className="frame--rest frame--text" key={line}>
            <p className="subtitle block" data-weave="subtitle" style={{ marginLeft: "auto", maxWidth: "36ch" }}>{line}</p>
          </Frame>
        ))}
        <Frame beat="picture" hold="normal"><Window shot={portraits.second} /></Frame>
      </section>

      {/* 7. End title */}
      <section id="contact" className="scene" aria-label="Contact" data-rest="0">
        <Frame beat="text" hold="t-long" className="frame--red frame--center">
          <p className="title" data-weave="title">{site.endTitle.join(" ")}</p>
        </Frame>
        <Frame beat="text" hold="t-long" className="frame--red frame--rest frame--center">
          <div className="stack" style={{ justifyItems: "center" }}>
            <p className="label">{site.getInTouch.toUpperCase()}</p>
            <a className="intertitle link" href={`mailto:${site.email}`}>{site.email}</a>
          </div>
        </Frame>
        <Frame beat="text" hold="t-long" className="frame--rest frame--center">
          <p className="label silver">{t("markers.end")}</p>
        </Frame>
      </section>
    </main>
  );
}

import { useTranslations } from "next-intl";
import { site, films, portraits, openingShots } from "@/content/site";
import { Picture, Window } from "./Picture";
import { WatchFilm } from "./Player";

/** Italicise the final word of a phrase (one italic word per card at most). */
function WithItalicEnd({ text }: { text: string }) {
  const m = text.match(/^(.*\s)(\S+?)([.!?’”]*)$/);
  if (!m) return <>{text}</>;
  return (<>{m[1]}<em>{m[2]}</em>{m[3]}</>);
}

type Hold = "short" | "normal" | "long" | "t-short" | "t-normal" | "t-long" | "t-five" | "roll" | "seq";

/**
 * One beat of the film. Without JavaScript it is a plain screen-height frame (fallback level 5).
 * With the Projector running (html.film), the slot becomes a spacer as tall as the beat's scroll length
 * and the inner .frame is pinned to the screen, shown only while its beat plays.
 */
function Frame({ beat, hold, className = "", children, style, n, dim }: {
  beat: "picture" | "text" | "roll" | "seq"; hold: Hold; className?: string; children: React.ReactNode;
  style?: React.CSSProperties; n?: number; dim?: number;
}) {
  return (
    <div className="frame-slot" data-beat={beat} data-hold={hold} data-n={n} data-dim={dim}>
      <div className={`frame ${className}`} style={style}>{children}</div>
    </div>
  );
}

export function Screening() {
  const t = useTranslations();
  return (
    <main id="content">
      {/* 1. Opening */}
      <section id="top" className="scene" data-scene="opening" aria-labelledby="h1">
        <Frame beat="picture" hold="long" className="frame--bleed">
          <Picture shot={portraits.opening} priority />
          <div className="frame frame--center" style={{ position: "relative", background: "transparent" }}>
            <h1 id="h1" className="name" data-weave="title" data-build="print" data-frames="18" data-clock="opening">{site.name}</h1>
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
      <section className="scene" data-scene="statement" aria-label="Statement">
        {site.statement.map((line, i) => (
          <Frame beat="text" hold={i === site.statement.length - 1 ? "t-long" : "t-normal"} className="frame--rest frame--center" key={line}>
            <p className="intertitle" data-weave="title" data-build={i === site.statement.length - 1 ? "late" : undefined} style={{ maxWidth: "16ch" }}>
              {i === site.statement.length - 1 ? <WithItalicEnd text={line} /> : line}
            </p>
          </Frame>
        ))}
      </section>

      {/* 3 & 4. Reels: each plays inside its own reel container, entered through a rolling shutter */}
      <div id="films">
        {films.map((film, i) => {
          const side = film.lastShot.side ?? "left";
          return (
            <section className="scene scene--reel" data-scene={film.slug} data-reel key={film.slug} aria-labelledby={`film-${film.slug}`}>
              <Frame beat="text" hold="t-long" className="frame--center">
                <div className="marker-row" data-weave="title">
                  <p className="label silver">{t("markers.reel")} {i + 1}</p>
                  <h2 id={`film-${film.slug}`} className="title" data-build="print" data-frames="14">{film.title}</h2>
                </div>
              </Frame>
              <Frame beat="text" hold="t-short" className="frame--center frame--rest">
                <p className="label">{film.year} · {film.formats.join(" + ").toUpperCase()}</p>
              </Frame>
              <Frame beat="picture" hold="long" className="frame--bleed">
                <Picture shot={film.keyShot} />
                <div className="caption" data-weave="subtitle"><p className="subtitle subtitle--small">{film.synopsis[0]}</p></div>
              </Frame>
              {/* the closing pair: image 1, the sentence off its corner, image 2 beside the sentence (mirrored in reel 2) */}
              <Frame beat="picture" hold="normal" className={`frame--corner frame--corner-${side}`}>
                <div className="corner-a"><Window shot={film.lastShot} /></div>
                <p className="subtitle subtitle--small corner-text" data-weave="subtitle">{film.synopsis[1]}</p>
                <div className="corner-b"><Window shot={film.secondShot} /></div>
              </Frame>
              {/* watch: a quiet loop of the film behind, and the player on demand */}
              <Frame beat="picture" hold="long" className="frame--bleed frame--watch" dim={0.42}>
                <Picture shot={film.loop} />
                <div className="frame frame--center watch" style={{ position: "relative", background: "transparent" }}>
                  <WatchFilm film={film.film} title={film.title} label={t("labels.watch")} />
                  <a className="label link watch-link" href={film.link.href} rel="noopener" target="_blank">
                    {t("labels.berlinCommercial")} ↗
                  </a>
                </div>
              </Frame>
            </section>
          );
        })}
      </div>

      {/* 5. Festival circuit: the film's title holds at the top; its awards roll up through a box below it */}
      <section className="scene" data-scene="circuit" aria-labelledby="circuit">
        <Frame beat="text" hold="t-long" className="frame--rest frame--center">
          <h2 id="circuit" className="intertitle" data-weave="title" data-build="print" data-frames="14">Festival <em>circuit</em></h2>
        </Frame>
        {films.map((film) => (
          <Frame beat="roll" hold="roll" className="frame--roll" key={film.slug}>
            <p className="title roll-title" data-weave="title">{film.title}</p>
            <div className="roll-box" data-roll-box>
              <ul className="roll-list" data-roll>
                {film.recognition.map((r) => (
                  <li className="roll-item" key={`${r.kind}-${r.festival}`}>
                    {r.laurel ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="laurel" src={r.laurel} alt="" width={72} height={72} loading="lazy" decoding="async" />
                    ) : <span className="laurel" />}
                    <span className="leader" aria-hidden="true" />
                    <div className="roll-text">
                      <p className="label silver">{r.kind.toUpperCase()}</p>
                      <p className="festival">{r.festival}</p>
                      {(r.year || r.note) && <p className="body silver">{[r.year, r.note].filter(Boolean).join(" · ")}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </Frame>
        ))}
      </section>

      {/* 6. Behind the camera: one picture, centred; a rolling shutter brings in the next, which develops, line by line */}
      <section id="about" className="scene" data-scene="about" aria-label="About" data-rest="40">
        <Frame beat="seq" hold="seq" n={site.bio.length} className="frame--seq">
          <div className="seq-window window window--small">
            {portraits.sequence.slice(0, site.bio.length).map((p, k) => (
              <div className="seq-pic" data-seq-pic={k} key={p.id}><Picture shot={p} /></div>
            ))}
          </div>
          <div className="seq-lines">
            {site.bio.map((line, k) => (
              <p className="subtitle seq-line" data-seq-line={k} data-weave="subtitle" key={line}>{line}</p>
            ))}
          </div>
        </Frame>
      </section>

      {/* 7. End title: cut to red; "Let's / make / the / next one." one word per beat */}
      <section id="contact" className="scene" data-scene="end" aria-label="Contact" data-rest="0">
        <Frame beat="text" hold="t-five" className="frame--red frame--center">
          <p className="title end-title" data-weave="title" data-build="words">
            {site.endTitle.map((w, k) => (
              <span key={w}>
                {k === 3 && <br />}
                <span data-word>{w}</span>
                {k < site.endTitle.length - 1 && k !== 2 ? " " : ""}
              </span>
            ))}
          </p>
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

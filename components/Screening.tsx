import { useTranslations } from "next-intl";
import { site, films, portraits } from "@/content/site";
import { Picture, Window } from "./Picture";

/** Italicise the final word of a phrase (one italic word per card at most). */
function WithItalicEnd({ text }: { text: string }) {
  const m = text.match(/^(.*\s)(\S+?)([.!?’”]*)$/);
  if (!m) return <>{text}</>;
  return (<>{m[1]}<em>{m[2]}</em>{m[3]}</>);
}

export function Screening() {
  const t = useTranslations();
  const [first, second] = films;

  return (
    <main id="content">
      {/* 1. Opening */}
      <section id="top" className="scene" aria-labelledby="h1">
        <div className="frame frame--bleed">
          <Picture shot={portraits[0]} priority />
          <div className="frame frame--center" style={{ position: "relative", background: "transparent" }}>
            <h1 id="h1" className="name">{site.name}</h1>
          </div>
        </div>
        <div className="frame frame--center frame--rest">
          <p className="intertitle" style={{ maxWidth: "20ch" }}>{site.tagline}</p>
        </div>
        <div className="frame"><Window shot={first.shots[0]} /></div>
        <div className="frame"><Window shot={second.shots[0]} /></div>
      </section>

      {/* 2. Intertitle */}
      <section className="scene" aria-label="Statement">
        {site.statement.map((line, i) => (
          <div className="frame frame--rest frame--center" key={line}>
            <p className="intertitle" style={{ maxWidth: "16ch" }}>
              {i === site.statement.length - 1 ? <WithItalicEnd text={line} /> : line}
            </p>
          </div>
        ))}
      </section>

      {/* 3 & 4. Reels */}
      <div id="films">
        {films.map((film, i) => (
          <section className="scene" key={film.slug} aria-labelledby={`film-${film.slug}`}>
            <div className="frame frame--center">
              <div className="marker-row">
                <p className="label silver">{t("markers.reel")} {i + 1}</p>
                <h2 id={`film-${film.slug}`} className="title">{film.title}</h2>
              </div>
            </div>
            <div className="frame frame--center frame--rest">
              <p className="label">{film.year} · {film.formats.join(" + ").toUpperCase()}</p>
            </div>
            <div className="frame frame--bleed">
              <Picture shot={film.keyShot} />
              <div className="caption"><p className="subtitle">{film.synopsis[0]}</p></div>
            </div>
            <div className="frame frame--text frame--center">
              <p className="subtitle block" style={{ maxWidth: "44ch" }}>{film.synopsis[1]}</p>
            </div>
            <div className="frame frame--center frame--rest">
              <div className="stack" style={{ justifyItems: "center" }}>
                <a className="label link" href={film.link.href} rel="noopener" target="_blank">
                  {t("labels.viewFilm")} ↗
                </a>
                <p className="label silver">{t("labels.berlinCommercial")}</p>
              </div>
            </div>
          </section>
        ))}
      </div>

      {/* 5. Festival circuit */}
      <section className="scene" aria-labelledby="circuit">
        <div className="frame frame--rest frame--center">
          <h2 id="circuit" className="intertitle">Festival <em>circuit</em></h2>
        </div>
        {films.map((film) => (
          <div key={film.slug}>
            <div className="frame frame--rest frame--center">
              <p className="title" style={{ fontSize: "var(--t-intertitle)" }}>{film.title}</p>
            </div>
            {film.recognition.map((r) => (
              <div className="frame frame--rest frame--text" key={`${film.slug}-${r.kind}-${r.festival}`}>
                <div className="recognition">
                  <p className="label silver">{r.kind.toUpperCase()}</p>
                  <p className="festival">{r.festival}</p>
                  {(r.year || r.note) && (
                    <p className="body silver">{[r.year, r.note].filter(Boolean).join(" · ")}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </section>

      {/* 6. Behind the camera */}
      <section id="about" className="scene" aria-label="About">
        <div className="frame"><Window shot={portraits[1]} /></div>
        {site.bio.map((line) => (
          <div className="frame frame--rest frame--text" key={line}>
            <p className="subtitle block" style={{ marginLeft: "auto", maxWidth: "36ch" }}>{line}</p>
          </div>
        ))}
      </section>

      {/* 7. End title */}
      <section id="contact" className="scene" aria-label="Contact">
        <div className="frame frame--red frame--center">
          <p className="title">{site.endTitle.join(" ")}</p>
        </div>
        <div className="frame frame--red frame--rest frame--center">
          <div className="stack" style={{ justifyItems: "center" }}>
            <p className="label">{site.getInTouch.toUpperCase()}</p>
            <a className="intertitle link" href={`mailto:${site.email}`}>{site.email}</a>
          </div>
        </div>
        <div className="frame frame--rest frame--center">
          <p className="label silver">{t("markers.end")}</p>
        </div>
      </section>
    </main>
  );
}

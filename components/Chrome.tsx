import { useTranslations } from "next-intl";
import { site } from "@/content/site";
import { routing } from "@/i18n/routing";

export function Chrome({ locale }: { locale: string }) {
  const t = useTranslations();
  return (
    <>
      <a className="skip" href="#content">{t("skip")}</a>
      <div className="chrome chrome-name label">
        <a href="#top">{site.nameMark}</a>
      </div>
      <nav className="chrome chrome-nav label" aria-label="Main">
        <ul>
          <li><a href="#films">{t("nav.films")}</a></li>
          <li><a href="#about">{t("nav.about")}</a></li>
          <li><a href="#contact">{t("nav.contact")}</a></li>
        </ul>
        {/* language: a dropdown that works without JavaScript */}
        <details className="lang">
          <summary aria-label={t("language")}>
            <span lang={locale}>{locale.toUpperCase()}</span> <span className="lang-caret" aria-hidden="true">▾</span>
          </summary>
          <ul>
            {routing.locales.map((l) => (
              <li key={l}>
                <a href={`/${l}/`} hrefLang={l} lang={l} aria-current={l === locale ? "true" : undefined}>{l.toUpperCase()}</a>
              </li>
            ))}
          </ul>
        </details>
      </nav>
      {/* phones: INDEX opens a full-screen index, alone on black */}
      <details className="chrome index label">
        <summary>
          <span className="index-open">{t("markers.index")}</span>
          <span className="index-close">{t("close")} <span aria-hidden="true">×</span></span>
        </summary>
        <div className="index-panel">
          <ul className="index-links">
            <li><a href="#films">{t("nav.films")}</a></li>
            <li><a href="#about">{t("nav.about")}</a></li>
            <li><a href="#contact">{t("nav.contact")}</a></li>
          </ul>
          <ul className="index-langs" aria-label={t("language")}>
            {routing.locales.map((l) => (
              <li key={l}>
                <a href={`/${l}/`} hrefLang={l} lang={l} aria-current={l === locale ? "true" : undefined}>{l.toUpperCase()}</a>
              </li>
            ))}
          </ul>
        </div>
      </details>
      {/* the projector line: play the whole film at film speed (1 s of timecode per second), with its progress */}
      <div className="chrome chrome-timecode label">
        <button type="button" className="tc-play" data-autoplay aria-pressed="false" aria-label={t("playFilm")}>
          <svg className="tc-icon tc-icon--play" width="9" height="10" viewBox="0 0 12 14" aria-hidden="true"><path d="M2.2 1.9 L10.4 7 L2.2 12.1 Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
          <svg className="tc-icon tc-icon--pause" width="9" height="10" viewBox="0 0 12 14" aria-hidden="true"><rect x="2.4" y="2" width="2.4" height="10" rx="1" fill="currentColor" /><rect x="7.2" y="2" width="2.4" height="10" rx="1" fill="currentColor" /></svg>
        </button>
        <span data-timecode aria-hidden="true">00:00:00:00</span>
        <span className="tc-bar" aria-hidden="true"><i data-progress /></span>
      </div>
      {/* a long thin line on the hero that invites the first scroll; gone for good once the film moves */}
      <div className="scroll-cue" aria-hidden="true">
        <span className="scroll-cue-line"><i /></span>
        <span className="scroll-cue-label label">{t("scrollDown")}</span>
      </div>
      <div className="chrome chrome-controls label">
        {/* Static without the film engine; a real motion toggle once the Projector runs (WCAG 2.2.2). */}
        <span className="projector-static" aria-hidden="true">{t("markers.projector")} <i>●</i></span>
        <button type="button" className="projector-toggle" data-projector-toggle aria-pressed="true">
          {t("markers.projector")} <i aria-hidden="true" data-projector-dot>●</i>
        </button>
        <span aria-hidden="true">{t("markers.sound")} <i>○</i></span>
      </div>
      {/* viewfinder: thin corner marks and edge ticks that draw in and out with each beat (film mode only) */}
      <div className="viewfinder" aria-hidden="true">
        <i className="vf-c vf-tl" /><i className="vf-c vf-tr" /><i className="vf-c vf-bl" /><i className="vf-c vf-br" />
        <i className="vf-t vf-top" /><i className="vf-t vf-bottom" /><i className="vf-t vf-left" /><i className="vf-t vf-right" />
      </div>
    </>
  );
}

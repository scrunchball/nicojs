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
      <div className="chrome chrome-timecode label" aria-hidden="true">
        <span data-timecode>00:00:00:00</span>
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

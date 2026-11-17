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
        <ul className="langs" aria-label="Language">
          {routing.locales.map((l) => (
            <li key={l}>
              <a href={`/${l}/`} hrefLang={l} lang={l} aria-current={l === locale ? "true" : undefined}>
                {l.toUpperCase()}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="chrome chrome-projector label">
        <span data-timecode aria-hidden="true">00:00:00:00</span>
        {/* Static without the film engine; a real motion toggle once the Projector runs (WCAG 2.2.2). */}
        <span className="projector-static" aria-hidden="true">{t("markers.projector")} ●</span>
        <button type="button" className="projector-toggle" data-projector-toggle aria-pressed="true">
          {t("markers.projector")} <span aria-hidden="true" data-projector-dot>●</span>
        </button>
        <span aria-hidden="true">{t("markers.sound")} ○</span>
      </div>
    </>
  );
}

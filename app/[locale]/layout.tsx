import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import "@fontsource/instrument-serif/latin-400.css";
import "@fontsource/instrument-serif/latin-ext-400.css";
import "@fontsource/instrument-serif/latin-400-italic.css";
import "@fontsource/instrument-serif/latin-ext-400-italic.css";
import "@fontsource/courier-prime/latin-400.css";
import "@fontsource/courier-prime/latin-700.css";
import "@/styles/tokens.css";
import "@/styles/globals.css";

const PENDING = `(function(){var d=document.documentElement;if(window.WebGL2RenderingContext&&!matchMedia('(prefers-reduced-motion: reduce)').matches){d.classList.add('projector-pending');setTimeout(function(){d.classList.remove('projector-pending')},6000)}})()`;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("title"), description: t("description"), robots: { index: false } };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as never)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();
  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        {/* Before first paint: if the film engine can run, hold the opening portrait in black (it develops in). */}
        <script dangerouslySetInnerHTML={{ __html: PENDING }} />
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}

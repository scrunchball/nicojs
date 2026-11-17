import { setRequestLocale } from "next-intl/server";
import { Chrome } from "@/components/Chrome";
import { Screening } from "@/components/Screening";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <Chrome locale={locale} />
      <Screening />
    </>
  );
}

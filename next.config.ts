import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const config: NextConfig = {
  output: "export", // static site until the backend phase (see DECISIONS.md)
  trailingSlash: true,
  images: { unoptimized: true },
};

export default withNextIntl(config);

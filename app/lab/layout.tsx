import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource/instrument-serif/latin-400.css";
import "@fontsource/instrument-serif/latin-400-italic.css";
import "@fontsource/courier-prime/latin-400.css";
import "@fontsource/courier-prime/latin-700.css";
import "@/styles/tokens.css";
import "@/styles/globals.css";
import "./lab.css";

export const metadata: Metadata = { title: "Film lab", robots: { index: false, follow: false } };

export default function LabLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

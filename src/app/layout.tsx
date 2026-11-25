import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { coupleNames, wedding } from "@/content/wedding";
import "./globals.css";

// Self-hosted (see fonts/LICENSES.txt): no third-party font requests from guests' browsers.
const figtree = localFont({
  src: "./fonts/figtree-var.woff2",
  variable: "--font-figtree",
  weight: "300 900",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});
const kalam = localFont({
  src: [
    { path: "./fonts/kalam-400.woff2", weight: "400" },
    { path: "./fonts/kalam-700.woff2", weight: "700" },
  ],
  variable: "--font-kalam",
  display: "swap",
  fallback: ["Segoe Print", "cursive"],
});
const youngSerif = localFont({
  src: "./fonts/young-serif-400.woff2",
  variable: "--font-young-serif",
  weight: "400",
  display: "swap",
  fallback: ["Georgia", "serif"],
});

export const metadata: Metadata = {
  title: { default: `${coupleNames} · Goa`, template: `%s · ${wedding.monogram}` },
  description: "Two sunny days in Goa. The plan, your RSVP and a wall full of love from everyone who's coming.",
  // A private wedding site: keep it out of search results.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#fbf5ea",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${figtree.variable} ${kalam.variable} ${youngSerif.variable} antialiased`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}

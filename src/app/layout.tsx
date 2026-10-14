import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Penjadwal Wawancara Angkatan OS SBM 2026",
    template: "%s · Wawancara Angkatan SBM 2026",
  },
  description:
    "Atur sesi wawancara dan pantau progres 25 IUP + 25 Reguler.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#4338ca",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}

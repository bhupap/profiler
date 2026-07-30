import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profiler — code complexity diagnostics",
  description:
    "Paste code, get flagged hotspots, Big O estimate, and refactor suggestions.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-canvas text-ink antialiased">{children}</body>
    </html>
  );
}

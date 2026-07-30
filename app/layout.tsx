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
      <head>
        {/* Runtime font links — no build-time dependency; system stacks in
            tailwind.config.ts cover a failed load. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-canvas font-sans text-ink antialiased">{children}</body>
    </html>
  );
}

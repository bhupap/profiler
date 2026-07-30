import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Softer dark palette — the near-pure-black version was fatiguing.
        canvas: "#0F1116",
        surface: "#171A21",
        surfaceHi: "#1F232C",
        surfaceMax: "#262B36",
        border: "#2A2F3A",
        borderStrong: "#3A404D",
        ink: "#F5F6F8",         // high-contrast primary text
        inkMute: "#A8ADB8",     // readable muted (~5:1 on canvas)
        inkDim: "#6B7280",
        accent: "#7C9EFF",
        accentSoft: "rgba(124, 158, 255, 0.12)",
        sev: {
          high: "#F87171",
          med: "#FBBF24",
          low: "#94A3B8",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system", "BlinkMacSystemFont",
          "Segoe UI Variable", "Segoe UI",
          "system-ui", "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      fontSize: {
        "2xs": ["11px", { lineHeight: "1.45" }],
        xs:    ["12px", { lineHeight: "1.55" }],
        sm:    ["13px", { lineHeight: "1.6" }],
        base:  ["14px", { lineHeight: "1.65" }],
        lg:    ["16px", { lineHeight: "1.55" }],
        xl:    ["19px", { lineHeight: "1.4" }],
        "2xl": ["24px", { lineHeight: "1.3" }],
        "3xl": ["32px", { lineHeight: "1.15" }],
      },
      letterSpacing: {
        wider: "0.08em",
        widest: "0.14em",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.15)",
      },
    },
  },
  plugins: [],
};
export default config;

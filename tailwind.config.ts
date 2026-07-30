import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Layered near-black — deeper and cooler than before, so the luminous
        // accent and severity hues read as "signal" against a calm ground.
        canvas: "#08090C",       // page floor
        surface: "#0E1116",      // cards / panels
        surfaceHi: "#141821",    // raised (hover, active)
        surfaceMax: "#1B212C",   // topmost chips
        border: "#1D222C",       // hairline
        borderStrong: "#2C3542", // hover / emphasis hairline
        ink: "#F3F6FA",          // primary text
        inkMute: "#9AA4B4",      // readable muted (~5:1 on canvas)
        inkDim: "#5A6472",       // labels, line numbers
        // Luminous cyan signal — the single interactive accent.
        accent: "#5CD6E8",
        accentHi: "#8EE7F3",
        accentSoft: "rgba(92, 214, 232, 0.12)",
        accentLine: "rgba(92, 214, 232, 0.35)",
        // Positive / "accept" — mint, distinct from the cyan signal.
        good: "#5DCAA5",
        sev: {
          high: "#FB7185",
          med: "#FBBF24",
          low: "#94A3B8",
        },
      },
      fontFamily: {
        // Runtime-linked in app/layout.tsx; graceful system fallbacks so a
        // failed font load never breaks the look.
        sans: [
          "-apple-system", "BlinkMacSystemFont",
          "Segoe UI Variable", "Segoe UI",
          "system-ui", "sans-serif",
        ],
        display: [
          '"Space Grotesk"',
          "-apple-system", "Segoe UI", "system-ui", "sans-serif",
        ],
        mono: [
          '"JetBrains Mono"',
          "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace",
        ],
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
        "4xl": ["44px", { lineHeight: "1.05" }],
        "5xl": ["58px", { lineHeight: "1.0" }],
      },
      letterSpacing: {
        wide: "0.04em",
        wider: "0.08em",
        widest: "0.16em",
        mega: "0.28em",
      },
      borderRadius: {
        xl: "14px",
        "2xl": "18px",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.15)",
        lift: "0 8px 30px rgba(0,0,0,0.45)",
        glow: "0 0 0 1px rgba(92,214,232,0.45), 0 0 22px rgba(92,214,232,0.18)",
        glowSoft: "0 0 20px rgba(92,214,232,0.12)",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseDot: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.4", transform: "scale(0.8)" },
        },
        sweep: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        fadeIn: "fadeIn 220ms ease-out both",
        pulseDot: "pulseDot 1.8s ease-in-out infinite",
        sweep: "sweep 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;

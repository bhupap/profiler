import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#0A0A0B",
        surface: "#141416",
        surfaceHi: "#1B1B1F",
        border: "#26262B",
        ink: "#EEEEEC",
        mute: "#86868B",
        accent: "#7C9EFF",
        sev: {
          high: "#E5484D",
          med: "#F5A524",
          low: "#94A3B8",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;

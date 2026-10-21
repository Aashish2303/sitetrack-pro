import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0e1a",
        s1: "#0f1525",
        s2: "#161e34",
        s3: "#1d2742",
        br: "#252f4d",
        br2: "#2e3a5e",
        t1: "#e8ecf7",
        t2: "#a0a8c2",
        t3: "#6b7494",
        acc: "#fb923c",
        bl: "#3b82f6",
        gr: "#10b981",
        rd: "#ef4444",
        pu: "#a78bfa",
        yl: "#fbbf24",
        navy: "#1B2A4A",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        xl: "14px",
      },
    },
  },
  plugins: [],
};
export default config;

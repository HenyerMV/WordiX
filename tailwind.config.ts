import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0A0719",
          900: "#100B26",
          800: "#171135",
          700: "#221A4A",
          600: "#2F2563",
          500: "#40358A",
        },
        paper: "#F4F1FF",
        mist: "#A9A3D1",
        volt: "#C6FF3D",
        bubble: "#FF4D8D",
        sky: "#3DD9FF",
        sun: "#FFC93D",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      keyframes: {
        "pop-in": {
          "0%": { transform: "scale(0.6) rotate(-6deg)", opacity: "0" },
          "100%": { transform: "scale(1) rotate(0deg)", opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        "pop-in": "pop-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        float: "float 4s ease-in-out infinite",
        "pulse-dot": "pulse-dot 1.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;

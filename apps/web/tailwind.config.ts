import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#112031",
        mist: "#f4f7fb",
        fog: "#d9e4f0",
        ocean: "#1d4ed8",
        teal: "#0f766e",
        ember: "#b45309",
      },
      boxShadow: {
        quiet: "0 24px 80px rgba(17, 32, 49, 0.08)",
      },
      fontFamily: {
        display: ["Manrope", "ui-sans-serif", "system-ui"],
        body: ["Inter", "ui-sans-serif", "system-ui"],
      },
    },
  },
  plugins: [],
} satisfies Config;


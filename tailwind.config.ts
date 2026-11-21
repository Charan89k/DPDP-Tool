import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        tli: {
          navy: "#06145B",
          "navy-dark": "#040D3D",
          "navy-border": "#132356",
          cyan: "#2CB3C4",
          "cyan-dark": "#0C9EAB",
          "cyan-light": "#E8F8FA",
          "cyan-border": "#A5E6EE",
          blue: "#4D73B8",
          "blue-hover": "#3B5FA3",
          "blue-light": "#EEF3FC",
          "blue-border": "#C9D9F6",
          electric: "#0B63FF",
          surface: "#F4F7FB",
          border: "#C9D9F6",
          "text-primary": "#06145B",
          "text-secondary": "#223471",
          muted: "#223471",
          success: "#057044",
          "success-light": "#E6F7EF",
          "success-border": "#A3E7C9",
          warning: "#F59E0B",
          "warning-light": "#FFFBEB",
          "warning-border": "#FDE68A",
          danger: "#EF4444",
          "danger-light": "#FEF2F2",
          "danger-border": "#FECACA",
          purple: "#8B5CF6",
          "purple-light": "#FAF5FF",
          "purple-border": "#DDD6FE",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-manrope)",
          "Manrope",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;

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
          navy: "#0B192C",
          "navy-dark": "#081323",
          "navy-border": "#15273F",
          blue: "#0066FF",
          "blue-hover": "#0052CC",
          "blue-light": "#F0F7FF",
          "blue-border": "#BFDBFE",
          surface: "#F4F7FB",
          border: "#E2E8F0",
          "text-primary": "#0F172A",
          "text-secondary": "#64748B",
          success: "#10B981",
          "success-light": "#ECFDF5",
          "success-border": "#A7F3D0",
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

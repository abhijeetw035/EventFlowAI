/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Manrope"', "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ['"Inter"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        /* ── Organic surface stack ── */
        surface: {
          DEFAULT:            "#f5fbef",
          dim:                "#edf3e7",
          bright:             "#f9fff3",
          "container-lowest": "#ffffff",
          "container-low":    "#f0f6ea",
          "container":        "#e8eee2",
          "container-high":   "#dfe6d9",
          "container-highest":"#d6ddd0",
        },
        /* ── On-surface text ── */
        on: {
          surface:         "#171d16",
          "surface-var":   "#424940",
          "primary":       "#ffffff",
          "secondary":     "#ffffff",
          "tertiary":      "#ffffff",
        },
        /* ── Primary: Chlorophyll Green ── */
        primary: {
          DEFAULT:   "#006e1c",
          container: "#94f990",
          on:        "#ffffff",
          "on-cont": "#002204",
        },
        /* ── Secondary: Hydration Blue ── */
        secondary: {
          DEFAULT:   "#0061a4",
          container: "#d1e4ff",
          on:        "#ffffff",
          "on-cont": "#001d36",
        },
        /* ── Tertiary: Vitality Orange ── */
        tertiary: {
          DEFAULT:   "#8b5000",
          container: "#ffdcbe",
          on:        "#ffffff",
          "on-cont": "#2c1600",
        },
        /* ── Error / Critical ── */
        error: {
          DEFAULT:   "#ba1a1a",
          container: "#ffdad6",
          on:        "#ffffff",
          "on-cont": "#410002",
        },
        /* ── Outline (ghost borders only) ── */
        outline: {
          DEFAULT: "#72796f",
          variant: "rgba(114, 121, 111, 0.15)",
        },
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
      },
      boxShadow: {
        ambient: "0 8px 32px rgba(23, 29, 22, 0.05)",
        "ambient-lg": "0 12px 40px rgba(23, 29, 22, 0.07)",
        "ambient-sm": "0 4px 16px rgba(23, 29, 22, 0.04)",
        float: "0 16px 40px rgba(23, 29, 22, 0.08)",
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          "0%": { opacity: "0", maxHeight: "0" },
          "100%": { opacity: "1", maxHeight: "800px" },
        },
        breathe: {
          "0%, 100%": { transform: "scale(1)", opacity: "0.6" },
          "50%": { transform: "scale(2.2)", opacity: "0" },
        },
        pressIn: {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(0.98)" },
          "100%": { transform: "scale(1)" },
        },
      },
      animation: {
        fadeIn: "fadeIn 0.45s ease-out both",
        slideDown: "slideDown 0.35s ease-out both",
        breathe: "breathe 2s ease-out infinite",
        pressIn: "pressIn 0.2s ease-out",
      },
    },
  },
  plugins: [],
};

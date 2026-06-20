/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        console: {
          bg: "#0b1120",
          panel: "#111827",
          panel2: "#182033",
          line: "#263244",
          text: "#e5e7eb",
          muted: "#94a3b8",
        },
      },
    },
  },
  plugins: [],
};

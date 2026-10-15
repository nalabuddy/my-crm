import type { Config } from "tailwindcss";
const v = (n: string) => `rgb(var(--${n}) / <alpha-value>)`;
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: v("bg"), card: v("card"), line: v("line"), ink: v("ink"), muted: v("muted"),
        accent: v("accent"), "accent-ink": v("accent-ink"), good: v("good"), bad: v("bad"), warn: v("warn"),
      },
    },
  },
  plugins: [],
};
export default config;

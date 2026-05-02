import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx,mdx}",
    "./components/**/*.{ts,tsx,mdx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",

        surface: "hsl(var(--surface) / <alpha-value>)",
        "surface-elevated": "hsl(var(--surface-elevated) / <alpha-value>)",
        "surface-inset": "hsl(var(--surface-inset) / <alpha-value>)",

        muted: "hsl(var(--muted) / <alpha-value>)",
        "muted-foreground": "hsl(var(--muted-foreground) / <alpha-value>)",

        subtle: "hsl(var(--subtle) / <alpha-value>)",
        "subtle-foreground": "hsl(var(--subtle-foreground) / <alpha-value>)",

        border: "hsl(var(--border) / <alpha-value>)",
        "border-subtle": "hsl(var(--border-subtle) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",

        accent: "hsl(var(--accent) / <alpha-value>)",
        "accent-foreground": "hsl(var(--accent-foreground) / <alpha-value>)",

        sky: "hsl(var(--sky) / <alpha-value>)",
        "sky-foreground": "hsl(var(--sky-foreground) / <alpha-value>)",

        danger: "hsl(var(--danger) / <alpha-value>)",
        "danger-foreground": "hsl(var(--danger-foreground) / <alpha-value>)",

        warning: "hsl(var(--warning) / <alpha-value>)",
        "warning-foreground": "hsl(var(--warning-foreground) / <alpha-value>)",

        success: "hsl(var(--success) / <alpha-value>)",
        "success-foreground": "hsl(var(--success-foreground) / <alpha-value>)",

        "score-terrible": "hsl(var(--score-terrible) / <alpha-value>)",
        "score-terrible-foreground":
          "hsl(var(--score-terrible-foreground) / <alpha-value>)",
        "score-ok": "hsl(var(--score-ok) / <alpha-value>)",
        "score-ok-foreground": "hsl(var(--score-ok-foreground) / <alpha-value>)",
        "score-great": "hsl(var(--score-great) / <alpha-value>)",
        "score-great-foreground":
          "hsl(var(--score-great-foreground) / <alpha-value>)",
      },
      boxShadow: {
        soft: "0 10px 30px -15px hsl(var(--shadow) / 0.22)",
        card: "0 8px 24px -12px hsl(var(--shadow) / 0.18)",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
      },
      backgroundImage: {
        "page-clear":
          "linear-gradient(to bottom, hsl(var(--background)), hsl(var(--surface)))",
        "page-overcast":
          "linear-gradient(to bottom, hsl(var(--background)), hsl(var(--surface-inset)))",
        "page-severe":
          "linear-gradient(to bottom, hsl(var(--background)), hsl(var(--surface-elevated)))",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        geist: ["var(--font-geist)", "system-ui", "sans-serif"],
        editorial: ["var(--font-editorial)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;

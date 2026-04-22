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

        "status-go": "hsl(var(--status-go-bg) / <alpha-value>)",
        "status-maybe": "hsl(var(--status-maybe-bg) / <alpha-value>)",
        "status-skip": "hsl(var(--status-skip-bg) / <alpha-value>)",
      },
      boxShadow: {
        "elev-1": "0 1px 2px hsl(var(--shadow) / 0.06)",
        "elev-2": "0 2px 10px hsl(var(--shadow) / 0.10)",
        "elev-3": "0 8px 24px -6px hsl(var(--shadow) / 0.14)",
        "elev-4": "0 16px 40px -12px hsl(var(--shadow) / 0.22)",
        soft: "0 8px 24px -6px hsl(var(--shadow) / 0.14)",
        card: "0 2px 10px hsl(var(--shadow) / 0.10)",
      },
      borderRadius: {
        xs: "2px",
        sm: "6px",
        md: "10px",
        lg: "14px",
        xl: "20px",
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
        display: ["var(--font-display)", "'Manrope'", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "'Inter'", "system-ui", "sans-serif"],
      },
      transitionTimingFunction: {
        standard: "cubic-bezier(0.2, 0, 0, 1)",
        entrance: "cubic-bezier(0.22, 1, 0.36, 1)",
        exit: "cubic-bezier(0.4, 0, 1, 1)",
      },
    },
  },
  plugins: [],
};

export default config;

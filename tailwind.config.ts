import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // ── NexCell Brand Colors ──────────────────────────────────
      // Extracted directly from the logo:
      // Navy backgrounds, white text, cyan→blue gradient accents
      colors: {
        // Primary backgrounds
        navy: {
          950: "#070B14",   // Deepest background (page bg)
          900: "#0D1117",   // Card backgrounds
          800: "#141B2D",   // Elevated cards
          700: "#1C2540",   // Borders, dividers
          600: "#263052",   // Hover states
          500: "#2E3D6B",   // Active states
        },
        // Cyan accent (from the logo gradient — "Cell" in NexCell)
        cyan: {
          400: "#22D3EE",
          500: "#06B6D4",
          600: "#0891B2",
        },
        // Blue accent (from the logo gradient — "Nex" in NexCell)
        brand: {
          400: "#38BDF8",
          500: "#0EA5E9",
          600: "#0284C7",
          700: "#0369A1",
        },
        // Neon glow colors for accents, badges, CTAs
        neon: {
          blue:  "#00D4FF",
          cyan:  "#00FFED",
          green: "#39FF14",
        },
        // Semantic colors (status indicators)
        success: "#10B981",
        warning: "#F59E0B",
        danger:  "#EF4444",
        info:    "#6366F1",
      },

      // ── Typography ────────────────────────────────────────────
      fontFamily: {
        sans:  ["Inter", "system-ui", "sans-serif"],
        mono:  ["JetBrains Mono", "Fira Code", "monospace"],
        display: ["Inter", "system-ui", "sans-serif"],
      },

      // ── Custom Spacing for the design system ─────────────────
      spacing: {
        "18": "4.5rem",
        "88": "22rem",
        "128": "32rem",
      },

      // ── Border Radius ─────────────────────────────────────────
      borderRadius: {
        "xl": "0.75rem",
        "2xl": "1rem",
        "3xl": "1.5rem",
      },

      // ── Box Shadows — glassmorphism + neon glow ───────────────
      boxShadow: {
        // Glassmorphism cards
        "glass":     "0 4px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
        "glass-lg":  "0 8px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.08)",
        // Neon glow — used on CTAs and active states
        "neon-blue": "0 0 20px rgba(0, 212, 255, 0.4), 0 0 60px rgba(0, 212, 255, 0.1)",
        "neon-cyan": "0 0 20px rgba(0, 255, 237, 0.4), 0 0 60px rgba(0, 255, 237, 0.1)",
        "neon-sm":   "0 0 10px rgba(0, 212, 255, 0.3)",
        // Soft inset for input fields
        "inner-dark": "inset 0 2px 8px rgba(0, 0, 0, 0.4)",
      },

      // ── Backdrop blur ─────────────────────────────────────────
      backdropBlur: {
        "xs": "4px",
      },

      // ── Gradients (as background-image utilities) ─────────────
      backgroundImage: {
        // Main brand gradient — matches the logo
        "brand-gradient":    "linear-gradient(135deg, #0EA5E9 0%, #06B6D4 50%, #00FFED 100%)",
        "brand-gradient-r":  "linear-gradient(270deg, #0EA5E9 0%, #06B6D4 50%, #00FFED 100%)",
        // Page background — deep dark with subtle radial glow
        "page-bg":           "radial-gradient(ellipse at top, #141B2D 0%, #070B14 60%)",
        // Card background
        "card-bg":           "linear-gradient(145deg, #141B2D 0%, #0D1117 100%)",
        // Neon glow overlay for hero sections
        "hero-glow":         "radial-gradient(ellipse at 50% 0%, rgba(6,182,212,0.15) 0%, transparent 60%)",
        // Wallet card
        "wallet-card":       "linear-gradient(135deg, #0D1117 0%, #141B2D 50%, #0D1117 100%)",
      },

      // ── Animations ────────────────────────────────────────────
      keyframes: {
        // Fade up — used for page transitions and cards
        "fade-up": {
          "0%":   { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        // Fade in
        "fade-in": {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        // Pulse glow — used on neon elements
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(0, 212, 255, 0.3)" },
          "50%":       { boxShadow: "0 0 40px rgba(0, 212, 255, 0.7), 0 0 80px rgba(0, 212, 255, 0.2)" },
        },
        // Shimmer — used on skeleton loaders
        "shimmer": {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        // Float — subtle bob for hero elements
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":       { transform: "translateY(-8px)" },
        },
        // Slide in from right — for notifications
        "slide-in-right": {
          "0%":   { transform: "translateX(100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        // Number count up — for stats
        "count-up": {
          "0%":   { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        // Spin slow — for loading indicators
        "spin-slow": {
          "0%":   { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        // Neon border animation
        "border-flow": {
          "0%":   { backgroundPosition: "0% 50%" },
          "50%":  { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
      },
      animation: {
        "fade-up":       "fade-up 0.5s ease-out forwards",
        "fade-in":       "fade-in 0.3s ease-out forwards",
        "glow-pulse":    "glow-pulse 2s ease-in-out infinite",
        "shimmer":       "shimmer 2s linear infinite",
        "float":         "float 4s ease-in-out infinite",
        "slide-in-right":"slide-in-right 0.3s ease-out forwards",
        "spin-slow":     "spin-slow 3s linear infinite",
        "border-flow":   "border-flow 3s ease infinite",
      },

      // ── Transitions ───────────────────────────────────────────
      transitionDuration: {
        "400": "400ms",
      },

      // ── Z-index scale ─────────────────────────────────────────
      zIndex: {
        "60":  "60",
        "70":  "70",
        "80":  "80",
        "90":  "90",
        "100": "100",
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms")({
      strategy: "class", // Only apply form styles when using the class
    }),
    require("@tailwindcss/typography"),
  ],
};

export default config;

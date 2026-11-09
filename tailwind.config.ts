
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Rubik', 'system-ui', 'sans-serif'],
        v2: ['Heebo', 'Assistant', 'Arial', 'sans-serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "#00BFBF",
          foreground: "#FFFFFF",
          50: "#E6FAFA",
          100: "#CCF5F5",
          200: "#99EBEB",
          300: "#66E0E0",
          400: "#33D6D6",
          500: "#00BFBF",
          600: "#009999",
          700: "#007373",
          800: "#004D4D",
          900: "#002626",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "#FFA940",
          foreground: "#FFFFFF",
          50: "#FFF7ED",
          100: "#FFEDD5",
          200: "#FED7AA",
          300: "#FDBA74",
          400: "#FB923C",
          500: "#FFA940",
          600: "#EA580C",
          700: "#C2410C",
          800: "#9A3412",
          900: "#7C2D12",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        turquoise: "#00BFBF",
        mango: "#FFA940",
        v2: {
          "primary": "hsl(var(--v2-primary))",
          "primary-dark": "hsl(var(--v2-primary-dark))",
          "primary-soft": "hsl(var(--v2-primary-soft))",
          "text": "hsl(var(--v2-text))",
          "navy": "hsl(var(--v2-navy))",
          "muted": "hsl(var(--v2-muted))",
          "bg": "hsl(var(--v2-bg))",
          "surface": "hsl(var(--v2-surface))",
          "border": "hsl(var(--v2-border))",
          "table-head": "hsl(var(--v2-table-head))",
          "blue": "hsl(var(--v2-blue))",
          "blue-soft": "hsl(var(--v2-blue-soft))",
          "green": "hsl(var(--v2-green))",
          "green-soft": "hsl(var(--v2-green-soft))",
          "amber": "hsl(var(--v2-amber))",
          "amber-soft": "hsl(var(--v2-amber-soft))",
          "purple": "hsl(var(--v2-purple))",
          "purple-soft": "hsl(var(--v2-purple-soft))",
          "red": "hsl(var(--v2-red))",
          "red-soft": "hsl(var(--v2-red-soft))",
        },
      },
      boxShadow: { v2: "var(--v2-shadow)" },
      borderRadius: {
        "v2-sm": "10px",
        "v2-control": "12px",
        "v2-card": "14px",
        "v2-panel": "16px",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

export default config;

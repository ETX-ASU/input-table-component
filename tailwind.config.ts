import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class", "media"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        lightGray: {
          dark80: "#FFFFFF",
          dark60: "#F5F5F5",
          100: "#C2C2C2",
          80: "#CCCCCC",
          60: "#D6D6D6",
          40: "#E2E2E2",
          20: "#EBEBEB",
        },
        gray: {
          100: "#000000",
          80: "#242424",
          60: "#333333",
          40: "#484848",
          20: "#5C5C5C",
          dark60: "#999999",
          dark80: "#ADADAD",
        },
        yellow: {
          dark80: "#CAB600",
          dark60: "#978800",
          100: "#FCE300",
          80: "#FDE933",
          60: "#FDEE66",
          40: "#FEF4CC",
          20: "#FEF9CC",
        },
        red: {
          dark80: "#971925",
          dark60: "#71131C",
          100: "#BD1F2E",
          80: "#CA4C58",
          60: "#D77982",
          40: "#E5A5AB",
          20: "#F2D2D5",
        },
        green: {
          dark80: "#144B26",
          dark60: "#0F381C",
          100: "#195E2F",
          80: "#477E59",
          60: "#759E82",
          40: "#A3BFAC",
          20: "#D1DFD5",
        },
        purple: {
          dark80: "#491F60",
          dark60: "#371748",
          100: "#5B2778",
          80: "#7C5293",
          60: "#9D7DAE",
          40: "#BDA9C9",
          20: "#DED4E4",
        },
        blue: {
          dark80: "#00516B",
          dark60: "#003D50",
          100: "#006586",
          80: "#3398B9",
          60: "#66B2CB",
          40: "#99CBDC",
          20: "#CCE5EE",
        },
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
export default config;

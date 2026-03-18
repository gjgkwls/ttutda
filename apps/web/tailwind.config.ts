import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ttutda: {
          ink: "#102a43",
          cyan: "#0ea5e9",
          mint: "#10b981",
          sand: "#f5f7eb"
        }
      }
    }
  },
  plugins: []
};

export default config;

// Fonts are bundled from @fontsource packages (SIL Open Font License): no network at render time.
// Add a family here, and its package in package.json, if the product uses another one.
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/800.css";
import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/700.css";
import "@fontsource/montserrat/800.css";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@fontsource/poppins/800.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/dm-sans/800.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
import { config } from "./config";

const SANS = ["Inter", "Montserrat", "Poppins", "DM Sans"];
const MONO = ["IBM Plex Mono", "JetBrains Mono"];

export const F = {
  sans: `"${SANS.includes(config.fonts.sans) ? config.fonts.sans : "Inter"}", system-ui, sans-serif`,
  mono: `"${MONO.includes(config.fonts.mono) ? config.fonts.mono : "JetBrains Mono"}", ui-monospace, monospace`,
};

export const C = config.theme;

import { Geist_Mono } from "next/font/google"
import localFont from "next/font/local"

// Tipografía de marca. globals.css las expone como --font-sans y --font-heading.
// - Texto: Open Sauce Sans (licencia OFL), servida desde la app.
// - Títulos: TeX Gyre Heros (licencia GUST, libre para la web), un clon de Helvetica: se ve igual en
//   todos los equipos. Helvetica no se usa: incrustarla requiere una licencia web de Monotype.
const sans = localFont({
  variable: "--typeface-sans",
  display: "swap",
  // El 400 va en woff: el woff2 publicado en @fontsource/open-sauce-sans 5.3.0 está dañado.
  src: [
    { path: "../../assets/fonts/open-sauce-sans/open-sauce-sans-400.woff", weight: "400", style: "normal" },
    { path: "../../assets/fonts/open-sauce-sans/open-sauce-sans-500.woff2", weight: "500", style: "normal" },
    { path: "../../assets/fonts/open-sauce-sans/open-sauce-sans-600.woff2", weight: "600", style: "normal" },
    { path: "../../assets/fonts/open-sauce-sans/open-sauce-sans-700.woff2", weight: "700", style: "normal" },
  ],
})

const heading = localFont({
  variable: "--typeface-heading",
  display: "swap",
  src: [
    { path: "../../assets/fonts/tex-gyre-heros/tex-gyre-heros-400.woff2", weight: "400", style: "normal" },
    { path: "../../assets/fonts/tex-gyre-heros/tex-gyre-heros-700.woff2", weight: "700", style: "normal" },
  ],
})

const mono = Geist_Mono({
  variable: "--typeface-mono",
  subsets: ["latin"],
  display: "swap",
})

export const fontVariables = [sans.variable, heading.variable, mono.variable].join(" ")

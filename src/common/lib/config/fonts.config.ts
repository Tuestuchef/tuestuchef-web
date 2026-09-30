import { Geist, Geist_Mono } from "next/font/google"

// Fuentes neutras por ahora. Para cambiar la tipografía de marca se cambia aquí;
// globals.css las expone como --font-sans y --font-heading.
const sans = Geist({
  variable: "--typeface-sans",
  subsets: ["latin"],
  display: "swap",
})

const heading = Geist({
  variable: "--typeface-heading",
  subsets: ["latin"],
  display: "swap",
})

const mono = Geist_Mono({
  variable: "--typeface-mono",
  subsets: ["latin"],
  display: "swap",
})

export const fontVariables = [sans.variable, heading.variable, mono.variable].join(" ")

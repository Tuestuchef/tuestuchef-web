import { oklchToHex } from "@/common/lib/utils/color.util"

// Colores de los documentos generados (PDF de presupuestos). Un PDF no lee las variables CSS,
// así que aquí van los MISMOS valores del tema claro de globals.css (:root), copiados tal cual.
// Una prueba falla si dejan de coincidir: al aplicar la marca, se cambian allá y aquí.
const LIGHT_TOKENS = {
  background: "oklch(1 0 0)",
  foreground: "oklch(0.145 0 0)",
  muted: "oklch(0.97 0 0)",
  "muted-foreground": "oklch(0.556 0 0)",
  border: "oklch(0.922 0 0)",
  primary: "oklch(0.205 0 0)",
} as const

export type DocumentToken = keyof typeof LIGHT_TOKENS

export const DOCUMENT_THEME_SOURCE: Readonly<Record<DocumentToken, string>> = LIGHT_TOKENS

export const documentTheme = Object.fromEntries(
  Object.entries(LIGHT_TOKENS).map(([token, value]) => [token, oklchToHex(value)])
) as Record<DocumentToken, string>

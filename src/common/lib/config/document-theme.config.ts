import { oklchToHex } from "@/common/lib/utils/color.util"

// Colores de los documentos generados (PDF de presupuestos). Un PDF no lee las variables CSS,
// así que aquí van los MISMOS valores del tema claro de globals.css (:root), copiados tal cual.
// Una prueba falla si dejan de coincidir: si cambia el tema, se cambian allá y aquí.
// El papel usa --card (blanco), no --background (el fondo gris claro de la pantalla).
const LIGHT_TOKENS = {
  card: "#ffffff",
  foreground: "#0f0f0f",
  muted: "#e6e6e4",
  "muted-foreground": "#6b6b6b",
  border: "#dcdcda",
  primary: "#0f0f0f",
  brand: "#960d13",
} as const

export type DocumentToken = keyof typeof LIGHT_TOKENS

export const DOCUMENT_THEME_SOURCE: Readonly<Record<DocumentToken, string>> = LIGHT_TOKENS

const toHex = (value: string) => (value.startsWith("#") ? value : oklchToHex(value))

export const documentTheme = Object.fromEntries(
  Object.entries(LIGHT_TOKENS).map(([token, value]) => [token, toHex(value)])
) as Record<DocumentToken, string>

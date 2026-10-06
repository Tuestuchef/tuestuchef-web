import type { StaticImageData } from "next/image"

import appleTouchIcon from "@/common/assets/brand/apple-touch-icon.png"
import favicon from "@/common/assets/brand/favicon.png"
import pwaIcon192 from "@/common/assets/brand/pwa-icon-192.png"
import pwaIcon512 from "@/common/assets/brand/pwa-icon-512.png"
import socialImage from "@/common/assets/brand/social-image.png"

// Única fuente de verdad de la marca.
// - El logo se usa siempre con <Logo> (src/common/components/logo); sus archivos están en
//   src/common/assets/logo. Los íconos de abajo salen del ícono a color.
// - Los colores y las fuentes viven en src/app/globals.css y fonts.config.ts.
export const brandConfig = {
  name: "Tuestuchef",
  shortName: "Tuestuchef",
  slogan: "Indumentaria gastronómica",
  description: "Panel administrativo de Tuestuchef",
  // Último recurso del PDF si no se puede leer el logo.
  monogram: "TC",

  icons: {
    favicon: favicon as StaticImageData,
    appleTouch: appleTouchIcon,
    pwa192: pwaIcon192,
    pwa512: pwaIcon512,
  },

  socialImage,

  // Para la app instalada (barra del sistema y pantalla de inicio): no leen variables CSS.
  // Es el mismo negro de --ink en globals.css.
  appColor: "#0f0f0f",

  // Nombres de referencia. La carga real está en fonts.config.ts y globals.css.
  typography: {
    sans: "Open Sauce Sans",
    heading: "TeX Gyre Heros",
  },

  // El contacto (correo, teléfono, RIF…) no va aquí: owner y admin lo editan en
  // Configuración → Datos de la empresa (tabla business_profile).
} as const

export type BrandConfig = typeof brandConfig

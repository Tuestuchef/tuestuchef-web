import type { StaticImageData } from "next/image"

import appleTouchIcon from "@/common/assets/brand/apple-touch-icon.png"
import favicon from "@/common/assets/brand/favicon.svg"
import logoFullDark from "@/common/assets/brand/logo-full-dark.svg"
import logoFull from "@/common/assets/brand/logo-full.svg"
import logoIconDark from "@/common/assets/brand/logo-icon-dark.svg"
import logoIcon from "@/common/assets/brand/logo-icon.svg"
import pwaIcon192 from "@/common/assets/brand/pwa-icon-192.png"
import pwaIcon512 from "@/common/assets/brand/pwa-icon-512.png"
import socialImage from "@/common/assets/brand/social-image.png"

// Única fuente de verdad de la marca. Para aplicar la identidad final:
// 1. Reemplazar los archivos de src/common/assets/brand (mismos nombres).
// 2. Poner `logo.ready` en true.
// 3. Cambiar los valores de los tokens en src/app/globals.css.
export const brandConfig = {
  name: "Tuestuchef",
  shortName: "Tuestuchef",
  slogan: "Indumentaria gastronómica",
  description: "Panel administrativo de Tuestuchef",
  // Se muestra mientras no haya logo final.
  monogram: "TC",

  logo: {
    ready: false,
    full: { light: logoFull as StaticImageData, dark: logoFullDark as StaticImageData },
    icon: { light: logoIcon as StaticImageData, dark: logoIconDark as StaticImageData },
  },

  icons: {
    favicon: favicon as StaticImageData,
    appleTouch: appleTouchIcon,
    pwa192: pwaIcon192,
    pwa512: pwaIcon512,
  },

  socialImage,

  // Nombres de referencia (recibos, correos). La carga real está en fonts.config.ts.
  typography: {
    sans: "Geist",
    heading: "Geist",
  },

  // Datos para recibos y correos. Completar con los datos reales.
  contact: {
    email: "",
    phone: "",
    whatsapp: "",
    instagram: "",
    address: "",
    taxId: "",
  },
} as const

export type BrandConfig = typeof brandConfig

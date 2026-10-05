import type { MetadataRoute } from "next"

// El panel no se indexa (todo pide sesión) y los enlaces públicos de presupuestos tampoco.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } }
}

import type { MetadataRoute } from "next"

import { brandConfig } from "@/common/lib/config/brand.config"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brandConfig.name,
    short_name: brandConfig.shortName,
    description: brandConfig.description,
    lang: "es",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    icons: [
      { src: brandConfig.icons.pwa192.src, sizes: "192x192", type: "image/png" },
      { src: brandConfig.icons.pwa512.src, sizes: "512x512", type: "image/png" },
      {
        src: brandConfig.icons.pwa512.src,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}

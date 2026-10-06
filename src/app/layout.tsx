import type { Metadata, Viewport } from "next"

import { brandConfig } from "@/common/lib/config/brand.config"
import { publicEnv } from "@/common/lib/config/env.config"
import { fontVariables } from "@/common/lib/config/fonts.config"
import { AppProvider } from "@/common/lib/providers/app.provider"

import "./globals.css"

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_SITE_URL),
  title: {
    default: brandConfig.name,
    template: `%s · ${brandConfig.name}`,
  },
  description: brandConfig.description,
  applicationName: brandConfig.name,
  appleWebApp: {
    capable: true,
    title: brandConfig.shortName,
    statusBarStyle: "default",
  },
  icons: {
    icon: brandConfig.icons.favicon.src,
    apple: brandConfig.icons.appleTouch.src,
  },
  openGraph: {
    siteName: brandConfig.name,
    images: [brandConfig.socialImage.src],
  },
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: brandConfig.appColor,
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${fontVariables} antialiased`} suppressHydrationWarning>
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  )
}

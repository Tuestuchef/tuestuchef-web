import { NextResponse, type NextRequest } from "next/server"

import {
  PUBLIC_ROUTES,
  REDIRECT_PARAM,
  ROUTES,
} from "@/common/lib/constants/routes.constants"
import { updateSupabaseSession } from "@/common/lib/db/supabase-proxy.client"

// Chequeo optimista de sesión. La autorización real vive en RLS y en cada servicio.
export async function proxy(request: NextRequest) {
  const { response, isAuthenticated } = await updateSupabaseSession(request)
  const { pathname, search } = request.nextUrl
  const isPublic = PUBLIC_ROUTES.includes(pathname)

  if (!isAuthenticated && !isPublic) {
    const url = new URL(ROUTES.LOGIN, request.url)
    if (pathname !== ROUTES.HOME) {
      url.searchParams.set(REDIRECT_PARAM, pathname + search)
    }
    return NextResponse.redirect(url)
  }

  if (isAuthenticated && pathname === ROUTES.LOGIN) {
    return NextResponse.redirect(new URL(ROUTES.HOME, request.url))
  }

  return response
}

export const config = {
  matcher: [
    // Todo excepto estáticos, imágenes, íconos y el manifest de la PWA.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon|apple-icon|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}

import type { EmailOtpType } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"

import { ROUTES, SIGN_OUT_REASON_PARAM } from "@/common/lib/constants/routes.constants"
import { EMAIL_LINK_TYPES } from "@/modules/auth/lib/constants/auth.constants"
import { verifyEmailLink } from "@/modules/auth/lib/services/auth.service"

// Destino del enlace de invitación: valida el token y entra al panel
// (owner y admin pasan antes por la configuración de 2FA).
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash")
  const type = request.nextUrl.searchParams.get("type")

  if (tokenHash && EMAIL_LINK_TYPES.includes(type as (typeof EMAIL_LINK_TYPES)[number])) {
    const result = await verifyEmailLink(tokenHash, type as EmailOtpType)
    if (result.ok) return NextResponse.redirect(new URL(ROUTES.HOME, request.url))
  }

  const login = new URL(ROUTES.LOGIN, request.url)
  login.searchParams.set(SIGN_OUT_REASON_PARAM, "link_invalid")
  return NextResponse.redirect(login)
}

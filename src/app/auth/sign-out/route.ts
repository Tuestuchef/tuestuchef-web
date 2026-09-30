import { NextResponse, type NextRequest } from "next/server"

import {
  ROUTES,
  SIGN_OUT_REASON_PARAM,
} from "@/common/lib/constants/routes.constants"
import { signOut } from "@/common/lib/services/session.service"

async function handleSignOut(request: NextRequest) {
  await signOut()

  const url = new URL(ROUTES.LOGIN, request.url)
  const reason = request.nextUrl.searchParams.get(SIGN_OUT_REASON_PARAM)
  if (reason) url.searchParams.set(SIGN_OUT_REASON_PARAM, reason)

  // 303: tras un POST el navegador sigue con GET.
  return NextResponse.redirect(url, { status: 303 })
}

export const GET = handleSignOut
export const POST = handleSignOut

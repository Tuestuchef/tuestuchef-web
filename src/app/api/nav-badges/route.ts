import { NextResponse } from "next/server"

import { getSessionState } from "@/common/lib/services/session.service"
import { getNavBadges } from "@/modules/home/lib/services/nav-badges.service"

// Contadores del menú lateral para el usuario de la sesión.
export async function GET() {
  const session = await getSessionState()
  if (session.status !== "active") return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  const badges = await getNavBadges(session.user.role)
  return NextResponse.json(badges, { headers: { "Cache-Control": "private, no-store" } })
}

import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { isRoleIn, ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { getSessionState } from "@/common/lib/services/session.service"
import { buildPeriodWorkbook } from "@/modules/analytics/lib/services/period-export.service"

// Excel del mes para el contador: solo owner y admin con sesión completa (RLS vuelve a filtrar).
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/exports/[month]">) {
  const session = await getSessionState()
  if (session.status !== "active" || !isRoleIn(session.user.role, ROLE_GROUPS.MANAGEMENT)) {
    return new NextResponse("No autorizado.", { status: 401 })
  }
  const { month } = await ctx.params
  if (!z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).safeParse(month).success) {
    return new NextResponse("Mes inválido.", { status: 400 })
  }

  const file = await buildPeriodWorkbook(month)
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="tuestuchef-${month}.xlsx"`,
      "Cache-Control": "no-store",
    },
  })
}

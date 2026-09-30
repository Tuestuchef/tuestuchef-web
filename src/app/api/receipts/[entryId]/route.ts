import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { getSessionState } from "@/common/lib/services/session.service"
import { getEntryReceiptUrl } from "@/modules/money-movements/lib/services/ledger.service"

// Redirige a una URL prefirmada de corta duración. Verifica la sesión y, vía RLS,
// que la persona pueda ver ese movimiento.
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/receipts/[entryId]">) {
  const session = await getSessionState()
  if (session.status !== "active") return new NextResponse("No autorizado.", { status: 401 })

  const { entryId } = await ctx.params
  if (!z.uuid().safeParse(entryId).success) return new NextResponse("No encontrado.", { status: 404 })

  const result = await getEntryReceiptUrl(entryId)
  if (!result.ok) return new NextResponse(result.error, { status: result.status })

  return NextResponse.redirect(result.url, { headers: { "Cache-Control": "no-store" } })
}

import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { getSessionState } from "@/common/lib/services/session.service"
import { getQuotePdf } from "@/modules/quotes/lib/services/quote-pdf.service"
import { getQuoteDetail } from "@/modules/quotes/lib/services/quotes.service"

// PDF de un presupuesto para el equipo (vista previa o descarga con ?download=1).
// El enviado sale tal cual se congeló; el borrador se genera al momento, marcado como borrador.
export async function GET(request: NextRequest, ctx: RouteContext<"/api/quotes/[id]/pdf">) {
  const session = await getSessionState()
  if (session.status !== "active") return new NextResponse("No autorizado.", { status: 401 })

  const { id } = await ctx.params
  if (!z.uuid().safeParse(id).success) return new NextResponse("Presupuesto inválido.", { status: 400 })
  // Con la sesión del usuario: RLS decide qué puede ver.
  const quote = await getQuoteDetail(id)
  if (!quote) return new NextResponse("El presupuesto no existe.", { status: 404 })

  const pdf = await getQuotePdf(quote)
  const download = request.nextUrl.searchParams.get("download") === "1"
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${quote.code}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  })
}

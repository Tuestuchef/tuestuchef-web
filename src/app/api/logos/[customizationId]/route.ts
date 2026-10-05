import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"
import { createReceiptDownloadUrl } from "@/common/lib/services/receipts.service"
import { getSessionState } from "@/common/lib/services/session.service"
import { getStorage } from "@/common/lib/services/storage.service"

// Redirige a una URL prefirmada de corta duración del logo de una personalización.
// Verifica la sesión y, vía RLS, que la persona pueda ver ese pedido.
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/logos/[customizationId]">) {
  const session = await getSessionState()
  if (session.status !== "active") return new NextResponse("No autorizado.", { status: 401 })

  const { customizationId } = await ctx.params
  if (!z.uuid().safeParse(customizationId).success) return new NextResponse("No encontrado.", { status: 404 })

  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.from("sale_item_customizations").select("logo_path").eq("id", customizationId).maybeSingle()
  if (!data?.logo_path) return new NextResponse("Logo no encontrado.", { status: 404 })

  const signed = await createReceiptDownloadUrl(getStorage(), data.logo_path)
  if (!signed.ok) return new NextResponse(signed.error, { status: 503 })
  return NextResponse.redirect(signed.data, { headers: { "Cache-Control": "no-store" } })
}

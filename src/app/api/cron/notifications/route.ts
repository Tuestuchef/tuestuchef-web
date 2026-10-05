import { NextResponse, type NextRequest } from "next/server"

import { serverEnv } from "@/common/lib/config/server-env.config"
import { dispatchNotifications } from "@/modules/notifications/lib/services/notification-dispatch.service"
import { expireQuotes } from "@/modules/quotes/lib/services/quote-expiry.service"

// Tareas diarias de la mañana: vence los presupuestos cuya fecha pasó y envía el resumen de avisos.
// Vercel Cron la llama cada mañana (vercel.json) con Authorization: Bearer CRON_SECRET.
export async function GET(request: NextRequest) {
  const secret = serverEnv.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  }
  const quotes = await expireQuotes()
  const summary = await dispatchNotifications()
  return NextResponse.json({ ...summary, quotes }, { status: summary.ok && quotes.ok ? 200 : 502 })
}

import "server-only"

import { createSupabaseAdminClient } from "@/common/lib/db/supabase-admin.client"

// Marca como vencidos los presupuestos enviados cuya fecha pasó (lo llama el cron diario).
// Las pantallas ya los muestran vencidos al momento; esto deja el cambio en su historial.
export async function expireQuotes(): Promise<{ ok: boolean; expired: number; error?: string }> {
  const admin = createSupabaseAdminClient()
  if (!admin) return { ok: false, expired: 0, error: "Falta SUPABASE_SECRET_KEY." }
  const { data, error } = await admin.rpc("expire_quotes")
  if (error) return { ok: false, expired: 0, error: error.message }
  return { ok: true, expired: data ?? 0 }
}

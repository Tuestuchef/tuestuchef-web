"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { authorizeAction } from "@/common/lib/services/session.service"
import { toUserError } from "@/common/lib/utils/to-user-error.util"

import { createSaleSchema } from "../schemas/sales.schema"
import { discardOfflineSale, retryOfflineSale, syncOfflineSale } from "../services/offline-sales.service"

const syncSchema = z.object({
  clientRef: z.uuid(),
  // Cuándo se hizo la venta en el teléfono (no futuro; la base valida el límite de staff).
  occurredAt: z.iso.datetime({ offset: true }).refine((v) => new Date(v).getTime() <= Date.now() + 5 * 60_000, "Fecha futura."),
  sale: createSaleSchema,
})

export type SyncResult =
  | { ok: true; status: "created" | "duplicate" | "rejected"; saleId?: string; error?: string }
  | { ok: false; error: string }

// Envía una venta hecha sin conexión. "rejected" = la base no la aceptó: queda guardada para revisión.
export async function syncOfflineSaleAction(input: unknown): Promise<SyncResult> {
  const auth = await authorizeAction(ROLE_GROUPS.ALL)
  if (!auth.ok) return { ok: false, error: auth.error }
  const parsed = syncSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Venta sin conexión inválida." }

  const { data, error } = await syncOfflineSale(parsed.data.clientRef, parsed.data.occurredAt, parsed.data.sale)
  if (error || !data) return { ok: false, error: toUserError(error, "No se pudo enviar la venta.") }
  if (data.status !== "rejected") refresh()
  return { ok: true, status: data.status, saleId: data.sale_id, error: data.error }
}

export async function retryOfflineSaleAction(id: string): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { ok: false, error: auth.error }
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Venta inválida." }
  const { data, error } = await retryOfflineSale(id)
  if (error || !data) return { ok: false, error: toUserError(error, "No se pudo reintentar.") }
  refresh()
  return data.status === "rejected" ? { ok: false, error: data.error ?? "Sigue sin pasar." } : { ok: true, message: "Venta registrada." }
}

const discardSchema = z.object({ id: z.uuid(), reason: z.string().trim().min(3, { error: "Explica el motivo." }).max(300) })

export async function discardOfflineSaleAction(input: unknown): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { ok: false, error: auth.error }
  const parsed = discardSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa el motivo." }
  const { error } = await discardOfflineSale(parsed.data.id, parsed.data.reason)
  if (error) return { ok: false, error: toUserError(error) }
  refresh()
  return { ok: true, message: "Venta pendiente descartada." }
}

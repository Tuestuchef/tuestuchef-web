"use server"

import { refresh } from "next/cache"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { authorizeAction } from "@/common/lib/services/session.service"
import { toUserError } from "@/common/lib/utils/to-user-error.util"

import { createSaleSchema } from "../schemas/sales.schema"
import { createSale } from "../services/sales.service"

type Result = { ok: true; saleId: string } | { ok: false; error: string }

// El carrito llega como objeto; se valida entero con Zod y la base vuelve a validar todo.
export async function createSaleAction(input: unknown): Promise<Result> {
  const auth = await authorizeAction(ROLE_GROUPS.ALL)
  if (!auth.ok) return { ok: false, error: auth.error }

  const parsed = createSaleSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa la venta." }

  const { data, error } = await createSale(parsed.data)
  if (error || !data) return { ok: false, error: toUserError(error, "No se pudo registrar la venta.") }

  refresh()
  return { ok: true, saleId: data }
}

"use server"

import { refresh } from "next/cache"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { authorizeAction } from "@/common/lib/services/session.service"
import type { ActionState } from "@/common/lib/types/action-state.types"
import { toUserError } from "@/common/lib/utils/to-user-error.util"

import { PRODUCT_MESSAGES } from "../constants/products.constants"
import { productSizeSurchargesSchema } from "../schemas/products.schema"
import { saveProductSizeSurcharges } from "../services/surcharges.service"

// Tabla "Precio por talla" de un producto: rows llega como JSON [{ size_id, gender, amount_usd }].
export async function saveProductSizeSurchargesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { status: "error", message: auth.error }

  let rows: unknown
  try {
    rows = JSON.parse(String(formData.get("rows") ?? "[]"))
  } catch {
    return { status: "error", message: "Revisa los montos." }
  }
  const parsed = productSizeSurchargesSchema.safeParse({ product_id: formData.get("product_id"), rows })
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa los montos." }

  const { error } = await saveProductSizeSurcharges(parsed.data)
  if (error) return { status: "error", message: toUserError(error) }

  refresh()
  return { status: "success", message: PRODUCT_MESSAGES.SURCHARGES_SAVED, submissionId: crypto.randomUUID() }
}

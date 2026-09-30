"use server"

import { refresh } from "next/cache"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { authorizeAction } from "@/common/lib/services/session.service"
import type { ActionState } from "@/common/lib/types/action-state.types"
import { toUserError } from "@/common/lib/utils/to-user-error.util"

import { PRODUCT_MESSAGES } from "../constants/products.constants"
import { pricesSchema } from "../schemas/products.schema"
import { saveProductPrices } from "../services/prices.service"

const PRICE_PREFIX = "price_"

// Campos price_<método>: USD de referencia; vacío quita el precio de ese método.
export async function saveProductPricesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { status: "error", message: auth.error }

  const prices = Object.fromEntries(
    [...formData.entries()]
      .filter(([key]) => key.startsWith(PRICE_PREFIX))
      .map(([key, value]) => [key.slice(PRICE_PREFIX.length), String(value)])
  )
  const parsed = pricesSchema.safeParse({ product_id: formData.get("product_id"), prices })
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa los precios." }

  const { error } = await saveProductPrices(parsed.data.product_id, parsed.data.prices)
  if (error) return { status: "error", message: toUserError(error) }

  refresh()
  return { status: "success", message: PRODUCT_MESSAGES.PRICES_SAVED, submissionId: crypto.randomUUID() }
}

"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { isRoleIn, ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { authorizeAction } from "@/common/lib/services/session.service"
import type { ActionState } from "@/common/lib/types/action-state.types"
import { toUserError } from "@/common/lib/utils/to-user-error.util"

import { PRODUCT_MESSAGES, STAFF_MOVEMENT_TYPES } from "../constants/products.constants"
import { type StockMovementField, stockMovementSchema } from "../schemas/products.schema"
import { createStockMovement } from "../services/stock.service"

// Staff: compras y producción. Owner y admin: también ajustes. RLS lo vuelve a validar.
export async function createStockMovementAction(
  _prev: ActionState<StockMovementField>,
  formData: FormData
): Promise<ActionState<StockMovementField>> {
  const auth = await authorizeAction(ROLE_GROUPS.ALL)
  if (!auth.ok) return { status: "error", message: auth.error }

  const parsed = stockMovementSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }

  if (!isRoleIn(auth.user.role, ROLE_GROUPS.MANAGEMENT) && !STAFF_MOVEMENT_TYPES.includes(parsed.data.movement_type)) {
    return { status: "error", message: "Solo owner y admin pueden hacer ajustes de stock." }
  }

  const { error } = await createStockMovement(parsed.data)
  if (error) return { status: "error", message: toUserError(error) }

  refresh()
  return { status: "success", message: PRODUCT_MESSAGES.MOVEMENT_SAVED, submissionId: crypto.randomUUID() }
}
